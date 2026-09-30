// Rymdskeppet: yttre skrov, cockpit med instrumentpanel och en "rigg" där kameran/VR-headsetet sitter.
// Enheter: meter. Framåt = -Z. Riggens origo = cockpitgolvet (passar WebXR 'local-floor').
import * as THREE from '../vendor/three.module.min.js';
import { glowTexture } from './textures.js';

export const EYE_HEIGHT = 1.25; // ögonhöjd för sittande pilot i platt läge
export const GROUND_OFFSET = 4.05; // skeppets origo ovanför marken när det står på landningsstället

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.4, ...opts });
}

export function createShip() {
  const ship = new THREE.Group();
  ship.name = 'ship';

  const hullMat = mat(0xe8ecf2, { metalness: 0.55, roughness: 0.35 });
  const darkMat = mat(0x2a3140, { metalness: 0.3, roughness: 0.7 });
  const accentMat = mat(0xff7a1a, { metalness: 0.2, roughness: 0.5 });
  const glassEdge = mat(0x8fa4c0, { metalness: 0.8, roughness: 0.2 });

  // ---- Yttre skrov (syns i jaktvy och i hangaren) ----
  const exterior = new THREE.Group();
  exterior.name = 'exterior';
  exterior.position.y = -0.3; // skrovet ligger under fönsterlinjen
  ship.add(exterior);

  // Kropp: svarvad profil längs Z.
  const prof = [
    [0.0, 0], [0.55, 0.4], [1.0, 1.4], [1.35, 3], [1.5, 5], [1.5, 8.5], [1.35, 10], [1.0, 10.8], [0.0, 11],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(prof, 32);
  bodyGeo.rotateX(Math.PI / 2); // lägg längs +Z
  const body = new THREE.Mesh(bodyGeo, hullMat);
  // Placera så att nosen är framför cockpiten och kroppen under/bakom fönstren.
  body.position.set(0, -1.3, -4.2);
  body.scale.set(1.25, 0.8, 1);
  exterior.add(body);

  // Näsa under fönsterlinjen
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 24), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, -1.15, -5.6);
  nose.scale.set(1.3, 1, 0.55);
  exterior.add(nose);

  // Vingar
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(5.2, 2.6); wingShape.lineTo(5.6, 4.2); wingShape.lineTo(0, 5.6);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.18, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, hullMat);
    w.scale.x = s;
    w.position.set(s * 1.3, -1.0, 1.0);
    exterior.add(w);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 3.0), accentMat);
    stripe.position.set(s * 5.6, -0.97, 3.6);
    exterior.add(stripe);
  }
  // Fena
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(2.8, 0); finShape.lineTo(3.0, 2.2); finShape.lineTo(2.2, 2.3);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false });
  finGeo.translate(0, 0, -0.08);
  finGeo.rotateY(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, hullMat);
  fin.position.set(0, -0.3, 4.0);
  exterior.add(fin);
  const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.9), accentMat);
  finTip.position.set(0, 1.9, 6.6);
  exterior.add(finTip);

  // Motorer med glöd
  const engineGlow = [];
  const glowTex = glowTexture('rgba(150,210,255,1)', 'rgba(40,90,255,0)');
  for (const x of [-0.9, 0.9]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.4, 20), darkMat);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -1.2, 6.9);
    exterior.add(eng);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sp.position.set(x, -1.2, 7.8);
    sp.scale.setScalar(1.5);
    exterior.add(sp);
    engineGlow.push(sp);
  }
  // Dörr på vänster sida (öppnas i hangaren)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 1.1), accentMat);
  door.position.set(-1.86, -0.95, 1.4);
  exterior.add(door);

  // Landningsställ (visas bara i hangaren)
  const gear = new THREE.Group();
  for (const [x, z] of [[-1.2, -3], [1.2, -3], [-2.5, 3.5], [2.5, 3.5]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), darkMat);
    leg.position.set(x, -2.9, z);
    gear.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), darkMat);
    foot.position.set(x, -3.7, z);
    gear.add(foot);
  }
  exterior.add(gear);

  // Glaskupol över cockpiten
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x9fd8ff, transparent: true, opacity: 0.1, metalness: 0.9, roughness: 0.05,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  canopy.scale.set(1.5, 1.45, 2.0);
  canopy.position.set(0, 0.15, 0.1);
  canopy.renderOrder = 2;
  exterior.add(canopy);

  // ---- Cockpit ----
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  ship.add(cockpit);

  // Riggen: origo på cockpitgolvet. Kameran och VR-kontrollerna läggs här.
  const rig = new THREE.Group();
  rig.name = 'rig';
  rig.position.set(0, -1.1, 0);
  ship.add(rig);

  const cock = new THREE.Group();
  rig.add(cock); // cockpitdelar i riggens koordinater (golv y=0)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 3.6), darkMat);
  floor.position.set(0, -0.05, 0.3);
  cock.add(floor);

  // Instrumentbräda
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.75), darkMat);
  dash.position.set(0, 0.6, -1.25);
  dash.rotation.x = -0.3;
  cock.add(dash);
  const dashLip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.1), accentMat);
  dashLip.position.set(0, 0.76, -0.9);
  cock.add(dashLip);

  // Skärmar (CanvasTexture) – vänster: status, mitten: navigation, höger: uppdrag/tid.
  const screens = {};
  const screenDefs = [
    ['left', -0.68, 0.22], ['center', 0, 0], ['right', 0.68, -0.22],
  ];
  for (const [key, x, rotY] of screenDefs) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 320;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.375),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    m.position.set(x, 0.86, -1.3);
    m.rotation.set(-0.7, rotY, 0);
    cock.add(m);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.41, 0.02), glassEdge);
    frame.position.copy(m.position);
    frame.rotation.copy(m.rotation);
    frame.translateZ(-0.012);
    cock.add(frame);
    screens[key] = { canvas: cv, ctx: cv.getContext('2d'), tex, mesh: m };
  }

  // Fönsterramar (A-stolpar, takbåge)
  const strut = (a, b, r = 0.045) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, 8);
    const m = new THREE.Mesh(g, glassEdge);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    cock.add(m);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  strut(V(-1.1, 0.75, -1.5), V(-0.55, 2.35, -0.3));
  strut(V(1.1, 0.75, -1.5), V(0.55, 2.35, -0.3));
  strut(V(-0.55, 2.35, -0.3), V(0.55, 2.35, -0.3));
  strut(V(-0.55, 2.35, -0.3), V(-0.6, 2.4, 1.6));
  strut(V(0.55, 2.35, -0.3), V(0.6, 2.4, 1.6));
  strut(V(-1.1, 0.75, -1.5), V(-1.35, 0.9, 1.6));
  strut(V(1.1, 0.75, -1.5), V(1.35, 0.9, 1.6));
  strut(V(0, 2.37, -0.3), V(0, 2.4, 1.6), 0.03);

  // Sidokonsoler och bakvägg
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 2.2), darkMat);
    c.position.set(s * 1.15, 0.4, 0.2);
    cock.add(c);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06),
        new THREE.MeshBasicMaterial({ color: [0x33ff99, 0xffaa22, 0x33aaff, 0xff4466][i] }));
      b.position.set(s * 1.1, 0.81, -0.4 + i * 0.18);
      cock.add(b);
    }
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.1), darkMat);
  back.position.set(0, 1.2, 2.1);
  cock.add(back);
  // Stol
  const seat = new THREE.Group();
  const seatMat = mat(0x333a4a, { metalness: 0.1, roughness: 0.9 });
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), seatMat);
  cushion.position.set(0, 0.5, 0.5);
  seat.add(cushion);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.1), seatMat);
  backrest.position.set(0, 0.95, 0.85);
  backrest.rotation.x = -0.15;
  seat.add(backrest);
  cock.add(seat);

  // Styrspak – rör sig med styrningen
  const stick = new THREE.Group();
  const stickRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 8), darkMat);
  stickRod.position.y = 0.17;
  stick.add(stickRod);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), accentMat);
  knob.position.y = 0.36;
  stick.add(knob);
  stick.position.set(0.38, 0.42, -0.3);
  cock.add(stick);

  // Kabinljus
  const cabin = new THREE.PointLight(0x9fc4ff, 3, 6, 1.5);
  cabin.position.set(0, 2.0, 0.2);
  cock.add(cabin);

  return { ship, rig, exterior, gear, door, screens, engineGlow, stick, cockpit: cock };
}

