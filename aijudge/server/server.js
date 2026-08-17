#!/usr/bin/env node
/* server.js — the hall itself: matchmaking, the queue, and the bench.
 *
 *   node server/server.js
 *
 * Zero dependencies. The WebSocket handshake and framing are implemented here
 * against RFC 6455 so the server runs on a bare Node install.
 *
 * Environment:
 *   PORT                 default 8787
 *   GEMINI_API_KEY       enables the real bench; without it the server uses its
 *                        own rule-based scorer and says so in the verdict
 *   AIJUDGE_VIP_CODES    comma-separated redeem codes, e.g. "DRUM-1,DRUM-2"
 *   AIJUDGE_STATE        where VIP grants are persisted (default server/state.json)
 *
 * The server is authoritative about three things the client must not decide for
 * itself: who is matched with whom, whether a player really holds VIP, and what
 * the verdict is.
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const WEB_DIR = path.join(__dirname, '..', 'web');
const STATE_FILE = process.env.AIJUDGE_STATE || path.join(__dirname, 'state.json');
const VIP_CODES = new Set(
  (process.env.AIJUDGE_VIP_CODES || '').split(',').map(s => s.trim()).filter(Boolean));
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const TRIAL_SECONDS = 45;
const MODELS = { free: 'gemini-3.1-flash-lite', vip: 'gemini-3.6-flash' };

/* ---------------- the bench ----------------
   judge.js carries the prompt, the scene list and the rule-based fallback. It
   is written to attach itself to globalThis, so the server and the browser run
   exactly the same scoring code. */
let AJJudge = null;
try {
  const src = fs.readFileSync(path.join(WEB_DIR, 'src', 'judge.js'), 'utf8');
  (0, eval)(src);
  AJJudge = globalThis.AJJudge;
} catch (e) {
  console.error('! could not load web/src/judge.js (' + e.message + ')');
  console.error('  the server cannot score cases without it; start it from a checkout.');
  process.exit(1);
}

/* ---------------- persisted VIP grants ---------------- */

let state = { vip: {}, redeemed: {} };
try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); }
catch (e) { /* first run */ }

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), err => {
      if (err) console.error('! could not save state:', err.message);
    });
  }, 400);
}

/* ---------------- minimal WebSocket ---------------- */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/* Encodes one server->client text frame (never masked, per RFC 6455 §5.1). */
function encodeFrame(payload, opcode) {
  const data = Buffer.from(payload);
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(Math.floor(len / 4294967296), 2);
    header.writeUInt32BE(len >>> 0, 6);
  }
  header[0] = 0x80 | (opcode === undefined ? 0x1 : opcode);
  return Buffer.concat([header, data]);
}

function Conn(socket) {
  this.socket = socket;
  this.buf = Buffer.alloc(0);
  this.open = true;
  this.onMessage = null;
  this.onClose = null;

  socket.on('data', d => this._feed(d));
  socket.on('error', () => this.close());
  socket.on('close', () => {
    if (!this.open) return;
    this.open = false;
    if (this.onClose) this.onClose();
  });
}

