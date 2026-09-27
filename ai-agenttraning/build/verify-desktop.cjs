// Drives the installed Linux desktop app (the .deb) in a real Electron window:
// create and train an agent, quit, start again, and check it remembered.
//   NODE_PATH=$(npm root -g) xvfb-run -a node build/verify-desktop.cjs [binary] [screenshot.png]
const { _electron: electron } = require('playwright');
const bin = process.argv[2] || '/opt/raken-ai-agenttraning/raken-ai-agenttraning';
const shot = process.argv[3];
(async () => {
  const launch = () => electron.launch({ executablePath: bin, args: ['--no-sandbox'], env: { ...process.env, NODE_OPTIONS: '' } });
  let app = await launch();
  let win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  // start empty: stop the app's save-on-close from writing its state back during the reload
  await win.evaluate(() => new Promise(r => {
    Storage.prototype.setItem = () => {}; localStorage.clear();
    const q = indexedDB.deleteDatabase('raken-ai-agenttraning'); q.onsuccess = q.onerror = q.onblocked = () => r();
  }));
  await win.reload();
  await win.click('.card.new');
  await win.fill('#nName', 'Desktopia');
  await win.press('#nName', 'Enter');
  await win.click('.tabs [data-view=train]');
  await win.click('[data-fast="100"]');
  await win.waitForFunction(() => !document.querySelector('[data-fast="100"]').disabled, null, { timeout: 60000 });
  await win.check('#tBrain');
  const title = await win.title();
  const before = await win.evaluate(() => { const a = RakenAI.state().agents[0]; return [a.name, a.brain.episodes, Object.keys(a.brain.q).length]; });
  if (shot) await win.screenshot({ path: shot });
  await win.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await app.close();
  app = await launch();
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  const after = await win.evaluate(() => { const a = RakenAI.state().agents[0]; return a && [a.name, a.brain.episodes, Object.keys(a.brain.q).length]; });
  // the block editor: open the chess example and start it
  await win.click('.tabs [data-view=code]');
  await win.waitForFunction(() => window.RB && RB.E && RB.E.project, null, { timeout: 30000 });
  await win.click('#pExamples'); await win.click('.ex-item:has-text("Schack")');
  await win.waitForFunction(() => RB.E.project.name === 'Schack mot agenten', null, { timeout: 30000 });
  await win.click('#goFlag');
  await win.waitForFunction(() => RB.E.vm.targets.filter(t => t.isClone).length === 32, null, { timeout: 15000 });
  const blocks = await win.evaluate(() => ({ cats: document.querySelectorAll('.scratchCategoryMenuItemLabel').length, pieces: RB.E.vm.targets.filter(t => t.isClone).length }));
  if (shot) await win.screenshot({ path: shot.replace(/\.png$/, '-block.png') });
  await win.evaluate(() => RB.persist(true));
  await app.close();
  app = await launch();
  win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  const projects = await win.evaluate(async () => ((await RB.store.get('projects')) || []).map(p => p.name));
  await app.close();
  console.log('block editor:', JSON.stringify(blocks), ' projects after restart:', JSON.stringify(projects));
  const blocksOk = blocks.cats === 14 && blocks.pieces === 32 && projects.includes('Schack mot agenten');
  console.log(blocksOk ? 'PASS block editor runs the chess example and keeps projects across restarts' : 'FAIL block editor');
  const ok = blocksOk && JSON.stringify(before) === JSON.stringify(after) && before[1] === 100;
  console.log('window title:', title);
  console.log('before restart:', JSON.stringify(before), ' after restart:', JSON.stringify(after));
  console.log(ok ? 'PASS desktop app trains and remembers across restarts' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
