// Astro – reklamfilm. Renderar spelets riktiga 3D-scener bildruta för bildruta
// (deterministiskt) med textskyltar ovanpå. Styrs av render-promo.mjs.
import * as THREE from '../web/vendor/three.module.min.js';
import { World, KM } from '../web/js/world.js';
import { createShip, drawScreens, EYE_HEIGHT, GROUND_OFFSET } from '../web/js/ship.js';
import { Hangar } from '../web/js/hangar.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);
export const FPS = 30;
export const DURATION = 30;

const gl = document.createElement('canvas');
gl.width = W; gl.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const out = document.getElementById('out');
out.width = W; out.height = H;
const ctx = out.getContext('2d');

const camera = new THREE.PerspectiveCamera(W / H < 1 ? 80 : 55, W / H, 0.03, 2e9);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0);
const world = new World(scene);
const parts = createShip();
scene.add(parts.ship);
parts.gear.visible = false;
const hangar = new Hangar();
const body = (id) => world.bodies.find((b) => b.data.id === id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _m = new THREE.Matrix4();
const shipPos = V();
const shipQuat = new THREE.Quaternion();

function lookQuat(from, to, up = UP) { _m.lookAt(from, to, up); return new THREE.Quaternion().setFromRotationMatrix(_m); }
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

function screens(o) {
  drawScreens(parts.screens, {
    labels: { status: 'STATUS', fuel: 'Bränsle', oxygen: 'Syre', hull: 'Skrov', temp: 'Yttertemp.', target: 'Mål', distance: 'Avstånd', speed: 'Hastighet', eta: 'Framme om', autopilot: 'Autopilot', warp: 'Warp', on: 'PÅ', off: 'AV', timeLeft: 'Tid kvar', stars: 'Stjärnor', visited: 'Besökta' },
    fuel: 0.86, oxygen: 0.93, hull: 1, tempText: '4 °C', targetName: o.target, distText: o.dist, speedText: o.speed, etaText: o.eta,
    autopilot: true, warp: !!o.warp, warpLocked: false, dirX: 0.02, dirY: 0.03, dirBehind: false,
    timeText: o.time, timeLow: false, stars: o.stars ?? 0, visited: o.visited ?? 0, msg: o.msg || '',
  });
}

// ---------- Månens landningsplats ----------
let site = null;
function buildMoonSite() {
  const moon = body('moon'), earth = body('earth');
  const ref = earth.pos.clone().sub(moon.pos).normalize();
  const axis = V().crossVectors(ref, UP).normalize();
  const n = ref.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(72)).normalize();
  const f = ref.clone().addScaledVector(n, -ref.dot(n)).normalize();
  const R = moon.R;
  const group = new THREE.Group();
  const g = new THREE.PlaneGeometry(1400, 1400, 90, 90);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = V(x, R, z).normalize().multiplyScalar(R);
    const bump = Math.sin(x * 0.05) * Math.cos(z * 0.043) * 0.6;
    p.setXYZ(i, d.x, d.y - R + bump, d.z);
  }
  g.computeVertexNormals();
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#a9a9a9'; c.fillRect(0, 0, 256, 256);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 5000; i++) { const v = rnd() * 60 - 30; c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 200})`; c.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  for (let i = 0; i < 22; i++) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 3 + rnd() * 14, 0, 7); c.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(40, 40);
  group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })));
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 1, flatShading: true });
  for (let i = 0; i < 60; i++) {
    const a = rnd() * 7, r = 10 + rnd() * 150, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.sqrt(R * R - x * x - z * z) - R, s = 0.2 + rnd() * (i < 5 ? 2.5 : 1);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(x, y + s * 0.3, z); rock.rotation.set(rnd() * 3, rnd() * 3, 0); group.add(rock);
  }
  // Flagga
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 160;
  const fx = fc.getContext('2d');
  fx.fillStyle = '#0b1a33'; fx.fillRect(0, 0, 256, 160); fx.fillStyle = '#ff7a1a'; fx.fillRect(0, 120, 256, 40);
  fx.fillStyle = '#fff'; fx.font = 'bold 64px sans-serif'; fx.textAlign = 'center'; fx.fillText('ASTRO', 128, 90);
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }));
  pole.position.set(-6, 1.3, -10); group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide }));
  flag.position.set(-5.2, 2.1, -10); group.add(flag);
  const right = V().crossVectors(f, n).normalize();
  _m.makeBasis(right, n, f.clone().negate());
  group.quaternion.setFromRotationMatrix(_m);
  group.position.copy(n).multiplyScalar(R);
  moon.group.add(group);
  site = { group, n, f, right, pos: moon.pos.clone().addScaledVector(n, R) };
}

