/* Scene, arena geometry, car meshes, boost pads, effects */
(function () {
  var CFG = RC.CFG, F = CFG.FIELD, G = CFG.GOAL;
  var T = THREE;

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function floorTexture() {
    var S = 1024;
    return canvasTex(S, S, function (g) {
      var grd = g.createLinearGradient(0, 0, 0, S);
      grd.addColorStop(0, '#101b33');
      grd.addColorStop(0.5, '#0c1426');
      grd.addColorStop(1, '#101b33');
      g.fillStyle = grd; g.fillRect(0, 0, S, S);

      // faint grid
      g.strokeStyle = 'rgba(90,140,220,0.13)'; g.lineWidth = 2;
      for (var i = 0; i <= 32; i++) {
        var p = i * S / 32;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
      }

      // pitch markings (texture maps over the whole field)
      g.strokeStyle = 'rgba(190,225,255,0.5)'; g.lineWidth = 5;
      g.strokeRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94);
      g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
      g.beginPath(); g.arc(S / 2, S / 2, S * 0.13, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(S / 2, S / 2, S * 0.02, 0, Math.PI * 2);
      g.fillStyle = 'rgba(190,225,255,0.5)'; g.fill();

      // goal boxes
      g.strokeStyle = 'rgba(120,200,255,0.45)';
      g.strokeRect(S * 0.30, S * 0.03, S * 0.40, S * 0.10);
      g.strokeRect(S * 0.30, S * 0.87, S * 0.40, S * 0.10);
      // corner arcs
      g.strokeStyle = 'rgba(190,225,255,0.30)';
      var c = S * 0.18;
      g.beginPath(); g.moveTo(S * 0.03, c); g.lineTo(c, S * 0.03); g.stroke();
      g.beginPath(); g.moveTo(S * 0.97, c); g.lineTo(S - c, S * 0.03); g.stroke();
      g.beginPath(); g.moveTo(S * 0.03, S - c); g.lineTo(c, S * 0.97); g.stroke();
      g.beginPath(); g.moveTo(S * 0.97, S - c); g.lineTo(S - c, S * 0.97); g.stroke();
    });
  }

  function wallTexture(tint) {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = 'rgba(10,16,30,0.92)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = tint; g.lineWidth = 3;
      for (var i = 0; i <= 8; i++) {
        var p = i * w / 8;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
      }
    });
  }

  function netTexture(tint) {
    return canvasTex(128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = tint; g.lineWidth = 2;
      for (var i = 0; i <= 8; i++) {
        var p = i * w / 8;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
      }
    });
  }

  RC.buildScene = function (renderer) {
    var scene = new T.Scene();
    scene.background = new T.Color(0x05070f);
    scene.fog = new T.Fog(0x05070f, 120, 340);

    scene.add(new T.HemisphereLight(0x7fb0ff, 0x18203a, 0.85));
    var dir = new T.DirectionalLight(0xffffff, 0.75);
    dir.position.set(40, 90, 30);
    scene.add(dir);
    var back = new T.DirectionalLight(0x88aaff, 0.35);
    back.position.set(-50, 40, -60);
    scene.add(back);

    // ---- floor
    var ft = floorTexture();
    var floor = new T.Mesh(
      new T.PlaneGeometry(F.W, F.L),
      new T.MeshLambertMaterial({ map: ft })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // ---- walls
    var wallMat = new T.MeshLambertMaterial({
      map: wallTexture('rgba(70,120,200,0.35)'),
      transparent: true, opacity: 0.85, side: T.DoubleSide
    });
    wallMat.map.wrapS = wallMat.map.wrapT = T.RepeatWrapping;
    wallMat.map.repeat.set(6, 2);

    function wall(w, h, pos, rotY) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), wallMat);
      m.position.copy(pos); m.rotation.y = rotY;
      scene.add(m); return m;
    }
    var CH = CFG.CHAMFER, ch = CH / Math.SQRT2 * Math.SQRT2; // chamfer edge length
    var chLen = CH * Math.SQRT2;
    // side walls (split by chamfers)
    wall(F.L - 2 * CH, F.H, new T.Vector3(-F.W / 2, F.H / 2, 0), Math.PI / 2);
    wall(F.L - 2 * CH, F.H, new T.Vector3(F.W / 2, F.H / 2, 0), -Math.PI / 2);
    // back walls
    wall(F.W - 2 * CH, F.H, new T.Vector3(0, F.H / 2, -F.L / 2), 0);
    wall(F.W - 2 * CH, F.H, new T.Vector3(0, F.H / 2, F.L / 2), Math.PI);
    // corner chamfers
    var cs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (var i = 0; i < 4; i++) {
      var sx = cs[i][0], sz = cs[i][1];
      var cx = sx * (F.W / 2 - CH / 2), cz = sz * (F.L / 2 - CH / 2);
      var m = new T.Mesh(new T.PlaneGeometry(chLen, F.H), wallMat);
      m.position.set(cx, F.H / 2, cz);
      m.rotation.y = Math.atan2(-sx, -sz) + (sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4);
      m.lookAt(0, F.H / 2, 0);
      scene.add(m);
    }

    // ceiling
    var ceil = new T.Mesh(
      new T.PlaneGeometry(F.W, F.L),
      new T.MeshBasicMaterial({
        map: wallTexture('rgba(60,110,190,0.30)'),
        transparent: true, opacity: 0.35, side: T.DoubleSide
      })
    );
    ceil.material.map.wrapS = ceil.material.map.wrapT = T.RepeatWrapping;
    ceil.material.map.repeat.set(8, 10);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = F.H;
    scene.add(ceil);

    // ---- goals
    function goal(sz, color) {
      var grp = new T.Group();
      var zl = sz * F.L / 2;
      var net = new T.MeshBasicMaterial({
        map: netTexture(color === 0x3aa0ff ? 'rgba(120,200,255,0.75)' : 'rgba(255,150,90,0.75)'),
        transparent: true, side: T.DoubleSide, opacity: 0.85
      });
      net.map.wrapS = net.map.wrapT = T.RepeatWrapping;
      net.map.repeat.set(5, 2);
      var backw = new T.Mesh(new T.PlaneGeometry(G.W, G.H), net);
      backw.position.set(0, G.H / 2, zl + sz * G.D);
      backw.rotation.y = sz > 0 ? Math.PI : 0;
      grp.add(backw);
      var nl = new T.Mesh(new T.PlaneGeometry(G.D, G.H), net);
      nl.position.set(-G.W / 2, G.H / 2, zl + sz * G.D / 2); nl.rotation.y = Math.PI / 2;
      grp.add(nl);
      var nr = nl.clone(); nr.position.x = G.W / 2; grp.add(nr);
      var top = new T.Mesh(new T.PlaneGeometry(G.W, G.D), net);
      top.position.set(0, G.H, zl + sz * G.D / 2); top.rotation.x = Math.PI / 2;
      grp.add(top);

      // glowing frame
      var frameMat = new T.MeshBasicMaterial({ color: color });
      var bar = function (w, h, d, x, y, z) {
        var b = new T.Mesh(new T.BoxGeometry(w, h, d), frameMat);
        b.position.set(x, y, z); grp.add(b);
      };
      bar(G.W + 1.6, 0.8, 0.8, 0, G.H, zl);
      bar(0.8, G.H, 0.8, -G.W / 2, G.H / 2, zl);
      bar(0.8, G.H, 0.8, G.W / 2, G.H / 2, zl);

      var light = new T.PointLight(color, 0.8, 70);
      light.position.set(0, G.H * 0.7, zl - sz * 6);
      grp.add(light);
      return grp;
    }
    scene.add(goal(-1, 0x3aa0ff));   // blue defends -z
    scene.add(goal(1, 0xff7a35));    // orange defends +z

    return scene;
  };

  // ------------------------------------------------------------------ car
  RC.buildCar = function (body, accent) {
    var C = CFG.CAR, g = new T.Group();
    var mBody = new T.MeshLambertMaterial({ color: body });
    var mDark = new T.MeshLambertMaterial({ color: 0x11141d });
    var mGlass = new T.MeshLambertMaterial({ color: 0x0d1830, emissive: 0x0a1a30 });
    var mTrim = new T.MeshBasicMaterial({ color: accent });

    var chassis = new T.Mesh(new T.BoxGeometry(C.W, C.H * 0.62, C.L), mBody);
    chassis.position.y = 0.05;
    g.add(chassis);

    var nose = new T.Mesh(new T.BoxGeometry(C.W * 0.9, C.H * 0.34, C.L * 0.26), mBody);
    nose.position.set(0, -0.16, C.L * 0.42);
    g.add(nose);

    var cabin = new T.Mesh(new T.BoxGeometry(C.W * 0.76, C.H * 0.5, C.L * 0.42), mGlass);
    cabin.position.set(0, C.H * 0.42, -C.L * 0.06);
    g.add(cabin);

    var hood = new T.Mesh(new T.BoxGeometry(C.W * 0.8, C.H * 0.16, C.L * 0.3), mBody);
    hood.position.set(0, C.H * 0.30, C.L * 0.28);
    g.add(hood);

    // spoiler
    var wing = new T.Mesh(new T.BoxGeometry(C.W * 1.0, 0.16, 0.7), mTrim);
    wing.position.set(0, C.H * 0.62, -C.L * 0.44);
    g.add(wing);
    [-1, 1].forEach(function (s) {
      var st = new T.Mesh(new T.BoxGeometry(0.18, C.H * 0.4, 0.4), mDark);
      st.position.set(s * C.W * 0.36, C.H * 0.42, -C.L * 0.44);
      g.add(st);
    });

    // side stripes
    [-1, 1].forEach(function (s) {
      var st = new T.Mesh(new T.BoxGeometry(0.06, 0.18, C.L * 0.62), mTrim);
      st.position.set(s * (C.W / 2 + 0.01), 0.06, 0);
      g.add(st);
    });

    // wheels
    var wg = new T.CylinderGeometry(0.62, 0.62, 0.44, 14);
    wg.rotateZ(Math.PI / 2);
    var rim = new T.CylinderGeometry(0.3, 0.3, 0.46, 8);
    rim.rotateZ(Math.PI / 2);
    var wheels = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (p) {
      var w = new T.Mesh(wg, mDark);
      w.position.set(p[0] * (C.W / 2 - 0.06), -C.H * 0.34, p[1] * C.L * 0.32);
      var r = new T.Mesh(rim, mTrim);
      w.add(r);
      g.add(w); wheels.push(w);
    });
    g.userData.wheels = wheels;

    // boost flames
    var flames = new T.Group();
    [-1, 1].forEach(function (s) {
      var f = new T.Mesh(
        new T.ConeGeometry(0.42, 3.2, 10, 1, true),
        new T.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.9, side: T.DoubleSide })
      );
      f.rotation.x = Math.PI / 2;
      f.position.set(s * C.W * 0.26, -0.05, -C.L * 0.55 - 1.4);
      flames.add(f);
      var core = new T.Mesh(
        new T.ConeGeometry(0.2, 2.0, 8, 1, true),
        new T.MeshBasicMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.95, side: T.DoubleSide })
      );
      core.rotation.x = Math.PI / 2;
      core.position.set(s * C.W * 0.26, -0.05, -C.L * 0.55 - 0.85);
      flames.add(core);
    });
    flames.visible = false;
    g.add(flames);
    g.userData.flames = flames;

    var glow = new T.PointLight(0xff8a20, 0, 26);
    glow.position.set(0, 0, -C.L * 0.6);
    g.add(glow);
    g.userData.glow = glow;

    return g;
  };

  // ------------------------------------------------------------------ ball
  RC.buildBall = function () {
    var g = new T.Group();
    var R = CFG.BALL.R;
    var core = new T.Mesh(
      new T.IcosahedronGeometry(R, 2),
      new T.MeshLambertMaterial({ color: 0xf2f6ff, emissive: 0x1a2436 })
    );
    g.add(core);
    var wire = new T.Mesh(
      new T.IcosahedronGeometry(R * 1.005, 1),
      new T.MeshBasicMaterial({ color: 0x223049, wireframe: true })
    );
    g.add(wire);
    var halo = new T.Mesh(
      new T.SphereGeometry(R * 1.22, 16, 12),
      new T.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.10, side: T.BackSide })
    );
    g.add(halo);
    g.userData.halo = halo;
    g.userData.core = core;
    return g;
  };

  // ------------------------------------------------------------------ pads
  RC.buildPads = function (scene) {
    var pads = [];
    var bigGeo = new T.TorusGeometry(2.0, 0.42, 8, 20);
    var bigMat = new T.MeshBasicMaterial({ color: 0xffa733 });
    var smGeo = new T.OctahedronGeometry(0.95);
    var smMat = new T.MeshBasicMaterial({ color: 0xffd85e });

    RC.PADS.big.forEach(function (p) {
      var m = new T.Mesh(bigGeo, bigMat.clone());
      m.position.set(p[0], 2.2, p[1]);
      m.rotation.x = Math.PI / 2;
      scene.add(m);
      var ring = new T.Mesh(
        new T.RingGeometry(2.6, 3.4, 24),
        new T.MeshBasicMaterial({ color: 0xffa733, transparent: true, opacity: 0.4, side: T.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2; ring.position.set(p[0], 0.06, p[1]);
      scene.add(ring);
      pads.push({ x: p[0], z: p[1], big: true, mesh: m, ring: ring, t: 0, r: 4.4 });
    });

    RC.PADS.small.forEach(function (p) {
      var m = new T.Mesh(smGeo, smMat.clone());
      m.position.set(p[0], 1.2, p[1]);
      scene.add(m);
      var ring = new T.Mesh(
        new T.RingGeometry(1.2, 1.7, 18),
        new T.MeshBasicMaterial({ color: 0xffd85e, transparent: true, opacity: 0.35, side: T.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2; ring.position.set(p[0], 0.06, p[1]);
      scene.add(ring);
      pads.push({ x: p[0], z: p[1], big: false, mesh: m, ring: ring, t: 0, r: 3.0 });
    });
    return pads;
  };

  // ------------------------------------------------------------------ fx
  RC.buildFX = function (scene) {
    var fx = { hits: [], rings: [], shadows: [] };

    for (var i = 0; i < 6; i++) {
      var s = new T.Mesh(
        new T.RingGeometry(0.1, 1.0, 20),
        new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: T.DoubleSide })
      );
      s.rotation.x = -Math.PI / 2; s.visible = false;
      scene.add(s);
      fx.rings.push({ mesh: s, t: 0, life: 0, size: 1 });
    }

    // blob shadows
    function shadow(r) {
      var m = new T.Mesh(
        new T.CircleGeometry(r, 20),
        new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
      );
      m.rotation.x = -Math.PI / 2;
      scene.add(m);
      return m;
    }
    fx.ballShadow = shadow(CFG.BALL.R * 1.05);
    fx.carShadows = [shadow(2.0), shadow(2.0)];

    // goal explosion particles
    var pc = 220;
    var pos = new Float32Array(pc * 3);
    var pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    var pm = new T.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0 });
    var pts = new T.Points(pg, pm);
    pts.frustumCulled = false;
    scene.add(pts);
    fx.burst = { pts: pts, vel: new Float32Array(pc * 3), n: pc, t: 0 };

    fx.ring = function (pos, size, color) {
      for (var i = 0; i < fx.rings.length; i++) {
        var r = fx.rings[i];
        if (r.life <= 0) {
          r.mesh.position.copy(pos);
          r.mesh.material.color.setHex(color === undefined ? 0xffffff : color);
          r.mesh.visible = true;
          r.life = 0.45; r.t = 0; r.size = size;
          r.mesh.lookAt(pos.x, pos.y + 1, pos.z);
          return;
        }
      }
    };

    fx.explode = function (p, color) {
      var b = fx.burst, a = b.pts.geometry.attributes.position.array;
      for (var i = 0; i < b.n; i++) {
        a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z;
        var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        var sp = 16 + Math.random() * 34;
        b.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
        b.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * 0.9;
        b.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.color.setHex(color);
      b.pts.material.opacity = 1;
      b.t = 1.6;
    };

    fx.update = function (dt) {
      for (var i = 0; i < fx.rings.length; i++) {
        var r = fx.rings[i];
        if (r.life > 0) {
          r.t += dt; r.life -= dt;
          var k = Math.min(1, r.t / 0.45);
          r.mesh.scale.setScalar(r.size * (0.3 + k * 1.6));
          r.mesh.material.opacity = 0.85 * (1 - k);
          if (r.life <= 0) r.mesh.visible = false;
        }
      }
      var b = fx.burst;
      if (b.t > 0) {
        b.t -= dt;
        var a = b.pts.geometry.attributes.position.array;
        for (var j = 0; j < b.n; j++) {
          b.vel[j * 3 + 1] -= 22 * dt;
          a[j * 3] += b.vel[j * 3] * dt;
          a[j * 3 + 1] += b.vel[j * 3 + 1] * dt;
          a[j * 3 + 2] += b.vel[j * 3 + 2] * dt;
          if (a[j * 3 + 1] < 0.2) { a[j * 3 + 1] = 0.2; b.vel[j * 3 + 1] *= -0.4; }
        }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.t / 1.6);
      }
    };

    return fx;
  };
})();
