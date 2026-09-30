// Procedurella texturer – ritas i canvas vid start så att spelet fungerar helt offline.
import * as THREE from '../vendor/three.module.min.js';

// Deterministisk 3D-värdebrus.
function hash(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * (3 - 2 * t);
function noise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
function fbm(x, y, z, seed, oct = 5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f, seed + i * 17);
    n += a; a *= 0.5; f *= 2.03;
  }
  return s / n;
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];

// Ritar en ekvirektangulär textur genom att sampla en funktion på enhetssfären.
function sphereTexture(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cy = Math.sin(lat), cr = Math.cos(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cr * Math.cos(lon), z = cr * Math.sin(lon);
      const c = fn(x, cy, z, lat);
      const k = (j * w + i) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function craters(x, y, z, seed, scale) {
  // Enkla kratrar: celler med mörk kant och ljus mitt.
  const n = fbm(x * scale, y * scale, z * scale, seed, 3);
  const r = Math.abs(n - 0.5) * 2;
  return r < 0.08 ? 0.75 : r < 0.12 ? 1.15 : 1;
}

const PAINTERS = {
  earth(x, y, z, lat) {
    const n = fbm(x * 2.2, y * 2.2, z * 2.2, 11, 6);
    const polar = Math.abs(lat) > 1.2 + (n - 0.5) * 0.3;
    let c;
    if (polar) c = [240, 245, 250];
    else if (n > 0.53) {
      const m = fbm(x * 6, y * 6, z * 6, 5, 3);
      c = mixc([70, 130, 60], [150, 130, 80], clamp((m - 0.4) * 2.5));
      if (Math.abs(lat) < 0.35 && m > 0.55) c = [196, 170, 110];
    } else c = mixc([12, 40, 110], [30, 90, 170], clamp((n - 0.3) * 4));
    const cl = fbm(x * 3.5 + 7, y * 7, z * 3.5, 99, 5);
    if (cl > 0.56) c = mixc(c, [255, 255, 255], clamp((cl - 0.56) * 5));
    return c;
  },
  moon(x, y, z) {
    const n = fbm(x * 3, y * 3, z * 3, 3, 6);
    const maria = fbm(x * 1.2, y * 1.2, z * 1.2, 8, 3) > 0.56 ? 0.62 : 1;
    const v = (110 + n * 90) * maria * craters(x, y, z, 21, 9);
    return [v, v, v * 0.97];
  },
  mercury(x, y, z) {
    const n = fbm(x * 3, y * 3, z * 3, 31, 6);
    const v = (100 + n * 80) * craters(x, y, z, 41, 10);
    return [v * 1.05, v * 0.98, v * 0.9];
  },
  mars(x, y, z, lat) {
    const n = fbm(x * 2.5, y * 2.5, z * 2.5, 7, 6);
    let c = mixc([120, 45, 20], [210, 110, 60], n);
    if (fbm(x * 1.5, y * 1.5, z * 1.5, 9, 3) > 0.58) c = mixc(c, [80, 35, 25], 0.5);
    if (Math.abs(lat) > 1.35) c = [235, 225, 215];
    const cr = craters(x, y, z, 13, 8);
    return [c[0] * cr, c[1] * cr, c[2] * cr];
  },
  venus(x, y, z) {
    const n = fbm(x * 1.5 + y * 2, y * 5, z * 1.5, 17, 6);
    return mixc([200, 150, 80], [250, 225, 160], n);
  },
  jupiter(x, y, z, lat) {
    const turb = fbm(x * 3, y * 3, z * 3, 23, 4) * 0.35;
    const b = Math.sin((y + turb * 0.4) * 22);
    let c = b > 0 ? mixc([225, 200, 165], [245, 230, 205], b) : mixc([180, 120, 80], [210, 160, 120], -b);
    // Stora röda fläcken
    const dx = Math.atan2(z, x) - 0.9, dy = lat + 0.38;
    const e = (dx * dx) / 0.05 + (dy * dy) / 0.012;
    if (e < 1) c = mixc([200, 90, 60], c, e * e);
    return c;
  },
  saturn(x, y, z) {
    const turb = fbm(x * 2, y * 2, z * 2, 29, 3) * 0.2;
    const b = Math.sin((y + turb * 0.3) * 18);
    return mixc([200, 170, 115], [240, 220, 170], b * 0.5 + 0.5);
  },
  uranus(x, y, z) {
    const b = Math.sin(y * 8 + fbm(x, y, z, 5, 2)) * 0.5 + 0.5;
    return mixc([140, 210, 220], [170, 230, 235], b * 0.5);
  },
  neptune(x, y, z) {
    const b = Math.sin((y + fbm(x * 2, y * 2, z * 2, 3, 3) * 0.2) * 12) * 0.5 + 0.5;
    let c = mixc([40, 70, 190], [80, 120, 230], b);
    const n = fbm(x * 4, y * 8, z * 4, 77, 4);
    if (n > 0.66) c = mixc(c, [230, 240, 255], (n - 0.66) * 4);
    return c;
  },
  pluto(x, y, z) {
    const n = fbm(x * 3, y * 3, z * 3, 61, 5);
    let c = mixc([150, 110, 80], [230, 210, 185], n);
    // Hjärtat (Tombaugh Regio)
    const lon = Math.atan2(z, x);
    const hx = (lon - 1.4) * 1.6, hy = y * 1.6 + 0.1;
    const heart = (hx * hx + hy * hy - 0.3) ** 3 - hx * hx * hy ** 3;
    if (heart < 0) c = [245, 238, 230];
    return c;
  },
  sun(x, y, z) {
    const n = fbm(x * 6, y * 6, z * 6, 1, 5);
    return mixc([255, 150, 20], [255, 240, 150], n);
  },
};

const cache = new Map();
export function planetTexture(id, size = 512) {
  if (!PAINTERS[id]) return null;
  const key = id + size;
  if (!cache.has(key)) cache.set(key, sphereTexture(size, size / 2, PAINTERS[id]));
  return cache.get(key);
}

export function cloudTexture(size = 512) {
  const key = 'clouds' + size;
  if (!cache.has(key)) {
    // Molnlagret ritas som vitt med alfa i en separat canvas.
    const tex = sphereTexture(size, size / 2, (x, y, z) => {
      const cl = fbm(x * 3.5 + 7, y * 7, z * 3.5, 99, 5);
      const v = clamp((cl - 0.52) * 4) * 255;
      return [v, v, v];
    });
    cache.set(key, tex);
  }
  return cache.get(key);
}

export function ringTexture() {
  if (cache.has('ring')) return cache.get('ring');
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 8;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 512; i++) {
    const t = i / 512;
    const n = noise3(t * 60, 0, 0, 5) * 0.6 + noise3(t * 200, 1, 0, 9) * 0.4;
    let a = 0.25 + n * 0.75;
    if (t > 0.58 && t < 0.63) a *= 0.1; // Cassinidelningen
    if (t < 0.05 || t > 0.97) a *= 0.2;
    const c = mixc([180, 160, 120], [240, 225, 190], n);
    ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
    ctx.fillRect(i, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('ring', tex);
  return tex;
}

export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,160,40,0)') {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Liten brus-hjälpare för andra moduler (t.ex. asteroider).
export { fbm };
