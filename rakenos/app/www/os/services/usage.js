// Measures foreground time per app on the device (used by Battery settings). Never uploaded.
import { storage } from '../core/store.js';

const KEY = 'rakenos.usage';
let current = null; let since = 0;
const today = () => new Date().toISOString().slice(0, 10);

function read() { const d = storage.get(KEY); return d && d.day === today() ? d : { day: today(), apps: {}, screenOn: 0 }; }

export const usage = {
  foreground(appId) {
    this.flush();
    current = appId; since = Date.now();
  },
  flush() {
    if (current && since) {
      const d = read(); d.apps[current] = (d.apps[current] || 0) + (Date.now() - since); storage.set(KEY, d);
    }
    since = current ? Date.now() : 0;
  },
  screen(on) {
    const d = read();
    if (on) d.screenOnSince = Date.now();
    else if (d.screenOnSince) { d.screenOn += Date.now() - d.screenOnSince; d.screenOnSince = null; }
    storage.set(KEY, d);
  },
  today() {
    this.flush();
    const d = read();
    const screenOn = d.screenOn + (d.screenOnSince ? Date.now() - d.screenOnSince : 0);
    return { apps: d.apps, screenOn };
  },
};
