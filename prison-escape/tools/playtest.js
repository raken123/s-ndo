#!/usr/bin/env node
/* End-to-end play-through test. Drives the real game in Chromium: collects
   every item, opens every locked door, cuts the fence and walks each exit,
   asserting the game advances chapter by chapter.

   usage: npm i playwright && node tools/playtest.js [--shots DIR]
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const { LEVELS } = require(path.join(ROOT, 'www/js/levels.js'));
const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const SOLID = new Set(['#', 'B', 'T', 'L', 'c', 'k', 'F', 'W', '1', '2', '3', '4']);
let failures = 0;
const check = (ok, what) => {
  console.log((ok ? '  ok   ' : '  FAIL ') + what);
  if (!ok) failures++;
};

function freeNeighbour(map, x, y) {
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const ch = (map[y + dy] || '')[x + dx];
    if (ch && !SOLID.has(ch)) return [x + dx, y + dy];
  }
  return [x, y];
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // headless chromium needs a software GL stack for WebGL
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 480 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/cordova\.js|ERR_FILE_NOT_FOUND/.test(t)) errors.push('CONSOLE: ' + t);
  });

  await page.goto('file://' + path.join(ROOT, 'www/index.html'));
  await page.waitForTimeout(400);
  await page.click('[data-act="new"]');

  for (let i = 0; i < LEVELS.length; i++) {
    const def = LEVELS[i];
    console.log(`\n— chapter ${def.id}: ${def.name}`);
    await page.click('[data-act="start"]');
    await page.waitForTimeout(350);

    check(await page.evaluate(() => __blackgate.mode === 'play'), 'level started');
    check(await page.evaluate((n) => __blackgate.state.def.name === n, def.name), 'correct level loaded');

    // exits must refuse until their requirements are met
    if ((def.exitRequires || []).length) {
      const ex = await page.evaluate(() => __blackgate.state.exit);
      await page.evaluate((e) => { __blackgate.tp(e.x, e.y); __blackgate.face(e.x, e.y + 1); __blackgate.act(); }, ex);
      await page.waitForTimeout(120);
      check(await page.evaluate(() => __blackgate.mode === 'play'), 'exit refuses without the required item');
    }

    // collect every item
    for (const it of def.items || []) {
      const [nx, ny] = freeNeighbour(def.map, it.x, it.y);
      await page.evaluate((a) => {
        __blackgate.tp(a[0], a[1]); __blackgate.face(a[2], a[3]); __blackgate.act();
      }, [nx, ny, it.x, it.y]);
      await page.waitForTimeout(120);
      check(await page.evaluate((id) => __blackgate.progress.inventory.includes(id), it.id), `picked up ${it.name}`);
    }
    if (def.items && def.items.some((i) => i.effect === 'power'))
      check(await page.evaluate(() => __blackgate.state.powerOff === true), 'breaker killed the cameras');

    // open every locked door
    for (const ch of Object.keys(def.locks || {})) {
      let pos = null;
      def.map.forEach((row, y) => { const x = row.indexOf(ch); if (x >= 0) pos = [x, y]; });
      const [nx, ny] = freeNeighbour(def.map, pos[0], pos[1]);
      await page.evaluate((a) => {
        __blackgate.tp(a[0], a[1]); __blackgate.face(a[2], a[3]); __blackgate.act();
      }, [nx, ny, pos[0], pos[1]]);
      await page.waitForTimeout(120);
      const opened = await page.evaluate((p) => __blackgate.state.grid[p[1]][p[0]] === '+', pos);
      check(opened, `door '${ch}' unlocked with the ${def.locks[ch].item}`);
    }

    // cut the fence
    if (def.fence) {
      let pos = null;
      def.map.forEach((row, y) => { const x = row.indexOf('F'); if (x >= 0 && !pos) pos = [x + 12, y]; });
      const [nx, ny] = [pos[0], pos[1] - 1];
      await page.evaluate((a) => {
        __blackgate.tp(a[0], a[1]); __blackgate.face(a[2], a[3]); __blackgate.act();
      }, [nx, ny, pos[0], pos[1]]);
      await page.waitForTimeout(120);
      check(await page.evaluate((p) => __blackgate.state.grid[p[1]][p[0]] === ',', pos), 'fence cut with the wire cutters');
    }

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/chapter${def.id}.png` });

    // walk out
    const ex = await page.evaluate(() => __blackgate.state.exit);
    await page.evaluate((e) => __blackgate.tp(e.x, e.y), ex);
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => __blackgate.mode);
    check(m === 'clear' || m === 'win', `reached ${def.exitLabel} (mode=${m})`);

    if (i < LEVELS.length - 1) {
      await page.click('[data-act="next"]');
      await page.waitForTimeout(250);
    }
  }

  const won = await page.evaluate(() => __blackgate.mode === 'win');
  check(won, 'final chapter ends in the victory screen');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/victory.png` });

  check(errors.length === 0, 'no javascript errors' + (errors.length ? ':\n    ' + errors.join('\n    ') : ''));
  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
