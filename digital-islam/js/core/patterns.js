/**
 * Procedural textures. Everything the app looks like is drawn at runtime on a
 * canvas — no image files to download, so it works offline and stays small.
 */

import * as THREE from 'three';

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, repeat = 1, { srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The classic eight-point star and cross tiling (khatam), drawn as a seamless
 * tile by mirroring a quarter cell.
 */
export function starPatternTexture({
  size = 512, cells = 4, background = '#123028', line = '#d8b46a',
  accent = 'rgba(216,180,106,0.14)', lineWidth = 3,
} = {}) {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  const step = size / cells;
  ctx.strokeStyle = line;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';

  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const x = cx * step + step / 2;
      const y = cy * step + step / 2;
      const r = step * 0.46;

      // Eight-point star: two squares, one rotated 45°.
      for (const rotation of [0, Math.PI / 4]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Interlace lines linking the stars.
      ctx.beginPath();
      ctx.moveTo(x - step / 2, y);
      ctx.lineTo(x + step / 2, y);
      ctx.moveTo(x, y - step / 2);
      ctx.lineTo(x, y + step / 2);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  return toTexture(canvas);
}

/** Marble-ish surface for floors and columns. */
export function marbleTexture({ size = 512, base = '#e9e4d8', vein = 'rgba(120,120,120,0.28)' } = {}) {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = vein;
  for (let i = 0; i < 40; i++) {
    ctx.lineWidth = Math.random() * 2.5 + 0.4;
    ctx.globalAlpha = 0.15 + Math.random() * 0.4;
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (Math.random() - 0.5) * size * 0.22;
      y += (Math.random() - 0.5) * size * 0.22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas, 3);
}

/**
 * A prayer mat: a woven field with a mihrab arch pointing towards the Qibla,
 * a border of geometric motifs, and a niche lamp.
 */
export function prayerMatTexture({ width = 640, height = 1024, palette } = {}) {
  const colors = palette || {
    field: '#0f3a2e', border: '#7d1f2b', arch: '#2c7d64',
    line: '#e0c27f', accent: '#f0d9a0', lamp: '#ffeec2',
  };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = colors.border;
  ctx.fillRect(0, 0, width, height);

  const m = width * 0.09;
  ctx.fillStyle = colors.field;
  ctx.fillRect(m, m, width - 2 * m, height - 2 * m);

  // Woven texture.
  ctx.globalAlpha = 0.06;
  for (let y = m; y < height - m; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? '#000' : '#fff';
    ctx.fillRect(m, y, width - 2 * m, 1.4);
  }
  ctx.globalAlpha = 1;

  // Border motif.
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 4;
  ctx.strokeRect(m * 0.55, m * 0.55, width - m * 1.1, height - m * 1.1);
  ctx.strokeRect(m, m, width - 2 * m, height - 2 * m);
  ctx.lineWidth = 2;
  const notches = 26;
  for (let i = 0; i < notches; i++) {
    const t = i / notches;
    const y = m + t * (height - 2 * m);
    ctx.beginPath();
    ctx.moveTo(m * 0.55, y); ctx.lineTo(m, y);
    ctx.moveTo(width - m * 0.55, y); ctx.lineTo(width - m, y);
    ctx.stroke();
  }

  // Mihrab arch, pointing to the top of the mat.
  const archW = width * 0.58;
  const archX = (width - archW) / 2;
  const archTop = height * 0.16;
  const archBottom = height * 0.72;
  ctx.beginPath();
  ctx.moveTo(archX, archBottom);
  ctx.lineTo(archX, archTop + archW * 0.42);
  ctx.quadraticCurveTo(archX, archTop, archX + archW / 2, archTop - archW * 0.06);
  ctx.quadraticCurveTo(archX + archW, archTop, archX + archW, archTop + archW * 0.42);
  ctx.lineTo(archX + archW, archBottom);
  ctx.closePath();
  ctx.fillStyle = colors.arch;
  ctx.fill();
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 9;
  ctx.stroke();

  // Hanging lamp inside the niche.
  const lampX = width / 2;
  const lampY = archTop + archW * 0.42;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lampX, archTop + 6);
  ctx.lineTo(lampX, lampY - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(lampX, lampY, archW * 0.13, archW * 0.17, 0, 0, Math.PI * 2);
  ctx.fillStyle = colors.lamp;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();

  // Small stars filling the field below the arch.
  ctx.strokeStyle = 'rgba(216,180,106,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const x = width * (0.28 + j * 0.22);
      const y = height * (0.78 + i * 0.035);
      drawStar(ctx, x, y, 10, 8);
    }
  }

  // Head and hand marks, so the mat teaches where to place yourself.
  ctx.setLineDash([8, 10]);
  ctx.strokeStyle = 'rgba(216,180,106,0.35)';
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.34, width * 0.11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width * 0.27, height * 0.44, width * 0.07, 0, Math.PI * 2);
  ctx.arc(width * 0.73, height * 0.44, width * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function drawStar(ctx, cx, cy, points, radius) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();
}

