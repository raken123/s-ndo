// "Web lite" engine for the copy of BFDI Talk that lives inside the website page (a claude.ai
// artifact). That page can't open outside connections or use the microphone, so Gemini Live
// can't run there. Instead:
//   - ClaudeSocket: the character's replies come from Claude (the page's `sample` capability),
//     with the same events as LiveSocket (emotion, outText, audio, turnComplete, close).
//   - SpeechAudio: replies are spoken with the browser's own voices (speechSynthesis) and the
//     mouth moves with the words. Same interface as AudioEngine; "audio chunks" are lines of text.
//   - claudeFetch: answers Playshow's Gemini script requests with Claude instead.
// Typing replaces the mic. Everything else (faces, emotions, meter, plans, Playshow, Agent
// tasks/timers/notes) is the normal app code.

export const WEB_TOOLS = new Set(['set_timer', 'cancel_timer', 'add_task', 'complete_task', 'remove_task', 'list_tasks', 'write_note', 'get_date_time']);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let samplePromise = null;

/** The page's `sample` function, or null when this page isn't running inside Claude. */
export function getSample() {
  if (!samplePromise) {
    samplePromise = window.claude?.use
      ? Promise.race([window.claude.use('sample'), sleep(12000).then(() => null)]).catch(() => null)
      : Promise.resolve(null);
  }
  return samplePromise;
}

const ERRORS = {
  not_granted: 'Claude isn\'t allowed on this page. Allow it from the page\'s permissions to chat.',
  sampling_disabled: 'Claude isn\'t available for this account.',
  rate_limited: 'Too many messages at once — wait a moment and try again.',
  session_expired: 'Sign in to Claude again, then try again.',
  refused: 'Let\'s talk about something else!',
};
export const sampleError = e => ERRORS[e?.code] || 'Something went wrong talking to Claude. Try again.';
export const NO_SAMPLE = 'This copy can\'t reach an AI. Open it on claude.ai, or get the full BFDI Talk app.';

// Gemini-style schemas (type: 'OBJECT') -> JSON Schema (type: 'object').
export function toJsonSchema(s) {
  if (Array.isArray(s)) return s.map(toJsonSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'propertyOrdering' || k === 'nullable') continue;
    out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v);
  }
  return out;
}

// ------------------------------------------------------------------ chat

const TAG = /<([a-zA-Z]+)>/g;

/**
 * Splits a reply written as "<emotion> sentence. sentence. <other> sentence." into spoken
 * pieces. `final` false keeps the last unfinished sentence back for later.
 */
export function splitReply(text, emotions, final, startEmotion = 'happy') {
  const pieces = [];
  let emotion = startEmotion, consumed = 0, buf = '', bufStart = 0;
  const flush = (end) => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) pieces.push({ text: t, emotion });
    buf = '';
    consumed = end;
  };
  let i = 0;
  while (i < text.length) {
    TAG.lastIndex = i;
    const m = text[i] === '<' ? TAG.exec(text) : null;
    if (m && m.index === i) {
      if (buf.trim()) flush(i);
      const e = m[1];
      if (emotions.includes(e)) emotion = e;
      i += m[0].length;
      consumed = i;
      continue;
    }
    if (text[i] === '<' && !final && !text.slice(i).includes('>')) break; // a tag still arriving
    if (!buf) bufStart = i;
    buf += text[i];
    i++;
    if (/[.!?…]/.test(text[i - 1]) && (i === text.length ? final : /\s/.test(text[i]))) flush(i);
  }
  if (final && buf.trim()) flush(text.length);
  else if (!final) consumed = buf ? bufStart : consumed;
  return { pieces, consumed, emotion };
}

/** Claude-backed stand-in for LiveSocket (text in, emotions + spoken text out). */
export class ClaudeSocket extends EventTarget {
  constructor({ model, voice, systemPrompt, emotions, tools = [], onTool = null }) {
    super();
    Object.assign(this, { model, voice, systemPrompt, emotions, onTool });
    this.tools = tools.filter(t => WEB_TOOLS.has(t.name));
    this.history = [];
    this.queue = Promise.resolve();
    this.ctl = null;
    this.closed = false;
    this.handle = null; // no resuming: nothing to resume
  }

