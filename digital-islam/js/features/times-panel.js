/**
 * Prayer times: today's schedule, the countdown to the next prayer, the
 * prayer log, and the alert that fires when a time comes in.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import {
  computeTimes, prayerWindow, formatTime, formatCountdown,
  PRAYER_LABELS, PRAYER_ARABIC, FARD, METHODS, ASR_SCHOOLS,
} from '../core/prayer-times.js';
import { formatHijri } from '../core/hijri.js';

export class TimesPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.05, height: 0.78, name: 'prayer-times', distance: 1.2 });
    this.showSettings = false;
  }

  render(p) {
    const loc = this.app.location;
    if (!loc) {
      p.title('Prayer times', 'Waiting for a location…');
      return;
    }

    const opts = {
      method: this.store.get('settings.method'),
      asr: this.store.get('settings.asr'),
      highLat: this.store.get('settings.highLat'),
    };
    const now = new Date();
    const window_ = prayerWindow(now, loc, opts);
    const times = window_.today;
    const use24 = this.store.get('settings.use24h', true);
    const log = this.store.prayersFor(now);

    let y = p.title(
      `${PRAYER_LABELS[window_.next.key]} in ${formatCountdown(window_.msToNext)}`,
      `${loc.name} · ${formatHijri(now, this.store.get('settings.hijriOffset', 0))}`,
    );

    // Row per prayer, with sunrise shown as a marker between Fajr and Dhuhr.
    const rows = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const rowH = 62;
    for (const key of rows) {
      const isFard = FARD.includes(key);
      const isNext = window_.next.key === key && !window_.next.tomorrow;
      const isCurrent = window_.current.key === key;
      const done = !!log[key];

      if (isNext || isCurrent) {
        p.ctx.fillStyle = isNext ? 'rgba(216,180,106,0.14)' : 'rgba(46,156,125,0.12)';
        p.ctx.fillRect(40, y - 6, p.W - 80, rowH - 6);
      }

      p.ctx.textBaseline = 'middle';
      p.ctx.fillStyle = isFard ? THEME.ink : THEME.muted;
      p.ctx.font = isNext ? '700 30px Inter, sans-serif' : '500 28px Inter, sans-serif';
      p.ctx.fillText(PRAYER_LABELS[key], 56, y + rowH / 2 - 6);

      p.ctx.direction = 'rtl';
      p.ctx.textAlign = 'right';
      p.ctx.fillStyle = THEME.goldDim;
      p.ctx.font = '400 30px Amiri, "Noto Naskh Arabic", serif';
      p.ctx.fillText(PRAYER_ARABIC[key], 400, y + rowH / 2 - 6);
      p.ctx.direction = 'ltr';
      p.ctx.textAlign = 'left';

      p.ctx.fillStyle = isNext ? THEME.gold : THEME.ink;
      p.ctx.font = '600 30px Inter, sans-serif';
      p.ctx.fillText(formatTime(times[key], use24), 470, y + rowH / 2 - 6);
      p.ctx.textBaseline = 'top';

      if (isFard) {
        p.button(`log-${key}`, done ? '✓ prayed' : 'mark prayed', p.W - 300, y, 250, rowH - 12, {
          active: done, font: '600 22px Inter, sans-serif',
          onSelect: () => {
            this.store.markPrayer(key, !done);
            this.app.audio.click();
          },
        });
      }
      y += rowH;
    }

    y = p.divider(y + 6) + 14;

    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 22px Inter, sans-serif';
    p.ctx.fillText(
      `Islamic midnight ${formatTime(times.midnight, use24)} · last third ${formatTime(times.lastThird, use24)}`,
      50, y,
    );
    y += 40;

    const bw = (p.W - 112) / 3;
    p.button('method', METHODS[opts.method]?.name.split(',')[0] || 'Method', 46, y, bw, 58, {
      font: '600 21px Inter, sans-serif',
      onSelect: () => this.cycleMethod(),
    });
    p.button('asr', `Asr: ${opts.asr}`, 46 + bw + 10, y, bw, 58, {
      font: '600 21px Inter, sans-serif',
      onSelect: () => {
        const keys = Object.keys(ASR_SCHOOLS);
        const next = keys[(keys.indexOf(opts.asr) + 1) % keys.length];
        this.store.set('settings.asr', next);
        this.refresh();
      },
    });
    p.button('adhan', this.store.get('settings.adhanEnabled') ? 'Alert: on' : 'Alert: off',
      46 + (bw + 10) * 2, y, bw, 58, {
        font: '600 21px Inter, sans-serif',
        active: this.store.get('settings.adhanEnabled'),
        onSelect: () => { this.store.toggle('settings.adhanEnabled'); this.refresh(); },
      });
    y += 74;

    p.text(
      `Calculated for ${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)} using ${METHODS[opts.method]?.name}, `
      + `shown on this device's clock (${Intl.DateTimeFormat().resolvedOptions().timeZone}). `
      + 'Check against your local mosque — communities differ on method and on the minute.',
      46, y, { color: THEME.goldDim, font: '400 19px Inter, sans-serif', lineHeight: 26 },
    );
  }

  cycleMethod() {
    const keys = Object.keys(METHODS);
    const current = this.store.get('settings.method');
    const next = keys[(keys.indexOf(current) + 1) % keys.length];
    this.store.set('settings.method', next);
    this.app.recomputeTimes();
    this.refresh();
  }

  tick() { this.refresh(); }
}

/**
 * Watches the clock in the background and raises the alert when a prayer time
 * arrives, whatever else the user is doing.
 */
export class PrayerWatcher {
  constructor(app) {
    this.app = app;
    this.lastFired = {};
    this.engine = app.engine;
    this.elapsed = 0;
    this.engine.add(this);
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed < 5) return;      // checking every five seconds is plenty
    this.elapsed = 0;

    const loc = this.app.location;
    if (!loc) return;
    const now = new Date();
    const times = computeTimes(now, loc, {
      method: this.app.store.get('settings.method'),
      asr: this.app.store.get('settings.asr'),
      highLat: this.app.store.get('settings.highLat'),
    });

    for (const key of FARD) {
      const at = times[key];
      if (!Number.isFinite(at?.getTime())) continue;
      const delta = now - at;
      const dayKey = `${key}:${now.toDateString()}`;
      if (delta >= 0 && delta < 60000 && this.lastFired[dayKey] !== true) {
        this.lastFired[dayKey] = true;
        this.app.onPrayerTime(key, at);
      }
    }
  }
}
