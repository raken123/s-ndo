// Window manager, Recent Apps and the gesture bar.
import { h, ic, nextFrame, wait } from '../core/dom.js';
import { getApp } from '../services/apps.js';
import { usage } from '../services/usage.js';
import { notifications } from '../services/notifications.js';
import { system } from './system.js';
import * as overlays from '../ui/overlays.js';
import { appIcon, emptyState } from '../ui/components.js';

export class WindowManager {
  constructor(layer) {
    this.layer = layer;
    this.windows = new Map(); // appId → { app, el, content, instance, snapshot, lastUsed }
    this.active = null;
    this.opening = null;
  }

  ctxFor(app, win) {
    return {
      app,
      system,
      close: () => this.close(app.id),
      goHome: () => system.goHome(),
      openApp: (id, opts) => system.openApp(id, opts),
      notify: (title, body, extra) => system.notify(app.id, title, body, extra),
      toast: overlays.toast, dialog: overlays.dialog, confirm: overlays.confirm, prompt: overlays.prompt, sheet: overlays.sheet, menu: overlays.menu,
      setStatusStyle: (style) => { win.el.dataset.status = style; system.emit('statusStyle'); },
    };
  }

  async open(appId, { route = null, fromRect = null } = {}) {
    const app = getApp(appId);
    if (!app) { overlays.toast('This app is not available on this device'); return; }
    if (this.opening) return;
    const existing = this.windows.get(appId);
    if (this.active === appId) { if (route && existing.instance.route) existing.instance.route(route); return; }
    this.opening = appId;
    try {
      const prev = this.active ? this.windows.get(this.active) : null;
      let win = existing;
      if (!win) {
        const content = h('div', { class: 'window__content' });
        const el = h('div', { class: 'window', role: 'region', 'aria-label': app.name, dataset: { app: appId } }, content);
        el.hidden = true;
        this.layer.appendChild(el);
        win = { app, el, content, instance: null, lastUsed: Date.now() };
        this.windows.set(appId, win);
        const mod = await app.load();
        win.instance = (await mod.default.mount(content, this.ctxFor(app, win))) || {};
      }
      if (prev) this.suspend(prev, { hide: false });
      win.lastUsed = Date.now();
      this.active = appId;
      notifications.markRead(appId);
      usage.foreground(appId);
      if (route && win.instance.route) win.instance.route(route);
      win.el.hidden = false;
      this.animateOpen(win, fromRect || (system.home && system.home.iconRect(appId)));
      if (prev) setTimeout(() => { if (this.active !== prev.app.id) prev.el.hidden = true; }, 420);
      win.instance.resume && win.instance.resume();
      system.emit('foreground', appId);
    } finally { this.opening = null; }
  }

  animateOpen(win, rect) {
    const el = win.el; const L = this.layer.getBoundingClientRect();
    if (rect && rect.width) {
      const sx = rect.width / L.width; const sy = rect.height / L.height;
      el.style.transformOrigin = `${rect.left - L.left + rect.width / 2}px ${rect.top - L.top + rect.height / 2}px`;
      el.style.setProperty('--open-scale', Math.max(sx, sy).toFixed(3));
    } else { el.style.transformOrigin = '50% 60%'; el.style.setProperty('--open-scale', '0.86'); }
    el.classList.remove('is-closing');
    el.classList.add('is-opening');
    nextFrame().then(() => el.classList.remove('is-opening'));
  }

  snapshot(win) {
    try {
      const clone = win.content.cloneNode(true);
      clone.querySelectorAll('video, iframe, canvas, [id]').forEach((n) => { if (n.tagName === 'VIDEO' || n.tagName === 'IFRAME' || n.tagName === 'CANVAS') n.replaceWith(h('div', { class: 'snapshot-blank' })); else n.removeAttribute('id'); });
      win.snapshot = clone;
    } catch { win.snapshot = null; }
  }

  suspend(win, { hide = true } = {}) {
    this.snapshot(win);
    win.instance.pause && win.instance.pause();
    if (hide) win.el.hidden = true;
  }

  async goHome() {
    if (!this.active) { system.emit('home'); return; }
    const win = this.windows.get(this.active);
    this.active = null;
    usage.foreground(null);
    this.suspend(win, { hide: false });
    const rect = system.home && system.home.iconRect(win.app.id);
    const L = this.layer.getBoundingClientRect();
    if (rect && rect.width) {
      win.el.style.transformOrigin = `${rect.left - L.left + rect.width / 2}px ${rect.top - L.top + rect.height / 2}px`;
      win.el.style.setProperty('--open-scale', (rect.width / L.width).toFixed(3));
    }
    win.el.style.transform = '';
    win.el.classList.add('is-closing');
    system.emit('home');
    await wait(360);
    if (this.active !== win.app.id) { win.el.hidden = true; win.el.classList.remove('is-closing'); }
  }

  back() {
    const win = this.windows.get(this.active);
    if (!win) return;
    const handled = win.instance.back ? win.instance.back() : false;
    Promise.resolve(handled).then((ok) => { if (!ok) system.goHome(); });
  }

  close(appId) {
    const win = this.windows.get(appId);
    if (!win) return;
    try { win.instance.unmount && win.instance.unmount(); } catch (e) { console.error(e); }
    win.el.remove();
    this.windows.delete(appId);
    if (this.active === appId) { this.active = null; system.emit('home'); }
  }

