/* Sändo Elev — Boken: elevens egen arbetsbok som PDF. */
(function (global) {
  'use strict';

  App.registrera('bok', function (wrap) {
    wrap.appendChild(App.el('h2', 'rubrik', '📖 Boken'));
    App.saknasNyckel(wrap);
    wrap.appendChild(App.el('p', 'ingress',
      'Ladda upp din arbetsbok som PDF. Då kan Monni hjälpa dig med just dina uppgifter, ' +
      'med rätt kapitel och rätt sidor.'));

    var lista = App.el('div', 'col');
    wrap.appendChild(lista);

    function rita() {
      lista.innerHTML = '';
      var bocker = App.Gemini.docs.all();
      /* docs.all() och docs.aktiv() kommer ur var sin JSON.parse, så samma bok
         är två olika objekt. Jämför på id, aldrig med ===. */
      var aktivId = (App.Gemini.docs.aktiv() || {}).id;

      if (!bocker.length) {
        var tom = App.el('div', 'card');
        tom.innerHTML = '<h3>Ingen bok än</h3><p class="muted">Ladda upp en PDF så vet Monni vad ni jobbar med. ' +
          'Filen ligger hos Google i 48 timmar och läggs sedan upp på nytt vid behov.</p>';
        lista.appendChild(tom);
      }

      bocker.forEach(function (b) {
        var kort = App.el('div', 'card');
        var timmar = b.expires ? Math.max(0, Math.round((new Date(b.expires) - Date.now()) / 3600000)) : null;
        kort.innerHTML = '<h3>' + App.esc(b.name) + '</h3>' +
          '<p class="muted">' + (b.size ? Math.round(b.size / 1024) + ' kB' : '') +
          (timmar === null ? '' : ' · ' + timmar + ' h kvar hos Google') +
          (b.id === aktivId ? ' · <b>används nu</b>' : '') + '</p>';
        var r = App.el('div', 'row');
        r.style.marginTop = '12px';
        if (b.id !== aktivId) {
          r.appendChild(App.button('Använd den här', 'liten', function () {
            App.Gemini.docs.setAktiv(b.id);
            rita();
          }));
        } else {
          r.appendChild(App.button('💬 Fastnat på en fråga?', 'liten', function () {
            App.open('monni', { text: 'Jag har fastnat på uppgift ' });
          }));
        }
        r.appendChild(App.button('Ta bort', 'ghost liten', function () {
          App.confirm('Ta bort boken?', b.name + ' tas bort ur appen.', function () {
            App.Gemini.docs.remove(b.id);
            rita();
          });
        }));
        kort.appendChild(r);
        lista.appendChild(kort);
      });

      var varning = App.el('div', 'card varning');
      varning.innerHTML = '<h3>⚠️ Kolla sista sidan i boken först</h3>' +
        '<p class="muted">Många läromedel har ett förbehåll längst bak, där copyright och ISBN står. ' +
        'Står det att materialet inte får användas för att träna AI — ladda inte upp boken.</p>';
      lista.appendChild(varning);

      var ladda = App.button('⬆️ Ladda upp arbetsbok (PDF)', 'bred', valjFil);
      lista.appendChild(ladda);
    }

    function valjFil() {
      var f = App.el('input');
      f.type = 'file';
      f.accept = 'application/pdf';
      f.style.display = 'none';
      document.body.appendChild(f);
      f.addEventListener('change', function () {
        var fil = f.files && f.files[0];
        document.body.removeChild(f);
        if (!fil) return;
        if (fil.size > 18 * 1024 * 1024) { App.toast('PDF:en är för stor (max 18 MB)'); return; }
        bekrafta(fil, function () {
          App.toast('Laddar upp ' + fil.name + '…', 5000);
          App.Gemini.uploadFile(fil, function (err, bok) {
            if (err) { App.toast(err, 5000); return; }
            App.toast(bok.name + ' är uppladdad');
            rita();
          });
        });
      });
      f.click();
    }

    /* Samma fråga som i Sändo Tavla, och av samma skäl: förbehållet står i
       den enskilda boken, inte i appen. Frågan ställs vid varje uppladdning. */
    function bekrafta(fil, fortsatt) {
      var box = App.el('div', 'col');
      var v = App.el('div', 'card varning');
      v.innerHTML = '<h3>Har du läst sista sidan?</h3>' +
        '<p>Innan <b>' + App.esc(fil.name) + '</b> laddas upp: slå upp sista sidan i boken, ' +
        'där copyright och ISBN står.</p>' +
        '<p style="margin-top:8px">Står det där att materialet <b>inte får användas för att träna AI</b> — ' +
        'eller för maskininlärning, textutvinning eller språkmodeller — ska du inte ladda upp den.</p>' +
        '<p class="muted" style="margin-top:8px">Filen skickas till Google och ligger kvar där i 48 timmar. ' +
        'Uppladdningen kostar ' + App.Credits.fmt(App.Credits.IN) + ' krediter.</p>';
      box.appendChild(v);

      var rad = App.el('label', 'rad');
      var kryss = App.el('input');
      kryss.type = 'checkbox';
      kryss.style.cssText = 'width:26px;height:26px;flex:0 0 auto';
      var etikett = App.el('span', 'grow', 'Jag har läst sista sidan och det står inget förbud mot AI där.');
      rad.appendChild(kryss);
      rad.appendChild(etikett);
      box.appendChild(rad);

      var knappar = App.el('div', 'row');
      knappar.style.marginTop = '14px';
      var avbryt = App.button('Avbryt', 'ghost grow', function () { App.hideSheet(); });
      var kor = App.button('⬆️ Ladda upp', 'grow', function () {
        if (!kryss.checked) { App.toast('Kryssa i rutan först — eller avbryt', 3000); return; }
        App.hideSheet();
        fortsatt();
      });
      knappar.appendChild(avbryt);
      knappar.appendChild(kor);
      box.appendChild(knappar);
      App.sheet('📄 ' + fil.name, box, null, false);
    }

    rita();
  });
  void global;
})(window);
