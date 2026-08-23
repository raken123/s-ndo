/**
 * Sound: recitation streaming, ambience, prayer-time chimes and spoken guide
 * prompts.
 *
 * No adhan recording is bundled — an adhan is a human voice and shipping one
 * would mean picking a muezzin for everybody. The prayer alert is a soft chime
 * by default, and Settings takes the URL of any adhan recording you want.
 */

export class AudioEngine {
  constructor(store) {
    this.store = store;
    this.ctx = null;
    this.ambienceNode = null;
    this.recitation = null;
    this.unlocked = false;
  }

  /** Browsers only allow audio after a gesture; call this from a click. */
  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
    } catch (err) {
      console.warn('Audio unavailable:', err);
    }
  }

  // ---- chimes --------------------------------------------------------------

  /** A short bell-like tone. */
  tone(frequency = 660, duration = 0.6, gain = 0.25, type = 'sine', delay = 0) {
    if (!this.unlocked) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  click() { this.tone(880, 0.08, 0.12, 'triangle'); }
  bead() { this.tone(220 + Math.random() * 40, 0.09, 0.16, 'triangle'); }
  success() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.5, 0.16, 'sine', i * 0.11)); }
  error() { this.tone(180, 0.3, 0.15, 'sawtooth'); }

  /** Prayer-time alert: a rising three-note chime, or a custom adhan recording. */
  async prayerAlert() {
    if (!this.store.get('settings.adhanEnabled')) return;
    const url = this.store.get('settings.adhanUrl');
    const volume = this.store.get('settings.adhanVolume', 0.7);
    if (url) {
      try {
        this.adhanAudio?.pause();
        this.adhanAudio = new Audio(url);
        this.adhanAudio.volume = volume;
        this.adhanAudio.crossOrigin = 'anonymous';
        await this.adhanAudio.play();
        return;
      } catch (err) {
        console.warn('Adhan URL failed, falling back to the chime:', err);
      }
    }
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 1.6, 0.2 * volume, 'sine', i * 0.45));
  }

  stopAdhan() { this.adhanAudio?.pause(); }

  // ---- ambience ------------------------------------------------------------

  /** Procedural room tone — no audio files, so it works fully offline. */
  setAmbience(kind) {
    if (!this.unlocked) return;
    this.stopAmbience();
    if (!kind || kind === 'none') return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;      // brown-ish noise
      data[i] = last * 3.2;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    gain.gain.value = this.store.get('settings.ambienceVolume', 0.35) * 0.5;

    switch (kind) {
      case 'rain':  filter.type = 'highpass'; filter.frequency.value = 900; gain.gain.value *= 1.5; break;
      case 'wind':  filter.type = 'lowpass';  filter.frequency.value = 420; break;
      case 'haram': filter.type = 'bandpass'; filter.frequency.value = 320; filter.Q.value = 0.6; break;
      default:      filter.type = 'lowpass';  filter.frequency.value = 700;
    }

    source.connect(filter).connect(gain).connect(this.master);
    source.start();

    // A slow wander so the bed does not sit perfectly still.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = filter.frequency.value * 0.25;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    this.ambienceNode = { source, gain, lfo };
  }

  stopAmbience() {
    if (!this.ambienceNode) return;
    try {
      this.ambienceNode.source.stop();
      this.ambienceNode.lfo.stop();
    } catch { /* already stopped */ }
    this.ambienceNode = null;
  }

  setAmbienceVolume(v) {
    if (this.ambienceNode) this.ambienceNode.gain.gain.value = v * 0.5;
  }

  // ---- recitation ----------------------------------------------------------

  /**
   * Play a list of ayah URLs in order.
   * @param {string[]} urls
   * @param {(index:number)=>void} onAyah  called as each ayah starts
   * @param {()=>void} onEnd
   */
  playSequence(urls, onAyah, onEnd) {
    this.stopRecitation();
    let i = 0;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = 1;
    this.recitation = audio;

    const next = () => {
      if (!this.recitation || i >= urls.length) { this.recitation = null; onEnd?.(); return; }
      onAyah?.(i);
      audio.src = urls[i];
      i += 1;
      audio.play().catch((err) => {
        console.warn('Recitation unavailable:', err);
        this.recitation = null;
        onEnd?.(err);
      });
    };

    audio.addEventListener('ended', next);
    audio.addEventListener('error', () => {
      // Skip a missing ayah rather than stalling the whole session.
      if (this.recitation) next();
    });
    next();
    return audio;
  }

  pauseRecitation() { this.recitation?.pause(); }
  resumeRecitation() { this.recitation?.play().catch(() => {}); }

  stopRecitation() {
    if (!this.recitation) return;
    this.recitation.pause();
    this.recitation.src = '';
    this.recitation = null;
  }

  get isReciting() { return !!this.recitation && !this.recitation.paused; }

  // ---- spoken guide --------------------------------------------------------

  /** Short spoken cue for the guided prayer, using the platform voice. */
  say(text, { lang = 'en-US', rate = 0.95 } = {}) {
    if (!this.store.get('settings.guideVoice')) return;
    if (!('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.volume = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch { /* speech unavailable */ }
  }

  stopSpeech() {
    try { speechSynthesis?.cancel(); } catch { /* not supported */ }
  }
}
