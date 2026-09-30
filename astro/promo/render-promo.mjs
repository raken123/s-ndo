// Renderar reklamfilmens bildrutor med Playwright/Chromium.
//   node render-promo.mjs <utmapp> [bredd] [höjd] [ruta1,ruta2,...]
// Kräver att repots rot serveras på http://localhost:8123 (t.ex. `npx http-server -p 8123`).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [outDir = 'frames', w = '1920', h = '1080', only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://localhost:8123/astro/promo/trailer.html?w=${w}&h=${h}`);
await page.waitForFunction(() => window.promo?.ready, null, { timeout: 300000 });
const { FPS, DURATION } = await page.evaluate(() => ({ FPS: window.promo.FPS, DURATION: window.promo.DURATION }));
const frames = only ? only.split(',').map(Number) : [...Array(FPS * DURATION).keys()];
const events = [];
const t0 = Date.now();
for (const f of frames) {
  const { url, info } = await page.evaluate((f) => { const info = window.promo.renderFrame(f); return { url: window.promo.frameJPEG(0.94), info }; }, f);
  fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  events.push({ f, ...info });
  if (f % 30 === 0) console.log(`ruta ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(events));
await browser.close();
console.log('klart');
