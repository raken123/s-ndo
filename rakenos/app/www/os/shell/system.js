/*
 * The RakenOS system object. Shell modules register themselves here so apps
 * and services can reach the window manager, lock screen and panels without
 * import cycles.
 */
import { Emitter } from '../core/dom.js';
import { notifications } from '../services/notifications.js';
import { getApp } from '../services/apps.js';
import { closeTopOverlay } from '../ui/overlays.js';
import { platform } from '../core/platform.js';

class System extends Emitter {
  constructor() {
    super();
    this.locked = true;
    this.wm = null; this.lockscreen = null; this.panels = null; this.search = null; this.home = null; this.recents = null;
  }

  /* Flashlight state is shared by Control Center, the Lock Screen and Camera. */
  async setTorch(on) {
    this.torchOn = !!on;
    const ok = await platform.setTorch(this.torchOn);
    if (!ok && this.torchTrack) { try { await this.torchTrack.applyConstraints({ advanced: [{ torch: this.torchOn }] }); } catch {} }
    this.emit('torch', this.torchOn);
  }

  get foreground() { return this.wm ? this.wm.active : null; }

  openApp(id, opts = {}) {
    if (this.locked && this.lockscreen) { this.lockscreen.requestUnlock(() => this.wm.open(id, opts)); return; }
    this.panels && this.panels.closeAll();
    this.search && this.search.close();
    this.recents && this.recents.close(true);
    return this.wm.open(id, opts);
  }
  goHome() {
    this.panels && this.panels.closeAll();
    this.search && this.search.close();
    if (this.recents && this.recents.isOpen) { this.recents.close(); return; }
    return this.wm.goHome();
  }
  showRecents() { if (!this.locked) this.recents.open(); }
  lock() { this.lockscreen && this.lockscreen.lock(); }

  /* System back: overlays → panels → search → recents → app navigation → Home. */
  back() {
    if (closeTopOverlay()) return true;
    if (this.panels && this.panels.closeAll()) return true;
    if (this.search && this.search.isOpen) { this.search.close(); return true; }
    if (this.recents && this.recents.isOpen) { this.recents.close(); return true; }
    if (this.locked) return this.lockscreen && this.lockscreen.back();
    if (this.home && this.home.editing) { this.home.stopEditing(); return true; }
    if (this.wm && this.wm.active) { this.wm.back(); return true; }
    return false;
  }

  /* Posts a notification on behalf of an app. */
  notify(appId, title, body, extra = {}) {
    const app = getApp(appId) || { name: extra.appName || appId, glyph: 'bell', color: '#5f6673' };
    return notifications.post({ appId, appName: app.name, icon: app.glyph, color: app.color, title, body, open: { appId }, ...extra });
  }
}

export const system = new System();