Conn.prototype._feed = function (chunk) {
  this.buf = Buffer.concat([this.buf, chunk]);
  /* Frames are decoded one at a time; a partial frame stays buffered. */
  for (;;) {
    if (this.buf.length < 2) return;
    const b0 = this.buf[0], b1 = this.buf[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;

    if (len === 126) {
      if (this.buf.length < off + 2) return;
      len = this.buf.readUInt16BE(off); off += 2;
    } else if (len === 127) {
      if (this.buf.length < off + 8) return;
      const hi = this.buf.readUInt32BE(off), lo = this.buf.readUInt32BE(off + 4);
      len = hi * 4294967296 + lo; off += 8;
    }
    /* A client that sends megabytes is not playing the game. */
    if (len > 1 << 20) { this.close(); return; }

    let mask = null;
    if (masked) {
      if (this.buf.length < off + 4) return;
      mask = this.buf.slice(off, off + 4); off += 4;
    }
    if (this.buf.length < off + len) return;

    const payload = Buffer.from(this.buf.slice(off, off + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    this.buf = this.buf.slice(off + len);

    if (opcode === 0x8) { this.close(); return; }
    if (opcode === 0x9) { this._raw(encodeFrame(payload, 0xA)); continue; }  // ping
    if (opcode === 0xA) continue;                                            // pong
    if (opcode === 0x1 && this.onMessage) {
      let msg = null;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (e) { continue; }
      this.onMessage(msg);
    }
  }
};

Conn.prototype._raw = function (buf) {
  if (this.open) { try { this.socket.write(buf); } catch (e) { this.close(); } }
};
Conn.prototype.send = function (obj) { this._raw(encodeFrame(JSON.stringify(obj))); };
Conn.prototype.close = function () {
  if (!this.open) return;
  this.open = false;
  try { this.socket.end(encodeFrame('', 0x8)); } catch (e) { /* already gone */ }
  try { this.socket.destroy(); } catch (e) { /* already gone */ }
  if (this.onClose) this.onClose();
};

/* ---------------- players, queue, matches ---------------- */

const players = new Map();   // id -> player
const queue = [];            // player ids, front of the line first
const matches = new Map();   // matchId -> match
let nextMatch = 1;

function broadcast(obj) {
  for (const p of players.values()) if (p.conn.open) p.conn.send(obj);
}

function announceOnline() {
  broadcast({ t: 'online', n: players.size });
}

/* Everyone in the line is told where they stand and who is ahead of them. */
function pushQueue() {
  for (let i = 0; i < queue.length; i++) {
    const p = players.get(queue[i]);
    if (!p || !p.conn.open) continue;
    const ahead = queue.slice(0, i).map(id => {
      const q = players.get(id);
      return q ? { name: q.name, rank: q.rank, vip: q.vip } : null;
    }).filter(Boolean);
    p.conn.send({ t: 'queue', pos: i, total: queue.length, line: ahead });
  }
}

function removeFromQueue(id) {
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
}

/* Pairs off the front of the line whenever two people are standing there. */
function tryMatch() {
  while (queue.length >= 2) {
    const a = players.get(queue[0]);
    const b = players.get(queue[1]);
    if (!a || !a.conn.open) { queue.shift(); continue; }
    if (!b || !b.conn.open) { queue.splice(1, 1); continue; }
    queue.splice(0, 2);
    startMatch(a, b);
  }
  pushQueue();
}

function startMatch(a, b) {
  const id = 'm' + (nextMatch++);
  const scene = AJJudge.pickScene();
  const match = {
    id, scene,
    A: a, B: b,
    argA: null, argB: null,
    morphBy: null,
    done: false,
    deadline: Date.now() + TRIAL_SECONDS * 1000
  };
  matches.set(id, match);
  a.matchId = id; a.side = 'A';
  b.matchId = id; b.side = 'B';

  const packet = (me, foe, side) => ({
    t: 'match', matchId: id, scene, side,
    opponent: { name: foe.name, rank: foe.rank, vip: foe.vip },
    seconds: TRIAL_SECONDS
  });
  a.conn.send(packet(a, b, 'A'));
  b.conn.send(packet(b, a, 'B'));

  /* Silence is a submission of nothing, and the bench treats it that way. */
  match.timer = setTimeout(() => {
    if (match.done) return;
    if (match.argA === null) match.argA = '';
    if (match.argB === null) match.argB = '';
    resolve(match);
  }, TRIAL_SECONDS * 1000 + 1500);
}

function endMatch(match) {
  clearTimeout(match.timer);
  matches.delete(match.id);
  for (const side of ['A', 'B']) {
    const p = match[side];
    if (p) { p.matchId = null; p.side = null; }
  }
}

async function resolve(match) {
  if (match.done) return;
  match.done = true;
  clearTimeout(match.timer);

  const nameA = match.A.name, nameB = match.B.name;

  /* A drum morph hands the ruling to a player instead of the model. */
  if (match.morphBy) {
    const judgeP = match[match.morphBy];
    const otherP = match[match.morphBy === 'A' ? 'B' : 'A'];
    const payload = {
      t: 'awaitMorphVerdict', matchId: match.id, scene: match.scene,
      nameA, argA: match.argA, nameB, argB: match.argB
    };
    if (judgeP.conn.open) judgeP.conn.send(payload);
    if (otherP.conn.open) otherP.conn.send({ t: 'morphed', by: match.morphBy });
    /* If the morphed player dithers, the bench takes the case back. */
    match.morphTimer = setTimeout(() => {
      if (!matches.has(match.id)) return;
      match.morphBy = null;
      match.done = false;
      resolve(match);
    }, 40000);
    return;
  }

  const vip = !!(match.A.vip || match.B.vip);   // the better bench if either side pays
  const verdict = await AJJudge.judge({
    scene: match.scene, nameA, argA: match.argA, nameB, argB: match.argB,
    vip, apiKey: GEMINI_KEY, matchId: match.id
  });

  const out = { t: 'verdict', verdict, nameA, nameB, scene: match.scene,
                argA: match.argA, argB: match.argB };
  for (const side of ['A', 'B']) {
    if (match[side].conn.open) match[side].conn.send(out);
  }
  endMatch(match);
}

/* ---------------- connection handling ---------------- */

function attach(conn) {
  let player = null;

  conn.onMessage = (m) => {
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello') {
      const id = String(m.id || '').slice(0, 40) || ('anon_' + Math.random().toString(36).slice(2, 9));
      if (players.has(id)) players.get(id).conn.close();
      player = {
        id, conn,
        name: String(m.name || 'Someone').slice(0, 24),
        rank: String(m.rank || 'Litigant').slice(0, 24),
        /* VIP is whatever the server recorded, never what the client claims */
        vip: !!state.vip[id],
        matchId: null, side: null
      };
      players.set(id, player);
      conn.send({ t: 'welcome', you: { id, name: player.name, vip: player.vip }, online: players.size });
      announceOnline();
      return;
    }
    if (!player) return;

    if (m.t === 'queue') {
      if (player.matchId || queue.includes(player.id)) return;
      queue.push(player.id);
      pushQueue();
      tryMatch();
      return;
    }

    if (m.t === 'leave') {
      removeFromQueue(player.id);
      pushQueue();
      return;
    }

    if (m.t === 'submit') {
      const match = matches.get(player.matchId);
      if (!match || match.done) return;
      const text = String(m.text == null ? '' : m.text).slice(0, 600);
      if (player.side === 'A' && match.argA === null) match.argA = text;
      if (player.side === 'B' && match.argB === null) match.argB = text;
      const foe = match[player.side === 'A' ? 'B' : 'A'];
      if (foe.conn.open) foe.conn.send({ t: 'opponentSubmitted' });
      conn.send({ t: 'submitted' });
      if (match.argA !== null && match.argB !== null) resolve(match);
      return;
    }

    if (m.t === 'morph') {
      const match = matches.get(player.matchId);
      if (!match || match.done || match.morphBy) return;
      if (!player.vip) { conn.send({ t: 'error', msg: 'Drum morphs are a VIP privilege.' }); return; }
      const day = new Date().toISOString().slice(0, 10);
      const rec = state.vip[player.id];
      if (!rec) return;
      if (rec.morphDay !== day) { rec.morphDay = day; rec.morphsUsed = 0; }
      if (rec.morphsUsed >= 10) {
        conn.send({ t: 'error', msg: 'No drum morphs left today.' });
        return;
      }
      rec.morphsUsed++;
      saveState();
      match.morphBy = player.side;
      conn.send({ t: 'morphed', by: 'you', left: 10 - rec.morphsUsed });
      return;
    }

    if (m.t === 'morphVerdict') {
      const match = matches.get(player.matchId);
      if (!match || !match.morphBy || match.morphBy !== player.side) return;
      clearTimeout(match.morphTimer);
      const winner = m.winner === 'B' ? 'B' : 'A';
      const verdict = {
        winner, scoreA: winner === 'A' ? 100 : 0, scoreB: winner === 'B' ? 100 : 0,
        ruling: String(m.ruling || 'The drum has spoken.').slice(0, 400),
        noteA: '', noteB: '', model: 'drum-morph', source: 'morph'
      };
      const out = {
        t: 'verdict', verdict, nameA: match.A.name, nameB: match.B.name,
        scene: match.scene, argA: match.argA, argB: match.argB
      };
      for (const side of ['A', 'B']) if (match[side].conn.open) match[side].conn.send(out);
      endMatch(match);
    }
  };

  conn.onClose = () => {
    if (!player) return;
    removeFromQueue(player.id);
    const match = matches.get(player.matchId);
    if (match && !match.done) {
      const foe = match[player.side === 'A' ? 'B' : 'A'];
      if (foe && foe.conn.open) foe.conn.send({ t: 'opponentLeft' });
      match.done = true;
      endMatch(match);
    }
    if (players.get(player.id) === player) players.delete(player.id);
    pushQueue();
    announceOnline();
  };
}

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json'
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', c => {
      size += c.length;
      if (size > (limit || 32768)) { reject(new Error('body too large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true, online: players.size, queued: queue.length,
      matches: matches.size, bench: GEMINI_KEY ? 'gemini' : 'local', models: MODELS
    });
  }

  /* A client asks the bench directly only when it has no match on this server;
     during a real match the server judges and pushes the verdict itself. */
  if (url.pathname === '/api/judge' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: 'bad request' }); }
    const verdict = await AJJudge.judge({
      scene: body.scene, nameA: body.nameA, argA: body.argA,
      nameB: body.nameB, argB: body.argB,
      vip: !!body.vip, apiKey: GEMINI_KEY
    });
    return json(res, 200, { verdict, model: verdict.model });
  }

  if (url.pathname === '/api/vip/redeem' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch (e) { return json(res, 400, { error: 'bad request' }); }
    const code = String(body.code || '').trim();
    const playerId = String(body.playerId || '').slice(0, 40);
    if (!playerId) return json(res, 400, { error: 'no player' });
    if (!VIP_CODES.size) {
      return json(res, 503, { error: 'This server has no VIP codes configured.' });
    }
    if (!VIP_CODES.has(code)) return json(res, 403, { error: 'That code is not valid.' });
    if (state.redeemed[code] && state.redeemed[code] !== playerId) {
      return json(res, 409, { error: 'That code has already been used.' });
    }
    state.redeemed[code] = playerId;
    state.vip[playerId] = state.vip[playerId] ||
      { since: new Date().toISOString(), morphDay: '', morphsUsed: 0 };
    saveState();
    const live = players.get(playerId);
    if (live) live.vip = true;
    return json(res, 200, { vip: true, since: state.vip[playerId].since });
  }

  /* static: the game itself, so `node server/server.js` is enough to host it */
  let rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(WEB_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(WEB_DIR)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n');
  socket.setNoDelay(true);
  const conn = new Conn(socket);
  if (head && head.length) conn._feed(head);
  attach(conn);
});

server.listen(PORT, () => {
  console.log('AI Judge — the hall is open on http://localhost:' + PORT);
  console.log('  bench       : ' + (GEMINI_KEY
    ? 'Gemini (' + MODELS.free + ' / ' + MODELS.vip + ' for VIP)'
    : 'local rule-based — set GEMINI_API_KEY for the real thing'));
  console.log('  VIP codes   : ' + (VIP_CODES.size ? VIP_CODES.size + ' configured' : 'none (set AIJUDGE_VIP_CODES)'));
  console.log('  websocket   : ws://localhost:' + PORT);
});

module.exports = { server, encodeFrame, acceptKey };
