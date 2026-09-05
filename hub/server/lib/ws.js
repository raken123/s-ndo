'use strict';
// Minimal RFC 6455 WebSocket implementation (server + client), no dependencies.
// Text and binary frames, fragmentation, ping/pong, close handshake.
const crypto = require('crypto');
const http = require('http');
const EventEmitter = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 4 * 1024 * 1024;

class WebSocket extends EventEmitter {
  constructor(socket, { isClient = false } = {}) {
    super();
    this.socket = socket;
    this.isClient = isClient;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.fragments = null;
    this.fragOp = 0;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._close());
    socket.on('error', () => this._close());
    socket.on('end', () => this._close());
  }

  get readyState() { return this.closed ? 3 : 1; }

  _onData(d) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, d]) : d;
    try { this._parse(); } catch (e) { this.close(1002); }
  }

  _parse() {
    for (;;) {
      const b = this.buffer;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        const big = b.readBigUInt64BE(2);
        if (big > BigInt(MAX_PAYLOAD)) { this.close(1009); return; }
        len = Number(big); off = 10;
      }
      if (len > MAX_PAYLOAD) { this.close(1009); return; }
      let maskKey = null;
      if (masked) {
        if (b.length < off + 4) return;
        maskKey = b.subarray(off, off + 4); off += 4;
      }
      if (b.length < off + len) return;
      let payload = b.subarray(off, off + len);
      if (masked) {
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i & 3];
        payload = out;
      } else {
        payload = Buffer.from(payload);
      }
      this.buffer = b.subarray(off + len);
      this._frame(fin, op, payload);
      if (this.closed) return;
    }
  }

  _frame(fin, op, payload) {
    if (op === 0x8) {
      this._sendRaw(0x8, payload.subarray(0, 2)); this._close(); this.socket.end();
      const s = this.socket; setTimeout(() => { if (!s.destroyed) s.destroy(); }, 200).unref();
      return;
    }
    if (op === 0x9) { this._sendRaw(0xA, payload); return; }
    if (op === 0xA) { this.emit('pong'); return; }
    if (op === 0x0) {
      if (!this.fragments) { this.close(1002); return; }
      this.fragments.push(payload);
      if (!fin) return;
      payload = Buffer.concat(this.fragments);
      op = this.fragOp;
      this.fragments = null;
    } else if (!fin) {
      this.fragOp = op;
      this.fragments = [payload];
      return;
    }
    if (op === 0x1) this.emit('message', payload.toString('utf8'));
    else if (op === 0x2) this.emit('message', payload);
    else this.close(1002);
  }

  _sendRaw(op, payload) {
    if (this.closed || this.socket.destroyed) return false;
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | op;
    if (this.isClient) {
      head[1] |= 0x80;
      const key = crypto.randomBytes(4);
      const masked = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ key[i & 3];
      this.socket.write(Buffer.concat([head, key, masked]));
    } else {
      this.socket.write(Buffer.concat([head, payload]));
    }
    return true;
  }

  send(data) {
    if (typeof data === 'string') return this._sendRaw(0x1, Buffer.from(data, 'utf8'));
    return this._sendRaw(0x2, Buffer.isBuffer(data) ? data : Buffer.from(data));
  }

  ping() { this._sendRaw(0x9, Buffer.alloc(0)); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const r = Buffer.from(reason, 'utf8');
    const b = Buffer.alloc(2 + r.length);
    b.writeUInt16BE(code, 0); r.copy(b, 2);
    this._sendRaw(0x8, b);
    this._close();
    const s = this.socket;
    setTimeout(() => { if (!s.destroyed) s.destroy(); }, 500).unref();
    s.end();
  }

  _close() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/** Attach a WebSocket upgrade handler to an http.Server. */
function attach(server, onConnection, { path = null, maxConnections = 2000 } = {}) {
  let count = 0;
  server.on('upgrade', (req, socket, head) => {
    const upgrade = String(req.headers.upgrade || '').toLowerCase();
    const key = req.headers['sec-websocket-key'];
    if (upgrade !== 'websocket' || !key || (path && req.url.split('?')[0] !== path)) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (count >= maxConnections) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n');
    const ws = new WebSocket(socket);
    count++;
    ws.once('close', () => { count--; });
    ws.remoteAddress = req.socket.remoteAddress;
    onConnection(ws, req);
    if (head && head.length) ws._onData(head);
  });
}

/** Client connection. Resolves with a WebSocket once the handshake completes. */
function connect(url, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'ws:') return reject(new Error('only ws:// is supported by this client'));
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: 'GET',
      headers: Object.assign({
        Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13', Host: u.host,
      }, headers),
    });
    req.on('upgrade', (res, socket, head) => {
      if (res.headers['sec-websocket-accept'] !== acceptKey(key)) {
        socket.destroy(); return reject(new Error('bad accept key'));
      }
      const ws = new WebSocket(socket, { isClient: true });
      // Frames that arrived with the handshake are parsed on the next macrotask,
      // after the caller has had a chance to attach listeners.
      if (head && head.length) { ws.buffer = Buffer.from(head); setImmediate(() => { try { ws._parse(); } catch (e) { ws.close(1002); } }); }
      resolve(ws);
    });
    req.on('response', (res) => reject(new Error('unexpected HTTP ' + res.statusCode)));
    req.on('error', reject);
    req.end();
  });
}

module.exports = { WebSocket, attach, connect };
