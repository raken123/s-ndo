// Scener: gongen → eftertexten (andra halvan av filmen).
import {
  W, H, clamp, lerp, smooth, ease, ramp, window_, rng, fbm, mix, rgba, cached,
  sky, glow, addGlow, tint, ridge, clouds, cloud, stars, fallingLeaves, sparks, steam,
  tree, forest, bamboo, POSE, blendPose, walkPose, LOOK, figure, title,
  lineInfo, lineStart, lineEnd, cueAt,
} from './lib.mjs';
import { layer, masked, camera, FONT } from './stage.mjs';
import { roomBackdrop, parkScene } from './scenes1.mjs';

const GOLD = { body: '#e8c98a', limb: '#e8c98a', limbBack: '#cfae6a', skin: '#e8c98a', hair: '#e8c98a', headband: '#f3dca8', broad: 1.15 };
const MOTHER = { ...LOOK.albaWhite, child: false, glow: '#ffffff' };

// ---------------------------------------------------------------- Ninjali utomhus (huset, spången, Tysta salen)
function ninjali(ctx, t, { camX = 0, door = 0, shadow = null, alba = null, birds = 0 }) {
  sky(ctx, [[0, '#9fbdd4'], [0.6, '#e4ddca'], [1, '#f4e3c2']]);
  addGlow(ctx, 1500 - camX * 0.1, 260, 600, '#fff1c8', 0.45);
  ctx.drawImage(cached('ninjali-bak', W * 2, H, c => {
    ridge(c, { y: 470, amp: 110, freq: 0.0018, seed: 201, color: '#a7b4bf', x1: W * 2 + 200, sharp: 0.4 });
    ridge(c, { y: 540, amp: 60, freq: 0.003, seed: 202, color: '#8d9a92', x1: W * 2 + 200 });
    forest(c, { y: 600, seed: 203, color: '#6c7a64', h0: 40, h1: 90, gap: 22, x1: W * 2 + 100 });
    const r = rng(204);
    for (let i = 0; i < 16; i++) tree(c, 60 + i * 250 + r() * 80, 650, { size: 220 + r() * 80, seed: 205 + i, trunk: '#5a4030', leaves: ['#e8a33d', '#d9652a', '#c0392b', '#f0c050'], leafAlpha: 0.85 });
  }), -camX * 0.35, 0);
  // fåglar
  if (birds > 0) {
    ctx.strokeStyle = rgba('#2a2a2a', birds);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const bx = ((t * 160 + i * 70) % (W + 400)) - 200 + (i % 2) * 30, by = 200 + i * 18 + Math.sin(t * 2 + i) * 10;
      const fl = Math.sin(t * 12 + i * 1.3) * 10;
      ctx.beginPath(); ctx.moveTo(bx - 16, by - fl); ctx.quadraticCurveTo(bx - 6, by - 6, bx, by); ctx.quadraticCurveTo(bx + 6, by - 6, bx + 16, by - fl); ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(-camX, 0);
  // bäcken
  const g = ctx.createLinearGradient(0, 820, 0, 920);
  g.addColorStop(0, '#7f9fae'); g.addColorStop(1, '#4b6875');
  ctx.fillStyle = g; ctx.fillRect(-200, 820, 4400, 110);
  ctx.strokeStyle = rgba('#ffffff', 0.3); ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 137 + t * 40) % 4400) - 200, y = 840 + (i % 5) * 16;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 50, y); ctx.stroke();
  }
  // Tysta salen långt bort till höger
  ctx.drawImage(cached('ninjali-salen', 1000, 700, c => {
    c.fillStyle = '#6d6a66'; c.fillRect(60, 560, 880, 80);
    c.fillStyle = '#4a2f22'; c.fillRect(140, 300, 720, 270);
    c.fillStyle = '#2a1a14';
    for (let i = 0; i < 7; i++) c.fillRect(150 + i * 115, 300, 18, 270);
    c.fillStyle = '#efe3c8';
    for (let i = 0; i < 6; i++) c.fillRect(175 + i * 115, 360, 88, 160);
    c.fillStyle = '#2a1d18';
    c.beginPath(); c.moveTo(20, 310); c.quadraticCurveTo(220, 270, 500, 110); c.quadraticCurveTo(780, 270, 980, 310); c.lineTo(980, 330); c.lineTo(20, 330); c.fill();
    c.beginPath(); c.moveTo(250, 160); c.quadraticCurveTo(380, 130, 500, 40); c.quadraticCurveTo(620, 130, 750, 160); c.lineTo(750, 175); c.lineTo(250, 175); c.fill();
  }), 3050, 220);
  // huset
  ctx.drawImage(cached('ninjali-hus', 1200, 800, c => {
    c.fillStyle = '#2b1d15'; c.fillRect(120, 580, 960, 26);
    for (let i = 0; i < 6; i++) c.fillRect(150 + i * 180, 600, 20, 140);
    c.fillStyle = '#4a3226'; c.fillRect(160, 250, 880, 335);
    c.fillStyle = '#2a1a12';
    c.beginPath(); c.moveTo(60, 270); c.quadraticCurveTo(300, 230, 600, 70); c.quadraticCurveTo(900, 230, 1140, 270); c.lineTo(1140, 300); c.lineTo(60, 300); c.fill();
  }), 100, 180);
  // rispappersdörren (två skjutbara paneler)
  const dx = 520, dy = 480, dw = 360, dh = 280;
  ctx.fillStyle = '#2a1c14';
  ctx.fillRect(dx, dy, dw, dh);
  addGlow(ctx, dx + dw / 2, dy + dh / 2, 200, '#ffd99a', 0.25 * door);
  const panel = (px) => {
    ctx.fillStyle = '#f1e4c6'; ctx.fillRect(px, dy, dw / 2, dh);
    ctx.fillStyle = '#3a2618';
    for (let i = 0; i <= 3; i++) ctx.fillRect(px + i * dw / 6 - 3, dy, 6, dh);
    for (let j = 0; j <= 4; j++) ctx.fillRect(px, dy + j * dh / 4 - 3, dw / 2, 6);
  };
  panel(dx);
  // skugga av Alba bakom papperet
  if (shadow) {
    ctx.save();
    ctx.beginPath(); ctx.rect(dx, dy, dw / 2, dh); ctx.clip();
    figure(ctx, shadow.x, dy + dh - 4, 250, LOOK.shadow, shadow.pose, { f: shadow.f, alpha: 0.4 });
    ctx.restore();
  }
  panel(dx + dw / 2 + door * dw / 2 * 0.98);
  ctx.fillStyle = '#4a3226'; ctx.fillRect(dx + dw, dy, dw / 2, dh);
  // spången med rep
  ctx.fillStyle = '#5a3f2b'; ctx.fillRect(900, 790, 2500, 22);
  ctx.fillStyle = '#3e2a1c';
  for (let x = 920; x < 3400; x += 140) { ctx.fillRect(x, 700, 12, 100); ctx.fillRect(x, 810, 12, 100); }
  ctx.strokeStyle = '#c8b28a'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 920; x < 3260; x += 140) { ctx.moveTo(x + 6, 708); ctx.quadraticCurveTo(x + 76, 730, x + 146, 708); }
  ctx.stroke();
  // bambu
  bamboo(ctx, t, { x: 1250, y: 820, h: 620, seed: 211, n: 5, spread: 160 });
  bamboo(ctx, t, { x: 1900, y: 820, h: 560, seed: 212, n: 6, spread: 200 });
  bamboo(ctx, t, { x: 2600, y: 820, h: 600, seed: 213, n: 5, spread: 180 });
  if (alba) figure(ctx, alba.x, alba.y ?? 790, 260, alba.look ?? LOOK.albaWhite, alba.pose, { f: alba.f, staff: alba.staff });
  // förgrund
  bamboo(ctx, t, { x: 40, y: 1080, h: 900, seed: 214, n: 4, spread: 140, color: '#2c4a28', leaf: '#3a6232' });
  ctx.fillStyle = '#4c5a32';
  ctx.beginPath(); ctx.moveTo(-200, H + 10); ctx.lineTo(-200, 950);
  for (let x = -200; x <= 4400; x += 100) ctx.lineTo(x, 950 + Math.sin(x * 0.01) * 14);
  ctx.lineTo(4400, H + 10); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- gongen
