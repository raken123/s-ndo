// Runtime for Scratch 3 block programs: runs every core block plus the Pen,
// Music, Text-to-speech, AI-agent and Chess extensions on a 480x360 stage.
//
// Scripts are parsed from Blockly XML into small trees and run as generator
// "threads", 30 frames per second, the way Scratch does: a loop yields once
// per turn, and when nothing on screen changed the frame keeps running
// threads for up to 75 % of the frame time.
(function () {
'use strict';
const RB = window.RB = window.RB || {};

/* ---------------- casting (Scratch semantics) ---------------- */
const Cast = {
  num(v) {
    if (typeof v === 'number') return Number.isNaN(v) ? 0 : v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    const n = Number(v); return Number.isNaN(n) ? 0 : n;
  },
  bool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return !(v === '' || v === '0' || v.toLowerCase() === 'false');
    return Boolean(v);
  },
  str(v) { return v == null ? '' : String(v); },
  isWhite(v) { return v === null || (typeof v === 'string' && v.trim().length === 0); },
  compare(a, b) {
    let n1 = Number(a), n2 = Number(b);
    if (n1 === 0 && Cast.isWhite(a)) n1 = NaN; else if (n2 === 0 && Cast.isWhite(b)) n2 = NaN;
    if (Number.isNaN(n1) || Number.isNaN(n2)) {
      const s1 = String(a).toLowerCase(), s2 = String(b).toLowerCase();
      return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
    }
    if (n1 === Infinity && n2 === Infinity) return 0;
    return n1 - n2;
  },
  isInt(v) {
    if (typeof v === 'number') return Number.isNaN(v) ? true : v === Math.floor(v);
    if (typeof v === 'boolean') return true;
    return typeof v === 'string' ? v.indexOf('.') < 0 : false;
  },
  listIndex(index, length, acceptAll) {
    if (typeof index !== 'number') {
      const s = String(index).toLowerCase();
      if (s === 'all') return acceptAll ? 'ALL' : 0;
      if (s === 'last') return length > 0 ? length : 0;
      if (s === 'random' || s === 'any') return length > 0 ? 1 + Math.floor(Math.random() * length) : 0;
    }
    index = Math.floor(Cast.num(index));
    return index < 1 || index > length ? 0 : index;
  },
  rgb(v) { // "#rrggbb" or number → [r,g,b]
    if (typeof v === 'string' && v[0] === '#') { const n = parseInt(v.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const n = Cast.num(v); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
};
RB.Cast = Cast;
const round = v => Math.round(v * 1e10) / 1e10;
const listText = arr => arr.every(x => String(x).length === 1) ? arr.join('') : arr.join(' ');
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = d => d * Math.PI / 180;

/* ---------------- parse Blockly XML to script trees ---------------- */
function parseXml(xml) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml || '<xml/>', 'text/xml') : xml;
  const root = doc.documentElement;
  const tops = [];
  for (const el of root.children) if (el.tagName === 'block') tops.push(parseBlock(el));
  return tops;
}
function kids(el, tag) { return [...el.children].filter(c => c.tagName === tag); }
function parseBlock(el) {
  if (!el) return null;
  const n = { op: el.getAttribute('type'), id: el.getAttribute('id'), f: {}, fid: {}, i: {}, s: {}, next: null, mut: null, shadow: el.tagName === 'shadow' };
  for (const c of el.children) {
    if (c.tagName === 'field') { n.f[c.getAttribute('name')] = c.textContent; n.fid[c.getAttribute('name')] = c.getAttribute('id'); }
    else if (c.tagName === 'value') {
      const b = kids(c, 'block')[0] || kids(c, 'shadow')[0];
      n.i[c.getAttribute('name')] = parseBlock(b);
    } else if (c.tagName === 'statement') n.s[c.getAttribute('name')] = parseBlock(kids(c, 'block')[0] || kids(c, 'shadow')[0]);
    else if (c.tagName === 'next') n.next = parseBlock(kids(c, 'block')[0]);
    else if (c.tagName === 'mutation') { n.mut = {}; for (const a of c.attributes) n.mut[a.name] = a.value; }
  }
  return n;
}
RB.parseXml = parseXml;

const HATS = new Set(['event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked', 'event_whenstageclicked',
  'event_whenbackdropswitchesto', 'event_whengreaterthan', 'event_whenbroadcastreceived', 'control_start_as_clone',
  'event_whentouchingobject', 'procedures_definition']);
RB.HATS = HATS;
const RESTART = { event_whenflagclicked: 1, event_whenthisspriteclicked: 1, event_whenstageclicked: 1, event_whenbroadcastreceived: 1 };

class StopScript { }
class StopThread { }

/* ---------------- images ---------------- */
function loadImage(url) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { const c = document.createElement('canvas'); c.width = c.height = 2; res(c); };
    img.src = url;
  });
}
function imageData(img) {
  if (img._data) return img._data;
  const w = img.naturalWidth || img.width || 1, h = img.naturalHeight || img.height || 1;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  try { img._data = g.getImageData(0, 0, w, h); } catch (e) { img._data = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) }; }
  return img._data;
}

/* ---------------- colour helpers (pen uses Scratch's 0-100 HSV) ---------------- */
function hsvToRgb(h, s, v) {
  h = ((h % 1) + 1) % 1 * 6; const i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [r * 255, g * 255, b * 255];
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
  return [h, mx ? d / mx : 0, mx];
}

/* ---------------- audio ---------------- */
class Sound {
  constructor(vm) { this.vm = vm; this.ctx = null; this.buffers = new Map(); this.playing = new Set(); }
  ac() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; this.ctx = new AC(); }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  buffer(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    const ac = this.ac(); if (!ac) return Promise.resolve(null);
    const p = fetch(url).then(r => r.arrayBuffer()).then(a => new Promise((res) => ac.decodeAudioData(a, res, () => res(null)))).catch(() => null);
    this.buffers.set(url, p); return p;
  }
  chain(t) { // gain + pan per target, follows its volume and effects
    const ac = this.ac(); if (!ac) return null;
    const gain = ac.createGain(); gain.gain.value = t.volume / 100;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) { pan.pan.value = clampN(t.sfx.pan, -100, 100) / 100; gain.connect(pan); pan.connect(ac.destination); } else gain.connect(ac.destination);
    return gain;
  }
  play(t, snd) {
    return new Promise(res => {
      this.buffer(snd.url).then(buf => {
        const ac = this.ac(); if (!buf || !ac) return res();
        const src = ac.createBufferSource(); src.buffer = buf;
        src.playbackRate.value = Math.pow(2, clampN(t.sfx.pitch, -360, 360) / 120);
        const out = this.chain(t); src.connect(out);
        const rec = { src, out, t, done: res }; this.playing.add(rec);
        src.onended = () => { this.playing.delete(rec); res(); };
        src.start();
      });
    });
  }
  update(t) {
    for (const r of this.playing) if (r.t === t) {
      r.out.gain.value = t.volume / 100; r.src.playbackRate.value = Math.pow(2, clampN(t.sfx.pitch, -360, 360) / 120);
    }
  }
  stop(t) { for (const r of [...this.playing]) if (!t || r.t === t) { try { r.src.stop(); } catch (e) { } this.playing.delete(r); r.done(); } }
  // music extension: tiny synthesizer
  note(t, midi, secs, inst) {
    const ac = this.ac(); if (!ac) return;
    const I = RB.INSTRUMENTS[(inst | 0) - 1] || RB.INSTRUMENTS[0];
    const now = ac.currentTime, out = this.chain(t), g = ac.createGain();
    const o = ac.createOscillator(); o.type = I.wave; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const len = Math.min(secs, I.decay || secs);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now + I.attack);
    g.gain.setTargetAtTime(I.sustain * 0.5, now + I.attack, 0.08);
    g.gain.setTargetAtTime(0, now + Math.max(I.attack, len), 0.06);
    o.connect(g); g.connect(out); o.start(now); o.stop(now + len + 0.5);
  }
  drum(t, n) {
    const ac = this.ac(); if (!ac) return;
    const D = RB.DRUMS[(n | 0) - 1] || RB.DRUMS[0]; const now = ac.currentTime, out = this.chain(t);
    if (D.noise) {
      const len = D.len, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const s = ac.createBufferSource(); s.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = D.filter || 'highpass'; f.frequency.value = D.freq;
      const g = ac.createGain(); g.gain.value = 0.6; s.connect(f); f.connect(g); g.connect(out); s.start(now);
    }
    if (D.tone) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(D.tone, now); o.frequency.exponentialRampToValueAtTime(Math.max(30, D.tone / 3), now + D.len);
      g.gain.setValueAtTime(0.8, now); g.gain.exponentialRampToValueAtTime(0.001, now + D.len);
      o.connect(g); g.connect(out); o.start(now); o.stop(now + D.len + 0.05);
    }
  }
}
RB.INSTRUMENTS = [
  ['Piano', 'triangle', 0.005, 0.3, 1.5], ['Elpiano', 'sine', 0.005, 0.5, 1.5], ['Orgel', 'square', 0.02, 0.9], ['Gitarr', 'sawtooth', 0.003, 0.2, 1],
  ['Elgitarr', 'sawtooth', 0.003, 0.6], ['Bas', 'triangle', 0.005, 0.7, 1.2], ['Pizzicato', 'triangle', 0.002, 0.1, 0.3], ['Cello', 'sawtooth', 0.08, 0.8],
  ['Trombon', 'sawtooth', 0.05, 0.8], ['Klarinett', 'square', 0.04, 0.8], ['Saxofon', 'sawtooth', 0.04, 0.8], ['Flöjt', 'sine', 0.06, 0.9],
  ['Träflöjt', 'sine', 0.04, 0.7], ['Fagott', 'square', 0.05, 0.8], ['Kör', 'sine', 0.15, 0.9], ['Vibrafon', 'sine', 0.002, 0.4, 2],
  ['Speldosa', 'sine', 0.002, 0.2, 1], ['Steelpan', 'triangle', 0.002, 0.3, 1.2], ['Marimba', 'sine', 0.002, 0.15, 0.5], ['Synth lead', 'square', 0.01, 0.8],
  ['Synth pad', 'sawtooth', 0.3, 0.9],
].map(([name, wave, attack, sustain, decay]) => ({ name, wave, attack, sustain, decay }));
RB.DRUMS = [
  ['Virvel', { noise: 1, len: 0.2, freq: 1200, tone: 220 }], ['Bastrumma', { tone: 150, len: 0.35 }], ['Kantslag', { noise: 1, len: 0.05, freq: 2500 }],
  ['Crashcymbal', { noise: 1, len: 1.2, freq: 5000 }], ['Öppen hi-hat', { noise: 1, len: 0.4, freq: 7000 }], ['Stängd hi-hat', { noise: 1, len: 0.06, freq: 7000 }],
  ['Tamburin', { noise: 1, len: 0.25, freq: 6000 }], ['Handklapp', { noise: 1, len: 0.1, freq: 1500, filter: 'bandpass' }], ['Klavess', { tone: 2500, len: 0.05 }],
  ['Träblock', { tone: 1200, len: 0.08 }], ['Koskälla', { tone: 800, len: 0.3 }], ['Triangel', { tone: 4000, len: 1 }],
  ['Bongo', { tone: 400, len: 0.15 }], ['Conga', { tone: 250, len: 0.2 }], ['Cabasa', { noise: 1, len: 0.15, freq: 8000 }],
  ['Güiro', { noise: 1, len: 0.3, freq: 3000, filter: 'bandpass' }], ['Vibraslap', { noise: 1, len: 0.6, freq: 2000, filter: 'bandpass' }], ['Cuica', { tone: 600, len: 0.25 }],
].map(([name, d]) => Object.assign({ name }, d));

