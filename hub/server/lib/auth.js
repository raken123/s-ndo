'use strict';
const crypto = require('crypto');
const { STARTING_GEMS } = require('./catalog');

const NAME_RE = /^[a-z0-9_]{3,16}$/;
const ITER = 60000;

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256').toString('hex');
  return salt + ':' + h;
}
function verifyPassword(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const cand = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(cand, 'hex'), Buffer.from(h, 'hex'));
}

class Auth {
  constructor(db) { this.db = db; }

  register(name, password, displayName) {
    name = String(name || '').trim().toLowerCase();
    if (!NAME_RE.test(name)) throw err('Username must be 3-16 letters, digits or _');
    password = String(password || '');
    if (password.length < 6) throw err('Password must be at least 6 characters');
    if (this.db.data.names[name]) throw err('That username is taken');
    const id = this.db.nextId('u');
    const user = {
      id, name, displayName: clean(displayName, 24) || name,
      pass: hashPassword(password),
      gems: STARTING_GEMS,
      created: Date.now(),
      avatar: { color: 'c_blue', hat: 'h_none', trail: 't_none' },
      owned: { items: ['c_blue', 'c_green', 'h_none', 't_none'], passes: [] },
      stats: { wins: 0, rounds: 0, earned: 0, passesSold: 0 },
      friends: [], requestsIn: [], requestsOut: [],
      likes: [],
      lastDaily: 0,
      ledger: [{ ts: Date.now(), type: 'welcome', amount: STARTING_GEMS, note: 'Welcome bonus' }],
    };
    this.db.data.users[id] = user;
    this.db.data.names[name] = id;
    this.db.save();
    return user;
  }

  login(name, password) {
    name = String(name || '').trim().toLowerCase();
    const id = this.db.data.names[name];
    const user = id && this.db.data.users[id];
    if (!user || !verifyPassword(String(password || ''), user.pass)) throw err('Wrong username or password');
    return user;
  }

  createSession(user) {
    const token = crypto.randomBytes(24).toString('base64url');
    this.db.data.sessions[token] = { userId: user.id, created: Date.now(), last: Date.now() };
    this.db.save();
    return token;
  }

  resume(token) {
    const s = this.db.data.sessions[String(token || '')];
    if (!s) throw err('Session expired, please sign in again', 'unauthorized');
    s.last = Date.now();
    const user = this.db.data.users[s.userId];
    if (!user) throw err('Account no longer exists', 'unauthorized');
    return user;
  }

  logout(token) { delete this.db.data.sessions[token]; this.db.save(); }
}

function clean(s, max) {
  return String(s || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);
}
function err(msg, code) { const e = new Error(msg); e.userFacing = true; e.code = code || 'bad_request'; return e; }

module.exports = { Auth, clean, err, NAME_RE };
