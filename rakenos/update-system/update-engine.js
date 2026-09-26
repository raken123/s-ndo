/*
 * RakenOS Update Engine
 *
 *   idle → checking → available → downloading → verifying → preparing → ready → installing → updated
 *                   ↘ up-to-date
 *                   ↘ rollout-pending (the release exists, this device's rollout group is not open yet)
 *                   ↘ error
 *
 * What is installed: RakenOS system components delivered by the update
 * payload (interface, RAS runtime, RScript engine, Store service and the
 * system version). They are applied inside RakenOS itself.
 *
 * What is NOT done silently: replacing the Android application package. If a
 * release carries `shellUpdate`, the engine hands the verified package to the
 * platform installer, and Android asks the user to confirm the installation.
 */
import { isNewer } from './version.js';

export const UPDATE_STATUS = [
  'idle', 'checking', 'up-to-date', 'rollout-pending', 'available', 'downloading',
  'verifying', 'preparing', 'ready', 'installing', 'updated', 'error',
];

const DEFAULT_SETTINGS = {
  automaticUpdates: true, // check automatically in the background
  autoDownload: true, // "Download updates automatically"
  autoInstall: true, // "Install when ready" — installs the next time the device is locked
  rolloutDayMs: 60 * 1000, // prototype pacing; set to 86 400 000 for real days
};

