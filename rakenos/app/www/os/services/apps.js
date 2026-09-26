// App registry: built-in system apps (capability-gated) and installed RAS apps.
import { has } from '../core/capabilities.js';
import { rasApps } from './ras-apps.js';

export const SYSTEM_APPS = [
  { id: 'settings', name: 'Settings', glyph: 'settings', color: '#5f6673', load: () => import('../apps/settings.js') },
  { id: 'camera', name: 'Camera', glyph: 'camera', color: '#2b2f36', requires: 'camera', load: () => import('../apps/camera.js') },
  { id: 'gallery', name: 'Gallery', glyph: 'image', color: '#e1574c', load: () => import('../apps/gallery.js') },
  { id: 'files', name: 'Files', glyph: 'folder', color: '#2f7ad8', load: () => import('../apps/files.js') },
  { id: 'notes', name: 'Notes', glyph: 'note', color: '#d99a1e', load: () => import('../apps/notes.js') },
  { id: 'calculator', name: 'Calculator', glyph: 'calculator', color: '#e8702a', load: () => import('../apps/calculator.js') },
  { id: 'clock', name: 'Clock', glyph: 'clock', color: '#16181c', load: () => import('../apps/clock.js') },
  { id: 'browser', name: 'Browser', glyph: 'compass', color: '#1b8fcf', load: () => import('../apps/browser.js') },
  { id: 'store', name: 'Raken Store', short: 'Store', glyph: 'bag', color: '#2f5ae0', load: () => import('../apps/store.js') },
  { id: 'scanner', name: 'Scanner', glyph: 'scanner', color: '#14a38b', requires: 'scanner2d', load: () => import('../apps/scanner.js') },
];

export function systemApp(id) { return SYSTEM_APPS.find((a) => a.id === id) || null; }

export function isAvailable(app) { return !app.requires || has(app.requires); }

export function getApp(id) {
  const s = systemApp(id);
  if (s) return isAvailable(s) ? s : null;
  const r = rasApps.get(id);
  if (!r) return null;
  return {
    id, name: r.manifest.name, glyph: r.manifest.icon.glyph || 'package', color: r.manifest.icon.background || '#5f6673',
    kind: 'ras', load: () => import('../apps/ras-app.js'),
  };
}

export function allApps() {
  const list = SYSTEM_APPS.filter(isAvailable).map((a) => ({ ...a, kind: 'system' }));
  for (const r of rasApps.list()) list.push(getApp(r.manifest.id));
  return list;
}
