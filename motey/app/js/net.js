/* Motey – real meetings and messages between devices, with no Motey server.
 *
 * A "room" is a chat or a meeting. It has a random id and a random 256-bit
 * key; both travel only inside the invite code. Messages are encrypted with
 * the key and stored on public Nostr relays (NIP-01), which act as a mailbox,
 * so people get what was said while they were offline. Calls are WebRTC
 * directly between devices; the relays only pass the encrypted handshake.
 * Each room gets its own signing key derived from this device's secret, so
 * relays cannot link the rooms you are in. */
(function () {
  'use strict';
  const N = window.Nostr;
  const KIND_STORED = 4333, KIND_SIGNAL = 24333;
  const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://nostr.mom', 'wss://relay.primal.net'];
  const INVITE_BASE = 'https://raken123.github.io/s-ndo/motey/dist/motey.html';
  const MAX_FILE = 750 * 1024, CHUNK = 16 * 1024;
  const COLORS = ['#6C4CF5', '#FF7A59', '#19C79A', '#FF5C8A', '#2F80ED', '#F2A007', '#9B51E0'];

  let pool = null, started = false;
  const listeners = { message: new Set(), signal: new Set(), status: new Set(), rooms: new Set() };
  const emit = (k, ...a) => listeners[k].forEach(f => { try { f(...a); } catch (e) { console.error(e); } });
  const on = (k, f) => { listeners[k].add(f); return () => listeners[k].delete(f); };

  /* ---------------- identity ---------------- */
  function secret() {
    let s = null;
    try { s = localStorage.getItem('motey.sk'); } catch (e) { /* blocked */ }
    if (!s) { s = N.hex(N.newSecret()); try { localStorage.setItem('motey.sk', s); } catch (e) { /* blocked */ } }
    return s;
  }
  const roomKeys = new Map();
  async function roomSigner(room) {
    if (!roomKeys.has(room.id)) {
      // per-room key: sha256(device secret || room id), reduced into range by retrying
      let k = await N.sha256(secret() + ':' + room.id);
      while (k.every(b => b === 0)) k = await N.sha256(k);
      roomKeys.set(room.id, { sk: k, pk: N.hex(N.publicKey(k)) });
    }
    return roomKeys.get(room.id);
  }
  const me = () => ({ name: Store.settings.name || 'Jag', color: Store.settings.color || COLORS[0] });

  /* ---------------- rooms ---------------- */
  const rooms = () => Store.state.rooms || (Store.state.rooms = []);
  const room = id => rooms().find(r => r.id === id);
  async function tagFor(id) { return N.hex(await N.sha256('motey-room/' + id)).slice(0, 32); }

  async function createRoom({ name, kind, meta }) {
    const r = { id: N.hex(N.rand(16)), key: N.b64(N.rand(32)), name: name || 'Chatt', kind: kind || 'chat', created: Date.now(), lastRead: Date.now(), members: {}, synced: 0 };
    r.tag = await tagFor(r.id);
    rooms().push(r); Store.save();
    await resubscribe();
    await hello(r);
    if (meta) await send(r.id, Object.assign({ t: 'meta' }, meta));
    emit('rooms');
    return r;
  }
  function inviteCode(r) { return 'M1' + N.b64url(N.unhex(r.id + '')) + '.' + N.b64url(N.unb64(r.key)); }
  function inviteLink(r) { return INVITE_BASE + '#join=' + inviteCode(r); }
  function parseInvite(text) {
    const m = String(text || '').match(/M1([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/);
    if (!m) return null;
    return { id: N.hex(N.unb64url(m[1])), key: N.b64(N.unb64url(m[2])) };
  }
  async function join(text, name) {
    const inv = parseInvite(text);
    if (!inv) throw new Error('Det där ser inte ut som en Motey-inbjudan.');
    let r = room(inv.id);
    if (!r) {
      r = { id: inv.id, key: inv.key, name: name || 'Ny chatt', kind: 'chat', created: Date.now(), lastRead: 0, members: {}, synced: 0, joinedViaInvite: true };
      r.tag = await tagFor(r.id);
      rooms().push(r); Store.save();
      await resubscribe();
      await hello(r);
      emit('rooms');
    }
    return r;
  }
  function leave(id) {
    Store.state.rooms = rooms().filter(r => r.id !== id);
    try { localStorage.removeItem('motey.msgs.' + id); } catch (e) { /* blocked */ }
    Store.state.meetings = Store.state.meetings.filter(m => m.room !== id);
    Store.save(); resubscribe(); emit('rooms');
  }
  const hello = r => send(r.id, { t: 'hello', name: me().name, color: me().color });

  /* ---------------- local message log ---------------- */
  const logs = new Map();
  function messages(id) {
    if (!logs.has(id)) {
      let a = [];
      try { a = JSON.parse(localStorage.getItem('motey.msgs.' + id) || '[]'); } catch (e) { /* corrupt or blocked */ }
      logs.set(id, a);
    }
    return logs.get(id);
  }
  let saveTimer = 0;
  const dirty = new Set();
  function persist(id) {
    dirty.add(id);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      for (const d of dirty) {
        const a = messages(d);
        if (a.length > 2000) a.splice(0, a.length - 2000);
        try { localStorage.setItem('motey.msgs.' + d, JSON.stringify(a)); } catch (e) { console.warn('kunde inte spara meddelanden', e); }
      }
      dirty.clear();
      Store.save();
    }, 300);
  }
  function insert(r, msg) {
    const a = messages(r.id);
    if (a.some(x => x.id === msg.id)) return false;
    let i = a.length;
    while (i > 0 && a[i - 1].at > msg.at) i--;
    a.splice(i, 0, msg);
    persist(r.id);
    return true;
  }

  /* ---------------- sending ---------------- */
  async function send(roomId, payload) {
    const r = room(roomId);
    if (!r) throw new Error('okänt rum');
    const s = await roomSigner(r);
    payload = Object.assign({ v: 1, pk: s.pk, name: me().name }, payload);
    const ev = await N.signEvent({ kind: KIND_STORED, tags: [['y', r.tag]], content: await N.seal(r.key, payload) }, s.sk);
    const msg = toMsg(ev, payload, true);
    if (payload.t !== 'chunk') { handle(r, msg, true); }
    if (pool) pool.publish(ev, true);
    return msg;
  }
  async function signal(roomId, payload) {
    const r = room(roomId);
    if (!r || !pool) return;
    const s = await roomSigner(r);
    payload = Object.assign({ v: 1, pk: s.pk, name: me().name }, payload);
    const ev = await N.signEvent({ kind: KIND_SIGNAL, tags: [['y', r.tag]], content: await N.seal(r.key, payload) }, s.sk);
    pool.publish(ev, false);
  }
  const sendText = (roomId, text) => send(roomId, { t: 'msg', text: String(text).slice(0, 4000) });
  const sendTranscript = (roomId, text) => send(roomId, { t: 'tr', text: String(text).slice(0, 2000) });

  async function sendFile(roomId, blob, name) {
    if (blob.size > MAX_FILE) throw new Error(`Filen är för stor (max ${Math.round(MAX_FILE / 1024)} kB).`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fid = N.hex(N.rand(8));
    const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
    await Files.putMeta(fid, { name, mime: blob.type || 'application/octet-stream', size: bytes.length, n });
    for (let i = 0; i < n; i++) {
      const d = N.b64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK));
      await Files.putChunk(fid, i, d);
      await send(roomId, { t: 'chunk', fid, i, n, d });
      await new Promise(res => setTimeout(res, 120)); // be gentle with public relays
    }
    return send(roomId, { t: 'file', fid, fname: name, mime: blob.type || 'application/octet-stream', size: bytes.length, n });
  }

  /* ---------------- receiving ---------------- */
  function toMsg(ev, p, mine) {
    return { id: ev.id, pk: p.pk, name: p.name, at: (p.at || ev.created_at * 1000), t: p.t, text: p.text, fid: p.fid, fname: p.fname, mime: p.mime, size: p.size, n: p.n, meta: p.t === 'meta' ? p : undefined, code: p.code, color: p.color, mine: !!mine };
  }
  async function onStored(ev) {
    const r = rooms().find(x => ev.tags && ev.tags.some(t => t[0] === 'y' && t[1] === x.tag));
    if (!r) return;
    let p;
    try { p = await N.open(r.key, ev.content); } catch (e) { return; } // not for us / tampered
    if (!p || p.pk !== ev.pubkey) return;
    r.synced = Math.max(r.synced || 0, ev.created_at);
    if (p.t === 'chunk') { await Files.putChunk(p.fid, p.i, p.d); Files.progress(p.fid); return; }
    const mine = p.pk === (await roomSigner(r)).pk;
    handle(r, toMsg(ev, p, mine), mine);
  }
  function handle(r, msg, mine) {
    const fresh = insert(r, msg);
    if (msg.pk) {
      const m = r.members[msg.pk] || (r.members[msg.pk] = {});
      m.name = msg.name || m.name; if (msg.color) m.color = msg.color;
      m.seen = Math.max(m.seen || 0, msg.at);
      if (mine) m.me = true;
    }
    if (msg.t === 'meta') applyMeta(r, msg);
    if (msg.t === 'next' && msg.code) join(msg.code).catch(() => {});
    if (msg.t === 'file' && fresh) Files.putMeta(msg.fid, { name: msg.fname, mime: msg.mime, size: msg.size, n: msg.n });
    if (!fresh) return;
    if (!mine && (msg.t === 'msg' || msg.t === 'file') && msg.at > (r.lastRead || 0)) {
      r.unread = (r.unread || 0) + 1;
      if (document.hidden || location.hash !== '#/chat/' + r.id) Platform.notify(`${msg.name} i ${r.name}`, msg.t === 'file' ? '📎 ' + msg.fname : msg.text);
    }
    if (r.kind === 'meeting') syncMeeting(r);
    emit('message', r, msg);
  }

  /* ---------------- meetings on top of rooms ---------------- */
  function applyMeta(r, msg) {
    const prev = r.meta;
    if (prev && prev.at > msg.at) return;
    r.meta = Object.assign({}, msg.meta, { at: msg.at, hostPk: prev ? prev.hostPk : msg.pk, hostName: prev ? prev.hostName : msg.name });
    r.kind = 'meeting';
    r.name = r.meta.title || r.name;
    syncMeeting(r);
    emit('rooms');
  }
  // Keep a Store meeting in step with its room, so every Motey mode (summary,
  // catch-up, Live AI, TikTok, game) works on real meetings too.
  function syncMeeting(r) {
    if (!r.meta) return;
    const id = 'r-' + r.id;
    let m = Store.meeting(id);
    if (!m) { m = { id, room: r.id, attended: null, files: [] }; Store.state.meetings.push(m); }
    const mt = r.meta;
    Object.assign(m, { title: mt.title, start: mt.start, durationMin: mt.durationMin || 45, series: mt.series || r.id, repeat: mt.repeat || '', boss: mt.hostName });
    const msgs = messages(r.id);
    const names = new Set(Object.values(r.members).map(x => x.name).filter(Boolean));
    m.attendees = [...names];
    m.transcript = msgs.filter(x => (x.t === 'msg' || x.t === 'tr') && x.text).map(x => ({ who: x.name || 'Någon', text: x.text, at: x.at, kind: x.t }));
    const shared = msgs.filter(x => x.t === 'file');
    const wanted = (mt.files || []).map(String);
    for (const name of wanted) {
      let f = m.files.find(x => x.name === name);
      if (!f) { f = { name, status: 'missing', owner: '' }; m.files.push(f); }
      const got = shared.filter(x => x.fname === name).pop();
      if (got) Object.assign(f, { status: 'sent', fid: got.fid, from: got.name, mime: got.mime });
    }
    for (const s of shared) if (!m.files.some(f => f.fid === s.fid || (f.name === s.fname && f.status !== 'missing' && !f.fid))) {
      if (!wanted.includes(s.fname)) m.files.push({ name: s.fname, status: 'sent', fid: s.fid, from: s.name, mime: s.mime, extra: true });
    }
    if (msgs.some(x => x.t === 'call' && x.mine)) m.attended = true;
    Store.save();
  }
  // A real meeting is "missed" when it is over and this device never joined the call.
  function updateAttendance() {
    for (const m of Store.state.meetings) {
      if (!m.room || m.attended === true) continue;
      if (Store.isPast(m)) m.attended = false;
    }
    autoNext();
    Store.save();
  }
  // Weekly meetings: the host's device books the next one and invites the room to it.
  async function autoNext() {
    for (const r of rooms()) {
      if (!r.meta || r.meta.repeat !== 'weekly' || r.nextBooked) continue;
      const s = await roomSigner(r);
      if (r.meta.hostPk !== s.pk) continue;
      const m = Store.meeting('r-' + r.id);
      if (!m || new Date(m.start).getTime() > Date.now()) continue;
      if (messages(r.id).some(x => x.t === 'next')) { r.nextBooked = true; continue; }
      r.nextBooked = true;
      await bookNext(r.id);
    }
  }
  async function bookNext(roomId) {
    const r = room(roomId);
    const mt = r.meta;
    let start = new Date(mt.start).getTime();
    do start += 7 * 864e5; while (start < Date.now() - 36e5);
    const nr = await createRoom({ name: mt.title, kind: 'meeting', meta: { title: mt.title, start: new Date(start).toISOString(), durationMin: mt.durationMin, series: mt.series, repeat: mt.repeat, files: mt.files } });
    await send(roomId, { t: 'next', code: inviteCode(nr), text: `Nästa möte: ${new Date(start).toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` });
    return nr;
  }

  /* ---------------- relay connection ---------------- */
  async function resubscribe() {
    if (!pool) return;
    const rs = rooms();
    pool.unsub('motey-msgs'); pool.unsub('motey-sig');
    if (!rs.length) return;
    const tags = rs.map(r => r.tag);
    const since = rs.every(r => r.synced) ? Math.min(...rs.map(r => r.synced)) - 600 : undefined;
    const f = { kinds: [KIND_STORED], '#y': tags, limit: 2000 };
    if (since) f.since = since;
    pool.sub('motey-msgs', [f], ev => onStored(ev).catch(e => console.warn(e)), () => { Store.save(); emit('status', status()); });
    pool.sub('motey-sig', [{ kinds: [KIND_SIGNAL], '#y': tags, since: Math.floor(Date.now() / 1000) - 30 }], ev => onSignal(ev).catch(e => console.warn(e)));
  }
  async function onSignal(ev) {
    const r = rooms().find(x => ev.tags && ev.tags.some(t => t[0] === 'y' && t[1] === x.tag));
    if (!r) return;
    let p; try { p = await N.open(r.key, ev.content); } catch (e) { return; }
    if (!p || p.pk !== ev.pubkey) return;
    const mine = (await roomSigner(r)).pk;
    if (p.pk === mine || (p.to && p.to !== mine)) return;
    if (p.name) { const m = r.members[p.pk] || (r.members[p.pk] = {}); m.name = p.name; m.live = Date.now(); }
    emit('signal', r, p);
  }
  function relays() {
    const list = (Store.settings.relays || '').split(/\s+/).filter(Boolean);
    return list.length ? list : DEFAULT_RELAYS;
  }
  function start() {
    if (started) return;
    started = true;
    pool = new N.Pool(relays());
    pool.listeners.add(() => emit('status', status()));
    resubscribe();
    for (const r of rooms()) if (r.kind === 'meeting') syncMeeting(r);
    updateAttendance();
    setInterval(updateAttendance, 60000);
  }
  function restart() { if (pool) pool.setRelays(relays()); resubscribe(); }
  function status() { return { online: pool ? pool.online() : 0, total: pool ? pool.relays.length : 0, relays: pool ? pool.state() : [] }; }

  /* ---------------- files (IndexedDB) ---------------- */
  const Files = (() => {
    let dbp = null;
    const db = () => dbp || (dbp = new Promise((res, rej) => {
      const q = indexedDB.open('motey-files', 1);
      q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('chunks'); };
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    }));
    const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    const waiting = new Map();
    return {
      putMeta: (fid, meta) => tx('meta', 'readwrite', s => s.put(meta, fid)).catch(() => {}),
      putChunk: (fid, i, d) => tx('chunks', 'readwrite', s => s.put(d, fid + ':' + i)).catch(() => {}),
      async get(fid) {
        const meta = await tx('meta', 'readonly', s => s.get(fid)).catch(() => null);
        if (!meta) return null;
        const parts = [];
        for (let i = 0; i < meta.n; i++) {
          const d = await tx('chunks', 'readonly', s => s.get(fid + ':' + i)).catch(() => null);
          if (!d) return { meta, missing: true, have: i };
          parts.push(N.unb64(d));
        }
        return { meta, blob: new Blob(parts, { type: meta.mime }) };
      },
      progress(fid) { const f = waiting.get(fid); if (f) f(); },
      wait(fid, cb) { waiting.set(fid, cb); }
    };
  })();

  window.MoteyNet = {
    start, restart, status, on, rooms, room, createRoom, join, leave, inviteCode, inviteLink, parseInvite,
    send, sendText, sendTranscript, sendFile, signal, messages, roomSigner, me, bookNext, syncMeeting, updateAttendance,
    files: Files, COLORS, DEFAULT_RELAYS, MAX_FILE,
    get started() { return started; }
  };
})();
