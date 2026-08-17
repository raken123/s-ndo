/* xr.js — immersive VR: session lifecycle, controller beams, and pointing at
   in-world panels.

   A DOM overlay is not visible inside an immersive-vr session, so anything the
   player must read or press in VR is a textured panel in the hall, picked with
   a controller ray. */
(function (global) {
  'use strict';

  const M4 = global.AJGL.M4;

  function XRManager(renderer, world) {
    this.renderer = renderer;
    this.world = world;
    this.session = null;
    this.refSpace = null;
    this.supported = false;
    this.onSelect = null;      // (panelNode) => void
    this.onFrame = null;       // (dt, frame) => void
    this.onEnd = null;
    this._tmp = M4.create();
  }

  XRManager.prototype.check = async function () {
    if (!global.navigator || !navigator.xr) return false;
    try {
      this.supported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch (e) {
      this.supported = false;
    }
    return this.supported;
  };

  XRManager.prototype.enter = async function () {
    if (this.session) return this.session;
    const gl = this.renderer.gl;
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
    });
    this.session = session;

    await gl.makeXRCompatible();
    const layer = new XRWebGLLayer(session, gl, { antialias: true });
    session.updateRenderState({ baseLayer: layer, depthNear: 0.05, depthFar: 120 });

    try { this.refSpace = await session.requestReferenceSpace('local-floor'); }
    catch (e) { this.refSpace = await session.requestReferenceSpace('local'); }

    session.addEventListener('end', () => {
      this.session = null;
      this.refSpace = null;
      if (this.onEnd) this.onEnd();
    });

    session.addEventListener('select', (ev) => {
      const hit = this._pickFrom(ev.inputSource, ev.frame);
      if (hit && this.onSelect) this.onSelect(hit);
    });

    let last = 0;
    const loop = (time, frame) => {
      if (!this.session) return;
      this.session.requestAnimationFrame(loop);
      const dt = last ? Math.min(0.1, (time - last) / 1000) : 0.016;
      last = time;

      if (this.onFrame) this.onFrame(dt, frame);
      this._updatePointers(frame);

      const pose = frame.getViewerPose(this.refSpace);
      if (pose) {
        this.renderer.renderXR(this.world.root, pose, this.session.renderState.baseLayer);
      }
    };
    session.requestAnimationFrame(loop);
    return session;
  };

  XRManager.prototype.exit = function () {
    if (this.session) this.session.end();
  };

  /* Positions a beam node for each tracked controller. */
  XRManager.prototype._updatePointers = function (frame) {
    if (!this.world.beams) return;
    const sources = Array.from(this.session.inputSources || []);
    for (let k = 0; k < this.world.beams.length; k++) {
      const beam = this.world.beams[k];
      const src = sources[k];
      if (!src || !src.targetRaySpace) { beam.visible = false; continue; }
      const pose = frame.getPose(src.targetRaySpace, this.refSpace);
      if (!pose) { beam.visible = false; continue; }
      const m = pose.transform.matrix;
      beam.visible = true;
      beam.pos = [m[12], m[13], m[14]];
      /* derive euler-ish orientation by pointing the beam down -Z of the pose */
      beam.rot = [
        Math.asin(Math.max(-1, Math.min(1, -m[9]))),
        Math.atan2(m[8], m[10]),
        0
      ];
    }
  };

  /* Ray from a controller against every pickable panel; nearest wins. */
  XRManager.prototype._pickFrom = function (inputSource, frame) {
    if (!frame || !inputSource || !inputSource.targetRaySpace) return null;
    const pose = frame.getPose(inputSource.targetRaySpace, this.refSpace);
    if (!pose) return null;
    const m = pose.transform.matrix;
    const origin = [m[12], m[13], m[14]];
    const dir = [-m[8], -m[9], -m[10]];
    return this.pick(origin, dir);
  };

  /* Intersects a world-space ray with pickable quads. */
  XRManager.prototype.pick = function (origin, dir) {
    const list = this.world.pickables || [];
    let best = null, bestT = Infinity;
    const inv = this._tmp;
    for (const node of list) {
      if (!node.visible || node.alpha < 0.15) continue;
      M4.invert(inv, node.world);
      const ox = inv[0]*origin[0] + inv[4]*origin[1] + inv[8]*origin[2] + inv[12];
      const oy = inv[1]*origin[0] + inv[5]*origin[1] + inv[9]*origin[2] + inv[13];
      const oz = inv[2]*origin[0] + inv[6]*origin[1] + inv[10]*origin[2] + inv[14];
      const dx = inv[0]*dir[0] + inv[4]*dir[1] + inv[8]*dir[2];
      const dy = inv[1]*dir[0] + inv[5]*dir[1] + inv[9]*dir[2];
      const dz = inv[2]*dir[0] + inv[6]*dir[1] + inv[10]*dir[2];
      if (Math.abs(dz) < 1e-6) continue;
      const t = -oz / dz;
      if (t <= 0 || t >= bestT) continue;
      const hx = ox + dx * t, hy = oy + dy * t;
      if (Math.abs(hx) > 0.5 || Math.abs(hy) > 0.5) continue;
      bestT = t; best = node;
    }
    return best;
  };

  global.AJXR = { XRManager };
})(typeof window !== 'undefined' ? window : globalThis);
