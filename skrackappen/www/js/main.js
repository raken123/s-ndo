// Uppstart, huvudloop, meny, inställningar och plattformsdetaljer.
(function () {
  'use strict';
  const SK = window.SK;
  const $ = SK.$;
  const D = SK.dir;

  SK.game = { mode: 'boot', level: null, t: 0 };
  SK.platform = /Electron/i.test(navigator.userAgent) ? 'desktop' : window.SkrackNative ? 'android' : 'web';

  // ---------- tangenter ----------
  const handlers = new Set();
  SK.addKey = (h) => handlers.add(h);
  SK.offKey = (h) => handlers.delete(h);
  const visible = (id) => !$(id).classList.contains('hidden');

  SK.onKey = function (e) {
    SK.audio.init();
    Array.from(handlers).forEach((h) => { try { h(e); } catch (err) { console.error(err); } });
    if (e.repeat) return;
    if (SK.game.mode === 'stage') {
      if (e.code === 'Escape') { D.pause(); return; }
      const blocked = visible('overlay') || visible('choices') || visible('mini') || visible('menu') || visible('punish');
      if (!blocked && ['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(e.code)) D.advance();
    }
  };

  // klick/tryck för att läsa vidare
  document.addEventListener('pointerdown', (e) => {
    SK.audio.init();
    if (SK.game.mode !== 'stage') return;
    if (e.target.closest('button, .choice, #ph-actions, #mini, #overlay, #menu, #punish, input')) return;
    if (visible('choices')) return;
    D.advance();
  });

  // ---------- effekter ----------
  SK.calm = SK.store.get('calm', false);
  SK.fx = function (name) {
    const st = $('stage'), fx = $('fx');
    if (name === 'shake') {
      if (SK.calm) return;
      st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
      setTimeout(() => st.classList.remove('shake'), 500);
    } else if (name === 'flash' || name === 'redflash') {
      fx.className = ''; void fx.offsetWidth; fx.className = name;
    } else if (name === 'glitch') {
      if (SK.calm) { SK.audio.play('glitch'); return; }
      st.classList.add('glitch'); SK.audio.play('glitch');
      setTimeout(() => st.classList.remove('glitch'), 700);
    } else if (name === 'glitchOn') { if (!SK.calm) st.classList.add('glitch'); }
    else if (name === 'glitchOff') st.classList.remove('glitch');
  };

  // ---------- storlek ----------
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = vw, h = (vw * 9) / 16;
    if (h > vh) { h = vh; w = (vh * 16) / 9; }
    w = Math.floor(w); h = Math.floor(h);
    const st = $('stage');
    st.style.width = w + 'px'; st.style.height = h + 'px';
    st.style.left = Math.floor((vw - w) / 2) + 'px';
    st.style.top = Math.floor((vh - h) / 2) + 'px';
    document.documentElement.style.setProperty('--u', (w / 100).toFixed(2) + 'px');
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------- huvudloop ----------
  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let last = performance.now();
  function frame(now) {
    const dt = SK.clamp((now - last) / 1000, 0, 1 / 20);
    last = now;
    SK.game.t += dt;
    const t = SK.game.t;
    try {
      if (SK.game.mode === 'level' && SK.game.level) {
        SK.game.level.update(dt);
        if (SK.game.level) { SK.game.level.draw(ctx); SK.postFX(ctx, t, 0.6); D.updateHUD(); }
      } else if (SK.game.mode === 'stage') {
        D.updateStage(dt);
        D.drawStage(ctx, t);
      } else {
        drawMenuBg(ctx, t);
      }
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(frame);
  }

  let twitchT = 4;
  function drawMenuBg(ctx, t) {
    SK.drawScene(ctx, 'skolgard', 'natt', t, { phones: true, eyes: Math.sin(t * 0.7) > 0.2 });
    SK.drawScenePost(ctx, 'skolgard', 'natt', t, {});
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, SK.W, SK.H);
    ctx.globalAlpha = 0.18 + Math.sin(t * 0.5) * 0.08;
    SK.drawPantherFace(ctx, 160, 92, 1.7, t, { open: 0.7 + Math.sin(t * 0.9) * 0.3 });
    ctx.globalAlpha = 1;
    SK.postFX(ctx, t);
    twitchT -= 1 / 60;
    if (twitchT <= 0) {
      twitchT = SK.rand(4, 9);
      const title = document.querySelector('#menu .m-title');
      if (title) { title.classList.remove('twitch'); void title.offsetWidth; title.classList.add('twitch'); }
    }
  }

  // ---------- meny ----------
  const ui = (SK.ui = {});
  ui.hideMenu = () => $('menu').classList.add('hidden');

  ui.showMenu = function () {
    SK.game.mode = 'menu';
    SK.audio.music('meny');
    const m = $('menu');
    m.innerHTML = '';
    m.classList.remove('hidden');
    m.appendChild(SK.el('div', 'm-title', 'SKRÄCKAPPEN'));
    m.appendChild(SK.el('div', 'm-sub', 'PANTERN SKYDDAR DIG'));
    const list = SK.el('div', 'm-list');
    m.appendChild(list);
    const add = (label, fn, dis) => {
      const b = SK.el('button', 'btn', label);
      b.disabled = !!dis;
      b.addEventListener('click', () => { SK.audio.init(); SK.audio.play('click'); fn(); });
      list.appendChild(b);
      return b;
    };
    const save = SK.store.get('save', null);
    if (save) add('Fortsätt', () => D.start(save.idx, save.s));
    add('Nytt spel', () => D.start(0, null));
    add('Kapitel', ui.chapters, SK.store.get('chapters', []).length < 2);
    add('Inställningar', () => ui.settings().then(ui.showMenu));
    add('Om spelet', ui.about);
    if (SK.platform !== 'web') add('Avsluta', ui.quit);
    m.appendChild(SK.el('div', 'm-foot', 'Fritt efter en idé ur en bok av Ann Olerot · version 1.0 · ' + (SK.input.touchMode ? 'tryck för att välja' : 'piltangenter + Enter eller musen')));
    keyMenu(list);
  };

  function keyMenu(list) {
    let i = 0;
    const btns = () => Array.from(list.querySelectorAll('.btn:not(:disabled)'));
    const mark = () => btns().forEach((b, k) => b.classList.toggle('sel', k === i));
    mark();
    const h = (e) => {
      if (!list.isConnected || $('menu').classList.contains('hidden')) { SK.offKey(h); return; }
      if (!$('overlay').classList.contains('hidden')) return;
      const n = btns().length;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { i = (i + 1) % n; mark(); SK.audio.play('click'); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { i = (i - 1 + n) % n; mark(); SK.audio.play('click'); }
      else if (e.code === 'Enter' || e.code === 'Space') { SK.offKey(h); btns()[i].click(); }
    };
    SK.addKey(h);
  }

  function panel(html, buttons) {
    $('menu').classList.add('hidden');
    return D.overlay('<div class="panel">' + html + '</div>', buttons || [['Tillbaka', 1]]);
  }

  ui.chapters = async function () {
    const got = SK.store.get('chapters', []);
    const chs = D.chapters().filter((c) => got.includes(c.ch));
    const o = $('overlay');
    const p = panel('<h2>Kapitel</h2><p>Börja om från ett kapitel du redan har nått.</p><div class="chapters"></div>', [['Tillbaka', 'back']]);
    const grid = o.querySelector('.chapters');
    let chosen = null;
    chs.forEach((c) => {
      const b = SK.el('button', 'btn', (c.ch === 0 ? 'Prolog' : c.ch === 99 ? 'Epilog' : c.ch + '. ') + ' ' + SK.esc(c.title));
      b.addEventListener('click', () => { chosen = c; o.querySelector('.row .btn').click(); });
      grid.appendChild(b);
    });
    await p;
    if (chosen) {
      const s = D.newState();
      // rimliga val om man hoppar in mitt i
      s.mod = 2; s.f.hjalpteRuben = true; s.f.tildaVan = true;
      D.start(chosen.idx, s);
    } else ui.showMenu();
  };

  ui.about = async function () {
    const got = SK.store.get('endings', []);
    const ends = Object.keys(SK.ENDINGS).map((k) => (got.includes(k) ? '<b>' + SK.ENDINGS[k].title + '</b>' : '???')).join(' · ');
    await panel(
      '<h2>Skräckappen</h2>' +
      '<p>Kasper går i sexan på Norrskolan. Varje dag jagar Ruben och Tilda honom genom korridorerna. En natt säger AI:n i hans mobil att den har hittat en lösning: <b>Panterappen</b>. Den stoppar mobbningen. Men den kan aldrig avinstalleras – och den som inte gör sina uppdrag får straff.</p>' +
      '<p>Ett skräckspel fritt efter en idé ur en bok av Ann Olerot. Hela berättelsen, grafiken, musiken och ljuden är gjorda för det här spelet och skapas medan du spelar.</p>' +
      '<p><b>Styrning:</b> klick, mellanslag eller Enter läser vidare. I banorna går du med WASD eller piltangenterna, springer med Shift, gömmer dig med E och tänder lampan med F. På mobilen finns knappar på skärmen. Esc pausar. F11 ger helskärm.</p>' +
      '<p class="endings">Slut du har hittat: ' + ends + '</p>' +
      '<p class="helpline">Blir du mobbad? Du är inte ensam och det är inte ditt fel. Berätta för en vuxen du litar på. Du kan också ringa eller chatta med BRIS: 116 111.</p>'
    );
    ui.showMenu();
  };

  ui.settings = function () {
    const o = $('overlay');
    const speeds = ['långsam', 'normal', 'snabb', 'direkt'];
    const p = panel(
      '<h2>Inställningar</h2>' +
      '<div class="set-row"><span>Volym</span><input type="range" min="0" max="1" step="0.05" id="s-vol"></div>' +
      '<div class="set-row"><span>Musik</span><input type="range" min="0" max="1" step="0.05" id="s-mus"></div>' +
      '<div class="set-row"><span>Ljudeffekter</span><input type="range" min="0" max="1" step="0.05" id="s-sfx"></div>' +
      '<div class="set-row"><span>Textfart</span><div class="seg" id="s-speed"></div></div>' +
      '<div class="set-row"><span>Lugnare effekter (mindre skak och flimmer)</span><div class="seg" id="s-calm"></div></div>' +
      '<div class="set-row"><span>Helskärm</span><div class="seg"><button id="s-fs">Växla</button></div></div>' +
      '<div class="set-row"><span>Sparat spel</span><div class="seg"><button id="s-del">Radera</button></div></div>',
      [['Klar', 1]]
    );
    const A = SK.audio;
    const bind = (id, val, fn) => { const e = o.querySelector(id); e.value = val; e.addEventListener('input', () => { fn(+e.value); A.play('click'); }); };
    bind('#s-vol', A.vol, (v) => A.setVolumes(v));
    bind('#s-mus', A.musicVol, (v) => A.setVolumes(null, v));
    bind('#s-sfx', A.sfxVol, (v) => A.setVolumes(null, null, v));
    const seg = (id, opts, cur, fn) => {
      const box = o.querySelector(id);
      opts.forEach(([label, v]) => {
        const b = SK.el('button', v === cur ? 'on' : '', label);
        b.addEventListener('click', () => { box.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); fn(v); A.play('click'); });
        box.appendChild(b);
      });
    };
    seg('#s-speed', speeds.map((s) => [s, s]), D.speed, (v) => { D.speed = v; SK.store.set('textSpeed', v); });
    seg('#s-calm', [['av', false], ['på', true]], SK.calm, (v) => { SK.calm = v; SK.store.set('calm', v); document.body.classList.toggle('calm', v); });
    o.querySelector('#s-fs').addEventListener('click', SK.toggleFullscreen);
    o.querySelector('#s-del').addEventListener('click', (e) => { SK.store.del('save'); e.target.textContent = 'Raderat'; });
    return p;
  };

  ui.quit = function () {
    if (window.SkrackNative && window.SkrackNative.quit) window.SkrackNative.quit();
    else window.close();
  };

  // ---------- Android-bakåtknappen ----------
  SK.back = function () {
    if (!$('overlay').classList.contains('hidden')) {
      const btns = $('overlay').querySelectorAll('.row .btn');
      if (btns.length) { btns[0].click(); return true; }
    }
    if (SK.game.mode === 'level' && SK.game.level && SK.game.level.state === 'play') { SK.game.level.hooks.pause(); return true; }
    if (SK.game.mode === 'stage') { D.pause(); return true; }
    return false;
  };

  // pausa när appen hamnar i bakgrunden
  SK.pauseApp = function () {
    SK.audio.suspend();
    if (SK.game.mode === 'level' && SK.game.level && SK.game.level.state === 'play') SK.game.level.hooks.pause();
  };
  SK.resumeApp = function () { SK.audio.resume(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) SK.pauseApp(); else SK.resumeApp(); });

  // ---------- start ----------
  async function boot() {
    resize();
    SK.setupTouch();
    if (SK.calm) document.body.classList.add('calm');
    $('boot').remove();
    $('hud-pause').addEventListener('click', () => { const lv = SK.game.level; if (lv && lv.state === 'play') lv.hooks.pause(); });
    requestAnimationFrame(frame);
    SK.ready = true;
    if (!SK.store.get('warned', false)) {
      SK.game.mode = 'menu';
      await D.overlay(
        '<div class="panel" style="text-align:center"><h2>Varning</h2>' +
        '<p>Skräckappen är ett skräckspel. Det handlar om mobbning och innehåller mörker, plötsliga ljud och saker som hoppar fram.</p>' +
        '<p>Spela med ljudet på – om du vågar.</p>' +
        '<p class="helpline">Blir du själv mobbad? Berätta för en vuxen du litar på, eller ring BRIS: 116 111.</p></div>',
        [['Jag vågar', 1]]
      );
      SK.store.set('warned', true);
    }
    SK.audio.init();
    ui.showMenu();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
