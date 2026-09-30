// Dialoger och meddelanden. Visas som HTML i platt läge och som en "hologram"-panel i VR.
import * as THREE from '../vendor/three.module.min.js';
import { wrap } from './ship.js';

const PW = 1024, PH = 768;

export class UI {
  constructor(sound) {
    this.sound = sound;
    this.root = document.getElementById('dialog');
    this.toastEl = document.getElementById('toast');
    this.current = null;
    this.focus = 0;
    this.xr = false;
    this.toastTimer = 0;
    this.toastText = '';

    // VR-panel
    const cv = document.createElement('canvas');
    cv.width = PW; cv.height = PH;
    this.panelCtx = cv.getContext('2d');
    this.panelTex = new THREE.CanvasTexture(cv);
    this.panelTex.colorSpace = THREE.SRGBColorSpace;
    this.panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.05),
      new THREE.MeshBasicMaterial({ map: this.panelTex, transparent: true, toneMapped: false, depthTest: false }),
    );
    this.panel.renderOrder = 100;
    this.panel.position.set(0, 1.55, -1.75);
    this.panel.visible = false;
    this.hits = [];

    const tc = document.createElement('canvas');
    tc.width = 1024; tc.height = 128;
    this.toastCtx = tc.getContext('2d');
    this.toastTex = new THREE.CanvasTexture(tc);
    this.toastTex.colorSpace = THREE.SRGBColorSpace;
    this.toastMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.15),
      new THREE.MeshBasicMaterial({ map: this.toastTex, transparent: true, toneMapped: false, depthTest: false }),
    );
    this.toastMesh.renderOrder = 101;
    this.toastMesh.position.set(0, 2.05, -1.6);
    this.toastMesh.visible = false;
  }

  attachTo(rig) { rig.add(this.panel); rig.add(this.toastMesh); }

  get open() { return !!this.current; }

  setXR(on) {
    this.xr = on;
    if (this.current) this.render();
    if (!on) this.panel.visible = false;
  }

  dialog(spec) {
    this.current = spec;
    this.focus = Math.max(0, spec.buttons.findIndex((b) => b.primary && !b.disabled));
    if (spec.buttons[this.focus]?.disabled) this.focus = spec.buttons.findIndex((b) => !b.disabled);
    this.render();
    return { close: () => { if (this.current === spec) this.close(); } };
  }

  close() {
    this.current = null;
    this.root.innerHTML = '';
    this.root.hidden = true;
    this.panel.visible = false;
  }

  press(i) {
    const spec = this.current;
    const b = spec?.buttons[i];
    if (!b || b.disabled) return;
    this.sound.click();
    if (!b.keepOpen) this.close();
    b.onClick?.();
  }

  // Tangentbord / handkontroll i dialoger
  nav(action) {
    const spec = this.current;
    if (!spec) return false;
    const n = spec.buttons.length;
    const cols = spec.columns || 1;
    const move = (d) => {
      let i = this.focus;
      for (let k = 0; k < n; k++) {
        i = (i + d + n) % n;
        if (!spec.buttons[i].disabled) break;
      }
      this.focus = i;
      this.render();
    };
    if (action === 'navDown') move(cols);
    else if (action === 'navUp') move(-cols);
    else if (action === 'navRight' || action === 'navNext') move(1);
    else if (action === 'navLeft') move(-1);
    else if (action === 'confirm') this.press(this.focus);
    else if (action === 'back') {
      const bi = spec.buttons.findIndex((b) => b.back);
      if (bi >= 0) this.press(bi);
    } else return false;
    return true;
  }

  render() {
    const spec = this.current;
    if (!spec) return;
    this.renderDOM(spec);
    if (this.xr) this.renderPanel(spec);
  }

  renderDOM(spec) {
    const el = this.root;
    el.hidden = false;
    el.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'dlg' + (spec.wide ? ' wide' : '');
    if (spec.kicker) box.insertAdjacentHTML('beforeend', `<div class="kicker">${esc(spec.kicker)}</div>`);
    box.insertAdjacentHTML('beforeend', `<h2>${esc(spec.title)}</h2>`);
    if (spec.subtitle) box.insertAdjacentHTML('beforeend', `<div class="sub">${esc(spec.subtitle)}</div>`);
    if (spec.body?.length) {
      const ul = document.createElement(spec.bullets ? 'ul' : 'div');
      ul.className = 'body';
      for (const line of spec.body) {
        const li = document.createElement(spec.bullets ? 'li' : 'p');
        li.textContent = line;
        ul.appendChild(li);
      }
      box.appendChild(ul);
    }
    if (spec.note) box.insertAdjacentHTML('beforeend', `<div class="note">${esc(spec.note)}</div>`);
    const bw = document.createElement('div');
    bw.className = 'btns' + (spec.columns > 1 ? ' grid' : '');
    if (spec.columns > 1) bw.style.gridTemplateColumns = `repeat(${spec.columns}, 1fr)`;
    spec.buttons.forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = (b.primary ? 'primary ' : '') + (b.cls || '') + (i === this.focus ? ' focus' : '');
      btn.disabled = !!b.disabled;
      btn.innerHTML = `<span>${esc(b.label)}</span>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}`;
      btn.addEventListener('click', () => this.press(i));
      bw.appendChild(btn);
    });
    box.appendChild(bw);
    el.appendChild(box);
  }

  renderPanel(spec) {
    const c = this.panelCtx;
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = 'rgba(4,14,32,0.92)';
    roundRect(c, 4, 4, PW - 8, PH - 8, 28); c.fill();
    c.strokeStyle = 'rgba(90,200,255,0.8)'; c.lineWidth = 4; c.stroke();
    let y = 70;
    if (spec.kicker) { c.fillStyle = '#7fe0ff'; c.font = 'bold 26px sans-serif'; c.fillText(spec.kicker.toUpperCase(), 40, 50); y = 100; }
    c.fillStyle = '#ffffff'; c.font = 'bold 48px sans-serif';
    c.fillText(spec.title, 40, y); y += 44;
    if (spec.subtitle) { c.fillStyle = '#9fd8ff'; c.font = '28px sans-serif'; c.fillText(spec.subtitle, 40, y); y += 40; }
    c.font = '27px sans-serif'; c.fillStyle = '#e6f2ff';
    for (const line of spec.body || []) {
      const n = wrap(c, (spec.bullets ? '• ' : '') + line, 40, y + 10, PW - 80, 34, 4);
      y += n * 34 + 10;
    }
    if (spec.note) { c.fillStyle = '#ffd966'; c.font = 'bold 28px sans-serif'; y += wrap(c, spec.note, 40, y + 16, PW - 80, 34, 2) * 34 + 10; }
    // Knappar
    const cols = spec.columns || Math.min(3, spec.buttons.length);
    const rows = Math.ceil(spec.buttons.length / cols);
    const bh = rows > 3 ? 62 : 80, gap = 14;
    const bwid = (PW - 80 - gap * (cols - 1)) / cols;
    const top = PH - 30 - rows * bh - (rows - 1) * gap;
    this.hits = [];
    spec.buttons.forEach((b, i) => {
      const cx = 40 + (i % cols) * (bwid + gap);
      const cy = top + Math.floor(i / cols) * (bh + gap);
      c.fillStyle = b.disabled ? 'rgba(80,90,110,0.5)' : i === this.focus ? '#2fa8ff' : b.primary ? '#1d6fd6' : 'rgba(40,70,120,0.9)';
      roundRect(c, cx, cy, bwid, bh, 14); c.fill();
      c.fillStyle = b.disabled ? '#99a' : '#fff';
      c.font = `bold ${rows > 3 ? 24 : 30}px sans-serif`;
      c.fillText(b.label, cx + 18, cy + (b.sub ? bh * 0.45 : bh * 0.62), bwid - 30);
      if (b.sub) { c.font = '20px sans-serif'; c.fillStyle = '#cde'; c.fillText(b.sub, cx + 18, cy + bh * 0.8, bwid - 30); }
      this.hits.push({ x: cx / PW, y: cy / PH, w: bwid / PW, h: bh / PH, i });
    });
    this.panelTex.needsUpdate = true;
    this.panel.visible = true;
  }

  // uv från en VR-stråle mot panelen → knappindex
  hitTest(uv, hover = false) {
    if (!this.current) return -1;
    const x = uv.x, y = 1 - uv.y;
    const h = this.hits.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
    if (!h) return -1;
    if (hover && this.focus !== h.i && !this.current.buttons[h.i].disabled) { this.focus = h.i; this.render(); }
    return h.i;
  }

  toast(text, ms = 3500, kind = '') {
    this.toastText = text;
    this.toastEl.textContent = text;
    this.toastEl.className = 'show ' + kind;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.className = '';
      this.toastText = '';
      this.toastMesh.visible = false;
    }, ms);
    if (this.xr) {
      const c = this.toastCtx;
      c.clearRect(0, 0, 1024, 128);
      c.fillStyle = kind === 'warn' ? 'rgba(90,20,10,0.85)' : 'rgba(4,20,40,0.85)';
      roundRect(c, 2, 2, 1020, 124, 30); c.fill();
      c.fillStyle = kind === 'warn' ? '#ffb199' : '#bfefff';
      c.font = 'bold 40px sans-serif';
      c.textAlign = 'center';
      c.fillText(text, 512, 78, 980);
      c.textAlign = 'left';
      this.toastTex.needsUpdate = true;
      this.toastMesh.visible = true;
    }
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