/** Tooled leather with a gold medallion, for the Qur'an binding. */
export function bookCoverTexture({ size = 1024, base = '#3d2418', gold = '#d8b46a' } = {}) {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Leather grain.
  const grain = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  ctx.strokeRect(size * 0.07, size * 0.07, size * 0.86, size * 0.86);
  ctx.lineWidth = 2;
  ctx.strokeRect(size * 0.10, size * 0.10, size * 0.80, size * 0.80);

  // Central medallion.
  const cx = size / 2, cy = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.16, size * 0.045, size * 0.12, 0, 0, Math.PI * 2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(216,180,106,0.18)';
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = gold;
  ctx.font = `400 ${Math.round(size * 0.085)}px Amiri, "Noto Naskh Arabic", serif`;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText('ٱلْقُرْآن ٱلْكَرِيم', cx, size * 0.83);
  return toTexture(canvas);
}

/** Aged paper for the pages. */
export function paperTexture({ size = 512 } = {}) {
  const { canvas, ctx } = makeCanvas(size);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#fbf5e4');
  gradient.addColorStop(0.5, '#f5ecd6');
  gradient.addColorStop(1, '#efe3c8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#8a7350' : '#ffffff';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Night sky with stars and a crescent, used as a scene background. */
export function nightSkyTexture({ width = 2048, height = 1024 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#050b16');
  gradient.addColorStop(0.55, '#0b1c2e');
  gradient.addColorStop(1, '#132a33');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.75;
    const r = Math.random() * 1.6;
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    ctx.fillStyle = Math.random() > 0.85 ? '#ffe9c0' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Crescent moon.
  const mx = width * 0.7, my = height * 0.22, mr = 46;
  ctx.fillStyle = '#f6efd8';
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.2, mr * 0.92, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

/** Daytime sky: warm horizon fading to deep blue. */
export function daySkyTexture({ width = 2048, height = 1024, dusk = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (dusk) {
    gradient.addColorStop(0, '#1b2a4a');
    gradient.addColorStop(0.55, '#7d4b52');
    gradient.addColorStop(0.8, '#e0895a');
    gradient.addColorStop(1, '#f4c47c');
  } else {
    gradient.addColorStop(0, '#2a6fb0');
    gradient.addColorStop(0.6, '#8fc0dd');
    gradient.addColorStop(1, '#e8dfc4');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

/** Calligraphy strip used along walls and around the dome. */
export function calligraphyBandTexture(text, { width = 2048, height = 256, color = '#d8b46a', background = 'rgba(11,26,22,0.9)' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.font = `400 ${Math.round(height * 0.55)}px Amiri, "Noto Naskh Arabic", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(text, width / 2, height / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, 12); ctx.lineTo(width, 12);
  ctx.moveTo(0, height - 12); ctx.lineTo(width, height - 12);
  ctx.stroke();
  return toTexture(canvas, 1);
}
