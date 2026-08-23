/**
 * Guided prayer content: the postures of one rak'ah, what is recited in each,
 * the rak'ah counts of every prayer, wudu, and the dhikr said afterwards.
 *
 * Wording follows the most widely taught form. Details legitimately differ
 * between schools of law; the app says so rather than pretending otherwise.
 */

export const MADHHAB_NOTE =
  'Wording and small details of posture differ between the schools of law and between '
  + 'families. This guide follows the most commonly taught form — follow what you have been '
  + 'taught, or ask a scholar you trust.';

/** Postures, with the head/hand pose used to draw the ghost guide. */
export const POSTURES = {
  standing:   { label: 'Qiyam — standing',        head: 1.55, lean: 0,    hands: 'chest' },
  bowing:     { label: "Ruku' — bowing",          head: 1.05, lean: 80,   hands: 'knees' },
  rising:     { label: "I'tidal — standing again", head: 1.55, lean: 0,   hands: 'side' },
  prostrate:  { label: 'Sujud — prostration',     head: 0.25, lean: 0,    hands: 'floor' },
  sitting:    { label: 'Julus — sitting',         head: 0.85, lean: 0,    hands: 'thighs' },
  salam:      { label: 'Taslim — turning to greet', head: 0.85, lean: 0,  hands: 'thighs' },
};

const step = (posture, title, arabic, translit, meaning, opts = {}) =>
  ({ posture, title, arabic, translit, meaning, seconds: 6, ...opts });

/** One rak'ah, in order. `firstRakahOnly` items are skipped after rak'ah 1. */
export const RAKAH_STEPS = [
  step('standing', 'Takbirat al-Ihram',
    'ٱللَّهُ أَكْبَر', 'Allāhu akbar', 'God is greater.',
    { seconds: 4, note: 'Raise both hands to shoulder or ear level, then fold them.' }),

  step('standing', 'Opening supplication',
    'سُبْحَانَكَ ٱللَّهُمَّ وَبِحَمْدِكَ، وَتَبَارَكَ ٱسْمُكَ، وَتَعَالَىٰ جَدُّكَ، وَلَا إِلَٰهَ غَيْرُكَ',
    'Subḥānaka llāhumma wa-biḥamdik, wa-tabāraka smuk, wa-taʿālā jadduk, wa-lā ilāha ghayruk',
    'Glory be to You, O God, and praise. Blessed is Your name, exalted is Your majesty; there is no god but You.',
    { firstRakahOnly: true, seconds: 9 }),

  step('standing', 'Seeking refuge',
    'أَعُوذُ بِٱللَّهِ مِنَ ٱلشَّيْطَٰنِ ٱلرَّجِيمِ',
    'Aʿūdhu billāhi mina sh-shayṭāni r-rajīm',
    'I seek refuge in God from the outcast devil.',
    { firstRakahOnly: true, seconds: 5 }),

  step('standing', 'Surah al-Fatihah', null, null,
    'Recite the whole of al-Fatihah — the book opens to it automatically.',
    { seconds: 26, recite: { surah: 1 } }),

  step('standing', 'A short surah', null, null,
    'Add any passage you know. Al-Ikhlas, al-Falaq and an-Nas are often the first ones learned.',
    { firstRakahOnly: false, optional: true, seconds: 16, recite: { surah: 112 } }),

  step('bowing', "Ruku'",
    'سُبْحَانَ رَبِّيَ ٱلْعَظِيمِ', 'Subḥāna rabbiya l-ʿaẓīm',
    'Glory to my Lord, the Magnificent. — said three times',
    { seconds: 9, repeat: 3 }),

  step('rising', 'Rising from bowing',
    'سَمِعَ ٱللَّهُ لِمَنْ حَمِدَهُ، رَبَّنَا وَلَكَ ٱلْحَمْدُ',
    'Samiʿa llāhu liman ḥamidah — rabbanā wa-laka l-ḥamd',
    'God hears whoever praises Him. Our Lord, to You belongs all praise.',
    { seconds: 6 }),

  step('prostrate', 'First prostration',
    'سُبْحَانَ رَبِّيَ ٱلْأَعْلَىٰ', 'Subḥāna rabbiya l-aʿlā',
    'Glory to my Lord, the Most High. — said three times',
    { seconds: 9, repeat: 3 }),

  step('sitting', 'Sitting between prostrations',
    'رَبِّ ٱغْفِرْ لِي', 'Rabbi ghfir lī', 'My Lord, forgive me.',
    { seconds: 5, repeat: 2 }),

  step('prostrate', 'Second prostration',
    'سُبْحَانَ رَبِّيَ ٱلْأَعْلَىٰ', 'Subḥāna rabbiya l-aʿlā',
    'Glory to my Lord, the Most High. — said three times',
    { seconds: 9, repeat: 3 }),
];

