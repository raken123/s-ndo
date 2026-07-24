/* Rocket Cars - main loop, camera, match flow, HUD */
(function () {
  var CFG = RC.CFG, F = CFG.FIELD, G = CFG.GOAL, T = THREE;
  var _v = new T.Vector3(), _v2 = new T.Vector3(), _q = new T.Quaternion();

  var renderer, scene, camera, clock;
  var ball, ballMesh, cars = [], carMeshes = [], ai, pads, fx;
  var camPos = new T.Vector3(), camLook = new T.Vector3();
  var ballCam = true;

  var S = {
    mode: 'menu',          // menu | countdown | play | goal | over | paused
    time: CFG.MATCH_TIME,
    score: [0, 0],         // [blue(player), orange(ai)]
    timer: 0,
    overtime: false,
    diff: 1,
    matchLen: 180,
    lastTouch: -1
  };
  RC.S = S;

  // ------------------------------------------------------------------ audio
  var A = (function () {
    var ctx = null, boostGain = null, boostSrc = null, master = null;
    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
      // noise buffer for engine / boost
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var dat = buf.getChannelData(0);
      for (var i = 0; i < len; i++) dat[i] = (Math.random() * 2 - 1) * 0.5;
      boostSrc = ctx.createBufferSource();
      boostSrc.buffer = buf; boostSrc.loop = true;
      var filt = ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = 900; filt.Q.value = 0.8;
      boostGain = ctx.createGain(); boostGain.gain.value = 0;
      boostSrc.connect(filt); filt.connect(boostGain); boostGain.connect(master);
      boostSrc.start();
      return ctx;
    }
    function blip(freq, dur, type, vol, slide) {
      if (!ensure()) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), ctx.currentTime + dur);
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(vol === undefined ? 0.3 : vol, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    }
    return {
      resume: function () { var c = ensure(); if (c && c.state === 'suspended') c.resume(); },
      hit: function (power) {
        blip(90 + Math.min(260, power * 12), 0.16, 'triangle', Math.min(0.5, 0.12 + power * 0.012), 55);
      },
      wall: function (p) { if (p > 6) blip(140, 0.09, 'sine', Math.min(0.22, p * 0.008), 70); },
      jump: function (flip) { blip(flip ? 520 : 380, 0.09, 'square', 0.16, flip ? 260 : 700); },
      pad: function (big) { blip(big ? 620 : 880, 0.12, 'sine', 0.18, big ? 1200 : 1400); },
      goal: function () {
        [523, 659, 784, 1046].forEach(function (f, i) {
          setTimeout(function () { blip(f, 0.45, 'sawtooth', 0.22); }, i * 90);
        });
      },
      count: function (hi) { blip(hi ? 900 : 500, 0.12, 'square', 0.2); },
      boost: function (on, spd) {
        if (!ensure() || !boostGain) return;
        boostGain.gain.setTargetAtTime(on ? 0.14 : 0, ctx.currentTime, 0.05);
      }
    };
  })();

  // ------------------------------------------------------------------ HUD
  var el = {};
  function $(id) { return document.getElementById(id); }

  function setMsg(big, small, show) {
    el.msgBig.textContent = big || '';
    el.msgSmall.textContent = small || '';
    el.msg.style.opacity = show ? '1' : '0';
  }

  function updateHUD() {
    el.scoreB.textContent = S.score[0];
    el.scoreO.textContent = S.score[1];
    var t = Math.max(0, Math.ceil(S.time));
    var m = Math.floor(t / 60), s = t % 60;
    el.clock.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    el.clock.classList.toggle('ot', S.overtime);
    var b = Math.round(cars[0].boost);
    el.boostNum.textContent = b;
    el.boostArc.style.background =
      'conic-gradient(#ffb648 ' + (b * 3.6) + 'deg, rgba(255,255,255,0.10) 0deg)';
    el.boostArc.classList.toggle('full', b >= 100);
  }

  // ------------------------------------------------------------------ setup
  function resetPositions(kickoff) {
    var offs = [0, -22, 22, -12, 12];
    var o = kickoff ? offs[(Math.random() * offs.length) | 0] : 0;

    ball.pos.set(0, CFG.BALL.R + 0.02, 0);
    ball.vel.set(0, 0, 0); ball.spin.set(0, 0, 0);
    ball.quat.identity();

    var c0 = cars[0];
    c0.pos.set(o, CFG.CAR.RIDE, -F.L * 0.30);
    c0.vel.set(0, 0, 0); c0.omega.set(0, 0, 0);
    c0.quat.identity();
    if (o !== 0) c0.quat.setFromAxisAngle(new T.Vector3(0, 1, 0), -Math.atan2(o, F.L * 0.30) * 0.9);

    var c1 = cars[1];
    c1.pos.set(-o, CFG.CAR.RIDE, F.L * 0.30);
    c1.vel.set(0, 0, 0); c1.omega.set(0, 0, 0);
    c1.quat.setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI + (o !== 0 ? Math.atan2(-o, F.L * 0.30) * 0.9 : 0));

    for (var i = 0; i < 2; i++) {
      cars[i].boost = CFG.BOOST_START;
      cars[i].grounded = true; cars[i].jumpAvail = true;
      cars[i].flipAvail = false; cars[i].flipping = 0; cars[i].flipTimer = 0;
      cars[i].airTime = 0;
      RC.updateBasis(cars[i]);
    }
    for (var p = 0; p < pads.length; p++) { pads[p].t = 0; pads[p].mesh.visible = true; }

    // snap the camera behind the player
    _v.copy(c0.pos).addScaledVector(c0.fwd, -16); _v.y += 6.5;
    camPos.copy(_v);
    camLook.copy(ball.pos);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function startMatch(diff, len) {
    S.diff = diff; S.matchLen = len;
    S.score[0] = 0; S.score[1] = 0;
    S.time = len; S.overtime = false;
    ai.level = diff;
    resetPositions(true);
    beginCountdown();
    el.menu.classList.add('hidden');
    el.hud.classList.remove('hidden');
    A.resume();
  }

  function beginCountdown() {
    S.mode = 'countdown';
    S.timer = 3.0;
    setMsg('3', '', true);
  }

  function scoreGoal(who) {
    S.mode = 'goal';
    S.timer = 3.2;
    S.score[who]++;
    var col = who === 0 ? 0x3aa0ff : 0xff7a35;
    fx.explode(ball.pos, col);
    fx.ring(ball.pos, 8, col);
    A.goal();
    setMsg('GOAL!', who === 0 ? 'BLUE SCORES' : 'ORANGE SCORES', true);
    el.msgBig.style.color = who === 0 ? '#59b8ff' : '#ff9a4d';
    updateHUD();
    if (S.overtime) { S.timer = 3.2; S.endAfterGoal = true; }
  }

  function endMatch() {
    S.mode = 'over';
    var w = S.score[0] > S.score[1] ? 'YOU WIN' : (S.score[0] < S.score[1] ? 'YOU LOSE' : 'DRAW');
    el.overTitle.textContent = w;
    el.overScore.textContent = S.score[0] + ' - ' + S.score[1];
    el.over.classList.remove('hidden');
    setMsg('', '', false);
  }

  // ------------------------------------------------------------------ boot
  RC.boot = function () {
    var canvas = $('c');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = RC.buildScene(renderer);
    camera = new T.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.5, 600);
    scene.add(camera);

    ball = RC.makeBall();
    ballMesh = RC.buildBall();
    scene.add(ballMesh);

    cars.push(RC.makeCar(0, false));
    cars.push(RC.makeCar(1, true));
    carMeshes.push(RC.buildCar(0x1f6fd8, 0x7fe3ff));
    carMeshes.push(RC.buildCar(0xd8541f, 0xffc06a));
    scene.add(carMeshes[0]); scene.add(carMeshes[1]);

    pads = RC.buildPads(scene);
    fx = RC.buildFX(scene);
    ai = RC.makeAI(cars[1], 1, 1);

    ['msg', 'msgBig', 'msgSmall', 'scoreB', 'scoreO', 'clock', 'boostNum', 'boostArc',
      'menu', 'hud', 'over', 'overTitle', 'overScore'].forEach(function (k) { el[k] = $(k); });

    RC.initInput();
    clock = new T.Clock();

    window.addEventListener('resize', onResize);
    onResize();

    // menu wiring
    var diff = 1, len = 180;
    document.querySelectorAll('#menu [data-diff]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#menu [data-diff]').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel'); diff = +b.getAttribute('data-diff'); A.resume();
      };
    });
    document.querySelectorAll('#menu [data-len]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#menu [data-len]').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel'); len = +b.getAttribute('data-len'); A.resume();
      };
    });
    $('play').onclick = function () { startMatch(diff, len); };
    $('howto').onclick = function () { $('help').classList.remove('hidden'); };
    $('helpClose').onclick = function () { $('help').classList.add('hidden'); };
    $('btnCam').onclick = function () {
      ballCam = !ballCam;
      $('btnCam').textContent = ballCam ? 'BALL CAM' : 'CAR CAM';
    };
    $('btnPause').onclick = function () {
      if (S.mode === 'paused') { S.mode = S.resume; $('pause').classList.add('hidden'); }
      else if (S.mode === 'play' || S.mode === 'countdown') {
        S.resume = S.mode; S.mode = 'paused'; $('pause').classList.remove('hidden');
      }
    };
    $('resume').onclick = function () { S.mode = S.resume; $('pause').classList.add('hidden'); };
    $('quit').onclick = function () {
      S.mode = 'menu'; $('pause').classList.add('hidden');
      el.menu.classList.remove('hidden'); el.hud.classList.add('hidden');
    };
    $('again').onclick = function () { el.over.classList.add('hidden'); startMatch(S.diff, S.matchLen); };
    $('toMenu').onclick = function () {
      el.over.classList.add('hidden'); el.menu.classList.remove('hidden');
      el.hud.classList.add('hidden'); S.mode = 'menu';
    };
    $('invert').onclick = function () {
      RC.invertPitch = !RC.invertPitch;
      $('invert').textContent = 'AIR PITCH: ' + (RC.invertPitch ? 'NORMAL' : 'INVERTED');
    };

    resetPositions(true);
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  };

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ loop
  var acc = 0, FIXED = 1 / 120;

  var hooks = {
    onHit: function (c, b, p, j) {
      S.lastTouch = c.team;
      if (j > 6) { fx.ring(p, 1.6 + j * 0.05, c.team === 0 ? 0x9fd8ff : 0xffb98a); A.hit(j); }
    },
    onBallWall: function (b, p) { A.wall(p); },
    onJump: function (c, flip) { if (c.team === 0) A.jump(flip); },
    onLand: function (c) { }
  };

  function playerInput() {
    var I = RC.Input;
    return {
      steer: I.steer, pitch: I.pitch, gas: I.gas, rev: I.rev,
      boost: I.boost, roll: I.roll,
      jumpPressed: I._edge, jumpHeld: I.jumpHeld
    };
  }

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());

    if (S.mode === 'menu') {
      // idle camera orbit around the arena
      var t = performance.now() * 0.00008;
      camera.position.set(Math.sin(t) * 120, 45, Math.cos(t) * 120);
      camera.lookAt(0, 6, 0);
      RC.stepBall(ball, dt, hooks);
      syncMeshes(dt);
      fx.update(dt);
      renderer.render(scene, camera);
      return;
    }

    if (S.mode === 'paused') { renderer.render(scene, camera); return; }

    if (S.mode === 'countdown') {
      var was = Math.ceil(S.timer);
      S.timer -= dt;
      var now = Math.ceil(S.timer);
      if (now !== was && now > 0) { setMsg(String(now), '', true); A.count(false); }
      if (S.timer <= 0) {
        S.mode = 'play'; setMsg('GO!', '', true); A.count(true);
        setTimeout(function () { if (S.mode === 'play') setMsg('', '', false); }, 600);
      }
      RC.consumeJump();
    } else if (S.mode === 'goal') {
      S.timer -= dt;
      if (S.timer <= 0) {
        el.msgBig.style.color = '';
        if (S.endAfterGoal) { S.endAfterGoal = false; endMatch(); return; }
        if (S.time <= 0) { endMatch(); return; }
        resetPositions(true); beginCountdown();
      }
    } else if (S.mode === 'play') {
      S.time -= dt;
      if (S.time <= 0) {
        S.time = 0;
        if (S.score[0] === S.score[1]) {
          if (!S.overtime) {
            S.overtime = true;
            setMsg('OVERTIME', 'NEXT GOAL WINS', true);
            setTimeout(function () { if (S.mode === 'play') setMsg('', '', false); }, 1800);
          }
        } else { endMatch(); return; }
      }
    }

    var live = (S.mode === 'play');

    // fixed-step physics
    acc += dt;
    var steps = 0;
    RC.Input._edge = RC.consumeJump();
    while (acc >= FIXED && steps < 8) {
      var pin = playerInput();
      var ain = RC.stepAI(ai, ball, pads, FIXED);
      if (!live) {
        pin = { steer: 0, pitch: 0, gas: 0, rev: 0, boost: false, roll: false, jumpPressed: false, jumpHeld: false };
        ain = { steer: 0, pitch: 0, gas: 0, rev: 0, boost: false, roll: false, jumpPressed: false, jumpHeld: false };
      }
      RC.stepCar(cars[0], pin, FIXED, hooks);
      RC.stepCar(cars[1], ain, FIXED, hooks);
      if (live || S.mode === 'goal') RC.stepBall(ball, FIXED, hooks);
      RC.carCar(cars[0], cars[1]);
      RC.carBall(cars[0], ball, hooks);
      RC.carBall(cars[1], ball, hooks);
      RC.Input._edge = false;
      acc -= FIXED; steps++;
    }
    if (steps >= 8) acc = 0;

    if (live) {
      collectPads(dt);
      checkGoal();
    }
    A.boost(cars[0].boosting);

    updateCamera(dt);
    syncMeshes(dt);
    fx.update(dt);
    updatePads(dt);
    updateHUD();
    renderer.render(scene, camera);
    autoScale(dt);
  }

  // keep the frame rate up on weaker phones by dropping the render scale
  var perf = { t: 0, n: 0, ratio: 0 };
  function autoScale(dt) {
    perf.t += dt; perf.n++;
    if (perf.n < 70) return;
    var avg = perf.t / perf.n;
    perf.t = 0; perf.n = 0;
    var cap = Math.min(window.devicePixelRatio || 1, 2);
    if (!perf.ratio) perf.ratio = cap;
    var next = perf.ratio;
    if (avg > 0.024 && perf.ratio > 0.75) next = Math.max(0.75, perf.ratio - 0.35);
    else if (avg < 0.0135 && perf.ratio < cap) next = Math.min(cap, perf.ratio + 0.25);
    if (next !== perf.ratio) {
      perf.ratio = next;
      renderer.setPixelRatio(next);
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  function checkGoal() {
    var r = CFG.BALL.R * 0.5;
    if (Math.abs(ball.pos.x) > G.W / 2 || ball.pos.y > G.H) return;
    if (ball.pos.z > F.L / 2 + r) scoreGoal(0);
    else if (ball.pos.z < -F.L / 2 - r) scoreGoal(1);
  }

  function collectPads(dt) {
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (p.t > 0) {
        p.t -= dt;
        if (p.t <= 0) { p.t = 0; p.mesh.visible = true; p.ring.material.opacity = p.big ? 0.4 : 0.35; }
        continue;
      }
      for (var k = 0; k < cars.length; k++) {
        var c = cars[k];
        if (c.pos.y > (p.big ? 5.5 : 3.5)) continue;
        var dx = c.pos.x - p.x, dz = c.pos.z - p.z;
        if (dx * dx + dz * dz < p.r * p.r) {
          if (c.boost >= 100) continue;
          c.boost = Math.min(100, c.boost + (p.big ? CFG.PAD_BIG : CFG.PAD_SMALL));
          p.t = p.big ? CFG.PAD_BIG_T : CFG.PAD_SMALL_T;
          p.mesh.visible = false;
          p.ring.material.opacity = 0.08;
          if (k === 0) A.pad(p.big);
          break;
        }
      }
    }
  }

  function updatePads(dt) {
    var t = performance.now() * 0.001;
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i];
      if (!p.mesh.visible) continue;
      if (p.big) { p.mesh.rotation.z = t * 1.6; p.mesh.position.y = 2.2 + Math.sin(t * 2 + i) * 0.25; }
      else { p.mesh.rotation.y = t * 2.2; p.mesh.position.y = 1.2 + Math.sin(t * 3 + i) * 0.18; }
    }
  }

  // ------------------------------------------------------------------ view
  function updateCamera(dt) {
    var c = cars[0];
    var dist = 15.5, height = 6.2;
    var sp = c.vel.length();
    dist += Math.min(4.5, sp * 0.09);

    var dir = _v;
    if (ballCam) {
      dir.copy(c.pos).sub(ball.pos); dir.y = 0;
      if (dir.lengthSq() < 4) { dir.copy(c.fwd); dir.y = 0; dir.negate(); }
    } else {
      dir.copy(c.fwd); dir.y = 0; dir.negate();
    }
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();

    var want = _v2.copy(c.pos).addScaledVector(dir, dist);
    want.y = c.pos.y + height + Math.min(6, sp * 0.05);
    // keep the camera inside the arena, otherwise wall/ceiling driving looks
    // through the outside of the stadium
    want.x = RC.clamp(want.x, -(F.W / 2 - 2.5), F.W / 2 - 2.5);
    want.z = RC.clamp(want.z, -(F.L / 2 - 2.5), F.L / 2 - 2.5);
    want.y = RC.clamp(want.y, 2.2, F.H - 1.5);

    var k = 1 - Math.exp(-9 * dt);
    camPos.lerp(want, k);

    var look = _v.copy(c.pos);
    if (ballCam) look.lerp(ball.pos, 0.5);
    look.y += 2.0;
    camLook.lerp(look, 1 - Math.exp(-11 * dt));

    camera.position.copy(camPos);
    camera.lookAt(camLook);

    var fov = 72 + Math.min(14, sp * 0.30) + (c.boosting ? 3 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt));
      camera.updateProjectionMatrix();
    }
  }

  function syncMeshes(dt) {
    ballMesh.position.copy(ball.pos);
    ballMesh.quaternion.copy(ball.quat);
    var sq = ball.vel.length();
    ballMesh.userData.halo.material.opacity = 0.08 + Math.min(0.35, sq * 0.004);

    for (var i = 0; i < cars.length; i++) {
      var c = cars[i], m = carMeshes[i];
      m.position.copy(c.pos);
      m.quaternion.copy(c.quat);
      var w = m.userData.wheels;
      for (var k = 0; k < w.length; k++) w[k].rotation.x = c.wheelSpin;
      var on = c.boosting;
      m.userData.flames.visible = on;
      if (on) {
        var s = 0.75 + Math.random() * 0.5;
        m.userData.flames.scale.set(1, 1, s);
      }
      m.userData.glow.intensity = on ? 1.6 : 0;

      // blob shadow
      var sh = fx.carShadows[i];
      sh.position.set(c.pos.x, 0.05, c.pos.z);
      var h = Math.max(0, c.pos.y);
      sh.material.opacity = Math.max(0, 0.34 - h * 0.012);
      sh.scale.setScalar(1 + h * 0.03);
      sh.visible = Math.abs(c.pos.z) < F.L / 2 + 1;
    }
    window.__setBall = function (x, y, z, vx, vy, vz) {
      ball.pos.set(x, y, z); ball.vel.set(vx || 0, vy || 0, vz || 0);
    };
    window.__dbg = function () {
      return {
        mode: S.mode, time: +S.time.toFixed(1), score: S.score.slice(),
        car: cars[0].pos.toArray().map(function (v) { return +v.toFixed(1); }),
        speed: +cars[0].vel.length().toFixed(1),
        grounded: cars[0].grounded, boost: +cars[0].boost.toFixed(0),
        ai: cars[1].pos.toArray().map(function (v) { return +v.toFixed(1); }),
        ball: ball.pos.toArray().map(function (v) { return +v.toFixed(1); }),
        ballSpeed: +ball.vel.length().toFixed(1)
      };
    };

    var bs = fx.ballShadow;
    bs.position.set(ball.pos.x, 0.06, ball.pos.z);
    var bh = Math.max(0, ball.pos.y - CFG.BALL.R);
    bs.material.opacity = Math.max(0, 0.34 - bh * 0.011);
    bs.scale.setScalar(1 + bh * 0.028);
  }
})();
