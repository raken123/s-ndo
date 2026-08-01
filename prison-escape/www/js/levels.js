/* ==========================================================================
   Escape from Blackgate — level data
   --------------------------------------------------------------------------
   Map legend
     #  concrete wall            .  floor
     ,  dirt / outdoor ground    ~  water (slow + noisy)
     B  bunk (searchable)        L  locker (searchable)
     c  crate (searchable)       k  laundry cart (searchable)
     T  table (blocks movement, not sight)
     %  bush / cover (walkable, blocks sight)
     F  chain-link fence (cuttable with wire cutters)
     W  watchtower base (solid)
     +  open doorway             1-4 locked door (see `locks`)
     S  player start             X  level exit
   ========================================================================== */

const LEVELS = [
  /* ---------------------------------------------------------------- 1 --- */
  {
    id: 1,
    name: 'Cellblock D',
    time: '23:04',
    brief: [
      'Fourteen years for something you did not do.',
      'Tonight the night guard is new, the block key hangs by the coffee pot,',
      'and there is a hairpin in your mattress.',
      'Get out of the cell. Get to the stairwell. Do not get seen.'
    ],
    objective: 'Search your bunk, pick the cell lock, reach the stairwell',
    tip: 'Walk quietly (SNEAK) — running echoes down the block.',
    map: [
      '########################################',
      '#....#....#....#....#....#....#........#',
      '#.BB.#.BB.#.BB.#.BB.#.BB.#.BB.#..LLLL..#',
      '#.BB.#.BB.#.BB.#.BB.#.BB.#.BB.#..LLLL..#',
      '#...S#....#....#....#....#....#....T...#',
      '##1####+####+####+####+####+######+#####',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '######+###########+###############2#####',
      '#...........#...........#..............#',
      '#..T.T..T...#....~~~....#.....L.L......#',
      '#..T.T..T...#....~~~....#..............#',
      '#...........#...........#......X.......#',
      '########################################'
    ],
    locks: {
      '1': { item: 'hairpin', label: 'Cell door — a lockpick would do it' },
      '2': { item: 'blockkey', label: 'Stairwell door — needs the block key' }
    },
    items: [
      { x: 2, y: 3, id: 'hairpin', name: 'Hairpin', icon: '📎',
        found: 'A hairpin, worked flat. Good enough for a cell lock.' },
      { x: 33, y: 2, id: 'blockkey', name: 'Block Key', icon: '🔑',
        found: 'The block key. Still warm from the guard\'s pocket.' }
    ],
    guards: [
      { path: [[3, 7], [36, 7]], speed: 52, range: 210, name: 'Night guard' },
      { path: [[37, 3], [32, 4], [34, 7], [20, 7], [37, 3]], speed: 44, range: 190, name: 'Block officer' }
    ],
    exitRequires: [],
    exitLabel: 'the stairwell'
  },

  /* ---------------------------------------------------------------- 2 --- */
  {
    id: 2,
    name: 'Laundry & Stores',
    time: '23:21',
    brief: [
      'The stairwell drops you into the service floor.',
      'Guards down here only ever look at the jumpsuit, never the face.',
      'Find a uniform. Find the keycard the supervisor keeps in his locker.',
      'Then walk out like you belong.'
    ],
    objective: 'Steal a guard uniform and the supervisor\'s keycard',
    tip: 'A uniform makes guards look right through you — unless you get close.',
    map: [
      '########################################',
      '#.............#............#...........#',
      '#.ccc.ccc.ccc.#..ccc..ccc..+...L.L.L...#',
      '#.............#............#...........#',
      '#.ccc.ccc.k...#..ccc..ccc..#...T.T.....#',
      '#.............#............#...........#',
      '#.....k.......+............#...........#',
      '#####+##############+#############+#####',
      '#......................................#',
      '#S.....................................#',
      '#......................................#',
      '###############################1########',
      '#......................................#',
      '#.........c......c.........c......X....#',
      '#......................................#',
      '########################################'
    ],
    locks: {
      '1': { item: 'keycard', label: 'Wing door — magnetic lock, needs a keycard' }
    },
    items: [
      { x: 10, y: 4, id: 'uniform', name: 'Guard Uniform', icon: '👕',
        found: 'A pressed uniform, two sizes too big. It will do.' },
      { x: 33, y: 2, id: 'keycard', name: 'Keycard', icon: '💳',
        found: 'Supervisor\'s keycard. Level 2 access.' }
    ],
    guards: [
      { path: [[3, 9], [36, 9]], speed: 58, range: 220, name: 'Floor guard' },
      { path: [[20, 2], [25, 5], [16, 6], [20, 2]], speed: 48, range: 200, name: 'Stores officer' },
      { path: [[36, 13], [3, 13], [36, 13]], speed: 62, range: 230, name: 'Sweeper' },
      { path: [[30, 2], [36, 5], [30, 2]], speed: 40, range: 190, name: 'Supervisor' }
    ],
    exitRequires: ['keycard'],
    exitLabel: 'the wing door'
  },

  /* ---------------------------------------------------------------- 3 --- */
  {
    id: 3,
    name: 'Security Wing',
    time: '23:44',
    brief: [
      'Cameras here. Every corridor, every corner, thirty frames a second.',
      'There is a breaker cabinet in the maintenance room.',
      'Kill the power, take the wire cutters, and get to the yard door',
      'before someone upstairs wonders why the screens went black.'
    ],
    objective: 'Cut the power, grab the wire cutters, reach the yard door',
    tip: 'Cameras cannot see through walls or crates. Watch the sweep, then move.',
    map: [
      '########################################',
      '#..........#.....#.........#...........#',
      '#.T.T......+.....+....c.c..#....LL.....#',
      '#..........#.....#....c.c..#....LL.....#',
      '#.....S....#.....#.........+...........#',
      '######+#########+#############+#########',
      '#......................................#',
      '#..cc.......cc........cc.......cc......#',
      '#......................................#',
      '####+############+##############+#######',
      '#........#...............#.............#',
      '#..LLL...#....c...c......#..c...c......#',
      '#........+...............+.....###1#####',
      '#........#....c...c......#.....#.......#',
      '#........#...............#.....#...X...#',
      '########################################'
    ],
    locks: {
      '1': { item: 'yardkey', label: 'Yard door — bolted from the guard post' }
    },
    items: [
      { x: 3, y: 11, id: 'breaker', name: 'Breaker Pulled', icon: '⚡',
        found: 'The wing goes dark. Somewhere a camera monitor dies.',
        effect: 'power' },
      { x: 28, y: 11, id: 'cutters', name: 'Wire Cutters', icon: '✂️',
        found: 'Bolt cutters, heavy in the hand. Fences are optional now.' },
      { x: 33, y: 2, id: 'yardkey', name: 'Yard Key', icon: '🗝️',
        found: 'Yard door key, taken off the hook.' }
    ],
    guards: [
      { path: [[2, 6], [37, 6]], speed: 60, range: 220, name: 'Wing patrol' },
      { path: [[13, 12], [23, 12], [13, 12]], speed: 52, range: 210, name: 'Control officer' },
      { path: [[33, 4], [30, 4], [28, 10], [33, 4]], speed: 50, range: 210, name: 'Post guard' }
    ],
    cameras: [
      { x: 19, y: 6, dir: 90, sweep: 80, speed: 26, range: 230 },
      { x: 6, y: 8, dir: 0, sweep: 70, speed: 22, range: 210 },
      { x: 34, y: 6, dir: 180, sweep: 90, speed: 30, range: 230 },
      { x: 15, y: 13, dir: 270, sweep: 70, speed: 24, range: 200 }
    ],
    exitRequires: ['cutters'],
    exitLabel: 'the yard door'
  },

  /* ---------------------------------------------------------------- 4 --- */
  {
    id: 4,
    name: 'The Yard',
    time: '00:12',
    brief: [
      'Cold air. Real air.',
      'Two towers, two searchlights, and forty metres of open gravel.',
      'The bushes will hide you. The light will not forgive you.',
      'Cut the fence at the storm drain and go under.'
    ],
    objective: 'Cross the yard, cut the fence, reach the storm drain',
    tip: 'Stay in the bushes when a light sweeps past. Cut fence with ACTION.',
    map: [
      '########################################',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,%%,,,,,cc,,,,,,,,,,,,cc,,,,,%%%,,,,,#',
      '#,,%%,,,,,cc,,,W,,,,,,,,cc,,,,,%%%,,,,,#',
      '#,,,,,,,,,,,,,,W,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,%%%,,,,,,,,,,%%%,,,,,,,,,,,,,,,,#',
      '#S,,,,,%%%,,,,,,,,,,%%%,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,cc,,,,,,,,,,,,,,,,,,,,,,,cc,,,,,,,,#',
      '#,,,cc,,,,,,,,,,,,,,,,,,,,,,,cc,,,,,,,,#',
      '#,,,,,,,,,,,,,,W,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,%%,,,,,,,,W,,,,,,,,%%%,,,,,,%%,,,,#',
      '#,,,,%%,,,,,,,,,,,,,,,,,%%%,,,,,,%%,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,X,,,,,,,,,,,#',
      '########################################'
    ],
    locks: {},
    items: [
      { x: 5, y: 11, id: 'rope', name: 'Coil of Rope', icon: '🪢',
        found: 'Someone left a coil of rope by the shed. Take it.' }
    ],
    guards: [
      { path: [[4, 13], [34, 13], [4, 13]], speed: 66, range: 230, name: 'Yard patrol' },
      { path: [[20, 8], [8, 4], [30, 4], [20, 8]], speed: 58, range: 220, name: 'Dog handler' }
    ],
    lights: [
      { path: [[6, 3], [32, 6], [10, 10], [6, 3]], speed: 74, radius: 108 },
      { path: [[30, 12], [8, 8], [34, 3], [30, 12]], speed: 62, radius: 96 }
    ],
    fence: true,
    exitRequires: [],
    exitLabel: 'the storm drain'
  },

  /* ---------------------------------------------------------------- 5 --- */
  {
    id: 5,
    name: 'The Storm Drain',
    time: '00:38',
    brief: [
      'Black water to the ankles and a tunnel that runs somewhere north.',
      'They know you are gone now — you can hear the siren through the concrete.',
      'Find the crowbar. Find the manhole under the road.',
      'Six hundred metres and you are nobody again.'
    ],
    objective: 'Find the crowbar and lever open the manhole',
    tip: 'It is dark. You can only see what your hand can reach.',
    dark: true,
    map: [
      '########################################',
      '#S..~~~#.......#.....#....#............#',
      '####...#.###.#.#.###.#.##.#.####.#####.#',
      '#..#.###.#...#...#...#..#.#....#.....#.#',
      '#..#.....#.#######.###..#.#.##.#####.#.#',
      '#.###.####.#.....#.#....#...#..#...#.#.#',
      '#...#.#~~~~#.###.#.#.####.###..#.#.#.#.#',
      '###.#.#.##.#.#.#.#.#....#.#....#.#...#.#',
      '#...#.#.#..#.#.#...####.#.#.####.#####.#',
      '#.###.#.#.##.#.########.#.#.#..#.....#.#',
      '#.#...#.#....#.#......#.#.#.#.##.#####.#',
      '#.#.###.######.#.####.#.#.#.#..#.#...#.#',
      '#.#.#.........~~~#..#.#...#.##.#.#.###.#',
      '#.#.#.#########..#..#.#####.#..#.#.#...#',
      '#...#.........#..#..#.......#..#...#.#.#',
      '#.#############..#..#########..#####.#.#',
      '#..............#....#.........X......#.#',
      '########################################'
    ],
    locks: {},
    items: [
      { x: 36, y: 1, id: 'crowbar', name: 'Crowbar', icon: '🛠️',
        found: 'A crowbar wedged in the grating. Rusted, but solid.' },
      { x: 2, y: 14, id: 'lamp', name: 'Storm Lamp', icon: '🔦',
        found: 'A maintenance lamp. The dark opens up a little.',
        effect: 'light' }
    ],
    guards: [
      { path: [[17, 16], [26, 16], [22, 16], [17, 16]], speed: 54, range: 170, name: 'Searcher' },
      { path: [[6, 12], [13, 12], [6, 12]], speed: 46, range: 160, name: 'Searcher' }
    ],
    exitRequires: ['crowbar'],
    exitLabel: 'the manhole'
  }
];

if (typeof module !== 'undefined') module.exports = { LEVELS };
