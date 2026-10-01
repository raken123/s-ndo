// Testar servern från början till slut: uppladdning → mejl via SMTP → filmsida → fil.
//   node test/run-tests.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startFakeSmtp } from './fake-smtp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-test-'));
const mailFile = path.join(tmp, 'mail.json');
const { server: smtp } = await startFakeSmtp(2525, mailFile);
const PORT = 8799;
const srv = spawn(process.execPath, [path.join(here, '..', 'server.mjs')], {
  env: {
    ...process.env, PORT: String(PORT), PUBLIC_URL: `http://localhost:${PORT}`, DATA_DIR: path.join(tmp, 'data'),
    API_KEY: 'nyckel', SMTP_HOST: 'localhost', SMTP_PORT: '2525', SMTP_REQUIRE_TLS: 'false',
    SMTP_USER: 'astro@tekniskamuseet.se', SMTP_PASS: 'hemligt', FFMPEG: process.env.FFMPEG ?? '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', (d) => process.stdout.write('  server: ' + d));
srv.stderr.on('data', (d) => process.stderr.write('  server: ' + d));
await new Promise((r) => setTimeout(r, 600));
const base = `http://localhost:${PORT}`;
const video = fs.existsSync(process.env.TEST_VIDEO || '') ? fs.readFileSync(process.env.TEST_VIDEO) : Buffer.alloc(50_000, 7);
const post = (headers, body = video) => fetch(`${base}/api/recordings`, { method: 'POST', headers: { 'Content-Type': 'video/webm', ...headers }, body });
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('✔', name); } catch (e) { failed++; console.log('✘', name, '\n   ', e.message); }
}

await test('CORS preflight', async () => {
  const r = await fetch(`${base}/api/recordings`, { method: 'OPTIONS', headers: { Origin: 'app://astro' } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get('access-control-allow-headers'), /X-Astro-Email/);
});
await test('fel API-nyckel nekas', async () => {
  const r = await post({ 'X-Astro-Email': 'a@b.se', 'X-Astro-Key': 'fel' });
  assert.equal(r.status, 401);
});
await test('ogiltig e-post nekas (även rubrikinjektion)', async () => {
  for (const e of ['inte-en-adress', 'a@b', 'x@y.se>\r\nBcc: z@q.se'.replace(/[\r\n]/g, ' ')]) {
    const r = await post({ 'X-Astro-Email': e, 'X-Astro-Key': 'nyckel' });
    assert.equal(r.status, 400, e);
  }
});
let id;
await test('uppladdning skickar mejl från astro@tekniskamuseet.se', async () => {
  const summary = encodeURIComponent(JSON.stringify({ visited: ['Månen', 'Mars'], stars: 9, distance: '1,2 miljoner km', minutes: 20 }));
  const r = await post({ 'X-Astro-Email': 'besokare@example.com', 'X-Astro-Key': 'nyckel', 'X-Astro-Lang': 'sv', 'X-Astro-Summary': summary });
  const body = await r.json();
  assert.equal(r.status, 201, JSON.stringify(body));
  id = body.id;
  const m = JSON.parse(fs.readFileSync(mailFile, 'utf8'));
  assert.equal(m.authed, true);
  assert.equal(m.from, '<astro@tekniskamuseet.se>');
  assert.deepEqual(m.to, ['<besokare@example.com>']);
  assert.match(m.data, /^From: =\?UTF-8\?B\?.+\?= <astro@tekniskamuseet\.se>/m);
  const parts = [...m.data.matchAll(/base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g)].map((x) => Buffer.from(x[1].replace(/\r\n/g, ''), 'base64').toString());
  assert.ok(parts[0].includes(`${base}/v/${id}`), 'länk i textdelen');
  assert.ok(parts[0].includes('Månen, Mars'), 'sammanfattning i mejlet');
  assert.ok(parts[1].includes('<a href='), 'html-del');
  const subj = /^Subject: =\?UTF-8\?B\?(.+)\?=/m.exec(m.data)[1];
  assert.equal(Buffer.from(subj, 'base64').toString(), 'Din rymdresa med Astro 🚀');
});
await test('filmsidan och filen går att hämta (med Range)', async () => {
  const page = await (await fetch(`${base}/v/${id}`)).text();
  assert.match(page, /<video/);
  const src = /src="\/files\/([^"]+)"/.exec(page)[1];
  const r = await fetch(`${base}/files/${src}`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
});
await test('ingen e-postadress sparas på disk', async () => {
  const dir = path.join(tmp, 'data');
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) assert.ok(!fs.readFileSync(path.join(dir, f), 'utf8').includes('besokare'), f);
  }
});
await test('okänd film ger 404 och sökvägar utanför datamappen nekas', async () => {
  assert.equal((await fetch(`${base}/v/000000000000000000000000`)).status, 404);
  assert.equal((await fetch(`${base}/files/..%2F..%2Fetc%2Fpasswd`)).status, 404);
});
await test('högst 5 mejl per adress och timme', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await post({ 'X-Astro-Email': 'samma@example.com', 'X-Astro-Key': 'nyckel' });
  assert.equal(last.status, 429);
});

if (process.env.FFMPEG) {
  await test('MP4-kopia skapas med ffmpeg', async () => {
    for (let i = 0; i < 60 && !fs.existsSync(path.join(tmp, 'data', `${id}.mp4`)); i++) await new Promise((r) => setTimeout(r, 500));
    assert.ok(fs.existsSync(path.join(tmp, 'data', `${id}.mp4`)));
    const page = await (await fetch(`${base}/v/${id}`)).text();
    assert.match(page, /\.mp4/);
  });
}

srv.kill();
smtp.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} test misslyckades` : '\nAlla tester gick igenom');
process.exit(failed ? 1 : 0);
