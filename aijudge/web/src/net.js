/* net.js — online multiplayer against random people.

   The queue is the point: you join the back of a line of strangers and you
   cannot be judged until you have shuffled all the way to the front and are
   standing next to the drum robot. The server owns the line; this client just
   renders whatever position it is told it has.

   When no server is reachable the same interface is served by a local stand-in
   so the game is still playable — clearly flagged as offline in the UI. */
(function (global) {
  'use strict';

  const PROTOCOL = 1;

  function Emitter() { this._h = {}; }
  Emitter.prototype.on = function (ev, fn) {
    (this._h[ev] || (this._h[ev] = [])).push(fn); return this;
  };
  Emitter.prototype.emit = function (ev, arg) {
    const list = this._h[ev];
    if (list) for (let k = 0; k < list.length; k++) {
      try { list[k](arg); } catch (e) { console.error('[net] handler', ev, e); }
    }
  };

  /* ---------------- live server ---------------- */

  function OnlineNet(endpoint, profile) {
    Emitter.call(this);
    this.endpoint = endpoint;
    this.profile = profile;
    this.ws = null;
    this.online = 0;
    this.connected = false;
    this.wantQueue = false;
    this.retries = 0;
    this.closedByUs = false;
    this.mode = 'online';
  }
  OnlineNet.prototype = Object.create(Emitter.prototype);
  OnlineNet.prototype.constructor = OnlineNet;

  OnlineNet.prototype.url = function () {
    let u = this.endpoint.trim();
    if (/^https?:/i.test(u)) u = u.replace(/^http/i, 'ws');
    if (!/^wss?:/i.test(u)) u = (global.location && location.protocol === 'https:' ? 'wss://' : 'ws://') + u;
    return u.replace(/\/$/, '');
  };

  OnlineNet.prototype.connect = function () {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.closedByUs = false;
    let ws;
    try { ws = new WebSocket(this.url()); }
    catch (e) { this.emit('error', 'Bad server address: ' + e.message); this.scheduleRetry(); return; }
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this.retries = 0;
      this.send({ t: 'hello', v: PROTOCOL, name: this.profile.name, id: this.profile.id,
                  vip: !!this.profile.vip, rank: this.profile.rank });
      if (this.wantQueue) this.send({ t: 'queue' });
      this.emit('status', { connected: true, mode: 'online' });
    };

    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'online') { this.online = m.n; this.emit('online', m.n); return; }
      this.emit(m.t, m);
    };

    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      this.emit('status', { connected: false, mode: 'online' });
      if (!this.closedByUs) {
        if (was) this.emit('error', 'Lost the connection to the hall.');
        this.scheduleRetry();
      }
    };

    ws.onerror = () => { /* onclose carries the outcome */ };
  };

  OnlineNet.prototype.scheduleRetry = function () {
    if (this.closedByUs) return;
    const wait = Math.min(15000, 800 * Math.pow(2, this.retries++));
    clearTimeout(this._retry);
    this._retry = setTimeout(() => this.connect(), wait);
    this.emit('retry', { in: wait, attempt: this.retries });
  };

  OnlineNet.prototype.send = function (msg) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  };

  OnlineNet.prototype.joinQueue = function () { this.wantQueue = true; if (!this.send({ t: 'queue' })) this.connect(); };
  OnlineNet.prototype.leaveQueue = function () { this.wantQueue = false; this.send({ t: 'leave' }); };
  OnlineNet.prototype.submit = function (text) { this.send({ t: 'submit', text }); };
  OnlineNet.prototype.morph = function () { this.send({ t: 'morph' }); };
  OnlineNet.prototype.morphVerdict = function (winner, ruling) { this.send({ t: 'morphVerdict', winner, ruling }); };
  OnlineNet.prototype.close = function () {
    this.closedByUs = true;
    clearTimeout(this._retry);
    if (this.ws) try { this.ws.close(); } catch (e) { /* already gone */ }
  };

  /* ---------------- offline stand-in ---------------- */

  /* Reproduces the server's observable behaviour: a line that shortens, a
     match at the front, an opponent who submits, and a verdict. */
  const BOT_NAMES = ['Ida', 'Marcus', 'Priya', 'Tomas', 'Wren', 'Otto', 'Selma', 'Kofi',
    'Nadia', 'Rui', 'Halim', 'Bea', 'Janne', 'Cato', 'Lore', 'Sanne', 'Yusuf', 'Elke'];

  const BOT_LINES = [
    'I have the receipt, I have the date, and I have not raised my voice once.',
    'We agreed on this in front of two people. I am simply asking that it hold.',
    'Look, I did the work every single day for three years. That has to count.',
    'They were kind about it, and I want to be kind back, but I was here first.',
    'It is not about winning. It is about the fact that I asked twice and got nothing.',
    'I would happily split it. I offered to split it. That offer was refused.',
    'Their claim rests entirely on a technicality, and mine rests on eleven years.',
    'I put it in writing on the ninth. Nobody has produced anything from before that.',
    'Ask anyone who was in the room. I said it first and I said it plainly.',
    'I do not need the whole thing. I need the half that was always mine.'
  ];

  function LocalNet(profile) {
    Emitter.call(this);
    this.profile = profile;
    this.connected = true;
    this.mode = 'offline';
    this.online = 0;
    this.timers = [];
    this.match = null;
  }
  LocalNet.prototype = Object.create(Emitter.prototype);
  LocalNet.prototype.constructor = LocalNet;

  LocalNet.prototype._after = function (ms, fn) {
    const id = setTimeout(fn, ms);
    this.timers.push(id);
    return id;
  };
  LocalNet.prototype._clear = function () {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  };

  LocalNet.prototype.connect = function () {
    this.online = 3 + Math.floor(Math.random() * 9);
    this.emit('status', { connected: true, mode: 'offline' });
    this.emit('online', this.online);
  };

  LocalNet.prototype.joinQueue = function () {
    this._clear();
    const depth = 2 + Math.floor(Math.random() * 4);
    const line = [];
    const used = new Set();
    for (let k = 0; k < depth; k++) {
      let n;
      do { n = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]; } while (used.has(n));
      used.add(n);
      line.push({ name: n, rank: 'Litigant', vip: Math.random() < 0.2 });
    }
    this.line = line;
    this.pos = depth;
    this.online = depth + 1 + Math.floor(Math.random() * 6);
    this.emit('online', this.online);
    this._advance();
  };

  LocalNet.prototype._advance = function () {
    this.emit('queue', {
      pos: this.pos,
      total: this.pos + 1,
      line: this.line.slice(0, this.pos).map(p => ({ name: p.name, rank: p.rank, vip: p.vip }))
    });
    if (this.pos === 0) {
      this._after(900, () => this._startMatch());
      return;
    }
    this._after(2600 + Math.random() * 2600, () => { this.pos--; this._advance(); });
  };

  LocalNet.prototype._startMatch = function () {
    const scene = global.AJJudge.pickScene();
    const foe = this.line.length
      ? this.line[this.line.length - 1]
      : { name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], rank: 'Litigant', vip: false };
    const side = Math.random() < 0.5 ? 'A' : 'B';
    this.match = {
      matchId: 'local_' + Date.now().toString(36),
      scene, side,
      opponent: { name: foe.name, rank: foe.rank, vip: foe.vip },
      seconds: 45
    };
    this.mySubmission = null;
    this.foeSubmission = null;
    this.emit('match', this.match);

    /* the stand-in opponent takes a plausible amount of time to write */
    this._after(6000 + Math.random() * 22000, () => {
      if (!this.match) return;
      this.foeSubmission = BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)];
      this.emit('opponentSubmitted', {});
      this._maybeJudge();
    });
  };

  LocalNet.prototype.submit = function (text) {
    if (!this.match) return;
    this.mySubmission = text;
    this.emit('submitted', {});
    this._maybeJudge();
  };

  LocalNet.prototype._maybeJudge = function () {
    if (!this.match) return;
    if (this.mySubmission === null || this.foeSubmission === null) return;
    const m = this.match;
    const mine = this.mySubmission, theirs = this.foeSubmission;
    const nameA = m.side === 'A' ? this.profile.name : m.opponent.name;
    const nameB = m.side === 'A' ? m.opponent.name : this.profile.name;
    const argA = m.side === 'A' ? mine : theirs;
    const argB = m.side === 'A' ? theirs : mine;

    /* A morphed player rules in place of the AI. */
    if (this.pendingMorph) {
      this.pendingMorph = false;
      this.emit('awaitMorphVerdict', { scene: m.scene, nameA, argA, nameB, argB });
      return;
    }

    this._after(1400, () => {
      global.AJJudge.judge({
        scene: m.scene, nameA, argA, nameB, argB,
        vip: !!this.profile.vip,
        endpoint: this.profile.server || '',
        apiKey: this.profile.apiKey || '',
        matchId: m.matchId
      }).then(v => {
        this.emit('verdict', { verdict: v, argA, argB, nameA, nameB, scene: m.scene });
        this.match = null;
      });
    });
  };

  LocalNet.prototype.morph = function () { this.pendingMorph = true; this.emit('morphed', { by: 'you' }); };

  LocalNet.prototype.morphVerdict = function (winner, ruling) {
    const m = this.match;
    if (!m) return;
    const nameA = m.side === 'A' ? this.profile.name : m.opponent.name;
    const nameB = m.side === 'A' ? m.opponent.name : this.profile.name;
    const argA = m.side === 'A' ? this.mySubmission : this.foeSubmission;
    const argB = m.side === 'A' ? this.foeSubmission : this.mySubmission;
    this.emit('verdict', {
      verdict: {
        winner, scoreA: winner === 'A' ? 100 : 0, scoreB: winner === 'B' ? 100 : 0,
        ruling: ruling || 'The drum has spoken.',
        noteA: '', noteB: '', model: 'drum-morph', source: 'morph'
      },
      argA, argB, nameA, nameB, scene: m.scene
    });
    this.match = null;
  };

  LocalNet.prototype.leaveQueue = function () { this._clear(); this.match = null; };
  LocalNet.prototype.close = function () { this._clear(); this.match = null; };

  global.AJNet = { OnlineNet, LocalNet, PROTOCOL, BOT_NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
