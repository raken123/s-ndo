/*
 * Platform bridge. On Android the RakenSystem Cordova plugin provides native
 * services; in a browser each call falls back to a web implementation.
 * No call in this bridge returns a device model or any hardware name.
 */

const native = () => (globalThis.cordova && globalThis.RakenSystem) || null;
const call = (method, ...args) => new Promise((resolve, reject) => {
  const n = native();
  if (!n || typeof n[method] !== 'function') { reject(new Error('unavailable')); return; }
  n[method](...args, resolve, reject);
});

export const platform = {
  get isNative() { return !!native(); },

  async capabilities() { return call('getCapabilities'); },

  async battery() {
    try { return await call('getBattery'); } catch {}
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        return { level: Math.round(b.level * 100), charging: b.charging, source: 'web' };
      }
    } catch {}
    return { level: 86, charging: false, source: 'estimate' };
  },

  onBatteryChange(fn) {
    if (navigator.getBattery && !native()) {
      navigator.getBattery().then((b) => {
        const f = () => fn({ level: Math.round(b.level * 100), charging: b.charging, source: 'web' });
        b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f);
      }).catch(() => {});
    }
    setInterval(async () => fn(await platform.battery()), 60000);
  },

  async setBrightness(v) {
    try { await call('setBrightness', v); return true; } catch { return false; }
  },

  async setTorch(on) {
    try { await call('setTorch', !!on); return true; } catch { return false; }
  },

  vibrate(ms = 10) {
    try { if (native()) { call('vibrate', ms).catch(() => {}); return; } } catch {}
    if (navigator.vibrate) navigator.vibrate(ms);
  },

  async requestPermission(name) {
    try { return await call('requestPermission', name); } catch { return true; }
  },

  async openSystemSettings(which) {
    try { await call('openSystemSettings', which); return true; } catch { return false; }
  },

  openExternal(url) {
    call('openExternal', url).catch(() => { window.open(url, '_blank', 'noopener'); });
  },

  /* Android package installation — always confirmed by the user in Android's installer. */
  async installPackage({ url, sha256 }) {
    return call('installPackage', url, sha256);
  },

  async canInstallPackages() {
    try { return await call('canRequestPackageInstalls'); } catch { return false; }
  },

  exit() { try { navigator.app && navigator.app.exitApp(); } catch {} },
};
