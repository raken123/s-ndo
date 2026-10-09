// The scene document: single source of truth for the editor, with undo/redo
// and the operation language the AI speaks (see src/prompts.js).
const TYPES = ['box', 'sphere', 'cylinder', 'cone', 'capsule', 'plane', 'torus', 'model', 'image', 'text', 'light', 'audio', 'video', 'empty'];
const NESTED = ['physics', 'light', 'text', 'audio', 'video', 'props'];

export const uid = () => Math.random().toString(36).slice(2, 10);

const v3 = (v, d) => {
  if (typeof v === 'number' && Number.isFinite(v)) return [v, v, v];
  if (Array.isArray(v) && v.length === 3) return v.map((n, i) => (Number.isFinite(+n) ? +n : d[i]));
  return d;
};

export function normalizeObject(o) {
  const obj = { ...o };
  obj.id = typeof obj.id === 'string' && obj.id ? obj.id : uid();
  obj.type = TYPES.includes(obj.type) ? obj.type : obj.type === 'group' ? 'model' : 'box';
  obj.name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 80) : obj.type;
  obj.position = v3(obj.position, [0, 0, 0]);
  obj.rotation = v3(obj.rotation, [0, 0, 0]);
  obj.scale = v3(obj.scale, [1, 1, 1]);
  if (obj.tags && !Array.isArray(obj.tags)) obj.tags = String(obj.tags).split(',').map((s) => s.trim()).filter(Boolean);
  if (obj.script != null && typeof obj.script !== 'string') obj.script = String(obj.script);
  return obj;
}

export function normalizeScene(scene) {
  const s = scene && typeof scene === 'object' ? structuredClone(scene) : {};
  s.settings = { background: '#8ec5ff', ambient: 0.6, gravity: 20, camera: { mode: 'orbit' }, ...(s.settings || {}) };
  s.settings.camera = { mode: 'orbit', ...(s.settings.camera || {}) };
  s.objects = Array.isArray(s.objects) ? s.objects.filter((o) => o && typeof o === 'object').map(normalizeObject) : [];
  // names must be unique for scripts to find things
  const seen = new Set();
  for (const o of s.objects) {
    let n = o.name, i = 2;
    while (seen.has(n)) n = `${o.name} ${i++}`;
    o.name = n;
    seen.add(n);
  }
  const ids = new Set();
  for (const o of s.objects) { if (ids.has(o.id)) o.id = uid(); ids.add(o.id); }
  s.script = typeof s.script === 'string' ? s.script : '';
  return s;
}

export class SceneDoc extends EventTarget {
  constructor(scene) {
    super();
    this.scene = normalizeScene(scene);
    this.undoStack = [];
    this.redoStack = [];
  }

  emit(kind, extra = {}) {
    this.dispatchEvent(new CustomEvent('change', { detail: { kind, ...extra } }));
  }

  /** Run `mutate(scene)` as one undoable step. kind: 'full' | 'object' | 'transform' | 'settings' | 'script'. */
  change(mutate, kind = 'full', extra = {}) {
    const before = JSON.stringify(this.scene);
    const result = mutate(this.scene);
    if (kind === 'full') this.scene = normalizeScene(this.scene);
    if (JSON.stringify(this.scene) === before) return result;
    this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    this.emit(kind, extra);
    return result;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.scene));
    this.scene = JSON.parse(this.undoStack.pop());
    this.emit('full', { history: true });
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.scene));
    this.scene = JSON.parse(this.redoStack.pop());
    this.emit('full', { history: true });
  }

  /** Replace the whole document (e.g. undoing a specific AI change). */
  restore(json) {
    const before = JSON.stringify(this.scene);
    if (before === json) return;
    this.undoStack.push(before);
    this.redoStack = [];
    this.scene = JSON.parse(json);
    this.emit('full');
  }

  byId(id) { return this.scene.objects.find((o) => o.id === id) || null; }
  byName(name) { return this.scene.objects.find((o) => o.name === name) || this.scene.objects.find((o) => o.name.toLowerCase() === String(name).toLowerCase()) || null; }

  uniqueName(base) {
    const names = new Set(this.scene.objects.map((o) => o.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  add(spec) {
    const o = normalizeObject({ ...spec, id: undefined });
    o.name = this.uniqueName(o.name);
    this.change((s) => { s.objects.push(o); }, 'object', { id: o.id, added: true });
    return o;
  }

  update(id, patch, kind = 'object') {
    this.change((s) => {
      const o = s.objects.find((x) => x.id === id);
      if (!o) return;
      if (patch.name && patch.name !== o.name) patch = { ...patch, name: this.uniqueName(patch.name) };
      mergeInto(o, patch);
    }, kind, { id });
  }

  remove(id) {
    this.change((s) => { s.objects = s.objects.filter((o) => o.id !== id); }, 'object', { id, removed: true });
  }

  duplicate(id) {
    const src = this.byId(id);
    if (!src) return null;
    const copy = structuredClone(src);
    copy.position = [src.position[0] + 1, src.position[1], src.position[2] + 1];
    copy.name = src.name.replace(/ \d+$/, '');
    return this.add(copy);
  }

  /**
   * Apply AI operations as a single undo step.
   * Returns a summary for the chat UI.
   */
  applyOps(ops) {
    const summary = { added: [], updated: [], removed: [], settings: false, script: false, replaced: false, errors: [] };
    if (!Array.isArray(ops) || !ops.length) return summary;
    this.change((s) => {
      for (const op of ops) {
        try {
          switch (op?.op) {
            case 'replaceScene': {
              const ns = normalizeScene(op.scene);
              s.settings = ns.settings; s.objects = ns.objects; s.script = ns.script;
              summary.replaced = true;
              break;
            }
            case 'add': {
              const o = normalizeObject({ ...op.object, id: undefined });
              const existing = s.objects.find((x) => x.name === o.name);
              if (existing) { mergeInto(existing, { ...op.object, id: existing.id }); summary.updated.push(existing.name); break; }
              s.objects.push(o);
              summary.added.push(o.name);
              break;
            }
            case 'update': {
              const o = s.objects.find((x) => x.name === op.name || x.id === op.id) || s.objects.find((x) => x.name.toLowerCase() === String(op.name).toLowerCase());
              if (!o) { summary.errors.push(`No object named "${op.name}"`); break; }
              mergeInto(o, { ...(op.set || {}), id: o.id });
              Object.assign(o, normalizeObject(o));
              summary.updated.push(o.name);
              break;
            }
            case 'remove': {
              const before = s.objects.length;
              s.objects = s.objects.filter((x) => x.name !== op.name && x.id !== op.id);
              if (s.objects.length < before) summary.removed.push(op.name);
              break;
            }
            case 'settings':
              s.settings = { ...s.settings, ...(op.set || {}) };
              if (op.set?.camera) s.settings.camera = { ...(s.settings.camera || {}), ...op.set.camera };
              summary.settings = true;
              break;
            case 'script':
              s.script = String(op.code ?? '');
              summary.script = true;
              break;
            default:
              if (op?.op) summary.errors.push(`Unknown op "${op.op}"`);
          }
        } catch (err) {
          summary.errors.push(err.message);
        }
      }
    }, 'full', { ai: true });
    return summary;
  }
}

function mergeInto(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id') continue;
    if (NESTED.includes(k) && v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
      target[k] = { ...target[k], ...v };
    } else if (v === null) {
      delete target[k];
    } else {
      target[k] = v;
    }
  }
}
