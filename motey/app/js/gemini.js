/* Motey – Gemini API client.
 *   Gemini 3.8 Flash       → summaries, catch-up, TikTok scripts, game levels, questions
 *   Gemini 3.8 Flash Live  → Live AI (the style swap, with Motey's voice) and Live Replace
 *
 * Two ways to reach Gemini:
 *   1. Motey-servern (Mer → Prenumeration): the server holds the API key and
 *      counts usage per subscription. This is how a published Motey should run.
 *   2. Your own key (Mer → AI), stored only on this device – for testing.
 * Model ids are looked up from the models list, so "3.8 Flash" and
 * "3.8 Flash Live" resolve to whatever exact ids Google publishes. */
(function () {
  'use strict';
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const LIVE_WS = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
  const DEFAULTS = { flash: 'gemini-3.8-flash', live: 'gemini-3.8-flash-live' };
  const S = () => Store.settings;
  const server = () => (S().serverUrl || '').replace(/\/+$/, '');
  const key = () => S().geminiKey || '';
  const available = () => !!(server() || key());

  class GeminiError extends Error { constructor(msg, status, kind) { super(msg); this.status = status; this.kind = kind; } }

  async function request(path, opts) {
    const url = server() ? `${server()}/v1/ai${path}` : `${S().geminiApi || API}${path}`;
    const headers = { 'content-type': 'application/json' };
    if (server()) headers.authorization = 'Bearer ' + Plans.token(); else headers['x-goog-api-key'] = key();
    const res = await fetch(url, Object.assign({ headers }, opts));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && (data.error.message || data.error)) || 'HTTP ' + res.status;
      throw new GeminiError(String(msg), res.status, data.error && data.error.kind);
    }
    return data;
  }

  /* ---------- model ids ---------- */
  let resolved = null;
  async function models() {
    if (S().modelFlash && S().modelLive) return { flash: S().modelFlash, live: S().modelLive };
    if (!resolved) {
      resolved = (async () => {
        const out = Object.assign({}, DEFAULTS);
        try {
          const d = await request('/models?pageSize=1000', { method: 'GET' });
          const list = (d.models || []).map(m => ({ id: m.name.replace(/^models\//, ''), methods: m.supportedGenerationMethods || [] }));
          const pick = (rx, method) => {
            const c = list.filter(m => rx.test(m.id) && m.methods.includes(method));
            // prefer stable ids over previews, shortest name wins
            c.sort((a, b) => (/preview|exp/.test(a.id) - /preview|exp/.test(b.id)) || a.id.length - b.id.length);
            return c[0] && c[0].id;
          };
          out.flash = pick(/^gemini-3\.8-flash(?!.*(live|audio|tts|image|lite))/, 'generateContent') || out.flash;
          out.live = pick(/3\.8-flash.*(live|native-audio)|live.*3\.8-flash/, 'bidiGenerateContent') || out.live;
        } catch (e) { console.warn('kunde inte läsa modellistan, använder standardnamn', e.message); }
        return out;
      })();
    }
    const r = await resolved;
    return { flash: S().modelFlash || r.flash, live: S().modelLive || r.live };
  }

  /* ---------- Gemini 3.8 Flash: one request, text or JSON back ---------- */
  // schema uses Gemini's OpenAPI subset: {type:'OBJECT', properties, required}
  async function generate({ system, prompt, parts, schema, action, temperature }) {
    const m = (await models()).flash;
    const body = {
      contents: [{ role: 'user', parts: parts || [{ text: prompt }] }],
      generationConfig: { temperature: temperature == null ? 0.7 : temperature }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (schema) { body.generationConfig.responseMimeType = 'application/json'; body.generationConfig.responseSchema = schema; }
    if (server()) body.motey = { action }; // the server meters it; Google never sees this field
    const d = await request(`/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', body: JSON.stringify(body) });
    if (d.promptFeedback && d.promptFeedback.blockReason) throw new GeminiError('blockerad: ' + d.promptFeedback.blockReason, 400, 'blocked');
    const c = (d.candidates || [])[0];
    const text = c && c.content && (c.content.parts || []).map(p => p.text || '').join('');
    if (!text) throw new GeminiError('tomt svar' + (c && c.finishReason ? ' (' + c.finishReason + ')' : ''), 500);
    if (d.motey && window.Plans) Plans.serverUsage(d.motey);
    return schema ? JSON.parse(text) : text.trim();
  }
  const S_ = {
    str: { type: 'STRING' }, int: { type: 'INTEGER' },
    arr: items => ({ type: 'ARRAY', items }),
    obj: (properties, required) => ({ type: 'OBJECT', properties, required: required || Object.keys(properties) })
  };

  /* ---------- Gemini 3.8 Flash Live: a two-way WebSocket session ---------- */
  class Live {
    constructor(opts) {
      this.o = opts; // { system, voice, modality: 'AUDIO'|'TEXT', action, onText, onAudio, onIn, onTurn, onClose, onError }
      this.ws = null; this.ready = null; this.closed = false;
    }
    async open() {
      const m = (await models()).live;
      const url = server()
        ? `${server().replace(/^http/, 'ws')}/v1/ai/live?token=${encodeURIComponent(Plans.token())}&action=${encodeURIComponent(this.o.action || 'live')}`
        : `${S().geminiWs || LIVE_WS}?key=${encodeURIComponent(key())}`;
      this.ready = new Promise((resolve, reject) => {
        const ws = this.ws = new WebSocket(url);
        ws.onopen = () => {
          const setup = {
            model: 'models/' + m,
            generationConfig: { responseModalities: [this.o.modality || 'AUDIO'] },
            systemInstruction: { parts: [{ text: this.o.system || '' }] },
            outputAudioTranscription: {},
            inputAudioTranscription: {}
          };
          if ((this.o.modality || 'AUDIO') === 'AUDIO') setup.generationConfig.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.o.voice || 'Puck' } } };
          ws.send(JSON.stringify({ setup }));
        };
        ws.onmessage = async ev => {
          const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
          let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
          if (msg.setupComplete) return resolve(this);
          if (msg.motey && window.Plans) Plans.serverUsage(msg.motey);
          if (msg.error) { const e = new GeminiError(msg.error.message || 'fel', msg.error.code, msg.error.kind); this.o.onError && this.o.onError(e); return reject(e); }
          const sc = msg.serverContent;
          if (!sc) return;
          if (sc.inputTranscription && sc.inputTranscription.text) this.o.onIn && this.o.onIn(sc.inputTranscription.text);
          if (sc.outputTranscription && sc.outputTranscription.text) this.o.onText && this.o.onText(sc.outputTranscription.text);
          for (const p of (sc.modelTurn && sc.modelTurn.parts) || []) {
            if (p.text && this.o.onText && this.o.modality === 'TEXT') this.o.onText(p.text);
            if (p.inlineData && /audio/.test(p.inlineData.mimeType) && this.o.onAudio) this.o.onAudio(p.inlineData.data, p.inlineData.mimeType);
          }
          if (sc.interrupted && this.o.onInterrupt) this.o.onInterrupt();
          if (sc.turnComplete && this.o.onTurn) this.o.onTurn();
        };
        ws.onerror = () => reject(new GeminiError('kunde inte ansluta till Gemini Live', 0));
        ws.onclose = ev => {
          this.closed = true;
          if (ev.code === 4402 || ev.code === 4403) this.o.onError && this.o.onError(new GeminiError(ev.reason || 'kvoten är slut', 402, 'quota'));
          this.o.onClose && this.o.onClose(ev);
          reject(new GeminiError(ev.reason || 'stängd', ev.code));
        };
      });
      return this.ready;
    }
    text(t) { this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text: t }] }], turnComplete: true } }); }
    audio(b64) { this.send({ realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } } }); }
    send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
    close() { this.closed = true; try { this.ws && this.ws.close(); } catch (e) { /* closed */ } }
  }

  /* ---------- audio helpers ---------- */
  const AC = window.AudioContext || window.webkitAudioContext;
  // One or more MediaStreams (mixed) → 16 kHz 16-bit PCM chunks (base64) every ~130 ms.
  function pcmCapture(streams, onChunk) {
    const ctx = new AC({ sampleRate: 16000 });
    const mix = ctx.createGain();
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const ratio = ctx.sampleRate / 16000;
    proc.onaudioprocess = e => {
      const f = e.inputBuffer.getChannelData(0);
      const n = Math.floor(f.length / ratio);
      const out = new Int16Array(n);
      for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f[Math.floor(i * ratio)])); out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
      onChunk(Platform.bufToB64(out.buffer));
    };
    const mute = ctx.createGain(); mute.gain.value = 0;
    mix.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    const srcs = [];
    const add = st => { if (st && st.getAudioTracks().length) { const src = ctx.createMediaStreamSource(new MediaStream(st.getAudioTracks())); src.connect(mix); srcs.push(src); } };
    [].concat(streams).forEach(add);
    if (ctx.state === 'suspended') ctx.resume();
    return { ctx, add, stop() { try { srcs.forEach(x => x.disconnect()); proc.disconnect(); ctx.close(); } catch (e) { /* closed */ } } };
  }
  // 24 kHz PCM from Gemini → speakers (and optionally a MediaStream for calls).
  function pcmPlayer(opts) {
    opts = opts || {};
    const ctx = new AC();
    const out = ctx.createGain();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    out.connect(an);
    if (opts.speakers !== false) out.connect(ctx.destination);
    const dest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (dest) out.connect(dest);
    let at = 0;
    const sources = new Set();
    const lvl = new Uint8Array(an.fftSize);
    return {
      ctx, stream: dest && dest.stream,
      play(b64, mime) {
        if (ctx.state === 'suspended') ctx.resume();
        const rate = +((mime || '').match(/rate=(\d+)/) || [0, 24000])[1];
        const bin = atob(b64), n = bin.length >> 1;
        const buf = ctx.createBuffer(1, n, rate), ch = buf.getChannelData(0);
        for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[i] = v / 0x8000; }
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(out);
        at = Math.max(at, ctx.currentTime + 0.03); s.start(at); at += buf.duration;
        sources.add(s); s.onended = () => sources.delete(s);
      },
      flush() { sources.forEach(s => { try { s.stop(); } catch (e) { /* done */ } }); sources.clear(); at = 0; },
      level() { an.getByteTimeDomainData(lvl); let m = 0; for (const v of lvl) m = Math.max(m, Math.abs(v - 128)); return m / 128; },
      speaking() { return ctx.currentTime < at; },
      close() { this.flush(); try { ctx.close(); } catch (e) { /* closed */ } }
    };
  }

  const VOICES = [['Puck', 'Glad (Motey)'], ['Kore', 'Lugn'], ['Aoede', 'Ljus'], ['Charon', 'Djup'], ['Fenrir', 'Energisk'], ['Leda', 'Mjuk']];

  window.Gemini = { available, generate, Live, models, pcmCapture, pcmPlayer, schema: S_, GeminiError, VOICES, DEFAULTS, reset() { resolved = null; } };
})();
