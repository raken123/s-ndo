// Browser test for the single-file app. Drives the real UI in headless
// Chromium from file://, the same way the HTML build is opened offline.
//
//   NODE_PATH=$(npm root -g) node build/verify.cjs [path/to/app.html] [screenshot-dir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'index.html'));
const shots = process.argv[3];
let failed = 0;
function check(name, ok, extra) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra != null ? '  (' + extra + ')' : ''));
  if (!ok) failed++;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  const shot = async n => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, n + '.png') }); } };

  check('title', (await page.title()) === 'Raken Teknik Åk 4 2026/2027 AI Agentträning');
  const lv = await page.evaluate(() => RakenAI.state().levels.map(l => [l.id, RakenAI.shortest(l)]));
  check('all 5 preset courses are solvable', lv.length === 5 && lv.every(([, d]) => d > 0), JSON.stringify(lv));

  // create an agent through the dialog, confirming with Enter
  await page.click('.card.new');
  await page.fill('#nName', 'Robban');
  await page.press('#nName', 'Enter');
  await page.waitForTimeout(200);
  const a0 = await page.evaluate(() => { const S = RakenAI.state(); const a = S.agents[0]; return { n: S.agents.length, name: a && a.name, nav: RakenAI.navSmart(a), talk: RakenAI.talkSmart(a) }; });
  check('agent created with Enter', a0.n === 1 && a0.name === 'Robban', JSON.stringify(a0));
  check('new agent knows nothing', a0.nav === 0 && a0.talk === 0);
  await shot('1-agents');

  // training: course 1, place memory, 300 fast rounds
  await page.click('.tabs [data-view=train]');
  await page.selectOption('#tLevel', 'l1');
  for (let i = 0; i < 3; i++) {
    await page.click('[data-fast="100"]');
    await page.waitForFunction(() => !document.querySelector('[data-fast="100"]').disabled, null, { timeout: 60000 });
  }
  const s1 = await page.evaluate(() => { const a = RakenAI.state().agents[0]; return { ep: a.brain.episodes, skill: a.brain.skill.l1, mem: Object.keys(a.brain.q).length }; });
  check('300 rounds trained on course 1', s1.ep === 300, JSON.stringify(s1));
  check('agent got smart on course 1 (>= 80 % of perfect)', s1.skill >= 80, s1.skill);

  // exam with the animation at turbo speed
  await page.fill('#tSpeed', '100');
  await page.dispatchEvent('#tSpeed', 'input');
  await page.click('#tTest');
  await page.waitForFunction(() => /^Prov: /.test(document.querySelector('#tStatus').textContent), null, { timeout: 15000 });
  const st = await page.textContent('#tStatus');
  check('exam reaches the goal', /Hittade målet/.test(st), st.trim());
  await page.check('#tBrain');
  await page.waitForTimeout(300);
  await shot('2-train');

  // the maze needs more practice
  await page.selectOption('#tLevel', 'l4');
  await page.click('[data-fast="1000"]');
  await page.waitForFunction(() => !document.querySelector('[data-fast="1000"]').disabled, null, { timeout: 120000 });
  const s4 = await page.evaluate(() => RakenAI.state().agents[0].brain.skill.l4);
  check('learns the maze after 1000 rounds', s4 > 0, s4);

  // drive mode: arrow keys move the agent and teach it
  await page.selectOption('#tLevel', 'l1');
  await page.click('#tDrive');
  const before = await page.evaluate(() => RakenAI.state().agents[0].brain.episodes);
  for (let i = 0; i < 13; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => RakenAI.state().agents[0].brain.episodes);
  check('driving to the goal with arrow keys counts as a lesson', after === before + 1, `${before} -> ${after}`);
  await page.click('#tStop');

  // senses mode generalises: train on course 1+2, check it can try course 2
  await page.click('[data-mode="sinnen"]');
  await page.click('[data-fast="-1"]');
  await page.waitForFunction(() => !document.querySelector('[data-fast="-1"]').disabled, null, { timeout: 120000 });
  const sk = await page.evaluate(() => RakenAI.state().agents[0].brain.skill);
  check('senses brain passes at least one course', Object.values(sk).some(v => v > 0), JSON.stringify(sk));
  await page.click('[data-mode="plats"]');

  // build: paint, commands, map code
  await page.click('.tabs [data-view=build]');
  await page.click('#bNew'); await page.fill('#askInput', 'Testbana'); await page.press('#askInput', 'Enter');
  await page.waitForTimeout(100);
  await page.click('[data-code=cmd]');
  await page.click('#cmdExample');
  await page.click('#cmdRun');
  const lvOk = await page.evaluate(() => { const S = RakenAI.state(); const l = S.levels.find(l => l.name === 'Testbana'); return l && [RakenAI.levelProblem(l), RakenAI.shortest(l), l.rows[8][7], l.rows[2][4]]; });
  check('command code builds a valid course', lvOk && lvOk[0] === '' && lvOk[1] > 0 && lvOk[2] === 'L' && lvOk[3] === 'o', JSON.stringify(lvOk));
  await page.fill('#cmdCode', 'upprepa 2 {\n  vägk 1 1\n}');
  await page.click('#cmdRun');
  const err = await page.textContent('#cmdErr');
  check('command errors are explained in Swedish', /Rad 2/.test(err) && /vägk/.test(err), err);
  await page.fill('#cmdCode', 'rensa\nupprepa 3 {\n  upprepa 2 {\n    vägg i+1 j+1\n  }\n}');
  await page.click('#cmdRun');
  const nested = await page.evaluate(() => { const l = RakenAI.state().levels.find(l => l.name === 'Testbana'); return l.rows.slice(1, 5).map(r => r.slice(0, 4)); });
  check('nested loops use i and j', JSON.stringify(nested) === JSON.stringify(['.##.', '.##.', '.##.', '....']), JSON.stringify(nested));
  await page.click('[data-code=map]');
  await page.fill('#mapCode', '#######\n#S...M#\n#######\n#.....#\n#######');
  await page.click('#mapApply');
  const mp = await page.evaluate(() => { const l = RakenAI.state().levels.find(l => l.name === 'Testbana'); return [l.w, l.h, RakenAI.shortest(l)]; });
  check('map code builds the course', JSON.stringify(mp) === '[7,5,4]', JSON.stringify(mp));
  // paint a wall with the mouse on the canvas
  await page.click('.tool:has-text("Vägg")');
  const box = await page.locator('#bCanvas').boundingBox();
  const cs = box.width / 7;
  await page.mouse.click(box.x + cs * 3.5, box.y + cs * 1.5);
  const painted = await page.evaluate(() => RakenAI.state().levels.find(l => l.name === 'Testbana').rows[1]);
  check('mouse painting', painted === '#S.#.M#', painted);
  const status = await page.textContent('#bStatus');
  check('builder warns when the goal is unreachable', /ingen väg/.test(status), status.trim());
  await page.selectOption('#bLevel', 'l4');
  await shot('3-build');

  // talk
  await page.click('.tabs [data-view=talk]');
  await page.fill('#cInput', 'hej'); await page.press('#cInput', 'Enter');
  const first = await page.evaluate(() => RakenAI.state().agents[0].talk.log.slice(-1)[0]);
  check('knows no words at first (babbles)', first.from === 'babble', first.text);
  await page.click('#pStarter');
  await page.fill('#cInput', 'Hej!'); await page.press('#cInput', 'Enter');
  await page.fill('#cInput', 'vad heter du?'); await page.press('#cInput', 'Enter');
  const log = await page.evaluate(() => RakenAI.state().agents[0].talk.log.slice(-3).map(m => m.text));
  check('answers a taught greeting', log[0] === 'Hej! Vad kul att du pratar med mig.', log[0]);
  check('fills in its own name', log[2] === 'Jag heter Robban!', log[2]);
  await page.fill('#pQ', 'vad är din favoritfärg'); await page.fill('#pA', 'Blå, som himlen!'); await page.click('#pForm button[type=submit]');
  await page.fill('#cInput', 'Vilken favoritfärg har du?'); await page.press('#cInput', 'Enter');
  const fav = await page.evaluate(() => RakenAI.state().agents[0].talk.log.slice(-1)[0].text);
  check('matches a question worded differently', fav === 'Blå, som himlen!', fav);
  await page.click('[data-sample=rymden]'); await page.click('#rRead');
  await page.fill('#cInput', 'berätta om planeten'); await page.press('#cInput', 'Enter');
  const gen = await page.evaluate(() => RakenAI.state().agents[0].talk.log.slice(-1)[0]);
  check('makes up a sentence from what it read', gen.from === 'gen' && gen.text.split(' ').length >= 2, gen.text);
  // teach a better answer through the chat
  await page.locator('.msg .meta button:has-text("Lär mig")').last().click();
  await page.fill('.teach input', 'Jupiter är den största planeten.'); await page.press('.teach input', 'Enter');
  await page.fill('#cInput', 'berätta om planeten'); await page.press('#cInput', 'Enter');
  const taught = await page.evaluate(() => RakenAI.state().agents[0].talk.log.slice(-1)[0].text);
  check('learns a corrected answer from the chat', taught === 'Jupiter är den största planeten.', taught);
  await page.locator('.msg .meta button:has-text("👍")').last().click();
  const talkNow = await page.evaluate(() => RakenAI.talkSmart(RakenAI.state().agents[0]));
  check('talk smartness went up', talkNow > 20, talkNow);
  await shot('4-talk');

  // everything survives a restart
  const q1 = await page.evaluate(() => Object.keys(RakenAI.state().agents[0].brain.q).length);
  await page.waitForTimeout(600);
  await page.reload();
  const q2 = await page.evaluate(() => { const a = RakenAI.state().agents[0]; return [Object.keys(a.brain.q).length, a.talk.pairs.length, RakenAI.state().levels.length]; });
  check('brain, answers and courses survive a restart', q2[0] === q1 && q2[1] === 9 && q2[2] === 6, JSON.stringify([q1, ...q2]));

  // export the agent to a file and import it back
  await page.click('.tabs [data-view=agents]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.card button[title="Spara som fil"]')]);
  const tmp = path.join(require('os').tmpdir(), 'robban.aiagent.json');
  await dl.saveAs(tmp);
  await page.setInputFiles('#fileIn', []); // reset
  await page.evaluate(() => document.querySelector('#btnImportAgent').click());
  await page.setInputFiles('#fileIn', tmp);
  await page.waitForTimeout(300);
  const imp = await page.evaluate(() => RakenAI.state().agents.map(a => [a.name, Object.keys(a.brain.q).length]));
  check('agent file round-trips', imp.length === 2 && imp[1][1] === imp[0][1] && imp[1][0] === 'Robban', JSON.stringify(imp));
  await shot('5-agents-trained');

  // phone width: no horizontal scrolling
  await page.setViewportSize({ width: 390, height: 800 });
  for (const v of ['agents', 'build', 'train', 'talk']) {
    await page.click(`.tabs [data-view=${v}]`);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no sideways scroll on a phone: ${v}`, over <= 0, over);
  }
  await page.click('.tabs [data-view=train]');
  await shot('6-phone-train');

  // dark mode renders
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.click('.tabs [data-view=train]');
  await page.waitForTimeout(200);
  await shot('7-dark-train');

  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
