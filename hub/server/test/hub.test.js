'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { start } = require('../index.js');
const { connect } = require('../lib/ws');
const { Room } = require('../lib/rooms');
const C = require('../lib/catalog');

async function client(port) {
  const ws = await connect('ws://127.0.0.1:' + port + '/ws');
  let id = 0; const pending = {}; const pushes = [];
  ws.on('message', (m) => { const j = JSON.parse(m); if (j.t === 'res') { const p = pending[j.rid]; delete pending[j.rid]; p(j); } else pushes.push(j); });
  const req = (t, o) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify(Object.assign({ t }, o || {}, { rid: i }))); });
  const ok = async (t, o) => { const r = await req(t, o); if (!r.ok) throw new Error(t + ': ' + r.error); return r.data; };
  const raw = (t, o) => ws.send(JSON.stringify(Object.assign({ t }, o || {})));
  const waitPush = (type, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { const i = pushes.findIndex(p => p.t === type); if (i >= 0) { clearInterval(iv); res(pushes.splice(i, 1)[0]); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('no push ' + type)); } }, 20); });
  return { ws, req, ok, raw, pushes, waitPush, close: () => ws.close() };
}

let srv;
test.before(async () => { srv = await start({ port: 0, host: '127.0.0.1', dataFile: null, quiet: true }); });
test.after(async () => { await srv.close(); });

test('register, login, resume, validation', async () => {
  const a = await client(srv.port);
  let r = await a.req('auth.register', { name: 'x', password: 'secret1' });
  assert.equal(r.ok, false);
  r = await a.req('auth.register', { name: 'alice', password: 'short' });
  assert.equal(r.ok, false);
  const reg = await a.ok('auth.register', { name: 'Alice', password: 'secret1', displayName: 'Alice A' });
  assert.equal(reg.user.name, 'alice');
  assert.equal(reg.user.gems, C.STARTING_GEMS);
  r = await a.req('auth.register', { name: 'alice', password: 'secret1' });
  assert.match(r.error, /taken/);
  const b = await client(srv.port);
  r = await b.req('auth.login', { name: 'alice', password: 'wrong' });
  assert.equal(r.ok, false);
  const res = await b.ok('auth.resume', { token: reg.token });
  assert.equal(res.user.id, reg.user.id);
  r = await b.req('auth.resume', { token: 'nope' });
  assert.equal(r.code, 'unauthorized');
  a.close(); b.close();
});

test('unauthenticated requests are rejected', async () => {
  const a = await client(srv.port);
  const r = await a.req('hub.bootstrap');
  assert.equal(r.ok, false); assert.equal(r.code, 'unauthorized');
  a.close();
});

test('economy: daily, shop, gem packs, ledger', async () => {
  const a = await client(srv.port);
  const { user } = await a.ok('auth.register', { name: 'bob', password: 'secret1' });
  const d = await a.ok('econ.daily');
  assert.equal(d.user.gems, user.gems + C.DAILY_BONUS);
  let r = await a.req('econ.daily');
  assert.equal(r.code, 'too_soon');
  r = await a.req('econ.buyItem', { itemId: 'h_crown' }); // 400 > 250
  assert.equal(r.code, 'insufficient');
  const it = await a.ok('econ.buyItem', { itemId: 'h_cap' });
  assert.equal(it.user.gems, 250 - 60);
  r = await a.req('econ.buyItem', { itemId: 'h_cap' });
  assert.match(r.error, /already own/);
  const eq = await a.ok('econ.equip', { itemId: 'h_cap' });
  assert.equal(eq.avatar.hat, 'cap');
  r = await a.req('econ.equip', { itemId: 'h_crown' });
  assert.match(r.error, /do not own/);
  const pk = await a.ok('econ.buyGems', { packId: 'p_small' });
  assert.equal(pk.user.gems, 190 + 500);
  const ledger = await a.ok('econ.ledger');
  assert.equal(ledger[0].type, 'purchase');
  assert.equal(ledger.length, 4);
  a.close();
});

