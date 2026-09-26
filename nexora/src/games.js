/* Nexora game templates used by the offline generator ("Nexora Local").
 *
 * Like runtime.js, each function is serialized into the exported game with
 * toString(), so it may only use its argument R and the runtime helpers
 * (nxRng, nxNoise, nxShade, Nx3D).
 */

function gamePlatformer(R) {
  const P = R.pal, C = R.CFG, G = 1900, TILE = 32;
  let pl, plats, coins, foes, camX, genX, rng, deco;
  function gen(until) {
    while (genX < until) {
      const gap = 60 + rng() * (90 + C.difficulty * 40), w = 120 + rng() * 260;
      const last = plats[plats.length - 1];
      const y = Math.max(R.H * 0.35, Math.min(R.H - 70, last.y + (rng() - 0.5) * 170));
      const p = { x: genX + gap, y, w, h: R.H - y + 40 };
      plats.push(p);
      const nc = Math.floor(rng() * 4);
      for (let i = 0; i < nc; i++) coins.push({ x: p.x + 30 + i * 34, y: p.y - 46 - (rng() < 0.3 ? 60 : 0), got: false, t: rng() * 6 });
      if (w > 180 && rng() < 0.35 + C.difficulty * 0.12) foes.push({ x: p.x + w / 2, y: p.y - 26, min: p.x + 8, max: p.x + w - 34, vx: 60 + rng() * 60, dead: false });
      if (rng() < 0.3) {
        const fy = p.y - 110 - rng() * 60;
        plats.push({ x: p.x + w * 0.3, y: fy, w: 90 + rng() * 60, h: 16, thin: true });
        coins.push({ x: p.x + w * 0.3 + 30, y: fy - 40, got: false, t: 0 });
      }
      genX = p.x + w;
    }
  }
  return {
    reset() {
      rng = nxRng(C.seed);
      pl = { x: 80, y: R.H - 200, vx: 0, vy: 0, w: 26, h: 34, ground: false, coyote: 0, jumps: 0, face: 1 };
      plats = [{ x: -200, y: R.H - 90, w: 700, h: 200 }];
      coins = []; foes = []; camX = 0; genX = 500;
      deco = Array.from({ length: 40 }, () => ({ x: rng() * 3000, y: rng() * R.H * 0.6, s: 0.5 + rng() * 2 }));
      gen(R.W * 3);
    },
    update(dt) {
      const k = R.input();
      const acc = 2600, max = 260 + C.difficulty * 30;
      if (k.left) { pl.vx -= acc * dt; pl.face = -1; }
      else if (k.right) { pl.vx += acc * dt; pl.face = 1; }
      else pl.vx *= Math.pow(0.0008, dt);
      pl.vx = Math.max(-max, Math.min(max, pl.vx));
      pl.coyote -= dt;
      if ((R.hit('up') || R.hit('action')) && (pl.coyote > 0 || pl.jumps < (C.doubleJump ? 2 : 1))) {
        pl.vy = -680; pl.coyote = 0; pl.jumps++; R.sfx('jump');
      }
      if (!(k.up || k.action) && pl.vy < -250) pl.vy += G * dt * 1.2; // short hop
      pl.vy += G * dt; pl.x += pl.vx * dt;
      const oy = pl.y; pl.y += pl.vy * dt; pl.ground = false;
      for (const p of plats) {
        if (pl.x + pl.w > p.x && pl.x < p.x + p.w) {
          if (oy + pl.h <= p.y + 2 && pl.y + pl.h >= p.y && pl.vy >= 0) {
            pl.y = p.y - pl.h; pl.vy = 0; pl.ground = true; pl.coyote = 0.1; pl.jumps = 0;
          } else if (!p.thin && pl.y + pl.h > p.y + 4 && pl.y < p.y + p.h) {
            pl.x = pl.vx > 0 ? p.x - pl.w : p.x + p.w; pl.vx = 0;
          }
        }
      }
      if (pl.x < camX) { pl.x = camX; pl.vx = 0; }
      for (const c of coins) {
        c.t += dt;
        if (!c.got && Math.abs(pl.x + 13 - c.x) < 24 && Math.abs(pl.y + 17 - c.y) < 28) { c.got = true; R.add(10); R.sfx('coin'); R.burst(c.x, c.y, P.coin, 10); }
      }
      for (const f of foes) {
        if (f.dead) continue;
        f.x += f.vx * dt; if (f.x < f.min || f.x > f.max) f.vx *= -1;
        if (pl.x + pl.w > f.x && pl.x < f.x + 28 && pl.y + pl.h > f.y && pl.y < f.y + 26) {
          if (pl.vy > 0 && pl.y + pl.h - f.y < 18) { f.dead = true; pl.vy = -520; R.add(50); R.sfx('hit'); R.burst(f.x + 14, f.y + 13, P.enemy, 16); }
          else { R.burst(pl.x, pl.y, P.player, 24); R.over(); }
        }
      }
      if (pl.y > R.H + 80) R.over();
      camX = Math.max(camX, pl.x - R.W * 0.35);
      R.score = Math.max(R.score, Math.floor(camX / 10) + coins.filter(c => c.got).length * 10 + foes.filter(f => f.dead).length * 50);
      gen(camX + R.W * 2);
      plats = plats.filter(p => p.x + p.w > camX - 200);
      coins = coins.filter(c => c.x > camX - 100); foes = foes.filter(f => f.x > camX - 100);
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, R.H);
      g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
      ctx.fillStyle = P.deco;
      for (const d of deco) { const x = ((d.x - camX * 0.2 * d.s * 0.3) % 3000 + 3000) % 3000 - 200; ctx.globalAlpha = 0.25 + d.s * 0.1; ctx.beginPath(); ctx.arc(x, d.y, d.s * 2.2, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 0.35; ctx.fillStyle = P.bg2;
      for (let i = -1; i < R.W / 240 + 2; i++) { const x = i * 240 - (camX * 0.4) % 240; ctx.beginPath(); ctx.moveTo(x, R.H); ctx.lineTo(x + 120, R.H * 0.55); ctx.lineTo(x + 240, R.H); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(-camX, 0);
      for (const p of plats) {
        ctx.fillStyle = P.ground; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = P.top; ctx.fillRect(p.x, p.y, p.w, p.thin ? 6 : 10);
        if (!p.thin) { ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let x = p.x; x < p.x + p.w; x += TILE) ctx.fillRect(x, p.y + 14, 2, p.h); }
      }
      for (const c of coins) if (!c.got) {
        ctx.fillStyle = P.coin; ctx.beginPath(); ctx.ellipse(c.x, c.y + Math.sin(c.t * 4) * 3, 9 * Math.abs(Math.cos(c.t * 3)) + 2, 10, 0, 0, 7); ctx.fill();
      }
      for (const f of foes) if (!f.dead) {
        ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.roundRect(f.x, f.y, 28, 26, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(f.x + 6, f.y + 7, 5, 6); ctx.fillRect(f.x + 17, f.y + 7, 5, 6);
      }
      ctx.fillStyle = P.player; ctx.beginPath(); ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(pl.x + (pl.face > 0 ? 15 : 5), pl.y + 9, 6, 7);
      ctx.fillStyle = '#111'; ctx.fillRect(pl.x + (pl.face > 0 ? 18 : 6), pl.y + 11, 3, 4);
      ctx.restore();
      R.drawParticles(camX, 0);
    },
  };
}

function gameShooter(R) {
  const P = R.pal, C = R.CFG;
  let pl, shots, foes, eshots, stars, powers, spawnT, fireT, boss, wave;
  function spawn() {
    const pattern = Math.floor(R.rng() * 3), n = 3 + Math.floor(R.rng() * (3 + C.difficulty));
    const x0 = 60 + R.rng() * (R.W - 120);
    for (let i = 0; i < n; i++) foes.push({ x: pattern === 1 ? 40 + (R.W - 80) * i / n : x0, y: -40 - i * 50, hp: 1 + (wave > 4 ? 1 : 0), t: i * 0.3, pattern, base: x0, r: 16 });
  }
  return {
    reset() {
      pl = { x: R.W / 2, y: R.H - 90, spread: 0, inv: 0 };
      shots = []; foes = []; eshots = []; powers = []; spawnT = 1; fireT = 0; boss = null; wave = 0;
      stars = Array.from({ length: 120 }, () => ({ x: Math.random() * R.W, y: Math.random() * R.H, s: Math.random() * 2 + 0.5 }));
    },
    update(dt) {
      const k = R.input(), sp = 380;
      if (k.left) pl.x -= sp * dt; if (k.right) pl.x += sp * dt;
      if (k.up) pl.y -= sp * dt; if (k.down) pl.y += sp * dt;
      pl.x = Math.max(20, Math.min(R.W - 20, pl.x)); pl.y = Math.max(R.H * 0.4, Math.min(R.H - 40, pl.y));
      pl.inv -= dt; fireT -= dt;
      if (fireT <= 0 && (k.action || C.autofire)) {
        fireT = 0.16;
        shots.push({ x: pl.x, y: pl.y - 20, vx: 0 });
        if (pl.spread > 0) { shots.push({ x: pl.x, y: pl.y - 20, vx: -160 }, { x: pl.x, y: pl.y - 20, vx: 160 }); }
        R.sfx('shoot');
      }
      pl.spread -= dt;
      for (const s of stars) { s.y += s.s * 60 * dt; if (s.y > R.H) { s.y = 0; s.x = Math.random() * R.W; } }
      spawnT -= dt;
      if (spawnT <= 0 && !boss) { wave++; spawn(); spawnT = Math.max(0.9, 3 - wave * 0.12 - C.difficulty * 0.3); if (wave % 8 === 0) boss = { x: R.W / 2, y: -80, hp: 30 + wave * 3, max: 30 + wave * 3, t: 0 }; }
      for (const s of shots) { s.y -= 700 * dt; s.x += s.vx * dt; }
      shots = shots.filter(s => s.y > -20);
      for (const f of foes) {
        f.t += dt; f.y += (90 + wave * 4) * dt;
        if (f.pattern === 0) f.x = f.base + Math.sin(f.t * 2.5) * 90;
        if (f.pattern === 2 && f.y > R.H * 0.3) f.x += Math.sign(pl.x - f.x) * 120 * dt;
        if (R.rng() < dt * (0.25 + C.difficulty * 0.15)) eshots.push({ x: f.x, y: f.y, vx: (pl.x - f.x) * 0.4, vy: 220 });
      }
      if (boss) {
        boss.t += dt; boss.y = Math.min(110, boss.y + 60 * dt); boss.x = R.W / 2 + Math.sin(boss.t * 0.8) * R.W * 0.3;
        if (R.rng() < dt * 3) for (let a = -2; a <= 2; a++) eshots.push({ x: boss.x, y: boss.y + 30, vx: a * 70, vy: 240 });
      }
      for (const e of eshots) { e.x += e.vx * dt; e.y += e.vy * dt; }
      eshots = eshots.filter(e => e.y < R.H + 20);
      for (const s of shots) {
        for (const f of foes) if (f.hp > 0 && Math.hypot(s.x - f.x, s.y - f.y) < f.r + 4) {
          f.hp--; s.y = -99;
          if (f.hp <= 0) { R.add(25); R.sfx('boom'); R.burst(f.x, f.y, P.enemy, 18); if (R.rng() < 0.08) powers.push({ x: f.x, y: f.y }); }
        }
        if (boss && Math.abs(s.x - boss.x) < 60 && Math.abs(s.y - boss.y) < 34) {
          boss.hp--; s.y = -99; R.burst(s.x, s.y, P.accent, 3);
          if (boss.hp <= 0) { R.add(400); R.sfx('boom'); R.shake(0.6); R.burst(boss.x, boss.y, P.enemy, 60, 320); R.flash('Bossen besegrad!'); boss = null; }
        }
      }
      foes = foes.filter(f => f.hp > 0 && f.y < R.H + 40);
      for (const p of powers) { p.y += 120 * dt; if (Math.hypot(p.x - pl.x, p.y - pl.y) < 26) { p.y = R.H + 99; pl.spread = 8; R.sfx('power'); R.flash('Trippelskott!'); } }
      powers = powers.filter(p => p.y < R.H + 20);
      if (pl.inv <= 0) {
        const hit = eshots.some(e => Math.hypot(e.x - pl.x, e.y - pl.y) < 12) || foes.some(f => Math.hypot(f.x - pl.x, f.y - pl.y) < f.r + 10);
        if (hit) { R.burst(pl.x, pl.y, P.player, 30, 260); R.over(); }
      }
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, R.H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
      ctx.fillStyle = P.deco;
      for (const s of stars) { ctx.globalAlpha = s.s / 2.5; ctx.fillRect(s.x, s.y, s.s, s.s * 2); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.accent; for (const s of shots) ctx.fillRect(s.x - 2, s.y - 8, 4, 14);
      ctx.fillStyle = P.enemy; for (const e of eshots) { ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.fill(); }
      for (const f of foes) {
        ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.moveTo(f.x, f.y + 16); ctx.lineTo(f.x - 16, f.y - 12); ctx.lineTo(f.x, f.y - 4); ctx.lineTo(f.x + 16, f.y - 12); ctx.closePath(); ctx.fill();
      }
      if (boss) {
        ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.roundRect(boss.x - 60, boss.y - 30, 120, 60, 18); ctx.fill();
        ctx.fillStyle = P.coin; ctx.fillRect(boss.x - 30, boss.y - 6, 60, 12);
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(R.W * 0.2, 56, R.W * 0.6, 8);
        ctx.fillStyle = P.enemy; ctx.fillRect(R.W * 0.2, 56, R.W * 0.6 * boss.hp / boss.max, 8);
      }
      ctx.fillStyle = P.coin; for (const p of powers) { ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 7); ctx.fill(); }
      if (R.state !== 'over') {
        ctx.fillStyle = P.player; ctx.beginPath(); ctx.moveTo(pl.x, pl.y - 22); ctx.lineTo(pl.x - 18, pl.y + 16); ctx.lineTo(pl.x, pl.y + 8); ctx.lineTo(pl.x + 18, pl.y + 16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = P.accent; ctx.fillRect(pl.x - 4, pl.y + 12, 8, 6 + Math.random() * 8);
      }
      R.drawParticles();
    },
  };
}

function gameSnake(R) {
  const P = R.pal, C = R.CFG;
  let cell, cols, rows, snake, dir, next, food, t, walls, speed, ox, oy;
  function free() {
    for (let i = 0; i < 500; i++) {
      const p = { x: Math.floor(R.rng() * cols), y: Math.floor(R.rng() * rows) };
      if (!snake.some(s => s.x === p.x && s.y === p.y) && !walls.some(w => w.x === p.x && w.y === p.y)) return p;
    }
    return { x: 0, y: 0 };
  }
  return {
    reset() {
      cell = Math.max(18, Math.floor(Math.min(R.W, R.H - 60) / 24));
      cols = Math.floor(R.W / cell); rows = Math.floor((R.H - 60) / cell);
      ox = (R.W - cols * cell) / 2; oy = 50 + (R.H - 60 - rows * cell) / 2;
      const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      dir = { x: 1, y: 0 }; next = dir; t = 0; speed = 8 + C.difficulty * 2;
      walls = [];
      const r = nxRng(C.seed);
      for (let i = 0; i < C.difficulty * 3; i++) {
        const wx = Math.floor(r() * cols), wy = Math.floor(r() * rows), len = 3 + Math.floor(r() * 4), h = r() < 0.5;
        for (let j = 0; j < len; j++) { const w = { x: wx + (h ? j : 0), y: wy + (h ? 0 : j) }; if (Math.abs(w.y - cy) > 1) walls.push(w); }
      }
      food = free();
    },
    update(dt) {
      const k = R.input();
      if (k.left && dir.x === 0) next = { x: -1, y: 0 };
      else if (k.right && dir.x === 0) next = { x: 1, y: 0 };
      else if (k.up && dir.y === 0) next = { x: 0, y: -1 };
      else if (k.down && dir.y === 0) next = { x: 0, y: 1 };
      t += dt;
      if (t < 1 / speed) return;
      t = 0; dir = next;
      const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (C.wrap) { h.x = (h.x + cols) % cols; h.y = (h.y + rows) % rows; }
      if (h.x < 0 || h.y < 0 || h.x >= cols || h.y >= rows || snake.some(s => s.x === h.x && s.y === h.y) || walls.some(w => w.x === h.x && w.y === h.y)) {
        R.burst(ox + h.x * cell, oy + h.y * cell, P.player, 30); R.over(); return;
      }
      snake.unshift(h);
      if (h.x === food.x && h.y === food.y) {
        R.add(10); R.sfx('coin'); R.burst(ox + h.x * cell + cell / 2, oy + h.y * cell + cell / 2, P.coin, 14);
        food = free(); speed = Math.min(22, speed + 0.35);
      } else snake.pop();
    },
    draw(ctx) {
      ctx.fillStyle = P.bg2; ctx.fillRect(0, 0, R.W, R.H);
      ctx.fillStyle = P.bg1; ctx.fillRect(ox, oy, cols * cell, rows * cell);
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      for (let x = 0; x < cols; x++) for (let y = (x % 2); y < rows; y += 2) ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      ctx.fillStyle = P.ground; for (const w of walls) ctx.fillRect(ox + w.x * cell + 1, oy + w.y * cell + 1, cell - 2, cell - 2);
      ctx.fillStyle = P.coin; ctx.beginPath(); ctx.arc(ox + food.x * cell + cell / 2, oy + food.y * cell + cell / 2, cell * 0.36, 0, 7); ctx.fill();
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? P.accent : P.player; ctx.globalAlpha = 1 - i / (snake.length * 1.8);
        ctx.beginPath(); ctx.roundRect(ox + s.x * cell + 1, oy + s.y * cell + 1, cell - 2, cell - 2, cell * 0.3); ctx.fill();
      });
      ctx.globalAlpha = 1;
      R.drawParticles();
    },
  };
}

function gameBreakout(R) {
  const P = R.pal, C = R.CFG;
  let pad, balls, bricks, drops, level, lives, wide;
  function build() {
    bricks = [];
    const cols = Math.max(6, Math.floor(R.W / 80)), rows = 4 + Math.min(4, level + C.difficulty);
    const bw = (R.W - 40) / cols, r = nxRng(C.seed + level * 77);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (r() < 0.12 * (level % 3)) continue;
      bricks.push({ x: 20 + x * bw, y: 80 + y * 26, w: bw - 4, h: 20, hp: r() < 0.15 + level * 0.05 ? 2 : 1, c: y });
    }
  }
  function serve() { balls = [{ x: pad.x, y: pad.y - 14, vx: 0, vy: 0, stuck: true }]; }
  return {
    reset() { level = 0; lives = 3; wide = 0; pad = { x: R.W / 2, y: R.H - 60, w: 110 }; drops = []; build(); serve(); },
    hud() { R.text('♥'.repeat(lives), R.W / 2, 28, 20, R.pal.enemy, 'center'); },
    update(dt) {
      const k = R.input();
      if (k.left) pad.x -= 620 * dt; if (k.right) pad.x += 620 * dt;
      wide -= dt; pad.w = wide > 0 ? 180 : 110;
      pad.x = Math.max(pad.w / 2, Math.min(R.W - pad.w / 2, pad.x));
      const spd = 420 + level * 30 + C.difficulty * 40;
      for (const b of balls) {
        if (b.stuck) { b.x = pad.x; b.y = pad.y - 14; if (k.action || k.up) { b.stuck = false; b.vx = (R.rng() - 0.5) * 300; b.vy = -spd; R.sfx('jump'); } continue; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < 8) { b.x = 8; b.vx = Math.abs(b.vx); } if (b.x > R.W - 8) { b.x = R.W - 8; b.vx = -Math.abs(b.vx); }
        if (b.y < 50) { b.y = 50; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y > pad.y - 8 && b.y < pad.y + 10 && Math.abs(b.x - pad.x) < pad.w / 2 + 6) {
          const off = (b.x - pad.x) / (pad.w / 2), a = off * 1.05;
          b.vx = Math.sin(a) * spd; b.vy = -Math.cos(a) * spd; R.sfx('coin');
        }
        for (const br of bricks) {
          if (br.hp > 0 && b.x > br.x - 7 && b.x < br.x + br.w + 7 && b.y > br.y - 7 && b.y < br.y + br.h + 7) {
            br.hp--;
            const fromSide = Math.min(Math.abs(b.x - br.x), Math.abs(b.x - br.x - br.w)) < Math.min(Math.abs(b.y - br.y), Math.abs(b.y - br.y - br.h));
            if (fromSide) b.vx *= -1; else b.vy *= -1;
            if (br.hp <= 0) { R.add(10); R.burst(br.x + br.w / 2, br.y + 10, P.accent, 8); if (R.rng() < 0.1) drops.push({ x: br.x + br.w / 2, y: br.y, k: R.rng() < 0.5 ? 'multi' : 'wide' }); }
            R.sfx('hit'); break;
          }
        }
      }
      balls = balls.filter(b => b.y < R.H + 20);
      if (!balls.length) { lives--; R.shake(0.3); if (lives <= 0) R.over(); else serve(); }
      for (const d of drops) {
        d.y += 160 * dt;
        if (d.y > pad.y - 10 && d.y < pad.y + 12 && Math.abs(d.x - pad.x) < pad.w / 2) {
          d.y = R.H + 99; R.sfx('power');
          if (d.k === 'wide') { wide = 12; R.flash('Bred racket!'); }
          else { const b0 = balls[0]; if (b0) for (let i = 0; i < 2; i++) balls.push({ x: b0.x, y: b0.y, vx: (i ? 1 : -1) * 250, vy: -spd * 0.8 }); R.flash('Multiboll!'); }
        }
      }
      drops = drops.filter(d => d.y < R.H + 20);
      if (!bricks.some(b => b.hp > 0)) { level++; R.add(100); R.flash('Nivå ' + (level + 1)); build(); serve(); }
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, R.H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
      const cols = [P.enemy, P.coin, P.accent, P.player, P.top, P.deco, P.ground, P.enemy];
      for (const b of bricks) if (b.hp > 0) {
        ctx.fillStyle = cols[b.c % cols.length]; ctx.globalAlpha = b.hp > 1 ? 1 : 0.8;
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
        if (b.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      for (const d of drops) { ctx.fillStyle = d.k === 'wide' ? P.coin : P.accent; ctx.beginPath(); ctx.roundRect(d.x - 14, d.y - 7, 28, 14, 7); ctx.fill(); }
      ctx.fillStyle = P.player; ctx.beginPath(); ctx.roundRect(pad.x - pad.w / 2, pad.y, pad.w, 12, 6); ctx.fill();
      ctx.fillStyle = '#fff'; for (const b of balls) { ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill(); }
      R.drawParticles();
    },
  };
}

function gameDodger(R) {
  const P = R.pal, C = R.CFG;
  let pl, obs, items, t, speed, lanesY, bonus;
  return {
    reset() { pl = { x: R.W / 2, y: R.H - 110, shield: 0 }; obs = []; items = []; t = 0; speed = 240 + C.difficulty * 50; lanesY = 0; bonus = 0; },
    update(dt) {
      const k = R.input();
      if (k.left) pl.x -= 440 * dt; if (k.right) pl.x += 440 * dt;
      pl.x = Math.max(24, Math.min(R.W - 24, pl.x));
      speed += dt * 6; t -= dt; lanesY = (lanesY + speed * dt) % 80; pl.shield -= dt;
      if (t <= 0) {
        t = Math.max(0.28, 0.9 - speed / 1400);
        const w = 40 + R.rng() * 90;
        obs.push({ x: R.rng() * (R.W - w) + w / 2, y: -60, w, h: 30 + R.rng() * 40, rot: R.rng() * 6 });
        if (R.rng() < 0.35) items.push({ x: 20 + R.rng() * (R.W - 40), y: -30, k: R.rng() < 0.1 ? 'shield' : 'coin' });
      }
      for (const o of obs) { o.y += speed * dt; o.rot += dt; }
      for (const it of items) it.y += speed * dt;
      for (const it of items) if (Math.abs(it.x - pl.x) < 28 && Math.abs(it.y - pl.y) < 30) {
        it.y = R.H + 99;
        if (it.k === 'coin') { bonus += 15; R.sfx('coin'); R.burst(pl.x, pl.y - 20, P.coin, 10); } else { pl.shield = 5; R.sfx('power'); R.flash('Sköld!'); }
      }
      for (const o of obs) if (Math.abs(o.x - pl.x) < o.w / 2 + 16 && Math.abs(o.y - pl.y) < o.h / 2 + 22) {
        if (pl.shield > 0) { o.y = R.H + 99; R.burst(o.x, o.y, P.enemy, 14); R.sfx('boom'); }
        else { R.burst(pl.x, pl.y, P.player, 30, 260); R.shake(0.5); R.over(); }
      }
      obs = obs.filter(o => o.y < R.H + 80); items = items.filter(i => i.y < R.H + 40);
      R.score = Math.floor(R.time * 10) + bonus;
    },
    draw(ctx) {
      ctx.fillStyle = P.bg1; ctx.fillRect(0, 0, R.W, R.H);
      ctx.fillStyle = P.bg2; ctx.fillRect(R.W * 0.08, 0, R.W * 0.84, R.H);
      ctx.fillStyle = P.deco; ctx.globalAlpha = 0.5;
      for (let y = -80 + lanesY; y < R.H; y += 80) { ctx.fillRect(R.W / 3 - 3, y, 6, 40); ctx.fillRect(R.W * 2 / 3 - 3, y, 6, 40); }
      ctx.globalAlpha = 1;
      for (const it of items) { ctx.fillStyle = it.k === 'coin' ? P.coin : P.accent; ctx.beginPath(); ctx.arc(it.x, it.y, it.k === 'coin' ? 10 : 13, 0, 7); ctx.fill(); }
      for (const o of obs) {
        ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.sin(o.rot) * 0.2);
        ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.roundRect(-o.w / 2, -o.h / 2, o.w, o.h, 8); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-o.w / 2 + 6, -o.h / 2 + 6, o.w - 12, 6);
        ctx.restore();
      }
      if (R.state !== 'over') {
        if (pl.shield > 0) { ctx.strokeStyle = P.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pl.x, pl.y, 34, 0, 7); ctx.stroke(); }
        ctx.fillStyle = P.player; ctx.beginPath(); ctx.roundRect(pl.x - 18, pl.y - 28, 36, 56, 10); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(pl.x - 12, pl.y - 18, 24, 12);
      }
      R.drawParticles();
    },
  };
}

