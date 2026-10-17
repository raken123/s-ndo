// Spelar minispelen med simulerade tangenttryck. Användning: node test/minigames.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForFunction(() => window.SK && SK.ready);
  await page.evaluate(() => { document.getElementById('overlay').classList.add('hidden'); });
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
  const res = {};

  res.avinstallera = await page.evaluate(async () => {
    const p = SK.mini.avinstallera();
    for (let i = 0; i < 3; i++) { await SK.sleep(500); SK.input.press('act'); }
    return p;
  });

  res.kodlas = await page.evaluate(async () => {
    const p = SK.mini.kodlas({ code: '0713', hint: 'tips' });
    await SK.sleep(300);
    for (const d of ['1', '2', '3', '4']) { document.querySelectorAll('.keypad button').forEach((b) => { if (b.textContent === d) b.click(); }); await SK.sleep(80); }
    await SK.sleep(1000);
    for (const d of ['0', '7', '1', '3']) { document.querySelectorAll('.keypad button').forEach((b) => { if (b.textContent === d) b.click(); }); await SK.sleep(80); }
    return p;
  });

  res.notiser = await page.evaluate(async () => {
    const p = SK.mini.notiser({});
    let done = false;
    p.then(() => (done = true));
    for (let i = 0; i < 200 && !done; i++) {
      await SK.sleep(100);
      const real = Array.from(document.querySelectorAll('#mini .bub')).find((b) => b.textContent.includes('Bibblan'));
      if (real) { real.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); break; }
    }
    return p;
  });

  res.hjarta = await page.evaluate(async () => {
    const opts = { beats: 8, bpm: 80, maxMiss: 4 };
    const t0 = performance.now();
    const p = SK.mini.hjarta(opts);
    const iv = 60 / opts.bpm;
    for (let i = 0; i < opts.beats; i++) {
      const at = t0 + (1.2 + i * iv) * 1000 + 16;
      setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 60);
      }, at - performance.now());
    }
    return p;
  });

  res.andas_utan_input = await page.evaluate(() => SK.mini.andas({}));

  res.rosterna = await page.evaluate(async () => {
    const p = SK.mini.rosterna({ allies: 1, lines: ['a', 'b', 'c'] });
    let done = false; p.then(() => (done = true));
    while (!done) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      await SK.sleep(30);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      await SK.sleep(30);
    }
    return p;
  });

  console.log(JSON.stringify({ res, errors }, null, 1));
  await browser.close();
})();
