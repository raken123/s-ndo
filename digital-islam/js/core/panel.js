/**
 * Canvas-textured UI panels.
 *
 * A panel is a plane in the world whose face is a 2D canvas. Widgets are drawn
 * immediate-mode style; every draw call also records a rectangle, so pointing a
 * controller at the panel can be turned back into "which button is that".
 */

import * as THREE from 'three';

export const THEME = {
  bg: 'rgba(11, 26, 22, 0.975)',
  bgSolid: '#0b1a16',
  panel: 'rgba(255,255,255,0.045)',
  panelHi: 'rgba(216,180,106,0.16)',
  ink: '#eef5f1',
  muted: '#9fb5ac',
  gold: '#d8b46a',
  goldDim: 'rgba(216,180,106,0.45)',
  green: '#2e9c7d',
  danger: '#e2705f',
  border: 'rgba(216,180,106,0.30)',
  sans: '600 30px Inter, system-ui, sans-serif',
  sansSmall: '500 24px Inter, system-ui, sans-serif',
  arabic: '400 46px Amiri, "Scheherazade New", "Noto Naskh Arabic", "Traditional Arabic", serif',
};

/** Tajweed-ish accent colours for highlighted recitation rules. */
export const TAJWEED_COLORS = {
  ghunnah: '#ff9f43',
  qalqalah: '#59c1ff',
  madd: '#c792ea',
  idgham: '#7bd88f',
};

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export class Panel {
  /**
   * @param {object} opts
   * @param {number} opts.width   metres
   * @param {number} opts.height  metres
   * @param {number} [opts.ppm]   canvas pixels per metre
   */
  constructor({ width = 1.0, height = 0.7, ppm = 1100, curve = 0, name = 'panel', skin = 'dark' } = {}) {
    this.width = width;
    this.height = height;
    this.skin = skin;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(width * ppm);
    this.canvas.height = Math.round(height * ppm);
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearFilter;

    const geometry = curve > 0
      ? curvedPlane(width, height, curve)
      : new THREE.PlaneGeometry(width, height, 1, 1);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: skin === 'paper',
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = name;
    this.mesh.renderOrder = 10;
    this.mesh.userData.panel = this;

    this.hitRects = [];
    this.hover = null;
    this.scroll = 0;
    this.maxScroll = 0;
    this.render = null; // assigned by the owning feature
  }

  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }

  /** Re-run the owner's render callback and push the result to the GPU. */
  refresh() {
    if (!this.render) return;
    this.begin();
    this.render(this);
    this.end();
  }

  begin() {
    this.hitRects = [];
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.save();
    const paper = this.skin === 'paper';
    roundRect(ctx, 2, 2, this.W - 4, this.H - 4, paper ? 8 : 34);
    if (paper) {
      const grad = ctx.createLinearGradient(0, 0, this.W, this.H);
      grad.addColorStop(0, '#fbf5e4');
      grad.addColorStop(1, '#efe3c8');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = THEME.bg;
    }
    ctx.fill();
    ctx.strokeStyle = paper ? 'rgba(140,110,60,0.35)' : THEME.border;
    ctx.lineWidth = paper ? 2 : 3;
    ctx.stroke();
    ctx.clip();
  }

  end() {
    this.ctx.restore();
    this.texture.needsUpdate = true;
  }

  // ---- widgets -------------------------------------------------------------

  title(text, subtitle = '', y = 54) {
    const { ctx } = this;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = THEME.gold;
    ctx.font = '700 40px Inter, system-ui, sans-serif';
    ctx.fillText(text, 46, y);
    if (subtitle) {
      ctx.fillStyle = THEME.muted;
      ctx.font = THEME.sansSmall;
      ctx.fillText(subtitle, 46, y + 50);
    }
    ctx.strokeStyle = 'rgba(216,180,106,0.22)';
    ctx.lineWidth = 2;
    const line = y + (subtitle ? 96 : 60);
    ctx.beginPath();
    ctx.moveTo(46, line);
    ctx.lineTo(this.W - 46, line);
    ctx.stroke();
    return line + 24;
  }

  text(str, x, y, {
    font = THEME.sansSmall, color = THEME.ink, maxWidth = this.W - 92,
    lineHeight = 34, align = 'left', rtl = false, maxLines = 99,
  } = {}) {
    const { ctx } = this;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.direction = rtl ? 'rtl' : 'ltr';

    // Right-to-left text hangs off the right edge of the column; centred text
    // needs the middle of the column, not its left edge.
    const effective = align === 'center' ? 'center'
      : align === 'right' ? 'right'
      : rtl ? 'right' : 'left';
    ctx.textAlign = effective;
    const anchorX = effective === 'center' ? x + maxWidth / 2
      : effective === 'right' ? x + maxWidth
      : x;

    const lines = wrap(ctx, str, maxWidth).slice(0, maxLines);
    lines.forEach((line, i) => ctx.fillText(line, anchorX, y + i * lineHeight));
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    return y + lines.length * lineHeight;
  }

  arabic(str, x, y, { size = 46, color = THEME.ink, maxWidth = this.W - 92, lineHeight = null, align = 'right' } = {}) {
    return this.text(str, x, y, {
      font: THEME.arabic.replace('46px', `${Math.round(size)}px`),
      color,
      maxWidth,
      lineHeight: lineHeight || size * 1.75,
      align,
      rtl: true,
    });
  }

  button(id, label, x, y, w, h, opts = {}) {
    const { ctx } = this;
    const hovered = this.hover === id;
    const active = opts.active;
    ctx.save();
    roundRect(ctx, x, y, w, h, opts.radius ?? 16);
    ctx.fillStyle = opts.danger
      ? (hovered ? 'rgba(226,112,95,0.35)' : 'rgba(226,112,95,0.18)')
      : active ? THEME.panelHi
      : hovered ? 'rgba(216,180,106,0.22)'
      : THEME.panel;
    ctx.fill();
    ctx.lineWidth = active || hovered ? 3 : 2;
    ctx.strokeStyle = active ? THEME.gold : hovered ? THEME.goldDim : 'rgba(255,255,255,0.10)';
    ctx.stroke();

    ctx.fillStyle = opts.color || (active ? THEME.gold : THEME.ink);
    ctx.font = opts.font || THEME.sans;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 2);
    if (opts.badge) {
      ctx.fillStyle = THEME.gold;
      ctx.font = '600 20px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(opts.badge, x + w - 16, y + 20);
    }
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.hitRects.push({ id, x, y, w, h, onSelect: opts.onSelect, kind: 'button', data: opts.data });
    return y + h;
  }

  toggle(id, label, value, x, y, w, onSelect) {
    const { ctx } = this;
    const h = 62;
    const hovered = this.hover === id;
    ctx.fillStyle = hovered ? THEME.ink : THEME.muted;
    ctx.font = THEME.sansSmall;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + h / 2);

    const tw = 78, th = 38;
    const tx = x + w - tw, ty = y + (h - th) / 2;
    ctx.save();
    roundRect(ctx, tx, ty, tw, th, th / 2);
    ctx.fillStyle = value ? 'rgba(46,156,125,0.85)' : 'rgba(255,255,255,0.13)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(value ? tx + tw - th / 2 : tx + th / 2, ty + th / 2, th / 2 - 5, 0, Math.PI * 2);
    ctx.fillStyle = value ? '#eafff6' : '#9fb5ac';
    ctx.fill();
    ctx.restore();
    ctx.textBaseline = 'top';
    this.hitRects.push({ id, x, y, w, h, onSelect, kind: 'toggle' });
    return y + h;
  }

  slider(id, label, value, min, max, x, y, w, onChange, format = (v) => v.toFixed(2)) {
    const { ctx } = this;
    const h = 70;
    ctx.font = THEME.sansSmall;
    ctx.fillStyle = THEME.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.gold;
    ctx.fillText(format(value), x + w, y);
    ctx.textAlign = 'left';

    const trackY = y + 44;
    const t = (value - min) / (max - min);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, trackY); ctx.lineTo(x + w, trackY); ctx.stroke();
    ctx.strokeStyle = THEME.gold;
    ctx.beginPath(); ctx.moveTo(x, trackY); ctx.lineTo(x + w * t, trackY); ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * t, trackY, this.hover === id ? 17 : 13, 0, Math.PI * 2);
    ctx.fillStyle = THEME.gold;
    ctx.fill();

    this.hitRects.push({
      id, x, y: y + 20, w, h: 48, kind: 'slider',
      onSelect: (uvX) => onChange(min + (max - min) * THREE.MathUtils.clamp((uvX - x) / w, 0, 1)),
    });
    return y + h;
  }

  progress(value, x, y, w, h = 12, color = THEME.gold) {
    const { ctx } = this;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    if (value > 0) {
      roundRect(ctx, x, y, Math.max(h, w * THREE.MathUtils.clamp(value, 0, 1)), h, h / 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    return y + h;
  }

  divider(y, inset = 46) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inset, y);
    ctx.lineTo(this.W - inset, y);
    ctx.stroke();
    return y + 1;
  }

  /** Scroll indicator drawn down the right edge when content overflows. */
  scrollbar(contentHeight, viewHeight, top = 120) {
    if (contentHeight <= viewHeight) { this.maxScroll = 0; return; }
    this.maxScroll = contentHeight - viewHeight;
    const { ctx } = this;
    const trackH = viewHeight - 20;
    const knobH = Math.max(60, trackH * (viewHeight / contentHeight));
    const t = this.scroll / this.maxScroll;
    const x = this.W - 26;
    roundRect(ctx, x, top, 8, trackH, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, x, top + (trackH - knobH) * t, 8, knobH, 4);
    ctx.fillStyle = THEME.goldDim;
    ctx.fill();
  }

  scrollBy(delta) {
    if (!this.maxScroll) return false;
    const next = THREE.MathUtils.clamp(this.scroll + delta, 0, this.maxScroll);
    if (next === this.scroll) return false;
    this.scroll = next;
    this.refresh();
    return true;
  }

  // ---- pointer -------------------------------------------------------------

  /** @param {THREE.Vector2} uv from a raycast against this panel's mesh */
  uvToCanvas(uv) { return { x: uv.x * this.W, y: (1 - uv.y) * this.H }; }

  pick(uv) {
    const { x, y } = this.uvToCanvas(uv);
    for (let i = this.hitRects.length - 1; i >= 0; i--) {
      const r = this.hitRects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { rect: r, x, y };
    }
    return null;
  }

  onPointerMove(uv) {
    const hit = uv ? this.pick(uv) : null;
    const id = hit?.rect.id ?? null;
    if (id !== this.hover) {
      this.hover = id;
      this.refresh();
    }
    return hit;
  }

  onSelect(uv) {
    const hit = this.pick(uv);
    if (!hit?.rect.onSelect) return false;
    hit.rect.onSelect(hit.x, hit.y, hit.rect.data);
    this.refresh();
    return true;
  }

  onDrag(uv) {
    const hit = this.pick(uv);
    if (hit?.rect.kind === 'slider') {
      hit.rect.onSelect(hit.x, hit.y);
      this.refresh();
      return true;
    }
    return false;
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

/** Word wrapping that also handles long unbroken strings. */
export function wrap(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    if (!paragraph) { out.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * A plane bent into a shallow arc, which reads better up close in VR. Built by
 * bending a PlaneGeometry so the UVs, winding and normals all stay as they are
 * on a flat panel — the centre of the arc sits on the object's origin.
 */
function curvedPlane(width, height, curve) {
  const segments = 32;
  const radius = width / curve;
  const geometry = new THREE.PlaneGeometry(width, height, segments, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const angle = position.getX(i) / radius;
    position.setX(i, Math.sin(angle) * radius);
    position.setZ(i, -(radius - Math.cos(angle) * radius));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
