/* Nexora game runtime.
 *
 * Every function in this file is serialized into the games Nexora exports with
 * Function.prototype.toString(), so none of them may reference anything outside
 * this file. They may call each other: the exporter always embeds the whole set.
 */

function nxRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function nxNoise(seed) {
  function h(x, y) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function sm(t) { return t * t * (3 - 2 * t); }
  function v(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), w = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  }
  return function (x, y) {
    let t = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < 4; o++) { t += v(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return t / norm;
  };
}

function nxShade(hex, k, fog, fogK) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r *= k; g *= k; b *= k;
  if (fog) {
    const f = parseInt(fog.slice(1), 16);
    r += (((f >> 16) & 255) - r) * fogK; g += (((f >> 8) & 255) - g) * fogK; b += ((f & 255) - b) * fogK;
  }
  return 'rgb(' + (r < 0 ? 0 : r > 255 ? 255 : r | 0) + ',' + (g < 0 ? 0 : g > 255 ? 255 : g | 0) + ',' + (b < 0 ? 0 : b > 255 ? 255 : b | 0) + ')';
}

/* A small flat-shaded 3D renderer on a 2D canvas (painter's algorithm). */
function Nx3D(ctx) {
  const faces = [];
  const cam = { x: 0, y: 3, z: -8, yaw: 0, pitch: 0.3, fov: 0.9, near: 0.3, far: 70, fog: null };
  let L = [0.45, 0.8, -0.4];
  const l0 = Math.hypot(L[0], L[1], L[2]); L = [L[0] / l0, L[1] / l0, L[2] / l0];
  let W = 1, H = 1, cy = 1, sy = 0, cp = 1, sp = 0;

  function begin(w, h) {
    W = w; H = h; faces.length = 0;
    cy = Math.cos(cam.yaw); sy = Math.sin(cam.yaw); cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch);
  }
  function toCam(p) {
    const x = p[0] - cam.x, y = p[1] - cam.y, z = p[2] - cam.z;
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    return [x1, y * cp + z1 * sp, -y * sp + z1 * cp];
  }
  function project(p) {
    const c = toCam(p);
    if (c[2] < cam.near) return null;
    const f = H * cam.fov;
    return [W / 2 + c[0] / c[2] * f, H / 2 - c[1] / c[2] * f, c[2]];
  }
  // pts: world-space polygon; normal optional (computed and oriented to the camera if missing)
  function poly(pts, color, normal, alpha) {
    let n = normal;
    if (!n) {
      const a = pts[0], b = pts[1], c = pts[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const ln = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / ln, n[1] / ln, n[2] / ln];
      const d = n[0] * (a[0] - cam.x) + n[1] * (a[1] - cam.y) + n[2] * (a[2] - cam.z);
      if (d > 0) n = [-n[0], -n[1], -n[2]];
    } else {
      const a = pts[0];
      if (n[0] * (a[0] - cam.x) + n[1] * (a[1] - cam.y) + n[2] * (a[2] - cam.z) >= 0) return;
    }
    const scr = []; let depth = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = project(pts[i]);
      if (!p) return;
      scr.push(p); depth += p[2];
    }
    depth /= pts.length;
    if (depth > cam.far) return;
    const lit = 0.42 + 0.58 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const fogK = cam.fog ? Math.min(1, Math.max(0, (depth - cam.far * 0.35) / (cam.far * 0.65))) : 0;
    faces.push({ scr, depth, fill: nxShade(color, lit, cam.fog, fogK), alpha: alpha == null ? 1 : alpha });
  }
  function box(x, y, z, sx, sy2, sz, color) {
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy2, z0 = z - sz / 2, z1 = z + sz / 2;
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], color, [0, 1, 0]);
    poly([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], color, [0, -1, 0]);
    poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], color, [0, 0, -1]);
    poly([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], color, [0, 0, 1]);
    poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], color, [-1, 0, 0]);
    poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], color, [1, 0, 0]);
  }
  // mesh: {vertices:[[x,y,z]], faces:[[i,j,k,...]], colors:[hex per face]}
  function mesh(m, px, py, pz, scale, rotY, fallback) {
    const c = Math.cos(rotY || 0), s = Math.sin(rotY || 0), k = scale || 1;
    const vs = m.vertices.map(v => [px + (v[0] * c + v[2] * s) * k, py + v[1] * k, pz + (-v[0] * s + v[2] * c) * k]);
    for (let i = 0; i < m.faces.length; i++) {
      const f = m.faces[i];
      if (f.length < 3) continue;
      const pts = [];
      for (let j = 0; j < f.length; j++) { const v = vs[f[j]]; if (!v) { pts.length = 0; break; } pts.push(v); }
      if (pts.length >= 3) poly(pts, (m.colors && m.colors[i]) || fallback || '#9aa4ff');
    }
  }
  function flush() {
    faces.sort((a, b) => b.depth - a.depth);
    for (const f of faces) {
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.moveTo(f.scr[0][0], f.scr[0][1]);
      for (let i = 1; i < f.scr.length; i++) ctx.lineTo(f.scr[i][0], f.scr[i][1]);
      ctx.closePath();
      ctx.fillStyle = f.fill; ctx.fill();
      ctx.strokeStyle = f.fill; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    faces.length = 0;
  }
  return { cam, begin, project, poly, box, mesh, flush };
}

