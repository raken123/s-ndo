// Nexora desktop shell.
// Besides hosting the web app, it gives Astryx 5 Pro's Godot mode what a browser
// cannot: Python, the Godot engine, a project folder, test runs with screenshots,
// exports, and asset downloads from Poly Haven (CC0). The renderer reaches these
// through window.nexoraDesktop (preload.js) → ipcMain handlers below.
const { app, BrowserWindow, shell, Menu, ipcMain, dialog, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { extract } = require('./unzip');

const GODOT_VERSION = '4.7.2';
const GODOT_URL = 'https://github.com/godotengine/godot/releases/download/' + GODOT_VERSION + '-stable/';
const PH_API = process.env.NEXORA_POLYHAVEN_API || 'https://api.polyhaven.com';
const UA = 'Nexora/' + app.getVersion() + ' (+https://github.com/raken123/s-ndo)';
const HERE = __dirname;

let win = null;
const emit = ev => { if (win && !win.isDestroyed()) win.webContents.send('nx:event', ev); };
const DATA = () => app.getPath('userData');
const PROJECTS = () => path.join(DATA(), 'projects');
const EXPORTS = () => path.join(DATA(), 'exports');

// ------------------------------------------------------------------ helpers
function run(cmd, args, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    let out = '', err = '', done = false;
    const cap = s => (s.length > 400000 ? s.slice(-400000) : s);
    let p;
    try { p = spawn(cmd, args, { cwd: opts.cwd, env: Object.assign({}, process.env, opts.env || {}), windowsHide: true }); }
    catch (e) { resolve({ code: -1, out: '', err: String(e), timedOut: false }); return; }
    const timer = setTimeout(() => { if (!done) { try { p.kill('SIGKILL'); } catch (e) { /* gone */ } resolve({ code: -1, out, err: err + '\n[Nexora: avbruten efter ' + Math.round((opts.timeout || 60000) / 1000) + ' s]', timedOut: true }); done = true; } }, opts.timeout || 60000);
    p.stdout.on('data', d => { out = cap(out + d); if (opts.onLine) opts.onLine(String(d)); });
    p.stderr.on('data', d => { err = cap(err + d); });
    p.on('error', e => { if (!done) { done = true; clearTimeout(timer); resolve({ code: -1, out, err: err + String(e), timedOut: false }); } });
    p.on('close', code => { if (!done) { done = true; clearTimeout(timer); resolve({ code, out, err, timedOut: false }); } });
  });
}

async function download(url, dest, what) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error('Nedladdning misslyckades (' + res.status + '): ' + url);
  const total = +res.headers.get('content-length') || 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part', fh = fs.openSync(tmp, 'w');
  let got = 0, last = 0;
  try {
    for await (const chunk of res.body) {
      fs.writeSync(fh, chunk); got += chunk.length;
      if (what && Date.now() - last > 250) { last = Date.now(); emit({ type: 'download', what, got, total }); }
      if (got > 2.5e9) throw new Error('filen är för stor');
    }
  } finally { fs.closeSync(fh); }
  fs.renameSync(tmp, dest);
  if (what) emit({ type: 'download', what, got, total: total || got, done: true });
  return dest;
}
async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' från ' + url);
  return res.json();
}

function projectDir(id) {
  if (!/^[a-z0-9-]{3,80}$/.test(String(id))) throw new Error('ogiltigt projekt-id');
  return path.join(PROJECTS(), id);
}
function safeJoin(root, rel) {
  const p = path.resolve(root, String(rel).replace(/^res:\/\//, ''));
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error('sökvägen ligger utanför projektet: ' + rel);
  return p;
}
function copyProbe(dir) {
  const dst = path.join(dir, '_nexora');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of ['probe.gd', 'probe_driver.gd', 'probe.tscn', 'nexora_godot_local.py']) fs.copyFileSync(path.join(HERE, 'godot', f), path.join(dst, f));
}

// ------------------------------------------------------------------ python
let pythonCache = null;
function findPython() {
  if (pythonCache) return pythonCache;
  const cands = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of cands) {
    const r = spawnSync(cmd, pre.concat(['--version']), { encoding: 'utf8', windowsHide: true });
    const v = ((r.stdout || '') + (r.stderr || '')).trim();
    if (r.status === 0 && /Python 3\.(\d+)/.test(v) && +v.match(/Python 3\.(\d+)/)[1] >= 8) { pythonCache = { cmd, pre, version: v }; return pythonCache; }
  }
  return null;
}

