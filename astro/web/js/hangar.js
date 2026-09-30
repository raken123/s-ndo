// Uppskjutningsplatsen: du går uppför rampen, in i rymdskeppet, sätter dig och lyfter.
import * as THREE from '../vendor/three.module.min.js';
import { GROUND_OFFSET, EYE_HEIGHT } from './ship.js';

function groundTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1024;
  const c = cv.getContext('2d');
  c.fillStyle = '#5d6570';
  c.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) {
    const v = 80 + Math.random() * 40;
    c.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
    c.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
  }
  c.strokeStyle = '#ffcc33';
  c.lineWidth = 10;
  c.beginPath(); c.arc(512, 512, 300, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 6;
  c.beginPath(); c.arc(512, 512, 330, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#ffffff';
  c.font = 'bold 90px sans-serif';
  c.textAlign = 'center';
  c.fillText('ASTRO', 512, 880);
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 4;
  for (let i = 0; i < 1024; i += 128) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 1024); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(1024, i); c.stroke(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function signTexture(text, sub) {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b1a33'; c.fillRect(0, 0, 1024, 256);
  c.strokeStyle = '#ff7a1a'; c.lineWidth = 12; c.strokeRect(6, 6, 1012, 244);
  c.fillStyle = '#ffffff'; c.font = 'bold 110px sans-serif'; c.textAlign = 'center';
  c.fillText(text, 512, 130);
  c.fillStyle = '#9fd8ff'; c.font = '48px sans-serif';
  c.fillText(sub, 512, 208);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Hangar {
  constructor() {
    this.scene = new THREE.Scene();
    const s = this.scene;

    // Himmel: gradientsfär som mörknar vid uppskjutningen.
    const skyGeo = new THREE.SphereGeometry(4000, 32, 16);
    const cols = [];
    const p = skyGeo.attributes.position;
    const top = new THREE.Color(0x2f6fd0), hor = new THREE.Color(0xbfdcff), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = Math.max(0, p.getY(i) / 4000);
      tmp.copy(hor).lerp(top, Math.pow(h, 0.5));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, transparent: true });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    s.add(this.sky);
    s.background = new THREE.Color(0x000000);

    // Stjärnor som tänds när himlen blir svart
    const sp = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(3500);
      v.y = Math.abs(v.y);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0 });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.visible = false;
    s.add(this.stars);

    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a6258, 1.4);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
    this.sun.position.set(-40, 80, 30);
    s.add(this.sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(600, 64),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
    );
    ground.material.map.wrapS = ground.material.map.wrapT = THREE.RepeatWrapping;
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);
    // Plattan runt skeppet
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 0.3, 48), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.8 }));
    pad.position.y = 0.15;
    s.add(pad);

    // Torn
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8401e, roughness: 0.6, metalness: 0.4 });
    const tower = new THREE.Group();
    for (let y = 0; y < 34; y += 3) {
      for (const [x, z] of [[0, 0], [3, 0], [0, 3], [3, 3]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), steel);
        post.position.set(x, y + 1.5, z);
        tower.add(post);
      }
      const ring = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.2, 3.3), steel);
      ring.position.set(1.5, y + 3, 1.5);
      tower.add(ring);
    }
    tower.position.set(9, 0, -6);
    s.add(tower);

    // Ramp till dörren
    const rampLen = 5.0;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, rampLen), new THREE.MeshStandardMaterial({ color: 0x777f8a, metalness: 0.6, roughness: 0.4 }));
    const doorY = GROUND_OFFSET - 2.2; // dörrens tröskel (golvhöjd i skeppet)
    ramp.position.set(-4.3, doorY / 2 + 0.2, 1.4);
    ramp.rotation.y = Math.PI / 2;
    ramp.rotation.x = -Math.atan2(doorY, rampLen);
    ramp.rotation.order = 'YXZ';
    s.add(ramp);
    this.ramp = ramp;

    // Skylt
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: signTexture('ASTRO', 'Rymdhamn · Space port') }));
    sign.position.set(-14, 6, -14);
    sign.rotation.y = 0.6;
    s.add(sign);
    for (const x of [-5.5, 5.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), steel);
      pole.position.set(x, 3, -0.1);
      sign.add(pole);
      pole.position.z = -0.2;
      pole.position.y = -3.5;
    }

    // Kamerans väg in i skeppet (världskoordinater, ögonhöjd)
    const eyeFinal = GROUND_OFFSET - 1.1 + EYE_HEIGHT;
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-17, 1.65, 13),
      new THREE.Vector3(-11, 1.65, 6),
      new THREE.Vector3(-7.2, 1.65, 1.5),
      new THREE.Vector3(-2.4, doorY + 1.65, 1.4),
      new THREE.Vector3(-0.9, doorY + 1.65, 1.1),
      new THREE.Vector3(0, eyeFinal + 0.2, 0.5),
      new THREE.Vector3(0, eyeFinal, 0),
    ]);
    this.eyeFinal = eyeFinal;

    this.walker = new THREE.Group();
    s.add(this.walker);
  }

  // Skeppet och kameran hämtas in i scenen
  enter(shipParts, camera, xr) {
    this.parts = shipParts;
    const ship = shipParts.ship;
    this.scene.add(ship);
    ship.position.set(0, GROUND_OFFSET, 0);
    ship.quaternion.identity();
    shipParts.gear.visible = true;
    shipParts.door.position.z = 1.4 - 1.2; // öppen
    this.skyMat.opacity = 1;
    this.starMat.opacity = 0;
    this.stars.visible = false;
    this.hemi.intensity = 1.4;
    this.sun.intensity = 2.2;
    this.xr = xr;
    this.camera = camera;
    this.walker.add(camera);
    camera.position.set(0, xr ? 0 : 0, 0);
    camera.rotation.set(0, 0, 0);
    this.t = 0;
    this.phase = 'walk';
    this.walkDur = 13;
    this.placeWalker(0);
  }

  placeWalker(u) {
    const p = this.path.getPointAt(Math.min(1, u));
    const ahead = this.path.getPointAt(Math.min(1, u + 0.04));
    // Titta på skeppet i början, längs vägen i mitten, rakt fram (-Z) på slutet
    let yaw;
    const toShip = Math.atan2(-(0 - p.x), -(0 - p.z));
    const along = Math.atan2(-(ahead.x - p.x), -(ahead.z - p.z));
    if (u < 0.35) yaw = toShip;
    else if (u < 0.8) yaw = lerpAngle(toShip, along, (u - 0.35) / 0.2 > 1 ? 1 : (u - 0.35) / 0.2);
    else yaw = lerpAngle(along, 0, Math.min(1, (u - 0.8) / 0.2));
    this.walker.rotation.set(0, yaw, 0);
    if (this.xr) {
      this.walker.position.set(p.x, p.y - 1.6, p.z);
    } else {
      this.walker.position.copy(p);
      this.camera.rotation.x = u < 0.35 ? 0.12 : u < 0.8 ? -0.05 : -0.05 * (1 - (u - 0.8) / 0.2);
    }
  }

  skip() { if (this.phase === 'walk' || this.phase === 'seat') { this.t = this.walkDur; } }

  // Returnerar händelser: 'seated', 'count:N', 'liftoff', 'done'
  update(dt) {
    this.t += dt;
    const ev = [];
    const parts = this.parts;
    if (this.phase === 'walk') {
      const u = Math.min(1, this.t / this.walkDur);
      this.placeWalker(easeInOut(u));
      if (u >= 1) {
        this.phase = 'seat';
        this.t = 0;
        ev.push('seated');
      }
    } else if (this.phase === 'seat') {
      parts.door.position.z = Math.min(1.4, parts.door.position.z + dt * 1.5);
      if (this.t > 1.2) { this.phase = 'countdown'; this.t = 0; this.lastCount = 6; }
    } else if (this.phase === 'countdown') {
      const n = 5 - Math.floor(this.t);
      if (n !== this.lastCount && n >= 1) { this.lastCount = n; ev.push('count:' + n); }
      parts.engineGlow.forEach((g) => g.scale.setScalar(1.5 + this.t * 0.6));
      parts.ship.position.x = (Math.random() - 0.5) * 0.01 * this.t;
      if (this.t >= 5) { this.phase = 'liftoff'; this.t = 0; this.vel = 0; ev.push('liftoff'); }
    } else if (this.phase === 'liftoff') {
      const t = this.t;
      const ship = parts.ship;
      parts.gear.visible = t < 1.5;
      if (t < 3) {
        ship.position.y = GROUND_OFFSET + t * t * 1.5;
      } else {
        // Luta uppåt och accelerera
        const pitch = Math.min(1.1, (t - 3) * 0.35);
        ship.rotation.x = pitch;
        this.vel += dt * (20 + t * 30);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
        ship.position.addScaledVector(fwd, this.vel * dt);
      }
      ship.position.x += (Math.random() - 0.5) * 0.02;
      parts.engineGlow.forEach((g) => g.scale.setScalar(5 + Math.sin(t * 40) * 0.3));
      const dark = Math.min(1, Math.max(0, (t - 3) / 6));
      this.skyMat.opacity = 1 - dark;
      this.starMat.opacity = dark;
      this.stars.visible = dark > 0.01;
      this.hemi.intensity = 1.4 * (1 - dark) + 0.2;
      if (t > 10) { this.phase = 'done'; ev.push('done'); }
    }
    return ev;
  }

  exit() {
    this.walker.remove(this.camera);
    this.scene.remove(this.parts.ship);
    this.parts.gear.visible = false;
    this.parts.ship.rotation.set(0, 0, 0);
    this.parts = null;
  }
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
