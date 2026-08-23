/**
 * Hijri calendar, the events of the Islamic year, and Ramadan.
 *
 * A month grid you can page through, today marked, fast days highlighted, and
 * — during Ramadan — live countdowns to suhoor and iftar with a fasting log.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { toHijri, fromHijri, hijriMonthLength, HIJRI_MONTHS, HIJRI_MONTHS_AR } from '../core/hijri.js';
import { HIJRI_EVENTS, RECURRING, isWhiteDay } from '../data/events.js';
import { computeTimes, formatTime, formatCountdown } from '../core/prayer-times.js';

export class CalendarPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.05, height: 0.8, name: 'calendar', distance: 1.2 });
    this.offset = 0;       // months from the current one
    this.view = 'month';   // month | ramadan
  }

  get hijriToday() {
    return toHijri(new Date(), this.store.get('settings.hijriOffset', 0));
  }

  render(p) {
    const today = this.hijriToday;
    let month = today.month + this.offset;
    let year = today.year;
    while (month > 12) { month -= 12; year += 1; }
    while (month < 1) { month += 12; year -= 1; }

    const isRamadanView = this.view === 'ramadan';
    let y = p.title(
      isRamadanView ? 'Ramadan' : `${HIJRI_MONTHS[month - 1]} ${year}`,
      isRamadanView ? 'Fasting, suhoor and iftar' : `${HIJRI_MONTHS_AR[month - 1]} · ${today.source} calculation`,
    );

    const bw = (p.W - 112) / 4;
    p.button('prev', '‹ Month', 46, y, bw, 54, { font: '600 21px Inter, sans-serif', onSelect: () => { this.offset -= 1; this.view = 'month'; } });
    p.button('today', 'Today', 46 + bw + 10, y, bw, 54, { font: '600 21px Inter, sans-serif', onSelect: () => { this.offset = 0; this.view = 'month'; } });
    p.button('next', 'Month ›', 46 + (bw + 10) * 2, y, bw, 54, { font: '600 21px Inter, sans-serif', onSelect: () => { this.offset += 1; this.view = 'month'; } });
    p.button('ramadan', 'Ramadan', 46 + (bw + 10) * 3, y, bw, 54, {
      font: '600 21px Inter, sans-serif', active: isRamadanView,
      onSelect: () => { this.view = isRamadanView ? 'month' : 'ramadan'; },
    });
    y += 74;

    if (isRamadanView) this._renderRamadan(p, y, today);
    else this._renderMonth(p, y, year, month, today);
  }

  _renderMonth(p, y, year, month, today) {
    const length = hijriMonthLength(year, month, this.store.get('settings.hijriOffset', 0));
    const firstDate = fromHijri(year, month, 1, this.store.get('settings.hijriOffset', 0));
    const startWeekday = firstDate.getDay();     // 0 = Sunday

    const cols = 7;
    const cellW = (p.W - 92) / cols;
    const cellH = 62;
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    p.ctx.font = '600 20px Inter, sans-serif';
    p.ctx.fillStyle = THEME.muted;
    p.ctx.textAlign = 'center';
    labels.forEach((label, i) => p.ctx.fillText(label, 46 + cellW * (i + 0.5), y));
    y += 32;

    const events = HIJRI_EVENTS.filter((e) => e.month === month);
    for (let day = 1; day <= length; day++) {
      const cell = day + startWeekday - 1;
      const col = cell % cols;
      const row = Math.floor(cell / cols);
      const x = 46 + col * cellW;
      const cy = y + row * cellH;

      const isToday = today.year === year && today.month === month && today.day === day;
      const event = events.find((e) => e.day === day);
      const gregorian = new Date(firstDate.getTime() + (day - 1) * 864e5);
      const isFriday = gregorian.getDay() === 5;

      if (isToday) {
        p.ctx.fillStyle = 'rgba(216,180,106,0.22)';
        p.ctx.fillRect(x + 3, cy - 4, cellW - 6, cellH - 8);
      } else if (event) {
        p.ctx.fillStyle = 'rgba(46,156,125,0.16)';
        p.ctx.fillRect(x + 3, cy - 4, cellW - 6, cellH - 8);
      } else if (isWhiteDay(day)) {
        p.ctx.fillStyle = 'rgba(255,255,255,0.05)';
        p.ctx.fillRect(x + 3, cy - 4, cellW - 6, cellH - 8);
      }

      p.ctx.fillStyle = isToday ? THEME.gold : isFriday ? THEME.green : THEME.ink;
      p.ctx.font = isToday ? '700 26px Inter, sans-serif' : '500 24px Inter, sans-serif';
      p.ctx.fillText(String(day), x + cellW / 2, cy + 6);

      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 16px Inter, sans-serif';
      p.ctx.fillText(`${gregorian.getDate()}/${gregorian.getMonth() + 1}`, x + cellW / 2, cy + 34);

      if (event) {
        p.ctx.fillStyle = THEME.green;
        p.ctx.beginPath();
        p.ctx.arc(x + cellW - 14, cy + 6, 4, 0, Math.PI * 2);
        p.ctx.fill();
      }
    }
    p.ctx.textAlign = 'left';

    const rows = Math.ceil((length + startWeekday) / cols);
    y += rows * cellH + 12;
    y = p.divider(y) + 14;

    if (events.length) {
      for (const event of events.slice(0, 3)) {
        p.ctx.fillStyle = THEME.gold;
        p.ctx.font = '600 23px Inter, sans-serif';
        p.ctx.fillText(`${event.day} — ${event.name}`, 50, y);
        y += 30;
        y = p.text(event.note, 50, y, { color: THEME.muted, font: '400 20px Inter, sans-serif', lineHeight: 26 }) + 12;
      }
    } else {
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 21px Inter, sans-serif';
      p.ctx.fillText('No marked dates this month.', 50, y);
      y += 34;
      for (const item of RECURRING.slice(0, 2)) {
        p.ctx.fillStyle = THEME.goldDim;
        p.ctx.font = '500 20px Inter, sans-serif';
        p.ctx.fillText(`${item.name} — ${item.when}`, 50, y);
        y += 28;
      }
    }
  }

  _renderRamadan(p, y, today) {
    const loc = this.app.location;
    const hijriOffset = this.store.get('settings.hijriOffset', 0);
    const inRamadan = today.month === 9;
    const now = new Date();

    if (loc) {
      const times = computeTimes(now, loc, {
        method: this.store.get('settings.method'),
        asr: this.store.get('settings.asr'),
        highLat: this.store.get('settings.highLat'),
      });
      const use24 = this.store.get('settings.use24h', true);
      const beforeDawn = now < times.fajr;
      const target = beforeDawn ? times.fajr : times.maghrib;
      const label = beforeDawn ? 'Suhoor ends (Fajr)' : 'Iftar (Maghrib)';

      p.ctx.fillStyle = THEME.gold;
      p.ctx.font = '700 62px Inter, sans-serif';
      p.ctx.fillText(formatCountdown(target - now), 50, y);
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '500 25px Inter, sans-serif';
      p.ctx.fillText(`${label} at ${formatTime(target, use24)}`, 50, y + 76);
      y += 128;

      const dayLength = times.maghrib - times.fajr;
      const progress = (now - times.fajr) / dayLength;
      p.progress(Math.max(0, Math.min(1, progress)), 50, y, p.W - 100, 12);
      y += 40;
    }

    if (inRamadan) {
      const fastLog = this.store.get('progress.fasts', {}) || {};
      const key = `${today.year}-${today.day}`;
      const fasted = !!fastLog[key];
      p.button('fast', fasted ? '✓ Fasted today' : 'Log today\'s fast', 50, y, p.W - 100, 64, {
        active: fasted,
        onSelect: () => {
          const next = { ...fastLog, [key]: !fasted };
          if (!next[key]) delete next[key];
          this.store.set('progress.fasts', next);
          this.app.audio.click();
        },
      });
      y += 82;

      const kept = Object.keys(fastLog).filter((k) => k.startsWith(`${today.year}-`)).length;
      p.ctx.fillStyle = THEME.ink;
      p.ctx.font = '600 26px Inter, sans-serif';
      p.ctx.fillText(`Day ${today.day} of Ramadan · ${kept} fasts logged`, 50, y);
      y += 40;
      p.progress(today.day / 30, 50, y, p.W - 100, 10, THEME.green);
      y += 34;

      if (today.day >= 21) {
        y = p.text(
          'The last ten nights. Laylat al-Qadr is sought on the odd nights — the extra prayer, '
          + 'Qur\'an and charity of these nights are the heart of the month.',
          50, y, { color: THEME.gold, font: '400 22px Inter, sans-serif', lineHeight: 30 },
        ) + 12;
      }
    } else {
      const nextRamadan = fromHijri(today.month > 9 ? today.year + 1 : today.year, 9, 1, hijriOffset);
      const days = Math.ceil((nextRamadan - now) / 864e5);
      p.ctx.fillStyle = THEME.ink;
      p.ctx.font = '600 30px Inter, sans-serif';
      p.ctx.fillText(`${days} days until Ramadan`, 50, y);
      y += 44;
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 22px Inter, sans-serif';
      p.ctx.fillText(`Expected to begin around ${nextRamadan.toDateString()}`, 50, y);
      y += 44;
    }

    p.text(
      'Dates are calculated, not sighted. Your local mosque\'s announcement decides when the '
      + 'month actually begins and ends.',
      50, p.H - 90, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 27 },
    );
  }

  tick() { if (this.view === 'ramadan') this.refresh(); }
}
