/**
 * Prayer time calculation.
 *
 * Solar position from the low-precision NOAA/USNO almanac formulae, then the
 * standard hour-angle solutions used by every mainstream prayer-time
 * implementation (PrayTimes, Adhan, ITL). Accurate to well under a minute for
 * latitudes below ~48°; higher latitudes fall back to a night-portion rule.
 */

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(x) / DEG;
const acos = (x) => Math.acos(x) / DEG;
const atan2 = (y, x) => Math.atan2(y, x) / DEG;
const acot = (x) => Math.atan(1 / x) / DEG;

const fixAngle = (a) => ((a % 360) + 360) % 360;
const fixHour = (h) => ((h % 24) + 24) % 24;

/** Calculation conventions. `fajr`/`isha` are depression angles below the horizon. */
export const METHODS = {
  MWL:     { name: 'Muslim World League',            fajr: 18,   isha: 17 },
  ISNA:    { name: 'Islamic Society of N. America',  fajr: 15,   isha: 15 },
  Egypt:   { name: 'Egyptian General Authority',     fajr: 19.5, isha: 17.5 },
  Makkah:  { name: 'Umm al-Qura, Makkah',            fajr: 18.5, isha: '90 min' },
  Karachi: { name: 'University of Karachi',          fajr: 18,   isha: 18 },
  Tehran:  { name: 'Univ. of Tehran',                fajr: 17.7, isha: 14, maghrib: 4.5, midnight: 'Jafari' },
  Jafari:  { name: 'Shia Ithna-Ashari',              fajr: 16,   isha: 14, maghrib: 4,   midnight: 'Jafari' },
  Dubai:   { name: 'Gulf / Dubai',                   fajr: 18.2, isha: 18.2 },
  Turkey:  { name: 'Diyanet, Turkey',                fajr: 18,   isha: 17 },
  Singapore:{ name: 'MUIS, Singapore',               fajr: 20,   isha: 18 },
};

/** Asr shadow factor: Shafi/Maliki/Hanbali = 1, Hanafi = 2. */
export const ASR_SCHOOLS = { Standard: 1, Hanafi: 2 };

/** High-latitude rules for nights where the sun never reaches the twilight angle. */
export const HIGH_LAT_RULES = ['None', 'NightMiddle', 'AngleBased', 'OneSeventh'];

const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha'];

export const PRAYER_LABELS = {
  fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr',
  sunset: 'Sunset', maghrib: 'Maghrib', isha: 'Isha',
};

export const PRAYER_ARABIC = {
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر',
  sunset: 'الغروب', maghrib: 'المغرب', isha: 'العشاء',
};

/** Julian day for a civil date (UTC midnight of that calendar day). */
export function julianDay(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

/** Sun declination and equation of time (hours) for a Julian day. */
function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const decl = asin(sin(e) * sin(L));
  const ra = fixHour(atan2(cos(e) * sin(L), cos(L)) / 15);
  return { decl, eqt: q / 15 - ra };
}

/** Hour angle (in hours) for the sun at `angle` degrees below the horizon. */
function hourAngle(angle, lat, decl) {
  const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
  if (x > 1 || x < -1) return NaN; // sun never reaches this altitude today
  return acos(x) / 15;
}

/** Hour angle for the Asr shadow criterion. */
function asrAngle(factor, lat, decl) {
  const altitude = -acot(factor + tan(Math.abs(lat - decl)));
  return hourAngle(altitude, lat, decl);
}

function timeDiff(a, b) { return fixHour(b - a); }

/** Portion of the night used when the twilight angle is never reached. */
function nightPortion(rule, angle, night) {
  switch (rule) {
    case 'AngleBased': return night * (angle / 60);
    case 'OneSeventh': return night / 7;
    case 'NightMiddle': return night / 2;
    default: return NaN;
  }
}

function adjustHighLat(times, rule, params) {
  if (rule === 'None') return times;
  const night = timeDiff(times.sunset, times.sunrise);

  const fajrLimit = nightPortion(rule, params.fajr, night);
  if (Number.isNaN(times.fajr) || timeDiff(times.fajr, times.sunrise) > fajrLimit) {
    times.fajr = times.sunrise - fajrLimit;
  }
  const ishaAngle = typeof params.isha === 'number' ? params.isha : 18;
  const ishaLimit = nightPortion(rule, ishaAngle, night);
  if (Number.isNaN(times.isha) || timeDiff(times.sunset, times.isha) > ishaLimit) {
    times.isha = times.sunset + ishaLimit;
  }
  return times;
}

