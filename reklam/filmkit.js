/* ===================================================================
   Filmkit — det som alla Sändo Tavla-filmer delar: ritverktyg, figurer,
   klassrummet, tavelramen och uppspelningen. Varje film lägger sin egen
   scen och tidslinje ovanpå.
   =================================================================== */
(function (global) {
'use strict';

var SVG = 'http://www.w3.org/2000/svg';
var scene = document.getElementById('scene');
var C = {
  brand: '#4f46e5', brandDark: '#3f37c9', cyan: '#06b6d4',
  ink: '#14192a', muted: '#6b7280', panel: '#ffffff', line: '#dbe1ee',
  wall: '#dfe6f5', wall2: '#c9d4ea', floor: '#c8a882', floorDark: '#b3946f',
  red: '#dc2626', green: '#16a34a', amber: '#f59e0b', orange: '#f97316'
};
var SKIN = ['#f5c9a6', '#e0a878', '#c68642', '#8d5524', '#ffdbac', '#a8683c'];
var SHIRT = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899'];

/* ---------- små hjälpare ---------- */
function el(tag, attrs, parent) {
  var e = document.createElementNS(SVG, tag);
  for (var k in attrs) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); }
  (parent || scene).appendChild(e);
  return e;
}
function txt(s, attrs, parent) {
  var t = el('text', attrs, parent);
  t.textContent = s;
  return t;
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
/* p(): 0 före start, 1 efter slut, mjuk kurva däremellan */
function p(t, start, end, ease) {
  var x = clamp((t - start) / Math.max(1, end - start), 0, 1);
  if (ease === 'in') return x * x;
  if (ease === 'out') return 1 - (1 - x) * (1 - x);
  if (ease === 'linear') return x;
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;   /* inOut */
}
/* Synlighet med in- och uttoning */
function fade(t, a, b, dur) {
  dur = dur || 400;
  return Math.min(p(t, a, a + dur), 1 - p(t, b - dur, b));
}
function show(g, v) { g.setAttribute('opacity', clamp(v, 0, 1)); g.style.display = v <= 0.001 ? 'none' : ''; }
function move(g, x, y, s) { g.setAttribute('transform', 'translate(' + x + ',' + y + ')' + (s != null ? ' scale(' + s + ')' : '')); }

/* ---------- figurer ---------- */
function kid(parent, opt) {
  var g = el('g', {}, parent);
  var skin = opt.skin || SKIN[0], shirt = opt.shirt || SHIRT[0];
  var hair = opt.hair || '#3b2a1e';
  el('rect', { x: -34, y: 6, width: 68, height: 78, rx: 26, fill: shirt }, g);          /* kropp */
  el('rect', { x: -46, y: 18, width: 20, height: 58, rx: 10, fill: shirt, id: 'armL' }, g);
  el('rect', { x: 26, y: 18, width: 20, height: 58, rx: 10, fill: shirt, id: 'armR' }, g);
  var head = el('g', {}, g);
  el('circle', { cx: 0, cy: -34, r: 40, fill: skin }, head);
  el('path', { d: 'M-41,-42 a41,41 0 0 1 82,0 q-20,-16 -41,-10 q-21,-6 -41,10 z', fill: hair }, head);
  el('circle', { cx: -14, cy: -36, r: 5, fill: '#1b2130', class: 'eye' }, head);
  el('circle', { cx: 14, cy: -36, r: 5, fill: '#1b2130', class: 'eye' }, head);
  var mouth = el('path', { d: 'M-12,-16 q12,8 24,0', stroke: '#1b2130', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, head);
  g.mouth = mouth;
  g.head = head;
  g.armL = g.querySelector('#armL');
  g.armR = g.querySelector('#armR');
  g.setMood = function (m) {
    if (m === 'skrik') { mouth.setAttribute('d', 'M-16,-18 a16,14 0 1 0 32,0 a16,14 0 1 0 -32,0'); mouth.setAttribute('fill', '#7f1d1d'); }
    else if (m === 'ledsen') { mouth.setAttribute('d', 'M-12,-12 q12,-9 24,0'); mouth.setAttribute('fill', 'none'); }
    else if (m === 'glad') { mouth.setAttribute('d', 'M-14,-18 q14,16 28,0'); mouth.setAttribute('fill', '#7f1d1d'); }
    else { mouth.setAttribute('d', 'M-12,-16 q12,8 24,0'); mouth.setAttribute('fill', 'none'); }
  };
  return g;
}
function bubble(parent, w, h, lines, size, tail) {
  /* tail = [x, y] dit svansen pekar, i bubblans egna koordinater */
  var g = el('g', {}, parent);
  if (tail) {
    el('path', {
      d: 'M' + (tail[0] * 0.25 - 40) + ',' + (h / 2 - 10) + ' L' + (tail[0] * 0.25 + 40) + ',' + (h / 2 - 10) +
         ' L' + tail[0] + ',' + tail[1] + ' Z',
      fill: '#fff', stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round'
    }, g);
  }
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 30, fill: '#fff', stroke: C.ink, 'stroke-width': 5 }, g);
  lines.forEach(function (line, i) {
    txt(line, {
      x: 0, y: -h / 2 + (h - lines.length * size * 1.2) / 2 + size * 0.92 + i * size * 1.2,
      'text-anchor': 'middle', 'font-size': size, 'font-weight': 800, fill: C.ink
    }, g);
  });
  return g;
}