test('game passes pay the creator 70% and grant perks in-room', async () => {
  const creator = await client(srv.port);
  const buyer = await client(srv.port);
  const cu = (await creator.ok('auth.register', { name: 'maker', password: 'secret1' })).user;
  await buyer.ok('auth.register', { name: 'buyer', password: 'secret1' });
  const g = await creator.ok('games.save', { game: { name: 'Maker Arena', mode: 'gemrush', cols: 16, rows: 10, walls: [], published: true,
    passes: [{ name: 'Zoom', perk: 'speed', price: 100 }, { name: 'Gold', perk: 'vip', price: 10 }] } });
  assert.equal(g.passes.length, 2);
  assert.ok(g.passes[0].id.startsWith('gp_' + g.id));
  let r = await creator.req('econ.buyPass', { gameId: g.id, passId: g.passes[0].id });
  assert.match(r.error, /own this game/);
  const joined = await buyer.ok('room.join', { gameId: g.id });
  assert.deepEqual(joined.roster[0].perks, []);
  await buyer.waitPush('room.roster');
  buyer.pushes.length = 0;
  const bought = await buyer.ok('econ.buyPass', { gameId: g.id, passId: g.passes[0].id });
  assert.equal(bought.user.gems, 100);
  assert.deepEqual(bought.perks, ['speed']);
  const roster = await buyer.waitPush('room.roster');
  assert.deepEqual(roster.roster[0].perks, ['speed']);
  const push = await creator.waitPush('user');
  assert.equal(push.user.gems, cu.gems + 70);
  r = await buyer.req('econ.buyPass', { gameId: g.id, passId: g.passes[0].id });
  assert.match(r.error, /already own/);
  // sold passes cannot be removed
  r = await creator.req('games.save', { game: Object.assign({}, g, { passes: [g.passes[1]] }) });
  assert.match(r.error, /cannot be removed/);
  // but can be re-priced, keeping the id
  const g2 = await creator.ok('games.save', { game: Object.assign({}, g, { passes: [Object.assign({}, g.passes[0], { price: 200 }), g.passes[1]] }) });
  assert.equal(g2.passes[0].id, g.passes[0].id);
  assert.equal(g2.passes[0].price, 200);
  assert.equal(g2.passes[0].sold, 1);
  const detail = await buyer.ok('games.get', { id: g.id });
  assert.deepEqual(detail.perks, ['speed']);
  creator.close(); buyer.close();
});

test('custom game validation', async () => {
  const a = await client(srv.port);
  await a.ok('auth.register', { name: 'val', password: 'secret1' });
  let r = await a.req('games.save', { game: { name: 'ab' } });
  assert.match(r.error, /at least 3/);
  r = await a.req('games.save', { game: { name: 'Bad mode', mode: 'nope' } });
  assert.match(r.error, /mode/);
  r = await a.req('games.save', { game: { name: 'Solid', cols: 12, rows: 8, walls: Array.from({ length: 96 }, (_, i) => i) } });
  assert.match(r.error, /open tiles/);
  const g = await a.ok('games.save', { game: { name: 'Clamp', cols: 999, rows: 1, roundSeconds: 5, maxPlayers: 99, speed: 9, theme: { bg: 'red' }, passes: [{ name: 'Pp', perk: 'double', price: 1 }] } });
  assert.equal(g.cols, 48); assert.equal(g.rows, 8); assert.equal(g.roundSeconds, 30); assert.equal(g.maxPlayers, 20); assert.equal(g.speed, 1.6);
  assert.equal(g.theme.bg, '#0d1425'); assert.equal(g.passes[0].price, 10);
  assert.equal(g.published, false);
  const b = await client(srv.port);
  await b.ok('auth.register', { name: 'other', password: 'secret1' });
  r = await b.req('games.get', { id: g.id });
  assert.equal(r.code, 'forbidden');
  r = await b.req('games.save', { game: { id: g.id, name: 'Stolen' } });
  assert.equal(r.code, 'forbidden');
  const list = await b.ok('games.list', { filter: 'community' });
  assert.ok(!list.find(x => x.id === g.id), 'unpublished game hidden from others');
  a.close(); b.close();
});

