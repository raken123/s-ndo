import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UpdateEngine } from '../../update-system/update-engine.js';
import { LocalUpdateProvider } from '../../update-system/providers.js';
import { MemoryStorage } from '../../update-system/storage.js';

const dataset = JSON.parse(fs.readFileSync(new URL('../../data/rakenos-updates.json', import.meta.url), 'utf8'));
const groupA = { group: 'A' };
const waitFor = async (engine, status, ms = 15000) => {
  const t0 = Date.now();
  while (engine.state.status !== status) { if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${status}, at ${engine.state.status}`); await new Promise((r) => setTimeout(r, 50)); }
};

test('automatic update: check → download → verify → prepare → ready → install when locked', async () => {
  const storage = new MemoryStorage();
  const seen = [];
  const engine = new UpdateEngine({ provider: new LocalUpdateProvider(dataset, { downloadBytesPerSecond: 1e12 }), storage, rollout: groupA, timers: false });
  engine.on((t) => { if (t === 'state' && seen[seen.length - 1] !== engine.state.status) seen.push(engine.state.status); });
  assert.equal(engine.installedVersion, '1.0.0');
  await engine.check();
  await waitFor(engine, 'ready');
  assert.deepEqual(seen.slice(0, 6), ['checking', 'available', 'downloading', 'verifying', 'preparing', 'ready']);
  engine.setLocked(true); // "Install when ready"
  await waitFor(engine, 'updated');
  assert.equal(engine.installedVersion, '1.0.1');
  assert.equal(engine.system.components.rasApiLevel, 1);
  // Persisted across restarts
  const again = new UpdateEngine({ provider: new LocalUpdateProvider(dataset), storage, rollout: groupA, timers: false });
  assert.equal(again.installedVersion, '1.0.1');
});

test('manual mode: nothing downloads until asked', async () => {
  const engine = new UpdateEngine({ provider: new LocalUpdateProvider(dataset, { downloadBytesPerSecond: 1e12 }), storage: new MemoryStorage(), rollout: groupA, timers: false });
  engine.setSettings({ autoDownload: false, autoInstall: false });
  await engine.check();
  assert.equal(engine.state.status, 'available');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(engine.state.status, 'available');
});

test('a tampered payload is rejected during verification', async () => {
  const provider = new LocalUpdateProvider(dataset, { downloadBytesPerSecond: 1e12 });
  const real = provider.download.bind(provider);
  provider.download = async (v, o) => { const r = await real(v, o); r.bytes = new TextEncoder().encode('{"version":"1.0.1","tampered":true}'); return r; };
  const engine = new UpdateEngine({ provider, storage: new MemoryStorage(), rollout: groupA, timers: false });
  engine.setSettings({ autoDownload: false });
  await engine.check();
  await engine.download();
  assert.equal(engine.state.status, 'error');
  assert.match(engine.state.error, /Verification failed/);
  assert.equal(engine.installedVersion, '1.0.0');
});

test('rollout-pending for a late group', async () => {
  const engine = new UpdateEngine({ provider: new LocalUpdateProvider(dataset), storage: new MemoryStorage(), rollout: { group: 'D' }, timers: false });
  engine.setSettings({ rolloutDayMs: 3600000 });
  await engine.check();
  assert.equal(engine.state.status, 'rollout-pending');
  assert.equal(engine.state.target, '1.0.1');
  assert.ok(engine.state.lastCheck.eligibleAt > Date.now());
});
