// Skärmbilder i en emulerad mobil i liggande läge (som Android-appen).
const { chromium, devices } = require('playwright');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, 'out');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 780, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await p.waitForFunction(() => window.SK && SK.ready);
  await p.tap('#overlay .btn');
  await p.screenshot({ path: out + '/m-meny.png' });
  await p.tap('#menu .btn:has-text("Nytt spel")');
  for (let i = 0; i < 9; i++) { await p.tap('#stage', { position: { x: 300, y: 120 } }); await p.waitForTimeout(400); }
  await p.screenshot({ path: out + '/m-dialog.png' });
  // hoppa till kapitel 1 och mobilen
  await p.evaluate(() => { const c = SK.dir.chapters().find((x) => x.ch === 1); SK.dir.start(c.idx + 20, SK.dir.newState()); });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { await p.tap('#stage', { position: { x: 200, y: 120 } }); await p.waitForTimeout(900); }
  await p.screenshot({ path: out + '/m-mobil.png' });
  // en bana med pekkontroller
  await p.evaluate(() => { SK.dir.toMenu(); SK.ui.hideMenu(); const lv = new SK.Level('kallare', { done() {}, lost() {}, pause() {} }); SK.game.level = lv; SK.game.mode = 'level'; lv.start(); SK.dir.levelUI && 0; document.getElementById('hud').classList.remove('hidden'); document.getElementById('touch').classList.toggle('hidden', !SK.input.touchMode); document.getElementById('hud-goal').textContent = lv.def.short; });
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/m-bana.png' });
  console.log(JSON.stringify({ touch: await p.evaluate(() => SK.input.touchMode), errs }));
  await b.close();
})();