function gameCollector(R) {
  const P = R.pal, C = R.CFG, two = C.players === 2;
  let pls, gems, foes, t;
  function place() { return { x: 40 + R.rng() * (R.W - 80), y: 70 + R.rng() * (R.H - 120) }; }
  return {
    reset() {
      pls = [{ x: R.W * 0.4, y: R.H / 2, c: P.player, s: 0, alive: true }];
      if (two) pls.push({ x: R.W * 0.6, y: R.H / 2, c: P.accent, s: 0, alive: true });
      gems = Array.from({ length: 5 }, place); foes = []; t = 2;
    },
    hud() { if (two) R.text('P1 ' + pls[0].s + '   ·   P2 ' + pls[1].s, R.W / 2, 28, 18, '#fff', 'center'); },
    update(dt) {
      pls.forEach((p, i) => {
        if (!p.alive) return;
        const k = R.input(i), sp = 280;
        let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        const l = Math.hypot(dx, dy) || 1; p.x += dx / l * sp * dt; p.y += dy / l * sp * dt;
        p.x = Math.max(16, Math.min(R.W - 16, p.x)); p.y = Math.max(56, Math.min(R.H - 16, p.y));
        for (const g of gems) if (Math.hypot(g.x - p.x, g.y - p.y) < 26) {
          p.s += 10; R.add(10); R.sfx('coin'); R.burst(g.x, g.y, P.coin, 12); Object.assign(g, place());
        }
      });
      t -= dt;
      if (t <= 0) { t = Math.max(1.2, 5 - R.time * 0.05 - C.difficulty); const e = R.rng() < 0.5 ? { x: R.rng() < 0.5 ? -20 : R.W + 20, y: 60 + R.rng() * R.H } : { x: R.rng() * R.W, y: R.H + 20 }; foes.push({ x: e.x, y: e.y, sp: 70 + R.rng() * 60 + C.difficulty * 20 }); }
      for (const f of foes) {
        const alive = pls.filter(p => p.alive);
        if (!alive.length) break;
        const tg = alive.reduce((a, b) => (Math.hypot(a.x - f.x, a.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y) ? a : b));
        const a = Math.atan2(tg.y - f.y, tg.x - f.x); f.x += Math.cos(a) * f.sp * dt; f.y += Math.sin(a) * f.sp * dt;
        for (const p of alive) if (Math.hypot(p.x - f.x, p.y - f.y) < 26) { p.alive = false; R.burst(p.x, p.y, p.c, 30, 240); R.sfx('hit'); R.shake(0.3); }
      }
      if (!pls.some(p => p.alive)) {
        if (two) R.flash(pls[0].s === pls[1].s ? 'Oavgjort!' : (pls[0].s > pls[1].s ? 'Spelare 1 vinner!' : 'Spelare 2 vinner!'), 4);
        R.over();
      }
    },
    draw(ctx) {
      ctx.fillStyle = P.bg1; ctx.fillRect(0, 0, R.W, R.H);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      for (let x = 0; x < R.W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, R.H); ctx.stroke(); }
      for (let y = 0; y < R.H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(R.W, y); ctx.stroke(); }
      for (const g of gems) { ctx.fillStyle = P.coin; ctx.beginPath(); ctx.moveTo(g.x, g.y - 12); ctx.lineTo(g.x + 10, g.y); ctx.lineTo(g.x, g.y + 12); ctx.lineTo(g.x - 10, g.y); ctx.closePath(); ctx.fill(); }
      for (const f of foes) { ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.arc(f.x, f.y, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(f.x - 7, f.y - 5, 4, 5); ctx.fillRect(f.x + 3, f.y - 5, 4, 5); }
      for (const p of pls) if (p.alive) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      R.drawParticles();
    },
  };
}

