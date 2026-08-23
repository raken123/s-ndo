/**
 * Renderer, scene graph, XR session handling and the frame loop.
 *
 * The same scene serves three targets: an immersive VR session, an immersive AR
 * (passthrough / mixed reality) session, and a plain desktop window used for
 * previewing without a headset.
 */

import * as THREE from 'three';

export const MODE = { DESKTOP: 'desktop', VR: 'immersive-vr', AR: 'immersive-ar' };

export class Engine extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.mode = MODE.DESKTOP;
    this.clock = new THREE.Clock();
    this.updatables = new Set();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0d1b17, 0.012);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 400);
    this.camera.position.set(0, 1.6, 0);

    /** The player rig: move this, never the camera, so XR head tracking stays intact. */
    this.player = new THREE.Group();
    this.player.add(this.camera);
    this.scene.add(this.player);

    /** Everything that only exists in VR (floor, walls, sky) hangs off here so
     *  passthrough can hide it in one call. */
    this.world = new THREE.Group();
    this.scene.add(this.world);

    /** Objects placed in the user's real room in MR; kept in both modes. */
    this.stage = new THREE.Group();
    this.scene.add(this.stage);

    this._setupDesktopControls();
    window.addEventListener('resize', () => this.resize());

    this.renderer.setAnimationLoop((time, frame) => this._frame(time, frame));
  }

  resize() {
    if (this.renderer.xr.isPresenting) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  add(updatable) { this.updatables.add(updatable); return updatable; }
  remove(updatable) { this.updatables.delete(updatable); }

  _frame(time, frame) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.xrFrame = frame;
    if (this.mode === MODE.DESKTOP) this._moveDesktop(dt);
    for (const u of this.updatables) {
      try {
        (u.update || u).call(u, dt, frame, time);
      } catch (err) {
        console.error('[update]', u.constructor?.name || 'anon', err);
        this.updatables.delete(u);
      }
    }
    this.dispatchEvent(new CustomEvent('beforerender', { detail: { dt, frame } }));
    this.renderer.render(this.scene, this.camera);
  }

  // ---- XR sessions ---------------------------------------------------------

  static async supported() {
    const out = { vr: false, ar: false, reason: '' };
    if (!('xr' in navigator)) { out.reason = 'This browser has no WebXR support.'; return out; }
    try {
      out.vr = await navigator.xr.isSessionSupported('immersive-vr');
      out.ar = await navigator.xr.isSessionSupported('immersive-ar');
      if (!out.vr && !out.ar) out.reason = 'No immersive XR device was detected.';
    } catch (err) {
      out.reason = `XR unavailable: ${err.message}`;
    }
    return out;
  }

  async enterXR(mode = MODE.VR) {
    const optionalFeatures = [
      'local-floor', 'bounded-floor', 'hand-tracking', 'layers',
    ];
    if (mode === MODE.AR) {
      optionalFeatures.push('hit-test', 'anchors', 'plane-detection', 'light-estimation', 'dom-overlay');
    }
    const init = { optionalFeatures };
    if (mode === MODE.AR) init.domOverlay = { root: document.getElementById('hud') };

    const session = await navigator.xr.requestSession(mode, init);
    await this.renderer.xr.setSession(session);
    this.session = session;
    this.mode = mode;
    this._applyMode();

    session.addEventListener('end', () => {
      this.session = null;
      this.mode = MODE.DESKTOP;
      this._applyMode();
      this.dispatchEvent(new CustomEvent('modechange', { detail: this.mode }));
    });

    // A hit-test source lets MR place objects on real surfaces.
    if (mode === MODE.AR) {
      try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
      } catch { this.hitTestSource = null; }
    }

    this.dispatchEvent(new CustomEvent('modechange', { detail: this.mode }));
    return session;
  }

  exitXR() { this.session?.end(); }

  _applyMode() {
    const passthrough = this.mode === MODE.AR;
    this.world.visible = !passthrough;
    this.scene.fog = passthrough ? null : new THREE.FogExp2(0x0d1b17, 0.012);
    this.renderer.setClearAlpha(passthrough ? 0 : 1);
    if (!passthrough) this.scene.background = this.skyBackground || null;
    else this.scene.background = null;
  }

  /** Result of the current frame's hit test, or null. Used for placing objects in MR. */
  hitTestPose(frame) {
    if (!frame || !this.hitTestSource) return null;
    const results = frame.getHitTestResults(this.hitTestSource);
    if (!results.length) return null;
    const refSpace = this.renderer.xr.getReferenceSpace();
    return results[0].getPose(refSpace);
  }

  // ---- desktop preview controls -------------------------------------------

  _setupDesktopControls() {
    this.keys = new Set();
    this.look = { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 };
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== MODE.DESKTOP || e.button !== 0) return;
      this.look.dragging = true;
      this.look.moved = 0;
      this.look.lastX = e.clientX;
      this.look.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.look.dragging) return;
      const dx = e.clientX - this.look.lastX;
      const dy = e.clientY - this.look.lastY;
      this.look.lastX = e.clientX;
      this.look.lastY = e.clientY;
      this.look.moved += Math.abs(dx) + Math.abs(dy);
      this.look.yaw -= dx * 0.0035;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.0035, -1.35, 1.35);
      this.camera.rotation.set(this.look.pitch, this.look.yaw, 0, 'YXZ');
    });
    const endDrag = (e) => {
      if (!this.look.dragging) return;
      this.look.dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _moveDesktop(dt) {
    const speed = (this.keys.has('ShiftLeft') ? 3.2 : 1.6) * dt;
    const dir = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dir.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dir.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dir.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dir.x += 1;
    if (dir.lengthSq() === 0) return;
    dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.look.yaw);
    this.player.position.addScaledVector(dir, speed);
  }

  /** Where the user is looking, in world space. */
  headPose(target = new THREE.Vector3(), dirTarget = new THREE.Vector3()) {
    this.camera.getWorldPosition(target);
    this.camera.getWorldDirection(dirTarget);
    return { position: target, direction: dirTarget };
  }

  /** Place `object` a comfortable distance in front of the user, at eye level. */
  placeInFront(object, distance = 1.1, heightOffset = -0.15) {
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    this.headPose(pos, dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    object.position.copy(pos).addScaledVector(dir, distance);
    object.position.y = Math.max(0.35, pos.y + heightOffset);
    object.lookAt(pos.x, object.position.y, pos.z);
    return object;
  }
}
