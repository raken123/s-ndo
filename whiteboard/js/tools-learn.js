/* Lärande och paus: räknare, mattetränare, glosförhör, andning, rörelsepaus, dagens fråga */
(function (App) {
  'use strict';

  /* ---------------- Miniräknare ---------------- */
  App.register({
    id: 'calc', name: 'Miniräknare', icon: '🧮', cat: 'Lärande',
    desc: 'Stor miniräknare som syns från hela klassrummet.',
    keys: 'miniräknare räkna matte kalkylator',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var disp = App.el('div');
      disp.style.cssText = 'font-size:clamp(44px,9vw,110px);font-weight:800;min-width:min(620px,90vw);' +
        'text-align:right;padding:18px 26px;border-radius:18px;background:var(--panel);' +
        'border:1px solid var(--border);font-variant-numeric:tabular-nums;overflow:hidden';
      disp.textContent = '0';
      box.appendChild(disp);
      var grid = App.el('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;width:min(620px,90vw)';
      box.appendChild(grid);
      L.body.appendChild(box);

      var expr = '';
      function push(t) {
        if (t === 'C') { expr = ''; }
        else if (t === '⌫') { expr = expr.slice(0, -1); }
        else if (t === '=') {
          try {
            if (!/^[0-9+\-*/.() %]*$/.test(expr)) throw new Error('fel');
            /* jshint evil:false */
            var r = Function('"use strict";return (' + (expr || '0') + ')')();
            expr = (Math.round(r * 1e10) / 1e10).toString();
          } catch (e) { expr = ''; App.toast('Ogiltigt uttryck'); }
        } else { expr += t; }
        disp.textContent = expr || '0';
      }
      ['7', '8', '9', '⌫', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '/', '+', 'C', '(', ')', '=']
        .forEach(function (t) {
          var b = App.button(t, t === '=' ? '' : 'ghost', function () { push(t); App.beep(500, 40, 'sine', 0.1); });
          b.style.cssText += 'height:78px;font-size:30px';
          if (t === '=') b.style.gridColumn = 'span 1';
          grid.appendChild(b);
        });
    }
  });

  /* ---------------- Mattetränare ---------------- */
  App.register({
    id: 'math', name: 'Mattetränare', icon: '✖️', cat: 'Lärande',
    desc: 'Slumpade räkneuppgifter att lösa tillsammans på tavlan.',
    keys: 'matte multiplikation tabell addition träning uppgift',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var q = App.el('div', 'big-num', '—');
      var a = App.el('div', 'mid-num', '');
      a.style.color = 'var(--ok)';
      var stat = App.el('div', 'muted'); stat.style.fontSize = '20px';
      box.appendChild(q); box.appendChild(a); box.appendChild(stat);
      L.body.appendChild(box);

      var op = App.Store.get('mathOp', '*');
      var maxN = App.Store.get('mathMax', 10);
      var right = 0, total = 0, answer = 0;

      function next() {
        var x = App.randInt(1, maxN), y = App.randInt(1, maxN);
        if (op === '-' && y > x) { var t = x; x = y; y = t; }
        if (op === '/') { answer = y; q.textContent = (x * y) + ' ÷ ' + x + ' = ?'; }
        else {
          answer = op === '*' ? x * y : op === '+' ? x + y : x - y;
          q.textContent = x + ' ' + (op === '*' ? '×' : op) + ' ' + y + ' = ?';
        }
        a.textContent = '';
        total++;
        stat.textContent = 'Uppgift ' + total + ' · rätt: ' + right;
      }
      box.appendChild(App.button('👁️ Visa svar', 'xl ghost', function () {
        a.textContent = answer;
        App.beep(880, 150);
      }));
      var row = App.el('div', 'row');
      row.appendChild(App.button('✅ Rätt', 'xl ok', function () { right++; next(); }));
      row.appendChild(App.button('➡️ Nästa', 'xl', next));
      box.appendChild(row);

      var opSel = App.el('select');
      opSel.innerHTML = '<option value="*">Multiplikation ×</option><option value="+">Addition +</option>' +
        '<option value="-">Subtraktion −</option><option value="/">Division ÷</option>';
      opSel.value = op;
      opSel.addEventListener('change', function () { op = opSel.value; App.Store.set('mathOp', op); next(); });
      var maxI = App.el('input'); maxI.type = 'number'; maxI.min = 2; maxI.max = 100; maxI.value = maxN; maxI.style.width = '110px';
      maxI.addEventListener('change', function () {
        maxN = Math.max(2, parseInt(maxI.value, 10) || 10);
        App.Store.set('mathMax', maxN); next();
      });
      L.bar.appendChild(opSel);
      L.bar.appendChild(App.el('span', 'muted', 'Största tal'));
      L.bar.appendChild(maxI);
      next();
    }
  });

  /* ---------------- Glosförhör ---------------- */
  App.register({
    id: 'quiz', name: 'Glosförhör', icon: '📖', cat: 'Lärande',
    desc: 'Egna ordlistor eller frågor — visa fråga och vänd på svaret.',
    keys: 'glosor ord quiz frågor förhör flashcard',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var card = App.el('div', 'card');
      card.style.cssText = 'min-width:min(760px,90vw);min-height:34vh;display:grid;place-items:center;' +
        'text-align:center;padding:40px;cursor:pointer';
      var txt = App.el('div');
      txt.style.cssText = 'font-size:clamp(32px,7vw,80px);font-weight:800';
      card.appendChild(txt);
      var pos = App.el('div', 'muted'); pos.style.fontSize = '20px';
      box.appendChild(card); box.appendChild(pos);
      L.body.appendChild(box);

      var pairs = App.Store.get('quizPairs', [
        { a: 'hund', b: 'dog' }, { a: 'katt', b: 'cat' }, { a: 'bok', b: 'book' }
      ]);
      var i = 0, showBack = false;
      function paint() {
        if (!pairs.length) { txt.textContent = 'Lägg till ord →'; pos.textContent = ''; return; }
        var p = pairs[i % pairs.length];
        txt.textContent = showBack ? p.b : p.a;
        txt.style.color = showBack ? 'var(--ok)' : '';
        pos.textContent = 'Ord ' + ((i % pairs.length) + 1) + ' av ' + pairs.length + ' · tryck på kortet för att vända';
      }
      card.addEventListener('click', function () { showBack = !showBack; App.beep(640, 80); paint(); });
      var row = App.el('div', 'row');
      row.appendChild(App.button('⬅️ Föregående', 'xl ghost', function () {
        i = (i - 1 + pairs.length) % Math.max(1, pairs.length); showBack = false; paint();
      }));
      row.appendChild(App.button('➡️ Nästa', 'xl', function () {
        i = (i + 1) % Math.max(1, pairs.length); showBack = false; paint();
      }));
      box.appendChild(row);
      L.bar.appendChild(App.button('🔀 Blanda', 'sm ghost', function () {
        pairs = App.shuffle(pairs); i = 0; showBack = false; App.Store.set('quizPairs', pairs); paint();
      }));
      L.bar.appendChild(App.button('✏️ Redigera ordlista', 'sm ghost', function () {
        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:240px';
        ta.value = pairs.map(function (p) { return p.a + ' = ' + p.b; }).join('\n');
        App.modal('En rad per ord: fråga = svar', ta, function () {
          pairs = ta.value.split('\n').map(function (line) {
            var p = line.split('=');
            return p.length >= 2 ? { a: p[0].trim(), b: p.slice(1).join('=').trim() } : null;
          }).filter(Boolean);
          App.Store.set('quizPairs', pairs);
          i = 0; showBack = false; paint();
        }, 'Spara');
      }));
      paint();
    }
  });

  /* ---------------- Andningsövning ---------------- */
  App.register({
    id: 'breathe', name: 'Andningsövning', icon: '🫁', cat: 'Paus',
    desc: 'Lugna klassen med guidad andning i fyra takter.',
    keys: 'andning lugn avslappning paus mindfulness',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var ball = App.el('div', 'breathe-ball');
      var lbl = App.el('div', 'mid-num', 'Tryck för att börja');
      var cnt = App.el('div', 'muted'); cnt.style.fontSize = '22px';
      box.appendChild(ball); box.appendChild(lbl); box.appendChild(cnt);
      L.body.appendChild(box);

      var phases = [['Andas in', 4, 3.4], ['Håll', 4, 3.4], ['Andas ut', 6, 1], ['Håll', 2, 1]];
      var p = 0, left = 0, running = false, cycles = 0;
      var btn = App.button('▶️ Starta', 'xl', function () {
        running = !running;
        btn.textContent = running ? '⏸️ Pausa' : '▶️ Starta';
        if (running) { p = 0; left = phases[0][1]; apply(); }
      });
      box.appendChild(btn);
      function apply() {
        var ph = phases[p];
        lbl.textContent = ph[0];
        ball.style.transitionDuration = ph[1] + 's';
        ball.style.transform = 'scale(' + ph[2] + ')';
      }
      App.every(1000, function () {
        if (!running) return;
        left--;
        if (left <= 0) {
          p = (p + 1) % phases.length;
          if (p === 0) cycles++;
          left = phases[p][1];
          apply();
          App.beep(p === 0 ? 660 : 520, 120, 'sine', 0.15);
        }
        cnt.textContent = left + ' s · ' + cycles + ' andetag';
      });
    }
  });

  /* ---------------- Rörelsepaus ---------------- */
  App.register({
    id: 'brainbreak', name: 'Rörelsepaus', icon: '🤸', cat: 'Paus',
    desc: 'Slumpar en kort rörelse- eller hjärnpaus till klassen.',
    keys: 'paus rörelse brain break lek energi',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var breaks = [
        '🤸 10 armhävningar mot väggen', '🦵 Stå på ett ben i 30 sekunder',
        '🕺 Dansa loss i 60 sekunder', '🧘 Sträck armarna mot taket i 20 sekunder',
        '👏 Klappa en rytm som klassen härmar', '🚶 Gå ett varv runt bänkarna',
        '🐸 10 grodhopp', '😂 Skratta högt i 10 sekunder',
        '🖐️ Ge fem till tre klasskamrater', '🧠 Räkna baklänges från 30',
        '👀 Titta ut genom fönstret och vila ögonen 30 sekunder',
        '🫱 Massera axlarna på dig själv i 20 sekunder',
        '🎯 Blunda och peka mot norr', '🤝 Berätta något roligt för din bänkkompis',
        '🏃 Spring på stället i 30 sekunder', '🐢 Rör dig i slow motion i 20 sekunder'
      ];
      var box = App.el('div', 'center-stack');
      var card = App.el('div', 'card');
      card.style.cssText = 'min-width:min(800px,92vw);padding:50px;text-align:center;font-size:clamp(28px,5vw,60px);font-weight:800';
      card.textContent = 'Tryck på knappen för en paus!';
      box.appendChild(card);
      L.body.appendChild(box);
      box.appendChild(App.button('🎲 Slumpa paus', 'xl', function () {
        var n = 0;
        var iv = setInterval(function () {
          card.textContent = App.pick(breaks); n++;
          if (n > 8) { clearInterval(iv); App.beep(1046, 200); }
        }, 80);
      }));
    }
  });

  /* ---------------- Dagens fråga ---------------- */
  App.register({
    id: 'prompt', name: 'Dagens fråga', icon: '💭', cat: 'Paus',
    desc: 'Samtalsfrågor att starta lektionen med.',
    keys: 'fråga samtal diskussion morgon start',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var qs = App.Store.get('prompts', null) || [
        'Vad är det bästa som hänt dig den här veckan?',
        'Om du fick välja en superkraft — vilken och varför?',
        'Vilken plats i världen vill du besöka?',
        'Vad är du bra på som få vet om?',
        'Vilket djur skulle du vilja vara en dag?',
        'Vad gör dig glad när du har en dålig dag?',
        'Om du var lärare en dag — vad skulle ni göra?',
        'Vilken bok eller film rekommenderar du?',
        'Vad vill du bli bättre på i skolan?',
        'Vad är den bästa presenten du fått?'
      ];
      var box = App.el('div', 'center-stack');
      var card = App.el('div', 'card');
      card.style.cssText = 'min-width:min(860px,92vw);padding:50px;text-align:center;font-size:clamp(26px,4.4vw,54px);font-weight:700';
      card.textContent = 'Tryck för dagens fråga';
      box.appendChild(card);
      L.body.appendChild(box);
      box.appendChild(App.button('💭 Ny fråga', 'xl', function () {
        card.textContent = App.pick(qs);
        App.beep(760, 150);
      }));
      L.bar.appendChild(App.button('✏️ Egna frågor', 'sm ghost', function () {
        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:240px';
        ta.value = qs.join('\n');
        App.modal('En fråga per rad', ta, function () {
          var v = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          if (v.length) { qs = v; App.Store.set('prompts', qs); }
        }, 'Spara');
      }));
    }
  });

})(window.App);
