/* ==========================================================================
   Linguey — 3D Spelarläge (bonuslektioner)
   Ett riktigt förstapersons-3D-spel byggt på ren WebGL (inga externa
   bibliotek, så allt fungerar offline i APK:n). Du går runt i en värld och
   springer in i porten med rätt översättning.
   Spelet är designat för PORTRÄTTLÄGE — se orientation.js.
   ========================================================================== */
window.LINGUEY_3D = (function () {
  'use strict';

  /* ------------------------------------------------------------ Matrismatte */
  function m4() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far), o = new Float32Array(16);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1;
    o[14] = 2 * far * near * nf;
    return o;
  }
  function translation(x, y, z) {
    var o = m4(); o[12] = x; o[13] = y; o[14] = z; return o;
  }
  function scaling(x, y, z) {
    var o = m4(); o[0] = x; o[5] = y; o[10] = z; return o;
  }
  function rotY(a) {
    var c = Math.cos(a), s = Math.sin(a), o = m4();
    o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
  }
  function rotX(a) {
    var c = Math.cos(a), s = Math.sin(a), o = m4();
    o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
  }

  /* --------------------------------------------------------------- Shaders */
  var VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec2 aUV;',
    'uniform mat4 uProj, uView, uModel;',
    'varying vec3 vN;',
    'varying vec2 vUV;',
    'varying vec3 vWorld;',
    'varying float vDist;',
    'void main() {',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vec4 v = uView * w;',
    '  vWorld = w.xyz;',
    '  vN = normalize(mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNormal);',
    '  vUV = aUV;',
    '  vDist = length(v.xyz);',
    '  gl_Position = uProj * v;',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vN;',
    'varying vec2 vUV;',
    'varying vec3 vWorld;',
    'varying float vDist;',
    'uniform sampler2D uTex;',
    'uniform float uUseTex;',
    'uniform float uGrid;',
    'uniform float uEmissive;',
    'uniform float uAlpha;',
    'uniform vec3 uColor;',
    'uniform vec3 uFog;',
    'void main() {',
    '  vec3 base = uColor;',
    '  float a = uAlpha;',
    '  if (uUseTex > 0.5) {',
    '    vec4 t = texture2D(uTex, vUV);',
    '    base = mix(base, t.rgb, t.a);',
    '    a *= max(t.a, 0.55);',
    '  }',
    '  if (uGrid > 0.5) {',
    '    vec2 g = abs(fract(vWorld.xz * 0.25) - 0.5);',
    '    float line = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));',
    '    base = mix(base, vec3(0.42, 0.55, 1.0), line * 0.5);',
    '    vec2 g2 = abs(fract(vWorld.xz * 0.05) - 0.5);',
    '    float line2 = 1.0 - smoothstep(0.0, 0.012, min(g2.x, g2.y));',
    '    base = mix(base, vec3(0.65, 0.95, 1.0), line2 * 0.55);',
    '  }',
    '  vec3 L = normalize(vec3(0.45, 0.85, 0.3));',
    '  float diff = max(dot(normalize(vN), L), 0.0);',
    '  float amb = 0.42;',
    '  vec3 lit = base * (amb + diff * 0.78);',
    '  lit = mix(lit, base, uEmissive);',
    '  float fog = 1.0 - exp(-vDist * 0.016);',
    '  fog = clamp(fog, 0.0, 0.92);',
    '  gl_FragColor = vec4(mix(lit, uFog, fog), a);',
    '}'
  ].join('\n');

  var SKY_VS = [
    'attribute vec2 aPos;',
    'varying vec2 vUV;',
    'void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.999, 1.0); }'
  ].join('\n');

  var SKY_FS = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform float uTime;',
    'void main() {',
    '  vec3 top = vec3(0.04, 0.05, 0.16);',
    '  vec3 mid = vec3(0.16, 0.13, 0.42);',
    '  vec3 hor = vec3(0.42, 0.28, 0.62);',
    '  float y = vUV.y;',
    '  vec3 c = mix(hor, mid, smoothstep(0.0, 0.5, y));',
    '  c = mix(c, top, smoothstep(0.45, 1.0, y));',
    /* enkla stjärnor */
    '  vec2 p = vUV * vec2(60.0, 90.0);',
    '  vec2 ip = floor(p);',
    '  float rnd = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);',
    '  float star = step(0.992, rnd) * smoothstep(0.35, 1.0, y);',
    '  float tw = 0.6 + 0.4 * sin(uTime * 2.4 + rnd * 30.0);',
    '  c += star * tw * 0.85;',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------------- Geometri */
  /* Kub: 36 vertexar med normal + uv */
  function cubeData() {
    var f = [
      /* +Z */ [[-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],[0,0,1]],
      /* -Z */ [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
      /* +X */ [[1,-1, 1],[1,-1,-1],[1,1,-1],[1,1, 1],[1,0,0]],
      /* -X */ [[-1,-1,-1],[-1,-1, 1],[-1,1, 1],[-1,1,-1],[-1,0,0]],
      /* +Y */ [[-1,1, 1],[1,1, 1],[1,1,-1],[-1,1,-1],[0,1,0]],
      /* -Y */ [[-1,-1,-1],[1,-1,-1],[1,-1, 1],[-1,-1, 1],[0,-1,0]]
    ];
    var uv = [[0,0],[1,0],[1,1],[0,1]];
    var out = [];
    f.forEach(function (face) {
      var n = face[4];
      var order = [0, 1, 2, 0, 2, 3];
      order.forEach(function (i) {
        out.push(face[i][0], face[i][1], face[i][2], n[0], n[1], n[2], uv[i][0], uv[i][1]);
      });
    });
    return new Float32Array(out);
  }

  /* Plan i XZ (uppåtvänd normal) */
  function planeData() {
    var v = [
      [-1, 0, -1, 0, 0], [1, 0, -1, 1, 0], [1, 0, 1, 1, 1],
      [-1, 0, -1, 0, 0], [1, 0, 1, 1, 1], [-1, 0, 1, 0, 1]
    ];
    var out = [];
    v.forEach(function (p) { out.push(p[0], p[1], p[2], 0, 1, 0, p[3], p[4]); });
    return new Float32Array(out);
  }

  /* Vertikal panel i XY (normal mot +Z) */
  function panelData() {
    var v = [
      [-1, -1, 0, 0, 1], [1, -1, 0, 1, 1], [1, 1, 0, 1, 0],
      [-1, -1, 0, 0, 1], [1, 1, 0, 1, 0], [-1, 1, 0, 0, 0]
    ];
    var out = [];
    v.forEach(function (p) { out.push(p[0], p[1], p[2], 0, 0, 1, p[3], p[4]); });
    return new Float32Array(out);
  }

  /* ------------------------------------------------------------------ Motor */
  var gl = null, canvas = null;
  var prog = null, skyProg = null;
  var loc = {}, skyLoc = {};
  var buf = {};
  var running = false, paused = false, rafId = 0;
  var cfg = null;
  var lastT = 0;

  var player = { x: 0, y: 1.65, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, bob: 0 };
  var input = { mx: 0, my: 0, sprint: false };
  var game = null;
  var gates = [];
  var props = [];

  function compile(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }
  function link(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(vs, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  function initGL() {
    canvas = document.getElementById('glcanvas');
    gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
         canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
    if (!gl) return false;

    prog = link(VS, FS);
    ['aPos', 'aNormal', 'aUV'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
    ['uProj', 'uView', 'uModel', 'uTex', 'uUseTex', 'uGrid', 'uEmissive', 'uAlpha', 'uColor', 'uFog']
      .forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

    skyProg = link(SKY_VS, SKY_FS);
    skyLoc.aPos = gl.getAttribLocation(skyProg, 'aPos');
    skyLoc.uTime = gl.getUniformLocation(skyProg, 'uTime');

    buf.cube = makeBuf(cubeData());
    buf.plane = makeBuf(planeData());
    buf.panel = makeBuf(panelData());
    buf.sky = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.sky);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  function makeBuf(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { b: b, n: data.length / 8 };
  }

  /* Textur från en canvas med text (ordet på porten) */
  function textTexture(text, bg, fg) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = 10;
    x.strokeRect(5, 5, 502, 246);

    var size = 74;
    x.fillStyle = fg;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    /* Krymp texten tills den passar */
    do {
      x.font = '900 ' + size + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
      size -= 4;
    } while (x.measureText(text).width > 460 && size > 22);

    var words = text.split(' ');
    if (words.length > 2) {
      var half = Math.ceil(words.length / 2);
      x.fillText(words.slice(0, half).join(' '), 256, 100);
      x.fillText(words.slice(half).join(' '), 256, 100 + size + 8);
    } else {
      x.fillText(text, 256, 128);
    }

    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /* --------------------------------------------------------------- Ritning */
  var VIEW = m4(), PROJ = m4();

  function draw(mesh, model, color, opts) {
    opts = opts || {};
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.b);
    var stride = 32;
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.aNormal);
    gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(loc.aUV);
    gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, stride, 24);

    gl.uniformMatrix4fv(loc.uModel, false, model);
    gl.uniform3fv(loc.uColor, color);
    gl.uniform1f(loc.uGrid, opts.grid ? 1 : 0);
    gl.uniform1f(loc.uEmissive, opts.emissive || 0);
    gl.uniform1f(loc.uAlpha, opts.alpha === undefined ? 1 : opts.alpha);
    if (opts.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, opts.tex);
      gl.uniform1i(loc.uTex, 0);
      gl.uniform1f(loc.uUseTex, 1);
    } else {
      gl.uniform1f(loc.uUseTex, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }

  function hexToRgb(h) {
    var n = parseInt(h.replace('#', ''), 16);
    return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
  }

  /* ------------------------------------------------------------- Spelvärlden */
  function buildProps() {
    props = [];
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    for (var i = 0; i < 46; i++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = rnd(10, 58);
      var h = rnd(1.5, 9);
      props.push({
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        w: rnd(.7, 2.4),
        h: h,
        color: hexToRgb(['#2b3170', '#343a80', '#242a5e', '#3b2f70', '#1f2a5c'][i % 5]),
        spin: rnd(-.3, .3)
      });
    }
    /* Några svävande kristaller för stämning */
    for (var j = 0; j < 16; j++) {
      var a2 = Math.random() * Math.PI * 2, d2 = rnd(8, 40);
      props.push({
        x: Math.cos(a2) * d2, z: Math.sin(a2) * d2,
        w: .5, h: .5, y: rnd(3, 9), float: true,
        color: hexToRgb(['#22d3ee', '#6d5cff', '#ffc53d'][j % 3]),
        spin: rnd(.5, 1.6)
      });
    }
  }

  function newRound() {
    /* Rensa gamla texturer */
    gates.forEach(function (g) { if (g.tex) gl.deleteTexture(g.tex); });
    gates = [];

    var words = cfg.words;
    var pick = words[Math.floor(Math.random() * words.length)];
    /* Undvik samma ord två gånger i rad */
    if (game.lastWord && words.length > 4) {
      var guard = 0;
      while (pick[0] === game.lastWord && guard++ < 12) {
        pick = words[Math.floor(Math.random() * words.length)];
      }
    }
    game.lastWord = pick[0];
    game.prompt = pick[0];
    game.answer = pick[1];

    var choices = [pick[1]];
    var guard2 = 0;
    while (choices.length < 3 && guard2++ < 200) {
      var w = words[Math.floor(Math.random() * words.length)];
      if (choices.indexOf(w[1]) === -1) choices.push(w[1]);
    }
    choices = choices.sort(function () { return Math.random() - .5; });

    var palette = ['#1c8ad6', '#c0392b', '#7a45c9'];
    var baseAngle = player.yaw + (Math.random() - .5) * .3;
    /* Porträttläget har smalt synfält på bredden, så portarna placeras tätt i
       vinkel men på olika avstånd — då syns alla tre framför spelaren. */
    var side = [15, 18.5].sort(function () { return Math.random() - .5; });
    choices.forEach(function (txt, i) {
      var ang = baseAngle + (i - 1) * 0.24;
      /* Mittenporten hamnar längst bort så att den syns mellan sidoportarna */
      var dist = (i === 1) ? 24 + Math.random() * 2 : side.pop() + Math.random() * 1.5;
      gates.push({
        word: txt,
        correct: txt === game.answer,
        x: player.x + Math.sin(ang) * dist * -1,
        z: player.z + Math.cos(ang) * dist * -1,
        /* Panelens normal blir (sin yaw, 0, cos yaw) — med yaw = ang pekar den
           tillbaka mot spelaren, så texten står rättvänd. */
        yaw: ang,
        color: hexToRgb(palette[i]),
        tex: textTexture(txt, palette[i], '#ffffff'),
        hit: false,
        pulse: Math.random() * 6
      });
    });

    /* Håll portarna inom världen */
    gates.forEach(function (g) {
      var d = Math.sqrt(g.x * g.x + g.z * g.z);
      if (d > 52) { g.x *= 52 / d; g.z *= 52 / d; }
    });

    clearSightLines();
    updateHud();
  }

  /* Avstånd från punkt till linjesegment i XZ-planet */
  function distToSegment(px, pz, ax, az, bx, bz) {
    var vx = bx - ax, vz = bz - az;
    var wx = px - ax, wz = pz - az;
    var len2 = vx * vx + vz * vz;
    var t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wz * vz) / len2)) : 0;
    var cx = ax + vx * t, cz = az + vz * t;
    return Math.hypot(px - cx, pz - cz);
  }

  /* Flyttar undan dekor som skulle skymma orden på portarna */
  function clearSightLines() {
    props.forEach(function (p) {
      if (p.float) return;
      for (var tries = 0; tries < 6; tries++) {
        var blocks = gates.some(function (g) {
          return distToSegment(p.x, p.z, player.x, player.z, g.x, g.z) < 5 ||
                 Math.hypot(p.x - g.x, p.z - g.z) < 6;
        });
        if (!blocks) return;
        var ang = Math.random() * Math.PI * 2;
        var dist = 34 + Math.random() * 24;
        p.x = Math.cos(ang) * dist;
        p.z = Math.sin(ang) * dist;
      }
    });
  }

  /* ------------------------------------------------------------------- HUD */
  function updateHud() {
    var q = document.getElementById('hud-word');
    if (q) q.textContent = game.prompt;
    var m = document.getElementById('hud-meta');
    if (m) {
      m.innerHTML =
        '<span>⏱ <b>' + Math.max(0, Math.ceil(game.time)) + 's</b></span>' +
        '<span>🎯 <b>' + game.correct + '/' + cfg.goal + '</b></span>' +
        '<span>🔥 <b>' + game.combo + '</b></span>' +
        '<span>❌ <b>' + game.wrong + '</b></span>';
    }
    var bar = document.getElementById('hud-bar');
    if (bar) bar.style.width = (game.correct / cfg.goal * 100) + '%';
  }

  function toast(msg, ok) {
    var t = document.getElementById('toast3d');
    if (!t) return;
    t.textContent = msg;
    t.style.color = ok ? '#4ae09a' : '#ff7b86';
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 950);
  }

  /* ------------------------------------------------------------- Spelloopen */
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    /* Porträtt: stort vertikalt fov ger tillräckligt brett synfält i stående format */
    PROJ = perspective(82 * Math.PI / 180, canvas.width / Math.max(1, canvas.height), .1, 200);
  }

  function step(t) {
    if (!running) return;
    rafId = requestAnimationFrame(step);

    var dt = Math.min(.05, (t - lastT) / 1000 || 0);
    lastT = t;
    if (paused) { return; }

    resize();
    update(dt);
    render(t / 1000);
  }

  function update(dt) {
    /* Rörelse */
    var speed = (input.sprint ? 11 : 6.4);
    var fwd = -input.my, side = input.mx;
    var len = Math.sqrt(fwd * fwd + side * side);
    if (len > 1) { fwd /= len; side /= len; }

    var sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
    var dx = (side * cosY - fwd * sinY) * speed;
    var dz = (-side * sinY - fwd * cosY) * speed;

    player.vx += (dx - player.vx) * Math.min(1, dt * 9);
    player.vz += (dz - player.vz) * Math.min(1, dt * 9);
    player.x += player.vx * dt;
    player.z += player.vz * dt;

    /* Världsgräns */
    var d = Math.sqrt(player.x * player.x + player.z * player.z);
    if (d > 58) { player.x *= 58 / d; player.z *= 58 / d; }

    /* Huvudguppning när man går */
    var moving = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
    player.bob += dt * moving * 1.5;
    player.y = 1.65 + Math.sin(player.bob * 2.2) * Math.min(.09, moving * .014);

    /* Tid */
    game.time -= dt;
    game.hudAcc = (game.hudAcc || 0) + dt;
    if (game.hudAcc > .2) { game.hudAcc = 0; updateHud(); }
    if (game.time <= 0) { finish(false); return; }

    /* Kollision med portar */
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      g.pulse += dt * 2.5;
      if (g.hit) continue;
      var ddx = g.x - player.x, ddz = g.z - player.z;
      if (ddx * ddx + ddz * ddz < 3.1 * 3.1) {
        g.hit = true;
        onGate(g);
        return;
      }
    }
  }

  function onGate(g) {
    if (g.correct) {
      game.correct++;
      game.combo++;
      if (game.combo > game.bestCombo) game.bestCombo = game.combo;
      game.time = Math.min(cfg.time, game.time + 4);
      if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
      toast('✅ ' + g.word + (game.combo >= 3 ? '  ×' + game.combo : ''), true);
      if (game.correct >= cfg.goal) { finish(true); return; }
      setTimeout(newRound, 260);
    } else {
      game.wrong++;
      game.combo = 0;
      game.time -= 8;
      if (navigator.vibrate) { try { navigator.vibrate([40, 50, 40]); } catch (e) {} }
      toast('❌ Rätt: ' + game.answer, false);
      setTimeout(newRound, 500);
    }
    updateHud();
  }

  function finish(completed) {
    if (!running) return;
    var res = {
      completed: completed,
      correct: game.correct,
      wrong: game.wrong,
      bestCombo: game.bestCombo,
      timeLeft: Math.max(0, Math.round(game.time))
    };
    running = false;
    cancelAnimationFrame(rafId);
    if (cfg && cfg.onFinish) cfg.onFinish(res);
  }

  function render(time) {
    var fog = new Float32Array([0.20, 0.16, 0.38]);

    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Himmel */
    gl.useProgram(skyProg);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.sky);
    gl.enableVertexAttribArray(skyLoc.aPos);
    gl.vertexAttribPointer(skyLoc.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(skyLoc.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);

    /* Kamera */
    VIEW = mul(mul(rotX(-player.pitch), rotY(-player.yaw)),
               translation(-player.x, -player.y, -player.z));

    gl.useProgram(prog);
    gl.uniformMatrix4fv(loc.uProj, false, PROJ);
    gl.uniformMatrix4fv(loc.uView, false, VIEW);
    gl.uniform3fv(loc.uFog, fog);

    /* Mark */
    draw(buf.plane, mul(translation(0, 0, 0), scaling(90, 1, 90)),
      new Float32Array([0.09, 0.11, 0.26]), { grid: true });

    /* Dekor */
    props.forEach(function (p) {
      var y = p.float ? p.y + Math.sin(time * 1.4 + p.x) * .5 : p.h;
      var m = mul(translation(p.x, y, p.z), rotY(time * p.spin));
      m = mul(m, scaling(p.w, p.float ? p.w : p.h, p.w));
      draw(buf.cube, m, p.color, { emissive: p.float ? .75 : 0, alpha: p.float ? .9 : 1 });
    });

    /* Portar */
    gates.forEach(function (g) {
      if (g.hit) return;
      var glow = .55 + Math.sin(g.pulse * 2) * .2;

      /* Golvplatta */
      var pad = mul(translation(g.x, 0.03, g.z), scaling(3.1, 1, 3.1));
      draw(buf.plane, pad, g.color, { emissive: glow, alpha: .42 });

      /* Två stolpar + tvärbalk */
      var post = function (ox) {
        var m = mul(translation(g.x, 2.2, g.z), rotY(g.yaw));
        m = mul(m, translation(ox, 0, 0));
        m = mul(m, scaling(.22, 2.2, .22));
        draw(buf.cube, m, g.color, { emissive: .35 });
      };
      post(-2.1); post(2.1);

      var beam = mul(translation(g.x, 4.5, g.z), rotY(g.yaw));
      beam = mul(beam, scaling(2.35, .2, .2));
      draw(buf.cube, beam, g.color, { emissive: .35 });

      /* Ordpanel */
      var panel = mul(translation(g.x, 2.7, g.z), rotY(g.yaw));
      panel = mul(panel, scaling(2.0, 1.0, 1));
      draw(buf.panel, panel, g.color, { tex: g.tex, emissive: .82, alpha: .97 });

      /* Baksida så porten syns från alla håll */
      var back = mul(translation(g.x, 2.7, g.z), rotY(g.yaw + Math.PI));
      back = mul(back, scaling(2.0, 1.0, 1));
      draw(buf.panel, back, g.color, { tex: g.tex, emissive: .82, alpha: .97 });
    });
  }

  /* ------------------------------------------------------------- Styrning */
  var stickState = { active: false, id: null, cx: 0, cy: 0, r: 56 };
  var lookState = { id: null, lx: 0, ly: 0 };

  function bindControls() {
    var stick = document.getElementById('stick');
    var knob = document.getElementById('knob');
    var look = document.getElementById('lookpad');
    var sprint = document.getElementById('sprintbtn');
    var exit = document.getElementById('exit3d');

    function stickStart(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      var r = stick.getBoundingClientRect();
      stickState.active = true;
      stickState.id = t.identifier !== undefined ? t.identifier : 'mouse';
      stickState.cx = r.left + r.width / 2;
      stickState.cy = r.top + r.height / 2;
      stickState.r = r.width / 2;
      stickMove(e);
      e.preventDefault();
    }
    function stickMove(e) {
      if (!stickState.active) return;
      var t = pickTouch(e, stickState.id);
      if (!t) return;
      var dx = t.clientX - stickState.cx, dy = t.clientY - stickState.cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      var max = stickState.r;
      if (d > max) { dx *= max / d; dy *= max / d; }
      input.mx = dx / max;
      input.my = dy / max;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      e.preventDefault();
    }
    function stickEnd(e) {
      if (!stickState.active) return;
      stickState.active = false;
      input.mx = input.my = 0;
      knob.style.transform = '';
    }

    stick.addEventListener('touchstart', stickStart, { passive: false });
    stick.addEventListener('touchmove', stickMove, { passive: false });
    stick.addEventListener('touchend', stickEnd, false);
    stick.addEventListener('touchcancel', stickEnd, false);
    stick.addEventListener('mousedown', function (e) { stickStart(e); });
    window.addEventListener('mousemove', function (e) { if (stickState.active) stickMove(e); });
    window.addEventListener('mouseup', stickEnd);

    function lookStart(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      lookState.id = t.identifier !== undefined ? t.identifier : 'mouse';
      lookState.lx = t.clientX; lookState.ly = t.clientY;
      e.preventDefault();
    }
    function lookMove(e) {
      if (lookState.id === null) return;
      var t = pickTouch(e, lookState.id);
      if (!t) return;
      var dx = t.clientX - lookState.lx, dy = t.clientY - lookState.ly;
      lookState.lx = t.clientX; lookState.ly = t.clientY;
      player.yaw -= dx * 0.0055;
      player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * 0.0045));
      e.preventDefault();
    }
    function lookEnd() { lookState.id = null; }

    look.addEventListener('touchstart', lookStart, { passive: false });
    look.addEventListener('touchmove', lookMove, { passive: false });
    look.addEventListener('touchend', lookEnd, false);
    look.addEventListener('touchcancel', lookEnd, false);
    look.addEventListener('mousedown', lookStart);
    window.addEventListener('mousemove', function (e) { if (lookState.id === 'mouse') lookMove(e); });
    window.addEventListener('mouseup', lookEnd);

    /* Tangentbord (praktiskt i webbläsare/emulator) */
    window.addEventListener('keydown', function (e) { key(e, true); });
    window.addEventListener('keyup', function (e) { key(e, false); });
    function key(e, down) {
      if (!running) return;
      var k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') input.my = down ? -1 : 0;
      if (k === 's' || k === 'arrowdown') input.my = down ? 1 : 0;
      if (k === 'a' || k === 'arrowleft') input.mx = down ? -1 : 0;
      if (k === 'd' || k === 'arrowright') input.mx = down ? 1 : 0;
      if (k === 'shift') input.sprint = down;
    }

    sprint.addEventListener('touchstart', function (e) { input.sprint = true; e.preventDefault(); }, { passive: false });
    sprint.addEventListener('touchend', function () { input.sprint = false; }, false);
    sprint.addEventListener('mousedown', function () { input.sprint = true; });
    sprint.addEventListener('mouseup', function () { input.sprint = false; });

    exit.addEventListener('click', function () {
      running = false;
      cancelAnimationFrame(rafId);
      if (cfg && cfg.onQuit) cfg.onQuit();
    });
  }

  function pickTouch(e, id) {
    if (!e.changedTouches) return e;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === id) return t;
    }
    return null;
  }

  var controlsBound = false;

  /* ----------------------------------------------------------------- Publik */
  function start(config) {
    cfg = config;
    if (!gl && !initGL()) {
      alert('3D-läget kräver WebGL, som inte kunde startas på den här enheten.');
      if (cfg.onQuit) cfg.onQuit();
      return;
    }
    if (!controlsBound) { bindControls(); controlsBound = true; }

    player = { x: 0, y: 1.65, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, bob: 0 };
    input = { mx: 0, my: 0, sprint: false };
    game = { time: cfg.time, correct: 0, wrong: 0, combo: 0, bestCombo: 0, prompt: '', answer: '' };

    buildProps();
    newRound();

    var lbl = document.getElementById('hud-lang');
    if (lbl) lbl.textContent = 'Spring in i rätt ord på ' + cfg.language.name.toLowerCase();

    running = true;
    paused = false;
    lastT = performance.now();
    resize();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);

    /* Kontrollera porträttläget direkt */
    if (window.LINGUEY_ORIENTATION) window.LINGUEY_ORIENTATION.evaluate();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  function setPaused(p) {
    if (paused === p) return;
    paused = p;
    if (!p) lastT = performance.now();
  }

  return {
    start: start,
    stop: stop,
    setPaused: setPaused,
    isRunning: function () { return running; },
    /* Insyn i världen — används av felsökning och automattester */
    inspect: function () { return { player: player, gates: gates, game: game }; }
  };
})();
