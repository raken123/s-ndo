// Ritverktyg för filmen: slump, brus, färger, partiklar, landskap och figurer.
// Allt är en ren funktion av tiden, så att bildrutor kan renderas i valfri
// ordning och i flera processer samtidigt.
import { createCanvas } from '@napi-rs/canvas';

export const W = 1920;
export const H = 1080;

// ---------- matte ----------
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ease = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
// 0 → 1 mellan a och b, mjukt
export const ramp = (t, a, b) => smooth((t - a) / (b - a));
// tänds vid a, släcks vid b, med mjuka kanter av längd f
export const window_ = (t, a, b, f = 1) => Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (i, seed) => {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
export function fbm(x, seed = 0, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { v += a * noise1(x * f, seed + o * 17); f *= 2; a *= 0.5; }
  return v;
}

// ---------- färger ----------
export function hex(c) {
  if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).map(Number);
  c = c.replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
export function mix(a, b, t) {
  const A = typeof a === 'string' ? hex(a) : a, B = typeof b === 'string' ? hex(b) : b;
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
export function rgba(c, a) {
  const A = typeof c === 'string' ? hex(c) : c;
  return `rgba(${A[0]},${A[1]},${A[2]},${clamp(a)})`;
}

export function canvas(w = W, h = H) {
  return createCanvas(Math.ceil(w), Math.ceil(h));
}

// Mellanlagring av bilder som inte ändras över tid (berg, hus, moln ...).
const CACHE = new Map();
export function cached(key, w, h, draw) {
  if (!CACHE.has(key)) {
    const c = canvas(w, h);
    draw(c.getContext('2d'), c);
    CACHE.set(key, c);
  }
  return CACHE.get(key);
}

// ---------- grundformer ----------
export function sky(ctx, stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(-W, -H, W * 3, H * 3);
}

export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function addGlow(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r, color, a);
  ctx.restore();
}

export function vignette(ctx, strength = 0.55, color = '#000000') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function tint(ctx, color, a) {
  if (a <= 0) return;
  ctx.fillStyle = rgba(color, a);
  ctx.fillRect(-W, -H, W * 3, H * 3);
}

// Bergs- eller kullsiluett som fylls ned till botten.
export function ridge(ctx, { y, amp, freq, seed, color, oct = 4, x0 = -200, x1 = W + 200, step = 8, sharp = 0 }) {
  ctx.beginPath();
  ctx.moveTo(x0, H + 400);
  for (let x = x0; x <= x1; x += step) {
    let n = fbm(x * freq, seed, oct);
    if (sharp) n = lerp(n, 1 - Math.abs(n) * 2, sharp);
    ctx.lineTo(x, y - n * amp);
  }
  ctx.lineTo(x1, H + 400);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function cloud(ctx, x, y, w, h, color, alpha, seed) {
  const r = rng(seed);
  const n = 9 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * w;
    const py = y + (r() - 0.5) * h * 0.6 - Math.cos((px - x) / w * Math.PI) * h * 0.2;
    const rad = (0.25 + r() * 0.35) * h;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
}

// Molnlager som driver sakta i sidled.
export function clouds(ctx, t, { seed, n, y0, y1, color, alpha, speed, scale = 1 }) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const w = (300 + r() * 500) * scale, h = (120 + r() * 140) * scale;
    const span = W + w * 2;
    const x = ((r() * span + t * speed * (0.6 + r() * 0.8)) % span + span) % span - w;
    const y = lerp(y0, y1, r());
    cloud(ctx, x, y, w, h, color, alpha * (0.6 + r() * 0.4), seed * 100 + i);
  }
}

export function stars(ctx, t, { seed, n, y1 = H * 0.6, alpha = 1 }) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * y1, s = 0.6 + r() * 1.8;
    const tw = 0.55 + 0.45 * Math.sin(t * (1 + r() * 2) + r() * 6.28);
    ctx.fillStyle = rgba('#fff8e8', alpha * tw * (0.4 + r() * 0.6));
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- partiklar ----------
const LEAF_COLORS = ['#c0392b', '#e0612a', '#e8a33d', '#d4492a', '#f0c050', '#a8321f', '#e57e2b'];

