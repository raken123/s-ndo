/* ui.js — views, forms, canvases, printing. */
(function (global) {
  'use strict';

  var Store = global.Store, Link = global.Link, Tests = global.Tests;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fmtDateTime(s) {
    if (!s) return '—';
    var d = new Date(s.length === 16 ? s : s);
    if (isNaN(d)) return s;
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }
  function nn(v, suffix, dp) {
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
    if (typeof v === 'number' && dp !== undefined) v = v.toFixed(dp);
    return v + (suffix || '');
  }

  var UI = {};
  var sel = { personId: null, visitId: null };
  var running = { thermo: null, reflex: null, tremor: null };

  /* ── toast ────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }
  UI.toast = toast;

  /* ── views ────────────────────────────────────────────── */
  function show(name) {
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
    $$('.tab').forEach(function (b) {
      if (b.dataset.view === name) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    if (name === 'visit') renderVisit();
    if (name === 'device') renderDevice();
    if (name === 'settings') renderSettings();
  }
  UI.show = show;

  /* ══════════════════ people ══════════════════ */
  function renderPeople() {
    var list = $('#peopleList');
    var q = $('#search').value;
    var people = Store.search(q);
    list.textContent = '';

    people.forEach(function (p) {
      var li = el('li');
      li.setAttribute('role', 'option');
      if (p.id === sel.personId) li.setAttribute('aria-selected', 'true');
      li.appendChild(el('span', 'nm', p.name || '(no name)'));
      var age = Store.age(p.dob);
      var bits = [];
      if (p.chartId) bits.push(p.chartId);
      if (age !== null) bits.push(age + ' yr');
      var next = p.visits.length ? p.visits[0].when : '';
      if (next) bits.push(fmtDateTime(next));
      li.appendChild(el('small', null, bits.join(' · ') || 'no appointments'));
      li.onclick = function () { selectPerson(p.id); };
      list.appendChild(li);
    });

    $('#peopleCount').textContent = people.length + ' of ' + Store.people().length + ' shown';
    if (!people.length) {
      var e = el('li');
      e.style.color = 'var(--ink3)';
      e.style.cursor = 'default';
      e.textContent = Store.people().length ? 'Nothing matches that search.' : 'No records yet.';
      list.appendChild(e);
    }
  }

  function selectPerson(id) {
    sel.personId = id;
    sel.visitId = null;
    renderPeople();
    renderPerson();
  }

  function renderPerson() {
    var p = Store.person(sel.personId);
    var form = $('#personForm');
    $('#personEmpty').hidden = !!p;
    form.hidden = !p;
    if (!p) return;

    $('#personTitle').textContent = p.name || '(no name)';
    ['name', 'chartId', 'dob', 'sex', 'pronouns', 'phone', 'email', 'address',
     'kin', 'kinPhone', 'allergies', 'medication', 'conditions', 'notes'].forEach(function (k) {
      var f = form.elements[k];
      if (f) f.value = p[k] || '';
    });
    var age = Store.age(p.dob);
    form.elements.age.value = age === null ? '—' : age + ' years';

    renderVisitList(p);
    $('#savedNote').textContent = 'Last change ' + fmtDateTime(p.updated);
  }

  function renderVisitList(p) {
    var ul = $('#visitList');
    ul.textContent = '';
    if (!p.visits.length) {
      var e = el('li');
      e.style.color = 'var(--ink3)';
      e.textContent = 'No appointments booked.';
      ul.appendChild(e);
      return;
    }
    p.visits.forEach(function (v) {
      var li = el('li');
      li.appendChild(el('span', 'when', fmtDateTime(v.when)));
      li.appendChild(el('span', 'why', [v.reason, v.clinician].filter(Boolean).join(' — ') || 'no reason given'));
      var flags = el('span', 'flags');
      flags.appendChild(el('span', 'pill', v.status));
      if (v.thermo) flags.appendChild(pill('T ' + v.thermo.coreEstC.toFixed(1) + '°', v.thermo.band.tone));
      if (v.reflex) flags.appendChild(pill('R ' + nn(v.reflex.medianRtMs, ' ms'), v.reflex.band.tone));
      if (v.tremor) flags.appendChild(pill('S ' + v.tremor.tremorRmsMg.toFixed(1) + ' mg', v.tremor.band.tone));
      li.appendChild(flags);

      var open = el('button', 'btn', 'Open');
      open.type = 'button';
      open.onclick = function () { openVisit(p.id, v.id); };
      li.appendChild(open);

      var del = el('button', 'btn danger', '✕');
      del.type = 'button';
      del.title = 'Delete this appointment';
      del.onclick = function () {
        if (!confirm('Delete the appointment on ' + fmtDateTime(v.when) + ', including its measurements?')) return;
        Store.removeVisit(p.id, v.id);
        if (sel.visitId === v.id) sel.visitId = null;
        renderPerson();
        renderPeople();
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function pill(text, tone) {
    var s = el('span', 'pill' + (tone ? ' ' + tone : ''), text);
    return s;
  }

  function bindPersonForm() {
    var form = $('#personForm');
    form.addEventListener('input', function (ev) {
      var p = Store.person(sel.personId);
      if (!p || !ev.target.name || ev.target.name === 'age') return;
      p[ev.target.name] = ev.target.value;
      if (ev.target.name === 'name') {
        $('#personTitle').textContent = p.name || '(no name)';
      }
      if (ev.target.name === 'dob') {
        var a = Store.age(p.dob);
        form.elements.age.value = a === null ? '—' : a + ' years';
      }
      Store.touch(p);
      $('#savedNote').textContent = 'Saving…';
      clearTimeout(bindPersonForm._t);
      bindPersonForm._t = setTimeout(renderPeople, 600);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    $('#newPerson').onclick = function () {
      var p = Store.addPerson('');
      p.name = '';
      selectPerson(p.id);
      var f = $('#personForm').elements.name;
      f.focus();
    };

    $('#deletePerson').onclick = function () {
      var p = Store.person(sel.personId);
      if (!p) return;
      if (!confirm('Delete ' + (p.name || 'this person') + ' and all ' + p.visits.length +
                   ' appointment(s)? This cannot be undone.')) return;
      Store.removePerson(p.id);
      sel.personId = null;
      renderPeople();
      renderPerson();
      toast('Record deleted.');
    };

    $('#printPerson').onclick = function () { printPerson(Store.person(sel.personId)); };

    $('#search').addEventListener('input', renderPeople);

    $('#addVisit').onclick = function () {
      var p = Store.person(sel.personId);
      if (!p) return;
      var when = $('#newVisitWhen').value || Store.localIso();
      var v = Store.addVisit(p.id, when, $('#newVisitReason').value, $('#newVisitClinician').value);
      $('#newVisitReason').value = '';
      $('#newVisitClinician').value = '';
      renderPerson();
      renderPeople();
      openVisit(p.id, v.id);
    };
  }

  /* ══════════════════ visit ══════════════════ */
  function openVisit(personId, visitId) {
    sel.personId = personId;
    sel.visitId = visitId;
    cancelAllTests();
    show('visit');
  }
  UI.openVisit = openVisit;

  function renderVisit() {
    var p = Store.person(sel.personId);
    var v = p ? Store.visit(p.id, sel.visitId) : null;
    $('#visitNone').hidden = !!v;
    $('#visitBody').hidden = !v;
    if (!v) return;

    var age = Store.age(p.dob, v.when);
    $('#visitWho').textContent = p.name || '(no name)';
    $('#visitMeta').textContent = [
      p.chartId || 'no clinic ID',
      age !== null ? age + ' years' : 'age unknown',
      p.sex || '',
      'allergies: ' + (p.allergies || 'none recorded')
    ].filter(Boolean).join(' · ');

    $('#visitWhen').value = v.when || '';
    $('#visitClinician').value = v.clinician || '';
    $('#visitDept').value = v.dept || '';
    $('#visitStatus').value = v.status || 'Booked';
    $('#visitReason').value = v.reason || '';
    $('#visitNotes').value = v.notes || '';
    ['weight', 'height', 'bp', 'pulse', 'spo2', 'resp'].forEach(function (k) {
      $('#obs' + k.charAt(0).toUpperCase() + k.slice(1)).value = v.obs[k] || '';
    });

    renderThermoResult(v.thermo);
    renderReflexResult(v.reflex);
    renderTremorResult(v.tremor);
    drawReflex(null);
    drawTremorIdle(v.tremor);
    renderTrend(p);
    refreshTestButtons();
  }

  function bindVisitForm() {
    function cur() {
      var p = Store.person(sel.personId);
      return p ? Store.visit(p.id, sel.visitId) : null;
    }
    function wire(id, apply) {
      $(id).addEventListener('input', function () {
        var v = cur();
        if (!v) return;
        apply(v, $(id).value);
        Store.touch(Store.person(sel.personId));
      });
    }
    wire('#visitWhen', function (v, x) { v.when = x; });
    wire('#visitClinician', function (v, x) { v.clinician = x; });
    wire('#visitDept', function (v, x) { v.dept = x; });
    wire('#visitStatus', function (v, x) { v.status = x; });
    wire('#visitReason', function (v, x) { v.reason = x; });
    wire('#visitNotes', function (v, x) { v.notes = x; });
    ['weight', 'height', 'bp', 'pulse', 'spo2', 'resp'].forEach(function (k) {
      wire('#obs' + k.charAt(0).toUpperCase() + k.slice(1), function (v, x) { v.obs[k] = x; });
    });

    $('#closeVisit').onclick = function () { cancelAllTests(); show('people'); renderPerson(); renderPeople(); };
    $('#printVisit').onclick = function () {
      var p = Store.person(sel.personId);
      printVisit(p, cur());
    };
  }

  /* ── thermo ───────────────────────────────────────────── */
  function bindThermo() {
    $('#thermoStart').onclick = function () {
      var v = currentVisit();
      if (!v) return;
      var t = new Tests.ThermoTest({
        settings: liveSettings(),
        onTick: function (s) {
          $('#thermoLive').innerHTML = s.tempC.toFixed(2) + '<span class="unit">°C</span>';
          $('#thermoContact').textContent = s.contact ? 'yes' : 'no';
          $('#thermoSlope').textContent = isFinite(s.slope) ? s.slope.toFixed(3) + ' °C/s' : '—';
          $('#thermoRh').textContent = s.rh ? s.rh.toFixed(0) + ' %' : '—';
          $('#thermoProgress').style.width = (s.progress * 100).toFixed(0) + '%';
        },
        onDone: function (r) {
          running.thermo = null;
          v.thermo = r;
          Store.touch(Store.person(sel.personId));
          renderThermoResult(r);
          renderTrend(Store.person(sel.personId));
          thermoIdle();
          toast('Temperature recorded.');
        },
        onFail: function (msg) {
          running.thermo = null;
          thermoIdle();
          toast(msg);
        }
      });
      running.thermo = t;
      $('#thermoStart').hidden = true;
      $('#thermoStop').hidden = false;
      $('#thermoResult').hidden = true;
      $('#thermoProgress').style.width = '0%';
      t.start();
    };

    $('#thermoStop').onclick = function () {
      if (running.thermo) running.thermo.cancel();
      running.thermo = null;
      thermoIdle();
    };
  }

  function thermoIdle() {
    $('#thermoStart').hidden = false;
    $('#thermoStop').hidden = true;
    $('#thermoProgress').style.width = '0%';
    refreshTestButtons();
  }

  function renderThermoResult(r) {
    var box = $('#thermoResult');
    box.hidden = !r;
    if (!r) return;
    box.innerHTML =
      '<p class="verdict"><span class="pill ' + r.band.tone + '">' + esc(r.band.label) + '</span></p>' +
      '<dl>' +
      row('Skin (measured)', r.skinC.toFixed(2) + ' °C') +
      row('Core (estimated)', r.coreEstC.toFixed(2) + ' °C') +
      row('Offset applied', '+' + Number(r.coreOffset).toFixed(2) + ' °C') +
      row('Room humidity', nn(r.rh, ' %')) +
      row('Settled', r.settled ? 'yes, in ' + r.settleSecs + ' s' : 'no — timed out at ' + r.settleSecs + ' s') +
      row('Final drift', nn(r.driftCPerS, ' °C/s')) +
      row('Taken', fmtDateTime(r.at)) +
      '</dl>';
  }

  function row(k, v) { return '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>'; }

  /* ── reflex ───────────────────────────────────────────── */
  var reflexView = null;

  function bindReflex() {
    $('#reflexStart').onclick = function () {
      var v = currentVisit();
      if (!v) return;
      var t = new Tests.ReflexTest({
        settings: liveSettings(),
        onFrame: function (s) { reflexView = s; drawReflex(s); },
        onStatus: function (m) { $('#reflexStatus').textContent = m; },
        onDone: function (r) {
          running.reflex = null;
          v.reflex = r;
          Store.touch(Store.person(sel.personId));
          renderReflexResult(r);
          renderTrend(Store.person(sel.personId));
          reflexIdle();
          $('#reflexStatus').textContent = 'Done — ' + r.hits + ' of ' + r.rounds + ' hit.';
          toast('Reflex test recorded.');
        },
        onFail: function (msg) { running.reflex = null; reflexIdle(); toast(msg); }
      });
      running.reflex = t;
      $('#reflexStart').hidden = true;
      $('#reflexStop').hidden = false;
      $('#reflexResult').hidden = true;
      t.start();
    };

    $('#reflexStop').onclick = function () {
      if (running.reflex) running.reflex.cancel();
      running.reflex = null;
      reflexIdle();
      $('#reflexStatus').textContent = 'Stopped.';
    };
  }

  function reflexIdle() {
    $('#reflexStart').hidden = false;
    $('#reflexStop').hidden = true;
    // the stream has stopped, so park the cursor rather than leaving it stuck
    // wherever the last sample put it
    reflexView = null;
    drawReflex(null);
    refreshTestButtons();
  }

  function drawReflex(s) {
    var c = $('#reflexCanvas');
    var g = c.getContext('2d');
    var W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0f1419';
    g.fillRect(0, 0, W, H);

    var pad = 24, gap = 10;
    var cell = (Math.min(W, H) - pad * 2 - gap * 2) / 3;
    var ox = (W - (cell * 3 + gap * 2)) / 2, oy = (H - (cell * 3 + gap * 2)) / 2;

    for (var i = 0; i < 9; i++) {
      var cx = ox + (i % 3) * (cell + gap), cy = oy + Math.floor(i / 3) * (cell + gap);
      var lit = s && s.lit && s.target === i;
      g.fillStyle = lit ? '#2ee06a' : (i === 4 ? '#1b232d' : '#161d25');
      roundRect(g, cx, cy, cell, cell, 10);
      g.fill();
      g.strokeStyle = lit ? '#7cf2a8' : '#2c3743';
      g.lineWidth = lit ? 3 : 1;
      roundRect(g, cx, cy, cell, cell, 10);
      g.stroke();
      if (i === 4) {
        g.strokeStyle = '#3a4653';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx + cell / 2 - 8, cy + cell / 2); g.lineTo(cx + cell / 2 + 8, cy + cell / 2);
        g.moveTo(cx + cell / 2, cy + cell / 2 - 8); g.lineTo(cx + cell / 2, cy + cell / 2 + 8);
        g.stroke();
      }
    }

    // joystick cursor: centre cell is the joystick's full travel
    var mx = W / 2, my = H / 2;
    var span = (cell * 1.5 + gap);
    var jx = s ? s.x / 127 : 0, jy = s ? s.y / 127 : 0;
    var px = mx + jx * span, py = my - jy * span;

    if (s) {
      g.strokeStyle = 'rgba(159,176,192,.28)';
      g.setLineDash([4, 4]);
      g.beginPath(); g.arc(mx, my, (s.deadzone / 127) * span, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(53,160,216,.35)';
      g.beginPath(); g.arc(mx, my, (s.commit / 127) * span, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }

    g.fillStyle = s && s.btn ? '#e8b13a' : '#35a0d8';
    g.beginPath(); g.arc(px, py, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0f1419'; g.lineWidth = 2; g.stroke();

    if (s) {
      g.fillStyle = '#6f8090';
      g.font = '13px ui-monospace, monospace';
      g.textAlign = 'left';
      g.fillText('round ' + Math.min(s.round, s.total) + '/' + s.total, 12, 20);
      g.textAlign = 'right';
      g.fillText('x ' + Math.round(s.x) + '  y ' + Math.round(s.y), W - 12, 20);
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function renderReflexResult(r) {
    var box = $('#reflexResult');
    box.hidden = !r;
    if (!r) return;
    box.innerHTML =
      '<p class="verdict"><span class="pill ' + r.band.tone + '">' + esc(r.band.label) + '</span></p>' +
      '<dl>' +
      row('Median reaction', nn(r.medianRtMs, ' ms')) +
      row('Fastest', nn(r.bestRtMs, ' ms')) +
      row('Spread', nn(r.spreadMs, ' ms')) +
      row('On target', r.hits + ' of ' + r.rounds) +
      row('Wrong direction', String(r.wrongWay)) +
      row('Missed', String(r.misses)) +
      row('False starts', String(r.falseStarts)) +
      row('Mean aim error', nn(r.meanAimErrDeg, '°')) +
      row('Median settle', nn(r.medianAcquireMs, ' ms')) +
      row('Link round trip', nn(r.clockRttMs, ' ms')) +
      row('Taken', fmtDateTime(r.at)) +
      '</dl>';
  }

  /* ── tremor ───────────────────────────────────────────── */
  var tremorTrace = [];

  function bindTremor() {
    $('#tremorStart').onclick = function () {
      var v = currentVisit();
      if (!v) return;
      tremorTrace = [];
      var t = new Tests.TremorTest({
        settings: liveSettings(),
        onTick: function (s) {
          $('#tremorLive').innerHTML = s.rmsMg.toFixed(1) + '<span class="unit">mg</span>';
          $('#tremorRate').textContent = s.rateHz ? s.rateHz + ' Hz' : '—';
          $('#tremorCount').textContent = s.count;
          $('#tremorProgress').style.width = (s.progress * 100).toFixed(0) + '%';
          tremorTrace.push(s.rmsMg);
          if (tremorTrace.length > 600) tremorTrace.shift();
          drawTremorLive();
        },
        onDone: function (r) {
          running.tremor = null;
          v.tremor = r;
          Store.touch(Store.person(sel.personId));
          renderTremorResult(r);
          drawTremorSpectrum(r);
          renderTrend(Store.person(sel.personId));
          tremorIdle();
          toast('Steadiness recorded.');
        },
        onFail: function (msg) { running.tremor = null; tremorIdle(); toast(msg); }
      });
      running.tremor = t;
      $('#tremorStart').hidden = true;
      $('#tremorStop').hidden = false;
      $('#tremorResult').hidden = true;
      t.start();
    };

    $('#tremorStop').onclick = function () {
      if (running.tremor) running.tremor.cancel();
      running.tremor = null;
      tremorIdle();
    };
  }

  function tremorIdle() {
    $('#tremorStart').hidden = false;
    $('#tremorStop').hidden = true;
    $('#tremorProgress').style.width = '0%';
    refreshTestButtons();
  }

  function tctx() {
    var c = $('#tremorCanvas');
    var g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#0f1419';
    g.fillRect(0, 0, c.width, c.height);
    return { c: c, g: g };
  }

  function drawTremorLive() {
    var o = tctx(), g = o.g, W = o.c.width, H = o.c.height;
    var maxv = 20;
    for (var i = 0; i < tremorTrace.length; i++) if (tremorTrace[i] > maxv) maxv = tremorTrace[i];
    g.strokeStyle = '#2c3743';
    g.beginPath(); g.moveTo(0, H - 1); g.lineTo(W, H - 1); g.stroke();
    g.strokeStyle = '#35a0d8';
    g.lineWidth = 1.5;
    g.beginPath();
    for (i = 0; i < tremorTrace.length; i++) {
      var x = (i / Math.max(1, tremorTrace.length - 1)) * W;
      var y = H - 4 - (tremorTrace[i] / maxv) * (H - 14);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#6f8090';
    g.font = '11px ui-monospace, monospace';
    g.fillText(maxv.toFixed(0) + ' mg', 6, 13);
  }

  function drawTremorIdle(r) {
    if (r) return drawTremorSpectrum(r);
    var o = tctx(), g = o.g;
    g.fillStyle = '#3a4653';
    g.font = '12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('waveform appears here during capture', o.c.width / 2, o.c.height / 2);
    g.textAlign = 'left';
  }

  function drawTremorSpectrum(r) {
    var o = tctx(), g = o.g, W = o.c.width, H = o.c.height;
    var sp = r.spectrum || [];
    if (!sp.length) return;
    var maxA = 0.1, i;
    for (i = 0; i < sp.length; i++) if (sp[i].a > maxA) maxA = sp[i].a;
    var fmin = sp[0].f, fmax = sp[sp.length - 1].f;
    var X = function (f) { return 34 + ((f - fmin) / Math.max(0.001, fmax - fmin)) * (W - 44); };

    // the measured band
    g.fillStyle = 'rgba(53,160,216,.12)';
    g.fillRect(X(r.bandLowHz), 4, Math.max(1, X(r.bandHighHz) - X(r.bandLowHz)), H - 22);

    g.strokeStyle = '#2c3743';
    g.beginPath(); g.moveTo(34, H - 17); g.lineTo(W - 6, H - 17); g.stroke();

    g.fillStyle = '#35a0d8';
    for (i = 0; i < sp.length; i++) {
      var x = X(sp[i].f);
      var h = (sp[i].a / maxA) * (H - 26);
      g.fillRect(x, H - 17 - h, Math.max(1, (W - 44) / sp.length - 0.5), h);
    }

    g.fillStyle = '#6f8090';
    g.font = '10px ui-monospace, monospace';
    for (var f = Math.ceil(fmin); f <= fmax; f += 2) {
      g.fillText(f + '', X(f) - 3, H - 5);
    }
    g.fillText(maxA.toFixed(1), 2, 12);
    g.fillText('mg', 2, 24);
    g.textAlign = 'right';
    g.fillText('Hz', W - 6, H - 5);
    g.textAlign = 'left';

    if (r.peakHz) {
      g.strokeStyle = '#e8b13a';
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(X(r.peakHz), 4); g.lineTo(X(r.peakHz), H - 17); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#e8b13a';
      g.fillText(r.peakHz.toFixed(1) + ' Hz', Math.min(W - 60, X(r.peakHz) + 4), 12);
    }
  }

  function renderTremorResult(r) {
    var box = $('#tremorResult');
    box.hidden = !r;
    if (!r) return;
    box.innerHTML =
      '<p class="verdict"><span class="pill ' + r.band.tone + '">' + esc(r.band.label) + '</span></p>' +
      '<dl>' +
      row('Tremor (' + r.bandLowHz + '–' + r.bandHighHz + ' Hz)', r.tremorRmsMg.toFixed(2) + ' mg RMS') +
      row('All movement', r.totalRmsMg.toFixed(2) + ' mg RMS') +
      row('Dominant frequency', nn(r.peakHz, ' Hz')) +
      row('Rotation', r.gyroRmsDps.toFixed(2) + ' °/s RMS') +
      row('Capture', r.seconds + ' s at ' + r.rateHz + ' Hz') +
      row('Samples', r.samples + ' (' + r.gridPoints + ' resampled)') +
      row('Taken', fmtDateTime(r.at)) +
      '</dl>';
  }

  /* ── shared test plumbing ─────────────────────────────── */
  function currentVisit() {
    var p = Store.person(sel.personId);
    return p ? Store.visit(p.id, sel.visitId) : null;
  }

  function liveSettings() {
    return {
      contactMin: Store.num('contactMin'), coreOffset: Store.num('coreOffset'),
      slopeMax: Store.num('slopeMax'), thermoTimeout: Store.num('thermoTimeout'),
      rounds: Store.num('rounds'), deadzone: Store.num('deadzone'),
      commit: Store.num('commit'), holdMs: Store.num('holdMs'),
      tremorSecs: Store.num('tremorSecs'), bandLow: Store.num('bandLow'),
      bandHigh: Store.num('bandHigh')
    };
  }

  function cancelAllTests() {
    ['thermo', 'reflex', 'tremor'].forEach(function (k) {
      if (running[k]) { running[k].cancel(); running[k] = null; }
    });
    thermoIdle(); reflexIdle(); tremorIdle();
  }
  UI.cancelAllTests = cancelAllTests;

  function refreshTestButtons() {
    var m = Link.modules(), open = Link.isOpen(), have = !!currentVisit();
    $('#thermoStart').disabled = !(open && m.T && have) || !!running.thermo;
    $('#reflexStart').disabled = !(open && m.J && have) || !!running.reflex;
    $('#tremorStart').disabled = !(open && m.M && have) || !!running.tremor;
    if (!open) $('#reflexStatus').textContent = 'Connect the joystick to begin.';
  }
  UI.refreshTestButtons = refreshTestButtons;

  /* ── trend ────────────────────────────────────────────── */
  function renderTrend(p) {
    var box = $('#trend');
    box.textContent = '';
    if (!p) return;
    var withData = p.visits.filter(function (v) { return v.thermo || v.reflex || v.tremor; });
    if (!withData.length) {
      box.appendChild(el('p', 'sub', 'No measurements recorded for this person yet.'));
      return;
    }
    var t = el('table', 'trend');
    t.innerHTML = '<thead><tr><th>Appointment</th><th>Core est.</th><th>Reaction</th>' +
      '<th>On target</th><th>Tremor</th><th>Peak</th></tr></thead>';
    var tb = el('tbody');
    withData.forEach(function (v) {
      var tr = el('tr');
      tr.innerHTML =
        '<td class="t">' + esc(fmtDateTime(v.when)) + (v.id === sel.visitId ? ' ←' : '') + '</td>' +
        '<td>' + (v.thermo ? v.thermo.coreEstC.toFixed(2) + ' °C' : '—') + '</td>' +
        '<td>' + (v.reflex ? nn(v.reflex.medianRtMs, ' ms') : '—') + '</td>' +
        '<td>' + (v.reflex ? v.reflex.hits + '/' + v.reflex.rounds : '—') + '</td>' +
        '<td>' + (v.tremor ? v.tremor.tremorRmsMg.toFixed(1) + ' mg' : '—') + '</td>' +
        '<td>' + (v.tremor ? nn(v.tremor.peakHz, ' Hz') : '—') + '</td>';
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.appendChild(t);
  }

  /* ══════════════════ device ══════════════════ */
  var logLines = [];

  function renderDevice() {
    var open = Link.isOpen();
    $('#disconnect').disabled = !open;
    $('#rescan').disabled = !open;
    $('#resync').disabled = !open;
    $('#sendBtn').disabled = !open;
    $('#connectSerial').disabled = open || !Link.serialSupported();
    $('#connectWs').disabled = open;
    $('#serialUnsupported').hidden = Link.serialSupported();
    $('#wsUrl').value = Store.settings().wsUrl || Store.defaults.wsUrl;

    var m = Link.modules();
    [['T', m.T], ['J', m.J], ['M', m.M]].forEach(function (pair) {
      var d = $('#mod' + pair[0]);
      d.className = 'dot ' + (pair[1] ? 'on' : (open ? 'off' : ''));
      $('#mod' + pair[0] + 'v').textContent = open ? (pair[1] ? 'present' : 'not found') : '—';
    });

    var c = Link.clock();
    $('#clockInfo').textContent = isFinite(c.rtt)
      ? 'Best round trip ' + c.rtt.toFixed(1) + ' ms over ' + c.samples +
        ' probes \u2014 that is the uncertainty on a reaction time. The board\u2019s clock ' +
        'reads ' + c.offset.toFixed(0) + ' ms away from this app\u2019s, which is expected ' +
        'and is corrected for.'
      : 'Clock offset not measured.';
  }

  function renderLinkChip() {
    var st = Link.state(), dot = $('#linkDot'), txt = $('#linkText');
    dot.className = 'dot' + (st === 'open' ? ' on' : st === 'opening' || st === 'closing' ? ' busy' : '');
    if (st === 'open') {
      var m = Link.modules();
      var caps = (m.T ? 'T' : '') + (m.J ? 'J' : '') + (m.M ? 'M' : '');
      txt.textContent = (Link.info().fw ? 'InfoDoc fw ' + Link.info().fw : 'Connected') +
                        (caps ? ' · ' + caps : ' · no modules');
    } else if (st === 'opening') txt.textContent = 'Connecting…';
    else if (st === 'closing') txt.textContent = 'Disconnecting…';
    else txt.textContent = 'No device';
  }

  function logPush(text, cls) {
    logLines.push({ t: text, c: cls });
    if (logLines.length > 400) logLines.shift();
    var pre = $('#log');
    var atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30;
    pre.innerHTML = logLines.map(function (l) {
      return l.c ? '<span class="' + l.c + '">' + esc(l.t) + '</span>' : esc(l.t);
    }).join('\n');
    if (atBottom) pre.scrollTop = pre.scrollHeight;
  }
  UI.log = logPush;

  function bindDevice() {
    $('#connectSerial').onclick = function () {
      Link.connectSerial().catch(function (e) {
        if (e && (e.name === 'NotFoundError' || /No port selected/i.test(e.message || ''))) return;
        toast(e.message || String(e));
      });
    };
    $('#connectWs').onclick = function () {
      var url = $('#wsUrl').value.trim();
      Store.setSetting('wsUrl', url);
      Link.connectWs(url).catch(function (e) { toast(e.message || String(e)); });
    };
    $('#disconnect').onclick = function () { cancelAllTests(); Link.disconnect(); };
    $('#rescan').onclick = function () { Link.rescan(); };
    $('#resync').onclick = function () { Link.syncClock(); toast('Re-measuring the clock offset…'); };
    $('#sendBtn').onclick = sendRaw;
    $('#sendLine').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendRaw(); });
    $('#clearLog').onclick = function () { logLines = []; $('#log').textContent = ''; };
    $('#linkChip').onclick = function () { show('device'); };

    function sendRaw() {
      var v = $('#sendLine').value.trim();
      if (!v) return;
      Link.send(v);
      $('#sendLine').value = '';
    }
  }

  /* ══════════════════ settings ══════════════════ */
  var SETTING_FIELDS = {
    '#setClinic': 'clinic', '#setOperator': 'operator',
    '#setContactMin': 'contactMin', '#setCoreOffset': 'coreOffset',
    '#setSlopeMax': 'slopeMax', '#setThermoTimeout': 'thermoTimeout',
    '#setRounds': 'rounds', '#setDeadzone': 'deadzone',
    '#setCommit': 'commit', '#setHold': 'holdMs',
    '#setTremorSecs': 'tremorSecs', '#setBandLow': 'bandLow', '#setBandHigh': 'bandHigh'
  };

  function renderSettings() {
    var s = Store.settings();
    Object.keys(SETTING_FIELDS).forEach(function (id) {
      $(id).value = s[SETTING_FIELDS[id]];
    });
    Store.where().then(function (w) {
      $('#storageWhere').textContent = 'Records are stored in ' + w + '.' +
        (Store.backend === 'localStorage'
          ? ' Clearing the browser’s site data would delete them — export a copy.'
          : '');
    });
    $('#aboutText').textContent = 'InfoDoc ' + (global.INFODOC_VERSION || 'dev') +
      ' · protocol v' + Link.PROTO + ' · storage: ' + Store.backend +
      (global.infodocNative ? ' · desktop shell' : ' · browser');
  }

  function bindSettings() {
    Object.keys(SETTING_FIELDS).forEach(function (id) {
      $(id).addEventListener('change', function () {
        var key = SETTING_FIELDS[id];
        var raw = $(id).value;
        if (typeof Store.defaults[key] === 'number') {
          var v = parseFloat(raw);
          if (!isFinite(v)) { $(id).value = Store.settings()[key]; toast('That needs to be a number.'); return; }
          Store.setSetting(key, v);
        } else {
          Store.setSetting(key, raw);
        }
      });
    });

    $('#exportJson').onclick = function () {
      var text = Store.exportText();
      var name = 'infodoc-records-' + new Date().toISOString().slice(0, 10) + '.json';
      if (global.infodocNative && global.infodocNative.saveAs) {
        global.infodocNative.saveAs(name, text).then(function (where) {
          if (where) toast('Exported to ' + where);
        }, function (e) { toast('Export failed: ' + e.message); });
      } else {
        var blob = new Blob([text], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        toast('Exported ' + name);
      }
    };

    $('#importJson').onclick = function () {
      if (global.infodocNative && global.infodocNative.openFile) {
        global.infodocNative.openFile().then(function (text) {
          if (text) doImport(text);
        }, function (e) { toast('Import failed: ' + e.message); });
      } else {
        $('#importFile').click();
      }
    };

    $('#importFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { doImport(String(fr.result)); };
      fr.readAsText(f);
      this.value = '';
    });

    $('#wipe').onclick = function () {
      if (!confirm('Erase every record and reset the settings? This cannot be undone.')) return;
      if (!confirm('Really erase all ' + Store.people().length + ' record(s)?')) return;
      Store.wipe();
      sel.personId = null;
      sel.visitId = null;
      renderPeople(); renderPerson(); renderSettings();
      toast('Everything erased.');
    };
  }

  function doImport(text) {
    var replace = confirm('Replace everything currently stored?\n\n' +
      'OK = replace all records.\nCancel = merge, keeping whichever copy of a record is newer.');
    try {
      var n = Store.importText(text, replace ? 'replace' : 'merge');
      sel.personId = null; sel.visitId = null;
      renderPeople(); renderPerson(); renderSettings();
      toast('Imported ' + n + ' record(s).');
    } catch (e) {
      toast('That file is not an InfoDoc export: ' + e.message);
    }
  }

  /* ══════════════════ printing ══════════════════ */
  function head(title, sub) {
    var s = Store.settings();
    return '<h1>' + esc(title) + '</h1><p class="hdr">' +
      esc([s.clinic, s.operator].filter(Boolean).join(' · ') || 'InfoDoc') +
      ' · printed ' + esc(new Date().toLocaleString()) +
      (sub ? '<br>' + esc(sub) : '') + '</p>';
  }

  function table(rows) {
    return '<table>' + rows.map(function (r) {
      return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1] === '' || r[1] === null || r[1] === undefined ? '—' : r[1]) + '</td></tr>';
    }).join('') + '</table>';
  }

  var FOOT = '<p class="foot">Produced by InfoDoc, which is not a medical device. The ' +
    'temperature figure is a contact skin reading with a fixed offset applied, not a clinical ' +
    'thermometer measurement. The reflex and steadiness figures are screening aids only and ' +
    'carry no diagnostic meaning on their own.</p>';

  function emit(html) {
    $('#print-area').innerHTML = html;
    global.print();
  }

  function printPerson(p) {
    if (!p) return;
    var age = Store.age(p.dob);
    var html = head(p.name || '(no name)', 'Full record') +
      '<h2>Identity</h2>' + table([
        ['Clinic ID', p.chartId], ['Date of birth', p.dob],
        ['Age', age === null ? '' : age + ' years'], ['Sex', p.sex], ['Pronouns', p.pronouns]
      ]) +
      '<h2>Contact</h2>' + table([
        ['Phone', p.phone], ['Email', p.email], ['Address', p.address],
        ['Next of kin', p.kin], ['Kin phone', p.kinPhone]
      ]) +
      '<h2>Clinical background</h2>' + table([
        ['Allergies', p.allergies], ['Medication', p.medication],
        ['Conditions', p.conditions], ['Notes', p.notes]
      ]) +
      '<h2>Appointments</h2>';

    if (!p.visits.length) html += '<p>None booked.</p>';
    p.visits.forEach(function (v) {
      html += table([
        ['Appointment', fmtDateTime(v.when)],
        ['Status', v.status],
        ['Reason', v.reason],
        ['Clinician', [v.clinician, v.dept].filter(Boolean).join(', ')],
        ['Core temp (est.)', v.thermo ? v.thermo.coreEstC.toFixed(2) + ' °C (skin ' + v.thermo.skinC.toFixed(2) + ' °C) — ' + v.thermo.band.label : ''],
        ['Reaction', v.reflex ? nn(v.reflex.medianRtMs, ' ms median, ') + v.reflex.hits + '/' + v.reflex.rounds + ' on target — ' + v.reflex.band.label : ''],
        ['Steadiness', v.tremor ? v.tremor.tremorRmsMg.toFixed(2) + ' mg RMS at ' + nn(v.tremor.peakHz, ' Hz') + ' — ' + v.tremor.band.label : ''],
        ['Notes', v.notes]
      ]);
    });
    emit(html + FOOT);
  }

  function printVisit(p, v) {
    if (!p || !v) return;
    var age = Store.age(p.dob, v.when);
    var html = head(p.name || '(no name)', 'Appointment summary — ' + fmtDateTime(v.when)) +
      '<h2>Patient</h2>' + table([
        ['Clinic ID', p.chartId], ['Date of birth', p.dob],
        ['Age at appointment', age === null ? '' : age + ' years'],
        ['Sex', p.sex], ['Phone', p.phone],
        ['Allergies', p.allergies || 'none recorded'], ['Medication', p.medication]
      ]) +
      '<h2>Appointment</h2>' + table([
        ['When', fmtDateTime(v.when)], ['Status', v.status],
        ['Clinician', v.clinician], ['Department', v.dept],
        ['Reason', v.reason]
      ]) +
      '<h2>Observations</h2>' + table([
        ['Weight', v.obs.weight ? v.obs.weight + ' kg' : ''],
        ['Height', v.obs.height ? v.obs.height + ' cm' : ''],
        ['Blood pressure', v.obs.bp], ['Pulse', v.obs.pulse ? v.obs.pulse + ' bpm' : ''],
        ['SpO2', v.obs.spo2 ? v.obs.spo2 + ' %' : ''], ['Respiratory rate', v.obs.resp]
      ]);

    html += '<h2>Forehead temperature (Modulino Thermo)</h2>';
    html += v.thermo ? table([
      ['Skin, measured', v.thermo.skinC.toFixed(2) + ' °C'],
      ['Core, estimated', v.thermo.coreEstC.toFixed(2) + ' °C'],
      ['Offset applied', '+' + Number(v.thermo.coreOffset).toFixed(2) + ' °C'],
      ['Reading settled', v.thermo.settled ? 'yes, after ' + v.thermo.settleSecs + ' s' : 'no — timed out'],
      ['Room humidity', nn(v.thermo.rh, ' %')],
      ['Interpretation', v.thermo.band.label]
    ]) : '<p>Not measured.</p>';

    html += '<h2>Reflex and aiming (Modulino Joystick)</h2>';
    html += v.reflex ? table([
      ['Median reaction time', nn(v.reflex.medianRtMs, ' ms')],
      ['Fastest', nn(v.reflex.bestRtMs, ' ms')],
      ['Spread', nn(v.reflex.spreadMs, ' ms')],
      ['On target', v.reflex.hits + ' of ' + v.reflex.rounds],
      ['Wrong direction / missed', v.reflex.wrongWay + ' / ' + v.reflex.misses],
      ['False starts', v.reflex.falseStarts],
      ['Mean aim error', nn(v.reflex.meanAimErrDeg, '°')],
      ['Interpretation', v.reflex.band.label]
    ]) : '<p>Not measured.</p>';

    html += '<h2>Hand steadiness (Modulino Movement)</h2>';
    html += v.tremor ? table([
      ['Tremor band', v.tremor.bandLowHz + '–' + v.tremor.bandHighHz + ' Hz'],
      ['Tremor amplitude', v.tremor.tremorRmsMg.toFixed(2) + ' mg RMS'],
      ['All movement', v.tremor.totalRmsMg.toFixed(2) + ' mg RMS'],
      ['Dominant frequency', nn(v.tremor.peakHz, ' Hz')],
      ['Rotation', v.tremor.gyroRmsDps.toFixed(2) + ' °/s RMS'],
      ['Capture', v.tremor.seconds + ' s at ' + v.tremor.rateHz + ' Hz'],
      ['Interpretation', v.tremor.band.label]
    ]) : '<p>Not measured.</p>';

    if (v.notes) html += '<h2>Clinical notes</h2><p>' + esc(v.notes).replace(/\n/g, '<br>') + '</p>';

    emit(html + FOOT);
  }

  /* ══════════════════ boot ══════════════════ */
  UI.init = function () {
    $$('.tab').forEach(function (b) { b.onclick = function () { show(b.dataset.view); }; });
    bindPersonForm();
    bindVisitForm();
    bindThermo();
    bindReflex();
    bindTremor();
    bindDevice();
    bindSettings();

    $('#newVisitWhen').value = Store.localIso();

    Store.on(function (what) {
      if (what === 'load') { renderPeople(); renderPerson(); }
      // the list is cheap and has no focus in it, so keep it in step with the
      // store however a person was added or removed. The person form is left
      // alone: re-rendering it under the cursor would fight with typing.
      if (what === 'people') renderPeople();
      if (what === 'error') { var e = Store.lastError(); if (e) toast(e); }
    });

    Link.on('state', function (ev) {
      // a pulled cable is not a measurement; abandon whatever was running
      if (ev && ev.state === 'idle') cancelAllTests();
      renderLinkChip(); renderDevice(); refreshTestButtons();
    });
    Link.on('modules', function () { renderLinkChip(); renderDevice(); refreshTestButtons(); });
    Link.on('hello', function () { renderLinkChip(); renderDevice(); });
    Link.on('clock', function () { renderDevice(); });
    Link.on('warn', function (m) { toast(m); logPush('! ' + m, 'er'); });
    Link.on('deverror', function (m) { toast('Device: ' + m); });
    Link.on('raw', function (line, isStream, isErr, isTx) {
      if (isStream && !$('#logStreams').checked) return;
      logPush((isTx ? '> ' : '< ') + line, isErr ? 'er' : (isTx ? 'tx' : ''));
    });

    renderPeople();
    renderPerson();
    renderLinkChip();
    renderDevice();
    drawReflex(null);
    drawTremorIdle(null);

    global.addEventListener('beforeunload', function () { Store.flush(); });
  };

  /* A small read-only window onto what the app is currently seeing. Support
   * uses it to answer “what does the joystick report right now?”, and
   * src/verify.py drives the tests through it. Nothing here mutates state. */
  global.InfoDocDebug = {
    reflex: function () { return running.reflex ? running.reflex.state() : null; },
    busy: function () {
      return { thermo: !!running.thermo, reflex: !!running.reflex, tremor: !!running.tremor };
    },
    selection: function () { return { personId: sel.personId, visitId: sel.visitId }; },
    visit: function () { return currentVisit(); },
    link: function () {
      return { state: Link.state(), modules: Link.modules(), clock: Link.clock(), info: Link.info() };
    }
  };

  global.UI = UI;
})(window);
