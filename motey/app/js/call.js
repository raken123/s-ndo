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
        <button class="cbtn" id="restyle" title="AI-Live: byt stil på någon">🎭</button>
        <button class="cbtn" id="replace" title="Live Replace (Pro)">🏖️</button>
        <button class="cbtn" id="chat" title="Chatt">💬</button>
        <button class="cbtn end" id="end" title="Lämna">✆</button>
      </div>
      <div class="call-chat hidden" id="cchat"></div>
      <div class="replace-panel hidden" id="rpanel"></div>
    </div>`;
    const s = session = { r, pk: (await MoteyNet.roomSigner(r)).pk, peers: new Map(), local: null, alive: true, rec: null, offs: [], out: {} };
    // what we send: normally camera + microphone; Live Replace swaps in the 3D head and Gemini's voice
    const outgoing = () => new MediaStream([s.out.audio || s.local.getAudioTracks()[0], s.out.video || (s.screen && s.screen.getVideoTracks()[0]) || s.local.getVideoTracks()[0]].filter(Boolean));
    s.outgoing = outgoing;
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
      const outS = outgoing(); outS.getTracks().forEach(t => pc.addTrack(t, outS));
      // make sure we can receive even if we send nothing
      if (!s.local.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
      if (!s.local.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
      const remote = new MediaStream();
      p.remote = remote;
      pc.ontrack = e => { remote.addTrack(e.track); e.track.onunmute = () => tile(p.pk, p.name, remote); tile(p.pk, p.name, remote); if (e.track.kind === 'audio' && s.onRemoteAudio) s.onRemoteAudio(p, remote); };
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
        if (s.replace) { s.screen.getTracks().forEach(t => t.stop()); s.screen = null; return ui.toast('Stäng av Live Replace först'); }
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
    /* ---------- AI-Live in the call: hear someone in another style ---------- */
    $('#restyle', v).addEventListener('click', () => {
      if (s.styler) return stopStyler();
      if (!Plans.allow('live_min')) return;
      if (!AI.hasKey()) return ui.toast('AI-Live behöver Gemini – koppla under Mer → AI', 5000);
      const people = [...s.peers.values()].filter(p => p.remote);
      if (!people.length) return ui.toast('Ingen annan är med i samtalet än');
      const sh = App.sheet(`<h2>🎭 Byt stil på någon</h2><p class="muted small">Du hör Motey säga samma sak i stället för personen – bara du, de andra märker inget. Gemini 3.8 Flash Live.</p>
        <p class="small muted">Vem?</p><div class="row" id="rp">${people.map((p, i) => `<span class="chip ${i ? '' : 'on'}" data-pk="${p.pk}">${esc(p.name)}</span>`).join('')}</div>
        <p class="small muted" style="margin-top:12px">Stil</p><div class="row" id="rs">${Object.entries(AI.STYLES).map(([k, x]) => `<span class="chip ${k === (Store.settings.liveStyle || 'snall') ? 'on' : ''}" data-s="${k}">${x.icon} ${x.name}</span>`).join('')}</div>
        <button class="btn block" id="rgo" style="margin-top:14px">Starta</button>`);
      const pickOne = sel => sh.el.querySelectorAll(sel + ' .chip').forEach(c => c.addEventListener('click', () => sh.el.querySelectorAll(sel + ' .chip').forEach(x => x.classList.toggle('on', x === c))));
      pickOne('#rp'); pickOne('#rs');
      $('#rgo', sh.el).addEventListener('click', async () => {
        const p = s.peers.get($('#rp .chip.on', sh.el).dataset.pk), style = $('#rs .chip.on', sh.el).dataset.s;
        Store.settings.liveStyle = style; Store.save(); sh.close();
        const vid = $('#t-' + p.pk + ' video', v); if (vid) vid.muted = true;
        const caps = $('#caps', v); caps.classList.remove('hidden'); caps.textContent = `🎭 ${p.name} i stilen ${AI.STYLES[style].name}…`;
        let out = '';
        const sess = LiveMode.liveSession({
          system: AI.liveInstruction(style, p.name), voice: Store.settings.liveVoice || 'Puck',
          onOut: t => { caps.textContent = '🎭 ' + t; }, onIn: () => {}, onTurn: (i, o) => { out = o; },
          onTalking: () => {}, onError: e => { if (!(e instanceof Plans.QuotaError)) ui.toast('AI-Live: ' + e.message); stopStyler(); }
        });
        try { if (!(await sess.open())) return; } catch (e) { ui.toast('Kunde inte starta AI-Live: ' + e.message); if (vid) vid.muted = false; return; }
        const cap = Gemini.pcmCapture([p.remote], b64 => sess.live && !sess.live.closed && sess.live.audio(b64));
        s.styler = { sess, cap, vid, pk: p.pk };
        $('#restyle', v).classList.add('on');
      });
    });
    function stopStyler() {
      const x = s.styler; s.styler = null; if (!x) return;
      x.cap.stop(); x.sess.close(); if (x.vid) x.vid.muted = false;
      $('#restyle', v).classList.remove('on'); if (!s.rec) $('#caps', v).classList.add('hidden');
    }
    s.stopStyler = stopStyler;

    /* ---------- Live Replace (Pro): a 3D you talks in the meeting ---------- */
    $('#replace', v).addEventListener('click', () => s.replace ? stopReplace() : startReplace());
    async function startReplace() {
      if (!Plans.allow('replace_min')) return;
      if (!Avatar.hasFace()) { ui.toast('Skanna ditt 3D-ansikte först (tar en halv minut)', 5000); return App.go('#/scan'); }
      if (!AI.hasKey()) return ui.toast('Live Replace behöver Gemini – koppla under Mer → AI', 5000);
      const me = MoteyNet.me().name, St = Store.settings;
      const sofar = MoteyNet.messages(r.id).filter(m => (m.t === 'msg' || m.t === 'tr') && m.text).slice(-40).map(m => `${m.name}: ${m.text}`).join('\n');
      const head = Avatar.createHead(Avatar.load(), { width: 640, height: 360 });
      await head.ready;
      const player = Gemini.pcmPlayer({ speakers: !!St.replaceHear });
      head.setLevel(() => player.level());
      let inp = '', out = '';
      const panel = $('#rpanel', v);
      const live = new Gemini.Live({
        action: 'replace', modality: 'AUDIO', voice: St.replaceVoice || 'Charon',
        system: `Du är ${me}s digitala 3D-tvilling i videomötet "${r.name}". ${me} är inte vid datorn just nu, så du pratar som ${me} – i första person, på svenska, kort och naturligt (en eller två meningar). ` +
          `Det du hör är de andra i mötet. Svara bara när någon pratar till ${me} eller frågar alla; annars är du tyst. Lova inget och hitta inte på siffror – säg att du återkommer om du inte vet. ` +
          `Om någon frågar om du är en AI svarar du ärligt att du är ${me}s AI-tvilling i Motey. Meddelanden som börjar med [Från ${me}] är instruktioner från riktiga ${me} – följ dem.\n\n` +
          `Det här vet du: ${St.replaceNotes || '(inget särskilt)'}\n\nMötet hittills:\n${sofar || '(inget än)'}`,
        onAudio: (d, m) => player.play(d, m),
        onInterrupt: () => player.flush(),
        onIn: t => { inp += t; },
        onText: t => { out += t; const e = $('#r-said', v); if (e) e.textContent = out; },
        onTurn: () => {
          if (inp.trim()) MoteyNet.sendTranscript(r.id, 'Mötet: ' + inp.trim());
          if (out.trim()) MoteyNet.sendTranscript(r.id, out.trim() + ' (3D-tvilling)');
          inp = ''; out = '';
        },
        onError: e => { ui.toast('Live Replace: ' + e.message, 5000); stopReplace(); }
      });
      try { await live.open(); } catch (e) { head.destroy(); player.close(); return ui.toast('Kunde inte starta Gemini Live: ' + e.message, 6000); }
      Plans.charge('replace_min');
      const minute = setInterval(() => { try { Plans.check('replace_min'); Plans.charge('replace_min'); } catch (e) { stopReplace(); Plans.upgradeSheet(e); } }, 60000);
      const cap = Gemini.pcmCapture([...s.peers.values()].map(p => p.remote).filter(Boolean), b64 => !live.closed && live.audio(b64));
      s.onRemoteAudio = (p, st) => cap.add(st);
      let raf = 0; const loop = () => { head.frame(); raf = requestAnimationFrame(loop); }; loop();
      const vt = head.canvas.captureStream(25).getVideoTracks()[0];
      const at = player.stream && player.stream.getAudioTracks()[0];
      s.out = { audio: at, video: vt };
      swapTracks();
      tile('me', me + ' (3D-tvilling)', new MediaStream([vt]), false);
      $('#t-me', v).classList.remove('self');
      s.replace = { live, player, cap, head, minute, stop() { cancelAnimationFrame(raf); } };
      $('#replace', v).classList.add('on');
      panel.innerHTML = `<div class="row between"><b>🏖️ Live Replace är på</b><button class="btn sm" id="r-stop">Ta över själv</button></div>
        <div class="small muted">3D-du pratar i mötet med Gemini 3.8 Flash Live. Ingen kan höra dig nu.</div>
        <div class="r-said" id="r-said">…</div>
        <div class="row"><input type="text" id="r-say" placeholder="Säg åt 3D-du, t.ex. ”säg att jag skickar rapporten i morgon”" style="flex:1"><button class="btn sm" id="r-send">Skicka</button></div>
        <label class="switch small" style="margin:8px 0 0"><input type="checkbox" id="r-hear" ${St.replaceHear ? 'checked' : ''}> Hör vad 3D-du säger</label>`;
      panel.classList.remove('hidden');
      $('#r-stop', panel).addEventListener('click', stopReplace);
      const send = () => { const t = $('#r-say', panel).value.trim(); if (!t) return; $('#r-say', panel).value = ''; live.text(`[Från ${me}] ${t}`); };
      $('#r-send', panel).addEventListener('click', send);
      $('#r-say', panel).addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      $('#r-hear', panel).addEventListener('change', e => { St.replaceHear = e.target.checked; Store.save(); ui.toast('Gäller nästa gång du startar Live Replace'); });
      MoteyNet.sendText(r.id, `🤖 ${me}s AI-tvilling tar mötet en stund (Motey Live Replace).`);
    }
    function stopReplace() {
      const x = s.replace; s.replace = null; if (!x) return;
      clearInterval(x.minute); x.stop(); x.cap.stop(); x.live.close(); x.player.close(); x.head.destroy();
      s.onRemoteAudio = null; s.out = {};
      swapTracks();
      $('#t-me', v).classList.add('self');
      tile('me', MoteyNet.me().name + ' (du)', s.local, true);
      $('#replace', v).classList.remove('on'); $('#rpanel', v).classList.add('hidden');
      MoteyNet.sendText(r.id, `🙋 ${MoteyNet.me().name} är tillbaka själv.`);
    }
    s.stopReplace = stopReplace;
    function swapTracks() {
      const o = outgoing();
      const a = o.getAudioTracks()[0] || null, vtr = o.getVideoTracks()[0] || null;
      for (const p of s.peers.values()) if (p.pc) p.pc.getTransceivers().forEach(x => {
        const k = x.receiver.track.kind;
        x.sender.replaceTrack(k === 'audio' ? a : vtr).catch(() => {});
      });
    }

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
    try { s.stopReplace && s.stopReplace(); s.stopStyler && s.stopStyler(); } catch (e) { /* closing anyway */ }
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
