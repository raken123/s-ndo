/* Sändo Elev — Sagor: idéer när man inte vet vad man ska skriva.
 *
 * Monni ger uppslag, inte en färdig saga. Samma princip som med uppgifterna:
 * hjälpen tar dig fram till raden, sedan skriver du den. En färdigskriven
 * saga vore lika mycket ett facit som ett färdigt svar på ett matematiktal. */
(function (global) {
  'use strict';

  var GENRER = ['Spännande', 'Rolig', 'Läskig', 'Fantasy', 'Vardagsnära', 'Mysterium', 'Sci-fi', 'Sagoland'];
  var LANGDER = ['En halv sida', 'En sida', 'Två sidor'];

  var Sagor = {
    system: function () {
      return [
        'Du är Monni i appen Sändo Elev och hjälper en elev som ska skriva en berättelse.',
        'Språk: svenska, du-tilltal, kort och konkret. Högst 160 ord.',
        '',
        'Du ger IDÉER — aldrig den färdiga texten. Du skriver inte elevens saga åt hen,',
        'inte ens om hen ber om det. Ber eleven om en färdig text: säg nej i en mening och',
        'ge en bättre början i stället.',
        '',
        'Svara alltid med den här strukturen, med rubrikerna:',
        'IDÉ: en mening om vad som händer.',
        'PERSONER: två personer med varsitt tydligt drag.',
        'MILJÖ: var och när.',
        'FÖRSTA MENINGEN: en enda mening som eleven får låna för att komma igång.',
        'VÄNDNING: något som går fel i mitten.',
        'FRÅGOR ATT SVARA PÅ: tre frågor som eleven måste bestämma själv.',
        '',
        'Du får ge exakt EN första mening — inte ett stycke, inte två meningar.'
      ].join('\n');
    },

    /* Fångar en Monni som fått för sig att skriva hela sagan ändå: en
       "FÖRSTA MENINGEN" som inte är en mening utan ett helt stycke. */
    kortaForstaMeningen: function (text) {
      return String(text || '').replace(/(FÖRSTA MENINGEN:\s*)([\s\S]*?)(?=\n[A-ZÅÄÖ ]{3,}:|$)/i,
        function (_, rubrik, brod) {
          var forsta = /^[\s\S]*?[.!?]/.exec(brod.trim());
          return rubrik + (forsta ? forsta[0].trim() : brod.trim()) + '\n';
        });
    },

    fraga: function (onskan, cb) {
      var self = this;
      App.Gemini.generate({
        prompt: onskan,
        system: this.system(),
        useDocs: false,
        temperature: 1.0,
        label: 'Monni: sagoidé'
      }, function (err, text) {
        if (err) { cb(err); return; }
        cb(null, self.kortaForstaMeningen(text).trim());
      });
    }
  };
  global.Sagor = Sagor;


  App.registrera('sagor', function (wrap) {
    wrap.appendChild(App.el('h2', 'rubrik', '✏️ Sagor'));
    App.saknasNyckel(wrap);
    wrap.appendChild(App.el('p', 'ingress',
      'Vet du inte vad du ska skriva om? Välj en känsla och en längd, så ger Monni uppslag. ' +
      'Sagan skriver du själv — det är den roliga delen.'));

    var valGenre = App.Store.get('sagor.genre', GENRER[0]);
    var valLangd = App.Store.get('sagor.langd', LANGDER[1]);

    var kortG = App.el('div', 'card');
    kortG.appendChild(App.el('h3', null, 'Vad ska det vara för sorts berättelse?'));
    var chipsG = App.el('div', 'chips');
    chipsG.style.marginTop = '8px';
    GENRER.forEach(function (g) {
      var b = App.el('button', 'valchip' + (g === valGenre ? ' pa' : ''), g);
      b.type = 'button';
      b.addEventListener('click', function () {
        valGenre = g;
        App.Store.set('sagor.genre', g);
        Array.prototype.forEach.call(chipsG.children, function (c) { c.classList.toggle('pa', c.textContent === g); });
      });
      chipsG.appendChild(b);
    });
    kortG.appendChild(chipsG);
    wrap.appendChild(kortG);

    var kortL = App.el('div', 'card');
    kortL.appendChild(App.el('h3', null, 'Hur lång ska den vara?'));
    var chipsL = App.el('div', 'chips');
    chipsL.style.marginTop = '8px';
    LANGDER.forEach(function (l) {
      var b = App.el('button', 'valchip' + (l === valLangd ? ' pa' : ''), l);
      b.type = 'button';
      b.addEventListener('click', function () {
        valLangd = l;
        App.Store.set('sagor.langd', l);
        Array.prototype.forEach.call(chipsL.children, function (c) { c.classList.toggle('pa', c.textContent === l); });
      });
      chipsL.appendChild(b);
    });
    kortL.appendChild(chipsL);
    wrap.appendChild(kortL);

    var egen = App.el('textarea', 'falt');
    egen.placeholder = 'Något du redan vet att du vill ha med? (frivilligt)';
    egen.value = App.Store.get('sagor.egen', '');
    egen.addEventListener('input', function () { App.Store.set('sagor.egen', egen.value); });
    wrap.appendChild(egen);

    var ut = App.el('div', 'col');
    wrap.appendChild(ut);

    var knapp = App.button('💡 Ge mig idéer', 'bred', function () {
      knapp.disabled = true;
      ut.innerHTML = '';
      var vantar = App.el('div', 'card', 'Monni tänker…');
      ut.appendChild(vantar);
      var onskan = 'Genre: ' + valGenre + '. Längd: ' + valLangd + '.' +
        (egen.value.trim() ? ' Eleven vill ha med: ' + egen.value.trim() : '') +
        ' Ge uppslag enligt strukturen.';
      Sagor.fraga(onskan, function (err, text) {
        knapp.disabled = false;
        ut.innerHTML = '';
        if (err) { App.toast(err, 5000); return; }
        var kort = App.el('div', 'card');
        text.split(/\n{2,}|\n(?=[A-ZÅÄÖ ]{3,}:)/).forEach(function (stycke) {
          var d = App.el('div', null);
          d.style.cssText = 'margin-bottom:10px;white-space:pre-wrap;line-height:1.5';
          var m = /^([A-ZÅÄÖ ]{3,}):\s*([\s\S]*)$/.exec(stycke.trim());
          if (m) {
            var h = App.el('div', null, m[1]);
            h.style.cssText = 'font-weight:800;font-size:14px;color:var(--brand-ink);letter-spacing:.03em';
            d.appendChild(h);
            d.appendChild(document.createTextNode(m[2]));
          } else {
            d.textContent = stycke.trim();
          }
          if (d.textContent.trim()) kort.appendChild(d);
        });
        ut.appendChild(kort);

        var rad = App.el('div', 'row');
        rad.appendChild(App.button('🔁 Ge mig andra', 'ghost liten', function () { knapp.click(); }));
        rad.appendChild(App.button('💬 Fråga Monni om den här', 'ghost liten', function () {
          App.open('monni', { text: 'Jag håller på med en berättelse. ' });
        }));
        ut.appendChild(rad);

        var pafot = App.el('p', 'muted');
        pafot.style.fontSize = '13px';
        pafot.textContent = 'Monni skriver inte sagan åt dig — bara uppslagen. Resten är din.';
        ut.appendChild(pafot);
      });
    });
    wrap.appendChild(knapp);
  });
})(window);
