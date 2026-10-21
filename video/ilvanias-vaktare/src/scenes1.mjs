// Scener: titel → väktarna (första halvan av filmen).
import {
  W, H, clamp, lerp, smooth, ease, ramp, window_, rng, fbm, noise1, mix, rgba, cached,
  sky, glow, addGlow, tint, ridge, clouds, cloud, stars, fallingLeaves, rain, sparks, steam,
  tree, pine, forest, bamboo, house, lanternString, sea, waveY, boat,
  POSE, blendPose, walkPose, LOOK, figure, title, lineInfo, lineStart, lineEnd,
} from './lib.mjs';
import { layer, camera, FONT } from './stage.mjs';

// ---------------------------------------------------------------- titel
export function titel(ctx, t, S) {
  const dawn = ramp(t, 0, 9);
  sky(ctx, [[0, mix('#070b1e', '#1c2448', dawn)], [0.55, mix('#1d2246', '#4a3f6b', dawn)],
    [0.82, mix('#3a2d50', '#b4645a', dawn)], [1, mix('#5a3a4a', '#efb067', dawn)]]);
  stars(ctx, t, { seed: 3, n: 160, alpha: 1 - dawn * 0.7 });
  addGlow(ctx, W * 0.5, H * 0.86, 900, '#ffb070', 0.25 + dawn * 0.35);
  ctx.drawImage(cached('titel-land', W, H, c => {
    ridge(c, { y: 760, amp: 160, freq: 0.0021, seed: 11, color: '#2e2a48', sharp: 0.5 });
    ridge(c, { y: 850, amp: 90, freq: 0.0032, seed: 12, color: '#1f1b33' });
    forest(c, { y: 905, seed: 4, color: '#140f1f', h0: 40, h1: 110, gap: 18 });
    ridge(c, { y: 960, amp: 40, freq: 0.004, seed: 13, color: '#0f0b17' });
  }), 0, 0);
  fallingLeaves(ctx, t, { seed: 5, n: 26, wind: 50, fall: 45, size: 11, alpha: 0.85 });
  // ljusstenens gnista drar över himlen
  const p = ease(ramp(t, 0.3, 4.2));
  const sx = lerp(-80, W * 0.5, p), sy = lerp(H * 0.62, H * 0.385, p) - Math.sin(p * Math.PI) * 120;
  const fade = 1 - ramp(t, 4.2, 6);
  addGlow(ctx, sx, sy, 90, '#fff3cc', 0.9 * fade);
  sparks(ctx, t, { seed: 9, n: 14, x: sx, y: sy, spread: 40, rise: 20, size: 3, alpha: fade });
  const a1 = ramp(t, 3.2, 5.2), a2 = ramp(t, 4.6, 6.4);
  title(ctx, 'ILVANIAS VÄKTARE', W / 2, H * 0.4, { font: FONT.cinzel, size: 128, alpha: a1, spacing: 8 });
  ctx.save();
  ctx.globalAlpha = a2 * 0.7;
  ctx.strokeStyle = '#f6e7c1';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 260 * a2, H * 0.47); ctx.lineTo(W / 2 + 260 * a2, H * 0.47); ctx.stroke();
  ctx.restore();
  title(ctx, 'Sommarens bästa dag', W / 2, H * 0.535, { font: FONT.cormorantItalic, size: 66, alpha: a2, glowA: 0.4 });
}

