#!/usr/bin/env python3
"""A small Nostr relay (NIP-01) for Motey, using only the Python standard library.

Motey works with public relays out of the box. Run this if you want your own:

    python3 motey/server/relay.py --port 7777 --db motey-relay.jsonl

Then put ws://<host>:7777 (or wss:// behind a TLS proxy such as Caddy or nginx)
under Mer -> Nätverk -> Reläer in every Motey that should use it.

Events are checked (id and BIP-340 signature) before they are stored.
Ephemeral events (kinds 20000-29999, used for call set-up) are only passed on.
"""
import argparse, asyncio, base64, hashlib, json, os, struct, sys, time

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MSG = 512 * 1024

# ------------------------------------------------------------------ BIP-340
P = 2 ** 256 - 0x1000003D1
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)


def _add(p1, p2):
    if p1 is None: return p2
    if p2 is None: return p1
    if p1[0] == p2[0] and p1[1] != p2[1]: return None
    if p1 == p2: lam = 3 * p1[0] * p1[0] * pow(2 * p1[1], P - 2, P) % P
    else: lam = (p2[1] - p1[1]) * pow(p2[0] - p1[0], P - 2, P) % P
    x = (lam * lam - p1[0] - p2[0]) % P
    return (x, (lam * (p1[0] - x) - p1[1]) % P)


def _mul(p, k):
    r = None
    while k:
        if k & 1: r = _add(r, p)
        p = _add(p, p); k >>= 1
    return r


def _tagged(tag, msg):
    t = hashlib.sha256(tag.encode()).digest()
    return hashlib.sha256(t + t + msg).digest()


