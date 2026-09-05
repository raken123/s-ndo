'use strict';
// Authoritative multiplayer rooms. One fixed-step simulation per room, 20 Hz.
const crypto = require('crypto');
const C = require('./catalog');
const { err } = require('./auth');

const TICK_MS = 50;
const TILE = 40;
const R = 14;               // player radius
const BASE_SPEED = 200;     // px/s
const RESULTS_MS = 8000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  const b = crypto.randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[b[i] % CODE_CHARS.length];
  return s;
}

class Room {
  constructor(game, { private: priv = false, host = null } = {}) {
    this.id = 'r' + crypto.randomBytes(4).toString('hex');
    this.code = makeCode();
    this.gameId = game.id;
    this.game = game;
    this.private = priv;
    this.host = host;
    this.players = new Map();       // userId -> player
    this.gems = new Map();          // gemId -> {id,x,y}
    this.gemSeq = 1;
    this.phase = 'waiting';         // waiting | playing | results
    this.phaseEnds = 0;
    this.spawnAcc = 0;
    this.secAcc = 0;
    this.events = [];
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.open = [];                 // open tile indices
    const g = game;
    for (let i = 0; i < g.cols * g.rows; i++) if (!g.walls.includes(i)) this.open.push(i);
    this.wallSet = new Set(g.walls);
    // king-of-the-hill zone: the open tile closest to the centre
    const cx = g.cols / 2 - 0.5, cy = g.rows / 2 - 0.5;
    let best = null, bd = Infinity;
    for (const i of this.open) {
      const x = i % g.cols, y = Math.floor(i / g.cols);
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    this.zone = { x: ((best % g.cols) + 0.5) * TILE, y: (Math.floor(best / g.cols) + 0.5) * TILE, r: TILE * 2.2 };
    this.maxGems = Math.max(2, Math.round(this.open.length * 0.04 * (g.gemRate || 1)));
  }

  get size() { return this.players.size; }
  get full() { return this.players.size >= this.game.maxPlayers; }

  isWall(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.game.cols || ty >= this.game.rows) return true;
    return this.wallSet.has(ty * this.game.cols + tx);
  }
  collides(x, y) {
    return this.isWall(x - R, y - R) || this.isWall(x + R, y - R) || this.isWall(x - R, y + R) || this.isWall(x + R, y + R);
  }
  randomOpen() {
    const i = this.open[Math.floor(Math.random() * this.open.length)];
    return { x: ((i % this.game.cols) + 0.5) * TILE, y: (Math.floor(i / this.game.cols) + 0.5) * TILE };
  }

  addPlayer(user, avatar, perks, send) {
    const pos = this.randomOpen();
    const p = {
      id: user.id, name: user.displayName, avatar, perks, send,
      x: pos.x, y: pos.y, dx: 0, dy: 0, score: 0, it: false, immune: 0,
      joinedAt: Date.now(), playedMs: 0, isCreator: this.game.creator === user.id,
    };
    this.players.set(user.id, p);
    this.lastActivity = Date.now();
    if (this.phase === 'waiting') this.startRound();
    if (this.game.mode === 'tag' && ![...this.players.values()].some(q => q.it)) p.it = true;
    this.events.push({ k: 'join', id: p.id, name: p.name });
    this.broadcastRoster();
    return p;
  }

  removePlayer(userId) {
    const p = this.players.get(userId);
    if (!p) return;
    this.players.delete(userId);
    this.events.push({ k: 'leave', id: p.id, name: p.name });
    if (p.it && this.players.size) {
      const next = [...this.players.values()][Math.floor(Math.random() * this.players.size)];
      next.it = true; next.immune = 1.5;
      this.events.push({ k: 'tag', it: next.id, name: next.name });
    }
    if (!this.players.size) { this.phase = 'waiting'; this.gems.clear(); }
    this.broadcastRoster();
  }

  startRound() {
    this.phase = 'playing';
    this.phaseEnds = Date.now() + this.game.roundSeconds * 1000;
    this.gems.clear();
    for (const p of this.players.values()) { p.score = 0; p.it = false; p.playedMs = 0; }
    if (this.game.mode === 'tag' && this.players.size) {
      const arr = [...this.players.values()];
      arr[Math.floor(Math.random() * arr.length)].it = true;
    }
    for (let i = 0; i < Math.ceil(this.maxGems / 2); i++) this.spawnGem();
    this.events.push({ k: 'round', phase: 'playing', seconds: this.game.roundSeconds });
  }

  spawnGem() {
    if (this.gems.size >= this.maxGems) return;
    const pos = this.randomOpen();
    const id = this.gemSeq++;
    this.gems.set(id, { id, x: pos.x, y: pos.y });
  }

  addScore(p, n) {
    if (p.perks.includes('double')) n *= 2;
    p.score += n;
  }

