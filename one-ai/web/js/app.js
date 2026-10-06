/* One AI: the chat app. Plain DOM, no frameworks. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = Markdown.escape;

  // Used until the server answers (and offline): the catalog without prices.
  var FALLBACK = {
    models: [
      { id: 'one-1-mini', name: 'One 1 Mini', family: 1, about: 'Snabbast.' },
      { id: 'one-1-standard', name: 'One 1 Standard', family: 1, about: 'Bra på det mesta.' },
      { id: 'one-1-plus', name: 'One 1 Plus', family: 1, about: 'Smartare svar och bättre kod.' }
    ],
    agents: [{ id: 'filegent', name: 'Filegent', icon: '📄', about: 'Vanliga filer.' }],
    plans: [], currency: 'kr', defaultModel: 'one-1-standard'
  };

  var state = {
    cfg: Store.get('config', null) || FALLBACK,
    me: Store.get('me', null),
    chats: [],
    chat: null,
    model: Store.get('model', 'one-1-standard'),
    agent: 'auto',
    pending: [],
    busy: null,
    search: ''
  };

  var ICON = {
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0115.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.2L3 16M3 21v-5h5"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" class="check"><path d="M5 12l5 5L20 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '🔒'
  };
  var FILE_ICON = { html: '🌐', zip: '🗜️', pdf: '📕', docx: '📘', xlsx: '📗', pptx: '📙', csv: '📊', json: '🧾', md: '📝', txt: '📄',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', webp: '🖼️', svg: '🎨', mp4: '🎬', mp3: '🎵', wav: '🎵', mid: '🎹', glb: '🧊', eml: '✉️',
    py: '🐍', js: '📜', css: '🎨' };

  var SUGGESTIONS = [
    { icon: '🧩', text: 'Bygg en app', prompt: 'Bygg en app där jag kan ', agent: 'appagent' },
    { icon: '🖼️', text: 'Skapa en bild', prompt: 'Skapa en bild av ', agent: 'imagent' },
    { icon: '📽️', text: 'Gör en presentation', prompt: 'Gör en presentation om ', agent: 'presegent' },
    { icon: '📄', text: 'Skriv en PDF-rapport', prompt: 'Skriv en PDF-rapport om ', agent: 'filegent' },
    { icon: '🎵', text: 'Gör en låt', prompt: 'Gör en låt om ', agent: 'musigent' },
    { icon: '🧊', text: 'Gör en 3D-modell', prompt: 'Gör en 3D-modell av ', agent: 'modelgent' },
    { icon: '🎬', text: 'Skapa en video', prompt: 'Skapa en video av ', agent: 'vidagent' },
    { icon: '🌐', text: 'Bygg en webbplats', prompt: 'Bygg en webbplats för ', agent: 'sitegent' }
  ];

  // --- helpers ---------------------------------------------------------------

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'html') el.innerHTML = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 2800);
  }

  function bytes(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function text(b64) { return new TextDecoder().decode(bytes(b64)); }
  function size(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' kB' : (n / 1048576).toFixed(1) + ' MB'; }
  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nf(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function model(id) { return state.cfg.models.find(function (m) { return m.id === id; }); }
  function agent(id) { return state.cfg.agents.find(function (a) { return a.id === id; }); }
  function plan(id) { return (state.cfg.plans || []).find(function (p) { return p.id === id; }); }
  function firstPlanWith(kind, id) { return (state.cfg.plans || []).find(function (p) { return p[kind].indexOf(id) >= 0; }); }
  function hasModel(id) { return state.me ? state.me.models.indexOf(id) >= 0 : ['one-1-mini', 'one-1-standard', 'one-1-plus'].indexOf(id) >= 0; }
  function hasAgent(id) { return state.me ? state.me.agents.indexOf(id) >= 0 : id === 'filegent'; }
  function isPhone() { return window.matchMedia('(max-width: 767px)').matches; }

  // --- theme and layout --------------------------------------------------------

  function applyTheme() {
    var t = (Store.get('settings', {}).theme) || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  function setSide(open) {
    $('app').classList.toggle('side-closed', !open);
    if (!isPhone()) Store.set('sideOpen', open);
  }

  function closeMenus() {
    document.querySelectorAll('.dropdown.open').forEach(function (d) { d.classList.remove('open'); });
  }

  // --- account ---------------------------------------------------------------

  function renderAccount() {
    var me = state.me;
    var p = me ? plan(me.plan) : null;
    $('planName').textContent = me ? me.planName : 'One Lite';
    $('unitsLeft').textContent = !me ? 'Ansluter…' : me.units == null ? 'Obegränsad användning' : nf(me.units) + ' enheter kvar';
    $('upgradeBtn').hidden = !!(me && me.plan === 'enterprise');
    $('avatar').textContent = (p ? p.name.replace('One ', '') : 'L').charAt(0);
  }

  function refreshMe() {
    return Api.me().then(function (me) {
      state.me = me; Store.set('me', me);
      if (!hasModel(state.model)) setModel(me.models.indexOf(state.cfg.defaultModel) >= 0 ? state.cfg.defaultModel : me.models[0]);
      renderAccount(); renderModelMenu(); renderAgentMenu();
      return me;
    });
  }

  function notice(html, actions) {
    var n = $('notice');
    if (!html) { n.hidden = true; return; }
    n.innerHTML = '<span class="grow">' + html + '</span>';
    (actions || []).forEach(function (a) { n.appendChild(h('button', { class: 'btn small secondary', type: 'button', onclick: a[1], text: a[0] })); });
    n.hidden = false;
  }

  function connect() {
    if (!Api.configured()) {
      notice('Ange adressen till din One AI Cloud-server för att börja.', [['Inställningar', function () { openSettings('general'); }]]);
      return Promise.resolve();
    }
    return Api.config().then(function (cfg) {
      state.cfg = cfg; Store.set('config', cfg);
      notice(null);
      renderModelMenu(); renderAgentMenu(); renderAccount();
      return refreshMe();
    }).catch(function (e) {
      notice(esc(e.message), [['Försök igen', connect], ['Inställningar', function () { openSettings('general'); }]]);
    });
  }

  // --- model and agent menus ---------------------------------------------------

  function setModel(id) {
    state.model = id; Store.set('model', id);
    var m = model(id);
    $('modelName').textContent = m ? m.name : id;
    renderModelMenu();
  }

  function renderModelMenu() {
    var menu = $('modelMenu');
    menu.innerHTML = '';
    [1, 2].forEach(function (fam) {
      var list = state.cfg.models.filter(function (m) { return m.family === fam; });
      if (!list.length) return;
      menu.appendChild(h('div', { class: 'menu-label', text: 'One ' + fam }));
      list.forEach(function (m) {
        var ok = hasModel(m.id), need = ok ? null : firstPlanWith('models', m.id);
        menu.appendChild(h('button', {
          class: 'menu-item' + (m.id === state.model ? ' selected' : '') + (ok ? '' : ' locked'), type: 'button', role: 'menuitem',
          onclick: function () { closeMenus(); if (ok) setModel(m.id); else openPlans(); }
        }, [
          h('span', { class: 'mi-text', html: '<b>' + esc(m.name) + '</b><small>' + esc(m.about || '') + '</small>' }),
          ok ? h('span', { html: ICON.check }) : h('span', { class: 'badge', text: need ? need.name.replace('One ', '') : 'Enterprise' })
        ]));
      });
    });
    var m = model(state.model);
    $('modelName').textContent = m ? m.name : 'One 1 Standard';
  }

  function setAgent(id) {
    state.agent = id;
    var a = agent(id);
    $('agentIcon').textContent = a ? a.icon : '✦';
    $('agentName').textContent = a ? a.name : 'Auto';
    $('agentBtn').classList.toggle('chosen', id !== 'auto');
    renderAgentMenu();
  }

  function renderAgentMenu() {
    var menu = $('agentMenu');
    menu.innerHTML = '';
    menu.appendChild(h('div', { class: 'menu-label', text: 'Agent' }));
    var items = [{ id: 'auto', name: 'Auto', icon: '✦', about: 'One väljer rätt agenter själv, flera samtidigt vid behov.' }].concat(state.cfg.agents);
    items.forEach(function (a) {
      var ok = a.id === 'auto' || hasAgent(a.id), need = ok ? null : firstPlanWith('agents', a.id);
      var weak = state.me && state.me.weak.indexOf(a.id) >= 0;
      menu.appendChild(h('button', {
        class: 'menu-item' + (a.id === state.agent ? ' selected' : '') + (ok ? '' : ' locked'), type: 'button', role: 'menuitem',
        onclick: function () { closeMenus(); if (ok) setAgent(a.id); else openPlans(); $('input').focus(); }
      }, [
        h('span', { class: 'mi-icon', text: a.icon }),
        h('span', { class: 'mi-text', html: '<b>' + esc(a.name) + (weak ? ' (enkel)' : '') + '</b><small>' + esc(a.about) + '</small>' }),
        ok ? h('span', { html: ICON.check }) : h('span', { class: 'badge', text: need ? need.name.replace('One ', '') : '' })
      ]));
    });
  }

  // --- chats -----------------------------------------------------------------

  function loadChats() {
    return Chats.all().then(function (list) { state.chats = list; renderChatList(); });
  }

  function renderChatList() {
    var nav = $('chatList'), q = state.search.toLowerCase();
    nav.innerHTML = '';
    var today = new Date().setHours(0, 0, 0, 0), week = today - 6 * 864e5;
    var groups = [['I dag', []], ['Senaste 7 dagarna', []], ['Äldre', []]];
    state.chats.filter(function (c) {
      return !q || (c.title || '').toLowerCase().indexOf(q) >= 0 ||
        c.messages.some(function (m) { return (m.text || '').toLowerCase().indexOf(q) >= 0; });
    }).forEach(function (c) { groups[c.updated >= today ? 0 : c.updated >= week ? 1 : 2][1].push(c); });
    groups.forEach(function (g) {
      if (!g[1].length) return;
      nav.appendChild(h('div', { class: 'chat-group', text: g[0] }));
      g[1].forEach(function (c) {
        nav.appendChild(h('div', {
          class: 'chat-link' + (state.chat && state.chat.id === c.id ? ' active' : ''), role: 'button', tabindex: '0',
          onclick: function () { openChat(c.id); }, onkeydown: function (e) { if (e.key === 'Enter') openChat(c.id); }
        }, [h('span', { text: c.title || 'Ny chatt' }),
          h('button', { class: 'del', type: 'button', title: 'Radera chatten', 'aria-label': 'Radera chatten', html: ICON.trash,
            onclick: function (e) { e.stopPropagation(); deleteChat(c.id); } })]));
      });
    });
    if (!nav.children.length) nav.appendChild(h('div', { class: 'chat-group', text: q ? 'Inga träffar' : 'Inga chattar än' }));
  }

  function newChat() {
    if (state.busy) state.busy.abort();
    state.chat = null;
    state.pending = [];
    renderAttachments(); renderThread(); renderChatList();
    setAgent('auto');
    if (isPhone()) setSide(false);
    $('input').focus();
  }

  function openChat(id) {
    if (state.busy) state.busy.abort();
    state.chat = state.chats.find(function (c) { return c.id === id; }) || null;
    if (state.chat && state.chat.model && model(state.chat.model) && hasModel(state.chat.model)) setModel(state.chat.model);
    renderThread(); renderChatList();
    if (isPhone()) setSide(false);
  }

  function deleteChat(id) {
    if (!confirm('Radera chatten?')) return;
    Chats.remove(id).then(function () {
      if (state.chat && state.chat.id === id) state.chat = null;
      return loadChats();
    }).then(renderThread);
  }

  function saveChat() {
    var c = state.chat;
    c.updated = Date.now();
    state.chats = [c].concat(state.chats.filter(function (x) { return x.id !== c.id; }));
    renderChatList();
    return Chats.put(c).catch(function () { toast('Kunde inte spara chatten på enheten.'); });
  }

  // --- thread ------------------------------------------------------------------

  function renderThread() {
    var thread = $('thread');
    thread.innerHTML = '';
    var msgs = state.chat ? state.chat.messages : [];
    $('empty').hidden = msgs.length > 0;
    msgs.forEach(function (m, i) { thread.appendChild(renderMessage(m, i)); });
    if (state.busy && state.busy.chatId === (state.chat && state.chat.id)) thread.appendChild(thinking());
    scrollDown();
  }

  function scrollDown() { var s = $('scroller'); s.scrollTop = s.scrollHeight; }

  function thinking() {
    var started = Date.now();
    var label = h('span', { text: 'One tänker' });
    var el = h('div', { class: 'msg assistant', id: 'thinking' }, [h('div', { class: 'thinking' }, [h('span', { class: 'dots', html: '<span></span><span></span><span></span>' }), label])]);
    var timer = setInterval(function () {
      if (!document.body.contains(el)) return clearInterval(timer);
      var s = Math.round((Date.now() - started) / 1000);
      label.textContent = s < 4 ? 'One tänker' : (state.busy && state.busy.agentLabel ? state.busy.agentLabel : 'One arbetar') + ' · ' + s + ' s';
    }, 1000);
    return el;
  }

  function attachmentChip(a, onRemove) {
    var thumb = a.mime && a.mime.indexOf('image/') === 0 && a.data
      ? h('img', { src: 'data:' + a.mime + ';base64,' + a.data, alt: '' }) : h('span', { class: 'att-ico', text: FILE_ICON[ext(a.name)] || '📎' });
    return h('div', { class: 'att', title: a.name }, [thumb, h('span', { text: a.name }),
      onRemove ? h('button', { type: 'button', 'aria-label': 'Ta bort', html: ICON.x, onclick: onRemove }) : null]);
  }

  function renderMessage(m, i) {
    if (m.role === 'user') {
      return h('div', { class: 'msg user' }, [
        m.attachments && m.attachments.length ? h('div', { class: 'att-list' }, m.attachments.map(function (a) { return attachmentChip(a); })) : null,
        m.text ? h('div', { class: 'bubble', text: m.text }) : null
      ]);
    }
    var el = h('div', { class: 'msg assistant' });
    var meta = h('div', { class: 'meta' });
    (m.agents || []).forEach(function (a) {
      var ag = agent(a.id);
      meta.appendChild(h('span', { class: 'chip ' + (a.ok ? 'ok' : 'fail'), text: (ag ? ag.icon + ' ' : '') + a.name }));
    });
    (m.tools || []).forEach(function (t) { meta.appendChild(h('span', { class: 'chip', text: '🔌 ' + t })); });
    if (meta.children.length) el.appendChild(meta);
    if (m.error) {
      var err = h('div', { class: 'error' }, [h('span', { text: m.error })]);
      if (m.code === 'plan' || m.code === 'units' || m.code === 'limit') err.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Se planer', onclick: openPlans }));
      else if (m.code === 'setup') err.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Inställningar', onclick: function () { openSettings('general'); } }));
      if (i === state.chat.messages.length - 1) err.appendChild(h('button', { class: 'btn small secondary', type: 'button', text: 'Försök igen', onclick: regenerate }));
      el.appendChild(err);
      return el;
    }
    var answer = h('div', { class: 'answer', html: Markdown.render(m.text || '') });
    answer.querySelectorAll('[data-copy-code]').forEach(function (b) {
      b.addEventListener('click', function () { copy(b.closest('.codeblock').querySelector('code').textContent); b.textContent = 'Kopierat'; });
    });
    el.appendChild(answer);
    if (m.files && m.files.length) el.appendChild(h('div', { class: 'files' }, m.files.map(fileCard)));
    if ((m.upgrade || []).length) el.appendChild(h('div', { class: 'row', style: 'margin-top:10px' }, [h('button', { class: 'btn small', type: 'button', text: 'Se planer', onclick: openPlans })]));
    var actions = h('div', { class: 'actions' }, [
      h('button', { class: 'icon-btn', type: 'button', title: 'Kopiera', 'aria-label': 'Kopiera', html: ICON.copy, onclick: function () { copy(m.text || ''); } })
    ]);
    if (i === state.chat.messages.length - 1) actions.appendChild(h('button', { class: 'icon-btn', type: 'button', title: 'Gör om', 'aria-label': 'Gör om', html: ICON.redo, onclick: regenerate }));
    if (m.modelName) actions.appendChild(h('span', { class: 'muted', style: 'font-size:12px;align-self:center;margin-left:6px', text: m.modelName }));
    el.appendChild(actions);
    return el;
  }

  function fileCard(f) {
    var e = ext(f.name), ag = agent(f.agent), card = h('div', { class: 'file' });
    var media = null;
    if (f.preview === 'image') {
      media = h('div', { class: 'file-media' }, [h('img', { src: 'data:' + f.mime + ';base64,' + f.data, alt: f.name, onclick: function () { openPreview(f); } })]);
      card.classList.add('wide');
    } else if (f.preview === 'svg') {
      media = h('div', { class: 'file-media svg' }, [h('img', { src: 'data:image/svg+xml;base64,' + f.data, alt: f.name, onclick: function () { openPreview(f); } })]);
    } else if (f.preview === 'video') {
      media = h('div', { class: 'file-media' }, [h('video', { src: URL.createObjectURL(new Blob([bytes(f.data)], { type: f.mime })), controls: true, playsinline: true, preload: 'metadata' })]);
      card.classList.add('wide');
    } else if (f.preview === 'audio') {
      media = h('div', { class: 'file-media' }, [h('audio', { src: URL.createObjectURL(new Blob([bytes(f.data)], { type: f.mime })), controls: true, preload: 'metadata' })]);
    }
    if (media) card.appendChild(media);
    var canPreview = ['html', 'text', 'model3d', 'image', 'svg'].indexOf(f.preview) >= 0 || e === 'eml';
    card.appendChild(h('div', { class: 'file-row' }, [
      h('div', { class: 'file-icon', text: FILE_ICON[e] || '📄' }),
      h('div', { class: 'file-info' }, [h('b', { text: f.name }), h('small', { text: size(f.size) + (ag ? ' · ' + ag.name : '') })]),
      h('div', { class: 'file-btns' }, [
        canPreview ? h('button', { class: 'icon-btn', type: 'button', title: f.preview === 'html' ? 'Öppna' : 'Förhandsgranska', 'aria-label': 'Förhandsgranska', html: ICON.eye, onclick: function () { openPreview(f); } }) : null,
        h('button', { class: 'icon-btn', type: 'button', title: 'Dela', 'aria-label': 'Dela', html: ICON.share, onclick: function () { shareFile(f); } }),
        h('button', { class: 'icon-btn', type: 'button', title: 'Ladda ner', 'aria-label': 'Ladda ner', html: ICON.download, onclick: function () { saveFile(f); } })
      ])
    ]));
    return card;
  }

  function saveFile(f) {
    OneBridge.save(f.name, f.mime, bytes(f.data)).then(function (msg) { if (msg) toast(msg); }).catch(function (e) {
      if (e.message !== 'cancelled') toast('Kunde inte spara: ' + e.message);
    });
  }
  function shareFile(f) {
    OneBridge.share(f.name, f.mime, bytes(f.data), f.name).then(function (msg) { if (msg) toast(msg); }).catch(function (e) {
      if (e && e.name !== 'AbortError') toast('Kunde inte dela: ' + e.message);
    });
  }
  function copy(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Kopierat'); }).catch(function () {
      var ta = h('textarea', {}); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Kopierat'); } catch (e) { toast('Kunde inte kopiera'); }
      ta.remove();
    });
  }

  // --- sending -------------------------------------------------------------------

  function requestMessages(msgs) {
    var out = [];
    msgs.forEach(function (m, i) {
      if (m.role === 'assistant' && m.error) return;
      var t = m.text || '';
      if (m.role === 'assistant' && m.files && m.files.length) t += '\n\n(Bifogade filer: ' + m.files.map(function (f) { return f.name; }).join(', ') + ')';
      var msg = { role: m.role, text: t };
      if (i === msgs.length - 1 && m.attachments) msg.attachments = m.attachments.map(function (a) { return { name: a.name, mime: a.mime, data: a.data }; });
      out.push(msg);
    });
    return out;
  }

  // Text files from the latest answer go along, so "make it blue" works.
  function contextFiles(msgs) {
    var last = null;
    for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant' && msgs[i].files && msgs[i].files.length) { last = msgs[i]; break; }
    if (!last) return [];
    var out = [], total = 0;
    last.files.forEach(function (f) {
      if (['html', 'text', 'svg'].indexOf(f.preview) < 0 || f.size > 200000 || total + f.size > 300000) return;
      total += f.size;
      out.push({ name: f.name, text: text(f.data) });
    });
    return out;
  }

  function send() {
    if (state.busy) { state.busy.abort(); return; }
    var input = $('input'), t = input.value.trim();
    if (!t && !state.pending.length) return;
    if (!state.chat) {
      state.chat = { id: uid(), title: (t || state.pending[0].name).slice(0, 60), created: Date.now(), updated: Date.now(), model: state.model, messages: [] };
    }
    state.chat.messages.push({ role: 'user', text: t, attachments: state.pending.slice() });
    input.value = ''; autosize();
    state.pending = []; renderAttachments();
    run();
  }

  function regenerate() {
    if (state.busy || !state.chat) return;
    var msgs = state.chat.messages;
    if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    if (!msgs.length) return;
    run();
  }

  function run() {
    var chat = state.chat;
    chat.model = state.model;
    var ctrl = new AbortController();
    ctrl.chatId = chat.id;
    var a = agent(state.agent);
    ctrl.agentLabel = a ? a.name + ' arbetar' : null;
    state.busy = ctrl;
    $('sendBtn').classList.add('busy');
    $('sendBtn').disabled = false;
    saveChat();
    renderThread();
    Api.chat({ model: state.model, agent: state.agent, messages: requestMessages(chat.messages), contextFiles: contextFiles(chat.messages) }, ctrl.signal)
      .then(function (out) {
        chat.messages.push({ role: 'assistant', text: out.reply, files: out.files, agents: out.agents, tools: out.tools, upgrade: out.upgrade,
          model: out.model, modelName: out.modelName });
        if (out.mcpErrors && out.mcpErrors.length) toast('MCP: ' + out.mcpErrors[0]);
        state.me = out.me; Store.set('me', out.me); renderAccount();
      })
      .catch(function (e) {
        if (e.name === 'AbortError') chat.messages.push({ role: 'assistant', error: 'Stoppad.', code: 'stopped' });
        else chat.messages.push({ role: 'assistant', error: e.message, code: e.code });
      })
      .then(function () {
        if (state.busy === ctrl) state.busy = null;
        $('sendBtn').classList.remove('busy');
        updateSend();
        return Chats.put(chat).catch(function () { toast('Chatten blev för stor för att sparas på enheten.'); });
      })
      .then(function () { if (state.chat === chat) renderThread(); renderChatList(); });
  }

  // --- composer ------------------------------------------------------------------

  function autosize() {
    var t = $('input');
    t.style.height = 'auto';
    t.style.height = Math.min(240, t.scrollHeight) + 'px';
    updateSend();
  }
  function updateSend() {
    $('sendBtn').disabled = !state.busy && !$('input').value.trim() && !state.pending.length;
  }

  function addFiles(list) {
    Array.prototype.slice.call(list || []).forEach(function (file) {
      if (state.pending.length >= 8) return toast('Högst 8 filer per meddelande.');
      if (file.size > 10 * 1024 * 1024) return toast(file.name + ' är större än 10 MB.');
      var r = new FileReader();
      r.onload = function () {
        state.pending.push({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size, data: String(r.result).split(',')[1] || '' });
        renderAttachments();
      };
      r.readAsDataURL(file);
    });
  }

  function renderAttachments() {
    var box = $('attachments');
    box.innerHTML = '';
    state.pending.forEach(function (a, i) {
      box.appendChild(attachmentChip(a, function () { state.pending.splice(i, 1); renderAttachments(); }));
    });
    updateSend();
  }

  // --- modals ---------------------------------------------------------------------

  var modalCleanup = null;
  function openModal(title, body, cls) {
    closeModal();
    $('modalTitle').textContent = title;
    var b = $('modalBody');
    b.innerHTML = ''; b.className = 'modal-body' + (cls && cls.indexOf('flush') >= 0 ? ' flush' : '');
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    document.querySelector('.modal-box').className = 'modal-box ' + (cls || '');
    $('modal').hidden = false;
    return b;
  }
  function closeModal() {
    if (modalCleanup) { modalCleanup(); modalCleanup = null; }
    $('modal').hidden = true;
    $('modalBody').innerHTML = '';
  }

  function openPreview(f) {
    var e = ext(f.name);
    var bar = h('div', { class: 'preview-bar' }, [
      h('span', { class: 'muted grow', text: size(f.size) }),
      h('button', { class: 'btn small secondary', type: 'button', html: ICON.share + ' Dela', onclick: function () { shareFile(f); } }),
      h('button', { class: 'btn small', type: 'button', html: ICON.download + ' Ladda ner', onclick: function () { saveFile(f); } })
    ]);
    var wrap = h('div', { style: 'display:flex;flex-direction:column;flex:1;min-height:0' }, [bar]);
    if (f.preview === 'html') {
      // Sandboxed: scripts run, but the page gets no access to the app.
      wrap.appendChild(h('iframe', { class: 'preview-frame', sandbox: 'allow-scripts allow-forms allow-modals allow-popups allow-downloads', title: f.name, srcdoc: text(f.data) }));
      openModal(f.name, wrap, 'full flush');
    } else if (f.preview === 'model3d') {
      var v = h('div', { class: 'viewer' }, [h('div', { class: 'hint', text: 'Dra för att vrida · scrolla eller nyp för att zooma' })]);
      wrap.appendChild(v);
      openModal(f.name, wrap, 'full flush');
      try { var viewer = Viewer3D.show(v, bytes(f.data).buffer); modalCleanup = viewer.destroy; } catch (err) { v.appendChild(h('p', { class: 'muted', style: 'padding:20px', text: 'Kan inte visa modellen: ' + err.message })); }
    } else if (f.preview === 'image' || f.preview === 'svg') {
      wrap.appendChild(h('div', { style: 'flex:1;overflow:auto;display:grid;place-items:center;background:var(--soft);padding:12px' }, [
        h('img', { src: 'data:' + (f.preview === 'svg' ? 'image/svg+xml' : f.mime) + ';base64,' + f.data, alt: f.name, style: 'max-width:100%;max-height:100%;background:' + (f.preview === 'svg' ? '#fff' : 'transparent') })]));
      openModal(f.name, wrap, 'full flush');
    } else {
      var t = text(f.data);
      if (e === 'eml') t = t.replace(/\r\n/g, '\n');
      wrap.appendChild(h('div', { style: 'flex:1;overflow:auto' }, [h('pre', { class: 'preview-text', text: t })]));
      openModal(f.name, wrap, 'wide flush');
    }
  }

  function openPlans() {
    closeMenus();
    var plans = state.cfg.plans || [];
    if (!plans.length) { toast('Planerna laddas när One AI Cloud är ansluten.'); return; }
    var current = state.me ? state.me.plan : 'lite';
    var grid = h('div', { class: 'plans' });
    plans.forEach(function (p) {
      var isCur = p.id === current;
      grid.appendChild(h('div', { class: 'plan' + (isCur ? ' current' : '') }, [
        h('h3', { text: p.name }),
        h('div', { class: 'price', html: p.price ? nf(p.price) + ' kr <small>/ månad</small>' : '0 kr <small>/ månad</small>' }),
        h('p', { class: 'tag', text: p.tagline }),
        h('ul', {}, p.points.map(function (pt) { return h('li', { text: pt }); })),
        h('button', { class: 'btn' + (isCur ? ' secondary' : ''), type: 'button', disabled: isCur, text: isCur ? 'Din plan' : (p.price ? 'Välj ' + p.name : 'Byt till ' + p.name),
          onclick: function () { checkout(p); } })
      ]));
    });
    var body = h('div', {}, [h('p', { class: 'cycle', text: 'Priser i svenska kronor per månad. Byt eller avsluta när du vill.' }), grid]);
    openModal('Planer', body, 'wide');
  }

  function checkout(p) {
    var err = h('p', { class: 'form-error', hidden: true });
    var btn = h('button', { class: 'btn', type: 'button', text: p.price ? 'Betala ' + nf(p.price) + ' kr' : 'Byt plan' });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      Api.subscribe(p.id).then(function (me) {
        state.me = me; Store.set('me', me);
        renderAccount(); renderModelMenu(); renderAgentMenu();
        closeModal();
        toast('Du har nu ' + p.name + (me.receipt ? ' · kvitto ' + me.receipt : ''));
      }).catch(function (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; });
    });
    openModal(p.name, h('div', {}, [
      h('dl', { class: 'kv' }, [h('dt', { text: 'Plan' }), h('dd', { text: p.name }), h('dt', { text: 'Pris' }),
        h('dd', { text: p.price ? nf(p.price) + ' kr per månad, förnyas varje månad' : 'Gratis' })]),
      h('ul', { class: 'muted' }, p.points.map(function (pt) { return h('li', { text: pt }); })),
      p.price ? h('p', { class: 'muted', text: 'Betalningen är en demo: inget kort behövs och inga pengar dras. Planen aktiveras direkt.' }) : null,
      err,
      h('div', { class: 'row' }, [btn, h('button', { class: 'btn secondary', type: 'button', text: 'Tillbaka', onclick: openPlans })])
    ]));
  }

  // --- settings -------------------------------------------------------------------

  function openSettings(tab) {
    closeMenus();
    tab = tab || 'general';
    var tabs = [['general', 'Allmänt'], ['account', 'Konto och plan'], ['mcp', 'Kopplingar (MCP)'], ['data', 'Data']];
    var content = h('div', {});
    var bar = h('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
      return h('button', { class: 'tab' + (t[0] === tab ? ' active' : ''), type: 'button', role: 'tab', text: t[1], onclick: function () { openSettings(t[0]); } });
    }));
    openModal('Inställningar', h('div', {}, [bar, content]));
    ({ general: settingsGeneral, account: settingsAccount, mcp: settingsMcp, data: settingsData })[tab](content);
  }

  function settingsGeneral(el) {
    var s = Store.get('settings', {});
    var theme = h('select', { class: 'input', 'aria-label': 'Tema' }, [['system', 'Som systemet'], ['light', 'Ljust'], ['dark', 'Mörkt']].map(function (o) {
      return h('option', { value: o[0], selected: (s.theme || 'system') === o[0], text: o[1] });
    }));
    theme.addEventListener('change', function () { s.theme = theme.value; Store.set('settings', s); applyTheme(); });
    var url = h('input', { class: 'input', type: 'url', placeholder: (window.ONE_CONFIG && ONE_CONFIG.cloudUrl) || 'https://din-server.example.com', value: s.cloudUrl || '' });
    var saveUrl = h('button', { class: 'btn small', type: 'button', text: 'Spara och anslut', onclick: function () {
      s.cloudUrl = url.value.trim(); Store.set('settings', s);
      Store.remove('token'); state.me = null; Store.remove('me');
      connect().then(function () { toast(Api.configured() ? 'Ansluten till ' + Api.base() : 'Ingen server angiven'); });
    } });
    el.appendChild(h('div', {}, [
      h('div', { class: 'field' }, [h('label', { text: 'Tema' }), theme]),
      h('div', { class: 'field' }, [h('label', { text: 'One AI Cloud-server' }), url,
        h('small', { text: 'Lämna tomt för standardservern. Nu: ' + (Api.base() || 'ingen') }), h('div', { class: 'row', style: 'margin-top:8px' }, [saveUrl])]),
      h('dl', { class: 'kv' }, [h('dt', { text: 'Version' }), h('dd', { text: 'One AI 1.0.0 (' + OneBridge.version() + ')' })])
    ]));
  }

  function settingsAccount(el) {
    var me = state.me;
    if (!me) { el.appendChild(h('p', { class: 'muted', text: 'Inte ansluten till One AI Cloud än.' })); return; }
    var p = plan(me.plan);
    el.appendChild(h('dl', { class: 'kv' }, [
      h('dt', { text: 'Plan' }), h('dd', { text: me.planName + (p && p.price ? ' · ' + nf(p.price) + ' kr/mån' : '') }),
      h('dt', { text: 'Användning i dag' }), h('dd', { text: me.units == null ? 'Obegränsad (' + nf(me.usedToday) + ' enheter använda)' : nf(me.usedToday) + ' av ' + nf(me.unitsPerDay) + ' enheter' }),
      h('dt', { text: 'Modeller' }), h('dd', { text: me.models.map(function (id) { var m = model(id); return m ? m.name : id; }).join(', ') }),
      h('dt', { text: 'Agenter' }), h('dd', { text: me.agents.map(function (id) { var a = agent(id); return a ? a.name : id; }).join(', ') }),
      me.renews ? h('dt', { text: me.cancelled ? 'Slutar' : 'Förnyas' }) : null,
      me.renews ? h('dd', { text: new Date(me.renews).toLocaleDateString('sv-SE') }) : null,
      h('dt', { text: 'Konto-id' }), h('dd', { text: me.account })
    ]));
    var row = h('div', { class: 'row' }, [h('button', { class: 'btn', type: 'button', text: 'Byt plan', onclick: openPlans })]);
    if (p && p.price && !me.cancelled) {
      row.appendChild(h('button', { class: 'btn danger', type: 'button', text: 'Avsluta prenumerationen', onclick: function () {
        if (!confirm('Avsluta ' + me.planName + '? Den gäller perioden ut.')) return;
        Api.cancel().then(function (m) { state.me = m; Store.set('me', m); openSettings('account'); toast('Prenumerationen är avslutad.'); });
      } }));
    }
    el.appendChild(row);
    Api.me().then(function (m) {
      if (!m.receipts || !m.receipts.length) return;
      el.appendChild(h('div', { class: 'section-title', text: 'Kvitton (demo)' }));
      m.receipts.forEach(function (r) {
        el.appendChild(h('div', { class: 'list-item' }, [h('div', { class: 'li-text', html: '<b>' + esc(r.plan) + '</b><small>' + esc(r.ref) + ' · ' +
          new Date(r.at).toLocaleDateString('sv-SE') + '</small>' }), h('span', { text: nf(r.amount) + ' kr' })]));
      });
    }).catch(function () {});
  }

  function settingsMcp(el) {
    var list = h('div', {});
    var limit = state.me ? state.me.mcpLimit : 1;
    function draw(servers) {
      list.innerHTML = '';
      if (!servers.length) list.appendChild(h('p', { class: 'muted', text: 'Inga kopplingar än.' }));
      servers.forEach(function (s) {
        var sw = h('button', { class: 'switch' + (s.enabled ? ' on' : ''), type: 'button', role: 'switch', 'aria-checked': String(s.enabled), 'aria-label': 'Aktiv' });
        sw.addEventListener('click', function () { Api.mcpUpdate(s.id, !s.enabled).then(function (r) { draw(r.servers); }).catch(function (e) { toast(e.message); }); });
        list.appendChild(h('div', { class: 'list-item' }, [
          h('div', { class: 'li-text', html: '<b>' + esc(s.name) + '</b><small>' + esc(s.url) + '</small><small>' + s.tools.length + ' verktyg: ' + esc(s.tools.slice(0, 8).join(', ')) + (s.tools.length > 8 ? '…' : '') + '</small>' }),
          sw,
          h('button', { class: 'icon-btn', type: 'button', title: 'Ta bort', 'aria-label': 'Ta bort', html: ICON.trash, onclick: function () {
            if (confirm('Ta bort ' + s.name + '?')) Api.mcpDelete(s.id).then(function (r) { draw(r.servers); });
          } })
        ]));
      });
    }
    var name = h('input', { class: 'input', placeholder: 'Namn, t.ex. GitHub' });
    var url = h('input', { class: 'input', type: 'url', placeholder: 'https://example.com/mcp' });
    var tok = h('input', { class: 'input', type: 'password', placeholder: 'Åtkomstnyckel (valfritt)', autocomplete: 'off' });
    var err = h('p', { class: 'form-error', hidden: true });
    var add = h('button', { class: 'btn small', type: 'button', text: 'Anslut' });
    add.addEventListener('click', function () {
      add.disabled = true; add.textContent = 'Ansluter…'; err.hidden = true;
      Api.mcpAdd(name.value.trim(), url.value.trim(), tok.value.trim()).then(function (r) {
        draw(r.servers); name.value = url.value = tok.value = ''; toast('Kopplad');
      }).catch(function (e) { err.textContent = e.message; err.hidden = false; })
        .then(function () { add.disabled = false; add.textContent = 'Anslut'; });
    });
    var mcpUrl = Api.base() ? Api.base() + '/mcp' : '(ange serveradress först)';
    var token = Store.get('token', '');
    var snippet = JSON.stringify({ mcpServers: { 'one-ai': { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer ' + (token || '<din nyckel>') } } } }, null, 2);
    var shown = false;
    var tokenBox = h('div', { class: 'snippet', text: token ? token.slice(0, 8) + '••••••••••••' : '—' });
    el.appendChild(h('div', {}, [
      h('div', { class: 'section-title', text: 'Koppla MCP-servrar till One' }),
      h('p', { class: 'muted', text: 'One kan använda verktygen från dina MCP-servrar (Streamable HTTP) i chatten. ' +
        'Din plan har plats för ' + (limit == null ? 'obegränsat antal' : limit) + ' koppling' + (limit === 1 ? '' : 'ar') + '.' }),
      list,
      h('div', { class: 'field', style: 'margin-top:14px' }, [name]),
      h('div', { class: 'field' }, [url]),
      h('div', { class: 'field' }, [tok]),
      err, add,
      h('div', { class: 'section-title', text: 'Använd One i andra appar' }),
      h('p', { class: 'muted', text: 'One AI är också en MCP-server. Lägg till den i Claude, Cursor eller andra MCP-appar med adressen och din nyckel:' }),
      h('div', { class: 'snippet', text: mcpUrl }),
      tokenBox,
      h('div', { class: 'row' }, [
        h('button', { class: 'btn small secondary', type: 'button', text: 'Visa nyckel', onclick: function () { shown = !shown; tokenBox.textContent = shown ? token : token.slice(0, 8) + '••••••••••••'; } }),
        h('button', { class: 'btn small secondary', type: 'button', text: 'Kopiera nyckel', onclick: function () { copy(token); } }),
        h('button', { class: 'btn small secondary', type: 'button', text: 'Kopiera MCP-konfiguration', onclick: function () { copy(snippet); } })
      ]),
      h('p', { class: 'muted', style: 'margin-top:10px', text: 'Verktyg: one_chat (fråga en One-modell), one_create (låt en agent skapa filer) och one_account. Håll nyckeln hemlig: den ger tillgång till ditt konto.' })
    ]));
    Api.mcpList().then(function (r) { draw(r.servers); }).catch(function (e) { list.appendChild(h('p', { class: 'form-error', text: e.message })); });
  }

  function settingsData(el) {
    el.appendChild(h('div', {}, [
      h('p', { class: 'muted', text: 'Chattar och filer sparas bara på den här enheten.' }),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn danger', type: 'button', text: 'Radera alla chattar', onclick: function () {
          if (!confirm('Radera alla chattar på den här enheten?')) return;
          Chats.clear().then(function () { state.chat = null; return loadChats(); }).then(function () { renderThread(); closeModal(); toast('Alla chattar är raderade.'); });
        } })
      ])
    ]));
  }

  // --- wiring --------------------------------------------------------------------

  function wire() {
    $('openSide').addEventListener('click', function () { setSide(true); });
    $('closeSide').addEventListener('click', function () { setSide(false); });
    $('backdrop').addEventListener('click', function () { setSide(false); });
    $('newChat').addEventListener('click', newChat);
    $('newChatTop').addEventListener('click', newChat);
    $('search').addEventListener('input', function (e) { state.search = e.target.value; renderChatList(); });
    $('accountBtn').addEventListener('click', function () { openSettings('account'); });
    $('upgradeBtn').addEventListener('click', openPlans);
    ['modelBtn', 'agentBtn'].forEach(function (id) {
      $(id).addEventListener('click', function (e) {
        e.stopPropagation();
        var d = $(id).parentNode, open = d.classList.contains('open');
        closeMenus();
        if (!open) d.classList.add('open');
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.menu')) closeMenus(); });
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('modal').hidden) closeModal(); else closeMenus(); } });

    var input = $('input');
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isPhone()) { e.preventDefault(); send(); }
    });
    input.addEventListener('paste', function (e) {
      var files = Array.prototype.filter.call((e.clipboardData && e.clipboardData.files) || [], function () { return true; });
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
    $('composer').addEventListener('submit', function (e) { e.preventDefault(); send(); });
    $('attachBtn').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) { addFiles(e.target.files); e.target.value = ''; });
    var hint = null;
    window.addEventListener('dragover', function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') < 0) return;
      e.preventDefault();
      if (!hint) { hint = h('div', { class: 'drop-hint', text: 'Släpp filerna för att bifoga dem' }); document.body.appendChild(hint); }
    });
    window.addEventListener('dragleave', function (e) { if (!e.relatedTarget && hint) { hint.remove(); hint = null; } });
    window.addEventListener('drop', function (e) {
      if (hint) { hint.remove(); hint = null; }
      if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); }
    });

    var sug = $('suggestions');
    SUGGESTIONS.forEach(function (s) {
      sug.appendChild(h('button', { class: 'suggestion', type: 'button', onclick: function () {
        if (hasAgent(s.agent)) setAgent(s.agent); else setAgent('auto');
        input.value = s.prompt; autosize(); input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      } }, [h('span', { text: s.icon }), s.text]));
    });
    window.addEventListener('focus', function () { if (Api.configured()) refreshMe().catch(function () {}); });
  }

  // Android's back button asks the page first.
  window.OneApp = {
    back: function () {
      if (!$('modal').hidden) { closeModal(); return true; }
      if (document.querySelector('.dropdown.open')) { closeMenus(); return true; }
      if (isPhone() && !$('app').classList.contains('side-closed')) { setSide(false); return true; }
      if (state.chat) { newChat(); return true; }
      return false;
    },
    state: state
  };

  function init() {
    applyTheme();
    setSide(isPhone() ? false : Store.get('sideOpen', true));
    wire();
    renderModelMenu(); renderAgentMenu(); renderAccount(); setModel(state.model);
    updateSend();
    loadChats();
    connect();
    if (!isPhone()) $('input').focus();
  }

  init();
})();
