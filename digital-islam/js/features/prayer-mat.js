/**
 * The prayer mat.
 *
 * A real-size sajjada (110 × 70 cm) you lay on the floor — in MR it snaps to
 * the actual floor of your room via hit-testing. It always turns to face the
 * Qibla. Standing on it opens the guided prayer: postures, what is recited at
 * each one, and a rak'ah counter that advances when you prostrate.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { prayerMatTexture } from '../core/patterns.js';
import { buildSequence, POSTURES, PRAYER_UNITS, MADHHAB_NOTE, AFTER_SALAH } from '../data/salah.js';
import { PRAYER_LABELS } from '../core/prayer-times.js';

const MAT_W = 0.70;
const MAT_L = 1.10;

export class PrayerMat {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.group = new THREE.Group();
    this.group.name = 'prayer-mat';
    this.group.visible = false;

    this.guide = null;        // active guided-prayer session
    this.rakah = 0;
    this.wasProstrate = false;
    this.placing = false;

    this._buildMat();
    this._buildGuidePanel();
    this._buildGhost();
    this.engine.add(this);
  }

  _buildMat() {
    const texture = prayerMatTexture();
    this.mat = new THREE.Mesh(
      new THREE.PlaneGeometry(MAT_W, MAT_L, 12, 20),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0 }),
    );
    this.mat.rotation.x = -Math.PI / 2;
    this.mat.position.y = 0.011;   // clear of the edge trim below
    this.mat.receiveShadow = true;
    this.mat.userData.onSelect = () => this.toggleGuide();
    this.group.add(this.mat);
    this.app.interaction.register(this.mat);

    // A soft pile edge so it reads as fabric, not a decal.
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(MAT_W + 0.012, 0.008, MAT_L + 0.012),
      new THREE.MeshStandardMaterial({ color: 0x0d2b23, roughness: 1 }),
    );
    edge.position.y = 0.005;
    this.group.add(edge);

    // Fringe at both ends.
    const fringeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 1 });
    for (const sign of [-1, 1]) {
      for (let i = 0; i < 22; i++) {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 0.03), fringeMaterial);
        strand.position.set(-MAT_W / 2 + 0.02 + i * (MAT_W - 0.04) / 21, 0.008, sign * (MAT_L / 2 + 0.016));
        this.group.add(strand);
      }
    }

    this.app.interaction.registerGrabbable(this.group, {
      onRelease: () => this.dropToFloor(),
    });
  }

  /** The panel that hovers at the head of the mat during guided prayer. */
  _buildGuidePanel() {
    this.panel = new Panel({ width: 0.62, height: 0.46, ppm: 1300, name: 'salah-guide' });
    this.panel.render = (p) => this._renderGuide(p);
    this.panel.mesh.position.set(0, 0.95, -MAT_L / 2 - 0.15);
    this.panel.mesh.rotation.x = -0.25;
    this.panel.mesh.visible = false;
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
  }

  /** A translucent figure showing the current posture. */
  _buildGhost() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x7fd8bd, transparent: true, opacity: 0.28, roughness: 0.4,
      emissive: 0x2e9c7d, emissiveIntensity: 0.4,
    });
    this.ghost = new THREE.Group();

    this.ghostBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 14), material);
    this.ghostBody.position.y = 1.05;
    this.ghost.add(this.ghostBody);

    this.ghostHead = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), material);
    this.ghostHead.position.y = 1.55;
    this.ghost.add(this.ghostHead);

    this.ghost.position.z = 0.1;
    this.ghost.visible = false;
    this.group.add(this.ghost);
  }

  // ---- placement -----------------------------------------------------------

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    this.faceQibla();
  }

  hide() {
    this.endGuide();
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  /** Turn the mat so its mihrab arch points along the calibrated Qibla. */
  faceQibla() {
    this.group.rotation.set(0, this.app.qiblaYaw, 0);
  }

  /** After a grab, settle the mat flat on the floor again. */
  dropToFloor() {
    this.group.position.y = this.app.floorY ?? 0;
    this.group.rotation.x = 0;
    this.group.rotation.z = 0;
    this.faceQibla();
  }

  /** MR: follow the hit-test reticle until the user confirms a spot. */
  beginPlacement() {
    this.placing = true;
    this.app.toast('Point at your floor and select to lay the mat down');
  }

  confirmPlacement(position) {
    this.placing = false;
    this.group.position.copy(position);
    this.dropToFloor();
    this.app.toast('Mat placed. Select it to start the guided prayer.');
  }

  // ---- guided prayer -------------------------------------------------------

  toggleGuide() {
    if (this.guide) this.endGuide();
    else this.startGuide(this.app.nextPrayerKey || 'dhuhr');
  }

  /**
   * @param {string} prayer  fajr | dhuhr | asr | maghrib | isha | jumuah
   * @param {number} [rakahs] override (sunnah, witr, qada)
   */
  startGuide(prayer, rakahs) {
    const units = PRAYER_UNITS[prayer] || PRAYER_UNITS.dhuhr;
    this.guide = {
      prayer,
      rakahs: rakahs || units.fard,
      steps: buildSequence(prayer, rakahs),
      index: 0,
      auto: true,
      elapsed: 0,
      startedAt: Date.now(),
    };
    this.rakah = 0;
    this.panel.mesh.visible = true;
    this.ghost.visible = true;
    this._applyStep();
    this.app.audio.say(`Guided ${PRAYER_LABELS[prayer] || prayer}. ${this.guide.rakahs} units.`);
    return this.guide;
  }

  endGuide({ completed = false } = {}) {
    if (!this.guide) return;
    const { prayer } = this.guide;
    this.guide = null;
    this.panel.mesh.visible = false;
    this.ghost.visible = false;
    this.app.audio.stopSpeech();
    if (completed) {
      this.store.markPrayer(prayer, true);
      this.app.audio.success();
      this.app.toast(`${PRAYER_LABELS[prayer] || prayer} recorded. ${AFTER_SALAH.length} dhikr wait on the tasbih.`);
    }
    this.panel.refresh();
  }

  step(delta = 1) {
    if (!this.guide) return;
    const next = this.guide.index + delta;
    if (next >= this.guide.steps.length) return this.endGuide({ completed: true });
    this.guide.index = Math.max(0, next);
    this.guide.elapsed = 0;
    this._applyStep();
    return this.guide.index;
  }

  _applyStep() {
    const step = this.currentStep;
    if (!step) return;
    if (step.marker === 'rakah') {
      this.rakah = step.rakah;
      this.app.audio.tone(660, 0.25, 0.12);
      this.step(1);
      return;
    }
    const pose = POSTURES[step.posture];
    if (pose) {
      this.ghostHead.position.y = pose.head;
      this.ghostBody.position.y = Math.max(0.18, pose.head - 0.5);
      this.ghostBody.rotation.x = THREE.MathUtils.degToRad(pose.lean);
      this.ghost.rotation.y = step.posture === 'salam' ? 0.6 : 0;
    }
    if (step.recite?.surah && this.app.book) {
      this.app.book.open(step.recite.surah);
    }
    if (step.title) this.app.audio.say(step.title);
    this.panel.refresh();
  }

  get currentStep() { return this.guide?.steps[this.guide.index] || null; }

  _renderGuide(p) {
    if (!this.guide) return;
    const step = this.currentStep;
    const { prayer, rakahs } = this.guide;

    let y = p.title(
      `${PRAYER_LABELS[prayer] || prayer} — rak'ah ${this.rakah || 1} of ${rakahs}`,
      step?.posture ? POSTURES[step.posture]?.label : '',
    );

    // Rak'ah pips.
    for (let i = 0; i < rakahs; i++) {
      const done = i < this.rakah - 1;
      const active = i === this.rakah - 1;
      p.ctx.beginPath();
      p.ctx.arc(60 + i * 42, y + 16, 13, 0, Math.PI * 2);
      p.ctx.fillStyle = done ? THEME.green : active ? THEME.gold : 'rgba(255,255,255,0.12)';
      p.ctx.fill();
    }
    y += 52;

    if (step) {
      p.ctx.fillStyle = THEME.gold;
      p.ctx.font = '700 32px Inter, sans-serif';
      p.ctx.fillText(step.title || '', 46, y);
      y += 46;

      if (step.arabic) y = p.arabic(step.arabic, 46, y, { size: 40, maxWidth: p.W - 92 }) + 12;
      if (step.translit) y = p.text(step.translit, 46, y, { color: THEME.goldDim, font: 'italic 400 23px Inter, sans-serif', lineHeight: 30 }) + 10;
      if (step.meaning) y = p.text(step.meaning, 46, y, { color: THEME.muted, font: '400 24px Inter, sans-serif', lineHeight: 31 }) + 10;
      if (step.note) y = p.text(step.note, 46, y, { color: THEME.green, font: '500 22px Inter, sans-serif', lineHeight: 29 }) + 8;
    }

    // Auto-advance progress.
    const total = (step?.seconds || 6);
    p.progress(this.guide.elapsed / total, 46, p.H - 148, p.W - 92, 8);

    const bw = (p.W - 112) / 3;
    p.button('prev', '‹ Back', 46, p.H - 122, bw, 62, { onSelect: () => this.step(-1) });
    p.button('pause', this.guide.auto ? 'Pause' : 'Resume', 46 + bw + 10, p.H - 122, bw, 62, {
      active: !this.guide.auto,
      onSelect: () => { this.guide.auto = !this.guide.auto; },
    });
    p.button('next', 'Next ›', 46 + (bw + 10) * 2, p.H - 122, bw, 62, { onSelect: () => this.step(1) });

    p.button('end', 'End prayer', 46, p.H - 52, p.W - 92, 44, {
      danger: true, font: '600 22px Inter, sans-serif',
      onSelect: () => this.endGuide({ completed: this.guide.index > this.guide.steps.length * 0.6 }),
    });
  }

  // ---- rak'ah counting from real movement ----------------------------------

  /**
   * The headset already knows where your head is. When it drops near the mat
   * and comes back up, that is a prostration — which is exactly what a rak'ah
   * counter needs, with no extra hardware.
   */
  _trackProstration() {
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const matY = this.group.getWorldPosition(new THREE.Vector3()).y;
    const matPos = this.group.getWorldPosition(new THREE.Vector3());
    const horizontal = Math.hypot(head.x - matPos.x, head.z - matPos.z);
    const prostrate = head.y - matY < 0.55 && horizontal < 1.1;

    if (prostrate && !this.wasProstrate) {
      this.prostrations = (this.prostrations || 0) + 1;
      this.app.audio.tone(520, 0.14, 0.08);
      // Two prostrations complete a rak'ah.
      if (this.prostrations % 2 === 0) {
        this.rakah = Math.min((this.rakah || 0) + 1, this.guide?.rakahs || 4);
        this.panel.refresh();
      }
    }
    this.wasProstrate = prostrate;
  }

  update(dt) {
    if (!this.group.visible) return;
    if (this.guide) {
      this._trackProstration();
      if (this.guide.auto) {
        this.guide.elapsed += dt;
        const step = this.currentStep;
        if (step && this.guide.elapsed >= (step.seconds || 6)) this.step(1);
        else if (Math.floor(this.guide.elapsed * 4) % 4 === 0) this.panel.refresh();
      }
    }
  }

  dispose() {
    this.app.interaction.unregister(this.mat);
    this.app.interaction.unregister(this.panel.mesh);
    this.app.interaction.unregisterGrabbable(this.group);
    this.panel.dispose();
    this.engine.remove(this);
  }
}

export { MADHHAB_NOTE };
