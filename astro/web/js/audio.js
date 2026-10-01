// Syntetiserade ljud med WebAudio – inga ljudfiler behövs.
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    // Motorljud: brus genom lågpassfilter
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 200;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    src.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    src.start();

    // Ambient-drön
    const hum = this.ctx.createOscillator();
    hum.type = 'sine'; hum.frequency.value = 55;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.03;
    hum.connect(this.humGain).connect(this.master);
    hum.start();
  }

  // Ljudström till inspelningen av resan (samma ljud som hörs i högtalarna).
  recordingStream() {
    if (!this.ctx || !this.ctx.createMediaStreamDestination) return null;
    if (!this.recDest) {
      this.recDest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.recDest);
    }
    return this.recDest.stream;
  }

  engine(thrust, warp) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.05 + thrust * 0.35 + (warp ? 0.2 : 0), t, 0.2);
    this.engineFilter.frequency.setTargetAtTime(150 + thrust * 500 + (warp ? 900 : 0), t, 0.3);
  }

  silence() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  beep(freq = 880, dur = 0.12, type = 'sine', vol = 0.25) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  chord(freqs, dur = 0.6) { freqs.forEach((f, i) => setTimeout(() => this.beep(f, dur, 'triangle', 0.18), i * 110)); }
  success() { this.chord([523, 659, 784, 1047]); }
  fail() { this.chord([392, 330], 0.4); }
  alarm() { this.beep(440, 0.25, 'square', 0.12); setTimeout(() => this.beep(330, 0.25, 'square', 0.12), 280); }
  click() { this.beep(1200, 0.05, 'square', 0.08); }

  boom() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.7);
  }

  say(text, lang) {
    // Talsyntes om den finns (t.ex. nedräkningen).
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'en' ? 'en-GB' : 'sv-SE';
      u.rate = 1.0;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* ignorera */ }
  }
}