  tick(dt, onRoundEnd) {
    if (this.phase === 'results') {
      if (Date.now() >= this.phaseEnds) this.startRound();
      this.broadcastState();
      return;
    }
    if (this.phase !== 'playing') return;
    const g = this.game;
    const mode = g.mode;
    for (const p of this.players.values()) {
      p.playedMs += dt * 1000;
      if (p.immune > 0) p.immune -= dt;
      let sp = BASE_SPEED * (g.speed || 1) * (p.perks.includes('speed') ? 1.25 : 1);
      if (mode === 'tag' && p.it) sp *= 1.08; // the chaser gets a nudge so tag ends
      const len = Math.hypot(p.dx, p.dy) || 1;
      const vx = (p.dx / len) * sp, vy = (p.dy / len) * sp;
      if (vx) { const nx = p.x + vx * dt; if (!this.collides(nx, p.y)) p.x = nx; }
      if (vy) { const ny = p.y + vy * dt; if (!this.collides(p.x, ny)) p.y = ny; }
      // gems
      const reach = R + 10 * (p.perks.includes('magnet') ? 3 : 1);
      for (const gem of this.gems.values()) {
        if ((gem.x - p.x) ** 2 + (gem.y - p.y) ** 2 <= reach * reach) {
          this.gems.delete(gem.id);
          this.addScore(p, mode === 'gemrush' ? 10 : 5);
          this.events.push({ k: 'gem', id: p.id, gem: gem.id });
        }
      }
    }
    if (mode === 'tag') {
      const it = [...this.players.values()].find(p => p.it);
      if (it) {
        for (const q of this.players.values()) {
          if (q === it || q.immune > 0) continue;
          if ((q.x - it.x) ** 2 + (q.y - it.y) ** 2 <= (2 * R) ** 2) {
            it.it = false; q.it = true; q.immune = 1.5; it.immune = 1.5;
            this.addScore(it, 5);
            this.events.push({ k: 'tag', it: q.id, name: q.name, by: it.id });
            break;
          }
        }
      }
    }
    // per-second scoring
    this.secAcc += dt;
    while (this.secAcc >= 0.5) {
      this.secAcc -= 0.5;
      if (mode === 'koth') {
        for (const p of this.players.values()) {
          if ((p.x - this.zone.x) ** 2 + (p.y - this.zone.y) ** 2 <= this.zone.r ** 2) this.addScore(p, 1);
        }
      }
    }
    this.tagAcc = (this.tagAcc || 0) + dt;
    while (this.tagAcc >= 1) {
      this.tagAcc -= 1;
      if (mode === 'tag') for (const p of this.players.values()) if (!p.it) this.addScore(p, 1);
    }
    this.spawnAcc += dt;
    const interval = 1.5 / Math.max(0.05, g.gemRate || 1);
    while (this.spawnAcc >= interval) { this.spawnAcc -= interval; if (g.gemRate > 0) this.spawnGem(); }

    if (Date.now() >= this.phaseEnds) {
      this.phase = 'results';
      this.phaseEnds = Date.now() + RESULTS_MS;
      const results = [...this.players.values()].sort((a, b) => b.score - a.score)
        .map(p => ({ id: p.id, name: p.name, score: p.score, playedMs: p.playedMs }));
      const rewards = onRoundEnd(this, results);
      this.broadcast({ t: 'round.end', results, rewards, next: RESULTS_MS / 1000 });
    }
    this.broadcastState();
  }

  timeLeft() { return Math.max(0, Math.round((this.phaseEnds - Date.now()) / 1000)); }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) p.send(s);
  }
  roster() {
    return [...this.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, perks: p.perks, isCreator: p.isCreator }));
  }
  broadcastRoster() {
    this.broadcast({ t: 'room.roster', roster: this.roster(), size: this.size, max: this.game.maxPlayers });
  }
  broadcastState() {
    const st = {
      t: 'state', ph: this.phase, tl: this.timeLeft(),
      p: [...this.players.values()].map(p => [p.id, Math.round(p.x), Math.round(p.y), p.score, p.it ? 1 : 0, p.dx, p.dy]),
      g: [...this.gems.values()].map(g => [g.id, g.x, g.y]),
    };
    if (this.events.length) { st.ev = this.events; this.events = []; }
    this.broadcast(st);
  }
  info() {
    return { id: this.id, code: this.private ? undefined : this.code, gameId: this.gameId, size: this.size, max: this.game.maxPlayers,
      private: this.private, phase: this.phase, timeLeft: this.timeLeft(), host: this.host };
  }
  joinPayload(userId) {
    const g = this.game;
    return {
      room: Object.assign(this.info(), { code: this.code }),
      game: { id: g.id, name: g.name, mode: g.mode, cols: g.cols, rows: g.rows, walls: g.walls, theme: g.theme,
        roundSeconds: g.roundSeconds, maxPlayers: g.maxPlayers, creatorName: g.creatorName },
      zone: g.mode === 'koth' ? this.zone : null,
      tile: TILE, radius: R, you: userId, roster: this.roster(), phase: this.phase, timeLeft: this.timeLeft(),
    };
  }
}

