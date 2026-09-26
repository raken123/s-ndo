// Notification Center, Control Center and heads-up notification banners.
import { h, ic, nextFrame, wait } from '../core/dom.js';
import { settings } from '../core/store.js';
import { has } from '../core/capabilities.js';
import { platform } from '../core/platform.js';
import { notifications } from '../services/notifications.js';
import { system } from './system.js';
import { appIcon, slider } from '../ui/components.js';
import { timeAgo } from './lockscreen.js';
import { effectiveTheme } from './theme.js';

export class Panels {
  constructor(layer, bannerLayer) {
    this.layer = layer; this.bannerLayer = bannerLayer; this.openKind = null;
    this.scrim = h('div', { class: 'panel-scrim', onclick: () => this.closeAll() });
    this.nc = h('section', { class: 'panel panel--nc', 'aria-label': 'Notification Center', hidden: true });
    this.cc = h('section', { class: 'panel panel--cc', 'aria-label': 'Control Center', hidden: true });
    layer.append(this.scrim, this.nc, this.cc);
    for (const p of [this.nc, this.cc]) this.installSwipeClose(p);
    notifications.on('change', () => { if (this.openKind === 'nc') this.renderNC(); });
    notifications.on('post', (n, { silent }) => this.banner(n, silent));
    settings.on('change', () => { if (this.openKind === 'cc') this.renderCC(); });
    system.on('torch', () => { if (this.openKind === 'cc') this.renderCC(); });
    system.on('lock', () => this.bannerLayer.replaceChildren());
  }

  open(kind) {
    if (this.openKind === kind) return;
    if (this.openKind) this.closeAll(true);
    this.openKind = kind;
    const p = kind === 'nc' ? this.nc : this.cc;
    kind === 'nc' ? this.renderNC() : this.renderCC();
    p.hidden = false; this.layer.classList.add('is-open');
    nextFrame().then(() => { p.classList.add('is-open'); this.scrim.classList.add('is-open'); });
    system.emit('panel', kind);
  }

  closeAll(immediate = false) {
    if (!this.openKind) return false;
    const p = this.openKind === 'nc' ? this.nc : this.cc;
    this.openKind = null;
    p.classList.remove('is-open'); this.scrim.classList.remove('is-open');
    const done = () => { if (!this.openKind) this.layer.classList.remove('is-open'); p.hidden = true; };
    if (immediate) done(); else setTimeout(done, 320);
    return true;
  }

  installSwipeClose(p) {
    let sy = null;
    p.addEventListener('pointerdown', (e) => { if (e.target.closest('input, button, .notif')) return; sy = e.clientY; });
    p.addEventListener('pointerup', (e) => { if (sy != null && sy - e.clientY > 60) this.closeAll(); sy = null; });
  }

