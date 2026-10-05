/* Motey Chattar – real text messages between people, inside Motey.
 * Works on MoteyNet rooms; in demo mode a local chat with Motey is shown instead. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isDemo = () => Store.settings.demo;
  let offs = [];
  const cleanup = () => { offs.forEach(f => f()); offs = []; };

  const time = at => {
    const d = new Date(at), now = new Date();
    return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  };
  const initials = n => String(n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  function avatar(name, color, kind) {
    if (kind === 'meeting') return '<span class="avatar" style="background:#FFE6DC">📅</span>';
    if (kind === 'motey') return `<span class="avatar" style="background:#EDE7FF">${Mascot.svg({ size: 30, animate: false })}</span>`;
    return `<span class="avatar" style="background:${esc(color || '#6C4CF5')};color:#fff">${esc(initials(name))}</span>`;
  }
  function lastMsg(r) {
    const a = MoteyNet.messages(r.id).filter(m => ['msg', 'file', 'tr', 'next'].includes(m.t));
    return a[a.length - 1];
  }
  function statusPill() {
    const s = MoteyNet.status();
    const ok = s.online > 0;
    return `<span class="badge ${ok ? 'ok' : 'warn'}" id="netpill" title="${esc(s.relays.map(r => r.url + ': ' + r.status).join('\n'))}">${ok ? '●' : '○'} ${ok ? 'Ansluten' : 'Ansluter…'} ${s.online}/${s.total}</span>`;
  }

  /* ---------------- chat list ---------------- */
  function renderList(v, ui) {
    if (isDemo()) return renderDemo(v, ui);
    const rs = MoteyNet.rooms().slice().sort((a, b) => ((lastMsg(b) || {}).at || b.created) - ((lastMsg(a) || {}).at || a.created));
    v.innerHTML = `<div class="row between"><h1 style="margin:0">💬 Chattar</h1>${statusPill()}</div>
      <p class="muted">Meddelanden och möten med riktiga människor – krypterade, bara ni som har inbjudan kan läsa.</p>
      <div class="row" style="margin-bottom:14px"><button class="btn" id="newchat">＋ Ny chatt</button><button class="btn ghost" id="joinchat">🔗 Gå med med kod</button></div>
      <div id="rooms">${rs.map(r => {
        const l = lastMsg(r);
        const prev = !l ? '<i>Inga meddelanden än</i>' : l.t === 'file' ? '📎 ' + esc(l.fname) : l.t === 'tr' ? '🎙️ ' + esc(l.text) : esc((l.mine ? 'Du: ' : (l.name ? l.name + ': ' : '')) + (l.text || ''));
        return `<div class="meeting chatrow" data-id="${r.id}" role="button" tabindex="0">${avatar(r.name, '#6C4CF5', r.kind)}
          <div class="info"><div class="row between"><div class="t">${esc(r.name)}</div><small class="muted">${l ? time(l.at) : ''}</small></div>
          <div class="small muted prev">${prev}</div></div>${r.unread ? `<span class="unread">${r.unread}</span>` : ''}</div>`;
      }).join('') || `<div class="card empty">${Mascot.svg({ size: 90 })}<p><b>Inga chattar än.</b></p><p class="small muted">Starta en chatt och skicka inbjudan till någon – eller klistra in en kod du har fått.</p></div>`}</div>`;
    $$('.chatrow', v).forEach(el => el.addEventListener('click', () => App.go('#/chat/' + el.dataset.id)));
    $('#newchat', v).addEventListener('click', () => newChatSheet());
    $('#joinchat', v).addEventListener('click', () => joinSheet());
    offs.push(MoteyNet.on('message', () => renderList(v, ui)), MoteyNet.on('rooms', () => renderList(v, ui)),
      MoteyNet.on('status', () => { const p = $('#netpill', v); if (p) p.outerHTML = statusPill(); }));
  }

  function newChatSheet() {
    const sh = App.sheet(`<h2>Ny chatt</h2><label class="field"><span>Namn på chatten</span><input type="text" id="cn" placeholder="t.ex. Projekt Nova eller Lisa"></label>
      <button class="btn block" id="cgo">Skapa och bjud in</button>`);
    $('#cn', sh.el).focus();
    $('#cgo', sh.el).addEventListener('click', async () => {
      const r = await MoteyNet.createRoom({ name: $('#cn', sh.el).value.trim() || 'Chatt', kind: 'chat' });
      sh.close(); App.go('#/chat/' + r.id); inviteSheet(r);
    });
  }

  function joinSheet(prefill) {
    const sh = App.sheet(`<h2>Gå med</h2><p class="muted small">Klistra in inbjudan (koden eller länken) som du har fått.</p>
      <label class="field"><span>Inbjudan</span><textarea id="jc" style="min-height:80px" placeholder="M1…">${esc(prefill || '')}</textarea></label>
      <button class="btn block" id="jgo">Gå med</button><p class="small" id="jerr" style="color:var(--danger)"></p>`);
    $('#jgo', sh.el).addEventListener('click', async () => {
      try {
        const r = await MoteyNet.join($('#jc', sh.el).value);
        sh.close(); App.toast('Du är med! 🎉');
        App.go(r.kind === 'meeting' && r.meta ? '#/m/r-' + r.id : '#/chat/' + r.id);
      } catch (e) { $('#jerr', sh.el).textContent = e.message; }
    });
  }

  function inviteSheet(r) {
    const code = MoteyNet.inviteCode(r), link = MoteyNet.inviteLink(r);
    const what = r.kind === 'meeting' ? `mötet "${r.name}"` : `chatten "${r.name}"`;
    const text = `Hej! Gå med i ${what} i Motey 💬\n\n1. Öppna länken (eller appen Motey → Gå med)\n${link}\n\n2. Eller klistra in koden i Motey:\n${code}`;
    const sh = App.sheet(`<div class="motey-stage">${Mascot.svg({ size: 70, mood: 'wink' })}<div class="speech">Skicka inbjudan till dem som ska vara med. Alla som har koden kan läsa ${r.kind === 'meeting' ? 'mötet' : 'chatten'} – dela den bara med rätt personer.</div></div>
      <label class="field" style="margin-top:14px"><span>Kod</span><input type="text" readonly value="${esc(code)}" id="ic"></label>
      <div class="row"><button class="btn" id="icopy">📋 Kopiera inbjudan</button><button class="btn ghost" id="ishare">📤 Dela</button><button class="btn ghost" id="imail">✉️ E-post</button><button class="btn ghost" id="isms">💬 SMS</button></div>`);
    $('#ic', sh.el).addEventListener('focus', e => e.target.select());
    $('#icopy', sh.el).addEventListener('click', async () => App.toast(await Platform.copy(text) ? 'Inbjudan kopierad 📋' : 'Markera koden och kopiera den'));
    $('#ishare', sh.el).addEventListener('click', () => Platform.share(text, 'Motey-inbjudan'));
    $('#imail', sh.el).addEventListener('click', () => Platform.openUrl(`mailto:?subject=${encodeURIComponent('Inbjudan till ' + r.name + ' i Motey')}&body=${encodeURIComponent(text)}`));
    $('#isms', sh.el).addEventListener('click', () => Platform.openUrl('sms:?&body=' + encodeURIComponent(text)));
  }

  /* ---------------- one conversation ---------------- */
  function bubble(m, r) {
    const who = esc(m.name || 'Någon');
    if (m.t === 'hello') return `<div class="sysmsg">👋 ${m.mine ? 'Du' : who} gick med</div>`;
    if (m.t === 'call') return `<div class="sysmsg">📞 ${m.mine ? 'Du' : who} gick med i samtalet</div>`;
    if (m.t === 'meta') return `<div class="sysmsg">📅 ${who} ${m.meta && m.meta.title ? 'planerade ”' + esc(m.meta.title) + '” ' + esc(new Date(m.meta.start).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : 'uppdaterade mötet'}</div>`;
    if (m.t === 'next') return `<div class="sysmsg">📅 ${esc(m.text || 'Nästa möte är bokat')} – du är inbjuden automatiskt.</div>`;
    if (m.t === 'tr') return `<div class="trmsg">🎙️ <b>${who}:</b> ${esc(m.text)}</div>`;
    const body = m.t === 'file'
      ? `<button class="filemsg" data-fid="${esc(m.fid)}" data-name="${esc(m.fname)}">📎 <span><b>${esc(m.fname)}</b><br><small>${Math.max(1, Math.round((m.size || 0) / 1024))} kB · tryck för att spara</small></span></button>`
      : esc(m.text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
    const col = (r.members[m.pk] || {}).color || '#6C4CF5';
    return `<div class="msg ${m.mine ? 'mine' : ''}">${m.mine ? '' : `<div class="from" style="color:${esc(col)}">${who}</div>`}<div class="bub">${body}</div><div class="when">${time(m.at)}</div></div>`;
  }

  function mountRoom(container, roomId, opts) {
    opts = opts || {};
    const r = MoteyNet.room(roomId);
    if (!r) { container.innerHTML = '<p class="muted">Chatten finns inte längre.</p>'; return () => {}; }
    container.innerHTML = `<div class="msgs ${opts.compact ? 'compact' : ''}" id="msgs"></div>
      <div class="composer"><label class="icon-btn" title="Skicka fil">📎<input type="file" id="cf" hidden></label>
      <textarea id="ct" rows="1" placeholder="Skriv ett meddelande…"></textarea><button class="btn" id="cs" aria-label="Skicka">➤</button></div>`;
    const list = $('#msgs', container);
    const draw = () => {
      const a = MoteyNet.messages(r.id).filter(m => m.t !== 'chunk');
      list.innerHTML = a.map(m => bubble(m, r)).join('') || '<p class="muted small" style="text-align:center">Säg hej! 👋</p>';
      list.scrollTop = list.scrollHeight;
      $$('.filemsg', list).forEach(b => b.addEventListener('click', () => downloadFile(b.dataset.fid, b.dataset.name)));
      r.lastRead = Date.now(); r.unread = 0; Store.save();
    };
    draw();
    const ta = $('#ct', container);
    const sendNow = async () => {
      const t = ta.value.trim(); if (!t) return;
      ta.value = ''; ta.style.height = '';
      await MoteyNet.sendText(r.id, t);
    };
    $('#cs', container).addEventListener('click', sendNow);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNow(); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
    $('#cf', container).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { App.toast('Skickar ' + f.name + '…'); await MoteyNet.sendFile(r.id, f, f.name); App.toast('📎 Skickad'); }
      catch (err) { App.toast(err.message, 5000); }
      e.target.value = '';
    });
    const off = MoteyNet.on('message', (room) => { if (room.id === r.id) draw(); });
    return off;
  }

  async function downloadFile(fid, name) {
    const f = await MoteyNet.files.get(fid);
    if (!f) return App.toast('Filen har inte kommit fram än');
    if (f.missing) return App.toast(`Hämtar filen… (${f.have}/${f.meta.n})`);
    App.toast(await Platform.saveFile(name || f.meta.name, f.blob));
  }

  function renderRoom(v, id, ui) {
    if (isDemo()) return renderDemo(v, ui);
    const r = MoteyNet.room(id);
    if (!r) return App.go('#/chat');
    const n = Object.keys(r.members).length;
    v.innerHTML = `<div class="chat-head"><a href="#/chat" class="btn sm ghost">‹</a>${avatar(r.name, '#6C4CF5', r.kind)}
      <div style="flex:1;min-width:0"><div class="t">${esc(r.name)}</div><div class="small muted">${n} ${n === 1 ? 'person' : 'personer'} · ${Object.values(r.members).map(m => esc(m.name)).filter(Boolean).slice(0, 4).join(', ')}</div></div>
      <button class="icon-btn" id="call" title="Ring">📞</button><button class="icon-btn" id="inv" title="Bjud in">🔗</button><button class="icon-btn" id="more" title="Mer">⋯</button></div>
      ${r.kind === 'meeting' && r.meta ? `<a class="card" href="#/m/r-${r.id}" style="display:block;text-decoration:none;color:inherit;padding:10px 14px;margin:8px 0">📅 <b>${esc(r.meta.title)}</b> · ${esc(new Date(r.meta.start).toLocaleString('sv-SE', { weekday: 'long', hour: '2-digit', minute: '2-digit' }))} <span class="muted">– öppna mötet ›</span></a>` : ''}
      <div id="room"></div>`;
    $('#call', v).addEventListener('click', () => App.go('#/call/' + r.id));
    $('#inv', v).addEventListener('click', () => inviteSheet(r));
    $('#more', v).addEventListener('click', () => {
      const sh = App.sheet(`<h2>${esc(r.name)}</h2>
        <button class="btn ghost block" id="sum">✨ Motey, sammanfatta chatten</button><br><br>
        ${r.kind !== 'meeting' ? '<label class="field"><span>Byt namn</span><input type="text" id="rn" value="' + esc(r.name) + '"></label><button class="btn ghost block" id="rsave">Spara namn</button><br><br>' : ''}
        <button class="btn block" style="background:var(--danger)" id="leave">Lämna ${r.kind === 'meeting' ? 'mötet' : 'chatten'}</button>`);
      $('#sum', sh.el).addEventListener('click', async () => {
        const pseudo = { id: 'chat-' + r.id, title: r.name, attendees: Object.values(r.members).map(m => m.name), transcript: MoteyNet.messages(r.id).filter(m => m.t === 'msg' || m.t === 'tr').map(m => ({ who: m.name, text: m.text })), files: [] };
        let s; try { s = (await AI.summarize(pseudo, { charge: true })).value; } catch (e) { sh.close(); return; }
        sh.close();
        const s2 = App.sheet(`<div id="sumb"></div>`);
        App.moteySays($('#sumb', s2.el), s.summary + (s.actions.length ? ' Att göra: ' + s.actions.map(a => a.who + ' – ' + a.what).join('; ') : ''));
      });
      const rs = $('#rsave', sh.el);
      if (rs) rs.addEventListener('click', () => { r.name = $('#rn', sh.el).value.trim() || r.name; Store.save(); sh.close(); renderRoom(v, id, ui); });
      $('#leave', sh.el).addEventListener('click', () => { if (confirm('Lämna och ta bort från den här enheten?')) { sh.close(); MoteyNet.leave(r.id); App.go('#/chat'); } });
    });
    offs.push(mountRoom($('#room', v), r.id));
    // the meeting info (name, time) can arrive after the chat is opened
    const sig = r.name + r.kind;
    offs.push(MoteyNet.on('rooms', () => { if (location.hash === '#/chat/' + id && r.name + r.kind !== sig) { cleanup(); renderRoom(v, id, ui); } }));
  }

  /* ---------------- demo ---------------- */
  const demoLog = [];
  function renderDemo(v) {
    if (!demoLog.length) {
      const n = AI.firstName(Store.settings.bossName || 'Birgitta');
      demoLog.push({ who: n, text: `Hej ${AI.firstName(Store.settings.name)}! Hann du titta på budgeten?`, at: Date.now() - 36e5 },
        { who: 'Du', mine: true, text: 'Inte än, jag missade mötet 😅', at: Date.now() - 35e5 },
        { who: 'Motey', motey: true, text: 'Lugn! Jag har sammanfattat mötet åt dig. Tryck på 👀 på Hem så berättar jag allt.', at: Date.now() - 34e5 });
    }
    v.innerHTML = `<div class="card hero" style="padding:14px">${Mascot.svg({ size: 64 })}<div style="flex:1"><b>Det här är demon.</b><div class="small muted">Riktiga chattar och möten med andra människor startar du med ett klick.</div></div><button class="btn ghost sm" id="goreal">Börja på riktigt</button></div>
      <div class="chat-head">${avatar('', '', 'motey')}<div style="flex:1"><div class="t">Projekt Nova (demo)</div><div class="small muted">Birgitta, Motey och du</div></div></div>
      <div class="msgs" id="msgs"></div>
      <div class="composer"><textarea id="ct" rows="1" placeholder="Skriv något – Motey svarar"></textarea><button class="btn" id="cs">➤</button></div>`;
    const draw = () => {
      $('#msgs', v).innerHTML = demoLog.map(m => `<div class="msg ${m.mine ? 'mine' : ''}">${m.mine ? '' : `<div class="from">${esc(m.who)}</div>`}<div class="bub">${esc(m.text)}</div><div class="when">${time(m.at)}</div></div>`).join('');
      $('#msgs', v).scrollTop = 1e9;
    };
    draw();
    const send = async () => {
      const t = $('#ct', v).value.trim(); if (!t) return;
      $('#ct', v).value = '';
      demoLog.push({ who: 'Du', mine: true, text: t, at: Date.now() }); draw();
      const r = await AI.ask(t, Store.meeting('fin-1'));
      setTimeout(() => { demoLog.push({ who: 'Motey', motey: true, text: r.value, at: Date.now() }); if (document.body.contains(v)) draw(); }, 600);
    };
    $('#cs', v).addEventListener('click', send);
    $('#ct', v).addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    $('#goreal', v).addEventListener('click', () => App.goReal());
  }

  window.ChatMode = {
    render(v, id, ui) { cleanup(); return id ? renderRoom(v, id, ui) : renderList(v, ui); },
    destroy: cleanup, mountRoom, inviteSheet, joinSheet, downloadFile, avatar
  };
})();
