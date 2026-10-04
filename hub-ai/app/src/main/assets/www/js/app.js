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

  function effective(o) { return Features.apply(o.html, o.powerups); }

  function exportHtml(hub) {
    HubBridge.save(slug(hub.title) + '.html', 'text/html', effective(hub)).then(toast, exportFailed);
  }

  function exportZip(hub) {
    var meta = { title: hub.title, engine: hub.engineName, prompt: hub.prompt, created: hub.created, app: 'Hub AI' };
    var readme = hub.title + '\n\nMade with Hub AI.\nOpen index.html in any browser. It works offline.\n';
    var data = Zip.zip([{ name: 'index.html', data: effective(hub) }, { name: 'hub.json', data: JSON.stringify(meta, null, 2) }, { name: 'README.txt', data: readme }]);
    HubBridge.save(slug(hub.title) + '.zip', 'application/zip', data).then(toast, exportFailed);
  }

  function shareHub(title, html) {
    HubBridge.share(slug(title) + '.html', 'text/html', html, title + ' — made with Hub AI. Open the file in a browser to use it.')
      .then(function (msg) { if (msg) toast(msg); },
            function (e) { if (e && e.name !== 'AbortError') toast('Could not share: ' + e.message); });
  }

  function hubAction(act, hub, after) {
    if (act === 'open') return openPlayer(hub.title, effective(hub));
    if (act === 'html') return exportHtml(hub);
    if (act === 'zip') return exportZip(hub);
    if (act === 'share') return shareHub(hub.title, effective(hub));
    if (act === 'publish') {
      if (FunHub.isPublished(hub.id)) { FunHub.unpublish(hub.id); toast('Removed from FunHub'); }
      else if (FunHub.publish(Object.assign({}, hub, { html: effective(hub) }), Store.get('settings', {}).author)) toast('Published to FunHub');
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

  // ---------- Features on a hub (the result card and saved hubs) ----------
  // A target is the unsaved draft ({kind: 'draft'}) or a saved hub
  // ({kind: 'hub', id}). Editing a saved draft also updates its saved copy.

  function getT(t) {
    var o = t.kind === 'draft' ? state.draft : hubById(t.id);
    if (o && !o.versions) o.versions = [{ label: 'Original', html: o.html, at: o.created || o.at || Date.now() }];
    if (o && !o.powerups) o.powerups = [];
    return o;
  }

  function putT(t, o) {
    if (t.kind === 'draft') {
      state.draft = o; Store.set('draft', o);
      if (o.savedId && hubById(o.savedId)) putT({ kind: 'hub', id: o.savedId }, Object.assign({}, hubById(o.savedId), {
        html: o.html, title: o.title, powerups: o.powerups, versions: o.versions }));
    } else {
      saveHubs(hubs().map(function (h) { return h.id === o.id ? o : h; }));
    }
  }

  function redraw(t) { if (t.kind === 'draft') renderResult(); else renderHub(t.id); }

  function featBtn(id, label, attrs) {
    var ok = Features.has(id), f = Features.info(id);
    return '<button class="btn small-btn' + (ok ? '' : ' locked') + '" data-feat="' + id + '"' + (attrs || '') + '>' +
      (ok ? '' : '<span class="lock">🔒</span>') + f.emoji + ' ' + esc(label || f.name) + '</button>';
  }

  // 📱 Device Flip: the preview at phone, tablet and desktop size.
  var DEVICES = { phone: [390, 720], tablet: [820, 1000], desktop: [1280, 800] };
  function previewBox(html, holder) {
    holder.innerHTML = '';
    var mode = state.device || 'fit';
    if (Features.has('deviceflip')) {
      var bar = document.createElement('div');
      bar.className = 'devbar';
      bar.innerHTML = ['fit', 'phone', 'tablet', 'desktop'].map(function (m) {
        return '<button class="chip' + (m === mode ? ' on' : '') + '" data-dev="' + m + '">' + { fit: 'Fit', phone: '📱 Phone', tablet: '📟 Tablet', desktop: '🖥️ Desktop' }[m] + '</button>';
      }).join('');
      holder.appendChild(bar);
      Array.prototype.forEach.call(bar.querySelectorAll('[data-dev]'), function (b) {
        b.onclick = function () { state.device = b.getAttribute('data-dev'); previewBox(html, holder); };
      });
    }
    var f = frame(html);
    if (mode === 'fit' || !DEVICES[mode]) { holder.appendChild(f); return; }
    var size = DEVICES[mode], stage = document.createElement('div');
    stage.className = 'devstage';
    holder.appendChild(stage);
    var scale = Math.min(1, stage.clientWidth / size[0]);
    f.style.cssText = 'width:' + size[0] + 'px;height:' + size[1] + 'px;transform:scale(' + scale + ');transform-origin:0 0';
    stage.style.height = Math.round(size[1] * scale) + 'px';
    stage.appendChild(f);
  }

  // Power-up chips and the tool buttons under a hub.
  function hubTools(o) {
    return '<div class="label-sm">Power-ups</div><div class="chips">' + Features.POWERUP_LIST.map(function (id) {
      var f = Features.info(id), ok = Features.has(id), on = o.powerups.indexOf(id) >= 0;
      return '<button class="chip' + (on && ok ? ' on' : '') + (ok ? '' : ' locked') + '" data-pow="' + id + '">' + (ok ? '' : '🔒 ') + f.emoji + ' ' + esc(f.name) + '</button>';
    }).join('') + '</div><div class="label-sm">Tools</div><div class="tools">' +
      featBtn('crazier', 'CRAZIER') + featBtn('translate', 'Translate') + featBtn('timemachine', 'Versions (' + o.versions.length + ')') +
      featBtn('dna', 'DNA') + featBtn('embed', 'Embed') + featBtn('lock', 'Lock') + featBtn('pwa', 'App') + '</div>';
  }

  function bindHubTools(root, t) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-pow]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-pow');
        if (!Features.has(id)) return upgrade(Features.needs(id));
        var o = getT(t), i = o.powerups.indexOf(id);
        if (i >= 0) o.powerups.splice(i, 1); else o.powerups.push(id);
        putT(t, o); redraw(t);
      };
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-feat]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-feat');
        if (!Features.has(id)) return upgrade(Features.needs(id));
        TOOLS[id](t);
      };
    });
  }

  function pickEngine() {
    var id = state.engine, bl = Plans.blocked(id);
    return bl && bl.reason === 'plan' ? 'mini' : id;
  }

  // Sends a hub back to the cloud (crazier / translate) and keeps the result
  // as a new version.
  function runCloud(t, mode, extra, label) {
    var o = getT(t), engine = pickEngine(), e = Plans.engine(engine);
    openSheet('<h2>' + esc(label) + '</h2><p class="muted"><span class="spinner"></span> ' + esc(e.name) + ' is on it…</p>');
    Cloud.generate(engine, extra.prompt || '', Object.assign({ mode: mode, html: o.html }, extra)).then(function (r) {
      o = getT(t);
      o.html = r.html;
      o.versions.push({ label: label, html: r.html, at: Date.now() });
      if (o.versions.length > 12) o.versions.splice(1, 1);
      putT(t, o); closeSheet(); redraw(t); renderCredits(); toast(label + ' ✓');
    }, function (err) {
      closeSheet();
      if (err.code === 'plan' || err.code === 'credits') upgrade(err.message); else toast(err.message);
    });
  }

  var TOOLS = {
    crazier: function (t) {
      openSheet('<h2>🤪 Make It CRAZIER</h2><p class="muted">The agent rebuilds this hub way wilder. Costs the same as a new hub.</p>' +
        '<label class="field">Any special craziness? (optional)</label><input class="in" id="cz" placeholder="e.g. everything is made of cheese">' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Go crazy</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () { runCloud(t, 'crazier', { prompt: s.querySelector('#cz').value.trim() }, '🤪 Crazier'); };
      });
    },
    translate: function (t) {
      openSheet('<h2>🌍 Translate Hub</h2><label class="field">Language</label><select class="in" id="lg">' +
        Features.LANGUAGES.map(function (l) { return '<option>' + l + '</option>'; }).join('') + '</select>' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Translate</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () { var l = s.querySelector('#lg').value; runCloud(t, 'translate', { lang: l }, '🌍 ' + l); };
      });
    },
    timemachine: function (t) {
      var o = getT(t);
      openSheet('<h2>🕰️ Time Machine</h2>' + o.versions.map(function (v, i) {
        var cur = v.html === o.html;
        return '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow">' + esc(v.label) + '<div class="muted small">' +
          new Date(v.at).toLocaleString() + '</div></span>' + (cur ? '<span class="tag ok">Now</span>' : '<button class="btn" data-v="' + i + '">Go back</button>') + '</div>';
      }).join('') + '<button class="btn block" data-x="no" style="margin-top:12px">Close</button>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        Array.prototype.forEach.call(s.querySelectorAll('[data-v]'), function (b) {
          b.onclick = function () { var o2 = getT(t); o2.html = o2.versions[+b.getAttribute('data-v')].html; putT(t, o2); closeSheet(); redraw(t); toast('Time travelled 🕰️'); };
        });
      });
    },
    dna: function (t) {
      var d = Features.dna(getT(t).html);
      var row = function (k, v) { return '<div class="row small" style="padding:4px 0"><span class="grow muted">' + k + '</span><b>' + v + '</b></div>'; };
      openSheet('<h2>🧬 Hub DNA</h2>' + (d.colors.length ? '<div class="swatches">' + d.colors.map(function (c) {
        return '<span class="sw" style="background:' + c + '" title="' + c + '"></span>'; }).join('') + '</div>' : '') +
        row('Title', esc(d.title || '–')) + row('Size', d.kb + ' KB') + row('Lines of code', d.lines) + row('Elements', d.elements) +
        row('Buttons', d.buttons) + row('Inputs', d.inputs) + row('Canvas', d.canvas ? 'yes' : 'no') + row('JavaScript', d.jsChars + ' characters') +
        row('CSS', d.cssChars + ' characters') + row('Remembers data', d.remembers ? 'yes' : 'no') + row('Animated', d.animates ? 'yes' : 'no') +
        '<button class="btn block" data-x="no" style="margin-top:12px">Close</button>', function (s) { s.querySelector('[data-x=no]').onclick = closeSheet; });
    },
    embed: function (t) {
      var o = getT(t), code = Features.embed(effective(o), o.title);
      openSheet('<h2>🧩 Embed Code</h2><p class="muted small">Paste this into any web page.</p><textarea class="in" id="em" readonly style="min-height:140px;font-family:monospace;font-size:12px"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" data-x="no">Close</button><button class="btn primary grow" data-x="cp">Copy</button></div>', function (s) {
        var ta = s.querySelector('#em'); ta.value = code;
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=cp]').onclick = function () {
          var done = function () { toast('Embed code copied'); };
          if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () { ta.select(); document.execCommand('copy'); done(); });
          else { ta.select(); document.execCommand('copy'); done(); }
        };
      });
    },
    lock: function (t) {
      openSheet('<h2>🔐 Password Lock</h2><p class="muted small">Exports this hub as a file that only opens with the password.</p>' +
        '<label class="field">Password</label><input class="in" id="p1" type="password"><label class="field">Again</label><input class="in" id="p2" type="password">' +
        '<p class="muted small" id="pe"></p><div class="row"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Lock and export</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () {
          var a = s.querySelector('#p1').value, b = s.querySelector('#p2').value;
          if (a.length < 4) { s.querySelector('#pe').textContent = 'Use at least 4 characters.'; return; }
          if (a !== b) { s.querySelector('#pe').textContent = 'The passwords don\'t match.'; return; }
          s.querySelector('#pe').innerHTML = '<span class="spinner"></span> Locking…';
          setTimeout(function () {
            var o = getT(t);
            HubBridge.save(slug(o.title) + '-locked.html', 'text/html', Features.lock(effective(o), a, o.title)).then(function (m) { closeSheet(); toast('🔐 ' + m); }, exportFailed);
          }, 30);
        };
      });
    },
    pwa: function (t) {
      var o = getT(t);
      var data = Zip.zip(Features.pwaFiles(effective(o), o.title, Features.brand().on ? Features.brand().color : null));
      HubBridge.save(slug(o.title) + '-app.zip', 'application/zip', data).then(function (m) { toast('📲 ' + m); }, exportFailed);
    }
  };

  // Several hubs side by side to pick from (⚔️ Battle and 🎰 Variations).
  function pickSheet(title, jobs) {
    openSheet('<h2>' + esc(title) + '</h2><div class="picks">' + jobs.map(function (j, i) {
      return '<div class="pick"><div class="small"><b>' + esc(j.label) + '</b></div><div class="pick-pv" id="pk' + i + '"><p class="muted small"><span class="spinner"></span> Building…</p></div>' +
        '<button class="btn block" data-pick="' + i + '" disabled>🏆 This one</button></div>';
    }).join('') + '</div><button class="btn block" data-x="no" style="margin-top:10px">Cancel</button>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
    });
    var results = [];
    jobs.forEach(function (j, i) {
      j.run().then(function (r) {
        results[i] = r;
        var box = document.getElementById('pk' + i);
        if (!box) return;
        box.innerHTML = ''; box.appendChild(frame(r.html, 'pick-frame'));
        var b = document.querySelector('[data-pick="' + i + '"]');
        b.disabled = false;
        b.onclick = function () { setDraft(r, state.prompt); closeSheet(); renderCreate(); toast('🏆 Winner saved as your hub'); };
        renderCredits();
      }, function (err) {
        var box = document.getElementById('pk' + i);
        if (box) box.innerHTML = '<p class="muted small">' + esc(err.message) + '</p>';
      });
    });
  }

  function setDraft(r, prompt) {
    state.draft = { title: r.title, html: r.html, engine: r.engine, engineName: r.engineName, seconds: r.seconds,
      prompt: prompt, at: Date.now(), powerups: [], versions: [{ label: 'Original', html: r.html, at: Date.now() }] };
    Store.set('draft', state.draft);
  }

  function battle() {
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) return toast('Describe the hub first.');
    var open = Plans.engines().filter(function (e) { return !Plans.blocked(e.id); });
    if (open.length < 2) return toast('You need two agents with credits left.');
    var opts = function (sel) { return open.map(function (e) { return '<option value="' + e.id + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join(''); };
    openSheet('<h2>⚔️ Hub Battle</h2><p class="muted small">Both agents build “' + esc(prompt.slice(0, 60)) + '”. Each costs its usual credits.</p>' +
      '<div class="row"><select class="in" id="ba">' + opts(open[0].id) + '</select><b>vs</b><select class="in" id="bb">' + opts(open[open.length > 2 ? 2 : 1].id) + '</select></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Fight!</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        var a = s.querySelector('#ba').value, b = s.querySelector('#bb').value, p = Features.brandPrompt(prompt);
        pickSheet('⚔️ ' + Plans.engine(a).name + ' vs ' + Plans.engine(b).name, [a, b].map(function (id) {
          return { label: Plans.engine(id).name, run: function () { return Cloud.generate(id, p); } };
        }));
      };
    });
  }

  function variations() {
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) return toast('Describe the hub first.');
    var id = pickEngine(), p = Features.brandPrompt(prompt);
    pickSheet('🎰 Variation Blaster', [1, 2, 3].map(function (n) {
      return { label: 'Version ' + n, run: function () { return Cloud.generate(id, p + (n > 1 ? '\n\n(Variation ' + n + ': make a different design choice.)' : '')); } };
    }));
  }

  function mashup() {
    var list = hubs();
    if (list.length < 2) return toast('Save at least two hubs first.');
    var opts = function (i) { return list.map(function (h, j) { return '<option value="' + h.id + '"' + (i === j ? ' selected' : '') + '>' + esc(h.title) + '</option>'; }).join(''); };
    openSheet('<h2>🧪 Hub Mashup</h2><p class="muted small">Fuse two hubs into a brand-new one.</p><select class="in" id="m1">' + opts(0) + '</select>' +
      '<div style="text-align:center;padding:6px">+</div><select class="in" id="m2">' + opts(1) + '</select>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Fuse!</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        var a = hubById(s.querySelector('#m1').value), b = hubById(s.querySelector('#m2').value);
        if (a.id === b.id) return toast('Pick two different hubs.');
        s.querySelector('[data-x=go]').innerHTML = '<span class="spinner"></span> Fusing…';
        Cloud.generate(pickEngine(), '', { mode: 'mashup', html: a.html, html2: b.html }).then(function (r) {
          setDraft(r, '🧪 ' + a.title + ' + ' + b.title); closeSheet(); state.stack = []; go('create'); renderCredits(); toast('🧪 Mashup ready');
        }, function (err) { closeSheet(); if (err.code === 'plan' || err.code === 'credits') upgrade(err.message); else toast(err.message); });
      };
    });
  }

  function brandKit() {
    var b = Features.brand();
    openSheet('<h2>🎨 Brand Kit</h2><p class="muted small">Every new hub uses your company name and colour.</p>' +
      '<label class="field">Company name</label><input class="in" id="bn" value="' + esc(b.name) + '" placeholder="Acme Inc.">' +
      '<label class="field">Brand colour</label><input class="in" id="bc" type="color" value="' + esc(b.color) + '" style="height:46px">' +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="bo"' + (b.on ? ' checked' : '') + '> Use on new hubs</label>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Save</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        Store.set('brandkit', { on: s.querySelector('#bo').checked, name: s.querySelector('#bn').value.trim(), color: s.querySelector('#bc').value });
        closeSheet(); toast('🎨 Brand Kit saved'); if (state.view === 'features') renderFeatures();
      };
    });
  }

  // ---------- Create ----------
  // ---------- Create ----------

  function engineRow(e) {
    var blocked = Plans.blocked(e.id);
    var planLock = blocked && blocked.reason === 'plan';
    var lim = Plans.limitLeft(e.id);
    var meta = e.secret ? 'Top secret. Don\'t tell anyone.' : '';
    if (lim !== null) meta += (meta ? ' · ' : '') + lim + ' left today';
    var tag = e.secret ? '🤫 ' : planLock ? '🔒 ' : '';
    return '<button class="engine' + (state.engine === e.id ? ' on' : '') + (planLock ? ' off' : '') + '" data-engine="' + e.id + '">' +
      '<span class="dot"></span><span><div>' + tag + esc(e.name) + '</div>' + (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</span>' +
      '<span class="cost">' + e.cost + ' credit' + (e.cost > 1 ? 's' : '') + '</span></button>';
  }

  function renderCreate() {
    var c = Plans.credits();
    var status = !Cloud.configured()
      ? '<div class="note">Hub agents run in Hub AI Cloud. Add your server address in <a href="#" id="toSettings">Settings</a> to start generating.</div>'
      : '<p class="muted small" style="margin:8px 0 0">' + (c.left === null ? 'Connecting…' : c.left + ' credits left') + ' · ' +
        esc(Plans.plan().name) + (c.rule ? ' (' + esc(c.rule) + ')' : '') + '</p>';
    var ch = Features.has('challenge') ? Features.challenge() : null;
    var challengeCard = ch ? '<div class="card challenge"><div class="row"><div class="grow"><div class="label-sm">🔥 Today\'s challenge' +
      (ch.streak ? ' · ' + ch.streak + ' day streak' : '') + '</div><b>' + esc(ch.prompt) + '</b></div>' +
      (ch.doneToday ? '<span class="tag ok">Done ✓</span>' : '<button class="btn" id="acc">Accept</button>') + '</div></div>' : '';
    view.innerHTML = '<div class="wrap">' + challengeCard +
      '<div class="card"><h2>Create a hub</h2>' +
      '<textarea class="in" id="prompt" placeholder="Describe the app you want, e.g. a habit tracker for drinking water">' + esc(state.prompt) + '</textarea>' +
      '<div class="chips"><button class="chip surprise' + (Features.has('surprise') ? '' : ' locked') + '" id="sur">🎲 Surprise Me</button>' +
      EXAMPLES.map(function (x) { return '<button class="chip" data-ex="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<label class="field">Agent</label><div class="engines">' + Plans.engines().map(engineRow).join('') + '</div>' +
      '<button class="btn primary block" id="gen" style="margin-top:12px">' + (state.busy ? '<span class="spinner"></span> Generating…' : 'Generate') + '</button>' +
      '<div class="row" style="margin-top:8px">' + featBtn('battle', 'Battle', ' style="flex:1"') + featBtn('variations', '×3 Variations', ' style="flex:1"') + '</div>' +
      status + '</div><div id="result"></div></div>';

    var p = $('#prompt');
    p.oninput = function () { state.prompt = p.value; Store.set('promptDraft', p.value); };
    Array.prototype.forEach.call(view.querySelectorAll('[data-ex]'), function (b) {
      b.onclick = function () { p.value = state.prompt = b.getAttribute('data-ex'); Store.set('promptDraft', p.value); };
    });
    Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-engine'), bl = Plans.blocked(id);
        if (bl && bl.reason === 'plan') return upgrade(bl.text);
        state.engine = id; Store.set('engine', id);
        Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (x) { x.classList.toggle('on', x === b); });
      };
    });
    $('#gen').onclick = generate;
    $('#sur').onclick = function () {
      if (!Features.has('surprise')) return upgrade(Features.needs('surprise'));
      p.value = state.prompt = Features.surprise(); Store.set('promptDraft', p.value);
      p.classList.remove('wiggle'); void p.offsetWidth; p.classList.add('wiggle');
    };
    var acc = $('#acc');
    if (acc) acc.onclick = function () { p.value = state.prompt = ch.prompt; state.challenge = ch.prompt; Store.set('promptDraft', p.value); p.focus(); toast('🔥 Challenge accepted. Pick an agent and hit Generate.'); };
    Array.prototype.forEach.call(view.querySelectorAll('.wrap > .card [data-feat]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-feat');
        if (!Features.has(id)) return upgrade(Features.needs(id));
        if (!Cloud.configured()) { go('settings'); return toast('Add your Hub AI Cloud server first.'); }
        (id === 'battle' ? battle : variations)();
      };
    });
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
      '<div class="muted small">' + esc(d.engineName) + (d.seconds ? ' · ' + d.seconds + ' s' : '') + '</div></div>' +
      '<button class="btn" data-act="open">Full screen</button></div>' +
      (d.notes || []).map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('') +
      '<div id="pv" style="margin-top:10px"></div>' +
      '<div class="actions">' +
      (saved ? '<button class="btn" id="saved">Saved ✓</button>' : '<button class="btn' + (Plans.can('save') ? '' : ' locked') + '" id="save">' + (Plans.can('save') ? '' : '<span class="lock">🔒</span>') + 'Save</button>') +
      lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(saved && FunHub.isPublished(saved.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') +
      lockBtn('Share', 'export:html', 'share') +
      '<button class="btn" id="discard">Discard</button></div>' + hubTools(getT({ kind: 'draft' })) + '</div>';
    previewBox(effective(d), $('#pv'));
    bindHubTools(box, { kind: 'draft' });

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
    box.querySelector('[data-act=open]').onclick = function () { openPlayer(d.title, effective(d)); };
  }

  function saveDraft() {
    var d = state.draft;
    if (d.savedId && hubById(d.savedId)) return d.savedId;
    var hub = { id: uid(), title: d.title, html: d.html, engine: d.engine, engineName: d.engineName, prompt: d.prompt, created: Date.now(),
      powerups: (d.powerups || []).slice(), versions: (d.versions || []).slice() };
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
    Cloud.generate(id, Features.brandPrompt(prompt)).then(function (r) {
      setDraft(r, prompt);
      if (state.challenge && state.challenge === prompt && Features.has('challenge')) {
        var n = Features.completeChallenge();
        state.challenge = null;
        setTimeout(function () { toast('🔥 Challenge done! ' + n + ' day streak'); }, 300);
      }
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
    view.innerHTML = '<div class="wrap"><div class="row"><h2 class="grow">Your hubs</h2>' + featBtn('mashup', 'Mashup') + '</div>' + (list.length ? list.map(function (h) {
      return '<button class="hub-item" data-id="' + h.id + '"><span class="thumb">' + esc(h.title.charAt(0).toUpperCase()) + '</span>' +
        '<span class="grow"><div class="t">' + esc(h.title) + '</div><div class="muted small">' + esc(h.engineName) + ' · ' + fmtDate(h.created) +
        (FunHub.isPublished(h.id) ? ' · on FunHub' : '') + '</div></span></button>';
    }).join('') : '<div class="card empty">No hubs yet. Make one on the Create tab.</div>') + '</div>';
    Array.prototype.forEach.call(view.querySelectorAll('[data-id]'), function (b) {
      b.onclick = function () { go('hub', b.getAttribute('data-id')); };
    });
    view.querySelector('[data-feat=mashup]').onclick = function () {
      if (!Features.has('mashup')) return upgrade(Features.needs('mashup'));
      mashup();
    };
  }

  function renderHub(id) {
    var h = hubById(id);
    if (!h || !Plans.can('save')) { state.view = 'hubs'; renderHubs(); return; }
    view.innerHTML = '<div class="wrap"><div class="card"><input class="in" id="title" value="' + esc(h.title) + '" aria-label="Hub title">' +
      '<div class="muted small" style="margin:8px 0">' + esc(h.engineName) + ' · ' + fmtDate(h.created) + (h.prompt ? ' · “' + esc(h.prompt.slice(0, 80)) + '”' : '') + '</div>' +
      '<div id="pv"></div><div class="actions">' +
      '<button class="btn" data-act="open">Full screen</button>' + lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(FunHub.isPublished(h.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') + lockBtn('Share', 'export:html', 'share') +
      '<button class="btn danger" id="del">Delete</button></div>' + hubTools(getT({ kind: 'hub', id: id })) + '</div></div>';
    previewBox(effective(h), $('#pv'));
    bindHubTools(view, { kind: 'hub', id: id });
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

  // ---------- Features ----------

  function renderFeatures() {
    var all = Plans.plans(), cur = Plans.plan();
    var html = '<div class="wrap"><h2>🤯 Features</h2><p class="muted small">20 CRAEYYYYZAEYYYY and UNBELAIVABULLL extras. Five come with every plan.</p>';
    ['free', 'go', 'plus', 'enterprise'].forEach(function (pid) {
      html += '<div class="label-sm" style="margin-top:14px">' + esc(all[pid].name) + '</div>';
      Features.catalog().filter(function (f) { return f.plan === pid; }).forEach(function (f) {
        var ok = Features.has(f.id);
        html += '<div class="card feat' + (ok ? '' : ' off') + '"><div class="row"><span class="femoji">' + f.emoji + '</span><div class="grow"><b>' + esc(f.name) + '</b>' +
          '<div class="muted small">' + esc(f.desc) + '</div></div>' +
          (ok ? (FEATURE_GO[f.id] ? '<button class="btn" data-go-feat="' + f.id + '">' + FEATURE_GO[f.id][0] + '</button>' : '<span class="tag ok">On</span>')
            : '<button class="btn" data-up="' + f.plan + '">🔒 ' + esc(all[f.plan].name.replace('Hub ', '')) + '</button>') + '</div></div>';
      });
    });
    if (cur.id !== 'enterprise') html += '<p class="muted small" style="text-align:center;margin-top:16px">🤫 Enterprise also unlocks something we can\'t talk about.</p>';
    view.innerHTML = html + '</div>';
    Array.prototype.forEach.call(view.querySelectorAll('[data-up]'), function (b) { b.onclick = function () { go('plans'); }; });
    Array.prototype.forEach.call(view.querySelectorAll('[data-go-feat]'), function (b) {
      b.onclick = function () { FEATURE_GO[b.getAttribute('data-go-feat')][1](); };
    });
  }

  // Features that can be started from the Features tab: [button, action].
  var tryOnHub = ['Try it', function () { go('create'); toast('Make or open a hub, then use it under the preview.'); }];
  var FEATURE_GO = {
    surprise: ['Try it', function () { go('create'); setTimeout(function () { $('#sur').click(); }, 0); }],
    challenge: ['Today', function () { go('create'); }],
    battle: ['Try it', function () { go('create'); toast('Describe a hub, then tap ⚔️ Battle.'); }],
    variations: ['Try it', function () { go('create'); toast('Describe a hub, then tap 🎰 ×3 Variations.'); }],
    mashup: ['Try it', function () { go('hubs'); }],
    brandkit: ['Set up', brandKit],
    confetti: tryOnHub, catwalk: tryOnHub, upsidedown: tryOnHub, deviceflip: tryOnHub, rainbow: tryOnHub, sounds: tryOnHub,
    dna: tryOnHub, embed: tryOnHub, crazier: tryOnHub, timemachine: tryOnHub, translate: tryOnHub, nowatermark: tryOnHub,
    lock: tryOnHub, pwa: tryOnHub
  };

  // ---------- Plans ----------

  function renderPlans() {
    var me = Plans.me(), cur = Plans.plan(), c = Plans.credits(), all = Plans.plans();
    var html = '<div class="wrap"><h2>Plans</h2><div class="demo-banner">Demo payments: nothing is charged and no card details leave this screen.</div>' +
      '<div class="card"><div class="muted small">Current plan</div><h3>' + esc(cur.name) + '</h3><div>' +
      (c.left === null ? (Cloud.configured() ? 'Connecting to Hub AI Cloud…' : 'Not connected to Hub AI Cloud') : c.left + ' credits available · ' + esc(c.rule)) + '</div>' +
      (me && me.renews ? '<div class="muted small" style="margin-top:4px">' + (me.cancelled ? 'Ends' : 'Renews') + ' ' + fmtDate(me.renews) + ' (demo)</div>' : '') +
      (me && me.plan !== 'free' && !me.cancelled ? '<button class="btn" id="cancel" style="margin-top:10px">Cancel plan</button>' : '') + '</div>';
    ['free', 'go', 'plus', 'enterprise'].forEach(function (id) {
      var p = all[id], here = id === cur.id;
      var price = p.price ? '$' + p.price.toLocaleString('en-US') + ' / ' + p.period : 'Free';
      var btn = here ? '<button class="btn block" disabled>Current plan</button>'
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
    var amount = '$' + p.price.toLocaleString('en-US', { minimumFractionDigits: 2 });
    openSheet('<h2>' + esc(p.name) + ' · $' + p.price.toLocaleString('en-US') + ' / ' + p.period + '</h2>' +
      (p.id === 'enterprise' ? '<p class="muted small">For very large companies. About one person\'s yearly salary per seat. 🤫 Includes a top-secret model.</p>' : '') +
      '<div class="demo-banner">Demo checkout. No payment is taken; the test card below is filled in for you.</div>' +
      '<label class="field">Card number</label><input class="in" id="cc" inputmode="numeric" value="4242 4242 4242 4242" autocomplete="off">' +
      '<div class="row"><div class="grow"><label class="field">Expiry</label><input class="in" id="ex" value="12 / 34" autocomplete="off"></div>' +
      '<div class="grow"><label class="field">CVC</label><input class="in" id="cv" inputmode="numeric" value="123" autocomplete="off"></div></div>' +
      '<label class="field">Name on card</label><input class="in" id="nm" value="Demo User" autocomplete="off">' +
      '<p class="muted small" id="err" style="margin-top:8px"></p>' +
      '<div class="row"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" id="pay">Pay ' + amount + ' (demo)</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('#pay').onclick = function () {
        var num = s.querySelector('#cc').value.replace(/\D/g, '');
        if (!luhn(num)) { s.querySelector('#err').textContent = 'That card number doesn\'t look right. Use 4242 4242 4242 4242.'; return; }
        if (!/^\d{3,4}$/.test(s.querySelector('#cv').value.trim())) { s.querySelector('#err').textContent = 'CVC should be 3 or 4 digits.'; return; }
        var b = this; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Processing…';
        // Only the plan goes to the server; the card details never leave this sheet.
        Cloud.subscribe(id).then(function () { subscribed(p); }, function (e) {
          b.disabled = false; b.textContent = 'Pay ' + amount + ' (demo)';
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

  var VIEWS = { create: renderCreate, hubs: renderHubs, hub: renderHub, funhub: renderFunHub, features: renderFeatures, plans: renderPlans, settings: renderSettings };

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
