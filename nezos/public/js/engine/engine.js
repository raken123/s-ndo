// Nezos engine: turns a scene document (plain JSON) into three.js objects and
// runs game scripts against a small, AI-friendly API. Shared by the studio
// viewport, the sandboxed play mode and exported games.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export { THREE };

const D2R = Math.PI / 180;
export const PRIMITIVES = ['box', 'sphere', 'cylinder', 'cone', 'capsule', 'plane', 'torus'];

// ---------------------------------------------------------------- helpers
const vec3 = (v, d) => {
  if (typeof v === 'number' && Number.isFinite(v)) return [v, v, v];
  return Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : d;
};

export function applyTransform(obj, spec) {
  const p = vec3(spec.position, [0, 0, 0]);
  const r = vec3(spec.rotation, [0, 0, 0]);
  const s = vec3(spec.scale, [1, 1, 1]);
  obj.position.set(p[0], p[1], p[2]);
  obj.rotation.set(r[0] * D2R, r[1] * D2R, r[2] * D2R);
  obj.scale.set(s[0] || 1e-4, s[1] || 1e-4, s[2] || 1e-4);
}

export function readTransform(obj) {
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    position: obj.position.toArray().map(round),
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z].map((r) => round(r / D2R)),
    scale: obj.scale.toArray().map(round),
  };
}

const geoCache = new Map();
function geometry(type) {
  if (geoCache.has(type)) return geoCache.get(type);
  let g;
  switch (type) {
    case 'sphere': g = new THREE.SphereGeometry(0.5, 32, 16); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, 32); break;
    case 'capsule': g = new THREE.CapsuleGeometry(0.5, 1, 8, 16); break;
    case 'plane': g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); break;
    case 'torus': g = new THREE.TorusGeometry(0.4, 0.1, 16, 48); break;
    case 'quad': g = new THREE.PlaneGeometry(1, 1); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache.set(type, g);
  return g;
}

