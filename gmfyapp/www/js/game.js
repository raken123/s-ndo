/* gmfy — play mode. Walk the world you built: collect coins, hit checkpoints,
   avoid lava and enemies, reach the finish. */
(function (global) {
  'use strict';

  var REACH = 1.9;          // how close counts as touching
  var PATCH = 2.4;          // lava/water pools are wider than their marker

  function Game(engine, onEvent) {
    this.engine = engine;
    this.onEvent = onEvent || function () {};
    this.playing = false;
    this.reset(true);
  }

  Game.prototype.reset = function (hard) {
    var e = this.engine;
    this.coins = 0;
    this.stars = 0;
    this.keys = 0;
    this.deaths = 0;
    this.won = false;
    this.time = 0;
    this.spawn = { x: 0, z: -9 };
    this.message = '';
    this.msgT = 0;
    if (hard && e.world) this.restoreAll();
    e.cam.x = this.spawn.x; e.cam.z = this.spawn.z; e.cam.yaw = 0;
    this.vy = 0;
  };

  Game.prototype.restoreAll = function () {
    var p = this.engine.world.props;
    for (var i = 0; i < p.length; i++) {
      p[i].taken = false;
      if (p[i].kind === 'checkpoint') p[i].on = false;
    }
  };

  Game.prototype.total = function (role) {
    var p = this.engine.world.props, n = 0;
    for (var i = 0; i < p.length; i++) {
      var k = global.Gmfy.KIND[p[i].kind];
      if (k && k.role === role) n++;
    }
    return n;
  };

  Game.prototype.start = function () {
    this.playing = true;
    this.reset(true);
    this.track = [];              // this run, sampled ~10 Hz
    this._sample = 0;
    var FX = global.GmfyFX && global.GmfyFX.state;
    if (FX) { FX.ghost = this.best ? this.best.track : null; FX.ghostT = 0; }
    this.say(this.best ? 'Go! racing your ghost' : 'Go!');
    this.onEvent('start');
  };

  Game.prototype.stop = function () {
    this.playing = false;
    this.onEvent('stop');
  };

  Game.prototype.say = function (txt, secs) {
    this.message = txt;
    this.msgT = secs || 1.6;
  };

  Game.prototype.respawn = function () {
    var e = this.engine;
    e.cam.x = this.spawn.x;
    e.cam.z = this.spawn.z;
    this.deaths++;
    this.say('Ouch! Back to checkpoint');
    this.onEvent('die');
  };

  /* called every frame while playing */
  Game.prototype.tick = function (dt) {
    if (this.msgT > 0) this.msgT -= dt;
    if (!this.playing || this.won) return;
    this.time += dt;

    var FX = global.GmfyFX && global.GmfyFX.state;
    if (FX) {
      FX.ghostT = this.time;
      if (FX.wind) this.engine.cam.x += FX.wind * dt * 0.9;   // weather pushes you
    }
    this._sample = (this._sample || 0) + dt;
    if (this._sample >= 0.1) {
      this._sample = 0;
      if (this.track) this.track.push({ t: this.time,
        x: this.engine.cam.x, z: this.engine.cam.z });
    }

    var e = this.engine, w = e.world;
    var px = e.cam.x, pz = e.cam.z;

    for (var i = 0; i < w.props.length; i++) {
      var pr = w.props[i];
      var kd = global.Gmfy.KIND[pr.kind];
      if (!kd) continue;
      var role = kd.role;
      if (role === 'solid') continue;

      var dx = pr.x - px, dz = pr.z - pz;
      var d = Math.sqrt(dx * dx + dz * dz);
      var reach = (kd.shape === 'patch') ? PATCH : REACH;
      if (d > reach) continue;

      if (role === 'coin' && !pr.taken) {
        pr.taken = true; this.coins++;
        this.say('Coin! ' + this.coins + '/' + (this.coins + this.remaining('coin')));
        this.onEvent('coin');
      } else if (role === 'star' && !pr.taken) {
        pr.taken = true; this.stars++;
        this.say('Star!'); this.onEvent('star');
      } else if (role === 'key' && !pr.taken) {
        pr.taken = true; this.keys++;
        this.say('Key collected'); this.onEvent('key');
      } else if (role === 'checkpoint') {
        if (!pr.on) {
          pr.on = true;
          this.spawn = { x: pr.x, z: pr.z };
          this.say('Checkpoint!');
          this.onEvent('checkpoint');
        }
      } else if (role === 'lava' || role === 'hazard' || role === 'enemy') {
        this.respawn();
        return;
      } else if (role === 'spring') {
        // shove the player away from the pad
        var len = d || 1;
        e.cam.x -= (dx / len) * 6;
        e.cam.z -= (dz / len) * 6;
        this.say('Boing!');
        this.onEvent('spring');
      } else if (role === 'door') {
        if (this.keys > 0) {
          pr.taken = true; this.keys--;
          this.say('Door unlocked'); this.onEvent('door');
        } else {
          e.cam.x -= dx * 0.12; e.cam.z -= dz * 0.12;
          this.say('Locked — find a key');
        }
      } else if (role === 'finish') {
        var left = this.remaining('coin');
        if (left > 0) {
          this.say(left + ' coin' + (left > 1 ? 's' : '') + ' to go!');
        } else {
          this.won = true;
          this.playing = false;
          var beat = !this.best || this.time < this.best.time;
          if (beat) this.best = { time: this.time, track: (this.track || []).slice() };
          this.say(beat ? ('New best!  ' + this.time.toFixed(1) + 's')
                        : ('You win!  ' + this.time.toFixed(1) + 's  (best ' +
                           this.best.time.toFixed(1) + 's)'), 6);
          this.onEvent('win');
        }
      }
    }
  };

  /* is the player standing on/near anything with this role? */
  Game.prototype.near = function (role) {
    var e = this.engine, w = e.world;
    for (var i = 0; i < w.props.length; i++) {
      var pr = w.props[i], kd = global.Gmfy.KIND[pr.kind];
      if (!kd || kd.role !== role || pr.taken) continue;
      var dx = pr.x - e.cam.x, dz = pr.z - e.cam.z;
      var reach = (kd.shape === 'patch') ? PATCH : REACH;
      if (dx * dx + dz * dz <= reach * reach) return true;
    }
    return false;
  };

  Game.prototype.remaining = function (role) {
    var p = this.engine.world.props, n = 0;
    for (var i = 0; i < p.length; i++) {
      var k = global.Gmfy.KIND[p[i].kind];
      if (k && k.role === role && !p[i].taken) n++;
    }
    return n;
  };

  /* HUD overlay drawn straight onto the canvas */
  Game.prototype.draw = function (ctx, w, h) {
    if (!this.playing && !this.won) return;
    ctx.save();
    ctx.font = 'bold 15px -apple-system,Roboto,sans-serif';
    var pad = 10;
    var line = 'Coins ' + this.coins + '/' + (this.coins + this.remaining('coin')) +
               '   Time ' + this.time.toFixed(1) + 's' +
               (this.best ? '   Best ' + this.best.time.toFixed(1) + 's' : '');
    var tw = ctx.measureText(line).width;
    ctx.fillStyle = 'rgba(255,255,255,.80)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2 - pad, 10, tw + pad * 2, 30, 9);
    ctx.fill();
    ctx.fillStyle = '#16324a';
    ctx.textAlign = 'center';
    ctx.fillText(line, w / 2, 30);

    if (this.msgT > 0 && this.message) {
      ctx.font = 'bold 21px -apple-system,Roboto,sans-serif';
      var mw = ctx.measureText(this.message).width;
      ctx.fillStyle = 'rgba(8,12,20,.78)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - mw / 2 - 16, h * 0.34, mw + 32, 44, 12);
      ctx.fill();
      ctx.fillStyle = this.won ? '#3ddc84' : '#fff';
      ctx.fillText(this.message, w / 2, h * 0.34 + 30);
    }
    ctx.restore();
  };

  global.GmfyGame = Game;
})(window);
