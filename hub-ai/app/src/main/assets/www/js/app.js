/* Hub AI user interface. */
(function () {
  'use strict';

  var esc = HubTemplates.esc;
  var view = document.getElementById('view');
  var state = {
    view: 'create', arg: null, stack: [],
    engine: Store.get('engine', 'mini'),
    prompt: Store.get('promptDraft', ''),
    draft: Store.get('draft', null),   // last generated, unsaved hub
    busy: false
  };

  var EXAMPLES = [
    'A to-do list for my groceries',
    'Pomodoro timer in green called Deep Work',
    'Quiz about space',
    'Snake game',
    'Landing page for my bakery',
    'Tip calculator for dinner with friends'
  ];

  // ---------- helpers ----------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmtDate(t) { return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hub'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function hubs() { return Store.get('hubs', []); }
  function saveHubs(list) {
    if (!Store.set('hubs', list)) { toast('Storage is full. Delete some hubs first.'); return false; }
    return true;
  }
  function hubById(id) { return hubs().filter(function (h) { return h.id === id; })[0] || null; }

  function frame(html, cls) {
    var f = document.createElement('iframe');
    f.className = cls || 'preview';
    f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock');
    f.setAttribute('title', 'Hub preview');
    f.srcdoc = html;
    return f;
  }

  function lockBtn(label, feature, act) {
    var ok = Plans.can(feature);
    return '<button class="btn' + (ok ? '' : ' locked') + '" data-act="' + act + '"' + (ok ? '' : ' data-locked="' + feature + '"') + '>' +
      (ok ? '' : '<span class="lock">🔒</span>') + esc(label) + '</button>';
  }

  // ---------- navigation ----------

  function go(name, arg, push) {
    if (push !== false && (state.view !== name || state.arg !== arg)) state.stack.push([state.view, state.arg]);
    state.view = name; state.arg = arg || null;
    render();
  }

  function back() {
    if (!$('#player').hidden) { closePlayer(); return true; }
    if (!$('#sheet').hidden) { closeSheet(); return true; }
    if (state.stack.length) {
      var prev = state.stack.pop();
      state.view = prev[0]; state.arg = prev[1];
      render();
      return true;
    }
    return false;
  }

  function render() {
    var tab = { hub: 'hubs', settings: null }[state.view];
    var active = tab === undefined ? state.view : tab;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-go') === active);
    });
    renderCredits();
    view.className = state.view === 'funhub' ? 'flush' : '';
    view.scrollTop = 0;
    VIEWS[state.view](state.arg);
  }

  function renderCredits() {
    var c = Plans.credits(), el = $('#credits');
    if (!Cloud.configured()) el.textContent = 'Not connected';
    else el.textContent = (c.left === null ? '–' : c.left) + ' credits · ' + Plans.plan().name.replace('Hub ', '');
  }

  // Refreshes plan and credits from the cloud, then redraws.
  function sync() {
    if (!Cloud.configured()) return Promise.resolve();
    return Cloud.refresh().then(function () { renderCredits(); if (!state.busy) render(); },
      function (e) { if (state.view === 'settings') renderSettings(); return e; });
  }

  // ---------- sheets ----------

  function openSheet(html, bind) {
    var s = $('#sheet');
    s.innerHTML = '<div class="wrap">' + html + '</div>';
    s.hidden = false; $('#overlay').hidden = false;
    if (bind) bind(s);
  }
  function closeSheet() { $('#sheet').hidden = true; $('#overlay').hidden = true; $('#sheet').innerHTML = ''; }

  function upgrade(text) {
    openSheet('<h2>Upgrade needed</h2><p>' + esc(text) + '</p>' +
      '<div class="row"><button class="btn" data-x="close">Not now</button><button class="btn primary grow" data-x="plans">See plans</button></div>',
      function (s) {
        s.querySelector('[data-x=close]').onclick = closeSheet;
        s.querySelector('[data-x=plans]').onclick = function () { closeSheet(); go('plans'); };
      });
  }

  var LOCK_TEXT = {
    save: 'Saving hubs needs Hub Go or Hub Plus. Hub Free can preview hubs only.',
    publish: 'Publishing to FunHub needs Hub Go or Hub Plus.',
    'export:html': 'HTML export needs Hub Go or Hub Plus.',
    'export:zip': 'ZIP export is part of Hub Plus. Hub Go exports HTML only.'
  };

  function openPlayer(title, html) {
    $('#playerTitle').textContent = title;
    $('#playerFrame').srcdoc = html;
    $('#player').hidden = false;
  }
  function closePlayer() { $('#player').hidden = true; $('#playerFrame').srcdoc = ''; }

  // ---------- hub actions shared by Create and hub detail ----------

  function exportFailed(e) { if (e.message !== 'cancelled') toast('Export failed: ' + e.message); }

  function exportHtml(hub) {
    HubBridge.save(slug(hub.title) + '.html', 'text/html', hub.html).then(toast, exportFailed);
  }

  function exportZip(hub) {
    var meta = { title: hub.title, engine: hub.engineName, prompt: hub.prompt, type: hub.type, created: hub.created, app: 'Hub AI' };
    var readme = hub.title + '\n\nMade with Hub AI (' + hub.engineName + ').\nOpen index.html in any browser. It works offline.\n';
    var data = Zip.zip([{ name: 'index.html', data: hub.html }, { name: 'hub.json', data: JSON.stringify(meta, null, 2) }, { name: 'README.txt', data: readme }]);
    HubBridge.save(slug(hub.title) + '.zip', 'application/zip', data).then(toast, exportFailed);
  }

  function shareHub(title, html) {
    HubBridge.share(slug(title) + '.html', 'text/html', html, title + ' — made with Hub AI. Open the file in a browser to use it.')
      .then(function (msg) { if (msg) toast(msg); },
            function (e) { if (e && e.name !== 'AbortError') toast('Could not share: ' + e.message); });
  }

  function hubAction(act, hub, after) {
    if (act === 'open') return openPlayer(hub.title, hub.html);
    if (act === 'html') return exportHtml(hub);
    if (act === 'zip') return exportZip(hub);
    if (act === 'share') return shareHub(hub.title, hub.html);
    if (act === 'publish') {
      if (FunHub.isPublished(hub.id)) { FunHub.unpublish(hub.id); toast('Removed from FunHub'); }
      else if (FunHub.publish(hub, Store.get('settings', {}).author)) toast('Published to FunHub');
      else toast('Storage is full.');
      if (after) after();
    }
  }

  function bindActions(root, getHub, after) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-act]'), function (b) {
      b.onclick = function () {
        var locked = b.getAttribute('data-locked');
        if (locked) return upgrade(LOCK_TEXT[locked]);
        var hub = getHub();
        if (hub) hubAction(b.getAttribute('data-act'), hub, after);
      };
    });
  }

  // ---------- Create ----------

  function engineRow(e) {
    var blocked = Plans.blocked(e.id);
    var planLock = blocked && blocked.reason === 'plan';
    var lim = Plans.limitLeft(e.id);
    var meta = e.kind === 'gemini' ? 'Google · runs in Hub AI Cloud' : 'Cloud agent · built on ' + e.base.join(' + ');
    if (lim !== null) meta += ' · ' + lim + ' left today';
    var tag = planLock ? (e.id === 'v2max' ? '🔒 Enterprise · ' : '🔒 ') : '';
    return '<button class="engine' + (state.engine === e.id ? ' on' : '') + (planLock ? ' off' : '') + '" data-engine="' + e.id + '">' +
      '<span class="dot"></span><span><div>' + tag + esc(e.name) + '</div><div class="meta">' + esc(meta) + '</div></span>' +
      '<span class="cost">' + e.cost + ' credit' + (e.cost > 1 ? 's' : '') + '</span></button>';
  }

  function renderCreate() {
    var c = Plans.credits();
    var status = !Cloud.configured()
      ? '<div class="note">Hub agents run in Hub AI Cloud. Add your server address in <a href="#" id="toSettings">Settings</a> to start generating.</div>'
      : '<p class="muted small" style="margin:8px 0 0">' + (c.left === null ? 'Connecting…' : c.left + ' credits left') + ' · ' +
        esc(Plans.plan().name) + (c.rule ? ' (' + esc(c.rule) + ')' : '') + '</p>';
    view.innerHTML = '<div class="wrap">' +
      '<div class="card"><h2>Create a hub</h2>' +
      '<textarea class="in" id="prompt" placeholder="Describe the app you want, e.g. a habit tracker for drinking water">' + esc(state.prompt) + '</textarea>' +
      '<div class="chips">' + EXAMPLES.map(function (x) { return '<button class="chip" data-ex="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<label class="field">Agent</label><div class="engines">' + Plans.engines().map(engineRow).join('') + '</div>' +
      '<button class="btn primary block" id="gen" style="margin-top:12px">' + (state.busy ? '<span class="spinner"></span> Generating…' : 'Generate') + '</button>' +
      status + '</div><div id="result"></div></div>';

    var p = $('#prompt');
    p.oninput = function () { state.prompt = p.value; Store.set('promptDraft', p.value); };
    Array.prototype.forEach.call(view.querySelectorAll('[data-ex]'), function (b) {
      b.onclick = function () { p.value = state.prompt = b.getAttribute('data-ex'); Store.set('promptDraft', p.value); };
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-engine'), bl = Plans.blocked(id);
        if (bl && bl.reason === 'plan') return id === 'v2max' ? enterprise() : upgrade(bl.text);
        state.engine = id; Store.set('engine', id);
        Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (x) { x.classList.toggle('on', x === b); });
      };
    });
    $('#gen').onclick = generate;
    var ts = $('#toSettings');
    if (ts) ts.onclick = function (ev) { ev.preventDefault(); go('settings'); };
    if (!Plans.engine(state.engine) || (Plans.blocked(state.engine) && Plans.blocked(state.engine).reason === 'plan')) {
      state.engine = 'mini';
      Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (x) { x.classList.toggle('on', x.getAttribute('data-engine') === 'mini'); });
    }
    renderResult();
  }

  function renderResult() {
    var box = $('#result');
    if (!box) return;
    var d = state.draft;
    if (!d) { box.innerHTML = ''; return; }
    var saved = d.savedId && hubById(d.savedId);
    box.innerHTML = '<div class="card"><div class="row"><div class="grow"><h3>' + esc(d.title) + '</h3>' +
      '<div class="muted small">' + esc(d.engineName) + (d.base ? ' · ' + esc(d.base.join(' + ')) : '') +
      (d.seconds ? ' · ' + d.seconds + ' s' : '') + '</div></div>' +
      '<button class="btn" data-act="open">Full screen</button></div>' +
      (d.notes || []).map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('') +
      '<div id="pv" style="margin-top:10px"></div>' +
      '<div class="actions">' +
      (saved ? '<button class="btn" id="saved">Saved ✓</button>' : '<button class="btn' + (Plans.can('save') ? '' : ' locked') + '" id="save">' + (Plans.can('save') ? '' : '<span class="lock">🔒</span>') + 'Save</button>') +
      lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(saved && FunHub.isPublished(saved.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') +
      lockBtn('Share', 'export:html', 'share') +
      '<button class="btn" id="discard">Discard</button></div></div>';
    $('#pv').appendChild(frame(d.html));

    var saveBtn = $('#save');
    if (saveBtn) saveBtn.onclick = function () {
      if (!Plans.can('save')) return upgrade(LOCK_TEXT.save);
      saveDraft(); renderResult(); toast('Saved to Hubs');
    };
    var savedBtn = $('#saved');
    if (savedBtn) savedBtn.onclick = function () { go('hub', d.savedId); };
    $('#discard').onclick = function () { state.draft = null; Store.set('draft', null); renderResult(); };
    bindActions(box, function () {
      // Exporting or publishing from here saves the hub first.
      if (d.savedId && hubById(d.savedId)) return hubById(d.savedId);
      var id = saveDraft();
      setTimeout(renderResult, 0);
      return id ? hubById(id) : null;
    }, renderResult);
    // "open" is allowed for everyone, even before saving.
    box.querySelector('[data-act=open]').onclick = function () { openPlayer(d.title, d.html); };
  }

  function saveDraft() {
    var d = state.draft;
    if (d.savedId && hubById(d.savedId)) return d.savedId;
    var hub = { id: uid(), title: d.title, html: d.html, engine: d.engine, engineName: d.engineName, type: d.type || null, prompt: d.prompt, created: Date.now() };
    var list = hubs(); list.unshift(hub);
    if (!saveHubs(list)) return null;
    d.savedId = hub.id; Store.set('draft', d);
    return hub.id;
  }

  function generate() {
    if (state.busy) return;
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) { toast('Describe the hub you want first.'); return; }
    if (!Cloud.configured()) { go('settings'); toast('Add your Hub AI Cloud server first.'); return; }
    var id = state.engine, e = Plans.engine(id), bl = Plans.blocked(id);
    if (bl) return bl.reason === 'credits' || bl.reason === 'plan' ? upgrade(bl.text) : toast(bl.text);

    state.busy = true;
    $('#gen').innerHTML = '<span class="spinner"></span> ' + esc(e.name) + ' is building your hub…';
    Cloud.generate(id, prompt).then(function (r) {
      state.draft = { title: r.title, html: r.html, engine: id, engineName: r.engineName, base: r.base,
        seconds: r.seconds, notes: [], prompt: prompt, at: Date.now() };
      Store.set('draft', state.draft);
    }, function (err) {
      if (err.code === 'plan' || err.code === 'credits') upgrade(err.message);
      else toast(err.message || String(err));
      if (err.status === 402 || err.status === 429) sync();
    }).then(function () {
      state.busy = false;
      if (state.view === 'create') { renderCreate(); var r = $('#result'); if (r && state.draft) r.scrollIntoView({ behavior: 'smooth' }); }
      renderCredits();
    });
  }

  // ---------- Hubs ----------

  function renderHubs() {
    if (!Plans.can('save')) {
      view.innerHTML = '<div class="wrap"><div class="card empty"><h2>Hubs</h2><p>Hub Free can try Hub V1 Mini and preview what it makes, but saving and exporting hubs starts with Hub Go ($2/month).</p>' +
        '<button class="btn primary" id="up">See plans</button></div></div>';
      $('#up').onclick = function () { go('plans'); };
      return;
    }
    var list = hubs();
    view.innerHTML = '<div class="wrap"><h2>Your hubs</h2>' + (list.length ? list.map(function (h) {
      return '<button class="hub-item" data-id="' + h.id + '"><span class="thumb">' + esc(h.title.charAt(0).toUpperCase()) + '</span>' +
        '<span class="grow"><div class="t">' + esc(h.title) + '</div><div class="muted small">' + esc(h.engineName) + ' · ' + fmtDate(h.created) +
        (FunHub.isPublished(h.id) ? ' · on FunHub' : '') + '</div></span></button>';
    }).join('') : '<div class="card empty">No hubs yet. Make one on the Create tab.</div>') + '</div>';
    Array.prototype.forEach.call(view.querySelectorAll('[data-id]'), function (b) {
      b.onclick = function () { go('hub', b.getAttribute('data-id')); };
    });
  }

  function renderHub(id) {
    var h = hubById(id);
    if (!h || !Plans.can('save')) { state.view = 'hubs'; renderHubs(); return; }
    view.innerHTML = '<div class="wrap"><div class="card"><input class="in" id="title" value="' + esc(h.title) + '" aria-label="Hub title">' +
      '<div class="muted small" style="margin:8px 0">' + esc(h.engineName) + ' · ' + fmtDate(h.created) + (h.prompt ? ' · “' + esc(h.prompt.slice(0, 80)) + '”' : '') + '</div>' +
      '<div id="pv"></div><div class="actions">' +
      '<button class="btn" data-act="open">Full screen</button>' + lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(FunHub.isPublished(h.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') + lockBtn('Share', 'export:html', 'share') +
      '<button class="btn danger" id="del">Delete</button></div></div></div>';
    $('#pv').appendChild(frame(h.html));
    $('#title').onchange = function () {
      var list = hubs();
      list.forEach(function (x) { if (x.id === id) x.title = $('#title').value.trim() || x.title; });
      saveHubs(list); toast('Renamed');
    };
    bindActions(view, function () { return hubById(id); }, function () { renderHub(id); });
    $('#del').onclick = function () {
      openSheet('<h2>Delete hub?</h2><p>“' + esc(h.title) + '” will be removed from this phone' + (FunHub.isPublished(id) ? ' and from FunHub' : '') + '.</p>' +
        '<div class="row"><button class="btn grow" data-x="no">Cancel</button><button class="btn danger grow" data-x="yes">Delete</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=yes]').onclick = function () {
          saveHubs(hubs().filter(function (x) { return x.id !== id; }));
          FunHub.unpublish(id); closeSheet(); state.stack.pop(); go('hubs', null, false); toast('Deleted');
        };
      });
    };
  }

  // ---------- FunHub ----------

  function renderFunHub() {
    var posts = FunHub.posts();
    view.innerHTML = '<div class="feed" id="feed">' + posts.map(function (p, i) {
      var l = FunHub.liked(p.id);
      return '<section class="post" data-i="' + i + '"><div class="stage"><button class="tap" data-open="' + i + '" aria-label="Open ' + esc(p.title) + '"></button></div>' +
        '<div class="info"><div class="who"><b>' + esc(p.title) + '</b><span class="muted small">' + esc(p.author) + ' · ' + esc(p.engine || '') + '</span></div>' +
        '<div class="side"><button class="btn' + (l ? ' liked' : '') + '" data-like="' + i + '">' + (l ? '♥' : '♡') + ' ' + (p.likes + (l ? 1 : 0)) + '</button>' +
        '<button class="btn" data-share="' + i + '">Share</button><button class="btn" data-open="' + i + '">Play</button></div></div></section>';
    }).join('') + '</div>';

    var feed = $('#feed');
    function mount(sec) {
      var stage = sec.querySelector('.stage');
      if (stage.querySelector('iframe')) return;
      stage.insertBefore(frame(FunHub.html(posts[+sec.getAttribute('data-i')]), ''), stage.firstChild);
    }
    function unmount(sec) { var f = sec.querySelector('iframe'); if (f) f.remove(); }
    var secs = Array.prototype.slice.call(feed.querySelectorAll('.post'));
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var i = secs.indexOf(en.target);
          if (en.isIntersecting) {
            [i - 1, i, i + 1].forEach(function (j) { if (secs[j]) mount(secs[j]); });
            secs.forEach(function (s, j) { if (Math.abs(j - i) > 2) unmount(s); });
          }
        });
      }, { root: feed, threshold: 0.6 });
      secs.forEach(function (s) { io.observe(s); });
    } else secs.slice(0, 2).forEach(mount);

    feed.onclick = function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      var p;
      if (b.hasAttribute('data-open')) { p = posts[+b.getAttribute('data-open')]; openPlayer(p.title, FunHub.html(p)); }
      if (b.hasAttribute('data-share')) { p = posts[+b.getAttribute('data-share')]; shareHub(p.title, FunHub.html(p)); }
      if (b.hasAttribute('data-like')) {
        p = posts[+b.getAttribute('data-like')];
        var on = FunHub.toggleLike(p.id);
        b.classList.toggle('liked', on);
        b.textContent = (on ? '♥' : '♡') + ' ' + (p.likes + (on ? 1 : 0));
      }
    };
  }

  // ---------- Agents ----------

  function renderAgents() {
    var plan = Plans.plan();
    var html = '<div class="wrap"><h2>Hub agents</h2><p class="muted small">Hub agents run in Hub AI Cloud. Each one starts from a ' +
      'base model and is fine-tuned in Python (hub-ai/cloud/training) to build hubs.</p>';
    Plans.engines().forEach(function (e) {
      var open = plan.engines.indexOf(e.id) >= 0;
      var lock = e.id === 'v2max' ? 'Enterprise' : Plans.plans().go.engines.indexOf(e.id) >= 0 ? 'Go' : 'Plus';
      var trained = e.kind === 'gemini' ? 'Google model' : e.training === 'fine-tuned' ? 'Fine-tuned for Hub' : 'Base model + Hub instructions';
      html += '<div class="card"><div class="row"><h3 class="grow">' + esc(e.name) + '</h3>' +
        (open ? '<span class="tag ok">' + (plan.limits[e.id] ? plan.limits[e.id] + ' per day' : 'Unlocked') + '</span>' : '<span class="tag">🔒 ' + lock + '</span>') + '</div>' +
        '<div class="small">' + (e.base.length > 1 ? 'Built by ' + esc(e.base[0]) + ', reviewed by ' + esc(e.base[1]) : 'Base model: ' + esc(e.base[0])) + '</div>' +
        '<div class="muted small" style="margin-top:4px">' + esc(trained) + ' · ' + e.cost + ' credit' + (e.cost > 1 ? 's' : '') + ' per hub</div></div>';
    });
    view.innerHTML = html + '</div>';
  }

  // ---------- Plans ----------

  function enterprise() {
    var p = Plans.plans().enterprise;
    openSheet('<h2>' + esc(p.name) + '</h2><p>Hub V2 Max (GPT-6 Astra builds, GPT-6 Sol reviews) is only available to very large companies.</p>' +
      '<p class="muted">$' + p.price.toLocaleString('en-US') + ' per ' + esc(p.period) + ', about one person\'s yearly salary. ' +
      'It can\'t be bought in the app: Hub AI sets it up for your company\'s accounts.</p>' +
      (Cloud.account() ? '<p class="muted small">Your account ID for your company admin: <b>' + esc(Cloud.account()) + '</b></p>' : '') +
      '<button class="btn block" data-x="ok">OK</button>', function (s) { s.querySelector('[data-x=ok]').onclick = closeSheet; });
  }

  function renderPlans() {
    var me = Plans.me(), cur = Plans.plan(), c = Plans.credits(), all = Plans.plans();
    var html = '<div class="wrap"><h2>Plans</h2><div class="demo-banner">Demo payments: nothing is charged and no card details leave this screen.</div>' +
      '<div class="card"><div class="muted small">Current plan</div><h3>' + esc(cur.name) + '</h3><div>' +
      (c.left === null ? (Cloud.configured() ? 'Connecting to Hub AI Cloud…' : 'Not connected to Hub AI Cloud') : c.left + ' credits available · ' + esc(c.rule)) + '</div>' +
      (me && me.renews ? '<div class="muted small" style="margin-top:4px">' + (me.cancelled ? 'Ends' : 'Renews') + ' ' + fmtDate(me.renews) + ' (demo)</div>' : '') +
      (me && (me.plan === 'go' || me.plan === 'plus') && !me.cancelled ? '<button class="btn" id="cancel" style="margin-top:10px">Cancel plan</button>' : '') + '</div>';
    ['free', 'go', 'plus', 'enterprise'].forEach(function (id) {
      var p = all[id], here = id === cur.id;
      var price = p.price ? '$' + p.price.toLocaleString('en-US') + ' / ' + p.period : 'Free';
      var btn = here ? '<button class="btn block" disabled>Current plan</button>'
        : !p.buyable ? '<button class="btn block" data-ent="1">Large companies only</button>'
        : cur.id === 'enterprise' ? ''
        : '<button class="btn ' + (p.price > cur.price ? 'primary ' : '') + 'block" data-plan="' + id + '">' + (p.price ? 'Choose ' + esc(p.name) : 'Switch to Free') + '</button>';
      html += '<div class="card plan' + (here ? ' current' : '') + '"><h3>' + esc(p.name) + '<span class="price">' + price + '</span></h3>' +
        '<ul>' + p.perks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + btn + '</div>';
    });
    var receipts = (me && me.receipts) || [];
    if (receipts.length) {
      html += '<div class="card"><h3>Demo receipts</h3>' + receipts.map(function (r) {
        return '<div class="row small" style="padding:4px 0"><span class="grow">' + esc(r.plan) + ' · ' + fmtDate(r.at) + '</span><span class="muted">$' + r.amount.toFixed(2) + ' · ' + esc(r.ref) + '</span></div>';
      }).join('') + '</div>';
    }
    view.innerHTML = html + '</div>';
    Array.prototype.forEach.call(view.querySelectorAll('[data-plan]'), function (b) {
      b.onclick = function () { checkout(b.getAttribute('data-plan')); };
    });
    var ent = view.querySelector('[data-ent]');
    if (ent) ent.onclick = enterprise;
    var cn = $('#cancel');
    if (cn) cn.onclick = function () {
      Cloud.cancel().then(function () { toast('Plan cancelled. It stays active until the end of the period.'); renderPlans(); },
        function (e) { toast(e.message); });
    };
  }

  function luhn(n) {
    var s = 0, alt = false;
    for (var i = n.length - 1; i >= 0; i--) {
      var d = +n[i];
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      s += d; alt = !alt;
    }
    return n.length >= 12 && s % 10 === 0;
  }

  function subscribed(p) {
    renderCredits();
    if (state.view === 'plans') renderPlans();
    openSheet('<h2>You\'re on ' + esc(p.name) + '</h2><p class="muted">' + (p.price ? 'Demo payment complete. Nothing was charged.' : '') + '</p><ul class="muted">' +
      p.perks.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><button class="btn primary block" data-x="ok">Start creating</button>', function (s2) {
      s2.querySelector('[data-x=ok]').onclick = function () { closeSheet(); go('create'); };
    });
  }

  function checkout(id) {
    var p = Plans.plans()[id];
    if (!Cloud.configured()) { go('settings'); toast('Connect to Hub AI Cloud first.'); return; }
    if (!p.price) {
      openSheet('<h2>Switch to Hub Free?</h2><p>You keep your saved hubs, but you can only use Hub V1 Mini and can\'t open or export saved hubs.</p>' +
        '<div class="row"><button class="btn grow" data-x="no">Keep my plan</button><button class="btn danger grow" data-x="yes">Switch</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=yes]').onclick = function () {
          Cloud.subscribe('free').then(function () { closeSheet(); render(); toast('You are on Hub Free'); }, function (e) { toast(e.message); });
        };
      });
      return;
    }
    openSheet('<h2>' + esc(p.name) + ' · $' + p.price + ' / ' + p.period + '</h2>' +
      '<div class="demo-banner">Demo checkout. No payment is taken; the test card below is filled in for you.</div>' +
      '<label class="field">Card number</label><input class="in" id="cc" inputmode="numeric" value="4242 4242 4242 4242" autocomplete="off">' +
      '<div class="row"><div class="grow"><label class="field">Expiry</label><input class="in" id="ex" value="12 / 34" autocomplete="off"></div>' +
      '<div class="grow"><label class="field">CVC</label><input class="in" id="cv" inputmode="numeric" value="123" autocomplete="off"></div></div>' +
      '<label class="field">Name on card</label><input class="in" id="nm" value="Demo User" autocomplete="off">' +
      '<p class="muted small" id="err" style="margin-top:8px"></p>' +
      '<div class="row"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" id="pay">Pay $' + p.price.toFixed(2) + ' (demo)</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('#pay').onclick = function () {
        var num = s.querySelector('#cc').value.replace(/\D/g, '');
        if (!luhn(num)) { s.querySelector('#err').textContent = 'That card number doesn\'t look right. Use 4242 4242 4242 4242.'; return; }
        if (!/^\d{3,4}$/.test(s.querySelector('#cv').value.trim())) { s.querySelector('#err').textContent = 'CVC should be 3 or 4 digits.'; return; }
        var b = this; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Processing…';
        // Only the plan goes to the server; the card details never leave this sheet.
        Cloud.subscribe(id).then(function () { subscribed(p); }, function (e) {
          b.disabled = false; b.textContent = 'Pay $' + p.price.toFixed(2) + ' (demo)';
          s.querySelector('#err').textContent = e.message;
        });
      };
    });
  }

  // ---------- Settings ----------

  function renderSettings() {
    var s = Store.get('settings', {});
    var status = !Cloud.configured() ? 'Not connected.'
      : Plans.me() ? 'Connected · account ' + esc(Cloud.account() || '') + ' · ' + esc(Plans.plan().name) : 'Not connected yet.';
    view.innerHTML = '<div class="wrap"><h2>Settings</h2>' +
      '<div class="card"><h3>Hub AI Cloud</h3><p class="muted small">The Hub agents and Gemini run on your Hub AI Cloud server ' +
      '(hub-ai/cloud). Your plan and credits are kept there.</p>' +
      '<label class="field">Server address</label><input class="in" id="url" inputmode="url" autocomplete="off" placeholder="https://your-hub-ai-cloud.example.com" value="' +
      esc(s.cloudUrl || (window.HUB_CONFIG && window.HUB_CONFIG.cloudUrl) || '') + '">' +
      '<p class="small" id="cs" style="margin:8px 0 0">' + status + '</p></div>' +
      '<div class="card"><h3>FunHub</h3><label class="field">Name shown on your posts</label><input class="in" id="au" value="' + esc(s.author || 'You') + '"></div>' +
      '<button class="btn primary block" id="sv">Save and connect</button>' +
      '<div class="card" style="margin-top:12px"><h3>Data</h3><p class="muted small">Hubs and FunHub posts live on this device. Your plan lives on the server.</p>' +
      '<button class="btn danger" id="wipe">Erase all Hub AI data on this device</button></div>' +
      '<p class="muted small" style="text-align:center">Hub AI ' + esc(HubBridge.version()) + ' · payments are a demo</p></div>';
    $('#sv').onclick = function () {
      var next = $('#url').value.trim();
      if (next && !/^https?:\/\//.test(next)) { toast('The address should start with https://'); return; }
      Store.set('settings', { cloudUrl: next, author: $('#au').value.trim() || 'You' });
      Store.set('cloud.me', null);
      if (!next) { renderSettings(); renderCredits(); return; }
      $('#cs').textContent = 'Connecting…';
      Cloud.refresh().then(function () { toast('Connected to Hub AI Cloud'); renderSettings(); renderCredits(); },
        function (e) { $('#cs').textContent = e.message; renderCredits(); });
    };
    $('#wipe').onclick = function () {
      openSheet('<h2>Erase everything?</h2><p>All hubs, FunHub posts and settings on this device are removed, and this device gets a new anonymous account.</p>' +
        '<div class="row"><button class="btn grow" data-x="no">Cancel</button><button class="btn danger grow" data-x="yes">Erase</button></div>', function (sh) {
        sh.querySelector('[data-x=no]').onclick = closeSheet;
        sh.querySelector('[data-x=yes]').onclick = function () {
          Store.clear(); state.draft = null; state.prompt = ''; state.engine = 'mini'; state.stack = [];
          closeSheet(); go('create', null, false); toast('All data erased'); sync();
        };
      });
    };
  }

  var VIEWS = { create: renderCreate, hubs: renderHubs, hub: renderHub, funhub: renderFunHub, agents: renderAgents, plans: renderPlans, settings: renderSettings };

  // ---------- wiring ----------

  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.onclick = function () {
      var to = b.getAttribute('data-go');
      if (b.parentNode.id === 'tabs') state.stack = [];
      go(to);
    };
  });
  $('#overlay').onclick = closeSheet;
  $('#playerClose').onclick = closePlayer;
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') back(); });

  // MainActivity calls this on the Android back button; "false" closes the app.
  window.HubApp = { back: back, go: go };

  render();
  sync();
})();
