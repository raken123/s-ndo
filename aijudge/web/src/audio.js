/* audio.js — every sound in the hall is synthesised at runtime. No files, which
   keeps the single-file build genuinely single-file. */
(function (global) {
  'use strict';

  let ctx = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    /* one second of white noise, reused for snares, crashes and shots */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /* Browsers keep the context suspended until a gesture; call this from one. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
    return !!c;
  }

  function now() { return ctx.currentTime; }

  function noise(dur, gain, filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType || 'bandpass';
    f.frequency.value = freq || 1800;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, endFreq, dur, gain, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = now();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (endFreq && endFreq !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const A = {
    get enabled() { return !muted; },
    setMuted(v) { muted = !!v; if (master) master.gain.value = muted ? 0 : 0.85; },
    unlock,

    kick() { if (!ensure() || muted) return; tone(150, 42, 0.34, 0.9); noise(0.05, 0.18, 'lowpass', 220, 1); },
    snare() { if (!ensure() || muted) return; noise(0.16, 0.45, 'bandpass', 1900, 0.8); tone(220, 140, 0.09, 0.22, 'triangle'); },
    hat() { if (!ensure() || muted) return; noise(0.05, 0.16, 'highpass', 7000, 1); },
    crash() { if (!ensure() || muted) return; noise(1.5, 0.4, 'highpass', 3200, 0.7); noise(1.1, 0.22, 'bandpass', 5200, 0.5); },
    gavel() { if (!ensure() || muted) return; tone(320, 90, 0.16, 0.7, 'square'); noise(0.09, 0.3, 'lowpass', 900, 1); },
    tick() { if (!ensure() || muted) return; tone(1400, 1200, 0.03, 0.10, 'square'); },
    chime(good) {
      if (!ensure() || muted) return;
      const base = good ? 523.25 : 349.23;
      [0, 0.11, 0.22].forEach((d, i) => {
        setTimeout(() => {
          if (!ctx || muted) return;
          tone(base * (good ? [1, 1.26, 1.5][i] : [1, 0.94, 0.75][i]), null, 0.5, 0.2, 'triangle');
        }, d * 1000);
      });
    },

    /* the two guns: a dry crack over a drum body, not a realistic report */
    shot() {
      if (!ensure() || muted) return;
      noise(0.22, 0.8, 'bandpass', 900, 0.6);
      tone(420, 55, 0.28, 0.8, 'square');
      tone(90, 38, 0.5, 0.5);
      setTimeout(() => { if (ctx && !muted) noise(0.7, 0.18, 'highpass', 2600, 0.6); }, 60);
    },

    /* a rolling snare while the bench deliberates */
    roll(seconds) {
      if (!ensure() || muted) return () => {};
      let stop = false;
      const end = Date.now() + seconds * 1000;
      let gap = 46;
      const step = () => {
        if (stop || Date.now() > end || muted) return;
        noise(0.05, 0.10 + Math.random() * 0.06, 'bandpass', 1700 + Math.random() * 700, 0.9);
        gap = Math.max(24, gap * 0.985);
        setTimeout(step, gap);
      };
      step();
      return () => { stop = true; };
    },

    /* a short fanfare of drums when a case is called */
    fanfare() {
      if (!ensure() || muted) return;
      const seq = [[0, 'kick'], [180, 'snare'], [320, 'kick'], [440, 'snare'], [600, 'crash']];
      seq.forEach(([d, s]) => setTimeout(() => { if (!muted) A[s](); }, d));
    }
  };

  global.AJAudio = A;
})(typeof window !== 'undefined' ? window : globalThis);
