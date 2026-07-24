/* Touch (floating stick + buttons) and keyboard input */
(function () {
  var I = {
    steer: 0, pitch: 0, gas: 0, rev: 0,
    boost: false, roll: false,
    jumpPressed: false, jumpHeld: false,
    active: false
  };
  RC.Input = I;
  RC.invertPitch = false;

  var STICK_R = 62;
  var stickEl, knobEl, zoneEl;
  var stickTouch = null, stickOrigin = { x: 0, y: 0 };
  var btns = [];           // {el, act, touch}
  var keys = {};

  function setKnob(dx, dy) {
    if (knobEl) knobEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  function showStick(x, y) {
    if (!stickEl) return;
    stickEl.style.left = x + 'px';
    stickEl.style.top = y + 'px';
    stickEl.style.opacity = '1';
  }

  // Buttons are hit tested geometrically rather than by event target: the touch
  // listeners are global, so it does not matter what element the finger lands on.
  function hitBtn(x, y) {
    var best = null, bestD = 1e9;
    for (var i = 0; i < btns.length; i++) {
      var r = btns[i].el.getBoundingClientRect();
      if (!r.width) continue;                       // hidden HUD
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var rad = r.width / 2 + 10;                   // round buttons + a little slack
      var d = Math.hypot(x - cx, y - cy);
      if (d < rad && d < bestD) { bestD = d; best = btns[i]; }
    }
    return best;
  }

  // menus and overlays own the touch while they are up
  var BLOCKERS = ['menu', 'pause', 'over', 'help'];
  function uiBlocking() {
    for (var i = 0; i < BLOCKERS.length; i++) {
      var e = document.getElementById(BLOCKERS[i]);
      if (e && !e.classList.contains('hidden')) return true;
    }
    return false;
  }

  function press(b, on) {
    b.el.classList.toggle('down', on);
    switch (b.act) {
      case 'gas': I.gas = on ? 1 : 0; break;
      case 'rev': I.rev = on ? 1 : 0; break;
      case 'boost': I.boost = on; break;
      case 'roll': I.roll = on; break;
      case 'jump':
        I.jumpHeld = on;
        if (on) I.jumpPressed = true;
        break;
    }
  }

  // returns true when the game consumed the touch (so the caller suppresses the
  // browser default; taps that fall through still fire clicks on menu buttons)
  function onStart(id, x, y) {
    if (uiBlocking()) return false;
    var b = hitBtn(x, y);
    if (b) { b.touch = id; press(b, true); return true; }
    if (stickTouch === null && x < window.innerWidth * 0.58) {
      stickTouch = id;
      stickOrigin.x = x; stickOrigin.y = y;
      showStick(x, y); setKnob(0, 0);
      I.active = true;
      return true;
    }
    return false;
  }

  function onMove(id, x, y) {
    if (id === stickTouch) {
      var dx = x - stickOrigin.x, dy = y - stickOrigin.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      setKnob(dx, dy);
      var dz = 0.12;
      var sx = dx / STICK_R, sy = -dy / STICK_R;
      I.steer = Math.abs(sx) < dz ? 0 : (sx - Math.sign(sx) * dz) / (1 - dz);
      I.pitch = Math.abs(sy) < dz ? 0 : (sy - Math.sign(sy) * dz) / (1 - dz);
      I.steer = Math.max(-1, Math.min(1, I.steer));
      I.pitch = Math.max(-1, Math.min(1, I.pitch));
      return true;
    }
    return false;
  }

  function onEnd(id) {
    var used = false;
    if (id === stickTouch) {
      stickTouch = null; I.steer = 0; I.pitch = 0;
      setKnob(0, 0);
      if (stickEl) stickEl.style.opacity = '0';
      used = true;
    }
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].touch === id) { btns[i].touch = null; press(btns[i], false); used = true; }
    }
    return used;
  }

  // a finger that is lifted without a touchend (or while the HUD changes) must
  // never leave a button stuck down
  function releaseAll() {
    for (var i = 0; i < btns.length; i++)
      if (btns[i].touch !== null) { btns[i].touch = null; press(btns[i], false); }
    if (stickTouch !== null) onEnd(stickTouch);
  }
  RC.releaseAllTouches = releaseAll;

  RC.initInput = function () {
    stickEl = document.getElementById('stick');
    knobEl = document.getElementById('knob');
    zoneEl = document.getElementById('touchzone');

    var els = document.querySelectorAll('[data-act]');
    for (var i = 0; i < els.length; i++)
      btns.push({ el: els[i], act: els[i].getAttribute('data-act'), touch: null });

    // Listen on the document, not on a single layer: a finger on a button lands
    // on that button (or the <span> inside it), which would never bubble to a
    // listener attached to the backdrop.
    function tlist(e, fn) {
      var used = false;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (fn(t.identifier, t.clientX, t.clientY)) used = true;
      }
      // only swallow the event when the game took it, so menu buttons still click
      if (used && e.cancelable) e.preventDefault();
    }
    var opts = { passive: false, capture: true };
    document.addEventListener('touchstart', function (e) { tlist(e, onStart); }, opts);
    document.addEventListener('touchmove', function (e) { tlist(e, onMove); }, opts);
    document.addEventListener('touchend', function (e) { tlist(e, onEnd); }, opts);
    document.addEventListener('touchcancel', function (e) { tlist(e, onEnd); }, opts);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) releaseAll();
    });

    // mouse (desktop testing)
    var mouseDown = false;
    document.addEventListener('mousedown', function (e) {
      if (onStart(-1, e.clientX, e.clientY)) mouseDown = true;
    });
    window.addEventListener('mousemove', function (e) { if (mouseDown) onMove(-1, e.clientX, e.clientY); });
    window.addEventListener('mouseup', function () { if (mouseDown) { mouseDown = false; onEnd(-1); } });

    // keyboard
    window.addEventListener('keydown', function (e) {
      if (keys[e.code]) return;
      keys[e.code] = true;
      if (e.code === 'Space') I.jumpPressed = true;
      syncKeys();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; syncKeys(); });

    function syncKeys() {
      var s = 0, p = 0;
      if (keys.ArrowLeft || keys.KeyA) s -= 1;
      if (keys.ArrowRight || keys.KeyD) s += 1;
      if (keys.ArrowUp) p += 1;
      if (keys.ArrowDown) p -= 1;
      if (stickTouch === null) { I.steer = s; I.pitch = p; }
      I.gas = keys.KeyW ? 1 : (btnDown('gas') ? 1 : 0);
      I.rev = keys.KeyS ? 1 : (btnDown('rev') ? 1 : 0);
      I.boost = keys.ShiftLeft || keys.ShiftRight || btnDown('boost');
      I.roll = keys.KeyQ || keys.KeyE || btnDown('roll');
      I.jumpHeld = keys.Space || btnDown('jump');
    }
    function btnDown(act) {
      for (var i = 0; i < btns.length; i++)
        if (btns[i].act === act && btns[i].touch !== null) return true;
      return false;
    }
  };

  RC.consumeJump = function () {
    var j = I.jumpPressed; I.jumpPressed = false; return j;
  };
})();
