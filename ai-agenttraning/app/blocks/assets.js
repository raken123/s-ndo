// Costumes, backdrops and sounds: the built-in library (drawn and
// synthesized here, so the app needs no files and no internet), uploads, and
// project storage in IndexedDB.
(function () {
'use strict';
const RB = window.RB = window.RB || {};
const uid = () => Math.random().toString(36).slice(2, 10);
RB.uid = uid;

/* ---------- storage: IndexedDB, falling back to memory ---------- */
const mem = new Map();
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const rq = indexedDB.open('raken-ai-agenttraning', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function tx(mode, fn) {
  const d = await db(); if (!d) return null;
  return new Promise(res => {
    try {
      const t = d.transaction('kv', mode); const r = fn(t.objectStore('kv'));
      t.oncomplete = () => res(r && 'result' in r ? r.result : true); t.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
RB.store = {
  async get(k) { const v = await tx('readonly', s => s.get(k)); return v == null ? (mem.has(k) ? mem.get(k) : null) : v; },
  async set(k, v) { mem.set(k, v); const ok = await tx('readwrite', s => s.put(v, k)); return ok !== null; },
  async del(k) { mem.delete(k); await tx('readwrite', s => s.delete(k)); },
};

/* ---------- drawing helpers ---------- */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
// costumes are drawn at 2x (res 2) so they stay sharp when enlarged
function costume(name, w, h, draw, cx, cy) {
  const [c, g] = canvas(w * 2, h * 2); g.scale(2, 2); draw(g, w, h);
  return { id: uid(), name, url: c.toDataURL('image/png'), cx: (cx == null ? w / 2 : cx) * 2, cy: (cy == null ? h / 2 : cy) * 2, res: 2 };
}
function backdrop(name, draw) { return costume(name, 480, 360, draw); }
function star(g, cx, cy, r1, r2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = Math.PI * i / n - Math.PI / 2; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  g.closePath();
}
const PIECE_GLYPH = { K: '♚', D: '♛', T: '♜', L: '♝', S: '♞', B: '♟' };
function chessPiece(code) { // code like 'vK' or 'sB'
  return costume(code, 40, 40, (g) => {
    const white = code[0] === 'v';
    g.font = '34px "DejaVu Sans","Segoe UI Symbol","Apple Symbols","Noto Sans Symbols2",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 3; g.strokeStyle = white ? '#1b2030' : '#f4f1ea'; g.lineJoin = 'round';
    g.strokeText(PIECE_GLYPH[code[1]], 20, 22);
    g.fillStyle = white ? '#fbfaf6' : '#1b2030'; g.fillText(PIECE_GLYPH[code[1]], 20, 22);
  });
}
RB.chessPiece = chessPiece;

/* ---------- the library ---------- */
const LIB_COSTUMES = [
  ['Boll', () => costume('Boll', 60, 60, g => { const gr = g.createRadialGradient(22, 20, 4, 30, 30, 28); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(1, '#eb6834'); g.fillStyle = gr; g.beginPath(); g.arc(30, 30, 27, 0, 7); g.fill(); })],
  ['Stjärna', () => costume('Stjärna', 70, 70, g => { star(g, 35, 37, 33, 14, 5); g.fillStyle = '#ffcc1a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d99a00'; g.stroke(); })],
  ['Hjärta', () => costume('Hjärta', 64, 58, g => { g.fillStyle = '#e34948'; g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(0, 32, 4, 2, 32, 16); g.bezierCurveTo(60, 2, 64, 32, 32, 54); g.fill(); })],
  ['Pil', () => costume('Pil', 80, 40, g => { g.fillStyle = '#2a78d6'; g.beginPath(); g.moveTo(4, 14); g.lineTo(50, 14); g.lineTo(50, 4); g.lineTo(76, 20); g.lineTo(50, 36); g.lineTo(50, 26); g.lineTo(4, 26); g.closePath(); g.fill(); })],
  ['Kvadrat', () => costume('Kvadrat', 60, 60, g => { g.fillStyle = '#1baf7a'; g.fillRect(4, 4, 52, 52); })],
  ['Mynt', () => costume('Mynt', 50, 50, g => { g.fillStyle = '#eda100'; g.beginPath(); g.arc(25, 25, 22, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(25, 25, 15, 0, 7); g.stroke(); })],
  ['Flagga', () => costume('Flagga', 60, 70, g => { g.strokeStyle = '#1b2030'; g.lineWidth = 4; g.beginPath(); g.moveTo(14, 66); g.lineTo(14, 6); g.stroke(); g.fillStyle = '#1baf7a'; g.beginPath(); g.moveTo(16, 7); g.lineTo(56, 18); g.lineTo(16, 32); g.fill(); }, 14, 66)],
  ['Lava', () => costume('Lava', 60, 60, g => { g.fillStyle = '#ff5a1f'; g.fillRect(0, 0, 60, 60); g.fillStyle = '#ffb020'; for (const [x, y] of [[14, 20], [36, 36], [48, 14], [20, 46]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); } })],
  ['Vägg', () => costume('Vägg', 60, 60, g => { g.fillStyle = '#3d4459'; g.fillRect(0, 0, 60, 60); g.strokeStyle = '#59627c'; g.lineWidth = 2; for (const y of [20, 40]) { g.beginPath(); g.moveTo(0, y); g.lineTo(60, y); g.stroke(); } })],
  ['Kryss', () => costume('Kryss', 80, 80, g => { g.strokeStyle = '#2a78d6'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(16, 16); g.lineTo(64, 64); g.moveTo(64, 16); g.lineTo(16, 64); g.stroke(); })],
  ['Ring', () => costume('Ring', 80, 80, g => { g.strokeStyle = '#eb6834'; g.lineWidth = 11; g.beginPath(); g.arc(40, 40, 26, 0, 7); g.stroke(); })],
  ['Ram', () => costume('Ram', 40, 40, g => { g.strokeStyle = '#ffcc1a'; g.lineWidth = 4; g.strokeRect(2, 2, 36, 36); })],
  ['Moln', () => costume('Moln', 100, 60, g => { g.fillStyle = '#fff'; g.strokeStyle = '#c9d3e6'; g.lineWidth = 2; g.beginPath(); for (const [x, y, r] of [[30, 36, 18], [52, 26, 22], [74, 36, 18]]) g.arc(x, y, r, 0, 7); g.fill(); g.fillRect(28, 36, 48, 18); })],
  ...['vK', 'vD', 'vT', 'vL', 'vS', 'vB', 'sK', 'sD', 'sT', 'sL', 'sS', 'sB'].map(c => ['Schack ' + c, () => chessPiece(c)]),
];
function drawGridBackdrop(g) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 360);
  g.strokeStyle = '#e3e8f1'; g.lineWidth = 1;
  for (let x = 0; x <= 480; x += 20) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, 360); g.stroke(); }
  for (let y = 0; y <= 360; y += 20) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(480, y + .5); g.stroke(); }
  g.strokeStyle = '#9aa3b8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(240, 0); g.lineTo(240, 360); g.moveTo(0, 180); g.lineTo(480, 180); g.stroke();
  g.fillStyle = '#5b6275'; g.font = '11px system-ui,sans-serif';
  for (const x of [-200, -100, 100, 200]) g.fillText(x, 240 + x - 8, 194);
  for (const y of [-100, 100]) g.fillText(y, 246, 180 - y + 4);
  g.fillText('x', 468, 172); g.fillText('y', 246, 12);
}
function drawChessBoard(g) {
  g.fillStyle = '#efe6d6'; g.fillRect(0, 0, 480, 360);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    g.fillStyle = (r + f) % 2 ? '#f0d9b5' : '#b58863';
    g.fillRect(80 + f * 40, 20 + (7 - r) * 40, 40, 40);
  }
  g.strokeStyle = '#7a5439'; g.lineWidth = 2; g.strokeRect(80, 20, 320, 320);
  g.fillStyle = '#7a5439'; g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'center';
  for (let f = 0; f < 8; f++) g.fillText('abcdefgh'[f], 100 + f * 40, 354);
  for (let r = 0; r < 8; r++) g.fillText(String(r + 1), 70, 44 + (7 - r) * 40);
}
function drawTicTacToe(g) {
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#eef4ff'); gr.addColorStop(1, '#dde8fb'); g.fillStyle = gr; g.fillRect(0, 0, 480, 360);
  g.strokeStyle = '#3d4459'; g.lineWidth = 6; g.lineCap = 'round';
  for (const k of [1, 2]) { g.beginPath(); g.moveTo(90 + k * 100, 36); g.lineTo(90 + k * 100, 324); g.stroke(); g.beginPath(); g.moveTo(96, 30 + k * 100); g.lineTo(384, 30 + k * 100); g.stroke(); }
}
const LIB_BACKDROPS = [
  ['Vit', () => backdrop('Vit', g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 360); })],
  ['Rutnät med x och y', () => backdrop('Rutnät', drawGridBackdrop)],
  ['Schackbräde', () => backdrop('Schackbräde', drawChessBoard)],
  ['Luffarschack', () => backdrop('Luffarschack', drawTicTacToe)],
  ['Rymden', () => backdrop('Rymden', g => {
    const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#070b24'); gr.addColorStop(1, '#23104a'); g.fillStyle = gr; g.fillRect(0, 0, 480, 360);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(r() * 480, r() * 360, r() * 1.6 + 0.3, 0, 7); g.fill(); }
    g.fillStyle = '#e8a55a'; g.beginPath(); g.arc(390, 80, 36, 0, 7); g.fill();
  })],
  ['Äng', () => backdrop('Äng', g => {
    const sky = g.createLinearGradient(0, 0, 0, 260); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#d9f0ff'); g.fillStyle = sky; g.fillRect(0, 0, 480, 360);
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc(80, 70, 30, 0, 7); g.fill();
    g.fillStyle = '#6cc36c'; g.beginPath(); g.moveTo(0, 250); g.quadraticCurveTo(240, 200, 480, 250); g.lineTo(480, 360); g.lineTo(0, 360); g.fill();
  })],
];

