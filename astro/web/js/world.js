// Solsystemet. Positioner i meter (JS-dubbelprecision) och "flytande origo":
// skeppet ligger alltid i (0,0,0) och världen flyttas runt det, så att inget darrar.
import * as THREE from '../vendor/three.module.min.js';
import { BODIES, BODY, AU_KM, MOON_DIST_KM } from './data.js';
import { planetTexture, cloudTexture, ringTexture, glowTexture, fbm } from './textures.js';

export const KM = 1000; // 1 scenenhet i data.js = 1 km = 1000 m i världen
export const BELT = { inner: 3800 * KM, outer: 4050 * KM, half: 30 * KM };

export function bodyPosition(b, out = new THREE.Vector3()) {
  if (b.parent) {
    bodyPosition(BODY[b.parent], out);
    return out.add(new THREE.Vector3(40, 12, -216).multiplyScalar(KM));
  }
  const a = THREE.MathUtils.degToRad(b.angle);
  return out.set(Math.cos(a) * b.orbit * KM, (b.incline || 0) * KM, Math.sin(a) * b.orbit * KM);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'solar-system';
    scene.add(this.root);
    this.bodies = [];
    this.positions = {};
    this.tmp = new THREE.Vector3();

    scene.add(new THREE.AmbientLight(0x404a60, 0.35));
    this.sunLight = new THREE.DirectionalLight(0xfff2dd, 3.2);
    this.sunLight.position.set(1, 0, 0);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.buildStars();
    for (const b of BODIES) this.buildBody(b);
    this.buildBelt();
    this.buildAsteroidField();
  }

  buildStars() {
    const n = 6000;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      // Fler stjärnor nära ett band = Vintergatan
      let v = new THREE.Vector3().randomDirection();
      if (i < n * 0.45) { v.y *= 0.18; v.normalize(); }
      v.multiplyScalar(8e8);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = Math.random();
      c.setHSL(t < 0.2 ? 0.08 : t < 0.35 ? 0.6 : 0.12, t < 0.35 ? 0.6 : 0.1, 0.7 + Math.random() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, depthWrite: false });
    this.stars = new THREE.Points(g, m);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -10;
    this.scene.add(this.stars);
  }

  buildBody(b) {
    const group = new THREE.Group();
    group.name = b.id;
    const R = b.radius * KM;
    let mesh;
    if (b.kind === 'star') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 32),
        new THREE.MeshBasicMaterial({ map: planetTexture('sun', 256), toneMapped: false }),
      );
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture('rgba(255,236,180,1)', 'rgba(255,140,30,0)'),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
      }));
      glow.scale.setScalar(R * 7);
      group.add(glow);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(R, 64, 32),
        new THREE.MeshStandardMaterial({ map: planetTexture(b.id, 512), roughness: 0.95, metalness: 0 }),
      );
      if (b.id === 'earth' || b.id === 'venus' || b.id === 'neptune' || b.id === 'uranus') {
        const atm = new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.035, 48, 24),
          new THREE.MeshBasicMaterial({
            color: b.id === 'venus' ? 0xffe0a0 : 0x6fb8ff, transparent: true, opacity: 0.12,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
          }),
        );
        group.add(atm);
      }
      if (b.id === 'earth') {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(R * 1.01, 64, 32),
          new THREE.MeshStandardMaterial({ alphaMap: cloudTexture(512), transparent: true, depthWrite: false, color: 0xffffff }),
        );
        group.add(clouds);
        group.userData.clouds = clouds;
      }
      if (b.rings) {
        const inner = R * 1.25, outer = R * 2.3;
        const rg = new THREE.RingGeometry(inner, outer, 128, 1);
        // Ringens UV: radiell koordinat längs u
        const p = rg.attributes.position, uv = rg.attributes.uv;
        for (let i = 0; i < p.count; i++) {
          const r = Math.hypot(p.getX(i), p.getY(i));
          uv.setXY(i, (r - inner) / (outer - inner), 0.5);
        }
        const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({
          map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1,
        }));
        ring.rotation.x = -Math.PI / 2 + 0.47; // Saturnus lutar ~27°
        group.add(ring);
      }
      if (b.id === 'uranus') mesh.rotation.z = THREE.MathUtils.degToRad(98);
    }
    group.add(mesh);
    group.userData.mesh = mesh;
    this.root.add(group);
    const pos = bodyPosition(b);
    this.positions[b.id] = pos;
    this.bodies.push({ data: b, group, mesh, pos, R });
  }

  buildBelt() {
    // Fjärran vy av asteroidbältet: ljusa prickar i en ring runt solen.
    const n = 9000;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 2 * BELT.half, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.belt = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0x9a8f80, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false,
    }));
    this.belt.frustumCulled = false;
    this.root.add(this.belt);
  }

  buildAsteroidField() {
    // Närliggande asteroider genereras i celler runt skeppet när man är i bältet.
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = 0.7 + fbm(v.x * 2 + 5, v.y * 2, v.z * 2, 3, 3) * 0.6;
      p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
    }
    geo.computeVertexNormals();
    this.rockMax = 700;
    this.rocks = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 1, flatShading: true }), this.rockMax);
    this.rocks.frustumCulled = false;
    this.rocks.count = 0;
    this.scene.add(this.rocks);
    this.rockList = []; // {pos: Vector3 (världskoordinater), r}
    this.rockCell = null;
  }

  inBelt(shipPos) {
    const r = Math.hypot(shipPos.x, shipPos.z);
    return r > BELT.inner - 8 * KM && r < BELT.outer + 8 * KM && Math.abs(shipPos.y) < BELT.half + 8 * KM;
  }

  updateAsteroids(shipPos) {
    if (!this.inBelt(shipPos)) {
      this.rocks.count = 0;
      this.rockList.length = 0;
      this.rockCell = null;
      return;
    }
    const cell = 2 * KM, span = 6;
    const cx = Math.floor(shipPos.x / cell), cy = Math.floor(shipPos.y / cell), cz = Math.floor(shipPos.z / cell);
    const key = `${cx},${cy},${cz}`;
    if (key !== this.rockCell) {
      this.rockCell = key;
      this.rockList.length = 0;
      for (let x = cx - span; x <= cx + span; x++) {
        for (let y = cy - span; y <= cy + span; y++) {
          for (let z = cz - span; z <= cz + span; z++) {
            const h = (Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
            const hv = Math.abs(h);
            if (hv > 0.2) continue;
            const wp = new THREE.Vector3((x + hv * 4.7 % 1) * cell, (y + hv * 3.3 % 1) * cell, (z + hv * 2.1 % 1) * cell);
            const r = Math.hypot(wp.x, wp.z);
            if (r < BELT.inner || r > BELT.outer || Math.abs(wp.y) > BELT.half) continue;
            this.rockList.push({ pos: wp, r: 40 + hv * 900, rot: hv * 40 });
            if (this.rockList.length >= this.rockMax) break;
          }
        }
      }
      this.rocks.count = this.rockList.length;
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    const t = performance.now() * 0.0001;
    this.rockList.forEach((rk, i) => {
      e.set(rk.rot + t, rk.rot * 2 + t * 0.7, 0);
      q.setFromEuler(e);
      s.setScalar(rk.r);
      m.compose(this.tmp.copy(rk.pos).sub(shipPos), q, s);
      this.rocks.setMatrixAt(i, m);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  // Flytta allt relativt skeppet. Returnerar inget – sätter positioner i scenen.
  update(shipPos, dt) {
    for (const b of this.bodies) {
      b.group.position.copy(b.pos).sub(shipPos);
      if (this.freeze === b.data.id) continue; // stilla när vi är i omloppsbana/landade
      b.mesh.rotation.y += dt * (b.data.kind === 'star' ? 0.01 : 0.03);
      if (b.group.userData.clouds) b.group.userData.clouds.rotation.y += dt * 0.012;
    }
    this.belt.position.set(-shipPos.x, -shipPos.y, -shipPos.z);
    // Solljuset kommer från solen mot skeppet.
    this.sunLight.position.copy(this.positions.sun).sub(shipPos).normalize().multiplyScalar(100);
    this.sunLight.target.position.set(0, 0, 0);
    this.updateAsteroids(shipPos);
  }

  // Närmaste himlakropp (från ytan räknat).
  nearest(shipPos) {
    let best = null, bd = Infinity;
    for (const b of this.bodies) {
      const d = b.pos.distanceTo(shipPos) - b.R;
      if (d < bd) { bd = d; best = b; }
    }
    return { body: best, dist: bd };
  }

  // Verkligt avstånd i km mellan skeppet och ett mål – för statuspanelen.
  // Solsystemet är komprimerat; vi översätter scenavståndet från solen till verkliga AU.
  realDistanceKm(shipPos, target) {
    const b = target.data;
    const d = target.pos.distanceTo(shipPos) - target.R;
    if (b.id === 'moon' || (b.id === 'earth' && this.positions.earth.distanceTo(shipPos) < 600 * KM)) {
      return Math.max(0, d) * (MOON_DIST_KM / (220 * KM));
    }
    const real = (p) => {
      const rs = Math.hypot(p.x, p.z);
      const au = sceneToAu(rs / KM);
      const k = rs > 0 ? au / rs : 0;
      return new THREE.Vector3(p.x * k, p.y * k * 0.2, p.z * k);
    };
    const a = real(shipPos), c = real(target.pos);
    return Math.max(0, a.distanceTo(c) * AU_KM - (b.radius * 1000 * 0));
  }

  // Temperatur i °C (strålningsjämvikt ~ 278 K / sqrt(AU)).
  temperatureC(shipPos) {
    const rs = Math.max(1, shipPos.distanceTo(this.positions.sun) / KM);
    const au = Math.max(0.02, sceneToAu(rs));
    return 278 / Math.sqrt(au) - 273;
  }
}

// Linjär interpolation mellan planeternas banor: scenavstånd (km) → verkliga AU.
const ORBIT_TABLE = [[0, 0], ...BODIES.filter((b) => b.kind !== 'star' && !b.parent).map((b) => [b.orbit, b.au]).sort((a, b) => a[0] - b[0])];
export function sceneToAu(s) {
  for (let i = 1; i < ORBIT_TABLE.length; i++) {
    const [s0, a0] = ORBIT_TABLE[i - 1], [s1, a1] = ORBIT_TABLE[i];
    if (s <= s1) return a0 + ((s - s0) / (s1 - s0)) * (a1 - a0);
  }
  const [sl, al] = ORBIT_TABLE[ORBIT_TABLE.length - 1];
  return al * (s / sl);
}
