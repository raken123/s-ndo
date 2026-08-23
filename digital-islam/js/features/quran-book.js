/**
 * The Qur'an as a physical book.
 *
 * A bound volume you can pick up, hold, and turn page by page. Each spread is
 * laid out like a mushaf page: Arabic flowing right to left with circled ayah
 * markers, and the meaning set underneath in a smaller face. Pagination is
 * measured from the real text, so pages fill properly at any font size.
 */

import * as THREE from 'three';
import { Panel, THEME, wrap } from '../core/panel.js';
import { bookCoverTexture, paperTexture } from '../core/patterns.js';
import { surah as surahMeta, juzOf } from '../data/surahs.js';
import {
  loadSurah, peekSurah, ayahAudioUrl, hasBasmala, BASMALA_TEXT, RECITERS,
} from '../data/quran.js';

const PAGE_W = 0.32;   // metres — a large mushaf, sized to read at arm's length
const PAGE_H = 0.44;
const PPM = 1700;

const INK = '#241a10';
const INK_SOFT = '#6b5b45';
const GOLD = '#9a7b34';

export class QuranBook {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.surahNumber = this.store.get('progress.lastRead.surah', 1);
    this.pageIndex = 0;
    this.pages = [];          // [{ items: [...] }, ...]
    this.data = null;
    this.selectedAyah = null;
    this.playingAyah = null;
    this.hifzMode = false;
    this.loading = false;