  closeAll() { for (const id of [...this.windows.keys()]) this.close(id); }

  recentList() { return [...this.windows.values()].sort((a, b) => b.lastUsed - a.lastUsed); }

  /* Live drag feedback from the gesture bar. */
  dragProgress(p) {
    const win = this.active && this.windows.get(this.active);
    if (!win) return;
    const s = 1 - Math.min(0.45, p * 0.45);
    win.el.style.transition = 'none';
    win.el.style.transform = `translateY(${-p * 40}px) scale(${s})`;
    win.el.style.borderRadius = `${Math.min(28, p * 90)}px`;
  }
  dragEnd() {
    const win = this.active && this.windows.get(this.active);
    if (!win) return;
    win.el.style.transition = ''; win.el.style.transform = ''; win.el.style.borderRadius = '';
  }
}

export class Recents {
  constructor(layer, wm) {
    this.layer = layer; this.wm = wm; this.isOpen = false;
    layer.addEventListener('click', (e) => { if (e.target === layer || e.target.classList.contains('recents__track')) this.close(); });
  }
  open() {
    if (this.isOpen) return;
    const cur = this.wm.active && this.wm.windows.get(this.wm.active);
    if (cur) this.wm.snapshot(cur);
    this.isOpen = true;
    this.render();
    this.layer.hidden = false;
    nextFrame().then(() => this.layer.classList.add('is-open'));
    if (cur) { cur.el.style.transition = ''; cur.el.style.transform = ''; cur.el.hidden = true; }
    this.wasActive = this.wm.active;
    this.wm.active = null;
    usage.foreground(null);
    system.emit('recents');
  }
  render() {
    const list = this.wm.recentList();
    const track = h('div', { class: 'recents__track' });
    if (!list.length) track.appendChild(h('div', { class: 'recents__empty' }, emptyState('recents', 'No recent apps', 'Apps you open appear here.')));
    for (const win of list) {
      const card = h('div', { class: 'recent-card', role: 'button', tabindex: '0', 'aria-label': `Open ${win.app.name}`, dataset: { app: win.app.id } },
        h('div', { class: 'recent-card__head' }, appIcon(win.app, 'sm'), h('span', null, win.app.name),
          h('button', { class: 'r-icon-btn recent-card__close', 'aria-label': `Close ${win.app.name}`, onclick: (e) => { e.stopPropagation(); dismiss(); } }, ic('close'))),
        h('div', { class: 'recent-card__preview' }, win.snapshot ? h('div', { class: 'recent-card__snap' }, win.snapshot) : null));
      const dismiss = async () => { card.classList.add('is-dismissed'); await wait(260); this.wm.close(win.app.id); this.render(); };
      card.addEventListener('click', () => { this.close(true); system.openApp(win.app.id); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.click(); });
      // Swipe up to close
      let sy = null; let dy = 0;
      card.addEventListener('pointerdown', (e) => { sy = e.clientY; dy = 0; });
      card.addEventListener('pointermove', (e) => { if (sy == null) return; dy = Math.min(0, e.clientY - sy); if (dy < -6) { card.style.transform = `translateY(${dy}px)`; card.style.opacity = String(1 + dy / 400); } });
      const end = () => { if (sy == null) return; sy = null; if (dy < -120) dismiss(); else { card.style.transform = ''; card.style.opacity = ''; } };
      card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
      track.appendChild(card);
    }
    const clear = list.length ? h('button', { class: 'r-btn r-btn--sm recents__clear', onclick: () => { this.wm.closeAll(); this.close(); } }, 'Close all') : null;
    this.layer.replaceChildren(track, clear || '');
    requestAnimationFrame(() => { track.scrollLeft = 0; });
  }
  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.layer.classList.remove('is-open');
    setTimeout(() => { if (!this.isOpen) this.layer.hidden = true; }, 300);
    if (!silent) system.emit('home');
  }
}

/*
 * Gesture bar. Swipe up: Home. Swipe up and hold: Recent Apps.
 * Swipe sideways along the bar: previous app.
 */
export function installGestureBar(bar, wm) {
  let start = null; let holdTimer = null; let held = false;
  const reset = () => { start = null; clearTimeout(holdTimer); held = false; bar.classList.remove('is-active'); };
  bar.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, t: Date.now() }; held = false;
    bar.setPointerCapture(e.pointerId); bar.classList.add('is-active');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dy = start.y - e.clientY;
    if (dy > 8) wm.dragProgress(Math.min(1, dy / 400));
    clearTimeout(holdTimer);
    if (dy > 90) holdTimer = setTimeout(() => { held = true; if (settingsHaptics()) navigator.vibrate && navigator.vibrate(8); }, 260);
  });
  bar.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dy = start.y - e.clientY; const dx = e.clientX - start.x; const dt = Date.now() - start.t;
    wm.dragEnd();
    if (held && dy > 90) system.showRecents();
    else if (dy > 36 || (dy > 14 && dt < 180)) system.goHome();
    else if (Math.abs(dx) > 60 && Math.abs(dy) < 30) {
      const list = wm.recentList().filter((w) => w.app.id !== wm.active);
      if (list[0]) system.openApp(list[0].app.id);
    }
    reset();
  });
  bar.addEventListener('pointercancel', () => { wm.dragEnd(); reset(); });
}
const settingsHaptics = () => true;