/* ---------------- targets ---------------- */
class Target {
  constructor(vm, data, sprite) {
    this.vm = vm; this.sprite = sprite; this.id = data.id; this.isStage = !!data.isStage;
    this.name = data.name;
    this.x = +data.x || 0; this.y = +data.y || 0; this.dir = data.direction == null ? 90 : +data.direction;
    this.size = data.size == null ? 100 : +data.size; this.visible = data.visible !== false;
    this.costume = clampN(data.currentCostume | 0, 0, Math.max(0, sprite.costumes.length - 1));
    this.rotationStyle = data.rotationStyle || 'all around'; this.draggable = !!data.draggable;
    this.volume = data.volume == null ? 100 : +data.volume;
    this.effects = {}; this.sfx = { pitch: 0, pan: 0 };
    this.bubble = null; this.isClone = false; this.parent = null;
    this.pen = { down: false, h: 66, s: 100, v: 100, t: 0, size: 1 };
    this.vars = new Map(); this.instrument = 1; this.voice = 'ALTO';
  }
  get costumes() { return this.sprite.costumes; }
  get cost() { return this.sprite.costumes[this.costume]; }
  // --- geometry ---
  scale() { const c = this.cost; return (this.size / 100) / ((c && c.res) || 1); }
  angle() {
    if (this.isStage) return 0;
    return this.rotationStyle === 'all around' ? this.dir - 90 : 0;
  }
  flip() { return this.rotationStyle === 'left-right' && this.dir < 0 ? -1 : 1; }
  // axis-aligned bounds in stage coordinates
  bounds() {
    const c = this.cost; if (!c || !c.img) return { left: this.x, right: this.x, top: this.y, bottom: this.y };
    const s = this.scale(), a = rad(this.angle()), fl = this.flip();
    const w = c.w, h = c.h, cx = c.cx, cy = c.cy;
    let l = Infinity, r = -Infinity, t = -Infinity, b = Infinity;
    for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const u = (px - cx) * s * fl, v = (py - cy) * s;
      const X = this.x + u * Math.cos(a) - v * Math.sin(a), Y = this.y - (u * Math.sin(a) + v * Math.cos(a));
      l = Math.min(l, X); r = Math.max(r, X); t = Math.max(t, Y); b = Math.min(b, Y);
    }
    return { left: l, right: r, top: t, bottom: b };
  }
  // is stage point (sx, sy) on a non-transparent pixel of this sprite?
  hit(sx, sy) {
    const c = this.cost; if (!c || !c.img || !this.visible) return false;
    const s = this.scale(), a = rad(this.angle()), fl = this.flip();
    const u = sx - this.x, v = -(sy - this.y);
    const ur = u * Math.cos(a) + v * Math.sin(a), vr = -u * Math.sin(a) + v * Math.cos(a);
    const px = Math.floor(ur / (s * fl) + c.cx), py = Math.floor(vr / s + c.cy);
    if (px < 0 || py < 0 || px >= c.w || py >= c.h) return false;
    const d = imageData(c.img); return d.data[(py * d.width + px) * 4 + 3] > 0;
  }
  setXY(x, y, noFence) {
    if (this.isStage) return;
    const ox = this.x, oy = this.y;
    this.x = x; this.y = y;
    if (!noFence) this.fence();
    if (this.pen.down) this.vm.penLine(this, ox, oy, this.x, this.y);
    this.vm.redraw = true;
  }
  fence() { // keep a bit of the sprite on stage, like Scratch
    const b = this.bounds(); const inset = Math.floor(Math.min(15, Math.floor(Math.min(b.right - b.left, b.top - b.bottom) / 2)));
    let dx = 0, dy = 0;
    if (b.right < -240 + inset) dx = -240 + inset - b.right;
    if (b.left > 240 - inset) dx = 240 - inset - b.left;
    if (b.top < -180 + inset) dy = -180 + inset - b.top;
    if (b.bottom > 180 - inset) dy = 180 - inset - b.bottom;
    this.x += dx; this.y += dy;
  }
  setDir(d) { d = Cast.num(d); if (!Number.isFinite(d)) return; this.dir = ((d + 179) % 360 + 360) % 360 - 179; this.vm.redraw = true; }
  setSize(s) {
    const c = this.cost; if (!c) return;
    const w = c.w / (c.res || 1), h = c.h / (c.res || 1);
    const min = Math.min(1, Math.max(5 / Math.max(w, 1), 5 / Math.max(h, 1)));
    const max = Math.min(1.5 * 480 / Math.max(w, 1), 1.5 * 360 / Math.max(h, 1));
    this.size = clampN(s / 100, min, max) * 100; this.vm.redraw = true;
  }
  setCostume(i) {
    const n = this.costumes.length; if (!n) return;
    this.costume = ((Math.round(i) % n) + n) % n; this.vm.redraw = true;
    if (this.isStage) this.vm.backdropChanged();
  }
  costumeBy(v, allowSpecial) { // name, number or special backdrop words
    const list = this.costumes, n = list.length; if (!n) return;
    const s = Cast.str(v);
    const byName = list.findIndex(c => c.name === s);
    if (byName >= 0) return this.setCostume(byName);
    if (allowSpecial && (s === 'next backdrop' || s === 'next costume')) return this.setCostume(this.costume + 1);
    if (allowSpecial && (s === 'previous backdrop' || s === 'previous costume')) return this.setCostume(this.costume - 1);
    if (allowSpecial && (s === 'random backdrop' || s === 'random costume')) { if (n > 1) { let r; do { r = Math.floor(Math.random() * n); } while (r === this.costume); this.setCostume(r); } return; }
    if (typeof v === 'number' || (!Cast.isWhite(s) && !Number.isNaN(Number(s)))) this.setCostume(Cast.num(v) - 1);
  }
  say(type, text) {
    text = Cast.str(text);
    if (typeof text === 'string' && /^-?\d+\.\d{3,}$/.test(text)) text = String(Math.round(Number(text) * 100) / 100);
    this.bubble = text === '' ? null : { type, text: text.slice(0, 330) };
    this.vm.redraw = true;
  }
}

