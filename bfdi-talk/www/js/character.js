// Object-show style bodies drawn in SVG. All shapes live in a 400x520 viewBox; the face sits
// on top of the body at the anchors returned here.

export const BODIES = {
  ball:  { label: 'Ball',  path: 'M200 70 a140 140 0 1 0 0.1 0 Z', eyes: { x: 200, y: 200 }, mouth: { x: 200, y: 262 }, arms: [[62, 215], [338, 215]], legs: [[155, 344], [245, 344]] },
  block: { label: 'Block', path: 'M95 80 h210 a28 28 0 0 1 28 28 v210 a28 28 0 0 1 -28 28 h-210 a28 28 0 0 1 -28 -28 v-210 a28 28 0 0 1 28 -28 Z', eyes: { x: 200, y: 200 }, mouth: { x: 200, y: 262 }, arms: [[67, 215], [333, 215]], legs: [[150, 346], [250, 346]] },
  slice: { label: 'Slice', path: 'M200 50 L345 340 Q200 368 55 340 Z', eyes: { x: 200, y: 232 }, mouth: { x: 200, y: 290 }, arms: [[118, 215], [282, 215]], legs: [[155, 352], [245, 352]] },
  star:  { label: 'Star',  path: starPath(200, 205, 160, 72, 5), eyes: { x: 200, y: 205 }, mouth: { x: 200, y: 258 }, arms: [[75, 175], [325, 175]], legs: [[130, 330], [270, 330]] },
  drop:  { label: 'Drop',  path: 'M200 40 C250 120 335 185 335 255 a135 115 0 0 1 -270 0 C65 185 150 120 200 40 Z', eyes: { x: 200, y: 222 }, mouth: { x: 200, y: 282 }, arms: [[72, 240], [328, 240]], legs: [[160, 366], [240, 366]] },
  card:  { label: 'Card',  path: 'M120 40 h160 a16 16 0 0 1 16 16 v300 a16 16 0 0 1 -16 16 h-160 a16 16 0 0 1 -16 -16 v-300 a16 16 0 0 1 16 -16 Z', eyes: { x: 200, y: 165 }, mouth: { x: 200, y: 228 }, arms: [[104, 200], [296, 200]], legs: [[160, 372], [240, 372]] },
  heart: { label: 'Heart', path: 'M200 345 C80 270 50 200 60 145 C72 85 150 65 200 125 C250 65 328 85 340 145 C350 200 320 270 200 345 Z', eyes: { x: 200, y: 185 }, mouth: { x: 200, y: 246 }, arms: [[64, 190], [336, 190]], legs: [[165, 322], [235, 322]] },
};

export const COLORS = ['#ff4b4b', '#ff9f1c', '#ffd93d', '#6bdc5c', '#3ec7ff', '#4b6bff', '#a46bff', '#ff7ac8', '#f2f2f2', '#8a5a3c'];

function starPath(cx, cy, R, r, n) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)} `;
  }
  return d + 'Z';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds the character SVG into `svg` and returns the face anchors + limb groups.
 * `idPrefix` keeps gradient/clip ids unique when several characters share a page (Playshow).
 */
export function drawCharacter(svg, bodyKey, color, idPrefix = 'main') {
  const b = BODIES[bodyKey] || BODIES.ball;
  const NS = 'http://www.w3.org/2000/svg';
  svg.innerHTML = '';
  svg.setAttribute('viewBox', '0 0 400 520');

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <linearGradient id="${idPrefix}Grad" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="${shade(color, 0.12)}"/>
      <stop offset="0.65" stop-color="${color}"/>
      <stop offset="1" stop-color="${shade(color, -0.18)}"/>
    </linearGradient>
    <clipPath id="${idPrefix}Clip"><path d="${b.path}"/></clipPath>`;
  svg.appendChild(defs);

  const shadow = document.createElementNS(NS, 'ellipse');
  Object.entries({ cx: 200, cy: 492, rx: 120, ry: 16, class: 'ground-shadow' }).forEach(([k, v]) => shadow.setAttribute(k, v));
  svg.appendChild(shadow);

  const rig = document.createElementNS(NS, 'g');
  rig.setAttribute('class', 'rig');
  svg.appendChild(rig);

  // Legs (behind the body)
  const legs = document.createElementNS(NS, 'g');
  legs.setAttribute('class', 'legs');
  b.legs.forEach(([x, y], i) => {
    const dir = i ? 1 : -1;
    legs.insertAdjacentHTML('beforeend',
      `<path class="limb" d="M${x} ${y - 10} L${x + dir * 6} 470 L${x + dir * 26} 474"/>`);
  });
  rig.appendChild(legs);

  // Arms (behind the body) — each one is its own group so it can wave.
  const arms = b.arms.map(([x, y], i) => {
    const dir = i ? 1 : -1;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', `arm arm-${i ? 'right' : 'left'}`);
    g.style.transformOrigin = `${x}px ${y}px`;
    g.innerHTML = `<path class="limb" d="M${x - dir * 14} ${y} Q${x + dir * 40} ${y + 30} ${x + dir * 52} ${y + 92}"/>`;
    rig.appendChild(g);
    return g;
  });

  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', b.path);
  body.setAttribute('class', 'body');
  body.setAttribute('fill', `url(#${idPrefix}Grad)`);
  rig.appendChild(body);

  // Cartoon shine
  const shine = document.createElementNS(NS, 'g');
  shine.setAttribute('clip-path', `url(#${idPrefix}Clip)`);
  shine.innerHTML = `<ellipse cx="140" cy="120" rx="46" ry="20" transform="rotate(-28 140 120)" fill="#fff" opacity=".35"/>`;
  rig.appendChild(shine);

  const outline = document.createElementNS(NS, 'path');
  outline.setAttribute('d', b.path);
  outline.setAttribute('class', 'outline');
  rig.appendChild(outline);

  const eyes = document.createElementNS(NS, 'image');
  const mouth = document.createElementNS(NS, 'image');
  rig.appendChild(eyes);
  rig.appendChild(mouth);

  return { eyesEl: eyes, mouthEl: mouth, eyeAnchor: b.eyes, mouthAnchor: b.mouth, arms, rig };
}
