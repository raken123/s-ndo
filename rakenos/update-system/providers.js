/*
 * Update providers.
 *
 * LocalUpdateProvider answers from the bundled data/rakenos-updates.json
 * dataset. RemoteUpdateProvider talks to a RakenOS update server (see
 * mock-backend/ for a development implementation). Both expose the same
 * asynchronous interface, so the update engine does not care which is used.
 */
import { createUpdateApi } from './api-core.js';

export class LocalUpdateProvider {
  constructor(dataset, { downloadBytesPerSecond = 160 * 1024 * 1024 } = {}) {
    this.kind = 'local';
    this.api = createUpdateApi(dataset);
    this.downloadBytesPerSecond = downloadBytesPerSecond;
  }
  async latest() { return this.api.latest(); }
  async releases(opts) { return this.api.releases(opts); }
  async release(version) { return this.api.release(version); }
  async check(params) { return this.api.check(params); }

  /*
   * Downloads the release payload. The bundled provider has the payload
   * manifest locally, so the transfer is paced to the payload size to model a
   * real download; the bytes that are verified are the real manifest bytes.
   */
  async download(version, { onProgress, signal } = {}) {
    const p = this.api.payload(version);
    if (!p) throw new Error(`No payload for ${version}`);
    const durationMs = Math.min(9000, Math.max(2200, (p.sizeBytes / this.downloadBytesPerSecond) * 1000));
    const started = Date.now();
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (signal && signal.aborted) { reject(new DOMException('Download cancelled', 'AbortError')); return; }
        const f = Math.min(1, (Date.now() - started) / durationMs);
        onProgress && onProgress({ received: Math.round(p.sizeBytes * f), total: p.sizeBytes });
        if (f >= 1) resolve(); else setTimeout(tick, 120);
      };
      tick();
    });
    return { bytes: new TextEncoder().encode(p.manifest), sha256: p.sha256, sizeBytes: p.sizeBytes };
  }
}

export class RemoteUpdateProvider {
  constructor(baseUrl, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
    this.kind = 'remote';
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }
  async get(path) {
    const res = await this.fetch(this.baseUrl + path, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Update server responded ${res.status}`);
    return res.json();
  }
  latest() { return this.get('/api/os/latest'); }
  releases({ limit, before } = {}) {
    const q = new URLSearchParams();
    if (limit) q.set('limit', limit); if (before) q.set('before', before);
    return this.get('/api/os/releases' + (q.toString() ? '?' + q : ''));
  }
  release(version) { return this.get('/api/os/releases/' + encodeURIComponent(version)); }
  check({ currentVersion, rolloutGroup, since, dayMs }) {
    const q = new URLSearchParams({ currentVersion, rolloutGroup, since: String(since) });
    if (dayMs) q.set('dayMs', String(dayMs));
    return this.get('/api/os/check?' + q);
  }
  async download(version, { onProgress, signal } = {}) {
    const meta = await this.get(`/api/os/releases/${encodeURIComponent(version)}/payload`);
    if (!meta) throw new Error(`No payload for ${version}`);
    const res = await this.fetch(`${this.baseUrl}/api/os/releases/${encodeURIComponent(version)}/payload.bin`, { signal });
    if (!res.ok) throw new Error(`Payload download failed (${res.status})`);
    const total = +res.headers.get('X-RakenOS-Payload-Size') || meta.sizeBytes;
    const reader = res.body.getReader();
    const chunks = []; let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); received += value.length;
      onProgress && onProgress({ received: Math.min(total, Math.round((received / (+res.headers.get('Content-Length') || received)) * total)), total });
    }
    const bytes = new Uint8Array(received); let o = 0;
    for (const c of chunks) { bytes.set(c, o); o += c.length; }
    return { bytes, sha256: meta.sha256, sizeBytes: meta.sizeBytes };
  }
}