// ------------------------------------------------------------------ godot
function godotAsset() {
  const v = GODOT_VERSION;
  if (process.platform === 'win32') return { zip: 'Godot_v' + v + '-stable_win64.exe.zip', bin: 'Godot_v' + v + '-stable_win64_console.exe', gui: 'Godot_v' + v + '-stable_win64.exe' };
  if (process.platform === 'darwin') return { zip: 'Godot_v' + v + '-stable_macos.universal.zip', bin: 'Godot.app/Contents/MacOS/Godot' };
  return { zip: 'Godot_v' + v + '-stable_linux.x86_64.zip', bin: 'Godot_v' + v + '-stable_linux.x86_64' };
}
const godotDir = () => path.join(DATA(), 'godot', GODOT_VERSION);
function godotPath(gui) {
  if (process.env.NEXORA_GODOT) return process.env.NEXORA_GODOT;
  const a = godotAsset(), p = path.join(godotDir(), gui && a.gui ? a.gui : a.bin);
  return fs.existsSync(p) ? p : null;
}
async function installGodot() {
  if (godotPath()) return { ok: true, path: godotPath() };
  const a = godotAsset(), zip = path.join(DATA(), 'downloads', a.zip);
  if (!fs.existsSync(zip)) await download(GODOT_URL + a.zip, zip, 'Godot ' + GODOT_VERSION);
  emit({ type: 'status', text: 'Packar upp Godot…' });
  extract(zip, godotDir());
  const bin = path.join(godotDir(), a.bin);
  if (process.platform !== 'win32') fs.chmodSync(bin, 0o755);
  fs.unlinkSync(zip);
  return { ok: true, path: bin };
}
function templatesDir() {
  const v = GODOT_VERSION + '.stable';
  if (process.platform === 'win32') return path.join(process.env.APPDATA || os.homedir(), 'Godot', 'export_templates', v);
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Godot', 'export_templates', v);
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'godot', 'export_templates', v);
}
const templatesInstalled = () => fs.existsSync(path.join(templatesDir(), 'version.txt'));
async function installTemplates() {
  if (templatesInstalled()) return { ok: true };
  const name = 'Godot_v' + GODOT_VERSION + '-stable_export_templates.tpz', tpz = path.join(DATA(), 'downloads', name);
  if (!fs.existsSync(tpz)) await download(process.env.NEXORA_TEMPLATES_URL || GODOT_URL + name, tpz, 'Godot exportmallar');
  emit({ type: 'status', text: 'Packar upp exportmallar…' });
  extract(tpz, templatesDir(), { filter: n => n.startsWith('templates/'), rename: n => n.slice('templates/'.length), progress: (i, n) => { if (i % 5 === 0) emit({ type: 'status', text: 'Packar upp exportmallar ' + i + '/' + n }); } });
  fs.unlinkSync(tpz);
  return { ok: true };
}
const hasDisplay = () => process.platform !== 'linux' || !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

// Engine noise that is not the game's fault (no GPU, no sound card, etc.).
const NOISE = /Vulkan|VK_KHR|vkCreate|OpenGL|GLES|ALSA|PulseAudio|audio driver|AudioDriver|X11|XInput|xrandr|Wayland|libdecor|\bEGL|swiftshader|Condition "(err != OK|status < 0|!rendering_device|.*Vulkan)"|fallback|RenderingDevice|GPU|video card|display server|dbus|D-Bus|Fontconfig|icon theme|at: .*(drivers\/|platform\/)|Could not initialize|NEXORA_PROBE/i;
function godotErrors(text) {
  const lines = String(text).split(/\r?\n/), out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/(SCRIPT ERROR|Parse Error|^ERROR:|^\s*ERROR:|Failed to load|Invalid|Cannot|Can't|Unable to|not found|does not exist)/.test(l)) continue;
    if (NOISE.test(l)) continue;
    const at = lines[i + 1] && /^\s+at:/.test(lines[i + 1]) ? ' ' + lines[i + 1].trim() : '';
    if (at && NOISE.test(at)) continue;
    const e = (l.trim() + at).slice(0, 500);
    if (!out.includes(e)) out.push(e);
    if (out.length >= 30) break;
  }
  return out;
}

