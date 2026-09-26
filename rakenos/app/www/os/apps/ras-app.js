// Runs an installed RAS app in a RakenOS window.
import { h, ic } from '../core/dom.js';
import { RasAppHost } from '../../lib/ras-runtime/ras-host.js';
import { RDESIGN_CSS } from '../../lib/ras-runtime/rdesign.js';
import { icon } from '../../lib/design-system/icons.js';
import { rasApps } from '../services/ras-apps.js';
import { updates } from '../services/updates.js';
import { platform } from '../core/platform.js';
import { settings } from '../core/store.js';
import { caps } from '../core/capabilities.js';
import { toast, dialog } from '../ui/overlays.js';

let cssInstalled = false;

export default {
  mount(container, ctx) {
    if (!cssInstalled) { document.head.appendChild(h('style', null, RDESIGN_CSS)); cssInstalled = true; }
    const rec = rasApps.get(ctx.app.id);
    const scroller = h('div', { class: 'ras-window' });
    container.appendChild(scroller);
    if (!rec) { scroller.appendChild(h('div', { class: 'r-empty' }, ic('alert'), h('div', { class: 'r-empty__title' }, 'App not installed'))); return {}; }
    const host = new RasAppHost(scroller, rec, {
      icon: (n) => icon(n),
      toast: (m) => toast(m),
      alert: (t, m) => dialog({ title: t, message: m }),
      notify: (appId, title, body) => ctx.notify(title, body),
      vibrate: (ms) => { if (settings.get('haptics')) platform.vibrate(ms); },
      copy: (t) => { try { navigator.clipboard.writeText(t); } catch {} },
      isGranted: (appId, p) => rasApps.isGranted(appId, p),
      storage: (appId) => rasApps.appStorage(appId),
      capabilities: caps(),
      rakenosVersion: updates.installed,
      rasApiLevel: updates.rasApiLevel(),
    }).mount();
    return {
      pause: () => host.lifecycle('pause'),
      resume: () => host.lifecycle('resume'),
      unmount: () => host.unmount(),
    };
  },
};