class Rooms {
  constructor(db, games, economy, hooks = {}) {
    this.db = db; this.games = games; this.economy = economy; this.hooks = hooks;
    this.rooms = new Map();
    this.byUser = new Map();     // userId -> room
    this.timer = setInterval(() => this.tickAll(), TICK_MS);
    this.timer.unref();
    games.live = () => this.liveCounts();
  }

  close() { clearInterval(this.timer); }

  liveCounts() {
    const out = {};
    for (const r of this.rooms.values()) if (r.size) out[r.gameId] = (out[r.gameId] || 0) + r.size;
    return out;
  }
  onlineInGames() { let n = 0; for (const r of this.rooms.values()) n += r.size; return n; }

  listForGame(gameId) {
    return [...this.rooms.values()].filter(r => r.gameId === gameId && !r.private).map(r => r.info());
  }

  tickAll() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      if (r.size) r.tick(TICK_MS / 1000, (room, results) => this.settle(room, results));
      else if (now - r.lastActivity > 60000 && now - r.createdAt > 60000) this.rooms.delete(r.id);
    }
  }

  /** Round rewards: winners, participation, creator payout. Returns {userId: gems}. */
  settle(room, results) {
    const rewards = {};
    const g = room.game;
    const n = results.length;
    const minMs = Math.min(30000, g.roundSeconds * 1000 * 0.5);
    const competitive = n >= 2;
    const users = this.db.data.users;
    results.forEach((r, i) => {
      const u = users[r.id]; if (!u) return;
      let gems = 0;
      if (r.playedMs >= minMs) { gems += C.ROUND_REWARD.play; u.stats.rounds += 1; }
      if (competitive && i === 0 && r.score > 0 && r.score > (results[1] ? results[1].score : -1)) { gems += C.ROUND_REWARD.win; u.stats.wins += 1; }
      if (gems) { this.economy.credit(u, gems, 'round', (i === 0 && competitive ? 'Won ' : 'Played ') + g.name); rewards[r.id] = gems; }
    });
    if (!g.official && competitive) {
      const creator = users[g.creator];
      const others = results.filter(r => r.id !== g.creator && r.playedMs >= minMs).length;
      if (creator && others > 0) {
        const gems = Math.min(g.maxPlayers, others) * C.ROUND_REWARD.creatorPerPlayer;
        this.economy.credit(creator, gems, 'creator', others + ' player' + (others > 1 ? 's' : '') + ' played ' + g.name);
        rewards[creator.id] = (rewards[creator.id] || 0) + gems;
      }
    }
    g.stats.plays += n;
    this.db.data.platform.roundsPlayed += 1;
    this.db.save();
    for (const id of Object.keys(rewards)) if (this.hooks.onUserChanged) this.hooks.onUserChanged(id);
    return rewards;
  }

  /** Join by game id (matchmake), room id, or invite code. */
  join(user, send, { gameId, roomId, code, private: priv = false } = {}) {
    let room = null;
    if (roomId) {
      room = this.rooms.get(roomId);
      if (!room) throw err('That server is gone', 'not_found');
    } else if (code) {
      code = String(code).trim().toUpperCase();
      room = [...this.rooms.values()].find(r => r.code === code);
      if (!room) throw err('No server with that code', 'not_found');
    } else {
      const game = this.games.get(gameId);
      if (!game.published && game.creator !== user.id) throw err('This game is not published', 'forbidden');
      if (priv) {
        room = new Room(game, { private: true, host: user.id });
        this.rooms.set(room.id, room);
      } else {
        const cands = [...this.rooms.values()].filter(r => r.gameId === gameId && !r.private && !r.full);
        cands.sort((a, b) => b.size - a.size);
        room = cands[0];
        if (!room) { room = new Room(game); this.rooms.set(room.id, room); }
      }
    }
    const current = this.byUser.get(user.id);
    if (current && current === room) return room.joinPayload(user.id);
    if (current) this.leave(user.id);
    if (room.full) throw err('That server is full', 'full');
    const avatar = this.economy.avatarOf(user);
    const perks = this.economy.perksFor(user, room.game);
    room.addPlayer(user, avatar, perks, send);
    this.byUser.set(user.id, room);
    return room.joinPayload(user.id);
  }

  leave(userId) {
    const room = this.byUser.get(userId);
    if (!room) return false;
    room.removePlayer(userId);
    this.byUser.delete(userId);
    return true;
  }

  input(userId, dx, dy) {
    const room = this.byUser.get(userId);
    if (!room) return;
    const p = room.players.get(userId);
    if (!p) return;
    p.dx = Math.max(-1, Math.min(1, Number(dx) || 0));
    p.dy = Math.max(-1, Math.min(1, Number(dy) || 0));
    room.lastActivity = Date.now();
  }

  roomOf(userId) { return this.byUser.get(userId) || null; }
}

module.exports = { Rooms, Room, TILE, TICK_MS };