async function godotRun(id, opts) {
  const dir = projectDir(id), godot = godotPath();
  if (!godot) throw new Error('Godot är inte installerat');
  if (!fs.existsSync(path.join(dir, 'project.godot'))) return { ok: false, errors: ['project.godot saknas – skriv projektet först'], shots: [] };
  copyProbe(dir);
  const imp = await run(godot, ['--headless', '--path', dir, '--import'], { timeout: 300000 });
  const shotsDir = path.join(dir, '_nexora', 'shots');
  fs.rmSync(shotsDir, { recursive: true, force: true }); fs.mkdirSync(shotsDir, { recursive: true });
  const windowed = hasDisplay() && !(opts && opts.headless);
  const args = (windowed ? ['--resolution', '1280x720'] : ['--headless']).concat(['--path', dir, '--fixed-fps', '30', 'res://_nexora/probe.tscn']);
  const r = await run(godot, args, { timeout: 180000, env: { NEXORA_PROBE_OUT: shotsDir } });
  const all = imp.out + '\n' + imp.err + '\n' + r.out + '\n' + r.err;
  const done = /NEXORA_PROBE_DONE frames=(\d+)/.exec(all);
  const shots = fs.readdirSync(shotsDir).filter(f => f.endsWith('.png')).sort().map(f => {
    const img = nativeImage.createFromPath(path.join(shotsDir, f));
    return { frame: +f.match(/\d+/)[0], jpeg: img.isEmpty() ? null : img.toJPEG(78).toString('base64') };
  }).filter(s => s.jpeg);
  const errors = godotErrors(all);
  if (!done) errors.unshift(r.timedOut ? 'Spelet hängde sig (ingen slutsignal inom 3 minuter).' : 'Spelet startade inte eller avslutades i förtid (kod ' + r.code + ').');
  return { ok: !!done && errors.length === 0, errors, frames: done ? +done[1] : 0, windowed, shots, log: all.split(/\r?\n/).filter(l => l.trim() && !NOISE.test(l)).slice(-40).join('\n') };
}

// ------------------------------------------------------------------ export
const PRESETS = {
  windows: { name: 'Windows Desktop', file: 'windows/{n}.exe', opts: 'binary_format/embed_pck=true\n' },
  linux: { name: 'Linux', file: 'linux/{n}.x86_64', opts: 'binary_format/embed_pck=true\n' },
  macos: { name: 'macOS', file: 'macos/{n}.zip', opts: 'application/bundle_identifier="app.nexora.{b}"\ncodesign/codesign=0\n' },
  web: { name: 'Web', file: 'web/index.html', opts: 'variant/thread_support=false\n' },
};
function writePresets(dir, name) {
  const b = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'game';
  let s = '';
  Object.values(PRESETS).forEach((p, i) => {
    s += '[preset.' + i + ']\n\nname="' + p.name + '"\nplatform="' + p.name + '"\nrunnable=true\nexport_filter="all_resources"\ninclude_filter=""\nexclude_filter="_nexora/*"\nexport_path=""\n\n[preset.' + i + '.options]\n\n' + p.opts.replace(/\{b\}/g, b) + '\n';
  });
  fs.writeFileSync(path.join(dir, 'export_presets.cfg'), s);
}
// Sets key=value in a section of project.godot (adding the section if needed).
function ensureSetting(dir, section, key, value) {
  const file = path.join(dir, 'project.godot');
  let text = fs.readFileSync(file, 'utf8');
  const line = key + '=' + value;
  if (new RegExp('^' + key.replace(/[/.]/g, '\\$&') + '=', 'm').test(text)) text = text.replace(new RegExp('^' + key.replace(/[/.]/g, '\\$&') + '=.*$', 'm'), line);
  else if (text.includes('[' + section + ']')) text = text.replace('[' + section + ']', '[' + section + ']\n\n' + line);
  else text = text.trimEnd() + '\n\n[' + section + ']\n\n' + line + '\n';
  fs.writeFileSync(file, text);
}

