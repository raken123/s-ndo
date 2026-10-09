// Tiny JSON-file database. Good enough for a single-node deployment;
// swap for Postgres/SQLite when you scale out.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.NEZOS_DATA_DIR || path.join(APP_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const ASSET_DIR = path.join(DATA_DIR, 'assets');

fs.mkdirSync(ASSET_DIR, { recursive: true });

const empty = () => ({ users: {}, sessions: {}, projects: {}, transactions: [] });

let state = empty();
if (fs.existsSync(DB_FILE)) {
  try {
    state = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } catch (err) {
    console.error('[db] could not parse db.json, starting empty:', err.message);
  }
}

let writeTimer = null;
function flush() {
  writeTimer = null;
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DB_FILE);
}

export function save() {
  if (!writeTimer) writeTimer = setTimeout(flush, 50);
}

export function flushNow() {
  if (writeTimer) clearTimeout(writeTimer);
  flush();
}

process.on('exit', () => { if (writeTimer) flush(); });

export const db = {
  get state() { return state; },
  id: (bytes = 12) => crypto.randomBytes(bytes).toString('base64url'),
};
