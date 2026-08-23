/**
 * Two utilities: a zakat calculator and the worship dashboard.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { Store } from '../core/store.js';
import { FARD, PRAYER_LABELS } from '../core/prayer-times.js';
import { toHijri } from '../core/hijri.js';

/** Nisab thresholds in grams of precious metal — the classical measures. */
const NISAB_GOLD_G = 87.48;
const NISAB_SILVER_G = 612.36;
const ZAKAT_RATE = 0.025;

export class ZakatPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 0.95, height: 0.75, name: 'zakat', distance: 1.15 });
    this.values = this.store.get('progress.zakat') || {
      cash: 0, savings: 0, gold: 0, silver: 0, business: 0, debtsOwed: 0, debtsOwing: 0,
      goldPrice: 70, silverPrice: 0.8, currency: '$',
    };
    this.field = 'cash';
  }

  get totals() {
    const v = this.values;
    const assets = v.cash + v.savings + v.business + v.debtsOwed
      + v.gold * v.goldPrice + v.silver * v.silverPrice;
    const net = assets - v.debtsOwing;
    const nisabGold = NISAB_GOLD_G * v.goldPrice;
    const nisabSilver = NISAB_SILVER_G * v.silverPrice;
    const nisab = Math.min(nisabGold, nisabSilver);   // the lower threshold benefits the poor
    return { assets, net, nisab, nisabGold, nisabSilver, due: net >= nisab ? net * ZAKAT_RATE : 0 };
  }

  render(p) {
    const v = this.values;
    const t = this.totals;
    let y = p.title('Zakat calculator', 'Two and a half percent of qualifying wealth held for a lunar year');

    const fields = [
      ['cash', 'Cash in hand'],
      ['savings', 'Bank savings'],
      ['business', 'Business stock'],
      ['debtsOwed', 'Money owed to you'],
      ['gold', `Gold (grams @ ${v.currency}${v.goldPrice}/g)`],
      ['silver', `Silver (grams @ ${v.currency}${v.silverPrice}/g)`],
      ['debtsOwing', 'Debts you owe (deducted)'],
    ];

    const rowH = 54;
    for (const [key, label] of fields) {
      p.ctx.fillStyle = this.field === key ? THEME.gold : THEME.muted;
      p.ctx.font = '500 23px Inter, sans-serif';
      p.ctx.textBaseline = 'middle';
      p.ctx.fillText(label, 56, y + rowH / 2 - 4);

      p.ctx.textAlign = 'right';
      p.ctx.fillStyle = THEME.ink;
      p.ctx.font = '600 25px Inter, sans-serif';
      const unit = key === 'gold' || key === 'silver' ? 'g' : v.currency;
      p.ctx.fillText(key === 'gold' || key === 'silver'
        ? `${v[key]} g` : `${unit}${v[key].toLocaleString()}`, p.W - 250, y + rowH / 2 - 4);
      p.ctx.textAlign = 'left';
      p.ctx.textBaseline = 'top';

      p.button(`minus-${key}`, '−', p.W - 230, y + 4, 60, rowH - 14, {
        font: '700 26px Inter, sans-serif',
        onSelect: () => this.adjust(key, -1),
      });
      p.button(`plus-${key}`, '+', p.W - 160, y + 4, 60, rowH - 14, {
        font: '700 26px Inter, sans-serif',
        onSelect: () => this.adjust(key, 1),
      });
      p.button(`pick-${key}`, '·', p.W - 90, y + 4, 44, rowH - 14, {
        active: this.field === key, font: '600 20px Inter, sans-serif',
        onSelect: () => { this.field = key; },
      });
      y += rowH;
    }

    y = p.divider(y + 6) + 16;

    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.fillText(`Net wealth ${v.currency}${Math.round(t.net).toLocaleString()}`, 56, y);
    p.ctx.fillText(`Nisab ${v.currency}${Math.round(t.nisab).toLocaleString()}`, 56, y + 32);
    y += 74;

    p.ctx.fillStyle = t.due > 0 ? THEME.gold : THEME.muted;
    p.ctx.font = '700 48px Inter, sans-serif';
    p.ctx.fillText(t.due > 0
      ? `${v.currency}${t.due.toFixed(2)} due`
      : 'Below nisab — no zakat due', 56, y);
    y += 74;

    p.text(
      'Step size follows the field: 100 for money, 5 g for metal. Prices are yours to set — '
      + 'use today\'s local rate. This is an arithmetic aid, not a fatwa; a scholar decides the '
      + 'edge cases (pensions, shares, mixed debts).',
      56, y, { color: THEME.goldDim, font: '400 20px Inter, sans-serif', lineHeight: 27 },
    );
  }

  adjust(key, direction) {
    const step = key === 'gold' || key === 'silver' ? 5
      : key === 'goldPrice' || key === 'silverPrice' ? 1 : 100;
    this.values[key] = Math.max(0, Math.round((this.values[key] + direction * step) * 100) / 100);
    this.field = key;
    this.store.set('progress.zakat', this.values);
    this.app.audio.click();
  }
}

