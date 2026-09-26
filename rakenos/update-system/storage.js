// Storage adapters used by the update system and the OS state store.

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  get(k) { return this.map.has(k) ? JSON.parse(this.map.get(k)) : null; }
  set(k, v) { this.map.set(k, JSON.stringify(v)); }
  remove(k) { this.map.delete(k); }
}

export class LocalJsonStorage {
  constructor(ls = globalThis.localStorage) { this.ls = ls; this.fallback = new MemoryStorage(); }
  get(k) {
    try { const v = this.ls.getItem(k); return v == null ? null : JSON.parse(v); } catch { return this.fallback.get(k); }
  }
  set(k, v) {
    try { this.ls.setItem(k, JSON.stringify(v)); } catch { this.fallback.set(k, v); }
  }
  remove(k) { try { this.ls.removeItem(k); } catch { this.fallback.remove(k); } }
}
