/* Shared stage for the Max & Minnie episodes (ep-*.html), on top of
 * cats.js: the SVG skeleton, phone, captions, confetti, emoji rain, comic
 * stamps, flashes, costumes and the end card. A page calls stage(opts) in
 * its setup and the helpers from its render(t). */
'use strict';
var M = {}, S = {};

function stage(opts) {
  var svg = document.createElementNS(NS, 'svg');
  svg.id = 's';
  svg.setAttribute('viewBox', '0 0 1080 1920');
  document.body.appendChild(svg);
  svg.innerHTML = '<defs>' +
    '<linearGradient id="minnieFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe680"/><stop offset="0.55" stop-color="#ffd23a"/><stop offset="1" stop-color="#f0b400"/></linearGradient>' +
    '<linearGradient id="maxFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef38a"/><stop offset="0.55" stop-color="#d8e04a"/><stop offset="1" stop-color="#b9c42a"/></linearGradient>' +
    '<clipPath id="screenClip"><rect x="-231" y="-450" width="462" height="900" rx="46"/></clipPath></defs>' +
    ['bg', 'props', 'charsBack', 'mid', 'chars', 'front', 'phone', 'fx', 'cards', 'caption', 'endcard', 'flash'].map(function (id) {
      return '<g id="' + id + '"></g>';
    }).join('');
  M = TL.marks;
  // phone
  var ph = $('phone');
  el('rect', { x: -251, y: -470, width: 502, height: 940, rx: 64, fill: '#0a0a0a', stroke: '#2c2c2c', 'stroke-width': 6 }, ph);
  var scr = el('g', { 'clip-path': 'url(#screenClip)' }, ph);
  el('rect', { x: -231, y: -450, width: 462, height: 900, fill: '#0d0d0d' }, scr);
  S.screens = {};
  (opts.screens || []).forEach(function (n) {
    S.screens[n] = el('image', { href: 'build/screens/' + n + '.png', x: -231, y: -450, width: 462, height: 1000, preserveAspectRatio: 'xMidYMin slice', opacity: 0 }, scr);
  });
  el('rect', { x: -60, y: -446, width: 120, height: 26, rx: 13, fill: '#0a0a0a' }, ph);
  // confetti and emoji pools
  var colors = ['#ff5c5c', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff8fab', '#ffffff'];
  S.confetti = [];
  for (var q = 0; q < 130; q++) S.confetti.push(el('rect', { width: 18, height: 28, rx: 4, fill: colors[q % colors.length], opacity: 0 }, $('fx')));
  S.emoji = [];
  for (var e = 0; e < 40; e++) S.emoji.push(el('text', { 'font-size': 90, 'text-anchor': 'middle', opacity: 0 }, $('fx')));
  S.stamps = {};
  // caption
  S.capBg = el('rect', { rx: 34, fill: '#fff', stroke: '#1b1b1b', 'stroke-width': 8 }, $('caption'));
  S.capTag = el('g', {}, $('caption'));
  S.capTagBg = el('rect', { rx: 26, height: 52, stroke: '#1b1b1b', 'stroke-width': 6 }, S.capTag);
  S.capTagTx = el('text', { 'font-size': 34, 'font-weight': 800, fill: '#fff', 'text-anchor': 'middle' }, S.capTag);
  S.capLines = [0, 1, 2, 3].map(function () { return el('text', { 'font-size': 58, 'font-weight': 800, fill: '#1b1b1b', 'text-anchor': 'middle' }, $('caption')); });
  // end card
  var ec = $('endcard');
  el('rect', { width: 1080, height: 1920, fill: '#0d0d0d' }, ec);
  S.logo = el('g', {}, ec);
  el('rect', { x: -130, y: -130, width: 260, height: 260, rx: 58, fill: '#161616', stroke: '#3a3a3a', 'stroke-width': 4 }, S.logo);
  el('path', { d: 'M-62,-82 h36 v62 h52 v-62 h36 v164 h-36 v-66 h-52 v66 h-36 z', fill: '#ececec' }, S.logo);
  var t1 = el('text', { x: 540, y: 880, 'font-size': 118, 'font-weight': 800, fill: '#ececec', 'text-anchor': 'middle' }, ec); t1.textContent = 'Hub AI';
  var t2 = el('text', { x: 540, y: 970, 'font-size': 52, fill: '#cfcfcf', 'text-anchor': 'middle' }, ec); t2.textContent = 'Make apps by just asking.';
  var t3 = el('text', { x: 540, y: 1045, 'font-size': 46, fill: '#ffd23a', 'text-anchor': 'middle', 'font-weight': 700 }, ec); t3.textContent = opts.tagline || '';
  S.pill = el('g', {}, ec);
  el('rect', { x: -330, y: -52, width: 660, height: 104, rx: 52, fill: '#ececec' }, S.pill);
  var t4 = el('text', { x: 0, y: 17, 'font-size': 46, 'font-weight': 800, fill: '#0d0d0d', 'text-anchor': 'middle' }, S.pill); t4.textContent = 'Free to start ✨';
  var t5 = el('text', { x: 540, y: 1290, 'font-size': 38, fill: '#8d8d8d', 'text-anchor': 'middle' }, ec); t5.textContent = 'Android · Mac · Windows · Linux';
  // the end card's own Minnie and Max, wearing the episode's costumes
  S.endCats = [['max', 190], ['minnie', 890]].map(function (m) {
    var c = makeCat(m[0], ec);
    if (opts.costumes && opts.costumes[m[0]]) costume(c, opts.costumes[m[0]]);
    return [c, m[1]];
  });
  el('rect', { id: 'flashRect', width: 1080, height: 1920, fill: '#fff', opacity: 0 }, $('flash'));
}

function at(t, a, b) { return t >= M[a] && (b === undefined || t < M[b]); }

var WHO = {
  minnie: ['MINNIE', '#ff4f8b', 860], max: ['MAX', '#7cb518', 220], announcer: ['ANNOUNCER', '#3b74d9', 540]
};

function caption(t) {
  var line = null;
  TL.lines.forEach(function (l) { if (t >= l.start - 0.08 && t <= l.end + 0.28) line = l; });
  var g = $('caption');
  if (!line || t >= M.end) { g.setAttribute('opacity', 0); return; }
  var words = line.text.split(' '), rows = [], row = '';
  words.forEach(function (w) { if ((row + ' ' + w).trim().length > 24) { rows.push(row.trim()); row = w; } else row += ' ' + w; });
  rows.push(row.trim());
  var top = 300, lh = 70, h = rows.length * lh + 70;
  S.capBg.setAttribute('x', 60); S.capBg.setAttribute('y', top); S.capBg.setAttribute('width', 960); S.capBg.setAttribute('height', h);
  S.capLines.forEach(function (tx, i) { tx.textContent = rows[i] || ''; tx.setAttribute('x', 540); tx.setAttribute('y', top + 72 + i * lh); });
  var who = WHO[line.who], tw = who[0].length * 24 + 50;
  S.capTagBg.setAttribute('fill', who[1]); S.capTagBg.setAttribute('width', tw); S.capTagBg.setAttribute('x', -tw / 2); S.capTagBg.setAttribute('y', -26);
  S.capTagTx.textContent = who[0]; S.capTagTx.setAttribute('y', 12);
  S.capTag.setAttribute('transform', 'translate(' + who[2] + ',' + top + ')');
  var k = easeBack(seg(t, line.start - 0.08, line.start + 0.14)), out = seg(t, line.end + 0.12, line.end + 0.28);
  g.setAttribute('opacity', 1 - out);
  g.setAttribute('transform', 'translate(540,' + (top + h / 2) + ') scale(' + (0.6 + 0.4 * k) + ') translate(-540,' + (-(top + h / 2)) + ')');
}

// Phone: p = {show: bool, k: 0..1 pop-in, x, y, s, rot, screen: name, scroll}
function phone(p) {
  var g = $('phone');
  g.setAttribute('opacity', p.show && p.k > 0.01 ? 1 : 0);
  g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ') rotate(' + (p.rot || 0) + ') scale(' + Math.max(0.001, p.s * p.k) + ')');
  for (var n in S.screens) {
    S.screens[n].setAttribute('opacity', n === p.screen ? 1 : 0);
    S.screens[n].setAttribute('y', -450 - (n === p.screen ? (p.scroll || 0) : 0));
  }
}

