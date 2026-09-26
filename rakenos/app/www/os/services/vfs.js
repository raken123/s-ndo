// Virtual file system for Files. Text files live in local storage; photos come from Gallery.
import { storage } from '../core/store.js';
import { Emitter } from '../core/dom.js';

const KEY = 'rakenos.vfs';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function defaults() {
  const t = Date.now();
  return [
    { id: 'documents', parent: 'root', name: 'Documents', kind: 'folder', created: t, modified: t, system: true },
    { id: 'downloads', parent: 'root', name: 'Downloads', kind: 'folder', created: t, modified: t, system: true },
    { id: 'pictures', parent: 'root', name: 'Pictures', kind: 'folder', created: t, modified: t, system: true, virtual: 'photos' },
    { id: uid(), parent: 'documents', name: 'Welcome to RakenOS.txt', kind: 'file', mime: 'text/plain', created: t, modified: t,
      content: 'Welcome to RakenOS.\n\nFiles keeps your documents, downloads and pictures in one place.\nPress and hold a file to rename or delete it.\n' },
    { id: uid(), parent: 'documents', name: 'Shopping.txt', kind: 'file', mime: 'text/plain', created: t, modified: t, content: 'Coffee\nOat milk\nBread\n' },
  ];
}

class VFS extends Emitter {
  constructor() { super(); this.nodes = storage.get(KEY) || defaults(); }
  save() { storage.set(KEY, this.nodes); this.emit('change'); }
  get(id) { return this.nodes.find((n) => n.id === id) || null; }
  children(parent) { return this.nodes.filter((n) => n.parent === parent); }
  size(n) { return n.kind === 'file' ? new Blob([n.content || '']).size : this.children(n.id).length; }
  path(id) {
    const out = []; let n = this.get(id);
    while (n) { out.unshift(n); n = this.get(n.parent); }
    return out;
  }
  uniqueName(parent, name) {
    const names = new Set(this.children(parent).map((n) => n.name.toLowerCase()));
    if (!names.has(name.toLowerCase())) return name;
    const dot = name.lastIndexOf('.'); const base = dot > 0 ? name.slice(0, dot) : name; const ext = dot > 0 ? name.slice(dot) : '';
    for (let i = 2; ; i++) { const c = `${base} ${i}${ext}`; if (!names.has(c.toLowerCase())) return c; }
  }
  createFolder(parent, name) { const t = Date.now(); const n = { id: uid(), parent, name: this.uniqueName(parent, name), kind: 'folder', created: t, modified: t }; this.nodes.push(n); this.save(); return n; }
  createFile(parent, name, content = '', mime = 'text/plain') { const t = Date.now(); const n = { id: uid(), parent, name: this.uniqueName(parent, name), kind: 'file', mime, created: t, modified: t, content }; this.nodes.push(n); this.save(); return n; }
  write(id, content) { const n = this.get(id); if (!n) return; n.content = content; n.modified = Date.now(); this.save(); }
  rename(id, name) {
    const n = this.get(id); if (!n || n.system) return false;
    const clash = this.children(n.parent).some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase() && c.name !== name);
    if (clash) return false;
    n.name = name; n.modified = Date.now(); this.save(); return true;
  }
  remove(id) {
    const n = this.get(id); if (!n || n.system) return;
    const kill = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const x of this.nodes) if (!kill.has(x.id) && kill.has(x.parent)) { kill.add(x.id); grew = true; } }
    this.nodes = this.nodes.filter((x) => !kill.has(x.id)); this.save();
  }
  search(q) { const s = q.toLowerCase(); return this.nodes.filter((n) => !n.system && (n.name.toLowerCase().includes(s) || (n.content || '').toLowerCase().includes(s))); }
}

export const vfs = new VFS();
