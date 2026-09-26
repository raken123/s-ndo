// Connects the RakenOS Update Engine to the OS: provider, rollout identity, notifications.
import { UpdateEngine } from '../../lib/update-system/update-engine.js';
import { LocalUpdateProvider, RemoteUpdateProvider } from '../../lib/update-system/providers.js';
import { RolloutIdentity } from '../../lib/update-system/rollout.js';
import { storage, settings } from '../core/store.js';
import { platform } from '../core/platform.js';
import { notifications } from './notifications.js';

export const FACTORY_VERSION = '1.0.0';
let dataset = null;
let engine = null;
let rollout = null;
let byVersion = new Map();

export async function initUpdates() {
  const res = await fetch('lib/data/rakenos-updates.json');
  dataset = await res.json();
  byVersion = new Map(dataset.releases.map((r) => [r.version, r]));
  rollout = new RolloutIdentity(storage);
  const server = settings.get('updateServer');
  const provider = server ? new RemoteUpdateProvider(server) : new LocalUpdateProvider(dataset);
  engine = new UpdateEngine({
    provider, storage, rollout, factoryVersion: FACTORY_VERSION,
    platform: { installPackage: platform.isNative ? (p) => platform.installPackage(p) : null },
  });
  engine.on((type, detail) => {
    if (type === 'available' && !engine.settings.autoDownload) {
      notifications.post({ appId: 'system-update', appName: 'System Update', icon: 'update', color: '#5f6673', title: `${detail.name} is available`, body: 'Open System Update to download it.', open: { appId: 'settings', route: 'update' } });
    }
    if (type === 'ready') {
      notifications.post({
        appId: 'system-update', appName: 'System Update', icon: 'update', color: '#5f6673',
        title: `${detail.name} is ready to install`,
        body: engine.settings.autoInstall ? 'It will install the next time the device is locked.' : 'Open System Update to install it.',
        actions: [{ id: 'install', label: 'Install now' }],
        onAction: (a) => { if (a === 'install') engine.install(); },
        open: { appId: 'settings', route: 'update' },
      });
    }
    if (type === 'installed') {
      notifications.dismissApp('system-update');
      notifications.post({ appId: 'system-update', appName: 'System Update', icon: 'check', color: '#16945a', title: `${detail.release.name} installed`, body: `Updated from RakenOS ${detail.from}. Tap to read what's new.`, open: { appId: 'settings', route: `release:${detail.to}` } });
    }
  });
  return engine;
}

export const updates = {
  get engine() { return engine; },
  get dataset() { return dataset; },
  get rollout() { return rollout; },
  release(v) { return byVersion.get(v) || null; },
  get installed() { return engine ? engine.installedVersion : FACTORY_VERSION; },
  installedRelease() { return byVersion.get(this.installed); },
  rasApiLevel() {
    const c = engine && engine.system.components;
    return (c && c.rasApiLevel) || (this.installedRelease() ? this.installedRelease().components.rasApiLevel : 1);
  },
  components() { return (engine && engine.system.components) || (this.installedRelease() && this.installedRelease().components) || {}; },
  /* Installed version and everything before it, newest first. */
  history() {
    const cur = this.installedRelease();
    return dataset.releases.filter((r) => r.sequence <= cur.sequence).reverse();
  },
  all() { return dataset.releases.slice().reverse(); },
};