  emit(type, detail = {}) { this.dispatchEvent(Object.assign(new Event(type), { detail })); }

  async connect() {
    this.sample = await getSample();
    if (!this.sample) throw new Error(NO_SAMPLE);
    this.emit('open');
  }

  rules() {
    return [
      this.systemPrompt,
      '',
      'HOW TO REPLY (this is a typed chat; your reply is read aloud by a cartoon voice):',
      `- Start with your feeling in angle brackets, then what you say, e.g. "<happy> Hi! Want to play?". You can switch feelings mid-reply with another tag. Feelings: ${this.emotions.map(e => `<${e}>`).join(' ')}.`,
      '- Talk like a cartoon character on a voice call: 1–3 short sentences, no lists, no markdown, no emoji, no stage directions.',
      '- Messages in (round brackets) are notes from the app, not the user talking.',
      this.tools.length ? '- You have tools for timers, the to-do list and notes. Use them when asked, then say what you did.' : '',
    ].filter(Boolean).join('\n');
  }

  sendText(text) {
    this.queue = this.queue.then(() => this.turn(text)).catch(() => {});
  }

  sendAudio() {}
  endAudio() {}
  sendVideo() {}

  async turn(text) {
    if (this.closed) return;
    this.history.push({ role: 'user', content: text });
    while (this.history.length > 20 || this.history[0]?.role !== 'user') this.history.shift();
    const ctl = this.ctl = new AbortController();
    let said = 0, emotion = 'happy', spoken = '';
    const speak = (final, full) => {
      const { pieces, consumed, emotion: e } = splitReply(full.slice(said), this.emotions, final, emotion);
      said += consumed;
      emotion = e;
      for (const p of pieces) {
        this.emit('emotion', { emotion: p.emotion });
        this.emit('outText', { text: (spoken ? ' ' : '') + p.text });
        this.emit('audio', { data: { say: p.text, voice: this.voice, emotion: p.emotion } });
        spoken += (spoken ? ' ' : '') + p.text;
      }
    };
    const opts = {
      signal: ctl.signal,
      cache: false,
      modelTier: this.model?.cost > 1 ? 'complex' : 'quick',
      onText: ({ text: t }) => speak(false, t),
    };
    if (this.tools.length) {
      opts.tools = this.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: toJsonSchema(t.parameters || { type: 'OBJECT', properties: {} }),
        execute: async input => {
          const r = await this.onTool(t.name, input || {});
          if (r?.error) throw new Error(r.error);
          return r;
        },
      }));
    }
    try {
      const { text: full } = await this.sample([{ role: 'user', content: this.rules() }, ...this.history], opts);
      if (ctl.signal.aborted || this.closed) return;
      speak(true, full);
      this.history.push({ role: 'assistant', content: spoken || full });
    } catch (e) {
      if (e?.code === 'cancelled' || this.closed) return;
      this.history.pop();
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'].includes(e?.code)) {
        this.emit('close', { code: 1008, reason: sampleError(e), byUs: false });
        return;
      }
      this.emit('error', { message: sampleError(e) });
      this.emit('emotion', { emotion: 'confused' });
      this.emit('outText', { text: e?.code === 'refused' ? 'Let\'s talk about something else!' : 'Huh? I lost my train of thought. Say that again?' });
    } finally {
      if (this.ctl === ctl) this.ctl = null;
      this.emit('turnComplete');
    }
  }

  close() {
    this.closed = true;
    this.ctl?.abort();
  }
}

// ------------------------------------------------------------------ voices

