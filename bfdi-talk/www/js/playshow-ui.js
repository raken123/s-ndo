// Playshow Mode screens: the studio (show name, cast, premise, saved episodes) and the theater.

import { BODIES, COLORS, drawCharacter } from './character.js';
import { VOICES } from './live.js';
import { PS_LIMITS, activeCast, canEliminate, writeEpisode, hostTurn, pcmChunksToWav, HOST_NAME } from './playshow-script.js';
import { EpisodePlayer } from './playshow.js';

const $ = id => document.getElementById(id);
const KEY = 'bfdi.playshow.v1';
const uid = () => Math.random().toString(36).slice(2, 10);

// Ready-made objects for "Add object" (cycled through).
const TEMPLATES = [
  { name: 'Blocky', body: 'block', color: '#ff9f1c', voice: 'Fenrir', persona: 'Smug and super competitive; thinks being a block makes him the best builder ever.' },
  { name: 'Drip', body: 'drop', color: '#4b6bff', voice: 'Leda', persona: 'Nervous and polite water drop who apologises constantly and is scared of sponges.' },
  { name: 'Starla', body: 'star', color: '#ffd93d', voice: 'Aoede', persona: 'Dramatic diva who wants to be famous and turns everything into a performance.' },
  { name: 'Hearty', body: 'heart', color: '#ff7ac8', voice: 'Laomedeia', persona: 'The sweetest object ever, believes in everyone, cries happy tears a lot.' },
  { name: 'Cardy', body: 'card', color: '#f2f2f2', voice: 'Charon', persona: 'Know-it-all playing card who quotes the rule book in every challenge.' },
  { name: 'Slicey', body: 'slice', color: '#6bdc5c', voice: 'Algenib', persona: 'Grumpy watermelon slice who complains about everything but secretly loves the show.' },
  { name: 'Hosty', body: 'block', color: '#a46bff', voice: 'Orus', persona: 'Loud, over-the-top show host who loves announcing challenges and dramatic eliminations.', host: true },
  { name: 'Bally', body: 'ball', color: '#ff4b4b', voice: 'Puck', persona: 'Hyper, bouncy and always shouting about snacks.' },
];

const PERSONA_CHIPS = {
  'Cheerful': 'Super cheerful and silly, loves puns and cheering others on.',
  'Diva': 'Dramatic diva who thinks they are the star of the show.',
  'Grumpy': 'Grumpy and sarcastic, but secretly cares.',
  'Nervous': 'Nervous, polite and easily startled.',
  'Competitive': 'Wants to win every challenge, no matter what.',
  'Villain': 'A cartoon schemer with silly evil plans that always backfire.',
  'Host': 'Loud, over-the-top show host who loves announcing challenges.',
};

