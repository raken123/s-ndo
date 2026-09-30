// Närvarodetektering med kamera – helt anonym.
//
// Syftet är bara att veta OM någon står vid spelet (och när en ny besökare kommer),
// aldrig VEM det är. Ingen ansiktsigenkänning, inga bilder sparas eller skickas någonstans.
// All bildbehandling sker lokalt i en 64×48 pixlar stor gråskalebild.
//
// Metod:
//  1. Bakgrundsmodell: en långsamt uppdaterad bild av den tomma platsen framför kameran.
//     Andelen pixlar som skiljer sig mycket från bakgrunden = "förgrund" (någon står där).
//  2. Rörelse: skillnad mellan två bildrutor i följd.
//  3. Om webbläsaren har inbyggd FaceDetector (Shape Detection API) används den som extra signal.
//     Den hittar bara ATT det finns ett ansikte, den känner inte igen personer.
//
// En ny besökare = någon dyker upp efter att platsen har varit tom en stund.

const W = 64, H = 48;

export class PresenceDetector extends EventTarget {
  constructor(opts = {}) {
    super();
    this.sensitivity = opts.sensitivity ?? 0.5; // 0..1
    this.present = false;
    this.available = false;
    this.running = false;
    this.lastSeen = 0;
    this.score = 0;
    this.faces = 0;
    this.video = null;
    this.stream = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.bg = null;
    this.prev = null;
    this.onSince = 0;
    this.offSince = 0;
    this.frames = 0;
    this.faceDetector = null;
    this.previewEl = null;
  }

  async start() {
    if (this.running) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user', frameRate: { ideal: 15 } },
        audio: false,
      });
    } catch (e) {
      console.warn('[presence] kamera ej tillgänglig:', e.name);
      return false;
    }
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    if ('FaceDetector' in window) {
      try { this.faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 }); } catch { this.faceDetector = null; }
    }
    this.available = true;
    this.running = true;
    this.bg = null;
    this.timer = setInterval(() => this.tick(), 200);
    return true;
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.available = false;
    this.setPresent(false);
  }

  calibrate() { this.bg = null; this.frames = 0; }

  setPreview(el) { this.previewEl = el; }

  async tick() {
    if (!this.video || this.video.readyState < 2) return;
    this.ctx.drawImage(this.video, 0, 0, W, H);
    const px = this.ctx.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;

    // Normalisera ljusnivån så att automatisk exponering inte ger falsklarm.
    let mean = 0;
    for (let i = 0; i < gray.length; i++) mean += gray[i];
    mean /= gray.length;
    for (let i = 0; i < gray.length; i++) gray[i] = gray[i] - mean;

    this.frames++;
    if (!this.bg) { this.bg = gray.slice(); this.prev = gray.slice(); return; }

    const thr = 38 - this.sensitivity * 24; // 14..38 gråskalesteg
    let fg = 0, mot = 0;
    for (let i = 0; i < gray.length; i++) {
      if (Math.abs(gray[i] - this.bg[i]) > thr) fg++;
      if (Math.abs(gray[i] - this.prev[i]) > thr * 0.8) mot++;
    }
    const fgFrac = fg / gray.length, motFrac = mot / gray.length;
    this.prev = gray;

    if (this.faceDetector && this.frames % 3 === 0) {
      try {
        const faces = await this.faceDetector.detect(this.canvasForFaces());
        this.faces = faces.length;
      } catch { this.faceDetector = null; }
    }

    // Poäng 0..1: förgrund väger tyngst, rörelse och ansikten hjälper.
    const s = Math.min(1, fgFrac / (0.14 - this.sensitivity * 0.08)) * 0.7 + Math.min(1, motFrac * 40) * 0.3 + (this.faces > 0 ? 0.6 : 0);
    this.score = this.score * 0.6 + Math.min(1, s) * 0.4;

    // Bakgrunden uppdateras snabbt när ingen är där och mycket långsamt annars.
    const rate = this.present ? 0.002 : 0.05;
    for (let i = 0; i < gray.length; i++) this.bg[i] += (gray[i] - this.bg[i]) * rate;

    const now = performance.now();
    if (this.score > 0.45) {
      this.lastSeen = now;
      if (!this.onSince) this.onSince = now;
      this.offSince = 0;
      if (!this.present && now - this.onSince > 1000) this.setPresent(true);
    } else {
      this.onSince = 0;
      if (!this.offSince) this.offSince = now;
      if (this.present && now - this.offSince > 2500) this.setPresent(false);
    }

    if (this.previewEl) this.drawPreview(gray, thr);
  }

  canvasForFaces() {
    if (!this.faceCanvas) {
      this.faceCanvas = document.createElement('canvas');
      this.faceCanvas.width = 320; this.faceCanvas.height = 240;
    }
    this.faceCanvas.getContext('2d').drawImage(this.video, 0, 0, 320, 240);
    return this.faceCanvas;
  }

  drawPreview(gray, thr) {
    // Felsökningsvy: visar bara förgrundsmasken (ingen riktig bild av personen).
    const c = this.previewEl.getContext('2d');
    const img = c.createImageData(W, H);
    for (let i = 0; i < gray.length; i++) {
      const on = Math.abs(gray[i] - this.bg[i]) > thr;
      img.data.set(on ? [80, 255, 160, 255] : [20, 30, 50, 255], i * 4);
    }
    c.putImageData(img, 0, 0);
  }

  setPresent(v) {
    if (v === this.present) return;
    this.present = v;
    this.dispatchEvent(new CustomEvent(v ? 'arrive' : 'leave'));
  }
}
