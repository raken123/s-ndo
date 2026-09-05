'use strict';
// The hub: HTTP static server + WebSocket message router tying everything together.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { attach } = require('./ws');
const { Db } = require('./db');
const { Auth, clean, err } = require('./auth');
const { Economy } = require('./economy');
const { Games } = require('./games');
const { Rooms } = require('./rooms');
const C = require('./catalog');

const VERSION = '1.0.0';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

class Hub {
  constructor({ dataFile, clientDir, payments, log = console.log } = {}) {
    this.log = log;
    this.db = new Db(dataFile);
    this.auth = new Auth(this.db);
    this.economy = new Economy(this.db, payments);
    this.games = new Games(this.db);
    this.rooms = new Rooms(this.db, this.games, this.economy, { onUserChanged: (id) => this.pushUser(id) });
    this.clientDir = clientDir;
    this.conns = new Set();
    this.online = new Map();   // userId -> Set(conn)
    this.chatLog = [];
    this.server = http.createServer((req, res) => this.http(req, res));
    attach(this.server, (ws, req) => this.connection(ws, req));
  }

  listen(port, host = '0.0.0.0') {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => { this.server.removeListener('error', reject); resolve(this.server.address().port); });
    });
  }

  close() {
    this.rooms.close();
    for (const c of this.conns) c.ws.close();
    this.db.close();
    return new Promise((r) => this.server.close(() => r()));
  }

  addresses(port) {
    const out = [];
    for (const list of Object.values(os.networkInterfaces())) for (const n of list) {
      if (n.family === 'IPv4' && !n.internal) out.push('http://' + n.address + ':' + port);
    }
    return out;
  }

  // ---------- HTTP ----------
  http(req, res) {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health' || url.pathname === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ name: 'gmfy hub', version: VERSION, online: this.online.size, inGame: this.rooms.onlineInGames(),
        games: Object.keys(this.db.data.games).length, sandboxPayments: !!this.economy.payments.sandbox }));
    }
    if (!this.clientDir) { res.writeHead(404); return res.end('no client bundled'); }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(this.clientDir, p));
    if (!file.startsWith(path.normalize(this.clientDir))) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (e, data) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  // ---------- WebSocket ----------
  connection(ws, req) {
    const conn = { ws, user: null, token: null, budget: 80, lastRefill: Date.now(), ip: ws.remoteAddress };
    this.conns.add(conn);
    ws.on('message', (raw) => {
      if (typeof raw !== 'string') return;
      // rate limit: 40 msg/s sustained, burst 80
      const now = Date.now();
      conn.budget = Math.min(80, conn.budget + (now - conn.lastRefill) * 0.04); conn.lastRefill = now;
      if (conn.budget < 1) return;
      conn.budget -= 1;
      let msg;
      try { msg = JSON.parse(raw); } catch { return ws.close(1003); }
      if (!msg || typeof msg.t !== 'string') return;
      this.dispatch(conn, msg);
    });
    ws.on('close', () => {
      this.conns.delete(conn);
      if (conn.user) this.setOffline(conn);
    });
    this.send(conn, { t: 'hello', version: VERSION, online: this.online.size });
  }

  send(conn, msg) { conn.ws.send(JSON.stringify(msg)); }
  reply(conn, msg, data) { if (msg.rid != null) this.send(conn, { t: 'res', rid: msg.rid, ok: true, data }); }
  fail(conn, msg, e) {
    if (!e.userFacing) this.log('[hub] error in ' + msg.t + ': ' + (e.stack || e));
    if (msg.rid != null) this.send(conn, { t: 'res', rid: msg.rid, ok: false, error: e.userFacing ? e.message : 'Server error', code: e.code || 'error' });
  }

  setOnline(conn, user, token) {
    if (conn.user && conn.user.id !== user.id) this.setOffline(conn);
    conn.user = user; conn.token = token;
    if (!this.online.has(user.id)) this.online.set(user.id, new Set());
    this.online.get(user.id).add(conn);
    this.notifyFriends(user.id);
  }
  setOffline(conn) {
    const id = conn.user.id;
    const set = this.online.get(id);
    if (set) { set.delete(conn); if (!set.size) { this.online.delete(id); this.rooms.leave(id); this.notifyFriends(id); } }
    conn.user = null;
  }
  pushUser(userId) {
    const u = this.db.data.users[userId];
    const set = this.online.get(userId);
    if (!u || !set) return;
    const s = JSON.stringify({ t: 'user', user: this.economy.publicUser(u) });
    for (const c of set) c.ws.send(s);
  }
  pushTo(userId, msg) {
    const set = this.online.get(userId);
    if (!set) return;
    const s = JSON.stringify(msg);
    for (const c of set) c.ws.send(s);
  }
  notifyFriends(userId) {
    const u = this.db.data.users[userId];
    if (!u) return;
    for (const f of u.friends) this.pushTo(f, { t: 'social', reason: 'presence' });
  }
  presence(userId) {
    const room = this.rooms.roomOf(userId);
    return { online: this.online.has(userId), room: room ? { id: room.id, gameId: room.gameId, gameName: room.game.name, private: room.private } : null };
  }

  dispatch(conn, msg) {
    try {
      const h = this.handlers[msg.t];
      if (!h) throw err('Unknown message: ' + msg.t);
      if (!h.public && !conn.user) throw err('Sign in first', 'unauthorized');
      const out = h.fn.call(this, conn, msg);
      if (h.silent) return;
      this.reply(conn, msg, out === undefined ? null : out);
    } catch (e) { this.fail(conn, msg, e); }
  }

  bootstrap(conn) {
    const u = conn.user;
    return {
      user: this.economy.publicUser(u),
      catalog: { items: Object.values(this.db.data.items), packs: C.GEM_PACKS, perks: C.PERKS, modes: C.MODES },
      games: this.games.list({ viewer: u.id }),
      online: this.online.size, inGame: this.rooms.onlineInGames(),
      leaderboard: this.leaderboard(),
      chat: this.chatLog.slice(-30),
      sandboxPayments: !!this.economy.payments.sandbox,
      version: VERSION,
    };
  }

  leaderboard() {
    return Object.values(this.db.data.users).sort((a, b) => b.stats.earned - a.stats.earned).slice(0, 20)
      .map(u => ({ id: u.id, name: u.displayName, earned: u.stats.earned, wins: u.stats.wins, rounds: u.stats.rounds, avatar: this.economy.avatarOf(u) }));
  }

  socialList(u) {
    const users = this.db.data.users;
    const pub = id => { const f = users[id]; return f ? Object.assign({ id: f.id, name: f.displayName, username: f.name, avatar: this.economy.avatarOf(f) }, this.presence(id)) : null; };
    return {
      friends: u.friends.map(pub).filter(Boolean),
      requestsIn: u.requestsIn.map(pub).filter(Boolean),
      requestsOut: u.requestsOut.map(pub).filter(Boolean),
    };
  }
}

