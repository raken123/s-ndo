// WebXR (Meta Quest m.fl.): starta VR, kontroller med strålar för att trycka på panelknappar,
// och känna av när headsetet tas av (= besökaren har gått).
import * as THREE from '../vendor/three.module.min.js';

export class XR extends EventTarget {
  constructor(renderer, ui) {
    super();
    this.renderer = renderer;
    this.ui = ui;
    this.session = null;
    this.supported = false;
    this.controllers = [];
    this.ray = new THREE.Raycaster();
    this.tmpM = new THREE.Matrix4();
  }

  async check() {
    if (!navigator.xr) return false;
    try { this.supported = await navigator.xr.isSessionSupported('immersive-vr'); } catch { this.supported = false; }
    return this.supported;
  }

  setupControllers(rig) {
    for (let i = 0; i < 2; i++) {
      const c = this.renderer.xr.getController(i);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
        new THREE.LineBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.8 }),
      );
      line.scale.z = 2.5;
      line.visible = false;
      c.add(line);
      c.userData.line = line;
      c.addEventListener('selectstart', () => this.select(c));
      rig.add(c);
      // Enkel handmodell
      const grip = this.renderer.xr.getControllerGrip(i);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), new THREE.MeshStandardMaterial({ color: 0x445066 }));
      grip.add(hand);
      rig.add(grip);
      this.controllers.push(c);
    }
  }

  async enter() {
    if (!this.supported || this.session) return;
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
    });
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(session);
    this.session = session;
    session.addEventListener('end', () => {
      this.session = null;
      this.dispatchEvent(new Event('end'));
    });
    // Headsetet av/på: 'visible' ↔ 'hidden'/'visible-blurred'
    session.addEventListener('visibilitychange', () => {
      this.dispatchEvent(new CustomEvent('visibility', { detail: session.visibilityState }));
    });
    this.dispatchEvent(new Event('start'));
  }

  intersectPanel(c) {
    const panel = this.ui.panel;
    if (!panel.visible) return null;
    this.tmpM.identity().extractRotation(c.matrixWorld);
    this.ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.ray.ray.direction.set(0, 0, -1).applyMatrix4(this.tmpM);
    const hit = this.ray.intersectObject(panel, false)[0];
    return hit || null;
  }

  select(c) {
    const hit = this.intersectPanel(c);
    if (hit) {
      const i = this.ui.hitTest(hit.uv);
      if (i >= 0) this.ui.press(i);
    }
  }

  update() {
    if (!this.session) return;
    for (const c of this.controllers) {
      const hit = this.intersectPanel(c);
      c.userData.line.visible = this.ui.panel.visible;
      if (hit) {
        c.userData.line.scale.z = hit.distance;
        this.ui.hitTest(hit.uv, true);
      } else c.userData.line.scale.z = 2.5;
    }
  }
}
