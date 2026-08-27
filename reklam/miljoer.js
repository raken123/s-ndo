/* ===================================================================
   Miljöer — rummen som de tio senare filmerna spelar i.
   Varje funktion ritar upp ett rum och lämnar tillbaka de delar som
   filmen behöver kunna animera.
   =================================================================== */
(function (global, K) {
  'use strict';
  var el = K.el, txt = K.txt, C = K.C, scene = K.scene, move = K.move;

  function golv(y, farg, kant) {
    el('rect', { x: 0, y: y, width: 1920, height: 1080 - y, fill: farg }, scene);
    el('rect', { x: 0, y: y, width: 1920, height: 12, fill: kant }, scene);
  }
  function vagg(farg1, farg2, h) {
    var defs = scene.querySelector('defs') || el('defs', {}, scene);
    var id = 'v' + Math.random().toString(36).slice(2, 7);
    var lg = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': farg1 }, lg);
    el('stop', { offset: 1, 'stop-color': farg2 }, lg);
    el('rect', { x: 0, y: 0, width: 1920, height: h, fill: 'url(#' + id + ')' }, scene);
  }
  function fonsterrad(x0, y, n, w, h, steg) {
    for (var i = 0; i < n; i++) {
      var g = el('g', {}, scene);
      el('rect', { x: x0 + i * steg, y: y, width: w, height: h, rx: 8, fill: '#bfe3ff', stroke: '#fff', 'stroke-width': 8 }, g);
      el('path', { d: 'M' + (x0 + i * steg + w / 2) + ',' + y + ' v' + h, stroke: '#fff', 'stroke-width': 6 }, g);
    }
  }

  /* ---------- Gympasalen ---------- */
  function gym() {
    vagg('#f7e9c9', '#e8d5a8', 660);
    golv(660, '#d9a86a', '#c1904f');
    /* golvlinjer */
    el('path', { d: 'M180,1060 L640,700 M1740,1060 L1290,700 M640,700 h650', stroke: '#e8f0f7', 'stroke-width': 9, opacity: 0.7, fill: 'none' }, scene);
    el('ellipse', { cx: 960, cy: 880, rx: 300, ry: 92, stroke: '#e8f0f7', 'stroke-width': 9, fill: 'none', opacity: 0.7 }, scene);
    /* ribbstolar */
    for (var r = 0; r < 2; r++) {
      var g = el('g', {}, scene);
      el('rect', { x: 60 + r * 250, y: 190, width: 190, height: 470, fill: '#e7c58e' }, g);
      for (var b = 0; b < 12; b++) {
        el('rect', { x: 60 + r * 250, y: 200 + b * 38, width: 190, height: 12, rx: 6, fill: '#c69a5c' }, g);
      }
    }
    /* basketkorg */
    var korg = el('g', {}, scene);
    el('rect', { x: 1560, y: 150, width: 210, height: 140, rx: 8, fill: '#fff', stroke: '#c94f4f', 'stroke-width': 8 }, korg);
    el('rect', { x: 1620, y: 230, width: 90, height: 60, fill: 'none', stroke: '#c94f4f', 'stroke-width': 6 }, korg);
    el('circle', { cx: 1665, cy: 310, r: 42, fill: 'none', stroke: '#e2733c', 'stroke-width': 8 }, korg);
    el('path', { d: 'M1628,318 l14,54 M1665,320 l0,58 M1702,318 l-14,54', stroke: '#fff', 'stroke-width': 4 }, korg);
    /* bänk */
    el('rect', { x: 120, y: 760, width: 360, height: 20, rx: 8, fill: '#c69a5c' }, scene);
    el('rect', { x: 150, y: 780, width: 18, height: 70, fill: '#a87f45' }, scene);
    el('rect', { x: 432, y: 780, width: 18, height: 70, fill: '#a87f45' }, scene);
    return {};
  }

  /* ---------- Biblioteket ---------- */
  function bibliotek() {
    vagg('#f3efe6', '#e2dccd', 700);
    golv(700, '#b98f63', '#a37b53');
    var hyllfarg = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
    for (var h = 0; h < 3; h++) {
      var g = el('g', {}, scene);
      var x = 60 + h * 380;
      el('rect', { x: x, y: 180, width: 300, height: 500, rx: 8, fill: '#8b5e3c' }, g);
      for (var s = 0; s < 4; s++) {
        el('rect', { x: x + 10, y: 200 + s * 120, width: 280, height: 96, fill: '#f6efe3' }, g);
        for (var bk = 0; bk < 12; bk++) {
          el('rect', { x: x + 16 + bk * 23, y: 206 + s * 120 + (bk % 3) * 4, width: 18, height: 84 - (bk % 3) * 6, rx: 3,
            fill: hyllfarg[(bk + s + h) % hyllfarg.length] }, g);
        }
        el('rect', { x: x + 10, y: 296 + s * 120, width: 280, height: 12, fill: '#7a5133' }, g);
      }
    }
    /* läsmatta och kudde */
    el('ellipse', { cx: 500, cy: 900, rx: 340, ry: 96, fill: '#d8687a', opacity: 0.85 }, scene);
    el('ellipse', { cx: 500, cy: 900, rx: 240, ry: 64, fill: '#e6899a', opacity: 0.9 }, scene);
    return {};
  }

  /* ---------- Musiksalen ---------- */
  function musiksal() {
    vagg('#e8e2f5', '#d3c9ec', 660);
    golv(660, '#c9955e', '#ad7c48');
    /* instrument på väggen */
    ['🎸', '🥁', '🎻', '🎺'].forEach(function (ic, i) {
      el('rect', { x: 120 + i * 150, y: 150, width: 120, height: 120, rx: 14, fill: '#fff', stroke: '#c9bfe4', 'stroke-width': 6 }, scene);
      txt(ic, { x: 180 + i * 150, y: 235, 'text-anchor': 'middle', 'font-size': 62 }, scene);
    });
    /* piano */
    var pi = el('g', {}, scene);
    el('rect', { x: 120, y: 700, width: 420, height: 150, rx: 10, fill: '#2b2f3a' }, pi);
    el('rect', { x: 140, y: 700, width: 380, height: 40, rx: 6, fill: '#f6f7fb' }, pi);
    for (var k = 0; k < 15; k++) {
      el('rect', { x: 150 + k * 25, y: 700, width: 4, height: 40, fill: '#2b2f3a' }, pi);
    }
    el('rect', { x: 150, y: 850, width: 16, height: 70, fill: '#1f232c' }, pi);
    el('rect', { x: 494, y: 850, width: 16, height: 70, fill: '#1f232c' }, pi);
    /* notställ */
    var ns = el('g', {}, scene);
    el('rect', { x: 690, y: 690, width: 120, height: 14, rx: 6, fill: '#5b6779' }, ns);
    el('rect', { x: 744, y: 704, width: 10, height: 130, fill: '#5b6779' }, ns);
    el('path', { d: 'M714,834 h70 l-35,26 z', fill: '#5b6779' }, ns);
    return {};
  }

  /* ---------- Slöjdsalen ---------- */
  function slojd() {
    vagg('#e9e6dd', '#d5d0c2', 660);
    golv(660, '#a98c6b', '#8f755a');
    /* verktygstavla */
    var vt = el('g', {}, scene);
    el('rect', { x: 90, y: 150, width: 420, height: 260, rx: 10, fill: '#c9a978', stroke: '#a8895c', 'stroke-width': 8 }, vt);
    ['🔨', '🪚', '🪛', '📏', '✂️', '🖌️'].forEach(function (ic, i) {
      txt(ic, { x: 150 + (i % 3) * 130, y: 240 + Math.floor(i / 3) * 110, 'text-anchor': 'middle', 'font-size': 54 }, vt);
    });
    /* hyvelbänkar */
    [[620, 700, 420], [1120, 760, 460]].forEach(function (b) {
      var g = el('g', {}, scene);
      el('rect', { x: b[0], y: b[1], width: b[2], height: 30, rx: 6, fill: '#c08b4e' }, g);
      el('rect', { x: b[0] + 20, y: b[1] + 30, width: 22, height: 110, fill: '#9a6d3a' }, g);
      el('rect', { x: b[0] + b[2] - 42, y: b[1] + 30, width: 22, height: 110, fill: '#9a6d3a' }, g);
      el('rect', { x: b[0] + 40, y: b[1] - 14, width: 90, height: 16, rx: 4, fill: '#8b5e3c' }, g);
    });
    /* maskin med skydd */
    var mg = el('g', {}, scene);
    el('rect', { x: 1560, y: 560, width: 250, height: 190, rx: 12, fill: '#5f6b7a' }, mg);
    el('rect', { x: 1590, y: 520, width: 190, height: 50, rx: 8, fill: '#7a8896' }, mg);
    el('circle', { cx: 1685, cy: 640, r: 46, fill: '#cbd5e1', stroke: '#94a3b8', 'stroke-width': 6 }, mg);
    txt('SÅG', { x: 1685, y: 554, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, fill: '#e8eef5' }, mg);
    return { maskin: mg };
  }

  /* ---------- Sjukrummet ---------- */
  function sjukrum() {
    vagg('#e7f2f6', '#cfe4ec', 700);
    golv(700, '#dfe6ea', '#c6d2d8');
    fonsterrad(1420, 150, 1, 300, 240, 0);
    /* brits */
    var br = el('g', {}, scene);
    el('rect', { x: 380, y: 660, width: 700, height: 50, rx: 12, fill: '#8fbcd4' }, br);
    el('rect', { x: 380, y: 710, width: 700, height: 40, rx: 8, fill: '#5f92ad' }, br);
    el('rect', { x: 400, y: 750, width: 22, height: 110, fill: '#7f8c99' }, br);
    el('rect', { x: 1038, y: 750, width: 22, height: 110, fill: '#7f8c99' }, br);
    el('rect', { x: 400, y: 600, width: 180, height: 66, rx: 16, fill: '#fff' }, br);
    /* skåp med plåster */
    var sk = el('g', {}, scene);
    el('rect', { x: 120, y: 320, width: 220, height: 340, rx: 10, fill: '#fff', stroke: '#b9cdd6', 'stroke-width': 8 }, sk);
    el('path', { d: 'M230,360 v120 M170,420 h120', stroke: '#e05252', 'stroke-width': 22, 'stroke-linecap': 'round' }, sk);
    txt('🩹  🧊  🌡️', { x: 230, y: 580, 'text-anchor': 'middle', 'font-size': 40 }, sk);
    return {};
  }

  /* ---------- Fritidsrummet ---------- */
  function fritids() {
    vagg('#fdf0e2', '#f6dfc7', 660);
    golv(660, '#c99a63', '#ad8250');
    fonsterrad(1380, 140, 2, 180, 230, 220);
    /* mattor */
    el('ellipse', { cx: 480, cy: 900, rx: 340, ry: 100, fill: '#79b7c9' }, scene);
    el('ellipse', { cx: 1420, cy: 940, rx: 300, ry: 88, fill: '#e0a95f' }, scene);
    /* pysselhylla */
    var hy = el('g', {}, scene);
    el('rect', { x: 80, y: 300, width: 300, height: 360, rx: 10, fill: '#b3844f' }, hy);
    ['🧩', '🎨', '🧶', '🎲', '📚', '🪁'].forEach(function (ic, i) {
      txt(ic, { x: 145 + (i % 3) * 95, y: 400 + Math.floor(i / 3) * 160, 'text-anchor': 'middle', 'font-size': 54 }, hy);
    });
    el('rect', { x: 88, y: 430, width: 284, height: 12, fill: '#966b3c' }, hy);
    el('rect', { x: 88, y: 590, width: 284, height: 12, fill: '#966b3c' }, hy);
    return {};
  }

  /* ---------- Aulan ---------- */
  function aula() {
    vagg('#2b2740', '#1d1a2e', 700);
    golv(700, '#4a3f5c', '#3a3149');
    /* ridå */
    var ri = el('g', {}, scene);
    el('rect', { x: 0, y: 0, width: 1920, height: 90, fill: '#7b1f2b' }, ri);
    for (var d = 0; d < 24; d++) {
      el('path', { d: 'M' + (d * 80) + ',90 q40,60 0,120', stroke: '#8f2733', 'stroke-width': 44, fill: 'none', opacity: 0.7 }, ri);
    }
    el('rect', { x: 0, y: 0, width: 260, height: 700, fill: '#7b1f2b' }, ri);
    el('rect', { x: 1660, y: 0, width: 260, height: 700, fill: '#7b1f2b' }, ri);
    /* scen */
    el('rect', { x: 260, y: 620, width: 1400, height: 90, rx: 8, fill: '#6b5a3e' }, scene);
    el('rect', { x: 260, y: 620, width: 1400, height: 16, fill: '#8a7550' }, scene);
    /* stolsrader i förgrunden */
    for (var row = 0; row < 2; row++) {
      for (var c = 0; c < 9; c++) {
        var g = el('g', {}, scene);
        var x = 180 + c * 190 + row * 60, y = 880 + row * 120;
        el('rect', { x: x, y: y, width: 120, height: 90, rx: 12, fill: row ? '#3f3752' : '#4a4160' }, g);
      }
    }
    return {};
  }

  /* ---------- Köket hemma: läxor efter middagen ---------- */
  function kok() {
    vagg('#eae2d4', '#d8cbb6', 700);
    golv(700, '#9d7b53', '#8a6a45');
    /* fönster mot kvällsmörker */
    var f = el('g', {}, scene);
    el('rect', { x: 120, y: 130, width: 320, height: 330, rx: 10, fill: '#1b2436' }, f);
    el('circle', { cx: 208, cy: 202, r: 26, fill: '#f2efd9', opacity: 0.9 }, f);
    for (var i = 0; i < 11; i++) {
      el('circle', { cx: 145 + (i * 97) % 280, cy: 165 + (i * 61) % 270, r: 2.5, fill: '#dfe6ff', opacity: 0.75 }, f);
    }
    el('rect', { x: 120, y: 130, width: 320, height: 330, rx: 10, fill: 'none', stroke: '#b9a887', 'stroke-width': 10 }, f);
    el('path', { d: 'M280,130 v330 M120,295 h320', stroke: '#b9a887', 'stroke-width': 10 }, f);
    /* köksskåp och bänk */
    el('rect', { x: 1180, y: 150, width: 620, height: 200, rx: 10, fill: '#c9b696' }, scene);
    el('rect', { x: 1192, y: 162, width: 292, height: 176, rx: 6, fill: '#d8c8ac' }, scene);
    el('rect', { x: 1496, y: 162, width: 292, height: 176, rx: 6, fill: '#d8c8ac' }, scene);
    el('rect', { x: 1330, y: 240, width: 16, height: 30, rx: 8, fill: '#8a7550' }, scene);
    el('rect', { x: 1634, y: 240, width: 16, height: 30, rx: 8, fill: '#8a7550' }, scene);
    el('rect', { x: 1180, y: 470, width: 620, height: 26, rx: 8, fill: '#b8a482' }, scene);
    var kanna = el('g', {}, scene);
    el('rect', { x: 1618, y: 386, width: 74, height: 84, rx: 10, fill: '#3f4a5c' }, kanna);
    el('rect', { x: 1634, y: 366, width: 42, height: 24, rx: 6, fill: '#5a6879' }, kanna);
    /* väggklocka — visarna går att styra från filmen */
    var kl = el('g', {}, scene);
    el('circle', { cx: 830, cy: 200, r: 58, fill: '#fff', stroke: '#8a7550', 'stroke-width': 9 }, kl);
    for (var t = 0; t < 12; t++) {
      var a = t / 12 * Math.PI * 2;
      el('circle', { cx: 830 + Math.sin(a) * 44, cy: 200 - Math.cos(a) * 44, r: 2.6, fill: '#8a7550' }, kl);
    }
    var minutv = el('line', { x1: 830, y1: 200, x2: 830, y2: 158, stroke: '#10201d', 'stroke-width': 5, 'stroke-linecap': 'round' }, kl);
    var timv = el('line', { x1: 830, y1: 200, x2: 858, y2: 200, stroke: '#10201d', 'stroke-width': 7, 'stroke-linecap': 'round' }, kl);
    el('circle', { cx: 830, cy: 200, r: 5, fill: '#10201d' }, kl);
    /* ställer klockan på ett klockslag */
    function stall(timme, minut) {
      var am = minut / 60 * Math.PI * 2, at = ((timme % 12) + minut / 60) / 12 * Math.PI * 2;
      minutv.setAttribute('x2', 830 + Math.sin(am) * 42);
      minutv.setAttribute('y2', 200 - Math.cos(am) * 42);
      timv.setAttribute('x2', 830 + Math.sin(at) * 28);
      timv.setAttribute('y2', 200 - Math.cos(at) * 28);
    }
    stall(19, 40);
    return { stallKlockan: stall };
  }

  global.Miljoer = { gym: gym, bibliotek: bibliotek, musiksal: musiksal, slojd: slojd,
    sjukrum: sjukrum, fritids: fritids, aula: aula, kok: kok,
    golv: golv, vagg: vagg, fonsterrad: fonsterrad };
})(window, window.Filmkit);
