// Gemensamma hjälpfunktioner, lagring och inmatning.
(function () {
  'use strict';
  const SK = (window.SK = window.SK || {});

  SK.W = 320; // spelets interna upplösning
  SK.H = 180;

  SK.$ = (id) => document.getElementById(id);
  SK.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SK.lerp = (a, b, t) => a + (b - a) * t;
  SK.rand = (a, b) => a + Math.random() * (b - a);
  SK.randi = (a, b) => Math.floor(SK.rand(a, b + 1));
  SK.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  SK.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Ett enkelt, upprepningsbart slumptal (samma bakgrunder varje gång)
  SK.seeded = function (seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  SK.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  SK.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // localStorage kan saknas (privat läge, förhandsvisning) – spelet fungerar ändå.
  const mem = {};
  SK.store = {
    get(key, def) {
      try {
        const v = localStorage.getItem('skrackappen.' + key);
        if (v != null) return JSON.parse(v);
      } catch (e) { /* ignoreras */ }
      return key in mem ? mem[key] : def;
    },
    set(key, val) {
      mem[key] = val;
      try { localStorage.setItem('skrackappen.' + key, JSON.stringify(val)); } catch (e) { /* ignoreras */ }
    },
    del(key) {
      delete mem[key];
      try { localStorage.removeItem('skrackappen.' + key); } catch (e) { /* ignoreras */ }
    },
  };

  // ---------- inmatning ----------
  const keys = new Set();
  const presses = [];
  const KEYMAP = {
    act: ['KeyE', 'Space', 'Enter', 'NumpadEnter'],
    run: ['ShiftLeft', 'ShiftRight'],
    light: ['KeyF', 'KeyL'],
    pause: ['Escape', 'KeyP'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  };
  const virt = { run: false, act: false, light: false };
  const stick = { x: 0, y: 0, on: false };

  const I = (SK.input = {
    keys, stick, virt,
    touchMode: (function () { try { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; } catch (e) { return false; } })(),
    is(name) {
      if (virt[name]) return true;
      const list = KEYMAP[name];
      return !!list && list.some((k) => keys.has(k));
    },
    press(name) { presses.push(name); },
    take(name) {
      const i = presses.indexOf(name);
      if (i >= 0) { presses.splice(i, 1); return true; }
      return false;
    },
    flush() { presses.length = 0; },
    axis() {
      let x = 0, y = 0;
      if (I.is('left')) x -= 1;
      if (I.is('right')) x += 1;
      if (I.is('up')) y -= 1;
      if (I.is('down')) y += 1;
      if (stick.on) { x += stick.x; y += stick.y; }
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y };
    },
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) {
      e.preventDefault();
      SK.toggleFullscreen();
      return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!e.repeat) {
      for (const name in KEYMAP) if (KEYMAP[name].includes(e.code)) presses.push(name);
    }
    keys.add(e.code);
    if (SK.onKey) SK.onKey(e);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); stick.on = false; });

  SK.toggleFullscreen = function () {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch (e) { /* stöds inte */ }
  };

  // Pekskärm: virtuell spak och knappar
  SK.setupTouch = function () {
    const area = SK.$('stick');
    const knob = SK.$('stick-knob');
    let id = null, cx = 0, cy = 0;
    const R = () => area.getBoundingClientRect();
    area.addEventListener('pointerdown', (e) => {
      id = e.pointerId; area.setPointerCapture(id);
      const r = R();
      cx = e.clientX; cy = e.clientY;
      knob.style.left = (cx - r.left) + 'px';
      knob.style.top = (cy - r.top) + 'px';
      knob.style.bottom = 'auto';
      knob.style.transform = 'translate(-50%,-50%)';
      area.classList.add('active');
      stick.on = true; stick.x = 0; stick.y = 0;
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const max = Math.max(30, R().height * 0.18);
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
      stick.x = dx / max; stick.y = dy / max;
      if (Math.hypot(stick.x, stick.y) < 0.18) { stick.x = 0; stick.y = 0; }
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; stick.on = false; stick.x = 0; stick.y = 0;
      area.classList.remove('active');
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);

    document.querySelectorAll('#touch button').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        b.setPointerCapture(e.pointerId);
        if (k === 'run') { virt.run = true; b.classList.add('on'); }
        else presses.push(k);
        if (SK.audio) SK.audio.init();
      });
      const up = () => { if (k === 'run') { virt.run = false; b.classList.remove('on'); } };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    });
  };

  window.addEventListener('touchstart', () => { I.touchMode = true; document.body.classList.add('touch'); }, { passive: true, once: true });
})();
