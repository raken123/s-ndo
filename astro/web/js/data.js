// Astro – himlakroppar, fakta och frågor.
// Siffror från NASA:s faktablad (nssdc.gsfc.nasa.gov/planetary/factsheet),
// NASA Science, ESA och Minor Planet Center (månantal per mars 2026).

// Scenenheter: solsystemet är komprimerat så att en resa tar sekunder i stället för år.
// `orbit` = avstånd från solen i scenenheter, `angle` = position runt solen i grader,
// `au` = verkligt medelavstånd från solen i astronomiska enheter (1 AU ≈ 149,6 miljoner km).

export const AU_KM = 149_597_871;
export const MOON_DIST_KM = 384_400;
export const MOON_SCENE_DIST = 220;

export const BODIES = [
  {
    id: 'sun', kind: 'star', orbit: 0, angle: 0, au: 0, radius: 110, color: '#ffcc55',
    visitable: false,
    name: { sv: 'Solen', en: 'The Sun' },
    type: { sv: 'Stjärna', en: 'Star' },
    facts: {
      sv: [
        'Solen innehåller 99,8 % av all massa i solsystemet.',
        'Ungefär 1,3 miljoner jordklot skulle få plats i solen.',
        'Ytan är cirka 5 500 °C och kärnan omkring 15 miljoner °C.',
        'Ljuset från solen tar ungefär 8 minuter och 20 sekunder till jorden.',
        'Den 24 december 2024 flög NASA:s Parker Solar Probe bara 6,1 miljoner km från solens yta i 692 000 km/h – det snabbaste människan någonsin byggt.',
      ],
      en: [
        'The Sun holds 99.8% of all the mass in the solar system.',
        'About 1.3 million Earths would fit inside the Sun.',
        'The surface is about 5,500 °C and the core around 15 million °C.',
        'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
        'On 24 December 2024 NASA\'s Parker Solar Probe flew just 6.1 million km from the Sun\'s surface at 692,000 km/h – the fastest object humans have ever built.',
      ],
    },
  },
  {
    id: 'earth', kind: 'planet', orbit: 2250, angle: 0, au: 1.0, radius: 8, color: '#3a7bd5',
    visitable: true, unlockedBy: null,
    name: { sv: 'Jorden', en: 'Earth' },
    type: { sv: 'Klotplanet – vårt hem', en: 'Rocky planet – our home' },
    realTrip: { sv: 'Startplats', en: 'Launch site' },
    facts: {
      sv: [
        'Jorden är den enda plats vi vet har liv.',
        'Rymdstationen ISS flyger cirka 400 km upp och varvar jorden ungefär 16 gånger per dygn i 28 000 km/h.',
        'Christer Fuglesang blev den första svensken i rymden i december 2006. Marcus Wandt flög till ISS i januari 2024.',
        'Esrange utanför Kiruna är en av Europas viktigaste platser för att skjuta upp raketer och ballonger.',
        'Ungefär 71 % av jordens yta är täckt av vatten.',
      ],
      en: [
        'Earth is the only place we know of that has life.',
        'The International Space Station flies about 400 km up and circles Earth about 16 times a day at 28,000 km/h.',
        'Christer Fuglesang became the first Swede in space in December 2006. Marcus Wandt flew to the ISS in January 2024.',
        'Esrange near Kiruna, Sweden, is one of Europe\'s most important sites for launching rockets and balloons.',
        'About 71% of Earth\'s surface is covered by water.',
      ],
    },
  },
  {
    id: 'moon', kind: 'moon', parent: 'earth', au: 1.0, radius: 2.4, color: '#bdbdbd',
    visitable: true, landable: true, unlockedBy: 'earth', mission: 1,
    name: { sv: 'Månen', en: 'The Moon' },
    type: { sv: 'Jordens måne', en: 'Earth\'s moon' },
    realTrip: { sv: 'Apollo 11 tog drygt 3 dagar', en: 'Apollo 11 took just over 3 days' },
    facts: {
      sv: [
        'Månen ligger i genomsnitt 384 400 km bort. Ljuset behöver 1,3 sekunder för att komma hit.',
        'Tyngdkraften är bara 1/6 av jordens – du skulle kunna hoppa sex gånger så högt!',
        'Neil Armstrong och Buzz Aldrin landade med Apollo 11 den 20 juli 1969. Totalt har 12 människor gått på månen.',
        'På dagen kan det bli över 120 °C och på natten under –130 °C, eftersom månen saknar atmosfär.',
        'I april 2026 flög Artemis II med fyra astronauter runt månen – människor har aldrig varit längre från jorden.',
        'Månen glider bort från jorden med cirka 3,8 cm per år.',
      ],
      en: [
        'The Moon is on average 384,400 km away. Light needs 1.3 seconds to get here.',
        'Gravity is only 1/6 of Earth\'s – you could jump six times as high!',
        'Neil Armstrong and Buzz Aldrin landed with Apollo 11 on 20 July 1969. In total 12 people have walked on the Moon.',
        'Days can reach over 120 °C and nights drop below –130 °C, because the Moon has no atmosphere.',
        'In April 2026 Artemis II flew four astronauts around the Moon – humans have never been farther from Earth.',
        'The Moon drifts away from Earth by about 3.8 cm per year.',
      ],
    },
    quiz: {
      sv: { q: 'Hur många människor har gått på månen?', options: ['2', '12', '48'], answer: 1 },
      en: { q: 'How many people have walked on the Moon?', options: ['2', '12', '48'], answer: 1 },
    },
  },
  {
    id: 'mars', kind: 'planet', orbit: 3100, angle: -38, au: 1.524, radius: 4.8, color: '#c1440e',
    visitable: true, landable: true, unlockedBy: 'moon',
    name: { sv: 'Mars', en: 'Mars' },
    type: { sv: 'Klotplanet – den röda planeten', en: 'Rocky planet – the red planet' },
    realTrip: { sv: 'Cirka 7 månader med dagens raketer', en: 'About 7 months with today\'s rockets' },
    facts: {
      sv: [
        'Mars är röd för att marken innehåller järnoxid – alltså rost.',
        'Olympus Mons är solsystemets största vulkan, cirka 22 km hög – två och en halv gånger så hög som Mount Everest.',
        'Ett dygn på Mars är 24 timmar och 37 minuter, men ett år är 687 jorddygn.',
        'Mars har två små månar: Phobos och Deimos.',
        'Rovern Perseverance landade 2021 och helikoptern Ingenuity gjorde 72 flygningar – de första på en annan planet.',
        'Medeltemperaturen är ungefär –65 °C och luften består till 95 % av koldioxid.',
      ],
      en: [
        'Mars is red because its soil contains iron oxide – rust.',
        'Olympus Mons is the largest volcano in the solar system, about 22 km high – two and a half times Mount Everest.',
        'A day on Mars is 24 hours and 37 minutes, but a year is 687 Earth days.',
        'Mars has two small moons: Phobos and Deimos.',
        'The Perseverance rover landed in 2021 and the Ingenuity helicopter made 72 flights – the first on another planet.',
        'The average temperature is about –65 °C and the air is 95% carbon dioxide.',
      ],
    },
    quiz: {
      sv: { q: 'Varför är Mars röd?', options: ['Den är varm', 'Rost (järnoxid) i marken', 'Röda växter'], answer: 1 },
      en: { q: 'Why is Mars red?', options: ['It is hot', 'Rust (iron oxide) in the soil', 'Red plants'], answer: 1 },
    },
  },
  {
    id: 'venus', kind: 'planet', orbit: 1550, angle: 52, au: 0.723, radius: 7.6, color: '#e6c27a',
    visitable: true, unlockedBy: 'moon',
    name: { sv: 'Venus', en: 'Venus' },
    type: { sv: 'Klotplanet – jordens heta tvilling', en: 'Rocky planet – Earth\'s hot twin' },
    realTrip: { sv: 'Cirka 4–5 månader', en: 'About 4–5 months' },
    facts: {
      sv: [
        'Venus är solsystemets hetaste planet: cirka 465 °C – varmt nog att smälta bly.',
        'Den tjocka koldioxidatmosfären fångar värmen. Trycket är 92 gånger högre än på jorden.',
        'Venus snurrar baklänges. Där går solen upp i väster!',
        'Ett dygn på Venus (243 jorddygn) är längre än ett år (225 jorddygn).',
        'Sovjetiska Venera 7 blev 1970 den första farkosten att landa och skicka data från en annan planet.',
        'Venus är den ljusaste planeten på himlen och kallas ofta morgon- eller aftonstjärnan.',
      ],
      en: [
        'Venus is the hottest planet in the solar system: about 465 °C – hot enough to melt lead.',
        'Its thick carbon dioxide atmosphere traps heat. The pressure is 92 times higher than on Earth.',
        'Venus spins backwards. There the Sun rises in the west!',
        'A day on Venus (243 Earth days) is longer than its year (225 Earth days).',
        'The Soviet Venera 7 became the first spacecraft to land and send data from another planet in 1970.',
        'Venus is the brightest planet in the sky and is often called the morning or evening star.',
      ],
    },
    quiz: {
      sv: { q: 'Vilken planet är hetast?', options: ['Merkurius', 'Venus', 'Mars'], answer: 1 },
      en: { q: 'Which planet is the hottest?', options: ['Mercury', 'Venus', 'Mars'], answer: 1 },
    },
  },
  {
    id: 'mercury', kind: 'planet', orbit: 950, angle: 128, au: 0.387, radius: 3.4, color: '#9c9189',
    visitable: true, landable: true, unlockedBy: 'venus',
    name: { sv: 'Merkurius', en: 'Mercury' },
    type: { sv: 'Klotplanet – närmast solen', en: 'Rocky planet – closest to the Sun' },
    realTrip: { sv: 'BepiColombo har rest i 8 år och går in i omloppsbana i november 2026', en: 'BepiColombo has travelled for 8 years and enters orbit in November 2026' },
    facts: {
      sv: [
        'Merkurius är solsystemets minsta planet och närmast solen.',
        'Ett år på Merkurius är bara 88 jorddygn.',
        'Utan atmosfär svänger temperaturen från cirka 430 °C på dagen till –180 °C på natten.',
        'Trots hettan finns det is i djupa kratrar vid polerna där solen aldrig lyser.',
        'Den europeisk-japanska sonden BepiColombo ska gå in i omloppsbana runt Merkurius i november 2026.',
      ],
      en: [
        'Mercury is the smallest planet and the closest to the Sun.',
        'A year on Mercury is only 88 Earth days.',
        'With no atmosphere the temperature swings from about 430 °C in the day to –180 °C at night.',
        'Despite the heat there is ice in deep polar craters where sunlight never reaches.',
        'The European-Japanese probe BepiColombo is due to enter orbit around Mercury in November 2026.',
      ],
    },
    quiz: {
      sv: { q: 'Hur långt är ett år på Merkurius?', options: ['88 jorddygn', '365 jorddygn', '10 jorddygn'], answer: 0 },
      en: { q: 'How long is a year on Mercury?', options: ['88 Earth days', '365 Earth days', '10 Earth days'], answer: 0 },
    },
  },
  {
    id: 'jupiter', kind: 'planet', orbit: 5500, angle: 22, au: 5.203, radius: 40, color: '#d8a878',
    visitable: true, unlockedBy: 'mars',
    name: { sv: 'Jupiter', en: 'Jupiter' },
    type: { sv: 'Gasjätte – störst av alla', en: 'Gas giant – the biggest of all' },
    realTrip: { sv: 'Juno tog 5 år', en: 'Juno took 5 years' },
    facts: {
      sv: [
        'Jupiter är så stor att ungefär 1 300 jordklot skulle få plats inuti.',
        'Den stora röda fläcken är en storm som är större än hela jorden och har rasat i hundratals år.',
        'Jupiter har kortast dygn av alla planeter: under 10 timmar.',
        'Jupiter har 101 kända månar (mars 2026). Ganymedes är solsystemets största måne – större än Merkurius.',
        'Under isen på månen Europa finns ett hav. NASA:s Europa Clipper är på väg dit och kommer fram 2030.',
      ],
      en: [
        'Jupiter is so big that about 1,300 Earths would fit inside.',
        'The Great Red Spot is a storm bigger than Earth that has raged for hundreds of years.',
        'Jupiter has the shortest day of all planets: under 10 hours.',
        'Jupiter has 101 known moons (March 2026). Ganymede is the largest moon in the solar system – bigger than Mercury.',
        'There is an ocean under the ice of the moon Europa. NASA\'s Europa Clipper is on its way and arrives in 2030.',
      ],
    },
    quiz: {
      sv: { q: 'Ungefär hur många jordklot får plats i Jupiter?', options: ['13', '130', '1 300'], answer: 2 },
      en: { q: 'About how many Earths fit inside Jupiter?', options: ['13', '130', '1,300'], answer: 2 },
    },
  },
  {
    id: 'saturn', kind: 'planet', orbit: 7500, angle: -64, au: 9.537, radius: 34, color: '#e3cf96', rings: true,
    visitable: true, unlockedBy: 'jupiter',
    name: { sv: 'Saturnus', en: 'Saturn' },
    type: { sv: 'Gasjätte – ringarnas planet', en: 'Gas giant – the ringed planet' },
    realTrip: { sv: 'Cassini tog nästan 7 år', en: 'Cassini took almost 7 years' },
    facts: {
      sv: [
        'Saturnus ringar består mest av is – bitar från dammkorn till stora som hus.',
        'Ringarna är cirka 280 000 km breda men oftast bara runt 10 meter tjocka.',
        'Saturnus har flest månar av alla planeter: 285 kända (mars 2026).',
        'Månen Titan har tjock atmosfär och sjöar av flytande metan. Sonden Huygens landade där 2005.',
        'Saturnus har så låg densitet att den skulle flyta – om man hade ett tillräckligt stort badkar!',
      ],
      en: [
        'Saturn\'s rings are made mostly of ice – pieces from dust grains to the size of houses.',
        'The rings are about 280,000 km wide but mostly only around 10 metres thick.',
        'Saturn has the most moons of any planet: 285 known (March 2026).',
        'The moon Titan has a thick atmosphere and lakes of liquid methane. The Huygens probe landed there in 2005.',
        'Saturn\'s density is so low that it would float – if you had a big enough bathtub!',
      ],
    },
    quiz: {
      sv: { q: 'Vad är Saturnus ringar mest gjorda av?', options: ['Is', 'Guld', 'Gas'], answer: 0 },
      en: { q: 'What are Saturn\'s rings mostly made of?', options: ['Ice', 'Gold', 'Gas'], answer: 0 },
    },
  },
  {
    id: 'uranus', kind: 'planet', orbit: 9700, angle: 105, au: 19.19, radius: 16, color: '#9fe3e8',
    visitable: true, unlockedBy: 'saturn',
    name: { sv: 'Uranus', en: 'Uranus' },
    type: { sv: 'Isjätte – planeten som ligger ner', en: 'Ice giant – the sideways planet' },
    realTrip: { sv: 'Voyager 2 tog 8,5 år', en: 'Voyager 2 took 8.5 years' },
    facts: {
      sv: [
        'Uranus lutar cirka 98 grader – den rullar runt solen liggande på sidan.',
        'Ett år är 84 jordår, så varje pol får 42 år av sol och sedan 42 år av mörker.',
        'Uranus var den första planeten som upptäcktes med teleskop, av William Herschel 1781.',
        'Metangas gör planeten blågrön. Här har den kallaste temperaturen på en planet uppmätts: –224 °C.',
        'Bara en rymdsond har besökt Uranus: Voyager 2 år 1986.',
      ],
      en: [
        'Uranus is tilted about 98 degrees – it rolls around the Sun on its side.',
        'A year is 84 Earth years, so each pole gets 42 years of sunlight and then 42 years of darkness.',
        'Uranus was the first planet discovered with a telescope, by William Herschel in 1781.',
        'Methane gas makes it blue-green. The coldest temperature on any planet was measured here: –224 °C.',
        'Only one spacecraft has visited Uranus: Voyager 2 in 1986.',
      ],
    },
    quiz: {
      sv: { q: 'Vad är speciellt med Uranus?', options: ['Den har inga moln', 'Den ligger på sidan', 'Den är varmast'], answer: 1 },
      en: { q: 'What is special about Uranus?', options: ['It has no clouds', 'It lies on its side', 'It is the hottest'], answer: 1 },
    },
  },
  {
    id: 'neptune', kind: 'planet', orbit: 12000, angle: -140, au: 30.07, radius: 15, color: '#3f63d8',
    visitable: true, unlockedBy: 'uranus',
    name: { sv: 'Neptunus', en: 'Neptune' },
    type: { sv: 'Isjätte – längst bort', en: 'Ice giant – the farthest planet' },
    realTrip: { sv: 'Voyager 2 tog 12 år', en: 'Voyager 2 took 12 years' },
    facts: {
      sv: [
        'Neptunus har solsystemets starkaste vindar – över 2 000 km/h.',
        'Planeten hittades 1846 med matematik innan någon hade sett den i teleskop.',
        'Ett år på Neptunus är 165 jordår. Den fullbordade sitt första varv sedan upptäckten år 2011.',
        'Månen Triton går baklänges runt planeten och har gejsrar av kväve.',
        'Solljuset behöver ungefär 4 timmar för att nå hit.',
      ],
      en: [
        'Neptune has the strongest winds in the solar system – over 2,000 km/h.',
        'The planet was found in 1846 using mathematics before anyone had seen it in a telescope.',
        'A year on Neptune is 165 Earth years. It completed its first orbit since discovery in 2011.',
        'Its moon Triton orbits backwards and has nitrogen geysers.',
        'Sunlight needs about 4 hours to get here.',
      ],
    },
    quiz: {
      sv: { q: 'Hur upptäcktes Neptunus?', options: ['Med matematik', 'Av en astronaut', 'Med en rymdsond'], answer: 0 },
      en: { q: 'How was Neptune discovered?', options: ['Using mathematics', 'By an astronaut', 'By a space probe'], answer: 0 },
    },
  },
  {
    id: 'pluto', kind: 'dwarf', orbit: 14200, angle: 168, au: 39.48, radius: 2.2, color: '#d9c3a5', incline: 900,
    visitable: true, landable: true, unlockedBy: 'neptune',
    name: { sv: 'Pluto', en: 'Pluto' },
    type: { sv: 'Dvärgplanet', en: 'Dwarf planet' },
    realTrip: { sv: 'New Horizons tog 9,5 år', en: 'New Horizons took 9.5 years' },
    facts: {
      sv: [
        'Pluto räknas sedan 2006 som en dvärgplanet, eftersom den inte har rensat sin bana från andra objekt.',
        'Pluto är mindre än vår måne: bara 2 377 km i diameter.',
        'New Horizons flög förbi den 14 juli 2015 och hittade en stor hjärtformad slätt av kväveis.',
        'Ett år på Pluto är 248 jordår.',
        'Plutos största måne Charon är så stor att de två snurrar runt varandra.',
      ],
      en: [
        'Since 2006 Pluto counts as a dwarf planet because it has not cleared its orbit of other objects.',
        'Pluto is smaller than our Moon: just 2,377 km across.',
        'New Horizons flew past on 14 July 2015 and found a huge heart-shaped plain of nitrogen ice.',
        'A year on Pluto is 248 Earth years.',
        'Pluto\'s largest moon Charon is so big that the two circle each other.',
      ],
    },
    quiz: {
      sv: { q: 'Varför är Pluto inte längre en planet?', options: ['Den försvann', 'Den har inte rensat sin bana', 'Den är för varm'], answer: 1 },
      en: { q: 'Why is Pluto no longer a planet?', options: ['It disappeared', 'It has not cleared its orbit', 'It is too hot'], answer: 1 },
    },
  },
];

