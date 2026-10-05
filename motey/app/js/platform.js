/* Motey – platform bridge.
 * Same app runs in a browser, in the Android shell (window.MoteyAndroid,
 * injected by the APK) and in the desktop shell (Neutralino: NL_TOKEN/NL_PORT
 * globals and a WebSocket to the native core). */
(function () {
  'use strict';

  const android = () => window.MoteyAndroid || null;
  const desktop = () => !!(window.NL_TOKEN && window.NL_PORT);
  const kind = () => android() ? 'android' : desktop() ? 'desktop' : 'web';

  /* ---- minimal Neutralino native client (same wire format as neutralino.js) ---- */
  let ws = null, wsReady = null;
  const calls = {};
  function nlConnect() {
    if (wsReady) return wsReady;
    wsReady = new Promise((resolve, reject) => {
      const token = window.NL_TOKEN || '';
      ws = new WebSocket(`ws://127.0.0.1:${window.NL_PORT}?connectToken=${token.split('.')[1] || ''}`);
      ws.addEventListener('open', () => resolve(ws));
      ws.addEventListener('error', reject);
      ws.addEventListener('message', ev => {
        let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
        const c = msg.id && calls[msg.id];
        if (!c) return;
        delete calls[msg.id];
        if (msg.data && msg.data.error) c.reject(msg.data.error);
        else c.resolve(msg.data && 'returnValue' in msg.data ? msg.data.returnValue : msg.data);
      });
    });
    return wsReady;
  }
  async function nl(method, data) {
    await nlConnect();
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
    return new Promise((resolve, reject) => {
      calls[id] = { resolve, reject };
      ws.send(JSON.stringify({ id, method, data, accessToken: window.NL_TOKEN }));
    });
  }

  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  async function blobToB64(blob) { return bufToB64(await blob.arrayBuffer()); }

  /* Save a file where the user can find it. Returns a short human message. */
  async function saveFile(name, blob) {
    if (android()) {
      const msg = android().saveFile(name, await blobToB64(blob), blob.type || 'application/octet-stream');
      return msg || `Sparad i Hämtade filer: ${name}`;
    }
    if (desktop()) {
      try {
        const path = await nl('os.showSaveDialog', { title: 'Spara ' + name, defaultPath: name });
        if (!path) return 'Avbrutet';
        await nl('filesystem.writeBinaryFile', { path, data: await blobToB64(blob) });
        return 'Sparad: ' + path;
      } catch (e) { /* fall through to browser download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'Nedladdad: ' + name;
  }

  async function openUrl(url) {
    if (android()) { android().openUrl(url); return; }
    if (desktop()) { try { await nl('os.open', { url }); return; } catch (e) { /* fallback */ } }
    if (url.startsWith('mailto:')) location.href = url; else window.open(url, '_blank', 'noopener');
  }

  /* ---- speech ---- */
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /^sv/i.test(v.lang)) || vs.find(v => /swed/i.test(v.name)) || null;
    return voice;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  // Strip emoji so the voice doesn't read them out loud.
  const clean = t => String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

  function speak(text, opts) {
    opts = opts || {};
    const t = clean(text);
    if (!t || (window.Store && Store.settings && !Store.settings.voice)) { opts.onend && setTimeout(opts.onend, 1200 + t.length * 45); return; }
    if (android() && android().speak) {
      android().speak(t, String(opts.rate || 1), String(opts.pitch || 1));
      // Android TTS has no JS callback; estimate the duration.
      opts.onend && setTimeout(opts.onend, 900 + t.length * 62 / (opts.rate || 1));
      return;
    }
    if (!('speechSynthesis' in window)) { opts.onend && setTimeout(opts.onend, 900 + t.length * 55); return; }
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'sv-SE';
    if (voice || pickVoice()) u.voice = voice;
    u.rate = opts.rate || 1.02; u.pitch = opts.pitch || 1.15;
    let done = false;
    const end = () => { if (!done) { done = true; opts.onend && opts.onend(); } };
    u.onend = end; u.onerror = end;
    // Some engines never fire onend; never block the UI on it.
    setTimeout(end, 2500 + t.length * 90);
    speechSynthesis.speak(u);
  }
  function stopSpeaking() {
    if (android() && android().stopSpeaking) android().stopSpeaking();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  /* ---- speech recognition (only where the engine offers it) ---- */
  function recognizer() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return null;
    const r = new R();
    r.lang = 'sv-SE'; r.continuous = true; r.interimResults = false;
    return r;
  }

  window.Platform = { kind, saveFile, openUrl, speak, stopSpeaking, recognizer, blobToB64, bufToB64, nl };
})();
