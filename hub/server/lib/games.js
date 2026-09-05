'use strict';
const C = require('./catalog');
const { err, clean } = require('./auth');

const HEX = /^#[0-9a-f]{6}$/i;
const LIMITS = { cols: [12, 48], rows: [8, 32], round: [30, 600], players: [2, 20], speed: [0.6, 1.6], gemRate: [0, 3], passes: 6, perUser: 20 };

function num(v, [lo, hi], fallback) {
  v = Number(v);
  if (!Number.isFinite(v)) v = fallback;
  return Math.min(hi, Math.max(lo, v));
}

class Games {
  constructor(db) {
    this.db = db;
    this.live = () => ({});     // gameId -> live player count, injected by rooms
    for (const g of C.OFFICIAL_GAMES) {
      const existing = db.data.games[g.id];
      db.data.games[g.id] = Object.assign({
        creator: 'official', creatorName: 'gmfy', official: true, published: true,
        createdAt: Date.now(), updatedAt: Date.now(), stats: { plays: 0, likes: 0, passSales: 0, revenue: 0 },
      }, existing || {}, g, { stats: (existing && existing.stats) || { plays: 0, likes: 0, passSales: 0, revenue: 0 } });
    }
    db.save();
  }

  get(id) {
    const g = this.db.data.games[id];
    if (!g) throw err('No such game', 'not_found');
    return g;
  }

  summary(g) {
    const live = this.live();
    return {
      id: g.id, name: g.name, mode: g.mode, modeName: (C.MODES[g.mode] || {}).name, desc: g.desc,
      creator: g.creator, creatorName: g.creatorName, official: !!g.official, published: !!g.published,
      theme: g.theme, maxPlayers: g.maxPlayers, roundSeconds: g.roundSeconds,
      stats: g.stats, playing: live[g.id] || 0, updatedAt: g.updatedAt, passes: (g.passes || []).length,
    };
  }

  list({ q = '', sort = 'popular', filter = 'all', viewer = null } = {}) {
    q = String(q || '').trim().toLowerCase();
    let all = Object.values(this.db.data.games).filter(g => g.published || (viewer && g.creator === viewer));
    if (filter === 'official') all = all.filter(g => g.official);
    if (filter === 'community') all = all.filter(g => !g.official);
    if (filter === 'mine' && viewer) all = all.filter(g => g.creator === viewer);
    if (q) all = all.filter(g => g.name.toLowerCase().includes(q) || (g.creatorName || '').toLowerCase().includes(q) || g.mode.includes(q));
    const live = this.live();
    const score = g => (live[g.id] || 0) * 50 + g.stats.plays + g.stats.likes * 5;
    if (sort === 'new') all.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'name') all.sort((a, b) => a.name.localeCompare(b.name));
    else all.sort((a, b) => score(b) - score(a) || (b.official ? 1 : 0) - (a.official ? 1 : 0));
    return all.map(g => this.summary(g));
  }

  /** Create or update a community game. `input` is untrusted. */
  save(user, input) {
    input = input || {};
    let g = null;
    if (input.id) {
      g = this.get(input.id);
      if (g.creator !== user.id) throw err('You can only edit your own games', 'forbidden');
    } else {
      const mine = Object.values(this.db.data.games).filter(x => x.creator === user.id);
      if (mine.length >= LIMITS.perUser) throw err('You have reached the limit of ' + LIMITS.perUser + ' games');
      g = { id: this.db.nextId('g'), creator: user.id, creatorName: user.displayName, official: false,
        createdAt: Date.now(), published: false, stats: { plays: 0, likes: 0, passSales: 0, revenue: 0 }, passes: [] };
    }
    const name = clean(input.name, 40);
    if (name.length < 3) throw err('Name must be at least 3 characters');
    const mode = String(input.mode || 'gemrush');
    if (!C.MODES[mode]) throw err('Unknown game mode');
    const cols = Math.round(num(input.cols, LIMITS.cols, 24));
    const rows = Math.round(num(input.rows, LIMITS.rows, 13));
    const wallSet = new Set();
    for (const w of Array.isArray(input.walls) ? input.walls : []) {
      const i = Number(w);
      if (Number.isInteger(i) && i >= 0 && i < cols * rows) wallSet.add(i);
    }
    for (let x = 0; x < cols; x++) { wallSet.add(x); wallSet.add((rows - 1) * cols + x); }
    for (let y = 0; y < rows; y++) { wallSet.add(y * cols); wallSet.add(y * cols + cols - 1); }
    if (cols * rows - wallSet.size < 10) throw err('The map needs at least 10 open tiles');
    const theme = input.theme || {};
    const t = {
      bg: HEX.test(theme.bg) ? theme.bg : '#0d1425',
      wall: HEX.test(theme.wall) ? theme.wall : '#2b3a67',
      accent: HEX.test(theme.accent) ? theme.accent : '#4cc2ff',
    };
    // passes
    const oldPasses = g.passes || [];
    const passes = [];
    const inPasses = Array.isArray(input.passes) ? input.passes.slice(0, LIMITS.passes) : [];
    let seq = oldPasses.reduce((m, p) => Math.max(m, Number((p.id.split('_').pop())) || 0), 0);
    for (const p of inPasses) {
      if (!p || typeof p !== 'object') continue;
      const prev = oldPasses.find(o => o.id === p.id);
      const pname = clean(p.name, 24);
      if (pname.length < 2) throw err('Each game pass needs a name');
      if (!C.PERKS[p.perk]) throw err('Unknown perk on pass "' + pname + '"');
      const price = Math.round(num(p.price, [10, 10000], 100));
      passes.push({ id: prev ? prev.id : 'gp_' + g.id + '_' + (++seq), name: pname, price, perk: p.perk,
        desc: clean(p.desc, 120) || C.PERKS[p.perk].desc, sold: prev ? (prev.sold || 0) : 0 });
    }
    for (const o of oldPasses) {
      if ((o.sold || 0) > 0 && !passes.find(p => p.id === o.id)) {
        throw err('The pass "' + o.name + '" has been sold and cannot be removed');
      }
    }
    Object.assign(g, {
      name, desc: clean(input.desc, 300), mode, cols, rows, walls: [...wallSet].sort((a, b) => a - b),
      roundSeconds: Math.round(num(input.roundSeconds, LIMITS.round, 120)),
      maxPlayers: Math.round(num(input.maxPlayers, LIMITS.players, 8)),
      speed: Math.round(num(input.speed, LIMITS.speed, 1) * 100) / 100,
      gemRate: Math.round(num(input.gemRate, LIMITS.gemRate, 1) * 100) / 100,
      theme: t, passes, published: !!input.published, updatedAt: Date.now(), creatorName: user.displayName,
    });
    this.db.data.games[g.id] = g;
    this.db.save();
    return g;
  }

  remove(user, id) {
    const g = this.get(id);
    if (g.creator !== user.id) throw err('You can only delete your own games', 'forbidden');
    delete this.db.data.games[id];
    this.db.save();
    return true;
  }

  like(user, id) {
    const g = this.get(id);
    user.likes = user.likes || [];
    const i = user.likes.indexOf(id);
    if (i >= 0) { user.likes.splice(i, 1); g.stats.likes = Math.max(0, g.stats.likes - 1); }
    else { user.likes.push(id); g.stats.likes += 1; }
    this.db.save();
    return { liked: i < 0, likes: g.stats.likes };
  }
}

module.exports = { Games, LIMITS };
