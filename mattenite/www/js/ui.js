/* ==========================================================================
   ui.js — navigering, vyer, ljud, toasts, butik, lobbylistan
   ========================================================================== */
(function (M) {
  'use strict';

  var ui = {};
  M.ui = ui;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  ui.$ = $; ui.$$ = $$;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  ui.esc = esc;

  /* ---------- Ljud & vibration --------------------------------------------- */

  var actx = null;
  function audio() {
    if (!M.profile.settings.sound) return null;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }

  function tone(freq, dur, type, vol, delay) {
    var ctx = audio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  ui.sfx = {
    right: function () { tone(660, .1, 'triangle'); tone(990, .16, 'triangle', .14, .07); },
    wrong: function () { tone(180, .22, 'sawtooth', .12); },
    throwIt: function () { tone(520, .07, 'square', .1); tone(300, .1, 'square', .09, .06); },
    tick: function () { tone(1200, .03, 'square', .05); },
    boom: function () { tone(90, .45, 'sawtooth', .2); tone(60, .5, 'square', .14, .04); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .22, 'triangle', .15, i * .11); }); },
    lose: function () { [400, 330, 260, 190].forEach(function (f, i) { tone(f, .2, 'sine', .13, i * .1); }); },
    unlock: function () { [784, 988, 1319].forEach(function (f, i) { tone(f, .2, 'sine', .13, i * .09); }); },
    coin: function () { tone(1050, .07, 'square', .09); tone(1400, .09, 'square', .08, .05); }
  };

  ui.buzz = function (ms) {
    if (!M.profile.settings.vibrate) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms || 30); } catch (e) {} }
  };

  /* ---------- Toasts, modal, konfetti -------------------------------------- */

  ui.toast = function (icon, title, sub, ms) {
    var wrap = $('#toasts');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="ic">' + icon + '</span><div><div>' + esc(title) + '</div>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(function () { el.remove(); }, 320);
    }, ms || 2600);
  };

  ui.achToast = function (list) {
    list.forEach(function (a, i) {
      setTimeout(function () {
        ui.sfx.unlock();
        ui.buzz([25, 40, 25]);
        ui.toast(a.i, 'Prestation upplåst: ' + a.n, a.d + '  +' + a.c + ' mynt', 3400);
        ui.refreshChips();
        ui.markAchDot(true);
      }, i * 700);
    });
  };

  ui.modal = function (html, onOpen) {
    var box = $('#modal-box');
    box.innerHTML = html;
    $('#modal').classList.add('open');
    if (onOpen) onOpen(box);
  };
  ui.closeModal = function () { $('#modal').classList.remove('open'); };

  ui.confetti = function (n) {
    if (!M.profile.settings.anim) return;
    var wrap = $('#confetti');
    var colors = ['#7c5cff', '#00e5c8', '#ffc73a', '#ff4d6d', '#3ddc84'];
    for (var i = 0; i < (n || 60); i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.top = '-20px';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = (1.1 + Math.random() * 1.3) + 's';
      p.style.animationDelay = (Math.random() * .4) + 's';
      wrap.appendChild(p);
      (function (el) { setTimeout(function () { el.remove(); }, 3000); })(p);
    }
  };

  ui.coinFlash = function () { ui.sfx.coin(); ui.refreshChips(); };

  /* ---------- Navigering ---------------------------------------------------- */

  ui.current = 'home';

  ui.show = function (name) {
    if (M.game && M.game.running && name !== 'game') {
      if (!confirm('Lämna matchen?')) return;
      M.game.abort();
    }
    ui.current = name;
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    $$('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); });
    document.querySelector('main').scrollTop = 0;
    if (name === 'home') ui.renderHome();
    if (name === 'lobbies') ui.renderLobbies();
    if (name === 'play') ui.renderPlay();
    if (name === 'ach') { ui.renderAch(); ui.markAchDot(false); }
    if (name === 'profile') ui.renderProfile();
    ui.refreshChips();
  };

  ui.markAchDot = function (on) { $('#ach-dot').classList.toggle('show', !!on); };

  ui.refreshChips = function () {
    var p = M.profile;
    $('#chip-coins').textContent = '🪙 ' + p.coins;
    $('#chip-level').textContent = '⭐ Nivå ' + p.level;
    document.body.dataset.theme = p.theme;
    document.body.classList.toggle('no-anim', !p.settings.anim);
  };

  /* ---------- Hem ----------------------------------------------------------- */

  ui.renderHome = function () {
    var p = M.profile, s = p.stats;
    var need = M.xpForLevel(p.level);
    var pct = Math.min(100, Math.round(p.xp / need * 100));
    var dailyDone = M.dailyDoneToday();

    $('#view-home').innerHTML =
      '<div class="hero">' +
        '<span class="bomb-deco">' + p.bomb + '</span>' +
        '<h2>Hej ' + esc(p.name) + ' ' + p.avatar + '</h2>' +
        '<p>Svara rätt. Kasta bomben vidare. Var inte den som håller i den när den smäller.</p>' +
        '<div class="row" style="gap:8px"><b style="font-size:13px">Nivå ' + p.level + '</b>' +
          '<span class="sub" style="margin-left:auto">' + p.xp + ' / ' + need + ' XP</span></div>' +
        '<div class="xpbar mt" style="margin-top:6px"><i style="width:' + pct + '%"></i></div>' +
        '<div class="row mt" style="gap:8px">' +
          '<button class="btn" data-act="quick">💣 Snabbmatch</button>' +
          '<button class="btn ghost" data-act="lobbies">🚪 Lobbies</button>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="' + (dailyDone ? 'opacity:.85' : '') + '">' +
        '<h3>📅 Dagens utmaning</h3>' +
        '<p class="sub">10 frågor, samma för alla i hela världen. Svit: ' + p.daily.streak + ' dagar 🔥</p>' +
        (dailyDone
          ? '<div class="row mt between"><b>Klart idag — ' + p.daily.score + '/10</b><button class="btn ghost small" data-act="daily">Spela igen</button></div>'
          : '<button class="btn block mt" data-act="daily">Starta dagens utmaning</button>') +
      '</div>' +

      '<div class="grid grid-3">' +
        tile(s.wins, 'Segrar') + tile(s.gamesPlayed, 'Matcher') + tile(M.accuracy() + '%', 'Träffsäkerhet') +
        tile(s.bestStreak, 'Bästa svit') + tile(M.unlockedCount() + '/' + M.ACHIEVEMENTS.length, 'Prestationer') + tile(s.correct, 'Rätta svar') +
      '</div>' +

      '<div class="card mt"><h3>🕘 Senaste matcherna</h3>' +
        (p.history.length
          ? p.history.slice(0, 6).map(function (h) {
              return '<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">' +
                '<span>' + (M.MODES[h.mode] ? M.MODES[h.mode].icon + ' ' + M.MODES[h.mode].name : h.mode) + '</span>' +
                '<span style="color:' + (h.win ? 'var(--ok)' : 'var(--muted)') + ';font-weight:700">' + esc(h.result) + '</span></div>';
            }).join('')
          : '<div class="empty"><span class="big">🫥</span>Inga matcher än. Kör en snabbmatch!</div>') +
      '</div>';

    $$('#view-home [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'quick') M.game.start({ mode: 'potato', diff: 2, cat: 'mix', bots: 3, lobbyName: 'Snabbmatch' });
        if (a === 'lobbies') ui.show('lobbies');
        if (a === 'daily') M.game.start({ mode: 'daily', diff: 2, cat: 'mix', bots: 0, lobbyName: 'Dagens utmaning' });
      };
    });
  };

  function tile(num, lbl) {
    return '<div class="stat-tile"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }

  /* ---------- Lobbies ------------------------------------------------------- */

  var lobbies = [];
  var currentLobby = null;
  ui.getLobby = function () { return currentLobby; };

  function makeCode() {
    var s = '', c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  function buildLobbies() {
    lobbies = M.LOBBY_TEMPLATES.map(function (t, i) {
      var players = M.rnd(1, t.max - 1);
      return {
        id: 'lb' + i, name: t.name, flag: t.flag, diff: t.diff, cat: t.cat,
        mode: t.mode, max: t.max, players: players, code: makeCode(),
        host: M.pick(M.BOT_NAMES), ping: M.rnd(12, 90), live: Math.random() < .35
      };
    });
  }
  buildLobbies();

  ui.renderLobbies = function () {
    if (currentLobby) return ui.renderRoom();
    var filter = ui.lobbyFilter || 'alla';
    var list = lobbies.filter(function (l) {
      if (filter === 'alla') return true;
      if (filter === 'ledig') return l.players < l.max;
      return String(l.diff) === filter;
    });

    $('#view-lobbies').innerHTML =
      '<div class="view-head"><h2>Lobbies</h2><p>Välj en lobby och tryck för att gå med. Bomben väntar inte.</p></div>' +
      '<div class="row" style="gap:8px;margin-bottom:12px">' +
        '<button class="btn" style="flex:1" data-act="create">➕ Skapa lobby</button>' +
        '<button class="btn ghost" data-act="code">🔑 Kod</button>' +
        '<button class="btn ghost" data-act="refresh">🔄</button>' +
      '</div>' +
      '<div class="ach-filter">' +
        ['alla', 'ledig', '1', '2', '3', '4'].map(function (f) {
          var lbl = f === 'alla' ? 'Alla' : f === 'ledig' ? 'Lediga platser' : M.DIFFS[+f - 1].name;
          return '<button data-f="' + f + '" class="' + (filter === f ? 'on' : '') + '">' + lbl + '</button>';
        }).join('') +
      '</div>' +
      (list.length ? list.map(lobbyRow).join('') : '<div class="empty"><span class="big">🕸️</span>Inga lobbyer matchar filtret.</div>');

    $$('#view-lobbies [data-f]').forEach(function (b) {
      b.onclick = function () { ui.lobbyFilter = b.dataset.f; ui.renderLobbies(); };
    });
    $$('#view-lobbies [data-lobby]').forEach(function (el) {
      el.onclick = function () { joinLobby(el.dataset.lobby); };
    });
    $$('#view-lobbies [data-act]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.act === 'create') createLobbyDialog();
        if (b.dataset.act === 'refresh') { buildLobbies(); ui.renderLobbies(); ui.toast('🔄', 'Listan uppdaterad'); }
        if (b.dataset.act === 'code') codeDialog();
      };
    });
  };

  function lobbyRow(l) {
    var full = l.players >= l.max;
    return '<div class="lobby-item ' + (full ? 'full' : '') + '" data-lobby="' + l.id + '">' +
      '<span class="flag">' + l.flag + '</span>' +
      '<div class="meta"><b>' + esc(l.name) + ' ' +
        '<span class="pill d' + l.diff + '">' + M.DIFFS[l.diff - 1].name + '</span>' +
        (l.live ? '<span class="pill live">● pågår</span>' : '') + '</b>' +
        '<small>' + M.MODES[l.mode].icon + ' ' + M.MODES[l.mode].name + ' · ' + M.catName(l.cat) + ' · värd ' + esc(l.host) + ' · ' + l.ping + ' ms</small></div>' +
      '<div class="cnt">' + l.players + '/' + l.max + '<small>' + (full ? 'full' : 'gå med') + '</small></div>' +
    '</div>';
  }

  function joinLobby(id) {
    var l = null;
    lobbies.forEach(function (x) { if (x.id === id) l = x; });
    if (!l) return;
    if (l.players >= l.max) { ui.toast('🚫', 'Lobbyn är full', 'Prova en annan eller skapa en egen.'); return; }
    enterRoom(l, false);
  }

  function enterRoom(l, isHost) {
    currentLobby = {
      base: l, isHost: isHost, code: l.code, chat: [], countdown: 0,
      players: [{ id: 'you', name: M.profile.name, av: M.profile.avatar, you: true, ready: isHost, host: isHost, skill: 1 }]
    };
    var n = Math.max(1, l.players);
    for (var i = 0; i < n; i++) addBotToRoom();
    if (!isHost) currentLobby.players[1].host = true;
    M.bump('lobbiesJoined');
    if (isHost) M.bump('lobbiesCreated');
    M.save();
    ui.achToast(M.checkAchievements());
    pushChat(null, 'Du gick med i lobbyn.');
    ui.renderRoom();
    startRoomLoop();
  }

  function addBotToRoom() {
    var r = currentLobby;
    if (!r || r.players.length >= r.base.max) return null;
    var used = r.players.map(function (p) { return p.name; });
    var name = M.pick(M.BOT_NAMES.filter(function (n) { return used.indexOf(n) < 0; }) || M.BOT_NAMES);
    if (!name) return null;
    var bot = {
      id: 'b' + Math.random().toString(36).slice(2, 7),
      name: name, av: M.pick(M.AVATARS), you: false,
      ready: Math.random() < .5, host: false,
      skill: 0.55 + Math.random() * 0.4
    };
    r.players.push(bot);
    return bot;
  }

  var roomTimer = null;
  function startRoomLoop() {
    clearInterval(roomTimer);
    roomTimer = setInterval(function () {
      var r = currentLobby;
      if (!r) { clearInterval(roomTimer); return; }
      if (Math.random() < .35 && r.players.length < r.base.max) {
        var b = addBotToRoom();
        if (b) pushChat(null, b.name + ' gick med.');
      }
      r.players.forEach(function (p) {
        if (!p.you && !p.ready && Math.random() < .4) {
          p.ready = true;
          if (Math.random() < .35) pushChat(p, M.pick(['redo!', 'kör då', 'nu kör vi', 'klar 👍', 'jag är peppad']));
        }
      });
      if (Math.random() < .22) pushChat(M.pick(r.players.filter(function (p) { return !p.you; })), M.pick([
        'någon som är bra på bråk?', 'jag suger på division 😅', 'senast höll jag i bomben i 3 sek',
        'lycka till alla', 'vem vinner?', 'kasta inte till mig 🙏', 'hej!', 'gl hf',
        'jag tränade hela igår', 'extrem är omöjligt', 'sista gången kom jag tvåa'
      ]));
      if (ui.current === 'lobbies' && currentLobby) ui.renderRoom(true);
    }, 2600);
  }

  function pushChat(who, text) {
    if (!currentLobby || !text) return;
    currentLobby.chat.push({ who: who ? who.name : null, text: text, you: who && who.you });
    if (currentLobby.chat.length > 60) currentLobby.chat.shift();
  }

  ui.renderRoom = function (soft) {
    var r = currentLobby;
    if (!r) return ui.renderLobbies();
    var readyCount = r.players.filter(function (p) { return p.ready; }).length;
    var me = r.players[0];

    var html =
      '<div class="view-head"><h2>' + r.base.flag + ' ' + esc(r.base.name) + '</h2>' +
        '<p>Kod <b>' + r.code + '</b> · ' + M.MODES[r.base.mode].icon + ' ' + M.MODES[r.base.mode].name +
        ' · ' + M.DIFFS[r.base.diff - 1].name + ' · ' + M.catName(r.base.cat) + '</p></div>' +

      '<div class="card"><h3>👥 Spelare ' + r.players.length + '/' + r.base.max + '</h3>' +
        r.players.map(function (p) {
          return '<div class="player-row ' + (p.you ? 'you' : '') + '">' +
            '<span class="av">' + p.av + '</span>' +
            '<span class="nm">' + esc(p.name) + (p.host ? ' 👑' : '') + (p.you ? ' (du)' : '') + '</span>' +
            '<span class="st ' + (p.ready ? 'ready' : '') + '">' + (p.ready ? 'Redo' : 'Väntar…') + '</span></div>';
        }).join('') +
      '</div>' +

      '<div class="card"><h3>💬 Lobbychatt</h3>' +
        '<div class="chatbox" id="chatbox">' +
          r.chat.map(function (c) {
            return c.who
              ? '<div class="chat-msg"><b>' + esc(c.who) + ':</b> ' + esc(c.text) + '</div>'
              : '<div class="chat-msg sys">' + esc(c.text) + '</div>';
          }).join('') +
        '</div>' +
        '<div class="row" style="gap:8px">' +
          '<input type="text" id="chat-input" placeholder="Skriv något…" maxlength="80">' +
          '<button class="btn small" data-act="send">Skicka</button>' +
        '</div>' +
      '</div>' +

      '<div class="row" style="gap:8px">' +
        '<button class="btn ghost" data-act="leave">← Lämna</button>' +
        '<button class="btn ' + (me.ready ? 'ghost' : '') + '" data-act="ready">' + (me.ready ? '✓ Redo' : 'Bli redo') + '</button>' +
        '<button class="btn" style="flex:1" data-act="start" ' + (readyCount < 2 ? 'disabled' : '') + '>▶ Starta (' + readyCount + ' redo)</button>' +
      '</div>';

    var el = $('#view-lobbies');
    var input = soft ? $('#chat-input') : null;
    var keep = input ? input.value : '';
    el.innerHTML = html;
    if (keep) $('#chat-input').value = keep;
    var cb = $('#chatbox');
    if (cb) cb.scrollTop = cb.scrollHeight;

    $$('#view-lobbies [data-act]').forEach(function (b) {
      b.onclick = function () {
        var a = b.dataset.act;
        if (a === 'leave') { leaveRoom(); }
        if (a === 'ready') { me.ready = !me.ready; ui.renderRoom(); }
        if (a === 'send') sendChat();
        if (a === 'start') startFromRoom();
      };
    });
    var ci = $('#chat-input');
    if (ci) ci.onkeydown = function (e) { if (e.key === 'Enter') sendChat(); };
  };

  function sendChat() {
    var ci = $('#chat-input');
    if (!ci || !ci.value.trim()) return;
    pushChat(currentLobby.players[0], ci.value.trim().slice(0, 80));
    ci.value = '';
    M.bump('chatSent');
    M.save();
    ui.achToast(M.checkAchievements());
    ui.renderRoom();
    setTimeout(function () {
      var bots = currentLobby ? currentLobby.players.filter(function (p) { return !p.you; }) : [];
      if (bots.length && Math.random() < .6) {
        pushChat(M.pick(bots), M.pick(['haha', 'sant', 'kör vi snart?', '👍', 'jag är redo', 'okej!', 'nice']));
        if (ui.current === 'lobbies') ui.renderRoom();
      }
    }, 1200);
  }

  function leaveRoom() {
    clearInterval(roomTimer);
    currentLobby = null;
    ui.renderLobbies();
  }

  function startFromRoom() {
    var r = currentLobby;
    var bots = r.players.filter(function (p) { return !p.you && p.ready; });
    if (!bots.length) bots = r.players.filter(function (p) { return !p.you; }).slice(0, 1);
    clearInterval(roomTimer);
    M.game.start({
      mode: r.base.mode, diff: r.base.diff, cat: r.base.cat,
      bots: bots.length, botDefs: bots, lobbyName: r.base.name
    });
  }
  ui.leaveRoomSilently = function () { clearInterval(roomTimer); currentLobby = null; };

  function createLobbyDialog() {
    ui.modal(
      '<h3>➕ Skapa lobby</h3>' +
      '<label class="field"><span>Namn</span><input type="text" id="cl-name" value="' + esc(M.profile.name) + 's lobby" maxlength="24"></label>' +
      '<label class="field"><span>Spelläge</span><select id="cl-mode">' +
        ['potato', 'blitz', 'duel'].map(function (m) { return '<option value="' + m + '">' + M.MODES[m].icon + ' ' + M.MODES[m].name + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Svårighet</span><select id="cl-diff">' +
        M.DIFFS.map(function (d) { return '<option value="' + d.id + '"' + (d.id === 2 ? ' selected' : '') + '>' + d.name + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Kategori</span><select id="cl-cat"><option value="mix">🎲 Blandat</option>' +
        M.CATEGORIES.map(function (c) { return '<option value="' + c.id + '">' + c.icon + ' ' + c.name + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span>Max antal spelare</span><select id="cl-max">' +
        [2, 3, 4, 5, 6, 8].map(function (n) { return '<option value="' + n + '"' + (n === 5 ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
      '</select></label>' +
      '<div class="row" style="gap:8px"><button class="btn ghost" data-x="close">Avbryt</button>' +
      '<button class="btn" style="flex:1" data-x="make">Skapa</button></div>',
      function (box) {
        $$('[data-x]', box).forEach(function (b) {
          b.onclick = function () {
            if (b.dataset.x === 'close') return ui.closeModal();
            var mode = $('#cl-mode').value;
            var l = {
              id: 'own' + Date.now(), name: $('#cl-name').value.trim() || 'Min lobby', flag: '🏠',
              diff: +$('#cl-diff').value, cat: $('#cl-cat').value, mode: mode,
              max: mode === 'duel' ? 2 : +$('#cl-max').value, players: 0, code: makeCode(),
              host: M.profile.name, ping: 8, live: false
            };
            lobbies.unshift(l);
            ui.closeModal();
            enterRoom(l, true);
          };
        });
      }
    );
  }

  function codeDialog() {
    ui.modal(
      '<h3>🔑 Gå med via kod</h3><p class="sub">Skriv in en lobbykod från en kompis.</p>' +
      '<label class="field" style="margin-top:10px"><span>Kod</span><input type="text" id="jc" placeholder="T.ex. K4M9Z" maxlength="5"></label>' +
      '<div class="row" style="gap:8px"><button class="btn ghost" data-x="close">Avbryt</button>' +
      '<button class="btn" style="flex:1" data-x="join">Gå med</button></div>',
      function (box) {
        $$('[data-x]', box).forEach(function (b) {
          b.onclick = function () {
            if (b.dataset.x === 'close') return ui.closeModal();
            var code = ($('#jc').value || '').toUpperCase().trim();
            if (code.length < 3) return ui.toast('⚠️', 'Ogiltig kod');
            var found = null;
            lobbies.forEach(function (l) { if (l.code === code) found = l; });
            if (!found) {
              found = { id: 'code' + Date.now(), name: 'Lobby ' + code, flag: '🔑', diff: 2, cat: 'mix', mode: 'potato', max: 6, players: M.rnd(1, 3), code: code, host: M.pick(M.BOT_NAMES), ping: M.rnd(20, 70), live: false };
              lobbies.unshift(found);
            }
            ui.closeModal();
            enterRoom(found, false);
          };
        });
      }
    );
  }

  /* ---------- Spela --------------------------------------------------------- */

  ui.playCfg = { diff: 2, cat: 'mix', bots: 3 };

  ui.renderPlay = function () {
    var c = ui.playCfg;
    var modes = [
      { id: 'potato', lock: 0 },
      { id: 'blitz', lock: 0 },
      { id: 'survival', lock: 0 },
      { id: 'duel', lock: 0 },
      { id: 'practice', lock: 0 },
      { id: 'daily', lock: 0 }
    ];
    $('#view-play').innerHTML =
      '<div class="view-head"><h2>Spela</h2><p>Välj läge, svårighet och kategori.</p></div>' +
      '<div class="card"><h3>⚙️ Inställningar för matchen</h3>' +
        '<div class="sub" style="margin-bottom:6px">Svårighet</div>' +
        '<div class="seg" id="seg-diff">' + M.DIFFS.map(function (d) {
          return '<button data-d="' + d.id + '" class="' + (c.diff === d.id ? 'on' : '') + '">' + d.name + '</button>';
        }).join('') + '</div>' +
        '<div class="sub" style="margin:12px 0 6px">Antal motståndare</div>' +
        '<div class="seg" id="seg-bots">' + [1, 2, 3, 5, 7].map(function (n) {
          return '<button data-b="' + n + '" class="' + (c.bots === n ? 'on' : '') + '">' + n + '</button>';
        }).join('') + '</div>' +
        '<label class="field" style="margin-top:12px"><span>Kategori</span><select id="sel-cat">' +
          '<option value="mix">🎲 Blandat</option>' +
          M.CATEGORIES.map(function (x) { return '<option value="' + x.id + '"' + (c.cat === x.id ? ' selected' : '') + '>' + x.icon + ' ' + x.name + '</option>'; }).join('') +
        '</select></label>' +
      '</div>' +
      modes.map(function (m) {
        var mm = M.MODES[m.id];
        return '<button class="mode-card" data-mode="' + m.id + '"><span class="ico">' + mm.icon + '</span>' +
          '<span><b>' + mm.name + '</b><small>' + mm.desc + '</small></span></button>';
      }).join('');

    $$('#seg-diff button').forEach(function (b) {
      b.onclick = function () { c.diff = +b.dataset.d; ui.renderPlay(); };
    });
    $$('#seg-bots button').forEach(function (b) {
      b.onclick = function () { c.bots = +b.dataset.b; ui.renderPlay(); };
    });
    $('#sel-cat').onchange = function () { c.cat = this.value; };
    $$('#view-play [data-mode]').forEach(function (b) {
      b.onclick = function () {
        var mode = b.dataset.mode;
        M.game.start({
          mode: mode, diff: c.diff, cat: c.cat,
          bots: mode === 'duel' ? 1 : (mode === 'survival' || mode === 'practice' || mode === 'daily' ? 0 : c.bots),
          lobbyName: M.MODES[mode].name
        });
      };
    });
  };

  /* ---------- Prestationer --------------------------------------------------- */

  ui.achFilter = 'alla';

  ui.renderAch = function () {
    var f = ui.achFilter;
    var list = M.ACHIEVEMENTS.filter(function (a) { return f === 'alla' || a.g === f; });
    var done = M.unlockedCount();
    var pct = Math.round(done / M.ACHIEVEMENTS.length * 100);

    $('#view-ach').innerHTML =
      '<div class="view-head"><h2>Prestationer</h2><p>' + done + ' av ' + M.ACHIEVEMENTS.length + ' upplåsta · ' + M.achPoints() + ' poäng</p></div>' +
      '<div class="card"><div class="row between"><b>Total framgång</b><span class="sub">' + pct + '%</span></div>' +
        '<div class="xpbar" style="margin-top:8px"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="ach-filter">' + M.ACH_GROUPS.map(function (g) {
        return '<button data-g="' + g.id + '" class="' + (f === g.id ? 'on' : '') + '">' + g.name + '</button>';
      }).join('') + '</div>' +
      list.map(achRow).join('');

    $$('#view-ach [data-g]').forEach(function (b) {
      b.onclick = function () { ui.achFilter = b.dataset.g; ui.renderAch(); };
    });
  };

  function achRow(a) {
    var p = M.achProgress(a);
    var hidden = a.secret && !p.done;
    return '<div class="ach ' + (p.done ? 'done' : 'locked') + '">' +
      '<span class="ico">' + (hidden ? '❔' : a.i) + '</span>' +
      '<div class="body"><b>' + (hidden ? 'Hemlig prestation' : esc(a.n)) +
        '<span class="rar ' + a.r + '">' + a.r + '</span>' + (p.done ? ' ✓' : '') + '</b>' +
        '<p>' + (hidden ? 'Lås upp den för att se vad den kräver.' : esc(a.d)) + '</p>' +
        '<div class="prog"><i style="width:' + (p.done ? 100 : p.pct) + '%"></i></div>' +
        '<div class="pnum">' + (p.done ? 'Klar · +' + a.c + ' mynt' : p.value + ' / ' + p.goal + ' · ' + a.c + ' mynt') + '</div>' +
      '</div></div>';
  }

  /* ---------- Profil, butik, topplista, inställningar ------------------------ */

  ui.profileTab = 'stats';

  ui.renderProfile = function () {
    var p = M.profile, s = p.stats;
    var tab = ui.profileTab;

    var head =
      '<div class="card"><div class="row">' +
        '<span style="font-size:40px">' + p.avatar + '</span>' +
        '<div style="flex:1;min-width:0"><b style="font-size:17px">' + esc(p.name) + '</b>' +
        '<div class="sub">Nivå ' + p.level + ' · ' + M.unlockedCount() + ' prestationer · 🪙 ' + p.coins + '</div></div>' +
        '<button class="btn ghost small" data-act="edit">Ändra</button>' +
      '</div></div>' +
      '<div class="seg" style="margin-bottom:12px">' +
        [['stats', '📊 Statistik'], ['shop', '🛒 Butik'], ['lb', '🏅 Topplista'], ['set', '⚙️ Inställningar']].map(function (t) {
          return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') +
      '</div>';

    var body = '';

    if (tab === 'stats') {
      body =
        '<div class="grid grid-3">' +
          tile(s.gamesPlayed, 'Matcher') + tile(s.wins, 'Segrar') +
          tile((s.gamesPlayed ? Math.round(s.wins / s.gamesPlayed * 100) : 0) + '%', 'Vinstandel') +
          tile(s.correct, 'Rätt') + tile(s.wrong, 'Fel') + tile(M.accuracy() + '%', 'Träffsäkerhet') +
          tile(s.bestStreak, 'Bästa svit') + tile(s.throws, 'Kast') + tile(s.booms, 'Smällar') +
          tile(s.blitzBest, 'Blixtrekord') + tile(s.survivalBest, 'Överlevnad') + tile(Math.floor(s.secondsPlayed / 60) + 'm', 'Speltid') +
        '</div>' +
        '<div class="card mt"><h3>📚 Rätt per kategori</h3>' +
          M.CATEGORIES.map(function (c) {
            var v = s['cat_' + c.id] || 0;
            var max = Math.max(10, Math.max.apply(null, M.CATEGORIES.map(function (x) { return s['cat_' + x.id] || 0; })));
            return '<div style="margin-bottom:8px"><div class="row between" style="font-size:12.5px">' +
              '<span>' + c.icon + ' ' + c.name + '</span><b>' + v + '</b></div>' +
              '<div class="prog" style="height:6px;border-radius:99px;background:var(--bg-2);overflow:hidden;margin-top:3px">' +
              '<i style="display:block;height:100%;width:' + Math.round(v / max * 100) + '%;background:linear-gradient(90deg,var(--brand),var(--brand-2))"></i></div></div>';
          }).join('') +
        '</div>';
    }

    if (tab === 'shop') {
      body = '<div class="card"><div class="row between"><b>Dina mynt</b><b style="color:var(--warn)">🪙 ' + p.coins + '</b></div>' +
        '<p class="sub" style="margin-top:4px">Tjäna mynt genom att vinna matcher och låsa upp prestationer.</p></div>' +
        ['avatar', 'theme', 'bomb'].map(function (type) {
          var title = type === 'avatar' ? '🙂 Avatarer' : type === 'theme' ? '🎨 Teman' : '💣 Bombskinn';
          return '<div class="card"><h3>' + title + '</h3>' +
            M.SHOP.filter(function (i) { return i.type === type; }).map(shopRow).join('') + '</div>';
        }).join('');
    }

    if (tab === 'lb') {
      body = '<div class="card"><h3>🏅 Topplista — den här veckan</h3>' + leaderboardHtml() + '</div>';
    }

    if (tab === 'set') {
      body =
        '<div class="card"><h3>⚙️ Inställningar</h3>' +
          toggleRow('sound', '🔊 Ljudeffekter') +
          toggleRow('vibrate', '📳 Vibration') +
          toggleRow('anim', '✨ Animationer') +
        '</div>' +
        '<div class="card"><h3>🎨 Tema</h3><div class="grid grid-3">' +
          [{ id: 'default', name: 'Mattenite', icon: '🟣' }].concat(
            M.SHOP.filter(function (i) { return i.type === 'theme'; }).map(function (i) { return { id: i.theme, name: i.name, icon: i.icon, req: i.id }; })
          ).map(function (t) {
            var owned = !t.req || M.owns(t.req);
            return '<button class="btn ' + (p.theme === t.id ? '' : 'ghost') + ' small" data-theme="' + t.id + '" ' + (owned ? '' : 'disabled') + '>' +
              t.icon + ' ' + t.name + '</button>';
          }).join('') +
        '</div></div>' +
        '<div class="card"><h3>ℹ️ Om Mattenite</h3><p class="sub">Version 1.0.0 · byggd med Apache Cordova.<br>' +
          'Spelet fungerar helt offline och all data sparas lokalt på din enhet.</p>' +
          '<button class="btn danger block mt" data-act="reset">Nollställ all data</button></div>';
    }

    $('#view-profile').innerHTML = head + body;

    $$('#view-profile [data-t]').forEach(function (b) {
      b.onclick = function () { ui.profileTab = b.dataset.t; ui.renderProfile(); };
    });
    $$('#view-profile [data-buy]').forEach(function (b) {
      b.onclick = function () { buyItem(b.dataset.buy); };
    });
    $$('#view-profile [data-use]').forEach(function (b) {
      b.onclick = function () { useItem(b.dataset.use); };
    });
    $$('#view-profile [data-theme]').forEach(function (b) {
      b.onclick = function () { p.theme = b.dataset.theme; M.save(); ui.refreshChips(); ui.renderProfile(); };
    });
    $$('#view-profile [data-toggle]').forEach(function (b) {
      b.onclick = function () {
        p.settings[b.dataset.toggle] = !p.settings[b.dataset.toggle];
        M.save(); ui.refreshChips(); ui.renderProfile();
      };
    });
    $$('#view-profile [data-act]').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.act === 'edit') editProfileDialog();
        if (b.dataset.act === 'reset') {
          ui.modal('<h3>⚠️ Nollställ allt?</h3><p class="sub">All statistik, mynt och prestationer försvinner. Det går inte att ångra.</p>' +
            '<div class="row mt" style="gap:8px"><button class="btn ghost" data-x="close">Avbryt</button>' +
            '<button class="btn danger" style="flex:1" data-x="yes">Ja, nollställ</button></div>', function (box) {
              $$('[data-x]', box).forEach(function (bb) {
                bb.onclick = function () {
                  if (bb.dataset.x === 'yes') { M.reset(); ui.toast('🧹', 'Allt nollställt'); }
                  ui.closeModal(); ui.renderProfile(); ui.refreshChips();
                };
              });
            });
        }
      };
    });
  };

  function toggleRow(key, label) {
    var on = M.profile.settings[key];
    return '<div class="row between" style="padding:9px 0;border-bottom:1px solid var(--border)">' +
      '<span style="font-size:14px">' + label + '</span>' +
      '<button class="btn ' + (on ? '' : 'ghost') + ' small" data-toggle="' + key + '">' + (on ? 'På' : 'Av') + '</button></div>';
  }

  function shopRow(item) {
    var owned = M.owns(item.id) || item.cost === 0;
    var inUse = (item.type === 'avatar' && M.profile.avatar === item.icon) ||
                (item.type === 'theme' && M.profile.theme === item.theme) ||
                (item.type === 'bomb' && M.profile.bomb === item.icon);
    return '<div class="shop-item"><span class="ico">' + item.icon + '</span>' +
      '<div class="body"><b>' + esc(item.name) + '</b><small>' + (owned ? 'Ägs' : item.cost + ' mynt') + '</small></div>' +
      (owned
        ? (inUse ? '<span class="pill live">✓ används</span>' : '<button class="btn ghost small" data-use="' + item.id + '">Använd</button>')
        : '<button class="btn small" data-buy="' + item.id + '" ' + (M.profile.coins < item.cost ? 'disabled' : '') + '>Köp</button>') +
    '</div>';
  }

  function buyItem(id) {
    if (M.buy(id)) {
      ui.sfx.coin();
      var it = M.SHOP.filter(function (x) { return x.id === id; })[0];
      ui.toast('🛒', 'Köpt: ' + it.name, 'Tryck "Använd" för att ta på dig den.');
      ui.achToast(M.checkAchievements());
      useItem(id);
    } else {
      ui.toast('🪙', 'Inte råd', 'Vinn fler matcher för att tjäna mynt.');
    }
  }

  function useItem(id) {
    var it = M.SHOP.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    if (it.type === 'avatar') M.profile.avatar = it.icon;
    if (it.type === 'theme') M.profile.theme = it.theme;
    if (it.type === 'bomb') M.profile.bomb = it.icon;
    M.save();
    ui.refreshChips();
    ui.renderProfile();
  }

  function editProfileDialog() {
    ui.modal(
      '<h3>✏️ Din profil</h3>' +
      '<label class="field"><span>Namn</span><input type="text" id="pf-name" maxlength="14" value="' + esc(M.profile.name) + '"></label>' +
      '<div class="sub" style="margin-bottom:6px">Avatar</div>' +
      '<div class="grid grid-4" id="pf-avs">' +
        M.AVATARS.map(function (a) {
          var locked = M.SHOP.some(function (s) { return s.type === 'avatar' && s.icon === a && !M.owns(s.id); });
          return '<button class="btn ghost" data-av="' + a + '" ' + (locked ? 'disabled' : '') + ' style="font-size:22px;padding:10px 0">' + a + (locked ? '🔒' : '') + '</button>';
        }).join('') +
      '</div>' +
      '<div class="row mt" style="gap:8px"><button class="btn ghost" data-x="close">Avbryt</button>' +
      '<button class="btn" style="flex:1" data-x="save">Spara</button></div>',
      function (box) {
        var chosen = M.profile.avatar;
        $$('[data-av]', box).forEach(function (b) {
          b.onclick = function () {
            chosen = b.dataset.av;
            $$('[data-av]', box).forEach(function (x) { x.classList.add('ghost'); });
            b.classList.remove('ghost');
          };
        });
        $$('[data-x]', box).forEach(function (b) {
          b.onclick = function () {
            if (b.dataset.x === 'save') {
              M.profile.name = ($('#pf-name').value || 'Du').trim().slice(0, 14) || 'Du';
              M.profile.avatar = chosen;
              M.save();
            }
            ui.closeModal();
            ui.renderProfile();
          };
        });
      }
    );
  }

  function leaderboardHtml() {
    var rnd = M.seededRandom('lb-' + M.todayKey().slice(0, 7) + '-' + Math.floor(new Date().getDate() / 7));
    var base = 400 + M.profile.level * 90;
    var rows = M.BOT_NAMES.slice(0, 12).map(function (n) {
      return { name: n, av: M.AVATARS[Math.floor(rnd() * M.AVATARS.length)], score: Math.round(base * (0.35 + rnd() * 1.5)) };
    });
    var mine = M.profile.stats.correct * 3 + M.profile.stats.wins * 40 + M.achPoints() * 2;
    rows.push({ name: M.profile.name, av: M.profile.avatar, score: mine, you: true });
    rows.sort(function (a, b) { return b.score - a.score; });
    return rows.slice(0, 13).map(function (r, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      return '<div class="lb-row ' + (r.you ? 'you' : '') + '"><span class="pos">' + medal + '</span>' +
        '<span style="font-size:20px">' + r.av + '</span><span>' + esc(r.name) + (r.you ? ' (du)' : '') + '</span>' +
        '<span class="sc">' + r.score + '</span></div>';
    }).join('');
  }

})(window.MATTENITE = window.MATTENITE || {});