// ---- Ritning av instrumentskärmar ----
function bar(ctx, x, y, w, h, v, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = v < 0.2 ? '#ff4d5e' : color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, v)), h);
}

export function drawScreens(screens, s) {
  // s = { labels…, fuel, oxygen, hull, speedText, tempText, targetName, distText, etaText, timeText, stars, visited, autopilot, warp, dirX, dirY, msg }
  const bg = (ctx) => {
    ctx.fillStyle = '#04101f';
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = 'rgba(80,200,255,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 312);
  };
  {
    const { ctx, tex } = screens.left;
    bg(ctx);
    ctx.fillStyle = '#7fe0ff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(s.labels.status, 20, 44);
    ctx.font = '24px sans-serif';
    const rows = [[s.labels.fuel, s.fuel, '#3be38b'], [s.labels.oxygen, s.oxygen, '#4ab8ff'], [s.labels.hull, s.hull, '#f5c542']];
    rows.forEach(([name, v, c], i) => {
      const y = 86 + i * 58;
      ctx.fillStyle = '#cfe8ff';
      ctx.fillText(`${name} ${Math.round(v * 100)}%`, 20, y);
      bar(ctx, 20, y + 10, 470, 18, v, c);
    });
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(`${s.labels.temp}: ${s.tempText}`, 20, 296);
    tex.needsUpdate = true;
  }
  {
    const { ctx, tex } = screens.center;
    bg(ctx);
    ctx.fillStyle = '#7fe0ff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${s.labels.target}: ${s.targetName}`, 20, 44);
    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(`${s.labels.distance}: ${s.distText}`, 20, 84);
    ctx.fillText(`${s.labels.speed}: ${s.speedText}`, 20, 118);
    ctx.fillText(`${s.labels.eta}: ${s.etaText}`, 20, 152);
    // Riktningsindikator
    const cx = 400, cy = 230, r = 70;
    ctx.strokeStyle = 'rgba(127,224,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
    ctx.fillStyle = s.dirBehind ? '#ff9a3c' : '#3be38b';
    ctx.beginPath();
    ctx.arc(cx + s.dirX * r, cy - s.dirY * r, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = s.autopilot ? '#3be38b' : '#667';
    ctx.fillText(`${s.labels.autopilot}: ${s.autopilot ? s.labels.on : s.labels.off}`, 20, 210);
    ctx.fillStyle = s.warpLocked ? '#555' : s.warp ? '#c28bff' : '#667';
    ctx.fillText(`${s.labels.warp}: ${s.warp ? s.labels.on : s.labels.off}`, 20, 246);
    tex.needsUpdate = true;
  }
  {
    const { ctx, tex } = screens.right;
    bg(ctx);
    ctx.fillStyle = '#7fe0ff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(s.labels.timeLeft, 20, 44);
    ctx.font = 'bold 64px monospace';
    ctx.fillStyle = s.timeLow ? '#ff4d5e' : '#ffffff';
    ctx.fillText(s.timeText, 20, 120);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#ffd966';
    ctx.fillText(`★ ${s.labels.stars}: ${s.stars}`, 20, 176);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillText(`${s.labels.visited}: ${s.visited}`, 20, 214);
    if (s.msg) {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 22px sans-serif';
      wrap(ctx, s.msg, 20, 256, 470, 26, 2);
    }
    tex.needsUpdate = true;
  }
}

export function wrap(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const words = String(text).split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + n * lh);
      line = w; n++;
      if (n >= maxLines) return n;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y + n * lh); n++; }
  return n;
}