async function godotExport(id, target) {
  const p = PRESETS[target];
  if (!p) throw new Error('okänd exportplattform');
  const dir = projectDir(id), godot = godotPath();
  if (!godot) throw new Error('Godot är inte installerat');
  if (!templatesInstalled()) throw new Error('Exportmallarna är inte installerade');
  const title = (/config\/name="([^"]*)"/.exec(fs.readFileSync(path.join(dir, 'project.godot'), 'utf8')) || [0, 'Spel'])[1];
  const n = title.replace(/[^\w\-åäöÅÄÖ ]/g, '').trim().replace(/\s+/g, '_') || 'Spel';
  writePresets(dir, n);
  // Apple Silicon and the web need ETC2/ASTC textures next to the desktop S3TC ones.
  if (target === 'macos' || target === 'web') ensureSetting(dir, 'rendering', 'textures/vram_compression/import_etc2_astc', 'true');
  const outDir = path.join(EXPORTS(), id);
  const out = path.join(outDir, p.file.replace('{n}', n));
  fs.rmSync(path.dirname(out), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await run(godot, ['--headless', '--path', dir, '--import'], { timeout: 300000 });
  const r = await run(godot, ['--headless', '--path', dir, '--export-release', p.name, out], { timeout: 900000 });
  if (!fs.existsSync(out)) return { ok: false, errors: godotErrors(r.out + '\n' + r.err).concat([(r.err || r.out).split('\n').slice(-6).join('\n')]) };
  const files = fs.readdirSync(path.dirname(out));
  return { ok: true, path: out, folder: path.dirname(out), files, size: files.reduce((a, f) => a + fs.statSync(path.join(path.dirname(out), f)).size, 0) };
}

// Zips a project folder (without the .godot cache and Nexora's probe).
function zipDir(src, dest) {
  const files = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (!rel && (e.name === '.godot' || e.name === '_nexora')) continue;
      if (e.isDirectory()) walk(path.join(d, e.name), r); else files.push([r, path.join(d, e.name)]);
    }
  })(src, '');
  const parts = [], central = []; let off = 0;
  for (const [name, full] of files) {
    const data = fs.readFileSync(full), comp = zlib.deflateRawSync(data, { level: 6 }), nb = Buffer.from(name, 'utf8'), crc = zlib.crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    parts.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, nb);
    off += 30 + nb.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.concat(parts.concat([cd, end])));
  return { path: dest, files: files.length };
}

