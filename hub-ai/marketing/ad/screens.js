// Takes the app screenshots shown on Minnie's phone in the ad.
// Needs the app served at http://localhost:8765 and a Hub AI Cloud at :8799.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = __dirname + '/build/screens/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage['hubai.settings'] = JSON.stringify({ cloudUrl: 'http://127.0.0.1:8799' }); });
  await p.reload(); await p.waitForTimeout(800);
  // 1. typing a request
  await p.fill('#prompt', 'A banana tracker');
  await p.screenshot({ path: OUT + 'create.png' });
  // 2. the result: a Banana Tracker hub
  await p.evaluate(() => {
    const html = HubTemplates.render('habit', { title: 'Banana Tracker', accent: '#e8b400', dark: true, persist: true, extras: true, n: null, topic: '', key: 'ad', engine: 'Hub V1 Mini' })
      .replace('placeholder="New habit, e.g. Drink water"', 'placeholder="Add a banana habit" value=""');
    const seed = { habits: [{ name: 'Eat a banana', done: {} }, { name: 'Peel like a pro', done: {} }, { name: 'Banana smoothie', done: {} }] };
    const d = new Date(); const k = (n) => { const x = new Date(d); x.setDate(d.getDate() - n); return x.toISOString().slice(0, 10); };
    [0, 1, 2, 3, 5].forEach(n => seed.habits[0].done[k(n)] = 1); [0, 2, 3].forEach(n => seed.habits[1].done[k(n)] = 1); [1, 4].forEach(n => seed.habits[2].done[k(n)] = 1);
    const withData = html.replace('var H=S.get("habits",[])', 'var H=S.get("habits",' + JSON.stringify(seed.habits) + ')');
    localStorage['hubai.draft'] = JSON.stringify({ title: 'Banana Tracker', html: withData, engine: 'mini', engineName: 'Hub V1 Mini', seconds: 4.2, prompt: 'A banana tracker', at: Date.now(), powerups: ['catwalk'], versions: [] });
  });
  await p.reload(); await p.waitForTimeout(900);
  await p.evaluate(() => document.getElementById('result').scrollIntoView());
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + 'result.png' });
  // 3. features
  await p.click('#tabs [data-go=features]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'features.png' });
  // 4. FunHub
  await p.click('#tabs [data-go=funhub]'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 'funhub.png' });
  await p.evaluate(() => document.getElementById('feed').scrollBy(0, document.getElementById('feed').clientHeight));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 'funhub2.png' });
  await b.close();
})();