const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
const texCache = new Map();
function texture(url, repeat) {
  const rep = vec3([...(Array.isArray(repeat) ? repeat : [1, 1]), 1], [1, 1, 1]);
  const key = `${url}|${rep[0]}|${rep[1]}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep[0] !== 1 || rep[1] !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
  }
  texCache.set(key, t);
  return t;
}

function material(spec, { doubleSide = false } = {}) {
  const opacity = Number.isFinite(spec.opacity) ? spec.opacity : 1;
  const m = new THREE.MeshStandardMaterial({
    color: spec.color || (spec.texture ? '#ffffff' : '#9aa4b2'),
    metalness: Number.isFinite(spec.metalness) ? spec.metalness : 0.05,
    roughness: Number.isFinite(spec.roughness) ? spec.roughness : 0.75,
    emissive: spec.emissive || '#000000',
    emissiveIntensity: Number.isFinite(spec.emissiveIntensity) ? spec.emissiveIntensity : 1,
    transparent: opacity < 1 || spec.type === 'image',
    opacity,
    wireframe: !!spec.wireframe,
    flatShading: !!spec.flatShading,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (spec.texture) {
    m.map = texture(spec.texture, spec.textureRepeat);
    if (spec.type === 'image') m.alphaTest = 0.02;
  }
  return m;
}

export function textTexture(value = 'Text', color = '#ffffff', background = null) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 96px Inter, system-ui, sans-serif';
  ctx.font = font;
  const lines = String(value).split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 10) + 48;
  const h = lines.length * 112 + 24;
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  ctx.font = font;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, 12 + i * 112));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, aspect: canvas.width / canvas.height };
}

function makeLight(spec) {
  const L = spec.light || {};
  const color = L.color || spec.color || '#ffffff';
  const intensity = Number.isFinite(L.intensity) ? L.intensity : 1;
  let light;
  switch (L.kind) {
    case 'point':
      light = new THREE.PointLight(color, intensity * 10, L.distance ?? 0, 2);
      break;
    case 'spot':
      light = new THREE.SpotLight(color, intensity * 10, L.distance ?? 0, (L.angle ?? 35) * D2R, 0.3, 2);
      break;
    case 'hemisphere':
      light = new THREE.HemisphereLight(color, L.groundColor || '#444433', intensity);
      break;
    case 'ambient':
      light = new THREE.AmbientLight(color, intensity);
      break;
    default:
      light = new THREE.DirectionalLight(color, intensity * 2);
      light.shadow.mapSize.set(2048, 2048);
      Object.assign(light.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 200 });
      light.shadow.bias = -0.0005;
  }
  if (light.castShadow !== undefined && spec.castShadow !== false && L.kind !== 'hemisphere' && L.kind !== 'ambient') {
    light.castShadow = L.kind !== 'point' || !!spec.castShadow;
  }
  return light;
}

function primitiveMesh(spec) {
  const mesh = new THREE.Mesh(geometry(spec.type), material(spec, { doubleSide: spec.type === 'plane' }));
  mesh.castShadow = spec.castShadow !== false;
  mesh.receiveShadow = spec.receiveShadow !== false;
  return mesh;
}

const INHERIT = ['color', 'emissive', 'metalness', 'roughness', 'opacity', 'flatShading', 'wireframe', 'castShadow', 'receiveShadow'];

function buildPart(part, depth = 0, base = {}) {
  part = { ...base, ...part };
  let obj;
  if (part.type === 'group' || (Array.isArray(part.parts) && !PRIMITIVES.includes(part.type))) {
    obj = new THREE.Group();
  } else {
    obj = primitiveMesh({ ...part, type: PRIMITIVES.includes(part.type) ? part.type : 'box' });
  }
  applyTransform(obj, part);
  if (part.name) obj.name = part.name;
  if (Array.isArray(part.parts) && depth < 6) {
    for (const child of part.parts) obj.add(buildPart(child, depth + 1, inherited(part)));
  }
  return obj;
}

function inherited(spec) {
  const out = {};
  for (const k of INHERIT) if (spec[k] !== undefined) out[k] = spec[k];
  return out;
}

// Small clickable stand-ins for things that have no geometry of their own.
function editorHelper(kind, color = '#ffd34d') {
  const g = new THREE.Group();
  const geo = kind === 'light' ? new THREE.OctahedronGeometry(0.3) : kind === 'audio' ? new THREE.IcosahedronGeometry(0.3) : new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true }));
  g.add(m);
  g.userData.helper = true;
  m.userData.helper = true;
  return g;
}

/**
 * Build a three.js object from an object spec.
 * In editor mode, invisible things (lights, audio, empties) get a pickable helper.
 */
export function buildObject(spec, { editor = false } = {}) {
  let obj;
  const type = spec.type || 'box';
  if (PRIMITIVES.includes(type)) {
    obj = primitiveMesh(spec);
  } else if (type === 'model') {
    obj = new THREE.Group();
    for (const part of spec.parts || []) obj.add(buildPart(part, 0, inherited(spec)));
    if (!obj.children.length) obj.add(primitiveMesh({ ...spec, type: 'box' }));
  } else if (type === 'image') {
    obj = new THREE.Mesh(geometry('quad'), material({ ...spec, type: 'image' }, { doubleSide: true }));
    obj.castShadow = spec.castShadow === true;
  } else if (type === 'text') {
    const t = spec.text || {};
    const { texture: tex, aspect } = textTexture(t.value ?? spec.name ?? 'Text', t.color || spec.color || '#ffffff', t.background || null);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    obj = new THREE.Mesh(geometry('quad'), m);
    const size = t.size || 1;
    obj.userData.textScale = [size * aspect, size, 1];
  } else if (type === 'video') {
    const mat = new THREE.MeshBasicMaterial({ color: '#111111', side: THREE.DoubleSide });
    if (spec.video?.src && typeof document !== 'undefined') {
      const v = document.createElement('video');
      Object.assign(v, { src: spec.video.src, crossOrigin: 'anonymous', loop: spec.video.loop !== false, muted: true, playsInline: true });
      if (editor || spec.video.autoplay !== false) v.play().catch(() => {});
      const vt = new THREE.VideoTexture(v);
      vt.colorSpace = THREE.SRGBColorSpace;
      mat.map = vt;
      mat.color.set('#ffffff');
      obj = new THREE.Mesh(geometry('quad'), mat);
      obj.userData.videoEl = v;
    } else {
      obj = new THREE.Mesh(geometry('quad'), mat);
    }
  } else if (type === 'light') {
    obj = new THREE.Group();
    const light = makeLight(spec);
    obj.add(light);
    if (light.target) { obj.add(light.target); light.target.position.set(0, -1, 0); }
    obj.userData.light = light;
    if (editor) obj.add(editorHelper('light', spec.light?.color || '#ffd34d'));
  } else if (type === 'audio') {
    obj = new THREE.Group();
    if (editor) obj.add(editorHelper('audio', '#7cc4ff'));
  } else {
    obj = new THREE.Group(); // 'empty', 'group', 'spawn', unknown
    if (editor) obj.add(editorHelper('empty', '#b1b5c3'));
  }

  applyTransform(obj, spec);
  if (obj.userData.textScale) {
    const s = obj.scale;
    const [a, b] = obj.userData.textScale;
    obj.scale.set(s.x * a, s.y * b, s.z);
  }
  if (type === 'light' && spec.light?.kind !== 'point' && spec.light?.kind !== 'spot') {
    // directional lights shine from their position towards the origin
    const light = obj.userData.light;
    if (light.target) {
      obj.remove(light.target);
      light.target.position.set(0, 0, 0);
    }
  }
  obj.name = spec.name || type;
  obj.visible = spec.visible !== false || editor;
  obj.userData.id = spec.id;
  obj.userData.spec = spec;
  if (spec.visible === false && editor) {
    obj.traverse((o) => { if (o.material && !o.userData.helper) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.25; } });
  }
  return obj;
}

export function applySettings(scene, settings = {}) {
  const bg = settings.background || '#8ec5ff';
  scene.background = new THREE.Color(bg);
  if (settings.skyTexture) {
    const t = texLoader.load(settings.skyTexture, (tx) => {
      tx.mapping = THREE.EquirectangularReflectionMapping;
      tx.colorSpace = THREE.SRGBColorSpace;
      scene.background = tx;
    });
    t.mapping = THREE.EquirectangularReflectionMapping;
  }
  scene.fog = settings.fog ? new THREE.Fog(settings.fog.color || bg, settings.fog.near ?? 20, settings.fog.far ?? 120) : null;
}

export function defaultLights(scene, settings = {}) {
  const amb = new THREE.HemisphereLight('#ffffff', '#55606e', Number.isFinite(settings.ambient) ? settings.ambient : 0.6);
  amb.userData.system = true;
  scene.add(amb);
  return amb;
}

export function sceneHasLights(doc) {
  return (doc.objects || []).some((o) => o.type === 'light');
}

export function addDefaultSun(scene) {
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(12, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 0.5, far: 200 });
  sun.userData.system = true;
  scene.add(sun);
  return sun;
}

// ================================================================ runtime

const SFX = {
  coin: [[988, 0.06, 'square'], [1319, 0.12, 'square']],
  jump: [[330, 0.05, 'square'], [660, 0.1, 'square']],
  hit: [[200, 0.08, 'sawtooth'], [120, 0.12, 'sawtooth']],
  shoot: [[880, 0.04, 'square'], [440, 0.06, 'square']],
  explosion: [[90, 0.25, 'sawtooth'], [50, 0.3, 'sawtooth']],
  powerup: [[523, 0.07, 'square'], [659, 0.07, 'square'], [784, 0.07, 'square'], [1047, 0.15, 'square']],
  win: [[523, 0.12, 'triangle'], [659, 0.12, 'triangle'], [784, 0.12, 'triangle'], [1047, 0.3, 'triangle']],
  lose: [[392, 0.15, 'triangle'], [330, 0.15, 'triangle'], [262, 0.35, 'triangle']],
  click: [[1200, 0.03, 'square']],
};

class Sound {
  constructor(game) { this.game = game; this.ctx = null; this.elements = new Set(); }
  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  beep({ freq = 440, duration = 0.1, type = 'square', volume = 0.15, delay = 0 } = {}) {
    const ctx = this._ctx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  sfx(name = 'click', volume = 0.15) {
    let delay = 0;
    for (const [freq, duration, type] of SFX[name] || SFX.click) {
      this.beep({ freq, duration, type, volume, delay });
      delay += duration * 0.9;
    }
  }
  play(nameOrUrl, { volume = 1, loop = false } = {}) {
    const ent = this.game.find(nameOrUrl);
    const src = ent?.spec?.audio?.src || nameOrUrl;
    if (!src || typeof src !== 'string') return null;
    const a = new Audio(src);
    a.crossOrigin = 'anonymous';
    a.volume = Math.max(0, Math.min(1, ent?.spec?.audio?.volume ?? volume));
    a.loop = ent?.spec?.audio?.loop ?? loop;
    a.play().catch(() => {});
    this.elements.add(a);
    a.addEventListener('ended', () => this.elements.delete(a));
    return a;
  }
  stopAll() {
    for (const a of this.elements) a.pause();
    this.elements.clear();
  }
}

class Input {
  constructor(dom) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false, dx: 0, dy: 0, wheel: 0 };
    this.dom = dom;
    this._h = [];
    const on = (t, e, f, o) => { t.addEventListener(e, f, o); this._h.push([t, e, f]); };
    on(window, 'keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    on(window, 'keyup', (e) => this.down.delete(e.code));
    on(window, 'blur', () => this.down.clear());
    on(dom, 'pointermove', (e) => {
      const r = dom.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    on(dom, 'pointerdown', () => { this.mouse.down = true; this.mouse.clicked = true; });
    on(window, 'pointerup', () => { this.mouse.down = false; });
    on(dom, 'wheel', (e) => { this.mouse.wheel += e.deltaY; }, { passive: true });
  }
  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  axis() {
    const d = (c) => (this.down.has(c) ? 1 : 0);
    return {
      x: d('KeyD') + d('ArrowRight') - d('KeyA') - d('ArrowLeft'),
      y: d('KeyW') + d('ArrowUp') - d('KeyS') - d('ArrowDown'),
    };
  }
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.dx = this.mouse.dy = this.mouse.wheel = 0;
  }
  // synthetic input (used by the AI playtester)
  press(code) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
  release(code) { this.down.delete(code); }
  dispose() { for (const [t, e, f] of this._h) t.removeEventListener(e, f); }
}

class Entity {
  constructor(game, object, spec) {
    this.game = game;
    this.object = object;
    this.spec = spec;
    this.body = spec.physics?.body || 'none';
    this.bounce = spec.physics?.bounce || 0;
    this.velocity = new THREE.Vector3(...vec3(spec.physics?.velocity, [0, 0, 0]));
    this.tags = new Set(spec.tags || []);
    this.props = { ...(spec.props || {}) };
    this.grounded = false;
    this.alive = true;
    this.box = new THREE.Box3();
    this._update = [];
    this._collide = [];
    this._touching = new Set();
  }
  get name() { return this.object.name; }
  get position() { return this.object.position; }
  get rotation() { return this.object.rotation; }
  get scale() { return this.object.scale; }
  get light() { return this.object.userData.light || null; }
  hasTag(t) { return this.tags.has(t); }
  onUpdate(fn) { this._update.push(fn); return this; }
  onCollide(fn) { this._collide.push(fn); return this; }
  setColor(c) {
    this.object.traverse((o) => { if (o.material?.color) o.material.color.set(c); });
    return this;
  }
  setText(value) {
    if (this.spec.type !== 'text' || !this.object.material) return this;
    const t = this.spec.text || {};
    const { texture: tex, aspect } = textTexture(String(value), t.color || this.spec.color || '#fff', t.background || null);
    this.object.material.map?.dispose();
    this.object.material.map = tex;
    this.object.material.needsUpdate = true;
    this.object.scale.x = this.object.scale.y * aspect;
    return this;
  }
  setVisible(v) { this.object.visible = !!v; return this; }
  destroy() { this.game.destroy(this); }
  distanceTo(o) { return this.position.distanceTo(o.position || o); }
  overlaps(o) { this.game._box(this); this.game._box(o); return this.box.intersectsBox(o.box); }
  lookAt(target) {
    const p = target.position || target;
    this.object.lookAt(p.x, p.y, p.z);
    return this;
  }
  moveTowards(target, step) {
    const p = target.position || target;
    const d = new THREE.Vector3().subVectors(p, this.position);
    const len = d.length();
    if (len > 1e-6) this.position.addScaledVector(d, Math.min(1, step / len));
    return this;
  }
  jump(speed = 8) {
    if (this.grounded) { this.velocity.y = speed; this.grounded = false; return true; }
    return false;
  }
  play(opts) { return this.game.sound.play(this.name, opts); }
}

/**
 * Runs a scene document. `hooks.onLog(level, text)`, `hooks.onEvent(type, data)`.
 */
export class Runtime {
  constructor(container, doc, hooks = {}) {
    this.container = container;
    this.doc = doc;
    this.hooks = hooks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!hooks.preserveDrawingBuffer });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.ui = this._makeUI(container);
    this.input = new Input(this.renderer.domElement);
    this.sound = new Sound(this);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.errorCount = 0;
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._start();
    this._resize();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ------------------------------------------------------------ public API
  log(...args) { this.hooks.onLog?.('log', args.map(fmt).join(' ')); }
  find(name) { return typeof name === 'string' ? this.entities.find((e) => e.alive && e.name === name) || null : name || null; }
  findAll(tag) { return this.entities.filter((e) => e.alive && (e.tags.has(tag) || e.name === tag)); }
  get player() { return this.find('Player'); }
  random(min = 0, max = 1) { return min + Math.random() * (max - min); }
  randomInt(min, max) { return Math.floor(this.random(min, max + 1)); }
  distance(a, b) { return (a.position || a).distanceTo(b.position || b); }
  onUpdate(fn) { this._update.push(fn); }
  onKeyDown(code, fn) { this._keys.push([code, fn]); }
  onClick(fn) { this._clicks.push(fn); }
  every(seconds, fn) { this._timers.push({ at: this.time + seconds, every: seconds, fn }); }
  after(seconds, fn) { this._timers.push({ at: this.time + seconds, fn }); }

  spawn(spec) {
    const s = { id: Math.random().toString(36).slice(2), ...spec };
    s.name = s.name || s.type || 'Spawned';
    const obj = buildObject(s);
    this.scene.add(obj);
    const e = new Entity(this, obj, s);
    this.entities.push(e);
    this._byObject.set(obj, e);
    if (s.script) this._compile(s.script, e, `${s.name} script`);
    return e;
  }
  clone(entity, overrides = {}) {
    const src = this.find(entity);
    if (!src) return null;
    const t = readTransform(src.object);
    return this.spawn({ ...structuredClone(src.spec), ...t, id: undefined, ...overrides });
  }
  destroy(e) {
    e = this.find(e);
    if (!e || !e.alive) return;
    e.alive = false;
    this.scene.remove(e.object);
    this._dirty = true;
  }

  pick() {
    this.raycaster.setFromCamera(new THREE.Vector2(this.input.mouse.x, this.input.mouse.y), this.camera);
    const hits = this.raycaster.intersectObjects(this.entities.filter((e) => e.alive).map((e) => e.object), true);
    for (const h of hits) {
      let o = h.object;
      while (o && !this._byObject.has(o)) o = o.parent;
      if (o) return this._byObject.get(o);
    }
    return null;
  }

  cameraFollow(target, { offset = [0, 4, 9], smooth = 8, lookHeight = 1, orbit = true } = {}) {
    this._orbit.enabled = false;
    this._follow = { target: this.find(target), offset: new THREE.Vector3(...offset), smooth, lookHeight, orbit, yaw: 0, pitch: 0 };
  }

  burst(position, { color = '#ffd34d', count = 16, speed = 5, size = 0.15, life = 0.7 } = {}) {
    const p = position.position || position;
    const geo = new THREE.BoxGeometry(size, size, size);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(p);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.scene.add(m);
      this._particles.push({ m, v, life, max: life });
    }
  }

  win(text = 'You win!') { this._end('win', text); }
  lose(text = 'Game over') { this._end('lose', text); }
  restart() { this._teardown(); this._start(); }

  // ------------------------------------------------------------ internals
  _start() {
    const doc = this.doc;
    const settings = doc.settings || {};
    this.time = 0;
    this.dt = 0;
    this.state = {};
    this.over = false;
    this.paused = false;
    this.gravity = Number.isFinite(settings.gravity) ? settings.gravity : 20;
    this.entities = [];
    this._byObject = new Map();
    this._update = [];
    this._keys = [];
    this._clicks = [];
    this._timers = [];
    this._particles = [];
    this._controllers = [];
    this._follow = null;
    this._fp = null;

    this.scene = new THREE.Scene();
    applySettings(this.scene, settings);
    defaultLights(this.scene, settings);
    if (!sceneHasLights(doc)) addDefaultSun(this.scene);

    const cam = settings.camera || {};
    this.camera = new THREE.PerspectiveCamera(cam.fov || 60, 1, 0.1, 2000);
    this.camera.position.set(...vec3(cam.position, [0, 8, 16]));
    this._orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this._orbit.enableDamping = true;
    this._orbit.target.set(...vec3(cam.lookAt, [0, 0, 0]));

    for (const spec of doc.objects || []) {
      try {
        const obj = buildObject(spec);
        this.scene.add(obj);
        const e = new Entity(this, obj, spec);
        this.entities.push(e);
        this._byObject.set(obj, e);
        if (spec.type === 'audio' && spec.audio?.autoplay) this.sound.play(spec.name);
      } catch (err) {
        this._error(`Could not build "${spec.name}": ${err.message}`);
      }
    }

    const target = cam.target && this.find(cam.target);
    if (cam.mode === 'follow' && target) this.cameraFollow(target, { offset: cam.offset || [0, 4, 9] });
    else if (cam.mode === 'firstPerson' && target) this.controls.firstPerson(target);
    else if (cam.mode === 'fixed') { this._orbit.enabled = false; this.camera.lookAt(...vec3(cam.lookAt, [0, 0, 0])); }

    if (doc.script) this._compile(doc.script, null, 'Game script');
    for (const e of [...this.entities]) if (e.spec.script) this._compile(e.spec.script, e, `${e.name} script`);
    this.hooks.onEvent?.('start', { entities: this.entities.length });
  }

  _teardown() {
    this.sound.stopAll();
    this.ui.layer.innerHTML = '';
    this.ui.overlay.style.display = 'none';
    this._orbit?.dispose();
    if (document.pointerLockElement) document.exitPointerLock();
    this.scene.traverse((o) => { if (o.userData.videoEl) o.userData.videoEl.pause(); });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this._teardown();
    this.input.dispose();
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ui.root.remove();
  }

  _compile(code, self, label) {
    try {
      const fn = new Function('game', 'self', 'THREE', `"use strict";\n${code}\n//# sourceURL=${label.replace(/[^\w.-]/g, '_')}.js`);
      this._guard(label, () => fn(this.api, self, THREE));
    } catch (err) {
      this._error(`${label}: ${err.message}`);
    }
  }

  _guard(label, fn, ...args) {
    try {
      return fn(...args);
    } catch (err) {
      this._error(`${label}: ${err && err.message ? err.message : err}`);
      return undefined;
    }
  }

  _error(text) {
    this.errorCount++;
    if (this.errorCount <= 50) this.hooks.onLog?.('error', text);
  }

  _end(kind, text) {
    if (this.over) return;
    this.over = true;
    this.sound.sfx(kind === 'win' ? 'win' : 'lose');
    this.ui.overlayTitle.textContent = text;
    this.ui.overlay.dataset.kind = kind;
    this.ui.overlay.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    this.hooks.onEvent?.(kind, { text, time: this.time });
  }

  _box(e) {
    e.box.setFromObject(e.object);
    return e.box;
  }

  _physics(dt) {
    const solids = this.entities.filter((e) => e.alive && e.body !== 'none');
    for (const e of solids) this._box(e);
    for (const e of solids) {
      if (e.body !== 'dynamic') continue;
      e.velocity.y -= this.gravity * dt;
      e.position.addScaledVector(e.velocity, dt);
      e.grounded = false;
      this._box(e);
      for (const o of solids) {
        if (o === e || o.body === 'trigger' || e.body === 'trigger') continue;
        if (!e.box.intersectsBox(o.box)) continue;
        const pen = [
          Math.min(e.box.max.x - o.box.min.x, o.box.max.x - e.box.min.x),
          Math.min(e.box.max.y - o.box.min.y, o.box.max.y - e.box.min.y),
          Math.min(e.box.max.z - o.box.min.z, o.box.max.z - e.box.min.z),
        ];
        const axis = pen.indexOf(Math.min(...pen));
        const k = ['x', 'y', 'z'][axis];
        const ec = (e.box.min[k] + e.box.max[k]) / 2;
        const oc = (o.box.min[k] + o.box.max[k]) / 2;
        const dir = ec >= oc ? 1 : -1;
        const share = o.body === 'dynamic' ? 0.5 : 1;
        const push = pen[axis] * dir * share;
        e.position[k] += push;
        e.box.min[k] += push; e.box.max[k] += push;
        if (o.body === 'dynamic') { o.position[k] -= push; this._box(o); }
        if (axis === 1 && dir > 0) {
          e.grounded = true;
          if (e.velocity.y < 0) e.velocity.y = e.bounce ? -e.velocity.y * e.bounce : 0;
          if (o.body === 'kinematic' && o._lastPos) e.position.add(new THREE.Vector3().subVectors(o.position, o._lastPos).setY(0));
        } else if (axis === 1 && dir < 0 && e.velocity.y > 0) e.velocity.y = 0;
        else if (axis !== 1) e.velocity[k] = e.bounce ? -e.velocity[k] * e.bounce : 0;
      }
    }
    for (const e of solids) if (e.body === 'kinematic') e._lastPos = e.position.clone();
  }

  _collisions() {
    const listeners = this.entities.filter((e) => e.alive && e._collide.length);
    if (!listeners.length) return;
    const pad = new THREE.Vector3(0.02, 0.02, 0.02);
    const others = this.entities.filter((e) => e.alive && !e.object.userData.light && e.spec.type !== 'audio');
    for (const e of others) this._box(e);
    for (const e of listeners) {
      const eb = e.box.clone().expandByVector(pad);
      const now = new Set();
      for (const o of others) {
        if (o === e || !o.alive || !e.alive) continue;
        if (!o.object.visible) continue;
        if (eb.intersectsBox(o.box)) {
          now.add(o);
          if (!e._touching.has(o)) for (const fn of e._collide) this._guard(`${e.name} onCollide`, fn, o);
        }
      }
      e._touching = now;
    }
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.hooks.beforeFrame?.(dt, this);
    if (!this.over && !this.paused) {
      this.time += dt;
      this.dt = dt;
      for (const [code, fn] of this._keys) if (this.input.wasPressed(code)) this._guard(`onKeyDown(${code})`, fn);
      if (this.input.mouse.clicked) for (const fn of this._clicks) this._guard('onClick', fn, this.pick());
      for (const t of this._timers) {
        if (t.done || this.time < t.at) continue;
        this._guard('timer', t.fn);
        if (t.every) t.at += t.every; else t.done = true;
      }
      this._timers = this._timers.filter((t) => !t.done);
      for (const fn of this._update) this._guard('onUpdate', fn, dt);
      for (const e of this.entities) if (e.alive) for (const fn of e._update) this._guard(`${e.name} onUpdate`, fn, dt);
      for (const c of this._controllers) if (c.entity.alive) this._guard('controller', c.update, dt);
      this._physics(dt);
      this._collisions();
    }
    for (const p of this._particles) {
      p.life -= dt;
      p.v.y -= 9 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) { this.scene.remove(p.m); p.m.material.dispose(); }
    }
    this._particles = this._particles.filter((p) => p.life > 0);
    if (this._dirty) {
      this.entities = this.entities.filter((e) => e.alive);
      this._byObject = new Map(this.entities.map((e) => [e.object, e]));
      this._dirty = false;
    }
    this._updateCamera(dt);
    for (const e of this.entities) if (e.spec.billboard) e.object.quaternion.copy(this.camera.quaternion);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    this.hooks.afterFrame?.(dt, this);
  }

  _updateCamera(dt) {
    if (this._fp) {
      const { target, eye } = this._fp;
      this.camera.position.set(target.position.x, target.position.y + eye, target.position.z);
      this.camera.rotation.set(this._fp.pitch, this._fp.yaw, 0, 'YXZ');
      return;
    }
    const f = this._follow;
    if (f && f.target && f.target.alive) {
      if (f.orbit && this.input.mouse.down && !document.pointerLockElement) {
        f.yaw -= this.input.mouse.dx * 0.005;
        f.pitch = Math.max(-0.6, Math.min(0.8, f.pitch - this.input.mouse.dy * 0.003));
      }
      const off = f.offset.clone().applyEuler(new THREE.Euler(f.pitch, f.yaw, 0, 'YXZ'));
      const want = f.target.position.clone().add(off);
      this.camera.position.lerp(want, 1 - Math.exp(-f.smooth * dt));
      this.camera.lookAt(f.target.position.x, f.target.position.y + f.lookHeight, f.target.position.z);
      return;
    }
    if (this._orbit.enabled) this._orbit.update();
  }

  get cameraYaw() {
    if (this._fp) return this._fp.yaw;
    if (this._follow) return this._follow.yaw;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return Math.atan2(-d.x, -d.z);
  }

  get controls() {
    const game = this;
    return {
      platformer(target, { speed = 6, jump = 9, turn = true, follow = true, offset } = {}) {
        const e = game.find(target);
        if (!e) return game._error(`controls.platformer: no entity "${target}"`);
        if (e.body === 'none' || e.body === 'static') e.body = 'dynamic';
        if (follow) game.cameraFollow(e, offset ? { offset } : {});
        game._controllers.push({
          entity: e,
          update: () => {
            const a = game.input.axis();
            const yaw = game.cameraYaw;
            const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const move = fwd.multiplyScalar(a.y).add(right.multiplyScalar(a.x));
            if (move.lengthSq() > 1) move.normalize();
            e.velocity.x = move.x * speed;
            e.velocity.z = move.z * speed;
            if (turn && move.lengthSq() > 0.01) e.rotation.y = Math.atan2(move.x, move.z);
            if (game.input.wasPressed('Space') && e.jump(jump)) game.sound.sfx('jump', 0.08);
          },
        });
        return e;
      },
      firstPerson(target, { speed = 5, jump = 7, eye = 0.7, sensitivity = 0.0025 } = {}) {
        const e = game.find(target);
        if (!e) return game._error(`controls.firstPerson: no entity "${target}"`);
        if (e.body === 'none' || e.body === 'static') e.body = 'dynamic';
        game._orbit.enabled = false;
        game._follow = null;
        game._fp = { target: e, eye, yaw: e.rotation.y, pitch: 0 };
        e.object.traverse((o) => { if (o.isMesh) o.visible = false; });
        const dom = game.renderer.domElement;
        if (!game._fpClickBound) {
          game._fpClickBound = true;
          dom.addEventListener('click', () => { if (game._fp && !game.over) dom.requestPointerLock?.(); });
        }
        game._controllers.push({
          entity: e,
          update: () => {
            const m = game.input.mouse;
            if (document.pointerLockElement === dom || m.down) {
              game._fp.yaw -= m.dx * sensitivity;
              game._fp.pitch = Math.max(-1.4, Math.min(1.4, game._fp.pitch - m.dy * sensitivity));
            }
            const a = game.input.axis();
            const yaw = game._fp.yaw;
            const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const move = fwd.multiplyScalar(a.y).add(right.multiplyScalar(a.x));
            if (move.lengthSq() > 1) move.normalize();
            e.velocity.x = move.x * speed;
            e.velocity.z = move.z * speed;
            e.rotation.y = yaw;
            if (game.input.wasPressed('Space')) e.jump(jump);
          },
        });
        return e;
      },
      topDown(target, { speed = 7 } = {}) {
        const e = game.find(target);
        if (!e) return game._error(`controls.topDown: no entity "${target}"`);
        game.cameraFollow(e, { offset: [0, 18, 10], orbit: false, lookHeight: 0 });
        game._controllers.push({
          entity: e,
          update: (dt) => {
            const a = game.input.axis();
            const v = new THREE.Vector3(a.x, 0, -a.y);
            if (v.lengthSq() > 1) v.normalize();
            if (e.body === 'dynamic') { e.velocity.x = v.x * speed; e.velocity.z = v.z * speed; }
            else e.position.addScaledVector(v, speed * dt);
            if (v.lengthSq() > 0.01) e.rotation.y = Math.atan2(v.x, v.z);
          },
        });
        return e;
      },
    };
  }

  get api() {
    if (this._api) return this._api;
    const g = this;
    this._api = {
      get time() { return g.time; },
      get dt() { return g.dt; },
      get scene() { return g.scene; },
      get camera() { return g.camera; },
      get input() { return g.input; },
      get state() { return g.state; },
      get entities() { return g.entities.filter((e) => e.alive); },
      get player() { return g.player; },
      get gravity() { return g.gravity; },
      set gravity(v) { g.gravity = v; },
      get controls() { return g.controls; },
      get over() { return g.over; },
      sound: g.sound,
      ui: g.ui.api,
      find: (n) => g.find(n),
      findAll: (t) => g.findAll(t),
      spawn: (s) => g.spawn(s),
      clone: (e, o) => g.clone(e, o),
      destroy: (e) => g.destroy(e),
      pick: () => g.pick(),
      onUpdate: (fn) => g.onUpdate(fn),
      onKeyDown: (c, fn) => g.onKeyDown(c, fn),
      onClick: (fn) => g.onClick(fn),
      every: (s, fn) => g.every(s, fn),
      after: (s, fn) => g.after(s, fn),
      random: (a, b) => g.random(a, b),
      randomInt: (a, b) => g.randomInt(a, b),
      distance: (a, b) => g.distance(a, b),
      cameraFollow: (t, o) => g.cameraFollow(t, o),
      burst: (p, o) => g.burst(p, o),
      win: (t) => g.win(t),
      lose: (t) => g.lose(t),
      restart: () => g.restart(),
      log: (...a) => g.log(...a),
      vec3: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    };
    return this._api;
  }

  _makeUI(container) {
    const root = document.createElement('div');
    root.className = 'nz-ui';
    root.innerHTML = `
      <style>
        .nz-ui{position:absolute;inset:0;pointer-events:none;font-family:Inter,system-ui,sans-serif;color:#fff;overflow:hidden}
        .nz-ui .nz-label{text-shadow:0 2px 6px rgba(0,0,0,.6);font-weight:700;white-space:pre}
        .nz-ui .nz-abs{position:absolute}
        .nz-ui .nz-anchor{position:absolute;display:flex;flex-direction:column;gap:4px}
        .nz-ui .nz-top-left{left:16px;top:14px}.nz-ui .nz-top-right{right:16px;top:14px;align-items:flex-end}
        .nz-ui .nz-top{left:50%;top:14px;transform:translateX(-50%);align-items:center}
        .nz-ui .nz-bottom{left:50%;bottom:16px;transform:translateX(-50%);align-items:center;flex-direction:column-reverse}
        .nz-ui .nz-center{left:50%;top:50%;transform:translate(-50%,-50%);align-items:center}
        .nz-ui .nz-msg{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:36px;font-weight:800;text-shadow:0 3px 12px rgba(0,0,0,.6);transition:opacity .3s}
        .nz-ui .nz-over{position:absolute;inset:0;display:none;flex-direction:column;gap:18px;align-items:center;justify-content:center;background:rgba(10,12,24,.55);backdrop-filter:blur(3px);pointer-events:auto}
        .nz-ui .nz-over h1{margin:0;font-size:48px;font-weight:900}
        .nz-ui .nz-over[data-kind=win] h1{color:#7dffb0}.nz-ui .nz-over[data-kind=lose] h1{color:#ff8a8a}
        .nz-ui .nz-over button{font:inherit;font-weight:700;font-size:16px;padding:12px 26px;border-radius:999px;border:0;background:#7c5cff;color:#fff;cursor:pointer}
      </style>
      <div class="nz-layer"></div>
      <div class="nz-anchors"><div class="nz-anchor nz-top-left"></div><div class="nz-anchor nz-top-right"></div><div class="nz-anchor nz-top"></div><div class="nz-anchor nz-bottom"></div><div class="nz-anchor nz-center"></div></div>
      <div class="nz-over"><h1></h1><button type="button">Play again</button></div>`;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(root);
    const layer = root.querySelector('.nz-layer');
    const overlay = root.querySelector('.nz-over');
    const overlayTitle = overlay.querySelector('h1');
    overlay.querySelector('button').addEventListener('click', () => this.restart());
    const labels = new Map();
    const anchors = {};
    root.querySelectorAll('.nz-anchor').forEach((a) => { anchors[a.classList[1].slice(3)] = a; });
    const px = (v) => (typeof v === 'number' ? `${v}px` : v);
    const api = {
      set(id, text, style = {}) {
        let el = labels.get(id);
        if (!el) {
          el = document.createElement('div');
          el.className = 'nz-label';
          labels.set(id, el);
        }
        el.textContent = String(text);
        el.style.fontSize = px(style.size) || el.style.fontSize || '22px';
        el.style.color = style.color || el.style.color || '#fff';
        if (style.x !== undefined || style.y !== undefined) {
          el.classList.add('nz-abs');
          el.style.left = px(style.x ?? 16);
          el.style.top = px(style.y ?? 16);
          if (el.parentElement !== layer) layer.appendChild(el);
        } else {
          const host = anchors[style.at] || (el.parentElement?.classList.contains('nz-anchor') ? el.parentElement : anchors['top-left']);
          if (el.parentElement !== host) host.appendChild(el);
        }
      },
      remove(id) { labels.get(id)?.remove(); labels.delete(id); },
      clear() { layer.innerHTML = ''; for (const a of Object.values(anchors)) a.innerHTML = ''; labels.clear(); },
      message(text, seconds = 2) {
        const el = document.createElement('div');
        el.className = 'nz-msg';
        el.textContent = text;
        layer.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, seconds * 1000);
      },
      snapshot() { return [...labels.entries()].map(([id, el]) => `${id}: ${el.textContent}`); },
    };
    return { root, layer: { set innerHTML(v) { api.clear(); } }, overlay, overlayTitle, api };
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

