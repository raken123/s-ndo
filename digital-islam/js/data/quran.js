/**
 * Qur'an text access.
 *
 * Order of preference for every surah:
 *   1. an already-cached copy in localStorage,
 *   2. a fresh fetch from the Al-Quran Cloud API (Uthmani text + translation
 *      + transliteration editions), which is the authoritative source here,
 *   3. the built-in offline set in `quran-core.js`.
 *
 * Nothing is uploaded — the API is read-only and takes no identifying data.
 */

import { SURAHS, surah } from './surahs.js';
import { CORE_TEXT, CORE_AYAHS } from './quran-core.js';

const API = 'https://api.alquran.cloud/v1';
const CACHE_PREFIX = 'digital-islam:surah:';
const CACHE_LIMIT = 30; // surahs kept offline before the oldest is dropped

export const TRANSLATION_EDITIONS = {
  en: { id: 'en.asad', label: 'English — Muhammad Asad' },
  ur: { id: 'ur.jalandhry', label: 'اردو — Jalandhry' },
  id: { id: 'id.indonesian', label: 'Bahasa Indonesia' },
  tr: { id: 'tr.diyanet', label: 'Türkçe — Diyanet' },
  fr: { id: 'fr.hamidullah', label: 'Français — Hamidullah' },
  de: { id: 'de.aburida', label: 'Deutsch — Abu Rida' },
  es: { id: 'es.cortes', label: 'Español — Cortés' },
  ru: { id: 'ru.kuliev', label: 'Русский — Кулиев' },
  none: { id: null, label: 'Arabic only' },
};

export const RECITERS = {
  alafasy:   { id: 'Alafasy_128kbps',              name: 'Mishary Rashid Alafasy' },
  husary:    { id: 'Husary_128kbps',               name: 'Mahmoud Khalil Al-Husary' },
  minshawi:  { id: 'Minshawy_Murattal_128kbps',    name: 'Mohamed Siddiq El-Minshawi' },
  sudais:    { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'Abdurrahman As-Sudais' },
  shatri:    { id: 'Abu_Bakr_Ash-Shaatree_128kbps', name: 'Abu Bakr Ash-Shatri' },
  ghamdi:    { id: 'Ghamadi_40kbps',               name: 'Saad Al-Ghamdi' },
};

const pad3 = (n) => String(n).padStart(3, '0');

/** Streaming URL for one ayah from EveryAyah. */
export function ayahAudioUrl(surahNo, ayahNo, reciterKey = 'alafasy') {
  const reciter = RECITERS[reciterKey] || RECITERS.alafasy;
  return `https://everyayah.com/data/${reciter.id}/${pad3(surahNo)}${pad3(ayahNo)}.mp3`;
}

function cacheKey(n, translation) { return `${CACHE_PREFIX}${n}:${translation}`; }

function readCache(n, translation) {
  try {
    const raw = localStorage.getItem(cacheKey(n, translation));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(n, translation, payload) {
  try {
    localStorage.setItem(cacheKey(n, translation), JSON.stringify(payload));
    pruneCache();
  } catch {
    pruneCache(true);
  }
}

/** Keep the cache bounded so a long reading session cannot fill up storage. */
function pruneCache(aggressive = false) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    const limit = aggressive ? Math.floor(CACHE_LIMIT / 2) : CACHE_LIMIT;
    if (keys.length <= limit) return;
    const dated = keys.map((k) => {
      let at = 0;
      try { at = JSON.parse(localStorage.getItem(k)).cachedAt || 0; } catch { /* corrupt entry */ }
      return { k, at };
    }).sort((a, b) => a.at - b.at);
    dated.slice(0, keys.length - limit).forEach(({ k }) => localStorage.removeItem(k));
  } catch { /* storage unavailable — nothing to prune */ }
}

function offlineSurah(n, meta) {
  const core = CORE_TEXT[n];
  if (!core) return null;
  return {
    number: n,
    name: meta.name,
    arabic: meta.arabic,
    source: 'offline',
    ayahs: core.map((a, i) => ({
      number: i + 1,
      arabic: a.arabic,
      translit: a.translit,
      translation: a.meaning,
    })),
  };
}

/**
 * Whatever copy of a surah is already on the device, with no waiting: the
 * downloaded cache first, then the built-in text. Lets the book paint the
 * moment it opens and upgrade once the network answers.
 */