function gameOpenWorld(R) {
  const P = R.pal, C = R.CFG, T = 40, N = 160;
  const noise = nxNoise(C.seed), moist = nxNoise(C.seed + 99);
  let map, pl, npcs, items, foes, cam, talk, quest, done, hp, hurtT;
  const Q = C.quests && C.quests.length ? C.quests : [{ giver: 'Vandraren', item: 'kristall', count: 4, text: 'Hitta 4 kristaller åt mig.' }];
  function tile(x, y) {
    const e = noise(x / 22, y / 22), m = moist(x / 30, y / 30), edge = Math.min(x, y, N - 1 - x, N - 1 - y) / 12;
    const h = e - Math.max(0, 1 - edge) * 0.5;
    if (h < 0.34) return 0; // water
    if (h < 0.38) return 1; // sand
    if (h > 0.68) return 4; // rock
    return m > 0.55 ? 3 : 2; // forest / grass
  }
  function walk(x, y) { const t = map[Math.floor(y / T) * N + Math.floor(x / T)]; return t === 1 || t === 2 || t === 3; }
  function spot(r) {
    for (let i = 0; i < 4000; i++) { const x = (4 + Math.floor(r() * (N - 8))) * T + T / 2, y = (4 + Math.floor(r() * (N - 8))) * T + T / 2; if (walk(x, y) && map[Math.floor(y / T) * N + Math.floor(x / T)] === 2) return { x, y }; }
    return { x: N * T / 2, y: N * T / 2 };
  }
  return {
    reset() {
      map = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) map[y * N + x] = tile(x, y);
      const r = nxRng(C.seed);
      pl = Object.assign(spot(r), { face: 0, atk: 0 });
      npcs = Q.map((q, i) => Object.assign(spot(r), { name: q.giver, q: i, lines: q.lines || [q.text], c: [P.accent, P.coin, P.player, P.top][i % 4] }));
      // place the first NPC near the player so the story starts quickly
      if (npcs[0]) { npcs[0].x = pl.x + 80; npcs[0].y = pl.y; if (!walk(npcs[0].x, npcs[0].y)) { npcs[0].x = pl.x; npcs[0].y = pl.y - 60; } }
      items = []; for (let i = 0; i < 70; i++) items.push(Object.assign(spot(r), { q: i % Q.length, got: false }));
      foes = []; for (let i = 0; i < 26 + C.difficulty * 10; i++) foes.push(Object.assign(spot(r), { hp: 2, t: r() * 9, vx: 0, vy: 0 }));
      foes = foes.filter(f => Math.hypot(f.x - pl.x, f.y - pl.y) > 300);
      quest = -1; done = 0; hp = 5; hurtT = 0; talk = null; cam = { x: pl.x, y: pl.y };
    },
    hud() {
      R.text('♥'.repeat(Math.max(0, hp)), R.W / 2, 28, 20, P.enemy, 'center');
      const q = Q[quest];
      if (q) { const have = items.filter(i => i.q === quest && i.got).length; R.text('Uppdrag: ' + q.text + ' (' + Math.min(have, q.count) + '/' + q.count + ')', 18, R.H - 26, 15, '#fff', 'left', '600'); }
      else if (done < Q.length) R.text('Hitta någon att prata med (tryck ● nära en person)', 18, R.H - 26, 15, '#fff', 'left', '600');
      if (talk) {
        const w = Math.min(560, R.W - 30), x = (R.W - w) / 2, y = R.H - 150;
        R.ctx.fillStyle = 'rgba(8,8,24,.9)'; R.ctx.beginPath(); R.ctx.roundRect(x, y, w, 110, 12); R.ctx.fill();
        R.ctx.strokeStyle = P.accent; R.ctx.lineWidth = 2; R.ctx.stroke();
        R.text(talk.name, x + 16, y + 20, 16, P.accent, 'left', '800');
        const words = talk.line.split(' '); let ln = '', yy = y + 48;
        R.ctx.font = '500 15px system-ui';
        for (const wd of words) { if (R.ctx.measureText(ln + wd).width > w - 32) { R.text(ln, x + 16, yy, 15, '#fff', 'left', '500'); ln = ''; yy += 22; } ln += wd + ' '; }
        R.text(ln, x + 16, yy, 15, '#fff', 'left', '500');
      }
    },
    update(dt) {
      if (talk) {
        if (R.hit('action')) { talk.i++; R.sfx('talk'); if (talk.i >= talk.lines.length) { if (talk.onEnd) talk.onEnd(); talk = null; } else talk.line = talk.lines[talk.i]; }
        return;
      }
      const k = R.input(), sp = 190;
      let dx = (k.right ? 1 : 0) - (k.left ? 1 : 0), dy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      if (dx || dy) pl.face = Math.atan2(dy, dx);
      if (walk(pl.x + dx * sp * dt, pl.y)) pl.x += dx * sp * dt;
      if (walk(pl.x, pl.y + dy * sp * dt)) pl.y += dy * sp * dt;
      pl.atk -= dt; hurtT -= dt;
      if (R.hit('action')) {
        const n = npcs.find(n => Math.hypot(n.x - pl.x, n.y - pl.y) < 60);
        if (n) {
          const q = Q[n.q], have = items.filter(i => i.q === n.q && i.got).length;
          if (n.q < done) talk = { name: n.name, lines: ['Tack igen för hjälpen, vän!'] };
          else if (quest === n.q && have >= q.count) {
            talk = { name: n.name, lines: [q.thanks || 'Fantastiskt! Du klarade det. Här är din belöning.'], onEnd: () => { done++; quest = -1; R.add(250); R.sfx('power'); R.flash('Uppdrag klart!'); if (done >= Q.length) R.win('Alla uppdrag klara!'); } };
          } else if (quest === n.q) talk = { name: n.name, lines: ['Du har ' + have + ' av ' + q.count + '. Fortsätt leta!'] };
          else if (n.q === done) talk = { name: n.name, lines: n.lines.concat([q.text]), onEnd: () => { quest = n.q; R.flash('Nytt uppdrag!'); } };
          else talk = { name: n.name, lines: ['Hej, äventyrare. Kom tillbaka senare, jag kan behöva din hjälp.'] };
          if (talk) { talk.i = 0; talk.line = talk.lines[0]; R.sfx('talk'); }
        } else { pl.atk = 0.25; R.sfx('shoot'); }
      }
      for (const it of items) if (!it.got && it.q === quest && Math.hypot(it.x - pl.x, it.y - pl.y) < 26) { it.got = true; R.add(20); R.sfx('coin'); R.burst(it.x, it.y, P.coin, 12); }
      for (const f of foes) {
        if (f.hp <= 0) continue;
        f.t += dt;
        const d = Math.hypot(pl.x - f.x, pl.y - f.y);
        if (d < 260) { f.vx = (pl.x - f.x) / d * 85; f.vy = (pl.y - f.y) / d * 85; }
        else if (f.t % 3 < dt * 2) { const a = Math.random() * 7; f.vx = Math.cos(a) * 40; f.vy = Math.sin(a) * 40; }
        if (walk(f.x + f.vx * dt, f.y + f.vy * dt)) { f.x += f.vx * dt; f.y += f.vy * dt; }
        if (pl.atk > 0 && d < 58) { f.hp--; f.x -= (pl.x - f.x) / d * 40; f.y -= (pl.y - f.y) / d * 40; R.burst(f.x, f.y, P.enemy, 8); if (f.hp <= 0) { R.add(30); R.sfx('boom'); } }
        else if (d < 24 && hurtT <= 0) { hp--; hurtT = 1; R.sfx('hit'); R.shake(0.25); if (hp <= 0) R.over(); }
      }
      cam.x += (pl.x - cam.x) * Math.min(1, dt * 6); cam.y += (pl.y - cam.y) * Math.min(1, dt * 6);
    },
    draw(ctx) {
      const cols = ['#2b5fa8', '#d8c07a', P.ground, P.top, '#77726e'];
      const ox = cam.x - R.W / 2, oy = cam.y - R.H / 2;
      ctx.fillStyle = cols[0]; ctx.fillRect(0, 0, R.W, R.H);
      const x0 = Math.max(0, Math.floor(ox / T)), y0 = Math.max(0, Math.floor(oy / T));
      const x1 = Math.min(N - 1, Math.ceil((ox + R.W) / T)), y1 = Math.min(N - 1, Math.ceil((oy + R.H) / T));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = map[y * N + x]; ctx.fillStyle = cols[t];
        ctx.fillRect(Math.floor(x * T - ox), Math.floor(y * T - oy), T + 1, T + 1);
        if (t === 3 && (x * 7 + y * 13) % 3 === 0) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(x * T - ox + T / 2, y * T - oy + T / 2, T * 0.42, 0, 7); ctx.fill(); }
        if (t === 0 && (x + y + Math.floor(R.time * 2)) % 7 === 0) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x * T - ox + 8, y * T - oy + 18, 16, 3); }
      }
      for (const it of items) if (!it.got && (it.q === quest)) { ctx.fillStyle = P.coin; ctx.beginPath(); ctx.moveTo(it.x - ox, it.y - oy - 11); ctx.lineTo(it.x - ox + 8, it.y - oy); ctx.lineTo(it.x - ox, it.y - oy + 11); ctx.lineTo(it.x - ox - 8, it.y - oy); ctx.fill(); }
      for (const f of foes) if (f.hp > 0) { ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.ellipse(f.x - ox, f.y - oy + 4, 14, 11 + Math.sin(f.t * 6) * 2, 0, 0, 7); ctx.fill(); }
      for (const n of npcs) {
        ctx.fillStyle = n.c; ctx.beginPath(); ctx.arc(n.x - ox, n.y - oy, 14, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2d2b0'; ctx.beginPath(); ctx.arc(n.x - ox, n.y - oy - 16, 8, 0, 7); ctx.fill();
        if (n.q === done && quest !== n.q || quest === n.q) R.text(quest === n.q ? '?' : '!', n.x - ox, n.y - oy - 38, 20, P.coin, 'center', '900');
      }
      if (hurtT <= 0 || Math.floor(hurtT * 12) % 2) {
        ctx.fillStyle = P.player; ctx.beginPath(); ctx.arc(R.W / 2 + pl.x - cam.x, R.H / 2 + pl.y - cam.y, 15, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (pl.atk > 0) { ctx.strokeStyle = P.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R.W / 2 + pl.x - cam.x, R.H / 2 + pl.y - cam.y, 42, pl.face - 1, pl.face + 1); ctx.stroke(); }
      R.drawParticles(ox, oy);
      // minimap
      const s = 1, mw = N * s;
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#000'; ctx.fillRect(R.W - mw - 16, 48, mw + 4, mw + 4);
      if (!this.mini) {
        const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d');
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = cols[map[y * N + x]]; g.fillRect(x, y, 1, 1); }
        this.mini = c;
      }
      ctx.drawImage(this.mini, R.W - mw - 14, 50, mw, mw);
      ctx.fillStyle = '#fff'; ctx.fillRect(R.W - mw - 14 + pl.x / T * s - 2, 50 + pl.y / T * s - 2, 4, 4);
      ctx.globalAlpha = 1;
    },
  };
}

