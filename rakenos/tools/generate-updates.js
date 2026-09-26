#!/usr/bin/env node
'use strict';
/*
 * Generates data/rakenos-updates.json — the complete RakenOS release history
 * from 1.0.0 through 59.0.2 (177 releases).
 *
 * Release dates are drawn once from a seeded PRNG. When the dataset already
 * exists, the dates stored in it are kept, so the published history never
 * changes between runs. Pass --regenerate-dates to draw new dates.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'rakenos-updates.json');
const MAJORS = [
  ...require('./release-content/majors-01-19'),
  ...require('./release-content/majors-20-39'),
  ...require('./release-content/majors-40-59'),
];
const { subjectTemplates, pool, securityComponents, securityClasses } = require('./release-content/pools');

const FIRST_MAJOR = 1;
const LAST_MAJOR = 59;
const PATCHES = [0, 1, 2];

// Canonical section order used on release notes pages.
const SECTION_ORDER = [
  'New', 'Home Screen', 'Lock Screen', 'Notifications', 'Control Center', 'Camera', 'Gallery',
  'Files', 'Notes', 'Clock', 'Raken Store', 'Browser', 'Settings', 'Accessibility', 'Privacy',
  'Security', 'Battery', 'Performance', 'Connectivity', 'System', 'Developer APIs', 'RAS Runtime',
  'RScript', 'Bug Fixes',
];
const SECTION_ALIASES = { 'Notification Center': 'Notifications', 'RDesign': 'Developer APIs', 'Search': 'Home Screen' };

// ---------------------------------------------------------------- PRNG ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x52414B45); // "RAKE"
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// --------------------------------------------------------------- Dates ----
// Spring is modelled as day indexes: 0 = March 1 … 91 = May 31.
const MONTHS = [{ name: 'March', num: 3, days: 31 }, { name: 'April', num: 4, days: 30 }, { name: 'May', num: 5, days: 31 }];
function springIndexToDate(idx) {
  let i = idx;
  for (const m of MONTHS) { if (i < m.days) return { month: m.num, monthName: m.name, day: i + 1 }; i -= m.days; }
  // Only rollout waves may spill past May; releases never do (asserted below).
  return { month: 6, monthName: 'June', day: i + 1 };
}
function dateToSpringIndex(month, day) {
  let idx = 0;
  for (const m of MONTHS) { if (m.num === month) return idx + day - 1; idx += m.days; }
  throw new Error('Not a spring month: ' + month);
}
const MAY_25 = dateToSpringIndex(5, 25);

function drawGenerationDates() {
  const APR_1 = dateToSpringIndex(4, 1); const MAY_1 = dateToSpringIndex(5, 1);
  // .0.0 — the generation release: usually March, occasionally early April.
  const d0 = rand() < 0.85 ? randInt(2, 28) : randInt(APR_1, APR_1 + 8);
  // .0.1 — first maintenance release: usually April, sometimes early May.
  let lo1 = Math.max(d0 + 16, APR_1 + 1); let hi1 = APR_1 + 28;
  if (rand() < 0.15) { lo1 = Math.max(d0 + 16, MAY_1 + 1); hi1 = MAY_1 + 7; }
  const d1 = randInt(lo1, Math.max(lo1, hi1));
  // .0.2 — polish release: usually May, never later than May 25 so every
  // rollout wave also lands in spring.
  let lo2 = Math.max(d1 + 12, MAY_1 + 1); const hi2 = MAY_25;
  if (d1 + 12 < MAY_1 - 3 && rand() < 0.12) lo2 = d1 + 12; // occasionally late April
  const d2 = randInt(Math.min(lo2, hi2), hi2);
  return [d0, d1, d2];
}

// ------------------------------------------------------------- Helpers ----
function splitNote(s) {
  const i = s.indexOf('|');
  if (i < 0) throw new Error('Note without section: ' + s);
  const section = SECTION_ALIASES[s.slice(0, i)] || s.slice(0, i);
  if (!SECTION_ORDER.includes(section)) throw new Error('Unknown section "' + section + '" in: ' + s);
  return [section, s.slice(i + 1).trim()];
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function fillSubject(tpl, subject) {
  return tpl.replace('{S}', cap(subject)).replace('{s}', subject);
}
function inRange(entry, major) {
  const min = entry[2] || 1; const max = entry[3] || LAST_MAJOR;
  return major >= min && major <= max;
}

function rscriptFor(m) {
  const anchors = [[1, 1, 0], [9, 1, 8], [16, 1, 9], [21, 2, 0], [24, 2, 3], [30, 3, 0], [34, 3, 4], [40, 4, 0], [49, 5, 0], [55, 6, 0], [59, 6, 9]];
  let a = anchors[0]; let next = null;
  for (let i = 0; i < anchors.length; i++) { if (anchors[i][0] <= m) { a = anchors[i]; next = anchors[i + 1] || null; } }
  let minor = a[2] + (m - a[0]);
  if (next && next[1] === a[1]) minor = Math.min(minor, next[2] - 1);
  if (m === a[0]) minor = a[2];
  return `${a[1]}.${minor}`;
}
function rasRuntimeGenFor(m) { return m >= 55 ? 6 : m >= 50 ? 5 : m >= 40 ? 4 : m >= 25 ? 3 : m >= 16 ? 2 : 1; }
function storeGenFor(m) { return m >= 42 ? 3 : m >= 13 ? 2 : 1; }
function designGenFor(m) { return m >= 52 ? 3 : m >= 20 ? 2 : 1; }

// ------------------------------------------------------------ Security ----
const usedAdvisories = new Set();
function securityAdvisories(major, patch, count) {
  const out = [];
  const eligible = securityComponents.filter((c) => major >= c.min);
  let guard = 0; let serial = patch * 10 + 1;
  const usedHere = new Set();
  while (out.length < count && guard++ < 400) {
    const comp = pick(eligible);
    if (usedHere.has(comp.name)) continue;
    const impact = pick(comp.impacts);
    const klass = pick(securityClasses);
    const key = comp.name + '|' + impact + '|' + klass.name;
    if (usedAdvisories.has(key)) continue;
    usedAdvisories.add(key); usedHere.add(comp.name);
    const id = `RKSA-${String(major).padStart(2, '0')}-${String(serial++).padStart(3, '0')}`;
    out.push({ id, text: `${cap(klass.name)} in ${comp.name} could allow ${impact}. This was addressed ${pick(klass.fixes)}. (${id})` });
  }
  return out;
}

// ---------------------------------------------------------- Pool usage ----
const poolQueue = shuffle(pool);
const usedPool = new Set();
function takeFromPool(major, count, preferSections) {
  const out = [];
  const tryTake = (filter) => {
    for (const e of poolQueue) {
      if (out.length >= count) return;
      if (usedPool.has(e) || !inRange(e, major) || !filter(e)) continue;
      usedPool.add(e); out.push([e[0], e[1]]);
    }
  };
  if (preferSections && preferSections.length) tryTake((e) => preferSections.includes(e[0]));
  tryTake(() => true);
  return out;
}

const usedSubjectCombos = new Set();
function subjectNotes(major, kind, subjects, count) {
  // Each release uses distinct templates and distinct subjects.
  const templates = shuffle(subjectTemplates[kind].filter((t) => inRange(t, major)));
  const subs = shuffle(subjects);
  const out = [];
  let si = 0;
  for (const t of templates) {
    if (out.length >= count || si >= subs.length) break;
    const text = fillSubject(t[1], subs[si]);
    if (usedSubjectCombos.has(text)) continue;
    usedSubjectCombos.add(text); out.push([t[0], text]); si++;
  }
  return out;
}

function toSections(pairs) {
  const map = new Map();
  for (const [section, text] of pairs) {
    if (!map.has(section)) map.set(section, []);
    if (!map.get(section).includes(text)) map.get(section).push(text);
  }
  return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({ title: s, items: map.get(s) }));
}

function formatDate(d) { return `${d.monthName} ${d.day}`; }

// Summaries of maintenance releases describe what the release actually touches.
const phraseRand = mulberry32(0x53554D4D); // separate stream: phrasing never shifts dates or notes
const listJoin = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
function maintenanceSummary(base, sections, advisories, patch) {
  const areas = sections.map((x) => x.title).filter((t) => t !== 'Security' && t !== 'Bug Fixes');
  const pickP = (arr) => arr[Math.floor(phraseRand() * arr.length)];
  const lead = base.replace(/\.$/, '') + '.';
  const n = advisories.length;
  const shown = areas.slice(0, 3);
  let tail = shown.length ? `${pickP(['It also brings improvements to', 'This release also includes changes to', 'Other improvements cover', 'Further refinements affect'])} ${listJoin(shown)}.` : '';
  if (n) tail += ` ${pickP(['The update also resolves', 'In addition, it addresses', 'This update also fixes'])} ${n} security ${n === 1 ? 'issue' : 'issues'}.`;
  const rec = patch === 2 && n ? pickP([' Installing it is recommended for all users.', ' All users are encouraged to install it.', '']) : '';
  return `${lead} ${tail}${rec}`.trim();
}

// ---------------------------------------------------------------- Main ----
function main() {
  const regenerate = process.argv.includes('--regenerate-dates');
  let previousDates = new Map();
  if (!regenerate && fs.existsSync(OUT)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      for (const r of prev.releases || []) previousDates.set(r.version, { month: r.releaseMonth, day: r.releaseDay });
    } catch (e) { console.warn('Existing dataset unreadable, drawing new dates:', e.message); }
  }

  const byMajor = new Map(MAJORS.map((m) => [m.major, m]));
  const releases = [];
  let sequence = 0;
  let prevVersion = null;

  for (let major = FIRST_MAJOR; major <= LAST_MAJOR; major++) {
    const gen = byMajor.get(major);
    if (!gen) throw new Error('Missing authored content for RakenOS ' + major);
    const drawn = drawGenerationDates(); // always drawn so the PRNG stream stays stable

    for (const patch of PATCHES) {
      const version = `${major}.0.${patch}`;
      const kept = previousDates.get(version);
      const dayIndex = kept ? dateToSpringIndex(kept.month, kept.day) : drawn[patch];
      const date = springIndexToDate(dayIndex);

      let pairs; let summary; let title; let releaseType;
      if (patch === 0) {
        releaseType = 'major';
        title = gen.title;
        summary = gen.summary;
        pairs = gen.notes.map(splitNote);
        if (major > 1 && rand() < 0.35) pairs.push(...takeFromPool(major, 1, ['Bug Fixes']));
        if (major > 1) pairs.push(...securityAdvisories(major, 0, 1).map((a) => ['Security', a.text]));
      } else if (patch === 1) {
        releaseType = 'maintenance';
        title = 'Stability and corrections';
        summary = gen.s1;
        pairs = gen.f1.map(splitNote);
        pairs.push(...subjectNotes(major, 'stability', gen.subjects, randInt(2, 3)));
        pairs.push(...takeFromPool(major, 2));
        if (rand() < 0.55) pairs.push(...securityAdvisories(major, 1, 1).map((a) => ['Security', a.text]));
      } else {
        releaseType = 'polish';
        title = 'Security, polish and refinements';
        summary = gen.s2;
        pairs = gen.f2.map(splitNote);
        pairs.push(...subjectNotes(major, 'polish', gen.subjects, 2));
        pairs.push(...takeFromPool(major, 1));
        pairs.push(...securityAdvisories(major, 2, randInt(2, 3)).map((a) => ['Security', a.text]));
      }

      const sections = toSections(pairs);
      const advisories = [];
      for (const s of sections) if (s.title === 'Security') for (const it of s.items) { const m = it.match(/\((RKSA-\d+-\d+)\)$/); if (m) advisories.push(m[1]); }
      if (patch > 0) summary = maintenanceSummary(summary, sections, advisories, patch);

      // Staged rollout waves (days after publication).
      const waveB = randInt(1, 2); const waveC = waveB + randInt(1, 2); const waveD = Math.min(waveC + randInt(1, 3), 6);
      const rollout = {
        strategy: 'staged',
        phases: [
          { group: 'A', share: 10, offsetDays: 0 },
          { group: 'B', share: 25, offsetDays: waveB },
          { group: 'C', share: 30, offsetDays: waveC },
          { group: 'D', share: 35, offsetDays: waveD },
        ].map((p) => ({ ...p, date: formatDate(springIndexToDate(dayIndex + p.offsetDays)) })),
      };

      const components = {
        system: version,
        interface: `design-${designGenFor(major)}.${major}.${patch}`,
        rasRuntime: `${rasRuntimeGenFor(major)}.${major}.${patch}`,
        rasApiLevel: major,
        rscript: rscriptFor(major),
        store: `${storeGenFor(major)}.${major}.${patch}`,
      };
      const baseSize = patch === 0 ? randInt(620, 1380) : patch === 1 ? randInt(64, 230) : randInt(38, 175);
      const sizeFactor = major >= 58 ? 0.35 : major >= 50 ? 0.7 : 1;
      const payloadManifest = JSON.stringify({ version, sequence, components });
      const payload = {
        sizeBytes: Math.round(baseSize * sizeFactor * 1024 * 1024 + randInt(0, 1048575)),
        manifest: payloadManifest,
        sha256: crypto.createHash('sha256').update(payloadManifest).digest('hex'),
      };

      releases.push({
        version,
        name: `RakenOS ${version}`,
        sequence,
        major, minor: 0, patch,
        releaseType,
        title,
        releaseDate: formatDate(date),
        releaseMonth: date.month,
        releaseDay: date.day,
        springCycle: major,
        summary,
        highlights: (patch === 0 ? gen.notes.slice(0, 3) : (patch === 1 ? gen.f1 : gen.f2).slice(0, 2)).map((n) => splitNote(n)[1]),
        sections,
        security: { advisories, patchLevel: version },
        components,
        payload,
        rollout,
        requiresVersion: prevVersion,
        shellUpdate: null,
      });
      prevVersion = version;
      sequence++;
    }
  }

  // --------------------------------------------------------- Validation ----
  if (releases.length !== 177) throw new Error('Expected 177 releases, got ' + releases.length);
  const seen = new Map();
  for (const r of releases) {
    if (![3, 4, 5].includes(r.releaseMonth)) throw new Error(r.version + ' is not in spring');
    for (const s of r.sections) for (const it of s.items) {
      if (/bug fixes and improvements/i.test(it)) throw new Error('Generic note in ' + r.version);
      if (seen.has(it)) throw new Error(`Duplicate note in ${r.version} and ${seen.get(it)}: ${it}`);
      seen.set(it, r.version);
    }
  }
  for (let m = FIRST_MAJOR; m <= LAST_MAJOR; m++) {
    const g = releases.filter((r) => r.major === m);
    const idx = g.map((r) => dateToSpringIndex(r.releaseMonth, r.releaseDay));
    if (!(idx[0] < idx[1] && idx[1] < idx[2])) throw new Error('Dates out of order for RakenOS ' + m);
  }

  const dataset = {
    schema: 'rakenos.updates/1',
    product: 'RakenOS',
    channel: 'stable',
    firstVersion: releases[0].version,
    latestVersion: releases[releases.length - 1].version,
    releaseCount: releases.length,
    dateNote: 'Every RakenOS release is published in spring (March, April or May). Dates were drawn once and are fixed.',
    releases,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2) + '\n');
  const notes = releases.reduce((n, r) => n + r.sections.reduce((k, s) => k + s.items.length, 0), 0);
  console.log(`Wrote ${releases.length} releases (${notes} release note items) to ${path.relative(process.cwd(), OUT)}`);
  console.log(`Dates ${previousDates.size ? 'preserved from existing dataset' : 'drawn from seeded generator'}.`);
}

main();