/* ---------- sounds: tiny WAV files made here ---------- */
function wav(seconds, fn, rate = 22050) {
  const n = Math.floor(seconds * rate), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, fn(i / rate, i / n))) * 32000, true);
  let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return 'data:audio/wav;base64,' + btoa(bin);
}
const tone = (f, t) => Math.sin(2 * Math.PI * f * t);
const LIB_SOUNDS = [
  ['Pop', () => wav(0.15, (t, p) => tone(900 - 2500 * t, t) * (1 - p) ** 2)],
  ['Pling', () => wav(0.6, (t, p) => (tone(1320, t) * 0.6 + tone(2640, t) * 0.2) * Math.exp(-t * 7))],
  ['Trumma', () => wav(0.35, (t, p) => tone(140 - 120 * p, t) * (1 - p) ** 3)],
  ['Klick', () => wav(0.05, (t, p) => (Math.random() * 2 - 1) * (1 - p) ** 4)],
  ['Fel', () => wav(0.45, (t, p) => Math.sign(tone(110, t)) * 0.4 * (1 - p))],
  ['Vinst', () => wav(0.9, (t) => { const notes = [523, 659, 784, 1047]; const k = Math.min(3, Math.floor(t / 0.18)); return tone(notes[k], t) * 0.6 * Math.exp(-(t - k * 0.18) * 5); })],
  ['Bubbla', () => wav(0.25, (t, p) => tone(300 + 1400 * p * p, t) * Math.sin(Math.PI * p))],
  ['Robot', () => wav(0.6, (t, p) => Math.sign(tone(180 + 60 * Math.sin(t * 40), t)) * 0.3 * (1 - p))],
];

