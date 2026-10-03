// Playshow Mode, part 2: voicing and playing the episode.
//
// VoicePool: every line is performed by Gemini Live acting as a voice actor, one session per
// voice. (The free key only allows 3 text-to-speech requests a minute, but Live has no
// per-request limit.) At most 3 sessions are open at once; idle ones are recycled.
// EpisodePlayer: puts the cast on stage, voices lines ahead of time, lip-syncs the speaker and
// plays emotions, stage actions, title cards and subtitles.

import { Face } from './face.js';
import { drawCharacter } from './character.js';
import { HOST_NAME } from './playshow-script.js';

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const ACTOR_PROMPT = 'You are a voice actor in a cartoon object show. The user sends one line of dialogue at a time, with the emotion in square brackets. Perform ONLY that line, exactly word for word, in a lively cartoon voice that matches the emotion. Never add, remove or change words, never reply to the line, never say the emotion out loud.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Actor {
  constructor(apiKey, voice) {
    this.apiKey = apiKey;
    this.voice = voice;
    this.ws = null;
    this.chain = Promise.resolve();
    this.pending = null;
    this.busy = 0;
    this.lastUsed = Date.now();
  }

  open() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(this.apiKey)}`);
      this.ws = ws;
      let ready = false;
      ws.onopen = () => ws.send(JSON.stringify({ setup: {
        model: 'models/gemini-3.8-live',
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } } },
        systemInstruction: { parts: [{ text: ACTOR_PROMPT }] },
      } }));
      ws.onmessage = async e => {
        const msg = JSON.parse(typeof e.data === 'string' ? e.data : await e.data.text());
        if (msg.setupComplete) { ready = true; resolve(); return; }
        const p = this.pending;
        if (!p) return;
        for (const part of msg.serverContent?.modelTurn?.parts || []) if (part.inlineData?.data) p.chunks.push(part.inlineData.data);
        if (msg.serverContent?.turnComplete && p.chunks.length) p.done();
      };
      ws.onclose = e => {
        if (!ready) reject(new Error(e.reason || `voice connection closed (${e.code})`));
        this.pending?.fail(new Error(e.reason || 'voice connection lost'));
        this.ws = null;
      };
    });
  }

  /** Performs one line; resolves with base64 PCM chunks (24 kHz). Lines queue per actor. */
  say(text, emotion, timeoutMs = 30000) {
    this.busy++;
    const run = () => new Promise((resolve, reject) => {
      if (!this.ws) { reject(new Error('voice connection lost')); return; }
      const timer = setTimeout(() => p.fail(new Error('voice timed out')), timeoutMs);
      const p = {
        chunks: [],
        done: () => { clearTimeout(timer); this.pending = null; resolve(p.chunks); },
        fail: err => { clearTimeout(timer); this.pending = null; reject(err); },
      };
      this.pending = p;
      this.ws.send(JSON.stringify({ realtimeInput: { text: `[${emotion}] ${text}` } }));
    });
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => {});
    return result.finally(() => { this.busy--; this.lastUsed = Date.now(); });
  }

  close() { try { this.ws?.close(1000); } catch { /* already closed */ } this.ws = null; }
}

export class VoicePool {
  constructor(apiKey, max = 3) {
    this.apiKey = apiKey;
    this.max = max;
    this.actors = new Map(); // voice -> Actor (or a Promise while opening)
    this.closed = false;
  }

  async actorFor(voice) {
    for (let attempt = 0; ; attempt++) {
      if (this.closed) throw new Error('stopped');
      const have = this.actors.get(voice);
      if (have) return have instanceof Actor ? have : await have;
      if (this.actors.size >= this.max) {
        // Recycle the idle actor that has waited longest; if all are busy, wait a moment.
        const idle = [...this.actors.entries()].filter(([, a]) => a instanceof Actor && a.busy === 0)
          .sort((x, y) => x[1].lastUsed - y[1].lastUsed)[0];
        if (!idle) { await sleep(150); continue; }
        idle[1].close();
        this.actors.delete(idle[0]);
      }
      const actor = new Actor(this.apiKey, voice);
      const opening = actor.open().then(() => actor);
      this.actors.set(voice, opening);
      try {
        await opening;
        this.actors.set(voice, actor);
        return actor;
      } catch (err) {
        this.actors.delete(voice);
        if (attempt >= 4) throw err;
        await sleep(3000 * (attempt + 1)); // quota: try again shortly
      }
    }
  }

  async perform(voice, text, emotion) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const actor = await this.actorFor(voice);
      try {
        return await actor.say(text, emotion);
      } catch (err) {
        if (this.closed) throw err;
        actor.close();
        if (this.actors.get(voice) === actor) this.actors.delete(voice);
        if (attempt === 2) throw err;
      }
    }
    return [];
  }

  closeAll() {
    this.closed = true;
    for (const a of this.actors.values()) if (a instanceof Actor) a.close(); else a.then(x => x.close(), () => {});
    this.actors.clear();
  }
}

const PREFETCH = 6;
const pcmSeconds = chunks => chunks.reduce((n, b64) => n + Math.floor(b64.length * 3 / 4), 0) / 48000;

/** Little "ta-da" for title cards (oscillators, nothing to download). */
function jingle(ctx) {
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const t = ctx.currentTime + i * 0.11;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 0.7 : 0.25));
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.8);
  });
}

export class EpisodePlayer extends EventTarget {
  /**
   * els: { row, sub, card, loading, progress }
   * spend(seconds) -> false when usage ran out
   */
  /** stageCast: who stands on stage (default: everyone with a line). Hosted episodes get a mic podium. */
  constructor({ els, audio, sprites, cast, episode, number, showName, apiKey, spend, stageCast = null }) {
    super();
    Object.assign(this, { els, audio, sprites, cast, episode, number, showName, spend, stageCast });
    this.pool = new VoicePool(apiKey);
    this.lines = episode.scenes.flatMap((s, si) => s.lines.map((l, li) => ({ ...l, scene: si, first: li === 0 })));
    this.audioFor = [];
    this.slots = new Map();
    this.speaker = null;
    this.stopped = false;
    this.paused = false;
    this.skipRequested = false;
    this.index = -1;
  }

  emit(type, detail = {}) { this.dispatchEvent(Object.assign(new Event(type), { detail })); }

  build() {
    const row = this.els.row;
    row.innerHTML = '';
    const speakers = new Set(this.lines.map(l => l.speaker));
    const onStage = this.stageCast ? [...this.stageCast] : this.cast.filter(c => speakers.has(c.name));
    this.podium = null;
    if (this.episode.hosted) {
      const pod = document.createElement('div');
      pod.className = 'ps-podium';
      pod.innerHTML = '<div class="ps-mic">🎤</div><div class="ps-podium-box">HOST</div><div class="ps-name">You</div>';
      row.appendChild(pod);
      this.podium = pod;
    }
    // Host stands on the left, like the announcer's spot.
    onStage.sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0));
    row.style.setProperty('--n', onStage.length);
    onStage.forEach((c, i) => {
      const slot = document.createElement('div');
      slot.className = 'ps-slot';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      slot.appendChild(svg);
      const tag = document.createElement('div');
      tag.className = 'ps-name';
      tag.textContent = c.name;
      slot.appendChild(tag);
      row.appendChild(slot);
      const parts = drawCharacter(svg, c.body, c.color, `ps${i}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMax meet'); // stand on the ground, not float mid-slot
      const face = new Face({ ...parts, sprites: this.sprites });
      face.nextBlink = performance.now() + 500 + Math.random() * 3000; // don't all blink together
      this.slots.set(c.name, { cast: c, slot, parts, face });
    });
  }

  prefetch(upTo) {
    for (let i = 0; i <= Math.min(upTo, this.lines.length - 1); i++) {
      if (this.audioFor[i]) continue;
      const l = this.lines[i];
      const voice = this.slots.get(l.speaker)?.cast.voice || (l.speaker === HOST_NAME ? this.episode.hostVoice : null) || 'Puck';
      this.audioFor[i] = this.pool.perform(voice, l.text, l.emotion).catch(err => {
        console.warn('line', i, err);
        return []; // play it as a silent subtitle instead of stopping the show
      });
    }
  }

  async card(title, subtitle = '', ms = 2200, withJingle = false) {
    const el = this.els.card;
    el.innerHTML = `<div class="ps-card-title"></div><div class="ps-card-sub"></div>`;
    el.firstChild.textContent = title;
    el.lastChild.textContent = subtitle;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (withJingle) jingle(this.audio.ctx);
    await this.wait(ms);
    el.hidden = true;
  }

  async wait(ms) {
    const end = performance.now() + ms;
    while (performance.now() < end || this.paused) {
      if (this.stopped) throw new Error('stopped');
      if (this.skipRequested) { this.skipRequested = false; return; }
      await sleep(50);
    }
  }

  act(name, action) {
    const s = this.slots.get(name);
    if (!s || action === 'none') return;
    const cls = `act-${action}`;
    s.slot.classList.remove(cls);
    void s.slot.offsetWidth;
    s.slot.classList.add(cls);
    if (action === 'faint') s.face.setEmotion('dizzy');
    if (!['faint', 'eliminated'].includes(action)) setTimeout(() => s.slot.classList.remove(cls), 1200);
  }

  async playLine(i) {
    const l = this.lines[i];
    const s = this.slots.get(l.speaker);
    this.prefetch(i + PREFETCH);
    // Show "…" if the voice isn't ready yet.
    let ready = false;
    const loadingTimer = setTimeout(() => { if (!ready) this.els.loading.hidden = false; }, 400);
    const chunks = await this.audioFor[i];
    ready = true;
    clearTimeout(loadingTimer);
    this.els.loading.hidden = true;
    if (this.stopped) throw new Error('stopped');
    while (this.paused) await this.wait(50);

    for (const other of this.slots.values()) other.slot.classList.toggle('speaking', other === s);
    this.podium?.classList.toggle('speaking', l.speaker === HOST_NAME);
    if (s) {
      s.slot.classList.remove('act-faint'); // getting back up to talk
      s.face.setEmotion(l.emotion);
    }
    this.speaker = s;
    this.els.sub.innerHTML = '<b></b> <span></span>';
    this.els.sub.firstChild.textContent = `${l.speaker}:`;
    this.els.sub.lastChild.textContent = l.text;
    this.els.sub.hidden = false;
    this.act(l.speaker, l.action === 'eliminated' ? 'none' : l.action);

    const secs = chunks.length ? pcmSeconds(chunks) : Math.max(2, l.text.split(' ').length * 0.33);
    if (l.live) return; // the host's own words during a live episode: just shown
    if (chunks.length) for (const c of chunks) this.audio.playChunk(c);
    const end = performance.now() + secs * 1000 + 200;
    while (this.audio.queued() > 0.02 || this.audio.speaking || (!chunks.length && performance.now() < end)) {
      if (this.stopped) { this.audio.interrupt(); throw new Error('stopped'); }
      if (this.skipRequested) { this.skipRequested = false; this.audio.interrupt(); break; }
      await sleep(40);
    }
    if (l.action === 'eliminated') {
      this.act(l.speaker, 'eliminated');
      await this.wait(1600);
    }
    if (chunks.length && this.spend(secs) === false) {
      this.emit('outOfUsage');
      throw new Error('stopped');
    }
    await this.wait(250);
  }

  async play() {
    this.build();
    this.prefetch(PREFETCH);
    this.raf = requestAnimationFrame(t => this.frame(t));
    try {
      await this.card(this.showName, `Episode ${this.number}: ${this.episode.title}`, 3200, true);
      for (let i = 0; i < this.lines.length; i++) {
        this.index = i;
        this.els.progress.style.width = `${(i / this.lines.length) * 100}%`;
        const l = this.lines[i];
        if (l.first) {
          const sc = this.episode.scenes[l.scene];
          if (sc.card || sc.setting) await this.card(sc.card || 'Meanwhile…', sc.setting ? `📍 ${sc.setting}` : '', 1800);
        }
        await this.playLine(i);
      }
      this.els.progress.style.width = '100%';
      this.els.sub.hidden = true;
      await this.card('THE END', this.episode.eliminated ? `${this.episode.eliminated} was eliminated!` : 'Thanks for watching!', 3000, true);
      this.emit('ended');
    } catch (err) {
      if (err.message !== 'stopped') this.emit('error', { message: err.message });
    } finally {
      this.cleanup();
    }
  }

  // ---- live hosting: the stage is up while the user talks; lines arrive turn by turn

  /** Builds the stage and starts animating without playing a script. */
  openStage() {
    this.build();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  /** Shows what the host just said (it isn't voiced again live — they said it themselves). */
  showHost(text) {
    this.lines.push({ speaker: HOST_NAME, text, emotion: 'neutral', action: 'none', scene: 0, first: false, live: true });
    this.audioFor[this.lines.length - 1] = Promise.resolve([]);
    for (const other of this.slots.values()) other.slot.classList.remove('speaking');
    this.podium?.classList.add('speaking');
    this.els.sub.innerHTML = '<b></b> <span></span>';
    this.els.sub.firstChild.textContent = 'You:';
    this.els.sub.lastChild.textContent = text;
    this.els.sub.hidden = false;
  }

  /** Adds cast lines and plays them; resolves when they've all been performed. */
  async playMore(lines) {
    const start = this.lines.length;
    for (const l of lines) this.lines.push({ ...l, scene: 0, first: false });
    this.prefetch(start + PREFETCH);
    try {
      for (let i = start; i < this.lines.length; i++) {
        this.index = i;
        await this.playLine(i);
      }
      this.podium?.classList.remove('speaking');
      return true;
    } catch (err) {
      if (err.message !== 'stopped') this.emit('error', { message: err.message });
      return false;
    }
  }

  frame(now) {
    if (this.stopped) return;
    const { level, round } = this.audio.ctx ? this.audio.sample() : { level: 0, round: false };
    for (const s of this.slots.values()) {
      const talking = s === this.speaker;
      s.face.update(now, talking ? level : 0, talking && round);
      const lv = talking ? level : 0;
      s.parts.rig.style.transform = `translateY(${(-lv * 8).toFixed(2)}px) scale(${(1 + lv * 0.035).toFixed(3)}, ${(1 - lv * 0.035).toFixed(3)})`;
      const wave = talking ? Math.sin(now / 160) * lv * 24 : Math.sin(now / 800 + s.cast.name.length) * 3;
      s.parts.arms[0].style.transform = `rotate(${(-wave).toFixed(1)}deg)`;
      s.parts.arms[1].style.transform = `rotate(${wave.toFixed(1)}deg)`;
    }
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  pause() {
    this.paused = !this.paused;
    if (this.paused) this.audio.ctx?.suspend(); else this.audio.ctx?.resume();
    return this.paused;
  }

  skip() { this.skipRequested = true; }

  stop() {
    this.stopped = true;
    this.audio.ctx?.resume();
    this.audio.interrupt();
    this.cleanup();
  }

  cleanup() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.pool.closeAll();
    this.els.loading.hidden = true;
  }
}