// ---------- Tagningar ----------
// Varje tagning: [start, slut, funktion(u = 0..1 inom tagningen, t = sekunder inom tagningen)]
const SHOTS = [
  [0, 3.5, shotIntro],
  [3.5, 10.5, shotLaunch],
  [10.5, 15, shotCockpit],
  [15, 19.5, shotMoon],
  [19.5, 23.5, shotSaturn],
  [23.5, 26.5, shotJupiter],
  [26.5, 30, shotEnd],
];

let activeScene = scene;
let current = -1;

function inSpace() {
  activeScene = scene;
  camera.fov = W / H < 1 ? 80 : 55; camera.updateProjectionMatrix();
  if (hangar.parts) hangar.exit();
  if (parts.ship.parent !== scene) scene.add(parts.ship);
  parts.gear.visible = false;
  if (camera.parent !== scene) scene.add(camera);
}

function placeCameraAtShip(localPos, localTarget) {
  // Kamera i skeppets koordinater (skeppet står i origo, flytande origo)
  const p = localPos.clone().applyQuaternion(shipQuat);
  const tg = localTarget.clone().applyQuaternion(shipQuat);
  camera.position.copy(p);
  camera.quaternion.copy(lookQuat(p, tg, V(0, 1, 0).applyQuaternion(shipQuat)));
}

function updateWorld(dt) {
  parts.ship.position.set(0, 0, 0);
  parts.ship.quaternion.copy(shipQuat);
  world.update(shipPos, dt);
}

function shotIntro(u, t, dt, first) {
  if (first) inSpace();
  const earth = body('earth'), sun = body('sun');
  // Kameran glider förbi jorden med solen i bakgrunden
  const toSun = sun.pos.clone().sub(earth.pos).normalize().applyAxisAngle(UP, 1.15);
  const side = V().crossVectors(toSun, UP).normalize();
  shipPos.copy(earth.pos).addScaledVector(toSun, earth.R * 2.6).addScaledVector(side, earth.R * lerp(1.2, 0.2, u)).addScaledVector(UP, earth.R * 0.35);
  shipQuat.copy(lookQuat(shipPos, earth.pos.clone().addScaledVector(side, -earth.R * 0.4)));
  parts.ship.visible = false;
  camera.position.set(0, 0, 0);
  camera.quaternion.copy(shipQuat);
  updateWorld(dt);
  return { caption: [0.4, 3.2, 'Tekniska museet presenterar'], fadeIn: 0.8 };
}

function shotLaunch(u, t, dt, first) {
  if (first) {
    parts.ship.visible = true;
    const dummy = new THREE.Object3D();
    hangar.enter(parts, dummy, false);
    hangar.walker.remove(dummy);
    hangar.scene.add(camera);
    parts.door.position.z = 1.4;
    hangar.phase = 'countdown'; hangar.t = 0; hangar.lastCount = 6;
    activeScene = hangar.scene;
  }
  // Nedräkning 0–3.5 s, lyft därefter
  if (t < 3.2) { hangar.phase = 'countdown'; hangar.t = 2 + t * (3 / 3.2); }
  else if (hangar.phase !== 'liftoff' && hangar.phase !== 'done') { hangar.phase = 'liftoff'; hangar.t = 0; hangar.vel = 0; }
  hangar.update(hangar.phase === 'countdown' ? 0 : dt);
  const ship = parts.ship;
  // Kameran: låg vinkel vid plattan, följer skeppet uppåt
  const a = 0.55 + u * 0.45;
  camera.position.set(Math.cos(a) * 24, 1.7 + u * 2, Math.sin(a) * 24 + 2);
  const target = ship.position.clone().add(V(0, 1, 0));
  const q = lookQuat(camera.position, target);
  camera.quaternion.slerp(q, first ? 1 : 0.25);
  const count = t < 3.2 ? 3 - Math.floor(t / (3.2 / 3)) : 0;
  return {
    caption: [0.2, 3.0, 'Kliv ombord på rymdskeppet'],
    big: count > 0 ? String(count) : t < 4.6 ? 'LYFT!' : '',
    bigT: t < 3.2 ? (t % (3.2 / 3)) / (3.2 / 3) : (t - 3.2) / 1.4,
    rumble: t > 3.2,
  };
}

