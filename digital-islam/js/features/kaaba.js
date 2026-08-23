/**
 * The Kaaba, at two scales.
 *
 * A model of the Sacred Mosque's courtyard that you can either look down on
 * like a table model, or step into at life size. Pilgrims circle it, and a
 * counter walks you through the seven circuits of tawaf with the starting line
 * of the Black Stone marked — useful for learning the rite before you go.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { calligraphyBandTexture, marbleTexture } from '../core/patterns.js';

const KAABA_W = 12.86;   // metres, real dimensions
const KAABA_D = 11.03;
const KAABA_H = 13.1;

export class KaabaScene {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.group = new THREE.Group();
    this.group.name = 'kaaba';
    this.group.visible = false;
    this.scaleMode = 'model';    // model | lifesize
    this.tawafCount = 0;
    this.lastAngle = null;
    this.turns = 0;

    this._buildPanel();
    this._build();
    this.engine.add(this);
  }

  _build() {
    this.model = new THREE.Group();

    // Mataf floor — the polished marble circle people walk on.
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(38, 64),
      new THREE.MeshStandardMaterial({ map: marbleTexture({ base: '#f0ece2' }), roughness: 0.25, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.model.add(floor);

    // The Kaaba: a stone cube under the kiswah, with the gold band.
    const kiswah = new THREE.Mesh(
      new THREE.BoxGeometry(KAABA_W, KAABA_H, KAABA_D),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85, metalness: 0.05 }),
    );
    kiswah.position.y = KAABA_H / 2;
    kiswah.castShadow = true;
    this.model.add(kiswah);

    const bandTexture = calligraphyBandTexture('لَا إِلَٰهَ إِلَّا ٱللَّهُ مُحَمَّدٌ رَسُولُ ٱللَّهِ', {
      background: 'rgba(10,10,10,1)',
    });
    bandTexture.repeat.set(3, 1);
    for (const [w, ry] of [[KAABA_W, 0], [KAABA_D, Math.PI / 2]]) {
      for (const sign of [1, -1]) {
        const band = new THREE.Mesh(
          new THREE.PlaneGeometry(w, 1.1),
          new THREE.MeshBasicMaterial({ map: bandTexture, transparent: true }),
        );
        band.position.y = KAABA_H * 0.72;
        const depth = (ry === 0 ? KAABA_D : KAABA_W) / 2 + 0.02;
        band.position.x = ry === 0 ? 0 : sign * depth;
        band.position.z = ry === 0 ? sign * depth : 0;
        band.rotation.y = ry + (sign < 0 ? Math.PI : 0);
        this.model.add(band);
      }
    }

    // Black Stone corner marker and the green line tawaf starts from.
    const stone = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.4, metalness: 0.3 }),
    );
    stone.position.set(KAABA_W / 2 - 0.4, 1.5, KAABA_D / 2 - 0.4);
    this.model.add(stone);
    this.blackStone = stone;

    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 26),
      new THREE.MeshBasicMaterial({ color: 0x2e9c7d, transparent: true, opacity: 0.65 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(KAABA_W / 2 + 12, 0.02, KAABA_D / 2 - 0.4);
    line.rotation.z = Math.PI / 2;
    this.model.add(line);

    // Maqam Ibrahim, in its gold-and-glass canopy.
    const maqam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 2.4, 16),
      new THREE.MeshStandardMaterial({
        color: 0xd8b46a, metalness: 0.85, roughness: 0.25,
        transparent: true, opacity: 0.75,
      }),
    );
    maqam.position.set(0, 1.2, KAABA_D / 2 + 9);
    this.model.add(maqam);

    // Pilgrims: a slow ring of figures circling anticlockwise.
    this.pilgrims = new THREE.Group();
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.75, 4, 8);
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 });
    for (let i = 0; i < 160; i++) {
      const person = new THREE.Mesh(bodyGeo, white);
      const radius = 11 + Math.random() * 20;
      const angle = Math.random() * Math.PI * 2;
      person.userData = { radius, angle, speed: 0.06 + Math.random() * 0.05 };
      person.position.set(Math.cos(angle) * radius, 0.85, Math.sin(angle) * radius);
      this.pilgrims.add(person);
    }
    this.model.add(this.pilgrims);

    // Arcade wall around the courtyard.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(39, 39, 9, 48, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xe4dcc8, side: THREE.BackSide, roughness: 0.7,
      }),
    );
    wall.position.y = 4.5;
    this.model.add(wall);

    this.group.add(this.model);
    this.setScale('model');
  }

  _buildPanel() {
    this.panel = new Panel({ width: 0.72, height: 0.44, ppm: 1200, name: 'kaaba-panel' });
    this.panel.render = (p) => this._render(p);
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
  }

  _render(p) {
    let y = p.title('Al-Masjid al-Haram', this.scaleMode === 'model'
      ? 'Table model — 1 : 40'
      : 'Life size — you are standing in the mataf');

    y = p.text(
      `Tawaf: ${this.tawafCount} of 7 circuits. Start at the Black Stone corner, keep the Kaaba `
      + 'on your left, and walk anticlockwise.',
      46, y, { color: THEME.muted, font: '400 23px Inter, sans-serif', lineHeight: 31 },
    ) + 16;

    for (let i = 0; i < 7; i++) {
      p.ctx.beginPath();
      p.ctx.arc(60 + i * 46, y + 18, 15, 0, Math.PI * 2);
      p.ctx.fillStyle = i < this.tawafCount ? THEME.green : 'rgba(255,255,255,0.12)';
      p.ctx.fill();
    }
    y += 60;

    const bw = (p.W - 112) / 2;
    p.button('scale', this.scaleMode === 'model' ? 'Step inside (life size)' : 'Back to table model',
      46, y, bw, 62, { onSelect: () => this.setScale(this.scaleMode === 'model' ? 'lifesize' : 'model') });
    p.button('reset', 'Reset tawaf', 46 + bw + 10, y, bw, 62, {
      onSelect: () => { this.tawafCount = 0; this.turns = 0; this.panel.refresh(); },
    });
    y += 78;

    p.text(
      'A model for learning the rite, not a substitute for it. Distances and the layout of '
      + 'the courtyard are approximate.',
      46, y, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 27 },
    );
  }

  setScale(mode) {
    this.scaleMode = mode;
    // 1:40 on an imaginary table at chest height, or the real thing at 1:1.
    const scale = mode === 'model' ? 0.025 : 1;
    this.model.scale.setScalar(scale);
    this.model.position.set(0, mode === 'model' ? 1.0 : 0, mode === 'model' ? -1.15 : -22);
    this.panel.mesh.position.set(0, mode === 'model' ? 1.66 : 1.45, mode === 'model' ? -0.95 : -1.05);
    this.panel.mesh.rotation.x = mode === 'model' ? -0.28 : -0.1;
    if (this.group.visible) this.reorient();
    this.panel.refresh();
    this.app.toast(mode === 'model' ? 'Table model' : 'Life size — walk around it');
    return mode;
  }

  /** Count circuits by watching the angle of the user around the Kaaba. */
  _trackTawaf() {
    if (this.scaleMode !== 'lifesize') return;
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const centre = this.model.getWorldPosition(new THREE.Vector3());
    const dx = head.x - centre.x;
    const dz = head.z - centre.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 8 || distance > 40) { this.lastAngle = null; return; }

    const angle = Math.atan2(dz, dx);
    if (this.lastAngle != null) {
      let delta = angle - this.lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      this.turns += delta;
      const circuits = Math.floor(Math.abs(this.turns) / (Math.PI * 2));
      if (circuits > this.tawafCount && circuits <= 7) {
        this.tawafCount = circuits;
        this.app.audio.success();
        this.app.toast(`Circuit ${circuits} of 7`);
        this.panel.refresh();
      }
    }
    this.lastAngle = angle;
  }

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    this.reorient();
    this.panel.refresh();
  }

  /**
   * Put the courtyard in front of whoever opened it — the model is no use
   * behind your back — while the building itself keeps the calibrated Qibla
   * orientation, so the Black Stone corner is where it should be.
   */
  reorient() {
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.engine.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    this.group.position.set(head.x, this.app.floorY ?? 0, head.z);
    this.group.rotation.y = Math.atan2(-forward.x, -forward.z);
    this.model.rotation.y = this.app.qiblaYaw - this.group.rotation.y;
  }

  hide() {
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  update(dt) {
    if (!this.group.visible) return;
    for (const person of this.pilgrims.children) {
      const d = person.userData;
      d.angle -= dt * d.speed;      // anticlockwise, as tawaf is performed
      person.position.set(Math.cos(d.angle) * d.radius, 0.85, Math.sin(d.angle) * d.radius);
    }
    this._trackTawaf();
  }

  dispose() {
    this.app.interaction.unregister(this.panel.mesh);
    this.panel.dispose();
    this.engine.remove(this);
  }
}
