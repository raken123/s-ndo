// Raken Store catalog access. Store is for discovering, installing, updating and opening apps.
// Publishing is done with Developer Studio (tools/ras-studio.mjs), never from the Store.
import { storage, settings } from '../core/store.js';
import { rasApps } from './ras-apps.js';

let catalog = null;
let base = 'lib/store/';

export async function loadCatalog() {
  const server = settings.get('updateServer');
  if (server) {
    try {
      const res = await fetch(`${server.replace(/\/$/, '')}/api/store/catalog`);
      if (res.ok) { catalog = await res.json(); base = `${server.replace(/\/$/, '')}/store/`; return catalog; }
    } catch {}
  }
  base = 'lib/store/';
  catalog = await (await fetch(`${base}catalog.json`)).json();
  return catalog;
}

export const store = {
  get catalog() { return catalog; },
  packageUrl(entry) { return base + entry.package; },
  entry(id) { return catalog && catalog.apps.find((a) => a.id === id); },
  category(id) { return catalog.categories.find((c) => c.id === id); },
  /* Store entries whose version is newer than the installed version. */
  updates() {
    if (!catalog) return [];
    return catalog.apps.filter((a) => { const i = rasApps.get(a.id); return i && a.versionCode > i.manifest.versionCode; });
  },
  refreshBadge() { storage.set('rakenos.store.updateCount', this.updates().length); },
  async installFactoryApps() {
    if (storage.get('rakenos.factoryInstalled') || !catalog) return;
    for (const pre of catalog.preinstalled || []) {
      try {
        const bytes = await rasApps.download(base + pre.package, pre.sha256);
        await rasApps.install(bytes, { source: 'factory' });
      } catch (e) { console.warn('Factory app not installed', pre.id, e); }
    }
    storage.set('rakenos.factoryInstalled', true);
  },
};
