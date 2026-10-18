// Spelar igenom Skräckappen i headless Chromium och letar efter fel.
// Användning: node test/playthrough.js [valplan, t.ex. "0,1,0,1"] [utmapp]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const plan = (process.argv[2] || '').split(',').filter(Boolean).map(Number);
const out = process.argv[3] || path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForFunction(() => window.SK && SK.ready);
  await page.evaluate(() => { SK.mini.autopass = true; SK.dir.speed = 'direkt'; });
  const vis = (id) => page.evaluate((id) => !document.getElementById(id).classList.contains('hidden'), id);
  // varning + meny
  await page.click('#overlay .btn');
  await page.waitForSelector('#menu .btn');
  await page.screenshot({ path: path.join(out, '00-meny.png') });
  await page.click('#menu .btn:has-text("Nytt spel")');

  let choiceIdx = 0, steps = 0, shots = 0, levels = 0, lastNode = -1, stuck = 0;
  const seen = new Set();
  for (;;) {
    steps++;
    if (steps > 4000) { errors.push('för många steg – fastnade?'); break; }
    const st = await page.evaluate(() => ({
      mode: SK.game.mode, idx: SK.dir.idx,
      overlay: !document.getElementById('overlay').classList.contains('hidden'),
      overlayText: document.getElementById('overlay').innerText.slice(0, 60),
      choices: !document.getElementById('choices').classList.contains('hidden'),
      phBtns: document.querySelectorAll('#ph-actions .ph-btn').length,
      punish: !document.getElementById('punish').classList.contains('hidden'),
      menu: !document.getElementById('menu').classList.contains('hidden'),
      level: !!(SK.game.level && SK.game.level.state === 'play'),
      bg: SK.stage.bg,
    }));
    if (st.menu && steps > 5) break;
    if (st.idx === lastNode) stuck++; else { stuck = 0; lastNode = st.idx; }
    if (stuck > 200) { errors.push('fast vid nod ' + st.idx); break; }
    const key = st.bg + ':' + st.mode;
    if (!seen.has(key) && st.mode === 'stage') { seen.add(key); await page.waitForTimeout(600); await page.screenshot({ path: path.join(out, String(++shots).padStart(2, '0') + '-' + st.bg + '.png') }); }
    if (st.level) {
      levels++;
      // spela lite på riktigt innan vi fuskar oss i mål
      await page.keyboard.down('KeyD'); await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(900);
      await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft');
      await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
      await page.keyboard.press('KeyF');
      await page.screenshot({ path: path.join(out, 'bana-' + levels + '.png') });
      await page.evaluate(() => SK.game.level && SK.game.level.state === 'play' && SK.game.level.win());
      await page.waitForTimeout(1300);
      continue;
    }
    if (st.overlay) { await page.click('#overlay .row .btn'); await page.waitForTimeout(150); continue; }
    if (st.punish) { await page.click('#punish .btn'); continue; }
    if (st.choices || st.phBtns) {
      const want = plan.length ? plan[choiceIdx % plan.length] : 0;
      choiceIdx++;
      const sel = st.choices ? '#choices .choice' : '#ph-actions .ph-btn';
      const n = await page.locator(sel).count();
      await page.locator(sel).nth(Math.min(want, n - 1)).click();
      continue;
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(25);
  }
  const result = await page.evaluate(() => ({ endings: SK.store.get('endings', []), s: SK.dir.s }));
  console.log(JSON.stringify({ steps, levels, choices: choiceIdx, result, errors }, null, 1));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