RB.library = {
  costumes: LIB_COSTUMES, backdrops: LIB_BACKDROPS, sounds: LIB_SOUNDS,
  sound(name) { const s = LIB_SOUNDS.find(x => x[0] === name); return s && { id: uid(), name, url: s[1]() }; },
  costume(name) { const s = LIB_COSTUMES.find(x => x[0] === name); return s && s[1](); },
  backdrop(name) { const s = LIB_BACKDROPS.find(x => x[0] === name); return s && s[1](); },
};
RB.drawChessBoard = drawChessBoard;

// the agent as a costume: its uploaded picture, or the drawn robot
RB.agentCostume = function (ag, name) {
  if (ag && ag.image) return new Promise(res => {
    const img = new Image(); img.onload = () => {
      const s = Math.min(1, 200 / Math.max(img.width, img.height)); const w = Math.round(img.width * s), h = Math.round(img.height * s);
      const [c, g] = canvas(w * 2, h * 2); g.drawImage(img, 0, 0, w * 2, h * 2);
      res({ id: uid(), name: name || ag.name, url: c.toDataURL('image/png'), cx: w, cy: h, res: 2 });
    }; img.onerror = () => res(RB.agentCostumeDrawn(ag, name)); img.src = ag.image;
  });
  return Promise.resolve(RB.agentCostumeDrawn(ag, name));
};
RB.agentCostumeDrawn = function (ag, name) {
  const color = ag ? ag.color : '#2a78d6', style = ag ? ag.style : 0;
  return costume(name || (ag ? ag.name : 'Robot'), 90, 96, (g) => window.RakenAI.drawBot(g, 45, 54, 80, color, style, null), 45, 52);
};

