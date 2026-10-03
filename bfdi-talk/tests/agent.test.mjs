import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentKit, lookUp, AGENT_TOOLS } from '../www/js/agent.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
function kit(extra = {}) {
  const opened = [], copied = [];
  const k = new AgentKit({
    openExternal: u => opened.push(u), copy: async t => { copied.push(t); },
    startScreen: async () => 'screen on', stopScreen: () => {}, isPro: () => false, ...extra,
  }, mem());
  clearInterval(k.tick);
  return { k, opened, copied };
}

test('tool declarations are valid Live function declarations', () => {
  for (const t of AGENT_TOOLS) {
    assert.match(t.name, /^[a-z_]+$/);
    assert.equal(t.parameters.type, 'OBJECT');
    for (const r of t.parameters.required || []) assert.ok(t.parameters.properties[r], `${t.name}.${r}`);
  }
});

test('to-do list: add, complete by fuzzy text, remove, list', async () => {
  const { k } = kit();
  await k.run('add_task', { text: 'Buy milk' });
  await k.run('add_task', { text: 'Finish science homework' });
  assert.deepEqual(await k.run('complete_task', { text: 'homework' }), { completed: 'Finish science homework' });
  assert.deepEqual((await k.run('list_tasks', {})).tasks, ['[ ] Buy milk', '[x] Finish science homework']);
  assert.ok((await k.run('remove_task', { text: 'walk the dog' })).error);
  await k.run('remove_task', { text: 'milk' });
  assert.equal(k.state.tasks.length, 1);
});

test('timers fire once and can be cancelled', async () => {
  const { k } = kit();
  const fired = [];
  k.addEventListener('timerDone', e => fired.push(e.detail.label));
  assert.deepEqual(await k.run('set_timer', { seconds: 300, label: 'pizza' }), { started: 'pizza', duration: '5m 0s' });
  await k.run('set_timer', { seconds: 60, label: 'tea' });
  assert.ok((await k.run('set_timer', { seconds: 999999, label: 'x' })).error);
  await k.run('cancel_timer', { label: 'tea' });
  k.checkTimers(Date.now() + 301e3);
  k.checkTimers(Date.now() + 302e3);
  assert.deepEqual(fired, ['pizza']);
});

test('notes are saved and copied; websites must be valid; screen is Pro-only', async () => {
  const { k, opened, copied } = kit();
  assert.deepEqual(await k.run('write_note', { title: 'Party list', text: 'chips, cake' }), { saved: 'Party list', copied_to_clipboard: true });
  assert.equal(copied[0], 'Party list\n\nchips, cake');
  assert.deepEqual(await k.run('open_website', { url: 'youtube.com' }), { opened: 'https://youtube.com/' });
  await k.run('search_in_browser', { query: 'bfdi tpot 20' });
  assert.equal(opened[1], 'https://www.google.com/search?q=bfdi%20tpot%2020');
  assert.match((await k.run('look_at_screen', {})).error, /Pro/);
  const pro = kit({ isPro: () => true }).k;
  assert.deepEqual(await pro.run('look_at_screen', {}), { result: 'screen on' });
});

test('look_up on the real BFDI wiki finds Firey', { skip: !process.env.ONLINE }, async () => {
  const r = await lookUp('Firey', 'bfdi_wiki');
  assert.equal(r.found, true);
  assert.equal(r.title, 'Firey');
  assert.match(r.summary, /Battle for Dream Island/);
});
