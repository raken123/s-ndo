// Ritar en bukett som SVG utifrån produktens färger. Samma motiv ritas i iPhone-appen.
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BLOOMS = [[100, 70], [70, 88], [130, 88], [85, 58], [118, 56], [100, 100], [55, 70], [145, 70], [100, 42]];

export function bouquetSVG(p, { size = '100%' } = {}) {
  const r = rng(p.id);
  const leaves = [[-38, 60, 92], [38, 140, 92], [-65, 48, 70], [65, 152, 70], [-15, 78, 50], [15, 122, 50]]
    .map(([rot, x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="30" transform="rotate(${rot} ${x} ${y})" fill="${p.leaf}" opacity="${0.75 + r() * 0.25}"/>`)
    .join('');
  const blooms = BLOOMS.map(([x, y], i) => {
    const c = p.colors[i % p.colors.length];
    const rad = 13 + r() * 5;
    const rot = r() * 72;
    const petals = Array.from({ length: 5 }, (_, k) => {
      const a = ((rot + k * 72) * Math.PI) / 180;
      return `<circle cx="${(x + Math.cos(a) * rad * 0.55).toFixed(1)}" cy="${(y + Math.sin(a) * rad * 0.55).toFixed(1)}" r="${(rad * 0.62).toFixed(1)}" fill="${c}"/>`;
    }).join('');
    return `<g stroke="rgba(0,0,0,.08)" stroke-width="1">${petals}</g><circle cx="${x}" cy="${y}" r="${(rad * 0.3).toFixed(1)}" fill="rgba(0,0,0,.14)"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${p.name}" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 176 L100 116 L140 176 Z" fill="${p.leaf}" opacity=".55"/>
    ${leaves}${blooms}
    <path d="M42 104 L100 192 L158 104 Q100 124 42 104 Z" fill="${p.paper}" stroke="rgba(0,0,0,.10)" stroke-width="1.5"/>
    <path d="M42 104 L100 192 L72 110 Z" fill="rgba(0,0,0,.05)"/>
    <path d="M86 152 Q100 146 114 152 L112 160 Q100 156 88 160 Z" fill="${p.colors[0]}" opacity=".9"/>
  </svg>`;
}
