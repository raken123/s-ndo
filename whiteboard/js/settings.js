/* Inställningar: klasser, elevnamn, ljud, tema, säkerhetskopiering */
(function (App) {
  'use strict';

  App.register({
    id: 'settings', name: 'Inställningar', icon: '⚙️', cat: 'System',
    desc: 'Klasser, elevnamn, ljud och tema.',
    keys: 'inställningar klass elever namn ljud tema backup',
    mount: function (root) {
      var L = App.layout(root);
      var wrap = App.el('div', 'grid2');
      L.body.appendChild(wrap);

      /* ----- Klasser och elever ----- */
      var classCard = App.el('div', 'card');
      wrap.appendChild(classCard);

      function renderClasses() {
        var classes = App.classes();
        var active = App.activeIndex();
        classCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:12px">👥 Klasser och elever</h3>';

        var sel = App.el('select');
        sel.style.width = '100%';
        classes.forEach(function (c, i) {
          var o = App.el('option', '', c.name + ' (' + (c.students || []).length + ' elever)');
          o.value = i;
          sel.appendChild(o);
        });
        sel.value = active;
        sel.addEventListener('change', function () {
          App.setActiveClass(parseInt(sel.value, 10));
          renderClasses();
        });
        var f = App.el('div', 'field');
        f.appendChild(App.el('label', '', 'Aktiv klass'));
        f.appendChild(sel);
        classCard.appendChild(f);

        var row = App.el('div', 'row');
        row.style.margin = '14px 0';
        row.appendChild(App.button('➕ Ny klass', 'sm', function () {
          var i = App.el('input'); i.type = 'text'; i.placeholder = 'Namn på klassen'; i.style.width = '100%';
          App.modal('Ny klass', i, function () {
            var list = App.classes();
            list.push({ name: i.value.trim() || 'Klass ' + (list.length + 1), students: [] });
            App.saveClasses(list);
            App.setActiveClass(list.length - 1);
            renderClasses();
          }, 'Skapa');
        }));
        row.appendChild(App.button('✏️ Byt namn', 'sm ghost', function () {
          var list = App.classes();
          var i = App.el('input'); i.type = 'text'; i.value = list[App.activeIndex()].name; i.style.width = '100%';
          App.modal('Byt namn på klassen', i, function () {
            list[App.activeIndex()].name = i.value.trim() || list[App.activeIndex()].name;
            App.saveClasses(list); renderClasses();
          }, 'Spara');
        }));
        row.appendChild(App.button('🗑️ Ta bort klass', 'sm ghost', function () {
          var list = App.classes();
          if (list.length <= 1) { App.toast('Minst en klass måste finnas'); return; }
          App.confirm('Ta bort klassen?', 'Klassen och dess elevlista raderas.', function () {
            list.splice(App.activeIndex(), 1);
            App.saveClasses(list);
            App.setActiveClass(0);
            renderClasses();
          });
        }));
        classCard.appendChild(row);

        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:260px;font-size:18px';
        ta.placeholder = 'Ett elevnamn per rad…';
        ta.value = (classes[active].students || []).join('\n');
        var tf = App.el('div', 'field');
        tf.appendChild(App.el('label', '', 'Elevernas namn — ett per rad'));
        tf.appendChild(ta);
        classCard.appendChild(tf);

        var saveRow = App.el('div', 'row');
        saveRow.style.marginTop = '14px';
        saveRow.appendChild(App.button('💾 Spara elevlistan', 'sm', function () {
          var list = App.classes();
          list[App.activeIndex()].students = ta.value.split('\n')
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
          App.saveClasses(list);
          App.toast('Elevlistan sparad (' + list[App.activeIndex()].students.length + ' elever)');
          renderClasses();
        }));
        saveRow.appendChild(App.button('🔀 Sortera A–Ö', 'sm ghost', function () {
          ta.value = ta.value.split('\n').map(function (s) { return s.trim(); })
            .filter(Boolean).sort(function (a, b) { return a.localeCompare(b, 'sv'); }).join('\n');
        }));
        classCard.appendChild(saveRow);
      }
      renderClasses();

      /* ----- Mikrofon ----- */
      var micCard = App.el('div', 'card');
      micCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">🎤 Mikrofon</h3>' +
        '<p class="muted" style="font-size:14px;line-height:1.5;margin-bottom:12px">' +
        'Ljuddetektorn och tramsdetektorn delar på samma mikrofonström. Får du ' +
        '"mikrofonen är upptagen": stäng andra appar som spelar in och testa här.</p>';
      wrap.appendChild(micCard);

      var micSel = App.el('select');
      micSel.style.width = '100%';
      var micField = App.el('div', 'field');
      micField.style.marginBottom = '12px';
      micField.appendChild(App.el('label', '', 'Vilken mikrofon'));
      micField.appendChild(micSel);
      micCard.appendChild(micField);

      function fillDevices() {
        App.Mic.devices(function (list) {
          var cur = App.Mic.deviceId();
          micSel.innerHTML = '<option value="">Enhetens standardmikrofon</option>';
          list.forEach(function (d, i) {
            var o = App.el('option', '', d.label || ('Mikrofon ' + (i + 1)));
            o.value = d.deviceId;
            micSel.appendChild(o);
          });
          micSel.value = cur;
        });
      }
      micSel.addEventListener('change', function () {
        App.Mic.setDeviceId(micSel.value);
        App.toast('Mikrofon vald — starta om detektorn');
      });
      fillDevices();

      var micMeter = App.el('div', 'meter');
      micMeter.style.marginBottom = '10px';
      var micFill = App.el('div', 'meter-fill');
      micMeter.appendChild(micFill);
      micCard.appendChild(micMeter);
      var micStatus = App.el('div', 'muted');
      micStatus.style.cssText = 'font-size:15px;line-height:1.5;min-height:24px';
      micCard.appendChild(micStatus);

      var micRow = App.el('div', 'row');
      micRow.style.marginTop = '12px';
      micRow.appendChild(App.button('🎙️ Testa mikrofonen', 'sm', function () {
        micStatus.textContent = 'Säg något — mätning pågår i tre sekunder…';
        App.Mic.test(function (lvl) {
          micFill.style.width = lvl + '%';
        }, function (err, peak) {
          micFill.style.width = '0%';
          if (err) {
            micStatus.innerHTML = '<span style="color:var(--danger)">' + App.esc(err) + '</span>';
            return;
          }
          fillDevices();
          micStatus.textContent = peak > 12
            ? '✅ Mikrofonen fungerar. Toppnivå ' + peak + '.'
            : '⚠️ Mikrofonen svarar men hörde nästan ingenting (toppnivå ' + peak +
              '). Kontrollera att rätt mikrofon är vald och att inget täcker den.';
        });
      }));
      micRow.appendChild(App.button('🩺 Mikrofondiagnos', 'sm ghost', function () { App.micDiagnosis(); }));
      if (window.AndroidBridge) {
        micRow.appendChild(App.button('🔓 Be om mikrofonbehörighet', 'sm ghost', function () {
          if (AndroidBridge.requestMicPermission) AndroidBridge.requestMicPermission();
          micStatus.textContent = 'Svara ja i rutan som kommer upp, testa sedan mikrofonen igen.';
        }));
        micRow.appendChild(App.button('🔊 Slå av systemets mikrofonmute', 'sm ghost', function () {
          if (AndroidBridge.unmuteMic) AndroidBridge.unmuteMic();
          micStatus.textContent = 'Mikrofonmute avslagen. Testa mikrofonen igen.';
        }));
      }
      micRow.appendChild(App.button('⏹️ Släpp mikrofonen', 'sm ghost', function () {
        App.Mic.hardRelease();
        micStatus.textContent = 'Mikrofonen släppt. Alla detektorer är avstängda.';
      }));
      micCard.appendChild(micRow);

      if (window.AndroidBridge && AndroidBridge.startNativeMic) {
        var natRow = App.el('div', 'list-item');
        natRow.style.marginTop = '12px';
        natRow.appendChild(App.el('span', 'grow', 'Tvinga Androids egen mikrofon (AudioRecord)'));
        var natOn = App.Store.get('mic.forceNative', false);
        var natBtn = App.button(natOn ? 'PÅ' : 'AV', natOn ? 'sm' : 'sm ghost', function () {
          natOn = !natOn;
          App.Store.set('mic.forceNative', natOn);
          natBtn.textContent = natOn ? 'PÅ' : 'AV';
          natBtn.className = 'btn ' + (natOn ? 'sm' : 'sm ghost');
          App.Mic.hardRelease();
          App.toast(natOn ? 'Använder Androids mikrofon direkt' : 'Använder webbmikrofonen först');
        });
        natRow.appendChild(natBtn);
        micCard.appendChild(natRow);
        var natInfo = App.el('div', 'muted');
        natInfo.style.cssText = 'font-size:13.5px;line-height:1.5;margin-top:8px';
        natInfo.textContent = 'Appen provar alltid webbmikrofonen först och byter automatiskt till ' +
          'Androids egen mikrofon om WebView svarar "Could not start audio source". Slå på det här ' +
          'om du vill hoppa över webbförsöket direkt.';
        micCard.appendChild(natInfo);
      }

      /* ----- Tramsdetektorn och Gemini ----- */
      var aiCard = App.el('div', 'card');
      aiCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">🤖 Tramsdetektor</h3>' +
        '<p class="muted" style="font-size:14px;line-height:1.5;margin-bottom:12px">' +
        'Tramsdetektorn är appens enda AI-komponent. Utan API-nyckel kör den i lokalt läge, ' +
        'som lyssnar efter skrik och hög ljudnivå utan att kosta krediter.</p>';
      wrap.appendChild(aiCard);

      function textField(parent, label, key, def, placeholder) {
        var f = App.el('div', 'field');
        f.style.marginBottom = '12px';
        f.appendChild(App.el('label', '', label));
        var i = App.el('input');
        i.type = 'text';
        i.value = App.Store.get(key, def);
        if (placeholder) i.placeholder = placeholder;
        i.addEventListener('change', function () {
          App.Store.set(key, i.value.trim());
          App.toast('Sparat');
        });
        f.appendChild(i);
        parent.appendChild(f);
        return i;
      }
      function numField(parent, label, key, def, min, max) {
        var f = App.el('div', 'field');
        f.style.marginBottom = '12px';
        f.appendChild(App.el('label', '', label));
        var i = App.el('input');
        i.type = 'number';
        i.min = min; i.max = max;
        i.value = App.Store.get(key, def);
        i.addEventListener('change', function () {
          var v = Math.max(min, Math.min(max, parseInt(i.value, 10) || def));
          i.value = v;
          App.Store.set(key, v);
        });
        f.appendChild(i);
        parent.appendChild(f);
        return i;
      }

      var keyInput = textField(aiCard, 'Gemini API-nyckel (sparas bara på den här enheten)',
        'gemini.key', '', 'AIza… eller ett OAuth-token');
      keyInput.type = 'password';
      var keyRow = App.el('div', 'row');
      keyRow.style.marginBottom = '12px';
      keyRow.appendChild(App.button('👁️ Visa/dölj nyckeln', 'sm ghost', function () {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      }));
      keyRow.appendChild(App.button('🗑️ Ta bort nyckeln', 'sm ghost', function () {
        App.Store.set('gemini.key', '');
        keyInput.value = '';
        App.toast('Nyckeln borttagen från enheten');
      }));
      aiCard.appendChild(keyRow);

      var keyStatus = App.el('div', 'muted');
      keyStatus.style.cssText = 'font-size:14px;line-height:1.5;white-space:pre-wrap;margin-bottom:12px';
      keyStatus.textContent = App.Store.get('gemini.auth', '')
        ? 'Senast fungerande metod: ' + (App.Store.get('gemini.auth') === 'key' ? '?key=' : '?access_token=')
        : 'Nyckeln är inte testad än.';
      aiCard.appendChild(keyStatus);
      var keyTestRow = App.el('div', 'row');
      keyTestRow.style.marginBottom = '12px';
      keyTestRow.appendChild(App.button('🧪 Testa API-nyckeln', 'sm', function () {
        keyStatus.textContent = 'Frågar Google…';
        App.Gemini.testKey(function (res) {
          keyStatus.innerHTML = (res.ok ? '<span style="color:var(--ok)">✅ </span>' : '<span style="color:var(--danger)">❌ </span>') +
            App.esc(res.text);
        });
      }));
      aiCard.appendChild(keyTestRow);

      var modelField = textField(aiCard, 'Modell (Gemini Live, tramsdetektorn)', 'gemini.model', 'gemini-3.1-flash-live-preview');
      textField(aiCard, 'Modell (text, övriga AI-komponenter)', 'gemini.textModel', 'gemini-3.5-flash');
      var modelRow = App.el('div', 'row');
      modelRow.style.marginBottom = '12px';
      modelRow.appendChild(App.button('📋 Hämta modeller nyckeln har', 'sm ghost', function () {
        keyStatus.textContent = 'Hämtar modellista…';
        App.Gemini.liveModels(function (live, all) {
          if (!all.length) { keyStatus.textContent = 'Kunde inte hämta modeller — testa nyckeln först.'; return; }
          if (!live.length) { keyStatus.textContent = 'Nyckeln har ' + all.length + ' modeller men ingen live-modell.'; return; }
          var box = App.el('div', 'list');
          live.forEach(function (m) {
            var row = App.el('div', 'list-item');
            row.appendChild(App.el('span', 'grow', m));
            row.appendChild(App.button('Välj', 'sm', function () {
              App.Store.set('gemini.model', m);
              modelField.value = m;
              App.hideModal();
              App.toast('Modell vald: ' + m);
            }));
            box.appendChild(row);
          });
          keyStatus.textContent = live.length + ' live-modeller hittades.';
          App.modal('Live-modeller på den här nyckeln', box, null, 'Stäng');
        });
      }));
      aiCard.appendChild(modelRow);
      numField(aiCard, 'Sekunder ljud per input (varje input kostar ' + App.Credits.fmt(App.Credits.IN) + ')',
        'trams.segment', 15, 5, 120);
      numField(aiCard, 'Skrikgräns i lokalt läge (0–100)', 'trams.sens', 62, 20, 100);

      var camRow = App.el('div', 'list-item');
      camRow.appendChild(App.el('span', 'grow', 'Kameravakt vid utvisning'));
      var camOn = App.Store.get('trams.camera', true);
      var camBtn = App.button(camOn ? 'PÅ' : 'AV', camOn ? 'sm' : 'sm ghost', function () {
        camOn = !camOn;
        App.Store.set('trams.camera', camOn);
        camBtn.textContent = camOn ? 'PÅ' : 'AV';
        camBtn.className = 'btn ' + (camOn ? 'sm' : 'sm ghost');
      });
      camRow.appendChild(camBtn);
      aiCard.appendChild(camRow);

      /* ----- Dokument som AI-Läraren utgår från ----- */
      var docCard = App.el('div', 'card');
      wrap.appendChild(docCard);
      function renderDocs() {
        var docs = App.Gemini.docs.all();
        docCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">📄 Material till AI-Läraren</h3>' +
          '<p class="muted" style="font-size:14px;line-height:1.5;margin-bottom:10px">' +
          'Elevernas arbetsbok och lärarhandledningen som PDF. AI-Läraren och de andra ' +
          'AI-komponenterna utgår från dem. Filerna ligger hos Google i 48 timmar och laddas ' +
          'sedan upp på nytt vid behov. Ladda inte upp material med elevers personuppgifter.</p>' +
          '<div class="card" style="border:2px solid var(--warn);border-left-width:10px;margin-bottom:12px">' +
          '<b>⚠️ Kolla sista sidan i boken först</b>' +
          '<p style="font-size:14px;line-height:1.6;margin-top:6px">' +
          'Många läromedel har ett förbehåll på sista sidan, i kolofonen intill copyright ' +
          'och ISBN. Står det där att materialet <b>inte får användas för att träna AI</b> ' +
          '(eller för maskininlärning, textutvinning eller språkmodeller) — ladda inte upp ' +
          'boken. Frågar du en förlagsjurist är det förbehållet som gäller, inte den här appen.</p>' +
          '</div>';
        var list = App.el('div', 'list');
        if (!docs.length) {
          list.appendChild(App.el('div', 'muted', 'Inga dokument tillagda än.'));
        }
        docs.forEach(function (d) {
          var row = App.el('div', 'list-item');
          var timmar = d.expires ? Math.max(0, Math.round((new Date(d.expires) - Date.now()) / 3600000)) : null;
          row.innerHTML = '<span class="pill">' + App.esc(d.kind) + '</span>' +
            '<span class="grow">' + App.esc(d.name) + '</span>' +
            '<span class="muted">' + (timmar === null ? '' : timmar + ' h kvar') + '</span>';
          row.appendChild(App.button('✕', 'sm ghost', function () {
            App.Gemini.docs.remove(d.id);
            renderDocs();
          }));
          list.appendChild(row);
        });
        docCard.appendChild(list);

        var addRow = App.el('div', 'row');
        addRow.style.marginTop = '14px';
        [['arbetsbok', '📘 Lägg till arbetsbok'], ['lärarhandledning', '📕 Lägg till lärarhandledning'],
         ['material', '📄 Annat material']].forEach(function (k) {
          addRow.appendChild(App.button(k[1], 'sm' + (k[0] === 'material' ? ' ghost' : ''), function () {
            var file = App.el('input');
            file.type = 'file';
            file.accept = 'application/pdf';
            file.style.display = 'none';
            document.body.appendChild(file);
            file.addEventListener('change', function () {
              var f = file.files && file.files[0];
              document.body.removeChild(file);
              if (!f) return;
              if (f.size > 18 * 1024 * 1024) { App.toast('PDF:en är för stor (max 18 MB)'); return; }
              /* Uppladdningen skickar hela boken till Google. Fråga varje gång,
                 för förbehållet står i den enskilda boken — inte i appen. */
              App.confirmUpload(f, function () {
                App.toast('Laddar upp ' + f.name + '…', 4000);
                App.Gemini.uploadFile(f, k[0], function (err, doc) {
                  if (err) { App.toast(err, 5000); return; }
                  App.toast(doc.name + ' tillagd');
                  renderDocs();
                });
              });
            });
            file.click();
          }));
        });
        docCard.appendChild(addRow);
      }
      renderDocs();

      /* ----- Lärarverifiering ----- */
      var verCard = App.el('div', 'card');
      wrap.appendChild(verCard);
      function renderVerify() {
        var c = App.Credits;
        var v = App.Verify.state();
        if (v.status === 'verified') {
          verCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">🪪 Lärarverifiering</h3>' +
            '<p style="font-size:17px;line-height:1.6"><b>✓ Verifierad</b> — ' + App.esc(v.namn) +
            ', ' + App.esc(v.skola) + '<br>' +
            '<span class="muted" style="font-size:14px">Verifierad ' +
            new Date(v.at).toLocaleDateString('sv-SE') + '. Kreditnivå: ' + c.fmt(c.VERIFIED) +
            '. Bilden på kortet sparades aldrig.</span></p>';
          var rv = App.el('div', 'row');
          rv.style.marginTop = '12px';
          rv.appendChild(App.button('✕ Ta bort verifieringen', 'sm ghost', function () {
            App.confirm('Ta bort verifieringen?',
              'Kreditnivån går tillbaka till ' + c.fmt(c.START) + ' och saldot sänks till det.',
              function () {
                App.Verify.clear();
                renderVerify();
                renderCredits();
              });
          }));
          verCard.appendChild(rv);
        } else {
          verCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">🪪 Lärarverifiering</h3>' +
            '<p style="font-size:15px;line-height:1.6">Skanna ditt id-kort eller din ' +
            'lärarlegitimation med kameran, så höjs krediterna från ' + c.fmt(c.START) +
            ' till <b>' + c.fmt(c.VERIFIED) + '</b>.</p>' +
            '<p class="muted" style="font-size:14px;line-height:1.6;margin-top:8px">' +
            'Bilden granskas på plattan och kastas direkt efteråt — den sparas inte och ' +
            'skickas ingenstans. Kvar blir namn, skola och datum.</p>';
          var rn = App.el('div', 'row');
          rn.style.marginTop = '12px';
          rn.appendChild(App.button('🪪 Skanna id-kort', 'sm', function () {
            App.showVerify(function () { renderVerify(); renderCredits(); });
          }));
          verCard.appendChild(rn);
        }
      }
      renderVerify();

      /* ----- Krediter ----- */
      var credCard = App.el('div', 'card');
      wrap.appendChild(credCard);
      function renderCredits() {
        var c = App.Credits;
        var verifierad = App.Verify.isVerified();
        credCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:6px">💳 Användningskrediter</h3>' +
          App.midNum(c.fmt(c.balance()) + (verifierad ? ' ✓' : '')) +
          '<p class="muted" style="font-size:14px;line-height:1.6;margin-top:8px">' +
          (verifierad
            ? 'Nivå: verifierad lärare — ' + c.fmt(c.VERIFIED) + '.<br>'
            : 'Gratis start: ' + c.fmt(c.START) + '. Verifierad lärare: ' + c.fmt(c.VERIFIED) + '.<br>') +
          'Input (ett ljudsegment som skickas till AI:n): ' + c.fmt(c.IN) + '.<br>' +
          'Output (en tillsägelse från AI:n): ' + c.fmt(c.OUT) + '.<br>' +
          'Lokalt läge och manuella rapporter kostar ingenting.</p>';
        var r = App.el('div', 'row');
        r.style.marginTop = '14px';
        r.appendChild(App.button('📜 Visa historik', 'sm ghost', function () { App.showCredits(); }));
        r.appendChild(App.button('↺ Återställ till ' + c.fmt(c.tier()), 'sm ghost', function () {
          App.confirm('Återställ krediterna?', 'Saldot sätts tillbaka till ' + c.fmt(c.tier()) + '.', function () {
            c.reset();
            renderCredits();
          });
        }));
        credCard.appendChild(r);
      }
      renderCredits();

      /* ----- App-inställningar ----- */
      var appCard = App.el('div', 'card');
      appCard.innerHTML = '<h3 style="font-size:22px;margin-bottom:12px">🎛️ Appen</h3>';
      wrap.appendChild(appCard);

      function toggleRow(label, key, def, onChange) {
        var row = App.el('div', 'list-item');
        row.appendChild(App.el('span', 'grow', label));
        var on = App.Store.get(key, def);
        var b = App.button(on ? 'PÅ' : 'AV', on ? 'sm' : 'sm ghost', function () {
          on = !on;
          App.Store.set(key, on);
          b.textContent = on ? 'PÅ' : 'AV';
          b.className = 'btn ' + (on ? 'sm' : 'sm ghost');
          if (onChange) onChange(on);
        });
        row.appendChild(b);
        appCard.appendChild(row);
        return row;
      }
      var opts = App.el('div', 'list');
      appCard.appendChild(opts);
      toggleRow('Mörkt läge', 'dark', false, function () { App.applyTheme(); });
      toggleRow('Tyst läge (inga pip)', 'mute', false);

      var sizeRow = App.el('div', 'row');
      sizeRow.style.marginTop = '14px';
      sizeRow.appendChild(App.el('span', 'muted', 'Testa ljudet:'));
      sizeRow.appendChild(App.button('🔔 Spela pip', 'sm ghost', function () { App.chime(2); }));
      appCard.appendChild(sizeRow);

      var backup = App.el('div', 'row');
      backup.style.marginTop = '18px';
      backup.appendChild(App.button('📤 Exportera data', 'sm ghost', function () {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k.indexOf('sandotavla.') === 0) data[k] = localStorage.getItem(k);
        }
        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:240px;font-size:13px';
        ta.value = JSON.stringify(data);
        App.modal('Kopiera texten och spara den', ta, null, 'Klar');
      }));
      backup.appendChild(App.button('📥 Importera data', 'sm ghost', function () {
        var ta = App.el('textarea');
        ta.style.cssText = 'width:100%;height:240px;font-size:13px';
        ta.placeholder = 'Klistra in exporterad data här';
        App.modal('Importera', ta, function () {
          try {
            var data = JSON.parse(ta.value);
            Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); });
            App.toast('Data importerad');
            App.applyTheme();
            App.home();
          } catch (e) { App.toast('Kunde inte läsa datan'); }
        }, 'Importera');
      }));
      backup.appendChild(App.button('♻️ Rensa all data', 'sm ghost', function () {
        App.confirm('Rensa allt?', 'Klasser, scheman, poäng och inställningar raderas.', function () {
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k.indexOf('sandotavla.') === 0) keys.push(k);
          }
          keys.forEach(function (k) { localStorage.removeItem(k); });
          App.applyTheme();
          App.toast('All data rensad');
          App.home();
        });
      }));
      appCard.appendChild(backup);

      var about = App.el('div', 'muted');
      about.style.cssText = 'margin-top:20px;font-size:14px;line-height:1.6';
      about.innerHTML = 'Sändo Tavla ' + (App.version || '1.1.0') +
        '<br>Whiteboard för tablet och smartboard. Tavlor, sidor, komponenter och nycklar sparas lokalt på enheten.';
      appCard.appendChild(about);
    }
  });

})(window.App);
