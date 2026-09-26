// Browser: address bar, bookmarks, history and a start page.
import { h, ic } from '../core/dom.js';
import { storage } from '../core/store.js';
import { platform } from '../core/platform.js';
import { menu, toast, sheet } from '../ui/overlays.js';
import { emptyState } from '../ui/components.js';

const DEFAULT_BOOKMARKS = [
  { title: 'Wikipedia', url: 'https://en.m.wikipedia.org/' },
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
  { title: 'Apache Cordova', url: 'https://cordova.apache.org/' },
];
const COLORS = ['#2f5ae0', '#16945a', '#d23a3a', '#b86e00', '#6b55d6', '#0e7c86', '#c9406f'];

function normalize(input) {
  const s = input.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s)) return `https://${s}`;
  return `https://duckduckgo.com/html/?q=${encodeURIComponent(s)}`;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export default {
  mount(container) {
    let bookmarks = storage.get('rakenos.browser.bookmarks') || DEFAULT_BOOKMARKS;
    let history = storage.get('rakenos.browser.history') || [];
    const stack = []; let pos = -1; // navigation stack of pages opened in this tab
    const field = h('input', { class: 'br__field', type: 'url', placeholder: 'Search or enter address', 'aria-label': 'Address', enterkeyhint: 'go', autocapitalize: 'off', spellcheck: 'false' });
    const backBtn = h('button', { class: 'r-icon-btn', 'aria-label': 'Back', onclick: () => go(pos - 1) }, ic('chevron-left'));
    const fwdBtn = h('button', { class: 'r-icon-btn', 'aria-label': 'Forward', onclick: () => go(pos + 1) }, ic('chevron-right'));
    const reloadBtn = h('button', { class: 'r-icon-btn', 'aria-label': 'Reload', onclick: () => { if (pos >= 0) load(stack[pos], false); } }, ic('reload'));
    const moreBtn = h('button', { class: 'r-icon-btn', 'aria-label': 'More', onclick: () => menu(moreBtn, [
      pos >= 0 ? { label: isBookmarked() ? 'Remove Bookmark' : 'Add Bookmark', icon: 'bookmark', action: toggleBookmark } : null,
      pos >= 0 ? { label: 'Open in system browser', icon: 'external', action: () => platform.openExternal(stack[pos]) } : null,
      { label: 'History', icon: 'history', action: showHistory },
      { label: 'Start Page', icon: 'home', action: () => { pos = -1; stack.length = 0; render(); } },
    ]) }, ic('more'));
    const progress = h('div', { class: 'br__progress' });
    const bar = h('form', { class: 'br__bar', onsubmit: (e) => { e.preventDefault(); const u = normalize(field.value); if (u) { field.blur(); load(u); } } },
      backBtn, fwdBtn, h('label', { class: 'br__addr' }, ic('lock', { className: 'br__lock' }), field), reloadBtn, moreBtn);
    const frameWrap = h('div', { class: 'br__view' });
    const root = h('div', { class: 'br' }, bar, progress, frameWrap);
    container.appendChild(root);

    const isBookmarked = () => pos >= 0 && bookmarks.some((b) => b.url === stack[pos]);
    function toggleBookmark() {
      const u = stack[pos];
      bookmarks = isBookmarked() ? bookmarks.filter((b) => b.url !== u) : [...bookmarks, { title: host(u), url: u }];
      storage.set('rakenos.browser.bookmarks', bookmarks); toast(isBookmarked() ? 'Bookmark added' : 'Bookmark removed');
    }
    function showHistory() {
      sheet({ title: 'History', build: (close) => history.length ? h('div', { class: 'r-stack' }, h('div', { class: 'r-list' }, history.slice(0, 30).map((x) => h('button', { class: 'r-row', onclick: () => { close(); load(x.url); } }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, host(x.url)), h('span', { class: 'r-row__subtitle' }, `${x.url.slice(0, 48)} · ${new Date(x.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`))))), h('button', { class: 'r-btn r-btn--destructive r-btn--block', onclick: () => { history = []; storage.set('rakenos.browser.history', []); close(); toast('History cleared'); } }, 'Clear History')) : emptyState('history', 'No history', 'Pages you visit appear here.') });
    }

    function load(url, push = true) {
      if (push) { stack.splice(pos + 1); stack.push(url); pos = stack.length - 1; }
      history = [{ url, time: Date.now() }, ...history.filter((x) => x.url !== url)].slice(0, 100);
      storage.set('rakenos.browser.history', history);
      render();
    }
    function go(i) { if (i < -1 || i >= stack.length) return; pos = i; render(); }

    function render() {
      backBtn.disabled = pos < 0; fwdBtn.disabled = pos >= stack.length - 1; reloadBtn.disabled = pos < 0;
      if (pos < 0) {
        field.value = '';
        frameWrap.replaceChildren(h('div', { class: 'br__start' },
          h('div', { class: 'br__section' }, 'Bookmarks'),
          h('div', { class: 'br__tiles' }, bookmarks.map((b, i) => h('button', { class: 'br__tile', onclick: () => load(b.url) }, h('span', { class: 'br__tile-icon', style: { background: COLORS[i % COLORS.length] } }, b.title.charAt(0).toUpperCase()), h('span', { class: 'br__tile-name' }, b.title)))),
          history.length ? h('div', { class: 'br__section' }, 'Recently visited') : null,
          history.length ? h('div', { class: 'r-list' }, history.slice(0, 5).map((x) => h('button', { class: 'r-row', onclick: () => load(x.url) }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, host(x.url)), h('span', { class: 'r-row__subtitle' }, x.url))))) : null,
          h('p', { class: 'r-footnote r-secondary br__note' }, 'Some websites do not allow being shown inside other apps. Use “Open in system browser” from the menu for those sites.')));
        return;
      }
      const url = stack[pos];
      field.value = url;
      progress.classList.remove('is-done'); progress.classList.add('is-loading');
      const frame = h('iframe', { class: 'br__frame', src: url, title: host(url), referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups' });
      frame.addEventListener('load', () => { progress.classList.add('is-done'); setTimeout(() => progress.classList.remove('is-loading', 'is-done'), 400); });
      frameWrap.replaceChildren(frame);
    }
    render();
    return { back: () => { if (pos >= 0) { go(pos - 1); return true; } return false; } };
  },
};
