// Camera. Features follow detected capabilities: flash (torch), camera switching
// (multipleCameras) and Pro controls (advancedCamera).
import { h, ic, wait } from '../core/dom.js';
import { has, refineCapability } from '../core/capabilities.js';
import { platform } from '../core/platform.js';
import { idb } from '../core/idb.js';
import { settings } from '../core/store.js';
import { system } from '../shell/system.js';
import { emptyState } from '../ui/components.js';

export default {
  async mount(container, ctx) {
    ctx.setStatusStyle('light');
    let stream = null; let track = null; let facing = 'environment'; let mode = 'photo'; let grid = settings.get('cameraGrid') || false;
    let flash = false;
    const video = h('video', { class: 'cam__video', autoplay: true, playsinline: true, muted: true });
    const gridEl = h('div', { class: 'cam__grid', hidden: !grid });
    const flashFx = h('div', { class: 'cam__flash' });
    const viewport = h('div', { class: 'cam__view' }, video, gridEl, flashFx);
    const thumb = h('button', { class: 'cam__thumb', 'aria-label': 'Open Gallery', onclick: () => ctx.openApp('gallery') });
    const shutter = h('button', { class: 'cam__shutter', 'aria-label': 'Take photo', onclick: () => capture() }, h('span'));
    const switcher = h('button', { class: 'cam__round', 'aria-label': 'Switch camera', onclick: () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); } }, ic('camera-switch'));
    const flashBtn = h('button', { class: 'cam__top-btn', 'aria-label': 'Flash', 'aria-pressed': 'false', onclick: () => { flash = !flash; renderTop(); } });
    const gridBtn = h('button', { class: 'cam__top-btn', 'aria-label': 'Grid', onclick: () => { grid = !grid; settings.set({ cameraGrid: grid }); gridEl.hidden = !grid; renderTop(); } });
    const top = h('div', { class: 'cam__top' });
    const modes = h('div', { class: 'cam__modes', role: 'tablist' });
    const pro = h('div', { class: 'cam__pro', hidden: true });
    const bottom = h('div', { class: 'cam__bottom' }, thumb, shutter, switcher);
    const root = h('div', { class: 'cam' }, top, viewport, pro, modes, bottom);
    container.appendChild(root);

    function renderTop() {
      const torchOK = has('torch') || (track && track.getCapabilities && track.getCapabilities().torch);
      flashBtn.hidden = !torchOK;
      flashBtn.innerHTML = ic(flash ? 'flash' : 'flash-off').html; flashBtn.setAttribute('aria-pressed', String(flash)); flashBtn.classList.toggle('is-on', flash);
      gridBtn.innerHTML = ic('grid').html; gridBtn.classList.toggle('is-on', grid); gridBtn.setAttribute('aria-pressed', String(grid));
      top.replaceChildren(flashBtn, h('span', { class: 'cam__label' }, mode === 'pro' ? 'PRO' : ''), gridBtn);
      switcher.hidden = !has('multipleCameras');
    }
    function renderModes() {
      const list = [['photo', 'Photo']]; if (has('advancedCamera')) list.push(['pro', 'Pro']);
      modes.hidden = list.length < 2;
      modes.replaceChildren(...list.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(mode === k), class: mode === k ? 'is-active' : '', onclick: () => { mode = k; renderModes(); renderPro(); renderTop(); } }, l)));
    }
    function renderPro() {
      pro.hidden = mode !== 'pro';
      if (mode !== 'pro' || !track) return;
      const c = track.getCapabilities ? track.getCapabilities() : {}; const s = track.getSettings ? track.getSettings() : {};
      const ctl = (label, key, range, fmt) => {
        if (!range || range.max == null) return null;
        const input = h('input', { type: 'range', min: range.min, max: range.max, step: range.step || 0.1, value: s[key] ?? range.min, 'aria-label': label });
        const val = h('span', { class: 'cam__pro-val' }, fmt(+input.value));
        input.addEventListener('input', () => { val.textContent = fmt(+input.value); track.applyConstraints({ advanced: [{ [key]: +input.value }] }).catch(() => {}); });
        return h('label', { class: 'cam__pro-row' }, h('span', null, label), input, val);
      };
      const rows = [ctl('Exposure', 'exposureCompensation', c.exposureCompensation, (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`), ctl('Zoom', 'zoom', c.zoom, (v) => `${v.toFixed(1)}×`), ctl('Focus', 'focusDistance', c.focusDistance, (v) => v.toFixed(2)), ctl('ISO', 'iso', c.iso, (v) => String(Math.round(v)))].filter(Boolean);
      pro.replaceChildren(...(rows.length ? rows : [h('div', { class: 'cam__pro-empty' }, 'Manual controls are provided by this camera when it reports them.')]));
    }

    async function start() {
      stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError('Camera is not available.'); return; }
      try {
        await platform.requestPermission('camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        track = stream.getVideoTracks()[0];
        video.srcObject = stream; video.classList.toggle('is-mirrored', facing === 'user');
        system.statusbar && system.statusbar.setPrivacy('camera');
        const c = track.getCapabilities ? track.getCapabilities() : {};
        if (c.torch) { refineCapability('torch', true); system.torchTrack = track; }
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (devices.length > 1) refineCapability('multipleCameras', true);
        viewport.querySelector('.r-empty')?.remove();
        renderTop(); renderModes(); renderPro();
      } catch (e) {
        showError(e && e.name === 'NotAllowedError' ? 'Camera access was denied. Allow camera access for RakenOS to take photos.' : 'The camera could not be started.');
      }
    }
    function showError(text) { viewport.querySelector('.r-empty')?.remove(); viewport.appendChild(emptyState('camera', 'Camera unavailable', text)); renderTop(); renderModes(); }
    function stop() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null; if (system.torchTrack === track) system.torchTrack = null; track = null;
      system.statusbar && system.statusbar.setPrivacy(null);
    }

    async function capture() {
      if (!track || !video.videoWidth) { ctx.toast('The camera is not ready'); return; }
      shutter.disabled = true;
      try {
        if (flash) { try { await track.applyConstraints({ advanced: [{ torch: true }] }); await wait(250); } catch {} }
        const max = 2048; const s = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * s); const hh = Math.round(video.videoHeight * s);
        const canvas = h('canvas', { width: w, height: hh }); const g = canvas.getContext('2d');
        if (facing === 'user') { g.translate(w, 0); g.scale(-1, 1); }
        g.drawImage(video, 0, 0, w, hh);
        if (flash) { try { await track.applyConstraints({ advanced: [{ torch: false }] }); } catch {} }
        flashFx.classList.remove('is-on'); void flashFx.offsetWidth; flashFx.classList.add('is-on');
        if (settings.get('haptics')) platform.vibrate(10);
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
        const id = `IMG_${Date.now()}`;
        await idb.set('photos', id, { id, blob, width: w, height: hh, time: Date.now(), favorite: false, mode });
        setThumb(blob);
      } finally { shutter.disabled = false; }
    }
    function setThumb(blob) {
      if (thumb.dataset.url) URL.revokeObjectURL(thumb.dataset.url);
      const url = URL.createObjectURL(blob); thumb.dataset.url = url; thumb.style.backgroundImage = `url(${url})`;
    }
    const keys = await idb.keys('photos'); if (keys && keys.length) { const last = await idb.get('photos', keys.sort().pop()); if (last) setThumb(last.blob); }
    renderTop(); renderModes();
    start();
    return {
      pause: stop,
      resume: () => { if (!stream) start(); },
      unmount: stop,
    };
  },
};