export function gong(ctx, t, S) {
  const cut = ramp(t, 6, 7.5);
  if (cut < 1) {
    layer(ctx, c => {
      camera(c, { z: 1.05 + 0.03 * t / 7, x: 0, y: 0 });
      sky(c, [[0, '#d9c29a'], [1, '#9a6a44']]);
      addGlow(c, 960, 380, 800, '#fff0c8', 0.5);
      bamboo(c, t, { x: 200, y: 1080, h: 1000, seed: 221, n: 5, spread: 260, color: '#4a6a3a', leaf: '#5d8a48' });
      bamboo(c, t, { x: 1740, y: 1080, h: 1000, seed: 222, n: 5, spread: 260, color: '#4a6a3a', leaf: '#5d8a48' });
      c.fillStyle = '#7a2a1c';
      c.fillRect(560, 140, 40, 860); c.fillRect(1320, 140, 40, 860);
      c.fillRect(500, 120, 920, 50);
      c.fillStyle = '#5a1e14'; c.fillRect(480, 100, 960, 26);
      const hit = 1.2, since = t - hit;
      const swing = since > 0 ? Math.sin(since * 4) * 0.05 * Math.exp(-since * 0.8) : 0;
      c.save();
      c.translate(960, 170); c.rotate(swing);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(-120, 0); c.lineTo(-90, 220); c.moveTo(120, 0); c.lineTo(90, 220); c.stroke();
      const gg = c.createRadialGradient(-60, 360, 20, 0, 420, 260);
      gg.addColorStop(0, '#f4d28a'); gg.addColorStop(0.5, '#c08a3a'); gg.addColorStop(1, '#6a4418');
      c.fillStyle = gg;
      c.beginPath(); c.arc(0, 420, 250, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8a5a24'; c.lineWidth = 10;
      c.beginPath(); c.arc(0, 420, 230, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#e8bc6a';
      c.beginPath(); c.arc(0, 420, 70, 0, Math.PI * 2); c.fill();
      c.restore();
      // ljudvågor
      if (since > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) {
          const ph = since * 0.9 - k * 0.35;
          if (ph < 0 || ph > 2.2) continue;
          c.strokeStyle = rgba('#fff3d0', 0.45 * (1 - ph / 2.2));
          c.lineWidth = 5;
          c.beginPath(); c.arc(960, 590, 260 + ph * 380, 0, Math.PI * 2); c.stroke();
        }
        c.restore();
      }
      // klubban
      const sw = since < 0 ? lerp(-1.0, 0, ease(ramp(t, 0.2, hit))) : -Math.min(1, since * 1.5) * 0.6;
      c.save();
      c.translate(220, 900); c.rotate(sw);
      c.fillStyle = '#5a3a22'; c.fillRect(0, -12, 520, 24);
      c.fillStyle = '#c9b48a'; c.beginPath(); c.ellipse(540, 0, 46, 56, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }, { alpha: 1 });
  }
  if (cut > 0) {
    const s2 = lineStart(S, 2);
    const brushing = window_(t, s2 + 1, s2 + 6, 0.5);
    const pose = brushing > 0.5
      ? { ...POSE.stand, arms: [40, -10], elbows: [130 + Math.sin(t * 16) * 12, 10] }
      : blendPose(POSE.stand, POSE.raise, 0.5 + 0.5 * Math.sin(t * 2.2));
    layer(ctx, c => {
      camera(c, { z: 1.1, x: 200, y: 40 });
      ninjali(c, t, { camX: 0, door: 0, shadow: { x: 600 + Math.sin(t * 0.7) * 50, pose, f: Math.sin(t * 0.5) > 0 ? 1 : -1 } });
    }, { alpha: cut });
  }
}

// ---------------------------------------------------------------- spången
export function spangen(ctx, t, S) {
  const s3 = lineStart(S, 3);
  const door = ease(ramp(t, 0.6, 2.6));
  let x = lerp(640, 1000, ease(ramp(t, 2.4, 4.6)));
  let pose = POSE.stand, f = 1;
  if (t > 2.4 && t < 4.6) pose = walkPose((t - 2.4) * 6);
  const wait = t > 4.6 && t < s3;
  if (wait) {
    f = Math.sin((t - 4.6) * 0.8) > -0.3 ? 1 : -1;
    const tap = window_(t, lineStart(S, 2), s3, 0.6);
    pose = { ...POSE.stand, knees: [-Math.max(0, Math.sin(t * 9)) * 18 * tap, 0], thighs: [3 + Math.max(0, Math.sin(t * 9)) * 10 * tap, -3], head: f > 0 ? 0 : 4 };
  }
  if (t >= s3) {
    const u = t - s3;
    x = 1000 + Math.max(0, u - 0.8) * 150;
    pose = u < 0.8 ? blendPose(POSE.stand, { ...POSE.stand, arms: [44, -6], elbows: [6, 8] }, u / 0.8) : { ...walkPose(u * 6), arms: [44, walkPose(u * 6).arms[1]], elbows: [6, 14] };
  }
  const camX = clamp(x - 900 + (t >= s3 ? ease(ramp(t, s3, S.end - S.start)) * 900 : 0), 0, 2400);
  camera(ctx, { z: 1.02, x: 0, y: 0 });
  ninjali(ctx, t, { camX, door, alba: { x, y: 790, pose, f }, birds: window_(t, 3, lineStart(S, 1) + 2, 1) });
}

// ---------------------------------------------------------------- Tysta salen
function hall(ctx, t, { dim = 0, motes = 1 }) {
  const vx = 960, vy = 420;
  sky(ctx, [[0, mix('#2a1c14', '#120c09', dim)], [1, mix('#4a3122', '#1c130d', dim)]]);
  // bakvägg med höga fönster
  ctx.fillStyle = mix('#3a281c', '#1a110c', dim);
  ctx.fillRect(560, 160, 800, 330);
  for (let i = 0; i < 3; i++) {
    const wx = 640 + i * 240;
    ctx.fillStyle = mix('#f3e3c0', '#6a5a48', dim);
    ctx.fillRect(wx, 200, 140, 170);
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(wx + 66, 200, 8, 170); ctx.fillRect(wx, 280, 140, 8);
  }
  // golv
  const g = ctx.createLinearGradient(0, 490, 0, H);
  g.addColorStop(0, mix('#6a4a32', '#2a1c13', dim)); g.addColorStop(1, mix('#3a2618', '#140d08', dim));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(560, 490); ctx.lineTo(1360, 490); ctx.lineTo(2600, H + 10); ctx.lineTo(-700, H + 10); ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 34, 490); ctx.lineTo(vx + i * 160, H); ctx.stroke(); }
  // väggar
  ctx.fillStyle = mix('#2e1f15', '#120b07', dim);
  ctx.beginPath(); ctx.moveTo(560, 160); ctx.lineTo(560, 490); ctx.lineTo(-700, H + 10); ctx.lineTo(-700, -200); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1360, 160); ctx.lineTo(1360, 490); ctx.lineTo(2600, H + 10); ctx.lineTo(2600, -200); ctx.fill();
  // pelare i perspektiv
  for (let z = 3; z >= 1; z--) {
    const k = 1 / z, px = 700 * k + 120, top = vy - 520 * k, bot = vy + 560 * k;
    ctx.fillStyle = mix('#4a2c1c', '#1a100a', dim + (z - 1) * 0.05);
    ctx.fillRect(vx - px - 30 * k, top, 60 * k, bot - top);
    ctx.fillRect(vx + px - 30 * k, top, 60 * k, bot - top);
  }
  // ljusstrålar
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const wx = 640 + i * 240;
    const gg = ctx.createLinearGradient(0, 200, 0, 900);
    gg.addColorStop(0, rgba('#fff0c8', 0.18 * (1 - dim)));
    gg.addColorStop(1, rgba('#fff0c8', 0));
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.moveTo(wx, 200); ctx.lineTo(wx + 140, 200); ctx.lineTo(wx + 340 - i * 60, 900); ctx.lineTo(wx + 80 - i * 60, 900); ctx.fill();
  }
  ctx.restore();
  if (motes) sparks(ctx, t, { seed: 230, n: 40, x: 960, y: 560, spread: 420, rise: 30, size: 2, color: '#fff0c8', alpha: 0.5 * motes * (1 - dim), life: 8 });
}

// Guldkonturer av salen som "syns" när Alba känner.
function hallLines(ctx) {
  const vx = 960, vy = 420;
  ctx.strokeStyle = '#e8c98a'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.rect(560, 160, 800, 330);
  for (let i = 0; i < 3; i++) ctx.rect(640 + i * 240, 200, 140, 170);
  ctx.moveTo(560, 490); ctx.lineTo(-700, H + 10); ctx.moveTo(1360, 490); ctx.lineTo(2600, H + 10);
  for (let i = -12; i <= 12; i += 2) { ctx.moveTo(vx + i * 34, 490); ctx.lineTo(vx + i * 160, H); }
  for (let z = 3; z >= 1; z--) {
    const k = 1 / z, px = 700 * k + 120, top = vy - 520 * k, bot = vy + 560 * k;
    ctx.rect(vx - px - 30 * k, top, 60 * k, bot - top);
    ctx.rect(vx + px - 30 * k, top, 60 * k, bot - top);
  }
  ctx.stroke();
}

export function salen(ctx, t, S) {
  camera(ctx, { z: 1.0 + 0.06 * ease(ramp(t, 0, 14)), x: 0, y: 0 });
  hall(ctx, t, {});
  const x = 960, y = lerp(1180, 1000, ease(ramp(t, 0.5, 6)));
  const pose = t < 6 ? walkPose(t * 5) : POSE.stand;
  addGlow(ctx, x, y - 160, 220, '#ffffff', 0.25);
  figure(ctx, x, y, 330, LOOK.albaWhite, pose, { f: 1, front: true });
}