/* Bygger klassrummet: väggar, golv, fönster, planscher och dörr.
   Returnerar delarna som filmerna behöver kunna animera. */
function buildRoom() {
/* ===================================================================
   Bakgrund: klassrummet
   =================================================================== */
  var room = el('g', {}, scene);
  el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: C.wall }, room);
  var wallGrad = el('linearGradient', { id: 'wg', x1: 0, y1: 0, x2: 0, y2: 1 }, el('defs', {}, scene));
  el('stop', { offset: 0, 'stop-color': '#e9eefb' }, wallGrad);
  el('stop', { offset: 1, 'stop-color': '#cdd8ee' }, wallGrad);
  el('rect', { x: 0, y: 0, width: 1920, height: 720, fill: 'url(#wg)' }, room);
  el('rect', { x: 0, y: 700, width: 1920, height: 380, fill: C.floor }, room);
  el('path', { d: 'M0,700 h1920 v14 h-1920 z', fill: C.floorDark }, room);
  for (var fi = 0; fi < 14; fi++) {
  el('path', { d: 'M' + (fi * 180 - 200) + ',1080 L' + (fi * 130 + 120) + ',714', stroke: 'rgba(0,0,0,.06)', 'stroke-width': 3 }, room);
  }
/* fönster */
  var win = el('g', {}, room);
  el('rect', { x: 90, y: 120, width: 300, height: 330, rx: 12, fill: '#bfe3ff', stroke: '#9fb2cf', 'stroke-width': 8 }, win);
  el('path', { d: 'M240,120 v330 M90,285 h300', stroke: '#9fb2cf', 'stroke-width': 8 }, win);
  el('circle', { cx: 340, cy: 180, r: 32, fill: '#ffe58a' }, win);
/* planscher */
  el('rect', { x: 1580, y: 150, width: 220, height: 150, rx: 10, fill: '#fff', stroke: C.line, 'stroke-width': 6 }, room);
  txt('ABC', { x: 1690, y: 245, 'text-anchor': 'middle', 'font-size': 62, 'font-weight': 800, fill: C.brand }, room);
  el('rect', { x: 1580, y: 330, width: 220, height: 150, rx: 10, fill: '#fff', stroke: C.line, 'stroke-width': 6 }, room);
  txt('123', { x: 1690, y: 425, 'text-anchor': 'middle', 'font-size': 62, 'font-weight': 800, fill: C.cyan }, room);

