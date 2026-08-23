/**
 * Persistent state. Everything lives in localStorage on the headset — there is
 * no account, no server and nothing leaves the device.
 */

const KEY = 'digital-islam:v1';

const DEFAULTS = {
  settings: {
    method: 'MWL',
    asr: 'Standard',
    highLat: 'NightMiddle',
    use24h: true,
    adhanEnabled: true,
    adhanVolume: 0.7,
    ambienceVolume: 0.35,
    ambience: 'none',            // none | wind | rain | birds | haram
    reciter: 'alafasy',
    translation: 'en',           // en | ur | id | tr | fr | none
    showTransliteration: true,
    tajweed: true,
    arabicSize: 1,               // 0.8 – 1.6
    environment: 'masjid',       // masjid | courtyard | night | plain | passthrough
    handedness: 'right',
    locomotion: 'teleport',      // teleport | smooth
    snapTurn: true,
    vignette: true,
    seated: false,
    hijriOffset: 0,
    guideVoice: true,
    qiblaBeam: true,
    highContrast: false,
  },
  progress: {
    lastRead: { surah: 1, ayah: 1 },
    bookmarks: [],               // [{surah, ayah, note, at}]
    memorized: [],               // ["2:255", ...]
    tasbihTotal: 0,
    tasbihSessions: [],
    prayerLog: {},               // { "2026-08-23": { fajr: true, ... } }
    quranReadAyahs: 0,
    quizBest: 0,
    khatmahStart: null,
    duaFavourites: [],
    streak: { count: 0, lastDay: null, best: 0 },
  },
  location: null,                // cached { lat, lng, name, source }
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base?.[k] && typeof base[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

class Store extends EventTarget {
  constructor() {
    super();
    this.state = clone(DEFAULTS);
    this.available = true;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.state = deepMerge(clone(DEFAULTS), JSON.parse(raw));
    } catch {
      // Private windows and locked-down browsers throw on access; run in memory.
      this.available = false;
    }
  }

  save() {
    if (!this.available) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      this.available = false;
    }
  }

  get settings() { return this.state.settings; }
  get progress() { return this.state.progress; }

  set(path, value) {
    const keys = path.split('.');
    let node = this.state;
    for (const k of keys.slice(0, -1)) {
      if (typeof node[k] !== 'object' || node[k] === null) node[k] = {};
      node = node[k];
    }
    node[keys.at(-1)] = value;
    this.save();
    this.emit(path, value);
    return value;
  }

  get(path, fallback = undefined) {
    return path.split('.').reduce((n, k) => (n == null ? n : n[k]), this.state) ?? fallback;
  }

  toggle(path) { return this.set(path, !this.get(path)); }

  emit(path, value) {
    this.dispatchEvent(new CustomEvent('change', { detail: { path, value } }));
    this.dispatchEvent(new CustomEvent(`change:${path}`, { detail: value }));
  }

  /** Subscribe to one path (or '' for everything). Returns an unsubscribe fn. */
  on(path, handler) {
    const type = path ? `change:${path}` : 'change';
    const fn = (e) => handler(e.detail);
    this.addEventListener(type, fn);
    return () => this.removeEventListener(type, fn);
  }

  // ---- prayer log & streak -------------------------------------------------

  static dayKey(date = new Date()) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  markPrayer(prayer, done = true, date = new Date()) {
    const key = Store.dayKey(date);
    const log = { ...(this.state.progress.prayerLog[key] || {}) };
    if (done) log[prayer] = Date.now(); else delete log[prayer];
    this.state.progress.prayerLog[key] = log;
    this.updateStreak(key);
    this.save();
    this.emit('progress.prayerLog', this.state.progress.prayerLog);
    return log;
  }

  prayersFor(date = new Date()) {
    return this.state.progress.prayerLog[Store.dayKey(date)] || {};
  }

  /** A day counts toward the streak once all five fard prayers are logged. */
  updateStreak(dayKey) {
    const log = this.state.progress.prayerLog[dayKey] || {};
    const complete = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].every((p) => log[p]);
    if (!complete) return;
    const streak = this.state.progress.streak;
    if (streak.lastDay === dayKey) return;

    const yesterday = Store.dayKey(new Date(new Date(dayKey).getTime() - 864e5));
    streak.count = streak.lastDay === yesterday ? streak.count + 1 : 1;
    streak.lastDay = dayKey;
    streak.best = Math.max(streak.best || 0, streak.count);
  }

  /** Last `days` days of completion counts, oldest first — for the stats chart. */
  history(days = 30) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = Store.dayKey(new Date(Date.now() - i * 864e5));
      const log = this.state.progress.prayerLog[key] || {};
      out.push({ key, count: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((p) => log[p]).length });
    }
    return out;
  }

  // ---- bookmarks & memorisation -------------------------------------------

  toggleBookmark(surah, ayah, note = '') {
    const list = this.state.progress.bookmarks;
    const i = list.findIndex((b) => b.surah === surah && b.ayah === ayah);
    if (i >= 0) list.splice(i, 1);
    else list.unshift({ surah, ayah, note, at: Date.now() });
    this.state.progress.bookmarks = list.slice(0, 200);
    this.save();
    this.emit('progress.bookmarks', this.state.progress.bookmarks);
    return i < 0;
  }

  isBookmarked(surah, ayah) {
    return this.state.progress.bookmarks.some((b) => b.surah === surah && b.ayah === ayah);
  }

  toggleMemorized(ref) {
    const list = this.state.progress.memorized;
    const i = list.indexOf(ref);
    if (i >= 0) list.splice(i, 1); else list.push(ref);
    this.save();
    this.emit('progress.memorized', list);
    return i < 0;
  }

  addTasbih(count) {
    this.state.progress.tasbihTotal += count;
    this.state.progress.tasbihSessions.unshift({ count, at: Date.now() });
    this.state.progress.tasbihSessions = this.state.progress.tasbihSessions.slice(0, 100);
    this.save();
    this.emit('progress.tasbihTotal', this.state.progress.tasbihTotal);
  }

  reset() {
    this.state = clone(DEFAULTS);
    this.save();
    this.emit('', this.state);
  }

  export() { return JSON.stringify(this.state, null, 2); }
}

export const store = new Store();
export { Store };
