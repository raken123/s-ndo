/**
 * Settings: environment, comfort, audio, location and calendar adjustment.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { ENVIRONMENTS } from './environment.js';
import { CITIES, requestLocation } from '../core/geo.js';
import { HIGH_LAT_RULES } from '../core/prayer-times.js';

const TABS = [['scene', 'Scene'], ['comfort', 'Comfort'], ['sound', 'Sound'], ['place', 'Place & date']];

export class SettingsPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.0, height: 0.78, name: 'settings', distance: 1.15 });
    this.tab = 'scene';
  }

  render(p) {
    let y = p.title('Settings', 'Everything is stored on this headset only');

    const tabW = (p.W - 92) / TABS.length;
    TABS.forEach(([key, label], i) => {
      p.button(`tab-${key}`, label, 46 + i * tabW, y, tabW - 8, 54, {
        active: this.tab === key, font: '600 22px Inter, sans-serif',
        onSelect: () => { this.tab = key; this.panel.scroll = 0; },
      });
    });
    y += 74;

    switch (this.tab) {
      case 'comfort': this._comfort(p, y); break;
      case 'sound': this._sound(p, y); break;
      case 'place': this._place(p, y); break;
      default: this._scene(p, y);
    }
  }

  _scene(p, y) {
    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 24px Inter, sans-serif';
    p.ctx.fillText('Where you are sitting', 50, y);
    y += 40;

    const keys = Object.keys(ENVIRONMENTS);
    const cols = 2;
    const cellW = (p.W - 100) / cols;
    const current = this.store.get('settings.environment');
    keys.forEach((key, i) => {
      const env = ENVIRONMENTS[key];
      p.button(`env-${key}`, `${env.icon}  ${env.label}`, 50 + (i % cols) * cellW,
        y + Math.floor(i / cols) * 66, cellW - 10, 58, {
          active: current === key, font: '600 22px Inter, sans-serif',
          onSelect: () => this.app.setEnvironment(key),
        });
    });
    y += Math.ceil(keys.length / cols) * 66 + 20;

    p.toggle('beam', 'Qibla beam through the walls', this.store.get('settings.qiblaBeam'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.qiblaBeam'); this.refresh(); });
    y += 72;
    p.toggle('contrast', 'High contrast text', this.store.get('settings.highContrast'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.highContrast'); this.app.applyContrast(); this.refresh(); });
    y += 72;
    p.toggle('tajweed', 'Tajweed colouring in the book', this.store.get('settings.tajweed'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.tajweed'); this.app.book?._refresh(); this.refresh(); });
  }

  _comfort(p, y) {
    p.toggle('seated', 'Seated mode (bring everything lower)', this.store.get('settings.seated'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.seated'); this.app.applySeated(); this.refresh(); });
    y += 74;

    p.toggle('snap', 'Snap turning', this.store.get('settings.snapTurn'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.snapTurn'); this.refresh(); });
    y += 74;

    p.toggle('vignette', 'Comfort vignette while moving', this.store.get('settings.vignette'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.vignette'); this.refresh(); });
    y += 74;

    const hand = this.store.get('settings.handedness');
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 23px Inter, sans-serif';
    p.ctx.fillText('Wrist menu hand', 50, y + 16);
    const bw = (p.W - 100) / 2 - 5;
    p.button('hand-left', 'Left wrist', p.W / 2 - 10, y, bw / 2, 54, {
      active: hand === 'left', font: '600 21px Inter, sans-serif',
      onSelect: () => { this.store.set('settings.handedness', 'left'); this.refresh(); },
    });
    p.button('hand-right', 'Right wrist', p.W / 2 + bw / 2, y, bw / 2, 54, {
      active: hand === 'right', font: '600 21px Inter, sans-serif',
      onSelect: () => { this.store.set('settings.handedness', 'right'); this.refresh(); },
    });
    y += 76;

    y = p.slider('height', 'Eye height offset', this.app.heightOffset, -0.6, 0.6, 50, y, p.W - 100,
      (v) => { this.app.setHeightOffset(v); }, (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)} cm`) + 12;

    p.text(
      'If the floor feels wrong — the mat floating or sunk into the ground — nudge the eye '
      + 'height until the mat sits flat.',
      50, y, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 27 },
    );
  }

  _sound(p, y) {
    p.toggle('adhan', 'Alert at prayer times', this.store.get('settings.adhanEnabled'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.adhanEnabled'); this.refresh(); });
    y += 74;

    y = p.slider('adhan-vol', 'Alert volume', this.store.get('settings.adhanVolume', 0.7), 0, 1, 50, y, p.W - 100,
      (v) => { this.store.set('settings.adhanVolume', v); }, (v) => `${Math.round(v * 100)}%`) + 12;

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 24px Inter, sans-serif';
    p.ctx.fillText('Ambience', 50, y);
    y += 40;

    const beds = [['none', 'Silent'], ['wind', 'Desert wind'], ['rain', 'Rain'], ['haram', 'Distant hall']];
    const bw = (p.W - 100) / beds.length;
    beds.forEach(([key, label], i) => {
      p.button(`amb-${key}`, label, 50 + i * bw, y, bw - 8, 54, {
        active: this.store.get('settings.ambience') === key,
        font: '600 20px Inter, sans-serif',
        onSelect: () => {
          this.store.set('settings.ambience', key);
          this.app.audio.setAmbience(key);
          this.refresh();
        },
      });
    });
    y += 72;

    y = p.slider('amb-vol', 'Ambience volume', this.store.get('settings.ambienceVolume', 0.35), 0, 1, 50, y, p.W - 100,
      (v) => {
        this.store.set('settings.ambienceVolume', v);
        this.app.audio.setAmbienceVolume(v);
      }, (v) => `${Math.round(v * 100)}%`) + 12;

    p.toggle('voice', 'Spoken prompts in the guided prayer', this.store.get('settings.guideVoice'), 50, y, p.W - 100,
      () => { this.store.toggle('settings.guideVoice'); this.refresh(); });
    y += 76;

    p.text(
      'No adhan recording is bundled — an adhan is somebody\'s voice, and picking one for '
      + 'everybody would be presumptuous. The alert is a chime; paste the URL of any adhan you '
      + 'want in its place.',
      50, y, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 27 },
    );
  }

  _place(p, y) {
    const loc = this.app.location;
    p.ctx.fillStyle = THEME.ink;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText(loc ? `${loc.name} — ${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` : 'No location yet', 50, y);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 21px Inter, sans-serif';
    p.ctx.fillText(loc ? `Source: ${loc.source}` : '', 50, y + 34);
    y += 74;

    p.button('locate', 'Use my device location', 50, y, p.W - 100, 58, {
      font: '600 22px Inter, sans-serif',
      onSelect: async () => {
        const next = await requestLocation();
        this.app.setLocation(next);
        this.refresh();
      },
    });
    y += 76;

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 24px Inter, sans-serif';
    p.ctx.fillText('Or pick a city', 50, y);
    y += 38;

    const cols = 4;
    const cellW = (p.W - 100) / cols;
    const cities = CITIES.slice(0, 16);
    cities.forEach((city, i) => {
      p.button(`city-${city.name}`, city.name, 50 + (i % cols) * cellW,
        y + Math.floor(i / cols) * 56, cellW - 8, 48, {
          font: '500 20px Inter, sans-serif',
          active: loc?.name === city.name,
          onSelect: () => {
            this.app.setLocation({ lat: city.lat, lng: city.lng, name: city.name, source: 'chosen' });
            this.refresh();
          },
        });
    });
    y += Math.ceil(cities.length / cols) * 56 + 18;

    const offset = this.store.get('settings.hijriOffset', 0);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 23px Inter, sans-serif';
    p.ctx.fillText(`Hijri date adjustment: ${offset > 0 ? '+' : ''}${offset} day(s)`, 50, y + 16);
    p.button('h-minus', '−1', p.W - 210, y, 70, 52, { font: '700 22px Inter, sans-serif', onSelect: () => this.adjustHijri(-1) });
    p.button('h-plus', '+1', p.W - 130, y, 70, 52, { font: '700 22px Inter, sans-serif', onSelect: () => this.adjustHijri(1) });
    y += 72;

    const rule = this.store.get('settings.highLat');
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.fillText('High-latitude rule', 50, y + 16);
    const rw = (p.W - 340) / HIGH_LAT_RULES.length;
    HIGH_LAT_RULES.forEach((r, i) => {
      p.button(`hl-${r}`, r === 'None' ? 'Off' : r.replace(/([A-Z])/g, ' $1').trim(),
        290 + i * (rw + 6), y, rw, 52, {
          active: rule === r, font: '500 18px Inter, sans-serif',
          onSelect: () => { this.store.set('settings.highLat', r); this.app.recomputeTimes(); this.refresh(); },
        });
    });
  }

  adjustHijri(delta) {
    this.store.set('settings.hijriOffset', this.store.get('settings.hijriOffset', 0) + delta);
    this.app.audio.click();
    this.refresh();
  }
}