// bursts: [[t0, x, y, seed, n, spread]]
function confetti(t, bursts) {
  var parts = [];
  bursts.forEach(function (b) {
    var r = rnd(b[3]);
    for (var i = 0; i < b[4]; i++) {
      var a = -Math.PI / 2 + (r() - 0.5) * (b[5] || 2.2), v = 900 + r() * 1100, life = 1.6 + r() * 0.8, spin = (r() - 0.5) * 1400;
      var d = t - b[0];
      if (d >= 0 && d < life) parts.push([b[1], b[2], a, v, life, spin, d]);
    }
  });
  S.confetti.forEach(function (c, i) {
    var p = parts[i];
    if (!p) { c.setAttribute('opacity', 0); return; }
    var drag = Math.exp(-p[6] * 1.6);
    c.setAttribute('opacity', 1 - seg(p[6], p[4] * 0.7, p[4]));
    c.setAttribute('transform', 'translate(' + (p[0] + Math.cos(p[2]) * p[3] * (1 - drag) / 1.6) + ',' + (p[1] + Math.sin(p[2]) * p[3] * (1 - drag) / 1.6 + 900 * p[6] * p[6]) + ') rotate(' + p[5] * p[6] + ')');
  });
}

// rains: [[t0, dur, emoji, count, seed, fromBottom?]]
function emojiRain(t, rains) {
  var items = [];
  rains.forEach(function (rn) {
    var r = rnd(rn[4]);
    for (var i = 0; i < rn[3]; i++) {
      var t0 = rn[0] + r() * rn[1], x = 70 + r() * 940, sp = 800 + r() * 600, rot = (r() - 0.5) * 500, d = t - t0;
      if (d >= 0 && d < 2.6) items.push([rn[2], x, rn[5] ? 2050 - d * sp : -120 + d * sp, rot * d]);
    }
  });
  S.emoji.forEach(function (e, i) {
    var it = items[i];
    if (!it) { e.setAttribute('opacity', 0); return; }
    e.textContent = it[0];
    e.setAttribute('opacity', 1);
    e.setAttribute('transform', 'translate(' + it[1] + ',' + it[2] + ') rotate(' + it[3] + ')');
  });
}

