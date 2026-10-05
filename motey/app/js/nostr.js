/* Motey – Nostr transport, written from the specs (NIP-01, BIP-340).
 * Motey uses public Nostr relays as a mailbox: every message is AES-GCM
 * encrypted with the room key before it leaves the device, so relays only
 * see random-looking bytes, a room tag and a throwaway public key. */
(function () {
  'use strict';
  const enc = new TextEncoder();

  /* ---------------- bytes ---------------- */
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const concat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64url = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = s => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  const sha256 = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));

  /* ---------------- secp256k1 + BIP-340 signing ---------------- */
  const P = 2n ** 256n - 0x1000003D1n;
  const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const G = [0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
             0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n, 1n];
  const mod = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m; };
  function inv(a, m = P) {
    let [x0, x1, r0, r1] = [0n, 1n, m, mod(a, m)];
    while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [x0, x1] = [x1, x0 - q * x1]; }
    return mod(x0, m);
  }
  // Jacobian coordinates [X, Y, Z]; Z = 0 is the point at infinity.
  function dbl([X, Y, Z]) {
    if (!Y || !Z) return [0n, 1n, 0n];
    const S = mod(4n * X * Y * Y), M = mod(3n * X * X);
    const X3 = mod(M * M - 2n * S);
    return [X3, mod(M * (S - X3) - 8n * Y ** 4n), mod(2n * Y * Z)];
  }
  function add(p, q) {
    if (!p[2]) return q; if (!q[2]) return p;
    const [X1, Y1, Z1] = p, [X2, Y2, Z2] = q;
    const Z1Z1 = mod(Z1 * Z1), Z2Z2 = mod(Z2 * Z2);
    const U1 = mod(X1 * Z2Z2), U2 = mod(X2 * Z1Z1), S1 = mod(Y1 * Z2 * Z2Z2), S2 = mod(Y2 * Z1 * Z1Z1);
    if (U1 === U2) return S1 === S2 ? dbl(p) : [0n, 1n, 0n];
    const H = mod(U2 - U1), R = mod(S2 - S1), H2 = mod(H * H), H3 = mod(H * H2), U1H2 = mod(U1 * H2);
    const X3 = mod(R * R - H3 - 2n * U1H2);
    return [X3, mod(R * (U1H2 - X3) - S1 * H3), mod(H * Z1 * Z2)];
  }
  function mul(k, p = G) {
    let r = [0n, 1n, 0n];
    for (let i = BigInt(k.toString(2).length) - 1n; i >= 0n; i--) { r = dbl(r); if ((k >> i) & 1n) r = add(r, p); }
    return r;
  }
  function affine([X, Y, Z]) { const zi = inv(Z), zi2 = mod(zi * zi); return [mod(X * zi2), mod(Y * zi2 * zi)]; }
  const big = b => BigInt('0x' + (hex(b) || '0'));
  const bytes32 = n => unhex(n.toString(16).padStart(64, '0'));
  async function tagged(tag, ...msgs) { const t = await sha256(tag); return sha256(concat(t, t, ...msgs)); }

  function newSecret() {
    for (;;) { const k = big(rand(32)); if (k > 0n && k < N) return bytes32(k); }
  }
  function publicKey(sk) { return bytes32(affine(mul(big(sk)))[0]); }

  async function schnorrSign(msg, sk, aux) {
    const d0 = big(sk);
    const [px, py] = affine(mul(d0));
    const d = py % 2n === 0n ? d0 : N - d0;
    const t = new Uint8Array(32);
    const ah = await tagged('BIP0340/aux', aux || rand(32));
    const db = bytes32(d);
    for (let i = 0; i < 32; i++) t[i] = db[i] ^ ah[i];
    const k0 = mod(big(await tagged('BIP0340/nonce', t, bytes32(px), msg)), N);
    if (!k0) throw new Error('bad nonce');
    const [rx, ry] = affine(mul(k0));
    const k = ry % 2n === 0n ? k0 : N - k0;
    const e = mod(big(await tagged('BIP0340/challenge', bytes32(rx), bytes32(px), msg)), N);
    return concat(bytes32(rx), bytes32(mod(k + e * d, N)));
  }
  // Verification (used by the self-test; relay events are authenticated by AES-GCM instead).
  async function schnorrVerify(sig, msg, pub) {
    const x = big(pub);
    if (x >= P) return false;
    const c = mod(x ** 3n + 7n);
    let y = c;
    { let r = 1n, b = c, e = (P + 1n) / 4n; while (e) { if (e & 1n) r = mod(r * b); b = mod(b * b); e >>= 1n; } y = r; }
    if (mod(y * y) !== c) return false;
    if (y % 2n) y = P - y;
    const r = big(sig.slice(0, 32)), s = big(sig.slice(32));
    if (r >= P || s >= N) return false;
    const e = mod(big(await tagged('BIP0340/challenge', sig.slice(0, 32), pub, msg)), N);
    const R = add(mul(s), mul(N - e, [x, y, 1n]));
    if (!R[2]) return false;
    const [Rx, Ry] = affine(R);
    return Ry % 2n === 0n && Rx === r;
  }

  /* ---------------- NIP-01 events ---------------- */
  async function signEvent(ev, sk) {
    const pubkey = hex(publicKey(sk));
    const e = { pubkey, created_at: ev.created_at || Math.floor(Date.now() / 1000), kind: ev.kind, tags: ev.tags || [], content: ev.content || '' };
    const id = await sha256(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]));
    e.id = hex(id);
    e.sig = hex(await schnorrSign(id, sk));
    return e;
  }

  /* ---------------- AES-GCM ---------------- */
  const keyCache = new Map();
  async function aesKey(raw) {
    const k = typeof raw === 'string' ? raw : b64(raw);
    if (!keyCache.has(k)) keyCache.set(k, crypto.subtle.importKey('raw', typeof raw === 'string' ? unb64(raw) : raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
    return keyCache.get(k);
  }
  async function seal(keyB64, obj) {
    const iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(JSON.stringify(obj))));
    return b64(concat(iv, ct));
  }
  async function open(keyB64, content) {
    const raw = unb64(content);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await aesKey(keyB64), raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------------- relay pool ---------------- */
  class Relay {
    constructor(url, pool) { this.url = url; this.pool = pool; this.ws = null; this.status = 'off'; this.wait = 1000; this.closed = false; this.connect(); }
    connect() {
      if (this.closed) return;
      this.status = 'connecting';
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return this.retry(); }
      this.ws = ws;
      ws.onopen = () => {
        this.status = 'open'; this.wait = 1000;
        for (const [id, s] of this.pool.subs) this.send(['REQ', id, ...s.filters]);
        for (const ev of this.pool.outbox.values()) this.send(['EVENT', ev]);
        this.pool.changed();
      };
      ws.onmessage = m => {
        let d; try { d = JSON.parse(m.data); } catch (e) { return; }
        if (d[0] === 'EVENT') this.pool.onEvent(d[1], d[2], this);
        else if (d[0] === 'EOSE') this.pool.onEose(d[1], this);
        else if (d[0] === 'OK') this.pool.onOk(d[1], d[2], d[3], this);
      };
      ws.onclose = () => { this.status = 'off'; this.pool.changed(); this.retry(); };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* closing */ } };
    }
    retry() { if (this.closed) return; setTimeout(() => this.connect(), this.wait); this.wait = Math.min(this.wait * 2, 30000); }
    send(msg) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(msg)); return true; } return false; }
    close() { this.closed = true; try { this.ws && this.ws.close(); } catch (e) { /* closed */ } }
  }

  class Pool {
    constructor(urls) { this.subs = new Map(); this.outbox = new Map(); this.seen = new Set(); this.listeners = new Set(); this.relays = []; this.setRelays(urls); }
    setRelays(urls) {
      this.relays.forEach(r => r.close());
      this.relays = [...new Set(urls)].filter(u => /^wss?:\/\//.test(u)).map(u => new Relay(u, this));
    }
    changed() { this.listeners.forEach(f => f(this.state())); }
    state() { return this.relays.map(r => ({ url: r.url, status: r.status })); }
    online() { return this.relays.filter(r => r.status === 'open').length; }
    sub(id, filters, onEvent, onEose) {
      this.subs.set(id, { filters, onEvent, onEose, eosed: new Set() });
      this.relays.forEach(r => r.send(['REQ', id, ...filters]));
    }
    unsub(id) { this.subs.delete(id); this.relays.forEach(r => r.send(['CLOSE', id])); }
    onEvent(subId, ev, relay) {
      const s = this.subs.get(subId);
      if (!s || !ev || !ev.id) return;
      if (this.seen.has(ev.id)) return;
      this.seen.add(ev.id);
      if (this.seen.size > 20000) this.seen = new Set([...this.seen].slice(-10000));
      s.onEvent(ev, relay.url);
    }
    onEose(subId, relay) { const s = this.subs.get(subId); if (s && !s.eosed.has(relay.url)) { s.eosed.add(relay.url); s.onEose && s.onEose(relay.url); } }
    onOk(id, ok, msg) { const p = this.outbox.get(id); if (p && ok) { this.outbox.delete(id); } if (!ok) console.warn('relay refused', id, msg); }
    publish(ev, keep) {
      // Stored events wait in the outbox until a relay confirms them; ephemeral ones are fire-and-forget.
      if (keep) this.outbox.set(ev.id, ev);
      let sent = 0;
      this.relays.forEach(r => { if (r.send(['EVENT', ev])) sent++; });
      return sent;
    }
  }

  window.Nostr = { Pool, signEvent, seal, open, newSecret, publicKey, schnorrSign, schnorrVerify, sha256, hex, unhex, b64, unb64, b64url, unb64url, rand };
})();
