// Battery state from the platform, plus automatic Battery Saver.
import { Emitter } from '../core/dom.js';
import { platform } from '../core/platform.js';
import { settings } from '../core/store.js';

class Battery extends Emitter {
  constructor() { super(); this.state = { level: 100, charging: false, source: 'unknown' }; }
  async init() {
    this.apply(await platform.battery());
    platform.onBatteryChange((s) => this.apply(s));
  }
  apply(s) {
    const prev = this.state; this.state = { ...prev, ...s };
    const auto = settings.get('batterySaverAuto');
    if (auto && !this.state.charging && this.state.level <= auto && prev.level > auto) settings.set({ batterySaver: true });
    if (this.state.charging && !prev.charging && this.state.level >= 80 && settings.get('batterySaver')) settings.set({ batterySaver: false });
    this.emit('change', this.state);
  }
}
export const battery = new Battery();