/* ---------------- the VM ---------------- */
class VM {
  constructor(canvas) {
    this.canvas = canvas; this.g = canvas.getContext('2d');
    this.targets = []; this.threads = []; this.running = false; this.turbo = false;
    this.keys = new Set(); this.mouse = { x: 0, y: 0, down: false };
    this.timer0 = performance.now(); this.answer = ''; this.askQ = null; this.tempo = 60;
    this.pen = document.createElement('canvas'); this.pen.width = 960; this.pen.height = 720; this.pg = this.pen.getContext('2d');
    this.world = document.createElement('canvas'); this.world.width = 480; this.world.height = 360;
    this.wg = this.world.getContext('2d', { willReadFrequently: true });
    this.fxCache = new Map(); this.sound = new Sound(this);
    this.edge = new Map(); this.monitors = new Map(); this.frame = 0;
    this.listeners = {}; this.redraw = true; this.warned = new Set();
    this.loop = this.loop.bind(this); this.last = 0; requestAnimationFrame(this.loop);
  }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) try { fn(...a); } catch (e) { console.error(e); } }

  /* ---- loading ---- */
  async load(project) {
    this.stopAll(); this.project = project;
    this.targets = []; this.monitors.clear();
    const sprites = [];
    for (const d of project.targets) {
      const sprite = { data: d, costumes: [], sounds: d.sounds || [], scripts: [], procs: {} };
      sprite.costumes = await Promise.all((d.costumes || []).map(async c => {
        const img = await loadImage(c.url);
        const res = c.res || 1;
        return Object.assign({}, c, { img, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, cx: c.cx != null ? c.cx : (img.naturalWidth || img.width) / 2, cy: c.cy != null ? c.cy : (img.naturalHeight || img.height) / 2, res });
      }));
      this.compile(sprite, d.blocks);
      sprites.push(sprite);
      const t = new Target(this, d, sprite); sprite.original = t;
      this.targets.push(t);
    }
    this.stage = this.targets.find(t => t.isStage);
    this.tempo = this.stage && this.stage.sprite.data.tempo || 60;
    // variables
    for (const [id, v] of Object.entries(project.variables || {})) {
      const owner = v.owner === 'stage' ? this.stage : this.targets.find(t => t.id === v.owner);
      if (!owner || v.type === 'broadcast_msg') continue;
      owner.vars.set(id, { id, name: v.name, type: v.type || '', value: v.type === 'list' ? [...(v.value || [])] : (v.value == null ? 0 : v.value) });
    }
    for (const m of Object.values(project.monitors || {})) if (m.visible) this.monitors.set(m.id, Object.assign({}, m));
    this.pg.clearRect(0, 0, 960, 720);
    this.redraw = true; this.emit('monitors');
  }
  compile(sprite, xml) {
    let tops = [];
    try { tops = parseXml(xml); } catch (e) { console.error(e); }
    sprite.scripts = tops.filter(t => HATS.has(t.op) && t.op !== 'procedures_definition');
    sprite.procs = {};
    for (const t of tops) if (t.op === 'procedures_definition') {
      const proto = t.i.custom_block || t.s.custom_block; // Blockly saves it as a statement
      if (proto && proto.mut) { t.proto = proto; sprite.procs[proto.mut.proccode] = t; }
    }
  }
  recompile(targetId, xml) {
    const t = this.targets.find(x => x.id === targetId); if (!t) return;
    t.sprite.data.blocks = xml; this.compile(t.sprite, xml);
  }
  spriteTargets() { return this.targets.filter(t => !t.isStage); }
  byName(name) { return this.targets.find(t => !t.isStage && !t.isClone && t.name === name); }
  drawOrder() { return this.targets.filter(t => !t.isStage); } // targets[] keeps layer order after the stage

  /* ---- variables ---- */
  lookup(t, id, name, type = '') {
    let v = t.vars.get(id) || this.stage.vars.get(id);
    if (v && v.type === type) return v;
    for (const scope of [t, this.stage]) for (const x of scope.vars.values()) if (x.name === name && x.type === type) return x;
    v = { id: id || ('v' + Math.random().toString(36).slice(2)), name: name || 'variabel', type, value: type === 'list' ? [] : 0 };
    this.stage.vars.set(v.id, v); return v;
  }
  varOf(t, n, field = 'VARIABLE', type = '') { return this.lookup(t, n.fid[field], n.f[field], type); }

  /* ---- threads ---- */
  start(t, top, hat) {
    const th = { target: t, top, gen: null, done: false, warp: 0, warpT: 0, frames: [], hat: hat || top.op };
    th.gen = this.runThread(th); this.threads.push(th); this.running = true;
    return th;
  }
  *runThread(th) {
    try { yield* this.stack(th, th.top.op && HATS.has(th.top.op) ? th.top.next : th.top); }
    catch (e) { if (!(e instanceof StopScript) && !(e instanceof StopThread)) throw e; }
  }
  *stack(th, n) {
    while (n) {
      if (th.done) throw new StopThread();
      const f = C[n.op];
      if (f) { const r = f.call(this, th.target, n, th); if (r && typeof r.next === 'function') yield* r; }
      else if (R[n.op]) this.ev(th, n); // a reporter dropped as a command
      else this.unknown(n.op);
      n = n.next;
    }
  }
  unknown(op) { if (!this.warned.has(op)) { this.warned.add(op); console.warn('Okänt block:', op); this.emit('warn', op); } }
  *yieldLoop(th) {
    if (th.warp && performance.now() - th.warpT < 500) return;
    yield;
  }
  ev(th, n) { // evaluate an input
    if (!n) return '';
    const f = R[n.op];
    if (f) return f.call(this, th.target, n, th);
    if (n.shadow || !C[n.op]) { const k = Object.keys(n.f); if (k.length) return n.f[k[0]]; }
    this.unknown(n.op); return '';
  }
  arg(th, n, name) { return this.ev(th, n.i[name]); }
  hatsFor(op, filter, targets) {
    const out = [];
    for (const t of targets || this.targets) for (const s of t.sprite.scripts) if (s.op === op && (!filter || filter(s, t))) out.push([t, s]);
    return out;
  }
  startHats(op, filter, targets) {
    const started = [];
    for (const [t, s] of this.hatsFor(op, filter, targets)) {
      const old = this.threads.find(th => th.target === t && th.top === s && !th.done);
      if (old) { if (!RESTART[op]) continue; old.done = true; }
      started.push(this.start(t, s));
    }
    return started;
  }
  greenFlag() {
    this.stopAll(); this.timer0 = performance.now();
    this.startHats('event_whenflagclicked');
    this.emit('flag');
  }
  stopAll() {
    for (const th of this.threads) th.done = true;
    this.threads = []; this.running = false;
    this.targets = this.targets.filter(t => !t.isClone);
    for (const t of this.targets) { t.bubble = null; t.effects = {}; t.sfx = { pitch: 0, pan: 0 }; }
    this.sound.stop(); this.askQ = null; this.emit('ask', null);
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { }
    this.redraw = true; this.emit('stop');
  }
  broadcast(name) {
    const key = Cast.str(name).toLowerCase();
    return this.startHats('event_whenbroadcastreceived', s => Cast.str(s.f.BROADCAST_OPTION).toLowerCase() === key);
  }
  backdropChanged() {
    const name = this.stage.cost ? this.stage.cost.name : '';
    return this.lastBackdrop = this.startHats('event_whenbackdropswitchesto', s => s.f.BACKDROP === name);
  }
  keyDown(key) {
    this.keys.add(key);
    this.startHats('event_whenkeypressed', s => s.f.KEY_OPTION === key || s.f.KEY_OPTION === 'any');
  }
  keyUp(key) { this.keys.delete(key); }
  click(t) {
    if (t) this.startHats('event_whenthisspriteclicked', null, [t]);
    else this.startHats('event_whenstageclicked', null, [this.stage]);
  }
  topAt(x, y) {
    const list = this.drawOrder();
    for (let i = list.length - 1; i >= 0; i--) if (list[i].visible && list[i].hit(x, y)) return list[i];
    return null;
  }
  // run a single stack clicked in the editor (toggle if already running)
  toggleStack(targetId, top) {
    const t = this.targets.find(x => x.id === targetId && !x.isClone); if (!t) return;
    const old = this.threads.find(th => th.target === t && th.top && th.top.id === top.id && !th.done);
    if (old) { old.done = true; return; }
    if (R[top.op] && !C[top.op]) {
      const th = { target: t, frames: [], warp: 0 };
      let v; try { v = this.ev(th, top); } catch (e) { v = ''; }
      this.emit('report', top.id, v); return;
    }
    this.start(t, top, 'click');
  }
  createClone(t) {
    const all = this.targets.filter(x => x.isClone).length; if (all >= 300 || t.isStage) return null;
    const c = new Target(this, t.sprite.data, t.sprite);
    Object.assign(c, { x: t.x, y: t.y, dir: t.dir, size: t.size, visible: t.visible, costume: t.costume, rotationStyle: t.rotationStyle,
      draggable: t.draggable, volume: t.volume, effects: { ...t.effects }, sfx: { ...t.sfx }, pen: { ...t.pen, down: t.pen.down }, instrument: t.instrument, voice: t.voice });
    c.isClone = true; c.parent = t.sprite.original; c.name = t.name;
    for (const [id, v] of t.vars) c.vars.set(id, { ...v, value: Array.isArray(v.value) ? [...v.value] : v.value });
    const i = this.targets.indexOf(t); this.targets.splice(i, 0, c);
    this.startHats('control_start_as_clone', null, [c]);
    this.redraw = true; return c;
  }
  deleteClone(t) {
    if (!t.isClone) return;
    for (const th of this.threads) if (th.target === t) th.done = true;
    this.targets = this.targets.filter(x => x !== t); this.sound.stop(t); this.redraw = true;
  }

  /* ---- frame loop ---- */
  loop(now) {
    requestAnimationFrame(this.loop);
    if (now - this.last < 1000 / 30 - 3) return;
    this.last = now; this.frame++;
    this.edgeHats();
    const t0 = performance.now(), budget = 1000 / 30 * 0.75;
    this.redraw = false;
    let ran = 0;
    do {
      if (!this.threads.length) break;
      this.stepThreads(); ran++;
    } while ((this.turbo || !this.redraw) && performance.now() - t0 < budget && this.threads.some(th => !th.waiting));
    this.running = this.threads.length > 0;
    this.render();
    this.emit('frame');
  }
  stepThreads() {
    const list = this.threads.slice();
    for (const th of list) {
      if (th.done) continue;
      th.waiting = false;
      try { const r = th.gen.next(); if (r.done) th.done = true; }
      catch (e) { th.done = true; console.error(e); this.emit('error', e); }
    }
    this.threads = this.threads.filter(th => !th.done);
  }
  edgeHats() {
    const check = (op, fn) => {
      for (const [t, s] of this.hatsFor(op)) {
        const key = t.id + ':' + s.id; let v = false;
        try { v = fn(t, s); } catch (e) { }
        const was = this.edge.get(key); this.edge.set(key, v);
        if (v && !was && !this.threads.some(th => th.target === t && th.top === s && !th.done)) this.start(t, s);
      }
    };
    check('event_whengreaterthan', (t, s) => {
      const th = { target: t, frames: [], warp: 0 };
      const val = Cast.num(this.ev(th, s.i.VALUE));
      return (s.f.WHENGREATERTHANMENU === 'TIMER' ? this.timer() : this.loudness()) > val;
    });
    check('event_whentouchingobject', (t, s) => {
      const th = { target: t, frames: [], warp: 0 }; return this.touching(t, this.ev(th, s.i.TOUCHINGOBJECTMENU));
    });
  }
  timer() { return (performance.now() - this.timer0) / 1000; }
  loudness() {
    if (!this.mic) {
      this.mic = { level: -1 };
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          const ac = this.sound.ac(); if (!ac) return;
          const an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an);
          const buf = new Float32Array(an.fftSize);
          this.mic.read = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.round(Math.min(100, Math.sqrt(s / buf.length) * 300)); };
        }).catch(() => { });
      }
    }
    return this.mic.read ? this.mic.read() : -1;
  }

  /* ---- sensing ---- */
  touching(t, what) {
    if (t.isStage || !t.visible) return false;
    what = Cast.str(what);
    if (what === '_mouse_') return t.hit(this.mouse.x, this.mouse.y);
    if (what === '_edge_') { const b = t.bounds(); return b.left < -240 || b.right > 240 || b.top > 180 || b.bottom < -180; }
    const others = this.targets.filter(o => !o.isStage && o.visible && o.name === what && o !== t);
    const a = t.bounds();
    for (const o of others) {
      const b = o.bounds();
      const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), top = Math.min(a.top, b.top), bot = Math.max(a.bottom, b.bottom);
      if (l >= r || bot >= top) continue;
      const step = Math.max(1, Math.floor(Math.max(r - l, top - bot) / 120));
      for (let y = bot + 0.5; y < top; y += step) for (let x = l + 0.5; x < r; x += step) if (t.hit(x, y) && o.hit(x, y)) return true;
    }
    return false;
  }
  renderWorld(except) { // everything except one sprite, at 1x, for colour sensing
    const key = this.frame + ':' + (except ? except.id + (except.isClone ? this.targets.indexOf(except) : '') : '');
    if (this.worldKey === key) return this.worldData;
    const g = this.wg; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 480, 360); g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 360);
    this.drawStage(g, 1, except);
    this.worldKey = key; this.worldData = g.getImageData(0, 0, 480, 360); return this.worldData;
  }
  colorMatch(d, i, rgb) {
    return (d[i] & 0xf8) === (rgb[0] & 0xf8) && (d[i + 1] & 0xf8) === (rgb[1] & 0xf8) && (d[i + 2] & 0xf0) === (rgb[2] & 0xf0);
  }
  touchingColor(t, col, mask) {
    if (t.isStage || !t.visible) return false;
    const want = Cast.rgb(col), m = mask != null ? Cast.rgb(mask) : null;
    const w = this.renderWorld(t).data; const b = t.bounds();
    let self = null;
    if (m) { // render just this sprite to test its own colour
      const g = this.wg; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 480, 360); this.drawTarget(g, t, 1); self = g.getImageData(0, 0, 480, 360).data; this.worldKey = null;
    }
    const x0 = Math.max(0, Math.floor(240 + b.left)), x1 = Math.min(480, Math.ceil(240 + b.right));
    const y0 = Math.max(0, Math.floor(180 - b.top)), y1 = Math.min(360, Math.ceil(180 - b.bottom));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      if (!t.hit(px - 240 + 0.5, 180 - py - 0.5)) continue;
      const i = (py * 480 + px) * 4;
      if (m && !this.colorMatch(self, i, m)) continue;
      if (w[i + 3] > 0 && this.colorMatch(w, i, want)) return true;
    }
    return false;
  }

  /* ---- pen ---- */
  penRGBA(t) { const [r, g, b] = hsvToRgb(t.pen.h / 100, t.pen.s / 100, t.pen.v / 100); return `rgba(${r | 0},${g | 0},${b | 0},${1 - t.pen.t / 100})`; }
  penLine(t, x0, y0, x1, y1) {
    const g = this.pg; g.setTransform(2, 0, 0, 2, 480, 360);
    g.strokeStyle = this.penRGBA(t); g.lineWidth = t.pen.size; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, -y0); g.lineTo(x1 + (x0 === x1 && y0 === y1 ? 0.01 : 0), -y1); g.stroke();
    this.redraw = true;
  }

  /* ---- rendering ---- */
  costumeWithEffects(t) {
    const c = t.cost; if (!c || !c.img) return null;
    const e = t.effects, px = Cast.num(e.pixelate), mo = Cast.num(e.mosaic), wh = Cast.num(e.whirl), fe = Cast.num(e.fisheye), br = Cast.num(e.brightness);
    if (!px && !mo && !wh && !fe && !br) return c.img;
    const key = c.url.length + ':' + c.url.slice(-40) + [px, mo, wh, fe, br].join(',');
    if (this.fxCache.has(key)) return this.fxCache.get(key);
    const w = c.w, h = c.h, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(c.img, 0, 0, w, h);
    if (wh || fe) {
      const src = g.getImageData(0, 0, w, h), dst = g.createImageData(w, h);
      const cx = w / 2, cy = h / 2, rMax = Math.min(w, h) / 2, whirl = rad(wh), fish = Math.max(0, (fe + 100) / 100);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let dx = (x - cx) / rMax, dy = (y - cy) / rMax, r = Math.hypot(dx, dy), sx = x, sy = y;
        if (r < 1) {
          if (fe) { const rr = Math.pow(r, fish); const k = r ? rr / r : 1; dx *= k; dy *= k; }
          if (wh) { const ang = whirl * (1 - r) * (1 - r), cs = Math.cos(ang), sn = Math.sin(ang); const ndx = dx * cs - dy * sn, ndy = dx * sn + dy * cs; dx = ndx; dy = ndy; }
          sx = Math.round(cx + dx * rMax); sy = Math.round(cy + dy * rMax);
        }
        if (sx >= 0 && sy >= 0 && sx < w && sy < h) { const si = (sy * w + sx) * 4, di = (y * w + x) * 4; for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k]; }
      }
      g.putImageData(dst, 0, 0);
    }
    if (px) {
      const n = Math.max(1, Math.round(Math.abs(px) / 10)); const sw = Math.max(1, Math.round(w / n)), sh = Math.max(1, Math.round(h / n));
      const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh; tmp.getContext('2d').drawImage(cv, 0, 0, sw, sh);
      g.clearRect(0, 0, w, h); g.imageSmoothingEnabled = false; g.drawImage(tmp, 0, 0, w, h);
    }
    if (mo) {
      const n = clampN(Math.round((Math.abs(mo) + 10) / 10), 1, 64);
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; tmp.getContext('2d').drawImage(cv, 0, 0);
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g.drawImage(tmp, i * w / n, j * h / n, w / n, h / n);
    }
    if (br) {
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = Math.min(1, Math.abs(br) / 100);
      g.fillStyle = br > 0 ? '#fff' : '#000'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    if (this.fxCache.size > 80) this.fxCache.delete(this.fxCache.keys().next().value);
    this.fxCache.set(key, cv); return cv;
  }
  drawTarget(g, t, k) {
    const c = t.cost; if (!c || !c.img || !t.visible) return;
    const img = this.costumeWithEffects(t);
    g.save();
    g.setTransform(k, 0, 0, k, 0, 0);
    if (t.isStage) {
      const s = 1 / (c.res || 1);
      g.translate(240, 180); g.scale(s, s); g.translate(-c.cx, -c.cy);
    } else {
      g.translate(240 + t.x, 180 - t.y); g.rotate(rad(t.angle())); const s = t.scale(); g.scale(s * t.flip(), s); g.translate(-c.cx, -c.cy);
    }
    const ghost = Cast.num(t.effects.ghost); g.globalAlpha = 1 - clampN(ghost, 0, 100) / 100;
    const col = Cast.num(t.effects.color); if (col) g.filter = `hue-rotate(${(col * 1.8) % 360}deg)`;
    g.drawImage(img, 0, 0, c.w, c.h);
    g.restore();
  }
  drawStage(g, k, except) {
    if (this.stage) this.drawTarget(g, this.stage, k);
    g.save(); g.setTransform(k / 2, 0, 0, k / 2, 0, 0); g.drawImage(this.pen, 0, 0); g.restore();
    for (const t of this.drawOrder()) if (t !== except) this.drawTarget(g, t, k);
  }
  render() {
    const cv = this.canvas, g = this.g; const k = cv.width / 480;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    this.drawStage(g, k, null);
    for (const t of this.drawOrder()) if (t.bubble && t.visible) this.drawBubble(g, t, k);
    this.emit('render', g, k);
  }
  drawBubble(g, t, k) {
    g.save(); g.setTransform(k, 0, 0, k, 0, 0);
    g.font = '14px system-ui, Helvetica, Arial, sans-serif';
    const words = t.bubble.text.split(/(\s+)/); const lines = []; let line = '';
    for (const w of words) {
      if (g.measureText(line + w).width > 170 && line) { lines.push(line.trim()); line = w.trimStart(); }
      else line += w;
      while (g.measureText(line).width > 170) { let i = line.length; while (i > 1 && g.measureText(line.slice(0, i)).width > 170) i--; lines.push(line.slice(0, i)); line = line.slice(i); }
    }
    if (line.trim() || !lines.length) lines.push(line.trim());
    const w = Math.max(50, Math.min(190, Math.max(...lines.map(l => g.measureText(l).width)) + 20)), h = lines.length * 17 + 14;
    const b = t.bounds();
    let x = 240 + b.right, y = 180 - b.top - h - 12, left = false;
    if (x + w > 478) { x = 240 + b.left - w; left = true; }
    x = clampN(x, 2, 478 - w); y = clampN(y, 2, 358 - h - 12);
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 14); else g.rect(x, y, w, h); g.fill(); g.stroke();
    if (t.bubble.type === 'think') {
      for (const [dx, dy, r] of [[left ? w - 16 : 16, h + 6, 5], [left ? w - 8 : 8, h + 14, 3]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); g.stroke(); }
    } else {
      const bx = left ? x + w - 22 : x + 16;
      g.beginPath(); g.moveTo(bx, y + h - 1); g.lineTo(bx + (left ? 12 : -6), y + h + 11); g.lineTo(bx + (left ? 2 : 10), y + h - 1); g.fill();
      g.beginPath(); g.moveTo(bx, y + h); g.lineTo(bx + (left ? 12 : -6), y + h + 11); g.lineTo(bx + (left ? 2 : 10), y + h); g.stroke();
      g.fillRect(bx - 1, y + h - 3, 13, 4);
    }
    g.fillStyle = '#575e75'; g.textBaseline = 'top';
    lines.forEach((l, i) => g.fillText(l, x + 10, y + 8 + i * 17));
    g.restore();
  }

  /* ---- monitors ---- */
  monitorValue(m) {
    const t = m.targetId ? this.targets.find(x => x.id === m.targetId && !x.isClone) || this.stage : this.stage;
    if (m.opcode === 'data_variable' || m.opcode === 'data_listcontents') {
      const type = m.opcode === 'data_listcontents' ? 'list' : '';
      const v = t.vars.get(m.id) || this.stage.vars.get(m.id); if (!v) return type ? [] : '';
      return v.value;
    }
    const th = { target: t, frames: [], warp: 0 };
    try { return this.ev(th, { op: m.opcode, f: m.fields || {}, fid: {}, i: {}, s: {} }); } catch (e) { return ''; }
  }

  /* ---- saving back ---- */
  snapshot(project) { // write current state of originals into the project
    for (const d of project.targets) {
      const t = this.targets.find(x => x.id === d.id && !x.isClone); if (!t) continue;
      Object.assign(d, { x: round(t.x), y: round(t.y), direction: t.dir, size: t.size, visible: t.visible, currentCostume: t.costume,
        rotationStyle: t.rotationStyle, draggable: t.draggable, volume: t.volume });
      if (t.isStage) d.tempo = this.tempo;
    }
    for (const [id, v] of Object.entries(project.variables || {})) {
      const owner = v.owner === 'stage' ? this.stage : this.targets.find(t => t.id === v.owner && !t.isClone);
      const live = owner && owner.vars.get(id); if (live) v.value = Array.isArray(live.value) ? [...live.value] : live.value;
    }
  }
}
RB.VM = VM; RB.Target = Target;

