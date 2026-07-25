/* ==========================================================================
   arena-ui.js — meny, HUD och styrning för Minfältet 3D
   ========================================================================== */
(function (M) {
  'use strict';

  var ui = M.ui, A = M.arena;
  var $ = ui.$, $$ = ui.$$, esc = ui.esc;

  var stage = null, mapCtx = null, glOk = null;
  var cfg = { diff: 2, cat: 'mix', bots: 3 };
  var keys = {};
  var lookDrag = null, stickDrag = null;

  /* ---------- Menyvyn ------------------------------------------------------- */

  ui.renderArena = function () {
    var s = M.profile.stats;
    var left = Math.max(0, M.ARCADE_REQUIRED - s.arena3dWins);

    $('#view-arena').innerHTML =
      '<div class="view-head"><h2>Minfältet 3D</h2>' +
        '<p>Gå runt i arenan i förstaperson. Överallt ligger osynliga bomber — trampar du på en får du en mattefråga.</p></div>' +

      '<div class="card">' +
        '<h3>🕹️ Så funkar det</h3>' +
        '<p class="sub">1. Gå runt med spaken (eller WASD). Kameran vrids genom att dra på höger sida.<br>' +
        '2. Trampar du på en osynlig bomb startar frågan direkt — och klockan tickar.<br>' +
        '3. Svarar du rätt får du sikta och kasta bomben på någon annan.<br>' +
        '4. Smäller den i dina händer förlorar du ett liv. Sist kvar vinner rundan.</p>' +
      '</div>' +

      '<div class="card">' +
        '<h3>⚙️ Runda</h3>' +
        '<div class="sub" style="margin-bottom:6px">Svårighet</div>' +
        '<div class="seg" id="a-diff">' + M.DIFFS.map(function (d) {
          return '<button data-d="' + d.id + '" class="' + (cfg.diff === d.id ? 'on' : '') + '">' + d.name + '</button>';
        }).join('') + '</div>' +
        '<div class="sub" style="margin:12px 0 6px">Motståndare i arenan</div>' +
        '<div class="seg" id="a-bots">' + [1, 2, 3, 4, 5].map(function (n) {
          return '<button data-b="' + n + '" class="' + (cfg.bots === n ? 'on' : '') + '">' + n + '</button>';
        }).join('') + '</div>' +
        '<label class="field" style="margin-top:12px"><span>Frågekategori</span><select id="a-cat">' +
          '<option value="mix">🎲 Blandat</option>' +
          M.CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + (cfg.cat === c.id ? ' selected' : '') + '>' + c.icon + ' ' + c.name + '</option>'; }).join('') +
        '</select></label>' +
        '<button class="btn block mt" id="a-start">▶ Gå in i arenan</button>' +
      '</div>' +

      '<div class="card lock-card">' +
        (M.arcadeUnlocked()
          ? '<span class="big">🕹️</span><b>Arcade Mode är upplåst</b>' +
            '<p class="sub" style="margin-top:4px">Du levde sist ' + s.arena3dWins + ' gånger. Hela 2D-spelet finns i Arcade-fliken.</p>'
          : '<span class="big">🔒</span><b>Arcade Mode är låst</b>' +
            '<p class="sub" style="margin-top:4px">Lev sist i ' + M.ARCADE_REQUIRED + ' rundor för att låsa upp lobbies, blixt, duell, överlevnad, träning och dagens utmaning.</p>' +
            keysRow(s.arena3dWins) +
            '<p class="sub">' + s.arena3dWins + ' av ' + M.ARCADE_REQUIRED + ' — ' + left + ' kvar</p>') +
      '</div>' +

      '<div class="grid grid-3">' +
        tile(s.arena3dWins, 'Sist kvar') + tile(s.arena3dGames, 'Rundor') + tile(s.minesStepped, 'Bomber trampade') +
      '</div>';

    $$('#a-diff button').forEach(function (b) { b.onclick = function () { cfg.diff = +b.dataset.d; ui.renderArena(); }; });
    $$('#a-bots button').forEach(function (b) { b.onclick = function () { cfg.bots = +b.dataset.b; ui.renderArena(); }; });
    $('#a-cat').onchange = function () { cfg.cat = this.value; };
    $('#a-start').onclick = startRound;
  };

  function tile(num, lbl) {
    return '<div class="stat-tile"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }

  function keysRow(n) {
    var out = '<div class="keys">';
    for (var i = 0; i < M.ARCADE_REQUIRED; i++) out += '<i class="' + (i < n ? 'on' : '') + '">' + (i < n ? '🔑' : '·') + '</i>';
    return out + '</div>';
  }

  /* ---------- Scenen ------------------------------------------------------- */

  function buildStage() {
    if (stage) return;
    stage = document.createElement('div');
    stage.className = 'arena-stage';
    stage.id = 'arena-stage';
    stage.innerHTML =
      '<canvas id="arena-canvas"></canvas>' +
      '<div class="a-flash" id="a-flash"></div>' +
      '<div class="a-danger" id="a-danger"></div>' +
      '<div class="a-hud">' +
        '<div class="a-top">' +
          '<div class="a-pill" id="a-lives">❤️❤️</div>' +
          '<div class="a-pill a-timer" id="a-timer" style="display:none"><span id="a-tlabel">Bomb</span>' +
            '<div class="bar"><i id="a-tbar"></i></div></div>' +
        '</div>' +
        '<canvas id="arena-map" width="192" height="192"></canvas>' +
        '<div class="a-detector"><span id="a-detlabel">MINSÖKARE</span><div class="bar"><i id="a-detbar"></i></div></div>' +
        '<div class="a-cross" id="a-cross"></div>' +
        '<div class="a-feed" id="a-feed"></div>' +
        '<div class="a-look" id="a-look"></div>' +
        '<div class="a-stick" id="a-stick"><i id="a-knob"></i></div>' +
        '<div class="a-hint">Dra här för att se dig omkring</div>' +
        '<div class="a-btns" id="a-btns">' +
          '<button class="a-exit" id="a-exit">✕ Lämna</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(stage);

    mapCtx = $('#arena-map').getContext('2d');
    $('#a-exit').onclick = quitRound;
    bindControls();
  }

  function startRound() {
    buildStage();
    stage.classList.add('on');
    var cv = $('#arena-canvas');
    if (glOk === null) glOk = A.init(cv);
    if (!glOk) {
      stage.classList.remove('on');
      M.forceArcade();
      ui.modal('<h3>3D fungerar inte här</h3><p class="sub">Den här enheten saknar WebGL, så Minfältet kan inte köras. ' +
        'Arcade Mode har låsts upp åt dig i stället.</p><button class="btn block mt" data-x="ok">Okej</button>', function (box) {
          $$('[data-x]', box).forEach(function (b) { b.onclick = function () { ui.closeModal(); ui.show('arcade'); }; });
        });
      return;
    }

    A.resize();
    A.start({ diff: cfg.diff, cat: cfg.cat, bots: cfg.bots });
    A.onQuestion = renderQuestion;
    A.onPhase = renderPhase;
    A.onFeed = renderFeed;
    A.onFrame = onFrame;
    A.onOver = renderOver;
    renderPhase();
    renderFeed();
    A.loop();
    ui.toast('🕳️', 'Se upp var du går', 'Bomberna är osynliga.', 2600);
  }

  ui.leaveArena = function () { quitRound(); };

  function quitRound() {
    A.quit();
    A.onQuestion = A.onPhase = A.onFeed = A.onFrame = A.onOver = null;
    if (stage) {
      stage.classList.remove('on');
      var q = $('#a-q'); if (q) q.remove();
      var o = $('#a-over'); if (o) o.remove();
    }
    ui.renderArena();
    ui.refreshChips();
  }

  /* ---------- HUD per bildruta --------------------------------------------- */

  function onFrame() {
    var S = A.state();
    if (!S) return;
    var me = A.you();

    $('#a-lives').textContent = me.alive ? '❤️'.repeat(Math.max(0, me.lives)) : '☠️';

    var tm = $('#a-timer');
    if (S.bomb && !S.bomb.fly) {
      tm.style.display = '';
      var pct = Math.max(0, Math.min(100, S.bomb.t / S.bomb.max * 100));
      $('#a-tbar').style.width = pct + '%';
      tm.classList.toggle('hot', S.bomb.t < S.bomb.max * 0.35);
      $('#a-tlabel').textContent = (S.bomb.holder.you ? 'Din bomb' : S.bomb.holder.name + 's bomb') + ' · ' + S.bomb.t.toFixed(1) + ' s';
    } else {
      tm.style.display = 'none';
    }

    var prox = A.mineProximity();
    $('#a-detbar').style.width = Math.round(prox * 100) + '%';
    $('#a-detlabel').textContent = prox > 0.75 ? '⚠️ PRECIS DÄR' : prox > 0.3 ? '⚠️ NÄRA' : 'MINSÖKARE';

    var cross = $('#a-cross');
    var aim = S.phase === 'throw' ? A.aimTarget() : null;
    cross.classList.toggle('lock', !!aim);

    $('#a-flash').style.opacity = S.flash * 0.6;
    $('#a-danger').classList.toggle('on', !!(S.bomb && !S.bomb.fly && S.bomb.holder.you));

    drawMap(S, me);
    if (S.phase === 'throw') updateThrowChips(aim);
  }

  function drawMap(S, me) {
    var c = mapCtx, n = 192, R = 13;
    c.clearRect(0, 0, n, n);
    var sc = n / (R * 2 + 2);
    var toX = function (x) { return n / 2 + x * sc; };
    var toY = function (z) { return n / 2 + z * sc; };

    c.strokeStyle = 'rgba(255,255,255,.22)';
    c.lineWidth = 2;
    c.strokeRect(toX(-R), toY(-R), R * 2 * sc, R * 2 * sc);

    c.fillStyle = 'rgba(0,229,200,.22)';
    (A.pillars ? A.pillars() : []).forEach(function (p) {
      c.fillRect(toX(p.x - p.w / 2), toY(p.z - p.d / 2), p.w * sc, p.d * sc);
    });

    S.players.forEach(function (p) {
      if (!p.alive || p.you) return;
      var holder = S.bomb && S.bomb.holder === p;
      c.fillStyle = holder ? '#ff4d6d' : p.color;
      c.beginPath();
      c.arc(toX(p.x), toY(p.z), holder ? 7 : 5, 0, 6.3);
      c.fill();
    });

    // Du, som en riktad triangel
    c.save();
    c.translate(toX(me.x), toY(me.z));
    c.rotate(me.yaw);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* ---------- Fråga, kastläge, flöde -------------------------------------- */

  function renderQuestion() {
    var S = A.state();
    if (!S || !S.q) return;
    var box = $('#a-q');
    if (!box) {
      box = document.createElement('div');
      box.className = 'a-q';
      box.id = 'a-q';
      $('.a-hud', stage).appendChild(box);
    }
    box.innerHTML =
      '<div class="q-cat">' + M.catName(S.q.cat) + ' · du står på en bomb</div>' +
      '<div class="q-text">' + esc(S.q.text) + ' = ?</div>' +
      '<div class="q-streak">' + (S.m.streak >= 2 ? '🔥 ' + S.m.streak + ' i rad' : 'Svara rätt för att kunna kasta') + '</div>' +
      '<div class="opts" id="a-opts">' + S.q.options.map(function (o, i) {
        return '<button class="opt" data-aopt="' + i + '">' + esc(o) + '</button>';
      }).join('') + '</div>';

    $$('[data-aopt]', box).forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.aopt;
        var correct = S.q.correct;
        $$('[data-aopt]', box).forEach(function (x, xi) {
          x.disabled = true;
          if (xi === correct) x.classList.add('right');
          else if (xi === i) x.classList.add('wrong');
        });
        A.answer(i);
      };
    });
  }

  function renderPhase() {
    var S = A.state();
    if (!S) return;
    var q = $('#a-q');
    if (S.phase !== 'answer' && q) q.remove();
    var chips = $('#a-chips');
    if (S.phase !== 'throw' && chips) chips.remove();
    if (S.phase === 'throw') buildThrowChips();
  }

  function buildThrowChips() {
    var S = A.state();
    if ($('#a-chips')) return;
    var wrap = document.createElement('div');
    wrap.id = 'a-chips';
    wrap.innerHTML =
      '<div class="a-chips">' + S.players.filter(function (p) { return p.alive && !p.you; }).map(function (p) {
        return '<button class="a-chip" data-tid="' + p.id + '">' + p.av + ' ' + esc(p.name) + '</button>';
      }).join('') + '</div>' +
      '<button class="a-throw" id="a-throwbtn">🎯 KASTA</button>';
    $('#a-btns').insertBefore(wrap, $('#a-exit'));
    $$('[data-tid]', wrap).forEach(function (b) {
      b.onclick = function () { A.throwAt(b.dataset.tid); };
    });
    $('#a-throwbtn').onclick = function () { A.throwAt(null); };
  }

  function updateThrowChips(aim) {
    $$('#a-chips [data-tid]').forEach(function (b) {
      b.classList.toggle('aim', !!aim && aim.id === b.dataset.tid);
    });
  }

  function renderFeed() {
    var S = A.state();
    if (!S || !$('#a-feed')) return;
    $('#a-feed').innerHTML = S.feed.slice(0, 4).map(function (f) { return '<div>' + esc(f) + '</div>'; }).join('');
  }

  function renderOver(res) {
    var S = A.state();
    var wrap = document.createElement('div');
    wrap.className = 'a-over';
    wrap.id = 'a-over';
    wrap.innerHTML =
      '<div class="box">' +
        '<div style="font-size:46px">' + (res.win ? '🏁' : '☠️') + '</div>' +
        '<h2 style="font-size:22px;margin:6px 0 4px">' + (res.win ? 'Du levde sist!' : 'Du sprängdes') + '</h2>' +
        '<p class="sub">' + S.m.correct + ' rätt · ' + S.m.mines + ' bomber trampade · ' + S.m.throws + ' kast</p>' +
        '<div class="row mt" style="justify-content:center;gap:14px;font-weight:800">' +
          '<span style="color:var(--warn)">🪙 +' + res.coins + '</span>' +
          '<span style="color:var(--brand-2)">✨ +' + res.xp + ' XP</span>' +
        '</div>' +
        (res.unlocked
          ? '<div class="card mt" style="margin-bottom:0;text-align:center"><h3 style="justify-content:center">🗝️ Arcade Mode upplåst!</h3>' +
            '<p class="sub">Fem rundor som sist kvar. Lobbies, blixt, duell, överlevnad, träning och dagens utmaning är öppna nu.</p></div>'
          : (!M.arcadeUnlocked()
              ? '<p class="sub mt">' + M.profile.stats.arena3dWins + '/' + M.ARCADE_REQUIRED + ' rundor mot Arcade Mode' + keysRow(M.profile.stats.arena3dWins) + '</p>'
              : '')) +
        '<div class="row mt" style="gap:8px">' +
          '<button class="btn ghost" data-a="out">← Ut</button>' +
          '<button class="btn" style="flex:1" data-a="again">🔁 Ny runda</button>' +
        '</div>' +
      '</div>';
    $('.a-hud', stage).appendChild(wrap);

    if (res.win) { ui.sfx.win(); ui.confetti(80); }
    if (res.fresh.length) setTimeout(function () { ui.achToast(res.fresh); }, 600);
    if (res.unlocked) {
      ui.toast('🗝️', 'Arcade Mode upplåst!', 'Hela 2D-spelet är ditt.', 4200);
      ui.confetti(60);
    }
    ui.refreshChips();

    $$('[data-a]', wrap).forEach(function (b) {
      b.onclick = function () {
        var again = b.dataset.a === 'again';
        wrap.remove();
        A.quit();
        if (again) startRound();
        else quitRound();
      };
    });
  }

  /* ---------- Styrning ----------------------------------------------------- */

  function bindControls() {
    var stick = $('#a-stick'), knob = $('#a-knob'), look = $('#a-look');

    function stickSet(t) {
      var r = stick.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1) { dx /= len; dy /= len; }
      A.input.fx = dx;
      A.input.fz = -dy;
      knob.style.transform = 'translate(' + (dx * 34) + 'px,' + (dy * 34) + 'px)';
    }

    function stickEnd() {
      stickDrag = null;
      A.input.fx = A.input.fz = 0;
      knob.style.transform = '';
    }

    stick.addEventListener('touchstart', function (e) {
      e.preventDefault();
      stickDrag = e.changedTouches[0].identifier;
      stickSet(e.changedTouches[0]);
    }, { passive: false });

    stick.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === stickDrag) stickSet(e.changedTouches[i]);
      }
      e.preventDefault();
    }, { passive: false });

    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);

    stick.addEventListener('mousedown', function (e) { stickDrag = 'mouse'; stickSet(e); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) {
      if (stickDrag === 'mouse') stickSet(e);
      if (lookDrag === 'mouse') { lookMove(e.clientX, e.clientY); }
    });
    window.addEventListener('mouseup', function () {
      if (stickDrag === 'mouse') stickEnd();
      lookDrag = null;
    });

    var lastLook = null;
    function lookMove(x, y) {
      if (lastLook) {
        var me = A.you();
        if (me) {
          me.yaw += (x - lastLook.x) * 0.006;
          me.pitch = Math.max(-0.55, Math.min(0.55, me.pitch - (y - lastLook.y) * 0.004));
        }
      }
      lastLook = { x: x, y: y };
    }

    look.addEventListener('touchstart', function (e) {
      e.preventDefault();
      lookDrag = e.changedTouches[0].identifier;
      lastLook = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }, { passive: false });

    look.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookDrag) {
          lookMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
      }
      e.preventDefault();
    }, { passive: false });

    look.addEventListener('touchend', function () { lookDrag = null; lastLook = null; });
    look.addEventListener('mousedown', function (e) { lookDrag = 'mouse'; lastLook = { x: e.clientX, y: e.clientY }; e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      if (!A.state()) return;
      keys[e.key.toLowerCase()] = true;
      applyKeys();
      var S = A.state();
      if (S.phase === 'answer' && /^[1-4]$/.test(e.key)) {
        var btn = $('#a-opts .opt:nth-child(' + e.key + ')');
        if (btn && !btn.disabled) btn.click();
      }
      if (S.phase === 'throw' && (e.key === ' ' || e.key === 'Enter')) A.throwAt(null);
    });

    window.addEventListener('keyup', function (e) {
      keys[e.key.toLowerCase()] = false;
      applyKeys();
    });

    window.addEventListener('resize', function () { if (A.state()) A.resize(); });
  }

  function applyKeys() {
    var f = 0, s = 0;
    if (keys.w || keys.arrowup) f += 1;
    if (keys.s || keys.arrowdown) f -= 1;
    if (keys.a) s -= 1;
    if (keys.d) s += 1;
    A.input.fz = f;
    A.input.fx = s;
    A.input.look = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0);
  }

  /* Exponera pelarna till minikartan */
  A.pillars = A.pillars || function () { return []; };

})(window.MATTENITE = window.MATTENITE || {});
