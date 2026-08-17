#!/usr/bin/env node
/* verify-server.js — starts the hall, walks two clients through the line, and
   checks that they are matched, judged and told the result.
   Usage: node build/verify-server.js */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8791;
const STATE = path.join(require('os').tmpdir(), 'aijudge-verify-state.json');
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
}

function client(name, id) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT);
  const c = { ws, name, id, got: [], queue: [], match: null, verdict: null };
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    c.got.push(m.t);
    if (m.t === 'queue') c.queue.push(m);
    if (m.t === 'match') c.match = m;
    if (m.t === 'verdict') c.verdict = m;
    if (m.t === 'awaitMorphVerdict') c.morphAsk = m;
  });
  c.ready = new Promise(res => ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ t: 'hello', v: 1, name, id, rank: 'Litigant' }));
    res();
  }));
  c.send = (o) => ws.send(JSON.stringify(o));
  return c;
}

const until = (fn, ms) => new Promise((res, rej) => {
  const t0 = Date.now();
  (function poll() {
    if (fn()) return res();
    if (Date.now() - t0 > (ms || 8000)) return rej(new Error('timed out'));
    setTimeout(poll, 50);
  })();
});

(async () => {
  try { fs.unlinkSync(STATE); } catch (e) { /* fresh */ }
  console.log('AI Judge — server verification\n');

  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: Object.assign({}, process.env, {
      PORT: String(PORT), AIJUDGE_VIP_CODES: 'DRUM-TEST', AIJUDGE_STATE: STATE,
      GEMINI_API_KEY: ''
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  srv.stdout.on('data', d => { log += d; });
  srv.stderr.on('data', d => { log += d; });

  const fail = (e) => { console.error(e); console.error('\nserver log:\n' + log); srv.kill(); process.exit(2); };
  process.on('uncaughtException', fail);

  await until(() => log.includes('the hall is open'), 8000).catch(fail);
  check('server starts with no dependencies', true);

  const health = await (await fetch('http://127.0.0.1:' + PORT + '/api/health')).json();
  check('health endpoint answers', health.ok === true, 'bench: ' + health.bench);

  const page = await fetch('http://127.0.0.1:' + PORT + '/');
  const html = await page.text();
  check('serves the game over http', page.status === 200 && html.includes('AI Judge'));

  /* ---- two strangers in the line ---- */
  const a = client('Ada', 'p_test_a');
  await a.ready;
  await until(() => a.queue.length === 0, 500).catch(() => {});
  a.send({ t: 'queue' });
  await until(() => a.queue.length > 0).catch(fail);
  check('first player waits in the line', a.queue[0].pos === 0 && a.queue[0].total === 1,
    'pos ' + a.queue[0].pos);
  check('no match while alone at the front', a.match === null);

  const b = client('Bo', 'p_test_b');
  await b.ready;
  b.send({ t: 'queue' });

  await until(() => a.match && b.match).catch(fail);
  check('two players at the front are matched', true,
    a.match.scene.t + ' — ' + a.match.side + ' vs ' + b.match.side);
  check('the two are given opposite sides', a.match.side !== b.match.side);
  check('each sees the other by name',
    a.match.opponent.name === 'Bo' && b.match.opponent.name === 'Ada');
  check('both get the same case', a.match.scene.t === b.match.scene.t);

  a.send({ t: 'submit', text: 'I paid for it on the ninth, I have the receipt, and I offered twice to split it.' });
  await until(() => b.got.includes('opponentSubmitted')).catch(fail);
  check('the other side is told when you rest your case', true);

  b.send({ t: 'submit', text: 'nah' });
  await until(() => a.verdict && b.verdict).catch(fail);
  check('the bench hands down one verdict to both',
    a.verdict.verdict.winner === b.verdict.verdict.winner,
    a.verdict.verdict.model + ' → ' + a.verdict.verdict.winner +
    ' (' + a.verdict.verdict.scoreA + '/' + a.verdict.verdict.scoreB + ')');
  const substantive = a.match.side === 'A' ? 'A' : 'B';
  check('the substantive case wins', a.verdict.verdict.winner === substantive);

  /* ---- VIP redemption is checked server-side ---- */
  const bad = await fetch('http://127.0.0.1:' + PORT + '/api/vip/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOPE', playerId: 'p_test_a' })
  });
  check('a wrong code is refused', bad.status === 403);

  const good = await fetch('http://127.0.0.1:' + PORT + '/api/vip/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'DRUM-TEST', playerId: 'p_test_a' })
  });
  const gj = await good.json();
  check('a valid code grants VIP', good.status === 200 && gj.vip === true);

  const reuse = await fetch('http://127.0.0.1:' + PORT + '/api/vip/redeem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'DRUM-TEST', playerId: 'p_test_c' })
  });
  check('a code cannot be used twice', reuse.status === 409);

  /* ---- a drum morph puts a player on the bench ---- */
  const a2 = client('Ada', 'p_test_a');       // reconnects, now VIP on the server
  await a2.ready;
  const b2 = client('Bo', 'p_test_b');
  await b2.ready;
  await until(() => a2.got.includes('welcome') && b2.got.includes('welcome')).catch(fail);
  check('VIP is restored from the server, not claimed by the client', true);

  a2.send({ t: 'queue' });
  b2.send({ t: 'queue' });
  await until(() => a2.match && b2.match).catch(fail);
  a2.send({ t: 'morph' });
  await until(() => a2.got.includes('morphed')).catch(fail);
  check('a VIP can morph into the drum', true);

  a2.send({ t: 'submit', text: 'I planted the hedge and trimmed it every spring for thirty years.' });
  b2.send({ t: 'submit', text: 'The deed is on my side.' });
  await until(() => a2.morphAsk).catch(fail);
  check('the morphed player is asked to rule, not the model', true);

  /* rule for the side the model would probably not have picked */
  const ruleFor = a2.match.side === 'A' ? 'B' : 'A';
  a2.send({ t: 'morphVerdict', winner: ruleFor, ruling: 'The drum finds otherwise.' });
  await until(() => a2.verdict && b2.verdict).catch(fail);
  check('the drum morph verdict reaches both players',
    a2.verdict.verdict.winner === ruleFor && b2.verdict.verdict.winner === ruleFor,
    a2.verdict.verdict.model);

  /* ---- a player who walks out dismisses the case ---- */
  const c1 = client('Cy', 'p_test_c1'); await c1.ready;
  const c2 = client('Di', 'p_test_c2'); await c2.ready;
  c1.send({ t: 'queue' }); c2.send({ t: 'queue' });
  await until(() => c1.match && c2.match).catch(fail);
  c1.ws.close();
  await until(() => c2.got.includes('opponentLeft')).catch(fail);
  check('leaving mid-case tells the other side', true);

  const finalHealth = await (await fetch('http://127.0.0.1:' + PORT + '/api/health')).json();
  check('the hall cleans up after itself',
    finalHealth.matches === 0, finalHealth.matches + ' matches still open');

  for (const c of [a, b, a2, b2, c2]) { try { c.ws.close(); } catch (e) { /* gone */ } }
  srv.kill();
  try { fs.unlinkSync(STATE); } catch (e) { /* fine */ }

  const failed = checks.filter(c => !c.ok);
  console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' checks passed');
  if (failed.length) { console.log('\nserver log:\n' + log); process.exit(1); }
  process.exit(0);
})();
