/* gmfy — app shell: auth, build, blocks, play, games, class, plan. */
(function () {
  'use strict';

  var el = function (id) { return document.getElementById(id); };
  var engine, maker, blocks, game, held = null, last = 0, started = false;
  var curGame = null, catFilter = 'events';

  /* ---------------- auth ---------------- */
  var mode = 'signup';

  function paintAuth() {
    var up = (mode === 'signup');
    el('a-go').textContent = up ? 'Create account' : 'Sign in';
    el('a-swap').innerHTML = up ? 'Already have an account? <b>Sign in</b>'
                                : 'New here? <b>Create an account</b>';
    el('a-err').textContent = '';
  }

  function wireAuth() {
    paintAuth();
    el('a-swap').addEventListener('click', function () {
      mode = (mode === 'signup') ? 'signin' : 'signup';
      paintAuth();
    });
    el('a-go').addEventListener('click', submit);
    el('a-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    function submit() {
      el('a-go').disabled = true;
      el('a-err').textContent = '';
      var op = (mode === 'signup') ? window.GmfyAuth.signUp : window.GmfyAuth.signIn;
      op(el('a-mail').value, el('a-pass').value).then(function (res) {
        el('a-go').disabled = false;
        if (!res.ok) { el('a-err').textContent = res.error; return; }
        el('a-pass').value = '';
        enterApp();
      });
    }
  }

  function enterApp() {
    var u = window.GmfyAuth.current();
    el('home').classList.remove('on');
    el('auth').classList.add('hide');
    el('app').classList.add('on');
    el('who').textContent = u ? u.email : '';
    window.GmfyGuard.check();                       // re-check ban status on entering app
    if (!started) { startApp(); started = true; }
    else { engine.resize(); refreshAll(); }
  }

  function leaveApp() {
    window.GmfyAuth.signOut();
    curGame = null;
    el('app').classList.remove('on');
    el('auth').classList.remove('hide');
    mode = 'signin';
    paintAuth();
  }

  /* ---------------- boot ---------------- */
  function startApp() {
    var canvas = el('c');
    engine = new window.Gmfy.Engine(canvas);
    window.GmfyFX.install();
    maker  = new window.GmfyMaker(engine, refreshHud);
    game   = new window.GmfyGame(engine, onGameEvent);
    blocks = new window.GmfyBlocks(engine, game, paintScript);

    maker.enter();
    if (!maker.load(true)) maker.blank();

    // start with the viewport filling the screen; Tools folds the sheet back in
    el('app').classList.add('big');
    wireTools();
    wirePromos();
    wireStage(canvas);
    wireTabs();
    wireBuild();
    wireWorld();
    wireBlocks();
    wireGames();
    wireClass();
    wirePlan();
    wireExport();
    wireFX();
    refreshAll();

    window.addEventListener('resize', function () { engine.resize(); });
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function wirePromos() {
    if (window.GmfyVideoAds) window.GmfyVideoAds.wire();
    if (window.GmfyPromos) window.GmfyPromos.start();
    var r = el('ad-remove');
    if (r) r.addEventListener('click', function () {
      // send them to the Plan tab to upgrade (which removes ads)
      if (el('app').classList.contains('big')) { el('app').classList.remove('big');
        el('tools-toggle').textContent = 'Hide tools'; setTimeout(function () { engine.resize(); }, 30); }
      var plan = document.querySelector('.tab[data-pane="plan"]');
      if (plan) plan.click();
    });
  }

  function wireTools() {
    var t = el('tools-toggle');
    if (!t) return;
    t.addEventListener('click', function () {
      var big = el('app').classList.toggle('big');
      t.textContent = big ? 'Tools' : 'Hide tools';
      // the stage just changed size — let the renderer catch up
      setTimeout(function () { engine.resize(); }, 30);
    });
  }

  function refreshAll() {
    buildPickers();
    paintScript();
    paintGames();
    paintClass();
    paintPlan();
    refreshHud();
    if (el('x-thumb') && !iconImg) el('x-thumb').textContent = 'g';
  }

  function refreshHud() {
    var w = engine.world;
    el('h-biome').textContent = w.biome.name;
    el('h-objs').textContent = String(w.props.length);
  }

  function onGameEvent(ev) {
    if (blocks && blocks.running) blocks.fire(ev);
    if (ev === 'coin') window.GmfyBlocks.beep('coin');
    if (ev === 'win')  window.GmfyBlocks.beep('win');
    if (ev === 'die')  window.GmfyBlocks.beep('buzz');
  }

  /* ---------------- stage ---------------- */
  function wireStage(canvas) {
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t0:Date.now(), moved:0 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y);
      engine.cam.yaw -= (e.clientX - drag.x) * 0.006;
      engine.cam.pitch = Math.max(-0.15, Math.min(0.75,
        engine.cam.pitch + (e.clientY - drag.y) * 0.0035));
      drag.x = e.clientX; drag.y = e.clientY;
    });
    canvas.addEventListener('pointerup', function () {
      if (drag && !game.playing && drag.moved < 10 && Date.now() - drag.t0 < 500) {
        var r = canvas.getBoundingClientRect();
        if (maker.tool === 'raise' || maker.tool === 'lower') {
          var g = engine.pick(drag.x0 - r.left, drag.y0 - r.top);
          if (g) {
            window.GmfyFX.sculpt(engine.world, g.x, g.z, 5,
                                 maker.tool === 'raise' ? 1.1 : -1.1);
            refreshHud();
          }
        } else {
          maker.tap(drag.x0 - r.left, drag.y0 - r.top);
        }
      }
      drag = null;
    });
    canvas.addEventListener('pointercancel', function () { drag = null; });

    Array.prototype.forEach.call(document.querySelectorAll('#pad button'), function (b) {
      var k = b.getAttribute('data-k');
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); held = k; });
      ['pointerup','pointerleave','pointercancel'].forEach(function (ev) {
        b.addEventListener(ev, function () { if (held === k) held = null; });
      });
    });
    el('out').addEventListener('click', leaveApp);
  }

  function wireTabs() {
    var tabs = document.querySelectorAll('.tab');
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        var want = t.getAttribute('data-pane');
        ['build','code','world','games','class','plan','export'].forEach(function (p) {
          el('pane-' + p).classList.toggle('on', p === want);
        });
        maker.tool = (want === 'build') ? (maker.tool === 'look' ? 'place' : maker.tool) : 'look';
      });
    });
  }

  /* ---------------- build ---------------- */
  function buildPickers() {
    var kinds = el('mk-kinds');
    kinds.innerHTML = '';
    window.Gmfy.PROP_KINDS.forEach(function (k) {
      var kd = window.Gmfy.KIND[k];
      var b = document.createElement('button');
      b.className = 'bi' + (k === maker.kind ? ' on' : '');
      b.textContent = kd.label;
      b.addEventListener('click', function () {
        maker.kind = k;
        maker.col = kd.col;
        Array.prototype.forEach.call(kinds.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        paintSwatches();
      });
      kinds.appendChild(b);
    });

    var bio = el('mk-biomes');
    bio.innerHTML = '';
    Object.keys(window.Gmfy.BIOMES).forEach(function (key) {
      var b = document.createElement('button');
      b.className = 'bi' + (key === engine.world.biomeKey ? ' on' : '');
      b.textContent = window.Gmfy.BIOMES[key].name;
      b.addEventListener('click', function () {
        maker.setBiome(key);
        Array.prototype.forEach.call(bio.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        paintSwatches();
      });
      bio.appendChild(b);
    });
    paintSwatches();
  }

  function paintSwatches() {
    var cols = el('mk-cols');
    cols.innerHTML = '';
    var kd = window.Gmfy.KIND[maker.kind];
    var pal = [kd.col].concat(maker.palette.filter(function (c) { return c !== kd.col; }));
    pal.slice(0, 6).forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'sw' + (c === maker.col ? ' on' : '');
      b.style.background = c;
      b.addEventListener('click', function () {
        maker.col = c;
        Array.prototype.forEach.call(cols.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      cols.appendChild(b);
    });
  }

  function wireBuild() {
    var tools = el('mk-tools');
    Array.prototype.forEach.call(tools.children, function (b) {
      b.addEventListener('click', function () {
        maker.tool = b.getAttribute('data-tool');
        Array.prototype.forEach.call(tools.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
    });
    el('mk-size').addEventListener('input', function () { maker.size = this.value / 100; });
    el('mk-undo').addEventListener('click', function () { maker.undo(); });
    el('mk-clear').addEventListener('click', function () { maker.clear(); });
  }

  function wireFX() {
    var FX = window.GmfyFX.state;

    var box = el('w-weather');
    box.innerHTML = '';
    ['clear', 'rain', 'snow', 'fog'].forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'bi' + (k === FX.weather ? ' on' : '');
      b.textContent = k;
      b.addEventListener('click', function () {
        FX.weather = k;
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      box.appendChild(b);
    });

    el('w-time').addEventListener('input', function () {
      FX.time = this.value / 100;
      el('w-tod').textContent = window.GmfyFX.label(FX.time);
    });
    el('w-wind').addEventListener('input', function () { FX.wind = +this.value; });

    el('b-photo').addEventListener('click', function () {
      var nm = curGame ? window.GmfyPlans.get(curGame).name : 'gmfy-world';
      var ok = window.GmfyFX.photo(engine, window.GmfyExport.slug(nm));
      el('w-hint').textContent = ok ? 'photo saved' : 'photo blocked by the browser';
    });
    el('b-ghost').addEventListener('click', function () {
      FX.showGhost = !FX.showGhost;
      this.classList.toggle('on', FX.showGhost);
    });
  }

  function wireWorld() {
    el('mk-relief').addEventListener('input', function () { maker.setRelief(this.value / 10); });
    el('mk-new').addEventListener('click', function () {
      maker.blank(engine.world.biomeKey); buildPickers();
      el('w-hint').textContent = 'fresh world ready';
    });
    el('mk-save').addEventListener('click', saveCurrent);
    el('mk-load').addEventListener('click', function () {
      var ok = maker.load();
      if (ok) buildPickers();
      el('w-hint').textContent = ok ? 'world loaded' : 'nothing saved yet';
    });
  }

  function saveCurrent() {
    maker.save();
    if (curGame) {
      window.GmfyPlans.save(curGame, {
        biomeKey: engine.world.biomeKey, relief: maker.relief, props: engine.world.props
      }, blocks.script);
      el('w-hint').textContent = 'saved to "' + (window.GmfyPlans.get(curGame) || {}).name + '"';
      paintGames();
    } else {
      el('w-hint').textContent = 'world saved to this device';
    }
  }

  /* ---------------- blocks ---------------- */
  function blockEl(def, b, i, inScript) {
    var btn = document.createElement('button');
    var col = window.GmfyBlocks.CATS[def.cat].col;
    btn.className = 'blk' + (def.hat ? ' hat' : '');
    btn.style.background = col;
    if (inScript) btn.style.marginLeft = (blocks.indentOf(i) * 12) + 'px';

    var span = document.createElement('span');
    span.textContent = def.label;
    btn.appendChild(span);

    if (def.arg || def.opt) {
      var v = document.createElement('span');
      v.className = 'v';
      v.textContent = def.arg
        ? ((b && b.val !== undefined ? b.val : def.arg.val) + (def.arg.unit || ''))
        : window.GmfyBlocks.optLabel(def.opt, (b && b.opt) || def.val);
      btn.appendChild(v);
      if (inScript) v.addEventListener('click', function (e) { e.stopPropagation(); blocks.bump(i); });
    }
    if (!def.hat) {
      var nub = document.createElement('span');
      nub.className = 'nub';
      nub.style.background = col;
      btn.appendChild(nub);
    }
    return btn;
  }

  function wireBlocks() {
    var cats = el('bl-cats');
    Object.keys(window.GmfyBlocks.CATS).forEach(function (key) {
      var c = window.GmfyBlocks.CATS[key];
      var b = document.createElement('button');
      b.className = 'cat' + (key === catFilter ? ' on' : '');
      b.style.background = c.col;
      b.textContent = c.name;
      b.addEventListener('click', function () {
        catFilter = key;
        Array.prototype.forEach.call(cats.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        paintPalette();
      });
      cats.appendChild(b);
    });
    paintPalette();

    el('bl-clear').addEventListener('click', function () { blocks.clear(); });
    el('b-run').addEventListener('click', function () {
      blocks.run();
      el('b-run').hidden = true; el('b-stop').hidden = false;
    });
    el('b-stop').addEventListener('click', function () {
      blocks.stop(); game.stop();
      el('b-run').hidden = false; el('b-stop').hidden = true;
    });
    el('b-play').addEventListener('click', function () {
      // free tier watches a full-screen video ad first; paid plans play at once
      var go = function () {
        game.start();
        blocks.run();
        el('b-run').hidden = true; el('b-stop').hidden = false;
      };
      if (window.GmfyVideoAds) window.GmfyVideoAds.beforePlay(go);
      else go();
    });
  }

  function paintPalette() {
    var pal = el('bl-palette');
    pal.innerHTML = '';
    window.GmfyBlocks.DEFS.forEach(function (d) {
      if (d.cat !== catFilter) return;
      var b = blockEl(d, null, -1, false);
      b.addEventListener('click', function () { blocks.add(d.id); });
      pal.appendChild(b);
    });
  }

  function paintScript() {
    var s = el('bl-script');
    if (!s) return;
    s.innerHTML = '';
    blocks.script.forEach(function (b, i) {
      var d = window.GmfyBlocks.defOf(b.id);
      if (!d) return;
      var node = blockEl(d, b, i, true);
      if (i > 0) node.addEventListener('click', function () { blocks.removeAt(i); });
      s.appendChild(node);
    });
    if (blocks.script.length === 1) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Pick a category, tap blocks to add them, then Run.';
      s.appendChild(e);
    }
    if (!blocks.running) { el('b-run').hidden = false; el('b-stop').hidden = true; }
    refreshHud();
  }

  /* ---------------- games ---------------- */
  function wireGames() {
    el('g-import').addEventListener('click', function () {
      var res = window.GmfyPlans.importShare(el('g-code').value);
      if (!res.ok) { el('g-hint').textContent = res.error; return; }
      el('g-code').value = '';
      el('g-hint').textContent = 'added "' + res.name + '" to your games';
      openGame(res.id);
    });
    el('g-new').addEventListener('click', function () {
      var P = window.GmfyPlans;
      if (!P.canCreate()) {
        el('g-hint').textContent = 'You have used all ' + P.current().limit +
          ' games on ' + P.current().name + ' — upgrade in the Plan tab.';
        return;
      }
      var res = P.create(el('g-name').value.trim(), {
        biomeKey: engine.world.biomeKey, relief: maker.relief, props: engine.world.props
      });
      if (!res.ok) { el('g-hint').textContent = 'Could not create that game.'; return; }
      el('g-name').value = '';
      curGame = res.id;
      P.save(curGame, { biomeKey: engine.world.biomeKey, relief: maker.relief,
                        props: engine.world.props }, blocks.script);
      el('g-hint').textContent = 'created — this is now your open game';
      paintGames();
    });
  }

  function paintGames() {
    var P = window.GmfyPlans, list = P.games(), box = el('g-list');
    var rem = P.remaining();
    var sl = P.shareLimit(), sLeft = P.sharesLeft();
    el('q-line').innerHTML = 'Plan <b>' + P.current().name + '</b> &middot; ' +
      list.length + ' of ' + (P.current().limit === Infinity ? '∞' : P.current().limit) +
      ' games' + (rem === Infinity ? '' : ' &middot; <b>' + rem + '</b> left') +
      ' &middot; shared ' + P.myShares().length + '/' + (sl === Infinity ? '∞' : sl);
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="empty">No games yet — name one and hit Create.</div>';
      return;
    }
    list.forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'grow' + (g.id === curGame ? ' on' : '');
      var nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = g.name;
      row.appendChild(nm);

      var open = document.createElement('button');
      open.textContent = (g.id === curGame) ? 'open' : 'Open';
      open.addEventListener('click', function () { openGame(g.id); });
      row.appendChild(open);

      var code = P.shareOf(g.id);
      if (code) {
        var chip = document.createElement('span');
        chip.className = 'sc';
        chip.textContent = code;
        row.appendChild(chip);
      }

      var sh = document.createElement('button');
      sh.className = code ? 'shared' : '';
      sh.textContent = code ? 'Unshare' : 'Share';
      sh.addEventListener('click', function () {
        if (code) {
          P.unshare(code);
          el('g-hint').textContent = 'stopped sharing "' + g.name + '"';
        } else {
          var res = P.share(g.id);
          el('g-hint').textContent = res.ok
            ? 'share code for "' + g.name + '": ' + res.code
            : res.error;
        }
        paintGames();
      });
      row.appendChild(sh);

      var del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', function () {
        P.remove(g.id);
        if (curGame === g.id) curGame = null;
        paintGames();
      });
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  function openGame(id) {
    var g = window.GmfyPlans.get(id);
    if (!g) return;
    curGame = id;
    if (g.world) {
      var w = window.Gmfy.worldFromSpec(
        { biome: g.world.biomeKey, props: g.world.props, relief: g.world.relief }, 'maker');
      w.source = 'maker';
      maker.relief = g.world.relief || 1;
      engine.load(w);
      maker.syncPalette();
    }
    if (g.script && g.script.length) blocks.script = g.script;
    buildPickers();
    paintScript();
    paintGames();
    el('g-hint').textContent = 'opened "' + g.name + '"';
  }

  /* ---------------- class ---------------- */
  function wireClass() {
    el('c-join').addEventListener('click', function () {
      var res = window.GmfyPlans.joinClass(el('c-code').value);
      el('c-hint').textContent = res.ok ? 'joined ' + res.room.name : res.error;
      paintClass();
    });
    el('c-make').addEventListener('click', function () {
      var code = window.GmfyPlans.createClass(el('c-name').value.trim());
      el('c-hint').textContent = 'class created — share code ' + code;
      paintClass();
    });
    el('c-leave').addEventListener('click', function () {
      window.GmfyPlans.leaveClass();
      paintClass();
    });
  }

  function paintClass() {
    var c = window.GmfyPlans.myClass();
    el('c-none').hidden = !!c;
    el('c-in').hidden = !c;
    if (!c) return;
    el('c-title').textContent = c.room.name;
    el('c-role').textContent = (c.role === 'teacher')
      ? 'You are the teacher. Share this code:' : 'You joined with this code:';
    el('c-show').textContent = c.code;
    el('c-members').innerHTML = '<b>' + c.room.members.length + '</b> student' +
      (c.room.members.length === 1 ? '' : 's') + ' joined on this device';
  }

  /* ---------------- plan ---------------- */
  function wirePlan() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-plan]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-plan');
        if (id === window.GmfyPlans.current().id) return;   // already on it
        if (id === 'free') { activatePlan('free'); return; } // free needs no card
        openCheckout(id);
      });
    });
    wireCheckout();
    wireInvites();
  }

  function activatePlan(id) {
    window.GmfyPlans.setPlan(id);
    paintPlan();
    paintGames();
  }

  /* ---- checkout sheet ---- */
  var payPlan = null;

  function openCheckout(id) {
    payPlan = id;
    el('pay-plan').textContent = id.toUpperCase();
    el('pay-amt').textContent = window.GmfyPay.price(id) + ' · card is validated, not charged';
    ['pay-name', 'pay-num', 'pay-exp', 'pay-cvv'].forEach(function (f) {
      el(f).value = ''; el(f).classList.remove('bad');
    });
    el('pay-err').textContent = '';
    el('pay-brand').textContent = '';
    el('pay-form').style.display = '';
    el('pay-done').style.display = 'none';
    el('pay').classList.add('on');
    el('pay-name').focus();
  }

  function closeCheckout() {
    el('pay').classList.remove('on');
    payPlan = null;
  }

  function wireCheckout() {
    var num = el('pay-num'), exp = el('pay-exp'), cvv = el('pay-cvv');

    num.addEventListener('input', function () {
      var amex = window.GmfyPay.brand(num.value) === 'Amex';
      var pos = num.selectionStart, before = num.value;
      num.value = window.GmfyPay.groupNumber(num.value, amex);
      // keep the caret roughly where it was after re-grouping
      if (pos === before.length) num.selectionStart = num.selectionEnd = num.value.length;
      var d = window.GmfyPay.digits(num.value);
      el('pay-brand').textContent = d.length >= 2 ? window.GmfyPay.brand(num.value) : '';
      num.classList.remove('bad');
    });
    exp.addEventListener('input', function () {
      exp.value = window.GmfyPay.groupExpiry(exp.value); exp.classList.remove('bad');
    });
    cvv.addEventListener('input', function () {
      cvv.value = window.GmfyPay.digits(cvv.value).slice(0, 4); cvv.classList.remove('bad');
    });

    el('pay-go').addEventListener('click', function () {
      ['pay-name', 'pay-num', 'pay-exp', 'pay-cvv'].forEach(function (f) {
        el(f).classList.remove('bad');
      });
      var res = window.GmfyPay.validate({
        name: el('pay-name').value, number: num.value,
        expiry: exp.value, cvv: cvv.value
      });
      if (!res.ok) {
        el('pay-err').textContent = res.msg;
        var map = { name: 'pay-name', number: 'pay-num', expiry: 'pay-exp', cvv: 'pay-cvv' };
        if (map[res.field]) { el(map[res.field]).classList.add('bad'); el(map[res.field]).focus(); }
        return;
      }
      el('pay-err').textContent = '';
      activatePlan(payPlan);
      el('pay-summary').textContent = res.brand + ' ending ' + res.last4;
      el('pay-form').style.display = 'none';
      el('pay-done').style.display = '';
    });

    el('pay-cancel').addEventListener('click', closeCheckout);
    el('pay-close').addEventListener('click', closeCheckout);
    el('pay').addEventListener('click', function (e) {
      if (e.target === el('pay')) closeCheckout();
    });
  }

  function paintPlan() {
    var P = window.GmfyPlans;
    var cur = P.current().id;
    var giftDays = P.giftDaysLeft();
    P.order.forEach(function (p) {
      var card = el('p-' + p);
      if (card) card.classList.toggle('on', p === cur);
      var btn = document.querySelector('[data-plan="' + p + '"]');
      if (!btn) return;
      if (p === cur) {
        btn.textContent = (giftDays != null)
          ? 'Current · ' + giftDays + 'd left' : 'Current plan';
      } else {
        btn.textContent = 'Choose ' + P.all[p].name;
      }
    });
    paintInvites();
    paintFree();
    if (window.GmfyPromos) window.GmfyPromos.start();   // ads on/off follows the plan
  }

  /* ---------------- free-plan restrictions + rewarded ads ---------------- */
  function paintFree() {
    var F = window.GmfyFree;
    if (!F || !el('free-list')) return;
    var st = F.stats();
    el('free-count').textContent = window.GmfyPlans.current().id === 'free'
      ? '(' + st.active + ' / ' + st.total + ' active)'
      : '(none — you are on ' + window.GmfyPlans.current().name + ')';
    var list = el('free-list');
    list.innerHTML = '';
    F.LIMITS.forEach(function (lim) {
      var on = F.locked(lim.id);
      var row = document.createElement('div');
      row.className = 'free-row' + (on ? '' : ' off');
      var ic = document.createElement('span');
      ic.className = 'fi'; ic.textContent = on ? '🔒' : '✓';
      var lab = document.createElement('span');
      lab.className = 'fl'; lab.textContent = lim.label;
      row.appendChild(ic); row.appendChild(lab);
      if (on && lim.r) {
        var b = document.createElement('button');
        b.className = 'fw'; b.textContent = 'Watch ad';
        b.addEventListener('click', function () { watchRewarded(lim.id); });
        row.appendChild(b);
      } else if (!on && F.isFree()) {
        var u = document.createElement('span');
        u.className = 'fu'; u.textContent = 'lifted';
        row.appendChild(u);
      }
      list.appendChild(row);
    });
  }

  function watchRewarded(id) {
    if (!window.GmfyVideoAds) return;
    window.GmfyVideoAds.rewarded(id, function () {
      window.GmfyFree.unlock(id);          // reward: lift this restriction this session
    }, function () {
      paintFree();
      if (window.GmfyPromos) window.GmfyPromos.refresh();
    });
  }

  /* ---------------- invite codes ---------------- */
  function paintInvites() {
    var P = window.GmfyPlans;
    el('inv-left').textContent = P.invitesLeft();
    var list = el('inv-list');
    list.innerHTML = '';
    var mine = P.myInvites();
    if (!mine.length) {
      var e = document.createElement('div');
      e.className = 'q';
      e.textContent = P.current().id === 'free'
        ? 'Upgrade to a paid plan to gift invites.'
        : 'No codes yet — create one to share your plan.';
      list.appendChild(e);
    }
    mine.forEach(function (m) {
      var used = m.rec && m.rec.usedBy;
      var row = document.createElement('div');
      row.className = 'code-row' + (used ? ' spent' : '');
      var c = document.createElement('span');
      c.className = 'code'; c.textContent = m.code;
      var s = document.createElement('span');
      s.className = 'used';
      s.textContent = used ? 'redeemed' : 'unused';
      row.appendChild(c); row.appendChild(s);
      list.appendChild(row);
    });
    el('inv-mint').disabled = (P.invitesLeft() <= 0 || P.current().id === 'free');
  }

  function wireInvites() {
    el('inv-mint').addEventListener('click', function () {
      var r = window.GmfyPlans.mintInvite();
      var msg = el('inv-msg');
      if (!r.ok) {
        msg.className = 'err';
        msg.textContent = r.error === 'free'
          ? 'You need a paid plan to gift invites.'
          : r.error === 'quota' ? 'You have used all 10 invite codes.'
          : 'Could not create a code.';
        return;
      }
      msg.className = 'ok';
      msg.textContent = 'Code created — share it with a friend.';
      paintInvites();
    });
    el('inv-redeem').addEventListener('click', function () {
      var code = el('inv-code').value;
      var r = window.GmfyPlans.redeemInvite(code);
      var msg = el('inv-msg');
      if (!r.ok) {
        msg.className = 'err';
        msg.textContent = { unknown: 'That code was not found.',
          used: 'That code has already been redeemed.',
          self: "You can't redeem your own code." }[r.error] || 'Could not redeem.';
        return;
      }
      msg.className = 'ok';
      msg.textContent = 'Redeemed! ' + window.GmfyPlans.all[r.plan].name
        + ' is yours for ' + r.days + ' days.';
      el('inv-code').value = '';
      paintPlan();
      paintGames();
    });
  }

  /* ---------------- export ---------------- */
  var iconImg = null;

  function wireExport() {
    el('x-pick').addEventListener('click', function () { el('x-file').click(); });
    el('x-file').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          iconImg = im;
          el('x-thumb').style.backgroundImage = 'url(' + im.src + ')';
          el('x-thumb').textContent = '';
          el('x-iconname').textContent = f.name + ' · ' + im.width + '×' + im.height;
          if (im.width < 512 || im.height < 512)
            el('x-hint').textContent = 'tip: 512×512 or larger keeps icons sharp';
        };
        im.onerror = function () { el('x-hint').textContent = 'could not read that image'; };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    });

    el('x-cordova').addEventListener('click', function () { doExport('cordova'); });
    el('x-electron').addEventListener('click', function () { doExport('electron'); });
  }

  function doExport(target) {
    var g = curGame ? window.GmfyPlans.get(curGame) : null;
    var name = (el('x-name').value.trim()) || (g && g.name) || 'My Game';
    var pkg = (el('x-pkg').value.trim()) || ('com.gmfy.' + window.GmfyExport.slug(name).replace(/-/g, ''));
    var payload = {
      name: name,
      world: { biomeKey: engine.world.biomeKey, relief: maker.relief, props: engine.world.props },
      script: blocks.script
    };
    el('x-out').textContent = 'packing ' + target + ' project…';
    el('x-cordova').disabled = el('x-electron').disabled = true;

    window.GmfyExport.build(target, { name: name, pkg: pkg, game: payload }, iconImg)
      .then(function (res) {
        var kb = Math.max(1, Math.round(res.blob.size / 1024));
        var ok = window.GmfyExport.save(res.blob, res.filename);
        el('x-out').innerHTML = '<b>' + res.filename + '</b> · ' + res.count +
          ' files · ' + kb + ' KB';
        el('x-hint').textContent = ok
          ? (target === 'cordova' ? 'unzip, then: cordova platform add android && cordova build android'
                                  : 'unzip, then: npm install && npm start')
          : 'download blocked by the browser — try again from a desktop browser';
      })
      .catch(function (e) {
        el('x-out').textContent = 'export failed: ' + (e && e.message ? e.message : e);
      })
      .then(function () {
        el('x-cordova').disabled = el('x-electron').disabled = false;
      });
  }

  /* ---------------- loop ---------------- */
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (held) engine.move(held, dt * (game.playing ? blocks.speed * 0.6 : 1));
    blocks.tick(dt);
    game.tick(dt);
    engine.render();
    game.draw(engine.ctx, engine.w, engine.h);
    if (blocks.bannerT > 0 && blocks.banner) drawBanner(blocks.banner);
    requestAnimationFrame(loop);
  }

  function drawBanner(txt) {
    var ctx = engine.ctx;
    ctx.save();
    ctx.font = 'bold 17px -apple-system,Roboto,sans-serif';
    var w = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(124,92,255,.92)';
    ctx.beginPath();
    ctx.roundRect(engine.w / 2 - w / 2 - 14, engine.h - 96, w + 28, 36, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(txt, engine.w / 2, engine.h - 72);
    ctx.restore();
  }

  /* ---------------- start ---------------- */
  function boot() {
    if (window.__gmfyBooted) return;
    window.__gmfyBooted = true;
    wireAuth();
    wireHome();
    window.GmfyGuard.check();                       // check for ad-blocker / VPN ban
    window.GmfyGuard.wire();                        // wire the recheck button
    if (window.GmfyAuth.current()) enterApp();      // returning user skips the homepage
    else el('home').classList.add('on');            // everyone else lands on it first
  }

  function wireHome() {
    var s = el('home-start');
    if (s) s.addEventListener('click', function () {
      el('home').classList.remove('on');            // reveals the sign-in beneath
    });
  }

  document.addEventListener('deviceready', boot, false);
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 300);
  else window.addEventListener('load', function () { setTimeout(boot, 300); });
})();
