/**
 * Al-Asma' al-Husna as a room you stand inside.
 *
 * The ninety-nine names orbit around you on two rings of illuminated cards.
 * Look at one and it turns to face you; select it and it comes forward with its
 * meaning. A search field and a "learn" mode make it usable as a memoriser
 * rather than just an ornament.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { NAMES_99, ALLAH } from '../data/names99.js';

const RING_RADIUS = 2.9;

export class NamesGallery {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.group = new THREE.Group();
    this.group.name = 'names-99';
    this.group.visible = false;
    this.cards = [];
    this.selected = null;
    this.spin = 0.02;

    this._buildCentre();
    this._buildCards();
    this._buildDetail();
    this.engine.add(this);
  }

  _buildCentre() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = '#d8b46a';
    ctx.font = '400 240px Amiri, "Noto Naskh Arabic", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(ALLAH.arabic, 256, 270);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.centre = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    this.centre.position.y = 2.1;
    this.group.add(this.centre);

    const glow = new THREE.PointLight(0xd8b46a, 8, 8, 2);
    glow.position.y = 2.1;
    this.group.add(glow);
  }

  _buildCards() {
    // Three rings of thirty-three — the same division as the tasbih.
    const perRing = 33;
    NAMES_99.forEach((name, i) => {
      const ring = Math.floor(i / perRing);
      const indexInRing = i % perRing;
      const angle = (indexInRing / perRing) * Math.PI * 2 + ring * 0.06;
      const radius = RING_RADIUS + ring * 0.4;
      const y = 1.05 + ring * 0.72;

      const card = this._makeCard(name);
      card.position.set(Math.sin(angle) * radius, y, -Math.cos(angle) * radius);
      // Turn each card inwards so the person standing in the middle can read it,
      // and tilt the upper rings down towards eye level.
      card.rotation.y = -angle;
      card.rotation.x = (1.6 - y) * 0.28;
      card.userData.name = name;
      card.userData.angle = angle;
      card.userData.onSelect = () => this.select(name);
      this.group.add(card);
      this.cards.push(card);
      this.app.interaction.register(card);
    });
  }

  _makeCard(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(18,48,40,0.95)');
    gradient.addColorStop(1, 'rgba(9,26,22,0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = 'rgba(216,180,106,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 496, 304);

    ctx.fillStyle = 'rgba(216,180,106,0.55)';
    ctx.font = '600 26px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(name.index), 26, 44);

    ctx.fillStyle = '#f3e7c8';
    ctx.font = '400 96px Amiri, "Noto Naskh Arabic", serif';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(name.arabic, 256, 150);

    ctx.direction = 'ltr';
    ctx.fillStyle = '#d8b46a';
    ctx.font = '600 34px Inter, sans-serif';
    ctx.fillText(name.translit, 256, 216);
    ctx.fillStyle = '#9fb5ac';
    ctx.font = '400 25px Inter, sans-serif';
    ctx.fillText(name.meaning, 256, 262);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.275),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    return mesh;
  }

  _buildDetail() {
    this.panel = new Panel({ width: 0.85, height: 0.5, ppm: 1200, name: 'names-detail' });
    this.panel.render = (p) => this._render(p);
    this.panel.mesh.visible = false;
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
  }

  _render(p) {
    const name = this.selected;
    if (!name) return;
    let y = p.title(`${name.index}. ${name.translit}`, name.meaning);

    p.arabic(name.arabic, 46, y + 10, { size: 96, align: 'center', maxWidth: p.W - 92 });
    y += 190;

    y = p.text(
      'One of the names by which God is called in the Qur\'an and the sunnah. '
      + 'Reciting and reflecting on them is a long-established form of dhikr.',
      46, y, { color: THEME.muted, font: '400 23px Inter, sans-serif', lineHeight: 31 },
    ) + 20;

    const bw = (p.W - 112) / 3;
    p.button('prev', '‹ Previous', 46, p.H - 96, bw, 62, {
      onSelect: () => this.select(NAMES_99[(name.index - 2 + 99) % 99]),
    });
    p.button('dhikr', 'Count this name', 46 + bw + 10, p.H - 96, bw, 62, {
      onSelect: () => this.app.startNameDhikr(name),
    });
    p.button('next', 'Next ›', 46 + (bw + 10) * 2, p.H - 96, bw, 62, {
      onSelect: () => this.select(NAMES_99[name.index % 99]),
    });
  }

  select(name) {
    this.selected = name;
    this.panel.mesh.visible = true;
    this.panel.refresh();
    this.app.audio.click();
    this.app.audio.say(`${name.translit}. ${name.meaning}`);

    // Bring the panel in front of the viewer.
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.engine.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const target = head.clone().addScaledVector(forward, 1.1);
    target.y = head.y - 0.1;
    this.panel.mesh.position.copy(this.group.worldToLocal(target.clone()));
    this.panel.mesh.lookAt(head);

    // Highlight the matching card.
    for (const card of this.cards) {
      const isIt = card.userData.name === name;
      card.scale.setScalar(isIt ? 1.35 : 1);
      card.material.opacity = isIt ? 1 : 0.85;
    }
    return name;
  }

  /** Slowly rotate through all 99, one every few seconds, as a meditation. */
  toggleAutoTour() {
    this.tour = this.tour ? null : { index: 0, elapsed: 0 };
    this.app.toast(this.tour ? 'Touring the names' : 'Tour stopped');
    return !!this.tour;
  }

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    const head = this.engine.camera.getWorldPosition(new THREE.Vector3());
    this.group.position.set(head.x, this.app.floorY ?? 0, head.z);
  }

  hide() {
    this.group.visible = false;
    this.tour = null;
    this.group.parent?.remove(this.group);
  }

  update(dt) {
    if (!this.group.visible) return;
    this.group.rotation.y += dt * this.spin;

    if (this.tour) {
      this.tour.elapsed += dt;
      if (this.tour.elapsed > 4) {
        this.tour.elapsed = 0;
        this.tour.index = (this.tour.index + 1) % NAMES_99.length;
        this.select(NAMES_99[this.tour.index]);
      }
    }
  }

  dispose() {
    this.cards.forEach((c) => this.app.interaction.unregister(c));
    this.app.interaction.unregister(this.panel.mesh);
    this.panel.dispose();
    this.engine.remove(this);
  }
}