/** Said sitting after every second rak'ah, and at the end. */
export const TASHAHHUD = step('sitting', 'Tashahhud',
  'ٱلتَّحِيَّاتُ لِلَّهِ وَٱلصَّلَوَاتُ وَٱلطَّيِّبَاتُ، ٱلسَّلَامُ عَلَيْكَ أَيُّهَا ٱلنَّبِيُّ وَرَحْمَةُ ٱللَّهِ وَبَرَكَاتُهُ، ٱلسَّلَامُ عَلَيْنَا وَعَلَىٰ عِبَادِ ٱللَّهِ ٱلصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
  'At-taḥiyyātu lillāhi waṣ-ṣalawātu waṭ-ṭayyibāt. As-salāmu ʿalayka ayyuhā n-nabiyyu wa-raḥmatu llāhi wa-barakātuh. As-salāmu ʿalaynā wa-ʿalā ʿibādi llāhi ṣ-ṣāliḥīn. Ashhadu an lā ilāha illā llāh, wa-ashhadu anna Muḥammadan ʿabduhu wa-rasūluh.',
  'All greetings, prayers and good things are for God. Peace be upon you, O Prophet, and God\'s mercy and blessings. Peace be upon us and upon the righteous servants of God. I bear witness that there is no god but God, and that Muhammad is His servant and messenger.',
  { seconds: 22, note: 'Raise the right index finger at the testimony of faith.' });

export const SALAT_IBRAHIMIYYA = step('sitting', 'Blessings on the Prophet',
  'ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ، ٱللَّهُمَّ بَارِكْ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَىٰ إِبْرَاهِيمَ وَعَلَىٰ آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
  'Allāhumma ṣalli ʿalā Muḥammadin wa-ʿalā āli Muḥammad, kamā ṣallayta ʿalā Ibrāhīma wa-ʿalā āli Ibrāhīm, innaka ḥamīdun majīd. Allāhumma bārik ʿalā Muḥammadin wa-ʿalā āli Muḥammad, kamā bārakta ʿalā Ibrāhīma wa-ʿalā āli Ibrāhīm, innaka ḥamīdun majīd.',
  'O God, honour Muhammad and the family of Muhammad as You honoured Abraham and his family. You are truly Praiseworthy, Glorious. O God, bless Muhammad and his family as You blessed Abraham and his family. You are truly Praiseworthy, Glorious.',
  { seconds: 26, finalSittingOnly: true });

export const TASLIM = step('salam', 'Taslim',
  'ٱلسَّلَامُ عَلَيْكُمْ وَرَحْمَةُ ٱللَّهِ', 'As-salāmu ʿalaykum wa-raḥmatu llāh',
  'Peace be upon you, and God\'s mercy. — turning right, then left',
  { seconds: 7, repeat: 2 });

/** Rak'ah counts. `sunnahBefore`/`sunnahAfter` are the emphasised sunnah units. */
export const PRAYER_UNITS = {
  fajr:    { fard: 2, sunnahBefore: 2, sunnahAfter: 0, aloud: true },
  dhuhr:   { fard: 4, sunnahBefore: 4, sunnahAfter: 2, aloud: false },
  asr:     { fard: 4, sunnahBefore: 0, sunnahAfter: 0, aloud: false },
  maghrib: { fard: 3, sunnahBefore: 0, sunnahAfter: 2, aloud: true },
  isha:    { fard: 4, sunnahBefore: 0, sunnahAfter: 2, aloud: true, witr: 3 },
  jumuah:  { fard: 2, sunnahBefore: 4, sunnahAfter: 2, aloud: true },
};

/**
 * Expand a prayer into the full ordered sequence of guided steps.
 * @param {string} prayer key of PRAYER_UNITS
 * @param {number} [rakahs] override the unit count (e.g. sunnah or witr)
 */
export function buildSequence(prayer, rakahs) {
  const units = PRAYER_UNITS[prayer] || PRAYER_UNITS.dhuhr;
  const total = rakahs || units.fard;
  const out = [];
  for (let r = 1; r <= total; r++) {
    out.push({ marker: 'rakah', rakah: r, total });
    for (const s of RAKAH_STEPS) {
      if (s.firstRakahOnly && r > 1) continue;
      if (s.recite?.surah === 112 && r > 2) continue; // extra surah only in the first two
      out.push({ ...s, rakah: r });
    }
    const isFinal = r === total;
    if (r % 2 === 0 || isFinal) {
      out.push({ ...TASHAHHUD, rakah: r, partial: !isFinal });
      if (isFinal) {
        out.push({ ...SALAT_IBRAHIMIYYA, rakah: r });
        out.push({ ...TASLIM, rakah: r });
      }
    }
  }
  return out;
}

