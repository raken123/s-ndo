/** Dates in the Hijri year the app highlights, as [month, day]. */
export const HIJRI_EVENTS = [
  { month: 1, day: 1, name: 'Islamic New Year', note: 'The first day of Muharram, the start of the Hijri year.' },
  { month: 1, day: 10, name: 'Day of Ashura', note: 'A day many fast, remembering the deliverance of Musa and his people.' },
  { month: 3, day: 12, name: "Mawlid an-Nabi", note: 'Marked in many communities as the birth of the Prophet ﷺ.' },
  { month: 7, day: 27, name: "Isra' and Mi'raj", note: 'The night journey and ascension, as commonly commemorated.' },
  { month: 8, day: 15, name: "Laylat al-Bara'ah", note: 'The mid-Sha\'ban night, observed in many communities.' },
  { month: 9, day: 1, name: 'Ramadan begins', note: 'The month of fasting — subject to the local moon sighting.' },
  { month: 9, day: 21, name: 'Last ten nights begin', note: 'The nights in which Laylat al-Qadr is sought.' },
  { month: 9, day: 27, name: 'Laylat al-Qadr (commonly observed)', note: 'Most widely observed on the 27th night, though it is sought on all odd nights of the last ten.' },
  { month: 10, day: 1, name: 'Eid al-Fitr', note: 'The festival closing Ramadan.' },
  { month: 12, day: 1, name: 'Hajj season begins', note: 'The first ten days of Dhu al-Hijjah are especially valued.' },
  { month: 12, day: 9, name: 'Day of Arafah', note: 'The central day of Hajj; fasted by those not on pilgrimage.' },
  { month: 12, day: 10, name: 'Eid al-Adha', note: 'The festival of sacrifice.' },
  { month: 12, day: 11, name: 'Days of Tashriq', note: 'The three days following Eid al-Adha.' },
];

/** Weekly and monthly recurring practices. */
export const RECURRING = [
  { name: "Jumu'ah", when: 'Every Friday', note: 'The congregational prayer replacing Dhuhr, plus Surah al-Kahf.' },
  { name: 'Monday & Thursday fasts', when: 'Weekly', note: 'A regularly kept voluntary fast.' },
  { name: 'The white days', when: '13th, 14th, 15th of each Hijri month', note: 'Three days of voluntary fasting around the full moon.' },
];

export function eventsForMonth(hijriMonth) {
  return HIJRI_EVENTS.filter((e) => e.month === hijriMonth);
}

export function isWhiteDay(hijriDay) {
  return hijriDay >= 13 && hijriDay <= 15;
}
