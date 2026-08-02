/* gmfy — tiny software 3D renderer (canvas 2D, painter's algorithm). No deps. */
(function (global) {
  'use strict';

  /* ---- deterministic RNG so a prompt always rebuilds the same world ---- */
  function hash(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---- worlds: bright, friendly daylight palettes ---- */
  var BIOMES = {
    meadow: { name:'meadow',  sky:['#63b8f0','#d8f0ff'], ground:'#5cb84a',
              grid:'#eafbe4', fog:'#dff1ff',
              props:['tree','tree','rock','block'], palette:['#4ea63f','#8fd14f','#f6d365','#e86f6f'],
              relief:0.9, density:1.1 },
    forest: { name:'forest',  sky:['#79c6ea','#dff2f7'], ground:'#3f9e52',
              grid:'#e6fbe9', fog:'#ddf1f6',
              props:['tree','tree','tree','rock'], palette:['#2f8f45','#63c76a','#a7e07a','#c78b52'],
              relief:1.25, density:1.4 },
    beach:  { name:'beach',   sky:['#6fd0f0','#e6f8ff'], ground:'#efdcae',
              grid:'#fff6dd', fog:'#e6f8ff',
              props:['tree','rock','block'], palette:['#f2c66d','#7fd6c9','#e9a86b','#fff0c4'],
              relief:0.6, density:0.85 },
    hills:  { name:'hills',   sky:['#5cb3ee','#dcefff'], ground:'#6cbf5a',
              grid:'#eafbe4', fog:'#dcefff',
              props:['tree','rock','rock','dome'], palette:['#57ad46','#9ad463','#d6a55f','#f0f4e0'],
              relief:1.9, density:1.0 },
    snow:   { name:'snow',    sky:['#9fd4f2','#f2fbff'], ground:'#e8f2f7',
              grid:'#ffffff', fog:'#f2fbff',
              props:['tree','spike','rock'], palette:['#cfe7f5','#9ec9e2','#7fb3d5','#ffffff'],
              relief:1.3, density:0.95 },
    sunset: { name:'sunset',  sky:['#f2a25c','#ffe9c9'], ground:'#7ba85c',
              grid:'#fff3dc', fog:'#ffe4c2',
              props:['tree','rock','block'], palette:['#e2894f','#f4c06b','#8fbf68','#c96f5a'],
              relief:1.1, density:1.0 }
  };
  var DEFAULT_BIOME = 'meadow';


  /* ---- world generation ---- */
  var N = 15, SPAN = 34;
  // scenery + game pieces. shape drives how it renders, role drives gameplay.
  var KIND = {
    tree:      { shape:'cone',  role:'solid',      col:'#2f8f45', label:'Tree' },
    rock:      { shape:'box',   role:'solid',      col:'#9b9285', label:'Rock' },
    block:     { shape:'box',   role:'solid',      col:'#c8894f', label:'Block' },
    tower:     { shape:'box',   role:'solid',      col:'#8d8f9c', label:'Tower' },
    dome:      { shape:'dome',  role:'solid',      col:'#e6e2d3', label:'Dome' },
    spike:     { shape:'cone',  role:'hazard',     col:'#b9c4cc', label:'Spike' },
    cactus:    { shape:'cone',  role:'solid',      col:'#4f9d5b', label:'Cactus' },
    coin:      { shape:'disc',  role:'coin',       col:'#f5c542', label:'Coin' },
    star:      { shape:'disc',  role:'star',       col:'#ffd94a', label:'Star' },
    key:       { shape:'disc',  role:'key',        col:'#c9a227', label:'Key' },
    finish:    { shape:'flag',  role:'finish',     col:'#3ddc84', label:'Finish' },
    checkpoint:{ shape:'flag',  role:'checkpoint', col:'#4c97ff', label:'Checkpoint' },
    lava:      { shape:'patch', role:'lava',       col:'#f2560f', label:'Lava' },
    water:     { shape:'patch', role:'water',      col:'#3aa6e0', label:'Water' },
    spring:    { shape:'coil',  role:'spring',     col:'#ff7ac6', label:'Spring' },
    enemy:     { shape:'box',   role:'enemy',      col:'#e2453c', label:'Enemy' },
    door:      { shape:'box',   role:'door',       col:'#a06a3f', label:'Door' }
  };
  var PROP_KINDS = Object.keys(KIND);
  var SCENERY = ['tree','rock','block','tower','dome','cactus'];

  function buildWorld(prompt, opts) {
    var seed = hash(prompt || 'gmfy');
    var rand = rng(seed);
    var key = opts && BIOMES[opts.biome] ? opts.biome : DEFAULT_BIOME;
    var b = BIOMES[key];

    var a1 = rand() * 6.28, a2 = rand() * 6.28, a3 = rand() * 6.28;
    var h = [];
    for (var i = 0; i < N; i++) {
      h[i] = [];
      for (var j = 0; j < N; j++) {
        var u = i / (N - 1) - 0.5, v = j / (N - 1) - 0.5;
        h[i][j] = (Math.sin(u * 7 + a1) * 0.9 +
                   Math.cos(v * 6 + a2) * 0.8 +
                   Math.sin((u + v) * 5 + a3) * 0.55) * b.relief;
      }
    }

    var props = [], want = Math.round(20 * b.density), guard = 0;
    while (props.length < want && guard++ < 400) {
      var x = (rand() - 0.5) * SPAN * 0.86;
      var z = (rand() - 0.5) * SPAN * 0.86;
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;      // keep spawn clear
      var kind = b.props[(rand() * b.props.length) | 0];
      if (!KIND[kind]) kind = 'tree';
      props.push({
        kind: kind, x: x, z: z,
        h: 1.2 + rand() * (kind === 'tower' ? 6.5 : kind === 'tree' ? 3 : 1.6),
        w: 0.5 + rand() * (kind === 'tower' ? 1.1 : 0.8),
        col: b.palette[(rand() * b.palette.length) | 0]
      });
    }

    return { seed:seed.toString(16).slice(0, 6), biomeKey:key, biome:b,
             h:h, props:props, prompt:prompt };
  }

  function heightAt(w, x, z) {
    var fi = (x / SPAN + 0.5) * (N - 1), fj = (z / SPAN + 0.5) * (N - 1);
    var i = Math.max(0, Math.min(N - 2, Math.floor(fi)));
    var j = Math.max(0, Math.min(N - 2, Math.floor(fj)));
    var tx = Math.max(0, Math.min(1, fi - i)), tz = Math.max(0, Math.min(1, fj - j));
    var h = w.h;
    return h[i][j] * (1 - tx) * (1 - tz) + h[i + 1][j] * tx * (1 - tz) +
           h[i][j + 1] * (1 - tx) * tz + h[i + 1][j + 1] * tx * tz;
  }

  /* ---- renderer ---- */
  function Engine(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = null;
    // chase > 0 pulls the eye back and up from (x,z): a third-person view of a
    // character that is never drawn. x,z stay the character's ground position,
    // so gameplay, picking and placement keep using them unchanged.
    this.cam = { x: 0, z: -9, yaw: 0, pitch: 0.26, height: 3.4, chase: 0, lift: 0 };
    // runtime effects driven by the block script
    this.fx = { spin: 0, grow: 1, bounce: 0, t: 0 };
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.resize();
  }

  Engine.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.f = this.w * 0.9;
  };

  Engine.prototype.load = function (world) {
    this.world = world;
    this.cam.x = 0; this.cam.z = -9; this.cam.yaw = 0;
    // third-person by default: eye sits behind and above the (invisible) character
    this.cam.chase = 6.5; this.cam.lift = 1.6; this.cam.pitch = 0.34;
  };

  // where the eye actually sits, given the chase offset. x,z of the cam remain
  // the character's ground spot; the eye trails it along -forward.
  Engine.prototype.eye = function () {
    var c = this.cam, chase = c.chase || 0;
    var ex = c.x - Math.sin(c.yaw) * chase;
    var ez = c.z - Math.cos(c.yaw) * chase;
    return { x: ex, z: ez, gy: heightAt(this.world, ex, ez) - (c.height + (c.lift || 0)) };
  };

  // world point -> screen. returns null when behind the camera
  Engine.prototype.project = function (x, y, z) {
    var c = this.cam, e = this.eye();
    var dx = x - e.x, dz = z - e.z;
    var cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    var rx = dx * cy - dz * sy;
    var rz = dx * sy + dz * cy;
    // -y is up in world space, so the eye sits ABOVE the ground at (ground - height)
    var ry = y - e.gy;
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var ry2 = ry * cp - rz * sp;
    var rz2 = ry * sp + rz * cp;
    if (rz2 < 0.35) return null;
    return { x: this.w / 2 + this.f * rx / rz2, y: this.h / 2 + this.f * ry2 / rz2, z: rz2 };
  };

  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)) | 0;
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)) | 0;
    var b = Math.min(255, Math.max(0, (n & 255) * k)) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  Engine.prototype.render = function () {
    var ctx = this.ctx, w = this.world;
    if (!w) return;
    var b = w.biome;

    var g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);

    var faces = [];

    // terrain quads
    for (var i = 0; i < N - 1; i++) {
      for (var j = 0; j < N - 1; j++) {
        var x0 = (i / (N - 1) - 0.5) * SPAN, x1 = ((i + 1) / (N - 1) - 0.5) * SPAN;
        var z0 = (j / (N - 1) - 0.5) * SPAN, z1 = ((j + 1) / (N - 1) - 0.5) * SPAN;
        var p = [
          this.project(x0, w.h[i][j], z0), this.project(x1, w.h[i + 1][j], z0),
          this.project(x1, w.h[i + 1][j + 1], z1), this.project(x0, w.h[i][j + 1], z1)
        ];
        if (!p[0] || !p[1] || !p[2] || !p[3]) continue;
        var d = (p[0].z + p[1].z + p[2].z + p[3].z) / 4;
        var slope = (w.h[i + 1][j] - w.h[i][j]) + (w.h[i][j + 1] - w.h[i][j]);
        faces.push({ d: d, pts: p, fill: shade(b.ground, 1 + slope * 0.16),
                     line: b.grid, alpha: Math.max(0, Math.min(1, 1.5 - d / 40)) });
      }
    }

    // objects
    for (var k = 0; k < w.props.length; k++) {
      var pr = w.props[k];
      if (pr.taken) continue;                       // collected coins vanish
      var kd = KIND[pr.kind] || KIND.block;
      var shape = kd.shape;
      var base = heightAt(w, pr.x, pr.z);
      var bob = this.fx.bounce
        ? Math.abs(Math.sin(this.fx.t * 2.2 + pr.x * 0.35)) * this.fx.bounce : 0;
      var hh = pr.h * this.fx.grow;
      var top = base - hh - bob;
      var s = pr.w * (0.6 + 0.4 * this.fx.grow);
      var col = pr.col || kd.col;
      var m, v, f, pts, dm;

      if (shape === 'patch') {
        // ground-hugging pool; pulses so lava reads as dangerous
        var pulse = 0.86 + 0.14 * Math.sin(this.fx.t * 3 + pr.x);
        var q = [], ok2 = true;
        var corner = [[-1,-1],[1,-1],[1,1],[-1,1]];
        for (m = 0; m < 4; m++) {
          var px = pr.x + corner[m][0] * s * 2.1, pz = pr.z + corner[m][1] * s * 2.1;
          var pp = this.project(px, heightAt(w, px, pz) - 0.06, pz);
          if (!pp) { ok2 = false; break; }
          q.push(pp);
        }
        if (!ok2) continue;
        dm = (q[0].z + q[1].z + q[2].z + q[3].z) / 4;
        faces.push({ d: dm, pts: q, fill: shade(col, pr.kind === 'lava' ? pulse : 0.95),
                     line: shade(col, 1.25),
                     alpha: Math.max(0, Math.min(1, 1.5 - dm / 40)) * (pr.kind === 'water' ? 0.72 : 1) });
        continue;
      }

      if (shape === 'disc') {
        // billboard: always faces the camera, spins by squashing horizontally
        var spin = Math.abs(Math.cos(this.fx.t * 2.4 + pr.x));
        var cy2 = base - hh * 0.55 - bob;
        var c0 = this.project(pr.x, cy2, pr.z);
        if (!c0) continue;
        var rr = (this.f * s * 0.55) / c0.z;
        var ring = [];
        var sides = (pr.kind === 'star') ? 10 : 8;
        for (m = 0; m < sides; m++) {
          var ang = m / sides * Math.PI * 2;
          var rad = (pr.kind === 'star' && m % 2) ? rr * 0.45 : rr;
          ring.push({ x: c0.x + Math.cos(ang) * rad * (0.25 + 0.75 * spin),
                      y: c0.y + Math.sin(ang) * rad, z: c0.z });
        }
        faces.push({ d: c0.z, pts: ring, fill: shade(col, 1.0), line: shade(col, 1.4),
                     alpha: Math.max(0, Math.min(1, 1.5 - c0.z / 40)) });
        continue;
      }

      if (shape === 'flag') {
        var poleB = this.project(pr.x, base, pr.z);
        var poleT = this.project(pr.x, top, pr.z);
        if (!poleB || !poleT) continue;
        var wdt = Math.max(2, (this.f * 0.10) / poleB.z);
        faces.push({ d: poleB.z + 0.02,
                     pts: [{x:poleB.x-wdt,y:poleB.y},{x:poleB.x+wdt,y:poleB.y},
                           {x:poleT.x+wdt,y:poleT.y},{x:poleT.x-wdt,y:poleT.y}],
                     fill: '#e9ecf5', line: '#b9c0cc',
                     alpha: Math.max(0, Math.min(1, 1.5 - poleB.z / 40)) });
        var fl = (this.f * s * 1.5) / poleT.z;
        var wave = Math.sin(this.fx.t * 3 + pr.x) * fl * 0.18;
        var active = (pr.kind !== 'checkpoint' || pr.on);
        faces.push({ d: poleT.z,
                     pts: [{x:poleT.x,y:poleT.y},
                           {x:poleT.x+fl,y:poleT.y+fl*0.28+wave},
                           {x:poleT.x,y:poleT.y+fl*0.62}],
                     fill: shade(col, active ? 1.0 : 0.45),
                     line: shade(col, 1.3),
                     alpha: Math.max(0, Math.min(1, 1.5 - poleT.z / 40)) });
        continue;
      }

      if (shape === 'coil') {
        var rings = 4;
        for (m = 0; m < rings; m++) {
          var yy2 = base - (hh * (m + 1) / rings) - bob;
          var cc = this.project(pr.x, yy2, pr.z);
          if (!cc) continue;
          var rr2 = (this.f * s * 0.5) / cc.z;
          var poly = [];
          for (var a2 = 0; a2 < 8; a2++) {
            var an = a2 / 8 * Math.PI * 2;
            poly.push({ x: cc.x + Math.cos(an) * rr2, y: cc.y + Math.sin(an) * rr2 * 0.34 });
          }
          faces.push({ d: cc.z + m * 0.01, pts: poly, fill: shade(col, 0.7 + m * 0.1),
                       line: shade(col, 1.3),
                       alpha: Math.max(0, Math.min(1, 1.5 - cc.z / 40)) });
        }
        continue;
      }

      if (shape === 'cone' || shape === 'dome') {
        var apex = this.project(pr.x, shape === 'dome' ? base - hh * 0.6 : top, pr.z);
        var cs = [this.project(pr.x - s, base, pr.z - s), this.project(pr.x + s, base, pr.z - s),
                  this.project(pr.x + s, base, pr.z + s), this.project(pr.x - s, base, pr.z + s)];
        if (!apex || cs.indexOf(null) !== -1) continue;
        for (var q2 = 0; q2 < 4; q2++) {
          var tri = [cs[q2], cs[(q2 + 1) % 4], apex];
          var dd = (tri[0].z + tri[1].z + apex.z) / 3;
          faces.push({ d: dd, pts: tri, fill: shade(col, 0.55 + q2 * 0.13), line: col,
                       alpha: Math.max(0, Math.min(1, 1.5 - dd / 40)) });
        }
        continue;
      }

      // default: box
      v = [];
      var dxs = [-s, s, s, -s], dzs = [-s, -s, s, s];
      for (m = 0; m < 4; m++) v.push(this.project(pr.x + dxs[m], base, pr.z + dzs[m]));
      for (m = 0; m < 4; m++) v.push(this.project(pr.x + dxs[m], top, pr.z + dzs[m]));
      if (v.indexOf(null) !== -1) continue;
      var sides2 = [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]];
      for (m = 0; m < sides2.length; m++) {
        f = sides2[m]; pts = [v[f[0]], v[f[1]], v[f[2]], v[f[3]]];
        dm = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4;
        faces.push({ d: dm, pts: pts, fill: shade(col, m === 4 ? 0.95 : 0.42 + m * 0.1),
                     line: col, alpha: Math.max(0, Math.min(1, 1.5 - dm / 40)) });
      }
    }

    faces.sort(function (a, c) { return c.d - a.d; });   // far -> near

    for (var n = 0; n < faces.length; n++) {
      var fc = faces[n];
      if (fc.alpha <= 0.02) continue;
      ctx.globalAlpha = fc.alpha;
      ctx.beginPath();
      ctx.moveTo(fc.pts[0].x, fc.pts[0].y);
      for (var t = 1; t < fc.pts.length; t++) ctx.lineTo(fc.pts[t].x, fc.pts[t].y);
      ctx.closePath();
      ctx.fillStyle = fc.fill; ctx.fill();
      ctx.strokeStyle = fc.line; ctx.lineWidth = 1; ctx.globalAlpha = fc.alpha * 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    var fg = ctx.createLinearGradient(0, this.h * 0.30, 0, this.h * 0.62);
    fg.addColorStop(0, b.fog); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, this.w, this.h * 0.62);
  };

  Engine.prototype.move = function (dir, dt) {
    var c = this.cam, sp = 11 * dt;
    var fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    if (dir === 'f') { c.x += fx * sp; c.z += fz * sp; }
    if (dir === 'b') { c.x -= fx * sp; c.z -= fz * sp; }
    if (dir === 'l') { c.x -= fz * sp; c.z += fx * sp; }
    if (dir === 'r') { c.x += fz * sp; c.z -= fx * sp; }
    var lim = SPAN * 0.52;
    c.x = Math.max(-lim, Math.min(lim, c.x));
    c.z = Math.max(-lim, Math.min(lim, c.z));
  };

  /* Screen point -> ground position. Inverts project(), then marches the ray
     until it meets the heightfield and bisects for a clean hit. */
  Engine.prototype.pick = function (sx, sy) {
    var c = this.cam, w = this.world;
    if (!w) return null;
    var a = (sx - this.w / 2) / this.f;
    var b = (sy - this.h / 2) / this.f;
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var cyw = Math.cos(c.yaw), syw = Math.sin(c.yaw);
    var e = this.eye();
    var eyeY = e.gy;

    function at(t) {
      var ry = t * (b * cp + sp);        // undo pitch
      var rz = t * (cp - b * sp);
      var rx = a * t;
      var dx = rx * cyw + rz * syw;      // undo yaw
      var dz = -rx * syw + rz * cyw;
      return { x: e.x + dx, y: eyeY + ry, z: e.z + dz };
    }

    // -y is up, so the ray has hit ground once y >= terrain height
    var prev = null, t, lim = SPAN * 0.5;
    for (t = 0.5; t < 120; t *= 1.05) {
      var p = at(t);
      if (p.y >= heightAt(w, p.x, p.z)) {
        if (prev === null) return null;
        var lo = prev, hi = t;
        for (var k = 0; k < 26; k++) {
          var mid = (lo + hi) / 2, pm = at(mid);
          if (pm.y >= heightAt(w, pm.x, pm.z)) hi = mid; else lo = mid;
        }
        var f = at(hi);
        if (Math.abs(f.x) > lim || Math.abs(f.z) > lim) return null;
        return { x: f.x, z: f.z };
      }
      prev = t;
    }
    return null;
  };

  /* Nearest prop to a ground point, within `radius` world units. */
  Engine.prototype.propAt = function (gx, gz, radius) {
    var w = this.world, best = -1, bd = (radius || 2.2) * (radius || 2.2);
    if (!w) return -1;
    for (var i = 0; i < w.props.length; i++) {
      var dx = w.props[i].x - gx, dz = w.props[i].z - gz;
      var d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    return best;
  };

  /* ---- maker-mode world helpers ---- */
  function emptyWorld(biomeKey, relief) {
    var b = BIOMES[biomeKey] || BIOMES.meadow;
    var rand = rng(hash(biomeKey + ':' + (relief || 1)));
    var a1 = rand() * 6.28, a2 = rand() * 6.28, a3 = rand() * 6.28;
    var h = [];
    for (var i = 0; i < N; i++) {
      h[i] = [];
      for (var j = 0; j < N; j++) {
        var u = i / (N - 1) - 0.5, v = j / (N - 1) - 0.5;
        h[i][j] = (Math.sin(u * 7 + a1) * 0.9 + Math.cos(v * 6 + a2) * 0.8 +
                   Math.sin((u + v) * 5 + a3) * 0.55) * (relief === undefined ? b.relief : relief);
      }
    }
    return { seed: 'maker', biomeKey: biomeKey, biome: b, h: h, props: [],
             prompt: '', source: 'maker' };
  }

  function reskin(world, biomeKey) {
    var b = BIOMES[biomeKey] || BIOMES.meadow;
    world.biomeKey = biomeKey;
    world.biome = b;
    return world;
  }

  function setRelief(world, relief) {
    var cur = world._relief === undefined ? world.biome.relief : world._relief;
    var k = (relief || 0.001) / (cur || 1);
    for (var i = 0; i < N; i++)
      for (var j = 0; j < N; j++) world.h[i][j] *= k;
    world._relief = relief;
    return world;
  }

  /* Build a world from a (possibly partial / untrusted) remote spec.
     Every field is validated; anything missing falls back to the local world. */
  function worldFromSpec(spec, prompt) {
    var base = buildWorld(prompt);
    if (!spec || typeof spec !== 'object') return base;

    if (typeof spec.biome === 'string' && BIOMES[spec.biome]) {
      base.biomeKey = spec.biome;
      base.biome = BIOMES[spec.biome];
    }

    var num = function (v, dflt, lo, hi) {
      v = typeof v === 'number' ? v : parseFloat(v);
      if (!isFinite(v)) return dflt;
      return Math.max(lo, Math.min(hi, v));
    };

    if (Object.prototype.toString.call(spec.props) === '[object Array]') {
      var lim = SPAN * 0.5, out = [];
      var allowed = { tower:1, block:1, tree:1, cactus:1, spike:1, rock:1, dome:1 };
      for (var i = 0; i < spec.props.length && out.length < 120; i++) {
        var p = spec.props[i];
        if (!p || typeof p !== 'object') continue;
        var col = (typeof p.col === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.col))
          ? p.col : base.biome.palette[i % base.biome.palette.length];
        out.push({
          kind: allowed[p.kind] ? p.kind : 'block',
          x: num(p.x, 0, -lim, lim),
          z: num(p.z, 0, -lim, lim),
          h: num(p.h, 2, 0.4, 12),
          w: num(p.w, 0.7, 0.2, 3),
          col: col
        });
      }
      if (out.length) base.props = out;
    }

    if (spec.relief !== undefined) {
      var k2 = num(spec.relief, 1, 0.1, 3) / (base.biome.relief || 1);
      for (var a = 0; a < N; a++)
        for (var b2 = 0; b2 < N; b2++) base.h[a][b2] *= k2;
    }
    return base;
  }

  global.Gmfy = { Engine: Engine, buildWorld: buildWorld,
                  worldFromSpec: worldFromSpec, BIOMES: BIOMES,
                  emptyWorld: emptyWorld, reskin: reskin, setRelief: setRelief,
                  heightAt: heightAt, SPAN: SPAN, PROP_KINDS: PROP_KINDS,
                  KIND: KIND, SCENERY: SCENERY };
})(window);
