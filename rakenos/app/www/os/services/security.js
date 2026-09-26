// Screen lock: salted PIN hashes and progressive lockout.
import { settings, storage } from '../core/store.js';

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const security = {
  hasPin() { return settings.get('screenLock') === 'pin' && !!settings.get('pinHash'); },

  async setPin(pin) {
    const salt = randomSalt();
    settings.set({ screenLock: 'pin', pinSalt: salt, pinHash: await hashPin(pin, salt) });
    storage.set('rakenos.lockout', { failures: 0, until: 0 });
  },

  removePin() { settings.set({ screenLock: 'none', pinHash: null, pinSalt: null }); },

  lockout() { return storage.get('rakenos.lockout') || { failures: 0, until: 0 }; },

  /* Returns { ok } or { ok: false, retryAt, failures } */
  async verify(pin) {
    const lo = this.lockout();
    if (lo.until > Date.now()) return { ok: false, retryAt: lo.until, failures: lo.failures };
    const ok = (await hashPin(pin, settings.get('pinSalt'))) === settings.get('pinHash');
    if (ok) { storage.set('rakenos.lockout', { failures: 0, until: 0 }); return { ok: true }; }
    const failures = lo.failures + 1;
    // 5 attempts, then 30 s, 1 min, 5 min, 15 min …
    const delays = [0, 0, 0, 0, 0, 30, 60, 300, 900];
    const d = (delays[Math.min(failures, delays.length - 1)] || 0) * 1000;
    const rec = { failures, until: d ? Date.now() + d : 0 };
    storage.set('rakenos.lockout', rec);
    return { ok: false, retryAt: rec.until, failures };
  },

  status(updateSnapshot) {
    const items = [];
    items.push({ id: 'lock', ok: this.hasPin(), label: this.hasPin() ? 'Screen lock is on' : 'No screen lock', detail: this.hasPin() ? 'PIN protects this device.' : 'Set a PIN to protect your data.' });
    items.push({ id: 'verify', ok: settings.get('verifiedAppsOnly'), label: settings.get('verifiedAppsOnly') ? 'Only verified RAS apps' : 'Unverified apps allowed', detail: 'Package signatures are checked before installation.' });
    const upToDate = updateSnapshot && ['up-to-date', 'idle', 'rollout-pending', 'updated'].includes(updateSnapshot.status);
    items.push({ id: 'update', ok: !!upToDate, label: upToDate ? 'System is up to date' : 'System update available', detail: upToDate ? 'The latest security content available to this device is installed.' : 'Install the update to receive the latest security fixes.' });
    return { ok: items.every((i) => i.ok), items };
  },
};
