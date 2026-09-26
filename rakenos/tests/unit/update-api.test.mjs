import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createUpdateApi } from '../../update-system/api-core.js';
import { bucketFor, groupForBucket, RolloutIdentity, rolloutStatus } from '../../update-system/rollout.js';
import { MemoryStorage } from '../../update-system/storage.js';
import { compareVersions } from '../../update-system/version.js';

const dataset = JSON.parse(fs.readFileSync(new URL('../../data/rakenos-updates.json', import.meta.url), 'utf8'));
const api = createUpdateApi(dataset);
const DAY = 1000;

test('latest and release listing', () => {
  assert.equal(api.latest().version, '59.0.2');
  const page = api.releases({ limit: 3 });
  assert.equal(page.total, 177);
  assert.deepEqual(page.releases.map((r) => r.version), ['59.0.2', '59.0.1', '59.0.0']);
  assert.deepEqual(api.releases({ limit: 2, before: '2.0.0' }).releases.map((r) => r.version), ['1.0.2', '1.0.1']);
  assert.equal(api.release('12.0.1').name, 'RakenOS 12.0.1');
  assert.equal(api.release('99.0.0'), null);
});

test('check offers the next release in sequence', () => {
  const r = api.check({ currentVersion: '22.0.1', rolloutGroup: 'A', since: 0, now: 5, dayMs: DAY });
  assert.equal(r.updateAvailable, true);
  assert.equal(r.latestEligibleVersion, '22.0.2');
  assert.equal(r.rollout, 'available');
  const cross = api.check({ currentVersion: '22.0.2', rolloutGroup: 'A', since: 0, now: 5, dayMs: DAY });
  assert.equal(cross.latestEligibleVersion, '23.0.0');
});

test('staged rollout: later groups wait for their day', () => {
  const rel = api.release('18.0.1');
  const offD = rel.rollout.phases.find((p) => p.group === 'D').offsetDays;
  const pending = api.check({ currentVersion: '18.0.0', rolloutGroup: 'D', since: 0, now: (offD - 1) * DAY + 10, dayMs: DAY });
  assert.equal(pending.updateAvailable, false);
  assert.equal(pending.rollout, 'pending');
  assert.equal(pending.nextVersion, '18.0.1');
  assert.equal(pending.eligibleAt, offD * DAY);
  const ok = api.check({ currentVersion: '18.0.0', rolloutGroup: 'D', since: 0, now: offD * DAY, dayMs: DAY });
  assert.equal(ok.updateAvailable, true);
  assert.equal(ok.latestEligibleVersion, '18.0.1'); // same version for every group
});

test('up to date at 59.0.2, unknown versions rejected', () => {
  const r = api.check({ currentVersion: '59.0.2', rolloutGroup: 'B', since: 0, now: 1 });
  assert.equal(r.updateAvailable, false); assert.equal(r.rollout, 'none');
  assert.equal(api.check({ currentVersion: '0.9.0' }).error, 'unknown-version');
});

test('rollout identity is anonymous, stable and resettable', () => {
  const s = new MemoryStorage();
  const a = new RolloutIdentity(s); const b = new RolloutIdentity(s);
  assert.equal(a.id, b.id);
  assert.match(a.id, /^[0-9a-f]{32}$/);
  assert.ok(['A', 'B', 'C', 'D'].includes(a.group));
  const before = a.id; a.reset(); assert.notEqual(a.id, before);
});

test('rollout groups follow their shares', () => {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (let i = 0; i < 20000; i++) counts[groupForBucket(bucketFor(`device-${i}`))]++;
  const pct = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / 200)]));
  assert.ok(Math.abs(pct.A - 10) < 2 && Math.abs(pct.B - 25) < 2.5 && Math.abs(pct.C - 30) < 2.5 && Math.abs(pct.D - 35) < 2.5, JSON.stringify(pct));
});

test('rolloutStatus reports open groups', () => {
  const rel = api.release('5.0.0');
  const st = rolloutStatus(rel, 'C', 0, 0, DAY);
  assert.deepEqual(st.openGroups, ['A']);
  assert.equal(st.eligible, false);
});

test('version comparison', () => {
  assert.ok(compareVersions('10.0.0', '9.0.2') > 0);
  assert.ok(compareVersions('1.0.2', '1.0.10') < 0);
  assert.throws(() => compareVersions('1.0', '1.0.0'));
});