export class StatsPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.0, height: 0.72, name: 'stats', distance: 1.15 });
  }

  render(p) {
    const streak = this.store.get('progress.streak', { count: 0, best: 0 });
    const history = this.store.history(28);
    const today = this.store.prayersFor(new Date());
    const hijri = toHijri(new Date(), this.store.get('settings.hijriOffset', 0));

    let y = p.title('Your worship', `${hijri.day} ${hijri.monthName} ${hijri.year} AH`);

    // Headline figures.
    const cards = [
      [`${streak.count}`, 'day streak'],
      [`${streak.best || 0}`, 'best streak'],
      [`${this.store.get('progress.tasbihTotal', 0).toLocaleString()}`, 'dhikr counted'],
      [`${this.store.get('progress.quranReadAyahs', 0)}`, 'ayahs recited'],
    ];
    const cardW = (p.W - 92 - 30) / 4;
    cards.forEach(([value, label], i) => {
      const x = 46 + i * (cardW + 10);
      p.ctx.fillStyle = 'rgba(255,255,255,0.045)';
      p.ctx.fillRect(x, y, cardW, 104);
      p.ctx.fillStyle = THEME.gold;
      p.ctx.font = '700 38px Inter, sans-serif';
      p.ctx.textAlign = 'center';
      p.ctx.fillText(value, x + cardW / 2, y + 22);
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '500 19px Inter, sans-serif';
      p.ctx.fillText(label, x + cardW / 2, y + 72);
      p.ctx.textAlign = 'left';
    });
    y += 128;

    // Today's five.
    p.ctx.fillStyle = THEME.ink;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText('Today', 50, y);
    y += 40;
    const bw = (p.W - 92 - 40) / 5;
    FARD.forEach((key, i) => {
      const done = !!today[key];
      p.button(`t-${key}`, PRAYER_LABELS[key], 46 + i * (bw + 10), y, bw, 58, {
        active: done, font: '600 21px Inter, sans-serif',
        onSelect: () => { this.store.markPrayer(key, !done); this.app.audio.click(); },
      });
    });
    y += 80;

    // Four-week chart: one bar per day, height = prayers logged.
    p.ctx.fillStyle = THEME.ink;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText('Last four weeks', 50, y);
    y += 44;

    const chartH = 110;
    const barW = (p.W - 100) / history.length;
    history.forEach((day, i) => {
      const h = (day.count / 5) * chartH;
      const x = 50 + i * barW;
      p.ctx.fillStyle = 'rgba(255,255,255,0.06)';
      p.ctx.fillRect(x, y, barW - 4, chartH);
      p.ctx.fillStyle = day.count === 5 ? THEME.green : day.count > 0 ? THEME.gold : 'rgba(255,255,255,0.08)';
      p.ctx.fillRect(x, y + chartH - h, barW - 4, h);
    });
    y += chartH + 16;

    const kept = history.filter((d) => d.count === 5).length;
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 21px Inter, sans-serif';
    p.ctx.fillText(`${kept} complete days in the last 28 · ${history.reduce((s, d) => s + d.count, 0)} prayers logged`, 50, y);
    y += 42;

    p.button('export', 'Copy my data', 50, y, (p.W - 110) / 2, 54, {
      font: '600 21px Inter, sans-serif',
      onSelect: () => this.exportData(),
    });
    p.button('reset', 'Erase everything', 50 + (p.W - 110) / 2 + 10, y, (p.W - 110) / 2, 54, {
      font: '600 21px Inter, sans-serif', danger: true,
      onSelect: () => this.confirmReset(),
    });
  }

  async exportData() {
    const json = this.store.export();
    try {
      await navigator.clipboard.writeText(json);
      this.app.toast('Your data is on the clipboard');
    } catch {
      console.log(json);
      this.app.toast('Clipboard blocked — the data was printed to the console');
    }
  }

  confirmReset() {
    if (this.pendingReset) {
      this.store.reset();
      this.pendingReset = false;
      this.app.toast('All local data erased');
      this.refresh();
      return;
    }
    this.pendingReset = true;
    this.app.toast('Select again to erase every log, bookmark and setting');
    setTimeout(() => { this.pendingReset = false; }, 6000);
  }

  tick() { this.refresh(); }
}

export { Store };