function shotCockpit(u, t, dt, first) {
  if (first) {
    inSpace();
    parts.ship.visible = true;
    parts.rig.add(camera);
  }
  const earth = body('earth'), moon = body('moon');
  const dir = moon.pos.clone().sub(earth.pos).normalize();
  const dist = earth.pos.distanceTo(moon.pos);
  const k = lerp(0.955, 0.972, u);
  const side = V().crossVectors(dir, UP).normalize();
  shipPos.copy(earth.pos).addScaledVector(dir, dist * k).addScaledVector(side, 1400).addScaledVector(UP, 500);
  shipQuat.copy(lookQuat(shipPos, moon.pos.clone().addScaledVector(side, moon.R * 0.6)));
  camera.position.set(0, EYE_HEIGHT + 0.15, 0.45);
  camera.rotation.set(-0.12, 0, 0);
  parts.engineGlow.forEach((g) => g.scale.setScalar(4));
  const remaining = Math.round((1 - k) * 384400);
  screens({ target: 'Månen', dist: `${remaining.toLocaleString('sv-SE')} km`, speed: '8,0 km/s', eta: `${Math.max(1, Math.round(9 - u * 4))} s`, time: '17:42', msg: 'Uppdrag 1: Flyg till Månen' });
  updateWorld(dt);
  return { caption: [0.2, 4.3, 'Flyg till Månen'] };
}

function shotMoon(u, t, dt, first) {
  if (first) {
    inSpace();
    if (!site) buildMoonSite();
    world.freeze = 'moon';
    parts.gear.visible = true;
    parts.ship.visible = true;
  }
  const moon = body('moon');
  const { n, f, right } = site;
  shipPos.copy(site.pos).addScaledVector(n, GROUND_OFFSET);
  _m.makeBasis(right, n, f.clone().negate());
  shipQuat.setFromRotationMatrix(_m);
  // Kameran bakom skeppet och tittar framåt – jorden står en bit över månhorisonten
  const a = lerp(0.95, 0.45, ease(u));
  const local = V(Math.sin(a) * 15, 0.4 + u * 0.8, Math.cos(a) * 15 + 3);
  const camWorld = local.clone().applyQuaternion(shipQuat);
  camera.position.copy(camWorld);
  const lookAt = V(-3, 5.5, -30).applyQuaternion(shipQuat);
  camera.fov = 40; camera.updateProjectionMatrix();
  camera.quaternion.copy(lookQuat(camWorld, lookAt, n));
  parts.engineGlow.forEach((g) => g.scale.setScalar(1.2));
  updateWorld(dt);
  void moon;
  return { caption: [0.2, 4.3, 'Landa och upptäck'] };
}

function shotSaturn(u, t, dt, first) {
  if (first) { inSpace(); world.freeze = null; parts.gear.visible = false; parts.ship.visible = true; }
  const sat = body('saturn');
  const sun = body('sun');
  const toSun = sun.pos.clone().sub(sat.pos).normalize();
  const side = V().crossVectors(toSun, UP).normalize();
  const start = sat.pos.clone().addScaledVector(toSun, sat.R * 3.2).addScaledVector(side, -sat.R * 2.2).addScaledVector(UP, sat.R * 0.55);
  const end = sat.pos.clone().addScaledVector(toSun, sat.R * 2.4).addScaledVector(side, sat.R * 0.3).addScaledVector(UP, sat.R * 0.45);
  shipPos.lerpVectors(start, end, u);
  const heading = end.clone().sub(start).normalize();
  shipQuat.copy(lookQuat(shipPos, shipPos.clone().add(heading)));
  shipQuat.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.sin(u * 3) * 0.08));
  parts.engineGlow.forEach((g) => g.scale.setScalar(3.5 + Math.sin(t * 40) * 0.2));
  placeCameraAtShip(V(-9 + u * 4, 1.4, 17), V(2, 3.2, -30));
  updateWorld(dt);
  return { caption: [0.2, 3.8, 'Lås upp planeterna – ända bort till Pluto'] };
}

