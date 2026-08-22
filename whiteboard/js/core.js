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
    version: '1.2.0',

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

    /* ---------- Krediter ---------- */
    Credits: {
      START: 5000,
      IN: 80,
      OUT: 300,
      balance: function () { return Store.get('credits', this.START); },
      log: function () { return Store.get('creditLog', []); },
      canAfford: function (kind) { return this.balance() >= (kind === 'out' ? this.OUT : this.IN); },
      charge: function (kind, note) {
        var cost = kind === 'out' ? this.OUT : this.IN;
        var bal = this.balance();
        if (bal < cost) return false;
        Store.set('credits', bal - cost);
        var log = this.log();
        log.unshift({ t: Date.now(), kind: kind, cost: cost, note: note || '' });
        Store.set('creditLog', log.slice(0, 60));
        App.renderCredits();
        return true;
      },
      reset: function () {
        Store.set('credits', this.START);
        Store.set('creditLog', []);
        App.renderCredits();
      },
      fmt: function (n) { return n.toLocaleString('sv-SE') + ' kr'; }
    },
    renderCredits: function () {
      var chip = document.getElementById('credit-chip');
      if (!chip) return;
      var b = this.Credits.balance();
      chip.textContent = '💳 ' + this.Credits.fmt(b);
      chip.className = 'dock-chip' + (b < this.Credits.OUT ? ' alert' : '');
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

    /* ---------- Mikrofon: en enda delad ström för hela appen ----------
       Ljuddetektorn och tramsdetektorn kan vara igång samtidigt. Öppnar de var
       sin ström nekar enheten den andra med NotReadableError, så alla går via
       den här hanteraren som räknar användare och delar på samma ström.
       Nekas mikrofonen provas varje inspelningsenhet i tur och ordning — på
       smartboards är standardenheten ofta en ingång som inte går att öppna. */
    Mic: {
      stream: null,
      users: 0,
      error: '',
      pending: null,
      lastTried: [],          /* diagnostik: vad som provades och vad som hände */
      usingLabel: '',

      deviceId: function () { return Store.get('mic.deviceId', ''); },
      setDeviceId: function (id) { Store.set('mic.deviceId', id || ''); },

      /* Öppnas HTML-filen direkt i en vanlig webbläsare (file://) vägrar
         webbläsaren släppa fram mikrofonen — då hjälper inga omförsök. */
      fileOrigin: function () {
        return !global.AndroidBridge && location.protocol === 'file:';
      },
      message: function (err) {
        var name = err && err.name ? err.name : String(err || 'okänt fel');
        if (this.fileOrigin()) {
          return 'Mikrofonen är blockerad eftersom sidan är öppnad som en fil (file://) i en ' +
            'webbläsare. Installera APK:n på plattan, eller kör appen via en webbserver med ' +
            'https eller localhost — då fungerar mikrofonen.';
        }
        if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
          return 'Mikrofonen är blockerad. Tillåt mikrofon för appen i enhetens inställningar och försök igen.';
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          return 'Ingen mikrofon hittades på enheten.';
        }
        if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
          return 'Mikrofonen gick inte att öppna — någon annan app håller den, eller så klarar inte ingången det. ' +
            'Kör Mikrofondiagnos under ⚙️ Inställningar för att se vilken enhet som krånglar.';
        }
        if (name === 'OverconstrainedError') {
          return 'Den valda mikrofonen finns inte längre — välj en annan under Inställningar.';
        }
        return 'Mikrofonen kunde inte startas (' + name + ').';
      },

      /* Alla försök som ska göras, i ordning: vald enhet, mjuka krav, allt,
         och därefter varje enskild inspelningsenhet som enheten känner till. */
      plan: function (cb) {
        var saved = this.deviceId();
        var list = [];
        if (saved) {
          list.push({ label: 'vald mikrofon', c: { audio: { deviceId: { exact: saved } } } });
        }
        list.push({ label: 'standard utan filter', c: { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } } });
        list.push({ label: 'standard', c: { audio: true } });
        this.devices(function (devs) {
          devs.forEach(function (d, i) {
            if (!d.deviceId || d.deviceId === saved || d.deviceId === 'default') return;
            list.push({
              label: d.label || ('inspelningsenhet ' + (i + 1)),
              id: d.deviceId,
              c: { audio: { deviceId: { exact: d.deviceId } } }
            });
          });
          cb(list);
        });
      },

      /* Ger tillbaka en levande ström till alla som frågar; cb(fel, ström) */
      acquire: function (cb) {
        var self = this;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.error = 'Mikrofon stöds inte i den här vyn (' + location.protocol + ').';
          cb(this.error, null);
          return;
        }
        if (this.stream && this.live()) {
          this.users++;
          cb(null, this.stream);
          return;
        }
        this.stream = null;
        if (this.pending) {                       /* någon annan startar redan */
          this.pending.push(cb);
          return;
        }
        this.pending = [cb];
        this.lastTried = [];

        var done = function (err, stream) {
          var waiting = self.pending || [];
          self.pending = null;
          if (stream) {
            self.stream = stream;
            self.error = '';
            self.users += waiting.length;
            stream.getAudioTracks().forEach(function (t) {
              self.usingLabel = t.label || 'mikrofon';
              t.onended = function () { self.lost(); };
            });
            waiting.forEach(function (fn) { fn(null, stream); });
          } else {
            self.error = self.message(err);
            waiting.forEach(function (fn) { fn(self.error, null); });
          }
        };

        this.plan(function (attempts) {
          var run = function (i, lastErr) {
            if (i >= attempts.length) { done(lastErr, null); return; }
            var a = attempts[i];
            navigator.mediaDevices.getUserMedia(a.c)
              .then(function (stream) {
                self.lastTried.push(a.label + ': OK');
                if (a.id) self.setDeviceId(a.id);
                done(null, stream);
              })
              .catch(function (err) {
                var name = err && err.name ? err.name : 'fel';
                self.lastTried.push(a.label + ': ' + name + (err && err.message ? ' (' + err.message + ')' : ''));
                /* Enheten behöver ofta en stund på sig att släppa mikrofonen */
                var wait = (name === 'NotReadableError' || name === 'AbortError') ? 600 : 0;
                setTimeout(function () { run(i + 1, err); }, wait);
              });
          };
          run(0, null);
        });
      },
      live: function () {
        return !!this.stream && this.stream.getAudioTracks().some(function (t) { return t.readyState === 'live'; });
      },
      release: function () {
        this.users = Math.max(0, this.users - 1);
        if (this.users === 0 && this.stream) {
          this.stream.getTracks().forEach(function (t) { t.stop(); });
          this.stream = null;
        }
      },
      /* Stänger allt oavsett räknare — används av "Släpp mikrofonen" */
      hardRelease: function () {
        if (global.Trams && Trams.armed) Trams.stop();
        if (App.Noise && App.Noise.on) App.Noise.stop();
        this.users = 0;
        if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); }
        this.stream = null;
      },
      lost: function () {
        this.users = 0;
        this.stream = null;
        this.error = 'Mikrofonen kopplades bort.';
        if (global.Trams && Trams.armed) Trams.stop();
        if (App.Noise && App.Noise.on) App.Noise.stop();
        App.toast('Mikrofonen kopplades bort');
      },
      /* Listar inspelningsenheter — namn syns först efter att mikrofonen godkänts */
      devices: function (cb) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { cb([]); return; }
        navigator.mediaDevices.enumerateDevices()
          .then(function (list) {
            cb(list.filter(function (d) { return d.kind === 'audioinput'; }));
          })
          .catch(function () { cb([]); });
      },
      /* Mäter toppnivån i några sekunder så att man kan se att mikrofonen lever */
      test: function (onLevel, onDone) {
        var self = this;
        this.acquire(function (err, stream) {
          if (err) { onDone(err, 0); return; }
          var ac = App.audioCtx();
          if (!ac) { self.release(); onDone('Ljudmotorn kunde inte startas', 0); return; }
          var src = ac.createMediaStreamSource(stream);
          var an = ac.createAnalyser();
          an.fftSize = 1024;
          src.connect(an);
          var data = new Uint8Array(an.fftSize);
          var peak = 0;
          var iv = setInterval(function () {
            an.getByteTimeDomainData(data);
            var sum = 0, i;
            for (i = 0; i < data.length; i++) {
              var v = (data[i] - 128) / 128;
              sum += v * v;
            }
            var lvl = Math.min(100, Math.max(0, Math.round((20 * Math.log10(Math.sqrt(sum / data.length) + 1e-8) + 70) * 1.6)));
            if (lvl > peak) peak = lvl;
            onLevel(lvl);
          }, 100);
          setTimeout(function () {
            clearInterval(iv);
            try { src.disconnect(); } catch (e) { /* noop */ }
            self.release();
            onDone(null, peak);
          }, 3500);
        });
      },

      /* Full diagnos: vad enheten säger, vad som finns och vad som händer när
         man verkligen försöker öppna varje ingång. cb(rapporttext) */
      diagnose: function (cb) {
        var self = this;
        var out = [];
        out.push('Sändo Tavla ' + App.version + ' — mikrofondiagnos');
        out.push(new Date().toLocaleString('sv-SE'));
        out.push('Adress: ' + location.protocol + '//' + (location.host || '(fil)'));
        out.push('Säker kontext: ' + (window.isSecureContext ? 'ja' : 'NEJ — mikrofon kan blockeras'));
        if (self.fileOrigin()) {
          out.push('!! Sidan körs som en fil i en webbläsare. Webbläsare släpper inte fram');
          out.push('!! mikrofonen från file:// — använd APK:n eller kör via https/localhost.');
        }
        out.push('I Android-appen: ' + (global.AndroidBridge ? 'ja' : 'nej (webbläsare)'));
        out.push('mediaDevices: ' + (navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'finns' : 'SAKNAS'));
        out.push('Ljudmotor: ' + (App._ac ? App._ac.state : 'ej startad'));
        out.push('Delad ström: ' + (self.live() ? 'aktiv (' + self.usingLabel + '), ' + self.users + ' användare' : 'ingen'));

        var afterPerm = function () {
          self.devices(function (devs) {
            out.push('');
            out.push('Inspelningsenheter: ' + devs.length);
            devs.forEach(function (d, i) {
              out.push('  ' + (i + 1) + '. ' + (d.label || '(namn dolt tills mikrofonen godkänts)') +
                ' [' + String(d.deviceId).slice(0, 12) + '…]');
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
                  out.push(anyOk ? 'Resultat: mikrofonen fungerar. Starta detektorn igen.' :
                    'Resultat: ingen ingång gick att öppna. Stäng andra appar som spelar in ' +
                    '(samtal, röstinspelare, Teams/Meet, en annan flik med appen) och kör diagnosen igen.');
                  cb(out.join('\n'));
                  return;
                }
                var a = attempts[i++];
                navigator.mediaDevices.getUserMedia(a.c)
                  .then(function (stream) {
                    var label = (stream.getAudioTracks()[0] || {}).label || '';
                    anyOk = true;
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
            .then(function (p) { out.push('Behörighet: ' + p.state); afterPerm(); })
            .catch(function () { out.push('Behörighet: kan inte läsas'); afterPerm(); });
        } else {
          out.push('Behörighet: kan inte läsas');
          afterPerm();
        }
      }
    },

    /* ---------- Gemini: nyckelhantering och test ----------
       AI Studio-nycklar börjar med AIza och skickas som ?key=. Andra former
       (OAuth-token, t.ex. AQ.… eller ya29.…) skickas som ?access_token=.
       Vilket sätt som faktiskt fungerar avgörs av testet nedan. */
    Gemini: {
      key: function () { return Store.get('gemini.key', ''); },
      model: function () { return Store.get('gemini.model', 'gemini-3.1-flash-live-preview'); },
      /* Hämtar de modeller nyckeln har tillgång till och plockar ut live-modellerna */
      liveModels: function (cb) {
        fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(this.key()))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var all = (j.models || []).map(function (m) { return String(m.name).replace('models/', ''); });
            cb(all.filter(function (m) { return m.indexOf('live') >= 0 || m.indexOf('native-audio') >= 0; }), all);
          })
          .catch(function () { cb([], []); });
      },
      /* Gemini-API:t vill ha nyckeln som ?key= — även nycklar som inte börjar
         med AIza. ?access_token= är bara till för riktiga OAuth-token, och
         testet nedan skriver över valet om det visar sig vara tvärtom. */
      authMode: function () { return Store.get('gemini.auth', 'key'); },
      setAuthMode: function (m) { Store.set('gemini.auth', m); },
      wsParam: function () {
        return (this.authMode() === 'key' ? 'key=' : 'access_token=') + encodeURIComponent(this.key());
      },

      /* Frågar Google vad nyckeln duger till och rapporterar svaret rakt av */
      testKey: function (cb) {
        var key = this.key();
        var self = this;
        if (!key) { cb({ ok: false, text: 'Ingen nyckel inlagd.' }); return; }
        var base = 'https://generativelanguage.googleapis.com/v1beta/models';
        var ways = [
          { mode: 'key', label: '?key=', url: base + '?key=' + encodeURIComponent(key), opts: {} },
          { mode: 'token', label: '?access_token=', url: base + '?access_token=' + encodeURIComponent(key), opts: {} },
          { mode: 'token', label: 'Authorization: Bearer', url: base, opts: { headers: { Authorization: 'Bearer ' + key } } }
        ];
        var lines = [];
        var i = 0;
        var next = function () {
          if (i >= ways.length) {
            cb({ ok: false, text: lines.join('\n') + '\n\nIngen av metoderna godkändes.' });
            return;
          }
          var w = ways[i++];
          fetch(w.url, w.opts)
            .then(function (res) {
              return res.text().then(function (body) {
                var msg = '';
                try {
                  var j = JSON.parse(body);
                  msg = (j.error && j.error.message) ? j.error.message : '';
                  if (!msg && j.models) msg = j.models.length + ' modeller tillgängliga';
                } catch (e) { msg = body.slice(0, 160); }
                lines.push(w.label + ' → HTTP ' + res.status + (msg ? ': ' + msg : ''));
                if (res.ok) {
                  self.setAuthMode(w.mode);
                  cb({ ok: true, mode: w.mode, text: lines.join('\n') + '\n\nNyckeln fungerar. Appen använder ' + w.label });
                } else {
                  next();
                }
              });
            })
            .catch(function (err) {
              lines.push(w.label + ' → nådde inte servern (' + (err && err.message ? err.message : 'nätverksfel') + ')');
              next();
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
    modal: function (title, bodyNode, onOk, okLabel) {
      var m = document.getElementById('modal');
      document.getElementById('modal-title').textContent = title;
      var body = document.getElementById('modal-body');
      body.innerHTML = '';
      if (typeof bodyNode === 'string') { body.innerHTML = bodyNode; } else if (bodyNode) { body.appendChild(bodyNode); }
      document.getElementById('modal-ok').textContent = okLabel || 'OK';
      m.classList.remove('hidden');
      App._modalOk = onOk || null;
    },
    hideModal: function () {
      document.getElementById('modal').classList.add('hidden');
      App._modalOk = null;
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
      var box = this.el('div', 'col');
      var head = this.el('div', 'card');
      head.innerHTML = '<div class="muted">Saldo</div><div class="mid-num">' + c.fmt(c.balance()) + '</div>' +
        '<div class="muted" style="margin-top:8px">Start: ' + c.fmt(c.START) +
        ' · Input: ' + c.fmt(c.IN) + ' per lyssning · Output: ' + c.fmt(c.OUT) + ' per tillsägelse</div>';
      box.appendChild(head);
      var log = c.log();
      var list = this.el('div', 'list');
      if (!log.length) {
        list.appendChild(this.el('div', 'muted', 'Inga kreditdragningar än.'));
      } else {
        log.slice(0, 25).forEach(function (e) {
          var row = App.el('div', 'list-item');
          row.innerHTML = '<span class="pill">' + (e.kind === 'out' ? 'Output' : 'Input') + '</span>' +
            '<span class="grow">' + App.esc(e.note || '') + '</span>' +
            '<span class="muted">−' + c.fmt(e.cost) + '</span>' +
            '<span class="muted">' + App.fmtClock(new Date(e.t)) + '</span>';
          list.appendChild(row);
        });
      }
      box.appendChild(list);
      this.modal('💳 Användningskrediter', box, null, 'Stäng');
    }
  };

  global.App = App;
})(window);
