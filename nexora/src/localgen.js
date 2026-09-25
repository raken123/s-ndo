/* Nexora Local: the offline generator. It reads the prompt for genre, theme,
 * mood and difficulty, then builds a playable game from the templates in
 * games.js. Also offline story/NPC/quest/dialog text, pixel sprites, low-poly
 * meshes, music and sound effects. */
(function () {
  'use strict';

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A word counts when it starts a word in the prompt ("orm" in "orm-spel", not in "plattformsspel").
  const starts = (p, w) => new RegExp('(^|[^a-z0-9åäöéü])' + esc(w.trim())).test(p);
  const has = (p, words) => words.some(w => starts(p, w));
  // Genre score: 2 per word-start match, 1 per longer word found inside a compound ("rymdskjutare").
  const score = (p, words) => words.reduce((n, w) => n + (starts(p, w) ? 2 : w.length >= 5 && p.includes(w) ? 1 : 0), 0);

  const GENRES = [
    { id: 'openworld', label: 'Open world-äventyr', d3: false, words: ['open world', 'open-world', 'öppen värld', 'utforska', 'rpg', 'äventyr', 'quest', 'uppdrag', 'zelda', 'kungarike'] },
    { id: 'runner3d', label: '3D-löpare', d3: true, words: ['löpare', 'runner', 'subway', 'spring', 'endless'] },
    { id: 'arena3d', label: '3D-arena', d3: true, words: ['arena', 'samla', 'collect', 'kula', 'orb'] },
    { id: 'shooter', label: 'Rymdskjutare', d3: false, words: ['skjut', 'shoot', 'rymd', 'space', 'alien', 'skepp', 'laser', 'invaders', 'galax'] },
    { id: 'snake', label: 'Orm', d3: false, words: ['orm', 'snake', 'mask'] },
    { id: 'breakout', label: 'Blockkross', d3: false, words: ['breakout', 'block', 'tegel', 'brick', 'boll', 'arkanoid', 'krossa'] },
    { id: 'dodger', label: 'Undvik-spel', d3: false, words: ['undvik', 'dodge', 'bil', 'car', 'race', 'racing', 'väg', 'trafik', 'fall'] },
    { id: 'collector', label: 'Samlarspel', d3: false, words: ['samla', 'collect', 'mynt', 'coin', 'diamant', 'gem', 'jaga', 'två spelare', '2 spelare', 'multiplayer', 'kompis'] },
    { id: 'platformer', label: 'Plattformsspel', d3: false, words: ['plattform', 'platform', 'hoppa', 'jump', 'mario', 'ninja', 'hopp'] },
  ];

  const THEMES = [
    { words: ['lava', 'vulkan', 'eld', 'fire', 'helvete', 'drake', 'dragon'], name: 'Lava', mood: 'dark', pal: { bg1: '#2a0a0a', bg2: '#6b1d0c', ground: '#3b1f1a', top: '#ff6a2b', player: '#ffd166', enemy: '#ff3b3b', coin: '#ffe45e', accent: '#ff9f1c', deco: '#ffb38a' } },
    { words: ['is', 'snö', 'vinter', 'ice', 'snow', 'frost', 'pingvin', 'jul'], name: 'Is', mood: 'bright', pal: { bg1: '#cfeaff', bg2: '#6fa8dc', ground: '#e8f4ff', top: '#ffffff', player: '#ff5d8f', enemy: '#3a4fff', coin: '#ffd23f', accent: '#1e90ff', deco: '#ffffff' } },
    { words: ['skog', 'forest', 'djungel', 'jungle', 'natur', 'träd', 'alv'], name: 'Skog', mood: 'bright', pal: { bg1: '#8fd694', bg2: '#2e6b3a', ground: '#4a8a3a', top: '#7bc950', player: '#ff7b54', enemy: '#8a3ab9', coin: '#ffd23f', accent: '#ffe066', deco: '#d8f3dc' } },
    { words: ['hav', 'vatten', 'ocean', 'sea', 'under', 'fisk', 'fish', 'pirat', 'strand'], name: 'Hav', mood: 'bright', pal: { bg1: '#0b3d6b', bg2: '#0a6e8a', ground: '#d9b77a', top: '#f2d49b', player: '#ffb703', enemy: '#e63946', coin: '#ffe45e', accent: '#48cae4', deco: '#90e0ef' } },
    { words: ['neon', 'cyber', 'synth', 'retro', 'framtid', 'future', 'robot', 'hacker'], name: 'Neon', mood: 'dark', pal: { bg1: '#0d0221', bg2: '#261447', ground: '#2e1a47', top: '#ff2a6d', player: '#05d9e8', enemy: '#ff2a6d', coin: '#f9f871', accent: '#d1f7ff', deco: '#7b2fff' } },
    { words: ['godis', 'candy', 'söt', 'kaka', 'glass', 'rosa', 'enhörning', 'unicorn'], name: 'Godis', mood: 'bright', pal: { bg1: '#ffd6e8', bg2: '#ff8fc7', ground: '#b5838d', top: '#ffafcc', player: '#7b2cbf', enemy: '#3a86ff', coin: '#ffbe0b', accent: '#ff006e', deco: '#ffffff' } },
    { words: ['spöke', 'ghost', 'skräck', 'horror', 'zombie', 'halloween', 'natt', 'mörk'], name: 'Skräck', mood: 'dark', pal: { bg1: '#0b0c10', bg2: '#1f2833', ground: '#2b2b2b', top: '#5c5470', player: '#c5c6c7', enemy: '#8ac926', coin: '#ff9f1c', accent: '#b5179e', deco: '#66fcf1' } },
    { words: ['öken', 'desert', 'sand', 'pyramid', 'egypt', 'cowboy'], name: 'Öken', mood: 'bright', pal: { bg1: '#ffcf88', bg2: '#e07a3f', ground: '#c98b4a', top: '#f4c27a', player: '#3d5a80', enemy: '#9d0208', coin: '#fff3b0', accent: '#ffffff', deco: '#fff1d0' } },
  ];
  const SPACE = { name: 'Rymd', mood: 'dark', pal: { bg1: '#05060f', bg2: '#1a1446', ground: '#2c2a5a', top: '#6c63ff', player: '#4cc9f0', enemy: '#f72585', coin: '#ffd60a', accent: '#b8f2e6', deco: '#ffffff' } };
  const DEFAULT = { name: 'Nexora', mood: 'bright', pal: { bg1: '#1b1740', bg2: '#4b2a8a', ground: '#2d2366', top: '#8c7bff', player: '#38e1ff', enemy: '#ff4d8d', coin: '#ffd23f', accent: '#b69cff', deco: '#c9c1ff' } };

  const CONTROLS = {
    platformer: ['left', 'right', 'up'], shooter: ['left', 'right', 'up', 'down', 'action'], snake: ['left', 'right', 'up', 'down'],
    breakout: ['left', 'right', 'action'], dodger: ['left', 'right'], collector: ['left', 'right', 'up', 'down'],
    openworld: ['left', 'right', 'up', 'down', 'action'], runner3d: ['left', 'right', 'up'], arena3d: ['left', 'right', 'up', 'down'],
  };
  const HELP = {
    platformer: 'Pilar/WASD för att springa · Mellanslag/upp för att hoppa · hoppa på fiender',
    shooter: 'Pilar/WASD för att flyga · Mellanslag för att skjuta',
    snake: 'Pilar/WASD för att styra · ät och väx',
    breakout: 'Vänster/höger för racketen · Mellanslag för att serva',
    dodger: 'Vänster/höger för att väja · samla mynt',
    collector: 'Pilar/WASD för att röra dig · samla, undvik jägarna',
    openworld: 'Pilar/WASD för att gå · Mellanslag för att prata/slåss',
    runner3d: 'Vänster/höger byter fil · upp/mellanslag hoppar',
    arena3d: 'Vänster/höger svänger · upp kör framåt',
  };
  const TEMPLATE_FN = {
    platformer: 'gamePlatformer', shooter: 'gameShooter', snake: 'gameSnake', breakout: 'gameBreakout', dodger: 'gameDodger',
    collector: 'gameCollector', openworld: 'gameOpenWorld', runner3d: 'gameRunner3D', arena3d: 'gameArena3D',
  };

  const NAMES_A = ['Stjärn', 'Skugg', 'Kristall', 'Neon', 'Storm', 'Drak', 'Mån', 'Pixel', 'Frost', 'Glöd', 'Kosmo', 'Turbo'];
  const NAMES_B = ['jakten', 'flykten', 'riket', 'stormen', 'resan', 'kampen', 'legenden', 'rusningen', 'äventyret', 'mysteriet'];
  const PEOPLE = ['Astrid', 'Björn', 'Freja', 'Ivar', 'Saga', 'Leif', 'Ylva', 'Tor', 'Ebba', 'Sigge', 'Tilde', 'Rune', 'Maja', 'Ove'];
  const ROLES = ['smeden', 'fiskaren', 'magikern', 'bagaren', 'vakten', 'jägaren', 'bibliotekarien', 'handlaren', 'vandraren', 'drottningen'];
  const ITEMS = ['kristaller', 'svampar', 'runstenar', 'fjädrar', 'guldmynt', 'stjärnfragment', 'äpplen', 'nycklar', 'pärlor', 'örter'];
  const TRAITS = ['modig', 'misstänksam', 'glad', 'trött', 'nyfiken', 'grinig', 'hemlighetsfull', 'pratglad', 'klok', 'nervös'];
  const WANTS = ['vill hitta sin försvunna bror', 'drömmer om att se havet', 'samlar på gamla kartor', 'vill bli den bästa i byn', 'gömmer ett gammalt svärd', 'letar efter en botemedel mot förbannelsen'];

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function rngOf(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function titleFrom(prompt, r, theme) {
    const q = prompt.match(/["“”']([^"“”']{3,40})["“”']/);
    if (q) return q[1];
    const m = prompt.match(/(?:heter|kallat|kallas|named|called)\s+([A-ZÅÄÖa-zåäö0-9 ]{3,30})/i);
    if (m) return cap(m[1].trim());
    const pre = { Lava: 'Lava', Is: 'Is', Skog: 'Skogs', Hav: 'Havs', Neon: 'Neon', Godis: 'Godis', Skräck: 'Skugg', Öken: 'Öken', Rymd: 'Stjärn' }[theme.name];
    return (pre && r() < 0.75 ? pre : pick(r, NAMES_A)) + pick(r, NAMES_B);
  }

  function analyze(prompt, opts) {
    const p = ' ' + prompt.toLowerCase() + ' ';
    const seed = hash(prompt + (opts.variant || ''));
    const r = rngOf(seed);
    const want3d = opts.dim === '3d' || (opts.dim !== '2d' && has(p, [' 3d', '3d-', 'tredimension']));
    let genre = null, best = 0;
    for (const g of GENRES) if (g.d3 === want3d) { const n = score(p, g.words); if (n > best) { best = n; genre = g; } }
    if (!genre && want3d) genre = GENRES.find(g => g.id === (r() < 0.5 ? 'runner3d' : 'arena3d'));
    if (!genre) genre = has(p, ['multiplayer', 'två spelare', '2 spelare']) ? GENRES.find(g => g.id === 'collector') : pick(r, GENRES.filter(g => !g.d3 && g.id !== 'openworld'));
    if (genre.id === 'openworld' && !opts.allowOpenWorld) genre = GENRES.find(g => g.id === 'platformer');
    let theme = THEMES.find(t => has(p, t.words));
    if (!theme && (genre.id === 'shooter' || has(p, ['rymd', 'space', 'planet', 'stjärn']))) theme = SPACE;
    theme = theme || DEFAULT;
    const difficulty = has(p, ['svår', 'hard', 'brutal', 'omöjlig', 'utmanande']) ? 2 : has(p, ['lätt', 'easy', 'barn', 'kids', 'enkel', 'mysig']) ? 0 : 1;
    return { seed, r, genre, theme, difficulty, title: titleFrom(prompt, r, theme) };
  }

  function questsFor(a, n) {
    const r = rngOf(a.seed ^ 0xabc);
    return Array.from({ length: n }, (_, i) => {
      const giver = pick(r, PEOPLE) + ' ' + pick(r, ROLES), item = ITEMS[(a.seed + i * 3) % ITEMS.length], count = 3 + Math.floor(r() * 4);
      return {
        giver, item, count, text: 'Hitta ' + count + ' ' + item + '.',
        lines: [
          pick(r, ['Äntligen någon!', 'Hallå där, främling.', 'Vänta lite!', 'Du ser ut att kunna hjälpa till.']),
          pick(r, ['Stormen i natt spred ut allt jag ägde.', 'Någon har stulit mina saker.', 'Jag behöver dem för ett viktigt recept.', 'Utan dem faller ' + a.theme.name.toLowerCase() + 'riket.']),
        ],
        thanks: pick(r, ['Du är en sann hjälte!', 'Tack! Nu kan jag äntligen sova.', 'Otroligt! Ta den här belöningen.']),
      };
    });
  }

  function config(prompt, opts) {
    const a = analyze(prompt, opts);
    const g = a.genre.id;
    return {
      id: 'g' + a.seed.toString(36),
      seed: a.seed, genre: g, genreLabel: a.genre.label, dim: a.genre.d3 ? '3d' : '2d',
      title: a.title, tagline: a.genre.label + ' · ' + a.theme.name + '-tema',
      palette: a.theme.pal, mood: a.theme.mood, difficulty: a.difficulty,
      controls: CONTROLS[g], help: HELP[g], music: !!opts.music, sfx: opts.sfx !== false,
      bpm: a.theme.mood === 'dark' ? 104 : 124,
      players: opts.multiplayer && g === 'collector' ? 2 : 1,
      doubleJump: /dubbel|double/.test(prompt.toLowerCase()) || a.difficulty === 0,
      autofire: /auto/.test(prompt.toLowerCase()), wrap: /wrap|genom väggar/.test(prompt.toLowerCase()),
      quests: g === 'openworld' ? questsFor(a, opts.quests ? 4 : 2) : undefined,
      prompt,
    };
  }

  function buildHtml(cfg, rt) {
    const fn = rt.templates[TEMPLATE_FN[cfg.genre]];
    const esc = s => String(s).replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));
    const safeJson = JSON.stringify(cfg).replace(/</g, '\\u003c');
    return '<!doctype html>\n<html lang="sv"><head><meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n' +
      '<meta name="generator" content="Nexora">\n<title>' + esc(cfg.title) + '</title>\n' +
      '<style>html,body{margin:0;height:100%;overflow:hidden;background:' + cfg.palette.bg1 + ';touch-action:none}canvas{display:block}</' + 'style>\n' +
      '</head><body><canvas id="c"></canvas>\n<script>\n"use strict";\n' +
      rt.core + '\n' + fn.toString() + '\nNexoraRuntime(' + safeJson + ', ' + fn.name + ');\n</' + 'script></body></html>\n';
  }

  // ---------- text generators ----------
  function story(prompt) {
    const a = analyze(prompt, { dim: '2d' }), r = rngOf(a.seed ^ 11);
    const hero = pick(r, PEOPLE), villain = pick(r, ['Skuggkungen', 'Den Glömda', 'Järnhäxan', 'Mörkerdraken', 'Professor Kaos', 'Stormfursten']);
    const place = a.theme.name + 'landet';
    return [
      '# ' + a.title,
      '',
      '**Premiss.** I ' + place + ' har ' + villain + ' stulit ' + pick(r, ['ljuset', 'de sju kristallerna', 'tiden', 'alla färger', 'kungens krona']) + '. ' + hero + ', en ' + pick(r, TRAITS) + ' ' + pick(r, ROLES).replace(/n$/, '') + ', är den enda som inte har fallit i sömn.',
      '',
      '**Akt 1 – Uppvaknandet.** ' + hero + ' vaknar i en tyst by och hittar ett meddelande: "' + pick(r, ['Följ stjärnorna norrut.', 'Lita inte på spegeln.', 'Nyckeln är under bron.']) + '"',
      '',
      '**Akt 2 – Resan.** Genom ' + pick(r, ['de brinnande slätterna', 'den frusna skogen', 'labyrinten av neon', 'det sjunkna templet']) + ' möter ' + hero + ' allierade, men också ett svek från ' + pick(r, PEOPLE) + '.',
      '',
      '**Akt 3 – Striden.** I ' + villain + 's torn avslöjas sanningen: ' + pick(r, ['skurken var en gång hjälte.', hero + ' och skurken är syskon.', 'allt var en dröm – men dröm kan bli verklighet.', 'kristallerna var aldrig stulna, bara gömda.']),
      '',
      '**Slut.** ' + pick(r, ['Ljuset återvänder och byn firar i tre dagar.', 'Hjälten blir ny väktare över landet.', 'Ett nytt hot anas vid horisonten…']),
    ].join('\n');
  }
  function npcs(prompt, n) {
    const a = analyze(prompt, { dim: '2d' }), r = rngOf(a.seed ^ 22);
    return Array.from({ length: n || 4 }, () => {
      const name = pick(r, PEOPLE);
      return { name, role: pick(r, ROLES), trait: pick(r, TRAITS), want: pick(r, WANTS), line: pick(r, ['"Har du sett min katt?"', '"Här i ' + a.theme.name.toLowerCase() + 'landet händer inget… eller?"', '"Köp något eller gå vidare."', '"Jag vet mer än jag säger."']) };
    });
  }
  function quests(prompt, n) {
    const a = analyze(prompt, { dim: '2d' });
    return questsFor(a, n || 3).map(q => ({ title: cap(q.item) + ' åt ' + q.giver, giver: q.giver, goal: q.text, reward: (q.count * 50) + ' guld', steps: [q.lines[1], 'Utforska och samla ' + q.count + ' ' + q.item + '.', 'Återvänd till ' + q.giver.split(' ')[0] + '.'] }));
  }
  function dialog(prompt) {
    const list = npcs(prompt, 2), r = rngOf(hash(prompt) ^ 33);
    const [x, y] = list;
    return [
      x.name + ': ' + pick(r, ['Du igen?', 'Äntligen är du här.', 'Shh, inte så högt!']),
      y.name + ': ' + pick(r, ['Jag hörde vad som hände vid bron.', 'Vi har inte mycket tid.', 'Jag tog med kartan.']),
      x.name + ': ' + pick(r, ['Då vet du att vi måste gå i natt.', 'Kartan ljuger. Den har alltid ljugit.', 'Bra. Men vem kan vi lita på?']),
      y.name + ': ' + pick(r, ['Ingen. Bara varandra.', 'Smeden. Hon skyldar mig en tjänst.', 'Jag vet inte… men jag följer med.']),
      x.name + ': ' + pick(r, ['Då kör vi.', 'Ta facklan. Vi går.', 'Om vi inte kommer tillbaka – säg inget till mamma.']),
    ].join('\n');
  }

  // ---------- pixel sprite (SVG) ----------
  function sprite(prompt, size) {
    const a = analyze(prompt, { dim: '2d' }), r = rngOf(a.seed ^ 44), n = size || 12, pal = a.theme.pal;
    const colors = [pal.player, pal.accent, pal.enemy, pal.coin];
    const half = Math.ceil(n / 2), grid = [];
    for (let y = 0; y < n; y++) {
      grid.push([]);
      for (let x = 0; x < half; x++) {
        const dx = (x - half + 0.5) / half, dy = (y - n / 2 + 0.5) / (n / 2);
        const pr = 0.85 - Math.hypot(dx * 0.9, dy) * 0.9;
        grid[y][x] = r() < pr ? (r() < 0.75 ? 1 : 2) : 0;
      }
    }
    let rects = '';
    const c1 = pick(r, colors), c2 = pick(r, colors.filter(c => c !== c1));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = grid[y][x < half ? x : n - 1 - x];
      if (!v) continue;
      rects += '<rect x="' + x + '" y="' + y + '" width="1.02" height="1.02" fill="' + (v === 1 ? c1 : c2) + '"/>';
    }
    // outline + eyes
    const ey = Math.floor(n * 0.4);
    rects += '<rect x="' + (half - 3) + '" y="' + ey + '" width="1" height="1" fill="#fff"/><rect x="' + (n - half + 2) + '" y="' + ey + '" width="1" height="1" fill="#fff"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ' + (n + 2) + ' ' + (n + 2) + '" shape-rendering="crispEdges" width="256" height="256">' + rects + '</svg>';
  }

  // ---------- low-poly meshes ----------
  function mesh(prompt) {
    const p = prompt.toLowerCase(), a = analyze(prompt, { dim: '3d' }), r = rngOf(a.seed ^ 55), pal = a.theme.pal;
    const V = [], F = [], Cc = [];
    function add(vs, fs, col) { const o = V.length; vs.forEach(v => V.push(v)); fs.forEach(f => { F.push(f.map(i => i + o)); Cc.push(typeof col === 'function' ? col() : col); }); }
    function cyl(x, y, z, r0, r1, h, seg, col) {
      const vs = [], fs = [];
      for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2; vs.push([x + Math.cos(t) * r0, y, z + Math.sin(t) * r0]); vs.push([x + Math.cos(t) * r1, y + h, z + Math.sin(t) * r1]); }
      for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; fs.push([i * 2, j * 2, j * 2 + 1, i * 2 + 1]); }
      const bot = [], top = []; for (let i = 0; i < seg; i++) { bot.push(i * 2); top.push(i * 2 + 1); }
      fs.push(bot); if (r1 > 0.001) fs.push(top.reverse());
      add(vs, fs, col);
    }
    function boxm(x, y, z, sx, sy, sz, col) {
      const vs = []; for (let i = 0; i < 8; i++) vs.push([x + (i & 1 ? sx : -sx) / 2, y + (i & 2 ? sy : 0), z + (i & 4 ? sz : -sz) / 2]);
      add(vs, [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]], col);
    }
    function rock(x, y, z, s, col) {
      const vs = [], fs = [], seg = 7;
      vs.push([x, y + s * (1.1 + r() * 0.4), z]);
      for (let i = 0; i < seg; i++) { const t = i / seg * Math.PI * 2, rr = s * (0.8 + r() * 0.4); vs.push([x + Math.cos(t) * rr, y + s * 0.45 * r(), z + Math.sin(t) * rr]); }
      for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; fs.push([0, 1 + i, 1 + j]); }
      const base = []; for (let i = 0; i < seg; i++) base.push(1 + i); fs.push(base);
      add(vs, fs, col);
    }
    let name;
    if (has(p, ['träd', 'tree', 'gran', 'skog'])) {
      name = 'Träd'; cyl(0, 0, 0, 0.18, 0.12, 1.2, 6, '#7a4a2a');
      for (let i = 0; i < 3; i++) cyl(0, 0.9 + i * 0.55, 0, 0.95 - i * 0.25, 0.001, 1.0, 8, i % 2 ? '#2f8f46' : '#3fae57');
    } else if (has(p, ['hus', 'house', 'stuga', 'hem'])) {
      name = 'Hus'; boxm(0, 0, 0, 2, 1.3, 1.6, '#e9d8a6');
      add([[-1.1, 1.3, -0.9], [1.1, 1.3, -0.9], [1.1, 1.3, 0.9], [-1.1, 1.3, 0.9], [0, 2.1, -0.9], [0, 2.1, 0.9]], [[0, 1, 4], [3, 5, 2], [0, 4, 5, 3], [1, 2, 5, 4]], '#ae2012');
      boxm(0, 0, -0.81, 0.4, 0.8, 0.04, '#6b3e26'); boxm(0.6, 0.6, -0.81, 0.35, 0.35, 0.04, '#9bd1ff');
    } else if (has(p, ['skepp', 'ship', 'rymdskepp', 'spaceship', 'raket', 'rocket'])) {
      name = 'Rymdskepp'; cyl(0, 0, 0, 0.45, 0.001, 2.2, 8, pal.player); cyl(0, -0.4, 0, 0.3, 0.45, 0.4, 8, pal.accent);
      add([[0, 0.2, 0], [1.2, -0.3, 0], [0, 1, 0]], [[0, 1, 2]], pal.enemy); add([[0, 0.2, 0], [-1.2, -0.3, 0], [0, 1, 0]], [[0, 1, 2]], pal.enemy);
      add([[0, 0.2, 0], [0, -0.3, 1.2], [0, 1, 0]], [[0, 1, 2]], pal.enemy);
    } else if (has(p, ['bil', 'car', 'racer'])) {
      name = 'Bil'; boxm(0, 0.25, 0, 1.2, 0.45, 2.2, pal.enemy); boxm(0, 0.7, -0.1, 1.0, 0.4, 1.1, '#9bd1ff');
      [[-0.62, 0.7], [0.62, 0.7], [-0.62, -0.7], [0.62, -0.7]].forEach(([x, z]) => cyl(x, 0, z, 0.26, 0.26, 0.2, 8, '#222'));
    } else if (has(p, ['kristall', 'crystal', 'diamant', 'gem', 'ädelsten'])) {
      name = 'Kristall';
      for (let i = 0; i < 5; i++) { const a2 = r() * 6.28, d = i ? 0.35 + r() * 0.3 : 0; cyl(Math.cos(a2) * d, 0, Math.sin(a2) * d, 0.22 + r() * 0.1, 0.001, 0.9 + r() * 1.3, 6, () => pick(r, [pal.accent, pal.player, '#c8b6ff'])); }
    } else if (has(p, ['torn', 'tower', 'slott', 'castle', 'borg'])) {
      name = 'Torn'; cyl(0, 0, 0, 0.8, 0.7, 2.6, 10, '#b8b8c8');
      for (let i = 0; i < 8; i++) { const t = i / 8 * 6.28; boxm(Math.cos(t) * 0.68, 2.6, Math.sin(t) * 0.68, 0.25, 0.3, 0.25, '#9a9ab0'); }
      cyl(0, 2.6, 0, 0.6, 0.001, 1.1, 10, pal.enemy);
    } else if (has(p, ['karaktär', 'character', 'gubbe', 'hjälte', 'hero', 'robot', 'figur'])) {
      name = 'Karaktär'; boxm(0, 0.9, 0, 0.8, 0.9, 0.45, pal.player); boxm(0, 1.85, 0, 0.55, 0.55, 0.55, '#f2d2b0');
      boxm(-0.18, 0, 0, 0.28, 0.9, 0.3, '#334'); boxm(0.18, 0, 0, 0.28, 0.9, 0.3, '#334');
      boxm(-0.55, 1.05, 0, 0.22, 0.75, 0.25, pal.player); boxm(0.55, 1.05, 0, 0.22, 0.75, 0.25, pal.player);
      boxm(-0.12, 2.0, -0.28, 0.08, 0.08, 0.02, '#111'); boxm(0.12, 2.0, -0.28, 0.08, 0.08, 0.02, '#111');
    } else {
      name = 'Sten'; rock(0, 0, 0, 1, '#8d8d99'); rock(0.9, 0, 0.4, 0.5, '#7a7a88'); rock(-0.7, 0, -0.5, 0.4, '#9a9aa8');
    }
    return { name, vertices: V.map(v => v.map(n => Math.round(n * 1000) / 1000)), faces: F, colors: Cc };
  }

  function toObj(m) {
    let s = '# Nexora 3D 1 – ' + (m.name || 'modell') + '\n';
    m.vertices.forEach(v => { s += 'v ' + v.join(' ') + '\n'; });
    m.faces.forEach(f => { s += 'f ' + f.map(i => i + 1).join(' ') + '\n'; });
    return s;
  }

  // ---------- audio rendering (music + sfx) to WAV ----------
  function wav(buffer) {
    const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
    out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }
  function note(ctx, dest, f, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(ctx, dest, t, kind) {
    if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32); return; }
    const len = kind === 'snare' ? 0.18 : 0.05, b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = kind === 'snare' ? 1200 : 7000; g.gain.value = kind === 'snare' ? 0.35 : 0.15;
    s.buffer = b; s.connect(hp); hp.connect(g); g.connect(dest); s.start(t);
  }
  async function music(prompt, seconds) {
    const a = analyze(prompt, { dim: '2d' }), r = rngOf(a.seed ^ 66), p = prompt.toLowerCase();
    const dark = a.theme.mood === 'dark' || has(p, ['sorg', 'mörk', 'sad', 'boss', 'skräck', 'dramatisk']);
    const bpm = has(p, ['snabb', 'fast', 'action', 'boss', 'energi']) ? 150 : has(p, ['lugn', 'calm', 'chill', 'mysig', 'meny']) ? 84 : 118;
    const sr = 44100, len = seconds || 24, ctx = new OfflineAudioContext(2, sr * len, sr);
    const master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    const scale = dark ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const prog = dark ? [0, 5, 3, 4] : pick(r, [[0, 4, 5, 3], [0, 3, 4, 4], [0, 5, 3, 4]]);
    const root = 110 * Math.pow(2, Math.floor(r() * 7) / 12), beat = 60 / bpm;
    const lead = pick(r, ['square', 'triangle', 'sawtooth']);
    const motif = Array.from({ length: 8 }, () => (r() < 0.8 ? Math.floor(r() * 7) : null));
    const f = deg => root * Math.pow(2, (scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)) / 12);
    for (let bar = 0; bar * 4 * beat < len; bar++) {
      const t0 = bar * 4 * beat, chord = prog[bar % 4];
      [0, 2, 4].forEach(d => note(ctx, master, f(chord + d) * 2, t0, beat * 3.8, 'sine', 0.06));
      for (let b = 0; b < 4; b++) {
        note(ctx, master, f(chord) / 2, t0 + b * beat, beat * 0.9, 'triangle', 0.22);
        drum(ctx, master, t0 + b * beat, b % 2 ? 'snare' : 'kick');
        drum(ctx, master, t0 + b * beat + beat / 2, 'hat');
      }
      if (bar >= 2) for (let i = 0; i < 8; i++) {
        const m = motif[(i + bar * (bar % 3)) % 8];
        if (m !== null) note(ctx, master, f(chord + m) * 4, t0 + i * beat / 2, beat * 0.45, lead, 0.07);
      }
    }
    const buf = await ctx.startRendering();
    return { blob: wav(buf), bpm, mood: dark ? 'moll' : 'dur', seconds: len };
  }
  async function sfx(kind, seed) {
    const sr = 44100, ctx = new OfflineAudioContext(1, sr * 0.8, sr), r = rngOf(hash(kind + seed));
    const g = ctx.createGain(); g.gain.value = 0.7; g.connect(ctx.destination);
    const o = ctx.createOscillator(), env = ctx.createGain(); o.connect(env); env.connect(g);
    const j = 0.8 + r() * 0.4;
    const set = (type, f0, f1, dur) => { o.type = type; o.frequency.setValueAtTime(f0 * j, 0); o.frequency.exponentialRampToValueAtTime(f1 * j, dur); env.gain.setValueAtTime(0.6, 0); env.gain.exponentialRampToValueAtTime(0.001, dur); o.start(0); o.stop(dur + 0.02); };
    if (kind === 'hopp') set('square', 260, 780, 0.22);
    else if (kind === 'mynt') { o.type = 'square'; o.frequency.setValueAtTime(988 * j, 0); o.frequency.setValueAtTime(1319 * j, 0.07); env.gain.setValueAtTime(0.5, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.35); o.start(0); o.stop(0.4); }
    else if (kind === 'laser') set('sawtooth', 1600, 120, 0.25);
    else if (kind === 'powerup') { o.type = 'triangle'; [523, 659, 784, 1047, 1319].forEach((fq, i) => o.frequency.setValueAtTime(fq * j, i * 0.06)); env.gain.setValueAtTime(0.5, 0); env.gain.exponentialRampToValueAtTime(0.001, 0.5); o.start(0); o.stop(0.52); }
    else if (kind === 'träff') set('sawtooth', 300, 50, 0.3);
    else { // explosion
      o.type = 'sine'; o.frequency.value = 60; env.gain.setValueAtTime(0.001, 0); o.start(0); o.stop(0.1);
      const b = ctx.createBuffer(1, sr * 0.7, sr), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, 0); lp.frequency.exponentialRampToValueAtTime(200, 0.6);
      s.buffer = b; s.connect(lp); lp.connect(g); s.start(0);
    }
    return wav(await ctx.startRendering());
  }

  window.NexoraLocal = { hash, analyze, config, buildHtml, story, npcs, quests, dialog, sprite, mesh, toObj, music, sfx, wav, GENRES, TEMPLATE_FN };
})();
