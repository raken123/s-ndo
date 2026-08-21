/* Slump: grupper, elevdragning, hjul, tärning, tal, mynt, placering, bingo */
(function (App) {
  'use strict';

  function needStudents(body) {
    var d = App.el('div', 'card');
    d.innerHTML = '<h3 style="font-size:20px;margin-bottom:8px">Inga elever inlagda</h3>' +
      '<p class="muted" style="font-size:16px">Lägg till elevernas namn under ⚙️ Inställningar → Klasser.</p>';
    var b = App.button('⚙️ Öppna inställningar', 'sm', function () { App.open('settings'); });
    b.style.marginTop = '14px';
    d.appendChild(b);
    body.appendChild(d);
  }

  /* ---------------- Grupper ---------------- */
  App.register({
    id: 'groups', name: 'Grupper', icon: '👥', cat: 'Slump',
    desc: 'Slumpa eleverna till grupper — antal grupper eller storlek.',
    keys: 'grupp grupper indelning slumpa lag',
    mount: function (root) {
      var L = App.layout(root);
      var students = App.students();
      if (!students.length) { needStudents(L.body); return; }

      var out = App.el('div', 'grid2');
      L.body.appendChild(out);
      var mode = App.Store.get('groupMode', 'count');
      var size = App.Store.get('groupSize', 4);
      var absent = {};

      var modeSel = App.el('select');
      modeSel.innerHTML = '<option value="count">Antal grupper</option><option value="size">Elever per grupp</option>';
      modeSel.value = mode;
      modeSel.addEventListener('change', function () { mode = modeSel.value; App.Store.set('groupMode', mode); });
      var num = App.el('input');
      num.type = 'number'; num.min = 1; num.max = 30; num.value = size; num.style.width = '110px';
      num.addEventListener('change', function () { App.Store.set('groupSize', parseInt(num.value, 10) || 4); });

      L.bar.appendChild(modeSel);
      L.bar.appendChild(num);
      L.bar.appendChild(App.button('🎲 Slumpa grupper', 'sm', draw));
      L.bar.appendChild(App.button('🙋 Frånvaro', 'sm ghost', function () {
        var box = App.el('div', 'list');
        App.students().forEach(function (s) {
          var row = App.el('label', 'list-item');
          var cb = App.el('input'); cb.type = 'checkbox'; cb.checked = !absent[s];
          cb.style.cssText = 'width:26px;height:26px';
          cb.addEventListener('change', function () { absent[s] = !cb.checked; });
          row.appendChild(cb);
          row.appendChild(App.el('span', 'grow', s));
          box.appendChild(row);
        });
        App.modal('Vilka är här idag?', box, function () { App.toast('Närvaro uppdaterad'); }, 'Klar');
      }));
      L.bar.appendChild(App.button('💾 Spara indelning', 'sm ghost', function () {
        if (!window.__lastGroups) { App.toast('Slumpa först'); return; }
        App.Store.set('savedGroups', window.__lastGroups);
        App.toast('Indelningen sparad');
      }));
      L.bar.appendChild(App.button('📂 Visa sparad', 'sm ghost', function () {
        var g = App.Store.get('savedGroups', null);
        if (!g) { App.toast('Ingen sparad indelning'); return; }
        render(g);
      }));

      function draw() {
        var pool = App.shuffle(App.students().filter(function (s) { return !absent[s]; }));
        if (!pool.length) { App.toast('Alla är markerade som frånvarande'); return; }
        var n = Math.max(1, parseInt(num.value, 10) || 1);
        var count = mode === 'count' ? n : Math.ceil(pool.length / n);
        count = Math.min(count, pool.length);
        var groups = [];
        var i;
        for (i = 0; i < count; i++) groups.push([]);
        pool.forEach(function (s, idx) { groups[idx % count].push(s); });
        window.__lastGroups = groups;
        render(groups);
      }
      function render(groups) {
        out.innerHTML = '';
        groups.forEach(function (g, i) {
          var c = App.el('div', 'group-card');
          c.innerHTML = '<h3>Grupp ' + (i + 1) + ' <span class="muted" style="font-size:14px">(' + g.length + ')</span></h3>' +
            '<ul>' + g.map(function (s) { return '<li>' + App.esc(s) + '</li>'; }).join('') + '</ul>';
          out.appendChild(c);
        });
      }
      draw();
    }
  });

  /* ---------------- Slumpa elev ---------------- */
  App.register({
    id: 'picker', name: 'Slumpa elev', icon: '🎯', cat: 'Slump',
    desc: 'Dra en elev — med eller utan återläggning.',
    keys: 'slumpa elev namn dra välj',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var students = App.students();
      if (!students.length) { needStudents(L.body); return; }
      var box = App.el('div', 'center-stack');
      var name = App.el('div', 'big-num', '?');
      name.style.fontSize = 'clamp(44px,11vw,150px)';
      var left = App.el('div', 'muted');
      left.style.fontSize = '20px';
      box.appendChild(name); box.appendChild(left);
      L.body.appendChild(box);

      var noRepeat = true, pool = App.shuffle(students);
      function updateLeft() { left.textContent = noRepeat ? pool.length + ' kvar i högen' : students.length + ' elever'; }
      function drawOne() {
        App.audioCtx();
        var spins = 14, i = 0;
        var iv = setInterval(function () {
          name.textContent = App.pick(students);
          i++;
          if (i >= spins) {
            clearInterval(iv);
            var chosen;
            if (noRepeat) {
              if (!pool.length) pool = App.shuffle(students);
              chosen = pool.pop();
            } else { chosen = App.pick(students); }
            name.textContent = chosen;
            App.beep(1046, 260);
            updateLeft();
          }
        }, 60);
      }
      var b = App.button('🎲 Dra elev', 'xl', drawOne);
      box.appendChild(b);
      L.bar.appendChild(App.button('🔁 Utan återläggning: PÅ', 'sm', function (e) {
        noRepeat = !noRepeat;
        e.target.textContent = '🔁 Utan återläggning: ' + (noRepeat ? 'PÅ' : 'AV');
        e.target.className = 'btn sm ' + (noRepeat ? '' : 'ghost');
        updateLeft();
      }));
      L.bar.appendChild(App.button('↺ Återställ hög', 'sm ghost', function () {
        pool = App.shuffle(students); updateLeft(); App.toast('Alla elever tillbaka i högen');
      }));
      updateLeft();
    }
  });

  /* ---------------- Lyckohjul ---------------- */
  App.register({
    id: 'wheel', name: 'Lyckohjul', icon: '🎡', cat: 'Slump',
    desc: 'Snurra hjulet med elever eller egna alternativ.',
    keys: 'hjul snurra lycka slumpa',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var cv = App.el('canvas'); cv.id = 'wheel-canvas'; cv.width = 620; cv.height = 620;
      cv.style.cssText = 'width:min(66vh,620px);height:min(66vh,620px)';
      var res = App.el('div', 'mid-num', '');
      box.appendChild(cv); box.appendChild(res);
      L.body.appendChild(box);

      var items = App.Store.get('wheelItems', null) || App.students();
      if (!items.length) items = ['Ja', 'Nej', 'Kanske', 'Fråga igen'];
      var angle = 0, spinning = false, vel = 0;
      var colors = ['#4f46e5', '#06b6d4', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#65a30d'];
      var ctx = cv.getContext('2d');

      function paint() {
        var r = cv.width / 2;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.save(); ctx.translate(r, r); ctx.rotate(angle);
        var step = (Math.PI * 2) / items.length;
        items.forEach(function (it, i) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, r - 14, i * step, (i + 1) * step);
          ctx.closePath();
          ctx.fillStyle = colors[i % colors.length];
          ctx.fill();
          ctx.save();
          ctx.rotate(i * step + step / 2);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + Math.max(14, Math.min(30, 340 / Math.max(6, items.length))) + 'px sans-serif';
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(String(it).slice(0, 16), r - 34, 0);
          ctx.restore();
        });
        ctx.restore();
        ctx.beginPath(); ctx.arc(r, r, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1c2333'; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cv.width - 6, r - 22); ctx.lineTo(cv.width - 6, r + 22); ctx.lineTo(cv.width - 52, r);
        ctx.closePath(); ctx.fillStyle = '#1c2333'; ctx.fill();
      }
      function spin() {
        if (spinning) return;
        spinning = true; res.textContent = '';
        vel = 0.35 + Math.random() * 0.25;
        App.audioCtx();
        var iv = setInterval(function () {
          angle += vel;
          vel *= 0.985;
          paint();
          if (vel < 0.002) {
            clearInterval(iv);
            spinning = false;
            var step = (Math.PI * 2) / items.length;
            var a = (Math.PI * 2 - (angle % (Math.PI * 2))) % (Math.PI * 2);
            var idx = Math.floor(a / step) % items.length;
            res.textContent = '🎉 ' + items[idx];
            App.beep(1046, 300);
          }
        }, 16);
      }
      cv.addEventListener('click', spin);
      box.appendChild(App.button('🎡 Snurra', 'xl', spin));
      L.bar.appendChild(App.button('👥 Använd elevlistan', 'sm ghost', function () {
        var s = App.students();
        if (!s.length) { App.toast('Inga elever inlagda'); return; }
        items = s; App.Store.set('wheelItems', items); paint();
      }));
      L.bar.appendChild(App.button('✏️ Egna alternativ', 'sm ghost', function () {
        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:200px';
        ta.value = items.join('\n');
        App.modal('Ett alternativ per rad', ta, function () {
          var v = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          if (v.length >= 2) { items = v; App.Store.set('wheelItems', items); paint(); }
          else App.toast('Minst två alternativ behövs');
        }, 'Spara');
      }));
      paint();
    }
  });

  /* ---------------- Tärning ---------------- */
  App.register({
    id: 'dice', name: 'Tärning', icon: '🎲', cat: 'Slump',
    desc: 'Kasta 1–6 tärningar med valfritt antal sidor.',
    keys: 'tärning kast slå sexa',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var faces = App.el('div', 'row');
      faces.style.justifyContent = 'center';
      var sum = App.el('div', 'muted'); sum.style.fontSize = '24px';
      box.appendChild(faces); box.appendChild(sum);
      L.body.appendChild(box);

      var count = 2, sides = 6;
      var pips = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      function roll() {
        App.audioCtx();
        var n = 0;
        var iv = setInterval(function () {
          show(true); n++;
          if (n > 10) { clearInterval(iv); show(false); App.beep(660, 200); }
        }, 70);
      }
      function show(rolling) {
        var vals = [], i, total = 0;
        for (i = 0; i < count; i++) { var v = App.randInt(1, sides); vals.push(v); total += v; }
        faces.innerHTML = '';
        vals.forEach(function (v) {
          var d = App.el('div');
          d.style.cssText = 'min-width:clamp(90px,14vw,170px);height:clamp(90px,14vw,170px);border-radius:22px;' +
            'background:var(--panel);border:3px solid var(--brand);display:grid;place-items:center;' +
            'font-size:clamp(48px,9vw,110px);font-weight:800;box-shadow:var(--shadow)';
          d.textContent = sides === 6 ? pips[v] : String(v);
          faces.appendChild(d);
        });
        sum.textContent = rolling ? '' : 'Summa: ' + total;
      }
      box.appendChild(App.button('🎲 Kasta', 'xl', roll));

      var cSel = App.el('select');
      [1, 2, 3, 4, 5, 6].forEach(function (n) { cSel.innerHTML += '<option value="' + n + '">' + n + ' tärningar</option>'; });
      cSel.value = 2;
      cSel.addEventListener('change', function () { count = parseInt(cSel.value, 10); show(false); });
      var sSel = App.el('select');
      [4, 6, 8, 10, 12, 20].forEach(function (n) { sSel.innerHTML += '<option value="' + n + '">D' + n + '</option>'; });
      sSel.value = 6;
      sSel.addEventListener('change', function () { sides = parseInt(sSel.value, 10); show(false); });
      L.bar.appendChild(cSel); L.bar.appendChild(sSel);
      show(false);
    }
  });

  /* ---------------- Slumptal ---------------- */
  App.register({
    id: 'number', name: 'Slumptal', icon: '🔢', cat: 'Slump',
    desc: 'Dra ett slumpmässigt tal i valfritt intervall.',
    keys: 'slumptal nummer tal intervall',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var out = App.el('div', 'big-num', '–');
      var hist = App.el('div', 'muted'); hist.style.fontSize = '20px';
      box.appendChild(out); box.appendChild(hist);
      L.body.appendChild(box);
      var min = App.el('input'); min.type = 'number'; min.value = 1; min.style.width = '120px';
      var max = App.el('input'); max.type = 'number'; max.value = 100; max.style.width = '120px';
      L.bar.appendChild(App.el('span', 'muted', 'Från')); L.bar.appendChild(min);
      L.bar.appendChild(App.el('span', 'muted', 'till')); L.bar.appendChild(max);
      var history = [];
      box.appendChild(App.button('🎲 Dra tal', 'xl', function () {
        var a = parseInt(min.value, 10) || 0, b = parseInt(max.value, 10) || 100;
        if (a > b) { var t = a; a = b; b = t; }
        var n = 0;
        var iv = setInterval(function () {
          out.textContent = App.randInt(a, b); n++;
          if (n > 12) {
            clearInterval(iv);
            var v = App.randInt(a, b);
            out.textContent = v;
            history.unshift(v); history = history.slice(0, 10);
            hist.textContent = 'Tidigare: ' + history.slice(1).join(', ');
            App.beep(880, 200);
          }
        }, 55);
      }));
    }
  });

  /* ---------------- Mynt ---------------- */
  App.register({
    id: 'coin', name: 'Singla slant', icon: '🪙', cat: 'Slump',
    desc: 'Krona eller klave när klassen inte kan bestämma sig.',
    keys: 'mynt slant krona klave',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var face = App.el('div'); face.style.cssText = 'font-size:clamp(100px,24vw,280px);line-height:1';
      face.textContent = '🪙';
      var lbl = App.el('div', 'mid-num', '');
      var tally = App.el('div', 'muted'); tally.style.fontSize = '20px';
      box.appendChild(face); box.appendChild(lbl); box.appendChild(tally);
      L.body.appendChild(box);
      var k = 0, kl = 0;
      box.appendChild(App.button('🪙 Singla', 'xl', function () {
        App.audioCtx();
        var n = 0;
        var iv = setInterval(function () {
          face.style.transform = 'scaleX(' + (n % 2 ? 1 : 0.2) + ')';
          n++;
          if (n > 10) {
            clearInterval(iv);
            face.style.transform = '';
            var krona = Math.random() < 0.5;
            if (krona) k++; else kl++;
            lbl.textContent = krona ? 'KRONA' : 'KLAVE';
            face.textContent = krona ? '👑' : '🪙';
            tally.textContent = 'Krona: ' + k + '  ·  Klave: ' + kl;
            App.beep(990, 200);
          }
        }, 70);
      }));
    }
  });

  /* ---------------- Placering ---------------- */
  App.register({
    id: 'seating', name: 'Placering', icon: '🪑', cat: 'Slump',
    desc: 'Slumpa en bordsplacering på rader och platser.',
    keys: 'placering bord platser sittplats karta',
    mount: function (root) {
      var L = App.layout(root);
      var students = App.students();
      if (!students.length) { needStudents(L.body); return; }
      var grid = App.el('div', 'seat-grid');
      var board = App.el('div', 'card');
      board.style.cssText = 'text-align:center;font-weight:700;margin-bottom:18px;font-size:20px';
      board.textContent = '🖥️ Tavlan';
      L.body.appendChild(board);
      L.body.appendChild(grid);

      var cols = App.Store.get('seatCols', 6);
      var colI = App.el('input'); colI.type = 'number'; colI.min = 2; colI.max = 10; colI.value = cols; colI.style.width = '110px';
      L.bar.appendChild(App.el('span', 'muted', 'Platser per rad'));
      L.bar.appendChild(colI);
      L.bar.appendChild(App.button('🎲 Slumpa placering', 'sm', draw));

      function draw() {
        cols = Math.max(2, Math.min(10, parseInt(colI.value, 10) || 6));
        App.Store.set('seatCols', cols);
        grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        var order = App.shuffle(App.students());
        var rows = Math.ceil(order.length / cols);
        grid.innerHTML = '';
        for (var i = 0; i < rows * cols; i++) {
          var s = order[i];
          var cell = App.el('div', 'seat' + (s ? '' : ' empty'), s || '–');
          grid.appendChild(cell);
        }
      }
      draw();
    }
  });

  /* ---------------- Bingo ---------------- */
  App.register({
    id: 'bingo', name: 'Bingo', icon: '🎱', cat: 'Slump',
    desc: 'Nummerbingo 1–75 med dragna nummer och egen bricka.',
    keys: 'bingo nummer dragning lek',
    mount: function (root) {
      var L = App.layout(root);
      var wrap = App.el('div', 'grid2');
      var left = App.el('div', 'card');
      var right = App.el('div', 'card');
      wrap.appendChild(left); wrap.appendChild(right);
      L.body.appendChild(wrap);

      var max = 75, drawn = [], remaining = [];
      function reset() {
        remaining = [];
        for (var i = 1; i <= max; i++) remaining.push(i);
        remaining = App.shuffle(remaining);
        drawn = [];
        render();
      }
      function render() {
        left.innerHTML = '<div class="muted">Senast dragna</div>' +
          '<div class="big-num" style="font-size:clamp(60px,16vw,180px)">' + (drawn[0] || '–') + '</div>' +
          '<div class="muted">' + drawn.length + ' av ' + max + ' dragna</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">' +
          drawn.slice(1).map(function (n) { return '<span class="pill">' + n + '</span>'; }).join('') + '</div>';
      }
      L.bar.appendChild(App.button('🎱 Dra nummer', 'sm', function () {
        if (!remaining.length) { App.toast('Alla nummer är dragna'); return; }
        drawn.unshift(remaining.pop());
        App.beep(760, 200);
        render();
      }));
      L.bar.appendChild(App.button('↺ Nytt spel', 'sm ghost', reset));

      /* Egen bricka */
      var grid = App.el('div', 'bingo-grid');
      right.innerHTML = '<div class="muted" style="margin-bottom:10px">Din bricka — tryck för att markera</div>';
      right.appendChild(grid);
      function newCard() {
        grid.innerHTML = '';
        var nums = App.shuffle((function () { var a = []; for (var i = 1; i <= max; i++) a.push(i); return a; })()).slice(0, 25);
        nums.forEach(function (n, i) {
          var c = App.el('div', 'bingo-cell', i === 12 ? '★' : String(n));
          if (i === 12) c.classList.add('marked');
          c.addEventListener('click', function () { c.classList.toggle('marked'); });
          grid.appendChild(c);
        });
      }
      L.bar.appendChild(App.button('🃏 Ny bricka', 'sm ghost', newCard));
      reset(); newCard();
    }
  });

})(window.App);
