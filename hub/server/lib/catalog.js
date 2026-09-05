'use strict';
// Static catalogs: shop cosmetics, gem packs, pass perks, and the official games.

const ITEMS = [
  // colours
  { id: 'c_blue', kind: 'color', name: 'Sky Blue', price: 0, value: '#4cc2ff' },
  { id: 'c_green', kind: 'color', name: 'Lime', price: 0, value: '#6ee86a' },
  { id: 'c_red', kind: 'color', name: 'Ember', price: 40, value: '#ff5c5c' },
  { id: 'c_purple', kind: 'color', name: 'Violet', price: 60, value: '#b57bff' },
  { id: 'c_gold', kind: 'color', name: 'Gold', price: 250, value: '#ffd166' },
  { id: 'c_black', kind: 'color', name: 'Midnight', price: 120, value: '#1f2937' },
  { id: 'c_pink', kind: 'color', name: 'Bubblegum', price: 80, value: '#ff7ad9' },
  // hats
  { id: 'h_none', kind: 'hat', name: 'No hat', price: 0, value: 'none' },
  { id: 'h_cap', kind: 'hat', name: 'Cap', price: 60, value: 'cap' },
  { id: 'h_crown', kind: 'hat', name: 'Crown', price: 400, value: 'crown' },
  { id: 'h_halo', kind: 'hat', name: 'Halo', price: 300, value: 'halo' },
  { id: 'h_horns', kind: 'hat', name: 'Horns', price: 150, value: 'horns' },
  { id: 'h_top', kind: 'hat', name: 'Top hat', price: 220, value: 'top' },
  // trails
  { id: 't_none', kind: 'trail', name: 'No trail', price: 0, value: 'none' },
  { id: 't_spark', kind: 'trail', name: 'Sparkle', price: 250, value: 'spark' },
  { id: 't_fire', kind: 'trail', name: 'Fire', price: 450, value: 'fire' },
  { id: 't_rainbow', kind: 'trail', name: 'Rainbow', price: 700, value: 'rainbow' },
];

const GEM_PACKS = [
  { id: 'p_small', gems: 500, priceUsd: 4.99, label: 'Handful' },
  { id: 'p_medium', gems: 1200, priceUsd: 9.99, label: 'Pouch', bonus: '+20%' },
  { id: 'p_large', gems: 3000, priceUsd: 19.99, label: 'Chest', bonus: '+50%' },
];

const PERKS = {
  speed: { name: 'Speed boost', desc: '+25% movement speed' },
  magnet: { name: 'Gem magnet', desc: 'Pick up gems from twice the distance' },
  double: { name: 'Double score', desc: 'Every point counts twice' },
  vip: { name: 'VIP', desc: 'Golden name tag and glow' },
};

const MODES = {
  gemrush: { name: 'Gem Rush', desc: 'Collect the most gems before the clock runs out.' },
  tag: { name: 'Tag', desc: 'Do not be "it". Tag others to pass it on; score while you are free.' },
  koth: { name: 'King of the Hill', desc: 'Hold the glowing zone to score. Gems help too.' },
};

const STARTING_GEMS = 200;
const DAILY_BONUS = 50;
const PLATFORM_FEE = 0.3;      // 30% of every pass sale goes to the platform
const ROUND_REWARD = { win: 25, play: 5, creatorPerPlayer: 1 };

function wallsFromArt(art) {
  // art: array of equal-length strings, '#' = wall
  const rows = art.length, cols = art[0].length;
  const walls = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (art[y][x] === '#') walls.push(y * cols + x);
  return { cols, rows, walls };
}

const OFFICIAL_GAMES = [
  Object.assign({
    id: 'g_gemrush', name: 'Gem Rush Arena', mode: 'gemrush',
    desc: 'The original. Grab every gem you can in two minutes. Speed and magnet passes are legal, and encouraged.',
    roundSeconds: 120, maxPlayers: 8, speed: 1, gemRate: 1,
    theme: { bg: '#0d1425', wall: '#2b3a67', accent: '#4cc2ff' },
    passes: [
      { id: 'gp_gr_speed', name: 'Turbo', price: 120, perk: 'speed', desc: 'Move 25% faster in this arena.' },
      { id: 'gp_gr_magnet', name: 'Magnet', price: 150, perk: 'magnet', desc: 'Gems fly to you from further away.' },
      { id: 'gp_gr_vip', name: 'VIP', price: 300, perk: 'vip', desc: 'Show off with a golden name.' },
    ],
  }, wallsFromArt([
    '########################',
    '#......................#',
    '#..##..........##......#',
    '#..##....####..##......#',
    '#........#..#..........#',
    '#........#..#....###...#',
    '#..###...........#.....#',
    '#....#...........#.....#',
    '#....#...####..........#',
    '#..........#.....##....#',
    '#..##......#.....##....#',
    '#..##..................#',
    '########################',
  ])),
  Object.assign({
    id: 'g_tag', name: 'Neon Tag', mode: 'tag',
    desc: 'Classic playground tag under neon lights. Whoever is "it" glows red. Stay free to score.',
    roundSeconds: 90, maxPlayers: 10, speed: 1.1, gemRate: 0.3,
    theme: { bg: '#160d25', wall: '#5b2b8a', accent: '#ff7ad9' },
    passes: [
      { id: 'gp_tag_speed', name: 'Sprint', price: 100, perk: 'speed', desc: 'Outrun anyone who is it.' },
      { id: 'gp_tag_double', name: 'Double points', price: 200, perk: 'double', desc: 'Free time counts twice.' },
    ],
  }, wallsFromArt([
    '##########################',
    '#........................#',
    '#...#..#.....##.....#....#',
    '#...####.....##.....#....#',
    '#............##.....#....#',
    '#........................#',
    '#....###...........###...#',
    '#............##..........#',
    '#..#.........##.......#..#',
    '#..#..####...##..####.#..#',
    '#..#.....................#',
    '#........................#',
    '##########################',
  ])),
  Object.assign({
    id: 'g_koth', name: 'Hilltop Showdown', mode: 'koth',
    desc: 'One hill, one crown. Stand in the zone to rack up points and knock rivals off the top.',
    roundSeconds: 120, maxPlayers: 8, speed: 0.95, gemRate: 0.5,
    theme: { bg: '#0b1f17', wall: '#1f5a3d', accent: '#ffd166' },
    passes: [
      { id: 'gp_koth_double', name: 'Kingmaker', price: 250, perk: 'double', desc: 'Zone points count twice.' },
      { id: 'gp_koth_vip', name: 'Royal VIP', price: 300, perk: 'vip', desc: 'A golden name fit for royalty.' },
    ],
  }, wallsFromArt([
    '######################',
    '#....................#',
    '#..##............##..#',
    '#..#..............#..#',
    '#....................#',
    '#.......#....#.......#',
    '#....................#',
    '#.......#....#.......#',
    '#....................#',
    '#..#..............#..#',
    '#..##............##..#',
    '#....................#',
    '######################',
  ])),
];

module.exports = {
  ITEMS, GEM_PACKS, PERKS, MODES, OFFICIAL_GAMES, STARTING_GEMS, DAILY_BONUS,
  PLATFORM_FEE, ROUND_REWARD, wallsFromArt,
};