function shotJupiter(u, t, dt, first) {
  if (first) { inSpace(); parts.ship.visible = true; }
  const jup = body('jupiter');
  const sun = body('sun');
  const toSun = sun.pos.clone().sub(jup.pos).normalize();
  const side = V().crossVectors(toSun, UP).normalize();
  // Warp in mot Jupiter: snabbt i början, bromsar in
  const k = 1 - Math.pow(1 - u, 3);
  const approach = toSun.clone().multiplyScalar(-1).applyAxisAngle(UP, 0.5);
  const start = jup.pos.clone().addScaledVector(approach, -jup.R * 30);
  const end = jup.pos.clone().addScaledVector(approach, -jup.R * 3.2).addScaledVector(side, jup.R * 0.9).addScaledVector(UP, jup.R * 0.3);
  shipPos.lerpVectors(start, end, k);
  shipQuat.copy(lookQuat(shipPos, jup.pos.clone().addScaledVector(side, jup.R * 1.3)));
  parts.engineGlow.forEach((g) => g.scale.setScalar(u < 0.6 ? 7 : 3));
  placeCameraAtShip(V(-5, 1.8, 15), V(4, 3.2, -40));
  updateWorld(dt);
  return { caption: [0.1, 2.9, 'I VR, på dator och mobil'], warp: 1 - clamp01(u / 0.6) };
}

function shotEnd(u, t, dt, first) {
  if (first) inSpace();
  const moon = body('moon'), earth = body('earth');
  const dir = earth.pos.clone().sub(moon.pos).normalize();
  const side = V().crossVectors(dir, UP).normalize();
  shipPos.copy(moon.pos).addScaledVector(dir, -moon.R * 3.4).addScaledVector(side, moon.R * lerp(1.6, 1.2, u)).addScaledVector(UP, moon.R * 0.5);
  shipQuat.copy(lookQuat(shipPos, moon.pos.clone().addScaledVector(side, -moon.R * 1.4)));
  parts.ship.visible = false;
  camera.position.set(0, 0, 0);
  camera.quaternion.copy(shipQuat);
  updateWorld(dt);
  return { endCard: clamp01(t / 0.8) };
}

// ---------- Textskyltar ----------
const FONT = 'DejaVu Sans, system-ui, sans-serif';
function textShadow(on) { ctx.shadowColor = on ? 'rgba(0,0,0,0.75)' : 'transparent'; ctx.shadowBlur = on ? 18 * (H / 1080) : 0; }

function drawCaption(text, alpha) {
  if (alpha <= 0) return;
  const s = H / 1080;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${Math.round(64 * s)}px ${FONT}`;
  ctx.textAlign = 'center';
  const y = H - 130 * s;
  const w = ctx.measureText(text).width;
  const grd = ctx.createLinearGradient(0, y - 90 * s, 0, y + 40 * s);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, y - 90 * s, W, 170 * s);
  textShadow(true);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W / 2, y + (1 - alpha) * 12 * s, W - 80 * s);
  // tunn orange linje under
  textShadow(false);
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(W / 2 - Math.min(w, W * 0.8) / 2 * alpha, y + 26 * s, Math.min(w, W * 0.8) * alpha, 5 * s);
  ctx.restore();
}

function drawBig(text, k) {
  if (!text) return;
  const s = H / 1080;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k * 0.9);
  ctx.font = `900 ${Math.round((230 + k * 90) * s)}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(47,168,255,0.9)'; ctx.shadowBlur = 50 * s;
  ctx.fillStyle = '#fff';
  ctx.fillText(text, W / 2, H * 0.42);
  ctx.restore();
}

function drawWarp(k, frame) {
  if (k <= 0) return;
  const s = H / 1080;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  let seed = 1234 + frame * 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2, r0 = (0.15 + rnd() * 0.5) * W * 0.5, len = (80 + rnd() * 420) * s * k;
    const cx = W / 2 + Math.cos(a) * r0, cy = H / 2 + Math.sin(a) * r0 * 0.7;
    ctx.strokeStyle = `rgba(${170 + rnd() * 80 | 0},${200 + rnd() * 55 | 0},255,${0.25 + 0.5 * k})`;
    ctx.lineWidth = (1 + rnd() * 2.5) * s;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.7); ctx.stroke();
  }
  ctx.restore();
}