/** Wudu, step by step. */
export const WUDU_STEPS = [
  { title: 'Intention', detail: 'Intend in your heart to purify yourself for prayer. Nothing is said aloud.',
    arabic: 'بِسْمِ ٱللَّهِ', translit: 'Bismillāh', repeat: 1, part: 'heart' },
  { title: 'Hands', detail: 'Wash both hands up to the wrists, between the fingers.', repeat: 3, part: 'hands' },
  { title: 'Mouth', detail: 'Rinse the mouth, swilling the water around.', repeat: 3, part: 'mouth' },
  { title: 'Nose', detail: 'Draw water into the nose and blow it out with the left hand.', repeat: 3, part: 'nose' },
  { title: 'Face', detail: 'Wash the whole face, from hairline to chin, ear to ear.', repeat: 3, part: 'face' },
  { title: 'Right arm', detail: 'Wash the right arm from fingertips to just past the elbow.', repeat: 3, part: 'armR' },
  { title: 'Left arm', detail: 'Then the left arm, the same way.', repeat: 3, part: 'armL' },
  { title: 'Head', detail: 'Wipe the head once with wet hands, front to back and back again.', repeat: 1, part: 'head' },
  { title: 'Ears', detail: 'Wipe inside the ears with the index fingers, behind them with the thumbs.', repeat: 1, part: 'ears' },
  { title: 'Right foot', detail: 'Wash the right foot to the ankle, between the toes.', repeat: 3, part: 'footR' },
  { title: 'Left foot', detail: 'Then the left foot, the same way.', repeat: 3, part: 'footL' },
  { title: 'Closing words',
    detail: 'Say the testimony of faith after finishing.',
    arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    translit: 'Ashhadu an lā ilāha illā llāhu waḥdahu lā sharīka lah, wa-ashhadu anna Muḥammadan ʿabduhu wa-rasūluh',
    repeat: 1, part: 'done' },
];

/** Dhikr said after the obligatory prayer. */
export const AFTER_SALAH = [
  { arabic: 'أَسْتَغْفِرُ ٱللَّهَ', translit: 'Astaghfirullāh', meaning: 'I seek God\'s forgiveness.', count: 3 },
  { arabic: 'ٱللَّهُمَّ أَنْتَ ٱلسَّلَامُ وَمِنْكَ ٱلسَّلَامُ، تَبَارَكْتَ يَا ذَا ٱلْجَلَالِ وَٱلْإِكْرَامِ',
    translit: 'Allāhumma anta s-salām wa-minka s-salām, tabārakta yā dhā l-jalāli wal-ikrām',
    meaning: 'O God, You are Peace and from You comes peace. Blessed are You, Lord of majesty and generosity.', count: 1 },
  { arabic: 'سُبْحَانَ ٱللَّهِ', translit: 'Subḥānallāh', meaning: 'Glory be to God.', count: 33 },
  { arabic: 'ٱلْحَمْدُ لِلَّهِ', translit: 'Alḥamdulillāh', meaning: 'All praise belongs to God.', count: 33 },
  { arabic: 'ٱللَّهُ أَكْبَرُ', translit: 'Allāhu akbar', meaning: 'God is greater.', count: 33 },
  { arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ ٱلْمُلْكُ وَلَهُ ٱلْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
    translit: 'Lā ilāha illā llāhu waḥdahu lā sharīka lah, lahu l-mulku wa-lahu l-ḥamd, wa-huwa ʿalā kulli shay\'in qadīr',
    meaning: 'There is no god but God alone, without partner. His is the dominion and the praise, and He is able to do all things.', count: 1 },
  { arabic: 'آيَةُ ٱلْكُرْسِيِّ', translit: 'Ayat al-Kursi (2:255)', meaning: 'Recited once after each prayer.', count: 1, ref: '2:255' },
];

/** Tasbih presets for the bead string. */
export const TASBIH_PRESETS = [
  { name: 'Subhanallah', arabic: 'سُبْحَانَ ٱللَّهِ', target: 33 },
  { name: 'Alhamdulillah', arabic: 'ٱلْحَمْدُ لِلَّهِ', target: 33 },
  { name: 'Allahu Akbar', arabic: 'ٱللَّهُ أَكْبَرُ', target: 34 },
  { name: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا ٱللَّهُ', target: 100 },
  { name: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ ٱللَّهَ', target: 100 },
  { name: 'Salawat', arabic: 'ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', target: 100 },
  { name: 'Free count', arabic: 'ذِكْر', target: 0 },
];
