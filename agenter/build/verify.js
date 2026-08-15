/* Drives the built single-file HTML in headless Chromium from file://, which is
 * the origin the desktop builds actually run under.
 *
 * Run:  node build/verify.js  [path-to-html]
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const FILE = process.argv[2] ||
  path.join(__dirname, '..', 'dist', 'agenter-1.0.0.html');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
}

(async () => {
  if (!fs.existsSync(FILE)) {
    console.error('no such file: ' + FILE);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('file://' + FILE);
  await page.waitForSelector('#prompt');

  console.log('\nboot');
  check('no page errors on load', errors.length === 0, errors.join(' | '));
  check('globals present', await page.evaluate(() =>
    !!(window.AGENTER && AGENTER.Agent && AGENTER.Paywall && AGENTER.Video &&
       AGENTER.Device && AGENTER.Store && AGENTER.Gemini)));
  check('starts on the free plan', await page.evaluate(() => AGENTER.Store.plan()) === 'free');
  check('mascot rendered', await page.locator('#brandMark svg').count() === 1);
  check('deal card shows 75% off',
    /75% off/.test(await page.locator('#dealCard').innerText()));

  console.log('\ntrigger words open the paywall mid-typing, before Send');
  const phrases = {
    '3D game':        'make me a 3D game about cats',
    'Cordova app':    'build a cordova app for my shop',
    'Video':          'i want a video of my trip',
    'Animation':      'add an animation to the header',
    'Device control': 'give me device control over the torch'
  };
  for (const [label, phrase] of Object.entries(phrases)) {
    await page.evaluate(() => { AGENTER.Store.setPlan('free'); });
    await page.fill('#prompt', '');
    await page.click('#prompt');
    await page.type('#prompt', phrase, { delay: 4 });
    let opened = false;
    try {
      await page.waitForSelector('#paywall:not([hidden])', { timeout: 2500 });
      opened = true;
    } catch (e) { /* stays closed */ }
    const label2 = opened ? await page.locator('#pwReason').innerText() : '';
    check('"' + phrase + '" opens the page', opened && label2.includes(label), label2);

    if (opened) {
      // Leaving by any route wipes the composer.
      await page.click('#pwClose');
      await page.waitForSelector('#paywall[hidden]', { state: 'attached' });
      check('  leaving cleared the prompt',
        (await page.inputValue('#prompt')) === '', JSON.stringify(await page.inputValue('#prompt')));
    }
  }

  console.log('\nordinary prompts are left alone');
  for (const ok of ['refactor this python function', 'why is my build failing',
                    'provide a summary of the readme', 'explain 3d printing']) {
    await page.fill('#prompt', '');
    await page.type('#prompt', ok, { delay: 2 });
    await page.waitForTimeout(320);
    check('"' + ok + '" does not trigger',
      await page.locator('#paywall[hidden]').count() === 1);
  }
  await page.fill('#prompt', '');

  console.log('\nescape routes all erase');
  for (const route of ['escape', 'backdrop', 'leave-link']) {
    await page.evaluate(() => AGENTER.Store.setPlan('free'));
    await page.fill('#prompt', 'make a video');
    await page.waitForSelector('#paywall:not([hidden])');
    if (route === 'escape') await page.keyboard.press('Escape');
    if (route === 'backdrop') await page.locator('#paywall').click({ position: { x: 8, y: 8 } });
    if (route === 'leave-link') await page.click('#pwLeave');
    await page.waitForSelector('#paywall[hidden]', { state: 'attached' });
    check(route + ' erases the prompt', (await page.inputValue('#prompt')) === '');
  }

  console.log('\nfree plan refuses, Pro delivers');
  await page.evaluate(() => AGENTER.Store.setPlan('free'));
  await page.evaluate(() => { AGENTER.Store.setPlan('free'); });
  const refusal = await page.evaluate(async () => {
    const r = await AGENTER.Agent.respond('make a video of my cat', []);
    return r.blocks[0];
  });
  check('free + video is refused', refusal.type === 'refusal', JSON.stringify(refusal.type));

  await page.evaluate(() => AGENTER.Store.setPlan('pro'));
  const proVideo = await page.evaluate(async () => {
    const r = await AGENTER.Agent.respond('make a video of my cat', []);
    return r.blocks.map(b => b.type + (b.kind ? ':' + b.kind : ''));
  });
  check('pro + video produces an artifact',
    proVideo.some(t => t.startsWith('artifact:Video')), proVideo.join(','));

  console.log('\nthe generated video is a real standalone document');
  const videoHTML = await page.evaluate(() =>
    AGENTER.Video.buildHTML(AGENTER.Video.specFromPrompt('a video about shipping faster')));
  check('has a doctype and a canvas',
    /^<!DOCTYPE html>/.test(videoHTML) && /<canvas/.test(videoHTML));
  check('records through MediaRecorder', /MediaRecorder/.test(videoHTML));
  check('fetches nothing at runtime',
    !/\bfetch\(|<script src=|<link [^>]*href="http/.test(videoHTML));

  const vpage = await browser.newPage();
  const verrs = [];
  vpage.on('pageerror', e => verrs.push(String(e)));
  await vpage.setContent(videoHTML);
  await vpage.waitForTimeout(1200);
  const painted = await vpage.evaluate(() => {
    const c = document.getElementById('v');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) {
      seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    }
    return seen.size;
  });
  check('the video canvas paints', painted > 40, painted + ' distinct colours');
  check('the video page has no errors', verrs.length === 0, verrs.join(' | '));
  await vpage.close();

  console.log('\nthe 3D game scaffold runs');
  const gameHTML = await page.evaluate(async () => {
    AGENTER.Store.setPlan('pro');
    const r = await AGENTER.Agent.respond('build a 3D game', []);
    const a = r.blocks.filter(b => b.type === 'artifact')[0];
    return a ? a.html : '';
  });
  check('a game artifact came back', gameHTML.length > 500, gameHTML.length + ' bytes');
  const gpage = await browser.newPage();
  const gerrs = [];
  gpage.on('pageerror', e => gerrs.push(String(e)));
  await gpage.setContent(gameHTML);
  await gpage.waitForTimeout(1000);
  const gpaint = await gpage.evaluate(() => {
    const c = document.getElementById('g');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 89) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    return seen.size;
  });
  check('the game renders 3D', gpaint > 40, gpaint + ' distinct colours');
  check('the game page has no errors', gerrs.length === 0, gerrs.join(' | '));
  await gpage.close();

  console.log('\nusage: Pro is 5x free');
  const limits = await page.evaluate(() => {
    AGENTER.Store.setPlan('free'); const f = AGENTER.Store.limit();
    AGENTER.Store.setPlan('pro');  const p = AGENTER.Store.limit();
    return { f, p };
  });
  check('pro limit is 5x the free limit', limits.p === limits.f * 5,
    limits.f + ' -> ' + limits.p);

  console.log('\nbuying from the page keeps the prompt');
  await page.evaluate(() => AGENTER.Store.setPlan('free'));
  await page.reload();
  await page.waitForSelector('#prompt');
  await page.fill('#prompt', 'make a video about our launch');
  await page.waitForSelector('#paywall:not([hidden])');
  await page.click('#pwBuy');
  await page.waitForSelector('#paywall[hidden]', { state: 'attached' });
  check('plan flipped to pro', await page.evaluate(() => AGENTER.Store.plan()) === 'pro');
  check('prompt survived the purchase',
    (await page.inputValue('#prompt')) === 'make a video about our launch');
  // innerText reflects text-transform: uppercase, so compare case-insensitively.
  check('badge reads Pro',
    (await page.locator('#planBadge').innerText()).trim().toLowerCase() === 'pro');

  console.log('\npro typing no longer opens the page');
  await page.fill('#prompt', '');
  await page.type('#prompt', 'build a 3D game and an animation', { delay: 3 });
  await page.waitForTimeout(400);
  check('paywall stays shut on Pro',
    await page.locator('#paywall[hidden]').count() === 1);
  check('hint shows the unlocked capability',
    /unlocked on Pro/.test(await page.locator('#triggerHint').innerText()));

  console.log('\nno API key is baked into the build');
  const src = fs.readFileSync(FILE, 'utf8');
  check('no AIza… literal in the bundle', !/AIza[0-9A-Za-z_\-]{30,}/.test(src));
  check('key starts empty', await page.evaluate(() => AGENTER.Store.apiKey()) === '');

  check('no errors accumulated', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) {
    console.log('failed: ' + failed.map(f => f.name).join('; '));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
