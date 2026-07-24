/* ==========================================================================
   game.js — spelmotorn: het bomb, blixt, överlevnad, duell, träning, dagens
   ========================================================================== */
(function (M) {
  'use strict';

  var ui = M.ui;
  var $ = ui.$, $$ = ui.$$, esc = ui.esc;

  var G = {
    running: false,
    cfg: null,
    players: [],
    holder: 0,
    q: null,
    phase: 'idle',     // 'answer' | 'throw' | 'wait' | 'over'
    time: 0,           // sekunder kvar
    maxTime: 0,
    round: 1,
    feed: [],
    pw: [],            // dina power-ups
    armed: null,       // förvald power-up
    frozenUntil: 0,
    m: null,           // matchstatistik
    tickId: null,
    botAt: 0,
    qShownAt: 0,
    dailyQs: null
  };
  M.game = G;

  var LIVES = 3;

  /* ---------- Start --------------------------------------------------------- */

  G.start = function (cfg) {
    G.cfg = cfg;
    G.running = true;
    G.round = 1;
    G.feed = [];
    G.pw = [];
    G.armed = null;
    G.frozenUntil = 0;
    G.dailyQs = null;
    G.m = {
      correct: 0, wrong: 0, streak: 0, best: 0, throws: 0, booms: 0, kos: 0,
      pwUsed: 0, score: 0, xp: 0, startedAt: Date.now(), targets: {}, x2: false
    };

    var you = {
      id: 'you', name: M.profile.name, av: M.profile.avatar, you: true,
      lives: LIVES, alive: true, skill: 1, shield: false, score: 0
    };
    G.players = [you];

    var defs = cfg.botDefs || [];
    var n = cfg.bots || 0;
    var freeAvatars = M.shuffle(M.AVATARS.filter(function (a) { return a !== M.profile.avatar; }));
    for (var i = 0; i < n; i++) {
      var d = defs[i];
      G.players.push({
        id: 'b' + i,
        name: d ? d.name : M.BOT_NAMES[(i * 7 + M.rnd(0, 20)) % M.BOT_NAMES.length],
        av: (d && d.av !== M.profile.avatar) ? d.av : (freeAvatars[i % freeAvatars.length] || M.pick(M.AVATARS)),
        you: false, lives: LIVES, alive: true,
        skill: d ? d.skill : (0.5 + Math.random() * 0.45),
        shield: false, score: 0
      });
    }
    // Unika namn
    var seen = {};
    G.players.forEach(function (p, idx) {
      while (seen[p.name]) p.name = p.name + ' ' + (idx + 1);
      seen[p.name] = 1;
    });

    var hour = new Date().getHours();
    if (hour < 5) M.bump('nightGames');
    else if (hour < 7) M.bump('morningGames');

    if (cfg.mode === 'daily') buildDaily();

    G.maxTime = roundTime();
    G.time = G.maxTime;
    G.holder = cfg.mode === 'potato' || cfg.mode === 'duel' ? M.rnd(0, G.players.length - 1) : 0;

    feed(cfg.mode === 'potato' || cfg.mode === 'duel'
      ? '💣 ' + G.players[G.holder].name + ' börjar med bomben!'
      : M.MODES[cfg.mode].icon + ' ' + M.MODES[cfg.mode].name + ' startar!');

    ui.show('game');
    nextQuestion();
    startTick();
    ui.sfx.throwIt();
  };

  function buildDaily() {
    var rng = M.seededRandom('mattenite-' + M.todayKey());
    var realRandom = Math.random;
    Math.random = rng;
    try {
      G.dailyQs = [];
      for (var i = 0; i < 10; i++) G.dailyQs.push(M.question('mix', 1 + (i % 4)));
    } finally {
      Math.random = realRandom;
    }
  }

  function roundTime() {
    var base = M.DIFFS[(G.cfg.diff || 2) - 1].time;
    switch (G.cfg.mode) {
      case 'potato':
      case 'duel':
        return Math.max(6, base - (G.round - 1) * 1.2);
      case 'survival':
        return Math.max(4, base - G.m.score * 0.35);
      case 'blitz':
        return 60;
      case 'daily':
        return 20;
      default:
        return 0; // träning = ingen klocka
    }
  }

  function isPotato() { return G.cfg.mode === 'potato' || G.cfg.mode === 'duel'; }
  function alive() { return G.players.filter(function (p) { return p.alive; }); }
  function you() { return G.players[0]; }

  function feed(txt) {
    G.feed.unshift(txt);
    if (G.feed.length > 30) G.feed.pop();
  }

  /* ---------- Frågeflöde ----------------------------------------------------- */

  function nextQuestion() {
    if (G.cfg.mode === 'daily') {
      G.q = G.dailyQs[Math.min(G.m.correct + G.m.wrong, 9)];
    } else {
      var d = G.cfg.diff;
      if (G.cfg.mode === 'survival') d = Math.min(4, G.cfg.diff + Math.floor(G.m.score / 8));
      G.q = M.question(G.cfg.cat, d);
    }
    G.qShownAt = Date.now();
    G.phase = (isPotato() && !G.players[G.holder].you) ? 'wait' : 'answer';
    if (isPotato() && !G.players[G.holder].you) scheduleBot();
    render();
  }

  function scheduleBot() {
    var b = G.players[G.holder];
    var base = 1400 + (1 - b.skill) * 2600;
    G.botAt = Date.now() + base * (0.7 + Math.random() * 0.7);
  }

  function botTurn() {
    var b = G.players[G.holder];
    var ok = Math.random() < (b.skill - (G.cfg.diff - 2) * 0.06);
    if (!ok) {
      feed('❌ ' + b.name + ' svarade fel (−2 s)');
      G.time = Math.max(0.4, G.time - 2);
      scheduleBot();
      render();
      return;
    }
    // Boten kastar till någon annan — helst den med flest liv
    var others = alive().filter(function (p) { return p !== b; });
    if (!others.length) return;
    others.sort(function (x, y) { return y.lives - x.lives; });
    var target = Math.random() < 0.55 ? others[0] : M.pick(others);
    throwBomb(b, target);
  }

  function throwBomb(from, to) {
    if (to.shield) {
      to.shield = false;
      M.bump('shieldBlocks');
      feed('🛡️ ' + to.name + ' studsade tillbaka bomben till ' + from.name + '!');
      ui.sfx.throwIt();
      G.holder = G.players.indexOf(from);
    } else {
      G.holder = G.players.indexOf(to);
      feed('💣 ' + from.name + ' → ' + to.name);
      ui.sfx.throwIt();
    }
    G.lastThrower = from;
    nextQuestion();
  }

  /* ---------- Ditt svar ------------------------------------------------------- */

  G.answer = function (idx) {
    if (G.phase !== 'answer' || !G.q) return;
    var ms = Date.now() - G.qShownAt;
    var right = idx === G.q.correct;
    var btns = $$('#opts .opt');
    btns.forEach(function (b, i) {
      b.disabled = true;
      if (i === G.q.correct) b.classList.add('right');
      else if (i === idx) b.classList.add('wrong');
    });

    M.bump('answers');
    if (G.cfg.mode === 'practice') M.bump('practiceAnswers');

    if (right) {
      G.m.correct++;
      G.m.streak++;
      G.m.best = Math.max(G.m.best, G.m.streak);
      M.bump('correct');
      M.bump('cat_' + G.q.cat);
      M.setMax('bestStreak', G.m.streak);
      if (G.q.answer === 42) M.bump('answer42');
      if (ms < 3000) M.bump('fastAnswers3');
      if (ms < 1500) M.bump('fastAnswers15');
      ui.sfx.right();
      ui.buzz(20);
      grantPowerup();
      addXp(G.m.x2 ? 8 : 4);
    } else {
      G.m.wrong++;
      G.m.streak = 0;
      M.bump('wrong');
      ui.sfx.wrong();
      ui.buzz([40, 60, 40]);
    }

    setTimeout(function () { afterAnswer(right); }, right ? 260 : 520);
  };

  function afterAnswer(right) {
    if (!G.running) return;

    if (isPotato()) {
      if (right) {
        G.phase = 'throw';
        render();
      } else {
        G.time = Math.max(0.4, G.time - 2);
        feed('❌ Fel — 2 sekunder brändes');
        nextQuestion();
      }
      return;
    }

    if (G.cfg.mode === 'blitz') {
      if (right) { G.m.score++; you().score = G.m.score; }
      nextQuestion();
      return;
    }

    if (G.cfg.mode === 'survival') {
      if (right) {
        G.m.score++;
        G.maxTime = roundTime();
        G.time = G.maxTime;
        nextQuestion();
      } else {
        loseLife(you(), 'fel svar');
        if (G.running) { G.maxTime = roundTime(); G.time = G.maxTime; nextQuestion(); }
      }
      return;
    }

    if (G.cfg.mode === 'daily') {
      if (right) G.m.score++;
      if (G.m.correct + G.m.wrong >= 10) return endGame();
      G.time = roundTime();
      nextQuestion();
      return;
    }

    // Träning
    if (right) G.m.score++;
    nextQuestion();
  }

  G.throwTo = function (id) {
    if (G.phase !== 'throw') return;
    var target = null;
    G.players.forEach(function (p) { if (p.id === id) target = p; });
    if (!target || !target.alive) return;

    G.m.throws++;
    G.m.targets[id] = (G.m.targets[id] || 0) + 1;
    M.bump('throws');
    if (G.time < 1) M.bump('clutchThrows');
    throwBomb(you(), target);
  };

  /* ---------- Power-ups -------------------------------------------------------- */

  function grantPowerup() {
    if (!isPotato() && G.cfg.mode !== 'survival') return;
    if (G.m.correct % 3 !== 0 || G.pw.length >= 3) return;
    var keys = Object.keys(M.POWERUPS);
    var k = M.pick(keys);
    G.pw.push(k);
    feed('🎁 Power-up: ' + M.POWERUPS[k].name);
  }

  G.usePowerup = function (i) {
    var k = G.pw[i];
    if (!k) return;
    var p = M.POWERUPS[k];

    if (k === 'swap' && G.players[G.holder] !== you()) {
      ui.toast('🔀', 'Du håller inte i bomben');
      return;
    }
    if (k === 'freeze' && !isPotato() && G.cfg.mode !== 'survival') return;

    G.pw.splice(i, 1);
    G.m.pwUsed++;
    M.bump('powerupsUsed');
    ui.buzz(25);

    if (k === 'freeze') { G.frozenUntil = Date.now() + 4000; feed('⏸️ Bomben frusen i 4 sekunder'); }
    if (k === 'skip') { feed('⏭️ Ny fråga'); nextQuestion(); }
    if (k === 'shield') { you().shield = true; feed('🛡️ Sköld aktiv'); }
    if (k === 'x2') { G.m.x2 = true; feed('💎 Dubbel XP resten av matchen'); }
    if (k === 'swap') {
      var others = alive().filter(function (p) { return !p.you; });
      if (others.length) { G.phase = 'throw'; feed('🔀 Kasta utan att svara!'); }
    }
    ui.toast(p.icon, p.name + ' använd', p.desc, 1800);
    render();
  };

  /* ---------- Klockan ---------------------------------------------------------- */

  function startTick() {
    clearInterval(G.tickId);
    var last = Date.now();
    G.tickId = setInterval(function () {
      var now = Date.now();
      var dt = (now - last) / 1000;
      last = now;
      if (!G.running) return;

      if (G.cfg.mode !== 'practice') {
        var frozen = now < G.frozenUntil;
        if (!frozen) G.time -= dt;
        if (G.time <= 3.2 && G.time > 0 && Math.floor(G.time * 2) !== Math.floor((G.time + dt) * 2)) ui.sfx.tick();
        if (G.time <= 0) { G.time = 0; timeUp(); }
      }

      if (isPotato() && G.phase === 'wait' && now >= G.botAt && G.running) botTurn();
      updateTimer();
    }, 100);
  }

  function timeUp() {
    if (isPotato()) {
      var h = G.players[G.holder];
      ui.sfx.boom();
      ui.buzz([80, 60, 120]);
      feed('💥 BOOM! ' + h.name + ' höll i bomben.');
      if (h.you) { G.m.booms++; M.bump('booms'); if (G.m.booms === 3) M.bump('tripleBoom'); }
      if (G.lastThrower && G.lastThrower.you && !h.you && h.lives === 1) { G.m.kos++; M.bump('knockouts'); }
      loseLife(h, 'bomben');
      if (!G.running) return;
      G.round++;
      G.maxTime = roundTime();
      G.time = G.maxTime;
      var live = alive();
      G.holder = G.players.indexOf(M.pick(live));
      G.lastThrower = null;
      feed('🔄 Runda ' + G.round + ' — ' + G.players[G.holder].name + ' får bomben');
      nextQuestion();
      return;
    }

    if (G.cfg.mode === 'blitz') return endGame();
    if (G.cfg.mode === 'survival') {
      loseLife(you(), 'tiden');
      if (G.running) { G.maxTime = roundTime(); G.time = G.maxTime; nextQuestion(); }
      return;
    }
    if (G.cfg.mode === 'daily') {
      G.m.wrong++;
      if (G.m.correct + G.m.wrong >= 10) return endGame();
      G.time = roundTime();
      nextQuestion();
    }
  }

  function loseLife(p, cause) {
    p.lives--;
    if (p.lives <= 0) {
      p.alive = false;
      feed('☠️ ' + p.name + ' är ute (' + cause + ')');
      if (p.you) ui.sfx.lose();
    }
    var live = alive();
    if (isPotato() && live.length <= 1) return endGame();
    if (!isPotato() && !you().alive) return endGame();
    render();
  }

  function updateTimer() {
    var bar = $('#tbar');
    if (!bar) return;
    var pct = G.maxTime ? Math.max(0, Math.min(100, G.time / G.maxTime * 100)) : 100;
    bar.style.width = pct + '%';
    bar.parentNode.classList.toggle('danger', G.time < G.maxTime * 0.3);
    var num = $('#tnum');
    if (num) num.textContent = G.cfg.mode === 'practice' ? '∞' : G.time.toFixed(1) + ' s';
  }

  /* ---------- Slut -------------------------------------------------------------- */

  G.abort = function () {
    G.running = false;
    clearInterval(G.tickId);
  };

  function endGame() {
    if (!G.running) return;
    G.running = false;
    G.phase = 'over';
    clearInterval(G.tickId);

    var s = M.profile.stats;
    var mode = G.cfg.mode;
    var win = false, title = '', sub = '', coins = 0, xp = 0;
    var secs = Math.round((Date.now() - G.m.startedAt) / 1000);
    M.bump('secondsPlayed', secs);

    if (isPotato()) {
      var live = alive();
      win = live.length === 1 && live[0].you;
      M.bump('gamesPlayed');
      if (win) {
        M.bump('wins');
        s.winStreak++;
        M.setMax('bestWinStreak', s.winStreak);
        if (G.m.wrong === 0) M.bump('perfectGames');
        if (you().lives === LIVES) M.bump('fullLifeWins');
        if (you().lives === 1) M.bump('comebacks');
        if (G.m.pwUsed === 0) M.bump('pureWins');
        if (G.cfg.diff === 3) M.bump('hardWins');
        if (G.cfg.diff === 4) M.bump('extremeWins');
        if (G.players.length >= 6) M.bump('bigLobbyWins');
        if (mode === 'duel') M.bump('duelWins');
        var tks = Object.keys(G.m.targets);
        if (tks.length === 1 && G.m.targets[tks[0]] >= 4) M.bump('pacifist');
        coins = 30 + G.players.length * 6 + G.cfg.diff * 8;
        xp = 60 + G.m.correct * 3;
        title = '🏆 Du vann!';
        sub = 'Sist kvar av ' + G.players.length + ' spelare.';
      } else {
        s.winStreak = 0;
        coins = 8 + G.m.correct;
        xp = 15 + G.m.correct * 2;
        var place = G.players.filter(function (p) { return p.alive; }).length + 1;
        title = '💥 Du åkte ut';
        sub = 'Du kom på plats ' + place + ' av ' + G.players.length + '.';
      }
    } else if (mode === 'blitz') {
      G.m.score = G.m.correct;
      you().score = G.m.score;
      M.bump('gamesPlayed');
      G.players.forEach(function (p) {
        if (!p.you) p.score = Math.round(G.m.score * (0.55 + p.skill * 0.85) * (0.8 + Math.random() * 0.5));
      });
      var sorted = G.players.slice().sort(function (a, b) { return b.score - a.score; });
      win = sorted[0].you;
      M.setMax('blitzBest', G.m.score);
      if (win) { M.bump('wins'); s.winStreak++; M.setMax('bestWinStreak', s.winStreak); } else s.winStreak = 0;
      coins = 10 + G.m.score * 2 + (win ? 25 : 0);
      xp = 20 + G.m.score * 3;
      title = win ? '⚡ Blixtseger!' : '⚡ Blixt klar';
      sub = G.m.score + ' rätt på 60 sekunder · plats ' + (sorted.indexOf(you()) + 1) + '/' + G.players.length;
    } else if (mode === 'survival') {
      M.bump('gamesPlayed');
      M.setMax('survivalBest', G.m.score);
      coins = 8 + G.m.score * 3;
      xp = 15 + G.m.score * 4;
      title = '🛡️ Överlevnad slut';
      sub = 'Du klarade ' + G.m.score + ' frågor.';
    } else if (mode === 'daily') {
      M.bump('gamesPlayed');
      var today = M.todayKey();
      if (M.profile.daily.date !== today) {
        var y = new Date(Date.now() - 864e5);
        var yKey = y.getFullYear() + '-' + ('0' + (y.getMonth() + 1)).slice(-2) + '-' + ('0' + y.getDate()).slice(-2);
        M.profile.daily.streak = (M.profile.daily.date === yKey) ? M.profile.daily.streak + 1 : 1;
        M.profile.daily.date = today;
        M.bump('dailyDone');
        M.setMax('bestDailyStreak', M.profile.daily.streak);
        if (G.m.score === 10) M.bump('dailyPerfect');
        coins = 25 + G.m.score * 5;
      } else {
        coins = G.m.score;
      }
      M.profile.daily.score = G.m.score;
      M.profile.daily.best = Math.max(M.profile.daily.best || 0, G.m.score);
      xp = 20 + G.m.score * 5;
      title = '📅 Dagens utmaning klar';
      sub = G.m.score + '/10 rätt · svit ' + M.profile.daily.streak + ' dagar';
    } else {
      coins = Math.floor(G.m.correct / 2);
      xp = G.m.correct * 2;
      title = '🎯 Träning avslutad';
      sub = G.m.correct + ' rätt, ' + G.m.wrong + ' fel.';
    }

    if (G.m.x2) xp *= 2;
    M.addCoins(coins, true);
    addXp(xp, true);
    M.pushHistory({ mode: mode, win: win, result: (win ? 'Vinst' : '') + (win ? ' · ' : '') + (G.m.correct + ' rätt') });
    M.save();

    var fresh = M.checkAchievements();
    if (win) { ui.sfx.win(); ui.confetti(90); }
    ui.refreshChips();
    renderOver(title, sub, coins, xp, fresh);
    if (fresh.length) setTimeout(function () { ui.achToast(fresh); }, 700);
  }

  function addXp(n) {
    var r = M.addXp(n);
    if (r.levels > 0) {
      ui.toast('⭐', 'Nivå ' + M.profile.level + '!', 'Du fick ' + (25 + M.profile.level * 5) + ' mynt.', 3000);
      ui.sfx.unlock();
      ui.confetti(40);
      ui.refreshChips();
    }
  }

  /* ---------- Rendering --------------------------------------------------------- */

  function render() {
    if (!$('#view-game')) return;
    var mode = G.cfg.mode;
    var holder = G.players[G.holder];
    var html = '';

    html += '<div class="game-top">' +
      '<button class="btn ghost small" id="g-quit">✕</button>' +
      '<div class="timer-wrap"><div class="timer-bar"><i id="tbar"></i></div>' +
      '<div class="timer-num"><span>' + M.MODES[mode].icon + ' ' + esc(G.cfg.lobbyName || M.MODES[mode].name) + '</span>' +
      '<span id="tnum">' + (mode === 'practice' ? '∞' : G.time.toFixed(1) + ' s') + '</span></div></div></div>';

    if (isPotato()) {
      html += '<div class="player-strip">' + G.players.map(function (p, i) {
        return '<div class="pstrip ' + (i === G.holder ? 'holding' : '') + ' ' + (p.alive ? '' : 'out') + '">' +
          (i === G.holder ? '<span class="bomb-tag">' + M.profile.bomb + '</span>' : '') +
          '<div class="av">' + p.av + '</div><div class="nm">' + esc(p.you ? 'Du' : p.name) + '</div>' +
          '<div class="hp">' + (p.alive ? '❤️'.repeat(Math.max(0, p.lives)) : '☠️') + '</div>' +
          (p.shield ? '<div class="hp">🛡️</div>' : '') + '</div>';
      }).join('') + '</div>';

      html += '<div class="holder-banner ' + (holder.you ? 'mine' : '') + '">' +
        '<span class="big">' + M.profile.bomb + '</span>' +
        (holder.you
          ? (G.phase === 'throw' ? 'Rätt svar! Kasta bomben vidare — fort!' : 'Du har bomben — svara snabbt!')
          : esc(holder.name) + ' har bomben…') + '</div>';
    }

    if (mode === 'blitz') {
      html += '<div class="row between" style="margin-bottom:10px"><b>⚡ Poäng: ' + G.m.score + '</b>' +
        '<span class="sub">Svit ' + G.m.streak + '</span></div>';
    }
    if (mode === 'survival') {
      html += '<div class="row between" style="margin-bottom:10px"><b>🛡️ ' + G.m.score + ' klarade</b>' +
        '<span>' + '❤️'.repeat(Math.max(0, you().lives)) + '</span></div>';
    }
    if (mode === 'daily') {
      html += '<div class="row between" style="margin-bottom:10px"><b>Fråga ' + Math.min(10, G.m.correct + G.m.wrong + 1) + '/10</b>' +
        '<span class="sub">' + G.m.score + ' rätt</span></div>';
    }
    if (mode === 'practice') {
      html += '<div class="row between" style="margin-bottom:10px"><b>🎯 ' + G.m.correct + ' rätt</b>' +
        '<span class="sub">' + G.m.wrong + ' fel · svit ' + G.m.streak + '</span></div>';
    }

    if (G.pw.length) {
      html += '<div class="pw-bar">' + G.pw.map(function (k, i) {
        var p = M.POWERUPS[k];
        return '<button class="pw" data-pw="' + i + '"><span class="ic">' + p.icon + '</span><span class="nm">' + p.name + '</span></button>';
      }).join('') + '</div>';
    }

    if (G.phase === 'throw') {
      html += '<div class="card"><h3>🤾 Kasta bomben till…</h3><div class="throw-grid">' +
        alive().filter(function (p) { return !p.you; }).map(function (p) {
          return '<button class="throw-btn ' + (p.shield ? 'shielded' : '') + '" data-throw="' + p.id + '">' +
            '<span class="av">' + p.av + '</span><span>' + esc(p.name) + '</span>' +
            '<span class="hearts">' + '❤️'.repeat(Math.max(0, p.lives)) + '</span></button>';
        }).join('') + '</div></div>';
    } else if (G.phase === 'wait') {
      html += '<div class="q-card"><div class="q-cat">' + M.catName(G.q.cat) + '</div>' +
        '<div class="q-text" style="opacity:.35">' + esc(G.q.text) + ' = ?</div>' +
        '<div class="q-streak">' + esc(holder.name) + ' funderar…</div></div>';
    } else if (G.q) {
      html += '<div class="q-card"><div class="q-cat">' + M.catName(G.q.cat) + ' · ' + M.DIFFS[G.q.diff - 1].name + '</div>' +
        '<div class="q-text">' + esc(G.q.text) + ' = ?</div>' +
        '<div class="q-streak">' + (G.m.streak >= 2 ? '🔥 ' + G.m.streak + ' i rad' : '') + '</div></div>' +
        '<div class="opts" id="opts">' + G.q.options.map(function (o, i) {
          return '<button class="opt" data-opt="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
    }

    if (G.feed.length) {
      html += '<div class="feed">' + G.feed.slice(0, 6).map(function (f) { return '<div>' + esc(f) + '</div>'; }).join('') + '</div>';
    }

    if (mode === 'practice' || mode === 'blitz') {
      html += '<button class="btn ghost block" style="margin-top:12px" id="g-stop">Avsluta</button>';
    }

    $('#view-game').innerHTML = html;
    updateTimer();

    $$('#view-game [data-opt]').forEach(function (b) {
      b.onclick = function () { G.answer(+b.dataset.opt); };
    });
    $$('#view-game [data-throw]').forEach(function (b) {
      b.onclick = function () { G.throwTo(b.dataset.throw); };
    });
    $$('#view-game [data-pw]').forEach(function (b) {
      b.onclick = function () { G.usePowerup(+b.dataset.pw); };
    });
    var quit = $('#g-quit');
    if (quit) quit.onclick = function () { quitGame(); };
    var stop = $('#g-stop');
    if (stop) stop.onclick = function () { if (G.cfg.mode === 'blitz') { G.time = 0; timeUp(); } else endGame(); };
  }

  function quitGame() {
    ui.modal('<h3>Lämna matchen?</h3><p class="sub">Resultatet räknas inte.</p>' +
      '<div class="row mt" style="gap:8px"><button class="btn ghost" data-x="no">Fortsätt spela</button>' +
      '<button class="btn danger" style="flex:1" data-x="yes">Lämna</button></div>', function (box) {
        $$('[data-x]', box).forEach(function (b) {
          b.onclick = function () {
            ui.closeModal();
            if (b.dataset.x === 'yes') {
              G.abort();
              M.bump('secondsPlayed', Math.round((Date.now() - G.m.startedAt) / 1000));
              M.save();
              ui.show(M.ui.getLobby() ? 'lobbies' : 'home');
            }
          };
        });
      });
  }

  function renderOver(title, sub, coins, xp, fresh) {
    var mode = G.cfg.mode;
    var rows = '';
    if (isPotato()) {
      rows = G.players.slice().sort(function (a, b) { return (b.alive - a.alive) || (b.lives - a.lives); })
        .map(function (p, i) {
          return '<div class="lb-row ' + (p.you ? 'you' : '') + '"><span class="pos">' + (i + 1) + '</span>' +
            '<span style="font-size:19px">' + p.av + '</span><span>' + esc(p.you ? 'Du' : p.name) + '</span>' +
            '<span class="sc">' + (p.alive ? '❤️'.repeat(Math.max(0, p.lives)) : '☠️') + '</span></div>';
        }).join('');
    } else if (mode === 'blitz') {
      rows = G.players.slice().sort(function (a, b) { return b.score - a.score; }).map(function (p, i) {
        return '<div class="lb-row ' + (p.you ? 'you' : '') + '"><span class="pos">' + (i + 1) + '</span>' +
          '<span style="font-size:19px">' + p.av + '</span><span>' + esc(p.you ? 'Du' : p.name) + '</span>' +
          '<span class="sc">' + p.score + '</span></div>';
      }).join('');
    }

    $('#view-game').innerHTML =
      '<div class="card center" style="padding:26px 18px">' +
        '<div style="font-size:46px">' + title.split(' ')[0] + '</div>' +
        '<h2 style="font-size:22px;margin:6px 0 4px">' + esc(title.replace(/^\S+\s/, '')) + '</h2>' +
        '<p class="sub">' + esc(sub) + '</p>' +
        '<div class="grid grid-3 mt">' +
          '<div class="stat-tile"><div class="num">' + G.m.correct + '</div><div class="lbl">Rätt</div></div>' +
          '<div class="stat-tile"><div class="num">' + G.m.best + '</div><div class="lbl">Bästa svit</div></div>' +
          '<div class="stat-tile"><div class="num">' + G.m.throws + '</div><div class="lbl">Kast</div></div>' +
        '</div>' +
        '<div class="row mt" style="justify-content:center;gap:14px;font-weight:800">' +
          '<span style="color:var(--warn)">🪙 +' + coins + '</span><span style="color:var(--brand-2)">✨ +' + xp + ' XP</span>' +
        '</div>' +
        (fresh.length ? '<p class="sub mt">🏅 ' + fresh.length + ' ny' + (fresh.length > 1 ? 'a' : '') + ' prestation' + (fresh.length > 1 ? 'er' : '') + '!</p>' : '') +
      '</div>' +
      (rows ? '<div class="card"><h3>📋 Slutställning</h3>' + rows + '</div>' : '') +
      '<div class="row" style="gap:8px">' +
        '<button class="btn ghost" data-end="home">🏠 Hem</button>' +
        '<button class="btn" style="flex:1" data-end="again">🔁 Spela igen</button>' +
      '</div>';

    $$('#view-game [data-end]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.end === 'again') G.start(G.cfg);
        else { ui.leaveRoomSilently(); ui.show('home'); }
      };
    });
  }

  G.render = render;

})(window.MATTENITE = window.MATTENITE || {});
