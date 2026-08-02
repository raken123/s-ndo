/* gmfy — block scripting across all Scratch categories.
   Scripts are a flat list; C-blocks (repeat / forever / if) pair with an `end`
   block, and hat blocks start independent threads when their event fires. */
(function (global) {
  'use strict';

  var CATS = {
    motion:  { name:'Motion',    col:'#4c97ff' },
    looks:   { name:'Looks',     col:'#9966ff' },
    sound:   { name:'Sound',     col:'#cf63cf' },
    events:  { name:'Events',    col:'#ffbf00' },
    control: { name:'Control',   col:'#ffab19' },
    sensing: { name:'Sensing',   col:'#5cb1d6' },
    operator:{ name:'Operators', col:'#59c059' },
    data:    { name:'Variables', col:'#ff8c1a' }
  };

  /* conditions available to `if` and `wait until` (Sensing + Operators) */
  var CONDS = [
    { id:'touch_lava',  label:'touching lava?' },
    { id:'touch_coin',  label:'touching a coin?' },
    { id:'all_coins',   label:'all coins collected?' },
    { id:'has_key',     label:'carrying a key?' },
    { id:'timer5',      label:'timer > 5s' },
    { id:'coins3',      label:'coins > 3' },
    { id:'moving',      label:'player moving?' },
    { id:'always',      label:'always' }
  ];

  /* value sources for `set score to` (Operators + Sensing reporters) */
  var VALUES = [
    { id:'random',  label:'random 1-10' },
    { id:'coins',   label:'coin count' },
    { id:'stars',   label:'star count' },
    { id:'timer',   label:'timer' },
    { id:'deaths',  label:'deaths' },
    { id:'zero',    label:'0' }
  ];

  var SOUNDS = ['pop', 'coin', 'jump', 'win', 'buzz'];
  var WORLDS = ['meadow', 'forest', 'beach', 'hills', 'snow', 'sunset'];
  var WEATHER = ['clear', 'rain', 'snow', 'fog'];
  var TOD = [['dawn', .25], ['noon', .5], ['dusk', .75], ['night', 0]];

  /* hat:true starts a thread. c:true opens a C-block that needs an `end`. */
  var DEFS = [
    // ---- events ----
    { id:'when_start',  cat:'events', hat:true, ev:'start',      label:'when GO is tapped' },
    { id:'when_coin',   cat:'events', hat:true, ev:'coin',       label:'when a coin is collected' },
    { id:'when_cp',     cat:'events', hat:true, ev:'checkpoint', label:'when a checkpoint is reached' },
    { id:'when_lava',   cat:'events', hat:true, ev:'die',        label:'when lava is touched' },
    { id:'when_win',    cat:'events', hat:true, ev:'win',        label:'when the finish is reached' },
    { id:'when_msg',    cat:'events', hat:true, ev:'msg',        label:'when I receive message' },
    { id:'broadcast',   cat:'events', label:'broadcast message' },

    // ---- motion ----
    { id:'move',      cat:'motion', label:'move',  arg:{min:1,max:12,step:1,val:4} },
    { id:'turn_r',    cat:'motion', label:'turn right', arg:{min:15,max:180,step:15,val:45,unit:'°'} },
    { id:'turn_l',    cat:'motion', label:'turn left',  arg:{min:15,max:180,step:15,val:45,unit:'°'} },
    { id:'goto_start',cat:'motion', label:'go to start' },
    { id:'goto_finish',cat:'motion',label:'glide to the finish' },
    { id:'spin',      cat:'motion', label:'spin world', arg:{min:0,max:3,step:.5,val:1,unit:'x'} },
    { id:'stopspin',  cat:'motion', label:'stop spinning' },
    { id:'setspeed',  cat:'motion', label:'set speed', arg:{min:1,max:5,step:1,val:2,unit:'x'} },

    // ---- looks ----
    { id:'say',       cat:'looks', label:'say Hi!' },
    { id:'think',     cat:'looks', label:'think Hmm…' },
    { id:'grow',      cat:'looks', label:'grow things', arg:{min:1,max:5,step:1,val:1,unit:'x'} },
    { id:'shrink',    cat:'looks', label:'shrink things' },
    { id:'setsize',   cat:'looks', label:'set size', arg:{min:25,max:200,step:25,val:100,unit:'%'} },
    { id:'bounce',    cat:'looks', label:'make things bounce' },
    { id:'plant',     cat:'looks', label:'plant a tree' },
    { id:'drop_coin', cat:'looks', label:'drop a coin' },
    { id:'drop_lava', cat:'looks', label:'pour some lava' },
    { id:'setworld',  cat:'looks', label:'set world to', opt:'world', val:'forest' },
    { id:'nextworld', cat:'looks', label:'next world' },
    { id:'weather',   cat:'looks', label:'set weather', opt:'weather', val:'rain' },
    { id:'wind',      cat:'looks', label:'set wind', arg:{min:-3,max:3,step:1,val:1} },
    { id:'settime',   cat:'looks', label:'set time', opt:'tod', val:'noon' },
    { id:'sunrise',   cat:'looks', label:'run a sunrise' },
    { id:'raise',     cat:'looks', label:'raise the ground' },
    { id:'lower',     cat:'looks', label:'lower the ground' },

    // ---- sound ----
    { id:'play',      cat:'sound', label:'play sound', opt:'sound', val:'pop' },
    { id:'play_wait', cat:'sound', label:'play sound until done', opt:'sound', val:'coin' },
    { id:'stop_snd',  cat:'sound', label:'stop all sounds' },
    { id:'volume',    cat:'sound', label:'set volume', arg:{min:0,max:100,step:25,val:75,unit:'%'} },

    // ---- control ----
    { id:'wait',      cat:'control', label:'wait', arg:{min:.5,max:5,step:.5,val:1,unit:'s'} },
    { id:'repeat',    cat:'control', c:true, label:'repeat', arg:{min:2,max:20,step:2,val:4} },
    { id:'forever',   cat:'control', c:true, label:'forever' },
    { id:'if',        cat:'control', c:true, label:'if', opt:'cond', val:'touch_lava' },
    { id:'else',      cat:'control', label:'else' },
    { id:'end',       cat:'control', label:'end' },
    { id:'wait_until',cat:'control', label:'wait until', opt:'cond', val:'all_coins' },
    { id:'stop_all',  cat:'control', label:'stop everything' },

    // ---- sensing ----
    { id:'reset_timer',cat:'sensing', label:'reset timer' },
    { id:'show_coins', cat:'sensing', label:'show coin count' },
    { id:'show_timer', cat:'sensing', label:'show timer' },

    // ---- operators (arithmetic on the score variable) ----
    { id:'op_add',   cat:'operator', label:'score +', arg:{min:1,max:20,step:1,val:5} },
    { id:'op_sub',   cat:'operator', label:'score −', arg:{min:1,max:20,step:1,val:1} },
    { id:'op_mul',   cat:'operator', label:'score ×', arg:{min:2,max:10,step:1,val:2} },
    { id:'op_div',   cat:'operator', label:'score ÷', arg:{min:2,max:10,step:1,val:2} },
    { id:'op_round', cat:'operator', label:'round score' },
    { id:'op_rand',  cat:'operator', label:'pick random into score', arg:{min:5,max:100,step:5,val:10} },
    { id:'op_min',   cat:'operator', label:'keep score under', arg:{min:5,max:100,step:5,val:50} },

    // ---- variables ----
    { id:'set_score', cat:'data', label:'set score to', opt:'value', val:'random' },
    { id:'change_score', cat:'data', label:'change score by', arg:{min:1,max:10,step:1,val:1} },
    { id:'show_score',cat:'data', label:'show score' }
  ];

  function defOf(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }
  function optList(kind) {
    return kind === 'cond' ? CONDS
         : kind === 'value' ? VALUES
         : kind === 'sound' ? SOUNDS.map(function (s) { return { id:s, label:s }; })
         : kind === 'weather' ? WEATHER.map(function (s) { return { id:s, label:s }; })
         : kind === 'tod' ? TOD.map(function (p) { return { id:p[0], label:p[0] }; })
         : WORLDS.map(function (s) { return { id:s, label:s }; });
  }
  function optLabel(kind, id) {
    var l = optList(kind);
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].label;
    return id;
  }

  /* ---------------- tiny beeper ---------------- */
  var actx = null, vol = 0.75;
  function beep(name) {
    try {
      if (!actx) actx = new (global.AudioContext || global.webkitAudioContext)();
      var spec = { pop:[520,.09], coin:[880,.13], jump:[330,.14],
                   win:[660,.42], buzz:[120,.25] }[name] || [440, .1];
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = (name === 'buzz') ? 'sawtooth' : 'triangle';
      o.frequency.value = spec[0];
      g.gain.value = 0.16 * vol;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + spec[1]);
      o.stop(actx.currentTime + spec[1] + .02);
      return spec[1];
    } catch (e) { return 0.1; }
  }

  /* ---------------- editor + VM ---------------- */
  function Blocks(engine, game, onChange) {
    this.engine = engine;
    this.game = game;
    this.onChange = onChange || function () {};
    this.script = [{ id: 'when_start' }];
    this.threads = [];
    this.running = false;
    this.score = 0;
    this.speed = 2;
    this.banner = '';
    this.bannerT = 0;
  }

  Blocks.prototype.add = function (id) {
    var d = defOf(id);
    if (!d || this.script.length > 80) return;
    var b = { id: id };
    if (d.arg) b.val = d.arg.val;
    if (d.opt) b.opt = d.val;
    this.script.push(b);
    if (d.c) this.script.push({ id: 'end' });     // C-blocks arrive closed
    this.onChange();
  };

  Blocks.prototype.removeAt = function (i) {
    if (i === 0 || i >= this.script.length) return;
    var d = defOf(this.script[i].id);
    if (d && d.c) {
      var e = this.matchEnd(i);
      this.script.splice(i, (e < 0 ? 1 : e - i + 1));
    } else {
      this.script.splice(i, 1);
    }
    this.onChange();
  };

  Blocks.prototype.bump = function (i) {
    var b = this.script[i], d = defOf(b.id);
    if (!d) return;
    if (d.arg) {
      var v = +(b.val + d.arg.step).toFixed(2);
      b.val = (v > d.arg.max) ? d.arg.min : v;
    } else if (d.opt) {
      var l = optList(d.opt);
      var idx = 0;
      for (var k = 0; k < l.length; k++) if (l[k].id === b.opt) idx = k;
      b.opt = l[(idx + 1) % l.length].id;
    }
    this.onChange();
  };

  /* index of the `end` that closes the C-block at i */
  Blocks.prototype.matchEnd = function (i) {
    var depth = 0;
    for (var j = i; j < this.script.length; j++) {
      var d = defOf(this.script[j].id);
      if (!d) continue;
      if (d.c) depth++;
      else if (d.id === 'end') { depth--; if (depth === 0) return j; }
    }
    return -1;
  };

  Blocks.prototype.matchElse = function (i) {
    var depth = 0;
    for (var j = i; j < this.script.length; j++) {
      var d = defOf(this.script[j].id);
      if (!d) continue;
      if (d.c) depth++;
      else if (d.id === 'end') { depth--; if (depth === 0) return -1; }
      else if (d.id === 'else' && depth === 1) return j;
    }
    return -1;
  };

  Blocks.prototype.indentOf = function (i) {
    var depth = 0;
    for (var j = 0; j < i; j++) {
      var d = defOf(this.script[j].id);
      if (!d) continue;
      if (d.c) depth++;
      else if (d.id === 'end') depth = Math.max(0, depth - 1);
    }
    var self = defOf(this.script[i].id);
    if (self && (self.id === 'end' || self.id === 'else')) depth = Math.max(0, depth - 1);
    return depth;
  };

  Blocks.prototype.clear = function () {
    this.script = [{ id: 'when_start' }];
    this.stop();
    this.onChange();
  };

  Blocks.prototype.fire = function (ev) {
    for (var i = 0; i < this.script.length; i++) {
      var d = defOf(this.script[i].id);
      if (d && d.hat && d.ev === ev) {
        this.threads.push({ pc: i + 1, wait: 0, stack: [] });
      }
    }
  };

  Blocks.prototype.run = function () {
    this.running = true;
    this.threads = [];
    this.score = 0;
    this.engine.fx.grow = 1;
    this.fire('start');
    this.onChange();
  };

  Blocks.prototype.stop = function () {
    this.running = false;
    this.threads = [];
    this.engine.fx.spin = 0;
    this.sunrise = 0;
    this.onChange();
  };

  Blocks.prototype.say = function (txt, secs) {
    this.banner = txt;
    this.bannerT = secs || 1.8;
  };

  Blocks.prototype.cond = function (id) {
    var g = this.game, e = this.engine;
    switch (id) {
      case 'touch_lava':  return g.near('lava');
      case 'touch_coin':  return g.near('coin');
      case 'all_coins':   return g.remaining('coin') === 0;
      case 'has_key':     return g.keys > 0;
      case 'timer5':      return g.time > 5;
      case 'coins3':      return g.coins > 3;
      case 'moving':      return !!e.fx.spin;
      default:            return true;
    }
  };

  Blocks.prototype.value = function (id) {
    var g = this.game;
    switch (id) {
      case 'random': return 1 + Math.floor(Math.random() * 10);
      case 'coins':  return g.coins;
      case 'stars':  return g.stars;
      case 'timer':  return +g.time.toFixed(1);
      case 'deaths': return g.deaths;
      default:       return 0;
    }
  };

  Blocks.prototype.tick = function (dt) {
    var e = this.engine;
    e.fx.t += dt;
    if (e.fx.spin) e.cam.yaw += e.fx.spin * dt;
    if (this.sunrise && global.GmfyFX) {
      var S = global.GmfyFX.state;
      S.time = (S.time + this.sunrise * dt) % 1;
    }
    if (this.bannerT > 0) this.bannerT -= dt;
    if (!this.running) return;

    for (var ti = this.threads.length - 1; ti >= 0; ti--) {
      var th = this.threads[ti];
      if (th.wait > 0) { th.wait -= dt; continue; }
      var budget = 20;
      while (budget-- > 0) {
        if (th.pc >= this.script.length) { this.threads.splice(ti, 1); break; }
        var b = this.script[th.pc];
        var d = defOf(b.id);
        if (!d) { th.pc++; continue; }
        if (d.hat) { this.threads.splice(ti, 1); break; }   // next script starts here
        var r = this.exec(b, d, th);
        if (r === 'yield') break;
        if (r === 'dead') { this.threads.splice(ti, 1); break; }
      }
    }
  };

  Blocks.prototype.exec = function (b, d, th) {
    var e = this.engine, g = this.game;
    switch (d.id) {
      case 'move':       e.move('f', (b.val || 4) * 0.03 * this.speed); break;
      case 'turn_r':     e.cam.yaw += (b.val || 45) * Math.PI / 180; break;
      case 'turn_l':     e.cam.yaw -= (b.val || 45) * Math.PI / 180; break;
      case 'goto_start': e.cam.x = g.spawn.x; e.cam.z = g.spawn.z; break;
      case 'goto_finish': this.toFinish(); break;
      case 'spin':       e.fx.spin = (b.val || 1) * 0.6; break;
      case 'stopspin':   e.fx.spin = 0; break;
      case 'setspeed':   this.speed = b.val || 2; break;

      case 'say':        this.say('Hi!'); break;
      case 'think':      this.say('Hmm…'); break;
      case 'grow':       e.fx.grow = Math.min(4, e.fx.grow * (1 + .25 * (b.val || 1))); break;
      case 'shrink':     e.fx.grow = Math.max(.25, e.fx.grow * .75); break;
      case 'setsize':    e.fx.grow = (b.val || 100) / 100; break;
      case 'bounce':     e.fx.bounce = e.fx.bounce ? 0 : 1.4; break;
      case 'plant':      this.spawn('tree'); break;
      case 'drop_coin':  this.spawn('coin'); break;
      case 'drop_lava':  this.spawn('lava'); break;
      case 'setworld':   global.Gmfy.reskin(e.world, b.opt || 'forest'); break;
      case 'nextworld':  this.nextWorld(); break;
      case 'weather':    if (global.GmfyFX) global.GmfyFX.state.weather = b.opt || 'rain'; break;
      case 'wind':       if (global.GmfyFX) global.GmfyFX.state.wind = (b.val || 0); break;
      case 'settime':
        if (global.GmfyFX) {
          var m = { dawn:.25, noon:.5, dusk:.75, night:0 };
          global.GmfyFX.state.time = m[b.opt] !== undefined ? m[b.opt] : .5;
        }
        break;
      case 'sunrise':    this.sunrise = 0.06; break;
      case 'raise':      if (global.GmfyFX) global.GmfyFX.sculpt(e.world, e.cam.x, e.cam.z, 5, 1.2); break;
      case 'lower':      if (global.GmfyFX) global.GmfyFX.sculpt(e.world, e.cam.x, e.cam.z, 5, -1.2); break;

      case 'play':       beep(b.opt || 'pop'); break;
      case 'play_wait':  th.wait = beep(b.opt || 'coin'); th.pc++; return 'yield';
      case 'stop_snd':   break;
      case 'volume':     vol = (b.val || 75) / 100; break;

      case 'wait':       th.wait = b.val || 1; th.pc++; return 'yield';
      case 'wait_until':
        if (!this.cond(b.opt)) return 'yield';                 // re-test next frame
        break;
      case 'repeat': {
        var top = th.stack[th.stack.length - 1];
        if (!top || top.at !== th.pc) th.stack.push({ at: th.pc, left: b.val || 4 });
        break;
      }
      case 'forever': {
        var t2 = th.stack[th.stack.length - 1];
        if (!t2 || t2.at !== th.pc) th.stack.push({ at: th.pc, forever: true });
        break;
      }
      case 'if': {
        if (!this.cond(b.opt)) {
          var els = this.matchElse(th.pc);
          var end = this.matchEnd(th.pc);
          th.pc = (els >= 0 ? els : end) + 1;
          return 'ok';
        }
        th.stack.push({ at: th.pc, iff: true });
        break;
      }
      case 'else': {
        // reached while running the true branch -> skip to the closing end
        var depth = 1;
        for (var j = th.pc + 1; j < this.script.length; j++) {
          var dd = defOf(this.script[j].id);
          if (!dd) continue;
          if (dd.c) depth++;
          else if (dd.id === 'end') { depth--; if (depth === 0) { th.pc = j; break; } }
        }
        break;
      }
      case 'end': {
        var fr = th.stack[th.stack.length - 1];
        if (fr && fr.forever) { th.pc = fr.at + 1; return 'yield'; }
        if (fr && fr.left !== undefined) {
          fr.left--;
          if (fr.left > 0) { th.pc = fr.at + 1; return 'yield'; }
          th.stack.pop();
        } else if (fr && fr.iff) {
          th.stack.pop();
        }
        break;
      }
      case 'stop_all':   this.stop(); return 'dead';
      case 'broadcast':  this.fire('msg'); break;

      case 'reset_timer': g.time = 0; break;
      case 'show_coins':  this.say('Coins: ' + g.coins); break;
      case 'show_timer':  this.say('Timer: ' + g.time.toFixed(1) + 's'); break;

      case 'set_score':    this.score = this.value(b.opt); break;
      case 'change_score': this.score += (b.val || 1); break;
      case 'show_score':   this.say('Score: ' + this.score); break;

      case 'op_add':   this.score += (b.val || 5); break;
      case 'op_sub':   this.score -= (b.val || 1); break;
      case 'op_mul':   this.score *= (b.val || 2); break;
      case 'op_div':   this.score = (b.val ? this.score / b.val : this.score); break;
      case 'op_round': this.score = Math.round(this.score); break;
      case 'op_rand':  this.score = 1 + Math.floor(Math.random() * (b.val || 10)); break;
      case 'op_min':   this.score = Math.min(this.score, b.val || 50); break;
    }
    th.pc++;
    return 'ok';
  };

  Blocks.prototype.spawn = function (kind) {
    var w = this.engine.world, lim = global.Gmfy.SPAN * .42;
    var kd = global.Gmfy.KIND[kind] || global.Gmfy.KIND.tree;
    w.props.push({ kind: kind,
      x: (Math.random() - .5) * 2 * lim, z: (Math.random() - .5) * 2 * lim,
      h: kind === 'tree' ? 2 + Math.random() * 3 : 1.2,
      w: kind === 'lava' ? 1.2 : .7, col: kd.col });
  };

  Blocks.prototype.toFinish = function () {
    var w = this.engine.world;
    for (var i = 0; i < w.props.length; i++) {
      if (w.props[i].kind === 'finish') {
        this.engine.cam.x = w.props[i].x;
        this.engine.cam.z = w.props[i].z - 2;
        return;
      }
    }
    this.say('no finish flag yet');
  };

  Blocks.prototype.nextWorld = function () {
    var keys = Object.keys(global.Gmfy.BIOMES);
    var i = keys.indexOf(this.engine.world.biomeKey);
    global.Gmfy.reskin(this.engine.world, keys[(i + 1) % keys.length]);
  };

  Blocks.CATS = CATS;
  Blocks.DEFS = DEFS;
  Blocks.defOf = defOf;
  Blocks.optLabel = optLabel;
  Blocks.beep = beep;
  global.GmfyBlocks = Blocks;
})(window);
