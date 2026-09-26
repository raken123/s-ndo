import crypto from 'node:crypto';
import { LOYALTY, PRODUCTS, REWARDS } from './config.js';
import { deliveryFee } from './delivery.js';

export const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;

// Belopp i hela kronor. Rabattkoder skrivs alltid med versaler.
export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function findDiscount(db, code) {
  const c = normalizeCode(code);
  if (!c) return null;
  return db.data.discounts.find((d) => d.code === c) || null;
}

export function discountProblem(d, { userId, now = Date.now() }) {
  if (!d || d.disabled) return 'Rabattkoden finns inte.';
  if (d.expiresAt && Date.parse(d.expiresAt) < now) return 'Rabattkoden har gått ut.';
  if (d.maxUses != null && d.uses >= d.maxUses) return 'Rabattkoden är redan använd.';
  if (d.userId && d.userId !== userId) return 'Den här belöningskoden tillhör ett annat konto. Logga in för att använda den.';
  return null;
}

// Räknar fram en beställnings pris. Kastar aldrig; fel returneras i `error`.
export function priceCart(db, { items, discountCode, zone, userId, now = Date.now() }) {
  if (!Array.isArray(items) || !items.length) return { error: 'Varukorgen är tom.' };
  const merged = new Map();
  for (const it of items) {
    const p = productById(it && it.productId);
    const qty = Math.floor(Number(it && it.qty));
    if (!p) return { error: 'En bukett i varukorgen finns inte längre.' };
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) return { error: 'Ogiltigt antal.' };
    merged.set(p.id, (merged.get(p.id) || 0) + qty);
  }
  const lines = [...merged].map(([id, qty]) => {
    const p = productById(id);
    return { productId: id, name: p.name, price: p.price, qty, total: p.price * qty };
  });
  if (lines.reduce((s, l) => s + l.qty, 0) > 20) return { error: 'Max 20 buketter per beställning.' };
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  let fee = zone ? deliveryFee(zone, subtotal) : 0;
  let discount = null;
  let discountError = null;

  if (normalizeCode(discountCode)) {
    const d = findDiscount(db, discountCode);
    discountError = discountProblem(d, { userId, now });
    if (!discountError) {
      let amount = 0;
      if (d.type === 'percent') amount = Math.round((subtotal * d.value) / 100);
      else if (d.type === 'amount') amount = Math.min(d.value, subtotal);
      else if (d.type === 'free_bouquet') amount = Math.min(d.value, Math.max(...lines.map((l) => l.price)));
      else if (d.type === 'free_delivery') amount = 0;
      discount = { code: d.code, type: d.type, value: d.value, amount, label: describeDiscount(d) };
      if (d.type === 'free_delivery') { discount.amount = fee; fee = 0; }
    }
  }

  const productDiscount = discount && discount.type !== 'free_delivery' ? discount.amount : 0;
  const total = subtotal - productDiscount + fee;
  return { lines, subtotal, discount, discountError, deliveryFee: fee, total, productTotal: subtotal - productDiscount };
}

export function describeDiscount(d) {
  if (d.type === 'percent') return `${d.value} % rabatt`;
  if (d.type === 'amount') return `${d.value} kr rabatt`;
  if (d.type === 'free_delivery') return 'Gratis leverans';
  if (d.type === 'free_bouquet') return `Gratis bukett (upp till ${d.value} kr)`;
  return 'Rabatt';
}

export function randomCode(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}-${s}`;
}

// --- Mynt & diamanter ---------------------------------------------------------

export function plusActive(user, now = Date.now()) {
  return !!(user && user.plus && user.plus.active && Date.parse(user.plus.until) > now);
}

export function coinsForAmount(kr, plus) {
  const base = Math.max(0, Math.floor(kr)) * LOYALTY.milliCoinsPerKrona;
  return plus ? base * LOYALTY.plusMultiplier : base;
}

export function diamondsForCoins(milliCoins) {
  return milliCoins * LOYALTY.microDiamondsPerMilliCoin;
}

export const fmtCoins = (milli) => (milli / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 3 });
export const fmtDiamonds = (micro) => (micro / 1e6).toLocaleString('sv-SE', { maximumFractionDigits: 6 });

export function publicUser(user, db, now = Date.now()) {
  const rewards = db.data.discounts
    .filter((d) => d.userId === user.id && d.source === 'reward')
    .map((d) => ({ code: d.code, label: describeDiscount(d), used: d.maxUses != null && d.uses >= d.maxUses, createdAt: d.createdAt }))
    .reverse();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    coins: user.coins / 1000,
    milliCoins: user.coins,
    diamonds: user.diamonds / 1e6,
    microDiamonds: user.diamonds,
    plus: { active: plusActive(user, now), until: user.plus?.until || null, source: user.plus?.source || null,
      cancelAtPeriodEnd: !!user.plus?.cancelAtPeriodEnd },
    rewards,
  };
}

export const rewardById = (id) => REWARDS.find((r) => r.id === id) || null;