// A comic stamp: big text on a burst or a pill, popping in at t0 and out at t1.
function stamp(key, t, t0, t1, text, o) {
  o = o || {};
  var s = S.stamps[key];
  if (!s) {
    s = el('g', {}, $('fx'));
    if (o.burst) {
      var pts = [];
      for (var k = 0; k < 22; k++) { var a = k / 22 * Math.PI * 2, rr = k % 2 ? 0.62 : 1; pts.push(Math.cos(a) * rr * (o.w || 300) + ',' + Math.sin(a) * rr * (o.h || 180)); }
      el('polygon', { points: pts.join(' '), fill: o.fill || '#ff3d3d', stroke: '#1b1b1b', 'stroke-width': 10, 'stroke-linejoin': 'round' }, s);
    } else {
      var w = text.length * (o.size || 80) * 0.62 + 80;
      el('rect', { x: -w / 2, y: -(o.size || 80) * 0.9, width: w, height: (o.size || 80) * 1.6, rx: 30, fill: o.fill || '#ffd23a', stroke: '#1b1b1b', 'stroke-width': 10 }, s);
    }
    var tx = el('text', { y: (o.size || 80) * 0.35, 'font-size': o.size || 80, 'font-weight': 900, 'text-anchor': 'middle', fill: o.color || '#fff', stroke: '#1b1b1b', 'stroke-width': 6, 'paint-order': 'stroke' }, s);
    tx.textContent = text;
    S.stamps[key] = s;
  }
  var k = easeBack(seg(t, t0, t0 + 0.3)), gone = seg(t, t1, t1 + 0.2);
  s.setAttribute('opacity', t >= t0 && t < t1 + 0.2 ? 1 - gone : 0);
  s.setAttribute('transform', 'translate(' + (o.x || 540) + ',' + (o.y || 1000) + ') rotate(' + (o.rot || -6) + ') scale(' + Math.max(0.001, k) + ')');
}

function flash(t, times) {
  var v = 0;
  times.forEach(function (x) { if (t >= x[0] && t < x[0] + (x[1] || 0.3)) v = Math.max(v, (x[2] || 1) * (1 - seg(t, x[0], x[0] + (x[1] || 0.3)))); });
  $('flashRect').setAttribute('opacity', v);
}

