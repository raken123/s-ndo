// End-to-end test of the desktop app: Electron + Python + Godot + Poly Haven (mocked).
//   python3 nexora/build/desktop.py dev            # unpacked app → prints the binary path
//   NEXORA_APP=<that path> NEXORA_GODOT=<godot binary> xvfb-run -a node nexora/build/verify_desktop.js
// Optional: NEXORA_TPZ=<export templates .tpz> also tests exports for all four platforms.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) failed++; };

// ---------------------------------------------------------------- fake Poly Haven assets
function png(w, h, fn) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const c = fn(x, y), o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; } }
  const chunk = (t, d) => { const b = Buffer.concat([Buffer.from(t), d]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(d.length); c.writeUInt32BE(zlib.crc32(b)); return Buffer.concat([l, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function hdr(w, h) {
  const head = Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ' + h + ' +X ' + w + '\n'), px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = y / h, sun = Math.exp(-((x - w * 0.3) ** 2 + (y - h * 0.3) ** 2) / 40) * 30;
    const r = 0.4 + t * 0.5 + sun, g = 0.6 + t * 0.35 + sun, b = 1.0 - t * 0.3 + sun * 0.8, m = Math.max(r, g, b), e = Math.ceil(Math.log2(m)) , s = 256 / 2 ** e, o = (y * w + x) * 4;
    px[o] = r * s; px[o + 1] = g * s; px[o + 2] = b * s; px[o + 3] = e + 128;
  }
  return Buffer.concat([head, px]);
}
// A textured unit cube (0..1 m high) as glTF + .bin, the way Poly Haven ships models.
function cubeGltf(id) {
  const P = [], N = [], U = [], I = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, -1], [1, 0, 0]], [[0, -1, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  for (const [n, up, right] of faces) {
    const base = P.length / 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      P.push(n[0] * 0.5 + right[0] * a * 0.5 + up[0] * b * 0.5, n[1] * 0.5 + right[1] * a * 0.5 + up[1] * b * 0.5 + 0.5, n[2] * 0.5 + right[2] * a * 0.5 + up[2] * b * 0.5);
      N.push(...n); U.push((a + 1) / 2, (1 - b) / 2);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const f = new Float32Array(P.concat(N, U)), idx = new Uint16Array(I), bin = Buffer.concat([Buffer.from(f.buffer), Buffer.from(idx.buffer)]);
  const nv = P.length / 3;
  const gltf = {
    asset: { version: '2.0', generator: 'nexora-test' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: id }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 } }],
    textures: [{ source: 0 }], images: [{ uri: 'textures/' + id + '_diff_2k.png' }],
    buffers: [{ uri: id + '.bin', byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: nv * 12 }, { buffer: 0, byteOffset: nv * 12, byteLength: nv * 12 }, { buffer: 0, byteOffset: nv * 24, byteLength: nv * 8 }, { buffer: 0, byteOffset: nv * 32, byteLength: I.length * 2 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: nv, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] },
      { bufferView: 1, componentType: 5126, count: nv, type: 'VEC3' }, { bufferView: 2, componentType: 5126, count: nv, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: I.length, type: 'SCALAR' }],
  };
  return { gltf: Buffer.from(JSON.stringify(gltf)), bin };
}

