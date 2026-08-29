/* Renderar en reklamfilm till PNG-rutor.
 *   node tools/render-film.js <namn> [utkatalog]
 * Läser reklam/reklam-<namn>.html och skriver <utkatalog>/frames-<namn>/f00000.png …
 * Utkatalog utan argument blir repots rot. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const namn = process.argv[2];
if (!namn) { console.error('ange filmens namn, t.ex. idrotten'); process.exit(1); }
const bas = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '..');
const dir = path.join(bas, 'frames-' + namn);
const html = path.resolve(__dirname, '../reklam/reklam-' + namn + '.html');

(async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  /* Runnern har en förinstallerad Chromium som inte matchar playwrights egen
   revision, och den går inte att ladda ner härifrån. Finns den, används den. */
  const egen = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const b = await chromium.launch(Object.assign(
    { args: ['--force-device-scale-factor=1', '--hide-scrollbars'] },
    fs.existsSync(egen) ? { executablePath: egen } : {}));
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const fel = [];
  p.on('pageerror', e => fel.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') fel.push(m.text()); });
  await p.goto('file://' + html);
  await p.waitForTimeout(600);
  const DUR = await p.evaluate(() => window.__duration);
  const FPS = 30, total = Math.round(DUR / 1000 * FPS);
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await p.evaluate(ms => window.__seek(ms), (f / FPS) * 1000);
    await p.screenshot({ path: dir + '/f' + String(f).padStart(5, '0') + '.png' });
    if (f % 300 === 0 && f) {
      const el = (Date.now() - t0) / 1000;
      console.log(namn + '  ' + f + '/' + total + '  ' + el.toFixed(0) + 's  (~' + ((el / f) * (total - f)).toFixed(0) + 's kvar)');
    }
  }
  await b.close();
  if (fel.length) { console.error(namn + ': FEL under rendering:\n' + fel.join('\n')); process.exit(1); }
  console.log(namn + ': klart, ' + total + ' rutor på ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
