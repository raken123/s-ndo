// Banorna. Tecken i kartorna:
//  #  vägg          w  vägg med fönster   F  staket        L  skåp
//  H  skåp att gömma sig i (tryck E)      D  dörröppning   .  golv   ,  matta/gräs
//  =  bord/bänk     B  bokhylla           o  låda/stol     p  växt/träd/panna
//  k  säng          s  soffa              f  flaggstång    l  lampa (ljus i mörker)
//  *  sak att hitta b  batteri            E  mål           P  Kasper
//  R  Ruben         T  Tilda              S  lydig elev    X  Pantern
(function () {
  'use strict';
  const SK = window.SK;

  SK.LEVELS = {
    flykt: {
      short: 'Spring till bakdörren',
      theme: 'school', music: 'jakt',
      title: 'Fyrtiosju sekunder',
      goal: 'Spring till bakdörren längst bort i korridoren. Låt inte Ruben och Tilda ta dig.',
      tip: 'Håll inne SPRING för att springa. Göm dig i ett skåp med grön lampa (E) om de kommer för nära.',
      caught: ['Ruben fick tag i luvan. "Vart ska Spöket, då?"', 'Tilda ställer sig i vägen. "Buuu!" Alla skrattar.', 'De tar din mössa och kastar den i papperskorgen.'],
      grace: 1.6,
      map: [
        '##############################################',
        '#LLLHLLLLLLL#LLLLLLHLLLLL#LLLLLLLLLHLLL#LLLLL#',
        '#...........D...........D..............D.....#',
        '#.RT...P....#..o.....o..#....=..=..=...#.....#',
        '#...........#...........#....=..=..=...#..o..#',
        '#.....o.....#...........#..............#.....E',
        '#...........#LLLL...LLLL#LLLLLLL...LLLL#.....#',
        '#LLHLL...LLL#,,,,...,,,,#,,,,,,,...,,,,#.....#',
        '#,,,,,...,,,D,,,,...,,,,D,,,,,,,...,,,,D.....#',
        '#,,,,,...,,,#,,,,...,,,,#,,,,,,,...,,,,#LLHLL#',
        '##############################################',
      ],
      speeds: { ruben: 60, tilda: 56 },
    },

    skolgard: {
      short: 'Rör vid flaggorna – tillbaka till entrén',
      theme: 'yard', music: 'jakt',
      title: 'Uppdrag 1: Tre flaggor',
      goal: 'Rör vid alla tre flaggorna på skolgården och spring tillbaka till entrén innan klockan ringer.',
      tip: 'Spring när du har ork. Gå när den tar slut – då fylls den på.',
      time: 34, itemName: 'flagga', itemNames: 'flaggor',
      map: [
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
        'F,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,F',
        'F,*,,,p,,,,,,,,,p,,,,,,,,,p,,,,,,,,,*,,F',
        'F,,,,..............................,,,,F',
        'F,p,,..##########################..,p,,F',
        'F,,,,..##########################..,,,,F',
        'F,,,,..##########################..,,,,F',
        'F,,,,..##########################..,,,,F',
        'F,,p,..##########################..,,p,F',
        'F,,,,..##########################..,,,,F',
        'F,,,,..########w##w##w##w########..,,,,F',
        'F,,,,..............................,,,,F',
        'F,,,,..o.o.o.......f.......=..=....,,,,F',
        'F,,,,.............E........,,,,,,,,,,,,F',
        'F,,*,,,,,,p,,,,,,,P,,,,,,,,,,,,,p,,,,,,F',
        'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ],
    },

    hemma: {
      short: 'Tänd lamporna – gå till sängen',
      theme: 'home', music: 'mork', dark: true, battery: 70,
      title: 'Straffet',
      goal: 'Något är inne i lägenheten. Tänd de tre lamporna och ta dig till din säng.',
      tip: 'LJUS tänder mobilens lampa. Pantern tål inte ljus – men batteriet tar slut. Spring inte: den hör dig.',
      itemName: 'lampa', itemNames: 'lampor', itemVerb: 'tänd',
      caught: ['Något kallt andas i din nacke. Allt blir svart.', 'Två gröna ögon. Ett morrande. Sedan ingenting.'],
      map: [
        '############################',
        '#kk..B..#......s..s...#..B=#',
        '#kk.....D.............D....#',
        '#E......#.....ssss....#....#',
        '#.......#.............#..*.#',
        '#####D###.....=..=....##D###',
        '#.......#.............#....#',
        '#..*....D......X......D....#',
        '#.......#.............#..b.#',
        '#####D###.....=..=....##D###',
        '#..o....#.............#....#',
        '#.......D......*......D..o.#',
        '#..b....#.............#....#',
        '#.....P.#.............#..B.#',
        '##w####w#####w####w#####w###',
      ],
    },

    gympa: {
      short: 'Hitta dina saker – ta dig ut',
      theme: 'gym', music: 'jakt',
      title: 'Ruben har ett uppdrag',
      goal: 'Ruben har gömt dina saker i gympasalen. Hitta jackan, ryggsäcken och nycklarna – och ta dig ut.',
      tip: 'Ruben stannar ibland och tittar i mobilen. Då har du en chans. Skåpen med grön lampa går att gömma sig i.',
      itemName: 'sak', itemNames: 'saker', itemKinds: ['jacka', 'ryggsäck', 'nycklar'],
      caught: ['Ruben trycker upp dig mot ribbstolen. Hans ögon lyser grönt. "Förlåt", viskar han. "Den tvingar mig."', 'Rubens mobil blixtrar. Han har tagit en bild av dig. Uppdraget är klart – för honom.'],
      grace: 2,
      map: [
        '####################################',
        '#LLHLLLLL#.........................#',
        '#........D..........,,,,,,.........#',
        '#.====...#..........,,,,,,.........#',
        '#........#.....o....,,,,,,....o....#',
        '#LL..HLLL#.........................#',
        '###D######.........................#',
        '#........#.....*...........R.......#',
        '#.P......D.........................#',
        '#........#.........................#',
        '#LL..HLLL#..o..............o.......#',
        '###D######.........................#',
        '#........#..........,,,,,,.........#',
        '#.*.====.D..........,,,,,,......*..#',
        '#........#.........................E',
        '####################################',
      ],
      speeds: { ruben: 58 },
    },

    korridor2: {
      short: 'Plocka lapparna – smyg till biblioteket',
      theme: 'school', music: 'mork',
      title: 'De lydiga',
      goal: 'Alla har fått appen. Smyg till biblioteket och plocka upp Tildas tre lappar på vägen. Låt ingen se dig.',
      tip: 'Eleverna ser bara åt det håll de tittar – där mobilen lyser. Gå bakom dem. Om någon ser dig: spring och göm dig.',
      itemName: 'lapp', itemNames: 'lappar',
      caught: ['"Här är han!" Tjugo mobiler vänds mot dig. Pling. Pling. Pling.', 'En elev du aldrig pratat med håller fast din arm och stirrar på skärmen. "Jag måste. Annars får jag straff."'],
      grace: 0.5,
      map: [
        '############################################',
        '#LLLHLLLLLLLLL#LLLLLLLLLLLL#LLLLLHLLLLLLLLL#',
        '#.............D............D..............E#',
        '#..P..........#....S.......#.......*......B#',
        '#.............#............#..............B#',
        '#LLLLLL...LLLL#LLLL....LLLL#LLLL...LLLHLLLL#',
        '#.............................S............#',
        '#.........S................................#',
        '#LLLHLL...LLLL#LLLL....LLLL#LLLL...LLLLLLLL#',
        '#,,,,,,...,,,,#,,,,....,,,,#,,,,...,,,,,,,,#',
        '#,,*,,,...,,S,D,,,,....,,,,D,,,,...,,,,,*,,#',
        '#,,,,,,...,,,,#,,,,.S..,,,,#,,,,...,,,,,,,,#',
        '#LLLLLLLLHLLLL#LLLLLLLLLLLL#LLLLLLLLLLLHLLL#',
        '############################################',
      ],
    },

    kallare: {
      short: 'Hitta säkringarna – gå till Datasal 3',
      theme: 'basement', music: 'mork', dark: true, battery: 60,
      title: 'Källaren',
      goal: 'Hitta tre säkringar till dörren vid Datasal 3. Pantern är här nere.',
      tip: 'Batterier ligger utspridda. Lampor som lyser är säkra platser. Spring bara när du måste.',
      itemName: 'säkring', itemNames: 'säkringar',
      caught: ['Klor mot betong. Ett andetag. Pantern har hittat dig.', 'Lampan slocknar. Två gröna ögon blinkar en gång.'],
      map: [
        '########################################',
        '#P..l...#.......o..B#........#.......*.#',
        '#.......#..o.......B#..o.....D.........#',
        '#..o....D..........B#........#..ooo....#',
        '#.......#....*.....##D########.........#',
        '###D#####..........#.........#####D#####',
        '#.......####D#######....l....#.........#',
        '#..b.......................b.#..B...B..#',
        '#.......#.....o......o.......#..B...B..#',
        '#BBB....#..........X.........D.........#',
        '#.......#.....o......o.......#..B.l.B..#',
        '#..p....####D#######.........#.........#',
        '#.......#..........####D######.........#',
        '#.*.....#..o...b...#...........o.....b.#',
        '#.......D..........D.....p.........E...#',
        '########################################',
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
