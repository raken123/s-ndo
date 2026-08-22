/* Tramsdetektor — enda AI-komponenten. Lyssnar tyst och säger bara till när någon tramsar. */
(function (global, App) {
  'use strict';

  var LEVELS = {
    1: { name: 'Lite cringe', icon: '😌', color: '#f59e0b', tone: 'snäll tillsägelse' },
    2: { name: 'Rejält trams', icon: '😠', color: '#dc2626', tone: 'sträng tillsägelse' },
    3: { name: 'SUPER CRINGE', icon: '🚨', color: '#7f1d1d', tone: 'utvisning i 5 minuter' }
  };
  var TIMEOUT_MS = 5 * 60 * 1000;

  var SYSTEM_PROMPT =
    'Du är "Tramsdetektorn" i ett svenskt klassrum. Du lyssnar på ljudet i rummet och är HELT TYST ' +
    'så länge lektionen fungerar. Vanligt lektionsarbete, vanliga frågor, vanligt sorl och tystnad ' +
    'ska ALDRIG ge något svar — säg då ingenting alls och anropa inget verktyg.\n' +
    'Reagera bara när någon: tramsar, skriker, härmar memes (t.ex. "Homer let the Barts out", ' +
    '"dudududu", skrikljud, ljudmemes), eller ställer en helt ovidkommande konstig fråga mitt i ' +
    'lektionen (t.ex. under mattelektionen: "min lillebror bor i en läskig toalett där Momo och ' +
    'Baldi kommer ut").\n' +
    'När det händer: anropa verktyget rapportera_trams och säg sedan repliken högt på svenska, ' +
    'kort och tydligt.\n' +
    'Nivåer: 1 = lite cringe, säg till snällt och varmt. 2 = värre trams, upprepat eller störande ' +
    'skrik, säg till strängt. 3 = SUPER CRINGE, grovt eller omöjligt att jobba runt, eleven stängs ' +
    'av från klassrummet i fem minuter — säg det bestämt men utan att kränka någon.\n' +
    'Repliken ska vara på svenska och högst 25 ord. Peka aldrig ut någon med namn du inte hört.';

  var TRAMS_TOOL = {
    functionDeclarations: [{
      name: 'rapportera_trams',
      description: 'Anropas endast när någon tramsar, skriker, härmar ett meme eller ställer en ' +
        'helt ovidkommande fråga mitt i lektionen. Anropas aldrig vid vanligt lektionsarbete.',
      parameters: {
        type: 'OBJECT',
        properties: {
          niva: { type: 'INTEGER', description: '1 = lite cringe, 2 = rejält trams, 3 = super cringe' },
          replik: { type: 'STRING', description: 'Kort tillsägelse på svenska, högst 25 ord' },
          vem: { type: 'STRING', description: 'Vem det gällde, om det går att höra' },
          vad: { type: 'STRING', description: 'Vad som hördes' }
        },
        required: ['niva', 'replik']
      }
    }]
  };

  /* ================== Motor (en per app — delar mikrofon och kamera) ================== */
  var Trams = {
    armed: false,
    mode: 'lokal',           /* 'lokal' eller 'ai' */
    status: 'Avstängd',
    level: 0,
    lastVerdict: null,
    history: [],
    timeoutUntil: 0,
    outsideSince: 0,         /* > 0 när kameran bedömer att eleven lämnat rummet */
    presence: false,
    motion: 0,
    ws: null,
    wsState: '',
    micStream: null,
    camStream: null,
    listeners: [],

    cfg: function () {
      var S = App.Store;
      return {
        key: S.get('gemini.key', ''),
        model: S.get('gemini.model', 'gemini-live-2.5-flash-preview'),
        segment: S.get('trams.segment', 15),      /* sekunder ljud per input */
        sensitivity: S.get('trams.sens', 62),     /* skriknivå i lokalt läge */
        camera: S.get('trams.camera', true)
      };
    },
    on: function (fn) { this.listeners.push(fn); },
    off: function (fn) { this.listeners = this.listeners.filter(function (f) { return f !== fn; }); },
    emit: function () {
      var self = this;
      this.listeners.forEach(function (f) { try { f(self); } catch (e) { /* noop */ } });
    },
    say: function (text) { this.status = text; this.emit(); },

    /* ---------------- Start och stopp ---------------- */
    start: function (mode) {
      var self = this;
      if (this.armed) return;
      this.mode = mode || 'lokal';
      if (this.mode === 'ai' && !App.Credits.canAfford('in')) {
        this.say('Krediterna är slut — AI-läget kan inte starta.');
        return;
      }
      this.say('Startar mikrofonen…');
      /* Delad ström: krockar inte med ljuddetektorn om båda är igång */
      App.Mic.acquire(function (err, stream) {
        if (err) { self.say(err); return; }
        self.micStream = stream;
        self.armed = true;
        self.startAudio(stream);
        self.say(self.mode === 'ai' ? 'Lyssnar tyst (AI)' : 'Lyssnar tyst (lokalt läge)');
      });
    },
    stop: function () {
      var wasArmed = this.armed;
      this.armed = false;
      this.stopAlarm();
      if (this.src) { try { this.src.disconnect(); } catch (e) { /* noop */ } this.src = null; }
      if (this.proc) { try { this.proc.disconnect(); } catch (e) { /* noop */ } this.proc = null; }
      if (wasArmed && this.micStream) App.Mic.release();
      this.micStream = null;
      if (this.ws) { try { this.ws.close(); } catch (e) { /* noop */ } this.ws = null; }
      this.stopCamera();
      this.say('Avstängd');
    },

    /* ---------------- Ljudanalys ---------------- */
    startAudio: function (stream) {
      var self = this;
      var ac = App.audioCtx();
      if (!ac) { this.say('Ljudmotorn kunde inte startas'); return; }
      var src = ac.createMediaStreamSource(stream);
      var proc = ac.createScriptProcessor(4096, 1, 1);
      this.src = src;
      this.proc = proc;
      this.buffer = [];
      this.segStart = Date.now();
      this.loudMs = 0;

      if (this.mode === 'ai') this.connect();

      proc.onaudioprocess = function (e) {
        if (!self.armed) return;
        var input = e.inputBuffer.getChannelData(0);
        var sum = 0, i;
        for (i = 0; i < input.length; i++) { sum += input[i] * input[i]; }
        var rms = Math.sqrt(sum / input.length);
        var lvl = Math.min(100, Math.max(0, Math.round((20 * Math.log10(rms + 1e-8) + 70) * 1.6)));
        self.level = Math.round(self.level * 0.7 + lvl * 0.3);

        if (self.mode === 'ai') {
          self.buffer.push(self.toPcm16(input, ac.sampleRate));
          if (Date.now() - self.segStart > self.cfg().segment * 1000) {
            self.sendSegment();
            self.segStart = Date.now();
          }
        } else {
          self.localCheck();
        }
      };
      src.connect(proc);
      /* Nolladd utgång så att processorn körs utan att ljudet hörs igen */
      var mute = ac.createGain();
      mute.gain.value = 0;
      proc.connect(mute);
      mute.connect(ac.destination);
      this.emit();
    },
    toPcm16: function (float32, sampleRate) {
      /* Nedsamplar till 16 kHz PCM16 som Live-API:t vill ha det */
      var ratio = sampleRate / 16000;
      var len = Math.floor(float32.length / ratio);
      var out = new Int16Array(len);
      for (var i = 0; i < len; i++) {
        var s = float32[Math.floor(i * ratio)];
        s = Math.max(-1, Math.min(1, s));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return out;
    },

    /* ---------------- Lokalt läge: skrik och manuell rapport ---------------- */
    localCheck: function () {
      var c = this.cfg();
      if (this.level >= c.sensitivity) {
        this.loudMs += 90;
        if (this.loudMs > 1400 && Date.now() - (this.lastLocal || 0) > 12000) {
          this.lastLocal = Date.now();
          this.loudMs = 0;
          var lvl = this.level >= c.sensitivity + 20 ? 2 : 1;
          this.verdict({
            niva: lvl,
            replik: lvl === 1
              ? 'Nu blev det lite väl högt — sänk volymen så vi hör varandra.'
              : 'Sluta skrika. Sätt dig ner och fortsätt med uppgiften, nu.',
            vem: 'Okänd',
            vad: 'Hög ljudnivå (' + this.level + ')'
          }, false);
        }
      } else {
        this.loudMs = Math.max(0, this.loudMs - 60);
      }
    },

    /* ---------------- Gemini Live ---------------- */
    connect: function () {
      var self = this;
      var c = this.cfg();
      if (!c.key) { this.say('Ingen API-nyckel — lägg in den under Inställningar.'); this.mode = 'lokal'; return; }
      var url = 'wss://generativelanguage.googleapis.com/ws/' +
        'google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?' + App.Gemini.wsParam();
      this.wsState = 'ansluter';
      this.say('Ansluter till Gemini…');
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        this.wsState = 'fel';
        this.say('Kunde inte öppna anslutningen: ' + e.message);
        this.mode = 'lokal';
        return;
      }
      this.turn = { toolCall: null, audio: [], heard: '', said: '' };
      this.ws.onopen = function () {
        /* Live-modellerna svarar med ljud, inte text. Domslutet kommer därför
           som ett verktygsanrop och repliken läses upp av modellen själv. */
        self.ws.send(JSON.stringify({
          setup: {
            model: 'models/' + c.model,
            generationConfig: { responseModalities: ['AUDIO'], temperature: 0.3 },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [TRAMS_TOOL],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
          }
        }));
        self.wsState = 'ansluten';
      };
      this.ws.onmessage = function (ev) {
        if (ev.data instanceof Blob) {
          ev.data.text().then(function (t) { self.handleMessage(t); });
        } else {
          self.handleMessage(ev.data);
        }
      };
      this.ws.onerror = function () { self.wsState = 'fel'; };
      this.ws.onclose = function (ev) {
        var wasOpen = self.wsState === 'ansluten';
        self.wsState = 'stängd';
        if (self.armed && self.mode === 'ai') {
          self.mode = 'lokal';
          self.say('Gemini stängde anslutningen' +
            (ev && ev.code ? ' (kod ' + ev.code + (ev.reason ? ': ' + ev.reason : '') + ')' : '') +
            '. Lokalt läge fortsätter. Testa nyckeln och modellen under Inställningar.');
        } else if (!wasOpen) {
          self.say('Anslutningen till Gemini stängdes.');
        }
      };
    },
    sendSegment: function () {
      if (!this.ws || this.ws.readyState !== 1 || !this.buffer.length) { this.buffer = []; return; }
      if (!App.Credits.charge('in', 'Tramsdetektor: ' + this.cfg().segment + ' s ljud')) {
        this.say('Krediterna är slut — AI-läget stängs av.');
        this.mode = 'lokal';
        this.buffer = [];
        return;
      }
      var total = this.buffer.reduce(function (a, b) { return a + b.length; }, 0);
      var merged = new Int16Array(total);
      var off = 0;
      this.buffer.forEach(function (chunk) { merged.set(chunk, off); off += chunk.length; });
      this.buffer = [];
      var bytes = new Uint8Array(merged.buffer);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]); }
      try {
        this.ws.send(JSON.stringify({
          realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: btoa(bin) }] }
        }));
      } catch (e) { /* skickas om vid nästa segment */ }
      this.emit();
    },
    handleMessage: function (raw) {
      var self = this;
      var msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      if (!this.turn) this.turn = { toolCall: null, audio: [], heard: '', said: '' };

      if (msg.setupComplete) {
        this.say('Lyssnar tyst (AI)');
        return;
      }

      /* Domslutet: modellen anropar verktyget bara när något faktiskt hänt */
      if (msg.toolCall && msg.toolCall.functionCalls) {
        var calls = msg.toolCall.functionCalls;
        try {
          this.ws.send(JSON.stringify({
            toolResponse: {
              functionResponses: calls.map(function (f) {
                return { id: f.id, name: f.name, response: { ok: true } };
              })
            }
          }));
        } catch (e) { /* sessionen stängdes */ }
        calls.forEach(function (f) {
          if (f.name !== 'rapportera_trams') return;
          var a = f.args || {};
          self.turn.toolCall = a;
          self.verdict({
            niva: a.niva,
            replik: a.replik,
            vem: a.vem || (self.turn.heard ? 'Hörde: ' + self.turn.heard.slice(0, 40) : 'Okänd'),
            vad: a.vad || self.turn.heard
          }, true, true);
        });
        return;
      }

      var sc = msg.serverContent;
      if (!sc) return;
      if (sc.inputTranscription && sc.inputTranscription.text) {
        this.turn.heard += sc.inputTranscription.text;
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        this.turn.said += sc.outputTranscription.text;
      }
      var parts = (sc.modelTurn && sc.modelTurn.parts) || [];
      parts.forEach(function (p) {
        if (p.inlineData && p.inlineData.data) self.turn.audio.push(p.inlineData.data);
      });
      if (sc.turnComplete) {
        /* Bara turer med ett verktygsanrop får låta — annars skulle modellen
           kunna prata mitt i lektionen, och det ska den aldrig göra. */
        if (this.turn.toolCall && this.turn.audio.length) {
          this.playAudio(this.turn.audio);
        }
        if (this.turn.toolCall && this.turn.said && this.lastVerdict) {
          this.lastVerdict.replik = this.turn.said.trim() || this.lastVerdict.replik;
          this.emit();
        }
        this.turn = { toolCall: null, audio: [], heard: '', said: '' };
      }
    },

    /* Spelar upp modellens svar (PCM 24 kHz) i klassrummet */
    playAudio: function (chunks) {
      if (App.Store.get('mute', false)) return;
      var ac = App.audioCtx();
      if (!ac) return;
      var total = 0, buffers = [], i, j;
      chunks.forEach(function (b64) {
        var bin;
        try { bin = atob(b64); } catch (e) { return; }
        var bytes = new Uint8Array(bin.length);
        for (var k = 0; k < bin.length; k++) { bytes[k] = bin.charCodeAt(k); }
        var pcm = new Int16Array(bytes.buffer);
        buffers.push(pcm);
        total += pcm.length;
      });
      if (!total) return;
      var buf = ac.createBuffer(1, total, 24000);
      var out = buf.getChannelData(0);
      var off = 0;
      for (i = 0; i < buffers.length; i++) {
        for (j = 0; j < buffers[i].length; j++) { out[off++] = buffers[i][j] / 32768; }
      }
      var src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start();
      this.speaking = true;
      var self = this;
      src.onended = function () { self.speaking = false; };
    },

    /* ---------------- Domslut ---------------- */
    verdict: function (v, costsCredits, spokenByModel) {
      var lvl = Math.max(1, Math.min(3, parseInt(v.niva, 10) || 1));
      if (costsCredits && !App.Credits.charge('out', 'Tramsdetektor: nivå ' + lvl)) {
        this.say('Krediterna räcker inte till fler tillsägelser.');
        return;
      }
      var entry = {
        t: Date.now(),
        niva: lvl,
        replik: v.replik || LEVELS[lvl].tone,
        vem: v.vem || 'Okänd',
        vad: v.vad || '',
        ai: !!costsCredits
      };
      this.lastVerdict = entry;
      this.history.unshift(entry);
      this.history = this.history.slice(0, 40);
      App.Store.set('tramsLog', this.history);

      if (!spokenByModel) App.speak(entry.replik);
      if (lvl === 1) { App.beep(660, 250); }
      if (lvl === 2) { App.beep(392, 450, 'square', 0.3); }
      if (lvl === 3) { this.startTimeout(); }
      this.emit();
    },

    /* ---------------- Utvisning i 5 minuter ---------------- */
    startTimeout: function () {
      var self = this;
      this.timeoutUntil = Date.now() + TIMEOUT_MS;
      this.outsideSince = 0;
      this.presence = true;
      this.startAlarm();
      if (this.cfg().camera && !this.camStream) this.startCamera();
      if (this.timeoutIv) clearInterval(this.timeoutIv);
      this.timeoutIv = setInterval(function () {
        if (Date.now() >= self.timeoutUntil) {
          self.endTimeout();
          return;
        }
        self.emit();
      }, 500);
      this.emit();
    },
    endTimeout: function () {
      clearInterval(this.timeoutIv);
      this.timeoutIv = 0;
      this.timeoutUntil = 0;
      this.stopAlarm();
      this.stopCamera();
      App.chime(2);
      this.say(this.armed ? (this.mode === 'ai' ? 'Lyssnar tyst (AI)' : 'Lyssnar tyst (lokalt läge)') : 'Avstängd');
      this.emit();
    },
    startAlarm: function () { App.alarm.start(); this.emit(); },
    stopAlarm: function () { App.alarm.stop(); this.emit(); },
    /* Kameran avgör om eleven är kvar i rummet: rörelse = kvar, stilla rum = ute */
    setPresence: function (present) {
      if (this.timeoutUntil <= Date.now()) return;
      if (present === this.presence) return;
      this.presence = present;
      if (present) {
        this.outsideSince = 0;
        this.startAlarm();
        App.speak('Du får inte komma in än. Vänta utanför tills tiden är slut.');
      } else {
        this.outsideSince = Date.now();
        this.stopAlarm();
      }
      this.emit();
    },

    /* ---------------- Kamera: närvarodetektering via rörelse ---------------- */
    startCamera: function () {
      var self = this;
      if (this.camStream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
        .then(function (stream) {
          self.camStream = stream;
          var v = document.createElement('video');
          v.muted = true;
          v.playsInline = true;
          v.srcObject = stream;
          v.play();
          self.video = v;
          var cv = document.createElement('canvas');
          cv.width = 96; cv.height = 72;
          var c = cv.getContext('2d', { willReadFrequently: true });
          var prev = null;
          var quietMs = 0, busyMs = 0;
          self.camIv = setInterval(function () {
            if (!self.camStream) return;
            try { c.drawImage(v, 0, 0, cv.width, cv.height); } catch (e) { return; }
            var img = c.getImageData(0, 0, cv.width, cv.height).data;
            if (prev) {
              var diff = 0, i;
              for (i = 0; i < img.length; i += 16) {
                diff += Math.abs(img[i] - prev[i]);
              }
              self.motion = Math.round(diff / (img.length / 16));
            }
            prev = img.slice(0);
            if (self.timeoutUntil > Date.now()) {
              if (self.motion > 6) { busyMs += 250; quietMs = 0; } else { quietMs += 250; busyMs = 0; }
              if (quietMs > 2500) self.setPresence(false);   /* rummet stilla → eleven är ute */
              if (busyMs > 1000) self.setPresence(true);     /* rörelse igen → tillbaka för tidigt */
            }
            self.emit();
          }, 250);
        })
        .catch(function (err) {
          self.say('Kameran kunde inte startas (' + (err && err.name ? err.name : 'fel') +
            ') — använd knapparna "Eleven gick ut" och "Eleven kom in" i stället.');
        });
    },
    stopCamera: function () {
      clearInterval(this.camIv);
      this.camIv = 0;
      if (this.camStream) { this.camStream.getTracks().forEach(function (t) { t.stop(); }); }
      this.camStream = null;
      this.video = null;
    }
  };
  Trams.history = App.Store.get('tramsLog', []);
  global.Trams = Trams;

  /* ================== Komponenten på tavlan ================== */
  App.register({
    id: 'trams', name: 'Tramsdetektor', icon: '🤖', cat: 'AI',
    desc: 'Lyssnar tyst och säger bara till när någon tramsar, skriker eller memear.',
    keys: 'trams ai gemini skrik meme cringe utvisning',
    mount: function (root, ctx) {
      var L = ctx.layout(root);
      var body = L.body;

      var status = ctx.el('div', 'trams-status');
      var verdict = ctx.el('div', 'trams-verdict');
      var timeoutBox = ctx.el('div', 'trams-timeout hidden');
      var meter = ctx.el('div', 'meter');
      var fill = ctx.el('div', 'meter-fill');
      meter.appendChild(fill);
      var log = ctx.el('div', 'list');
      log.style.cssText = 'margin-top:12px;max-height:34%;overflow:auto';

      body.appendChild(status);
      body.appendChild(meter);
      body.appendChild(verdict);
      body.appendChild(timeoutBox);
      body.appendChild(log);

      var startBtn = ctx.button('🎤 Starta', 'sm', function () {
        if (Trams.armed) { Trams.stop(); } else {
          var useAi = ctx.Store.get('useAi', false);
          Trams.start(useAi ? 'ai' : 'lokal');
        }
      });
      var aiBtn = ctx.button('', 'sm ghost', function () {
        var on = !ctx.Store.get('useAi', false);
        ctx.Store.set('useAi', on);
        syncAi();
        if (Trams.armed) { Trams.stop(); Trams.start(on ? 'ai' : 'lokal'); }
      });
      function syncAi() {
        var on = ctx.Store.get('useAi', false);
        aiBtn.textContent = on ? '🧠 AI-läge: PÅ' : '🧠 AI-läge: AV';
        aiBtn.className = 'btn sm ' + (on ? '' : 'ghost');
      }
      syncAi();
      L.bar.appendChild(startBtn);
      L.bar.appendChild(aiBtn);
      L.bar.appendChild(ctx.button('🙋 Rapportera', 'sm ghost', function () {
        var box = ctx.el('div', 'col');
        [1, 2, 3].forEach(function (n) {
          box.appendChild(ctx.button(LEVELS[n].icon + ' Nivå ' + n + ' — ' + LEVELS[n].name, n === 3 ? 'danger' : 'ghost', function () {
            App.hideModal();
            Trams.verdict({
              niva: n,
              replik: n === 1 ? 'Nu tramsar vi lite väl mycket — tillbaka till uppgiften.'
                : n === 2 ? 'Det där var inte okej. Sluta trams och jobba vidare, nu.'
                  : 'Det här går inte längre. Du går ut ur klassrummet i fem minuter.',
              vem: 'Rapporterad av läraren',
              vad: 'Manuell rapport'
            }, false);
          }));
        });
        App.modal('Rapportera trams', box, null, 'Avbryt');
      }));
      L.bar.appendChild(ctx.button('💳 Krediter', 'sm ghost', function () { App.showCredits(); }));
      L.bar.appendChild(ctx.button('🩺 Mikrofondiagnos', 'sm ghost', function () { App.micDiagnosis(); }));

      function paint() {
        var t = Trams;
        var c = t.cfg();
        startBtn.textContent = t.armed ? '⏹️ Stoppa' : '🎤 Starta';
        startBtn.className = 'btn sm ' + (t.armed ? 'danger' : '');
        status.innerHTML =
          '<div class="ts-dot ' + (t.armed ? (t.timeoutUntil > Date.now() ? 'red' : 'green') : 'off') + '"></div>' +
          '<div><div class="ts-main">' + App.esc(t.status) + '</div>' +
          '<div class="muted ts-sub">' +
          (t.mode === 'ai' ? 'Gemini ' + App.esc(c.model) + ' · ' + c.segment + ' s per input' : 'Lokalt läge — ingen kostnad') +
          ' · Saldo ' + App.Credits.fmt(App.Credits.balance()) + '</div></div>';
        fill.style.width = (t.armed ? t.level : 0) + '%';

        var v = t.lastVerdict;
        if (v) {
          var lv = LEVELS[v.niva];
          verdict.style.borderColor = lv.color;
          verdict.innerHTML = '<div class="tv-head" style="color:' + lv.color + '">' + lv.icon + ' ' +
            lv.name + ' · nivå ' + v.niva + '</div>' +
            '<div class="tv-text">”' + App.esc(v.replik) + '”</div>' +
            '<div class="muted">' + App.esc(v.vem) + (v.vad ? ' · ' + App.esc(v.vad) : '') +
            ' · ' + App.fmtClock(new Date(v.t)) + (v.ai ? ' · AI' : ' · lokalt') + '</div>';
          verdict.classList.remove('hidden');
        } else {
          verdict.innerHTML = '<div class="muted">Inga tillsägelser än. Detektorn är tyst så länge det fungerar.</div>';
        }

        if (t.timeoutUntil > Date.now()) {
          timeoutBox.classList.remove('hidden');
          var left = t.timeoutUntil - Date.now();
          timeoutBox.innerHTML =
            '<div class="tt-title">🚨 Utvisad från klassrummet</div>' +
            '<div class="tt-time">' + App.fmtDur(left) + '</div>' +
            '<div class="tt-state">' + (t.presence
              ? '🔔 Eleven är kvar i rummet — pipet fortsätter tills hen går ut'
              : '🤫 Eleven är utanför — pipet är tyst. Kommer hen in igen börjar det om.') +
            '</div>' +
            '<div class="muted">Kamera: ' + (t.camStream ? 'rörelse ' + t.motion : 'av') + '</div>';
          var row = ctx.el('div', 'row');
          row.appendChild(ctx.button('🚪 Eleven gick ut', 'sm ghost', function () { Trams.setPresence(false); }));
          row.appendChild(ctx.button('↩️ Eleven kom in', 'sm ghost', function () { Trams.setPresence(true); }));
          row.appendChild(ctx.button('✅ Avbryt utvisningen', 'sm ghost', function () { Trams.endTimeout(); }));
          timeoutBox.appendChild(row);
        } else {
          timeoutBox.classList.add('hidden');
        }

        log.innerHTML = '';
        t.history.slice(0, 8).forEach(function (h) {
          var row = ctx.el('div', 'list-item');
          row.innerHTML = '<span class="pill">' + LEVELS[h.niva].icon + ' ' + h.niva + '</span>' +
            '<span class="grow">' + App.esc(h.replik) + '</span>' +
            '<span class="muted">' + App.fmtClock(new Date(h.t)) + '</span>';
          log.appendChild(row);
        });
      }
      Trams.on(paint);
      ctx.every(500, paint);
      paint();
      this._paint = paint;
    },
    unmount: function (ctx) {
      if (this._paint) Trams.off(this._paint);
    }
  });

})(window, window.App);