function drawEndCard(k) {
  const s = H / 1080;
  ctx.save();
  ctx.fillStyle = `rgba(3,8,20,${0.55 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  ctx.textAlign = 'center';
  // Logotext ASTRO
  ctx.font = `900 ${Math.round(230 * s)}px ${FONT}`;
  const g = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.5);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#9fd8ff'); g.addColorStop(1, '#2fa8ff');
  ctx.shadowColor = 'rgba(47,168,255,0.8)'; ctx.shadowBlur = 60 * s;
  ctx.fillStyle = g;
  const sp = 0.12 * 230 * s;
  const letters = 'ASTRO'.split('');
  const widths = letters.map((l) => ctx.measureText(l).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (letters.length - 1);
  let x = W / 2 - total / 2;
  ctx.textAlign = 'left';
  letters.forEach((l, i) => { ctx.fillText(l, x, H * 0.47); x += widths[i] + sp; });
  ctx.textAlign = 'center';
  ctx.shadowBlur = 16 * s; ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.fillStyle = '#e6f2ff';
  ctx.font = `600 ${Math.round(50 * s)}px ${FONT}`;
  ctx.fillText('Ett rymdäventyr i 3D – flyg till Månen och vidare ut i solsystemet', W / 2, H * 0.575, W - 120 * s);
  ctx.fillStyle = '#ffd966';
  ctx.font = `600 ${Math.round(38 * s)}px ${FONT}`;
  ctx.fillText('Dator · Mobil · VR', W / 2, H * 0.645);
  // Avsändare
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(W / 2 - 170 * s, H * 0.725, 340 * s, 5 * s);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(58 * s)}px ${FONT}`;
  ctx.fillText('Upplev det på Tekniska museet', W / 2, H * 0.81, W - 120 * s);
  ctx.fillStyle = '#9fb7d3';
  ctx.font = `500 ${Math.round(34 * s)}px ${FONT}`;
  ctx.fillText('Stockholm', W / 2, H * 0.87);
  ctx.restore();
}

// ---------- Bildruta ----------
let lastFrame = -1;
export function renderFrame(frame) {
  const time = frame / FPS;
  const dt = lastFrame < 0 ? 1 / FPS : (frame - lastFrame) / FPS;
  lastFrame = frame;
  const idx = SHOTS.findIndex(([a, b]) => time >= a && time < b);
  const i = idx < 0 ? SHOTS.length - 1 : idx;
  const [a, b, fn] = SHOTS[i];
  const first = i !== current;
  current = i;
  const t = time - a;
  const u = clamp01(t / (b - a));
  const o = fn(u, t, dt, first) || {};

  renderer.render(activeScene, camera);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(gl, 0, 0);

  if (o.warp) drawWarp(o.warp, frame);
  if (o.big !== undefined) drawBig(o.big, o.bigT || 0);
  if (o.caption) {
    const [c0, c1, text] = o.caption;
    const al = clamp01((t - c0) / 0.35) * clamp01((c1 - t) / 0.35);
    drawCaption(text, al);
  }
  if (o.endCard !== undefined) drawEndCard(o.endCard);

  // Övergångar: kort svart toning mellan tagningar, och in/ut i början/slutet
  const edge = Math.min(t, b - a - t);
  let fade = edge < 0.25 ? 1 - edge / 0.25 : 0;
  if (i === 0) fade = Math.max(0, 1 - t / (o.fadeIn || 0.5));
  if (i === 0 && t > 0.5) fade = edge < 0.25 && b - a - t < 0.25 ? 1 - (b - a - t) / 0.25 : fade;
  if (i === SHOTS.length - 1 && b - a - t < 0.6) fade = Math.max(fade, 1 - (b - a - t) / 0.6);
  if (i === SHOTS.length - 1 && t < 0.25) fade = 0; // mjuk övergång in i slutskylten sker via endCard
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; ctx.fillRect(0, 0, W, H); }
  return { rumble: !!o.rumble, shot: i };
}

export function frameJPEG(q = 0.93) { return out.toDataURL('image/jpeg', q); }
window.promo = { renderFrame, frameJPEG, FPS, DURATION, ready: true };
