// Minimal IndexedDB key–value store for large data (photos, packages).
// Falls back to memory when IndexedDB is unavailable.

const DB_NAME = 'rakenos';
const STORES = ['photos', 'files', 'packages'];
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    if (!globalThis.indexedDB) { resolve(null); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbp;
}

const mem = new Map(STORES.map((s) => [s, new Map()]));

function tx(store, mode, fn) {
  return open().then((db) => {
    if (!db) return fn(null);
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode); const os = t.objectStore(store);
      const r = fn(os);
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
    });
  });
}

export const idb = {
  async get(store, key) { const db = await open(); if (!db) return mem.get(store).get(key); return tx(store, 'readonly', (os) => os.get(key)); },
  async set(store, key, value) { const db = await open(); if (!db) { mem.get(store).set(key, value); return; } await tx(store, 'readwrite', (os) => os.put(value, key)); },
  async delete(store, key) { const db = await open(); if (!db) { mem.get(store).delete(key); return; } await tx(store, 'readwrite', (os) => os.delete(key)); },
  async keys(store) { const db = await open(); if (!db) return [...mem.get(store).keys()]; return tx(store, 'readonly', (os) => os.getAllKeys()); },
  async all(store) {
    const db = await open(); if (!db) return [...mem.get(store).values()];
    return tx(store, 'readonly', (os) => os.getAll());
  },
  async clear(store) { const db = await open(); if (!db) { mem.get(store).clear(); return; } await tx(store, 'readwrite', (os) => os.clear()); },
};
