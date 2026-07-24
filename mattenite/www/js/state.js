/* ==========================================================================
   state.js — profil, sparning, XP/nivåer, statistik och prestationsmotor
   ========================================================================== */
(function (M) {
  'use strict';

  var KEY = 'mattenite.profile.v1';

  var DEFAULT_STATS = {
    gamesPlayed: 0, wins: 0, answers: 0, correct: 0, wrong: 0,
    bestStreak: 0, winStreak: 0, bestWinStreak: 0,
    throws: 0, booms: 0, knockouts: 0, clutchThrows: 0,
    perfectGames: 0, fullLifeWins: 0, comebacks: 0, pureWins: 0,
    hardWins: 0, extremeWins: 0, bigLobbyWins: 0, duelWins: 0,
    fastAnswers3: 0, fastAnswers15: 0, fastestMs: 0,
    blitzBest: 0, survivalBest: 0, practiceAnswers: 0,
    powerupsUsed: 0, shieldBlocks: 0,
    lobbiesJoined: 0, lobbiesCreated: 0, chatSent: 0,
    coinsEarned: 0, purchases: 0,
    dailyDone: 0, dailyPerfect: 0, dailyStreak: 0, bestDailyStreak: 0,
    minutesPlayed: 0, secondsPlayed: 0,
    nightGames: 0, morningGames: 0, answer42: 0, tripleBoom: 0, pacifist: 0
  };

  M.CATEGORIES.forEach(function (c) { DEFAULT_STATS['cat_' + c.id] = 0; });

  function defaults() {
    return {
      v: 1,
      name: 'Du',
      avatar: '🦊',
      theme: 'default',
      bomb: '💣',
      coins: 60,
      xp: 0,
      level: 1,
      owned: ['bo_bomb'],
      settings: { sound: true, vibrate: true, anim: true },
      stats: JSON.parse(JSON.stringify(DEFAULT_STATS)),
      unlocked: {},
      daily: { date: '', score: 0, best: 0, streak: 0 },
      history: [],
      createdAt: Date.now()
    };
  }

  var profile = defaults();
  M.profile = profile;

  M.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        var base = defaults();
        Object.keys(base).forEach(function (k) {
          if (saved[k] === undefined) saved[k] = base[k];
        });
        Object.keys(DEFAULT_STATS).forEach(function (k) {
          if (typeof saved.stats[k] !== 'number') saved.stats[k] = DEFAULT_STATS[k];
        });
        Object.keys(base.settings).forEach(function (k) {
          if (saved.settings[k] === undefined) saved.settings[k] = base.settings[k];
        });
        profile = saved;
      }
    } catch (e) { /* korrupt data — börja om */ }
    M.profile = profile;
    return profile;
  };

  M.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* full disk */ }
  };

  M.reset = function () {
    profile = defaults();
    M.profile = profile;
    M.save();
  };

  /* ---------- XP & nivåer -------------------------------------------------- */

  M.xpForLevel = function (lvl) { return 90 + (lvl - 1) * 55; };

  M.addXp = function (amount) {
    if (amount <= 0) return { levels: 0 };
    profile.xp += amount;
    var levels = 0;
    while (profile.xp >= M.xpForLevel(profile.level)) {
      profile.xp -= M.xpForLevel(profile.level);
      profile.level++;
      levels++;
      M.addCoins(25 + profile.level * 5, true);
    }
    return { levels: levels };
  };

  M.addCoins = function (n, silent) {
    if (n <= 0) return;
    profile.coins += n;
    profile.stats.coinsEarned += n;
    if (!silent && M.ui) M.ui.coinFlash();
  };

  /* ---------- Statistik ---------------------------------------------------- */

  M.bump = function (key, by) {
    if (typeof profile.stats[key] !== 'number') profile.stats[key] = 0;
    profile.stats[key] += (by === undefined ? 1 : by);
  };

  M.setMax = function (key, val) {
    if (typeof profile.stats[key] !== 'number') profile.stats[key] = 0;
    if (val > profile.stats[key]) profile.stats[key] = val;
  };

  M.accuracy = function () {
    var s = profile.stats;
    if (!s.answers) return 0;
    return Math.round(s.correct / s.answers * 100);
  };

  /* ---------- Prestationer -------------------------------------------------- */

  function statValue(key) {
    var s = profile.stats;
    if (key === 'level') return profile.level;
    if (key === 'achUnlocked') return Object.keys(profile.unlocked).length;
    if (key === 'themesOwned') {
      return M.SHOP.filter(function (it) {
        return it.type === 'theme' && profile.owned.indexOf(it.id) >= 0;
      }).length;
    }
    if (key === 'allCats10') {
      return M.CATEGORIES.every(function (c) { return s['cat_' + c.id] >= 10; }) ? 1 : 0;
    }
    if (key === 'minutesPlayed') return Math.floor(s.secondsPlayed / 60);
    return s[key] || 0;
  }
  M.statValue = statValue;

  M.achProgress = function (a) {
    var v = statValue(a.stat);
    return { value: Math.min(v, a.goal), goal: a.goal, done: !!profile.unlocked[a.id], pct: Math.min(100, Math.round(v / a.goal * 100)) };
  };

  /* Kollar alla prestationer, låser upp nya och returnerar dem. */
  M.checkAchievements = function () {
    var fresh = [];
    for (var pass = 0; pass < 2; pass++) {
      M.ACHIEVEMENTS.forEach(function (a) {
        if (profile.unlocked[a.id]) return;
        if (statValue(a.stat) >= a.goal) {
          profile.unlocked[a.id] = Date.now();
          profile.coins += a.c;
          profile.stats.coinsEarned += a.c;
          fresh.push(a);
        }
      });
      // andra varvet fångar prestationer som utlöses av antalet upplåsta
    }
    if (fresh.length) M.save();
    return fresh;
  };

  M.unlockedCount = function () { return Object.keys(profile.unlocked).length; };

  M.achPoints = function () {
    var pts = { vanlig: 5, ovanlig: 10, sallsynt: 20, episk: 40, legendarisk: 80, hemlig: 50 };
    return M.ACHIEVEMENTS.reduce(function (sum, a) {
      return sum + (profile.unlocked[a.id] ? (pts[a.r] || 5) : 0);
    }, 0);
  };

  /* ---------- Historik ------------------------------------------------------ */

  M.pushHistory = function (entry) {
    entry.at = Date.now();
    profile.history.unshift(entry);
    if (profile.history.length > 40) profile.history.length = 40;
  };

  /* ---------- Dagens utmaning ----------------------------------------------- */

  M.todayKey = function () {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };

  M.dailyDoneToday = function () { return profile.daily.date === M.todayKey(); };

  /* Deterministisk slump så att dagens frågor blir samma för alla. */
  M.seededRandom = function (seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Ägande -------------------------------------------------------- */

  M.owns = function (id) { return profile.owned.indexOf(id) >= 0; };

  M.buy = function (id) {
    var item = null;
    M.SHOP.forEach(function (it) { if (it.id === id) item = it; });
    if (!item || M.owns(id) || profile.coins < item.cost) return false;
    profile.coins -= item.cost;
    profile.owned.push(id);
    M.bump('purchases');
    M.save();
    return true;
  };

})(window.MATTENITE = window.MATTENITE || {});
