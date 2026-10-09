// Play mode: runs the game in a sandboxed iframe over the viewport.
import { esc } from '../api.js';

export class Player {
  constructor({ doc, viewport, onStateChange }) {
    this.doc = doc;
    this.viewport = viewport;
    this.onStateChange = onStateChange;
    this.layer = document.getElementById('playLayer');
    this.status = document.getElementById('playStatus');
    this.console = document.getElementById('console');
    this.consoleBody = document.getElementById('consoleBody');
    this.consoleCount = document.getElementById('consoleCount');
    this.iframe = null;
    this.playing = false;
    this.lines = 0;
    this.errors = 0;
    this._pending = null;

    window.addEventListener('message', (e) => this._onMessage(e));
    document.getElementById('stopBtn').onclick = () => this.stop();
    document.getElementById('restartBtn').onclick = () => this._load();
    document.getElementById('fullBtn').onclick = () => this.layer.requestFullscreen?.();
    document.getElementById('consoleClear').onclick = () => this.clearConsole();
    document.getElementById('consoleClose').onclick = () => { this.console.hidden = true; };
  }

  start({ playtest = false, duration = 12 } = {}) {
    this.stop({ keepConsole: true });
    this.clearConsole();
    this.playing = true;
    this.testOptions = playtest ? { duration } : null;
    this.layer.hidden = false;
    this.status.textContent = playtest ? '🧪 AI playtesting…' : '▶ Playing';
    this.status.classList.toggle('testing', playtest);
    this.viewport.setPaused(true);
    this.iframe = document.createElement('iframe');
    // allow-scripts without allow-same-origin => opaque origin, no access to cookies or the API
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-pointer-lock');
    this.iframe.setAttribute('allow', 'fullscreen; autoplay');
    this.iframe.src = '/play.html';
    this.layer.appendChild(this.iframe);
    this.onStateChange?.(true);
  }

  _load() {
    if (!this.iframe) return;
    this.iframe.contentWindow.postMessage({ type: 'load', scene: JSON.parse(JSON.stringify(this.doc.scene)), options: { playtest: !!this.testOptions, duration: this.testOptions?.duration } }, '*');
    this.iframe.focus();
  }

  stop({ keepConsole = false } = {}) {
    if (this.iframe) { this.iframe.remove(); this.iframe = null; }
    this.layer.hidden = true;
    if (this.playing) this.viewport.setPaused(false);
    this.playing = false;
    if (!keepConsole && !this.errors) this.console.hidden = true;
    if (this._pending) { this._pending.reject(new Error('Playtest was stopped.')); this._pending = null; }
    this.onStateChange?.(false);
  }

  toggle() { if (this.playing) this.stop(); else this.start(); }

  /** Run the AI playtest bot and resolve with its report. */
  playtest(duration = 12) {
    return new Promise((resolve, reject) => {
      this.start({ playtest: true, duration });
      const logs = [];
      this._pending = {
        logs,
        resolve: (report) => { this._pending = null; this.stop({ keepConsole: true }); resolve({ ...report, logs: logs.slice(-40) }); },
        reject,
      };
      setTimeout(() => { if (this._pending?.logs === logs) { this._pending = null; this.stop({ keepConsole: true }); reject(new Error('Playtest timed out.')); } }, (duration + 20) * 1000);
    });
  }

  _onMessage(e) {
    if (!this.iframe || e.source !== this.iframe.contentWindow) return;
    const msg = e.data || {};
    if (msg.type === 'ready') this._load();
    else if (msg.type === 'log') {
      this.log(msg.level, msg.text);
      this._pending?.logs.push(`[${msg.level}] ${msg.text}`);
    } else if (msg.type === 'event') {
      if (msg.event === 'win' || msg.event === 'lose') this.log('event', `${msg.event.toUpperCase()}: ${msg.data?.text || ''}`);
    } else if (msg.type === 'report' && this._pending) {
      this._pending.resolve(msg.report);
    }
  }

  log(level, text) {
    this.lines++;
    if (level === 'error') this.errors++;
    if (this.lines > 500) this.consoleBody.firstChild?.remove();
    this.consoleBody.insertAdjacentHTML('beforeend', `<div class="l-${level}">${level === 'error' ? '✖ ' : level === 'event' ? '★ ' : '› '}${esc(text)}</div>`);
    this.consoleBody.scrollTop = this.consoleBody.scrollHeight;
    this.consoleCount.textContent = `${this.lines} lines${this.errors ? ` · ${this.errors} errors` : ''}`;
    if (level === 'error' || level === 'log') this.console.hidden = false;
  }

  clearConsole() {
    this.consoleBody.innerHTML = '';
    this.lines = this.errors = 0;
    this.consoleCount.textContent = '';
  }
}