/* dörr till höger */
  var doorG = el('g', {}, room);
  el('rect', { x: 1330, y: 250, width: 200, height: 460, rx: 6, fill: '#8a5a3b' }, doorG);
  var doorPanel = el('g', {}, doorG);
  el('rect', { x: 1336, y: 256, width: 188, height: 448, rx: 4, fill: '#a3714b' }, doorPanel);
  el('rect', { x: 1360, y: 290, width: 140, height: 150, rx: 6, fill: '#b98459' }, doorPanel);
  el('circle', { cx: 1500, cy: 500, r: 10, fill: '#f0c96b' }, doorPanel);
  var doorDark = el('rect', { x: 1336, y: 256, width: 188, height: 448, fill: '#2a1f18', opacity: 0 }, doorG);
  txt('KORRIDOR', { x: 1430, y: 235, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: C.muted }, room);

  return { room: room, doorG: doorG, doorPanel: doorPanel, doorDark: doorDark, win: win };
}

/* Smartboardens ram och skärmyta — innehållet fyller varje film själv */
function buildBoard() {
  var boardG = el('g', {}, scene);
  el('rect', { x: 560, y: 130, width: 700, height: 440, rx: 18, fill: '#1e2436' }, boardG);
  var screen = el('g', {}, boardG);
  el('rect', { x: 574, y: 144, width: 672, height: 412, rx: 10, fill: '#f4f6fb' }, screen);
  return { boardG: boardG, screen: screen };
}