// ---------------------------------------------------------------- känna: se genom att känna
function sensing(ctx, t, { period = 4, strength = 1, king = 0, color = 0, cx = 960, cy = 620 }) {
  sky(ctx, [[0, '#05040a'], [1, '#120d1c']]);
  if (color > 0) layer(ctx, c => hall(c, t, { motes: 0 }), { alpha: color * 0.5, blur: 3 });
  // ringar från Alba
  const speed = 560, rmax = 2000;
  masked(ctx, c => {
    hallLines(c);
    figure(c, 1400, 1000, 470, GOLD, POSE.stand, { f: -1 });
  }, c => {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rmax);
    g.addColorStop(0, rgba('#ffffff', 0.35 * strength));
    const stops = [];
    for (let k = 0; k < 6; k++) {
      const born = Math.floor(t / period) - k;
      if (born < 0) continue;
      const r = (t - born * period) * speed;
      if (r > rmax || r < 0) continue;
      stops.push(r);
    }
    const pts = [];
    pts.push([0.08, 0.3 * strength]);
    pts.push([0.14, 0]);
    for (const r of stops) {
      const p = r / rmax, fade = 1 - p;
      const a = Math.max(0.15, p - 0.07), b = Math.max(a + 0.01, p - 0.01);
      pts.push([a, 0]);
      pts.push([b, 0.95 * strength * fade]);
      pts.push([Math.min(0.999, b + 0.02), 0]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    let last = -1;
    for (const [p, a] of pts) { const q = Math.max(p, last + 0.0005); if (q < 1) g.addColorStop(q, rgba('#ffffff', a)); last = q; }
    g.addColorStop(1, rgba('#ffffff', 0));
    c.fillStyle = g;
    c.fillRect(-W, -H, W * 3, H * 3);
  }, { composite: 'lighter' });
  // Ninja King tydligt när han talar
  if (king > 0) {
    addGlow(ctx, 1400, 780, 380, '#e8c98a', 0.35 * king);
    figure(ctx, 1400, 1000, 470, GOLD, blendPose(POSE.stand, { ...POSE.stand, arms: [50, -6], elbows: [40, 8] }, king), { f: -1, alpha: king });
  }
}

export function kansla(ctx, t, S) {
  const king = window_(t, lineStart(S, 3) - 0.3, lineEnd(S, 3) + 1.2, 1);
  const color = window_(t, lineStart(S, 1), lineEnd(S, 1) - 2, 1.5);
  const practice = ramp(t, lineStart(S, 5), lineStart(S, 5) + 3);
  camera(ctx, { z: 1.0 + 0.04 * Math.sin(t * 0.05), x: 0, y: 0 });
  sensing(ctx, t, { period: lerp(4.2, 2.8, practice), strength: 0.75 + 0.25 * practice, king, color });
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
  addGlow(ctx, 960, 720, 260, '#ffffff', 0.25 + 0.1 * pulse + practice * 0.1);
  figure(ctx, 960, 900, 330, LOOK.albaWhite, POSE.meditate, { f: 1, front: true });
}

export function ensam(ctx, t, S) {
  const resolve = ramp(t, lineStart(S, 1), lineStart(S, 1) + 3);
  camera(ctx, { z: 1.05 + 0.12 * ease(ramp(t, 0, 25)), x: 0, y: 30 });
  hall(ctx, t, { dim: 0.55 - resolve * 0.35 });
  addGlow(ctx, 960, 800, 300 + resolve * 200, '#ffffff', 0.18 + resolve * 0.35);
  const pose = blendPose({ ...POSE.stand, head: 14, lean: 3 }, { ...POSE.stand, arms: [40, -6], elbows: [100, 8], head: -6, lean: -2 }, resolve);
  figure(ctx, 960, 1000, 360, LOOK.albaWhite, pose, { f: 1 });
  if (resolve > 0) sparks(ctx, t, { seed: 240, n: 26, x: 960, y: 820, spread: 180, rise: 120, alpha: resolve });
}

// ---------------------------------------------------------------- Haji vid salens veranda
function veranda(ctx, t) {
  sky(ctx, [[0, '#a7c0d2'], [1, '#efe0c0']]);
  ctx.drawImage(cached('veranda-bak', W, H, c => {
    ridge(c, { y: 520, amp: 70, freq: 0.003, seed: 251, color: '#9aa6ae' });
    const r = rng(252);
    for (let i = 0; i < 8; i++) tree(c, 60 + i * 260 + r() * 60, 640, { size: 300 + r() * 80, seed: 253 + i, trunk: '#4a3328', leaves: ['#e8a33d', '#d9652a', '#c0392b', '#f0c050'], leafAlpha: 0.9 });
    // salens vägg och dörröppning
    c.fillStyle = '#4a2f22'; c.fillRect(0, 0, 520, 760);
    c.fillStyle = '#2a1a14'; c.fillRect(120, 220, 300, 540);
    c.fillStyle = '#1a100b'; c.fillRect(140, 240, 260, 520);
    c.fillStyle = '#2a1a12'; c.fillRect(500, 0, 40, 780);
    c.fillStyle = '#24160f'; c.fillRect(0, 0, W, 90);
    c.fillRect(1880, 0, 40, 780);
    // räcke
    c.fillStyle = '#3a2618'; c.fillRect(540, 600, 1340, 18);
    for (let x = 560; x < 1880; x += 110) c.fillRect(x, 600, 14, 180);
    // golv
    const g = c.createLinearGradient(0, 770, 0, H);
    g.addColorStop(0, '#7a5638'); g.addColorStop(1, '#3a2618');
    c.fillStyle = g; c.fillRect(0, 770, W, 320);
    c.strokeStyle = rgba('#000000', 0.2); c.lineWidth = 2;
    for (let y = 790; y < H; y += 34) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  }), 0, 0);
  fallingLeaves(ctx, t, { seed: 254, n: 18, wind: 30, fall: 40, size: 11, area: [520, 0, 1360, 760] });
}

function graveMemory(ctx, t) {
  sky(ctx, [[0, '#2a3048'], [1, '#6a6a7a']]);
  addGlow(ctx, 960, 520, 700, '#fff6e0', 0.35);
  // gravsten
  ctx.fillStyle = '#9a9a98';
  ctx.beginPath(); ctx.moveTo(860, 900); ctx.lineTo(860, 600); ctx.quadraticCurveTo(960, 520, 1060, 600); ctx.lineTo(1060, 900); ctx.fill();
  // en inristad jasminblomma
  ctx.fillStyle = '#f6f2e8';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    ctx.beginPath(); ctx.ellipse(960 + Math.cos(a) * 20, 690 + Math.sin(a) * 20, 18, 11, a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#e8d9a0'; ctx.beginPath(); ctx.arc(960, 690, 8, 0, Math.PI * 2); ctx.fill();
  addGlow(ctx, 960, 690, 90, '#ffffff', 0.4 + 0.15 * Math.sin(t * 2));
  // jasminbusken runt
  ctx.drawImage(cached('minne-jasmin', W, H, c => {
    const r = rng(260);
    for (let i = 0; i < 120; i++) {
      c.fillStyle = ['#2f4a2a', '#3d5c34', '#26401f'][i % 3];
      const side = r() < 0.5 ? -1 : 1;
      c.beginPath(); c.arc(960 + side * (180 + r() * 420), 920 - r() * 360, 34 + r() * 40, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 160; i++) {
      c.fillStyle = '#fbfaf4';
      const side = r() < 0.5 ? -1 : 1;
      const x = 960 + side * (170 + r() * 430), y = 920 - r() * 380;
      for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(x + Math.cos(p * 1.256) * 6, y + Math.sin(p * 1.256) * 6, 5, 0, Math.PI * 2); c.fill(); }
    }
    c.fillStyle = '#3a4a2a'; c.fillRect(0, 900, W, 200);
  }), 0, 0);
  sparks(ctx, t, { seed: 261, n: 24, x: 960, y: 700, spread: 500, rise: 60, size: 3, alpha: 0.7, life: 5 });
}

export function haji(ctx, t, S) {
  const s = i => lineStart(S, i), e = i => lineEnd(S, i);
  const hand = s(4) + 1.4;                   // skålen byter ägare
  const turn = ease(ramp(t, s(1) + 1.6, s(1) + 2.4));
  const mother = window_(t, cueAt(S, 'Vita ninjan var', s(2) + 4) - 0.5, e(2) + 0.5, 1.2);
  const grave = window_(t, cueAt(S, 'Förutom Eo', e(10) - 7) - 0.3, S.end - S.start + 2, 1.2);
  const zoom = 1.0 + 0.08 * ease(ramp(t, s(3), s(9)));
  camera(ctx, { z: zoom, x: 0, y: 0 });
  veranda(ctx, t);
  // Haji kommer in från höger
  const hx = lerp(1560, 1230, ease(ramp(t, 0.3, 2.6)));
  let hPose = t < 2.6 ? blendPose(POSE.hold, walkPose(t * 6), 0.5) : POSE.hold;
  if (t > hand) hPose = blendPose(POSE.hold, POSE.stand, ramp(t, hand, hand + 1));
  if (t > s(5) && t < s(7)) hPose = { ...hPose, lean: -8, head: -8 };
  const bowK = window_(t, s(8), s(8) + 2.6, 0.6);
  if (bowK > 0) hPose = blendPose(hPose, POSE.bow, bowK);
  figure(ctx, hx, 960, 470, LOOK.haji, hPose, { f: -1, bowl: t < hand });
  if (t < hand) steam(ctx, t, { x: hx - 120, y: 700, seed: 3, n: 5, h: 120, w: 20, alpha: 0.35 });
  // mamman som ett minne
  if (mother > 0) {
    addGlow(ctx, 560, 600, 320, '#ffffff', 0.3 * mother);
    figure(ctx, 560, 960, 470, MOTHER, POSE.stand, { f: 1, alpha: 0.4 * mother });
  }
  // Alba
  const af = turn > 0.5 ? 1 : -1;
  let aPose = POSE.stand;
  if (t > s(4) - 0.4 && t < hand + 0.6) aPose = blendPose(POSE.stand, POSE.reach, window_(t, s(4) - 0.4, hand + 0.6, 0.6));
  if (t > hand) aPose = blendPose(aPose, POSE.hold, ramp(t, hand, hand + 0.6));
  const sip = window_(t, s(10) + 0.5, s(10) + 4.5, 0.8);
  if (sip > 0) aPose = blendPose(aPose, { ...POSE.hold, arms: [56, 52], elbows: [118, 122], head: -14 }, sip);
  figure(ctx, 830, 960, 340, LOOK.albaWhite, aPose, { f: af, bowl: t > hand });
  if (t > hand) steam(ctx, t, { x: 830 + 95, y: 790 - sip * 80, seed: 5, n: 4, h: 100, w: 16, alpha: 0.3 });
  if (grave > 0) layer(ctx, c => graveMemory(c, t), { alpha: grave });
}

// ---------------------------------------------------------------- köket
function kitchen(ctx, t, { dim = 0, storm = 0 }) {
  sky(ctx, [[0, '#4a3020'], [1, '#2a1a10']]);
  ctx.drawImage(cached('kok-vagg', W, H, c => {
    c.fillStyle = '#6a4a34'; c.fillRect(0, 0, W, 760);
    c.fillStyle = rgba('#000000', 0.12);
    for (let y = 0; y < 760; y += 60) for (let x = (y / 60) % 2 * 60; x < W; x += 120) c.fillRect(x, y, 116, 56);
    // hyllor
    c.fillStyle = '#3a2416';
    c.fillRect(640, 240, 560, 16); c.fillRect(640, 380, 560, 16);
    const r = rng(270);
    for (let s = 0; s < 2; s++) for (let i = 0; i < 9; i++) {
      const jx = 660 + i * 60 + r() * 10, jh = 50 + r() * 50;
      c.fillStyle = ['#b8823a', '#7a8a5a', '#a04a32', '#c8b07a', '#5a6a7a'][Math.floor(r() * 5)];
      c.fillRect(jx, 240 + s * 140 - jh, 38, jh);
      c.fillStyle = '#3a2416'; c.fillRect(jx - 2, 240 + s * 140 - jh - 8, 42, 10);
    }
    // örter
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = '#3a2416'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(700 + i * 110, 40); c.lineTo(700 + i * 110, 120); c.stroke();
      c.fillStyle = ['#5a7a3a', '#6a8a4a', '#8a7a3a'][i % 3];
      c.beginPath(); c.moveTo(680 + i * 110, 190); c.lineTo(700 + i * 110, 110); c.lineTo(720 + i * 110, 190); c.fill();
    }
    // spis
    c.fillStyle = '#5a5450'; c.fillRect(120, 360, 420, 400);
    c.fillStyle = '#3a3430'; c.beginPath(); c.moveTo(170, 760); c.lineTo(170, 560); c.arc(330, 560, 160, Math.PI, 0); c.lineTo(490, 760); c.fill();
    c.fillStyle = '#4a4440'; c.fillRect(100, 330, 460, 40);
    c.fillStyle = '#4a4440'; c.fillRect(200, 0, 260, 330);
    // golv
    const g = c.createLinearGradient(0, 760, 0, H);
    g.addColorStop(0, '#5a3a24'); g.addColorStop(1, '#2a1a10');
    c.fillStyle = g; c.fillRect(0, 760, W, 320);
  }), 0, 0);
  // fönstret
  const wx = 1360, wy = 200, ww = 380, wh = 360;
  const wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
  wg.addColorStop(0, mix('#a8c4d8', '#3a4050', storm)); wg.addColorStop(1, mix('#f2e2c0', '#5a5a64', storm));
  ctx.fillStyle = wg; ctx.fillRect(wx, wy, ww, wh);
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  tree(ctx, wx + 200 + Math.sin(t * 0.6) * 4, wy + wh + 60, { size: 420, seed: 271, trunk: '#4a3020', leaves: ['#d9652a', '#e8a33d', '#c0392b'], sway: Math.sin(t * 0.5) * 0.03 * (1 + storm * 3) });
  if (storm > 0) clouds(ctx, t, { seed: 272, n: 4, y0: wy, y1: wy + 160, color: '#20242e', alpha: 0.8 * storm, speed: 60 });
  fallingLeaves(ctx, t, { seed: 273, n: 6, wind: 30 + storm * 200, fall: 40, size: 10, area: [wx, wy, ww, wh] });
  ctx.restore();
  ctx.fillStyle = '#3a2416';
  ctx.fillRect(wx - 14, wy - 14, ww + 28, 14); ctx.fillRect(wx - 14, wy + wh, ww + 28, 18);
  ctx.fillRect(wx - 14, wy, 14, wh); ctx.fillRect(wx + ww, wy, 14, wh); ctx.fillRect(wx + ww / 2 - 6, wy, 12, wh); ctx.fillRect(wx, wy + wh / 2 - 6, ww, 12);
  addGlow(ctx, wx + ww / 2, wy + wh / 2, 400, mix('#fff2d0', '#8090a8', storm), 0.25);
  // elden och grytan
  const fl = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3) - dim * 0.4;
  addGlow(ctx, 330, 700, 360, '#ff9a3a', 0.55 * fl);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const fx = 250 + i * 26, h = (70 + 40 * Math.sin(t * 7 + i * 1.7)) * fl;
    ctx.fillStyle = rgba(i % 2 ? '#ffb347' : '#ff7a2a', 0.8);
    ctx.beginPath(); ctx.moveTo(fx - 18, 760); ctx.quadraticCurveTo(fx - 10, 760 - h * 0.6, fx + Math.sin(t * 6 + i) * 6, 760 - h); ctx.quadraticCurveTo(fx + 10, 760 - h * 0.6, fx + 18, 760); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#1e1a18';
  ctx.beginPath(); ctx.ellipse(330, 640, 90, 60, 0, 0, Math.PI); ctx.fill();
  ctx.fillRect(240, 600, 180, 40);
  steam(ctx, t, { x: 330, y: 600, seed: 7, n: 7, h: 220, w: 40, alpha: 0.3 });
  tint(ctx, '#203048', dim * 0.35);
}

