// gmfy Hub client: views, state, and wiring to the server.
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { user: null, catalog: null, games: [], online: 0, leaderboard: [], view: 'home', stack: [], sandbox: false, editing: null, chat: [] };
  const TITLES = { home: 'Home', discover: 'Discover', game: 'Game', create: 'Create', editor: 'Editor', shop: 'Shop', friends: 'Friends', profile: 'Profile', settings: 'Settings' };
  const PERK_NAMES = { speed: 'Speed', magnet: 'Magnet', double: '2× score', vip: 'VIP' };
  window.HubState = S;

  // ---------- helpers ----------
  function toast(msg, kind) {
    const d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = msg;
    $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3500);
  }
  function modal(html, binds) {
    const m = $('#modal'); $('#modal-card').innerHTML = html; m.hidden = false;
    m.onclick = (e) => { if (e.target === m) closeModal(); };
    if (binds) binds($('#modal-card'));
  }
  function closeModal() { $('#modal').hidden = true; }
  function confirm(title, text, ok) {
    return new Promise((res) => modal('<h3>' + esc(title) + '</h3><p class="muted">' + esc(text) + '</p><div class="actions"><button class="btn" id="m-no">Cancel</button><button class="btn primary" id="m-ok">' + esc(ok || 'OK') + '</button></div>',
      (c) => { $('#m-no', c).onclick = () => { closeModal(); res(false); }; $('#m-ok', c).onclick = () => { closeModal(); res(true); }; }));
  }
  async function call(t, data, opts = {}) {
    try { return await Net.req(t, data); }
    catch (e) { if (!opts.silent) toast(e.message, 'err'); throw e; }
  }
  function gemsFmt(n) { return '◆ ' + Number(n).toLocaleString(); }
  function timeAgo(ts) { const d = (Date.now() - ts) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; return Math.floor(d / 86400) + 'd ago'; }
  function drawAvatar(cv, avatar, size) {
    cv.width = size; cv.height = size; const c = cv.getContext('2d');
    c.clearRect(0, 0, size, size);
    Avatar.draw(c, size / 2, size / 2 + size * 0.06, size * 0.3, { color: avatar.color, hat: avatar.hat });
  }
  function setUser(u) {
    S.user = u;
    $('#gems-count').textContent = Number(u.gems).toLocaleString();
    $('#me-name').textContent = u.displayName;
    drawAvatar($('#me-avatar'), u.avatar, 36);
  }

  // ---------- navigation ----------
  function show(view, params, push = true) {
    if (push && S.view !== view) S.stack.push({ view: S.view, params: S.params });
    if (S.stack.length > 20) S.stack.shift();
    S.view = view; S.params = params || {};
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    $$('#nav button, #tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === view || (view === 'game' && b.dataset.view === 'discover') || (view === 'editor' && b.dataset.view === 'create')));
    $('#view-title').textContent = TITLES[view] || view;
    $('#back-btn').hidden = !(view === 'game' || view === 'editor');
    $('#views').scrollTop = 0;
    const r = views[view]; if (r) Promise.resolve().then(() => r(S.params)).catch((e) => { console.error(e); toast('Something went wrong: ' + e.message, 'err'); });
  }
  function back() { const prev = S.stack.pop(); show(prev ? prev.view : 'home', prev ? prev.params : {}, false); }
  $$('#nav button, #tabbar button').forEach(b => b.onclick = () => show(b.dataset.view));
  $('#back-btn').onclick = back;
  $('#gems-pill').onclick = () => show('shop', { tab: 'gems' });
  $('#me-pill').onclick = () => show('profile');

  // ---------- game cards ----------
  function gameCard(g) {
    const live = g.playing ? '<span class="badge live live">● ' + g.playing + ' playing</span>' : '';
    return '<div class="game-card" data-id="' + esc(g.id) + '"><div class="thumb"><canvas width="230" height="120" data-thumb="' + esc(g.id) + '"></canvas><span class="badge mode ' + (g.official ? 'official' : '') + '">' + esc(g.modeName || g.mode) + '</span>' + live + '</div>' +
      '<div class="body"><b>' + esc(g.name) + '</b><div class="muted"><span>by ' + esc(g.creatorName) + '</span><span>▶ ' + g.stats.plays + ' · ♥ ' + g.stats.likes + '</span></div></div></div>';
  }
  function bindCards(root) {
    $$('canvas[data-thumb]', root).forEach(cv => { const g = S.gameCache[cv.dataset.thumb] || S.games.find(x => x.id === cv.dataset.thumb); if (g) Play.preview(cv, g); });
    $$('.game-card', root).forEach(c => c.onclick = () => show('game', { id: c.dataset.id }));
  }
  S.gameCache = {};

  // ---------- views ----------
  const views = {};
  views.home = async function () {
    const v = $('.view[data-view=home]');
    const top = S.games.slice(0, 8);
    const featured = top[0];
    const mine = S.games.filter(g => g.creator === S.user.id);
    const dailyReady = Date.now() - (S.user.lastDaily || 0) > 86400000;
    v.innerHTML =
      (featured ? '<div class="hero"><canvas width="900" height="260" data-thumb="' + esc(featured.id) + '"></canvas><span class="badge official">Featured</span><h2>' + esc(featured.name) + '</h2><p>' + esc(featured.desc) + '</p><div class="row"><button class="btn primary" id="hero-play">▶ Play now</button><button class="btn" id="hero-open">Details</button><span class="muted">' + (featured.playing || 0) + ' playing</span></div></div>' : '') +
      '<div class="grid g3" style="margin-top:18px"><div class="card stat"><div class="num">' + gemsFmt(S.user.gems) + '</div><div class="lbl">Your Gems</div></div>' +
      '<div class="card stat"><div class="num">' + S.online + '</div><div class="lbl">Players online</div></div>' +
      '<div class="card" style="display:flex;align-items:center;gap:12px"><div><b>Daily bonus</b><div class="muted">' + (dailyReady ? 'Claim 50 Gems' : 'Come back tomorrow') + '</div></div><button class="btn accent small" id="daily" style="margin-left:auto"' + (dailyReady ? '' : ' disabled') + '>Claim</button></div></div>' +
      '<div class="section-head"><h3>Popular now</h3><button class="btn ghost small" data-go="discover">See all →</button></div><div class="hscroll">' + top.map(gameCard).join('') + '</div>' +
      (mine.length ? '<div class="section-head"><h3>Your games</h3><button class="btn ghost small" data-go="create">Manage →</button></div><div class="hscroll">' + mine.map(gameCard).join('') + '</div>' : '<div class="card" style="margin-top:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div><b>Build your own game</b><div class="muted">Design a map, pick a mode, sell game passes and earn Gems when people play.</div></div><button class="btn primary" data-go="create" style="margin-left:auto">Open Create</button></div>') +
      '<div class="section-head"><h3>Top earners</h3></div><div class="card table-wrap"><table><tr><th>#</th><th>Player</th><th class="num">Earned</th><th class="num">Wins</th></tr>' + S.leaderboard.slice(0, 5).map((p, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name) + '</td><td class="num">' + gemsFmt(p.earned) + '</td><td class="num">' + p.wins + '</td></tr>').join('') + '</table></div>';
    bindCards(v);
    $$('[data-go]', v).forEach(b => b.onclick = () => show(b.dataset.go));
    if (featured) { $('#hero-play').onclick = () => joinGame({ gameId: featured.id }); $('#hero-open').onclick = () => show('game', { id: featured.id }); }
    $('#daily').onclick = async () => { const r = await call('econ.daily'); setUser(r.user); toast('+' + r.gems + ' Gems claimed!', 'ok'); views.home(); };
  };

  views.discover = function (p) {
    const v = $('.view[data-view=discover]');
    const st = S.discover = S.discover || { q: '', sort: 'popular', filter: 'all' };
    v.innerHTML = '<div class="row"><label style="flex:2;margin:0"><input id="q" placeholder="Search games or creators" value="' + esc(st.q) + '"></label><div class="chips" id="filters">' +
      ['all', 'official', 'community'].map(f => '<span class="chip ' + (st.filter === f ? 'active' : '') + '" data-f="' + f + '">' + f[0].toUpperCase() + f.slice(1) + '</span>').join('') + '</div><label style="margin:0;flex:0 0 140px"><select id="sort"><option value="popular">Popular</option><option value="new">Newest</option><option value="name">A–Z</option></select></label></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn small" id="join-code">Join with code</button></div><div class="grid g3" id="games" style="margin-top:16px"></div>';
    $('#sort').value = st.sort;
    const load = async () => {
      S.games = await call('games.list', { q: st.q, sort: st.sort, filter: st.filter });
      $('#games').innerHTML = S.games.length ? S.games.map(gameCard).join('') : '<p class="muted">Nothing here yet.</p>';
      bindCards(v);
    };
    let deb; $('#q').oninput = (e) => { st.q = e.target.value; clearTimeout(deb); deb = setTimeout(load, 250); };
    $('#sort').onchange = (e) => { st.sort = e.target.value; load(); };
    $$('#filters .chip').forEach(c => c.onclick = () => { st.filter = c.dataset.f; $$('#filters .chip').forEach(x => x.classList.toggle('active', x === c)); load(); });
    $('#join-code').onclick = joinByCode;
    load();
  };

  function joinByCode() {
    modal('<h3>Join a server</h3><label>Invite code<input id="m-code" maxlength="6" style="text-transform:uppercase" autocapitalize="characters"></label><div class="actions"><button class="btn" id="m-no">Cancel</button><button class="btn primary" id="m-ok">Join</button></div>',
      (c) => { $('#m-no', c).onclick = closeModal; $('#m-ok', c).onclick = () => { const code = $('#m-code', c).value.trim(); closeModal(); if (code) joinGame({ code }); }; $('#m-code', c).focus(); });
  }

  views.game = async function (p) {
    const v = $('.view[data-view=game]');
    v.innerHTML = '<p class="muted">Loading…</p>';
    let d; try { d = await call('games.get', { id: p.id }); } catch (e) { back(); return; }
    const g = d.game; S.gameCache[g.id] = g;
    const mine = g.creator === S.user.id;
    const owned = new Set(S.user.owned.passes);
    v.innerHTML = '<div class="detail-head"><div class="thumb"><canvas width="440" height="260" data-thumb="' + esc(g.id) + '"></canvas></div><div style="flex:1;min-width:240px">' +
      '<div class="row"><span class="badge ' + (g.official ? 'official' : '') + '">' + esc(S.catalog.modes[g.mode].name) + '</span>' + (d.summary.playing ? '<span class="badge live">● ' + d.summary.playing + ' playing</span>' : '') + (!g.published ? '<span class="badge">Unpublished</span>' : '') + '</div>' +
      '<h2 style="margin-top:8px">' + esc(g.name) + '</h2><p class="muted">by <a href="#" id="creator-link">' + esc(g.creatorName) + '</a> · ' + g.stats.plays + ' plays · ' + g.stats.likes + ' likes · up to ' + g.maxPlayers + ' players · ' + g.roundSeconds + 's rounds</p>' +
      '<div class="row" style="margin-top:14px"><button class="btn primary" id="play">▶ Play</button><button class="btn" id="private">Private server</button><button class="btn" id="like">' + (d.liked ? '♥ Liked' : '♡ Like') + '</button>' + (mine ? '<button class="btn" id="edit">✎ Edit</button>' : '') + '</div></div></div>' +
      '<div class="section-head"><h3>About</h3></div><div class="card">' + (esc(g.desc) || '<span class="muted">No description.</span>') + '<p class="muted" style="margin-top:8px">' + esc(S.catalog.modes[g.mode].desc) + '</p>' + (d.perks.length ? '<p style="margin-top:8px">Your perks here: ' + d.perks.map(x => '<span class="badge perk">' + esc(PERK_NAMES[x] || x) + '</span>').join(' ') + '</p>' : '') + '</div>' +
      '<div class="section-head"><h3>Game passes</h3><span class="muted">Perks that persist forever in this game</span></div>' +
      (g.passes.length ? '<div class="grid g3">' + g.passes.map(ps => '<div class="pass-card"><span class="badge perk">' + esc(S.catalog.perks[ps.perk].name) + '</span><b>' + esc(ps.name) + '</b><span class="muted">' + esc(ps.desc) + '</span><span class="price">' + gemsFmt(ps.price) + '</span>' +
        (mine ? '<button class="btn" disabled>Yours · ' + (ps.sold || 0) + ' sold</button>' : owned.has(ps.id) ? '<button class="btn" disabled>✓ Owned</button>' : '<button class="btn primary" data-pass="' + esc(ps.id) + '">Buy for ' + gemsFmt(ps.price) + '</button>') + '</div>').join('') + '</div>' : '<p class="muted">This game has no passes.</p>') +
      '<div class="section-head"><h3>Servers</h3><span class="muted">Public servers running now</span></div><div id="servers">' + serverRows(d.rooms) + '</div>';
    bindCards(v);
    $('#play').onclick = () => joinGame({ gameId: g.id });
    $('#private').onclick = () => joinGame({ gameId: g.id, private: true });
    $('#like').onclick = async () => { const r = await call('games.like', { id: g.id }); $('#like').textContent = r.liked ? '♥ Liked' : '♡ Like'; S.user.likes = r.liked ? S.user.likes.concat(g.id) : S.user.likes.filter(x => x !== g.id); };
    $('#creator-link').onclick = (e) => { e.preventDefault(); if (g.creator !== 'official') show('profile', { id: g.creator }); };
    if (mine) $('#edit').onclick = () => show('editor', { id: g.id });
    $$('[data-pass]', v).forEach(b => b.onclick = () => buyPass(g, b.dataset.pass));
    $$('[data-room]', v).forEach(b => b.onclick = () => joinGame({ roomId: b.dataset.room }));
  };
  function serverRows(rooms) {
    if (!rooms.length) return '<p class="muted">No public servers yet. Press Play to start one.</p>';
    return rooms.map(r => '<div class="server-row"><span>' + r.size + '/' + r.max + '</span><div class="bar"><i style="width:' + Math.round(r.size / r.max * 100) + '%"></i></div><span class="muted">' + (r.phase === 'playing' ? r.timeLeft + 's left' : r.phase) + '</span><span class="muted">' + esc(r.code || '') + '</span><button class="btn small" data-room="' + esc(r.id) + '"' + (r.size >= r.max ? ' disabled' : '') + '>Join</button></div>').join('');
  }
  async function buyPass(g, passId) {
    const ps = g.passes.find(x => x.id === passId);
    if (S.user.gems < ps.price) { toast('Not enough Gems. Visit the shop to top up.', 'err'); show('shop', { tab: 'gems' }); return; }
    if (!await confirm('Buy ' + ps.name + '?', 'This costs ' + ps.price + ' Gems and unlocks "' + S.catalog.perks[ps.perk].name + '" in ' + g.name + ' forever.', 'Buy')) return;
    const r = await call('econ.buyPass', { gameId: g.id, passId });
    setUser(r.user); toast('You now own ' + ps.name + '!', 'ok');
    if (S.view === 'game') views.game({ id: g.id });
  }

  // ---------- play ----------
  async function joinGame(opts) {
    let payload; try { payload = await call('room.join', opts); } catch (e) { return; }
    $('#shell').hidden = true; $('#chat').hidden = true;
    Play.start(payload, { onLeave: leaveGame, onChat: (text) => Net.send('chat', { scope: 'room', text }) });
    if (opts.private) toast('Private server created. Invite code: ' + payload.room.code, 'ok');
  }
  async function leaveGame() {
    Play.stop(); $('#shell').hidden = false;
    try { await Net.req('room.leave'); } catch (e) {}
    refreshGames();
    if (S.view === 'game') views.game(S.params);
  }
  Net.on('room.roster', (m) => Play.running && Play.roster(m.roster));
  Net.on('state', (m) => Play.running && Play.state(m));
  Net.on('round.end', (m) => Play.running && Play.roundEnd(m));

  // ---------- create / editor ----------
  views.create = async function () {
    const v = $('.view[data-view=create]');
    const mine = await call('games.mine');
    v.innerHTML = '<div class="card" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div><b>Your studio</b><div class="muted">Design maps, choose a mode, set up game passes. You earn 70% of every pass sold plus 1 Gem per player per round.</div></div><button class="btn primary" id="new" style="margin-left:auto">+ New game</button></div>' +
      '<div class="section-head"><h3>Your games</h3><span class="muted">' + mine.length + ' / 20</span></div>' +
      (mine.length ? '<div class="grid g2">' + mine.map(g => '<div class="card"><div class="row"><b style="font-size:16px">' + esc(g.name) + '</b><span class="badge">' + esc(g.modeName) + '</span>' + (g.published ? '<span class="badge live">Published</span>' : '<span class="badge">Draft</span>') + '</div>' +
        '<p class="muted" style="margin:8px 0">' + g.stats.plays + ' plays · ' + g.stats.likes + ' likes · ' + (g.stats.passSales || 0) + ' passes sold · earned ' + gemsFmt(g.stats.revenue || 0) + '</p>' +
        '<div class="row"><button class="btn small primary" data-edit="' + esc(g.id) + '">✎ Edit</button><button class="btn small" data-open="' + esc(g.id) + '">View</button><button class="btn small" data-play="' + esc(g.id) + '">▶ Test play</button><button class="btn small danger" data-del="' + esc(g.id) + '">Delete</button></div></div>').join('') + '</div>' : '<p class="muted">You have not made a game yet. Press "New game" to start.</p>');
    $('#new').onclick = () => show('editor', {});
    $$('[data-edit]', v).forEach(b => b.onclick = () => show('editor', { id: b.dataset.edit }));
    $$('[data-open]', v).forEach(b => b.onclick = () => show('game', { id: b.dataset.open }));
    $$('[data-play]', v).forEach(b => b.onclick = () => joinGame({ gameId: b.dataset.play, private: true }));
    $$('[data-del]', v).forEach(b => b.onclick = async () => { if (await confirm('Delete game?', 'This cannot be undone. Players who bought passes will lose them.', 'Delete')) { await call('games.delete', { id: b.dataset.del }); refreshGames(); views.create(); } });
  };

  views.editor = async function (p) {
    const v = $('.view[data-view=editor]');
    let g;
    if (p.id) { const d = await call('games.get', { id: p.id }); g = JSON.parse(JSON.stringify(d.game)); }
    else { g = { name: '', desc: '', mode: 'gemrush', cols: 24, rows: 13, walls: [], roundSeconds: 120, maxPlayers: 8, speed: 1, gemRate: 1, theme: { bg: '#0d1425', wall: '#2b3a67', accent: '#4cc2ff' }, passes: [], published: false }; }
    S.editing = g;
    const perkOpts = Object.entries(S.catalog.perks).map(([k, x]) => '<option value="' + k + '">' + esc(x.name) + '</option>').join('');
    v.innerHTML = '<div class="editor"><div class="panel">' +
      '<div class="card"><label>Name<input id="e-name" maxlength="40" value="' + esc(g.name) + '"></label><label>Description<textarea id="e-desc" maxlength="300">' + esc(g.desc) + '</textarea></label>' +
      '<label>Mode<select id="e-mode">' + Object.entries(S.catalog.modes).map(([k, m]) => '<option value="' + k + '"' + (g.mode === k ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('') + '</select></label><p class="muted" id="e-modedesc"></p>' +
      '<div class="row"><label>Width<input id="e-cols" type="number" min="12" max="48" value="' + g.cols + '"></label><label>Height<input id="e-rows" type="number" min="8" max="32" value="' + g.rows + '"></label></div>' +
      '<div class="row"><label>Round (s)<input id="e-round" type="number" min="30" max="600" value="' + g.roundSeconds + '"></label><label>Max players<input id="e-max" type="number" min="2" max="20" value="' + g.maxPlayers + '"></label></div>' +
      '<label>Speed <span id="e-speed-v">' + g.speed + '×</span><input id="e-speed" type="range" min="0.6" max="1.6" step="0.05" value="' + g.speed + '"></label>' +
      '<label>Gem rate <span id="e-gem-v">' + g.gemRate + '×</span><input id="e-gem" type="range" min="0" max="3" step="0.1" value="' + g.gemRate + '"></label>' +
      '<div class="row"><label>Floor<input id="e-bg" type="color" value="' + g.theme.bg + '"></label><label>Walls<input id="e-wall" type="color" value="' + g.theme.wall + '"></label><label>Accent<input id="e-accent" type="color" value="' + g.theme.accent + '"></label></div></div>' +
      '<div class="card" style="margin-top:14px"><div class="row"><b>Game passes</b><button class="btn small" id="e-addpass" style="margin-left:auto">+ Add</button></div><p class="muted">Players pay Gems once for a permanent perk. You receive 70% of each sale.</p><div id="e-passes"></div></div>' +
      '<div class="card" style="margin-top:14px"><label style="display:flex;align-items:center;gap:10px;margin:0"><input type="checkbox" id="e-pub" style="width:auto;margin:0"' + (g.published ? ' checked' : '') + '> Published (visible to everyone)</label>' +
      '<div class="row" style="margin-top:14px"><button class="btn primary" id="e-save">Save</button><button class="btn" id="e-test"' + (g.id ? '' : ' disabled') + '>▶ Test play</button></div><p class="msg" id="e-msg"></p></div></div>' +
      '<div class="editor-canvas-wrap"><div class="tools"><button class="btn small active" data-tool="wall">🧱 Wall</button><button class="btn small" data-tool="erase">🧽 Erase</button><button class="btn small" id="e-random">🎲 Random</button><button class="btn small" id="e-clear">Clear</button><span class="muted" style="align-self:center">Draw walls by dragging. The border is always solid.</span></div><canvas id="editor-canvas"></canvas></div></div>';
    const modeDesc = () => { $('#e-modedesc').textContent = S.catalog.modes[$('#e-mode').value].desc; };
    modeDesc();
    Editor.mount($('#editor-canvas'), g);
    const sync = () => {
      g.name = $('#e-name').value; g.desc = $('#e-desc').value; g.mode = $('#e-mode').value;
      g.roundSeconds = +$('#e-round').value; g.maxPlayers = +$('#e-max').value; g.speed = +$('#e-speed').value; g.gemRate = +$('#e-gem').value;
      g.theme = { bg: $('#e-bg').value, wall: $('#e-wall').value, accent: $('#e-accent').value }; g.published = $('#e-pub').checked;
      $('#e-speed-v').textContent = g.speed + '×'; $('#e-gem-v').textContent = g.gemRate + '×';
      g.passes = $$('.pass-edit', v).map(pe => ({ id: pe.dataset.id || undefined, name: $('.p-name', pe).value, perk: $('.p-perk', pe).value, price: +$('.p-price', pe).value, desc: $('.p-desc', pe).value }));
      Editor.draw();
    };
    $$('#e-name,#e-desc,#e-mode,#e-round,#e-max,#e-speed,#e-gem,#e-bg,#e-wall,#e-accent,#e-pub', v).forEach(i => i.oninput = () => { sync(); modeDesc(); });
    const resize = () => { const c = Math.max(12, Math.min(48, +$('#e-cols').value || 24)), r = Math.max(8, Math.min(32, +$('#e-rows').value || 13)); Editor.resize(c, r); };
    $('#e-cols').onchange = $('#e-rows').onchange = resize;
    $$('[data-tool]', v).forEach(b => b.onclick = () => { Editor.setTool(b.dataset.tool); $$('[data-tool]', v).forEach(x => x.classList.toggle('active', x === b)); });
    $('#e-random').onclick = Editor.random; $('#e-clear').onclick = Editor.clear;
    const renderPasses = () => {
      $('#e-passes').innerHTML = g.passes.map((ps, i) => '<div class="pass-edit" data-id="' + esc(ps.id || '') + '"><div class="row"><label>Name<input class="p-name" maxlength="24" value="' + esc(ps.name) + '"></label><label>Perk<select class="p-perk">' + perkOpts + '</select></label></div><div class="row"><label>Price (Gems)<input class="p-price" type="number" min="10" max="10000" value="' + (ps.price || 100) + '"></label><label>Description<input class="p-desc" maxlength="120" value="' + esc(ps.desc || '') + '"></label></div><div class="row" style="margin-top:8px"><span class="muted">' + (ps.sold ? ps.sold + ' sold · cannot be removed' : '') + '</span>' + (ps.sold ? '' : '<button class="btn small danger" data-rm="' + i + '" style="margin-left:auto">Remove</button>') + '</div></div>').join('');
      $$('.pass-edit', v).forEach((pe, i) => { $('.p-perk', pe).value = g.passes[i].perk || 'speed'; $$('input,select', pe).forEach(x => x.oninput = sync); });
      $$('[data-rm]', v).forEach(b => b.onclick = () => { g.passes.splice(+b.dataset.rm, 1); renderPasses(); });
    };
    renderPasses();
    $('#e-addpass').onclick = () => { sync(); if (g.passes.length >= 6) return toast('Max 6 passes', 'err'); g.passes.push({ name: 'Pass ' + (g.passes.length + 1), perk: 'speed', price: 100, desc: '' }); renderPasses(); };
    $('#e-save').onclick = async () => {
      sync();
      try { const saved = await call('games.save', { game: g }); g.id = saved.id; Object.assign(g, { passes: saved.passes }); renderPasses(); $('#e-test').disabled = false; $('#e-msg').className = 'msg ok'; $('#e-msg').textContent = 'Saved' + (g.published ? ' and published.' : ' as draft.'); refreshGames(); }
      catch (e) { $('#e-msg').className = 'msg'; $('#e-msg').textContent = e.message; }
    };
    $('#e-test').onclick = async () => { sync(); try { await call('games.save', { game: g }); } catch (e) { return; } joinGame({ gameId: g.id, private: true }); };
  };

  // ---------- shop ----------
  views.shop = function (p) {
    const v = $('.view[data-view=shop]');
    const st = S.shop = S.shop || { tab: 'gems' };
    if (p && p.tab) st.tab = p.tab;
    const tabs = [['gems', '◆ Gems'], ['color', 'Colors'], ['hat', 'Hats'], ['trail', 'Trails']];
    v.innerHTML = '<div class="card avatar-preview"><canvas id="shop-avatar"></canvas><div><b style="font-size:18px">' + esc(S.user.displayName) + '</b><div class="muted">Your avatar is what everyone sees in every game.</div><div style="margin-top:8px" class="gems">' + gemsFmt(S.user.gems) + '</div></div></div>' +
      '<div class="chips" style="margin:18px 0 14px" id="shop-tabs">' + tabs.map(([k, l]) => '<span class="chip ' + (st.tab === k ? 'active' : '') + '" data-t="' + k + '">' + l + '</span>').join('') + '</div><div id="shop-body"></div>';
    const preview = () => { const cv = $('#shop-avatar'); drawAvatar(cv, S.user.avatar, 240); };
    preview();
    const body = () => {
      const b = $('#shop-body');
      if (st.tab === 'gems') {
        b.innerHTML = '<div class="grid g3">' + S.catalog.packs.map(pk => '<div class="pack-card"><div class="gems-big">◆ ' + pk.gems.toLocaleString() + '</div><div>' + esc(pk.label) + '</div>' + (pk.bonus ? '<div class="bonus">' + esc(pk.bonus) + ' bonus</div>' : '<div class="bonus">&nbsp;</div>') + '<button class="btn primary" style="margin-top:12px" data-pack="' + pk.id + '">$' + pk.priceUsd.toFixed(2) + '</button></div>').join('') + '</div>' +
          '<p class="muted" style="margin-top:14px">' + (S.sandbox ? 'This server runs sandbox payments: packs are granted instantly and nothing is charged. A production hub connects a real payment provider.' : 'Purchases are processed by the payment provider configured on this hub.') + '</p>';
        $$('[data-pack]', b).forEach(x => x.onclick = async () => {
          const pk = S.catalog.packs.find(q => q.id === x.dataset.pack);
          if (!await confirm('Buy ' + pk.gems + ' Gems?', '$' + pk.priceUsd.toFixed(2) + (S.sandbox ? ' — sandbox mode, no real charge.' : ''), 'Buy')) return;
          const r = await call('econ.buyGems', { packId: pk.id, receipt: { sandbox: true } }); setUser(r.user); toast('+' + pk.gems + ' Gems added!', 'ok'); views.shop();
        });
        return;
      }
      const items = S.catalog.items.filter(i => i.kind === st.tab);
      b.innerHTML = '<div class="grid g3">' + items.map(it => {
        const owned = S.user.owned.items.includes(it.id), eq = S.user.avatar[st.tab + 'Id'] === it.id;
        return '<div class="item-card ' + (eq ? 'equipped' : '') + '"><canvas data-item="' + it.id + '" width="160" height="160"></canvas><b>' + esc(it.name) + '</b>' + (eq ? '<button class="btn small" disabled>Equipped</button>' : owned ? '<button class="btn small" data-equip="' + it.id + '">Equip</button>' : '<button class="btn small primary" data-buy="' + it.id + '">' + (it.price ? gemsFmt(it.price) : 'Free') + '</button>') + '</div>';
      }).join('') + '</div>';
      $$('canvas[data-item]', b).forEach(cv => { const it = S.catalog.items.find(q => q.id === cv.dataset.item); const av = Object.assign({}, S.user.avatar); av[it.kind] = it.value; const c = cv.getContext('2d'); if (it.kind === 'trail') { c.fillStyle = '#0b0f1a'; c.fillRect(0, 0, 160, 160); for (let i = 0; i < 10; i++) { c.fillStyle = Avatar.trailColor(it.value, i) || '#333'; c.globalAlpha = 1 - i / 10; c.beginPath(); c.arc(30 + i * 8, 110 - i * 6, 8 - i * 0.5, 0, 7); c.fill(); } c.globalAlpha = 1; Avatar.draw(c, 115, 60, 28, { color: av.color, hat: av.hat }); } else drawAvatar(cv, av, 160); });
      $$('[data-equip]', b).forEach(x => x.onclick = async () => { const r = await call('econ.equip', { itemId: x.dataset.equip }); setUser(r.user); preview(); body(); });
      $$('[data-buy]', b).forEach(x => x.onclick = async () => { const it = S.catalog.items.find(q => q.id === x.dataset.buy); if (S.user.gems < it.price) { toast('Not enough Gems', 'err'); return; } const r = await call('econ.buyItem', { itemId: it.id }); setUser(r.user); const r2 = await call('econ.equip', { itemId: it.id }); setUser(r2.user); toast('Bought and equipped ' + it.name, 'ok'); preview(); body(); });
    };
    body();
    $$('#shop-tabs .chip').forEach(c => c.onclick = () => { st.tab = c.dataset.t; $$('#shop-tabs .chip').forEach(x => x.classList.toggle('active', x === c)); body(); });
  };

  // ---------- friends ----------
  views.friends = async function () {
    const v = $('.view[data-view=friends]');
    const d = await call('social.list');
    const row = (f, actions) => '<div class="friend-row"><canvas data-av="' + f.id + '"></canvas><div class="meta"><b>' + esc(f.name) + '</b><small>@' + esc(f.username) + (f.online ? (f.room ? ' · playing ' + esc(f.room.gameName) : ' · online') : ' · offline') + '</small></div><span class="status ' + (f.online ? 'on' : '') + '"></span>' + actions + '</div>';
    v.innerHTML = '<div class="card"><form id="add-friend" class="row"><label style="margin:0;flex:1"><input name="name" placeholder="Add a friend by username" autocapitalize="off"></label><button class="btn primary">Add</button></form></div>' +
      (d.requestsIn.length ? '<div class="section-head"><h3>Requests</h3></div>' + d.requestsIn.map(f => row(f, '<button class="btn small primary" data-acc="' + f.id + '">Accept</button><button class="btn small" data-dec="' + f.id + '">Decline</button>')).join('') : '') +
      '<div class="section-head"><h3>Friends</h3><span class="muted">' + d.friends.length + '</span></div>' +
      (d.friends.length ? d.friends.map(f => row(f, (f.room && !f.room.private ? '<button class="btn small primary" data-join="' + f.room.id + '">Join</button>' : '') + '<button class="btn small" data-prof="' + f.id + '">Profile</button><button class="btn small danger" data-rm="' + f.id + '">✕</button>')).join('') : '<p class="muted">No friends yet. Add someone by username!</p>') +
      (d.requestsOut.length ? '<div class="section-head"><h3>Sent</h3></div>' + d.requestsOut.map(f => row(f, '<button class="btn small" data-dec="' + f.id + '">Cancel</button>')).join('') : '');
    $$('canvas[data-av]', v).forEach(cv => { const f = [...d.friends, ...d.requestsIn, ...d.requestsOut].find(x => x.id === cv.dataset.av); drawAvatar(cv, f.avatar, 72); });
    $('#add-friend').onsubmit = async (e) => { e.preventDefault(); const name = e.target.name.value.trim(); if (!name) return; await call('social.add', { name }); toast('Request sent', 'ok'); views.friends(); };
    $$('[data-acc]', v).forEach(b => b.onclick = async () => { await call('social.accept', { id: b.dataset.acc }); views.friends(); });
    $$('[data-dec]', v).forEach(b => b.onclick = async () => { await call('social.decline', { id: b.dataset.dec }); views.friends(); });
    $$('[data-rm]', v).forEach(b => b.onclick = async () => { if (await confirm('Remove friend?', '', 'Remove')) { await call('social.remove', { id: b.dataset.rm }); views.friends(); } });
    $$('[data-join]', v).forEach(b => b.onclick = () => joinGame({ roomId: b.dataset.join }));
    $$('[data-prof]', v).forEach(b => b.onclick = () => show('profile', { id: b.dataset.prof }));
  };
  Net.on('social', (m) => { if (m.reason === 'request') toast(m.from + ' sent you a friend request'); if (m.reason === 'accepted') toast(m.from + ' accepted your request', 'ok'); if (S.view === 'friends') views.friends(); });

  // ---------- profile ----------
  views.profile = async function (p) {
    const v = $('.view[data-view=profile]');
    const me = !p.id || p.id === S.user.id;
    let u, ledger = [], lb = S.leaderboard;
    if (me) { u = Object.assign({ name: S.user.displayName, username: S.user.name, games: S.games.filter(g => g.creator === S.user.id) }, S.user); ledger = await call('econ.ledger'); lb = S.leaderboard = await call('leaderboard'); }
    else { try { u = await call('profile.get', { id: p.id }); } catch (e) { back(); return; } }
    v.innerHTML = '<div class="card avatar-preview"><canvas id="prof-av"></canvas><div><b style="font-size:20px">' + esc(u.name) + '</b><div class="muted">@' + esc(u.username) + ' · joined ' + new Date(u.created).toLocaleDateString() + (me ? '' : u.online ? ' · <span style="color:var(--ok)">online</span>' : ' · offline') + '</div>' + (me ? '' : '<div class="row" style="margin-top:10px"><button class="btn small primary" id="prof-add">Add friend</button>' + (u.room && !u.room.private ? '<button class="btn small" id="prof-join">Join their game</button>' : '') + '</div>') + '</div></div>' +
      '<div class="grid g3" style="margin-top:16px"><div class="card stat"><div class="num">' + u.stats.wins + '</div><div class="lbl">Wins</div></div><div class="card stat"><div class="num">' + u.stats.rounds + '</div><div class="lbl">Rounds played</div></div><div class="card stat"><div class="num">' + gemsFmt(u.stats.earned) + '</div><div class="lbl">Gems earned</div></div></div>' +
      (u.games && u.games.length ? '<div class="section-head"><h3>Games by ' + esc(u.name) + '</h3></div><div class="hscroll">' + u.games.map(gameCard).join('') + '</div>' : '') +
      (me ? '<div class="section-head"><h3>Leaderboard</h3><span class="muted">Top earners on this hub</span></div><div class="card table-wrap"><table><tr><th>#</th><th>Player</th><th class="num">Earned</th><th class="num">Wins</th><th class="num">Rounds</th></tr>' + lb.map((x, i) => '<tr' + (x.id === S.user.id ? ' style="color:var(--accent)"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td class="num">' + gemsFmt(x.earned) + '</td><td class="num">' + x.wins + '</td><td class="num">' + x.rounds + '</td></tr>').join('') + '</table></div>' +
        '<div class="section-head"><h3>Transactions</h3></div><div class="card table-wrap"><table><tr><th>When</th><th>What</th><th class="num">Gems</th></tr>' + ledger.map(l => '<tr><td class="muted">' + timeAgo(l.ts) + '</td><td>' + esc(l.note) + '</td><td class="num ' + (l.amount >= 0 ? 'pos' : 'neg') + '">' + (l.amount >= 0 ? '+' : '') + l.amount + '</td></tr>').join('') + '</table></div>' : '');
    drawAvatar($('#prof-av'), u.avatar, 240);
    bindCards(v);
    if (!me) { $('#prof-add').onclick = async () => { await call('social.add', { name: u.username }); toast('Request sent', 'ok'); }; const j = $('#prof-join'); if (j) j.onclick = () => joinGame({ roomId: u.room.id }); }
  };

  // ---------- settings ----------
  views.settings = function () {
    const v = $('.view[data-view=settings]');
    v.innerHTML = '<div class="card"><b>Connection</b><label>Hub server URL<input id="s-url" value="' + esc(Net.url || '') + '"></label><div class="row" style="margin-top:12px"><button class="btn" id="s-reconnect">Reconnect</button><span class="muted">' + (Net.connected ? 'Connected' : 'Disconnected') + '</span></div></div>' +
      (Platform.canHost ? '<div class="card" style="margin-top:14px"><b>Host a server</b><p class="muted">Run a hub on this computer. Friends on your network (or the internet, if you forward the port) can connect with the address shown.</p><div class="row" style="margin-top:12px"><button class="btn primary" id="s-host">Start local server</button><button class="btn" id="s-stop" hidden>Stop</button></div><pre class="muted" id="s-host-info" style="margin-top:10px;white-space:pre-wrap"></pre></div>' : '') +
      '<div class="card" style="margin-top:14px"><b>Account</b><p class="muted">Signed in as ' + esc(S.user.displayName) + ' (@' + esc(S.user.name) + ')</p><button class="btn danger" id="s-logout" style="margin-top:10px">Sign out</button></div>' +
      '<div class="card" style="margin-top:14px"><b>About</b><p class="muted">gmfy Hub · client ' + esc(Platform.version) + ' on ' + esc(Platform.name) + ' (' + esc(Platform.os) + ') · server ' + esc(S.serverVersion || '?') + '</p></div>';
    $('#s-reconnect').onclick = () => { const u = $('#s-url').value.trim(); Platform.store('hub.server', u); location.reload(); };
    $('#s-logout').onclick = async () => { try { await Net.req('auth.logout'); } catch (e) {} Platform.store('hub.token', ''); location.reload(); };
    if (Platform.canHost) {
      const info = $('#s-host-info');
      const refresh = async () => { const st = await Platform.hostServer('status'); if (st && st.running) { $('#s-host').hidden = true; $('#s-stop').hidden = false; info.textContent = 'Running. Connect with:\n' + st.urls.map(u => u.replace(/^http/, 'ws') + '/ws').join('\n'); } else { $('#s-host').hidden = false; $('#s-stop').hidden = true; info.textContent = ''; } };
      $('#s-host').onclick = async () => { try { await Platform.hostServer('start'); } catch (e) { toast(e.message, 'err'); } refresh(); };
      $('#s-stop').onclick = async () => { await Platform.hostServer('stop'); refresh(); };
      refresh();
    }
  };

  // ---------- chat drawer ----------
  function chatLine(m) {
    const d = document.createElement('div'); d.className = 'chat-line';
    d.innerHTML = '<b>' + esc(m.name) + '</b> ' + esc(m.text);
    const log = $('#chat-log'); log.appendChild(d); while (log.children.length > 100) log.removeChild(log.firstChild); log.scrollTop = log.scrollHeight;
  }
  $('#chat-btn').onclick = () => { $('#chat').hidden = !$('#chat').hidden; if (!$('#chat').hidden) $('#chat-form input').focus(); };
  $('#chat-close').onclick = () => { $('#chat').hidden = true; };
  $('#chat-form').onsubmit = (e) => { e.preventDefault(); const i = $('#chat-form input'); if (i.value.trim()) Net.send('chat', { scope: 'global', text: i.value.trim() }); i.value = ''; };
  Net.on('chat', (m) => { if (m.scope === 'room') { if (Play.running) Play.chat(m); } else chatLine(m); });
  Net.on('user', (m) => { const prev = S.user ? S.user.gems : 0; setUser(m.user); if (m.user.gems > prev && !Play.running) toast('+' + (m.user.gems - prev) + ' Gems', 'ok'); });
  Net.on('hello', (m) => { S.online = m.online; $('#online-count').textContent = m.online; S.serverVersion = m.version; });
  Net.on('close', () => { toast('Disconnected from server', 'err'); if (Play.running) { Play.stop(); $('#shell').hidden = false; } setTimeout(() => location.reload(), 2500); });

  async function refreshGames() { try { S.games = await Net.req('games.list', {}); } catch (e) {} }

  // ---------- auth flow ----------
  let mode = 'login';
  $$('#auth-tabs button').forEach(b => b.onclick = () => { mode = b.dataset.tab; $$('#auth-tabs button').forEach(x => x.classList.toggle('active', x === b)); $('#auth-display').hidden = mode !== 'register'; $('#auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account'; });
  const serverInput = $('#auth-form [name=server]');
  serverInput.value = Platform.store('hub.server') || Platform.defaultServer();
  if (Platform.isFile) $('#auth-server').open = true;

  async function ensureConnected(url) {
    if (Net.connected && Net.url === url) return;
    $('#auth-msg').className = 'msg'; $('#auth-msg').textContent = 'Connecting to ' + url + '…';
    await Net.connect(url);
    $('#auth-msg').textContent = '';
  }
  async function enter(user, token) {
    Platform.store('hub.token', token || Platform.store('hub.token'));
    Platform.store('hub.server', Net.url);
    const b = await Net.req('hub.bootstrap');
    S.catalog = b.catalog; S.games = b.games; S.online = b.online; S.leaderboard = b.leaderboard; S.sandbox = b.sandboxPayments; S.serverVersion = b.version;
    setUser(b.user);
    $('#online-count').textContent = b.online;
    $('#chat-log').innerHTML = ''; b.chat.forEach(chatLine);
    $('#auth').hidden = true; $('#shell').hidden = false;
    show('home', {}, false);
  }
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('#auth-submit');
    btn.disabled = true;
    try {
      await ensureConnected(f.server.value.trim() || Platform.defaultServer());
      const r = await Net.req(mode === 'login' ? 'auth.login' : 'auth.register', { name: f.name.value, password: f.password.value, displayName: f.displayName.value });
      await enter(r.user, r.token);
    } catch (err) { $('#auth-msg').className = 'msg'; $('#auth-msg').textContent = err.message; }
    btn.disabled = false;
  };
  // auto-resume
  (async () => {
    const token = Platform.store('hub.token');
    if (!token) return;
    try { await ensureConnected(serverInput.value); const r = await Net.req('auth.resume', { token }); await enter(r.user, token); }
    catch (e) { $('#auth-msg').textContent = /session|sign in|account/i.test(e.message) ? '' : e.message; Platform.store('hub.token', ''); }
  })();
  // Android back button → in-app back
  window.hubBack = () => { if (Play.running) { leaveGame(); return true; } if (!$('#modal').hidden) { closeModal(); return true; } if (!$('#chat').hidden) { $('#chat').hidden = true; return true; } if (S.stack.length) { back(); return true; } return false; };
})();
