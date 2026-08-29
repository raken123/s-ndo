/* Sändo Elev — Matteplatser.
 *
 * Krediter går att förtjäna genom att gå någonstans. Fem frågor per plats,
 * tjugo sekunder var.
 *
 * Tre saker som styrde hur det här är byggt:
 *
 * 1. Platserna räknas fram lokalt, inte av en server.
 *    Positionen lämnar aldrig telefonen. Det finns ingen karttjänst att fråga
 *    och ingen lista att ladda ner — världen delas in i rutor om ungefär 400
 *    meter, och varje ruta får sina platser ur en slumpgenerator som såddes
 *    med rutans eget nummer. Två elever som står på samma gata ser samma
 *    platser, i dag och nästa år, utan att någon någonsin fick veta var de
 *    stod.
 *
 * 2. Frågorna kan inte komma från Monni.
 *    Tjugo sekunder räcker inte till ett API-anrop, och en fråga som kostar
 *    krediter att ställa är fel sätt att dela ut krediter. De räknas fram
 *    lokalt ur samma sorts generator, sådd med platsen och dagens datum: nya
 *    frågor varje dag, samma frågor hela dagen.
 *
 * 3. Man måste faktiskt gå dit.
 *    Att öppna en plats kräver att telefonen är inom 40 meter. Det är ungefär
 *    så nära man kommer med gps utomhus, och det går inte att trycka sig
 *    förbi.
 */
