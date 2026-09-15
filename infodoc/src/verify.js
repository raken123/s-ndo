/* verify.js — drive InfoDoc against the device simulator and check that the
 * three measurements come out right.
 *
 *   node src/verify.js                      the single-file build, in Chromium
 *   node src/verify.js --html <file>        a specific build
 *   node src/verify.js --electron <binary>  the real desktop app
 *
 * The same checks run either way. In Electron mode the records go through the
 * preload's file store rather than localStorage, so that path gets covered too.
 *
 * This is the test that actually matters: it exercises the protocol, the clock
 * sync, all three test engines, the record store and printing, end to end.
 */
'use strict';

const PW = '/opt/node22/lib/node_modules/playwright';
const { chromium, _electron } = require(PW);
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const PORT = Number(opt('port', '18888'));
const ELECTRON = opt('electron', null);
const HTML = opt('html', argv[0] && !argv[0].startsWith('--') ? argv[0]
  : path.join(__dirname, 'dist', 'infodoc-1.0.0.html'));

let pass = 0, fail = 0;
let sim = null;                    // killed even when a check throws
function ok(name, extra) { pass++; console.log('  PASS  ' + name + (extra ? '  (' + extra + ')' : '')); }
function bad(name, why) { fail++; console.log('  FAIL  ' + name + '  -> ' + why); }
function check(name, cond, extra) { cond ? ok(name, extra) : bad(name, extra || 'assertion false'); }
function near(name, got, want, tol) {
  const d = Math.abs(got - want);
  check(name, d <= tol, 'got ' + (+got).toFixed(3) + ', want ' + want + ' ±' + tol);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!ELECTRON && !fs.existsSync(HTML)) throw new Error('no such build: ' + HTML);
  if (ELECTRON && !fs.existsSync(ELECTRON)) throw new Error('no such binary: ' + ELECTRON);
  console.log(ELECTRON ? 'mode: Electron desktop app (' + ELECTRON + ')'
                       : 'mode: browser, file://' + HTML);

  const readyFile = path.join(os.tmpdir(), 'infodoc-sim-' + process.pid + '.ready');
  sim = spawn('python3', [
    path.join(__dirname, 'simulator.py'),
    '--listen', String(PORT), '--host', '127.0.0.1',
    '--skin', '34.80', '--ambient', '22', '--tau', '0.9', '--contact-delay', '0.4',
    '--tremor-hz', '6', '--tremor-mg', '30', '--noise-mg', '3',
    '--ready-file', readyFile
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let simLog = '';
  sim.stdout.on('data', d => { simLog += d; });
  sim.stderr.on('data', d => { simLog += d; });

  for (let i = 0; i < 80 && !fs.existsSync(readyFile); i++) await sleep(100);
  if (!fs.existsSync(readyFile)) { console.log(simLog); throw new Error('simulator never started'); }
  console.log('simulator up on ws://127.0.0.1:' + PORT);

  let page, close, userDataDir = null;
  if (ELECTRON) {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infodoc-profile-'));
    const eapp = await _electron.launch({
      executablePath: ELECTRON,
      args: ['--no-sandbox', '--user-data-dir=' + userDataDir],
      env: Object.assign({}, process.env, { INFODOC_SMOKE: '' })
    });
    page = await eapp.firstWindow();
    close = () => eapp.close();
  } else {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    close = () => browser.close();
  }

  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  if (!ELECTRON) await page.goto('file://' + HTML);
  await page.waitForFunction(() => window.UI && window.Store && window.Link && window.Tests, null, { timeout: 30000 });

  // stub printing so the generated sheet can be inspected instead of spooled
  const stub = () => {
    window.__printed = [];
    window.print = function () {
      window.__printed.push(document.getElementById('print-area').innerHTML);
    };
  };
  await page.addInitScript(stub);
  await page.evaluate(stub);
  // start from an empty store so the assertions below are about this run
  await page.evaluate(() => { Store.wipe(); return Store.flush(); });
  await page.waitForFunction(() => Store.people().length === 0, null, { timeout: 8000 });

  console.log('\n— load —');
  check('no page errors on load', errors.length === 0, errors.join(' | '));
  check('title is InfoDoc', /InfoDoc/.test(await page.title()));
  const caps = await page.evaluate(() => ({
    serial: !!(navigator.serial),
    ls: (function () { try { localStorage.setItem('t', '1'); localStorage.removeItem('t'); return true; } catch (e) { return false; } })(),
    backend: Store.backend
  }));
  console.log('  info  Web Serial: ' + caps.serial +
              ' | localStorage: ' + caps.ls + ' | store backend: ' + caps.backend);
  check('store backend is the expected one for this mode',
        caps.backend === (ELECTRON ? 'native' : 'localStorage'), caps.backend);
  if (ELECTRON) {
    const where = await page.evaluate(() => Store.where());
    check('records live in a file on disk', /infodoc-records\.json$/.test(where), where);
  }

  /* ── records ─────────────────────────────────────────── */
  console.log('\n— records —');
  await page.click('#newPerson');
  await page.fill('#personForm input[name=name]', 'Rosa Ekwueme');
  await page.fill('#personForm input[name=chartId]', 'PT-00142');
  await page.fill('#personForm input[name=dob]', '1979-04-08');
  await page.fill('#personForm input[name=allergies]', 'penicillin');
  await page.fill('#personForm input[name=phone]', '0700 900 900');
  const age = (await page.textContent('#personForm output[name=age]')).trim();
  check('age derived from date of birth', /^4[0-9] years$/.test(age), age);

  await page.fill('#newVisitReason', 'Dizzy spells, two weeks');
  await page.fill('#newVisitClinician', 'Dr Adeyemi');
  await page.click('#addVisit');
  await page.waitForSelector('#visitBody:not([hidden])');
  check('adding an appointment opens the visit view',
        await page.isVisible('#visitWho'));
  check('visit header carries the allergy',
        /penicillin/.test(await page.textContent('#visitMeta')));

  await page.fill('#visitNotes', 'Reports light-headedness on standing.');
  await page.fill('#obsBp', '108/64');
  await page.fill('#obsPulse', '88');

  /* ── link ────────────────────────────────────────────── */
  console.log('\n— link —');
  await page.click('.tab[data-view=device]');
  await page.fill('#wsUrl', 'ws://127.0.0.1:' + PORT);
  await page.click('#connectWs');
  await page.waitForFunction(() => Link.isOpen(), null, { timeout: 15000 });
  ok('websocket transport connected');

  await page.waitForFunction(() => {
    const m = Link.modules();
    return m.T && m.J && m.M;
  }, null, { timeout: 8000 });
  ok('all three Modulino nodes reported present');

  const info = await page.evaluate(() => Link.info());
  check('HELLO parsed', info.proto === 1 && /sim/.test(info.fw), JSON.stringify(info));

  await page.waitForFunction(() => isFinite(Link.clock().rtt) && Link.clock().samples >= 3,
                             null, { timeout: 10000 });
  const clock = await page.evaluate(() => Link.clock());
  check('clock offset measured', isFinite(clock.offset) && clock.rtt < 500,
        'rtt ' + clock.rtt.toFixed(1) + ' ms over ' + clock.samples + ' probes');

  /* ── thermo ──────────────────────────────────────────── */
  console.log('\n— forehead temperature —');
  await page.click('.tab[data-view=visit]');
  await page.waitForFunction(() => !document.querySelector('#thermoStart').disabled, null, { timeout: 8000 });
  await page.click('#thermoStart');
  await page.waitForFunction(() => {
    const v = InfoDocDebug.visit();
    return v && v.thermo;
  }, null, { timeout: 60000 });
  const th = await page.evaluate(() => InfoDocDebug.visit().thermo);
  near('skin temperature matches the simulated forehead', th.skinC, 34.80, 0.25);
  near('core estimate is skin + offset', th.coreEstC, th.skinC + 1.6, 0.01);
  check('reading reported as settled', th.settled === true, JSON.stringify(th.settled));
  check('settle time recorded', th.settleSecs > 1 && th.settleSecs < 40, th.settleSecs + ' s');
  check('band is the normal one', th.band.key === 'normal', th.band.label);
  check('result rendered', /Core \(estimated\)/.test(await page.textContent('#thermoResult')));

  /* ── steadiness ──────────────────────────────────────── */
  console.log('\n— hand steadiness —');
  await page.click('#tremorStart');
  await page.waitForFunction(() => {
    const v = InfoDocDebug.visit();
    return v && v.tremor;
  }, null, { timeout: 60000 });
  const tr = await page.evaluate(() => InfoDocDebug.visit().tremor);
  near('dominant frequency found at the injected 6 Hz', tr.peakHz, 6.0, 0.4);
  // a 30 mg peak sinusoid is 30/sqrt(2) = 21.2 mg RMS
  near('band RMS recovers the injected amplitude', tr.tremorRmsMg, 21.2, 4.0);
  check('sample rate near 100 Hz', tr.rateHz > 80 && tr.rateHz < 120, tr.rateHz + ' Hz');
  check('enough samples captured', tr.samples > 700, tr.samples + ' samples');
  check('spectrum plotted', Array.isArray(tr.spectrum) && tr.spectrum.length > 50,
        (tr.spectrum || []).length + ' bins');

  /* ── reflex ──────────────────────────────────────────── */
  console.log('\n— reflex —');
  await page.click('#reflexStart');
  const drive = page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let aimed = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const s = InfoDocDebug.reflex();
      if (!s || s.phase === 'idle') break;
      if (s.phase === 'go' && s.target >= 0) {
        if (!aimed) {
          const dx = (s.target % 3) - 1, dy = Math.floor(s.target / 3) - 1;
          const deg = Math.atan2(-dy, dx) * 180 / Math.PI;
          Link.send('SIMAIM ' + deg.toFixed(1) + ' 240');
          aimed = true;
        }
      } else if (aimed) {
        Link.send('SIMCENTER');
        aimed = false;
      }
      await sleep(12);
    }
    Link.send('SIMCENTER');
  });
  await page.waitForFunction(() => {
    const v = InfoDocDebug.visit();
    return v && v.reflex;
  }, null, { timeout: 120000 });
  await drive;
  const rf = await page.evaluate(() => InfoDocDebug.visit().reflex);
  check('all eight rounds ran', rf.rounds === 8, 'rounds ' + rf.rounds);
  check('the simulated hand hit the green box', rf.hits >= 6, rf.hits + '/' + rf.rounds + ' hit');
  check('reaction time is plausible', rf.medianRtMs > 150 && rf.medianRtMs < 800,
        'median ' + rf.medianRtMs + ' ms');
  near('reaction time tracks the 240 ms simulated delay', rf.medianRtMs, 285, 90);
  check('aim error small when aiming straight at it', rf.meanAimErrDeg < 10,
        rf.meanAimErrDeg + '°');
  check('no false starts from a steady hand', rf.falseStarts === 0, String(rf.falseStarts));
  check('per-round detail stored', rf.detail.length === 8, rf.detail.length + ' rows');

  /* ── streams released ────────────────────────────────── */
  const idle = await page.evaluate(() => InfoDocDebug.busy());
  check('no test left running', !idle.thermo && !idle.reflex && !idle.tremor, JSON.stringify(idle));

  /* ── trend, print, persistence ───────────────────────── */
  console.log('\n— record keeping —');
  check('history table lists the appointment',
        /34\.|21\.|ms/.test(await page.textContent('#trend')));

  await page.click('#printVisit');
  const printed = await page.evaluate(() => window.__printed[window.__printed.length - 1] || '');
  check('visit summary prints the patient', /Rosa Ekwueme/.test(printed));
  check('visit summary prints all three measurements',
        /Modulino Thermo/.test(printed) && /Modulino Joystick/.test(printed) &&
        /Modulino Movement/.test(printed));
  check('visit summary carries the not-a-medical-device note',
        /not a medical device/.test(printed));
  check('visit summary shows the measured numbers',
        /34\.\d\d °C/.test(printed) && /mg RMS/.test(printed));

  const exported = await page.evaluate(() => Store.exportText());
  check('export is valid JSON with the person in it',
        JSON.parse(exported).people[0].name === 'Rosa Ekwueme');

  await page.evaluate(() => Store.flush());
  await page.reload();
  await page.waitForFunction(() => window.Store && Store.people().length >= 0, null, { timeout: 15000 });
  await page.waitForFunction(() => Store.people().length === 1, null, { timeout: 8000 });
  const after = await page.evaluate(() => {
    const p = Store.people()[0];
    return { name: p.name, chart: p.chartId, visits: p.visits.length,
             thermo: !!p.visits[0].thermo, reflex: !!p.visits[0].reflex,
             tremor: !!p.visits[0].tremor, notes: p.visits[0].notes,
             bp: p.visits[0].obs.bp };
  });
  check('record survived a restart', after.name === 'Rosa Ekwueme' && after.chart === 'PT-00142',
        JSON.stringify(after));
  check('all three measurements survived', after.thermo && after.reflex && after.tremor);
  check('notes and observations survived',
        /light-headedness/.test(after.notes) && after.bp === '108/64');

  /* ── search and delete ───────────────────────────────── */
  console.log('\n— list behaviour —');
  await page.fill('#search', 'PT-001');
  await page.waitForTimeout(150);
  check('search finds by clinic ID', (await page.$$('#peopleList li')).length === 1);
  await page.fill('#search', 'zzzz');
  await page.waitForTimeout(150);
  check('search with no match says so',
        /Nothing matches/.test(await page.textContent('#peopleList')));
  await page.fill('#search', '');

  /* ── a missing module must disable its test ──────────── */
  console.log('\n— degraded hardware —');
  await page.evaluate(() => Link.disconnect());
  await page.waitForFunction(() => !Link.isOpen(), null, { timeout: 8000 });
  const disabled = await page.evaluate(() => ({
    t: document.querySelector('#thermoStart').disabled,
    j: document.querySelector('#reflexStart').disabled,
    m: document.querySelector('#tremorStart').disabled,
    chip: document.querySelector('#linkText').textContent
  }));
  check('disconnecting disables every test', disabled.t && disabled.j && disabled.m,
        JSON.stringify(disabled));
  check('status chip reports no device', /No device/.test(disabled.chip), disabled.chip);

  /* A cable pulled mid-measurement is the case that breaks quietly: the stream
   * reference counts stay claimed, so after reconnecting the app never asks the
   * board to start streaming again and the next test waits for samples forever.
   */
  console.log('— cable pulled mid-measurement —');
  await page.evaluate(() => { Store.setSetting('tremorSecs', 4); });

  const reopen = async () => {
    await page.click('.tab[data-view=people]');
    await page.click('#peopleList li:first-child');
    await page.click('#visitList li:first-child button.btn');
    await page.waitForSelector('#visitBody:not([hidden])');
  };
  const reconnect = async () => {
    await page.click('.tab[data-view=device]');
    await page.click('#connectWs');
    await page.waitForFunction(() => Link.isOpen() && Link.modules().M, null, { timeout: 15000 });
  };

  await reconnect();
  await reopen();                      // the reload earlier cleared the selection
  await page.evaluate(() => { InfoDocDebug.visit().tremor = null; });
  await page.waitForFunction(() => !document.querySelector('#tremorStart').disabled,
                             null, { timeout: 8000 });
  await page.click('#tremorStart');
  await page.waitForFunction(() => InfoDocDebug.busy().tremor, null, { timeout: 8000 });
  await page.waitForTimeout(1200);     // let it get a second of samples first
  await page.evaluate(() => Link.disconnect());
  await page.waitForFunction(() => !Link.isOpen(), null, { timeout: 8000 });
  const dropped = await page.evaluate(() => ({
    busy: InfoDocDebug.busy(), recorded: !!InfoDocDebug.visit().tremor
  }));
  check('a link lost mid-capture abandons the test', !dropped.busy.tremor, JSON.stringify(dropped.busy));
  check('and records nothing from the partial capture', dropped.recorded === false);

  await reconnect();
  await reopen();
  await page.waitForFunction(() => !document.querySelector('#tremorStart').disabled,
                             null, { timeout: 8000 });
  await page.click('#tremorStart');
  await page.waitForFunction(() => { const v = InfoDocDebug.visit(); return v && v.tremor; },
                             null, { timeout: 30000 });
  const again = await page.evaluate(() => InfoDocDebug.visit().tremor);
  check('streams flow again after the reconnect', again.samples > 200,
        again.samples + ' samples in ' + again.seconds + ' s');
  await page.evaluate(() => Link.disconnect());
  await page.waitForFunction(() => !Link.isOpen(), null, { timeout: 8000 });

  /* Link keeps a reference count per stream so two tests can share one. That
   * count has to survive a link that dies while a claim is still held —
   * otherwise the next claim thinks the stream is already running and never
   * asks the board to start it. Held deliberately here, with no test object
   * around to release it on the way down.
   */
  console.log('\n— stream claims outlive a dead link —');
  await reconnect();
  await page.evaluate(() => { window.__heldClaim = Link.claim('T'); });
  await page.waitForFunction(() => window.__heldClaim, null, { timeout: 5000 });
  await page.evaluate(() => Link.disconnect());
  await page.waitForFunction(() => !Link.isOpen(), null, { timeout: 8000 });
  await reconnect();
  await page.evaluate(() => {
    window.__got = 0;
    Link.on('thermo', function () { window.__got++; });
    window.__claim2 = Link.claim('T');
  });
  let flowed = false;
  try {
    await page.waitForFunction(() => window.__got > 3, null, { timeout: 8000 });
    flowed = true;
  } catch (e) { /* the assertion below reports it */ }
  const got = await page.evaluate(() => window.__got);
  check('a claim held across a dropped link does not wedge the stream', flowed,
        got + ' samples after reclaiming');
  await page.evaluate(() => Link.disconnect());
  await page.waitForFunction(() => !Link.isOpen(), null, { timeout: 8000 });

  check('still no page errors at the end', errors.length === 0, errors.join(' | '));

  if (ELECTRON) {
    const where = await page.evaluate(() => Store.where());
    await page.evaluate(() => Store.flush());
    await page.waitForTimeout(300);
    check('the record file really exists on disk', fs.existsSync(where), where);
    if (fs.existsSync(where)) {
      const onDisk = JSON.parse(fs.readFileSync(where, 'utf8'));
      check('the file on disk holds the patient',
            onDisk.people[0] && onDisk.people[0].name === 'Rosa Ekwueme',
            (onDisk.people[0] || {}).name);
      check('the file on disk holds the measurements',
            !!(onDisk.people[0].visits[0].thermo && onDisk.people[0].visits[0].reflex &&
               onDisk.people[0].visits[0].tremor));
    }
  }

  await close();
  sim.kill('SIGTERM');
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });

  console.log('\n' + (fail ? 'FAILED' : 'OK') + ' — ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('\n--- simulator log ---\n' + simLog.split('\n').slice(-20).join('\n')); }
  process.exit(fail ? 1 : 0);
}

main().catch(e => {
  console.error('\nverify crashed:', e);
  if (sim) sim.kill('SIGKILL');
  process.exit(2);
});