/* ---------- uploads ---------- */
function readAs(file, how) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r[how](file); }); }
function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
// an uploaded picture becomes a costume; big photos are shrunk
RB.imageToCostume = async function (file, forBackdrop) {
  const url = await readAs(file, 'readAsDataURL');
  const img = await loadImg(url);
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'bild';
  const w = img.naturalWidth || 100, h = img.naturalHeight || 100;
  if (/svg/.test(file.type) && url.length < 400000) {
    const res = forBackdrop ? Math.max(w / 480, h / 360) : Math.max(1, Math.max(w, h) / 240);
    return { id: uid(), name, url, cx: w / 2, cy: h / 2, res };
  }
  const maxDim = forBackdrop ? 960 : 480, s = Math.min(1, maxDim / Math.max(w, h));
  const W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
  const [c, g] = canvas(W, H); g.drawImage(img, 0, 0, W, H);
  const jpeg = /jpe?g/.test(file.type);
  const out = c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9);
  const res = forBackdrop ? Math.max(W / 480, H / 360) : Math.max(1, Math.max(W, H) / 240);
  return { id: uid(), name, url: out, cx: W / 2, cy: H / 2, res };
};
RB.fileToSound = async function (file) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Ljudfilen är för stor (max 8 MB).');
  const url = await readAs(file, 'readAsDataURL');
  return { id: uid(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'ljud', url };
};
// a small picture of the agent for its card, from an uploaded image
RB.agentImage = async function (file) {
  const img = await loadImg(await readAs(file, 'readAsDataURL'));
  const s = Math.min(1, 256 / Math.max(img.width, img.height));
  const [c, g] = canvas(Math.round(img.width * s), Math.round(img.height * s)); g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
};
// crop a painted canvas to what was drawn
RB.cropCanvas = function (cv) {
  const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  let l = cv.width, r = -1, t = cv.height, b = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3]) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
  if (r < 0) return null;
  const [c, g2] = canvas(r - l + 3, b - t + 3); g2.drawImage(cv, l - 1, t - 1, c.width, c.height, 0, 0, c.width, c.height);
  return { canvas: c, left: l - 1, top: t - 1 };
};
})();
