import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEpisode, buildPrompt, activeCast, PS_LIMITS, writeEpisode } from '../www/js/playshow-script.js';

const cast = [
  { name: 'Bouncy', body: 'ball', persona: 'cheerful', host: true },
  { name: 'Blocky', body: 'block', persona: 'smug' },
  { name: 'Drip', body: 'drop', persona: 'nervous' },
  { name: 'Starla', body: 'star', persona: 'dramatic' },
];
const L = (speaker, text, extra = {}) => ({ speaker, text, emotion: 'happy', action: 'none', ...extra });

test('drops unknown speakers, empty lines and stage directions; fixes bad emotions/actions', () => {
  const ep = sanitizeEpisode({ title: 'T', summary: 's', eliminated: '', scenes: [{ card: 'Go!', setting: 'Beach', lines: [
    L('Bouncy', '(waves) Welcome back!'), L('Nobody', 'hi'), L('Drip', '   '), L('blocky', 'Easy.', { emotion: 'zany', action: 'moonwalk' }),
  ] }] }, cast, PS_LIMITS.pro);
  assert.deepEqual(ep.scenes[0].lines, [
    { speaker: 'Bouncy', text: 'Welcome back!', emotion: 'happy', action: 'none' },
    { speaker: 'Blocky', text: 'Easy.', emotion: 'neutral', action: 'none' },
  ]);
});

test('free plan: line and scene limits, no eliminations', () => {
  const lines = Array.from({ length: 30 }, (_, i) => L(i % 2 ? 'Blocky' : 'Drip', `Line ${i}`));
  lines[5].action = 'eliminated';
  const ep = sanitizeEpisode({ title: 'T', summary: '', eliminated: 'Drip', scenes: [{ card: 'a', setting: '', lines }, { card: 'b', setting: '', lines }, { card: 'c', setting: '', lines }] }, cast, PS_LIMITS.free);
  assert.equal(ep.scenes.reduce((n, s) => n + s.lines.length, 0), 10);
  assert.ok(ep.scenes.length <= 2);
  assert.equal(ep.eliminated, '');
  assert.ok(ep.scenes.every(s => s.lines.every(l => l.action !== 'eliminated')));
});

test('pro: one elimination max, never the host; "eliminated" name gets the goodbye action', () => {
  const ep = sanitizeEpisode({ title: 'T', summary: '', eliminated: 'Starla', scenes: [{ card: 'End', setting: '', lines: [
    L('Bouncy', 'Bye me?', { action: 'eliminated' }), L('Starla', 'Noooo!'), L('Blocky', 'Ha.'),
  ] }] }, cast, PS_LIMITS.pro);
  assert.equal(ep.eliminated, 'Starla');
  assert.equal(ep.scenes[0].lines[0].action, 'none', 'host is never eliminated');
  assert.equal(ep.scenes[0].lines[1].action, 'eliminated');
});

test('empty episodes throw', () => {
  assert.throws(() => sanitizeEpisode({ scenes: [{ lines: [L('Ghost', 'boo')] }] }, cast, PS_LIMITS.free));
});

test('prompt: seasons skip eliminated objects and recap previous episodes (Lite/Pro only)', () => {
  const season = { eliminated: ['Drip'], episodes: [{ summary: 'Drip melted in the sun.' }] };
  const active = activeCast(cast, season);
  assert.deepEqual(active.map(c => c.name), ['Bouncy', 'Blocky', 'Starla']);
  const pro = buildPrompt({ showName: 'Battle for Spoons', cast: active, premise: 'a cake contest', limits: PS_LIMITS.pro, season });
  assert.match(pro, /episode 2 of "Battle for Spoons"/);
  assert.match(pro, /Already eliminated earlier this season.*Drip/);
  assert.match(pro, /Drip melted in the sun/);
  assert.match(pro, /a cake contest/);
  const free = buildPrompt({ showName: 'S', cast: active, limits: PS_LIMITS.free, season });
  assert.doesNotMatch(free, /Previously on/);
  assert.match(free, /Nobody is eliminated/);
});

test('writeEpisode falls back to the next model when one is overloaded', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url.match(/models\/([^:]+)/)[1]);
    if (calls.length === 1) return { ok: false, status: 503, json: async () => ({ error: { message: 'busy' } }) };
    const ep = { title: 'Ep', summary: 's', eliminated: '', scenes: [{ card: 'c', setting: 's', lines: [L('Blocky', 'Hi.')] }] };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(ep) }] } }] }) };
  };
  const ep = await writeEpisode({ showName: 'S', cast, limits: PS_LIMITS.free }, 'key', fake);
  assert.equal(ep.title, 'Ep');
  assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.5-flash']);
});
