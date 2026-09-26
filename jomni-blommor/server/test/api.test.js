import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { localToUtc, quote, validateDelivery } from '../src/delivery.js';
import { coinsForAmount } from '../src/shop.js';
import { verifyStripeSignature } from '../src/stripe.js';

// Fast klocka: tisdag 2026-09-22 08:00 i Stockholm.
const NOW = localToUtc('2026-09-22', 8);
let server;
let base;
let db;
let app;
let clock = NOW;

before(async () => {
  db = createDb(null);
  app = createApp({ db, env: { DEMO_MODE: '1' }, log: { warn() {}, error() {} }, now: () => clock });
  server = http.createServer(app.handler);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

const orderBody = (over = {}) => ({
  items: [{ productId: 'solsken', qty: 1 }],
  customer: { name: 'Anna Kund', email: 'anna@example.se', phone: '070-123 45 67' },
  delivery: {
    recipient: 'Mormor', recipientPhone: '070-765 43 21', address: 'Blomgatan 1', postcode: '118 20',
    city: 'Stockholm', zoneId: 'bud', date: '2026-09-22', slot: '12-15', message: 'Grattis!',
  },
  wallet: 'apple_pay',
  ...over,
});

test('stockholmstid räknas rätt över sommartid/vintertid', () => {
  assert.equal(new Date(localToUtc('2026-07-01', 9)).toISOString(), '2026-07-01T07:00:00.000Z');
  assert.equal(new Date(localToUtc('2026-12-01', 9)).toISOString(), '2026-12-01T08:00:00.000Z');
});

test('leveransförslag: bud samma dag med tider, PostNord först om två vardagar', () => {
  const q = quote('11820', '2026-09-22', NOW);
  assert.ok(q.ok);
  const bud = q.options.find((o) => o.id === 'bud');
  assert.equal(bud.earliestDate, '2026-09-22');
  // 09–12 är för nära (2 h förberedelse), 12–15 går.
  assert.deepEqual(bud.slots.map((s) => s.id), ['12-15', '15-18', '18-21']);
  const pn = q.options.find((o) => o.id === 'postnord');
  assert.equal(pn.earliestDate, '2026-09-24');
  assert.equal(quote('90110', null, NOW).options.map((o) => o.id).join(), 'postnord');
  assert.equal(quote('99999', null, NOW).ok, false);
  assert.equal(validateDelivery({ postcode: '11820', zoneId: 'bud', date: '2026-09-22', slot: '09-12' }, NOW).ok, false);
});

test('beställning, demobetalning (Apple Pay), mynt och Plus-dubbling', async () => {
  const reg = await api('POST', '/api/auth/register', { name: 'Anna', email: 'anna@example.se', password: 'hemligt123' });
  assert.equal(reg.status, 200);
  const token = reg.body.token;

  // 2 × Liten Hälsning (199) + 1 × Solsken (349) = 747 kr → 747 × 0,002 = 1,494 mynt
  const created = await api('POST', '/api/orders', orderBody({
    items: [{ productId: 'liten-halsning', qty: 2 }, { productId: 'solsken', qty: 1 }],
  }), token);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.order.subtotal, 747);
  assert.equal(created.body.order.deliveryFee, 89);
  assert.equal(created.body.order.total, 836);
  assert.equal(created.body.payment.mode, 'demo');

  const paid = await api('POST', `/api/orders/${created.body.order.id}/demo-pay`, { t: created.body.trackingToken, wallet: 'apple_pay' });
  assert.equal(paid.body.order.status, 'paid');
  let me = await api('GET', '/api/me', null, token);
  assert.equal(me.body.user.coins, 1.494);

  // Exakt enligt reglerna: 150 kr = 0,3 mynt (300 milli-mynt)
  assert.equal(coinsForAmount(150, false), 300);
  assert.equal(coinsForAmount(150, true), 600);

  // Jomni Plus → dubbla mynt
  const plus = await api('POST', '/api/plus/subscribe', {}, token);
  assert.equal(plus.body.user.plus.active, true);
  const o2 = await api('POST', '/api/orders', orderBody(), token);
  await api('POST', `/api/orders/${o2.body.order.id}/demo-pay`, { t: o2.body.trackingToken });
  me = await api('GET', '/api/me', null, token);
  assert.equal(me.body.user.coins, 1.494 + 349 * 0.002 * 2);

  // Kan inte betala två gånger → inga extra mynt
  await api('POST', `/api/orders/${o2.body.order.id}/demo-pay`, { t: o2.body.trackingToken });
  assert.equal((await api('GET', '/api/me', null, token)).body.user.coins, me.body.user.coins);

  // Spårning kräver token
  assert.equal((await api('GET', `/api/orders/${o2.body.order.id}`)).status, 404);
  assert.equal((await api('GET', `/api/orders/${o2.body.order.id}?t=${o2.body.trackingToken}`)).status, 200);
});

test('växla mynt till diamanter och lös in belöning', async () => {
  const reg = await api('POST', '/api/auth/register', { name: 'Bo', email: 'bo@example.se', password: 'hemligt123' });
  const token = reg.body.token;
  const user = db.data.users.find((u) => u.email === 'bo@example.se');
  user.coins = 20000; // 20 mynt
  const conv = await api('POST', '/api/loyalty/convert', { coins: 20 }, token);
  assert.equal(conv.status, 200);
  assert.equal(conv.body.user.coins, 0);
  assert.equal(conv.body.user.diamonds, 0.12); // 20 mynt = 0,12 diamanter
  assert.equal((await api('POST', '/api/loyalty/convert', { coins: 1 }, token)).status, 400);

  const red = await api('POST', '/api/loyalty/redeem', { rewardId: 'free-bouquet' }, token);
  assert.equal(red.status, 200);
  assert.equal(red.body.user.diamonds, 0);
  const code = red.body.code;

  // Gratis bukett: Solsken 349 kr dras av, bara leveransen kvar
  const price = await api('POST', '/api/cart/price', { items: [{ productId: 'solsken', qty: 1 }], discountCode: code, zoneId: 'bud' }, token);
  assert.equal(price.body.total, 89);
  // Andra konton kan inte använda koden
  const other = await api('POST', '/api/cart/price', { items: [{ productId: 'solsken', qty: 1 }], discountCode: code, zoneId: 'bud' });
  assert.ok(other.body.discountError);
});

test('admin: lösenord, beställningar, stjärnor → rabattkod', async () => {
  assert.equal((await api('POST', '/api/admin/login', { password: 'fel' })).status, 401);
  assert.equal((await api('GET', '/api/admin/orders')).status, 401);
  const login = await api('POST', '/api/admin/login', { password: 'Raken160726' });
  assert.equal(login.status, 200);
  const admin = login.body.token;

  const list = await api('GET', '/api/admin/orders', null, admin);
  assert.ok(list.body.orders.length >= 2);
  assert.ok(list.body.orders.every((o) => o.status !== 'awaiting_payment'));
  const order = list.body.orders[0];
  assert.ok(order.customer.email);

  // Utan stjärnor går det inte att skapa rabatt
  const early = await api('POST', '/api/admin/discounts', { type: 'percent', value: 10 }, admin);
  assert.equal(early.status, 400);

  // Leverera → kund ger 5 stjärnor
  await api('PATCH', `/api/admin/orders/${order.id}`, { status: 'delivered' }, admin);
  const t = db.data.orders.find((o) => o.id === order.id).trackingToken;
  const rate = await api('POST', `/api/orders/${order.id}/rate`, { t, stars: 5, comment: 'Så fina!' });
  assert.equal(rate.status, 200);
  assert.equal((await api('POST', `/api/orders/${order.id}/rate`, { t, stars: 5 })).status, 400);

  db.data.stars.received += 20; // fler betyg
  const stats = await api('GET', '/api/admin/stats', null, admin);
  assert.equal(stats.body.stars.balance, 25);

  const disc = await api('POST', '/api/admin/discounts', { type: 'percent', value: 10, code: 'host10' }, admin);
  assert.equal(disc.status, 200);
  assert.equal(disc.body.discount.code, 'HOST10');
  assert.equal(disc.body.stars.balance, 15);

  const price = await api('POST', '/api/cart/price', { items: [{ productId: 'pion-lyx', qty: 1 }], discountCode: 'Host10', zoneId: 'bud' });
  assert.equal(price.body.discount.amount, 60);
  assert.equal(price.body.total, 599 - 60 + 89);

  // Radera oanvänd kod → stjärnorna tillbaka
  const del = await api('DELETE', '/api/admin/discounts/HOST10', null, admin);
  assert.equal(del.body.refunded, 10);
});

test('påminnelse om leverans skickas som tidskänslig push', async () => {
  const sent = [];
  const db2 = createDb(null);
  const fakeApns = { sendTimeSensitive: async (devices, msg) => { sent.push(msg); return []; } };
  let t = NOW;
  const app2 = createApp({ db: db2, env: { DEMO_MODE: '1' }, apns: fakeApns, log: { warn() {}, error() {} }, now: () => t });
  db2.data.devices.push({ token: 'ab'.repeat(32), env: 'sandbox' });
  const srv = http.createServer(app2.handler);
  await new Promise((r) => srv.listen(0, r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  const res = await fetch(`${url}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderBody()) });
  const { order, trackingToken } = await res.json();
  await fetch(`${url}/api/orders/${order.id}/demo-pay`, { method: 'POST', body: JSON.stringify({ t: trackingToken }) });
  srv.close();
  assert.match(sent[0].title, /du måste leverera/);

  app2.tick();
  assert.equal(sent.length, 1); // 08:00, fönstret börjar 12:00
  t = localToUtc('2026-09-22', 11);
  app2.tick();
  app2.tick();
  assert.equal(sent.length, 2);
  assert.match(sent[1].title, /Dags att leverera/);
});

test('stripe-webhook signatur', () => {
  const secret = 'whsec_test';
  const body = '{"id":"evt_1"}';
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  assert.equal(verifyStripeSignature(body, `t=${ts},v1=${sig}`, secret), true);
  assert.equal(verifyStripeSignature(body, `t=${ts},v1=${'0'.repeat(64)}`, secret), false);
  assert.equal(verifyStripeSignature(body, `t=${ts - 1000},v1=${sig}`, secret), false);
});
