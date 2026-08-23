/**
 * The worlds you can sit in: a mosque interior, an open courtyard, a night
 * desert, a plain focus room, and passthrough (your own room, in MR).
 *
 * The mihrab always faces the Qibla direction the app is calibrated to, so the
 * architecture itself tells you which way to pray.
 */

import * as THREE from 'three';
import {
  starPatternTexture, marbleTexture, nightSkyTexture, daySkyTexture,
  calligraphyBandTexture,
} from '../core/patterns.js';

export const ENVIRONMENTS = {
  masjid:    { label: 'Masjid interior', icon: '🕌' },
  courtyard: { label: 'Open courtyard',  icon: '⛲' },
  night:     { label: 'Desert night',    icon: '🌙' },
  plain:     { label: 'Focus room',      icon: '◻️' },
  passthrough: { label: 'My room (MR)',  icon: '👓' },
};

export class Environment {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.root = new THREE.Group();
    this.engine.world.add(this.root);

    this.lamps = [];
    this.current = null;
    this.textures = {};
    this._buildLights();
    this.engine.add(this);
  }

  _buildLights() {
    this.ambient = new THREE.HemisphereLight(0xdfe9ff, 0x2a3b33, 1.1);
    this.engine.scene.add(this.ambient);

    this.key = new THREE.DirectionalLight(0xffeccc, 1.6);
    this.key.position.set(4, 8, 3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.5;
    this.key.shadow.camera.far = 40;
    this.key.shadow.camera.left = -12;
    this.key.shadow.camera.right = 12;
    this.key.shadow.camera.top = 12;
    this.key.shadow.camera.bottom = -12;
    this.engine.scene.add(this.key);

    this.fill = new THREE.PointLight(0xd8b46a, 6, 18, 2);
    this.fill.position.set(0, 3.2, -2);
    this.engine.scene.add(this.fill);
  }

  set(key) {
    if (this.current === key) return;
    this.current = key;
    this.clear();

    if (key === 'passthrough') {
      this.engine.world.visible = false;
      this.engine.scene.background = null;
      this.ambient.intensity = 1.4;
      this.key.intensity = 0.4;
      this.fill.intensity = 0;
      return;
    }

    this.engine.world.visible = true;
    this.ambient.intensity = 1.1;
    this.key.intensity = 1.6;
    this.fill.intensity = 6;

    switch (key) {
      case 'masjid': this._buildMasjid(); break;
      case 'courtyard': this._buildCourtyard(); break;
      case 'night': this._buildNight(); break;
      default: this._buildPlain();
    }
  }

  clear() {
    this.root.clear();
    this.lamps = [];
  }

  _sky(texture, fogColor, fogDensity) {
    this.engine.skyBackground = texture;
    this.engine.scene.background = texture;
    this.engine.scene.fog = fogDensity ? new THREE.FogExp2(fogColor, fogDensity) : null;
  }

  _floor(texture, repeat = 8, radius = 26) {
    texture.repeat.set(repeat, repeat);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 64),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0.02 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);
    return floor;
  }

  /** Column with a capital and an arch springing from it. */
  _column(x, z, height = 4.2) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      map: this.textures.marble, roughness: 0.35, metalness: 0.05, color: 0xf2ead8,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, height, 16), material);
    shaft.position.y = height / 2;
    shaft.castShadow = true;
    group.add(shaft);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 16), material);
    base.position.y = 0.11;
    group.add(base);

    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.22, 0.34, 16), material);
    capital.position.y = height + 0.1;
    group.add(capital);

    group.position.set(x, 0, z);
    this.root.add(group);
    return group;
  }

  /** Hanging lamp that glows and sways very slightly. */
  _lamp(x, y, z) {
    const group = new THREE.Group();
    const chain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x9a8352, metalness: 0.8, roughness: 0.4 }),
    );
    chain.position.y = 0.6;
    group.add(chain);

    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffd89b, emissive: 0xffb45a, emissiveIntensity: 1.4,
        transparent: true, opacity: 0.9, roughness: 0.3,
      }),
    );
    group.add(glass);

    const cage = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.012, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xd8b46a, metalness: 0.9, roughness: 0.3 }),
    );
    cage.rotation.x = Math.PI / 2;
    group.add(cage);

    const light = new THREE.PointLight(0xffc884, 3.2, 7, 2);
    group.add(light);

    group.position.set(x, y, z);
    group.userData.phase = Math.random() * Math.PI * 2;
    group.userData.baseX = x;
    this.root.add(group);
    this.lamps.push(group);
    return group;
  }

  /** The prayer niche, and the wall it sits in — always on the Qibla side. */
  _mihrab(distance = 9) {
    const group = new THREE.Group();
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: this.textures.marble, color: 0xe6dcc6, roughness: 0.7,
    });

    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 0.4), wallMaterial);
    wall.position.set(0, 3.5, -distance);
    wall.receiveShadow = true;
    group.add(wall);

    // Niche: a half-cylinder cut forward out of the wall.
    const niche = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 3.4, 24, 1, true, -Math.PI / 2, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x123a30, side: THREE.BackSide, roughness: 0.8,
        map: this.textures.star,
      }),
    );
    niche.position.set(0, 1.7, -distance + 0.35);
    group.add(niche);

    const arch = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 24, 16, 0, Math.PI, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1d5a4a, side: THREE.BackSide, roughness: 0.8 }),
    );
    arch.position.set(0, 3.4, -distance + 0.35);
    arch.rotation.y = -Math.PI / 2;
    group.add(arch);

    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.06, 10, 32, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xd8b46a, metalness: 0.7, roughness: 0.35 }),
    );
    frame.position.set(0, 3.4, -distance + 0.28);
    group.add(frame);

    // Calligraphy band above the niche.
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 0.75),
      new THREE.MeshBasicMaterial({
        map: calligraphyBandTexture('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'),
        transparent: true,
      }),
    );
    band.position.set(0, 5.1, -distance + 0.25);
    group.add(band);

    // A minbar (pulpit) beside the niche, for a sense of place.
    const minbar = new THREE.Group();
    const stepMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), stepMaterial);
      step.position.set(0, 0.11 + i * 0.22, i * 0.5);
      step.castShadow = true;
      minbar.add(step);
    }
    minbar.position.set(2.2, 0, -distance + 1.6);
    group.add(minbar);

    this.root.add(group);
    this.mihrabGroup = group;
    return group;
  }

  _dome(radius = 6, height = 5.5) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: this.textures.star, side: THREE.BackSide, roughness: 0.85, color: 0xbfd6cc,
      }),
    );
    dome.position.y = height;
    this.root.add(dome);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.99, 0.09, 10, 60),
      new THREE.MeshStandardMaterial({ color: 0xd8b46a, metalness: 0.7, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = height;
    this.root.add(ring);
    return dome;
  }

  _buildMasjid() {
    this.textures.marble = this.textures.marble || marbleTexture();
    this.textures.star = this.textures.star || starPatternTexture();
    this.textures.carpet = this.textures.carpet || starPatternTexture({
      background: '#0f3229', line: '#c9a45f', cells: 3,
    });

    this._sky(daySkyTexture(), 0x0d1b17, 0.014);
    this._floor(this.textures.carpet.clone(), 14, 22);

    // Rows of prayer lines on the carpet, facing the Qibla.
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xd8b46a, transparent: true, opacity: 0.18 });
    for (let i = 0; i < 6; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.03), lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.005, -5 + i * 1.9);
      this.root.add(line);
    }

    for (const x of [-5.5, 5.5]) {
      for (const z of [-6, -2.4, 1.2, 4.8]) this._column(x, z);
    }
    this._dome(6, 5.2);
    this._mihrab(9);

    this._lamp(-2.6, 3.1, -3.4);
    this._lamp(2.6, 3.1, -3.4);
    this._lamp(0, 3.4, 0.6);
    this._lamp(-2.6, 3.1, 2.6);
    this._lamp(2.6, 3.1, 2.6);
  }

  _buildCourtyard() {
    this.textures.marble = this.textures.marble || marbleTexture();
    this.textures.star = this.textures.star || starPatternTexture();
    this._sky(daySkyTexture(), 0xbfd4d0, 0.006);
    this._floor(marbleTexture({ base: '#efe9dc' }), 10, 24);

    // Arcade around the edge.
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this._column(Math.cos(angle) * 9, Math.sin(angle) * 9, 3.6);
    }

    // Central fountain.
    const fountain = new THREE.Group();
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.7, 0.5, 32),
      new THREE.MeshStandardMaterial({ map: this.textures.marble, roughness: 0.4 }),
    );
    basin.position.y = 0.25;
    fountain.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 32),
      new THREE.MeshStandardMaterial({
        color: 0x6fc7d6, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.85,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.48;
    fountain.add(water);
    fountain.position.set(0, 0, 3.5);
    this.root.add(fountain);
    this.water = water;

    this._mihrab(10);
    this._lamp(-3, 3.0, -4);
    this._lamp(3, 3.0, -4);

    // A few palms for depth.
    for (const [x, z] of [[-7, 4], [7, 4], [-6, -6], [6, -6]]) this._palm(x, z);
  }

  _palm(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b5334, roughness: 0.9 }),
    );
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);
    const frondMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d7a44, roughness: 0.8, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 9; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), frondMaterial);
      const angle = (i / 9) * Math.PI * 2;
      frond.position.set(Math.cos(angle) * 1.0, 4.05, Math.sin(angle) * 1.0);
      frond.rotation.set(-0.5, -angle, 0.25);
      group.add(frond);
    }
    group.position.set(x, 0, z);
    this.root.add(group);
  }

  _buildNight() {
    this.textures.star = this.textures.star || starPatternTexture();
    this._sky(nightSkyTexture(), 0x060d14, 0.02);
    this.ambient.intensity = 0.35;
    this.key.intensity = 0.25;
    this.key.color.set(0x8fa8ff);
    this.fill.intensity = 4;

    const sand = this._floor(
      marbleTexture({ base: '#c9b48c', vein: 'rgba(90,70,40,0.25)' }), 16, 30,
    );
    sand.material.roughness = 1;

    // Dunes.
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 12 + Math.random() * 14;
      const dune = new THREE.Mesh(
        new THREE.SphereGeometry(3 + Math.random() * 4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x8f7c56, roughness: 1 }),
      );
      dune.position.set(Math.cos(angle) * distance, -0.6, Math.sin(angle) * distance);
      dune.scale.y = 0.35;
      this.root.add(dune);
    }

    // Campfire lantern for warmth.
    this._lamp(0, 1.1, 1.6);
    this._mihrab(11);
  }

  _buildPlain() {
    this._sky(null, 0x0d1b17, 0.02);
    this.engine.scene.background = new THREE.Color(0x0b1a16);
    this.textures.star = this.textures.star || starPatternTexture();
    const floor = this._floor(starPatternTexture({ background: '#0e2620', cells: 2 }), 10, 14);
    floor.material.roughness = 1;
    this.ambient.intensity = 0.8;
    this.key.intensity = 0.9;
    this._lamp(-1.6, 2.6, -1.6);
    this._lamp(1.6, 2.6, -1.6);
  }

  /** Tie the key light to the real sun for the user's location and time. */
  syncSunToTime(times, now = new Date()) {
    if (!times?.sunrise || !times?.sunset) return;
    const day = times.sunset - times.sunrise;
    const t = (now - times.sunrise) / day;      // 0 at sunrise, 1 at sunset
    const altitude = Math.sin(Math.PI * THREE.MathUtils.clamp(t, -0.2, 1.2));
    const azimuth = Math.PI * (1 - THREE.MathUtils.clamp(t, 0, 1));
    this.key.position.set(Math.cos(azimuth) * 10, Math.max(-2, altitude * 10), Math.sin(azimuth) * 6);
    const warm = new THREE.Color(0xffd9a0);
    const cool = new THREE.Color(0xfff4e2);
    this.key.color.copy(altitude > 0.35 ? cool : warm);
    this.key.intensity = this.current === 'night' ? 0.25 : THREE.MathUtils.clamp(altitude * 2, 0.15, 1.8);
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    for (const lamp of this.lamps) {
      lamp.rotation.z = Math.sin(this.t * 0.6 + lamp.userData.phase) * 0.02;
    }
    if (this.water) {
      this.water.material.opacity = 0.78 + Math.sin(this.t * 1.4) * 0.06;
    }
  }
}
