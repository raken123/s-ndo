// Search: apps, settings, notes and files from one field.
import { h, ic, nextFrame } from '../core/dom.js';
import { settings, storage } from '../core/store.js';
import { allApps } from '../services/apps.js';
import { vfs } from '../services/vfs.js';
import { system } from './system.js';
import { appIcon } from '../ui/components.js';
import { SETTINGS_INDEX } from '../apps/settings-index.js';

export class Search {
  constructor(layer) {
    this.layer = layer; this.isOpen = false;
    this.input = h('input', { type: 'search', placeholder: 'Search apps, settings, notes and files', 'aria-label': 'Search', autocomplete: 'off', enterkeyhint: 'go' });
    this.results = h('div', { class: 'search__results' });
    layer.append(h('div', { class: 'search__bar' },
      h('label', { class: 'r-search search__field' }, ic('search'), this.input),
      h('button', { class: 'r-btn r-btn--plain', onclick: () => this.close() }, 'Cancel')), this.results);
    this.input.addEventListener('input', () => this.render());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const f = this.results.querySelector('.search-hit'); if (f) f.click(); }
      if (e.key === 'Escape') this.close();
    });
  }
  open() {
    if (this.isOpen || system.locked) return;
    this.isOpen = true; this.layer.hidden = false; this.input.value = ''; this.render();
    nextFrame().then(() => { this.layer.classList.add('is-open'); this.input.focus(); });
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false; this.layer.classList.remove('is-open'); this.input.blur();
    setTimeout(() => { if (!this.isOpen) this.layer.hidden = true; }, 250);
  }

  render() {
    const q = this.input.value.trim().toLowerCase();
    const apps = allApps();
    const out = [];
    const hit = (iconNode, title, sub, onClick) => h('button', { class: 'search-hit', type: 'button', onclick: () => { this.remember(this.input.value); this.close(); onClick(); } }, iconNode, h('span', { class: 'search-hit__text' }, h('span', { class: 'search-hit__title' }, title), sub ? h('span', { class: 'search-hit__sub' }, sub) : null));
    const group = (title, items) => { if (items.length) out.push(h('div', { class: 'search__group' }, h('div', { class: 'r-section__header' }, title), h('div', { class: 'r-list' }, items))); };

    if (!q) {
      out.push(h('div', { class: 'r-section__header search__label' }, 'Suggested apps'));
      out.push(h('div', { class: 'search__suggest' }, apps.slice(0, 8).map((a) => h('button', { class: 'tile', type: 'button', onclick: () => { this.close(); system.openApp(a.id); } }, h('span', { class: 'tile__icon' }, appIcon(a)), h('span', { class: 'tile__label' }, a.short || a.name)))));
      const recent = settings.get('searchHistory') ? (storage.get('rakenos.search.recent') || []) : [];
      if (recent.length) group('Recent searches', recent.map((r) => h('button', { class: 'search-hit', type: 'button', onclick: () => { this.input.value = r; this.render(); } }, h('span', { class: 'search-hit__glyph' }, ic('history')), h('span', { class: 'search-hit__text' }, h('span', { class: 'search-hit__title' }, r)))));
      this.results.replaceChildren(...out);
      return;
    }
    group('Apps', apps.filter((a) => a.name.toLowerCase().includes(q)).map((a) => hit(appIcon(a, 'sm'), a.name, a.kind === 'ras' ? 'RAS app' : 'App', () => system.openApp(a.id))));
    group('Settings', SETTINGS_INDEX().filter((s) => (s.title + ' ' + (s.keywords || '')).toLowerCase().includes(q)).slice(0, 8).map((s) => hit(h('span', { class: 'search-hit__glyph', style: { background: s.color } }, ic(s.icon)), s.title, s.path, () => system.openApp('settings', { route: s.route }))));
    const notes = (storage.get('rakenos.notes') || []).filter((n) => n.text.toLowerCase().includes(q)).slice(0, 5);
    group('Notes', notes.map((n) => hit(h('span', { class: 'search-hit__glyph', style: { background: '#d99a1e' } }, ic('note')), n.text.split('\n')[0] || 'Untitled', snippet(n.text, q), () => system.openApp('notes', { route: `note:${n.id}` }))));
    group('Files', vfs.search(q).slice(0, 5).map((f) => hit(h('span', { class: 'search-hit__glyph', style: { background: '#2f7ad8' } }, ic(f.kind === 'folder' ? 'folder' : 'file-text')), f.name, vfs.path(f.parent).map((p) => p.name).join(' › ') || 'Files', () => system.openApp('files', { route: `node:${f.id}` }))));
    if (!out.length) out.push(h('div', { class: 'r-empty' }, ic('search'), h('div', { class: 'r-empty__title' }, `No results for “${this.input.value.trim()}”`), h('div', { class: 'r-empty__text' }, 'Try a different word.')));
    this.results.replaceChildren(...out);
  }

  remember(q) {
    if (!settings.get('searchHistory') || !q.trim()) return;
    const r = [q.trim(), ...(storage.get('rakenos.search.recent') || []).filter((x) => x !== q.trim())].slice(0, 5);
    storage.set('rakenos.search.recent', r);
  }
}

function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  const s = Math.max(0, i - 20);
  return (s > 0 ? '…' : '') + text.slice(s, s + 60).replace(/\n/g, ' ');
}
