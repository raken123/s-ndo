/*
 * Installed RAS apps: installation (with signature verification and
 * compatibility checks), permissions, per-app storage and removal.
 */
import { openRasPackage, checkCompatibility, sha256, RasError, KNOWN_PERMISSIONS } from '../../lib/ras-runtime/ras-package.js';
import { idb } from '../core/idb.js';
import { storage, settings } from '../core/store.js';
import { Emitter } from '../core/dom.js';
import { caps } from '../core/capabilities.js';

const MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', json: 'application/json', txt: 'text/plain' };
function toDataUrl(path, bytes) {
  const ext = path.split('.').pop().toLowerCase();
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return `data:${MIME[ext] || 'application/octet-stream'};base64,${btoa(s)}`;
}

class RasApps extends Emitter {
  constructor() { super(); this.apps = new Map(); this.trustedKeys = {}; this.systemInfo = () => ({ rakenosVersion: '1.0.0', rasApiLevel: 1 }); }

  async init({ trustedKeys, systemInfo }) {
    this.trustedKeys = trustedKeys; this.systemInfo = systemInfo;
    const recs = await idb.all('packages');
    for (const r of recs || []) if (r && r.manifest) this.apps.set(r.manifest.id, r);
  }

  list() { return [...this.apps.values()].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name)); }
  get(id) { return this.apps.get(id) || null; }
  isInstalled(id) { return this.apps.has(id); }

  context() { const s = this.systemInfo(); return { rakenosVersion: s.rakenosVersion, rasApiLevel: s.rasApiLevel, capabilities: caps() }; }
  compatibility(manifestLike) { return checkCompatibility(manifestLike, this.context()); }

  /* Parse and verify without installing (used to show the permission sheet). */
  async inspect(bytes) {
    const pkg = await openRasPackage(bytes, { trustedKeys: this.trustedKeys, allowUntrusted: !settings.get('verifiedAppsOnly') });
    const compat = this.compatibility(pkg.manifest);
    return { pkg, compat };
  }

  async install(bytes, { source = 'store', grants } = {}) {
    const { pkg, compat } = await this.inspect(bytes);
    if (!compat.compatible) throw new RasError('incompatible', compat.problems.map((p) => p.message).join(' '));
    const existing = this.apps.get(pkg.manifest.id);
    if (existing && existing.manifest.versionCode > pkg.manifest.versionCode) throw new RasError('downgrade', 'A newer version of this app is already installed.');
    if (existing && existing.signature.keyId !== pkg.signature.keyId) throw new RasError('key-mismatch', 'This update is signed by a different developer key than the installed app.');
    const permissions = {};
    for (const p of pkg.manifest.permissions) {
      const id = p.id || p;
      permissions[id] = existing && id in existing.permissions ? existing.permissions[id] : (grants ? !!grants[id] : true);
    }
    const assetUrls = {};
    for (const [path, data] of Object.entries(pkg.assets)) assetUrls[path] = toDataUrl(path, data);
    const rec = {
      manifest: pkg.manifest, script: pkg.script, design: pkg.design, assetUrls,
      signature: pkg.signature, digest: pkg.digest, permissions, source,
      installedAt: existing ? existing.installedAt : Date.now(), updatedAt: Date.now(),
    };
    await idb.set('packages', pkg.manifest.id, rec);
    this.apps.set(pkg.manifest.id, rec);
    this.emit('change', { type: existing ? 'update' : 'install', id: pkg.manifest.id });
    return rec;
  }

  /* Downloads from the Store with progress and verifies the catalog digest. */
  async download(url, expectedSha, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const total = +res.headers.get('Content-Length') || 0;
    let bytes;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader(); const chunks = []; let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress && onProgress(total ? got / total : 0.5); }
      bytes = new Uint8Array(got); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
    } else bytes = new Uint8Array(await res.arrayBuffer());
    onProgress && onProgress(1);
    if (expectedSha && (await sha256(bytes)) !== expectedSha) throw new RasError('tampered', 'The downloaded package does not match the Store listing.');
    return bytes;
  }

  async uninstall(id) {
    await idb.delete('packages', id);
    this.apps.delete(id);
    const prefix = `rakenos.ras.data.${id}`;
    try { localStorage.removeItem(prefix); } catch {}
    this.emit('change', { type: 'uninstall', id });
  }

  isGranted(id, perm) { const a = this.apps.get(id); return !!(a && a.permissions[perm]); }
  async setPermission(id, perm, granted) {
    const a = this.apps.get(id); if (!a || !(perm in a.permissions)) return;
    a.permissions[perm] = granted; await idb.set('packages', id, a); this.emit('change', { type: 'permission', id });
  }

  appStorage(id) {
    const key = `rakenos.ras.data.${id}`;
    const read = () => storage.get(key) || {};
    return {
      get: (k) => read()[k],
      set: (k, v) => { const d = read(); d[k] = v; storage.set(key, d); },
      remove: (k) => { const d = read(); delete d[k]; storage.set(key, d); },
      size: () => JSON.stringify(read()).length,
      clear: () => storage.set(key, {}),
    };
  }
}

export const rasApps = new RasApps();
export { KNOWN_PERMISSIONS };