async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class UpdateEngine {
  constructor({ provider, storage, rollout, platform = {}, factoryVersion = '1.0.0', now = () => Date.now(), timers = true }) {
    this.provider = provider;
    this.storage = storage;
    this.rollout = rollout;
    this.platform = platform;
    this.now = now;
    this.timersEnabled = timers;
    this.listeners = new Set();
    this.locked = false;
    this.busy = null;
    this.timer = null;

    this.system = storage.get('rakenos.system') || {
      version: factoryVersion, installedAt: now(), history: [{ version: factoryVersion, installedAt: now() }], components: null,
    };
    this.settings = { ...DEFAULT_SETTINGS, ...(storage.get('rakenos.update.settings') || {}) };
    const saved = storage.get('rakenos.update.state') || {};
    // Transfers cannot survive a restart; staged (ready) updates can.
    const resumable = ['ready', 'up-to-date', 'rollout-pending', 'available', 'updated'];
    this.state = {
      status: resumable.includes(saved.status) ? saved.status : (saved.target ? 'available' : 'idle'),
      target: saved.target || null,
      release: saved.release || null,
      progress: 0,
      received: 0,
      total: 0,
      error: null,
      lastChecked: saved.lastChecked || null,
      lastCheck: saved.lastCheck || null,
      staged: saved.staged || null,
      updatedFrom: saved.updatedFrom || null,
    };
    if (this.state.staged && this.state.staged.version !== this.state.target) this.state.staged = null;
    this.persist();
  }

  // ------------------------------------------------------------------ API --
  get snapshot() {
    return { ...this.state, system: { ...this.system }, settings: { ...this.settings }, rolloutGroup: this.rollout.group };
  }
  get installedVersion() { return this.system.version; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  setSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.storage.set('rakenos.update.settings', this.settings);
    this.emit('settings');
    this.schedule();
    if (patch.autoDownload && this.state.status === 'available') this.download().catch(() => {});
    if (patch.autoInstall && this.state.status === 'ready' && this.locked) this.install().catch(() => {});
  }

  start() { this.schedule(0); }
  stop() { clearTimeout(this.timer); this.timer = null; }

  /* The OS reports lock state; "Install when ready" installs while locked. */
  setLocked(locked) {
    this.locked = locked;
    if (locked && this.settings.autoInstall && this.state.status === 'ready' && !this.needsUserConsent()) {
      this.install().catch(() => {});
    }
  }

  needsUserConsent() { return !!(this.state.release && this.state.release.shellUpdate); }

  async check({ userInitiated = false } = {}) {
    if (this.busy) return this.busy;
    if (['downloading', 'verifying', 'preparing', 'installing'].includes(this.state.status)) return this.snapshot;
    this.busy = (async () => {
      const prevStatus = this.state.status;
      this.set({ status: 'checking', error: null });
      try {
        if (userInitiated) await delay(700); // let the checking state be visible
        const res = await this.provider.check({
          currentVersion: this.system.version,
          rolloutGroup: this.rollout.group,
          since: this.system.installedAt,
          dayMs: this.settings.rolloutDayMs,
          now: this.now(),
        });
        const checkedAt = this.now();
        if (!res) throw new Error('Empty response from update service');
        if (res.updateAvailable) {
          const release = await this.provider.release(res.latestEligibleVersion);
          if (!release) throw new Error('Release details unavailable');
          const sameTarget = this.state.target === release.version && prevStatus === 'ready' && this.state.staged;
          this.set({ status: sameTarget ? 'ready' : 'available', target: release.version, release, lastChecked: checkedAt, lastCheck: res, updatedFrom: null });
          if (!sameTarget) this.emit('available', release);
          if (!sameTarget && this.settings.autoDownload) this.queue(() => this.download());
        } else if (res.rollout === 'pending') {
          const release = await this.provider.release(res.nextVersion);
          this.set({ status: 'rollout-pending', target: res.nextVersion, release, lastChecked: checkedAt, lastCheck: res });
        } else {
          this.set({ status: 'up-to-date', target: null, release: null, lastChecked: checkedAt, lastCheck: res, staged: null });
        }
      } catch (e) {
        this.set({ status: 'error', error: e.message || String(e), lastChecked: this.state.lastChecked });
      } finally {
        this.busy = null;
        this.schedule();
      }
      return this.snapshot;
    })();
    return this.busy;
  }

  async download() {
    const release = this.state.release;
    if (!release || !['available', 'error'].includes(this.state.status)) return this.snapshot;
    this.abort = new AbortController();
    try {
      this.set({ status: 'downloading', progress: 0, received: 0, total: release.payload.sizeBytes, error: null });
      const result = await this.provider.download(release.version, {
        signal: this.abort.signal,
        onProgress: ({ received, total }) => this.set({ progress: total ? received / total : 0, received, total }, false),
      });

      this.set({ status: 'verifying', progress: 1 });
      const [digest] = await Promise.all([sha256Hex(result.bytes), delay(900)]);
      if (digest !== release.payload.sha256) throw new Error('Verification failed: the update package signature does not match.');
      const manifest = JSON.parse(new TextDecoder().decode(result.bytes));
      if (manifest.version !== release.version) throw new Error('Verification failed: unexpected package version.');

      this.set({ status: 'preparing' });
      await delay(1100);
      if (release.requiresVersion && release.requiresVersion !== this.system.version) {
        throw new Error(`This update requires RakenOS ${release.requiresVersion}.`);
      }
      const staged = { version: release.version, components: manifest.components, verifiedAt: this.now(), digest };
      this.set({ status: 'ready', staged });
      this.emit('ready', release);
      if (this.settings.autoInstall && this.locked && !this.needsUserConsent()) this.queue(() => this.install());
    } catch (e) {
      if (e.name === 'AbortError') this.set({ status: 'available', progress: 0 });
      else this.set({ status: 'error', error: e.message || String(e) });
    } finally {
      this.abort = null;
    }
    return this.snapshot;
  }

  cancelDownload() { if (this.abort) this.abort.abort(); }

  async install() {
    const { release, staged } = this.state;
    if (this.state.status !== 'ready' || !staged || !release) return this.snapshot;
    if (this.needsUserConsent()) return this.installShell(release);
    const from = this.system.version;
    this.set({ status: 'installing' });
    await delay(1400);
    const at = this.now();
    this.system = {
      version: staged.version,
      installedAt: at,
      components: staged.components,
      history: [...(this.system.history || []), { version: staged.version, installedAt: at }].slice(-400),
    };
    this.storage.set('rakenos.system', this.system);
    this.set({ status: 'updated', updatedFrom: from, staged: null, target: null, progress: 0 });
    this.emit('installed', { from, to: staged.version, release });
    this.schedule(this.settings.automaticUpdates ? 4000 : null);
    return this.snapshot;
  }

  /* Android application package updates always go through the system installer. */
  async installShell(release) {
    const su = release.shellUpdate;
    if (!this.platform.installPackage) {
      this.set({ status: 'error', error: 'This update needs the Android package installer, which is not available here.' });
      return this.snapshot;
    }
    this.set({ status: 'installing' });
    try {
      await this.platform.installPackage({ url: su.url, sha256: su.sha256 });
      // Android now shows its confirmation dialog; the new package restarts RakenOS.
      this.set({ status: 'ready' });
    } catch (e) {
      this.set({ status: 'error', error: e.message || String(e) });
    }
    return this.snapshot;
  }

  // ------------------------------------------------------------ Internals --
  queue(fn) { setTimeout(() => { fn().catch(() => {}); }, 0); }

  schedule(ms) {
    if (!this.timersEnabled) return;
    clearTimeout(this.timer); this.timer = null;
    if (!this.settings.automaticUpdates) return;
    let wait = ms;
    if (wait == null) {
      const s = this.state;
      if (s.status === 'rollout-pending' && s.lastCheck && s.lastCheck.eligibleAt) wait = Math.max(1000, s.lastCheck.eligibleAt - this.now() + 250);
      else if (['downloading', 'verifying', 'preparing', 'installing', 'ready', 'available'].includes(s.status)) return;
      else wait = Math.max(15000, Math.min(this.settings.rolloutDayMs, 6 * 60 * 60 * 1000));
    }
    this.timer = setTimeout(() => this.check(), wait);
  }

  set(patch, persist = true) {
    Object.assign(this.state, patch);
    if (persist) this.persist();
    this.emit('state');
  }

  persist() {
    const { status, target, release, lastChecked, lastCheck, staged, updatedFrom } = this.state;
    this.storage.set('rakenos.update.state', { status, target, release, lastChecked, lastCheck, staged, updatedFrom });
    this.storage.set('rakenos.system', this.system);
  }

  emit(type, detail) {
    for (const fn of this.listeners) { try { fn(type, detail, this.snapshot); } catch (e) { console.error(e); } }
  }
}

export function isUpdateNewer(a, b) { return isNewer(a, b); }
