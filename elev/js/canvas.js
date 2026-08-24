/* Sändo Elev — Canvas: interaktiva exempel.
 *
 * Monni kan avsluta ett svar med en rad
 *     [[canvas:{"typ":"talrad","min":0,"max":20,"start":7,"hopp":5}]]
 * och då ritas ett exempel som eleven kan dra i. Modellen kör ingen kod:
 * den väljer en typ ur listan nedan och sätter siffror. Allt som inte finns
 * i listan, och alla värden utanför sina gränser, kastas. Det är därför
 * canvasen är säker att lita på — den är inte kod, den är parametrar.
 *
 * Exemplet är ett exempel. Monni ska aldrig bygga en canvas på elevens egen
 * uppgift, utan på liknande tal — annars vore canvasen ett facit i förklädnad.
 */
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function num(v, min, max, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }
  function txt(str, attrs, parent) {
    var e = s('text', attrs, parent);
    e.textContent = str;
    return e;
  }
  /* Pekarens läge i svg-koordinater — fungerar likadant för mus och finger */
  function peka(svg, ev) {
    var r = svg.getBoundingClientRect();
    var vb = svg.viewBox.baseVal;
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
    return { x: vb.x + cx / r.width * vb.width, y: vb.y + cy / r.height * vb.height };
  }
  function drag(svg, onMove) {
    function ner(ev) { ev.preventDefault(); onMove(peka(svg, ev)); flytta(ev); }
    function flytta(ev) {
      function mv(e) { e.preventDefault(); onMove(peka(svg, e)); }
      function upp() {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', upp);
        window.removeEventListener('touchmove', mv);
        window.removeEventListener('touchend', upp);
      }
      window.addEventListener('pointermove', mv, { passive: false });
      window.addEventListener('pointerup', upp);
      window.addEventListener('touchmove', mv, { passive: false });
      window.addEventListener('touchend', upp);
      void ev;
    }
    svg.addEventListener('pointerdown', ner);
    svg.addEventListener('touchstart', ner, { passive: false });
  }
  function ram(parent, titel, hint) {
    var box = document.createElement('div');
    box.className = 'canvasruta';
    var t = document.createElement('div');
    t.className = 'canvas-titel';
    t.textContent = '🧩 ' + titel;
    box.appendChild(t);
    if (hint) {
      var h = document.createElement('div');
      h.className = 'canvas-hint';
      h.textContent = hint;
      box.appendChild(h);
    }
    parent.appendChild(box);
    return box;
  }
  function avlas(box) {
    var d = document.createElement('div');
    d.className = 'canvas-avlas';
    box.appendChild(d);
    return d;
  }
  function reglage(box, etikett, min, max, steg, start, onChange) {
    var wrap = box.querySelector('.canvas-reglage');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'canvas-reglage';
      box.appendChild(wrap);
    }
    var l = document.createElement('label');
    wrap.appendChild(l);
    var i = document.createElement('input');
    i.type = 'range';
    i.min = min; i.max = max; i.step = steg; i.value = start;
    wrap.appendChild(i);
    function uppdatera() {
      l.textContent = etikett + ' = ' + i.value;
      onChange(parseFloat(i.value));
    }
    i.addEventListener('input', uppdatera);
    uppdatera();
    return i;
  }

  var TYPER = {

    /* ---------- talrad: dra kulan, se hoppet ---------- */
    talrad: {
      stad: function (r) {
        var min = num(r.min, -100, 900, 0);
        var max = num(r.max, min + 2, min + 200, min + 20);
        return {
          typ: 'talrad', min: Math.round(min), max: Math.round(max),
          start: Math.round(num(r.start, min, max, min)),
          hopp: Math.round(num(r.hopp, -50, 50, 1)) || 1
        };
      },
      rita: function (c, parent) {
        var box = ram(parent, 'Talrad', 'Dra kulan. Pilen visar hoppet på ' + c.hopp + '.');
        var W = 640, H = 170, pad = 40;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H }, box);
        var span = c.max - c.min;
        function xAv(v) { return pad + (v - c.min) / span * (W - pad * 2); }
        s('line', { x1: pad, y1: 96, x2: W - pad, y2: 96, stroke: '#94a3b8', 'stroke-width': 4 }, svg);
        var steg = Math.max(1, Math.round(span / 10));
        for (var v = c.min; v <= c.max; v += steg) {
          s('line', { x1: xAv(v), y1: 86, x2: xAv(v), y2: 106, stroke: '#94a3b8', 'stroke-width': 3 }, svg);
          txt(v, { x: xAv(v), y: 134, 'text-anchor': 'middle', 'font-size': 20, fill: '#64748b' }, svg);
        }
        var bage = s('path', { fill: 'none', stroke: '#f59e0b', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
        var mal = s('circle', { r: 13, cy: 96, fill: '#f59e0b' }, svg);
        var kula = s('circle', { r: 19, cy: 96, fill: '#0f7b6c', stroke: '#fff', 'stroke-width': 4 }, svg);
        var ut = avlas(box);
        var pos = c.start;
        function rita() {
          var till = Math.min(c.max, Math.max(c.min, pos + c.hopp));
          kula.setAttribute('cx', xAv(pos));
          mal.setAttribute('cx', xAv(till));
          var x1 = xAv(pos), x2 = xAv(till), mitt = (x1 + x2) / 2;
          bage.setAttribute('d', 'M' + x1 + ',88 Q' + mitt + ',26 ' + x2 + ',88');
          ut.textContent = pos + (c.hopp < 0 ? ' − ' + (-c.hopp) : ' + ' + c.hopp) + ' = ' + till;
        }
        drag(svg, function (pt) {
          pos = Math.round(c.min + (pt.x - pad) / (W - pad * 2) * span);
          pos = Math.min(c.max, Math.max(c.min, pos));
          rita();
        });
        rita();
      }
    },

    /* ---------- bråk: tryck på delarna ---------- */
    brak: {
      stad: function (r) {
        var n = Math.round(num(r.namnare, 2, 12, 4));
        return {
          typ: 'brak', namnare: n,
          taljare: Math.round(num(r.taljare, 0, n, Math.min(1, n))),
          jamfor: r.jamfor ? Math.round(num(r.jamfor, 2, 12, 2)) : 0
        };
      },
      rita: function (c, parent) {
        var box = ram(parent, 'Bråk', 'Tryck på delarna för att färglägga dem.');
        var W = 640, rader = c.jamfor ? 2 : 1, H = rader * 92 + 16;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H }, box);
        var ut = avlas(box);
        var stavar = [];
        function stav(namnare, y, farg, start) {
          var bredd = (W - 20) / namnare, valda = start;
          var rutor = [];
          for (var i = 0; i < namnare; i++) {
            (function (idx) {
              var r = s('rect', {
                x: 10 + idx * bredd + 3, y: y, width: bredd - 6, height: 72, rx: 8,
                fill: '#e2e8f0', stroke: '#94a3b8', 'stroke-width': 2
              }, svg);
              r.addEventListener('pointerdown', function (ev) {
                ev.preventDefault();
                valda = idx + 1 === valda ? idx : idx + 1;
                mala();
              });
              rutor.push(r);
            })(i);
          }
          function mala() {
            rutor.forEach(function (r, i) { r.setAttribute('fill', i < valda ? farg : '#e2e8f0'); });
            skriv();
          }
          var o = { namnare: namnare, get: function () { return valda; }, mala: mala };
          stavar.push(o);
          mala();
          return o;
        }
        function skriv() {
          ut.textContent = stavar.map(function (st) {
            return st.get() + '/' + st.namnare;
          }).join('   och   ') + (stavar.length === 2
            ? '   →   ' + (stavar[0].get() / stavar[0].namnare > stavar[1].get() / stavar[1].namnare ? 'första är störst'
              : stavar[0].get() / stavar[0].namnare < stavar[1].get() / stavar[1].namnare ? 'andra är störst' : 'lika stora')
            : '');
        }
        stav(c.namnare, 8, '#0f7b6c', c.taljare);
        if (c.jamfor) stav(c.jamfor, 100, '#f59e0b', 1);
      }
    },

    /* ---------- rektangel: dra hörnet ---------- */
    rektangel: {
      stad: function (r) {
        return {
          typ: 'rektangel',
          bredd: Math.round(num(r.bredd, 1, 20, 6)),
          hojd: Math.round(num(r.hojd, 1, 14, 4))
        };
      },
      rita: function (c, parent) {
        var box = ram(parent, 'Rektangel', 'Dra i det gula hörnet och se vad som händer med arean.');
        var W = 640, H = 400, ruta = 28, x0 = 40, y0 = 30;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H }, box);
        for (var i = 0; i <= 20; i++) {
          s('line', { x1: x0 + i * ruta, y1: y0, x2: x0 + i * ruta, y2: y0 + 12 * ruta, stroke: '#e2e8f0', 'stroke-width': 2 }, svg);
        }
        for (var j = 0; j <= 12; j++) {
          s('line', { x1: x0, y1: y0 + j * ruta, x2: x0 + 20 * ruta, y2: y0 + j * ruta, stroke: '#e2e8f0', 'stroke-width': 2 }, svg);
        }
        var rekt = s('rect', { x: x0, y: y0, rx: 4, fill: 'rgba(15,123,108,.22)', stroke: '#0f7b6c', 'stroke-width': 4 }, svg);
        var handtag = s('circle', { r: 17, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 4 }, svg);
        var ut = avlas(box);
        var b = c.bredd, h = c.hojd;
        function rita() {
          rekt.setAttribute('width', b * ruta);
          rekt.setAttribute('height', h * ruta);
          handtag.setAttribute('cx', x0 + b * ruta);
          handtag.setAttribute('cy', y0 + h * ruta);
          ut.textContent = b + ' × ' + h + ' rutor   ·   area ' + (b * h) + '   ·   omkrets ' + (2 * (b + h));
        }
        drag(svg, function (pt) {
          b = Math.min(20, Math.max(1, Math.round((pt.x - x0) / ruta)));
          h = Math.min(12, Math.max(1, Math.round((pt.y - y0) / ruta)));
          rita();
        });
        rita();
      }
    },

    /* ---------- rät linje: dra i k och m ---------- */
    funktion: {
      stad: function (r) {
        return {
          typ: 'funktion',
          k: num(r.k, -5, 5, 1),
          m: num(r.m, -10, 10, 0)
        };
      },
      rita: function (c, parent) {
        var box = ram(parent, 'y = kx + m', 'Dra i reglagen och se hur linjen ändrar sig.');
        var W = 640, H = 420, mx = 320, my = 210, sk = 19;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H }, box);
        for (var g = -16; g <= 16; g++) {
          s('line', { x1: mx + g * sk, y1: 0, x2: mx + g * sk, y2: H, stroke: '#eef2f4', 'stroke-width': 2 }, svg);
          s('line', { x1: 0, y1: my + g * sk, x2: W, y2: my + g * sk, stroke: '#eef2f4', 'stroke-width': 2 }, svg);
        }
        s('line', { x1: 0, y1: my, x2: W, y2: my, stroke: '#94a3b8', 'stroke-width': 3 }, svg);
        s('line', { x1: mx, y1: 0, x2: mx, y2: H, stroke: '#94a3b8', 'stroke-width': 3 }, svg);
        var linje = s('line', { stroke: '#0f7b6c', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
        var punkt = s('circle', { r: 9, fill: '#f59e0b' }, svg);
        var ut = avlas(box);
        var k = c.k, m = c.m;
        function rita() {
          var vx = (W / 2) / sk;
          linje.setAttribute('x1', 0);
          linje.setAttribute('y1', my - (k * -vx + m) * sk);
          linje.setAttribute('x2', W);
          linje.setAttribute('y2', my - (k * vx + m) * sk);
          punkt.setAttribute('cx', mx);
          punkt.setAttribute('cy', my - m * sk);
          ut.textContent = 'y = ' + (k === 1 ? '' : k === -1 ? '−' : k) + 'x ' +
            (m >= 0 ? '+ ' + m : '− ' + (-m)) + '   ·   linjen skär y-axeln i ' + m;
        }
        reglage(box, 'k (lutning)', -5, 5, 0.5, k, function (v) { k = v; rita(); });
        reglage(box, 'm (skärning)', -10, 10, 1, m, function (v) { m = v; rita(); });
        rita();
      }
    },

    /* ---------- klocka: dra visarna ---------- */
    klocka: {
      stad: function (r) {
        return {
          typ: 'klocka',
          timme: Math.round(num(r.timme, 0, 23, 8)) % 12,
          minut: Math.round(num(r.minut, 0, 59, 0))
        };
      },
      rita: function (c, parent) {
        var box = ram(parent, 'Klockan', 'Dra i den långa visaren.');
        var W = 400, H = 400, mx = 200, my = 200, R = 160;
        var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H }, box);
        s('circle', { cx: mx, cy: my, r: R, fill: '#fff', stroke: '#0f7b6c', 'stroke-width': 8 }, svg);
        for (var i = 0; i < 12; i++) {
          var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          txt(i === 0 ? 12 : i, {
            x: mx + Math.cos(a) * (R - 32), y: my + Math.sin(a) * (R - 32) + 9,
            'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: '#334155'
          }, svg);
        }
        var tim = s('line', { stroke: '#10201d', 'stroke-width': 12, 'stroke-linecap': 'round' }, svg);
        var min = s('line', { stroke: '#f59e0b', 'stroke-width': 8, 'stroke-linecap': 'round' }, svg);
        s('circle', { cx: mx, cy: my, r: 10, fill: '#10201d' }, svg);
        var ut = avlas(box);
        var t = c.timme, m = c.minut;
        function rita() {
          var am = (m / 60) * Math.PI * 2 - Math.PI / 2;
          var at = ((t % 12 + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
          tim.setAttribute('x1', mx); tim.setAttribute('y1', my);
          tim.setAttribute('x2', mx + Math.cos(at) * (R - 74));
          tim.setAttribute('y2', my + Math.sin(at) * (R - 74));
          min.setAttribute('x1', mx); min.setAttribute('y1', my);
          min.setAttribute('x2', mx + Math.cos(am) * (R - 34));
          min.setAttribute('y2', my + Math.sin(am) * (R - 34));
          var tt = (t % 12) || 12;
          ut.textContent = tt + ':' + (m < 10 ? '0' : '') + m + '   ·   ' +
            (m === 0 ? 'hel timme' : m === 30 ? 'halv' : m === 15 ? 'kvart över' : m === 45 ? 'kvart i' : m + ' minuter över');
        }
        drag(svg, function (pt) {
          var v = Math.atan2(pt.y - my, pt.x - mx) + Math.PI / 2;
          if (v < 0) v += Math.PI * 2;
          var nyM = Math.round(v / (Math.PI * 2) * 60) % 60;
          if (m > 45 && nyM < 15) t = (t + 1) % 12;
          if (m < 15 && nyM > 45) t = (t + 11) % 12;
          m = nyM;
          rita();
        });
        rita();
      }
    },

    /* ---------- meningen: tryck orden i rätt ordning ---------- */
    meningen: {
      stad: function (r) {
        var ord = (Array.isArray(r.ord) ? r.ord : String(r.ord || '').split(/\s+/))
          .map(function (o) { return String(o).slice(0, 24); })
          .filter(function (o) { return o.length; })
          .slice(0, 12);
        return ord.length >= 2 ? { typ: 'meningen', ord: ord } : null;
      },
      rita: function (c, parent) {
        var box = ram(parent, 'Bygg meningen', 'Tryck på orden i den ordning du vill ha dem.');
        var pool = document.createElement('div');
        var bygge = document.createElement('div');
        bygge.style.cssText = 'min-height:56px;margin-bottom:8px;padding:6px;border:2px dashed var(--line);border-radius:14px';
        box.appendChild(bygge);
        box.appendChild(pool);
        var ut = avlas(box);
        var vald = [];
        /* blandad ordning, men aldrig exakt den Monni skickade */
        var lista = c.ord.slice();
        for (var i = lista.length - 1; i > 0; i--) {
          var j = (i * 7 + 3) % (i + 1);
          var tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
        }
        function rita() {
          pool.innerHTML = '';
          bygge.innerHTML = '';
          lista.forEach(function (ord, idx) {
            if (vald.indexOf(idx) >= 0) return;
            var k = document.createElement('button');
            k.type = 'button';
            k.className = 'ordkort';
            k.textContent = ord;
            k.addEventListener('click', function () { vald.push(idx); rita(); });
            pool.appendChild(k);
          });
          vald.forEach(function (idx, plats) {
            var k = document.createElement('button');
            k.type = 'button';
            k.className = 'ordkort vald';
            k.textContent = lista[idx];
            k.addEventListener('click', function () { vald.splice(plats, 1); rita(); });
            bygge.appendChild(k);
          });
          ut.textContent = vald.length
            ? vald.map(function (i2) { return lista[i2]; }).join(' ')
            : 'Meningen byggs här.';
        }
        rita();
      }
    }
  };

  var Canvas = {
    typer: Object.keys(TYPER),

    /* Plockar ut och städar canvas-taggen ur ett svar.
       Returnerar {text, canvas} där canvas är null om inget dugligt fanns. */
    plocka: function (svar) {
      var m = /\[\[canvas:([\s\S]*?)\]\]/.exec(svar);
      if (!m) return { text: svar, canvas: null };
      var text = svar.replace(m[0], '').trim();
      var rad = null;
      try { rad = JSON.parse(m[1]); } catch (e) { rad = null; }
      return { text: text, canvas: this.validera(rad) };
    },

    /* Bara typerna i listan, bara värden inom sina gränser. Allt annat blir
       null och svaret visas utan canvas — hellre ingen ruta än en trasig. */
    validera: function (rad) {
      if (!rad || typeof rad !== 'object') return null;
      var t = TYPER[String(rad.typ || '')];
      return t ? t.stad(rad) : null;
    },

    rita: function (spec, parent) {
      var t = spec && TYPER[spec.typ];
      if (!t) return false;
      t.rita(spec, parent);
      return true;
    },

    /* Beskrivningen som följer med i Monnis systemprompt */
    beskrivning: function () {
      return [
        'talrad — {"typ":"talrad","min":0,"max":20,"start":7,"hopp":5} : dra en kula längs en talrad, pilen visar hoppet',
        'brak — {"typ":"brak","namnare":8,"taljare":3,"jamfor":4} : färglägg delar, jämför två bråk (hoppa över "jamfor" för bara ett)',
        'rektangel — {"typ":"rektangel","bredd":6,"hojd":4} : dra hörnet, area och omkrets räknas om',
        'funktion — {"typ":"funktion","k":2,"m":-3} : reglage för k och m, linjen ritas om',
        'klocka — {"typ":"klocka","timme":8,"minut":15} : dra visaren, tiden skrivs i ord',
        'meningen — {"typ":"meningen","ord":["Hunden","sprang","genom","parken"]} : bygg meningen genom att trycka på orden'
      ].join('\n');
    }
  };

  global.Canvas = Canvas;
})(window);