function gameRunner3D(R) {
  const P = R.pal, C = R.CFG, g3 = Nx3D(R.ctx);
  let lane, x, y, vy, z, obs, coins, speed, nextZ;
  g3.cam.fog = P.bg2; g3.cam.far = 80;
  function gen() {
    while (nextZ < z + 90) {
      nextZ += 7 + R.rng() * 7 - Math.min(4, speed / 20);
      const l = Math.floor(R.rng() * 3) - 1, tall = R.rng() < 0.4;
      obs.push({ l, z: nextZ, h: tall ? 2.4 : 0.9 });
      if (R.rng() < 0.6) { const cl = (l + 1 + Math.floor(R.rng() * 2)) % 3 - 1; for (let i = 0; i < 4; i++) coins.push({ l: cl, z: nextZ + i * 1.6, got: false }); }
    }
  }
  return {
    reset() { lane = 0; x = 0; y = 0; vy = 0; z = 0; obs = []; coins = []; speed = 14 + C.difficulty * 3; nextZ = 22; gen(); },
    update(dt) {
      if (R.hit('left')) lane = Math.max(-1, lane - 1);
      if (R.hit('right')) lane = Math.min(1, lane + 1);
      if ((R.hit('up') || R.hit('action')) && y <= 0) { vy = 9.5; R.sfx('jump'); }
      vy -= 26 * dt; y = Math.max(0, y + vy * dt); if (y === 0) vy = Math.max(0, vy);
      x += (lane * 2.2 - x) * Math.min(1, dt * 14);
      speed += dt * 0.35; z += speed * dt;
      R.score = Math.floor(z) + coins.filter(c => c.got).length * 10;
      for (const c of coins) if (!c.got && Math.abs(c.z - z) < 0.8 && c.l === lane && y < 1.4) { c.got = true; R.sfx('coin'); }
      for (const o of obs) if (Math.abs(o.z - z) < 0.7 && Math.abs(o.l * 2.2 - x) < 1.2 && y < o.h) { R.shake(0.5); R.sfx('hit'); R.over(); }
      obs = obs.filter(o => o.z > z - 5); coins = coins.filter(c => c.z > z - 5);
      gen();
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, R.H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
      const cam = g3.cam; cam.x = x * 0.6; cam.y = 3.4; cam.z = z - 7; cam.pitch = 0.28; cam.yaw = 0;
      g3.begin(R.W, R.H);
      const seg = 4, z0 = Math.floor(z / seg) * seg;
      for (let i = -1; i < 20; i++) {
        const zz = z0 + i * seg;
        g3.poly([[-3.4, 0, zz], [3.4, 0, zz], [3.4, 0, zz + seg], [-3.4, 0, zz + seg]], (i + z0 / seg) % 2 ? P.ground : P.top, [0, 1, 0]);
        g3.box(-4.2, 0, zz + seg / 2, 0.6, 0.8 + ((zz * 13) % 5) * 0.4, seg * 0.9, P.deco);
        g3.box(4.2, 0, zz + seg / 2, 0.6, 0.8 + ((zz * 7) % 5) * 0.4, seg * 0.9, P.deco);
      }
      for (const o of obs) g3.box(o.l * 2.2, 0, o.z, 1.7, o.h, 0.9, P.enemy);
      for (const c of coins) if (!c.got) g3.box(c.l * 2.2, 0.8 + Math.sin(c.z + R.time * 4) * 0.15, c.z, 0.5, 0.5, 0.2, P.coin);
      if (R.state !== 'over') { g3.box(x, y, z, 0.9, 1.3, 0.9, P.player); g3.box(x, y + 1.3, z, 0.6, 0.5, 0.6, P.accent); }
      g3.flush();
    },
  };
}