function shake(t, list) {
  var a = 0;
  list.forEach(function (x) { if (t >= x[0] && t < x[0] + x[1]) a = Math.max(a, x[2] * (1 - seg(t, x[0], x[0] + x[1]))); });
  $('s').setAttribute('style', a ? 'transform:translate(' + Math.sin(t * 90) * a + 'px,' + Math.cos(t * 77) * a + 'px)' : '');
}

// The end card, with Minnie and Max peeking in from the bottom and waving.
function endCard(t) {
  var ek = seg(t, M.end, M.end + 0.1);
  $('endcard').setAttribute('opacity', ek);
  var lk = easeBack(seg(t, M.end + 0.1, M.end + 0.55));
  S.logo.setAttribute('transform', 'translate(540,600) scale(' + Math.max(0.001, lk) + ') rotate(' + (1 - lk) * -20 + ')');
  S.pill.setAttribute('transform', 'translate(540,1170) scale(' + (1 + Math.sin(t * 6) * 0.03) + ')');
  var pk = easeBack(seg(t, M.end + 0.3, M.end + 0.8));
  S.endCats.forEach(function (c, i) {
    var left = c[1] < 540;
    poseCat(c[0], t, { x: c[1], y: lerp(2500, 1960, pk), s: 0.58, look: left ? 0.6 : -0.6, eyes: 'happy',
      armL: left ? 20 : 115 + Math.sin(t * 10 + i) * 25, armR: left ? -115 + Math.sin(t * 10 + i) * 25 : -20 });
  });
  return t >= M.end;
}