/* ================= block implementations ================= */
// C: commands (may be generators), R: reporters (synchronous)
const C = {}, R = {};
RB.C = C; RB.R = R;
const num = (vm, th, n, k) => Cast.num(vm.arg(th, n, k));
const str = (vm, th, n, k) => Cast.str(vm.arg(th, n, k));
function* waitSecs(vm, th, secs) {
  const end = performance.now() + Math.max(0, secs) * 1000;
  vm.redraw = true; yield;
  while (performance.now() < end) { th.waiting = true; yield; }
}
function* waitFor(th, promise) {
  let done = false; promise.then(() => { done = true; }, () => { done = true; });
  while (!done) { th.waiting = true; yield; }
}
function targetPos(vm, t, what) {
  what = Cast.str(what);
  if (what === '_mouse_') return [vm.mouse.x, vm.mouse.y];
  if (what === '_random_') return [Math.round(480 * (Math.random() - 0.5)), Math.round(360 * (Math.random() - 0.5))];
  const o = vm.byName(what); return o ? [o.x, o.y] : null;
}

// ---- shadows / menus ----
for (const op of ['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'math_angle']) R[op] = function (t, n) { const v = n.f.NUM; return v === '' || v == null ? 0 : v; };
R.text = (t, n) => n.f.TEXT == null ? '' : n.f.TEXT;
R.colour_picker = (t, n) => n.f.COLOUR;
R.note = (t, n) => n.f.NOTE;

// ---- motion ----
C.motion_movesteps = function (t, n, th) {
  const s = num(this, th, n, 'STEPS'), a = rad(90 - t.dir);
  t.setXY(t.x + s * Math.cos(a), t.y + s * Math.sin(a));
};
C.motion_turnright = function (t, n, th) { t.setDir(t.dir + num(this, th, n, 'DEGREES')); };
C.motion_turnleft = function (t, n, th) { t.setDir(t.dir - num(this, th, n, 'DEGREES')); };
C.motion_goto = function (t, n, th) { const p = targetPos(this, t, this.arg(th, n, 'TO')); if (p) t.setXY(p[0], p[1]); };
C.motion_gotoxy = function (t, n, th) { t.setXY(num(this, th, n, 'X'), num(this, th, n, 'Y')); };
function* glide(vm, t, th, secs, x, y) {
  const x0 = t.x, y0 = t.y, t0 = performance.now(), dur = secs * 1000;
  if (dur <= 0) { t.setXY(x, y); return; }
  while (true) {
    const f = Math.min(1, (performance.now() - t0) / dur);
    t.setXY(x0 + (x - x0) * f, y0 + (y - y0) * f);
    if (f >= 1) break;
    th.waiting = true; yield;
  }
}
C.motion_glideto = function* (t, n, th) { const s = num(this, th, n, 'SECS'); const p = targetPos(this, t, this.arg(th, n, 'TO')); if (p) yield* glide(this, t, th, s, p[0], p[1]); };
C.motion_glidesecstoxy = function* (t, n, th) { yield* glide(this, t, th, num(this, th, n, 'SECS'), num(this, th, n, 'X'), num(this, th, n, 'Y')); };
C.motion_pointindirection = function (t, n, th) { t.setDir(num(this, th, n, 'DIRECTION')); };
C.motion_pointtowards = function (t, n, th) {
  const what = Cast.str(this.arg(th, n, 'TOWARDS'));
  if (what === '_random_') { t.setDir(Math.round(Math.random() * 360) - 180); return; }
  const p = targetPos(this, t, what); if (!p) return;
  const dx = p[0] - t.x, dy = p[1] - t.y; t.setDir(90 - Math.atan2(dy, dx) * 180 / Math.PI);
};
C.motion_changexby = function (t, n, th) { t.setXY(t.x + num(this, th, n, 'DX'), t.y); };
C.motion_setx = function (t, n, th) { t.setXY(num(this, th, n, 'X'), t.y); };
C.motion_changeyby = function (t, n, th) { t.setXY(t.x, t.y + num(this, th, n, 'DY')); };
C.motion_sety = function (t, n, th) { t.setXY(t.x, num(this, th, n, 'Y')); };
C.motion_ifonedgebounce = function (t) {
  const b = t.bounds();
  const dl = Math.max(0, 240 + b.left), dt = Math.max(0, 180 - b.top), dr = Math.max(0, 240 - b.right), db = Math.max(0, 180 + b.bottom);
  let min = Infinity, near = null;
  for (const [k, v] of [['left', dl], ['top', dt], ['right', dr], ['bottom', db]]) if (v < min) { min = v; near = k; }
  if (min > 0) return;
  const a = rad(90 - t.dir); let dx = Math.cos(a), dy = -Math.sin(a);
  if (near === 'left') dx = Math.max(0.2, Math.abs(dx)); else if (near === 'top') dy = Math.max(0.2, Math.abs(dy));
  else if (near === 'right') dx = -Math.max(0.2, Math.abs(dx)); else dy = -Math.max(0.2, Math.abs(dy));
  t.setDir(Math.atan2(dy, dx) * 180 / Math.PI + 90);
  const nb = t.bounds(); let fx = 0, fy = 0;
  if (nb.left < -240) fx = -240 - nb.left; if (nb.right > 240) fx = 240 - nb.right;
  if (nb.top > 180) fy = 180 - nb.top; if (nb.bottom < -180) fy = -180 - nb.bottom;
  t.setXY(t.x + fx, t.y + fy);
};
C.motion_setrotationstyle = function (t, n) { t.rotationStyle = n.f.STYLE; this.redraw = true; };
R.motion_xposition = t => round(t.x);
R.motion_yposition = t => round(t.y);
R.motion_direction = t => t.dir;
// Scratch 2 scrolling blocks exist in the library but do nothing in Scratch 3
C.motion_scroll_right = C.motion_scroll_up = C.motion_align_scene = function () { };
R.motion_xscroll = R.motion_yscroll = () => 0;
R.motion_goto_menu = (t, n) => n.f.TO; R.motion_glideto_menu = (t, n) => n.f.TO; R.motion_pointtowards_menu = (t, n) => n.f.TOWARDS;

// ---- looks ----
function* sayFor(vm, t, th, type, text, secs) {
  t.say(type, text); const mine = t.bubble;
  yield* waitSecs(vm, th, secs);
  if (t.bubble === mine) t.say(type, '');
}
C.looks_sayforsecs = function* (t, n, th) { yield* sayFor(this, t, th, 'say', this.arg(th, n, 'MESSAGE'), num(this, th, n, 'SECS')); };
C.looks_say = function (t, n, th) { t.say('say', this.arg(th, n, 'MESSAGE')); };
C.looks_thinkforsecs = function* (t, n, th) { yield* sayFor(this, t, th, 'think', this.arg(th, n, 'MESSAGE'), num(this, th, n, 'SECS')); };
C.looks_think = function (t, n, th) { t.say('think', this.arg(th, n, 'MESSAGE')); };
C.looks_show = function (t) { t.visible = true; this.redraw = true; };
C.looks_hide = function (t) { t.visible = false; this.redraw = true; };
C.looks_hideallsprites = function () { for (const t of this.spriteTargets()) t.visible = false; this.redraw = true; };
const EFFECT_LIMITS = { ghost: [0, 100], brightness: [-100, 100] };
function setEffect(t, name, v) {
  name = Cast.str(name).toLowerCase(); const lim = EFFECT_LIMITS[name];
  t.effects[name] = lim ? clampN(v, lim[0], lim[1]) : v; t.vm.redraw = true;
}
C.looks_changeeffectby = function (t, n, th) { const e = n.f.EFFECT.toLowerCase(); setEffect(t, e, Cast.num(t.effects[e]) + num(this, th, n, 'CHANGE')); };
C.looks_seteffectto = function (t, n, th) { setEffect(t, n.f.EFFECT, num(this, th, n, 'VALUE')); };
C.looks_cleargraphiceffects = function (t) { t.effects = {}; this.redraw = true; };
C.looks_changesizeby = function (t, n, th) { t.setSize(t.size + num(this, th, n, 'CHANGE')); };
C.looks_setsizeto = function (t, n, th) { t.setSize(num(this, th, n, 'SIZE')); };
R.looks_size = t => Math.round(t.size);
C.looks_changestretchby = C.looks_setstretchto = function () { };
C.looks_switchcostumeto = function (t, n, th) { t.costumeBy(this.arg(th, n, 'COSTUME'), false); };
C.looks_nextcostume = function (t) { t.setCostume(t.costume + 1); };
C.looks_switchbackdropto = function (t, n, th) { this.stage.costumeBy(this.arg(th, n, 'BACKDROP'), true); };
C.looks_switchbackdroptoandwait = function* (t, n, th) {
  this.lastBackdrop = [];
  this.stage.costumeBy(this.arg(th, n, 'BACKDROP'), true);
  const mine = this.lastBackdrop; yield;
  while (mine.some(x => !x.done)) { th.waiting = true; yield; }
};
C.looks_nextbackdrop = function () { this.stage.setCostume(this.stage.costume + 1); };
C.looks_gotofrontback = function (t, n) {
  if (t.isStage) return;
  const i = this.targets.indexOf(t); this.targets.splice(i, 1);
  if (n.f.FRONT_BACK === 'front') this.targets.push(t);
  else this.targets.splice(this.targets.indexOf(this.stage) + 1, 0, t);
  this.redraw = true;
};
C.looks_goforwardbackwardlayers = function (t, n, th) {
  if (t.isStage) return;
  const k = Math.round(num(this, th, n, 'NUM')) * (n.f.FORWARD_BACKWARD === 'forward' ? 1 : -1);
  const i = this.targets.indexOf(t); this.targets.splice(i, 1);
  const min = this.targets.indexOf(this.stage) + 1;
  this.targets.splice(clampN(i + k, min, this.targets.length), 0, t); this.redraw = true;
};
R.looks_costumenumbername = (t, n) => n.f.NUMBER_NAME === 'name' ? (t.cost ? t.cost.name : '') : t.costume + 1;
R.looks_backdropnumbername = function (t, n) { const s = this.stage; return n.f.NUMBER_NAME === 'name' ? (s.cost ? s.cost.name : '') : s.costume + 1; };
R.looks_costume = (t, n) => n.f.COSTUME; R.looks_backdrops = (t, n) => n.f.BACKDROP;

// ---- sound ----
function soundBy(t, v) {
  const list = t.sprite.sounds; if (!list.length) return null;
  const s = Cast.str(v); const byName = list.find(x => x.name === s); if (byName) return byName;
  if (!Cast.isWhite(s) && !Number.isNaN(Number(s))) { const i = Math.round(Number(s)) - 1; return list[((i % list.length) + list.length) % list.length]; }
  return null;
}
C.sound_play = function (t, n, th) { const s = soundBy(t, this.arg(th, n, 'SOUND_MENU')); if (s) this.sound.play(t, s); };
C.sound_playuntildone = function* (t, n, th) { const s = soundBy(t, this.arg(th, n, 'SOUND_MENU')); if (s) yield* waitFor(th, this.sound.play(t, s)); };
C.sound_stopallsounds = function () { this.sound.stop(); };
C.sound_seteffectto = function (t, n, th) { const k = n.f.EFFECT.toLowerCase(); t.sfx[k] = clampN(num(this, th, n, 'VALUE'), k === 'pan' ? -100 : -360, k === 'pan' ? 100 : 360); this.sound.update(t); };
C.sound_changeeffectby = function (t, n, th) { const k = n.f.EFFECT.toLowerCase(); t.sfx[k] = clampN((t.sfx[k] || 0) + num(this, th, n, 'VALUE'), k === 'pan' ? -100 : -360, k === 'pan' ? 100 : 360); this.sound.update(t); };
C.sound_cleareffects = function (t) { t.sfx = { pitch: 0, pan: 0 }; this.sound.update(t); };
C.sound_changevolumeby = function (t, n, th) { t.volume = clampN(t.volume + num(this, th, n, 'VOLUME'), 0, 100); this.sound.update(t); };
C.sound_setvolumeto = function (t, n, th) { t.volume = clampN(num(this, th, n, 'VOLUME'), 0, 100); this.sound.update(t); };
R.sound_volume = t => t.volume;
R.sound_sounds_menu = (t, n) => n.f.SOUND_MENU;

// ---- events ----
C.event_broadcast = function (t, n, th) { this.broadcast(this.arg(th, n, 'BROADCAST_INPUT')); };
C.event_broadcastandwait = function* (t, n, th) {
  const started = this.broadcast(this.arg(th, n, 'BROADCAST_INPUT'));
  yield;
  while (started.some(x => !x.done)) { th.waiting = true; yield; }
};
R.event_broadcast_menu = (t, n) => n.f.BROADCAST_OPTION;
R.event_touchingobjectmenu = (t, n) => n.f.TOUCHINGOBJECTMENU;

// ---- control ----
C.control_wait = function* (t, n, th) { yield* waitSecs(this, th, num(this, th, n, 'DURATION')); };
C.control_repeat = function* (t, n, th) {
  const times = Math.round(num(this, th, n, 'TIMES'));
  for (let i = 0; i < times; i++) { yield* this.stack(th, n.s.SUBSTACK); yield* this.yieldLoop(th); }
};
C.control_forever = function* (t, n, th) { while (true) { yield* this.stack(th, n.s.SUBSTACK); yield* this.yieldLoop(th); } };
C.control_if = function* (t, n, th) { if (Cast.bool(this.arg(th, n, 'CONDITION'))) yield* this.stack(th, n.s.SUBSTACK); };
C.control_if_else = function* (t, n, th) { yield* this.stack(th, Cast.bool(this.arg(th, n, 'CONDITION')) ? n.s.SUBSTACK : n.s.SUBSTACK2); };
C.control_wait_until = function* (t, n, th) { while (!Cast.bool(this.arg(th, n, 'CONDITION'))) { th.waiting = true; yield; } };
C.control_repeat_until = function* (t, n, th) { while (!Cast.bool(this.arg(th, n, 'CONDITION'))) { yield* this.stack(th, n.s.SUBSTACK); yield* this.yieldLoop(th); } };
C.control_while = function* (t, n, th) { while (Cast.bool(this.arg(th, n, 'CONDITION'))) { yield* this.stack(th, n.s.SUBSTACK); yield* this.yieldLoop(th); } };
C.control_for_each = function* (t, n, th) {
  const v = this.varOf(t, n); const times = Math.round(num(this, th, n, 'VALUE'));
  for (let i = 1; i <= times; i++) { v.value = i; yield* this.stack(th, n.s.SUBSTACK); yield* this.yieldLoop(th); }
};
C.control_all_at_once = function* (t, n, th) { th.warp++; try { yield* this.stack(th, n.s.SUBSTACK); } finally { th.warp--; } };
C.control_stop = function (t, n, th) {
  const o = n.f.STOP_OPTION;
  if (o === 'all') { this.stopAll(); throw new StopThread(); }
  if (o === 'other scripts in sprite' || o === 'other scripts in stage') { for (const x of this.threads) if (x.target === t && x !== th) x.done = true; return; }
  throw new StopScript();
};
C.control_create_clone_of = function (t, n, th) {
  const w = Cast.str(this.arg(th, n, 'CLONE_OPTION'));
  const src = w === '_myself_' ? t : this.byName(w); if (src) this.createClone(src);
};
C.control_delete_this_clone = function (t, n, th) { if (t.isClone) { this.deleteClone(t); throw new StopThread(); } };
R.control_create_clone_of_menu = (t, n) => n.f.CLONE_OPTION;
R.control_get_counter = function () { return this.counter || 0; };
C.control_incr_counter = function () { this.counter = (this.counter || 0) + 1; };
C.control_clear_counter = function () { this.counter = 0; };

// ---- sensing ----
R.sensing_touchingobject = function (t, n, th) { return this.touching(t, this.arg(th, n, 'TOUCHINGOBJECTMENU')); };
R.sensing_touchingobjectmenu = (t, n) => n.f.TOUCHINGOBJECTMENU;
R.sensing_touchingcolor = function (t, n, th) { return this.touchingColor(t, this.arg(th, n, 'COLOR')); };
R.sensing_coloristouchingcolor = function (t, n, th) { return this.touchingColor(t, this.arg(th, n, 'COLOR2'), this.arg(th, n, 'COLOR')); };
R.sensing_distanceto = function (t, n, th) {
  if (t.isStage) return 10000;
  const p = targetPos(this, t, this.arg(th, n, 'DISTANCETOMENU')); if (!p) return 10000;
  return round(Math.hypot(p[0] - t.x, p[1] - t.y));
};
R.sensing_distancetomenu = (t, n) => n.f.DISTANCETOMENU;
C.sensing_askandwait = function* (t, n, th) {
  const q = str(this, th, n, 'QUESTION');
  while (this.askQ) { th.waiting = true; yield; }
  const showBubble = !t.isStage && t.visible;
  if (showBubble) t.say('say', q);
  let answered = false;
  this.askQ = { text: showBubble ? '' : q, done: a => { this.answer = a; answered = true; } };
  this.emit('ask', this.askQ);
  while (!answered) { if (!this.askQ) break; th.waiting = true; yield; }
  if (showBubble) t.say('say', '');
  this.askQ = null; this.emit('ask', null);
};
R.sensing_answer = function () { return this.answer; };
R.sensing_keypressed = function (t, n, th) {
  const k = Cast.str(this.arg(th, n, 'KEY_OPTION'));
  return k === 'any' ? this.keys.size > 0 : this.keys.has(k.length === 1 ? k.toLowerCase() : k);
};
R.sensing_keyoptions = (t, n) => n.f.KEY_OPTION;
R.sensing_mousedown = function () { return this.mouse.down; };
R.sensing_mousex = function () { return round(this.mouse.x); };
R.sensing_mousey = function () { return round(this.mouse.y); };
C.sensing_setdragmode = function (t, n) { t.draggable = n.f.DRAG_MODE === 'draggable'; };
R.sensing_loudness = function () { return this.loudness(); };
R.sensing_loud = function () { return this.loudness() > 10; };
R.sensing_timer = function () { return round(this.timer()); };
C.sensing_resettimer = function () { this.timer0 = performance.now(); };
R.sensing_of_object_menu = (t, n) => n.f.OBJECT;
R.sensing_of = function (t, n, th) {
  const obj = Cast.str(this.arg(th, n, 'OBJECT')), p = n.f.PROPERTY;
  if (obj === '_stage_') {
    const s = this.stage;
    if (p === 'backdrop #') return s.costume + 1;
    if (p === 'backdrop name') return s.cost ? s.cost.name : '';
    if (p === 'volume') return s.volume;
    for (const v of s.vars.values()) if (v.name === p && v.type === '') return v.value;
    return 0;
  }
  const o = this.byName(obj); if (!o) return 0;
  switch (p) {
    case 'x position': return round(o.x); case 'y position': return round(o.y);
    case 'direction': return o.dir; case 'costume #': return o.costume + 1;
    case 'costume name': return o.cost ? o.cost.name : ''; case 'size': return Math.round(o.size);
    case 'volume': return o.volume;
  }
  for (const v of o.vars.values()) if (v.name === p && v.type === '') return v.value;
  return 0;
};
R.sensing_current = (t, n) => {
  const d = new Date();
  switch (n.f.CURRENTMENU) {
    case 'YEAR': return d.getFullYear(); case 'MONTH': return d.getMonth() + 1; case 'DATE': return d.getDate();
    case 'DAYOFWEEK': return d.getDay() + 1; case 'HOUR': return d.getHours(); case 'MINUTE': return d.getMinutes(); case 'SECOND': return d.getSeconds();
  }
  return 0;
};
R.sensing_dayssince2000 = () => (Date.now() - Date.UTC(2000, 0, 1)) / 86400000;
R.sensing_username = () => (RB.host && RB.host.username()) || '';
R.sensing_userid = () => '';

// ---- operators ----
R.operator_add = function (t, n, th) { return num(this, th, n, 'NUM1') + num(this, th, n, 'NUM2'); };
R.operator_subtract = function (t, n, th) { return num(this, th, n, 'NUM1') - num(this, th, n, 'NUM2'); };
R.operator_multiply = function (t, n, th) { return num(this, th, n, 'NUM1') * num(this, th, n, 'NUM2'); };
R.operator_divide = function (t, n, th) { return num(this, th, n, 'NUM1') / num(this, th, n, 'NUM2'); };
R.operator_random = function (t, n, th) {
  const a = this.arg(th, n, 'FROM'), b = this.arg(th, n, 'TO');
  const lo = Math.min(Cast.num(a), Cast.num(b)), hi = Math.max(Cast.num(a), Cast.num(b));
  if (lo === hi) return lo;
  if (Cast.isInt(a) && Cast.isInt(b)) return lo + Math.floor(Math.random() * (hi + 1 - lo));
  return Math.random() * (hi - lo) + lo;
};
R.operator_lt = function (t, n, th) { return Cast.compare(this.arg(th, n, 'OPERAND1'), this.arg(th, n, 'OPERAND2')) < 0; };
R.operator_equals = function (t, n, th) { return Cast.compare(this.arg(th, n, 'OPERAND1'), this.arg(th, n, 'OPERAND2')) === 0; };
R.operator_gt = function (t, n, th) { return Cast.compare(this.arg(th, n, 'OPERAND1'), this.arg(th, n, 'OPERAND2')) > 0; };
R.operator_and = function (t, n, th) { return Cast.bool(this.arg(th, n, 'OPERAND1')) && Cast.bool(this.arg(th, n, 'OPERAND2')); };
R.operator_or = function (t, n, th) { return Cast.bool(this.arg(th, n, 'OPERAND1')) || Cast.bool(this.arg(th, n, 'OPERAND2')); };
R.operator_not = function (t, n, th) { return !Cast.bool(this.arg(th, n, 'OPERAND')); };
R.operator_join = function (t, n, th) { return str(this, th, n, 'STRING1') + str(this, th, n, 'STRING2'); };
R.operator_letter_of = function (t, n, th) { const s = str(this, th, n, 'STRING'), i = Math.floor(num(this, th, n, 'LETTER')) - 1; return i < 0 || i >= s.length ? '' : s[i]; };
R.operator_length = function (t, n, th) { return str(this, th, n, 'STRING').length; };
R.operator_contains = function (t, n, th) { return str(this, th, n, 'STRING1').toLowerCase().includes(str(this, th, n, 'STRING2').toLowerCase()); };
R.operator_mod = function (t, n, th) { const a = num(this, th, n, 'NUM1'), b = num(this, th, n, 'NUM2'); let r = a % b; if (r / b < 0) r += b; return r; };
R.operator_round = function (t, n, th) { return Math.round(num(this, th, n, 'NUM')); };
R.operator_mathop = function (t, n, th) {
  const v = num(this, th, n, 'NUM');
  switch (n.f.OPERATOR.toLowerCase()) {
    case 'abs': return Math.abs(v); case 'floor': return Math.floor(v); case 'ceiling': return Math.ceil(v); case 'sqrt': return Math.sqrt(v);
    case 'sin': return round(Math.sin(rad(v))); case 'cos': return round(Math.cos(rad(v)));
    case 'tan': { const a = ((v % 360) + 360) % 360; if (a === 90) return Infinity; if (a === 270) return -Infinity; return round(Math.tan(rad(v))); }
    case 'asin': return Math.asin(v) * 180 / Math.PI; case 'acos': return Math.acos(v) * 180 / Math.PI; case 'atan': return Math.atan(v) * 180 / Math.PI;
    case 'ln': return Math.log(v); case 'log': return Math.log(v) / Math.LN10; case 'e ^': return Math.exp(v); case '10 ^': return Math.pow(10, v);
  }
  return 0;
};

// ---- variables and lists ----
R.data_variable = function (t, n) { return this.varOf(t, n).value; };
C.data_setvariableto = function (t, n, th) { this.varOf(t, n).value = this.arg(th, n, 'VALUE'); };
C.data_changevariableby = function (t, n, th) { const v = this.varOf(t, n); v.value = Cast.num(v.value) + num(this, th, n, 'VALUE'); };
function monitorShow(vm, t, n, type, show) {
  const v = vm.varOf(t, n, type ? 'LIST' : 'VARIABLE', type);
  const owner = t.vars.has(v.id) ? t : vm.stage;
  if (show) vm.monitors.set(v.id, { id: v.id, opcode: type ? 'data_listcontents' : 'data_variable', targetId: owner.isStage ? null : owner.id, visible: true });
  else vm.monitors.delete(v.id);
  vm.emit('monitors');
}
C.data_showvariable = function (t, n) { monitorShow(this, t, n, '', true); };
C.data_hidevariable = function (t, n) { monitorShow(this, t, n, '', false); };
const listOf = (vm, t, n) => vm.varOf(t, n, 'LIST', 'list');
R.data_listcontents = function (t, n) { return listText(listOf(this, t, n).value); };
C.data_addtolist = function (t, n, th) { const l = listOf(this, t, n); if (l.value.length < 200000) l.value.push(this.arg(th, n, 'ITEM')); };
C.data_deleteoflist = function (t, n, th) {
  const l = listOf(this, t, n); const i = Cast.listIndex(this.arg(th, n, 'INDEX'), l.value.length, true);
  if (i === 'ALL') l.value = []; else if (i) l.value.splice(i - 1, 1);
};
C.data_deletealloflist = function (t, n) { listOf(this, t, n).value = []; };
C.data_insertatlist = function (t, n, th) {
  const l = listOf(this, t, n); const i = Cast.listIndex(this.arg(th, n, 'INDEX'), l.value.length + 1, false);
  if (i) l.value.splice(i - 1, 0, this.arg(th, n, 'ITEM'));
};
C.data_replaceitemoflist = function (t, n, th) {
  const l = listOf(this, t, n); const i = Cast.listIndex(this.arg(th, n, 'INDEX'), l.value.length, false);
  if (i) l.value[i - 1] = this.arg(th, n, 'ITEM');
};
R.data_itemoflist = function (t, n, th) {
  const l = listOf(this, t, n); const i = Cast.listIndex(this.arg(th, n, 'INDEX'), l.value.length, false);
  return i ? l.value[i - 1] : '';
};
R.data_itemnumoflist = function (t, n, th) {
  const l = listOf(this, t, n), item = this.arg(th, n, 'ITEM');
  for (let i = 0; i < l.value.length; i++) if (Cast.compare(l.value[i], item) === 0) return i + 1;
  return 0;
};
R.data_lengthoflist = function (t, n) { return listOf(this, t, n).value.length; };
R.data_listcontainsitem = function (t, n, th) { const item = this.arg(th, n, 'ITEM'); return listOf(this, t, n).value.some(x => Cast.compare(x, item) === 0); };
C.data_showlist = function (t, n) { monitorShow(this, t, n, 'list', true); };
C.data_hidelist = function (t, n) { monitorShow(this, t, n, 'list', false); };
R.data_listindexall = (t, n) => n.f.INDEX; R.data_listindexrandom = (t, n) => n.f.INDEX;

// ---- my blocks ----
C.procedures_call = function* (t, n, th) {
  const code = n.mut && n.mut.proccode; const def = t.sprite.procs[code]; if (!def) return;
  const proto = def.proto; const ids = JSON.parse(proto.mut.argumentids || '[]'), names = JSON.parse(proto.mut.argumentnames || '[]');
  const frame = {};
  ids.forEach((id, k) => { frame[names[k]] = n.i[id] ? this.ev(th, n.i[id]) : (JSON.parse(proto.mut.argumentdefaults || '[]')[k] || ''); });
  if (th.frames.length > 400) { yield; }
  th.frames.push(frame);
  const warp = proto.mut.warp === 'true';
  if (warp) { if (!th.warp) th.warpT = performance.now(); th.warp++; }
  try { yield* this.stack(th, def.next); }
  catch (e) { if (!(e instanceof StopScript)) throw e; }
  finally { th.frames.pop(); if (warp) th.warp--; }
};
function argValue(th, name, dflt) {
  for (let i = th.frames.length - 1; i >= 0; i--) if (name in th.frames[i]) return th.frames[i][name];
  return dflt;
}
R.argument_reporter_string_number = function (t, n, th) { return argValue(th, n.f.VALUE, 0); };
R.argument_reporter_boolean = function (t, n, th) { return Cast.bool(argValue(th, n.f.VALUE, false)); };

// ---- pen ----
C.pen_clear = function () { this.pg.setTransform(1, 0, 0, 1, 0, 0); this.pg.clearRect(0, 0, 960, 720); this.redraw = true; };
C.pen_stamp = function (t) { this.drawTarget(this.pg, t, 2); this.redraw = true; };
C.pen_penDown = function (t) { t.pen.down = true; this.penLine(t, t.x, t.y, t.x, t.y); };
C.pen_penUp = function (t) { t.pen.down = false; };
C.pen_setPenColorToColor = function (t, n, th) {
  const v = this.arg(th, n, 'COLOR'); const [r, g, b] = Cast.rgb(v); const [h, s, vv] = rgbToHsv(r, g, b);
  Object.assign(t.pen, { h: h * 100, s: s * 100, v: vv * 100 });
  if (typeof v === 'string' && v.length === 9) t.pen.t = 100 - parseInt(v.slice(7), 16) / 2.55; else t.pen.t = 0;
};
function penParam(t, p, v, change) {
  p = Cast.str(p).toLowerCase(); const map = { color: 'h', saturation: 's', brightness: 'v', transparency: 't' }; const k = map[p]; if (!k) return;
  let x = change ? t.pen[k] + v : v;
  if (k === 'h') x = ((x % 100) + 100) % 100; else x = clampN(x, 0, 100);
  t.pen[k] = x;
}
C.pen_changePenColorParamBy = function (t, n, th) { penParam(t, this.arg(th, n, 'COLOR_PARAM'), num(this, th, n, 'VALUE'), true); };
C.pen_setPenColorParamTo = function (t, n, th) { penParam(t, this.arg(th, n, 'COLOR_PARAM'), num(this, th, n, 'VALUE'), false); };
C.pen_changePenSizeBy = function (t, n, th) { t.pen.size = clampN(t.pen.size + num(this, th, n, 'SIZE'), 1, 1200); };
C.pen_setPenSizeTo = function (t, n, th) { t.pen.size = clampN(num(this, th, n, 'SIZE'), 1, 1200); };
R.pen_menu_colorParam = (t, n) => n.f.colorParam;

// ---- music ----
const beats = (vm, b) => Math.max(0, Math.min(100, b)) * 60 / vm.tempo;
C.music_playDrumForBeats = function* (t, n, th) { this.sound.drum(t, Math.round(num(this, th, n, 'DRUM'))); yield* waitSecs(this, th, beats(this, num(this, th, n, 'BEATS'))); };
C.music_restForBeats = function* (t, n, th) { yield* waitSecs(this, th, beats(this, num(this, th, n, 'BEATS'))); };
C.music_playNoteForBeats = function* (t, n, th) {
  const secs = beats(this, num(this, th, n, 'BEATS'));
  this.sound.note(t, clampN(num(this, th, n, 'NOTE'), 0, 130), secs, t.instrument); yield* waitSecs(this, th, secs);
};
C.music_setInstrument = function (t, n, th) { t.instrument = clampN(Math.round(num(this, th, n, 'INSTRUMENT')), 1, RB.INSTRUMENTS.length); };
C.music_setTempo = function (t, n, th) { this.tempo = clampN(num(this, th, n, 'TEMPO'), 20, 500); };
C.music_changeTempo = function (t, n, th) { this.tempo = clampN(this.tempo + num(this, th, n, 'TEMPO'), 20, 500); };
R.music_getTempo = function () { return this.tempo; };
R.music_menu_DRUM = (t, n) => n.f.DRUM; R.music_menu_INSTRUMENT = (t, n) => n.f.INSTRUMENT;

// ---- text to speech ----
const VOICES = { ALTO: [1, 1], TENOR: [0.7, 0.95], SQUEAK: [2, 1.2], GIANT: [0.1, 0.75], KITTEN: [1.8, 1.1] };
C.text2speech_speakAndWait = function* (t, n, th) {
  let text = str(this, th, n, 'WORDS'); if (!text || !window.speechSynthesis) return;
  if (t.voice === 'KITTEN') text = text.replace(/\S+/g, 'mjau');
  const u = new SpeechSynthesisUtterance(text.slice(0, 300)); u.lang = this.ttsLang || 'sv-SE';
  const [p, r] = VOICES[t.voice] || VOICES.ALTO; u.pitch = p; u.rate = r; u.volume = t.volume / 100;
  const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase())); if (v) u.voice = v;
  let done = false; u.onend = u.onerror = () => { done = true; };
  speechSynthesis.speak(u);
  const t0 = performance.now(), max = 1500 + text.length * 120;
  while (!done && performance.now() - t0 < max) { th.waiting = true; yield; }
};
C.text2speech_setVoice = function (t, n, th) { t.voice = str(this, th, n, 'VOICE'); };
C.text2speech_setLanguage = function (t, n, th) { this.ttsLang = str(this, th, n, 'LANGUAGE'); };
R.text2speech_menu_voices = (t, n) => n.f.voices; R.text2speech_menu_languages = (t, n) => n.f.languages;

