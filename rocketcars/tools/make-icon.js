/*
 * Generates the Rocket Cars app icon (and every Android density) from scratch.
 * No image libraries available in this environment, so this renders the artwork
 * by supersampling an analytic scene and writes the PNGs with a tiny encoder.
 *
 *   node tools/make-icon.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --------------------------------------------------------------- png writer
const CRC = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

// ------------------------------------------------------------------ helpers
const S = 1024;                      // master size
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sat = t => clamp(t, 0, 1);
const smooth = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = clamp(x, x0 + r, x1 - r), cy = clamp(y, y0 + r, y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}
function distRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = clamp(x, x0 + r, x1 - r), cy = clamp(y, y0 + r, y1 - r);
  return Math.hypot(x - cx, y - cy) - r;
}
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function poly(pts, ang, ox, oy, sc) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(p => [ox + (p[0] * c - p[1] * s) * sc, oy + (p[0] * s + p[1] * c) * sc]);
}
function pt(p, ang, ox, oy, sc) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [ox + (p[0] * c - p[1] * s) * sc, oy + (p[0] * s + p[1] * c) * sc];
}

// ------------------------------------------------------------------- scene
const CAR_ANG = -0.32, CAR_X = 452, CAR_Y = 688, CAR_S = 0.95;

function toLocal(x, y) {
  const c = Math.cos(-CAR_ANG), s = Math.sin(-CAR_ANG);
  const dx = (x - CAR_X) / CAR_S, dy = (y - CAR_Y) / CAR_S;
  return [dx * c - dy * s, dx * s + dy * c];
}

const BODY = poly([
  [-238, 44], [244, 44], [270, 4], [152, -16], [62, -24],
  [4, -100], [-118, -108], [-194, -54], [-244, -26]
], CAR_ANG, CAR_X, CAR_Y, CAR_S);

const WINDOW = poly([
  [-2, -88], [-110, -96], [-166, -54], [-16, -48]
], CAR_ANG, CAR_X, CAR_Y, CAR_S);

const STRIPE = poly([
  [-196, 28], [236, 28], [250, 8], [-202, 8]
], CAR_ANG, CAR_X, CAR_Y, CAR_S);

const LIGHT = poly([
  [262, 4], [228, -2], [226, 8], [260, 14]
], CAR_ANG, CAR_X, CAR_Y, CAR_S);

const WHEEL_F = pt([156, 54], CAR_ANG, CAR_X, CAR_Y, CAR_S);
const WHEEL_R = pt([-150, 54], CAR_ANG, CAR_X, CAR_Y, CAR_S);
const WHEEL_R_PX = 66 * CAR_S;

const BALL_X = 690, BALL_Y = 330, BALL_R = 196;

// soccer-ball panels: one centred pentagon + a ring of five
const PENTAS = [];
(function () {
  function penta(cx, cy, r, rot) {
    const p = [];
    for (let i = 0; i < 5; i++) {
      const a = rot + i * Math.PI * 2 / 5;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return p;
  }
  const ox = BALL_X - BALL_R * 0.10, oy = BALL_Y + BALL_R * 0.06;
  PENTAS.push(penta(ox, oy, BALL_R * 0.40, -Math.PI / 2));
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + Math.PI / 5 + i * Math.PI * 2 / 5;
    PENTAS.push(penta(ox + Math.cos(a) * BALL_R * 0.92, oy + Math.sin(a) * BALL_R * 0.92,
      BALL_R * 0.38, a + Math.PI / 2));
  }
})();

// exhaust plumes, evaluated in the car's local frame so they taper properly
const JETS = [{ y: -10, L: 224, w: 33 }, { y: 24, L: 182, w: 28 }];
function flameAt(x, y) {
  const [lx, ly] = toLocal(x, y);
  let best = -1;
  for (const j of JETS) {
    const u = -(lx + 232);
    if (u <= 0 || u >= j.L) continue;
    const half = j.w * Math.pow(1 - u / j.L, 0.55);
    if (Math.abs(ly - j.y) < half) best = Math.max(best, 1 - u / j.L);
  }
  return best;                       // -1 outside, else 0..1 (1 = at the nozzle)
}
function flameGlow(x, y) {
  const [lx, ly] = toLocal(x, y);
  const u = -(lx + 232);
  if (u < -40 || u > 250) return 0;
  const half = 72 * Math.pow(sat(1 - u / 250), 0.5) + 18;
  const d = Math.abs(ly - 8) / half;
  return sat(1 - d) * sat(1 - u / 265);
}

const C_BG_TOP = [26, 48, 96], C_BG_BOT = [7, 11, 26];
const C_STREAK = [70, 150, 255];
const C_CAR = [242, 118, 32], C_CAR_DK = [176, 66, 12];
const C_TRIM = [126, 226, 255];
const C_DARK = [15, 19, 32];
const C_BALL = [246, 250, 255], C_PANEL = [23, 33, 56];
const C_FLAME1 = [255, 214, 96], C_FLAME2 = [255, 122, 32];

function sample(x, y) {
  const d = distRoundRect(x, y, 8, 8, S - 8, S - 8, 190);
  if (d > 0) return null;

  // background: vertical gradient + soft radial light behind the ball
  const t = y / S;
  let c = mix(C_BG_TOP, C_BG_BOT, Math.pow(t, 0.75));
  const gl = Math.hypot(x - BALL_X, y - BALL_Y) / (S * 0.85);
  c = mix(c, [60, 110, 190], 0.35 * sat(1 - gl));

  // diagonal speed streaks
  const u = (x * 0.72 + y * 0.69);
  for (const [off, w, a] of [[60, 26, 0.10], [250, 52, 0.13], [520, 18, 0.08], [760, 38, 0.11]]) {
    const dd = Math.abs(u - off);
    if (dd < w) c = mix(c, C_STREAK, a * (1 - dd / w));
  }

  // ground glow under the car
  const gd = Math.hypot((x - CAR_X - 20) / 400, (y - 830) / 90);
  if (gd < 1) c = mix(c, [90, 150, 235], 0.22 * (1 - gd));

  // boost plume: soft glow first, then the hot core
  const gw = flameGlow(x, y);
  if (gw > 0) c = mix(c, C_FLAME2, 0.42 * gw * gw);
  const fl = flameAt(x, y);
  if (fl >= 0) {
    c = mix(C_FLAME2, C_FLAME1, fl);
    c = mix(c, [255, 252, 224], sat(fl - 0.5) * 1.9);
  }

  // ---- car
  const wf = Math.hypot(x - WHEEL_F[0], y - WHEEL_F[1]);
  const wr = Math.hypot(x - WHEEL_R[0], y - WHEEL_R[1]);
  const onWheel = wf < WHEEL_R_PX || wr < WHEEL_R_PX;
  if (onWheel) {
    c = C_DARK;
    const rim = Math.min(wf, wr);
    if (rim < WHEEL_R_PX * 0.44) c = mix(C_TRIM, [40, 70, 110], sat(rim / (WHEEL_R_PX * 0.44)));
    if (rim > WHEEL_R_PX * 0.82) c = mix(c, [45, 55, 78], 0.8);
  }
  if (inPoly(x, y, BODY)) {
    // top-lit body shading
    const local = (y - (CAR_Y - 110)) / 190;
    c = mix(C_CAR, C_CAR_DK, sat(local));
    c = mix(c, [255, 205, 140], 0.55 * sat(1 - local * 2.4));
  }
  if (inPoly(x, y, STRIPE)) c = C_TRIM;
  if (inPoly(x, y, LIGHT)) c = [255, 246, 214];
  if (inPoly(x, y, WINDOW)) {
    const k = sat((y - (CAR_Y - 100)) / 70);
    c = mix([180, 240, 255], [26, 76, 140], k);
  }

  // ---- ball
  const bd = Math.hypot(x - BALL_X, y - BALL_Y);
  if (bd < BALL_R) {
    const sh = sat((Math.hypot(x - (BALL_X - BALL_R * 0.34), y - (BALL_Y - BALL_R * 0.36))) / (BALL_R * 1.5));
    c = mix(C_BALL, [150, 172, 205], sh);
    for (let i = 0; i < PENTAS.length; i++) {
      if (inPoly(x, y, PENTAS[i])) { c = mix(C_PANEL, [46, 62, 96], sh * 0.8); break; }
    }
    if (bd > BALL_R - 8) c = mix(c, [120, 190, 255], smooth(BALL_R - 8, BALL_R, bd));
  } else if (bd < BALL_R + 26) {
    c = mix(c, [120, 200, 255], 0.30 * (1 - (bd - BALL_R) / 26));
  }

  // inner rim light on the tile edge
  if (d > -14) c = mix(c, [120, 190, 255], 0.42 * smooth(-14, -1, d));
  return c;
}

// ----------------------------------------------------------------- render
function render(size, ss) {
  const buf = Buffer.alloc(size * size * 4);
  const step = S / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) * step;
          const y = (py + (sy + 0.5) / ss) * step;
          const c = sample(x, y);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      }
      const n = ss * ss, i = (py * size + px) * 4;
      const av = a / n;
      buf[i] = clamp(Math.round(r / n * (255 / (av || 255))), 0, 255);
      buf[i + 1] = clamp(Math.round(g / n * (255 / (av || 255))), 0, 255);
      buf[i + 2] = clamp(Math.round(b / n * (255 / (av || 255))), 0, 255);
      buf[i + 3] = Math.round(av);
    }
  }
  return buf;
}

const outDir = path.join(__dirname, '..', 'res', 'android');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  ['../icon.png', 1024, 3],
  ['icon-ldpi.png', 36, 8],
  ['icon-mdpi.png', 48, 8],
  ['icon-hdpi.png', 72, 6],
  ['icon-xhdpi.png', 96, 6],
  ['icon-xxhdpi.png', 144, 5],
  ['icon-xxxhdpi.png', 192, 4]
];
for (const [name, size, ss] of sizes) {
  const buf = render(size, ss);
  const file = path.join(outDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writePNG(file, size, size, buf);
  console.log('wrote', path.relative(path.join(__dirname, '..'), file), size + 'px');
}
