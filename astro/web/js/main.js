// Astro – huvudprogram och spelets tillståndsmaskin.
//   attract (startskärm) → boarding (gå in i skeppet, uppskjutning) → flight ⇄ orbit → end → attract
import * as THREE from '../vendor/three.module.min.js';
import { BODIES, BODY, TIPS, SOURCES } from './data.js';
import { t, L, setLang, getLang } from './i18n.js';
import { createShip, drawScreens, EYE_HEIGHT, GROUND_OFFSET } from './ship.js';
import { World, KM } from './world.js';
import { Hangar } from './hangar.js';
import { Flight } from './flight.js';
import { Input } from './input.js';
import { UI, esc } from './ui.js';
import { PresenceDetector } from './presence.js';
import { Sound } from './audio.js';
import { XR } from './xr.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const PLATFORM = params.get('platform') || (window.Capacitor ? 'android' : 'web');

// ---------- Inställningar (sparas lokalt på maskinen) ----------
const DEFAULTS = { lang: 'sv', camera: true, preview: false, sensitivity: 0.5, absentSec: 45, minutes: 20 };
function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('astro.settings') || '{}'); } catch { /* tomt */ }
  const o = { ...DEFAULTS, ...s };
  if (params.has('minutes')) o.minutes = parseFloat(params.get('minutes')) || 20;
  if (params.has('lang')) o.lang = params.get('lang');
  if (params.get('camera') === '0') o.camera = false;
  if (params.has('absent')) o.absentSec = parseFloat(params.get('absent')) || o.absentSec;
  return o;
}
const settings = loadSettings();
function saveSettings() { try { localStorage.setItem('astro.settings', JSON.stringify(settings)); } catch { /* ignorera */ } }
setLang(settings.lang);

// ---------- Renderare och scener ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.xr.enabled = true;
$('app').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 2e9);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const sound = new Sound();
const ui = new UI(sound);
const input = new Input();
const xr = new XR(renderer, ui);
const presence = new PresenceDetector({ sensitivity: settings.sensitivity });

let world, flight, hangar, parts;

