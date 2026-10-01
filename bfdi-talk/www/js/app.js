import { Face, preloadSprites, AI_EMOTIONS, EXPRESSIONS } from './face.js';
import { BODIES, COLORS, drawCharacter } from './character.js';
import { LiveSocket, AudioEngine, MODELS, VOICES } from './live.js';
import { Usage, USAGE, formatDuration } from './usage.js';
import { verifyScreenshot, STORE_URL } from './purchase.js';
import { openExternal, loadBuildConfig, isCapacitor } from './platform.js';

const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ settings

const PERSONAS = {
  'Cheerful & silly': 'Super cheerful, bouncy and a little silly. Loves puns, gets excited easily and cheers the user on.',
  'Sassy diva': 'A dramatic, sassy diva who thinks they are the star of the show, but is secretly sweet.',
  'Grumpy softie': 'Grumpy and sarcastic on the outside, but clearly cares about the user deep down.',
  'Nervous & polite': 'Very polite, a bit nervous and easily startled, apologises a lot and gets flustered.',
  'Competitive champ': 'Extremely competitive, wants to win every challenge, talks like a sports commentator.',
  'Know-it-all': 'Loves facts and explaining things, a bit of a show-off, but happy to help with homework.',
};

const DEFAULTS = {
  name: 'Bouncy',
  body: 'ball',
  color: '#3ec7ff',
  voice: 'Puck',
  model: 'live',
  persona: PERSONAS['Cheerful & silly'],
  pushToTalk: false,
  greet: true,
  apiKey: '',
};
const SETTINGS_KEY = 'bfdi.settings.v1';

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return { ...DEFAULTS }; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

const settings = loadSettings();
const usage = new Usage();
const audio = new AudioEngine();
let buildConfig = {};
let sprites, face, parts;

// ------------------------------------------------------------------ helpers

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

let lastStatus = '';
function setStatus(html, cls = '') {
  if (html + cls === lastStatus) return;
  lastStatus = html + cls;
  const s = $('status');
  s.innerHTML = html;
  s.className = 'status ' + cls;
}

function apiKey() { return (settings.apiKey || buildConfig.GEMINI_API_KEY || '').trim(); }

function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ------------------------------------------------------------------ character

function buildCharacter() {
  const keep = face?.emotion || 'neutral';
  parts = drawCharacter($('character'), settings.body, settings.color);
  face = new Face({ ...parts, sprites });
  face.setEmotion(usage.locked ? 'knockedOut' : keep);
  $('bubbleName').textContent = settings.name;
}

function systemPrompt() {
  const shape = (BODIES[settings.body] || BODIES.ball).label.toLowerCase();
  return [
    `You are ${settings.name}, a cartoon object character (a ${shape} with stick arms and legs and a big expressive face) in a fan-made object show in the style of Battle for Dream Island (BFDI).`,
    `Your personality: ${settings.persona}`,
    'You are on a live voice call with a BFDI fan. Talk like a lively cartoon character: short, punchy replies (usually 1-3 sentences) unless they ask for more. Stay kid-friendly and kind.',
    'You know a lot about BFDI, BFDIA, IDFB, BFB, TPOT, jacknjellify and object shows in general, and love chatting about contestants, eliminations, recommended characters and fan theories. If you are unsure about a fact, say so in character instead of making it up.',
    `IMPORTANT: Your face is animated. Right before you start speaking each reply, call set_expression with the emotion that fits what you are about to say (${AI_EMOTIONS.join(', ')}). If your feeling changes mid-reply, call it again. Never say the function name or emotion label out loud.`,
  ].join('\n');
}