function gameArena3D(R) {
  const P = R.pal, C = R.CFG, g3 = Nx3D(R.ctx), S = 14;
  let pl, orbs, foes, pillars, t;
  g3.cam.fog = P.bg2; g3.cam.far = 60;
  function spot() { return { x: (R.rng() - 0.5) * S * 1.8, z: (R.rng() - 0.5) * S * 1.8 }; }
  return {
    reset() {
      pl = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0 };
      const r = nxRng(C.seed); pillars = [];
      for (let i = 0; i < 7; i++) { const p = { x: (r() - 0.5) * S * 1.6, z: (r() - 0.5) * S * 1.6, h: 1 + r() * 3 }; if (Math.hypot(p.x, p.z) > 3) pillars.push(p); }
      orbs = Array.from({ length: 4 }, spot); foes = []; t = 3;
    },
    update(dt) {
      const k = R.input();
      if (k.left) pl.yaw -= 2.6 * dt; if (k.right) pl.yaw += 2.6 * dt;
      const f = (k.up || k.action ? 1 : 0) - (k.down ? 0.6 : 0);
      pl.vx += Math.sin(pl.yaw) * f * 28 * dt; pl.vz += Math.cos(pl.yaw) * f * 28 * dt;
      pl.vx *= Math.pow(0.12, dt); pl.vz *= Math.pow(0.12, dt);
      pl.x = Math.max(-S, Math.min(S, pl.x + pl.vx * dt)); pl.z = Math.max(-S, Math.min(S, pl.z + pl.vz * dt));
      for (const p of pillars) { const d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < 1.2) { pl.x = p.x + (pl.x - p.x) / d * 1.2; pl.z = p.z + (pl.z - p.z) / d * 1.2; } }
      for (const o of orbs) if (Math.hypot(o.x - pl.x, o.z - pl.z) < 1) { R.add(10); R.sfx('coin'); Object.assign(o, spot()); }
      t -= dt;
      if (t <= 0) { t = Math.max(1.5, 5 - R.time * 0.04 - C.difficulty * 0.5); const a = R.rng() * 7; foes.push({ x: Math.cos(a) * S, z: Math.sin(a) * S, sp: 2.2 + R.rng() * 1.5 + C.difficulty * 0.4 }); }
      for (const e of foes) {
        const d = Math.hypot(pl.x - e.x, pl.z - e.z) || 1; e.x += (pl.x - e.x) / d * e.sp * dt; e.z += (pl.z - e.z) / d * e.sp * dt;
        if (d < 0.9) { R.sfx('hit'); R.shake(0.4); R.over(); }
      }
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, R.H); g.addColorStop(0, P.bg1); g.addColorStop(1, P.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
      const cam = g3.cam; cam.yaw = pl.yaw; cam.pitch = 0.45;
      cam.x = pl.x - Math.sin(pl.yaw) * 7; cam.z = pl.z - Math.cos(pl.yaw) * 7; cam.y = 5.5;
      g3.begin(R.W, R.H);
      for (let i = -S; i < S; i += 4) for (let j = -S; j < S; j += 4) g3.poly([[i, 0, j], [i + 4, 0, j], [i + 4, 0, j + 4], [i, 0, j + 4]], ((i + j) / 4) % 2 ? P.ground : P.top, [0, 1, 0]);
      for (let i = -S; i < S; i += 2) { g3.box(i + 1, 0, -S - 0.5, 2, 0.8, 0.4, P.deco); g3.box(i + 1, 0, S + 0.5, 2, 0.8, 0.4, P.deco); g3.box(-S - 0.5, 0, i + 1, 0.4, 0.8, 2, P.deco); g3.box(S + 0.5, 0, i + 1, 0.4, 0.8, 2, P.deco); }
      for (const p of pillars) g3.box(p.x, 0, p.z, 1.2, p.h, 1.2, P.deco);
      for (const o of orbs) g3.box(o.x, 0.4 + Math.sin(R.time * 3 + o.x) * 0.2, o.z, 0.5, 0.5, 0.5, P.coin);
      for (const e of foes) { g3.box(e.x, 0, e.z, 0.9, 0.9, 0.9, P.enemy); }
      if (R.state !== 'over') { g3.box(pl.x, 0, pl.z, 0.9, 1.1, 0.9, P.player); g3.box(pl.x + Math.sin(pl.yaw) * 0.45, 0.6, pl.z + Math.cos(pl.yaw) * 0.45, 0.3, 0.3, 0.3, P.accent); }
      g3.flush();
    },
  };
}

