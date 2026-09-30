// Flygmodell, status (bränsle/syre/skrov) och autopilot.
// Arkadfysik: skeppet åker dit nosen pekar. Släpper man gasen behåller man farten –
// precis som i rymden, där det inte finns någon luft som bromsar.
import * as THREE from '../vendor/three.module.min.js';
import { KM } from './world.js';

export const SUB_MAX = 8 * KM;       // m/s, vanlig raketmotor
export const WARP_MAX = 420 * KM;    // m/s, warp (science fiction!)
export const ION_MAX = 2 * KM;       // m/s när bränslet är slut
const SUB_ACC = 1.2 * KM;
const WARP_ACC = 90 * KM;
const TURN = 0.9;                    // rad/s
const LIGHT = 299_792;               // km/s

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

export class Flight {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.speed = 0;
    this.reset();
  }

  reset() {
    this.fuel = 1; this.oxygen = 1; this.hull = 1;
    this.speed = 0;
    this.autopilot = false;
    this.warp = false;
    this.warpUnlocked = false;
    this.target = null;
    this.thrustLevel = 0;
    this.distanceTravelled = 0;
    this.turn = { x: 0, y: 0, r: 0 };
    this.hitCooldown = 0;
    this.heatCooldown = 0;
    this.fuelPrev = 1;
    this.fuelWasPositive = true;
    this.approachNotified = false;
  }

  refill() { this.fuel = 1; this.oxygen = 1; this.hull = 1; }

  setTarget(body) { this.target = body; this.approachNotified = false; }

  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.quat); }

  // Placera skeppet nära en himlakropp, riktat mot ett mål.
  placeNear(body, lookAt) {
    const dir = lookAt ? _v.copy(lookAt.pos).sub(body.pos).normalize() : new THREE.Vector3(0, 0, -1);
    const side = new THREE.Vector3().crossVectors(dir, _up).normalize();
    this.pos.copy(body.pos)
      .addScaledVector(dir, body.R * 2.4)
      .addScaledVector(side, body.R * 1.6)
      .addScaledVector(_up, body.R * 0.5);
    const target = lookAt ? lookAt.pos : this.pos.clone().add(dir);
    _m.lookAt(this.pos, target, _up);
    this.quat.setFromRotationMatrix(_m);
    this.speed = 0;
  }

  get maxSpeed() {
    if (this.fuel <= 0) return ION_MAX;
    return this.warp ? WARP_MAX : SUB_MAX;
  }

  speedText(t) {
    const kms = this.speed / KM;
    if (kms > 60) {
      // Warp-hastighet uttryckt i ljushastigheter (spelet komprimerar avstånden ~66 000 ggr).
      const c = (kms * 66_000) / LIGHT;
      return t('lightSpeed', c < 10 ? c.toFixed(1) : Math.round(c));
    }
    return `${kms.toFixed(1)} ${t('kms')}`;
  }

  // Returnerar en lista med händelser: {type:'arrive'|'asteroid'|'collide'|'heat'|'rescue'|'lowFuel'|'lowOxygen'|'outOfFuel'|'beltWarpOff'}
  update(dt, input, opts) {
    const ev = [];
    const world = this.world;
    const inBelt = world.inBelt(this.pos);

    // ---- Styrning ----
    let sx = input.steerX, sy = input.steerY, roll = input.roll;
    let thrust = input.thrust, brake = input.brake;
    const manual = Math.abs(sx) + Math.abs(sy) + Math.abs(roll) + thrust + brake > 0.2;
    if (manual && this.autopilot && (Math.abs(sx) + Math.abs(sy) > 0.5)) {
      this.autopilot = false;
      ev.push({ type: 'autopilotOff' });
    }

    let distToTarget = Infinity;
    if (this.target) distToTarget = this.target.pos.distanceTo(this.pos) - this.target.R;

    if (this.autopilot && this.target) {
      // Sikta mot målet (med lite förskjutning så att vi inte flyger rakt in i planeten)
      const aim = new THREE.Vector3().copy(this.target.pos).sub(this.pos).normalize();
      const avoid = this.avoidance();
      if (avoid) aim.add(avoid).normalize();
      _m.lookAt(this.pos, aim.add(this.pos), _up);
      _q.setFromRotationMatrix(_m);
      const ang = this.quat.angleTo(_q);
      this.quat.rotateTowards(_q, Math.min(ang, TURN * 1.3 * dt));
      sx = 0; sy = 0;
      const facing = ang < 0.35;
      // Warp automatiskt på långa sträckor
      if (this.warpUnlocked && !inBelt && distToTarget > 1500 * KM && facing && this.fuel > 0) this.warp = true;
      if (this.warp && (distToTarget < 600 * KM || inBelt)) this.warp = false;
      const acc = this.warp ? WARP_ACC : SUB_ACC;
      const arrive = this.target.R * 3;
      const safe = Math.sqrt(2 * acc * 0.8 * Math.max(0, distToTarget - arrive)) + 0.4 * KM;
      const want = Math.min(this.maxSpeed, safe, facing ? Infinity : SUB_MAX * 0.3);
      thrust = this.speed < want ? 1 : 0;
      brake = this.speed > want * 1.05 ? 1 : 0;
    } else {
      // Manuell styrning: mjuk respons
      const k = Math.min(1, dt * 4);
      this.turn.x += (sx - this.turn.x) * k;
      this.turn.y += (sy - this.turn.y) * k;
      this.turn.r += (roll - this.turn.r) * k;
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.turn.y * TURN * dt, -this.turn.x * TURN * dt, -this.turn.r * TURN * 1.3 * dt, 'YXZ'));
      this.quat.multiply(rot);
    }
    this.quat.normalize();

    // ---- Warp ----
    if (this.warp && (!this.warpUnlocked || this.fuel <= 0)) this.warp = false;
    if (this.warp && inBelt) { this.warp = false; ev.push({ type: 'beltWarpOff' }); }

    // ---- Fart ----
    const acc = this.warp ? WARP_ACC : SUB_ACC;
    const max = this.maxSpeed;
    if (thrust > 0) this.speed = Math.min(max, this.speed + acc * thrust * dt);
    if (brake > 0) this.speed = Math.max(0, this.speed - acc * 1.6 * brake * dt);
    if (this.speed > max) this.speed = Math.max(max, this.speed - WARP_ACC * 1.5 * dt); // tappa warpfart mjukt
    this.thrustLevel = Math.max(thrust, this.warp ? 0.7 : 0);

    const step = this.speed * dt;
    this.pos.addScaledVector(this.forward(_v), step);
    this.distanceTravelled += step;

    // ---- Förbrukning ----
    if (!opts.frozen) {
      if (thrust > 0 && this.fuel > 0) this.fuel -= dt * thrust * 0.009;
      if (this.warp && this.speed > SUB_MAX) this.fuel -= dt * 0.012;
      if (this.fuel <= 0 && this.fuelWasPositive) ev.push({ type: 'outOfFuel' });
      this.fuel = Math.max(0, this.fuel);
      this.fuelWasPositive = this.fuel > 0;
      const prevO2 = this.oxygen;
      this.oxygen = Math.max(0, this.oxygen - dt * 0.0025);
      if (prevO2 > 0.2 && this.oxygen <= 0.2) ev.push({ type: 'lowOxygen' });
      if (this.fuelPrev > 0.2 && this.fuel <= 0.2) ev.push({ type: 'lowFuel' });
      this.fuelPrev = this.fuel;
    }

    // ---- Faror ----
    this.hitCooldown -= dt;
    this.heatCooldown -= dt;
    // Asteroider
    if (world.rockList.length && this.hitCooldown <= 0) {
      for (const r of world.rockList) {
        if (r.pos.distanceToSquared(this.pos) < (r.r + 12) ** 2) {
          this.hull -= 0.12;
          this.speed *= 0.4;
          this.hitCooldown = 1.2;
          ev.push({ type: 'asteroid' });
          break;
        }
      }
    }
    // Solens hetta
    const sun = world.bodies[0];
    const sunD = sun.pos.distanceTo(this.pos);
    if (sunD < sun.R * 6) {
      this.hull -= dt * 0.06 * (1 - (sunD - sun.R) / (sun.R * 5));
      if (this.heatCooldown <= 0) { ev.push({ type: 'heat' }); this.heatCooldown = 4; }
    }
    // Krock med himlakroppar som inte är målet
    for (const b of world.bodies) {
      if (b === this.target) continue;
      const d = b.pos.distanceTo(this.pos);
      if (d < b.R * 1.05 + 20) {
        if (b.data.kind === 'star') { this.hull = 0; break; }
        // Studsa ut till säker höjd
        _v.copy(this.pos).sub(b.pos).normalize();
        this.pos.copy(b.pos).addScaledVector(_v, b.R * 1.3);
        _m.lookAt(this.pos, this.pos.clone().add(_v), _up);
        this.quat.setFromRotationMatrix(_m);
        this.speed = 0;
        this.hull -= 0.2;
        ev.push({ type: 'collide', body: b });
      }
    }
    this.hull = Math.max(0, this.hull);

    if (this.hull <= 0 || this.oxygen <= 0) ev.push({ type: 'rescue' });

    // ---- Ankomst ----
    if (this.target && distToTarget < this.target.R * 3) ev.push({ type: 'arrive', body: this.target });
    else if (this.target && distToTarget < this.target.R * 12 && !this.approachNotified) {
      this.approachNotified = true;
      ev.push({ type: 'approach', body: this.target });
    }
    return ev;
  }

  // Autopiloten svänger undan för asteroider rakt framför.
  avoidance() {
    const rocks = this.world.rockList;
    if (!rocks.length) return null;
    const fwd = this.forward(new THREE.Vector3());
    const push = new THREE.Vector3();
    let any = false;
    for (const r of rocks) {
      const rel = _v.copy(r.pos).sub(this.pos);
      const along = rel.dot(fwd);
      if (along < 0 || along > 6 * KM) continue;
      const lateral = rel.addScaledVector(fwd, -along);
      const miss = lateral.length();
      if (miss < r.r + 200) {
        push.addScaledVector(lateral.normalize(), -1.5);
        any = true;
      }
    }
    return any ? push : null;
  }

  // Vart pekar målet i förhållande till nosen? (för navigeringsindikatorn)
  targetDirection() {
    if (!this.target) return { x: 0, y: 0, behind: false };
    const rel = _v.copy(this.target.pos).sub(this.pos).applyQuaternion(_q.copy(this.quat).invert()).normalize();
    const behind = rel.z > 0;
    const len = Math.hypot(rel.x, rel.y) || 1;
    const k = behind ? 1 / len : Math.min(1, Math.asin(Math.min(1, len)) / (Math.PI / 2)) / len;
    return { x: rel.x * k, y: rel.y * k, behind };
  }

  etaSeconds() {
    if (!this.target) return Infinity;
    const d = this.target.pos.distanceTo(this.pos) - this.target.R * 3;
    if (this.speed < 10) return Infinity;
    return Math.max(0, d / this.speed);
  }
}
