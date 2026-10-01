// Astro-servern: tar emot inspelningen av en besökares rymdresa och mejlar en länk
// till filmen från astro@tekniskamuseet.se.
//
//  POST /api/recordings      spelet laddar upp filmen (video/webm) + e-postadress i rubriker
//  GET  /v/<id>              sida där besökaren tittar på/laddar ner sin film
//  GET  /files/<id>.<ext>    själva filmen (stöder Range för uppspelning)
//  GET  /health              status
//
// E-postadresser sparas aldrig – de används bara för att skicka mejlet.
// Filmer raderas automatiskt efter RETENTION_DAYS dagar.
// Inställningar via miljövariabler (se .env.example). Inga npm-beroenden.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sendMail, buildMessage } from './smtp.mjs';
import { emailText, emailHtml, videoPage, notFoundPage } from './templates.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(here, '.env'));

const env = process.env;
const CFG = {
  port: +(env.PORT || 8787),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/$/, ''),
  dataDir: path.resolve(here, env.DATA_DIR || 'data'),
  apiKey: env.API_KEY || '',
  retentionDays: +(env.RETENTION_DAYS || 30),
  maxBytes: +(env.MAX_UPLOAD_MB || 600) * 1024 * 1024,
  allowOrigin: env.ALLOWED_ORIGINS || '*',
  ffmpeg: env.FFMPEG === undefined ? 'ffmpeg' : env.FFMPEG,
  mailFrom: env.MAIL_FROM || 'astro@tekniskamuseet.se',
  mailFromName: env.MAIL_FROM_NAME || 'Astro – Tekniska museet',
  replyTo: env.MAIL_REPLY_TO || '',
  smtp: {
    host: env.SMTP_HOST || '',
    port: +(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true' || env.SMTP_PORT === '465',
    requireTLS: env.SMTP_REQUIRE_TLS !== 'false',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    heloName: env.SMTP_HELO || '',
  },
};

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
const ID_RE = /^[a-z0-9]{24}$/;
const TYPES = { webm: 'video/webm', mp4: 'video/mp4' };

await fsp.mkdir(CFG.dataDir, { recursive: true });

// Enkel spärr mot missbruk: högst 5 mejl per adress och timme, 60 uppladdningar per IP och timme.
const recent = new Map();
function limited(key, max) {
  const now = Date.now();
  const list = (recent.get(key) || []).filter((t) => now - t < 3600_000);
  if (list.length >= max) { recent.set(key, list); return true; }
  list.push(now);
  recent.set(key, list);
  return false;
}
const hashEmail = (e) => crypto.createHash('sha256').update(e.toLowerCase()).digest('hex');
const maskEmail = (e) => e.replace(/^(.).*(@.*)$/, '$1***$2');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', CFG.allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Astro-Email, X-Astro-Lang, X-Astro-Summary, X-Astro-Key');
  res.setHeader('Access-Control-Max-Age', '600');
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

async function handleUpload(req, res) {
  if (CFG.apiKey) {
    const key = String(req.headers['x-astro-key'] || '');
    const a = Buffer.from(key), b = Buffer.from(CFG.apiKey);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 401, { error: 'unauthorized' });
  }
  const email = String(req.headers['x-astro-email'] || '').trim();
  if (email.length > 254 || !EMAIL_RE.test(email)) return json(res, 400, { error: 'invalid email' });
  const lang = req.headers['x-astro-lang'] === 'en' ? 'en' : 'sv';
  let summary = {};
  try { summary = JSON.parse(decodeURIComponent(String(req.headers['x-astro-summary'] || '%7B%7D'))); } catch { /* valfritt */ }
  summary = {
    visited: Array.isArray(summary.visited) ? summary.visited.slice(0, 20).map((s) => String(s).slice(0, 40)) : [],
    stars: Number.isFinite(+summary.stars) ? Math.max(0, Math.min(999, +summary.stars)) : 0,
    distance: String(summary.distance || '').slice(0, 40),
    minutes: Number.isFinite(+summary.minutes) ? +summary.minutes : 20,
  };
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  if (!type.startsWith('video/')) return json(res, 415, { error: 'video expected' });
  const ip = req.socket.remoteAddress || '';
  if (limited('ip:' + ip, 60) || limited('mail:' + hashEmail(email), 5)) return json(res, 429, { error: 'too many requests' });

  const id = crypto.randomBytes(12).toString('hex'); // 24 tecken, svår att gissa
  const file = path.join(CFG.dataDir, `${id}.${ext}`);
  let size = 0;
  const ok = await new Promise((resolve) => {
    const out = fs.createWriteStream(file);
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > CFG.maxBytes) { req.destroy(); out.destroy(); resolve(false); }
    });
    req.pipe(out);
    out.on('finish', () => resolve(true));
    out.on('error', () => resolve(false));
    req.on('aborted', () => resolve(false));
  });
  if (!ok || size < 1000) {
    await fsp.rm(file, { force: true });
    if (!res.headersSent) json(res, size > CFG.maxBytes ? 413 : 400, { error: 'upload failed' });
    return;
  }
  const meta = { id, created: Date.now(), lang, summary, original: `${id}.${ext}`, mp4: ext === 'mp4' ? `${id}.mp4` : null, bytes: size };
  await fsp.writeFile(path.join(CFG.dataDir, `${id}.json`), JSON.stringify(meta));

  const link = `${CFG.publicUrl}/v/${id}`;
  try {
    await deliver(email, lang, summary, link);
  } catch (e) {
    console.error(`[astro] mejl till ${maskEmail(email)} misslyckades:`, e.message);
    return json(res, 502, { error: 'mail failed' });
  }
  console.log(`[astro] inspelning ${id} (${(size / 1e6).toFixed(1)} MB) – länk mejlad till ${maskEmail(email)}`);
  json(res, 201, { ok: true, id });
  if (ext === 'webm') transcode(meta).catch((e) => console.warn('[astro] mp4-konvertering misslyckades:', e.message));
}

