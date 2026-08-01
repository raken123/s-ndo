/* ==========================================================================
   Escape from Blackgate — first-person stealth escape
   --------------------------------------------------------------------------
   Game rules live on the 32px logic tile grid (movement, hearing, vision,
   pathfinding); the world is drawn in 3D from that same grid by world.js.
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------- constants -- */
  const TILE = 32;
  const WS = World.WS;                                  // logic px -> world units
  const SOLID = new Set(['#', 'B', 'T', 'L', 'c', 'k', 'F', 'W', '1', '2', '3', '4']);
  const OPAQUE = new Set(['#', 'B', 'L', 'c', 'k', 'W', '%', '1', '2', '3', '4']);
  const CONTAINER = new Set(['B', 'L', 'c', 'k']);
  const LOCKS = new Set(['1', '2', '3', '4']);
  const SLOWTILE = new Set(['~']);

  const SPEED = { sneak: 60, walk: 108, run: 172 };
  const NOISE = { sneak: 0, walk: 74, run: 205 };
  const EYE = { sneak: 1.05, walk: 1.62, run: 1.58, idle: 1.62 };
  const LOOK_SENS = { mouse: 0.0022, touch: 0.0052 };
  const REACH = 58;                                     // interaction range, logic px

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
      win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.13), i * 130)); },
      step(wet) { blip((wet ? 90 : 130) + Math.random() * 40, 0.05, 'triangle', 0.035); }
    };
  })();

  /* --------------------------------------------------------------- input -- */
  const keys = Object.create(null);
  const input = { action: false, run: false, lookX: 0, lookY: 0 };
  const stick = { id: null, x: 0, y: 0, mag: 0, bx: 0, by: 0 };
  const look = { id: null, lx: 0, ly: 0 };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') input.action = true;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function setupInput() {
    /* any touch at all switches the UI to touch mode */
    const goTouch = () => { isTouch = true; document.body.classList.add('touch'); };
    if (isTouch) goTouch();
    document.addEventListener('touchstart', goTouch, { capture: true });

    /* --- mouse look with pointer lock (desktop) --- */
    const cv = $('game');
    document.addEventListener('click', (e) => {
      Sound.unlock();
      if (isTouch || mode !== 'play') return;
      if (e.target.closest('#overlay, #buttons, #btn-pause')) return;
      if (document.pointerLockElement !== cv) cv.requestPointerLock();
      else input.action = true;
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv && mode === 'play') {
        input.lookX += e.movementX * LOOK_SENS.mouse;
        input.lookY += e.movementY * LOOK_SENS.mouse;
      }
    });

    /* --- touch: left half moves, right half looks --- */
    const moveZone = $('touch-left'), lookZone = $('touch-right');
    const stickEl = $('stick'), stickNub = $('stick-nub');

    moveZone.addEventListener('touchstart', (e) => {
      isTouch = true;
      const t = e.changedTouches[0];
      stick.id = t.identifier; stick.bx = t.clientX; stick.by = t.clientY;
      stickEl.style.display = 'block';
      stickEl.style.left = t.clientX + 'px';
      stickEl.style.top = t.clientY + 'px';
      stickNub.style.transform = 'translate(-50%,-50%)';
      e.preventDefault();
    }, { passive: false });
    moveZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stick.id) continue;
        let dx = t.clientX - stick.bx, dy = t.clientY - stick.by;
        const d = Math.hypot(dx, dy), max = 54, cl = Math.min(d, max);
        if (d > 0) { dx = dx / d * cl; dy = dy / d * cl; }
        stick.x = dx / max; stick.y = dy / max; stick.mag = cl / max;
        stickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      e.preventDefault();
    }, { passive: false });
    const endMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== stick.id) continue;
        stick.id = null; stick.mag = 0; stick.x = stick.y = 0;
        stickEl.style.display = 'none';
      }
    };
    moveZone.addEventListener('touchend', endMove);
    moveZone.addEventListener('touchcancel', endMove);

    lookZone.addEventListener('touchstart', (e) => {
      isTouch = true;
      const t = e.changedTouches[0];
      look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY;
      e.preventDefault();
    }, { passive: false });
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== look.id) continue;
        input.lookX += (t.clientX - look.lx) * LOOK_SENS.touch;
        input.lookY += (t.clientY - look.ly) * LOOK_SENS.touch;
        look.lx = t.clientX; look.ly = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const endLook = (e) => {
      for (const t of e.changedTouches) if (t.identifier === look.id) look.id = null;
    };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

    /* --- buttons --- */
    const press = (el, down, up) => {
      el.addEventListener('touchstart', (e) => { e.preventDefault(); isTouch = true; Sound.unlock(); down(); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); if (up) up(); }, { passive: false });
      el.addEventListener('mousedown', (e) => { e.preventDefault(); Sound.unlock(); down(); });
      el.addEventListener('mouseup', (e) => { e.preventDefault(); if (up) up(); });
    };
    press($('btn-action'), () => { input.action = true; });
    press($('btn-run'), () => { input.run = true; $('btn-run').classList.add('held'); },
      () => { input.run = false; $('btn-run').classList.remove('held'); });
    const sneakBtn = $('btn-sneak');
    press(sneakBtn, () => { sneakHeld = !sneakHeld; sneakBtn.classList.toggle('held', sneakHeld); });
  }

  let isTouch = ('ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;
  let sneakHeld = false;

  /* --------------------------------------------------------------- state -- */
  let state = null;
  const progress = { level: 0, lives: 3, total: 0, inventory: [], busts: 0, seen: 0 };
  let mode = 'title';
  let lastT = 0, toasts = [], shake = 0, flash = 0;

  let renderer = null, camera = null, view = null;   // view = built world for this level

  function save() {
    try { localStorage.setItem('blackgate.save', JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem('blackgate.save') || 'null');
      if (s && typeof s.level === 'number' && s.level > 0 && s.level < LEVELS.length) return s;
    } catch (e) { /* ignore */ }
    return null;
  }

  /* ------------------------------------------------------ level building -- */
  function buildLevel(index) {
    const def = LEVELS[index];
    const grid = def.map.map((r) => r.split(''));
    const H = grid.length, W = grid[0].length;
    let start = { x: 1, y: 1 }, exit = { x: 1, y: 1 };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (grid[y][x] === 'S') { start = { x, y }; grid[y][x] = '.'; }
        else if (grid[y][x] === 'X') exit = { x, y };
      }

    const items = (def.items || []).map((it) => ({
      x: it.x, y: it.y, id: it.id, name: it.name, icon: it.icon, found: it.found,
      effect: it.effect || null, container: CONTAINER.has(grid[it.y][it.x]),
      taken: progress.inventory.indexOf(it.id) >= 0, mesh: null
    }));

    const guards = (def.guards || []).map((g, i) => ({
      name: g.name || 'Guard', idx: i,
      x: g.path[0][0] * TILE + TILE / 2, y: g.path[0][1] * TILE + TILE / 2,
      path: g.path, wp: 1 % g.path.length, speed: g.speed || 55,
      range: g.range || 210, fov: (g.fov || 66) * Math.PI / 180,
      dir: 0, see: 0, mode: 'patrol', target: null, route: [], routeT: 0,
      pause: 0, lookT: 0, mesh: null
    }));

    const cameras = (def.cameras || []).map((c) => ({
      x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2,
      dir: (c.dir || 0) * Math.PI / 180, base: (c.dir || 0) * Math.PI / 180,
      sweep: (c.sweep || 70) * Math.PI / 180, speed: (c.speed || 25) * Math.PI / 180,
      range: c.range || 220, fov: 42 * Math.PI / 180, t: Math.random() * 6, see: 0, mesh: null
    }));

    const lights = (def.lights || []).map((l) => ({
      path: l.path, wp: 1 % l.path.length, speed: l.speed || 70, radius: l.radius || 100,
      x: l.path[0][0] * TILE + TILE / 2, y: l.path[0][1] * TILE + TILE / 2, see: 0, mesh: null, lamp: null
    }));

    state = {
      def, index, grid, W, H, exit,
      start: { x: start.x * TILE + TILE / 2, y: start.y * TILE + TILE / 2 },
      player: {
        x: start.x * TILE + TILE / 2, y: start.y * TILE + TILE / 2,
        yaw: 0, pitch: 0, r: 8, stamina: 100, moving: 0, stepT: 0, bob: 0, eye: EYE.walk,
        speedMode: 'idle'
      },
      items, guards, cameras, lights,
      alarm: 0, lockdown: 0, powerOff: false, lampLit: false,
      time: 0, danger: 0, focus: null
    };
    if (progress.inventory.indexOf('breaker') >= 0 && def.id === 3) state.powerOff = true;
    if (progress.inventory.indexOf('lamp') >= 0 && def.id === 5) state.lampLit = true;

    buildView();
    toasts = [];
  }

  /* ------------------------------------------------------- 3D scene sync -- */
  function buildView() {
    if (view) disposeView();
    view = World.build(state.def, state.grid, state.exit);
    const scene = view.scene;

    for (const g of state.guards) {
      g.mesh = World.makeGuard(g.range, state.def.guards[g.idx].fov || 66);
      scene.add(g.mesh);
    }
    for (const it of state.items) {
      if (it.taken) continue;
      it.mesh = World.makeItem(it.icon);
      it.mesh.position.set(it.x * TILE * WS + World.T / 2, it.container ? 0.75 : 0, it.y * TILE * WS + World.T / 2);
      scene.add(it.mesh);
    }
    for (const c of state.cameras) {
      c.mesh = World.makeWallCamera();
      c.mesh.position.set(c.x * WS, World.WALL_H - 0.55, c.y * WS);
      scene.add(c.mesh);
    }
    for (const l of state.lights) {
      l.mesh = World.makeSearchlight(l.radius);
      scene.add(l.mesh);
      l.lamp = new THREE.SpotLight(0xfff0c0, 260, 34, 0.42, 0.55, 1);
      l.lamp.position.set(0, 14, 0);
      scene.add(l.lamp);
      scene.add(l.lamp.target);
    }
    if (state.def.dark) {
      view.torch = new THREE.PointLight(0xffdca8, 9, 9, 1.5);
      scene.add(view.torch);
      view.beam = new THREE.SpotLight(0xfff0cc, 0, 30, 0.5, 0.55, 1.1);
      scene.add(view.beam);
      scene.add(view.beam.target);
    }
    // a little light travels with you everywhere, so corners are never solid black
    view.hand = new THREE.PointLight(0xc9d8ff, state.def.dark ? 1.5 : 9, state.def.dark ? 5 : 14, 1.6);
    scene.add(view.hand);
  }

  function disposeView() {
    view.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { if (m.map && m.map.dispose) m.map.dispose(); m.dispose(); }
      }
    });
    view = null;
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

    // look
    p.yaw += input.lookX;
    p.pitch = Math.max(-1.1, Math.min(1.1, p.pitch + input.lookY));
    input.lookX = 0; input.lookY = 0;

    // movement is relative to where you are looking
    let fwd = 0, strafe = 0;
    if (keys['w'] || keys['arrowup']) fwd += 1;
    if (keys['s'] || keys['arrowdown']) fwd -= 1;
    if (keys['d'] || keys['arrowright']) strafe += 1;
    if (keys['a'] || keys['arrowleft']) strafe -= 1;
    let mag = Math.min(1, Math.hypot(fwd, strafe));
    if (!mag && stick.mag > 0.08) { fwd = -stick.y; strafe = stick.x; mag = stick.mag; }

    const wantSneak = !!(keys['control'] || keys['c']) || sneakHeld || (mag > 0 && mag < 0.5);
    const wantRun = !!(keys['shift'] || input.run) && p.stamina > 4;
    let sm = 'walk';
    if (wantRun && mag > 0.45 && !wantSneak) sm = 'run';
    else if (wantSneak) sm = 'sneak';
    p.speedMode = mag > 0.02 ? sm : 'idle';

    let sp = SPEED[sm];
    if (SLOWTILE.has(tileAtPx(p.x, p.y))) sp *= 0.62;
    if (sm === 'run' && mag > 0) {
      p.stamina = Math.max(0, p.stamina - 26 * dt);
      if (p.stamina <= 0) p.speedMode = 'walk';
    } else p.stamina = Math.min(100, p.stamina + 15 * dt);

    // eye height eases between stances
    const targetEye = EYE[p.speedMode] || EYE.walk;
    p.eye += (targetEye - p.eye) * Math.min(1, dt * 9);

    if (mag > 0.02) {
      const len = Math.hypot(fwd, strafe) || 1;
      const f = fwd / len, s = strafe / len;
      const dirX = Math.cos(p.yaw) * f - Math.sin(p.yaw) * s;
      const dirY = Math.sin(p.yaw) * f + Math.cos(p.yaw) * s;
      moveCircle(p, dirX * sp * dt, dirY * sp * dt);
      p.moving = 1;
      p.bob += dt * (sm === 'run' ? 13 : sm === 'sneak' ? 5 : 8.5);
      p.stepT -= dt;
      if (p.stepT <= 0) {
        p.stepT = sm === 'run' ? 0.28 : sm === 'sneak' ? 0.72 : 0.45;
        const wet = SLOWTILE.has(tileAtPx(p.x, p.y));
        let radius = NOISE[sm];
        if (wet) radius += 70;
        if (radius > 0) makeNoise(p.x, p.y, radius);
        if (sm !== 'sneak' || wet) Sound.step(wet);
      }
    } else { p.moving = 0; p.stepT = 0; }
  }

  function makeNoise(x, y, radius) {
    for (const g of state.guards) {
      if (g.mode === 'chase') continue;
      if (Math.hypot(g.x - x, g.y - y) < radius) {
        g.mode = 'alert';
        g.target = { x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
        g.route = []; g.routeT = 0; g.lookT = 2.5;
      }
    }
  }

  /* ----------------------------------------------------------- guard AI --- */
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
    if (d < 74) vis = Math.max(vis, 0.85);
    const near = 1 - Math.min(1, d / range);
    return Math.max(0.15, near) * vis * 1.9 * dt;
  }

  function stepAlong(g, dt, tx, ty, speed) {
    g.routeT -= dt;
    const gt = { x: Math.floor(g.x / TILE), y: Math.floor(g.y / TILE) };
    if (g.routeT <= 0 || !g.route.length) {
      g.routeT = 0.5;
      g.route = findPath(gt.x, gt.y, tx, ty);
    }
    if (!g.route.length) return true;
    const n = g.route[0];
    let dx = n.x * TILE + TILE / 2 - g.x, dy = n.y * TILE + TILE / 2 - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) { g.route.shift(); return g.route.length === 0; }
    dx /= d; dy /= d;
    moveCircle(g, dx * speed * dt, dy * speed * dt);
    g.dir += angDiff(Math.atan2(dy, dx), g.dir) * Math.min(1, dt * 7);
    return false;
  }

  function updateGuard(g, dt) {
    const p = state.player;
    const gain = guardSees(g, dt);
    if (gain > 0) {
      g.see = Math.min(1.4, g.see + gain);
      state.danger = Math.max(state.danger, Math.min(1, g.see));
    } else g.see = Math.max(0, g.see - dt * 0.45);

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
      if (stepAlong(g, dt, g.target.x, g.target.y, g.speed * 1.15)) {
        g.lookT -= dt;
        g.dir += dt * 2.1;
        if (g.lookT <= 0) { g.mode = 'patrol'; g.route = []; g.routeT = 0; }
      }
    } else if (g.mode === 'search') {
      g.lookT -= dt;
      g.dir += dt * 1.7;
      if (g.lookT <= 0) { g.mode = 'patrol'; g.route = []; g.routeT = 0; }
    } else {
      if (g.pause > 0) { g.pause -= dt; g.dir += dt * 0.9; return; }
      const wp = g.path[g.wp];
      if (stepAlong(g, dt, wp[0], wp[1], g.speed)) {
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
    if (d < c.range && Math.abs(angDiff(Math.atan2(p.y - c.y, p.x - c.x), c.dir)) < c.fov / 2)
      if (hasLOS(c.x, c.y, p.x, p.y) && tileAtPx(p.x, p.y) !== '%') seen = true;
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
    const dx = tx - l.x, dy = ty - l.y, d = Math.hypot(dx, dy);
    if (d < 6) l.wp = (l.wp + 1) % l.path.length;
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

  /* -------------------------------------------------------- interactions -- */
  /* what you are looking at, within arm's reach */
  function findFocus() {
    const p = state.player;
    const fx = Math.cos(p.yaw), fy = Math.sin(p.yaw);
    let best = null, bestScore = -1;

    const consider = (cx, cy, obj) => {
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy);
      if (d > REACH) return;
      const dot = d < 1 ? 1 : (dx * fx + dy * fy) / d;
      if (dot < 0.35) return;                       // must be roughly in front
      const score = dot - d / (REACH * 4);
      if (score > bestScore) { bestScore = score; best = obj; }
    };

    for (const it of state.items) {
      if (it.taken) continue;
      consider(it.x * TILE + 16, it.y * TILE + 16, {
        kind: 'item', item: it,
        label: (it.container ? 'Search — ' : 'Take — ') + it.name
      });
    }
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    for (let y = ty - 2; y <= ty + 2; y++)
      for (let x = tx - 2; x <= tx + 2; x++) {
        const ch = tileAt(x, y);
        if (LOCKS.has(ch)) {
          const lock = state.def.locks[ch];
          const have = progress.inventory.indexOf(lock.item) >= 0;
          consider(x * TILE + 16, y * TILE + 16, {
            kind: 'door', tile: { x, y }, ch,
            label: have ? 'Unlock the door' : 'Locked — ' + lock.label
          });
        } else if (ch === 'F') {
          const have = progress.inventory.indexOf('cutters') >= 0;
          consider(x * TILE + 16, y * TILE + 16, {
            kind: 'fence', tile: { x, y },
            label: have ? 'Cut the fence' : 'Chain-link — you need wire cutters'
          });
        }
      }
    const need = (state.def.exitRequires || []).filter((id) => progress.inventory.indexOf(id) < 0);
    consider(state.exit.x * TILE + 16, state.exit.y * TILE + 16, {
      kind: 'exit',
      label: need.length ? 'Way out — you are missing something' : 'Get out through ' + state.def.exitLabel
    });
    return best;
  }

  function takeItem(it) {
    it.taken = true;
    if (progress.inventory.indexOf(it.id) < 0) progress.inventory.push(it.id);
    Sound.pickup();
    toast(it.found || ('Picked up ' + it.name), '#7ee08a');
    if (it.mesh) { view.scene.remove(it.mesh); it.mesh = null; }
    if (it.effect === 'power') {
      state.powerOff = true;
      toast('The wing goes dark. The cameras are dead.', '#8fd4ff');
    }
    if (it.effect === 'light') state.lampLit = true;
    renderHUD();
    save();
  }

  function openDoor(tile, ch) {
    const lock = state.def.locks[ch];
    if (progress.inventory.indexOf(lock.item) >= 0) {
      state.grid[tile.y][tile.x] = '+';
      const d = view.doors.find((o) => o.userData.tile.x === tile.x && o.userData.tile.y === tile.y);
      if (d) d.userData.open = true;
      Sound.door();
      toast('Unlocked. The door swings in.', '#8fd4ff');
    } else {
      Sound.denied();
      toast(lock.label, '#ffcf5e');
    }
  }

  function cutFence(tile) {
    if (progress.inventory.indexOf('cutters') >= 0) {
      state.grid[tile.y][tile.x] = ',';
      const f = view.fences.find((o) => o.userData.tile.x === tile.x && o.userData.tile.y === tile.y);
      if (f) view.scene.remove(f);
      Sound.door();
      toast('The links part with a snap.', '#8fd4ff');
      makeNoise(state.player.x, state.player.y, 120);
    } else {
      Sound.denied();
      toast('Chain-link. You need wire cutters.', '#ffcf5e');
    }
  }

  function doAction() {
    // always resolve what is under the crosshair now — a focus from the last
    // frame can be stale by the time the button is pressed
    const f = state.focus = findFocus();
    if (!f) { toast('Nothing within reach.', '#9aa4bb'); return; }
    if (f.kind === 'item') takeItem(f.item);
    else if (f.kind === 'door') openDoor(f.tile, f.ch);
    else if (f.kind === 'fence') cutFence(f.tile);
    else if (f.kind === 'exit') tryExit();
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
    if (document.pointerLockElement) document.exitPointerLock();
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
        <p class="tag">First-person. Five wings. One night.</p>
        <button class="btn primary" data-act="new">NEW ESCAPE</button>
        ${s ? `<button class="btn" data-act="continue">CONTINUE — ${LEVELS[s.level].name}</button>` : ''}
        <button class="btn ghost" data-act="how">HOW TO PLAY</button>
        <p class="fine">Keep your back to the wall and your feet quiet.</p>
      </div>`);
  }

  function howScreen() {
    showScreen('how', `
      <div class="card">
        <h2>How to play</h2>
        <ul class="how">
          <li><b>Look</b> — drag on the right of the screen (or click once for mouse look).</li>
          <li><b>Move</b> — drag on the left half (or WASD).</li>
          <li><b>Sneak</b> — SNEAK button, Ctrl, or a gentle push on the stick. Slow, silent, low.</li>
          <li><b>Run</b> — RUN button or Shift. Fast, loud, costs wind.</li>
          <li><b>ACT</b> (or E) — searches whatever you are looking at: bunks, lockers, carts,
              doors, fence, the way out. The prompt tells you what is in reach.</li>
          <li>Guard torch beams are their eyes. Yellow means unsure, red means caught.</li>
          <li>Three chances. Anything you already found stays found.</li>
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
    shake = 0.7;
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
    p.x = state.start.x; p.y = state.start.y; p.stamina = 100; p.pitch = 0;
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
    if (!last) progress.level += 1;
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

  $('overlay').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    Sound.unlock();
    const act = b.dataset.act;
    if (act === 'new' || act === 'newgame' || act === 'retry') {
      if (act !== 'retry') { progress.level = 0; progress.total = 0; progress.inventory = []; progress.busts = 0; progress.seen = 0; }
      progress.lives = 3;
      save(); briefScreen();
    } else if (act === 'continue') {
      Object.assign(progress, loadSave());
      progress.lives = Math.max(1, progress.lives);
      briefScreen();
    } else if (act === 'how') howScreen();
    else if (act === 'back') titleScreen();
    else if (act === 'start') startLevel();
    else if (act === 'next') briefScreen();
    else if (act === 'respawn') respawn();
    else if (act === 'resume') togglePause();
    else if (act === 'mute') { Sound.toggleMute(); b.textContent = Sound.isMuted() ? 'SOUND: OFF' : 'SOUND: ON'; }
    else if (act === 'title') titleScreen();
  });
  $('btn-pause').addEventListener('click', () => { Sound.unlock(); togglePause(); });

  /* -------------------------------------------------------------- render -- */
  function initRenderer() {
    renderer = new THREE.WebGLRenderer({
      canvas: $('game'), antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance'
    });
    // phones lie about how many pixels they want to push
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.06, 220);
    camera.rotation.order = 'YXZ';
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  function syncScene(dt) {
    const p = state.player;

    // camera
    const bob = p.moving ? Math.sin(p.bob) * (p.speedMode === 'run' ? 0.075 : 0.045) : 0;
    const sway = p.moving ? Math.cos(p.bob * 0.5) * 0.012 : 0;
    camera.position.set(p.x * WS, p.eye + bob, p.y * WS);
    camera.rotation.set(-p.pitch, -p.yaw - Math.PI / 2, sway + (shake > 0 ? (Math.random() - 0.5) * shake * 0.09 : 0));

    if (view.hand) view.hand.position.set(p.x * WS, p.eye, p.y * WS);
    if (view.torch) {
      view.torch.position.set(p.x * WS, p.eye, p.y * WS);
      view.torch.intensity = state.lampLit ? 15 : 7;
      view.torch.distance = state.lampLit ? 13 : 7.5;
    }
    if (view.beam) {
      view.beam.intensity = state.lampLit ? 40 : 0;
      view.beam.position.set(p.x * WS, p.eye, p.y * WS);
      view.beam.target.position.set(
        (p.x + Math.cos(p.yaw) * 90) * WS,
        p.eye - Math.sin(p.pitch) * 5,
        (p.y + Math.sin(p.yaw) * 90) * WS
      );
    }

    // guards
    for (const g of state.guards) {
      const m = g.mesh;
      m.position.set(g.x * WS, 0, g.y * WS);
      m.rotation.y = -g.dir - Math.PI / 2;
      const hot = Math.min(1, g.see);
      const cone = m.userData.cone;
      cone.material.opacity = 0.12 + hot * 0.18;
      cone.material.color.setRGB(1, 0.94 - hot * 0.5, 0.75 - hot * 0.6);
      m.userData.pool.material.opacity = 0.11 + hot * 0.20;
      m.userData.pool.material.color.copy(cone.material.color);
      m.userData.bang.visible = g.mode === 'chase' || g.see >= 1;
      m.userData.quest.visible = !m.userData.bang.visible && (g.see > 0.35 || g.mode === 'alert' || g.mode === 'search');
    }

    // items bob
    for (const it of state.items) {
      if (!it.mesh) continue;
      it.mesh.userData.sprite.position.y = (it.container ? 0.55 : 0.95) + Math.sin(state.time * 2.4 + it.x) * 0.08;
    }

    // wall cameras
    for (const c of state.cameras) {
      c.mesh.rotation.y = -c.dir - Math.PI / 2;
      c.mesh.userData.cone.visible = !state.powerOff;
      c.mesh.userData.led.material.color.setHex(state.powerOff ? 0x333a44 : (c.see > 0.4 ? 0xff5a50 : 0x8de08a));
      if (!state.powerOff) {
        const hot = Math.min(1, c.see);
        c.mesh.userData.cone.material.opacity = 0.07 + hot * 0.14;
      }
    }

    // searchlights
    for (const l of state.lights) {
      l.mesh.position.set(l.x * WS, 0, l.y * WS);
      l.lamp.position.set(l.x * WS, 14, l.y * WS);
      l.lamp.target.position.set(l.x * WS, 0, l.y * WS);
    }

    // doors swinging open
    for (const d of view.doors) {
      if (!d.userData.open || d.userData.swing >= 1) continue;
      d.userData.swing = Math.min(1, d.userData.swing + dt * 2.2);
      d.rotation.y = -d.userData.swing * 1.85;
    }

    // exit beacon pulse
    const ring = view.exitBeacon.userData.ring;
    ring.scale.setScalar(1 + Math.sin(state.time * 2.2) * 0.12);
    view.exitBeacon.rotation.y += dt * 0.6;
  }

  /* ------------------------------------------------------------- minimap -- */
  const mapCv = document.createElement('canvas');
  function renderMinimap() {
    const el = $('minimap');
    if (mapCv.width !== el.width) { mapCv.width = el.width; mapCv.height = el.height; }
    const g = el.getContext('2d');
    const p = state.player;
    const R = 11;                                   // tiles visible each way
    const S = el.width / (R * 2);
    const px = p.x / TILE, py = p.y / TILE;
    g.clearRect(0, 0, el.width, el.height);
    g.save();
    g.beginPath(); g.arc(el.width / 2, el.height / 2, el.width / 2 - 1, 0, 7); g.clip();
    g.fillStyle = 'rgba(9,12,18,.82)';
    g.fillRect(0, 0, el.width, el.height);

    const toX = (tx) => (tx - px) * S + el.width / 2;
    const toY = (ty) => (ty - py) * S + el.height / 2;

    for (let y = Math.floor(py - R); y <= py + R; y++) {
      for (let x = Math.floor(px - R); x <= px + R; x++) {
        const ch = tileAt(x, y);
        if (ch === '#') g.fillStyle = '#5b6478';
        else if (LOCKS.has(ch)) g.fillStyle = '#c08a3e';
        else if (ch === 'F') g.fillStyle = '#8d97a8';
        else if (SOLID.has(ch)) g.fillStyle = '#3d4658';
        else if (ch === '%') g.fillStyle = '#2f5238';
        else continue;
        g.fillRect(toX(x), toY(y), S + 0.6, S + 0.6);
      }
    }
    // exit
    g.fillStyle = '#7ce8a0';
    g.fillRect(toX(state.exit.x) + S * .2, toY(state.exit.y) + S * .2, S * .6, S * .6);
    // items
    for (const it of state.items) {
      if (it.taken) continue;
      g.fillStyle = '#ffe27a';
      g.fillRect(toX(it.x) + S * .3, toY(it.y) + S * .3, S * .45, S * .45);
    }
    // guards
    for (const gu of state.guards) {
      const gx = toX(gu.x / TILE - 0.5), gy = toY(gu.y / TILE - 0.5);
      g.fillStyle = gu.mode === 'chase' ? '#ff5a50' : gu.mode === 'patrol' ? '#9aa4bb' : '#ffcf5e';
      g.beginPath(); g.arc(gx + S / 2, gy + S / 2, S * .34, 0, 7); g.fill();
      g.strokeStyle = g.fillStyle;
      g.beginPath();
      g.moveTo(gx + S / 2, gy + S / 2);
      g.lineTo(gx + S / 2 + Math.cos(gu.dir) * S * 1.1, gy + S / 2 + Math.sin(gu.dir) * S * 1.1);
      g.stroke();
    }
    // player
    g.translate(el.width / 2, el.height / 2);
    g.rotate(p.yaw + Math.PI / 2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -S * .8); g.lineTo(S * .55, S * .6); g.lineTo(0, S * .25); g.lineTo(-S * .55, S * .6);
    g.closePath(); g.fill();
    g.restore();
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
    $('lockdown').style.display = state.lockdown > 0 ? 'block' : 'none';

    const prompt = $('prompt');
    if (state.focus) {
      prompt.style.display = 'block';
      prompt.innerHTML = `<b>${isTouch ? 'ACT' : 'E'}</b> ${state.focus.label}`;
    } else prompt.style.display = 'none';
    $('crosshair').classList.toggle('hot', !!state.focus);

    const dm = $('damage');
    dm.style.opacity = flash > 0 ? Math.min(0.85, flash) : Math.min(0.5, state.danger * 0.5);
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
      for (const c of state.cameras) updateCamera(c, dt);
      for (const l of state.lights) updateLight(l, dt);

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

      // walk-over pickups (loose items only) and the exit pad
      const p = state.player;
      for (const it of state.items) {
        if (it.taken || it.container) continue;
        if (Math.hypot(p.x - (it.x * TILE + 16), p.y - (it.y * TILE + 16)) < 22) takeItem(it);
      }
      if (Math.hypot(p.x - (state.exit.x * TILE + 16), p.y - (state.exit.y * TILE + 16)) < 18) tryExit();

      state.focus = findFocus();
      if (input.action) { input.action = false; doAction(); }

      let dirty = false;
      for (const t of toasts) { t.life -= dt; if (t.life <= 0) dirty = true; }
      if (dirty) { toasts = toasts.filter((t) => t.life > 0); renderToasts(); }

      updateHUDBars();
      renderMinimap();
    } else input.action = false;

    if (shake > 0) shake = Math.max(0, shake - dt * 1.6);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);

    if (view && camera) {
      if (state) syncScene(dt);
      renderer.render(view.scene, camera);
    }
  }

  /* ------------------------------------------------------------ bootstrap */
  function boot() {
    try {
      initRenderer();
    } catch (err) {
      showScreen('nogl', `
        <div class="card">
          <h2 class="bad">NO 3D HERE</h2>
          <p class="brief">This device could not start WebGL, so the wing cannot be drawn.
          Try a different browser, or turn hardware acceleration back on.</p>
          <p class="stats">${String(err && err.message || err)}</p>
        </div>`);
      return;
    }
    setupInput();
    document.addEventListener('touchstart', Sound.unlock, { once: true });
    document.addEventListener('mousedown', Sound.unlock, { once: true });
    buildLevel(0);                 // a lit corridor behind the title card
    state.player.yaw = 0.6;
    mode = 'title';
    titleScreen();
    requestAnimationFrame(tick);
  }

  /* hook used by tools/playtest.js */
  window.__blackgate = {
    get state() { return state; },
    get progress() { return progress; },
    get mode() { return mode; },
    tp(tx, ty) { state.player.x = tx * TILE + 16; state.player.y = ty * TILE + 16; },
    face(tx, ty) {
      state.player.yaw = Math.atan2(ty * TILE + 16 - state.player.y, tx * TILE + 16 - state.player.x);
    },
    act() { doAction(); }
  };

  if (window.cordova) document.addEventListener('deviceready', boot, false);
  else window.addEventListener('load', boot);
})();