const G = {
  state: 'loading',
  view: 'cockpit',
  session: null,
  current: null,     // himlakropp vi är i omloppsbana runt
  orbit: null,
  lastBase: 'earth',
  attractAngle: 0,
  absentFor: 0,
  stillThere: null,
  xrVisible: true,
  hudTimer: 0,
  tipTimer: 0,
  msg: '',
  msgUntil: 0,
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _m = new THREE.Matrix4();

// ---------- Hjälpfunktioner ----------
function fmtKm(km) {
  const lang = getLang();
  const nf = (d) => new Intl.NumberFormat(lang === 'sv' ? 'sv-SE' : 'en-GB', { maximumFractionDigits: d });
  if (km >= 1e9) return `${nf(1).format(km / 1e9)} ${lang === 'sv' ? 'miljarder km' : 'billion km'}`;
  if (km >= 1e6) return `${nf(1).format(km / 1e6)} ${lang === 'sv' ? 'miljoner km' : 'million km'}`;
  return `${nf(0).format(km)} km`;
}
function fmtTime(sec) {
  if (!isFinite(sec)) return '–';
  sec = Math.round(sec);
  if (sec < 60) return `${sec} s`;
  return `${Math.floor(sec / 60)} min ${sec % 60} s`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
function body(id) { return world.bodies.find((b) => b.data.id === id); }
function name(b) { return L((b.data || b).name); }
function later(ms, fn) {
  const token = G.session;
  setTimeout(() => { if (G.session === token) fn(); }, ms);
}
function translateDom() {
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('.lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  $('aSources').textContent = `${t('sources')}: ${SOURCES.join(' · ')}`;
}
function fade(on, white = false) {
  $('fade').classList.toggle('white', white);
  $('fade').classList.toggle('on', on);
}
function showMsg(text, kind = '', ms = 3500) {
  ui.toast(text, ms, kind);
  G.msg = text;
  G.msgUntil = performance.now() + ms;
}

// ---------- Kamera ----------
function inXR() { return renderer.xr.isPresenting; }

function cameraToCockpit() {
  parts.rig.add(camera);
  camera.position.set(0, inXR() ? 0 : EYE_HEIGHT, 0);
  camera.rotation.set(-0.06, 0, 0);
  G.view = 'cockpit';
}
function cameraToChase() {
  parts.ship.add(camera);
  const eye = V(0, 5.5, 22);
  camera.position.copy(eye);
  _m.lookAt(eye, V(0, 0, -8), UP);
  camera.quaternion.setFromRotationMatrix(_m);
  G.view = 'chase';
}
function toggleView() {
  if (inXR()) return;
  if (G.view === 'cockpit') cameraToChase(); else cameraToCockpit();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = camera.aspect < 1 ? 85 : 70;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

// ---------- Uppstart ----------
async function boot() {
  translateDom();
  await new Promise((r) => setTimeout(r, 30)); // låt laddningsskärmen ritas
  world = new World(scene);
  flight = new Flight(world);
  hangar = new Hangar();
  parts = createShip();
  scene.add(parts.ship);
  parts.gear.visible = false;
  ui.attachTo(parts.rig);
  xr.setupControllers(parts.rig);
  onResize();

  if (matchMedia('(pointer: coarse)').matches || PLATFORM === 'android') {
    document.body.classList.add('touch');
    $('touch').hidden = false;
  }
  setupTouch();
  setupAttractDom();
  setupAdmin();

  if (await xr.check()) $('vrBtn').hidden = false;
  xr.addEventListener('start', onXRStart);
  xr.addEventListener('end', onXREnd);
  // Headsetet av = besökaren har gått. Quest pausar då renderingen, så vi mäter tiden själva.
  xr.addEventListener('visibility', (e) => {
    G.xrVisible = e.detail === 'visible';
    if (!G.xrVisible) G.hiddenAt = performance.now();
    else resumeAfterHidden(15);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) G.hiddenAt = performance.now();
    else resumeAfterHidden(settings.absentSec);
  });

  presence.addEventListener('arrive', onArrive);
  presence.addEventListener('leave', onLeave);
  if (settings.camera) startCamera();

  $('loading').hidden = true;
  toAttract();
  renderer.setAnimationLoop(frame);

  // Installerad Meta Quest-app (immersiv PWA): gå direkt in i VR.
  if (PLATFORM === 'quest' && 'getDigitalGoodsService' in window && xr.supported) {
    xr.enter().catch(() => {});
  }
}

async function startCamera() {
  const ok = await presence.start();
  updateCamIndicator();
  if (!ok) console.info('[astro] ingen kamera – använder aktivitet som närvarosignal');
}

function updateCamIndicator() {
  const el = $('camIndicator');
  if (!presence.available) { el.className = 'cam'; el.textContent = t('cameraOff'); return; }
  el.className = 'cam ' + (presence.present ? 'here' : 'empty');
  el.textContent = presence.present ? t('cameraOn') : t('cameraEmpty');
}

// ---------- Närvaro ----------
function onArrive() {
  updateCamIndicator();
  if (G.state === 'attract') {
    $('presenceHint').textContent = t('welcome');
    $('presenceHint').classList.add('here');
    $('startBtn').classList.add('pulse');
    sound.init();
    sound.chord([660, 880], 0.3);
  }
}
function onLeave() {
  updateCamIndicator();
  if (G.state === 'attract') {
    $('presenceHint').textContent = t('stepCloser');
    $('presenceHint').classList.remove('here');
    $('startBtn').classList.remove('pulse');
  }
  if (G.state === 'end') G.leftAt = performance.now();
}

function resumeAfterHidden(limitSec) {
  const away = G.hiddenAt ? (performance.now() - G.hiddenAt) / 1000 : 0;
  G.hiddenAt = 0;
  if (G.session && away > limitSec) endSession('absent');
}

function someoneHere() {
  if (inXR()) return G.xrVisible;
  const recentInput = performance.now() - input.lastActivity < (presence.available ? 15000 : 90000);
  return recentInput || (presence.available && presence.present);
}

function checkPresence(dt) {
  if (!G.session || G.state === 'end') return;
  if (someoneHere()) {
    G.absentFor = 0;
    if (G.stillThere) closeStillThere();
    return;
  }
  G.absentFor += dt;
  const limit = inXR() ? 15 : settings.absentSec;
  if (G.absentFor > limit && !G.stillThere) openStillThere();
  if (G.stillThere) {
    const left = Math.ceil(15 - (G.absentFor - limit));
    if (left !== G.stillThere.left) {
      G.stillThere.left = left;
      if (left <= 0) { closeStillThere(); endSession('absent'); return; }
      ui.dialog(stillThereSpec(left));
    }
  }
}
function stillThereSpec(left) {
  return {
    title: t('stillThere'), body: [t('stillThereText', left)],
    buttons: [{ label: t('imHere'), primary: true, onClick: () => { input.activity(); closeStillThere(); } }],
  };
}
function openStillThere() {
  G.stillThere = { prev: ui.current, left: -1 };
  sound.alarm();
}
function closeStillThere() {
  const prev = G.stillThere?.prev;
  G.stillThere = null;
  G.absentFor = 0;
  if (prev) ui.dialog(prev); else ui.close();
}

// ---------- Startskärm ----------
function setupAttractDom() {
  $('startBtn').addEventListener('click', () => startSession());
  $('vrBtn').addEventListener('click', () => { sound.init(); xr.enter().catch((e) => console.warn(e)); });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    settings.lang = b.dataset.lang;
    setLang(settings.lang);
    saveSettings();
    translateDom();
    onLeave(); if (presence.present) onArrive();
  }));
}

function toAttract() {
  G.state = 'attract';
  G.session = null;
  G.stillThere = null;
  ui.close();
  fade(false);
  sound.silence();
  $('hud').hidden = true;
  $('bigText').textContent = '';
  if (hangar.parts) hangar.exit();
  if (!parts.ship.parent) scene.add(parts.ship);
  flight.reset();
  flight.setTarget(null);
  G.current = null; G.orbit = null; world.freeze = null;
  flight.placeNear(body('earth'), body('moon'));
  if (inXR()) {
    cameraToCockpit();
    $('attract').hidden = true;
    showXRStart();
  } else {
    scene.add(camera);
    $('attract').hidden = false;
    onLeave(); if (presence.present) onArrive();
  }
}

