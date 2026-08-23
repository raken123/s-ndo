/**
 * Index of all 114 surahs: [number, latin name, arabic name, ayah count, place].
 * Ayah counts follow the Kufan numbering used by the standard Uthmani mushaf
 * (total 6236), which is what the recitation and text APIs also use.
 */
const RAW = [
  [1, 'Al-Fatihah', 'الفاتحة', 7, 'Meccan', 'The Opening'],
  [2, 'Al-Baqarah', 'البقرة', 286, 'Medinan', 'The Cow'],
  [3, "Ali 'Imran", 'آل عمران', 200, 'Medinan', 'Family of Imran'],
  [4, 'An-Nisa', 'النساء', 176, 'Medinan', 'The Women'],
  [5, "Al-Ma'idah", 'المائدة', 120, 'Medinan', 'The Table Spread'],
  [6, "Al-An'am", 'الأنعام', 165, 'Meccan', 'The Cattle'],
  [7, "Al-A'raf", 'الأعراف', 206, 'Meccan', 'The Heights'],
  [8, 'Al-Anfal', 'الأنفال', 75, 'Medinan', 'The Spoils of War'],
  [9, 'At-Tawbah', 'التوبة', 129, 'Medinan', 'The Repentance'],
  [10, 'Yunus', 'يونس', 109, 'Meccan', 'Jonah'],
  [11, 'Hud', 'هود', 123, 'Meccan', 'Hud'],
  [12, 'Yusuf', 'يوسف', 111, 'Meccan', 'Joseph'],
  [13, "Ar-Ra'd", 'الرعد', 43, 'Medinan', 'The Thunder'],
  [14, 'Ibrahim', 'ابراهيم', 52, 'Meccan', 'Abraham'],
  [15, 'Al-Hijr', 'الحجر', 99, 'Meccan', 'The Rocky Tract'],
  [16, 'An-Nahl', 'النحل', 128, 'Meccan', 'The Bee'],
  [17, 'Al-Isra', 'الإسراء', 111, 'Meccan', 'The Night Journey'],
  [18, 'Al-Kahf', 'الكهف', 110, 'Meccan', 'The Cave'],
  [19, 'Maryam', 'مريم', 98, 'Meccan', 'Mary'],
  [20, 'Ta-Ha', 'طه', 135, 'Meccan', 'Ta-Ha'],
  [21, 'Al-Anbiya', 'الأنبياء', 112, 'Meccan', 'The Prophets'],
  [22, 'Al-Hajj', 'الحج', 78, 'Medinan', 'The Pilgrimage'],
  [23, "Al-Mu'minun", 'المؤمنون', 118, 'Meccan', 'The Believers'],
  [24, 'An-Nur', 'النور', 64, 'Medinan', 'The Light'],
  [25, 'Al-Furqan', 'الفرقان', 77, 'Meccan', 'The Criterion'],
  [26, "Ash-Shu'ara", 'الشعراء', 227, 'Meccan', 'The Poets'],
  [27, 'An-Naml', 'النمل', 93, 'Meccan', 'The Ant'],
  [28, 'Al-Qasas', 'القصص', 88, 'Meccan', 'The Stories'],
  [29, 'Al-Ankabut', 'العنكبوت', 69, 'Meccan', 'The Spider'],
  [30, 'Ar-Rum', 'الروم', 60, 'Meccan', 'The Romans'],
  [31, 'Luqman', 'لقمان', 34, 'Meccan', 'Luqman'],
  [32, 'As-Sajdah', 'السجدة', 30, 'Meccan', 'The Prostration'],
  [33, 'Al-Ahzab', 'الأحزاب', 73, 'Medinan', 'The Combined Forces'],
  [34, 'Saba', 'سبإ', 54, 'Meccan', 'Sheba'],
  [35, 'Fatir', 'فاطر', 45, 'Meccan', 'Originator'],
  [36, 'Ya-Sin', 'يس', 83, 'Meccan', 'Ya Sin'],
  [37, 'As-Saffat', 'الصافات', 182, 'Meccan', 'Those Who Set The Ranks'],
  [38, 'Sad', 'ص', 88, 'Meccan', 'The Letter Sad'],
  [39, 'Az-Zumar', 'الزمر', 75, 'Meccan', 'The Troops'],
  [40, 'Ghafir', 'غافر', 85, 'Meccan', 'The Forgiver'],
  [41, 'Fussilat', 'فصلت', 54, 'Meccan', 'Explained in Detail'],
  [42, 'Ash-Shura', 'الشورى', 53, 'Meccan', 'The Consultation'],
  [43, 'Az-Zukhruf', 'الزخرف', 89, 'Meccan', 'The Ornaments of Gold'],
  [44, 'Ad-Dukhan', 'الدخان', 59, 'Meccan', 'The Smoke'],
  [45, 'Al-Jathiyah', 'الجاثية', 37, 'Meccan', 'The Crouching'],
  [46, 'Al-Ahqaf', 'الأحقاف', 35, 'Meccan', 'The Wind-Curved Sandhills'],
  [47, 'Muhammad', 'محمد', 38, 'Medinan', 'Muhammad'],
  [48, 'Al-Fath', 'الفتح', 29, 'Medinan', 'The Victory'],
  [49, 'Al-Hujurat', 'الحجرات', 18, 'Medinan', 'The Rooms'],
  [50, 'Qaf', 'ق', 45, 'Meccan', 'The Letter Qaf'],
  [51, 'Adh-Dhariyat', 'الذاريات', 60, 'Meccan', 'The Winnowing Winds'],
  [52, 'At-Tur', 'الطور', 49, 'Meccan', 'The Mount'],
  [53, 'An-Najm', 'النجم', 62, 'Meccan', 'The Star'],
  [54, 'Al-Qamar', 'القمر', 55, 'Meccan', 'The Moon'],
  [55, 'Ar-Rahman', 'الرحمن', 78, 'Medinan', 'The Beneficent'],
  [56, "Al-Waqi'ah", 'الواقعة', 96, 'Meccan', 'The Inevitable'],
  [57, 'Al-Hadid', 'الحديد', 29, 'Medinan', 'The Iron'],
  [58, 'Al-Mujadila', 'المجادلة', 22, 'Medinan', 'The Pleading Woman'],
  [59, 'Al-Hashr', 'الحشر', 24, 'Medinan', 'The Exile'],
  [60, 'Al-Mumtahanah', 'الممتحنة', 13, 'Medinan', 'She That Is To Be Examined'],
  [61, 'As-Saff', 'الصف', 14, 'Medinan', 'The Ranks'],
  [62, "Al-Jumu'ah", 'الجمعة', 11, 'Medinan', 'The Congregation, Friday'],
  [63, 'Al-Munafiqun', 'المنافقون', 11, 'Medinan', 'The Hypocrites'],
  [64, 'At-Taghabun', 'التغابن', 18, 'Medinan', 'The Mutual Disillusion'],
  [65, 'At-Talaq', 'الطلاق', 12, 'Medinan', 'The Divorce'],
  [66, 'At-Tahrim', 'التحريم', 12, 'Medinan', 'The Prohibition'],
  [67, 'Al-Mulk', 'الملك', 30, 'Meccan', 'The Sovereignty'],
  [68, 'Al-Qalam', 'القلم', 52, 'Meccan', 'The Pen'],
  [69, 'Al-Haqqah', 'الحاقة', 52, 'Meccan', 'The Reality'],
  [70, "Al-Ma'arij", 'المعارج', 44, 'Meccan', 'The Ascending Stairways'],
  [71, 'Nuh', 'نوح', 28, 'Meccan', 'Noah'],
  [72, 'Al-Jinn', 'الجن', 28, 'Meccan', 'The Jinn'],
  [73, 'Al-Muzzammil', 'المزمل', 20, 'Meccan', 'The Enshrouded One'],
  [74, 'Al-Muddaththir', 'المدثر', 56, 'Meccan', 'The Cloaked One'],
  [75, 'Al-Qiyamah', 'القيامة', 40, 'Meccan', 'The Resurrection'],
  [76, 'Al-Insan', 'الانسان', 31, 'Medinan', 'Man'],
  [77, 'Al-Mursalat', 'المرسلات', 50, 'Meccan', 'The Emissaries'],
  [78, 'An-Naba', 'النبإ', 40, 'Meccan', 'The Tidings'],
  [79, "An-Nazi'at", 'النازعات', 46, 'Meccan', 'Those Who Drag Forth'],
  [80, 'Abasa', 'عبس', 42, 'Meccan', 'He Frowned'],
  [81, 'At-Takwir', 'التكوير', 29, 'Meccan', 'The Overthrowing'],
  [82, 'Al-Infitar', 'الإنفطار', 19, 'Meccan', 'The Cleaving'],
  [83, 'Al-Mutaffifin', 'المطففين', 36, 'Meccan', 'The Defrauding'],
  [84, 'Al-Inshiqaq', 'الإنشقاق', 25, 'Meccan', 'The Sundering'],
  [85, 'Al-Buruj', 'البروج', 22, 'Meccan', 'The Mansions of the Stars'],
  [86, 'At-Tariq', 'الطارق', 17, 'Meccan', 'The Nightcomer'],
  [87, "Al-A'la", 'الأعلى', 19, 'Meccan', 'The Most High'],
  [88, 'Al-Ghashiyah', 'الغاشية', 26, 'Meccan', 'The Overwhelming'],
  [89, 'Al-Fajr', 'الفجر', 30, 'Meccan', 'The Dawn'],
  [90, 'Al-Balad', 'البلد', 20, 'Meccan', 'The City'],
  [91, 'Ash-Shams', 'الشمس', 15, 'Meccan', 'The Sun'],
  [92, 'Al-Layl', 'الليل', 21, 'Meccan', 'The Night'],
  [93, 'Ad-Duha', 'الضحى', 11, 'Meccan', 'The Morning Hours'],
  [94, 'Ash-Sharh', 'الشرح', 8, 'Meccan', 'The Relief'],
  [95, 'At-Tin', 'التين', 8, 'Meccan', 'The Fig'],
  [96, 'Al-Alaq', 'العلق', 19, 'Meccan', 'The Clot'],
  [97, 'Al-Qadr', 'القدر', 5, 'Meccan', 'The Power'],
  [98, 'Al-Bayyinah', 'البينة', 8, 'Medinan', 'The Clear Proof'],
  [99, 'Az-Zalzalah', 'الزلزلة', 8, 'Medinan', 'The Earthquake'],
  [100, 'Al-Adiyat', 'العاديات', 11, 'Meccan', 'The Courser'],
  [101, "Al-Qari'ah", 'القارعة', 11, 'Meccan', 'The Calamity'],
  [102, 'At-Takathur', 'التكاثر', 8, 'Meccan', 'The Rivalry in World Increase'],
  [103, 'Al-Asr', 'العصر', 3, 'Meccan', 'The Declining Day'],
  [104, 'Al-Humazah', 'الهمزة', 9, 'Meccan', 'The Traducer'],
  [105, 'Al-Fil', 'الفيل', 5, 'Meccan', 'The Elephant'],
  [106, 'Quraysh', 'قريش', 4, 'Meccan', 'Quraysh'],
  [107, "Al-Ma'un", 'الماعون', 7, 'Meccan', 'The Small Kindnesses'],
  [108, 'Al-Kawthar', 'الكوثر', 3, 'Meccan', 'The Abundance'],
  [109, 'Al-Kafirun', 'الكافرون', 6, 'Meccan', 'The Disbelievers'],
  [110, 'An-Nasr', 'النصر', 3, 'Medinan', 'The Divine Support'],
  [111, 'Al-Masad', 'المسد', 5, 'Meccan', 'The Palm Fibre'],
  [112, 'Al-Ikhlas', 'الإخلاص', 4, 'Meccan', 'The Sincerity'],
  [113, 'Al-Falaq', 'الفلق', 5, 'Meccan', 'The Daybreak'],
  [114, 'An-Nas', 'الناس', 6, 'Meccan', 'Mankind'],
];

export const SURAHS = RAW.map(([number, name, arabic, ayahs, place, meaning]) => ({
  number, name, arabic, ayahs, place, meaning,
}));

export const TOTAL_AYAHS = SURAHS.reduce((sum, s) => sum + s.ayahs, 0);

export function surah(number) {
  return SURAHS[number - 1] || null;
}

/** Juz' (para) start references, 1-30. */
export const JUZ_STARTS = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111],
  [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75],
  [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32],
  [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
];

/** Which juz' a given ayah falls in. */
export function juzOf(surahNo, ayahNo) {
  let juz = 1;
  JUZ_STARTS.forEach(([s, a], i) => {
    if (surahNo > s || (surahNo === s && ayahNo >= a)) juz = i + 1;
  });
  return juz;
}
