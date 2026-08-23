/**
 * Digital misbaha.
 *
 * A real bead string hanging in front of you: flick a bead with a controller or
 * a tracked hand and it counts, clicks and buzzes. The beads actually move —
 * counted ones slide past the imam bead, so the string tells you where you are
 * without reading a number.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { TASBIH_PRESETS, AFTER_SALAH } from '../data/salah.js';

const BEAD_COUNT = 33;
const RADIUS = 0.16;

export class Tasbih {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.presets = TASBIH_PRESETS.map((x) => ({ ...x }));
    this.presetIndex = 0;
    this.count = 0;
    this.rounds = 0;
    this.sessionCount = 0;

    this.group = new THREE.Group();
    this.group.name = 'tasbih';
    this.group.visible = false;
    this._buildBeads();
    this._buildPanel();
    this.engine.add(this);
  }

  get preset() { return this.presets[this.presetIndex]; }

  _buildBeads() {
    this.loop = new THREE.Group();
    this.beadMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f5d4e, roughness: 0.25, metalness: 0.15,
    });
    const countedMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8b46a, roughness: 0.2, metalness: 0.55,
      emissive: 0x6b5220, emissiveIntensity: 0.35,
    });
    this.countedMaterial = countedMaterial;
    this.beads = [];

    for (let i = 0; i < BEAD_COUNT; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), this.beadMaterial);
      bead.userData.index = i;
      bead.userData.onSelect = () => this.tick();
      this.loop.add(bead);
      this.beads.push(bead);
      this.app.interaction.register(bead);
    }

    // The imam bead marks the start of the loop.
    this.imam = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.035, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x8c6a2f, roughness: 0.3, metalness: 0.6 }),
    );
    this.imam.position.set(0, -RADIUS - 0.05, 0);
    this.imam.userData.onSelect = () => this.reset();
    this.loop.add(this.imam);
    this.app.interaction.register(this.imam);

    // The cord.
    const curve = new THREE.EllipseCurve(0, 0, RADIUS, RADIUS, 0, Math.PI * 2);
    const points = curve.getPoints(80).map((p) => new THREE.Vector3(p.x, p.y, 0));
    this.cord = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x6b5334 }),
    );
    this.loop.add(this.cord);

    this.group.add(this.loop);
    this._layoutBeads();

    this.app.interaction.registerGrabbable(this.group, {});
  }

  _layoutBeads() {
    this.beads.forEach((bead, i) => {
      const a = (i / BEAD_COUNT) * Math.PI * 2 + Math.PI / 2;
      bead.position.set(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0);
      const counted = i < this.count % BEAD_COUNT;
      bead.material = counted ? this.countedMaterial : this.beadMaterial;
      bead.scale.setScalar(counted ? 1.18 : 1);
    });
  }

  _buildPanel() {
    this.panel = new Panel({ width: 0.5, height: 0.42, ppm: 1200, name: 'tasbih-panel' });
    this.panel.render = (p) => this._render(p);
    this.panel.mesh.position.set(0, 0.34, -0.02);
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
  }

  _render(p) {
    const preset = this.preset;
    let y = p.title('Tasbih', `${this.rounds} completed · ${this.store.get('progress.tasbihTotal', 0).toLocaleString()} all time`);

    p.arabic(preset.arabic, 46, y, { size: 44, align: 'center', maxWidth: p.W - 92 });
    y += 78;

    p.ctx.textAlign = 'center';
    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 96px Inter, sans-serif';
    p.ctx.fillText(String(this.count), p.W / 2, y);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 24px Inter, sans-serif';
    p.ctx.fillText(preset.target ? `of ${preset.target} — ${preset.name}` : preset.name, p.W / 2, y + 108);
    p.ctx.textAlign = 'left';
    y += 150;

    if (preset.target) {
      p.progress(this.count / preset.target, 46, y, p.W - 92, 10);
      y += 28;
    }

    const bw = (p.W - 112) / 3;
    p.button('prev-preset', '‹', 46, y, bw * 0.6, 58, { onSelect: () => this.cyclePreset(-1) });
    p.button('count', 'Count +1', 46 + bw * 0.6 + 10, y, bw * 1.8, 58, { onSelect: () => this.tick() });
    p.button('next-preset', '›', p.W - 46 - bw * 0.6, y, bw * 0.6, 58, { onSelect: () => this.cyclePreset(1) });
    y += 72;

    p.button('reset', 'Reset', 46, y, (p.W - 102) / 2, 52, {
      font: '600 22px Inter, sans-serif', onSelect: () => this.reset(),
    });
    p.button('after-salah', 'After-salah set', 46 + (p.W - 102) / 2 + 10, y, (p.W - 102) / 2, 52, {
      font: '600 22px Inter, sans-serif', onSelect: () => this.startAfterSalah(),
    });
  }

  // ---- counting ------------------------------------------------------------

  tick() {
    this.count += 1;
    this.sessionCount += 1;
    const target = this.preset.target;

    this.app.audio.bead();
    for (const pointer of this.app.interaction.pointers) {
      this.app.interaction.pulse(pointer.controller, 0.2, 12);
    }

    if (target && this.count >= target) {
      this.rounds += 1;
      this.app.audio.success();
      this.store.addTasbih(target);
      this.count = 0;
      if (this.chain?.length) this._advanceChain();
      else this.app.toast(`${this.preset.name} complete — ${target}`);
    }

    this._layoutBeads();
    this.panel.refresh();
    return this.count;
  }

  reset() {
    if (this.count > 0) this.store.addTasbih(this.count);
    this.count = 0;
    this.chain = null;
    this._layoutBeads();
    this.panel.refresh();
    this.app.audio.click();
  }

  cyclePreset(direction) {
    this.presetIndex = (this.presetIndex + direction + this.presets.length) % this.presets.length;
    this.count = 0;
    this.chain = null;
    this._layoutBeads();
    this.panel.refresh();
  }

  /** Walk through the dhikr said after the obligatory prayer, in order. */
  startAfterSalah() {
    this.chain = AFTER_SALAH.filter((d) => d.count > 1).map((d) => ({
      name: d.translit, arabic: d.arabic, target: d.count,
    }));
    this.chainIndex = 0;
    this._applyChain();
    this.app.toast('After-salah dhikr: 33, 33, 33.');
  }

  _applyChain() {
    const entry = this.chain[this.chainIndex];
    if (!entry) { this.chain = null; return; }
    // The last slot is the scratch preset the chain drives.
    this.presets[this.presets.length - 1] = {
      name: entry.name, arabic: entry.arabic, target: entry.target,
    };
    this.presetIndex = this.presets.length - 1;
    this.count = 0;
    this.panel.refresh();
  }

  _advanceChain() {
    this.chainIndex += 1;
    if (this.chainIndex >= this.chain.length) {
      this.chain = null;
      this.app.toast('Dhikr after prayer complete.');
      this.app.audio.success();
      return;
    }
    this._applyChain();
  }

  // ---- lifecycle -----------------------------------------------------------

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    this.engine.placeInFront(this.group, 0.55, -0.25);
    this.panel.refresh();
  }

  hide() {
    if (this.count > 0) this.store.addTasbih(this.count);
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  update(dt) {
    if (!this.group.visible) return;
    this.loop.rotation.z -= dt * 0.06 * (this.count % 2 === 0 ? 1 : 1.02);
  }

  dispose() {
    this.beads.forEach((b) => this.app.interaction.unregister(b));
    this.app.interaction.unregister(this.imam);
    this.app.interaction.unregister(this.panel.mesh);
    this.app.interaction.unregisterGrabbable(this.group);
    this.panel.dispose();
    this.engine.remove(this);
  }
}