function showXRStart() {
  ui.dialog({
    kicker: 'ASTRO', title: t('welcome'), subtitle: t('subtitle'), body: [t('controlsVR'), t('cameraNotice')],
    buttons: [
      { label: t('start'), primary: true, onClick: () => startSession() },
      { label: getLang() === 'sv' ? 'English' : 'Svenska', keepOpen: true, onClick: () => { settings.lang = getLang() === 'sv' ? 'en' : 'sv'; setLang(settings.lang); saveSettings(); translateDom(); showXRStart(); } },
    ],
  });
}

function onXRStart() {
  input.xrSession = xr.session;
  ui.setXR(true);
  $('attract').hidden = true;
  $('hud').hidden = true;
  if (G.state === 'attract') toAttract();
  else if (G.state === 'flight' || G.state === 'orbit' || G.state === 'end') cameraToCockpit();
  if (ui.current) ui.render();
}
function onXREnd() {
  input.xrSession = null;
  ui.setXR(false);
  if (G.state === 'attract') toAttract();
  else if (G.state === 'boarding') { /* kameran sitter kvar i gångvägen */ } else { cameraToCockpit(); $('hud').hidden = false; }
  if (ui.current) ui.render();
}

// ---------- Spelomgång ----------
function startSession() {
  if (G.state !== 'attract') return;
  sound.init();
  ui.close();
  G.session = {
    start: performance.now(),
    limit: settings.minutes * 60,
    visited: new Set(['earth']),
    unlocked: new Set(['earth', 'moon']),
    stars: 0,
    warned5: false, warned1: false,
  };
  G.absentFor = 0;
  flight.reset();
  $('attract').hidden = true;
  $('hud').hidden = inXR();
  $('statusPanel').hidden = true; $('navPanel').hidden = true;
  $('skipBtn').hidden = false;
  $('mission').textContent = t('boarding');
  G.state = 'boarding';
  scene.remove(camera);
  hangar.enter(parts, camera, inXR());
  showMsg(t('boarding'), '', 4000);
}

$('skipBtn').addEventListener('click', () => hangar.skip());

function onHangarEvent(e) {
  if (e === 'seated') {
    cameraToCockpit();
    $('skipBtn').hidden = true;
  } else if (e.startsWith('count:')) {
    const n = e.split(':')[1];
    $('bigText').textContent = n;
    sound.beep(660, 0.15);
    sound.say(n, getLang());
  } else if (e === 'liftoff') {
    $('bigText').textContent = t('liftoff');
    sound.say(t('liftoff'), getLang());
    sound.boom();
    setTimeout(() => { if (G.state === 'boarding') $('bigText').textContent = ''; }, 1500);
  } else if (e === 'done') {
    fade(true, true);
    later(700, () => { beginSpace(); fade(false, true); });
  }
}

function beginSpace() {
  hangar.exit();
  scene.add(parts.ship);
  cameraToCockpit();
  G.state = 'flight';
  $('statusPanel').hidden = false; $('navPanel').hidden = false;
  const earth = body('earth'), moon = body('moon');
  flight.placeNear(earth, moon);
  flight.setTarget(moon);
  $('mission').textContent = t('missionMoon');
  showMsg(t('missionMoon'), 'good', 5000);
  showControlsHint();
  G.tipTimer = 18;
}

function showControlsHint() {
  $('hint').textContent = document.body.classList.contains('touch') ? t('controlsTouch') : t('controlsKeys');
  later(15000, () => { $('hint').textContent = ''; });
}

function toggleAutopilot() {
  if (!flight.target) return;
  flight.autopilot = !flight.autopilot;
  sound.click();
  showMsg(`${t('autopilot')}: ${flight.autopilot ? t('on') : t('off')}`, '', 1800);
}
function toggleWarp() {
  if (!flight.warpUnlocked) { showMsg(t('warpLocked'), 'warn'); sound.fail(); return; }
  flight.warp = !flight.warp;
  sound.beep(flight.warp ? 440 : 220, 0.3, 'sawtooth', 0.12);
  showMsg(`${t('warp')}: ${flight.warp ? t('on') : t('off')}`, '', 1800);
}

function handleFlightEvents(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'arrive': enterOrbit(e.body); return;
      case 'approach': showMsg(t('arriving', name(e.body)), 'good'); break;
      case 'asteroid': showMsg(t('asteroid'), 'warn', 1800); sound.boom(); break;
      case 'collide': showMsg(`${t('hullDamage')} (${name(e.body)})`, 'warn'); sound.boom(); break;
      case 'heat': showMsg(t('tooHot'), 'warn'); sound.alarm(); break;
      case 'lowFuel': showMsg(t('lowFuel'), 'warn'); sound.alarm(); break;
      case 'lowOxygen': showMsg(t('lowOxygen'), 'warn'); sound.alarm(); break;
      case 'outOfFuel': showMsg(t('ionDrive'), 'warn', 5000); break;
      case 'beltWarpOff': showMsg(getLang() === 'sv' ? 'Asteroidbältet! Warp avstängd – styr runt stenarna.' : 'Asteroid belt! Warp off – steer around the rocks.', 'warn', 4000); break;
      case 'autopilotOff': showMsg(`${t('autopilot')}: ${t('off')}`, '', 1500); break;
      case 'rescue': rescue(); return;
      default: break;
    }
  }
}

