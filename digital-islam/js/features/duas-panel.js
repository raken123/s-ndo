/** Du'a collection, browsable by category, with favourites and a read-aloud. */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { DUA_CATEGORIES, ALL_DUAS } from '../data/duas.js';

export class DuasPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.0, height: 0.78, name: 'duas', distance: 1.15 });
    this.category = DUA_CATEGORIES[0].key;
    this.index = 0;
  }

  get items() {
    if (this.category === 'favourites') {
      const ids = this.store.get('progress.duaFavourites', []);
      return ALL_DUAS.filter((d) => ids.includes(d.id));
    }
    return ALL_DUAS.filter((d) => d.category === this.category);
  }

  render(p) {
    let y = p.title('Du\'a', 'Supplications for the day');

    // Category chips.
    const chips = [...DUA_CATEGORIES.map((c) => ({ key: c.key, label: `${c.icon} ${c.label}` })),
      { key: 'favourites', label: '★ Favourites' }];
    let x = 46;
    let chipY = y;
    for (const chip of chips) {
      p.ctx.font = '500 20px Inter, sans-serif';
      const w = p.ctx.measureText(chip.label).width + 36;
      if (x + w > p.W - 46) { x = 46; chipY += 52; }
      p.button(`cat-${chip.key}`, chip.label, x, chipY, w, 44, {
        active: this.category === chip.key, radius: 22, font: '500 20px Inter, sans-serif',
        onSelect: () => { this.category = chip.key; this.index = 0; },
      });
      x += w + 8;
    }
    y = chipY + 62;

    const items = this.items;
    if (!items.length) {
      p.text('Nothing saved here yet — open a du\'a and tap the star.', 50, y,
        { color: THEME.muted, font: '400 22px Inter, sans-serif' });
      return;
    }

    const dua = items[Math.min(this.index, items.length - 1)];
    const favourites = this.store.get('progress.duaFavourites', []);
    const isFavourite = favourites.includes(dua.id);

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 30px Inter, sans-serif';
    p.ctx.fillText(dua.title, 50, y);
    y += 48;

    y = p.arabic(dua.arabic, 50, y, { size: 44, maxWidth: p.W - 100 }) + 18;
    y = p.text(dua.translit, 50, y, {
      color: THEME.goldDim, font: 'italic 400 23px Inter, sans-serif', lineHeight: 31,
    }) + 14;
    y = p.text(dua.meaning, 50, y, {
      color: THEME.ink, font: '400 24px Inter, sans-serif', lineHeight: 32,
    }) + 12;

    if (dua.source) {
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 20px Inter, sans-serif';
      p.ctx.fillText(dua.source, 50, y);
      y += 34;
    }

    const bw = (p.W - 120) / 4;
    const rowY = p.H - 96;
    p.button('prev', '‹', 50, rowY, bw * 0.7, 60, {
      onSelect: () => { this.index = (this.index - 1 + items.length) % items.length; },
    });
    p.button('say', 'Read aloud', 50 + bw * 0.7 + 10, rowY, bw * 1.4, 60, {
      font: '600 22px Inter, sans-serif',
      onSelect: () => this.app.audio.say(`${dua.title}. ${dua.meaning}`),
    });
    p.button('fav', isFavourite ? '★ Saved' : '☆ Save', 50 + bw * 2.1 + 20, rowY, bw * 1.2, 60, {
      active: isFavourite, font: '600 22px Inter, sans-serif',
      onSelect: () => {
        const next = isFavourite
          ? favourites.filter((id) => id !== dua.id)
          : [...favourites, dua.id];
        this.store.set('progress.duaFavourites', next);
        this.app.audio.click();
      },
    });
    p.button('next', '›', p.W - 50 - bw * 0.7, rowY, bw * 0.7, 60, {
      onSelect: () => { this.index = (this.index + 1) % items.length; },
    });

    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 19px Inter, sans-serif';
    p.ctx.textAlign = 'center';
    p.ctx.fillText(`${this.index + 1} of ${items.length}`, p.W / 2, p.H - 26);
    p.ctx.textAlign = 'left';
  }
}
