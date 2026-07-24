/* Snake FPS — snake in first or third person. Raycast renderer, no dependencies. */
(function () {
  'use strict';

  // ---------- setup ----------
  var canvas = document.getElementById('view');
  var ctx = canvas.getContext('2d');
  var mini = document.getElementById('minimap');
  var mctx = mini.getContext('2d');
  var scoreEl = document.getElementById('score');
  var lenEl = document.getElementById('len');
  var bestEl = document.getElementById('best');
  var bestOverEl = document.getElementById('bestOver');
  var finalEl = document.getElementById('final');
  var startOv = document.getElementById('start');
  var overOv = document.getElementById('over');
  var viewBtn = document.getElementById('btnView');

  var MAP_W = 16, MAP_H = 16;
  var FOV = Math.PI / 3;
  var TEX = 64;
  var H = 300, W = 480;
  var zbuf = new Float32Array(W);

  // camera rig: third person sits behind and above the head, tilted down at it.
  // height stays under 1.0 so the camera never rises above the wall tops.
  // offset to the left so the snake sits off-centre and never hides the apple
  // it is heading for
  var TP_DIST = 3.6, TP_HEIGHT = 0.45, TP_PITCH = 0.16, TP_SIDE = 0.68;
  // segments that pass under the chase camera would smear across the whole
  // screen, so they are clipped away rather than drawn
  var TP_NEAR = 1.55;
  var thirdPerson = false;
  try { thirdPerson = localStorage.getItem('snakefps_view') === '3'; } catch (e) {}

  function resize() {
    var a = Math.max(0.5, Math.min(2.4, window.innerWidth / window.innerHeight));
    H = 300;
    W = Math.round(H * a);
    canvas.width = W;
    canvas.height = H;
    zbuf = new Float32Array(W);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- map ----------
  var map = [];
  (function buildMap() {
    for (var y = 0; y < MAP_H; y++) {
      map[y] = [];
      for (var x = 0; x < MAP_W; x++) {
        map[y][x] = (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) ? 1 : 0;
      }
    }
    [[4, 4], [11, 4], [4, 11], [11, 11]].forEach(function (p) { map[p[1]][p[0]] = 1; });
  })();

  function isWall(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
    return map[y][x] === 1;
  }

  // ---------- textures ----------
  function makeTex(draw) {
    var c = document.createElement('canvas');
    c.width = TEX; c.height = TEX;
    draw(c.getContext('2d'));
    return c;
  }
  var wallTex = makeTex(function (g) {
    g.fillStyle = '#3f4a5c'; g.fillRect(0, 0, TEX, TEX);
    g.fillStyle = '#55637a';
    for (var r = 0; r < 4; r++) {
      var off = (r % 2) * 16;
      for (var b = -1; b < 3; b++) g.fillRect(b * 32 + off + 1, r * 16 + 1, 30, 14);
    }
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, TEX, 3);
  });

  // one rounded body segment; two shades alternate along the snake
  function segmentTex(base, light) {
    return makeTex(function (g) {
      g.clearRect(0, 0, TEX, TEX);
      g.fillStyle = base;
      g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = light;
      g.beginPath(); g.arc(25, 25, 19, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)';
      g.beginPath(); g.ellipse(22, 20, 7, 10, -0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(6,60,28,.55)'; g.lineWidth = 3;
      g.beginPath(); g.arc(32, 32, 29, 0, Math.PI * 2); g.stroke();
    });
  }
  var segA = segmentTex('#15803d', '#22c55e');
  var segB = segmentTex('#166534', '#16a34a');

  // back of the snake's head, seen by the third-person camera
  var headTex = makeTex(function (g) {
    g.clearRect(0, 0, TEX, TEX);
    g.fillStyle = '#15803d';
    g.beginPath(); g.ellipse(32, 34, 30, 28, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#22c55e';
    g.beginPath(); g.ellipse(30, 28, 24, 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath(); g.ellipse(26, 20, 12, 7, -0.3, 0, Math.PI * 2); g.fill();
    // side-mounted eyes, just catching the light from behind
    [[10, 24], [54, 24]].forEach(function (p) {
      g.fillStyle = '#f8fafc';
      g.beginPath(); g.ellipse(p[0], p[1], 7, 7.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0f172a';
      g.beginPath(); g.ellipse(p[0], p[1] + 1, 3.4, 5, 0, 0, Math.PI * 2); g.fill();
    });
    g.fillStyle = 'rgba(6,60,28,.5)';
    g.beginPath(); g.ellipse(26, 55, 3, 2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(38, 55, 3, 2, 0, 0, Math.PI * 2); g.fill();
  });

  var appleSpr = makeTex(function (g) {
    g.clearRect(0, 0, TEX, TEX);
    g.fillStyle = '#dc2626';
    g.beginPath(); g.arc(32, 38, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ef4444';
    g.beginPath(); g.arc(26, 33, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.65)';
    g.beginPath(); g.ellipse(23, 28, 5, 8, -0.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7c4a1e'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(32, 18); g.quadraticCurveTo(34, 10, 40, 7); g.stroke();
    g.fillStyle = '#16a34a';
    g.beginPath(); g.ellipse(43, 13, 9, 4.5, 0.5, 0, Math.PI * 2); g.fill();
  });

  // ---------- game state ----------
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S W N
  var snake, dir, headingT, headingC, turnQueue, growth, apple, score, best;
  var tickMs, lastTick, prevHead, alive, running, eatFlash, deathT;

  try { best = parseInt(localStorage.getItem('snakefps_best') || '0', 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  function reset() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = 0;
    headingT = 0; headingC = 0;
    turnQueue = [];
    growth = 0;
    score = 0;
    tickMs = 520;
    lastTick = performance.now();
    prevHead = { x: 8, y: 8 };
    alive = true;
    eatFlash = 0;
    placeApple();
    updateHud();
  }

  function placeApple() {
    while (true) {
      var x = 1 + Math.floor(Math.random() * (MAP_W - 2));
      var y = 1 + Math.floor(Math.random() * (MAP_H - 2));
      if (map[y][x]) continue;
      var onSnake = snake.some(function (s) { return s.x === x && s.y === y; });
      if (!onSnake) { apple = { x: x, y: y }; return; }
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    lenEl.textContent = snake.length;
    bestEl.textContent = best;
  }

  function turn(t) {
    if (!running || !alive) return;
    if (turnQueue.length < 2) turnQueue.push(t);
  }

  function tick(now) {
    if (turnQueue.length) {
      var t = turnQueue.shift();
      if (t === 'L') { dir = (dir + 3) % 4; headingT -= Math.PI / 2; }
      else { dir = (dir + 1) % 4; headingT += Math.PI / 2; }
    }
    var nx = snake[0].x + DIRS[dir][0];
    var ny = snake[0].y + DIRS[dir][1];
    var hitsBody = snake.some(function (s, i) {
      if (growth === 0 && i === snake.length - 1) return false; // tail moves away
      return s.x === nx && s.y === ny;
    });
    if (map[ny][nx] === 1 || hitsBody) { die(now); return; }
    prevHead = { x: snake[0].x, y: snake[0].y };
    snake.unshift({ x: nx, y: ny });
    if (nx === apple.x && ny === apple.y) {
      score++;
      growth += 2;
      tickMs = Math.max(210, tickMs - 12);
      eatFlash = 1;
      if (score > best) { best = score; try { localStorage.setItem('snakefps_best', String(best)); } catch (e) {} }
      placeApple();
      sfxEat();
    }
    if (growth > 0) growth--; else snake.pop();
    updateHud();
  }

  function die(now) {
    alive = false;
    deathT = now;
    sfxDie();
    setTimeout(function () {
      finalEl.textContent = score;
      bestOverEl.textContent = best;
      overOv.classList.remove('hidden');
      running = false;
    }, 900);
  }

  // ---------- audio ----------
  var AC = null;
  function ac() {
    if (!AC) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (Ctor) AC = new Ctor();
    }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(f, d, type, vol, delay) {
    var a = ac(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    o.connect(g); g.connect(a.destination);
    var t0 = a.currentTime + (delay || 0);
    g.gain.setValueAtTime(vol || 0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
    o.start(t0); o.stop(t0 + d + 0.02);
  }
  function sfxEat() { tone(660, 0.09); tone(880, 0.12, 'square', 0.1, 0.09); }
  function sfxDie() { tone(220, 0.3, 'sawtooth', 0.12); tone(160, 0.35, 'sawtooth', 0.12, 0.22); tone(110, 0.5, 'sawtooth', 0.12, 0.5); }

  // ---------- render ----------
  function lerp(a, b, t) { return a + (b - a) * t; }

  var lastFrame = performance.now();
  var camX = 8.5, camY = 8.5, camZ = 0;
  var dirX = 1, dirY = 0, planeX = 0, planeY = 1;
  var horizon = H / 2;
  var sprites = [];

  // how far the chase camera can travel from the head along (fx, fy) before it
  // would enter a wall; used for both the pull-back and the sideways offset
  function clearRun(hx, hy, fx, fy, want) {
    var d = 0, step = 0.08;
    while (d < want) {
      var t = Math.min(want, d + step);
      // back off by a margin only when a wall actually stops the run
      if (isWall(Math.floor(hx + fx * t), Math.floor(hy + fy * t))) return Math.max(0, d - 0.22);
      d = t;
    }
    return want;
  }

  function drawSprite(tex, wx, wy, size, zc, near) {
    var relX = wx - camX, relY = wy - camY;
    var invDet = 1 / (planeX * dirY - dirX * planeY);
    var trX = invDet * (dirY * relX - dirX * relY);
    var trY = invDet * (-planeY * relX + planeX * relY);
    if (trY < (near || 0.32) || trY > 18) return;
    var sh = (H / trY) * size;
    var sx = (W / 2) * (1 + trX / trY);
    var y0 = horizon + (0.5 + camZ - zc) * H / trY - sh / 2;
    var x0 = sx - sh / 2;
    var xa = Math.max(0, Math.floor(x0));
    var xb = Math.min(W, Math.ceil(x0 + sh));
    for (var x = xa; x < xb; x++) {
      if (zbuf[x] <= trY) continue;
      var tx = Math.floor(((x - x0) / sh) * TEX);
      if (tx < 0 || tx >= TEX) continue;
      ctx.drawImage(tex, tx, 0, 1, TEX, x, y0, 1, sh);
    }
  }

  function render(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (running && alive) {
      if (now - lastTick > tickMs * 3) lastTick = now - tickMs;
      while (now - lastTick >= tickMs) { lastTick += tickMs; tick(now); if (!alive) break; }
    }

    var tt = Math.min(1, (now - lastTick) / tickMs);
    var headX = camX, headY = camY;
    if (alive) {
      headX = lerp(prevHead.x, snake[0].x, tt) + 0.5;
      headY = lerp(prevHead.y, snake[0].y, tt) + 0.5;
    }
    headingC += (headingT - headingC) * (1 - Math.exp(-dt * 12));

    dirX = Math.cos(headingC); dirY = Math.sin(headingC);
    var pl = Math.tan(FOV / 2);
    planeX = -dirY * pl; planeY = dirX * pl;

    var pitch = 0;
    if (thirdPerson) {
      var back = clearRun(headX, headY, -dirX, -dirY, TP_DIST);
      var ease = back / TP_DIST; // camera tucks in near walls, so ease the tilt with it
      var bx = headX - dirX * back, by = headY - dirY * back;
      var side = clearRun(bx, by, dirY, -dirX, TP_SIDE * ease); // left of the heading
      camX = bx + dirY * side;
      camY = by - dirX * side;
      camZ = TP_HEIGHT * ease;
      pitch = TP_PITCH * H * ease;
    } else {
      camX = headX; camY = headY; camZ = 0;
    }

    var bob = (running && alive && !thirdPerson) ? Math.sin(tt * Math.PI) * 4 : 0;
    horizon = H / 2 + bob - pitch;

    // sky & floor
    var sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0b1220'); sky.addColorStop(1, '#1e293b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, Math.max(0, horizon));
    var flo = ctx.createLinearGradient(0, horizon, 0, H);
    flo.addColorStop(0, '#173322'); flo.addColorStop(1, '#0a1a10');
    ctx.fillStyle = flo; ctx.fillRect(0, horizon, W, H - horizon);

    // walls (DDA raycast per column)
    for (var x = 0; x < W; x++) {
      var cx = 2 * x / W - 1;
      var rdx = dirX + planeX * cx;
      var rdy = dirY + planeY * cx;
      var mapX = Math.floor(camX), mapY = Math.floor(camY);
      var dX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      var dY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      var stepX, stepY, sideX, sideY;
      if (rdx < 0) { stepX = -1; sideX = (camX - mapX) * dX; } else { stepX = 1; sideX = (mapX + 1 - camX) * dX; }
      if (rdy < 0) { stepY = -1; sideY = (camY - mapY) * dY; } else { stepY = 1; sideY = (mapY + 1 - camY) * dY; }
      var side = 0, hit = false, guard = 0;
      while (!hit && guard++ < 64) {
        if (sideX < sideY) { sideX += dX; mapX += stepX; side = 0; }
        else { sideY += dY; mapY += stepY; side = 1; }
        hit = isWall(mapX, mapY);
      }
      var perp = side === 0 ? sideX - dX : sideY - dY;
      if (perp < 0.01) perp = 0.01;
      zbuf[x] = perp;
      var lineH = H / perp;
      var y0 = horizon - lineH / 2 + camZ * H / perp;
      var wallX = side === 0 ? camY + perp * rdy : camX + perp * rdx;
      wallX -= Math.floor(wallX);
      var texX = Math.floor(wallX * TEX);
      ctx.drawImage(wallTex, texX, 0, 1, TEX, x, y0, 1, lineH);
      var shade = (side === 1 ? 0.22 : 0) + Math.min(0.75, perp / 13);
      if (shade > 0.02) {
        ctx.fillStyle = 'rgba(3,8,14,' + shade.toFixed(3) + ')';
        ctx.fillRect(x, y0, 1, lineH);
      }
    }

    // sprites: snake body, the head (third person only) and the apple, far to near
    sprites.length = 0;
    for (var i = thirdPerson ? 0 : 1; i < snake.length; i++) {
      var seg = snake[i];
      var sxw, syw;
      if (i === 0) { sxw = headX; syw = headY; }
      else if (i + 1 < snake.length) {
        // each segment slides out of the cell the one behind it now occupies
        var from = snake[i + 1];
        sxw = lerp(from.x, seg.x, tt) + 0.5;
        syw = lerp(from.y, seg.y, tt) + 0.5;
      } else {
        sxw = seg.x + 0.5; syw = seg.y + 0.5; // tail end has nowhere to come from
      }
      sprites.push({
        tex: i === 0 ? headTex : (i % 2 ? segA : segB),
        x: sxw, y: syw,
        size: i === 0 ? 0.88 : 0.7,
        zc: i === 0 ? 0.42 : 0.27, // head rides above the body, snake-style
        near: (thirdPerson && i > 0) ? TP_NEAR : 0.32,
        d: (sxw - camX) * (sxw - camX) + (syw - camY) * (syw - camY)
      });
    }
    if (apple) {
      var abob = Math.sin(now / 280) * 0.03;
      sprites.push({
        tex: appleSpr, x: apple.x + 0.5, y: apple.y + 0.5, size: 0.62, zc: 0.28 + abob, near: 0.32,
        d: (apple.x + 0.5 - camX) * (apple.x + 0.5 - camX) + (apple.y + 0.5 - camY) * (apple.y + 0.5 - camY)
      });
    }
    sprites.sort(function (a, b) { return b.d - a.d; });
    for (var s = 0; s < sprites.length; s++) {
      drawSprite(sprites[s].tex, sprites[s].x, sprites[s].y, sprites[s].size, sprites[s].zc, sprites[s].near);
    }

    if (!thirdPerson) drawSnout(now);

    if (eatFlash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (eatFlash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      eatFlash = Math.max(0, eatFlash - dt * 3);
    }
    if (!alive) {
      var da = Math.min(0.75, (now - deathT) / 900 * 0.75);
      ctx.fillStyle = 'rgba(160,10,10,' + da.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    drawMinimap();
    requestAnimationFrame(render);
  }

  // green snout at the bottom of the view + flicking forked tongue (first person)
  function drawSnout(now) {
    var w = W, h = H;
    var cxm = w / 2;
    var tPhase = now % 3200;
    if (tPhase < 300 && alive) {
      var ext = Math.sin((tPhase / 300) * Math.PI) * h * 0.22;
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cxm, h);
      ctx.lineTo(cxm, h - ext);
      ctx.moveTo(cxm, h - ext);
      ctx.lineTo(cxm - 6, h - ext - 9);
      ctx.moveTo(cxm, h - ext);
      ctx.lineTo(cxm + 6, h - ext - 9);
      ctx.stroke();
    }
    var g = ctx.createLinearGradient(0, h - h * 0.13, 0, h);
    g.addColorStop(0, '#1c9c4f'); g.addColorStop(1, '#0f6b33');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cxm - w * 0.30, h);
    ctx.quadraticCurveTo(cxm, h - h * 0.20, cxm + w * 0.30, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0a4a22';
    ctx.beginPath(); ctx.ellipse(cxm - w * 0.05, h - h * 0.045, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cxm + w * 0.05, h - h * 0.045, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawMinimap() {
    var s = mini.width / MAP_W;
    mctx.fillStyle = 'rgba(4,20,10,.9)';
    mctx.fillRect(0, 0, mini.width, mini.height);
    mctx.fillStyle = '#475569';
    for (var y = 0; y < MAP_H; y++)
      for (var x = 0; x < MAP_W; x++)
        if (map[y][x]) mctx.fillRect(x * s, y * s, s, s);
    mctx.fillStyle = '#22c55e';
    for (var i = 1; i < snake.length; i++) mctx.fillRect(snake[i].x * s + 1, snake[i].y * s + 1, s - 2, s - 2);
    mctx.fillStyle = '#bbf7d0';
    mctx.fillRect(snake[0].x * s, snake[0].y * s, s, s);
    if (apple) {
      mctx.fillStyle = '#ef4444';
      mctx.beginPath();
      mctx.arc(apple.x * s + s / 2, apple.y * s + s / 2, s / 2, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.strokeStyle = '#fde68a'; mctx.lineWidth = 2;
    var hx = snake[0].x * s + s / 2, hy = snake[0].y * s + s / 2;
    mctx.beginPath();
    mctx.moveTo(hx, hy);
    mctx.lineTo(hx + Math.cos(headingC) * s * 1.4, hy + Math.sin(headingC) * s * 1.4);
    mctx.stroke();
  }

  // ---------- view toggle ----------
  function applyView() {
    viewBtn.textContent = thirdPerson ? '👁 3rd person' : '👁 1st person';
    try { localStorage.setItem('snakefps_view', thirdPerson ? '3' : '1'); } catch (e) {}
  }
  function toggleView() { thirdPerson = !thirdPerson; applyView(); }
  applyView();

  viewBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleView(); });
  viewBtn.addEventListener('touchend', function (e) {
    e.preventDefault(); e.stopPropagation(); toggleView();
  }, { passive: false });

  // ---------- input ----------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') turn('L');
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') turn('R');
    else if (e.key === 'v' || e.key === 'V' || e.key === 'Tab') { e.preventDefault(); toggleView(); }
  });
  function bindBtn(el, t) {
    el.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); turn(t); }, { passive: false });
    el.addEventListener('mousedown', function (e) { e.stopPropagation(); turn(t); });
  }
  bindBtn(document.getElementById('btnL'), 'L');
  bindBtn(document.getElementById('btnR'), 'R');

  var swipeX = null;
  canvas.addEventListener('touchstart', function (e) { swipeX = e.touches[0].clientX; }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    if (swipeX === null) return;
    var dx = e.changedTouches[0].clientX - swipeX;
    swipeX = null;
    if (dx < -40) turn('L');
    else if (dx > 40) turn('R');
  }, { passive: true });

  function begin() { ac(); reset(); running = true; startOv.classList.add('hidden'); overOv.classList.add('hidden'); }
  startOv.addEventListener('click', begin);
  startOv.addEventListener('touchend', function (e) { e.preventDefault(); begin(); }, { passive: false });
  overOv.addEventListener('click', begin);
  overOv.addEventListener('touchend', function (e) { e.preventDefault(); begin(); }, { passive: false });

  document.addEventListener('deviceready', function () {}, false);

  // idle scene behind the start overlay
  reset();
  running = false;
  requestAnimationFrame(render);
})();
