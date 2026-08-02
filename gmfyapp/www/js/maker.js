/* gmfy — Maker: build a world by hand.
   Tap the ground to place things, tap a thing to erase it. */
(function (global) {
  'use strict';

  var STORE = 'gmfy.maker.world.v1';
  function storeKey(){ return global.GmfyAuth ? global.GmfyAuth.scope(STORE) : STORE; }
  var el = function (id) { return document.getElementById(id); };

  function Maker(engine, onChange) {
    this.engine = engine;
    this.onChange = onChange || function () {};
    this.tool = 'place';
    this.kind = 'coin';
    this.col = '#4ea63f';
    this.size = 0.30;      // 0..1 -> prop height
    this.relief = 1.0;
    this.active = false;
    this.undoStack = [];
  }

  Maker.prototype.enter = function () {
    this.active = true;
    var w = this.engine.world;
    // carry the current world in so you can hand-edit a generated one
    if (!w) w = global.Gmfy.emptyWorld('meadow', this.relief);
    w.source = 'maker';
    this.engine.load(w);
    this.syncPalette();
    this.onChange();
  };

  Maker.prototype.exit = function () { this.active = false; };

  Maker.prototype.blank = function (biomeKey) {
    var w = global.Gmfy.emptyWorld(biomeKey || this.engine.world.biomeKey, this.relief);
    this.undoStack = [];
    this.engine.load(w);
    this.syncPalette();
    this.onChange();
  };

  /* refresh the colour swatches to the active biome's palette */
  Maker.prototype.syncPalette = function () {
    var pal = this.engine.world.biome.palette.slice();
    ['#e9ecf5', '#8a91a8'].forEach(function (c) {
      if (pal.indexOf(c) === -1) pal.push(c);
    });
    this.palette = pal;
    if (pal.indexOf(this.col) === -1) this.col = pal[0];
  };

  Maker.prototype.setBiome = function (key) {
    global.Gmfy.reskin(this.engine.world, key);
    this.syncPalette();
    this.onChange();
  };

  Maker.prototype.setRelief = function (v) {
    this.relief = v;
    global.Gmfy.setRelief(this.engine.world, v);
    this.onChange();
  };

  /* screen tap -> place or erase */
  Maker.prototype.tap = function (sx, sy) {
    if (!this.active || this.tool === 'look') return;
    var w = this.engine.world;
    var g = this.engine.pick(sx, sy);
    if (!g) return;

    if (this.tool === 'erase') {
      var i = this.engine.propAt(g.x, g.z, 2.4);
      if (i >= 0) {
        this.undoStack.push({ op: 'add', index: i, prop: w.props[i] });
        w.props.splice(i, 1);
        this.onChange();
      }
      return;
    }

    var tall = (this.kind === 'tower') ? 9 : (this.kind === 'tree' ? 5 : 3.2);
    var prop = {
      kind: this.kind, x: g.x, z: g.z,
      h: 0.6 + this.size * tall,
      w: 0.35 + this.size * (this.kind === 'tower' ? 1.3 : 1.0),
      col: this.col
    };
    w.props.push(prop);
    this.undoStack.push({ op: 'remove', index: w.props.length - 1 });
    this.onChange();
  };

  Maker.prototype.undo = function () {
    var w = this.engine.world, a = this.undoStack.pop();
    if (!a) return;
    if (a.op === 'remove') w.props.splice(a.index, 1);
    else w.props.splice(a.index, 0, a.prop);
    this.onChange();
  };

  Maker.prototype.clear = function () {
    var w = this.engine.world;
    if (!w.props.length) return;
    this.undoStack = [];
    w.props = [];
    this.onChange();
  };

  Maker.prototype.save = function () {
    var w = this.engine.world;
    try {
      localStorage.setItem(storeKey(), JSON.stringify({
        biomeKey: w.biomeKey, relief: this.relief, props: w.props
      }));
      return true;
    } catch (e) { return false; }
  };

  Maker.prototype.load = function (silent) {
    var raw;
    try { raw = localStorage.getItem(storeKey()); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }

    // validate on the way in so a hand-edited store can't break rendering
    var w = global.Gmfy.worldFromSpec(
      { biome: data.biomeKey, props: data.props, relief: data.relief }, 'maker');
    w.props = w.props || [];
    if (!data.props || !data.props.length) w.props = [];
    w.source = 'maker';
    this.relief = data.relief || 1;
    this.undoStack = [];
    this.engine.load(w);
    this.syncPalette();
    this.onChange();
    return true;
  };

  global.GmfyMaker = Maker;
})(window);
