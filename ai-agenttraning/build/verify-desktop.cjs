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
  await win.evaluate(() => localStorage.clear());
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
  await app.close();
  const ok = JSON.stringify(before) === JSON.stringify(after) && before[1] === 100;
  console.log('window title:', title);
  console.log('before restart:', JSON.stringify(before), ' after restart:', JSON.stringify(after));
  console.log(ok ? 'PASS desktop app trains and remembers across restarts' : 'FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
