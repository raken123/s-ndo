import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createApns } from './apns.js';
import { createDb } from './db.js';
import { createStripe } from './stripe.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Läs .env om den finns (enkla KEY=VALUE-rader).
const envFile = path.join(here, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const env = process.env;

const db = createDb(env.DATA_FILE || path.join(here, '..', 'data', 'db.json'));
const stripe = env.STRIPE_SECRET_KEY ? createStripe(env.STRIPE_SECRET_KEY) : null;
const apns = createApns({
  key: env.APNS_KEY || (env.APNS_KEY_FILE && fs.readFileSync(env.APNS_KEY_FILE, 'utf8')),
  keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID, bundleId: env.APNS_BUNDLE_ID || 'se.jomni.blommor',
});
const app = createApp({ db, env, stripe, apns, webRoot: path.join(here, '..', '..', 'web') });

setInterval(app.tick, 60_000).unref();
const port = Number(env.PORT || 8080);
http.createServer(app.handler).listen(port, () => {
  const mode = stripe ? 'Stripe (riktiga betalningar)' : app.demo ? 'DEMO (inga riktiga betalningar)' : 'betalning AV – sätt STRIPE_SECRET_KEY';
  console.log(`🌸 Jomni Blommor kör på http://localhost:${port}  ·  betalning: ${mode}  ·  push: ${apns ? 'på' : 'av'}`);
});
