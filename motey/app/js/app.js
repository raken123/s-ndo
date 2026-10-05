/* Motey – app shell: routing, home, meetings, catch-up pop-up, settings. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => Store.settings;

  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }
  const fmtDay = d => new Date(d).toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '');
  const fmtDate = d => new Date(d).getDate();
  const fmtWhen = d => new Date(d).toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const fileIcon = n => ({ pdf: '📕', xlsx: '📗', xls: '📗', csv: '📗', docx: '📘', doc: '📘', pptx: '📙' }[(n.split('.').pop() || '').toLowerCase()] || '📄');
  const aiTag = src => src === 'claude' ? '<span class="ai-tag claude">Claude</span>' : '<span class="ai-tag">Offline-AI</span>';

  /* ---------- router ---------- */
  const NAV = [
    ['home', '🏠', 'Hem'], ['chat', '💬', 'Chattar'], ['live', '🎭', 'Live AI'], ['tiktok', '🎬', 'TikTok'], ['game', '🎮', 'Spel'], ['settings', '⚙️', 'Mer']
  ];
  let current = null;
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function route() {
    // invite links: …motey.html#join=M1…
    const jm = location.hash.match(/^#join=(.+)$/);
    if (jm) { history.replaceState(null, '', '#/chat'); return joinFromLink(decodeURIComponent(jm[1])); }
    const [, name = 'home', arg] = (location.hash || '#/home').split('/');
    if (current && current.destroy) current.destroy();
    current = null;
    Platform.stopSpeaking();
    const tab = { m: 'home', new: 'home', call: 'chat' }[name] || name;
    $$('.tabbar button, .rail button.nav').forEach(b => b.classList.toggle('on', b.dataset.go === tab));
    updateUnread();
    const v = $('#view');
    v.innerHTML = '';
    window.scrollTo(0, 0);
    const modes = { live: window.LiveMode, tiktok: window.TikTokMode, game: window.GameMode };
    if (name === 'm' && arg) return viewMeeting(v, arg);
    if (name === 'new') return viewNew(v);
    if (name === 'settings') return viewSettings(v);
    if (name === 'chat') { current = ChatMode; return ChatMode.render(v, arg, { toast, esc }); }
    if (name === 'call' && arg) { current = CallMode; return CallMode.render(v, arg, { toast, esc }); }
    if (modes[name]) {
      const meeting = arg ? Store.meeting(arg) : null;
      current = modes[name];
      return current.render(v, meeting, { pickMeeting, toast, esc });
    }
    return viewHome(v);
  }

  /* Pick a meeting with a transcript (used by the three modes). */
  function pickMeeting(v, mode, title, intro) {
    const list = Store.sorted().filter(m => (m.transcript || []).length).reverse();
    v.innerHTML = `<h1>${title}</h1><p class="muted">${intro}</p>` +
      list.map(m => meetingRow(m)).join('') +
      `<a class="btn ghost" href="#/new">＋ Lägg till ett möte</a>`;
    $$('.meeting', v).forEach(el => el.addEventListener('click', () => go(`#/${mode}/${el.dataset.id}`)));
  }

  function meetingRow(m) {
    const missing = (m.files || []).filter(f => f.status === 'missing').length;
    const past = Store.isPast(m);
    const live = m.room && isLive(m);
    const badges = [
      m.demo && !S().demo ? '<span class="badge">Demo</span>' : '',
      live ? '<span class="badge ok">● Pågår nu</span>' : '',
      m.room && !live && !past ? '<span class="badge brand">📞 Motey-möte</span>' : '',
      m.attended === false ? '<span class="badge warn">Missad</span>' : '',
      !past && !m.room ? '<span class="badge brand">Kommande</span>' : '',
      missing ? `<span class="badge warn">${missing} fil${missing > 1 ? 'er' : ''} saknas</span>` : '',
      past && (m.transcript || []).length ? `<span class="badge">${m.transcript.length} repliker</span>` : ''
    ].join(' ');
    return `<div class="meeting" data-id="${m.id}" role="button" tabindex="0">
      <div class="date"><small>${fmtDay(m.start)}</small>${fmtDate(m.start)}</div>
      <div class="info"><div class="t">${esc(m.title)}</div>
      <div class="small muted">${new Date(m.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} · ${esc((m.attendees || []).map(AI.firstName).join(', '))}</div>
      <div class="row" style="margin-top:4px;gap:6px">${badges}</div></div>
      <div aria-hidden="true">›</div></div>`;
  }

  const isLive = m => { const s = new Date(m.start).getTime(); return Date.now() > s - 10 * 6e4 && Date.now() < s + (m.durationMin || 45) * 6e4; };
  function updateUnread() {
    const n = (Store.state.rooms || []).reduce((a, r) => a + (r.unread || 0), 0);
    $$('[data-go="chat"]').forEach(b => { b.dataset.badge = n || ''; b.classList.toggle('has-badge', n > 0); });
  }

  /* ---------- demo vs real ---------- */
  function goReal() {
    S().demo = false; Store.save();
    MoteyNet.start();
    document.querySelectorAll('.overlay').forEach(o => o.remove());
    toast('🚀 Nu är Motey på riktigt! Skapa ett möte eller en chatt och bjud in folk.', 5000);
    go('#/home');
  }
  function goDemo() { S().demo = true; Store.save(); go('#/home'); }
  async function joinFromLink(code) {
    if (!Store.state.onboarded) {
      // first time Motey is opened from an invite: just ask for a name
      const sh = sheet(`<div style="text-align:center">${Mascot.svg({ size: 110, mood: 'wow' })}</div><h1 style="text-align:center">Du är inbjuden!</h1>
        <p class="muted" style="text-align:center">Vad ska de andra kalla dig?</p>
        <label class="field"><span>Ditt namn</span><input type="text" id="j-name" placeholder="Ditt namn"></label>
        <button class="btn block" id="j-go">Gå med 🚀</button>`);
      $('#j-go', sh.el).addEventListener('click', () => {
        S().name = $('#j-name', sh.el).value.trim() || 'Gäst';
        S().color = MoteyNet.COLORS[Math.floor(Math.random() * MoteyNet.COLORS.length)];
        Store.state.onboarded = true; S().demo = false; Store.save();
        sh.close(); joinFromLink(code);
      });
      return;
    }
    if (S().demo) { S().demo = false; Store.save(); }
    MoteyNet.start();
    try {
      const r = await MoteyNet.join(code);
      toast('Du är med! 🎉 Det kan ta några sekunder innan allt har hämtats.', 5000);
      go('#/chat/' + r.id);
    } catch (e) { toast(e.message, 5000); go('#/chat'); }
  }

  /* ---------- home ---------- */
  function viewHome(v) {
    const all = Store.sorted();
    const upcoming = all.filter(m => !Store.isPast(m));
    const past = all.filter(m => Store.isPast(m)).reverse();
    const pending = Store.pendingCatchUp();
    const h = new Date().getHours();
    const hello = h < 10 ? 'God morgon' : h < 18 ? 'Hej' : 'God kväll';
    const demo = S().demo;
    const liveNow = upcoming.concat(past).filter(m => m.room && isLive(m));
    v.innerHTML = `
      ${demo ? `<div class="demo-banner">👀 Du kollar runt i demon – mötena här är påhittade.<span style="flex:1"></span><button class="btn sm" id="goreal">Börja på riktigt</button></div>` : ''}
      <div class="card hero">
        ${Mascot.svg({ size: 96, mood: pending ? 'wow' : 'happy' })}
        <div style="flex:1">
          <h1 style="margin:0">${hello}, ${esc(S().name)}!</h1>
          <p class="muted" style="margin:.2em 0 .6em">${pending ? `Du missade förra ”${esc(pending.prev.title)}”. Jag har koll på allt!` : liveNow.length ? `”${esc(liveNow[0].title)}” pågår just nu.` : 'Jag lyssnar, sammanfattar och fixar – du gör det roliga.'}</p>
          <div class="row">
          ${pending ? '<button class="btn coral" id="catch">👀 Vad hände förra gången?</button>' : ''}
          ${liveNow.length && !pending ? `<a class="btn mint" href="#/call/${liveNow[0].room}">📞 Gå med nu</a>` : ''}
          ${!pending && !liveNow.length ? '<a class="btn ghost" href="#/new">＋ Nytt möte</a>' : ''}
          ${!demo ? '<button class="btn ghost" id="joinc">🔗 Gå med</button>' : ''}
          </div>
        </div>
      </div>
      <div class="grid three" style="margin-bottom:14px">
        <a class="card" href="#/live" style="text-decoration:none;color:inherit;margin:0"><h3>🎭 Motey Live AI</h3><p class="small muted" style="margin:0">Byt ut en arg chef mot Motey. Samma meningar, ny stil.</p></a>
        <a class="card" href="#/tiktok" style="text-decoration:none;color:inherit;margin:0"><h3>🎬 TikTok-läge</h3><p class="small muted" style="margin:0">Mötet som en kort video med animerad presentatör och bilder.</p></a>
        <a class="card" href="#/game" style="text-decoration:none;color:inherit;margin:0"><h3>🎮 Spelläge</h3><p class="small muted" style="margin:0">Spring genom mötet, krossa väggar som F-skatt och lär dig på köpet.</p></a>
      </div>
      <div class="row between"><h2>Kommande</h2><a class="btn sm ghost" href="#/new">＋ Nytt möte</a></div>
      ${upcoming.map(meetingRow).join('') || `<p class="muted">Inga kommande möten.${demo ? '' : ' Skapa ett och bjud in dina kollegor – ni möts direkt i Motey.'}</p>`}
      <h2 style="margin-top:18px">Tidigare</h2>
      ${past.map(meetingRow).join('') || '<p class="muted">Inga tidigare möten.</p>'}`;
    const gr = $('#goreal', v); if (gr) gr.addEventListener('click', goReal);
    const jc = $('#joinc', v); if (jc) jc.addEventListener('click', () => ChatMode.joinSheet());
    $$('.meeting', v).forEach(el => {
      const open = () => go('#/m/' + el.dataset.id);
      el.addEventListener('click', open);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
    const c = $('#catch', v);
    if (c) c.addEventListener('click', () => catchUpFlow(pending.prev, pending.next));
  }

  /* ---------- meeting detail ---------- */
  async function viewMeeting(v, id) {
    const m = Store.meeting(id);
    if (!m) return go('#/home');
    const prev = Store.previousInSeries(m);
    const past = Store.isPast(m);
    const room = m.room && MoteyNet.room(m.room);
    v.innerHTML = `
      <div class="row between"><a href="#/home" class="btn sm ghost">‹ Tillbaka</a>
        <div class="row">${past && !room ? `<label class="switch small" style="margin:0"><input type="checkbox" id="att" ${m.attended === false ? '' : 'checked'}> Jag var med</label>` : ''}
        <button class="icon-btn" id="del" title="${room ? 'Lämna mötet' : 'Ta bort mötet'}">🗑️</button></div></div>
      <h1 style="margin-top:12px">${esc(m.title)}</h1>
      <p class="muted">${fmtWhen(m.start)}${m.repeat === 'weekly' ? ' · varje vecka' : ''} · ${esc((m.attendees || []).join(', ')) || 'Bara du än så länge'}</p>
      ${room ? `<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:200px"><b>${isLive(m) ? '● Mötet pågår' : past ? 'Mötet är slut' : 'Motey-möte'}</b><div class="small muted">${isLive(m) ? 'Gå med med video eller bara ljud.' : past ? 'Allt som sades och skrevs finns i transkriptet.' : 'Ni ses här i Motey – ingen annan app behövs.'}</div></div>
          <a class="btn mint" href="#/call/${room.id}">📞 ${isLive(m) ? 'Gå med nu' : 'Starta samtal'}</a>
          <a class="btn ghost" href="#/chat/${room.id}">💬 Chatt</a>
          <button class="btn ghost" id="inv">🔗 Bjud in</button>
          ${past ? '<button class="btn ghost" id="nextm">📅 Boka nästa</button>' : ''}</div>` : ''}
      ${!past && prev && prev.attended === false ? `<div class="card" style="display:flex;gap:12px;align-items:center">${Mascot.svg({ size: 64, mood: 'wow' })}<div style="flex:1"><b>Du missade förra mötet.</b><div class="small muted">Motey berättar vad som hände och fixar filerna.</div></div><button class="btn coral sm" id="cu">Kör!</button></div>` : ''}
      <div class="row" style="margin-bottom:6px">
        <a class="btn sm" href="#/live/${m.id}">🎭 Live AI</a>
        <a class="btn sm coral" href="#/tiktok/${m.id}">🎬 TikTok</a>
        <a class="btn sm mint" href="#/game/${m.id}">🎮 Spela mötet</a>
      </div>
      <div class="tabs" role="tablist">
        <button data-t="sum" class="on">Sammanfattning</button><button data-t="tr">Transkript</button><button data-t="files">Filer</button>
      </div>
      <div id="tabc"></div>`;
    const cu = $('#cu', v); if (cu) cu.addEventListener('click', () => catchUpFlow(prev, m));
    const att = $('#att', v); if (att) att.addEventListener('change', () => { m.attended = att.checked; Store.save(); });
    $('#del', v).addEventListener('click', () => {
      if (!confirm(room ? 'Lämna mötet och ta bort det från den här enheten?' : 'Ta bort mötet?')) return;
      if (room) MoteyNet.leave(room.id); else Store.removeMeeting(m.id);
      go('#/home');
    });
    const inv = $('#inv', v); if (inv) inv.addEventListener('click', () => ChatMode.inviteSheet(room));
    const nx = $('#nextm', v); if (nx) nx.addEventListener('click', async () => {
      if (!room.meta) return toast('Mötet har inte laddats klart än');
      const nr = await MoteyNet.bookNext(room.id);
      toast('📅 Nästa möte är bokat och alla i mötet är inbjudna');
      go('#/m/r-' + nr.id);
    });
    const tabs = { sum: () => tabSummary(m), tr: () => tabTranscript(m), files: () => tabFiles(m) };
    $$('.tabs button', v).forEach(b => b.addEventListener('click', () => {
      $$('.tabs button', v).forEach(x => x.classList.toggle('on', x === b));
      tabs[b.dataset.t]();
    }));
    tabSummary(m);
  }

  async function tabSummary(m) {
    const c = $('#tabc');
    if (!(m.transcript || []).length && m.room) {
      c.innerHTML = `<div class="card empty">${Mascot.svg({ size: 90 })}<p><b>Inget sagt än.</b></p><p class="muted small">Under mötet hamnar chatten och allt Motey antecknar (📝 i samtalet) här – sedan sammanfattar jag, gör TikTok och spel av det.</p></div>`;
      return;
    }
    if (!(m.transcript || []).length) {
      c.innerHTML =`<div class="card empty">${Mascot.svg({ size: 90 })}<p><b>Mötet har inget transkript ännu.</b></p><p class="muted small">Klistra in anteckningar eller importera en .vtt/.srt/.txt från Teams, Zoom eller Meet.</p><button class="btn" id="addtr">Lägg till transkript</button></div>`;
      $('#addtr').addEventListener('click', () => { $$('.tabs button')[1].click(); });
      return;
    }
    c.innerHTML = `<div class="card"><p class="muted">Motey tänker…</p></div>`;
    const r = await AI.summarize(m);
    if (!document.body.contains(c)) return;
    const s = r.value;
    c.innerHTML = `
      <div class="card"><div class="row between"><h2 style="margin:0">Kort sagt</h2><div class="row">${aiTag(r.source)}<button class="icon-btn" id="say" title="Läs upp">🔊</button></div></div>
        <p style="margin-top:8px">${esc(s.summary)}</p></div>
      <div class="grid two">
        <div class="card"><h3>📌 Det viktigaste</h3><ul class="clean">${s.points.map(p => `<li data-ico="•">${esc(p)}</li>`).join('')}</ul></div>
        <div class="card"><h3>✅ Beslut</h3><ul class="clean">${s.decisions.map(p => `<li data-ico="✔">${esc(p)}</li>`).join('') || '<li class="muted" data-ico="–">Inga beslut</li>'}</ul>
          <h3 style="margin-top:12px">📝 Att göra</h3><ul class="clean">${s.actions.map(a => `<li data-ico="☐"><b>${esc(a.who)}</b> – ${esc(a.what)}</li>`).join('') || '<li class="muted" data-ico="–">Inget</li>'}</ul></div>
      </div>
      <div class="card"><h3>🏷️ Nyckelord</h3><div class="row">${s.keywords.map(k => `<span class="chip">${esc(k)}</span>`).join('')}</div></div>`;
    $('#say').addEventListener('click', () => Platform.speak(s.summary + ' ' + s.decisions.join('. ')));
  }

  function tabTranscript(m) {
    const c = $('#tabc');
    if (m.room) {
      c.innerHTML = `
        <div class="card transcript">${(m.transcript || []).map(l => `<div class="line"><div class="who">${esc(AI.firstName(l.who))}</div><div>${l.kind === 'tr' ? '🎙️ ' : ''}${esc(l.text)}</div></div>`).join('') || '<p class="muted">Tomt än så länge.</p>'}</div>
        <div class="card"><h3>Skriv i protokollet</h3><p class="small muted">Det du skriver här delas med alla i mötet.</p>
          <div class="row"><input type="text" id="note" placeholder="t.ex. Beslut: vi lanserar 14 november" style="flex:1"><button class="btn" id="nsend">Lägg till</button></div>
          <label class="btn ghost sm" style="margin-top:10px">📂 Importera .vtt/.srt/.txt<input type="file" id="trfile" accept=".txt,.vtt,.srt,text/plain" hidden></label></div>`;
      const add = async () => { const t = $('#note').value.trim(); if (!t) return; $('#note').value = ''; await MoteyNet.sendTranscript(m.room, t); tabTranscript(m); };
      $('#nsend').addEventListener('click', add);
      $('#note').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      $('#trfile').addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        const lines = Store.parseTranscript(await f.text()).slice(0, 300);
        toast(`Delar ${lines.length} repliker med mötet…`);
        for (const l of lines) { await MoteyNet.sendTranscript(m.room, `${l.who}: ${l.text}`); }
        tabTranscript(m);
      });
      return;
    }
    c.innerHTML = `
      <div class="card transcript">${(m.transcript || []).map(l => `<div class="line"><div class="who">${esc(AI.firstName(l.who))}</div><div>${esc(l.text)}</div></div>`).join('') || '<p class="muted">Tomt.</p>'}</div>
      <div class="card"><h3>Lägg till / ersätt transkript</h3>
        <p class="small muted">En replik per rad: <code>Namn: text</code>. Eller importera undertexter från Teams, Zoom eller Google Meet.</p>
        <textarea id="trtxt" placeholder="Birgitta: Vi bestämde att…"></textarea>
        <div class="row" style="margin-top:10px"><button class="btn" id="trsave">Spara</button>
        <label class="btn ghost">📂 Importera fil<input type="file" id="trfile" accept=".txt,.vtt,.srt,text/plain" hidden></label></div></div>`;
    $('#trsave').addEventListener('click', () => {
      const t = Store.parseTranscript($('#trtxt').value);
      if (!t.length) return toast('Inget att spara');
      m.transcript = t; Store.save(); toast('Transkriptet sparat ✨'); tabTranscript(m);
    });
    $('#trfile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      $('#trtxt').value = await f.text();
      toast('Fil inläst – tryck Spara');
    });
  }

  function tabFiles(m) {
    const c = $('#tabc');
    const files = m.files || (m.files = []);
    const label = { missing: '<span class="badge warn">Saknas</span>', attached: '<span class="badge ok">Bifogad</span>', generated: '<span class="badge brand">Utkast av Motey</span>', sent: '<span class="badge ok">Skickad ✓</span>' };
    c.innerHTML = `<div class="card">
      ${files.map((f, i) => `<div class="file"><div class="fi">${fileIcon(f.name)}</div><div class="fn">${esc(f.name)}<div>${label[f.status] || ''}${f.from ? ` <span class="small muted">från ${esc(f.from)}</span>` : ''}</div></div>
        ${f.data || f.fid ? `<button class="btn sm ghost" data-dl="${i}">⬇</button>` : ''}</div>`).join('') || '<p class="muted">Inga filer kopplade till mötet.</p>'}
      ${m.room ? `<label class="btn ghost sm" style="margin-top:6px">📎 Dela en fil med mötet<input type="file" id="fshare" hidden></label>` : ''}
      <div class="row" style="margin-top:10px">
        ${files.some(f => f.status === 'missing') ? '<button class="btn coral" id="fix">🪄 Motey, fixa det</button>' : ''}
        ${files.some(f => f.data && f.status !== 'sent') ? `<button class="btn" id="send">📨 Skicka till ${esc(S().bossName)}</button>` : ''}
      </div></div>
      <div class="card"><h3>Kräv en fil till mötet</h3><div class="row"><input type="text" id="fname" placeholder="t.ex. Rapport.pdf" style="flex:1"><button class="btn ghost" id="fadd">Lägg till</button></div></div>`;
    $$('[data-dl]', c).forEach(b => b.addEventListener('click', async () => {
      const f = files[+b.dataset.dl];
      if (f.data) toast(await Platform.saveFile(f.name, b64Blob(f.data, f.mime)));
      else ChatMode.downloadFile(f.fid, f.name);
    }));
    const fix = $('#fix', c); if (fix) fix.addEventListener('click', () => filesFlow(m, null));
    const send = $('#send', c); if (send) send.addEventListener('click', async () => { await sendToBoss(m); tabFiles(m); });
    const fs = $('#fshare', c); if (fs) fs.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { toast('Delar ' + f.name + '…'); await MoteyNet.sendFile(m.room, f, f.name); toast('📎 Delad med mötet'); tabFiles(m); }
      catch (err) { toast(err.message, 5000); }
    });
    $('#fadd', c).addEventListener('click', async () => {
      const n = $('#fname', c).value.trim(); if (!n) return;
      const room = m.room && MoteyNet.room(m.room);
      if (room && room.meta) {
        // shared requirement: everyone in the meeting sees that this file should come along
        const meta = Object.assign({}, room.meta, { files: [...new Set([...(room.meta.files || []), n])] });
        ['at', 'hostPk', 'hostName', 'v', 'pk', 'name', 't'].forEach(k => delete meta[k]);
        await MoteyNet.send(room.id, Object.assign({ t: 'meta' }, meta));
      } else files.push({ name: n, status: 'missing', owner: S().name });
      Store.save(); tabFiles(m);
    });
  }

  function b64Blob(b64, mime) {
    const bin = atob(b64); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime || 'application/octet-stream' });
  }

  /* ---------- Example 1: catch-up + fix files + send to boss ---------- */
  function sheet(html) {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="icon-btn close" aria-label="Stäng">✕</button>${html}</div>`;
    document.body.appendChild(o);
    const close = () => { Platform.stopSpeaking(); o.remove(); };
    $('.close', o).addEventListener('click', close);
    o.addEventListener('click', e => { if (e.target === o) close(); });
    return { el: $('.sheet', o), close };
  }
  function typeInto(el, text, done) {
    el.classList.add('typing'); el.textContent = '';
    let i = 0;
    const step = () => {
      if (!document.body.contains(el)) return;
      i += Math.max(1, Math.round(text.length / 160));
      el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, 18); else { el.classList.remove('typing'); done && done(); }
    };
    step();
  }
  function moteySays(container, text, mood) {
    container.innerHTML = `<div class="motey-stage">${Mascot.svg({ size: 92, mood: mood || 'happy', talking: true })}<div class="speech" id="sp"></div></div>`;
    const svg = $('.motey-svg', container);
    typeInto($('#sp', container), text);
    Platform.speak(text, { onend: () => svg && svg.classList.remove('is-talking') });
  }

  async function catchUpFlow(prev, next) {
    const sh = sheet(`<div class="steps"><i class="on"></i><i></i><i></i></div><div id="cu-body"><div class="motey-stage">${Mascot.svg({ size: 92 })}<div class="speech typing">Hämtar vad som hände</div></div></div><div id="cu-actions" class="row" style="margin-top:14px"></div>`);
    const r = await AI.catchUp(prev, S().name);
    const body = $('#cu-body', sh.el);
    moteySays(body, r.text, 'happy');
    body.insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:14px;box-shadow:none">
      <div class="row between"><h3 style="margin:0">${esc(prev.title)}</h3>${aiTag(r.source)}</div>
      ${r.sum.decisions.length ? `<p class="small muted" style="margin:.5em 0 .2em">Beslut</p><ul class="clean">${r.sum.decisions.map(d => `<li data-ico="✔">${esc(d)}</li>`).join('')}</ul>` : ''}
      ${r.mine.length ? `<p class="small muted" style="margin:.5em 0 .2em">Du ska</p><ul class="clean">${r.mine.map(a => `<li data-ico="☐">${esc(a.what)}</li>`).join('')}</ul>` : ''}</div>`);
    const missing = (prev.files || []).filter(f => f.status === 'missing');
    const acts = $('#cu-actions', sh.el);
    prev.caughtUp = true; Store.save();
    if (missing.length) {
      acts.innerHTML = `<button class="btn coral block" id="next">Fortsätt ›</button>`;
      $('#next', acts).addEventListener('click', () => { sh.close(); filesFlow(prev, next); });
    } else {
      acts.innerHTML = `<button class="btn block" id="ok">Tack Motey! 💜</button>`;
      $('#ok', acts).addEventListener('click', sh.close);
    }
  }

  function filesFlow(m, next) {
    const missing = (m.files || []).filter(f => f.status === 'missing');
    const sh = sheet(`<div class="steps"><i class="on"></i><i class="on"></i><i></i></div><div id="ff"></div>
      <div id="flist" style="margin-top:12px"></div>
      <div class="row" style="margin-top:12px"><button class="btn coral" id="auto">🪄 Låt Motey fixa allt</button><button class="btn ghost" id="later">Senare</button></div>`);
    moteySays($('#ff', sh.el), `Psst… du glömde ${missing.length === 1 ? 'en fil' : missing.length + ' filer'} till ${AI.firstName(S().bossName)}: ${missing.map(f => f.name).join(' och ')}. Jag fixar det! Bifoga din egen fil, eller så gör jag ett utkast från mötet och skickar det${S().autoSend ? ' automatiskt' : ''}.`, 'wow');
    const list = $('#flist', sh.el);
    const draw = () => {
      list.innerHTML = m.files.filter(f => missing.includes(f)).map(f => `<div class="file"><div class="fi">${fileIcon(f.name)}</div><div class="fn">${esc(f.name)}<div>${f.status === 'missing' ? '<span class="badge warn">Saknas</span>' : f.status === 'attached' ? '<span class="badge ok">Din fil ✓</span>' : '<span class="badge brand">Motey-utkast ✓</span>'}</div></div>
        <label class="btn sm ghost">📎<input type="file" data-n="${esc(f.name)}" hidden></label></div>`).join('');
      $$('input[type=file]', list).forEach(inp => inp.addEventListener('change', async () => {
        const file = inp.files[0]; if (!file) return;
        const f = m.files.find(x => x.name === inp.dataset.n);
        f.data = await Platform.blobToB64(file); f.mime = file.type; f.status = 'attached'; f.size = file.size;
        Store.save(); draw();
      }));
    };
    draw();
    $('#later', sh.el).addEventListener('click', sh.close);
    $('#auto', sh.el).addEventListener('click', async () => {
      const btn = $('#auto', sh.el); btn.disabled = true; btn.textContent = 'Fixar…';
      const sum = (await AI.summarize(m)).value;
      for (const f of missing.filter(x => x.status === 'missing')) {
        const d = Docs.draftFor(m, sum, f.name);
        f.name = d.name; f.data = await Platform.blobToB64(d.blob); f.mime = d.blob.type; f.status = 'generated'; f.size = d.blob.size;
      }
      Store.save(); draw();
      const ff = $('#ff', sh.el);
      $('.steps i:last-child', sh.el).classList.add('on');
      if (S().autoSend) {
        ff.innerHTML = `<div class="sending"><span class="plane">✈️</span><div><b>Skickar till ${esc(S().bossName)}…</b><div class="small muted">${missing.map(f => esc(f.name)).join(', ')}</div></div></div>`;
        const res = await sendToBoss(m, true);
        ff.innerHTML = '';
        moteySays(ff, res.text, 'wink');
      } else {
        moteySays(ff, 'Klart! Filerna ligger under Filer i mötet. Tryck på Skicka när du vill.', 'happy');
      }
      $('#auto', sh.el).replaceWith(Object.assign(document.createElement('button'), { className: 'btn', textContent: 'Klart 💜', onclick: () => { sh.close(); route(); } }));
      $('#later', sh.el).remove();
    });
  }

  /* Sends every file that has content. Webhook = fully automatic (Zapier, Make,
   * Power Automate, n8n …). E-post = opens the mail app pre-filled and saves the
   * files so they can be attached. */
  async function sendToBoss(m, auto) {
    const s = S();
    const files = (m.files || []).filter(f => f.data && f.status !== 'sent');
    if (!files.length) return { ok: false, text: 'Det finns inga filer att skicka.' };
    const sum = (await AI.summarize(m)).value;
    const subject = `${m.title}: ${files.map(f => f.name).join(', ')}`;
    const body = `Hej ${AI.firstName(s.bossName)}!\n\nHär kommer ${files.length === 1 ? 'filen' : 'filerna'} från "${m.title}":\n${files.map(f => '• ' + f.name + (f.status === 'generated' ? ' (utkast från Motey)' : '')).join('\n')}\n\nKort sammanfattning: ${sum.summary}\n\nHälsningar,\n${s.name}\n(skickat med Motey)`;
    let text;
    try {
      if (m.room && MoteyNet.room(m.room)) {
        // Real meeting: deliver inside Motey, to everyone in the meeting (the boss included).
        for (const f of files) await MoteyNet.sendFile(m.room, b64Blob(f.data, f.mime), f.name);
        const to = AI.firstName(m.boss || s.bossName);
        await MoteyNet.sendText(m.room, `Hej ${to}! Här är ${files.map(f => f.name).join(' och ')}${files.some(f => f.status === 'generated') ? ' (utkast från Motey)' : ''}. /${s.name}`);
        if (s.sendMethod === 'webhook' && s.webhookUrl) await fetch(s.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: s.bossEmail, toName: s.bossName, from: s.name, subject, body, files: files.map(f => ({ name: f.name, mime: f.mime, base64: f.data })) }) }).catch(() => {});
        text = `Klart! Jag lade ${files.map(f => f.name).join(' och ')} i mötets chatt, så ${to} och alla andra i mötet har dem nu. Du är räddad! 😎`;
      } else if (s.sendMethod === 'webhook' && s.webhookUrl) {
        const res = await fetch(s.webhookUrl, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: s.bossEmail, toName: s.bossName, from: s.name, subject, body, files: files.map(f => ({ name: f.name, mime: f.mime, base64: f.data })) })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        text = `Klart! Jag skickade ${files.map(f => f.name).join(' och ')} till ${s.bossName}. Du är räddad! 😎`;
      } else {
        for (const f of files) await Platform.saveFile(f.name, b64Blob(f.data, f.mime));
        await Platform.openUrl(`mailto:${encodeURIComponent(s.bossEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\n(Bifoga filerna från Hämtade filer.)')}`);
        text = `Klart! Mejlet till ${s.bossName} är ifyllt och filerna är sparade – dra in dem i mejlet och tryck skicka. Vill du att det går helt automatiskt? Lägg in en webhook under Mer. 😎`;
      }
      files.forEach(f => { f.status = 'sent'; f.sentAt = new Date().toISOString(); });
      Store.state.outbox.unshift({ at: new Date().toISOString(), to: s.bossName, subject, files: files.map(f => f.name), method: s.sendMethod });
      Store.save();
      if (!auto) toast('📨 Skickat till ' + s.bossName);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, text: `Oj, det gick inte att skicka (${e.message}). Filerna finns kvar under Filer i mötet.` };
    }
  }

  /* ---------- new meeting ---------- */
  function viewNew(v) {
    if (!S().demo) return viewNewReal(v);
    const now = new Date(Date.now() + 36e5); now.setMinutes(0, 0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    v.innerHTML = `<a href="#/home" class="btn sm ghost">‹ Tillbaka</a><h1 style="margin-top:12px">Nytt möte</h1>
      <div class="demo-banner">👀 I demon sparas mötet bara här. <span style="flex:1"></span><button class="btn sm" id="goreal">Börja på riktigt</button></div>
      <div class="card">
        <label class="field"><span>Titel</span><input type="text" id="nt" placeholder="Veckomöte – Projekt Nova"></label>
        <label class="field"><span>Serie (samma namn kopplar ihop återkommande möten)</span><input type="text" id="ns" placeholder="nova"></label>
        <label class="field"><span>Tid</span><input type="datetime-local" id="nd" value="${local}"></label>
        <label class="field"><span>Deltagare (kommaseparerade)</span><input type="text" id="na" value="${esc(S().bossName)}, ${esc(S().name)}"></label>
        <label class="switch"><input type="checkbox" id="nmiss"> Jag missade det här mötet</label>
        <label class="field"><span>Transkript eller anteckningar (valfritt)</span><textarea id="ntr" placeholder="Namn: text – en replik per rad"></textarea></label>
        <label class="btn ghost sm" style="margin-bottom:10px">📂 Importera .vtt/.srt/.txt<input type="file" id="nf" accept=".txt,.vtt,.srt" hidden></label>
        <label class="field"><span>Filer som ska med (kommaseparerade)</span><input type="text" id="nfiles" placeholder="Rapport.pdf, Budget.xlsx"></label>
        <button class="btn block" id="nsave">Spara mötet</button>
      </div>`;
    $('#goreal', v).addEventListener('click', goReal);
    $('#nf', v).addEventListener('change', async e => { const f = e.target.files[0]; if (f) $('#ntr', v).value = await f.text(); });
    $('#nsave', v).addEventListener('click', () => {
      const title = $('#nt', v).value.trim() || 'Möte';
      const m = Store.addMeeting({
        demo: true, title, series: ($('#ns', v).value.trim() || title).toLowerCase(), start: new Date($('#nd', v).value || Date.now()).toISOString(), durationMin: 45,
        attendees: $('#na', v).value.split(',').map(s => s.trim()).filter(Boolean), boss: S().bossName,
        attended: $('#nmiss', v).checked ? false : true, transcript: Store.parseTranscript($('#ntr', v).value),
        files: $('#nfiles', v).value.split(',').map(s => s.trim()).filter(Boolean).map(n => ({ name: n, status: 'missing', owner: S().name }))
      });
      toast('Mötet sparat ✨');
      go('#/m/' + m.id);
    });
  }

  // A real meeting: its own encrypted room that everyone joins with the invite.
  function viewNewReal(v) {
    const now = new Date(Date.now() + 36e5); now.setMinutes(0, 0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    v.innerHTML = `<a href="#/home" class="btn sm ghost">‹ Tillbaka</a><h1 style="margin-top:12px">Nytt möte</h1>
      <p class="muted">Ni träffas med video eller ljud direkt i Motey. Chatten, filerna och allt som antecknas sparas i mötet.</p>
      <div class="card">
        <label class="field"><span>Vad handlar mötet om?</span><input type="text" id="nt" placeholder="Veckomöte – Projekt Nova"></label>
        <div class="grid two"><label class="field"><span>När</span><input type="datetime-local" id="nd" value="${local}"></label>
        <label class="field"><span>Hur länge</span><select id="nl"><option value="15">15 min</option><option value="30">30 min</option><option value="45" selected>45 min</option><option value="60">1 timme</option><option value="90">1,5 timme</option><option value="120">2 timmar</option></select></label></div>
        <label class="switch"><input type="checkbox" id="nrep"> Varje vecka (Motey bokar nästa möte automatiskt)</label>
        <label class="field"><span>Filer som ska med (kommaseparerade, valfritt)</span><input type="text" id="nfiles" placeholder="Rapport.pdf, Budget.xlsx"></label>
        <div class="row"><button class="btn" id="nsave">Skapa och bjud in</button><button class="btn mint" id="nnow">📞 Starta ett möte nu</button></div>
      </div>`;
    const create = async (startNow) => {
      const title = $('#nt', v).value.trim() || (startNow ? 'Snabbmöte' : 'Möte');
      const start = startNow ? new Date() : new Date($('#nd', v).value || Date.now());
      const r = await MoteyNet.createRoom({ name: title, kind: 'meeting', meta: {
        title, start: start.toISOString(), durationMin: +$('#nl', v).value, repeat: $('#nrep', v).checked ? 'weekly' : '',
        series: Nostr.hex(Nostr.rand(8)), files: $('#nfiles', v).value.split(',').map(x => x.trim()).filter(Boolean) } });
      MoteyNet.syncMeeting(r);
      go(startNow ? '#/call/' + r.id : '#/m/r-' + r.id);
      setTimeout(() => ChatMode.inviteSheet(r), 300);
    };
    $('#nsave', v).addEventListener('click', () => create(false));
    $('#nnow', v).addEventListener('click', () => create(true));
  }

  /* ---------- settings ---------- */
  function viewSettings(v) {
    const s = S();
    const me = MoteyNet.me();
    v.innerHTML = `<h1>Inställningar</h1>
      <div class="card"><h3>Läge</h3>
        <p class="small muted">${s.demo ? 'Du kollar runt i demon. Mötena är påhittade och inget skickas till någon.' : 'Motey är på riktigt: möten, samtal och chattar med andra människor.'}</p>
        ${s.demo ? '<button class="btn" id="s-real">🚀 Börja på riktigt</button>' : '<button class="btn ghost sm" id="s-demo">👀 Titta på demon</button> <label class="switch" style="display:inline-flex;margin:0 0 0 10px"><input type="checkbox" id="s-showdemo" ' + (s.showDemo ? 'checked' : '') + '> Visa demomötena bland mina möten</label>'}</div>
      <div class="card"><h3>Du och din chef</h3>
        <label class="field"><span>Ditt namn (det här ser de andra)</span><input type="text" id="s-name" value="${esc(s.name)}"></label>
        <div class="row" style="margin-bottom:10px"><span class="small muted">Din färg</span>${MoteyNet.COLORS.map(c => `<button class="swatch ${c === s.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Färg ${c}"></button>`).join('')}</div>
        <label class="field"><span>Chefens namn</span><input type="text" id="s-boss" value="${esc(s.bossName)}"></label>
        <label class="field"><span>Chefens e-post</span><input type="email" id="s-mail" value="${esc(s.bossEmail)}" placeholder="chef@foretag.se"></label></div>
      <div class="card"><h3>Skicka filer</h3>
        <label class="switch"><input type="checkbox" id="s-auto" ${s.autoSend ? 'checked' : ''}> Skicka automatiskt när Motey har fixat filerna</label>
        <label class="field"><span>Hur</span><select id="s-method"><option value="email">E-post (öppnar e-postappen)</option><option value="webhook">Webhook – helt automatiskt</option></select></label>
        <label class="field" id="s-hook-w"><span>Webhook-URL (Zapier, Make, Power Automate, n8n…)</span><input type="url" id="s-hook" value="${esc(s.webhookUrl)}" placeholder="https://hooks.zapier.com/…"></label>
        <p class="small muted">Webhooken får JSON med mottagare, ämne, text och filerna i base64.</p></div>
      <div class="card"><h3>AI</h3>
        <p class="small muted">Motey fungerar helt offline. Med en Claude API-nyckel blir sammanfattningar, stilbyten, videomanus och spelbanor smartare.</p>
        <label class="field"><span>Claude API-nyckel</span><input type="password" id="s-key" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off"></label>
        <label class="field"><span>Modell</span><input type="text" id="s-model" value="${esc(s.model)}"></label>
        <button class="btn sm ghost" id="s-test">Testa nyckeln</button> <span id="s-testr" class="small muted"></span>
        <p class="small muted" style="margin-top:8px">Nyckeln sparas bara på den här enheten och skickas enbart till api.anthropic.com.</p></div>
      ${s.demo ? '' : `<div class="card"><h3>Nätverk</h3>
        <p class="small muted">Meddelanden krypteras på din enhet och lämnas i en "brevlåda" på publika Nostr-reläer. Samtal går direkt mellan enheterna.</p>
        <div id="s-net" class="small"></div>
        <label class="field" style="margin-top:10px"><span>Reläer (en per rad, tomt = standard)</span><textarea id="s-relays" style="min-height:90px" placeholder="${MoteyNet.DEFAULT_RELAYS.join('\n')}">${esc(s.relays)}</textarea></label>
        <details><summary class="small">TURN-server (för nätverk där samtal inte kommer igenom)</summary>
          <label class="field" style="margin-top:8px"><span>TURN-adress</span><input type="text" id="s-turn" value="${esc(s.turnUrl)}" placeholder="turn:turn.example.com:3478"></label>
          <div class="grid two"><label class="field"><span>Användare</span><input type="text" id="s-tu" value="${esc(s.turnUser)}"></label><label class="field"><span>Lösenord</span><input type="password" id="s-tp" value="${esc(s.turnPass)}"></label></div></details>
      </div>`}
      <div class="card"><h3>Övrigt</h3>
        <label class="switch"><input type="checkbox" id="s-voice" ${s.voice ? 'checked' : ''}> Motey pratar högt</label>
        <label class="field"><span>Tema</span><select id="s-theme"><option value="auto">Följ systemet</option><option value="light">Ljust</option><option value="dark">Mörkt</option></select></label>
        <div class="row"><button class="btn ghost sm" id="s-reset">Återställ demomöten</button><button class="btn ghost sm" id="s-export">Exportera data</button></div></div>
      <div class="card"><h3>Utkorg</h3>${Store.state.outbox.slice(0, 10).map(o => `<div class="small" style="padding:6px 0;border-bottom:1px dashed var(--line)">📨 ${new Date(o.at).toLocaleString('sv-SE')} → <b>${esc(o.to)}</b>: ${esc(o.files.join(', '))}</div>`).join('') || '<p class="muted small">Inget skickat ännu.</p>'}</div>
      <p class="center small muted" style="text-align:center">${Mascot.logo({ size: 26, animate: false })}<br>Version 1.1.0 · ${Platform.kind()}</p>`;
    $('#s-method', v).value = s.sendMethod;
    $('#s-theme', v).value = s.theme;
    const hookVis = () => $('#s-hook-w', v).classList.toggle('hidden', $('#s-method', v).value !== 'webhook');
    hookVis();
    const bind = (id, key, prop) => $(id, v).addEventListener('change', e => { s[key] = e.target[prop || 'value']; if (typeof s[key] === 'string') s[key] = s[key].trim(); Store.save(); if (key === 'theme') applyTheme(); hookVis(); });
    bind('#s-name', 'name'); bind('#s-boss', 'bossName'); bind('#s-mail', 'bossEmail'); bind('#s-auto', 'autoSend', 'checked');
    bind('#s-method', 'sendMethod'); bind('#s-hook', 'webhookUrl'); bind('#s-key', 'apiKey'); bind('#s-model', 'model');
    bind('#s-voice', 'voice', 'checked'); bind('#s-theme', 'theme');
    const sr = $('#s-real', v); if (sr) sr.addEventListener('click', goReal);
    const sd = $('#s-demo', v); if (sd) sd.addEventListener('click', goDemo);
    const ssd = $('#s-showdemo', v); if (ssd) ssd.addEventListener('change', () => { s.showDemo = ssd.checked; Store.save(); });
    $$('.swatch', v).forEach(b => b.addEventListener('click', () => { s.color = b.dataset.c; Store.save(); $$('.swatch', v).forEach(x => x.classList.toggle('on', x === b)); }));
    if (!s.demo) {
      bind('#s-turn', 'turnUrl'); bind('#s-tu', 'turnUser'); bind('#s-tp', 'turnPass');
      $('#s-relays', v).addEventListener('change', e => { s.relays = e.target.value.trim(); Store.save(); MoteyNet.restart(); toast('Reläerna uppdaterade'); });
      const net = () => { const st = MoteyNet.status(); const el = $('#s-net', v); if (el) el.innerHTML = st.relays.map(r => `<div>${r.status === 'open' ? '🟢' : r.status === 'connecting' ? '🟡' : '🔴'} ${esc(r.url)}</div>`).join(''); };
      net(); const off = MoteyNet.on('status', net); current = { destroy: off };
    }
    $('#s-test', v).addEventListener('click', async () => {
      s.apiKey = $('#s-key', v).value.trim(); Store.save();
      const r = $('#s-testr', v); r.textContent = 'Testar…';
      try { r.textContent = '✅ ' + await AI.testKey(); } catch (e) { r.textContent = '❌ ' + e.message; }
    });
    $('#s-reset', v).addEventListener('click', () => { if (confirm('Återställ demomötena? Dina riktiga möten och chattar påverkas inte.')) { Store.reset(); toast('Demomöten återställda'); go('#/home'); } });
    $('#s-export', v).addEventListener('click', async () => {
      const data = JSON.parse(JSON.stringify(Store.state)); data.settings.apiKey = '';
      toast(await Platform.saveFile('motey-data.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })));
    });
  }

  function applyTheme() {
    const t = S().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------- first run ---------- */
  function onboarding() {
    const sh = sheet(`<div style="text-align:center">${Mascot.svg({ size: 130, mood: 'happy' })}</div>
      <h1 style="text-align:center">Hej! Jag heter Motey.</h1>
      <p class="muted" style="text-align:center">Din AI-mötesapp. Ni har möten med video och chattar direkt här – och jag berättar vad du missade, fixar filerna, byter stil på arga chefer och gör TikToks och spel av tråkiga möten.</p>
      <label class="field"><span>Vad heter du?</span><input type="text" id="o-name" value="" placeholder="Ditt namn"></label>
      <label class="field"><span>Vad heter din chef? (valfritt)</span><input type="text" id="o-boss" value="" placeholder="t.ex. Birgitta"></label>
      <div class="mode-pick">
        <button id="o-real"><b>🚀 Börja på riktigt</b><span class="small muted">Skapa möten och chattar och bjud in riktiga människor.</span></button>
        <button id="o-demo"><b>👀 Bara kolla runt</b><span class="small muted">Utforska med påhittade möten. Du kan börja på riktigt när du vill.</span></button>
      </div>`);
    const finish = real => {
      const s = S();
      s.name = $('#o-name', sh.el).value.trim() || (real ? 'Jag' : 'Ronny');
      s.bossName = $('#o-boss', sh.el).value.trim() || 'Birgitta';
      s.color = MoteyNet.COLORS[Math.floor(Math.random() * MoteyNet.COLORS.length)];
      s.demo = !real;
      Store.state.onboarded = true;
      Store.reset();
      sh.close();
      if (real) { MoteyNet.start(); route(); return; }
      route();
      const p = Store.pendingCatchUp();
      if (p) setTimeout(() => catchUpFlow(p.prev, p.next), 500);
    };
    $('#o-real', sh.el).addEventListener('click', () => finish(true));
    $('#o-demo', sh.el).addEventListener('click', () => finish(false));
  }

  /* ---------- boot ---------- */
  function boot() {
    Store.load();
    applyTheme();
    $('#rail-logo').innerHTML = Mascot.logo({ size: 40 });
    $('#top-logo').innerHTML = Mascot.logo({ size: 30 });
    const navHtml = cls => NAV.map(([k, ico, label]) => `<button class="${cls}" data-go="${k}"><span class="ico">${ico}</span><span>${label}</span></button>`).join('');
    $('#rail-nav').innerHTML = navHtml('nav');
    $('#tabbar').innerHTML = navHtml('');
    $$('[data-go]').forEach(b => b.addEventListener('click', () => go('#/' + b.dataset.go)));
    window.addEventListener('hashchange', route);
    if (!S().demo) MoteyNet.start();
    // keep the visible screen fresh when messages and meetings arrive
    let t = 0;
    const refresh = () => {
      updateUnread();
      const name = (location.hash.split('/')[1] || 'home');
      if (name !== 'home' && name !== 'm') return;
      if (document.querySelector('.overlay') || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
      clearTimeout(t); t = setTimeout(route, 700);
    };
    MoteyNet.on('rooms', refresh);
    MoteyNet.on('message', (r, m) => { if (m.t === 'meta' || m.t === 'file' || m.t === 'next') refresh(); else updateUnread(); });
    route();
    if (!Store.state.onboarded && !/^#join=/.test(location.hash)) onboarding();
    else {
      // Example 1: Motey pops up by itself when the next meeting follows a missed one.
      const p = Store.pendingCatchUp();
      if (p) setTimeout(() => catchUpFlow(p.prev, p.next), 900);
    }
  }

  window.App = { toast, go, sheet, moteySays, esc, catchUpFlow, sendToBoss, goReal, goDemo };
  document.addEventListener('DOMContentLoaded', boot);
})();