export const BODY = Object.fromEntries(BODIES.map((b) => [b.id, b]));

// Visste du? – korta tips som visas under resan.
export const TIPS = {
  sv: [
    'Ljuset färdas 300 000 km per sekund. Inget kan åka snabbare – warpmotorn i spelet är science fiction!',
    'I rymden hörs inga ljud eftersom det inte finns någon luft som bär ljudet.',
    'En astronaut kan bli upp till 3 cm längre i tyngdlöshet, eftersom ryggraden sträcks ut.',
    'Astronauter på ISS ser 16 soluppgångar varje dygn.',
    'Anders Celsius, som gav namn åt temperaturskalan, var astronom i Uppsala.',
    'Jessica Meir, med svenskt medborgarskap, gjorde den första rymdpromenaden med bara kvinnor 2019.',
    'Stjärnan närmast solen, Proxima Centauri, ligger 4,2 ljusår bort.',
    'Rymdskrot är ett växande problem – det finns över 30 000 spårade bitar i omloppsbana runt jorden.',
    'Asteroidbältet mellan Mars och Jupiter innehåller miljontals stenar – men de är oftast väldigt långt ifrån varandra.',
    'Voyager 1 är människans mest avlägsna farkost, över 25 miljarder km bort.',
    'Sverige skrev under Artemis-avtalen 2024 och deltar i arbetet med att återvända till månen.',
    'Rymddräkten skyddar mot kyla, värme, strålning och vakuum – den är som ett eget litet rymdskepp.',
  ],
  en: [
    'Light travels 300,000 km per second. Nothing can go faster – the warp drive in the game is science fiction!',
    'Space is silent because there is no air to carry sound.',
    'Astronauts can grow up to 3 cm taller in weightlessness as their spine stretches.',
    'Astronauts on the ISS see 16 sunrises every day.',
    'Anders Celsius, who gave his name to the temperature scale, was an astronomer in Uppsala, Sweden.',
    'Jessica Meir, who holds Swedish citizenship, took part in the first all-female spacewalk in 2019.',
    'The star closest to the Sun, Proxima Centauri, is 4.2 light-years away.',
    'Space debris is a growing problem – more than 30,000 tracked pieces orbit Earth.',
    'The asteroid belt between Mars and Jupiter holds millions of rocks – but they are usually very far apart.',
    'Voyager 1 is humanity\'s most distant spacecraft, more than 25 billion km away.',
    'Sweden signed the Artemis Accords in 2024 and takes part in returning to the Moon.',
    'A spacesuit protects against cold, heat, radiation and vacuum – it is like a small spacecraft of its own.',
  ],
};

export const SOURCES = [
  'NASA Planetary Fact Sheets – nssdc.gsfc.nasa.gov/planetary/factsheet',
  'NASA Science – science.nasa.gov',
  'ESA – esa.int (BepiColombo, Marcus Wandt, Christer Fuglesang)',
  'Minor Planet Center / Sky & Telescope (månantal, mars 2026)',
  'NASA Artemis II (april 2026)',
];
