/* ui.js — the DOM overlay, and the boot sequence.

   The overlay is the flat-screen interface. Inside an immersive VR session it
   is not visible at all, so everything it does is mirrored by in-world panels
   driven from game.js. */
(function (global) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const A = global.AJAudio;
  const Account = global.AJAccount;

  const SCREENS = ['menu', 'queue', 'trial', 'deliberating', 'morphchoice', 'verdict'];

  function show(id) {
    for (const s of SCREENS) {
      const el = $(s);
      if (el) el.classList.toggle('hidden', s !== id);
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function UI() {
    this.game = null;
    this.vrOk = false;
    this.inVR = false;
    this.lastPhase = 'menu';
  }

  UI.prototype.toast = function (msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .35s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 380);
    }, ms || 3400);
  };

  UI.prototype.getDraft = function () { return $('argument').value; };

  /* ---------------- status chrome ---------------- */

  UI.prototype.refreshChrome = function () {
    const a = Account.get();
    const vip = !!a.vip;
    $('pillVip').classList.toggle('hidden', !vip);
    $('pillModel').textContent = vip ? global.AJJudge.MODELS.vip : global.AJJudge.MODELS.free;
    const morphs = Account.morphsLeft();
    const pm = $('pillMorph');
    pm.classList.toggle('hidden', !vip);
    pm.textContent = morphs + ' morph' + (morphs === 1 ? '' : 's') + ' left';
    $('btnVip').textContent = vip ? 'VIP active' : 'VIP · $' + Account.PRICE_USD;
    $('factWins').textContent = a.wins;
    $('factRank').textContent = Account.rank();
    $('factStreak').textContent = a.bestStreak;
    const canMorph = vip && morphs > 0;
    $('btnMorph').classList.toggle('hidden', !canMorph);
  };

  UI.prototype.setStatus = function (s) {
    const p = $('pillNet');
    if (s.connected) {
      p.className = 'pill live';
      p.textContent = (s.mode === 'offline' ? 'practice hall' : 'in the hall') +
        (s.online ? ' · ' + s.online : '');
    } else {
      p.className = 'pill off';
      p.textContent = 'connecting…';
    }
  };

  UI.prototype.setMorphs = function () { this.refreshChrome(); };
  UI.prototype.setVRAvailable = function (ok) {
    this.vrOk = ok;
    $('btnVR').classList.toggle('hidden', !ok);
  };
  UI.prototype.setVR = function (on) {
    this.inVR = on;
    if (on) this.toast('Point at a card and press to choose.');
  };

  /* ---------------- phases ---------------- */

  UI.prototype.setPhase = function (phase, game) {
    this.lastPhase = phase;
    /* Away from the menu the overlay drops to the bottom of the screen so the
       hall — and the robot in it — stays visible. */
    document.body.classList.toggle('in-hall', phase !== 'menu');
    switch (phase) {
      case 'menu': show('menu'); this.refreshChrome(); break;
      case 'queue': show('queue'); break;
      case 'trial':
        show('trial');
        $('argument').value = '';
        $('argument').disabled = false;
        $('btnSubmit').disabled = false;
        $('btnSubmit').textContent = 'Rest your case';
        $('chars').textContent = '0 / 600';
        $('oppDot').classList.remove('done');
        this.refreshChrome();
        if (!this.inVR) setTimeout(() => $('argument').focus(), 60);
        else game.showStanceCards(true);
        break;
      case 'deliberation':
        show('deliberating');
        game.showStanceCards(false);
        break;
      case 'morph': show('morphchoice'); break;
      case 'verdict': show('verdict'); $('verdictActions').classList.add('hidden'); break;
      case 'shot': break;
      case 'aftermath': show('verdict'); $('verdictActions').classList.remove('hidden'); break;
    }
  };

  UI.prototype.setQueue = function (q) {
    $('queuePos').textContent = q.pos <= 0 ? 'NEXT' : '#' + (q.pos + 1);
    $('queueSub').textContent = q.pos <= 0
      ? 'You are beside the drum. Stand still.'
      : q.pos + ' ' + (q.pos === 1 ? 'person' : 'people') + ' ahead of you';

    const line = $('queueLine');
    line.innerHTML = '';
    const drum = document.createElement('div');
    drum.className = 'who drum';
    drum.title = 'the AI drum robot';
    line.appendChild(drum);
    const ahead = Math.min(q.pos, 12);
    for (let k = 0; k < ahead; k++) {
      const d = document.createElement('div');
      d.className = 'who';
      line.appendChild(d);
    }
    const me = document.createElement('div');
    me.className = 'who me';
    me.title = 'you';
    line.appendChild(me);
  };

  UI.prototype.setCase = function (m, game) {
    const s = m.scene;
    $('caseTitle').textContent = s.t;
    $('caseSide').textContent = 'side ' + m.side;
    $('caseBrief').textContent = s.s;
    $('caseStance').textContent = m.side === 'A' ? s.a : s.b;
    $('oppLine').innerHTML = 'Against <b>' + esc(m.opponent.name) + '</b>' +
      (m.opponent.vip ? ' <span class="pill vip">VIP</span>' : '');
    this.setTimer(m.seconds || 45);
    void game;
  };

  UI.prototype.setTimer = function (secs) {
    const c = $('clock');
    const n = Math.ceil(secs);
    if (c.textContent !== String(n)) c.textContent = n;
    c.classList.toggle('urgent', n <= 10);
  };

  UI.prototype.setSubmitted = function (done) {
    $('argument').disabled = done;
    $('btnSubmit').disabled = done;
    if (done) $('btnSubmit').textContent = 'Case rested';
  };

  UI.prototype.setMorphChoice = function (m, game) {
    const wrap = $('morphCards');
    wrap.innerHTML = '';
    const sides = [
      { side: 'A', name: m.nameA, pos: m.scene.a, arg: m.argA },
      { side: 'B', name: m.nameB, pos: m.scene.b, arg: m.argB }
    ];
    for (const d of sides) {
      const el = document.createElement('div');
      el.className = 'mcard';
      el.innerHTML =
        '<div class="who">' + esc(d.name) + '</div>' +
        '<div class="pos">' + esc(d.pos) + '</div>' +
        '<div class="said">“' + esc(d.arg || 'said nothing at all') + '”</div>';
      el.addEventListener('click', () => {
        A.gavel();
        game.chooseWinner(d.side);
      });
      wrap.appendChild(el);
    }
  };

  UI.prototype.setVerdict = function (m, iWon, game) {
    const v = m.verdict;
    $('outcome').textContent = 'The bench rules…';
    $('outcome').className = 'outcome';
    $('rulingText').textContent = '“' + v.ruling + '”';

    const row = $('scoreRow');
    const cell = (name, score, note, win) =>
      '<div class="side' + (win ? ' win' : '') + '">' +
      '<div class="nm">' + esc(name) + '</div>' +
      '<div class="sc">' + score + '</div>' +
      (note ? '<div class="note">' + esc(note) + '</div>' : '') + '</div>';
    row.innerHTML =
      cell(m.nameA, v.scoreA, v.noteA, v.winner === 'A') +
      '<div class="vs">v</div>' +
      cell(m.nameB, v.scoreB, v.noteB, v.winner === 'B');

    let by = 'judged by ' + v.model;
    if (v.source === 'local') by += ' · the hall\'s own bench, no model reached';
    if (v.source === 'morph') by = 'ruled by a drum morph — a player took the bench';
    $('verdictByline').textContent = by;
    if (v.fallbackReason) console.warn('[judge] fell back:', v.fallbackReason);
    void game; void iWon;
  };

  UI.prototype.setAftermath = function (m, iWon, game) {
    const o = $('outcome');
    if (iWon === null || iWon === undefined) {
      o.textContent = 'Dismissed';
      o.className = 'outcome';
    } else if (iWon) {
      o.textContent = 'You walked out';
      o.className = 'outcome win';
    } else {
      o.textContent = 'You got shot';
      o.className = 'outcome lose';
    }
    this.refreshChrome();
    void m; void game;
  };

  /* ---------------- boot ---------------- */

  function boot() {
    const ui = new UI();
    let game;
    try {
      game = new global.AJGame.Game($('stage'), ui);
    } catch (e) {
      document.body.innerHTML =
        '<div style="padding:40px;font-family:Georgia,serif;color:#efe3cb;max-width:640px;margin:0 auto">' +
        '<h1>The hall could not open</h1><p style="margin-top:12px;line-height:1.6">' +
        esc(e.message) + '</p><p style="margin-top:12px;color:#8d7a5f">AI Judge needs WebGL2. ' +
        'Try a current Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.</p></div>';
      console.error(e);
      return;
    }
    ui.game = game;
    global.AIJUDGE = { game, ui };

    const a = Account.get();
    ui.refreshChrome();
    ui.setStatus({ connected: false, mode: 'offline', online: 0 });
    game.setPhase('menu');

    /* ---- menu ---- */
    $('btnPlay').addEventListener('click', () => { A.unlock(); game.play(); });
    $('btnLeave').addEventListener('click', () => game.leave());
    $('btnQuit').addEventListener('click', () => game.leave());
    $('btnAgain').addEventListener('click', () => game.again());

    /* ---- trial ---- */
    const arg = $('argument');
    arg.addEventListener('input', () => {
      $('chars').textContent = arg.value.length + ' / 600';
    });
    arg.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); game.submit(arg.value); }
    });
    $('btnSubmit').addEventListener('click', () => game.submit(arg.value));
    $('btnMorph').addEventListener('click', () => {
      if (game.morph()) $('btnMorph').classList.add('hidden');
    });

    /* ---- VR ---- */
    $('btnVR').classList.add('hidden');
    $('btnVR').addEventListener('click', () => {
      game.enterVR().catch(e => ui.toast('VR refused: ' + e.message));
    });

    /* ---- sound ---- */
    let muted = false;
    $('btnSound').addEventListener('click', () => {
      muted = !muted;
      A.setMuted(muted);
      $('btnSound').textContent = muted ? '🔇' : '🔊';
    });

    /* ---- settings ---- */
    const openSettings = () => {
      const acct = Account.get();
      $('setName').value = acct.name;
      $('setServer').value = acct.server || '';
      $('setKey').value = acct.apiKey || '';
      $('settingsModal').classList.remove('hidden');
    };
    $('btnSettings').addEventListener('click', openSettings);
    $('btnSettingsClose').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
    $('btnSettingsSave').addEventListener('click', () => {
      Account.setName($('setName').value);
      Account.set({ server: $('setServer').value.trim(), apiKey: $('setKey').value.trim() });
      $('settingsModal').classList.add('hidden');
      ui.refreshChrome();
      ui.toast('Saved. Reconnecting to the hall.');
      if (game.phase !== 'menu') game.leave();
      game.connect();
    });

    /* ---- VIP ---- */
    $('btnVip').addEventListener('click', () => $('vipModal').classList.remove('hidden'));
    $('btnVipClose').addEventListener('click', () => $('vipModal').classList.add('hidden'));
    $('btnVipRedeem').addEventListener('click', async () => {
      const btn = $('btnVipRedeem');
      btn.disabled = true;
      try {
        await Account.redeem($('vipCode').value);
        ui.refreshChrome();
        $('vipModal').classList.add('hidden');
        ui.toast('VIP active. ' + Account.MORPHS_PER_DAY + ' drum morphs a day, and the larger model on the bench.');
        A.crash();
      } catch (e) {
        ui.toast(e.message);
      } finally {
        btn.disabled = false;
      }
    });

    for (const id of ['settingsModal', 'vipModal']) {
      $(id).addEventListener('click', (e) => {
        if (e.target.id === id) $(id).classList.add('hidden');
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $('settingsModal').classList.add('hidden');
      $('vipModal').classList.add('hidden');
    });

    /* Flat-screen pointer picking, so the in-world cards work with a mouse too. */
    $('stage').addEventListener('pointerdown', (e) => {
      if (game.xr.session) return;
      const r = $('stage').getBoundingClientRect();
      const ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ndcY = 1 - ((e.clientY - r.top) / r.height) * 2;
      const eye = game.renderer.eye, tgt = game.renderer.target;
      const fwd = [tgt[0]-eye[0], tgt[1]-eye[1], tgt[2]-eye[2]];
      const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
      fwd[0]/=fl; fwd[1]/=fl; fwd[2]/=fl;
      let right = [fwd[2], 0, -fwd[0]];
      const rl = Math.hypot(right[0], right[2]) || 1;
      right = [right[0]/rl, 0, right[2]/rl];
      const up = [
        right[1]*fwd[2]-right[2]*fwd[1],
        right[2]*fwd[0]-right[0]*fwd[2],
        right[0]*fwd[1]-right[1]*fwd[0]
      ];
      const aspect = r.width / Math.max(1, r.height);
      const th = Math.tan(1.05 / 2);
      const dir = [
        fwd[0] + right[0]*ndcX*th*aspect + up[0]*ndcY*th,
        fwd[1] + right[1]*ndcX*th*aspect + up[1]*ndcY*th,
        fwd[2] + right[2]*ndcX*th*aspect + up[2]*ndcY*th
      ];
      const hit = game.xr.pick(eye, dir);
      if (hit) game.onPick(hit);
    });

    if (a.vip) ui.toast('Welcome back. ' + Account.morphsLeft() + ' drum morphs left today.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.AJUI = { UI };
})(typeof window !== 'undefined' ? window : globalThis);
