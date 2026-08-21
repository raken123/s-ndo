/* Sändo Tavla — kärna: lagring, navigering, ljud och gemensamma UI-hjälpmedel */
(function (global) {
  'use strict';

  var PREFIX = 'sandotavla.';

  var Store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* full disk */ }
    },
    del: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* noop */ }
    }
  };

  var App = {
    tools: [],
    current: null,
    timers: [],
    Store: Store,

    /* ---------- Verktygsregister ---------- */
    register: function (tool) {
      this.tools.push(tool);
      return tool;
    },
    byId: function (id) {
      return this.tools.filter(function (t) { return t.id === id; })[0] || null;
    },

    /* ---------- Navigering ---------- */
    open: function (id) {
      var tool = this.byId(id);
      if (!tool) return;
      this.closeCurrent();
      var view = document.getElementById('tool-view');
      view.innerHTML = '';
      document.getElementById('home').classList.add('hidden');
      view.classList.remove('hidden');
      document.getElementById('view-title').textContent = tool.name;
      document.getElementById('view-sub').textContent = tool.desc || '';
      this.current = tool;
      try {
        tool.mount(view, this);
      } catch (err) {
        view.innerHTML = '<div class="tool-body"><div class="card">Verktyget kunde inte startas: ' +
          this.esc(String(err && err.message ? err.message : err)) + '</div></div>';
      }
      Store.set('lastTool', id);
    },
    closeCurrent: function () {
      if (this.current && typeof this.current.unmount === 'function') {
        try { this.current.unmount(); } catch (e) { /* noop */ }
      }
      this.clearTimers();
      this.current = null;
    },
    home: function () {
      this.closeCurrent();
      document.getElementById('tool-view').classList.add('hidden');
      document.getElementById('tool-view').innerHTML = '';
      document.getElementById('home').classList.remove('hidden');
      document.getElementById('view-title').textContent = 'Sändo Tavla';
      document.getElementById('view-sub').textContent = 'Klassrumstavla för tablet & smartboard';
      this.renderHome();
    },
    /* Anropas av Android-appens bakåtknapp. true = appen hanterade tillbaka. */
    handleBack: function () {
      if (!document.getElementById('modal').classList.contains('hidden')) {
        this.hideModal();
        return true;
      }
      if (this.current) { this.home(); return true; }
      return false;
    },

    /* ---------- Intervall som städas när verktyget stängs ---------- */
    every: function (ms, fn) {
      var id = setInterval(fn, ms);
      this.timers.push(id);
      return id;
    },
    stop: function (id) {
      clearInterval(id);
      this.timers = this.timers.filter(function (t) { return t !== id; });
    },
    clearTimers: function () {
      this.timers.forEach(clearInterval);
      this.timers = [];
    },

    /* ---------- Klasslistor ---------- */
    classes: function () {
      return Store.get('classes', [{ name: 'Klass 1', students: [] }]);
    },
    saveClasses: function (list) { Store.set('classes', list); this.renderClassSummary(); },
    activeIndex: function () {
      var i = Store.get('activeClass', 0);
      var list = this.classes();
      return (i >= 0 && i < list.length) ? i : 0;
    },
    activeClass: function () {
      return this.classes()[this.activeIndex()] || { name: 'Klass 1', students: [] };
    },
    setActiveClass: function (i) { Store.set('activeClass', i); this.renderClassSummary(); },
    students: function () {
      return (this.activeClass().students || []).slice();
    },

    /* ---------- Ljud ---------- */
    audioCtx: function () {
      if (!this._ac) {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;
        this._ac = new Ctx();
      }
      if (this._ac.state === 'suspended') { this._ac.resume(); }
      return this._ac;
    },
    beep: function (freq, ms, type, gainValue) {
      if (Store.get('mute', false)) return;
      var ac = this.audioCtx();
      if (!ac) return;
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq || 880;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainValue || 0.25, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (ms || 250) / 1000);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + (ms || 250) / 1000 + 0.03);
    },
    chime: function (times) {
      var n = times || 3, i = 0, self = this;
      var tick = function () {
        if (i >= n) return;
        self.beep(i % 2 === 0 ? 880 : 1170, 220, 'sine', 0.3);
        i++;
        setTimeout(tick, 300);
      };
      tick();
    },

    /* ---------- UI-hjälpmedel ---------- */
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    },
    el: function (tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    },
    toast: function (msg, ms) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { t.classList.add('hidden'); }, ms || 2200);
    },
    modal: function (title, bodyNode, onOk, okLabel) {
      var m = document.getElementById('modal');
      document.getElementById('modal-title').textContent = title;
      var body = document.getElementById('modal-body');
      body.innerHTML = '';
      if (typeof bodyNode === 'string') { body.innerHTML = bodyNode; } else if (bodyNode) { body.appendChild(bodyNode); }
      document.getElementById('modal-ok').textContent = okLabel || 'OK';
      m.classList.remove('hidden');
      this._modalOk = onOk || null;
    },
    hideModal: function () {
      document.getElementById('modal').classList.add('hidden');
      this._modalOk = null;
    },
    confirm: function (title, text, onYes) {
      this.modal(title, '<p style="font-size:17px;line-height:1.5">' + this.esc(text) + '</p>', onYes, 'Ja');
    },

    /* ---------- Layouthjälp för verktyg ---------- */
    layout: function (root, opts) {
      opts = opts || {};
      var wrap = this.el('div', 'tool-wrap');
      var bar = this.el('div', 'tool-bar');
      var body = this.el('div', 'tool-body' + (opts.pad0 ? ' pad0' : '') + (opts.center ? ' center' : ''));
      wrap.appendChild(bar);
      wrap.appendChild(body);
      root.appendChild(wrap);
      return { bar: bar, body: body, wrap: wrap };
    },
    button: function (label, cls, onClick) {
      var b = this.el('button', 'btn ' + (cls || ''), label);
      b.addEventListener('click', onClick);
      return b;
    },

    /* ---------- Tid ---------- */
    pad: function (n) { return (n < 10 ? '0' : '') + n; },
    fmtClock: function (d) { return this.pad(d.getHours()) + ':' + this.pad(d.getMinutes()); },
    fmtDur: function (ms) {
      if (ms < 0) ms = 0;
      var s = Math.round(ms / 1000);
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      return (h > 0 ? h + ':' + this.pad(m) : m) + ':' + this.pad(sec);
    },
    fmtDurMs: function (ms) {
      if (ms < 0) ms = 0;
      var cs = Math.floor((ms % 1000) / 10);
      return this.fmtDur(Math.floor(ms / 1000) * 1000) + '.' + this.pad(cs);
    },
    minutesOf: function (hhmm) {
      var p = String(hhmm || '').split(':');
      return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    },
    nowMinutes: function () {
      var d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    },

    /* ---------- Slump ---------- */
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    },
    randInt: function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    /* ---------- Tema och helskärm ---------- */
    applyTheme: function () {
      var dark = Store.get('dark', false);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      var b = document.getElementById('btn-theme');
      if (b) b.textContent = dark ? '☀️' : '🌙';
    },
    toggleTheme: function () {
      Store.set('dark', !Store.get('dark', false));
      this.applyTheme();
    },
    toggleFullscreen: function () {
      var d = document;
      if (!d.fullscreenElement) {
        if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen();
        else if (global.AndroidBridge && AndroidBridge.setImmersive) AndroidBridge.setImmersive(true);
      } else if (d.exitFullscreen) { d.exitFullscreen(); }
      else if (global.AndroidBridge && AndroidBridge.setImmersive) { AndroidBridge.setImmersive(false); }
    },

    /* ---------- Startsida ---------- */
    renderClassSummary: function () {
      var node = document.getElementById('class-summary');
      if (!node) return;
      var c = this.activeClass();
      node.innerHTML = 'Klass: <b>' + this.esc(c.name) + '</b> · ' + (c.students || []).length + ' elever';
    },
    renderHome: function () {
      var grid = document.getElementById('tool-grid');
      var self = this;
      var q = (document.getElementById('tool-search').value || '').toLowerCase().trim();
      var cat = Store.get('cat', 'Alla');
      grid.innerHTML = '';
      this.tools
        .filter(function (t) {
          if (cat !== 'Alla' && t.cat !== cat) return false;
          if (!q) return true;
          return (t.name + ' ' + (t.desc || '') + ' ' + (t.keys || '')).toLowerCase().indexOf(q) >= 0;
        })
        .forEach(function (t) {
          var card = self.el('button', 'tool-card');
          card.innerHTML =
            '<div class="ic">' + t.icon + '</div>' +
            '<div class="nm">' + self.esc(t.name) + '</div>' +
            '<div class="ds">' + self.esc(t.desc || '') + '</div>' +
            '<div class="tag">' + self.esc(t.cat) + '</div>';
          card.addEventListener('click', function () { self.open(t.id); });
          grid.appendChild(card);
        });
      if (!grid.children.length) {
        grid.innerHTML = '<div class="card muted">Inga verktyg matchar sökningen.</div>';
      }
      this.renderClassSummary();
    },
    renderCats: function () {
      var box = document.getElementById('cat-filter');
      var self = this;
      var cats = ['Alla'];
      this.tools.forEach(function (t) { if (cats.indexOf(t.cat) < 0) cats.push(t.cat); });
      var active = Store.get('cat', 'Alla');
      box.innerHTML = '';
      cats.forEach(function (c) {
        var b = self.el('button', c === active ? 'active' : '', c);
        b.addEventListener('click', function () {
          Store.set('cat', c);
          self.renderCats();
          self.renderHome();
        });
        box.appendChild(b);
      });
    },

    /* ---------- Mini-dock: timer och ljudvakt syns överallt ---------- */
    dock: { timerEnd: 0, noiseOn: false },
    renderDock: function () {
      var d = document.getElementById('mini-dock');
      var self = this;
      d.innerHTML = '';
      if (this.dock.timerEnd > Date.now()) {
        var chip = this.el('div', 'dock-chip', '⏳ ' + this.fmtDur(this.dock.timerEnd - Date.now()));
        chip.addEventListener('click', function () { self.open('timer'); });
        d.appendChild(chip);
      }
      if (this.dock.noiseOn) {
        var n = this.el('div', 'dock-chip' + (this.dock.noiseAlert ? ' alert' : ''), '🔊 Ljudvakt');
        n.addEventListener('click', function () { self.open('noise'); });
        d.appendChild(n);
      }
    },

    /* ---------- Bilder ---------- */
    saveImage: function (canvas, name) {
      var data = canvas.toDataURL('image/png');
      if (global.AndroidBridge && AndroidBridge.saveImage) {
        var res = AndroidBridge.saveImage(data.split(',')[1], name);
        this.toast(res || 'Bild sparad');
        return;
      }
      var a = document.createElement('a');
      a.href = data; a.download = name + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      this.toast('Bild sparad');
    },

    /* ---------- Start ---------- */
    boot: function () {
      var self = this;
      this.applyTheme();
      this.renderCats();
      this.renderHome();

      document.getElementById('btn-home').addEventListener('click', function () { self.home(); });
      document.getElementById('btn-theme').addEventListener('click', function () { self.toggleTheme(); });
      document.getElementById('btn-full').addEventListener('click', function () { self.toggleFullscreen(); });
      document.getElementById('btn-settings').addEventListener('click', function () { self.open('settings'); });
      document.getElementById('tool-search').addEventListener('input', function () { self.renderHome(); });
      document.getElementById('modal-cancel').addEventListener('click', function () { self.hideModal(); });
      document.getElementById('modal-ok').addEventListener('click', function () {
        var fn = self._modalOk;
        self.hideModal();
        if (fn) fn();
      });
      document.getElementById('modal').addEventListener('click', function (e) {
        if (e.target.id === 'modal') self.hideModal();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { if (!self.handleBack()) { /* redan hemma */ } }
      });

      /* Klocka i topbaren + dock-uppdatering, körs alltid */
      setInterval(function () {
        document.getElementById('topclock').textContent = self.fmtClock(new Date());
        self.renderDock();
      }, 1000);
      document.getElementById('topclock').textContent = this.fmtClock(new Date());

      /* Väck ljudmotorn vid första tryck (krav i WebView och webbläsare) */
      var unlock = function () {
        self.audioCtx();
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('mousedown', unlock);
      };
      document.addEventListener('touchstart', unlock);
      document.addEventListener('mousedown', unlock);
    }
  };

  global.App = App;
})(window);
