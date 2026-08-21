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
      about.innerHTML = 'Sändo Tavla ' + (App.version || '1.0.0') +
        '<br>Klassrumstavla för tablet och smartboard. All data sparas lokalt på enheten.';
      appCard.appendChild(about);
    }
  });

})(window.App);
