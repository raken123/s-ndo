/* ==========================================================================
   Escape from Blackgate — top-down stealth escape
   Pure canvas 2D, no dependencies. Runs in a browser or inside Cordova.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------- constants -- */
  const TILE = 32;
  const SOLID = new Set(['#', 'B', 'T', 'L', 'c', 'k', 'F', 'W', '1', '2', '3', '4']);
  const OPAQUE = new Set(['#', 'B', 'L', 'c', 'k', 'W', '%', '1', '2', '3', '4']);
  const CONTAINER = new Set(['B', 'L', 'c', 'k']);
  const LOCKS = new Set(['1', '2', '3', '4']);
  const SLOWTILE = new Set(['~']);

  const SPEED = { sneak: 62, walk: 110, run: 176 };
  const NOISE = { sneak: 0, walk: 74, run: 205 };

  const $ = (id) => document.getElementById(id);

  /* --------------------------------------------------------------- audio -- */
  const Sound = (function () {
    let ctx = null, muted = false;
    const on = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    };
    function blip(freq, dur, type, vol, slideTo) {
      if (!ctx || muted) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.13, ctx.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    }
    return {
      unlock: on,
      toggleMute() { muted = !muted; return muted; },
      isMuted() { return muted; },
      pickup() { blip(660, 0.09, 'square', 0.12); setTimeout(() => blip(990, 0.12, 'square', 0.1), 80); },
      door() { blip(300, 0.16, 'sawtooth', 0.1, 520); },
      denied() { blip(180, 0.16, 'square', 0.11, 110); },
      spotted() { blip(880, 0.14, 'sawtooth', 0.14, 440); },
      alarm() { blip(520, 0.5, 'sawtooth', 0.1, 760); },
      busted() { blip(400, 0.5, 'sawtooth', 0.15, 80); },
      win() {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.13), i * 130));
      },
      step() { blip(120 + Math.random() * 40, 0.04, 'triangle', 0.03); }
    };
  })();

  /* --------------------------------------------------------------- input -- */
  const keys = Object.create(null);
  const input = { ax: 0, ay: 0, mag: 0, run: false, sneak: false, action: false };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') input.action = true;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function readKeyboard() {
    let x = 0, y = 0;
    if (keys['a'] || keys['arrowleft']) x -= 1;
    if (keys['d'] || keys['arrowright']) x += 1;
    if (keys['w'] || keys['arrowup']) y -= 1;
    if (keys['s'] || keys['arrowdown']) y += 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l, mag: 1 };
    }
    return null;
  }

  /* -------------------------------------------------- touch: joystick etc -- */
  const stick = { active: false, id: null, bx: 0, by: 0, x: 0, y: 0, mag: 0 };
  const stickEl = $('stick'), stickNub = $('stick-nub');

  function setupTouch() {
    const zone = $('touch-left');
    zone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      stick.active = true; stick.id = t.identifier;
      stick.bx = t.clientX; stick.by = t.clientY;
      stickEl.style.display = 'block';
      stickEl.style.left = stick.bx + 'px';
      stickEl.style.top = stick.by + 'px';
      stickNub.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stick.id) continue;
        let dx = t.clientX - stick.bx, dy = t.clientY - stick.by;
        const d = Math.hypot(dx, dy), max = 52;
        const cl = Math.min(d, max);
        if (d > 0) { dx = dx / d * cl; dy = dy / d * cl; }
        stick.x = dx / max; stick.y = dy / max; stick.mag = cl / max;
        stickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stick.id) continue;
        stick.active = false; stick.mag = 0; stick.x = stick.y = 0;
        stickEl.style.display = 'none';
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);

    const btnAction = $('btn-action'), btnRun = $('btn-run');
    const press = (el, down, up) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); Sound.unlock(); down(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); if (up) up(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); Sound.unlock(); down(); });
      el.addEventListener('mouseup', (e) => { e.preventDefault(); if (up) up(); });
    };
    press(btnAction, () => { input.action = true; });
    press(btnRun, () => { input.run = true; btnRun.classList.add('held'); },
      () => { input.run = false; btnRun.classList.remove('held'); });
  }

  /* --------------------------------------------------------------- state -- */
  let state = null;                       // current level runtime
  const progress = { level: 0, lives: 3, total: 0, inventory: [], busts: 0, seen: 0 };
  let mode = 'title';                     // title|brief|play|pause|busted|over|clear|win
  let lastT = 0, toasts = [], shake = 0, flash = 0;

  const canvas = $('game'), ctx2d = canvas.getContext('2d');
  let mapCanvas = null, mapDirty = true;

  function save() {
    try { localStorage.setItem('blackgate.save', JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem('blackgate.save');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s.level === 'number' && s.level > 0 && s.level < LEVELS.length) return s;
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ------------------------------------------------------ level building -- */
  function buildLevel(index) {
    const def = LEVELS[index];
    const grid = def.map.map((r) => r.split(''));
    const H = grid.length, W = grid[0].length;
    let start = { x: 1, y: 1 }, exit = { x: 1, y: 1 };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (grid[y][x] === 'S') { start = { x, y }; grid[y][x] = '.'; }
        else if (grid[y][x] === 'X') { exit = { x, y }; }
      }
    }

    const items = (def.items || []).map((it) => ({
      x: it.x, y: it.y, id: it.id, name: it.name, icon: it.icon,
      found: it.found, effect: it.effect || null,
      container: CONTAINER.has(grid[it.y][it.x]),
      taken: progress.inventory.indexOf(it.id) >= 0
    }));

    const guards = (def.guards || []).map((g, i) => ({
      name: g.name || 'Guard', idx: i,
      x: g.path[0][0] * TILE + TILE / 2, y: g.path[0][1] * TILE + TILE / 2,
      path: g.path, wp: 1 % g.path.length, speed: g.speed || 55,
      range: g.range || 210, fov: (g.fov || 66) * Math.PI / 180,
      dir: 0, see: 0, mode: 'patrol', target: null, route: [], routeT: 0,
      pause: 0, lookT: 0
    }));

    const cameras = (def.cameras || []).map((c) => ({
      x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2,
      dir: (c.dir || 0) * Math.PI / 180, base: (c.dir || 0) * Math.PI / 180,
      sweep: (c.sweep || 70) * Math.PI / 180, speed: (c.speed || 25) * Math.PI / 180,
      range: c.range || 220, fov: 42 * Math.PI / 180, t: Math.random() * 6, see: 0
    }));

    const lights = (def.lights || []).map((l) => ({
      path: l.path, wp: 1 % l.path.length, speed: l.speed || 70, radius: l.radius || 100,
      x: l.path[0][0] * TILE + TILE / 2, y: l.path[0][1] * TILE + TILE / 2, see: 0
    }));

    state = {
      def, index, grid, W, H, exit,
      start: { x: start.x * TILE + TILE / 2, y: start.y * TILE + TILE / 2 },
      player: {
        x: start.x * TILE + TILE / 2, y: start.y * TILE + TILE / 2,
        dir: 0, r: 10, stamina: 100, moving: 0, stepT: 0, anim: 0
      },
      items, guards, cameras, lights,
      alarm: 0, lockdown: 0, powerOff: false, lampLit: false,
      time: 0, danger: 0, noiseFx: [], sparks: []
    };
    if (progress.inventory.indexOf('breaker') >= 0 && def.id === 3) state.powerOff = true;
    if (progress.inventory.indexOf('lamp') >= 0 && def.id === 5) state.lampLit = true;
    mapDirty = true;
    toasts = [];
  }

  /* ------------------------------------------------------ tile utilities -- */
  const tileAt = (tx, ty) => (ty >= 0 && ty < state.H && tx >= 0 && tx < state.W) ? state.grid[ty][tx] : '#';
  const tileAtPx = (x, y) => tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  const isSolid = (tx, ty) => SOLID.has(tileAt(tx, ty));
  const isOpaque = (tx, ty) => OPAQUE.has(tileAt(tx, ty));

  function circleHits(x, y, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!isSolid(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
      }
    return false;
  }

  function moveCircle(ent, dx, dy) {
    if (dx && !circleHits(ent.x + dx, ent.y, ent.r)) ent.x += dx;
    if (dy && !circleHits(ent.x, ent.y + dy, ent.r)) ent.y += dy;
  }

  function hasLOS(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 7);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isOpaque(Math.floor((x1 + dx * t) / TILE), Math.floor((y1 + dy * t) / TILE))) return false;
    }
    return true;
  }

  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* ------------------------------------------------------------ BFS path -- */
  function findPath(sx, sy, gx, gy) {
    if (sx === gx && sy === gy) return [];
    const W = state.W, H = state.H;
    const prev = new Int32Array(W * H).fill(-1);
    const seen = new Uint8Array(W * H);
    const q = [sy * W + sx];
    seen[sy * W + sx] = 1;
    const goal = gy * W + gx;
    let head = 0, found = false;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) { found = true; break; }
      const cx = cur % W, cy = (cur / W) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + [1, -1, 0, 0][k], ny = cy + [0, 0, 1, -1][k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (seen[ni] || isSolid(nx, ny)) continue;
        seen[ni] = 1; prev[ni] = cur; q.push(ni);
      }
    }
    if (!found) return [];
    const out = [];
    let cur = goal;
    while (cur !== sy * W + sx && cur >= 0) {
      out.push({ x: cur % W, y: (cur / W) | 0 });
      cur = prev[cur];
    }
    return out.reverse();
  }

  /* ------------------------------------------------------ player updates -- */
  function playerVisibility(p) {
    let v = 1;
    if (p.speedMode === 'sneak') v *= 0.55;
    if (p.speedMode === 'run') v *= 1.25;
    if (tileAtPx(p.x, p.y) === '%') v *= 0.18;
    if (progress.inventory.indexOf('uniform') >= 0) v *= 0.42;
    return v;
  }

  function updatePlayer(dt) {
    const p = state.player;
    let ax = 0, ay = 0, mag = 0;
    const kb = readKeyboard();
    if (kb) { ax = kb.x; ay = kb.y; mag = 1; }
    else if (stick.mag > 0.08) { ax = stick.x / (stick.mag || 1); ay = stick.y / (stick.mag || 1); mag = stick.mag; }

    const wantSneak = !!(keys['control'] || keys['c']) || (mag > 0 && mag < 0.55);
    const wantRun = !!(keys['shift'] || input.run) && p.stamina > 4;

    let sm = 'walk';
    if (wantRun && mag > 0.5) sm = 'run';
    else if (wantSneak) sm = 'sneak';
    p.speedMode = mag > 0 ? sm : 'idle';

    let sp = SPEED[sm] || SPEED.walk;
    if (SLOWTILE.has(tileAtPx(p.x, p.y))) sp *= 0.62;

    if (sm === 'run' && mag > 0) {
      p.stamina = Math.max(0, p.stamina - 26 * dt);
      if (p.stamina <= 0) p.speedMode = 'walk';
    } else {
      p.stamina = Math.min(100, p.stamina + 15 * dt);
    }

    if (mag > 0) {
      moveCircle(p, ax * sp * dt, ay * sp * dt);
      p.dir = Math.atan2(ay, ax);
      p.moving = 1;
      p.anim += dt * (sm === 'run' ? 14 : sm === 'sneak' ? 5 : 9);
      // footstep noise
      p.stepT -= dt;
      if (p.stepT <= 0) {
        p.stepT = sm === 'run' ? 0.26 : sm === 'sneak' ? 0.7 : 0.42;
        let radius = NOISE[sm === 'idle' ? 'walk' : sm] || 0;
        if (SLOWTILE.has(tileAtPx(p.x, p.y))) radius += 70;
        if (radius > 0) makeNoise(p.x, p.y, radius);
        if (sm !== 'sneak') Sound.step();
      }
    } else {
      p.moving = 0;
      p.stepT = 0;
    }
  }

  function makeNoise(x, y, radius) {
    state.noiseFx.push({ x, y, r: 0, max: radius, life: 0.5 });
    for (const g of state.guards) {
      if (g.mode === 'chase') continue;
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < radius) {
        g.mode = 'alert';
        g.target = { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
        g.route = []; g.routeT = 0; g.lookT = 2.5;
      }
    }
  }

  /* ---------------------------------------------------------- guard AI --- */
  function guardSees(g, dt) {
    const p = state.player;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    const range = g.range * (state.lockdown > 0 ? 1.25 : 1);
    if (d > range) return 0;
    const a = Math.atan2(p.y - g.y, p.x - g.x);
    const fov = g.mode === 'chase' ? g.fov * 1.7 : g.fov;
    if (Math.abs(angDiff(a, g.dir)) > fov / 2 && d > 42) return 0;
    if (!hasLOS(g.x, g.y, p.x, p.y)) return 0;
    let vis = playerVisibility(p);
    if (d < 74) vis = Math.max(vis, 0.85);            // disguise fails up close
    const near = 1 - Math.min(1, d / range);
    return Math.max(0.15, near) * vis * 1.9 * dt;
  }

  function stepAlong(g, dt, tx, ty, speed) {
    // recompute route now and then
    g.routeT -= dt;
    const gt = { x: Math.floor(g.x / TILE), y: Math.floor(g.y / TILE) };
    if (g.routeT <= 0 || !g.route.length) {
      g.routeT = 0.5;
      g.route = findPath(gt.x, gt.y, tx, ty);
    }
    if (!g.route.length) return true;
    const n = g.route[0];
    const nx = n.x * TILE + TILE / 2, ny = n.y * TILE + TILE / 2;
    let dx = nx - g.x, dy = ny - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) { g.route.shift(); return g.route.length === 0; }
    dx /= d; dy /= d;
    moveCircle(g, dx * speed * dt, dy * speed * dt);
    const want = Math.atan2(dy, dx);
    g.dir += angDiff(want, g.dir) * Math.min(1, dt * 7);
    return false;
  }

  function updateGuard(g, dt) {
    const p = state.player;
    const gain = guardSees(g, dt);
    if (gain > 0) {
      g.see = Math.min(1.4, g.see + gain);
      state.danger = Math.max(state.danger, Math.min(1, g.see));
    } else {
      g.see = Math.max(0, g.see - dt * 0.45);
    }

    if (g.see >= 1 && g.mode !== 'chase') {
      g.mode = 'chase';
      Sound.spotted();
      state.alarm = Math.min(100, state.alarm + 34);
      flash = 0.4;
      toast('“There! Hold it!”', '#ff6b5e');
      progress.seen++;
    } else if (g.see > 0.42 && g.mode === 'patrol') {
      g.mode = 'alert';
      g.target = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
      g.route = []; g.routeT = 0; g.lookT = 3;
    }

    if (state.lockdown > 0 && g.mode !== 'chase') {
      g.mode = 'alert';
      g.target = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
      if (g.routeT <= 0) g.route = [];
      g.lookT = 3;
    }

    if (g.mode === 'chase') {
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (g.see > 0.15) { g.target = { x: tx, y: ty }; g.routeT = Math.min(g.routeT, 0.2); }
      stepAlong(g, dt, g.target.x, g.target.y, g.speed * 1.5);
      state.alarm = Math.min(100, state.alarm + dt * 16);
      if (Math.hypot(p.x - g.x, p.y - g.y) < 21) busted();
      if (g.see <= 0) {
        g.lookT -= dt;
        if (g.lookT <= 0) { g.mode = 'search'; g.lookT = 4; }
      } else g.lookT = 3.5;
    } else if (g.mode === 'alert') {
      const done = stepAlong(g, dt, g.target.x, g.target.y, g.speed * 1.15);
      if (done) {
        g.lookT -= dt;
        g.dir += dt * 2.1;
        if (g.lookT <= 0) { g.mode = 'patrol'; g.route = []; g.routeT = 0; }
      }
    } else if (g.mode === 'search') {
      g.lookT -= dt;
      g.dir += dt * 1.7;
      if (g.lookT <= 0) { g.mode = 'patrol'; g.route = []; g.routeT = 0; }
    } else {
      // patrol
      if (g.pause > 0) { g.pause -= dt; g.dir += dt * 0.9; return; }
      const wp = g.path[g.wp];
      const done = stepAlong(g, dt, wp[0], wp[1], g.speed);
      if (done) {
        g.wp = (g.wp + 1) % g.path.length;
        g.route = []; g.routeT = 0;
        g.pause = 0.6 + Math.random() * 1.2;
      }
    }
  }

  /* -------------------------------------------------- cameras and lights -- */
  function updateCamera(c, dt) {
    if (state.powerOff) { c.see = Math.max(0, c.see - dt); return; }
    c.t += dt;
    c.dir = c.base + Math.sin(c.t * c.speed / (c.sweep || 1)) * c.sweep / 2;
    const p = state.player;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    let seen = false;
    if (d < c.range && Math.abs(angDiff(Math.atan2(p.y - c.y, p.x - c.x), c.dir)) < c.fov / 2) {
      if (hasLOS(c.x, c.y, p.x, p.y) && tileAtPx(p.x, p.y) !== '%') seen = true;
    }
    if (seen) {
      c.see = Math.min(1.2, c.see + dt * 0.85 * playerVisibility(p));
      state.danger = Math.max(state.danger, Math.min(1, c.see));
      if (c.see >= 1) {
        c.see = 0.4;
        state.alarm = Math.min(100, state.alarm + 40);
        toast('Camera has you — control room is calling it in', '#ffcf5e');
        Sound.alarm();
        alertGuards(p.x, p.y);
      }
    } else c.see = Math.max(0, c.see - dt * 0.5);
  }

  function updateLight(l, dt) {
    const wp = l.path[l.wp];
    const tx = wp[0] * TILE + TILE / 2, ty = wp[1] * TILE + TILE / 2;
    let dx = tx - l.x, dy = ty - l.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) { l.wp = (l.wp + 1) % l.path.length; }
    else { l.x += dx / d * l.speed * dt; l.y += dy / d * l.speed * dt; }

    const p = state.player;
    const inside = Math.hypot(p.x - l.x, p.y - l.y) < l.radius && tileAtPx(p.x, p.y) !== '%';
    if (inside) {
      l.see = Math.min(1.2, l.see + dt * 0.8 * playerVisibility(p));
      state.danger = Math.max(state.danger, Math.min(1, l.see));
      if (l.see >= 1) {
        l.see = 0.3;
        state.alarm = Math.min(100, state.alarm + 45);
        toast('Searchlight pins you to the gravel', '#ffcf5e');
        Sound.alarm();
        alertGuards(p.x, p.y);
      }
    } else l.see = Math.max(0, l.see - dt * 0.55);
  }

  function alertGuards(x, y) {
    for (const g of state.guards) {
      g.mode = 'alert';
      g.target = { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
      g.route = []; g.routeT = 0; g.lookT = 4;
    }
  }

  /* ------------------------------------------------------- interactions -- */
  function nearbyTiles(px, py) {
    const out = [];
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    for (let y = ty - 1; y <= ty + 1; y++)
      for (let x = tx - 1; x <= tx + 1; x++) out.push({ x, y });
    return out;
  }

  function takeItem(it) {
    it.taken = true;
    if (progress.inventory.indexOf(it.id) < 0) progress.inventory.push(it.id);
    Sound.pickup();
    toast(it.found || ('Picked up ' + it.name), '#7ee08a');
    for (let i = 0; i < 14; i++)
      state.sparks.push({
        x: it.x * TILE + 16, y: it.y * TILE + 16,
        vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, life: 0.6, c: '#ffe27a'
      });
    if (it.effect === 'power') { state.powerOff = true; toast('The cameras are dead. Move.', '#8fd4ff'); }
    if (it.effect === 'light') { state.lampLit = true; }
    renderHUD();
    save();
  }

  function doAction() {
    const p = state.player;
    // 1. containers / items
    for (const it of state.items) {
      if (it.taken) continue;
      const d = Math.hypot(p.x - (it.x * TILE + 16), p.y - (it.y * TILE + 16));
      if (d < 42) { takeItem(it); return; }
    }
    // 2. doors & fences
    for (const t of nearbyTiles(p.x, p.y)) {
      const ch = tileAt(t.x, t.y);
      const d = Math.hypot(p.x - (t.x * TILE + 16), p.y - (t.y * TILE + 16));
      if (d > 44) continue;
      if (LOCKS.has(ch)) {
        const lock = state.def.locks[ch];
        if (progress.inventory.indexOf(lock.item) >= 0) {
          state.grid[t.y][t.x] = '+';
          mapDirty = true;
          Sound.door();
          toast('Unlocked. ' + (lock.opened || 'The door swings in.'), '#8fd4ff');
        } else {
          Sound.denied();
          toast(lock.label, '#ffcf5e');
        }
        return;
      }
      if (ch === 'F') {
        if (progress.inventory.indexOf('cutters') >= 0) {
          state.grid[t.y][t.x] = ',';
          mapDirty = true;
          Sound.door();
          toast('The links part with a snap.', '#8fd4ff');
          makeNoise(p.x, p.y, 120);
        } else {
          Sound.denied();
          toast('Chain-link. You need wire cutters.', '#ffcf5e');
        }
        return;
      }
    }
    // 3. exit
    const ex = state.exit.x * TILE + 16, ey = state.exit.y * TILE + 16;
    if (Math.hypot(p.x - ex, p.y - ey) < 46) tryExit();
    else toast('Nothing here.', '#9aa4bb');
  }

  function tryExit() {
    const need = (state.def.exitRequires || []).filter((id) => progress.inventory.indexOf(id) < 0);
    if (need.length) {
      Sound.denied();
      const nice = need.map((id) => {
        const f = (state.def.items || []).find((i) => i.id === id);
        return f ? f.name : id;
      }).join(', ');
      toast('You still need: ' + nice, '#ffcf5e');
      return;
    }
    levelClear();
  }

  /* ------------------------------------------------------------- toasts -- */
  function toast(text, color) {
    toasts.push({ text, color: color || '#e8ecf6', life: 3.4 });
    if (toasts.length > 3) toasts.shift();
    renderToasts();
  }
  function renderToasts() {
    const box = $('toasts');
    box.innerHTML = '';
    for (const t of toasts) {
      const d = document.createElement('div');
      d.className = 'toast';
      d.style.color = t.color;
      d.style.opacity = Math.min(1, t.life / 0.7);
      d.textContent = t.text;
      box.appendChild(d);
    }
  }

  /* ------------------------------------------------------ flow / screens -- */
  function showScreen(id, html) {
    const el = $('overlay');
    el.style.display = 'flex';
    el.innerHTML = html;
    el.dataset.screen = id;
  }
  function hideScreen() { $('overlay').style.display = 'none'; $('overlay').innerHTML = ''; }

  function fmt(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function titleScreen() {
    mode = 'title';
    const s = loadSave();
    showScreen('title', `
      <div class="card title-card">
        <div class="bars"><i></i><i></i><i></i><i></i><i></i></div>
        <h1>ESCAPE FROM<br><span>BLACKGATE</span></h1>
        <p class="tag">Five wings. Two hundred metres of wire. One night.</p>
        <button class="btn primary" data-act="new">NEW ESCAPE</button>
        ${s ? `<button class="btn" data-act="continue">CONTINUE — ${LEVELS[s.level].name}</button>` : ''}
        <button class="btn ghost" data-act="how">HOW TO PLAY</button>
        <p class="fine">Move quietly. Guards see cones, not corners.</p>
      </div>`);
  }

  function howScreen() {
    showScreen('how', `
      <div class="card">
        <h2>How to play</h2>
        <ul class="how">
          <li><b>Move</b> — drag anywhere on the left of the screen (or WASD / arrows).</li>
          <li><b>Sneak</b> — push the stick gently. Slow, silent, much harder to spot.</li>
          <li><b>Run</b> — the RUN button (or Shift). Fast, loud, drains stamina.</li>
          <li><b>ACTION</b> — search bunks, lockers, carts; unlock doors; cut fence; use the exit.</li>
          <li><b>Vision cones</b> turn yellow when a guard is unsure and red when they have you.</li>
          <li>Get caught three times and you go back to the hole. Items you found stay found.</li>
        </ul>
        <button class="btn primary" data-act="back">BACK</button>
      </div>`);
  }

  function briefScreen() {
    mode = 'brief';
    const def = LEVELS[progress.level];
    showScreen('brief', `
      <div class="card">
        <div class="chapter">CHAPTER ${def.id} / ${LEVELS.length} &nbsp;·&nbsp; ${def.time}</div>
        <h2>${def.name}</h2>
        <div class="brief">${def.brief.map((l) => `<p>${l}</p>`).join('')}</div>
        <div class="objective"><span>OBJECTIVE</span>${def.objective}</div>
        <div class="tip">💡 ${def.tip}</div>
        <button class="btn primary" data-act="start">GO</button>
      </div>`);
  }

  function startLevel() {
    buildLevel(progress.level);
    mode = 'play';
    hideScreen();
    renderHUD();
    toast(state.def.objective, '#cfe0ff');
  }

  function busted() {
    if (mode !== 'play') return;
    mode = 'busted';
    progress.busts++;
    progress.lives--;
    Sound.busted();
    shake = 0.6;
    save();
    if (progress.lives <= 0) {
      mode = 'over';
      showScreen('over', `
        <div class="card">
          <h2 class="bad">BACK IN THE HOLE</h2>
          <p class="brief">They walk you back past the block with your arms behind you.<br>
          Thirty days in segregation. Then you start again.</p>
          <p class="stats">Time served tonight: <b>${fmt(progress.total)}</b> · Caught <b>${progress.busts}×</b></p>
          <button class="btn primary" data-act="retry">TRY AGAIN</button>
          <button class="btn ghost" data-act="title">MAIN MENU</button>
        </div>`);
      return;
    }
    showScreen('busted', `
      <div class="card">
        <h2 class="bad">CAUGHT</h2>
        <p class="brief">A hand on your collar. They march you back to the start of the wing —
        but they do not find what you are carrying.</p>
        <p class="stats">Chances left: <b>${'●'.repeat(progress.lives)}${'○'.repeat(3 - progress.lives)}</b></p>
        <button class="btn primary" data-act="respawn">KEEP GOING</button>
      </div>`);
  }

  function respawn() {
    const p = state.player;
    p.x = state.start.x; p.y = state.start.y; p.stamina = 100;
    state.alarm = 25; state.lockdown = 0; state.danger = 0;
    for (const g of state.guards) {
      g.x = g.path[0][0] * TILE + TILE / 2;
      g.y = g.path[0][1] * TILE + TILE / 2;
      g.mode = 'patrol'; g.see = 0; g.wp = 1 % g.path.length; g.route = []; g.routeT = 0;
    }
    for (const c of state.cameras) c.see = 0;
    for (const l of state.lights) l.see = 0;
    mode = 'play';
    hideScreen();
  }

  function levelClear() {
    Sound.win();
    mode = 'clear';
    const last = progress.level >= LEVELS.length - 1;
    progress.level = Math.min(LEVELS.length - 1, progress.level + 1);
    if (last) progress.level = LEVELS.length - 1;
    save();
    if (last) return victory();
    showScreen('clear', `
      <div class="card">
        <div class="chapter">CHAPTER CLEAR</div>
        <h2 class="good">${state.def.name} — behind you</h2>
        <p class="stats">Elapsed <b>${fmt(progress.total)}</b> · Chances left <b>${progress.lives}</b> · Spotted <b>${progress.seen}×</b></p>
        <button class="btn primary" data-act="next">NEXT: ${LEVELS[progress.level].name.toUpperCase()}</button>
      </div>`);
  }

  function victory() {
    mode = 'win';
    const rank = progress.seen === 0 ? 'GHOST — nobody ever saw you'
      : progress.busts === 0 ? 'CLEAN — seen, never caught'
        : progress.busts <= 2 ? 'LUCKY — you talked your way out twice'
          : 'RAGGED — but out is out';
    showScreen('win', `
      <div class="card">
        <div class="chapter">00:51 · THE ROAD NORTH</div>
        <h2 class="good">YOU ARE OUT</h2>
        <div class="brief">
          <p>The manhole cover grinds sideways and the night comes in cold and enormous.</p>
          <p>Behind you the siren is a small thing, getting smaller.</p>
          <p>Somewhere north there is a bus, a name that is not yours, and a morning.</p>
        </div>
        <p class="stats">Total time <b>${fmt(progress.total)}</b> · Caught <b>${progress.busts}×</b> · Spotted <b>${progress.seen}×</b></p>
        <p class="rank">${rank}</p>
        <button class="btn primary" data-act="newgame">ESCAPE AGAIN</button>
      </div>`);
    try { localStorage.removeItem('blackgate.save'); } catch (e) { /* ignore */ }
  }

  function togglePause() {
    if (mode === 'play') {
      mode = 'pause';
      showScreen('pause', `
        <div class="card">
          <h2>PAUSED</h2>
          <div class="objective"><span>OBJECTIVE</span>${state.def.objective}</div>
          <p class="stats">${state.def.name} · Elapsed ${fmt(progress.total)}</p>
          <button class="btn primary" data-act="resume">RESUME</button>
          <button class="btn ghost" data-act="mute">${Sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON'}</button>
          <button class="btn ghost" data-act="title">GIVE UP</button>
        </div>`);
    } else if (mode === 'pause') { mode = 'play'; hideScreen(); }
  }

  /* overlay button routing */
  $('overlay').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    Sound.unlock();
    const act = b.dataset.act;
    if (act === 'new' || act === 'newgame' || act === 'retry') {
      progress.level = act === 'retry' ? progress.level : 0;
      progress.lives = 3;
      if (act !== 'retry') { progress.total = 0; progress.inventory = []; progress.busts = 0; progress.seen = 0; }
      save(); briefScreen();
    } else if (act === 'continue') {
      const s = loadSave();
      Object.assign(progress, s);
      progress.lives = Math.max(1, progress.lives);
      briefScreen();
    } else if (act === 'how') howScreen();
    else if (act === 'back') titleScreen();
    else if (act === 'start' || act === 'next') {
      if (act === 'next') briefScreen();
      else startLevel();
    } else if (act === 'respawn') respawn();
    else if (act === 'resume') togglePause();
    else if (act === 'mute') { Sound.toggleMute(); b.textContent = Sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON'; }
    else if (act === 'title') titleScreen();
  });
  $('btn-pause').addEventListener('click', () => { Sound.unlock(); togglePause(); });

  /* ------------------------------------------------------------- render -- */
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function viewScale() {
    const short = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(0.75, Math.min(2.4, short / (11.5 * TILE)));
  }

  function drawMapLayer() {
    const W = state.W * TILE, H = state.H * TILE;
    if (!mapCanvas) mapCanvas = document.createElement('canvas');
    mapCanvas.width = W; mapCanvas.height = H;
    const g = mapCanvas.getContext('2d');
    const outdoor = state.def.id === 4;

    g.fillStyle = outdoor ? '#23262c' : '#161a24';
    g.fillRect(0, 0, W, H);

    for (let y = 0; y < state.H; y++) {
      for (let x = 0; x < state.W; x++) {
        const ch = state.grid[y][x];
        const px = x * TILE, py = y * TILE;
        // floor base
        if (ch !== '#') {
          const shade = ((x * 7 + y * 13) % 5) * 3;
          if (ch === ',') g.fillStyle = `rgb(${58 + shade},${56 + shade},${47 + shade})`;
          else if (ch === '~') g.fillStyle = `rgb(${30 + shade},${58 + shade},${78 + shade})`;
          else g.fillStyle = `rgb(${44 + shade},${49 + shade},${64 + shade})`;
          g.fillRect(px, py, TILE, TILE);
          g.strokeStyle = 'rgba(0,0,0,.30)';
          g.strokeRect(px + .5, py + .5, TILE - 1, TILE - 1);
          if (ch === ',') {                             // gravel speckle
            g.fillStyle = 'rgba(255,255,255,.05)';
            for (let s = 0; s < 3; s++)
              g.fillRect(px + ((x * 13 + s * 11 + y * 5) % 28) + 2, py + ((y * 17 + s * 7 + x * 3) % 28) + 2, 2, 2);
          }
        }
        switch (ch) {
          case '#': {
            g.fillStyle = '#5f6880';                    // concrete face
            g.fillRect(px, py, TILE, TILE);
            g.fillStyle = 'rgba(0,0,0,.20)';            // mortar courses
            for (let r = 0; r < 3; r++) g.fillRect(px, py + 9 + r * 11, TILE, 2);
            const off = y % 2 === 0 ? 0 : 16;
            for (let r = 0; r < 3; r++) g.fillRect(px + ((off + r * 16) % TILE), py + r * 11, 2, 11);
            g.fillStyle = 'rgba(255,255,255,.13)';      // top highlight
            g.fillRect(px, py, TILE, 3);
            g.fillStyle = 'rgba(0,0,0,.42)';            // grounded shadow
            g.fillRect(px, py + TILE - 4, TILE, 4);
            break;
          }
          case 'B': // bunk
            g.fillStyle = '#4a4032'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            g.fillStyle = '#6b6154'; g.fillRect(px + 4, py + 5, TILE - 8, TILE - 14);
            g.fillStyle = '#8a8375'; g.fillRect(px + 5, py + 6, TILE - 10, 6);
            break;
          case 'L': // locker
            g.fillStyle = '#3a4a56'; g.fillRect(px + 2, py + 1, TILE - 4, TILE - 2);
            g.fillStyle = '#4d616f'; g.fillRect(px + 4, py + 3, TILE - 8, TILE - 6);
            g.fillStyle = '#22303a'; g.fillRect(px + TILE / 2 - 1, py + 4, 2, TILE - 8);
            g.fillStyle = '#c9d4dd'; g.fillRect(px + TILE / 2 - 6, py + 14, 3, 3);
            break;
          case 'c': // crate
            g.fillStyle = '#5a4a33'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            g.strokeStyle = '#7a6746'; g.lineWidth = 2;
            g.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
            g.beginPath(); g.moveTo(px + 4, py + 4); g.lineTo(px + TILE - 4, py + TILE - 4); g.stroke();
            break;
          case 'k': // laundry cart
            g.fillStyle = '#3e4a5c'; g.fillRect(px + 3, py + 6, TILE - 6, TILE - 10);
            g.fillStyle = '#c3c9d6'; g.fillRect(px + 5, py + 3, TILE - 10, 8);
            g.fillStyle = '#222'; g.fillRect(px + 5, py + TILE - 5, 4, 4);
            g.fillRect(px + TILE - 9, py + TILE - 5, 4, 4);
            break;
          case 'T': // table
            g.fillStyle = '#4b3f30'; g.fillRect(px + 1, py + 6, TILE - 2, TILE - 12);
            g.fillStyle = '#5e5040'; g.fillRect(px + 1, py + 6, TILE - 2, 5);
            break;
          case '%': // bush
            g.fillStyle = '#26402c';
            for (let i = 0; i < 5; i++) {
              g.beginPath();
              g.arc(px + 8 + (i * 7) % 18, py + 9 + ((i * 11) % 15), 8, 0, 7);
              g.fill();
            }
            g.fillStyle = '#2f5238';
            g.beginPath(); g.arc(px + 16, py + 15, 9, 0, 7); g.fill();
            break;
          case 'F': // fence
            g.strokeStyle = '#8d97a8'; g.lineWidth = 1.4;
            for (let i = -TILE; i < TILE; i += 7) {
              g.beginPath(); g.moveTo(px + i, py); g.lineTo(px + i + TILE, py + TILE); g.stroke();
              g.beginPath(); g.moveTo(px + i + TILE, py); g.lineTo(px + i, py + TILE); g.stroke();
            }
            g.fillStyle = '#6d7686';
            g.fillRect(px + 14, py, 4, TILE);
            break;
          case 'W': // watchtower base
            g.fillStyle = '#3b3f4a'; g.fillRect(px, py, TILE, TILE);
            g.fillStyle = '#585f6e'; g.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
            break;
          case '+': // open doorway
            g.fillStyle = '#2a3040'; g.fillRect(px, py, TILE, TILE);
            g.fillStyle = '#3d4658'; g.fillRect(px + 2, py + 2, 5, TILE - 4);
            g.fillRect(px + TILE - 7, py + 2, 5, TILE - 4);
            break;
          case '1': case '2': case '3': case '4': {
            g.fillStyle = '#6b4a2a'; g.fillRect(px, py, TILE, TILE);
            g.fillStyle = '#7d5832'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            g.fillStyle = '#e8c56a';
            g.beginPath(); g.arc(px + TILE - 9, py + TILE / 2, 3.2, 0, 7); g.fill();
            g.fillStyle = 'rgba(0,0,0,.35)';
            g.fillRect(px + 6, py + 8, 4, TILE - 16);
            break;
          }
          case '~':
            g.fillStyle = 'rgba(120,190,220,.18)';
            g.fillRect(px + 3, py + 6, TILE - 6, 3);
            g.fillRect(px + 7, py + 18, TILE - 14, 3);
            break;
          default: break;
        }
      }
    }
    // exit marker
    const ex = state.exit.x * TILE, ey = state.exit.y * TILE;
    g.fillStyle = 'rgba(120,230,150,.16)';
    g.fillRect(ex, ey, TILE, TILE);
    g.strokeStyle = '#77e6a0'; g.lineWidth = 2;
    g.setLineDash([5, 4]);
    g.strokeRect(ex + 2, ey + 2, TILE - 4, TILE - 4);
    g.setLineDash([]);
    mapDirty = false;
  }

  function drawPerson(g, x, y, dir, body, head, anim, moving) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(0, 5, 11, 6, 0, 0, 7); g.fill();
    g.rotate(dir + Math.PI / 2);
    const sw = moving ? Math.sin(anim) * 3 : 0;
    g.fillStyle = body;
    g.fillRect(-7, -3 + sw * 0.3, 5, 9);   // legs
    g.fillRect(2, -3 - sw * 0.3, 5, 9);
    g.beginPath(); g.ellipse(0, -2, 9, 8, 0, 0, 7); g.fill();  // torso
    g.fillStyle = head;
    g.beginPath(); g.arc(0, -6, 5.6, 0, 7); g.fill();          // head
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(-2, -11.5, 4, 2.5);                             // facing pip
    g.restore();
  }

  function drawCone(g, x, y, dir, fov, range, t) {
    const grd = g.createRadialGradient(x, y, 8, x, y, range);
    const col = t > 0.75 ? '255,90,80' : t > 0.35 ? '255,200,80' : '255,240,190';
    grd.addColorStop(0, `rgba(${col},${0.20 + t * 0.22})`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const a = dir - fov / 2 + (fov * i) / steps;
      let r = range;
      // shorten ray at first wall
      for (let d = 12; d < range; d += 10) {
        if (isOpaque(Math.floor((x + Math.cos(a) * d) / TILE), Math.floor((y + Math.sin(a) * d) / TILE))) { r = d; break; }
      }
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }

  function render() {
    const g = ctx2d;
    const vw = window.innerWidth, vh = window.innerHeight;
    g.fillStyle = '#0a0c11';
    g.fillRect(0, 0, vw, vh);
    if (!state) return;
    if (mapDirty) drawMapLayer();

    const sc = viewScale();
    const p = state.player;
    let camX = p.x - vw / (2 * sc), camY = p.y - vh / (2 * sc);
    camX = Math.max(0, Math.min(state.W * TILE - vw / sc, camX));
    camY = Math.max(0, Math.min(state.H * TILE - vh / sc, camY));
    if (state.W * TILE < vw / sc) camX = (state.W * TILE - vw / sc) / 2;
    if (state.H * TILE < vh / sc) camY = (state.H * TILE - vh / sc) / 2;

    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    g.scale(sc, sc);
    g.translate(-camX, -camY);

    g.drawImage(mapCanvas, 0, 0);

    // searchlights
    for (const l of state.lights || []) {
      const grd = g.createRadialGradient(l.x, l.y, 6, l.x, l.y, l.radius);
      grd.addColorStop(0, 'rgba(255,246,200,.42)');
      grd.addColorStop(0.65, 'rgba(255,240,180,.16)');
      grd.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(l.x, l.y, l.radius, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,250,220,.30)'; g.lineWidth = 2;
      g.beginPath(); g.arc(l.x, l.y, l.radius * 0.96, 0, 7); g.stroke();
    }

    // cameras
    for (const c of state.cameras || []) {
      if (!state.powerOff) drawCone(g, c.x, c.y, c.dir, c.fov, c.range, c.see);
      g.save();
      g.translate(c.x, c.y); g.rotate(c.dir);
      g.fillStyle = state.powerOff ? '#4a505e' : '#6d7a90';
      g.fillRect(-6, -5, 14, 10);
      g.fillStyle = state.powerOff ? '#333' : (c.see > 0.4 ? '#ff5a50' : '#8de08a');
      g.beginPath(); g.arc(9, 0, 3, 0, 7); g.fill();
      g.restore();
    }

    // items
    for (const it of state.items) {
      if (it.taken) continue;
      const bob = Math.sin(state.time * 3 + it.x) * 2;
      const cx = it.x * TILE + 16, cy = it.y * TILE + 16 + bob;
      g.save();
      g.globalAlpha = 0.9;
      g.fillStyle = 'rgba(255,226,122,.22)';
      g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill();
      g.restore();
      g.font = '18px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(it.icon, cx, cy);
    }

    // noise rings
    for (const n of state.noiseFx) {
      g.strokeStyle = `rgba(200,220,255,${Math.max(0, n.life)})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(n.x, n.y, n.r, 0, 7); g.stroke();
    }

    // guards
    for (const gu of state.guards) {
      drawCone(g, gu.x, gu.y, gu.dir, gu.mode === 'chase' ? gu.fov * 1.7 : gu.fov, gu.range, gu.see);
      drawPerson(g, gu.x, gu.y, gu.dir, gu.mode === 'chase' ? '#3f5f9c' : '#41506e', '#c9a887',
        state.time * 8, gu.mode !== 'patrol' || true);
      if (gu.see > 0.35 || gu.mode !== 'patrol') {
        g.font = 'bold 16px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillStyle = gu.mode === 'chase' || gu.see >= 1 ? '#ff6b5e' : '#ffcf5e';
        g.fillText(gu.mode === 'chase' || gu.see >= 1 ? '!' : '?', gu.x, gu.y - 20);
      }
    }

    // player (always ringed, so a disguise never loses you in the crowd)
    const disguised = progress.inventory.indexOf('uniform') >= 0;
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(p.x, p.y + 6, 13, 7, 0, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.10)';
    g.beginPath(); g.ellipse(p.x, p.y + 6, 13, 7, 0, 0, 7); g.fill();
    drawPerson(g, p.x, p.y, p.dir, disguised ? '#5b7099' : '#e07a2b', '#d8b08c', p.anim, p.moving);

    // sparks
    for (const s of state.sparks) {
      g.fillStyle = s.c;
      g.globalAlpha = Math.max(0, s.life);
      g.fillRect(s.x, s.y, 2.5, 2.5);
      g.globalAlpha = 1;
    }

    g.restore();

    // darkness
    if (state.def.dark) {
      const radius = (state.lampLit ? 275 : 165) * sc;
      const px = (p.x - camX) * sc, py = (p.y - camY) * sc;
      const grd = g.createRadialGradient(px, py, radius * 0.2, px, py, radius);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.55, 'rgba(0,0,0,.42)');
      grd.addColorStop(1, 'rgba(4,5,8,.95)');
      g.fillStyle = grd;
      g.fillRect(0, 0, vw, vh);
    }

    // spotted flash / alarm vignette
    if (flash > 0) {
      g.fillStyle = `rgba(255,60,50,${flash * 0.35})`;
      g.fillRect(0, 0, vw, vh);
    } else if (state.alarm > 45) {
      const a = (state.alarm - 45) / 55;
      const pulse = 0.12 + Math.sin(state.time * 6) * 0.06;
      const grd = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
      grd.addColorStop(0, 'rgba(255,0,0,0)');
      grd.addColorStop(1, `rgba(255,40,30,${a * pulse + 0.05})`);
      g.fillStyle = grd;
      g.fillRect(0, 0, vw, vh);
    }
  }

  /* ----------------------------------------------------------------- HUD -- */
  function renderHUD() {
    if (!state) return;
    $('hud-level').textContent = state.def.name;
    $('hud-obj').textContent = state.def.objective;
    $('hud-lives').textContent = '●'.repeat(progress.lives) + '○'.repeat(Math.max(0, 3 - progress.lives));
    const inv = $('hud-inv');
    inv.innerHTML = '';
    for (const it of (state.def.items || [])) {
      const has = progress.inventory.indexOf(it.id) >= 0;
      const d = document.createElement('span');
      d.className = 'slot' + (has ? ' has' : '');
      d.textContent = has ? it.icon : '·';
      d.title = it.name;
      inv.appendChild(d);
    }
    const carried = ['uniform', 'cutters', 'keycard'].filter((id) =>
      progress.inventory.indexOf(id) >= 0 && !(state.def.items || []).some((i) => i.id === id));
    for (const id of carried) {
      const d = document.createElement('span');
      d.className = 'slot has kept';
      d.textContent = id === 'uniform' ? '👕' : id === 'cutters' ? '✂️' : '💳';
      inv.appendChild(d);
    }
  }

  function updateHUDBars() {
    $('bar-alarm').style.width = state.alarm + '%';
    $('bar-eye').style.width = Math.min(100, state.danger * 100) + '%';
    $('bar-stam').style.width = state.player.stamina + '%';
    $('hud-time').textContent = fmt(progress.total);
    const lock = $('lockdown');
    lock.style.display = state.lockdown > 0 ? 'block' : 'none';
  }

  /* ------------------------------------------------------------ main loop */
  function tick(ts) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0);
    lastT = ts;

    if (state && mode === 'play') {
      state.time += dt;
      progress.total += dt;

      state.danger = Math.max(0, state.danger - dt * 0.8);
      updatePlayer(dt);

      for (const g of state.guards) updateGuard(g, dt);
      for (const c of state.cameras || []) updateCamera(c, dt);
      for (const l of state.lights || []) updateLight(l, dt);

      // alarm bookkeeping
      const chasing = state.guards.some((g) => g.mode === 'chase');
      if (!chasing) state.alarm = Math.max(0, state.alarm - dt * 5.5);
      if (state.alarm >= 100 && state.lockdown <= 0) {
        state.lockdown = 9;
        Sound.alarm();
        toast('LOCKDOWN — they are sweeping the wing', '#ff6b5e');
      }
      if (state.lockdown > 0) {
        state.lockdown -= dt;
        if (state.lockdown <= 0) { state.alarm = 55; toast('The sweep moves on…', '#9aa4bb'); }
      }

      // walk-over pickups + exit
      const p = state.player;
      for (const it of state.items) {
        if (it.taken || it.container) continue;
        if (Math.hypot(p.x - (it.x * TILE + 16), p.y - (it.y * TILE + 16)) < 20) takeItem(it);
      }
      if (Math.hypot(p.x - (state.exit.x * TILE + 16), p.y - (state.exit.y * TILE + 16)) < 18) tryExit();

      // action button
      if (input.action) { input.action = false; doAction(); }

      // fx
      for (const n of state.noiseFx) { n.life -= dt * 2; n.r += dt * n.max * 2.2; }
      state.noiseFx = state.noiseFx.filter((n) => n.life > 0);
      for (const s of state.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
      state.sparks = state.sparks.filter((s) => s.life > 0);

      let dirty = false;
      for (const t of toasts) { t.life -= dt; if (t.life <= 0) dirty = true; }
      if (dirty) { toasts = toasts.filter((t) => t.life > 0); renderToasts(); }

      updateHUDBars();
    } else {
      input.action = false;
    }

    if (shake > 0) shake = Math.max(0, shake - dt * 1.6);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);

    render();
  }

  /* ------------------------------------------------------------ bootstrap */
  function boot() {
    resize();
    setupTouch();
    document.addEventListener('touchstart', Sound.unlock, { once: true });
    document.addEventListener('mousedown', Sound.unlock, { once: true });
    buildLevel(0);            // something to draw behind the title card
    mode = 'title';
    titleScreen();
    requestAnimationFrame(tick);
  }

  /* small hook used by the automated play-through test in tools/playtest.js */
  window.__blackgate = {
    get state() { return state; },
    get progress() { return progress; },
    get mode() { return mode; },
    tp(tx, ty) { state.player.x = tx * TILE + 16; state.player.y = ty * TILE + 16; },
    act() { doAction(); }
  };

  if (window.cordova) document.addEventListener('deviceready', boot, false);
  else window.addEventListener('load', boot);
})();