/* ---- 1.5: racing, match-3 puzzle and tower defense ---- */

function gameRacer(R) {
  const P = R.pal, C = R.CFG, N = 96, WIDTH = 120;
  let track, cars, me, lapsToWin, zoom, finishOrder;
  function build() {
    const n = nxNoise(C.seed), r0 = 900;
    track = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, r = r0 * (0.75 + 0.5 * n(Math.cos(a) * 1.3 + 5, Math.sin(a) * 1.3 + 5));
      track.push({ x: Math.cos(a) * r * 1.25, y: Math.sin(a) * r });
    }
  }
  function nearest(car) {
    let best = car.idx, bd = Infinity;
    for (let k = -6; k <= 10; k++) {
      const i = (car.idx + k + N) % N, p = track[i], d = (p.x - car.x) ** 2 + (p.y - car.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bd) };
  }
  function makeCar(off, color, ai) {
    const p = track[0], q = track[1], a = Math.atan2(q.y - p.y, q.x - p.x);
    return { x: p.x - Math.sin(a) * off, y: p.y + Math.cos(a) * off, a, v: 0, idx: 0, lap: 0, color, ai, skill: ai ? 0.86 + R.rng() * 0.1 + C.difficulty * 0.03 : 1, done: false };
  }
  const progress = c => c.lap * N + c.idx;
  function step(c, dt, k) {
    const max = 360 * c.skill, near = nearest(c), off = near.d > WIDTH / 2;
    if (c.ai) {
      const tgt = track[(near.i + 4) % N];
      let da = Math.atan2(tgt.y - c.y, tgt.x - c.x) - c.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      c.a += Math.max(-2.6, Math.min(2.6, da * 4)) * dt;
      c.v += (max * (1 - Math.min(0.5, Math.abs(da))) - c.v) * dt * 1.5;
    } else {
      if (k.up || k.action) c.v += 420 * dt; else c.v *= Math.pow(0.5, dt);
      if (k.down) c.v -= 520 * dt;
      const steer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      c.a += steer * 2.8 * dt * Math.min(1, Math.abs(c.v) / 120) * Math.sign(c.v || 1);
      c.v = Math.max(-120, Math.min(off ? max * 0.45 : max, c.v));
    }
    c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
    const n2 = nearest(c);
    if (n2.i < 10 && c.idx > N - 10) { c.lap++; if (!c.ai && c.lap > 0 && c.lap < lapsToWin) { R.flash('Varv ' + (c.lap + 1) + '/' + lapsToWin); R.sfx('power'); } }
    else if (n2.i > N - 10 && c.idx < 10) c.lap--;
    c.idx = n2.i;
    if (c.lap >= lapsToWin && !c.done) { c.done = true; finishOrder.push(c); }
  }
  return {
    reset() {
      build(); lapsToWin = 3; finishOrder = [];
      cars = [makeCar(-30, P.player, false), makeCar(30, P.enemy, true), makeCar(0, P.accent, true)];
      cars[2].x -= Math.cos(cars[2].a) * 60; cars[2].y -= Math.sin(cars[2].a) * 60;
      me = cars[0];
    },
    resize() { zoom = Math.min(1, Math.min(R.W, R.H) / 650); },
    hud() {
      const pos = cars.slice().sort((a, b) => progress(b) - progress(a)).indexOf(me) + 1;
      R.text('Varv ' + Math.min(lapsToWin, me.lap + 1) + '/' + lapsToWin + '   ·   Plats ' + pos + '/3   ·   ' + R.time.toFixed(1) + ' s', R.W / 2, 28, 18, '#fff', 'center');
    },
    update(dt) {
      const k = R.input();
      cars.forEach(c => step(c, dt, c.ai ? null : k));
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 34 && d > 0) { const push = (34 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; a.v *= 0.97; b.v *= 0.97; }
      }
      R.score = Math.max(0, Math.floor(progress(me) * 5));
      if (me.done) {
        const place = finishOrder.indexOf(me) + 1;
        R.score += [0, 1500, 800, 300][place] + Math.max(0, Math.floor(600 - R.time * 5));
        if (place === 1) R.win('Du vann loppet!'); else { R.flash('Plats ' + place + ' – försök igen!', 3); R.over(); }
      }
    },
    draw(ctx) {
      ctx.fillStyle = P.bg2; ctx.fillRect(0, 0, R.W, R.H);
      ctx.save();
      ctx.translate(R.W / 2, R.H / 2); ctx.scale(zoom || 1, zoom || 1); ctx.translate(-me.x, -me.y);
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      for (let x = Math.floor((me.x - 1200) / 120) * 120; x < me.x + 1200; x += 120) for (let y = Math.floor((me.y - 1200) / 120) * 120; y < me.y + 1200; y += 120) if (((x + y) / 120) % 2 === 0) ctx.fillRect(x, y, 120, 120);
      const path = () => { ctx.beginPath(); track.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
      ctx.lineJoin = 'round';
      path(); ctx.strokeStyle = '#fff'; ctx.lineWidth = WIDTH + 14; ctx.stroke();
      path(); ctx.strokeStyle = P.ground; ctx.lineWidth = WIDTH; ctx.stroke();
      path(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([26, 26]); ctx.stroke(); ctx.setLineDash([]);
      const s0 = track[0], s1 = track[1], sa = Math.atan2(s1.y - s0.y, s1.x - s0.x) + Math.PI / 2;
      ctx.save(); ctx.translate(s0.x, s0.y); ctx.rotate(sa);
      for (let i = -6; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(i * WIDTH / 12, -6, WIDTH / 12, 12); }
      ctx.restore();
      for (const c of cars) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-18, -9, 40, 22);
        ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(-20, -11, 40, 22, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(2, -8, 8, 16);
        ctx.fillStyle = '#111'; ctx.fillRect(-16, -14, 9, 4); ctx.fillRect(-16, 10, 9, 4); ctx.fillRect(8, -14, 9, 4); ctx.fillRect(8, 10, 9, 4);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

function gameMatch3(R) {
  const P = R.pal, C = R.CFG, N = 8, TYPES = 6;
  // fixed, high-contrast gem colours (theme colours can be too close to each other)
  const COLS = ['#ff4d6d', '#ffd23f', '#3a86ff', '#9b5de5', '#2ec4b6', '#ffffff'];
  let grid, cell, ox, oy, sel, cursor, moves, goal, busy, combo, swapAnim;
  const rnd = () => Math.floor(R.rng() * TYPES);
  function fresh() {
    grid = [];
    for (let r = 0; r < N; r++) { grid.push([]); for (let c = 0; c < N; c++) { let t; do { t = rnd(); } while ((c > 1 && grid[r][c - 1].t === t && grid[r][c - 2].t === t) || (r > 1 && grid[r - 1][c].t === t && grid[r - 2][c].t === t)); grid[r].push({ t, off: -(N - r) * 1.2 - R.rng() }); } }
  }
  function matches() {
    const hit = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 2; c++) { const t = grid[r][c].t; if (t >= 0 && grid[r][c + 1].t === t && grid[r][c + 2].t === t) { hit.add(r * N + c); hit.add(r * N + c + 1); hit.add(r * N + c + 2); } }
    for (let c = 0; c < N; c++) for (let r = 0; r < N - 2; r++) { const t = grid[r][c].t; if (t >= 0 && grid[r + 1][c].t === t && grid[r + 2][c].t === t) { hit.add(r * N + c); hit.add((r + 1) * N + c); hit.add((r + 2) * N + c); } }
    return hit;
  }
  function resolve() {
    const hit = matches();
    if (!hit.size) { busy = 0; combo = 0; if (moves <= 0 && R.score < goal) R.over(); return false; }
    combo++;
    hit.forEach(k => { const r = Math.floor(k / N), c = k % N; R.burst(ox + c * cell + cell / 2, oy + r * cell + cell / 2, COLS[grid[r][c].t], 6); grid[r][c].t = -1; });
    R.add(hit.size * 10 * combo); R.sfx(combo > 1 ? 'power' : 'coin');
    if (combo > 1) R.flash('Kombo x' + combo + '!');
    for (let c = 0; c < N; c++) {
      let write = N - 1;
      for (let r = N - 1; r >= 0; r--) if (grid[r][c].t >= 0) { const g = grid[r][c]; grid[write][c] = { t: g.t, off: g.off + (r - write) }; write--; }
      for (let r = write; r >= 0; r--) grid[r][c] = { t: rnd(), off: r - write - 1.5 };
    }
    busy = 0.35;
    if (R.score >= goal) R.win('Målet nått!');
    return true;
  }
  function trySwap(a, b) {
    const ga = grid[a.r][a.c], gb = grid[b.r][b.c];
    grid[a.r][a.c] = gb; grid[b.r][b.c] = ga;
    if (matches().size) { moves--; swapAnim = null; resolve(); }
    else { grid[a.r][a.c] = ga; grid[b.r][b.c] = gb; swapAnim = { a, b, t: 0.25 }; R.sfx('hit'); }
  }
  function pick(p) {
    if (busy > 0) return;
    if (!sel) { sel = p; R.sfx('talk'); return; }
    if (Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c) === 1) trySwap(sel, p);
    sel = null;
  }
  return {
    reset() { fresh(); sel = null; cursor = { r: 3, c: 3 }; moves = 25 - C.difficulty * 3; goal = 1200 + C.difficulty * 400; busy = 0.6; combo = 0; swapAnim = null; },
    resize() { cell = Math.floor(Math.min(R.W - 20, R.H - 120) / N); ox = Math.floor((R.W - cell * N) / 2); oy = Math.floor((R.H - cell * N) / 2) + 20; },
    hud() {
      R.text('Drag ' + moves + '   ·   Mål ' + goal, R.W / 2, 28, 18, '#fff', 'center');
      const w = Math.min(300, R.W * 0.5), f = Math.min(1, R.score / goal);
      R.ctx.fillStyle = 'rgba(255,255,255,.15)'; R.ctx.fillRect(R.W / 2 - w / 2, 46, w, 8);
      R.ctx.fillStyle = P.coin; R.ctx.fillRect(R.W / 2 - w / 2, 46, w * f, 8);
    },
    update(dt) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const g = grid[r][c]; if (g.off < 0) g.off = Math.min(0, g.off + dt * 9); else if (g.off > 0) g.off = Math.max(0, g.off - dt * 9); }
      if (swapAnim) { swapAnim.t -= dt; if (swapAnim.t <= 0) swapAnim = null; }
      if (busy > 0) { busy -= dt; if (busy <= 0) resolve(); }
      const click = R.click();
      if (click) {
        const c = Math.floor((click.x - ox) / cell), r = Math.floor((click.y - oy) / cell);
        if (r >= 0 && r < N && c >= 0 && c < N) { cursor = { r, c }; pick({ r, c }); }
      }
      if (R.hit('left')) cursor.c = Math.max(0, cursor.c - 1);
      if (R.hit('right')) cursor.c = Math.min(N - 1, cursor.c + 1);
      if (R.hit('up')) cursor.r = Math.max(0, cursor.r - 1);
      if (R.hit('down')) cursor.r = Math.min(N - 1, cursor.r + 1);
      if (R.hit('action')) pick({ r: cursor.r, c: cursor.c });
    },
    draw(ctx) {
      const g0 = ctx.createLinearGradient(0, 0, 0, R.H); g0.addColorStop(0, P.bg1); g0.addColorStop(1, P.bg2);
      ctx.fillStyle = g0; ctx.fillRect(0, 0, R.W, R.H);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.roundRect(ox - 8, oy - 8, cell * N + 16, cell * N + 16, 16); ctx.fill();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const g = grid[r][c], x = ox + c * cell + cell / 2, y = oy + (r + g.off) * cell + cell / 2, s = cell * 0.36;
        if ((r + c) % 2) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell); }
        if (g.t < 0 || y < oy - cell / 2) continue;
        let dx = 0;
        if (swapAnim && ((swapAnim.a.r === r && swapAnim.a.c === c) || (swapAnim.b.r === r && swapAnim.b.c === c))) dx = Math.sin(swapAnim.t * 60) * 4;
        ctx.save(); ctx.translate(x + dx, y);
        ctx.fillStyle = COLS[g.t]; ctx.beginPath();
        const t = g.t;
        if (t === 0) ctx.arc(0, 0, s, 0, 7);
        else if (t === 1) { ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); }
        else if (t === 2) ctx.roundRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7, s * 0.3);
        else if (t === 3) { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } }
        else if (t === 4) { ctx.moveTo(0, -s); ctx.lineTo(s * 0.95, s * 0.8); ctx.lineTo(-s * 0.95, s * 0.8); }
        else { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.45 : s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.35, s * 0.18, 0, 7); ctx.fill();
        ctx.restore();
      }
      const box = (p, col) => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(ox + p.c * cell + 2, oy + p.r * cell + 2, cell - 4, cell - 4); };
      box(cursor, 'rgba(255,255,255,.5)');
      if (sel) box(sel, P.coin);
      R.drawParticles();
    },
  };
}