function rescue() {
  G.state = 'rescue';
  fade(true);
  sound.alarm();
  later(1200, () => {
    const base = body(G.lastBase) || body('earth');
    const target = flight.target;
    flight.refill();
    flight.autopilot = false; flight.warp = false;
    flight.placeNear(base, target);
    G.state = 'flight';
    fade(false);
    showMsg(t('rescue'), 'warn', 5000);
  });
}

// ---------- Ankomst, fakta och frågor ----------
function enterOrbit(b) {
  const S = G.session;
  G.state = 'orbit';
  G.current = b;
  world.freeze = b.data.id;
  flight.autopilot = false; flight.warp = false; flight.speed = 0;
  flight.refill();
  const rel = flight.pos.clone().sub(b.pos);
  G.orbit = { mode: 'orbit', angle: Math.atan2(rel.z, rel.x), radius: b.R * 2.6, t: 0 };
  sound.success();
  showMsg(t('orbit', name(b)), 'good', 4000);
  const first = !S.visited.has(b.data.id);
  if (first) { S.visited.add(b.data.id); S.stars += 2; }
  G.lastBase = b.data.id;
  G.firstVisit = first;
  G.factPage = 0;
  later(1600, () => showArrival(b));
}

function factsPage(b, page) {
  const all = L(b.data.facts);
  const per = 3;
  const pages = Math.ceil(all.length / per);
  const p = page % pages;
  return { lines: all.slice(p * per, p * per + per), pages };
}

function showArrival(b) {
  const { lines, pages } = factsPage(b, G.factPage);
  const hasQuiz = !!b.data.quiz && !G.session.answeredQuiz?.has(b.data.id);
  const buttons = [];
  if (b.data.landable && G.orbit?.mode === 'orbit') buttons.push({ label: t('land'), onClick: () => land(b) });
  if (pages > 1) buttons.push({ label: `${t('facts')} ${(G.factPage % pages) + 1}/${pages} →`, keepOpen: true, onClick: () => { G.factPage++; showArrival(b); } });
  buttons.push({
    label: hasQuiz ? `${t('quiz')} →` : t('continue'), primary: true,
    onClick: () => (hasQuiz ? showQuiz(b) : afterQuiz(b)),
  });
  ui.dialog({
    kicker: G.orbit?.mode === 'landed' ? t('landed', name(b)) : t('orbit', name(b)),
    title: name(b), subtitle: L(b.data.type), body: lines, bullets: true,
    note: b.data.realTrip ? `${t('realTrip')}: ${L(b.data.realTrip)}` : '',
    buttons,
  });
}

function showQuiz(b) {
  const q = L(b.data.quiz);
  ui.dialog({
    kicker: `${t('quiz')} – ${name(b)}`, title: q.q,
    buttons: q.options.map((o, i) => ({ label: o, primary: i === 0, onClick: () => answer(b, i) })),
    columns: 1,
  });
}

function answer(b, i) {
  const S = G.session;
  const q = L(b.data.quiz);
  const ok = i === q.answer;
  S.answeredQuiz = S.answeredQuiz || new Set();
  S.answeredQuiz.add(b.data.id);
  S.stars += ok ? 3 : 1;
  if (ok) sound.success(); else sound.fail();
  ui.dialog({
    kicker: `${t('quiz')} – ${name(b)}`,
    title: ok ? t('correct') : t('wrong', q.options[q.answer]),
    body: [q.q],
    buttons: [{ label: t('continue'), primary: true, onClick: () => afterQuiz(b) }],
  });
}

function afterQuiz(b) {
  const S = G.session;
  const newly = [];
  for (const other of BODIES) {
    if (other.unlockedBy === b.data.id && !S.unlocked.has(other.id)) {
      S.unlocked.add(other.id);
      newly.push(L(other.name));
    }
  }
  const notes = [];
  if (b.data.id === 'moon' && !flight.warpUnlocked) {
    flight.warpUnlocked = true;
    notes.push(t('warpUnlocked'));
  }
  if (newly.length) notes.push(t('newUnlocked', newly.join(', ')));
  if (notes.length) {
    sound.chord([523, 784, 1047, 1568]);
    ui.dialog({
      kicker: '★', title: notes[0], body: notes.slice(1),
      buttons: [{ label: t('chooseTarget'), primary: true, onClick: () => showMap(true) }],
    });
  } else showMap(true);
}

const MAP_ORDER = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

