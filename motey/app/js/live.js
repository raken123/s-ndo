/* Motey Live AI (example 2): replace a speaker with Motey – same sentences, new style.
 * With Gemini connected this runs on Gemini 3.8 Flash Live: the lines (played
 * back, typed, or heard live through the microphone) stream in and Motey says
 * them again in the chosen style, in its own voice. Metered per minute.
 * In the demo (or without Gemini) the offline engine and the system voice do it. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  function bossFace() {
    return `<svg class="boss-face" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="24" fill="#F2C9A0" stroke="#1E1B3A" stroke-width="3"/>
      <path d="M10 28c2-16 42-16 44 0-6-6-12-9-22-9S16 22 10 28z" fill="#5B3A29" stroke="#1E1B3A" stroke-width="3" stroke-linejoin="round"/>
      <path d="M18 30l10 4M46 30l-10 4" stroke="#1E1B3A" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="24" cy="38" r="2.6" fill="#1E1B3A"/><circle cx="40" cy="38" r="2.6" fill="#1E1B3A"/>
      <path d="M24 50q8-6 16 0" fill="none" stroke="#1E1B3A" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="17" cy="45" rx="4" ry="2.5" fill="#FF5C5C" opacity=".55"/><ellipse cx="47" cy="45" rx="4" ry="2.5" fill="#FF5C5C" opacity=".55"/>
      <path d="M52 14l4-4M56 20l5-1M48 10l1-5" stroke="#FF5C5C" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  }

  let alive = false, rec = null, timer = null, sess = null;

  /* One Gemini Live session plus its speaker, meter and microphone. */
  function liveSession(opts) {
    const s = { live: null, player: Gemini.pcmPlayer(), mic: null, out: '', inp: '', waiters: [], minute: null, talkPoll: null };
    s.open = async () => {
      if (!Plans.allow('live_min')) return false;
      s.live = new Gemini.Live({
        system: opts.system, voice: opts.voice, modality: 'AUDIO', action: 'live',
        onText: t => { s.out += t; opts.onOut(s.out); },
        onIn: t => { s.inp += t; opts.onIn(s.inp); },
        onAudio: (d, m) => s.player.play(d, m),
        onInterrupt: () => s.player.flush(),
        onTurn: () => { opts.onTurn(s.inp, s.out); s.inp = ''; s.out = ''; s.waiters.splice(0).forEach(f => f()); },
        onError: e => { opts.onError(e); s.close(); },
        onClose: () => { s.waiters.splice(0).forEach(f => f()); }
      });
      await s.live.open();
      Plans.charge('live_min');
      s.minute = setInterval(() => {
        try { Plans.check('live_min'); Plans.charge('live_min'); }
        catch (e) { s.close(); Plans.upgradeSheet(e); opts.onError(e); }
      }, 60000);
      s.talkPoll = setInterval(() => opts.onTalking(s.player.speaking()), 150);
      return true;
    };
    s.say = text => new Promise(res => {
      s.waiters.push(res);
      s.live.text(text);
      setTimeout(res, 25000);
    }).then(() => new Promise(res => { const t = setInterval(() => { if (!s.player.speaking()) { clearInterval(t); res(); } }, 150); }));
    s.listen = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      s.micStream = stream;
      s.mic = Gemini.pcmCapture(stream, b64 => s.live && !s.live.closed && s.live.audio(b64));
    };
    s.unlisten = () => { if (s.mic) s.mic.stop(); if (s.micStream) s.micStream.getTracks().forEach(t => t.stop()); s.mic = null; s.micStream = null; };
    s.close = () => {
      clearInterval(s.minute); clearInterval(s.talkPoll); s.unlisten();
      if (s.live) s.live.close();
      s.player.close(); opts.onTalking(false);
    };
    return s;
  }

  function locked(v, ui) {
    v.innerHTML = `<h1>🎭 Motey Live AI</h1>
      <div class="card empty">${Mascot.svg({ size: 110, mood: 'worried' })}
        <p><b>AI-Live finns inte i Motey Lite.</b></p>
        <p class="muted">Med Motey Plus tar jag chefens plats i realtid och säger samma sak i en stil du gillar – med min egen röst (Gemini 3.8 Flash Live).</p>
        <div class="row" style="justify-content:center"><button class="btn" id="up">Uppgradera till Plus – 12 kr/mån</button><a class="btn ghost" href="#/plans">Jämför planer</a></div></div>`;
    $('#up', v).addEventListener('click', () => Plans.buy('plus'));
  }

  function render(v, meeting, ui) {
    const S = Store.settings;
    if (!S.demo && !Plans.can('live')) return locked(v, ui);
    if (!meeting) return ui.pickMeeting(v, 'live', '🎭 Motey Live AI', 'Har du en arg och sträng chef? Välj ett möte – Motey tar chefens plats och säger samma sak, fast i en stil du gillar.');
    alive = true;
    const esc = ui.esc;
    const useLive = !S.demo && AI.hasKey();
    const t = meeting.transcript || [];
    const counts = {};
    t.forEach(l => { counts[l.who] = (counts[l.who] || 0) + 1; });
    const speakers = Object.keys(counts);
    const me = AI.firstName(S.name).toLowerCase();
    let target = speakers.find(p => /chef/i.test(p)) || speakers.find(p => AI.firstName(p) === AI.firstName(meeting.boss)) ||
      speakers.filter(p => AI.firstName(p).toLowerCase() !== me).sort((a, b) => counts[b] - counts[a])[0] || speakers[0];
    let style = S.liveStyle || 'snall';
    const canListen = useLive ? !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) : !!Platform.recognizer();

    v.innerHTML = `
      <div class="row between"><a href="#/live" class="btn sm ghost">‹ Byt möte</a><span class="badge brand">${useLive ? 'Gemini 3.8 Flash Live' : S.demo ? 'Demo · offline-AI' : 'Offline-AI'}</span></div>
      <h1 style="margin-top:12px">🎭 Live AI – ${esc(meeting.title)}</h1>
      ${useLive ? `<div class="card" style="padding:10px 14px">${Plans.meter()}<div class="small muted" style="margin-top:4px">AI-Live tar ${String(Math.round(1000 * Plans.COST.live_min / Plans.plan().quota) / 10).replace('.', ',')} % per påbörjad minut i ${esc(Plans.plan().name)}.</div></div>` : ''}
      ${!useLive && !S.demo ? '<div class="demo-banner">Gemini är inte kopplat – Motey kör offline med datorns röst. Koppla under Mer → AI.</div>' : ''}
      <div class="card">
        <p class="small muted" style="margin:0 0 6px">Vem ska Motey ersätta?</p>
        <div class="row" id="who">${speakers.map(p => `<span class="chip ${p === target ? 'on' : ''}" data-p="${esc(p)}">${esc(AI.firstName(p))}</span>`).join('')}</div>
        <p class="small muted" style="margin:12px 0 6px">Stil</p>
        <div class="row" id="styles">${Object.entries(AI.STYLES).map(([k, s]) => `<span class="chip ${k === style ? 'on' : ''}" data-s="${k}">${s.icon} ${s.name}</span>`).join('')}</div>
        ${useLive ? `<p class="small muted" style="margin:12px 0 6px">Moteys röst</p><div class="row" id="voices">${Gemini.VOICES.map(([id, n]) => `<span class="chip ${id === (S.liveVoice || 'Puck') ? 'on' : ''}" data-v="${id}">${n}</span>`).join('')}</div>` : ''}
      </div>
      <div class="live-stage">
        <div class="speaker-card original dim" id="orig">
          <div class="who">${bossFace()}<div><div id="orig-name">${esc(AI.firstName(target))}</div><div class="small" style="opacity:.7">Originalet – dolt</div></div></div>
          <div class="say" id="orig-say">…</div>
          <label class="switch small" style="margin-top:auto"><input type="checkbox" id="showo"> Visa originalet</label>
        </div>
        <div class="speaker-card motey">
          <div class="who"><span id="mface">${Mascot.svg({ size: 64 })}</span><div>Motey<div class="small" style="opacity:.7" id="mstyle">${AI.STYLES[style].icon} ${AI.STYLES[style].name}</div></div></div>
          <div class="say" id="motey-say">Tryck på ▶ så tar jag över mötet!</div>
        </div>
      </div>
      <div class="row" style="margin:14px 0">
        <button class="btn" id="play">▶ Spela upp mötet live</button>
        ${canListen ? '<button class="btn ghost" id="listen">🎙 Lyssna på riktigt möte</button>' : ''}
      </div>
      <div class="card"><div class="row"><input type="text" id="typed" placeholder="Skriv vad chefen säger…" style="flex:1"><button class="btn coral" id="conv">Byt stil</button></div></div>
      <div class="card"><h3>Logg</h3><div class="live-log" id="log"><p class="muted small">Här hamnar allt som sägs.</p></div></div>`;

    const log = $('#log', v);
    const addLog = html => { if (log.querySelector('.muted')) log.innerHTML = ''; log.insertAdjacentHTML('afterbegin', `<div class="pair">${html}</div>`); };
    const setTalking = on => { const svg = $('#mface .motey-svg', v); if (svg) svg.classList.toggle('is-talking', on); };
    let pendingOrig = '';

    const restart = () => { if (sess) { sess.close(); sess = null; } };
    async function session() {
      if (sess && sess.live && !sess.live.closed) return sess;
      sess = liveSession({
        system: AI.liveInstruction(style, AI.firstName(target)), voice: S.liveVoice || 'Puck',
        onOut: txt => { $('#motey-say', v).textContent = txt; },
        onIn: txt => { $('#orig-say', v).textContent = txt; },
        onTurn: (inp, out) => {
          if (!out) return;
          Store.state.stats.restyled++; Store.save();
          addLog(`<div class="o">${esc(AI.firstName(target))}: ${esc(inp || pendingOrig)}</div><div><b>Motey:</b> ${esc(out)}</div>`);
          pendingOrig = '';
        },
        onTalking: setTalking,
        onError: e => { if (!(e instanceof Plans.QuotaError)) ui.toast('Gemini Live: ' + e.message, 5000); stopAll(); }
      });
      $('#motey-say', v).innerHTML = '<span class="typing">Ansluter till Gemini Live</span>';
      try { if (!(await sess.open())) { sess = null; return null; } }
      catch (e) { ui.toast('Kunde inte starta Gemini Live: ' + e.message, 6000); sess = null; return null; }
      $('#motey-say', v).textContent = 'Jag lyssnar! 🎧';
      return sess;
    }

    $$('#who .chip', v).forEach(c => c.addEventListener('click', () => {
      target = c.dataset.p; $$('#who .chip', v).forEach(x => x.classList.toggle('on', x === c));
      $('#orig-name', v).textContent = AI.firstName(target); restart();
    }));
    $$('#styles .chip', v).forEach(c => c.addEventListener('click', () => {
      style = c.dataset.s; S.liveStyle = style; Store.save();
      $$('#styles .chip', v).forEach(x => x.classList.toggle('on', x === c));
      $('#mstyle', v).textContent = `${AI.STYLES[style].icon} ${AI.STYLES[style].name}`; restart();
    }));
    $$('#voices .chip', v).forEach(c => c.addEventListener('click', () => {
      S.liveVoice = c.dataset.v; Store.save();
      $$('#voices .chip', v).forEach(x => x.classList.toggle('on', x === c)); restart();
    }));
    $('#showo', v).addEventListener('change', e => {
      $('#orig', v).classList.toggle('dim', !e.target.checked);
      $('#orig .small', v).textContent = e.target.checked ? 'Originalet' : 'Originalet – dolt';
    });

    async function convert(text, who) {
      $('#orig-say', v).textContent = text;
      if (useLive) {
        const s = await session(); if (!s || !alive) return;
        pendingOrig = text;
        await s.say(text);
        return;
      }
      $('#motey-say', v).innerHTML = '<span class="typing"></span>';
      const r = await AI.restyle(text, style);
      if (!alive) return;
      Store.state.stats.restyled++; Store.save();
      $('#motey-say', v).textContent = r.value;
      addLog(`<div class="o">${esc(AI.firstName(who || target))}: ${esc(text)}</div><div><b>Motey:</b> ${esc(r.value)}</div>`);
      setTalking(true);
      await new Promise(res => Platform.speak(r.value, { onend: res, pitch: 1.25 }));
      setTalking(false);
    }

    let playing = false;
    function stopAll() {
      playing = false; Platform.stopSpeaking();
      const b = $('#play', v); if (b) b.textContent = '▶ Spela upp mötet live';
      if (sess) { sess.close(); sess = null; }
      const lb = $('#listen', v); if (lb) lb.innerHTML = '🎙 Lyssna på riktigt möte';
    }
    $('#play', v).addEventListener('click', async () => {
      const btn = $('#play', v);
      if (playing) return stopAll();
      playing = true; btn.textContent = '⏹ Stoppa';
      for (const l of t) {
        if (!playing || !alive) break;
        if (l.who === target) await convert(l.text, l.who);
        else {
          addLog(`<div><b>${esc(AI.firstName(l.who))}:</b> ${esc(l.text)}</div>`);
          await new Promise(res => { timer = setTimeout(res, 1200 + l.text.length * 25); });
        }
      }
      playing = false; if (alive) btn.textContent = '▶ Spela upp mötet live';
    });
    $('#conv', v).addEventListener('click', () => { const x = $('#typed', v).value.trim(); if (x) { $('#typed', v).value = ''; convert(x, target); } });
    $('#typed', v).addEventListener('keydown', e => { if (e.key === 'Enter') $('#conv', v).click(); });

    const lb = $('#listen', v);
    if (lb) lb.addEventListener('click', async () => {
      if (useLive) {
        // the real thing: the boss's voice goes straight into Gemini 3.8 Flash Live
        if (sess && sess.mic) { stopAll(); return; }
        const s = await session(); if (!s) return;
        try { await s.listen(); lb.innerHTML = '<span class="rec-dot"></span> Lyssnar… (tryck för att sluta)'; }
        catch (e) { ui.toast('Kunde inte starta mikrofonen'); }
        return;
      }
      if (rec) { rec.stop(); rec = null; lb.innerHTML = '🎙 Lyssna på riktigt möte'; return; }
      rec = Platform.recognizer();
      rec.onresult = e => { const r = e.results[e.results.length - 1]; if (r.isFinal) convert(r[0].transcript.trim(), target); };
      rec.onend = () => { if (rec) try { rec.start(); } catch (e) { /* already running */ } };
      rec.onerror = ev => ui.toast('Mikrofonen: ' + ev.error);
      try { rec.start(); lb.innerHTML = '<span class="rec-dot"></span> Lyssnar… (tryck för att sluta)'; } catch (e) { ui.toast('Kunde inte starta mikrofonen'); rec = null; }
    });
  }

  function destroy() {
    alive = false; clearTimeout(timer);
    if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) { /* ignore */ } }
    if (sess) { sess.close(); sess = null; }
    Platform.stopSpeaking();
  }

  window.LiveMode = { render, destroy, bossFace, liveSession };
})();
