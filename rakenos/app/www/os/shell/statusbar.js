// Status bar: time, connectivity, privacy indicator and battery.
import { h, ic } from '../core/dom.js';
import { batteryIcon } from '../../lib/design-system/icons.js';
import { settings } from '../core/store.js';
import { system } from './system.js';

export const clockFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export class StatusBar {
  constructor(el, battery) {
    this.el = el; this.battery = battery; this.privacy = null;
    this.time = h('span', { class: 'sb__time r-tabular' });
    this.icons = h('span', { class: 'sb__icons' });
    el.append(h('span', { class: 'sb__left' }, this.time), h('span', { class: 'sb__center' }), this.icons);
    this.tick();
    setInterval(() => this.tick(), 5000);
    settings.on('change', () => this.render());
    system.on('foreground', () => this.render());
    system.on('home', () => this.render());
    system.on('statusStyle', () => this.render());
    this.installPulldown();
  }
  tick() { this.time.textContent = clockFmt.format(new Date()); }
  setPrivacy(kind) { this.privacy = kind; this.render(); }
  render() {
    const s = settings.data; const b = this.battery.state;
    const parts = [];
    if (this.privacy) parts.push(h('span', { class: `sb__privacy sb__privacy--${this.privacy}`, 'aria-label': `${this.privacy} in use` }));
    if (s.dnd) parts.push(h('span', { class: 'sb__icon', 'aria-label': 'Do Not Disturb' }, ic('moon')));
    if (s.airplane) parts.push(h('span', { class: 'sb__icon', 'aria-label': 'Airplane mode' }, ic('airplane')));
    else {
      if (s.bluetooth) parts.push(h('span', { class: 'sb__icon', 'aria-label': 'Bluetooth on' }, ic('bluetooth')));
      if (s.wifi) parts.push(h('span', { class: 'sb__icon', 'aria-label': 'Wi-Fi connected' }, ic('wifi')));
    }
    parts.push(h('span', { class: `sb__battery ${s.batterySaver ? 'is-saver' : ''}`, 'aria-label': `Battery ${b.level} percent${b.charging ? ', charging' : ''}` },
      h('span', { class: 'sb__pct r-tabular' }, `${b.level}`), { html: batteryIcon(b.level, b.charging, { className: 'sb__batt' }) }));
    this.icons.replaceChildren(...parts);
    const win = system.wm && system.wm.active && system.wm.windows.get(system.wm.active);
    this.el.dataset.style = win && win.el.dataset.status ? win.el.dataset.status : 'auto';
  }
  /* Pull down on the left half for notifications, on the right half for Control Center. */
  installPulldown() {
    let start = null;
    const zone = this.el;
    zone.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; zone.setPointerCapture(e.pointerId); });
    zone.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dy = e.clientY - start.y; const rect = zone.getBoundingClientRect();
      const right = start.x - rect.left > rect.width * 0.55;
      if (dy > 24 || Math.abs(dy) < 4) {
        if (right) system.panels.open('cc'); else system.panels.open('nc');
      }
      start = null;
    });
  }
}
