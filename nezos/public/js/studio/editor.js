// The design-mode 3D viewport: renders the scene document, picking, gizmos.
import { THREE, buildObject, applySettings, defaultLights, addDefaultSun, sceneHasLights, readTransform } from '../engine/engine.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class Viewport extends EventTarget {
  constructor(container, doc) {
    super();
    this.container = container;
    this.doc = doc;
    this.objects = new Map();
    this.selectedId = null;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    this.camera.position.set(12, 10, 16);

    this.orbit = new OrbitControls(this.camera, r.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;

    this.gizmo = new TransformControls(this.camera, r.domElement);
    this.gizmo.setSize(0.9);
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (!e.value) this._commitTransform();
    });

    this.helpers = new THREE.Group();
    this.grid = new THREE.GridHelper(200, 200, '#3a4170', '#1f2440');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.55;
    this.grid.position.y = -0.02; // sit just under y=0 so ground planes don't z-fight with it
    this.helpers.add(this.grid);
    this.selBox = new THREE.BoxHelper(undefined, '#7c5cff');
    this.selBox.visible = false;
    this.helpers.add(this.selBox);

    this._bindPointer();
    this.rebuild();
    doc.addEventListener('change', (e) => this._onDocChange(e.detail));

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    r.setAnimationLoop(() => this._frame());
  }

  // ---------------------------------------------------------- building
  rebuild() {
    const keep = this.selectedId;
    this.gizmo.detach();
    this.scene.clear();
    this.objects.clear();
    const s = this.doc.scene;
    applySettings(this.scene, s.settings);
    this.scene.fog = null; // fog only applies in play mode; it hides things while editing
    defaultLights(this.scene, s.settings);
    if (!sceneHasLights(s)) addDefaultSun(this.scene);
    this.scene.add(this.helpers);
    this.scene.add(this.gizmo.getHelper());
    for (const spec of s.objects) this._addObject(spec);
    this.select(this.objects.has(keep) ? keep : null, { silent: true });
  }

  _addObject(spec) {
    try {
      const obj = buildObject(spec, { editor: true });
      this.scene.add(obj);
      this.objects.set(spec.id, obj);
    } catch (err) {
      console.warn('build failed', spec, err);
    }
  }

  rebuildOne(id) {
    const old = this.objects.get(id);
    if (old) {
      if (this.gizmo.object === old) this.gizmo.detach();
      this.scene.remove(old);
      this.objects.delete(id);
    }
    const spec = this.doc.byId(id);
    if (spec) this._addObject(spec);
    if (this.selectedId === id) this.select(spec ? id : null, { silent: !spec ? false : true });
  }

  _onDocChange({ kind, id }) {
    if (kind === 'transform') return; // the gizmo already moved it
    if (kind === 'object' && id) this.rebuildOne(id);
    else if (kind === 'settings') {
      applySettings(this.scene, this.doc.scene.settings);
      this.scene.fog = null;
    } else if (kind !== 'script') this.rebuild();
  }

  // ---------------------------------------------------------- selection
  select(id, { silent = false } = {}) {
    this.selectedId = id && this.objects.has(id) ? id : null;
    const obj = this.selectedId ? this.objects.get(this.selectedId) : null;
    if (obj) {
      this.gizmo.attach(obj);
      this.selBox.setFromObject(obj);
      this.selBox.visible = true;
    } else {
      this.gizmo.detach();
      this.selBox.visible = false;
    }
    if (!silent) this.dispatchEvent(new CustomEvent('select', { detail: { id: this.selectedId } }));
  }

  setGizmoMode(mode) { this.gizmo.setMode(mode); }
  setSnap(on) {
    this.gizmo.setTranslationSnap(on ? 0.5 : null);
    this.gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(15) : null);
    this.gizmo.setScaleSnap(on ? 0.25 : null);
  }

  _commitTransform() {
    const obj = this.gizmo.object;
    if (!obj) return;
    const id = obj.userData.id;
    const t = readTransform(obj);
    const spec = this.doc.byId(id);
    if (spec?.type === 'text') {
      // text quads are pre-scaled by aspect ratio; store the user-facing scale
      const [a, b] = obj.userData.textScale || [1, 1];
      t.scale = [t.scale[0] / a, t.scale[1] / b, t.scale[2]];
    }
    this.doc.update(id, t, 'transform');
    this.dispatchEvent(new CustomEvent('transform', { detail: { id } }));
  }

  _bindPointer() {
    const dom = this.renderer.domElement;
    let down = null;
    dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, button: e.button }; });
    dom.addEventListener('pointerup', (e) => {
      if (!down || down.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 4 || this.gizmo.dragging) return;
      if (this.gizmo.axis) return; // clicked the gizmo
      this.select(this.pick(e));
    });
    dom.addEventListener('dblclick', (e) => {
      const id = this.pick(e);
      if (id) this.focus(id);
    });
    dom.addEventListener('dragover', (e) => e.preventDefault());
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects([...this.objects.values()], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.id) o = o.parent;
      if (o && o.userData.id) return o.userData.id;
    }
    return null;
  }

  /** World position in front of the camera on the ground — where new things go. */
  dropPoint() {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, p) && p.distanceTo(this.camera.position) < 60) return p;
    return this.orbit.target.clone().setY(0);
  }

  focus(id = this.selectedId) {
    const obj = id && this.objects.get(id);
    const box = new THREE.Box3();
    if (obj) box.setFromObject(obj);
    else {
      const sz = new THREE.Vector3();
      for (const o of this.objects.values()) {
        const b = new THREE.Box3().setFromObject(o);
        if (!b.isEmpty() && b.getSize(sz).length() < 120) box.union(b);
      }
      if (box.isEmpty()) for (const o of this.objects.values()) box.expandByObject(o);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 4;
    const dir = this.camera.position.clone().sub(this.orbit.target).normalize();
    this.orbit.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, Math.max(size * 1.4, 4));
  }

  thumbnail() {
    this.selBox.visible = false;
    const giz = this.gizmo.getHelper();
    const gv = giz.visible;
    giz.visible = false;
    this.grid.visible = false;
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 240;
    const ctx = c.getContext('2d');
    const ar = src.width / src.height;
    const sw = ar > 1.6 ? src.height * 1.6 : src.width;
    const sh = ar > 1.6 ? src.height : src.width / 1.6;
    ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    this.grid.visible = true;
    giz.visible = gv;
    this.selBox.visible = !!this.selectedId;
    return c.toDataURL('image/jpeg', 0.75);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setPaused(p) { this.paused = p; }

  _frame() {
    if (this.paused) return;
    this.orbit.update();
    if (this.selBox.visible && this.selectedId) {
      const obj = this.objects.get(this.selectedId);
      if (obj) this.selBox.setFromObject(obj);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