// ---------------- costumes ----------------
function costume(c, type) {
  var g = el('g', {}, c.inner), o = '#1b1b1b';
  if (type === 'chef') {
    el('rect', { x: -95, y: -650, width: 190, height: 110, rx: 12, fill: '#fff', stroke: o, 'stroke-width': 7 }, g);
    [-70, 0, 70].forEach(function (x) { el('circle', { cx: x, cy: -660, r: 62, fill: '#fff', stroke: o, 'stroke-width': 7 }, g); });
    el('rect', { x: -95, y: -590, width: 190, height: 50, fill: '#fff' }, g);
    el('path', { d: 'M-95,-560 L95,-560', stroke: '#ddd', 'stroke-width': 6 }, g);
  } else if (type === 'helmet') {
    el('circle', { cx: 0, cy: -390, r: 265, fill: '#bfe3ff', 'fill-opacity': 0.18, stroke: '#e8f4ff', 'stroke-width': 14 }, g);
    el('path', { d: 'M-170,-560 A230,230 0 0 1 -40,-630', fill: 'none', stroke: '#fff', 'stroke-width': 16, 'stroke-linecap': 'round', opacity: 0.8 }, g);
  } else if (type === 'tophat') {
    var h = el('g', { transform: 'translate(10,-560) rotate(8)' }, g);
    el('rect', { x: -110, y: -12, width: 220, height: 26, rx: 12, fill: '#1b1b1b' }, h);
    el('rect', { x: -70, y: -170, width: 140, height: 165, rx: 10, fill: '#222', stroke: o, 'stroke-width': 6 }, h);
    el('rect', { x: -70, y: -50, width: 140, height: 30, fill: '#d61f3c' }, h);
  } else if (type === 'party') {
    var p = el('g', { transform: 'translate(-20,-570) rotate(-12)' }, g);
    el('path', { d: 'M-70,0 L0,-190 L70,0 Z', fill: '#4cc9f0', stroke: o, 'stroke-width': 7, 'stroke-linejoin': 'round' }, p);
    el('path', { d: 'M-48,-60 L48,-60 M-24,-125 L24,-125', stroke: '#ff4f8b', 'stroke-width': 16 }, p);
    el('circle', { cx: 0, cy: -195, r: 20, fill: '#ffd23a', stroke: o, 'stroke-width': 6 }, p);
  } else if (type === 'cap') {
    var cp = el('g', { transform: 'translate(0,-555) rotate(-8)' }, g);
    el('path', { d: 'M-115,10 C-110,-90 110,-90 115,10 Z', fill: '#e5484d', stroke: o, 'stroke-width': 7 }, cp);
    el('path', { d: 'M80,0 L210,10 L200,30 L70,22 Z', fill: '#c0392b', stroke: o, 'stroke-width': 7, 'stroke-linejoin': 'round' }, cp);
    var chain = el('path', { d: 'M-90,-235 Q0,-150 90,-235', fill: 'none', stroke: '#e8b400', 'stroke-width': 14, 'stroke-dasharray': '16 6' }, g);
    el('circle', { cx: 0, cy: -175, r: 26, fill: '#ffd23a', stroke: o, 'stroke-width': 6 }, g);
    void chain;
  } else if (type === 'shades') {
    var sh = el('g', { transform: 'translate(0,-390)' }, g);
    el('rect', { x: -96, y: -28, width: 84, height: 50, rx: 14, fill: '#111' }, sh);
    el('rect', { x: 12, y: -28, width: 84, height: 50, rx: 14, fill: '#111' }, sh);
    el('path', { d: 'M-12,-10 L12,-10', stroke: '#111', 'stroke-width': 8 }, sh);
    el('path', { d: 'M-80,-16 L-50,-16', stroke: '#fff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.7 }, sh);
    el('path', { d: 'M-90,-235 Q0,-150 90,-235', fill: 'none', stroke: '#e8b400', 'stroke-width': 14, 'stroke-dasharray': '16 6' }, g);
    var pend = el('text', { y: -150, 'font-size': 60, 'font-weight': 900, 'text-anchor': 'middle', fill: '#ffd23a', stroke: '#1b1b1b', 'stroke-width': 4, 'paint-order': 'stroke' }, g);
    pend.textContent = 'H';
  } else if (type === 'bow-tie') {
    var bt = el('g', { transform: 'translate(-10,-232)' }, g);
    el('path', { d: 'M0,0 L-40,-24 L-40,24 Z M0,0 L40,-24 L40,24 Z', fill: '#1b1b1b' }, bt);
    el('circle', { r: 10, fill: '#333' }, bt);
  }
  return g;
}

// A puff of smoke (or flour) at (x, y) that bursts at t0 and clears by t0 + dur.
function puff(key, t, t0, x, y, r, dur, color) {
  var P = S.puffs || (S.puffs = {});
  if (!P[key]) {
    P[key] = el('g', {}, $('fx'));
    for (var i = 0; i < 10; i++) el('circle', { r: 1, fill: i % 3 ? (color || '#f2f2f2') : '#ffffff', stroke: '#1b1b1b', 'stroke-width': 7 }, P[key]);
  }
  var g = P[key], d = (t - t0) / dur;
  g.setAttribute('opacity', d >= 0 && d < 1 ? 1 - seg(d, 0.6, 1) : 0);
  if (d < 0 || d >= 1) return;
  var r0 = rnd(key.length * 31 + 7);
  Array.prototype.forEach.call(g.childNodes, function (c, i) {
    var a = i / 10 * Math.PI * 2 + r0(), dist = r * (0.25 + 0.55 * easeOut(Math.min(1, d * 2.5))) * (0.7 + r0() * 0.5);
    c.setAttribute('cx', x + Math.cos(a) * dist);
    c.setAttribute('cy', y + Math.sin(a) * dist * 0.75);
    c.setAttribute('r', r * (0.35 + 0.2 * r0()) * easeBack(Math.min(1, d * 4)) * (1 - 0.3 * d));
  });
}

// A microphone, held in a paw: put it in the arm group (left: armL, right: armR).
function mic(arm, left) {
  var g = el('g', { transform: 'translate(' + (left ? -74 : 74) + ',64) rotate(' + (left ? 25 : -25) + ')' }, arm);
  el('rect', { x: -13, y: -10, width: 26, height: 90, rx: 10, fill: '#2a2a2a', stroke: '#1b1b1b', 'stroke-width': 5 }, g);
  el('circle', { cx: 0, cy: -28, r: 30, fill: '#9aa3ad', stroke: '#1b1b1b', 'stroke-width': 6 }, g);
  el('path', { d: 'M-22,-36 L22,-36 M-26,-24 L26,-24 M-20,-12 L20,-12', stroke: '#5d636d', 'stroke-width': 4 }, g);
  return g;
}

function play(path) {
  if (location.search.indexOf('play') < 0) return;
  fetch(path + '/timeline.json').then(function (r) { return r.json(); }).then(function (tl) {
    init(tl);
    var a = new Audio(path + '/audio.wav'), t0 = null;
    document.body.onclick = function () { a.play(); t0 = performance.now(); (function f() { render((performance.now() - t0) / 1000 % TL.length); requestAnimationFrame(f); })(); };
  });
}