(function (global) {
  'use strict';

  /* En ruta är 0,0036° i latitud ≈ 400 m. I longitud krymper en grad mot
     polerna, så rutan räknas om efter breddgraden — annars blir rutorna i
     norra Sverige smala remsor. */
  var RUTA_LAT = 0.0036;
  var RADIE = 400;      /* meter: så långt bort en plats får ligga */
  var NARA = 40;        /* meter: så nära man måste vara för att öppna den */
  var PER_RUTA = 5;
  var FRAGOR = 5;
  var SEKUNDER = 20;
  var JORDEN = 6371000;

  /* ---------- slump med sådd ----------
     mulberry32. Samma sådd ger samma serie, varje gång, i varje webbläsare.
     Det är hela grunden för att platserna ska ligga still. */
  function slump(sadd) {
    var a = sadd >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Sträng till 32-bitars tal. FNV-1a. */
  function hasha(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function grader(x) { return x * Math.PI / 180; }

  /* Avstånd i meter mellan två punkter. Haversine — pythagoras duger inte när
     longitudgraderna krymper, och den skillnaden är hela 40-metersgränsen. */
  function meterMellan(a, b) {
    var dLat = grader(b.lat - a.lat);
    var dLon = grader(b.lon - a.lon);
    var la1 = grader(a.lat), la2 = grader(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * JORDEN * Math.asin(Math.min(1, Math.sqrt(h))));
  }

  /* Longitudrutans bredd på den här breddgraden, i grader. */
  function rutaLon(lat) {
    var k = Math.cos(grader(lat));
    return RUTA_LAT / Math.max(0.02, Math.abs(k));   /* klamrat: cos → 0 vid polerna */
  }

  var ORD1 = ['Tal', 'Bråk', 'Nolla', 'Sjua', 'Triangel', 'Kvadrat', 'Vinkel', 'Decimal',
              'Multiplikations', 'Division', 'Primtal', 'Rest', 'Faktor', 'Summa', 'Kvot'];
  var ORD2 = ['berget', 'backen', 'ängen', 'hörnet', 'gläntan', 'stigen', 'bron', 'planen',
              'trappan', 'kullen', 'diket', 'staketet', 'lyktan', 'bänken', 'dungen'];

  var Platser = {
    RADIE: RADIE,
    NARA: NARA,
    FRAGOR: FRAGOR,
    SEKUNDER: SEKUNDER,

    /* Krediter per rätt svar. Samma trappa som bilskärmen visar —
       android-elev/.../bil/PlatsSkarm.java. */
    belon: function (niva) { return niva <= 1 ? 400 : niva === 2 ? 900 : 1600; },

    /* ---------- rutor och platser ---------- */

    rutaFor: function (lat, lon) {
      var bredd = rutaLon(lat);
      return { i: Math.floor(lat / RUTA_LAT), j: Math.floor(lon / bredd), bredd: bredd };
    },

    /* Platserna i en ruta. Rutan bestämmer allt: samma ruta ger alltid samma
       fem platser, med samma namn och samma nivåer. */
    iRuta: function (i, j, bredd) {
      var r = slump(hasha('ruta:' + i + ':' + j));
      var mittLat = (i + 0.5) * RUTA_LAT;
      var mittLon = (j + 0.5) * bredd;
      var ut = [];
      for (var n = 0; n < PER_RUTA; n++) {
        var bearing = r() * 2 * Math.PI;
        /* Roten gör att platserna sprids jämnt över ytan i stället för att
           klumpa ihop sig i mitten. */
        var d = 60 + Math.sqrt(r()) * (RADIE - 60);
        var dLat = (d * Math.cos(bearing)) / JORDEN * 180 / Math.PI;
        var dLon = (d * Math.sin(bearing)) / JORDEN * 180 / Math.PI
                   / Math.max(0.02, Math.cos(grader(mittLat)));
        var niva = 1 + Math.floor(r() * 3);
        ut.push({
          id: i + ':' + j + ':' + n,
          namn: ORD1[Math.floor(r() * ORD1.length)] + ORD2[Math.floor(r() * ORD2.length)],
          lat: mittLat + dLat,
          lon: mittLon + dLon,
          niva: niva
        });
      }
      return ut;
    },

    /* Allt inom 400 meter. Rutorna runtom räknas med — annars vore en plats
       tio meter på andra sidan en rutgräns osynlig. */
    naraMig: function (lat, lon) {
      var ruta = this.rutaFor(lat, lon);
      var mig = { lat: lat, lon: lon };
      var klara = this.klaraIDag();
      var ut = [];
      for (var di = -1; di <= 1; di++) {
        for (var dj = -1; dj <= 1; dj++) {
          var lista = this.iRuta(ruta.i + di, ruta.j + dj, ruta.bredd);
          for (var k = 0; k < lista.length; k++) {
            var p = lista[k];
            var m = meterMellan(mig, p);
            if (m > RADIE) continue;
            ut.push({
              id: p.id, namn: p.namn, lat: p.lat, lon: p.lon,
              niva: p.niva, meter: m, klar: klara.indexOf(p.id) >= 0
            });
          }
        }
      }
      ut.sort(function (a, b) { return a.meter - b.meter; });
      return ut;
    },

    /* ---------- klarmarkering ----------
       En plats betalar en gång per dag. Utan det vore det bara att stå still
       och trycka om. */
    dag: function () {
      var d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    },
    klaraIDag: function () {
      if (typeof App === 'undefined') return [];      /* i självtestet finns ingen app */
      var v = App.Store.get('platser.klara', null);
      if (!v || v.dag !== this.dag()) return [];
      return v.ids || [];
    },
    markeraKlar: function (id) {
      if (typeof App === 'undefined') return;
      var ids = this.klaraIDag();
      if (ids.indexOf(id) < 0) ids.push(id);
      App.Store.set('platser.klara', { dag: this.dag(), ids: ids });
    },

    /* ---------- frågorna ----------
       Sådden är platsen plus dagens datum: nya frågor i morgon, samma frågor
       hela dagen. Att ladda om sidan mitt i ger alltså inte lättare tal. */
    fragor: function (plats) {
      var r = slump(hasha('fraga:' + plats.id + ':' + this.dag()));
      var ut = [];
      for (var n = 0; n < FRAGOR; n++) ut.push(enFraga(plats.niva, r));
      return ut;
    }
  };

  /* Nivå 1: addition och subtraktion i huvudet.
     Nivå 2: tabellerna, och division som går jämnt ut.
     Nivå 3: två steg — men fortfarande något man hinner tänka på i tjugo
     sekunder, stående på en gångväg. Talen är valda så att svaret alltid är
     ett heltal: en tidtagen fråga får inte förlora på ett avrundningsfel. */
  function enFraga(niva, r) {
    var a, b, c;
    if (niva === 1) {
      a = 12 + Math.floor(r() * 78);
      b = 5 + Math.floor(r() * 60);
      if (r() < 0.5) return { text: a + ' + ' + b, svar: a + b };
      if (b > a) { c = a; a = b; b = c; }
      return { text: a + ' − ' + b, svar: a - b };
    }
    if (niva === 2) {
      a = 3 + Math.floor(r() * 10);
      b = 3 + Math.floor(r() * 10);
      if (r() < 0.55) return { text: a + ' × ' + b, svar: a * b };
      return { text: (a * b) + ' ÷ ' + b, svar: a };
    }
    var sort = Math.floor(r() * 3);
    if (sort === 0) {
      a = 3 + Math.floor(r() * 10);
      b = 3 + Math.floor(r() * 10);
      c = 5 + Math.floor(r() * 40);
      return { text: a + ' × ' + b + ' + ' + c, svar: a * b + c };
    }
    if (sort === 1) {
      /* Procent, men bara tal som går jämnt ut. */
      var p = [10, 20, 25, 50, 75][Math.floor(r() * 5)];
      var av = (1 + Math.floor(r() * 12)) * 20;
      return { text: p + ' % av ' + av, svar: Math.round(av * p / 100) };
    }
    var namnare = [2, 3, 4, 5][Math.floor(r() * 4)];
    var taljare = 1 + Math.floor(r() * (namnare - 1));
    var tal = namnare * (2 + Math.floor(r() * 15));
    return { text: taljare + '/' + namnare + ' av ' + tal, svar: tal * taljare / namnare };
  }

  Platser._enFraga = enFraga;
  Platser._meterMellan = meterMellan;
  Platser._slump = slump;
  global.Platser = Platser;

  if (typeof module !== 'undefined' && module.exports) module.exports = Platser;
  if (typeof App === 'undefined') return;    /* körs i ett test, inte i appen */


  /* ================== positionen ================== */

  var Position = {
    senaste: null,
    vakt: null,

    /* navigator.geolocation vägrar på file:// och i osäkra ursprung. I appen
       serveras allt över https just därför — se MainActivity. */
    finns: function () { return !!(global.navigator && global.navigator.geolocation); },

    hamta: function (cb) {
      if (!this.finns()) { cb('Den här telefonen ger inte appen någon position.'); return; }
      var self = this;
      global.navigator.geolocation.getCurrentPosition(
        function (p) {
          self.senaste = { lat: p.coords.latitude, lon: p.coords.longitude,
                           noggrannhet: Math.round(p.coords.accuracy || 0), t: Date.now() };
          cb(null, self.senaste);
        },
        function (e) {
          cb(e && e.code === 1
            ? 'Appen fick inte läsa var du är. Slå på platsåtkomst för Sändo Elev.'
            : 'Hittade ingen position. Gå ut under bar himmel och försök igen.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    },

    /* Under en pågående runda följer vi positionen löpande — annars går det
       att öppna en plats på håll och sedan aldrig gå dit. */
    folj: function (cb) {
      if (!this.finns()) return;
      this.slutaFolja();
      var self = this;
      this.vakt = global.navigator.geolocation.watchPosition(function (p) {
        self.senaste = { lat: p.coords.latitude, lon: p.coords.longitude,
                         noggrannhet: Math.round(p.coords.accuracy || 0), t: Date.now() };
        cb(self.senaste);
      }, function () { /* tappad signal är inget fel — vi behåller den senaste */ },
      { enableHighAccuracy: true, maximumAge: 5000 });
    },
    slutaFolja: function () {
      if (this.vakt != null && this.finns()) {
        global.navigator.geolocation.clearWatch(this.vakt);
      }
      this.vakt = null;
    }
  };

  Platser.Position = Position;


  /* ================== vyn ================== */

  App.registrera('platser', function (wrap) {
    var topp = App.el('div', 'row');
    var rubrik = App.el('div', 'grow');
    rubrik.appendChild(App.el('h2', 'rubrik', '📍 Matteplatser'));
    rubrik.appendChild(App.el('p', 'ingress',
      'Fem frågor per plats. ' + SEKUNDER + ' sekunder var. Rätt svar ger krediter.'));
    topp.appendChild(rubrik);
    wrap.appendChild(topp);

    var status = App.el('div', 'card');
    wrap.appendChild(status);

    var lista = App.el('div');
    wrap.appendChild(lista);

    function visaFel(text) {
      status.innerHTML = '';
      status.appendChild(App.el('p', '', text));
      status.appendChild(App.button('Försök igen', 'liten', leta));
    }

    function leta() {
      status.innerHTML = '';
      status.appendChild(App.el('p', 'muted', 'Letar efter var du är …'));
      lista.innerHTML = '';
      Position.hamta(function (fel, pos) {
        if (fel) { visaFel(fel); return; }
        rita(pos);
      });
    }

    function rita(pos) {
      var funna = Platser.naraMig(pos.lat, pos.lon);
      App.Bro.spara('platser', funna);

      status.innerHTML = '';
      var rad = App.el('div', 'row');
      var v = App.el('div', 'grow');
      v.appendChild(App.el('h3', '', funna.length
        ? funna.length + ' platser inom ' + RADIE + ' meter'
        : 'Inga platser inom ' + RADIE + ' meter'));
      v.appendChild(App.el('p', 'muted',
        'Positionen är på ' + (pos.noggrannhet || '?') + ' meter när. ' +
        'Den lämnar aldrig telefonen — platserna räknas fram här.'));
      rad.appendChild(v);
      status.appendChild(rad);
      status.appendChild(App.button('Leta igen', 'ghost liten', leta));

      lista.innerHTML = '';
      funna.forEach(function (p) {
        var k = App.el('div', 'card plats' + (p.klar ? ' klar' : ''));
        var r = App.el('div', 'row');
        var t = App.el('div', 'grow');
        t.appendChild(App.el('h3', '', p.namn));
        t.appendChild(App.el('p', 'muted',
          p.meter + ' m · nivå ' + p.niva + ' · ' +
          Platser.belon(p.niva) + ' krediter per rätt svar'));
        r.appendChild(t);
        r.appendChild(App.el('div', 'plats-niva', String(p.niva)));
        k.appendChild(r);

        if (p.klar) {
          k.appendChild(App.el('p', 'muted', '✅ Klar i dag. Den öppnar igen i morgon.'));
        } else if (p.meter > NARA) {
          k.appendChild(App.el('p', 'muted',
            'Gå ' + (p.meter - NARA) + ' m närmare för att öppna den.'));
        } else {
          k.appendChild(App.button('Starta · ' + FRAGOR + ' frågor', '', function () {
            runda(p);
          }));
        }
        lista.appendChild(k);
      });
    }

    /* ---- rundan ---- */
    function runda(plats) {
      var fragor = Platser.fragor(plats);
      var nr = 0, ratt = 0, tjanat = 0;
      var timer = null, kvar = SEKUNDER;

      /* Positionen följs under hela rundan. Går man därifrån är rundan slut —
         annars vore 40-metersgränsen bara ett hinder i första sekunden. */
      var borta = false;
      Position.folj(function (pos) {
        if (borta) return;
        if (Platser._meterMellan(pos, plats) > NARA + 30) {
          borta = true;
          stoppa();
          klart('Du gick från platsen. Rundan avbröts — gå tillbaka och börja om.');
        }
      });

      function stoppa() { if (timer) { clearInterval(timer); timer = null; } }

      function avsluta() {
        stoppa();
        Position.slutaFolja();
      }

      function klart(text) {
        avsluta();
        /* Klarmarkeringen kräver alla fem. Fyra rätt ger krediter men lämnar
           platsen öppen — det ska löna sig att gå tillbaka. */
        if (ratt === FRAGOR) Platser.markeraKlar(plats.id);
        App.open('platser');
        var html = '';
        if (text) html += '<p>' + App.esc(text) + '</p>';
        html += '<p style="font-size:22px;margin:8px 0">' + ratt + ' rätt av ' + FRAGOR + '</p>';
        html += '<p class="muted">' + (tjanat
          ? '💎 ' + App.esc(App.Credits.fmt(tjanat)) + ' krediter tjänade.'
          : 'Inga krediter den här gången.') + '</p>';
        if (ratt === FRAGOR) html += '<p class="muted">Alla rätt — platsen är klar för i dag.</p>';
        App.sheet(plats.namn, html, null, 'Klart');
      }

      function nasta() {
        if (nr >= fragor.length) { klart(''); return; }
        var f = fragor[nr];
        kvar = SEKUNDER;

        var v = document.getElementById('view');
        v.innerHTML = '';
        var w = App.el('div', 'view runda');
        v.appendChild(w);

        var huvud = App.el('div', 'row');
        huvud.appendChild(App.el('div', 'grow muted',
          plats.namn + ' · fråga ' + (nr + 1) + ' av ' + FRAGOR));
        huvud.appendChild(App.el('div', 'muted', '✅ ' + ratt));
        w.appendChild(huvud);

        var klocka = App.el('div', 'klocka', String(kvar));
        w.appendChild(klocka);
        var stapel = App.el('div', 'klockstapel');
        var fyll = App.el('div', 'klockfyll');
        stapel.appendChild(fyll);
        w.appendChild(stapel);

        w.appendChild(App.el('div', 'talet', f.text));

        var svarsruta = App.el('div', 'svarsruta', '');
        w.appendChild(svarsruta);

        var matat = '';
        function visa() { svarsruta.textContent = matat === '' ? '–' : matat; }
        visa();

        var knappar = App.el('div', 'knappsats');
        ['1','2','3','4','5','6','7','8','9','−','0','⌫'].forEach(function (tecken) {
          knappar.appendChild(App.button(tecken, 'tangent', function () {
            if (tecken === '⌫') matat = matat.slice(0, -1);
            else if (tecken === '−') matat = matat.charAt(0) === '-' ? matat.slice(1) : '-' + matat;
            else if (matat.replace('-', '').length < 6) matat += tecken;
            visa();
          }));
        });
        w.appendChild(knappar);

        var svara = App.button('Svara', 'stor', function () {
          if (matat === '' || matat === '-') return;
          lamna(parseInt(matat, 10));
        });
        w.appendChild(svara);

        var slutaKnapp = App.button('Avbryt rundan', 'ghost liten', function () {
          klart('Rundan avbröts.');
        });
        w.appendChild(slutaKnapp);

        stoppa();
        timer = setInterval(function () {
          kvar--;
          klocka.textContent = String(Math.max(0, kvar));
          klocka.className = 'klocka' + (kvar <= 5 ? ' brann' : '');
          fyll.style.width = Math.max(0, kvar / SEKUNDER * 100) + '%';
          if (kvar <= 0) lamna(null);
        }, 1000);
      }

      function lamna(svar) {
        stoppa();
        var f = fragor[nr];
        var korrekt = svar !== null && svar === f.svar;
        if (korrekt) {
          ratt++;
          tjanat += App.Credits.reward(Platser.belon(plats.niva),
            'Matteplats: ' + plats.namn);
        }
        nr++;
        App.toast(korrekt
          ? '✅ Rätt · +' + App.Credits.fmt(Platser.belon(plats.niva))
          : (svar === null ? '⏱ Tiden tog slut · ' : '❌ Fel · ') + f.text + ' = ' + f.svar);
        setTimeout(nasta, 900);
      }

      nasta();
    }

    leta();
  });

})(typeof window !== 'undefined' ? window : globalThis);
