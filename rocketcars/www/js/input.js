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

  function hitBtn(x, y) {
    for (var i = 0; i < btns.length; i++) {
      var r = btns[i].el.getBoundingClientRect();
      var m = 8;
      if (x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m) return btns[i];
    }
    return null;
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

  function onStart(id, x, y) {
    var b = hitBtn(x, y);
    if (b) { b.touch = id; press(b, true); return; }
    if (stickTouch === null && x < window.innerWidth * 0.55) {
      stickTouch = id;
      stickOrigin.x = x; stickOrigin.y = y;
      showStick(x, y); setKnob(0, 0);
      I.active = true;
    }
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
    }
  }

  function onEnd(id) {
    if (id === stickTouch) {
      stickTouch = null; I.steer = 0; I.pitch = 0;
      setKnob(0, 0);
      if (stickEl) stickEl.style.opacity = '0';
    }
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].touch === id) { btns[i].touch = null; press(btns[i], false); }
    }
  }

  RC.initInput = function () {
    stickEl = document.getElementById('stick');
    knobEl = document.getElementById('knob');
    zoneEl = document.getElementById('touchzone');

    var els = document.querySelectorAll('[data-act]');
    for (var i = 0; i < els.length; i++)
      btns.push({ el: els[i], act: els[i].getAttribute('data-act'), touch: null });

    function tlist(e, fn) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        fn(t.identifier, t.clientX, t.clientY);
      }
    }
    var opts = { passive: false };
    zoneEl.addEventListener('touchstart', function (e) { e.preventDefault(); tlist(e, onStart); }, opts);
    zoneEl.addEventListener('touchmove', function (e) { e.preventDefault(); tlist(e, onMove); }, opts);
    zoneEl.addEventListener('touchend', function (e) { e.preventDefault(); tlist(e, function (id) { onEnd(id); }); }, opts);
    zoneEl.addEventListener('touchcancel', function (e) { tlist(e, function (id) { onEnd(id); }); }, opts);

    // mouse (desktop testing)
    var mouseDown = false;
    zoneEl.addEventListener('mousedown', function (e) { mouseDown = true; onStart(-1, e.clientX, e.clientY); });
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
