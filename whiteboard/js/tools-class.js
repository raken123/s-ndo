/* Klassrum: trafikljus, ljuddetektor, arbetsläge, poäng, beröm, omröstning, kö, närvaro, räknare */
(function (App) {
  'use strict';

  /* ============ Ljudvakt: kör vidare även när verktyget stängs ============ */
  var Noise = {
    on: false, level: 0, peak: 0, threshold: 55, alerts: 0, alerting: false,
    lastAlert: 0, holdMs: 800, overSince: 0, stream: null, analyser: null, data: null, raf: 0,
    start: function (cb) {
      var self = this;
      if (this.on) { if (cb) cb(null); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (cb) cb('Mikrofon stöds inte i den här vyn');
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
        .then(function (stream) {
          var ac = App.audioCtx();
          if (!ac) { if (cb) cb('Ljudmotorn kunde inte startas'); return; }
          var src = ac.createMediaStreamSource(stream);
          var an = ac.createAnalyser();
          an.fftSize = 1024;
          an.smoothingTimeConstant = 0.6;
          src.connect(an);
          self.stream = stream; self.analyser = an;
          self.data = new Uint8Array(an.fftSize);
          self.on = true;
          App.dock.noiseOn = true;
          self.loop();
          if (cb) cb(null);
        })
        .catch(function (err) {
          if (cb) cb('Mikrofonen nekades: ' + (err && err.name ? err.name : 'okänt fel'));
        });
    },
    stop: function () {
      this.on = false;
      App.dock.noiseOn = false;
      App.dock.noiseAlert = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); }
      this.stream = null; this.analyser = null; this.level = 0;
    },
    loop: function () {
      var self = this;
      if (!this.on || !this.analyser) return;
      this.analyser.getByteTimeDomainData(this.data);
      var sum = 0, i;
      for (i = 0; i < this.data.length; i++) {
        var v = (this.data[i] - 128) / 128;
        sum += v * v;
      }
      var rms = Math.sqrt(sum / this.data.length);
      /* Skala om till 0–100 där normalt klassrumssorl hamnar mitt i skalan */
      var lvl = Math.min(100, Math.max(0, Math.round((20 * Math.log10(rms + 1e-8) + 70) * 1.6)));
      this.level = Math.round(this.level * 0.6 + lvl * 0.4);
      if (this.level > this.peak) this.peak = this.level;

      var now = Date.now();
      if (this.level >= this.threshold) {
        if (!this.overSince) this.overSince = now;
        if (now - this.overSince > this.holdMs && now - this.lastAlert > 3000) {
          this.lastAlert = now;
          this.alerts++;
          this.alerting = true;
          App.dock.noiseAlert = true;
          App.beep(1320, 350, 'square', 0.35);
          setTimeout(function () { self.alerting = false; App.dock.noiseAlert = false; }, 2500);
        }
      } else {
        this.overSince = 0;
      }
      this.raf = requestAnimationFrame(function () { self.loop(); });
    }
  };
  App.Noise = Noise;
  Noise.threshold = App.Store.get('noiseThreshold', 55);

  App.register({
    id: 'noise', name: 'Ljuddetektor', icon: '🔊', cat: 'Klassrum',
    desc: 'Mäter ljudnivån och piper när det blir för högt.',
    keys: 'ljud volym buller mikrofon pip nivå',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      box.style.width = 'min(900px, 92%)';
      var face = App.el('div', 'noise-face', '🙂');
      var meter = App.el('div', 'meter');
      var fill = App.el('div', 'meter-fill');
      meter.appendChild(fill);
      var lvlTxt = App.el('div', 'mid-num', '0');
      var info = App.el('div', 'muted'); info.style.fontSize = '20px';
      var status = App.el('div', 'muted'); status.style.fontSize = '17px';
      box.appendChild(face);
      box.appendChild(lvlTxt);
      box.appendChild(meter);
      box.appendChild(info);
      box.appendChild(status);
      L.body.appendChild(box);

      var thr = App.el('input');
      thr.type = 'range'; thr.min = 10; thr.max = 100; thr.value = Noise.threshold;
      thr.style.width = 'min(520px, 80vw)';
      var thrLbl = App.el('div', 'muted');
      thrLbl.style.fontSize = '18px';
      function thrTxt() { thrLbl.textContent = 'Larmgräns: ' + Noise.threshold; }
      thr.addEventListener('input', function () {
        Noise.threshold = parseInt(thr.value, 10);
        App.Store.set('noiseThreshold', Noise.threshold);
        thrTxt();
      });
      thrTxt();
      box.appendChild(thrLbl);
      box.appendChild(thr);

      var startBtn = App.button(Noise.on ? '⏹️ Stäng av ljudvakten' : '🎤 Starta ljudvakten', 'xl', function () {
        if (Noise.on) {
          Noise.stop();
          startBtn.textContent = '🎤 Starta ljudvakten';
          status.textContent = 'Ljudvakten är avstängd.';
        } else {
          status.textContent = 'Startar mikrofonen…';
          Noise.start(function (err) {
            if (err) { status.textContent = err; App.toast(err, 3500); return; }
            startBtn.textContent = '⏹️ Stäng av ljudvakten';
            status.textContent = 'Ljudvakten lyssnar — den fortsätter även när du byter verktyg.';
          });
        }
      });
      box.appendChild(startBtn);
      var row = App.el('div', 'row');
      row.appendChild(App.button('↺ Nollställ larm', 'sm ghost', function () { Noise.alerts = 0; Noise.peak = 0; }));
      box.appendChild(row);

      App.every(80, function () {
        var l = Noise.on ? Noise.level : 0;
        fill.style.width = l + '%';
        lvlTxt.textContent = l;
        face.textContent = !Noise.on ? '🎤' : l >= Noise.threshold ? '🤫' : l >= Noise.threshold * 0.7 ? '😐' : '🙂';
        info.textContent = 'Toppnivå: ' + Noise.peak + ' · Larm: ' + Noise.alerts;
        box.classList.toggle('noise-flash', Noise.alerting);
        lvlTxt.style.color = l >= Noise.threshold ? 'var(--danger)' : '';
      });
      if (!Noise.on) status.textContent = 'Tryck på knappen och tillåt mikrofonen.';
    }
  });

  /* ---------------- Trafikljus ---------------- */
  App.register({
    id: 'traffic', name: 'Trafikljus', icon: '🚦', cat: 'Klassrum',
    desc: 'Visa hur arbetsron är just nu — grönt, gult eller rött.',
    keys: 'trafikljus beteende arbetsro rött grönt gult',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var wrap = App.el('div', 'row');
      wrap.style.cssText = 'gap:40px;align-items:center;justify-content:center;flex-wrap:wrap';
      var boxEl = App.el('div', 'tl-box');
      var texts = App.Store.get('trafficTexts', {
        red: 'Stopp! Nu måste det bli tyst.',
        yellow: 'Varning — sänk volymen.',
        green: 'Toppen! Ni jobbar jättebra.'
      });
      var state = App.Store.get('trafficState', 'green');
      var lamps = {};
      ['red', 'yellow', 'green'].forEach(function (c) {
        var l = App.el('div', 'tl-lamp ' + c);
        l.addEventListener('click', function () { set(c); });
        lamps[c] = l;
        boxEl.appendChild(l);
      });
      var side = App.el('div', 'center-stack');
      side.style.maxWidth = 'min(560px, 45vw)';
      var msg = App.el('div', 'tl-text');
      side.appendChild(msg);
      wrap.appendChild(boxEl);
      wrap.appendChild(side);
      L.body.appendChild(wrap);

      function set(c) {
        state = c;
        App.Store.set('trafficState', c);
        ['red', 'yellow', 'green'].forEach(function (k) { lamps[k].classList.toggle('on', k === c); });
        msg.textContent = texts[c];
        msg.style.color = c === 'red' ? '#ef4444' : c === 'yellow' ? '#d97706' : '#16a34a';
        if (c === 'red') App.beep(392, 400, 'square', 0.25);
      }
      var btnRow = App.el('div', 'row');
      btnRow.appendChild(App.button('🟢 Grönt', 'ok', function () { set('green'); }));
      btnRow.appendChild(App.button('🟡 Gult', 'warn', function () { set('yellow'); }));
      btnRow.appendChild(App.button('🔴 Rött', 'danger', function () { set('red'); }));
      side.appendChild(btnRow);

      L.bar.appendChild(App.button('✏️ Ändra texter', 'sm ghost', function () {
        var box = App.el('div', 'col');
        var inputs = {};
        [['green', 'Grönt'], ['yellow', 'Gult'], ['red', 'Rött']].forEach(function (p) {
          var f = App.el('div', 'field');
          f.appendChild(App.el('label', '', p[1]));
          var i = App.el('input'); i.type = 'text'; i.value = texts[p[0]];
          inputs[p[0]] = i;
          f.appendChild(i);
          box.appendChild(f);
        });
        App.modal('Texter för trafikljuset', box, function () {
          texts = { red: inputs.red.value, yellow: inputs.yellow.value, green: inputs.green.value };
          App.Store.set('trafficTexts', texts);
          set(state);
        }, 'Spara');
      }));
      L.bar.appendChild(App.button('🔗 Koppla till ljudvakten', 'sm ghost', function () {
        if (!Noise.on) { App.toast('Starta ljudvakten först'); return; }
        App.toast('Trafikljuset följer nu ljudnivån');
        App.every(700, function () {
          if (!Noise.on) return;
          var l = Noise.level, t = Noise.threshold;
          var want = l >= t ? 'red' : l >= t * 0.7 ? 'yellow' : 'green';
          if (want !== state) set(want);
        });
      }));
      set(state);
    }
  });

  /* ---------------- Arbetsläge ---------------- */
  App.register({
    id: 'worklevel', name: 'Arbetsläge', icon: '🔈', cat: 'Klassrum',
    desc: 'Visa vilken ljudnivå som gäller: tyst, viska, par eller grupp.',
    keys: 'ljudnivå arbetsläge tyst viska samarbeta regler',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var levels = [
        { i: '🤫', n: 'Nivå 0 — Tyst', d: 'Ingen pratar. Enskilt arbete.', c: '#4f46e5' },
        { i: '👂', n: 'Nivå 1 — Viskning', d: 'Viska med den som sitter bredvid.', c: '#0891b2' },
        { i: '👥', n: 'Nivå 2 — Par', d: 'Prata lågt i par eller liten grupp.', c: '#16a34a' },
        { i: '🗣️', n: 'Nivå 3 — Samtal', d: 'Full grupp — men inomhusröst!', c: '#f59e0b' }
      ];
      var box = App.el('div', 'center-stack');
      var card = App.el('div', 'card');
      card.style.cssText = 'text-align:center;padding:40px 50px;min-width:min(760px,90vw)';
      box.appendChild(card);
      L.body.appendChild(box);
      var idx = App.Store.get('worklevel', 0);
      function paint() {
        var l = levels[idx];
        card.innerHTML = '<div style="font-size:clamp(80px,16vw,180px);line-height:1">' + l.i + '</div>' +
          '<div style="font-size:clamp(28px,5vw,56px);font-weight:800;color:' + l.c + '">' + App.esc(l.n) + '</div>' +
          '<div class="muted" style="font-size:clamp(18px,2.6vw,28px);margin-top:10px">' + App.esc(l.d) + '</div>';
        App.Store.set('worklevel', idx);
      }
      var row = App.el('div', 'row');
      levels.forEach(function (l, i) {
        row.appendChild(App.button(l.i + ' ' + i, i === idx ? '' : 'ghost', function () {
          idx = i; paint();
          Array.prototype.forEach.call(row.children, function (b, j) { b.className = 'btn ' + (j === idx ? '' : 'ghost'); });
        }));
      });
      box.appendChild(row);
      paint();
    }
  });

  /* ---------------- Poängtavla ---------------- */
  App.register({
    id: 'score', name: 'Poängtavla', icon: '🏆', cat: 'Klassrum',
    desc: 'Poäng för lag eller grupper — perfekt vid tävlingar.',
    keys: 'poäng tavla lag tävling resultat',
    mount: function (root) {
      var L = App.layout(root);
      var teams = App.Store.get('teams', [{ n: 'Lag 1', p: 0 }, { n: 'Lag 2', p: 0 }]);
      var grid = App.el('div', 'row');
      grid.style.cssText = 'gap:18px;align-items:stretch;flex-wrap:wrap';
      L.body.appendChild(grid);
      function save() { App.Store.set('teams', teams); }
      function render() {
        grid.innerHTML = '';
        var best = Math.max.apply(null, teams.map(function (t) { return t.p; }).concat([0]));
        teams.forEach(function (t, i) {
          var c = App.el('div', 'score-card');
          if (t.p === best && best > 0) c.style.borderColor = 'var(--warn)';
          var nm = App.el('div');
          nm.style.cssText = 'font-size:22px;font-weight:700';
          nm.textContent = (t.p === best && best > 0 ? '👑 ' : '') + t.n;
          var v = App.el('div', 'val', String(t.p));
          var r = App.el('div', 'row');
          r.appendChild(App.button('−', 'sm ghost', function () { t.p--; save(); render(); }));
          r.appendChild(App.button('+1', 'sm', function () { t.p++; App.beep(880, 120); save(); render(); }));
          r.appendChild(App.button('+5', 'sm', function () { t.p += 5; App.beep(1046, 150); save(); render(); }));
          var x = App.button('✕', 'sm ghost', function () { teams.splice(i, 1); save(); render(); });
          c.appendChild(nm); c.appendChild(v); c.appendChild(r); c.appendChild(x);
          grid.appendChild(c);
        });
      }
      var nameI = App.el('input'); nameI.type = 'text'; nameI.placeholder = 'Lagets namn';
      L.bar.appendChild(nameI);
      L.bar.appendChild(App.button('➕ Nytt lag', 'sm', function () {
        teams.push({ n: nameI.value.trim() || 'Lag ' + (teams.length + 1), p: 0 });
        nameI.value = ''; save(); render();
      }));
      L.bar.appendChild(App.button('↺ Nollställ poäng', 'sm ghost', function () {
        teams.forEach(function (t) { t.p = 0; }); save(); render();
      }));
      L.bar.appendChild(App.button('👥 Lag från grupper', 'sm ghost', function () {
        var g = App.Store.get('savedGroups', null);
        if (!g) { App.toast('Spara en gruppindelning först'); return; }
        teams = g.map(function (_, i) { return { n: 'Grupp ' + (i + 1), p: 0 }; });
        save(); render();
      }));
      render();
    }
  });

  /* ---------------- Beröm och stjärnor ---------------- */
  App.register({
    id: 'stars', name: 'Stjärnor', icon: '⭐', cat: 'Klassrum',
    desc: 'Ge stjärnor till enskilda elever för bra insatser.',
    keys: 'stjärnor beröm belöning poäng elev',
    mount: function (root) {
      var L = App.layout(root);
      var students = App.students();
      if (!students.length) {
        L.body.innerHTML = '<div class="card muted">Lägg till elever under ⚙️ Inställningar.</div>';
        return;
      }
      var stars = App.Store.get('stars', {});
      var list = App.el('div', 'list');
      L.body.appendChild(list);
      function save() { App.Store.set('stars', stars); }
      function render() {
        list.innerHTML = '';
        students.slice().sort(function (a, b) { return (stars[b] || 0) - (stars[a] || 0); }).forEach(function (s) {
          var row = App.el('div', 'list-item');
          var n = stars[s] || 0;
          row.innerHTML = '<span class="grow">' + App.esc(s) + '</span>' +
            '<span style="font-size:22px">' + (n ? '⭐'.repeat(Math.min(n, 10)) : '') + '</span>' +
            '<span class="pill">' + n + '</span>';
          row.appendChild(App.button('−', 'sm ghost', function () { stars[s] = Math.max(0, n - 1); save(); render(); }));
          row.appendChild(App.button('+ ⭐', 'sm', function () {
            stars[s] = n + 1; App.beep(1174, 150); save(); render();
          }));
          list.appendChild(row);
        });
      }
      L.bar.appendChild(App.button('↺ Nollställ alla', 'sm ghost', function () {
        App.confirm('Nollställ stjärnor?', 'Alla elevers stjärnor sätts till noll.', function () {
          stars = {}; save(); render();
        });
      }));
      render();
    }
  });

  /* ---------------- Omröstning ---------------- */
  App.register({
    id: 'poll', name: 'Omröstning', icon: '📊', cat: 'Klassrum',
    desc: 'Räkna handuppräckningar och visa resultatet som stapeldiagram.',
    keys: 'omröstning rösta handuppräckning diagram',
    mount: function (root) {
      var L = App.layout(root);
      var poll = App.Store.get('poll', { q: 'Vad vill ni jobba med?', opts: [{ t: 'Alternativ A', v: 0 }, { t: 'Alternativ B', v: 0 }] });
      var head = App.el('div', 'card');
      head.style.marginBottom = '16px';
      var body = App.el('div', 'list');
      L.body.appendChild(head); L.body.appendChild(body);
      function save() { App.Store.set('poll', poll); }
      function render() {
        head.innerHTML = '<div style="font-size:30px;font-weight:800">' + App.esc(poll.q) + '</div>';
        var total = poll.opts.reduce(function (a, o) { return a + o.v; }, 0) || 1;
        body.innerHTML = '';
        poll.opts.forEach(function (o, i) {
          var row = App.el('div', 'list-item');
          var lbl = App.el('div');
          lbl.style.cssText = 'min-width:170px;font-weight:700';
          lbl.textContent = o.t;
          var barWrap = App.el('div', 'grow');
          var bar = App.el('div', 'poll-bar');
          bar.style.width = Math.round((o.v / total) * 100) + '%';
          barWrap.appendChild(bar);
          var val = App.el('span', 'pill', String(o.v));
          row.appendChild(lbl); row.appendChild(barWrap); row.appendChild(val);
          row.appendChild(App.button('−', 'sm ghost', function () { o.v = Math.max(0, o.v - 1); save(); render(); }));
          row.appendChild(App.button('+', 'sm', function () { o.v++; App.beep(700, 90); save(); render(); }));
          row.appendChild(App.button('✕', 'sm ghost', function () { poll.opts.splice(i, 1); save(); render(); }));
          body.appendChild(row);
        });
      }
      L.bar.appendChild(App.button('✏️ Fråga', 'sm ghost', function () {
        var i = App.el('input'); i.type = 'text'; i.value = poll.q; i.style.width = '100%';
        App.modal('Frågan', i, function () { poll.q = i.value || poll.q; save(); render(); }, 'Spara');
      }));
      var optI = App.el('input'); optI.type = 'text'; optI.placeholder = 'Nytt alternativ';
      L.bar.appendChild(optI);
      L.bar.appendChild(App.button('➕ Lägg till', 'sm', function () {
        poll.opts.push({ t: optI.value.trim() || 'Alternativ', v: 0 });
        optI.value = ''; save(); render();
      }));
      L.bar.appendChild(App.button('↺ Nollställ', 'sm ghost', function () {
        poll.opts.forEach(function (o) { o.v = 0; }); save(); render();
      }));
      render();
    }
  });

  /* ---------------- Turordning ---------------- */
  App.register({
    id: 'queue', name: 'Turordning', icon: '📋', cat: 'Klassrum',
    desc: 'Kölista för redovisning — vem står på tur just nu?',
    keys: 'turordning kö redovisning ordning lista',
    mount: function (root) {
      var L = App.layout(root);
      var order = App.Store.get('queue', null) || App.students();
      var pos = App.Store.get('queuePos', 0);
      var head = App.el('div', 'card');
      head.style.marginBottom = '16px';
      var list = App.el('div', 'list');
      L.body.appendChild(head); L.body.appendChild(list);
      function save() { App.Store.set('queue', order); App.Store.set('queuePos', pos); }
      function render() {
        if (!order.length) {
          head.innerHTML = '<div class="muted">Ingen kö. Lägg till elever under Inställningar eller skapa en egen lista.</div>';
          list.innerHTML = ''; return;
        }
        head.innerHTML = '<div class="muted" style="font-size:18px">På tur nu</div>' +
          '<div style="font-size:clamp(36px,8vw,90px);font-weight:800">' + App.esc(order[pos] || '–') + '</div>' +
          '<div class="muted">' + (pos + 1) + ' av ' + order.length +
          (order[pos + 1] ? ' · Nästa: ' + App.esc(order[pos + 1]) : ' · Sist i kön') + '</div>';
        list.innerHTML = '';
        order.forEach(function (s, i) {
          var row = App.el('div', 'list-item');
          if (i === pos) row.style.borderColor = 'var(--brand)';
          row.innerHTML = '<span class="pill">' + (i + 1) + '</span><span class="grow">' + App.esc(s) + '</span>' +
            (i < pos ? '<span class="muted">klar ✓</span>' : '');
          list.appendChild(row);
        });
      }
      L.bar.appendChild(App.button('⏭️ Nästa', 'sm', function () {
        if (pos < order.length - 1) { pos++; App.beep(880, 120); } else { App.toast('Kön är slut'); }
        save(); render();
      }));
      L.bar.appendChild(App.button('⏮️ Föregående', 'sm ghost', function () {
        pos = Math.max(0, pos - 1); save(); render();
      }));
      L.bar.appendChild(App.button('🔀 Slumpa ordning', 'sm ghost', function () {
        order = App.shuffle(order.length ? order : App.students()); pos = 0; save(); render();
      }));
      L.bar.appendChild(App.button('👥 Hämta klasslistan', 'sm ghost', function () {
        order = App.students(); pos = 0; save(); render();
      }));
      render();
    }
  });

  /* ---------------- Närvaro ---------------- */
  App.register({
    id: 'attendance', name: 'Närvaro', icon: '✅', cat: 'Klassrum',
    desc: 'Pricka av vilka elever som är här idag.',
    keys: 'närvaro frånvaro elever avprickning',
    mount: function (root) {
      var L = App.layout(root);
      var students = App.students();
      if (!students.length) {
        L.body.innerHTML = '<div class="card muted">Lägg till elever under ⚙️ Inställningar.</div>';
        return;
      }
      var today = new Date().toISOString().slice(0, 10);
      var data = App.Store.get('attendance', {});
      if (!data[today]) data[today] = {};
      var list = App.el('div', 'list');
      var head = App.el('div', 'card');
      head.style.marginBottom = '16px';
      L.body.appendChild(head); L.body.appendChild(list);
      function save() { App.Store.set('attendance', data); }
      function render() {
        var here = students.filter(function (s) { return data[today][s]; }).length;
        head.innerHTML = '<div style="font-size:26px;font-weight:800">' + here + ' av ' + students.length + ' är här</div>' +
          '<div class="muted">' + new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }) + '</div>';
        list.innerHTML = '';
        students.forEach(function (s) {
          var row = App.el('div', 'list-item');
          var on = !!data[today][s];
          row.innerHTML = '<span class="grow">' + App.esc(s) + '</span>';
          row.appendChild(App.button(on ? '✅ Här' : '⬜ Ej avprickad', on ? 'sm ok' : 'sm ghost', function () {
            data[today][s] = !on; save(); render();
          }));
          list.appendChild(row);
        });
      }
      L.bar.appendChild(App.button('✅ Alla här', 'sm', function () {
        students.forEach(function (s) { data[today][s] = true; }); save(); render();
      }));
      L.bar.appendChild(App.button('↺ Nollställ dagen', 'sm ghost', function () {
        data[today] = {}; save(); render();
      }));
      render();
    }
  });

  /* ---------------- Räknare ---------------- */
  App.register({
    id: 'counter', name: 'Räknare', icon: '➕', cat: 'Klassrum',
    desc: 'Enkel klickräknare — räkna svar, varv eller poäng.',
    keys: 'räknare klicka antal räkna',
    mount: function (root) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var val = App.Store.get('counter', 0);
      var disp = App.el('div', 'big-num', String(val));
      box.appendChild(disp);
      L.body.appendChild(box);
      function set(v) { val = v; disp.textContent = val; App.Store.set('counter', val); }
      var plus = App.button('+1', 'xl', function () { set(val + 1); App.beep(760, 90); });
      plus.style.cssText += 'min-width:220px;height:120px;font-size:42px';
      var row = App.el('div', 'row');
      row.appendChild(App.button('−1', 'xl ghost', function () { set(val - 1); }));
      row.appendChild(plus);
      row.appendChild(App.button('↺ Nollställ', 'xl ghost', function () { set(0); }));
      box.appendChild(row);
    }
  });

})(window.App);
