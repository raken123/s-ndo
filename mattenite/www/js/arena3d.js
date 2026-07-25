/* ==========================================================================
   arena3d.js — Minfältet: förstapersons-3D där osynliga bomber ligger utspridda.
   Går du på en smäller frågan igång — svara rätt och kasta bomben på någon annan.
   Egen liten WebGL-motor, inga externa bibliotek.
   ========================================================================== */
(function (M) {
  'use strict';

  var A = {};
  M.arena = A;

  var R = 13;            // arenans halva bredd
  var EYE = 1.62;        // ögonhöjd
  var PR = 0.42;         // spelarradie
  var MINE_R = 0.62;     // hur nära man måste komma en mina
  var SPEED = 4.2;
  var BOT_SPEED = 3.4;

  var gl = null, canvas = null, prog = null, loc = {}, meshes = {}, textures = {};
  var raf = null, lastT = 0;

  /* ======================================================================
     Matriser
     ====================================================================== */

  function mat4() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }

  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function multiply(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      for (var j = 0; j < 4; j++) {
        o[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
      }
    }
    return o;
  }

  function translation(x, y, z) {
    var m = mat4(); m[12] = x; m[13] = y; m[14] = z; return m;
  }

  function rotationY(a) {
    var c = Math.cos(a), s = Math.sin(a), m = mat4();
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m;
  }

  function rotationX(a) {
    var c = Math.cos(a), s = Math.sin(a), m = mat4();
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m;
  }

  function scaling(x, y, z) {
    var m = mat4(); m[0] = x; m[5] = y; m[10] = z; return m;
  }

  /* ======================================================================
     Shaders
     ====================================================================== */

  var VS = [
    'attribute vec3 aPos;', 'attribute vec3 aNrm;', 'attribute vec3 aCol;', 'attribute vec2 aUV;',
    'uniform mat4 uProj; uniform mat4 uView; uniform mat4 uModel;',
    'varying vec3 vCol; varying vec2 vUV; varying vec3 vNrm; varying vec3 vWorld; varying float vFog;',
    'void main() {',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vec4 v = uView * w;',
    '  gl_Position = uProj * v;',
    '  vCol = aCol; vUV = aUV;',
    '  vNrm = mat3(uModel) * aNrm;',
    '  vWorld = w.xyz;',
    '  vFog = clamp(length(v.xyz) / 30.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying vec3 vCol; varying vec2 vUV; varying vec3 vNrm; varying vec3 vWorld; varying float vFog;',
    'uniform sampler2D uTex; uniform float uUseTex; uniform float uGrid;',
    'uniform vec3 uTint; uniform float uAlpha; uniform vec3 uFogCol; uniform float uEmissive;',
    'void main() {',
    '  vec4 base = vec4(vCol, 1.0);',
    '  if (uUseTex > 0.5) { base = texture2D(uTex, vUV); if (base.a < 0.03) discard; }',
    '  vec3 col = base.rgb * uTint;',
    '  if (uGrid > 0.5) {',
    '    vec2 f = fract(vWorld.xz * 0.5);',
    '    float line = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));',
    '    float w = 0.012 + vFog * 0.05;',
    '    float g = 1.0 - smoothstep(w, w * 2.2, line);',
    '    col = mix(col, vec3(0.42, 0.92, 0.85), g * 0.5);',
    '  }',
    '  float lam = 0.52 + 0.48 * max(dot(normalize(vNrm), normalize(vec3(0.35, 1.0, 0.25))), 0.0);',
    '  col *= mix(lam, 1.0, uEmissive);',
    '  col = mix(col, uFogCol, vFog * 0.85);',
    '  gl_FragColor = vec4(col, base.a * uAlpha);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function initGL(cv) {
    canvas = cv;
    gl = cv.getContext('webgl', { antialias: true, alpha: false }) || cv.getContext('experimental-webgl');
    if (!gl) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    ['aPos', 'aNrm', 'aCol', 'aUV'].forEach(function (n) { loc[n] = gl.getAttribLocation(prog, n); });
    ['uProj', 'uView', 'uModel', 'uTex', 'uUseTex', 'uGrid', 'uTint', 'uAlpha', 'uFogCol', 'uEmissive']
      .forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    buildMeshes();
    return true;
  }

  /* ======================================================================
     Geometri
     ====================================================================== */

  function Builder() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; }

  Builder.prototype.box = function (cx, cy, cz, w, h, d, col, colTop) {
    var x = w / 2, y = h / 2, z = d / 2, s = this.p.length / 3, self = this;
    var faces = [
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
      [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
      [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]]
    ];
    faces.forEach(function (f, fi) {
      var nrm = f[4];
      var color = (fi === 2 && colTop) ? colTop : col;
      for (var v = 0; v < 4; v++) {
        self.p.push(f[v][0] + cx, f[v][1] + cy, f[v][2] + cz);
        self.n.push(nrm[0], nrm[1], nrm[2]);
        self.c.push(color[0], color[1], color[2]);
      }
      self.u.push(0, 0, 1, 0, 1, 1, 0, 1);
      var b = s + fi * 4;
      self.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return this;
  };

  Builder.prototype.quad = function (w, h, col) {
    var x = w / 2, y = h / 2, s = this.p.length / 3;
    this.p.push(-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0);
    for (var k = 0; k < 4; k++) { this.n.push(0, 0, 1); this.c.push(col[0], col[1], col[2]); }
    this.u.push(0, 1, 1, 1, 1, 0, 0, 0);
    this.i.push(s, s + 1, s + 2, s, s + 2, s + 3);
    return this;
  };

  Builder.prototype.sphere = function (r, seg, ring, col) {
    var s = this.p.length / 3;
    for (var y = 0; y <= ring; y++) {
      var v = y / ring, phi = v * Math.PI;
      for (var x = 0; x <= seg; x++) {
        var u = x / seg, theta = u * Math.PI * 2;
        var nx = Math.sin(phi) * Math.cos(theta), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(theta);
        this.p.push(nx * r, ny * r, nz * r);
        this.n.push(nx, ny, nz);
        this.c.push(col[0], col[1], col[2]);
        this.u.push(u, v);
      }
    }
    for (var yy = 0; yy < ring; yy++) {
      for (var xx = 0; xx < seg; xx++) {
        var a = s + yy * (seg + 1) + xx, b = a + seg + 1;
        this.i.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return this;
  };

  Builder.prototype.upload = function () {
    var mesh = {
      pos: buf(new Float32Array(this.p)),
      nrm: buf(new Float32Array(this.n)),
      col: buf(new Float32Array(this.c)),
      uv: buf(new Float32Array(this.u)),
      idx: ibuf(new Uint16Array(this.i)),
      count: this.i.length
    };
    return mesh;
  };

  function buf(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }

  function ibuf(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }

  var PILLARS = [];

  function buildMeshes() {
    // Golv
    var f = new Builder();
    f.p.push(-R, 0, -R, R, 0, -R, R, 0, R, -R, 0, R);
    for (var k = 0; k < 4; k++) { f.n.push(0, 1, 0); f.c.push(0.06, 0.09, 0.20); }
    f.u.push(0, 0, 1, 0, 1, 1, 0, 1);
    f.i.push(0, 1, 2, 0, 2, 3);
    meshes.floor = f.upload();

    // Väggar runt arenan
    var w = new Builder();
    var t = 0.7, h = 3.4;
    w.box(0, h / 2, -R - t / 2, R * 2 + t * 2, h, t, [0.16, 0.13, 0.34], [0.42, 0.30, 0.86]);
    w.box(0, h / 2, R + t / 2, R * 2 + t * 2, h, t, [0.16, 0.13, 0.34], [0.42, 0.30, 0.86]);
    w.box(-R - t / 2, h / 2, 0, t, h, R * 2 + t * 2, [0.14, 0.12, 0.31], [0.42, 0.30, 0.86]);
    w.box(R + t / 2, h / 2, 0, t, h, R * 2 + t * 2, [0.14, 0.12, 0.31], [0.42, 0.30, 0.86]);
    meshes.walls = w.upload();

    // Neonlist längs väggarnas nederkant — ger arenan konturer
    var tr = new Builder();
    var neon = [0.36, 0.92, 0.86];
    tr.box(0, 0.10, -R + 0.05, R * 2, 0.2, 0.12, neon, neon);
    tr.box(0, 0.10, R - 0.05, R * 2, 0.2, 0.12, neon, neon);
    tr.box(-R + 0.05, 0.10, 0, 0.12, 0.2, R * 2, neon, neon);
    tr.box(R - 0.05, 0.10, 0, 0.12, 0.2, R * 2, neon, neon);
    meshes.trim = tr.upload();

    // Pelare
    PILLARS = [
      { x: -6.5, z: -6.5, w: 2.2, d: 2.2, h: 3.0 },
      { x: 6.5, z: -6.5, w: 2.2, d: 2.2, h: 3.0 },
      { x: -6.5, z: 6.5, w: 2.2, d: 2.2, h: 3.0 },
      { x: 6.5, z: 6.5, w: 2.2, d: 2.2, h: 3.0 },
      { x: 0, z: 0, w: 3.0, d: 3.0, h: 2.2 },
      { x: 0, z: -10, w: 4.0, d: 1.0, h: 1.5 },
      { x: 0, z: 10, w: 4.0, d: 1.0, h: 1.5 },
      { x: -10, z: 0, w: 1.0, d: 4.0, h: 1.5 },
      { x: 10, z: 0, w: 1.0, d: 4.0, h: 1.5 }
    ];
    var p = new Builder();
    PILLARS.forEach(function (b) {
      p.box(b.x, b.h / 2, b.z, b.w, b.h, b.d, [0.13, 0.16, 0.38], [0.00, 0.78, 0.70]);
    });
    meshes.pillars = p.upload();

    // Spelarkropp (två lådor) och bomb
    var body = new Builder();
    body.box(0, 0.55, 0, 0.72, 1.10, 0.52, [1, 1, 1], [1, 1, 1]);
    body.box(0, 1.34, 0, 0.52, 0.48, 0.48, [1, 1, 1], [1, 1, 1]);
    meshes.body = body.upload();

    meshes.bomb = new Builder().sphere(0.30, 14, 10, [0.10, 0.10, 0.14]).upload();
    meshes.glow = new Builder().sphere(1.0, 12, 8, [1, 0.35, 0.35]).upload();
    meshes.quad = new Builder().quad(1, 1, [1, 1, 1]).upload();

    // Sotfläck efter en explosion
    var sc = new Builder();
    sc.p.push(-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1);
    for (var q = 0; q < 4; q++) { sc.n.push(0, 1, 0); sc.c.push(0.02, 0.02, 0.03); }
    sc.u.push(0, 0, 1, 0, 1, 1, 0, 1);
    sc.i.push(0, 1, 2, 0, 2, 3);
    meshes.scorch = sc.upload();
  }

  /* ---------- Texturer ------------------------------------------------- */

  function texFromCanvas(cv) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function avatarTexture(emoji, name, color) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var c = cv.getContext('2d');
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = color;
    c.beginPath();
    c.arc(64, 58, 40, 0, Math.PI * 2);
    c.fill();
    c.font = '54px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(emoji, 64, 58);
    c.font = 'bold 20px sans-serif';
    c.fillStyle = '#ffffff';
    c.fillText(name.slice(0, 9), 64, 112);
    return texFromCanvas(cv);
  }

  function sparkTexture() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,199,58,0.95)');
    g.addColorStop(1, 'rgba(255,77,109,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return texFromCanvas(cv);
  }

  /* ======================================================================
     Ritning
     ====================================================================== */

  function bindMesh(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm); gl.enableVertexAttribArray(loc.aNrm); gl.vertexAttribPointer(loc.aNrm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.col); gl.enableVertexAttribArray(loc.aCol); gl.vertexAttribPointer(loc.aCol, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.enableVertexAttribArray(loc.aUV); gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
  }

  function draw(mesh, model, opts) {
    opts = opts || {};
    gl.uniformMatrix4fv(loc.uModel, false, model);
    gl.uniform1f(loc.uUseTex, opts.tex ? 1 : 0);
    gl.uniform1f(loc.uGrid, opts.grid ? 1 : 0);
    gl.uniform1f(loc.uAlpha, opts.alpha === undefined ? 1 : opts.alpha);
    gl.uniform1f(loc.uEmissive, opts.emissive || 0);
    var t = opts.tint || [1, 1, 1];
    gl.uniform3f(loc.uTint, t[0], t[1], t[2]);
    if (opts.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, opts.tex);
      gl.uniform1i(loc.uTex, 0);
    }
    bindMesh(mesh);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  /* ======================================================================
     Spelvärld
     ====================================================================== */

  var S = null;   // rundans tillstånd
  A.state = function () { return S; };
  A.pillars = function () { return PILLARS; };

  var COLORS = ['#7c5cff', '#00e5c8', '#ffc73a', '#ff4d6d', '#3ddc84', '#f472b6'];

  function inPillar(x, z, pad) {
    for (var i = 0; i < PILLARS.length; i++) {
      var b = PILLARS[i];
      if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b;
    }
    return null;
  }

  function freeSpot(pad) {
    for (var tries = 0; tries < 200; tries++) {
      var x = (Math.random() * 2 - 1) * (R - 1.4);
      var z = (Math.random() * 2 - 1) * (R - 1.4);
      if (!inPillar(x, z, pad)) return { x: x, z: z };
    }
    return { x: 0, z: R - 2 };
  }

  function collide(p, nx, nz) {
    var lim = R - PR - 0.35;
    nx = Math.max(-lim, Math.min(lim, nx));
    nz = Math.max(-lim, Math.min(lim, nz));
    if (!inPillar(nx, p.z, PR)) p.x = nx;
    if (!inPillar(p.x, nz, PR)) p.z = nz;
  }

  A.start = function (cfg) {
    cfg = cfg || {};
    var diff = cfg.diff || 2;
    var bots = cfg.bots === undefined ? 3 : cfg.bots;

    S = {
      cfg: { diff: diff, bots: bots, cat: cfg.cat || 'mix' },
      players: [], mines: [], scorches: [], particles: [],
      bomb: null, phase: 'roam', q: null, qShownAt: 0, round: 0,
      feed: [], startedAt: Date.now(), over: false,
      shake: 0, flash: 0, ticked: 0,
      m: { correct: 0, wrong: 0, streak: 0, best: 0, throws: 0, mines: 0, booms: 0, kos: 0, walked: 0 }
    };

    var spot = spawnSpot(0);
    S.players.push({
      id: 'you', name: M.profile.name, av: M.profile.avatar, you: true,
      x: spot.x, z: spot.z, yaw: Math.atan2(-spot.x, spot.z), pitch: 0,
      lives: LIVES, alive: true, skill: 1, color: COLORS[0], tex: null
    });

    var avs = M.shuffle(M.AVATARS.filter(function (a) { return a !== M.profile.avatar; }));
    var names = M.shuffle(M.BOT_NAMES.slice());
    for (var i = 0; i < bots; i++) {
      var sp = spawnSpot(i + 1, bots + 1);
      S.players.push({
        id: 'b' + i, name: names[i], av: avs[i % avs.length], you: false,
        x: sp.x, z: sp.z, yaw: Math.random() * 6.28, pitch: 0,
        lives: LIVES, alive: true, skill: 0.5 + Math.random() * 0.45,
        color: COLORS[(i + 1) % COLORS.length], tex: null,
        wx: 0, wz: 0, thinkAt: 0
      });
    }
    S.players.forEach(function (p) {
      p.tex = avatarTexture(p.av, p.you ? 'Du' : p.name, p.color);
      newWaypoint(p);
    });

    placeMines();
    say('🕳️ ' + S.mines.length + ' osynliga bomber ligger i arenan. Gå försiktigt.');
    M.bump('arena3dGames');
    M.save();
  };

  /* Startpositioner på en ring runt mitten, med fritt utrymme runt sig. */
  function spawnSpot(index, total) {
    var ang = (index / (total || 6)) * Math.PI * 2 + Math.random() * 0.4;
    var rad = R - 3.2;
    for (var k = 0; k < 12; k++) {
      var x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      if (!inPillar(x, z, 1.2)) return { x: x, z: z };
      ang += 0.35;
    }
    return freeSpot(1.0);
  }

  function placeMines() {
    S.mines = [];
    var n = 8 + S.cfg.diff * 3;
    for (var i = 0; i < n; i++) {
      var s = freeSpot(1.0);
      S.mines.push({ x: s.x, z: s.z });
    }
  }

  function newWaypoint(p) {
    var s = freeSpot(0.9);
    p.wx = s.x; p.wz = s.z;
  }

  function say(txt) {
    S.feed.unshift(txt);
    if (S.feed.length > 20) S.feed.pop();
    if (A.onFeed) A.onFeed();
  }

  function alive() { return S.players.filter(function (p) { return p.alive; }); }
  function you() { return S.players[0]; }
  A.you = you;

  /* ---------- Bomben ---------------------------------------------------- */

  var LIVES = 2;

  function bombTime() {
    var base = M.DIFFS[S.cfg.diff - 1].time * 0.62;
    return Math.max(5, base - S.round * 0.8);
  }

  function triggerMine(p, mi) {
    S.mines.splice(mi, 1);
    S.bomb = { holder: p, t: bombTime(), max: bombTime(), fly: null, thrower: null };
    if (p.you) {
      S.m.mines++;
      M.bump('minesStepped');
      M.ui.buzz([60, 40, 60]);
      M.ui.sfx.boom();
      say('💥 Du trampade på en osynlig bomb!');
      askQuestion();
    } else {
      say('💣 ' + p.name + ' trampade på en bomb.');
      M.ui.sfx.throwIt();
      botThink();
    }
    if (A.onPhase) A.onPhase();
  }

  function askQuestion() {
    S.q = M.question(S.cfg.cat, S.cfg.diff);
    S.qShownAt = Date.now();
    S.phase = 'answer';
    if (A.onQuestion) A.onQuestion();
  }

  function botThink() {
    var b = S.bomb.holder;
    S.bomb.thinkAt = Date.now() + (1300 + (1 - b.skill) * 2400) * (0.7 + Math.random() * 0.6);
  }

  A.answer = function (idx) {
    if (S.phase !== 'answer' || !S.q) return;
    var right = idx === S.q.correct;
    var ms = Date.now() - S.qShownAt;

    M.bump('answers');
    if (right) {
      S.m.correct++;
      S.m.streak++;
      S.m.best = Math.max(S.m.best, S.m.streak);
      M.bump('correct');
      M.bump('cat_' + S.q.cat);
      M.setMax('bestStreak', S.m.streak);
      if (S.q.answer === 42) M.bump('answer42');
      if (ms < 3000) M.bump('fastAnswers3');
      if (ms < 1500) M.bump('fastAnswers15');
      M.ui.sfx.right();
      M.ui.buzz(20);
      S.phase = 'throw';
      say('✅ Rätt! Sikta på någon och kasta.');
    } else {
      S.m.wrong++;
      S.m.streak = 0;
      M.bump('wrong');
      M.ui.sfx.wrong();
      M.ui.buzz([40, 60, 40]);
      S.bomb.t = Math.max(0.4, S.bomb.t - 2);
      say('❌ Fel — två sekunder brann upp.');
      setTimeout(function () { if (S && S.phase === 'answer') askQuestion(); }, 500);
      if (A.onQuestion) A.onQuestion();
      return;
    }
    if (A.onPhase) A.onPhase();
  };

  /* Kasta bomben: mot ett id, eller mot den man siktar på. */
  A.throwAt = function (id) {
    if (S.phase !== 'throw' || !S.bomb) return;
    var target = null;
    if (id) {
      S.players.forEach(function (p) { if (p.id === id && p.alive) target = p; });
    } else {
      target = aimTarget() || nearestOther(you());
    }
    if (!target) return;
    doThrow(S.bomb.holder, target);
    S.m.throws++;
    M.bump('throws');
    if (S.bomb && S.bomb.t < 1) M.bump('clutchThrows');
  };

  function doThrow(from, to) {
    var b = S.bomb;
    b.thrower = from;
    b.fly = { fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z, t: 0, dur: 0.45, target: to };
    S.phase = 'fly';
    S.q = null;
    M.ui.sfx.throwIt();
    say('🤾 ' + (from.you ? 'Du' : from.name) + ' → ' + (to.you ? 'dig' : to.name));
    if (A.onPhase) A.onPhase();
  }

  function landBomb() {
    var b = S.bomb;
    var to = b.fly.target;
    b.holder = to;
    b.fly = null;
    if (to.you) {
      say('💣 Du fick bomben!');
      M.ui.buzz([50, 30, 50]);
      askQuestion();
    } else {
      S.phase = 'roam';
      botThink();
    }
    if (A.onPhase) A.onPhase();
  }

  function aimTarget() {
    var me = you(), best = null, bestDot = 0.86;
    S.players.forEach(function (p) {
      if (p === me || !p.alive) return;
      var dx = p.x - me.x, dz = p.z - me.z;
      var d = Math.sqrt(dx * dx + dz * dz) || 1;
      var fx = Math.sin(me.yaw), fz = -Math.cos(me.yaw);
      var dot = (dx / d) * fx + (dz / d) * fz;
      if (dot > bestDot) { bestDot = dot; best = p; }
    });
    return best;
  }
  A.aimTarget = aimTarget;

  function nearestOther(me) {
    var best = null, bd = 1e9;
    S.players.forEach(function (p) {
      if (p === me || !p.alive) return;
      var d = (p.x - me.x) * (p.x - me.x) + (p.z - me.z) * (p.z - me.z);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  function explode() {
    var b = S.bomb, h = b.holder;
    S.scorches.push({ x: h.x, z: h.z, t: 0 });
    for (var i = 0; i < 22; i++) {
      S.particles.push({
        x: h.x, y: 0.6 + Math.random(), z: h.z,
        vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 6,
        life: 0.9 + Math.random() * 0.5, max: 1.4, size: 0.5 + Math.random()
      });
    }
    M.ui.sfx.boom();
    S.flash = 1;
    if (h.you) {
      S.shake = 1;
      S.m.booms++;
      M.bump('booms');
      M.ui.buzz([90, 60, 120]);
    }
    if (b.thrower && b.thrower.you && !h.you && h.lives === 1) { S.m.kos++; M.bump('knockouts'); }

    h.lives--;
    say('💥 BOOM! ' + (h.you ? 'Du' : h.name) + ' sprängdes.');
    if (h.lives <= 0) {
      h.alive = false;
      say('☠️ ' + (h.you ? 'Du är utslagen' : h.name + ' är ute'));
      if (h.you) M.ui.sfx.lose();
    }

    S.bomb = null;
    S.q = null;
    S.phase = 'roam';
    S.round++;

    if (alive().length <= 1) return endRound();
    if (!you().alive) {
      say('📺 Du är ute — rundan är slut för din del.');
      setTimeout(function () { if (S && !S.over) endRound(); }, 1400);
      return;
    }
    if (S.mines.length < 6) placeMines();
    if (A.onPhase) A.onPhase();
  }

  /* ---------- Rundans slut ---------------------------------------------- */

  function endRound() {
    if (S.over) return;
    S.over = true;
    S.phase = 'over';
    var live = alive();
    var win = live.length === 1 && live[0].you;
    var wasLocked = !M.arcadeUnlocked();
    var secs = Math.round((Date.now() - S.startedAt) / 1000);
    M.bump('secondsPlayed', secs);

    var coins = 12 + S.m.correct * 2 + S.cfg.diff * 5;
    var xp = 20 + S.m.correct * 3;

    if (win) {
      M.bump('arena3dWins');
      M.bump('wins');
      M.profile.stats.winStreak++;
      M.setMax('bestWinStreak', M.profile.stats.winStreak);
      if (S.m.mines === 0) M.bump('noMineWins');
      if (you().lives === LIVES) M.bump('arenaFlawless');
      coins += 40 + S.cfg.diff * 10;
      xp += 70;
    } else {
      M.profile.stats.winStreak = 0;
    }
    M.bump('gamesPlayed');
    M.setMax('arenaBestStreak', S.m.best);
    M.bump('walkedMeters', Math.round(S.m.walked));

    M.addCoins(coins, true);
    var lv = M.addXp(xp);
    M.pushHistory({ mode: 'arena', win: win, result: (win ? 'Sist kvar' : 'Utslagen') + ' · ' + S.m.correct + ' rätt' });
    M.save();

    var fresh = M.checkAchievements();
    var justUnlocked = wasLocked && M.arcadeUnlocked();

    if (A.onOver) A.onOver({ win: win, coins: coins, xp: xp, levels: lv.levels, fresh: fresh, unlocked: justUnlocked, secs: secs });
  }

  A.quit = function () {
    if (S && !S.over) {
      M.bump('secondsPlayed', Math.round((Date.now() - S.startedAt) / 1000));
      M.save();
    }
    S = null;
    stopLoop();
  };

  /* ======================================================================
     Uppdatering
     ====================================================================== */

  var input = { fx: 0, fz: 0, look: 0, lookY: 0 };
  A.input = input;

  function update(dt) {
    if (!S || S.over) return;
    var me = you();

    // Din rörelse
    if (me.alive) {
      me.yaw += input.look * dt * 2.6;
      me.pitch = Math.max(-0.55, Math.min(0.55, me.pitch + input.lookY * dt * 2.0));
      input.look *= 0.82;
      input.lookY *= 0.82;

      var frozen = S.phase === 'answer';
      if (!frozen) {
        var fwd = input.fz, str = input.fx;
        var len = Math.sqrt(fwd * fwd + str * str);
        if (len > 1) { fwd /= len; str /= len; }
        var sinY = Math.sin(me.yaw), cosY = Math.cos(me.yaw);
        var dx = (sinY * -fwd + cosY * str) * SPEED * dt;
        var dz = (-cosY * -fwd + sinY * str) * SPEED * dt;
        if (dx || dz) {
          collide(me, me.x + dx, me.z + dz);
          S.m.walked += Math.sqrt(dx * dx + dz * dz);
        }
      }
    }

    // Botarna
    S.players.forEach(function (p) {
      if (p.you || !p.alive) return;
      var tx = p.wx, tz = p.wz;
      var holder = S.bomb && S.bomb.holder;
      if (holder && holder !== p && holder.alive) {
        // fly från den som håller i bomben
        var away = Math.atan2(p.x - holder.x, -(p.z - holder.z));
        tx = p.x + Math.sin(away) * 6;
        tz = p.z - Math.cos(away) * 6;
      }
      var dx = tx - p.x, dz = tz - p.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.6 && !holder) newWaypoint(p);
      if (d > 0.001) {
        var step = BOT_SPEED * dt * (holder === p ? 0.6 : 1);
        var nx = p.x + dx / d * step, nz = p.z + dz / d * step;
        var before = p.x + '|' + p.z;
        collide(p, nx, nz);
        if (before === p.x + '|' + p.z) newWaypoint(p);
        p.yaw = Math.atan2(dx, -dz);
      }
    });

    // Minor — bara när ingen har bomben
    if (!S.bomb) {
      for (var i = S.mines.length - 1; i >= 0; i--) {
        var mn = S.mines[i];
        for (var j = 0; j < S.players.length; j++) {
          var p = S.players[j];
          if (!p.alive) continue;
          var dd = (p.x - mn.x) * (p.x - mn.x) + (p.z - mn.z) * (p.z - mn.z);
          if (dd < MINE_R * MINE_R) { triggerMine(p, i); break; }
        }
        if (S.bomb) break;
      }
    }

    // Bomben
    if (S.bomb) {
      var b = S.bomb;
      if (b.fly) {
        b.fly.t += dt;
        b.fly.toX = b.fly.target.x;
        b.fly.toZ = b.fly.target.z;
        if (b.fly.t >= b.fly.dur) landBomb();
      } else {
        b.t -= dt;
        if (b.t <= 3 && Math.floor(b.t * 2) !== S.ticked) { S.ticked = Math.floor(b.t * 2); M.ui.sfx.tick(); }
        if (b.t <= 0) { explode(); return; }
        if (!b.holder.you && S.phase === 'roam' && b.thinkAt && Date.now() >= b.thinkAt) {
          var ok = Math.random() < (b.holder.skill - (S.cfg.diff - 2) * 0.06);
          if (ok) {
            var t2 = nearestOther(b.holder);
            if (t2) doThrow(b.holder, t2);
          } else {
            b.t = Math.max(0.4, b.t - 2);
            say('❌ ' + b.holder.name + ' svarade fel (−2 s)');
            botThink();
          }
        }
      }
    }

    // Effekter
    S.particles.forEach(function (q) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vy -= 9 * dt;
    });
    S.particles = S.particles.filter(function (q) { return q.life > 0; });
    S.scorches.forEach(function (s) { s.t += dt; });
    if (S.scorches.length > 12) S.scorches.shift();
    S.shake = Math.max(0, S.shake - dt * 2);
    S.flash = Math.max(0, S.flash - dt * 2.5);
  }

  /* ---------- Närmaste mina (för minsökaren) ---------------------------- */

  A.mineProximity = function () {
    if (!S || S.bomb) return 0;
    var me = you(), best = 1e9;
    S.mines.forEach(function (m) {
      var d = Math.sqrt((me.x - m.x) * (me.x - m.x) + (me.z - m.z) * (me.z - m.z));
      if (d < best) best = d;
    });
    var range = 2.2 + (4 - S.cfg.diff) * 0.5;
    return best > range ? 0 : 1 - best / range;
  };

  /* ======================================================================
     Rendering
     ====================================================================== */

  function render() {
    if (!S || !gl) return;
    var me = you();
    var w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.03, 0.04, 0.10, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var shake = S.shake * 0.09;
    var proj = perspective(1.15, w / h, 0.1, 90);
    var camY = EYE + (Math.random() - 0.5) * shake;
    var view = multiply(
      multiply(rotationX(-me.pitch), rotationY(-me.yaw)),
      translation(-me.x, -camY, -me.z)
    );

    gl.uniformMatrix4fv(loc.uProj, false, proj);
    gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniform3f(loc.uFogCol, 0.04, 0.05, 0.13);

    draw(meshes.floor, mat4(), { grid: true });
    draw(meshes.walls, mat4(), {});
    draw(meshes.trim, mat4(), { emissive: 1 });
    draw(meshes.pillars, mat4(), {});

    S.scorches.forEach(function (s) {
      draw(meshes.scorch, multiply(translation(s.x, 0.02, s.z), scaling(1.5, 1, 1.5)), { alpha: 0.75, emissive: 1 });
    });

    // Spelare
    S.players.forEach(function (p) {
      if (!p.alive || p.you) return;
      var isHolder = S.bomb && S.bomb.holder === p && !S.bomb.fly;
      var c = hexToRgb(p.color);
      var model = multiply(translation(p.x, 0, p.z), rotationY(p.yaw));
      draw(meshes.body, model, { tint: isHolder ? [1.4, 0.5, 0.5] : c, emissive: isHolder ? 0.5 : 0 });

      // namnskylt som alltid vänder sig mot kameran
      var bill = multiply(multiply(translation(p.x, 2.35, p.z), rotationY(me.yaw)), scaling(1.1, 1.1, 1.1));
      draw(meshes.quad, bill, { tex: p.tex, emissive: 1, alpha: 1 });
    });

    // Bomben
    if (S.bomb) {
      var bx, bz, by, scale = 1, glow = 0.55;
      var pulse = 1 + Math.sin(Date.now() / 90) * 0.12;
      if (S.bomb.fly) {
        var f = S.bomb.fly, k = Math.min(1, f.t / f.dur);
        bx = f.fromX + (f.toX - f.fromX) * k;
        bz = f.fromZ + (f.toZ - f.fromZ) * k;
        by = 1.4 + Math.sin(k * Math.PI) * 2.4;
      } else if (S.bomb.holder.you) {
        // Håller du bomben själv hålls den framför kameran, annars hamnar den i ögat
        var fx = Math.sin(me.yaw), fz = -Math.cos(me.yaw);
        var rx = Math.cos(me.yaw), rz = Math.sin(me.yaw);
        bx = me.x + fx * 0.85 + rx * 0.34;
        bz = me.z + fz * 0.85 + rz * 0.34;
        by = EYE - 0.34 + Math.sin(Date.now() / 260) * 0.03;
        scale = 0.8;
        glow = 0;
      } else {
        var hd = S.bomb.holder;
        bx = hd.x; bz = hd.z; by = 2.05 + Math.sin(Date.now() / 200) * 0.08;
      }
      var sc = pulse * scale;
      draw(meshes.bomb, multiply(translation(bx, by, bz), scaling(sc, sc, sc)), { emissive: 0.35 });
      if (glow) {
        draw(meshes.glow, multiply(translation(bx, by, bz), scaling(glow * pulse, glow * pulse, glow * pulse)),
          { alpha: 0.28, emissive: 1, tint: [1, 0.3, 0.35] });
      }
    }

    // Partiklar
    if (S.particles.length) {
      S.particles.forEach(function (q) {
        var s = q.size * (q.life / q.max) * 2.2;
        var mdl = multiply(multiply(translation(q.x, q.y, q.z), rotationY(me.yaw)), scaling(s, s, s));
        draw(meshes.quad, mdl, { tex: textures.spark, alpha: Math.max(0, q.life / q.max), emissive: 1 });
      });
    }
  }

  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    ];
  }

  /* ======================================================================
     Loop
     ====================================================================== */

  A.init = function (cv) {
    if (gl) return true;
    try {
      if (!initGL(cv)) return false;
      textures.spark = sparkTexture();
      return true;
    } catch (e) {
      return false;
    }
  };

  A.resize = function () {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  };

  A.loop = function () {
    stopLoop();
    lastT = performance.now();
    var step = function (t) {
      raf = requestAnimationFrame(step);
      var dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      update(dt);
      render();
      if (A.onFrame) A.onFrame(dt);
    };
    raf = requestAnimationFrame(step);
  };

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  A.stop = stopLoop;

})(window.MATTENITE = window.MATTENITE || {});
