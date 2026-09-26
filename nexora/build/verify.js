// Drives the built nexora/index.html in headless Chromium.
//   node nexora/build/verify.js [path/to/nexora.html]
// Screenshots go to $SHOTS (default: nexora/build/shots).
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) failed++; };

// A mocked Claude Messages API: answers like the real models would, based on what was asked.
const GAME = (title, body) => '<!doctype html><html><head><title>' + title + '</title></head><body style="margin:0"><canvas id="c" width="300" height="200"></canvas><script>var t=0,x=document.getElementById("c").getContext("2d");(function f(){t+=4;x.fillStyle="hsl("+t%360+",70%,50%)";x.fillRect(0,0,300,200);x.fillStyle="#fff";x.fillRect(t%300,90,20,20);' + (body || '') + 'requestAnimationFrame(f)})()</' + 'script></body></html>';
const MOCK = GAME('Mock-spelet');
const BROKEN = '<!doctype html><html><head><title>Trasigt</title></head><body><canvas id="c"></canvas><script>var x=document.getElementById("c").getContext("2d");requestAnimationFrame(function f(){ undefinedPlayer.move(); })</' + 'script></body></html>';
const SVG4 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 256" data-frames="4"><defs><filter id="g"><feGaussianBlur stdDeviation="4"/></filter></defs>' + [0, 1, 2, 3].map(i => '<circle cx="' + (128 + i * 256) + '" cy="' + (128 + (i % 2) * 10) + '" r="70" fill="none" stroke="#0ff" stroke-width="10" filter="url(#g)"/>').join('') + '</svg>';
const MESH = { name: 'Skattkista', vertices: [[-1, 0, -0.6], [1, 0, -0.6], [1, 0, 0.6], [-1, 0, 0.6], [-1, 1.2, -0.6], [1, 1.2, -0.6], [1, 1.2, 0.6], [-1, 1.2, 0.6]],
  faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], colors: ['#5a3a1a', '#d4a017', '#8b5a2b', '#8b5a2b', 'fc0', 'not-a-colour'] };
const SCORE = { title: 'Pizzarusch', bpm: 140, bars: 4, tracks: [{ name: 'melodi', wave: 'square', volume: 0.6, notes: [[0, 72, 1, 1], [1, 76, 1, 0.8], [2, 79, 2, 1], [4, 77, 1, 1], [8, 72, 4, 1]] }, { name: 'bas', wave: 'triangle', volume: 0.8, notes: [[0, 48, 2], [4, 53, 2], [8, 55, 2], [12, 48, 4]] }],
  drums: [[0, 'kick'], [1, 'snare'], [2, 'kick'], [3, 'snare'], [0.5, 'hat', 0.5]] };
const SFX = { name: 'Slemmig dörr', layers: [{ wave: 'sawtooth', start: 0, duration: 0.5, freq: [180, 60], volume: 0.6, filter: { type: 'lowpass', freq: [1200, 300] } }, { wave: 'noise', start: 0.05, duration: 0.3, volume: 0.3, filter: { type: 'bandpass', freq: 800 } }] };
const TOY = GAME('Färgspelet');
const sse = evs => evs.map(e => 'event: ' + (e.type || 'x') + '\ndata: ' + JSON.stringify(e) + '\n\n').join('');
const textTurn = (text, thinking) => [{ type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [] } }]
  .concat(thinking ? [{ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Planerar spelet…' } }, { type: 'content_block_stop', index: 0 }] : [],
    [{ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(0, 30) } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(30) } },
      { type: 'content_block_stop', index: 1 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 99 } }, { type: 'message_stop' }]);
