// Figurer och rutor till banorna – allt ritas med kod i pixelstil.
(function () {
  'use strict';
  const SK = window.SK;

  SK.EYE = '#ff6b8a';

  SK.LOOKS = {
    kasper: { skin: '#f0c8a0', hair: '#4a3020', hs: 'messy', top: '#35558a', top2: '#284170', pants: '#25252d', shoe: '#0e0e10', hood: true },
    ruben: { skin: '#e9b78e', hair: '#c9772f', hs: 'short', top: '#8e2b25', top2: '#6a1d19', pants: '#2d3550', shoe: '#161616', cap: '#b8322a', big: true },
    tilda: { skin: '#f3d0b0', hair: '#e2c46a', hs: 'pony', top: '#6b3f91', top2: '#4f2d6d', pants: '#1c1c22', shoe: '#2a1a2a' },
    mamma: { skin: '#ecc4a0', hair: '#3a2a24', hs: 'bun', top: '#3d8b86', top2: '#2d6e6a', pants: '#3d8b86', shoe: '#dddddd' },
    larare: { skin: '#e8c0a0', hair: '#b8b0a8', hs: 'short', top: '#7a5a3a', top2: '#5e4430', pants: '#33333a', shoe: '#222', glasses: true },
    rektor: { skin: '#d9a77f', hair: '#2a2a2a', hs: 'short', top: '#2f3542', top2: '#232833', pants: '#2f3542', shoe: '#111', glasses: true },
    elias: { skin: '#e9c3a1', hair: '#222', hs: 'messy', top: '#55606b', top2: '#434c55', pants: '#2a2a30', shoe: '#111', glasses: true },
    vaktmastare: { skin: '#dfb08a', hair: '#777', hs: 'short', top: '#3c4a2c', top2: '#2e3a21', pants: '#3c4a2c', shoe: '#222', cap: '#2f3a22' },
    // Slut
    elsa: { skin: '#f3cfae', hair: '#8a3b1c', hs: 'long', top: '#e0a52e', top2: '#b9821c', pants: '#2a2e3d', shoe: '#5a2a1a' },
    johan: { skin: '#eac2a0', hair: '#1d1a1a', hs: 'messy', top: '#3d6b45', top2: '#2c5133', pants: '#2a2a30', shoe: '#111', glasses: true, hood: true },
    jason: { skin: '#b07a52', hair: '#1b1410', hs: 'messy', top: '#c0392b', top2: '#962c21', pants: '#33415e', shoe: '#e8e4dc' },
    froken: { skin: '#efc8a6', hair: '#d9b46a', hs: 'bun', top: '#2f7f86', top2: '#24646a', pants: '#3a3a44', shoe: '#222', glasses: true },
    maja: { skin: '#f0c8a0', hair: '#1f1a17', hs: 'pony', top: '#5a8fd0', top2: '#4572a8', pants: '#24242c', shoe: '#ddd' },
    pappa: { skin: '#e3b48e', hair: '#5a3a24', hs: 'short', top: '#4a4f5a', top2: '#393d46', pants: '#2c3040', shoe: '#1a1a1a' },
  };

  const HAIRS = ['#2b1d14', '#4a3020', '#7a4a22', '#c9a35a', '#e6d08a', '#1b1b1f', '#8a3a1c', '#5a5a60'];
  const TOPS = [['#5b8a3a', '#466e2b'], ['#c08a2a', '#9a6e1e'], ['#3a7a8a', '#2b5f6c'], ['#8a3a6a', '#6c2b52'], ['#555', '#444'], ['#b04a3a', '#8a382b'], ['#2a4a8a', '#1f386c'], ['#cfcfcf', '#a8a8a8'], ['#d07090', '#a85873']];
  const SKINS = ['#f3d0b0', '#e9b78e', '#d9a77f', '#b07a52', '#8a5a3a', '#f0c8a0'];
  const STYLES = ['short', 'messy', 'pony', 'long', 'short', 'bun'];

  // En slumpad elev (men samma elev varje gång för samma nummer)
  SK.studentLook = function (n) {
    const r = SK.seeded(n * 7919 + 13);
    const t = TOPS[Math.floor(r() * TOPS.length)];
    return {
      skin: SKINS[Math.floor(r() * SKINS.length)],
      hair: HAIRS[Math.floor(r() * HAIRS.length)],
      hs: STYLES[Math.floor(r() * STYLES.length)],
      top: t[0], top2: t[1],
      pants: r() < 0.5 ? '#25252d' : '#3a4560',
      shoe: '#141414',
      glasses: r() < 0.15,
      cap: r() < 0.1 ? t[1] : null,
    };
  };

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => SK.clamp(Math.round(c * k), 0, 255);
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  SK.shade = shade;

  // x,y = mitt under fötterna. dir: d (mot oss), u (bort), l, r. ph = gångfas (0 = står still).
  SK.drawPerson = function (ctx, x, y, L, dir, ph, o) {
    o = o || {};
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(s, s);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (dir === 'l') { ctx.scale(-1, 1); dir = 'r'; }
    const r = (x0, y0, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x0, y0, w, h); };
    const big = !!L.big;
    const H = big ? 17 : 16;
    const top = -H;
    const W = big ? 10 : 8, hw = W / 2;
    const sn = ph ? Math.sin(ph) : 0;
    const eye = o.glow ? SK.EYE : o.eyeColor || '#1a1410';

    if (!o.noShadow) r(-hw - 1, -1, W + 2, 2, 'rgba(0,0,0,0.35)');

    if (dir === 'r') {
      const st = Math.round(sn * 1.6);
      const legW = big ? 3 : 2;
      r(-1 - st, -4, legW, 4, shade(L.pants, 0.7)); r(-1 - st, -1, legW + 1, 1, L.shoe);
      r(-1 + st, -4, legW, 4, L.pants); r(-1 + st, -1, legW + 1, 1, L.shoe);
      const bw = big ? 8 : 6;
      r(-bw / 2, top + 7, bw, 5, L.top);
      r(-bw / 2, top + 11, bw, 1, L.top2);
      if (L.hood) r(-bw / 2, top + 6, 2, 2, L.top2);
      const as = Math.round(-sn * 1.5);
      r(-1 + as, top + 7, 2, 4, L.top2); r(-1 + as, top + 11, 2, 1, L.skin);
      if (o.phone) { r(2, top + 8, 2, 3, '#111'); r(2, top + 8, 2, 2, '#cfe8c0'); }
      r(-3, top, 7, 7, L.skin);
      r(-3, top, 7, 2, L.hair);
      r(-3, top + 2, 2, L.hs === 'long' || L.hs === 'pony' ? 5 : 3, L.hair);
      if (L.hs === 'messy') { r(-2, top - 1, 2, 1, L.hair); r(1, top - 1, 1, 1, L.hair); r(3, top + 2, 1, 1, L.hair); }
      if (L.hs === 'pony') r(-5, top + 2, 2, 5, L.hair);
      if (L.hs === 'bun') r(-5, top, 2, 3, L.hair);
      if (L.hs === 'long') r(-4, top + 2, 1, 6, L.hair);
      if (L.cap) { r(-3, top - 1, 7, 3, L.cap); r(3, top + 2, 3, 1, shade(L.cap, 0.6)); }
      if (L.glasses) { r(1, top + 4, 3, 1, '#1d1d1d'); r(2, top + 4, 1, 1, '#9cc8e8'); }
      else r(2, top + 4, 1, 1, eye);
      if (o.mouth === 'o') r(3, top + 6, 1, 1, '#4a1e1e');
    } else {
      const lift = (v) => (v > 0.35 ? 1 : 0);
      const lL = lift(sn), rL = lift(-sn);
      const legW = big ? 3 : 2;
      const lx = -hw + 1, rx = hw - 1 - legW;
      r(lx, -4 - lL, legW, 4 - (lL ? 0 : 0), L.pants); r(lx, -1 - lL, legW, 1, L.shoe);
      r(rx, -4 - rL, legW, 4, L.pants); r(rx, -1 - rL, legW, 1, L.shoe);
      r(-hw, top + 7, W, 5, L.top);
      r(-hw, top + 11, W, 1, L.top2);
      const aL = Math.round(sn), aR = Math.round(-sn);
      r(-hw - 1, top + 7 + Math.max(0, aL), 1, 4, L.top2); r(-hw - 1, top + 11 + Math.max(0, aL), 1, 1, L.skin);
      r(hw, top + 7 + Math.max(0, aR), 1, 4, L.top2); r(hw, top + 11 + Math.max(0, aR), 1, 1, L.skin);
      if (dir === 'u') {
        r(-4, top, 8, 7, L.hair);
        r(-3, top + 6, 6, 1, L.skin);
        if (L.hood) r(-3, top + 6, 6, 2, L.top2);
        if (L.hs === 'pony') r(-1, top + 5, 2, 5, L.hair);
        if (L.hs === 'long') r(-4, top + 6, 8, 3, L.hair);
        if (L.hs === 'bun') r(-2, top - 2, 4, 3, L.hair);
        if (L.cap) r(-4, top - 1, 8, 3, L.cap);
      } else {
        r(-4, top, 8, 7, L.skin);
        if (o.lit) r(-4, top + 3, 8, 4, 'rgba(190,240,150,0.28)');
        r(-4, top, 8, 2, L.hair);
        const side = L.hs === 'long' || L.hs === 'pony' ? 5 : 2;
        r(-4, top + 2, 1, side, L.hair); r(3, top + 2, 1, side, L.hair);
        if (L.hs === 'messy') { r(-3, top - 1, 2, 1, L.hair); r(1, top - 1, 1, 1, L.hair); r(-2, top + 2, 3, 1, L.hair); }
        if (L.hs === 'pony' || L.hs === 'long') r(-3, top + 2, 6, 1, L.hair);
        if (L.hs === 'bun') r(-2, top - 2, 4, 2, L.hair);
        if (L.cap) { r(-4, top - 1, 8, 3, L.cap); r(-5, top + 2, 10, 1, shade(L.cap, 0.6)); }
        if (L.glasses) {
          r(-3, top + 4, 6, 1, '#1d1d1d');
          r(-2, top + 4, 1, 1, o.glow ? SK.EYE : '#9cc8e8'); r(1, top + 4, 1, 1, o.glow ? SK.EYE : '#9cc8e8');
        } else {
          r(-2, top + 4, 1, 1, eye); r(1, top + 4, 1, 1, eye);
        }
        if (o.mouth === 'o') r(-1, top + 6, 2, 1, '#4a1e1e');
        else if (o.mouth === 'grin') { r(-2, top + 6, 4, 1, '#5a2420'); r(-1, top + 6, 2, 1, '#eee'); }
        else if (o.mouth === 'sad') { r(-1, top + 6, 2, 1, '#6a3a30'); }
        if (o.tears) { r(-2, top + 5, 1, 1, '#9cd2ff'); r(1, top + 5, 1, 1, '#9cd2ff'); }
        if (L.hood) { r(-1, top + 7, 1, 2, '#d8d8d8'); r(1, top + 7, 1, 2, '#d8d8d8'); }
        if (o.phone) { r(-1, top + 9, 3, 3, '#111'); r(-1, top + 9, 3, 2, '#cfe8c0'); }
      }
    }
    ctx.restore();
  };

  // Ljussken (ögon, mobiler) ritas ovanpå mörkret
  SK.glowDot = function (ctx, x, y, rad, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    ctx.restore();
  };

  // ---------- Pantern sedd uppifrån ----------
  SK.drawPanther = function (ctx, x, y, ang, t, o) {
    o = o || {};
    const a = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = a;
    const body = o.color || '#0a090d';
    const gait = Math.sin(t * (o.speed || 8));
    ctx.fillStyle = body;
    // ben
    ctx.fillRect(4 + gait * 2, -6, 3, 2); ctx.fillRect(4 - gait * 2, 4, 3, 2);
    ctx.fillRect(-7 - gait * 2, -6, 3, 2); ctx.fillRect(-7 + gait * 2, 4, 3, 2);
    // svans
    ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-16, Math.sin(t * 3) * 6, -21, Math.sin(t * 3 + 1.4) * 5);
    ctx.stroke();
    // kropp och huvud
    ctx.beginPath(); ctx.ellipse(-1, 0, 11, 4.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 0, 4.4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(9, -6.5); ctx.lineTo(11, -3.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, 3); ctx.lineTo(9, 6.5); ctx.lineTo(11, 3.5); ctx.fill();
    if (o.rim) {
      ctx.strokeStyle = 'rgba(120,90,160,0.35)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(-1, 0, 11, 4.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    // ögon i världskoordinater så att de kan glöda
    const ex = x + Math.cos(ang) * 12.5, ey = y + Math.sin(ang) * 12.5;
    const px = -Math.sin(ang) * 1.8, py = Math.cos(ang) * 1.8;
    return [[ex + px, ey + py], [ex - px, ey - py]];
  };

  SK.drawEyes = function (ctx, pts, intensity) {
    const k = intensity == null ? 1 : intensity;
    pts.forEach(([x, y]) => {
      SK.glowDot(ctx, x, y, 7, 'rgba(255,120,150,0.55)', k);
      ctx.fillStyle = SK.EYE;
      ctx.globalAlpha = k;
      ctx.fillRect(Math.round(x - 0.5), Math.round(y - 0.5), 1, 1);
      ctx.globalAlpha = 1;
    });
  };

  // ---------- Pantern i närbild (skrämseln) ----------
  SK.drawPantherFace = function (ctx, cx, cy, s, t, o) {
    o = o || {};
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    const blk = '#050407';
    ctx.fillStyle = blk;
    // öron
    ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(-30, -44); ctx.lineTo(-12, -26); ctx.fill();
    ctx.beginPath(); ctx.moveTo(34, -14); ctx.lineTo(30, -44); ctx.lineTo(12, -26); ctx.fill();
    ctx.fillStyle = '#1a0f16';
    ctx.beginPath(); ctx.moveTo(-30, -18); ctx.lineTo(-29, -37); ctx.lineTo(-18, -26); ctx.fill();
    ctx.beginPath(); ctx.moveTo(30, -18); ctx.lineTo(29, -37); ctx.lineTo(18, -26); ctx.fill();
    // huvud
    ctx.fillStyle = blk;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 18, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
    // kant
    ctx.strokeStyle = 'rgba(110,80,150,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 32, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // ögon
    const open = o.open == null ? 1 : o.open;
    [-16, 16].forEach((ex) => {
      ctx.save();
      ctx.translate(ex, -4);
      ctx.rotate(ex < 0 ? 0.22 : -0.22);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,120,150,0.55)'); g.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = g; ctx.fillRect(-18, -18, 36, 36);
      ctx.fillStyle = SK.EYE;
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.6 * open, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a0a02';
      const pw = o.wide ? 2.6 : 1.3;
      ctx.beginPath(); ctx.ellipse(Math.sin(t * 0.7) * 1.5, 0, pw, 4.3 * open, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    // nos
    ctx.fillStyle = '#1b1218';
    ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(4, 12); ctx.lineTo(0, 16); ctx.fill();
    // mun
    if (o.teeth) {
      ctx.fillStyle = '#2a0508';
      ctx.beginPath(); ctx.ellipse(0, 25, 13, 6, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      for (let i = -11; i <= 9; i += 4) {
        ctx.beginPath(); ctx.moveTo(i, 25); ctx.lineTo(i + 2, 25); ctx.lineTo(i + 1, 25 + (Math.abs(i) > 7 ? 5 : 3)); ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#1b1218'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, 20); ctx.moveTo(-7, 22); ctx.quadraticCurveTo(0, 19, 7, 22); ctx.stroke();
    }
    // morrhår
    ctx.strokeStyle = 'rgba(200,200,210,0.18)'; ctx.lineWidth = 0.6;
    [-1, 1].forEach((sd) => {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(sd * 8, 17 + k * 2); ctx.lineTo(sd * (30 + k * 3), 12 + k * 5 + Math.sin(t * 2 + k) * 1); ctx.stroke();
      }
    });
    ctx.restore();
  };

  // Panterappens öga (logga)
  SK.drawLogoEye = function (ctx, cx, cy, w, open, t) {
    ctx.save();
    const h = w * 0.55 * open;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 1.2);
    g.addColorStop(0, 'rgba(255,120,150,0.35)'); g.addColorStop(1, 'rgba(255,120,150,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - w * 1.3, cy - w * 1.3, w * 2.6, w * 2.6);
    ctx.fillStyle = SK.EYE;
    ctx.beginPath(); ctx.ellipse(cx, cy, w, Math.max(0.3, h / 2), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#050505';
    ctx.beginPath(); ctx.ellipse(cx + Math.sin((t || 0) * 0.8) * w * 0.12, cy, w * 0.14, Math.max(0.2, h / 2 - 0.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // ---------- rutor (16 x 16) ----------
  const TS = (SK.TS = 16);
  const cache = {};

  const THEMES = {
    school: { floor: '#7d7766', floor2: '#837c6b', speck: '#6c675a', alt: '#6e5546', wall: '#cbbf9e', wallTop: '#ddd3b4', wallFace: '#a49676', base: '#6d6250' },
    home: { floor: '#5e412d', floor2: '#664731', speck: '#4c3524', alt: '#4a3a52', wall: '#3a4558', wallTop: '#4a5670', wallFace: '#2b3344', base: '#1e2430' },
    gym: { floor: '#b0854f', floor2: '#b98d56', speck: '#9b7444', alt: '#3e6a8a', wall: '#8e9aa6', wallTop: '#a5b0ba', wallFace: '#707c88', base: '#4e5862' },
    yard: { floor: '#58585c', floor2: '#5d5d61', speck: '#4a4a4e', alt: '#3d5a32', wall: '#7a3a2e', wallTop: '#4a464a', wallFace: '#7a3a2e', base: '#3a1a14' },
    museum: { floor: '#cfc4ae', floor2: '#c8bca5', speck: '#b5a98f', alt: '#8a2f2f', wall: '#6b5d50', wallTop: '#7e6f60', wallFace: '#5a4d42', base: '#3a3028' },
    basement: { floor: '#454543', floor2: '#4a4a47', speck: '#363634', alt: '#3a3530', wall: '#2c2c2f', wallTop: '#3a3a3e', wallFace: '#222225', base: '#141416' },
  };
  SK.THEMES = THEMES;

  function makeTile(theme, ch, v) {
    const c = document.createElement('canvas');
    c.width = TS; c.height = TS;
    const x = c.getContext('2d');
    const T = THEMES[theme];
    const R = SK.seeded(v * 31 + ch.charCodeAt(0) * 7 + theme.length);
    const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const floor = () => {
      r(0, 0, TS, TS, (v & 1) ? T.floor : T.floor2);
      for (let i = 0; i < 6; i++) r(Math.floor(R() * TS), Math.floor(R() * TS), 1, 1, T.speck);
      if (theme === 'home') { r(0, 7, TS, 1, T.speck); r(Math.floor(R() * 12), 0, 1, 7, T.speck); r(Math.floor(R() * 12) + 2, 8, 1, 8, T.speck); }
      if (theme === 'school' || theme === 'museum') { r(0, 0, TS, 1, 'rgba(0,0,0,0.08)'); r(0, 0, 1, TS, 'rgba(0,0,0,0.08)'); }
      if (theme === 'gym') { r(0, 4, TS, 1, T.speck); r(0, 12, TS, 1, T.speck); }
      if (theme === 'basement' && R() < 0.3) { r(3, 5, 5, 1, '#2e2e2c'); r(7, 6, 3, 1, '#2e2e2c'); }
    };
    const furnBase = () => { floor(); r(1, 13, 14, 2, 'rgba(0,0,0,0.3)'); };
    switch (ch) {
      case ',': {
        if (theme === 'yard') {
          r(0, 0, TS, TS, '#3d5a32');
          for (let i = 0; i < 10; i++) r(Math.floor(R() * TS), Math.floor(R() * TS), 1, 2, R() < 0.5 ? '#4b6e3c' : '#33502a');
        } else {
          r(0, 0, TS, TS, T.alt);
          for (let i = 0; i < 5; i++) r(Math.floor(R() * TS), Math.floor(R() * TS), 1, 1, SK.shade(T.alt, 0.8));
        }
        break;
      }
      case '#': case 'w': {
        r(0, 0, TS, TS, T.wallTop);
        r(0, 0, TS, 1, SK.shade(T.wallTop, 1.08));
        if (theme === 'yard') for (let yy = 1; yy < TS; yy += 4) r(0, yy, TS, 1, SK.shade(T.wallTop, 0.85));
        if (theme === 'basement' && R() < 0.4) { r(0, 5, TS, 2, '#4a3a2a'); r(0, 5, TS, 1, '#5a4a36'); }
        break;
      }
      case 'L': case 'H': {
        r(0, 0, TS, TS, ch === 'H' ? '#4c6b56' : '#4b6478');
        r(0, 0, TS, 2, ch === 'H' ? '#5f8669' : '#5d7b92');
        r(7, 2, 1, 14, 'rgba(0,0,0,0.35)');
        for (let i = 0; i < 3; i++) { r(2, 4 + i * 2, 4, 1, 'rgba(0,0,0,0.3)'); r(9, 4 + i * 2, 4, 1, 'rgba(0,0,0,0.3)'); }
        r(5, 10, 1, 2, '#c9c9c9'); r(10, 10, 1, 2, '#c9c9c9');
        if (ch === 'H') { r(8, 2, 1, 14, '#0b0b0b'); r(12, 3, 2, 2, SK.EYE); }
        break;
      }
      case '=': {
        furnBase();
        const wood = theme === 'basement' ? '#5a5248' : theme === 'yard' ? '#6b5038' : '#8b6a45';
        r(1, 3, 14, 8, wood); r(1, 3, 14, 2, SK.shade(wood, 1.2)); r(2, 11, 2, 3, SK.shade(wood, 0.7)); r(12, 11, 2, 3, SK.shade(wood, 0.7));
        if (theme === 'school' && R() < 0.6) { r(4, 5, 4, 3, '#e8e2d0'); r(9, 6, 3, 1, '#334'); }
        break;
      }
      case 'B': {
        if (theme === 'museum') { // glasmonter
          floor();
          r(1, 3, 14, 12, '#4a3e32'); r(2, 2, 12, 8, 'rgba(170,210,230,0.55)'); r(2, 2, 12, 1, '#e8f4fa');
          r(5, 5, 6, 4, ['#c9a34a', '#8a5a2a', '#6a8a9a', '#a85a4a'][v & 3]); r(3, 3, 2, 1, '#ffffff');
          break;
        }
        furnBase();
        const wood = theme === 'basement' ? '#5d6066' : '#6a4a30';
        r(1, 0, 14, 14, wood); r(1, 0, 14, 1, SK.shade(wood, 1.25));
        const books = ['#8a2a2a', '#2a5a8a', '#3a7a3a', '#c9a34a', '#6a3a7a', '#ddd'];
        for (let row = 0; row < 3; row++) {
          r(2, 2 + row * 4, 12, 3, '#20160e');
          for (let b = 2; b < 14; b += 2) if (R() < 0.85) r(b, 2 + row * 4 + (R() < 0.3 ? 1 : 0), 2, 3, theme === 'basement' ? (R() < 0.5 ? '#6b5d48' : '#4a4a4a') : books[Math.floor(R() * books.length)]);
        }
        break;
      }
      case 'o': {
        furnBase();
        if (theme === 'basement' || theme === 'home') {
          r(2, 3, 12, 10, '#7a5e3a'); r(2, 3, 12, 2, '#8e7046'); r(2, 7, 12, 1, '#5e4628'); r(7, 3, 1, 10, '#5e4628');
        } else if (theme === 'yard') {
          for (let i = 0; i < 4; i++) { r(2 + i * 3, 4, 1, 9, '#9aa0a8'); } r(1, 4, 14, 1, '#b0b6be'); r(1, 12, 14, 1, '#7a8088');
        } else {
          r(1, 6, 14, 4, '#6b5a44'); r(1, 6, 14, 1, '#7f6c52'); r(2, 10, 2, 3, '#4a3e2e'); r(12, 10, 2, 3, '#4a3e2e');
        }
        break;
      }
      case 'p': {
        floor();
        if (theme === 'museum') { // dinosaurieben
          r(1, 13, 14, 3, '#5a4d42');
          x.strokeStyle = '#efe6d2'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(2, 9); x.quadraticCurveTo(8, 2, 14, 7); x.stroke();
          for (let i = 3; i < 13; i += 2) { x.beginPath(); x.moveTo(i, 8 - Math.sin(i / 3) * 2); x.lineTo(i, 12); x.stroke(); }
          break;
        }
        if (theme === 'yard') {
          r(6, 8, 4, 8, '#e8e4dc'); r(7, 10, 2, 1, '#333'); r(6, 13, 1, 1, '#333');
          x.fillStyle = '#3c5a2c'; x.beginPath(); x.arc(8, 6, 7, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#4c6e38'; x.beginPath(); x.arc(6, 4, 4, 0, Math.PI * 2); x.fill();
        } else if (theme === 'basement') {
          r(2, 1, 12, 14, '#5a5a5e'); r(2, 1, 12, 2, '#6e6e72'); r(5, 6, 6, 4, '#2a2a2a'); r(6, 7, 4, 2, '#7a2a1a');
        } else {
          r(5, 9, 6, 6, '#8a4a2a'); r(5, 9, 6, 1, '#a85a33');
          x.fillStyle = '#3c6a34'; x.beginPath(); x.arc(8, 6, 5, 0, Math.PI * 2); x.fill();
        }
        break;
      }
      case 'F': { // staket
        r(0, 0, TS, TS, '#3d5a32');
        for (let i = 0; i < 6; i++) r(Math.floor(R() * TS), Math.floor(R() * TS), 1, 2, '#33502a');
        r(0, 5, TS, 1, '#6f7a70'); r(0, 11, TS, 1, '#6f7a70');
        for (let xx = 1; xx < TS; xx += 5) r(xx, 2, 1, 13, '#8a958b');
        break;
      }
      case 'k': { // säng
        floor();
        r(1, 0, 14, 16, '#3a2a20'); r(2, 1, 12, 14, '#5a6a9a'); r(2, 1, 12, 4, '#e8e4dc'); r(2, 7, 12, 1, '#4a5a8a');
        break;
      }
      case 's': { // soffa / matta
        furnBase();
        r(1, 2, 14, 11, '#5a3a4a'); r(1, 2, 14, 4, '#6e4a5c'); r(1, 2, 2, 11, '#4a2e3c'); r(13, 2, 2, 11, '#4a2e3c');
        break;
      }
      case 'f': { // flaggstång
        floor();
        r(7, 0, 2, 16, '#d0d0d4'); r(5, 14, 6, 2, '#888');
        break;
      }
      case 'D': {
        floor();
        r(0, 0, 2, TS, 'rgba(0,0,0,0.35)'); r(14, 0, 2, TS, 'rgba(0,0,0,0.35)');
        break;
      }
      default:
        floor();
    }
    return c;
  }

  SK.tile = function (theme, ch, v) {
    const key = theme + ch + (v & 3);
    if (!cache[key]) cache[key] = makeTile(theme, ch, v & 3);
    return cache[key];
  };

  // väggens framsida syns när golvet ligger under väggen
  SK.wallFace = function (ctx, theme, x, y, ch) {
    const T = THEMES[theme];
    ctx.fillStyle = T.wallFace; ctx.fillRect(x, y + 6, TS, 10);
    ctx.fillStyle = T.base; ctx.fillRect(x, y + 14, TS, 2);
    if (theme === 'yard') {
      ctx.fillStyle = SK.shade(T.wallFace, 0.85);
      for (let yy = 7; yy < 14; yy += 3) ctx.fillRect(x, y + yy, TS, 1);
      for (let yy = 7, k = 0; yy < 14; yy += 3, k++) for (let xx = (k % 2) * 4; xx < TS; xx += 8) ctx.fillRect(x + xx, y + yy, 1, 3);
    }
    if (ch === 'w') {
      ctx.fillStyle = theme === 'home' ? '#0d1830' : '#6f8fb0'; ctx.fillRect(x + 3, y + 7, 10, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 4, y + 8, 3, 1);
      ctx.fillStyle = T.wallTop; ctx.fillRect(x + 7, y + 7, 1, 6);
    }
    if (theme === 'school' && ch === '#' && ((x / TS + y / TS) % 5 === 0)) {
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x + 4, y + 8, 7, 5); ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 5, y + 9, 5, 1);
    }
  };
})();