// Fallback when the model forgets to call set_expression: guess from the words it is saying.
function guessEmotion(text) {
  const t = text.toLowerCase();
  if (/\b(ha){2,}|lol|hehe|that's hilarious/.test(t)) return 'laughing';
  if (/\b(sorry|sad|unfortunately|miss (you|them)|cry|eliminated)\b/.test(t)) return 'sad';
  if (/\b(angry|furious|how dare|unfair|ugh)\b/.test(t)) return 'angry';
  if (/\b(scary|scared|afraid|yikes|eek)\b/.test(t)) return 'scared';
  if (/\b(wow|whoa|what\?!|no way|really\?)/.test(t)) return 'surprised';
  if (/\b(hmm|let me think|i wonder|maybe)\b/.test(t)) return 'thinking';
  if ((t.match(/!/g) || []).length >= 2) return 'excited';
  if (/!/.test(t)) return 'happy';
  return null;
}

// ------------------------------------------------------------------ session

const session = {
  sock: null,
  state: 'idle',        // idle | connecting | live
  model: null,
  timer: null,
  lastActivity: 0,
  lastEmotionAt: 0,
  pendingEmotion: null,
  newTurn: true,
  replyText: '',
  userText: '',
  userTurnOpen: false,
  pttHeld: false,
  reconnecting: false,
};

const IDLE_HANGUP_MS = 75 * 1000;

function wireSocket(sock) {
  sock.addEventListener('audio', e => {
    if (sock !== session.sock) return;
    audio.playChunk(e.detail.data);
    session.lastActivity = Date.now();
    session.userTurnOpen = false;
  });
  sock.addEventListener('emotion', e => {
    if (sock !== session.sock || !EXPRESSIONS[e.detail.emotion]) return;
    session.lastEmotionAt = Date.now();
    // If speech is still queued from the previous sentence, switch faces when that finishes.
    const at = audio.ctx ? audio.ctx.currentTime + audio.queued() : 0;
    session.pendingEmotion = { emotion: e.detail.emotion, at };
  });
  sock.addEventListener('outText', e => {
    if (sock !== session.sock) return;
    if (session.newTurn) { session.replyText = ''; session.newTurn = false; }
    session.replyText += e.detail.text;
    $('bubble').hidden = false;
    $('bubbleText').textContent = session.replyText.trim();
    $('bubbleText').scrollTop = 1e6;
    if (Date.now() - session.lastEmotionAt > 6000 && session.replyText.length > 12) {
      const g = guessEmotion(session.replyText);
      if (g) { session.pendingEmotion = { emotion: g, at: 0 }; session.lastEmotionAt = Date.now(); }
    }
  });
  sock.addEventListener('inText', e => {
    if (sock !== session.sock) return;
    if (!session.userTurnOpen) { session.userText = ''; session.userTurnOpen = true; }
    session.userText += e.detail.text;
    session.lastActivity = Date.now();
    $('youSaid').hidden = false;
    $('youSaid').textContent = session.userText.trim();
  });
  sock.addEventListener('interrupted', () => { if (sock === session.sock) audio.interrupt(); });
  sock.addEventListener('turnComplete', () => { if (sock === session.sock) session.newTurn = true; });
  sock.addEventListener('goAway', () => { if (sock === session.sock) reconnect(); });
  sock.addEventListener('close', e => {
    if (sock !== session.sock || e.detail.byUs) return;
    // Server dropped us mid-chat: resume the same conversation once, otherwise end the call.
    if (sock.handle && e.detail.code !== 1007 && e.detail.code !== 1008 && !session.reconnecting) reconnect();
    else endSession(friendlyEnd(e.detail));
  });
}

function friendlyEnd({ code, reason }) {
  if (/api key|permission|unauth/i.test(reason || '')) return 'The Gemini API key was rejected. Check Settings.';
  return reason ? `Call ended: ${reason}` : `Call ended (code ${code}).`;
}

async function reconnect() {
  if (session.reconnecting || !session.sock) return;
  session.reconnecting = true;
  const old = session.sock;
  const sock = new LiveSocket({ apiKey: apiKey(), model: session.model, voice: settings.voice, systemPrompt: systemPrompt(), emotions: AI_EMOTIONS });
  sock.handle = old.handle;
  wireSocket(sock);
  try {
    await sock.connect();
    session.sock = sock;
    old.close();
  } catch (err) {
    session.sock = old;
    endSession(err.message);
  } finally {
    session.reconnecting = false;
  }
}

async function startSession() {
  if (session.state !== 'idle') return;
  usage.tick();
  if (usage.locked) { showLocked(); return; }
  if (!apiKey()) {
    toast('Add a Gemini API key in Settings first.');
    openSettings();
    return;
  }
  session.state = 'connecting';
  renderControls();
  const model = MODELS[settings.model];
  setStatus(`Connecting to <b>${model.label}</b>…`);

  try {
    await audio.init();
  } catch (err) {
    session.state = 'idle';
    renderControls();
    setStatus('Audio could not start on this device.');
    toast(err.message || 'Audio could not start.');
    return;
  }

  const sock = new LiveSocket({ apiKey: apiKey(), model, voice: settings.voice, systemPrompt: systemPrompt(), emotions: AI_EMOTIONS });
  session.sock = sock;
  session.model = model;
  wireSocket(sock);

  try {
    await sock.connect();
  } catch (err) {
    session.sock = null;
    session.state = 'idle';
    renderControls();
    setStatus('Could not connect. Tap <b>Talk</b> to try again.');
    toast(err.message, 5000);
    return;
  }
  if (session.sock !== sock) return; // hung up while connecting

  let micOk = true;
  try {
    await audio.startMic();
  } catch {
    micOk = false;
    toast('Microphone is blocked — you can still type to chat.', 5000);
  }
  audio.onMicChunk = b64 => session.sock?.sendAudio(b64);
  audio.micEnabled = micOk && (!settings.pushToTalk || session.pttHeld);

  session.state = 'live';
  session.lastActivity = Date.now();
  session.newTurn = true;
  $('muteBtn').setAttribute('aria-pressed', 'false');
  renderControls();
  setStatus(settings.pushToTalk ? 'Hold the button and talk' : `Listening… say hi to ${escapeHtml(settings.name)}!`);

  let last = performance.now();
  session.timer = setInterval(() => {
    const now = performance.now();
    const secs = (now - last) / 1000;
    last = now;
    if (!usage.consume(secs, session.model.cost)) {
      endSession(null);
      showLocked();
      return;
    }
    if (Date.now() - session.lastActivity > IDLE_HANGUP_MS && !audio.speaking) {
      endSession('Hung up after a quiet minute to save your usage.');
    }
  }, 1000);

  if (settings.greet) sock.sendText('(The user just joined the voice call. Greet them in one short, excited sentence.)');
}

function endSession(message) {
  const sock = session.sock;
  session.sock = null;
  clearInterval(session.timer);
  session.timer = null;
  sock?.close();
  audio.interrupt();
  audio.stopMic();
  session.state = 'idle';
  session.pttHeld = false;
  renderControls();
  if (!usage.locked) {
    setStatus('Tap <b>Talk</b> to start!');
    session.pendingEmotion = { emotion: 'neutral', at: 0 };
  }
  if (message) toast(message, 5000);
}

function showLocked() {
  face?.setEmotion('knockedOut');
  $('bubble').hidden = false;
  $('bubbleText').textContent = "I'm all tuckered out! Give me an hour to recharge… or grab some Usage Credits!";
  renderControls();
  renderUsage();
}

// ------------------------------------------------------------------ UI rendering

function renderUsage() {
  usage.tick();
  const p = usage.percent;
  const base = Math.min(p, 100);
  const fill = $('usageFill');
  fill.style.width = `${base}%`;
  fill.className = 'usage-fill' + (base < 15 ? ' low' : base < 40 ? ' mid' : '');
  $('usageBonus').style.width = p > 100 ? `${Math.min(100, p - 100)}%` : '0';
  $('usagePct').textContent = `${p >= 10 ? Math.floor(p) : p.toFixed(1)}%`;
  const model = MODELS[settings.model];
  if (usage.locked) {
    $('usageSub').textContent = `Recharging — back in ${formatDuration(usage.msLeft)}`;
  } else {
    const mins = usage.minutesLeft(model.cost);
    $('usageSub').textContent = `≈ ${mins >= 10 ? Math.round(mins) : mins.toFixed(1)} min on ${model.short}${p > 100 ? ' · bonus credits!' : ''}`;
  }
}

function renderControls() {
  const btn = $('talkBtn');
  const locked = usage.locked;
  btn.classList.toggle('live', session.state === 'live' && !settings.pushToTalk);
  btn.classList.toggle('ptt-live', session.state === 'live' && settings.pushToTalk);
  btn.classList.toggle('connecting', session.state === 'connecting');
  btn.disabled = locked && session.state === 'idle';
  let label = 'Talk';
  if (locked && session.state === 'idle') label = formatDuration(usage.msLeft);
  else if (session.state === 'connecting') label = '…';
  else if (session.state === 'live') label = settings.pushToTalk ? 'Hold' : 'Hang up';
  $('talkLabel').textContent = label;
  $('muteBtn').disabled = session.state !== 'live' || settings.pushToTalk;
  if (settings.pushToTalk && session.state === 'live') {
    $('muteBtn').disabled = false;
    $('muteBtn').querySelector('span').textContent = 'End';
  } else {
    $('muteBtn').querySelector('span').textContent = $('muteBtn').getAttribute('aria-pressed') === 'true' ? 'Unmute' : 'Mute';
  }
  document.querySelectorAll('.seg').forEach(s => {
    s.setAttribute('aria-checked', String(s.dataset.model === settings.model));
    s.disabled = session.state !== 'idle';
  });
  $('voiceChipName').textContent = settings.voice;
  if (locked && session.state === 'idle') setStatus(`Out of usage — recharging for <b>${formatDuration(usage.msLeft)}</b>`, 'locked');
}

// Animation loop: lip-sync, emotion timing, body squash and arm waving.
function frame(now) {
  if (face) {
    const { level, round } = audio.ctx ? audio.sample() : { level: 0, round: false };
    const pe = session.pendingEmotion;
    if (pe && (!audio.ctx || audio.ctx.currentTime >= pe.at)) {
      if (!usage.locked || pe.emotion === 'knockedOut') face.setEmotion(pe.emotion);
      session.pendingEmotion = null;
    }
    face.update(now, level, round);

    const squash = level * 0.035;
    parts.rig.style.transform = `translateY(${(-level * 8).toFixed(2)}px) scale(${(1 + squash).toFixed(3)}, ${(1 - squash).toFixed(3)})`;
    const lively = ['excited', 'happy', 'laughing', 'angry', 'furious', 'surprised', 'determined'].includes(face.emotion);
    const wave = lively ? Math.sin(now / 150) * level * 28 : Math.sin(now / 700) * 4;
    parts.arms[0].style.transform = `rotate(${(-wave).toFixed(1)}deg)`;
    parts.arms[1].style.transform = `rotate(${wave.toFixed(1)}deg)`;

    $('talkBtn').style.setProperty('--mic', audio.micEnabled ? Math.min(1, audio.micLevel * 8).toFixed(2) : 0);

    if (session.state === 'live') {
      if (audio.speaking) setStatus(`<b>${escapeHtml(settings.name)}</b> is talking…`);
      else if (session.userTurnOpen && Date.now() - session.lastActivity > 700) setStatus(session.model.thinkingLevel ? 'Thinking really hard…' : 'Thinking…');
      else if (settings.pushToTalk) setStatus(session.pttHeld ? 'Listening… let go when you\'re done' : 'Hold the button and talk');
      else setStatus($('muteBtn').getAttribute('aria-pressed') === 'true' ? 'Muted — tap Unmute to talk' : 'Listening…');
    }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ settings dialog

function shapeIcon(key) {
  return `<svg viewBox="0 0 400 400"><path d="${BODIES[key].path}" fill="${settings.color}" transform="translate(0 -10)"/></svg>`;
}

function renderSettings() {
  $('setName').value = settings.name;
  $('shapePicker').innerHTML = Object.keys(BODIES).map(k =>
    `<button type="button" class="shape-opt" role="radio" data-body="${k}" aria-checked="${k === settings.body}">${shapeIcon(k)}${BODIES[k].label}</button>`).join('');
  $('swatches').innerHTML = COLORS.map(c =>
    `<button type="button" class="swatch" role="radio" data-color="${c}" aria-label="Colour ${c}" aria-checked="${c === settings.color}" style="background:${c}"></button>`).join('');
  $('voiceGrid').innerHTML = VOICES.map(([v, d]) =>
    `<button type="button" class="voice-opt" role="radio" data-voice="${v}" aria-checked="${v === settings.voice}"><b>${v}</b><span>${d}</span></button>`).join('');
  $('personaChips').innerHTML = Object.keys(PERSONAS).map(p => `<button type="button" data-persona="${p}">${p}</button>`).join('');
  $('setPersona').value = settings.persona;
  $('setPtt').checked = settings.pushToTalk;
  $('setGreet').checked = settings.greet;
  $('setKey').value = settings.apiKey;
  $('keyHint').textContent = buildConfig.GEMINI_API_KEY
    ? 'This build already includes a key. Paste your own here only if you want to use it instead.'
    : 'No key is built into this copy. Get one at aistudio.google.com and paste it here — it stays on this device.';
}

function openSettings() {
  renderSettings();
  $('settingsDlg').showModal();
}

function wireSettings() {
  $('settingsBtn').onclick = openSettings;
  $('voiceChip').onclick = () => { openSettings(); setTimeout(() => $('voiceGrid').scrollIntoView({ block: 'center' }), 50); };

  $('shapePicker').onclick = e => {
    const b = e.target.closest('[data-body]');
    if (!b) return;
    settings.body = b.dataset.body;
    saveSettings(); buildCharacter(); renderSettings();
  };
  $('swatches').onclick = e => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    settings.color = b.dataset.color;
    saveSettings(); buildCharacter(); renderSettings();
  };
  $('voiceGrid').onclick = e => {
    const b = e.target.closest('[data-voice]');
    if (!b) return;
    settings.voice = b.dataset.voice;
    saveSettings();
    document.querySelectorAll('.voice-opt').forEach(o => o.setAttribute('aria-checked', String(o === b)));
    renderControls();
  };
  $('personaChips').onclick = e => {
    const b = e.target.closest('[data-persona]');
    if (b) $('setPersona').value = PERSONAS[b.dataset.persona];
  };
  $('settingsDlg').addEventListener('close', () => {
    settings.name = $('setName').value.trim() || DEFAULTS.name;
    settings.persona = $('setPersona').value.trim() || DEFAULTS.persona;
    settings.greet = $('setGreet').checked;
    settings.apiKey = $('setKey').value.trim();
    const ptt = $('setPtt').checked;
    if (ptt !== settings.pushToTalk && session.state !== 'idle') endSession('Talk mode changed — press the button to start again.');
    settings.pushToTalk = ptt;
    saveSettings();
    $('bubbleName').textContent = settings.name;
    renderControls();
  });
}

// ------------------------------------------------------------------ buy dialog

function wireBuy() {
  let file = null;
  $('buyBtn').onclick = () => {
    $('verifyResult').hidden = true;
    $('buyDlg').showModal();
  };
  $('openStore').onclick = () => openExternal(STORE_URL);
  $('receiptFile').onchange = e => {
    file = e.target.files[0] || null;
    const img = $('receiptPreview');
    if (file) {
      img.src = URL.createObjectURL(file);
      img.hidden = false;
      $('dropText').textContent = 'Tap to choose a different screenshot';
    }
    $('verifyBtn').disabled = !file;
    $('verifyResult').hidden = true;
  };
  $('verifyBtn').onclick = async () => {
    if (!file) return;
    if (!apiKey()) { toast('Add a Gemini API key in Settings first.'); return; }
    const btn = $('verifyBtn');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const out = $('verifyResult');
    try {
      const r = await verifyScreenshot(file, apiKey(), usage);
      out.hidden = false;
      if (r.ok) {
        const pct = usage.addCredits(r.usd, r.ids);
        out.className = 'verify-result ok';
        out.textContent = `Payment of $${r.usd.toFixed(2)} confirmed — +${pct}% usage added. Thank you!`;
        session.pendingEmotion = { emotion: 'excited', at: 0 };
        $('bubble').hidden = false;
        $('bubbleText').textContent = "WOOHOO! I'm all charged up! Let's talk!";
        renderControls();
        renderUsage();
      } else {
        out.className = 'verify-result bad';
        out.textContent = r.message;
      }
    } catch (err) {
      out.hidden = false;
      out.className = 'verify-result bad';
      out.textContent = `Could not check the screenshot: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check screenshot';
    }
  };
}

// ------------------------------------------------------------------ talk controls

function wireControls() {
  const btn = $('talkBtn');

  btn.addEventListener('click', () => {
    if (settings.pushToTalk) return; // handled by pointer events
    if (session.state === 'idle') startSession();
    else endSession(null);
  });

  // Push-to-talk: hold the big button. The first press also connects.
  const down = e => {
    if (!settings.pushToTalk || btn.disabled) return;
    e.preventDefault();
    session.pttHeld = true;
    audio.interrupt(); // talking over the character cuts it off, like hands-free mode
    if (session.state === 'idle') startSession();
    else if (session.state === 'live') audio.micEnabled = true;
  };
  const up = () => {
    if (!settings.pushToTalk || !session.pttHeld) return;
    session.pttHeld = false;
    if (session.state === 'live') {
      audio.micEnabled = false;
      session.sock?.endAudio();
      session.lastActivity = Date.now();
    }
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('contextmenu', e => e.preventDefault());

  $('muteBtn').onclick = () => {
    if (settings.pushToTalk) { endSession(null); return; }
    const muted = $('muteBtn').getAttribute('aria-pressed') !== 'true';
    $('muteBtn').setAttribute('aria-pressed', String(muted));
    audio.micEnabled = !muted && !!audio.stream;
    if (muted) session.sock?.endAudio();
    renderControls();
  };

  document.querySelector('.model-switch').onclick = e => {
    const seg = e.target.closest('[data-model]');
    if (!seg || session.state !== 'idle') return;
    settings.model = seg.dataset.model;
    saveSettings();
    renderControls();
    renderUsage();
  };

  $('textForm').onsubmit = async e => {
    e.preventDefault();
    const text = $('textInput').value.trim();
    if (!text) return;
    if (session.state === 'idle') {
      const greet = settings.greet;
      settings.greet = false; // the typed message is the opener
      await startSession();
      settings.greet = greet;
    }
    if (session.state !== 'live') return;
    $('textInput').value = '';
    audio.interrupt();
    session.sock.sendText(text);
    session.userTurnOpen = true;
    session.userText = text;
    session.lastActivity = Date.now();
    $('youSaid').hidden = false;
    $('youSaid').textContent = text;
  };

  // Spacebar = push-to-talk / toggle on desktop when not typing.
  window.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    if (settings.pushToTalk) down(e);
    else btn.click();
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'Space' && settings.pushToTalk) up();
  });
}

// ------------------------------------------------------------------ boot

async function boot() {
  buildConfig = await loadBuildConfig();
  sprites = await preloadSprites();
  buildCharacter();
  wireSettings();
  wireBuy();
  wireControls();

  usage.addEventListener('change', renderUsage);
  usage.addEventListener('empty', () => toast("You're out of usage! It refills in 1 hour — or buy Usage Credits.", 6000));
  let wasLocked = usage.locked;
  setInterval(() => {
    renderUsage();
    const locked = usage.locked;
    if (wasLocked && !locked) {
      face.setEmotion('excited');
      $('bubbleText').textContent = "I'm back and fully recharged! Let's talk!";
      toast('Usage refilled to 100%!');
    }
    wasLocked = locked;
    if (session.state === 'idle') renderControls();
  }, 1000);

  renderUsage();
  renderControls();
  if (usage.locked) showLocked();
  else if (!apiKey()) setStatus('Open <b>Settings</b> and add a Gemini API key to start.');

  if (isCapacitor) document.body.classList.add('native');
  requestAnimationFrame(frame);
}

boot();
