// Home Screen: widgets, app grid, dock, search entry and edit mode.
import { h, ic, onLongPress } from '../core/dom.js';
import { settings, storage } from '../core/store.js';
import { allApps, getApp } from '../services/apps.js';
import { notifications } from '../services/notifications.js';
import { rasApps } from '../services/ras-apps.js';
import { updates } from '../services/updates.js';
import { onCapabilitiesChange } from '../core/capabilities.js';
import { system } from './system.js';
import { menu, sheet, confirm, toast } from '../ui/overlays.js';
import { appIcon, switchRow } from '../ui/components.js';
import { clockFmt } from './statusbar.js';

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const WIDGETS = {
  clock: { name: 'Clock', size: 'medium' },
  battery: { name: 'Battery', size: 'medium' },
  notes: { name: 'Notes', size: 'wide' },
  update: { name: 'System Update', size: 'wide' },
};

export class Home {
  constructor(layer, battery) {
    this.layer = layer; this.battery = battery; this.editing = false;
    this.page = h('div', { class: 'home__page' });
    this.widgets = h('div', { class: 'home__widgets' });
    this.grid = h('div', { class: 'home__grid', role: 'list', 'aria-label': 'Apps' });
    this.dock = h('div', { class: 'dock', role: 'list', 'aria-label': 'Dock' });
    this.editBar = h('div', { class: 'home__editbar', hidden: true },
      h('button', { class: 'r-btn r-btn--sm', onclick: () => this.widgetSheet() }, ic('widgets'), 'Widgets'),
      h('button', { class: 'r-btn r-btn--sm r-btn--primary', onclick: () => this.stopEditing() }, 'Done'));
    this.searchBtn = h('button', { class: 'home__search', type: 'button', onclick: () => system.search.open() }, ic('search'), h('span', null, 'Search'));
    this.page.append(this.widgets, this.grid);
    layer.append(this.editBar, this.page, this.searchBtn, this.dock);
    onLongPress(this.page, (e) => { if (!e.target.closest('.tile, .widget')) this.startEditing(); });
    // Swipe down on empty Home Screen space opens Search.
    let sy = null;
    this.page.addEventListener('pointerdown', (e) => { if (!this.editing && !e.target.closest('.tile, .widget, button')) sy = e.clientY; });
    this.page.addEventListener('pointerup', (e) => { if (sy != null && e.clientY - sy > 70) system.search.open(); sy = null; });

    const rerender = () => this.render();
    rasApps.on('change', rerender);
    notifications.on('change', () => this.renderBadges());
    settings.on('widgets', () => this.renderWidgets());
    onCapabilitiesChange(rerender);
    battery.on('change', () => this.renderWidgets());
    setInterval(() => this.updateClockWidget(), 5000);
    if (updates.engine) updates.engine.on((t) => { if (t === 'state' || t === 'installed') this.renderWidgetsSoon(); });
    this.render();
  }

  order() {
    const apps = allApps(); const ids = new Set(apps.map((a) => a.id));
    let dock = settings.get('dock').filter((id) => ids.has(id));
    let grid = settings.get('grid').filter((id) => ids.has(id) && !dock.includes(id));
    for (const a of apps) if (!dock.includes(a.id) && !grid.includes(a.id)) grid.push(a.id);
    return { dock, grid };
  }

  render() {
    const { dock, grid } = this.order();
    this.grid.replaceChildren(...grid.map((id) => this.tile(id)));
    this.dock.replaceChildren(...dock.map((id) => this.tile(id, true)));
    this.renderWidgets();
    this.renderBadges();
  }

  tile(id, inDock = false) {
    const app = getApp(id);
    const label = app.short || app.name;
    const t = h('button', { class: 'tile', type: 'button', role: 'listitem', 'aria-label': app.name, dataset: { app: id } },
      h('span', { class: 'tile__icon' }, appIcon(app), h('span', { class: 'tile__badge r-count', hidden: true })),
      inDock ? null : h('span', { class: 'tile__label' }, label),
      app.kind === 'ras' ? h('span', { class: 'tile__remove', role: 'button', 'aria-label': `Remove ${app.name}`, onclick: (e) => { e.stopPropagation(); this.remove(app); } }, ic('minus')) : null);
    t.addEventListener('click', () => {
      if (this.editing) return;
      system.openApp(id, { fromRect: t.querySelector('.r-app-icon').getBoundingClientRect() });
    });
    onLongPress(t, () => {
      if (this.editing) return;
      menu(t, [
        { label: 'Open', icon: 'arrow-right', action: () => t.click() },
        { label: 'App info', icon: 'info', action: () => system.openApp('settings', { route: `app:${id}` }) },
        app.kind === 'ras' ? { label: 'Remove app', icon: 'trash', destructive: true, action: () => this.remove(app) } : null,
        { label: 'Edit Home Screen', icon: 'grid', action: () => this.startEditing() },
      ]);
    });
    this.dragSupport(t);
    return t;
  }