    this.group = new THREE.Group();
    this.group.name = 'quran-book';
    this.group.visible = false;
    this._build();
    this.engine.add(this);
  }

  // ---- geometry ------------------------------------------------------------

  _build() {
    const coverMaterial = new THREE.MeshStandardMaterial({
      map: bookCoverTexture(), roughness: 0.65, metalness: 0.08,
    });
    const spineMaterial = new THREE.MeshStandardMaterial({ color: 0x2e1b12, roughness: 0.7 });
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c9a4, roughness: 0.9 });

    // Two covers, hinged open at the spine.
    this.leftCover = new THREE.Mesh(
      new THREE.BoxGeometry(PAGE_W + 0.02, 0.018, PAGE_H + 0.02),
      [spineMaterial, spineMaterial, coverMaterial, coverMaterial, edgeMaterial, edgeMaterial],
    );
    this.leftCover.position.set(-(PAGE_W + 0.02) / 2, -0.011, 0);
    this.leftCover.castShadow = true;

    this.rightCover = this.leftCover.clone();
    this.rightCover.position.x = (PAGE_W + 0.02) / 2;

    this.group.add(this.leftCover, this.rightCover);

    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, PAGE_H + 0.02, 12, 1, false, 0, Math.PI),
      spineMaterial,
    );
    spine.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    spine.position.y = -0.012;
    this.group.add(spine);

    // Paper block under each page, to give thickness.
    const paper = paperTexture();
    const blockMaterial = new THREE.MeshStandardMaterial({ map: paper, roughness: 0.95 });
    for (const sign of [-1, 1]) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(PAGE_W, 0.012, PAGE_H),
        blockMaterial,
      );
      block.position.set(sign * PAGE_W / 2, -0.002, 0);
      block.receiveShadow = true;
      this.group.add(block);
    }

    // The two live pages.
    this.leftPage = new Panel({ width: PAGE_W, height: PAGE_H, ppm: PPM, skin: 'paper', name: 'page-left' });
    this.rightPage = new Panel({ width: PAGE_W, height: PAGE_H, ppm: PPM, skin: 'paper', name: 'page-right' });
    for (const [page, sign] of [[this.leftPage, -1], [this.rightPage, 1]]) {
      page.mesh.rotation.x = -Math.PI / 2;
      page.mesh.position.set(sign * PAGE_W / 2, 0.005, 0);
      page.mesh.renderOrder = 1;
      this.group.add(page.mesh);
      this.app.interaction.register(page.mesh);
    }
    this.leftPage.render = (p) => this._renderPage(p, 'left');
    this.rightPage.render = (p) => this._renderPage(p, 'right');

    // The sheet that flips during a page turn.
    this.turnPage = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_W, PAGE_H),
      new THREE.MeshStandardMaterial({ map: paper, roughness: 0.95, side: THREE.DoubleSide }),
    );
    this.turnPage.rotation.x = -Math.PI / 2;
    this.turnPage.visible = false;
    this.turnPivot = new THREE.Group();
    this.turnPivot.add(this.turnPage);
    this.turnPage.position.x = PAGE_W / 2;
    this.turnPivot.position.y = 0.008;
    this.group.add(this.turnPivot);

    // The rihal: two crossed slats the book rests on.
    this.stand = new THREE.Group();
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.75 });
    for (const sign of [-1, 1]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.30, 0.05), woodMaterial);
      slat.position.set(sign * PAGE_W * 0.62, -0.15, 0);
      slat.rotation.z = sign * 0.42;
      slat.castShadow = true;
      this.stand.add(slat);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W * 1.35, 0.014, 0.05), woodMaterial);
    rail.position.y = -0.03;
    this.stand.add(rail);
    this.stand.position.y = -0.02;
    this.group.add(this.stand);

    // A ribbon bookmark hanging from the spine.
    this.ribbon = new THREE.Mesh(
      new THREE.PlaneGeometry(0.014, PAGE_H * 0.62),
      new THREE.MeshStandardMaterial({ color: 0x9c2f3a, side: THREE.DoubleSide, roughness: 0.8 }),
    );
    this.ribbon.rotation.x = -Math.PI / 2;
    this.ribbon.position.set(0.02, 0.007, PAGE_H * 0.16);
    this.group.add(this.ribbon);

    // Page-turn hot zones at the outer edge of each page.
    for (const sign of [-1, 1]) {
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, PAGE_H),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(sign * (PAGE_W - 0.02), 0.008, 0);
      zone.userData.onSelect = () => (sign > 0 ? this.prevPage() : this.nextPage());
      this.group.add(zone);
      this.app.interaction.register(zone);
    }

    this._buildControls();

    this.app.interaction.registerGrabbable(this.group, {
      onGrab: () => this.app.toast('Holding the Qur\'an — release to set it down'),
    });
  }

  /** The strip of controls standing along the top edge of the book. */
  _buildControls() {
    this.controls = new Panel({ width: PAGE_W * 2.05, height: 0.105, ppm: 2000, name: 'book-controls' });
    this.controls.render = (p) => this._renderControls(p);
    // Stands just past the top edge of the pages, leaning back towards upright
    // once the book's own tilt is taken into account.
    this.controls.mesh.position.set(0, 0.045, -PAGE_H / 2 - 0.02);
    this.controls.mesh.rotation.x = -0.55;
    this.group.add(this.controls.mesh);
    this.app.interaction.register(this.controls.mesh);
  }

  _renderControls(p) {
    const meta = surahMeta(this.surahNumber);
    const selected = this.selectedAyah;
    const reciting = this.app.audio.isReciting;

    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 30px Inter, sans-serif';
    p.ctx.textBaseline = 'middle';
    p.ctx.fillText(`${meta.number}. ${meta.name}`, 30, p.H / 2);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.fillText(selected ? `Ayah ${selected} selected` : `${meta.ayahs} ayahs`, 30, p.H / 2 + 32);
    p.ctx.textBaseline = 'top';

    const buttons = [
      ['prev', '‹', () => this.prevPage()],
      ['play', reciting ? '■' : '▶', () => (reciting ? this.stop() : this.playFrom(selected || this._firstAyahOnPage()))],
      ['next', '›', () => this.nextPage()],
      ['bookmark', selected && this.store.isBookmarked(this.surahNumber, selected) ? '🔖' : '☆',
        () => this._bookmarkSelected()],
      ['hifz', 'ح', () => this._toggleHifz()],
      ['library', '🗂', () => this.app.openFeature('library')],
    ];

    const bw = 92;
    const startX = p.W - 30 - buttons.length * (bw + 8);
    buttons.forEach(([id, label, onSelect], i) => {
      p.button(id, label, startX + i * (bw + 8), 22, bw, p.H - 44, {
        font: '600 34px Inter, "Noto Color Emoji", sans-serif',
        active: (id === 'play' && reciting) || (id === 'hifz' && this.hifzMode),
        onSelect,
      });
    });
  }

  _firstAyahOnPage() {
    return this.pages[this.pageIndex]?.items.find((i) => i.ayah)?.ayah?.number || 1;
  }

  _bookmarkSelected() {
    const ayah = this.selectedAyah || this._firstAyahOnPage();
    const added = this.store.toggleBookmark(this.surahNumber, ayah);
    this.app.toast(added
      ? `Bookmarked ${surahMeta(this.surahNumber).name} ${this.surahNumber}:${ayah}`
      : 'Bookmark removed');
    this._refresh();
  }

  _toggleHifz() {
    this.hifzMode = !this.hifzMode;
    this.app.toast(this.hifzMode
      ? 'Hifz mode — memorised ayahs are hidden; select one to reveal it'
      : 'Hifz mode off');
    if (this.selectedAyah) {
      this.store.toggleMemorized(`${this.surahNumber}:${this.selectedAyah}`);
    }
    this._refresh();
  }

  // ---- content -------------------------------------------------------------

  async open(surahNumber, ayahNumber = 1) {
    this.surahNumber = surahNumber;
    const translation = this.store.get('settings.translation', 'en');

    // Paint whatever is already on the device straight away, so the book is
    // never blank while the network is thinking.
    const immediate = peekSurah(surahNumber, translation);
    this.loading = !immediate;
    if (immediate) {
      this.data = immediate;
      this._paginate();
    }
    this._refresh();

    const fetched = await loadSurah(surahNumber, { translation });
    if (this.surahNumber !== surahNumber) return this.data;   // the reader moved on
    this.data = fetched;
    this.loading = false;
    this._paginate();

    this.pageIndex = Math.max(0, this.pages.findIndex(
      (p) => p.items.some((it) => it.ayah?.number >= ayahNumber),
    ));
    this.store.set('progress.lastRead', { surah: surahNumber, ayah: ayahNumber });
    this._refresh();
    this.app.dispatchEvent?.(new CustomEvent('bookchanged'));
    return this.data;
  }

  /**
   * Lay the surah out into pages.
   *
   * Wrapping is done once, here, and the wrapped lines are what the renderer
   * draws — so the height a block is measured at is exactly the height it takes
   * on the page, and nothing can overlap.
   */
  _paginate() {
    if (!this.data) return;   // nothing loaded yet — settings changed before the first open
    const ctx = this.rightPage.ctx;
    const scale = this.store.get('settings.arabicSize', 1);
    const showTranslit = this.store.get('settings.showTransliteration', true);
    const showTranslation = this.store.get('settings.translation', 'en') !== 'none';

    const contentW = this.rightPage.W - 130;
    const arabicSize = Math.round(38 * scale);
    const arabicLine = Math.round(arabicSize * 1.75);
    const translitLine = 28;
    const translationLine = 30;
    const usable = this.rightPage.H - 215;

    const arabicFont = `400 ${arabicSize}px Amiri, "Noto Naskh Arabic", serif`;
    const translitFont = 'italic 400 23px Inter, sans-serif';
    const translationFont = '400 25px Inter, sans-serif';

    this.metrics = { arabicSize, arabicLine, translitLine, translationLine, contentW,
      arabicFont, translitFont, translationFont };

    const pages = [];
    let current = { items: [] };
    let used = 0;
    const push = (item) => {
      if (used + item.height > usable && current.items.length) {
        pages.push(current);
        current = { items: [] };
        used = 0;
      }
      current.items.push(item);
      used += item.height;
    };

    if (hasBasmala(this.surahNumber)) {
      push({ type: 'basmala', height: arabicLine + 34 });
    }

    for (const ayah of this.data.ayahs) {
      ctx.font = arabicFont;
      const arabicLines = wrap(ctx, ayah.arabic, contentW - 70); // room for the rosette
      let height = arabicLines.length * arabicLine + 14;

      let translitLines = [];
      if (showTranslit && ayah.translit) {
        ctx.font = translitFont;
        translitLines = wrap(ctx, ayah.translit, contentW);
        height += translitLines.length * translitLine + 8;
      }

      let translationLines = [];
      if (showTranslation && ayah.translation) {
        ctx.font = translationFont;
        translationLines = wrap(ctx, ayah.translation, contentW);
        height += translationLines.length * translationLine + 18;
      }

      push({ type: 'ayah', ayah, arabicLines, translitLines, translationLines, height });
    }

    if (current.items.length) pages.push(current);
    if (!pages.length) pages.push({ items: [] });
    // Spreads read right page first, so keep an even count.
    if (pages.length % 2 === 1) pages.push({ items: [] });
    this.pages = pages;
  }

  _renderPage(panel, side) {
    const meta = surahMeta(this.surahNumber);
    // The right page of a spread is the earlier one — a mushaf opens right to left.
    const index = side === 'right' ? this.pageIndex : this.pageIndex + 1;
    const page = this.pages[index];
    const ctx = panel.ctx;

    this._renderPageHeader(panel, side, meta, page);

    if (this.loading) {
      panel.text('Loading…', 60, panel.H / 2 - 20, {
        color: INK_SOFT, font: '500 30px Inter, sans-serif',
      });
      return;
    }
    if (!page || !this.metrics) return;

    const m = this.metrics;
    let y = 140;

    for (const item of page.items) {
      if (item.type === 'basmala') {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.fillStyle = GOLD;
        ctx.font = `400 ${Math.round(m.arabicSize * 0.95)}px Amiri, "Noto Naskh Arabic", serif`;
        ctx.fillText(BASMALA_TEXT, panel.W / 2, y);
        ctx.restore();
        ctx.textAlign = 'left';
        y += item.height;
        continue;
      }

      const { ayah } = item;
      const ref = `${this.surahNumber}:${ayah.number}`;
      const playing = this.playingAyah === ayah.number;
      const selected = this.selectedAyah === ayah.number;
      const memorised = this.store.get('progress.memorized', []).includes(ref);
      const hidden = this.hifzMode && memorised && !selected;

      if (playing || selected) {
        ctx.fillStyle = playing ? 'rgba(216,180,106,0.30)' : 'rgba(46,156,125,0.16)';
        ctx.fillRect(48, y - 12, panel.W - 96, item.height);
      }

      // Arabic, right aligned, with the ayah rosette after the last line.
      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = INK;
      ctx.font = m.arabicFont;
      const lines = hidden ? ['• • • • • • •'] : item.arabicLines;
      lines.forEach((line, i) => ctx.fillText(line, panel.W - 65, y + i * m.arabicLine));
      ctx.restore();
      ctx.textAlign = 'left';

      const lastLineY = y + (lines.length - 1) * m.arabicLine + m.arabicSize * 0.45;
      this._rosette(ctx, 92, lastLineY, ayah.number);

      let localY = y + lines.length * m.arabicLine + 14;

      if (item.translitLines.length && !hidden) {
        ctx.font = m.translitFont;
        ctx.fillStyle = GOLD;
        item.translitLines.forEach((line, i) => ctx.fillText(line, 65, localY + i * m.translitLine));
        localY += item.translitLines.length * m.translitLine + 8;
      }
      if (item.translationLines.length && !hidden) {
        ctx.font = m.translationFont;
        ctx.fillStyle = INK_SOFT;
        item.translationLines.forEach((line, i) => ctx.fillText(line, 65, localY + i * m.translationLine));
      }

      if (this.store.isBookmarked(this.surahNumber, ayah.number)) {
        ctx.fillStyle = '#9c2f3a';
        ctx.beginPath();
        ctx.moveTo(30, y - 8);
        ctx.lineTo(44, y - 8);
        ctx.lineTo(44, y + 32);
        ctx.lineTo(37, y + 24);
        ctx.lineTo(30, y + 32);
        ctx.closePath();
        ctx.fill();
      }

      panel.hitRects.push({
        id: `ayah-${ayah.number}`,
        x: 40, y: y - 12, w: panel.W - 80, h: item.height,
        kind: 'ayah',
        onSelect: () => this.selectAyah(ayah.number),
      });

      y += item.height;
    }

    // Footer: which page of the surah this is.
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_SOFT;
    ctx.font = '500 22px Inter, sans-serif';
    ctx.fillText(`${index + 1} / ${this.pages.length}`, panel.W / 2, panel.H - 58);
    ctx.textAlign = 'left';
  }

  _renderPageHeader(panel, side, meta, page) {
    const ctx = panel.ctx;
    ctx.textBaseline = 'top';
    ctx.font = '600 26px Inter, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = side === 'right' ? 'right' : 'left';
    ctx.fillText(`${meta.number}. ${meta.name}`, side === 'right' ? panel.W - 60 : 60, 46);

    ctx.textAlign = side === 'right' ? 'left' : 'right';
    ctx.fillStyle = INK_SOFT;
    ctx.font = '500 24px Inter, sans-serif';
    const first = page?.items.find((i) => i.ayah)?.ayah?.number || 1;
    ctx.fillText(`Juz' ${juzOf(this.surahNumber, first)}`, side === 'right' ? 60 : panel.W - 60, 46);

    ctx.strokeStyle = 'rgba(154,123,52,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(56, 96);
    ctx.lineTo(panel.W - 56, 96);
    ctx.stroke();
    ctx.textAlign = 'left';
  }

  /** The gold rosette printed after each ayah in a mushaf. */
  _rosette(ctx, x, y, number) {
    const r = 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(Math.cos((i / 8) * Math.PI * 2) * r * 0.72,
        Math.sin((i / 8) * Math.PI * 2) * r * 0.72, r * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250,244,228,0.95)';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = '600 20px Amiri, "Noto Naskh Arabic", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toArabicDigits(number), 0, 1);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  _refresh() {
    this.leftPage.refresh();
    this.rightPage.refresh();
    this.controls?.refresh();
  }

  // ---- navigation ----------------------------------------------------------

  nextPage() {
    if (this.pageIndex + 2 >= this.pages.length) {
      if (this.surahNumber < 114) return this.open(this.surahNumber + 1);
      return null;
    }
    this.pageIndex += 2;
    this._animateTurn(1);
    this._refresh();
    this._rememberPosition();
    return this.pageIndex;
  }

  prevPage() {
    if (this.pageIndex === 0) {
      if (this.surahNumber > 1) return this.open(this.surahNumber - 1);
      return null;
    }
    this.pageIndex -= 2;
    this._animateTurn(-1);
    this._refresh();
    this._rememberPosition();
    return this.pageIndex;
  }

  _rememberPosition() {
    const firstAyah = this.pages[this.pageIndex]?.items.find((i) => i.ayah)?.ayah?.number || 1;
    this.store.set('progress.lastRead', { surah: this.surahNumber, ayah: firstAyah });
  }

  _animateTurn(direction) {
    this.turn = { t: 0, direction };
    this.turnPage.visible = true;
    this.app.audio.tone(direction > 0 ? 520 : 460, 0.12, 0.06, 'triangle');
  }

  selectAyah(number) {
    this.selectedAyah = this.selectedAyah === number ? null : number;
    this._refresh();
    this.app.dispatchEvent?.(new CustomEvent('ayahselected', {
      detail: { surah: this.surahNumber, ayah: this.selectedAyah },
    }));
    return this.selectedAyah;
  }

  // ---- recitation ----------------------------------------------------------

  playFrom(ayahNumber = 1, { toEndOfSurah = true } = {}) {
    if (!this.data) return;
    const reciter = this.store.get('settings.reciter', 'alafasy');
    const list = this.data.ayahs.filter((a) => a.number >= ayahNumber);
    const chosen = toEndOfSurah ? list : list.slice(0, 1);
    const urls = chosen.map((a) => ayahAudioUrl(this.surahNumber, a.number, reciter));

    this.app.audio.playSequence(
      urls,
      (i) => {
        this.playingAyah = chosen[i].number;
        this._ensureAyahVisible(this.playingAyah);
        this._refresh();
        const read = this.store.get('progress.quranReadAyahs', 0);
        this.store.set('progress.quranReadAyahs', read + 1);
      },
      (err) => {
        this.playingAyah = null;
        this._refresh();
        if (err) this.app.toast('Recitation needs an internet connection.');
      },
    );
    this.app.toast(`Reciting ${surahMeta(this.surahNumber).name} — ${RECITERS[reciter].name}`);
  }

  stop() {
    this.app.audio.stopRecitation();
    this.playingAyah = null;
    this._refresh();
  }

  /** Turn to whichever spread contains an ayah. */
  _ensureAyahVisible(ayahNumber) {
    const index = this.pages.findIndex((p) => p.items.some((i) => i.ayah?.number === ayahNumber));
    if (index < 0) return;
    const spread = index % 2 === 0 ? index : index - 1;
    if (spread !== this.pageIndex) {
      this.pageIndex = spread;
      this._animateTurn(1);
    }
  }

  // ---- placement -----------------------------------------------------------

  show(parent) {
    (parent || this.engine.stage).add(this.group);
    this.group.visible = true;
    if (!this.data) this.open(this.surahNumber, this.store.get('progress.lastRead.ayah', 1));
    else this._refresh();
  }

  hide() {
    this.stop();
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  /**
   * Rest the book on its stand in front of the reader. The far edge lifts, the
   * way a rihal holds a mushaf, so the page faces the eye rather than the
   * ceiling. Yaw is applied first so the tilt happens about the book's own
   * left-right axis.
   */
  placeOnLectern(position, yaw = 0) {
    this.group.position.copy(position);
    this.group.rotation.set(0.42, yaw, 0, 'YXZ');
  }

  update(dt) {
    if (!this.turn) return;
    this.turn.t += dt * 2.6;
    const t = Math.min(1, this.turn.t);
    const eased = t * t * (3 - 2 * t);
    this.turnPivot.rotation.z = this.turn.direction > 0
      ? -Math.PI * eased
      : -Math.PI * (1 - eased);
    if (t >= 1) {
      this.turn = null;
      this.turnPage.visible = false;
      this.turnPivot.rotation.z = 0;
    }
  }

  dispose() {
    this.app.interaction.unregister(this.leftPage.mesh);
    this.app.interaction.unregister(this.rightPage.mesh);
    this.app.interaction.unregister(this.controls.mesh);
    this.controls.dispose();
    this.app.interaction.unregisterGrabbable(this.group);
    this.leftPage.dispose();
    this.rightPage.dispose();
    this.engine.remove(this);
  }
}

/** 1 -> ١٢٣ style numerals for the ayah markers. */
export function toArabicDigits(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}
