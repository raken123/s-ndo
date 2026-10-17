// Kör varje bana med en enkel bot som styr Kasper. Kontrollerar att inget kraschar
// och att banorna går att klara. Användning: node test/levels.js [utmapp]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForFunction(() => window.SK && SK.ready);
  const ids = await page.evaluate(() => Object.keys(SK.LEVELS));
  const results = {};
  for (const id of ids) {
    const runs = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await page.evaluate((id) => new Promise((resolve) => {
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('menu').classList.add('hidden');
        const t0 = performance.now();
        let lv;
        const hooks = { done: (x) => finish('win'), lost: (why) => finish(why), pause: () => {} };
        const finish = (res) => { clearInterval(bot); SK.input.stick.on = false; SK.input.virt.run = false; resolve({ res, secs: Math.round((performance.now() - t0) / 100) / 10, got: lv.got, need: lv.need }); };
        lv = new SK.Level(id, hooks);
        SK.game.level = lv; SK.game.mode = 'level';
        lv.start();
        const TS = SK.TS;
        const bot = setInterval(() => {
          if (lv.state !== 'play') return;
          const p = lv.player;
          if (p.hidden) { SK.input.press('act'); return; }
          const left = lv.items.filter((i) => !i.got);
          let tgt = left.length ? left.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : lv.exit;
          const bat = lv.bats.find((b) => !b.got && Math.hypot(b.x - p.x, b.y - p.y) < 80 && p.bat < 50);
          if (bat) tgt = bat;
          const tx = Math.floor(tgt.x / TS), ty = Math.floor((tgt.y - 3) / TS);
          const d = lv.flow(tx, ty);
          const px = Math.floor(p.x / TS), py = Math.floor((p.y - 3) / TS);
          const here = d[px + py * lv.w];
          let gx = tgt.x, gy = tgt.y;
          if (here > 0) {
            let best = here;
            for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const v = d[(px + ax) + (py + ay) * lv.w];
              if (v >= 0 && v < best) { best = v; gx = (px + ax) * TS + 8; gy = (py + ay) * TS + 11; }
            }
          }
          const vx = gx - p.x, vy = gy - p.y, m = Math.hypot(vx, vy) || 1;
          SK.input.stick.on = true; SK.input.stick.x = vx / m; SK.input.stick.y = vy / m;
          const danger = lv.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 90 && (e.type !== 'lydig' || e.state === 'chase'));
          SK.input.virt.run = danger || (!lv.def.dark && p.stam > 40);
          if (lv.def.dark) {
            // lampan på när Pantern är nära och framför oss
            const pan = lv.enemies.find((e) => e.type === 'panther');
            if (pan) { const near = Math.hypot(pan.x - p.x, pan.y - p.y) < 70; if (near !== p.light && p.bat > 5) SK.input.press('light'); }
          }
        }, 50);
        setTimeout(() => { if (lv.state === 'play') { lv.state = 'x'; finish('timeout'); } }, 70000);
      }), id);
      runs.push(r);
      if (attempt === 0) await page.screenshot({ path: path.join(out, 'lvl-' + id + '.png') });
      if (r.res === 'win') break;
    }
    results[id] = runs;
    console.log(id, JSON.stringify(runs));
  }
  console.log('errors:', JSON.stringify(errors));
  await browser.close();
})();