function showMap(fromOrbit) {
  const S = G.session;
  if (!S) return;
  const buttons = [];
  for (const id of MAP_ORDER) {
    const b = body(id);
    if (G.current && fromOrbit && G.current.data.id === id) continue;
    const unlocked = S.unlocked.has(id);
    let sub;
    if (!unlocked) sub = t('unlockAfter', L(BODY[b.data.unlockedBy].name));
    else sub = (S.visited.has(id) ? `${t('visitedMark')} · ` : '') + fmtKm(world.realDistanceKm(flight.pos, b));
    buttons.push({
      label: (unlocked ? '' : '🔒 ') + name(b), sub, disabled: !unlocked,
      cls: S.visited.has(id) ? 'visited' : '', primary: unlocked && !S.visited.has(id) && !buttons.some((x) => x.primary),
      onClick: () => departTo(b),
    });
  }
  if (!fromOrbit) buttons.push({ label: t('close'), back: true, onClick: () => {} });
  ui.dialog({ kicker: t('map'), title: t('chooseTarget'), buttons, columns: 2, wide: true });
}

function departTo(b) {
  flight.setTarget(b);
  $('mission').textContent = t('missionTo', name(b));
  if (G.state === 'orbit') {
    // Lämna omloppsbanan och peka mot det nya målet.
    if (G.orbit?.mode === 'landed') parts.gear.visible = false;
    const cur = G.current;
    flight.placeNear(cur, b);
    G.state = 'flight';
    G.orbit = null;
    G.current = null;
    world.freeze = null;
    removeSite();
  }
  showMsg(t('missionTo', name(b)), 'good', 4000);
  if (flight.warpUnlocked && world.realDistanceKm(flight.pos, b) > 5e6) {
    later(4200, () => showMsg(getLang() === 'sv' ? 'Tips: slå på autopiloten (P) eller warp (F)!' : 'Tip: turn on the autopilot (P) or warp (F)!', '', 4000));
  }
}

