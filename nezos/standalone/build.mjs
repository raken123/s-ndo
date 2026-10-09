// Builds dist/nezos.html: the whole Nezos app as ONE self-contained HTML file.
// Every ES module is embedded as a data: URL behind an import map; the
// server is replaced by standalone/local-api.js (IndexedDB + direct OpenAI
// calls). three.js is loaded from a CDN.
//
//   node standalone/build.mjs [output.html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist/nezos.html'));
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.180.0';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const id = (p) => `@nz/${p}`;
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

function rewriteImports(code, from) {
  return code.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\2/g, (m, kw, q, spec) => {
    let target = spec;
    if (spec.startsWith('/js/')) target = id(`public${spec}`);
    else if (spec.startsWith('./') || spec.startsWith('../')) target = id(path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)));
    return `${kw}${q}${target}${q}`;
  });
}

// Browser pages talk to "the server" through location/history; route those
// through the hash router in standalone/boot.js.
function rewriteNavigation(code) {
  return code
    .replace(/(?<![.\w$])location\.(href\s*=(?!=)|pathname|search|hash|origin)/g, '__nz.$1')
    .replace(/(?<![.\w$])history\.replaceState\(/g, '__nz.replaceState(')
    .replace("this.iframe.src = '/play.html';", 'this.iframe.srcdoc = __nz.playSrcdoc;');
}

const MODULES = [
  'public/js/api.js', 'public/js/pricing.js', 'public/js/hero.js', 'public/js/engine/engine.js',
  ...fs.readdirSync(path.join(ROOT, 'public/js/studio')).map((f) => `public/js/studio/${f}`),
  'src/plans.js', 'src/models.js', 'src/prompts.js', 'src/templates.js', 'src/openai.js',
  'standalone/boot.js', 'standalone/local-api.js', 'standalone/openai-browser.js',
];

const imports = { three: `${THREE_CDN}/build/three.module.js`, 'three/addons/': `${THREE_CDN}/examples/jsm/` };
const addModule = (p, code) => {
  let out = rewriteImports(code, p);
  if (p.startsWith('public/') || p.startsWith('pages/')) {
    out = rewriteNavigation(out);
    if (/(?<![.\w$])(location\.(href|pathname|search)|history\.replaceState)/.test(out) || out.includes("'/play.html'")) {
      throw new Error(`${p}: unrewritten navigation`);
    }
  }
  imports[id(p)] = dataUrl(out);
};
for (const p of MODULES) addModule(p, read(p));

// ---- pages: markup + their inline module script
const pages = {};
for (const [name, file] of [['index', 'index.html'], ['auth', 'auth.html'], ['dashboard', 'dashboard.html'], ['models', 'models.html'], ['studio', 'studio.html']]) {
  const html = read(`public/${file}`);
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  const bodyTag = html.match(/<body([^>]*)>/);
  const bodyClass = (bodyTag[1].match(/class="([^"]*)"/) || [])[1] || '';
  let body = html.slice(bodyTag.index + bodyTag[0].length, html.lastIndexOf('</body>'));
  let module;
  const src = body.match(/<script type="module" src="([^"]+)"><\/script>/);
  if (src) {
    module = id(`public${src[1]}`);
  } else {
    const inline = [...body.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    module = id(`pages/${name}.js`);
    addModule(`pages/${name}.js`, inline);
  }
  body = body.replace(/<script[\s\S]*?<\/script>/g, '').trim();
  pages[name] = { title, bodyClass, body, module };
}

// ---- sandboxed game runtime for play mode (iframe srcdoc)
const engineId = id('public/js/engine/engine.js');
const playSrcdoc = read('public/play.html')
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports: {
    three: imports.three, 'three/addons/': imports['three/addons/'], [engineId]: imports[engineId],
  } })}</script>`)
  .replace("from '/js/engine/engine.js'", `from '${engineId}'`);

const build = { pages, playSrcdoc, engineSource: read('public/js/engine/engine.js'), threeCdn: THREE_CDN };
const safe = (s) => s.replace(/</g, '\\u003c');
const css = `${read('public/css/app.css')}\n${read('public/css/studio.css')}`;
const favicon = `data:image/svg+xml;base64,${Buffer.from(read('public/favicon.svg')).toString('base64')}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nezos — Build 3D games with AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="icon" href="${favicon}">
<style>
${css}
</style>
<script>
/* =====================================================================
 * Nezos (single-file edition)
 *
 * OpenAI API key: paste it between the quotes below, or leave it empty
 * and use the "🔑 API key" button in the app (stored in this browser).
 * Anyone who has this file can read a key written here.
 * ===================================================================== */
window.NEZOS_OPENAI_KEY = "";

(function () {
  var K = 'nezos.openaiKey';
  function key() { try { return localStorage.getItem(K) || window.NEZOS_OPENAI_KEY || ''; } catch (e) { return window.NEZOS_OPENAI_KEY || ''; } }
  window.NEZOS_HAS_KEY = function () { return !!key(); };
  window.process = { env: { get OPENAI_API_KEY() { return key(); } } };
})();
</script>
<script type="application/json" id="nz-build">${safe(JSON.stringify(build))}</script>
<script>window.__NZ_BUILD = JSON.parse(document.getElementById('nz-build').textContent);</script>
<script type="importmap">${JSON.stringify({ imports })}</script>
</head>
<body>
<div style="min-height:100vh;display:grid;place-items:center;color:#9aa0c3;font:600 15px system-ui">Loading Nezos…</div>
<script type="module">import '${id('standalone/boot.js')}';</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${(html.length / 1024).toFixed(0)} KB, ${Object.keys(imports).length - 2} modules)`);
