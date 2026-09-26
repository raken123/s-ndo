import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = new URL('../../data/rakenos-updates.json', import.meta.url);
const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const MONTH_DAYS = { 3: 31, 4: 30, 5: 31 };
const idx = (r) => (r.releaseMonth === 3 ? 0 : r.releaseMonth === 4 ? 31 : 61) + r.releaseDay;

test('contains all 177 releases from 1.0.0 to 59.0.2 in order', () => {
  const d = load();
  assert.equal(d.releases.length, 177);
  const expected = [];
  for (let m = 1; m <= 59; m++) for (const p of [0, 1, 2]) expected.push(`${m}.0.${p}`);
  assert.deepEqual(d.releases.map((r) => r.version), expected);
  assert.equal(d.firstVersion, '1.0.0');
  assert.equal(d.latestVersion, '59.0.2');
});

test('every release date is in spring and generations are chronological', () => {
  const d = load();
  for (const r of d.releases) {
    assert.ok([3, 4, 5].includes(r.releaseMonth), `${r.version} month ${r.releaseMonth}`);
    assert.ok(r.releaseDay >= 1 && r.releaseDay <= MONTH_DAYS[r.releaseMonth], `${r.version} day`);
    assert.match(r.releaseDate, /^(March|April|May) \d{1,2}$/);
  }
  for (let m = 1; m <= 59; m++) {
    const g = d.releases.filter((r) => r.major === m);
    assert.ok(idx(g[0]) < idx(g[1]) && idx(g[1]) < idx(g[2]), `RakenOS ${m} dates out of order`);
  }
  const days = new Set(d.releases.map((r) => r.releaseDay));
  assert.ok(days.size >= 20, 'days should vary');
  assert.ok(d.releases.filter((r) => r.releaseDay === 1).length < 6, 'not everything on the 1st');
});

test('release cycle: .0.0 major, .0.1 maintenance, .0.2 polish', () => {
  for (const r of load().releases) assert.equal(r.releaseType, ['major', 'maintenance', 'polish'][r.patch]);
});

test('release notes are detailed, specific and never repeated', () => {
  const d = load();
  const seen = new Set();
  const sectionTitles = new Set();
  for (const r of d.releases) {
    const items = r.sections.flatMap((s) => s.items);
    assert.ok(items.length >= 5, `${r.version} has only ${items.length} notes`);
    assert.ok(r.summary.length > 40, `${r.version} summary too short`);
    for (const s of r.sections) sectionTitles.add(s.title);
    for (const it of items) {
      assert.doesNotMatch(it, /bug fixes and improvements/i);
      assert.ok(!seen.has(it), `duplicate note: ${it}`);
      seen.add(it);
    }
  }
  for (const t of ['New', 'Home Screen', 'Lock Screen', 'Notifications', 'Control Center', 'Camera', 'Gallery', 'Files', 'Raken Store', 'Browser', 'Settings', 'Accessibility', 'Privacy', 'Security', 'Battery', 'Performance', 'Connectivity', 'System', 'Developer APIs', 'RAS Runtime', 'RScript', 'Bug Fixes']) {
    assert.ok(sectionTitles.has(t), `section ${t} never used`);
  }
});

test('RakenOS evolves: each generation introduces its own features', () => {
  const d = load();
  const titles = new Set(d.releases.filter((r) => r.patch === 0).map((r) => r.title));
  assert.equal(titles.size, 59);
  const r1 = d.releases[0];
  assert.equal(r1.title, 'Initial Release');
  assert.ok(r1.sections.some((s) => s.title === 'Raken Store'));
  const r40 = d.releases.find((r) => r.version === '40.0.0');
  assert.match(JSON.stringify(r40.sections), /RAS Runtime 4/);
  assert.ok(d.releases.find((r) => r.version === '12.0.0').components.rasApiLevel === 12);
});

test('staged rollout waves: same version for all groups, days differ, all in spring', () => {
  for (const r of load().releases) {
    const ph = r.rollout.phases;
    assert.deepEqual(ph.map((p) => p.group), ['A', 'B', 'C', 'D']);
    assert.equal(ph.reduce((a, p) => a + p.share, 0), 100);
    assert.equal(ph[0].offsetDays, 0);
    for (let i = 1; i < ph.length; i++) assert.ok(ph[i].offsetDays > ph[i - 1].offsetDays);
    for (const p of ph) assert.match(p.date, /^(March|April|May) \d+$/);
  }
});

test('regenerating keeps the stored release dates', () => {
  const before = load().releases.map((r) => `${r.version}:${r.releaseDate}`);
  execFileSync(process.execPath, [new URL('../../tools/generate-updates.js', import.meta.url).pathname], { stdio: 'pipe' });
  const after = load().releases.map((r) => `${r.version}:${r.releaseDate}`);
  assert.deepEqual(after, before);
});