test('multiplayer: two players in one room see each other move', async () => {
  const a = await client(srv.port), b = await client(srv.port);
  await a.ok('auth.register', { name: 'pl1', password: 'secret1' });
  await b.ok('auth.register', { name: 'pl2', password: 'secret1' });
  const ja = await a.ok('room.join', { gameId: 'g_tag' });
  const jb = await b.ok('room.join', { gameId: 'g_tag' });
  assert.equal(ja.room.id, jb.room.id, 'matchmade into the same room');
  assert.equal(jb.roster.length, 2);
  assert.equal(jb.game.cols, 26);
  const first = (await b.waitPush('state')).p.find(x => x[0] === ja.you);
  a.raw('input', { dx: 1, dy: 0 });
  await new Promise(r => setTimeout(r, 400));
  a.raw('input', { dx: -1, dy: 0 });      // in case the spawn tile had a wall to the right
  await new Promise(r => setTimeout(r, 400));
  const st = b.pushes.filter(p => p.t === 'state').pop();
  const pa = st.p.find(x => x[0] === ja.you), pb = st.p.find(x => x[0] === jb.you);
  assert.ok(pa && pb);
  assert.equal(pa[5], -1, 'server echoes player 1 input');
  const xs = b.pushes.filter(p => p.t === 'state').map(p => p.p.find(x => x[0] === ja.you)[1]);
  assert.ok(xs.some(x => x !== first[1]), 'player 1 moved on the server');
  assert.equal(st.ph, 'playing');
  assert.ok(st.p.some(x => x[4] === 1), 'someone is it in tag');
  const rooms = await a.ok('room.list', { gameId: 'g_tag' });
  assert.equal(rooms[0].size, 2);
  // private room + invite code
  const c = await client(srv.port);
  await c.ok('auth.register', { name: 'pl3', password: 'secret1' });
  const jc = await c.ok('room.join', { gameId: 'g_tag', private: true });
  assert.notEqual(jc.room.id, ja.room.id);
  assert.equal((await a.ok('room.list', { gameId: 'g_tag' })).length, 1, 'private rooms are not listed');
  const jb2 = await b.ok('room.join', { code: jc.room.code });
  assert.equal(jb2.room.id, jc.room.id);
  let r = await c.req('room.join', { code: 'ZZZZZZ' });
  assert.equal(r.code, 'not_found');
  // leaving updates the roster of the other player
  await b.ok('room.leave');
  const roster = await c.waitPush('room.roster');
  assert.equal(roster.roster.length, 1);
  a.close(); b.close(); c.close();
});

test('room full → new room; disconnect leaves room', async () => {
  const clients = [];
  for (let i = 0; i < 3; i++) { const c = await client(srv.port); await c.ok('auth.register', { name: 'full' + i, password: 'secret1' }); clients.push(c); }
  const g = await clients[0].ok('games.save', { game: { name: 'Tiny', maxPlayers: 2, cols: 12, rows: 8, published: true } });
  const r0 = await clients[0].ok('room.join', { gameId: g.id });
  const r1 = await clients[1].ok('room.join', { gameId: g.id });
  const r2 = await clients[2].ok('room.join', { gameId: g.id });
  assert.equal(r0.room.id, r1.room.id);
  assert.notEqual(r2.room.id, r0.room.id);
  const rr = await clients[2].req('room.join', { roomId: r0.room.id });
  assert.equal(rr.code, 'full');
  clients[1].close();
  const roster = await clients[0].waitPush('room.roster');
  assert.equal(roster.roster.length, 1);
  clients[0].close(); clients[2].close();
});

