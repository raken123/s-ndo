/* scene.js — the Judgment Hall and everything standing in it.

   The hall is deliberately warm: oak parquet, brass lamps, deep red felt. The
   judge is a drum robot — a bass-drum torso, a snare-drum face, cymbal
   shoulders — and it holds two guns. */
(function (global) {
  'use strict';

  const M4 = global.AJGL.M4;
  const { Builder, C, shade } = global.AJMesh;

  /* ---------------- scene graph ---------------- */

  function Node(mesh) {
    this.mesh = mesh || null;
    this.pos = [0, 0, 0];
    this.rot = [0, 0, 0];           // XYZ euler, applied Y then X then Z
    this.scl = [1, 1, 1];
    this.tint = [1, 1, 1];
    this.emissive = 0;
    this.alpha = 1;
    this.visible = true;
    this.panel = null;              // textured panel payload, see render.js
    this.children = [];
    this.world = M4.create();
    this._t = M4.create();
    this._a = M4.create();
    this._b = M4.create();
  }

  Node.prototype.add = function (child) { this.children.push(child); return child; };

  Node.prototype.updateWorld = function (parentWorld) {
    const t = this._t, a = this._a, b = this._b;
    M4.translate(t, this.pos[0], this.pos[1], this.pos[2]);
    M4.rotY(a, this.rot[1]); M4.multiply(b, t, a);
    M4.rotX(a, this.rot[0]); M4.multiply(t, b, a);
    M4.rotZ(a, this.rot[2]); M4.multiply(b, t, a);
    M4.scale(a, this.scl[0], this.scl[1], this.scl[2]);
    M4.multiply(t, b, a);
    if (parentWorld) M4.multiply(this.world, parentWorld, t);
    else this.world.set(t);
    for (let k = 0; k < this.children.length; k++) {
      this.children[k].updateWorld(this.world);
    }
  };

  /* ---------------- the hall ---------------- */

  function buildHall() {
    const b = new Builder();
    const HALF = 15;

    /* Parquet — alternating oak blocks, grain direction flipped per tile. */
    for (let x = -HALF; x < HALF; x += 1.5) {
      for (let z = -HALF; z < HALF; z += 1.5) {
        const alt = ((x / 1.5 + z / 1.5) & 1) === 0;
        const base = alt ? C.parquetA : C.parquetB;
        /* a touch of per-tile variation so the floor is not a flat checker */
        const j = 0.93 + ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.14;
        b.at(x + 0.75, -0.05, z + 0.75).sc(1.46, 0.1, 1.46);
        b.box(shade(base, j));
        b.pop().pop();
      }
    }

    /* Walls: oak wainscot below, warm plaster above, on three sides. */
    const wall = (px, pz, ry, len) => {
      b.at(px, 0, pz).ry(ry);
      b.at(0, 1.1, 0).sc(len, 2.2, 0.25); b.box(C.wood); b.pop().pop();
      b.at(0, 2.3, 0.02).sc(len, 0.12, 0.34); b.box(C.brassDark); b.pop().pop();
      b.at(0, 4.4, 0).sc(len, 4.0, 0.22); b.box(C.plaster); b.pop().pop();
      /* pilasters */
      for (let t = -len / 2 + 1.4; t <= len / 2 - 1.4; t += 3.2) {
        b.at(t, 3.3, 0.16).sc(0.42, 6.6, 0.2); b.box(shade(C.wood, 1.12)); b.pop().pop();
        b.at(t, 6.5, 0.16).sc(0.56, 0.24, 0.28); b.box(C.brassDark); b.pop().pop();
      }
      b.pop().pop();
    };
    wall(0, -HALF, 0, HALF * 2);
    wall(-HALF, 0, Math.PI / 2, HALF * 2);
    wall(HALF, 0, -Math.PI / 2, HALF * 2);

    /* Coffered ceiling with exposed beams. */
    b.at(0, 6.7, 0).sc(HALF * 2, 0.3, HALF * 2); b.box(shade(C.woodDark, 1.1)); b.pop().pop();
    for (let x = -HALF + 2; x < HALF; x += 3.4) {
      b.at(x, 6.42, 0).sc(0.34, 0.34, HALF * 2); b.box(C.wood); b.pop().pop();
    }

    /* The bench — a raised oak platform with a felt-faced front. */
    b.at(0, 0.25, -4.6).sc(7.4, 0.5, 3.0); b.box(shade(C.wood, 1.05)); b.pop().pop();
    b.at(0, 0.52, -4.6).sc(7.6, 0.06, 3.2); b.box(C.brassDark); b.pop().pop();
    b.at(0, 0.95, -3.16).sc(6.6, 1.4, 0.28); b.box(C.woodDark); b.pop().pop();
    b.at(0, 0.95, -3.0).sc(6.0, 1.1, 0.06); b.box(C.felt); b.pop().pop();
    /* carved panel line */
    b.at(0, 1.6, -3.14).sc(6.7, 0.1, 0.32); b.box(C.brass); b.pop().pop();

    /* Two podiums, one per litigant, angled toward the bench. */
    const podium = (px, sign) => {
      b.at(px, 0, -1.5).ry(sign * 0.32);
      b.at(0, 0.5, 0).sc(1.5, 1.0, 1.0); b.box(C.wood); b.pop().pop();
      b.at(0, 1.02, 0).sc(1.7, 0.08, 1.2); b.box(shade(C.woodLight, 1.1)); b.pop().pop();
      b.at(0, 1.08, -0.18).rx(-0.28).sc(1.4, 0.05, 0.6); b.box(C.felt); b.pop().pop().pop();
      b.at(0, 0.62, 0.52).sc(1.2, 0.5, 0.06); b.box(C.feltDark); b.pop().pop();
      /* brass corner caps */
      for (const sx of [-0.68, 0.68]) {
        b.at(sx, 0.5, 0.46).sc(0.09, 1.0, 0.09); b.box(C.brass); b.pop().pop();
      }
      b.pop().pop();
    };
    podium(-3.0, 1);
    podium(3.0, -1);

    /* Deep red runner leading from the queue to the bench. */
    b.at(0, 0.012, 1.5).sc(2.4, 0.02, 12.0); b.box(C.felt); b.pop().pop();
    b.at(0, 0.02, 1.5).sc(2.0, 0.02, 12.0); b.box(shade(C.felt, 1.18)); b.pop().pop();

    /* Rope line: brass posts down both sides of the runner. */
    for (let z = -1.0; z < 12.5; z += 1.6) {
      for (const sx of [-1.65, 1.65]) {
        b.at(sx, 0, z);
        b.at(0, 0.04, 0).sc(0.34, 0.08, 0.34); b.cylinder(C.brassDark, 14); b.pop().pop();
        b.at(0, 0.5, 0).sc(0.09, 1.0, 0.09); b.cylinder(C.brass, 12); b.pop().pop();
        b.at(0, 1.02, 0).sc(0.16, 0.16, 0.16); b.sphere(C.brass, 12); b.pop().pop();
        b.pop();
        /* the rope itself, sagging between posts */
        if (z < 11.0) {
          for (let s = 0; s <= 6; s++) {
            const t = s / 6;
            const sag = Math.sin(t * Math.PI) * 0.16;
            b.at(sx, 0.94 - sag, z + t * 1.6).sc(0.07, 0.07, 0.3);
            b.sphere(C.felt, 8); b.pop().pop();
          }
        }
      }
    }

    /* Brass pendant lamps — the only light sources in the shader. */
    for (const lx of [-4.2, 4.2]) {
      b.at(lx, 0, -2.0);
      b.at(0, 6.35, 0).sc(0.07, 1.4, 0.07); b.cylinder(C.brassDark, 10); b.pop().pop();
      b.at(0, 5.6, 0).sc(1.5, 0.9, 1.5); b.cone(C.brass, 0.22, 0.5, 22); b.pop().pop();
      b.pop();
    }

    /* Bookcases of statute volumes along the back wall, either side of the bench. */
    for (const bx of [-9.5, 9.5]) {
      b.at(bx, 0, -13.6);
      b.at(0, 2.2, 0).sc(4.6, 4.4, 0.7); b.box(C.woodDark); b.pop().pop();
      for (let sh = 0; sh < 5; sh++) {
        const y = 0.55 + sh * 0.82;
        b.at(0, y, 0.06).sc(4.4, 0.07, 0.66); b.box(C.wood); b.pop().pop();
        for (let k = 0; k < 16; k++) {
          const h = 0.42 + ((k * 37 + sh * 11) % 7) * 0.03;
          const tone = [C.felt, C.woodLight, C.green, C.brassDark][(k + sh) % 4];
          b.at(-2.05 + k * 0.27, y + 0.04 + h / 2, 0.2).sc(0.2, h, 0.4);
          b.box(shade(tone, 0.85 + ((k * 13) % 5) * 0.06)); b.pop().pop();
        }
      }
      b.pop();
    }

    return b.build();
  }

  /* ---------------- the guns ---------------- */

  /* A stylised sidearm: brass barrel, oak grip, and a rotating chamber shaped
     like a little drum. Cartoonish on purpose — this is a drum robot's prop. */
  function addGun(b) {
    /* barrel */
    b.at(0, 0, -0.26).rx(Math.PI / 2).sc(0.075, 0.5, 0.075);
    b.cylinder(C.brass, 14, C.brassDark); b.pop().pop().pop();
    /* muzzle ring */
    b.at(0, 0, -0.5).rx(Math.PI / 2).sc(0.11, 0.06, 0.11);
    b.cylinder(shade(C.brass, 1.15), 14); b.pop().pop().pop();
    /* drum-shaped chamber */
    b.at(0, 0, -0.02).rx(Math.PI / 2).sc(0.17, 0.16, 0.17);
    b.cylinder(C.woodLight, 16, C.cream); b.pop().pop().pop();
    b.at(0, 0, -0.02).rx(Math.PI / 2).sc(1, 1, 1);
    b.torus(C.brass, 0.088, 0.014, 18, 7); b.pop().pop().pop();
    /* frame */
    b.at(0, 0.02, 0.06).sc(0.09, 0.13, 0.3); b.box(C.brassDark); b.pop().pop();
    /* oak grip */
    b.at(0, -0.17, 0.14).rx(0.35).sc(0.085, 0.3, 0.13); b.box(C.wood); b.pop().pop().pop();
    /* trigger guard */
    b.at(0, -0.1, 0.0).rx(Math.PI / 2).sc(1, 1, 1);
    b.torus(C.brassDark, 0.08, 0.016, 14, 6); b.pop().pop().pop();
  }

  /* ---------------- the AI drum robot ---------------- */

  /* Returns { root, parts } where parts are the nodes the animator moves. */
  function buildRobot() {
    /* --- torso: a bass drum standing on its rim, head facing the players --- */
    const torsoB = new Builder();
    torsoB.rx(Math.PI / 2).sc(1.44, 0.62, 1.44);
    torsoB.cylinder(C.wood, 30, C.cream);
    torsoB.pop().pop();
    /* counter-hoops front and back */
    for (const dz of [0.31, -0.31]) {
      torsoB.at(0, 0, dz).rx(Math.PI / 2);
      torsoB.torus(C.brass, 0.72, 0.045, 30, 9);
      torsoB.pop().pop();
    }
    /* tension lugs around the shell */
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      torsoB.at(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0).rz(a).sc(0.1, 0.12, 0.68);
      torsoB.box(C.brassDark);
      torsoB.pop().pop().pop();
    }
    /* felt medallion on the front head */
    torsoB.at(0, 0.02, 0.315).rx(Math.PI / 2).sc(0.62, 1, 0.62);
    torsoB.disc(C.felt, 26); torsoB.pop().pop().pop();
    torsoB.at(0, 0.02, 0.318).rx(Math.PI / 2).sc(0.44, 1, 0.44);
    torsoB.disc(C.cream, 26); torsoB.pop().pop().pop();

    /* --- head: a snare drum, cream head forward, two lamp eyes --- */
    const headB = new Builder();
    headB.rx(Math.PI / 2).sc(0.86, 0.5, 0.86);
    headB.cylinder(shade(C.wood, 1.1), 26, C.cream);
    headB.pop().pop();
    for (const dz of [0.25, -0.25]) {
      headB.at(0, 0, dz).rx(Math.PI / 2);
      headB.torus(C.brass, 0.43, 0.035, 26, 8);
      headB.pop().pop();
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      headB.at(Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0).rz(a).sc(0.075, 0.09, 0.56);
      headB.box(C.brassDark); headB.pop().pop().pop();
    }
    /* eye sockets, rims and lenses sit slightly proud of the head */
    for (const ex of [-0.17, 0.17]) {
      headB.at(ex, 0.05, 0.256).rx(Math.PI / 2).sc(0.25, 1, 0.25);
      headB.disc(C.ink, 18); headB.pop().pop().pop();
      headB.at(ex, 0.05, 0.264).rx(Math.PI / 2);
      headB.torus(C.brass, 0.125, 0.026, 18, 7); headB.pop().pop();
    }
    /* front hoop and a tuning ring, so the face reads as a drum head */
    headB.at(0, 0, 0.252).rx(Math.PI / 2);
    headB.torus(C.brass, 0.39, 0.03, 26, 8); headB.pop().pop();
    headB.at(0, 0, 0.254).rx(Math.PI / 2);
    headB.torus(C.creamDark, 0.31, 0.012, 24, 6); headB.pop().pop();
    /* a small brass "verdict" plaque under the eyes, like a nameplate */
    headB.at(0, -0.19, 0.26).sc(0.42, 0.11, 0.03);
    headB.box(C.brass); headB.pop().pop();

    /* eyes are their own emissive nodes so they can pulse */
    const eyeB = new Builder();
    eyeB.rx(Math.PI / 2).sc(0.21, 1, 0.21);
    eyeB.disc(C.lamp, 16);
    eyeB.pop().pop();

    /* --- limbs --- */
    const upperB = new Builder();
    upperB.at(0, -0.25, 0).sc(0.2, 0.56, 0.2);
    upperB.cylinder(C.brassDark, 14, C.brass); upperB.pop().pop();
    upperB.sc(0.26, 0.26, 0.26); upperB.sphere(C.brass, 14); upperB.pop();

    const foreB = new Builder();
    foreB.at(0, -0.24, 0).sc(0.17, 0.52, 0.17);
    foreB.cylinder(shade(C.brass, 0.9), 14, C.brass); foreB.pop().pop();
    foreB.sc(0.22, 0.22, 0.22); foreB.sphere(C.brassDark, 12); foreB.pop();
    /* the hand, wrapped around the grip */
    foreB.at(0, -0.5, 0).sc(0.2, 0.2, 0.22); foreB.box(C.woodDark); foreB.pop().pop();
    /* gun, held muzzle-forward */
    foreB.at(0, -0.56, -0.06).rx(1.5708);
    addGun(foreB);
    foreB.pop().pop();

    const cymbalB = new Builder();
    cymbalB.sc(1.0, 1, 1.0); cymbalB.cone(C.brass, 0.5, 0.06, 26); cymbalB.pop();
    cymbalB.at(0, 0.06, 0).sc(0.18, 0.1, 0.18); cymbalB.sphere(shade(C.brass, 1.2), 12);
    cymbalB.pop().pop();

    const legB = new Builder();
    legB.at(0, -0.3, 0).sc(0.26, 0.62, 0.26);
    legB.cylinder(C.woodDark, 12, C.brassDark); legB.pop().pop();
    legB.at(0, -0.63, 0.08).sc(0.44, 0.12, 0.6);
    legB.box(C.brassDark); legB.pop().pop();

    return {
      meshes: {
        torso: torsoB.build(), head: headB.build(), eye: eyeB.build(),
        upper: upperB.build(), fore: foreB.build(),
        cymbal: cymbalB.build(), leg: legB.build()
      }
    };
  }

  /* Assembles robot meshes into a posable node tree. */
  function assembleRobot(gpu) {
    const root = new Node(null);
    const parts = {};

    parts.hips = root.add(new Node(null));
    parts.hips.pos = [0, 1.42, 0];

    for (const [name, lx] of [['legL', -0.42], ['legR', 0.42]]) {
      const leg = root.add(new Node(gpu.leg));
      leg.pos = [lx, 0.72, 0];
      parts[name] = leg;
    }

    parts.torso = parts.hips.add(new Node(gpu.torso));

    parts.head = parts.hips.add(new Node(gpu.head));
    parts.head.pos = [0, 1.06, 0.02];

    parts.eyeL = parts.head.add(new Node(gpu.eye));
    parts.eyeL.pos = [-0.17, 0.05, 0.272];
    parts.eyeL.emissive = 1;
    parts.eyeR = parts.head.add(new Node(gpu.eye));
    parts.eyeR.pos = [0.17, 0.05, 0.272];
    parts.eyeR.emissive = 1;

    for (const [name, sx] of [['cymL', -0.98], ['cymR', 0.98]]) {
      const c = parts.hips.add(new Node(gpu.cymbal));
      c.pos = [sx, 0.5, 0];
      c.rot = [0, 0, sx < 0 ? 0.3 : -0.3];
      parts[name] = c;
    }

    for (const [side, sx] of [['L', -1.02], ['R', 1.02]]) {
      const up = parts.hips.add(new Node(gpu.upper));
      up.pos = [sx, 0.42, 0.02];
      up.rot = [0.15, 0, sx < 0 ? 0.22 : -0.22];
      const fore = up.add(new Node(gpu.fore));
      fore.pos = [0, -0.52, 0];
      fore.rot = [-0.5, 0, 0];
      parts['arm' + side] = up;
      parts['fore' + side] = fore;
      /* muzzle marker: where shots originate, in the forearm's space */
      const muzzle = fore.add(new Node(null));
      muzzle.pos = [0, -0.62, -0.5];
      parts['muzzle' + side] = muzzle;
    }

    return { root, parts };
  }

  /* ---------------- player avatars ---------------- */

  /* Deliberately simple wooden-doll figures — the robot is the star. */
  function buildAvatar() {
    const b = new Builder();
    /* legs */
    for (const lx of [-0.16, 0.16]) {
      b.at(lx, 0.38, 0).sc(0.2, 0.76, 0.22); b.cylinder(C.cloth, 10, C.woodDark); b.pop().pop();
      b.at(lx, 0.03, 0.05).sc(0.24, 0.1, 0.36); b.box(C.woodDark); b.pop().pop();
    }
    /* torso as a slightly tapered coat */
    b.at(0, 1.06, 0).sc(0.62, 0.66, 0.42); b.cone(C.clothWarm, 0.72, 1.0, 16); b.pop().pop();
    b.at(0, 1.36, 0).sc(0.46, 0.12, 0.34); b.cylinder(C.cream, 14); b.pop().pop();
    /* arms */
    for (const ax of [-0.33, 0.33]) {
      b.at(ax, 1.05, 0).rz(ax < 0 ? 0.12 : -0.12).sc(0.16, 0.62, 0.18);
      b.cylinder(C.clothWarm, 10, C.skin); b.pop().pop().pop();
    }
    /* head */
    b.at(0, 1.58, 0).sc(0.36, 0.4, 0.34); b.sphere(C.skin, 16); b.pop().pop();
    b.at(0, 1.72, -0.02).sc(0.38, 0.22, 0.36); b.sphere(C.woodDark, 14); b.pop().pop();
    /* a small brass litigant's badge */
    b.at(0.16, 1.24, 0.19).sc(0.1, 0.1, 0.03); b.box(C.brass); b.pop().pop();
    return b.build();
  }

  /* Soft blob shadow, drawn just above the floor under every figure. */
  function buildShadow() {
    const b = new Builder();
    b.sc(1.2, 1, 1.2); b.disc([0.10, 0.06, 0.03], 24); b.pop();
    return b.build();
  }

  /* One confetti chip / spark, reused for the whole burst. */
  function buildSpark() {
    const b = new Builder();
    b.sc(0.09, 0.02, 0.05); b.box([1, 1, 1]); b.pop();
    return b.build();
  }

  /* ---------------- layout constants shared with the game ---------------- */

  const LAYOUT = {
    robot: [0, 0.5, -4.6],
    podiumSelf: [-3.0, 0, -1.5],
    podiumFoe: [3.0, 0, -1.5],
    standSelf: [-3.0, 0, -0.75],
    standFoe: [3.0, 0, -0.75],
    /* Slot 0 is the front of the line, right beside the bench. */
    queueSlot(i) {
      return [-0.15 + Math.sin(i * 1.13) * 0.42, 0, -1.15 + i * 1.32];
    }
  };

  global.AJScene = {
    Node, buildHall, buildRobot, assembleRobot,
    buildAvatar, buildShadow, buildSpark, LAYOUT
  };
})(typeof window !== 'undefined' ? window : globalThis);
