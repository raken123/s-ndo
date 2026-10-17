// Berättelsemotorn: spelar upp SK.STORY, sköter scenen, mobilen, val och sparning.
(function () {
  'use strict';
  const SK = window.SK;
  const $ = SK.$;

  const NAMES = {
    K: 'Kasper', R: 'Ruben', T: 'Tilda', M: 'Mamma', L: 'Gunilla (lärare)', A: 'AI:n', P: 'PANTERN',
    E: 'En elev', V: 'Bosse (vaktmästare)', Re: 'Rektorn', El: 'Elias', N: 'Nora', O: 'Omar', '?': '???',
  };
  const ON_STAGE = { K: 'kasper', R: 'ruben', T: 'tilda', M: 'mamma', L: 'larare', V: 'vaktmastare', Re: 'rektor', N: 'elev4', O: 'elev7' };
  const SPEEDS = { 'långsam': 28, normal: 55, snabb: 120, direkt: 100000 };

  const D = (SK.dir = {
    s: null, idx: 0, token: 0, busy: false, paused: false,
    speed: SK.store.get('textSpeed', 'normal'),
  });
  const stage = (SK.stage = { bg: 'svart', v: '', st: {}, chars: {}, dark: 0, red: 0, fade: 1, scare: 0, speaker: null });

  // ---------- etiketter ----------
  let LABELS = null;
  function labels() {
    if (LABELS) return LABELS;
    LABELS = {};
    SK.STORY.forEach((n, i) => { if (n && n.label) LABELS[n.label] = i; });
    return LABELS;
  }
  D.chapters = function () {
    const out = [];
    SK.STORY.forEach((n, i) => { if (n && n.ch != null) out.push({ ch: n.ch, title: n.title, sub: n.sub, idx: i }); });
    return out;
  };

  // ---------- figurer ----------
  function lookFor(id) {
    if (SK.LOOKS[id]) return SK.LOOKS[id];
    const m = /^elev(\d+)$/.exec(id);
    return SK.studentLook(m ? +m[1] : 1);
  }
  function setChar(id, v, keep) {
    const old = stage.chars[id];
    const o = typeof v === 'number' ? { x: v } : Object.assign({}, v);
    const c = keep && old ? old : { id, x: o.x != null ? o.x : 160, tx: null, dir: 'd', ph: 0, mood: null };
    if (o.x != null && !(keep && old && o.walk)) c.x = o.x;
    if (o.from != null) { c.x = o.from; c.tx = o.x; }
    if (o.dir) c.dir = o.dir;
    if ('mood' in o) c.mood = o.mood;
    if ('glow' in o) c.glow = o.glow;
    if ('phone' in o) c.phone = o.phone;
    if ('alpha' in o) c.alpha = o.alpha;
    c.look = lookFor(id);
    stage.chars[id] = c;
  }

  D.updateStage = function (dt) {
    for (const id in stage.chars) {
      const c = stage.chars[id];
      if (c.tx != null) {
        const d = c.tx - c.x;
        const step = (c.spd || 46) * dt;
        if (Math.abs(d) <= step) { c.x = c.tx; c.tx = null; c.ph = 0; if (c.endDir) c.dir = c.endDir; }
        else { c.x += Math.sign(d) * step; c.dir = d < 0 ? 'l' : 'r'; c.ph += dt * 10; }
      }
    }
    if (stage.scare > 0) stage.scare = Math.max(0, stage.scare - dt);
  };

  D.drawStage = function (ctx, t) {
    SK.drawScene(ctx, stage.bg, stage.v, t, stage.st);
    const floor = SK.sceneFloor(stage.bg);
    const list = Object.values(stage.chars).sort((a, b) => (a.z || 0) - (b.z || 0));
    list.forEach((c) => {
      const talk = stage.speaker === c.id && D.typing ? Math.round(Math.abs(Math.sin(t * 9))) : 0;
      const m = c.mood || {};
      const mood = typeof m === 'string' ? { mouth: m === 'tears' ? 'sad' : m, tears: m === 'tears' } : m;
      SK.drawPerson(ctx, c.x, floor - talk, c.look, c.dir, c.ph, {
        scale: 3, mouth: mood.mouth, tears: mood.tears, glow: c.glow, phone: c.phone, lit: c.phone, alpha: c.alpha,
      });
      if (c.glow) SK.drawEyes(ctx, [[c.x - 3, floor - 34 - talk], [c.x + 4, floor - 34 - talk]], 0.5);
    });
    SK.drawScenePost(ctx, stage.bg, stage.v, t, stage.st);
    if (stage.dark) { ctx.fillStyle = 'rgba(0,0,0,' + stage.dark + ')'; ctx.fillRect(0, 0, SK.W, SK.H); }
    if (stage.red) { ctx.fillStyle = 'rgba(120,0,0,' + stage.red + ')'; ctx.fillRect(0, 0, SK.W, SK.H); }
    if (stage.st.bigEyes) {
      ctx.globalAlpha = stage.st.bigEyes;
      SK.drawPantherFace(ctx, 160, 80, 1.8, t, { open: 0.9 });
      ctx.globalAlpha = 1;
    }
    if (stage.scare > 0) {
      const k = 1 - stage.scare / 0.8;
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, SK.W, SK.H);
      SK.drawPantherFace(ctx, 160 + (Math.random() - 0.5) * 6, 96, 2.2 + k * 1.4, t, { teeth: true, wide: true });
    }
    SK.postFX(ctx, t);
    if (stage.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + stage.fade + ')'; ctx.fillRect(0, 0, SK.W, SK.H); }
  };

  function fadeTo(target, ms) {
    return new Promise((res) => {
      const from = stage.fade, t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        stage.fade = from + (target - from) * k;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
  }

  // ---------- inmatning för att gå vidare ----------
  let advanceFn = null;
  function waitAdvance() { return new Promise((res) => { advanceFn = res; }); }
  D.advance = function () {
    if (D.paused || !advanceFn) return false;
    const f = advanceFn; advanceFn = null; f(); return true;
  };

  // ---------- dialog ----------
  let typingDone = null;
  function say(who, text) {
    const dlg = $('dialog'), nameEl = $('dlg-name'), textEl = $('dlg-text');
    const name = who ? (NAMES[who] || who) : '';
    dlg.className = who === 'P' ? 'panter' : who === 'A' ? 'ai' : who ? '' : 'narr';
    nameEl.textContent = name;
    if (who === 'K') nameEl.style.color = 'var(--kasper)';
    else if (who === 'R') nameEl.style.color = 'var(--ruben)';
    else if (who === 'T') nameEl.style.color = 'var(--tilda)';
    else nameEl.style.color = '';
    stage.speaker = ON_STAGE[who] || null;
    text = fill(text);
    textEl.textContent = '';
    const speed = SPEEDS[D.speed] || 55;
    let shown = 0, acc = 0, last = performance.now();
    D.typing = true;
    return new Promise((resolve) => {
      let skip = false;
      typingDone = () => { skip = true; };
      const step = (now) => {
        const dt = (now - last) / 1000; last = now;
        acc += dt * speed * (SK.input.keys.has('ControlLeft') || SK.input.keys.has('ControlRight') ? 6 : 1);
        const n = skip ? text.length : Math.min(text.length, Math.floor(acc));
        if (n > shown) {
          if (who === 'P' && Math.random() < 0.3) SK.audio.play('glitch');
          else if (n % 3 === 0) SK.audio.play('type');
          shown = n;
          textEl.textContent = text.slice(0, shown);
        }
        if (shown >= text.length) {
          D.typing = false; typingDone = null; dlg.classList.add('done'); resolve();
        } else requestAnimationFrame(step);
      };
      dlg.classList.remove('done');
      requestAnimationFrame(step);
    });
  }
  async function line(who, text) {
    $('dialog').classList.remove('hidden');
    const p = say(who, text);
    // ett klick under skrivningen visar hela texten
    const early = waitAdvance();
    const first = await Promise.race([p.then(() => 'done'), early.then(() => 'skip')]);
    if (first === 'skip') { if (typingDone) typingDone(); await p; advanceFn = null; }
    if (SK.input.keys.has('ControlLeft') || SK.input.keys.has('ControlRight')) { await SK.sleep(90); return; }
    await waitAdvance();
  }

  function fill(text) {
    const s = D.s || {};
    return String(text)
      .replace(/\{straff\}/g, s.straff || 0)
      .replace(/\{mod\}/g, s.mod || 0)
      .replace(/\{klocka\}/g, clockStr());
  }
  function clockStr() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // ---------- mobilen ----------
  function phone(on) {
    const ph = $('phone');
    if (on === false) { ph.classList.add('hidden'); return; }
    if (on === 'clear' || ph.classList.contains('hidden')) $('ph-feed').innerHTML = '';
    ph.classList.remove('hidden');
    ph.classList.toggle('center', on === 'center');
    $('ph-actions').innerHTML = '';
  }
  function bubble(cls, html) {
    const feed = $('ph-feed');
    const b = SK.el('div', 'bub ' + cls, html);
    feed.appendChild(b);
    feed.scrollTop = feed.scrollHeight;
    return b;
  }
  async function pmsg(kind, text, from) {
    if ($('phone').classList.contains('hidden')) phone(true);
    $('dialog').classList.add('hidden');
    if (kind === 'p') {
      const dots = bubble('p', '…');
      await SK.sleep(500);
      dots.remove();
      bubble('p', SK.esc(fill(text)));
      SK.audio.play('pling');
    } else if (kind === 'k') { bubble('k', SK.esc(fill(text))); SK.audio.play('sent'); }
    else if (kind === 'o') { bubble('o', '<b>' + SK.esc(from) + '</b>' + SK.esc(fill(text))); SK.audio.play('msg'); }
    else if (kind === 'a') { bubble('a', SK.esc(fill(text))); SK.audio.play('msg'); }
    else if (kind === 'sys') { bubble('sys', SK.esc(fill(text))); }
    else if (kind === 'red') { bubble('p red', SK.esc(fill(text))); SK.audio.play('glitch'); }
    await SK.sleep(220);
    await waitAdvance();
  }

  // ---------- val ----------
  function choose(opts, inPhone) {
    return new Promise((resolve) => {
      SK.input.flush();
      let box;
      if (inPhone && !$('phone').classList.contains('hidden')) {
        box = $('ph-actions'); box.innerHTML = '';
        opts.forEach((o, i) => {
          const b = SK.el('button', 'ph-btn' + (o[1] && o[1].lydnad ? '' : ' alt') + (o[3] === 'red' ? ' red' : ''), SK.esc(o[0]));
          b.addEventListener('click', () => { SK.audio.play('click'); box.innerHTML = ''; resolve(i); });
          box.appendChild(b);
        });
      } else {
        $('dialog').classList.add('hidden');
        box = $('choices'); box.innerHTML = ''; box.classList.remove('hidden');
        opts.forEach((o, i) => {
          const b = SK.el('button', 'choice' + (o[3] === 'red' ? ' danger' : ''), SK.esc(o[0]) + (o[4] ? '<small>' + SK.esc(o[4]) + '</small>' : ''));
          b.addEventListener('click', () => { SK.audio.play('click'); box.classList.add('hidden'); box.innerHTML = ''; resolve(i); });
          box.appendChild(b);
        });
      }
      keyNav(box, '.ph-btn, .choice');
    });
  }

  // piltangenter mellan knappar
  function keyNav(box, sel) {
    let i = -1;
    const items = () => Array.from(box.querySelectorAll(sel));
    const mark = () => items().forEach((b, k) => b.classList.toggle('sel', k === i));
    const handler = (e) => {
      if (!box.isConnected || !items().length || box.classList.contains('hidden')) { SK.offKey(handler); return; }
      if (D.paused) return;
      const n = items().length;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { i = (i + 1) % n; mark(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { i = (i - 1 + n) % n; mark(); }
      else if ((e.code === 'Enter' || e.code === 'Space') && i >= 0) { const b = items()[i]; SK.offKey(handler); b.click(); }
    };
    SK.addKey(handler);
  }

  // ---------- kapitelkort, straff, overlay ----------
  async function card(n) {
    const c = $('card');
    c.innerHTML = '<div class="c-num">' + (n.ch === 0 ? 'PROLOG' : n.ch === 99 ? 'EPILOG' : 'KAPITEL ' + n.ch) + '</div>' +
      '<div class="c-title">' + SK.esc(n.title) + '</div>' + (n.sub ? '<div class="c-sub">' + SK.esc(n.sub) + '</div>' : '');
    c.classList.remove('hidden');
    $('dialog').classList.add('hidden');
    phone(false);
    SK.audio.play('sting');
    await Promise.race([SK.sleep(3200), waitAdvance()]);
    advanceFn = null;
    c.classList.add('hidden');
  }

  async function punish(text) {
    D.s.straff = (D.s.straff || 0) + 1;
    const p = $('punish');
    p.innerHTML = '<h2>STRAFF</h2><p>' + SK.esc(fill(text)) + '</p><div class="claws">' + '/// '.repeat(Math.min(6, D.s.straff)) + '</div>';
    const b = SK.el('button', 'btn', 'Fortsätt');
    p.appendChild(b);
    p.classList.remove('hidden');
    $('dialog').classList.add('hidden');
    SK.audio.play('scare'); SK.fx('shake'); SK.fx('redflash');
    await new Promise((res) => { b.addEventListener('click', res); keyOnce(['Enter', 'Space'], res, 900); });
    p.classList.add('hidden');
  }

  function keyOnce(codes, fn, delay) {
    const t0 = performance.now();
    const h = (e) => {
      if (performance.now() - t0 < (delay || 0) || D.paused) return;
      if (codes.includes(e.code)) { SK.offKey(h); fn(); }
    };
    SK.addKey(h);
  }

  D.overlay = function (html, buttons) {
    const o = $('overlay');
    o.innerHTML = html;
    const row = SK.el('div', 'row');
    o.appendChild(row);
    o.classList.remove('hidden');
    return new Promise((resolve) => {
      buttons.forEach(([label, val]) => {
        const b = SK.el('button', 'btn', SK.esc(label));
        b.addEventListener('click', () => { SK.audio.play('click'); o.classList.add('hidden'); o.innerHTML = ''; resolve(val); });
        row.appendChild(b);
      });
      keyNav(row, '.btn');
      const first = row.querySelector('.btn');
      if (first) first.classList.add('sel');
      keyOnce(['Enter', 'Space'], () => { const s = row.querySelector('.btn.sel') || first; if (s && o.contains(s)) s.click(); }, 500);
    });
  };

  // ---------- banor ----------
  function controlsHelp(dark) {
    if (SK.input.touchMode) return 'Vänster tumme: gå &nbsp;·&nbsp; SPRING: håll inne &nbsp;·&nbsp; E: göm dig' + (dark ? ' &nbsp;·&nbsp; LJUS: lampan' : '');
    return 'WASD / piltangenter: gå &nbsp;·&nbsp; Shift: spring &nbsp;·&nbsp; E: göm dig / kliv ut' + (dark ? ' &nbsp;·&nbsp; F: lampa' : '') + ' &nbsp;·&nbsp; Esc: paus';
  }

  function playLevel(id, fails, over) {
    return new Promise((resolve) => {
      const def = Object.assign({}, SK.LEVELS[id], over || {});
      let lv;
      const hooks = {
        done: (r) => { finish(); resolve(r); },
        lost: async (why, text) => {
          finish(false);
          if (why === 'tid') {
            await D.overlay('<h2 class="red">TIDEN ÄR UTE</h2><p>' + SK.esc(text) + '</p>', [['Fortsätt', 1]]);
            resolve('tid'); return;
          }
          const btns = [['Försök igen', 'retry']];
          if (fails >= 1) btns.push(['Hoppa över banan', 'skip']);
          const r = await D.overlay('<h2 class="red">FÅNGAD</h2><p>' + SK.esc(text) + '</p>', btns);
          resolve(r === 'skip' ? 'skip' : 'caught');
        },
        pause: async () => {
          lv.state = 'paused';
          showPlayUI(false);
          SK.audio.heart(0);
          const r = await D.overlay('<h2>Paus</h2><p class="keys">' + controlsHelp(def.dark) + '</p>', [['Fortsätt', 'go'], ['Börja om banan', 'restart'], ['Inställningar', 'set'], ['Till huvudmenyn', 'menu']]);
          if (r === 'set') { await SK.ui.settings(); return hooks.pause(); }
          if (r === 'menu') { finish(); D.toMenu(); return; }
          if (r === 'restart') { finish(); resolve('restart'); return; }
          lv.state = 'play'; showPlayUI(true); SK.input.flush();
        },
      };
      hooks.over = over;
      lv = new SK.Level(id, hooks);
      SK.game.level = lv;
      SK.game.mode = 'level';
      $('dialog').classList.add('hidden'); phone(false);
      const finish = () => { showPlayUI(false); SK.audio.heart(0); };
      const showPlayUI = (on) => {
        $('hud').classList.toggle('hidden', !on);
        $('touch').classList.toggle('hidden', !on || !SK.input.touchMode);
        $('t-light').classList.toggle('hidden', !def.dark);
        $('bar-battery').classList.toggle('hidden', !def.dark);
      };
      D.levelUI = showPlayUI;
      const intro = '<h2>' + SK.esc(def.title) + '</h2><p>' + SK.esc(def.goal) + '</p>' +
        (def.tip ? '<p class="keys" style="color:var(--eye)">' + SK.esc(def.tip) + '</p>' : '') +
        '<p class="keys">' + controlsHelp(def.dark) + '</p>';
      SK.audio.music(def.music === 'jakt' ? 'drone' : def.music);
      D.overlay(intro, [['Börja', 1]]).then(() => {
        $('hud-goal').textContent = def.short || def.goal;
        showPlayUI(true);
        lv.start();
      });
    });
  }

  async function runLevel(n) {
    let fails = 0;
    for (;;) {
      const r = await playLevel(n.level, fails, typeof n.over === 'function' ? n.over(D.s) : n.over);
      if (r === 'win' || r === 'skip') return true;
      if (r === 'tid') return false;
      if (r === 'restart') continue;
      if (r === 'caught' && n.failOnCaught) return false;
      fails++;
    }
  }

  D.updateHUD = function () {
    const lv = SK.game.level;
    if (!lv || $('hud').classList.contains('hidden')) return;
    const p = lv.player, def = lv.def;
    const set = (id, v) => { const e = $(id); if (e._v !== v) { e._v = v; e.textContent = v; } };
    set('hud-items', lv.need ? (def.itemNames || 'saker').toUpperCase() + ' ' + lv.got + '/' + lv.need : '');
    if (lv.time) {
      const s = Math.ceil(lv.time);
      set('hud-timer', Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
      $('hud-timer').classList.toggle('low', lv.time < 10);
    } else set('hud-timer', '');
    const near = !p.hidden && lv.nearHide();
    const hint = lv.hintT > 0 ? lv.hintText : p.hidden ? 'Du gömmer dig. Tryck E för att kliva ut.' : near ? 'Tryck E för att gömma dig i skåpet' : '';
    set('hud-hint', hint);
    const sb = $('bar-stamina');
    sb.firstChild.style.width = p.stam + '%';
    sb.classList.toggle('low', p.tired);
    const bb = $('bar-battery');
    bb.firstChild.style.width = p.bat + '%';
    bb.classList.toggle('low', p.bat < 20);
    $('t-light').classList.toggle('on', !!p.light);
  };

  // ---------- spela upp en nod ----------
  async function exec(n, i) {
    if (n == null) return;
    if (typeof n === 'string') return line(null, n);
    if (Array.isArray(n)) return line(n[0], n[1]);

    if (n.ch != null) {
      D.save(i);
      const unlocked = SK.store.get('chapters', []);
      if (!unlocked.includes(n.ch)) { unlocked.push(n.ch); SK.store.set('chapters', unlocked); }
      stage.chars = {}; stage.st = {}; stage.dark = 0; stage.red = 0;
      stage.fade = 1;
      await card(n);
      return;
    }
    if (n.label) return;
    if (n.when) return n.when(D.s) ? exec(n.do, i) : undefined;
    if (n.goto && !n.if) return labels()[n.goto];
    if (n.if) {
      if (n.if(D.s)) return n.goto ? labels()[n.goto] : undefined;
      return n.else ? labels()[n.else] : undefined;
    }
    if (n.bg) {
      $('dialog').classList.add('hidden');
      if (!n.cut) await fadeTo(1, 350);
      stage.bg = n.bg; stage.v = n.v || ''; stage.st = n.st || {}; stage.dark = n.dark || 0; stage.red = 0;
      if (!n.keep) stage.chars = {};
      if (n.stage) for (const id in n.stage) setChar(id, n.stage[id]);
      if (n.music !== undefined) SK.audio.music(n.music);
      await fadeTo(0, n.cut ? 60 : 450);
    }
    if (n.stage && !n.bg) { stage.chars = {}; for (const id in n.stage) setChar(id, n.stage[id]); }
    if (n.add) for (const id in n.add) setChar(id, n.add[id], true);
    if (n.move) {
      for (const id in n.move) {
        const c = stage.chars[id]; if (!c) continue;
        const v = n.move[id];
        c.tx = typeof v === 'number' ? v : v.x; c.spd = (typeof v === 'object' && v.spd) || 46; c.endDir = typeof v === 'object' ? v.dir : null;
      }
      if (n.w) await SK.sleep(n.w * 1000);
    }
    if (n.exit) n.exit.forEach((id) => delete stage.chars[id]);
    if (n.mood) for (const id in n.mood) { const c = stage.chars[id]; if (c) { const v = n.mood[id]; if (typeof v === 'object' && v) Object.assign(c, v); else c.mood = v; } }
    if (n.st && !n.bg) Object.assign(stage.st, n.st);
    if (n.darken != null) stage.dark = n.darken;
    if (n.red != null) stage.red = n.red;
    if (n.music !== undefined && !n.bg) SK.audio.music(n.music);
    if (n.heart !== undefined) SK.audio.heart(n.heart);
    if (n.sfx) [].concat(n.sfx).forEach((s) => SK.audio.play(s));
    if (n.fx) {
      if (n.fx === 'scare') { stage.scare = 0.8; SK.audio.play('scare'); SK.fx('shake'); }
      else SK.fx(n.fx);
    }
    if (n.set) Object.assign(D.s.f, n.set);
    if (n.inc) for (const k in n.inc) D.s[k] = (D.s[k] || 0) + n.inc[k];
    if (n.toast) toast(n.toast);
    if (n.phone !== undefined) phone(n.phone);
    if (n.clock) $('ph-clock').textContent = fill(n.clock);
    if (n.phoneTitle) $('phone').querySelector('.ph-head b').textContent = n.phoneTitle;
    if (n.phoneAI !== undefined) $('phone').classList.toggle('ai', !!n.phoneAI);
    if (n.phoneSub) $('ph-sub').textContent = n.phoneSub;
    if (n.glitchPhone !== undefined) $('phone').classList.toggle('glitch', !!n.glitchPhone);
    if (n.am) await pmsg('a', n.am);
    if (n.pm) await pmsg('p', n.pm);
    if (n.km) await pmsg('k', n.km);
    if (n.om) await pmsg('o', n.om[1], n.om[0]);
    if (n.sys) await pmsg('sys', n.sys);
    if (n.redm) await pmsg('red', n.redm);
    if (n.mission) {
      if ($('phone').classList.contains('hidden')) phone(true);
      $('dialog').classList.add('hidden');
      const m = n.mission;
      const el = SK.el('div', 'mission', '<h4>NYTT UPPDRAG</h4><h3>' + SK.esc(m.title) + '</h3><p>' + SK.esc(fill(m.text)) + '</p>' + (m.time ? '<div class="m-time">⏱ ' + SK.esc(m.time) + '</div>' : ''));
      $('ph-feed').appendChild(el); $('ph-feed').scrollTop = 1e6;
      SK.audio.play('pling'); SK.audio.play('buzz');
      if (!n.choice) { await SK.sleep(300); await waitAdvance(); }
    }
    if (n.choice) {
      const k = await choose(n.choice, n.inPhone || !!n.mission);
      const opt = n.choice[k];
      const eff = opt[1] || {};
      for (const key in eff) {
        if (key === 'set') Object.assign(D.s.f, eff.set);
        else D.s[key] = (D.s[key] || 0) + eff[key];
      }
      D.s.f['val_' + (n.id || i)] = k;
      if (opt[2]) return labels()[opt[2]];
      return;
    }
    if (n.level) {
      const ok = await runLevel(n);
      SK.game.mode = 'stage'; SK.game.level = null;
      if (n.music !== undefined) SK.audio.music(n.music);
      if (!ok && n.fail) return labels()[n.fail];
      return;
    }
    if (n.mini) {
      $('dialog').classList.add('hidden');
      if (!n.keepPhone) phone(false);
      let ok;
      for (;;) {
        ok = await SK.mini[n.mini](typeof n.opts === 'function' ? n.opts(D.s) : n.opts || {});
        if (ok || !n.retry) break;
        const r = await D.overlay('<h2 class="red">MISSLYCKADES</h2><p>' + SK.esc(n.retry) + '</p>', [['Försök igen', 1]]);
        void r;
      }
      if (!ok && n.fail) return labels()[n.fail];
      return;
    }
    if (n.straff) { await punish(n.straff); return; }
    if (n.wait) { await SK.sleep(n.wait * 1000); return; }
    if (n.waitClick) { await waitAdvance(); return; }
    if (n.end) { await ending(n.end); return SK.STORY.length; }
  }

  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.remove('hidden');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  SK.toast = toast;

  // ---------- slut ----------
  const ENDINGS = {
    god: { n: 1, title: 'Tystnaden bryts', text: 'Panterappen levde på tystnad. När alla till slut sa sanningen samtidigt fanns det ingenting kvar för den att äta.' },
    ensam: { n: 2, title: 'Ensam mot Pantern', text: 'Du stängde av din egen mobil. Men du gjorde det ensam – och i korridorerna plingar det fortfarande.' },
    pantern: { n: 3, title: 'Den nya Pantern', text: 'Ingen kommer någonsin att mobba dig igen. Ingen kommer någonsin att våga prata med dig heller.' },
  };
  SK.ENDINGS = ENDINGS;

  async function ending(key) {
    const e = ENDINGS[key];
    const got = SK.store.get('endings', []);
    if (!got.includes(key)) { got.push(key); SK.store.set('endings', got); }
    SK.store.del('save');
    $('dialog').classList.add('hidden'); phone(false);
    SK.audio.music(key === 'pantern' ? 'drone' : 'lugn');
    await D.overlay(
      '<div class="ending">SLUT ' + e.n + ' AV 3</div><h2>' + SK.esc(e.title) + '</h2><p>' + SK.esc(e.text) + '</p>' +
      '<p class="keys">Du har hittat ' + got.length + ' av 3 slut.' + (got.length < 3 ? ' Spela igen och välj annorlunda.' : ' Du har sett allt. Eller?') + '</p>' +
      '<div class="credits"><b>SKRÄCKAPPEN</b> – ett skräckspel fritt efter en idé ur en bok av Ann Olerot.<br>Berättelse, grafik, ljud och kod gjorda för det här spelet.</div>' +
      '<p class="helpline">Blir du mobbad? Berätta för en vuxen du litar på. Du kan också ringa eller chatta med BRIS: 116 111.</p>',
      [['Till huvudmenyn', 1]]
    );
    D.toMenu();
  }

  // ---------- spara ----------
  D.save = function (idx) {
    SK.store.set('save', { idx, s: D.s, at: Date.now() });
  };
  D.hasSave = () => !!SK.store.get('save', null);

  D.newState = () => ({ mod: 0, lydnad: 0, straff: 0, f: {} });

  D.start = async function (idx, s) {
    D.token++;
    const my = D.token;
    D.s = s || D.newState();
    if (!D.s.f) D.s.f = {};
    SK.ui.hideMenu();
    SK.game.mode = 'stage';
    stage.chars = {}; stage.st = {}; stage.bg = 'svart'; stage.fade = 1;
    $('ph-clock').textContent = '07:13'; $('ph-sub').textContent = 'Pantern skyddar dig';
    $('phone').querySelector('.ph-head b').textContent = 'Panterappen'; $('phone').classList.remove('ai', 'glitch');
    let i = idx || 0;
    while (i < SK.STORY.length) {
      if (my !== D.token) return;
      let r;
      try { r = await exec(SK.STORY[i], i); }
      catch (e) { console.error('Berättelsen stannade vid nod', i, e); r = undefined; }
      if (my !== D.token) return;
      i = typeof r === 'number' ? r : i + 1;
      D.idx = i;
    }
  };

  D.toMenu = function () {
    D.token++;
    advanceFn = null;
    D.paused = false;
    ['dialog', 'choices', 'phone', 'card', 'punish', 'overlay', 'hud', 'touch', 'mini'].forEach((id) => $(id).classList.add('hidden'));
    $('choices').innerHTML = ''; $('mini').innerHTML = '';
    SK.game.level = null;
    SK.audio.heart(0);
    SK.ui.showMenu();
  };

  // Paus mitt i berättelsen
  D.pause = async function () {
    if (D.paused || SK.game.mode !== 'stage') return;
    if (!$('overlay').classList.contains('hidden') || !$('mini').classList.contains('hidden')) return;
    D.paused = true;
    const r = await D.overlay('<h2>Paus</h2><p class="keys">Klick / mellanslag: fortsätt läsa &nbsp;·&nbsp; håll Ctrl: spola fram</p>', [['Fortsätt', 'go'], ['Inställningar', 'set'], ['Till huvudmenyn', 'menu']]);
    D.paused = false;
    if (r === 'set') { await SK.ui.settings(); return D.pause(); }
    if (r === 'menu') D.toMenu();
  };
})();
