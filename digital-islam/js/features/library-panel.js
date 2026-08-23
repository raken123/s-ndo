/**
 * The Qur'an library: pick a surah, jump by juz', reach your bookmarks and
 * last-read position, choose reciter and translation, and download surahs for
 * offline reading.
 */

import { PanelFeature } from '../core/panel-feature.js';
import { THEME } from '../core/panel.js';
import { JUZ_STARTS, surah as surahMeta } from '../data/surahs.js';
import {
  RECITERS, TRANSLATION_EDITIONS, offlineAvailability, downloadForOffline, clearOfflineCache,
} from '../data/quran.js';

const TABS = [
  { key: 'surahs', label: 'Surahs' },
  { key: 'juz', label: "Juz'" },
  { key: 'saved', label: 'Saved' },
  { key: 'audio', label: 'Audio & text' },
];

export class LibraryPanel extends PanelFeature {
  constructor(app) {
    super(app, { width: 1.0, height: 0.8, name: 'library', distance: 1.15 });
    this.tab = 'surahs';
    this.downloading = null;
  }

  render(p) {
    const last = this.store.get('progress.lastRead');
    let y = p.title('Qur\'an', `Last read: ${surahMeta(last.surah)?.name} ${last.surah}:${last.ayah}`);

    const tabW = (p.W - 92) / TABS.length;
    TABS.forEach((tab, i) => {
      p.button(`tab-${tab.key}`, tab.label, 46 + i * tabW, y, tabW - 8, 54, {
        active: this.tab === tab.key,
        font: '600 22px Inter, sans-serif',
        onSelect: () => { this.tab = tab.key; this.panel.scroll = 0; },
      });
    });
    y += 72;

    switch (this.tab) {
      case 'juz': this._renderJuz(p, y); break;
      case 'saved': this._renderSaved(p, y); break;
      case 'audio': this._renderAudio(p, y); break;
      default: this._renderSurahs(p, y);
    }
  }

  _renderSurahs(p, y) {
    const list = offlineAvailability();
    const rowH = 56;
    const viewH = p.H - y - 30;
    const visible = Math.floor(viewH / rowH);
    const start = Math.floor(this.panel.scroll / rowH);

    for (let i = start; i < Math.min(list.length, start + visible); i++) {
      const s = list[i];
      const rowY = y + (i - start) * rowH;
      const isCurrent = this.app.book?.surahNumber === s.number;

      p.button(`surah-${s.number}`, '', 46, rowY, p.W - 92, rowH - 6, {
        active: isCurrent, radius: 10,
        onSelect: () => this.openSurah(s.number),
      });

      p.ctx.fillStyle = THEME.goldDim;
      p.ctx.font = '600 22px Inter, sans-serif';
      p.ctx.textBaseline = 'middle';
      p.ctx.fillText(String(s.number).padStart(3, ' '), 66, rowY + rowH / 2 - 3);

      p.ctx.fillStyle = THEME.ink;
      p.ctx.font = '600 25px Inter, sans-serif';
      p.ctx.fillText(s.name, 128, rowY + rowH / 2 - 3);

      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 20px Inter, sans-serif';
      p.ctx.fillText(`${s.ayahs} ayahs · ${s.place}`, 400, rowY + rowH / 2 - 3);

      p.ctx.direction = 'rtl';
      p.ctx.textAlign = 'right';
      p.ctx.fillStyle = THEME.gold;
      p.ctx.font = '400 30px Amiri, "Noto Naskh Arabic", serif';
      p.ctx.fillText(s.arabic, p.W - 120, rowY + rowH / 2 - 3);
      p.ctx.direction = 'ltr';
      p.ctx.textAlign = 'left';

      if (s.offline) {
        p.ctx.fillStyle = THEME.green;
        p.ctx.font = '500 18px Inter, sans-serif';
        p.ctx.fillText('offline', p.W - 106, rowY + rowH / 2 - 3);
      }
      p.ctx.textBaseline = 'top';
    }

    this.panel.scrollbar(list.length * rowH, viewH, y);
  }

  _renderJuz(p, y) {
    const cols = 3;
    const cellW = (p.W - 92) / cols;
    JUZ_STARTS.forEach(([s, a], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      p.button(`juz-${i}`, `Juz' ${i + 1}`, 46 + col * cellW, y + row * 62, cellW - 10, 54, {
        font: '600 22px Inter, sans-serif',
        onSelect: () => this.openSurah(s, a),
      });
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 17px Inter, sans-serif';
      p.ctx.fillText(`${surahMeta(s).name} ${a}`, 60 + col * cellW, y + row * 62 + 34);
    });
  }

