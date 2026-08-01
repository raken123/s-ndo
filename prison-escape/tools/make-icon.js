#!/usr/bin/env node
/* Generates the app icon (bent prison bars over a warm glow) at every density
   Android needs. No image libraries — the PNGs are
   encoded by hand from an SDF-rendered RGBA buffer.

   usage: node tools/make-icon.js
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ------------------------------------------------------------- png write -- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

/* ------------------------------------------------------------------- sdf -- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r), qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/* a curved bar: quadratic bezier sampled into segments */
function bar(t0, t1, cxTop, cxMid, cxBot, thick) {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = mix(t0, t1, t);
    // quadratic through (cxTop @0) (cxMid @.5) (cxBot @1)
    const a = 2 * (cxTop - 2 * cxMid + cxBot), b = -3 * cxTop + 4 * cxMid - cxBot;
    const x = cxTop + b * t + a * t * t;
    pts.push([x, y]);
  }
  return { pts, r: thick / 2 };
}

const BARS = [
  bar(0.14, 0.86, 0.165, 0.165, 0.165, 0.075),   // straight
  bar(0.14, 0.86, 0.355, 0.255, 0.355, 0.075),   // pried left
  bar(0.14, 0.86, 0.645, 0.745, 0.645, 0.075),   // pried right
  bar(0.14, 0.86, 0.835, 0.835, 0.835, 0.075)    // straight
];

/* the escapee, squeezing through the gap — drawn behind the bars */
const FIGURE = [
  { a: [0.500, 0.470], b: [0.500, 0.630], r: 0.078 },   // torso
  { a: [0.500, 0.615], b: [0.435, 0.795], r: 0.038 },   // back leg
  { a: [0.500, 0.615], b: [0.575, 0.790], r: 0.038 },   // front leg
  { a: [0.480, 0.520], b: [0.345, 0.455], r: 0.032 },   // reaching arm
  { a: [0.520, 0.520], b: [0.655, 0.440], r: 0.032 }    // pushing arm
];
function figureDist(x, y) {
  let d = Math.hypot(x - 0.5, y - 0.395) - 0.068;        // head
  for (const s of FIGURE) {
    const v = sdSegment(x, y, s.a[0], s.a[1], s.b[0], s.b[1]) - s.r;
    if (v < d) d = v;
  }
  return d;
}

function barDist(x, y) {
  let d = 1e9;
  for (const b of BARS) {
    for (let i = 0; i < b.pts.length - 1; i++) {
      const s = sdSegment(x, y, b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1]) - b.r;
      if (s < d) d = s;
    }
  }
  return d;
}

/* sample one point in unit space -> [r,g,b,a] 0..255 */
function sample(x, y) {
  let r = 0, g = 0, b = 0, a = 0;
  const over = (cr, cg, cb, ca) => {
    if (ca <= 0) return;
    const na = ca + a * (1 - ca);
    r = (cr * ca + r * a * (1 - ca)) / na;
    g = (cg * ca + g * a * (1 - ca)) / na;
    b = (cb * ca + b * a * (1 - ca)) / na;
    a = na;
  };

  // background plate
  const bg = sdRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.215);
  if (bg < 0.004) {
    const t = clamp(y, 0, 1);
    over(mix(24, 9, t), mix(31, 13, t), mix(46, 21, t), clamp(-bg / 0.004, 0, 1));
  }
  if (a <= 0) return [0, 0, 0, 0];

  // warm glow from the window
  const gd = Math.hypot(x - 0.5, y - 0.46);
  const glow = clamp(1 - gd / 0.46, 0, 1);
  over(244, 168, 62, glow * glow * 0.62 * a);

  // floor light pool
  const pool = clamp(1 - Math.hypot((x - 0.5) / 0.42, (y - 0.9) / 0.1), 0, 1);
  over(250, 196, 110, pool * 0.30 * a);

  // escapee silhouette against the light
  const fd = figureDist(x, y);
  if (fd < 0.008) {
    const k = clamp(-fd / 0.008, 0, 1);
    over(13, 17, 27, k);
    if (fd > -0.018) over(255, 190, 110, 0.30 * k);      // rim light
  }

  // window frame (top and bottom rails)
  for (const cy of [0.135, 0.865]) {
    const d = sdRoundRect(x, y, 0.5, cy, 0.375, 0.036, 0.02);
    if (d < 0.006) over(150, 160, 176, clamp(-d / 0.006, 0, 1));
  }

  // bars
  const bd = barDist(x, y);
  if (bd < 0.006) {
    const k = clamp(-bd / 0.006, 0, 1);
    const shade = clamp((y - 0.1) / 0.8, 0, 1);
    over(mix(214, 132, shade), mix(222, 143, shade), mix(233, 160, shade), k);
    // specular edge on the left of each bar
    if (bd > -0.022 && bd < -0.004) over(255, 255, 255, 0.22 * k);
  }

  return [Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255)];
}

function renderIcon(size, ss) {
  ss = ss || 3;
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) { out[i] = Math.round(r / a); out[i + 1] = Math.round(g / a); out[i + 2] = Math.round(b / a); }
      out[i + 3] = Math.round(a / (ss * ss));
    }
  }
  return out;
}

const root = path.join(__dirname, '..');
const densities = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(densities)) {
  writePNG(path.join(root, 'res/android/icon', `${d}.png`), size, size, renderIcon(size));
  console.log('icon', d, size);
}
writePNG(path.join(root, 'res/icon.png'), 512, 512, renderIcon(512));
writePNG(path.join(root, 'www/img/icon.png'), 192, 192, renderIcon(192));

console.log('done');