function gameTowerDefense(R) {
  const P = R.pal, C = R.CFG, GW = 16, GH = 10;
  let path, cells, towers, foes, shots, gold, lives, wave, spawnLeft, spawnT, nextWaveT, cell, ox, oy, cursor;
  const COST = 50, UP = 70, WAVES = 10;
  function buildPath() {
    const r = nxRng(C.seed);
    path = []; cells = new Set();
    let x = 0, y = 2 + Math.floor(r() * (GH - 4));
    const add = () => { path.push({ x, y }); cells.add(x + ',' + y); };
    add();
    while (x < GW - 1) {
      const run = 2 + Math.floor(r() * 3);
      for (let i = 0; i < run && x < GW - 1; i++) { x++; add(); }
      if (x >= GW - 1) break;
      const ty = Math.max(1, Math.min(GH - 2, y + (r() < 0.5 ? -1 : 1) * (2 + Math.floor(r() * 3))));
      while (y !== ty) { y += Math.sign(ty - y); add(); }
    }
  }
  const center = p => ({ x: ox + p.x * cell + cell / 2, y: oy + p.y * cell + cell / 2 });
  function place(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || cells.has(gx + ',' + gy)) return;
    const t = towers.find(t => t.gx === gx && t.gy === gy);
    if (t) {
      if (t.lvl >= 3) return R.flash('Max nivå');
      if (gold < UP) return R.flash('Behöver ' + UP + ' guld');
      gold -= UP; t.lvl++; R.sfx('power'); R.flash('Torn nivå ' + t.lvl); return;
    }
    if (gold < COST) return R.flash('Behöver ' + COST + ' guld');
    gold -= COST; towers.push({ gx, gy, lvl: 1, cd: 0, aim: 0 }); R.sfx('coin');
  }
  function startWave() { wave++; spawnLeft = 6 + wave * 2; spawnT = 0; if (wave > 1) R.flash('Våg ' + wave); }
  return {
    reset() { buildPath(); towers = []; foes = []; shots = []; gold = 120; lives = 20; wave = 0; nextWaveT = 3; spawnLeft = 0; cursor = { x: 3, y: 1 }; },
    resize() { cell = Math.floor(Math.min((R.W - 20) / GW, (R.H - 110) / GH)); ox = Math.floor((R.W - cell * GW) / 2); oy = Math.floor((R.H - cell * GH) / 2) + 24; },
    hud() {
      R.text('Våg ' + Math.max(1, wave) + '/' + WAVES + '   ·   ♥ ' + lives + '   ·   🪙 ' + gold, R.W / 2, 28, 18, '#fff', 'center');
      R.text('Klicka/tryck på gräset: torn ' + COST + ' · klicka på torn: uppgradera ' + UP, R.W / 2, R.H - 16, 13, 'rgba(255,255,255,.75)', 'center', '500');
    },
    update(dt) {
      const cl = R.click();
      if (cl) place(Math.floor((cl.x - ox) / cell), Math.floor((cl.y - oy) / cell));
      if (R.hit('left')) cursor.x = Math.max(0, cursor.x - 1);
      if (R.hit('right')) cursor.x = Math.min(GW - 1, cursor.x + 1);
      if (R.hit('up')) cursor.y = Math.max(0, cursor.y - 1);
      if (R.hit('down')) cursor.y = Math.min(GH - 1, cursor.y + 1);
      if (R.hit('action')) place(cursor.x, cursor.y);
      if (!spawnLeft && !foes.length) {
        if (wave >= WAVES) { R.win('Alla vågor stoppade!'); return; }
        nextWaveT -= dt; if (nextWaveT <= 0) { startWave(); nextWaveT = 4; }
      }
      if (spawnLeft > 0) { spawnT -= dt; if (spawnT <= 0) { spawnT = Math.max(0.35, 0.9 - wave * 0.05); spawnLeft--; const hp = 20 + wave * 14 + C.difficulty * 10; foes.push({ i: 0, f: 0, hp, max: hp, sp: 1.3 + wave * 0.06 + (wave % 3 === 0 ? 0.6 : 0), boss: wave % 5 === 0 && spawnLeft === 0 }); if (foes[foes.length - 1].boss) { foes[foes.length - 1].hp *= 8; foes[foes.length - 1].max *= 8; } } }
      for (const e of foes) {
        e.f += e.sp * dt * (e.boss ? 0.6 : 1);
        while (e.f >= 1 && e.i < path.length - 1) { e.f -= 1; e.i++; }
        if (e.i >= path.length - 1) { e.hp = 0; e.leaked = true; lives -= e.boss ? 5 : 1; R.shake(0.2); R.sfx('hit'); }
      }
      for (const t of towers) {
        t.cd -= dt;
        const c = center({ x: t.gx, y: t.gy }), range = cell * (2.2 + t.lvl * 0.5);
        let best = null, bi = -1;
        for (const e of foes) { if (e.hp <= 0) continue; const p = foePos(e), d = Math.hypot(p.x - c.x, p.y - c.y); if (d < range && e.i + e.f > bi) { bi = e.i + e.f; best = e; } }
        if (best) { const p = foePos(best); t.aim = Math.atan2(p.y - c.y, p.x - c.x); if (t.cd <= 0) { t.cd = 0.7 / t.lvl; shots.push({ x: c.x, y: c.y, e: best, dmg: 8 * t.lvl + 4 }); R.sfx('shoot'); } }
      }
      for (const s of shots) {
        if (s.e.hp <= 0) { s.dead = true; continue; }
        const p = foePos(s.e), d = Math.hypot(p.x - s.x, p.y - s.y), v = 520 * dt;
        if (d < v) { s.dead = true; s.e.hp -= s.dmg; if (s.e.hp <= 0) { gold += s.e.boss ? 80 : 8 + wave; R.add(s.e.boss ? 200 : 20); R.burst(p.x, p.y, P.enemy, 10); R.sfx('boom'); } }
        else { s.x += (p.x - s.x) / d * v; s.y += (p.y - s.y) / d * v; }
      }
      shots = shots.filter(s => !s.dead); foes = foes.filter(e => e.hp > 0);
      if (lives <= 0) R.over();
    },
    draw(ctx) {
      ctx.fillStyle = P.bg1; ctx.fillRect(0, 0, R.W, R.H);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        ctx.fillStyle = cells.has(x + ',' + y) ? P.ground : ((x + y) % 2 ? P.top : nxShade(P.top, 0.9));
        ctx.fillRect(ox + x * cell, oy + y * cell, cell + 1, cell + 1);
      }
      const end = center(path[path.length - 1]);
      ctx.fillStyle = P.accent; ctx.beginPath(); ctx.arc(end.x, end.y, cell * 0.42, 0, 7); ctx.fill();
      for (const t of towers) {
        const c = center({ x: t.gx, y: t.gy });
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(c.x + 3, c.y + 4, cell * 0.38, 0, 7); ctx.fill();
        ctx.fillStyle = P.player; ctx.beginPath(); ctx.arc(c.x, c.y, cell * 0.38, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(t.aim); ctx.fillStyle = P.deco; ctx.fillRect(0, -cell * 0.08, cell * 0.45, cell * 0.16); ctx.restore();
        for (let k = 0; k < t.lvl; k++) { ctx.fillStyle = P.coin; ctx.beginPath(); ctx.arc(c.x - cell * 0.2 + k * cell * 0.2, c.y + cell * 0.46, cell * 0.06, 0, 7); ctx.fill(); }
      }
      for (const e of foes) {
        const p = foePos(e), r = cell * (e.boss ? 0.36 : 0.24);
        ctx.fillStyle = P.enemy; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(p.x - r, p.y - r - 8, r * 2, 4);
        ctx.fillStyle = '#7ff0bf'; ctx.fillRect(p.x - r, p.y - r - 8, r * 2 * e.hp / e.max, 4);
      }
      ctx.fillStyle = P.coin; for (const s of shots) { ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.strokeRect(ox + cursor.x * cell + 2, oy + cursor.y * cell + 2, cell - 4, cell - 4);
      R.drawParticles();
    },
  };
  function foePos(e) {
    const a = center(path[e.i]), b = center(path[Math.min(path.length - 1, e.i + 1)]);
    return { x: a.x + (b.x - a.x) * e.f, y: a.y + (b.y - a.y) * e.f };
  }
}
