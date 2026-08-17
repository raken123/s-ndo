/* mesh.js — procedural geometry. A Builder accumulates transformed primitives
   into one interleaved buffer (pos, normal, colour) so a whole prop such as the
   drum robot's torso becomes a single draw call. */
(function (global) {
  'use strict';

  const M4 = global.AJGL.M4;

  function Builder() {
    this.v = [];   // flat: x,y,z, nx,ny,nz, r,g,b
    this.i = [];
    this.stack = [M4.create()];
  }

  Builder.prototype = {
    get xform() { return this.stack[this.stack.length - 1]; },

    push(m) {
      const top = M4.create();
      M4.multiply(top, this.xform, m);
      this.stack.push(top);
      return this;
    },
    pop() { if (this.stack.length > 1) this.stack.pop(); return this; },

    /* Convenience: chain a translate/rotate/scale onto the current transform. */
    at(x, y, z) { return this.push(M4.translate(M4.create(), x, y, z)); },
    rx(r) { return this.push(M4.rotX(M4.create(), r)); },
    ry(r) { return this.push(M4.rotY(M4.create(), r)); },
    rz(r) { return this.push(M4.rotZ(M4.create(), r)); },
    sc(x, y, z) { return this.push(M4.scale(M4.create(), x, y === undefined ? x : y, z === undefined ? x : z)); },

    /* Appends raw geometry through the current transform. */
    add(positions, normals, indices, color) {
      const m = this.xform;
      const n3 = new Float32Array(9);
      M4.normalMat(n3, m);
      const base = this.v.length / 9;

      for (let k = 0; k < positions.length; k += 3) {
        const x = positions[k], y = positions[k + 1], z = positions[k + 2];
        this.v.push(
          m[0]*x + m[4]*y + m[8]*z  + m[12],
          m[1]*x + m[5]*y + m[9]*z  + m[13],
          m[2]*x + m[6]*y + m[10]*z + m[14]
        );
        const nx = normals[k], ny = normals[k + 1], nz = normals[k + 2];
        let tx = n3[0]*nx + n3[3]*ny + n3[6]*nz;
        let ty = n3[1]*nx + n3[4]*ny + n3[7]*nz;
        let tz = n3[2]*nx + n3[5]*ny + n3[8]*nz;
        const len = Math.hypot(tx, ty, tz) || 1;
        this.v.push(tx / len, ty / len, tz / len);
        this.v.push(color[0], color[1], color[2]);
      }
      for (let k = 0; k < indices.length; k++) this.i.push(base + indices[k]);
      return this;
    },

    build() {
      return {
        vertices: new Float32Array(this.v),
        indices: (this.v.length / 9 > 65535)
          ? new Uint32Array(this.i)
          : new Uint16Array(this.i)
      };
    },

    /* ---- primitives ---- */

    /* Unit box centred on the origin, 1x1x1. */
    box(color) {
      const p = [], n = [], idx = [];
      const faces = [
        [[ .5,-.5, .5],[ .5, .5, .5],[ .5, .5,-.5],[ .5,-.5,-.5],[ 1, 0, 0]],
        [[-.5,-.5,-.5],[-.5, .5,-.5],[-.5, .5, .5],[-.5,-.5, .5],[-1, 0, 0]],
        [[-.5, .5, .5],[-.5, .5,-.5],[ .5, .5,-.5],[ .5, .5, .5],[ 0, 1, 0]],
        [[-.5,-.5,-.5],[-.5,-.5, .5],[ .5,-.5, .5],[ .5,-.5,-.5],[ 0,-1, 0]],
        [[-.5,-.5, .5],[ .5,-.5, .5],[ .5, .5, .5],[-.5, .5, .5],[ 0, 0, 1]],
        [[ .5,-.5,-.5],[-.5,-.5,-.5],[-.5, .5,-.5],[ .5, .5,-.5],[ 0, 0,-1]]
      ];
      faces.forEach((f, fi) => {
        const nor = f[4];
        for (let k = 0; k < 4; k++) { p.push(...f[k]); n.push(...nor); }
        const b = fi * 4;
        idx.push(b, b+2, b+1, b, b+3, b+2);
      });
      return this.add(p, n, idx, color);
    },

    /* Cylinder along +Y, radius 0.5, height 1, centred on the origin.
       capColor lets a drum shell have cream heads and a wooden body. */
    cylinder(color, seg, capColor) {
      seg = seg || 24;
      const cap = capColor || color;
      const p = [], n = [], idx = [];
      /* side */
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        const cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
        p.push(cx, -0.5, cz, cx, 0.5, cz);
        n.push(Math.cos(a), 0, Math.sin(a), Math.cos(a), 0, Math.sin(a));
      }
      for (let k = 0; k < seg; k++) {
        const b = k * 2;
        idx.push(b, b+3, b+2, b, b+1, b+3);
      }
      this.add(p, n, idx, color);

      /* caps, added separately so they can carry their own colour */
      for (const dir of [1, -1]) {
        const cp = [0, dir * 0.5, 0], cn = [0, dir, 0], ci = [];
        for (let k = 0; k <= seg; k++) {
          const a = (k / seg) * Math.PI * 2;
          cp.push(Math.cos(a) * 0.5, dir * 0.5, Math.sin(a) * 0.5);
          cn.push(0, dir, 0);
        }
        for (let k = 1; k <= seg; k++) {
          if (dir > 0) ci.push(0, k + 1, k); else ci.push(0, k, k + 1);
        }
        this.add(cp, cn, ci, cap);
      }
      return this;
    },

    /* Unit sphere, radius 0.5. */
    sphere(color, seg) {
      seg = seg || 16;
      const rings = Math.max(6, seg >> 1);
      const p = [], n = [], idx = [];
      for (let y = 0; y <= rings; y++) {
        const phi = (y / rings) * Math.PI;
        for (let x = 0; x <= seg; x++) {
          const th = (x / seg) * Math.PI * 2;
          const nx = Math.sin(phi) * Math.cos(th),
                ny = Math.cos(phi),
                nz = Math.sin(phi) * Math.sin(th);
          p.push(nx * 0.5, ny * 0.5, nz * 0.5);
          n.push(nx, ny, nz);
        }
      }
      for (let y = 0; y < rings; y++) {
        for (let x = 0; x < seg; x++) {
          const a = y * (seg + 1) + x, b = a + seg + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      return this.add(p, n, idx, color);
    },

    /* Flat disc in the XZ plane, radius 0.5 — cymbals, blob shadows, rugs. */
    disc(color, seg) {
      seg = seg || 28;
      const p = [0, 0, 0], n = [0, 1, 0], idx = [];
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        p.push(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        n.push(0, 1, 0);
      }
      for (let k = 1; k <= seg; k++) idx.push(0, k + 1, k);
      return this.add(p, n, idx, color);
    },

    /* Torus in the XZ plane — drum hoops and the rope line. */
    torus(color, R, r, seg, sides) {
      seg = seg || 28; sides = sides || 10;
      const p = [], n = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
        for (let j = 0; j <= sides; j++) {
          const v = (j / sides) * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
          p.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
          n.push(cv * cu, sv, cv * su);
        }
      }
      for (let i = 0; i < seg; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * (sides + 1) + j, b = a + sides + 1;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
      return this.add(p, n, idx, color);
    },

    /* Truncated cone along +Y — lampshades, cymbal bells, skirts. */
    cone(color, rTop, rBot, seg) {
      seg = seg || 20;
      const p = [], n = [], idx = [];
      const slope = Math.atan2(rBot - rTop, 1);
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        p.push(c * rBot, -0.5, s * rBot, c * rTop, 0.5, s * rTop);
        const ny = Math.sin(slope), sc = Math.cos(slope);
        n.push(c * sc, ny, s * sc, c * sc, ny, s * sc);
      }
      for (let k = 0; k < seg; k++) {
        const b = k * 2;
        idx.push(b, b + 3, b + 2, b, b + 1, b + 3);
      }
      return this.add(p, n, idx, color);
    }
  };

  /* Colour helpers — the whole game sticks to this warm wood/brass palette. */
  const C = {
    wood:      [0.42, 0.25, 0.13],
    woodLight: [0.56, 0.35, 0.18],
    woodDark:  [0.25, 0.15, 0.08],
    parquetA:  [0.50, 0.32, 0.17],
    parquetB:  [0.40, 0.24, 0.12],
    brass:     [0.78, 0.58, 0.20],
    brassDark: [0.50, 0.36, 0.11],
    cream:     [0.94, 0.89, 0.78],
    creamDark: [0.80, 0.74, 0.62],
    felt:      [0.48, 0.13, 0.13],
    feltDark:  [0.32, 0.08, 0.08],
    ink:       [0.16, 0.12, 0.09],
    lamp:      [1.00, 0.86, 0.55],
    green:     [0.25, 0.49, 0.31],
    plaster:   [0.72, 0.66, 0.56],
    skin:      [0.78, 0.60, 0.45],
    cloth:     [0.34, 0.38, 0.46],
    clothWarm: [0.55, 0.35, 0.30]
  };

  function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }

  global.AJMesh = { Builder, C, shade };
})(typeof window !== 'undefined' ? window : globalThis);
