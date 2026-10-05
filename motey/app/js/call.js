/* Motey samtal – video and voice calls straight between devices (WebRTC mesh,
 * up to ~6 people). The encrypted handshake goes through MoteyNet signals.
 * Rule that avoids both sides calling at once: of every pair, the device
 * with the larger key makes the offer. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let session = null;

  function iceServers() {
    const s = Store.settings;
    const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
    if (s.turnUrl) list.push({ urls: s.turnUrl.split(/\s+/).filter(Boolean), username: s.turnUser || undefined, credential: s.turnPass || undefined });
    return list;
  }
  const gathered = pc => new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const h = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', h); res(); } };
    pc.addEventListener('icegatheringstatechange', h);
    setTimeout(res, 2500);
  });

  async function render(v, roomId, ui) {
    if (Store.settings.demo) return renderDemo(v);
    const r = MoteyNet.room(roomId);
    if (!r) return App.go('#/chat');
    const meeting = Store.meeting('r-' + r.id);
    v.innerHTML = `<div class="call">
      <div class="call-top"><a class="btn sm ghost" href="${meeting ? '#/m/' + meeting.id : '#/chat/' + r.id}" id="back">‹</a>
        <div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="small muted" id="cstat">Startar kamera…</div></div>
        <span class="badge" id="ccount">1</span></div>
      <div class="tiles" id="tiles"></div>
      <div class="captions hidden" id="caps"></div>
      <div class="call-bar">
        <button class="cbtn" id="mic" title="Mikrofon">🎤</button>
        <button class="cbtn" id="cam" title="Kamera">📷</button>
        <button class="cbtn" id="scr" title="Dela skärm">🖥️</button>
        <button class="cbtn" id="notes" title="Motey antecknar">📝</button>
        <button class="cbtn" id="chat" title="Chatt">💬</button>
        <button class="cbtn end" id="end" title="Lämna">✆</button>
      </div>
      <div class="call-chat hidden" id="cchat"></div>
    </div>`;
    const s = session = { r, pk: (await MoteyNet.roomSigner(r)).pk, peers: new Map(), local: null, alive: true, rec: null, offs: [] };
    const status = t => { const e = $('#cstat', v); if (e) e.textContent = t; };
    const count = () => { const e = $('#ccount', v); if (e) e.textContent = (1 + [...s.peers.values()].filter(p => p.connected).length) + ' i samtalet'; };

    // local media: video+audio, else audio only, else listen-only
    try { s.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' } }); }
    catch (e) {
      try { s.local = await navigator.mediaDevices.getUserMedia({ audio: true }); ui.toast('Ingen kamera – du är med med ljud'); }
      catch (e2) { s.local = new MediaStream(); ui.toast('Mikrofon och kamera är blockerade – du kan lyssna och se'); }
    }
    if (!s.alive) return stopLocal(s);
    tile('me', MoteyNet.me().name + ' (du)', s.local, true);
    status('Väntar på de andra… dela inbjudan om ingen är här.');

    function tile(id, name, stream, self) {
      let t = $('#t-' + id, v);
      if (!t) {
        t = document.createElement('div'); t.className = 'tile' + (self ? ' self' : ''); t.id = 't-' + id;
        t.innerHTML = `<video autoplay playsinline ${self ? 'muted' : ''}></video><div class="tname">${esc(name)}</div><div class="tav">${esc(String(name)[0] || '?').toUpperCase()}</div>`;
        $('#tiles', v).appendChild(t);
      }
      const vid = $('video', t);
      if (vid.srcObject !== stream) vid.srcObject = stream;
      const hasVideo = stream && stream.getVideoTracks().some(x => x.readyState === 'live' && x.enabled);
      t.classList.toggle('novideo', !hasVideo);
      vid.play().catch(() => {});
      layout();
      return t;
    }
    function layout() { const n = $('#tiles', v).children.length; $('#tiles', v).dataset.n = Math.min(n, 6); }

    function peer(pk, name) {
      let p = s.peers.get(pk);
      if (!p) { p = { pk, name: name || 'Någon', pc: null, sid: null, seen: Date.now(), connected: false }; s.peers.set(pk, p); }
      if (name) p.name = name;
      p.seen = Date.now();
      return p;
    }
    function newPc(p) {
      if (p.pc) try { p.pc.close(); } catch (e) { /* closed */ }
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      p.pc = pc; p.connected = false; p.started = Date.now();
      s.local.getTracks().forEach(t => pc.addTrack(t, s.local));
      // make sure we can receive even if we send nothing
      if (!s.local.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
      if (!s.local.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
      const remote = new MediaStream();
      pc.ontrack = e => { remote.addTrack(e.track); e.track.onunmute = () => tile(p.pk, p.name, remote); tile(p.pk, p.name, remote); };
      pc.onconnectionstatechange = () => {
        if (pc !== p.pc) return;
        p.connected = pc.connectionState === 'connected';
        if (p.connected) status('Ansluten 🎉');
        if (pc.connectionState === 'failed') { status('Anslutningen bröts – försöker igen…'); if (s.pk > p.pk) setTimeout(() => offer(p), 1500); }
        count();
      };
      return pc;
    }
    async function offer(p) {
      if (!s.alive) return;
      p.sid = Math.random().toString(36).slice(2);
      const pc = newPc(p);
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      MoteyNet.signal(r.id, { t: 'rtc', type: 'offer', to: p.pk, sid: p.sid, sdp: pc.localDescription.sdp });
    }
    async function answer(p, msg) {
      p.sid = msg.sid;
      const pc = newPc(p);
      await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      MoteyNet.signal(r.id, { t: 'rtc', type: 'answer', to: p.pk, sid: p.sid, sdp: pc.localDescription.sdp });
    }
    const needsOffer = p => s.pk > p.pk && (!p.pc || ['failed', 'closed'].includes(p.pc.connectionState) || (!p.connected && Date.now() - p.started > 15000));

    s.offs.push(MoteyNet.on('signal', async (room, m) => {
      if (room.id !== r.id || m.t !== 'rtc' || !s.alive) return;
      const p = peer(m.pk, m.name);
      try {
        if (m.type === 'join' || m.type === 'here') {
          if (m.type === 'join') MoteyNet.signal(r.id, { t: 'rtc', type: 'here', to: m.pk });
          if (needsOffer(p)) await offer(p);
        } else if (m.type === 'offer') await answer(p, m);
        else if (m.type === 'answer' && m.sid === p.sid && p.pc && p.pc.signalingState === 'have-local-offer') await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
        else if (m.type === 'bye') drop(p.pk);
      } catch (e) { console.warn('rtc', e); }
    }));
    function drop(pk) {
      const p = s.peers.get(pk); if (!p) return;
      try { p.pc && p.pc.close(); } catch (e) { /* closed */ }
      s.peers.delete(pk);
      const t = $('#t-' + pk, v); if (t) t.remove();
      layout(); count();
    }

    // announce, then keep saying "here" so late joiners find us
    MoteyNet.signal(r.id, { t: 'rtc', type: 'join' });
    MoteyNet.send(r.id, { t: 'call' });
    if (meeting) { meeting.attended = true; Store.save(); }
    s.beat = setInterval(() => {
      MoteyNet.signal(r.id, { t: 'rtc', type: 'here' });
      for (const p of s.peers.values()) {
        if (Date.now() - p.seen > 35000) drop(p.pk);
        else if (needsOffer(p)) offer(p);
      }
    }, 8000);

    /* ---------- controls ---------- */
    const toggle = (kind, btn) => {
      const tr = s.local[kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks']();
      if (!tr.length) return ui.toast(kind === 'audio' ? 'Ingen mikrofon' : 'Ingen kamera');
      const on = !tr[0].enabled; tr.forEach(t => { t.enabled = on; });
      btn.classList.toggle('off', !on);
      if (kind === 'video') tile('me', MoteyNet.me().name + ' (du)', s.local, true);
    };
    $('#mic', v).addEventListener('click', e => toggle('audio', e.currentTarget));
    $('#cam', v).addEventListener('click', e => toggle('video', e.currentTarget));
    const scr = $('#scr', v);
    if (!navigator.mediaDevices.getDisplayMedia) scr.classList.add('hidden');
    scr.addEventListener('click', async () => {
      if (s.screen) return stopScreen();
      try {
        s.screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = s.screen.getVideoTracks()[0];
        swapVideo(track); scr.classList.add('on');
        track.onended = stopScreen;
      } catch (e) { s.screen = null; }
    });
    function stopScreen() {
      if (!s.screen) return;
      s.screen.getTracks().forEach(t => t.stop()); s.screen = null; scr.classList.remove('on');
      swapVideo(s.local.getVideoTracks()[0] || null);
    }
    function swapVideo(track) {
      for (const p of s.peers.values()) if (p.pc) p.pc.getTransceivers().filter(x => x.receiver.track.kind === 'video').forEach(x => x.sender.replaceTrack(track).catch(() => {}));
      const preview = new MediaStream([...s.local.getAudioTracks(), ...(track ? [track] : [])]);
      tile('me', MoteyNet.me().name + ' (du)', preview, true);
    }
    // Motey takes notes: speech → text → shared transcript of the meeting
    const notes = $('#notes', v);
    if (!Platform.recognizer()) notes.title = 'Motey antecknar (stöds inte i den här webbläsaren – skriv i chatten i stället)';
    notes.addEventListener('click', () => {
      if (s.rec) { const x = s.rec; s.rec = null; x.stop(); notes.classList.remove('on'); $('#caps', v).classList.add('hidden'); return; }
      const rec = Platform.recognizer();
      if (!rec) return ui.toast('Den här enheten kan inte göra tal till text. Skriv i chatten så hamnar det i protokollet.', 5000);
      rec.interimResults = true;
      rec.onresult = e => {
        const res = e.results[e.results.length - 1];
        $('#caps', v).textContent = res[0].transcript;
        if (res.isFinal && res[0].transcript.trim()) MoteyNet.sendTranscript(r.id, res[0].transcript.trim());
      };
      rec.onend = () => { if (s.rec === rec) try { rec.start(); } catch (e) { /* running */ } };
      rec.onerror = ev => { if (ev.error === 'not-allowed') { s.rec = null; notes.classList.remove('on'); ui.toast('Mikrofonen är blockerad för tal till text'); } };
      try { rec.start(); s.rec = rec; notes.classList.add('on'); $('#caps', v).classList.remove('hidden'); ui.toast('📝 Motey antecknar – allt sagt hamnar i mötesprotokollet'); }
      catch (e) { ui.toast('Kunde inte starta tal till text'); }
    });
    $('#chat', v).addEventListener('click', e => {
      const c = $('#cchat', v);
      const show = c.classList.toggle('hidden') === false;
      e.currentTarget.classList.toggle('on', show);
      if (show && !c.dataset.mounted) { c.dataset.mounted = '1'; s.offs.push(ChatMode.mountRoom(c, r.id, { compact: true })); }
    });
    $('#end', v).addEventListener('click', () => App.go(meeting ? '#/m/' + meeting.id : '#/chat/' + r.id));
  }

  function stopLocal(s) { if (s.local) s.local.getTracks().forEach(t => t.stop()); if (s.screen) s.screen.getTracks().forEach(t => t.stop()); }

  function destroy() {
    const s = session; session = null;
    if (!s) return;
    s.alive = false;
    clearInterval(s.beat);
    if (s.rec) { const r = s.rec; s.rec = null; try { r.stop(); } catch (e) { /* stopped */ } }
    try { MoteyNet.signal(s.r.id, { t: 'rtc', type: 'bye' }); } catch (e) { /* offline */ }
    for (const p of s.peers.values()) try { p.pc && p.pc.close(); } catch (e) { /* closed */ }
    stopLocal(s);
    s.offs.forEach(f => f());
  }

  /* Demo: try your camera with Motey as the other participant. */
  async function renderDemo(v) {
    v.innerHTML = `<div class="call"><div class="call-top"><a class="btn sm ghost" href="#/home">‹</a><div style="flex:1"><b>Testsamtal (demo)</b><div class="small muted">Så här ser ett Motey-möte ut. Riktiga samtal startar du när du börjar på riktigt.</div></div></div>
      <div class="tiles" id="tiles" data-n="2"><div class="tile self" id="t-me"><video autoplay playsinline muted></video><div class="tname">Du</div><div class="tav">🙂</div></div>
      <div class="tile novideo"><div class="tname">Motey</div><div class="tav" style="background:#EDE7FF">${Mascot.svg({ size: 90, talking: true })}</div></div></div>
      <div class="call-bar"><button class="btn" id="goreal">🚀 Börja på riktigt</button><a class="cbtn end" href="#/home">✆</a></div></div>`;
    $('#goreal', v).addEventListener('click', () => App.goReal());
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      session = { alive: true, r: { id: '' }, peers: new Map(), local: st, offs: [], demo: true };
      const vid = $('#t-me video', v); vid.srcObject = st; $('#t-me', v).classList.remove('novideo');
    } catch (e) { $('#t-me', v).classList.add('novideo'); }
    Platform.speak('Hej! Det här är ett testsamtal. När du börjar på riktigt kan du ringa dina kollegor direkt i Motey.');
  }
  const origDestroy = destroy;
  window.CallMode = {
    render,
    destroy() { if (session && session.demo) { stopLocal(session); session = null; return; } origDestroy(); }
  };
})();
