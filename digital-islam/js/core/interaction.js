/**
 * Pointing, selecting and grabbing.
 *
 * One code path serves controllers, tracked hands (a pinch fires the same
 * `select` events as a trigger) and the desktop mouse, so features only ever
 * deal with "something was pointed at" and "something was picked up".
 */

import * as THREE from 'three';
import { MODE } from './engine.js';

const RAY_LENGTH = 8;

export class Interaction {
  constructor(engine) {
    this.engine = engine;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = RAY_LENGTH;
    this.pointerTargets = [];   // meshes carrying a Panel or userData.onSelect
    this.grabbables = [];       // objects that can be picked up
    this.pointers = [];
    this.pointer2D = new THREE.Vector2(-2, -2);
    this.desktopHit = null;

    this._setupXRPointers();
    this._setupDesktopPointer();
    engine.add(this);
  }

  register(object) {
    if (!this.pointerTargets.includes(object)) this.pointerTargets.push(object);
    return object;
  }

  unregister(object) {
    this.pointerTargets = this.pointerTargets.filter((o) => o !== object);
    if (object?.userData?.panel) object.userData.panel.hover = null;
  }

  /**
   * @param {THREE.Object3D} object
   * @param {object} [opts] { onGrab, onRelease, snapBack, homeParent }
   */
  registerGrabbable(object, opts = {}) {
    object.userData.grab = { ...opts, home: object.parent };
    if (!this.grabbables.includes(object)) this.grabbables.push(object);
    return object;
  }

  unregisterGrabbable(object) {
    this.grabbables = this.grabbables.filter((o) => o !== object);
  }

  // ---- XR controllers and hands -------------------------------------------

