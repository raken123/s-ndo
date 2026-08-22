/* Tid: schema, timer, stoppur, klocka, arbetspass */
(function (App) {
  'use strict';

  /* ---------------- Schema ---------------- */
  App.register({
    id: 'schedule', name: 'Schema', icon: '📅', cat: 'Lektion',
    desc: 'Lektioner med start- och sluttid som räknar ner automatiskt.',
    keys: 'schema lektion timer nedräkning dag',
    mount: function (root, App) {
      var L = App.layout(root);
      var lessons = App.Store.get('lessons', [
        { n: 'Lektion 1', s: '08:10', e: '09:00' },
        { n: 'Rast', s: '09:00', e: '09:20' },
        { n: 'Lektion 2', s: '09:20', e: '10:10' }
      ]);
      var notified = {};
      var head = App.el('div', 'card');
      head.style.marginBottom = '16px';
      var list = App.el('div', 'list');
      L.body.appendChild(head);
      L.body.appendChild(list);

      function save() { App.Store.set('lessons', lessons); }
      function sorted() {
        return lessons.slice().sort(function (a, b) { return App.minutesOf(a.s) - App.minutesOf(b.s); });
      }
      function current() {
        var now = App.nowMinutes();
        return sorted().filter(function (l) {
          return App.minutesOf(l.s) <= now && now < App.minutesOf(l.e);
        })[0] || null;
      }
      function next() {
        var now = App.nowMinutes();
        return sorted().filter(function (l) { return App.minutesOf(l.s) > now; })[0] || null;
      }
      function tick() {
        var now = App.nowMinutes();
        var nowMs = new Date().getSeconds();
        var cur = current();
        if (cur) {
          var leftMin = App.minutesOf(cur.e) - now;
          var leftSec = leftMin * 60 - nowMs;
          var total = App.minutesOf(cur.e) - App.minutesOf(cur.s);
          head.innerHTML =
            '<div class="muted" style="font-size:18px">Pågår nu</div>' +
            '<div style="font-size:34px;font-weight:800;margin:4px 0">' + App.esc(cur.n) + '</div>' +
            '<div class="big-num" style="font-size:clamp(56px,13vw,150px)">' + App.fmtDur(leftSec * 1000) + '</div>' +
            '<div class="muted" style="font-size:17px">kvar av ' + total + ' min · slutar ' + App.esc(cur.e) + '</div>';
          var key = cur.n + cur.e;
          if (leftSec <= 0 && !notified[key]) { notified[key] = true; App.chime(3); }
        } else {
          var nx = next();
          head.innerHTML = '<div class="muted" style="font-size:18px">Ingen lektion just nu</div>' +
            '<div style="font-size:30px;font-weight:800;margin-top:6px">' +
            (nx ? 'Nästa: ' + App.esc(nx.n) + ' kl ' + App.esc(nx.s) : 'Schemat är slut för idag') + '</div>';
        }
        Array.prototype.forEach.call(list.children, function (row) {
          var i = parseInt(row.dataset.i, 10);
          var l = sorted()[i];
          if (!l) return;
          var s = App.minutesOf(l.s), e = App.minutesOf(l.e);
          row.classList.toggle('now', now >= s && now < e);
          row.classList.toggle('done', now >= e);
          var bar = row.querySelector('.bar > i');
          if (bar) {
            var p = now < s ? 0 : now >= e ? 100 : ((now - s) / Math.max(1, e - s)) * 100;
            bar.style.width = p + '%';
          }
        });
      }
      function render() {
        list.innerHTML = '';
        sorted().forEach(function (l, i) {
          var row = App.el('div', 'lesson');
          row.dataset.i = i;
          row.innerHTML = '<div class="time">' + App.esc(l.s) + '–' + App.esc(l.e) + '</div>' +
            '<div class="grow" style="flex:1;font-weight:600">' + App.esc(l.n) + '</div>' +
            '<div class="bar"><i></i></div>';
          var del = App.button('✕', 'sm ghost', function () {
            var idx = lessons.indexOf(l);
            if (idx >= 0) { lessons.splice(idx, 1); save(); render(); tick(); }
          });
          row.appendChild(del);
          list.appendChild(row);
        });
        if (!lessons.length) list.innerHTML = '<div class="card muted">Inga lektioner. Lägg till en nedan.</div>';
        tick();
      }

      var nameI = App.el('input'); nameI.type = 'text'; nameI.placeholder = 'Lektionens namn'; nameI.style.minWidth = '200px';
      var startI = App.el('input'); startI.type = 'time'; startI.value = '08:10';
      var endI = App.el('input'); endI.type = 'time'; endI.value = '09:00';
      L.bar.appendChild(nameI);
      L.bar.appendChild(startI);
      L.bar.appendChild(App.el('span', 'muted', '→'));
      L.bar.appendChild(endI);
      L.bar.appendChild(App.button('➕ Lägg till', 'sm', function () {
        var n = nameI.value.trim() || 'Lektion';
        lessons.push({ n: n, s: startI.value || '08:00', e: endI.value || '09:00' });
        save(); nameI.value = ''; render();
      }));
      L.bar.appendChild(App.button('🗑️ Töm', 'sm ghost', function () {
        App.confirm('Töm schemat?', 'Alla lektioner tas bort.', function () { lessons = []; save(); render(); });
      }));

      render();
      App.every(1000, tick);
    }
  });

  /* ---------------- Timer ---------------- */
  App.register({
    id: 'timer', name: 'Timer', icon: '⏳', cat: 'Lektion',
    desc: 'Nedräkning med snabbval — pip när tiden är slut.',
    keys: 'timer nedräkning äggklocka minuter',
    mount: function (root, App) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var disp = App.el('div', 'big-num', '05:00');
      var ring = App.el('div');
      ring.style.cssText = 'width:min(60vw,420px);height:14px;border-radius:8px;background:var(--panel-2);overflow:hidden;border:1px solid var(--border)';
      var fill = App.el('i');
      fill.style.cssText = 'display:block;height:100%;background:var(--brand);width:100%';
      ring.appendChild(fill);
      box.appendChild(disp);
      box.appendChild(ring);
      L.body.appendChild(box);

      var duration = App.Store.get('timerDur', 300000);
      var endAt = App.Store.get('timerEnd', 0);
      var running = endAt > Date.now();
      var remaining = duration;
      var fired = false;

      function paint() {
        var left = running ? Math.max(0, endAt - Date.now()) : remaining;
        disp.textContent = App.fmtDur(left);
        fill.style.width = Math.max(0, Math.min(100, (left / Math.max(1, duration)) * 100)) + '%';
        disp.style.color = left <= 10000 && left > 0 ? 'var(--danger)' : '';
        if (running && left <= 0 && !fired) {
          fired = true; running = false; App.Store.set('timerEnd', 0);
          App.chime(4);
          document.body.style.background = '#fee2e2';
          setTimeout(function () { document.body.style.background = ''; }, 1500);
          App.toast('Tiden är slut!');
          syncBtn();
        }
      }
      function setDur(ms) {
        duration = ms; remaining = ms; running = false; fired = false;
        App.Store.set('timerEnd', 0);
        App.Store.set('timerDur', ms);
        syncBtn(); paint();
      }
      var startBtn;
      function syncBtn() {
        startBtn.textContent = running ? '⏸️ Pausa' : '▶️ Starta';
      }

      var quick = App.el('div', 'row');
      [1, 2, 3, 5, 10, 15, 20, 30, 45, 60].forEach(function (m) {
        quick.appendChild(App.button(m + ' min', 'sm ghost', function () { setDur(m * 60000); }));
      });
      box.appendChild(quick);

      startBtn = App.button('▶️ Starta', 'xl', function () {
        if (running) {
          remaining = Math.max(0, endAt - Date.now());
          running = false; App.Store.set('timerEnd', 0);
        } else {
          if (remaining <= 0) remaining = duration;
          endAt = Date.now() + remaining;
          App.Store.set('timerEnd', endAt);
          running = true; fired = false;
          App.audioCtx();
        }
        syncBtn(); paint();
      });
      var resetBtn = App.button('↺ Nollställ', 'xl ghost', function () { setDur(duration); });
      var row = App.el('div', 'row');
      row.appendChild(startBtn); row.appendChild(resetBtn);
      box.appendChild(row);

      var custom = App.el('div', 'row');
      var mi = App.el('input'); mi.type = 'number'; mi.min = 0; mi.max = 599; mi.value = 5; mi.style.width = '110px';
      var si = App.el('input'); si.type = 'number'; si.min = 0; si.max = 59; si.value = 0; si.style.width = '110px';
      custom.appendChild(App.el('span', 'muted', 'Egen tid:'));
      custom.appendChild(mi); custom.appendChild(App.el('span', 'muted', 'min'));
      custom.appendChild(si); custom.appendChild(App.el('span', 'muted', 'sek'));
      custom.appendChild(App.button('Ställ in', 'sm', function () {
        setDur(((parseInt(mi.value, 10) || 0) * 60 + (parseInt(si.value, 10) || 0)) * 1000);
      }));
      box.appendChild(custom);

      if (running) { remaining = Math.max(0, endAt - Date.now()); }
      syncBtn(); paint();
      App.every(200, paint);
    }
  });

  /* ---------------- Stoppur ---------------- */
  App.register({
    id: 'stopwatch', name: 'Stoppur', icon: '⏱️', cat: 'Lektion',
    desc: 'Ta tid med mellantider — bra på idrotten.',
    keys: 'stoppur tid varv mellantid',
    mount: function (root, App) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var disp = App.el('div', 'big-num', '0:00.00');
      var laps = App.el('div', 'list');
      laps.style.cssText = 'max-height:30vh;overflow:auto;min-width:min(90vw,420px)';
      box.appendChild(disp);
      L.body.appendChild(box);

      var startAt = 0, acc = 0, running = false, lapList = [];
      function paint() { disp.textContent = App.fmtDurMs(acc + (running ? Date.now() - startAt : 0)); }
      var startBtn = App.button('▶️ Starta', 'xl', function () {
        if (running) { acc += Date.now() - startAt; running = false; startBtn.textContent = '▶️ Fortsätt'; }
        else { startAt = Date.now(); running = true; startBtn.textContent = '⏸️ Pausa'; }
        paint();
      });
      var lapBtn = App.button('🏁 Varv', 'xl ghost', function () {
        var t = acc + (running ? Date.now() - startAt : 0);
        lapList.unshift(t);
        renderLaps();
      });
      var resetBtn = App.button('↺ Nollställ', 'xl ghost', function () {
        acc = 0; running = false; lapList = []; startBtn.textContent = '▶️ Starta'; renderLaps(); paint();
      });
      var row = App.el('div', 'row');
      row.appendChild(startBtn); row.appendChild(lapBtn); row.appendChild(resetBtn);
      box.appendChild(row);
      box.appendChild(laps);

      function renderLaps() {
        laps.innerHTML = '';
        lapList.forEach(function (t, i) {
          var d = App.el('div', 'list-item');
          d.innerHTML = '<span class="pill">' + (lapList.length - i) + '</span><span class="grow">' +
            App.fmtDurMs(t) + '</span>';
          laps.appendChild(d);
        });
      }
      paint();
      App.every(31, paint);
    }
  });

  /* ---------------- Klocka ---------------- */
  App.register({
    id: 'clock', name: 'Klocka', icon: '🕒', cat: 'Lektion',
    desc: 'Stor analog och digital klocka — träna klockan.',
    keys: 'klocka analog digital tid',
    mount: function (root, App) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var cv = App.el('canvas');
      cv.width = 520; cv.height = 520;
      cv.style.cssText = 'width:min(60vh,520px);height:min(60vh,520px)';
      var digital = App.el('div', 'mid-num', '--:--:--');
      var dateLbl = App.el('div', 'muted');
      dateLbl.style.fontSize = '22px';
      box.appendChild(cv); box.appendChild(digital); box.appendChild(dateLbl);
      L.body.appendChild(box);
      var showSeconds = true;

      L.bar.appendChild(App.button('👁️ Visa/dölj sekunder', 'sm ghost', function () {
        showSeconds = !showSeconds; paint();
      }));

      var ctx = cv.getContext('2d');
      function paint() {
        var d = new Date();
        var cs = getComputedStyle(document.body);
        var ink = cs.getPropertyValue('--ink').trim() || '#000';
        var brand = cs.getPropertyValue('--brand').trim() || '#4f46e5';
        var panel = cs.getPropertyValue('--panel').trim() || '#fff';
        var r = cv.width / 2;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.save();
        ctx.translate(r, r);
        ctx.beginPath(); ctx.arc(0, 0, r - 8, 0, Math.PI * 2);
        ctx.fillStyle = panel; ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = brand; ctx.stroke();
        var i, a;
        for (i = 0; i < 60; i++) {
          a = (i / 60) * Math.PI * 2;
          ctx.beginPath();
          ctx.lineWidth = i % 5 === 0 ? 6 : 2;
          ctx.strokeStyle = ink;
          ctx.moveTo(Math.sin(a) * (r - 30), -Math.cos(a) * (r - 30));
          ctx.lineTo(Math.sin(a) * (r - (i % 5 === 0 ? 52 : 40)), -Math.cos(a) * (r - (i % 5 === 0 ? 52 : 40)));
          ctx.stroke();
        }
        ctx.fillStyle = ink;
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (i = 1; i <= 12; i++) {
          a = (i / 12) * Math.PI * 2;
          ctx.fillText(String(i), Math.sin(a) * (r - 88), -Math.cos(a) * (r - 88));
        }
        function hand(angle, len, width, color) {
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.lineWidth = width; ctx.strokeStyle = color;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.sin(angle) * len, -Math.cos(angle) * len);
          ctx.stroke();
        }
        var sec = d.getSeconds() + d.getMilliseconds() / 1000;
        var min = d.getMinutes() + sec / 60;
        var hr = (d.getHours() % 12) + min / 60;
        hand((hr / 12) * Math.PI * 2, r * 0.5, 18, ink);
        hand((min / 60) * Math.PI * 2, r * 0.72, 12, ink);
        if (showSeconds) hand((sec / 60) * Math.PI * 2, r * 0.8, 5, '#dc2626');
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fillStyle = brand; ctx.fill();
        ctx.restore();

        digital.textContent = App.pad(d.getHours()) + ':' + App.pad(d.getMinutes()) +
          (showSeconds ? ':' + App.pad(d.getSeconds()) : '');
        dateLbl.textContent = d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
      }
      paint();
      App.every(100, paint);
    }
  });

  /* ---------------- Arbetspass (pomodoro) ---------------- */
  App.register({
    id: 'workblocks', name: 'Arbetspass', icon: '🍅', cat: 'Lektion',
    desc: 'Växlar mellan arbete och paus med signal vid varje byte.',
    keys: 'pomodoro arbete paus fokus intervall',
    mount: function (root, App) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var phase = App.el('div');
      phase.style.cssText = 'font-size:34px;font-weight:800';
      var disp = App.el('div', 'big-num', '20:00');
      var counter = App.el('div', 'muted');
      counter.style.fontSize = '20px';
      box.appendChild(phase); box.appendChild(disp); box.appendChild(counter);
      L.body.appendChild(box);

      var cfg = App.Store.get('pomodoro', { work: 20, brk: 5 });
      var isWork = true, left = cfg.work * 60000, running = false, last = Date.now(), done = 0;

      function paint() {
        phase.textContent = isWork ? '📚 Arbete' : '☕ Paus';
        phase.style.color = isWork ? 'var(--brand)' : 'var(--ok)';
        disp.textContent = App.fmtDur(left);
        counter.textContent = 'Avklarade arbetspass: ' + done;
      }
      App.every(250, function () {
        var now = Date.now();
        var dt = now - last; last = now;
        if (!running) return;
        left -= dt;
        if (left <= 0) {
          if (isWork) done++;
          isWork = !isWork;
          left = (isWork ? cfg.work : cfg.brk) * 60000;
          App.chime(isWork ? 3 : 2);
        }
        paint();
      });

      var startBtn = App.button('▶️ Starta', 'xl', function () {
        running = !running; last = Date.now();
        startBtn.textContent = running ? '⏸️ Pausa' : '▶️ Starta';
      });
      var row = App.el('div', 'row');
      row.appendChild(startBtn);
      row.appendChild(App.button('⏭️ Hoppa över', 'xl ghost', function () {
        isWork = !isWork; left = (isWork ? cfg.work : cfg.brk) * 60000; paint();
      }));
      row.appendChild(App.button('↺ Nollställ', 'xl ghost', function () {
        isWork = true; left = cfg.work * 60000; running = false; done = 0;
        startBtn.textContent = '▶️ Starta'; paint();
      }));
      box.appendChild(row);

      var cfgRow = App.el('div', 'row');
      var w = App.el('input'); w.type = 'number'; w.value = cfg.work; w.min = 1; w.style.width = '100px';
      var b = App.el('input'); b.type = 'number'; b.value = cfg.brk; b.min = 1; b.style.width = '100px';
      cfgRow.appendChild(App.el('span', 'muted', 'Arbete (min)')); cfgRow.appendChild(w);
      cfgRow.appendChild(App.el('span', 'muted', 'Paus (min)')); cfgRow.appendChild(b);
      cfgRow.appendChild(App.button('Spara', 'sm', function () {
        cfg = { work: Math.max(1, parseInt(w.value, 10) || 20), brk: Math.max(1, parseInt(b.value, 10) || 5) };
        App.Store.set('pomodoro', cfg);
        isWork = true; left = cfg.work * 60000; paint();
        App.toast('Sparat');
      }));
      box.appendChild(cfgRow);
      paint();
    }
  });

})(window.App);
