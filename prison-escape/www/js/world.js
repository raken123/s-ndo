/* ==========================================================================
   Escape from Blackgate — 3D world builder
   --------------------------------------------------------------------------
   Turns a level's ASCII tile grid into a three.js scene: merged wall shells,
   a baked floor, props, fences, doors, guards, cameras and searchlights.
   All textures are drawn procedurally on a canvas — nothing is loaded.

   Logic space is the same 32px tile grid the game rules use; the renderer
   scales it by WS (world units per logic pixel).
   ========================================================================== */
const World = (function () {
  'use strict';

  const TILE = 32;
  const T = 3.0;                 // world units per tile (a 3m corridor)
  const WS = T / TILE;           // world units per logic pixel
  const BASE_WALL_H = 3.3;
  const SOLID = new Set(['#', 'B', 'T', 'L', 'c', 'k', 'F', 'W', '1', '2', '3', '4']);

  /* ----------------------------------------------------------- textures -- */
  function canvasTex(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  function noise(g, s, n, alpha) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},255,${Math.random() * alpha})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  }

  const tex = {};
  function textures() {
    if (tex.wall) return tex;

    tex.wall = canvasTex(128, (g, s) => {
      g.fillStyle = '#7c8598'; g.fillRect(0, 0, s, s);
      const rows = 4, h = s / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (s / 4);
        g.fillStyle = 'rgba(0,0,0,.20)';
        g.fillRect(0, r * h + h - 3, s, 3);
        for (let x = 0; x < 2; x++) g.fillRect(((off + x * s / 2) % s), r * h, 3, h);
        g.fillStyle = 'rgba(255,255,255,.05)';
        g.fillRect(0, r * h, s, 2);
      }
      noise(g, s, 900, .05);
    });

    tex.ceiling = canvasTex(128, (g, s) => {
      g.fillStyle = '#2b3040'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 4;
      g.strokeRect(2, 2, s - 4, s - 4);
      g.fillStyle = 'rgba(255,255,255,.05)';
      g.fillRect(s * .3, s * .3, s * .4, s * .4);
      noise(g, s, 400, .05);
    });

    tex.metal = canvasTex(128, (g, s) => {
      g.fillStyle = '#48586a'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 8) {
        g.fillStyle = `rgba(255,255,255,${i % 16 ? .03 : .06})`;
        g.fillRect(i, 0, 4, s);
      }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, s - 6, s, 6);
      g.fillStyle = '#c9d4dd'; g.beginPath(); g.arc(s * .5, s * .55, 5, 0, 7); g.fill();
    });

    tex.wood = canvasTex(128, (g, s) => {
      g.fillStyle = '#6d5636'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 3;
      g.strokeRect(6, 6, s - 12, s - 12);
      g.beginPath(); g.moveTo(6, 6); g.lineTo(s - 6, s - 6); g.stroke();
      g.beginPath(); g.moveTo(s - 6, 6); g.lineTo(6, s - 6); g.stroke();
      noise(g, s, 500, .06);
    });

    tex.cloth = canvasTex(64, (g, s) => {
      g.fillStyle = '#8a8375'; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(0,0,0,.12)';
      for (let i = 0; i < s; i += 10) g.fillRect(0, i, s, 4);
      noise(g, s, 300, .08);
    });

    tex.door = canvasTex(128, (g, s) => {
      g.fillStyle = '#7a5a32'; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(8, 8, s - 16, s - 16);
      g.fillStyle = '#8b6a3c'; g.fillRect(12, 12, s - 24, s - 24);
      g.fillStyle = '#2b3040'; g.fillRect(s * .62, s * .42, s * .22, s * .16);
      g.fillStyle = '#e8c56a'; g.beginPath(); g.arc(s * .73, s * .5, 5, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,.5)';
      for (let i = 0; i < 4; i++) g.fillRect(14, 18 + i * 28, s - 28, 3);
    });

    tex.fence = canvasTex(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = '#aab3c2'; g.lineWidth = 3;
      for (let i = -s; i < s * 2; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke();
        g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke();
      }
    });

    tex.leaf = canvasTex(64, (g, s) => {
      g.fillStyle = '#2f5238'; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(0,0,0,.25)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 5, 3);
      g.fillStyle = 'rgba(160,220,150,.18)';
      for (let i = 0; i < 30; i++) g.fillRect(Math.random() * s, Math.random() * s, 4, 2);
    });

    tex.sky = canvasTex(512, (g, s) => {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, '#05070d'); grd.addColorStop(.55, '#0d1424'); grd.addColorStop(1, '#1b2438');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 420; i++) {
        const y = Math.random() * s * .62;
        g.fillStyle = `rgba(255,255,255,${.15 + Math.random() * .7})`;
        const r = Math.random() < .12 ? 2.2 : 1.2;
        g.fillRect(Math.random() * s, y, r, r);
      }
    });

    return tex;
  }

  /* --------------------------------------------------------- geometry --- */
  function pushQuad(pos, nor, uv, a, b, c, d, ur, vr) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const tri = [a, b, c, a, c, d];
    const uvs = [[0, 0], [ur, 0], [ur, vr], [0, 0], [ur, vr], [0, vr]];
    for (let i = 0; i < 6; i++) {
      pos.push(tri[i][0], tri[i][1], tri[i][2]);
      nor.push(nx, ny, nz);
      uv.push(uvs[i][0], uvs[i][1]);
    }
  }

  function pushBox(pos, nor, uv, cx, cy, cz, sx, sy, sz, uvScale) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const s = uvScale || 1;
    const P = (x, y, z) => [x, y, z];
    pushQuad(pos, nor, uv, P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), sx * s, sz * s); // top
    pushQuad(pos, nor, uv, P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), sx * s, sy * s); // +z
    pushQuad(pos, nor, uv, P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), sx * s, sy * s); // -z
    pushQuad(pos, nor, uv, P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), sz * s, sy * s); // +x
    pushQuad(pos, nor, uv, P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), sz * s, sy * s); // -x
  }

  /* flat cone of light on the floor — how you read where a guard is looking */
  function sectorGeometry(radius, fovRad, segments) {
    const pos = [0, 0, 0], nor = [0, 1, 0], uv = [0.5, 0.5];
    for (let i = 0; i <= segments; i++) {
      const a = -fovRad / 2 + (fovRad * i) / segments;
      pos.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
      nor.push(0, 1, 0);
      uv.push(0.5 + Math.sin(a) * 0.5, 0.5 + Math.cos(a) * 0.5);
    }
    const idx = [];
    for (let i = 1; i <= segments; i++) idx.push(0, i + 1, i);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  function finish(pos, nor, uv, material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return new THREE.Mesh(g, material);
  }

  /* ------------------------------------------------------- baked floor --- */
  function bakeFloor(grid, def, exit) {
    const H = grid.length, W = grid[0].length, R = 48;
    const c = document.createElement('canvas');
    c.width = W * R; c.height = H * R;
    const g = c.getContext('2d');
    const outdoor = def.id === 4;
    g.fillStyle = outdoor ? '#3a382f' : '#2c3242';
    g.fillRect(0, 0, c.width, c.height);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = grid[y][x], px = x * R, py = y * R;
        const v = ((x * 7 + y * 13) % 5) * 4;
        if (ch === ',') g.fillStyle = `rgb(${72 + v},${69 + v},${58 + v})`;
        else if (ch === '~') g.fillStyle = `rgb(${26 + v},${52 + v},${70 + v})`;
        else g.fillStyle = `rgb(${58 + v},${64 + v},${82 + v})`;
        g.fillRect(px, py, R, R);
        g.strokeStyle = 'rgba(0,0,0,.30)'; g.lineWidth = 2;
        g.strokeRect(px + 1, py + 1, R - 2, R - 2);
        if (ch === ',') {
          g.fillStyle = 'rgba(255,255,255,.06)';
          for (let s = 0; s < 8; s++)
            g.fillRect(px + ((x * 13 + s * 17 + y * 5) % (R - 4)), py + ((y * 19 + s * 11 + x * 3) % (R - 4)), 3, 3);
        }
        if (ch === '~') {
          g.fillStyle = 'rgba(150,210,240,.14)';
          g.fillRect(px + 4, py + 10, R - 8, 4);
          g.fillRect(px + 10, py + 30, R - 20, 4);
        }
        if (SOLID.has(ch) && ch !== 'F') {           // dark under props/walls
          g.fillStyle = 'rgba(0,0,0,.45)';
          g.fillRect(px, py, R, R);
        }
      }
    }
    // exit pad
    g.fillStyle = 'rgba(120,235,160,.30)';
    g.fillRect(exit.x * R, exit.y * R, R, R);
    g.strokeStyle = '#7ce8a0'; g.lineWidth = 4;
    g.strokeRect(exit.x * R + 3, exit.y * R + 3, R - 6, R - 6);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  /* ----------------------------------------------------------- entities -- */
  function makeGuard(range, fovDeg) {
    const grp = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x3c4a68 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x232a3a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc9a887 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.36), navy);
    torso.position.y = 1.18; grp.add(torso);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.4), dark);
    belt.position.y = 0.72; grp.add(belt);
    for (const s of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), dark);
      leg.position.set(s, 0.36, 0); grp.add(leg);
    }
    for (const s of [-0.4, 0.4]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.2), navy);
      arm.position.set(s, 1.18, 0); grp.add(arm);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
    head.position.y = 1.86; grp.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.14, 12), navy);
    cap.position.y = 2.0; grp.add(cap);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.2), navy);
    peak.position.set(0, 1.96, 0.22); grp.add(peak);

    // the torch beam doubles as the vision cone the player has to read
    const len = range * WS;
    const rad = Math.tan((fovDeg * Math.PI / 180) / 2) * len;
    const cg = new THREE.ConeGeometry(rad, len, 22, 1, true);
    cg.translate(0, -len / 2, 0);
    cg.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c0, transparent: true, opacity: 0.13, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const cone = new THREE.Mesh(cg, coneMat);
    cone.position.set(0, 1.45, 0);
    cone.rotation.x = 0.12;                       // tipped down the way a torch is held
    grp.add(cone);
    grp.userData.cone = cone;

    // the same beam pooled on the floor, which is what you actually watch for
    const pool = new THREE.Mesh(
      sectorGeometry(len, (fovDeg * Math.PI / 180) * 1.05, 22),
      new THREE.MeshBasicMaterial({
        color: 0xffe9b0, transparent: true, opacity: 0.12, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      })
    );
    pool.position.y = 0.05;
    grp.add(pool);
    grp.userData.pool = pool;

    // state markers above the head: '?' while unsure, '!' once they have you
    const bang = new THREE.Sprite(new THREE.SpriteMaterial({
      map: iconTexture('!', '#ff6b5e'), transparent: true
    }));
    bang.position.y = 2.55; bang.scale.set(0.55, 0.55, 1); bang.visible = false;
    grp.add(bang);
    const quest = new THREE.Sprite(new THREE.SpriteMaterial({
      map: iconTexture('?', '#ffcf5e'), transparent: true
    }));
    quest.position.y = 2.55; quest.scale.set(0.55, 0.55, 1); quest.visible = false;
    grp.add(quest);
    grp.userData.bang = bang;
    grp.userData.quest = quest;
    return grp;
  }

  function iconTexture(glyph, color) {
    return canvasTex(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      if (color) {
        g.shadowColor = color; g.shadowBlur = 22;
        g.fillStyle = color;
      } else g.fillStyle = '#fff';
      g.font = 'bold 84px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(glyph, s / 2, s / 2 + 4);
    });
  }

  function makeItem(icon) {
    const grp = new THREE.Group();
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(icon), transparent: true }));
    sp.scale.set(0.75, 0.75, 1);
    sp.position.y = 1.0;
    grp.add(sp);
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.04;
    grp.add(halo);
    grp.userData.sprite = sp;
    return grp;
  }

  function makeWallCamera() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x6d7a90 }));
    grp.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0x11151d }));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.3; grp.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x8de08a }));
    led.position.set(0.12, 0.13, 0.16); grp.add(led);
    grp.userData.led = led;

    const len = 7.5, rad = 1.9;
    const cg = new THREE.ConeGeometry(rad, len, 18, 1, true);
    cg.translate(0, -len / 2, 0); cg.rotateX(Math.PI / 2);
    const cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({
      color: 0xff9a8a, transparent: true, opacity: 0.09, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    }));
    grp.add(cone);
    grp.userData.cone = cone;
    return grp;
  }

  function makeSearchlight(radius) {
    const grp = new THREE.Group();
    const r = radius * WS;
    const len = 14;
    const cg = new THREE.ConeGeometry(r, len, 24, 1, true);
    cg.translate(0, len / 2, 0);
    const beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.055, depthWrite: false, fog: false,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide
    }));
    grp.add(beam);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfff0b0, transparent: true, opacity: 0.30,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.05;
    grp.add(pool);
    return grp;
  }

  function makeExitBeacon() {
    const grp = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.9, 6, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x66e39a, transparent: true, opacity: 0.16, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      })
    );
    col.position.y = 3;
    grp.add(col);
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1.1, 26),
      new THREE.MeshBasicMaterial({
        color: 0x7ce8a0, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    grp.add(ring);
    grp.userData.ring = ring;
    return grp;
  }

  /* -------------------------------------------------------------- build -- */
  function build(def, grid, exit) {
    const tx = textures();
    const H = grid.length, W = grid[0].length;
    const outdoor = def.id === 4;
    const tint = def.dark ? 0x6b7280 : 0xffffff;      // the drain is wet, unlit concrete
    const WALL_H = outdoor ? 7.6 : BASE_WALL_H;   // the yard is ringed by a perimeter wall
    const FENCE_H = outdoor ? 5.0 : BASE_WALL_H;
    const scene = new THREE.Scene();
    const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < W) ? grid[y][x] : '#';
    const isWall = (x, y) => at(x, y) === '#';

    /* sky / fog */
    if (outdoor) {
      scene.background = new THREE.Color(0x0b1120);
      const skyTex = tx.sky.clone();
      skyTex.needsUpdate = true;
      skyTex.wrapS = skyTex.wrapT = THREE.RepeatWrapping;
      skyTex.repeat.set(5, 2);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 28, 18),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
      sky.position.set(W * T / 2, 0, H * T / 2);
      sky.renderOrder = -1;
      scene.add(sky);

      const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 26),
        new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false }));
      moon.position.set(W * T / 2 - 150, 95, H * T / 2 - 210);
      moon.lookAt(W * T / 2, 6, H * T / 2);
      scene.add(moon);

      scene.fog = new THREE.FogExp2(0x0d1526, 0.014);
    } else if (def.dark) {
      scene.background = new THREE.Color(0x04060a);
      scene.fog = new THREE.FogExp2(0x04060a, 0.095);
    } else {
      scene.background = new THREE.Color(0x0b0e15);
      scene.fog = new THREE.FogExp2(0x0b0e15, 0.030);
    }

    /* floor */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W * T, H * T),
      new THREE.MeshLambertMaterial({ map: bakeFloor(grid, def, exit), color: tint })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(W * T / 2, 0, H * T / 2);
    scene.add(floor);

    /* ceiling (indoors) */
    if (!outdoor) {
      const ceilTex = tx.ceiling.clone();
      ceilTex.needsUpdate = true;
      ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
      ceilTex.repeat.set(W, H);
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(W * T, H * T),
        new THREE.MeshLambertMaterial({ map: ceilTex, color: tint, side: THREE.DoubleSide })
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(W * T / 2, WALL_H, H * T / 2);
      scene.add(ceil);
    }

    /* walls — only faces that are actually exposed */
    const wp = [], wn = [], wu = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWall(x, y)) continue;
        const x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T;
        const vr = WALL_H / T;
        if (!isWall(x, y + 1))
          pushQuad(wp, wn, wu, [x0, 0, z1], [x1, 0, z1], [x1, WALL_H, z1], [x0, WALL_H, z1], 1, vr);
        if (!isWall(x, y - 1))
          pushQuad(wp, wn, wu, [x1, 0, z0], [x0, 0, z0], [x0, WALL_H, z0], [x1, WALL_H, z0], 1, vr);
        if (!isWall(x + 1, y))
          pushQuad(wp, wn, wu, [x1, 0, z1], [x1, 0, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], 1, vr);
        if (!isWall(x - 1, y))
          pushQuad(wp, wn, wu, [x0, 0, z0], [x0, 0, z1], [x0, WALL_H, z1], [x0, WALL_H, z0], 1, vr);
        if (outdoor)
          pushQuad(wp, wn, wu, [x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], 1, 1);
      }
    }
    scene.add(finish(wp, wn, wu, new THREE.MeshLambertMaterial({ map: tx.wall, color: tint })));

    /* props: merged per material */
    const props = {
      metal: [[], [], []],   // lockers
      wood: [[], [], []],    // crates, tables, carts
      cloth: [[], [], []]    // bunks
    };
    const doors = [], fences = [], bushes = [], towers = [];
    const bushGeo = new THREE.SphereGeometry(0.75, 10, 8);
    const bushMat = new THREE.MeshLambertMaterial({ map: tx.leaf });

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = at(x, y);
        const cx = x * T + T / 2, cz = y * T + T / 2;
        if (ch === 'L') pushBox(...props.metal, cx, 1.05, cz, 1.5, 2.1, 1.9, 0.5);
        else if (ch === 'c') pushBox(...props.wood, cx, 0.75, cz, 2.1, 1.5, 2.1, 0.5);
        else if (ch === 'k') {
          pushBox(...props.wood, cx, 0.55, cz, 2.1, 1.1, 1.7, 0.6);
          pushBox(...props.cloth, cx, 1.25, cz, 1.9, 0.5, 1.5, 0.6);
        } else if (ch === 'T') pushBox(...props.wood, cx, 0.5, cz, 2.6, 0.9, 2.2, 0.5);
        else if (ch === 'B') {
          pushBox(...props.wood, cx, 0.3, cz, 2.4, 0.55, 2.6, 0.5);
          pushBox(...props.cloth, cx, 0.68, cz, 2.2, 0.3, 2.4, 0.6);
          pushBox(...props.wood, cx, 1.45, cz, 2.4, 0.5, 2.6, 0.5);
          pushBox(...props.cloth, cx, 1.78, cz, 2.2, 0.25, 2.4, 0.6);
        } else if (ch === 'W') {
          const t = new THREE.Mesh(new THREE.BoxGeometry(T, 9, T),
            new THREE.MeshLambertMaterial({ map: tx.metal }));
          t.position.set(cx, 4.5, cz);
          scene.add(t); towers.push(t);
        } else if (ch === '%') {
          for (let i = 0; i < 3; i++) {
            const b = new THREE.Mesh(bushGeo, bushMat);
            b.position.set(cx + (i - 1) * 0.75, 0.55 + (i % 2) * 0.25, cz + ((i * 7) % 3 - 1) * 0.6);
            b.scale.setScalar(0.9 + (i % 2) * 0.35);
            scene.add(b); bushes.push(b);
          }
        } else if (ch === 'F') {
          const ft = tx.fence.clone();
          ft.needsUpdate = true;
          ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
          const m = new THREE.Mesh(new THREE.PlaneGeometry(T, FENCE_H),
            new THREE.MeshLambertMaterial({ map: ft, transparent: true, side: THREE.DoubleSide, alphaTest: 0.35 }));
          m.position.set(cx, FENCE_H / 2, cz);
          m.userData.tile = { x, y };
          scene.add(m); fences.push(m);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, FENCE_H, 6),
            new THREE.MeshLambertMaterial({ color: 0x8d97a8 }));
          post.position.set(cx - T / 2, FENCE_H / 2, cz);
          scene.add(post);
        } else if (ch >= '1' && ch <= '4') {
          // hinged on one edge so it can swing open when you unlock it
          const vertical = isWall(x - 1, y) || isWall(x + 1, y);
          const panel = new THREE.Mesh(new THREE.BoxGeometry(T, WALL_H - 0.1, 0.34),
            new THREE.MeshLambertMaterial({ map: tx.door }));
          const hinge = new THREE.Group();
          if (vertical) {
            hinge.position.set(cx, 0, cz - T / 2);
            panel.rotation.y = Math.PI / 2;
            panel.position.set(0, (WALL_H - 0.1) / 2, T / 2);
          } else {
            hinge.position.set(cx - T / 2, 0, cz);
            panel.position.set(T / 2, (WALL_H - 0.1) / 2, 0);
          }
          hinge.add(panel);
          hinge.userData = { tile: { x, y }, char: ch, open: false, swing: 0 };
          scene.add(hinge); doors.push(hinge);
        }
      }
    }
    if (props.metal[0].length) scene.add(finish(...props.metal, new THREE.MeshLambertMaterial({ map: tx.metal, color: tint })));
    if (props.wood[0].length) scene.add(finish(...props.wood, new THREE.MeshLambertMaterial({ map: tx.wood, color: tint })));
    if (props.cloth[0].length) scene.add(finish(...props.cloth, new THREE.MeshLambertMaterial({ map: tx.cloth })));

    /* water film */
    const water = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (at(x, y) === '~') water.push([x, y]);
    if (water.length) {
      const wpp = [], wnn = [], wuu = [];
      for (const [x, y] of water)
        pushQuad(wpp, wnn, wuu,
          [x * T, 0.06, y * T + T], [x * T + T, 0.06, y * T + T],
          [x * T + T, 0.06, y * T], [x * T, 0.06, y * T], 1, 1);
      const wm = finish(wpp, wnn, wuu, new THREE.MeshPhongMaterial({
        color: 0x2b4f6b, transparent: true, opacity: 0.72, shininess: 90, specular: 0x88bbdd
      }));
      scene.add(wm);
    }

    /* lighting */
    const lights = {};
    if (outdoor) {
      scene.add(new THREE.HemisphereLight(0x5f7cb0, 0x24262e, 1.5));
      const moon = new THREE.DirectionalLight(0xa8c4ff, 1.5);
      moon.position.set(-30, 60, 20);
      scene.add(moon);
    } else if (def.dark) {
      scene.add(new THREE.AmbientLight(0x24344c, 0.20));
      scene.add(new THREE.HemisphereLight(0x2b3c52, 0x04060a, 0.16));
    } else {
      scene.add(new THREE.AmbientLight(0xc6d2ea, 2.0));
      scene.add(new THREE.HemisphereLight(0xa8bce4, 0x272c3c, 1.5));
      const strip = new THREE.DirectionalLight(0xe6eeff, 1.1);
      strip.position.set(12, 30, 7);
      scene.add(strip);

      /* strip lights along the ceiling — the look of a wing at night */
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2d2, fog: false });
      const housing = new THREE.MeshLambertMaterial({ color: 0x39404f });
      const lp = [], ln = [], lu = [], hp = [], hn = [], hu = [];
      for (let y = 1; y < H - 1; y += 3) {
        for (let x = 1; x < W - 1; x += 4) {
          if (SOLID.has(at(x, y))) continue;
          const cx = x * T + T / 2, cz = y * T + T / 2;
          pushQuad(lp, ln, lu,
            [cx - 0.9, WALL_H - 0.06, cz + 0.28], [cx + 0.9, WALL_H - 0.06, cz + 0.28],
            [cx + 0.9, WALL_H - 0.06, cz - 0.28], [cx - 0.9, WALL_H - 0.06, cz - 0.28], 1, 1);
          pushBox(hp, hn, hu, cx, WALL_H - 0.02, cz, 2.1, 0.12, 0.8, 0.5);
        }
      }
      scene.add(finish(lp, ln, lu, lampMat));
      scene.add(finish(hp, hn, hu, housing));
    }

    const exitBeacon = makeExitBeacon();
    exitBeacon.position.set(exit.x * T + T / 2, 0, exit.y * T + T / 2);
    scene.add(exitBeacon);

    return { scene, doors, fences, towers, exitBeacon, lights, floor };
  }

  return {
    T, WS, WALL_H: BASE_WALL_H, build, makeGuard, makeItem, makeWallCamera, makeSearchlight,
    iconTexture, textures
  };
})();

if (typeof module !== 'undefined') module.exports = { World };