  // ------------------------------------------------------ Notification Center
  renderNC() {
    const groups = notifications.groups();
    const now = new Date();
    const head = h('div', { class: 'panel__head' },
      h('div', null, h('div', { class: 'nc__date' }, now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })), h('h2', { class: 'panel__title' }, 'Notifications')),
      groups.length ? h('button', { class: 'r-btn r-btn--sm', onclick: () => notifications.clear() }, 'Clear all') : null);
    const body = h('div', { class: 'nc__list' });
    if (!groups.length) body.appendChild(h('div', { class: 'nc__empty' }, ic('bell'), h('div', null, 'No notifications'), h('div', { class: 'r-footnote' }, settings.get('dnd') ? 'Do Not Disturb is on.' : 'You’re all caught up.')));
    for (const g of groups) {
      const expanded = this.expanded === g.appId || g.items.length <= 2;
      const shown = expanded ? g.items : g.items.slice(0, 1);
      body.appendChild(h('div', { class: 'nc__group' },
        h('div', { class: 'nc__group-head' }, appIcon({ glyph: g.icon, color: g.color }, 'sm'), h('span', { class: 'nc__app' }, g.appName), h('span', { class: 'nc__count' }, g.items.length > 1 ? String(g.items.length) : ''),
          h('button', { class: 'r-icon-btn nc__dismiss', 'aria-label': `Clear ${g.appName} notifications`, onclick: () => notifications.dismissApp(g.appId) }, ic('close'))),
        shown.map((n) => this.card(n)),
        !expanded ? h('button', { class: 'nc__more', onclick: () => { this.expanded = g.appId; this.renderNC(); } }, `Show ${g.items.length - 1} more`) : null));
    }
    this.nc.replaceChildren(head, body, h('div', { class: 'panel__handle' }));
  }

  card(n, { banner = false } = {}) {
    const el = h('div', { class: `notif ${n.priority === 'time-sensitive' ? 'notif--urgent' : ''}`, role: 'button', tabindex: '0' },
      banner ? h('div', { class: 'notif__app' }, appIcon({ glyph: n.icon, color: n.color }, 'sm'), h('span', null, n.appName), h('span', { class: 'notif__time' }, 'now')) : null,
      h('div', { class: 'notif__row' }, h('div', { class: 'notif__title' }, n.title), banner ? null : h('span', { class: 'notif__time' }, timeAgo(n.time))),
      n.body ? h('div', { class: 'notif__body' }, n.body) : null,
      n.actions && n.actions.length ? h('div', { class: 'notif__actions' }, n.actions.map((a) => h('button', { class: 'r-btn r-btn--sm', onclick: (e) => { e.stopPropagation(); notifications.action(n.id, a.id); notifications.dismiss(n.id); } }, a.label))) : null);
    const open = () => { notifications.dismiss(n.id); this.closeAll(); if (n.open) system.openApp(n.open.appId, { route: n.open.route }); };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); if (e.key === 'Delete') notifications.dismiss(n.id); });
    // Swipe to dismiss
    let sx = null; let dx = 0;
    el.addEventListener('pointerdown', (e) => { sx = e.clientX; dx = 0; });
    el.addEventListener('pointermove', (e) => { if (sx == null) return; dx = e.clientX - sx; if (Math.abs(dx) > 8) { el.style.transition = 'none'; el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(1 - Math.abs(dx) / 320); } });
    const end = () => {
      if (sx == null) return; sx = null; el.style.transition = '';
      if (Math.abs(dx) > 110) { el.style.transform = `translateX(${dx > 0 ? 400 : -400}px)`; el.style.opacity = '0'; setTimeout(() => notifications.dismiss(n.id), 200); }
      else { el.style.transform = ''; el.style.opacity = ''; }
      if (Math.abs(dx) > 8) { el.addEventListener('click', (ev) => ev.stopImmediatePropagation(), { once: true, capture: true }); }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    return el;
  }

  async banner(n, silent) {
    // No banner when the notification's app (or the app it opens) is already on screen.
    if (silent || system.locked || system.foreground === n.appId || (n.open && system.foreground === n.open.appId)) return;
    if (settings.get('haptics')) platform.vibrate(20);
    const card = this.card(n, { banner: true });
    card.classList.add('banner');
    this.bannerLayer.replaceChildren(card);
    await nextFrame(); card.classList.add('is-open');
    let sy = null;
    card.addEventListener('pointerdown', (e) => { sy = e.clientY; });
    card.addEventListener('pointerup', (e) => { if (sy != null && sy - e.clientY > 30) hide(); sy = null; });
    const hide = async () => { card.classList.remove('is-open'); await wait(300); card.remove(); };
    setTimeout(hide, 4200);
  }

  // ---------------------------------------------------------- Control Center
  renderCC() {
    const s = settings.data;
    const toggle = (key, label, iconName, { value, onClick, disabled } = {}) => {
      const on = value !== undefined ? value : !!s[key];
      return h('button', {
        class: `cc-tile ${on ? 'is-on' : ''}`, type: 'button', 'aria-pressed': String(on), 'aria-label': label, disabled: disabled || null,
        onclick: onClick || (() => settings.toggle(key)),
      }, h('span', { class: 'cc-tile__icon' }, ic(iconName)), h('span', { class: 'cc-tile__label' }, label), h('span', { class: 'cc-tile__state' }, on ? 'On' : 'Off'));
    };
    const wide = (key, label, iconName, sub, longPressRoute) => {
      const b = h('button', { class: `cc-wide ${s[key] && !s.airplane ? 'is-on' : ''}`, type: 'button', 'aria-pressed': String(!!s[key]), 'aria-label': label, onclick: () => settings.toggle(key) },
        h('span', { class: 'cc-wide__icon' }, ic(iconName)), h('span', { class: 'cc-wide__text' }, h('span', { class: 'cc-wide__label' }, label), h('span', { class: 'cc-wide__sub' }, sub)));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.closeAll(); system.openApp('settings', { route: longPressRoute }); });
      return b;
    };
    const tiles = [
      toggle('airplane', 'Airplane', 'airplane'),
      toggle('dnd', 'Do Not Disturb', 'moon'),
      has('torch') ? toggle(null, 'Flashlight', 'flashlight', { value: !!system.torchOn, onClick: () => system.setTorch(!system.torchOn) }) : null,
      toggle(null, 'Dark Mode', 'contrast', { value: effectiveTheme() === 'dark', onClick: () => settings.set({ theme: effectiveTheme() === 'dark' ? 'light' : 'dark' }) }),
      toggle('rotationLock', 'Rotation Lock', 'rotation-lock'),
      toggle('batterySaver', 'Battery Saver', 'leaf'),
      has('nfc') ? toggle('nfc', 'NFC', 'nfc') : null,
      has('scanner2d') ? toggle('scannerEnabled', 'Scanner', 'scanner') : null,
    ].filter(Boolean);
    const bright = slider({ value: s.brightness, min: 0.05, max: 1, step: 0.01, iconStart: 'sun-dim', iconEnd: 'sun', label: 'Brightness', onInput: (v) => settings.set({ brightness: v, autoBrightness: false }) });
    const vol = slider({ value: s.volumeMedia, min: 0, max: 1, step: 0.01, iconStart: 'volume-low', iconEnd: 'volume', label: 'Volume', onInput: (v) => settings.set({ volumeMedia: v }) });
    const head = h('div', { class: 'panel__head' }, h('h2', { class: 'panel__title' }, 'Control Center'),
      h('div', { class: 'r-hstack' },
        h('button', { class: 'r-icon-btn cc__lock', 'aria-label': 'Lock device', onclick: () => { this.closeAll(true); system.lock(); } }, ic('lock')),
        h('button', { class: 'r-icon-btn', 'aria-label': 'Open Settings', onclick: () => { this.closeAll(); system.openApp('settings'); } }, ic('settings'))));
    this.cc.replaceChildren(head,
      h('div', { class: 'cc__wides' },
        wide('wifi', 'Wi-Fi', s.wifi && !s.airplane ? 'wifi' : 'wifi-off', s.airplane ? 'Airplane mode' : s.wifi ? 'Connected' : 'Off', 'wifi'),
        wide('bluetooth', 'Bluetooth', 'bluetooth', s.airplane ? 'Airplane mode' : s.bluetooth ? 'On' : 'Off', 'bluetooth')),
      h('div', { class: 'cc__tiles' }, tiles),
      h('div', { class: 'cc__sliders' }, h('div', { class: 'cc-slider' }, bright), h('div', { class: 'cc-slider' }, vol)),
      h('div', { class: 'panel__handle' }));
  }
}
