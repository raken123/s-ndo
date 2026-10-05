/* Motey Spelläge (example 4): the meeting becomes a side-scrolling office level.
 * Every wall is a concept from the meeting (F-skatt, moms …). Motey walks with
 * you, explains the wall and how to break it; answer right and it crumbles. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const VW = 960, VH = 540, FLOOR_TOP = 150, FLOOR_BOT = 480, GAP = 560;
  let alive = false, raf = 0, keyHandlers = null;

  function render(v, meeting, ui) {
    if (!meeting) return ui.pickMeeting(v, 'game', '🎮 Spelläge', 'Mötet blir ett dataspel. Spring runt med Motey, hitta väggarna (som F-skatt) och lär dig hur man krossar dem.');
    alive = true;
    const esc = ui.esc;
    const S = Store.settings;
    v.innerHTML = `<div class="row between"><a href="#/game" class="btn sm ghost">‹ Byt möte</a><span class="badge brand" id="gsrc">Bygger banan…</span></div>
      <h1 style="margin-top:12px">🎮 ${esc(meeting.title)}</h1>
      <div class="game-shell" id="shell">
        <canvas id="gc" width="${VW}" height="${VH}"></canvas>
        <div class="game-hud"><span id="h-xp">⭐ 0 XP</span><span id="h-walls">🧱 0/0</span><span id="h-facts">📄 0</span><span id="h-time">⏱ 0:00</span></div>
        <div class="game-say"><div id="g-motey"></div><div class="speech" id="g-say">Laddar…</div></div>
        <div class="dpad">
          <span></span><button data-k="up">▲</button><span></span>
          <button data-k="left">◀</button><button class="act" data-k="act">KROSSA</button><button data-k="right">▶</button>
          <span></span><button data-k="down">▼</button><span></span>
        </div>
      </div>
      <p class="small muted" style="margin-top:8px">Styr med <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> eller <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. Tryck <kbd>E</kbd> eller <kbd>Mellanslag</kbd> vid en vägg.</p>
      <div class="card"><h3>💬 Fråga Motey (Live AI)</h3><div class="row"><input type="text" id="g-q" placeholder="Vad är skillnaden på F-skatt och A-skatt?" style="flex:1"><button class="btn" id="g-ask">Fråga</button></div></div>`;
    $('#g-motey', v).innerHTML = Mascot.svg({ size: 70 });
    const canvas = $('#gc', v), c = canvas.getContext('2d');
    const keys = {};
    let level = null, walls = [], facts = [], props = [], particles = [], won = false, busy = false;
    const player = { x: 120, y: 300, w: 34, h: 52, dir: 1, step: 0 };
    const buddy = { x: 60, y: 250 };
    let xp = 0, factsGot = 0, startT = performance.now(), cam = 0, worldW = 2000, sayTimer = 0;

    function say(text, opts) {
      const el = $('#g-say', v); if (!el) return;
      el.textContent = text;
      const svg = $('#g-motey .motey-svg', v);
      if (opts && opts.voice) { svg && svg.classList.add('is-talking'); Platform.stopSpeaking(); Platform.speak(text, { onend: () => svg && svg.classList.remove('is-talking') }); }
      clearTimeout(sayTimer);
    }
    const hud = () => {
      $('#h-xp', v).textContent = `⭐ ${xp} XP`;
      $('#h-walls', v).textContent = `🧱 ${walls.filter(w => w.state !== 'solid').length}/${walls.length}`;
      $('#h-facts', v).textContent = `📄 ${factsGot}`;
    };

    async function build() {
      let r;
      try { r = await AI.gameLevel(meeting); }
      catch (e) { if (e instanceof Plans.QuotaError) { say('Månadens kvot räcker inte för en ny bana. Uppgradera så spelar vi! 🎮'); return; } throw e; }
      if (!alive) return;
      level = r.value;
      $('#gsrc', v).textContent = r.source === 'gemini' ? 'Bana: Gemini 3.8 Flash' : 'Bana: Offline-AI';
      walls = level.walls.map((w, i) => Object.assign({}, w, { x: 520 + i * GAP, state: 'solid', shake: 0, t: 0 }));
      worldW = 520 + walls.length * GAP + 420;
      facts = level.facts.map((f, i) => ({ text: f, x: 330 + i * (worldW - 700) / Math.max(1, level.facts.length), y: FLOOR_TOP + 40 + ((i * 97) % (FLOOR_BOT - FLOOR_TOP - 90)), got: false }));
      props = [];
      for (let x = 260; x < worldW - 300; x += 190) {
        if (walls.some(w => Math.abs(w.x - x) < 120)) continue;
        const k = (x / 190) % 3 | 0;
        props.push({ kind: ['desk', 'plant', 'coffee'][k], x, y: k === 0 ? 400 : k === 1 ? 190 : 410 });
      }
      hud();
      const name = AI.firstName(S.name);
      say(walls.length
        ? `Välkommen till ${meeting.title}, ${name}! Det känns som ett dataspel, men allt är på riktigt. Vi måste ta oss förbi ${walls.length} väggar. Den första är ${walls[0].term}. Spring åt höger!`
        : 'Hmm, jag hittade inga begrepp i mötet. Lägg till ett transkript så bygger jag en bana!', { voice: true });
      startT = performance.now();
      loop(performance.now());
    }

    /* ---------- physics ---------- */
    function update(dt) {
      if (busy || won) return;
      const sp = 260 * dt;
      let dx = 0, dy = 0;
      if (keys.left) dx -= sp; if (keys.right) dx += sp; if (keys.up) dy -= sp; if (keys.down) dy += sp;
      if (dx && dy) { dx *= 0.707; dy *= 0.707; }
      if (dx) player.dir = Math.sign(dx);
      player.step += (dx || dy) ? dt * 10 : 0;
      let nx = Math.max(10, Math.min(worldW - player.w - 10, player.x + dx));
      const ny = Math.max(FLOOR_TOP, Math.min(FLOOR_BOT - player.h, player.y + dy));
      for (const w of walls) if (w.state === 'solid' && player.x < w.x && nx + player.w > w.x - 4) nx = w.x - 4 - player.w;
      player.x = nx; player.y = ny;
      // buddy follows
      buddy.x += (player.x - 60 * player.dir - buddy.x) * Math.min(1, dt * 3);
      buddy.y += (player.y - 50 - buddy.y) * Math.min(1, dt * 3);
      cam += (Math.max(0, Math.min(worldW - VW, player.x - VW * 0.4)) - cam) * Math.min(1, dt * 6);
      // facts
      for (const f of facts) if (!f.got && Math.abs(f.x - player.x) < 40 && Math.abs(f.y - player.y - 10) < 50) {
        f.got = true; factsGot++; xp += 25; hud();
        say('📄 Fakta från mötet: ' + f.text);
        burst(f.x, f.y, '#FFE14D', 14);
      }
      // near a wall?
      const near = nearWall();
      if (near && !near.hinted) { near.hinted = true; say(`${near.icon} Det här är ${near.term}-väggen! Tryck KROSSA (E) så förklarar jag hur vi förstör den.`, { voice: true }); }
      // goal
      if (!walls.some(w => w.state === 'solid') && player.x > worldW - 300 && walls.length) win();
      for (const w of walls) { if (w.shake > 0) w.shake -= dt; if (w.state === 'breaking') { w.t += dt; if (w.t > 0.6) w.state = 'broken'; } }
      particles = particles.filter(p => (p.life -= dt) > 0);
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.r *= 0.995; });
      $('#h-time', v).textContent = '⏱ ' + fmtTime((performance.now() - startT) / 1000);
    }
    const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const nearWall = () => walls.find(w => w.state === 'solid' && w.x - (player.x + player.w) < 50 && w.x - (player.x + player.w) > -10);
    function burst(x, y, color, n) {
      for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 600, vy: -Math.random() * 500, r: 6 + Math.random() * 8, life: 0.8 + Math.random() * 0.6, color });
    }

    /* ---------- the wall challenge ---------- */
    function challenge(w) {
      busy = true;
      Object.keys(keys).forEach(k => { keys[k] = false; });
      const sh = App.sheet(`<div class="motey-stage">${Mascot.svg({ size: 84, mood: 'wow', talking: true })}<div class="speech"><b>${esc(w.icon)} ${esc(w.term)}</b><br>${esc(w.explain)}</div></div>
        <div class="card" style="margin-top:14px;box-shadow:none"><h3>🔨 Så förstör du väggen</h3><p style="margin:0">${esc(w.howTo)}</p></div>
        <h3>${esc(w.q)}</h3><div id="opts">${w.opts.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`);
      Platform.speak(`${w.term}. ${w.explain} Så förstör du väggen: ${w.howTo} ${w.q}`);
      const done = () => { busy = false; Platform.stopSpeaking(); };
      const origClose = sh.close;
      sh.el.parentElement.querySelector('.close').addEventListener('click', done);
      sh.el.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (i === w.a) {
          b.classList.add('right');
          setTimeout(() => {
            origClose(); done();
            w.state = 'breaking'; w.t = 0; xp += 100; hud();
            Store.state.stats.wallsBroken++; Store.save();
            for (let k = 0; k < 4; k++) burst(w.x + 30, FLOOR_TOP + 40 + k * 80, k % 2 ? '#C2410C' : '#F97316', 16);
            const left = walls.filter(x => x.state === 'solid');
            say(left.length ? `BOOM! 💥 ${w.term}-väggen är krossad! Nästa: ${left[0].term}.` : 'BOOM! 💥 Alla väggar är borta! Spring till mötesrummet längst till höger! 🏁', { voice: true });
          }, 650);
        } else {
          b.classList.add('wrong'); xp = Math.max(0, xp - 10); hud(); w.shake = 0.4;
          Platform.stopSpeaking(); Platform.speak('Nästan! Läs förklaringen en gång till.');
        }
      }));
    }

    function win() {
      won = true;
      const secs = (performance.now() - startT) / 1000;
      Platform.speak(`Grattis ${AI.firstName(S.name)}! Du klarade ${meeting.title} på ${Math.round(secs)} sekunder.`);
      const sh = App.sheet(`<div style="text-align:center">${Mascot.svg({ size: 120, mood: 'wink' })}<h1>Banan klarad! 🏆</h1>
        <p class="muted">⭐ ${xp} XP · 🧱 ${walls.length} väggar · 📄 ${factsGot} fakta · ⏱ ${fmtTime(secs)}</p></div>
        <h3>Det här lärde du dig</h3><ul class="clean">${walls.map(w => `<li data-ico="${esc(w.icon)}"><b>${esc(w.term)}</b> – ${esc(w.howTo)}</li>`).join('')}</ul>
        <div class="row" style="margin-top:12px"><button class="btn" id="again">Spela igen</button><a class="btn ghost" href="#/m/${meeting.id}">Till mötet</a></div>`);
      $('#again', sh.el).addEventListener('click', () => { sh.close(); App.go('#/game/' + meeting.id); });
    }

    /* ---------- drawing ---------- */
    function draw(now) {
      const t = now / 1000;
      c.save();
      c.fillStyle = '#2A2350'; c.fillRect(0, 0, VW, VH);
      c.translate(-Math.round(cam), 0);
      // back wall with windows and posters
      c.fillStyle = '#3B3170'; c.fillRect(cam - 10, 0, VW + 20, FLOOR_TOP);
      for (let x = Math.floor(cam / 240) * 240; x < cam + VW + 240; x += 240) {
        c.fillStyle = '#8EC5FF'; c.fillRect(x + 40, 26, 120, 80);
        c.fillStyle = '#B9DCFF'; c.fillRect(x + 40, 26, 58, 80);
        c.strokeStyle = '#1E1B3A'; c.lineWidth = 6; c.strokeRect(x + 40, 26, 120, 80);
        c.beginPath(); c.moveTo(x + 100, 26); c.lineTo(x + 100, 106); c.stroke();
      }
      // floor tiles
      for (let x = Math.floor(cam / 60) * 60; x < cam + VW + 60; x += 60) for (let y = FLOOR_TOP; y < FLOOR_BOT + 60; y += 60) {
        c.fillStyle = ((x / 60 + y / 60) & 1) ? '#E7E2FF' : '#D9D2FB'; c.fillRect(x, y, 60, 60);
      }
      c.fillStyle = '#1E1B3A'; c.fillRect(cam - 10, FLOOR_BOT + 20, VW + 20, VH);
      // goal
      const gx = worldW - 230;
      c.fillStyle = '#19C79A'; c.fillRect(gx, FLOOR_TOP - 110, 150, 110);
      c.fillStyle = '#fff'; c.font = '900 22px system-ui'; c.textAlign = 'center'; c.fillText('🏁 MÖTES-', gx + 75, FLOOR_TOP - 62); c.fillText('RUMMET', gx + 75, FLOOR_TOP - 34);
      // props
      for (const p of props) drawProp(p, t);
      // facts
      for (const f of facts) if (!f.got) {
        const y = f.y + Math.sin(t * 3 + f.x) * 6;
        c.fillStyle = 'rgba(255,225,77,.35)'; c.beginPath(); c.arc(f.x, y, 26, 0, 7); c.fill();
        c.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.fillText('📄', f.x, y + 10);
      }
      // walls
      for (const w of walls) drawWall(w, t);
      // characters (sorted by y for depth)
      drawPlayer(t);
      TikTokMode.drawMotey(c, buddy.x + 10, buddy.y + Math.sin(t * 4) * 6, 0.36, t, false);
      // particles
      for (const p of particles) { c.fillStyle = p.color; c.globalAlpha = Math.min(1, p.life * 2); c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
      c.globalAlpha = 1;
      c.restore();
      if (!busy && nearWall()) {
        c.fillStyle = 'rgba(255,122,89,.95)'; c.font = '900 20px system-ui'; c.textAlign = 'center';
        const tx = player.x - cam + 17, ty = player.y - 34 + Math.sin(t * 6) * 4;
        rrect(tx - 74, ty - 22, 148, 32, 16); c.fill(); c.fillStyle = '#fff'; c.fillText('E = KROSSA!', tx, ty);
      }
    }
    function rrect(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    function drawWall(w, t) {
      if (w.state === 'broken') {
        c.fillStyle = '#B45309'; for (let i = 0; i < 6; i++) c.fillRect(w.x - 20 + i * 18, FLOOR_BOT - 6 - (i % 2) * 8, 16, 10);
        return;
      }
      const sx = w.shake > 0 ? Math.sin(t * 80) * 6 : 0;
      const k = w.state === 'breaking' ? 1 - w.t / 0.6 : 1;
      c.save(); c.translate(w.x + sx, 0); c.globalAlpha = Math.max(0, k);
      const top = FLOOR_TOP - 110, h = FLOOR_BOT - top + 20;
      for (let row = 0; row * 26 < h; row++) for (let col = -1; col < 3; col++) {
        const bx = col * 30 + (row % 2) * 15, by = top + row * 26;
        if (bx < 0 || bx > 45) continue;
        c.fillStyle = (row + col) % 3 ? '#E2683C' : '#C2410C'; c.fillRect(bx, by, 28, 24);
      }
      c.strokeStyle = '#1E1B3A'; c.lineWidth = 4; c.strokeRect(0, top, 60, h);
      // label
      c.save(); c.translate(30, (top + FLOOR_BOT) / 2); c.rotate(-Math.PI / 2);
      c.fillStyle = '#fff'; c.strokeStyle = '#1E1B3A'; c.lineWidth = 6; c.font = '900 30px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = (w.term || '').toUpperCase();
      c.strokeText(label, 0, 0); c.fillText(label, 0, 0); c.restore();
      c.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.fillText(w.icon || '🧱', 30, top - 8);
      c.restore();
    }
    function drawProp(p, t) {
      c.save(); c.translate(p.x, p.y);
      if (p.kind === 'desk') {
        c.fillStyle = '#8B5E3C'; c.fillRect(-50, 0, 100, 18); c.fillRect(-44, 18, 10, 40); c.fillRect(34, 18, 10, 40);
        c.fillStyle = '#1E1B3A'; c.fillRect(-22, -38, 44, 30); c.fillStyle = '#8EC5FF'; c.fillRect(-18, -34, 36, 22); c.fillStyle = '#1E1B3A'; c.fillRect(-4, -8, 8, 8);
      } else if (p.kind === 'plant') {
        c.fillStyle = '#C2410C'; c.fillRect(-16, 10, 32, 30);
        c.fillStyle = '#19C79A'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(i * 9, -6 - Math.abs(i) * -4, 8, 24, i * 0.35 + Math.sin(t * 2) * 0.05, 0, 7); c.fill(); }
      } else {
        c.fillStyle = '#5B5878'; c.fillRect(-20, -40, 40, 70); c.fillStyle = '#FFC93C'; c.fillRect(-12, -30, 24, 10);
        c.fillStyle = '#fff'; c.fillRect(-8, 0, 16, 18); c.globalAlpha = 0.6; c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -6 - (t * 20 % 14), 4, 0, 7); c.fill(); c.globalAlpha = 1;
      }
      c.restore();
    }
    function drawPlayer(t) {
      const x = player.x, y = player.y, d = player.dir, sw = Math.sin(player.step) * 8;
      c.save(); c.translate(x + 17, y);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 54, 22, 6, 0, 0, 7); c.fill();
      c.strokeStyle = '#1E1B3A'; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-7, 34); c.lineTo(-7 + sw, 52); c.moveTo(7, 34); c.lineTo(7 - sw, 52); c.stroke();
      c.fillStyle = '#FF7A59'; rrect(-17, 8, 34, 32, 10); c.fill();
      c.strokeStyle = '#F2C29B'; c.lineWidth = 7; c.beginPath(); c.moveTo(-15, 14); c.lineTo(-20, 30 - sw / 2); c.moveTo(15, 14); c.lineTo(20, 30 + sw / 2); c.stroke();
      c.fillStyle = '#F2C29B'; c.beginPath(); c.arc(0, -6, 16, 0, 7); c.fill();
      c.fillStyle = '#6C4CF5'; c.beginPath(); c.arc(0, -10, 16, Math.PI, 0); c.fill(); c.fillRect(d > 0 ? 4 : -22, -12, 18, 5);
      c.fillStyle = '#1E1B3A'; c.beginPath(); c.arc(5 * d, -4, 2.6, 0, 7); c.fill(); c.beginPath(); c.arc(-6 * d, -4, 2.6, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = '800 13px system-ui'; c.textAlign = 'center'; c.fillText(AI.firstName(S.name), 0, -30);
      c.restore();
    }

    let last = performance.now();
    function loop(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      update(dt); draw(now);
      raf = requestAnimationFrame(loop);
    }

    /* ---------- input ---------- */
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const act = () => { if (busy || won) return; const w = nearWall(); if (w) challenge(w); else say('Gå fram till en vägg först! 🧱'); };
    const kd = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (map[e.key]) { keys[map[e.key]] = true; e.preventDefault(); }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(); }
    };
    const ku = e => { if (map[e.key]) keys[map[e.key]] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    keyHandlers = [kd, ku];
    v.querySelectorAll('.dpad button').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (k === 'act') act(); else keys[k] = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { if (k !== 'act') keys[k] = false; }));
    });
    // tap on the canvas walks toward the tap
    canvas.addEventListener('pointerdown', e => {
      const r = canvas.getBoundingClientRect();
      const tx = (e.clientX - r.left) / r.width * VW + cam, ty = (e.clientY - r.top) / r.height * VH;
      const w = nearWall();
      if (w && Math.abs(tx - w.x) < 90) return act();
      keys.left = tx < player.x; keys.right = tx > player.x + player.w; keys.up = ty < player.y; keys.down = ty > player.y + player.h;
      setTimeout(() => { keys.left = keys.right = keys.up = keys.down = false; }, 350);
    });
    $('#g-ask', v).addEventListener('click', async () => {
      const q = $('#g-q', v).value.trim(); if (!q) return;
      say('Motey tänker… 🤔');
      let r;
      try { r = await AI.ask(q, meeting); } catch (e) { if (e instanceof Plans.QuotaError) return say('Kvoten är slut för den här månaden.'); throw e; }
      if (alive) say(r.value, { voice: true });
    });
    $('#g-q', v).addEventListener('keydown', e => { if (e.key === 'Enter') $('#g-ask', v).click(); });

    build();
  }

  function destroy() {
    alive = false; cancelAnimationFrame(raf);
    if (keyHandlers) { window.removeEventListener('keydown', keyHandlers[0]); window.removeEventListener('keyup', keyHandlers[1]); keyHandlers = null; }
  }

  window.GameMode = { render, destroy };
})();
