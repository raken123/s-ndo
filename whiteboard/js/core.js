/* Sändo Tavla — kärna: tavlor, sidor, komponenter, krediter, lagring och UI-hjälpmedel */
(function (global) {
  'use strict';

  var PREFIX = 'sandotavla.';

  function makeStore(prefix) {
    return {
      prefix: prefix,
      get: function (key, fallback) {
        try {
          var raw = localStorage.getItem(this.prefix + key);
          return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { /* fullt */ }
      },
      del: function (key) {
        try { localStorage.removeItem(this.prefix + key); } catch (e) { /* noop */ }
      }
    };
  }
  var Store = makeStore(PREFIX);

  var App = {
    tools: [],
    timers: [],
    Store: Store,
    version: '1.5.0',

    /* ---------- Komponentregister ---------- */
    register: function (tool) {
      this.tools.push(tool);
      return tool;
    },
    byId: function (id) {
      return this.tools.filter(function (t) { return t.id === id; })[0] || null;
    },

    /* ---------- Widgetkontext: egen lagring och egna intervall per komponent ---------- */
    makeCtx: function (widgetId) {
      var ctx = Object.create(this);
      ctx.widgetId = widgetId;
      ctx.timers = [];
      ctx.Store = makeStore(PREFIX + 'w.' + widgetId + '.');
      ctx.every = function (ms, fn) {
        var id = setInterval(fn, ms);
        this.timers.push(id);
        return id;
      };
      ctx.stop = function (id) {
        clearInterval(id);
        this.timers = this.timers.filter(function (t) { return t !== id; });
      };
      ctx.clearTimers = function () {
        this.timers.forEach(clearInterval);
        this.timers = [];
      };
      return ctx;
    },
    dropWidgetData: function (widgetId) {
      var p = PREFIX + 'w.' + widgetId + '.';
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(p) === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    },

    /* ---------- Intervall på appnivå ---------- */
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

    /* ---------- Krediter ----------
       Två nivåer: alla får 5 000 kr gratis, en verifierad lärare får
       5 000 000 kr. Nivån bestäms av App.Verify, aldrig av saldot självt. */
    Credits: {
      START: 5000,
      VERIFIED: 5000000,
      IN: 80,
      OUT: 300,
      tier: function () { return App.Verify.isVerified() ? this.VERIFIED : this.START; },
      balance: function () { return Store.get('credits', this.tier()); },
      log: function () { return Store.get('creditLog', []); },
      canAfford: function (kind) { return this.balance() >= (kind === 'out' ? this.OUT : this.IN); },
      charge: function (kind, note) {
        var cost = kind === 'out' ? this.OUT : this.IN;
        var bal = this.balance();
        if (bal < cost) return false;
        Store.set('credits', bal - cost);
        this.note({ kind: kind, cost: cost, note: note || '' });
        return true;
      },
      note: function (rad) {
        var log = this.log();
        rad.t = Date.now();
        log.unshift(rad);
        Store.set('creditLog', log.slice(0, 60));
        App.renderCredits();
      },
      /* Verifieringen fyller på till den högre nivån. Redan förbrukade
         krediter kommer inte tillbaka utöver det — saldot sätts till nivån. */
      unlock: function () {
        var bal = this.balance();
        if (bal >= this.VERIFIED) return 0;
        var pafyllning = this.VERIFIED - bal;
        Store.set('credits', this.VERIFIED);
        this.note({ kind: 'unlock', cost: -pafyllning, note: 'Lärarverifiering' });
        return pafyllning;
      },
      /* Tas verifieringen bort går saldot tillbaka till den fria nivån. */
      lock: function () {
        var bal = this.balance();
        if (bal <= this.START) { App.renderCredits(); return 0; }
        var drag = bal - this.START;
        Store.set('credits', this.START);
        this.note({ kind: 'lock', cost: drag, note: 'Verifieringen togs bort' });
        return drag;
      },
      reset: function () {
        Store.set('credits', this.tier());
        Store.set('creditLog', []);
        App.renderCredits();
      },
      fmt: function (n) { return n.toLocaleString('sv-SE') + ' kr'; }
    },
    renderCredits: function () {
      var chip = document.getElementById('credit-chip');
      if (!chip) return;
      var b = this.Credits.balance();
      chip.textContent = '💳 ' + this.Credits.fmt(b) + (this.Verify.isVerified() ? ' ✓' : '');
      chip.className = 'dock-chip' + (b < this.Credits.OUT ? ' alert' : '');
    },

    /* ---------- Lärarverifiering ----------
       Läraren skannar sitt id-kort med kameran för att komma upp på den högre
       kreditnivån. Bilden granskas på plattan, i minnet, och kastas direkt
       efteråt: den sparas aldrig och lämnar aldrig enheten. Det som sparas är
       namn, skola och tidpunkt. Appen kan inte slå upp någon mot ett register
       — kontrollen är att bilden håller måttet och att läraren intygar sina
       uppgifter, och det står så i rutan. */
    Verify: {
      state: function () { return Store.get('verify', { status: 'none' }); },
      isVerified: function () { return this.state().status === 'verified'; },

      /* Granskar den skannade bilden: skärpa, kontrast och hur mycket av rutan
         kortet fyller. Returnerar mätvärdena och vad som behöver bli bättre. */
      inspect: function (canvas) {
        var c = canvas.getContext('2d', { willReadFrequently: true });
        var w = canvas.width, h = canvas.height;
        var d = c.getImageData(0, 0, w, h).data;
        var lum = new Float32Array(w * h);
        var i, x, y, sum = 0;
        for (i = 0; i < w * h; i++) {
          lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
          sum += lum[i];
        }
        var medel = sum / (w * h);
        var varians = 0;
        for (i = 0; i < w * h; i++) varians += (lum[i] - medel) * (lum[i] - medel);
        var kontrast = Math.sqrt(varians / (w * h));

        /* Skärpa: medelbeloppet av en laplacian. Ett suddigt eller skakigt
           kort ger ett lågt värde även om kontrasten är hög. */
        var kant = 0, n = 0;
        for (y = 1; y < h - 1; y++) {
          for (x = 1; x < w - 1; x++) {
            i = y * w + x;
            kant += Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]);
            n++;
          }
        }
        var skarpa = kant / Math.max(1, n);

        /* Fyllnad: hur stor del av rutan som skiljer sig från kanten runt om.
           Ett kort som hålls för långt bort fyller för lite. */
        var kantSum = 0, kantN = 0;
        for (x = 0; x < w; x++) { kantSum += lum[x] + lum[(h - 1) * w + x]; kantN += 2; }
        for (y = 0; y < h; y++) { kantSum += lum[y * w] + lum[y * w + w - 1]; kantN += 2; }
        var bakgrund = kantSum / kantN;
        var traffar = 0;
        for (i = 0; i < w * h; i++) if (Math.abs(lum[i] - bakgrund) > 26) traffar++;
        var fyllnad = traffar / (w * h);

        var fel = [];
        if (medel < 38) fel.push('För mörkt — tänd mer ljus.');
        else if (medel > 225) fel.push('För ljust — flytta bort reflexen.');
        if (kontrast < 16) fel.push('Kortet syns knappt — lägg det mot ett mörkare underlag.');
        if (skarpa < 2.2) fel.push('Suddigt — håll kortet stilla en sekund till.');
        if (fyllnad < 0.22) fel.push('Kortet fyller för lite — håll det närmare kameran.');
        return {
          ok: fel.length === 0,
          fel: fel,
          medel: Math.round(medel),
          kontrast: Math.round(kontrast),
          skarpa: Math.round(skarpa * 10) / 10,
          fyllnad: Math.round(fyllnad * 100)
        };
      },

      approve: function (namn, skola) {
        Store.set('verify', {
          status: 'verified',
          namn: String(namn || '').trim(),
          skola: String(skola || '').trim(),
          at: Date.now()
        });
        var p = App.Credits.unlock();
        App.renderCredits();
        return p;
      },
      clear: function () {
        Store.del('verify');
        App.Credits.lock();
        App.renderCredits();
      }
    },

    /* ---------- Tavlor och sidor ---------- */
    Boards: {
      /* Tavlorna hålls som ett levande objekt i minnet — allt som ändras i det
         sparas med persist(). Läses de om från lagringen vid varje anrop
         försvinner ändringar i sidor, penndrag och komponenter. */
      _boards: null,
      all: function () {
        if (!this._boards) {
          var b = Store.get('boards', null);
          if (!b || !b.length) b = [this.blank('Tavla 1')];
          this._boards = b;
          this.persist();
        }
        return this._boards;
      },
      persist: function () { Store.set('boards', this._boards); },
      save: function (boards) {
        if (boards) this._boards = boards;
        this.persist();
      },
      blank: function (name) {
        return {
          id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name || 'Ny tavla',
          created: Date.now(),
          pages: [this.blankPage('Sida 1')]
        };
      },
      blankPage: function (name) {
        return {
          id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name || 'Ny sida',
          bg: 'blank',
          strokes: [],
          widgets: []
        };
      },
      activeId: function () { return Store.get('activeBoard', null); },
      setActive: function (id) { Store.set('activeBoard', id); },
      active: function () {
        var boards = this.all();
        var id = this.activeId();
        var found = boards.filter(function (b) { return b.id === id; })[0];
        if (!found) { found = boards[0]; this.setActive(found.id); }
        return found;
      },
      activePageIndex: function () {
        var i = Store.get('activePage.' + this.active().id, 0);
        var pages = this.active().pages;
        return (i >= 0 && i < pages.length) ? i : 0;
      },
      setActivePage: function (i) { Store.set('activePage.' + this.active().id, i); },
      activePage: function () { return this.active().pages[this.activePageIndex()]; }
    },

    /* ---------- Vyer: tavla, översikt, helskärmsverktyg ---------- */
    view: 'board',
    open: function (id) {
      /* Öppnar en komponent i helskärm (används av Inställningar och av "maximera") */
      var tool = this.byId(id);
      if (!tool) return;
      this.closeFull();
      var host = document.getElementById('full-view');
      host.innerHTML = '';
      host.classList.remove('hidden');
      var ctx = this.makeCtx('full.' + id);
      ctx.fullscreen = true;
      this._full = { tool: tool, ctx: ctx };
      var head = this.el('div', 'full-head');
      head.appendChild(this.el('div', 'full-title', tool.icon + '  ' + tool.name));
      var close = this.button('✕ Stäng', 'sm ghost', function () { App.closeFull(); });
      head.appendChild(close);
      host.appendChild(head);
      var body = this.el('div', 'full-body');
      host.appendChild(body);
      try { tool.mount(body, ctx); } catch (err) {
        body.innerHTML = '<div class="card">Komponenten kunde inte startas: ' + this.esc(String(err && err.message || err)) + '</div>';
      }
    },
    closeFull: function () {
      if (this._full) {
        var t = this._full.tool;
        if (typeof t.unmount === 'function') { try { t.unmount(); } catch (e) { /* noop */ } }
        this._full.ctx.clearTimers();
        this._full = null;
      }
      var host = document.getElementById('full-view');
      if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
    },
    home: function () {
      this.closeFull();
      if (global.Board) Board.showBoard();
    },
    handleBack: function () {
      if (!document.getElementById('modal').classList.contains('hidden')) { this.hideModal(); return true; }
      if (this._full) { this.closeFull(); return true; }
      if (global.Board && Board.handleBack()) return true;
      return false;
    },

    /* ---------- Klasslistor ---------- */
    classes: function () {
      return Store.get('classes', [{ name: 'Klass 1', students: [] }]);
    },
    saveClasses: function (list) { Store.set('classes', list); },
    activeIndex: function () {
      var i = Store.get('activeClass', 0);
      var list = this.classes();
      return (i >= 0 && i < list.length) ? i : 0;
    },
    activeClass: function () {
      return this.classes()[this.activeIndex()] || { name: 'Klass 1', students: [] };
    },
    setActiveClass: function (i) { Store.set('activeClass', i); },
    students: function () { return (this.activeClass().students || []).slice(); },

    /* ---------- Mikrofon: en ljudkälla för hela appen ----------
       Alla komponenter prenumererar på samma ström i stället för att öppna
       var sin — annars nekar enheten den andra. Två motorer finns: webbens
       getUserMedia, och Android-appens AudioRecord som reserv när WebView
       svarar NotReadableError ("Could not start audio source"). Båda levererar
       16 kHz PCM16, så resten av appen märker ingen skillnad. */
    Mic: {
      backend: '',            /* '' | 'web' | 'native' */
      users: 0,
      level: 0,
      error: '',
      usingLabel: '',
      lastTried: [],
      subs: [],
      pending: null,
      stream: null,

      deviceId: function () { return Store.get('mic.deviceId', ''); },
      setDeviceId: function (id) { Store.set('mic.deviceId', id || ''); },
      android: function () { return global.AndroidBridge && AndroidBridge.startNativeMic ? AndroidBridge : null; },
      fileOrigin: function () { return !global.AndroidBridge && location.protocol === 'file:'; },
      live: function () { return this.backend === 'native' || (!!this.stream && this.stream.getAudioTracks().some(function (t) { return t.readyState === 'live'; })); },

      message: function (err) {
        var name = err && err.name ? err.name : String(err || 'okänt fel');
        if (this.fileOrigin()) {
          return 'Mikrofonen är blockerad eftersom sidan är öppnad som en fil (file://) i en ' +
            'webbläsare. Installera APK:n på plattan, eller kör appen via https eller localhost.';
        }
        if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
          return 'Mikrofonen är blockerad. Tillåt mikrofon för appen i enhetens inställningar och försök igen.';
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          return 'Ingen mikrofon hittades på enheten.';
        }
        if (name === 'OverconstrainedError') {
          return 'Den valda mikrofonen finns inte längre — välj en annan under Inställningar.';
        }
        return 'Mikrofonen kunde inte startas (' + name + '). Kör 🩺 Mikrofondiagnos för att se varför.';
      },

      /* ---- Prenumeranter: får nivå (0–100) och råljud (Int16Array, 16 kHz) ---- */
      subscribe: function (fn) { this.subs.push(fn); },
      unsubscribe: function (fn) { this.subs = this.subs.filter(function (f) { return f !== fn; }); },
      feed: function (pcm) {
        var sum = 0, i;
        for (i = 0; i < pcm.length; i++) {
          var v = pcm[i] / 32768;
          sum += v * v;
        }
        var rms = Math.sqrt(sum / Math.max(1, pcm.length));
        var lvl = Math.min(100, Math.max(0, Math.round((20 * Math.log10(rms + 1e-8) + 70) * 1.6)));
        this.level = Math.round(this.level * 0.6 + lvl * 0.4);
        var self = this;
        this.subs.forEach(function (fn) {
          try { fn(self.level, pcm); } catch (e) { /* en trasig lyssnare får inte stoppa resten */ }
        });
      },

      /* ---- Start: webben först, Android-mikrofonen som reserv ---- */
      start: function (cb) {
        var self = this;
        if (this.backend && this.live()) { this.users++; cb(null); return; }
        if (this.pending) { this.pending.push(cb); return; }
        this.pending = [cb];
        this.lastTried = [];

        var done = function (err) {
          var waiting = self.pending || [];
          self.pending = null;
          if (err) {
            self.error = err;
            waiting.forEach(function (fn) { fn(err); });
          } else {
            self.error = '';
            self.users += waiting.length;
            waiting.forEach(function (fn) { fn(null); });
          }
        };
        var goNative = function (webErr) {
          var bridge = self.android();
          if (!bridge || Store.get('mic.forceWeb', false)) { done(webErr); return; }
          var res = bridge.startNativeMic();
          self.lastTried.push('Android AudioRecord: ' + res);
          if (res === 'ok') {
            self.backend = 'native';
            self.usingLabel = 'Androids mikrofon (AudioRecord)';
            global.__nativeAudio = function (b64) { self.onNativeChunk(b64); };
            done(null);
          } else {
            done(webErr + ' Androids egen mikrofon svarade: ' + res + '.');
          }
        };

        if (Store.get('mic.forceNative', false) && this.android()) { goNative(''); return; }
        this.webStart(function (err) {
          if (!err) { done(null); return; }
          goNative(err);
        });
      },
      onNativeChunk: function (b64) {
        var bin;
        try { bin = atob(b64); } catch (e) { return; }
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        this.feed(new Int16Array(bytes.buffer));
      },

      /* ---- Webbmotorn ---- */
      plan: function (cb) {
        var saved = this.deviceId();
        var list = [];
        if (saved) list.push({ label: 'vald mikrofon', c: { audio: { deviceId: { exact: saved } } } });
        list.push({ label: 'standard utan filter', c: { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } } });
        list.push({ label: 'standard', c: { audio: true } });
        this.devices(function (devs) {
          devs.forEach(function (d, i) {
            if (!d.deviceId || d.deviceId === saved || d.deviceId === 'default') return;
            list.push({ label: d.label || ('inspelningsenhet ' + (i + 1)), id: d.deviceId, c: { audio: { deviceId: { exact: d.deviceId } } } });
          });
          cb(list);
        });
      },
      webStart: function (cb) {
        var self = this;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          cb('Mikrofon stöds inte i den här vyn (' + location.protocol + ').');
          return;
        }
        this.plan(function (attempts) {
          var run = function (i, lastErr) {
            if (i >= attempts.length) { cb(self.message(lastErr)); return; }
            var a = attempts[i];
            navigator.mediaDevices.getUserMedia(a.c)
              .then(function (stream) {
                self.lastTried.push(a.label + ': OK');
                if (a.id) self.setDeviceId(a.id);
                if (!self.attach(stream)) { cb('Ljudmotorn kunde inte startas'); return; }
                cb(null);
              })
              .catch(function (err) {
                var name = err && err.name ? err.name : 'fel';
                self.lastTried.push(a.label + ': ' + name + (err && err.message ? ' (' + err.message + ')' : ''));
                setTimeout(function () { run(i + 1, err); }, name === 'NotReadableError' || name === 'AbortError' ? 300 : 0);
              });
          };
          run(0, null);
        });
      },
      attach: function (stream) {
        var self = this;
        var ac = App.audioCtx();
        if (!ac) { stream.getTracks().forEach(function (t) { t.stop(); }); return false; }
        var src = ac.createMediaStreamSource(stream);
        var proc = ac.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = function (e) {
          if (self.backend !== 'web') return;
          self.feed(self.toPcm16(e.inputBuffer.getChannelData(0), ac.sampleRate));
        };
        src.connect(proc);
        var mute = ac.createGain();
        mute.gain.value = 0;
        proc.connect(mute);
        mute.connect(ac.destination);
        this.stream = stream;
        this.src = src;
        this.proc = proc;
        this.backend = 'web';
        stream.getAudioTracks().forEach(function (t) {
          self.usingLabel = t.label || 'mikrofon';
          t.onended = function () { self.lost(); };
        });
        return true;
      },
      /* Nedsamplar till 16 kHz PCM16, formatet Gemini Live vill ha */
      toPcm16: function (float32, sampleRate) {
        var ratio = sampleRate / 16000;
        var len = Math.floor(float32.length / ratio);
        var out = new Int16Array(len);
        for (var i = 0; i < len; i++) {
          var s = Math.max(-1, Math.min(1, float32[Math.floor(i * ratio)]));
          out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
      },

      /* ---- Stopp ---- */
      release: function () {
        this.users = Math.max(0, this.users - 1);
        if (this.users === 0) this.shutdown();
      },
      hardRelease: function () {
        if (global.Trams && Trams.armed) Trams.stop();
        if (App.Noise && App.Noise.on) App.Noise.stop();
        this.users = 0;
        this.shutdown();
      },
      shutdown: function () {
        if (this.backend === 'native' && this.android()) {
          try { AndroidBridge.stopNativeMic(); } catch (e) { /* noop */ }
          global.__nativeAudio = null;
        }
        if (this.src) { try { this.src.disconnect(); } catch (e) { /* noop */ } this.src = null; }
        if (this.proc) { try { this.proc.disconnect(); } catch (e) { /* noop */ } this.proc = null; }
        if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
        this.backend = '';
        this.level = 0;
        this.usingLabel = '';
      },
      lost: function () {
        this.users = 0;
        this.shutdown();
        this.error = 'Mikrofonen kopplades bort.';
        if (global.Trams && Trams.armed) Trams.stop();
        if (App.Noise && App.Noise.on) App.Noise.stop();
        App.toast('Mikrofonen kopplades bort');
      },

      devices: function (cb) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { cb([]); return; }
        navigator.mediaDevices.enumerateDevices()
          .then(function (list) { cb(list.filter(function (d) { return d.kind === 'audioinput'; })); })
          .catch(function () { cb([]); });
      },

      /* Mäter toppnivån i några sekunder så att man ser att mikrofonen lever */
      test: function (onLevel, onDone) {
        var self = this;
        this.start(function (err) {
          if (err) { onDone(err, 0); return; }
          var peak = 0;
          var listener = function (lvl) { if (lvl > peak) peak = lvl; onLevel(lvl); };
          self.subscribe(listener);
          setTimeout(function () {
            self.unsubscribe(listener);
            self.release();
            onDone(null, peak);
          }, 3500);
        });
      },

      /* Full diagnos: webbläsarens bild och Android-appens egen bild av mikrofonen */
      diagnose: function (cb) {
        var self = this;
        var out = [];
        out.push('Sändo Tavla ' + App.version + ' — mikrofondiagnos');
        out.push(new Date().toLocaleString('sv-SE'));
        out.push('Adress: ' + location.protocol + '//' + (location.host || '(fil)'));
        out.push('Säker kontext: ' + (window.isSecureContext ? 'ja' : 'NEJ — mikrofon kan blockeras'));
        out.push('I Android-appen: ' + (global.AndroidBridge ? 'ja' : 'nej (webbläsare)'));
        if (self.fileOrigin()) {
          out.push('!! Sidan körs som en fil i en webbläsare. Webbläsare släpper inte fram');
          out.push('!! mikrofonen från file:// — använd APK:n eller kör via https/localhost.');
        }
        out.push('mediaDevices: ' + (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'finns' : 'SAKNAS'));
        out.push('Ljudmotor: ' + (App._ac ? App._ac.state : 'ej startad'));
        out.push('Aktiv motor: ' + (self.backend || 'ingen') + (self.usingLabel ? ' (' + self.usingLabel + ')' : ''));

        /* Androids egen bild av läget säger mer än webbläsarens felkoder */
        if (global.AndroidBridge && AndroidBridge.micStatus) {
          out.push('');
          out.push('Android:');
          try {
            var st = JSON.parse(AndroidBridge.micStatus());
            out.push('  Behörighet RECORD_AUDIO: ' + st.permission);
            out.push('  Enheten har mikrofon: ' + (st.hasMicFeature ? 'ja' : 'NEJ'));
            out.push('  Mikrofonen mutad i systemet: ' + (st.micMuted ? 'JA — det blockerar inspelning' : 'nej'));
            out.push('  Andra appar som spelar in: ' + (st.otherAppsRecording === undefined ? 'okänt' : st.otherAppsRecording));
            out.push('  Ljudläge: ' + st.audioMode);
            (st.inputs || []).forEach(function (d, i) {
              out.push('  Ingång ' + (i + 1) + ': ' + d.type + ' — ' + d.name);
            });
            (st.probe || []).forEach(function (line) { out.push('  AudioRecord ' + line); });
          } catch (e) {
            out.push('  kunde inte läsas: ' + e.message);
          }
        }

        var afterPerm = function () {
          self.devices(function (devs) {
            out.push('');
            out.push('Webbläsarens inspelningsenheter: ' + devs.length);
            devs.forEach(function (d, i) {
              out.push('  ' + (i + 1) + '. ' + (d.label || '(namn dolt tills mikrofonen godkänts)') +
                ' [' + (String(d.deviceId).slice(0, 12) || 'inget id') + ']');
            });
            out.push('');
            out.push('Öppningsförsök (detektorerna stängs av under testet):');
            self.hardRelease();
            var anyOk = false;
            self.plan(function (attempts) {
              var i = 0;
              var next = function () {
                if (i >= attempts.length) {
                  out.push('');
                  if (anyOk) {
                    out.push('Resultat: mikrofonen fungerar. Starta detektorn igen.');
                  } else if (global.AndroidBridge && AndroidBridge.startNativeMic) {
                    out.push('Resultat: WebView vägrar. Appen använder då Androids egen mikrofon');
                    out.push('(AudioRecord) automatiskt — se raderna under "Android" ovan för om');
                    out.push('någon ljudkälla svarade OK.');
                  } else {
                    out.push('Resultat: ingen ingång gick att öppna.');
                  }
                  cb(out.join('\n'));
                  return;
                }
                var a = attempts[i++];
                navigator.mediaDevices.getUserMedia(a.c)
                  .then(function (stream) {
                    anyOk = true;
                    var label = (stream.getAudioTracks()[0] || {}).label || '';
                    out.push('  ' + a.label + ': OK' + (label ? ' → ' + label : ''));
                    stream.getTracks().forEach(function (t) { t.stop(); });
                    setTimeout(next, 250);
                  })
                  .catch(function (err) {
                    out.push('  ' + a.label + ': ' + (err && err.name ? err.name : 'fel') +
                      (err && err.message ? ' — ' + err.message : ''));
                    setTimeout(next, 400);
                  });
              };
              next();
            });
          });
        };

        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'microphone' })
            .then(function (p) { out.push('Behörighet enligt webbläsaren: ' + p.state); afterPerm(); })
            .catch(function () { out.push('Behörighet enligt webbläsaren: kan inte läsas'); afterPerm(); });
        } else {
          out.push('Behörighet enligt webbläsaren: kan inte läsas');
          afterPerm();
        }
      }
    },

    /* ---------- Gemini: nycklar, dokument och anrop ----------
       Alla AI-komponenter går genom det här objektet. Håll listan komplett:
       key, model, textModel, authMode, setAuthMode, wsParam, call, liveModels,
       docs, uploadFile, generate, testKey. */
    Gemini: {
      key: function () { return Store.get('gemini.key', ''); },
      model: function () { return Store.get('gemini.model', 'gemini-3.1-flash-live-preview'); },
      textModel: function () { return Store.get('gemini.textModel', 'gemini-3.5-flash'); },

      /* Gemini-API:t vill ha nyckeln som ?key= — även nycklar som inte börjar
         med AIza. ?access_token= gäller bara riktiga OAuth-token, och
         nyckeltestet skriver över valet om det visar sig vara tvärtom. */
      authMode: function () { return Store.get('gemini.auth', 'key'); },
      setAuthMode: function (mode) { Store.set('gemini.auth', mode === 'token' ? 'token' : 'key'); },
      wsParam: function () {
        return (this.authMode() === 'key' ? 'key=' : 'access_token=') + encodeURIComponent(this.key());
      },

      /* Alla nätanrop får en tidsgräns — annars står ett kort och "tänker" för
         evigt när skolans wifi hänger sig. cb(fel, json) */
      call: function (url, opts, cb) {
        var timeout = (opts && opts.timeout) || 60000;
        var ctrl = global.AbortController ? new AbortController() : null;
        var timedOut = false;
        var timer = setTimeout(function () {
          timedOut = true;
          if (ctrl) ctrl.abort();
        }, timeout);
        var init = { method: (opts && opts.method) || 'GET' };
        if (opts && opts.headers) init.headers = opts.headers;
        if (opts && opts.body) init.body = opts.body;
        if (ctrl) init.signal = ctrl.signal;
        fetch(url, init)
          .then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); })
          .then(function (res) {
            clearTimeout(timer);
            var json = null;
            try { json = JSON.parse(res.text); } catch (e) { json = null; }
            if (!json) { cb('Oväntat svar från Google (HTTP ' + res.status + ').'); return; }
            if (json.error) { cb('Google svarade: ' + json.error.message, json); return; }
            cb(null, json);
          })
          .catch(function (err) {
            clearTimeout(timer);
            cb(timedOut
              ? 'AI:n svarade inte inom ' + Math.round(timeout / 1000) + ' sekunder. Kontrollera nätet och försök igen.'
              : 'Kunde inte nå Gemini: ' + (err && err.message ? err.message : 'nätverksfel'));
          });
      },

      /* Hämtar de modeller nyckeln har tillgång till och plockar ut live-modellerna */
      liveModels: function (cb) {
        this.call('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(this.key()),
          { timeout: 30000 }, function (err, j) {
            if (err) { cb([], []); return; }
            var all = (j.models || []).map(function (m) { return String(m.name).replace('models/', ''); });
            cb(all.filter(function (m) { return m.indexOf('live') >= 0 || m.indexOf('native-audio') >= 0; }), all);
          });
      },

      /* ---- Dokumentbiblioteket: PDF:er som AI-Läraren utgår från ---- */
      docs: {
        all: function () {
          return Store.get('gemini.docs', []).filter(function (d) {
            return !d.expires || new Date(d.expires).getTime() > Date.now();
          });
        },
        save: function (list) { Store.set('gemini.docs', list); },
        add: function (doc) {
          var list = Store.get('gemini.docs', []);
          list.unshift(doc);
          this.save(list);
        },
        remove: function (id) {
          this.save(Store.get('gemini.docs', []).filter(function (d) { return d.id !== id; }));
        },
        /* Delarna som skickas med i varje fråga så att svaren håller sig till materialet */
        parts: function (ids) {
          return this.all()
            .filter(function (d) { return !ids || ids.indexOf(d.id) >= 0; })
            .map(function (d) { return { fileData: { mimeType: d.mime, fileUri: d.uri } }; });
        },
        summary: function () {
          var all = this.all();
          if (!all.length) return 'Inga dokument tillagda.';
          return all.map(function (d) { return d.kind + ': ' + d.name; }).join(' · ');
        }
      },

      /* Laddar upp en PDF till Gemini. Filen ligger kvar i 48 timmar hos Google
         och räknas som en input. cb(fel, dokument) */
      uploadFile: function (file, kind, cb) {
        var self = this;
        if (!this.key()) { cb('Ingen API-nyckel inlagd.'); return; }
        if (!App.Credits.charge('in', 'Uppladdning: ' + file.name)) {
          cb('Krediterna räcker inte till en uppladdning.');
          return;
        }
        this.call('https://generativelanguage.googleapis.com/upload/v1beta/files?key=' +
          encodeURIComponent(this.key()), {
          method: 'POST',
          timeout: 120000,
          headers: {
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-File-Name': file.name,
            'Content-Type': file.type || 'application/pdf'
          },
          body: file
        }, function (err, j) {
          if (err) { cb(err); return; }
          var f = j.file || {};
          self.docs.add({
            id: 'd' + Date.now().toString(36),
            name: file.name,
            kind: kind || 'material',
            uri: f.uri,
            mime: f.mimeType || file.type || 'application/pdf',
            size: file.size,
            expires: f.expirationTime || '',
            added: Date.now()
          });
          cb(null, self.docs.all()[0]);
        });
      },

      /* Ett vanligt AI-anrop. opts: {prompt, system, docIds, history, model,
         temperature, maxTokens, useDocs, label}. cb(fel, text, hela svaret) */
      generate: function (opts, cb) {
        if (!this.key()) { cb('Ingen API-nyckel inlagd. Lägg in den under ⚙️ Inställningar.'); return; }
        if (!App.Credits.canAfford('in')) { cb('Krediterna är slut.'); return; }
        var parts = [];
        if (opts.useDocs !== false) {
          parts = parts.concat(this.docs.parts(opts.docIds));
        }
        parts.push({ text: opts.prompt });
        var body = {
          contents: (opts.history || []).concat([{ role: 'user', parts: parts }]),
          generationConfig: {
            temperature: opts.temperature == null ? 0.4 : opts.temperature,
            maxOutputTokens: opts.maxTokens || 4000
          }
        };
        if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
        App.Credits.charge('in', opts.label || 'AI-fråga');
        this.call('https://generativelanguage.googleapis.com/v1beta/models/' +
          (opts.model || this.textModel()) + ':generateContent?key=' + encodeURIComponent(this.key()), {
          method: 'POST',
          timeout: opts.timeout || 75000,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }, function (err, j) {
          if (err) { cb(err); return; }
          var c = (j.candidates || [])[0] || {};
          var text = ((c.content || {}).parts || []).map(function (p) { return p.text || ''; }).join('').trim();
          if (!text) {
            cb(c.finishReason === 'MAX_TOKENS'
              ? 'Svaret blev för långt och klipptes. Prova en kortare fråga.'
              : 'AI:n svarade inget (' + (c.finishReason || 'okänd orsak') + ').');
            return;
          }
          App.Credits.charge('out', opts.label || 'AI-svar');
          cb(null, text, j);
        });
      },

      /* Frågar Google vad nyckeln duger till och rapporterar svaret rakt av */
      testKey: function (cb) {
        var self = this;
        var key = this.key();
        if (!key) { cb({ ok: false, text: 'Ingen nyckel inlagd.' }); return; }
        var base = 'https://generativelanguage.googleapis.com/v1beta/models';
        var ways = [
          { mode: 'key', label: '?key=', url: base + '?key=' + encodeURIComponent(key), headers: null },
          { mode: 'token', label: '?access_token=', url: base + '?access_token=' + encodeURIComponent(key), headers: null },
          { mode: 'token', label: 'Authorization: Bearer', url: base, headers: { Authorization: 'Bearer ' + key } }
        ];
        var lines = [];
        var i = 0;
        var next = function () {
          if (i >= ways.length) {
            cb({ ok: false, text: lines.join('\n') + '\n\nIngen av metoderna godkändes.' });
            return;
          }
          var w = ways[i++];
          var init = { method: 'GET' };
          if (w.headers) init.headers = w.headers;
          var ctrl = global.AbortController ? new AbortController() : null;
          if (ctrl) {
            init.signal = ctrl.signal;
            setTimeout(function () { ctrl.abort(); }, 25000);
          }
          fetch(w.url, init)
            .then(function (res) {
              return res.text().then(function (text) {
                var msg = '';
                try {
                  var j = JSON.parse(text);
                  msg = (j.error && j.error.message) ? j.error.message : '';
                  if (!msg && j.models) msg = j.models.length + ' modeller tillgängliga';
                } catch (e) { msg = text.slice(0, 160); }
                lines.push(w.label + ' → HTTP ' + res.status + (msg ? ': ' + msg : ''));
                return res.ok ? w : null;
              });
            })
            .catch(function (err) {
              lines.push(w.label + ' → nådde inte servern (' + (err && err.message ? err.message : 'nätverksfel') + ')');
              return null;
            })
            .then(function (winner) {
              /* Utanför fetch-kedjans catch: ett fel här nere ska inte
                 rapporteras som att servern inte gick att nå. */
              if (!winner) { next(); return; }
              self.setAuthMode(winner.mode);
              cb({
                ok: true,
                mode: winner.mode,
                text: lines.join('\n') + '\n\nNyckeln fungerar. Appen använder ' + winner.label
              });
            });
        };
        next();
      }
    },

    /* ---------- Ljud ---------- */
    audioCtx: function () {
      if (!this._ac) {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;
        App._ac = new Ctx();
      }
      if (App._ac.state === 'suspended') { App._ac.resume(); }
      return App._ac;
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
    /* Larmslinga som ljuder tills den stoppas — används av Tramsdetektorn */
    alarm: {
      on: false, iv: 0,
      start: function () {
        if (this.on) return;
        this.on = true;
        var tick = function () {
          if (!App.alarm.on) return;
          App.beep(1480, 260, 'square', 0.5);
          setTimeout(function () { if (App.alarm.on) App.beep(1180, 260, 'square', 0.5); }, 300);
        };
        tick();
        this.iv = setInterval(tick, 900);
      },
      stop: function () {
        this.on = false;
        clearInterval(this.iv);
        this.iv = 0;
      }
    },
    speak: function (text) {
      if (Store.get('mute', false) || !global.speechSynthesis) return;
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'sv-SE';
        u.rate = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* saknas i vyn */ }
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
    modal: function (title, bodyNode, onOk, okLabel, onClose) {
      var m = document.getElementById('modal');
      document.getElementById('modal-title').textContent = title;
      var body = document.getElementById('modal-body');
      body.innerHTML = '';
      if (typeof bodyNode === 'string') { body.innerHTML = bodyNode; } else if (bodyNode) { body.appendChild(bodyNode); }
      var ok = document.getElementById('modal-ok');
      ok.textContent = okLabel === false ? 'OK' : (okLabel || 'OK');
      /* okLabel === false betyder att rutan har egna knappar i kroppen —
         då ska den delade foten inte ligga kvar med en andra Avbryt-knapp. */
      m.querySelector('.modal-actions').classList.toggle('hidden', okLabel === false);
      m.classList.remove('hidden');
      App._modalOk = onOk || null;
      App._modalClose = onClose || null;
    },
    hideModal: function () {
      var m = document.getElementById('modal');
      m.classList.add('hidden');
      m.querySelector('.modal-actions').classList.remove('hidden');
      App._modalOk = null;
      var fn = App._modalClose;
      App._modalClose = null;
      if (fn) fn();
    },
    confirm: function (title, text, onYes) {
      this.modal(title, '<p style="font-size:17px;line-height:1.5">' + this.esc(text) + '</p>', onYes, 'Ja');
    },
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
    /* .mid-num är dimensionerad för korta tal som "5 000 kr". Ett sjusiffrigt
       belopp spränger kortet, så storleken får krympa med längden. */
    midNum: function (text) {
      var n = String(text).length;
      var st = n > 9 ? ' style="font-size:clamp(26px,' + (81 / n).toFixed(1) + 'vw,' +
        Math.round(864 / n) + 'px)"' : '';
      return '<div class="mid-num"' + st + '>' + this.esc(text) + '</div>';
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
      if (global.Board) Board.redraw();
    },
    toggleFullscreen: function () {
      var d = document;
      if (!d.fullscreenElement) {
        if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen();
        else if (global.AndroidBridge && AndroidBridge.setImmersive) AndroidBridge.setImmersive(true);
      } else if (d.exitFullscreen) { d.exitFullscreen(); }
      else if (global.AndroidBridge && AndroidBridge.setImmersive) { AndroidBridge.setImmersive(false); }
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

    /* ---------- Mini-dock ---------- */
    dock: { noiseOn: false, noiseAlert: false },
    renderDock: function () {
      var d = document.getElementById('mini-dock');
      if (!d) return;
      d.innerHTML = '';
      if (this.dock.noiseOn) {
        var n = this.el('div', 'dock-chip' + (this.dock.noiseAlert ? ' alert' : ''), '🔊 Ljudvakt');
        d.appendChild(n);
      }
      if (global.Trams && Trams.armed) {
        var t = this.el('div', 'dock-chip' + (Trams.timeoutUntil > Date.now() ? ' alert' : ''), '🤖 Tramsdetektor');
        d.appendChild(t);
      }
    },

    /* ---------- Start ---------- */
    boot: function () {
      var self = this;
      this.applyTheme();
      this.renderCredits();

      document.getElementById('btn-theme').addEventListener('click', function () { self.toggleTheme(); });
      document.getElementById('btn-full').addEventListener('click', function () { self.toggleFullscreen(); });
      document.getElementById('btn-settings').addEventListener('click', function () { self.open('settings'); });
      document.getElementById('modal-cancel').addEventListener('click', function () { self.hideModal(); });
      document.getElementById('modal-ok').addEventListener('click', function () {
        var fn = self._modalOk;
        self.hideModal();
        if (fn) fn();
      });
      document.getElementById('modal').addEventListener('click', function (e) {
        if (e.target.id === 'modal') self.hideModal();
      });
      document.getElementById('credit-chip').addEventListener('click', function () { self.showCredits(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') self.handleBack();
      });

      Board.init();

      setInterval(function () {
        document.getElementById('topclock').textContent = self.fmtClock(new Date());
        self.renderDock();
      }, 1000);
      document.getElementById('topclock').textContent = this.fmtClock(new Date());

      var unlock = function () {
        self.audioCtx();
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('mousedown', unlock);
      };
      document.addEventListener('touchstart', unlock);
      document.addEventListener('mousedown', unlock);
    },

    /* Kör mikrofondiagnosen och visar rapporten i en ruta som går att markera */
    micDiagnosis: function () {
      var box = this.el('div', 'col');
      var info = this.el('div', 'muted', 'Testar mikrofonen — det tar några sekunder…');
      var ta = this.el('textarea');
      ta.style.cssText = 'width:100%;height:320px;font-family:monospace;font-size:13px';
      ta.readOnly = true;
      box.appendChild(info);
      box.appendChild(ta);
      this.modal('🩺 Mikrofondiagnos', box, null, 'Stäng');
      this.Mic.diagnose(function (text) {
        info.textContent = 'Klart. Markera texten om du vill skicka den vidare.';
        ta.value = text;
      });
    },

    showCredits: function () {
      var c = this.Credits;
      var v = this.Verify.state();
      var box = this.el('div', 'col');
      var head = this.el('div', 'card');
      head.innerHTML = '<div class="muted">Saldo</div>' + this.midNum(c.fmt(c.balance())) +
        '<div class="muted" style="margin-top:8px">Nivå: ' +
        (v.status === 'verified'
          ? 'verifierad lärare — ' + c.fmt(c.VERIFIED)
          : 'gratis — ' + c.fmt(c.START) + ' (verifiera dig som lärare för ' + c.fmt(c.VERIFIED) + ')') +
        '<br>Input: ' + c.fmt(c.IN) + ' per lyssning · Output: ' + c.fmt(c.OUT) + ' per tillsägelse</div>';
      box.appendChild(head);
      if (v.status !== 'verified') {
        var upp = this.el('div', 'row');
        upp.style.marginBottom = '10px';
        upp.appendChild(this.button('🪪 Verifiera dig som lärare', 'sm', function () { App.showVerify(); }));
        box.appendChild(upp);
      }
      var log = c.log();
      var list = this.el('div', 'list');
      if (!log.length) {
        list.appendChild(this.el('div', 'muted', 'Inga kreditdragningar än.'));
      } else {
        log.slice(0, 25).forEach(function (e) {
          var row = App.el('div', 'list-item');
          var etikett = { out: 'Output', in: 'Input', unlock: 'Verifiering', lock: 'Nivå bort' }[e.kind] || 'Input';
          row.innerHTML = '<span class="pill">' + etikett + '</span>' +
            '<span class="grow">' + App.esc(e.note || '') + '</span>' +
            '<span class="muted">' + (e.cost < 0 ? '+' + c.fmt(-e.cost) : '−' + c.fmt(e.cost)) + '</span>' +
            '<span class="muted">' + App.fmtClock(new Date(e.t)) + '</span>';
          list.appendChild(row);
        });
      }
      box.appendChild(list);
      this.modal('💳 Användningskrediter', box, null, 'Stäng');
    },

    /* Läromedel har ofta ett förbehåll på sista sidan om AI-träning. Appen kan
       inte läsa det åt läraren, så den frågar i stället — varje gång, eftersom
       svaret gäller den enskilda boken. Båda uppladdningsvägarna går här. */
    confirmUpload: function (f, fortsatt) {
      var box = App.el('div', 'col');
      var v = App.el('div', 'card');
      v.style.cssText = 'border:2px solid var(--warn);border-left-width:10px';
      v.innerHTML = '<b style="font-size:18px">⚠️ Har du läst sista sidan i boken?</b>' +
        '<p style="font-size:16px;line-height:1.6;margin-top:8px">Innan <b>' + App.esc(f.name) +
        '</b> laddas upp: slå upp sista sidan i boken, där copyright och ISBN står.</p>' +
        '<p style="font-size:16px;line-height:1.6;margin-top:8px">Står det där att materialet ' +
        '<b>inte får användas för att träna AI</b> — eller för maskininlärning, textutvinning ' +
        'eller språkmodeller — då ska du inte ladda upp den. Avbryt här.</p>' +
        '<p class="muted" style="font-size:14px;line-height:1.6;margin-top:10px">' +
        'Filen skickas till Google och ligger kvar där i 48 timmar. Uppladdningen kostar ' +
        App.Credits.fmt(App.Credits.IN) + '.</p>';
      box.appendChild(v);

      var rad = App.el('label', 'row');
      rad.style.cssText = 'align-items:flex-start;flex-wrap:nowrap;margin:4px 2px 0;cursor:pointer';
      var kryss = App.el('input');
      kryss.type = 'checkbox';
      kryss.style.width = '24px';
      kryss.style.height = '24px';
      kryss.style.marginTop = '2px';
      var etikett = App.el('span', null,
        'Jag har läst sista sidan och det står inget förbud mot att använda materialet med AI.');
      etikett.style.cssText = 'font-size:15px;line-height:1.5;flex:1';
      rad.appendChild(kryss);
      rad.appendChild(etikett);
      box.appendChild(rad);

      var knappar = App.el('div', 'row');
      knappar.style.marginTop = '12px';
      knappar.appendChild(App.button('Avbryt', 'ghost', function () { App.hideModal(); }));
      knappar.appendChild(App.button('⬆️ Ladda upp', '', function () {
        if (!kryss.checked) { App.toast('Kryssa i rutan först — eller avbryt', 3000); return; }
        App.hideModal();
        fortsatt();
      }));
      box.appendChild(knappar);
      App.modal('📄 ' + f.name, box, null, false);
    },

    /* Skanna id-kortet för att komma upp på lärarnivån. Bilden ligger bara i
       minnet under granskningen och kastas när rutan stängs. */
    showVerify: function (onDone) {
      var self = this;
      var c = this.Credits;
      var box = this.el('div', 'col');
      var stream = null, video = null;

      function stoppa() {
        if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
        video = null;
      }

      function steg1() {
        box.innerHTML = '';
        var info = self.el('div', 'card');
        info.innerHTML =
          '<h3 style="font-size:20px;margin-bottom:8px">Lärarnivå: ' + c.fmt(c.VERIFIED) + '</h3>' +
          '<p style="font-size:16px;line-height:1.6">Håll ditt id-kort eller din lärarlegitimation ' +
          'framför kameran och skanna det. Då höjs krediterna från ' + c.fmt(c.START) + ' till ' +
          c.fmt(c.VERIFIED) + '.</p>' +
          '<p class="muted" style="font-size:14px;line-height:1.6;margin-top:10px">' +
          '<b>Bilden sparas inte.</b> Den granskas här på plattan och kastas direkt efteråt — ' +
          'den skickas aldrig någonstans. Det som sparas är namnet, skolan och datumet.<br>' +
          'Appen kan inte slå upp dig mot något lärarregister. Kontrollen är att bilden håller ' +
          'måttet och att du intygar att uppgifterna stämmer.</p>';
        box.appendChild(info);
        var r = self.el('div', 'row');
        r.appendChild(self.button('📷 Starta kameran', '', starta));
        r.appendChild(self.button('Avbryt', 'ghost', function () { self.hideModal(); }));
        box.appendChild(r);
      }

      function starta() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          self.toast('Den här enheten har ingen kamera som appen kommer åt', 4000);
          return;
        }
        box.innerHTML = '';
        box.appendChild(self.el('div', 'muted', 'Startar kameran…'));
        navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
          .then(function (st) {
            stream = st;
            video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.srcObject = st;
            video.style.width = '100%';
            video.style.maxWidth = '520px';
            video.style.borderRadius = '14px';
            video.style.border = '3px dashed var(--brand, #4f46e5)';
            video.play();
            steg2();
          })
          .catch(function (err) {
            box.innerHTML = '';
            var f = self.el('div', 'card');
            f.innerHTML = '<p style="font-size:16px;line-height:1.6">Kameran kunde inte startas (' +
              self.esc(err && err.name ? err.name : 'fel') + ').</p>' +
              '<p class="muted" style="font-size:14px;line-height:1.6;margin-top:8px">' +
              'Ge appen tillgång till kameran i systeminställningarna och försök igen.</p>';
            box.appendChild(f);
            var r = self.el('div', 'row');
            r.appendChild(self.button('↺ Försök igen', 'sm', starta));
            r.appendChild(self.button('Avbryt', 'sm ghost', function () { self.hideModal(); }));
            box.appendChild(r);
          });
      }

      function steg2(varning) {
        box.innerHTML = '';
        var t = self.el('div', 'muted', 'Fyll ut rutan med kortet, håll det stilla och skanna.');
        t.style.marginBottom = '8px';
        box.appendChild(t);
        if (video) box.appendChild(video);
        if (varning) {
          var w = self.el('div', 'card');
          w.style.marginTop = '10px';
          w.innerHTML = '<b>Bilden dög inte:</b><ul style="margin:8px 0 0 20px;line-height:1.6">' +
            varning.fel.map(function (f) { return '<li>' + App.esc(f) + '</li>'; }).join('') + '</ul>' +
            '<p class="muted" style="font-size:13px;margin-top:8px">Skärpa ' + varning.skarpa +
            ' · kontrast ' + varning.kontrast + ' · kortet fyller ' + varning.fyllnad + ' % av rutan</p>';
          box.appendChild(w);
        }
        var r = self.el('div', 'row');
        r.style.marginTop = '10px';
        r.appendChild(self.button('📸 Skanna kortet', '', skanna));
        r.appendChild(self.button('Avbryt', 'ghost', function () { self.hideModal(); }));
        box.appendChild(r);
      }

      function skanna() {
        if (!video) { steg2(); return; }
        var cv = document.createElement('canvas');
        cv.width = 320;
        cv.height = 200;
        try {
          cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
        } catch (e) {
          self.toast('Kameran hann inte starta — försök igen');
          return;
        }
        var res = self.Verify.inspect(cv);
        /* Bilden behövs inte längre: nolla ytan direkt. */
        cv.width = 1; cv.height = 1;
        if (!res.ok) { steg2(res); return; }
        stoppa();
        steg3(res);
      }

      function steg3(res) {
        box.innerHTML = '';
        var kvitto = self.el('div', 'card');
        kvitto.innerHTML = '<b>✓ Kortet är skannat och bilden är kastad.</b>' +
          '<p class="muted" style="font-size:13px;margin-top:6px">Skärpa ' + res.skarpa +
          ' · kontrast ' + res.kontrast + ' · kortet fyllde ' + res.fyllnad + ' % av rutan</p>';
        box.appendChild(kvitto);

        var form = self.el('div', 'card');
        form.innerHTML = '<h3 style="font-size:19px;margin-bottom:10px">Dina uppgifter</h3>';
        var namn = self.el('input');
        namn.type = 'text';
        namn.style.width = '100%';
        namn.placeholder = 'Namn som det står på kortet';
        namn.value = (self.Verify.state().namn || '');
        var skola = self.el('input');
        skola.type = 'text';
        skola.style.width = '100%';
        skola.style.marginTop = '8px';
        skola.placeholder = 'Skola';
        skola.value = (self.Verify.state().skola || '');
        form.appendChild(namn);
        form.appendChild(skola);

        var intyg = self.el('label', 'row');
        intyg.style.cssText = 'align-items:flex-start;flex-wrap:nowrap;margin-top:12px;cursor:pointer';
        var kryss = self.el('input');
        kryss.type = 'checkbox';
        kryss.style.width = '24px';
        kryss.style.height = '24px';
        kryss.style.marginTop = '2px';
        var txt = self.el('span', null,
          'Jag intygar att jag arbetar som lärare och att kortet jag skannade är mitt eget.');
        txt.style.cssText = 'font-size:15px;line-height:1.5;flex:1';
        intyg.appendChild(kryss);
        intyg.appendChild(txt);
        form.appendChild(intyg);
        box.appendChild(form);

        var r = self.el('div', 'row');
        r.appendChild(self.button('Avbryt', 'ghost', function () { self.hideModal(); }));
        var klar = self.button('✓ Verifiera och hämta ' + c.fmt(c.VERIFIED), '', function () {
          if (!namn.value.trim() || !skola.value.trim()) { self.toast('Fyll i namn och skola'); return; }
          if (!kryss.checked) { self.toast('Du måste intyga uppgifterna'); return; }
          var p = self.Verify.approve(namn.value, skola.value);
          self.hideModal();
          self.toast('Verifierad — ' + c.fmt(p) + ' tillagt', 4000);
        });
        r.appendChild(klar);
        box.appendChild(r);
      }

      steg1();
      this.modal('🪪 Verifiera dig som lärare', box, null, false, function () {
        stoppa();
        if (onDone) onDone(self.Verify.isVerified());
      });
    }
  };

  global.App = App;
})(window);
