/* ==========================================================================
   data.js — frågegenerator, kategorier, prestationer, butik, lobbydata
   ========================================================================== */
(function (M) {
  'use strict';

  var rnd = function (a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  M.rnd = rnd;
  M.pick = pick;

  M.DIFFS = [
    { id: 1, name: 'Lätt', time: 26 },
    { id: 2, name: 'Medel', time: 21 },
    { id: 3, name: 'Svår', time: 17 },
    { id: 4, name: 'Extrem', time: 13 }
  ];

  M.CATEGORIES = [
    { id: 'add', name: 'Addition', icon: '➕' },
    { id: 'sub', name: 'Subtraktion', icon: '➖' },
    { id: 'mul', name: 'Multiplikation', icon: '✖️' },
    { id: 'div', name: 'Division', icon: '➗' },
    { id: 'pow', name: 'Potenser & rötter', icon: '🔢' },
    { id: 'pct', name: 'Procent', icon: '％' },
    { id: 'frac', name: 'Bråk', icon: '🍰' },
    { id: 'eq', name: 'Ekvationer', icon: '🧮' },
    { id: 'geo', name: 'Geometri', icon: '📐' },
    { id: 'neg', name: 'Negativa tal', icon: '🧊' },
    { id: 'seq', name: 'Talföljder', icon: '🔗' },
    { id: 'prime', name: 'Primtal', icon: '🔍' }
  ];

  M.catName = function (id) {
    for (var i = 0; i < M.CATEGORIES.length; i++) if (M.CATEGORIES[i].id === id) return M.CATEGORIES[i].name;
    return 'Blandat';
  };

  /* ---------- Frågegenerator ---------------------------------------------- */

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function makeQuestion(cat, d) {
    var a, b, c, x, ans, text, opts;

    switch (cat) {
      case 'add':
        if (d === 1) { a = rnd(2, 20); b = rnd(2, 19); }
        else if (d === 2) { a = rnd(12, 89); b = rnd(12, 89); }
        else if (d === 3) { a = rnd(120, 899); b = rnd(120, 899); }
        else { a = rnd(1200, 8999); b = rnd(1200, 8999); }
        ans = a + b; text = a + ' + ' + b;
        if (d === 4 && Math.random() < .5) { c = rnd(100, 999); ans += c; text += ' + ' + c; }
        break;

      case 'sub':
        if (d === 1) { a = rnd(8, 25); b = rnd(1, a); }
        else if (d === 2) { a = rnd(30, 99); b = rnd(10, a); }
        else if (d === 3) { a = rnd(150, 900); b = rnd(50, 850); }
        else { a = rnd(1000, 9000); b = rnd(500, 8000); }
        ans = a - b; text = a + ' − ' + b;
        break;

      case 'mul':
        if (d === 1) { a = rnd(2, 10); b = rnd(2, 10); }
        else if (d === 2) { a = rnd(3, 12); b = rnd(4, 19); }
        else if (d === 3) { a = rnd(12, 39); b = rnd(11, 29); }
        else { a = rnd(21, 99); b = rnd(21, 99); }
        ans = a * b; text = a + ' × ' + b;
        break;

      case 'div':
        if (d === 1) { b = rnd(2, 9); ans = rnd(2, 10); }
        else if (d === 2) { b = rnd(3, 12); ans = rnd(4, 15); }
        else if (d === 3) { b = rnd(6, 19); ans = rnd(6, 25); }
        else { b = rnd(12, 29); ans = rnd(11, 44); }
        a = b * ans; text = a + ' ÷ ' + b;
        break;

      case 'pow':
        if (d === 1) { a = rnd(2, 12); ans = a * a; text = a + '²'; }
        else if (d === 2) {
          if (Math.random() < .5) { a = rnd(2, 6); ans = a * a * a; text = a + '³'; }
          else { a = rnd(4, 15); ans = a; text = '√' + (a * a); }
        } else if (d === 3) {
          if (Math.random() < .5) { a = rnd(13, 25); ans = a * a; text = a + '²'; }
          else { a = rnd(2, 4); b = rnd(3, 6); ans = Math.pow(a, b); text = a + '^' + b; }
        } else {
          if (Math.random() < .5) { a = rnd(2, 5); b = rnd(4, 8); ans = Math.pow(a, b); text = a + '^' + b; }
          else { a = rnd(16, 40); ans = a; text = '√' + (a * a); }
        }
        break;

      case 'pct':
        if (d === 1) { a = pick([10, 25, 50, 100]); b = pick([20, 40, 60, 80, 200]); }
        else if (d === 2) { a = pick([5, 15, 20, 30, 75]); b = pick([40, 60, 120, 200, 300]); }
        else { a = pick([12, 18, 35, 45, 65]); b = pick([80, 140, 220, 360, 500]); }
        if (d === 4) { a = rnd(3, 97); b = pick([200, 400, 800, 1200]); }
        ans = Math.round(a * b / 100); text = a + '% av ' + b;
        break;

      case 'frac':
        if (d <= 2) {
          b = pick([4, 5, 6, 8, 10, 12]);
          a = rnd(1, b - 1); c = rnd(1, b - a);
          ans = Math.round((a + c) / b * 100);
          text = a + '/' + b + ' + ' + c + '/' + b + ' i %';
        } else {
          b = pick([2, 4, 5, 8]); c = pick([3, 6, 10, 20]);
          a = rnd(1, b - 1); x = rnd(1, c - 1);
          ans = Math.round((a / b + x / c) * 100);
          text = a + '/' + b + ' + ' + x + '/' + c + ' i %';
        }
        break;

      case 'eq':
        if (d === 1) { a = 1; x = rnd(2, 15); b = rnd(1, 20); }
        else if (d === 2) { a = rnd(2, 6); x = rnd(2, 12); b = rnd(1, 25); }
        else if (d === 3) { a = rnd(3, 11); x = rnd(3, 20); b = rnd(-30, 40); }
        else { a = rnd(4, 15); x = rnd(-12, 25); b = rnd(-60, 80); }
        ans = x;
        text = (a === 1 ? 'x' : a + 'x') + (b < 0 ? ' − ' + Math.abs(b) : ' + ' + b) + ' = ' + (a * x + b);
        break;

      case 'geo':
        c = rnd(1, d >= 3 ? 4 : 3);
        if (c === 1) { a = rnd(3, d * 9); b = rnd(3, d * 9); ans = a * b; text = 'Area av rektangel ' + a + '×' + b; }
        else if (c === 2) { a = rnd(4, d * 8) * 2; b = rnd(3, d * 8); ans = a * b / 2; text = 'Area av triangel b=' + a + ' h=' + b; }
        else if (c === 3) { a = rnd(3, d * 9); b = rnd(3, d * 9); ans = 2 * (a + b); text = 'Omkrets av rektangel ' + a + '×' + b; }
        else { a = rnd(2, 9); ans = a * a * a; text = 'Volym av kub med sidan ' + a; }
        break;

      case 'neg':
        if (d <= 2) { a = rnd(-20, -1); b = rnd(-15, 15); ans = a + b; text = '(' + a + ') + (' + b + ')'; }
        else if (d === 3) { a = rnd(-30, -2); b = rnd(2, 12); ans = a * b; text = '(' + a + ') × ' + b; }
        else { a = rnd(-14, -2); b = rnd(-14, -2); ans = a * b; text = '(' + a + ') × (' + b + ')'; }
        break;

      case 'seq':
        c = rnd(1, d >= 3 ? 3 : 2);
        a = rnd(1, 12);
        if (c === 1) { b = rnd(2, d * 4); ans = a + b * 4; text = [a, a + b, a + 2 * b, a + 3 * b, '?'].join(', '); }
        else if (c === 2) { b = rnd(2, 3); ans = a * Math.pow(b, 4); text = [a, a * b, a * b * b, a * b * b * b, '?'].join(', '); }
        else { ans = (a + 4) * (a + 4); text = [a * a, (a + 1) * (a + 1), (a + 2) * (a + 2), (a + 3) * (a + 3), '?'].join(', '); }
        break;

      case 'prime':
      default:
        var primes = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
        if (d >= 3) primes = primes.concat([101, 103, 107, 109, 113, 127, 131, 137, 139, 149]);
        ans = pick(primes);
        text = 'Vilket tal är ett primtal?';
        var fake = [];
        while (fake.length < 3) {
          var f = rnd(ans - 12, ans + 12);
          if (f > 3 && f !== ans && !isPrime(f) && fake.indexOf(f) < 0) fake.push(f);
        }
        opts = fake.concat([ans]);
        break;
    }

    if (!opts) opts = distractors(ans, cat, d);
    opts = shuffle(opts);

    return {
      cat: cat,
      diff: d,
      text: text,
      answer: ans,
      options: opts.map(String),
      correct: opts.indexOf(ans)
    };
  }

  function isPrime(n) {
    if (n < 2) return false;
    for (var i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }

  function distractors(ans, cat, d) {
    var out = [ans], guard = 0;
    var span = Math.max(2, Math.round(Math.abs(ans) * (cat === 'mul' || cat === 'pow' ? .12 : .2)) + d);
    while (out.length < 4 && guard++ < 200) {
      var cand;
      var roll = Math.random();
      if (roll < .3) cand = ans + (Math.random() < .5 ? 1 : -1) * rnd(1, 3);
      else if (roll < .55) cand = ans + (Math.random() < .5 ? 1 : -1) * rnd(1, span);
      else if (roll < .7 && Math.abs(ans) > 9) cand = ans + (Math.random() < .5 ? 10 : -10);
      else cand = ans + (Math.random() < .5 ? 1 : -1) * rnd(2, span + 6);
      if (cand !== ans && out.indexOf(cand) < 0) out.push(cand);
    }
    while (out.length < 4) out.push(ans + out.length * 7 + 1);
    return out;
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  M.shuffle = shuffle;

  M.question = function (cat, diff) {
    var c = (!cat || cat === 'mix') ? pick(M.CATEGORIES).id : cat;
    return makeQuestion(c, diff || 1);
  };

  /* ---------- Botar & lobbies -------------------------------------------- */

  M.BOT_NAMES = [
    'Ludvig', 'Vera', 'Milo', 'Saga', 'Nour', 'Elvin', 'Alma', 'Kian', 'Freja', 'Osman',
    'Tindra', 'Hugo', 'Liv', 'Malte', 'Sanna', 'Aron', 'Ester', 'Zaid', 'Nova', 'Ines',
    'Vidar', 'Juni', 'Elias', 'Wilma', 'Sixten', 'Maja', 'Theo', 'Ronja', 'Ali', 'Signe'
  ];

  M.AVATARS = ['🦊', '🐼', '🐸', '🦉', '🐯', '🐨', '🐺', '🦄', '🐧', '🦁', '🐙', '🦖', '🐝', '🦈', '🐳', '🦩'];

  M.LOBBY_TEMPLATES = [
    { name: 'Nybörjarhörnan', flag: '🌱', diff: 1, cat: 'mix', mode: 'potato', max: 6 },
    { name: 'Gångertabellen', flag: '✖️', diff: 2, cat: 'mul', mode: 'potato', max: 6 },
    { name: 'Snabba Ryck', flag: '⚡', diff: 2, cat: 'mix', mode: 'blitz', max: 5 },
    { name: 'Ekvationsklubben', flag: '🧮', diff: 3, cat: 'eq', mode: 'potato', max: 5 },
    { name: 'Procentpartyt', flag: '％', diff: 2, cat: 'pct', mode: 'potato', max: 6 },
    { name: 'Kaosbomben', flag: '💣', diff: 4, cat: 'mix', mode: 'potato', max: 8 },
    { name: 'Bråkbaren', flag: '🍰', diff: 3, cat: 'frac', mode: 'potato', max: 4 },
    { name: 'Geometrigänget', flag: '📐', diff: 2, cat: 'geo', mode: 'potato', max: 6 },
    { name: 'Primtalsjakten', flag: '🔍', diff: 3, cat: 'prime', mode: 'potato', max: 5 },
    { name: 'Duellarenan', flag: '⚔️', diff: 3, cat: 'mix', mode: 'duel', max: 2 },
    { name: 'Nattugglorna', flag: '🦉', diff: 3, cat: 'mix', mode: 'potato', max: 6 },
    { name: 'Potensfabriken', flag: '🔢', diff: 4, cat: 'pow', mode: 'potato', max: 5 },
    { name: 'Minusträsket', flag: '🧊', diff: 3, cat: 'neg', mode: 'potato', max: 6 },
    { name: 'Talföljdslabbet', flag: '🔗', diff: 4, cat: 'seq', mode: 'potato', max: 4 },
    { name: 'Familjekvarten', flag: '🏠', diff: 1, cat: 'mix', mode: 'potato', max: 8 }
  ];

  M.MODES = {
    potato: { name: 'Het bomb', icon: '💣', desc: 'Svara rätt och kasta bomben vidare. Sist kvar vinner.' },
    blitz: { name: 'Blixt', icon: '⚡', desc: '60 sekunder — flest rätta svar vinner.' },
    survival: { name: 'Överlevnad', icon: '🛡️', desc: 'Ensam mot klockan som blir snabbare för varje svar.' },
    duel: { name: 'Duell', icon: '⚔️', desc: '1 mot 1. Bomben studsar tills någon faller.' },
    practice: { name: 'Träning', icon: '🎯', desc: 'Ingen klocka, ingen press. Öva fritt.' },
    daily: { name: 'Dagens utmaning', icon: '📅', desc: '10 frågor. Samma för alla varje dag.' }
  };

  M.POWERUPS = {
    freeze: { name: 'Frys', icon: '⏸️', desc: 'Pausar bomben i 4 sekunder.' },
    skip: { name: 'Hoppa', icon: '⏭️', desc: 'Byter ut frågan mot en ny.' },
    shield: { name: 'Sköld', icon: '🛡️', desc: 'Studsar tillbaka nästa bomb som kastas på dig.' },
    swap: { name: 'Kasta', icon: '🔀', desc: 'Kastar bomben direkt utan att svara.' },
    x2: { name: 'Dubbel', icon: '💎', desc: 'Dubbel XP resten av matchen.' }
  };

  /* ---------- Butik ------------------------------------------------------- */

  M.SHOP = [
    { id: 'av_unicorn', type: 'avatar', name: 'Enhörning', icon: '🦄', cost: 120 },
    { id: 'av_dino', type: 'avatar', name: 'Dino', icon: '🦖', cost: 150 },
    { id: 'av_shark', type: 'avatar', name: 'Haj', icon: '🦈', cost: 180 },
    { id: 'av_octo', type: 'avatar', name: 'Bläckfisk', icon: '🐙', cost: 200 },
    { id: 'av_alien', type: 'avatar', name: 'Rymdis', icon: '👾', cost: 260 },
    { id: 'av_robot', type: 'avatar', name: 'Robot', icon: '🤖', cost: 300 },
    { id: 'av_ninja', type: 'avatar', name: 'Ninja', icon: '🥷', cost: 420 },
    { id: 'av_wizard', type: 'avatar', name: 'Trollkarl', icon: '🧙', cost: 500 },
    { id: 'th_mint', type: 'theme', name: 'Mynta', icon: '🌿', cost: 200, theme: 'mint' },
    { id: 'th_sunset', type: 'theme', name: 'Solnedgång', icon: '🌇', cost: 250, theme: 'sunset' },
    { id: 'th_ocean', type: 'theme', name: 'Ocean', icon: '🌊', cost: 250, theme: 'ocean' },
    { id: 'th_light', type: 'theme', name: 'Dagsljus', icon: '☀️', cost: 300, theme: 'light' },
    { id: 'th_matrix', type: 'theme', name: 'Matrix', icon: '🟩', cost: 600, theme: 'matrix' },
    { id: 'th_gold', type: 'theme', name: 'Guldkant', icon: '👑', cost: 900, theme: 'gold' },
    { id: 'bo_bomb', type: 'bomb', name: 'Klassisk bomb', icon: '💣', cost: 0 },
    { id: 'bo_fire', type: 'bomb', name: 'Eldklot', icon: '🔥', cost: 150 },
    { id: 'bo_ice', type: 'bomb', name: 'Isklump', icon: '🧊', cost: 150 },
    { id: 'bo_star', type: 'bomb', name: 'Stjärnfall', icon: '🌟', cost: 320 },
    { id: 'bo_skull', type: 'bomb', name: 'Dödskallen', icon: '💀', cost: 480 },
    { id: 'bo_atom', type: 'bomb', name: 'Atomen', icon: '⚛️', cost: 750 }
  ];

  /* ---------- Prestationer ------------------------------------------------
     stat: nyckel i profile.stats, goal: mål, r: sällsynthet, c: belöning
     ---------------------------------------------------------------------- */

  M.ACHIEVEMENTS = [
    // Första stegen
    { id: 'first_game', g: 'start', n: 'Första matchen', d: 'Spela din första match.', i: '🎬', stat: 'gamesPlayed', goal: 1, r: 'vanlig', c: 20 },
    { id: 'first_correct', g: 'start', n: 'Ett rätt är ett rätt', d: 'Svara rätt på din första fråga.', i: '✅', stat: 'correct', goal: 1, r: 'vanlig', c: 10 },
    { id: 'first_win', g: 'start', n: 'Vinnarskalle', d: 'Vinn din första match.', i: '🥇', stat: 'wins', goal: 1, r: 'vanlig', c: 40 },
    { id: 'first_throw', g: 'start', n: 'Här får du!', d: 'Kasta bomben vidare en gång.', i: '🤾', stat: 'throws', goal: 1, r: 'vanlig', c: 15 },
    { id: 'first_lobby', g: 'start', n: 'Sällskapssjuk', d: 'Gå med i en lobby.', i: '🚪', stat: 'lobbiesJoined', goal: 1, r: 'vanlig', c: 15 },

    // Rätta svar
    { id: 'correct_25', g: 'svar', n: 'Räknenisse', d: 'Svara rätt 25 gånger.', i: '🧠', stat: 'correct', goal: 25, r: 'vanlig', c: 30 },
    { id: 'correct_100', g: 'svar', n: 'Hundra rätt', d: 'Svara rätt 100 gånger.', i: '💯', stat: 'correct', goal: 100, r: 'ovanlig', c: 70 },
    { id: 'correct_500', g: 'svar', n: 'Mattemaskin', d: 'Svara rätt 500 gånger.', i: '⚙️', stat: 'correct', goal: 500, r: 'sallsynt', c: 200 },
    { id: 'correct_1000', g: 'svar', n: 'Tusenkonstnär', d: 'Svara rätt 1000 gånger.', i: '🏛️', stat: 'correct', goal: 1000, r: 'episk', c: 400 },
    { id: 'correct_2500', g: 'svar', n: 'Räknesnille', d: 'Svara rätt 2500 gånger.', i: '🦾', stat: 'correct', goal: 2500, r: 'episk', c: 800 },
    { id: 'correct_5000', g: 'svar', n: 'Mattenitmästare', d: 'Svara rätt 5000 gånger.', i: '🌌', stat: 'correct', goal: 5000, r: 'legendarisk', c: 1500 },
    { id: 'wrong_50', g: 'svar', n: 'Lärt av misstagen', d: 'Svara fel 50 gånger — och fortsätt ändå.', i: '🩹', stat: 'wrong', goal: 50, r: 'vanlig', c: 40 },
    { id: 'answers_2000', g: 'svar', n: 'Uthållig', d: 'Besvara 2000 frågor totalt.', i: '📚', stat: 'answers', goal: 2000, r: 'episk', c: 350 },

    // Svit
    { id: 'streak_5', g: 'svit', n: 'Varm', d: 'Få 5 rätt i rad.', i: '🔥', stat: 'bestStreak', goal: 5, r: 'vanlig', c: 25 },
    { id: 'streak_10', g: 'svit', n: 'Glödhet', d: 'Få 10 rätt i rad.', i: '🌋', stat: 'bestStreak', goal: 10, r: 'ovanlig', c: 60 },
    { id: 'streak_20', g: 'svit', n: 'Obruten', d: 'Få 20 rätt i rad.', i: '⛓️', stat: 'bestStreak', goal: 20, r: 'sallsynt', c: 140 },
    { id: 'streak_35', g: 'svit', n: 'Osannolik', d: 'Få 35 rätt i rad.', i: '☄️', stat: 'bestStreak', goal: 35, r: 'episk', c: 300 },
    { id: 'streak_50', g: 'svit', n: 'Femtio i följd', d: 'Få 50 rätt i rad.', i: '🪐', stat: 'bestStreak', goal: 50, r: 'legendarisk', c: 800 },

    // Segrar
    { id: 'wins_5', g: 'seger', n: 'Fempoängaren', d: 'Vinn 5 matcher.', i: '🏅', stat: 'wins', goal: 5, r: 'vanlig', c: 50 },
    { id: 'wins_25', g: 'seger', n: 'Lobbyns skräck', d: 'Vinn 25 matcher.', i: '👑', stat: 'wins', goal: 25, r: 'ovanlig', c: 150 },
    { id: 'wins_50', g: 'seger', n: 'Femtio segrar', d: 'Vinn 50 matcher.', i: '🎗️', stat: 'wins', goal: 50, r: 'sallsynt', c: 250 },
    { id: 'wins_100', g: 'seger', n: 'Hundra segrar', d: 'Vinn 100 matcher.', i: '🏆', stat: 'wins', goal: 100, r: 'episk', c: 500 },
    { id: 'win_streak_3', g: 'seger', n: 'Hattrick', d: 'Vinn 3 matcher i rad.', i: '🎩', stat: 'bestWinStreak', goal: 3, r: 'ovanlig', c: 80 },
    { id: 'win_streak_7', g: 'seger', n: 'Veckans kung', d: 'Vinn 7 matcher i rad.', i: '📈', stat: 'bestWinStreak', goal: 7, r: 'sallsynt', c: 200 },
    { id: 'perfect_game', g: 'seger', n: 'Felfri', d: 'Vinn en match utan ett enda fel.', i: '💎', stat: 'perfectGames', goal: 1, r: 'sallsynt', c: 120 },
    { id: 'perfect_5', g: 'seger', n: 'Kirurgen', d: 'Vinn 5 felfria matcher.', i: '🔬', stat: 'perfectGames', goal: 5, r: 'episk', c: 300 },
    { id: 'flawless_lives', g: 'seger', n: 'Utan en skråma', d: 'Vinn en match med alla liv kvar.', i: '❤️', stat: 'fullLifeWins', goal: 1, r: 'ovanlig', c: 90 },
    { id: 'comeback', g: 'seger', n: 'Comeback', d: 'Vinn en match med bara ett liv kvar.', i: '🫀', stat: 'comebacks', goal: 1, r: 'sallsynt', c: 130 },
    { id: 'comeback_5', g: 'seger', n: 'Kung av kanten', d: 'Gör 5 comebacks.', i: '🧗', stat: 'comebacks', goal: 5, r: 'episk', c: 320 },
    { id: 'win_hard', g: 'seger', n: 'Svårt värre', d: 'Vinn en match på Svår.', i: '🥊', stat: 'hardWins', goal: 1, r: 'ovanlig', c: 80 },
    { id: 'win_extreme', g: 'seger', n: 'Extremist', d: 'Vinn en match på Extrem.', i: '☢️', stat: 'extremeWins', goal: 1, r: 'sallsynt', c: 180 },
    { id: 'win_extreme_10', g: 'seger', n: 'Bombexpert', d: 'Vinn 10 matcher på Extrem.', i: '🧨', stat: 'extremeWins', goal: 10, r: 'legendarisk', c: 700 },
    { id: 'win_big_lobby', g: 'seger', n: 'Folkmassan', d: 'Vinn en match med minst 6 spelare.', i: '👥', stat: 'bigLobbyWins', goal: 1, r: 'sallsynt', c: 160 },
    { id: 'win_no_pw', g: 'seger', n: 'Purist', d: 'Vinn utan att använda en enda power-up.', i: '🧘', stat: 'pureWins', goal: 1, r: 'sallsynt', c: 150 },

    // Bomb & kast
    { id: 'throws_50', g: 'bomb', n: 'Kastarmen', d: 'Kasta bomben 50 gånger.', i: '🎯', stat: 'throws', goal: 50, r: 'vanlig', c: 40 },
    { id: 'throws_250', g: 'bomb', n: 'Heta potatisen', d: 'Kasta bomben 250 gånger.', i: '🥔', stat: 'throws', goal: 250, r: 'ovanlig', c: 120 },
    { id: 'throws_500', g: 'bomb', n: 'Rutinerad kastare', d: 'Kasta bomben 500 gånger.', i: '🌪️', stat: 'throws', goal: 500, r: 'sallsynt', c: 220 },
    { id: 'throws_1000', g: 'bomb', n: 'Kastmästaren', d: 'Kasta bomben 1000 gånger.', i: '🌀', stat: 'throws', goal: 1000, r: 'episk', c: 400 },
    { id: 'clutch', g: 'bomb', n: 'På sista sekunden', d: 'Kasta bomben med under 1 sekund kvar.', i: '⏱️', stat: 'clutchThrows', goal: 1, r: 'sallsynt', c: 110 },
    { id: 'clutch_10', g: 'bomb', n: 'Nervstark', d: 'Gör 10 räddningar på sista sekunden.', i: '😰', stat: 'clutchThrows', goal: 10, r: 'episk', c: 300 },
    { id: 'boom_10', g: 'bomb', n: 'Sprängd', d: 'Håll i bomben när den smäller 10 gånger.', i: '💥', stat: 'booms', goal: 10, r: 'vanlig', c: 40 },
    { id: 'boom_100', g: 'bomb', n: 'Rökskadad', d: 'Bli sprängd 100 gånger.', i: '🌫️', stat: 'booms', goal: 100, r: 'sallsynt', c: 180 },
    { id: 'ko_3', g: 'bomb', n: 'Utslagsgivare', d: 'Kasta bomben till någon som åker ut, 3 gånger.', i: '🪦', stat: 'knockouts', goal: 3, r: 'ovanlig', c: 90 },
    { id: 'ko_25', g: 'bomb', n: 'Domedagsbud', d: 'Slå ut 25 spelare med ett kast.', i: '⚰️', stat: 'knockouts', goal: 25, r: 'episk', c: 350 },

    // Fart
    { id: 'fast_3', g: 'fart', n: 'Kvickt', d: 'Svara rätt på under 3 sekunder.', i: '🐇', stat: 'fastAnswers3', goal: 1, r: 'vanlig', c: 25 },
    { id: 'fast_15', g: 'fart', n: 'Blixtfingrar', d: 'Svara rätt på under 1,5 sekunder.', i: '⚡', stat: 'fastAnswers15', goal: 1, r: 'ovanlig', c: 70 },
    { id: 'fast_15_50', g: 'fart', n: 'Ljusets hastighet', d: '50 svar under 1,5 sekunder.', i: '💫', stat: 'fastAnswers15', goal: 50, r: 'episk', c: 320 },
    { id: 'blitz_15', g: 'fart', n: 'Blixtnedslag', d: 'Få 15 rätt i en blixtmatch.', i: '🌩️', stat: 'blitzBest', goal: 15, r: 'ovanlig', c: 90 },
    { id: 'blitz_25', g: 'fart', n: 'Åskgud', d: 'Få 25 rätt i en blixtmatch.', i: '⛈️', stat: 'blitzBest', goal: 25, r: 'episk', c: 260 },

    // Överlevnad
    { id: 'surv_10', g: 'lage', n: 'Härdad', d: 'Nå 10 poäng i Överlevnad.', i: '🛡️', stat: 'survivalBest', goal: 10, r: 'vanlig', c: 40 },
    { id: 'surv_30', g: 'lage', n: 'Överlevare', d: 'Nå 30 poäng i Överlevnad.', i: '🏔️', stat: 'survivalBest', goal: 30, r: 'sallsynt', c: 170 },
    { id: 'surv_45', g: 'lage', n: 'Segt motstånd', d: 'Nå 45 poäng i Överlevnad.', i: '🪨', stat: 'survivalBest', goal: 45, r: 'episk', c: 340 },
    { id: 'surv_60', g: 'lage', n: 'Odödlig', d: 'Nå 60 poäng i Överlevnad.', i: '♾️', stat: 'survivalBest', goal: 60, r: 'legendarisk', c: 600 },
    { id: 'duel_5', g: 'lage', n: 'Duellant', d: 'Vinn 5 dueller.', i: '⚔️', stat: 'duelWins', goal: 5, r: 'ovanlig', c: 110 },
    { id: 'duel_25', g: 'lage', n: 'Envig', d: 'Vinn 25 dueller.', i: '🗡️', stat: 'duelWins', goal: 25, r: 'episk', c: 330 },
    { id: 'practice_200', g: 'lage', n: 'Flitig', d: 'Svara på 200 frågor i träningsläget.', i: '🎯', stat: 'practiceAnswers', goal: 200, r: 'ovanlig', c: 100 },

    // Kategorier
    { id: 'cat_add', g: 'amne', n: 'Additionsmästare', d: '100 rätt i addition.', i: '➕', stat: 'cat_add', goal: 100, r: 'ovanlig', c: 80 },
    { id: 'cat_sub', g: 'amne', n: 'Subtraktionsproffs', d: '100 rätt i subtraktion.', i: '➖', stat: 'cat_sub', goal: 100, r: 'ovanlig', c: 80 },
    { id: 'cat_mul', g: 'amne', n: 'Tabellkungen', d: '100 rätt i multiplikation.', i: '✖️', stat: 'cat_mul', goal: 100, r: 'ovanlig', c: 80 },
    { id: 'cat_div', g: 'amne', n: 'Delaren', d: '100 rätt i division.', i: '➗', stat: 'cat_div', goal: 100, r: 'ovanlig', c: 80 },
    { id: 'cat_pow', g: 'amne', n: 'Potensiell', d: '75 rätt i potenser & rötter.', i: '🔢', stat: 'cat_pow', goal: 75, r: 'sallsynt', c: 110 },
    { id: 'cat_pct', g: 'amne', n: 'Procentaren', d: '75 rätt i procent.', i: '％', stat: 'cat_pct', goal: 75, r: 'sallsynt', c: 110 },
    { id: 'cat_frac', g: 'amne', n: 'Bråkmakaren', d: '75 rätt i bråk.', i: '🍰', stat: 'cat_frac', goal: 75, r: 'sallsynt', c: 110 },
    { id: 'cat_eq', g: 'amne', n: 'X-faktorn', d: '75 rätt i ekvationer.', i: '🧮', stat: 'cat_eq', goal: 75, r: 'sallsynt', c: 110 },
    { id: 'cat_geo', g: 'amne', n: 'Formstark', d: '75 rätt i geometri.', i: '📐', stat: 'cat_geo', goal: 75, r: 'sallsynt', c: 110 },
    { id: 'cat_neg', g: 'amne', n: 'Under noll', d: '50 rätt i negativa tal.', i: '🧊', stat: 'cat_neg', goal: 50, r: 'sallsynt', c: 110 },
    { id: 'cat_seq', g: 'amne', n: 'Mönsterseendet', d: '50 rätt i talföljder.', i: '🔗', stat: 'cat_seq', goal: 50, r: 'sallsynt', c: 110 },
    { id: 'cat_prime', g: 'amne', n: 'Primtalsjägare', d: '50 rätt i primtal.', i: '🔍', stat: 'cat_prime', goal: 50, r: 'sallsynt', c: 110 },
    { id: 'all_cats', g: 'amne', n: 'Allätaren', d: 'Få minst 10 rätt i varje kategori.', i: '🌈', stat: 'allCats10', goal: 1, r: 'episk', c: 400 },

    // Nivå & ekonomi
    { id: 'lvl_5', g: 'nivå', n: 'Nivå 5', d: 'Nå nivå 5.', i: '⭐', stat: 'level', goal: 5, r: 'vanlig', c: 50 },
    { id: 'lvl_10', g: 'nivå', n: 'Nivå 10', d: 'Nå nivå 10.', i: '🌟', stat: 'level', goal: 10, r: 'ovanlig', c: 120 },
    { id: 'lvl_15', g: 'nivå', n: 'Nivå 15', d: 'Nå nivå 15.', i: '💫', stat: 'level', goal: 15, r: 'sallsynt', c: 220 },
    { id: 'lvl_25', g: 'nivå', n: 'Nivå 25', d: 'Nå nivå 25.', i: '✨', stat: 'level', goal: 25, r: 'episk', c: 400 },
    { id: 'lvl_50', g: 'nivå', n: 'Nivå 50', d: 'Nå nivå 50.', i: '🎆', stat: 'level', goal: 50, r: 'legendarisk', c: 1200 },
    { id: 'coins_500', g: 'nivå', n: 'Sparbössan', d: 'Tjäna 500 mynt totalt.', i: '🪙', stat: 'coinsEarned', goal: 500, r: 'vanlig', c: 50 },
    { id: 'coins_5000', g: 'nivå', n: 'Miljonär (nästan)', d: 'Tjäna 5000 mynt totalt.', i: '💰', stat: 'coinsEarned', goal: 5000, r: 'episk', c: 400 },
    { id: 'shop_1', g: 'nivå', n: 'Första köpet', d: 'Köp något i butiken.', i: '🛒', stat: 'purchases', goal: 1, r: 'vanlig', c: 20 },
    { id: 'shop_5', g: 'nivå', n: 'Samlare', d: 'Köp 5 saker i butiken.', i: '📦', stat: 'purchases', goal: 5, r: 'ovanlig', c: 100 },
    { id: 'shop_all_themes', g: 'nivå', n: 'Färgsprakande', d: 'Lås upp alla teman.', i: '🎨', stat: 'themesOwned', goal: 6, r: 'legendarisk', c: 600 },

    // Power-ups & lobby
    { id: 'pw_1', g: 'social', n: 'Fusklappen', d: 'Använd din första power-up.', i: '🎁', stat: 'powerupsUsed', goal: 1, r: 'vanlig', c: 20 },
    { id: 'pw_50', g: 'social', n: 'Taktikern', d: 'Använd 50 power-ups.', i: '🧩', stat: 'powerupsUsed', goal: 50, r: 'ovanlig', c: 120 },
    { id: 'pw_shield_10', g: 'social', n: 'Sköldbärare', d: 'Studsa tillbaka 10 bomber med sköld.', i: '🛡️', stat: 'shieldBlocks', goal: 10, r: 'sallsynt', c: 160 },
    { id: 'lobby_10', g: 'social', n: 'Lobbyluffare', d: 'Gå med i 10 lobbyer.', i: '🚪', stat: 'lobbiesJoined', goal: 10, r: 'ovanlig', c: 80 },
    { id: 'host_1', g: 'social', n: 'Värden', d: 'Skapa en egen lobby.', i: '🏗️', stat: 'lobbiesCreated', goal: 1, r: 'vanlig', c: 30 },
    { id: 'host_10', g: 'social', n: 'Arrangören', d: 'Skapa 10 lobbyer.', i: '🎪', stat: 'lobbiesCreated', goal: 10, r: 'sallsynt', c: 150 },
    { id: 'chat_20', g: 'social', n: 'Pratkvarn', d: 'Skicka 20 meddelanden i lobbychatten.', i: '💬', stat: 'chatSent', goal: 20, r: 'ovanlig', c: 60 },

    // Daglig & tid
    { id: 'daily_1', g: 'daglig', n: 'Dagens dos', d: 'Klara dagens utmaning.', i: '📅', stat: 'dailyDone', goal: 1, r: 'vanlig', c: 40 },
    { id: 'daily_7', g: 'daglig', n: 'Veckovana', d: 'Klara dagens utmaning 7 dagar i rad.', i: '🗓️', stat: 'bestDailyStreak', goal: 7, r: 'sallsynt', c: 220 },
    { id: 'daily_30', g: 'daglig', n: 'Månadsmaskin', d: 'Klara dagens utmaning 30 dagar i rad.', i: '📆', stat: 'bestDailyStreak', goal: 30, r: 'legendarisk', c: 900 },
    { id: 'daily_perfect', g: 'daglig', n: 'Dagens hjälte', d: 'Få 10/10 i dagens utmaning.', i: '🦸', stat: 'dailyPerfect', goal: 1, r: 'sallsynt', c: 180 },
    { id: 'games_50', g: 'daglig', n: 'Stammis', d: 'Spela 50 matcher.', i: '🎮', stat: 'gamesPlayed', goal: 50, r: 'ovanlig', c: 120 },
    { id: 'games_250', g: 'daglig', n: 'Veteran', d: 'Spela 250 matcher.', i: '🎖️', stat: 'gamesPlayed', goal: 250, r: 'episk', c: 450 },
    { id: 'time_60', g: 'daglig', n: 'En timme senare', d: 'Spela i totalt 60 minuter.', i: '⌛', stat: 'minutesPlayed', goal: 60, r: 'ovanlig', c: 100 },
    { id: 'time_600', g: 'daglig', n: 'Tio timmar', d: 'Spela i totalt 600 minuter.', i: '🕰️', stat: 'minutesPlayed', goal: 600, r: 'legendarisk', c: 700 },

    // Hemliga
    { id: 'night_owl', g: 'hemlig', n: 'Nattuggla', d: 'Spela en match mellan 00 och 05.', i: '🦉', stat: 'nightGames', goal: 1, r: 'hemlig', c: 150, secret: true },
    { id: 'early_bird', g: 'hemlig', n: 'Morgonpigg', d: 'Spela en match före klockan 07.', i: '🌅', stat: 'morningGames', goal: 1, r: 'hemlig', c: 150, secret: true },
    { id: 'lucky_42', g: 'hemlig', n: 'Svaret på allt', d: 'Svara rätt när svaret är exakt 42.', i: '🐬', stat: 'answer42', goal: 1, r: 'hemlig', c: 142, secret: true },
    { id: 'unlucky', g: 'hemlig', n: 'Otur i spel', d: 'Bli sprängd tre gånger i samma match.', i: '🎰', stat: 'tripleBoom', goal: 1, r: 'hemlig', c: 130, secret: true },
    { id: 'pacifist', g: 'hemlig', n: 'Pacifisten', d: 'Kasta hela matchen till samma spelare.', i: '🕊️', stat: 'pacifist', goal: 1, r: 'hemlig', c: 200, secret: true },
    { id: 'completionist', g: 'hemlig', n: 'Fullständig', d: 'Lås upp 50 andra prestationer.', i: '🏵️', stat: 'achUnlocked', goal: 50, r: 'hemlig', c: 1000, secret: true }
  ];

  M.ACH_GROUPS = [
    { id: 'alla', name: 'Alla' },
    { id: 'start', name: 'Första stegen' },
    { id: 'svar', name: 'Svar' },
    { id: 'svit', name: 'Sviter' },
    { id: 'seger', name: 'Segrar' },
    { id: 'bomb', name: 'Bomben' },
    { id: 'fart', name: 'Fart' },
    { id: 'lage', name: 'Spellägen' },
    { id: 'amne', name: 'Ämnen' },
    { id: 'nivå', name: 'Nivå & mynt' },
    { id: 'social', name: 'Socialt' },
    { id: 'daglig', name: 'Vanor' },
    { id: 'hemlig', name: 'Hemliga' }
  ];

})(window.MATTENITE = window.MATTENITE || {});
