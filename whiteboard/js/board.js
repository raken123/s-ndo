/* Whiteboarden: tavlor, sidor, ritlager och komponenter som placeras på tavlan */
(function (global, App) {
  'use strict';

  /* Standardstorlek per komponent (bredd, höjd i pixlar) */
  var SIZES = {
    schedule: [560, 460], timer: [470, 470], stopwatch: [420, 420], clock: [420, 520],
    workblocks: [420, 460], groups: [660, 440], picker: [420, 420], wheel: [520, 560],
    dice: [520, 400], number: [420, 380], coin: [400, 440], seating: [640, 420],
    bingo: [700, 460], noise: [460, 540], traffic: [620, 340], worklevel: [520, 380],
    score: [560, 380], stars: [480, 460], poll: [620, 400], queue: [520, 460],
    attendance: [480, 480], counter: [400, 360], calc: [420, 560], math: [480, 440],
    quiz: [560, 420], breathe: [420, 480], brainbreak: [560, 340], prompt: [600, 340],
    postit: [520, 420], bigtext: [620, 340], notes: [480, 400], trams: [560, 560]
  };
  var DEFAULT_SIZE = [460, 400];

  var Board = {
    mounted: [],
    pen: { tool: 'pen', color: '#1c2333', size: 6 },
    drawing: null,
    view: 'board',

    /* ================= Start ================= */
    init: function () {
      var self = this;
      this.canvas = document.getElementById('page-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.layer = document.getElementById('widget-layer');
      this.surface = document.getElementById('board-surface');

      this.buildToolbar();
      this.bindDrawing();
      window.addEventListener('resize', function () { self.fit(); });
      document.getElementById('btn-boards').addEventListener('click', function () { self.showOverview(); });
      document.getElementById('btn-add').addEventListener('click', function () { self.showPalette(); });
      this.showBoard();
    },

    board: function () { return App.Boards.active(); },
    page: function () { return App.Boards.activePage(); },
    save: function () { App.Boards.all(); App.Boards.persist(); },

    /* ================= Vyer ================= */
    showBoard: function () {
      this.view = 'board';
      document.getElementById('overview').classList.add('hidden');
      document.getElementById('board-view').classList.remove('hidden');
      this.renderChrome();
      this.loadPage();
    },
    showOverview: function () {
      this.unmountAll();
      this.view = 'overview';
      document.getElementById('board-view').classList.add('hidden');
      var ov = document.getElementById('overview');
      ov.classList.remove('hidden');
      this.renderOverview();
    },
    handleBack: function () {
      if (this.maximized) { this.unmaximize(); return true; }
      if (this.view === 'overview') { this.showBoard(); return true; }
      return false;
    },

    /* ================= Topbar: tavla, sidor, pennor ================= */
    renderChrome: function () {
      var self = this;
      var b = this.board();
      document.getElementById('board-name').textContent = b.name;
      var tabs = document.getElementById('page-tabs');
      tabs.innerHTML = '';
      b.pages.forEach(function (p, i) {
        var t = App.el('button', 'page-tab' + (i === App.Boards.activePageIndex() ? ' active' : ''), p.name);
        t.addEventListener('click', function () {
          if (i === App.Boards.activePageIndex()) { self.renamePage(i); return; }
          self.unmountAll();
          App.Boards.setActivePage(i);
          self.renderChrome();
          self.loadPage();
        });
        tabs.appendChild(t);
      });
      var add = App.el('button', 'page-tab add', '＋');
      add.title = 'Ny sida';
      add.addEventListener('click', function () { self.addPage(); });
      tabs.appendChild(add);
    },
    buildToolbar: function () {
      var self = this;
      var bar = document.getElementById('pen-bar');
      bar.innerHTML = '';
      ['#1c2333', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ffffff'].forEach(function (c) {
        var s = App.el('button', 'swatch' + (c === self.pen.color ? ' active' : ''));
        s.style.background = c;
        s.addEventListener('click', function () {
          self.pen.color = c;
          if (self.pen.tool === 'eraser') self.pen.tool = 'pen';
          bar.querySelectorAll('.swatch').forEach(function (n) { n.classList.remove('active'); });
          s.classList.add('active');
          self.syncPen();
        });
        bar.appendChild(s);
      });
      this.penBtns = {};
      [['pen', '🖊️'], ['marker', '🖍️'], ['eraser', '🧽']].forEach(function (t) {
        var b = App.button(t[1], 'sm ghost', function () { self.pen.tool = t[0]; self.syncPen(); });
        b.title = t[0];
        self.penBtns[t[0]] = b;
        bar.appendChild(b);
      });
      var size = App.el('input');
      size.type = 'range'; size.min = 2; size.max = 30; size.value = this.pen.size;
      size.style.width = '110px';
      size.addEventListener('input', function () { self.pen.size = parseInt(size.value, 10); });
      bar.appendChild(size);

      var bg = App.el('select');
      bg.id = 'page-bg';
      bg.innerHTML = '<option value="blank">Tom</option><option value="lines">Linjer</option>' +
        '<option value="grid">Rutnät</option><option value="dots">Punkter</option>';
      bg.addEventListener('change', function () {
        self.page().bg = bg.value; self.save(); self.redraw();
      });
      bar.appendChild(bg);

      bar.appendChild(App.button('↩️', 'sm ghost', function () {
        var p = self.page();
        if (p.strokes.length) { p.strokes.pop(); self.save(); self.redraw(); }
      })).title = 'Ångra';
      bar.appendChild(App.button('🗑️', 'sm ghost', function () {
        App.confirm('Rensa ritningen?', 'Pennstrecken på den här sidan tas bort. Komponenterna blir kvar.', function () {
          self.page().strokes = []; self.save(); self.redraw();
        });
      })).title = 'Rensa ritning';
      bar.appendChild(App.button('💾', 'sm ghost', function () {
        self.exportPage();
      })).title = 'Spara sidan som bild';
      this.syncPen();
    },
    syncPen: function () {
      var self = this;
      Object.keys(this.penBtns).forEach(function (k) {
        self.penBtns[k].className = 'btn sm ' + (self.pen.tool === k ? '' : 'ghost');
      });
    },

    /* ================= Tavlor och sidor ================= */
    addPage: function () {
      var b = this.board();
      b.pages.push(App.Boards.blankPage('Sida ' + (b.pages.length + 1)));
      this.save();
      this.unmountAll();
      App.Boards.setActivePage(b.pages.length - 1);
      this.renderChrome();
      this.loadPage();
      App.toast('Ny sida');
    },
    renamePage: function (i) {
      var self = this;
      var b = this.board();
      var box = App.el('div', 'col');
      var inp = App.el('input'); inp.type = 'text'; inp.value = b.pages[i].name;
      box.appendChild(inp);
      var del = App.button('🗑️ Ta bort sidan', 'sm ghost', function () {
        if (b.pages.length <= 1) { App.toast('Tavlan måste ha minst en sida'); return; }
        App.hideModal();
        App.confirm('Ta bort sidan?', 'Ritning och komponenter på sidan raderas.', function () {
          self.unmountAll();
          b.pages.splice(i, 1);
          self.save();
          App.Boards.setActivePage(0);
          self.renderChrome();
          self.loadPage();
        });
      });
      box.appendChild(del);
      App.modal('Sidans namn', box, function () {
        b.pages[i].name = inp.value.trim() || b.pages[i].name;
        self.save(); self.renderChrome();
      }, 'Spara');
    },
    newBoard: function () {
      var self = this;
      var inp = App.el('input'); inp.type = 'text'; inp.placeholder = 'Namn på tavlan';
      App.modal('Ny whiteboard', inp, function () {
        var boards = App.Boards.all();
        var b = App.Boards.blank(inp.value.trim() || 'Tavla ' + (boards.length + 1));
        boards.push(b);
        App.Boards.save(boards);
        App.Boards.setActive(b.id);
        App.Boards.setActivePage(0);
        self.showBoard();
        App.toast('Tavlan "' + b.name + '" skapad');
      }, 'Skapa');
    },
    renderOverview: function () {
      var self = this;
      var grid = document.getElementById('board-grid');
      var boards = App.Boards.all();
      grid.innerHTML = '';
      boards.forEach(function (b) {
        var widgets = b.pages.reduce(function (a, p) { return a + p.widgets.length; }, 0);
        var strokes = b.pages.reduce(function (a, p) { return a + p.strokes.length; }, 0);
        var card = App.el('div', 'board-card' + (b.id === App.Boards.activeId() ? ' active' : ''));
        card.innerHTML = '<div class="bc-name">' + App.esc(b.name) + '</div>' +
          '<div class="muted">' + b.pages.length + ' sidor · ' + widgets + ' komponenter · ' + strokes + ' penndrag</div>';
        var openBtn = App.button('📂 Öppna', 'sm', function () {
          App.Boards.setActive(b.id);
          self.showBoard();
        });
        var row = App.el('div', 'row');
        row.appendChild(openBtn);
        row.appendChild(App.button('✏️', 'sm ghost', function () {
          var inp = App.el('input'); inp.type = 'text'; inp.value = b.name;
          App.modal('Byt namn på tavlan', inp, function () {
            b.name = inp.value.trim() || b.name;
            self.save(); self.renderOverview();
          }, 'Spara');
        }));
        row.appendChild(App.button('⧉', 'sm ghost', function () {
          var copy = JSON.parse(JSON.stringify(b));
          copy.id = App.Boards.blank().id;
          copy.name = b.name + ' (kopia)';
          copy.pages.forEach(function (p) {
            p.id = App.Boards.blankPage().id;
            p.widgets.forEach(function (w) { w.id = 'w' + Math.random().toString(36).slice(2, 10); });
          });
          var list = App.Boards.all();
          list.push(copy);
          App.Boards.save(list);
          self.renderOverview();
          App.toast('Tavlan kopierad');
        })).title = 'Duplicera';
        row.appendChild(App.button('🗑️', 'sm ghost', function () {
          var list = App.Boards.all();
          if (list.length <= 1) { App.toast('Minst en tavla måste finnas'); return; }
          App.confirm('Ta bort tavlan?', '"' + b.name + '" med alla sidor raderas.', function () {
            var idx = list.map(function (x) { return x.id; }).indexOf(b.id);
            list[idx].pages.forEach(function (p) {
              p.widgets.forEach(function (w) { App.dropWidgetData(w.id); });
            });
            list.splice(idx, 1);
            App.Boards.save(list);
            App.Boards.setActive(list[0].id);
            self.renderOverview();
          });
        }));
        card.appendChild(row);
        grid.appendChild(card);
      });
      var add = App.el('button', 'board-card new');
      add.innerHTML = '<div style="font-size:44px">➕</div><div class="bc-name">Ny whiteboard</div>' +
        '<div class="muted">Skapa hur många du vill</div>';
      add.addEventListener('click', function () { self.newBoard(); });
      grid.appendChild(add);
    },

    /* ================= Ritlager ================= */
    fit: function () {
      var r = this.surface.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(r.width));
      this.canvas.height = Math.max(1, Math.floor(r.height));
      this.redraw();
    },
    redraw: function () {
      if (!this.ctx) return;
      var c = this.ctx, cv = this.canvas, p = this.page();
      c.clearRect(0, 0, cv.width, cv.height);
      var cs = getComputedStyle(this.surface);
      c.fillStyle = cs.backgroundColor;
      c.fillRect(0, 0, cv.width, cv.height);
      this.paintBg(p.bg || 'blank');
      var self = this;
      (p.strokes || []).forEach(function (s) { self.drawStroke(s); });
      var sel = document.getElementById('page-bg');
      if (sel) sel.value = p.bg || 'blank';
    },
    paintBg: function (kind) {
      if (kind === 'blank') return;
      var c = this.ctx, cv = this.canvas, step = 40, x, y;
      c.save();
      c.strokeStyle = 'rgba(128,140,170,.35)';
      c.lineWidth = 1;
      c.beginPath();
      if (kind === 'grid' || kind === 'lines') {
        for (y = step; y < cv.height; y += step) { c.moveTo(0, y); c.lineTo(cv.width, y); }
      }
      if (kind === 'grid') {
        for (x = step; x < cv.width; x += step) { c.moveTo(x, 0); c.lineTo(x, cv.height); }
      }
      c.stroke();
      if (kind === 'dots') {
        c.fillStyle = 'rgba(128,140,170,.55)';
        for (y = step; y < cv.height; y += step) {
          for (x = step; x < cv.width; x += step) {
            c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill();
          }
        }
      }
      c.restore();
    },
    drawStroke: function (s) {
      var c = this.ctx;
      if (!s.pts || s.pts.length < 2) return;
      c.save();
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (s.t === 'eraser') {
        c.globalCompositeOperation = 'destination-out';
        c.lineWidth = s.w * 6;
        c.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        c.globalAlpha = s.t === 'marker' ? 0.35 : 1;
        c.lineWidth = s.t === 'marker' ? s.w * 4 : s.w;
        c.strokeStyle = s.c;
      }
      c.beginPath();
      c.moveTo(s.pts[0][0], s.pts[0][1]);
      for (var i = 1; i < s.pts.length; i++) { c.lineTo(s.pts[i][0], s.pts[i][1]); }
      c.stroke();
      c.restore();
    },
    bindDrawing: function () {
      var self = this;
      var cv = this.canvas;
      function pos(e) {
        var r = cv.getBoundingClientRect();
        return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
      }
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        self.drawing = { t: self.pen.tool, c: self.pen.color, w: self.pen.size, pts: [pos(e)] };
      });
      cv.addEventListener('pointermove', function (e) {
        if (!self.drawing) return;
        e.preventDefault();
        self.drawing.pts.push(pos(e));
        self.ctx.save();
        self.drawStroke({ t: self.drawing.t, c: self.drawing.c, w: self.drawing.w, pts: self.drawing.pts.slice(-2) });
        self.ctx.restore();
      });
      function end() {
        if (!self.drawing) return;
        if (self.drawing.pts.length > 1) {
          var p = self.page();
          p.strokes.push(self.drawing);
          if (p.strokes.length > 600) p.strokes.shift();
          self.save();
        }
        self.drawing = null;
      }
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', end);
    },
    exportPage: function () {
      var out = document.createElement('canvas');
      out.width = this.canvas.width;
      out.height = this.canvas.height;
      var c = out.getContext('2d');
      c.fillStyle = getComputedStyle(this.surface).backgroundColor;
      c.fillRect(0, 0, out.width, out.height);
      c.drawImage(this.canvas, 0, 0);
      App.saveImage(out, 'tavla-' + this.board().name.replace(/\W+/g, '-').toLowerCase() + '-' + Date.now());
    },

    /* ================= Komponenter ================= */
    showPalette: function () {
      var self = this;
      var box = App.el('div', 'palette');
      var cats = [];
      App.tools.forEach(function (t) { if (t.cat !== 'System' && cats.indexOf(t.cat) < 0) cats.push(t.cat); });
      cats.forEach(function (cat) {
        box.appendChild(App.el('div', 'palette-cat', cat));
        var g = App.el('div', 'palette-grid');
        App.tools.filter(function (t) { return t.cat === cat; }).forEach(function (t) {
          var card = App.el('button', 'palette-card');
          card.innerHTML = '<div class="ic">' + t.icon + '</div><div class="nm">' + App.esc(t.name) + '</div>' +
            '<div class="ds">' + App.esc(t.desc || '') + '</div>';
          card.addEventListener('click', function () {
            App.hideModal();
            self.addWidget(t.id);
          });
          g.appendChild(card);
        });
        box.appendChild(g);
      });
      App.modal('➕ Lägg till komponent på sidan', box, null, 'Stäng');
    },
    addWidget: function (toolId) {
      var size = SIZES[toolId] || DEFAULT_SIZE;
      var p = this.page();
      var n = p.widgets.length;
      var w = {
        id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        tool: toolId,
        x: 40 + (n % 5) * 40,
        y: 40 + (n % 4) * 40,
        w: size[0],
        h: size[1]
      };
      p.widgets.push(w);
      this.save();
      this.mountWidget(w);
      App.toast(App.byId(toolId).name + ' tillagd');
    },
    loadPage: function () {
      var self = this;
      this.unmountAll();
      this.layer.innerHTML = '';
      setTimeout(function () {
        self.fit();
        (self.page().widgets || []).forEach(function (w) { self.mountWidget(w); });
      }, 0);
    },
    unmountAll: function () {
      this.mounted.forEach(function (m) {
        if (typeof m.tool.unmount === 'function') { try { m.tool.unmount(m.ctx); } catch (e) { /* noop */ } }
        m.ctx.clearTimers();
      });
      this.mounted = [];
      if (this.layer) this.layer.innerHTML = '';
    },
    mountWidget: function (w) {
      var self = this;
      var tool = App.byId(w.tool);
      if (!tool) return;
      var box = App.el('div', 'widget');
      box.style.left = w.x + 'px';
      box.style.top = w.y + 'px';
      box.style.width = w.w + 'px';
      box.style.height = w.h + 'px';
      box.dataset.id = w.id;

      var head = App.el('div', 'widget-head');
      head.appendChild(App.el('div', 'wh-title', tool.icon + ' ' + tool.name));
      var actions = App.el('div', 'wh-actions');
      var maxBtn = App.el('button', 'wh-btn', '⛶');
      maxBtn.title = 'Maximera';
      maxBtn.addEventListener('click', function () { self.toggleMax(box); });
      var delBtn = App.el('button', 'wh-btn', '✕');
      delBtn.title = 'Ta bort';
      delBtn.addEventListener('click', function () {
        App.confirm('Ta bort komponenten?', tool.name + ' tas bort från sidan.', function () {
          self.removeWidget(w.id);
        });
      });
      actions.appendChild(maxBtn);
      actions.appendChild(delBtn);
      head.appendChild(actions);
      box.appendChild(head);

      var body = App.el('div', 'widget-body');
      box.appendChild(body);
      var grip = App.el('div', 'widget-grip');
      box.appendChild(grip);
      this.layer.appendChild(box);

      var ctx = App.makeCtx(w.id);
      ctx.widget = w;
      try {
        tool.mount(body, ctx);
      } catch (err) {
        body.innerHTML = '<div class="tool-body"><div class="card">Kunde inte starta: ' +
          App.esc(String(err && err.message || err)) + '</div></div>';
      }
      this.mounted.push({ w: w, tool: tool, ctx: ctx, box: box });

      /* Flytta */
      var drag = null;
      head.addEventListener('pointerdown', function (e) {
        if (e.target.classList.contains('wh-btn')) return;
        drag = { dx: e.clientX - w.x, dy: e.clientY - w.y };
        head.setPointerCapture(e.pointerId);
        box.classList.add('dragging');
      });
      head.addEventListener('pointermove', function (e) {
        if (!drag) return;
        w.x = Math.max(0, e.clientX - drag.dx);
        w.y = Math.max(0, e.clientY - drag.dy);
        box.style.left = w.x + 'px';
        box.style.top = w.y + 'px';
      });
      head.addEventListener('pointerup', function () {
        if (!drag) return;
        drag = null;
        box.classList.remove('dragging');
        self.save();
      });

      /* Ändra storlek */
      var rs = null;
      grip.addEventListener('pointerdown', function (e) {
        rs = { x: e.clientX, y: e.clientY, w: w.w, h: w.h };
        grip.setPointerCapture(e.pointerId);
        e.stopPropagation();
      });
      grip.addEventListener('pointermove', function (e) {
        if (!rs) return;
        w.w = Math.max(240, rs.w + (e.clientX - rs.x));
        w.h = Math.max(200, rs.h + (e.clientY - rs.y));
        box.style.width = w.w + 'px';
        box.style.height = w.h + 'px';
      });
      grip.addEventListener('pointerup', function () {
        if (!rs) return;
        rs = null;
        self.save();
      });
    },
    removeWidget: function (id) {
      var p = this.page();
      var idx = p.widgets.map(function (x) { return x.id; }).indexOf(id);
      if (idx < 0) return;
      var m = this.mounted.filter(function (x) { return x.w.id === id; })[0];
      if (m) {
        if (typeof m.tool.unmount === 'function') { try { m.tool.unmount(m.ctx); } catch (e) { /* noop */ } }
        m.ctx.clearTimers();
        if (m.box.parentNode) m.box.parentNode.removeChild(m.box);
        this.mounted = this.mounted.filter(function (x) { return x !== m; });
      }
      p.widgets.splice(idx, 1);
      App.dropWidgetData(id);
      this.save();
    },
    toggleMax: function (box) {
      if (box.classList.contains('max')) { this.unmaximize(); return; }
      if (this.maximized) this.unmaximize();
      box.classList.add('max');
      this.maximized = box;
    },
    unmaximize: function () {
      if (!this.maximized) return;
      this.maximized.classList.remove('max');
      this.maximized = null;
    }
  };

  global.Board = Board;
})(window, window.App);