function counter(ctx) {
  ctx.fillStyle = '#6a4630'; ctx.fillRect(780, 700, 780, 30);
  ctx.fillStyle = '#4a2e1e'; ctx.fillRect(800, 730, 740, 360);
  ctx.fillStyle = rgba('#000000', 0.15);
  for (let x = 820; x < 1540; x += 120) ctx.fillRect(x, 750, 100, 300);
}

function stool(ctx, x) {
  ctx.fillStyle = '#4a2e1e';
  ctx.fillRect(x - 60, 786, 120, 18);
  ctx.fillRect(x - 50, 804, 12, 250); ctx.fillRect(x + 38, 804, 12, 250);
  ctx.fillRect(x - 50, 880, 100, 8);
}

// sitter på en hög pall vid bänken; fötterna dinglar
const SIT = { ...POSE.sitStool, hipY: 0.5 };
const ALBA_H = 380, SIT_Y = 785 + 0.5 * ALBA_H;

export function koket(ctx, t, S) {
  const s = i => lineStart(S, i);
  const worry = ramp(t, s(6) + 2, s(6) + 6);
  camera(ctx, { z: 1.0 + 0.05 * ease(ramp(t, 0, 30)), x: 0, y: 0 });
  kitchen(ctx, t, { dim: worry * 0.6, storm: worry * 0.5 });
  const hPose = window_(t, s(4), s(4) + 2.5, 0.5) > 0.5 ? { ...POSE.stand, arms: [80, -6], elbows: [10, 8] } : { ...POSE.stand, arms: [50 + Math.sin(t * 3) * 10, -6], elbows: [60, 8] };
  figure(ctx, 1280, 1000, 470, LOOK.haji, hPose, { f: -1 });
  counter(ctx);
  ctx.fillStyle = '#8c5a3c';
  ctx.beginPath(); ctx.ellipse(860, 700, 46, 20, 0, 0, Math.PI); ctx.fill();
  steam(ctx, t, { x: 860, y: 694, seed: 9, n: 4, h: 90, w: 14, alpha: 0.3 });
  // Alba går in och sätter sig
  const walkIn = ramp(t, 1.0, 4.5);
  const ax = lerp(-120, 700, ease(walkIn));
  let aPose = walkIn < 1 ? walkPose(t * 6) : blendPose(POSE.stand, SIT, ramp(t, 4.5, 5.5));
  const sat = ramp(t, 4.5, 5.5);
  if (window_(t, s(5), s(6) + 1.5, 0.4) > 0.5) aPose = { ...SIT, lean: 12, arms: [60, 30], elbows: [30, 60], head: -4 };
  stool(ctx, 700);
  figure(ctx, ax, lerp(1040, SIT_Y, sat), ALBA_H, LOOK.albaWhite, aPose, { f: 1 });
}

