// Alarm and timer delivery. Runs at system level so alarms fire even when Clock is closed.
import { storage, settings } from '../core/store.js';
import { platform } from '../core/platform.js';
import { Emitter } from '../core/dom.js';

const KEY = 'rakenos.clock';

class ClockService extends Emitter {
  constructor() {
    super();
    this.timer = null; // { total, endsAt, remaining, running, label }
    this.stopwatch = { running: false, start: 0, elapsed: 0, laps: [] };
    this.lastFired = '';
    setInterval(() => this.checkAlarms(), 5000);
  }
  data() { return { alarms: [], ...(storage.get(KEY) || {}) }; }
  save(d) { storage.set(KEY, d); this.emit('change'); }

  alarms() { return this.data().alarms.sort((a, b) => a.time.localeCompare(b.time)); }
  addAlarm(time, label) { const d = this.data(); d.alarms.push({ id: Date.now().toString(36), time, label: label || 'Alarm', on: true }); this.save(d); }
  updateAlarm(id, patch) { const d = this.data(); const a = d.alarms.find((x) => x.id === id); if (a) Object.assign(a, patch); this.save(d); }
  removeAlarm(id) { const d = this.data(); d.alarms = d.alarms.filter((x) => x.id !== id); this.save(d); }

  checkAlarms() {
    const now = new Date(); const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const key = `${now.toDateString()} ${hm}`;
    if (this.lastFired === key) return;
    const due = this.data().alarms.filter((a) => a.on && a.time === hm);
    if (!due.length) return;
    this.lastFired = key;
    for (const a of due) this.fire(a);
  }
  fire(a) {
    if (settings.get('haptics')) platform.vibrate(600);
    this.emit('alarm', a);
  }

  startTimer(ms, label = 'Timer') {
    clearTimeout(this.timerHandle);
    this.timer = { total: ms, endsAt: Date.now() + ms, remaining: ms, running: true, label };
    this.timerHandle = setTimeout(() => this.timerDone(), ms);
    this.emit('timer');
  }
  pauseTimer() {
    if (!this.timer || !this.timer.running) return;
    clearTimeout(this.timerHandle);
    this.timer.remaining = Math.max(0, this.timer.endsAt - Date.now()); this.timer.running = false; this.emit('timer');
  }
  resumeTimer() {
    if (!this.timer || this.timer.running) return;
    this.timer.endsAt = Date.now() + this.timer.remaining; this.timer.running = true;
    this.timerHandle = setTimeout(() => this.timerDone(), this.timer.remaining); this.emit('timer');
  }
  cancelTimer() { clearTimeout(this.timerHandle); this.timer = null; this.emit('timer'); }
  timerRemaining() { const t = this.timer; if (!t) return 0; return t.running ? Math.max(0, t.endsAt - Date.now()) : t.remaining; }
  timerDone() {
    const label = this.timer ? this.timer.label : 'Timer';
    this.timer = null; this.emit('timer');
    if (settings.get('haptics')) platform.vibrate(500);
    this.emit('timerDone', label);
  }
}

export const clockService = new ClockService();
