// Lock Screen, PIN entry, screen-off state and auto-lock.
import { h, ic, wait } from '../core/dom.js';
import { settings } from '../core/store.js';
import { has } from '../core/capabilities.js';
import { security } from '../services/security.js';
import { notifications } from '../services/notifications.js';
import { updates } from '../services/updates.js';
import { usage } from '../services/usage.js';
import { system } from './system.js';
import { pinPad } from './pinpad.js';
import { clockFmt } from './statusbar.js';
import { sheet } from '../ui/overlays.js';
import { appIcon } from '../ui/components.js';

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export class LockScreen {
  constructor(layer, offLayer, battery) {
    this.layer = layer; this.off = offLayer; this.battery = battery;
    this.pending = null; this.mode = 'clock';
    this.build();
    notifications.on('change', () => this.renderNotifications());
    settings.on('change', () => this.renderShortcuts());
    system.on('torch', () => this.renderShortcuts());
    battery.on('change', () => this.renderStatus());
    setInterval(() => this.tickClock(), 5000);
    this.off.addEventListener('pointerdown', () => this.wake());
    document.addEventListener('keydown', (e) => { if (this.asleep && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.wake(); } });
    this.installAutoLock();
  }

  build() {
    this.clock = h('div', { class: 'lock__time r-tabular' });
    this.date = h('div', { class: 'lock__date' });
    this.status = h('div', { class: 'lock__status' });
    this.notifs = h('div', { class: 'lock__notifs', 'aria-label': 'Notifications' });
    this.shortcuts = h('div', { class: 'lock__shortcuts' });
    this.hint = h('button', { class: 'lock__hint', type: 'button', onclick: () => this.beginUnlock() }, 'Swipe up to unlock');
    this.main = h('div', { class: 'lock__main' }, h('div', { class: 'lock__clock' }, this.date, this.clock, this.status), this.notifs, h('div', { class: 'lock__bottom' }, this.shortcuts, this.hint));
    this.pinWrap = h('div', { class: 'lock__pin', hidden: true });
    this.layer.append(this.main, this.pinWrap);
    // Swipe up anywhere on the Lock Screen
    let sy = null;
    this.main.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .lock-notif')) return; sy = e.clientY; });
    this.main.addEventListener('pointermove', (e) => {
      if (sy == null) return; const dy = Math.max(0, sy - e.clientY);
      this.main.style.transition = 'none'; this.main.style.transform = `translateY(${-dy * 0.4}px)`; this.main.style.opacity = String(1 - dy / 500);
    });
    const end = (e) => {
      if (sy == null) return; const dy = sy - e.clientY; sy = null;
      this.main.style.transition = ''; this.main.style.transform = ''; this.main.style.opacity = '';
      if (dy > 80) this.beginUnlock();
    };
    this.main.addEventListener('pointerup', end); this.main.addEventListener('pointercancel', end);
    document.addEventListener('keydown', (e) => {
      if (!system.locked || this.asleep || this.mode !== 'clock' || this.layer.hidden) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); this.beginUnlock(); }
    });
    this.layer.tabIndex = -1;
    this.tickClock(); this.renderStatus(); this.renderShortcuts(); this.renderNotifications();
  }

  tickClock() { const d = new Date(); this.clock.textContent = clockFmt.format(d); this.date.textContent = dateFmt.format(d); }

  renderStatus() {
    const b = this.battery.state;
    this.status.textContent = b.charging ? `Charging · ${b.level}%` : '';
    this.status.hidden = !b.charging;
  }

  renderShortcuts() {
    const btns = [];
    if (has('torch')) btns.push(h('button', { class: `lock__sc ${system.torchOn ? 'is-on' : ''}`, 'aria-label': 'Flashlight', 'aria-pressed': String(!!system.torchOn), onclick: () => system.setTorch(!system.torchOn) }, ic('flashlight')));
    else btns.push(h('span'));
    if (has('camera')) btns.push(h('button', { class: 'lock__sc', 'aria-label': 'Camera', onclick: () => this.requestUnlock(() => system.openApp('camera')) }, ic('camera')));
    this.shortcuts.replaceChildren(...btns);
  }

  renderNotifications() {
    const mode = settings.get('lockNotifications');
    const items = notifications.items.slice(0, 4);
    if (mode === 'never' || !items.length) { this.notifs.replaceChildren(); return; }
    const hide = mode === 'unlocked' && security.hasPin();
    this.notifs.replaceChildren(...items.map((n) => h('button', { class: 'lock-notif', type: 'button', onclick: () => this.requestUnlock(() => n.open && system.openApp(n.open.appId, { route: n.open.route })) },
      appIcon({ glyph: n.icon, color: n.color }, 'sm'),
      h('span', { class: 'lock-notif__body' },
        h('span', { class: 'lock-notif__top' }, h('span', { class: 'lock-notif__app' }, n.appName), h('span', { class: 'lock-notif__time' }, timeAgo(n.time))),
        h('span', { class: 'lock-notif__title' }, hide ? `${n.appName}` : n.title),
        h('span', { class: 'lock-notif__text' }, hide ? 'Notification' : n.body)))));
  }

  get isLocked() { return system.locked; }

  lock({ sleep = true } = {}) {
    system.locked = true;
    this.mode = 'clock';
    this.pinWrap.hidden = true; this.main.hidden = false;
    this.layer.hidden = false;
    this.layer.classList.remove('is-unlocking');
    this.layer.classList.add('is-visible');
    this.renderNotifications();
    system.emit('lock');
    if (updates.engine) updates.engine.setLocked(true);
    if (sleep) this.sleep();
  }

  sleep() {
    this.asleep = true; this.off.hidden = false;
    requestAnimationFrame(() => this.off.classList.add('is-on'));
    usage.screen(false);
    system.emit('sleep');
  }

  wake() {
    if (!this.asleep) return;
    this.asleep = false;
    this.off.classList.remove('is-on');
    setTimeout(() => { if (!this.asleep) this.off.hidden = true; }, 300);
    usage.screen(true);
    this.tickClock();
    system.emit('wake');
    this.layer.focus({ preventScroll: true });
  }

  requestUnlock(then) {
    if (!system.locked) { then && then(); return; }
    this.pending = then || null;
    this.beginUnlock();
  }

  beginUnlock() {
    if (this.asleep) { this.wake(); return; }
    if (!security.hasPin()) { this.unlock(); return; }
    this.showPin();
  }

  showPin() {
    this.mode = 'pin';
    const lo = security.lockout();
    const pad = pinPad({
      title: 'Enter PIN', subtitle: '',
      extraKey: h('button', { type: 'button', class: 'pin__key pin__key--text', onclick: () => this.emergency() }, 'Emergency'),
      onComplete: async (v) => {
        const r = await security.verify(v);
        if (r.ok) { this.unlock(); return; }
        if (r.retryAt > Date.now()) this.countdown(pad, r.retryAt);
        else pad.reset(`Incorrect PIN${r.failures >= 3 ? ` · ${5 - r.failures} attempts before a delay` : ''}`, { shake: true });
      },
    });
    const cancel = h('button', { class: 'r-btn r-btn--plain lock__cancel', onclick: () => this.cancelPin() }, 'Cancel');
    this.pinWrap.replaceChildren(pad.el, cancel);
    this.pinWrap.hidden = false; this.main.hidden = true;
    requestAnimationFrame(() => pad.focus());
    if (lo.until > Date.now()) this.countdown(pad, lo.until);
  }

  countdown(pad, until) {
    pad.setDisabled(true);
    const t = () => {
      const s = Math.ceil((until - Date.now()) / 1000);
      if (s <= 0) { pad.setDisabled(false); pad.reset('Enter your PIN'); return; }
      pad.reset(`Too many attempts. Try again in ${s} s`); setTimeout(t, 500);
    };
    t();
  }

  cancelPin() { this.mode = 'clock'; this.pinWrap.hidden = true; this.main.hidden = false; this.pending = null; }

  emergency() {
    sheet({ title: 'Emergency', build: () => h('div', { class: 'r-stack' },
      h('p', { class: 'r-subhead r-secondary' }, 'Emergency information is available without unlocking the device.'),
      h('div', { class: 'r-list' }, h('div', { class: 'r-row' }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, 'Medical information'), h('span', { class: 'r-row__subtitle' }, 'Not added. Add it in Settings › Security.'))))) });
  }

  back() { if (this.mode === 'pin') { this.cancelPin(); return true; } return false; }

  async unlock() {
    system.locked = false;
    this.layer.classList.add('is-unlocking');
    if (updates.engine) updates.engine.setLocked(false);
    system.emit('unlock');
    await wait(380);
    this.layer.classList.remove('is-visible', 'is-unlocking');
    this.layer.hidden = true;
    this.pinWrap.replaceChildren();
    const p = this.pending; this.pending = null;
    if (p) p();
    this.resetAutoLock();
  }

  installAutoLock() {
    const bump = () => this.resetAutoLock();
    for (const ev of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, bump, { passive: true });
    settings.on('autoLock', bump);
    document.addEventListener('pause', () => this.lock(), false); // Cordova: app sent to background / screen off
  }

  resetAutoLock() {
    clearTimeout(this.autoTimer);
    const s = settings.get('autoLock');
    if (!s || system.locked) return;
    this.autoTimer = setTimeout(() => { if (!system.locked) this.lock(); }, s * 1000);
  }
}

function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
export { timeAgo };
