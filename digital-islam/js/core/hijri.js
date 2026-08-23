/**
 * Hijri (Islamic) calendar.
 *
 * Prefers the browser's Umm al-Qura implementation, which is what Saudi Arabia
 * publishes, and falls back to the tabular ("Kuwaiti") arithmetic calendar when
 * Intl has no Islamic calendar. Both are calculated — a local moon sighting can
 * legitimately differ by a day, which the UI says out loud.
 */

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah',
];

export const HIJRI_MONTHS_AR = [
  'مُحَرَّم', 'صَفَر', 'رَبيع الأوّل', 'رَبيع الثاني',
  'جُمادى الأولى', 'جُمادى الآخرة', 'رَجَب', 'شَعْبان',
  'رَمَضان', 'شَوّال', 'ذو القَعْدة', 'ذو الحِجّة',
];

let intlFormatter = null;
try {
  intlFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  // Verify it actually switched calendars rather than silently falling back.
  const probe = intlFormatter.resolvedOptions().calendar || '';
  if (!probe.includes('islamic')) intlFormatter = null;
} catch {
  intlFormatter = null;
}

/** Tabular Islamic calendar (civil epoch), used when Intl cannot help. */
function tabularFromGregorian(date) {
  const jd = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + 2440588,
  );
  const days = jd - 1948440 + 10632;
  const n = Math.floor((days - 1) / 10631);
  const rem1 = days - 10631 * n + 354;
  const j = Math.floor((10985 - rem1) / 5316) * Math.floor((50 * rem1) / 17719)
          + Math.floor(rem1 / 5670) * Math.floor((43 * rem1) / 15238);
  const rem2 = rem1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
             - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * rem2) / 709);
  const day = rem2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** @returns {{year:number, month:number, day:number, monthName:string, monthNameAr:string, source:string}} */
export function toHijri(date = new Date(), offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 86400000);
  let parts = null;

  if (intlFormatter) {
    try {
      const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const fields = Object.fromEntries(
        intlFormatter.formatToParts(utc).map((p) => [p.type, p.value]),
      );
      const year = parseInt(String(fields.year).replace(/[^\d-]/g, ''), 10);
      const month = parseInt(fields.month, 10);
      const day = parseInt(fields.day, 10);
      if ([year, month, day].every(Number.isFinite)) {
        parts = { year, month, day, source: 'Umm al-Qura' };
      }
    } catch { /* fall through to the tabular calendar */ }
  }

  if (!parts) parts = { ...tabularFromGregorian(d), source: 'tabular' };

  return {
    ...parts,
    monthName: HIJRI_MONTHS[parts.month - 1] || '',
    monthNameAr: HIJRI_MONTHS_AR[parts.month - 1] || '',
  };
}

export function formatHijri(date = new Date(), offsetDays = 0) {
  const h = toHijri(date, offsetDays);
  return `${h.day} ${h.monthName} ${h.year} AH`;
}

/** Gregorian date for a Hijri day, found by bisecting the forward conversion. */
export function fromHijri(hYear, hMonth, hDay, offsetDays = 0) {
  // Rough seed: mean Hijri year is 354.367 days, epoch 622-07-16 CE.
  const approxDays = (hYear - 1) * 354.367 + (hMonth - 1) * 29.53 + hDay;
  let guess = new Date(Date.UTC(622, 6, 16) + approxDays * 86400000);

  for (let i = 0; i < 40; i++) {
    const got = toHijri(guess, offsetDays);
    const diff = (hYear - got.year) * 354.367 + (hMonth - got.month) * 29.53 + (hDay - got.day);
    if (Math.abs(diff) < 0.5) break;
    guess = new Date(guess.getTime() + Math.round(diff) * 86400000);
  }
  // Walk the last day or two exactly.
  for (let step = 0; step < 4; step++) {
    const got = toHijri(guess, offsetDays);
    if (got.year === hYear && got.month === hMonth && got.day === hDay) break;
    const behind = got.year < hYear
      || (got.year === hYear && (got.month < hMonth
      || (got.month === hMonth && got.day < hDay)));
    guess = new Date(guess.getTime() + (behind ? 86400000 : -86400000));
  }
  return guess;
}

/** Days in the current Hijri month, by probing day 30. */
export function hijriMonthLength(hYear, hMonth, offsetDays = 0) {
  const probe = fromHijri(hYear, hMonth, 30, offsetDays);
  return toHijri(probe, offsetDays).day === 30 ? 30 : 29;
}