export function initPlayshow(ctx) {
  // ctx: { settings, account, usage, audio, sprites(), apiKey(), toast, openPlans, stopTalking }
  let state = load();
  let live = null; // the episode being hosted by the user right now
  let player = null;
  let editing = null;
  let lastEpisode = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s?.cast?.length) return s;
    } catch { /* fresh */ }
    const me = ctx.settings;
    return {
      showName: 'Battle for the Golden Spoon',
      cast: [
        { id: uid(), name: me.name, body: me.body, color: me.color, voice: me.voice, persona: me.persona, host: false },
        { id: uid(), ...TEMPLATES[0] },
        { id: uid(), ...TEMPLATES[1] },
      ],
      season: { id: 1, eliminated: [] },
      episodes: [],
    };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full */ } };
  const save_ = save;

  const plan = () => ctx.account.plan || 'free';
  const limits = () => PS_LIMITS[plan()];
  const seasonEpisodes = () => state.episodes.filter(e => e.season === state.season.id);
  /** Cast members this plan can use (first N), minus anyone eliminated this season. */
  const usableCast = () => activeCast(state.cast.slice(0, limits().cast), limits().seasons ? state.season : null);

  // ------------------------------------------------------------ studio

  function miniSvg(c, prefix) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const parts = drawCharacter(svg, c.body, c.color, prefix);
    const sprites = ctx.sprites();
    if (sprites) {
      parts.eyesEl.setAttribute('href', 'assets/eyes/eyes_15.png');
      const e = sprites.eyes[15], m = sprites.mouths[1];
      Object.entries({ width: e.w * 1.9, height: e.h * 1.9, x: parts.eyeAnchor.x - e.w * 0.95, y: parts.eyeAnchor.y - e.h * 1.9 * (92 / 110) })
        .forEach(([k, v]) => parts.eyesEl.setAttribute(k, v));
      parts.mouthEl.setAttribute('href', 'assets/mouths/mouth_01.png');
      Object.entries({ width: m.w * 0.95, height: m.h * 0.95, x: parts.mouthAnchor.x - m.w * 0.475, y: parts.mouthAnchor.y - m.h * 0.475 })
        .forEach(([k, v]) => parts.mouthEl.setAttribute(k, v));
    }
    return svg;
  }

  function renderStudio() {
    const L = limits();
    const p = plan();
    $('psPlanBadge').textContent = L.label.toUpperCase();
    $('psPlanBadge').className = `plan-badge ${p}`;
    if (document.activeElement !== $('psShowName')) $('psShowName').value = state.showName;
    $('psHostMe').checked = !!state.hostMe;
    const out = new Set(L.seasons ? state.season.eliminated.map(n => n.toLowerCase()) : []);
    $('psCastCount').textContent = `(${Math.min(state.cast.length, L.cast)}/${L.cast} on ${L.label})`;

    const grid = $('psCast');
    grid.innerHTML = '';
    state.cast.forEach((c, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'ps-member';
      if (i >= L.cast) { card.classList.add('locked'); card.dataset.lock = i >= PS_LIMITS.lite.cast ? 'PRO' : 'LITE'; }
      else if (out.has(c.name.toLowerCase()) && !c.host) card.classList.add('out');
      card.appendChild(miniSvg(c, `pm${i}`));
      card.insertAdjacentHTML('beforeend', `<b></b><small></small>${c.host ? '<span class="ps-host">HOST</span>' : ''}`);
      card.querySelector('b').textContent = c.name;
      card.querySelector('small').textContent = `${BODIES[c.body]?.label || ''} · ${c.voice}`;
      card.onclick = () => openEditor(c.id);
      grid.appendChild(card);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'ps-member add';
    add.innerHTML = '<span>＋</span>Add object';
    add.onclick = addMember;
    grid.appendChild(add);

    const eps = seasonEpisodes();
    $('psSeasonInfo').textContent = L.seasons
      ? `Season ${state.season.id} · ${eps.length} episode${eps.length === 1 ? '' : 's'}${state.season.eliminated.length ? ` · eliminated: ${state.season.eliminated.join(', ')}` : ''}`
      : '';
    $('psNewSeason').hidden = !L.seasons || !eps.length;

    const cast = usableCast();
    const elim = canEliminate(cast, L);
    $('psLimits').innerHTML = `<b>${L.label}:</b> up to ${L.cast} objects · ~${L.lines} lines · ${L.scenes} scene${L.scenes > 1 ? 's' : ''}`
      + (L.eliminations ? (elim ? ' · eliminations ✔' : ' · eliminations need 3+ contestants') : ' · short skits only')
      + (L.seasons ? ' · seasons ✔' : '')
      + (p === 'pro' ? ' · smartest scripts ✔' : ` <button type="button" class="linkish" id="psUpgrade">${p === 'free' ? 'Get Lite or Pro for full episodes' : 'Go Pro for 8 objects & 40-line episodes'}</button>`);
    $('psUpgrade')?.addEventListener('click', ctx.openPlans);
    $('psMake').disabled = cast.length < 2;
    $('psMake').textContent = cast.length < 2 ? 'Add at least 2 objects'
      : state.hostMe ? `🎤 Start hosting episode ${L.seasons ? eps.length + 1 : ''}`.trim()
      : `🎬 Make episode ${L.seasons ? eps.length + 1 : ''}`.trim();
    $('psPremise').disabled = !!state.hostMe;
    $('psPremise').placeholder = state.hostMe
      ? "You're the host — you'll tell everyone the challenge with your mic!"
      : 'What happens? e.g. "The challenge is to bake the biggest cake, but Drip keeps melting the frosting." (optional)';

    const list = $('psEpisodes');
    list.innerHTML = state.episodes.length ? '' : '<p class="hint">Your episodes show up here.</p>';
    [...state.episodes].reverse().forEach(ep => {
      const row = document.createElement('div');
      row.className = 'ps-ep';
      row.innerHTML = '<div><b></b><small></small></div><button type="button" class="btn btn-white small">▶ Play</button>';
      row.querySelector('b').textContent = ep.title;
      row.querySelector('small').textContent = `${ep.showName} · S${ep.season} E${ep.number}${ep.eliminated ? ` · ${ep.eliminated} eliminated` : ''}`;
      row.querySelector('button').onclick = () => playEpisode(ep);
      list.appendChild(row);
    });
  }

  function addMember() {
    if (state.cast.length >= PS_LIMITS.pro.cast) { ctx.toast('A show can have up to 8 objects.'); return; }
    if (state.cast.length >= limits().cast) {
      ctx.toast(`${limits().label} shows can have ${limits().cast} objects — upgrade for a bigger cast!`, 4500);
      ctx.openPlans();
      return;
    }
    const used = new Set(state.cast.map(c => c.name.toLowerCase()));
    const t = TEMPLATES.find(x => !used.has(x.name.toLowerCase())) || { ...TEMPLATES[7], name: `Object ${state.cast.length + 1}` };
    const c = { id: uid(), ...t, host: !!t.host && !state.cast.some(m => m.host) };
    state.cast.push(c);
    save();
    renderStudio();
    openEditor(c.id);
  }

  // ------------------------------------------------------------ cast editor

  function renderEditor() {
    const c = state.cast.find(x => x.id === editing);
    if (!c) return;
    const svg = $('castPreview');
    svg.replaceWith(miniSvg(c, 'castpv'));
    document.querySelector('.cast-preview svg').id = 'castPreview';
    $('castShapes').innerHTML = Object.keys(BODIES).map(k =>
      `<button type="button" class="shape-opt" role="radio" data-body="${k}" aria-checked="${k === c.body}"><svg viewBox="0 0 400 400"><path d="${BODIES[k].path}" fill="${c.color}" transform="translate(0 -10)"/></svg>${BODIES[k].label}</button>`).join('');
    $('castColors').innerHTML = COLORS.map(col =>
      `<button type="button" class="swatch" role="radio" data-color="${col}" aria-label="Colour ${col}" aria-checked="${col === c.color}" style="background:${col}"></button>`).join('');
  }

  function openEditor(id) {
    const c = state.cast.find(x => x.id === id);
    if (!c) return;
    editing = id;
    $('castName').value = c.name;
    $('castVoice').innerHTML = VOICES.map(([v, d]) => `<option value="${v}">${v} — ${d}</option>`).join('');
    $('castVoice').value = c.voice;
    $('castPersona').value = c.persona;
    $('castHost').checked = !!c.host;
    $('castPersonaChips').innerHTML = Object.keys(PERSONA_CHIPS).map(k => `<button type="button" data-p="${k}">${k}</button>`).join('');
    $('castDelete').disabled = state.cast.length <= 2;
    renderEditor();
    $('castDlg').showModal();
  }

  function wireEditor() {
    $('castShapes').onclick = e => {
      const b = e.target.closest('[data-body]');
      const c = state.cast.find(x => x.id === editing);
      if (b && c) { c.body = b.dataset.body; renderEditor(); }
    };
    $('castColors').onclick = e => {
      const b = e.target.closest('[data-color]');
      const c = state.cast.find(x => x.id === editing);
      if (b && c) { c.color = b.dataset.color; renderEditor(); }
    };
    $('castPersonaChips').onclick = e => {
      const b = e.target.closest('[data-p]');
      if (b) $('castPersona').value = PERSONA_CHIPS[b.dataset.p];
    };
    $('castDelete').onclick = () => {
      state.cast = state.cast.filter(x => x.id !== editing);
      editing = null;
      save();
      $('castDlg').close();
      renderStudio();
    };
    $('castDlg').addEventListener('close', () => {
      const c = state.cast.find(x => x.id === editing);
      if (!c) return;
      const name = $('castName').value.trim().slice(0, 20) || c.name;
      if (state.cast.some(x => x !== c && x.name.toLowerCase() === name.toLowerCase())) ctx.toast('Two objects can’t share a name.');
      else c.name = name;
      c.voice = $('castVoice').value;
      c.persona = $('castPersona').value.trim() || c.persona;
      c.host = $('castHost').checked;
      if (c.host) state.cast.forEach(x => { if (x !== c) x.host = false; });
      save();
      renderStudio();
    });
  }

  // ------------------------------------------------------------ theater

  function showTheater(on) {
    if (!on) endLive(false);
    $('psTheater').classList.remove('hosted');
    $('psHostBar').hidden = true;
    $('psStudio').hidden = on;
    $('psTheater').hidden = !on;
    $('psEnd').hidden = true;
    $('psWriting').hidden = true;
    $('psCard').hidden = true;
    $('psSub').hidden = true;
    $('psPause').textContent = '⏸ Pause';
    if (!on) { player?.stop(); player = null; renderStudio(); }
  }

  const WRITING = ['Writing the episode…', 'Building the set…', 'Teaching everyone their lines…', 'Inventing a challenge…', 'Hiding the snacks…', 'Warming up the voices…'];

  async function makeEpisode() {
    if (state.hostMe) return hostEpisode();
    if (!ctx.apiKey()) { ctx.toast('Add a Gemini API key in Settings first.'); return; }
    if (ctx.usage.locked) { ctx.toast('Out of usage — wait for the refill or get Usage Credits.', 4500); return; }
    const L = limits();
    const cast = usableCast();
    if (cast.length < 2) return;
    ctx.stopTalking();
    try { await ctx.audio.init(); } catch (err) { ctx.toast(err.message || 'Audio could not start.'); return; }

    showTheater(true);
    $('psRow').innerHTML = '';
    $('psProgress').style.width = '0';
    $('psWriting').hidden = false;
    let w = 0;
    $('psWritingText').textContent = WRITING[0];
    const ticker = setInterval(() => { $('psWritingText').textContent = WRITING[++w % WRITING.length]; }, 2200);
    const season = L.seasons ? { eliminated: state.season.eliminated, episodes: seasonEpisodes() } : null;
    let script;
    try {
      script = await writeEpisode({
        showName: state.showName, cast, premise: $('psPremise').value, limits: L, season,
        shapeLabel: b => (BODIES[b]?.label || 'object').toLowerCase(),
      }, ctx.apiKey());
    } catch (err) {
      clearInterval(ticker);
      ctx.toast(err.message, 6000);
      showTheater(false);
      return;
    } finally {
      clearInterval(ticker);
    }
    if ($('psTheater').hidden) return; // closed while writing

    const ep = {
      id: uid(), season: state.season.id, number: L.seasons ? seasonEpisodes().length + 1 : state.episodes.length + 1,
      showName: state.showName, createdAt: Date.now(), cast: cast.map(c => ({ ...c })), ...script,
    };
    state.episodes.push(ep);
    if (L.seasons && ep.eliminated && !state.season.eliminated.includes(ep.eliminated)) state.season.eliminated.push(ep.eliminated);
    // Keep the newest episodes up to the plan's limit.
    while (state.episodes.length > L.saved) state.episodes.shift();
    $('psPremise').value = '';
    save();
    $('psWriting').hidden = true;
    playEpisode(ep, true);
  }

  async function playEpisode(ep, alreadyInTheater = false) {
    if (!ctx.apiKey()) { ctx.toast('Add a Gemini API key in Settings first.'); return; }
    if (!alreadyInTheater) {
      if (ctx.usage.locked) { ctx.toast('Out of usage — wait for the refill or get Usage Credits.', 4500); return; }
      ctx.stopTalking();
      try { await ctx.audio.init(); } catch (err) { ctx.toast(err.message || 'Audio could not start.'); return; }
      showTheater(true);
    }
    lastEpisode = ep;
    player?.stop();
    player = new EpisodePlayer({
      els: { row: $('psRow'), sub: $('psSub'), card: $('psCard'), loading: $('psLoading'), progress: $('psProgress') },
      audio: ctx.audio, sprites: ctx.sprites(), cast: ep.cast, episode: ep, number: ep.number,
      showName: ep.showName, apiKey: ctx.apiKey(),
      spend: secs => ctx.usage.consume(secs, 1),
    });
    const me = player;
    me.addEventListener('ended', () => {
      if (player !== me) return;
      $('psEndTitle').textContent = ep.eliminated ? `Goodbye, ${ep.eliminated}!` : 'THE END';
      $('psNext').textContent = limits().seasons ? `▶ Episode ${seasonEpisodes().length + 1}` : '▶ New episode';
      $('psEnd').hidden = false;
    });
    me.addEventListener('outOfUsage', () => {
      if (player !== me) return;
      ctx.toast('Out of usage! The show will go on when your meter refills — or get Usage Credits.', 6000);
      $('psEndTitle').textContent = 'To be continued…';
      $('psEnd').hidden = false;
    });
    me.addEventListener('error', e => {
      if (player !== me) return;
      ctx.toast(e.detail.message, 5000);
      $('psEnd').hidden = false;
    });
    me.play();
  }


  // ------------------------------------------------------------ live hosting

  async function hostEpisode() {
    if (!ctx.apiKey()) { ctx.toast('Add a Gemini API key in Settings first.'); return; }
    if (ctx.usage.locked) { ctx.toast('Out of usage — wait for the refill or get Usage Credits.', 4500); return; }
    const L = limits();
    // Everyone competes when you're the host.
    const cast = usableCast().map(c => ({ ...c, host: false }));
    if (cast.length < 2) return;
    ctx.stopTalking();
    try {
      await ctx.audio.init();
      await ctx.audio.startMic();
    } catch {
      ctx.toast('Your microphone is blocked, so hosting won’t work. Allow the mic, or turn off “I’m the host”.', 6000);
      return;
    }
    ctx.audio.micEnabled = false;
    showTheater(true);
    $('psTheater').classList.add('hosted');
    $('psHostBar').hidden = false;
    $('psRow').innerHTML = '';
    $('psProgress').style.width = '0';

    const number = L.seasons ? seasonEpisodes().length + 1 : state.episodes.length + 1;
    const episode = { title: 'Live with the host!', summary: '', eliminated: '', scenes: [{ card: '', setting: '', lines: [] }], hosted: true, hostVoice: ctx.settings.voice };
    player?.stop();
    player = new EpisodePlayer({
      els: { row: $('psRow'), sub: $('psSub'), card: $('psCard'), loading: $('psLoading'), progress: $('psProgress') },
      audio: ctx.audio, sprites: ctx.sprites(), cast, episode, number, showName: state.showName, apiKey: ctx.apiKey(),
      spend: secs => ctx.usage.consume(secs, 1), stageCast: cast,
    });
    const me = player;
    me.addEventListener('outOfUsage', () => { if (player === me) { ctx.toast('Out of usage! Wrapping up the show.', 5000); endLive(true); } });
    live = { player: me, cast, L, number, episode, transcript: [], castLines: 0, busy: true, chunks: [], recording: false, eliminated: '' };
    renderMic(); // disabled until the intro cards are done
    me.openStage();
    try {
      await me.card(state.showName, `Episode ${number} — hosted by YOU!`, 3000, true);
      await me.card("You're the host! 🎤", 'Hold the mic button (or Space) and welcome everyone', 2600);
    } catch { return; }
    if (live?.player !== me) return;
    live.busy = false;
    renderMic();
  }

  function renderMic() {
    const btn = $('psMicBtn');
    if (!live) return;
    btn.disabled = live.busy;
    btn.classList.toggle('rec', live.recording);
    $('psMicLabel').textContent = live.recording ? 'Listening…' : live.busy ? 'Wait…' : 'Hold to talk';
    const left = live.L.lines - live.castLines;
    $('psProgress').style.width = `${Math.min(100, (live.castLines / live.L.lines) * 100)}%`;
    $('psEndLive').textContent = left <= 0 ? '🏁 Finish' : '🏁 End episode';
  }

  function micDown(e) {
    if (!live || live.busy || live.recording) return;
    e?.preventDefault?.();
    live.recording = true;
    live.chunks = [];
    ctx.audio.interrupt();
    ctx.audio.onMicChunk = c => live?.recording && live.chunks.push(c);
    ctx.audio.micEnabled = true;
    renderMic();
  }

  async function micUp() {
    if (!live || !live.recording) return;
    live.recording = false;
    ctx.audio.micEnabled = false;
    const chunks = live.chunks;
    if (chunks.length < 15) { renderMic(); ctx.toast('Hold the button while you talk.'); return; } // < 0.6 s
    live.busy = true;
    renderMic();
    const me = live.player;
    $('psLoading').hidden = false;
    let turn;
    try {
      const remaining = live.L.lines - live.castLines;
      turn = await hostTurn({
        showName: state.showName, cast: live.cast, limits: live.L, transcript: live.transcript,
        remaining, final: remaining <= 4, eliminatedSoFar: live.eliminated,
      }, pcmChunksToWav(chunks), ctx.apiKey());
    } catch (err) {
      $('psLoading').hidden = true;
      ctx.toast(err.message, 5000);
      if (live) { live.busy = false; renderMic(); }
      return;
    }
    $('psLoading').hidden = true;
    if (!live || live.player !== me) return;
    if (!turn.heard) {
      ctx.toast("Didn't catch that — try again a bit louder.");
      live.busy = false;
      renderMic();
      return;
    }
    me.showHost(turn.heard);
    live.transcript.push({ speaker: HOST_NAME, text: turn.heard });
    await new Promise(r => setTimeout(r, 900));
    if (turn.eliminated) live.eliminated = turn.eliminated;
    const ok = await me.playMore(turn.lines);
    if (!live || live.player !== me) return;
    live.transcript.push(...turn.lines.map(l => ({ speaker: l.speaker, text: l.text, emotion: l.emotion, action: l.action })));
    live.castLines += turn.lines.length;
    if (!ok) return;
    if (live.castLines >= live.L.lines) { endLive(true); return; }
    live.busy = false;
    renderMic();
  }

  /** Ends the hosted episode; saves it when `save` and anything happened. */
  async function endLive(save) {
    if (!live) return;
    const l = live;
    live = null;
    ctx.audio.micEnabled = false;
    ctx.audio.stopMic();
    $('psHostBar').hidden = true;
    if (!save || !l.transcript.length) { l.player.stop(); return; }
    const L = l.L;
    const ep = {
      id: uid(), season: state.season.id, number: l.number, showName: state.showName, createdAt: Date.now(),
      cast: l.cast, hosted: true, hostVoice: l.episode.hostVoice,
      title: `Hosted live${l.eliminated ? `: ${l.eliminated} goes home` : ''}`,
      summary: `The user hosted this episode live. ${l.transcript.filter(x => x.speaker === HOST_NAME).map(x => x.text).join(' ').slice(0, 300)}`,
      eliminated: L.seasons ? l.eliminated : '',
      scenes: [{ card: 'Live!', setting: '', lines: l.transcript.map(x => ({ speaker: x.speaker, text: x.text, emotion: x.emotion || 'neutral', action: x.action || 'none' })) }],
    };
    state.episodes.push(ep);
    if (L.seasons && ep.eliminated && !state.season.eliminated.includes(ep.eliminated)) state.season.eliminated.push(ep.eliminated);
    while (state.episodes.length > L.saved) state.episodes.shift();
    save_();
    lastEpisode = ep;
    try { await l.player.card('THE END', ep.eliminated ? `${ep.eliminated} was eliminated!` : 'What a show, host!', 2600, true); } catch { /* stopped */ }
    l.player.stop();
    $('psEndTitle').textContent = ep.eliminated ? `Goodbye, ${ep.eliminated}!` : 'THE END';
    $('psNext').textContent = '🎤 Host again';
    $('psEnd').hidden = false;
  }

  // ------------------------------------------------------------ wiring

  $('playshowBtn').onclick = () => {
    state.cast.forEach(c => { if (!VOICES.some(([v]) => v === c.voice)) c.voice = 'Puck'; });
    showTheater(false);
    $('playshow').hidden = false;
  };
  $('psClose').onclick = () => { showTheater(false); $('playshow').hidden = true; };
  $('psShowName').onchange = () => { state.showName = $('psShowName').value.trim() || 'My Object Show'; save(); };
  $('psMake').onclick = makeEpisode;
  $('psHostMe').onchange = () => { state.hostMe = $('psHostMe').checked; save(); renderStudio(); };
  $('psMicBtn').addEventListener('pointerdown', micDown);
  $('psMicBtn').addEventListener('pointerup', micUp);
  $('psMicBtn').addEventListener('pointerleave', micUp);
  $('psMicBtn').addEventListener('pointercancel', micUp);
  $('psMicBtn').addEventListener('contextmenu', e => e.preventDefault());
  $('psEndLive').onclick = () => endLive(true);
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat && live && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); e.stopPropagation(); micDown(e); }
  }, true);
  window.addEventListener('keyup', e => { if (e.code === 'Space' && live) { e.stopPropagation(); micUp(); } }, true);
  $('psNewSeason').onclick = () => {
    if (!confirm('Start a new season? Everyone comes back and the episode count starts again.')) return;
    state.season = { id: state.season.id + 1, eliminated: [] };
    save();
    renderStudio();
  };
  $('psPause').onclick = () => { if (player) $('psPause').textContent = player.pause() ? '▶ Resume' : '⏸ Pause'; };
  $('psSkip').onclick = () => player?.skip();
  $('psStop').onclick = () => showTheater(false);
  $('psBack').onclick = () => showTheater(false);
  $('psReplay').onclick = () => { if (lastEpisode) { $('psEnd').hidden = true; playEpisode(lastEpisode, true); } };
  $('psNext').onclick = () => { $('psEnd').hidden = true; makeEpisode(); };
  wireEditor();

  return {
    refresh() { if (!$('playshow').hidden && !$('psStudio').hidden) renderStudio(); },
  };
}
