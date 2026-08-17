#!/usr/bin/env node
/* verify.js — drives AI Judge in headless Chromium and plays a case end to end.
   Usage: node build/verify.js [path-to-index.html-or-single-file] */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const target = process.argv[2] ||
  path.join(__dirname, '..', 'web', 'index.html');
const shotDir = process.argv[3] || path.join(__dirname, '..', 'dist', 'shots');

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
}

(async () => {
  fs.mkdirSync(shotDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--allow-file-access-from-files',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  /* A blocked outbound request is expected here — the test browser has no route
     to the Gemini endpoint, and falling back to the local bench is the designed
     behaviour. Anything else counts. */
  const EXPECTED = /Failed to load resource|net::ERR_|generativelanguage\.googleapis\.com/;
  page.on('console', m => {
    if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push('console: ' + m.text());
  });

  console.log('AI Judge — headless verification');
  console.log('target: ' + target + '\n');

  const url = /^https?:\/\//.test(target) ? target : 'file://' + path.resolve(target);
  await page.goto(url);
  await page.waitForTimeout(1800);

  check('page loaded with no errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  const globals = await page.evaluate(() => ({
    gl: !!window.AJGL, mesh: !!window.AJMesh, scene: !!window.AJScene,
    render: !!window.AJRender, audio: !!window.AJAudio, account: !!window.AJAccount,
    judge: !!window.AJJudge, net: !!window.AJNet, xr: !!window.AJXR,
    game: !!window.AJGame, ui: !!window.AJUI, live: !!window.AIJUDGE
  }));
  const missing = Object.keys(globals).filter(k => !globals[k]);
  check('all modules present', missing.length === 0, missing.join(','));

  const ctx = await page.evaluate(() =>
    !!document.getElementById('stage').getContext('webgl2'));
  check('WebGL2 context live', ctx);

  /* The hall should be drawing a lot of distinct warm pixels, not a flat clear.
     Render and read back inside one task — the drawing buffer is cleared once
     the frame is composited. */
  const colours = await page.evaluate(() => {
    const g = window.AIJUDGE.game;
    g.renderer.render(g.world.root);
    const c = document.getElementById('stage');
    const gl = c.getContext('webgl2');
    const px = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const seen = new Set();
    for (let i = 0; i < px.length; i += 4 * 37) {
      seen.add((px[i] >> 3) + ',' + (px[i + 1] >> 3) + ',' + (px[i + 2] >> 3));
    }
    return seen.size;
  });
  check('hall renders (distinct colours)', colours > 40, colours + ' buckets');

  await page.screenshot({ path: path.join(shotDir, '01-menu.png') });

  const sceneCount = await page.evaluate(() => window.AJJudge.SCENES.length);
  check('scene library loaded', sceneCount >= 30, sceneCount + ' cases');

  /* the local bench must produce a sane verdict with no network at all */
  const local = await page.evaluate(() => {
    const s = window.AJJudge.SCENES[0];
    const v = window.AJJudge.localVerdict(s, 'Ada', '', 'Bo',
      'I bought the box on Monday, I have eaten none of it, and I offered to split it because that seemed fair.');
    return v;
  });
  check('local bench favours the substantive side', local.winner === 'B',
    local.winner + ' ' + local.scoreA + '/' + local.scoreB);
  check('local bench writes a ruling', local.ruling.length > 10, local.ruling);

  /* VIP + morph quota */
  const vip = await page.evaluate(() => {
    const A = window.AJAccount;
    A.revoke();
    const before = A.morphsLeft();
    A.get().vip = true; A.get().morphsUsed = 0; A.save();
    const granted = A.morphsLeft();
    let spent = 0;
    while (A.useMorph()) spent++;
    return { before, granted, spent, after: A.morphsLeft() };
  });
  check('free players get no drum morphs', vip.before === 0, String(vip.before));
  check('VIP gets 10 morphs a day', vip.granted === 10, String(vip.granted));
  check('morphs are spendable and run out', vip.spent === 10 && vip.after === 0,
    vip.spent + ' spent, ' + vip.after + ' left');

  await page.evaluate(() => { window.AJAccount.revoke(); window.AJAccount.set({ morphsUsed: 0 }); });

  /* ---- play a full case ---- */
  console.log('\n  playing a case through the queue…');
  await page.click('#btnPlay');
  await page.waitForTimeout(600);

  const inQueue = await page.evaluate(() => window.AIJUDGE.game.phase === 'queue');
  check('joined the line', inQueue);
  await page.screenshot({ path: path.join(shotDir, '02-queue.png') });

  /* shorten the wait: pull ourselves to the front of the local line */
  await page.evaluate(() => {
    const n = window.AIJUDGE.game.net;
    n._clear();
    n.pos = 0;
    n._advance();
  });

  await page.waitForFunction(() => window.AIJUDGE.game.phase === 'trial', null, { timeout: 20000 });
  check('reached the front and was called', true);

  const caseInfo = await page.evaluate(() => {
    const g = window.AIJUDGE.game;
    return {
      title: g.match.scene.t, side: g.match.side,
      opponent: g.match.opponent.name,
      shownTitle: document.getElementById('caseTitle').textContent
    };
  });
  check('a case was posed', caseInfo.title === caseInfo.shownTitle, caseInfo.title +
    ' (side ' + caseInfo.side + ' vs ' + caseInfo.opponent + ')');
  await page.screenshot({ path: path.join(shotDir, '03-trial.png') });

  await page.fill('#argument',
    'I paid for it on the ninth, I have the receipt, and I offered twice to split it because that seemed fair to me.');
  await page.click('#btnSubmit');

  /* make the stand-in opponent answer immediately */
  await page.evaluate(() => {
    const n = window.AIJUDGE.game.net;
    n._clear();
    n.foeSubmission = 'I was there first and everyone saw it.';
    n._maybeJudge();
  });

  await page.waitForFunction(() => window.AIJUDGE.game.phase === 'verdict', null, { timeout: 20000 });
  const verdict = await page.evaluate(() => {
    const g = window.AIJUDGE.game;
    return { v: g.verdict.verdict, iWon: g.iWon, ruling: document.getElementById('rulingText').textContent };
  });
  check('a verdict was handed down', !!verdict.v.ruling, verdict.v.model +
    ' → ' + verdict.v.winner + ' (' + verdict.v.scoreA + '/' + verdict.v.scoreB + ')');
  check('the ruling reached the overlay', verdict.ruling.length > 12);
  await page.waitForTimeout(1500);   // let the camera finish its pull-back
  await page.screenshot({ path: path.join(shotDir, '04-verdict.png') });

  /* the guns */
  await page.waitForFunction(() => window.AIJUDGE.game.phase === 'shot', null, { timeout: 10000 });
  await page.waitForFunction(() => window.AIJUDGE.game.shotFired === true, null, { timeout: 10000 });
  const shot = await page.evaluate(() => {
    const g = window.AIJUDGE.game;
    return {
      live: g.world.sparks.filter(s => s.visible).length,
      flash: g.renderer.flash,
      loserKnocked: (g.iWon ? g.world.foe : g.world.self).knockTarget === 1
    };
  });
  check('the guns fired sparks', shot.live > 5, shot.live + ' live');
  check('the hall flashed', shot.flash > 0.1, shot.flash.toFixed(2));
  check('the loser was knocked down', shot.loserKnocked);
  await page.waitForTimeout(700);    // let the knockdown play
  await page.screenshot({ path: path.join(shotDir, '05-shot.png') });

  await page.waitForFunction(() => window.AIJUDGE.game.phase === 'aftermath', null, { timeout: 12000 });
  const after = await page.evaluate(() => ({
    outcome: document.getElementById('outcome').textContent,
    cases: window.AJAccount.get().cases
  }));
  check('the case was recorded', after.cases >= 1, after.outcome);
  await page.screenshot({ path: path.join(shotDir, '06-aftermath.png') });

  /* returning to the line must work */
  await page.click('#btnAgain');
  await page.waitForTimeout(500);
  check('can rejoin the line', await page.evaluate(() => window.AIJUDGE.game.phase === 'queue'));

  check('no page errors during play', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  const failed = checks.filter(c => !c.ok);
  console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' checks passed');
  console.log('screenshots: ' + shotDir);
  if (failed.length) {
    console.log('\nfailures:');
    failed.forEach(f => console.log('  · ' + f.name + (f.detail ? ' — ' + f.detail : '')));
    process.exit(1);
  }
})().catch(e => { console.error('\nverification crashed:', e); process.exit(2); });
