// Gemini Live (bidiGenerateContent over WebSocket).
// LiveSocket only speaks the protocol (works in Node too, for tests);
// AudioEngine does mic capture, playback and the analyser used for lip-sync.

export const MODELS = {
  live: { id: 'gemini-3.8-live', label: 'Gemini 3.8 Flash Live', short: 'Flash Live', cost: 1 },
  thinking: { id: 'gemini-3.8-live-extended-thinking', label: 'Gemini 3.8 Live Extended Thinking', short: 'Extended Thinking', cost: 2.5, thinkingLevel: 'high' },
};

// Gemini prebuilt voices.
export const VOICES = [
  ['Puck', 'Upbeat'], ['Zephyr', 'Bright'], ['Kore', 'Firm'], ['Fenrir', 'Excitable'], ['Leda', 'Youthful'],
  ['Aoede', 'Breezy'], ['Charon', 'Informative'], ['Orus', 'Firm'], ['Callirrhoe', 'Easy-going'], ['Autonoe', 'Bright'],
  ['Enceladus', 'Breathy'], ['Iapetus', 'Clear'], ['Umbriel', 'Easy-going'], ['Algieba', 'Smooth'], ['Despina', 'Smooth'],
  ['Erinome', 'Clear'], ['Algenib', 'Gravelly'], ['Rasalgethi', 'Informative'], ['Laomedeia', 'Upbeat'], ['Achernar', 'Soft'],
  ['Alnilam', 'Firm'], ['Schedar', 'Even'], ['Gacrux', 'Mature'], ['Pulcherrima', 'Forward'], ['Achird', 'Friendly'],
  ['Zubenelgenubi', 'Casual'], ['Vindemiatrix', 'Gentle'], ['Sadachbia', 'Lively'], ['Sadaltager', 'Knowledgeable'], ['Sulafat', 'Warm'],
];

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export function expressionTool(emotions) {
  return {
    functionDeclarations: [{
      name: 'set_expression',
      description: 'Change your cartoon face to show how you feel. Call this right before you speak each reply, and again whenever your feeling changes.',
      parameters: {
        type: 'OBJECT',
        properties: { emotion: { type: 'STRING', enum: emotions, description: 'The feeling to show on your face.' } },
        required: ['emotion'],
      },
    }],
  };
}

/**
 * Events (EventTarget): open, audio {data: base64 pcm16 @24kHz}, emotion {emotion}, outText {text},
 * inText {text}, turnComplete, interrupted, usage {usageMetadata}, close {code, reason}, error {message}
 */
export class LiveSocket extends EventTarget {
  constructor({ apiKey, model, voice, systemPrompt, emotions }) {
    super();
    Object.assign(this, { apiKey, model, voice, systemPrompt, emotions });
    this.handle = null;
    this.ws = null;
    this.closedByUs = false;
  }

