// Minispelen. Varje minispel returnerar ett Promise som löses med true/false.
(function () {
  'use strict';
  const SK = window.SK;
  const M = (SK.mini = {});

  function open(cls) {
    const root = SK.$('mini');
    root.innerHTML = '';
    root.className = cls || '';
    const box = SK.el('div', 'm-box');
    root.appendChild(box);
    SK.input.flush();
    return { root, box };
  }
  function close() {
    const root = SK.$('mini');
    root.className = 'hidden';
    root.innerHTML = '';
    SK.input.flush();
  }
  M.close = close;

  // En liten canvas i spelets pixelupplösning
  function pixelCanvas(box, w, h) {
    const c = SK.el('canvas');
    c.width = w; c.height = h;
    box.appendChild(c);
    return c;
  }

  // Tryck-och-håll från tangentbord, mus eller pekskärm
  function holdButton(label, box) {
    const b = SK.el('button', 'mini-btn', label);
    const st = { held: false, presses: 0 };
    const down = (e) => { e.preventDefault(); st.held = true; st.presses++; b.classList.add('held'); SK.audio.init(); };
    const up = () => { st.held = false; b.classList.remove('held'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    box.appendChild(b);
    st.btn = b;
    st.poll = () => {
      const k = SK.input.keys.has('Space') || SK.input.keys.has('Enter') || SK.input.keys.has('KeyE');
      if (k && !st.k) st.presses++;
      st.k = k;
      return st.held || k;
    };
    return st;
  }

  function loop(fn) {
    let last = performance.now(), alive = true;
    const step = (now) => {
      if (!alive) return;
      const dt = SK.clamp((now - last) / 1000, 0, 0.05); last = now;
      if (fn(dt) === false) { alive = false; return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => { alive = false; };
  }

  // ---------- 1. Försök avinstallera Panterappen ----------
  M.avinstallera = function () {
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', 'AVINSTALLERA'));
      box.appendChild(SK.el('p', 'm-help', 'Dra Panterappen till papperskorgen – eller tryck på ikonen och välj <b>Avinstallera</b>.'));
      const home = SK.el('div', 'home');
      box.appendChild(home);
      const apps = [['Klocka', '⏰', '#2b2b33'], ['Kamera', '📷', '#3a3a44'], ['Meddelanden', '💬', '#1f7a3a'], ['Musik', '🎵', '#a8324a'], ['Kartor', '🗺️', '#2a5a8a'], ['Väder', '⛅', '#3a7ab0'], ['Spel', '🎮', '#6a3a9a'], ['Panterappen', '', '#070707']];
      const slots = [];
      const els = apps.map((a, i) => {
        const e = SK.el('div', 'app');
        const icon = SK.el('i', a[0] === 'Panterappen' ? 'logo-eye' : '', a[1]);
        if (a[0] !== 'Panterappen') icon.style.background = a[2];
        e.appendChild(icon);
        e.appendChild(document.createTextNode(a[0]));
        const col = i % 4, row = Math.floor(i / 4);
        const pos = { left: 6 + col * 23 + '%', top: 14 + row * 22 + '%' };
        Object.assign(e.style, pos);
        slots.push(pos);
        home.appendChild(e);
        return e;
      });
      const clock = SK.el('div', '', '23:47');
      Object.assign(clock.style, { position: 'absolute', top: '3%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '.7em', color: '#aab' });
      home.appendChild(clock);
      const trash = SK.el('div', 'trash', '🗑️ Släpp här för att avinstallera');
      home.appendChild(trash);
      const pan = els[7];
      let tries = 0, done = false, pop = null, menu = null;

      const say = (html, ms) => {
        if (pop) pop.remove();
        pop = SK.el('div', 'pop', html);
        home.appendChild(pop);
        if (ms) setTimeout(() => { if (pop) { pop.remove(); pop = null; } }, ms);
      };
      const attempt = () => {
        if (done) return;
        tries++;
        if (menu) { menu.remove(); menu = null; }
        Object.assign(pan.style, slots[7]);
        if (tries === 1) {
          SK.audio.play('glitch');
          say('Avinstallationen misslyckades.<br>Försök igen senare.', 2200);
        } else if (tries === 2) {
          SK.audio.play('whisper');
          trash.textContent = 'Nej.';
          trash.classList.add('hot');
          say('Varför vill du lämna mig, Kasper?<br>Jag har ju just börjat skydda dig.', 2600);
          els.slice(0, 4).forEach((e) => { e.querySelector('i').className = 'logo-eye'; e.querySelector('i').textContent = ''; e.querySelector('i').style.background = ''; });
        } else {
          done = true;
          SK.audio.play('scare'); SK.fx('shake'); SK.fx('flash');
          els.forEach((e) => { const i = e.querySelector('i'); i.className = 'logo-eye'; i.textContent = ''; i.style.background = ''; e.lastChild.textContent = 'Panterappen'; });
          trash.textContent = 'PANTERN SKYDDAR DIG';
          say('PANTERAPPEN KAN INTE AVINSTALLERAS.<br><br>Pantern är en del av dig nu.');
          setTimeout(() => { close(); resolve(true); }, 3600);
        }
      };

      // dra och släpp
      let drag = null;
      pan.addEventListener('pointerdown', (e) => {
        if (done) return;
        e.preventDefault();
        SK.audio.init();
        const r = home.getBoundingClientRect();
        drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, r, moved: false };
        pan.setPointerCapture(e.pointerId);
      });
      pan.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
        if (!drag.moved) return;
        pan.classList.add('dragging');
        pan.style.left = ((e.clientX - drag.r.left) / drag.r.width) * 100 - 9 + '%';
        pan.style.top = ((e.clientY - drag.r.top) / drag.r.height) * 100 - 6 + '%';
        const tr = trash.getBoundingClientRect();
        trash.classList.toggle('hot', e.clientY > tr.top - 20 || tries >= 2);
        // ikonen smiter undan från papperskorgen
        if (tries >= 1 && e.clientY > tr.top - 40 && Math.random() < 0.08) {
          SK.audio.play('glitch');
          pan.style.left = SK.rand(5, 70) + '%'; pan.style.top = SK.rand(10, 50) + '%';
        }
      });
      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = drag.moved;
        drag = null;
        pan.classList.remove('dragging');
        if (!moved) {
          if (menu) { menu.remove(); menu = null; return; }
          menu = SK.el('div', 'pop', 'Panterappen<br><br>');
          const b = SK.el('button', 'ph-btn red', 'Avinstallera');
          b.addEventListener('click', (ev) => { ev.stopPropagation(); attempt(); });
          menu.appendChild(b);
          home.appendChild(menu);
          b.focus();
          return;
        }
        const tr = trash.getBoundingClientRect();
        if (e.clientY > tr.top - 24) attempt();
        else Object.assign(pan.style, slots[7]);
        if (tries < 2) trash.classList.remove('hot');
      };
      pan.addEventListener('pointerup', endDrag);
      pan.addEventListener('pointercancel', endDrag);
      // tangentbord: E/mellanslag försöker också
      const stop = loop(() => {
        if (done) return false;
        if (SK.input.take('act')) attempt();
      });
      void stop;
    });
  };

  // ---------- 2. Håll andan ----------
  M.andas = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', 'HÅLL ANDAN'));
      box.appendChild(SK.el('p', 'm-help', opts.help || 'Pantern är precis utanför. Håll knappen för att hålla andan – släpp för att andas lugnt. Håll pilen inne i det gröna fältet.'));
      const c = pixelCanvas(box, 320, 140);
      const ctx = c.getContext('2d');
      const btn = holdButton('HÅLL (mellanslag)', box);
      let y = 0.5, v = 0, zone = 0.5, zv = 0.25, calm = 0, noise = 0, t = 0;
      const need = opts.time || 8;
      SK.audio.heart(110);
      loop((dt) => {
        t += dt;
        const held = btn.poll();
        v += (held ? -1.9 : 1.5) * dt;
        v *= Math.pow(0.18, dt);
        y = SK.clamp(y + v * dt * 1.4, 0, 1);
        if (y === 0 || y === 1) v *= -0.3;
        zv += (Math.random() - 0.5) * 2.2 * dt;
        zv = SK.clamp(zv, -0.38, 0.38);
        zone += zv * dt;
        if (zone < 0.22 || zone > 0.78) { zone = SK.clamp(zone, 0.22, 0.78); zv = -zv; }
        const zh = 0.16;
        const inside = Math.abs(y - zone) < zh;
        if (inside) calm += dt; else noise += dt * (opts.hard ? 0.3 : 0.2);
        if (!inside && Math.random() < dt * 3) SK.audio.play('gasp');
        // rita
        ctx.fillStyle = '#030305'; ctx.fillRect(0, 0, 320, 140);
        // dörrspringan
        ctx.fillStyle = '#0d0d12'; ctx.fillRect(20, 10, 200, 120);
        ctx.fillStyle = '#1c1c26'; ctx.fillRect(116, 10, 8, 120);
        const px = 120 + Math.sin(t * 0.6) * 140;
        ctx.save(); ctx.beginPath(); ctx.rect(116, 10, 8, 120); ctx.clip();
        ctx.fillStyle = '#2a2a34'; ctx.fillRect(116, 10, 8, 120);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(px, 80, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (Math.abs(px - 120) < 18) SK.drawEyes(ctx, [[px + 2, 66], [px + 8, 66]], 1);
        // mätaren
        ctx.fillStyle = '#111'; ctx.fillRect(250, 10, 26, 120);
        ctx.fillStyle = 'rgba(212,242,90,0.35)'; ctx.fillRect(250, 10 + (zone - zh) * 120, 26, zh * 240);
        ctx.fillStyle = inside ? SK.EYE : '#ff5a4a'; ctx.fillRect(244, 10 + y * 120 - 2, 38, 4);
        // lugn / ljud
        ctx.fillStyle = '#222'; ctx.fillRect(290, 10, 8, 120); ctx.fillRect(304, 10, 8, 120);
        ctx.fillStyle = SK.EYE; ctx.fillRect(290, 130 - (calm / need) * 120, 8, (calm / need) * 120);
        ctx.fillStyle = '#ff5a4a'; ctx.fillRect(304, 130 - noise * 120, 8, noise * 120);
        ctx.font = 'bold 7px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'center';
        ctx.fillText('LUGN', 294, 138); ctx.fillText('LJUD', 308, 138);
        if (calm >= need) { SK.audio.heart(0); SK.audio.play('ok'); setTimeout(() => { close(); resolve(true); }, 400); return false; }
        if (noise >= 1) { SK.audio.heart(0); SK.audio.play('scare'); SK.fx('redflash'); setTimeout(() => { close(); resolve(false); }, 700); return false; }
      });
    });
  };

  // ---------- 3. Kodlåset ----------
  M.kodlas = function (opts) {
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', opts.title || 'KODLÅS'));
      box.appendChild(SK.el('p', 'm-help', opts.help || 'Skriv in fyra siffror.'));
      const disp = SK.el('div', 'code-display', '____');
      box.appendChild(disp);
      const pad = SK.el('div', 'keypad');
      box.appendChild(pad);
      const hint = SK.el('p', 'm-help', '');
      box.appendChild(hint);
      let code = '', wrong = 0, done = false;
      const show = () => { disp.textContent = (code + '____').slice(0, 4); };
      const press = (k) => {
        if (done) return;
        SK.audio.play('click');
        if (k === '⌫') { code = code.slice(0, -1); show(); return; }
        if (k === '✓') { check(); return; }
        if (code.length < 4) code += k;
        show();
        if (code.length === 4) setTimeout(check, 250);
      };
      const check = () => {
        if (done || code.length < 4) return;
        if (code === opts.code) {
          done = true; SK.audio.play('ok'); disp.textContent = 'ÖPPEN';
          setTimeout(() => { close(); M.lastWrong = wrong; resolve(true); }, 800);
        } else {
          wrong++;
          SK.audio.play('alarm');
          disp.classList.add('bad'); disp.textContent = 'FEL';
          setTimeout(() => { disp.classList.remove('bad'); code = ''; show(); }, 700);
          if (wrong >= 2 && opts.hint) hint.innerHTML = '<span class="help">' + opts.hint + '</span>';
          if (wrong >= 5) hint.innerHTML = '<span class="help">Koden är ' + opts.code + '.</span>';
        }
      };
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].forEach((k) => {
        const b = SK.el('button', '', k);
        b.addEventListener('click', () => press(k));
        pad.appendChild(b);
      });
      loop(() => {
        if (done) return false;
        for (let d = 0; d <= 9; d++) {
          if (SK.input.keys.has('Digit' + d) || SK.input.keys.has('Numpad' + d)) {
            if (!M._k || M._k !== d) { M._k = d; press(String(d)); }
            return;
          }
        }
        if (SK.input.keys.has('Backspace')) { if (M._k !== 'b') { M._k = 'b'; press('⌫'); } return; }
        M._k = null;
      });
    });
  };

  // ---------- 4. Hjärtrytmen ----------
  M.hjarta = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', opts.title || 'VAR LUGN'));
      box.appendChild(SK.el('p', 'm-help', opts.help || 'Tryck precis när ringen når hjärtat. Missa inte för många – då märker alla att du är rädd.'));
      const c = pixelCanvas(box, 320, 140);
      const ctx = c.getContext('2d');
      const btn = holdButton('TRYCK (mellanslag)', box);
      const beats = opts.beats || 12, bpm = opts.bpm || 76;
      const interval = 60 / bpm;
      let t = -1.2, hits = 0, miss = 0, idx = 0, lastPress = 0, flash = 0, flashOk = true, done = false;
      const judged = new Array(beats).fill(false);
      loop((dt) => {
        t += dt;
        btn.poll();
        const pressed = btn.presses > lastPress;
        lastPress = btn.presses;
        // vilken slag är närmast?
        if (pressed) {
          let best = -1, bd = 9;
          for (let i = 0; i < beats; i++) { if (judged[i]) continue; const d = Math.abs(t - i * interval); if (d < bd) { bd = d; best = i; } }
          if (best >= 0 && bd < 0.16) { judged[best] = true; hits++; flash = 0.25; flashOk = true; SK.audio.play('heart', 0.5); }
          else { miss++; flash = 0.25; flashOk = false; SK.audio.play('gasp'); }
        }
        for (let i = 0; i < beats; i++) if (!judged[i] && t - i * interval > 0.2) { judged[i] = true; miss++; flash = 0.25; flashOk = false; }
        idx = judged.filter(Boolean).length;
        flash = Math.max(0, flash - dt);
        // rita
        ctx.fillStyle = '#050407'; ctx.fillRect(0, 0, 320, 140);
        const cx = 160, cy = 70;
        for (let i = 0; i < beats; i++) {
          if (judged[i]) continue;
          const dt0 = i * interval - t;
          if (dt0 < -0.2 || dt0 > 2) continue;
          const r = 14 + dt0 * 46;
          ctx.strokeStyle = 'rgba(212,242,90,' + (1 - dt0 / 2) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2); ctx.stroke();
        }
        const pulse = 1 + (flash > 0 ? 0.25 : 0);
        ctx.fillStyle = flash > 0 ? (flashOk ? SK.EYE : '#ff4a4a') : '#c0262d';
        ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse);
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-14, -4, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -4, 0, 6); ctx.fill();
        ctx.restore();
        ctx.font = 'bold 9px "Courier New", monospace'; ctx.fillStyle = '#aaa'; ctx.textAlign = 'left';
        ctx.fillText('LUGN ' + hits, 10, 16); ctx.textAlign = 'right'; ctx.fillStyle = miss > (opts.maxMiss || 4) - 2 ? '#ff6a5a' : '#aaa';
        ctx.fillText('PANIK ' + miss + '/' + (opts.maxMiss || 4), 310, 16);
        if (!done && miss > (opts.maxMiss || 4) - 1 + 0) {
          if (miss >= (opts.maxMiss || 4)) { done = true; SK.audio.play('fail'); setTimeout(() => { close(); resolve(false); }, 600); return false; }
        }
        if (!done && idx >= beats) { done = true; SK.audio.play('ok'); setTimeout(() => { close(); resolve(true); }, 500); return false; }
      });
    });
  };

  // ---------- 5. Hitta det riktiga meddelandet ----------
  M.notiser = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', 'HITTA TILDA'));
      box.appendChild(SK.el('p', 'm-help', opts.help || 'Pantern skickar falska meddelanden. Ett av dem är verkligen från Tilda. Tryck på det – men akta dig för fejkerna.'));
      const phone = SK.el('div', 'home');
      phone.style.background = '#0b0b0e';
      box.appendChild(phone);
      const timer = SK.el('div', '', '');
      Object.assign(timer.style, { position: 'absolute', top: '2%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: '.7em', color: '#ffd2a0', zIndex: 3 });
      phone.appendChild(timer);
      const fakes = [
        ['TILDA', 'KOM TILL KÄLLAREN. NU.'], ['Tilda 🐆', 'jag väntar på dig i gympasalen'], ['TiIda', 'Allt är förlåtet. Kom ensam.'],
        ['Tilda', 'Jag har berättat för alla om dig. 🐆'], ['Panterappen', 'Nytt uppdrag väntar.'], ['Tlida', 'var e du?? svara!!!'],
        ['Mamma', 'Pantern sa att du har varit stygg.'], ['Tilda', 'JAG SER DIG'], ['Ruben', 'spring kasper spring'], ['Tilda.', 'kom till skogen efter skolan'],
      ];
      const real = ['Tilda', 'Bibblan, bakom hyllan med deckare. Kom NU. Appen ljuger. /T'];
      let t = 0, spawnT = 0, n = 0, time = opts.time || 16, done = false, realShown = 0;
      const cards = [];
      const finish = (ok) => {
        if (done) return; done = true;
        setTimeout(() => { close(); resolve(ok); }, ok ? 700 : 900);
      };
      const spawn = () => {
        n++;
        const isReal = (n === 5 || n === 11 || n === 16) && realShown < 3;
        if (isReal) realShown++;
        const [from, text] = isReal ? real : SK.pick(fakes);
        const card = SK.el('div', 'bub o', '<b>' + SK.esc(from) + '</b>' + SK.esc(text));
        Object.assign(card.style, { position: 'absolute', left: SK.rand(4, 20) + '%', width: '76%', top: '-20%', fontSize: '.62em', cursor: 'pointer', animation: 'none' });
        phone.appendChild(card);
        const c = { el: card, y: -20, real: isReal, v: SK.rand(16, 22) };
        card.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (done) return;
          if (c.real) { card.style.borderColor = SK.EYE; card.style.background = '#1a2a0a'; SK.audio.play('ok'); finish(true); }
          else {
            SK.audio.play('scare'); SK.fx('redflash');
            card.innerHTML = '<b>PANTERN</b>Fel. 🐆'; card.classList.add('red');
            time -= 3;
          }
        });
        cards.push(c);
      };
      loop((dt) => {
        if (done) return false;
        t += dt; time -= dt; spawnT -= dt;
        timer.textContent = Math.max(0, Math.ceil(time)) + ' s';
        if (spawnT <= 0) { spawn(); spawnT = 0.75; SK.audio.play('msg'); }
        cards.forEach((c) => { c.y += c.v * dt; c.el.style.top = c.y + '%'; });
        while (cards.length && cards[0].y > 105) cards.shift().el.remove();
        if (time <= 0) { SK.audio.play('fail'); finish(false); return false; }
      });
    });
  };

  // ---------- 6. Finalen: rösterna mot mörkret ----------
  M.rosterna = function (opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const { box } = open();
      box.appendChild(SK.el('h3', '', 'SÄG SANNINGEN'));
      box.appendChild(SK.el('p', 'm-help', 'Tryck så snabbt du kan. Varje tryck är ett ord. Mörkret vill att du ska tystna.'));
      const c = pixelCanvas(box, 320, 140);
      const ctx = c.getContext('2d');
      const btn = holdButton('PRATA! (mellanslag)', box);
      const line = SK.el('p', 'm-help', '&nbsp;');
      line.style.minHeight = '2.6em';
      box.appendChild(line);
      const allies = opts.allies || 0;
      const lines = opts.lines || [];
      let meter = 0.12, t = 0, last = 0, li = 0, done = false;
      SK.audio.music('final');
      loop((dt) => {
        t += dt;
        btn.poll();
        const pr = btn.presses - last; last = btn.presses;
        meter += pr * (0.034 + allies * 0.006);
        const push = 0.07 + t * 0.004 - allies * 0.012;
        meter -= Math.max(0.04, push) * dt;
        meter = SK.clamp(meter, 0, 1);
        const want = Math.floor(meter * (lines.length + 1));
        if (want > li && li < lines.length) { line.innerHTML = lines[li]; li++; SK.audio.play('crowd'); }
        // rita
        ctx.fillStyle = '#050407'; ctx.fillRect(0, 0, 320, 140);
        const g = ctx.createRadialGradient(160, 80, 4, 160, 80, 30 + meter * 200);
        g.addColorStop(0, 'rgba(255,245,220,0.95)'); g.addColorStop(0.5, 'rgba(255,230,180,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 140);
        for (let i = 0; i < 16; i++) {
          const x = 10 + i * 20, lit = i / 16 < meter;
          ctx.fillStyle = '#07050a'; ctx.beginPath(); ctx.arc(x, 118, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 8, 122, 16, 20);
          if (lit) SK.glowDot(ctx, x, 110, 10, 'rgba(255,240,200,0.8)', 1);
          else SK.glowDot(ctx, x + 2, 124, 6, 'rgba(212,242,90,0.6)', 0.7);
        }
        SK.drawPerson(ctx, 160, 100, SK.LOOKS.kasper, 'd', 0, { scale: 2, mouth: 'o' });
        const s = 1.6 - meter * 1.1;
        if (s > 0.2) {
          ctx.globalAlpha = SK.clamp(1.1 - meter, 0, 1);
          SK.drawPantherFace(ctx, 160, 40, s * 0.8, t, { teeth: meter < 0.5, open: 1 });
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#222'; ctx.fillRect(20, 6, 280, 6);
        ctx.fillStyle = meter > 0.8 ? '#fff6d8' : SK.EYE; ctx.fillRect(20, 6, 280 * meter, 6);
        if (!done && meter >= 1) {
          done = true; SK.audio.play('win'); SK.fx('flash');
          setTimeout(() => { close(); resolve(true); }, 900); return false;
        }
        if (!done && t > (opts.time || 38)) {
          done = true; SK.audio.play('fail');
          setTimeout(() => { close(); resolve(false); }, 700); return false;
        }
      });
    });
  };

  // Testläge: automatiska tester kan hoppa över minispelen.
  Object.keys(M).forEach((k) => {
    const f = M[k];
    if (typeof f !== 'function' || k === 'close') return;
    M[k] = (o) => (M.autopass ? Promise.resolve(M.autopass !== 'fail') : f(o));
  });
})();