// ---------------------------------------------------------------- Äldsterådet
export function radet(ctx, t, S) {
  const vidaK = window_(t, lineStart(S, 1) - 0.3, S.end - S.start + 2, 1);
  const lean = ramp(t, lineStart(S, 2), lineStart(S, 2) + 2);
  camera(ctx, { z: 1.0 + 0.12 * ease(ramp(t, 0, 22)), x: 0, y: -30 });
  ctx.drawImage(cached('radet-sal', W, H, c => {
    sky(c, [[0, '#14131c'], [1, '#2a2632']]);
    for (let i = 0; i < 3; i++) {
      const x = 560 + i * 400;
      c.fillStyle = '#3a4a62';
      c.beginPath(); c.moveTo(x, 520); c.lineTo(x, 200); c.arc(x + 80, 200, 80, Math.PI, 0); c.lineTo(x + 160, 520); c.fill();
      c.fillStyle = '#20202a'; c.fillRect(x + 76, 120, 8, 400); c.fillRect(x, 330, 160, 8);
    }
    const banners = [['#a8322a', 'sol'], ['#2f5a9a', 'våg'], ['#2f7a4a', 'träd'], ['#c49a2a', 'berg']];
    banners.forEach(([col, sym], i) => {
      const bx = 330 + i * 400 + (i > 1 ? 160 : 0) - (i === 1 ? 0 : 0);
      const x = [360, 830, 1230, 1600][i];
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x - 60, 140); c.lineTo(x + 60, 140); c.lineTo(x + 60, 470); c.lineTo(x, 430); c.lineTo(x - 60, 470); c.fill();
      c.fillStyle = '#f2e6c8'; c.strokeStyle = '#f2e6c8'; c.lineWidth = 6;
      if (sym === 'sol') { c.beginPath(); c.arc(x, 270, 30, 0, Math.PI * 2); c.fill(); }
      if (sym === 'våg') { c.beginPath(); for (let k = 0; k < 2; k++) { c.moveTo(x - 40, 250 + k * 30); c.quadraticCurveTo(x - 20, 230 + k * 30, x, 250 + k * 30); c.quadraticCurveTo(x + 20, 270 + k * 30, x + 40, 250 + k * 30); } c.stroke(); }
      if (sym === 'träd') { c.beginPath(); c.moveTo(x, 220); c.lineTo(x + 36, 300); c.lineTo(x - 36, 300); c.fill(); c.fillRect(x - 6, 300, 12, 20); }
      if (sym === 'berg') { c.beginPath(); c.moveTo(x - 44, 310); c.lineTo(x - 10, 236); c.lineTo(x + 8, 270); c.lineTo(x + 20, 252); c.lineTo(x + 44, 310); c.fill(); }
      void bx;
    });
    c.fillStyle = '#1c1a22'; c.fillRect(0, 640, W, 440);
    c.strokeStyle = '#3a3646'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(960, 840, 640, 170, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(960, 840, 520, 130, 0, 0, Math.PI * 2); c.stroke();
  }), 0, 0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = 560 + i * 400;
    const g = ctx.createLinearGradient(0, 200, 0, 900);
    g.addColorStop(0, rgba('#b8c8e8', 0.16)); g.addColorStop(1, rgba('#b8c8e8', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x + 160, 200); ctx.lineTo(x + 260, 900); ctx.lineTo(x + 40, 900); ctx.fill();
  }
  ctx.restore();
  const robes = ['#7a2a24', '#2a4a7a', '#2a6a44', null, '#9a7a2a', '#5a4a6a', '#6a3a2a'];
  const order = [0, 6, 1, 5, 2, 4, 3];
  for (const i of order) {
    const th = (i - 3) / 3 * 1.15;
    const x = 960 + Math.sin(th) * 640, y = 760 + (1 - Math.cos(th)) * 150, h = 330 + (1 - Math.cos(th)) * 90;
    const isVida = i === 3;
    const lk = isVida ? LOOK.vida : { ...LOOK.vida, body: robes[i], limb: robes[i], limbBack: robes[i], robe: robes[i], hair: ['#8a8a8a', '#3a2a1a', '#cfcfcf'][i % 3], skin: '#c9a58a', bun: i % 2 === 0 };
    // stolens rygg
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(x - h * 0.14, y - h * 1.12, h * 0.28, h * 0.8);
    if (isVida) addGlow(ctx, x, y - h * 0.5, 300, '#ffe7a3', 0.2 + 0.3 * vidaK);
    const pose = { ...POSE.stand, lean: (isVida ? 0 : lean * 6 * Math.sign(-th)), arms: isVida ? [40, -6] : [12, -8], elbows: isVida ? [70, 8] : [20, 8] };
    figure(ctx, x, y, h, lk, pose, { f: th > 0 ? -1 : 1, key: isVida, front: isVida });
  }
  // ljus på bordet
  for (let i = 0; i < 5; i++) {
    const x = 760 + i * 100, y = 860;
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - 5, y - 40, 10, 40);
    addGlow(ctx, x, y - 50, 50, '#ffcf7a', 0.7 + 0.2 * Math.sin(t * 8 + i));
  }
  tint(ctx, '#101828', 0.15);
}

// ---------------------------------------------------------------- köket igen (närmare)
export function koket2(ctx, t, S) {
  const s = i => lineStart(S, i), e = i => lineEnd(S, i);
  const li = lineInfo(S, S.start + t).idx;
  const worry = window_(t, s(14) - 0.5, s(15) + 1, 1.5);
  const leave = ramp(t, s(17) + 3.5, s(17) + 7);
  camera(ctx, { z: 1.28 - 0.08 * leave, x: -60, y: -70 });
  kitchen(ctx, t, { dim: worry * 0.7, storm: worry });
  // Haji
  let hPose = { ...POSE.stand, arms: [30, -6], elbows: [50, 8] };
  if (li <= 2) hPose = { ...POSE.stand, arms: [70 + Math.sin(t * 2.5) * 10, -6], elbows: [30, 8] };
  if (li === 8 || li === 9) hPose = { ...POSE.stand, arms: [140, -6], elbows: [110 + Math.sin(t * 10) * 10, 8], head: 6 };
  if (t > s(17) + 1 && t < s(17) + 4) hPose = { ...hPose, head: 12 * Math.max(0, Math.sin((t - s(17)) * 6)) };
  const bowlToHaji = ramp(t, s(16) + 1.5, s(16) + 2.2);
  if (bowlToHaji > 0) hPose = { ...hPose, arms: [40, -6], elbows: [70, 8] };
  figure(ctx, 1280, 1000, 470, LOOK.haji, hPose, { f: -1, bowl: bowlToHaji > 0.5 });
  counter(ctx);
  // Alba
  let aPose = SIT;
  if (li === 3 || li === 4) aPose = { ...SIT, lean: -4, head: 22, arms: [20, 10], elbows: [40, 40] };
  if (li >= 5 && li <= 7) aPose = { ...SIT, lean: 12, arms: [64, 30], elbows: [26, 60], head: -6 };
  if (li === 10) aPose = { ...SIT, lean: -2, head: -10, arms: [140, 40], elbows: [20, 40], hipY: SIT.hipY + Math.abs(Math.sin(t * 8)) * 0.01 };
  const sipT = cueAt(S, 'sörplade', s(11) + 2);
  const sip = window_(t, sipT - 0.3, sipT + 3.8, 0.6);
  if (sip > 0) aPose = blendPose(aPose, POSE.drink, sip);
  const give = window_(t, s(16) + 0.5, s(16) + 2.4, 0.5);
  if (give > 0) aPose = blendPose(aPose, { ...SIT, lean: 10, arms: [80, 20], elbows: [10, 40] }, give);
  let ax = 700, ay = SIT_Y;
  const stand = ramp(t, s(17) + 2.5, s(17) + 3.3);
  if (stand > 0) {
    aPose = blendPose(aPose, POSE.stand, stand);
    ay = lerp(SIT_Y, 1040, stand);
    if (t > s(17) + 3.3) { aPose = walkPose((t - s(17)) * 9); ax = 700 - (t - s(17) - 3.3) * 420; }
  }
  stool(ctx, 700);
  const albaHoldsBowl = sip > 0 || give > 0;
  if (!albaHoldsBowl && bowlToHaji < 0.5) {
    ctx.fillStyle = '#8c5a3c';
    ctx.beginPath(); ctx.ellipse(860, 700, 46, 20, 0, 0, Math.PI); ctx.fill();
  }
  const r = figure(ctx, ax, ay, ALBA_H, LOOK.albaWhite, aPose, { f: stand > 0 && t > s(17) + 3.3 ? -1 : 1, bowl: albaHoldsBowl });
  // tår
  const tear = window_(t, cueAt(S, 'gråten', s(4)) + 0.3, cueAt(S, 'gråten', s(4)) + 3.5, 0.5);
  if (tear > 0) {
    const ty = r.head[1] + 10 + ((t * 30) % 30);
    addGlow(ctx, r.head[0] + 16, ty, 16, '#cfe8ff', tear);
  }
  // hon övar: små ringar
  const practice = window_(t, cueAt(S, 'träna på sina', s(15) + 10) - 0.5, s(16), 1);
  if (practice > 0) {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.6 + k / 3) % 1;
      ctx.strokeStyle = rgba('#ffffff', practice * 0.4 * (1 - ph));
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.head[0], r.head[1] + 80, 60 + ph * 400, 0, Math.PI * 2); ctx.stroke();
    }
  }
  void e;
}

