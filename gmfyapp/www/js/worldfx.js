/* gmfy — world effects layer:
 *   sculpting   raise / lower the ground with a brush
 *   weather     rain, snow, fog, wind (wind pushes the player)
 *   daylight    a real sun arc: dawn -> noon -> dusk -> night
 *   ghost       race a translucent replay of your best run
 *   photo       freeze the frame and save a PNG
 * Wraps Engine.render so the base renderer stays untouched.
 */
(function (global) {
  'use strict';

  var N = 15;

  var FX = {
    weather: 'clear',          // clear | rain | snow | fog
    wind: 0,                   // -3..3, pushes the player on x
    time: 0.5,                 // 0 midnight, 0.25 dawn, 0.5 noon, 0.75 dusk
    ghost: null,               // [{t,x,z}] being replayed
    ghostT: 0,
    showGhost: true,
    _p: null
  };

  /* ---------------- sculpting ---------------- */
  function sculpt(world, x, z, radius, delta) {
    var SPAN = global.Gmfy.SPAN;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var wx = (i / (N - 1) - 0.5) * SPAN;
        var wz = (j / (N - 1) - 0.5) * SPAN;
        var d2 = (wx - x) * (wx - x) + (wz - z) * (wz - z);
        var f = Math.exp(-d2 / (2 * radius * radius));
        if (f < 0.01) continue;
        world.h[i][j] -= delta * f;            // -y is up
      }
    }
  }

  /* ---------------- daylight ---------------- */
  function sunElev(time) {
    return Math.sin((time - 0.25) * Math.PI * 2);   // -1 midnight .. 1 noon
  }

  function light(time) {
    var e = sunElev(time);
    var day = Math.max(0, e);
    return {
      elev: e,
      bright: 0.20 + 0.80 * day,
      warm: Math.max(0, 1 - Math.abs(e) * 2.4),      // orange near the horizon
      night: Math.max(0, -e)
    };
  }

  function label(time) {
    var e = sunElev(time);
    if (e > 0.72) return 'noon';
    if (e > 0.15) return time < 0.5 ? 'morning' : 'afternoon';
    if (e > -0.34) return time < 0.5 ? 'dawn' : 'dusk';
    return 'night';
  }

  /* ---------------- weather particles ---------------- */
  function particles(n) {
    if (FX._p && FX._p.length === n) return FX._p;
    var p = [];
    for (var i = 0; i < n; i++) {
      p.push({ x: Math.random(), y: Math.random(),
               s: 0.5 + Math.random(), r: Math.random() });
    }
    FX._p = p;
    return p;
  }

  function drawWeather(ctx, w, h, dt) {
    var kind = FX.weather;
    if (kind === 'clear') return;

    if (kind === 'fog') {
      var g = ctx.createLinearGradient(0, h * 0.18, 0, h);
      g.addColorStop(0, 'rgba(210,220,230,0.06)');
      g.addColorStop(0.45, 'rgba(210,220,230,0.34)');
      g.addColorStop(1, 'rgba(210,220,230,0.14)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    var rain = (kind === 'rain');
    var ps = particles(rain ? 150 : 110);
    ctx.save();
    ctx.strokeStyle = rain ? 'rgba(190,214,255,0.55)' : 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = rain ? 2 : 1;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      p.y += dt * (rain ? 1.25 : 0.22) * p.s;
      p.x += dt * (rain ? 0.05 : 0.06) * FX.wind * p.s
           + (rain ? 0 : Math.sin(p.y * 8 + p.r * 6) * dt * 0.02);
      if (p.y > 1) { p.y -= 1; p.x = Math.random(); }
      if (p.x > 1) p.x -= 1; if (p.x < 0) p.x += 1;
      var X = p.x * w, Y = p.y * h;
      if (rain) {
        ctx.beginPath();
        ctx.moveTo(X, Y);
        ctx.lineTo(X + FX.wind * 4, Y + 16 * p.s);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(X, Y, 1.6 + p.s * 1.6, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------------- ghost ---------------- */
  function ghostAt(track, t) {
    if (!track || !track.length) return null;
    if (t <= track[0].t) return track[0];
    for (var i = 1; i < track.length; i++) {
      if (track[i].t >= t) {
        var a = track[i - 1], b = track[i];
        var f = (t - a.t) / Math.max(0.001, b.t - a.t);
        return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
      }
    }
    return track[track.length - 1];
  }

  function drawGhost(eng, ctx) {
    if (!FX.showGhost || !FX.ghost) return;
    var g = ghostAt(FX.ghost, FX.ghostT);
    if (!g) return;
    var base = global.Gmfy.heightAt(eng.world, g.x, g.z);
    var p = eng.project(g.x, base, g.z);
    var top = eng.project(g.x, base - 2.1, g.z);
    if (!p || !top) return;
    var wpx = Math.max(6, (eng.f * 0.55) / p.z);
    ctx.save();
    ctx.globalAlpha = 0.5;
    var grad = ctx.createLinearGradient(0, top.y, 0, p.y);
    grad.addColorStop(0, 'rgba(140,220,255,0.95)');
    grad.addColorStop(1, 'rgba(90,150,255,0.15)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(p.x - wpx, top.y, wpx * 2, p.y - top.y, wpx);
    else ctx.rect(p.x - wpx, top.y, wpx * 2, p.y - top.y);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#bfe9ff';
    ctx.font = 'bold 12px -apple-system,Roboto,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ghost', p.x, top.y - 8);
    ctx.restore();
  }

  /* ---------------- wrap the renderer ---------------- */
  function install() {
    var E = global.Gmfy.Engine;
    if (!E || E.prototype.__fx) return;
    var base = E.prototype.render;

    E.prototype.render = function () {
      base.call(this);
      var ctx = this.ctx, w = this.w, h = this.h;
      var L = light(FX.time);
      var dt = 1 / 60;

      // sun / moon high in the sky
      var up = Math.max(0, L.elev);
      var sx = w * (0.16 + 0.68 * ((FX.time - 0.25 + 1) % 1));
      var sy = h * (0.42 - 0.30 * up);
      if (sy < h * 0.55) {
        var r = w * (L.night > 0.2 ? 0.045 : 0.062);
        var gg = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 3.4);
        var core = L.night > 0.2 ? 'rgba(226,236,255,0.95)'
                                 : 'rgba(255,' + Math.round(238 - L.warm * 70) + ',' +
                                   Math.round(190 - L.warm * 120) + ',0.98)';
        gg.addColorStop(0, core);
        gg.addColorStop(0.24, 'rgba(255,240,200,0.35)');
        gg.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(sx, sy, r * 3.4, 0, 6.283); ctx.fill();
      }

      // time-of-day grade
      if (L.bright < 0.99) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        var b = Math.round(255 * L.bright);
        var rr = Math.min(255, Math.round(b * (1 + L.warm * 0.35)));
        var gg2 = Math.round(b * (1 - L.night * 0.10 + L.warm * 0.06));
        var bb = Math.min(255, Math.round(b * (1 + L.night * 0.45 - L.warm * 0.18)));
        ctx.fillStyle = 'rgb(' + rr + ',' + gg2 + ',' + bb + ')';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      drawWeather(ctx, w, h, dt);
      drawGhost(this, ctx);
    };
    E.prototype.__fx = true;
  }

  /* ---------------- photo mode ---------------- */
  function photo(eng, name) {
    try {
      var url = eng.cv.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = (name || 'gmfy-world') + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); }, 3000);
      return true;
    } catch (e) { return false; }
  }

  global.GmfyFX = {
    state: FX, sculpt: sculpt, light: light, label: label,
    install: install, photo: photo, ghostAt: ghostAt
  };
})(window);