const H = Hub.prototype.handlers = {};
const on = (t, fn, opts = {}) => { H[t] = Object.assign({ fn }, opts); };

// ----- auth -----
on('auth.register', function (conn, m) {
  const user = this.auth.register(m.name, m.password, m.displayName);
  const token = this.auth.createSession(user);
  this.setOnline(conn, user, token);
  return { token, user: this.economy.publicUser(user) };
}, { public: true });
on('auth.login', function (conn, m) {
  const user = this.auth.login(m.name, m.password);
  const token = this.auth.createSession(user);
  this.setOnline(conn, user, token);
  return { token, user: this.economy.publicUser(user) };
}, { public: true });
on('auth.resume', function (conn, m) {
  const user = this.auth.resume(m.token);
  this.setOnline(conn, user, m.token);
  return { user: this.economy.publicUser(user) };
}, { public: true });
on('auth.logout', function (conn) {
  if (conn.token) this.auth.logout(conn.token);
  this.setOffline(conn);
  return true;
});

// ----- hub / games -----
on('hub.bootstrap', function (conn) { return this.bootstrap(conn); });
on('hub.stats', function () {
  return { online: this.online.size, inGame: this.rooms.onlineInGames(), games: Object.keys(this.db.data.games).length, platform: this.db.data.platform };
});
on('leaderboard', function () { return this.leaderboard(); });
on('games.list', function (conn, m) { return this.games.list({ q: m.q, sort: m.sort, filter: m.filter, viewer: conn.user.id }); });
on('games.get', function (conn, m) {
  const g = this.games.get(m.id);
  if (!g.published && g.creator !== conn.user.id) throw err('This game is not published', 'forbidden');
  const creator = this.db.data.users[g.creator];
  return {
    game: Object.assign({}, g, { stats: g.stats }),
    summary: this.games.summary(g),
    creator: creator ? { id: creator.id, name: creator.displayName, avatar: this.economy.avatarOf(creator) } : { id: 'official', name: g.creatorName },
    rooms: this.rooms.listForGame(g.id),
    perks: this.economy.perksFor(conn.user, g),
    liked: (conn.user.likes || []).includes(g.id),
  };
});
on('games.save', function (conn, m) { return this.games.save(conn.user, m.game); });
on('games.delete', function (conn, m) { return this.games.remove(conn.user, m.id); });
on('games.like', function (conn, m) { return this.games.like(conn.user, m.id); });
on('games.mine', function (conn) { return this.games.list({ filter: 'mine', viewer: conn.user.id, sort: 'new' }); });

// ----- rooms -----
on('room.join', function (conn, m) {
  const payload = this.rooms.join(conn.user, (s) => conn.ws.send(s), { gameId: m.gameId, roomId: m.roomId, code: m.code, private: !!m.private });
  this.notifyFriends(conn.user.id);
  return payload;
});
on('room.leave', function (conn) { const r = this.rooms.leave(conn.user.id); this.notifyFriends(conn.user.id); return r; });
on('room.list', function (conn, m) { return this.rooms.listForGame(m.gameId); });
on('input', function (conn, m) { this.rooms.input(conn.user.id, m.dx, m.dy); }, { silent: true });

