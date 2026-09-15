/* screenshots.js — capture the docs images, driving the app against the simulator.
 *
 *   node src/screenshots.js [outdir]
 */
'use strict';

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, '..', 'docs');
const HTML = path.join(__dirname, 'dist', 'infodoc-1.0.0.html');
const PORT = 18890;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ready = path.join(os.tmpdir(), 'infodoc-shot-' + process.pid + '.ready');
  const sim = spawn('python3', [path.join(__dirname, 'simulator.py'),
    '--listen', String(PORT), '--host', '127.0.0.1',
    '--skin', '35.9', '--tau', '0.8', '--contact-delay', '0.3',
    '--tremor-hz', '5.5', '--tremor-mg', '42', '--ready-file', ready],
    { stdio: 'ignore' });
  for (let i = 0; i < 80 && !fs.existsSync(ready); i++) await sleep(100);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1320, height: 900 },
                                       deviceScaleFactor: 2 });
  await page.goto('file://' + HTML);
  await page.waitForFunction(() => window.UI && window.Store);
  await page.evaluate(() => { Store.wipe(); });

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('  ' + name);
  };

  // a small, plausible clinic list
  const roster = [
    ['Rosa Ekwueme', 'PT-00142', '1979-04-08', 'Female', 'penicillin', 'Dizzy spells, two weeks', 'Dr Adeyemi'],
    ['Tomas Lindqvist', 'PT-00148', '1956-11-21', 'Male', 'none known', 'Tremor review', 'Dr Okafor'],
    ['Aiko Brenner', 'PT-00151', '2001-02-17', 'Female', 'latex', 'Post-concussion check', 'Dr Adeyemi'],
    ['Mehdi Farouk', 'PT-00155', '1988-07-02', 'Male', 'none known', 'Flu-like symptoms', 'Dr Sandoval']
  ];
  await page.evaluate((rows) => {
    rows.forEach(function (r) {
      var p = Store.addPerson(r[0]);
      p.chartId = r[1]; p.dob = r[2]; p.sex = r[3]; p.allergies = r[4];
      p.phone = '0700 900 ' + (100 + Math.floor(Math.random() * 800));
      var d = new Date();
      d.setHours(9 + Math.floor(Math.random() * 7), [0, 15, 30, 45][Math.floor(Math.random() * 4)], 0, 0);
      Store.addVisit(p.id, Store.localIso(d), r[5], r[6]);
      Store.touch(p);
    });
  }, roster);
  await page.evaluate(() => { UI.show('people'); });
  await page.click('#peopleList li:first-child');
  await sleep(300);
  await shot('01-people.png');

  // connect, then run all three checks on the first person
  await page.click('.tab[data-view=device]');
  await page.fill('#wsUrl', 'ws://127.0.0.1:' + PORT);
  await page.click('#connectWs');
  await page.waitForFunction(() => Link.isOpen() && Link.modules().T);
  await sleep(900);
  await shot('03-device.png');

  await page.click('.tab[data-view=people]');
  await page.click('#visitList li:first-child button.btn');
  await page.waitForSelector('#visitBody:not([hidden])');
  await page.fill('#visitNotes', 'Reports light-headedness on standing. No syncope. ' +
                                 'For orthostatic BP and bloods.');
  await page.fill('#obsBp', '108/64');
  await page.fill('#obsPulse', '88');
  await page.fill('#obsSpo2', '98');
  await page.fill('#obsWeight', '64.5');
  await page.fill('#obsHeight', '167');

  await page.waitForFunction(() => !document.querySelector('#thermoStart').disabled);
  await page.click('#thermoStart');
  await page.waitForFunction(() => { const v = InfoDocDebug.visit(); return v && v.thermo; },
                             null, { timeout: 60000 });
  await page.click('#tremorStart');
  await sleep(4000);
  await page.$eval('#testTremor', e => e.scrollIntoView({ block: 'center' }));
  await shot('05-tremor-live.png');
  await page.waitForFunction(() => { const v = InfoDocDebug.visit(); return v && v.tremor; },
                             null, { timeout: 60000 });

  // catch the reflex test with the green box actually lit
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
          Link.send('SIMAIM ' + (Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1) + ' 900');
          aimed = true;
        }
      } else if (aimed) { Link.send('SIMCENTER'); aimed = false; }
      await sleep(12);
    }
    Link.send('SIMCENTER');
  });
  for (let i = 0; i < 400; i++) {
    const s = await page.evaluate(() => InfoDocDebug.reflex());
    if (s && s.phase === 'go') break;
    await sleep(40);
  }
  await page.$eval('#testReflex', e => e.scrollIntoView({ block: 'center' }));
  await shot('04-reflex.png');
  await page.waitForFunction(() => { const v = InfoDocDebug.visit(); return v && v.reflex; },
                             null, { timeout: 120000 });
  await drive;

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(400);
  await shot('02-visit.png');
  await page.$eval('#testThermo', e => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await shot('06-results.png');

  await page.click('.tab[data-view=settings]');
  await sleep(300);
  await shot('07-settings.png');

  await browser.close();
  sim.kill('SIGTERM');
  console.log('screenshots written to ' + OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