// ---- AI agent ----
// The agent learns which option is best in each situation of a game. Every
// choice is remembered until "belöna agenten": then the reward flows back to
// the choices of this round, most to the latest one.
function brain() { return RB.host && RB.host.agent(); }
function aiMemory(vm) {
  const ag = brain(); if (!ag) return null;
  ag.play = ag.play || {}; const key = vm.project ? vm.project.id : 'x';
  return ag.play[key] = ag.play[key] || {};
}
function splitOptions(v) {
  const s = Cast.str(v).trim(); if (!s) return [];
  if (/[,;\s]/.test(s)) return s.split(/[,;\s]+/).filter(Boolean);
  return [...s];
}
function choose(vm, options, state) {
  if (!options.length) return '';
  const mem = aiMemory(vm), ag = brain();
  const eps = ag ? (ag.settings.eps != null ? ag.settings.eps : 0.2) : 1;
  state = Cast.str(state);
  let pickOpt;
  if (!mem || Math.random() < eps) pickOpt = options[Math.floor(Math.random() * options.length)];
  else {
    const q = mem[state] || {}; let best = -Infinity, list = [];
    for (const o of options) { const v = q[o] || 0; if (v > best + 1e-9) { best = v; list = [o]; } else if (Math.abs(v - best) <= 1e-9) list.push(o); }
    pickOpt = list[Math.floor(Math.random() * list.length)];
  }
  vm.aiTrail = vm.aiTrail || []; vm.aiTrail.push([state, String(pickOpt)]);
  if (vm.aiTrail.length > 500) vm.aiTrail.shift();
  return pickOpt;
}
R.ai_choose = function (t, n, th) { return choose(this, splitOptions(this.arg(th, n, 'OPTIONS')), this.arg(th, n, 'STATE')); };
R.ai_choose_list = function (t, n, th) { const l = this.varOf(t, n, 'LIST', 'list'); return choose(this, l.value.map(String), this.arg(th, n, 'STATE')); };
C.ai_reward = function (t, n, th) {
  const r = num(this, th, n, 'REWARD'), mem = aiMemory(this), ag = brain(); if (!mem || !ag) return;
  const alpha = ag.settings.alpha || 0.5, gamma = ag.settings.gamma || 0.9;
  const trail = this.aiTrail || []; let g = r;
  for (let i = trail.length - 1; i >= 0; i--) {
    const [s, o] = trail[i]; const q = mem[s] = mem[s] || {};
    q[o] = Math.round(((q[o] || 0) + alpha * (g - (q[o] || 0))) * 1000) / 1000; g *= gamma;
  }
  this.aiTrail = []; ag.brain.episodes = (ag.brain.episodes || 0);
  ag.blockRewards = (ag.blockRewards || 0) + 1;
  RB.host.save();
};
C.ai_newround = function () { this.aiTrail = []; };
C.ai_set_curiosity = function (t, n, th) { const ag = brain(); if (ag) { ag.settings.eps = clampN(num(this, th, n, 'VALUE'), 0, 100) / 100; RB.host.save(); } };
R.ai_curiosity = () => { const ag = brain(); return ag ? Math.round(ag.settings.eps * 100) : 0; };
R.ai_ask = function (t, n, th) { return RB.host ? RB.host.reply(str(this, th, n, 'TEXT')) : ''; };
C.ai_teach = function (t, n, th) { if (RB.host) RB.host.teach(str(this, th, n, 'QUESTION'), str(this, th, n, 'ANSWER')); };
C.ai_read = function (t, n, th) { if (RB.host) RB.host.read(str(this, th, n, 'TEXT')); };
R.ai_name = () => { const ag = brain(); return ag ? ag.name : ''; };
R.ai_smart = () => (RB.host ? RB.host.smart() : 0);
R.ai_states = function () { const m = aiMemory(this); return m ? Object.keys(m).length : 0; };
C.ai_forget = function () { const ag = brain(); if (ag && ag.play && this.project) { delete ag.play[this.project.id]; RB.host.save(); } this.aiTrail = []; };

