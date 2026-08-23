/**
 * Digital Islam — a VR / MR / XR companion.
 *
 * This file wires the pieces together: it owns the engine, the shared state
 * (where you are, which way the Qibla is, what time the next prayer is) and the
 * feature registry that the hub menu opens and closes.
 */

import * as THREE from 'three';
import { Engine, MODE } from './core/engine.js';
import { Interaction } from './core/interaction.js';
import { Locomotion } from './core/locomotion.js';
import { AudioEngine } from './core/audio.js';
import { store } from './core/store.js';
import { requestLocation, qiblaBearing, cityFromTimeZone, KAABA } from './core/geo.js';
import { prayerWindow, PRAYER_LABELS } from './core/prayer-times.js';

import { Environment } from './features/environment.js';
import { QuranBook } from './features/quran-book.js';
import { PrayerMat } from './features/prayer-mat.js';
import { Qibla } from './features/qibla.js';
import { Tasbih } from './features/tasbih.js';
import { NamesGallery } from './features/names-gallery.js';
import { KaabaScene } from './features/kaaba.js';
import { TimesPanel, PrayerWatcher } from './features/times-panel.js';
import { CalendarPanel } from './features/calendar-panel.js';
import { LibraryPanel } from './features/library-panel.js';
import { DuasPanel } from './features/duas-panel.js';
import { LearnPanel } from './features/learn-panel.js';
import { ZakatPanel, StatsPanel } from './features/tools-panel.js';
import { SettingsPanel } from './features/settings-panel.js';
import { Hub } from './features/hub.js';

class App extends EventTarget {
  constructor() {
    super();
    this.store = store;
    this.engine = new Engine(document.getElementById('app'));
    this.interaction = new Interaction(this.engine);
    this.audio = new AudioEngine(store);
    this.locomotion = new Locomotion(this);

    this.location = store.get('location');
    this.northOffset = 0;        // rotation from world -Z to true north
    this.northCalibrated = false;
    this.floorY = 0;
    this.heightOffset = 0;
    this.activeFeature = null;
    this.features = {};
    this.prayerWindow = null;

    this.environment = new Environment(this);
    this.hub = new Hub(this);
    this.watcher = new PrayerWatcher(this);

    this._buildFeatures();
    this._buildReticle();
    this._bindUI();
    this._bindKeys();
    this._startClock();
  }

  // ---- setup ---------------------------------------------------------------

  _buildFeatures() {
    this.book = new QuranBook(this);
    this.mat = new PrayerMat(this);
    this.qibla = new Qibla(this);
    this.tasbih = new Tasbih(this);
    this.names = new NamesGallery(this);
    this.kaaba = new KaabaScene(this);

    this.features = {
      book: this.book,
      mat: this.mat,
      qibla: this.qibla,
      tasbih: this.tasbih,
      names: this.names,
      kaaba: this.kaaba,
      times: new TimesPanel(this),
      calendar: new CalendarPanel(this),
      library: new LibraryPanel(this),
      duas: new DuasPanel(this),
      learn: new LearnPanel(this),
      zakat: new ZakatPanel(this),
      stats: new StatsPanel(this),
      settings: new SettingsPanel(this),
    };

    // The physical objects stay in the room alongside whatever panel is open;
    // panels replace each other so they never stack up in front of your face.
    this.persistent = new Set(['book', 'mat']);
  }

