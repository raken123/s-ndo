// Entry point of the single-file build: hash routing between the app's pages,
// link interception, the API-key dialog, and the local /api shim.
import { install, exportProject, reloadModels } from './local-api.js';

const BUILD = window.__NZ_BUILD; // { pages, engineSource, playSrcdoc, threeCdn }

// ---------------------------------------------------------------- routing
// The app's server-style paths live in the hash: "#/dashboard?x=1@plans"
// (everything after "@" is the page's own #fragment).
function parse() {
  const m = decodeURI(location.hash.slice(1)).match(/^([^?@]*)(\?[^@]*)?(?:@(.*))?$/) || [];
  return { path: m[1] && m[1].startsWith('/') ? m[1] : '/', search: m[2] || '', sub: m[3] || '' };
}
const encode = ({ path, search, sub }) => `#${encodeURI(path + search + (sub ? `@${sub}` : ''))}`;
function splitUrl(url) {
  const [rest, sub = ''] = url.split('#');
  const [path, q] = rest.split('?');
  return { path: path || '/', search: q ? `?${q}` : '', sub };
}

let navigating = false;
function go(url) {
  if (url.startsWith('#')) {
    history.replaceState(null, '', encode({ ...parse(), sub: url.slice(1) }));
    return;
  }
  navigating = true;
  location.hash = encode(splitUrl(url));
  location.reload();
}

window.__nz = {
  get pathname() { return parse().path; },
  get search() { return parse().search; },
  get hash() { const s = parse().sub; return s ? `#${s}` : ''; },
  get origin() { return location.href.split('#')[0]; },
  set href(url) { go(String(url)); },
  get href() { return location.href; },
  replaceState(_s, _t, url) {
    const next = url.startsWith('#') ? { ...parse(), sub: url.slice(1) } : splitUrl(url);
    history.replaceState(null, '', encode(next));
  },
  playSrcdoc: BUILD.playSrcdoc,
};

window.addEventListener('hashchange', () => { if (!navigating) location.reload(); });

document.addEventListener('click', async (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a || a.dataset.nzDownload) return;
  const href = a.getAttribute('href');
  if (/^[a-z]+:/i.test(href)) return; // external / blob links
  e.preventDefault();
  const exp = href.match(/^\/api\/projects\/([^/]+)\/export$/);
  if (exp) {
    try { await exportProject(exp[1], BUILD); } catch (err) { alert(err.message); }
    return;
  }
  if (href.startsWith('#')) {
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (a.target === '_blank') { window.open(__nz.origin + encode(splitUrl(href)), '_blank'); return; }
  go(href);
}, true);

// ---------------------------------------------------------------- API key
// window.NEZOS_HAS_KEY and the process.env shim are set up by a classic
// <script> in the HTML head, before any module (src/openai.js reads process.env).
const KEY_STORE = 'nezos.openaiKey';

function keyDialog() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  const embedded = !!window.NEZOS_OPENAI_KEY;
  back.innerHTML = `<form class="modal">
    <h2>🔑 OpenAI API key</h2>
    <p class="sub">Nezos calls OpenAI directly from this page with your key. ${embedded ? 'A key is already set in the HTML file. A key entered here overrides it.' : 'The key is saved in this browser only.'}</p>
    <label class="field"><span>API key</span><input class="input" name="key" type="password" placeholder="sk-..." autocomplete="off" value="${localStorage.getItem(KEY_STORE) ? '••••••••' : ''}"></label>
    <div class="actions"><button type="button" class="btn" data-clear>Remove</button><button type="button" class="btn" data-x>Cancel</button><button class="btn btn-primary">Save</button></div>
  </form>`;
  document.body.appendChild(back);
  const form = back.querySelector('form');
  back.querySelector('[data-x]').onclick = () => back.remove();
  back.querySelector('[data-clear]').onclick = () => { localStorage.removeItem(KEY_STORE); back.remove(); reloadModels(); };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const v = form.key.value.trim();
    if (v && !v.startsWith('•')) localStorage.setItem(KEY_STORE, v);
    back.remove();
    reloadModels().then(() => location.reload());
  };
  form.key.focus();
}

function addKeyButton() {
  const host = document.querySelector('.nav .right, .tb-right');
  if (!host || host.querySelector('[data-nz-key]')) return;
  const b = document.createElement('button');
  b.className = 'btn btn-ghost btn-sm';
  b.dataset.nzKey = '1';
  const compact = host.classList.contains('tb-right');
  b.textContent = compact ? '🔑' : window.NEZOS_HAS_KEY() ? '🔑 API key' : '🔑 Add API key';
  b.title = window.NEZOS_HAS_KEY() ? 'OpenAI API key' : 'Add your OpenAI API key';
  if (!window.NEZOS_HAS_KEY()) b.style.color = 'var(--warn)';
  b.onclick = keyDialog;
  host.prepend(b);
}

// ---------------------------------------------------------------- pages
function pageFor(path) {
  if (path === '/login' || path === '/signup') return 'auth';
  if (path === '/dashboard') return 'dashboard';
  if (path === '/models') return 'models';
  if (path.startsWith('/studio/')) return 'studio';
  return 'index';
}

await install();
const name = pageFor(parse().path);
const page = BUILD.pages[name];
document.title = page.title;
document.body.className = page.bodyClass;
document.body.innerHTML = page.body;
addKeyButton();
new MutationObserver(addKeyButton).observe(document.body, { childList: true, subtree: true });
if (name === 'dashboard' && !window.NEZOS_HAS_KEY()) setTimeout(keyDialog, 400);
await import(page.module);
