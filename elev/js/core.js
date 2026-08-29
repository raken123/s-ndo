/* Sändo Elev — kärna: lagring, krediter, Gemini, vyer och UI-hjälpmedel.
   Appen är byggd för mobil och för en elev, inte för en lärare: den har inga
   klasslistor, ingen mikrofon och ingen kamera. Den har en arbetsbok, Monni
   och krediter. */
(function (global) {
  'use strict';

  var PREFIX = 'sandoelev.';
  var Store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* fullt */ }
    },
    del: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* noop */ }
    }
  };

  var App = {
    version: '1.0.2',
    Store: Store,
    vyer: {},
    aktivVy: '',

    /* ---------- krediter ----------
       Eleven får fem miljoner gratis. Det är inga pengar som byter ägare —
       det är en budget som gör kostnaden för varje fråga synlig. */
    Credits: {
      START: 5000000,
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
      /* Krediter går också åt andra hållet. Matteplatser betalar — det är
         hela poängen med dem: en budget som bara krymper gör att eleven till
         slut slutar fråga, och det är fel sak att lära ut. */
      reward: function (n, note) {
        n = Math.max(0, Math.round(n || 0));
        if (!n) return 0;
        Store.set('credits', this.balance() + n);
        var log = this.log();
        log.unshift({ t: Date.now(), kind: 'in+', cost: -n, note: note || 'Matteplats' });
        Store.set('creditLog', log.slice(0, 60));
        App.renderCredits();
        return n;
      },
      reset: function () {
        Store.set('credits', this.START);
        Store.set('creditLog', []);
        App.renderCredits();
      },
      fmt: function (n) { return n.toLocaleString('sv-SE'); }
    },
    renderCredits: function () {
      var chip = document.getElementById('credit-chip');
      if (!chip) return;
      var b = this.Credits.balance();
      chip.textContent = '💎 ' + this.Credits.fmt(b);
      chip.className = 'chip' + (b < this.Credits.OUT ? ' alert' : '');
      this.Bro.spara('krediter', String(b));
    },

    /* ---------- bron till bilskärmen ----------
       Android Auto ritar mallar i en egen tjänst som inte kan läsa
       localStorage. Telefonen lämnar därför över det bilen ska visa, och bara
       det. Riktningen är enkelriktad: bilen visar, den ändrar aldrig något.
       I en vanlig webbläsare finns ingen bro och allt här blir tomma anrop. */
    Bro: {
      finns: function () {
        return typeof global.SandoBro !== 'undefined' && global.SandoBro !== null;
      },
      harBil: function () {
        try { return this.finns() && !!global.SandoBro.harBil(); } catch (e) { return false; }
      },
      spara: function (nyckel, varde) {
        if (!this.finns()) return;
        try {
          global.SandoBro.spara(nyckel,
            typeof varde === 'string' ? varde : JSON.stringify(varde));
        } catch (e) { /* bron är en bekvämlighet, inte ett krav */ }
      }
    },

    /* Det Monni senast sa, i den form bilskärmen visar det. Knuffar, inte
       svar: Monni ger aldrig ett svar någonstans, och allra minst på en skärm
       där ingen kan räkna efter. */
    knuffar: function () { return Store.get('knuffar', []); },
    sparaKnuff: function (fraga, svar, steg) {
      var lista = this.knuffar();
      lista.unshift({
        fraga: String(fraga || '').slice(0, 200),
        svar: String(svar || '').slice(0, 600),
        steg: (steg || 0) + 1,
        tid: Date.now()
      });
      lista = lista.slice(0, 8);
      Store.set('knuffar', lista);
      this.Bro.spara('knuffar', lista);
    },

    /* ---------- Gemini ----------
       Samma väg som i Sändo Tavla: nyckeln som ?key=, en tidsgräns på varje
       anrop, och arbetsboken som fileData-delar i varje fråga. Monni är en
       ren textmodell — appen ber aldrig om ljud eller bild. */
    Gemini: {
      /* Adressen till API:t ligger på ett ställe. I appen är den alltid
         Googles — det finns ingen inställning för den. Att den går att byta
         i kod är en testkrok: tools/elev-livetest.js pekar om den till en
         lokal relä för att kunna köra appens riktiga kod mot riktiga svar. */
      BAS: 'https://generativelanguage.googleapis.com',
      bas: function () { return this.BAS; },

      key: function () { return Store.get('gemini.key', ''); },
      setKey: function (k) { Store.set('gemini.key', String(k || '').trim()); },
      model: function () { return Store.get('gemini.model', 'gemini-3.5-flash'); },
      setModel: function (m) { Store.set('gemini.model', String(m || '').trim() || 'gemini-3.5-flash'); },

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
              ? 'Monni svarade inte inom ' + Math.round(timeout / 1000) + ' sekunder. Kolla nätet och försök igen.'
              : 'Kunde inte nå Monni: ' + (err && err.message ? err.message : 'nätverksfel'));
          });
      },

      /* ---- arbetsböcker ---- */
      docs: {
        all: function () {
          return Store.get('docs', []).filter(function (d) {
            return !d.expires || new Date(d.expires).getTime() > Date.now();
          });
        },
        save: function (list) { Store.set('docs', list); },
        add: function (doc) {
          var list = Store.get('docs', []);
          list.unshift(doc);
          this.save(list);
          Store.set('aktivBok', doc.id);
        },
        remove: function (id) {
          this.save(Store.get('docs', []).filter(function (d) { return d.id !== id; }));
          if (Store.get('aktivBok', '') === id) Store.del('aktivBok');
        },
        aktiv: function () {
          var alla = this.all();
          if (!alla.length) return null;
          var id = Store.get('aktivBok', '');
          return alla.filter(function (d) { return d.id === id; })[0] || alla[0];
        },
        setAktiv: function (id) { Store.set('aktivBok', id); },
        /* Delarna som följer med varje fråga, så att Monni pratar om just den
           här boken och inte om läroböcker i allmänhet. */
        parts: function () {
          var a = this.aktiv();
          return a ? [{ fileData: { mimeType: a.mime, fileUri: a.uri } }] : [];
        }
      },

      /* Laddar upp en PDF till Gemini. Filen ligger hos Google i 48 timmar.
         cb(fel, dokument) */
      uploadFile: function (file, cb) {
        var self = this;
        if (!this.key()) { cb('Ingen API-nyckel inlagd — lägg in den under Mer.'); return; }
        if (!App.Credits.charge('in', 'Uppladdning: ' + file.name)) {
          cb('Krediterna räcker inte till en uppladdning.');
          return;
        }
        this.call(this.bas() + '/upload/v1beta/files?key=' +
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
            id: 'b' + Date.now().toString(36),
            name: file.name,
            uri: f.uri,
            mime: f.mimeType || file.type || 'application/pdf',
            size: file.size,
            expires: f.expirationTime || '',
            added: Date.now()
          });
          cb(null, self.docs.all()[0]);
        });
      },

      /* Ett textanrop. opts: {prompt, system, history, useDocs, temperature,
         maxTokens, label}. cb(fel, text) */
      generate: function (opts, cb) {
        if (!this.key()) { cb('Ingen API-nyckel inlagd — lägg in den under Mer.'); return; }
        if (!App.Credits.canAfford('in')) { cb('Krediterna är slut.'); return; }
        var parts = [];
        if (opts.useDocs !== false) parts = parts.concat(this.docs.parts());
        parts.push({ text: opts.prompt });
        var body = {
          contents: (opts.history || []).concat([{ role: 'user', parts: parts }]),
          generationConfig: {
            temperature: opts.temperature == null ? 0.6 : opts.temperature,
            maxOutputTokens: opts.maxTokens || 2600,
            responseModalities: ['TEXT'],
            /* gemini-3.5-flash är en tänkande modell och tanken ryms i samma
               budget som svaret. Mätt mot API:t åt den 862 av 900 tokens och
               lämnade ett avhugget svar på 34 — appen såg ut att vara trasig.
               Monni behöver ingen lång tankekedja för att ge en knuff, så
               tänkandet är avstängt om anropet inte ber om något annat. */
            thinkingConfig: { thinkingBudget: opts.thinkingBudget == null ? 0 : opts.thinkingBudget }
          }
        };
        if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
        App.Credits.charge('in', opts.label || 'Fråga till Monni');
        this.call(this.bas() + '/v1beta/models/' +
          this.model() + ':generateContent?key=' + encodeURIComponent(this.key()), {
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
              ? 'Monnis svar fick inte plats. Prova att fråga om en sak i taget.'
              : 'Monni svarade inget (' + (c.finishReason || 'okänd orsak') + ').');
            return;
          }
          /* Ett avhugget svar är inte ett svar. Utan den här kontrollen visas
             en halv mening som om den vore hel. */
          if (c.finishReason === 'MAX_TOKENS') {
            text += '\n\n(Här tog utrymmet slut. Fråga vidare så fortsätter jag.)';
          }
          App.Credits.charge('out', opts.label || 'Svar från Monni');
          cb(null, text);
        });
      },

      /* Frågar Google vad nyckeln duger till. cb({ok, text}) */
      testKey: function (cb) {
        if (!this.key()) { cb({ ok: false, text: 'Ingen nyckel inlagd.' }); return; }
        this.call(this.bas() + '/v1beta/models?key=' +
          encodeURIComponent(this.key()), { timeout: 30000 }, function (err, j) {
          if (err) { cb({ ok: false, text: err }); return; }
          var n = (j.models || []).length;
          cb({ ok: n > 0, text: n + ' modeller tillgängliga. Nyckeln fungerar.' });
        });
      }
    },

    /* ---------- UI ---------- */
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
    button: function (label, cls, onClick) {
      var b = this.el('button', 'btn ' + (cls || ''), label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    },
    toast: function (msg, ms) {
      var t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { t.classList.add('hidden'); }, ms || 2400);
    },
    /* Bottenark i stället för dialogruta — det är så en mobil frågar. */
    sheet: function (title, bodyNode, onOk, okLabel) {
      var s = document.getElementById('sheet');
      document.getElementById('sheet-title').textContent = title;
      var body = document.getElementById('sheet-body');
      body.innerHTML = '';
      if (typeof bodyNode === 'string') body.innerHTML = bodyNode;
      else if (bodyNode) body.appendChild(bodyNode);
      var ok = document.getElementById('sheet-ok');
      ok.textContent = okLabel === false ? 'OK' : (okLabel || 'OK');
      document.querySelector('#sheet .sheet-actions').classList.toggle('hidden', okLabel === false);
      s.classList.remove('hidden');
      App._sheetOk = onOk || null;
    },
    hideSheet: function () {
      document.getElementById('sheet').classList.add('hidden');
      document.querySelector('#sheet .sheet-actions').classList.remove('hidden');
      App._sheetOk = null;
    },
    confirm: function (title, text, onYes) {
      this.sheet(title, '<p style="font-size:16px;line-height:1.55">' + this.esc(text) + '</p>', onYes, 'Ja');
    },

    /* ---------- vyer ---------- */
    registrera: function (namn, bygg) { this.vyer[namn] = bygg; },

    /* Utan API-nyckel gör Monni ingenting, och en app som bara svarar med ett
       felmeddelande ser trasig ut. Vyerna sätter den här rutan överst i
       stället, med vägen till det som saknas. */
    saknasNyckel: function (wrap) {
      if (this.Gemini.key()) return false;
      var k = this.el('div', 'card varning');
      k.innerHTML = '<h3>🔑 Lägg in API-nyckeln först</h3>' +
        '<p class="muted">Monni behöver en Gemini-nyckel för att svara. Utan den händer ' +
        'ingenting när du frågar. Nyckeln sparas bara på den här telefonen.</p>';
      k.appendChild(this.button('Gå till nyckeln', 'liten', function () { App.open('mer'); }));
      k.lastChild.style.marginTop = '12px';
      wrap.appendChild(k);
      return true;
    },
    open: function (namn, arg) {
      var bygg = this.vyer[namn];
      if (!bygg) return;
      this.aktivVy = namn;
      var v = document.getElementById('view');
      v.innerHTML = '';
      v.scrollTop = 0;
      var wrap = this.el('div', 'view');
      v.appendChild(wrap);
      bygg(wrap, arg);
      Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'), function (b) {
        b.classList.toggle('pa', b.getAttribute('data-view') === namn);
      });
      Store.set('senasteVy', namn);
    },

    tema: function () { return Store.get('tema', 'ljus'); },
    setTema: function (t) {
      Store.set('tema', t);
      document.documentElement.setAttribute('data-tema', t === 'mork' ? 'mork' : 'ljus');
    },

    init: function () {
      var self = this;
      this.setTema(this.tema());
      this.renderCredits();
      Array.prototype.forEach.call(document.querySelectorAll('#tabs .tab'), function (b) {
        b.addEventListener('click', function () { self.open(b.getAttribute('data-view')); });
      });
      document.getElementById('sheet-cancel').addEventListener('click', function () { self.hideSheet(); });
      document.getElementById('sheet-ok').addEventListener('click', function () {
        var fn = self._sheetOk;
        self.hideSheet();
        if (fn) fn();
      });
      document.getElementById('sheet').addEventListener('click', function (e) {
        if (e.target.id === 'sheet') self.hideSheet();
      });
      document.getElementById('credit-chip').addEventListener('click', function () { self.open('mer'); });
      this.open(this.vyer[Store.get('senasteVy', 'bok')] ? Store.get('senasteVy', 'bok') : 'bok');
    }
  };

  global.App = App;
})(window);
