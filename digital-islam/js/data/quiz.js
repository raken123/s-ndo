/** Questions for the knowledge game. `a` is the index of the correct answer. */
export const QUIZ = [
  { q: 'How many rak\'ahs are in the obligatory Maghrib prayer?', o: ['2', '3', '4', '5'], a: 1 },
  { q: 'Which surah is recited in every single rak\'ah?', o: ['Al-Ikhlas', 'Ya-Sin', 'Al-Fatihah', 'Al-Kahf'], a: 2 },
  { q: 'How many surahs are in the Qur\'an?', o: ['99', '114', '124', '30'], a: 1 },
  { q: 'How many juz\' (para) does the Qur\'an divide into?', o: ['30', '40', '60', '114'], a: 0 },
  { q: 'Which direction does the Qibla point towards?', o: ['Jerusalem', 'Madinah', 'The Kaaba in Makkah', 'The rising sun'], a: 2 },
  { q: 'Which pillar of Islam is the declaration of faith?', o: ['Salah', 'Shahada', 'Zakat', 'Sawm'], a: 1 },
  { q: 'In which month is fasting obligatory?', o: ['Muharram', 'Rajab', 'Ramadan', 'Shawwal'], a: 2 },
  { q: 'Which prayer is prayed before sunrise?', o: ['Fajr', 'Dhuhr', 'Asr', 'Isha'], a: 0 },
  { q: 'How many names of God are traditionally enumerated?', o: ['33', '99', '100', '114'], a: 1 },
  { q: 'What is the longest surah of the Qur\'an?', o: ['Al-Fatihah', 'Al-Baqarah', 'An-Nisa', 'Al-Kahf'], a: 1 },
  { q: 'Which surah is often recited on Fridays?', o: ['Al-Kahf', 'Al-Mulk', 'Ar-Rahman', 'Al-Waqi\'ah'], a: 0 },
  { q: 'What is said when bowing in ruku\'?', o: ['Subhana Rabbiyal-A\'la', 'Subhana Rabbiyal-Azim', 'Allahu Akbar', 'Rabbighfir li'], a: 1 },
  { q: 'Which prayer has four obligatory rak\'ahs and is prayed in the afternoon?', o: ['Fajr', 'Asr', 'Maghrib', 'Witr'], a: 1 },
  { q: 'How many times a day are the obligatory prayers performed?', o: ['3', '5', '7', '9'], a: 1 },
  { q: 'What does "Alhamdulillah" mean?', o: ['God is greater', 'Glory be to God', 'All praise belongs to God', 'There is no god but God'], a: 2 },
  { q: 'Which month follows Ramadan?', o: ['Sha\'ban', 'Shawwal', 'Rajab', 'Muharram'], a: 1 },
  { q: 'Which city contains Al-Masjid an-Nabawi?', o: ['Makkah', 'Madinah', 'Jerusalem', 'Damascus'], a: 1 },
  { q: 'What is the night journey of the Prophet ﷺ called?', o: ['Hijrah', 'Isra and Mi\'raj', 'Laylat al-Qadr', 'Umrah'], a: 1 },
  { q: 'Zakat is generally due on wealth held for how long?', o: ['One month', 'Six months', 'One lunar year', 'Five years'], a: 2 },
  { q: 'Which surah is called "the heart of the Qur\'an" in a well-known report?', o: ['Ya-Sin', 'Al-Ikhlas', 'Al-Mulk', 'Al-Fatihah'], a: 0 },
  { q: 'How many ayahs are in Surah al-Fatihah?', o: ['5', '6', '7', '10'], a: 2 },
  { q: 'What is the shortest surah in the Qur\'an by word count?', o: ['Al-Asr', 'Al-Kawthar', 'An-Nasr', 'Al-Ikhlas'], a: 1 },
  { q: 'What does "Bismillah" open?', o: ['Every surah except At-Tawbah', 'Only Al-Fatihah', 'Only the last ten surahs', 'Every ayah'], a: 0 },
  { q: 'The Hijri calendar counts years from which event?', o: ['The birth of the Prophet ﷺ', 'The first revelation', 'The migration to Madinah', 'The conquest of Makkah'], a: 2 },
  { q: 'How many days does a Hijri year have, roughly?', o: ['354', '360', '365', '370'], a: 0 },
  { q: 'What is the voluntary night prayer in Ramadan called?', o: ['Tahajjud', 'Tarawih', 'Witr', 'Duha'], a: 1 },
  { q: 'Which pilgrimage can be performed at any time of year?', o: ['Hajj', 'Umrah', 'Both', 'Neither'], a: 1 },
  { q: 'What is said before starting to recite the Qur\'an?', o: ['Takbir', 'Ta\'awwudh', 'Talbiyah', 'Tahlil'], a: 1 },
  { q: 'How many prostrations are in one rak\'ah?', o: ['1', '2', '3', '4'], a: 1 },
  { q: 'Which day of the week is the congregational prayer held?', o: ['Thursday', 'Friday', 'Saturday', 'Sunday'], a: 1 },
  { q: 'What is the ritual washing before prayer called?', o: ['Ghusl', 'Wudu', 'Tayammum', 'Istinja'], a: 1 },
  { q: 'What may be used for purification when no water is available?', o: ['Sand or clean earth (tayammum)', 'Nothing', 'Milk', 'Perfume'], a: 0 },
];

/** A shuffled subset for one round. */
export function drawQuestions(count = 10) {
  const pool = QUIZ.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