/* Shared game shell: canvas, input (keyboard + touch), title/game-over screens, HUD, sound, music. */
function NexoraRuntime(CFG, makeGame) {
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const R = {
    CFG, ctx, W: 0, H: 0, state: 'title', score: 0, best: 0, time: 0, lives: 0, shakeT: 0,
    rng: nxRng(CFG.seed), pal: CFG.palette, particles: [], msg: null, msgT: 0,
  };
  try { R.best = +localStorage.getItem('nx_best_' + CFG.id) || 0; } catch (e) { /* sandboxed: no storage */ }

  // ---- input ----
  const down = {}, touch = {}, prev = [{}, {}];
  let cur = [{}, {}];
  const P1 = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action: ['Space', 'KeyF'] };
  const P2 = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action: ['Enter', 'ShiftRight', 'Slash'] };
  const SOLO = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    action: ['Space', 'Enter', 'KeyZ', 'KeyX', 'KeyJ'],
  };
  function readInput(p) {
    const map = CFG.players === 2 ? (p === 0 ? P1 : P2) : SOLO, o = {};
    for (const k in map) o[k] = map[k].some(c => down[c]) || (p === 0 && !!touch[k]);
    return o;
  }
  R.input = p => cur[p || 0];
  R.hit = (name, p) => cur[p || 0][name] && !prev[p || 0][name];
  addEventListener('keydown', e => {
    if (e.code === 'KeyM') { R.toggleMusic(); return; }
    if (e.code === 'KeyP' && R.state === 'play') { R.paused = !R.paused; return; }
    down[e.code] = true; unlockAudio();
    if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
  }, { passive: false });
  addEventListener('keyup', e => { down[e.code] = false; });
  addEventListener('blur', () => { for (const k in down) down[k] = false; });

  // touch pad
  const ctrls = CFG.controls || ['left', 'right', 'action'];
  const pad = document.createElement('div');
  pad.style.cssText = 'position:fixed;inset:auto 0 0 0;display:flex;justify-content:space-between;padding:14px;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none';
  const L = { left: '◀', right: '▶', up: '▲', down: '▼', action: '●' };
  const leftGrp = document.createElement('div'), rightGrp = document.createElement('div');
  [leftGrp, rightGrp].forEach(g => { g.style.cssText = 'display:flex;gap:10px;align-items:flex-end'; pad.appendChild(g); });
  ctrls.forEach(k => {
    const b = document.createElement('div');
    b.textContent = L[k];
    b.style.cssText = 'width:62px;height:62px;border-radius:50%;display:grid;place-items:center;font:22px system-ui;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);pointer-events:auto;backdrop-filter:blur(4px)';
    const on = e => { e.preventDefault(); touch[k] = true; unlockAudio(); b.style.background = 'rgba(255,255,255,.34)'; };
    const off = e => { e.preventDefault(); touch[k] = false; b.style.background = 'rgba(255,255,255,.14)'; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    (k === 'action' || k === 'up' && ctrls.includes('down') === false ? rightGrp : leftGrp).appendChild(b);
  });
  if (matchMedia('(pointer: coarse)').matches) document.body.appendChild(pad);
  cv.addEventListener('pointerdown', () => {
    unlockAudio();
    if (R.state !== 'play') { touch.action = true; setTimeout(() => { touch.action = false; }, 90); }
  });

  // ---- audio ----
  let ac = null, master = null, musicOn = !!CFG.music, musicTimer = null;
  function unlockAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  function tone(f0, f1, dur, type, vol, when) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (!ac) return;
    const n = ac.sampleRate * dur, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol || 0.4;
    s.buffer = buf; s.connect(g); g.connect(master); s.start();
  }
  R.sfx = function (k) {
    if (CFG.sfx === false || !ac) return;
    if (k === 'jump') tone(320, 720, 0.16, 'square', 0.18);
    else if (k === 'coin') { tone(880, 0, 0.08, 'square', 0.15); tone(1320, 0, 0.14, 'square', 0.15, 0.07); }
    else if (k === 'shoot') tone(900, 220, 0.12, 'sawtooth', 0.1);
    else if (k === 'hit') { tone(220, 60, 0.25, 'sawtooth', 0.25); noise(0.15, 0.2); }
    else if (k === 'boom') noise(0.45, 0.5);
    else if (k === 'power') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0, 0.12, 'triangle', 0.2, i * 0.07)); }
    else if (k === 'over') { [392, 330, 262, 196].forEach((f, i) => tone(f, 0, 0.22, 'triangle', 0.25, i * 0.15)); }
    else if (k === 'talk') tone(520 + Math.random() * 200, 0, 0.05, 'square', 0.06);
  };
  // procedural background music: a seeded 16-step loop
  const mr = nxRng(CFG.seed ^ 0x5bd1e995);
  const scale = CFG.mood === 'dark' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 7, 9];
  const root = 196 * Math.pow(2, Math.floor(mr() * 5) / 12);
  const mel = Array.from({ length: 16 }, () => (mr() < 0.62 ? scale[Math.floor(mr() * scale.length)] + 12 * Math.floor(mr() * 2) : null));
  const bass = [0, 0, scale[3] || 5, scale[4] || 7];
  let step = 0;
  function musicTick() {
    if (!ac || !musicOn || R.state !== 'play' || R.paused) return;
    const n = mel[step % 16];
    if (n !== null) tone(root * Math.pow(2, n / 12), 0, 0.18, 'triangle', 0.07);
    if (step % 4 === 0) tone(root / 2 * Math.pow(2, bass[(step / 4) % 4] / 12), 0, 0.3, 'sine', 0.12);
    if (step % 4 === 2) noise(0.03, 0.05);
    step++;
  }
  R.toggleMusic = () => {
    musicOn = !musicOn;
    R.flash(musicOn ? 'Musik på' : 'Musik av');
  };
  musicTimer = setInterval(musicTick, 60000 / (CFG.bpm || 116) / 4);

  // ---- helpers ----
  R.text = function (s, x, y, size, color, align, weight) {
    ctx.font = (weight || '700') + ' ' + size + 'px ' + (CFG.font || 'system-ui, sans-serif');
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
  };
  R.burst = function (x, y, color, n, speed) {
    for (let i = 0; i < (n || 12); i++) {
      const a = Math.random() * Math.PI * 2, s = (speed || 180) * (0.3 + Math.random());
      R.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color });
    }
  };
  R.drawParticles = function (ox, oy) {
    for (const p of R.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - (ox || 0) - 2, p.y - (oy || 0) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  };
  R.shake = t => { R.shakeT = Math.max(R.shakeT, t || 0.25); };
  R.flash = (m, t) => { R.msg = m; R.msgT = t || 1.6; };
  R.add = n => { R.score += n; };
  R.over = function () {
    if (R.state !== 'play') return;
    // Attract/demo mode (used by the ad): no game-over screen, the round just restarts.
    if (CFG.demo) { R.shake(0.2); R.score = 0; game.reset(); return; }
    R.state = 'over'; R.overT = 0; R.sfx('over'); R.shake(0.4);
    if (R.score > R.best) { R.best = R.score; try { localStorage.setItem('nx_best_' + CFG.id, R.best); } catch (e) { /* no storage */ } }
    try { parent.postMessage({ nexora: 'score', id: CFG.id, score: R.score }, '*'); } catch (e) { /* not framed */ }
  };
  R.win = function (m) { R.flash(m || 'Du vann!', 3); R.add(500); R.over(); R.won = true; };

  const game = makeGame(R);
  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    R.W = innerWidth; R.H = innerHeight;
    cv.width = R.W * d; cv.height = R.H * d;
    cv.style.width = R.W + 'px'; cv.style.height = R.H + 'px';
    ctx.setTransform(d, 0, 0, d, 0, 0);
    if (game.resize) game.resize();
  }
  addEventListener('resize', resize);
  resize();
  game.reset();
  if (CFG.demo) R.state = 'play';

  function start() {
    R.score = 0; R.time = 0; R.won = false; R.particles.length = 0; R.paused = false;
    game.reset(); R.state = 'play'; step = 0;
  }

  let last = performance.now();
  function frame(now) {
    let dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    cur = [readInput(0), readInput(1)];
    if (R.state === 'play' && !R.paused) { R.time += dt; game.update(dt); }
    else if (R.state === 'title' && R.hit('action')) start();
    else if (R.state === 'over') { R.overT += dt; if (R.overT > 0.6 && R.hit('action')) start(); }
    for (const p of R.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    R.particles = R.particles.filter(p => p.life > 0);
    if (R.msgT > 0) R.msgT -= dt;

    ctx.save();
    if (R.shakeT > 0) { R.shakeT -= dt; ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); }
    game.draw(ctx);
    ctx.restore();

    if (R.state === 'play') {
      R.text(String(R.score), 18, 28, 26, '#fff');
      R.text('Rekord ' + R.best, R.W - 18, 28, 16, 'rgba(255,255,255,.8)', 'right', '600');
      if (game.hud) game.hud(ctx);
      if (R.paused) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, R.W, R.H); R.text('PAUS', R.W / 2, R.H / 2, 44, '#fff', 'center', '800'); }
    }
    if (R.msgT > 0 && R.msg) {
      ctx.globalAlpha = Math.min(1, R.msgT * 2);
      R.text(R.msg, R.W / 2, R.H * 0.22, 26, R.pal.accent, 'center', '800');
      ctx.globalAlpha = 1;
    }
    if (R.state !== 'play') {
      ctx.fillStyle = 'rgba(5,6,16,.62)'; ctx.fillRect(0, 0, R.W, R.H);
      const big = Math.min(64, R.W / 11);
      if (R.state === 'title') {
        R.text(CFG.title, R.W / 2, R.H * 0.36, big, R.pal.accent, 'center', '900');
        R.text(CFG.tagline || '', R.W / 2, R.H * 0.36 + big * 0.9, Math.max(14, big * 0.32), '#e8e8ff', 'center', '500');
        const pulse = 0.6 + 0.4 * Math.sin(now / 260);
        ctx.globalAlpha = pulse;
        R.text(matchMedia('(pointer: coarse)').matches ? 'Tryck för att spela' : 'Tryck MELLANSLAG för att spela', R.W / 2, R.H * 0.62, 20, '#fff', 'center');
        ctx.globalAlpha = 1;
        R.text(CFG.help || '', R.W / 2, R.H * 0.62 + 34, 14, 'rgba(255,255,255,.7)', 'center', '500');
        if (CFG.players === 2) R.text('Spelare 1: WASD + F  ·  Spelare 2: pilar + Enter', R.W / 2, R.H * 0.62 + 58, 14, 'rgba(255,255,255,.7)', 'center', '500');
      } else {
        R.text(R.won ? 'Seger!' : 'Game over', R.W / 2, R.H * 0.38, big, R.won ? R.pal.coin : R.pal.enemy, 'center', '900');
        R.text('Poäng ' + R.score + '   ·   Rekord ' + R.best, R.W / 2, R.H * 0.38 + big, 20, '#fff', 'center', '600');
        if (R.overT > 0.6) R.text('Tryck MELLANSLAG / tryck för att spela igen', R.W / 2, R.H * 0.62, 17, 'rgba(255,255,255,.85)', 'center', '500');
      }
      R.text('Skapat med Nexora', R.W / 2, R.H - 22, 12, 'rgba(255,255,255,.45)', 'center', '500');
    }
    prev[0] = cur[0]; prev[1] = cur[1];
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return R;
}