export function leafPath(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const lobes = 1 + 0.38 * Math.cos(5 * a) * (a > Math.PI * 0.35 && a < Math.PI * 1.65 ? 1 : 0.4);
    const rr = s * lobes * (0.75 + 0.25 * Math.cos(a - Math.PI));
    const x = Math.cos(a - Math.PI / 2) * rr, y = Math.sin(a - Math.PI / 2) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

export function fallingLeaves(ctx, t, { seed, n, wind = 40, fall = 60, size = 12, colors = LEAF_COLORS, alpha = 1, area = [0, 0, W, H] }) {
  const r = rng(seed);
  const [ax, ay, aw, ah] = area;
  for (let i = 0; i < n; i++) {
    const s = size * (0.6 + r() * 0.8);
    const vy = fall * (0.6 + r() * 0.8), vx = wind * (0.5 + r());
    const x0 = r() * (aw + 200), y0 = r() * (ah + 200);
    const ph = r() * 6.28, sw = 20 + r() * 50, rot = (r() - 0.5) * 4;
    const y = ((y0 + vy * t) % (ah + 200)) - 100 + ay;
    const x = (((x0 + vx * t + Math.sin(t * 1.3 + ph) * sw) % (aw + 200)) + aw + 200) % (aw + 200) - 100 + ax;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ph + t * rot);
    ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + ph)));
    ctx.fillStyle = rgba(colors[i % colors.length], alpha);
    leafPath(ctx, s);
    ctx.fill();
    ctx.restore();
  }
}

export function rain(ctx, t, { seed, n, angle = 0.25, speed = 1400, len = 40, alpha = 0.25, color = '#cfe3f0', width = 1.5 }) {
  const r = rng(seed);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = r() * (W + 600), y0 = r() * (H + 200), v = speed * (0.7 + r() * 0.6);
    const y = ((y0 + v * t) % (H + 200)) - 100;
    const x = ((x0 - 300 + y * angle) % (W + 600)) - 300;
    ctx.moveTo(x, y);
    ctx.lineTo(x - angle * len, y - len);
  }
  ctx.stroke();
}

// Gnistor/eldflugor som svävar runt en punkt eller över en yta.
export function sparks(ctx, t, { seed, n, x, y, spread = 100, rise = 30, size = 3, color = '#fff2c4', alpha = 1, life = 3 }) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const off = r() * life, ang = r() * Math.PI * 2, dist = r() * spread, sp = 0.4 + r();
    const age = ((t + off) % life) / life;
    const px = x + Math.cos(ang) * dist * (0.3 + age) + Math.sin(t * sp * 2 + i) * 8;
    const py = y + Math.sin(ang) * dist * 0.6 * (0.3 + age) - age * rise * sp;
    const a = alpha * Math.sin(age * Math.PI);
    const s = size * (0.5 + r());
    glow(ctx, px, py, s * 4, color, a * 0.5);
    ctx.fillStyle = rgba('#ffffff', a);
    ctx.beginPath();
    ctx.arc(px, py, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function steam(ctx, t, { x, y, seed = 1, n = 6, h = 160, w = 30, alpha = 0.25, color = '#ffffff' }) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const off = r() * 3, sp = 0.8 + r() * 0.4;
    const age = ((t * sp + off) % 3) / 3;
    const px = x + Math.sin(t * 1.5 + i * 2) * w * age + (r() - 0.5) * w;
    const py = y - age * h;
    const rad = 12 + age * 40;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, rgba(color, alpha * Math.sin(age * Math.PI)));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
}

// ---------- natur ----------
// Rekursiv trädstam med grenar; returnerar grenspetsarna för lövkronan.
function branch(ctx, x, y, ang, len, wid, depth, r, tips, sway) {
  const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
  ctx.lineWidth = wid;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + Math.sin(ang + 0.2) * len * 0.5, y - Math.cos(ang + 0.2) * len * 0.5, ex, ey);
  ctx.stroke();
  if (depth === 0) { tips.push([ex, ey]); return; }
  const k = 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const a = ang + (i - (k - 1) / 2) * (0.5 + r() * 0.3) + (r() - 0.5) * 0.3 + sway;
    branch(ctx, ex, ey, a, len * (0.68 + r() * 0.12), wid * 0.66, depth - 1, r, tips, sway);
  }
  if (depth < 3) tips.push([ex, ey]);
}

