// Builds BFDI Talk as ONE self-contained HTML file: the website (site/page.template.html) with the
// whole app inside it. "Play it right here" opens the app; the 🏠 button goes back to the site.
//
//   node tools/make_site.mjs [--out site/index.html] [--fragment] [--with-key] [--with-accounts]
//
// --fragment       no <!doctype>/<html>/<head>/<body> (for publishing as a claude.ai artifact)
// --with-key       build in GEMINI_API_KEY (env or .env). Never for anything you publish or commit.
// --with-accounts  build in SUPABASE_URL / SUPABASE_ANON_KEY and the Supabase client
//
// The app picks its engine when it starts (ENGINE 'auto'): inside Claude it uses the web lite
// engine (www/js/web-engine.js); anywhere else it is the normal Gemini Live app.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(root, 'site', 'index.html');

// ------------------------------------------------------------------ config

const env = { ...process.env };
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const config = { ENGINE: 'auto', GEMINI_API_KEY: '', SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
if (flag('--with-key')) config.GEMINI_API_KEY = env.GEMINI_API_KEY || '';
if (flag('--with-accounts')) {
  config.SUPABASE_URL = env.SUPABASE_URL || '';
  config.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || '';
}
const accounts = !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);

// ------------------------------------------------------------------ pieces

const dataUrl = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const pngSize = file => { const b = readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const safeScript = js => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Sprites, for the app (path -> data URL) and the site's demo character (key -> {path, w, h}).
const assets = {};
const siteSprites = {};
for (const [dir, prefix, key] of [['eyes', 'eyes', 'e'], ['mouths', 'mouth', 'm']]) {
  for (const f of readdirSync(join(www, 'assets', dir)).filter(f => f.endsWith('.png')).sort()) {
    const file = join(www, 'assets', dir, f);
    const src = dataUrl(file, 'image/png');
    assets[`assets/${dir}/${f}`] = src;
    const n = Number(f.slice(prefix.length + 1, -4));
    const { w, h } = pngSize(file);
    siteSprites[`${key}${n}`] = { p: `assets/${dir}/${f}`, w: Math.round(w / 3 * 10) / 10, h: Math.round(h / 3 * 10) / 10 };
  }
}

// The app's script, bundled. config.js (which may hold a local key) is never bundled.
const bundle = await build({
  entryPoints: [join(www, 'js', 'app.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2022',
  write: false,
  legalComments: 'none',
  plugins: [{
    name: 'no-local-config',
    setup(b) {
      b.onResolve({ filter: /\/config\.js$/ }, () => ({ path: 'config', namespace: 'empty' }));
      b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'export default {};', loader: 'js' }));
    },
  }],
});
const appJs = bundle.outputFiles[0].text;
if (/AIza|AQ\.[A-Za-z0-9_-]{20,}/.test(appJs) && !config.GEMINI_API_KEY) throw new Error('A key ended up in the bundle');

const appCss = readFileSync(join(www, 'css', 'style.css'), 'utf8')
  .replace("url('../fonts/fredoka.woff2')", `url('${dataUrl(join(www, 'fonts', 'fredoka.woff2'), 'font/woff2')}')`);

const appHtml = readFileSync(join(www, 'index.html'), 'utf8');
const appBody = appHtml.slice(appHtml.indexOf('<body>') + 6, appHtml.indexOf('</body>'))
  .replace(/<script[^>]*>\s*<\/script>\s*/g, '');

