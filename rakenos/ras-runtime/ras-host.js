/*
 * RAS host — runs an installed RAS app inside RakenOS.
 *
 * The host creates the RScript VM with permission-gated system APIs, renders
 * the RDesign interface and connects events (actions, bindings, timers,
 * lifecycle) between them.
 */
import { RScriptVM, RSCRIPT_VERSION } from './rscript.js';
import { RDesignRenderer } from './rdesign.js';

export class RasAppHost {
  /*
   * app: installed record { manifest, script, design, assetUrls }
   * services: {
   *   icon(name), toast(msg), alert(title, msg), notify(appId, title, body), vibrate(),
   *   isGranted(appId, permission), storage(appId) → { get, set, remove },
   *   capabilities, rakenosVersion, rasApiLevel, copy(text)
   * }
   */
  constructor(container, app, services) {
    this.container = container; this.app = app; this.s = services;
    this.timers = new Map();
    this.renderQueued = false;
    this.crashed = false;
  }

  natives() {
    const { s } = this; const id = this.app.manifest.id;
    const need = (perm) => {
      if (s.isGranted(id, perm)) return true;
      s.toast(`${this.app.manifest.name} is not allowed to ${perm === 'notifications' ? 'send notifications' : `use ${perm}`}`);
      return false;
    };
    const store = s.storage(id);
    return {
      ui: {
        toast: (msg) => s.toast(String(msg)),
        alert: (title, msg) => s.alert(String(title), msg == null ? '' : String(msg)),
      },
      notify: (title, body) => { if (need('notifications')) s.notify(id, String(title), body == null ? '' : String(body)); return null; },
      storage: {
        get: (k, d = null) => { if (!s.isGranted(id, 'storage')) return d; const v = store.get(String(k)); return v === undefined || v === null ? d : v; },
        set: (k, v) => { if (need('storage')) store.set(String(k), v); return null; },
        remove: (k) => { if (need('storage')) store.remove(String(k)); return null; },
      },
      haptics: { tap: () => { if (s.isGranted(id, 'vibrate')) s.vibrate(12); return null; } },
      clipboard: { copy: (t) => { if (need('clipboard')) s.copy(String(t)); return null; } },
      timer: {
        every: (ms, name) => { this.startTimer(String(name), Math.max(250, +ms || 1000), true); return null; },
        after: (ms, name) => { this.startTimer(String(name), Math.max(50, +ms || 1000), false); return null; },
        cancel: (name) => { this.stopTimer(String(name)); return null; },
      },
      device: {
        // Capability queries only. There is intentionally no API that returns a device model.
        has: (cap) => !!s.capabilities[String(cap)],
      },
      system: {
        version: () => s.rakenosVersion,
        api_level: () => s.rasApiLevel,
        rscript_version: () => RSCRIPT_VERSION,
      },
      clock: { now: () => Date.now() },
    };
  }

  mount() {
    this.root = document.createElement('div');
    this.root.className = 'ras-app r-root';
    this.container.appendChild(this.root);
    try {
      this.vm = new RScriptVM(this.app.script, { natives: this.natives(), onStateChange: () => this.queueRender() });
      this.renderer = new RDesignRenderer(this.root, this.app.design, {
        vm: this.vm,
        icon: this.s.icon,
        asset: (p) => (this.app.assetUrls || {})[p] || null,
        onAction: (name, arg) => this.guard(() => { if (!this.vm.emit('action', name, arg)) console.warn(`No handler for action "${name}"`); }),
        onBind: (name, value, opts = {}) => this.guard(() => {
          if (!this.vm.stateNames.has(name)) return; // only declared state can be bound
          this.vm.globals.vars.set(name, value);
          if (this.vm.hasHandler('change', name)) this.vm.emit('change', name, value);
          if (!opts.silent) this.queueRender();
        }),
      });
      this.vm.init();
      this.renderer.render();
      this.guard(() => this.vm.emit('start'));
    } catch (e) { this.crash(e); }
    return this;
  }

  guard(fn) { if (this.crashed) return; try { fn(); } catch (e) { this.crash(e); } }

  queueRender() {
    if (this.renderQueued || this.crashed) return;
    this.renderQueued = true;
    requestAnimationFrame(() => { this.renderQueued = false; if (!this.crashed && this.renderer) this.renderer.render(); });
  }

  startTimer(name, ms, repeat) {
    this.stopTimer(name);
    const fire = () => this.guard(() => this.vm.emit('timer', name));
    this.timers.set(name, repeat ? setInterval(fire, ms) : setTimeout(() => { this.timers.delete(name); fire(); }, ms));
  }
  stopTimer(name) { const t = this.timers.get(name); if (t) { clearInterval(t); clearTimeout(t); this.timers.delete(name); } }

  lifecycle(state) { this.guard(() => this.vm && this.vm.emit('lifecycle', state)); }

  crash(e) {
    this.crashed = true;
    for (const n of [...this.timers.keys()]) this.stopTimer(n);
    console.error('RAS app error', e);
    this.root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'r-empty';
    box.innerHTML = `${this.s.icon('alert')}<div class="r-empty__title">${escapeHtml(this.app.manifest.name)} stopped</div><div class="r-empty__text">${escapeHtml(e.message || String(e))}</div>`;
    this.root.appendChild(box);
  }

  unmount() {
    for (const n of [...this.timers.keys()]) this.stopTimer(n);
    this.lifecycle('stop');
    if (this.root) this.root.remove();
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