// ------------------------------------------------------------------ Poly Haven (CC0 assets)
const phCache = {};
async function phSearch({ query, type, limit }) {
  type = { model: 'models', models: 'models', hdri: 'hdris', hdris: 'hdris', texture: 'textures', textures: 'textures' }[type || 'models'];
  if (!type) throw new Error('type måste vara models, hdris eller textures');
  if (!phCache[type]) phCache[type] = await getJson(PH_API + '/assets?t=' + type);
  const terms = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
  const hits = [];
  for (const [id, a] of Object.entries(phCache[type])) {
    const tags = (a.tags || []).map(t => String(t).toLowerCase()), cats = (a.categories || []).map(c => String(c).toLowerCase());
    const name = (id + ' ' + (a.name || '')).toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (name.includes(t)) s += 3;
      if (tags.includes(t)) s += 4; else if (tags.some(x => x.includes(t))) s += 2;
      if (cats.some(x => x.includes(t))) s += 2;
    }
    if (s > 0) hits.push({ id, name: a.name || id, score: s, tags: tags.slice(0, 8), categories: cats.slice(0, 5), polycount: a.polycount, downloads: a.download_count });
  }
  hits.sort((x, y) => y.score - x.score || (y.downloads || 0) - (x.downloads || 0));
  return { type, results: hits.slice(0, Math.min(20, limit || 10)).map(h => { delete h.score; return h; }) };
}
async function phDownload({ project, id, type, resolution }) {
  const dir = projectDir(project);
  if (!/^[A-Za-z0-9_\-]+$/.test(id)) throw new Error('ogiltigt asset-id');
  type = { model: 'models', hdri: 'hdris', texture: 'textures' }[type] || type;
  const res = ['1k', '2k', '4k'].includes(resolution) ? resolution : '2k';
  const files = await getJson(PH_API + '/files/' + id);
  const base = path.join(dir, 'assets', 'polyhaven', id), rel = f => 'res://assets/polyhaven/' + id + '/' + f;
  const pick = obj => obj && (obj[res] || obj['2k'] || obj['1k'] || obj[Object.keys(obj)[0]]);
  let result;
  if (type === 'models') {
    const g = pick(files.gltf);
    if (!g || !g.gltf) throw new Error(id + ' har ingen glTF-version');
    const main = g.gltf, fname = path.basename(new URL(main.url).pathname);
    await download(main.url, safeJoin(base, fname), id);
    for (const [r, f] of Object.entries(main.include || {})) await download(f.url, safeJoin(base, r), id + ' ' + path.basename(r));
    result = { kind: 'model', path: rel(fname) };
  } else if (type === 'hdris') {
    const h = pick(files.hdri);
    if (!h || !h.hdr) throw new Error(id + ' har ingen HDR-fil');
    const fname = path.basename(new URL(h.hdr.url).pathname);
    await download(h.hdr.url, safeJoin(base, fname), id);
    result = { kind: 'hdri', path: rel(fname) };
  } else if (type === 'textures') {
    const want = { albedo: /^(diff|diffuse|albedo|color)$/i, normal: /^nor_gl$/i, roughness: /^(rough|roughness)$/i, ao: /^ao$/i };
    const maps = {};
    for (const [slot, re] of Object.entries(want)) {
      const key = Object.keys(files).find(k => re.test(k));
      const r = key && pick(files[key]), f = r && (r.jpg || r.png);
      if (!f) continue;
      const fname = path.basename(new URL(f.url).pathname);
      await download(f.url, safeJoin(base, fname), id + ' ' + slot);
      maps[slot] = rel(fname);
    }
    if (!maps.albedo) throw new Error(id + ' saknar färgtextur');
    result = { kind: 'texture', maps };
  } else throw new Error('okänd typ');
  const credits = path.join(dir, 'assets', 'polyhaven', 'CREDITS.md');
  const line = '- ' + id + ' (' + type + ', ' + res + ') – https://polyhaven.com/a/' + id + ' – CC0\n';
  if (!fs.existsSync(credits)) fs.writeFileSync(credits, '# Poly Haven-assets (CC0)\n\n');
  if (!fs.readFileSync(credits, 'utf8').includes(line)) fs.appendFileSync(credits, line);
  return Object.assign({ id, resolution: res, license: 'CC0' }, result);
}

