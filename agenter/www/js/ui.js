/* UI glue: sessions, transcript, artifacts, settings, and the plan surfaces. */
(function () {
  'use strict';
  var Store = AGENTER.Store, CFG = AGENTER.CONFIG, Agent = AGENTER.Agent,
      Paywall = AGENTER.Paywall;

  function $(id) { return document.getElementById(id); }
  var elPrompt, elSend, elTranscript, elHint, elToast;
  var session = null, busy = false;

  /* ── tiny markdown ──────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  }

  function markdown(src) {
    var out = [], lines = String(src).split('\n'), i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (/^```/.test(line)) {                       // fenced code
        var lang = line.slice(3).trim(), buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code data-lang="' + esc(lang) + '">' +
                 esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      var h = /^(#{2,4})\s+(.*)$/.exec(line);
      if (h) { out.push('<h3>' + inline(h[2]) + '</h3>'); i++; continue; }

      if (/^\s*[-*]\s+/.test(line)) {                // bullet run
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {             // numbered run
        var oi = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          oi.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + oi.join('') + '</ol>');
        continue;
      }

      if (!line.trim()) { i++; continue; }

      var para = [];                                  // paragraph run
      while (i < lines.length && lines[i].trim() &&
             !/^```/.test(lines[i]) && !/^#{2,4}\s/.test(lines[i]) &&
             !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('');
  }

  /* ── toast ──────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    elToast.textContent = msg;
    elToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.hidden = true; }, 3200);
  }

  /* ── sessions ───────────────────────────────────────────── */
  function newSession() {
    session = { id: 'S' + Date.now(), title: 'New session', turns: [] };
    var all = Store.sessions();
    all.unshift(session);
    Store.saveSessions(all);
    Store.setCurrentId(session.id);
    render();
    paintSessions();
  }

  function persist() {
    var all = Store.sessions().filter(function (s) { return s.id !== session.id; });
    all.unshift(session);
    Store.saveSessions(all);
  }

  function loadSession(id) {
    var found = Store.sessions().filter(function (s) { return s.id === id; })[0];
    if (!found) return newSession();
    session = found;
    Store.setCurrentId(id);
    render();
    paintSessions();
  }

  function paintSessions() {
    var list = $('sessionList');
    list.innerHTML = '';
    Store.sessions().forEach(function (s) {
      var b = document.createElement('button');
      b.textContent = s.title;
      if (session && s.id === session.id) b.className = 'active';
      b.onclick = function () { loadSession(s.id); closeSidebar(); };
      list.appendChild(b);
    });
    $('topTitle').textContent = session ? session.title : 'New session';
  }

  /* ── plan surfaces ──────────────────────────────────────── */
  function paintPlan() {
    var pro = Store.isPro();
    var badge = $('planBadge');
    badge.textContent = pro ? 'Pro' : 'Free';
    badge.className = 'plan-badge' + (pro ? ' pro' : '');

    var u = Store.usage(), lim = Store.limit(), pct = Math.min(100, u.used / lim * 100);
    $('usageCard').innerHTML =
      '<b>' + Store.remaining() + '</b> of ' + lim + ' runs left today' +
      '<div class="usage-bar' + (Store.remaining() === 0 ? ' full' : '') +
      '"><i style="width:' + pct + '%"></i></div>';

    var deal = $('dealCard');
    if (pro) {
      deal.innerHTML = '';
    } else {
      deal.innerHTML =
        '<button class="deal-card" id="dealBtn">' +
        '<b>🎒 Back To School — ' + CFG.deal.percentOff + '% off</b>' +
        '<small>Pro for ' + AGENTER.money(CFG.price.discounted) + '/mo · 5× the usage</small>' +
        '</button>';
      $('dealBtn').onclick = function () { Paywall.open(null); };
    }
  }

  /* ── artifacts ──────────────────────────────────────────── */
  function artifactNode(block) {
    var wrap = document.createElement('div');
    wrap.className = 'artifact';

    var head = document.createElement('div');
    head.className = 'artifact-head';
    head.innerHTML = '<span>' + esc(block.kind) + '</span>' +
                     '<span class="grow">' + esc(block.filename) + '</span>';

    var openBtn = document.createElement('button');
    openBtn.textContent = 'Open';
    openBtn.onclick = function () {
      var w = window.open('', '_blank');
      if (w) { w.document.write(block.html); w.document.close(); }
      else toast('Popup blocked — use Download instead.');
    };

    var dlBtn = document.createElement('button');
    var isCordova = !!window.cordova;
    dlBtn.textContent = isCordova ? 'Copy source' : 'Download';
    dlBtn.onclick = function () {
      if (isCordova) {
        AGENTER.Device.copy(block.html)
          .then(function () { toast('HTML copied to the clipboard.'); })
          .catch(function () { toast('Clipboard is unavailable here.'); });
        return;
      }
      var blob = new Blob([block.html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = block.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    };

    head.appendChild(openBtn);
    head.appendChild(dlBtn);
    wrap.appendChild(head);

    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-downloads allow-same-origin');
    frame.setAttribute('title', block.kind + ' preview');
    frame.srcdoc = block.html;
    wrap.appendChild(frame);

    return wrap;
  }

  function deviceNode() {
    var wrap = document.createElement('div');
    wrap.className = 'artifact';
    var head = document.createElement('div');
    head.className = 'artifact-head';
    head.innerHTML = '<span>Device control</span><span class="grow">live</span>';

    var buzz = document.createElement('button');
    buzz.textContent = 'Vibrate';
    buzz.onclick = function () {
      toast(AGENTER.Device.vibrate(240) ? 'Buzzed.' : 'No vibration motor here.');
    };
    var copy = document.createElement('button');
    copy.textContent = 'Copy report';
    copy.onclick = function () {
      AGENTER.Device.report().then(function (r) {
        return AGENTER.Device.copy(r).then(function () { toast('Report copied.'); });
      }).catch(function () { toast('Clipboard is unavailable here.'); });
    };
    head.appendChild(buzz); head.appendChild(copy);
    wrap.appendChild(head);
    return wrap;
  }

  /* ── transcript ─────────────────────────────────────────── */
  function turnNode(role) {
    var t = document.createElement('div');
    t.className = 'turn ' + role;
    var av = document.createElement('div');
    av.className = 'av';
    if (role === 'bot') AGENTER.paintRobot(av); else av.textContent = 'You';
    var bub = document.createElement('div');
    bub.className = 'bubble';
    t.appendChild(av); t.appendChild(bub);
    return { root: t, bubble: bub };
  }

  function paintBlocks(bubble, blocks) {
    blocks.forEach(function (b) {
      if (b.type === 'md') {
        var d = document.createElement('div');
        d.innerHTML = markdown(b.text);
        bubble.appendChild(d);
      } else if (b.type === 'artifact') {
        bubble.appendChild(artifactNode(b));
      } else if (b.type === 'device') {
        bubble.appendChild(deviceNode());
      } else if (b.type === 'refusal') {
        var r = document.createElement('div');
        r.className = 'refusal';
        r.innerHTML = '<span class="no">No.</span>' +
          '<div>' + esc(b.capability.label) + ' is a Pro capability, and you are on Free. ' +
          'I will not build it on this plan.</div>';
        var up = document.createElement('button');
        up.className = 'inline-upsell';
        up.textContent = 'See Pro — ' + CFG.deal.percentOff + '% off';
        up.onclick = function () { Paywall.open(b.capability); };
        r.appendChild(up);
        bubble.appendChild(r);
      }
    });
  }

  function render() {
    elTranscript.innerHTML = '';
    if (!session || !session.turns.length) { paintEmpty(); return; }
    session.turns.forEach(function (t) {
      var n = turnNode(t.role === 'user' ? 'user' : 'bot');
      if (t.role === 'user') n.bubble.textContent = t.text;
      else paintBlocks(n.bubble, t.blocks || [{ type: 'md', text: t.text || '' }]);
      elTranscript.appendChild(n.root);
    });
    elTranscript.scrollTop = elTranscript.scrollHeight;
  }

  function paintEmpty() {
    var wrap = document.createElement('div');
    wrap.className = 'empty';
    var hero = document.createElement('div');
    hero.className = 'hero';
    AGENTER.paintRobot(hero);
    wrap.appendChild(hero);

    var h = document.createElement('h2');
    h.textContent = 'Agenter';
    var p = document.createElement('p');
    p.textContent = 'Your own AI coding agent. Ask it to build something.';
    wrap.appendChild(h); wrap.appendChild(p);

    var grid = document.createElement('div');
    grid.className = 'chip-grid';
    [['Make a 3D game', true], ['Build a Cordova app', true], ['Make a video about my project', true],
     ['Animation for a loading state', true], ['Device control panel', true],
     ['Explain this stack trace', false]].forEach(function (pair) {
      var b = document.createElement('button');
      b.innerHTML = esc(pair[0]) + (pair[1] && !Store.isPro() ? '<span class="lock">🔒</span>' : '');
      b.onclick = function () {
        elPrompt.value = pair[0];
        elPrompt.dispatchEvent(new Event('input'));
        elPrompt.focus();
      };
      grid.appendChild(b);
    });
    wrap.appendChild(grid);
    elTranscript.appendChild(wrap);
  }

  /* ── send ───────────────────────────────────────────────── */
  function autosize() {
    elPrompt.style.height = 'auto';
    elPrompt.style.height = Math.min(168, elPrompt.scrollHeight) + 'px';
  }

  function send() {
    if (busy) return;
    var text = elPrompt.value.trim();
    if (!text) return;

    // Belt and braces: paste and autofill both fire `input`, but if anything
    // slipped past the watcher, the gate still holds here.
    var cap = Agent.classify(text);
    if (cap && !Store.isPro()) { Paywall.open(cap); return; }

    elPrompt.value = '';
    autosize();
    elHint.hidden = true;

    if (!session) newSession();
    if (session.turns.length === 0) {
      session.title = text.length > 38 ? text.slice(0, 36).trim() + '…' : text;
    }
    session.turns.push({ role: 'user', text: text });
    persist(); paintSessions(); render();

    var pending = turnNode('bot');
    pending.bubble.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
    elTranscript.appendChild(pending.root);
    elTranscript.scrollTop = elTranscript.scrollHeight;

    busy = true; elSend.disabled = true;

    var history = session.turns.slice(0, -1).map(function (t) {
      return { role: t.role === 'user' ? 'user' : 'model',
               text: t.role === 'user' ? t.text : plainOf(t) };
    });

    Agent.respond(text, history).then(function (res) {
      session.turns.push({ role: 'bot', blocks: res.blocks });
      persist();
      pending.bubble.innerHTML = '';
      paintBlocks(pending.bubble, res.blocks);
      elTranscript.scrollTop = elTranscript.scrollHeight;
    }).catch(function (err) {
      pending.bubble.innerHTML = markdown('**Something went wrong.** ' +
        (err && err.message ? err.message : String(err)));
    }).then(function () {
      busy = false; elSend.disabled = false;
      paintPlan();
      elPrompt.focus();
    });
  }

  function plainOf(turn) {
    return (turn.blocks || []).filter(function (b) { return b.type === 'md'; })
                              .map(function (b) { return b.text; }).join('\n\n') || '(artifact)';
  }

  /* ── settings ───────────────────────────────────────────── */
  function openSettings() {
    $('setKey').value = Store.apiKey();
    $('setModel').value = Store.model();
    paintPlanSwitch();
    $('settings').hidden = false;
  }

  function paintPlanSwitch() {
    var pro = Store.isPro();
    $('setFree').className = pro ? '' : 'on';
    $('setPro').className = pro ? 'on' : '';
    $('setPlanNote').textContent = pro
      ? 'Pro: ' + CFG.limits.pro + ' runs a day, every capability unlocked.'
      : 'Free: ' + CFG.limits.free + ' runs a day. Gated capabilities are refused.';
  }

  /* ── sidebar (narrow) ───────────────────────────────────── */
  function closeSidebar() { $('sidebar').classList.remove('open'); }

  /* ── boot ───────────────────────────────────────────────── */
  function boot() {
    elPrompt     = $('prompt');
    elSend       = $('send');
    elTranscript = $('transcript');
    elHint       = $('triggerHint');
    elToast      = $('toast');

    AGENTER.paintRobot($('brandMark'));

    Paywall.init({
      onLeave: function () {
        var had = elPrompt.value.length > 0;
        elPrompt.value = '';
        autosize();
        elHint.hidden = true;
        if (had) toast('Prompt cleared — that is the cost of leaving the Pro page.');
      },
      onBuy: function (cap) {
        paintPlan(); render(); paintPlanSwitch();
        toast('Pro is on. ' + CFG.limits.pro + ' runs a day, everything unlocked.');
        if (cap) elPrompt.focus();
      }
    });

    Paywall.watch(elPrompt, function (cap) {
      if (cap && Store.isPro()) {
        elHint.hidden = false;
        elHint.textContent = cap.label + ' — unlocked on Pro. Send when ready.';
      } else {
        elHint.hidden = true;
      }
    });

    elPrompt.addEventListener('input', autosize);
    elPrompt.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    elSend.onclick = send;

    $('newChat').onclick = function () { newSession(); closeSidebar(); };
    $('menuBtn').onclick = function () { $('sidebar').classList.toggle('open'); };
    $('openSettings').onclick = openSettings;
    $('setClose').onclick = function () { $('settings').hidden = true; };
    $('settings').onclick = function (e) {
      if (e.target === $('settings')) $('settings').hidden = true;
    };
    $('setFree').onclick = function () { Store.setPlan('free'); paintPlanSwitch(); paintPlan(); render(); };
    $('setPro').onclick  = function () { Store.setPlan('pro');  paintPlanSwitch(); paintPlan(); render(); };
    $('setSave').onclick = function () {
      Store.setApiKey($('setKey').value);
      Store.setModel($('setModel').value);
      $('settings').hidden = true;
      toast(Store.hasKey() ? 'Key saved on this device.' : 'Running in offline demo mode.');
      paintPlan();
    };

    var current = Store.currentId();
    var known = Store.sessions();
    if (current && known.some(function (s) { return s.id === current; })) loadSession(current);
    else if (known.length) loadSession(known[0].id);
    else newSession();

    paintPlan();
    autosize();
  }

  if (window.cordova) document.addEventListener('deviceready', boot, false);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