async function deliver(to, lang, summary, link) {
  const subject = lang === 'en' ? 'Your space journey with Astro 🚀' : 'Din rymdresa med Astro 🚀';
  const msg = {
    from: CFG.mailFrom, fromName: CFG.mailFromName, to, subject, replyTo: CFG.replyTo || undefined,
    text: emailText(lang, summary, link, CFG.retentionDays),
    html: emailHtml(lang, summary, link, CFG.retentionDays),
  };
  if (!CFG.smtp.host) {
    // Utvecklingsläge: spara mejlet som .eml-fil i stället för att skicka det.
    const dir = path.join(CFG.dataDir, 'outbox');
    await fsp.mkdir(dir, { recursive: true });
    const f = path.join(dir, `${Date.now()}.eml`);
    await fsp.writeFile(f, buildMessage(msg));
    console.log(`[astro] SMTP_HOST saknas – mejlet sparades i ${f}`);
    return;
  }
  await sendMail(CFG.smtp, msg);
}

// Gör en MP4-kopia (H.264) så att filmen spelas på alla telefoner, även iPhone.
function transcode(meta) {
  if (!CFG.ffmpeg) return Promise.resolve();
  const src = path.join(CFG.dataDir, meta.original);
  const dst = path.join(CFG.dataDir, `${meta.id}.mp4`);
  const tmp = dst + '.part.mp4';
  return new Promise((resolve, reject) => {
    const p = spawn(CFG.ffmpeg, ['-y', '-loglevel', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => reject(e));
    p.on('close', async (code) => {
      if (code !== 0) { await fsp.rm(tmp, { force: true }); reject(new Error(err.slice(-300) || `kod ${code}`)); return; }
      await fsp.rename(tmp, dst);
      meta.mp4 = `${meta.id}.mp4`;
      await fsp.writeFile(path.join(CFG.dataDir, `${meta.id}.json`), JSON.stringify(meta));
      resolve();
    });
  });
}

async function readMeta(id) {
  if (!ID_RE.test(id)) return null;
  try { return JSON.parse(await fsp.readFile(path.join(CFG.dataDir, `${id}.json`), 'utf8')); } catch { return null; }
}

async function serveFile(req, res, name) {
  const m = /^([a-z0-9]{24})\.(webm|mp4)$/.exec(name);
  if (!m) return notFound(res);
  const file = path.join(CFG.dataDir, name);
  let st;
  try { st = await fsp.stat(file); } catch { return notFound(res); }
  const headers = { 'Content-Type': TYPES[m[2]], 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  if (new URL(req.url, 'http://x').searchParams.has('download')) headers['Content-Disposition'] = `attachment; filename="Astro-rymdresa.${m[2]}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] ? +range[1] : st.size - +range[2];
    let end = range[1] && range[2] ? +range[2] : st.size - 1;
    if (!range[1]) end = st.size - 1;
    if (start < 0 || start >= st.size || end < start) {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}` });
      return res.end();
    }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function notFound(res, lang = 'sv') {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(notFoundPage(lang));
}

// Rensa filmer äldre än RETENTION_DAYS (körs varje timme).
async function cleanup() {
  const limit = Date.now() - CFG.retentionDays * 86400_000;
  for (const f of await fsp.readdir(CFG.dataDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(CFG.dataDir, f), 'utf8'));
      if (meta.created < limit) {
        for (const x of [meta.original, meta.mp4, f]) if (x) await fsp.rm(path.join(CFG.dataDir, x), { force: true });
        console.log(`[astro] raderade gammal inspelning ${meta.id}`);
      }
    } catch { /* hoppa över trasiga filer */ }
  }
}
setInterval(() => cleanup().catch(() => {}), 3600_000).unref();
cleanup().catch(() => {});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname.startsWith('/api/')) cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'POST' && url.pathname === '/api/recordings') return await handleUpload(req, res);
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, smtp: !!CFG.smtp.host, ffmpeg: !!CFG.ffmpeg });
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/files/')) return await serveFile(req, res, url.pathname.slice(7));
    if (req.method === 'GET' && url.pathname.startsWith('/v/')) {
      const meta = await readMeta(url.pathname.slice(3));
      if (!meta) return notFound(res);
      const lang = url.searchParams.get('lang') === 'en' ? 'en' : url.searchParams.get('lang') === 'sv' ? 'sv' : meta.lang;
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:",
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex',
      });
      return res.end(videoPage(lang, meta, CFG.retentionDays));
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Astro – Tekniska museet\n');
    }
    notFound(res);
  } catch (e) {
    console.error('[astro] fel:', e);
    if (!res.headersSent) json(res, 500, { error: 'server error' });
    else res.end();
  }
});
server.requestTimeout = 20 * 60 * 1000;
server.listen(CFG.port, () => {
  console.log(`[astro] lyssnar på port ${CFG.port} – länkar: ${CFG.publicUrl}/v/<id>`);
  console.log(`[astro] avsändare: ${CFG.mailFromName} <${CFG.mailFrom}> – SMTP: ${CFG.smtp.host || '(av – mejl sparas i data/outbox)'}`);
});

function loadDotEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* ingen .env-fil */ }
}
