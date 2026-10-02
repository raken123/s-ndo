// Pro: video & screen live. Grabs the camera or a shared screen and hands Gemini Live
// one JPEG frame per second (what the Live API expects for video).

export const canShareScreen = () => !!navigator.mediaDevices?.getDisplayMedia;

export class VisionFeed extends EventTarget {
  constructor(videoEl) {
    super();
    this.video = videoEl;
    this.stream = null;
    this.kind = null;      // 'camera' | 'screen'
    this.timer = null;
    this.canvas = document.createElement('canvas');
    this.onFrame = null;   // (base64Jpeg) => void
  }

  get active() { return !!this.stream; }

  async start(kind) {
    this.stop();
    let stream;
    if (kind === 'camera') {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false,
      });
    } else {
      if (!canShareScreen()) throw new Error('Screen sharing is not supported on this device.');
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    }
    this.stream = stream;
    this.kind = kind;
    this.video.srcObject = stream;
    await this.video.play().catch(() => {});
    // The user can stop a screen share from the OS ("Stop sharing").
    stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stop());
    this.timer = setInterval(() => this.capture(), 1000);
    this.dispatchEvent(new Event('change'));
  }

  capture() {
    const v = this.video;
    if (!this.onFrame || !v.videoWidth) return;
    // Screens need more pixels to stay readable; the camera is fine smaller.
    const max = this.kind === 'screen' ? 1280 : 640;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    this.canvas.width = Math.round(v.videoWidth * scale);
    this.canvas.height = Math.round(v.videoHeight * scale);
    this.canvas.getContext('2d').drawImage(v, 0, 0, this.canvas.width, this.canvas.height);
    const b64 = this.canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    if (b64) this.onFrame(b64);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach(t => t.stop());
    const had = !!this.stream;
    this.stream = null;
    this.kind = null;
    this.video.srcObject = null;
    if (had) this.dispatchEvent(new Event('change'));
  }
}
