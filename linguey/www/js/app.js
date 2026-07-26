/* ==========================================================================
   Linguey — huvudlogik
   Skärmar, sparad progress, spelifierade lektioner, svit och sviträddning.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.LINGUEY_DATA;
  var STORE_KEY = 'linguey.save.v1';

  /* Hur många lektioner + bonuslektioner som krävs för att rädda sviten */
  var REPAIR_LESSONS = 3;
  var REPAIR_BONUS = 1;

  var HEARTS_MAX = 5;
  var DAILY_GOAL_XP = 40;

  /* ---------------------------------------------------------------- Hjälpare */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayNumber(dateStr) {
    var p = dateStr.split('-');
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function norm(s) {
    return s.toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function vibrate(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  /* ------------------------------------------------------------------ State */
  var defaultState = function () {
    return {
      lang: 'es',
      xp: 0,
      gems: 20,
      hearts: HEARTS_MAX,
      heartsDate: today(),
      streak: 0,
      bestStreak: 0,
      lastPractice: null,     // 'YYYY-MM-DD'
      dailyXp: 0,
      dailyDate: today(),
      /* progress[langId][unit:lesson] = { crowns, best } */
      progress: {},
      bonusDone: 0,
      /* Sviträddning */
      repair: null,           // { date, savedStreak, lessons, bonus }
      repairsUsed: 0,
      achievements: {},
      langsTouched: {}
    };
  };

  var S = defaultState();

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        Object.keys(defaultState()).forEach(function (k) {
          if (obj[k] !== undefined) S[k] = obj[k];
        });
      }
    } catch (e) { /* börja om från början */ }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function lang() { return D.getLanguage(S.lang); }

  function prog() {
    if (!S.progress[S.lang]) S.progress[S.lang] = {};
    return S.progress[S.lang];
  }
  function lessonProg(key) { return prog()[key] || { crowns: 0, best: 0 }; }

  /* Antal klarade lektioner i ordning bestämmer vad som är upplåst */
  function unlockedCount() {
    var flat = D.flatLessons(lang());
    var n = 0;
    for (var i = 0; i < flat.length; i++) {
      if (lessonProg(flat[i].key).crowns > 0) n++;
      else break;
    }
    return n;
  }

  /* ------------------------------------------------- Dag-, svit- & hjärtlogik */
  function rolloverDays() {
    var t = today();

    if (S.dailyDate !== t) { S.dailyDate = t; S.dailyXp = 0; }
    if (S.heartsDate !== t) { S.heartsDate = t; S.hearts = HEARTS_MAX; }

    if (!S.lastPractice) return;

    var gap = dayNumber(t) - dayNumber(S.lastPractice);

    /* En pågående räddning som inte slutfördes i tid går förlorad */
    if (S.repair && S.repair.date !== t) {
      S.repair = null;
      S.streak = 0;
    }

    if (gap >= 2 && !S.repair && S.streak > 0) {
      /* Minst en hel dag missad -> sviten fryses och kan räddas i dag */
      S.repair = { date: t, savedStreak: S.streak, lessons: 0, bonus: 0 };
    }
    save();
  }

  function streakFrozen() { return !!S.repair; }
  function repairComplete() {
    return S.repair && S.repair.lessons >= REPAIR_LESSONS && S.repair.bonus >= REPAIR_BONUS;
  }

  /* Registrerar en klarad lektion: svit, XP-mål, räddningsuppdrag */
  function registerCompletion(isBonus) {
    var t = today();

    if (S.repair) {
      if (isBonus) S.repair.bonus++;
      else S.repair.lessons++;

      if (repairComplete()) {
        S.streak = S.repair.savedStreak + 1;
        S.lastPractice = t;
        S.repair = null;
        S.repairsUsed++;
        unlock('repair');
        if (S.streak > S.bestStreak) S.bestStreak = S.streak;
        save();
        return 'repaired';
      }
      save();
      return 'repairing';
    }

    if (S.lastPractice !== t) {
      var gap = S.lastPractice ? dayNumber(t) - dayNumber(S.lastPractice) : 999;
      S.streak = (gap === 1) ? S.streak + 1 : 1;
      S.lastPractice = t;
      if (S.streak > S.bestStreak) S.bestStreak = S.streak;
      if (S.streak >= 3) unlock('streak3');
      if (S.streak >= 7) unlock('streak7');
      save();
      return 'streak';
    }
    save();
    return 'ok';
  }

  function addXp(n) {
    S.xp += n;
    S.dailyXp += n;
    if (S.xp >= 500) unlock('xp500');
    if (S.xp >= 2000) unlock('xp2000');
    save();
  }

  function unlock(id) {
    if (S.achievements[id]) return false;
    S.achievements[id] = today();
    save();
    toastAchievement(id);
    return true;
  }

  function toastAchievement(id) {
    var a = null;
    D.achievements.forEach(function (x) { if (x.id === id) a = x; });
    if (!a) return;
    var n = el('div', 'card');
    n.style.cssText = 'position:fixed;left:14px;right:14px;top:calc(12px + var(--safe-top));z-index:120;' +
      'display:flex;gap:11px;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.5)';
    n.innerHTML = '<div class="ic" style="width:42px;height:42px;border-radius:12px;display:grid;' +
      'place-items:center;font-size:21px;background:rgba(255,255,255,.08)">' + a.icon + '</div>' +
      '<div><b style="font-size:14px">Prestation upplåst!</b>' +
      '<div class="sub">' + a.title + '</div></div>';
    document.body.appendChild(n);
    vibrate(30);
    setTimeout(function () { n.style.transition = 'opacity .4s'; n.style.opacity = '0'; }, 2200);
    setTimeout(function () { n.remove(); }, 2700);
  }

  /* ---------------------------------------------------------------- Skärmar */
  var currentScreen = 'home';

  function show(name) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.id === 'screen-' + name); });
    $$('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.nav === name); });
    $('#nav').style.display = (name === 'lesson' || name === 'bonus3d' || name === 'result') ? 'none' : 'flex';
    currentScreen = name;
    if (name !== 'bonus3d') window.LINGUEY_3D.stop();
    if (name === 'home') renderHome();
    if (name === 'langs') renderLangs();
    if (name === 'profile') renderProfile();
    if (name === 'bonus') renderBonusHub();
  }

  function renderTop() {
    var L = lang();
    $('#top-flag').innerHTML = L.flag + '<small>' + L.name + '</small>';
    var st = $('#top-streak');
    st.classList.toggle('frozen', streakFrozen());
    st.innerHTML = '<i>' + (streakFrozen() ? '❄️' : '🔥') + '</i>' +
      (streakFrozen() ? S.repair.savedStreak : S.streak);
    $('#top-gems').innerHTML = '<i>💎</i>' + S.gems;
    $('#top-hearts').innerHTML = '<i>❤️</i>' + S.hearts;
  }

  /* --------------------------------------------------------------- Startsida */
  function renderHome() {
    renderTop();
    var L = lang();
    var box = $('#home-scroll');
    box.innerHTML = '';

    /* Dagsmål */
    var goal = el('div', 'card');
    var pctGoal = Math.min(100, Math.round(S.dailyXp / DAILY_GOAL_XP * 100));
    goal.innerHTML =
      '<div class="row"><div class="grow"><div class="h2">Dagens mål</div>' +
      '<div class="sub">' + S.dailyXp + ' / ' + DAILY_GOAL_XP + ' XP i dag</div></div>' +
      '<div class="pill gold">' + (pctGoal >= 100 ? 'Klart! 🎉' : pctGoal + '%') + '</div></div>' +
      '<div class="bar" style="margin-top:12px"><i style="width:' + pctGoal + '%"></i></div>';
    box.appendChild(goal);

    /* Sviträddning */
    if (streakFrozen()) {
      var r = el('div', 'card repair');
      r.innerHTML =
        '<div class="row"><div class="grow">' +
        '<div class="h2">❄️ Din svit är fryst</div>' +
        '<div class="sub">Du missade en dag. Spela <b>' + REPAIR_LESSONS + ' lektioner</b> och ' +
        '<b>' + REPAIR_BONUS + ' bonuslektion</b> i dag så får du tillbaka din svit på ' +
        S.repair.savedStreak + ' dagar.</div></div></div>' +
        '<div class="tasks">' +
        '<div class="tk' + (S.repair.lessons >= REPAIR_LESSONS ? ' ok' : '') + '">📚 Lektioner<br>' +
        Math.min(S.repair.lessons, REPAIR_LESSONS) + '/' + REPAIR_LESSONS + '</div>' +
        '<div class="tk' + (S.repair.bonus >= REPAIR_BONUS ? ' ok' : '') + '">🕹️ Bonus 3D<br>' +
        Math.min(S.repair.bonus, REPAIR_BONUS) + '/' + REPAIR_BONUS + '</div>' +
        '</div>';
      var rb = el('button', 'btn gold sm', '🕹️ Starta bonuslektion (3D)');
      rb.style.marginTop = '12px';
      rb.onclick = function () { startBonus(); };
      r.appendChild(rb);
      box.appendChild(r);
    }

    /* Lektionsstig */
    var flat = D.flatLessons(L);
    var unlocked = unlockedCount();
    var lessonCounter = 0;

    L.units.forEach(function (unit, ui) {
      var uh = el('div', 'unit');
      uh.innerHTML = '<div class="badge">' + unit.icon + '</div>' +
        '<div class="grow"><div class="h2">' + unit.title + '</div>' +
        '<div class="sub">Enhet ' + (ui + 1) + ' · ' + unit.lessons.length + ' lektioner</div></div>';
      box.appendChild(uh);

      var path = el('div', 'path');
      unit.lessons.forEach(function (lesson, li) {
        var key = ui + ':' + li;
        var p = lessonProg(key);
        var index = lessonCounter++;
        var state = p.crowns > 0 ? 'done' : (index === unlocked ? 'current' : (index < unlocked ? 'done' : 'locked'));

        var row = el('div', 'pathrow o' + (1 + (index % 3)));
        var node = el('div', 'node ' + state);
        node.innerHTML = (state === 'locked' ? '🔒' : (state === 'done' ? '⭐' : '▶')) +
          '<div class="lbl">' + lesson.title + '</div>' +
          (p.crowns ? '<div class="crowns">👑' + p.crowns + '</div>' : '');
        if (state !== 'locked') {
          node.onclick = function () { openLessonSheet(ui, li); };
        } else {
          node.onclick = function () { flash('Klara lektionen före den här först 🔒'); };
        }
        row.appendChild(node);
        path.appendChild(row);
      });

      /* Bonusnod efter varje enhet */
      var brow = el('div', 'pathrow o1');
      var bnode = el('div', 'node bonus');
      bnode.innerHTML = '🕹️<div class="lbl">Bonus 3D</div>';
      bnode.onclick = function () { startBonus(ui); };
      brow.appendChild(bnode);
      path.appendChild(brow);

      box.appendChild(path);
    });

    var done = flat.filter(function (f) { return lessonProg(f.key).crowns > 0; }).length;
    var foot = el('div', 'card');
    foot.innerHTML = '<div class="row"><div class="grow"><div class="h2">' + L.flag + ' ' + L.name + '</div>' +
      '<div class="sub">' + done + ' av ' + flat.length + ' lektioner klara</div></div>' +
      '<div class="pill">' + Math.round(done / flat.length * 100) + '%</div></div>' +
      '<div class="bar" style="margin-top:12px"><i style="width:' + (done / flat.length * 100) + '%"></i></div>';
    box.appendChild(foot);
  }

  function flash(msg) {
    var n = el('div', '', msg);
    n.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:120;' +
      'background:rgba(0,0,0,.85);padding:11px 16px;border-radius:999px;font-size:13.5px;font-weight:800;' +
      'border:1px solid rgba(255,255,255,.12);max-width:88%;text-align:center';
    document.body.appendChild(n);
    setTimeout(function () { n.style.transition = 'opacity .3s'; n.style.opacity = '0'; }, 1500);
    setTimeout(function () { n.remove(); }, 1900);
  }

  /* ---------------------------------------------------------- Lektionsdialog */
  function openLessonSheet(ui, li) {
    var L = lang();
    var lesson = L.units[ui].lessons[li];
    var p = lessonProg(ui + ':' + li);
    var body = $('#sheet-body');
    body.innerHTML =
      '<div class="row"><div class="grow"><div class="h1">' + lesson.title + '</div>' +
      '<div class="sub">' + L.units[ui].title + ' · ' + lesson.words.length + ' ord</div></div>' +
      '<div class="pill gold">👑 ' + p.crowns + '</div></div>' +
      '<div class="sub" style="margin:14px 0 4px">Du tränar: ' +
      lesson.words.slice(0, 4).map(function (w) { return w[0]; }).join(', ') + ' …</div>';
    var b = el('button', 'btn', (p.crowns > 0 ? 'Öva igen' : 'Starta lektion') + '  ·  +' + xpForLesson() + ' XP');
    b.style.marginTop = '16px';
    b.onclick = function () { closeSheet(); startLesson(ui, li); };
    body.appendChild(b);
    var b2 = el('button', 'btn ghost sm', 'Avbryt');
    b2.style.marginTop = '10px';
    b2.onclick = closeSheet;
    body.appendChild(b2);
    $('#modal').classList.add('show');
  }
  function closeSheet() { $('#modal').classList.remove('show'); }
  function xpForLesson() { return 15; }

  /* =========================================================== LEKTIONSSPEL */
  var LS = null; // aktiv lektionssession

  function buildQuestions(lesson, L) {
    var pool = D.allWords(L);
    var qs = [];
    var words = shuffle(lesson.words);

    words.forEach(function (w, i) {
      var type = i % 4;
      if (type === 0 || type === 2) {
        /* Flerval, växlande riktning */
        var toTarget = (i % 4 === 0);
        var distract = shuffle(pool.filter(function (x) {
          return x[1] !== w[1];
        })).slice(0, 3);
        qs.push({
          kind: 'choice',
          prompt: toTarget ? w[0] : w[1],
          hint: toTarget ? 'Välj översättningen på ' + L.name.toLowerCase() : 'Vad betyder detta på svenska?',
          answer: toTarget ? w[1] : w[0],
          options: shuffle([toTarget ? w[1] : w[0]].concat(distract.map(function (d) {
            return toTarget ? d[1] : d[0];
          }))),
          speak: toTarget ? w[1] : null
        });
      } else if (type === 1) {
        qs.push({
          kind: 'type',
          prompt: w[0],
          hint: 'Skriv på ' + L.name.toLowerCase(),
          answer: w[1],
          speak: w[1]
        });
      } else {
        qs.push({
          kind: 'match',
          prompt: 'Matcha paren',
          hint: 'Tryck på ett svenskt ord och sedan dess översättning',
          pairs: shuffle(lesson.words).slice(0, 4)
        });
      }
    });

    /* Meningar sist — bygg meningen med brickor */
    lesson.sentences.forEach(function (s) {
      var target = s[1].split(' ');
      var extra = shuffle(D.allWords(L)).slice(0, 2).map(function (w) {
        return w[1].split(' ')[0];
      });
      qs.push({
        kind: 'build',
        prompt: s[0],
        hint: 'Bygg meningen på ' + L.name.toLowerCase(),
        answer: s[1],
        tiles: shuffle(target.concat(extra)),
        speak: s[1]
      });
    });

    return qs.slice(0, 10);
  }

  function startLesson(ui, li) {
    if (S.hearts <= 0) {
      openHeartsSheet();
      return;
    }
    var L = lang();
    var lesson = L.units[ui].lessons[li];
    LS = {
      ui: ui, li: li, lesson: lesson, L: L,
      qs: buildQuestions(lesson, L),
      i: 0, correct: 0, wrong: 0, combo: 0, bestCombo: 0,
      startedAt: Date.now(),
      answered: false
    };
    S.langsTouched[S.lang] = true;
    if (Object.keys(S.langsTouched).length >= 3) unlock('polyglot');
    show('lesson');
    renderQuestion();
  }

  function renderQuestion() {
    var q = LS.qs[LS.i];
    LS.answered = false;
    LS.sel = null;
    LS.built = [];
    LS.matchPick = null;
    LS.matched = {};

    $('#lesson-bar > .bar > i').style.width = (LS.i / LS.qs.length * 100) + '%';
    $('#lesson-hearts').innerHTML = '❤️ ' + S.hearts;

    var wrap = $('#q-wrap');
    wrap.innerHTML = '';
    wrap.appendChild(el('div', 'prompt', q.kind === 'match' ? 'Matcha paren' : q.prompt));
    wrap.appendChild(el('div', 'hintline', q.hint));

    if (q.kind === 'choice') {
      var opts = el('div', 'opts');
      q.options.forEach(function (o) {
        var b = el('button', 'opt', o);
        b.onclick = function () {
          if (LS.answered) return;
          $$('.opt', opts).forEach(function (x) { x.classList.remove('sel'); });
          b.classList.add('sel');
          LS.sel = o;
          setCheckEnabled(true);
        };
        opts.appendChild(b);
      });
      wrap.appendChild(opts);

    } else if (q.kind === 'type') {
      var inp = el('input', 'txtin');
      inp.type = 'text';
      inp.autocapitalize = 'none';
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.placeholder = 'Din översättning…';
      inp.oninput = function () { LS.sel = inp.value; setCheckEnabled(inp.value.trim().length > 0); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') check(); };
      wrap.appendChild(inp);
      setTimeout(function () { inp.focus(); }, 60);

    } else if (q.kind === 'build') {
      var abox = el('div', 'answerbox');
      var tiles = el('div', 'tiles');
      q.tiles.forEach(function (t, idx) {
        var b = el('button', 'tile', t);
        b.onclick = function () {
          if (LS.answered) return;
          if (b.classList.contains('used')) return;
          b.classList.add('used');
          LS.built.push({ word: t, node: b });
          redrawBuilt();
        };
        tiles.appendChild(b);
      });
      function redrawBuilt() {
        abox.innerHTML = '';
        LS.built.forEach(function (item, idx) {
          var b = el('button', 'tile', item.word);
          b.onclick = function () {
            if (LS.answered) return;
            item.node.classList.remove('used');
            LS.built.splice(idx, 1);
            redrawBuilt();
          };
          abox.appendChild(b);
        });
        setCheckEnabled(LS.built.length > 0);
      }
      wrap.appendChild(abox);
      wrap.appendChild(tiles);

    } else if (q.kind === 'match') {
      var grid = el('div', 'matchgrid');
      var left = shuffle(q.pairs);
      var right = shuffle(q.pairs);
      var colL = el('div', 'opts');
      var colR = el('div', 'opts');
      left.forEach(function (p) {
        var b = el('button', 'opt', p[0]);
        b.style.fontSize = '15px';
        b.onclick = function () {
          if (b.classList.contains('right')) return;
          $$('.opt', colL).forEach(function (x) { if (!x.classList.contains('right')) x.classList.remove('sel'); });
          b.classList.add('sel');
          LS.matchPick = { pair: p, node: b };
        };
        colL.appendChild(b);
      });
      right.forEach(function (p) {
        var b = el('button', 'opt', p[1]);
        b.style.fontSize = '15px';
        b.onclick = function () {
          if (!LS.matchPick || b.classList.contains('right')) return;
          if (LS.matchPick.pair[1] === p[1]) {
            b.classList.add('right');
            LS.matchPick.node.classList.remove('sel');
            LS.matchPick.node.classList.add('right');
            LS.matched[p[1]] = true;
            LS.matchPick = null;
            vibrate(12);
            if (Object.keys(LS.matched).length === q.pairs.length) {
              LS.sel = 'MATCHED';
              setCheckEnabled(true);
              check();
            }
          } else {
            b.classList.add('wrong');
            vibrate(60);
            var bad = b;
            setTimeout(function () { bad.classList.remove('wrong'); }, 500);
          }
        };
        colR.appendChild(b);
      });
      grid.appendChild(colL);
      grid.appendChild(colR);
      wrap.appendChild(grid);
    }

    if (q.speak) {
      var sp = el('button', 'speak', '🔊 Lyssna');
      sp.onclick = function () { speak(q.speak, LS.L.speech); };
      wrap.appendChild(sp);
    }

    $('#feedback').className = 'feedback';
    $('#check').textContent = 'Kontrollera';
    $('#check').className = 'btn';
    setCheckEnabled(q.kind === 'match' ? false : false);
  }

  function setCheckEnabled(on) { $('#check').disabled = !on; }

  function isCorrect(q) {
    if (q.kind === 'choice') return LS.sel === q.answer;
    if (q.kind === 'type') return norm(LS.sel || '') === norm(q.answer);
    if (q.kind === 'build') return norm(LS.built.map(function (b) { return b.word; }).join(' ')) === norm(q.answer);
    if (q.kind === 'match') return true;
    return false;
  }

  function check() {
    if (!LS) return;                      /* lektionen är redan avslutad */
    if (LS.answered) { next(); return; }
    var q = LS.qs[LS.i];
    var ok = isCorrect(q);
    LS.answered = true;

    if (ok) {
      LS.correct++;
      LS.combo++;
      if (LS.combo > LS.bestCombo) LS.bestCombo = LS.combo;
      vibrate(18);
      $('#feedback').className = 'feedback show ok';
      $('#feedback').innerHTML = ['Snyggt! 🎯', 'Precis! ✨', 'Perfekt! 🔥', 'Rätt! 💪'][LS.i % 4];
      if (LS.combo >= 3) showCombo(LS.combo + ' i rad! +' + (LS.combo * 2) + ' XP');
      if (q.kind === 'choice') {
        $$('.opt').forEach(function (x) { if (x.textContent === q.answer) x.classList.add('right'); });
      }
    } else {
      LS.wrong++;
      LS.combo = 0;
      S.hearts = Math.max(0, S.hearts - 1);
      save();
      vibrate([40, 40, 40]);
      $('#feedback').className = 'feedback show no';
      $('#feedback').innerHTML = 'Inte helt rätt' +
        (q.answer ? '<small>Rätt svar: ' + q.answer + '</small>' : '');
      if (q.kind === 'choice') {
        $$('.opt').forEach(function (x) {
          if (x.textContent === q.answer) x.classList.add('right');
          else if (x.classList.contains('sel')) x.classList.add('wrong');
        });
      }
      $('#lesson-hearts').innerHTML = '❤️ ' + S.hearts;
    }

    $('#check').textContent = 'Fortsätt';
    $('#check').className = 'btn ' + (ok ? 'good' : 'bad');
    setCheckEnabled(true);

    if (S.hearts <= 0) {
      setTimeout(function () { failLesson(); }, 900);
    }
  }

  function showCombo(txt) {
    var c = $('#combo');
    c.textContent = txt;
    c.classList.remove('go');
    void c.offsetWidth;
    c.classList.add('go');
  }

  function next() {
    LS.i++;
    if (LS.i >= LS.qs.length) finishLesson();
    else renderQuestion();
  }

  function failLesson() {
    LS = null;
    show('home');
    openHeartsSheet();
  }

  function openHeartsSheet() {
    var body = $('#sheet-body');
    body.innerHTML = '<div class="h1">💔 Inga hjärtan kvar</div>' +
      '<div class="sub" style="margin-top:8px">Hjärtan fylls på automatiskt i morgon. ' +
      'Du kan också fylla på direkt för 10 💎 (du har ' + S.gems + ').</div>';
    var b = el('button', 'btn' + (S.gems < 10 ? '' : ' gold'), 'Fyll på hjärtan · 10 💎');
    b.style.marginTop = '16px';
    b.disabled = S.gems < 10;
    b.onclick = function () {
      S.gems -= 10; S.hearts = HEARTS_MAX; save();
      closeSheet(); renderTop(); flash('Hjärtan påfyllda ❤️');
    };
    body.appendChild(b);
    var b2 = el('button', 'btn ghost sm', 'Stäng');
    b2.style.marginTop = '10px';
    b2.onclick = closeSheet;
    body.appendChild(b2);
    $('#modal').classList.add('show');
  }

  function finishLesson() {
    var total = LS.qs.length;
    var acc = LS.correct / total;
    var perfect = LS.wrong === 0;
    var baseXp = xpForLesson();
    var comboXp = LS.bestCombo >= 3 ? LS.bestCombo * 2 : 0;
    var perfectXp = perfect ? 10 : 0;
    var gained = Math.round(baseXp * Math.max(.4, acc)) + comboXp + perfectXp;
    var gems = perfect ? 3 : 1;

    var key = LS.ui + ':' + LS.li;
    var p = lessonProg(key);
    var crowns = Math.min(5, p.crowns + (acc >= .7 ? 1 : 0));
    prog()[key] = { crowns: crowns, best: Math.max(p.best, Math.round(acc * 100)) };

    addXp(gained);
    S.gems += gems;
    if (perfect) unlock('perfect');
    unlock('first');
    var streakResult = registerCompletion(false);
    save();

    showResult({
      title: perfect ? 'Perfekt lektion!' : (acc >= .7 ? 'Lektion klar!' : 'Bra försök!'),
      icon: perfect ? '💯' : (acc >= .7 ? '🎉' : '💪'),
      xp: gained, gems: gems,
      accuracy: Math.round(acc * 100),
      combo: LS.bestCombo,
      streakResult: streakResult,
      onDone: function () { LS = null; show('home'); }
    });
  }

  /* ------------------------------------------------------------- Resultatvy */
  function showResult(r) {
    var box = $('#result-body');
    box.innerHTML =
      '<div class="big">' + r.icon + '</div>' +
      '<div class="h1">' + r.title + '</div>' +
      '<div class="sub">' + resultSubtitle(r) + '</div>' +
      '<div class="rstats">' +
      '<div class="rstat"><b style="color:var(--gold)">+' + r.xp + '</b><span>XP</span></div>' +
      '<div class="rstat"><b style="color:var(--brand2)">+' + r.gems + '</b><span>Ädelstenar</span></div>' +
      '<div class="rstat"><b>' + r.accuracy + '%</b><span>Träffsäkerhet</span></div>' +
      '</div>';
    if (r.combo >= 3) {
      var c = el('div', 'pill gold', '🔥 Bästa kombo: ' + r.combo);
      box.appendChild(c);
    }
    if (streakFrozen()) {
      var rep = el('div', 'card repair');
      rep.style.marginTop = '16px';
      rep.innerHTML = '<b>❄️ Sviträddning pågår</b><div class="sub" style="margin-top:4px">' +
        'Lektioner ' + Math.min(S.repair.lessons, REPAIR_LESSONS) + '/' + REPAIR_LESSONS +
        ' · Bonus 3D ' + Math.min(S.repair.bonus, REPAIR_BONUS) + '/' + REPAIR_BONUS + '</div>';
      box.appendChild(rep);
    }
    $('#result-cont').onclick = function () { r.onDone(); };
    show('result');
  }

  function resultSubtitle(r) {
    if (r.streakResult === 'repaired') return '🔥 Din svit är räddad! Du är tillbaka på ' + S.streak + ' dagar.';
    if (r.streakResult === 'repairing') return 'Fortsätt — snart är sviten räddad.';
    if (r.streakResult === 'streak') return '🔥 Svit: ' + S.streak + ' dag' + (S.streak === 1 ? '' : 'ar') + ' i rad!';
    return 'Bra jobbat, fortsätt så!';
  }

  /* --------------------------------------------------------- Bonus-navet (3D) */
  function renderBonusHub() {
    renderTop();
    var box = $('#bonus-scroll');
    var L = lang();
    box.innerHTML = '';

    var hero = el('div', 'card');
    hero.style.background = 'linear-gradient(150deg,#3b2f8f,#1b2a63 60%,#123047)';
    hero.innerHTML =
      '<div class="pill gold">Bonuslektion</div>' +
      '<div class="h1" style="margin-top:10px">🕹️ 3D Spelarläge</div>' +
      '<div class="sub" style="margin-top:6px">Ett riktigt 3D-spel där du går runt i en värld och ' +
      'springer in i rätt översättning. Samma ord som i lektionerna — men i första person.</div>' +
      '<div class="sub" style="margin-top:10px"><b>⚠️ Kräver porträttläge.</b> Bonuslektioner ' +
      'spelas alltid med mobilen stående.</div>';
    box.appendChild(hero);

    var b = el('button', 'btn gold', '▶ Spela bonuslektion · ' + L.flag + ' ' + L.name);
    b.onclick = function () { startBonus(); };
    box.appendChild(b);
    box.appendChild(el('div', '', ' ')).style.height = '12px';

    var info = el('div', 'card');
    info.innerHTML =
      '<div class="h2">Så spelar du</div>' +
      '<div class="sub" style="margin-top:8px">' +
      '• <b>Vänster styrkula</b> — gå framåt, bakåt och i sidled.<br>' +
      '• <b>Svep till höger på skärmen</b> — titta runt.<br>' +
      '• Spring in i porten med rätt översättning av ordet i toppen.<br>' +
      '• 8 rätta ord innan tiden tar slut = bonuslektionen klar.<br>' +
      '• Fel port kostar tid, så läs noga.' +
      '</div>';
    box.appendChild(info);

    var rr = el('div', 'card' + (streakFrozen() ? ' repair' : ''));
    rr.innerHTML =
      '<div class="h2">🛟 Rädda din svit</div>' +
      '<div class="sub" style="margin-top:8px">Missar du en dag fryses sviten. Spela då ' +
      '<b>' + REPAIR_LESSONS + ' vanliga lektioner</b> + <b>' + REPAIR_BONUS + ' bonuslektion</b> ' +
      'samma dag, så får du tillbaka sviten där du lämnade den.' +
      (streakFrozen()
        ? '<br><br><b>Status just nu:</b> ' + Math.min(S.repair.lessons, REPAIR_LESSONS) + '/' + REPAIR_LESSONS +
          ' lektioner, ' + Math.min(S.repair.bonus, REPAIR_BONUS) + '/' + REPAIR_BONUS + ' bonus.'
        : '<br><br>Din svit är trygg just nu ✅') +
      '</div>';
    box.appendChild(rr);

    var stats = el('div', 'card');
    stats.innerHTML = '<div class="row"><div class="grow"><div class="h2">Bonuslektioner klara</div>' +
      '<div class="sub">Totalt över alla språk</div></div><div class="pill cyan">' + S.bonusDone + '</div></div>';
    box.appendChild(stats);
  }

  /* Startar 3D-bonuslektionen — porträttspärren hanteras av orientation.js */
  function startBonus(unitIndex) {
    var L = lang();
    var words = unitIndex !== undefined && L.units[unitIndex]
      ? L.units[unitIndex].lessons.reduce(function (a, l) { return a.concat(l.words); }, [])
      : D.allWords(L);

    show('bonus3d');
    window.LINGUEY_ORIENTATION.enterBonus();
    window.LINGUEY_3D.start({
      words: words,
      language: L,
      goal: 8,
      time: 100,
      onFinish: function (res) {
        window.LINGUEY_ORIENTATION.exitBonus();
        window.LINGUEY_3D.stop();
        if (!res.completed) { show('bonus'); flash('Bonuslektionen avbröts'); return; }

        var gained = 25 + res.correct * 3 + (res.timeLeft > 0 ? Math.round(res.timeLeft / 4) : 0);
        addXp(gained);
        S.gems += 5;
        S.bonusDone++;
        unlock('bonus1');
        if (S.bonusDone >= 5) unlock('bonus5');
        var sr = registerCompletion(true);
        save();

        showResult({
          title: 'Bonuslektion klar!',
          icon: '🕹️',
          xp: gained, gems: 5,
          accuracy: Math.round(res.correct / Math.max(1, res.correct + res.wrong) * 100),
          combo: res.bestCombo,
          streakResult: sr,
          onDone: function () { show('bonus'); }
        });
      },
      onQuit: function () {
        window.LINGUEY_ORIENTATION.exitBonus();
        window.LINGUEY_3D.stop();
        show('bonus');
      }
    });
  }

  /* ----------------------------------------------------------------- Språkval */
  function renderLangs() {
    renderTop();
    var box = $('#langs-scroll');
    box.innerHTML = '';
    box.appendChild(el('div', 'h1', 'Välj språk'));
    var s = el('div', 'sub', 'Din progress sparas separat för varje språk.');
    s.style.margin = '4px 0 16px';
    box.appendChild(s);

    var grid = el('div', 'langgrid');
    D.languages.forEach(function (L) {
      var flat = D.flatLessons(L);
      var p = S.progress[L.id] || {};
      var done = flat.filter(function (f) { return p[f.key] && p[f.key].crowns > 0; }).length;
      var c = el('div', 'langcard' + (L.id === S.lang ? ' sel' : ''));
      c.innerHTML = '<div class="fl">' + L.flag + '</div>' +
        '<div class="nm">' + L.name + '</div>' +
        '<div class="nt">' + L.native + '</div>' +
        '<div class="bar"><i style="width:' + (done / flat.length * 100) + '%"></i></div>' +
        '<div class="nt" style="margin-top:6px">' + done + '/' + flat.length + ' lektioner</div>';
      c.onclick = function () {
        S.lang = L.id; save();
        flash(L.flag + ' ' + L.name + ' valt');
        show('home');
      };
      grid.appendChild(c);
    });
    box.appendChild(grid);
  }

  /* ------------------------------------------------------------------ Profil */
  function renderProfile() {
    renderTop();
    var box = $('#profile-scroll');
    box.innerHTML = '';

    var level = Math.floor(S.xp / 100) + 1;
    var into = S.xp % 100;

    var head = el('div', 'card');
    head.innerHTML =
      '<div class="row"><div class="splash-mark" style="width:56px;height:56px;border-radius:18px;' +
      'background:linear-gradient(140deg,var(--brand),var(--brand2));display:grid;place-items:center;' +
      'font-size:28px">🦉</div>' +
      '<div class="grow"><div class="h1">Nivå ' + level + '</div>' +
      '<div class="sub">' + S.xp + ' XP totalt</div></div></div>' +
      '<div class="bar" style="margin-top:12px"><i style="width:' + into + '%"></i></div>' +
      '<div class="sub" style="margin-top:6px">' + (100 - into) + ' XP till nivå ' + (level + 1) + '</div>';
    box.appendChild(head);

    var g = el('div', 'rstats');
    g.style.margin = '0 0 12px';
    g.innerHTML =
      '<div class="rstat"><b style="color:var(--gold)">' + (streakFrozen() ? S.repair.savedStreak + '❄️' : S.streak) +
      '</b><span>Svit</span></div>' +
      '<div class="rstat"><b>' + S.bestStreak + '</b><span>Rekord</span></div>' +
      '<div class="rstat"><b style="color:var(--brand2)">' + S.gems + '</b><span>💎</span></div>' +
      '<div class="rstat"><b>' + S.bonusDone + '</b><span>3D-bonus</span></div>';
    box.appendChild(g);

    var ac = el('div', 'card');
    ac.appendChild(el('div', 'h2', 'Prestationer'));
    D.achievements.forEach(function (a) {
      var got = !!S.achievements[a.id];
      var r = el('div', 'ach' + (got ? '' : ' locked'));
      r.innerHTML = '<div class="ic">' + (got ? a.icon : '🔒') + '</div>' +
        '<div class="grow"><b>' + a.title + '</b><p>' + a.desc + '</p></div>' +
        (got ? '<div class="pill gold">Klar</div>' : '');
      ac.appendChild(r);
    });
    box.appendChild(ac);

    var dbg = el('div', 'card');
    dbg.appendChild(el('div', 'h2', 'Svit & test'));
    var d1 = el('div', 'sub', 'Vill du testa sviträddningen? Simulera en missad dag — sviten fryses och ' +
      'räddningsuppdraget (' + REPAIR_LESSONS + ' lektioner + ' + REPAIR_BONUS + ' bonuslektion) startar.');
    d1.style.margin = '8px 0 12px';
    dbg.appendChild(d1);
    var mb = el('button', 'btn ghost sm', '❄️ Simulera missad dag');
    mb.onclick = function () {
      if (S.streak <= 0) { S.streak = 5; S.bestStreak = Math.max(S.bestStreak, 5); }
      var d = new Date(); d.setDate(d.getDate() - 3);
      S.lastPractice = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      S.repair = null;
      save();
      rolloverDays();
      flash('Missad dag simulerad — rädda sviten!');
      show('home');
    };
    dbg.appendChild(mb);
    var rb = el('button', 'btn ghost sm', '🗑️ Nollställ all progress');
    rb.style.marginTop = '10px';
    rb.onclick = function () {
      if (!confirm('Nollställa all progress?')) return;
      S = defaultState();
      save();
      show('home');
    };
    dbg.appendChild(rb);
    box.appendChild(dbg);

    var about = el('div', 'card');
    about.innerHTML = '<div class="h2">Om Linguey</div><div class="sub" style="margin-top:6px">' +
      'Linguey ' + (window.LINGUEY_VERSION || '1.0.0') + ' — en Cordova-app för att lära sig språk ' +
      'med spelifierade lektioner och ett 3D-bonusläge. Fungerar helt offline.</div>';
    box.appendChild(about);
  }

  /* ------------------------------------------------------------------- Tal */
  function speak(text, lc) {
    if (!('speechSynthesis' in window)) { flash('Uppläsning stöds inte här'); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lc || 'en-US';
      u.rate = .9;
      window.speechSynthesis.speak(u);
    } catch (e) { flash('Kunde inte läsa upp'); }
  }

  /* ------------------------------------------------------------------- Start */
  function boot() {
    load();
    rolloverDays();

    $('#check').onclick = check;
    $('#lesson-x').onclick = function () {
      if (confirm('Avbryta lektionen? Din progress i lektionen försvinner.')) { LS = null; show('home'); }
    };
    $('#top-flag').onclick = function () { show('langs'); };
    $('#top-hearts').onclick = function () { if (S.hearts <= 0) openHeartsSheet(); };
    $('#modal').onclick = function (e) { if (e.target === $('#modal')) closeSheet(); };
    $$('.nav button').forEach(function (b) {
      b.onclick = function () { show(b.dataset.nav); };
    });

    show('home');

    setTimeout(function () {
      $('#splash').classList.add('hide');
      setTimeout(function () { $('#splash').style.display = 'none'; }, 500);
    }, 1100);

    /* Dagsgränsen kan passera medan appen är öppen */
    document.addEventListener('resume', function () {
      rolloverDays();
      if (currentScreen === 'home') renderHome();
      renderTop();
    }, false);
  }

  /* Exponera det 3D-läget behöver */
  window.LINGUEY_APP = {
    boot: boot,
    show: show,
    flash: flash,
    state: function () { return S; },
    session: function () { return LS; }
  };

  /* Starta på deviceready i appen, på DOM-klart i webbläsaren — och med en
     säkerhetsventil om deviceready mot förmodan aldrig kommer. */
  var booted = false;
  function bootOnce() {
    if (booted) return;
    booted = true;
    boot();
  }
  if (window.cordova) {
    document.addEventListener('deviceready', bootOnce, false);
    setTimeout(bootOnce, 3000);
  } else if (document.readyState !== 'loading') {
    bootOnce();
  } else {
    document.addEventListener('DOMContentLoaded', bootOnce);
  }
})();
