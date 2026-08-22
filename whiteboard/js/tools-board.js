/* Komponenter för tavlan: lappar, storskärmstext och anteckningar */
(function (App) {
  'use strict';

  /* ---------------- Post-it lappar ---------------- */
  App.register({
    id: 'postit', name: 'Lappar', icon: '🗒️', cat: 'Tavla',
    desc: 'Digitala post-it-lappar att flytta runt på tavlan.',
    keys: 'postit lappar anteckning brainstorm',
    mount: function (root, App) {
      var L = App.layout(root, { pad0: true });
      var area = App.el('div', 'notes-area');
      L.body.appendChild(area);
      var colors = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];
      var notes = App.Store.get('postits', []);

      function save() { App.Store.set('postits', notes); }
      function render() {
        area.innerHTML = '';
        notes.forEach(function (n, i) {
          var d = App.el('div', 'postit');
          d.style.background = n.c;
          d.style.left = n.x + 'px';
          d.style.top = n.y + 'px';
          var ta = App.el('textarea');
          ta.value = n.t;
          ta.placeholder = 'Skriv här…';
          ta.addEventListener('input', function () { n.t = ta.value; save(); });
          var x = App.el('div', 'x', '✕');
          x.addEventListener('click', function () { notes.splice(i, 1); save(); render(); });
          d.appendChild(x);
          d.appendChild(ta);

          var drag = null;
          d.addEventListener('pointerdown', function (e) {
            if (e.target.tagName === 'TEXTAREA') return;
            drag = { dx: e.clientX - n.x, dy: e.clientY - n.y };
            d.setPointerCapture(e.pointerId);
          });
          d.addEventListener('pointermove', function (e) {
            if (!drag) return;
            n.x = Math.max(0, e.clientX - drag.dx);
            n.y = Math.max(0, e.clientY - drag.dy);
            d.style.left = n.x + 'px';
            d.style.top = n.y + 'px';
          });
          d.addEventListener('pointerup', function () { if (drag) { drag = null; save(); } });
          area.appendChild(d);
        });
      }
      L.bar.appendChild(App.button('➕ Ny lapp', 'sm', function () {
        notes.push({
          t: '', c: colors[notes.length % colors.length],
          x: 30 + (notes.length % 6) * 60, y: 30 + (notes.length % 4) * 50
        });
        save(); render();
      }));
      L.bar.appendChild(App.button('🗑️ Rensa alla', 'sm ghost', function () {
        App.confirm('Ta bort alla lappar?', 'Alla lappar raderas.', function () { notes = []; save(); render(); });
      }));
      render();
    }
  });

  /* ---------------- Storskärmstext ---------------- */
  App.register({
    id: 'bigtext', name: 'Storskärmstext', icon: '🔠', cat: 'Tavla',
    desc: 'Visa ett meddelande i jättestor text, t.ex. dagens uppgift.',
    keys: 'text meddelande stor rubrik',
    mount: function (root, App) {
      var L = App.layout(root, { center: true });
      var box = App.el('div', 'center-stack');
      var txt = App.el('div');
      txt.style.cssText = 'font-weight:800;text-align:center;line-height:1.1;padding:0 20px;';
      var value = App.Store.get('bigtext', 'Välkomna!');
      var size = App.Store.get('bigtextSize', 12);
      function paint() {
        txt.textContent = value;
        txt.style.fontSize = 'clamp(32px,' + size + 'vw, 400px)';
      }
      box.appendChild(txt);
      L.body.appendChild(box);

      var input = App.el('input');
      input.type = 'text';
      input.value = value;
      input.style.minWidth = '320px';
      input.addEventListener('input', function () {
        value = input.value; App.Store.set('bigtext', value); paint();
      });
      L.bar.appendChild(input);
      L.bar.appendChild(App.button('A−', 'sm ghost', function () {
        size = Math.max(4, size - 2); App.Store.set('bigtextSize', size); paint();
      }));
      L.bar.appendChild(App.button('A+', 'sm ghost', function () {
        size = Math.min(30, size + 2); App.Store.set('bigtextSize', size); paint();
      }));
      var blink = null;
      L.bar.appendChild(App.button('✨ Blinka', 'sm ghost', function () {
        if (blink) { App.stop(blink); blink = null; txt.style.opacity = 1; return; }
        blink = App.every(600, function () { txt.style.opacity = txt.style.opacity === '0.15' ? '1' : '0.15'; });
      }));
      paint();
    }
  });

  /* ---------------- Anteckningar ---------------- */
  App.register({
    id: 'notes', name: 'Anteckningar', icon: '📝', cat: 'Tavla',
    desc: 'Snabb text som sparas mellan lektionerna.',
    keys: 'anteckning text minnes',
    mount: function (root, App) {
      var L = App.layout(root);
      var ta = App.el('textarea');
      ta.style.cssText = 'width:100%;height:100%;min-height:60vh;font-size:22px;';
      ta.placeholder = 'Skriv anteckningar…';
      ta.value = App.Store.get('notes', '');
      ta.addEventListener('input', function () { App.Store.set('notes', ta.value); });
      L.body.appendChild(ta);
      L.bar.appendChild(App.el('div', 'muted', 'Sparas automatiskt'));
      L.bar.appendChild(App.button('🗑️ Rensa', 'sm ghost', function () {
        App.confirm('Rensa anteckningar?', 'Texten tas bort.', function () { ta.value = ''; App.Store.set('notes', ''); });
      }));
    }
  });

})(window.App);
