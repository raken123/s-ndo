// Spelar in besökarens resa (bara spelets bild och ljud – aldrig kamerabilden)
// så att den kan skickas till besökarens e-post när tiden är slut.
//
// Inspelningen görs i en egen, mindre canvas (960×540, 24 bilder/s) dit spelets 3D-bild
// kopieras varje bildruta, tillsammans med en enkel statusrad och de texter som visas
// i spelet (fakta, frågor, meddelanden). Allt ligger i minnet tills det laddas upp eller kastas.
import { wrap } from './ship.js';

const W = 960, H = 540, FPS = 24;

export class GameRecorder {
  constructor(sound) {
    this.sound = sound;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.recorder = null;
    this.chunks = [];
    this.recording = false;
    this.lastDraw = 0;
    this.mime = '';
  }

  get supported() {
    return !!(window.MediaRecorder && this.canvas.captureStream);
  }

  start() {
    if (!this.supported || this.recording) return false;
    this.discard();
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    this.mime = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const stream = this.canvas.captureStream(FPS);
    const audio = this.sound.recordingStream?.();
    audio?.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    try {
      this.recorder = new MediaRecorder(stream, {
        mimeType: this.mime || undefined, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000,
      });
    } catch (e) {
      console.warn('[recorder] kan inte spela in:', e);
      return false;
    }
    this.chunks = [];
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, W, H);
    this.recorder.start(3000);
    this.recording = true;
    this.startedAt = performance.now();
    return true;
  }

  // Kopiera spelets bild (kallas direkt efter renderingen) och rita statusrad/texter ovanpå.
  draw(src, o) {
    if (!this.recording) return;
    const now = performance.now();
    if (now - this.lastDraw < 1000 / FPS - 2) return;
    this.lastDraw = now;
    const c = this.ctx;
    // Fyll hela ytan (beskär om skärmens proportioner skiljer sig)
    const sw = src.width, sh = src.height;
    const s = Math.max(W / sw, H / sh);
    const dw = sw * s, dh = sh * s;
    c.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);

    // Statusrad
    c.fillStyle = 'rgba(4,12,28,0.65)';
    c.fillRect(0, 0, W, 34);
    c.font = 'bold 18px sans-serif';
    c.fillStyle = '#7fe0ff';
    c.textBaseline = 'middle';
    c.fillText('ASTRO', 12, 17);
    c.fillStyle = '#e6f2ff';
    c.font = '16px sans-serif';
    if (o.line) c.fillText(o.line, 90, 17, W - 300);
    c.textAlign = 'right';
    c.font = 'bold 18px monospace';
    c.fillText(o.time || '', W - 12, 17);
    c.textAlign = 'left';

    // Dialog (fakta, frågor) som panel
    if (o.dialog) {
      const d = o.dialog;
      c.fillStyle = 'rgba(6,18,40,0.88)';
      c.fillRect(150, 90, W - 300, H - 170);
      c.strokeStyle = 'rgba(90,200,255,0.8)'; c.lineWidth = 2;
      c.strokeRect(150, 90, W - 300, H - 170);
      c.textBaseline = 'alphabetic';
      let y = 128;
      if (d.kicker) { c.fillStyle = '#7fe0ff'; c.font = 'bold 14px sans-serif'; c.fillText(String(d.kicker).toUpperCase(), 172, y); y += 30; }
      c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif';
      y += wrap(c, d.title || '', 172, y, W - 344, 30, 2) * 30;
      c.font = '17px sans-serif'; c.fillStyle = '#e6f2ff';
      for (const line of d.body || []) {
        y += wrap(c, (d.bullets ? '• ' : '') + line, 172, y + 6, W - 344, 22, 3) * 22 + 8;
        if (y > H - 110) break;
      }
      if (d.note) { c.fillStyle = '#ffd966'; c.font = 'bold 16px sans-serif'; wrap(c, d.note, 172, Math.min(y + 14, H - 100), W - 344, 20, 2); }
    }

    // Meddelande
    if (o.toast) {
      c.font = 'bold 20px sans-serif';
      const tw = Math.min(W - 80, c.measureText(o.toast).width + 40);
      c.fillStyle = 'rgba(4,20,40,0.85)';
      c.fillRect((W - tw) / 2, H - 70, tw, 40);
      c.fillStyle = '#bfefff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(o.toast, W / 2, H - 50, W - 100);
      c.textAlign = 'left';
    }
    if (o.big) {
      c.font = 'bold 120px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.fillText(o.big, W / 2, H * 0.42);
      c.textAlign = 'left';
    }
    c.textBaseline = 'alphabetic';
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.recorder || !this.recording) { resolve(null); return; }
      this.recording = false;
      this.recorder.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: (this.mime || 'video/webm').split(';')[0] }) : null;
        this.chunks = [];
        this.recorder = null;
        resolve(blob);
      };
      try { this.recorder.stop(); } catch { resolve(null); }
    });
  }

  discard() {
    if (this.recorder && this.recording) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      try { this.recorder.stop(); } catch { /* redan stoppad */ }
    }
    this.recorder = null;
    this.recording = false;
    this.chunks = [];
  }

  get seconds() { return this.recording ? (performance.now() - this.startedAt) / 1000 : 0; }
}

// Laddar upp inspelningen till museets Astro-server, som mejlar en länk till besökaren.
export function uploadRecording({ server, key, blob, email, lang, summary, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', server.replace(/\/$/, '') + '/api/recordings');
    xhr.setRequestHeader('Content-Type', blob.type || 'video/webm');
    xhr.setRequestHeader('X-Astro-Email', email);
    xhr.setRequestHeader('X-Astro-Lang', lang);
    xhr.setRequestHeader('X-Astro-Summary', encodeURIComponent(JSON.stringify(summary)));
    if (key) xhr.setRequestHeader('X-Astro-Key', key);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* tomt svar */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error(body.error || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.timeout = 15 * 60 * 1000;
    xhr.send(blob);
  });
}
