// Appearance: theme, text size, motion, contrast, brightness and wallpapers.
import { settings } from '../core/store.js';
import { platform } from '../core/platform.js';

const root = document.documentElement;
const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
// When RakenOS is embedded in a host page that stamps its own light/dark choice on
// the root element, Automatic follows that choice. On a device there is no host value.
let hostTheme = root.getAttribute('data-theme');
let appliedTheme = null;

export function effectiveTheme() {
  const t = settings.get('theme');
  if (t === 'auto') return hostTheme || (mql && mql.matches ? 'dark' : 'light');
  return t;
}

export function applyAppearance() {
  const theme = effectiveTheme();
  appliedTheme = theme;
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  root.dataset.textSize = settings.get('textSize');
  root.dataset.boldText = settings.get('boldText') ? 'on' : 'off';
  root.dataset.motion = settings.get('reduceMotion') || settings.get('batterySaver') ? 'reduced' : 'full';
  root.dataset.contrast = settings.get('increaseContrast') ? 'more' : 'normal';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0c0d10' : '#f3f4f6';
  applyWallpaper();
}

export async function applyBrightness() {
  const v = settings.get('brightness');
  const native = await platform.setBrightness(v);
  // In a browser the display cannot be dimmed, so a scrim approximates it.
  const dim = document.getElementById('brightness-scrim');
  if (dim) dim.style.opacity = native ? '0' : String(Math.max(0, (0.6 - v) * 0.8));
}

// ------------------------------------------------------------ Wallpapers --
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function ridge(r, y, amp, w = 400, h = 900) {
  const pts = []; const f1 = 1 + r() * 2; const f2 = 3 + r() * 4; const p1 = r() * 6; const p2 = r() * 6;
  for (let x = 0; x <= w; x += 10) {
    const yy = y + Math.sin((x / w) * Math.PI * f1 + p1) * amp + Math.sin((x / w) * Math.PI * f2 + p2) * amp * 0.35;
    pts.push(`${x},${yy.toFixed(1)}`);
  }
  return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
}

const PALETTES = {
  fjord: {
    name: 'Fjord',
    light: { sky: ['#dfe7ef', '#f2f4f6'], layers: ['#b9c8d8', '#98acc2', '#7690ab', '#566f8b', '#3d536c'] },
    dark: { sky: ['#0d141d', '#18212c'], layers: ['#1e2a38', '#223244', '#263a50', '#2b425b', '#172230'] },
  },
  dune: {
    name: 'Dune',
    light: { sky: ['#f4e9dc', '#f7f1ea'], layers: ['#ead3b8', '#dfbd98', '#cf9f77', '#b8805b', '#946049'] },
    dark: { sky: ['#17120e', '#231b15'], layers: ['#2c211a', '#35271d', '#3e2d21', '#4a3426', '#241a14'] },
  },
  moss: {
    name: 'Moss',
    light: { sky: ['#e2eadf', '#f1f4ef'], layers: ['#c4d4bd', '#a3bb9a', '#80a078', '#5f825a', '#435f41'] },
    dark: { sky: ['#0d130e', '#161f17'], layers: ['#1b261c', '#1f2e21', '#243626', '#2a3f2c', '#141d15'] },
  },
  graphite: {
    name: 'Graphite',
    light: { sky: ['#e6e7ea', '#f3f3f5'], layers: ['#d6d8dc', '#c3c6cc', '#aeb2ba', '#969ba5', '#7c828d'] },
    dark: { sky: ['#0b0c0e', '#131417'], layers: ['#17191c', '#1b1d21', '#1f2226', '#24272c', '#101113'] },
  },
};

export const WALLPAPERS = Object.entries(PALETTES).map(([id, p]) => ({ id, name: p.name }));

export function wallpaperSvg(id, theme) {
  const p = (PALETTES[id] || PALETTES.fjord)[theme];
  const r = rng([...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const layers = p.layers.map((c, i) => `<path d="${ridge(r, 430 + i * 95, 42 - i * 4)}" fill="${c}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs><rect width="400" height="900" fill="url(#s)"/>${layers}</svg>`;
}

export function wallpaperUrl(id, theme = effectiveTheme()) {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(wallpaperSvg(id, theme))}")`;
}

function applyWallpaper() {
  root.style.setProperty('--wallpaper', wallpaperUrl(settings.get('wallpaper')));
}

export function watchAppearance() {
  for (const k of ['theme', 'textSize', 'boldText', 'reduceMotion', 'increaseContrast', 'wallpaper', 'batterySaver']) settings.on(k, applyAppearance);
  settings.on('brightness', applyBrightness);
  if (mql) mql.addEventListener('change', () => { if (settings.get('theme') === 'auto') applyAppearance(); });
  new MutationObserver(() => {
    const v = root.getAttribute('data-theme');
    if (v && v !== appliedTheme) { hostTheme = v; applyAppearance(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  applyAppearance();
  applyBrightness();
}