  _renderSaved(p, y) {
    const bookmarks = this.store.get('progress.bookmarks', []);
    const memorised = this.store.get('progress.memorized', []);

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText(`Bookmarks (${bookmarks.length})`, 50, y);
    y += 40;

    if (!bookmarks.length) {
      y = p.text('Select an ayah in the book and bookmark it — it will be listed here.',
        50, y, { color: THEME.muted, font: '400 21px Inter, sans-serif', lineHeight: 28 }) + 16;
    }
    for (const bookmark of bookmarks.slice(0, 6)) {
      p.button(`bm-${bookmark.surah}-${bookmark.ayah}`,
        `${surahMeta(bookmark.surah)?.name} ${bookmark.surah}:${bookmark.ayah}`,
        50, y, p.W - 100, 50, {
          font: '500 22px Inter, sans-serif',
          onSelect: () => this.openSurah(bookmark.surah, bookmark.ayah),
        });
      y += 58;
    }

    y = p.divider(y + 8) + 16;
    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText(`Memorisation (${memorised.length} ayahs)`, 50, y);
    y += 40;

    p.toggle('hifz', 'Hide memorised ayahs while reading', !!this.app.book?.hifzMode, 50, y, p.W - 100, () => {
      if (!this.app.book) return;
      this.app.book.hifzMode = !this.app.book.hifzMode;
      this.app.book._refresh();
      this.app.toast(this.app.book.hifzMode
        ? 'Hifz mode: memorised ayahs are hidden — select one to reveal it'
        : 'Hifz mode off');
    });
    y += 76;

    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '400 21px Inter, sans-serif';
    p.ctx.fillText(`Read this session: ${this.store.get('progress.quranReadAyahs', 0)} ayahs recited`, 50, y);
  }

  _renderAudio(p, y) {
    const reciterKeys = Object.keys(RECITERS);
    const current = this.store.get('settings.reciter');

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText('Reciter', 50, y);
    y += 38;

    const cols = 2;
    const cellW = (p.W - 100) / cols;
    reciterKeys.forEach((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      p.button(`rec-${key}`, RECITERS[key].name, 50 + col * cellW, y + row * 60, cellW - 10, 52, {
        active: current === key, font: '500 21px Inter, sans-serif',
        onSelect: () => { this.store.set('settings.reciter', key); this.refresh(); },
      });
    });
    y += Math.ceil(reciterKeys.length / cols) * 60 + 14;

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '600 25px Inter, sans-serif';
    p.ctx.fillText('Translation', 50, y);
    y += 38;

    const translationKeys = Object.keys(TRANSLATION_EDITIONS);
    const currentTranslation = this.store.get('settings.translation');
    translationKeys.forEach((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      p.button(`tr-${key}`, TRANSLATION_EDITIONS[key].label, 50 + col * cellW, y + row * 56, cellW - 10, 48, {
        active: currentTranslation === key, font: '500 20px Inter, sans-serif',
        onSelect: () => {
          this.store.set('settings.translation', key);
          this.app.book?.open(this.app.book.surahNumber);
          this.refresh();
        },
      });
    });
    y += Math.ceil(translationKeys.length / cols) * 56 + 16;

    y = p.slider('size', 'Arabic size', this.store.get('settings.arabicSize', 1), 0.8, 1.8, 50, y, p.W - 100,
      (v) => {
        this.store.set('settings.arabicSize', v);
        this.app.book?._paginate();
        this.app.book?._refresh();
      }, (v) => `${Math.round(v * 100)}%`) + 10;

    p.toggle('translit', 'Show transliteration', this.store.get('settings.showTransliteration'), 50, y, p.W - 100, () => {
      this.store.toggle('settings.showTransliteration');
      this.app.book?._paginate();
      this.app.book?._refresh();
    });
    y += 76;

    const bw = (p.W - 110) / 2;
    p.button('download', this.downloading
      ? `Downloading ${this.downloading.done}/${this.downloading.total}…`
      : 'Download Juz\' Amma offline', 50, y, bw, 58, {
      font: '600 21px Inter, sans-serif',
      onSelect: () => this.downloadJuzAmma(),
    });
    p.button('clear', 'Clear downloads', 50 + bw + 10, y, bw, 58, {
      font: '600 21px Inter, sans-serif', danger: true,
      onSelect: () => {
        clearOfflineCache();
        this.app.toast('Downloaded surahs cleared');
        this.refresh();
      },
    });
  }

  async downloadJuzAmma() {
    if (this.downloading) return;
    const numbers = [];
    for (let n = 78; n <= 114; n++) numbers.push(n);
    this.downloading = { done: 0, total: numbers.length };
    this.refresh();

    await downloadForOffline(numbers, this.store.get('settings.translation'), (done, total) => {
      this.downloading = { done, total };
      this.refresh();
    });

    this.downloading = null;
    this.app.toast('Juz\' Amma is now available offline');
    this.app.audio.success();
    this.refresh();
  }

  openSurah(number, ayah = 1) {
    this.app.openBookAt(number, ayah);
    this.app.audio.click();
  }
}