def schnorr_verify(msg, pub, sig):
    if len(pub) != 32 or len(sig) != 64: return False
    x = int.from_bytes(pub, 'big')
    if x >= P: return False
    c = (pow(x, 3, P) + 7) % P
    y = pow(c, (P + 1) // 4, P)
    if y * y % P != c: return False
    if y & 1: y = P - y
    r, s = int.from_bytes(sig[:32], 'big'), int.from_bytes(sig[32:], 'big')
    if r >= P or s >= N: return False
    e = int.from_bytes(_tagged('BIP0340/challenge', sig[:32] + pub + msg), 'big') % N
    R = _add(_mul(G, s), _mul((x, y), N - e))
    return R is not None and R[1] % 2 == 0 and R[0] == r


def valid_event(ev):
    try:
        ser = json.dumps([0, ev['pubkey'], ev['created_at'], ev['kind'], ev['tags'], ev['content']],
                         separators=(',', ':'), ensure_ascii=False)
        eid = hashlib.sha256(ser.encode()).hexdigest()
        if eid != ev['id']: return False, 'invalid: bad event id'
        if not schnorr_verify(bytes.fromhex(eid), bytes.fromhex(ev['pubkey']), bytes.fromhex(ev['sig'])):
            return False, 'invalid: bad signature'
        return True, ''
    except Exception as e:  # malformed
        return False, 'invalid: %s' % e


def matches(f, ev):
    if 'ids' in f and not any(ev['id'].startswith(x) for x in f['ids']): return False
    if 'authors' in f and not any(ev['pubkey'].startswith(x) for x in f['authors']): return False
    if 'kinds' in f and ev['kind'] not in f['kinds']: return False
    if 'since' in f and ev['created_at'] < f['since']: return False
    if 'until' in f and ev['created_at'] > f['until']: return False
    for k, vals in f.items():
        if k.startswith('#') and len(k) == 2:
            if not any(t and t[0] == k[1] and len(t) > 1 and t[1] in vals for t in ev['tags']): return False
    return True


# ------------------------------------------------------------------ relay
class Relay:
    def __init__(self, db):
        self.events, self.ids, self.clients, self.db = [], set(), set(), db
        if db and os.path.exists(db):
            for line in open(db, encoding='utf-8'):
                try:
                    ev = json.loads(line); self.events.append(ev); self.ids.add(ev['id'])
                except ValueError:
                    pass
        print('relay: %d events loaded' % len(self.events), flush=True)

    def query(self, f):
        out = [e for e in self.events if matches(f, e)]
        out.sort(key=lambda e: e['created_at'], reverse=True)
        return out[:min(int(f.get('limit', 5000)), 5000)]

    def store(self, ev):
        self.events.append(ev); self.ids.add(ev['id'])
        if len(self.events) > 200000:
            drop = self.events[:20000]; self.events = self.events[20000:]
            for e in drop: self.ids.discard(e['id'])
        if self.db:
            with open(self.db, 'a', encoding='utf-8') as fh:
                fh.write(json.dumps(ev, ensure_ascii=False) + '\n')


class Client:
    def __init__(self, relay, reader, writer):
        self.relay, self.r, self.w, self.subs = relay, reader, writer, {}

    async def send(self, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        hdr = bytes([0x81])
        n = len(data)
        hdr += bytes([n]) if n < 126 else (bytes([126]) + struct.pack('>H', n) if n < 65536 else bytes([127]) + struct.pack('>Q', n))
        self.w.write(hdr + data)
        await self.w.drain()

    async def frames(self):
        buf, op0 = b'', None
        while True:
            h = await self.r.readexactly(2)
            fin, op, masked, n = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x80, h[1] & 0x7F
            if n == 126: n = struct.unpack('>H', await self.r.readexactly(2))[0]
            elif n == 127: n = struct.unpack('>Q', await self.r.readexactly(8))[0]
            if n > MAX_MSG: raise ValueError('frame too large')
            mask = await self.r.readexactly(4) if masked else b'\0\0\0\0'
            data = bytearray(await self.r.readexactly(n))
            for i in range(n): data[i] ^= mask[i % 4]
            if op == 8: return
            if op == 9: self.w.write(bytes([0x8A, len(data)]) + bytes(data)); await self.w.drain(); continue
            if op == 10: continue
            if op in (1, 2): buf, op0 = bytes(data), op
            elif op == 0: buf += bytes(data)
            if fin and op0 is not None:
                yield buf.decode('utf-8', 'replace'); buf, op0 = b'', None

    async def run(self):
        async for text in self.frames():
            try: msg = json.loads(text)
            except ValueError: continue
            if not isinstance(msg, list) or not msg: continue
            if msg[0] == 'EVENT' and len(msg) > 1 and isinstance(msg[1], dict):
                ev = msg[1]
                ok, why = valid_event(ev)
                if ok and ev['id'] in self.relay.ids: why = 'duplicate: already have it'
                await self.send(['OK', ev.get('id', ''), ok, why])
                if not ok or why: continue
                if not (20000 <= ev['kind'] < 30000): self.relay.store(ev)
                for c in list(self.relay.clients):
                    for sid, filters in c.subs.items():
                        if any(matches(f, ev) for f in filters):
                            try: await c.send(['EVENT', sid, ev])
                            except Exception: pass
                            break
            elif msg[0] == 'REQ' and len(msg) > 2:
                sid, filters = msg[1], [f for f in msg[2:] if isinstance(f, dict)]
                self.subs[sid] = filters
                sent = set()
                for f in filters:
                    for ev in self.relay.query(f):
                        if ev['id'] not in sent:
                            sent.add(ev['id']); await self.send(['EVENT', sid, ev])
                await self.send(['EOSE', sid])
            elif msg[0] == 'CLOSE' and len(msg) > 1:
                self.subs.pop(msg[1], None)


async def handle(relay, reader, writer):
    try:
        head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 15)
        lines = head.decode('latin-1').split('\r\n')
        hdrs = {k.strip().lower(): v.strip() for k, _, v in (l.partition(':') for l in lines[1:] if ':' in l)}
        if hdrs.get('upgrade', '').lower() != 'websocket':
            info = json.dumps({'name': 'Motey relay', 'description': 'Nostr relay for Motey', 'supported_nips': [1, 11], 'software': 'motey/server/relay.py'}).encode()
            ctype = 'application/nostr+json' if 'nostr+json' in hdrs.get('accept', '') else 'application/json'
            writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: ' + ctype.encode() + b'\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: ' + str(len(info)).encode() + b'\r\nConnection: close\r\n\r\n' + info)
            await writer.drain(); writer.close(); return
        accept = base64.b64encode(hashlib.sha1((hdrs['sec-websocket-key'] + GUID).encode()).digest()).decode()
        writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
        await writer.drain()
        c = Client(relay, reader, writer)
        relay.clients.add(c)
        try: await c.run()
        finally: relay.clients.discard(c)
    except (asyncio.IncompleteReadError, ConnectionError, asyncio.TimeoutError, ValueError, KeyError):
        pass
    finally:
        try: writer.close()
        except Exception: pass


async def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--host', default='0.0.0.0')
    ap.add_argument('--port', type=int, default=7777)
    ap.add_argument('--db', default='', help='JSON-lines file to keep events between restarts')
    a = ap.parse_args()
    relay = Relay(a.db)
    srv = await asyncio.start_server(lambda r, w: handle(relay, r, w), a.host, a.port, limit=MAX_MSG)
    print('Motey relay on ws://%s:%d' % (a.host, a.port), flush=True)
    async with srv:
        await srv.serve_forever()


if __name__ == '__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: sys.exit(0)
