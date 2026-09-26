// Persistent, observable system settings.
import { LocalJsonStorage } from '../../lib/update-system/storage.js';
import { Emitter } from './dom.js';

export const storage = new LocalJsonStorage();

export const DEFAULT_SETTINGS = {
  setupComplete: false,
  theme: 'auto', // auto | light | dark
  wallpaper: 'fjord',
  textSize: 'default', // small | default | large | larger
  boldText: false,
  reduceMotion: false,
  increaseContrast: false,
  brightness: 0.75,
  autoBrightness: true,
  volumeMedia: 0.6,
  volumeRing: 0.7,
  volumeNotifications: 0.6,
  haptics: true,
  silent: false,
  wifi: true,
  bluetooth: false,
  airplane: false,
  dnd: false,
  rotationLock: true,
  batterySaver: false,
  batterySaverAuto: 20,
  nfc: true,
  scannerEnabled: true,
  scannerFeedback: 'beep-vibrate',
  scannerTrigger: 'hardware',
  scannerSymbologies: { qr: true, datamatrix: true, code128: true, ean13: true, pdf417: false },
  screenLock: 'none', // none | pin
  pinHash: null,
  pinSalt: null,
  autoLock: 60, // seconds
  lockNotifications: 'always', // always | unlocked | never
  verifiedAppsOnly: true,
  diagnostics: false,
  searchHistory: true,
  dock: ['settings', 'camera', 'browser', 'store'],
  grid: ['gallery', 'files', 'notes', 'calculator', 'clock', 'scanner'],
  widgets: ['clock', 'battery', 'notes'],
  developerEnabled: false,
  capabilityOverrides: {},
  updateServer: '',
  clockCities: ['Europe/Stockholm', 'America/New_York', 'Asia/Tokyo'],
};

class SettingsStore extends Emitter {
  constructor() {
    super();
    this.data = { ...DEFAULT_SETTINGS, ...(storage.get('rakenos.settings') || {}) };
  }
  get(k) { return this.data[k]; }
  set(patch) {
    const changed = Object.keys(patch).filter((k) => JSON.stringify(this.data[k]) !== JSON.stringify(patch[k]));
    if (!changed.length) return;
    Object.assign(this.data, patch);
    storage.set('rakenos.settings', this.data);
    for (const k of changed) this.emit(k, this.data[k]);
    this.emit('change', changed);
  }
  toggle(k) { this.set({ [k]: !this.data[k] }); return this.data[k]; }
  reset() { this.data = { ...DEFAULT_SETTINGS }; storage.set('rakenos.settings', this.data); this.emit('change', Object.keys(this.data)); }
}

export const settings = new SettingsStore();

/* Small helper for app-specific persistent data. */
export function appData(key, fallback) {
  return {
    get: () => storage.get(key) ?? structuredClone(fallback),
    set: (v) => storage.set(key, v),
  };
}
