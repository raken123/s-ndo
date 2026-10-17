// Bakgrunder till berättelsen. Varje scen ritas en gång till en cache
// och får sedan levande detaljer (flimmer, regn, ögon) varje bildruta.
(function () {
  'use strict';
  const SK = window.SK;
  const W = SK.W, H = SK.H;
  const cache = {};

  const R = (ctx) => (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  function grad(ctx, y0, y1, c0, c1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  }

  function text(ctx, s, x, y, size, color, align) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  function lockers(r, x0, x1, y0, y1, rnd, col) {
    for (let x = x0; x < x1; x += 16) {
      const c = col || (rnd() < 0.15 ? '#5b6f60' : '#4b6478');
      r(x, y0, 15, y1 - y0, c);
      r(x, y0, 15, 2, SK.shade(c, 1.2));
      for (let i = 0; i < 4; i++) r(x + 3, y0 + 6 + i * 3, 9, 1, 'rgba(0,0,0,0.3)');
      r(x + 11, y0 + (y1 - y0) / 2, 1, 4, '#c9c9c9');
      if (rnd() < 0.2) r(x + 4, y0 + 30, 5, 3, '#e8e2d0');
      r(x + 15, y0, 1, y1 - y0, '#1e2a33');
    }
  }

  function birch(r, ctx, x, y, h, rnd, night) {
    r(x, y - h, 4, h, night ? '#7a7a80' : '#e8e4dc');
    for (let i = 0; i < 6; i++) r(x + (rnd() < 0.5 ? 0 : 2), y - h + Math.floor(rnd() * h), 2, 1, '#222');
    const leaf = night ? ['#1a2418', '#222e1e'] : ['#c98a2a', '#d9a53a', '#b8661e'];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = leaf[Math.floor(rnd() * leaf.length)];
      ctx.fillRect(x - 12 + Math.floor(rnd() * 28), y - h - 14 + Math.floor(rnd() * 26), 3, 3);
    }
  }

  const SCENES = {
    svart: { floor: 140, draw(ctx) { R(ctx)(0, 0, W, H, '#000'); } },

    sovrum: {
      floor: 144,
      draw(ctx, v) {
        const r = R(ctx), rnd = SK.seeded(11);
        const night = v !== 'dag';
        r(0, 0, W, 140, night ? '#1b2136' : '#56678a');
        for (let x = 0; x < W; x += 12) r(x, 0, 1, 140, night ? '#1f263d' : '#5d6e92');
        r(0, 140, W, 40, night ? '#2e2119' : '#5a3e2a');
        for (let y = 146; y < H; y += 7) r(0, y, W, 1, night ? '#251a13' : '#4a3222');
        r(0, 138, W, 3, night ? '#121626' : '#3a4560');
        // fönster
        r(196, 26, 70, 70, '#cfc7b8');
        r(200, 30, 62, 62, night ? '#081028' : '#9cc3e6');
        if (night) {
          for (let i = 0; i < 18; i++) r(200 + Math.floor(rnd() * 62), 30 + Math.floor(rnd() * 40), 1, 1, '#c8d0ff');
          ctx.fillStyle = '#e9e5c8'; ctx.beginPath(); ctx.arc(244, 46, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#081028'; ctx.beginPath(); ctx.arc(248, 43, 7, 0, Math.PI * 2); ctx.fill();
          r(200, 80, 62, 12, '#060a18');
          for (let x = 200; x < 262; x += 9) r(x, 74 + Math.floor(rnd() * 6), 6, 18, '#0b1124');
        }
        r(229, 30, 3, 62, '#cfc7b8'); r(200, 59, 62, 3, '#cfc7b8');
        r(186, 20, 12, 84, night ? '#3e2232' : '#8a4a5e'); r(264, 20, 12, 84, night ? '#3e2232' : '#8a4a5e');
        r(184, 18, 94, 3, '#555');
        // säng
        r(16, 112, 110, 38, '#3e2a1e'); r(18, 108, 106, 10, '#e8e4dc'); r(20, 116, 102, 24, night ? '#2f3d68' : '#4a5e9a');
        r(20, 116, 102, 2, night ? '#3e4e80' : '#6070b0'); r(22, 106, 26, 10, '#f2efe6'); r(12, 92, 6, 58, '#3e2a1e');
        // affischer
        r(40, 36, 30, 40, night ? '#2a2a3a' : '#e8e2d0');
        r(46, 44, 4, 20, night ? '#7a2a2a' : '#c0392b'); r(44, 60, 8, 6, night ? '#555' : '#888'); r(47, 66, 2, 4, '#e8a04a');
        for (let i = 0; i < 8; i++) r(41 + Math.floor(rnd() * 28), 38 + Math.floor(rnd() * 36), 1, 1, '#fff');
        r(84, 46, 36, 26, night ? '#26322a' : '#3a7a4a');
        text(ctx, 'KASPER', 86, 56, 7, night ? '#4a5a4a' : '#e8e2d0');
        // skrivbord
        r(272, 112, 46, 4, '#6a4a30'); r(274, 116, 4, 34, '#5a3e28'); r(312, 116, 4, 34, '#5a3e28');
        r(290, 96, 2, 16, '#888'); r(284, 92, 14, 5, '#3a3a3a');
        r(300, 108, 8, 4, '#222'); // mobilen
        // hylla
        r(130, 60, 44, 3, '#6a4a30');
        const bc = ['#8a2a2a', '#2a5a8a', '#3a7a3a', '#c9a34a', '#6a3a7a'];
        for (let x = 132; x < 172; x += 4) r(x, 48 + Math.floor(rnd() * 4), 3, 12, night ? SK.shade(bc[Math.floor(rnd() * 5)], 0.5) : bc[Math.floor(rnd() * 5)]);
      },
      anim(ctx, t, v, st) {
        const night = v !== 'dag';
        if (night) {
          // månljus på golvet
          ctx.fillStyle = 'rgba(150,170,255,0.06)';
          ctx.beginPath(); ctx.moveTo(200, 92); ctx.lineTo(262, 92); ctx.lineTo(240, 180); ctx.lineTo(150, 180); ctx.fill();
          // trädet utanför vajar
          ctx.strokeStyle = '#04070f'; ctx.lineWidth = 2;
          const sw = Math.sin(t * 0.8) * 3;
          ctx.beginPath(); ctx.moveTo(258, 92); ctx.quadraticCurveTo(250 + sw, 70, 236 + sw * 1.5, 52); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(248 + sw, 72); ctx.lineTo(262, 62 + sw); ctx.stroke();
        }
      },
      post(ctx, t, v, st) {
        if (v !== 'dag') { ctx.fillStyle = 'rgba(4,6,20,0.28)'; ctx.fillRect(0, 0, W, H); }
        if (st.phone) {
          const a = 0.5 + Math.sin(t * 6) * 0.3;
          SK.glowDot(ctx, 304, 109, 22, 'rgba(212,242,90,0.5)', a);
          ctx.fillStyle = SK.EYE; ctx.fillRect(301, 108, 6, 2);
        }
        if (st.eyes) SK.drawEyes(ctx, [[226, 70], [234, 70]], 0.6 + Math.sin(t * 2) * 0.3);
      },
    },

    korridor: {
      floor: 140,
      draw(ctx, v) {
        const r = R(ctx), rnd = SK.seeded(5);
        r(0, 0, W, 16, '#9b9078');
        r(0, 16, W, 120, '#cbbf9e');
        r(0, 96, W, 40, '#a59878');
        r(0, 136, W, 44, '#7d7766');
        for (let x = -40; x < W + 40; x += 28) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath(); ctx.moveTo(x, 136); ctx.lineTo(x + 6, 136); ctx.lineTo(x + 30 + (x - 160) * 0.4, 180); ctx.lineTo(x + 22 + (x - 160) * 0.4, 180); ctx.fill(); }
        r(0, 134, W, 3, '#6d6250');
        for (let x = 20; x < W; x += 80) r(x, 6, 40, 4, '#e8eef0');
        lockers(r, 0, 128, 64, 134, rnd);
        // dörr till klassrum
        r(140, 50, 36, 84, '#5e4430'); r(143, 53, 30, 81, '#7a5a3a'); r(150, 62, 16, 20, '#9cc3d6'); r(166, 94, 4, 3, '#c9c9c9');
        text(ctx, '6B', 152, 86, 7, '#e8e2d0');
        // affisch
        r(188, 22, 56, 34, '#e8e2d0'); r(188, 22, 56, 7, '#2a7a4a');
        text(ctx, 'VI ÄR EN', 193, 31, 6, '#333');
        text(ctx, 'MOBBFRI', 193, 38, 7, '#2a7a4a');
        text(ctx, 'SKOLA!', 193, 46, 7, '#2a7a4a');
        r(234, 46, 6, 6, '#e8b04a');
        lockers(r, 192, W, 64, 134, rnd);
        // klocka
        ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(270, 32, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(270, 32, 9, 0, Math.PI * 2); ctx.stroke();
        r(270, 25, 1, 7, '#222'); r(270, 32, 5, 1, '#222');
        r(130, 120, 6, 14, '#555'); // papperskorg
        if (v === 'natt' || v === 'rod') {
          r(296, 20, 22, 9, '#0d3a1e'); text(ctx, 'NÖD', 299, 21, 6, '#4aff8a');
        }
      },
      anim(ctx, t, v, st) {
        // lysrör
        for (let i = 0, x = 20; x < W; x += 80, i++) {
          const fl = (v === 'natt' || v === 'rod') ? 0 : (i === 2 && Math.sin(t * 23) > 0.6 ? 0.2 : 1);
          ctx.fillStyle = 'rgba(255,255,240,' + 0.08 * fl + ')';
          ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 40, 10); ctx.lineTo(x + 70, 136); ctx.lineTo(x - 30, 136); ctx.fill();
        }
      },
      post(ctx, t, v, st) {
        if (v === 'natt') { ctx.fillStyle = 'rgba(5,8,20,0.72)'; ctx.fillRect(0, 0, W, H); SK.glowDot(ctx, 307, 24, 22, 'rgba(60,255,120,0.4)', 1); }
        if (v === 'rod') { ctx.fillStyle = 'rgba(40,0,0,0.55)'; ctx.fillRect(0, 0, W, H); }
        if (st.eyes) SK.drawEyes(ctx, [[156, 70], [162, 70]], 0.7);
      },
    },

    skolgard: {
      floor: 140,
      draw(ctx, v) {
        const r = R(ctx), rnd = SK.seeded(21);
        const night = v === 'natt' || v === 'kvall';
        grad(ctx, 0, 60, night ? '#05070f' : '#8e98a4', night ? '#141a2a' : '#c4c9cf');
        // skolhuset
        r(20, 24, 280, 110, night ? '#3a1c16' : '#7a3a2e');
        for (let y = 27; y < 134; y += 4) r(20, y, 280, 1, night ? '#2e1510' : '#6a3026');
        r(16, 20, 288, 6, night ? '#1a1a1e' : '#3a3a40');
        for (let row = 0; row < 2; row++) for (let x = 34; x < 290; x += 26) {
          if (x > 136 && x < 184) continue;
          r(x, 34 + row * 40, 16, 22, night ? '#0b0f1a' : '#7c93a8');
          r(x, 34 + row * 40, 16, 2, '#e8e4dc'); r(x + 7, 34 + row * 40, 2, 22, '#e8e4dc');
          if (!night) r(x + 2, 38 + row * 40, 4, 2, 'rgba(255,255,255,0.4)');
        }
        r(142, 74, 36, 60, night ? '#1e140e' : '#4a3020'); r(144, 76, 15, 58, night ? '#2a1e14' : '#6a4a30'); r(161, 76, 15, 58, night ? '#2a1e14' : '#6a4a30');
        r(132, 60, 56, 10, night ? '#2a2a2e' : '#e8e2d0'); text(ctx, 'NORRSKOLAN', 135, 61, 7, night ? '#555' : '#333');
        // asfalt
        r(0, 134, W, 46, night ? '#232327' : '#5a5a5e');
        for (let i = 0; i < 80; i++) r(Math.floor(rnd() * W), 134 + Math.floor(rnd() * 46), 1, 1, night ? '#1b1b1f' : '#4e4e52');
        // hage
        const lc = night ? '#4a4a50' : '#e8e4dc';
        for (let i = 0; i < 4; i++) { r(200 + i * 12, 150, 11, 1, lc); r(200 + i * 12, 160, 11, 1, lc); r(200 + i * 12, 150, 1, 10, lc); }
        text(ctx, '1 2 3 4', 203, 152, 6, lc);
        // flaggstång
        r(70, 20, 2, 140, '#d0d0d4'); r(66, 158, 10, 3, '#888');
        // cykelställ
        for (let i = 0; i < 6; i++) r(250 + i * 8, 140, 1, 14, '#9aa0a8');
        r(248, 140, 50, 1, '#b0b6be');
        birch(r, ctx, 6, 168, 60, rnd, night);
        birch(r, ctx, 300, 172, 70, rnd, night);
      },
      anim(ctx, t, v, st) {
        const night = v === 'natt' || v === 'kvall';
        if (!night) {
          // flaggan
          const fx = 72;
          for (let i = 0; i < 18; i++) {
            const yo = Math.round(Math.sin(t * 4 + i * 0.5) * 1.2);
            const col = (i >= 5 && i <= 7) ? '#f2c230' : '#2a5ab0';
            ctx.fillStyle = col; ctx.fillRect(fx + i, 22 + yo, 1, 12);
            ctx.fillStyle = '#f2c230'; ctx.fillRect(fx + i, 27 + yo, 1, 2);
          }
          // löv som faller
          for (let i = 0; i < 6; i++) {
            const lx = (i * 61 + t * 12) % W, ly = (i * 37 + t * 20) % 180;
            ctx.fillStyle = i % 2 ? '#c98a2a' : '#b8661e';
            ctx.fillRect(Math.round(lx + Math.sin(t * 2 + i) * 6), Math.round(ly), 2, 2);
          }
        } else {
          SK.glowDot(ctx, 270, 46, 26, 'rgba(255,220,150,0.25)', 1);
        }
        if (st.eyes) SK.drawEyes(ctx, [[221, 44], [227, 44]], 0.8);
        if (st.phones) for (let x = 34; x < 290; x += 26) if (x < 136 || x > 184) SK.glowDot(ctx, x + 8, 45, 9, 'rgba(212,242,90,0.5)', 0.6 + Math.sin(t * 3 + x) * 0.3);
      },
    },

    klassrum: {
      floor: 138,
      draw(ctx, v) {
        const r = R(ctx);
        r(0, 0, W, 132, '#d6ceb4'); r(0, 132, W, 48, '#6a7280');
        r(0, 128, W, 4, '#8a7a5a');
        r(30, 24, 170, 70, '#9a9a9a'); r(33, 27, 164, 64, '#f2f2ee');
        text(ctx, 'Läxa: läs kap. 4', 40, 34, 7, '#2a4a9a');
        text(ctx, 'Prov fredag!!', 40, 46, 7, '#b03030');
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(140, 70); ctx.lineTo(170, 50); ctx.lineTo(185, 75); ctx.stroke();
        r(30, 94, 170, 3, '#777');
        for (let i = 0; i < 2; i++) { r(222 + i * 46, 22, 36, 60, '#e8e4dc'); r(225 + i * 46, 25, 30, 54, v === 'kvall' ? '#2a2a4a' : '#9cc3e6'); r(239 + i * 46, 25, 2, 54, '#e8e4dc'); }
        ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(14, 30, 8, 0, Math.PI * 2); ctx.fill();
        r(14, 24, 1, 6, '#222'); r(14, 30, 4, 1, '#222');
        r(206, 100, 40, 28, '#8b6a45');
        for (let x = 10; x < W; x += 74) { r(x, 150, 56, 6, '#a07a4e'); r(x + 4, 156, 3, 24, '#444'); r(x + 48, 156, 3, 24, '#444'); }
      },
      post(ctx, t, v, st) {
        if (v === 'kvall') { ctx.fillStyle = 'rgba(10,12,30,0.45)'; ctx.fillRect(0, 0, W, H); }
        if (st.eyes) SK.drawEyes(ctx, [[150, 58], [160, 58]], 0.6 + Math.sin(t * 5) * 0.2);
      },
    },

    bibliotek: {
      floor: 144,
      draw(ctx) {
        const r = R(ctx), rnd = SK.seeded(77);
        r(0, 0, W, H, '#2a1e18');
        r(0, 140, W, 40, '#4a2e2a');
        for (let y = 146; y < H; y += 8) r(0, y, W, 1, '#3e2622');
        const bc = ['#7a2424', '#24507a', '#2e6a2e', '#b8923e', '#5e2e6e', '#c9c0a8', '#8a5a2a'];
        const shelf = (x0, x1) => {
          r(x0, 14, x1 - x0, 126, '#4a3020');
          for (let y = 20; y < 136; y += 20) {
            r(x0 + 3, y, x1 - x0 - 6, 16, '#1e140c');
            for (let x = x0 + 4; x < x1 - 5; x += 3) if (rnd() < 0.9) r(x, y + 3 + Math.floor(rnd() * 3), 3, 13 - Math.floor(rnd() * 3), bc[Math.floor(rnd() * bc.length)]);
            r(x0, y + 16, x1 - x0, 3, '#5a3e28');
          }
        };
        shelf(0, 96); shelf(224, W);
        r(110, 20, 100, 70, '#14182a'); r(114, 24, 92, 62, '#24304a'); r(159, 24, 2, 62, '#14182a'); r(114, 54, 92, 2, '#14182a');
        r(118, 118, 84, 6, '#6a4a30'); r(124, 124, 4, 30, '#4a3020'); r(192, 124, 4, 30, '#4a3020');
        r(150, 104, 3, 14, '#888'); r(144, 100, 16, 5, '#2e5a3a');
        text(ctx, 'TYST, TACK', 124, 8, 6, '#8a7a5a');
      },
      anim(ctx, t, v, st) {
        SK.glowDot(ctx, 152, 108, 40, 'rgba(255,200,120,0.3)', 1);
        // regn på rutan
        ctx.fillStyle = 'rgba(160,190,230,0.35)';
        for (let i = 0; i < 14; i++) {
          const x = 115 + ((i * 37) % 90), y = 25 + ((t * 40 + i * 23) % 60);
          ctx.fillRect(x, y, 1, 3);
        }
        if (st.eyes) SK.drawEyes(ctx, [[180, 40], [188, 40]], 0.7);
      },
    },

    gympasal: {
      floor: 138,
      draw(ctx, v) {
        const r = R(ctx);
        r(0, 0, W, 130, '#8e9aa6'); r(0, 0, W, 10, '#6e7a86');
        for (let x = 40; x < W; x += 60) { r(x, 14, 30, 16, '#c8d8e8'); r(x + 14, 14, 2, 16, '#6e7a86'); }
        // ribbstolar
        for (let k = 0; k < 3; k++) {
          const x0 = 16 + k * 34;
          r(x0, 40, 3, 92, '#8b6a45'); r(x0 + 27, 40, 3, 92, '#8b6a45');
          for (let y = 44; y < 130; y += 7) r(x0, y, 30, 2, '#a07a4e');
        }
        // basketkorg
        r(236, 40, 40, 28, '#f2f2ee'); r(250, 52, 12, 10, 'rgba(0,0,0,0)');
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1; ctx.strokeRect(250.5, 52.5, 12, 10);
        r(248, 66, 16, 2, '#e05a1a');
        for (let i = 0; i < 4; i++) r(249 + i * 4, 68, 1, 8, '#ddd');
        r(0, 130, W, 50, '#b0854f');
        for (let y = 134; y < H; y += 6) r(0, y, W, 1, '#9b7444');
        ctx.strokeStyle = '#e8e4dc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(160, 160, 50, 10, 0, 0, Math.PI * 2); ctx.stroke();
        r(150, 90, 30, 40, '#4a5a6a'); r(153, 93, 24, 37, '#5a6a7a'); text(ctx, 'OMKL.', 153, 82, 6, '#333');
        r(196, 116, 36, 14, '#2a4a8a'); r(196, 116, 36, 3, '#3a5aa0');
      },
      post(ctx, t, v, st) {
        if (v === 'kvall') { ctx.fillStyle = 'rgba(8,10,25,0.6)'; ctx.fillRect(0, 0, W, H); SK.glowDot(ctx, 165, 84, 20, 'rgba(60,255,120,0.3)', 1); }
        if (st.eyes) SK.drawEyes(ctx, [[162, 104], [168, 104]], 0.8);
      },
    },

    kallare: {
      floor: 142,
      draw(ctx) {
        const r = R(ctx), rnd = SK.seeded(9);
        r(0, 0, W, 140, '#2c2c2f');
        for (let i = 0; i < 300; i++) r(Math.floor(rnd() * W), Math.floor(rnd() * 140), 2, 1, rnd() < 0.5 ? '#262629' : '#333337');
        r(0, 20, W, 5, '#4a3a2a'); r(0, 20, W, 1, '#5e4a36'); r(0, 32, W, 3, '#5a5a5e');
        for (let x = 30; x < W; x += 70) r(x, 18, 4, 9, '#3a2a1a');
        r(0, 140, W, 40, '#3e3e3c');
        for (let i = 0; i < 120; i++) r(Math.floor(rnd() * W), 140 + Math.floor(rnd() * 40), 1, 1, '#333331');
        ctx.fillStyle = 'rgba(20,30,40,0.5)'; ctx.beginPath(); ctx.ellipse(90, 168, 30, 4, 0, 0, Math.PI * 2); ctx.fill();
        // dörren
        r(200, 56, 52, 84, '#1e2226'); r(204, 60, 44, 80, '#4a5560'); r(204, 60, 44, 2, '#5d6a76');
        r(240, 98, 4, 6, '#aaa');
        r(208, 70, 36, 18, '#e8e2d0');
        text(ctx, 'DATASAL 3', 210, 72, 6, '#b03030');
        text(ctx, 'OBEHÖRIG', 211, 80, 5, '#333');
        r(256, 92, 12, 16, '#222'); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r(258 + i * 3, 94 + j * 4, 2, 3, '#555');
        // lådor
        r(20, 110, 40, 30, '#6a5236'); r(20, 110, 40, 3, '#7e6444'); r(30, 90, 26, 20, '#5e482e');
        r(280, 100, 34, 40, '#3a3a3e'); r(280, 100, 34, 3, '#4a4a4e');
      },
      anim(ctx, t, v, st) {
        const sw = Math.sin(t * 1.3) * 6;
        const on = Math.sin(t * 17) > -0.85 || Math.sin(t * 3) > 0;
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(140, 0); ctx.lineTo(140 + sw, 40); ctx.stroke();
        ctx.fillStyle = on ? '#ffe9a8' : '#444'; ctx.fillRect(138 + sw, 40, 4, 5);
      },
      post(ctx, t, v, st) {
        const sw = Math.sin(t * 1.3) * 6;
        const on = Math.sin(t * 17) > -0.85 || Math.sin(t * 3) > 0;
        ctx.fillStyle = 'rgba(0,0,0,' + (on ? 0.45 : 0.85) + ')'; ctx.fillRect(0, 0, W, H);
        if (on) SK.glowDot(ctx, 140 + sw, 44, 90, 'rgba(255,220,140,0.28)', 1);
        if (st.keypad) SK.glowDot(ctx, 262, 100, 10, 'rgba(212,242,90,0.5)', 1);
        if (st.eyes) SK.drawEyes(ctx, [[34, 118], [41, 118]], 0.9);
      },
    },

    datasal: {
      floor: 140,
      draw(ctx) {
        const r = R(ctx), rnd = SK.seeded(3);
        r(0, 0, W, 136, '#22262a'); r(0, 136, W, 44, '#34383c');
        for (let i = 0; i < 6; i++) {
          const x = 14 + i * 50;
          r(x - 4, 112, 48, 4, '#6a6a60'); r(x, 116, 3, 30, '#444'); r(x + 37, 116, 3, 30, '#444');
          r(x + 4, 82, 32, 28, '#c8c0a8'); r(x + 7, 85, 26, 20, '#101410'); r(x + 12, 110, 16, 3, '#b0a890');
          if (i !== 3) for (let k = 0; k < 4; k++) r(x + 9, 87 + k * 4, Math.floor(rnd() * 18) + 2, 1, '#1e2a1e');
        }
        r(30, 30, 40, 26, '#e8e2d0'); text(ctx, 'IT-KLUBBEN', 32, 34, 5, '#333'); text(ctx, '1998', 40, 44, 8, '#b03030');
        for (let i = 0; i < 8; i++) { ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.moveTo(i * 40, 146); ctx.quadraticCurveTo(i * 40 + 20, 176, i * 40 + 44, 150); ctx.stroke(); }
      },
      post(ctx, t, v, st) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        const x = 14 + 3 * 50;
        SK.glowDot(ctx, x + 20, 95, 60, 'rgba(160,220,60,0.35)', 0.8 + Math.sin(t * 9) * 0.1);
        ctx.fillStyle = '#0c1a06'; ctx.fillRect(x + 7, 85, 26, 20);
        SK.drawLogoEye(ctx, x + 20, 95, 8, st.closed ? 0.1 : 0.7 + Math.sin(t * 2) * 0.2, t);
      },
    },

    aula: {
      floor: 106,
      draw(ctx, v) {
        const r = R(ctx);
        r(0, 0, W, H, '#140c0e');
        r(40, 6, 240, 96, '#0a0608');
        for (let x = 0; x < 44; x += 4) r(x, 0, 4, 112, x % 8 ? '#5a1418' : '#6e1a1e');
        for (let x = 276; x < W; x += 4) r(x, 0, 4, 112, x % 8 ? '#5a1418' : '#6e1a1e');
        r(0, 0, W, 6, '#4a1014');
        r(70, 12, 180, 70, '#1a1c22');
        r(24, 100, 272, 12, '#3a2418'); r(24, 100, 272, 2, '#4e3222');
        r(0, 112, W, 68, '#0c080a');
      },
      anim(ctx, t, v, st) {
        // duken
        if (st.screen === 'eye') {
          ctx.fillStyle = '#080a02'; ctx.fillRect(72, 14, 176, 66);
          SK.drawLogoEye(ctx, 160, 46, 44, 0.85 + Math.sin(t * 1.5) * 0.1, t);
        } else if (st.screen === 'static') {
          for (let i = 0; i < 260; i++) { const g = Math.floor(Math.random() * 200); ctx.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')'; ctx.fillRect(72 + Math.floor(Math.random() * 174), 14 + Math.floor(Math.random() * 64), 3, 2); }
        } else if (st.screen === 'disco') {
          ctx.fillStyle = '#16122a'; ctx.fillRect(72, 14, 176, 66);
          ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffd4f0';
          ctx.fillText('HÖSTDISCO', 160, 46);
        } else if (st.screen === 'white') {
          ctx.fillStyle = '#e8e4dc'; ctx.fillRect(72, 14, 176, 66);
        }
        if (v === 'disco' || st.screen === 'disco') {
          const cols = ['rgba(255,60,160,0.16)', 'rgba(60,160,255,0.16)', 'rgba(255,220,60,0.14)'];
          cols.forEach((c, i) => {
            const x = 160 + Math.sin(t * (0.8 + i * 0.3) + i * 2) * 120;
            ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(160, 0); ctx.lineTo(x - 26, 180); ctx.lineTo(x + 26, 180); ctx.fill();
          });
        }
      },
      post(ctx, t, v, st) {
        // publiken framför scenen
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 18; i++) {
            const x = 6 + i * 18 + (row % 2) * 9, y = 122 + row * 14;
            const bob = st.crowd === 'dance' ? Math.round(Math.sin(t * 6 + i + row) * 1.5) : 0;
            ctx.fillStyle = row === 0 ? '#0b080e' : '#07050a'; ctx.beginPath(); ctx.arc(x, y + bob, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(x - 8, y + 4 + bob, 16, 24);
            if (st.phones) SK.glowDot(ctx, x + 2, y + 7, 7, 'rgba(212,242,90,0.6)', 0.75);
            if (st.lights && ((i * 7 + row * 3) % 10) < st.lights) SK.glowDot(ctx, x, y - 7, 9, 'rgba(255,240,200,0.7)', 0.8);
          }
        }
      },
    },

    kok: {
      floor: 142,
      draw(ctx, v) {
        const r = R(ctx);
        r(0, 0, W, 136, '#3a4a40'); r(0, 136, W, 44, '#5a5048');
        for (let x = 0; x < W; x += 10) for (let y = 136; y < H; y += 10) if ((x + y) % 20 === 0) r(x, y, 10, 10, '#4e4640');
        r(0, 92, 150, 44, '#c8c0b0'); r(0, 88, 150, 4, '#e8e4dc'); r(4, 96, 28, 36, '#b0a898'); r(36, 96, 28, 36, '#b0a898');
        r(80, 70, 30, 18, '#888'); r(96, 60, 3, 12, '#aaa');
        r(170, 30, 42, 106, '#e8e8e4'); r(170, 72, 42, 2, '#bbb'); r(206, 40, 2, 20, '#999'); r(206, 80, 2, 30, '#999');
        r(180, 44, 14, 12, '#f2d84a'); // lappen från mamma
        r(184, 48, 6, 1, '#555'); r(184, 51, 8, 1, '#555');
        r(232, 26, 60, 46, '#d8d0c0'); r(236, 30, 52, 38, v === 'dag' ? '#9cc3e6' : '#0a1024'); r(261, 30, 2, 38, '#d8d0c0');
        r(220, 120, 80, 5, '#6a4a30'); r(226, 125, 4, 30, '#4a3020'); r(290, 125, 4, 30, '#4a3020');
      },
      post(ctx, t, v, st) {
        if (v !== 'dag') { ctx.fillStyle = 'rgba(5,8,20,0.5)'; ctx.fillRect(0, 0, W, H); SK.glowDot(ctx, 150, 0, 80, 'rgba(255,220,160,0.18)', 1); }
        if (st.eyes) SK.drawEyes(ctx, [[256, 48], [264, 48]], 0.8);
      },
    },

    gata: {
      floor: 140,
      draw(ctx) {
        const r = R(ctx), rnd = SK.seeded(44);
        grad(ctx, 0, 110, '#03050c', '#121828');
        for (let i = 0; i < 9; i++) { const x = i * 40 - 10, h = 30 + Math.floor(rnd() * 40); r(x, 110 - h, 36, h, '#0a0d16'); if (rnd() < 0.6) r(x + 8 + Math.floor(rnd() * 18), 110 - h + 10, 5, 5, '#e8c070'); }
        r(0, 110, W, 70, '#18181c');
        r(0, 140, W, 2, '#3a3a40');
        for (let x = 0; x < W; x += 30) r(x, 158, 16, 2, '#6a6a5a');
        r(200, 70, 80, 4, '#3a4a5a'); r(202, 74, 2, 66, '#555'); r(276, 74, 2, 66, '#555');
        r(206, 78, 66, 40, 'rgba(120,160,200,0.18)');
        r(250, 82, 20, 10, '#e8c04a'); text(ctx, 'BUSS', 251, 84, 6, '#222');
        r(70, 40, 3, 100, '#3a3a40'); r(70, 38, 20, 3, '#3a3a40'); r(84, 41, 10, 3, '#888');
      },
      anim(ctx, t) {
        ctx.fillStyle = 'rgba(255,220,150,0.1)';
        ctx.beginPath(); ctx.moveTo(84, 44); ctx.lineTo(94, 44); ctx.lineTo(130, 170); ctx.lineTo(50, 170); ctx.fill();
        SK.glowDot(ctx, 89, 44, 14, 'rgba(255,220,150,0.6)', 1);
      },
      post(ctx, t) {
        ctx.fillStyle = 'rgba(170,190,230,0.35)';
        for (let i = 0; i < 70; i++) {
          const x = (i * 47 + t * 30) % W, y = (i * 29 + t * 230) % H;
          ctx.fillRect(Math.round(x), Math.round(y), 1, 4);
        }
      },
    },
  };
  SK.SCENES = SCENES;

  SK.drawScene = function (ctx, name, v, t, st) {
    const S = SCENES[name] || SCENES.svart;
    const key = name + ':' + (v || '');
    if (!cache[key]) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      S.draw(c.getContext('2d'), v || '');
      cache[key] = c;
    }
    ctx.drawImage(cache[key], 0, 0);
    if (S.anim) S.anim(ctx, t, v || '', st || {});
  };
  SK.drawScenePost = function (ctx, name, v, t, st) {
    const S = SCENES[name];
    if (S && S.post) S.post(ctx, t, v || '', st || {});
  };
  SK.sceneFloor = (name) => (SCENES[name] || SCENES.svart).floor;

  // brus och vinjett läggs över allt
  const grain = [];
  let vignette = null;
  SK.postFX = function (ctx, t, strength) {
    if (!grain.length) {
      for (let k = 0; k < 4; k++) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); const img = x.createImageData(W, H);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 255;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = Math.random() < 0.5 ? 18 : 0;
        }
        x.putImageData(img, 0, 0); grain.push(c);
      }
      vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
      const vx = vignette.getContext('2d');
      const g = vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
      vx.fillStyle = g; vx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = strength == null ? 1 : strength;
    ctx.drawImage(grain[((Math.floor(t * 24) % 4) + 4) % 4], 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette, 0, 0);
  };
})();