// ------------------------------------------------------------------ IPC API
const API = {
  info: () => ({ platform: process.platform, arch: process.arch, version: app.getVersion(), godot: { version: GODOT_VERSION, path: godotPath(), templates: templatesInstalled() }, python: findPython(), display: hasDisplay(), projects: PROJECTS() }),
  installGodot, installTemplates,
  createProject: ({ name }) => {
    const id = (String(name || 'spel').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'spel') + '-' + Date.now().toString(36);
    const dir = projectDir(id);
    fs.mkdirSync(dir, { recursive: true });
    copyProbe(dir);
    return { id, dir };
  },
  writeFile: ({ project, file, content }) => {
    const p = safeJoin(projectDir(project), file);
    if (/^_nexora[\\/]/.test(path.relative(projectDir(project), p))) throw new Error('_nexora/ är reserverad för Nexora');
    fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, String(content));
    return { ok: true, bytes: Buffer.byteLength(String(content)) };
  },
  readFile: ({ project, file }) => {
    const p = safeJoin(projectDir(project), file), st = fs.statSync(p);
    if (st.size > 300000) return { error: 'filen är ' + st.size + ' byte – för stor att läsa' };
    return { content: fs.readFileSync(p, 'utf8') };
  },
  listFiles: ({ project }) => {
    const root = projectDir(project), out = [];
    (function walk(d, rel) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (!rel && (e.name === '.godot' || e.name === '_nexora')) continue;
        if (e.name.endsWith('.import')) continue;
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) walk(path.join(d, e.name), r);
        else if (out.length < 500) out.push({ path: r, bytes: fs.statSync(path.join(d, e.name)).size });
      }
    })(root, '');
    return { files: out };
  },
  runPython: async ({ project, code, timeout }) => {
    const py = findPython();
    if (!py) throw new Error('Python 3 hittades inte. Installera det från python.org och starta om Nexora.');
    const dir = projectDir(project), steps = path.join(dir, '_nexora', 'steps');
    fs.mkdirSync(steps, { recursive: true });
    const n = fs.readdirSync(steps).length + 1, file = path.join(steps, 'step_' + String(n).padStart(3, '0') + '.py');
    fs.writeFileSync(file, String(code));
    const r = await run(py.cmd, py.pre.concat([path.join(HERE, 'python_guard.py'), file]), { cwd: dir, timeout: Math.min(600, timeout || 180) * 1000, env: { PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
    return { exit: r.code, stdout: r.out.slice(-12000), stderr: r.err.slice(-8000), timedOut: r.timedOut };
  },
  godotRun: ({ project, headless }) => godotRun(project, { headless }),
  godotPlay: ({ project }) => {
    const g = godotPath(true);
    if (!g) throw new Error('Godot är inte installerat');
    spawn(g, ['--path', projectDir(project)], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  },
  godotEditor: ({ project }) => {
    const g = godotPath(true);
    if (!g) throw new Error('Godot är inte installerat');
    spawn(g, ['-e', '--path', projectDir(project)], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  },
  godotExport: ({ project, target }) => godotExport(project, target),
  zipProject: ({ project, name }) => zipDir(projectDir(project), path.join(EXPORTS(), project, (name || project) + '-godot.zip')),
  reveal: ({ file, project }) => { shell.showItemInFolder(file || projectDir(project)); return { ok: true }; },
  searchAssets: args => phSearch(args || {}),
  downloadAsset: args => phDownload(args || {}),
  lessons: () => { try { return JSON.parse(fs.readFileSync(path.join(DATA(), 'astryx-lessons.json'), 'utf8')); } catch (e) { return []; } },
  saveLessons: ({ lessons }) => { fs.writeFileSync(path.join(DATA(), 'astryx-lessons.json'), JSON.stringify((lessons || []).slice(-200), null, 1)); return { ok: true }; },
  notify: ({ title, body }) => { if (Notification.isSupported()) new Notification({ title, body }).show(); if (win && !win.isFocused()) win.flashFrame(true); return { ok: true }; },
  confirm: async ({ title, message, detail, ok }) => {
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: [ok || 'OK', 'Avbryt'], defaultId: 0, cancelId: 1, title, message, detail });
    return { ok: r.response === 0 };
  },
};
for (const [name, fn] of Object.entries(API)) {
  ipcMain.handle('nx:' + name, async (e, args) => {
    try { return { ok: true, value: await fn(args || {}) }; }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });
}

// ------------------------------------------------------------------ window
function create() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#07071a', title: 'Nexora', autoHideMenuBar: true,
    icon: path.join(HERE, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(HERE, 'preload.js') },
  });
  win.loadFile(path.join(HERE, 'nexora.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  if (process.env.NEXORA_SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const r = await win.webContents.executeJavaScript(
        "new Promise(res => setTimeout(() => res(JSON.stringify({ ok: !!(window.Nexora && window.NexoraLocal && window.NexoraAI && document.querySelector('header.top')), " +
        "desktop: !!window.nexoraDesktop, html: NexoraLocal.buildHtml(NexoraLocal.config('ett plattformsspel i lava', { dim: '2d' }), Nexora.RT).length })), 500))");
      console.log('SMOKE_RESULT=' + r);
      app.quit();
    });
  }
}

if (process.platform === 'darwin') {
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
} else {
  Menu.setApplicationMenu(null);
}
if (process.env.NEXORA_USER_DATA) app.setPath('userData', process.env.NEXORA_USER_DATA);
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