export function peekSurah(n, translation = 'en') {
  const meta = surah(n);
  if (!meta) return null;
  return readCache(n, translation) || offlineSurah(n, meta);
}

const inflight = new Map();

/**
 * Load one surah. Always resolves — network problems fall back to the built-in
 * text or to an explanatory placeholder, never to a rejected promise.
 */
export async function loadSurah(n, { translation = 'en', signal } = {}) {
  const meta = surah(n);
  if (!meta) throw new Error(`No such surah: ${n}`);

  const cached = readCache(n, translation);
  if (cached) return cached;

  const key = `${n}:${translation}`;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    const editionIds = ['quran-uthmani', 'en.transliteration'];
    const tr = TRANSLATION_EDITIONS[translation]?.id;
    if (tr) editionIds.push(tr);

    try {
      const res = await fetch(`${API}/surah/${n}/editions/${editionIds.join(',')}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const editions = json.data || [];
      const arabicEd = editions.find((e) => e.edition.identifier === 'quran-uthmani');
      if (!arabicEd) throw new Error('missing Arabic edition');
      const translitEd = editions.find((e) => e.edition.identifier === 'en.transliteration');
      const transEd = tr ? editions.find((e) => e.edition.identifier === tr) : null;

      const payload = {
        number: n,
        name: meta.name,
        arabic: meta.arabic,
        source: 'api',
        edition: transEd?.edition?.englishName || null,
        cachedAt: Date.now(),
        ayahs: arabicEd.ayahs.map((a, i) => ({
          number: a.numberInSurah,
          arabic: stripLeadingBasmala(n, i, a.text),
          translit: translitEd?.ayahs?.[i]?.text || '',
          translation: transEd?.ayahs?.[i]?.text || '',
          sajdah: !!a.sajda,
          juz: a.juz,
          page: a.page,
        })),
      };
      writeCache(n, translation, payload);
      return payload;
    } catch (err) {
      const fallback = offlineSurah(n, meta);
      if (fallback) return { ...fallback, error: err.name === 'AbortError' ? null : String(err.message || err) };
      return {
        number: n,
        name: meta.name,
        arabic: meta.arabic,
        source: 'unavailable',
        error: String(err.message || err),
        ayahs: [{
          number: 1,
          arabic: meta.arabic,
          translit: '',
          translation: `${meta.name} is not in the built-in selection. Connect to the internet once to download it — it is then kept on this headset for offline reading.`,
        }],
      };
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/**
 * The mushaf prints the basmala as a standalone header rather than as part of
 * the first ayah of most surahs; the API includes it inline. At-Tawbah (9) has
 * no basmala, and in An-Naml (27) it is genuinely part of ayah 30.
 */
const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
function stripLeadingBasmala(surahNo, index, text) {
  if (index !== 0 || surahNo === 1 || surahNo === 9) return text;
  const normalised = text.replace(/ۡ|ٰ/g, '');
  if (normalised.startsWith(BASMALA)) {
    return text.slice(text.indexOf(BASMALA.slice(-6)) + 6).trim() || text;
  }
  return text;
}

export function hasBasmala(surahNo) { return surahNo !== 1 && surahNo !== 9; }

export const BASMALA_TEXT = BASMALA;

/** Ayat al-Kursi and friends, without loading a whole surah. */
export function coreAyah(ref) { return CORE_AYAHS[ref] || null; }

/** Which surahs are readable with no network right now. */
export function offlineAvailability() {
  const inCore = new Set(Object.keys(CORE_TEXT).map(Number));
  const cached = new Set();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => cached.add(Number(k.slice(CACHE_PREFIX.length).split(':')[0])));
  } catch { /* storage unavailable */ }
  return SURAHS.map((s) => ({
    ...s,
    offline: inCore.has(s.number) || cached.has(s.number),
    downloaded: cached.has(s.number),
  }));
}

/** Download a set of surahs for offline use, reporting progress. */
export async function downloadForOffline(numbers, translation, onProgress) {
  let done = 0;
  for (const n of numbers) {
    await loadSurah(n, { translation });
    done += 1;
    onProgress?.(done, numbers.length, n);
  }
  return done;
}

export function clearOfflineCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* nothing to clear */ }
}
