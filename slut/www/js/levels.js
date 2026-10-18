// Banorna i Slut. Tecken i kartorna:
//  #  vägg          w  vägg med fönster   F  staket        L  skåp
//  H  skåp att gömma sig i (tryck E)      D  dörröppning   .  golv   ,  matta/gräs
//  =  bord/bänk     B  monter/bokhylla    o  bänk/låda     p  dinosaurie/träd/växt
//  l  lampa (ljus i mörker)               *  sak att hitta b  batteri
//  E  mål           P  Elsa               R, S, X  personer – vilka de är står i "cast"
(function () {
  'use strict';
  const SK = window.SK;

  SK.LEVELS = {
    museum: {
      theme: 'museum', music: 'jakt', player: 'elsa',
      title: 'Frågesporten',
      short: 'Hitta stämplarna – gå till samlingen',
      goal: 'Hitta de fyra frågesport-stämplarna i museet och gå till samlingen vid utgången. Johan följer efter dig.',
      tip: 'Johan stannar ibland och läser något i mobilen. Gå då. Bakom montrarna ser han dig inte.',
      itemName: 'stämpel', itemNames: 'stämplar',
      caught: ['Johan ställer sig i vägen. "Så du har tid för honom, men inte för mig?"', 'Johan tar tag i ditt frågesportpapper. "Vad har ni skrivit här, då?"', '"Varför svarar du inte när jag skriver?" säger Johan. Alla i salen tittar.'],
      grace: 2,
      cast: { R: { ai: 'chase', look: 'johan', spd: 54, pauses: true, pauseText: 'Johan läser något…' } },
      map: [
        '############################################',
        '#P.......#..........#...........#..........#',
        '#..o..o..D....B..B..D...pp..pp..D..B....B..#',
        '#........#..........#...pp..pp..#..........#',
        '#..B..B..#....*.....#...........#....*.....#',
        '#........#..........#..o.....o..#..........#',
        '###D######....B..B..####D########..B....B..#',
        '#........#..........#...........#..........#',
        '#..,,,,..D..........D.....*.....D..........#',
        '#..,,,,..#####D######...........######D#####',
        '#..,,,,..#..........#..B.....B..#..........#',
        '#........#..o....o..#...........#....R.....#',
        '#..=..=..#..........#...pp..pp..#..........#',
        '#........D....*.....D...pp..pp..D.........E#',
        '#........#..........#...........#..........#',
        '############################################',
      ],
    },

    lappar: {
      theme: 'school', music: 'jakt', player: 'elsa',
      title: 'Utskrifterna',
      short: 'Riv ner utskrifterna innan klockan ringer',
      goal: 'Någon har satt upp utskrifter av dina meddelanden med Jason i korridoren. Riv ner alla fem innan rasten börjar.',
      tip: 'Johan går fram och tillbaka och tittar i mobilen. Ser han dig följer han efter. Skåpen med grön lampa går att gömma sig i.',
      time: 75, itemName: 'utskrift', itemNames: 'utskrifter',
      caught: ['Johan håller upp en utskrift framför dig och läser högt: "övervåningen är bäst". Han ler inte.', 'Johan rycker utskriften ur din hand. "Jag har fler. Jag har allt."'],
      grace: 1,
      cast: { S: { ai: 'patrol', look: 'johan', spd: 50, phoneAlways: true, alertText: 'Elsa!' } },
      map: [
        '########################################',
        '#LLLHLLLLL#LLLLLLLLLLLL#LLLLLHLLLLLLLLL#',
        '#.........D............D...............#',
        '#.P.......#..*.........#.......*.......#',
        '#.........#............#...............#',
        '#LLLL..LLL#LLLL....LLLL#LLLL....LLLHLLL#',
        '#......................................#',
        '#.....*..........S...........*.........#',
        '#LLLHLL..LLL#LLLL....LLLL#LLLL...LLLLLL#',
        '#,,,,,,..,,,#,,,,....,,,,#,,,,...,,,,,,#',
        '#,,*,,,..,,,D,,,,....,,,,D,,,,...,,,,,E#',
        '#,,,,,,..,,,#,,,,....,,,,#,,,,...,,,,,,#',
        '########################################',
      ],
    },

    park: {
      theme: 'yard', music: 'mork', dark: true, battery: 65, player: 'elsa',
      title: 'Genom parken',
      short: 'Ta dig hem genom parken',
      goal: 'Det är mörkt. Någon går efter dig genom parken. Ta dig hem till grinden längst bort.',
      tip: 'LJUS tänder mobilens lampa. Den som följer efter dig vill inte bli sedd – men batteriet tar slut. Spring bara när du måste: han hör dig.',
      caught: ['En hand på din axel. "Vem skriver du med nu, Elsa?" Det är Johans röst.', 'Någon tar din mobil ur handen, läser – och lägger tillbaka den. Det är Johan. Han säger ingenting.'],
      cast: { X: { ai: 'stalker', look: 'johan', scaredText: 'Han gömmer sig!', scaredSound: 'gasp', huntSound: 'step' } },
      map: [
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        'F,,,,,,,,p,,,,,,,,,,,,,,p,,,,,,,,,,,,,,F',
        'F,P....l.......,,,,p,,,,,,.......l....,F',
        'F,.,,,,,,,,,,,.,,,,,,,,,,,.,,,,,,,,,.,,F',
        'F,.,,p,,,,,,p,.,,,,b,,,,,,.,,p,,,,,,.,,F',
        'F,.,,,,,,,,,,,.....=....l..,,,,,,,,,.,,F',
        'F,.,,,,,p,,,,,,,,,,,,,,,,,.,,,,,X,,,.,,F',
        'F,.......l....,,,,p,,,,,,,......=.....,F',
        'F,,,,,,,,,,,.,,,,,,,,,,,,,,,,,,,,,,,,.,F',
        'F,,p,,,b,,,,.......l..........,,,p,,.,,F',
        'F,,,,,,,,,,,,,,,,,,,,,,,,,,,,.,,,,,,,.,F',
        'F,,,,p,,,,,,,,,,p,,,,,,,,,,,,......l.E,F',
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ],
    },

    avslutning: {
      theme: 'school', music: 'mork', player: 'elsa',
      title: 'Nyckeln till teknikrummet',
      short: 'Hämta nyckeln – smyg till teknikrummet',
      goal: 'Avslutningen börjar snart. Hämta nyckeln till teknikrummet och ta dig dit innan Johan startar filmen. Lärare och föräldrar skickar dig till aulan om de ser dig.',
      tip: 'Vuxna ser åt det håll de går. Johan letar efter dig. Göm dig i skåpen om det blir för nära.',
      time: 100, itemName: 'nyckel', itemNames: 'nycklar',
      caught: ['"Elsa! Avslutningen börjar nu. Till aulan, tack."', 'Johan ställer sig framför dig. "Du hinner inte. Sätt dig och titta, du med."'],
      grace: 1,
      cast: {
        S: { ai: 'patrol', look: 'student', spd: 40, alertText: 'Elsa?' },
        R: { ai: 'chase', look: 'johan', spd: 52, pauses: true, pauseText: 'Johan kollar filmen…' },
      },
      map: [
        '############################################',
        '#LLLHLLLLLLLL#LLLLLLLLLLL#LLLLLHLLLLLLLLLLL#',
        '#............D...........D.................#',
        '#.P..........#.....S.....#........*........#',
        '#............#...........#.................#',
        '#LLLLL...LLLL#LLLL...LLLL#LLLL...LLLLHLLLLL#',
        '#..........................................#',
        '#......S....................R..........S...#',
        '#LLLHLL...LLL#LLLL...LLLL#LLLL...LLLLLLLLLL#',
        '#,,,,,,...,,,#,,,,...,,,,#,,,,...,,,,,,,,,,#',
        '#,,,,,,...,,,D,,,,...,,,,D,,,,...,,,,,,,,E,#',
        '#,,,,,,...,,,#,,,,...,,,,#,,,,...,,,,,,,,,,#',
        '#LLLLLLLLLLLL#LLLLLLLLLLL#LLLLLLLLLLLLLLLLL#',
        '############################################',
      ],
    },
  };

  // Kontroll: alla rader lika långa (används av testerna)
  SK.checkLevels = function () {
    const bad = [];
    for (const id in SK.LEVELS) {
      const m = SK.LEVELS[id].map;
      m.forEach((row, i) => { if (row.length !== m[0].length) bad.push(id + ' rad ' + i + ': ' + row.length + ' != ' + m[0].length); });
    }
    return bad;
  };
})();