/* Appens topbar på tavlan */
function boardTopbar(screen) {
  el('rect', { x: 574, y: 144, width: 672, height: 52, fill: '#fff' }, screen);
  el('rect', { x: 590, y: 156, width: 30, height: 30, rx: 9, fill: C.brand }, screen);
  txt('S', { x: 605, y: 179, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, fill: '#fff' }, screen);
  txt('Sändo Tavla', { x: 632, y: 178, 'font-size': 19, 'font-weight': 700, fill: C.ink }, screen);
  el('rect', { x: 1090, y: 156, width: 92, height: 30, rx: 9, fill: '#eef2ff' }, screen);
  txt('5 000 kr', { x: 1136, y: 177, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: C.brand }, screen);
  el('rect', { x: 1192, y: 156, width: 42, height: 30, rx: 9, fill: C.brand }, screen);
  txt('+', { x: 1213, y: 180, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#fff' }, screen);
  el('rect', { x: 574, y: 196, width: 672, height: 2, fill: C.line }, screen);
}

/* En widgetruta på tavlan, som i appen */
function widget(screen, x, y, w, h, title) {
  var g = el('g', {}, screen);
  el('rect', { x: x, y: y, width: w, height: h, rx: 14, fill: '#fff', stroke: C.line, 'stroke-width': 2 }, g);
  el('rect', { x: x, y: y, width: w, height: 38, rx: 14, fill: '#eef2ff' }, g);
  el('rect', { x: x, y: y + 24, width: w, height: 14, fill: '#eef2ff' }, g);
  txt(title, { x: x + 16, y: y + 26, 'font-size': 16, 'font-weight': 700, fill: C.brand }, g);
  return g;
}

/* Lärarfigur */
function grownup(parent, color, skin, hair) {
  var g = el('g', {}, parent);
  var b = el('g', {}, g);
  el('rect', { x: -40, y: 10, width: 80, height: 130, rx: 30, fill: color }, b);
  el('rect', { x: -56, y: 22, width: 22, height: 74, rx: 11, fill: color }, b);
  var arm = el('rect', { x: 34, y: 22, width: 22, height: 74, rx: 11, fill: color }, b);
  el('circle', { cx: 0, cy: -34, r: 42, fill: skin }, b);
  el('path', { d: 'M-43,-40 a43,43 0 0 1 86,0 q-24,-22 -43,-14 q-19,-8 -43,14 z', fill: hair }, b);
  el('circle', { cx: -15, cy: -36, r: 5, fill: '#1b2130' }, b);
  el('circle', { cx: 15, cy: -36, r: 5, fill: '#1b2130' }, b);
  var mouth = el('path', { d: 'M-13,-16 q13,9 26,0', stroke: '#1b2130', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, b);
  g.body = b; g.arm = arm; g.mouth = mouth;
  g.talk = function (on, t) {
    mouth.setAttribute('d', on && Math.floor(t / 150) % 2 ? 'M-13,-14 q13,16 26,0' : 'M-13,-16 q13,9 26,0');
  };
  return g;
}


/* ---- Delade byggstenar som alla filmer efter de sex första använder ---- */

/* En skärm på väggen med appens topbar. Returnerar skärmgruppen. */
function wallScreen(x, y, w, h, label) {
  var g = el('g', {}, scene);
  el('rect', { x: x, y: y, width: w, height: h, rx: 20, fill: '#1e2436' }, g);
  var sc = el('g', {}, g);
  el('rect', { x: x + 16, y: y + 16, width: w - 32, height: h - 32, rx: 10, fill: '#f4f6fb' }, sc);
  el('rect', { x: x + 16, y: y + 16, width: w - 32, height: 50, fill: '#fff' }, sc);
  el('rect', { x: x + 34, y: y + 28, width: 28, height: 28, rx: 8, fill: C.brand }, sc);
  txt('S', { x: x + 48, y: y + 50, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, fill: '#fff' }, sc);
  txt('Sändo Tavla' + (label ? ' · ' + label : ''), { x: x + 74, y: y + 49, 'font-size': 18, 'font-weight': 700, fill: C.ink }, sc);
  var clock = txt('', { x: x + w - 34, y: y + 49, 'text-anchor': 'end', 'font-size': 18, 'font-weight': 700, fill: C.muted }, sc);
  el('rect', { x: x + 16, y: y + 66, width: w - 32, height: 2, fill: C.line }, sc);
  sc.frame = g;
  sc.clock = clock;
  return sc;
}

/* En telefon med Sändo Elev på skärmen. Samma roll som buildBoard, fast för
   den appen: ramen och topbaren ritas här, innehållet fyller filmen själv. */
function phone(x, y, w, label, flikar5) {
  /* flikar5: appen har fem flikar sedan Matteplatser kom till. De sjutton
     första filmerna ritades med fyra och ska fortsätta göra det, så den
     femte är ett tillval och inte ett nytt utseende för alla. */
  var h = Math.round(w * 2.02);
  var g = el('g', {}, scene);
  el('rect', { x: x - 12, y: y - 12, width: w + 24, height: h + 24, rx: 46, fill: '#0d1614' }, g);
  el('rect', { x: x, y: y, width: w, height: h, rx: 36, fill: '#f3f6f7' }, g);
  el('rect', { x: x + w / 2 - 34, y: y + 14, width: 68, height: 9, rx: 5, fill: '#0d1614' }, g);
  var sc = el('g', {}, g);
  el('rect', { x: x, y: y + 34, width: w, height: 74, fill: '#fff' }, sc);
  el('rect', { x: x + 20, y: y + 52, width: 40, height: 40, rx: 13, fill: '#0f7b6c' }, sc);
  txt('S', { x: x + 40, y: y + 81, 'text-anchor': 'middle', 'font-size': 25, 'font-weight': 800, fill: '#fff' }, sc);
  txt('Sändo Elev' + (label ? ' \u00b7 ' + label : ''), { x: x + 72, y: y + 80, 'font-size': 22, 'font-weight': 800, fill: '#10201d' }, sc);
  el('rect', { x: x + w - 186, y: y + 52, width: 166, height: 40, rx: 20, fill: '#dff3ef' }, sc);
  var kred = txt('5 000 000', { x: x + w - 103, y: y + 79, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: '#0b5e52' }, sc);
  el('rect', { x: x, y: y + 108, width: w, height: 2, fill: '#dbe5e4' }, sc);
  var tabbar = el('g', {}, sc);
  el('rect', { x: x, y: y + h - 96, width: w, height: 96, fill: '#fff' }, tabbar);
  el('rect', { x: x, y: y + h - 96, width: w, height: 2, fill: '#dbe5e4' }, tabbar);
  var flikar = [];
  var namnen = flikar5 ? ['Boken', 'Monni', 'Sagor', 'Platser', 'Mer']
                       : ['Boken', 'Monni', 'Sagor', 'Mer'];
  var ikoner = flikar5 ? ['\ud83d\udcd6', '\ud83d\udcac', '\u270f\ufe0f', '\ud83d\udccd', '\u2699\ufe0f']
                       : ['\ud83d\udcd6', '\ud83d\udcac', '\u270f\ufe0f', '\u2699\ufe0f'];
  var n = namnen.length, bredd = w / n;
  namnen.forEach(function (namn, i) {
    var bx = x + bredd * i + bredd / 2;
    var mark = el('rect', { x: bx - bredd / 2 + 6, y: y + h - 84, width: bredd - 12, height: 68, rx: 18, fill: '#dff3ef', opacity: 0 }, tabbar);
    txt(ikoner[i], { x: bx, y: y + h - 50, 'text-anchor': 'middle', 'font-size': flikar5 ? 26 : 30 }, tabbar);
    txt(namn, { x: bx, y: y + h - 24, 'text-anchor': 'middle', 'font-size': flikar5 ? 13 : 15, 'font-weight': 700, fill: '#5d7370' }, tabbar);
    flikar.push(mark);
  });
  sc.kred = kred;
  sc.flikar = flikar;
  sc.omrade = { x: x + 16, y: y + 122, w: w - 32, h: h - 96 - 134 };
  sc.ram = g;
  return sc;
}

/* Ett kort på telefonskärmen, som i appen */
function phoneCard(sc, y, h, titel, parent) {
  var o = sc.omrade;
  var g = el('g', {}, parent || sc);
  el('rect', { x: o.x, y: y, width: o.w, height: h, rx: 22, fill: '#fff', stroke: '#dbe5e4', 'stroke-width': 2 }, g);
  if (titel) txt(titel, { x: o.x + 20, y: y + 36, 'font-size': 21, 'font-weight': 800, fill: '#10201d' }, g);
  return g;
}

/* En chattbubbla på telefonskärmen */
function phoneBubble(sc, y, h, rader, fran, parent) {
  var o = sc.omrade;
  var g = el('g', {}, parent || sc);
  var langst = rader.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  var bredd = Math.max(140, Math.min(o.w - 30, 40 + langst * 11));
  var bx = fran === 'jag' ? o.x + o.w - bredd : o.x;
  el('rect', { x: bx, y: y, width: bredd, height: h, rx: 20, fill: fran === 'jag' ? '#0f7b6c' : '#fff',
    stroke: fran === 'jag' ? 'none' : '#dbe5e4', 'stroke-width': 2 }, g);
  if (fran !== 'jag') txt('Monni', { x: bx + 18, y: y + 28, 'font-size': 16, 'font-weight': 800, fill: '#0b5e52' }, g);
  rader.forEach(function (r, i) {
    txt(r, { x: bx + 18, y: y + (fran === 'jag' ? 34 : 56) + i * 26, 'font-size': 19,
      fill: fran === 'jag' ? '#fff' : '#10201d', 'font-weight': fran === 'jag' ? 600 : 400 }, g);
  });
  return g;
}

/* Android Auto-skärmen i mittkonsolen.
   En bilskärm ritar inte vyer utan mallar, och det syns: mörk botten, feta
   rader, och ingenting att skriva i. Så ser den ut på riktigt, och så ska den
   se ut här — en reklamfilm som visar en tangentbordsruta på en bilskärm
   ljuger om vad appen får göra. */
function bilskarm(x, y, w, h, rubrik) {
  var g = el('g', {}, scene);
  el('rect', { x: x - 10, y: y - 10, width: w + 20, height: h + 20, rx: 20, fill: '#0a0d12' }, g);
  el('rect', { x: x, y: y, width: w, height: h, rx: 12, fill: '#15191f' }, g);
  var topp = el('g', {}, g);
  el('rect', { x: x, y: y, width: w, height: 52, rx: 12, fill: '#1d232b' }, topp);
  el('rect', { x: x, y: y + 40, width: w, height: 12, fill: '#1d232b' }, topp);
  el('rect', { x: x + 16, y: y + 13, width: 26, height: 26, rx: 9, fill: '#0f7b6c' }, topp);
  txt('S', { x: x + 29, y: y + 33, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: '#fff' }, topp);
  var rub = txt(rubrik || 'Sändo Elev', { x: x + 54, y: y + 33, 'font-size': 20, 'font-weight': 700, fill: '#e8edf2' }, topp);

  var rader = [];
  function rad(i, titel, under, marke) {
    var ry = y + 66 + i * 58;
    var r = el('g', { opacity: 0 }, g);
    el('rect', { x: x + 10, y: ry, width: w - 20, height: 50, rx: 10, fill: '#1e242c' }, r);
    if (marke != null) {
      el('circle', { cx: x + 38, cy: ry + 25, r: 15, fill: '#0f7b6c' }, r);
      txt(marke, { x: x + 38, y: ry + 31, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: '#fff' }, r);
    }
    txt(titel, { x: x + (marke != null ? 62 : 26), y: ry + 22, 'font-size': 18, 'font-weight': 700, fill: '#e8edf2' }, r);
    txt(under, { x: x + (marke != null ? 62 : 26), y: ry + 42, 'font-size': 15, fill: '#95a3b3' }, r);
    rader.push(r);
    return r;
  }
  g.rad = rad;
  g.rader = rader;
  g.rubrik = rub;
  return g;
}

/* Bildtextraden längst ner */
function captionBar() {
  var g = el('g', { opacity: 0 }, scene);
  el('rect', { x: 300, y: 936, width: 1320, height: 118, rx: 26, fill: 'rgba(12,16,28,.86)' }, g);
  var title = txt('', { x: 960, y: 990, 'text-anchor': 'middle', 'font-size': 44, 'font-weight': 800, fill: '#fff' }, g);
  var sub = txt('', { x: 960, y: 1032, 'text-anchor': 'middle', 'font-size': 27, fill: '#c7cede' }, g);
  /* rows: [[från, till, rubrik, underrubrik], …] */
  g.play = function (t, rows) {
    var on = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (t > r[0] && t < r[1]) {
        on = fade(t, r[0], r[1], 300);
        title.textContent = r[2];
        sub.textContent = r[3];
        break;
      }
    }
    show(g, on);
  };
  return g;
}

/* Slutkortet, likadant i alla filmer */
function endCard(tagline, features, gradId, opt) {
  /* opt: {namn, knapp, fot, farg1, farg2} — utan opt blir det Sändo Tavlas
     slutkort precis som förut, så de sjutton första filmerna är orörda. */
  opt = opt || {};
  var defs = scene.querySelector('defs') || el('defs', {}, scene);
  var lg = el('linearGradient', { id: gradId || 'endgrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': opt.farg1 || '#4f46e5' }, lg);
  el('stop', { offset: 1, 'stop-color': opt.farg2 || '#06b6d4' }, lg);
  var g = el('g', { opacity: 0 }, scene);
  el('rect', { x: 0, y: 0, width: 1920, height: 1080, fill: 'url(#' + (gradId || 'endgrad') + ')' }, g);
  var logo = el('g', {}, g);
  el('rect', { x: 830, y: 190, width: 260, height: 260, rx: 70, fill: '#fff' }, logo);
  txt('S', { x: 960, y: 400, 'text-anchor': 'middle', 'font-size': 190, 'font-weight': 800, fill: opt.farg1 || C.brand }, logo);
  txt(opt.namn || 'Sändo Tavla', { x: 960, y: 570, 'text-anchor': 'middle', 'font-size': 96, 'font-weight': 800, fill: '#fff' }, g);
  txt(tagline, { x: 960, y: 640, 'text-anchor': 'middle', 'font-size': 40, fill: '#e6e9ff' }, g);
  txt(features, { x: 960, y: 706, 'text-anchor': 'middle', 'font-size': 29, fill: '#dfe3ff' }, g);
  var btn = el('g', {}, g);
  el('rect', { x: 560, y: 780, width: 800, height: 110, rx: 30, fill: '#fff' }, btn);
  txt(opt.knapp || 'INSTALLERA FÖR BRA ELEVER', { x: 960, y: 852, 'text-anchor': 'middle', 'font-size': 42, 'font-weight': 800, fill: opt.farg1 || C.brand }, btn);
  txt(opt.fot || 'Android 8.0+  ·  fungerar offline', { x: 960, y: 940, 'text-anchor': 'middle', 'font-size': 26, fill: '#e6e9ff' }, g);
  g.play = function (t, from, dur) {
    var v = fade(t, from, dur, 450);
    show(g, v);
    var pop = p(t, from, from + 800, 'out'), s1 = 0.85 + 0.15 * pop;
    logo.setAttribute('transform', 'translate(' + (960 * (1 - s1)) + ',' + (320 * (1 - s1)) + ') scale(' + s1 + ')');
    var s2 = 1 + Math.sin(t / 260) * 0.015;
    btn.setAttribute('transform', 'translate(' + (960 * (1 - s2)) + ',' + (835 * (1 - s2)) + ') scale(' + s2 + ')');
  };
  return g;
}

/* Pratbubbla som vet var den ska stå och vem den pekar på */
function speech(w, h, lines, size, tail, x, y) {
  var g = el('g', { opacity: 0 }, scene);
  bubble(g, w, h, lines, size, tail);
  g.play = function (t, a, b) {
    var v = fade(t, a, b, 280);
    show(g, v);
    move(g, x, y - (1 - p(t, a, a + 350, 'out')) * 30);
  };
  return g;
}

/* Enkel möbel: bord med ben */
function table(x, y, w, color) {
  var g = el('g', {}, scene);
  el('rect', { x: x, y: y, width: w, height: 20, rx: 8, fill: color || '#c68a52' }, g);
  el('rect', { x: x + 16, y: y + 20, width: 14, height: 80, fill: '#a06f3f' }, g);
  el('rect', { x: x + w - 30, y: y + 20, width: 14, height: 80, fill: '#a06f3f' }, g);
  return g;
}

/* Skalning i fönstret och uppspelning i loop */
function play(render, duration) {
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.getElementById('stage').style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();
  var t0 = null, paused = false;
  function loop(now) {
    if (!paused) {
      if (t0 === null) t0 = now;
      render((now - t0) % duration);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  /* Renderaren plockar ut exakta rutor med den här */
  window.__seek = function (ms) { paused = true; render(ms); };
  window.__duration = duration;
  render(0);
}

global.Filmkit = {
  SVG: SVG, scene: scene, C: C, SKIN: SKIN, SHIRT: SHIRT,
  el: el, txt: txt, clamp: clamp, lerp: lerp, p: p, fade: fade, show: show, move: move,
  kid: kid, bubble: bubble, grownup: grownup, speech: speech,
  buildRoom: buildRoom, buildBoard: buildBoard, boardTopbar: boardTopbar, widget: widget,
  wallScreen: wallScreen, captionBar: captionBar, endCard: endCard, table: table,
  phone: phone, phoneCard: phoneCard, phoneBubble: phoneBubble, bilskarm: bilskarm,
  play: play
};
})(window);