// ---------------------------------------------------------------- redo: spegelstaven och tröjan
export function redo(ctx, t, S) {
  const staffT = cueAt(S, 'spegelstav', 1) + 1.5;
  const king = window_(t, lineStart(S, 1) - 0.5, lineEnd(S, 1) + 0.8, 0.8);
  const swapT = cueAt(S, 'jeansen', lineStart(S, 2)) + 1.0;
  const swap = window_(t, swapT - 0.8, swapT + 0.8, 0.6);
  camera(ctx, { z: 1.08, x: 0, y: 10 });
  roomBackdrop(ctx, t, { light: 1, day: 1 });
  if (king > 0) {
    addGlow(ctx, 1320, 640, 380, '#e8c98a', 0.3 * king);
    figure(ctx, 1320, 930, 520, GOLD, { ...POSE.stand, arms: [40, -6], elbows: [70, 8] }, { f: -1, alpha: 0.75 * king });
  }
  const look = t < swapT ? LOOK.albaWhite : LOOK.albaSweater;
  const reach = window_(t, staffT - 1.5, staffT + 0.4, 0.5);
  const pose = blendPose({ ...POSE.stand, arms: [10, -10], elbows: [10, 10] }, { ...POSE.stand, arms: [150, -8], elbows: [80, 8], head: -6 }, reach);
  const r = figure(ctx, 900, 930, 380, look, pose, { f: 1, staff: t > staffT - 0.3 });
  if (t > staffT - 0.3) {
    const g = window_(t, staffT - 0.3, staffT + 2, 0.4);
    addGlow(ctx, r.neck[0] - 125, r.neck[1] - 150, 90, '#ffffff', g);
  }
  if (swap > 0) {
    addGlow(ctx, 900, 760, 320, '#ffffff', swap * 0.8);
    sparks(ctx, t, { seed: 280, n: 40, x: 900, y: 760, spread: 220, rise: 160, size: 4, alpha: swap });
  }
}

// ---------------------------------------------------------------- Vida minns
export function vida(ctx, t, S) {
  const s = i => lineStart(S, i), e = i => lineEnd(S, i);
  const pat = cueAt(S, 'kinden', s(3) + 3);
  const lightT = cueAt(S, 'ljuskraft', s(4) + 2);
  const ill = cueAt(S, 'illvilja', s(4) + 8);
  const hate = cueAt(S, 'hämndbegär', s(4) + 12);
  const stoneT = cueAt(S, 'ljussten', s(5));
  const forgot = s(7);
  camera(ctx, { z: 1.02 + 0.06 * Math.sin(t * 0.04), x: 0, y: 0 });
  sky(ctx, [[0, '#0b0d26'], [0.6, '#22204a'], [1, '#3a2a5a']]);
  stars(ctx, t, { seed: 290, n: 140, y1: H, alpha: 0.8 });
  for (let i = 0; i < 5; i++) cloud(ctx, ((t * (12 + i * 4) + i * 500) % (W + 900)) - 450, 300 + i * 140, 800, 220, '#6a5aa8', 0.18, 291 + i);
  addGlow(ctx, 960, 900, 700, '#8a7ad8', 0.25);
  // mörka viskningar: illvilja, avund, hämnd
  const dark = window_(t, ill - 0.5, s(5) + 1, 1.5);
  if (dark > 0) {
    for (let i = 0; i < 10; i++) {
      const r0 = rng(300 + i);
      const side = i % 2 ? 1 : -1;
      const x = W / 2 + side * (W / 2 - 60 * dark - r0() * 160) + Math.sin(t + i) * 30;
      const y = 150 + r0() * 800;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 260);
      g.addColorStop(0, rgba('#000000', 0.85 * dark)); g.addColorStop(1, rgba('#000000', 0));
      ctx.fillStyle = g; ctx.fillRect(x - 260, y - 260, 520, 520);
    }
    const eyes = window_(t, hate - 0.3, s(5) + 0.5, 0.8);
    for (let i = 0; i < 3; i++) {
      const ex = [180, 1720, 1600][i], ey = [360, 260, 820][i];
      addGlow(ctx, ex, ey, 22, '#ff2a1a', eyes * (0.6 + 0.4 * Math.sin(t * 3 + i)));
      addGlow(ctx, ex + 40, ey, 22, '#ff2a1a', eyes * (0.6 + 0.4 * Math.sin(t * 3 + i)));
    }
  }
  // Vida
  const vx = lerp(1250, 1080, ease(window_(t, pat - 1.2, pat + 3, 1)));
  const patK = window_(t, pat - 0.6, pat + 2, 0.5);
  const vPose = blendPose({ ...POSE.stand, arms: [36, -6], elbows: [60, 8] }, { ...POSE.stand, arms: [92, -6], elbows: [30, 8], head: 10, lean: 6 }, patK);
  const keyGlow = 0.5 + 0.5 * window_(t, s(1), e(1), 0.8);
  addGlow(ctx, vx, 640, 360, '#ffe7a3', 0.15 + 0.15 * keyGlow);
  figure(ctx, vx, 960, 520, LOOK.vida, vPose, { f: -1, key: patK < 0.3 });
  // Alba
  const aura = ramp(t, lightT, lightT + 3) * (1 - 0.5 * ramp(t, forgot, forgot + 3));
  addGlow(ctx, 780, 760, 220 + aura * 160, '#ffffff', 0.1 + aura * 0.22);
  const nodT = cueAt(S, 'nickade', s(6) + 6);
  const nod = t > nodT && t < nodT + 1.6 ? Math.max(0, Math.sin((t - nodT) * 8)) * 14 : 0;
  const a = figure(ctx, 780, 960, 340, LOOK.albaWhite, { ...POSE.stand, head: 6 + nod }, { f: 1 });
  // ljusstenen
  const st = ramp(t, stoneT - 0.5, stoneT + 1.5);
  if (st > 0) {
    const settle = ease(ramp(t, stoneT + 3, stoneT + 7));
    const lost = ramp(t, forgot + 0.4, forgot + 3.5);
    let sx = lerp(930, a.neck[0] + 6, settle), sy = lerp(560 + Math.sin(t * 1.4) * 14, a.neck[1] + 30, settle);
    sx += lost * 380; sy -= lost * 260;
    const fl = lost > 0 ? (0.5 + 0.5 * Math.sin(t * 23)) : 1;
    const al = st * (1 - lost) * fl;
    addGlow(ctx, sx, sy, 160, '#fff3cc', 0.6 * al);
    ctx.fillStyle = rgba('#fffaf0', al);
    ctx.beginPath(); ctx.moveTo(sx, sy - 18); ctx.lineTo(sx + 12, sy); ctx.lineTo(sx, sy + 18); ctx.lineTo(sx - 12, sy); ctx.fill();
    sparks(ctx, t, { seed: 310, n: 20, x: sx, y: sy, spread: 50, rise: 40, size: 3, alpha: al });
  }
  tint(ctx, '#000000', ramp(t, forgot + 1, forgot + 4) * 0.45);
}

