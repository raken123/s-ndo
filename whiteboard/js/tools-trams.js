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
    'Oavsett om något händer eller inte: anropa cringe_niva minst var tionde sekund med hur ' +
    'stimmigt rummet är just nu (0–100). Det är en tyst mätning som läraren ser på tavlan, och ' +
    'den ska aldrig läsas upp.\n' +
    'Nivåer: 1 = lite cringe, säg till snällt och varmt. 2 = värre trams, upprepat eller störande ' +
    'skrik, säg till strängt. 3 = SUPER CRINGE, grovt eller omöjligt att jobba runt, eleven stängs ' +
    'av från klassrummet i fem minuter — säg det bestämt men utan att kränka någon.\n' +
    'Repliken ska vara på svenska och högst 25 ord. Peka aldrig ut någon med namn du inte hört.';

  var TRAMS_TOOL = {
    functionDeclarations: [{
      name: 'cringe_niva',
      description: 'Rapporterar hur stimmigt och tramsigt det är i rummet just nu. Anropas ofta, ' +
        'minst var tionde sekund, även när allt är lugnt. Kostar inget och stör ingen.',
      parameters: {
        type: 'OBJECT',
        properties: {
          poang: { type: 'INTEGER', description: '0 = helt lugnt, 50 = stimmigt, 100 = fullt kaos' },
          varfor: { type: 'STRING', description: 'Några ord om vad som hörs' }
        },
        required: ['poang']
      }
    }, {
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
    cringe: 0,               /* 0–100, uppdateras hela tiden */
    cringeWhy: 'Lugnt',
    cringeFrom: 'lokal',
    cringeHist: [],
    baseline: 12,
    window: [],
    superSince: 0,
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
    buffer: [],
    segStart: 0,
    listener: null,
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
      /* Delad ljudkälla: krockar inte med ljuddetektorn, och faller tillbaka
         på Androids egen mikrofon om WebView vägrar. */
      App.Mic.start(function (err) {
        if (err) { self.say(err); return; }
        self.armed = true;
        self.buffer = [];
        self.segStart = Date.now();
        self.loudMs = 0;
        self.listener = function (level, pcm) { self.onAudio(level, pcm); };
        App.Mic.subscribe(self.listener);
        if (self.mode === 'ai') self.connect();
        self.say(self.mode === 'ai' ? 'Ansluter till Gemini…' : 'Lyssnar tyst (lokalt läge · ' +
          (App.Mic.backend === 'native' ? 'Androids mikrofon' : 'webbmikrofon') + ')');
      });
    },
    stop: function () {
      var wasArmed = this.armed;
      this.armed = false;
      this.stopAlarm();
      if (this.listener) { App.Mic.unsubscribe(this.listener); this.listener = null; }
      this.cringe = 0;
      this.cringeFrom = 'lokal';
      this.cringeWhy = 'Lugnt';
      this.window = [];
      if (wasArmed) App.Mic.release();
      if (this.ws) { try { this.ws.close(); } catch (e) { /* noop */ } this.ws = null; }
      this.stopCamera();
      this.say('Avstängd');
    },

    /* ---------------- Ljudet från den delade mikrofonen ---------------- */
    onAudio: function (level, pcm) {
      if (!this.armed) return;
      this.level = level;
      this.scan(level);                    /* cringe-nivån mäts i båda lägena */
      if (this.mode === 'ai') {
        this.buffer.push(pcm);
        if (Date.now() - this.segStart > this.cfg().segment * 1000) {
          this.sendSegment();
          this.segStart = Date.now();
        }
        this.localCheck();                 /* lokal vakt går även när AI:n lyssnar */
      } else {
        this.localCheck();
      }
    },

    /* ---------------- Cringe-skanning ----------------
       Mäter hela tiden hur stimmigt rummet är: hur mycket ljudnivån ligger över
       rummets egen grundnivå, hur ryckigt det är (skrik och skratt hoppar, prat
       gör inte det) och hur stor del av de senaste sekunderna som varit hög.
       I AI-läge skriver modellens egen bedömning över den lokala. */
    scan: function (level) {
      var prev = this.window.length ? this.window[this.window.length - 1] : level;
      this.window.push(level);
      if (this.window.length > 25) this.window.shift();       /* ~5 sekunder */

      /* Grundnivån följer rummet långsamt, så en fläkt eller ett surr inte räknas */
      this.baseline = this.baseline * 0.995 + Math.min(level, this.baseline + 4) * 0.005;

      var excess = Math.max(0, level - this.baseline - 15);
      var jump = Math.min(25, Math.abs(level - prev));
      var n = Math.max(1, this.window.length);
      var loud = this.window.filter(function (l) { return l > 65; }).length / n;
      var busy = this.window.filter(function (l) { return l > 55; }).length / n;
      /* Ett enstaka skrik i ett tyst rum är inte kaos — det krävs att det
         håller i sig för att nivån ska nå toppen */
      var raw = Math.min(100, Math.round((excess * 1.15 + jump * 0.6 + loud * 25) * (0.6 + 0.4 * busy)));

      /* Stiger snabbt, faller långsamt — som en klassrumsstämning gör */
      this.cringe = raw > this.cringe ? Math.round(this.cringe * 0.5 + raw * 0.5)
        : Math.max(0, Math.round(this.cringe * 0.97));
      if (this.cringeFrom === 'lokal') {
        this.cringeWhy = this.cringeLabel(this.cringe);
      }
      this.cringeHist.push(this.cringe);
      if (this.cringeHist.length > 120) this.cringeHist.shift();
      return this.cringe;
    },
    cringeLabel: function (c) {
      if (c >= 85) return 'SUPER CRINGE';
      if (c >= 70) return 'Rejält trams';
      if (c >= 45) return 'Stimmigt';
      if (c >= 25) return 'Lite liv i luckan';
      return 'Lugnt';
    },
    /* Lokalt läge säger till av egen kraft när cringe-nivån går för högt */
    localCheck: function () {
      var c = this.cringe;
      var now = Date.now();
      if (c >= 95) {
        if (!this.superSince) this.superSince = now;
      } else if (c < 85) {
        this.superSince = 0;
      }
      if (now - (this.lastLocal || 0) < 12000) return;
      var lvl = 0;
      if (this.superSince && now - this.superSince > 3000) lvl = 3;
      else if (c >= 85) lvl = 2;
      else if (c >= 70) lvl = 1;
      if (!lvl) return;
      this.lastLocal = now;
      this.superSince = 0;
      this.verdict({
        niva: lvl,
        replik: lvl === 1
          ? 'Nu blev det lite väl livligt — sänk volymen så vi hör varandra.'
          : lvl === 2
            ? 'Sluta trams och skrik. Sätt dig ner och fortsätt med uppgiften, nu.'
            : 'Det här går inte längre. Du går ut ur klassrummet i fem minuter.',
        vem: 'Okänd',
        vad: 'Cringe-nivå ' + c + ' (' + this.cringeLabel(c) + ')'
      }, false);
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
          if (f.name === 'cringe_niva') {
            var p = Math.max(0, Math.min(100, parseInt((f.args || {}).poang, 10) || 0));
            self.cringe = p;
            self.cringeFrom = 'ai';
            self.cringeWhy = (f.args || {}).varfor || self.cringeLabel(p);
            self.cringeHist.push(p);
            if (self.cringeHist.length > 120) self.cringeHist.shift();
            self.emit();
            return;
          }
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

      /* Cringe-mätaren: syns hela tiden, inte bara när något händer */
      var gauge = ctx.el('div', 'cringe-box');
      var gaugeHead = ctx.el('div', 'cringe-head');
      var gaugeNum = ctx.el('div', 'cringe-num', '0');
      var gaugeLabel = ctx.el('div', 'cringe-label', 'Lugnt');
      gaugeHead.appendChild(gaugeNum);
      gaugeHead.appendChild(gaugeLabel);
      var gaugeBar = ctx.el('div', 'cringe-bar');
      var gaugeFill = ctx.el('i');
      gaugeBar.appendChild(gaugeFill);
      var spark = ctx.el('canvas', 'cringe-spark');
      spark.width = 300; spark.height = 46;
      gauge.appendChild(gaugeHead);
      gauge.appendChild(gaugeBar);
      gauge.appendChild(spark);

      var meter = ctx.el('div', 'meter');
      meter.style.height = '22px';
      var fill = ctx.el('div', 'meter-fill');
      meter.appendChild(fill);
      var log = ctx.el('div', 'list');
      log.style.cssText = 'margin-top:12px;max-height:34%;overflow:auto';

      body.appendChild(status);
      body.appendChild(gauge);
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
          ' · Saldo ' + App.Credits.fmt(App.Credits.balance()) +
          (App.Mic.backend ? ' · ' + (App.Mic.backend === 'native' ? 'Androids mikrofon' : 'webbmikrofon') : '') +
          '</div></div>';
        fill.style.width = (t.armed ? t.level : 0) + '%';

        var c = t.armed ? t.cringe : 0;
        var col = c >= 85 ? '#dc2626' : c >= 70 ? '#f97316' : c >= 45 ? '#f59e0b' : c >= 25 ? '#84cc16' : '#16a34a';
        gaugeNum.textContent = c;
        gaugeNum.style.color = col;
        gaugeLabel.textContent = (t.armed ? t.cringeWhy : 'Avstängd') +
          (t.armed && t.cringeFrom === 'ai' ? ' · AI mäter' : t.armed ? ' · lokal mätning' : '');
        gaugeFill.style.width = c + '%';
        gaugeFill.style.background = col;
        drawSpark(t.cringeHist, col);

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
      function drawSpark(hist, col) {
        var g = spark.getContext('2d');
        var w = spark.width, h = spark.height;
        g.clearRect(0, 0, w, h);
        var cs = getComputedStyle(document.body);
        [70, 85].forEach(function (mark) {
          g.strokeStyle = 'rgba(150,150,170,.35)';
          g.setLineDash([3, 4]);
          g.beginPath();
          g.moveTo(0, h - (mark / 100) * h);
          g.lineTo(w, h - (mark / 100) * h);
          g.stroke();
          g.setLineDash([]);
        });
        if (!hist.length) return;
        var n = Math.min(hist.length, 120);
        var data = hist.slice(-n);
        g.beginPath();
        data.forEach(function (v, i) {
          var x = (i / Math.max(1, n - 1)) * w;
          var y = h - (v / 100) * h;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.strokeStyle = col;
        g.lineWidth = 2;
        g.stroke();
        g.lineTo(w, h); g.lineTo(0, h); g.closePath();
        g.fillStyle = col + '22';
        g.fill();
        void cs;
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