// ----- chat -----
on('chat', function (conn, m) {
  const text = clean(m.text, 200);
  if (!text) return;
  const entry = { t: 'chat', scope: m.scope === 'room' ? 'room' : 'global', from: conn.user.id, name: conn.user.displayName, text, ts: Date.now() };
  if (entry.scope === 'room') {
    const room = this.rooms.roomOf(conn.user.id);
    if (room) room.broadcast(entry);
  } else {
    this.chatLog.push(entry); if (this.chatLog.length > 100) this.chatLog.shift();
    const s = JSON.stringify(entry);
    for (const c of this.conns) if (c.user) c.ws.send(s);
  }
}, { silent: true });

// ----- economy -----
on('econ.daily', function (conn) { const n = this.economy.claimDaily(conn.user); this.pushUser(conn.user.id); return { gems: n, user: this.economy.publicUser(conn.user) }; });
on('econ.buyItem', function (conn, m) { const it = this.economy.buyItem(conn.user, m.itemId); return { item: it, user: this.economy.publicUser(conn.user) }; });
on('econ.equip', function (conn, m) { const a = this.economy.equip(conn.user, m.itemId); return { avatar: a, user: this.economy.publicUser(conn.user) }; });
on('econ.buyGems', function (conn, m) { const p = this.economy.buyGems(conn.user, m.packId, m.receipt); return { pack: p, user: this.economy.publicUser(conn.user) }; });
on('econ.buyPass', function (conn, m) {
  const g = this.games.get(m.gameId);
  const pass = this.economy.buyPass(conn.user, g, m.passId);
  pass.sold = (pass.sold || 0) + 1; this.db.save();
  this.pushUser(g.creator);
  // perks apply immediately if the buyer is in a room of this game
  const room = this.rooms.roomOf(conn.user.id);
  if (room && room.gameId === g.id) { const p = room.players.get(conn.user.id); if (p) { p.perks = this.economy.perksFor(conn.user, g); room.broadcastRoster(); } }
  return { pass, user: this.economy.publicUser(conn.user), perks: this.economy.perksFor(conn.user, g) };
});
on('econ.ledger', function (conn) { return conn.user.ledger.slice().reverse(); });

// ----- social -----
on('social.list', function (conn) { return this.socialList(conn.user); });
on('social.add', function (conn, m) {
  const name = String(m.name || '').trim().toLowerCase();
  const id = this.db.data.names[name];
  const other = id && this.db.data.users[id];
  if (!other) throw err('No player called ' + name);
  const u = conn.user;
  if (other.id === u.id) throw err('That is you');
  if (u.friends.includes(other.id)) throw err('Already friends');
  if (u.requestsIn.includes(other.id)) return H['social.accept'].fn.call(this, conn, { id: other.id });
  if (!u.requestsOut.includes(other.id)) { u.requestsOut.push(other.id); other.requestsIn.push(u.id); this.db.save(); }
  this.pushTo(other.id, { t: 'social', reason: 'request', from: u.displayName });
  return this.socialList(u);
});
on('social.accept', function (conn, m) {
  const u = conn.user, other = this.db.data.users[m.id];
  if (!other || !u.requestsIn.includes(other.id)) throw err('No such request');
  u.requestsIn = u.requestsIn.filter(x => x !== other.id); other.requestsOut = other.requestsOut.filter(x => x !== u.id);
  if (!u.friends.includes(other.id)) u.friends.push(other.id);
  if (!other.friends.includes(u.id)) other.friends.push(u.id);
  this.db.save();
  this.pushTo(other.id, { t: 'social', reason: 'accepted', from: u.displayName });
  return this.socialList(u);
});
on('social.decline', function (conn, m) {
  const u = conn.user, other = this.db.data.users[m.id];
  if (!other) throw err('No such player');
  u.requestsIn = u.requestsIn.filter(x => x !== other.id); u.requestsOut = u.requestsOut.filter(x => x !== other.id);
  other.requestsOut = other.requestsOut.filter(x => x !== u.id); other.requestsIn = other.requestsIn.filter(x => x !== u.id);
  this.db.save();
  return this.socialList(u);
});
on('social.remove', function (conn, m) {
  const u = conn.user, other = this.db.data.users[m.id];
  if (!other) throw err('No such player');
  u.friends = u.friends.filter(x => x !== other.id); other.friends = other.friends.filter(x => x !== u.id);
  this.db.save();
  this.pushTo(other.id, { t: 'social', reason: 'presence' });
  return this.socialList(u);
});
on('profile.get', function (conn, m) {
  const u = this.db.data.users[m.id];
  if (!u) throw err('No such player', 'not_found');
  const games = this.games.list({ filter: 'all', viewer: null }).filter(g => g.creator === u.id);
  return Object.assign({ id: u.id, name: u.displayName, username: u.name, avatar: this.economy.avatarOf(u), stats: u.stats, created: u.created, games }, this.presence(u.id));
});

module.exports = { Hub, VERSION };
