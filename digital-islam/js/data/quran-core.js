/**
 * Built-in Qur'an text: the surahs and passages most used in daily prayer,
 * so the app is fully usable with no network at all.
 *
 * The English lines are plain-language renderings of the meaning, not a
 * translation of the Qur'an in the technical sense — the Arabic alone is the
 * Qur'an. When the device is online, `quran.js` prefers verified text and
 * translations fetched from the Qur'an API and only falls back to this file.
 */

const A = (arabic, translit, meaning) => ({ arabic, translit, meaning });

export const CORE_TEXT = {
  1: [
    A('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      'Bismi llāhi r-raḥmāni r-raḥīm',
      'In the name of God, the Most Compassionate, the Most Merciful.'),
    A('ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      'Al-ḥamdu lillāhi rabbi l-ʿālamīn',
      'All praise belongs to God, Lord of all the worlds.'),
    A('ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      'Ar-raḥmāni r-raḥīm',
      'The Most Compassionate, the Most Merciful.'),
    A('مَٰلِكِ يَوْمِ ٱلدِّينِ',
      'Māliki yawmi d-dīn',
      'Master of the Day of Judgement.'),
    A('إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
      'Iyyāka naʿbudu wa-iyyāka nastaʿīn',
      'You alone we worship, and You alone we ask for help.'),
    A('ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
      'Ihdinā ṣ-ṣirāṭa l-mustaqīm',
      'Guide us along the straight path.'),
    A('صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
      'Ṣirāṭa lladhīna anʿamta ʿalayhim ghayri l-maghḍūbi ʿalayhim wa-lā ḍ-ḍāllīn',
      'The path of those You have blessed — not those who earned anger, nor those who went astray.'),
  ],
  103: [
    A('وَٱلْعَصْرِ', 'Wal-ʿaṣr', 'By the passing of time.'),
    A('إِنَّ ٱلْإِنسَٰنَ لَفِى خُسْرٍ', 'Inna l-insāna la-fī khusr',
      'Humanity is truly at a loss.'),
    A('إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ',
      'Illā lladhīna āmanū wa-ʿamilū ṣ-ṣāliḥāti wa-tawāṣaw bil-ḥaqqi wa-tawāṣaw biṣ-ṣabr',
      'Except those who believe, do good, and urge one another to truth and to patience.'),
  ],
  105: [
    A('أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَٰبِ ٱلْفِيلِ', 'Alam tara kayfa faʿala rabbuka bi-aṣḥābi l-fīl',
      'Have you not seen how your Lord dealt with the people of the elephant?'),
    A('أَلَمْ يَجْعَلْ كَيْدَهُمْ فِى تَضْلِيلٍ', 'Alam yajʿal kaydahum fī taḍlīl',
      'Did He not turn their scheme astray?'),
    A('وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ', 'Wa-arsala ʿalayhim ṭayran abābīl',
      'And He sent against them flocks of birds,'),
    A('تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ', 'Tarmīhim bi-ḥijāratin min sijjīl',
      'pelting them with stones of hard clay,'),
    A('فَجَعَلَهُمْ كَعَصْفٍ مَّأْكُولٍۭ', 'Fa-jaʿalahum ka-ʿaṣfin ma\'kūl',
      'leaving them like chewed-up straw.'),
  ],
  106: [
    A('لِإِيلَٰفِ قُرَيْشٍ', 'Li-īlāfi Quraysh', 'For the security of Quraysh —'),
    A('إِۦلَٰفِهِمْ رِحْلَةَ ٱلشِّتَآءِ وَٱلصَّيْفِ', 'Īlāfihim riḥlata sh-shitā\'i waṣ-ṣayf',
      'their security in the winter and summer journeys —'),
    A('فَلْيَعْبُدُوا۟ رَبَّ هَٰذَا ٱلْبَيْتِ', 'Fal-yaʿbudū rabba hādhā l-bayt',
      'let them worship the Lord of this House,'),
    A('ٱلَّذِىٓ أَطْعَمَهُم مِّن جُوعٍ وَءَامَنَهُم مِّنْ خَوْفٍۭ', 'Alladhī aṭʿamahum min jūʿin wa-āmanahum min khawf',
      'who fed them against hunger and made them safe from fear.'),
  ],
  107: [
    A('أَرَءَيْتَ ٱلَّذِى يُكَذِّبُ بِٱلدِّينِ', 'A-ra\'ayta lladhī yukadhdhibu bid-dīn',
      'Have you seen the one who denies the Judgement?'),
    A('فَذَٰلِكَ ٱلَّذِى يَدُعُّ ٱلْيَتِيمَ', 'Fa-dhālika lladhī yaduʿʿu l-yatīm',
      'That is the one who pushes the orphan away'),
    A('وَلَا يَحُضُّ عَلَىٰ طَعَامِ ٱلْمِسْكِينِ', 'Wa-lā yaḥuḍḍu ʿalā ṭaʿāmi l-miskīn',
      'and does not urge the feeding of the poor.'),
    A('فَوَيْلٌ لِّلْمُصَلِّينَ', 'Fa-waylun lil-muṣallīn', 'So woe to those who pray'),
    A('ٱلَّذِينَ هُمْ عَن صَلَاتِهِمْ سَاهُونَ', 'Alladhīna hum ʿan ṣalātihim sāhūn',
      'but are heedless of their prayer;'),
    A('ٱلَّذِينَ هُمْ يُرَآءُونَ', 'Alladhīna hum yurā\'ūn', 'those who only make a show of it'),
    A('وَيَمْنَعُونَ ٱلْمَاعُونَ', 'Wa-yamnaʿūna l-māʿūn', 'and withhold even small kindnesses.'),
  ],
  108: [
    A('إِنَّآ أَعْطَيْنَٰكَ ٱلْكَوْثَرَ', 'Innā aʿṭaynāka l-kawthar',
      'We have surely granted you abundance.'),
    A('فَصَلِّ لِرَبِّكَ وَٱنْحَرْ', 'Fa-ṣalli li-rabbika wanḥar',
      'So pray to your Lord and sacrifice.'),
    A('إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ', 'Inna shāni\'aka huwa l-abtar',
      'It is the one who hates you who is cut off.'),
  ],
  109: [
    A('قُلْ يَٰٓأَيُّهَا ٱلْكَٰفِرُونَ', 'Qul yā-ayyuhā l-kāfirūn', 'Say: O you who disbelieve,'),
    A('لَآ أَعْبُدُ مَا تَعْبُدُونَ', 'Lā aʿbudu mā taʿbudūn', 'I do not worship what you worship,'),
    A('وَلَآ أَنتُمْ عَٰبِدُونَ مَآ أَعْبُدُ', 'Wa-lā antum ʿābidūna mā aʿbud',
      'nor do you worship what I worship.'),
    A('وَلَآ أَنَا۠ عَابِدٌ مَّا عَبَدتُّمْ', 'Wa-lā ana ʿābidun mā ʿabadtum',
      'I will not worship what you have worshipped,'),
    A('وَلَآ أَنتُمْ عَٰبِدُونَ مَآ أَعْبُدُ', 'Wa-lā antum ʿābidūna mā aʿbud',
      'nor will you worship what I worship.'),
    A('لَكُمْ دِينُكُمْ وَلِىَ دِينِ', 'Lakum dīnukum wa-liya dīn',
      'You have your way, and I have mine.'),
  ],
  110: [
    A('إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ', 'Idhā jā\'a naṣru llāhi wal-fatḥ',
      'When the help of God comes, and the victory,'),
    A('وَرَأَيْتَ ٱلنَّاسَ يَدْخُلُونَ فِى دِينِ ٱللَّهِ أَفْوَاجًا', 'Wa-ra\'ayta n-nāsa yadkhulūna fī dīni llāhi afwājā',
      'and you see people entering God\'s religion in crowds,'),
    A('فَسَبِّحْ بِحَمْدِ رَبِّكَ وَٱسْتَغْفِرْهُ إِنَّهُۥ كَانَ تَوَّابًۢا', 'Fa-sabbiḥ bi-ḥamdi rabbika wastaghfirh, innahu kāna tawwābā',
      'then glorify your Lord with praise and ask His forgiveness. He is ever accepting of repentance.'),
  ],
  112: [
    A('قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'Qul huwa llāhu aḥad', 'Say: He is God, One.'),
    A('ٱللَّهُ ٱلصَّمَدُ', 'Allāhu ṣ-ṣamad', 'God, the Eternal Refuge.'),
    A('لَمْ يَلِدْ وَلَمْ يُولَدْ', 'Lam yalid wa-lam yūlad', 'He does not beget, nor was He begotten,'),
    A('وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', 'Wa-lam yakun lahu kufuwan aḥad',
      'and there is none comparable to Him.'),
  ],
  113: [
    A('قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', 'Qul aʿūdhu bi-rabbi l-falaq',
      'Say: I seek refuge in the Lord of the daybreak,'),
    A('مِن شَرِّ مَا خَلَقَ', 'Min sharri mā khalaq', 'from the harm of what He created,'),
    A('وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', 'Wa-min sharri ghāsiqin idhā waqab',
      'from the harm of the darkness when it settles,'),
    A('وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ', 'Wa-min sharri n-naffāthāti fī l-ʿuqad',
      'from the harm of those who blow on knots,'),
    A('وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', 'Wa-min sharri ḥāsidin idhā ḥasad',
      'and from the harm of an envier when he envies.'),
  ],
  114: [
    A('قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ', 'Qul aʿūdhu bi-rabbi n-nās',
      'Say: I seek refuge in the Lord of humankind,'),
    A('مَلِكِ ٱلنَّاسِ', 'Maliki n-nās', 'the King of humankind,'),
    A('إِلَٰهِ ٱلنَّاسِ', 'Ilāhi n-nās', 'the God of humankind,'),
    A('مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ', 'Min sharri l-waswāsi l-khannās',
      'from the harm of the sneaking whisperer,'),
    A('ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ', 'Alladhī yuwaswisu fī ṣudūri n-nās',
      'who whispers in the hearts of people,'),
    A('مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ', 'Mina l-jinnati wan-nās', 'from among jinn and people.'),
  ],
};

/** Individual celebrated passages, addressable as surah:ayah. */
export const CORE_AYAHS = {
  '2:255': A(
    'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ لَا تَأْخُذُهُۥ سِنَةٌ وَلَا نَوْمٌ لَّهُۥ مَا فِى ٱلسَّمَٰوَٰتِ وَمَا فِى ٱلْأَرْضِ مَن ذَا ٱلَّذِى يَشْفَعُ عِندَهُۥٓ إِلَّا بِإِذْنِهِۦ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يُحِيطُونَ بِشَىْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَآءَ وَسِعَ كُرْسِيُّهُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ وَلَا يَـُٔودُهُۥ حِفْظُهُمَا وَهُوَ ٱلْعَلِىُّ ٱلْعَظِيمُ',
    'Allāhu lā ilāha illā huwa l-ḥayyu l-qayyūm…',
    'God — there is no god but He, the Ever-Living, the Sustainer of all. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and the earth. Who could intercede with Him except by His permission? He knows what lies before them and behind them, while they grasp nothing of His knowledge except what He wills. His seat encompasses the heavens and the earth, and preserving them does not tire Him. He is the Most High, the Magnificent.',
  ),
};

export const CORE_SURAH_NUMBERS = Object.keys(CORE_TEXT).map(Number);
