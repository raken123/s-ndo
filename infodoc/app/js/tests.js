/* tests.js — the three measurements.
 *
 * Every test is a small object with start(), cancel() and callbacks. None of
 * them touch the DOM; the UI subscribes and draws. All timing is in device
 * milliseconds so that USB scheduling jitter does not land in a reaction time.
 */
(function (global) {
  'use strict';

  var Link = global.Link;

  function median(a) {
    if (!a.length) return NaN;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) {
    if (!a.length) return NaN;
    var t = 0;
    for (var i = 0; i < a.length; i++) t += a[i];
    return t / a.length;
  }

  /* ══════════════════ 1. forehead temperature ══════════════════
   * The Modulino Thermo is a contact sensor (HS3003), not an infrared
   * thermometer, so a reading is a settle: the node warms towards skin
   * temperature and we take the value once the drift flattens off.
   */
  function ThermoTest(opts) {
    var s = opts.settings;
    var self = this;
    var release = null;
    var win = [];              // { t, v } over the slope window
    var all = [];
    var t0 = 0;
    var contactSince = 0;
    var done = false;
    var WINDOW_MS = 3000;

    this.onTick = opts.onTick || function () {};
    this.onDone = opts.onDone || function () {};
    this.onFail = opts.onFail || function () {};

    function slope() {
      // least squares gradient in °C per second
      if (win.length < 6) return NaN;
      var n = win.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (var i = 0; i < n; i++) {
        var x = (win[i].t - win[0].t) / 1000, y = win[i].v;
        sx += x; sy += y; sxx += x * x; sxy += x * y;
      }
      var d = n * sxx - sx * sx;
      if (Math.abs(d) < 1e-9) return NaN;
      return (n * sxy - sx * sy) / d;
    }

    function spread() {
      var lo = Infinity, hi = -Infinity;
      for (var i = 0; i < win.length; i++) {
        if (win[i].v < lo) lo = win[i].v;
        if (win[i].v > hi) hi = win[i].v;
      }
      return hi - lo;
    }

    function sample(m) {
      if (done) return;
      if (!t0) t0 = m.t;
      all.push(m);
      win.push({ t: m.t, v: m.tempC });
      while (win.length > 2 && m.t - win[0].t > WINDOW_MS) win.shift();

      var contact = m.tempC >= s.contactMin;
      if (!contact) { contactSince = 0; }
      else if (!contactSince) { contactSince = m.t; }

      var g = slope();
      var held = contactSince ? m.t - contactSince : 0;
      var settled = contact && held >= WINDOW_MS && isFinite(g) &&
                    Math.abs(g) <= s.slopeMax && spread() <= 0.2;

      // progress: how much of the settle window is banked
      var prog = contact ? Math.min(1, held / WINDOW_MS) : 0;

      self.onTick({
        tempC: m.tempC, rh: m.rh, contact: contact,
        slope: g, elapsed: (m.t - t0) / 1000, progress: prog, settled: settled
      });

      if (settled) return finish(m, true);

      if ((m.t - t0) / 1000 >= s.thermoTimeout) {
        if (contact && held >= 1500) return finish(m, false);
        stop();
        self.onFail(contact
          ? 'The reading never settled. Press the node flat and still against the skin.'
          : 'No skin contact detected — the reading stayed below ' + s.contactMin + ' °C.');
      }
    }

    function finish(m, settled) {
      // average the tail of the settle window rather than trusting one sample
      var tail = win.slice(-8).map(function (w) { return w.v; });
      var skin = mean(tail);
      stop();
      self.onDone({
        at: new Date().toISOString(),
        skinC: round(skin, 2),
        coreEstC: round(skin + Number(s.coreOffset), 2),
        coreOffset: Number(s.coreOffset),
        rh: round(m.rh, 1),
        settled: settled,
        settleSecs: round((m.t - t0) / 1000, 1),
        driftCPerS: isFinite(slope()) ? round(slope(), 4) : null,
        samples: all.length,
        band: thermoBand(skin + Number(s.coreOffset))
      });
    }

    function stop() {
      done = true;
      Link.off('thermo', sample);
      if (release) { release(); release = null; }
    }

    this.start = function () {
      if (!Link.isOpen()) return self.onFail('No device connected.');
      if (!Link.modules().T) return self.onFail('The Modulino Thermo was not found on the bus.');
      done = false; win = []; all = []; t0 = 0; contactSince = 0;
      Link.on('thermo', sample);
      release = Link.claim('T');
      Link.send('RATE T 5');
    };

    this.cancel = function () { stop(); };
  }

  function thermoBand(coreEst) {
    if (coreEst >= 38.0) return { key: 'high', label: 'Fever range', tone: 'bad' };
    if (coreEst >= 37.5) return { key: 'raised', label: 'Slightly raised', tone: 'warn' };
    if (coreEst < 35.5) return { key: 'low', label: 'Below normal', tone: 'warn' };
    return { key: 'normal', label: 'Within normal range', tone: 'good' };
  }

  /* ══════════════════ 2. reflex and aiming ══════════════════
   * A green box lights in one of eight cells around the middle; the patient
   * pushes the joystick at it. Reaction time is the first sample past the dead
   * zone, direction is taken where the push passes the commit threshold, and
   * the round only counts as acquired once the aim is held.
   */
  function ReflexTest(opts) {
    var s = opts.settings;
    var self = this;
    var release = null;
    var rounds = [];
    var phase = 'idle';      // centering | delay | go | between | idle
    var live = { x: 0, y: 0, btn: false, t: 0 };
    var centeredSince = 0;
    var goDeviceMs = 0;
    var goHostMs = 0;
    var target = 4;
    var cur = null;
    var timer = null;
    var total = Math.max(1, Math.min(30, Math.round(s.rounds)));
    var seq = 0;              // guards a timer left over from an abandoned round

    var CELLS = [0, 1, 2, 3, 5, 6, 7, 8];   // the middle cell is home
    var TOL = 22.5;                          // half of 45°, so eight clean directions
    var ROUND_TIMEOUT = 3000;

    this.onFrame = opts.onFrame || function () {};
    this.onStatus = opts.onStatus || function () {};
    this.onDone = opts.onDone || function () {};
    this.onFail = opts.onFail || function () {};

    function cellAngle(cell) {
      var dx = (cell % 3) - 1, dy = Math.floor(cell / 3) - 1;
      return Math.atan2(-dy, dx) * 180 / Math.PI;   // screen y grows downwards
    }
    function angDiff(a, b) {
      var d = ((a - b) % 360 + 540) % 360 - 180;
      return Math.abs(d);
    }
    function mag(p) { return Math.sqrt(p.x * p.x + p.y * p.y); }

    function state() {
      return {
        phase: phase, x: live.x, y: live.y, btn: live.btn,
        target: phase === 'go' ? target : -1,
        round: rounds.length + 1, total: total,
        deadzone: s.deadzone, commit: s.commit,
        lit: phase === 'go', last: rounds.length ? rounds[rounds.length - 1] : null
      };
    }

    function sample(m) {
      if (phase === 'idle') return;
      live = m;

      var mg = mag(m);

      if (phase === 'centering') {
        if (mg < s.deadzone) {
          if (!centeredSince) centeredSince = m.t;
          if (m.t - centeredSince >= 300) beginRound();
        } else {
          centeredSince = 0;
          self.onStatus('Let the joystick spring back to the middle.');
        }
      } else if (phase === 'delay') {
        if (mg > s.deadzone) {
          // moved before the box lit
          clearTimeout(timer);
          falseStart('moved before the box lit');
        }
      } else if (phase === 'go') {
        if (m.t < goDeviceMs) return;     // sampled before the box lit; in flight
        var dt = m.t - goDeviceMs;

        if (cur.rt === null && mg > s.deadzone) {
          if (dt < 100) { falseStart('moved within 100 ms — a guess, not a reaction'); return; }
          cur.rt = dt;
        }
        if (cur.rt !== null && cur.err === null && mg >= s.commit) {
          cur.err = angDiff(Math.atan2(m.y, m.x) * 180 / Math.PI, cellAngle(target));
          cur.commitMs = dt;
          cur.hit = cur.err <= TOL;
        }
        if (cur.err !== null) {
          var onTarget = mg >= s.commit &&
            angDiff(Math.atan2(m.y, m.x) * 180 / Math.PI, cellAngle(target)) <= TOL;
          if (onTarget) {
            if (!cur._holdFrom) cur._holdFrom = m.t;
            if (m.t - cur._holdFrom >= s.holdMs) { cur.acquireMs = dt; return endRound(); }
          } else {
            cur._holdFrom = 0;
          }
        }
        if (dt > ROUND_TIMEOUT) { cur.timedOut = true; endRound(); }
      }

      self.onFrame(state());
    }

    function beginRound() {
      phase = 'delay';
      seq++;
      centeredSince = 0;
      target = CELLS[Math.floor(Math.random() * CELLS.length)];
      cur = {
        n: rounds.length + 1, target: target, rt: null, err: null,
        commitMs: null, acquireMs: null, hit: false, timedOut: false,
        falseStart: false, _holdFrom: 0
      };
      self.onStatus('Wait for the green box…');
      self.onFrame(state());
      var mine = seq;
      timer = setTimeout(function () {
        if (mine !== seq || phase !== 'delay') return;
        phase = 'go';
        goHostMs = Link.now();
        goDeviceMs = Link.toDevice(goHostMs);
        self.onStatus('Now! Push at the green box.');
        self.onFrame(state());
        // a safety net in case the joystick stream dies mid-round
        timer = setTimeout(function () {
          if (mine !== seq || phase !== 'go') return;
          cur.timedOut = true;
          endRound();
        }, ROUND_TIMEOUT + 800);
      }, 700 + Math.random() * 1500);
    }

    function falseStart(why) {
      clearTimeout(timer);
      seq++;
      cur.falseStart = true;
      cur.why = why;
      rounds.push(cur);
      // the round is replaced rather than scored; nextOrFinish caps the retries
      self.onStatus('False start — ' + why + '. Going again.');
      nextOrFinish(true);
    }

    function endRound() {
      clearTimeout(timer);
      seq++;
      delete cur._holdFrom;
      rounds.push(cur);
      self.onStatus(cur.timedOut ? 'Missed that one.'
        : (cur.hit ? 'Hit — ' + Math.round(cur.rt) + ' ms.' : 'Wrong way — ' + Math.round(cur.err) + '° off.'));
      nextOrFinish(false);
    }

    function nextOrFinish(wasFalse) {
      var real = rounds.filter(function (r) { return !r.falseStart; }).length;
      phase = 'between';
      self.onFrame(state());
      if (real >= total || rounds.length >= total * 2) return finish();
      timer = setTimeout(function () {
        if (phase === 'idle') return;
        phase = 'centering';
        centeredSince = 0;
        self.onStatus('Back to the middle…');
        self.onFrame(state());
      }, wasFalse ? 900 : 650);
    }

    function finish() {
      phase = 'idle';
      stop();
      var real = rounds.filter(function (r) { return !r.falseStart; });
      var hits = real.filter(function (r) { return r.hit; });
      var rts = hits.map(function (r) { return r.rt; });
      var errs = real.filter(function (r) { return r.err !== null; }).map(function (r) { return r.err; });
      var acq = hits.filter(function (r) { return r.acquireMs !== null; }).map(function (r) { return r.acquireMs; });

      var res = {
        at: new Date().toISOString(),
        rounds: real.length,
        hits: hits.length,
        misses: real.filter(function (r) { return r.timedOut; }).length,
        wrongWay: real.filter(function (r) { return r.err !== null && !r.hit; }).length,
        falseStarts: rounds.length - real.length,
        medianRtMs: rts.length ? Math.round(median(rts)) : null,
        bestRtMs: rts.length ? Math.round(Math.min.apply(null, rts)) : null,
        spreadMs: rts.length > 1 ? Math.round(Math.max.apply(null, rts) - Math.min.apply(null, rts)) : null,
        meanAimErrDeg: errs.length ? round(mean(errs), 1) : null,
        medianAcquireMs: acq.length ? Math.round(median(acq)) : null,
        clockRttMs: isFinite(Link.clock().rtt) ? round(Link.clock().rtt, 1) : null,
        detail: real.map(function (r) {
          return { n: r.n, target: r.target, rt: r.rt === null ? null : Math.round(r.rt),
                   err: r.err === null ? null : round(r.err, 1), hit: r.hit, timedOut: r.timedOut };
        })
      };
      res.band = reflexBand(res);
      self.onDone(res);
    }

    function stop() {
      phase = 'idle';
      seq++;
      clearTimeout(timer);
      Link.off('joy', sample);
      if (release) { release(); release = null; }
    }

    this.start = function () {
      if (!Link.isOpen()) return self.onFail('No device connected.');
      if (!Link.modules().J) return self.onFail('The Modulino Joystick was not found on the bus.');
      rounds = []; phase = 'centering'; centeredSince = 0;
      Link.on('joy', sample);
      release = Link.claim('J');
      Link.send('RATE J 100');
      self.onStatus('Hold the joystick in the middle to begin.');
      self.onFrame(state());
    };

    this.cancel = function () { stop(); self.onFrame(state()); };
    this.state = state;
  }

  function reflexBand(r) {
    if (r.medianRtMs === null) return { key: 'none', label: 'No valid rounds', tone: 'bad' };
    var slow = r.medianRtMs;
    var accuracy = r.rounds ? r.hits / r.rounds : 0;
    if (accuracy < 0.6) return { key: 'inaccurate', label: 'Aim unreliable', tone: 'warn' };
    if (slow <= 320) return { key: 'brisk', label: 'Brisk', tone: 'good' };
    if (slow <= 450) return { key: 'normal', label: 'Unremarkable', tone: 'good' };
    if (slow <= 650) return { key: 'slow', label: 'Slower than typical', tone: 'warn' };
    return { key: 'verySlow', label: 'Markedly slow', tone: 'bad' };
  }

  /* ══════════════════ 3. hand steadiness ══════════════════
   * The accelerometer rides on the back of the hand. Gravity and posture are
   * removed by taking the deviation of the acceleration magnitude from its own
   * mean, and the tremor band is extracted with a DFT, using Parseval so the
   * answer comes back as an honest RMS in milli-g.
   */
  function TremorTest(opts) {
    var s = opts.settings;
    var self = this;
    var release = null;
    var samples = [];
    var t0 = 0;
    var running = false;
    var secs = Math.max(3, Math.min(60, Math.round(s.tremorSecs)));

    this.onTick = opts.onTick || function () {};
    this.onDone = opts.onDone || function () {};
    this.onFail = opts.onFail || function () {};

    function sample(m) {
      if (!running) return;
      if (!t0) t0 = m.t;
      samples.push(m);
      var el = (m.t - t0) / 1000;

      // live figure: deviation of |a| from the running mean of the last second
      var win = [], i;
      for (i = samples.length - 1; i >= 0 && m.t - samples[i].t <= 1000; i--) {
        win.push(Math.sqrt(samples[i].ax * samples[i].ax + samples[i].ay * samples[i].ay +
                           samples[i].az * samples[i].az));
      }
      var mu = mean(win), acc = 0;
      for (i = 0; i < win.length; i++) acc += (win[i] - mu) * (win[i] - mu);
      var rms = win.length > 1 ? Math.sqrt(acc / win.length) * 1000 : 0;

      self.onTick({
        elapsed: el, progress: Math.min(1, el / secs), rmsMg: rms,
        count: samples.length,
        rateHz: samples.length > 10 ? round(1000 / medianDt(samples), 1) : null
      });

      if (el >= secs) finish();
    }

    function medianDt(a) {
      var d = [];
      for (var i = 1; i < a.length; i++) {
        var dt = a[i].t - a[i - 1].t;
        if (dt > 0 && dt < 500) d.push(dt);
      }
      return d.length ? median(d) : 10;
    }

    function finish() {
      running = false;
      stop();
      if (samples.length < 64) {
        return self.onFail('Only ' + samples.length + ' samples arrived — not enough to measure.');
      }
      self.onDone(analyse(samples, s, secs));
    }

    function stop() {
      running = false;
      Link.off('move', sample);
      if (release) { release(); release = null; }
    }

    this.start = function () {
      if (!Link.isOpen()) return self.onFail('No device connected.');
      if (!Link.modules().M) return self.onFail('The Modulino Movement was not found on the bus.');
      samples = []; t0 = 0; running = true;
      Link.on('move', sample);
      release = Link.claim('M');
      Link.send('RATE M 100');
    };

    this.cancel = function () { stop(); };
    this.seconds = function () { return secs; };
  }

  /* resample onto an even grid, then band-limit with a DFT */
  function analyse(samples, s, secs) {
    var dtMs = [];
    for (var i = 1; i < samples.length; i++) {
      var d = samples[i].t - samples[i - 1].t;
      if (d > 0 && d < 500) dtMs.push(d);
    }
    var dt = dtMs.length ? median(dtMs) : 10;
    var fs = 1000 / dt;

    var span = samples[samples.length - 1].t - samples[0].t;
    var n = Math.max(64, Math.floor(span / dt));
    var t0 = samples[0].t;

    // linear interpolation onto the grid
    var accMag = new Float64Array(n);
    var gyroMag = new Float64Array(n);
    var k = 0;
    for (i = 0; i < n; i++) {
      var want = t0 + i * dt;
      while (k < samples.length - 2 && samples[k + 1].t < want) k++;
      var a = samples[k], b = samples[Math.min(k + 1, samples.length - 1)];
      var f = b.t > a.t ? (want - a.t) / (b.t - a.t) : 0;
      f = f < 0 ? 0 : (f > 1 ? 1 : f);
      var ax = a.ax + (b.ax - a.ax) * f, ay = a.ay + (b.ay - a.ay) * f, az = a.az + (b.az - a.az) * f;
      var gx = a.gx + (b.gx - a.gx) * f, gy = a.gy + (b.gy - a.gy) * f, gz = a.gz + (b.gz - a.gz) * f;
      accMag[i] = Math.sqrt(ax * ax + ay * ay + az * az) * 1000;   // mg
      gyroMag[i] = Math.sqrt(gx * gx + gy * gy + gz * gz);         // dps
    }

    // detrend: remove mean and linear drift (posture sag over the capture)
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (i = 0; i < n; i++) { sx += i; sy += accMag[i]; sxx += i * i; sxy += i * accMag[i]; }
    var den = n * sxx - sx * sx;
    var slope = Math.abs(den) > 1e-9 ? (n * sxy - sx * sy) / den : 0;
    var icpt = (sy - slope * sx) / n;
    var x = new Float64Array(n);
    for (i = 0; i < n; i++) x[i] = accMag[i] - (icpt + slope * i);

    var totalRms = Math.sqrt(dot(x, x) / n);

    // Hann window, and its power factor so Parseval still gives an RMS
    var w = new Float64Array(n), wpow = 0;
    for (i = 0; i < n; i++) { w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); wpow += w[i] * w[i]; }
    wpow /= n;
    var xw = new Float64Array(n);
    for (i = 0; i < n; i++) xw[i] = x[i] * w[i];

    var df = fs / n;
    var loBin = Math.max(1, Math.ceil(s.bandLow / df));
    var hiBin = Math.min(Math.floor(n / 2) - 1, Math.floor(s.bandHigh / df));
    var scanLo = Math.max(1, Math.ceil(1.0 / df));
    var scanHi = Math.min(Math.floor(n / 2) - 1, Math.floor(Math.min(16, fs / 2 - 1) / df));

    var bandPower = 0, peak = -1, peakBin = -1, spectrum = [];
    for (var bin = scanLo; bin <= scanHi; bin++) {
      var re = 0, im = 0, wq = 2 * Math.PI * bin / n;
      for (i = 0; i < n; i++) {
        re += xw[i] * Math.cos(wq * i);
        im -= xw[i] * Math.sin(wq * i);
      }
      var p2 = re * re + im * im;
      if (bin >= loBin && bin <= hiBin) bandPower += 2 * p2 / (n * n);
      // amplitude of a sinusoid at this bin, for the plot
      spectrum.push({ f: round(bin * df, 2), a: round(2 * Math.sqrt(p2) / (n * 0.5), 3) });
      if (p2 > peak) { peak = p2; peakBin = bin; }
    }
    var bandRms = Math.sqrt(Math.max(0, bandPower) / wpow);

    var gm = mean(Array.prototype.slice.call(gyroMag));
    var gAcc = 0;
    for (i = 0; i < n; i++) gAcc += (gyroMag[i] - gm) * (gyroMag[i] - gm);
    var gyroRms = Math.sqrt(gAcc / n);

    return {
      at: new Date().toISOString(),
      seconds: round(span / 1000, 1),
      requestedSeconds: secs,
      rateHz: round(fs, 1),
      samples: samples.length,
      gridPoints: n,
      bandLowHz: Number(s.bandLow),
      bandHighHz: Number(s.bandHigh),
      tremorRmsMg: round(bandRms, 2),
      totalRmsMg: round(totalRms, 2),
      peakHz: peakBin > 0 ? round(peakBin * df, 2) : null,
      gyroRmsDps: round(gyroRms, 2),
      spectrum: spectrum,
      band: tremorBand(bandRms)
    };
  }

  function dot(a, b) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i] * b[i]; return t; }

  function tremorBand(mg) {
    if (mg < 8) return { key: 'verySteady', label: 'Very steady', tone: 'good' };
    if (mg < 20) return { key: 'steady', label: 'Steady', tone: 'good' };
    if (mg < 45) return { key: 'someTremor', label: 'Some tremor', tone: 'warn' };
    if (mg < 90) return { key: 'marked', label: 'Marked tremor', tone: 'bad' };
    return { key: 'veryMarked', label: 'Very marked tremor', tone: 'bad' };
  }

  function round(v, d) {
    if (!isFinite(v)) return null;
    var m = Math.pow(10, d);
    return Math.round(v * m) / m;
  }

  global.Tests = {
    ThermoTest: ThermoTest,
    ReflexTest: ReflexTest,
    TremorTest: TremorTest,
    median: median,
    mean: mean,
    round: round,
    analyseMovement: analyse
  };
})(window);
