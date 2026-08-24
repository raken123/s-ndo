/* AI-komponenter som utgår från lärarens eget material i Gemini */
(function (global, App) {
  'use strict';

  var SKOLREGLER =
    'Du är en AI i ett svenskt klassrum, på en tavla som hela klassen ser. Svara alltid på svenska, ' +
    'sakligt och åldersanpassat. Håll dig till skolarbetet. Är frågan olämplig, privat eller ' +
    'utanför skolan säger du kort att det inte hör hemma på lektionen och föreslår något som gör det. ' +
    'Hitta aldrig på fakta om lärarens material — säg hellre att det inte står i dokumenten. ' +
    'Skriv utan markdown-stjärnor; använd korta stycken och tankstreck för listor.';

  /* Enkel textrendering: AI-svar som går att läsa på håll i ett klassrum */
  function renderText(host, text) {
    host.innerHTML = '';
    String(text).split('\n').forEach(function (line) {
      var clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '');
      var p = App.el('div', '', clean);
      p.style.cssText = 'margin-bottom:6px;line-height:1.45;font-size:17px' +
        (/^\s*[-–•]/.test(clean) ? ';padding-left:10px' : '') +
        (/^\s*$/.test(clean) ? ';height:6px' : '');
      host.appendChild(p);
    });
  }

  function docBadge(ctx) {
    var docs = App.Gemini.docs.all();
    var d = ctx.el('div', 'muted');
    d.style.cssText = 'font-size:13px;margin-bottom:8px';
    d.textContent = docs.length
      ? '📄 Utgår från: ' + docs.map(function (x) { return x.name; }).join(', ')
      : '📄 Inga dokument tillagda — svaren blir allmänna. Lägg till PDF under ⚙️ Inställningar.';
    return d;
  }

  /* ---------------- Fabrik för de frågedrivna AI-korten ---------------- */
  function aiCard(spec) {
    App.register({
      id: spec.id, name: spec.name, icon: spec.icon, cat: 'AI',
      desc: spec.desc, keys: 'ai gemini ' + (spec.keys || ''),
      mount: function (root, ctx) {
        var L = ctx.layout(root);
        var form = ctx.el('div', 'col');
        form.style.marginBottom = '12px';
        var values = {};
        var inputs = {};

        L.body.appendChild(docBadge(ctx));
        L.body.appendChild(form);

        (spec.fields || []).forEach(function (f) {
          var field = ctx.el('div', 'field');
          field.appendChild(ctx.el('label', '', f.label));
          var input;
          if (f.type === 'textarea') {
            input = ctx.el('textarea');
            input.style.height = (f.rows || 3) * 30 + 'px';
          } else if (f.type === 'select') {
            input = ctx.el('select');
            f.options.forEach(function (o) {
              var opt = ctx.el('option', '', o);
              opt.value = o;
              input.appendChild(opt);
            });
          } else {
            input = ctx.el('input');
            input.type = f.type || 'text';
          }
          if (f.placeholder) input.placeholder = f.placeholder;
          var start = ctx.Store.get('f.' + f.key, f.def || (f.type === 'select' ? f.options[0] : ''));
          input.value = start;
          input.addEventListener('change', function () { ctx.Store.set('f.' + f.key, input.value); });
          inputs[f.key] = input;
          field.appendChild(input);
          form.appendChild(field);
        });

        var out = ctx.el('div', 'card');
        out.style.cssText = 'min-height:80px';
        var saved = ctx.Store.get('svar', '');
        if (saved) { renderText(out, saved); } else {
          out.innerHTML = '<span class="muted">Svaret hamnar här.</span>';
        }
        L.body.appendChild(out);

        function ask() {
          Object.keys(inputs).forEach(function (k) { values[k] = inputs[k].value.trim(); });
          if (spec.needsDocs && !App.Gemini.docs.all().length) {
            App.toast('Lägg till en PDF under ⚙️ Inställningar först');
            return;
          }
          var missing = (spec.fields || []).filter(function (f) { return f.required && !values[f.key]; });
          if (missing.length) { App.toast('Fyll i ' + missing[0].label.toLowerCase()); return; }
          out.innerHTML = '<span class="muted">AI:n tänker…</span>';
          App.Gemini.generate({
            prompt: spec.prompt(values, App),
            system: SKOLREGLER + (spec.system ? '\n' + spec.system : ''),
            label: spec.name,
            temperature: spec.temperature,
            maxTokens: spec.maxTokens || 4000
          }, function (err, text) {
            if (err) {
              out.innerHTML = '<span style="color:var(--danger)">' + App.esc(err) + '</span>';
              return;
            }
            ctx.Store.set('svar', text);
            renderText(out, text);
            if (spec.onAnswer) spec.onAnswer(text, values, ctx);
          });
        }

        L.bar.appendChild(ctx.button('✨ Fråga AI:n', 'sm', ask));
        L.bar.appendChild(ctx.button('📝 Lägg på tavlan', 'sm ghost', function () {
          var text = ctx.Store.get('svar', '');
          if (!text) { App.toast('Inget svar än'); return; }
          global.Board.addWidget('notes', { store: { notes: text } });
        }));
        if (spec.extraButton) {
          L.bar.appendChild(ctx.button(spec.extraButton.label, 'sm ghost', function () {
            var text = ctx.Store.get('svar', '');
            if (!text) { App.toast('Inget svar än'); return; }
            spec.extraButton.run(text, ctx);
          }));
        }
        L.bar.appendChild(ctx.button('🗑️', 'sm ghost', function () {
          ctx.Store.set('svar', '');
          out.innerHTML = '<span class="muted">Svaret hamnar här.</span>';
        }));
      }
    });
  }

  /* ================= AI-Lärare: samtal grundat i lärarens PDF:er ================= */
  App.register({
    id: 'ailarare', name: 'AI-Lärare', icon: '👩‍🏫', cat: 'AI',
    desc: 'Pratar om allt i kursen — men först måste arbetsboken och lärarhandledningen läggas till som PDF.',
    keys: 'ai lärare pdf arbetsbok lärarhandledning fråga chatt gemini',
    mount: function (root, ctx) {
      var L = ctx.layout(root);
      var docBar = ctx.el('div', 'card');
      docBar.style.marginBottom = '10px';
      var chat = ctx.el('div', 'list');
      chat.style.cssText = 'gap:10px;padding-bottom:8px';
      var askRow = ctx.el('div', 'row');
      var input = ctx.el('input');
      input.type = 'text';
      input.placeholder = 'Fråga om arbetsboken, ett kapitel, en uppgift…';
      input.style.flex = '1';
      L.body.appendChild(docBar);
      L.body.appendChild(chat);
      L.body.appendChild(askRow);

      var history = ctx.Store.get('chat', []);

      function renderDocs() {
        var docs = App.Gemini.docs.all();
        if (!docs.length) {
          docBar.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:6px">📄 Lägg till materialet först</div>' +
            '<div class="muted" style="font-size:14px;line-height:1.5">AI-Läraren svarar utifrån elevernas ' +
            'arbetsbok och lärarhandledningen. Lägg till dem som PDF innan du börjar fråga.</div>';
        } else {
          docBar.innerHTML = '<div style="font-weight:700;margin-bottom:6px">📄 Material AI-Läraren läser</div>' +
            docs.map(function (d) {
              return '<div class="muted" style="font-size:14px">' + App.esc(d.kind) + ': ' + App.esc(d.name) + '</div>';
            }).join('');
        }
        var row = ctx.el('div', 'row');
        row.style.marginTop = '10px';
        row.appendChild(ctx.button('➕ Lägg till PDF', 'sm', function () { pick('arbetsbok'); }));
        row.appendChild(ctx.button('📕 Lärarhandledning', 'sm ghost', function () { pick('lärarhandledning'); }));
        if (docs.length) {
          row.appendChild(ctx.button('🗑️ Rensa material', 'sm ghost', function () {
            App.confirm('Ta bort allt material?', 'AI-Läraren har då inget att utgå från.', function () {
              App.Gemini.docs.all().forEach(function (d) { App.Gemini.docs.remove(d.id); });
              renderDocs();
            });
          }));
        }
        docBar.appendChild(row);
        input.disabled = !docs.length;
        input.placeholder = docs.length
          ? 'Fråga om arbetsboken, ett kapitel, en uppgift…'
          : 'Lägg till en PDF först';
      }

      function pick(kind) {
        var file = ctx.el('input');
        file.type = 'file';
        file.accept = 'application/pdf';
        file.style.display = 'none';
        document.body.appendChild(file);
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          document.body.removeChild(file);
          if (!f) return;
          if (f.size > 18 * 1024 * 1024) { App.toast('PDF:en är för stor (max 18 MB)'); return; }
          App.confirmUpload(f, function () {
            App.toast('Laddar upp ' + f.name + '…', 4000);
            App.Gemini.uploadFile(f, kind, function (err, doc) {
              if (err) { App.toast(err, 5000); return; }
              App.toast(doc.name + ' tillagd');
              renderDocs();
            });
          });
        });
        file.click();
      }

      function bubble(role, text) {
        var b = ctx.el('div', 'list-item');
        b.style.cssText = 'display:block;white-space:pre-wrap;line-height:1.45;' +
          (role === 'user' ? 'background:var(--brand-soft);font-weight:600' : '');
        b.textContent = (role === 'user' ? '🧑‍🏫 ' : '👩‍🏫 ') + text;
        chat.appendChild(b);
        chat.scrollTop = chat.scrollHeight;
        return b;
      }
      function renderChat() {
        chat.innerHTML = '';
        history.forEach(function (m) {
          bubble(m.role === 'user' ? 'user' : 'ai', m.parts[0].text);
        });
      }

      function ask() {
        var q = input.value.trim();
        if (!q) return;
        if (!App.Gemini.docs.all().length) { App.toast('Lägg till en PDF först'); return; }
        input.value = '';
        history.push({ role: 'user', parts: [{ text: q }] });
        bubble('user', q);
        var pending = bubble('ai', 'tänker…');
        App.Gemini.generate({
          prompt: q,
          system: SKOLREGLER + '\nDu är AI-Lärare och utgår från de bifogade dokumenten — elevernas ' +
            'arbetsbok och lärarhandledningen. Hänvisa till kapitel och uppgiftsnummer när du kan. ' +
            'Står svaret inte i materialet säger du det, och svarar sedan kort allmänt i stället. ' +
            'Ge aldrig färdiga svar på en uppgift utan att också förklara vägen dit.',
          history: history.slice(0, -1).slice(-8),
          label: 'AI-Lärare',
          maxTokens: 4000
        }, function (err, text) {
          if (err) {
            pending.textContent = '⚠️ ' + err;
            history.pop();
            return;
          }
          pending.textContent = '👩‍🏫 ' + text;
          history.push({ role: 'model', parts: [{ text: text }] });
          history = history.slice(-16);
          ctx.Store.set('chat', history);
          chat.scrollTop = chat.scrollHeight;
        });
      }

      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
      askRow.appendChild(input);
      askRow.appendChild(ctx.button('✨ Fråga', 'sm', ask));
      L.bar.appendChild(ctx.button('🧹 Nytt samtal', 'sm ghost', function () {
        history = [];
        ctx.Store.set('chat', history);
        renderChat();
      }));
      L.bar.appendChild(ctx.button('💳 Krediter', 'sm ghost', function () { App.showCredits(); }));
      renderDocs();
      renderChat();
    }
  });

  /* ================= Tolv AI-komponenter till ================= */
  aiCard({
    id: 'aiprov', name: 'Provgenerator', icon: '📝',
    desc: 'Gör ett prov eller en quiz utifrån arbetsboken eller ett ämne.',
    keys: 'prov quiz frågor test',
    fields: [
      { key: 'amne', label: 'Ämne eller kapitel', placeholder: 'T.ex. bråk, kapitel 3', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' },
      { key: 'antal', label: 'Antal frågor', type: 'number', def: '8' },
      { key: 'typ', label: 'Typ', type: 'select', options: ['Blandat', 'Flerval', 'Öppna frågor', 'Sant/falskt'] }
    ],
    prompt: function (v) {
      return 'Skriv ett prov för årskurs ' + v.ak + ' om: ' + v.amne + '. ' + v.antal + ' frågor av typen ' +
        v.typ.toLowerCase() + '. Numrera frågorna. Lägg facit sist under rubriken FACIT.';
    }
  });

  aiCard({
    id: 'aiforklara', name: 'Förklara enklare', icon: '💡',
    desc: 'Förklarar ett svårt begrepp på rätt nivå för klassen.',
    keys: 'förklara begrepp enkelt',
    fields: [
      { key: 'sak', label: 'Vad ska förklaras?', placeholder: 'T.ex. fotosyntes', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' },
      { key: 'stil', label: 'Hur', type: 'select', options: ['Enkelt och kort', 'Med en liknelse', 'Steg för steg', 'Med ett exempel från vardagen'] }
    ],
    prompt: function (v) {
      return 'Förklara "' + v.sak + '" för årskurs ' + v.ak + '. ' + v.stil + '. Högst 150 ord. ' +
        'Avsluta med en kontrollfråga till klassen.';
    }
  });

  aiCard({
    id: 'airatta', name: 'Rättningshjälp', icon: '✅',
    desc: 'Ger formativ återkoppling på ett elevsvar.',
    keys: 'rätta bedömning återkoppling feedback',
    fields: [
      { key: 'uppgift', label: 'Uppgiften', type: 'textarea', rows: 2, required: true },
      { key: 'svar', label: 'Elevens svar', type: 'textarea', rows: 4, required: true },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'Uppgift: ' + v.uppgift + '\nElevens svar: ' + v.svar + '\n\nÅrskurs ' + v.ak +
        '. Ge återkoppling i tre delar: Det här är bra, Det här kan utvecklas, Nästa steg. ' +
        'Skriv till eleven, uppmuntrande och konkret. Sätt inget betyg.';
    }
  });

  aiCard({
    id: 'ailektion', name: 'Lektionsplanerare', icon: '🗂️',
    desc: 'Planerar en lektion med tider, moment och material.',
    keys: 'lektionsplan planering upplägg',
    fields: [
      { key: 'amne', label: 'Ämne och innehåll', placeholder: 'T.ex. multiplikation med 7', required: true },
      { key: 'min', label: 'Minuter', type: 'number', def: '60' },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'Planera en lektion på ' + v.min + ' minuter för årskurs ' + v.ak + ' om: ' + v.amne +
        '. Dela upp i moment med minuter, ange mål, material och en avslutande exit ticket. ' +
        'Utgå från lärarhandledningen om den finns bland dokumenten.';
    }
  });

  aiCard({
    id: 'aiglosor', name: 'Glosgenerator', icon: '🔤',
    desc: 'Gör en ordlista som kan skickas rakt in i Glosförhöret.',
    keys: 'glosor ord lista språk',
    fields: [
      { key: 'amne', label: 'Ämne eller språk', placeholder: 'T.ex. engelska, djur', required: true },
      { key: 'antal', label: 'Antal ord', type: 'number', def: '12' },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'Gör en ordlista med ' + v.antal + ' ord för årskurs ' + v.ak + ' om: ' + v.amne +
        '. Skriv exakt en rad per ord i formatet: fråga = svar. Ingen inledning, inga rubriker.';
    },
    extraButton: {
      label: '📖 Skapa glosförhör',
      run: function (text) {
        var pairs = text.split('\n').map(function (line) {
          var p = line.split('=');
          return p.length >= 2 ? { a: p[0].replace(/^[-\d.\s]+/, '').trim(), b: p.slice(1).join('=').trim() } : null;
        }).filter(function (x) { return x && x.a && x.b; });
        if (!pairs.length) { App.toast('Hittade inga ordpar i svaret'); return; }
        global.Board.addWidget('quiz', { store: { quizPairs: pairs } });
      }
    }
  });

  aiCard({
    id: 'aisammanfatta', name: 'Sammanfattare', icon: '📚',
    desc: 'Sammanfattar ett kapitel ur materialet till punkter för tavlan.',
    keys: 'sammanfattning kapitel punkter',
    needsDocs: true,
    fields: [
      { key: 'kapitel', label: 'Kapitel eller avsnitt', placeholder: 'T.ex. kapitel 3', required: true },
      { key: 'antal', label: 'Antal punkter', type: 'number', def: '6' }
    ],
    prompt: function (v) {
      return 'Sammanfatta ' + v.kapitel + ' ur det bifogade materialet i ' + v.antal +
        ' korta punkter som kan skrivas på tavlan. Varje punkt högst 15 ord.';
    }
  });

  aiCard({
    id: 'aiexempel', name: 'Räkneexempel', icon: '🧮',
    desc: 'Räknar ett exempel steg för steg att gå igenom tillsammans.',
    keys: 'matte exempel uträkning steg',
    fields: [
      { key: 'typ', label: 'Vilken sorts tal', placeholder: 'T.ex. addition med tiotalsövergång', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' },
      { key: 'antal', label: 'Antal exempel', type: 'number', def: '3' }
    ],
    prompt: function (v) {
      return 'Visa ' + v.antal + ' räkneexempel för årskurs ' + v.ak + ' på: ' + v.typ +
        '. Varje exempel med uträkning steg för steg och svar. Skriv så att det kan följas på tavlan.';
    }
  });

  aiCard({
    id: 'aifraga', name: 'Fråga AI:n', icon: '🙋',
    desc: 'Elevernas frågor — svar som håller sig till lektionen.',
    keys: 'fråga elev svar',
    fields: [
      { key: 'fraga', label: 'Elevens fråga', type: 'textarea', rows: 3, required: true },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'En elev i årskurs ' + v.ak + ' frågar: "' + v.fraga + '". Svara kort och tydligt. ' +
        'Hör frågan inte hemma på lektionen: säg det vänligt på en mening och föreslå en fråga som gör det.';
    }
  });

  aiCard({
    id: 'aiord', name: 'Ordförklararen', icon: '🔍',
    desc: 'Förklarar ett ord på tre nivåer — lätt, lagom och svårt.',
    keys: 'ord begrepp förklaring nivå',
    fields: [{ key: 'ord', label: 'Ordet', placeholder: 'T.ex. demokrati', required: true }],
    prompt: function (v) {
      return 'Förklara ordet "' + v.ord + '" på tre nivåer, var och en högst 30 ord: ' +
        'FÖR DE YNGSTA, LAGOM, FÖR DEN SOM VILL VETA MER. Avsluta med en mening där ordet används.';
    }
  });

  aiCard({
    id: 'aiskriv', name: 'Skrivstartare', icon: '✍️',
    desc: 'Ger skrivuppgifter och meningsstartare till klassen.',
    keys: 'skriva uppsats berättelse start',
    fields: [
      { key: 'tema', label: 'Tema', placeholder: 'T.ex. rymden', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' },
      { key: 'typ', label: 'Texttyp', type: 'select', options: ['Berättelse', 'Faktatext', 'Insändare', 'Dagbok', 'Dikt'] }
    ],
    prompt: function (v) {
      return 'Ge tre skrivuppgifter av typen ' + v.typ.toLowerCase() + ' för årskurs ' + v.ak +
        ' på temat ' + v.tema + '. Till varje uppgift: en meningsstartare och tre ord att få med.';
    }
  });

  aiCard({
    id: 'aidiskussion', name: 'Diskussionsledare', icon: '💬',
    desc: 'Diskussionsfrågor med följdfrågor att leda samtalet med.',
    keys: 'diskussion samtal frågor debatt',
    fields: [
      { key: 'amne', label: 'Ämne', placeholder: 'T.ex. källkritik', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'Ge fem diskussionsfrågor om ' + v.amne + ' för årskurs ' + v.ak +
        '. Till varje fråga en följdfråga att ställa när klassen kört fast. Håll det neutralt och tryggt.';
    }
  });

  aiCard({
    id: 'aiexit', name: 'Exit ticket', icon: '🎫',
    desc: 'Tre snabba frågor att avsluta lektionen med.',
    keys: 'exit ticket avslutning kontroll',
    fields: [
      { key: 'amne', label: 'Lektionens innehåll', placeholder: 'T.ex. bråk', required: true },
      { key: 'ak', label: 'Årskurs', def: '5' }
    ],
    prompt: function (v) {
      return 'Skriv en exit ticket för årskurs ' + v.ak + ' om ' + v.amne +
        ': tre korta frågor som visar om eleverna förstått, från lätt till svår. Lägg facit sist.';
    },
    maxTokens: 2500
  });

  aiCard({
    id: 'aioversatt', name: 'Översättare', icon: '🌍',
    desc: 'Översätter det som står på tavlan för nyanlända elever.',
    keys: 'översätt språk nyanländ modersmål',
    fields: [
      { key: 'text', label: 'Text att översätta', type: 'textarea', rows: 4, required: true },
      { key: 'sprak', label: 'Till språk', placeholder: 'T.ex. arabiska, ukrainska', required: true }
    ],
    prompt: function (v) {
      return 'Översätt till ' + v.sprak + ': "' + v.text + '". Ge först översättningen, sedan samma text ' +
        'på enkel svenska. Inga kommentarer.';
    },
    temperature: 0.1
  });

})(window, window.App);
