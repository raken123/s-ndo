#!/usr/bin/env python3
"""Motey-servern: Gemini API key, subscriptions (Lite/Plus/Pro) and usage.

The apps never see the Gemini key. They call this server, which checks the
user's plan and remaining usage, forwards the request to Gemini and counts it.
Payments run through Stripe Checkout; Stripe's webhook switches the plan.

    GEMINI_API_KEY=...            your key from Google AI Studio (required)
    PUBLIC_URL=https://motey.example.se    where this server is reachable
    STRIPE_SECRET_KEY=sk_live_...           (optional, for selling Plus/Pro)
    STRIPE_WEBHOOK_SECRET=whsec_...
    STRIPE_PRICE_PLUS=price_...   a 12 kr/month recurring price
    STRIPE_PRICE_PRO=price_...    a 310 kr/month recurring price
    python3 motey/server/motey_server.py --port 8787 --data motey-data

Put it behind HTTPS (Caddy, nginx, a PaaS) and enter the URL in Motey under
Mer → AI → Motey-server. Only the Python standard library is used.
"""
import argparse, asyncio, base64, hashlib, hmac, json, os, ssl, struct, sys, time, urllib.error, urllib.parse, urllib.request

GEMINI_BASE = os.environ.get('GEMINI_BASE', 'https://generativelanguage.googleapis.com')
GEMINI_WS = os.environ.get('GEMINI_WS', 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent')

# Same numbers as app/js/plans.js. Units: a Plus month = 100.
PLANS = {
    'lite': {'quota': 25, 'live': False, 'replace': False},
    'plus': {'quota': 100, 'live': True, 'replace': False},
    'pro': {'quota': 2000, 'live': True, 'replace': True},
}
COST = {'summary': 1, 'catchup': 1, 'ask': 0.5, 'fix': 1, 'tiktok': 4, 'game': 3, 'scan': 2, 'test': 0,
        'studio_plan': 2, 'studio_code': 3, 'studio_design': 3, 'studio_tutorial': 3, 'studio_buy': 1, 'studio_names': 1, 'studio_more': 2,
        'live_min': 5, 'replace_min': 5}
GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def period():
    return time.strftime('%Y-%m', time.gmtime())


# ------------------------------------------------------------------ users
class Users:
    def __init__(self, folder):
        self.path = os.path.join(folder, 'users.json')
        os.makedirs(folder, exist_ok=True)
        self.d = json.load(open(self.path)) if os.path.exists(self.path) else {}

    def save(self):
        tmp = self.path + '.tmp'
        json.dump(self.d, open(tmp, 'w'))
        os.replace(tmp, self.path)

    @staticmethod
    def key(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def get(self, token):
        if not token or len(token) < 16:
            return None
        k = self.key(token)
        u = self.d.setdefault(k, {'plan': 'lite', 'used': 0, 'period': period()})
        if u['period'] != period():
            u['used'], u['period'] = 0, period()
        return u

    def by(self, field, value):
        for k, u in self.d.items():
            if u.get(field) == value:
                return k, u
        return None, None

    def view(self, u):
        return {'plan': u['plan'], 'used': round(u['used'], 2), 'quota': PLANS[u['plan']]['quota'], 'period': u['period']}

    def allowed(self, u, action):
        p = PLANS[u['plan']]
        if action == 'live_min' and not p['live']:
            return 'feature'
        if action in ('replace_min', 'scan') and not p['replace']:
            return 'feature'
        if u['used'] + COST.get(action, 1) > p['quota'] + 1e-9:
            return 'quota'
        return None

    def charge(self, u, action):
        u['used'] = round(u['used'] + COST.get(action, 1), 2)
        self.save()


# ------------------------------------------------------------------ http helpers
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'}


async def respond(writer, status, body, ctype='application/json', extra=None):
    data = body if isinstance(body, bytes) else (json.dumps(body, ensure_ascii=False).encode() if ctype == 'application/json' else body.encode())
    head = ['HTTP/1.1 %d %s' % (status, {200: 'OK', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 500: 'Error', 502: 'Bad Gateway'}.get(status, 'OK')),
            'Content-Type: ' + ctype, 'Content-Length: %d' % len(data), 'Connection: close']
    for k, v in dict(CORS, **(extra or {})).items():
        head.append('%s: %s' % (k, v))
    writer.write(('\r\n'.join(head) + '\r\n\r\n').encode() + data)
    await writer.drain()
    writer.close()


def https(method, url, body=None, headers=None, form=None, timeout=120):
    """Blocking HTTPS call (run in a thread). Returns (status, bytes)."""
    data = None
    h = dict(headers or {})
    if form is not None:
        data = urllib.parse.urlencode(form).encode(); h['Content-Type'] = 'application/x-www-form-urlencoded'
    elif body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode(); h.setdefault('Content-Type', 'application/json')
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


# ------------------------------------------------------------------ websocket helpers
async def ws_read(reader):
    """Yield (opcode, payload) for complete messages; handles fragmentation and masking."""
    buf, op0 = b'', None
    while True:
        h = await reader.readexactly(2)
        fin, op, masked, n = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x80, h[1] & 0x7F
        if n == 126: n = struct.unpack('>H', await reader.readexactly(2))[0]
        elif n == 127: n = struct.unpack('>Q', await reader.readexactly(8))[0]
        if n > 8 * 1024 * 1024: raise ValueError('frame too large')
        mask = await reader.readexactly(4) if masked else None
        data = await reader.readexactly(n)
        if mask:
            data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        if op >= 8:
            yield op, data
            continue
        if op in (1, 2): buf, op0 = data, op
        else: buf += data
        if fin:
            yield op0, buf
            buf, op0 = b'', None


def ws_frame(op, data, mask=False):
    n = len(data)
    head = bytes([0x80 | op])
    mbit = 0x80 if mask else 0
    head += bytes([mbit | n]) if n < 126 else (bytes([mbit | 126]) + struct.pack('>H', n) if n < 65536 else bytes([mbit | 127]) + struct.pack('>Q', n))
    if mask:
        key = os.urandom(4)
        return head + key + bytes(b ^ key[i % 4] for i, b in enumerate(data))
    return head + data


async def ws_connect(url):
    """Open a client WebSocket (ws:// or wss://). Returns (reader, writer)."""
    u = urllib.parse.urlparse(url)
    secure = u.scheme == 'wss'
    port = u.port or (443 if secure else 80)
    reader, writer = await asyncio.open_connection(u.hostname, port, ssl=ssl.create_default_context() if secure else None, limit=16 * 1024 * 1024)
    key = base64.b64encode(os.urandom(16)).decode()
    path = u.path + ('?' + u.query if u.query else '')
    writer.write(('GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (path, u.hostname, key)).encode())
    await writer.drain()
    head = await reader.readuntil(b'\r\n\r\n')
    if b' 101 ' not in head.split(b'\r\n')[0]:
        raise ConnectionError('upstream refused: ' + head.split(b'\r\n')[0].decode(errors='replace'))
    return reader, writer


# ------------------------------------------------------------------ server
class Server:
    def __init__(self, a):
        self.users = Users(a.data)
        self.key = os.environ.get('GEMINI_API_KEY', '')
        self.public = os.environ.get('PUBLIC_URL', 'http://localhost:%d' % a.port).rstrip('/')
        self.stripe = os.environ.get('STRIPE_SECRET_KEY', '')
        self.whsec = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
        self.prices = {'plus': os.environ.get('STRIPE_PRICE_PLUS', ''), 'pro': os.environ.get('STRIPE_PRICE_PRO', '')}
        if not self.key:
            print('VARNING: GEMINI_API_KEY saknas – AI-anrop kommer att misslyckas', flush=True)

    async def handle(self, reader, writer):
        try:
            head = await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'), 20)
            lines = head.decode('latin-1').split('\r\n')
            method, target, _ = lines[0].split(' ', 2)
            hdrs = {k.strip().lower(): v.strip() for k, _, v in (l.partition(':') for l in lines[1:] if ':' in l)}
            body = await reader.readexactly(int(hdrs.get('content-length', 0) or 0)) if method == 'POST' else b''
            url = urllib.parse.urlparse(target)
            q = dict(urllib.parse.parse_qsl(url.query))
            token = hdrs.get('authorization', '')[7:] if hdrs.get('authorization', '').startswith('Bearer ') else q.get('token', '')
            path = url.path
            if method == 'OPTIONS':
                return await respond(writer, 204, b'', 'text/plain')
            if path == '/v1/ai/live' and hdrs.get('upgrade', '').lower() == 'websocket':
                return await self.live(reader, writer, hdrs, token, q.get('action', 'live'))
            if path == '/health':
                return await respond(writer, 200, {'ok': True, 'gemini': bool(self.key), 'stripe': bool(self.stripe)})
            if path == '/paid':
                return await respond(writer, 200, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;text-align:center;padding:40px"><h1>Tack! 💜</h1><p>Gå tillbaka till Motey – din plan uppdateras av sig själv.</p>', 'text/html; charset=utf-8')
            if path == '/v1/stripe/webhook' and method == 'POST':
                return await self.webhook(writer, hdrs, body)
            u = self.users.get(token)
            if not u:
                return await respond(writer, 401, {'error': {'message': 'saknar Motey-token'}})
            if path == '/v1/me':
                return await respond(writer, 200, self.users.view(u))
            if path.startswith('/v1/ai/models') and method == 'GET':
                st, data = await asyncio.to_thread(https, 'GET', GEMINI_BASE + '/v1beta/models?' + url.query, None, {'x-goog-api-key': self.key})
                return await respond(writer, st, data)
            if path.startswith('/v1/ai/models/') and path.endswith(':generateContent') and method == 'POST':
                return await self.generate(writer, u, path, body)
            if path == '/v1/checkout' and method == 'POST':
                return await self.checkout(writer, token, u, json.loads(body or b'{}').get('plan'))
            if path == '/v1/portal' and method == 'POST':
                return await self.portal(writer, u)
            return await respond(writer, 404, {'error': {'message': 'finns inte'}})
        except (asyncio.IncompleteReadError, ConnectionError, asyncio.TimeoutError, ValueError) as e:
            try: writer.close()
            except Exception: pass

    async def generate(self, writer, u, path, body):
        req = json.loads(body or b'{}')
        action = (req.pop('motey', None) or {}).get('action', 'ask')
        if action not in COST: action = 'ask'
        why = self.users.allowed(u, action)
        if why:
            return await respond(writer, 402, {'error': {'message': 'Kvoten är slut' if why == 'quota' else 'Kräver en högre plan', 'kind': why}, 'motey': self.users.view(u)})
        model = path[len('/v1/ai/models/'):]
        st, data = await asyncio.to_thread(https, 'POST', '%s/v1beta/models/%s' % (GEMINI_BASE, model), req, {'x-goog-api-key': self.key})
        if st != 200:
            return await respond(writer, st, data)
        self.users.charge(u, action)
        out = json.loads(data)
        out['motey'] = self.users.view(u)
        return await respond(writer, 200, out)

    async def live(self, reader, writer, hdrs, token, action):
        accept = base64.b64encode(hashlib.sha1((hdrs['sec-websocket-key'] + GUID).encode()).digest()).decode()
        writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n' % accept).encode())
        await writer.drain()
        u = self.users.get(token)
        unit = 'replace_min' if action == 'replace' else 'live_min'

        async def close(code, reason):
            writer.write(ws_frame(8, struct.pack('>H', code) + reason.encode()))
            await writer.drain(); writer.close()
        if not u:
            return await close(4401, 'saknar Motey-token')
        why = self.users.allowed(u, unit)
        if why:
            return await close(4403 if why == 'feature' else 4402, 'Kräver en högre plan' if why == 'feature' else 'Kvoten är slut')
        try:
            ur, uw = await ws_connect(GEMINI_WS + '?key=' + urllib.parse.quote(self.key))
        except Exception as e:
            return await close(1011, 'Gemini Live: %s' % e)
        self.users.charge(u, unit)
        writer.write(ws_frame(1, json.dumps({'motey': self.users.view(u)}).encode()))
        done = asyncio.Event()

        async def up():   # app → Gemini
            try:
                async for op, data in ws_read(reader):
                    if op == 8: break
                    if op == 9: writer.write(ws_frame(10, data)); continue
                    if op in (1, 2): uw.write(ws_frame(op, data, mask=True)); await uw.drain()
            except Exception: pass
            done.set()

        async def down():  # Gemini → app
            try:
                async for op, data in ws_read(ur):
                    if op == 8: break
                    if op == 9: uw.write(ws_frame(10, data, mask=True)); continue
                    if op in (1, 2): writer.write(ws_frame(op, data)); await writer.drain()
            except Exception: pass
            done.set()

        async def meter():  # one unit per started minute
            while not done.is_set():
                try:
                    await asyncio.wait_for(done.wait(), 60)
                    return
                except asyncio.TimeoutError:
                    pass
                if self.users.allowed(u, unit):
                    writer.write(ws_frame(8, struct.pack('>H', 4402) + 'Kvoten är slut'.encode())); await writer.drain()
                    done.set(); return
                self.users.charge(u, unit)
                writer.write(ws_frame(1, json.dumps({'motey': self.users.view(u)}).encode())); await writer.drain()
        tasks = [asyncio.create_task(x()) for x in (up, down, meter)]
        await done.wait()
        for t in tasks: t.cancel()
        for w in (uw, writer):
            try: w.close()
            except Exception: pass

    # ---------------- Stripe ----------------
    async def checkout(self, writer, token, u, plan):
        if plan not in ('plus', 'pro'):
            return await respond(writer, 400, {'error': 'okänd plan'})
        if not self.stripe or not self.prices[plan]:
            return await respond(writer, 501, {'error': 'Betalning är inte uppsatt på servern (STRIPE_*)'})
        form = {'mode': 'subscription', 'line_items[0][price]': self.prices[plan], 'line_items[0][quantity]': '1',
                'client_reference_id': self.users.key(token), 'metadata[plan]': plan, 'subscription_data[metadata][plan]': plan,
                'success_url': self.public + '/paid', 'cancel_url': self.public + '/paid', 'locale': 'sv', 'allow_promotion_codes': 'true'}
        if u.get('customer'): form['customer'] = u['customer']
        st, data = await asyncio.to_thread(https, 'POST', 'https://api.stripe.com/v1/checkout/sessions', None, {'Authorization': 'Bearer ' + self.stripe}, form)
        d = json.loads(data or b'{}')
        return await respond(writer, 200 if st == 200 else 502, {'url': d.get('url')} if st == 200 else {'error': (d.get('error') or {}).get('message', 'Stripe-fel')})

    async def portal(self, writer, u):
        if not self.stripe or not u.get('customer'):
            return await respond(writer, 400, {'error': 'Ingen prenumeration att hantera'})
        st, data = await asyncio.to_thread(https, 'POST', 'https://api.stripe.com/v1/billing_portal/sessions', None, {'Authorization': 'Bearer ' + self.stripe}, {'customer': u['customer'], 'return_url': self.public + '/paid'})
        d = json.loads(data or b'{}')
        return await respond(writer, 200 if st == 200 else 502, {'url': d.get('url')} if st == 200 else {'error': 'Stripe-fel'})

    async def webhook(self, writer, hdrs, body):
        sig = dict(x.split('=', 1) for x in hdrs.get('stripe-signature', '').split(',') if '=' in x)
        expected = hmac.new(self.whsec.encode(), (sig.get('t', '') + '.').encode() + body, hashlib.sha256).hexdigest()
        if not self.whsec or not hmac.compare_digest(expected, sig.get('v1', '')) or abs(time.time() - int(sig.get('t', '0') or 0)) > 600:
            return await respond(writer, 400, {'error': 'bad signature'})
        ev = json.loads(body)
        obj = ev.get('data', {}).get('object', {})
        typ = ev.get('type')
        if typ == 'checkout.session.completed':
            k = obj.get('client_reference_id')
            if k and len(k) == 64:
                u = self.users.d.setdefault(k, {'plan': 'lite', 'used': 0, 'period': period()})
                u.update(plan=(obj.get('metadata') or {}).get('plan', 'plus'), customer=obj.get('customer'), sub=obj.get('subscription'))
                self.users.save()
        elif typ in ('customer.subscription.updated', 'customer.subscription.deleted'):
            k, u = self.users.by('sub', obj.get('id'))
            if u is not None:
                active = typ == 'customer.subscription.updated' and obj.get('status') in ('active', 'trialing', 'past_due')
                u['plan'] = (obj.get('metadata') or {}).get('plan', u['plan']) if active else 'lite'
                self.users.save()
        return await respond(writer, 200, {'received': True})


async def main():
    ap = argparse.ArgumentParser(description='Motey-servern')
    ap.add_argument('--host', default='0.0.0.0')
    ap.add_argument('--port', type=int, default=8787)
    ap.add_argument('--data', default='motey-data', help='folder for users.json')
    a = ap.parse_args()
    s = Server(a)
    srv = await asyncio.start_server(s.handle, a.host, a.port, limit=16 * 1024 * 1024)
    print('Motey-servern på http://%s:%d' % (a.host, a.port), flush=True)
    async with srv:
        await srv.serve_forever()


if __name__ == '__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: sys.exit(0)
