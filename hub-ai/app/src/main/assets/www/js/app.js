/* Hub AI user interface. */
(function () {
  'use strict';

  var esc = HubTemplates.esc;
  var view = document.getElementById('view');
  var state = {
    view: 'create', arg: null, stack: [],
    engine: Store.get('engine', 'flux'),
    kind: Store.get('kind', 'app'),     // what to create (Kinds)
    photo: null,                        // a photo to edit (image kind)
    prompt: Store.get('promptDraft', ''),
    draft: Store.get('draft', null),   // last generated, unsaved hub
    busy: false
  };

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
    if (WhatsNew.isOpen()) { WhatsNew.close(); return true; }
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

  // 📱 Device Preview: the hub at phone, tablet and desktop size.
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

  // Export options and the tool buttons under a hub.
  function hubTools(o) {
    return '<div class="label-sm">Export options</div><div class="chips">' + Features.OPTION_LIST.map(function (id) {
      var f = Features.info(id), ok = Features.has(id), on = o.powerups.indexOf(id) >= 0;
      return '<button class="chip' + (on && ok ? ' on' : '') + (ok ? '' : ' locked') + '" data-pow="' + id + '" aria-pressed="' + (on && ok) + '">' +
        (ok ? (on ? '✓ ' : '') : '🔒 ') + f.emoji + ' ' + esc(Features.OPTION_LABEL[id]) + '</button>';
    }).join('') + '</div><div class="label-sm">Tools</div><div class="tools">' +
      [['refine', Kinds.output(hubKind(o)) === 'image' ? 'Edit photo with AI' : 'Edit with AI'], ['a11y', 'Accessibility'], ['source', 'Source'],
        ['timemachine', 'Versions (' + o.versions.length + ')'], ['editor', 'Code editor'], ['seo', 'SEO'], ['dna', 'Performance'],
        ['embed', 'Embed'], ['translate', 'Translate'], ['autofix', 'AI Bug Fix'], ['security', 'Security scan'], ['lock', 'Password'],
        ['pwa', 'Installable app']].filter(function (x) { return Kinds.toolOk(hubKind(o), x[0]); }).map(function (x) { return featBtn(x[0], x[1]); }).join('') + '</div>';
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

  function hubKind(o) { return (o && o.kind) || 'app'; }

  // The agent to use for this kind: the chosen one if it can, else the
  // first one the plan allows.
  function pickEngine(kindId) {
    var list = Kinds.engines(kindId || state.kind);
    var ok = function (id) { var bl = Plans.blocked(id); return list.some(function (e) { return e.id === id; }) && !(bl && bl.reason === 'plan'); };
    if (ok(state.engine)) return state.engine;
    var first = list.filter(function (e) { return ok(e.id); })[0];
    return (first || list[0]).id;
  }

  // Keeps html as the hub's new current version.
  function addVersion(t, html, label) {
    var o = getT(t);
    o.html = html;
    var m = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
    if (m && t.kind === 'draft') o.title = m[1].trim();
    o.versions.push({ label: label, html: html, at: Date.now() });
    if (o.versions.length > 30) o.versions.splice(1, 1);
    putT(t, o);
  }

  // Sends a hub back to the cloud (edit / fix / translate) and keeps the
  // result as a new version.
  function runCloud(t, mode, extra, label) {
    if (!Cloud.configured()) { go('settings'); return toast('Add your Hub AI Cloud server first.'); }
    var o = getT(t), k = hubKind(o), engine = pickEngine(k), e = Plans.engine(engine);
    openSheet('<h2>' + esc(label) + '</h2><p class="muted" role="status"><span class="spinner"></span> ' + esc(e.name) + ' is working on it…</p>');
    var body = Object.assign({ mode: mode, kind: k }, Kinds.output(k) === 'image' ? {} : { html: o.html }, extra);
    Cloud.generate(engine, extra.prompt || '', body).then(function (r) {
      addVersion(t, r.html, label);
      closeSheet(); redraw(t); renderCredits(); toast(label + ' ✓');
    }, function (err) {
      closeSheet();
      if (err.code === 'plan' || err.code === 'credits') upgrade(err.message); else toast(err.message);
    });
  }

  function copyText(text, ta, what) {
    var done = function () { toast(what + ' copied'); };
    var fallback = function () { ta.select(); document.execCommand('copy'); done(); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  function issueList(items, levels) {
    if (!items.length) return '<div class="note ok">No problems found.</div>';
    return '<ul class="issues">' + items.map(function (i) {
      return '<li class="issue ' + i.level + '"><span class="tag ' + i.level + '">' + esc(levels[i.level]) + (i.n > 1 ? ' × ' + i.n : '') + '</span>' +
        '<div>' + esc(i.msg) + (i.how ? '<div class="muted small">' + esc(i.how) + '</div>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }

  var TOOLS = {
    refine: function (t) {
      openSheet('<h2>✏️ Edit with AI</h2><p class="muted small">Describe the change. The agent updates the hub and keeps the current version in the history. Costs the agent\'s usual credits.</p>' +
        '<label class="field" for="rf">Change</label><textarea class="in" id="rf" placeholder="e.g. Add a dark/light mode switch and sort the list by date"></textarea>' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Apply change</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('#rf').focus();
        s.querySelector('[data-x=go]').onclick = function () {
          var change = s.querySelector('#rf').value.trim();
          if (!change) return toast('Describe the change first.');
          var o = getT(t);
          if (Kinds.output(hubKind(o)) === 'image') return runCloud(t, 'create', { prompt: change.slice(0, 3900), image: Kinds.imageOf(o.html) }, '✏️ ' + change.slice(0, 40));
          runCloud(t, 'refine', { prompt: change.slice(0, 3900) }, '✏️ ' + change.slice(0, 40));
        };
      });
    },
    translate: function (t) {
      openSheet('<h2>🌍 Translate</h2><label class="field" for="lg">Language</label><select class="in" id="lg">' +
        Features.LANGUAGES.map(function (l) { return '<option>' + l + '</option>'; }).join('') + '</select>' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Translate</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () { var l = s.querySelector('#lg').value; runCloud(t, 'translate', { lang: l }, '🌍 ' + l); };
      });
    },
    autofix: function (t, issues) {
      var known = issues || Features.a11y(getT(t).html).map(function (i) { return '- ' + i.msg; });
      openSheet('<h2>🩺 AI Bug Fix</h2><p class="muted small">The agent reviews the hub for bugs, broken interactions, accessibility and small-screen problems and fixes them. ' +
        'The result is saved as a new version. Costs the agent\'s usual credits.</p>' +
        (known.length ? '<p class="small">It will also fix the ' + known.length + ' problem' + (known.length > 1 ? 's' : '') + ' the Accessibility Check found.</p>' : '') +
        '<label class="field" for="fx">Anything specific? (optional)</label><input class="in" id="fx" placeholder="e.g. The total is wrong when a discount is added">' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Review and fix</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () {
          var note = s.querySelector('#fx').value.trim();
          var prompt = (note ? 'The user reports: ' + note + '\n' : '') + (known.length ? 'Also fix these problems:\n' + known.join('\n') : '');
          runCloud(t, 'fix', { prompt: prompt.slice(0, 3900) }, '🩺 Bug fix');
        };
      });
    },
    timemachine: function (t) {
      var o = getT(t);
      openSheet('<h2>🕘 Version History</h2><p class="muted small">' + o.versions.length + ' version' + (o.versions.length > 1 ? 's' : '') + ', newest last.</p>' + o.versions.map(function (v, i) {
        var cur = v.html === o.html;
        return '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="grow">' + esc(v.label) + '<div class="muted small">' +
          new Date(v.at).toLocaleString() + ' · ' + Math.round(new Blob([v.html]).size / 102.4) / 10 + ' KB</div></span>' +
          '<button class="btn" data-pv="' + i + '">Preview</button>' +
          (cur ? '<span class="tag ok">Current</span>' : '<button class="btn" data-v="' + i + '">Restore</button>') + '</div>';
      }).join('') + '<button class="btn block" data-x="no" style="margin-top:12px">Close</button>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        Array.prototype.forEach.call(s.querySelectorAll('[data-pv]'), function (b) {
          b.onclick = function () { var v = getT(t).versions[+b.getAttribute('data-pv')]; openPlayer(v.label, v.html); };
        });
        Array.prototype.forEach.call(s.querySelectorAll('[data-v]'), function (b) {
          b.onclick = function () {
            var v = getT(t).versions[+b.getAttribute('data-v')];
            addVersion(t, v.html, 'Restored: ' + v.label); closeSheet(); redraw(t); toast('Version restored');
          };
        });
      });
    },
    source: function (t) {
      var o = getT(t), html = o.html;
      openSheet('<h2>🧾 Source Code</h2><p class="muted small">' + html.split('\n').length + ' lines · ' + Math.round(new Blob([html]).size / 102.4) / 10 + ' KB</p>' +
        '<textarea class="in code" id="src" readonly aria-label="HTML source"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" data-x="no">Close</button><button class="btn primary grow" data-x="cp">Copy</button></div>', function (s) {
        var ta = s.querySelector('#src'); ta.value = html;
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=cp]').onclick = function () { copyText(html, ta, 'Source'); };
      });
    },
    editor: function (t) {
      var o = getT(t);
      openSheet('<h2>⌨️ Code Editor</h2><p class="muted small">Saving keeps the current version in the history.</p>' +
        '<textarea class="in code tall" id="ed" spellcheck="false" aria-label="HTML"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" data-x="no">Cancel</button><button class="btn" data-x="pv">Preview</button>' +
        '<button class="btn primary grow" data-x="go">Save</button></div>', function (s) {
        var ta = s.querySelector('#ed'); ta.value = o.html;
        ta.onkeydown = function (e) {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          var a = ta.selectionStart; ta.setRangeText('  ', a, ta.selectionEnd, 'end');
        };
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=pv]').onclick = function () { openPlayer('Preview', ta.value); };
        s.querySelector('[data-x=go]').onclick = function () {
          if (ta.value === getT(t).html) return closeSheet();
          if (!/<html|<body|<!doctype/i.test(ta.value)) return toast('That does not look like an HTML document.');
          addVersion(t, ta.value, '⌨️ Edited by hand'); closeSheet(); redraw(t); toast('Saved');
        };
      });
    },
    seo: function (t) {
      var cur = Features.seoRead(getT(t).html);
      openSheet('<h2>🔎 SEO & Share Tags</h2><p class="muted small">Used by search engines and in link previews (messages, social media) when the hub is published on a website.</p>' +
        '<label class="field" for="st">Page title <span class="muted" id="stc"></span></label><input class="in" id="st" maxlength="70">' +
        '<label class="field" for="sd">Description <span class="muted" id="sdc"></span></label><textarea class="in" id="sd" maxlength="200" style="min-height:70px"></textarea>' +
        '<label class="field" for="sc">Browser bar colour</label><input class="in" id="sc" type="color" style="height:46px">' +
        '<div class="serp"><div class="serp-t" id="pt"></div><div class="serp-d" id="pd"></div></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Save tags</button></div>', function (s) {
        var st = s.querySelector('#st'), sd = s.querySelector('#sd'), sc = s.querySelector('#sc');
        st.value = cur.title; sd.value = cur.description; sc.value = /^#[0-9a-f]{6}$/i.test(cur.color) ? cur.color : '#0d0d0d';
        var upd = function () {
          s.querySelector('#stc').textContent = st.value.length + '/60'; s.querySelector('#sdc').textContent = sd.value.length + '/160';
          s.querySelector('#pt').textContent = st.value || 'Untitled'; s.querySelector('#pd').textContent = sd.value || 'No description.';
        };
        st.oninput = sd.oninput = upd; upd();
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () {
          if (!st.value.trim()) return toast('Give the page a title.');
          addVersion(t, Features.seoApply(getT(t).html, { title: st.value.trim(), description: sd.value.trim(), color: sc.value }), '🔎 SEO tags');
          closeSheet(); redraw(t); toast('Tags saved');
        };
      });
    },
    a11y: function (t) {
      var items = Features.a11y(getT(t).html), errors = items.filter(function (i) { return i.level === 'error'; }).length;
      openSheet('<h2>♿ Accessibility Check</h2><p class="muted small">' + (items.length ? errors + ' error' + (errors === 1 ? '' : 's') + ', ' +
        (items.length - errors) + ' warning' + (items.length - errors === 1 ? '' : 's') + '. Automatic checks find many problems, not all of them; test with a screen reader too.' : 'Automatic checks passed.') + '</p>' +
        issueList(items, { error: 'Error', warning: 'Warning' }) +
        '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Close</button>' +
        (items.length ? '<button class="btn primary grow' + (Features.has('autofix') ? '' : ' locked') + '" data-x="fix">' + (Features.has('autofix') ? '' : '🔒 ') + '🩺 Fix with AI</button>' : '') + '</div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        var fx = s.querySelector('[data-x=fix]');
        if (fx) fx.onclick = function () {
          if (!Features.has('autofix')) return upgrade(Features.needs('autofix'));
          TOOLS.autofix(t, items.map(function (i) { return '- ' + i.msg + (i.how ? ' ' + i.how : ''); }));
        };
      });
    },
    dna: function (t) {
      var d = Features.report(effective(getT(t)));
      var row = function (k, v) { return '<div class="row small" style="padding:4px 0"><span class="grow muted">' + k + '</span><b>' + v + '</b></div>'; };
      openSheet('<h2>📊 Performance Report</h2>' +
        (d.warnings.length ? '<ul class="issues">' + d.warnings.map(function (w) { return '<li class="issue warning"><span class="tag warning">Check</span><div>' + esc(w) + '</div></li>'; }).join('') + '</ul>'
          : '<div class="note ok">Light and self-contained: no problems found.</div>') +
        row('File size', d.kb + ' KB') + row('JavaScript', d.jsKb + ' KB') + row('CSS', d.cssKb + ' KB') + row('Embedded media', d.mediaKb + ' KB') +
        row('Elements', d.elements) + row('Nesting depth', d.depth) + row('Lines', d.lines) + row('Inline event handlers', d.handlers) +
        row('External requests', d.external.length) + row('Saves data on the device', d.storage ? 'yes' : 'no') + row('Works offline', d.external.length || d.network ? 'no' : 'yes') +
        (d.external.length ? '<details class="small" style="margin-top:8px"><summary>External requests</summary><ul>' + d.external.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<button class="btn block" data-x="no" style="margin-top:12px">Close</button>', function (s) { s.querySelector('[data-x=no]').onclick = closeSheet; });
    },
    security: function (t) {
      var o = getT(t), items = Features.scan(o.html), on = o.powerups.indexOf('security') >= 0;
      openSheet('<h2>🛡️ Security Scan</h2>' + issueList(items, { high: 'High', medium: 'Medium', low: 'Low' }) +
        '<div class="card" style="margin-top:12px"><b>Lockdown</b><p class="muted small">Exports get a Content-Security-Policy that blocks every network request, form submission and external file, ' +
        'so the hub cannot send data anywhere. Features that need the internet will stop working.</p>' +
        '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ld"' + (on ? ' checked' : '') + '> Block network access in exports</label></div>' +
        '<button class="btn block" data-x="no" style="margin-top:12px">Done</button>', function (s) {
        s.querySelector('[data-x=no]').onclick = function () {
          var o2 = getT(t), want = s.querySelector('#ld').checked, i = o2.powerups.indexOf('security');
          if (want && i < 0) o2.powerups.push('security');
          if (!want && i >= 0) o2.powerups.splice(i, 1);
          putT(t, o2); closeSheet(); redraw(t);
        };
      });
    },
    embed: function (t) {
      var o = getT(t), code = Features.embed(effective(o), o.title);
      openSheet('<h2>🧩 Embed Code</h2><p class="muted small">Paste this into any web page. The hub runs in a sandbox and cannot reach the host page.</p>' +
        '<textarea class="in code" id="em" readonly aria-label="Embed code"></textarea>' +
        '<div class="row" style="margin-top:10px"><button class="btn" data-x="no">Close</button><button class="btn primary grow" data-x="cp">Copy</button></div>', function (s) {
        var ta = s.querySelector('#em'); ta.value = code;
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=cp]').onclick = function () { copyText(code, ta, 'Embed code'); };
      });
    },
    lock: function (t) {
      openSheet('<h2>🔐 Password Protection</h2><p class="muted small">Exports this hub encrypted. It only opens with the password, and the password cannot be recovered.</p>' +
        '<label class="field" for="p1">Password</label><input class="in" id="p1" type="password" autocomplete="new-password">' +
        '<label class="field" for="p2">Repeat password</label><input class="in" id="p2" type="password" autocomplete="new-password">' +
        '<p class="muted small" id="pe" role="status"></p><div class="row"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Encrypt and export</button></div>', function (s) {
        s.querySelector('[data-x=no]').onclick = closeSheet;
        s.querySelector('[data-x=go]').onclick = function () {
          var a = s.querySelector('#p1').value, b = s.querySelector('#p2').value;
          if (a.length < 8) { s.querySelector('#pe').textContent = 'Use at least 8 characters.'; return; }
          if (a !== b) { s.querySelector('#pe').textContent = 'The passwords don\'t match.'; return; }
          s.querySelector('#pe').innerHTML = '<span class="spinner"></span> Encrypting…';
          setTimeout(function () {
            var o = getT(t);
            HubBridge.save(slug(o.title) + '-protected.html', 'text/html', Features.lock(effective(o), a, o.title)).then(function (m) { closeSheet(); toast('🔐 ' + m); }, exportFailed);
          }, 30);
        };
      });
    },
    pwa: function (t) {
      var o = getT(t);
      var data = Zip.zip(Features.pwaFiles(Features.apply(o.html, o.powerups, { pwa: true }), o.title, Features.brand().on ? Features.brand().color : null));
      HubBridge.save(slug(o.title) + '-app.zip', 'application/zip', data).then(function (m) { toast('📲 ' + m); }, exportFailed);
    }
  };

  // Several hubs side by side to pick from (Compare Agents, Multiple Drafts).
  function pickSheet(title, jobs) {
    openSheet('<h2>' + esc(title) + '</h2><div class="picks">' + jobs.map(function (j, i) {
      return '<div class="pick"><div class="small"><b>' + esc(j.label) + '</b></div><div class="pick-pv" id="pk' + i + '"><p class="muted small"><span class="spinner"></span> Building…</p></div>' +
        '<button class="btn block" data-pick="' + i + '" disabled>Keep this one</button></div>';
    }).join('') + '</div><button class="btn block" data-x="no" style="margin-top:10px">Cancel</button>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
    });
    jobs.forEach(function (j, i) {
      j.run().then(function (r) {
        var box = document.getElementById('pk' + i);
        if (!box) return;
        box.innerHTML = ''; box.appendChild(frame(r.html, 'pick-frame'));
        var b = document.querySelector('[data-pick="' + i + '"]');
        b.disabled = false;
        b.onclick = function () { setDraft(r, state.prompt); closeSheet(); renderCreate(); toast('Kept ' + j.label); };
        renderCredits();
      }, function (err) {
        var box = document.getElementById('pk' + i);
        if (box) box.innerHTML = '<p class="muted small">' + esc(err.message) + '</p>';
      });
    });
  }

  function setDraft(r, prompt) {
    state.draft = { title: r.title, html: r.html, engine: r.engine, engineName: r.engineName, seconds: r.seconds, kind: r.kind || state.kind,
      prompt: prompt, at: Date.now(), powerups: [], versions: [{ label: 'Original', html: r.html, at: Date.now() }] };
    Store.set('draft', state.draft);
  }

  // What goes with every new request: the kind, and the attached data file
  // (Data Import) or the photo to edit.
  function newExtra() {
    var x = Object.assign({ kind: state.kind }, dataExtra());
    if (Kinds.output(state.kind) === 'image' && state.photo) x.image = state.photo.dataUrl;
    return x;
  }

  // The attached data file (Data Import) goes with every new hub request.
  function dataExtra() {
    var d = state.data;
    return d && Features.has('dataimport') && Kinds.output(state.kind) !== 'image' ? { data: d.text, dataName: d.name } : {};
  }

  function battle() {
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) return toast('Describe the hub first.');
    var open = Kinds.engines(state.kind).filter(function (e) { return !Plans.blocked(e.id); });
    if (open.length < 2) return toast('You need two agents that can make this, with credits left.');
    var opts = function (sel) { return open.map(function (e) { return '<option value="' + e.id + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join(''); };
    openSheet('<h2>⚖️ Compare Agents</h2><p class="muted small">Both agents build “' + esc(prompt.slice(0, 60)) + '”. Each costs its usual credits.</p>' +
      '<div class="row"><select class="in" id="ba" aria-label="First agent">' + opts(open[0].id) + '</select><b>vs</b><select class="in" id="bb" aria-label="Second agent">' + opts(open[open.length > 2 ? 2 : 1].id) + '</select></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Compare</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        var a = s.querySelector('#ba').value, b = s.querySelector('#bb').value, p = Features.brandPrompt(prompt);
        if (a === b) return toast('Pick two different agents.');
        pickSheet('⚖️ ' + Plans.engine(a).name + ' vs ' + Plans.engine(b).name, [a, b].map(function (id) {
          return { label: Plans.engine(id).name, run: function () { return Cloud.generate(id, p, newExtra()); } };
        }));
      };
    });
  }

  function variations() {
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) return toast('Describe the hub first.');
    var id = pickEngine(), p = Features.brandPrompt(prompt);
    if (Kinds.output(state.kind) === 'image') return toast('Multiple Drafts works for everything except pictures.');
    var ideas = ['', '\n\n(Draft 2: choose a different layout and visual style.)', '\n\n(Draft 3: choose another different layout, and the simplest possible interface.)'];
    pickSheet('🗂️ Multiple Drafts · ' + Plans.engine(id).name, ideas.map(function (extra, n) {
      return { label: 'Draft ' + (n + 1), run: function () { return Cloud.generate(id, p + extra, newExtra()); } };
    }));
  }

  function starters() {
    openSheet('<h2>📋 Prompt Templates</h2><p class="muted small">Pick one, then adjust the details before generating.</p><div class="starters">' +
      Features.STARTERS.map(function (x, i) { return '<button class="starter" data-st="' + i + '"><b>' + esc(x.name) + '</b><span class="muted small">' + esc(x.prompt) + '</span></button>'; }).join('') +
      '</div><button class="btn block" data-x="no" style="margin-top:12px">Close</button>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      Array.prototype.forEach.call(s.querySelectorAll('[data-st]'), function (b) {
        b.onclick = function () {
          state.prompt = Features.STARTERS[+b.getAttribute('data-st')].prompt; Store.set('promptDraft', state.prompt);
          closeSheet(); renderCreate(); $('#prompt').focus();
        };
      });
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

  // ---------- Exports by kind: video, SVG/PNG, pictures, files from hubs ----------

  var MEDIA_LOCK = 'Video, SVG, PNG, picture and 3D downloads need Hub Plus.';

  function kindActions(o) {
    var out = Kinds.output(hubKind(o)), ok = Plans.can('export:zip'), lock = ok ? '' : '<span class="lock">🔒</span>';
    var b = function (act, label) { return '<button class="btn' + (ok ? '' : ' locked') + '" data-kact="' + act + '">' + lock + label + '</button>'; };
    if (hubKind(o) === 'animation') return b('video', '🎬 Video');
    if (out === 'svg') return b('svg', 'SVG') + b('png', 'PNG');
    if (out === 'image') return b('picture', '⤓ Picture');
    return '';
  }

  function bindKindActions(root, getHub) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-kact]'), function (b) {
      b.onclick = function () {
        if (!Plans.can('export:zip')) return upgrade(MEDIA_LOCK);
        var o = getHub(), act = b.getAttribute('data-kact'), name = slug(o.title);
        if (act === 'video') return videoSheet(o);
        if (act === 'picture') {
          var pic = Kinds.bytesOf(Kinds.imageOf(o.html));
          if (!pic) return toast('No picture found in this hub.');
          return HubBridge.save(name + '.' + (pic.mime === 'image/jpeg' ? 'jpg' : pic.mime.split('/')[1]), pic.mime, pic.bytes).then(toast, exportFailed);
        }
        var svg = Kinds.svgOf(o.html);
        if (!svg) return toast('No SVG artwork found in this hub.');
        if (act === 'svg') return HubBridge.save(name + '.svg', 'image/svg+xml', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg).then(toast, exportFailed);
        Kinds.pngOf(svg, 2048).then(function (bytes) { return HubBridge.save(name + '.png', 'image/png', bytes); }).then(toast, exportFailed);
      };
    });
  }

  var FORMATS = { vertical: ['Vertical 9:16', 540, 960], square: ['Square 1:1', 720, 720], landscape: ['Landscape 16:9', 960, 540] };
  function videoSheet(o) {
    openSheet('<h2>🎬 Export video</h2><p class="muted small">Records the animation as it plays. Keep this screen open while it records.</p>' +
      '<label class="field" for="vf">Format</label><select class="in" id="vf">' + Object.keys(FORMATS).map(function (k) { return '<option value="' + k + '">' + FORMATS[k][0] + '</option>'; }).join('') + '</select>' +
      '<label class="field" for="vd">Length</label><select class="in" id="vd"><option value="5">5 seconds</option><option value="10" selected>10 seconds</option><option value="15">15 seconds</option></select>' +
      '<div id="vr" class="rec-box"></div><p class="muted small" id="vs" role="status"></p>' +
      '<div class="row"><button class="btn" data-x="no">Close</button><button class="btn primary grow" data-x="go">Record</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        var f = FORMATS[s.querySelector('#vf').value], secs = +s.querySelector('#vd').value, st = s.querySelector('#vs'), go2 = s.querySelector('[data-x=go]');
        go2.disabled = true; st.innerHTML = '<span class="spinner"></span> Recording ' + secs + ' seconds…';
        Kinds.record(effective(o), secs, f[1], f[2], s.querySelector('#vr'), frame).then(function (v) {
          st.textContent = 'Saving…';
          return HubBridge.save(slug(o.title) + '.' + v.ext, v.mime, v.bytes);
        }).then(function (m) { closeSheet(); toast('🎬 ' + m); }, function (e) {
          go2.disabled = false;
          if (e.message === 'cancelled') { st.textContent = ''; return; }
          st.textContent = e.message;
        });
      };
    });
  }

  // A hub (the 3D viewer, or any hub) asks to save a file: confirm first.
  var FILE_TYPES = { glb: 'model/gltf-binary', obj: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
    csv: 'text/csv', json: 'application/json', txt: 'text/plain', webm: 'video/webm', mp4: 'video/mp4' };
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.type !== 'hub-file' || typeof m.name !== 'string' || typeof m.data !== 'string') return;
    var ours = Array.prototype.some.call(document.querySelectorAll('iframe'), function (f) { return f.contentWindow === e.source; });
    var ext = (/\.([a-z0-9]{1,5})$/i.exec(m.name) || [])[1];
    ext = ext && ext.toLowerCase();
    if (!ours || !FILE_TYPES[ext]) return;
    if (!Plans.can('export:zip')) return upgrade(MEDIA_LOCK);
    var name = slug(m.name.replace(/\.[a-z0-9]+$/i, '')) + '.' + ext, kb = Math.max(1, Math.round(m.data.length * 0.75 / 1024));
    openSheet('<h2>Save file?</h2><p>This hub wants to save <b>' + esc(name) + '</b> (' + kb + ' KB).</p>' +
      '<div class="row"><button class="btn grow" data-x="no">Cancel</button><button class="btn primary grow" data-x="go">Save</button></div>', function (s) {
      s.querySelector('[data-x=no]').onclick = closeSheet;
      s.querySelector('[data-x=go]').onclick = function () {
        var f = Kinds.bytesOf('data:' + FILE_TYPES[ext] + ';base64,' + m.data);
        closeSheet();
        if (!f) return toast('That file could not be read.');
        HubBridge.save(name, FILE_TYPES[ext], f.bytes).then(toast, exportFailed);
      };
    });
  });

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
    var c = Plans.credits(), k = Kinds.get(state.kind), isImage = k.output === 'image';
    var status = !Cloud.configured()
      ? '<div class="note">Hub agents run in Hub AI Cloud. Add your server address in <a href="#" id="toSettings">Settings</a> to start generating.</div>'
      : '<p class="muted small" style="margin:8px 0 0">' + (c.left === null ? 'Connecting…' : c.left + ' credits left') + ' · ' +
        esc(Plans.plan().name) + (c.rule ? ' (' + esc(c.rule) + ')' : '') + '</p>';
    var d = state.data, ph = state.photo;
    var extraRow = isImage
      ? '<div class="row" style="margin-top:8px"><button class="btn" id="photoBtn">📷 ' + (ph ? 'Change photo' : 'Add a photo to edit') + '</button>' +
        '<input type="file" id="photoFile" accept="image/png,image/jpeg,image/webp" hidden>' +
        (ph ? '<img class="photo-thumb" src="' + ph.dataUrl + '" alt="Photo to edit"><span class="muted small grow">' + esc(ph.name) + ' · ' + ph.w + '×' + ph.h + '</span>' +
          '<button class="btn" id="photoRm" aria-label="Remove photo">✕</button>' : '<span class="muted small grow">Optional. Without one, a new picture is made.</span>') + '</div>'
      : '<div class="row" style="margin-top:8px">' + featBtn('dataimport', d ? 'Replace data file' : 'Attach data (CSV, JSON)') +
        '<input type="file" id="dataFile" accept=".csv,.tsv,.json,.txt" hidden>' +
        (d ? '<span class="chip on grow" style="cursor:default">📎 ' + esc(d.name) + ' · ' + d.kb + ' KB · ' + d.rows + ' rows</span>' +
          '<button class="btn" id="dataRm" aria-label="Remove data file">✕</button>' : '') + '</div>';
    var placeholder = isImage ? (ph ? 'Describe the edit, e.g. make the sky a sunset and remove the people' : 'Describe the picture, e.g. ' + k.examples[2])
      : 'Describe it, e.g. ' + k.examples[0];
    view.innerHTML = '<div class="wrap">' +
      '<div class="card"><h2>What do you want to make?</h2>' +
      '<div class="kinds" role="radiogroup" aria-label="What to make">' + Kinds.list().map(function (x) {
        return '<button class="kind' + (x.id === k.id ? ' on' : '') + '" role="radio" aria-checked="' + (x.id === k.id) + '" data-kind="' + x.id + '">' +
          '<span class="kemoji" aria-hidden="true">' + x.emoji + '</span><span>' + esc(x.name) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="muted small" style="margin:8px 0 0">' + k.emoji + ' ' + esc(k.desc) + '</p>' +
      '<label class="field" for="prompt">' + (isImage && ph ? 'The edit' : 'Describe it') + '</label>' +
      '<textarea class="in" id="prompt" placeholder="' + esc(placeholder) + '">' + esc(state.prompt) + '</textarea>' +
      extraRow +
      '<div class="chips">' + (k.id === 'app' ? '<button class="chip' + (Features.has('starters') ? '' : ' locked') + '" id="sur">📋 Templates</button>' : '') +
      k.examples.map(function (x) { return '<button class="chip" data-ex="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<label class="field">Agent</label><div class="engines">' + Kinds.engines(k.id).map(engineRow).join('') + '</div>' +
      '<button class="btn primary block" id="gen" style="margin-top:12px">' + (state.busy ? '<span class="spinner"></span> Generating…' : 'Generate') + '</button>' +
      (isImage ? '' : '<div class="row" style="margin-top:8px">' + featBtn('battle', 'Compare agents', ' style="flex:1"') + featBtn('variations', '3 drafts', ' style="flex:1"') + '</div>') +
      status + '</div><div id="result"></div></div>';

    var p = $('#prompt');
    p.oninput = function () { state.prompt = p.value; Store.set('promptDraft', p.value); };
    Array.prototype.forEach.call(view.querySelectorAll('[data-kind]'), function (b) {
      b.onclick = function () { state.kind = b.getAttribute('data-kind'); Store.set('kind', state.kind); renderCreate(); };
    });
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
    var sur = $('#sur');
    if (sur) sur.onclick = function () {
      if (!Features.has('starters')) return upgrade(Features.needs('starters'));
      starters();
    };
    var file = $('#dataFile');
    if (file) file.onchange = function () {
      if (!file.files[0]) return;
      Features.readData(file.files[0]).then(function (dd) { state.data = dd; renderCreate(); toast('📎 ' + dd.name + ' attached'); },
        function (e) { toast(e.message); });
      file.value = '';
    };
    var rm = $('#dataRm');
    if (rm) rm.onclick = function () { state.data = null; renderCreate(); };
    var pf = $('#photoFile');
    if (pf) {
      $('#photoBtn').onclick = function () { pf.click(); };
      pf.onchange = function () {
        if (!pf.files[0]) return;
        Kinds.readPhoto(pf.files[0]).then(function (x) { state.photo = x; renderCreate(); }, function (e) { toast(e.message); });
        pf.value = '';
      };
    }
    var prm = $('#photoRm');
    if (prm) prm.onclick = function () { state.photo = null; renderCreate(); };
    Array.prototype.forEach.call(view.querySelectorAll('.wrap > .card [data-feat]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-feat');
        if (!Features.has(id)) return upgrade(Features.needs(id));
        if (id === 'dataimport') return file.click();
        if (!Cloud.configured()) { go('settings'); return toast('Add your Hub AI Cloud server first.'); }
        (id === 'battle' ? battle : variations)();
      };
    });
    var ts = $('#toSettings');
    if (ts) ts.onclick = function (ev) { ev.preventDefault(); go('settings'); };
    var use = pickEngine();
    if (use !== state.engine) {
      Array.prototype.forEach.call(view.querySelectorAll('[data-engine]'), function (x) { x.classList.toggle('on', x.getAttribute('data-engine') === use); });
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
      '<div class="muted small">' + Kinds.get(hubKind(d)).emoji + ' ' + esc(Kinds.get(hubKind(d)).name) + ' · ' + esc(d.engineName) + (d.seconds ? ' · ' + d.seconds + ' s' : '') + '</div></div>' +
      '<button class="btn" data-act="open">Full screen</button></div>' +
      (d.notes || []).map(function (n) { return '<div class="note">' + esc(n) + '</div>'; }).join('') +
      '<div id="pv" style="margin-top:10px"></div>' +
      '<div class="actions">' +
      (saved ? '<button class="btn" id="saved">Saved ✓</button>' : '<button class="btn' + (Plans.can('save') ? '' : ' locked') + '" id="save">' + (Plans.can('save') ? '' : '<span class="lock">🔒</span>') + 'Save</button>') +
      lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(saved && FunHub.isPublished(saved.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') +
      lockBtn('Share', 'export:html', 'share') + kindActions(d) +
      '<button class="btn" id="discard">Discard</button></div>' + hubTools(getT({ kind: 'draft' })) + '</div>';
    previewBox(effective(d), $('#pv'));
    bindHubTools(box, { kind: 'draft' });
    bindKindActions(box, function () { return getT({ kind: 'draft' }); });

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
    var hub = { id: uid(), title: d.title, html: d.html, engine: d.engine, engineName: d.engineName, kind: hubKind(d), prompt: d.prompt, created: Date.now(),
      powerups: (d.powerups || []).slice(), versions: (d.versions || []).slice() };
    var list = hubs(); list.unshift(hub);
    if (!saveHubs(list)) return null;
    d.savedId = hub.id; Store.set('draft', d);
    return hub.id;
  }

  function generate() {
    if (state.busy) return;
    var prompt = ($('#prompt').value || '').trim();
    if (!prompt) { toast(state.photo && Kinds.output(state.kind) === 'image' ? 'Describe the edit first.' : 'Describe what you want first.'); return; }
    if (!Cloud.configured()) { go('settings'); toast('Add your Hub AI Cloud server first.'); return; }
    var id = pickEngine(), e = Plans.engine(id), bl = Plans.blocked(id);
    if (bl) return bl.reason === 'credits' || bl.reason === 'plan' ? upgrade(bl.text) : toast(bl.text);

    state.busy = true;
    $('#gen').innerHTML = '<span class="spinner"></span> ' + esc(e.name) + ' is making your ' + esc(Kinds.get(state.kind).name.toLowerCase()) + '…';
    Cloud.generate(id, Features.brandPrompt(prompt), newExtra()).then(function (r) {
      setDraft(r, prompt);
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
      view.innerHTML = '<div class="wrap"><div class="card empty"><h2>Hubs</h2><p>Hub Free can make anything and preview it, but saving and exporting starts with Hub Go ($2/month).</p>' +
        '<button class="btn primary" id="up">See plans</button></div></div>';
      $('#up').onclick = function () { go('plans'); };
      return;
    }
    var list = hubs();
    view.innerHTML = '<div class="wrap"><div class="row"><h2 class="grow">Your hubs</h2></div>' + (list.length ? list.map(function (h) {
      return '<button class="hub-item" data-id="' + h.id + '"><span class="thumb" aria-hidden="true">' + Kinds.get(hubKind(h)).emoji + '</span>' +
        '<span class="grow"><div class="t">' + esc(h.title) + '</div><div class="muted small">' + esc(Kinds.get(hubKind(h)).name) + ' · ' + esc(h.engineName) + ' · ' + fmtDate(h.created) +
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
      '<div class="muted small" style="margin:8px 0">' + Kinds.get(hubKind(h)).emoji + ' ' + esc(Kinds.get(hubKind(h)).name) + ' · ' + esc(h.engineName) + ' · ' + fmtDate(h.created) + (h.prompt ? ' · “' + esc(h.prompt.slice(0, 80)) + '”' : '') + '</div>' +
      '<div id="pv"></div><div class="actions">' +
      '<button class="btn" data-act="open">Full screen</button>' + lockBtn('HTML', 'export:html', 'html') + lockBtn('ZIP', 'export:zip', 'zip') +
      lockBtn(FunHub.isPublished(h.id) ? 'Unpublish' : 'Publish', 'publish', 'publish') + lockBtn('Share', 'export:html', 'share') + kindActions(h) +
      '<button class="btn danger" id="del">Delete</button></div>' + hubTools(getT({ kind: 'hub', id: id })) + '</div></div>';
    previewBox(effective(h), $('#pv'));
    bindHubTools(view, { kind: 'hub', id: id });
    bindKindActions(view, function () { return getT({ kind: 'hub', id: id }); });
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
    var html = '<div class="wrap"><h2>Tools</h2><p class="muted small">20 professional tools. Each plan adds five, and keeps the ones below it.</p>';
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
    starters: ['Open', function () { go('create'); setTimeout(function () { $('#sur').click(); }, 0); }],
    dataimport: ['Attach', function () { go('create'); setTimeout(function () { $('#dataFile').click(); }, 0); }],
    battle: ['Try it', function () { go('create'); toast('Describe a hub, then tap ⚖️ Compare agents.'); }],
    variations: ['Try it', function () { go('create'); toast('Describe a hub, then tap 🗂️ 3 drafts.'); }],
    brandkit: ['Set up', brandKit],
    refine: tryOnHub, deviceflip: tryOnHub, source: tryOnHub, a11y: tryOnHub, timemachine: tryOnHub, editor: tryOnHub,
    embed: tryOnHub, seo: tryOnHub, dna: tryOnHub, translate: tryOnHub, autofix: tryOnHub, nowatermark: tryOnHub,
    lock: tryOnHub, security: tryOnHub, pwa: tryOnHub
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
      '<div class="card"><h3>Hub AI Cloud</h3><p class="muted small">The Hub agents run on your Hub AI Cloud server ' +
      '(hub-ai/cloud). Your plan and credits are kept there.</p>' +
      '<label class="field">Server address</label><input class="in" id="url" inputmode="url" autocomplete="off" placeholder="https://your-hub-ai-cloud.example.com" value="' +
      esc(s.cloudUrl || (window.HUB_CONFIG && window.HUB_CONFIG.cloudUrl) || '') + '">' +
      '<p class="small" id="cs" style="margin:8px 0 0">' + status + '</p></div>' +
      '<div class="card"><h3>FunHub</h3><label class="field">Name shown on your posts</label><input class="in" id="au" value="' + esc(s.author || 'You') + '"></div>' +
      '<button class="btn primary block" id="sv">Save and connect</button>' +
      '<div class="card" style="margin-top:12px"><h3>What\'s new</h3><p class="muted small">The new agents, animations, slides, 3D models, photo edits and more, in five short videos.</p>' +
      '<button class="btn" id="wn">▶ Watch what\'s new</button></div>' +
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
    $('#wn').onclick = function () { WhatsNew.open(); };
    $('#wipe').onclick = function () {
      openSheet('<h2>Erase everything?</h2><p>All hubs, FunHub posts and settings on this device are removed, and this device gets a new anonymous account.</p>' +
        '<div class="row"><button class="btn grow" data-x="no">Cancel</button><button class="btn danger grow" data-x="yes">Erase</button></div>', function (sh) {
        sh.querySelector('[data-x=no]').onclick = closeSheet;
        sh.querySelector('[data-x=yes]').onclick = function () {
          Store.clear(); state.draft = null; state.prompt = ''; state.engine = 'flux'; state.kind = 'app'; state.photo = null; state.stack = [];
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
  // After an update, the first thing shown is what's new.
  WhatsNew.maybeOpen();
})();
