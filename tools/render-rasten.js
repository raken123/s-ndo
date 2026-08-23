/* Renderar reklam/reklam-rasten.html till PNG-rutor: node tools/render-rasten.js */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const dir = path.resolve(__dirname, '../frames3');
(async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ args: ['--force-device-scale-factor=1', '--hide-scrollbars'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + path.resolve(__dirname, '../reklam/reklam-rasten.html'));
  await p.waitForTimeout(600);
  const DUR = await p.evaluate(() => window.__duration);
  const FPS = 30, total = Math.round(DUR / 1000 * FPS);
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await p.evaluate(ms => window.__seek(ms), (f / FPS) * 1000);
    await p.screenshot({ path: dir + '/f' + String(f).padStart(5, '0') + '.png' });
    if (f % 150 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(f + '/' + total + '  ' + el.toFixed(0) + 's  (~' + ((el / Math.max(1, f)) * (total - f)).toFixed(0) + 's kvar)');
    }
  }
  console.log('klart: ' + total + ' rutor på ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await b.close();
})();