function mockPolyHaven(tpz) {
  const files = {}, index = { models: {}, hdris: {}, textures: {} };
  let base = '';
  const add = (p, buf) => { files[p] = buf; return () => base + '/dl/' + p; };
  const catalog = {};
  for (const [id, tags, color] of [['Barrel_01', ['barrel', 'wood', 'prop'], [140, 90, 50]], ['pine_tree_01', ['tree', 'pine', 'nature', 'forest'], [40, 110, 50]], ['rock_moss_01', ['rock', 'stone', 'boulder', 'nature'], [120, 120, 110]], ['fern_02', ['fern', 'plant', 'nature', 'forest'], [60, 150, 60]]]) {
    const m = cubeGltf(id);
    index.models[id] = { name: id.replace(/_/g, ' '), tags, categories: ['nature'], polycount: 12, download_count: 1000 };
    const g = add('Models/' + id + '/' + id + '_2k.gltf', m.gltf), b = add('Models/' + id + '/' + id + '.bin', m.bin), t = add('Models/' + id + '/textures/' + id + '_diff_2k.png', png(64, 64, (x, y) => color.map(c => Math.max(0, Math.min(255, c + ((x ^ y) & 8 ? 25 : -25))))));
    catalog[id] = () => ({ gltf: { '2k': { gltf: { url: g(), size: m.gltf.length, include: { [id + '.bin']: { url: b() }, ['textures/' + id + '_diff_2k.png']: { url: t() } } } } } });
  }
  index.hdris.forest_sky = { name: 'Forest Sky', tags: ['forest', 'sky', 'outdoor', 'sunny'], categories: ['outdoor'] };
  const hurl = add('HDRIs/forest_sky_2k.hdr', hdr(256, 128));
  catalog.forest_sky = () => ({ hdri: { '2k': { hdr: { url: hurl() } } } });
  index.textures.forest_ground_01 = { name: 'Forest Ground 01', tags: ['forest', 'ground', 'grass', 'soil'], categories: ['terrain'] };
  const td = add('Textures/forest_ground_01_diff_2k.png', png(128, 128, (x, y) => [70 + ((x * 7 + y * 3) % 30), 90 + ((x * y) % 40), 40])), tn = add('Textures/forest_ground_01_nor_gl_2k.png', png(32, 32, () => [128, 128, 255])), tr = add('Textures/forest_ground_01_rough_2k.png', png(32, 32, () => [220, 220, 220]));
  catalog.forest_ground_01 = () => ({ Diffuse: { '2k': { png: { url: td() } } }, nor_gl: { '2k': { png: { url: tn() } } }, Rough: { '2k': { png: { url: tr() } } } });
  const hits = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    hits.push(u.pathname);
    if (u.pathname === '/assets') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(index[u.searchParams.get('t')] || {})); }
    if (u.pathname.startsWith('/files/')) { const c = catalog[u.pathname.slice(7)]; res.setHeader('content-type', 'application/json'); return c ? res.end(JSON.stringify(c())) : (res.statusCode = 404, res.end('{}')); }
    if (u.pathname === '/templates.tpz' && tpz) { res.setHeader('content-length', fs.statSync(tpz).size); return fs.createReadStream(tpz).pipe(res); }
    const f = files[decodeURIComponent(u.pathname.slice(4))];
    if (u.pathname.startsWith('/dl/') && f) { res.setHeader('content-length', f.length); return res.end(f); }
    res.statusCode = 404; res.end('not found');
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port; r({ server, base, hits }); }));
}

// ---------------------------------------------------------------- mocked Claude for the agent loop
const sse = evs => evs.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join('');
const toolTurn = (id, name, input) => {
  const json = JSON.stringify(input);
  return [{ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Nästa steg: ' + name } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig-' + id } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id, name, input: {} } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(0, 25) } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(25) } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' } }];
};
const AGENT_PY = `import pathlib
pathlib.Path("project.godot").write_text('''config_version=5

[application]
config/name="Tunnan"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")
''')
pathlib.Path("main.tscn").write_text('[gd_scene load_steps=2 format=3]\\n\\n[ext_resource type="Script" path="res://main.gd" id="1"]\\n\\n[node name="Main" type="Node3D"]\\nscript = ExtResource("1")\\n')
pathlib.Path("main.gd").write_text('''extends Node3D
var t := 0.0
var box: Node3D
func _ready() -> void:
\\tInputMap.add_action("spin")
\\tvar e := InputEventKey.new()
\\te.physical_keycode = KEY_SPACE
\\tInputMap.action_add_event("spin", e)
\\tvar cam := Camera3D.new()
\\tadd_child(cam)
\\tcam.position = Vector3(0, 2, 4)
\\tcam.look_at(Vector3(0, 0.5, 0))
\\tvar sun := DirectionalLight3D.new()
\\tsun.rotation_degrees = Vector3(-50, 30, 0)
\\tadd_child(sun)
\\tbox = MeshInstance3D.new()
\\tbox.mesh = BoxMesh.new()
\\tadd_child(box)
\\tprint("Tunnan redo")
func _process(delta: float) -> void:
\\tt += delta
\\tbox.rotation.y = t * (3.0 if Input.is_action_pressed("spin") else 1.0)
''')
print("wrote 3 files")
`;

