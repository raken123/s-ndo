/* Sändo Elev — Repet: en repetition att lyssna på i bilen.
 *
 * Monni plockar frågor ur arbetsboken och lägger dem i formatet
 * sandoelev.repet/1 — det format CarPlay-appen läser (se ../carplay/).
 *
 * Formatet har inget fält för svar. I chatten finns en svarsvakt som läser
 * Monnis text innan eleven ser den; i en bil finns ingen sådan väg, för ljudet
 * är redan i luften när någon hör det. Därför ligger regeln här i stället:
 * Repet.validera() kastar allt som ens ser ut att kunna bära ett facit, och en
 * repetition som inte går att städa blir ingen repetition alls.
 */
(function (global) {
  'use strict';

  var SVARSORD = /(svar|facit|losning|lösning|resultat|answer|key|correct|ratt|rätt)/i;

  var Repet = {
    FORMAT: 'sandoelev.repet/1',
    PAUS: 6,

    system: function (bok) {
      return [
        'Du är Monni i appen Sändo Elev. Du ska göra en LYSSNINGSREPETITION av ett kapitel',
        'i elevens arbetsbok "' + bok + '". Den spelas upp i en bil på väg till skolan:',
        'en fråga läses högt, sedan är det tyst medan eleven svarar högt, sedan nästa fråga.',
        '',
        'DU SKRIVER ALDRIG SVAREN. Repetitionen är frågor och ingenting annat. Det finns',
        'inget fält att lägga ett svar i, och du ska inte hitta på ett.',
        '',
        'Svara med enbart JSON, utan förklaring och utan kodstaket:',
        '{"titel":"...","underrubrik":"...","avsnitt":[',
        '  {"id":"kort-id","titel":"...","sidor":"42-45","frågor":["...","..."]}',
        ']}',
        '',
        'Regler för frågorna:',
        '• Varje fråga ska gå att svara på högt, utan penna och utan att se boken.',
        '• Skriv tal i ord: "sex gånger sju", inte "6 × 7". Det ska läsas upp av en röst.',
        '• Varje fråga slutar med frågetecken eller punkt.',
        '• Två till fyra avsnitt, fyra till åtta frågor i varje.',
        '• Blanda: några rena tabellfrågor, några som ber eleven förklara hur den tänker,',
        '  och några om ordens betydelse i kapitlet.'
      ].join('\n');
    },

    /* Städar det Monni skickade och vägrar det som inte går att lita på. */
    validera: function (rad, bok) {
      if (!rad || typeof rad !== 'object') throw new Error('Monni svarade inte med en repetition.');
      var avsnitt = (Array.isArray(rad.avsnitt) ? rad.avsnitt : []).map(function (a, i) {
        var fragor = (Array.isArray(a['frågor']) ? a['frågor'] : [])
          .map(function (f) { return String(f).trim(); })
          .filter(function (f) { return f.length > 3 && f.length < 240; })
          .map(function (f) { return /[?.!]$/.test(f) ? f : f + '?'; })
          .slice(0, 10);
        return {
          id: String(a.id || 'avsnitt-' + (i + 1)).slice(0, 40).replace(/[^\w-]/g, '-'),
          titel: String(a.titel || 'Avsnitt ' + (i + 1)).slice(0, 60),
          sidor: String(a.sidor || '').slice(0, 20),
          'frågor': fragor
        };
      }).filter(function (a) { return a['frågor'].length >= 2; }).slice(0, 6);

      if (!avsnitt.length) throw new Error('Repetitionen blev tom. Prova igen.');

      var rep = {
        format: this.FORMAT,
        titel: String(rad.titel || bok).slice(0, 80),
        underrubrik: String(rad.underrubrik || '').slice(0, 80),
        bok: bok,
        rost: 'sv-SE',
        pausSekunder: this.PAUS,
        avsnitt: avsnitt
      };
      /* Sista kontrollen: inget fält får ens heta något som liknar ett svar. */
      var funna = this.letaSvarsfalt(rep);
      if (funna.length) throw new Error('Repetitionen innehöll fält som kan bära svar: ' + funna.join(', '));
      return rep;
    },

    letaSvarsfalt: function (o, stig) {
      stig = stig || '';
      var funna = [];
      var self = this;
      if (Array.isArray(o)) {
        o.forEach(function (v, i) { funna = funna.concat(self.letaSvarsfalt(v, stig + '[' + i + ']')); });
      } else if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) {
          if (SVARSORD.test(k)) funna.push(stig + '.' + k);
          funna = funna.concat(self.letaSvarsfalt(o[k], stig + '.' + k));
        });
      }
      return funna;
    },

    /* Modellen lägger gärna kodstaket runt sin JSON trots tillsägelse. */
    plockaJson: function (text) {
      var t = String(text || '').replace(/```(?:json)?/gi, '').trim();
      var i = t.indexOf('{'), j = t.lastIndexOf('}');
      if (i < 0 || j <= i) throw new Error('Monni svarade inte med JSON.');
      return JSON.parse(t.slice(i, j + 1));
    },

    senaste: function () { return App.Store.get('repet.senaste', null); },
    antalFragor: function (rep) {
      return (rep && rep.avsnitt || []).reduce(function (s, a) { return s + a['frågor'].length; }, 0);
    },

    skapa: function (kapitel, cb) {
      var self = this;
      var bokfil = App.Gemini.docs.aktiv();
      if (!bokfil) { cb('Ladda upp din arbetsbok först.'); return; }
      App.Gemini.generate({
        prompt: 'Gör en lyssningsrepetition av ' + (String(kapitel).trim() || 'det kapitel vi jobbar med nu') + '.',
        system: this.system(bokfil.name),
        temperature: 0.5,
        maxTokens: 2600,
        label: 'Repet till bilen'
      }, function (err, text) {
        if (err) { cb(err); return; }
        var rep;
        try {
          rep = self.validera(self.plockaJson(text), bokfil.name);
        } catch (e) {
          cb(e.message);
          return;
        }
        App.Store.set('repet.senaste', rep);
        cb(null, rep);
      });
    }
  };

  global.Repet = Repet;
})(window);