export function tree(ctx, x, y, { size = 300, seed = 1, trunk = '#2a1a14', leaves = LEAF_COLORS, leafAlpha = 0.9, sway = 0, density = 1, puff = 1 }) {
  const r = rng(seed);
  const tips = [];
  ctx.strokeStyle = trunk;
  ctx.lineCap = 'round';
  branch(ctx, x, y, (r() - 0.5) * 0.1 + sway * 0.3, size * 0.32, size * 0.07, 4, r, tips, sway * 0.15);
  for (const [tx, ty] of tips) {
    const m = Math.round((3 + r() * 3) * density);
    for (let j = 0; j < m; j++) {
      const rad = size * (0.05 + r() * 0.07) * puff;
      ctx.fillStyle = rgba(leaves[Math.floor(r() * leaves.length)], leafAlpha * (0.6 + r() * 0.4));
      ctx.beginPath();
      ctx.arc(tx + (r() - 0.5) * size * 0.16, ty + (r() - 0.5) * size * 0.12, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function pine(ctx, x, y, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const ty = y - h * 0.15 - (i / tiers) * h * 0.85;
    const w = h * 0.32 * (1 - i / tiers * 0.8);
    ctx.moveTo(x - w, ty);
    ctx.lineTo(x, ty - h * 0.3);
    ctx.lineTo(x + w, ty);
  }
  ctx.rect(x - h * 0.03, y - h * 0.16, h * 0.06, h * 0.16);
  ctx.fill();
}

export function forest(ctx, { y, seed, color, h0 = 60, h1 = 120, gap = 22, x0 = -100, x1 = W + 100 }) {
  const r = rng(seed);
  for (let x = x0; x < x1; x += gap * (0.6 + r() * 0.8)) {
    pine(ctx, x, y + r() * 10, lerp(h0, h1, r()), color);
  }
}

export function bamboo(ctx, t, { x, y, h, seed = 1, color = '#3f6b3a', leaf = '#4f8a46', n = 5, spread = 160, wind = 1 }) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * spread, bh = h * (0.7 + r() * 0.4), w = 8 + r() * 6;
    const sw = Math.sin(t * 0.9 + i * 1.7) * 0.025 * wind;
    ctx.save();
    ctx.translate(bx, y);
    ctx.rotate(sw + (r() - 0.5) * 0.08);
    ctx.fillStyle = color;
    const segs = 7;
    for (let s = 0; s < segs; s++) {
      const sy = -bh * s / segs;
      ctx.fillRect(-w / 2, sy - bh / segs + 3, w, bh / segs - 3);
    }
    ctx.fillStyle = leaf;
    for (let l = 0; l < 9; l++) {
      const ly = -bh * (0.35 + r() * 0.65), dir = r() < 0.5 ? -1 : 1;
      const la = dir * (0.9 + r() * 0.6) + Math.sin(t * 2 + l) * 0.06 * wind;
      ctx.save();
      ctx.translate(0, ly);
      ctx.rotate(la);
      ctx.beginPath();
      ctx.ellipse(0, -28, 6, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- byggnader ----------
export function house(ctx, x, y, w, h, { wall = '#2b2420', roof = '#1b1512', window: win = '#ffcf7a', lit = 1, roofH = 0.5, seed = 1, curved = false }) {
  ctx.fillStyle = wall;
  ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  const rh = h * roofH;
  if (curved) {
    ctx.moveTo(x - w * 0.18, y - h + 4);
    ctx.quadraticCurveTo(x + w * 0.1, y - h - rh * 0.25, x + w / 2, y - h - rh);
    ctx.quadraticCurveTo(x + w * 0.9, y - h - rh * 0.25, x + w * 1.18, y - h + 4);
  } else {
    ctx.moveTo(x - w * 0.08, y - h);
    ctx.lineTo(x + w / 2, y - h - rh);
    ctx.lineTo(x + w * 1.08, y - h);
  }
  ctx.fill();
  const r = rng(seed);
  const cols = Math.max(1, Math.floor(w / 46)), rows = Math.max(1, Math.floor(h / 60));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if (r() > 0.6 * lit + 0.1) continue;
    const wx = x + (i + 0.5) * w / cols - 9, wy = y - h + (j + 0.5) * h / rows - 12;
    ctx.fillStyle = win;
    ctx.fillRect(wx, wy, 18, 24);
    addGlow(ctx, wx + 9, wy + 12, 40, win, 0.25 * lit);
  }
}

export function lanternString(ctx, t, { x0, y0, x1, y1, sag = 60, n = 9, colors = ['#ff6b4a', '#ffb347', '#ffd66b'], line = '#1c1410' }) {
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  ctx.stroke();
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const bx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * (x0 + x1) / 2 + u * u * x1;
    const by = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * ((y0 + y1) / 2 + sag * 2) + u * u * y1;
    const sw = Math.sin(t * 1.5 + i) * 3;
    const c = colors[i % colors.length];
    addGlow(ctx, bx + sw, by + 22, 60, c, 0.35);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(bx + sw, by + 22, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = line;
    ctx.fillRect(bx + sw - 6, by + 5, 12, 4);
  }
}

// ---------- havet ----------
export function waveY(x, t, layer) {
  const { base, amp, len, speed, seed } = layer;
  const k = (x / len) + t * speed;
  let v = Math.sin(k * 2 * Math.PI) * 0.5 + Math.sin(k * 2 * Math.PI * 2.3 + 1.3) * 0.25;
  v += fbm(x / len * 1.7 + t * speed * 0.6, seed, 3) * 0.5;
  // skarpare krön
  v = Math.sign(v) * Math.pow(Math.abs(v), 0.8);
  return base - v * amp;
}

export function sea(ctx, t, layers) {
  for (const L of layers) {
    ctx.beginPath();
    ctx.moveTo(-50, H + 50);
    for (let x = -50; x <= W + 50; x += 10) ctx.lineTo(x, waveY(x, t, L));
    ctx.lineTo(W + 50, H + 50);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, L.base - L.amp, 0, L.base + 300);
    g.addColorStop(0, L.top);
    g.addColorStop(1, L.bottom);
    ctx.fillStyle = g;
    ctx.fill();
    if (L.foam) {
      ctx.strokeStyle = rgba('#e8f4f8', L.foam);
      ctx.lineWidth = L.foamW || 3;
      ctx.beginPath();
      let pen = false;
      for (let x = -50; x <= W + 50; x += 10) {
        const y = waveY(x, t, L);
        const crest = y < L.base - L.amp * 0.35;
        if (crest) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
      }
      ctx.stroke();
    }
  }
}

export function boat(ctx, x, y, ang, s, { hull = '#1a1310', sail = '#d9cbb0', light = 0, sailAlpha = 1 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-60, -10);
  ctx.lineTo(60, -14);
  ctx.quadraticCurveTo(50, 12, 30, 14);
  ctx.lineTo(-40, 14);
  ctx.quadraticCurveTo(-55, 6, -60, -10);
  ctx.fill();
  ctx.fillRect(-3, -110, 5, 100);
  ctx.fillRect(-30, -24, 26, 14);
  ctx.fillStyle = rgba(sail, sailAlpha);
  ctx.beginPath();
  ctx.moveTo(4, -105);
  ctx.quadraticCurveTo(40, -60, 48, -18);
  ctx.lineTo(4, -18);
  ctx.closePath();
  ctx.fill();
  if (light) addGlow(ctx, -17, -30, 50, '#ffcc77', light);
  ctx.restore();
}

// ---------- figurer ----------
// Figurer ritas som papperssnitt: lemmar är tjocka, rundade linjer.
// Mått i enheter av figurens längd (1 = huvud till fot).
export const POSE = {
  stand: { hipY: 0.5, lean: 0, thighs: [3, -3], knees: [0, 0], arms: [6, -6], elbows: [8, 8], head: 0 },
  sitFloor: { hipY: 0.09, lean: -2, thighs: [112, 108], knees: [-88, -84], arms: [34, 20], elbows: [40, 30], head: 2 },
  sitStool: { hipY: 0.33, lean: 2, thighs: [86, 82], knees: [-86, -80], arms: [40, 36], elbows: [60, 70], head: 3 },
  meditate: { hipY: 0.1, lean: 0, thighs: [80, -80], knees: [-160, 160], arms: [32, -32], elbows: [-12, 12], head: 0 },
  bow: { hipY: 0.49, lean: 38, thighs: [-6, -10], knees: [6, 6], arms: [20, 14], elbows: [10, 10], head: 10 },
  hold: { hipY: 0.5, lean: 2, thighs: [3, -3], knees: [0, 0], arms: [30, 26], elbows: [70, 74], head: 6 },
  wave: { hipY: 0.5, lean: 0, thighs: [3, -3], knees: [0, 0], arms: [150, -8], elbows: [30, 8], head: -4 },
  reach: { hipY: 0.5, lean: 6, thighs: [4, -4], knees: [0, 0], arms: [70, 10], elbows: [10, 10], head: 4 },
  hug: { hipY: 0.5, lean: 4, thighs: [3, -3], knees: [0, 0], arms: [40, 40], elbows: [100, 100], head: 14 },
  crouch: { hipY: 0.36, lean: 20, thighs: [60, 40], knees: [-90, -80], arms: [30, 10], elbows: [30, 20], head: 0 },
  raise: { hipY: 0.5, lean: -4, thighs: [6, -6], knees: [0, 0], arms: [165, -165], elbows: [5, -5], head: -12 },
  drink: { hipY: 0.33, lean: -4, thighs: [86, 82], knees: [-86, -80], arms: [60, 56], elbows: [120, 124], head: -18 },
};

export function blendPose(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) {
    out[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : lerp(a[k], b[k], t);
  }
  return out;
}

export function walkPose(phase, amt = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  return {
    hipY: 0.5 - Math.abs(c) * 0.01 * amt, lean: 4 * amt,
    thighs: [s * 24 * amt, -s * 24 * amt],
    knees: [Math.max(0, -c) * -38 * amt, Math.max(0, c) * -38 * amt],
    arms: [-s * 22 * amt, s * 22 * amt], elbows: [14, 14], head: 2,
  };
}

const D = Math.PI / 180;

// Stil för olika karaktärer.
export const LOOK = {
  albaWhite: { body: '#f4f1ea', limb: '#e9e4da', limbBack: '#cfc8ba', skin: '#e8c4a6', hair: '#2a1b14', belt: '#9aa3ad', ponytail: true, child: true },
  albaSweater: { body: '#5f6e45', limb: '#5f6e45', limbBack: '#4b5836', legs: '#3d5a80', legsBack: '#2f4766', skin: '#e8c4a6', hair: '#2a1b14', ponytail: true, child: true, knit: true },
  albaNight: { body: '#f4f1ea', limb: '#e9e4da', limbBack: '#cfc8ba', skin: '#e8c4a6', hair: '#2a1b14', ponytail: true, child: true, glow: '#ffffff' },
  haji: { body: '#f0ece3', limb: '#6b4a35', limbBack: '#55392a', legs: '#3a2a20', legsBack: '#2c2018', skin: '#c99a73', hair: '#1f1712', chefHat: true, belly: 1.35, apron: '#f7f4ee' },
  ninjaKing: { body: '#1d1f2b', limb: '#1d1f2b', limbBack: '#14151e', skin: '#c8a07e', hair: '#111', headband: '#b33a2c', broad: 1.15 },
  vida: { body: '#2c3a6b', limb: '#2c3a6b', limbBack: '#222d55', skin: '#e3c2a8', hair: '#d9dde6', robe: '#25325e', bun: true },
  stella: { body: '#4a7bc4', limb: '#4a7bc4', limbBack: '#3a63a0', legs: '#2c3550', skin: '#f0cfb4', hair: '#e8c46a', longHair: true, child: true },
  gero: { body: '#b8442f', limb: '#b8442f', limbBack: '#943523', legs: '#2e2b33', skin: '#d6a882', hair: '#7a2c18', spiky: true, child: true },
  adrian: { body: '#3f7d5a', limb: '#3f7d5a', limbBack: '#316348', legs: '#2b3038', skin: '#b98563', hair: '#1c1714', child: true, tall: 1.06 },
  shadow: { body: '#0d0b10', limb: '#0d0b10', limbBack: '#0d0b10', skin: '#0d0b10', hair: '#0d0b10' },
  fisher: { body: '#0d0b10', limb: '#0d0b10', limbBack: '#0d0b10', skin: '#0d0b10', hair: '#0d0b10', coat: '#0d0b10', souwester: true, broad: 1.2 },
  elder: { body: '#0d0b10', limb: '#0d0b10', limbBack: '#0d0b10', skin: '#0d0b10', hair: '#0d0b10', coat: '#0d0b10', shawl: true, broad: 1.1 },
};

// Ritar en figur med fötterna i (x, y). h = längd i pixlar, f = 1 (höger) eller -1.
export function figure(ctx, x, y, h, look, pose, { f = 1, alpha = 1, staff = false, bowl = false, key = false, hood = false, front = false, extra = null } = {}) {
  const L = look;
  const sc = h * (L.tall || 1);
  const child = L.child;
  const headR = (child ? 0.085 : 0.072) * sc;
  const torsoLen = (child ? 0.28 : 0.3) * sc;
  const thigh = 0.25 * sc, shin = 0.24 * sc;
  const upper = 0.16 * sc, fore = 0.15 * sc;
  const shoulderW = 0.085 * sc * (L.broad || 1), hipW = 0.05 * sc;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(f, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hip = [0, -pose.hipY * sc];
  const lean = pose.lean * D;
  const neck = [hip[0] + Math.sin(lean) * torsoLen, hip[1] - Math.cos(lean) * torsoLen];
  const sh = (side) => [neck[0] + side * shoulderW * 0.35 * Math.cos(lean) - Math.sin(lean) * 4, neck[1] + 0.02 * sc + side * shoulderW * 0.35 * Math.sin(lean)];

  const limb = (from, a1, a2, l1, l2, w1, w2, c1, c2) => {
    const k = [from[0] + Math.sin(a1 * D) * l1, from[1] + Math.cos(a1 * D) * l1];
    const e = [k[0] + Math.sin((a1 + a2) * D) * l2, k[1] + Math.cos((a1 + a2) * D) * l2];
    ctx.strokeStyle = c1; ctx.lineWidth = w1;
    ctx.beginPath(); ctx.moveTo(...from); ctx.lineTo(...k); ctx.stroke();
    ctx.strokeStyle = c2; ctx.lineWidth = w2;
    ctx.beginPath(); ctx.moveTo(...k); ctx.lineTo(...e); ctx.stroke();
    return e;
  };

  const legC = L.legs || L.limb, legBack = L.legsBack || L.limbBack;
  const armW = 0.055 * sc, legW = 0.075 * sc;

  // stav på ryggen
  if (staff) {
    ctx.save();
    ctx.translate(neck[0] - 0.03 * sc, neck[1] + 0.12 * sc);
    ctx.rotate(-0.5 + lean);
    ctx.fillStyle = '#6b4f3a';
    ctx.fillRect(-0.012 * sc, -0.42 * sc, 0.024 * sc, 0.6 * sc);
    ctx.fillStyle = '#c7d3dc';
    ctx.beginPath(); ctx.arc(0, -0.45 * sc, 0.045 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-0.012 * sc, -0.462 * sc, 0.015 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // hästsvans bakom
  const headC = [neck[0] + Math.sin(lean + pose.head * D) * headR * 1.25, neck[1] - Math.cos(lean + pose.head * D) * headR * 1.25];
  if (L.ponytail) {
    ctx.strokeStyle = L.hair; ctx.lineWidth = headR * 0.55;
    ctx.beginPath();
    ctx.moveTo(headC[0] - headR * 0.6, headC[1] - headR * 0.5);
    ctx.quadraticCurveTo(headC[0] - headR * 1.8, headC[1] + headR * 0.2, headC[0] - headR * 1.3, headC[1] + headR * 1.9);
    ctx.stroke();
  }
  if (L.longHair) {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(headC[0] - headR * 0.2, headC[1] + headR * 0.9, headR * 1.05, headR * 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // bakre arm och ben
  limb(sh(-1), pose.arms[1], pose.elbows[1], upper, fore, armW, armW * 0.9, L.limbBack, L.limbBack);
  limb([hip[0] - hipW * 0.3, hip[1]], pose.thighs[1], pose.knees[1], thigh, shin, legW, legW * 0.85, legBack, legBack);
  // kropp
  ctx.fillStyle = L.body;
  ctx.beginPath();
  const bw = shoulderW * (L.belly || 1);
  const perp = [Math.cos(lean), Math.sin(lean)];
  ctx.moveTo(neck[0] - perp[0] * shoulderW, neck[1] - perp[1] * shoulderW + 0.01 * sc);
  ctx.lineTo(neck[0] + perp[0] * shoulderW, neck[1] + perp[1] * shoulderW + 0.01 * sc);
  ctx.quadraticCurveTo(hip[0] + perp[0] * bw * 1.15 + Math.sin(lean) * torsoLen * 0.5, hip[1] - Math.cos(lean) * torsoLen * 0.5, hip[0] + perp[0] * hipW * 1.4, hip[1] + perp[1] * hipW + 0.03 * sc);
  ctx.lineTo(hip[0] - perp[0] * hipW * 1.4, hip[1] - perp[1] * hipW + 0.03 * sc);
  ctx.quadraticCurveTo(hip[0] - perp[0] * bw * 1.15 + Math.sin(lean) * torsoLen * 0.5, hip[1] - Math.cos(lean) * torsoLen * 0.5, neck[0] - perp[0] * shoulderW, neck[1] - perp[1] * shoulderW + 0.01 * sc);
  ctx.fill();
  if (L.knit) {
    ctx.strokeStyle = rgba('#3f4a2c', 0.6); ctx.lineWidth = 0.008 * sc;
    for (let i = 1; i < 6; i++) {
      const u = i / 6;
      const cx = lerp(neck[0], hip[0], u), cy = lerp(neck[1], hip[1], u);
      ctx.beginPath();
      ctx.moveTo(cx - perp[0] * shoulderW * 0.8, cy - perp[1] * shoulderW * 0.8);
      ctx.lineTo(cx + perp[0] * shoulderW * 0.8, cy + perp[1] * shoulderW * 0.8);
      ctx.stroke();
    }
  }
  if (L.apron) {
    ctx.fillStyle = L.apron;
    ctx.beginPath();
    const ax = lerp(neck[0], hip[0], 0.3), ay = lerp(neck[1], hip[1], 0.3);
    ctx.moveTo(ax - shoulderW * 0.6, ay);
    ctx.lineTo(ax + shoulderW * 0.6, ay);
    ctx.lineTo(hip[0] + shoulderW * 0.9, hip[1] + 0.18 * sc);
    ctx.lineTo(hip[0] - shoulderW * 0.9, hip[1] + 0.18 * sc);
    ctx.fill();
  }
  if (L.belt) {
    ctx.strokeStyle = L.belt; ctx.lineWidth = 0.022 * sc;
    const bx = lerp(neck[0], hip[0], 0.82), by = lerp(neck[1], hip[1], 0.82);
    ctx.beginPath();
    ctx.moveTo(bx - perp[0] * shoulderW * 0.75, by - perp[1] * shoulderW * 0.75);
    ctx.lineTo(bx + perp[0] * shoulderW * 0.75, by + perp[1] * shoulderW * 0.75);
    ctx.stroke();
  }
  if (L.robe) {
    ctx.fillStyle = L.robe;
    ctx.beginPath();
    ctx.moveTo(hip[0] - hipW * 2, hip[1] - 0.05 * sc);
    ctx.lineTo(hip[0] + hipW * 2, hip[1] - 0.05 * sc);
    ctx.lineTo(hip[0] + 0.16 * sc, 0);
    ctx.lineTo(hip[0] - 0.16 * sc, 0);
    ctx.fill();
  }
  // främre ben och arm
  if (!L.robe) limb([hip[0] + hipW * 0.3, hip[1]], pose.thighs[0], pose.knees[0], thigh, shin, legW, legW * 0.85, legC, legC);
  if (L.coat) {
    // rock som går ned över låren och följer kroppens lutning
    const kx = hip[0] + Math.sin((pose.thighs[0] + pose.thighs[1]) / 2 * D) * thigh * 0.85;
    const ky = hip[1] + Math.cos((pose.thighs[0] + pose.thighs[1]) / 2 * D) * thigh * 0.85;
    const dx = ky - hip[1], dy = -(kx - hip[0]), dl = Math.hypot(dx, dy) || 1;
    const hw = 0.11 * sc;
    ctx.fillStyle = L.coat;
    ctx.beginPath();
    ctx.moveTo(neck[0] - perp[0] * shoulderW * 1.05, neck[1] - perp[1] * shoulderW * 1.05 + 0.01 * sc);
    ctx.lineTo(neck[0] + perp[0] * shoulderW * 1.05, neck[1] + perp[1] * shoulderW * 1.05 + 0.01 * sc);
    ctx.lineTo(kx + dx / dl * hw, ky + dy / dl * hw);
    ctx.lineTo(kx - dx / dl * hw, ky - dy / dl * hw);
    ctx.closePath();
    ctx.fill();
  }
  const hand = limb(sh(1), pose.arms[0], pose.elbows[0], upper, fore, armW, armW * 0.9, L.limb, L.limb);
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(hand[0], hand[1], armW * 0.55, 0, Math.PI * 2); ctx.fill();
  if (bowl) {
    ctx.fillStyle = '#8c5a3c';
    ctx.beginPath();
    ctx.ellipse(hand[0] + 0.03 * sc, hand[1] - 0.01 * sc, 0.07 * sc, 0.03 * sc, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#d98f4a';
    ctx.beginPath();
    ctx.ellipse(hand[0] + 0.03 * sc, hand[1] - 0.01 * sc, 0.07 * sc, 0.012 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (key) {
    addGlow(ctx, hand[0], hand[1] - 0.04 * sc, 0.12 * sc, '#ffe7a3', 0.8);
    ctx.strokeStyle = '#ffe7a3'; ctx.lineWidth = 0.012 * sc;
    ctx.beginPath(); ctx.arc(hand[0], hand[1] - 0.07 * sc, 0.022 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1] - 0.048 * sc); ctx.lineTo(hand[0], hand[1] + 0.03 * sc);
    ctx.lineTo(hand[0] + 0.02 * sc, hand[1] + 0.03 * sc); ctx.stroke();
  }
  // huvud
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(headC[0], headC[1], headR, 0, Math.PI * 2); ctx.fill();
  // hår
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.arc(headC[0] - headR * 0.08, headC[1] - headR * 0.1, headR * 1.02, Math.PI * 0.85, Math.PI * 2.05);
  ctx.quadraticCurveTo(headC[0] + headR * 0.4, headC[1] - headR * 0.35, headC[0] - headR * 0.5, headC[1] + headR * 0.2);
  ctx.fill();
  if (L.spiky) {
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.0 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(headC[0] + Math.cos(a - 0.2) * headR, headC[1] + Math.sin(a - 0.2) * headR);
      ctx.lineTo(headC[0] + Math.cos(a) * headR * 1.5, headC[1] + Math.sin(a) * headR * 1.5);
      ctx.lineTo(headC[0] + Math.cos(a + 0.2) * headR, headC[1] + Math.sin(a + 0.2) * headR);
      ctx.fill();
    }
  }
  if (L.bun) {
    ctx.beginPath(); ctx.arc(headC[0] - headR * 0.7, headC[1] - headR * 0.8, headR * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  if (L.headband) {
    ctx.strokeStyle = L.headband; ctx.lineWidth = headR * 0.3;
    ctx.beginPath(); ctx.arc(headC[0], headC[1], headR * 0.98, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headC[0] - headR, headC[1] - headR * 0.3);
    ctx.quadraticCurveTo(headC[0] - headR * 1.8, headC[1] - headR * 0.1, headC[0] - headR * 2.2, headC[1] + headR * 0.6);
    ctx.stroke();
  }
  if (L.chefHat) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(headC[0] - headR * 0.85, headC[1] - headR * 1.9, headR * 1.7, headR * 1.1);
    ctx.beginPath(); ctx.arc(headC[0] - headR * 0.5, headC[1] - headR * 2.0, headR * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headC[0] + headR * 0.4, headC[1] - headR * 2.1, headR * 0.65, 0, Math.PI * 2); ctx.fill();
  }
  if (L.souwester) {
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.arc(headC[0], headC[1] - headR * 0.1, headR * 1.08, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(headC[0] - headR * 2.0, headC[1] + headR * 0.55);
    ctx.quadraticCurveTo(headC[0] - headR * 0.4, headC[1] - headR * 0.25, headC[0] + headR * 1.7, headC[1] - headR * 0.05);
    ctx.lineTo(headC[0] + headR * 1.6, headC[1] + headR * 0.15);
    ctx.quadraticCurveTo(headC[0] - headR * 0.4, headC[1] + headR * 0.05, headC[0] - headR * 2.0, headC[1] + headR * 0.75);
    ctx.fill();
  }
  if (L.shawl) {
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.arc(headC[0] - headR * 0.1, headC[1] - headR * 0.05, headR * 1.25, Math.PI * 0.75, Math.PI * 2.1); ctx.fill();
  }
  if (hood) {
    ctx.fillStyle = L.body;
    ctx.beginPath(); ctx.arc(headC[0], headC[1], headR * 1.25, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  }
  // en liten näsa åt blickriktningen ger profil
  ctx.fillStyle = L.skin;
  if (!front) {
    ctx.beginPath(); ctx.arc(headC[0] + headR * 0.92, headC[1] + headR * 0.12, headR * 0.16, 0, Math.PI * 2); ctx.fill();
  }
  if (extra) extra(ctx, { headC, headR, neck, hip, hand, sc });
  ctx.restore();
  return { head: [x + headC[0] * f, y + headC[1]], hand: [x + hand[0] * f, y + hand[1]], neck: [x + neck[0] * f, y + neck[1]] };
}

// ---------- text ----------
export function title(ctx, text, x, y, { font, color = '#f6e7c1', alpha = 1, glowColor = '#ffcf7a', glowA = 0.6, size = 120, spacing = 0 }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  ctx.shadowColor = rgba(glowColor, glowA);
  ctx.shadowBlur = size * 0.4;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Hjälp: vilken replik som pågår (eller senast startade) i en scen.
export function lineInfo(scene, T) {
  let idx = -1;
  for (let i = 0; i < scene.lines.length; i++) if (scene.lines[i].start <= T) idx = i;
  const L = scene.lines[idx];
  return { idx, line: L, since: L ? T - L.start : 0, speaking: L ? T < L.end : false };
}
// Lokal tid (sekunder från scenens början) då replik i börjar.
export const lineStart = (scene, i) => (scene.lines[Math.max(0, Math.min(i, scene.lines.length - 1))]?.start ?? scene.start) - scene.start;
export const lineEnd = (scene, i) => (scene.lines[Math.max(0, Math.min(i, scene.lines.length - 1))]?.end ?? scene.end) - scene.start;
// Lokal tid då den första undertexten som innehåller ordet börjar (eller fallback).
export function cueAt(scene, needle, fallback = 0) {
  const c = (scene.cues || []).find(c => c.text.toLowerCase().includes(needle.toLowerCase()));
  return c ? c.start - scene.start : fallback;
}