test('round settlement pays winner, participants and creator', async () => {
  const { Db } = require('../lib/db');
  const { Auth } = require('../lib/auth');
  const { Economy } = require('../lib/economy');
  const { Games } = require('../lib/games');
  const { Rooms } = require('../lib/rooms');
  const db = new Db(null);
  const auth = new Auth(db), econ = new Economy(db), games = new Games(db);
  const rooms = new Rooms(db, games, econ);
  const maker = auth.register('maker', 'secret1'), w = auth.register('winner', 'secret1'), l = auth.register('loser', 'secret1');
  const g = games.save(maker, { name: 'Pay Arena', published: true, cols: 12, rows: 8, roundSeconds: 30 });
  const room = new Room(g);
  const results = [{ id: w.id, name: 'w', score: 50, playedMs: 30000 }, { id: l.id, name: 'l', score: 10, playedMs: 30000 }];
  const rewards = rooms.settle(room, results);
  assert.equal(rewards[w.id], C.ROUND_REWARD.win + C.ROUND_REWARD.play);
  assert.equal(rewards[l.id], C.ROUND_REWARD.play);
  assert.equal(rewards[maker.id], 2 * C.ROUND_REWARD.creatorPerPlayer);
  assert.equal(w.stats.wins, 1); assert.equal(l.stats.rounds, 1);
  assert.equal(g.stats.plays, 2);
  // solo rounds pay participation only
  const solo = rooms.settle(room, [{ id: w.id, name: 'w', score: 5, playedMs: 30000 }]);
  assert.equal(solo[w.id], C.ROUND_REWARD.play);
  assert.equal(solo[maker.id], undefined);
  rooms.close();
});

test('simulation: walls block movement, gems are collected, magnet doubles reach', () => {
  const g = Object.assign({ creator: 'x' }, C.OFFICIAL_GAMES[0]);
  const room = new Room(g);
  const send = () => {};
  const p = room.addPlayer({ id: 'u1', displayName: 'U1' }, {}, [], send);
  p.x = 60; p.y = 60; p.dx = -1; p.dy = 0;  // tile (1,1), wall at x<40
  for (let i = 0; i < 40; i++) room.tick(0.05, () => ({}));
  assert.ok(p.x >= 40 + 14 - 0.01, 'stopped at the wall: ' + p.x);
  room.gems.clear(); room.gems.set(99, { id: 99, x: p.x + 40, y: p.y });
  p.dx = 0; room.tick(0.05, () => ({}));
  assert.ok(room.gems.has(99), 'gem out of reach without magnet');
  p.perks = ['magnet']; room.tick(0.05, () => ({}));
  assert.ok(!room.gems.has(99), 'magnet picked it up');
  assert.equal(p.score, 10);
  p.perks = ['double']; room.gems.set(100, { id: 100, x: p.x, y: p.y }); room.tick(0.05, () => ({}));
  assert.equal(p.score, 30);
});

test('chat and friends', async () => {
  const a = await client(srv.port), b = await client(srv.port);
  await a.ok('auth.register', { name: 'chatter', password: 'secret1', displayName: 'Chatter' });
  await b.ok('auth.register', { name: 'listener', password: 'secret1' });
  a.raw('chat', { scope: 'global', text: 'hello <b>world</b>' });
  const m = await b.waitPush('chat');
  assert.equal(m.text, 'hello <b>world</b>'); assert.equal(m.name, 'Chatter');
  let s = await a.ok('social.add', { name: 'listener' });
  assert.equal(s.requestsOut.length, 1);
  const n = await b.waitPush('social');
  assert.equal(n.reason, 'request');
  const bl = await b.ok('social.list');
  assert.equal(bl.requestsIn[0].username, 'chatter');
  s = await b.ok('social.accept', { id: bl.requestsIn[0].id });
  assert.equal(s.friends.length, 1);
  assert.equal(s.friends[0].online, true);
  const r = await a.req('social.add', { name: 'listener' });
  assert.match(r.error, /Already friends/);
  const prof = await b.ok('profile.get', { id: s.friends[0].id });
  assert.equal(prof.username, 'chatter');
  a.close(); b.close();
});

test('http: health and static client', async () => {
  const get = (p) => new Promise((res) => require('http').get('http://127.0.0.1:' + srv.port + p, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d, type: r.headers['content-type'] })); }));
  const h = await get('/health');
  assert.equal(h.status, 200); assert.equal(JSON.parse(h.body).name, 'gmfy hub');
  const i = await get('/');
  assert.equal(i.status, 200); assert.match(i.type, /text\/html/); assert.match(i.body, /gmfy Hub/);
  const t = await get('/../server/index.js');
  assert.notEqual(t.status, 200);
});