const toolTurn = (block, json) => [{ type: 'message_start', message: { id: 'msg_a', content: [] } }].concat(block, [{ type: 'message_delta', delta: { stop_reason: 'tool_use' } }, { type: 'message_stop' }]);
// Astryx: write_game → run_game → finish, chosen from how far the conversation has come.
function agentTurn(n) {
  const writeJson = JSON.stringify({ title: 'Färgspelet', html: TOY });
  if (n === 1) return toolTurn([{ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Jag börjar med ett enkelt spel.' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig123' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_1', name: 'write_game', input: {} } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: writeJson.slice(0, 40) } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: writeJson.slice(40) } },
    { type: 'content_block_stop', index: 1 }]);
  if (n === 3) return toolTurn([{ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_2', name: 'run_game', input: {} } }, { type: 'content_block_stop', index: 0 }]);
  return toolTurn([{ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_3', name: 'finish', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"summary":"Klart och testat."}' } }, { type: 'content_block_stop', index: 0 }]);
}
const sent = [], gameQueue = [];
let apiMode = 'ok';
function claude(body) {
  if (apiMode === 'refusal') return [{ type: 'message_start', message: { id: 'msg_2', content: [] } }, { type: 'message_delta', delta: { stop_reason: 'refusal' } }, { type: 'message_stop' }];
  if (body.tools) return agentTurn(body.messages.length);
  const sys = body.system, user = body.messages[0].content, think = !!body.thinking;
  if (/AI game studio/.test(sys)) return textTurn('Här är spelet:\n```html\n' + (/These errors were captured/.test(user) ? MOCK : gameQueue.shift() || MOCK) + '\n```', think);
  if (/Nexora Image/.test(sys)) return textTurn(SVG4, think);
  if (/3D modeller/.test(sys)) return textTurn('```json\n' + JSON.stringify(MESH) + '\n```', think);
  if (/composer/.test(sys)) return textTurn(JSON.stringify(SCORE), think);
  if (/sound designer/.test(sys)) return textTurn(JSON.stringify(SFX), think);
  if (/one short spoken line/.test(user)) return textTurn('Pizzan är klar – spring!', think);
  return textTurn('# Pizzarusch\n\n**Akt 1 – Ugnen.** Allt börjar i en food truck.', think);
}
const today = () => new Date().toISOString().slice(0, 7);

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.route('https://api.anthropic.com/v1/messages', async route => {
    const req = route.request(), body = JSON.parse(req.postData());
    sent.push({ headers: req.headers(), body });
    if (apiMode === '401') return route.fulfill({ status: 401, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}' });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(claude(body)) });
  });
  await page.goto('file://' + FILE);
  await page.waitForSelector('header.top');
  ok(await page.evaluate(() => !!(window.Nexora && window.NexoraAI && window.NexoraMedia && window.Nx3D) && !window.NexoraLocal && typeof NexoraRuntime === 'undefined'), 'app globals present, no offline generator');
  ok(!/NexoraLocal|gamePlatformer|Nexora Local|12 speltyper/.test(fs.readFileSync(FILE, 'utf8')), 'the built app contains no offline generator or game templates');

  for (const r of ['hem', 'studio', 'verktyg', 'spel', 'team', 'modeller', 'priser', 'ladda-ner']) {
    await page.evaluate(x => { location.hash = x; }, r);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, 'view-' + r + '.png'), fullPage: r === 'hem' || r === 'priser' });
  }
  ok(errors.length === 0, 'all views render without errors ' + (errors.length ? JSON.stringify(errors) : ''));

  // what's new in 1.5
  await page.evaluate(() => { location.hash = 'hem'; });
  await page.click('text=Nexora 1.5 är här');
  ok(await page.locator('.modal', { hasText: 'Vilket spel som helst' }).count() === 1, 'the 1.5 news dialog opens and says any game can be made');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = 'modeller'; });
  await page.waitForTimeout(200);
  const models = await page.locator('main').innerText();
  ok(models.includes('Nexora Flash 1.5') && models.includes('inga mallar') && !/offline|Local/.test(models), 'models page: 1.5 names, AI only');

  // no AI connected yet: Studio asks for one instead of generating
  await page.evaluate(() => { localStorage.setItem('nexora.settings', '{"provider":"local"}'); location.hash = 'studio'; location.reload(); });
  await page.waitForSelector('#prompt');
  ok(await page.evaluate(() => Nexora.S.settings.provider) === 'anthropic', 'old offline setting migrates to Claude');
  ok(await page.locator('.connect', { hasText: 'Koppla in en AI' }).isVisible(), 'Studio shows "connect an AI"');
  await page.fill('#prompt', 'Laga pizzor åt otåliga kunder');
  await page.click('text=✨ Skapa spel');
  ok(await page.locator('.modal', { hasText: 'Nexora skapar alla spel med AI' }).count() === 1 && sent.length === 0, 'without an AI the settings dialog opens and nothing is generated');
  ok((await page.locator('.modal select option').allTextContents()).join('|') === 'Anthropic (Claude) – egen API-nyckel|Egen endpoint (OpenAI-kompatibel) – t.ex. din Colab-modell', 'settings offer only AI providers');
  await page.screenshot({ path: path.join(SHOTS, 'connect-ai.png') });
  await page.keyboard.press('Escape');

  // plan gating on Free
  await page.click('.seg[aria-label=Dimension] button:nth-child(2)');
  ok(await page.$('.modal') !== null, 'Free plan: 3D opens the upgrade dialog');
  await page.keyboard.press('Escape');

  // connect Claude through the settings dialog, unlock everything and generate an unusual game
  await page.evaluate(() => { localStorage.setItem('nexora.plan', '"enterprise"'); localStorage.setItem('nexora.studio', JSON.stringify({ model: 'core', dim: '2d', opts: {}, prompt: '' })); location.reload(); });
  await page.waitForSelector('#prompt');
  await page.click('button[title=Inställningar]');
  await page.fill('.modal input[type=password]', 'sk-ant-test');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await page.waitForSelector('#prompt');
  const IDEA = 'Laga pizzor åt otåliga kunder i en food truck';
  await page.fill('#prompt', IDEA);
  gameQueue.push(GAME('Pizzarusch'));
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.screen iframe', { timeout: 15000 });
  const r0 = sent[0];
  ok(sent.length === 1 && r0.body.messages[0].content.startsWith('Game idea: ' + IDEA), 'the idea is sent to the AI word for word');
  ok(/any genre, mechanic, setting or mix of them/.test(r0.body.system) && /Never swap the idea/.test(r0.body.system), 'the AI is told to build exactly the described game, any genre');
  ok(r0.body.model === 'claude-opus-5' && r0.body.stream === true && r0.body.thinking && r0.body.thinking.type === 'adaptive' && r0.body.output_config.effort === 'xhigh', 'Core 1.5 request: opus-5, streaming, adaptive thinking, xhigh effort');
  ok(r0.headers['x-api-key'] === 'sk-ant-test' && r0.headers['anthropic-version'] === '2023-06-01' && r0.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'auth + version + browser headers');
  ok(r0.body.fallbacks === 'default' && r0.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01', 'refusal fallback opted in');
  ok(await page.locator('.bar .title').innerText() === 'Pizzarusch', 'game title taken from the generated HTML');
  const frame = page.frames().find(f => f !== page.mainFrame());
  ok(!!frame && !!(await frame.$('canvas')), 'Studio shows the generated game in the preview');
  await page.screenshot({ path: path.join(SHOTS, 'studio-generated.png') });
  ok(await page.evaluate(() => Nexora.games.all().then(a => a.length)) === 1, 'generated game saved to the library');
  ok(await page.evaluate(m => JSON.parse(localStorage.getItem('nexora.usage'))[m], today()) === 1, 'monthly usage counted');

  // code editor, versions, bugfix (AI), exports
  await page.click('text=</> Kod');
  ok(await page.locator('.modal textarea.code').inputValue().then(v => v.includes('<title>Pizzarusch</title>')), 'code editor shows the game source');
  await page.click('text=Spara och kör');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => Nexora.games.all().then(a => a[0].versions.length)) === 1, 'saving code keeps the previous version');
  const beforeFix = sent.length;
  await page.click('text=🐞 Buggfix');
  await page.waitForSelector('text=Klart. Fel efter fix: 0', { timeout: 15000 });
  ok(sent.length === beforeFix + 1 && /review the code/.test(sent[beforeFix].body.messages[0].content), 'bugfix runs the game and asks the AI to review and fix it');
  await page.keyboard.press('Escape');
  for (const label of ['PC (Windows, macOS, Linux)', 'Steam', 'Mobil (PWA)', 'Xbox']) {
    await page.click('text=📦 Exportera');
    const card = page.locator('.modal .card .card', { hasText: label });
    const [dl] = await Promise.all([page.waitForEvent('download'), card.locator('button').click()]);
    const p = path.join(SHOTS, dl.suggestedFilename());
    await dl.saveAs(p);
    let good = false;
    try { execFileSync('unzip', ['-tq', p]); good = true; } catch (e) { good = false; }
    ok(good, 'export ' + label + ' → ' + dl.suggestedFilename() + ' is a valid zip');
    await page.keyboard.press('Escape');
  }

  // Flash 1.5 + the self-test loop
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('nexora.studio')); s.model = 'flash'; localStorage.setItem('nexora.studio', JSON.stringify(s)); location.reload(); });
  await page.waitForSelector('#prompt');
  let before = sent.length;
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.screen iframe', { timeout: 15000 });
  const r1 = sent[before];
  ok(r1 && r1.body.model === 'claude-haiku-4-5' && !r1.body.thinking && !r1.body.fallbacks && !r1.headers['anthropic-beta'], 'Flash 1.5 request: haiku-4-5, no thinking, no beta header');
  ok((await page.locator('.stage .note').innerText()).includes('Självtestad'), 'passing game is marked as self-tested');
  gameQueue.push(BROKEN);
  before = sent.length;
  await page.click('text=🎲 Ny version');
  await page.waitForFunction(() => { const n = document.querySelector('.stage .note'); return n && /rättning/.test(n.textContent) && document.querySelector('.screen iframe'); }, null, { timeout: 30000 });
  ok(sent.length === before + 2, 'self-test: generate + one fix request (' + (sent.length - before) + ')');
  const fixMsg = sent[before + 1].body.messages[0].content;
  ok(/undefinedPlayer/.test(fixMsg) && /```html/.test(fixMsg), 'the runtime error and the broken game were sent to the fix request');
  ok(await page.locator('.bar .title').innerText() === 'Mock-spelet' && /1 rättning/.test(await page.locator('.stage .note').innerText()), 'fixed game shown: ' + await page.locator('.stage .note').innerText());

  // refusal and a bad key surface as readable errors
  apiMode = 'refusal';
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('text=avböjde', { timeout: 10000 });
  ok(true, 'refusal shown to the user');
  apiMode = '401';
  await page.click('text=↻ Försök igen');
  await page.waitForSelector('text=Ogiltig API-nyckel', { timeout: 10000 });
  ok(await page.locator('.screen button', { hasText: 'Inställningar' }).count() === 1, '401 shown as an invalid-key message with a settings button');
  apiMode = 'ok';
  errors.length = 0; // the broken game and the 401 above were on purpose

  // tools: every one of them is AI
  await page.evaluate(() => { location.hash = 'verktyg'; });
  await page.waitForTimeout(300);
  const tools = page.locator('.tool');
  before = sent.length;
  await tools.filter({ hasText: 'Story' }).first().locator('button', { hasText: 'Generera' }).click();
  await page.waitForFunction(() => /Akt 1/.test(document.querySelector('.tool .out').textContent));
  ok(sent[before].body.messages[0].content.startsWith('Write a game story'), 'story tool asks the AI');
  const gfx = tools.filter({ hasText: 'Grafik' }).first();
  await gfx.locator('input').fill('en glödande manet');
  await gfx.locator('select').first().selectOption('neon'); await gfx.locator('select').nth(1).selectOption('4');
  before = sent.length;
  await gfx.locator('button', { hasText: 'Generera' }).click();
  await page.waitForSelector('.art svg[data-frames="4"]');
  const imgReq = sent[before].body;
  ok(/glowing neon/.test(imgReq.messages[0].content) && /4 animation frames/.test(imgReq.messages[0].content) && /en glödande manet/.test(imgReq.messages[0].content), 'Image 1.5 asks the AI for a neon, 4-frame sprite sheet of the description');
  const [pngDl] = await Promise.all([page.waitForEvent('download'), gfx.locator('button', { hasText: '.png' }).click()]);
  const png = fs.readFileSync(await pngDl.path());
  ok(png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1024 && png.readUInt32BE(20) === 256, 'PNG export: 1024x256 sprite sheet');
  const d3 = tools.filter({ hasText: '3D – Nexora' }).first();
  await d3.locator('input').fill('en skattkista');
  await d3.locator('button', { hasText: 'Generera' }).click();
  await page.waitForFunction(() => /Skattkista · 6 ytor/.test(document.body.innerText));
  const [glbDl] = await Promise.all([page.waitForEvent('download'), d3.locator('button', { hasText: '.glb' }).click()]);
  const glb = fs.readFileSync(await glbDl.path());
  const gj = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString());
  ok(glb.slice(0, 4).toString() === 'glTF' && glb.readUInt32LE(8) === glb.length && gj.meshes[0].primitives.length === gj.materials.length && gj.materials.length === 5, '3D 1.5: the AI model exports as .glb (' + glb.length + ' bytes, ' + gj.materials.length + ' materials, bad colours cleaned)');
  if (process.env.SHOTS_GLB) fs.writeFileSync(process.env.SHOTS_GLB, glb);
  const mus = tools.filter({ hasText: 'Musik' }).first();
  await mus.locator('input').fill('stressig pizzamusik');
  before = sent.length;
  await mus.locator('button', { hasText: 'Komponera' }).click();
  await page.waitForSelector('.tool audio', { timeout: 20000 });
  ok(/composer/.test(sent[before].body.system) && /stressig pizzamusik/.test(sent[before].body.messages[0].content) && (await mus.innerText()).includes('Pizzarusch · 140 BPM'), 'music: the AI composes the score, the app plays it');
  const [wavDl] = await Promise.all([page.waitForEvent('download'), mus.locator('button', { hasText: 'Ladda ner WAV' }).click()]);
  const wavBuf = fs.readFileSync(await wavDl.path());
  ok(wavBuf.slice(0, 4).toString() === 'RIFF' && wavBuf.length > 44100 * 4 * 10, 'music WAV (' + (wavBuf.length / 1e6).toFixed(1) + ' MB, looped to 20 s)');
  const sfxTool = tools.filter({ hasText: 'Ljudeffekter' }).first();
  await sfxTool.locator('input').fill('en slemmig dörr som öppnas');
  before = sent.length;
  await sfxTool.locator('button', { hasText: 'Skapa ljud' }).click();
  for (let i = 0; i < 50 && sent.length === before; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(800);
  const [sfxDl] = await Promise.all([page.waitForEvent('download'), sfxTool.locator('button', { hasText: 'Ladda ner senaste' }).click()]);
  ok(/sound designer/.test(sent[before].body.system) && /slemmig dörr/.test(sent[before].body.messages[0].content) && sfxDl.suggestedFilename() === 'nexora-slemmig-dorr.wav' && fs.readFileSync(await sfxDl.path()).slice(8, 12).toString() === 'WAVE', 'sound effects: the AI designs the sound, the app renders it (' + sfxDl.suggestedFilename() + ')');
  const voice = tools.filter({ hasText: 'Röst' }).first();
  await voice.locator('button', { hasText: 'AI skriver repliken' }).click();
  await page.waitForFunction(() => /Pizzan är klar/.test([...document.querySelectorAll('.tool textarea')].map(t => t.value).join()));
  ok(true, 'voice: the AI writes the line');
  await page.screenshot({ path: path.join(SHOTS, 'tools-used.png'), fullPage: true });
  ok(errors.length === 0, 'no errors during the whole run ' + (errors.length ? JSON.stringify(errors) : ''));

  // OpenAI-compatible endpoint (e.g. the Colab model)
  let oaBody = null;
  await page.route('http://localhost:8000/v1/chat/completions', async route => {
    oaBody = JSON.parse(route.request().postData());
    const chunks = ['```html\n', MOCK, '\n```'].map(c => 'data: ' + JSON.stringify({ choices: [{ delta: { content: c } }] }) + '\n\n').join('') + 'data: [DONE]\n\n';
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: chunks });
  });
  await page.evaluate(() => { localStorage.setItem('nexora.settings', JSON.stringify({ provider: 'openai', openaiBase: 'http://localhost:8000/v1', openaiModels: { flash: 'nexora-flash-1' } })); location.hash = 'studio'; location.reload(); });
  await page.waitForSelector('#prompt');
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.screen iframe', { timeout: 10000 });
  ok(oaBody && oaBody.model === 'nexora-flash-1' && oaBody.stream === true && oaBody.messages[0].role === 'system', 'custom endpoint gets an OpenAI-style streaming request');
  await page.evaluate(() => { localStorage.setItem('nexora.settings', JSON.stringify({ provider: 'anthropic', anthropicKey: 'sk-ant-test' })); });
  errors.length = 0;

  // ---- Astryx 5 Pro: staged rollout by plan and date
  const rel = await page.evaluate(() => {
    const out = {};
    for (const d of ['2026-09-26', '2026-10-06', '2026-10-07', '2026-11-13', '2026-11-14']) {
      window.NEXORA_TODAY = d;
      out[d] = [0, 1, 2, 3, 4].map(t => Nexora.released('astryx', t) ? 1 : 0).join('');
    }
    delete window.NEXORA_TODAY;
    return out;
  });
  ok(rel['2026-09-26'] === '00011' && rel['2026-10-06'] === '00011', 'Astryx: only Studio + Enterprise before 7 Oct ' + JSON.stringify(rel));
  ok(rel['2026-10-07'] === '00111' && rel['2026-11-13'] === '00111', 'Astryx: Pro from 7 Oct');
  ok(rel['2026-11-14'] === '11111', 'Astryx: Creator + Free from 14 Nov');

  await page.evaluate(() => { localStorage.setItem('nexora.plan', '"pro"'); window.NEXORA_TODAY = '2026-09-26'; location.hash = 'studio'; location.reload(); });
  await page.waitForSelector('#prompt');
  await page.evaluate(() => { window.NEXORA_TODAY = '2026-09-26'; Nexora.render(); });
  await page.click('.model.agent');
  ok(await page.locator('.modal', { hasText: '7 oktober' }).count() === 1, 'Pro plan before 7 Oct: Astryx shows the rollout dialog');
  await page.screenshot({ path: path.join(SHOTS, 'astryx-locked.png') });
  await page.keyboard.press('Escape');

  // ---- Astryx on Claude: a real tool-use loop against the mocked Messages API
  await page.evaluate(() => {
    delete window.NEXORA_TODAY;
    localStorage.setItem('nexora.plan', '"studio"');
    localStorage.setItem('nexora.studio', JSON.stringify({ model: 'astryx', dim: '2d', opts: {}, prompt: 'Ett färgglatt reaktionsspel' }));
    location.hash = 'studio'; location.reload();
  });
  await page.waitForSelector('#prompt');
  ok(await page.locator('.model.agent.on').count() === 1, 'Studio plan: Astryx selectable');
  const usedBefore = await page.evaluate(m => JSON.parse(localStorage.getItem('nexora.usage') || '{}')[m] || 0, today());
  before = sent.length;
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.log img', { timeout: 20000 });
  await page.screenshot({ path: path.join(SHOTS, 'astryx-working.png') });
  await page.waitForSelector('.stage .note', { state: 'visible', timeout: 30000 });
  const agentReqs = sent.slice(before);
  ok(agentReqs.length === 3, 'agent made 3 turns (write → run → finish): ' + agentReqs.length);
  const [q1, q2, q3] = agentReqs.map(r => r.body);
  ok(q1.model === 'claude-opus-5' && q1.thinking.type === 'adaptive' && q1.output_config.effort === 'high' && q1.tools.map(t => t.name).join() === 'write_game,edit_game,run_game,finish', 'agent request: opus-5, adaptive thinking, four tools');
  ok(q1.tools.find(t => t.name === 'write_game').eager_input_streaming === true && !('eager_input_streaming' in q1.tools.find(t => t.name === 'run_game')), 'eager input streaming on the tools that carry code');
  ok(q1.fallbacks === 'default' && agentReqs[0].headers['anthropic-beta'] === 'server-side-fallback-2026-07-01' && q1.cache_control && q1.cache_control.type === 'ephemeral', 'agent: fallbacks + prompt caching');
  const a1 = q2.messages[1];
  ok(a1.role === 'assistant' && a1.content[0].type === 'thinking' && a1.content[0].signature === 'sig123' && a1.content[1].type === 'tool_use' && a1.content[1].input.html === TOY, 'thinking block (with signature) and tool_use echoed back unchanged');
  const w1 = q2.messages[2].content[0];
  ok(w1.type === 'tool_result' && w1.tool_use_id === 'toolu_1' && !w1.is_error, 'write_game result returned');
  const r2 = q3.messages[4].content[0], r2json = JSON.parse(r2.content[0].text);
  ok(r2.tool_use_id === 'toolu_2' && r2.content[1].type === 'image' && r2.content[1].source.media_type === 'image/jpeg' && r2.content[1].source.data.length > 1000, 'run_game result carries a screenshot');
  ok(r2json.errors.length === 0 && r2json.animating === true && r2json.frames_rendered > 10, 'run_game measured the game: ' + JSON.stringify(r2json));
  ok((await page.locator('.stage .note').innerText()).includes('Klart och testat.'), 'finish summary shown to the user');
  ok(await page.locator('.bar .title').innerText() === 'Färgspelet', 'agent game title used');
  await page.screenshot({ path: path.join(SHOTS, 'astryx-done.png') });
  ok(await page.evaluate(m => JSON.parse(localStorage.getItem('nexora.usage') || '{}')[m] || 0, today()) === usedBefore + 1, 'Astryx run counted against the plan');

  // ---- Godot mode in the browser: explained, not attempted
  await page.click('.model.agent');
  await page.click('text=🎮 Godot + Python');
  ok(await page.locator('.astryxbox', { hasText: 'Hyperrealistiskt läge' }).isVisible() && await page.locator('.astryxbox', { hasText: 'Nexora för dator' }).isVisible(), 'web: Godot options visible with a desktop-app note');
  await page.click('text=✨ Skapa spel');
  ok(await page.locator('.modal', { hasText: 'kräver Nexora för dator' }).count() === 1, 'web: Godot run asks for the desktop app');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('nexora.studio')); s.astryx.engine = 'html'; localStorage.setItem('nexora.studio', JSON.stringify(s)); Nexora.S.studio.astryx.engine = 'html'; location.hash = 'astryx'; });
  await page.waitForSelector('text=Godot-läget körs på datorn');
  ok(true, 'web: Astryx page explains the desktop requirement');
  await page.screenshot({ path: path.join(SHOTS, 'astryx-web.png'), fullPage: true });

  // ---- credits
  await page.evaluate(m => {
    const u = {}; u[m] = 10;
    localStorage.setItem('nexora.usage', JSON.stringify(u)); localStorage.setItem('nexora.plan', '"free"'); localStorage.setItem('nexora.credits', '0');
    localStorage.setItem('nexora.studio', JSON.stringify({ model: 'flash', dim: '2d', opts: {}, prompt: 'Rymdskjutare' })); location.hash = 'studio'; location.reload();
  }, today());
  await page.waitForSelector('#prompt');
  await page.click('text=✨ Skapa spel');
  ok(await page.locator('.modal', { hasText: 'Köp krediter' }).count() === 1, 'quota used up → credits dialog');
  await page.screenshot({ path: path.join(SHOTS, 'credits-modal.png') });
  await page.locator('.modal .card .card', { hasText: '25 krediter' }).locator('button', { hasText: 'Köp' }).click();
  await page.click('text=Betala 49 kr (demo)');
  await page.waitForSelector('.screen iframe', { timeout: 15000 });
  const cr = await page.evaluate(m => ({ c: JSON.parse(localStorage.getItem('nexora.credits')), u: JSON.parse(localStorage.getItem('nexora.usage'))[m] }), today());
  ok(cr.c === 24 && cr.u === 10, 'bought 25 credits, the game used 1, monthly usage unchanged ' + JSON.stringify(cr));
  ok((await page.locator('.pill.credits').innerText()).includes('24'), 'credit balance in the top bar');
  await page.evaluate(() => { window.NEXORA_TODAY = '2026-11-14'; const s = JSON.parse(localStorage.getItem('nexora.studio')); s.model = 'astryx'; localStorage.setItem('nexora.studio', JSON.stringify(s)); Nexora.S.studio.model = 'astryx'; });
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.stage .note:has-text("Klart och testat")', { timeout: 30000 });
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('nexora.credits'))) === 21, 'Free plan on 14 Nov: Astryx available and costs 3 credits');
  await page.evaluate(() => { location.hash = 'priser'; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'priser-credits.png'), fullPage: true });
  ok(errors.length === 0, 'no errors in the Astryx and credits flows ' + (errors.length ? JSON.stringify(errors) : ''));

  // phone width
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto('file://' + FILE + '#priser');
  await phone.waitForTimeout(300);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, 'no horizontal scroll at phone width (' + overflow + 'px)');
  await phone.screenshot({ path: path.join(SHOTS, 'phone-priser.png') });

  await browser.close();
  console.log(failed ? failed + ' FAILED' : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