// ---------------------------------------------------------------- tåget och stationen
function trainCar(ctx, x, y, kind, dist, { lit = 1, face = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'loco') {
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(0, -150, 260, 120);
    ctx.beginPath(); ctx.roundRect(240, -140, 120, 110, 30); ctx.fill();
    ctx.fillRect(0, -230, 120, 200);
    ctx.fillStyle = '#2a2a32'; ctx.fillRect(-10, -240, 140, 16);
    ctx.fillStyle = '#1c1c22'; ctx.fillRect(250, -210, 36, 70);
    ctx.fillStyle = '#a8322a'; ctx.fillRect(0, -40, 360, 12);
    ctx.fillStyle = '#ffcf7a'; ctx.fillRect(24, -200, 60, 50);
    addGlow(ctx, 360, -90, 90, '#ffe9a8', 0.6);
  } else {
    ctx.fillStyle = '#2f4a3a';
    ctx.beginPath(); ctx.roundRect(0, -190, 380, 160, 12); ctx.fill();
    ctx.fillStyle = '#c8a24a'; ctx.fillRect(0, -60, 380, 6);
    ctx.fillStyle = '#20262a'; ctx.fillRect(-6, -200, 392, 16);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = mix('#3a3a40', '#ffd890', lit * 0.85);
      ctx.fillRect(22 + i * 90, -160, 64, 66);
    }
    if (face) {
      // Alba i fönstret
      const ax = 22 + 90 + 32;
      ctx.fillStyle = '#e8c4a6'; ctx.beginPath(); ctx.arc(ax, -120, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1b14'; ctx.beginPath(); ctx.arc(ax - 2, -124, 17, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
      ctx.fillStyle = '#5f6e45'; ctx.fillRect(ax - 22, -104, 44, 10);
    }
  }
  // hjul
  const wheels = kind === 'loco' ? [60, 160, 260] : [60, 320];
  for (const wx of wheels) {
    ctx.fillStyle = kind === 'loco' ? '#8a2a22' : '#1a1a1e';
    ctx.beginPath(); ctx.arc(wx, -22, kind === 'loco' ? 34 : 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d0c0a0'; ctx.lineWidth = 3;
    const a = dist / 30;
    ctx.beginPath(); ctx.moveTo(wx, -22); ctx.lineTo(wx + Math.cos(a) * 24, -22 + Math.sin(a) * 24); ctx.stroke();
  }
  ctx.restore();
}

function train(ctx, t, x, y, { scale = 1, cars = 3, faceCar = 1, puff = 1 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  for (let i = cars; i >= 1; i--) trainCar(ctx, -i * 400, 0, 'car', x, { face: i === faceCar });
  trainCar(ctx, 0, 0, 'loco', x);
  ctx.restore();
  // ånga
  steam(ctx, t, { x: x + 268 * scale, y: y - 215 * scale, seed: 320, n: 10 * puff, h: 300 * scale, w: 60 * scale, alpha: 0.55, color: '#f2f0ea' });
}

export function station(ctx, t, S) {
  camera(ctx, { z: 1.04, x: 0, y: 0 });
  sky(ctx, [[0, '#a9c2d6'], [1, '#f0e0c0']]);
  ctx.drawImage(cached('station-bak', W, H, c => {
    ridge(c, { y: 600, amp: 80, freq: 0.0025, seed: 330, color: '#9aa8b0' });
    forest(c, { y: 680, seed: 331, color: '#6a7a5a', h0: 50, h1: 110, gap: 22 });
    const r = rng(332);
    for (let i = 0; i < 7; i++) tree(c, 100 + i * 300 + r() * 80, 720, { size: 260 + r() * 60, seed: 333 + i, trunk: '#4a3328', leaves: ['#e8a33d', '#d9652a', '#c0392b'], leafAlpha: 0.9 });
    // spår
    c.fillStyle = '#5a5048'; c.fillRect(0, 880, W, 50);
    c.fillStyle = '#3a3430'; for (let x = 0; x < W; x += 40) c.fillRect(x, 884, 22, 44);
    c.fillStyle = '#8a8a8a'; c.fillRect(0, 878, W, 6); c.fillRect(0, 912, W, 6);
  }), 0, 0);
  // tåget accelererar ut åt höger
  const tx = 1100 + 0.5 * 26 * t * t + 10 * t;
  train(ctx, t, tx, 880, { scale: 1, cars: 3, faceCar: 2 });
  // perrong och tak
  ctx.fillStyle = '#7a6a5a'; ctx.fillRect(0, 930, W, 160);
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(0, 930, W, 14);
  ctx.fillStyle = '#3a2a22';
  for (let x = 120; x < W; x += 420) ctx.fillRect(x, 300, 22, 640);
  ctx.fillStyle = '#4a3a2e';
  ctx.beginPath(); ctx.moveTo(-40, 300); ctx.lineTo(W + 40, 300); ctx.lineTo(W + 40, 250); ctx.lineTo(-40, 250); ctx.fill();
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(-40, 300, W + 80, 20);
  // Haji vinkar
  const wave = Math.sin(t * 6);
  figure(ctx, 560, 1000, 420, LOOK.haji, { ...POSE.wave, arms: [150 + wave * 12, -8], elbows: [20 + wave * 12, 8] }, { f: 1 });
  const oh = ramp(t, lineStart(S, 1) - 0.2, lineStart(S, 1) + 0.6);
  if (oh > 0) {
    // ett litet ljus som saknas: tomt halsband-ikon i hörnet
    addGlow(ctx, tx - 800 + 144, 760, 80, '#fff3cc', 0.4 * oh * (0.5 + 0.5 * Math.sin(t * 10)));
  }
}

// ---------------------------------------------------------------- ljusstenen som flyger i parken (minne)
export function ljussten(ctx, t, S) {
  const night = ramp(t, lineStart(S, 1) - 1, lineStart(S, 1) + 3);
  camera(ctx, { z: 1.04, x: 0, y: 0 });
  parkScene(ctx, t, { dusk: 1 - night * 0.2, night: night * 0.9, alba: false });
  if (night > 0) {
    addGlow(ctx, 1500, 180, 200, '#e8ecf8', 0.3 * night);
    ctx.fillStyle = rgba('#eef0f8', night); ctx.beginPath(); ctx.arc(1500, 180, 44, 0, Math.PI * 2); ctx.fill();
  }
  const rest = ease(ramp(t, lineStart(S, 1), lineStart(S, 1) + 4));
  const path = u => [960 + 620 * Math.sin(u * 0.55), 430 + 170 * Math.sin(u * 1.1 + 0.6)];
  const [px, py] = path(t);
  const sx = lerp(px, 300, rest), sy = lerp(py, 800, rest);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 1; k < 18; k++) {
    const [qx, qy] = path(t - k * 0.05);
    glow(ctx, lerp(qx, 300, rest), lerp(qy, 800, rest), 30 - k, '#fff3cc', (1 - k / 18) * 0.5 * (1 - rest));
  }
  ctx.restore();
  addGlow(ctx, sx, sy, 140, '#fff3cc', 0.7);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath(); ctx.moveTo(sx, sy - 14); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx, sy + 14); ctx.lineTo(sx - 9, sy); ctx.fill();
  sparks(ctx, t, { seed: 340, n: 16, x: sx, y: sy, spread: 40, rise: 30, size: 3 });
}

// ---------------------------------------------------------------- inne i tåget
// Landskapsremsor som går att lägga omlott utan skarv (perioden är remsans bredd).
const STRIP = 2400;
function strip(key, draw) { return cached(key, STRIP, H, draw); }
function loopRidge(c, y, amp, seed, color) {
  const r = rng(seed), waves = [1, 2, 3, 5, 8].map(k => [k, r() * 6.28, 1 / k]);
  c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= STRIP; x += 8) {
    let v = 0;
    for (const [k, ph, a] of waves) v += Math.sin(x / STRIP * Math.PI * 2 * k + ph) * a;
    c.lineTo(x, y - v * amp * 0.5);
  }
  c.lineTo(STRIP, H); c.closePath(); c.fillStyle = color; c.fill();
}

