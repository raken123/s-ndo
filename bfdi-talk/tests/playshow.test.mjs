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

import { hostTurn, pcmChunksToWav, hostTurnPrompt } from '../www/js/playshow-script.js';

test('host turn: transcript + cast reactions, never lines for the host, one elimination', async () => {
  const contestants = cast.filter(c => !c.host);
  const fake = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
    heard: 'Starla, you are eliminated!',
    eliminated: 'Starla',
    lines: [L('Starla', 'Noooo!', { action: 'eliminated' }), L('Blocky', 'Ha.'), L('Ghost', 'boo'), L('Drip', 'Bye!'), L('Blocky', 'More.'), L('Drip', 'Too many lines.')],
  }) }] } }] }) });
  const r = await hostTurn({ showName: 'S', cast: contestants, limits: PS_LIMITS.pro, transcript: [], remaining: 30 }, 'UklGRg==', 'k', fake);
  assert.equal(r.heard, 'Starla, you are eliminated!');
  assert.equal(r.eliminated, 'Starla');
  assert.equal(r.lines.length, 4, 'max 4 lines per turn, unknown speakers dropped');
  const again = await hostTurn({ showName: 'S', cast: contestants, limits: PS_LIMITS.pro, transcript: [], remaining: 30, eliminatedSoFar: 'Starla' }, 'UklGRg==', 'k', fake);
  assert.equal(again.eliminated, '', 'only one elimination per episode');
  assert.ok(again.lines.every(l => l.action !== 'eliminated'));
});

test('host turn: silence gives no lines; prompt says when to wrap up', async () => {
  const silent = async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"heard":"","lines":[],"eliminated":""}' }] } }] }) });
  assert.deepEqual(await hostTurn({ showName: 'S', cast, limits: PS_LIMITS.free, transcript: [], remaining: 5 }, 'x', 'k', silent), { heard: '', lines: [], eliminated: '' });
  assert.match(hostTurnPrompt({ showName: 'S', cast, limits: PS_LIMITS.free, transcript: [], remaining: 3, final: true }), /LAST turn/);
  assert.match(hostTurnPrompt({ showName: 'S', cast, limits: PS_LIMITS.free, transcript: [], remaining: 3 }), /Nobody can be eliminated/);
});

test('mic PCM -> valid 16 kHz WAV', () => {
  const pcm = Buffer.alloc(3200).toString('base64'); // 0.1 s of silence
  const wav = Buffer.from(pcmChunksToWav([pcm, pcm]), 'base64');
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), 6400);
  assert.equal(wav.length, 44 + 6400);
});
