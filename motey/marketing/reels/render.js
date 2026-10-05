// Renderar reklamens bildrutor: node render.js <utmapp>
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const out = path.resolve(process.argv[2] || 'frames'), FPS = 30;
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'ad.html')); await p.waitForTimeout(500);
  const n = Math.round(await p.evaluate(() => window.DURATION) * FPS);
  for (let i = 0; i < n; i++) {
    const d = await p.evaluate(t => { draw(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, i / FPS);
    fs.writeFileSync(`${out}/f${String(i).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
  }
  console.log('frames', n, errs.join('\n') || 'no errors'); await b.close();
})();
