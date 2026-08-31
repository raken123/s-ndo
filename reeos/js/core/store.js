/** localStorage-backad state. Allt överlever att telefonen låser sig i hållaren. */
import { emit } from './bus.js';

const KEY = 'reeos.v1';

const DEFAULTS = {
  settings: {
    theme: 'auto',            // auto | night | day
    units: 'metric',
    voice: true,              // läs upp med talsyntes
    voiceRate: 1.05,
    speedVolume: true,        // höj volymen med farten
    wakeLock: true,           // låt skärmen vara tänd
    lockWhileDriving: true,   // blockera textinmatning i rörelse
    speedWarnAt: 0,           // 0 = av, annars km/h
    hudMirror: true,
    autoTripLog: true,
    breakAfterMin: 90,        // pausvarning efter X min körning
  },
  contacts: [
    { id: 'c1', name: 'Hemma', number: '', note: 'Lägg till ditt eget nummer' },
  ],
  places: [
    { id: 'p1', label: 'Hem', lat: null, lon: null },
    { id: 'p2', label: 'Jobb', lat: null, lon: null },
  ],
  quickReplies: [
    'Jag kör just nu, ringer sen.',
    'Är på väg — 10 minuter kvar.',
    'Kan du köra? Jag är trött.',
    'Framme om en stund.',
  ],
  trips: [],       // { id, start, end, km, from, to, purpose, note }
  parking: null,   // { lat, lon, at, note, photo, meterEndsAt, level }
  hazards: [],     // { id, lat, lon, kind, at, note }
  clips: [],       // dashcam-metadata; blobbar ligger i IndexedDB
  stats: { totalKm: 0, breaks: 0, driveMs: 0 },
};

function deepMerge(base, patch) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return patch ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? deepMerge(base[k] ?? {}, v) : v;
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? deepMerge(DEFAULTS, JSON.parse(raw)) : structuredClone(DEFAULTS);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const state = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (err) { console.warn('[store] kunde inte spara', err); }
  }, 120);
}

/** Skriv en inställning och meddela lyssnare. */
export function setSetting(key, value) {
  state.settings[key] = value;
  save();
  emit('settings:changed', { key, value });
}

/** Lägg till i en lista, spara och notifiera. */
export function push(listName, item) {
  state[listName].push(item);
  save();
  emit(`${listName}:changed`, state[listName]);
  return item;
}

export function replace(listName, items) {
  state[listName] = items;
  save();
  emit(`${listName}:changed`, items);
}

export function remove(listName, id) {
  replace(listName, state[listName].filter((x) => x.id !== id));
}

export function setValue(key, value) {
  state[key] = value;
  save();
  emit(`${key}:changed`, value);
}

export function resetAll() {
  localStorage.removeItem(KEY);
  Object.assign(state, structuredClone(DEFAULTS));
  emit('store:reset');
}

export function exportJSON() {
  return JSON.stringify({ app: 'ReeOS', version: 1, exportedAt: Date.now(), data: state }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed?.data ?? parsed;
  if (!data || typeof data !== 'object') throw new Error('Filen innehåller ingen ReeOS-data.');
  Object.assign(state, deepMerge(DEFAULTS, data));
  save();
  emit('store:imported');
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
