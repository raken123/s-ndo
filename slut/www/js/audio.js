// Allt ljud skapas i realtid med Web Audio – inga ljudfiler behövs.
(function () {
  'use strict';
  const SK = window.SK;

  let ac = null, master, musicBus, sfxBus, verbIn, noiseBuf;
  let current = null, currentName = null, wanted = null;
  let heartTimer = null, heartBpm = 0;

  const A = (SK.audio = {
    ready: false,
    vol: SK.store.get('vol', 0.85),
    musicVol: SK.store.get('musicVol', 0.6),
    sfxVol: SK.store.get('sfxVol', 0.9),
  });

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function impulse(sec, decay) {
    const rate = ac.sampleRate, len = Math.floor(rate * sec);
    const buf = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  A.init = function () {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try { ac = new C(); } catch (e) { return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ac.createGain();
    master.gain.value = A.vol;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = A.musicVol; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    const verb = ac.createConvolver(); verb.buffer = impulse(3, 2.4);
    const vg = ac.createGain(); vg.gain.value = 0.42;
    verb.connect(vg); vg.connect(master);
    verbIn = verb;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    if (wanted) { const w = wanted; wanted = null; A.music(w); }
    if (heartBpm) A.heart(heartBpm);
  };

  A.setVolumes = function (v, m, s) {
    if (v != null) A.vol = v;
    if (m != null) A.musicVol = m;
    if (s != null) A.sfxVol = s;
    SK.store.set('vol', A.vol); SK.store.set('musicVol', A.musicVol); SK.store.set('sfxVol', A.sfxVol);
    if (!ac) return;
    master.gain.setTargetAtTime(A.vol, ac.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(A.musicVol, ac.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(A.sfxVol, ac.currentTime, 0.05);
  };

  A.suspend = function () { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); };
  A.resume = function () { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); };

  // ---------- byggstenar ----------
  function env(g, t0, a, hold, rel, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.setValueAtTime(peak, t0 + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + rel);
  }

  function tone(o) {
    if (!ac) return;
    const t0 = o.t0 != null ? o.t0 : ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || o.dur || 0.3));
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain();
    const a = o.a != null ? o.a : 0.005, hold = o.hold || 0, rel = o.rel != null ? o.rel : 0.3;
    env(g, t0, a, hold, rel, o.vol != null ? o.vol : 0.2);
    let node = osc;
    if (o.lp || o.bp || o.hp) {
      const f = ac.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass';
      f.frequency.value = o.lp || o.bp || o.hp;
      f.Q.value = o.q || 0.8;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.dest || sfxBus);
    if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verbIn); }
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 6;
      l.connect(lg); lg.connect(osc.detune); l.start(t0); l.stop(t0 + a + hold + rel + 0.1);
    }
    osc.start(t0);
    osc.stop(t0 + a + hold + rel + 0.05);
    return osc;
  }

  function noise(o) {
    if (!ac) return;
    const t0 = o.t0 != null ? o.t0 : ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || o.dur || 0.3));
    f.Q.value = o.q || 0.7;
    const g = ac.createGain();
    const a = o.a != null ? o.a : 0.005, hold = o.hold || 0, rel = o.rel != null ? o.rel : 0.2;
    env(g, t0, a, hold, rel, o.vol != null ? o.vol : 0.2);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verbIn); }
    if (o.am) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.am; lg.gain.value = 0.5;
      const base = ac.createGain(); base.gain.value = 0.5;
      g.disconnect(); g.connect(base); base.connect(o.dest || sfxBus);
      l.connect(lg); lg.connect(base.gain); l.start(t0); l.stop(t0 + a + hold + rel + 0.1);
    }
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + a + hold + rel + 0.05);
  }

  // ---------- ljudeffekter ----------
  const SFX = {
    pling(t) { // notisljudet från okända nummer
      [88, 84, 80].forEach((m, i) => tone({ t0: t + i * 0.11, f: mtof(m), type: 'sine', vol: 0.16, rel: 0.6, verb: 0.5 }));
      tone({ t0: t + 0.22, f: mtof(56), type: 'triangle', vol: 0.12, rel: 0.9 });
    },
    msg(t) { tone({ t0: t, f: 880, f2: 1320, glide: 0.06, type: 'sine', vol: 0.09, rel: 0.12 }); },
    sent(t) { tone({ t0: t, f: 660, f2: 990, glide: 0.05, type: 'triangle', vol: 0.06, rel: 0.1 }); },
    type(t) { noise({ t0: t, type: 'bandpass', f: 3500 + Math.random() * 1500, q: 2, vol: 0.025, rel: 0.02 }); },
    click(t) { tone({ t0: t, f: 1200, type: 'square', vol: 0.03, rel: 0.03, lp: 3000 }); },
    step(t) { noise({ t0: t, type: 'lowpass', f: 500, vol: 0.05, rel: 0.05 }); },
    run(t) { noise({ t0: t, type: 'lowpass', f: 700, vol: 0.08, rel: 0.06 }); },
    bell(t) { // skolklockan
      for (let i = 0; i < 18; i++) tone({ t0: t + i * 0.055, f: 1046, type: 'triangle', vol: 0.07, rel: 0.05, hp: 600 });
      tone({ t0: t, f: 2093, type: 'sine', vol: 0.03, hold: 1, rel: 0.4 });
    },
    scare(t) {
      noise({ t0: t, type: 'highpass', f: 800, vol: 0.5, a: 0.002, hold: 0.25, rel: 0.6, verb: 0.6 });
      [60.5, 61, 66.2, 72.7].forEach((m) => tone({ t0: t, f: mtof(m + 12), type: 'sawtooth', vol: 0.13, hold: 0.4, rel: 0.8, lp: 4000, verb: 0.5 }));
      tone({ t0: t, f: 90, f2: 30, glide: 1.2, type: 'sine', vol: 0.6, rel: 1.4 });
    },
    sting(t) {
      [57, 58, 64].forEach((m) => tone({ t0: t, f: mtof(m), type: 'sawtooth', vol: 0.09, a: 0.01, hold: 0.3, rel: 1.4, lp: 1800, verb: 0.7 }));
      tone({ t0: t, f: 55, type: 'sine', vol: 0.4, rel: 1.6 });
    },
    growl(t) {
      noise({ t0: t, type: 'bandpass', f: 180, q: 3, vol: 0.5, a: 0.15, hold: 0.9, rel: 0.6, am: 11 });
      tone({ t0: t, f: 48, f2: 38, glide: 1.6, type: 'sawtooth', vol: 0.16, a: 0.2, hold: 0.8, rel: 0.6, lp: 220 });
    },
    hiss(t) { noise({ t0: t, type: 'highpass', f: 3000, vol: 0.18, a: 0.03, hold: 0.25, rel: 0.4 }); },
    glitch(t) {
      for (let i = 0; i < 9; i++) {
        tone({ t0: t + i * 0.035, f: 100 + Math.random() * 1800, type: 'square', vol: 0.05, rel: 0.03, lp: 5000 });
      }
      noise({ t0: t, type: 'bandpass', f: 2500, q: 1, vol: 0.08, hold: 0.25, rel: 0.05 });
    },
    heart(t, v) {
      const vol = v || 0.55;
      tone({ t0: t, f: 75, f2: 42, glide: 0.12, type: 'sine', vol, rel: 0.16 });
      tone({ t0: t + 0.22, f: 65, f2: 40, glide: 0.1, type: 'sine', vol: vol * 0.7, rel: 0.14 });
    },
    door(t) {
      tone({ t0: t, f: 320, f2: 170, glide: 0.8, type: 'sawtooth', vol: 0.05, a: 0.05, hold: 0.5, rel: 0.3, bp: 900, q: 6 });
      noise({ t0: t + 0.75, type: 'lowpass', f: 300, vol: 0.25, rel: 0.25 });
    },
    locker(t) { noise({ t0: t, type: 'bandpass', f: 1400, q: 3, vol: 0.25, rel: 0.25, verb: 0.3 }); tone({ t0: t, f: 210, type: 'square', vol: 0.05, rel: 0.2, lp: 900 }); },
    caught(t) {
      SFX.sting(t);
      noise({ t0: t, type: 'lowpass', f: 2000, f2: 100, glide: 0.8, vol: 0.4, rel: 0.9 });
    },
    pickup(t) { [76, 83, 88].forEach((m, i) => tone({ t0: t + i * 0.07, f: mtof(m), type: 'triangle', vol: 0.09, rel: 0.25, verb: 0.3 })); },
    ok(t) { [72, 79].forEach((m, i) => tone({ t0: t + i * 0.09, f: mtof(m), type: 'sine', vol: 0.12, rel: 0.4 })); },
    fail(t) { [64, 60, 55].forEach((m, i) => tone({ t0: t + i * 0.14, f: mtof(m), type: 'triangle', vol: 0.12, rel: 0.4 })); },
    win(t) { [60, 64, 67, 72].forEach((m, i) => tone({ t0: t + i * 0.1, f: mtof(m), type: 'triangle', vol: 0.1, rel: 0.7, verb: 0.4 })); },
    scratch(t) {
      for (let i = 0; i < 4; i++) noise({ t0: t + i * 0.18, type: 'highpass', f: 2500, f2: 6000, glide: 0.12, vol: 0.12, a: 0.02, rel: 0.1 });
    },
    whisper(t) {
      for (let i = 0; i < 5; i++) noise({ t0: t + i * 0.22 + Math.random() * 0.1, type: 'bandpass', f: 1200 + Math.random() * 2400, q: 5, vol: 0.12, a: 0.06, hold: 0.08, rel: 0.12, verb: 0.8 });
    },
    buzz(t) { for (let i = 0; i < 3; i++) tone({ t0: t + i * 0.28, f: 140, type: 'square', vol: 0.06, a: 0.01, hold: 0.16, rel: 0.02, lp: 400 }); },
    hot(t) { noise({ t0: t, type: 'highpass', f: 5000, vol: 0.05, a: 0.4, hold: 1, rel: 0.6 }); tone({ t0: t, f: 3200, type: 'sine', vol: 0.02, a: 0.5, hold: 1, rel: 0.5 }); },
    scream(t) {
      for (let i = 0; i < 3; i++) tone({ t0: t, f: 900 + i * 37, f2: 1700 + i * 50, glide: 0.5, type: 'sawtooth', vol: 0.06, a: 0.02, hold: 0.9, rel: 0.3, lp: 5000, vib: 9, vibAmt: 60 });
      noise({ t0: t, type: 'bandpass', f: 2200, q: 1.5, vol: 0.12, hold: 1, rel: 0.3 });
    },
    switchOn(t) { tone({ t0: t, f: 1800, type: 'square', vol: 0.04, rel: 0.02 }); noise({ t0: t, type: 'highpass', f: 4000, vol: 0.06, rel: 0.03 }); },
    battery(t) { [70, 77].forEach((m, i) => tone({ t0: t + i * 0.08, f: mtof(m), type: 'square', vol: 0.04, rel: 0.12, lp: 2500 })); },
    alarm(t) { for (let i = 0; i < 4; i++) tone({ t0: t + i * 0.3, f: 880, f2: 660, glide: 0.25, type: 'square', vol: 0.06, rel: 0.05, hold: 0.2, lp: 2500 }); },
    crowd(t) { for (let i = 0; i < 12; i++) noise({ t0: t + Math.random() * 1.2, type: 'bandpass', f: 400 + Math.random() * 900, q: 4, vol: 0.06, a: 0.1, hold: 0.2, rel: 0.3, verb: 0.4 }); },
    gasp(t) { noise({ t0: t, type: 'bandpass', f: 1600, f2: 900, glide: 0.4, q: 1.2, vol: 0.18, a: 0.02, hold: 0.2, rel: 0.3 }); },
    thud(t) { tone({ t0: t, f: 110, f2: 35, glide: 0.3, type: 'sine', vol: 0.5, rel: 0.35 }); noise({ t0: t, type: 'lowpass', f: 400, vol: 0.2, rel: 0.2 }); },
    rain(t) { noise({ t0: t, type: 'highpass', f: 1500, vol: 0.05, a: 0.8, hold: 5, rel: 1.5 }); },
    light(t) { tone({ t0: t, f: 2400, type: 'sine', vol: 0.03, rel: 0.05 }); },
  };

  A.play = function (name, v) {
    if (!ac || !SFX[name]) return;
    try { SFX[name](ac.currentTime + 0.01, v); } catch (e) { /* ignoreras */ }
  };

  // ---------- hjärtslag ----------
  A.heart = function (bpm) {
    heartBpm = bpm || 0;
    if (heartTimer) { clearTimeout(heartTimer); heartTimer = null; }
    if (!heartBpm || !ac) return;
    const beat = () => {
      A.play('heart', 0.25 + Math.min(0.4, heartBpm / 400));
      heartTimer = setTimeout(beat, 60000 / heartBpm);
    };
    beat();
  };

  // ---------- musik ----------
  // Varje spår har en sekvenser som schemalägger toner en bit i förväg.
  function sequencer(bpm, steps, fn) {
    const stepDur = 60 / bpm / 2; // åttondelar
    let next = ac.currentTime + 0.1, i = 0, alive = true;
    const timer = setInterval(() => {
      if (!alive) return;
      while (next < ac.currentTime + 0.25) {
        try { fn(i % steps, next, stepDur, Math.floor(i / steps)); } catch (e) { /* ignoreras */ }
        next += stepDur; i++;
      }
    }, 40);
    return () => { alive = false; clearInterval(timer); };
  }

  function droneVoice(bus, freqs, cutoff, type) {
    const g = ac.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(1, ac.currentTime + 3);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 2;
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = cutoff * 0.5;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const oscs = freqs.map((fr, i) => {
      const o = ac.createOscillator(); o.type = type || 'sawtooth'; o.frequency.value = fr; o.detune.value = (i - 1) * 7;
      const og = ac.createGain(); og.gain.value = 0.06;
      o.connect(og); og.connect(f); o.start(); return o;
    });
    f.connect(g); g.connect(bus);
    return () => {
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(g.gain.value, ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
      setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 1700);
    };
  }

  function windVoice(bus, vol) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1.6;
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.11; lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    const g = ac.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, ac.currentTime + 3);
    src.connect(f); f.connect(g); g.connect(bus); src.start();
    return () => {
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(g.gain.value, ac.currentTime);
      g.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
      setTimeout(() => { src.stop(); lfo.stop(); }, 1700);
    };
  }

  const box = (m, t, vol) => {
    const det = (Math.random() - 0.5) * 22;
    tone({ t0: t, f: mtof(m), type: 'sine', vol: vol || 0.09, rel: 1.6, detune: det, dest: musicBus, verb: 0.55 });
    tone({ t0: t, f: mtof(m) * 3.01, type: 'sine', vol: (vol || 0.09) * 0.25, rel: 0.4, detune: det, dest: musicBus });
  };
  const pad = (m, t, dur, vol, type) => tone({ t0: t, f: mtof(m), type: type || 'triangle', vol: vol || 0.04, a: dur * 0.3, hold: dur * 0.4, rel: dur * 0.6, dest: musicBus, verb: 0.3, lp: 1600 });
  const kick = (t, v) => tone({ t0: t, f: 120, f2: 40, glide: 0.12, type: 'sine', vol: v || 0.35, rel: 0.2, dest: musicBus });
  const hat = (t, v) => noise({ t0: t, type: 'highpass', f: 7000, vol: v || 0.04, rel: 0.04, dest: musicBus });

  const TRACKS = {
    meny() {
      const mel = [81, 0, 76, 0, 77, 76, 72, 0, 74, 0, 71, 0, 72, 69, 0, 0, 81, 0, 76, 0, 77, 79, 80, 0, 76, 0, 0, 0, 0, 0, 0, 0];
      const stopD = droneVoice(musicBus, [55, 55.3, 82.4], 260);
      const stopS = sequencer(54, 32, (i, t, d, bar) => {
        let m = mel[i];
        if (m && bar % 3 === 2 && i === 21) m = 78; // en "trasig" ton
        if (m) box(m, t, 0.08);
        if (i === 0) pad(45, t, d * 16, 0.05);
        if (i === 16) pad(44, t, d * 16, 0.05);
      });
      return () => { stopD(); stopS(); };
    },
    drone() {
      const a = droneVoice(musicBus, [41.2, 41.5, 61.7], 240);
      const w = windVoice(musicBus, 0.07);
      const s = sequencer(40, 32, (i, t) => {
        if (i === 0 && Math.random() < 0.6) box(SK.pick([93, 92, 87, 86]), t, 0.035);
        if (i === 17 && Math.random() < 0.3) noise({ t0: t, type: 'bandpass', f: 2600, q: 8, vol: 0.05, rel: 1.2, dest: musicBus, verb: 0.9 });
      });
      return () => { a(); w(); s(); };
    },
    skola() {
      const ch = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [52, 56, 59]];
      const s = sequencer(84, 64, (i, t, d) => {
        if (i % 16 === 0) ch[i / 16].forEach((m) => pad(m, t, d * 16, 0.035));
        if (i % 4 === 0) box(ch[Math.floor(i / 16)][(i / 4) % 3] + 24, t, 0.03);
      });
      const w = windVoice(musicBus, 0.025);
      return () => { s(); w(); };
    },
    jakt() {
      const bass = [45, 45, 57, 45, 45, 48, 45, 57, 45, 45, 57, 45, 44, 44, 56, 44];
      const s = sequencer(152, 32, (i, t, d) => {
        const m = bass[i % 16];
        tone({ t0: t, f: mtof(m - 12), type: 'square', vol: 0.07, rel: d * 0.9, lp: 700, dest: musicBus });
        if (i % 4 === 0) kick(t, 0.32);
        if (i % 2 === 1) hat(t, 0.035);
        if (i === 0 || i === 20) [57, 58, 64].forEach((n) => tone({ t0: t, f: mtof(n), type: 'sawtooth', vol: 0.035, rel: 0.5, lp: 2200, dest: musicBus, verb: 0.3 }));
        if (i === 28) noise({ t0: t, type: 'highpass', f: 2000, f2: 8000, glide: d * 3, vol: 0.05, rel: d * 3, dest: musicBus });
      });
      return s;
    },
    mork() {
      const a = droneVoice(musicBus, [36.7, 36.9, 55], 180);
      const w = windVoice(musicBus, 0.04);
      const s = sequencer(36, 24, (i, t) => {
        if (i === 3 && Math.random() < 0.5) noise({ t0: t, type: 'bandpass', f: 1800 + Math.random() * 2000, q: 12, vol: 0.09, rel: 1.5, dest: musicBus, verb: 1 });
        if (i === 15 && Math.random() < 0.35) box(SK.pick([70, 71, 75]), t, 0.03);
      });
      return () => { a(); w(); s(); };
    },
    final() {
      const prog = [[48, 51, 55], [44, 48, 51], [51, 55, 58], [46, 50, 53]];
      const s = sequencer(120, 64, (i, t, d) => {
        const c = prog[Math.floor(i / 16)];
        if (i % 16 === 0) c.forEach((m) => {
          tone({ t0: t, f: mtof(m + 12), type: 'sine', vol: 0.05, a: 0.6, hold: d * 12, rel: 1, vib: 5, vibAmt: 9, dest: musicBus, verb: 0.6 });
          tone({ t0: t, f: mtof(m + 12) * 1.003, type: 'triangle', vol: 0.03, a: 0.6, hold: d * 12, rel: 1, dest: musicBus });
        });
        if (i % 4 === 0) kick(t, 0.3);
        if (i % 8 === 4) noise({ t0: t, type: 'bandpass', f: 1800, q: 0.8, vol: 0.09, rel: 0.12, dest: musicBus });
        if (i % 2 === 0) tone({ t0: t, f: mtof(c[0] - 12), type: 'square', vol: 0.04, rel: d * 0.8, lp: 500, dest: musicBus });
      });
      return s;
    },
    disco() {
      const bass = [45, 57, 45, 57, 41, 53, 41, 53, 48, 60, 48, 60, 43, 55, 43, 55];
      const s = sequencer(118, 32, (i, t, d) => {
        if (i % 2 === 0) kick(t, 0.3);
        if (i % 2 === 1) hat(t, 0.05);
        if (i % 4 === 2) noise({ t0: t, type: 'bandpass', f: 1500, q: 0.9, vol: 0.06, rel: 0.1, dest: musicBus });
        tone({ t0: t, f: mtof(bass[Math.floor(i / 2) % 16] - 12), type: 'sawtooth', vol: 0.05, rel: d * 0.8, lp: 600, dest: musicBus });
        if (i % 4 === 0) tone({ t0: t, f: mtof(bass[Math.floor(i / 2) % 16] + 24), type: 'square', vol: 0.025, rel: 0.15, lp: 2500, dest: musicBus });
      });
      return s;
    },
    buss() {
      const arp = [[64, 67, 71, 76], [62, 66, 69, 74], [60, 64, 67, 72], [62, 67, 71, 74]];
      const s = sequencer(104, 64, (i, t, d) => {
        const c = arp[Math.floor(i / 16)];
        tone({ t0: t, f: mtof(c[i % 4]), type: 'triangle', vol: 0.045, rel: 0.35, dest: musicBus, verb: 0.25 });
        if (i % 4 === 0) kick(t, 0.18);
        if (i % 4 === 2) hat(t, 0.03);
        if (i % 16 === 0) pad(c[0] - 12, t, d * 16, 0.035);
      });
      return s;
    },
    lugn() {
      const arp = [[60, 64, 67, 72], [53, 57, 60, 65], [57, 60, 64, 69], [55, 59, 62, 67]];
      const s = sequencer(76, 64, (i, t, d) => {
        const c = arp[Math.floor(i / 16)];
        if (i % 2 === 0) tone({ t0: t, f: mtof(c[(i / 2) % 4]), type: 'sine', vol: 0.06, rel: 1.1, dest: musicBus, verb: 0.45 });
        if (i % 16 === 0) pad(c[0] - 12, t, d * 16, 0.04);
      });
      return s;
    },
  };

  A.music = function (name) {
    if (name === currentName) return;
    if (!ac) { wanted = name; currentName = null; return; }
    if (current) { try { current(); } catch (e) { /* ignoreras */ } current = null; }
    currentName = name;
    if (name && TRACKS[name]) {
      try { current = TRACKS[name](); } catch (e) { current = null; }
    }
  };
  A.track = () => currentName || wanted;
})();