// ---------------------------------------------------------------- hav
export function hav(ctx, t, S) {
  const wild = 0.55 + 0.7 * ramp(t, lineStart(S, 2) - 3, lineStart(S, 2) + 5);
  camera(ctx, { z: 1.04 + Math.sin(t * 0.4) * 0.01, x: Math.sin(t * 0.23) * 14, y: Math.sin(t * 0.5) * 8 * wild });
  sky(ctx, [[0, '#141c25'], [0.45, '#2f3d48'], [0.7, '#56656c'], [1, '#7c8a8c']]);
  clouds(ctx, t, { seed: 21, n: 9, y0: 60, y1: 380, color: '#0f151c', alpha: 0.75, speed: -45 });
  clouds(ctx, t, { seed: 22, n: 7, y0: 200, y1: 470, color: '#3c4850', alpha: 0.6, speed: -80 });
  // klippa med fyr
  ctx.drawImage(cached('hav-klippa', W, H, c => {
    c.fillStyle = '#10161b';
    c.beginPath();
    c.moveTo(-50, 700); c.lineTo(-50, 420); c.lineTo(80, 400); c.lineTo(170, 430);
    c.lineTo(260, 520); c.lineTo(330, 610); c.lineTo(420, 700); c.closePath(); c.fill();
    c.fillStyle = '#d8d2c4'; c.fillRect(100, 300, 34, 104);
    c.fillStyle = '#a33b2c'; c.fillRect(100, 330, 34, 16); c.fillRect(100, 370, 34, 16);
    c.fillStyle = '#1b1f22'; c.fillRect(96, 284, 42, 18);
    c.beginPath(); c.moveTo(94, 284); c.lineTo(117, 262); c.lineTo(140, 284); c.fill();
  }), 0, 0);
  const beam = t * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bx = 117, by = 293, dir = Math.cos(beam);
  const g = ctx.createLinearGradient(bx, by, bx + dir * 1200, by);
  g.addColorStop(0, rgba('#ffe9b0', 0.35 * Math.abs(dir)));
  g.addColorStop(1, rgba('#ffe9b0', 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir * 1300, by - 90); ctx.lineTo(bx + dir * 1300, by + 70); ctx.fill();
  ctx.restore();
  addGlow(ctx, 117, 293, 70, '#ffe9b0', 0.8);
  const layers = [
    { base: 640, amp: 12 * wild, len: 260, speed: 0.10, seed: 1, top: '#3c4c55', bottom: '#2a363d', foam: 0.15 },
    { base: 700, amp: 26 * wild, len: 380, speed: 0.13, seed: 2, top: '#2f3f48', bottom: '#1e2a31', foam: 0.25 },
  ];
  sea(ctx, t, layers);
  // båten
  const sink = ramp(t, lineEnd(S, 2) - 4.5, lineEnd(S, 2) + 0.5);
  const L3 = { base: 790, amp: 50 * wild, len: 520, speed: 0.16, seed: 3, top: '#284049', bottom: '#15222a', foam: 0.35 };
  const bx2 = 1020 + t * 6;
  const yb = waveY(bx2, t, L3), slope = (waveY(bx2 + 30, t, L3) - waveY(bx2 - 30, t, L3)) / 60;
  boat(ctx, bx2, yb + 4 + sink * 220, Math.atan(slope) * 0.9 + sink * 0.5, 1.5, { light: 0.6 * (1 - sink), hull: '#120e0c', sail: '#b9ad97', sailAlpha: 1 });
  sea(ctx, t, [L3]);
  const L4 = { base: 930 - 30 * sink, amp: 85 * wild + sink * 60, len: 700, speed: 0.2, seed: 4, top: '#1f343c', bottom: '#0b1418', foam: 0.5, foamW: 4 };
  sea(ctx, t, [L4]);
  rain(ctx, t, { seed: 7, n: 260, angle: 0.35, speed: 1500, len: 46, alpha: 0.18 + 0.1 * wild });
  // vindblåsta höstlöv i början
  fallingLeaves(ctx, t, { seed: 8, n: 18, wind: 260, fall: 80, size: 13, alpha: 0.9 * (1 - ramp(t, 9, 14)) });
  tint(ctx, '#20384a', 0.18);
}

// ---------------------------------------------------------------- hamn
export function hamn(ctx, t, S) {
  const li = lineInfo(S, S.start + t);
  const blood = window_(t, lineStart(S, 2) - 0.5, lineEnd(S, 2) + 1.5, 2.2);
  const cold = ramp(t, lineStart(S, 3), lineStart(S, 3) + 4);
  const dread = ramp(t, lineStart(S, 4) - 1, lineStart(S, 4) + 3);
  camera(ctx, { z: 1.03 + 0.04 * ramp(t, 0, 43), x: lerp(20, -30, t / 43), y: 0 });
  sky(ctx, [[0, mix('#161d33', '#0c1020', dread)], [0.55, mix('#3e4362', '#262840', dread)], [0.85, mix('#a06a5a', '#4a3a48', dread)], [1, mix('#d09060', '#6a4a40', dread)]]);
  stars(ctx, t, { seed: 31, n: 60, y1: 400, alpha: 0.4 + dread * 0.4 });
  // månen
  const mx = 1460, my = 250;
  const moonC = mix('#f2ead6', '#b8321e', blood);
  addGlow(ctx, mx, my, 260, blood > 0.05 ? '#c03a22' : '#f2ead6', 0.25 + blood * 0.35);
  ctx.fillStyle = moonC;
  ctx.beginPath(); ctx.arc(mx, my, 72, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba('#000000', 0.08);
  ctx.beginPath(); ctx.arc(mx - 20, my - 14, 16, 0, Math.PI * 2); ctx.arc(mx + 24, my + 18, 11, 0, Math.PI * 2); ctx.fill();
  clouds(ctx, t, { seed: 32, n: 6, y0: 120, y1: 380, color: '#1b1f30', alpha: 0.5 + cold * 0.35, speed: -18 - cold * 30 });
  // havet
  sea(ctx, t, [
    { base: 660, amp: 8, len: 300, speed: 0.06, seed: 5, top: '#3b4560', bottom: '#222a3c' },
  ]);
  // månens spegling
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const y = 672 + i * 10, w = 70 - i * 3 + Math.sin(t * 2 + i) * 14;
    ctx.fillStyle = rgba(blood > 0.3 ? '#d04a2a' : '#f2ead6', 0.18 - i * 0.01);
    ctx.fillRect(mx - w / 2 + Math.sin(t * 1.3 + i * 0.7) * 8, y, w, 3);
  }
  ctx.restore();
  // byn
  ctx.drawImage(cached('hamn-by', W, H, c => {
    ridge(c, { y: 640, amp: 60, freq: 0.003, seed: 33, color: '#1a1a26', x0: -200, x1: 900 });
    const r = rng(34);
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 95 + r() * 20, h = 90 + r() * 70, w = 80 + r() * 30;
      house(c, x, 700 - r() * 30, w, h, { wall: '#20192a', roof: '#140f1a', window: '#ffc56b', lit: 0.8, seed: i + 7 });
    }
  }), 0, 0);
  sea(ctx, t, [{ base: 745, amp: 10, len: 340, speed: 0.08, seed: 6, top: '#2a3148', bottom: '#151a28' }]);
  // båtar vid bryggan
  for (let i = 0; i < 2; i++) {
    const bx = 980 + i * 260, by = 770 + Math.sin(t * 1.1 + i * 2) * 6;
    boat(ctx, bx, by, Math.sin(t * 0.9 + i) * 0.05, 0.75, { hull: '#0e0b10', sail: '#7d7266', sailAlpha: 0.0, light: 0.5 });
  }
  // bryggan
  ctx.fillStyle = '#120d0f';
  ctx.fillRect(-60, 780, 1000, 22);
  for (let x = -40; x < 940; x += 70) ctx.fillRect(x, 790, 12, 120);
  sea(ctx, t, [{ base: 880, amp: 12, len: 420, speed: 0.09, seed: 7, top: '#1d2335', bottom: '#0a0d16' }]);
  // fiskarna på bryggan
  const fish = [[560, 1], [660, 1], [760, 1]];
  fish.forEach(([x, f], i) => {
    const pose = i === 1 ? POSE.hold : blendPose(POSE.stand, POSE.bow, 0.15 + 0.1 * Math.sin(t * 0.5 + i));
    const r = figure(ctx, x, 782, 190, LOOK.fisher, pose, { f });
    if (i === 1) addGlow(ctx, r.hand[0] + 10, r.hand[1] + 10, 90, '#ffbf66', 0.75 + 0.15 * Math.sin(t * 7));
  });
  // de gamla som viskar
  if (dread > 0) {
    const ga = dread;
    const hunch = { ...POSE.stand, lean: 24, head: 14, arms: [28, 10], elbows: [30, 10], thighs: [8, -4], knees: [-10, -6] };
    figure(ctx, 230, 990, 270, LOOK.elder, hunch, { f: 1, alpha: ga, extra: (c, o) => { c.strokeStyle = '#0d0b10'; c.lineWidth = 8; c.beginPath(); c.moveTo(o.hand[0], o.hand[1]); c.lineTo(o.hand[0] + 24, 0); c.stroke(); } });
    figure(ctx, 380, 990, 260, LOOK.elder, { ...hunch, lean: 16 }, { f: -1, alpha: ga });
    addGlow(ctx, 310, 900, 220, '#ff9a4a', 0.25 * ga + 0.05 * Math.sin(t * 8));
    // fyra små ljus över havet – väktarna
    const cols = ['#ffffff', '#7fb2ff', '#ff7a5a', '#7dd69a'];
    cols.forEach((c, i) => {
      const fl = 0.55 + 0.45 * Math.sin(t * (2 + i) + i * 2) * Math.sin(t * 0.7 + i);
      addGlow(ctx, 1180 + i * 70, 560 + Math.sin(t + i) * 8, 40, c, ga * fl * 0.9);
    });
  }
  // kyla och mörker
  tint(ctx, '#3a5a80', cold * 0.12);
  tint(ctx, '#05060c', dread * 0.25);
  void li;
}