// ---------- Landning ----------
let site = null;
function regolithTexture(color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = color; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 60 - 30;
    c.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 200})`;
    c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 3 + Math.random() * 14;
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  return tex;
}
function flagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 160;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b1a33'; c.fillRect(0, 0, 256, 160);
  c.fillStyle = '#ff7a1a'; c.fillRect(0, 120, 256, 40);
  c.fillStyle = '#fff'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.fillText('ASTRO', 128, 90);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSite(b, n, f) {
  removeSite();
  const R = b.R;
  const group = new THREE.Group();
  // Böjd markbit som följer den riktiga sfären (planetens egen mesh är för grov på nära håll).
  const size = 1400;
  const g = new THREE.PlaneGeometry(size, size, 80, 80);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const d = V(x, R, z).normalize().multiplyScalar(R);
    p.setXYZ(i, d.x, d.y - R, d.z);
  }
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: regolithTexture(b.data.color), roughness: 1 }));
  group.add(ground);
  const rockMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.data.color).multiplyScalar(0.8), roughness: 1, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = 12 + Math.random() * 140;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.sqrt(R * R - x * x - z * z) - R;
    const s = 0.2 + Math.random() * (i < 4 ? 3 : 1.2);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(x, y + s * 0.3, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    group.add(rock);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }));
  pole.position.set(-5, 1.3, -14);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  flag.position.set(-4.2, 2.1, -14);
  group.add(flag);

  const right = V().crossVectors(f, n).normalize();
  _m.makeBasis(right, n, f.clone().negate());
  group.quaternion.setFromRotationMatrix(_m);
  group.position.copy(n).multiplyScalar(R); // relativt planetens centrum
  b.group.add(group);
  site = { group, body: b };
}
function removeSite() {
  if (!site) return;
  site.body.group.remove(site.group);
  site.group.traverse((o) => { o.geometry?.dispose?.(); });
  site = null;
}

function land(b) {
  const o = G.orbit;
  if (!o) return;
  // Välj landningsplats så att jorden (eller solen) syns en bit över horisonten.
  const refBody = b.data.id === 'moon' ? body('earth') : body('sun');
  const ref = refBody.pos.clone().sub(b.pos).normalize();
  let axis = V().crossVectors(ref, UP);
  if (axis.lengthSq() < 1e-6) axis = V(1, 0, 0);
  axis.normalize();
  const n = ref.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(68)).normalize();
  const f = ref.clone().addScaledVector(n, -ref.dot(n)).normalize();
  buildSite(b, n, f);
  const to = b.pos.clone().addScaledVector(n, b.R + GROUND_OFFSET);
  const right = V().crossVectors(f, n).normalize();
  _m.makeBasis(right, n, f.clone().negate());
  const qTo = new THREE.Quaternion().setFromRotationMatrix(_m);
  Object.assign(o, { mode: 'landing', t: 0, from: flight.pos.clone(), to, qFrom: flight.quat.clone(), qTo, mid: b.pos.clone().addScaledVector(n, b.R * 1.6) });
  parts.gear.visible = true;
  sound.engine(0.6, false);
}

function onLanded(b) {
  sound.boom();
  showMsg(t('landed', name(b)), 'good', 5000);
  if (G.session) G.session.stars += 1;
  later(1500, () => showArrival(b));
}

function updateOrbit(dt) {
  const o = G.orbit, b = G.current;
  if (!o || !b) return;
  if (o.mode === 'orbit') {
    o.angle += dt * 0.06;
    const target = b.pos.clone().add(V(Math.cos(o.angle) * o.radius, o.radius * 0.18, Math.sin(o.angle) * o.radius));
    flight.pos.lerp(target, Math.min(1, dt * 0.8));
    const tangent = V(-Math.sin(o.angle), 0, Math.cos(o.angle));
    const look = b.pos.clone().addScaledVector(tangent, b.R * 1.3);
    _m.lookAt(flight.pos, look, UP);
    flight.quat.slerp(new THREE.Quaternion().setFromRotationMatrix(_m), Math.min(1, dt * 1.2));
  } else if (o.mode === 'landing') {
    o.t += dt / 7;
    const k = Math.min(1, o.t);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    // Kvadratisk Bezier via en punkt ovanför landningsplatsen
    const a = o.from.clone().lerp(o.mid, e), c = o.mid.clone().lerp(o.to, e);
    flight.pos.copy(a.lerp(c, e));
    flight.quat.slerpQuaternions(o.qFrom, o.qTo, Math.min(1, e * 1.4));
    sound.engine(0.5 * (1 - k) + 0.1, false);
    if (k >= 1) { o.mode = 'landed'; sound.engine(0, false); onLanded(b); }
  }
}

// ---------- Slut ----------
function endSession(reason) {
  if (!G.session) return;
  const S = G.session;
  flight.autopilot = false;
  sound.silence();
  if (G.state === 'boarding') {
    // Tiden tog slut (eller besökaren gick) redan under uppskjutningen.
    hangar.exit();
    scene.add(parts.ship);
    flight.placeNear(body('earth'), body('moon'));
    cameraToCockpit();
    $('bigText').textContent = '';
    $('skipBtn').hidden = true;
    fade(false);
  }
  if (reason === 'absent') {
    showMsg(t('newVisitor'), '', 3000);
    toAttract();
    return;
  }
  G.state = 'end';
  const visited = S.visited.size - 1;
  const dist = fmtKm(flight.distanceTravelled / 1000);
  sound.chord([784, 659, 523, 392], 0.8);
  sound.say(t('timeUp'), getLang());
  ui.dialog({
    kicker: t('timeUp'), title: t('summary'),
    body: [t('summaryText', visited, S.stars, dist), t('thanks')],
    buttons: [{ label: t('playAgain'), primary: true, onClick: () => toAttract() }],
  });
  later(30000, () => { if (G.state === 'end') toAttract(); });
}

function checkTimer() {
  const S = G.session;
  if (!S || G.state === 'end' || G.state === 'attract') return;
  const left = S.limit - (performance.now() - S.start) / 1000;
  if (!S.warned5 && left <= 300 && S.limit > 300) { S.warned5 = true; showMsg(t('warn5'), 'warn', 5000); sound.say(t('warn5'), getLang()); }
  if (!S.warned1 && left <= 60 && S.limit > 60) { S.warned1 = true; showMsg(t('warn1'), 'warn', 5000); sound.say(t('warn1'), getLang()); }
  if (left <= 0) { G.stillThere = null; endSession('time'); }
  return left;
}

// ---------- HUD ----------
function updateHUD() {
  const S = G.session;
  if (!S) return;
  const left = Math.max(0, S.limit - (performance.now() - S.start) / 1000);
  const tgt = flight.target;
  const distKm = tgt ? world.realDistanceKm(flight.pos, tgt) : 0;
  const temp = Math.round(world.temperatureC(flight.pos));
  const near = world.nearest(flight.pos).body;
  const dir = flight.targetDirection();
  const speedText = flight.speedText(t);
  const eta = G.state === 'orbit' ? '–' : fmtTime(flight.etaSeconds());

  if (!$('hud').hidden) {
    $('timer').textContent = fmtClock(left);
    $('timer').classList.toggle('low', left < 60);
    $('hSpeed').textContent = speedText;
    const meter = (id, v) => { const el = $(id); el.style.width = `${Math.round(v * 100)}%`; el.classList.toggle('low', v < 0.2); $(id + 'Txt').textContent = `${Math.round(v * 100)}%`; };
    meter('hFuel', flight.fuel); meter('hO2', flight.oxygen); meter('hHull', flight.hull);
    $('hTemp').textContent = `${temp} °C`;
    $('hNear').textContent = near ? name(near) : '–';
    $('hTarget').textContent = tgt ? name(tgt) : '–';
    $('hDist').textContent = tgt ? fmtKm(distKm) : '–';
    $('hEta').textContent = eta;
    $('hStars').textContent = S.stars;
    $('hVisited').textContent = S.visited.size - 1;
    const ca = $('chipAuto'); ca.textContent = `${t('autopilot')} ${flight.autopilot ? t('on') : t('off')}`; ca.className = 'chip' + (flight.autopilot ? ' on' : '');
    const cw = $('chipWarp'); cw.textContent = `${t('warp')} ${flight.warp ? t('on') : t('off')}`; cw.className = 'chip warp' + (flight.warp ? ' on' : '') + (flight.warpUnlocked ? '' : ' locked');
    $('tAuto').classList.toggle('active', flight.autopilot);
    $('tWarp').classList.toggle('active', flight.warp);
    updateCamIndicator();
  }
  drawScreens(parts.screens, {
    labels: {
      status: t('status'), fuel: t('fuel'), oxygen: t('oxygen'), hull: t('hull'), temp: t('temp'), target: t('target'),
      distance: t('distance'), speed: t('speed'), eta: t('eta'), autopilot: t('autopilot'), warp: t('warp'),
      on: t('on'), off: t('off'), timeLeft: t('timeLeft'), stars: t('stars'), visited: t('visited'),
    },
    fuel: flight.fuel, oxygen: flight.oxygen, hull: flight.hull, tempText: `${temp} °C`,
    targetName: tgt ? name(tgt) : '–', distText: tgt ? fmtKm(distKm) : '–', speedText, etaText: eta,
    autopilot: flight.autopilot, warp: flight.warp, warpLocked: !flight.warpUnlocked,
    dirX: dir.x, dirY: dir.y, dirBehind: dir.behind,
    timeText: fmtClock(left), timeLow: left < 60, stars: S.stars, visited: S.visited.size - 1,
    msg: performance.now() < G.msgUntil ? G.msg : '',
  });
}

const _mv = new THREE.Vector3();
function updateMarker() {
  const el = $('marker');
  const tgt = flight.target;
  if (!tgt || G.state !== 'flight' || ui.open || $('hud').hidden) { el.style.display = 'none'; return; }
  camera.updateMatrixWorld();
  _mv.copy(tgt.pos).sub(flight.pos).applyMatrix4(camera.matrixWorldInverse);
  const behind = _mv.z > 0;
  const p = _mv.clone().applyMatrix4(camera.projectionMatrix);
  let x = p.x, y = p.y;
  if (behind) { x = -x; y = -y; }
  const W = window.innerWidth, H = window.innerHeight;
  const onScreen = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.88;
  el.style.display = 'block';
  el.querySelector('.label').textContent = `${name(tgt)} · ${fmtKm(world.realDistanceKm(flight.pos, tgt))}`;
  if (onScreen) {
    el.classList.remove('edge');
    el.style.left = `${((x + 1) / 2) * W}px`;
    el.style.top = `${((1 - y) / 2) * H}px`;
    el.style.transform = 'translate(-50%, -50%)';
  } else {
    const a = Math.atan2(y, x);
    const k = 0.85 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)) * 1.05);
    const ex = Math.cos(a) * k, ey = Math.sin(a) * k * 0.95;
    el.classList.add('edge');
    el.style.left = `${((ex + 1) / 2) * W}px`;
    el.style.top = `${((1 - ey) / 2) * H}px`;
    el.style.transform = `translate(-50%, -50%) rotate(${Math.PI / 2 - a}rad)`;
    el.querySelector('.label').textContent = '';
  }
}

function updateTips(dt) {
  if (G.state !== 'flight') return;
  G.tipTimer -= dt;
  if (G.tipTimer <= 0) {
    const list = TIPS[getLang()];
    const tip = list[Math.floor(Math.random() * list.length)];
    $('tip').innerHTML = `<b>${esc(t('tip'))}</b> ${esc(tip)}`;
    $('tip').classList.add('show');
    if (inXR()) showMsg(tip, '', 9000);
    G.tipTimer = 32;
    setTimeout(() => $('tip').classList.remove('show'), 11000);
  }
}

// ---------- Pekkontroller ----------
function setupTouch() {
  const stick = $('stick'), knob = $('knob');
  let id = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    input.touch.x = dx; input.touch.y = -dy;
    knob.style.transform = `translate(${dx * 50}px, ${dy * 50}px)`;
  };
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); move(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; input.touch.x = 0; input.touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  const hold = (el, key) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); input.touch[key] = true; el.setPointerCapture(e.pointerId); });
    const off = () => { input.touch[key] = false; };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  };
  hold($('tGas'), 'thrust');
  hold($('tBrake'), 'brake');
  const tap = (el, action) => el.addEventListener('click', () => { input.actions.add(action); input.activity(); });
  tap($('tAuto'), 'autopilot'); tap($('tWarp'), 'warp'); tap($('tMap'), 'map'); tap($('tView'), 'view');
}

// ---------- Administratörspanel ----------
function setupAdmin() {
  const open = () => {
    $('admin').hidden = false;
    $('aLang').value = settings.lang;
    $('aCamera').checked = settings.camera;
    $('aPreview').checked = settings.preview;
    $('aSens').value = settings.sensitivity;
    $('aAbsent').value = settings.absentSec;
    $('aMinutes').value = settings.minutes;
    presence.setPreview(settings.preview ? $('aCanvas') : null);
    G.adminTimer = setInterval(() => {
      $('aScore').textContent = presence.available
        ? `score ${presence.score.toFixed(2)} · ${presence.present ? 'NÄRVARO' : 'tomt'}${presence.faceDetector ? ` · ansikten: ${presence.faces}` : ''}`
        : t('cameraOff');
    }, 250);
  };
  const close = () => { $('admin').hidden = true; clearInterval(G.adminTimer); presence.setPreview(null); };
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); if ($('admin').hidden) open(); else close(); }
  });
  let taps = [];
  $('cornerTap').addEventListener('pointerdown', () => {
    const now = performance.now();
    taps = taps.filter((x) => now - x < 3000);
    taps.push(now);
    if (taps.length >= 5) { taps = []; open(); }
  });
  $('aPreview').addEventListener('change', () => presence.setPreview($('aPreview').checked ? $('aCanvas') : null));
  $('aCalibrate').addEventListener('click', () => presence.calibrate());
  $('aFullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  });
  $('aReset').addEventListener('click', () => { close(); toAttract(); });
  $('aSave').addEventListener('click', async () => {
    settings.lang = $('aLang').value;
    settings.camera = $('aCamera').checked;
    settings.preview = $('aPreview').checked;
    settings.sensitivity = parseFloat($('aSens').value);
    settings.absentSec = Math.max(10, parseFloat($('aAbsent').value) || 45);
    settings.minutes = Math.max(1, parseFloat($('aMinutes').value) || 20);
    saveSettings();
    setLang(settings.lang);
    translateDom();
    presence.sensitivity = settings.sensitivity;
    if (settings.camera && !presence.running) await startCamera();
    if (!settings.camera && presence.running) { presence.stop(); updateCamIndicator(); }
    close();
  });
}

// ---------- Spelloopen ----------
let last = performance.now();
const ZERO = { steerX: 0, steerY: 0, roll: 0, thrust: 0, brake: 0 };

function handleActions() {
  if (ui.open) {
    for (const a of ['navUp', 'navDown', 'navLeft', 'navRight', 'navNext', 'confirm', 'back']) if (input.take(a)) ui.nav(a);
  } else if (G.state === 'attract') {
    if (input.take('confirm')) startSession();
  } else if (G.state === 'boarding') {
    if (input.take('confirm') || input.take('back')) hangar.skip();
  } else if (G.state === 'flight') {
    if (input.take('autopilot') || input.take('confirm')) toggleAutopilot();
    if (input.take('warp')) toggleWarp();
    if (input.take('map')) showMap(false);
    if (input.take('view')) toggleView();
  }
  if (input.take('view') && G.state !== 'attract') toggleView();
  input.clearActions();
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inp = input.update();
  handleActions();
  xr.update();

  let activeScene = scene;
  if (G.state === 'boarding') {
    activeScene = hangar.scene;
    for (const e of hangar.update(dt)) onHangarEvent(e);
    sound.engine(hangar.phase === 'liftoff' ? 1 : hangar.phase === 'countdown' ? 0.3 : 0, false);
  } else {
    if (G.state === 'flight') {
      const evs = flight.update(dt, ui.open ? ZERO : inp, { frozen: false });
      handleFlightEvents(evs);
      sound.engine(flight.thrustLevel, flight.warp);
      updateTips(dt);
    } else if (G.state === 'orbit') {
      updateOrbit(dt);
      if (G.orbit?.mode !== 'landing') sound.engine(0.05, false);
    } else if (G.state === 'attract' && !inXR()) {
      G.attractAngle += dt * 0.05;
      const r = 26;
      camera.position.set(Math.sin(G.attractAngle) * r, 6 + Math.sin(G.attractAngle * 0.7) * 3, Math.cos(G.attractAngle) * r);
      camera.lookAt(0, 0, 0);
      flight.quat.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), dt * 0.01));
    }
    parts.ship.position.set(0, 0, 0);
    parts.ship.quaternion.copy(flight.quat);
    world.update(flight.pos, dt);
    const glow = 1.2 + flight.thrustLevel * 3 + (flight.warp ? 3 : 0);
    parts.engineGlow.forEach((g) => g.scale.setScalar(glow * (0.95 + Math.random() * 0.1)));
    parts.stick.rotation.set(-inp.steerY * 0.35, 0, -inp.steerX * 0.35);
  }

  checkTimer();
  checkPresence(dt);

  G.hudTimer -= dt;
  if (G.hudTimer <= 0 && G.session) { G.hudTimer = 0.2; updateHUD(); }
  updateMarker();

  renderer.render(activeScene, camera);
}

// Offline-stöd (PWA) när spelet körs från en webbserver, t.ex. i Meta Quest.
if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot().catch((e) => {
  console.error(e);
  $('loading').innerHTML = `<div class="logo small">ASTRO</div><p>Fel vid start: ${esc(e.message)}</p>`;
});

// Exponera för felsökning och automatiska tester.
window.astro = { G, get flight() { return flight; }, get world() { return world; }, startSession, toAttract, enterOrbit: (id) => enterOrbit(body(id)), showArrivalAgain: () => G.current && showArrival(G.current), input, ui, presence, settings };
