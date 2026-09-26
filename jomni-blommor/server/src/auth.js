import crypto from 'node:crypto';

const MAXMEM = 256 * 1024 * 1024;

// Format: scrypt$<log2N>$<salt b64>$<hash b64>
export function hashPassword(password, logN = 15) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 2 ** logN, r: 8, p: 1, maxmem: MAXMEM });
  return `scrypt$${logN}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const [kind, logN, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: 2 ** Number(logN), r: 8, p: 1, maxmem: MAXMEM,
  });
  return crypto.timingSafeEqual(expected, actual);
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function tokenKey(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function createSession(db, { kind, userId = null, ttlMs }) {
  const token = newToken();
  const now = Date.now();
  // Rensa utgångna sessioner samtidigt.
  for (const [k, s] of Object.entries(db.data.sessions)) if (s.exp < now) delete db.data.sessions[k];
  db.data.sessions[tokenKey(token)] = { kind, userId, exp: now + ttlMs };
  db.save();
  return token;
}

export function readSession(db, req) {
  const header = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return null;
  const s = db.data.sessions[tokenKey(m[1].trim())];
  if (!s || s.exp < Date.now()) return null;
  return s;
}

export function dropSession(db, req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (m) {
    delete db.data.sessions[tokenKey(m[1].trim())];
    db.save();
  }
}

// Enkel skydd mot gissning av lösenord: max `limit` misslyckade försök per nyckel och fönster.
export function createLimiter({ limit = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map();
  return {
    blocked(key) {
      const h = hits.get(key);
      if (!h) return false;
      if (Date.now() - h.first > windowMs) { hits.delete(key); return false; }
      return h.count >= limit;
    },
    fail(key) {
      const h = hits.get(key);
      if (!h || Date.now() - h.first > windowMs) hits.set(key, { first: Date.now(), count: 1 });
      else h.count += 1;
    },
    reset(key) { hits.delete(key); },
  };
}