  /** The ring that shows where a real surface was found in mixed reality. */
  _buildReticle() {
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.10, 0.13, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xd8b46a, transparent: true, opacity: 0.9 }),
    );
    this.reticle.visible = false;
    this.engine.scene.add(this.reticle);

    this.engine.addEventListener('beforerender', (e) => this._updateReticle(e.detail.frame));
  }

  _updateReticle(frame) {
    if (this.engine.mode !== MODE.AR || !this.placing) {
      this.reticle.visible = false;
      return;
    }
    const pose = this.engine.hitTestPose(frame);
    if (!pose) { this.reticle.visible = false; return; }
    const { position } = pose.transform;
    this.reticle.visible = true;
    this.reticle.position.set(position.x, position.y, position.z);
    this.floorY = position.y;
  }

  /** Start placing an object on a real surface; the next select drops it. */
  beginPlacement(target) {
    this.placing = target;
    this.toast('Point at your floor and pull the trigger to put it down');
    const session = this.engine.session;
    if (!session) return;
    const handler = () => {
      if (!this.placing || !this.reticle.visible) return;
      const position = this.reticle.position.clone();
      if (this.placing === 'mat') this.mat.confirmPlacement(position);
      else if (this.placing === 'book') {
        this.book.group.position.copy(position).add(new THREE.Vector3(0, 0.75, 0));
      }
      this.placing = null;
      this.reticle.visible = false;
      session.removeEventListener('select', handler);
    };
    session.addEventListener('select', handler);
  }

  _bindUI() {
    this.boot = document.getElementById('boot');
    this.hud = document.getElementById('hud');
    this.toastEl = document.getElementById('hud-toast');

    const vrButton = document.getElementById('btn-vr');
    const arButton = document.getElementById('btn-ar');
    const desktopButton = document.getElementById('btn-desktop');
    const status = document.getElementById('xr-status');

    Engine.supported().then(({ vr, ar, reason }) => {
      vrButton.disabled = !vr;
      arButton.disabled = !ar;
      if (vr || ar) {
        status.textContent = [
          vr ? 'VR ready' : null,
          ar ? 'Mixed reality ready' : null,
        ].filter(Boolean).join(' · ');
      } else {
        status.textContent = `${reason} You can still explore the full app on this screen.`;
        status.classList.add('warn');
      }
    });

    vrButton.addEventListener('click', () => this.start(MODE.VR));
    arButton.addEventListener('click', () => this.start(MODE.AR));
    desktopButton.addEventListener('click', () => this.start(MODE.DESKTOP));

    document.getElementById('hud-menu').addEventListener('click', () => this.hub.toggle());
    document.getElementById('hud-exit').addEventListener('click', () => this.leave());

    this.engine.addEventListener('modechange', () => {
      this.environment.set(this.engine.mode === MODE.AR
        ? 'passthrough'
        : store.get('settings.environment', 'masjid'));
    });
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.code) {
        case 'KeyM': this.hub.toggle(); break;
        case 'Escape': this.hub.show(); break;
        case 'KeyQ': this.openFeature('qibla'); break;
        case 'KeyB': this.openFeature('book'); break;
        case 'KeyT': this.openFeature('times'); break;
        default: break;
      }
    });
  }

  _startClock() {
    setInterval(() => this.recomputeTimes(), 20000);
  }

  // ---- session -------------------------------------------------------------

  async start(mode) {
    this.audio.unlock();
    this.boot.hidden = true;
    this.hud.hidden = false;

    if (!this.location) {
      // Start from the time zone so times and Qibla are right away usable,
      // then upgrade to real coordinates if the device offers them.
      const city = cityFromTimeZone();
      this.setLocation(city
        ? { lat: city.lat, lng: city.lng, name: city.name, source: 'timezone' }
        : { lat: KAABA.lat, lng: KAABA.lng, name: 'Makkah', source: 'default' });
      requestLocation().then((precise) => {
        if (precise.source === 'gps') this.setLocation(precise);
      });
    } else {
      this.recomputeTimes();
    }

    this.environment.set(mode === MODE.AR ? 'passthrough' : store.get('settings.environment', 'masjid'));
    this.alignWorldToQibla();
    this.audio.setAmbience(store.get('settings.ambience', 'none'));

    if (mode !== MODE.DESKTOP) {
      try {
        await this.engine.enterXR(mode);
      } catch (err) {
        this.toast(`Could not start ${mode === MODE.AR ? 'mixed reality' : 'VR'}: ${err.message}`);
        this.boot.hidden = false;
        this.hud.hidden = true;
        return;
      }
    } else {
      this.engine.player.position.set(0, 0, 2.2);
    }

    // Open with the book on its lectern and the mat on the floor: the two
    // things somebody actually came here for.
    this.openFeature('book');
    this.mat.show();
    this.mat.group.position.set(0, this.floorY, -1.1);
    this.mat.faceQibla();

    this.toast(mode === MODE.DESKTOP
      ? 'Preview mode — drag to look, W A S D to walk, M for the menu'
      : 'Point and pull the trigger. Grip to pick things up. Look at your wrist for the menu.');
  }

  leave() {
    if (this.engine.session) this.engine.exitXR();
    this.audio.stopRecitation();
    this.audio.stopAmbience();
    this.audio.stopSpeech();
    this.hud.hidden = true;
    this.boot.hidden = false;
  }

  // ---- shared state --------------------------------------------------------

  setLocation(location) {
    this.location = location;
    store.set('location', location);

    // Until the room is calibrated against the real world, put the Qibla where
    // the user is already looking: straight ahead, through the mihrab. Then the
    // mat, the mihrab and the Kaaba all agree, and calibration only has to move
    // one thing.
    if (!this.northCalibrated) {
      this.northOffset = THREE.MathUtils.degToRad(qiblaBearing(location.lat, location.lng));
      this.alignWorldToQibla();
    }

    this.recomputeTimes();
    this.qibla?.panel.refresh();
    this.toast(`Location: ${location.name} · Qibla ${qiblaBearing(location.lat, location.lng).toFixed(1)}°`);
    return location;
  }

  recomputeTimes() {
    if (!this.location) return null;
    const opts = {
      method: store.get('settings.method'),
      asr: store.get('settings.asr'),
      highLat: store.get('settings.highLat'),
    };
    this.prayerWindow = prayerWindow(new Date(), this.location, opts);
    this.nextPrayerKey = this.prayerWindow.next.key;
    this.environment.syncSunToTime(this.prayerWindow.today);
    return this.prayerWindow;
  }

  /**
   * Where the Qibla lies in the app's own coordinates. `northOffset` is how far
   * the world is rotated from true north — assumed zero until the user
   * calibrates, which the Qibla screen explains.
   */
  get qiblaYaw() {
    if (!this.location) return this.northOffset;
    const bearing = qiblaBearing(this.location.lat, this.location.lng);
    return this.northOffset - THREE.MathUtils.degToRad(bearing);
  }

  setNorthOffset(radians) {
    this.northOffset = radians;
    this.northCalibrated = true;
    this.alignWorldToQibla();
    return this.northOffset;
  }

  /** Turn the room, the mat and the Kaaba so they all point the same way. */
  alignWorldToQibla() {
    this.mat?.faceQibla();
    if (this.environment) this.environment.root.rotation.y = this.qiblaYaw;
    if (this.kaaba?.group.visible) this.kaaba.reorient();
    return this.qiblaYaw;
  }

  setEnvironment(key) {
    store.set('settings.environment', key);
    if (key === 'passthrough' && this.engine.mode !== MODE.AR) {
      this.toast('Passthrough needs a mixed-reality session — leave and choose Mixed Reality.');
      return;
    }
    this.environment.set(key);
    this.alignWorldToQibla();
    this.features.settings.refresh();
  }

  setHeightOffset(value) {
    this.heightOffset = value;
    this.engine.player.position.y = value;
    this.floorY = -value;
  }

  applySeated() {
    const seated = store.get('settings.seated');
    this.setHeightOffset(seated ? -0.35 : 0);
  }

  applyContrast() {
    // The panels read their colours per draw, so a refresh is enough.
    Object.values(this.features).forEach((f) => f.panel?.refresh?.());
  }

  // ---- features ------------------------------------------------------------

  openFeature(key) {
    if (key === 'exit') { this.leave(); return null; }
    if (key === 'guide') { this.startGuidedPrayer(this.nextPrayerKey || 'dhuhr'); return null; }

    const feature = this.features[key];
    if (!feature) return null;

    // Close whatever exclusive panel is open, then show this one.
    if (!this.persistent.has(key)) {
      for (const [otherKey, other] of Object.entries(this.features)) {
        if (otherKey !== key && !this.persistent.has(otherKey)) other.hide?.();
      }
    }

    const onScreen = !!feature.group?.parent && feature.group.visible;
    if (onScreen && !this.persistent.has(key)) {
      feature.hide();
      this.activeFeature = null;
    } else {
      feature.show();
      this.activeFeature = key;
      if (key === 'book') this._placeBook();
      else if (this.book.group.parent) this._tuckBook();
      if (key === 'mat' && this.engine.mode === MODE.AR) this.beginPlacement('mat');
    }

    this.hub.hide();
    this.audio.click();
    return feature;
  }

  _placeBook() {
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.engine.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    // Close enough to read, low enough to look down at, like a book on a rihal.
    const position = head.clone().addScaledVector(forward, 0.72);
    position.y = head.y - 0.38;
    this.book.placeOnLectern(position, Math.atan2(forward.x, forward.z) + Math.PI);
  }

  /**
   * Move the book out of the centre of view — it stays open beside you rather
   * than blocking whatever was just opened in front.
   */
  _tuckBook() {
    const side = store.get('settings.handedness', 'right') === 'right' ? 1 : -1;
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.engine.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const position = head.clone()
      .addScaledVector(forward, 0.42)
      .addScaledVector(right, side * 0.52);
    position.y = head.y - 0.46;

    const toUser = head.clone().sub(position);
    this.book.placeOnLectern(position, Math.atan2(toUser.x, toUser.z));
  }

  openBookAt(surahNumber, ayah = 1) {
    if (!this.book.group.visible) this.openFeature('book');
    this.book.open(surahNumber, ayah);
    return this.book;
  }

  startGuidedPrayer(prayer, rakahs) {
    if (!this.mat.group.visible) this.mat.show();
    this.mat.startGuide(prayer, rakahs);
    this.hub.hide();
    this.toast(`Guided ${PRAYER_LABELS[prayer] || prayer} — follow the ghost on the mat.`);
    return this.mat.guide;
  }

  /** Count a single name of God on the tasbih. */
  startNameDhikr(name) {
    if (!this.tasbih.group.visible) this.tasbih.show();
    this.tasbih.presets[this.tasbih.presets.length - 1] = {
      name: name.translit, arabic: name.arabic, target: 33,
    };
    this.tasbih.presetIndex = this.tasbih.presets.length - 1;
    this.tasbih.count = 0;
    this.tasbih.panel.refresh();
    this.toast(`Counting ${name.translit} — 33 times`);
  }

  onPrayerTime(key, at) {
    this.audio.prayerAlert();
    this.toast(`${PRAYER_LABELS[key]} — it is time to pray.`, 8000);
    this.recomputeTimes();
    if (store.get('settings.environment') !== 'passthrough') {
      this.environment.syncSunToTime(this.prayerWindow?.today, at);
    }
  }

  // ---- chrome --------------------------------------------------------------

  toast(message, duration = 4000) {
    if (!this.toastEl) return;
    this.toastEl.textContent = message;
    this.toastEl.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toastEl.hidden = true; }, duration);
    console.info('[digital-islam]', message);
  }
}

const app = new App();
window.digitalIslam = app;   // handy for debugging from the console
export default app;