  async remove(app) {
    if (!(await confirm(`Remove ${app.name}?`, 'The app and its data will be removed from this device.', { confirmLabel: 'Remove', destructive: true }))) return;
    system.wm.close(app.id);
    await rasApps.uninstall(app.id);
    toast(`${app.name} removed`);
  }

  renderBadges() {
    const storeUpdates = storage.get('rakenos.store.updateCount') || 0;
    for (const t of this.layer.querySelectorAll('.tile')) {
      const id = t.dataset.app; const b = t.querySelector('.tile__badge');
      const n = id === 'store' ? storeUpdates : id === 'settings' ? (updates.engine && ['available', 'ready'].includes(updates.engine.state.status) ? 1 : 0) : notifications.unread(id);
      b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n);
    }
  }

  iconRect(id) {
    if (!this.layer.offsetParent && this.layer.hidden) return null;
    const t = this.layer.querySelector(`.tile[data-app="${CSS.escape(id)}"] .r-app-icon`);
    return t ? t.getBoundingClientRect() : null;
  }

  // ---------------------------------------------------------------- Widgets
  renderWidgetsSoon() { clearTimeout(this.wt); this.wt = setTimeout(() => { this.renderWidgets(); this.renderBadges(); }, 50); }

  renderWidgets() {
    const list = settings.get('widgets');
    this.widgets.replaceChildren(...list.filter((w) => WIDGETS[w]).map((w) => this.widget(w)));
    this.widgets.hidden = !list.length;
  }

  widget(kind) {
    const wrap = (cls, onClick, ...kids) => h('button', { class: `widget widget--${WIDGETS[kind].size} widget--${kind} ${cls || ''}`, type: 'button', onclick: () => !this.editing && onClick && onClick(), 'aria-label': `${WIDGETS[kind].name} widget` }, ...kids);
    if (kind === 'clock') {
      const alarms = (storage.get('rakenos.clock') || {}).alarms || [];
      const next = alarms.filter((a) => a.on).map((a) => a.time).sort()[0];
      return wrap('', () => system.openApp('clock'),
        h('span', { class: 'widget__eyebrow' }, dateFmt.format(new Date()).split(',')[0]),
        h('span', { class: `widget__clock r-tabular ${clockFmt.format(new Date()).length > 5 ? 'is-long' : ''}`, dataset: { clock: '1' } }, clockFmt.format(new Date())),
        h('span', { class: 'widget__sub' }, dateFmt.format(new Date()).split(', ').slice(1).join(', ') || dateFmt.format(new Date())),
        h('span', { class: 'widget__foot' }, ic('alarm'), next ? `Alarm ${next}` : 'No alarms'));
    }
    if (kind === 'battery') {
      const b = this.battery.state; const r = 30; const c = 2 * Math.PI * r;
      return wrap('', () => system.openApp('settings', { route: 'battery' }),
        h('span', { class: 'widget__eyebrow' }, 'Battery'),
        h('span', { class: 'widget__ring', html: `<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="7"/><circle cx="36" cy="36" r="${r}" fill="none" stroke="${b.level <= 20 && !b.charging ? 'var(--r-danger)' : 'var(--r-success)'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * b.level) / 100} ${c}" transform="rotate(-90 36 36)"/></svg>` },
          h('span', { class: 'widget__ring-label r-tabular' }, `${b.level}%`)),
        h('span', { class: 'widget__foot' }, b.charging ? ic('bolt') : ic('battery'), b.charging ? 'Charging' : settings.get('batterySaver') ? 'Battery Saver on' : 'On battery'));
    }
    if (kind === 'notes') {
      const notes = storage.get('rakenos.notes') || [];
      const n = notes.slice().sort((a, b) => (b.pinned - a.pinned) || (b.modified - a.modified))[0];
      const [title, ...rest] = (n ? n.text : '').split('\n');
      return wrap('', () => system.openApp('notes', { route: n ? `note:${n.id}` : 'new' }),
        h('span', { class: 'widget__eyebrow' }, ic('note'), 'Notes'),
        h('span', { class: 'widget__title' }, n ? title || 'New note' : 'No notes yet'),
        h('span', { class: 'widget__text' }, n ? rest.join(' ').trim() || 'No additional text' : 'Tap to write your first note.'));
    }
    if (kind === 'update') {
      const s = updates.engine ? updates.engine.snapshot : null;
      const label = !s ? '' : { downloading: `Downloading RakenOS ${s.target} · ${Math.round(s.progress * 100)}%`, ready: `RakenOS ${s.target} is ready to install`, available: `RakenOS ${s.target} is available`, 'rollout-pending': `RakenOS ${s.target} is rolling out` }[s.status] || `RakenOS ${s.system.version} is up to date`;
      return wrap('', () => system.openApp('settings', { route: 'update' }),
        h('span', { class: 'widget__eyebrow' }, ic('update'), 'System Update'),
        h('span', { class: 'widget__title' }, label),
        h('span', { class: 'widget__text' }, s && s.lastChecked ? `Last checked ${new Date(s.lastChecked).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Not checked yet'));
    }
    return h('div');
  }

  updateClockWidget() { for (const el of this.widgets.querySelectorAll('[data-clock]')) el.textContent = clockFmt.format(new Date()); }

  widgetSheet() {
    sheet({ title: 'Widgets', build: () => {
      const list = h('div', { class: 'r-list' });
      const render = () => list.replaceChildren(...Object.entries(WIDGETS).map(([id, w]) => switchRow({
        title: w.name, subtitle: w.size === 'wide' ? 'Wide' : 'Medium', checked: settings.get('widgets').includes(id),
        onChange: (on) => { const cur = settings.get('widgets').filter((x) => x !== id); settings.set({ widgets: on ? [...cur, id] : cur }); },
      })));
      render();
      return h('div', { class: 'r-stack' }, h('p', { class: 'r-subhead r-secondary' }, 'Choose which widgets appear at the top of the Home Screen.'), list);
    } });
  }

  // -------------------------------------------------------------- Editing
  startEditing() {
    if (this.editing) return;
    this.editing = true; this.layer.classList.add('is-editing'); this.editBar.hidden = false;
  }
  stopEditing() {
    this.editing = false; this.layer.classList.remove('is-editing'); this.editBar.hidden = true;
    this.save();
  }
  save() {
    const dock = [...this.dock.querySelectorAll('.tile')].map((t) => t.dataset.app);
    const grid = [...this.grid.querySelectorAll('.tile')].map((t) => t.dataset.app);
    settings.set({ dock, grid });
  }

  /* In edit mode, tiles can be dragged within and between the grid and the dock. */
  dragSupport(t) {
    let ghost = null; let start = null;
    t.addEventListener('pointerdown', (e) => {
      if (!this.editing || e.target.closest('.tile__remove')) return;
      start = { x: e.clientX, y: e.clientY }; t.setPointerCapture(e.pointerId);
    });
    t.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!ghost && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      if (!ghost) { ghost = true; t.classList.add('is-dragging'); }
      t.style.transform = `translate(${e.clientX - start.x}px, ${e.clientY - start.y}px) scale(1.08)`;
      t.style.pointerEvents = 'none';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      t.style.pointerEvents = '';
      const target = under && under.closest('.tile');
      const container = under && (under.closest('.dock') || under.closest('.home__grid'));
      if (target && target !== t) {
        const r = target.getBoundingClientRect(); const before = e.clientX < r.left + r.width / 2;
        target.parentElement.insertBefore(t, before ? target : target.nextSibling);
        start = { x: e.clientX, y: e.clientY }; t.style.transform = 'scale(1.08)';
      } else if (container && container.classList.contains('dock') && !container.contains(t) && container.children.length < 5) {
        container.appendChild(t); start = { x: e.clientX, y: e.clientY };
      }
    });
    const end = () => {
      if (!start) return; start = null;
      if (ghost) { ghost = null; t.classList.remove('is-dragging'); t.style.transform = ''; this.relabel(t); this.save(); }
    };
    t.addEventListener('pointerup', end); t.addEventListener('pointercancel', end);
  }
  relabel(t) {
    const inDock = !!t.closest('.dock'); const lbl = t.querySelector('.tile__label');
    if (inDock && lbl) lbl.remove();
    if (!inDock && !lbl) { const app = getApp(t.dataset.app); t.insertBefore(h('span', { class: 'tile__label' }, app.short || app.name), t.querySelector('.tile__remove')); }
  }
}
