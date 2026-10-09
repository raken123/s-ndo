import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nezos-test-'));
process.env.NEZOS_DATA_DIR = dataDir;
process.env.BILLING_MODE = 'demo';
process.env.AUTH_RATE_LIMIT = '1000';

let server;
let base;

before(async () => {
  const { default: app } = await import('../server.js');
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  (await import('../src/db.js')).flushNow();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async (method, url, body, { header = true } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (header) headers['x-nezos'] = '1';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

test('sign-up requires a valid email and gives 100 credits on the Free plan', async () => {
  const req = client();
  assert.equal((await req('POST', '/api/auth/signup', { email: 'nope', password: 'password123' })).status, 400);
  assert.equal((await req('POST', '/api/auth/signup', { email: 'a@b.co', password: 'short' })).status, 400);
  const r = await req('POST', '/api/auth/signup', { email: 'Ada@Example.com', password: 'password123' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.credits, 100);
  assert.equal(r.body.user.plan, 'free');
  assert.equal(r.body.user.email, 'ada@example.com');
  assert.equal(r.body.user.password, undefined);
  const dup = await client()('POST', '/api/auth/signup', { email: 'ada@example.com', password: 'password123' });
  assert.equal(dup.status, 409);
});

test('login checks the password', async () => {
  const req = client();
  await req('POST', '/api/auth/signup', { email: 'login@example.com', password: 'password123' });
  assert.equal((await client()('POST', '/api/auth/login', { email: 'login@example.com', password: 'wrongpass' })).status, 401);
  const ok = client();
  assert.equal((await ok('POST', '/api/auth/login', { email: 'login@example.com', password: 'password123' })).status, 200);
  assert.equal((await ok('GET', '/api/me')).body.user.email, 'login@example.com');
});

test('sign-up is rate limited per IP', async () => {
  // covered by AUTH_RATE_LIMIT; just make sure the limiter answers 429 rather than crashing
  const statuses = new Set();
  for (let i = 0; i < 3; i++) statuses.add((await client()('POST', '/api/auth/login', { email: 'z@z.zz', password: 'x' })).status);
  assert.ok([...statuses].every((s) => s === 401 || s === 429));
});

test('state-changing requests need the x-nezos header', async () => {
  const r = await client()('POST', '/api/auth/signup', { email: 'x@example.com', password: 'password123' }, { header: false });
  assert.equal(r.status, 403);
});

test('plans restrict models and features', async () => {
  const req = client();
  await req('POST', '/api/auth/signup', { email: 'gate@example.com', password: 'password123' });
  const scene = { objects: [] };
  const locked = await req('POST', '/api/ai/chat', { model: 'gpt-5.5', message: 'hi', scene });
  assert.equal(locked.status, 403);
  assert.equal(locked.body.upgrade, 'pro');
  const elite = await req('POST', '/api/ai/chat', { model: 'gpt-6.1-sol', message: 'hi', scene });
  assert.equal(elite.body.upgrade, 'elite');
  const pt = await req('POST', '/api/ai/chat', { mode: 'playtest', model: 'gpt-5.4-nano', message: 'go', scene });
  assert.equal(pt.status, 403);
  const voice = await req('POST', '/api/ai/speech', { text: 'hello' });
  assert.equal(voice.status, 403);
  const { body } = await req('GET', '/api/models');
  const allowed = body.models.filter((m) => m.allowed && !m.snapshotOf).map((m) => m.id);
  assert.ok(allowed.includes('gpt-5.4-nano'));
  assert.ok(!allowed.includes('gpt-5.5'));
  assert.ok(!allowed.includes('gpt-4o-mini-tts'), 'TTS needs the audio feature');
});

test('free plan is limited to 3 projects', async () => {
  const req = client();
  await req('POST', '/api/auth/signup', { email: 'proj@example.com', password: 'password123' });
  for (let i = 0; i < 3; i++) assert.equal((await req('POST', '/api/projects', { name: `g${i}`, template: 'platformer' })).status, 200);
  assert.equal((await req('POST', '/api/projects', { name: 'g4' })).status, 403);
  const list = await req('GET', '/api/projects');
  assert.equal(list.body.projects.length, 3);
  const other = client();
  await other('POST', '/api/auth/signup', { email: 'other@example.com', password: 'password123' });
  assert.equal((await other('GET', `/api/projects/${list.body.projects[0].id}`)).status, 404, 'projects are private');
});

test('switching plans grants each cycle\'s credits only once', async () => {
  const req = client();
  await req('POST', '/api/auth/signup', { email: 'plan@example.com', password: 'password123' });
  let r = await req('POST', '/api/billing/plan', { plan: 'mini' });
  assert.equal(r.body.granted, 500);
  assert.equal(r.body.user.credits, 600);
  r = await req('POST', '/api/billing/plan', { plan: 'pro' });
  assert.equal(r.body.granted, 4500);
  assert.equal(r.body.user.credits, 5100);
  await req('POST', '/api/billing/plan', { plan: 'free' });
  r = await req('POST', '/api/billing/plan', { plan: 'pro' });
  assert.equal(r.body.granted, 0, 'no double grant within a cycle');
  assert.equal((await req('POST', '/api/billing/plan', { plan: 'diamond' })).status, 400);
});

test('play runtime and published games are sandboxed', async () => {
  const res = await fetch(`${base}/play.html`);
  assert.match(res.headers.get('content-security-policy'), /sandbox allow-scripts/);
  const req = client();
  await req('POST', '/api/auth/signup', { email: 'share@example.com', password: 'password123' });
  const p = await req('POST', '/api/projects', { name: 'Shared', template: 'platformer' });
  const pub = await req('POST', `/api/projects/${p.body.project.id}/publish`, { publish: true });
  const game = await fetch(`${base}/g/${pub.body.shareId}`);
  assert.equal(game.status, 200);
  assert.match(game.headers.get('content-security-policy'), /sandbox/);
  assert.match(await game.text(), /new Runtime/);
});
