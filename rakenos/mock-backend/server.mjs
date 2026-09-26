#!/usr/bin/env node
/*
 * RakenOS development backend.
 *
 * Update API (same logic as the in-app provider — update-system/api-core.js):
 *   GET  /api/os/latest
 *   GET  /api/os/releases?limit=&before=
 *   GET  /api/os/releases/:version
 *   GET  /api/os/releases/:version/payload       payload metadata (digest, size)
 *   GET  /api/os/releases/:version/payload.bin   payload bytes
 *   GET  /api/os/check?currentVersion=&rolloutGroup=&since=&dayMs=
 * Store API:
 *   GET  /api/store/catalog
 *   GET  /store/packages/...                     RAS packages
 *   POST /api/studio/publish                     Developer Studio upload (validates signature)
 * Also serves the assembled RakenOS web build from app/www for browser previews.
 *
 *   node mock-backend/server.mjs [--port 8787] [--day-ms 60000]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUpdateApi } from '../update-system/api-core.js';
import { openRasPackage } from '../ras-runtime/ras-package.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const PORT = +arg('port', process.env.PORT || 8787);
const DEFAULT_DAY_MS = +arg('day-ms', 60000);

const dataset = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'rakenos-updates.json'), 'utf8'));
const api = createUpdateApi(dataset);
const catalogPath = path.join(ROOT, 'store', 'catalog.json');
const published = [];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ras': 'application/vnd.raken.ras', '.txt': 'text/plain; charset=utf-8' };

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function serveFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache', 'Content-Length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function body(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    // ---- Update API
    if (p === '/api/os/latest') return send(res, 200, api.latest());
    if (p === '/api/os/releases') return send(res, 200, api.releases({ limit: +url.searchParams.get('limit') || undefined, before: url.searchParams.get('before') || undefined }));
    let m = /^\/api\/os\/releases\/(\d+\.\d+\.\d+)(\/payload(\.bin)?)?$/.exec(p);
    if (m) {
      if (!m[2]) { const r = api.release(m[1]); return r ? send(res, 200, r) : send(res, 404, { error: 'not-found' }); }
      const pl = api.payload(m[1]);
      if (!pl) return send(res, 404, { error: 'not-found' });
      if (!m[3]) return send(res, 200, { version: pl.version, sha256: pl.sha256, sizeBytes: pl.sizeBytes });
      return send(res, 200, Buffer.from(pl.manifest), { 'Content-Type': 'application/octet-stream', 'X-RakenOS-Payload-Size': String(pl.sizeBytes), 'Access-Control-Expose-Headers': 'X-RakenOS-Payload-Size' });
    }
    if (p === '/api/os/check') {
      const q = url.searchParams;
      if (!q.get('currentVersion')) return send(res, 400, { error: 'currentVersion is required' });
      const group = (q.get('rolloutGroup') || 'D').toUpperCase();
      if (!/^[A-D]$/.test(group)) return send(res, 400, { error: 'rolloutGroup must be A–D' });
      return send(res, 200, api.check({ currentVersion: q.get('currentVersion'), rolloutGroup: group, since: +q.get('since') || Date.now(), dayMs: +q.get('dayMs') || DEFAULT_DAY_MS }));
    }
    // ---- Store API
    if (p === '/api/store/catalog') return send(res, 200, JSON.parse(fs.readFileSync(catalogPath, 'utf8')));
    if (p.startsWith('/store/packages/')) { const f = path.join(ROOT, 'store', path.normalize(p.slice(7)).replace(/^(\.\.[/\\])+/, '')); if (serveFile(res, f)) return; return send(res, 404, { error: 'not-found' }); }
    if (p === '/api/studio/publish' && req.method === 'POST') {
      const bytes = new Uint8Array(await body(req));
      const trustedKeys = JSON.parse(fs.readFileSync(path.join(ROOT, 'ras-runtime', 'trusted-keys.json'), 'utf8'));
      try {
        const pkg = await openRasPackage(bytes, { trustedKeys });
        published.push({ id: pkg.manifest.id, version: pkg.manifest.version, at: Date.now() });
        return send(res, 201, { status: 'accepted', id: pkg.manifest.id, version: pkg.manifest.version, publisher: pkg.signature.publisher, review: 'queued' });
      } catch (e) { return send(res, 422, { status: 'rejected', error: e.message, details: e.details || [] }); }
    }
    if (p === '/api/health') return send(res, 200, { ok: true, releases: dataset.releases.length, published: published.length });
    // ---- Static RakenOS web build
    if (req.method === 'GET') {
      const www = path.join(ROOT, 'app', 'www');
      if (p === '/cordova.js') return send(res, 200, '/* Browser preview: Cordova is not present. */', { 'Content-Type': 'text/javascript' });
      const f = path.join(www, path.normalize(p === '/' ? '/index.html' : p).replace(/^(\.\.[/\\])+/, ''));
      if (f.startsWith(www) && serveFile(res, f)) return;
    }
    send(res, 404, { error: 'not-found' });
  } catch (e) {
    console.error(e); send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`RakenOS mock backend on http://localhost:${PORT} (rollout day = ${DEFAULT_DAY_MS} ms)`));
