import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_ADMIN_PASSWORD_HASH, LOYALTY, ORDER_STATUSES, PLUS, PRODUCTS, REWARDS, SHOP, SLOTS, ZONES, starCost,
} from './config.js';
import {
  createLimiter, createSession, dropSession, hashPassword, readSession, verifyPassword,
} from './auth.js';
import {
  addDays, formatPostcode, localDate, localToUtc, quote, slotStartUtc, validateDelivery, zoneById,
} from './delivery.js';
import {
  coinsForAmount, describeDiscount, diamondsForCoins, normalizeCode, plusActive, priceCart,
  publicUser, randomCode, rewardById,
} from './shop.js';
import { verifyStripeSignature } from './stripe.js';
import { verifyAppleTransaction } from './appstore.js';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '': 'application/octet-stream',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com https://*.js.stripe.com",
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://pay.google.com",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://*.stripe.com",
  "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

const statusLabel = (id) => ORDER_STATUSES.find((s) => s.id === id)?.label || id;
const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label || '';

function str(v, { max = 200, required = false, name = 'Fältet' } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw bad(`${name} måste fyllas i.`);
  if (s.length > max) throw bad(`${name} är för långt.`);
  return s;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function email(v) {
  const s = str(v, { max: 200, required: true, name: 'E-post' }).toLowerCase();
  if (!EMAIL_RE.test(s)) throw bad('Ange en giltig e-postadress.');
  return s;
}
function phone(v, name = 'Telefonnummer', required = true) {
  const s = str(v, { max: 30, required, name });
  if (s && !/^\+?[\d\s-]{7,20}$/.test(s)) throw bad(`${name} ser inte rätt ut.`);
  return s;
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createApp({ db, env = {}, stripe = null, apns = null, webRoot = null, log = console, now = () => Date.now() }) {
  const demo = !stripe && env.DEMO_MODE === '1';
  const adminHash = env.ADMIN_PASSWORD ? hashPassword(env.ADMIN_PASSWORD) : DEFAULT_ADMIN_PASSWORD_HASH;
  const loginLimiter = createLimiter();
  const data = () => db.data;
  // Bakom en omvänd proxy (TRUST_PROXY=1) används klientens IP från X-Forwarded-For.
  const clientIp = (req) => (env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())
    || req.socket.remoteAddress;

  // ---------------------------------------------------------------- helpers
  function publicOrder(o) {
    const zone = zoneById(o.delivery.zoneId);
    return {
      id: o.id, number: o.number, status: o.status, statusLabel: statusLabel(o.status),
      lines: o.lines, subtotal: o.subtotal, discount: o.discount, deliveryFee: o.deliveryFee, total: o.total,
      delivery: {
        recipient: o.delivery.recipient, city: o.delivery.city, postcode: o.delivery.postcode,
        address: o.delivery.address, date: o.delivery.date, slot: o.delivery.slot, slotLabel: slotLabel(o.delivery.slot),
        zoneId: o.delivery.zoneId, zoneName: zone?.name || o.delivery.zoneId, message: o.delivery.message,
      },
      coinsEarned: (o.coinsEarned || 0) / 1000, plusBonus: !!o.plusBonus,
      payment: { method: o.payment.method, paid: !!o.payment.paidAt },
      history: o.history.map((h) => ({ ...h, label: statusLabel(h.status) })),
      rating: o.rating ? { stars: o.rating.stars, comment: o.rating.comment } : null,
      canRate: o.status === 'delivered' && !o.rating,
      createdAt: o.createdAt,
    };
  }

  function adminOrder(o) {
    return {
      ...publicOrder(o),
      customer: o.customer,
      delivery: { ...publicOrder(o).delivery, recipientPhone: o.delivery.recipientPhone, instructions: o.delivery.instructions },
      userId: o.userId,
      payment: { ...o.payment },
      deliverBy: new Date(slotStartUtc(o)).toISOString(),
    };
  }

  function currentUser(req) {
    const s = readSession(db, req);
    if (!s || s.kind !== 'user') return null;
    return data().users.find((u) => u.id === s.userId) || null;
  }
  function requireUser(req) {
    const u = currentUser(req);
    if (!u) throw new HttpError(401, 'Logga in först.');
    return u;
  }
  function requireAdmin(req) {
    const s = readSession(db, req);
    if (!s || s.kind !== 'admin') throw new HttpError(401, 'Admininloggning krävs.');
  }
  function orderFor(req, id, token) {
    const o = data().orders.find((x) => x.id === id);
    if (!o) throw new HttpError(404, 'Beställningen finns inte.');
    const u = currentUser(req);
    const s = readSession(db, req);
    if (safeEqual(token, o.trackingToken) || (u && o.userId === u.id) || s?.kind === 'admin') return o;
    throw new HttpError(404, 'Beställningen finns inte.');
  }

  async function notifyAdmins(title, body, orderId, collapseId) {
    const devices = data().devices;
    if (!apns || !devices.length) return;
    try {
      const dead = await apns.sendTimeSensitive(devices, { title, body, orderId, collapseId });
      if (dead.length) {
        data().devices = devices.filter((d) => !dead.includes(d.token));
        db.save();
      }
    } catch (e) {
      log.warn('Kunde inte skicka push:', e.message);
    }
  }

  function markPaid(order, method) {
    if (order.status !== 'awaiting_payment') return false;
    const t = new Date(now()).toISOString();
    order.status = 'paid';
    order.payment.paidAt = t;
    if (method) order.payment.method = method;
    order.history.push({ status: 'paid', at: t });
    if (order.discount) {
      const d = data().discounts.find((x) => x.code === order.discount.code);
      if (d) d.uses += 1;
    }
    const user = order.userId && data().users.find((u) => u.id === order.userId);
    if (user) {
      const plus = plusActive(user, now());
      const earned = coinsForAmount(order.productTotal, plus);
      user.coins += earned;
      order.coinsEarned = earned;
      order.plusBonus = plus;
    }
    db.save();
    const d = order.delivery;
    const when = d.slot ? `${d.date} kl ${slotLabel(d.slot)}` : `${d.date} (PostNord)`;
    notifyAdmins(`Ny beställning #${order.number} – du måste leverera`,
      `${when} · ${order.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')} · ${d.address}, ${d.city}`, order.id, `new-${order.id}`);
    return true;
  }

  function activatePlus(user, { until, source, stripeSubscriptionId, appleOriginalTransactionId, cancelAtPeriodEnd = false }) {
    user.plus = {
      ...(user.plus || {}), active: true, until: new Date(until).toISOString(), source,
      cancelAtPeriodEnd,
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
      ...(appleOriginalTransactionId ? { appleOriginalTransactionId } : {}),
    };
    db.save();
  }

  function subPeriodEnd(sub) {
    const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    return end ? end * 1000 : now() + 31 * 864e5;
  }

  // Påminnelser: tidskänslig push när det är dags att leverera.
  function tick() {
    const t = now();
    for (const o of data().orders) {
      if (!['paid', 'preparing', 'out_for_delivery'].includes(o.status) || o.reminderSent) continue;
      if (o.delivery.slot) {
        const start = slotStartUtc(o);
        if (t < start - 60 * 60 * 1000) continue;
        o.reminderSent = true;
        db.save();
        notifyAdmins(`⏰ Dags att leverera #${o.number}`,
          `Kl ${slotLabel(o.delivery.slot)} till ${o.delivery.recipient}, ${o.delivery.address}, ${o.delivery.city}`, o.id, `deliver-${o.id}`);
      } else {
        const dispatch = localToUtc(addDays(o.delivery.date, -1), 8);
        if (t < dispatch) continue;
        o.reminderSent = true;
        db.save();
        notifyAdmins(`📦 Skicka #${o.number} med PostNord idag`,
          `Ska fram ${o.delivery.date} till ${o.delivery.recipient}, ${o.delivery.city}`, o.id, `deliver-${o.id}`);
      }
    }
  }

  // ---------------------------------------------------------------- routes
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern}$`), fn });

  route('GET', '/api/config', () => ({
    shop: SHOP.name,
    currency: 'SEK',
    payments: {
      mode: stripe ? 'stripe' : demo ? 'demo' : 'disabled',
      stripePublishableKey: stripe ? env.STRIPE_PUBLISHABLE_KEY || null : null,
      appleMerchantId: env.APPLE_MERCHANT_ID || 'merchant.se.jomni.blommor',
    },
    slots: SLOTS,
    zones: ZONES.map(({ id, name, description, fee, freeOver }) => ({ id, name, description, fee, freeOver })),
    loyalty: {
      coinsPer150Kr: (150 * LOYALTY.milliCoinsPerKrona) / 1000,
      diamondsPer20Coins: (20000 * LOYALTY.microDiamondsPerMilliCoin) / 1e6,
      milliCoinsPerKrona: LOYALTY.milliCoinsPerKrona,
      microDiamondsPerMilliCoin: LOYALTY.microDiamondsPerMilliCoin,
      plusMultiplier: LOYALTY.plusMultiplier,
    },
    plus: { name: PLUS.name, priceKr: PLUS.priceKr, appleProductId: PLUS.appleProductId },
    rewards: REWARDS.map((r) => ({ id: r.id, name: r.name, cost: r.cost / 1e6, microCost: r.cost })),
    today: localDate(now()),
  }));

  route('GET', '/api/products', () => ({ products: PRODUCTS }));

  route('POST', '/api/delivery/quote', ({ body }) => {
    const q = quote(body.postcode, body.date, now());
    if (!q.ok) throw bad(q.error);
    return q;
  });

  route('POST', '/api/cart/price', ({ req, body }) => {
    const user = currentUser(req);
    const zone = body.zoneId ? zoneById(body.zoneId) : null;
    const p = priceCart(db, { items: body.items, discountCode: body.discountCode, zone, userId: user?.id, now: now() });
    if (p.error) throw bad(p.error);
    return p;
  });

  // --- Beställning & betalning
  route('POST', '/api/orders', async ({ req, body }) => {
    if (!stripe && !demo) throw new HttpError(503, 'Betalning är inte konfigurerad ännu.');
    const user = currentUser(req);
    const c = body.customer || {};
    const d = body.delivery || {};
    const customer = {
      name: str(c.name, { max: 100, required: true, name: 'Ditt namn' }),
      email: email(c.email),
      phone: phone(c.phone),
    };
    const delivery = {
      recipient: str(d.recipient, { max: 100, required: true, name: 'Mottagarens namn' }),
      recipientPhone: phone(d.recipientPhone, 'Mottagarens telefon'),
      address: str(d.address, { max: 150, required: true, name: 'Gatuadress' }),
      city: str(d.city, { max: 80, required: true, name: 'Ort' }),
      message: str(d.message, { max: 300, name: 'Kortmeddelandet' }),
      instructions: str(d.instructions, { max: 300, name: 'Leveransinstruktionen' }),
      date: str(d.date, { max: 10 }),
      slot: str(d.slot, { max: 10 }) || null,
      zoneId: str(d.zoneId, { max: 20 }),
    };
    const v = validateDelivery({ postcode: d.postcode, zoneId: delivery.zoneId, date: delivery.date, slot: delivery.slot }, now());
    if (!v.ok) throw bad(v.error);
    delivery.postcode = formatPostcode(v.postcode);
    if (!v.zone.slots) delivery.slot = null;

    const p = priceCart(db, { items: body.items, discountCode: body.discountCode, zone: v.zone, userId: user?.id, now: now() });
    if (p.error) throw bad(p.error);
    if (p.discountError) throw bad(p.discountError);
    if (p.total > 0 && p.total < 3) throw bad('Beloppet är för litet för kortbetalning.');

    data().counters.order += 1;
    const t = new Date(now()).toISOString();
    const order = {
      id: crypto.randomUUID(), number: data().counters.order, trackingToken: crypto.randomBytes(18).toString('base64url'),
      userId: user?.id || null, customer, delivery,
      lines: p.lines, subtotal: p.subtotal, discount: p.discount, deliveryFee: p.deliveryFee,
      productTotal: p.productTotal, total: p.total,
      status: 'awaiting_payment', payment: { method: ['apple_pay', 'google_pay', 'card'].includes(body.wallet) ? body.wallet : null },
      history: [{ status: 'awaiting_payment', at: t }], createdAt: t,
    };
    data().orders.push(order);
    db.save();

    let payment;
    if (order.total === 0) {
      markPaid(order, 'free');
      payment = { mode: 'free' };
    } else if (stripe) {
      const pi = await stripe.createPaymentIntent({
        amountKr: order.total, orderId: order.id, orderNumber: order.number, email: customer.email,
      });
      order.payment.intentId = pi.id;
      order.payment.provider = 'stripe';
      db.save();
      payment = { mode: 'stripe', clientSecret: pi.client_secret };
    } else {
      order.payment.provider = 'demo';
      db.save();
      payment = { mode: 'demo' };
    }
    return { order: publicOrder(order), trackingToken: order.trackingToken, payment };
  });

  route('GET', '/api/orders/([\\w-]+)', ({ req, params, query }) => ({ order: publicOrder(orderFor(req, params[0], query.get('t'))) }));

  route('POST', '/api/orders/([\\w-]+)/confirm', async ({ req, params, body }) => {
    const o = orderFor(req, params[0], body.t);
    if (o.status === 'awaiting_payment' && stripe && o.payment.intentId) {
      const pi = await stripe.retrievePaymentIntent(o.payment.intentId);
      if (pi.status === 'succeeded' && pi.amount === o.total * 100) {
        const type = pi.payment_method_types?.length === 1 ? pi.payment_method_types[0] : null;
        markPaid(o, o.payment.method || type);
      }
    }
    return { order: publicOrder(o) };
  });

  route('POST', '/api/orders/([\\w-]+)/demo-pay', ({ req, params, body }) => {
    if (!demo) throw new HttpError(403, 'Demobetalning är avstängd.');
    const o = orderFor(req, params[0], body.t);
    markPaid(o, ['apple_pay', 'google_pay', 'card'].includes(body.wallet) ? body.wallet : 'card');
    return { order: publicOrder(o) };
  });

  route('POST', '/api/orders/([\\w-]+)/rate', ({ req, params, body }) => {
    const o = orderFor(req, params[0], body.t);
    if (o.status !== 'delivered') throw bad('Du kan betygsätta när buketten är levererad.');
    if (o.rating) throw bad('Du har redan betygsatt den här beställningen.');
    const stars = Math.round(Number(body.stars));
    if (!(stars >= 1 && stars <= 5)) throw bad('Välj 1–5 stjärnor.');
    o.rating = { stars, comment: str(body.comment, { max: 500, name: 'Kommentaren' }), at: new Date(now()).toISOString() };
    data().stars.received += stars;
    data().stars.ratings += 1;
    db.save();
    return { order: publicOrder(o) };
  });

  // --- Kundkonton
  route('POST', '/api/auth/register', ({ body }) => {
    const name = str(body.name, { max: 100, required: true, name: 'Namn' });
    const mail = email(body.email);
    const pw = typeof body.password === 'string' ? body.password : '';
    if (pw.length < 8 || pw.length > 200) throw bad('Lösenordet måste vara minst 8 tecken.');
    if (data().users.some((u) => u.email === mail)) throw bad('Det finns redan ett konto med den e-postadressen.');
    const user = {
      id: crypto.randomUUID(), name, email: mail, passHash: hashPassword(pw),
      coins: 0, diamonds: 0, plus: null, createdAt: new Date(now()).toISOString(),
    };
    data().users.push(user);
    const token = createSession(db, { kind: 'user', userId: user.id, ttlMs: 90 * 864e5 });
    return { token, user: publicUser(user, db, now()) };
  });

  route('POST', '/api/auth/login', ({ req, body }) => {
    const key = `u:${clientIp(req)}`;
    if (loginLimiter.blocked(key)) throw new HttpError(429, 'För många försök. Vänta en stund.');
    const mail = String(body.email || '').trim().toLowerCase();
    const user = data().users.find((u) => u.email === mail);
    if (!user || !verifyPassword(String(body.password || ''), user.passHash)) {
      loginLimiter.fail(key);
      throw new HttpError(401, 'Fel e-post eller lösenord.');
    }
    loginLimiter.reset(key);
    const token = createSession(db, { kind: 'user', userId: user.id, ttlMs: 90 * 864e5 });
    return { token, user: publicUser(user, db, now()) };
  });

  route('POST', '/api/auth/logout', ({ req }) => { dropSession(db, req); return { ok: true }; });

  route('GET', '/api/me', ({ req }) => ({ user: publicUser(requireUser(req), db, now()) }));

  route('GET', '/api/me/orders', ({ req }) => {
    const u = requireUser(req);
    return {
      orders: data().orders.filter((o) => o.userId === u.id && o.status !== 'awaiting_payment')
        .map((o) => ({ ...publicOrder(o), trackingToken: o.trackingToken })).reverse(),
    };
  });

  // --- Mynt, diamanter & belöningar
  route('POST', '/api/loyalty/convert', ({ req, body }) => {
    const u = requireUser(req);
    const milli = body.all ? u.coins : Math.round(Number(body.coins) * 1000);
    if (!Number.isFinite(milli) || milli <= 0) throw bad('Ange hur många mynt du vill växla.');
    if (milli > u.coins) throw bad('Du har inte så många mynt.');
    u.coins -= milli;
    u.diamonds += diamondsForCoins(milli);
    db.save();
    return { user: publicUser(u, db, now()), converted: milli / 1000 };
  });

  route('POST', '/api/loyalty/redeem', ({ req, body }) => {
    const u = requireUser(req);
    const r = rewardById(body.rewardId);
    if (!r) throw bad('Belöningen finns inte.');
    if (u.diamonds < r.cost) throw bad('Du har inte tillräckligt med diamanter.');
    u.diamonds -= r.cost;
    const code = randomCode('JOMNI');
    data().discounts.push({
      code, ...r.discount, maxUses: 1, uses: 0, userId: u.id, source: 'reward', rewardId: r.id,
      createdAt: new Date(now()).toISOString(), expiresAt: null,
    });
    db.save();
    return { code, label: r.name, user: publicUser(u, db, now()) };
  });

  // --- Jomni Plus (48 kr/mån, dubbla mynt)
  route('POST', '/api/plus/subscribe', async ({ req }) => {
    const u = requireUser(req);
    if (plusActive(u, now()) && !u.plus.cancelAtPeriodEnd) throw bad('Du har redan Jomni Plus.');
    if (stripe) {
      const origin = env.PUBLIC_URL || `http://${req.headers.host}`;
      const s = await stripe.createPlusCheckout({
        userId: u.id, email: u.email, priceKr: PLUS.priceKr,
        successUrl: `${origin}/?plus=success&session_id={CHECKOUT_SESSION_ID}#/konto`,
        cancelUrl: `${origin}/#/beloningar`,
      });
      return { checkoutUrl: s.url };
    }
    if (!demo) throw new HttpError(503, 'Betalning är inte konfigurerad ännu.');
    activatePlus(u, { until: now() + 30 * 864e5, source: 'demo' });
    return { user: publicUser(u, db, now()) };
  });

  route('POST', '/api/plus/confirm', async ({ req, body }) => {
    const u = requireUser(req);
    if (!stripe) throw bad('Stripe är inte konfigurerat.');
    const s = await stripe.retrieveCheckoutSession(str(body.sessionId, { max: 300, required: true, name: 'Sessionen' }));
    if (s.client_reference_id !== u.id || s.status !== 'complete' || !s.subscription) throw bad('Prenumerationen kunde inte bekräftas.');
    const sub = typeof s.subscription === 'object' ? s.subscription : await stripe.retrieveSubscription(s.subscription);
    activatePlus(u, { until: subPeriodEnd(sub), source: 'stripe', stripeSubscriptionId: sub.id });
    return { user: publicUser(u, db, now()) };
  });

  route('POST', '/api/plus/cancel', async ({ req }) => {
    const u = requireUser(req);
    if (!plusActive(u, now())) throw bad('Du har ingen aktiv prenumeration.');
    if (u.plus.source === 'apple') throw bad('Avsluta i iPhone: Inställningar → ditt namn → Prenumerationer.');
    if (u.plus.source === 'stripe' && stripe) await stripe.cancelSubscriptionAtPeriodEnd(u.plus.stripeSubscriptionId);
    u.plus.cancelAtPeriodEnd = true;
    db.save();
    return { user: publicUser(u, db, now()) };
  });

  route('POST', '/api/plus/apple', ({ req, body }) => {
    const u = requireUser(req);
    let tx;
    try {
      tx = verifyAppleTransaction(body.signedTransaction, {
        now: now(), ...(env.APPLE_ROOT_CA_G3_SHA256 ? { rootFingerprint: env.APPLE_ROOT_CA_G3_SHA256 } : {}),
      });
    } catch (e) {
      throw bad(e.message);
    }
    const bundleId = env.APNS_BUNDLE_ID || 'se.jomni.blommor';
    if (tx.productId !== PLUS.appleProductId || tx.bundleId !== bundleId) throw bad('Fel produkt.');
    if (tx.revocationDate || !(tx.expiresDate > now())) throw bad('Prenumerationen är inte aktiv.');
    const owner = data().users.find((x) => x.plus?.appleOriginalTransactionId === tx.originalTransactionId);
    if (owner && owner.id !== u.id) throw bad('Prenumerationen tillhör ett annat konto.');
    activatePlus(u, { until: tx.expiresDate, source: 'apple', appleOriginalTransactionId: tx.originalTransactionId });
    return { user: publicUser(u, db, now()) };
  });

  // --- Stripe webhooks
  route('POST', '/api/stripe/webhook', ({ req, raw }) => {
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'], env.STRIPE_WEBHOOK_SECRET)) {
      throw new HttpError(400, 'Ogiltig signatur.');
    }
    const event = JSON.parse(raw);
    const obj = event.data?.object || {};
    if (event.type === 'payment_intent.succeeded') {
      const o = data().orders.find((x) => x.id === obj.metadata?.orderId && x.payment.intentId === obj.id);
      if (o && obj.amount === o.total * 100) markPaid(o, o.payment.method);
    } else if (event.type === 'checkout.session.completed' && obj.metadata?.kind === 'plus') {
      const u = data().users.find((x) => x.id === obj.client_reference_id);
      if (u && obj.subscription) {
        activatePlus(u, { until: now() + 31 * 864e5, source: 'stripe', stripeSubscriptionId: obj.subscription });
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const u = data().users.find((x) => x.plus?.stripeSubscriptionId === obj.id);
      if (u) {
        const active = ['active', 'trialing', 'past_due'].includes(obj.status) && event.type !== 'customer.subscription.deleted';
        u.plus = { ...u.plus, active, until: new Date(subPeriodEnd(obj)).toISOString(), cancelAtPeriodEnd: !!obj.cancel_at_period_end };
        db.save();
      }
    }
    return { received: true };
  });

  // --- Admin
  route('POST', '/api/admin/login', ({ req, body }) => {
    const key = `a:${clientIp(req)}`;
    if (loginLimiter.blocked(key)) throw new HttpError(429, 'För många försök. Vänta 15 minuter.');
    if (!verifyPassword(String(body.password || ''), adminHash)) {
      loginLimiter.fail(key);
      throw new HttpError(401, 'Fel lösenord.');
    }
    loginLimiter.reset(key);
    return { token: createSession(db, { kind: 'admin', ttlMs: 30 * 864e5 }) };
  });

  route('GET', '/api/admin/orders', ({ req, query }) => {
    requireAdmin(req);
    const status = query.get('status');
    const since = query.get('since');
    const includeUnpaid = query.get('include_unpaid') === '1';
    let list = data().orders.filter((o) => includeUnpaid || o.status !== 'awaiting_payment');
    if (status) list = list.filter((o) => o.status === status);
    if (since) list = list.filter((o) => o.payment.paidAt && o.payment.paidAt > since);
    return { orders: list.map(adminOrder).reverse(), statuses: ORDER_STATUSES };
  });

  route('PATCH', '/api/admin/orders/([\\w-]+)', ({ req, params, body }) => {
    requireAdmin(req);
    const o = data().orders.find((x) => x.id === params[0]);
    if (!o) throw new HttpError(404, 'Beställningen finns inte.');
    const next = body.status;
    if (!['paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].includes(next)) throw bad('Ogiltig status.');
    if (o.status === 'awaiting_payment') throw bad('Beställningen är inte betald.');
    if (o.status !== next) {
      o.status = next;
      o.history.push({ status: next, at: new Date(now()).toISOString() });
      db.save();
    }
    return { order: adminOrder(o) };
  });

  route('GET', '/api/admin/stats', ({ req }) => {
    requireAdmin(req);
    const today = localDate(now());
    const paid = data().orders.filter((o) => o.payment.paidAt && o.status !== 'cancelled');
    const rated = data().orders.filter((o) => o.rating).sort((a, b) => b.rating.at.localeCompare(a.rating.at));
    const s = data().stars;
    return {
      ordersToday: paid.filter((o) => localDate(Date.parse(o.payment.paidAt)) === today).length,
      revenueToday: paid.filter((o) => localDate(Date.parse(o.payment.paidAt)) === today).reduce((a, o) => a + o.total, 0),
      revenueTotal: paid.reduce((a, o) => a + o.total, 0),
      toDeliver: paid.filter((o) => ['paid', 'preparing', 'out_for_delivery'].includes(o.status)).length,
      deliverToday: paid.filter((o) => o.delivery.date === today && o.status !== 'delivered').length,
      customers: data().users.length,
      plusMembers: data().users.filter((u) => plusActive(u, now())).length,
      stars: {
        balance: s.received - s.spent, received: s.received, spent: s.spent, ratings: s.ratings,
        average: s.ratings ? Math.round((s.received / s.ratings) * 10) / 10 : null,
      },
      recentRatings: rated.slice(0, 8).map((o) => ({
        number: o.number, name: o.customer.name, stars: o.rating.stars, comment: o.rating.comment, at: o.rating.at,
      })),
      pushDevices: data().devices.length,
      pushConfigured: !!apns,
    };
  });

  route('GET', '/api/admin/discounts', ({ req }) => {
    requireAdmin(req);
    return {
      discounts: data().discounts.filter((d) => d.source === 'admin').map((d) => ({ ...d, label: describeDiscount(d) })).reverse(),
      rewardCodes: data().discounts.filter((d) => d.source === 'reward').length,
    };
  });

  route('POST', '/api/admin/discounts/cost', ({ req, body }) => {
    requireAdmin(req);
    return { cost: starCost(body.type, Number(body.value)) };
  });

  route('POST', '/api/admin/discounts', ({ req, body }) => {
    requireAdmin(req);
    const type = body.type;
    const value = type === 'free_delivery' ? 0 : Math.round(Number(body.value));
    const limits = { percent: [1, 90], amount: [1, 5000], free_bouquet: [1, 1000], free_delivery: [0, 0] };
    if (!limits[type]) throw bad('Välj typ av rabatt.');
    if (!(value >= limits[type][0] && value <= limits[type][1])) throw bad(`Värdet måste vara ${limits[type][0]}–${limits[type][1]}.`);
    const code = normalizeCode(body.code) || randomCode('JOMNI');
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) throw bad('Koden får bara innehålla A–Z, 0–9 och bindestreck (3–24 tecken).');
    if (data().discounts.some((d) => d.code === code)) throw bad('Koden finns redan.');
    const maxUses = body.maxUses ? Math.round(Number(body.maxUses)) : null;
    if (maxUses != null && !(maxUses >= 1 && maxUses <= 100000)) throw bad('Ogiltigt antal användningar.');
    let expiresAt = null;
    if (body.expiresAt) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expiresAt)) throw bad('Ogiltigt datum.');
      expiresAt = new Date(localToUtc(addDays(body.expiresAt, 1), 0) - 1).toISOString();
    }
    const cost = starCost(type, value);
    const s = data().stars;
    if (s.received - s.spent < cost) throw bad(`Rabatten kostar ${cost} ⭐ men du har ${s.received - s.spent} ⭐.`);
    s.spent += cost;
    const d = {
      code, type, value, maxUses, uses: 0, expiresAt, source: 'admin', starCost: cost, createdAt: new Date(now()).toISOString(),
    };
    data().discounts.push(d);
    db.save();
    return { discount: { ...d, label: describeDiscount(d) }, stars: { balance: s.received - s.spent } };
  });

  route('DELETE', '/api/admin/discounts/([\\w-]+)', ({ req, params }) => {
    requireAdmin(req);
    const d = data().discounts.find((x) => x.code === params[0] && x.source === 'admin' && !x.disabled);
    if (!d) throw new HttpError(404, 'Koden finns inte.');
    d.disabled = true;
    // Oanvända koder ger tillbaka sina stjärnor.
    const refunded = d.uses === 0 ? d.starCost : 0;
    data().stars.spent -= refunded;
    db.save();
    return { ok: true, refunded };
  });

  route('POST', '/api/admin/devices', ({ req, body }) => {
    requireAdmin(req);
    const token = String(body.token || '');
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) throw bad('Ogiltig enhetstoken.');
    const envName = body.env === 'production' ? 'production' : 'sandbox';
    data().devices = data().devices.filter((d) => d.token !== token);
    data().devices.push({ token, env: envName, at: new Date(now()).toISOString() });
    db.save();
    return { ok: true };
  });

  // ---------------------------------------------------------------- http
  function send(res, status, obj, headers = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  }

  function serveStatic(req, res, pathname) {
    if (!webRoot) return false;
    let rel = decodeURIComponent(pathname);
    if (rel === '/') rel = '/index.html';
    if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
    const file = path.normalize(path.join(webRoot, rel));
    if (!file.startsWith(path.resolve(webRoot) + path.sep)) return false;
    const hidden = rel.split('/').some((seg) => seg.startsWith('.') && seg !== '.well-known');
    if (hidden) return false;
    let stat;
    try { stat = fs.statSync(file); } catch { return false; }
    if (!stat.isFile()) return false;
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || MIME[''],
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      ...(ext === '.html' ? { 'Content-Security-Policy': CSP } : {}),
    });
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
    return true;
  }

  async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const url = new URL(req.url, 'http://x');
    try {
      if (!url.pathname.startsWith('/api/')) {
        if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, url.pathname)) return;
        throw new HttpError(404, 'Sidan finns inte.');
      }
      let match = null;
      let allowed = false;
      for (const r of routes) {
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        allowed = true;
        if (r.method === req.method) { match = { r, params: m.slice(1) }; break; }
      }
      if (!match) throw new HttpError(allowed ? 405 : 404, allowed ? 'Metoden stöds inte.' : 'Finns inte.');

      let raw = '';
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 100_000) throw new HttpError(413, 'För stor förfrågan.');
          chunks.push(chunk);
        }
        raw = Buffer.concat(chunks).toString('utf8');
      }
      let body = {};
      if (raw && !url.pathname.startsWith('/api/stripe/')) {
        try { body = JSON.parse(raw) || {}; } catch { throw bad('Ogiltig JSON.'); }
      }
      const result = await match.r.fn({ req, res, body, raw, params: match.params, query: url.searchParams });
      send(res, 200, result);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      if (e.status && e.message && e.status < 500) return send(res, 502, { error: `Betalningen misslyckades: ${e.message}` });
      log.error(e);
      return send(res, 500, { error: 'Något gick fel. Försök igen.' });
    }
  }

  return { handler, tick, markPaid, demo };
}
