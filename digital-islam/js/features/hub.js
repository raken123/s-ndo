/**
 * The hub: a curved menu of everything in the app, plus a wrist watch that
 * follows your left hand and shows the time to the next prayer without opening
 * anything.
 */

import * as THREE from 'three';
import { Panel, THEME } from '../core/panel.js';
import { formatCountdown, formatTime, PRAYER_LABELS } from '../core/prayer-times.js';
import { toHijri } from '../core/hijri.js';

export const MENU = [
  { key: 'book', icon: '📖', label: 'Qur\'an', hint: 'Open the book' },
  { key: 'library', icon: '🗂️', label: 'Library', hint: 'Surahs, juz\', bookmarks' },
  { key: 'qibla', icon: '🧭', label: 'Qibla', hint: 'Direction & distance' },
  { key: 'mat', icon: '🕌', label: 'Prayer mat', hint: 'Lay it on your floor' },
  { key: 'times', icon: '🕐', label: 'Prayer times', hint: 'Today & countdown' },
  { key: 'guide', icon: '🤲', label: 'Guided prayer', hint: 'Step by step' },
  { key: 'tasbih', icon: '📿', label: 'Tasbih', hint: 'Count dhikr' },
  { key: 'names', icon: '✨', label: '99 Names', hint: 'Al-Asma\' al-Husna' },
  { key: 'kaaba', icon: '🕋', label: 'Kaaba', hint: 'Model & tawaf' },
  { key: 'calendar', icon: '🗓️', label: 'Calendar', hint: 'Hijri & Ramadan' },
  { key: 'duas', icon: '🙏', label: 'Du\'a', hint: 'For every occasion' },
  { key: 'learn', icon: '🎓', label: 'Learn', hint: 'Wudu, prayers, quiz' },
  { key: 'zakat', icon: '💰', label: 'Zakat', hint: 'Work out what is due' },
  { key: 'stats', icon: '📊', label: 'Progress', hint: 'Streaks & history' },
  { key: 'settings', icon: '⚙️', label: 'Settings', hint: 'Scene, sound, place' },
  { key: 'exit', icon: '🚪', label: 'Leave', hint: 'End the session' },
];

export class Hub {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.store = app.store;

    this.group = new THREE.Group();
    this.group.name = 'hub';
    this.panel = new Panel({ width: 1.25, height: 0.82, ppm: 1150, name: 'hub-panel', curve: 0.9 });
    this.panel.render = (p) => this._render(p);
    this.group.add(this.panel.mesh);
    this.app.interaction.register(this.panel.mesh);
    this.group.visible = false;

    this._buildWatch();
    this.engine.add(this);
  }

  /** A small always-available readout parented to a controller. */
  _buildWatch() {
    this.watch = new Panel({ width: 0.15, height: 0.09, ppm: 1600, name: 'watch' });
    this.watch.render = (p) => this._renderWatch(p);
    this.watch.mesh.rotation.set(-Math.PI / 2.6, 0, 0);
    this.watch.mesh.position.set(0, 0.03, 0.06);
    this.watch.mesh.userData.onSelect = () => this.toggle();
    this.app.interaction.register(this.watch.mesh);
    this.watchAttached = false;
  }

  attachWatch() {
    const hand = this.store.get('settings.handedness', 'right') === 'right' ? 'left' : 'right';
    const pointer = this.app.interaction.pointers.find(
      (p) => p.controller.userData.handedness === hand,
    ) || this.app.interaction.pointers[0];
    if (!pointer) return false;
    pointer.grip.add(this.watch.mesh);
    this.watchAttached = true;
    return true;
  }

  _renderWatch(p) {
    const window_ = this.app.prayerWindow;
    p.ctx.textAlign = 'center';
    if (!window_) {
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '500 26px Inter, sans-serif';
      p.ctx.fillText('—', p.W / 2, p.H / 2 - 16);
      p.ctx.textAlign = 'left';
      return;
    }
    p.ctx.fillStyle = THEME.gold;
    p.ctx.font = '700 34px Inter, sans-serif';
    p.ctx.fillText(PRAYER_LABELS[window_.next.key], p.W / 2, 24);
    p.ctx.fillStyle = THEME.ink;
    p.ctx.font = '700 42px Inter, sans-serif';
    p.ctx.fillText(formatCountdown(window_.msToNext), p.W / 2, 66);
    p.ctx.fillStyle = THEME.muted;
    p.ctx.font = '500 22px Inter, sans-serif';
    p.ctx.fillText(formatTime(window_.next.at, this.store.get('settings.use24h', true)), p.W / 2, 118);
    p.ctx.textAlign = 'left';
  }

  _render(p) {
    const window_ = this.app.prayerWindow;
    const hijri = toHijri(new Date(), this.store.get('settings.hijriOffset', 0));
    const subtitle = window_
      ? `${PRAYER_LABELS[window_.next.key]} in ${formatCountdown(window_.msToNext)} · ${hijri.day} ${hijri.monthName} ${hijri.year}`
      : `${hijri.day} ${hijri.monthName} ${hijri.year} AH`;

    let y = p.title('Digital Islam', subtitle);

    const cols = 4;
    const cellW = (p.W - 92) / cols;
    const cellH = Math.floor((p.H - y - 30) / 4);

    MENU.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 46 + col * cellW;
      const cy = y + row * cellH;
      const active = this.app.activeFeature === item.key;

      p.button(`menu-${item.key}`, '', x + 5, cy, cellW - 14, cellH - 14, {
        active, radius: 18,
        danger: item.key === 'exit',
        onSelect: () => this.app.openFeature(item.key),
      });

      p.ctx.textAlign = 'center';
      p.ctx.font = '400 46px system-ui, "Noto Color Emoji", sans-serif';
      p.ctx.fillText(item.icon, x + cellW / 2, cy + cellH * 0.30);
      p.ctx.fillStyle = active ? THEME.gold : THEME.ink;
      p.ctx.font = '600 25px Inter, sans-serif';
      p.ctx.fillText(item.label, x + cellW / 2, cy + cellH * 0.58);
      p.ctx.fillStyle = THEME.muted;
      p.ctx.font = '400 19px Inter, sans-serif';
      p.ctx.fillText(item.hint, x + cellW / 2, cy + cellH * 0.76);
      p.ctx.textAlign = 'left';
    });
  }

  toggle() {
    this.group.visible ? this.hide() : this.show();
    return this.group.visible;
  }

  show() {
    this.engine.stage.add(this.group);
    this.group.visible = true;
    this.engine.placeInFront(this.group, 1.35, -0.05);
    this.panel.refresh();
    this.app.audio.click();
  }

  hide() {
    this.group.visible = false;
    this.group.parent?.remove(this.group);
  }

  update(dt) {
    this.elapsed = (this.elapsed || 0) + dt;
    if (this.elapsed < 1) return;
    this.elapsed = 0;
    if (!this.watchAttached) this.attachWatch();
    this.watch.refresh();
    if (this.group.visible) this.panel.refresh();
  }
}