  _setupXRPointers() {
    const { renderer, player } = this.engine;

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      controller.userData.index = i;
      controller.addEventListener('selectstart', () => this._onSelectStart(controller));
      controller.addEventListener('selectend', () => this._onSelectEnd(controller));
      controller.addEventListener('squeezestart', () => this._onSqueezeStart(controller));
      controller.addEventListener('squeezeend', () => this._onSqueezeEnd(controller));
      controller.addEventListener('connected', (e) => {
        controller.userData.inputSource = e.data;
        controller.userData.handedness = e.data?.handedness || 'none';
        controller.userData.isHand = e.data?.hand != null;
        controller.visible = true;
        this.engine.dispatchEvent(new CustomEvent('controllerconnected', { detail: controller }));
      });
      controller.addEventListener('disconnected', () => {
        controller.userData.inputSource = null;
        controller.visible = false;
      });

      controller.add(this._makeRay());
      player.add(controller);

      const grip = renderer.xr.getControllerGrip(i);
      grip.add(this._makeGripModel());
      player.add(grip);

      this.pointers.push({ controller, grip, index: i, held: null, hit: null, selecting: false });
    }
  }

  _makeRay() {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0xd8b46a, transparent: true, opacity: 0.65,
    }));
    line.name = 'ray';
    line.scale.z = RAY_LENGTH;

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8b46a }),
    );
    dot.name = 'cursor';
    dot.visible = false;
    line.add(dot);
    return line;
  }

  /** A small stylised grip so the hand has physical presence in the scene. */
  _makeGripModel() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.06, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x1d3b33, roughness: 0.6, metalness: 0.1 }),
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);
    return group;
  }

  _rayFrom(controller) {
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);
    controller.getWorldPosition(origin);
    direction.applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    return { origin, direction };
  }

  _intersect(origin, direction) {
    this.raycaster.set(origin, direction.normalize());
    const hits = this.raycaster.intersectObjects(this.pointerTargets, false);
    return hits[0] || null;
  }

  _onSelectStart(controller) {
    const p = this.pointers.find((x) => x.controller === controller);
    if (p) p.selecting = true;
    const hit = p?.hit;
    if (!hit) return;
    this._dispatchSelect(hit);
    this.pulse(controller, 0.25, 18);
  }

  _onSelectEnd(controller) {
    const p = this.pointers.find((x) => x.controller === controller);
    if (p) p.selecting = false;
  }

  _dispatchSelect(hit) {
    const panel = hit.object.userData.panel;
    if (panel) { panel.onSelect(hit.uv); return; }
    hit.object.userData.onSelect?.(hit);
  }

  _onSqueezeStart(controller) {
    const p = this.pointers.find((x) => x.controller === controller);
    if (!p || p.held) return;

    const controllerPos = controller.getWorldPosition(new THREE.Vector3());
    // Prefer something within arm's reach, otherwise pull in what is being pointed at.
    let target = null;
    let bestDistance = 0.35;
    for (const obj of this.grabbables) {
      if (!obj.visible || !obj.parent) continue;
      const d = obj.getWorldPosition(new THREE.Vector3()).distanceTo(controllerPos);
      if (d < bestDistance) { bestDistance = d; target = obj; }
    }
    if (!target) {
      const { origin, direction } = this._rayFrom(controller);
      this.raycaster.set(origin, direction.normalize());
      const hits = this.raycaster.intersectObjects(this.grabbables, true);
      if (hits.length) {
        target = hits[0].object;
        while (target && !this.grabbables.includes(target)) target = target.parent;
      }
    }
    if (!target) return;

    this.grab(controller, target);
  }

  grab(controller, object) {
    const p = this.pointers.find((x) => x.controller === controller);
    if (!p) return;
    const meta = object.userData.grab || {};
    meta.homeParent = meta.homeParent || object.parent;
    meta.homeMatrix = object.matrix.clone();
    object.userData.grab = meta;

    controller.attach(object);  // keeps world transform
    p.held = object;
    meta.onGrab?.(object, controller);
    this.pulse(controller, 0.5, 25);
  }

  _onSqueezeEnd(controller) {
    const p = this.pointers.find((x) => x.controller === controller);
    if (!p?.held) return;
    const object = p.held;
    const meta = object.userData.grab || {};

    if (meta.snapBack && meta.homeParent) {
      meta.homeParent.attach(object);
      object.matrix.copy(meta.homeMatrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
    } else {
      (meta.homeParent || this.engine.stage).attach(object);
    }
    p.held = null;
    meta.onRelease?.(object, controller);
  }

  /** Haptic tick on the controller that acted, where the hardware supports it. */
  pulse(controller, intensity = 0.4, ms = 20) {
    const actuator = controller?.userData?.inputSource?.gamepad?.hapticActuators?.[0];
    try { actuator?.pulse(intensity, ms); } catch { /* no haptics on this device */ }
  }

  // ---- desktop pointer -----------------------------------------------------

  _setupDesktopPointer() {
    const el = this.engine.renderer.domElement;
    el.addEventListener('pointermove', (e) => {
      this.pointer2D.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      if (this.dragging && this.desktopHit?.object.userData.panel) {
        this.desktopHit.object.userData.panel.onDrag(this.desktopHit.uv);
      }
    });
    el.addEventListener('pointerdown', () => { this.dragging = true; });
    el.addEventListener('pointerup', (e) => {
      this.dragging = false;
      // Ignore clicks that were really camera drags.
      if (this.engine.look?.moved > 6) return;
      if (this.engine.mode !== MODE.DESKTOP) return;
      if (e.button === 0 && this.desktopHit) this._dispatchSelect(this.desktopHit);
    });
    el.addEventListener('wheel', (e) => {
      const panel = this.desktopHit?.object.userData.panel;
      if (panel?.scrollBy(e.deltaY * 0.6)) e.preventDefault();
    }, { passive: false });
  }

  // ---- per-frame -----------------------------------------------------------

  update() {
    if (this.engine.mode === MODE.DESKTOP) {
      this.raycaster.setFromCamera(this.pointer2D, this.engine.camera);
      const hits = this.raycaster.intersectObjects(this.pointerTargets, false);
      const hit = hits[0] || null;
      this._updateHover(this.desktopHit, hit);
      this.desktopHit = hit;
      return;
    }

    for (const p of this.pointers) {
      if (!p.controller.visible) continue;
      const { origin, direction } = this._rayFrom(p.controller);
      const hit = this._intersect(origin, direction);
      this._updateHover(p.hit, hit);
      p.hit = hit;

      const ray = p.controller.getObjectByName('ray');
      if (ray) {
        const distance = hit ? hit.distance : RAY_LENGTH;
        ray.scale.z = distance;
        const cursor = ray.getObjectByName('cursor');
        if (cursor) {
          cursor.visible = !!hit;
          cursor.position.set(0, 0, -1);
          cursor.scale.setScalar(1 / Math.max(distance, 0.001));
        }
        ray.material.opacity = hit ? 0.95 : 0.4;
      }

      // Dragging a slider with the trigger held down.
      if (p.selecting && hit?.object.userData.panel) {
        hit.object.userData.panel.onDrag(hit.uv);
      }
    }
  }

  _updateHover(previous, current) {
    if (previous?.object !== current?.object && previous?.object?.userData.panel) {
      previous.object.userData.panel.onPointerMove(null);
    }
    if (current?.object.userData.panel) {
      current.object.userData.panel.onPointerMove(current.uv);
    }
  }

  /** Drop anything currently held, e.g. when a feature is torn down. */
  releaseAll() {
    for (const p of this.pointers) {
      if (p.held) this._onSqueezeEnd(p.controller);
    }
  }
}
