/* Tavla, lappar och text på storskärm */
(function (App) {
  'use strict';

  /* ---------------- Whiteboard ---------------- */
  App.register({
    id: 'board', name: 'Whiteboard', icon: '🖊️', cat: 'Tavla',
    desc: 'Rita och skriv med penna, överstrykning och sudd.',
    keys: 'rita penna tavla skriva sudd',
    mount: function (root) {
      var L = App.layout(root, { pad0: true });
      var wrap = App.el('div', 'board-wrap');
      var canvas = App.el('canvas');
      canvas.id = 'board-canvas';
      wrap.appendChild(canvas);
      L.body.appendChild(wrap);

      var ctx = canvas.getContext('2d');
      var state = { tool: 'pen', color: '#1c2333', size: 6, drawing: false, undo: [], bg: 'blank' };
      var self = this;

      function fit() {
        var snap = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
        var r = wrap.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(r.width));
        canvas.height = Math.max(1, Math.floor(r.height));
        paintBg();
        if (snap) { ctx.putImageData(snap, 0, 0); }
      }
      function paintBg() {
        ctx.save();
        ctx.fillStyle = getComputedStyle(wrap).backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (state.bg !== 'blank') {
          ctx.strokeStyle = 'rgba(128,140,170,.35)';
          ctx.lineWidth = 1;
          var step = 40, x, y;
          ctx.beginPath();
          if (state.bg === 'grid' || state.bg === 'lines') {
            for (y = step; y < canvas.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
          }
          if (state.bg === 'grid') {
            for (x = step; x < canvas.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
          }
          ctx.stroke();
          if (state.bg === 'dots') {
            ctx.fillStyle = 'rgba(128,140,170,.5)';
            for (y = step; y < canvas.height; y += step) {
              for (x = step; x < canvas.width; x += step) {
                ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
              }
            }
          }
        }
        ctx.restore();
      }
      function pushUndo() {
        try {
          state.undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (state.undo.length > 12) state.undo.shift();
        } catch (e) { /* stor canvas */ }
      }
      function pos(e) {
        var r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      function start(e) {
        e.preventDefault();
        pushUndo();
        state.drawing = true;
        var p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        stroke(e);
      }
      function stroke(e) {
        if (!state.drawing) return;
        e.preventDefault();
        var p = pos(e);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (state.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = state.size * 6;
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = state.tool === 'marker' ? 0.35 : 1;
          ctx.lineWidth = state.tool === 'marker' ? state.size * 4 : state.size;
          ctx.strokeStyle = state.color;
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      function end() { state.drawing = false; }

      canvas.addEventListener('pointerdown', start);
      canvas.addEventListener('pointermove', stroke);
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('pointerleave', end);

      /* Verktygsrad */
      ['#1c2333', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff'].forEach(function (c) {
        var s = App.el('button', 'swatch' + (c === state.color ? ' active' : ''));
        s.style.background = c;
        s.addEventListener('click', function () {
          state.color = c; state.tool = state.tool === 'eraser' ? 'pen' : state.tool;
          L.bar.querySelectorAll('.swatch').forEach(function (n) { n.classList.remove('active'); });
          s.classList.add('active');
          syncTools();
        });
        L.bar.appendChild(s);
      });

      var toolBtns = {};
      [['pen', '🖊️ Penna'], ['marker', '🖍️ Överstryk'], ['eraser', '🧽 Sudd']].forEach(function (t) {
        var b = App.button(t[1], 'sm ghost', function () { state.tool = t[0]; syncTools(); });
        toolBtns[t[0]] = b;
        L.bar.appendChild(b);
      });
      function syncTools() {
        Object.keys(toolBtns).forEach(function (k) {
          toolBtns[k].className = 'btn sm ' + (state.tool === k ? '' : 'ghost');
        });
      }
      syncTools();

      var size = App.el('input');
      size.type = 'range'; size.min = 2; size.max = 30; size.value = state.size;
      size.style.width = '130px';
      size.addEventListener('input', function () { state.size = parseInt(size.value, 10); });
      L.bar.appendChild(size);

      var bg = App.el('select');
      bg.innerHTML = '<option value="blank">Tom</option><option value="lines">Linjer</option>' +
        '<option value="grid">Rutnät</option><option value="dots">Punkter</option>';
      bg.addEventListener('change', function () {
        state.bg = bg.value;
        var snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
        paintBg();
        ctx.putImageData(snap, 0, 0);
        App.toast('Bakgrund ändras bakom befintlig ritning');
      });
      L.bar.appendChild(bg);

      L.bar.appendChild(App.button('↩️ Ångra', 'sm ghost', function () {
        var img = state.undo.pop();
        if (img) ctx.putImageData(img, 0, 0);
      }));
      L.bar.appendChild(App.button('🗑️ Rensa', 'sm ghost', function () {
        App.confirm('Rensa tavlan?', 'All ritning tas bort.', function () { pushUndo(); paintBg(); });
      }));
      L.bar.appendChild(App.button('💾 Spara', 'sm ghost', function () {
        App.saveImage(canvas, 'sandotavla-' + Date.now());
      }));

      setTimeout(fit, 0);
      this._fit = fit;
      window.addEventListener('resize', fit);
      this._cleanup = function () { window.removeEventListener('resize', self._fit); };
    },
    unmount: function () { if (this._cleanup) this._cleanup(); }
  });

  /* ---------------- Post-it lappar ---------------- */
  App.register({
    id: 'postit', name: 'Lappar', icon: '🗒️', cat: 'Tavla',
    desc: 'Digitala post-it-lappar att flytta runt på tavlan.',
    keys: 'postit lappar anteckning brainstorm',
    mount: function (root) {
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
    mount: function (root) {
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
    mount: function (root) {
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