// Every Gemini voice name gets its own pitch/speed so characters sound different.
const STYLE = { Upbeat: [1.35, 1.08], Bright: [1.3, 1.04], Firm: [0.9, 0.98], Excitable: [1.45, 1.15], Youthful: [1.5, 1.05],
  Breezy: [1.2, 1.0], Informative: [1.0, 0.98], 'Easy-going': [1.05, 0.95], Breathy: [1.15, 0.92], Clear: [1.1, 1.0],
  Smooth: [0.95, 0.95], Gravelly: [0.6, 0.92], Soft: [1.2, 0.9], Even: [1.0, 1.0], Mature: [0.75, 0.93], Forward: [1.1, 1.05],
  Friendly: [1.2, 1.02], Casual: [1.0, 1.03], Gentle: [1.15, 0.9], Lively: [1.4, 1.1], Knowledgeable: [0.9, 0.97], Warm: [1.05, 0.95] };
const VOICE_STYLE = { Puck: 'Upbeat', Zephyr: 'Bright', Kore: 'Firm', Fenrir: 'Excitable', Leda: 'Youthful', Aoede: 'Breezy',
  Charon: 'Informative', Orus: 'Firm', Callirrhoe: 'Easy-going', Autonoe: 'Bright', Enceladus: 'Breathy', Iapetus: 'Clear',
  Umbriel: 'Easy-going', Algieba: 'Smooth', Despina: 'Smooth', Erinome: 'Clear', Algenib: 'Gravelly', Rasalgethi: 'Informative',
  Laomedeia: 'Upbeat', Achernar: 'Soft', Alnilam: 'Firm', Schedar: 'Even', Gacrux: 'Mature', Pulcherrima: 'Forward',
  Achird: 'Friendly', Zubenelgenubi: 'Casual', Vindemiatrix: 'Gentle', Sadachbia: 'Lively', Sadaltager: 'Knowledgeable', Sulafat: 'Warm' };
const MOOD = { excited: [0.1, 0.12], laughing: [0.1, 0.1], happy: [0.05, 0.04], angry: [-0.1, 0.08], sad: [-0.15, -0.12],
  scared: [0.15, 0.1], surprised: [0.15, 0.05], sleepy: [-0.1, -0.15], bored: [-0.1, -0.1] };
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const speechSeconds = text => Math.max(1.2, text.split(/\s+/).length * 0.36 + 0.3);

/** Speaks text with the browser's voices; drop-in for AudioEngine (lip-sync follows the words). */
export class SpeechAudio {
  constructor() {
    this.ctx = null;        // real AudioContext, only for jingles/chimes
    this.synth = window.speechSynthesis || null;
    try { this.synth?.getVoices(); } catch { this.synth = null; } // starts loading the voice list
    this.items = [];        // queued lines: { say, voice, emotion }
    this.current = null;
    this.level = 0;
    this.round = false;
    this.pulse = 0;
    this.micLevel = 0;
    this.micEnabled = false;
    this.onMicChunk = null;
    this.stream = null;
    this.playing = false;
    this.gen = 0;
  }

