/**
 * Qibla.
 *
 * The bearing to the Kaaba is exact maths from your latitude and longitude.
 * Mapping that bearing into the room is the hard part: a headset reports its
 * pose relative to wherever it started, and WebXR exposes no compass. So the
 * app is honest about it — it starts by assuming you set up facing north, and
 * gives you a compass reading (on devices that have one) or a one-tap manual
 * calibration to lock it to the real world.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { qiblaBearing, distanceToKaaba, compassPoint, KAABA } from '../core/geo.js';

export class Qibla {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.group = new THREE.Group();
    this.group.name = 'qibla';
    this.group.visible = false;
    this.headingSource = 'assumed north';

    this._buildCompass();
    this._buildBeam();
    this._buildPanel();
    this.engine.add(this);
  }

  get bearing() {
    const loc = this.app.location;
    return loc ? qiblaBearing(loc.lat, loc.lng) : 0;
  }

  get distanceKm() {
    const loc = this.app.location;
    return loc ? distanceToKaaba(loc.lat, loc.lng) : 0;
  }

  // ---- visuals -------------------------------------------------------------

  _buildCompass() {
    this.compass = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xd8b46a, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.compass.add(ring);

    // Degree ticks, longer every 30°.
    for (let deg = 0; deg < 360; deg += 10) {
      const major = deg % 30 === 0;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.002, major ? 0.1 : 0.05),
        new THREE.MeshBasicMaterial({ color: major ? 0xd8b46a : 0x6f8a80 }),
      );
      const a = THREE.MathUtils.degToRad(deg);
      tick.position.set(Math.sin(a) * 1.1, 0.002, -Math.cos(a) * 1.1);
      tick.rotation.y = -a;
      this.compass.add(tick);
    }

    // Cardinal letters drawn on small sprites.
    for (const [label, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const sprite = makeLabel(label, deg === 0 ? '#ff8a6b' : '#9fb5ac');
      const a = THREE.MathUtils.degToRad(deg);
      sprite.position.set(Math.sin(a) * 1.32, 0.03, -Math.cos(a) * 1.32);
      this.compass.add(sprite);
    }

    // The Qibla needle.
    this.needle = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.004, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x2e9c7d }),
    );
    shaft.position.z = -0.5;
    this.needle.add(shaft);
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.16, 4),
      new THREE.MeshBasicMaterial({ color: 0x2e9c7d }),
    );
    head.rotation.x = -Math.PI / 2;
    head.position.z = -1.05;
    this.needle.add(head);
    this.kaabaLabel = makeLabel('🕋 Kaaba', '#d8b46a', 256, 64);
    this.kaabaLabel.position.set(0, 0.12, -1.25);
    this.needle.add(this.kaabaLabel);
    this.compass.add(this.needle);

    this.compass.position.y = 0.01;
    this.group.add(this.compass);
  }

  /** A shaft of light along the Qibla, passing through walls. */
  _buildBeam() {
    this.beam = new THREE.Group();

    const length = 60;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.05, length, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xd8b46a, transparent: true, opacity: 0.32,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    core.rotation.x = Math.PI / 2;
    core.position.z = -length / 2;
    this.beam.add(core);

    // Rings travelling along the beam to show direction of travel.
    this.pulses = [];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.008, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.7, depthWrite: false }),
      );
      ring.userData.offset = i / 6;
      this.beam.add(ring);
      this.pulses.push(ring);
    }

    this.beam.position.y = 1.3;
    this.group.add(this.beam);
  }

  _buildPanel() {
    this.panel = new Panel({ width: 0.7, height: 0.5, ppm: 1200, name: 'qibla-panel' });
    this.panel.render = (p) => this._render(p);
    this.panel.mesh.visible = false;
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
  }

  _render(p) {
    const loc = this.app.location;
    let y = p.title('Qibla', loc ? `${loc.name} · ${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` : 'Locating…');

    const bearing = this.bearing;
    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 76px Inter, sans-serif';
    p.ctx.fillText(`${bearing.toFixed(1)}°`, 46, y + 8);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 26px Inter, sans-serif';
    p.ctx.fillText(`${compassPoint(bearing)} from true north`, 46, y + 96);
    p.ctx.fillText(`${Math.round(this.distanceKm).toLocaleString()} km to ${KAABA.name}`, 46, y + 132);
    y += 178;

    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 22px Inter, sans-serif';
    p.ctx.fillText(`Room heading: ${this.headingSource}`, 46, y);
    y += 40;

    const bw = (p.W - 112) / 3;
    p.button('rot-l', '↺ 5°', 46, y, bw, 60, {
      onSelect: () => this.nudge(-5),
    });
    p.button('compass', 'Use compass', 46 + bw + 10, y, bw, 60, {
      onSelect: () => this.calibrateFromCompass(),
    });
    p.button('rot-r', '5° ↻', 46 + (bw + 10) * 2, y, bw, 60, {
      onSelect: () => this.nudge(5),
    });
    y += 76;

    p.toggle('beam', 'Show the beam through the wall', this.store.get('settings.qiblaBeam'), 46, y, p.W - 92,
      () => {
        this.store.toggle('settings.qiblaBeam');
        this.beam.visible = this.store.get('settings.qiblaBeam');
      });
    y += 70;

    p.text(
      'Turn until the green needle lines up with the direction you know the Qibla to be, '
      + 'then everything else in the app — the mat, the mihrab, the Kaaba — lines up with it too.',
      46, y, { color: THEME.muted, font: '400 21px Inter, sans-serif', lineHeight: 28 },
    );
  }

  // ---- calibration ---------------------------------------------------------

  /** Rotate the app's idea of north by `degrees`. */
  nudge(degrees) {
    this.app.setNorthOffset(this.app.northOffset + THREE.MathUtils.degToRad(degrees));
    this.headingSource = 'set by hand';
    this.panel.refresh();
    this.app.audio.click();
  }

  /**
   * Phones and some headsets expose an absolute compass heading. Where it
   * exists, one tap is enough.
   */
  async calibrateFromCompass() {
    if (!('DeviceOrientationEvent' in window)) {
      this.app.toast('This device has no compass — line the needle up by hand.');
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const granted = await DeviceOrientationEvent.requestPermission();
        if (granted !== 'granted') {
          this.app.toast('Compass permission declined — line the needle up by hand.');
          return;
        }
      }
    } catch { /* older API, no permission needed */ }

    const handler = (event) => {
      const heading = typeof event.webkitCompassHeading === 'number'
        ? event.webkitCompassHeading
        : (event.absolute && typeof event.alpha === 'number' ? 360 - event.alpha : null);
      if (heading == null) return;
      window.removeEventListener('deviceorientation', handler);
      window.removeEventListener('deviceorientationabsolute', handler);

      // The user faces `heading`; the app's -Z is where they look.
      const camYaw = this.engine.camera.rotation.y;
      this.app.setNorthOffset(-THREE.MathUtils.degToRad(heading) - camYaw);
      this.headingSource = 'device compass';
      this.app.toast(`Compass locked: facing ${Math.round(heading)}°`);
      this.panel.refresh();
      this.app.audio.success();
    };

    window.addEventListener('deviceorientationabsolute', handler);
    window.addEventListener('deviceorientation', handler);
    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler);
      window.removeEventListener('deviceorientationabsolute', handler);
      if (this.headingSource !== 'device compass') {
        this.app.toast('No compass reading came back — line the needle up by hand.');
      }
    }, 2500);
  }

  // ---- lifecycle -----------------------------------------------------------

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    this.panel.mesh.visible = true;
    this.beam.visible = this.store.get('settings.qiblaBeam');
    this.panel.refresh();
    this.reposition();
  }

  hide() {
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  /** Keep the compass under the user and the panel in front of them. */
  reposition() {
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    this.group.position.set(head.x, this.app.floorY ?? 0, head.z);

    const forward = this.engine.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    const target = head.clone().addScaledVector(forward, 1.05);
    target.y = head.y - 0.12;
    this.panel.mesh.position.copy(this.group.worldToLocal(target));
    this.panel.mesh.lookAt(head);   // lookAt works in world space, parent included
  }

  update(dt) {
    if (!this.group.visible) return;
    this.t = (this.t || 0) + dt;

    // Point the needle and beam along the Qibla in world space.
    const yaw = this.app.qiblaYaw;
    this.needle.rotation.y = yaw;
    this.beam.rotation.y = yaw;

    for (const ring of this.pulses) {
      const t = (this.t * 0.18 + ring.userData.offset) % 1;
      ring.position.set(0, 0, -t * 60);
      ring.rotation.x = Math.PI / 2;
      ring.material.opacity = 0.7 * (1 - t);
      ring.scale.setScalar(1 + t * 3);
    }

    // Follow the user around the room.
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    this.group.position.x += (head.x - this.group.position.x) * Math.min(1, dt * 2);
    this.group.position.z += (head.z - this.group.position.z) * Math.min(1, dt * 2);
  }

  dispose() {
    this.app.interaction.unregister(this.panel.mesh);
    this.panel.dispose();
    this.engine.remove(this);
  }
}

/** Small text sprite, used for the compass letters. */
function makeLabel(text, color = '#ffffff', width = 128, height = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(height * 0.55)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.16 * (width / height), 0.16, 1);
  return sprite;
}