// ---------------------------------------------------------------- rummet (Albas rum)
export function roomBackdrop(ctx, t, { light = 1, frost = 0, day = 0 }) {
  // väggen
  sky(ctx, [[0, '#2b2018'], [1, '#1c140f']]);
  // rispappersvägg
  const px = 260, py = 120, pw = 1400, ph = 620;
  const paper = mix('#7f7564', mix('#efe2c6', '#fff6e2', day), light);
  ctx.fillStyle = paper;
  ctx.fillRect(px, py, pw, ph);
  addGlow(ctx, px + pw * 0.65, py + ph * 0.4, 700, '#fff2d0', 0.25 * light);
  // lönnens skugga genom papperet
  const shadowTree = cached('rum-lonnskugga', W, H, c => {
    tree(c, W / 2, H, { size: 900, seed: 41, trunk: '#5a3020', leaves: ['#8a3b20', '#a2452a', '#7a3220'], leafAlpha: 1, density: 1.3, puff: 1.2 });
  });
  ctx.save();
  ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.globalAlpha = 0.24 * light;
  ctx.filter = 'blur(6px)';
  ctx.translate(px + pw * 0.62 + Math.sin(t * 0.7) * 6, py + ph + 160);
  ctx.rotate(Math.sin(t * 0.6) * 0.012);
  ctx.drawImage(shadowTree, -W / 2, -H);
  ctx.restore();
  // frost i hörnen
  if (frost > 0) {
    ctx.save();
    ctx.strokeStyle = rgba('#ffffff', 0.55 * frost);
    ctx.lineWidth = 1.5;
    const r = rng(42);
    for (let k = 0; k < 4; k++) {
      const cx = k % 2 ? px + pw : px, cy = k < 2 ? py : py + ph;
      for (let i = 0; i < 26; i++) {
        const a = (k === 0 ? 0 : k === 1 ? Math.PI / 2 : k === 2 ? -Math.PI / 2 : Math.PI) + r() * Math.PI / 2;
        const len = (40 + r() * 140) * frost;
        const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
        for (let j = 1; j < 4; j++) {
          const bx = lerp(cx, ex, j / 4), by = lerp(cy, ey, j / 4);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * len * 0.15, by + Math.sin(a + 0.7) * len * 0.15);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * len * 0.15, by + Math.sin(a - 0.7) * len * 0.15);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // ramverket
  ctx.fillStyle = '#2e1f15';
  for (let i = 0; i <= 8; i++) ctx.fillRect(px + i * pw / 8 - 6, py, 12, ph);
  for (let j = 0; j <= 4; j++) ctx.fillRect(px, py + j * ph / 4 - 6, pw, 12);
  ctx.fillStyle = '#24170f';
  ctx.fillRect(px - 30, py - 40, pw + 60, 40);
  ctx.fillRect(px - 30, py + ph, pw + 60, 30);
  // golvet
  const g = ctx.createLinearGradient(0, 770, 0, H);
  g.addColorStop(0, '#5a3f2b'); g.addColorStop(1, '#2a1c13');
  ctx.fillStyle = g;
  ctx.fillRect(-W, 770, W * 3, H);
  ctx.strokeStyle = rgba('#000000', 0.25);
  ctx.lineWidth = 2;
  for (let i = -10; i < 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 60, 770); ctx.lineTo(W / 2 + i * 190, H); ctx.stroke(); }
  addGlow(ctx, 1100, 840, 600, '#ffe6b8', 0.12 * light);
}

export function rummet(ctx, t, S) {
  const frost = ramp(t, lineStart(S, 1), lineStart(S, 1) + 6);
  camera(ctx, { z: 1.02 + 0.05 * ramp(t, 0, 40), x: -20, y: 10 });
  roomBackdrop(ctx, t, { light: 0.55 + 0.45 * ramp(t, 0, 20), frost });
  // madrassen
  ctx.fillStyle = '#d9d2c3';
  ctx.beginPath(); ctx.roundRect(520, 840, 620, 70, 18); ctx.fill();
  ctx.fillStyle = '#bfb6a5';
  ctx.fillRect(520, 890, 620, 20);
  ctx.fillStyle = '#e8e1d3';
  ctx.beginPath(); ctx.roundRect(540, 812, 150, 46, 20); ctx.fill();
  // Alba: ligger → sitter upp → ställer sig
  const sitUp = ease(ramp(t, 1.2, 3.6));
  const standUp = ease(ramp(t, lineStart(S, 3) + 2.5, lineStart(S, 3) + 4.5));
  const lying = { hipY: 0.07, lean: -84, thighs: [92, 90], knees: [-2, 0], arms: [-10, -20], elbows: [0, 0], head: -6 };
  const sit = { hipY: 0.09, lean: -2, thighs: [112, 108], knees: [-88, -84], arms: [34, 20], elbows: [40, 30], head: 2 };
  let pose = blendPose(lying, sit, sitUp);
  let x = 720, y = 852;
  if (standUp > 0) {
    pose = blendPose(pose, POSE.stand, standUp);
    x = lerp(720, 1400, ease(ramp(t, lineStart(S, 3) + 3.5, lineStart(S, 3) + 11)));
    y = lerp(852, 900, standUp);
    if (t > lineStart(S, 3) + 4.5) pose = blendPose(POSE.stand, walkPose((t - lineStart(S, 3)) * 6), ramp(t, lineStart(S, 3) + 4.5, lineStart(S, 3) + 5) * (1 - ramp(t, lineStart(S, 3) + 10.5, lineStart(S, 3) + 11)));
  }
  const look = LOOK.albaSweater;
  const pj = { ...look, body: '#c9cdd6', limb: '#c9cdd6', limbBack: '#aab0bb', legs: '#c9cdd6', legsBack: '#aab0bb', knit: false };
  const a = figure(ctx, x, y, 330, pj, pose, { f: 1 });
  // täcket
  ctx.fillStyle = '#5c6f8a';
  ctx.beginPath();
  const cover = 1 - standUp;
  ctx.moveTo(800, 900); ctx.quadraticCurveTo(900, 830 - 10 * (1 - sitUp), 1120, 860);
  ctx.lineTo(1130, 905); ctx.lineTo(800 - 120 * (1 - sitUp), 905); ctx.closePath();
  ctx.globalAlpha = cover; ctx.fill(); ctx.globalAlpha = 1;
  // tofflor
  ctx.fillStyle = rgba('#7a3b2e', 1 - ramp(t, lineStart(S, 3) + 2.2, lineStart(S, 3) + 3.2));
  ctx.beginPath(); ctx.ellipse(1180, 925, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1240, 925, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
  // andedräkt i kylan
  steam(ctx, t, { x: a.head[0] + 34, y: a.head[1] + 14, seed: 4, n: 4, h: 70, w: 40, alpha: 0.18 + frost * 0.15 });
  // tankar på vännerna
  const th = window_(t, lineStart(S, 2) + 4, lineEnd(S, 2) + 0.8, 1.2);
  if (th > 0) {
    const friends = [['Stella', LOOK.stella, 1180], ['Gero', LOOK.gero, 1380], ['Adrian', LOOK.adrian, 1580]];
    friends.forEach(([name, lk, fx], i) => {
      const k = smooth(clamp(th * 3 - i * 0.6));
      const fy = 330 + Math.sin(t * 1.2 + i) * 10;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = '#3a2a20';
      ctx.beginPath(); ctx.arc(fx, fy, 92, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffe9b8'; ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      addGlow(ctx, fx, fy, 120, '#ffe9b8', 0.35 * k);
      figure(ctx, fx, fy + 72, 140, lk, POSE.wave, { f: i % 2 ? -1 : 1, alpha: k });
      title(ctx, name, fx, fy + 132, { font: FONT.cormorant, size: 44, alpha: k, color: '#3a2a20', glowA: 0 });
    });
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = rgba('#fff3d6', 0.6 * th);
      ctx.beginPath(); ctx.arc(a.head[0] + 70 + i * 60, a.head[1] - 40 - i * 50, 8 + i * 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  tint(ctx, '#6f8fb8', 0.08 + frost * 0.08);
}

// ---------------------------------------------------------------- festival (hamnstaden Kingeri)
export function festival(ctx, t, S) {
  camera(ctx, { z: 1.08 - 0.06 * ease(ramp(t, 0, 32)), x: lerp(-40, 40, t / 32), y: 0 });
  const warm = ramp(t, lineEnd(S, 2) - 6, lineEnd(S, 2));
  sky(ctx, [[0, '#2f2a55'], [0.4, '#7a4a6a'], [0.72, '#d6735a'], [1, '#f5c46a']]);
  addGlow(ctx, 1000, 640, 520, '#ffd38a', 0.45 + warm * 0.3);
  ctx.fillStyle = '#ffe1a0';
  ctx.beginPath(); ctx.arc(1000, 640, 70, 0, Math.PI * 2); ctx.fill();
  clouds(ctx, t, { seed: 51, n: 6, y0: 120, y1: 420, color: '#f0a07a', alpha: 0.25, speed: 10 });
  sea(ctx, t, [{ base: 690, amp: 5, len: 240, speed: 0.05, seed: 8, top: '#c4826a', bottom: '#5a4060' }]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const y = 700 + i * 9, w = 120 - i * 4 + Math.sin(t * 2 + i) * 20;
    ctx.fillStyle = rgba('#ffd38a', 0.22 - i * 0.01);
    ctx.fillRect(1000 - w / 2 + Math.sin(t + i) * 10, y, w, 3);
  }
  ctx.restore();
  // fartyg
  for (let i = 0; i < 3; i++) {
    const x = 1300 + i * 170, y = 735 + Math.sin(t * 0.8 + i) * 4;
    boat(ctx, x, y, Math.sin(t * 0.7 + i) * 0.03, 1.2 - i * 0.15, { hull: '#2a1830', sail: '#f3d8b8', sailAlpha: 0.9, light: 0.4 });
  }
  // staden
  ctx.drawImage(cached('festival-stad', W, H, c => {
    const r = rng(52);
    for (let i = 0; i < 11; i++) {
      const x = -60 + i * 120 + r() * 30, w = 100 + r() * 40, h = 140 + r() * 140;
      house(c, x, 820, w, h, { wall: '#3a2240', roof: '#2a1530', window: '#ffd27a', lit: 0.9, seed: 60 + i, curved: i % 3 === 0, roofH: 0.6 });
    }
    // torn
    c.fillStyle = '#2f1a36'; c.fillRect(520, 420, 70, 400);
    c.beginPath(); c.moveTo(500, 420); c.lineTo(555, 330); c.lineTo(610, 420); c.fill();
    for (let i = 0; i < 6; i++) {
      const x = 1240 + i * 110 + r() * 20, w = 90 + r() * 30, h = 110 + r() * 80;
      house(c, x, 830, w, h, { wall: '#3a2240', roof: '#2a1530', window: '#ffd27a', lit: 0.9, seed: 80 + i, curved: i % 2 === 0, roofH: 0.6 });
    }
  }), 0, 0);
  // flaggor
  for (let i = 0; i < 4; i++) {
    const fx = 330 + i * 420, fy = 470 + (i % 2) * 40;
    ctx.fillStyle = '#20122a'; ctx.fillRect(fx, fy, 6, 360);
    ctx.fillStyle = ['#e04a3a', '#3a7ad0', '#e0b030', '#3aa060'][i];
    ctx.beginPath(); ctx.moveTo(fx + 6, fy);
    for (let k = 0; k <= 10; k++) ctx.lineTo(fx + 6 + k * 12, fy + Math.sin(t * 5 + k * 0.6 + i) * (2 + k * 0.8));
    for (let k = 10; k >= 0; k--) ctx.lineTo(fx + 6 + k * 12, fy + 50 + Math.sin(t * 5 + k * 0.6 + i) * (2 + k * 0.8));
    ctx.fill();
  }
  lanternString(ctx, t, { x0: -50, y0: 560, x1: 700, y1: 600, sag: 50, n: 10 });
  lanternString(ctx, t, { x0: 700, y0: 600, x1: 1400, y1: 560, sag: 55, n: 10 });
  lanternString(ctx, t, { x0: 1400, y0: 560, x1: 1990, y1: 620, sag: 40, n: 8 });
  // fyrverkerier
  const r = rng(53);
  for (let k = 0; k < 8; k++) {
    const t0 = 3 + k * 3.6 + r() * 1.5, age = t - t0;
    const fx = 300 + r() * 1300, fy = 140 + r() * 220, col = ['#ffd27a', '#ff7a6a', '#9ad0ff', '#c6ff9a'][k % 4];
    if (age < 0 || age > 2.6) continue;
    const a = 1 - age / 2.6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) {
      const ang = i / 36 * Math.PI * 2, d = ease(Math.min(1, age / 1.2)) * 150;
      const px = fx + Math.cos(ang) * d, py = fy + Math.sin(ang) * d + age * age * 18;
      glow(ctx, px, py, 14, col, a);
    }
    glow(ctx, fx, fy, 120, col, a * 0.3 * (1 - Math.min(1, age)));
    ctx.restore();
  }
  // folkmassan
  ctx.fillStyle = '#140a18';
  ctx.fillRect(-W, 900, W * 3, H);
  const rr = rng(54);
  for (let i = 0; i < 26; i++) {
    const dir = rr() < 0.5 ? -1 : 1, sp = 30 + rr() * 40, h = 150 + rr() * 60;
    const x = ((rr() * (W + 400) + dir * sp * t) % (W + 400) + W + 400) % (W + 400) - 200;
    figure(ctx, x, 930 + rr() * 30, h, LOOK.shadow, walkPose(t * sp / 9 + i, 1), { f: dir });
  }
  // träd i kanterna
  ctx.drawImage(cached('festival-trad', W, H, c => {
    tree(c, 60, 1000, { size: 700, seed: 55, trunk: '#1a0d10', leafAlpha: 0.95 });
    tree(c, 1880, 1010, { size: 640, seed: 56, trunk: '#1a0d10', leafAlpha: 0.95 });
  }), 0, 0);
  fallingLeaves(ctx, t, { seed: 57, n: 40, wind: 70 + 120 * window_(t, lineStart(S, 2), lineStart(S, 2) + 6, 2), fall: 55, size: 13 });
  tint(ctx, '#ffb070', warm * 0.08);
}

// ---------------------------------------------------------------- parken i Ninjali
function parkScene(ctx, t, { dusk = 0, night = 0, alba = true } = {}) {
  sky(ctx, [[0, mix(mix('#9db6cc', '#3d3a66', dusk), '#0b1026', night)], [0.6, mix(mix('#e6dcc8', '#c47a6a', dusk), '#1d2244', night)], [1, mix(mix('#f6e6c6', '#e8a070', dusk), '#2a2a4a', night)]]);
  if (night > 0) stars(ctx, t, { seed: 61, n: 120, y1: 500, alpha: night });
  ctx.drawImage(cached('park-bak', W, H, c => {
    ridge(c, { y: 520, amp: 120, freq: 0.0025, seed: 62, color: '#9aa6b4', sharp: 0.4 });
    ridge(c, { y: 590, amp: 70, freq: 0.0035, seed: 63, color: '#7d8a8c' });
    forest(c, { y: 640, seed: 64, color: '#5f6e60', h0: 50, h1: 100, gap: 20 });
    const r = rng(65);
    for (let i = 0; i < 9; i++) tree(c, 80 + i * 230 + r() * 60, 700, { size: 240 + r() * 90, seed: 66 + i, trunk: '#4a3328', leaves: ['#e8a33d', '#f0c050', '#d98a2b', '#c9652a'], leafAlpha: 0.9 });
  }), 0, 0);
  // dammen
  const g = ctx.createLinearGradient(0, 700, 0, 900);
  g.addColorStop(0, '#8aa0aa'); g.addColorStop(1, '#4e6670');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(1000, 800, 760, 110, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(1000, 800, 760, 110, 0, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.translate(0, 1400); ctx.scale(1, -1);
  ctx.drawImage(cached('park-lonn', W, H, c => tree(c, 1180, 700, { size: 560, seed: 71, trunk: '#3a2018', leaves: ['#c0392b', '#d4492a', '#a8321f', '#e0612a'], density: 1.4, puff: 1.2 })), 0, 0);
  ctx.restore();
  ctx.strokeStyle = rgba('#ffffff', 0.25);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = 760 + i * 16, ph = t * 0.6 + i;
    ctx.beginPath(); ctx.moveTo(500 + Math.sin(ph) * 40, y); ctx.lineTo(620 + Math.sin(ph) * 40, y); ctx.stroke();
  }
  // stora lönnen
  ctx.save();
  ctx.translate(1180, 700); ctx.rotate(Math.sin(t * 0.5) * 0.004); ctx.translate(-1180, -700);
  ctx.drawImage(cached('park-lonn', W, H, () => {}), 0, 0);
  ctx.restore();
  // bron
  ctx.strokeStyle = '#a8322a'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.moveTo(620, 830); ctx.quadraticCurveTo(820, 700, 1020, 830); ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(630, 790); ctx.quadraticCurveTo(820, 660, 1010, 790); ctx.stroke();
  for (let i = 0; i <= 8; i++) {
    const u = i / 8, x = lerp(630, 1010, u);
    const y1 = (1 - u) * (1 - u) * 790 + 2 * u * (1 - u) * 660 + u * u * 790;
    const y2 = (1 - u) * (1 - u) * 830 + 2 * u * (1 - u) * 700 + u * u * 830;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  }
  if (alba) figure(ctx, 820, 766, 150, LOOK.albaWhite, POSE.stand, { f: 1 });
  // stenlykta
  ctx.fillStyle = '#5a5a58';
  ctx.fillRect(1560, 760, 30, 120); ctx.fillRect(1530, 740, 90, 30); ctx.fillRect(1540, 700, 70, 44);
  ctx.beginPath(); ctx.moveTo(1510, 700); ctx.lineTo(1575, 660); ctx.lineTo(1640, 700); ctx.fill();
  addGlow(ctx, 1575, 722, 90, '#ffd27a', 0.3 + night * 0.5);
  // gräsmatta i förgrunden
  const gg = ctx.createLinearGradient(0, 880, 0, H);
  gg.addColorStop(0, mix('#6b7a3a', '#1a2030', night)); gg.addColorStop(1, mix('#3a4a22', '#0c1018', night));
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.moveTo(-100, H + 10); ctx.lineTo(-100, 900);
  ctx.quadraticCurveTo(500, 860, 1000, 905); ctx.quadraticCurveTo(1500, 940, 2100, 880); ctx.lineTo(2100, H + 10); ctx.fill();
  // jasminbusken
  ctx.drawImage(cached('park-jasmin', W, H, c => {
    const r = rng(72);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = ['#2f4a2a', '#3d5c34', '#26401f'][i % 3];
      c.beginPath(); c.arc(260 + (r() - 0.5) * 360, 900 - r() * 170 * (1 - Math.abs(r() - 0.5)), 26 + r() * 30, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 90; i++) {
      c.fillStyle = '#fbfaf4';
      const x = 260 + (r() - 0.5) * 340, y = 900 - r() * 180;
      for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(x + Math.cos(p * 1.256) * 5, y + Math.sin(p * 1.256) * 5, 4, 0, Math.PI * 2); c.fill(); }
    }
  }), 0, 0);
  // bambu till höger
  bamboo(ctx, t, { x: 1840, y: 1000, h: 700, seed: 73, n: 6, spread: 200, color: mix('#3f6b3a', '#141c18', night), leaf: mix('#4f8a46', '#18241c', night) });
  fallingLeaves(ctx, t, { seed: 74, n: 34, wind: 25, fall: 40, size: 12 });
  tint(ctx, '#2a1a40', dusk * 0.15);
}

export function parken(ctx, t, S) {
  const blind = ease(ramp(t, lineStart(S, 2), lineStart(S, 2) + 5));
  camera(ctx, { z: 1.0 + 0.06 * ease(ramp(t, 0, 36)), x: 0, y: -10 });
  if (blind <= 0) return parkScene(ctx, t);
  layer(ctx, c => parkScene(c, t), { blur: blind * 46 });
  // bara ljus och mörker kvar
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = rgba('#808080', blind * 0.85);
  ctx.fillRect(-W, -H, W * 3, H * 3);
  ctx.restore();
}
export { parkScene };

// ---------------------------------------------------------------- dalen (minnet av striden)
export function dalen(ctx, t, S) {
  const flashT = lineStart(S, 1) - 1.2;
  const flash = ramp(t, flashT, flashT + 0.35) * (1 - ramp(t, flashT + 0.6, flashT + 4.5));
  const after = ramp(t, flashT + 0.5, flashT + 3);
  camera(ctx, { z: 1.0 + 0.1 * ease(ramp(t, 0, flashT)), x: 0, y: 0 });
  const draw = c => {
    sky(c, [[0, '#07050c'], [0.6, '#1d1028'], [1, '#3a1a34']]);
    addGlow(c, 980, 700, 600, '#5a1a3a', 0.35);
    c.drawImage(cached('dalen', W, H, d => {
      d.fillStyle = '#0d0912';
      d.beginPath(); d.moveTo(-50, H); d.lineTo(-50, 200); d.lineTo(160, 320); d.lineTo(260, 260); d.lineTo(420, 520);
      d.lineTo(560, 640); d.lineTo(620, 900); d.lineTo(-50, H); d.fill();
      d.beginPath(); d.moveTo(W + 50, H); d.lineTo(W + 50, 180); d.lineTo(1760, 300); d.lineTo(1640, 240); d.lineTo(1480, 520);
      d.lineTo(1360, 650); d.lineTo(1300, 900); d.lineTo(W + 50, H); d.fill();
      ridge(d, { y: 880, amp: 30, freq: 0.004, seed: 81, color: '#120c17' });
      // döda träd
      const r = rng(82);
      for (let i = 0; i < 6; i++) tree(d, 100 + i * 340 + r() * 60, 900 + r() * 40, { size: 220 + r() * 80, seed: 83 + i, trunk: '#08060b', leafAlpha: 0 });
      // kryptan
      d.fillStyle = '#1c1520';
      d.fillRect(860, 600, 240, 260);
      d.beginPath(); d.moveTo(840, 600); d.lineTo(980, 520); d.lineTo(1120, 600); d.fill();
      d.fillStyle = '#020104';
      d.beginPath(); d.moveTo(910, 860); d.lineTo(910, 700); d.arc(980, 700, 70, Math.PI, 0); d.lineTo(1050, 860); d.fill();
      for (let i = 0; i < 4; i++) { d.fillStyle = '#17111b'; d.fillRect(880 - i * 20, 860 + i * 14, 200 + i * 40, 14); }
    }), 0, 0);
    // dimma
    for (let i = 0; i < 3; i++) {
      c.save();
      c.globalAlpha = 0.25;
      cloud(c, ((t * (20 + i * 8) + i * 600) % (W + 800)) - 400, 840 + i * 30, 900, 160, '#6a3a6a', 0.5, 90 + i);
      c.restore();
    }
    // Master – en jättelik skugga ur kryptan
    const rise = ease(ramp(t, 0.5, 6));
    const mx = 980, my = 700 - rise * 260;
    const wv = (k) => Math.sin(t * 1.6 + k) * 14;
    c.fillStyle = '#000000';
    c.beginPath();
    c.moveTo(mx - 330 + wv(1), 900);
    c.quadraticCurveTo(mx - 300, my + 160, mx - 210 + wv(2), my + 40);
    c.quadraticCurveTo(mx - 190, my - 170, mx - 30, my - 300 + wv(3) * 0.5);
    c.quadraticCurveTo(mx + 60, my - 330, mx + 40, my - 260);
    c.quadraticCurveTo(mx + 190, my - 160, mx + 210 + wv(4), my + 40);
    c.quadraticCurveTo(mx + 300, my + 160, mx + 330 + wv(5), 900);
    for (let i = 0; i <= 12; i++) {
      const x = mx + 330 - i * 55;
      c.lineTo(x - 27, 900 + (i % 2 ? 40 : 0) + wv(i) * 0.6);
    }
    c.closePath();
    c.fill();
    // huvans öppning
    c.fillStyle = '#0a0410';
    c.beginPath(); c.ellipse(mx, my - 120, 95, 120, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 2; i++) {
      addGlow(c, mx - 40 + i * 80, my - 120, 40, '#ff2a1a', rise);
      c.fillStyle = rgba('#ffb0a0', rise);
      c.beginPath(); c.ellipse(mx - 40 + i * 80, my - 120, 12, 5, 0, 0, Math.PI * 2); c.fill();
    }
    // Alba med spegelstaven höjd
    const raise = ease(ramp(t, flashT - 2.5, flashT - 0.3));
    const r = figure(c, 470, 900, 190, LOOK.albaWhite, blendPose(POSE.stand, POSE.reach, 0.5 + raise * 0.5), { f: 1, staff: false });
    c.strokeStyle = '#6b4f3a'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(r.hand[0] - 20, r.hand[1] + 50); c.lineTo(r.hand[0] + 25, r.hand[1] - 60); c.stroke();
    addGlow(c, r.hand[0] + 28, r.hand[1] - 66, 60 + raise * 120, '#ffffff', 0.5 + raise * 0.5);
    addGlow(c, 470, 830, 160, '#ffffff', 0.25);
  };
  if (after > 0) layer(ctx, draw, { blur: after * 40 });
  else draw(ctx);
  if (after > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = rgba('#808080', after); ctx.fillRect(-W, -H, W * 3, H * 3); ctx.restore();
    tint(ctx, '#202024', after * 0.5);
  }
  tint(ctx, '#ffffff', flash);
}

// ---------------------------------------------------------------- vänner
export function vanner(ctx, t, S) {
  const s1 = lineStart(S, 1), s2 = lineStart(S, 2), s3 = lineStart(S, 3);
  const spring = window_(t, s1 + 1.5, s3 + 1, 1.5);
  const alone = window_(t, s2, s3 + 1.5, 1.4);
  const back = ramp(t, s3 + 1, s3 + 5);
  camera(ctx, { z: 1.03 + 0.03 * Math.sin(t * 0.1), x: 0, y: 0 });
  sky(ctx, [[0, mix('#5a7fb0', '#5c6470', spring)], [0.7, mix('#f0c48a', '#9aa0a6', spring)], [1, mix('#f6d79a', '#b4b6b4', spring)]]);
  addGlow(ctx, 1500, 600, 700, '#ffe2a0', 0.5 * (1 - spring) + back * 0.25);
  clouds(ctx, t, { seed: 91, n: 7, y0: 80, y1: 360, color: mix('#ffffff', '#4a5058', spring), alpha: 0.4 + spring * 0.4, speed: 12 });
  ctx.drawImage(cached('vanner-land', W, H, c => {
    ridge(c, { y: 700, amp: 80, freq: 0.0022, seed: 92, color: '#7a8a6a' });
    forest(c, { y: 760, seed: 93, color: '#4a5a3e', h0: 40, h1: 90, gap: 24 });
    c.fillStyle = '#5d7a3e';
    c.beginPath(); c.moveTo(-100, H + 10); c.lineTo(-100, 900); c.quadraticCurveTo(800, 640, 1900, 900); c.lineTo(2100, H + 10); c.fill();
  }), 0, 0);
  tint(ctx, '#3a4450', spring * 0.18);
  if (spring > 0.05) rain(ctx, t, { seed: 94, n: 160, angle: 0.1, speed: 1100, len: 30, alpha: 0.22 * spring });
  // fyra vänner: Alba, Stella, Gero, Adrian
  const cast = [
    { look: LOOK.albaWhite, x: 820, apart: 820 },
    { look: LOOK.stella, x: 940, apart: 1160 },
    { look: LOOK.gero, x: 1060, apart: 1390 },
    { look: LOOK.adrian, x: 700, apart: 470 },
  ];
  const sep = Math.max(spring, 0) * (1 - back);
  // kullens överkant: samma kurva som i bakgrunden
  const groundY = x => {
    let a = 0, b = 1;
    for (let k = 0; k < 30; k++) {
      const m = (a + b) / 2, mx = (1 - m) * (1 - m) * -100 + 2 * m * (1 - m) * 800 + m * m * 1900;
      if (mx < x) a = m; else b = m;
    }
    const u = (a + b) / 2;
    return (1 - u) * (1 - u) * 900 + 2 * u * (1 - u) * 640 + u * u * 900 + 4;
  };
  cast.forEach((c, i) => {
    const x = lerp(c.x, c.apart, ease(sep));
    let pose = i === 0 && alone > 0.5 ? POSE.sitFloor : POSE.stand;
    let f = i === 3 ? 1 : -1;
    if (i === 0) f = 1;
    if (spring > 0.3 && back < 0.5) {
      if (i === 1) { f = 1; pose = blendPose(POSE.stand, POSE.reach, 0.5 + 0.5 * Math.sin(t * 3) ** 2); }
      if (i === 2) { f = -1; pose = blendPose(POSE.stand, POSE.bow, 0.25); }
      if (i === 3) f = -1;
    }
    if (back > 0.5) pose = blendPose(POSE.stand, POSE.hug, 0.5);
    const a = i === 0 ? 1 : 1 - alone * 0.85;
    figure(ctx, x, groundY(x) + (pose === POSE.sitFloor ? 6 : 0), 230, c.look, pose, { f, alpha: a });
  });
  // ältandet: tankeringar och ett litet moln över Alba
  if (alone > 0) {
    for (let i = 0; i < 5; i++) {
      const ph = ((t * 0.5 + i / 5) % 1);
      ctx.strokeStyle = rgba('#ffffff', alone * 0.35 * (1 - ph));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(850, 560, 40 + ph * 260, 14 + ph * 90, 0, 0, Math.PI * 2); ctx.stroke();
    }
    cloud(ctx, 860, 470, 220, 90, '#3a3f48', 0.8 * alone, 95);
  }
  // vänskapens ljus
  if (back > 0) {
    const pts = cast.map(c => [c.x, groundY(c.x) - 140]);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#fff2c8', 0.5 * back); ctx.lineWidth = 3;
    ctx.beginPath();
    pts.sort((a, b) => a[0] - b[0]).forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.stroke();
    ctx.restore();
    pts.forEach(p => addGlow(ctx, p[0], p[1], 70, '#fff2c8', 0.6 * back));
    sparks(ctx, t, { seed: 96, n: 30, x: 880, y: 600, spread: 260, rise: 80, alpha: back });
  }
}

// ---------------------------------------------------------------- väktarna (förra sommaren)
export function vaktare(ctx, t, S) {
  const s1 = lineStart(S, 1), s2 = lineStart(S, 2), s3 = lineStart(S, 3);
  const dark = ramp(t, 1, s1);
  const power = ramp(t, s1, s1 + 4);
  const foes = window_(t, s2 - 0.5, s3 + 1.5, 1.5);
  const burst = ramp(t, s3, s3 + 1.2);
  const dawn = ramp(t, s3 + 1, s3 + 6);
  camera(ctx, { z: 1.0 + 0.05 * ease(ramp(t, 0, s3)) - 0.03 * dawn + Math.sin(t * 20) * 0.002 * foes, x: 0, y: 0 });
  sky(ctx, [[0, mix('#0b0a1a', '#3a4a7a', dawn)], [0.6, mix('#251a3a', '#d08a6a', dawn)], [1, mix('#3a2240', '#f6c27a', dawn)]]);
  stars(ctx, t, { seed: 101, n: 120, y1: 600, alpha: 1 - dawn });
  ctx.drawImage(cached('vaktare-land', W, H, c => {
    ridge(c, { y: 700, amp: 140, freq: 0.002, seed: 102, color: '#1d1530', sharp: 0.6 });
    ridge(c, { y: 820, amp: 60, freq: 0.003, seed: 103, color: '#140e22' });
    c.fillStyle = '#0b0814';
    c.beginPath(); c.moveTo(380, H + 10); c.lineTo(420, 900); c.lineTo(520, 840); c.lineTo(900, 830); c.lineTo(1020, 880); c.lineTo(1080, H + 10); c.fill();
    c.fillRect(-100, 960, W + 200, 200);
  }), 0, 0);
  // ondskan sprider sig: mörka moln av bläck från höger
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const r = rng(110 + i);
    const x = W + 200 - dark * (300 + r() * 1100) * (1 - burst), y = 500 + r() * 500;
    const rad = 140 + r() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba('#050208', 0.85 * (1 - burst)));
    g.addColorStop(1, rgba('#2a0a30', 0));
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
  // Glömskans gift – grön dimma
  if (foes > 0) {
    for (let i = 0; i < 4; i++) cloud(ctx, 1500 - ((t * 30 + i * 300) % 900), 900 + i * 25, 600, 140, '#4a9a5a', 0.35 * foes * (1 - burst), 120 + i);
    // svartalfer
    const r = rng(130);
    for (let i = 0; i < 9; i++) {
      const x = 1200 + r() * 600 - foes * 160 * (0.5 + r()) , y = 940 + r() * 60;
      const hop = Math.abs(Math.sin(t * (4 + r() * 3) + i)) * 18;
      ctx.fillStyle = rgba('#020104', foes * (1 - burst));
      ctx.beginPath(); ctx.ellipse(x, y - 40 - hop, 26, 40, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 20, y - 70 - hop); ctx.lineTo(x - 32, y - 108 - hop); ctx.lineTo(x - 6, y - 78 - hop); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 20, y - 70 - hop); ctx.lineTo(x + 32, y - 108 - hop); ctx.lineTo(x + 6, y - 78 - hop); ctx.fill();
      addGlow(ctx, x - 9, y - 52 - hop, 12, '#ffd23a', foes * (1 - burst));
      addGlow(ctx, x + 9, y - 52 - hop, 12, '#ffd23a', foes * (1 - burst));
    }
    // flugmonstret
    const fx = 1450 + Math.sin(t * 0.7) * 60, fy = 300 + Math.sin(t * 1.1) * 30;
    const a = foes * (1 - burst);
    ctx.save();
    ctx.globalAlpha = a;
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(fx + s * 40, fy - 30);
      ctx.rotate(s * (0.5 + Math.sin(t * 60) * 0.25));
      ctx.fillStyle = rgba('#8aa0b8', 0.25);
      ctx.beginPath(); ctx.ellipse(s * 150, -40, 170, 60, s * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#050307';
    ctx.beginPath(); ctx.ellipse(fx, fy, 120, 80, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx + 120, fy + 10, 70, 60, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx - 170, fy + 20, 110, 60, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = '#050307';
    for (let i = 0; i < 3; i++) for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath(); ctx.moveTo(fx - 40 + i * 40, fy + 50); ctx.lineTo(fx - 40 + i * 40 + s * 40, fy + 130); ctx.lineTo(fx - 40 + i * 40 + s * 30, fy + 190); ctx.stroke();
    }
    ctx.restore();
    addGlow(ctx, fx + 150, fy - 5, 45, '#ff2020', a);
    addGlow(ctx, fx + 120, fy - 25, 45, '#ff2020', a);
  }
  // de fyra väktarna på klippan
  const cast = [[LOOK.albaWhite, 560, '#ffffff'], [LOOK.stella, 660, '#7fb2ff'], [LOOK.gero, 760, '#ff7a5a'], [LOOK.adrian, 860, '#7dd69a']];
  cast.forEach(([lk, x, col], i) => {
    const pose = blendPose(POSE.stand, POSE.raise, ease(ramp(t, s1 + i * 0.4, s1 + 2 + i * 0.4)) * (1 - 0.5 * dawn));
    addGlow(ctx, x, 750, 110 + power * 90 + burst * 200, col, 0.35 + power * 0.35);
    const r = figure(ctx, x, 838, 170, lk, pose, { f: 1 });
    if (power > 0) addGlow(ctx, r.hand[0], r.hand[1], 40 + power * 30, col, power * 0.8);
  });
  // ljusexplosionen
  if (burst > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2 + t * 0.05;
      const len = 2400 * ease(burst);
      const g = ctx.createLinearGradient(710, 640, 710 + Math.cos(a) * len, 640 + Math.sin(a) * len);
      g.addColorStop(0, rgba('#fff8e0', 0.35 * (1 - dawn * 0.7)));
      g.addColorStop(1, rgba('#fff8e0', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(710, 640);
      ctx.lineTo(710 + Math.cos(a - 0.04) * len, 640 + Math.sin(a - 0.04) * len);
      ctx.lineTo(710 + Math.cos(a + 0.04) * len, 640 + Math.sin(a + 0.04) * len);
      ctx.fill();
    }
    ctx.restore();
    addGlow(ctx, 710, 640, 600, '#fff8e0', burst * (1 - ramp(t, s3 + 1, s3 + 4)) * 0.9);
    sparks(ctx, t, { seed: 140, n: 60, x: 710, y: 600, spread: 700, rise: 120, size: 4, alpha: dawn });
  }
}
