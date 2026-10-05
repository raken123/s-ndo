/* Motey Live AI (example 2): replace a speaker with Motey – same sentences, new style. */
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

  let alive = false, rec = null, timer = null;

  function render(v, meeting, ui) {
    if (!meeting) return ui.pickMeeting(v, 'live', '🎭 Motey Live AI', 'Har du en arg och sträng chef? Välj ett möte – Motey tar chefens plats och säger samma sak, fast i en stil du gillar.');
    alive = true;
    const esc = ui.esc;
    const S = Store.settings;
    const t = meeting.transcript || [];
    const counts = {};
    t.forEach(l => { counts[l.who] = (counts[l.who] || 0) + 1; });
    const speakers = Object.keys(counts);
    const me = AI.firstName(S.name).toLowerCase();
    let target = speakers.find(p => /chef/i.test(p)) || speakers.find(p => AI.firstName(p) === AI.firstName(meeting.boss)) ||
      speakers.filter(p => AI.firstName(p).toLowerCase() !== me).sort((a, b) => counts[b] - counts[a])[0] || speakers[0];
    let style = S.liveStyle || 'snall';
    let showOrig = false;
    const canListen = !!Platform.recognizer();

    v.innerHTML = `
      <div class="row between"><a href="#/live" class="btn sm ghost">‹ Byt möte</a><span class="badge brand">${AI.hasKey() ? 'Claude' : 'Offline-AI'}</span></div>
      <h1 style="margin-top:12px">🎭 Live AI – ${esc(meeting.title)}</h1>
      <div class="card">
        <p class="small muted" style="margin:0 0 6px">Vem ska Motey ersätta?</p>
        <div class="row" id="who">${speakers.map(p => `<span class="chip ${p === target ? 'on' : ''}" data-p="${esc(p)}">${esc(AI.firstName(p))}</span>`).join('')}</div>
        <p class="small muted" style="margin:12px 0 6px">Stil</p>
        <div class="row" id="styles">${Object.entries(AI.STYLES).map(([k, s]) => `<span class="chip ${k === style ? 'on' : ''}" data-s="${k}">${s.icon} ${s.name}</span>`).join('')}</div>
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

    $$('#who .chip', v).forEach(c => c.addEventListener('click', () => {
      target = c.dataset.p; $$('#who .chip', v).forEach(x => x.classList.toggle('on', x === c));
      $('#orig-name', v).textContent = AI.firstName(target);
    }));
    $$('#styles .chip', v).forEach(c => c.addEventListener('click', () => {
      style = c.dataset.s; S.liveStyle = style; Store.save();
      $$('#styles .chip', v).forEach(x => x.classList.toggle('on', x === c));
      $('#mstyle', v).textContent = `${AI.STYLES[style].icon} ${AI.STYLES[style].name}`;
    }));
    $('#showo', v).addEventListener('change', e => {
      showOrig = e.target.checked;
      $('#orig', v).classList.toggle('dim', !showOrig);
      $('#orig .small', v).textContent = showOrig ? 'Originalet' : 'Originalet – dolt';
    });

    async function convert(text, who) {
      $('#orig-say', v).textContent = text;
      $('#motey-say', v).innerHTML = '<span class="typing"></span>';
      const r = await AI.restyle(text, style);
      if (!alive) return;
      Store.state.stats.restyled++; Store.save();
      $('#motey-say', v).textContent = r.value;
      addLog(`<div class="o">${ui.esc(AI.firstName(who || target))}: ${ui.esc(text)}</div><div><b>Motey:</b> ${ui.esc(r.value)}</div>`);
      setTalking(true);
      await new Promise(res => Platform.speak(r.value, { onend: res, pitch: 1.25 }));
      setTalking(false);
    }

    let playing = false;
    $('#play', v).addEventListener('click', async () => {
      const btn = $('#play', v);
      if (playing) { playing = false; Platform.stopSpeaking(); btn.textContent = '▶ Spela upp mötet live'; return; }
      playing = true; btn.textContent = '⏹ Stoppa';
      for (const l of t) {
        if (!playing || !alive) break;
        if (l.who === target) await convert(l.text, l.who);
        else {
          addLog(`<div><b>${ui.esc(AI.firstName(l.who))}:</b> ${ui.esc(l.text)}</div>`);
          await new Promise(res => { timer = setTimeout(res, 1200 + l.text.length * 25); });
        }
      }
      playing = false; if (alive) btn.textContent = '▶ Spela upp mötet live';
    });
    $('#conv', v).addEventListener('click', () => { const x = $('#typed', v).value.trim(); if (x) { $('#typed', v).value = ''; convert(x, target); } });
    $('#typed', v).addEventListener('keydown', e => { if (e.key === 'Enter') $('#conv', v).click(); });

    const lb = $('#listen', v);
    if (lb) lb.addEventListener('click', () => {
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
    Platform.stopSpeaking();
  }

  window.LiveMode = { render, destroy, bossFace };
})();
