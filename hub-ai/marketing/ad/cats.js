/* Shared drawing code for the Hub AI ads: helpers and the three
 * characters. The page using it defines TL (the timeline from the audio
 * script) and an SVG with a #chars group. */
'use strict';
var TL = null;
var NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function $(id) { return document.getElementById(id); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, k) { return a + (b - a) * k; }
function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }       // 0..1 progress of t through [a, b]
function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
function easeBack(k) { var c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
function rnd(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex2rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
function mixColor(a, b, k) { var x = hex2rgb(a), y = hex2rgb(b); return 'rgb(' + x.map(function (v, i) { return Math.round(lerp(v, y[i], k)); }).join(',') + ')'; }


// ---------------- characters ----------------
// Minnie (knows Hub AI), Max (doesn't, yet) and the teacher. Drawn in SVG at
// 1080x1920; the origin is between the feet.

var LOOK = {
  minnie: { fill: '#ffd23a', limb: '#ffd23a', foot: '#f0b400', ridge: '#d99a00', tail: '#f5c518' },
  max: { fill: '#d8e04a', limb: '#d8e04a', foot: '#b9c42a', ridge: '#9aa61c', tail: '#cbd43b' },
  teacher: { fill: '#e2b84a', limb: '#e2b84a', foot: '#a87a22', ridge: '#8a5c12', tail: '#c9992e' }
};

function makeCat(name, parent) {
  var minnie = name === 'minnie', teacher = name === 'teacher', L = LOOK[name];
  var g = el('g', {}, parent || $('chars'));
  var inner = el('g', {}, g);
  var c = { g: g, inner: inner, name: name };
  var outline = '#5a3a12';
  // tail
  c.tail = el('g', {}, inner);
  el('path', { d: 'M70,-110 C170,-120 200,-230 160,-300', fill: 'none', stroke: outline, 'stroke-width': 34, 'stroke-linecap': 'round' }, c.tail);
  el('path', { d: 'M70,-110 C170,-120 200,-230 160,-300', fill: 'none', stroke: L.tail, 'stroke-width': 20, 'stroke-linecap': 'round' }, c.tail);
  el('circle', { cx: 160, cy: -300, r: 16, fill: '#6b4512' }, c.tail);
  // feet
  el('ellipse', { cx: -48, cy: -8, rx: 46, ry: 22, fill: L.foot, stroke: outline, 'stroke-width': 7 }, inner);
  el('ellipse', { cx: 48, cy: -8, rx: 46, ry: 22, fill: L.foot, stroke: outline, 'stroke-width': 7 }, inner);
  // ears (behind the head top)
  c.earL = el('g', {}, inner);
  el('path', { d: 'M-105,-455 L-92,-610 L-20,-520 Z', fill: L.fill, stroke: outline, 'stroke-width': 8, 'stroke-linejoin': 'round' }, c.earL);
  el('path', { d: 'M-88,-480 L-82,-570 L-42,-520 Z', fill: '#ff8fb1' }, c.earL);
  c.earR = el('g', {}, inner);
  el('path', { d: 'M105,-455 L92,-610 L20,-520 Z', fill: L.fill, stroke: outline, 'stroke-width': 8, 'stroke-linejoin': 'round' }, c.earR);
  el('path', { d: 'M88,-480 L82,-570 L42,-520 Z', fill: '#ff8fb1' }, c.earR);
  // banana body: slightly curved, rounded, with brown tips
  el('path', {
    d: 'M34,-6 C-200,-40 -222,-350 -112,-505 C-82,-560 42,-578 84,-528 C128,-420 128,-140 34,-6 Z',
    fill: 'url(#' + name + 'Fill)', stroke: outline, 'stroke-width': 9, 'stroke-linejoin': 'round'
  }, inner);
  el('path', { d: 'M-120,-200 C-125,-300 -110,-400 -80,-470', fill: 'none', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 14, 'stroke-linecap': 'round' }, inner);
  el('path', { d: 'M-20,-545 C-12,-590 8,-600 22,-596', fill: 'none', stroke: '#6b4512', 'stroke-width': 18, 'stroke-linecap': 'round' }, inner);
  el('path', { d: 'M74,-470 C108,-370 104,-170 40,-40', fill: 'none', stroke: L.ridge, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.55 }, inner);
  el('path', { d: 'M-150,-260 C-150,-180 -120,-90 -60,-40', fill: 'none', stroke: L.ridge, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.4 }, inner);
  el('path', { d: 'M14,-14 Q34,-2 52,-14 L40,4 Z', fill: '#6b4512', stroke: '#6b4512', 'stroke-width': 8, 'stroke-linejoin': 'round' }, inner);
  if (!minnie) {
    var spots = teacher
      ? [[60, -170, 14], [80, -260, 10], [-100, -150, 12], [40, -100, 9], [-60, -260, 8], [-120, -330, 11], [90, -350, 9], [-20, -200, 7], [10, -480, 8], [-80, -440, 6]]
      : [[60, -170, 9], [80, -230, 6], [-90, -150, 7], [40, -110, 5]];
    spots.forEach(function (s) { el('circle', { cx: s[0], cy: s[1], r: s[2], fill: teacher ? '#5e3a0c' : '#8a6a1a', opacity: teacher ? 0.7 : 0.55 }, inner); });
  }
  if (teacher) {
    var tie = el('g', { transform: 'translate(-20,-235)' }, inner);
    el('path', { d: 'M0,0 L-40,-24 L-40,24 Z M0,0 L40,-24 L40,24 Z', fill: '#b3122e', stroke: outline, 'stroke-width': 6, 'stroke-linejoin': 'round' }, tie);
    el('circle', { r: 11, fill: '#d61f3c', stroke: outline, 'stroke-width': 5 }, tie);
  }
  // arms
  c.armL = el('g', { transform: 'translate(-110,-250)' }, inner);
  el('path', { d: 'M0,0 L-70,60', stroke: outline, 'stroke-width': 26, 'stroke-linecap': 'round' }, c.armL);
  el('path', { d: 'M0,0 L-70,60', stroke: L.limb, 'stroke-width': 13, 'stroke-linecap': 'round' }, c.armL);
  el('circle', { cx: -74, cy: 64, r: 21, fill: L.fill, stroke: outline, 'stroke-width': 7 }, c.armL);
  c.armR = el('g', { transform: 'translate(110,-250)' }, inner);
  el('path', { d: 'M0,0 L70,60', stroke: outline, 'stroke-width': 26, 'stroke-linecap': 'round' }, c.armR);
  el('path', { d: 'M0,0 L70,60', stroke: L.limb, 'stroke-width': 13, 'stroke-linecap': 'round' }, c.armR);
  el('circle', { cx: 74, cy: 64, r: 21, fill: L.fill, stroke: outline, 'stroke-width': 7 }, c.armR);
  // face
  var face = el('g', { transform: 'translate(0,-370)' }, inner);
  c.face = face;
  if (!document.getElementById('rageGrad')) {
    var defs = document.querySelector('svg defs');
    var rg = el('radialGradient', { id: 'rageGrad' }, defs);
    el('stop', { offset: '0', 'stop-color': '#ff2d2d', 'stop-opacity': 1 }, rg);
    el('stop', { offset: '1', 'stop-color': '#ff2d2d', 'stop-opacity': 0 }, rg);
  }
  c.rage = el('ellipse', { cx: 0, cy: 18, rx: 130, ry: 95, fill: 'url(#rageGrad)', opacity: 0 }, face);
  el('ellipse', { cx: -70, cy: 30, rx: 24, ry: 14, fill: '#ff7aa2', opacity: minnie ? 0.6 : 0.35 }, face);
  el('ellipse', { cx: 70, cy: 30, rx: 24, ry: 14, fill: '#ff7aa2', opacity: minnie ? 0.6 : 0.35 }, face);
  c.eyes = [];
  [-46, 46].forEach(function (x) {
    var eg = el('g', { transform: 'translate(' + x + ',-20)' }, face);
    var open = el('g', {}, eg);
    el('ellipse', { cx: 0, cy: 0, rx: 34, ry: 40, fill: '#fff', stroke: outline, 'stroke-width': 6 }, open);
    var pupil = el('g', {}, open);
    el('circle', { cx: 0, cy: 4, r: 19, fill: '#1b1b1b' }, pupil);
    el('circle', { cx: -7, cy: -5, r: 7, fill: '#fff' }, pupil);
    var happy = el('path', { d: 'M-26,6 Q0,-26 26,6', fill: 'none', stroke: outline, 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0 }, eg);
    if (minnie) el('path', { d: x < 0 ? 'M-30,-30 L-44,-46 M-16,-38 L-24,-56' : 'M30,-30 L44,-46 M16,-38 L24,-56', stroke: outline, 'stroke-width': 6, 'stroke-linecap': 'round' }, open);
    c.eyes.push({ g: eg, open: open, pupil: pupil, happy: happy });
  });
  if (teacher) {
    c.brows = [el('path', { d: 'M-95,-62 Q-50,-92 -8,-50', fill: 'none', stroke: '#3b2408', 'stroke-width': 18, 'stroke-linecap': 'round' }, face),
               el('path', { d: 'M95,-62 Q50,-92 8,-50', fill: 'none', stroke: '#3b2408', 'stroke-width': 18, 'stroke-linecap': 'round' }, face)];
  } else if (!minnie) {
    c.brows = [el('path', { d: 'M-80,-78 L-18,-70', stroke: outline, 'stroke-width': 10, 'stroke-linecap': 'round' }, face),
               el('path', { d: 'M80,-78 L18,-70', stroke: outline, 'stroke-width': 10, 'stroke-linecap': 'round' }, face)];
  }
  el('path', { d: 'M-12,26 L12,26 L0,40 Z', fill: '#ff6f91', stroke: outline, 'stroke-width': 4, 'stroke-linejoin': 'round' }, face);
  c.mouthClosed = el('path', { d: 'M-26,48 Q-13,62 0,46 Q13,62 26,48', fill: 'none', stroke: outline, 'stroke-width': 6, 'stroke-linecap': 'round' }, face);
  c.mouthOpen = el('g', {}, face);
  c.mouthShape = el('ellipse', { cx: 0, cy: 58, rx: 22, ry: 16, fill: '#7a1f2b', stroke: outline, 'stroke-width': 5 }, c.mouthOpen);
  c.tongue = el('ellipse', { cx: 0, cy: 66, rx: 12, ry: 7, fill: '#ff8fa3' }, c.mouthOpen);
  [[-40, 36, -120, 22], [-40, 46, -118, 52], [40, 36, 120, 22], [40, 46, 118, 52]].forEach(function (w) {
    el('path', { d: 'M' + w[0] + ',' + w[1] + ' L' + w[2] + ',' + w[3], stroke: outline, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.8 }, face);
  });
  if (teacher) {
    [-46, 46].forEach(function (x) { el('circle', { cx: x, cy: -20, r: 46, fill: '#bfe3ff', 'fill-opacity': 0.18, stroke: '#1b1b1b', 'stroke-width': 8 }, face); });
    el('path', { d: 'M-2,-24 Q0,-34 2,-24', stroke: '#1b1b1b', 'stroke-width': 8, fill: 'none' }, face);
    el('path', { d: 'M-90,-26 L-120,-34 M90,-26 L120,-34', stroke: '#1b1b1b', 'stroke-width': 7 }, face);
    c.stache = el('path', { d: 'M0,40 C-20,30 -60,30 -80,52 C-60,48 -40,58 -20,52 C-10,50 -4,46 0,44 C4,46 10,50 20,52 C40,58 60,48 80,52 C60,30 20,30 0,40 Z',
      fill: '#4a2c0a', stroke: outline, 'stroke-width': 4 }, face);
  }
  if (minnie) {
    var bow = el('g', { transform: 'translate(-70,-520) rotate(-18)' }, inner);
    el('path', { d: 'M0,0 L-46,-26 L-46,26 Z', fill: '#ff4f8b', stroke: outline, 'stroke-width': 5, 'stroke-linejoin': 'round' }, bow);
    el('path', { d: 'M0,0 L46,-26 L46,26 Z', fill: '#ff4f8b', stroke: outline, 'stroke-width': 5, 'stroke-linejoin': 'round' }, bow);
    el('circle', { cx: 0, cy: 0, r: 12, fill: '#ff79a8', stroke: outline, 'stroke-width': 5 }, bow);
  }
  return c;
}

// How open a character's mouth is at time t, from the loudness of their
// voice (timeline.mouth, one value per frame at 30 fps).
function talkAmount(who, t) {
  var m = TL.mouth && TL.mouth[who];
  if (!m) return 0;
  var f = t * 30, i = Math.floor(f), k = f - i;
  return lerp(m[i] || 0, m[i + 1] || 0, k);
}
function speaking(who, t) {
  return TL.lines.some(function (l) { return l.who === who && t >= l.start && t <= l.end; });
}

// p: {x, y, s, rot, squash, look, eyes: 'open'|'happy'|'wide'|'bored', brow, armL, armR, tail, rage}
function poseCat(c, t, p) {
  var mouth = talkAmount(c.name, t);
  var talking = speaking(c.name, t);
  var bob = Math.sin(t * Math.PI * 2 * (talking ? 2.2 : 1.1) + (c.name === 'max' ? 1.3 : 0)) * (talking ? 9 : 5);
  var sq = (p.squash || 1) * (1 + mouth * 0.025);
  c.g.setAttribute('transform', 'translate(' + p.x + ',' + (p.y + bob) + ') rotate(' + (p.rot || 0) + ') scale(' + p.s + ')');
  c.inner.setAttribute('transform', 'scale(' + (1 / Math.sqrt(sq)) + ',' + sq + ')');
  c.mouthClosed.setAttribute('opacity', mouth > 0.08 ? 0 : 1);
  c.mouthOpen.setAttribute('opacity', mouth > 0.08 ? 1 : 0);
  c.mouthShape.setAttribute('ry', 8 + mouth * 26);
  c.mouthShape.setAttribute('cy', 52 + mouth * 12);
  c.tongue.setAttribute('cy', 62 + mouth * 22);
  // blink every few seconds (not while eyes are 'happy')
  var period = c.name === 'max' ? 3.3 : 2.7, ph = (t + (c.name === 'max' ? 0.9 : 0)) % period;
  var blink = ph < 0.12 ? 0.1 : 1;
  var mode = p.eyes || 'open';
  var wide = mode === 'wide' ? 1.28 : 1;
  if (mode === 'bored') blink = Math.min(blink, 0.5);
  c.eyes.forEach(function (e) {
    e.open.setAttribute('opacity', mode === 'happy' ? 0 : 1);
    e.happy.setAttribute('opacity', mode === 'happy' ? 1 : 0);
    e.open.setAttribute('transform', 'scale(' + wide + ',' + (wide * blink) + ')');
    var lx = (p.look || 0) * 10;
    e.pupil.setAttribute('transform', 'translate(' + lx + ',' + (mode === 'bored' ? 10 : 0) + ') scale(' + (mode === 'wide' ? 0.7 : 1) + ')');
  });
  c.rage.setAttribute('opacity', (p.rage || 0) * 0.7);
  if (c.brows && c.name === 'teacher') {
    var tb = p.brow || 0;
    c.brows[0].setAttribute('transform', 'translate(0,' + (-tb * 14) + ') rotate(' + (tb > 0 ? -10 * tb : 0) + ',-50,-70)');
    c.brows[1].setAttribute('transform', 'translate(0,' + (-tb * 14) + ') rotate(' + (tb > 0 ? 10 * tb : 0) + ',50,-70)');
  } else if (c.brows) {
    var b = p.brow || 0;
    c.brows[0].setAttribute('transform', 'translate(0,' + (-Math.max(b, 0) * 16) + ') rotate(' + (b > 0 ? -8 * b : 22 * b) + ',-50,-74)');
    c.brows[1].setAttribute('transform', 'translate(0,' + (-Math.max(b, 0) * 16) + ') rotate(' + (b > 0 ? 8 * b : -22 * b) + ',50,-74)');
  }
  c.armL.setAttribute('transform', 'translate(-110,-250) rotate(' + (p.armL || 0) + ')');
  c.armR.setAttribute('transform', 'translate(110,-250) rotate(' + (p.armR || 0) + ')');
  c.tail.setAttribute('transform', 'rotate(' + (Math.sin(t * 5 + (c.name === 'max' ? 2 : 0)) * 8 + (p.tail || 0)) + ',70,-110)');
  var ear = Math.sin(t * 7) > 0.96 ? -8 : 0;
  c.earL.setAttribute('transform', 'rotate(' + ear + ',-60,-500)');
  c.earR.setAttribute('transform', 'rotate(' + (-ear) + ',60,-500)');
}