  emit(type, detail = {}) { this.dispatchEvent(Object.assign(new Event(type), { detail })); }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(this.apiKey)}`);
      this.ws = ws;
      let ready = false;
      ws.onopen = () => ws.send(JSON.stringify({ setup: this.setupMessage() }));
      ws.onmessage = async (e) => {
        const text = typeof e.data === 'string' ? e.data : await (e.data.text ? e.data.text() : new Response(e.data).text());
        let msg;
        try { msg = JSON.parse(text); } catch { return; }
        if (msg.setupComplete) {
          ready = true;
          resolve();
          this.emit('open');
          return;
        }
        this.handleMessage(msg);
      };
      ws.onerror = () => { if (!ready) reject(new Error('Could not reach Gemini Live. Check your internet connection.')); };
      ws.onclose = (e) => {
        if (!ready) reject(new Error(friendlyClose(e.code, e.reason)));
        if (this.ws === ws) this.emit('close', { code: e.code, reason: e.reason, byUs: this.closedByUs });
      };
    });
  }

  setupMessage() {
    const m = this.model;
    const generationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } } },
    };
    if (m.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: m.thinkingLevel };
    return {
      model: `models/${m.id}`,
      generationConfig,
      systemInstruction: { parts: [{ text: this.systemPrompt }] },
      tools: [expressionTool(this.emotions)],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: this.handle ? { handle: this.handle } : {},
      contextWindowCompression: { slidingWindow: {} },
    };
  }

  handleMessage(msg) {
    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      this.handle = msg.sessionResumptionUpdate.newHandle;
    }
    if (msg.goAway) this.emit('goAway', msg.goAway);
    if (msg.usageMetadata) this.emit('usage', msg.usageMetadata);

    if (msg.toolCall?.functionCalls) {
      const responses = [];
      for (const fc of msg.toolCall.functionCalls) {
        if (fc.name === 'set_expression' && fc.args?.emotion) this.emit('emotion', { emotion: fc.args.emotion });
        responses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
      }
      this.send({ toolResponse: { functionResponses: responses } });
    }

    const sc = msg.serverContent;
    if (!sc) return;
    if (sc.interrupted) this.emit('interrupted');
    for (const part of sc.modelTurn?.parts || []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/')) this.emit('audio', { data: part.inlineData.data });
    }
    if (sc.outputTranscription?.text) this.emit('outText', { text: sc.outputTranscription.text });
    if (sc.inputTranscription?.text) this.emit('inText', { text: sc.inputTranscription.text });
    if (sc.turnComplete) this.emit('turnComplete');
  }

  send(obj) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  sendAudio(base64) { this.send({ realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } } }); }
  endAudio() { this.send({ realtimeInput: { audioStreamEnd: true } }); }
  sendText(text) { this.send({ realtimeInput: { text } }); }

  close() {
    this.closedByUs = true;
    try { this.ws?.close(1000); } catch { /* already closed */ }
  }
}

export function friendlyClose(code, reason = '') {
  const r = reason || '';
  if (/api key|API_KEY|permission|unauth/i.test(r)) return 'The Gemini API key was rejected. Check it in Settings.';
  if (/quota|exhausted|rate/i.test(r)) return 'Gemini is busy or out of quota right now. Try again in a bit.';
  if (code === 1006) return 'Lost connection to Gemini Live.';
  return r ? `Gemini Live closed: ${r}` : `Gemini Live closed (code ${code}).`;
}

// ---------------------------------------------------------------- audio

const MIC_WORKLET = `
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pending = new Float32Array(0);
    this.t = 0;
    this.out = new Int16Array(640); // 40 ms @ 16 kHz
    this.n = 0;
    this.sq = 0; this.cnt = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    const data = new Float32Array(this.pending.length + input.length);
    data.set(this.pending); data.set(input, this.pending.length);
    let t = this.t;
    while (t + this.ratio < data.length) {
      // box filter over the source window = cheap low-pass before decimating
      const a = Math.floor(t), b = Math.max(a + 1, Math.floor(t + this.ratio));
      let s = 0;
      for (let i = a; i < b; i++) s += data[i];
      s /= (b - a);
      this.sq += s * s; this.cnt++;
      this.out[this.n++] = Math.max(-1, Math.min(1, s)) * 0x7fff;
      if (this.n === this.out.length) {
        this.port.postMessage({ pcm: this.out.buffer.slice(0), level: Math.sqrt(this.sq / this.cnt) });
        this.n = 0; this.sq = 0; this.cnt = 0;
      }
      t += this.ratio;
    }
    const keep = Math.floor(t);
    this.pending = data.slice(keep);
    this.t = t - keep;
    return true;
  }
}
registerProcessor('mic-processor', MicProcessor);
`;

function bytesToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToInt16(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.length >> 1);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sources = new Set();
    this.nextTime = 0;
    this.micLevel = 0;
    this.onMicChunk = null;
    this.micEnabled = false;
    this.timeData = null;
    this.freqData = null;
    this.peak = 0.08;
    this.level = 0;
    this.round = false;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.35;
    this.analyser.connect(this.ctx.destination);
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    const url = URL.createObjectURL(new Blob([MIC_WORKLET], { type: 'application/javascript' }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async startMic() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.micSource = this.ctx.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.ctx, 'mic-processor');
    this.worklet.port.onmessage = ({ data }) => {
      this.micLevel = data.level;
      if (this.micEnabled && this.onMicChunk) this.onMicChunk(bytesToBase64(data.pcm));
    };
    // Keep the worklet pulled by the graph without making the mic audible.
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.micSource.connect(this.worklet).connect(mute).connect(this.ctx.destination);
  }

  stopMic() {
    this.micEnabled = false;
    this.stream?.getTracks().forEach(t => t.stop());
    try { this.micSource?.disconnect(); this.worklet?.disconnect(); } catch { /* ignore */ }
    this.stream = this.micSource = this.worklet = null;
    this.micLevel = 0;
  }

  playChunk(b64) {
    const pcm = base64ToInt16(b64);
    if (!pcm.length) return;
    const buf = this.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    const startAt = Math.max(this.ctx.currentTime + 0.04, this.nextTime);
    src.start(startAt);
    this.nextTime = startAt + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Seconds of already-queued speech still to play. */
  queued() { return this.ctx ? Math.max(0, this.nextTime - this.ctx.currentTime) : 0; }
  get speaking() { return this.sources.size > 0; }

  interrupt() {
    for (const s of this.sources) { try { s.stop(); } catch { /* ignore */ } }
    this.sources.clear();
    this.nextTime = 0;
  }

  /** Reads the output analyser: normalised loudness (0..1) and whether it sounds like a round vowel. */
  sample() {
    if (!this.analyser) return { level: 0, round: false };
    this.analyser.getFloatTimeDomainData(this.timeData);
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) sum += this.timeData[i] * this.timeData[i];
    const rms = Math.sqrt(sum / this.timeData.length);
    // Auto-gain: compare against a slowly decaying peak so quiet and loud voices both animate fully.
    this.peak = Math.max(rms, this.peak * 0.995, 0.04);
    const target = rms < 0.008 ? 0 : Math.min(1, rms / (this.peak * 0.85));
    this.level += (target - this.level) * (target > this.level ? 0.6 : 0.35);

    // "oo"/"oh" vowels put most energy below ~900 Hz; compare that band to 0.9–4 kHz.
    // Byte data is dB-scaled (-100..-30 dB), so convert back to linear power first.
    // Threshold calibrated on Gemini voices: roughly the roundest 15-20% of loud frames.
    this.analyser.getByteFrequencyData(this.freqData);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    let low = 0, mid = 0;
    for (let i = 1; i < this.freqData.length; i++) {
      const hz = i * binHz;
      if (hz >= 4000) break;
      const v = this.freqData[i];
      if (!v) continue;
      const pow = 10 ** ((v / 255) * 7 - 10);
      if (hz >= 150 && hz < 900) low += pow;
      else if (hz >= 900) mid += pow;
    }
    this.round = target > 0.3 && low > mid * 150;
    return { level: this.level, round: this.round };
  }

  async close() {
    this.interrupt();
    this.stopMic();
  }
}