  async init() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
    }
    if (this.ctx?.state === 'suspended') await this.ctx.resume().catch(() => {});
  }

  async startMic() { throw new Error('Type to chat in the web version.'); }
  stopMic() {}

  voiceFor(name) {
    const list = (this.synth?.getVoices() || []).filter(v => /^en/i.test(v.lang));
    const voice = list.length ? list[hash(name) % list.length] : null;
    const [pitch, rate] = STYLE[VOICE_STYLE[name]] || [1 + (hash(name) % 7 - 3) / 10, 1];
    return { voice, pitch, rate };
  }

  /** "Plays" a chunk: { say, voice, emotion } lines from ClaudeSocket / Playshow. */
  playChunk(item) {
    if (!item || typeof item !== 'object' || !item.say) return;
    this.items.push(item);
    if (!this.playing) this.run();
  }

  async run() {
    this.playing = true;
    const gen = this.gen;
    while (this.items.length && gen === this.gen) {
      const item = this.items.shift();
      this.current = item;
      this.word = item.say.split(/\s+/)[0] || '';
      await this.speakOne(item, gen);
      this.current = null;
    }
    if (gen === this.gen) this.playing = false;
  }

  speakOne(item, gen) {
    return new Promise(resolve => {
      const fallbackMs = speechSeconds(item.say) * 1000;
      const canSpeak = !!this.synth?.getVoices().length;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
      // Without voices (or if the browser never fires 'end'), move the mouth for the expected time.
      const guard = setTimeout(finish, canSpeak ? fallbackMs * 2.5 + 4000 : fallbackMs);
      if (!canSpeak) { this.fakeWords(item.say, fallbackMs, () => gen === this.gen && !done); return; }
      const u = new SpeechSynthesisUtterance(item.say);
      const { voice, pitch, rate } = this.voiceFor(item.voice || 'Puck');
      const [dp, dr] = MOOD[item.emotion] || [0, 0];
      if (voice) u.voice = voice;
      u.pitch = Math.max(0.1, Math.min(2, pitch + dp));
      u.rate = Math.max(0.5, Math.min(1.6, rate + dr));
      u.onboundary = e => {
        this.pulse = 1;
        this.word = item.say.slice(e.charIndex).split(/\s+/)[0] || '';
      };
      u.onend = finish;
      u.onerror = finish;
      this.synth.speak(u);
    });
  }

  fakeWords(text, ms, alive) {
    const words = text.split(/\s+/);
    const step = ms / words.length;
    words.forEach((w, i) => setTimeout(() => { if (alive()) { this.pulse = 1; this.word = w; } }, i * step));
  }

  queued() { return 0; }
  get speaking() { return this.playing; }

  interrupt() {
    this.gen++;
    this.items = [];
    this.current = null;
    this.playing = false;
    try { this.synth?.cancel(); } catch { /* ignore */ }
  }

  pauseSpeech(paused) {
    try { paused ? this.synth?.pause() : this.synth?.resume(); } catch { /* ignore */ }
  }

  /** Mouth openness (0..1) and round-vowel guess, from the word being spoken. */
  sample() {
    const t = performance.now();
    let target = 0;
    if (this.current) {
      this.pulse *= 0.93;
      // syllable-ish wobble, kicked up at each word boundary
      target = 0.25 + 0.55 * Math.abs(Math.sin(t / 85)) * (0.5 + 0.5 * this.pulse) + 0.2 * this.pulse;
    }
    this.level += (Math.min(1, target) - this.level) * 0.5;
    this.round = !!this.current && /[ouw]/i.test(this.word || '') && Math.sin(t / 170) > 0.4;
    return { level: this.level, round: this.round };
  }

  /** Playshow: lines become text "chunks" spoken in the character's voice. */
  makeVoicePool() {
    return {
      perform: async (voice, text, emotion) => [{ say: text, voice, emotion }],
      closeAll: () => {},
    };
  }

  async close() { this.interrupt(); }
}

// ------------------------------------------------------------------ Playshow scripts

/**
 * fetch() stand-in for Gemini generateContent: sends the same prompt and JSON schema to Claude and
 * wraps the answer like a Gemini reply. (Requests with audio can't be answered here.)
 */
export async function claudeFetch(url, init = {}) {
  const reply = (status, body) => ({ ok: status === 200, status, json: async () => body });
  if (!/generateContent/.test(String(url))) return reply(404, { error: { message: 'not available in the web version' } });
  const sample = await getSample();
  if (!sample) return reply(400, { error: { message: NO_SAMPLE } });
  let body;
  try { body = JSON.parse(init.body); } catch { return reply(400, { error: { message: 'bad request' } }); }
  const parts = body.contents?.flatMap(c => c.parts || []) || [];
  if (parts.some(p => p.inlineData)) return reply(400, { error: { message: 'Hosting with the mic needs the full app.' } });
  const prompt = parts.map(p => p.text || '').join('\n');
  const cfg = body.generationConfig || {};
  const schema = cfg.responseSchema || cfg.responseJsonSchema;
  const input = `${prompt}\n\nReply with only one JSON value that matches this JSON Schema:\n${JSON.stringify(toJsonSchema(schema))}`;
  try {
    const data = await sample.json(input, { cache: false, modelTier: cfg.thinkingConfig?.thinkingLevel === 'high' ? 'complex' : 'default' });
    return reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] });
  } catch (e) {
    // 400 stops the model-fallback loop: every "model" here is the same Claude
    return reply(400, { error: { message: sampleError(e) } });
  }
}