function fmt(v) {
  if (typeof v === 'string') return v;
  if (v && v.isVector3) return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
  try { return JSON.stringify(v); } catch { return String(v); }
}

// ---------------------------------------------------------------- playtest bot
const BOT_KEYS = ['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyD', 'KeyS', 'Space', 'Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];

export function attachPlaytester(rt, { duration = 12, onDone }) {
  const report = { duration, frames: 0, fpsSamples: [], events: [], track: [], startEntities: rt.entities.length };
  let next = 0;
  let held = [];
  let sampleAt = 0;
  rt.hooks.beforeFrame = (dt) => {
    if (rt.time >= next) {
      for (const k of held) rt.input.release(k);
      held = [];
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const k = BOT_KEYS[Math.floor(Math.random() * BOT_KEYS.length)];
        rt.input.press(k);
        held.push(k);
      }
      if (Math.random() < 0.3) {
        rt.input.mouse.x = Math.random() * 2 - 1;
        rt.input.mouse.y = Math.random() * 2 - 1;
        rt.input.mouse.clicked = true;
      }
      next = rt.time + 0.3 + Math.random() * 0.9;
    }
    if (dt > 0) report.fpsSamples.push(1 / dt);
  };
  const prevEvent = rt.hooks.onEvent;
  rt.hooks.onEvent = (type, data) => {
    prevEvent?.(type, data);
    report.events.push({ type, ...data, t: +rt.time.toFixed(2) });
    if (type === 'win' || type === 'lose') setTimeout(() => rt.restart(), 300);
  };
  const started = performance.now();
  rt.hooks.afterFrame = () => {
    report.frames++;
    if (rt.time >= sampleAt) {
      sampleAt = rt.time + 1;
      const p = rt.player || rt.entities.find((e) => e.body === 'dynamic');
      if (p) report.track.push({ t: +rt.time.toFixed(1), name: p.name, pos: p.position.toArray().map((n) => +n.toFixed(2)), grounded: p.grounded });
    }
    if ((performance.now() - started) / 1000 >= duration) {
      rt.hooks.afterFrame = null;
      rt.hooks.beforeFrame = null;
      for (const k of held) rt.input.release(k);
      const fps = report.fpsSamples;
      report.fps = fps.length ? { avg: Math.round(fps.reduce((a, b) => a + b, 0) / fps.length), min: Math.round(Math.min(...fps)) } : null;
      delete report.fpsSamples;
      report.endEntities = rt.entities.length;
      report.ui = rt.ui.api.snapshot();
      report.drawCalls = rt.renderer.info.render.calls;
      report.triangles = rt.renderer.info.render.triangles;
      try {
        const c = document.createElement('canvas');
        const src = rt.renderer.domElement;
        const scale = 512 / Math.max(src.width, src.height);
        c.width = Math.round(src.width * scale);
        c.height = Math.round(src.height * scale);
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        report.screenshot = c.toDataURL('image/jpeg', 0.7);
      } catch { /* tainted canvas */ }
      onDone(report);
    }
  };
}