export function taget(ctx, t, S) {
  const s = i => lineStart(S, i);
  const down = window_(t, 0.8, cueAt(S, 'skrattade', s(4)) + 0.3, 0.8);
  const burstT = cueAt(S, 'gnistorna', s(3) + 2);
  const burst = window_(t, burstT - 0.3, burstT + 5, 0.5);
  const laugh = window_(t, cueAt(S, 'skrattade', s(4)), cueAt(S, 'skrattade', s(4)) + 3, 0.4);
  camera(ctx, { z: 1.05, x: 0, y: 0 });
  // fönstret med landskapet som rusar förbi
  const wx = 200, wy = 170, ww = 1100, wh = 480;
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  sky(ctx, [[0, '#9ab8d0'], [1, '#f0dcb8']]);
  const far = strip('tag-far', c => loopRidge(c, 520, 90, 350, '#9aa6b0'));
  const mid = strip('tag-mid', c => {
    loopRidge(c, 600, 40, 351, '#7a8a6a');
    const r = rng(352);
    for (let i = 0; i < 14; i++) {
      const x = 80 + i * 170 + r() * 40, o = { size: 200 + r() * 60, seed: 353 + i, trunk: '#4a3328', leaves: ['#e8a33d', '#d9652a', '#c0392b', '#f0c050'] };
      for (const k of [-1, 0, 1]) tree(c, x + k * STRIP, 640, o);
    }
  });
  const near = strip('tag-near', c => {
    c.fillStyle = '#4a5a32'; c.fillRect(0, 650, 2400, 400);
    c.fillStyle = '#2a2018';
    for (let x = 100; x < 2400; x += 600) { c.fillRect(x, 220, 14, 460); c.fillRect(x - 40, 240, 94, 8); }
  });
  for (const [img, sp] of [[far, 30], [mid, 260], [near, 1100]]) {
    const off = (t * sp) % STRIP;
    ctx.drawImage(img, wx - off, 0); ctx.drawImage(img, wx - off + STRIP, 0);
  }
  ctx.restore();
  // vagnens insida
  ctx.fillStyle = '#4a2c1c';
  ctx.beginPath(); ctx.rect(-200, -200, W + 400, H + 400); ctx.rect(wx, wy, ww, wh); ctx.fill('evenodd');
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 22; ctx.strokeRect(wx, wy, ww, wh);
  ctx.fillStyle = '#3a2214'; ctx.fillRect(-200, 60, W + 400, 30);
  ctx.strokeStyle = '#8a7050'; ctx.lineWidth = 4;
  for (let x = 120; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 90); ctx.stroke(); }
  for (let y = 720; y < H + 40; y += 60) { ctx.fillStyle = rgba('#000000', 0.08); ctx.fillRect(-200, y, W + 400, 30); }
  // solfläckar som glider över väggen
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = ((-t * 300 + i * 700) % 2100 + 2100) % 2100 - 200;
    ctx.fillStyle = rgba('#ffe6b0', 0.1);
    ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x + 260, 700); ctx.lineTo(x + 360, H); ctx.lineTo(x + 100, H); ctx.fill();
  }
  ctx.restore();
  // bänken
  ctx.fillStyle = '#6a2a24'; ctx.beginPath(); ctx.roundRect(1320, 420, 120, 520, 20); ctx.fill();
  ctx.fillStyle = '#7a3028'; ctx.beginPath(); ctx.roundRect(820, 820, 640, 90, 18); ctx.fill();
  ctx.fillStyle = '#3a1a14'; ctx.fillRect(840, 910, 600, 170);
  // Alba
  const sway = Math.sin(t * 7) * 2;
  let pose = { ...POSE.sitStool, hipY: 0.47, lean: -6, arms: [30, 20], elbows: [50, 40], head: 2 };
  if (down > 0) pose = blendPose(pose, { ...pose, lean: 22, head: 40, arms: [60, 40], elbows: [110, 90] }, down);
  if (laugh > 0) pose = { ...pose, lean: pose.lean - 8 * laugh, head: pose.head - 20 * laugh + Math.sin(t * 14) * 4 * laugh };
  const a = figure(ctx, 1150, 1015 + sway, 380, LOOK.albaSweater, pose, { f: -1 });
  // gnistor ur tröjan
  if (burst > 0) {
    addGlow(ctx, a.neck[0], a.neck[1] + 10, 240, '#ffd890', 0.6 * burst);
    sparks(ctx, t, { seed: 360, n: 34, x: a.neck[0], y: a.neck[1] + 10, spread: 70, rise: 120, size: 3.5, alpha: burst, life: 1.6 });
  }
  addGlow(ctx, a.neck[0], a.neck[1] + 40, 60, '#ffd890', 0.25 + 0.15 * Math.sin(t * 3));
}

// ---------------------------------------------------------------- resan mot Kingeri
export function resan(ctx, t, S) {
  const sun = ramp(t, 4, 24);
  camera(ctx, { z: 1.0 + 0.05 * ease(ramp(t, 0, 27)), x: lerp(30, -30, t / 27), y: lerp(0, 30, ease(ramp(t, 18, 27))) });
  sky(ctx, [[0, mix('#6a8ab8', '#5a8ad0', sun)], [0.6, mix('#e0b090', '#f6d4a0', sun)], [1, mix('#f0c890', '#ffe2a8', sun)]]);
  addGlow(ctx, 1560, 360, 500 + sun * 300, '#fff0c0', 0.35 + 0.35 * sun);
  ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(1560, 360, 60, 0, Math.PI * 2); ctx.fill();
  // solstrålar genom molnen
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = 1.4 + i * 0.16 + Math.sin(t * 0.2 + i) * 0.02;
    ctx.fillStyle = rgba('#fff0c0', 0.06 * sun);
    ctx.beginPath(); ctx.moveTo(1560, 360); ctx.lineTo(1560 + Math.cos(a) * 1400 - 80, 360 + Math.sin(a) * 1400); ctx.lineTo(1560 + Math.cos(a) * 1400 + 80, 360 + Math.sin(a) * 1400); ctx.fill();
  }
  ctx.restore();
  clouds(ctx, t, { seed: 370, n: 6, y0: 120, y1: 340, color: '#ffffff', alpha: 0.35, speed: 8 });
  ctx.drawImage(cached('resan-land', W, H, c => {
    // havet och hamnstaden längst bort
    c.fillStyle = '#8ab0c8'; c.fillRect(1100, 520, 900, 40);
    const r = rng(371);
    for (let i = 0; i < 14; i++) {
      const x = 1250 + i * 40 + r() * 10, h = 20 + r() * 40;
      c.fillStyle = '#6a6a88'; c.fillRect(x, 525 - h, 32, h);
      c.beginPath(); c.moveTo(x - 4, 525 - h); c.lineTo(x + 16, 525 - h - 16); c.lineTo(x + 36, 525 - h); c.fill();
    }
    ridge(c, { y: 580, amp: 70, freq: 0.0025, seed: 372, color: '#8a9aa6' });
    forest(c, { y: 640, seed: 373, color: '#7a6a4a', h0: 40, h1: 90, gap: 18 });
    for (let i = 0; i < 12; i++) tree(c, 40 + i * 170 + r() * 50, 720, { size: 200 + r() * 70, seed: 374 + i, trunk: '#4a3328', leaves: ['#e8a33d', '#d9652a', '#c0392b', '#f0c050'] });
    // dalen och viadukten
    c.fillStyle = '#6a5a3a';
    c.beginPath(); c.moveTo(-100, 700); c.quadraticCurveTo(960, 1100, 2020, 700); c.lineTo(2020, H + 10); c.lineTo(-100, H + 10); c.fill();
    c.fillStyle = '#8a7a66'; c.fillRect(-100, 760, 2120, 40);
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 230;
      c.fillStyle = '#8a7a66'; c.fillRect(x, 800, 50, 400);
      c.fillStyle = '#6a5a4a';
      c.beginPath(); c.arc(x + 140, 940, 90, Math.PI, 0); c.lineTo(x + 230, 1200); c.lineTo(x + 50, 1200); c.fill();
    }
  }), 0, 0);
  // lyktorna i Kingeri tänds
  for (let i = 0; i < 10; i++) addGlow(ctx, 1260 + i * 55, 510 + (i % 3) * 6, 14, '#ffcf7a', 0.5 + 0.3 * Math.sin(t * 2 + i));
  const tx = -300 + t * 95;
  train(ctx, t, tx, 760, { scale: 0.5, cars: 3, faceCar: 2, puff: 1 });
  // ljusstenens lilla sken i fönstret
  addGlow(ctx, tx - 2 * 400 * 0.5 + 72, 760 - 64, 30, '#fff3cc', 0.8 + 0.2 * Math.sin(t * 5));
  fallingLeaves(ctx, t, { seed: 375, n: 22, wind: 60, fall: 40, size: 11 });
}

// ---------------------------------------------------------------- eftertext
export function slut(ctx, t, S) {
  sky(ctx, [[0, '#070b1e'], [0.6, '#1c1f40'], [1, '#3a2a48']]);
  stars(ctx, t, { seed: 380, n: 180, alpha: 1 });
  fallingLeaves(ctx, t, { seed: 381, n: 20, wind: 30, fall: 30, size: 11, alpha: 0.7 });
  sparks(ctx, t, { seed: 382, n: 30, x: 960, y: 900, spread: 700, rise: 200, size: 3, alpha: 0.8, life: 6 });
  title(ctx, 'ILVANIAS VÄKTARE', W / 2, H * 0.38, { font: FONT.cinzel, size: 104, alpha: ramp(t, 0.3, 2), spacing: 6 });
  title(ctx, 'Sommarens bästa dag', W / 2, H * 0.48, { font: FONT.cormorantItalic, size: 56, alpha: ramp(t, 1, 2.6), glowA: 0.4 });
  title(ctx, 'Fortsättning följer …', W / 2, H * 0.64, { font: FONT.cormorantItalic, size: 44, alpha: ramp(t, 2.8, 4.4), color: '#e8dcc0', glowA: 0.3 });
}
