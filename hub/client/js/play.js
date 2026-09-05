// Canvas game client: renders server state with smoothing, handles keyboard + touch joystick input.
window.Play = (function () {
  const el = {};
  let canvas, ctx, raf = 0, running = false;
  let world = null;          // join payload
  let players = new Map();   // id -> {x,y,tx,ty,score,it,dx,dy,name,avatar,perks,trail:[]}
  let gems = new Map();      // id -> {x,y,born}
  let phase = 'waiting', timeLeft = 0, lastStateAt = 0;
  let feed = [];
  let input = { dx: 0, dy: 0 }, keys = {}, lastSent = '0,0', joy = null;
  let floaters = [];
  let onLeave = null, onChat = null;
  let camera = { x: 0, y: 0, scale: 1 };

  function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    el.game = document.getElementById('hud-game');
    el.timer = document.getElementById('hud-timer');
    el.scores = document.getElementById('hud-scores');
    el.feed = document.getElementById('hud-feed');
    el.overlay = document.getElementById('overlay');
    el.joy = document.getElementById('joystick');
    el.chatPanel = document.getElementById('hud-chat-panel');
    el.chatLog = document.getElementById('room-chat-log');
    document.getElementById('hud-leave').onclick = () => onLeave && onLeave();
    document.getElementById('hud-chat').onclick = () => { el.chatPanel.hidden = !el.chatPanel.hidden; if (!el.chatPanel.hidden) el.chatPanel.querySelector('input').focus(); };
    document.getElementById('room-chat-form').onsubmit = (e) => {
      e.preventDefault();
      const inp = e.target.querySelector('input');
      if (inp.value.trim() && onChat) onChat(inp.value.trim());
      inp.value = ''; inp.blur();
    };
    window.addEventListener('keydown', (e) => {
      if (!running) return;
      if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'Enter') { el.chatPanel.hidden = false; el.chatPanel.querySelector('input').focus(); e.preventDefault(); return; }
      if (e.key === 'Escape') { onLeave && onLeave(); return; }
      keys[e.key.toLowerCase()] = true; keyInput(); e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { if (!running) return; keys[e.key.toLowerCase()] = false; keyInput(); });
    window.addEventListener('blur', () => { keys = {}; keyInput(); });
    // touch joystick
    canvas.addEventListener('touchstart', touchStart, { passive: false });
    canvas.addEventListener('touchmove', touchMove, { passive: false });
    canvas.addEventListener('touchend', touchEnd, { passive: false });
    canvas.addEventListener('touchcancel', touchEnd, { passive: false });
    // mouse: hold to move toward the pointer (handy on laptops without touch)
    canvas.addEventListener('mousedown', (e) => { if (e.button !== 0) return; joy = { mouse: true }; mouseDir(e); });
    window.addEventListener('mousemove', (e) => { if (joy && joy.mouse) mouseDir(e); });
    window.addEventListener('mouseup', () => { if (joy && joy.mouse) { joy = null; setInput(0, 0); } });
    window.addEventListener('resize', resize);
  }

  function keyInput() {
    const dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    setInput(dx, dy);
  }
  function setInput(dx, dy) {
    input = { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 };
    const k = input.dx + ',' + input.dy;
    if (k !== lastSent) { lastSent = k; Net.send('input', input); }
  }
  function mouseDir(e) {
    const me = players.get(world && world.you);
    if (!me) return;
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left) / camera.scale + camera.x, wy = (e.clientY - r.top) / camera.scale + camera.y;
    const dx = wx - me.x, dy = wy - me.y, d = Math.hypot(dx, dy);
    if (d < 12) setInput(0, 0); else setInput(dx / d, dy / d);
  }
  function touchStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (joy && !joy.mouse) return;
    joy = { id: t.identifier, x: t.clientX, y: t.clientY };
    el.joy.hidden = false;
    el.joy.style.left = (t.clientX - 65) + 'px'; el.joy.style.top = (t.clientY - 65) + 'px';
    el.joy.firstElementChild.style.transform = '';
  }
  function touchMove(e) {
    e.preventDefault();
    if (!joy || joy.mouse) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== joy.id) continue;
      let dx = t.clientX - joy.x, dy = t.clientY - joy.y;
      const d = Math.hypot(dx, dy), max = 45;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      el.joy.firstElementChild.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      if (d < 8) setInput(0, 0); else setInput(dx / max, dy / max);
    }
  }
  function touchEnd(e) {
    e.preventDefault();
    if (!joy || joy.mouse) return;
    for (const t of e.changedTouches) if (t.identifier === joy.id) { joy = null; el.joy.hidden = true; setInput(0, 0); }
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr); canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function start(payload, hooks) {
    if (!canvas) init();
    world = payload; onLeave = hooks.onLeave; onChat = hooks.onChat;
    players = new Map(); gems = new Map(); feed = []; floaters = []; keys = {}; joy = null; lastSent = '0,0';
    phase = payload.phase; timeLeft = payload.timeLeft;
    roster(payload.roster);
    el.game.innerHTML = '<b>' + esc(payload.game.name) + '</b><br><span class="muted">' + esc(modeName(payload.game.mode)) + ' · code ' + esc(payload.room.code) + '</span>';
    el.overlay.hidden = true; el.chatPanel.hidden = true; el.chatLog.innerHTML = ''; el.feed.innerHTML = ''; el.scores.innerHTML = ''; el.joy.hidden = true;
    document.getElementById('play-screen').hidden = false;
    running = true;
    resize();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    addFeed('Joined ' + payload.game.name + '. ' + (Platform.touch ? 'Drag anywhere to move.' : 'WASD or arrows to move, Enter to chat.'));
  }
  function stop() {
    running = false; cancelAnimationFrame(raf);
    document.getElementById('play-screen').hidden = true;
    world = null;
  }

  function roster(list) {
    const seen = new Set();
    for (const r of list) {
      seen.add(r.id);
      const p = players.get(r.id) || { x: 0, y: 0, tx: null, ty: null, score: 0, it: false, dx: 0, dy: 0, trail: [] };
      Object.assign(p, { name: r.name, avatar: r.avatar, perks: r.perks || [], isCreator: r.isCreator });
      players.set(r.id, p);
    }
    for (const id of [...players.keys()]) if (!seen.has(id)) players.delete(id);
    renderScores();
  }

  function state(st) {
    phase = st.ph; timeLeft = st.tl; lastStateAt = performance.now();
    const seenG = new Set();
    for (const [id, x, y] of st.g) { seenG.add(id); if (!gems.has(id)) gems.set(id, { x, y, born: performance.now() }); }
    for (const id of [...gems.keys()]) if (!seenG.has(id)) gems.delete(id);
    for (const [id, x, y, score, it, dx, dy] of st.p) {
      let p = players.get(id);
      if (!p) { p = { name: '…', avatar: {}, perks: [], trail: [], x, y, score: 0 }; players.set(id, p); }
      if (p.tx == null) { p.x = x; p.y = y; }
      if (p.score !== score && p.score !== undefined && score > p.score && id === world.you) floaters.push({ x, y, text: '+' + (score - p.score), born: performance.now() });
      p.tx = x; p.ty = y; p.score = score; p.it = !!it; p.dx = dx; p.dy = dy;
    }
    if (st.ev) for (const ev of st.ev) event(ev);
    if (phase === 'playing' && !el.overlay.hidden && el.overlay.dataset.kind === 'results') el.overlay.hidden = true;
    renderScores();
  }

  function event(ev) {
    if (ev.k === 'join') addFeed(ev.name + ' joined');
    else if (ev.k === 'leave') addFeed(ev.name + ' left');
    else if (ev.k === 'tag') addFeed(ev.name + ' is IT!');
    else if (ev.k === 'round') { addFeed('New round! ' + ev.seconds + ' seconds.'); }
  }
  function addFeed(text) {
    const d = document.createElement('div'); d.textContent = text;
    el.feed.appendChild(d);
    while (el.feed.children.length > 5) el.feed.removeChild(el.feed.firstChild);
    setTimeout(() => d.remove(), 4000);
  }
  function chat(m) {
    const d = document.createElement('div'); d.className = 'chat-line';
    d.innerHTML = '<b>' + esc(m.name) + '</b> ' + esc(m.text);
    el.chatLog.appendChild(d); el.chatLog.scrollTop = el.chatLog.scrollHeight;
    if (el.chatPanel.hidden) addFeed(m.name + ': ' + m.text);
  }
  function roundEnd(m) {
    const me = world.you;
    let rows = m.results.map((r, i) => '<tr><td>' + (i + 1) + '</td><td' + (r.id === me ? ' style="color:var(--accent)"' : '') + '>' + esc(r.name) + '</td><td class="num">' + r.score + '</td><td class="num reward">' + (m.rewards[r.id] ? '+' + m.rewards[r.id] + ' ◆' : '') + '</td></tr>').join('');
    const winner = m.results[0];
    el.overlay.dataset.kind = 'results';
    el.overlay.innerHTML = '<div class="results"><h2>' + (winner && winner.id === me && m.results.length > 1 ? '🏆 You won!' : winner ? esc(winner.name) + ' wins' : 'Round over') + '</h2>' +
      '<p class="muted">Next round in ' + m.next + 's</p><table><tr><th>#</th><th>Player</th><th class="num">Score</th><th class="num">Reward</th></tr>' + rows + '</table>' +
      '<button class="btn" onclick="document.getElementById(\'overlay\').hidden=true">Close</button></div>';
    el.overlay.hidden = false;
  }

  function renderScores() {
    const arr = [...players.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 8);
    el.scores.innerHTML = arr.map(([id, p]) => '<div class="' + (id === world.you ? 'me' : '') + '"><span>' + (p.it ? '<span class="it">●</span> ' : '') + esc(p.name) + '</span><b>' + p.score + '</b></div>').join('');
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const g = world.game, T = world.tile, R = world.radius;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    // smoothing toward server positions
    for (const p of players.values()) {
      if (p.tx == null) continue;
      p.x += (p.tx - p.x) * 0.35; p.y += (p.ty - p.y) * 0.35;
      const tr = p.avatar && p.avatar.trail;
      if (tr && tr !== 'none' && (Math.abs(p.dx) + Math.abs(p.dy)) > 0) {
        p.trail.push({ x: p.x + (Math.random() - .5) * 8, y: p.y + (Math.random() - .5) * 8, born: now });
        if (p.trail.length > 24) p.trail.shift();
      }
    }
    const me = players.get(world.you);
    const worldW = g.cols * T, worldH = g.rows * T;
    const scale = Math.max(0.55, Math.min(1.3, Math.min(W / (18 * T), H / (11 * T))));
    camera.scale = scale;
    const vw = W / scale, vh = H / scale;
    let cx = me ? me.x : worldW / 2, cy = me ? me.y : worldH / 2;
    camera.x = vw >= worldW ? (worldW - vw) / 2 : Math.max(0, Math.min(worldW - vw, cx - vw / 2));
    camera.y = vh >= worldH ? (worldH - vh) / 2 : Math.max(0, Math.min(worldH - vh, cy - vh / 2));
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.scale(scale, scale); ctx.translate(-camera.x, -camera.y);
    // floor
    ctx.fillStyle = g.theme.bg; ctx.fillRect(0, 0, worldW, worldH);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= g.cols; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, worldH); }
    for (let y = 0; y <= g.rows; y++) { ctx.moveTo(0, y * T); ctx.lineTo(worldW, y * T); }
    ctx.stroke();
    // zone
    if (world.zone) {
      const z = world.zone, pulse = 0.85 + 0.15 * Math.sin(now / 300);
      ctx.fillStyle = hexA(g.theme.accent, 0.18 * pulse); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(g.theme.accent, 0.7); ctx.lineWidth = 3; ctx.stroke();
    }
    // walls
    ctx.fillStyle = g.theme.wall;
    for (const i of g.walls) { const x = (i % g.cols) * T, y = Math.floor(i / g.cols) * T; roundRect(x + 1, y + 1, T - 2, T - 2, 6); }
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (const i of g.walls) { const x = (i % g.cols) * T, y = Math.floor(i / g.cols) * T; ctx.fillRect(x + 4, y + 4, T - 8, 5); }
    // gems
    for (const gm of gems.values()) {
      const s = 9 + Math.sin((now - gm.born) / 200) * 1.5;
      ctx.save(); ctx.translate(gm.x, gm.y); ctx.rotate(Math.PI / 4);
      ctx.shadowColor = g.theme.accent; ctx.shadowBlur = 12; ctx.fillStyle = g.theme.accent;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-s / 2, -s / 2, s / 2, s / 2);
      ctx.restore();
    }
    // trails
    for (const p of players.values()) {
      const tr = p.avatar && p.avatar.trail; if (!tr || tr === 'none') continue;
      p.trail = p.trail.filter(t => now - t.born < 600);
      p.trail.forEach((t, i) => {
        const a = 1 - (now - t.born) / 600;
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = Avatar.trailColor(tr, i);
        ctx.beginPath(); ctx.arc(t.x, t.y, 3 + a * 4, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    // players
    const sorted = [...players.entries()].sort((a, b) => a[1].y - b[1].y);
    for (const [id, p] of sorted) {
      if (p.tx == null) continue;
      const vip = p.perks.includes('vip');
      Avatar.draw(ctx, p.x, p.y, R, { color: p.avatar.color, hat: p.avatar.hat, it: p.it, vip, dx: p.dx, dy: p.dy });
      ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      const label = (p.it ? 'IT · ' : '') + p.name;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; roundRect(p.x - w / 2, p.y - R - 30, w, 18, 6);
      ctx.fillStyle = p.it ? '#ff6b6b' : vip ? '#ffd166' : id === world.you ? '#fff' : '#d7dcf0';
      ctx.fillText(label, p.x, p.y - R - 17);
    }
    // floaters
    floaters = floaters.filter(f => now - f.born < 900);
    for (const f of floaters) {
      const t = (now - f.born) / 900;
      ctx.globalAlpha = 1 - t; ctx.fillStyle = '#ffd166'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y - 30 - t * 40);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // HUD
    const tl = phase === 'playing' ? Math.max(0, timeLeft - Math.floor((performance.now() - lastStateAt) / 1000)) : timeLeft;
    el.timer.textContent = phase === 'playing' ? fmtTime(tl) : phase === 'results' ? 'Next in ' + tl + 's' : 'Waiting…';
    if (phase === 'waiting' && el.overlay.hidden) { el.overlay.dataset.kind = 'wait'; el.overlay.innerHTML = '<div class="results"><h2>Waiting for players</h2><p class="muted">The round starts as soon as someone is here.</p></div>'; el.overlay.hidden = false; }
    else if (phase !== 'waiting' && el.overlay.dataset.kind === 'wait') el.overlay.hidden = true;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function fmtTime(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function modeName(m) { return { gemrush: 'Gem Rush', tag: 'Tag', koth: 'King of the Hill' }[m] || m; }

  /** Draw a static preview of a map onto a canvas (used for game cards). */
  function preview(cv, game, opts = {}) {
    const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const cols = game.cols || 24, rows = game.rows || 13;
    const t = Math.min(W / cols, H / rows);
    const ox = (W - cols * t) / 2, oy = (H - rows * t) / 2;
    c.fillStyle = game.theme.bg; c.fillRect(0, 0, W, H);
    c.fillStyle = game.theme.wall;
    const walls = game.walls || [];
    if (walls.length) for (const i of walls) c.fillRect(ox + (i % cols) * t, oy + Math.floor(i / cols) * t, t, t);
    else { c.fillRect(ox, oy, cols * t, t); c.fillRect(ox, oy + (rows - 1) * t, cols * t, t); c.fillRect(ox, oy, t, rows * t); c.fillRect(ox + (cols - 1) * t, oy, t, rows * t); }
    c.fillStyle = game.theme.accent;
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 12; i++) { const x = ox + (1 + rnd() * (cols - 2)) * t, y = oy + (1 + rnd() * (rows - 2)) * t; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-t * 0.2, -t * 0.2, t * 0.4, t * 0.4); c.restore(); }
    if (!opts.noGrad) { const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
  }

  return { start, stop, roster, state, roundEnd, chat, preview, get running() { return running; } };
})();
