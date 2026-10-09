import crypto from 'node:crypto';
import { db, save } from './db.js';
import { SIGNUP_CREDITS, planById } from './plans.js';

const SESSION_DAYS = 30;
const COOKIE = 'nezos_session';
const MONTH = 30 * 24 * 60 * 60 * 1000;

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function findUserByEmail(email) {
  const e = email.toLowerCase();
  return Object.values(db.state.users).find((u) => u.email === e) || null;
}

export function createUser({ email, password, name }) {
  const id = db.id();
  const now = Date.now();
  const user = {
    id,
    email: email.toLowerCase(),
    name: (name || email.split('@')[0]).slice(0, 60),
    password: hashPassword(password),
    plan: 'free',
    credits: SIGNUP_CREDITS,
    createdAt: now,
    nextRefillAt: now + MONTH,
    cycleGranted: 0,
  };
  db.state.users[id] = user;
  addTransaction(user, SIGNUP_CREDITS, 'Welcome bonus');
  save();
  return user;
}

export function checkLogin(email, password) {
  const user = findUserByEmail(email);
  // Always run scrypt so response timing doesn't reveal which emails exist.
  const ok = verifyPassword(password, user?.password || 'x:00');
  return ok ? user : null;
}

export function createSession(res, user, secure) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.state.sessions[sha(token)] = { userId: user.id, expires: Date.now() + SESSION_DAYS * 86400_000 };
  save();
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_DAYS * 86400_000,
    path: '/',
  });
}

export function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) { delete db.state.sessions[sha(token)]; save(); }
  res.clearCookie(COOKIE, { path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function currentUser(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const s = db.state.sessions[sha(token)];
  if (!s || s.expires < Date.now()) return null;
  const user = db.state.users[s.userId];
  if (user) applyRefill(user);
  return user || null;
}

// Middleware
export function attachUser(req, _res, next) {
  req.user = currentUser(req);
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  next();
}

// ------------------------------------------------------------- credits

export function addTransaction(user, amount, reason) {
  db.state.transactions.push({ id: db.id(8), userId: user.id, amount, reason, balance: user.credits, at: Date.now() });
  if (db.state.transactions.length > 50_000) db.state.transactions.splice(0, 10_000);
}

export function applyRefill(user) {
  const plan = planById(user.plan);
  let changed = false;
  while (Date.now() >= user.nextRefillAt) {
    user.nextRefillAt += MONTH;
    user.cycleGranted = 0;
    if (plan.monthlyCredits > 0) {
      user.credits += plan.monthlyCredits;
      user.cycleGranted = plan.monthlyCredits;
      addTransaction(user, plan.monthlyCredits, `${plan.name} monthly credits`);
    }
    changed = true;
  }
  if (changed) save();
}

export class CreditError extends Error {
  constructor(need, have) {
    super(`Not enough credits: this needs ${need}, you have ${have}. Upgrade your plan to get more.`);
    this.status = 402;
  }
}

export function charge(user, amount, reason) {
  if (amount <= 0) return () => {};
  if (user.credits < amount) throw new CreditError(amount, user.credits);
  user.credits -= amount;
  addTransaction(user, -amount, reason);
  save();
  let refunded = false;
  return function refund(why = 'Refund') {
    if (refunded) return;
    refunded = true;
    user.credits += amount;
    addTransaction(user, amount, `${why}: ${reason}`);
    save();
  };
}

/** Switch plan. Grants the new plan's monthly allowance minus what this cycle already granted. */
export function changePlan(user, planId) {
  const plan = planById(planId);
  if (plan.id !== planId) throw Object.assign(new Error('Unknown plan.'), { status: 400 });
  const grant = Math.max(0, plan.monthlyCredits - (user.cycleGranted || 0));
  user.plan = plan.id;
  if (grant > 0) {
    user.credits += grant;
    user.cycleGranted = (user.cycleGranted || 0) + grant;
    addTransaction(user, grant, `${plan.name} plan credits`);
  }
  save();
  return grant;
}

export function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}
