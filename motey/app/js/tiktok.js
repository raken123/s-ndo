/* Motey TikTok-läge (example 3): turns a meeting into a short vertical video
 * with an animated presenter, pictures from Wikipedia, captions and a beat.
 * Plays in the app (with voice) and exports as a video file. */
(function () {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const W = 720, H = 1280;
  let alive = false, raf = 0, audio = null, state = null;

  /* ---------- pictures from the internet ---------- */
  async function wikiImage(q) {
    if (!q) return null;
    for (const lang of ['sv', 'en']) {
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/ /g, '_'))}`, { signal: ctl.signal });
        clearTimeout(to);
        if (!r.ok) continue;
        const j = await r.json();
        let src = j.thumbnail && j.thumbnail.source;
        if (!src) continue;
        src = src.replace(/\/(\d+)px-/, '/720px-');
        const img = await loadImg(src).catch(() => loadImg(j.thumbnail.source));
        return { img, credit: 'Bild: Wikipedia / ' + (j.title || q) };
      } catch (e) { /* offline or not found */ }
    }
    return null;
  }
  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = 'anonymous'; // keeps the canvas exportable
      i.onload = () => res(i); i.onerror = rej;
      i.src = src;
    });
  }

  /* ---------- music: a small generated beat (WebAudio) ---------- */
  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const out = ctx.createGain(); out.gain.value = 0.35;
    out.connect(ctx.destination);
    const rec = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (rec) out.connect(rec);
    const bpm = 104, beat = 60 / bpm;
    const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
    const f = n => 440 * Math.pow(2, (n - 69) / 12);
    let next = ctx.currentTime + 0.05, step = 0, timer = null;
    let noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(out); o.start(t); o.stop(t + 0.3); }
    function hat(t, v) { const s = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; s.buffer = noise; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(hp).connect(g).connect(out); s.start(t); s.stop(t + 0.06); }
    function pad(t, notes) { notes.forEach(n => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f(n); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.linearRampToValueAtTime(0, t + beat * 3.8); o.connect(g).connect(out); o.start(t); o.stop(t + beat * 4); }); }
    function bass(t, n) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f(n - 24); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + beat); }
    function sched() {
      while (next < ctx.currentTime + 0.2) {
        const s8 = step % 8;
        if (s8 % 2 === 0) hat(next, 0.12); else hat(next, 0.05);
        if (s8 === 0 || s8 === 4 || s8 === 5) kick(next);
        const bar = Math.floor(step / 8) % 4;
        if (s8 === 0) pad(next, chords[bar]);
        if (s8 % 2 === 0) bass(next, chords[bar][0]);
        next += beat / 2; step++;
      }
    }
    return {
      ctx, stream: rec && rec.stream,
      start() { if (ctx.state === 'suspended') ctx.resume(); next = ctx.currentTime + 0.05; sched(); timer = setInterval(sched, 50); },
      stop() { clearInterval(timer); },
      close() { clearInterval(timer); try { ctx.close(); } catch (e) { /* closed */ } }
    };
  }

  /* ---------- drawing ---------- */
  const HUES = [262, 330, 200, 150, 28, 290, 190];
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrapLines(c, text, maxW) {
    const out = []; let line = '';
    for (const w of text.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line); return out;
  }
  // Path2D of the Motey bubble (same outline as the SVG mascot).
  let bubble = null;
  function drawMotey(c, x, y, s, t, talking) {
    bubble = bubble || new Path2D(Mascot.BODY);
    c.save(); c.translate(x, y + Math.sin(t * 3) * 4 * s); c.scale(s, s); c.translate(-100, -100);
    c.fillStyle = '#fff'; c.strokeStyle = '#1E1B3A'; c.lineWidth = 7; c.lineJoin = 'round';
    c.fill(bubble); c.stroke(bubble);
    const blink = (t % 4) > 3.85 ? 0.12 : 1;
    c.fillStyle = '#1E1B3A';
    [[78, 82], [122, 82]].forEach(([ex, ey]) => { c.beginPath(); c.ellipse(ex, ey, 15.5, 23 * blink, 0, 0, 7); c.fill(); });
    if (blink === 1) { c.fillStyle = '#fff'; [[72.5, 71], [116.5, 71]].forEach(([ex, ey]) => { c.beginPath(); c.arc(ex, ey, 5.5, 0, 7); c.fill(); }); }
    c.fillStyle = 'rgba(255,143,177,.55)'; [[58, 110], [142, 110]].forEach(([ex, ey]) => { c.beginPath(); c.ellipse(ex, ey, 11, 6, 0, 0, 7); c.fill(); });
    c.fillStyle = '#1E1B3A';
    if (talking) { c.beginPath(); c.ellipse(100, 122, 9, 2 + 6 * Math.abs(Math.sin(t * 14)), 0, 0, 7); c.fill(); }
    else { c.beginPath(); c.lineWidth = 5.5; c.lineCap = 'round'; c.moveTo(89, 118); c.quadraticCurveTo(100, 128, 111, 118); c.stroke(); }
    c.restore();
  }
  // The animated presenter ("en animerad person").
  function drawPresenter(c, x, y, t, talking) {
    const bob = Math.sin(t * 2.2) * 5;
    c.save(); c.translate(x, y + bob);
    // body
    c.fillStyle = '#6C4CF5'; rr(c, -95, 40, 190, 230, 80); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-26, 40); c.lineTo(0, 86); c.lineTo(26, 40); c.closePath(); c.fill();
    // arms – one gestures while talking
    const g = talking ? Math.sin(t * 5) * 0.5 : 0.1;
    c.strokeStyle = '#6C4CF5'; c.lineWidth = 34; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-80, 90); c.lineTo(-120, 190); c.stroke();
    c.save(); c.translate(80, 90); c.rotate(-1.1 - g); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -95); c.stroke();
    c.fillStyle = '#F2C29B'; c.beginPath(); c.arc(0, -108, 20, 0, 7); c.fill(); c.restore();
    c.fillStyle = '#F2C29B'; c.beginPath(); c.arc(-120, 198, 20, 0, 7); c.fill();
    // neck + head
    c.fillStyle = '#F2C29B'; c.fillRect(-18, 10, 36, 36);
    c.beginPath(); c.ellipse(0, -40, 66, 74, 0, 0, 7); c.fill();
    // hair
    c.fillStyle = '#2B1B12'; c.beginPath(); c.ellipse(0, -88, 70, 40, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.ellipse(-48, -60, 22, 40, 0.3, 0, 7); c.fill(); c.beginPath(); c.ellipse(46, -66, 18, 30, -0.3, 0, 7); c.fill();
    // eyes
    const blink = (t % 3.3) > 3.15 ? 0.1 : 1;
    c.fillStyle = '#1E1B3A'; [-24, 24].forEach(ex => { c.beginPath(); c.ellipse(ex, -40, 8, 10 * blink, 0, 0, 7); c.fill(); });
    c.fillStyle = '#fff'; if (blink === 1) [-27, 21].forEach(ex => { c.beginPath(); c.arc(ex, -44, 3, 0, 7); c.fill(); });
    c.strokeStyle = '#2B1B12'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-36, -62 - (talking ? Math.abs(Math.sin(t * 3)) * 5 : 0)); c.lineTo(-14, -64); c.moveTo(14, -64); c.lineTo(36, -62); c.stroke();
    c.fillStyle = 'rgba(255,110,140,.45)'; [-40, 40].forEach(ex => { c.beginPath(); c.ellipse(ex, -16, 11, 7, 0, 0, 7); c.fill(); });
    // mouth
    c.fillStyle = '#7A1F2B';
    const open = talking ? 4 + 13 * Math.abs(Math.sin(t * 13) * Math.sin(t * 7.3)) : 3;
    c.beginPath(); c.ellipse(0, 4, 18, open, 0, 0, 7); c.fill();
    c.restore();
  }

  function frame(c, st, time, talkingOverride) {
    const scenes = st.scenes;
    let acc = 0, i = 0;
    while (i < scenes.length - 1 && time > acc + scenes[i].dur) { acc += scenes[i].dur; i++; }
    const sc = scenes[i], lt = Math.min(time - acc, sc.dur), p = lt / sc.dur;
    const hue = HUES[i % HUES.length];
    // background
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${hue},85%,62%)`); g.addColorStop(1, `hsl(${(hue + 50) % 360},80%,45%)`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalAlpha = 0.12; c.fillStyle = '#fff';
    for (let k = 0; k < 7; k++) { c.beginPath(); c.arc((k * 173 + time * 30) % (W + 200) - 100, 200 + (k * 211) % 900, 40 + k * 12, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    // story bars
    scenes.forEach((s, k) => {
      const bw = (W - 40 - (scenes.length - 1) * 6) / scenes.length, bx = 20 + k * (bw + 6);
      c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, bx, 22, bw, 6, 3); c.fill();
      c.fillStyle = '#fff'; rr(c, bx, 22, bw * (k < i ? 1 : k === i ? p : 0), 6, 3); c.fill();
    });
    // picture card with a slow zoom
    const cx = 50, cy = 120, cw = W - 100, ch = 600;
    const enter = Math.min(1, lt / 0.35);
    c.save(); c.translate(W / 2, cy + ch / 2); c.rotate((1 - enter) * 0.15 * (i % 2 ? 1 : -1)); c.scale(0.8 + 0.2 * enter, 0.8 + 0.2 * enter); c.translate(-W / 2, -(cy + ch / 2));
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
    c.fillStyle = '#fff'; rr(c, cx - 10, cy - 10, cw + 20, ch + 20, 34); c.fill();
    c.shadowColor = 'transparent';
    c.save(); rr(c, cx, cy, cw, ch, 26); c.clip();
    if (sc.image) {
      const im = sc.image.img, z = 1.05 + 0.12 * p;
      const sc2 = Math.max(cw / im.width, ch / im.height) * z;
      c.drawImage(im, cx + (cw - im.width * sc2) / 2 - 20 * p, cy + (ch - im.height * sc2) / 2, im.width * sc2, im.height * sc2);
      c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(cx, cy + ch - 34, cw, 34);
      c.fillStyle = '#fff'; c.font = '600 18px system-ui, sans-serif'; c.textAlign = 'left'; c.fillText(sc.image.credit, cx + 14, cy + ch - 11);
    } else {
      const gg = c.createLinearGradient(cx, cy, cx + cw, cy + ch);
      gg.addColorStop(0, `hsl(${(hue + 180) % 360},90%,92%)`); gg.addColorStop(1, `hsl(${(hue + 210) % 360},90%,80%)`);
      c.fillStyle = gg; c.fillRect(cx, cy, cw, ch);
      if (i === scenes.length - 1) drawMotey(c, W / 2, cy + ch / 2 - 10, 2.2, time, false);
      else { c.font = '220px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sc.emoji || '💡', W / 2, cy + ch / 2 + Math.sin(time * 3) * 10); c.textBaseline = 'alphabetic'; }
    }
    c.restore();
    // emoji sticker
    c.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center';
    c.save(); c.translate(cx + cw - 20, cy + 20); c.rotate(Math.sin(time * 4) * 0.2); c.scale(1 + 0.1 * Math.sin(time * 6), 1 + 0.1 * Math.sin(time * 6)); c.fillText(sc.emoji || '✨', 0, 30); c.restore();
    c.restore();
    // captions, word by word
    c.font = '900 50px "Nunito","Segoe UI",system-ui,sans-serif'; c.textAlign = 'center';
    const lines = wrapLines(c, sc.caption, W - 90).slice(0, 4);
    const total = lines.join(' ').split(' ').length;
    const shown = Math.min(total, Math.floor(p * total * 1.6) + 1);
    let n = 0;
    lines.forEach((ln, k) => {
      const y = 800 + k * 62;
      const ws = ln.split(' ');
      let x = W / 2 - c.measureText(ln).width / 2;
      c.textAlign = 'left';
      ws.forEach(w => {
        n++;
        if (n <= shown) {
          c.lineWidth = 10; c.strokeStyle = '#1E1B3A'; c.lineJoin = 'round'; c.strokeText(w, x, y);
          c.fillStyle = n === shown ? '#FFE14D' : '#fff'; c.fillText(w, x, y);
        }
        x += c.measureText(w + ' ').width;
      });
    });
    c.textAlign = 'center';
    // presenter + Motey
    const talking = talkingOverride !== undefined ? talkingOverride : (lt > 0.3 && lt < sc.dur - 0.4);
    drawPresenter(c, 190, 1120, time, talking);
    drawMotey(c, 610, 1090, 0.62, time + 1, !talking && i % 2 === 1);
    // footer
    c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = '800 28px system-ui, sans-serif';
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 6;
    c.fillText('@motey.ai', 330, 1165);
    c.font = '600 22px system-ui, sans-serif';
    c.fillText(('♫ Motey beats – ' + st.title).slice(0, 38), 330, 1200);
    c.shadowColor = 'transparent';
    return { i, lt, sc };
  }

  /* ---------- UI ---------- */
  function render(v, meeting, ui) {
    if (!meeting) return ui.pickMeeting(v, 'tiktok', '🎬 TikTok-läge', 'Orkar du inte läsa? Motey gör mötet till en kort video med en animerad presentatör, bilder från internet och text.');
    alive = true;
    const esc = ui.esc;
    v.innerHTML = `<div class="row between"><a href="#/tiktok" class="btn sm ghost">‹ Byt möte</a><span class="badge brand" id="src">…</span></div>
      <h1 style="margin-top:12px">🎬 ${esc(meeting.title)}</h1>
      <div class="tt-wrap">
        <div class="tt-phone"><canvas id="tt" width="${W}" height="${H}"></canvas>
          <button class="tt-play hidden" id="ttplay" aria-label="Spela">▶</button>
          <div class="tt-side"><button id="like" aria-label="Gilla">❤️</button><span id="likes">0</span>
            <button id="cmt" aria-label="Sammanfattning">💬</button><span>Info</span>
            <button id="dl" aria-label="Spara video">⬇️</button><span>Spara</span>
            <button id="again" aria-label="Ny video">🔄</button><span>Ny</span></div></div>
        <div class="tt-panel card">
          <h3>Så här gör Motey videon</h3>
          <div class="progress"><i id="bar"></i></div><p class="small muted" id="status" style="margin-top:6px">Skriver manus…</p>
          <ol class="scene-list small" id="scenes"></ol>
          <p class="small muted">Presentatören och Motey animeras i realtid. Bilderna hämtas från Wikipedia när det finns nät. Den sparade videon har text och musik – rösten hörs bara i appen.</p>
        </div>
      </div>`;
    const canvas = $('#tt', v), c = canvas.getContext('2d');
    const status = t => { const s = $('#status', v); if (s) s.textContent = t; };
    const bar = x => { const b = $('#bar', v); if (b) b.style.width = Math.round(x * 100) + '%'; };
    let likes = 0;
    $('#like', v).addEventListener('click', e => { likes++; e.currentTarget.classList.add('liked'); $('#likes', v).textContent = likes; });
    $('#cmt', v).addEventListener('click', () => ui.toast(state ? state.scenes.map(s => s.caption).join(' · ').slice(0, 300) : '…', 6000));
    $('#again', v).addEventListener('click', () => { stop(); build(); });
    $('#dl', v).addEventListener('click', () => exportVideo());
    $('#ttplay', v).addEventListener('click', () => play());

    async function build() {
      bar(0.05); status('Skriver manus…');
      let r;
      try { r = await AI.videoScript(meeting); }
      catch (e) { if (e instanceof Plans.QuotaError) { status('Kvoten räcker inte för en ny video den här månaden.'); bar(0); return; } throw e; }
      if (!alive) return;
      $('#src', v).textContent = r.source === 'gemini' ? 'Manus: Gemini 3.8 Flash' : 'Manus: Offline-AI';
      const scenes = r.value.map(s => Object.assign({}, s, { dur: Math.max(4.2, Math.min(7.5, s.caption.split(' ').length * 0.42 + 1.6)) }));
      $('#scenes', v).innerHTML = scenes.map(s => `<li>${esc(s.emoji || '')} ${esc(s.caption)}</li>`).join('');
      status('Hämtar bilder från internet…');
      let done = 0;
      await Promise.all(scenes.map(async s => { s.image = await wikiImage(s.query); done++; bar(0.1 + 0.8 * done / scenes.length); }));
      if (!alive) return;
      const imgs = scenes.filter(s => s.image).length;
      bar(1); status(`Klar! ${scenes.length} scener, ${imgs} bilder från internet.`);
      state = { scenes, title: meeting.title, total: scenes.reduce((a, s) => a + s.dur, 0) };
      Store.state.stats.videos++; Store.save();
      frame(c, state, 0.01, false);
      $('#ttplay', v).classList.remove('hidden');
    }

    let t0 = 0, lastScene = -1;
    function play() {
      if (!state) return;
      $('#ttplay', v).classList.add('hidden');
      if (!audio) audio = makeAudio();
      if (audio) audio.start();
      t0 = performance.now(); lastScene = -1;
      const loop = now => {
        if (!alive) return;
        const time = (now - t0) / 1000;
        if (time >= state.total) { stop(); frame(c, state, state.total - 0.01, false); $('#ttplay', v).classList.remove('hidden'); return; }
        const f = frame(c, state, time);
        if (f.i !== lastScene) { lastScene = f.i; Platform.stopSpeaking(); Platform.speak(f.sc.narration || f.sc.caption, { rate: 1.08 }); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    function stop() { cancelAnimationFrame(raf); if (audio) audio.stop(); Platform.stopSpeaking(); }

    async function exportVideo() {
      if (!state) return ui.toast('Vänta tills videon är klar');
      if (!window.MediaRecorder || !canvas.captureStream) return ui.toast('Den här enheten kan inte spela in video 😕');
      stop();
      $('#ttplay', v).classList.add('hidden');
      if (!audio) audio = makeAudio();
      const stream = canvas.captureStream(30);
      if (audio && audio.stream) audio.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
      const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const type = types.find(x => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)) || '';
      let rec;
      try { rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4e6 } : undefined); }
      catch (e) { return ui.toast('Kunde inte starta inspelningen: ' + e.message); }
      const chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const finished = new Promise(res => { rec.onstop = res; });
      rec.start(500);
      if (audio) audio.start();
      const start = performance.now();
      await new Promise(res => {
        const loop = now => {
          if (!alive) return res();
          const time = (now - start) / 1000;
          if (time >= state.total) return res();
          frame(c, state, time);
          bar(time / state.total); status(`Spelar in video… ${Math.round(100 * time / state.total)} %`);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
      if (audio) audio.stop();
      rec.stop(); await finished;
      if (!alive) return;
      const mime = (rec.mimeType || type || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type: mime });
      const name = `Motey-${meeting.title.replace(/[^\wåäöÅÄÖ-]+/g, '_')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
      status('Video klar (' + (blob.size / 1e6).toFixed(1) + ' MB)');
      ui.toast(await Platform.saveFile(name, blob));
      $('#ttplay', v).classList.remove('hidden');
    }

    build();
  }

  function destroy() {
    alive = false; cancelAnimationFrame(raf);
    if (audio) { audio.close(); audio = null; }
    state = null;
  }

  window.TikTokMode = { render, destroy, frame, drawMotey };
})();
