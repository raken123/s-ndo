/**
 * Moving around: thumbstick turning, smooth glide or teleport, and a comfort
 * vignette that closes in while you move.
 *
 * The whole rig is moved, never the camera, so head tracking stays untouched.
 */

import * as THREE from 'three';

const SNAP_DEGREES = 30;
const DEAD_ZONE = 0.25;

export class Locomotion {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;
    this.snapReady = true;
    this.teleporting = false;

    this._buildVignette();
    this._buildTeleportMarker();
    this.engine.add(this);
  }

  _buildVignette() {
    const geometry = new THREE.RingGeometry(0.22, 0.6, 48);
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false,
    });
    this.vignette = new THREE.Mesh(geometry, material);
    this.vignette.position.z = -0.35;
    this.vignette.renderOrder = 999;
    this.engine.camera.add(this.vignette);
  }

  _buildTeleportMarker() {
    this.marker = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.02, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x2e9c7d }),
    );
    ring.rotation.x = -Math.PI / 2;
    this.marker.add(ring);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2e9c7d, transparent: true, opacity: 0.4 }),
    );
    pillar.position.y = 0.4;
    this.marker.add(pillar);
    this.marker.visible = false;
    this.engine.scene.add(this.marker);

    this.arc = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x2e9c7d, transparent: true, opacity: 0.8 }),
    );
    this.arc.visible = false;
    this.engine.scene.add(this.arc);
  }

  /** Gamepad axes for one hand, or null. */
  _axes(handedness) {
    const session = this.engine.session;
    if (!session) return null;
    for (const source of session.inputSources) {
      if (source.handedness !== handedness || !source.gamepad) continue;
      const axes = source.gamepad.axes;
      // Some runtimes report the stick on axes 0/1, others on 2/3.
      const x = Math.abs(axes[2] || 0) > Math.abs(axes[0] || 0) ? axes[2] : axes[0];
      const y = Math.abs(axes[3] || 0) > Math.abs(axes[1] || 0) ? axes[3] : axes[1];
      return { x: x || 0, y: y || 0, source };
    }
    return null;
  }

  update(dt) {
    if (!this.engine.session) {
      this.vignette.material.opacity = 0;
      return;
    }
    this._turn(dt);
    this._move(dt);
  }

  _turn(dt) {
    const right = this._axes('right');
    if (!right) return;
    const snap = this.store.get('settings.snapTurn', true);

    if (snap) {
      if (Math.abs(right.x) < DEAD_ZONE) { this.snapReady = true; return; }
      if (!this.snapReady) return;
      this.snapReady = false;
      this._rotateAroundHead(THREE.MathUtils.degToRad(Math.sign(right.x) * SNAP_DEGREES));
      this.app.audio.tone(440, 0.05, 0.06, 'square');
    } else if (Math.abs(right.x) > DEAD_ZONE) {
      this._rotateAroundHead(right.x * dt * 1.6);
    }
  }

  /** Rotate the rig about the head, so the user does not swing sideways. */
  _rotateAroundHead(angle) {
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const player = this.engine.player;
    const offset = player.position.clone().sub(head);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    player.position.copy(head).add(offset);
    player.rotation.y += angle;
  }

  _move(dt) {
    const left = this._axes('left');
    const mode = this.store.get('settings.locomotion', 'teleport');
    if (!left) { this._hideTeleport(); return; }

    const magnitude = Math.hypot(left.x, left.y);

    if (mode === 'smooth') {
      if (magnitude < DEAD_ZONE) { this._fadeVignette(0, dt); return; }
      const direction = new THREE.Vector3(left.x, 0, left.y);
      const yaw = this.engine.camera.rotation.y + this.engine.player.rotation.y;
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.engine.player.position.addScaledVector(direction, dt * 1.7);
      this._fadeVignette(this.store.get('settings.vignette', true) ? 0.55 : 0, dt);
      return;
    }

    // Teleport: aim while the stick is pushed, jump when it returns to centre.
    if (magnitude > DEAD_ZONE) {
      this.teleporting = true;
      this._aimTeleport(left);
    } else if (this.teleporting) {
      this.teleporting = false;
      this._commitTeleport();
    }
    this._fadeVignette(0, dt);
  }

  _aimTeleport(axes) {
    const pointer = this.app.interaction.pointers.find(
      (p) => p.controller.userData.handedness === 'left',
    ) || this.app.interaction.pointers[0];
    if (!pointer) return;

    const origin = pointer.controller.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(pointer.controller.getWorldQuaternion(new THREE.Quaternion()));

    // Simple ballistic arc down to floor level.
    const floorY = this.app.floorY ?? 0;
    const points = [];
    const velocity = direction.clone().multiplyScalar(7);
    const position = origin.clone();
    let landed = null;
    for (let i = 0; i < 60; i++) {
      points.push(position.clone());
      position.addScaledVector(velocity, 0.03);
      velocity.y -= 9.8 * 0.03;
      if (position.y <= floorY) { landed = position.clone(); landed.y = floorY; break; }
    }
    if (landed) points.push(landed);

    this.arc.geometry.dispose();
    this.arc.geometry = new THREE.BufferGeometry().setFromPoints(points);
    this.arc.visible = true;
    this.marker.visible = !!landed;
    if (landed) this.marker.position.copy(landed);
    this.teleportTarget = landed;
    // Ignore anything absurdly far away.
    if (landed && landed.distanceTo(origin) > 12) {
      this.marker.visible = false;
      this.teleportTarget = null;
    }
  }

  _commitTeleport() {
    this._hideTeleport();
    if (!this.teleportTarget) return;
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const player = this.engine.player;
    player.position.x += this.teleportTarget.x - head.x;
    player.position.z += this.teleportTarget.z - head.z;
    this.app.audio.tone(520, 0.1, 0.09, 'sine');
  }

  _hideTeleport() {
    this.marker.visible = false;
    this.arc.visible = false;
  }

  _fadeVignette(target, dt) {
    const material = this.vignette.material;
    material.opacity += (target - material.opacity) * Math.min(1, dt * 6);
  }
}