// The website goes into a shadow root, so its styles and ids never mix with the app's.
const page = readFileSync(join(root, 'site', 'page.template.html'), 'utf8');
const siteCss = page.slice(page.indexOf('<style>') + 7, page.indexOf('</style>'))
  .replace(/^:root \{/m, ':host {\n  display: block;')
  .replace(/^body \{/m, '.site-root {\n  min-height: 100vh;');
const siteMarkup = page.slice(page.indexOf('</style>') + 8, page.indexOf('<script>')).trim();
const siteJs = page.slice(page.indexOf('<script>') + 8, page.lastIndexOf('</script>'))
  .replace('/*SPRITES*/{}', `Object.fromEntries(Object.entries(${JSON.stringify(siteSprites)}).map(([k, v]) => [k, { ...v, src: window.BFDI_ASSETS[v.p] }]))`);
const fontLinks = page.match(/<link [^>]*>/g).join('\n');

const hostCss = `
/* ---------- one-file build: the website over the app */
#siteHost { position: fixed; inset: 0; z-index: 60; overflow-y: auto; overscroll-behavior: contain; background: #081846; }
body.site-open { overflow: hidden; }
#homeBtn { position: fixed; left: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 30;
  font: 600 .85rem 'Fredoka', system-ui, sans-serif; color: #111; background: #fff; border: 3px solid #111; border-radius: 999px;
  padding: 6px 12px; box-shadow: 0 4px 0 #111; cursor: pointer; }
#playshow:not([hidden]) ~ #homeBtn { display: none; }
@media (max-width: 700px) { #homeBtn { bottom: calc(96px + env(safe-area-inset-bottom, 0px)); left: 10px; padding: 3px 9px; font-size: .78rem; } }
`;

const mountJs = `(() => {
  const host = document.getElementById('siteHost');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.appendChild(document.getElementById('siteTpl').content.cloneNode(true));
  window.SITE_ROOT = shadow;
  const show = on => {
    host.hidden = !on;
    document.body.classList.toggle('site-open', on);
    if (on) host.scrollTop = 0;
  };
  window.SITE_OPEN_APP = () => show(false);
  document.getElementById('homeBtn').onclick = () => show(true);
  let atApp = false;
  try { atApp = location.hash === '#app'; } catch {}
  show(!atApp);
})();`;

// Browser storage can be missing inside some frames; fall back to memory so the app still runs.
const storageJs = `(() => {
  try { const k = '__bfdi'; localStorage.setItem(k, k); localStorage.removeItem(k); return; } catch {}
  const m = new Map();
  const mem = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); },
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
  try { Object.defineProperty(window, 'localStorage', { value: mem, configurable: true }); } catch {}
})();`;

const supabaseJs = accounts
  ? readFileSync(join(root, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), 'utf8')
  : '';

// ------------------------------------------------------------------ assemble

const head = [
  '<title>BFDI Talk</title>',
  fontLinks,
  `<style>\n${appCss}\n${hostCss}</style>`,
].join('\n');

const body = [
  appBody.trim(),
  '<button type="button" id="homeBtn" aria-label="BFDI Talk website">🏠 Site</button>',
  '<div id="siteHost"></div>',
  `<template id="siteTpl"><style>${siteCss}</style><div class="site-root">${siteMarkup}</div></template>`,
  `<script>${storageJs}\nwindow.BFDI_ASSETS = ${JSON.stringify(assets)};\nwindow.BFDI_CONFIG = ${JSON.stringify(config)};</script>`,
  supabaseJs ? `<script>${safeScript(supabaseJs)}</script>` : '',
  `<script>${mountJs}\n${safeScript(siteJs)}</script>`,
  `<script>${safeScript(appJs)}</script>`,
].filter(Boolean).join('\n');

const html = flag('--fragment')
  ? `${head}\n${body}\n`
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n`
    + `<meta name="description" content="Talk out loud with your own object-show character. Lip-sync, 19 moods, Playshow Mode, Agent Mode.">\n`
    + `<link rel="icon" href="${dataUrl(join(www, 'assets', 'icon.png'), 'image/png')}">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1024 / 1024).toFixed(2)} MB (key ${config.GEMINI_API_KEY ? 'BUILT IN' : 'none'}, accounts ${accounts ? 'on' : 'off'}${flag('--fragment') ? ', fragment' : ''})`);
