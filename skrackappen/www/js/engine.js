// Banspelet: Kasper sedd uppifrån, jagare, lydiga elever och Pantern i mörkret.
(function () {
  'use strict';
  const SK = window.SK;
  const TS = SK.TS, W = SK.W, H = SK.H;
  const SOLID = new Set('#wFLH=Bopksf'.split(''));
  const OPAQUE = new Set('#wLHB'.split(''));
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const WALK = 52, RUN = 88;

  const dirFromVec = (x, y) => (Math.abs(x) > Math.abs(y) ? (x < 0 ? 'l' : 'r') : y < 0 ? 'u' : 'd');
  const vecFromDir = (d) => ({ l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }[d] || [0, 1]);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function Level(id, hooks) {
    const def = Object.assign({}, SK.LEVELS[id], hooks && hooks.over);
    this.id = id; this.def = def; this.theme = def.theme; this.hooks = hooks || {};
    const m = def.map;
    this.h = m.length; this.w = m[0].length;
    this.grid = []; this.items = []; this.bats = []; this.lamps = []; this.enemies = [];
    this.float = []; this.t = 0; this.state = 'intro'; this.flowCache = {};
    this.time = def.time || 0;
    let kindIdx = 0;
    const spawns = [];
    for (let y = 0; y < this.h; y++) {
      const row = [];
      for (let x = 0; x < this.w; x++) {
        let c = m[y][x];
        const px = x * TS + 8, py = y * TS + 11;
        if (c === 'P') { this.player = { x: px, y: py, dir: 'd', ph: 0, stam: 100, bat: def.battery != null ? def.battery : 100, light: !!def.dark, hidden: null, tired: false, stepT: 0, noise: 0 }; c = '.'; }
        else if (c === 'R' || c === 'T' || c === 'S' || c === 'X') { spawns.push([c, px, py]); c = '.'; }
        else if (c === '*') { this.items.push({ x: px, y: py, got: false, kind: def.itemKinds ? def.itemKinds[kindIdx++ % def.itemKinds.length] : def.itemName }); c = '.'; }
        else if (c === 'b') { this.bats.push({ x: px, y: py, got: false }); c = '.'; }
        else if (c === 'l') { this.lamps.push({ x: px, y: y * TS + 6, r: 44, fixed: true, seed: Math.random() * 10 }); c = '.'; }
        else if (c === 'E') { this.exit = { x: px, y: py, tx: x, ty: y }; }
        row.push(c);
      }
      this.grid.push(row);
    }
    spawns.forEach(([c, px, py], i) => this.enemies.push(this.makeEnemy(c, px, py, i)));
    this.need = this.items.length;
    this.got = 0;
    this.render();
    this.cam = { x: 0, y: 0 };
    this.updateCam(1);
    this.heartT = 0; this.lastBpm = 0;
  }

  Level.prototype.makeEnemy = function (c, x, y, n) {
    const def = this.def, sp = def.speeds || {};
    const e = { x, y, ox: x, oy: y, dir: 'd', ang: Math.PI / 2, ph: 0, t: 0, wait: 0, seen: 0, lost: 0, alert: 0 };
    if (c === 'R') Object.assign(e, { type: 'ruben', look: SK.LOOKS.ruben, spd: sp.ruben || 60, state: 'chase', phoneT: 4 + Math.random() * 3 });
    if (c === 'T') Object.assign(e, { type: 'tilda', look: SK.LOOKS.tilda, spd: sp.tilda || 56, state: 'chase' });
    if (c === 'S') {
      Object.assign(e, { type: 'lydig', look: SK.studentLook(n + 3), spd: 44, state: 'patrol' });
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      let hRun = 0, vRun = 0;
      for (let k = 1; k < 8; k++) { if (!this.solidTile(tx + k, ty)) hRun++; else break; }
      for (let k = 1; k < 8; k++) { if (!this.solidTile(tx - k, ty)) hRun++; else break; }
      for (let k = 1; k < 6; k++) { if (!this.solidTile(tx, ty + k)) vRun++; else break; }
      for (let k = 1; k < 6; k++) { if (!this.solidTile(tx, ty - k)) vRun++; else break; }
      e.axis = hRun >= vRun ? [1, 0] : [0, 1];
      if (n % 2) e.axis = [-e.axis[0], -e.axis[1]];
      e.ang = Math.atan2(e.axis[1], e.axis[0]);
      e.dir = dirFromVec(e.axis[0], e.axis[1]);
    }
    if (c === 'X') Object.assign(e, { type: 'panther', spd: 24, state: 'wander', growlT: 0, scared: 0, target: null });
    return e;
  };

  // ---------- karta ----------
  Level.prototype.tileAt = function (tx, ty) {
    if (ty < 0 || ty >= this.h || tx < 0 || tx >= this.w) return '#';
    return this.grid[ty][tx];
  };
  Level.prototype.solidTile = function (tx, ty) { return SOLID.has(this.tileAt(tx, ty)); };
  Level.prototype.solidAt = function (x, y) { return this.solidTile(Math.floor(x / TS), Math.floor(y / TS)); };
  Level.prototype.boxHit = function (x, y) {
    return this.solidAt(x - 4, y - 5) || this.solidAt(x + 4, y - 5) || this.solidAt(x - 4, y - 0.5) || this.solidAt(x + 4, y - 0.5);
  };
  Level.prototype.move = function (e, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
    dx /= steps; dy /= steps;
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (dx) {
        if (!this.boxHit(e.x + dx, e.y)) { e.x += dx; moved = true; }
        else if (!dy) { // glid runt hörn
          for (const k of [1, -1, 2, -2, 3, -3, 4, -4]) if (!this.boxHit(e.x + dx, e.y + k)) { e.y += Math.sign(k) * Math.min(Math.abs(dx), 1); moved = true; break; }
        }
      }
      if (dy) {
        if (!this.boxHit(e.x, e.y + dy)) { e.y += dy; moved = true; }
        else if (!dx) {
          for (const k of [1, -1, 2, -2, 3, -3, 4, -4]) if (!this.boxHit(e.x + k, e.y + dy)) { e.x += Math.sign(k) * Math.min(Math.abs(dy), 1); moved = true; break; }
        }
      }
    }
    return moved;
  };
  Level.prototype.los = function (a, b) {
    const x0 = a.x, y0 = a.y - 6, x1 = b.x, y1 = b.y - 6;
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 4);
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      if (OPAQUE.has(this.tileAt(Math.floor(x / TS), Math.floor(y / TS)))) return false;
    }
    return true;
  };
  const tileOf = (e) => [Math.floor(e.x / TS), Math.floor((e.y - 3) / TS)];

  // Avståndsfält (BFS) mot en ruta – alla jagare kan dela samma.
  Level.prototype.flow = function (tx, ty) {
    const key = tx + ',' + ty;
    const c = this.flowCache[key];
    if (c && this.t - c.t < 0.3) return c.d;
    const w = this.w, h = this.h, d = new Int16Array(w * h).fill(-1);
    const q = [tx + ty * w];
    if (!this.solidTile(tx, ty)) d[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [ax, ay] of DIRS) {
        const nx = x + ax, ny = y + ay;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = nx + ny * w;
        if (d[j] >= 0 || this.solidTile(nx, ny)) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
    if (Object.keys(this.flowCache).length > 40) this.flowCache = {};
    this.flowCache[key] = { t: this.t, d };
    return d;
  };
  Level.prototype.steer = function (e, tx, ty, spd, dt, finalX, finalY) {
    const d = this.flow(tx, ty);
    const [ex, ey] = tileOf(e);
    const here = d[ex + ey * this.w];
    let gx, gy;
    if (here <= 0) { gx = finalX; gy = finalY; }
    else {
      let best = here, bx = ex, by = ey;
      for (const [ax, ay] of DIRS) {
        const nx = ex + ax, ny = ey + ay;
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const v = d[nx + ny * this.w];
        if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
      }
      gx = bx * TS + 8; gy = by * TS + 11;
    }
    const vx = gx - e.x, vy = gy - e.y, m = Math.hypot(vx, vy);
    if (m < 0.5) return false;
    const s = Math.min(m, spd * dt);
    this.move(e, (vx / m) * s, (vy / m) * s);
    e.ang = Math.atan2(vy, vx);
    e.dir = dirFromVec(vx, vy);
    e.ph += dt * spd * 0.18;
    return true;
  };

  // ---------- förrendering av kartan ----------
  Level.prototype.render = function () {
    const c = document.createElement('canvas');
    c.width = this.w * TS; c.height = this.h * TS;
    const ctx = c.getContext('2d');
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = this.grid[y][x];
      const v = (x * 7 + y * 13) & 3;
      const base = ch === 'E' ? '.' : ch;
      ctx.drawImage(SK.tile(this.theme, base, v), x * TS, y * TS);
      if ((ch === '#' || ch === 'w') && !SOLID.has(this.tileAt(x, y + 1))) SK.wallFace(ctx, this.theme, x * TS, y * TS, ch);
    }
    this.mapCanvas = c;
  };

  Level.prototype.updateCam = function (k) {
    const p = this.player;
    const mw = this.w * TS, mh = this.h * TS;
    const tx = mw <= W ? (mw - W) / 2 : SK.clamp(p.x - W / 2, 0, mw - W);
    // lite marginal upptill och nedtill så att HUD:en inte skymmer Kasper
    const ty = mh <= H - 30 ? (mh - H) / 2 : SK.clamp(p.y - 8 - H / 2, -26, mh - H + 14);
    this.cam.x = SK.lerp(this.cam.x, tx, k);
    this.cam.y = SK.lerp(this.cam.y, ty, k);
  };

  Level.prototype.say = function (text, x, y, color) {
    this.float.push({ text, x, y, t: 0, color: color || '#fff' });
  };

  Level.prototype.start = function () {
    this.state = 'play';
    SK.input.flush();
    if (this.def.music) SK.audio.music(this.def.music);
  };

  // ---------- uppdatering ----------
  Level.prototype.update = function (dt) {
    this.t += dt;
    this.float.forEach((f) => (f.t += dt));
    this.float = this.float.filter((f) => f.t < 1.6);
    if (this.state !== 'play') { this.updateCam(0.1); return; }
    const I = SK.input, p = this.player, def = this.def;
    if (I.take('pause')) { this.hooks.pause && this.hooks.pause(); return; }

    // gömd i ett skåp
    if (p.hidden) {
      p.stam = Math.min(100, p.stam + 22 * dt);
      p.noise = 0;
      if (I.take('act')) {
        p.hidden = null; SK.audio.play('locker');
      }
    } else {
      const ax = I.axis();
      const moving = Math.abs(ax.x) + Math.abs(ax.y) > 0.05;
      if (p.stam <= 0) p.tired = true;
      if (p.tired && p.stam > 35) p.tired = false;
      const running = moving && I.is('run') && !p.tired;
      const spd = running ? RUN : WALK;
      if (running) p.stam = Math.max(0, p.stam - 25 * dt);
      else p.stam = Math.min(100, p.stam + (moving ? 13 : 20) * dt);
      if (moving) {
        this.move(p, ax.x * spd * dt, ax.y * spd * dt);
        p.dir = dirFromVec(ax.x, ax.y);
        p.ph += dt * (running ? 15 : 10);
        p.stepT -= dt;
        if (p.stepT <= 0) { SK.audio.play(running ? 'run' : 'step'); p.stepT = running ? 0.21 : 0.33; }
      } else p.ph = 0;
      p.noise = running ? 120 : moving ? 34 : 0;

      // lampa
      if (def.dark && I.take('light')) {
        if (p.bat > 0) { p.light = !p.light; SK.audio.play('light'); }
        else this.hint('Batteriet är slut. Leta efter batterier.', 2);
      }
      if (p.light) {
        p.bat = Math.max(0, p.bat - (def.drain || 4.5) * dt);
        if (p.bat <= 0) { p.light = false; this.hint('Batteriet tog slut!', 2); SK.audio.play('fail'); }
      }

      // gömma sig / handlingar
      const near = this.nearHide();
      if (I.take('act')) {
        if (near) {
          p.hidden = near; p.x = near.x; p.y = near.y;
          SK.audio.play('locker');
          // den som såg dig gå in vet var du är
          this.enemies.forEach((e) => {
            if ((e.type === 'ruben' || e.type === 'tilda' || e.type === 'lydig') && e.seen > 0 && this.t - e.seen < 0.25 && dist(e, p) < 24) e.found = true;
          });
        }
      }
    }

    // saker
    this.items.forEach((it) => {
      if (it.got || p.hidden || Math.hypot(it.x - p.x, it.y - p.y) > 11) return;
      it.got = true; this.got++;
      SK.audio.play('pickup');
      if (it.kind === 'lampa') { this.lamps.push({ x: it.x, y: it.y - 8, r: 58, seed: 0 }); SK.audio.play('switchOn'); }
      const label = it.kind === 'lampa' ? 'Lampan tänds' : it.kind.charAt(0).toUpperCase() + it.kind.slice(1);
      this.say(label + ' ' + this.got + '/' + this.need, it.x, it.y - 20, SK.EYE);
      if (this.got === this.need && this.exit) this.hint('Alla ' + (def.itemNames || 'saker') + ' hittade! Ta dig till målet.', 2.5);
    });
    this.bats.forEach((b) => {
      if (b.got || Math.hypot(b.x - p.x, b.y - p.y) > 11) return;
      b.got = true; p.bat = Math.min(100, p.bat + 45);
      SK.audio.play('battery');
      this.say('+ batteri', b.x, b.y - 18, '#ffd56b');
    });

    // mål
    if (this.exit && !p.hidden && Math.hypot(this.exit.x - p.x, this.exit.y - p.y) < 12) {
      if (this.got >= this.need) { this.win(); return; }
      this.hint('Du måste hitta alla ' + (def.itemNames || 'saker') + ' först (' + this.got + '/' + this.need + ').', 0.3);
    }

    if (this.time) {
      this.time -= dt;
      if (this.time <= 0) { this.time = 0; this.lose('tid'); return; }
    }

    this.enemies.forEach((e) => this.updateEnemy(e, dt));
    if (this.state !== 'play') return;

    // hjärtat slår fortare när faran är nära
    this.heartT -= dt;
    if (this.heartT <= 0) {
      this.heartT = 0.5;
      let dmin = 999;
      this.enemies.forEach((e) => { dmin = Math.min(dmin, dist(e, p)); });
      const bpm = dmin < 150 ? Math.round(70 + (150 - dmin) * 0.75) : 0;
      if (Math.abs(bpm - this.lastBpm) > 8 || (bpm === 0) !== (this.lastBpm === 0)) { SK.audio.heart(bpm); this.lastBpm = bpm; }
    }
    if (this.hintT > 0) this.hintT -= dt;
    this.updateCam(1 - Math.pow(0.001, dt));
  };

  Level.prototype.nearHide = function () {
    const p = this.player;
    const [px, py] = tileOf(p);
    for (const [ax, ay] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      if (this.tileAt(px + ax, py + ay) === 'H') {
        return { tx: px + ax, ty: py + ay, x: px * TS + 8, y: py * TS + 11 };
      }
    }
    return null;
  };

  Level.prototype.hint = function (text, sec) { this.hintText = text; this.hintT = sec || 1.5; };

  Level.prototype.playerVisible = function (e, range, fov) {
    const p = this.player;
    if (p.hidden) return false;
    const d = dist(e, p);
    if (d > range) return false;
    if (fov) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      let da = Math.abs(a - e.ang) % (Math.PI * 2);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da > fov && d > 14) return false;
    }
    return this.los(e, p);
  };

  Level.prototype.inLamp = function (x, y) {
    return this.lamps.some((l) => Math.hypot(l.x - x, l.y + 8 - y) < l.r * 0.72);
  };

  Level.prototype.randomFloorNear = function (e, rad) {
    for (let k = 0; k < 30; k++) {
      const tx = Math.floor(e.x / TS) + SK.randi(-rad, rad), ty = Math.floor(e.y / TS) + SK.randi(-rad, rad);
      if (!this.solidTile(tx, ty) && this.tileAt(tx, ty) !== 'E') return [tx, ty];
    }
    return tileOf(e);
  };

  Level.prototype.updateEnemy = function (e, dt) {
    const p = this.player, def = this.def;
    e.t += dt;
    if (this.t < (def.grace || 0)) { e.dir = dirFromVec(p.x - e.x, p.y - e.y); return; }
    const d = dist(e, p);
    const [ptx, pty] = tileOf(p);

    if (e.type === 'ruben' || e.type === 'tilda') {
      if (e.wait > 0) { e.wait -= dt; e.ph = 0; return; }
      // Ruben stannar ibland och tittar i mobilen (gympasalen)
      if (e.type === 'ruben' && this.id === 'gympa') {
        e.phoneT -= dt;
        if (e.phoneT <= 0) { e.phoneT = 3.5 + Math.random() * 2; e.wait = 1.8; e.phone = 1.8; SK.audio.play('pling'); this.say('Ruben läser ett uppdrag…', e.x, e.y - 26, SK.EYE); return; }
      }
      if (e.phone > 0) e.phone -= dt;
      const sees = this.playerVisible(e, 220, 0);
      if (sees) { e.seen = this.t; e.lx = p.x; e.ly = p.y; e.state = 'chase'; e.lost = 0; }
      if (p.hidden && e.found && d < 26) { this.lose('caught', e); return; }
      if (e.state === 'chase') {
        if (sees || !p.hidden) {
          this.steer(e, ptx, pty, e.spd, dt, p.x, p.y);
        } else {
          e.lost += dt;
          const [lx, ly] = tileOf({ x: e.lx, y: e.ly });
          if (!this.steer(e, lx, ly, e.spd * 0.8, dt, e.lx, e.ly) || e.lost > 3) { e.state = 'search'; e.searchT = 5; e.target = this.randomFloorNear(e, 4); }
        }
      } else if (e.state === 'search') {
        e.searchT -= dt;
        const [tx, ty] = e.target;
        if (!this.steer(e, tx, ty, e.spd * 0.45, dt, tx * TS + 8, ty * TS + 11)) e.target = this.randomFloorNear(e, 4);
        if (e.searchT <= 0 && !p.hidden) e.state = 'chase';
      }
      if (d < 9 && !p.hidden) this.lose('caught', e);
      return;
    }

    if (e.type === 'lydig') {
      const sees = this.playerVisible(e, e.state === 'chase' ? 120 : 64, e.state === 'chase' ? 0 : 0.62);
      if (e.state === 'patrol') {
        if (sees) {
          e.state = 'alert'; e.alert = 0.65; e.seen = this.t; SK.audio.play('pling');
          this.say('!', e.x, e.y - 24, SK.EYE);
          this.enemies.forEach((o) => { if (o !== e && o.type === 'lydig' && o.state === 'patrol' && dist(o, e) < 110) { o.state = 'alert'; o.alert = 0.9; o.seen = this.t; } });
          return;
        }
        if (e.wait > 0) {
          e.wait -= dt; e.ph = 0;
          if (e.wait < 0.6 && !e.turned) { e.turned = true; e.axis = [-e.axis[0], -e.axis[1]]; e.ang = Math.atan2(e.axis[1], e.axis[0]); e.dir = dirFromVec(e.axis[0], e.axis[1]); }
          return;
        }
        const ok = this.move(e, e.axis[0] * 18 * dt, e.axis[1] * 18 * dt);
        e.ph += dt * 4;
        if (!ok || this.solidAt(e.x + e.axis[0] * 8, e.y - 2 + e.axis[1] * 8) || Math.hypot(e.x - e.ox, e.y - e.oy) > 6 * TS) {
          e.wait = 1.6; e.turned = false;
          if (Math.hypot(e.x - e.ox, e.y - e.oy) > 6 * TS) { e.ox = e.x; e.oy = e.y; }
        }
        e.ang = Math.atan2(e.axis[1], e.axis[0]);
        e.dir = dirFromVec(e.axis[0], e.axis[1]);
      } else if (e.state === 'alert') {
        e.alert -= dt;
        e.ang = Math.atan2(p.y - e.y, p.x - e.x); e.dir = dirFromVec(p.x - e.x, p.y - e.y);
        if (e.alert <= 0) { e.state = 'chase'; e.lx = p.x; e.ly = p.y; e.lost = 0; }
      } else if (e.state === 'chase') {
        if (sees) { e.lx = p.x; e.ly = p.y; e.lost = 0; e.seen = this.t; this.steer(e, ptx, pty, e.spd, dt, p.x, p.y); }
        else {
          e.lost += dt;
          const [lx, ly] = tileOf({ x: e.lx, y: e.ly });
          this.steer(e, lx, ly, e.spd * 0.8, dt, e.lx, e.ly);
          if (e.lost > 3.2) { e.state = 'return'; }
        }
        if (p.hidden && e.found && d < 26) { this.lose('caught', e); return; }
        if (d < 9 && !p.hidden) { this.lose('caught', e); return; }
      } else if (e.state === 'return') {
        const [ox, oy] = tileOf({ x: e.ox, y: e.oy });
        if (!this.steer(e, ox, oy, 26, dt, e.ox, e.oy)) { e.state = 'patrol'; e.found = false; }
        if (sees) { e.state = 'alert'; e.alert = 0.4; SK.audio.play('pling'); }
      }
      return;
    }

    if (e.type === 'panther') {
      e.growlT -= dt;
      // ljuset skrämmer den
      if (p.light && d < 96 && this.los(p, e)) {
        const [vx, vy] = vecFromDir(p.dir);
        const a = Math.atan2(e.y - p.y, e.x - p.x), fa = Math.atan2(vy, vx);
        let da = Math.abs(a - fa) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < 0.55) {
          if (e.scared <= 0) { SK.audio.play('hiss'); this.say('Fräs!', e.x, e.y - 18, '#ff9b9b'); }
          e.scared = 1.6; e.fx = p.x; e.fy = p.y;
        }
      }
      if (e.scared > 0) {
        e.scared -= dt;
        const vx = e.x - e.fx, vy = e.y - e.fy, m = Math.hypot(vx, vy) || 1;
        this.move(e, (vx / m) * 46 * dt, (vy / m) * 46 * dt);
        e.ang = Math.atan2(vy, vx);
        e.state = 'wander'; e.target = null;
        return;
      }
      const safe = this.inLamp(p.x, p.y);
      const sees = !safe && this.playerVisible(e, p.light ? 120 : 64, 0);
      if (sees) { e.state = 'hunt'; e.hx = p.x; e.hy = p.y; e.huntT = 4; }
      else if (p.noise && d < p.noise && !safe) { e.state = 'hunt'; e.hx = p.x; e.hy = p.y; e.huntT = 4; }
      if (e.state === 'hunt') {
        if (e.growlT <= 0) { SK.audio.play('growl'); e.growlT = 5; }
        e.huntT -= dt;
        const lunge = sees && d < 40;
        const spd = lunge ? 80 : 44;
        const [hx, hy] = tileOf({ x: e.hx, y: e.hy });
        const moved = this.steer(e, hx, hy, spd, dt, e.hx, e.hy);
        if ((!moved && !sees) || e.huntT <= 0) e.state = 'wander';
      } else {
        if (!e.target || e.wait > 0) { e.wait -= dt; if (e.wait <= 0) e.target = this.randomFloorNear(e, 7); }
        else if (!this.steer(e, e.target[0], e.target[1], 24, dt, e.target[0] * TS + 8, e.target[1] * TS + 11)) { e.target = null; e.wait = 0.6 + Math.random(); }
      }
      // in i ljuset går den inte
      const lamp = this.lamps.find((l) => Math.hypot(l.x - e.x, l.y + 8 - e.y) < l.r * 0.72);
      if (lamp && e.scared <= 0) { e.scared = 0.8; e.fx = lamp.x; e.fy = lamp.y + 8; }
      if (d < 10 && !safe) this.lose('caught', e);
    }
  };

  Level.prototype.win = function () {
    if (this.state !== 'play') return;
    this.state = 'won';
    SK.audio.play('win'); SK.audio.heart(0);
    setTimeout(() => this.hooks.done && this.hooks.done('win'), 900);
  };

  Level.prototype.lose = function (why, e) {
    if (this.state !== 'play') return;
    this.state = 'lost';
    SK.audio.heart(0);
    if (why === 'tid') { SK.audio.play('bell'); SK.audio.play('fail'); }
    else { SK.audio.play('caught'); SK.fx && SK.fx('redflash'); SK.fx && SK.fx('shake'); }
    if (e && e.type === 'panther') SK.audio.play('growl');
    const texts = this.def.caught || ['Du blev tagen.'];
    const text = why === 'tid' ? 'Skolklockan ringer. Du hann inte.' : SK.pick(texts);
    setTimeout(() => this.hooks.lost && this.hooks.lost(why, text), 1100);
  };

  // ---------- ritning ----------
  Level.prototype.draw = function (ctx) {
    const t = this.t, p = this.player, def = this.def;
    const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-cx, -cy);
    ctx.drawImage(this.mapCanvas, 0, 0);

    // mål
    if (this.exit) {
      const open = this.got >= this.need;
      const ex = this.exit.x, ey = this.exit.y - 4;
      ctx.fillStyle = open ? 'rgba(212,242,90,0.35)' : 'rgba(255,80,60,0.25)';
      const pulse = 4 + Math.sin(t * 4) * 1.5;
      ctx.fillRect(ex - 6 - pulse / 2, ey - 6 - pulse / 2, 12 + pulse, 12 + pulse);
      ctx.fillStyle = open ? SK.EYE : '#ff6a5a';
      ctx.font = 'bold 8px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(open ? '▶' : '✕', ex, ey);
    }
    // lampor (armaturer)
    this.lamps.forEach((l) => { if (l.fixed) { ctx.fillStyle = '#444'; ctx.fillRect(l.x - 1, l.y - 6, 2, 4); ctx.fillStyle = '#ffe9a8'; ctx.fillRect(l.x - 2, l.y - 2, 4, 3); } });
    // saker
    this.items.forEach((it, i) => {
      if (it.got && it.kind !== 'lampa') return;
      this.drawItem(ctx, it, t + i);
    });
    this.bats.forEach((b) => {
      if (b.got) return;
      const bob = Math.round(Math.sin(t * 3 + b.x) * 1);
      ctx.fillStyle = '#222'; ctx.fillRect(b.x - 3, b.y - 7 + bob, 6, 4);
      ctx.fillStyle = '#ffd56b'; ctx.fillRect(b.x - 3, b.y - 7 + bob, 3, 4); ctx.fillRect(b.x + 3, b.y - 6 + bob, 1, 2);
    });

    // synkoner (lydiga)
    this.enemies.forEach((e) => {
      if (e.type !== 'lydig') return;
      const range = e.state === 'chase' ? 40 : 64, half = 0.62;
      const g = ctx.createRadialGradient(e.x, e.y - 6, 2, e.x, e.y - 6, range);
      g.addColorStop(0, e.state === 'patrol' ? 'rgba(212,242,90,0.30)' : 'rgba(255,80,60,0.35)');
      g.addColorStop(1, 'rgba(212,242,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 6); ctx.arc(e.x, e.y - 6, range, e.ang - half, e.ang + half); ctx.closePath(); ctx.fill();
    });

    // figurer sorterade uppifrån och ned
    const list = this.enemies.slice();
    if (!p.hidden) list.push(p);
    list.sort((a, b) => a.y - b.y);
    const eyes = [];
    list.forEach((e) => {
      if (e === p) {
        SK.drawPerson(ctx, p.x, p.y, SK.LOOKS.kasper, p.dir, p.ph, { mouth: this.lastBpm > 130 ? 'o' : null });
        if (p.light && def.dark) {
          const [vx, vy] = vecFromDir(p.dir);
          ctx.fillStyle = '#cfe8c0'; ctx.fillRect(Math.round(p.x + vx * 4) - 1, Math.round(p.y - 7 + vy * 2), 2, 2);
        }
      } else if (e.type === 'panther') {
        const pts = SK.drawPanther(ctx, e.x, e.y - 4, e.ang, t, { speed: e.state === 'hunt' ? 14 : 7, rim: true });
        eyes.push(pts);
      } else {
        const lit = e.type === 'lydig';
        SK.drawPerson(ctx, e.x, e.y, e.look, e.dir, e.ph, { glow: lit || (e.type === 'ruben' && this.id === 'gympa'), phone: lit || e.phone > 0, lit, mouth: e.type === 'ruben' && this.id !== 'gympa' ? 'grin' : null });
        if (e.state === 'alert' || (e.type !== 'lydig' && this.t < (def.grace || 0))) {
          ctx.fillStyle = e.state === 'alert' ? '#ff5a4a' : '#ffd56b';
          ctx.font = 'bold 9px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText('!', e.x, e.y - 20 - (e.type === 'ruben' ? 1 : 0));
        }
        if (e.phone > 0) SK.glowDot(ctx, e.x, e.y - 8, 10, 'rgba(212,242,90,0.6)', 1);
      }
    });
    if (p.hidden) {
      const hx = p.hidden.tx * TS, hy = p.hidden.ty * TS;
      ctx.fillStyle = '#0b0b0b'; ctx.fillRect(hx + 7, hy + 5, 2, 9);
      if (Math.sin(t * 1.3) > -0.7) { ctx.fillStyle = '#e8e4dc'; ctx.fillRect(hx + 7, hy + 7, 1, 1); ctx.fillRect(hx + 8, hy + 9, 1, 1); }
    }
    ctx.restore();

    // mörker
    if (def.dark) {
      if (!this.dark) { this.dark = document.createElement('canvas'); this.dark.width = W; this.dark.height = H; }
      const d = this.dark.getContext('2d');
      d.globalCompositeOperation = 'source-over';
      d.fillStyle = 'rgba(1,1,4,0.95)'; d.fillRect(0, 0, W, H);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => {
        const g = d.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const px = p.x - cx, py = p.y - 7 - cy;
      hole(px, py, p.hidden ? 12 : 26, 0.8);
      if (p.light && !p.hidden) {
        const [vx, vy] = vecFromDir(p.dir);
        const a = Math.atan2(vy, vx);
        const flick = p.bat < 15 ? (Math.sin(t * 40) > 0 ? 1 : 0.4) : 1;
        const g = d.createRadialGradient(px, py, 4, px, py, 104);
        g.addColorStop(0, 'rgba(0,0,0,' + 0.95 * flick + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = g;
        d.beginPath(); d.moveTo(px, py); d.arc(px, py, 104, a - 0.5, a + 0.5); d.closePath(); d.fill();
      }
      this.lamps.forEach((l) => {
        const fl = l.fixed ? (Math.sin(t * 13 + l.seed) > -0.9 ? 1 : 0.3) : 1;
        hole(l.x - cx, l.y + 4 - cy, l.r, 0.85 * fl);
      });
      ctx.drawImage(this.dark, 0, 0);
      this.lamps.forEach((l) => SK.glowDot(ctx, l.x - cx, l.y - cy, 18, 'rgba(255,220,140,0.35)', 1));
      // saker syns svagt i mörkret
      this.items.forEach((it) => { if (!it.got) SK.glowDot(ctx, it.x - cx, it.y - 6 - cy, 9, 'rgba(212,242,90,0.35)', 0.5 + Math.sin(t * 3) * 0.3); });
      this.bats.forEach((b) => { if (!b.got) SK.glowDot(ctx, b.x - cx, b.y - 6 - cy, 7, 'rgba(255,213,107,0.35)', 0.6); });
      if (this.exit) SK.glowDot(ctx, this.exit.x - cx, this.exit.y - 4 - cy, 12, this.got >= this.need ? 'rgba(212,242,90,0.5)' : 'rgba(255,80,60,0.35)', 0.8);
    }
    // ögon och mobiler glöder ovanpå
    eyes.forEach((pts) => SK.drawEyes(ctx, pts.map(([x, y]) => [x - cx, y - cy]), 1));
    this.enemies.forEach((e) => {
      if (e.type === 'lydig') SK.glowDot(ctx, e.x - cx, e.y - 9 - cy, 8, 'rgba(212,242,90,0.55)', 0.8);
    });
    if (p.hidden) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, W, 34); ctx.fillRect(0, H - 34, W, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, 44 + i * 26, W, 9);
    }

    // flytande text
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    this.float.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 1.6;
      ctx.font = 'bold 8px "Courier New", monospace';
      ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x - cx + 1, f.y - cy - f.t * 10 + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x - cx, f.y - cy - f.t * 10);
    });
    ctx.globalAlpha = 1;
  };

  Level.prototype.drawItem = function (ctx, it, t) {
    const x = Math.round(it.x), bob = Math.round(Math.sin(t * 3) * 1.2), y = Math.round(it.y - 6 + bob);
    const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
    if (!this.def.dark) SK.glowDot(ctx, x, y, 10, 'rgba(212,242,90,0.35)', 0.6 + Math.sin(t * 4) * 0.3);
    switch (it.kind) {
      case 'flagga': {
        r(-1, -8, 1, 12, '#ddd');
        for (let i = 0; i < 7; i++) { const yo = Math.round(Math.sin(t * 6 + i * 0.7)); ctx.fillStyle = i === 2 ? '#f2c230' : '#2a5ab0'; ctx.fillRect(x + i, y - 8 + yo, 1, 5); ctx.fillStyle = '#f2c230'; ctx.fillRect(x + i, y - 6 + yo, 1, 1); }
        break;
      }
      case 'lampa': {
        r(-3, -2, 6, 6, '#3a3a3e'); r(-1, -6, 2, 4, '#555');
        r(-2, -9, 4, 4, it.got ? '#ffe9a8' : '#777');
        break;
      }
      case 'lapp': { r(-3, -4, 7, 8, '#ece6d6'); r(-2, -2, 5, 1, '#666'); r(-2, 0, 4, 1, '#666'); r(-2, 2, 5, 1, '#b03030'); break; }
      case 'säkring': { r(-2, -4, 4, 8, '#e8e2d0'); r(-2, -5, 4, 2, '#8a6a3a'); r(-2, 3, 4, 2, '#8a6a3a'); r(-1, -1, 2, 2, '#c0392b'); break; }
      case 'jacka': { r(-4, -3, 8, 7, SK.LOOKS.kasper.top); r(-5, -3, 1, 5, SK.LOOKS.kasper.top2); r(4, -3, 1, 5, SK.LOOKS.kasper.top2); r(-1, -3, 2, 1, '#ddd'); break; }
      case 'ryggsäck': { r(-3, -4, 7, 8, '#2e6a4a'); r(-3, -4, 7, 2, '#3e8a5e'); r(-1, 0, 3, 2, '#1e4a32'); break; }
      case 'nycklar': { r(-3, -1, 3, 3, '#e0c060'); r(0, 0, 4, 1, '#e0c060'); r(2, 1, 1, 2, '#e0c060'); r(-4, -3, 2, 2, '#c0392b'); break; }
      default: r(-3, -3, 6, 6, SK.EYE);
    }
  };

  SK.Level = Level;
})();