/**
 * @param {Date}   date
 * @param {object} loc      { lat, lng, elevation? }
 * @param {object} opts     { method, asr, highLat, tzOffsetMinutes, adjustments }
 * @returns {object} map of prayer -> Date (local), plus helpers
 */
export function computeTimes(date, loc, opts = {}) {
  const method = METHODS[opts.method] ? { ...METHODS[opts.method] } : { ...METHODS.MWL };
  const asrFactor = ASR_SCHOOLS[opts.asr] || ASR_SCHOOLS.Standard;
  const highLat = HIGH_LAT_RULES.includes(opts.highLat) ? opts.highLat : 'NightMiddle';
  const elevation = loc.elevation || 0;

  // Local midnight of `date`, expressed as an offset from UTC in hours.
  const tzMinutes = opts.tzOffsetMinutes ?? -date.getTimezoneOffset();
  const tz = tzMinutes / 60;

  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate()) - loc.lng / (15 * 24);
  const { decl, eqt } = sunPosition(jd + 0.5);

  // Horizon dip from observer elevation, plus standard refraction (0.833°).
  const dip = 0.0347 * Math.sqrt(Math.max(0, elevation));
  const riseSetAngle = 0.833 + dip;

  const dhuhr = 12 - eqt;
  const t = {
    dhuhr,
    sunrise: dhuhr - hourAngle(riseSetAngle, loc.lat, decl),
    sunset: dhuhr + hourAngle(riseSetAngle, loc.lat, decl),
    fajr: dhuhr - hourAngle(method.fajr, loc.lat, decl),
    asr: dhuhr + asrAngle(asrFactor, loc.lat, decl),
  };

  t.maghrib = typeof method.maghrib === 'number'
    ? t.sunset + hourAngle(method.maghrib, loc.lat, decl) - hourAngle(riseSetAngle, loc.lat, decl)
    : t.sunset;

  if (typeof method.isha === 'string') {
    // "90 min" style: a fixed interval after maghrib.
    t.isha = t.maghrib + parseInt(method.isha, 10) / 60;
  } else {
    t.isha = dhuhr + hourAngle(method.isha, loc.lat, decl);
  }

  adjustHighLat(t, highLat, method);

  // Dhuhr is usually nudged a little past solar noon so the sun has clearly moved.
  t.dhuhr += (opts.dhuhrMinutes ?? 1) / 60;

  const adj = opts.adjustments || {};
  const out = {};
  for (const key of PRAYERS) {
    const hours = t[key] + tz - loc.lng / 15 + (adj[key] || 0) / 60;
    out[key] = hoursToDate(date, hours);
  }

  // Islamic midnight: midpoint of the night (Jafari methods measure to Fajr).
  const nightEnd = method.midnight === 'Jafari' ? out.fajr : out.sunrise;
  const nightStart = method.midnight === 'Jafari' ? out.maghrib : out.sunset;
  out.midnight = new Date(nightStart.getTime() + (nextDay(nightEnd) - nightStart) / 2);
  out.lastThird = new Date(nightStart.getTime() + ((nextDay(nightEnd) - nightStart) * 2) / 3);

  out.meta = { method: method.name, asr: opts.asr || 'Standard', highLat, decl, eqt };
  return out;
}

function nextDay(d) { return d.getTime() + 24 * 3600 * 1000; }

function hoursToDate(date, hours) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (!Number.isFinite(hours)) return new Date(NaN);
  return new Date(base.getTime() + Math.round(hours * 3600 * 1000));
}

/** The five obligatory prayers, in order, ignoring sunrise/sunset markers. */
export const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * Which prayer is current and which is next, rolling into tomorrow's Fajr
 * after Isha.
 */
export function prayerWindow(now, loc, opts) {
  const today = computeTimes(now, loc, opts);
  const tomorrow = computeTimes(new Date(now.getTime() + 864e5), loc, opts);

  const schedule = FARD.map((k) => ({ key: k, at: today[k] }))
    .concat([{ key: 'fajr', at: tomorrow.fajr, tomorrow: true }])
    .filter((e) => Number.isFinite(e.at?.getTime()));

  let current = null;
  let next = schedule[0];
  for (const entry of schedule) {
    if (entry.at <= now) current = entry; else { next = entry; break; }
  }
  if (!current) {
    // Before today's Fajr — the current window is yesterday's Isha.
    const yest = computeTimes(new Date(now.getTime() - 864e5), loc, opts);
    current = { key: 'isha', at: yest.isha, yesterday: true };
  }
  return { today, tomorrow, current, next, msToNext: next.at - now };
}

/** "1h 23m" style countdown. */
export function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function formatTime(date, use24 = true) {
  if (!date || !Number.isFinite(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: !use24,
  });
}