(async () => {
  const APP = process.env.NEXORA_APP, GODOT = process.env.NEXORA_GODOT;
  if (!APP || !GODOT) throw new Error('set NEXORA_APP and NEXORA_GODOT');
  const tpz = process.env.NEXORA_TPZ || null;
  const ph = await mockPolyHaven(tpz);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-e2e-'));
  const templatesHome = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-xdg-'));
  const app = await pw._electron.launch({
    executablePath: APP, args: ['--no-sandbox'],
    env: Object.assign({}, process.env, { NEXORA_USER_DATA: userData, NEXORA_GODOT: GODOT, NEXORA_POLYHAVEN_API: ph.base, NEXORA_TEMPLATES_URL: ph.base + '/templates.tpz', XDG_DATA_HOME: templatesHome }),
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 860 }).catch(() => {});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('header.top');
  const info = await page.evaluate(() => window.nexoraDesktop.call('info'));
  ok(!!info.python && info.godot.path === process.env.NEXORA_GODOT || !!info.godot.path, 'desktop bridge: python ' + (info.python && info.python.version) + ', godot ' + info.godot.path);

  // ---- 1. Nexora Local, hyperrealistic, through the Studio UI
  await page.evaluate(() => {
    localStorage.setItem('nexora.plan', '"studio"'); localStorage.setItem('nexora.credits', '25'); localStorage.setItem('nexora.godotConsent', 'true');
    localStorage.setItem('nexora.settings', '{"provider":"local"}');
    localStorage.setItem('nexora.studio', JSON.stringify({ model: 'astryx', dim: '3d', opts: {}, prompt: 'Ett utforskningsspel i en skog', astryx: { engine: 'godot', minutes: 120, hyperreal: true } }));
    location.hash = 'studio'; location.reload();
  });
  await page.waitForSelector('#prompt');
  ok(await page.locator('.astryxbox', { hasText: 'Hyperrealistiskt läge' }).isVisible(), 'Studio shows Astryx engine, time and hyperrealistic options');
  await page.screenshot({ path: path.join(SHOTS, 'desk-studio-astryx.png') });
  await page.click('text=✨ Skapa spel');
  await page.waitForSelector('.jobcard', { timeout: 10000 });
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('nexora.credits'))) === 15, 'hyperrealistic run charged 10 credits up front');
  await page.waitForFunction(() => Nexora.JOBS[0] && Nexora.JOBS[0].status !== 'running', null, { timeout: 600000, polling: 1000 });
  const j1 = await page.evaluate(() => { const j = Nexora.JOBS[0]; return { status: j.status, error: j.error, runs: j.runs, assets: j.assets, shots: j.shots.length, project: j.project, dir: j.dir, log: j.log.map(l => l.text) }; });
  ok(j1.status === 'done', 'local hyperrealistic job finished: ' + j1.status + (j1.error ? ' – ' + j1.error : ''));
  ok(j1.assets && j1.assets.length === 5 && j1.assets.includes('forest_sky') && j1.assets.includes('forest_ground_01'), 'downloaded the matching models + HDRI + ground texture: ' + JSON.stringify(j1.assets));
  ok(j1.shots >= 1, 'Godot screenshots captured: ' + j1.shots);
  const credits = fs.readFileSync(path.join(j1.dir, 'assets', 'polyhaven', 'CREDITS.md'), 'utf8');
  ok(credits.includes('pine_tree_01') && credits.includes('forest_sky') && credits.includes('CC0'), 'CREDITS.md lists every CC0 asset');
  const mainGd = fs.readFileSync(path.join(j1.dir, 'main.gd'), 'utf8');
  ok(/res:\/\/assets\/polyhaven\/\w+\/\w+_2k\.gltf/.test(mainGd) && mainGd.includes('forest_sky_2k.hdr') && mainGd.includes('TONE_MAPPER_AGX'), 'generated Godot project uses the downloaded models, HDRI and AgX tonemapping');
  await page.screenshot({ path: path.join(SHOTS, 'desk-astryx-local-done.png'), fullPage: true });
  const shot1 = await page.evaluate(() => Nexora.JOBS[0].shots.slice(-1)[0]);
  fs.writeFileSync(path.join(SHOTS, 'desk-godot-hyperreal.jpg'), Buffer.from(shot1, 'base64'));
  ok(await page.evaluate(() => Nexora.games.all().then(a => a.some(g => g.type === 'godot' && g.hyperreal))), 'Godot game saved to the library');

  // ---- 2. Claude agent loop (mocked API), real Python + Godot + assets
  const reqs = [];
  const turns = [
    toolTurn('t1', 'run_python', { purpose: 'Skriver projektet', code: AGENT_PY }),
    toolTurn('t2', 'godot_run', {}),
    toolTurn('t3', 'search_assets', { query: 'wooden barrel', type: 'models' }),
    toolTurn('t4', 'download_asset', { id: 'Barrel_01', type: 'models', resolution: '2k' }),
    toolTurn('t5', 'run_python', { purpose: 'Försöker läsa utanför projektet', code: 'print(open("/etc/hostname").read())' }),
    toolTurn('t6', 'save_lesson', { lesson: 'Definiera InputMap-actions i _ready så att testaren hittar dem.' }),
    toolTurn('t7', 'finish', { summary: 'Tunnan snurrar och testet gick utan fel.' }),
  ];
  await page.route('https://api.anthropic.com/v1/messages', async route => {
    reqs.push({ body: JSON.parse(route.request().postData()), headers: route.request().headers() });
    const t = turns[reqs.length - 1] || [{ type: 'message_delta', delta: { stop_reason: 'end_turn' } }];
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse([{ type: 'message_start', message: { id: 'm' + reqs.length, content: [] } }].concat(t, [{ type: 'message_stop' }])) });
  });
  await page.evaluate(() => {
    localStorage.setItem('nexora.settings', JSON.stringify({ provider: 'anthropic', anthropicKey: 'sk-ant-test' }));
    localStorage.setItem('nexora.studio', JSON.stringify({ model: 'astryx', dim: '3d', opts: {}, prompt: 'Ett spel med en snurrande tunna', astryx: { engine: 'godot', minutes: 30, hyperreal: false } }));
    location.hash = 'studio'; location.reload();
  });
  await page.waitForSelector('#prompt');
  await page.click('text=✨ Skapa spel');
  await page.waitForFunction(() => Nexora.JOBS[0] && Nexora.JOBS[0].status !== 'running' && Nexora.JOBS[0].provider === 'anthropic', null, { timeout: 300000, polling: 1000 });
  const j2 = await page.evaluate(() => { const j = Nexora.JOBS[0]; return { status: j.status, error: j.error, title: j.title, runs: j.runs, shots: j.shots.length, summary: j.summary, dir: j.dir }; });
  ok(j2.status === 'done' && j2.title === 'Tunnan', 'Claude Godot job finished and took the title from project.godot: ' + JSON.stringify({ s: j2.status, t: j2.title, e: j2.error }));
  ok(reqs.length === 7, 'agent turns: ' + reqs.length);
  const b1 = reqs[0].body;
  ok(b1.model === 'claude-opus-5' && b1.output_config.effort === 'xhigh' && b1.thinking.type === 'adaptive', 'Godot agent: opus-5, adaptive thinking, xhigh');
  ok(b1.context_management && b1.context_management.edits[0].type === 'clear_tool_uses_20250919' && reqs[0].headers['anthropic-beta'] === 'server-side-fallback-2026-07-01,context-management-2025-06-27', 'context editing + fallback betas');
  ok(b1.tools.map(t => t.name).join() === 'run_python,write_file,read_file,list_files,godot_run,save_lesson,finish', 'no asset tools without hyperrealistic mode: ' + b1.tools.map(t => t.name).join());
  ok(b1.system.includes('GDScript 2') && b1.system.includes('Lessons from earlier Astryx runs') === false, 'Godot guide in the system prompt (no lessons yet)');
  const res = i => reqs[i].body.messages[reqs[i].body.messages.length - 1].content[0];
  const py = JSON.parse(res(1).content);
  ok(py.exit === 0 && py.stdout.includes('wrote 3 files'), 'run_python executed in the project');
  const gr = res(2), grj = JSON.parse(gr.content[0].text);
  ok(grj.ok === true && grj.completed && grj.errors.length === 0 && gr.content.filter(c => c.type === 'image').length === 3, 'godot_run: clean run with 3 screenshots → ' + JSON.stringify({ ok: grj.ok, errors: grj.errors }));
  const sr = JSON.parse(res(3).content);
  ok(sr.results[0].id === 'Barrel_01', 'search_assets finds the barrel');
  const dl = JSON.parse(res(4).content);
  ok(dl.path === 'res://assets/polyhaven/Barrel_01/Barrel_01_2k.gltf' && fs.existsSync(path.join(j2.dir, 'assets/polyhaven/Barrel_01/textures/Barrel_01_diff_2k.png')), 'download_asset stores glTF + textures: ' + dl.path);
  ok(res(5).is_error === true && /projektmappen/.test(JSON.parse(res(5).content).stderr), 'Python guard blocked reading outside the project');
  ok(reqs[1].body.messages[1].content[0].type === 'thinking' && reqs[1].body.messages[1].content[0].signature === 'sig-t1', 'thinking blocks echoed with signatures');
  const lessons = JSON.parse(fs.readFileSync(path.join(userData, 'astryx-lessons.json'), 'utf8'));
  ok(lessons.length === 1 && /InputMap/.test(lessons[0].text), 'lesson saved to disk');
  fs.writeFileSync(path.join(SHOTS, 'desk-godot-agent.jpg'), Buffer.from(gr.content[1].source.data, 'base64'));

  // next run sees the lesson
  reqs.length = 0; turns.splice(0, turns.length, toolTurn('u1', 'finish', { summary: 'x' }));
  await page.evaluate(() => { Nexora.startGodotJob({ prompt: 'Ett till spel', minutes: 15, quiet: true }); });
  await page.waitForFunction(() => Nexora.JOBS[0].status !== 'running', null, { timeout: 60000 });
  ok(reqs[0] && reqs[0].body.system.includes('Lessons from earlier Astryx runs') && reqs[0].body.system.includes('InputMap-actions'), 'the saved lesson is in the next run\'s instructions');
  ok(await page.evaluate(() => Nexora.JOBS[0].status) === 'failed', 'finish without any godot_run is refused → run fails and is refunded');

  // ---- 3. exports (needs the real templates)
  if (tpz) {
    const proj = path.basename(j1.dir);
    for (const target of ['linux', 'windows', 'web', 'macos']) {
      const r = await page.evaluate(([p, t]) => (async () => { const i = await window.nexoraDesktop.call('info'); if (!i.godot.templates) await window.nexoraDesktop.call('installTemplates'); return window.nexoraDesktop.call('godotExport', { project: p, target: t }); })(), [proj, target]);
      ok(r.ok, 'export ' + target + ': ' + (r.ok ? r.files.join(', ') + ' (' + (r.size / 1e6).toFixed(1) + ' MB)' : JSON.stringify(r.errors)));
    }
  }
  const z = await page.evaluate(p => window.nexoraDesktop.call('zipProject', { project: p, name: 'skog' }), path.basename(j1.dir));
  ok(z.files >= 5 && fs.existsSync(z.path), 'project zip: ' + z.files + ' files');

  await page.evaluate(() => { location.hash = 'astryx'; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'desk-astryx-view.png'), fullPage: true });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await app.close();
  ph.server.close();
  console.log(failed ? failed + ' FAILED' : 'ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
