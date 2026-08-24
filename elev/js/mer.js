/* Sändo Elev — Mer: krediter, nyckel, canvas-prov, tema och data. */
(function (global) {
  'use strict';

  App.registrera('mer', function (wrap) {
    wrap.appendChild(App.el('h2', 'rubrik', '⚙️ Mer'));

    /* ----- krediter ----- */
    var kred = App.el('div', 'card');
    function ritaKrediter() {
      var c = App.Credits;
      kred.innerHTML = '<h3>💎 Krediter</h3>' +
        '<div class="stor-siffra">' + c.fmt(c.balance()) + '</div>' +
        '<p class="muted" style="margin-top:6px">Du börjar med ' + c.fmt(c.START) + ' gratis.<br>' +
        'En fråga kostar ' + c.fmt(c.IN) + ' och ett svar ' + c.fmt(c.OUT) + '.<br>' +
        'En uppladdad bok kostar ' + c.fmt(c.IN) + '. Canvas kostar ingenting extra.</p>';
      var r = App.el('div', 'row');
      r.style.marginTop = '12px';
      r.appendChild(App.button('Historik', 'ghost liten', function () {
        var box = App.el('div', 'lista');
        var logg = App.Credits.log();
        if (!logg.length) box.appendChild(App.el('div', 'muted', 'Inget draget än.'));
        logg.slice(0, 30).forEach(function (e) {
          var rad = App.el('div', 'rad');
          rad.innerHTML = '<span class="pill">' + (e.kind === 'out' ? 'Svar' : 'Fråga') + '</span>' +
            '<span class="grow">' + App.esc(e.note) + '</span>' +
            '<span class="muted">−' + App.Credits.fmt(e.cost) + '</span>';
          box.appendChild(rad);
        });
        App.sheet('💎 Kredithistorik', box, null, 'Stäng');
      }));
      r.appendChild(App.button('Återställ', 'ghost liten', function () {
        App.confirm('Återställ krediterna?', 'Saldot går tillbaka till ' + App.Credits.fmt(App.Credits.START) + '.', function () {
          App.Credits.reset();
          ritaKrediter();
        });
      }));
      kred.appendChild(r);
    }
    ritaKrediter();
    wrap.appendChild(kred);

    /* ----- API-nyckel ----- */
    var nyckel = App.el('div', 'card');
    nyckel.innerHTML = '<h3>🔑 API-nyckel</h3>' +
      '<p class="muted">Monni går mot Gemini. Nyckeln sparas bara på den här telefonen och ' +
      'ligger avsiktligt inte i appen — en nyckel som checkas in i ett publikt repo blir ' +
      'skannad och missbrukad inom timmar.</p>';
    var falt = App.el('input', 'falt');
    falt.type = 'text';
    falt.placeholder = 'Klistra in nyckeln';
    falt.value = App.Gemini.key();
    falt.style.marginTop = '10px';
    falt.setAttribute('autocapitalize', 'off');
    falt.setAttribute('autocorrect', 'off');
    falt.setAttribute('spellcheck', 'false');
    nyckel.appendChild(falt);
    var modell = App.el('input', 'falt');
    modell.type = 'text';
    modell.value = App.Gemini.model();
    modell.style.marginTop = '8px';
    modell.setAttribute('autocapitalize', 'off');
    modell.setAttribute('spellcheck', 'false');
    nyckel.appendChild(modell);
    var mLabel = App.el('p', 'muted', 'Modell (Monni använder bara text)');
    mLabel.style.fontSize = '13px';
    nyckel.appendChild(mLabel);
    var nr = App.el('div', 'row');
    nr.style.marginTop = '12px';
    nr.appendChild(App.button('Spara', 'liten', function () {
      App.Gemini.setKey(falt.value);
      App.Gemini.setModel(modell.value);
      App.toast('Sparat');
    }));
    nr.appendChild(App.button('Testa nyckeln', 'ghost liten', function () {
      App.Gemini.setKey(falt.value);
      App.toast('Testar…');
      App.Gemini.testKey(function (r) { App.toast((r.ok ? '✅ ' : '❌ ') + r.text, 6000); });
    }));
    nyckel.appendChild(nr);
    wrap.appendChild(nyckel);

    /* ----- canvas-provrum ----- */
    var prov = App.el('div', 'card');
    prov.innerHTML = '<h3>🧩 Canvas</h3>' +
      '<p class="muted">Monni kan svara med ett interaktivt exempel. Här kan du prova alla ' +
      'typerna utan att det kostar krediter.</p>';
    var chips = App.el('div', 'chips');
    chips.style.margin = '10px 0';
    var scen = App.el('div', null);
    var EXEMPEL = {
      talrad: { typ: 'talrad', min: 0, max: 20, start: 7, hopp: 5 },
      brak: { typ: 'brak', namnare: 8, taljare: 3, jamfor: 4 },
      rektangel: { typ: 'rektangel', bredd: 6, hojd: 4 },
      funktion: { typ: 'funktion', k: 2, m: -3 },
      klocka: { typ: 'klocka', timme: 8, minut: 15 },
      meningen: { typ: 'meningen', ord: ['Hunden', 'sprang', 'genom', 'den', 'blöta', 'parken'] }
    };
    Canvas.typer.forEach(function (t) {
      chips.appendChild(App.button(t, 'ghost liten', function () {
        scen.innerHTML = '';
        Canvas.rita(Canvas.validera(EXEMPEL[t]), scen);
      }));
    });
    prov.appendChild(chips);
    prov.appendChild(scen);
    wrap.appendChild(prov);

    /* ----- tema ----- */
    var tema = App.el('div', 'card');
    tema.innerHTML = '<h3>🌗 Utseende</h3>';
    var tr = App.el('div', 'row');
    tr.style.marginTop = '10px';
    [['ljus', 'Ljust'], ['mork', 'Mörkt']].forEach(function (v) {
      var b = App.el('button', 'valchip' + (App.tema() === v[0] ? ' pa' : ''), v[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        App.setTema(v[0]);
        Array.prototype.forEach.call(tr.children, function (c) { c.classList.toggle('pa', c.textContent === v[1]); });
      });
      tr.appendChild(b);
    });
    tema.appendChild(tr);
    wrap.appendChild(tema);

    /* ----- om och data ----- */
    var om = App.el('div', 'card');
    om.innerHTML = '<h3>Om Sändo Elev ' + App.version + '</h3>' +
      '<p class="muted">En app för dig som pluggar. Monni hjälper dig framåt men säger aldrig ' +
      'svaret — hjälpen kommer i fyra steg och sista steget är alltid ditt.<br><br>' +
      'Allt utom arbetsboken stannar på telefonen. Boken skickas till Google och ligger kvar ' +
      'i 48 timmar.</p>';
    var or = App.el('div', 'row');
    or.style.marginTop = '12px';
    or.appendChild(App.button('Rensa samtalet', 'ghost liten', function () {
      App.confirm('Rensa samtalet?', 'Monnis chatt och hjälpsteg nollställs. Boken blir kvar.', function () {
        Monni.nyUppgift();
        App.Store.set('monni.chatt', []);
        App.toast('Samtalet rensat');
      });
    }));
    or.appendChild(App.button('Rensa allt', 'ghost liten', function () {
      App.confirm('Rensa all data?', 'Bok, samtal, krediter och nyckel tas bort från telefonen.', function () {
        ['docs', 'aktivBok', 'monni.chatt', 'monni.historik', 'monni.logg', 'monni.steg',
         'monni.tjat', 'credits', 'creditLog', 'gemini.key', 'gemini.model', 'sagor.egen'].forEach(App.Store.del);
        App.renderCredits();
        App.open('bok');
        App.toast('Allt rensat');
      });
    }));
    om.appendChild(or);
    wrap.appendChild(om);
  });
  void global;
})(window);