// ---- chess ----
const PIECE_NAMES = { P: 'B', N: 'S', B: 'L', R: 'T', Q: 'D', K: 'K' }; // bonde springare löpare torn dam kung
function game(vm) { return vm.chess || (vm.chess = { c: new window.RakenChess(), agentMoves: [], done: false, agentSide: null }); }
function pieceCode(p) { return p ? (p === p.toUpperCase() ? 'v' : 's') + PIECE_NAMES[p.toUpperCase()] : ''; }
function chessFinished(vm) {
  const G = game(vm), st = G.c.status();
  if (!st.over || G.done) return;
  G.done = true;
  const ag = brain(); if (!ag || !G.agentSide) return;
  const res = st.winner === G.agentSide ? 1 : st.winner ? -1 : 0;
  ag.chess = ag.chess || {};
  for (const k of G.agentMoves) ag.chess[k] = clampN((ag.chess[k] || 0) + res, -5, 5);
  const keys = Object.keys(ag.chess); if (keys.length > 20000) for (const k of keys.slice(0, keys.length - 20000)) delete ag.chess[k];
  ag.chessGames = (ag.chessGames || 0) + 1; if (res > 0) ag.chessWins = (ag.chessWins || 0) + 1;
  RB.host.save();
}
C.chess_new = function () { this.chess = null; game(this); };
C.chess_move = function (t, n, th) {
  const G = game(this); if (G.c.status().over) return;
  if (G.c.move(str(this, th, n, 'FROM'), str(this, th, n, 'TO'))) chessFinished(this);
};
R.chess_legal = function (t, n, th) { return game(this).c.isLegal(str(this, th, n, 'FROM'), str(this, th, n, 'TO')); };
C.chess_ai_move = function* (t, n, th) {
  const G = game(this); if (G.c.status().over) return;
  const depth = num(this, th, n, 'DEPTH'); yield; // let the screen show "thinking" first
  const ag = brain(); const pos = G.c.key(); const m = G.c.best(depth, ag && ag.chess);
  if (!m) return;
  G.agentSide = G.c.turn; G.agentMoves.push(pos + '|' + G.c.moveText(m));
  G.c.play(m); chessFinished(this);
};
R.chess_last = function () { return game(this).c.moveText(game(this).c.lastMove); };
R.chess_piece = function (t, n, th) { return pieceCode(game(this).c.pieceAt(str(this, th, n, 'SQUARE'))); };
R.chess_turn = function () { return game(this).c.turn === 'w' ? 'vit' : 'svart'; };
R.chess_status = function () {
  const st = game(this).c.status();
  if (st.mate) return st.winner === 'w' ? 'vit vann' : 'svart vann';
  if (st.stalemate) return 'patt';
  if (st.draw) return 'remi';
  return st.check ? 'schack' : 'pågår';
};
R.chess_over = function () { return game(this).c.status().over; };
R.chess_square_at = function (t, n, th) {
  const x = num(this, th, n, 'X'), y = num(this, th, n, 'Y');
  const f = Math.floor((x + 160) / 40), r = Math.floor((y + 160) / 40);
  return f < 0 || f > 7 || r < 0 || r > 7 ? '' : 'abcdefgh'[f] + (r + 1);
};
R.chess_square_x = function (t, n, th) { const i = window.RakenChess.sqIndex(str(this, th, n, 'SQUARE')); return i < 0 ? 0 : (i & 7) * 40 - 140; };
R.chess_square_y = function (t, n, th) { const i = window.RakenChess.sqIndex(str(this, th, n, 'SQUARE')); return i < 0 ? 0 : (i >> 3) * 40 - 140; };
R.chess_moves_from = function (t, n, th) { return game(this).c.movesFrom(str(this, th, n, 'SQUARE')).join(' '); };
C.chess_undo = function () { const G = game(this); G.c.undo(); G.done = false; };
R.chess_games = () => { const ag = brain(); return ag ? (ag.chessGames || 0) : 0; };

RB.pieceCode = pieceCode;
RB.implemented = op => !!(C[op] || R[op]);
})();
