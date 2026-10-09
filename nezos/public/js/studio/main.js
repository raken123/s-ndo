// Studio bootstrap: loads the project and wires toolbar, panels, chat and play mode.
import { api, requireLogin, toast, fmtCredits, LOGO } from '../api.js';
import { SceneDoc } from './doc.js';
import { Viewport } from './editor.js';
import { Layers, Inspector, Assets } from './panels.js';
import { Tools } from './tools.js';
import { Chat } from './chat.js';
import { Player } from './player.js';

document.getElementById('logo').innerHTML = LOGO;
const me = await requireLogin();
const projectId = decodeURIComponent(location.pathname.split('/').pop());

let project;
try {
  ({ project } = await api(`/api/projects/${encodeURIComponent(projectId)}`));
} catch (err) {
  document.body.innerHTML = `<div class="auth-wrap"><div class="auth-card"><h1>Project not found</h1><p class="sub">${err.message}</p><a class="btn btn-primary" href="/dashboard">Back to dashboard</a></div></div>`;
  throw err;
}
const { models } = await api('/api/models');

document.title = `${project.name} — Nezos Studio`;
const nameInput = document.getElementById('projectName');
nameInput.value = project.name;

const doc = new SceneDoc(project.scene);
const viewport = new Viewport(document.getElementById('viewport'), doc);
viewport.focus(null);

// ---------------------------------------------------------------- credits
let chat = null;
const creditsEl = document.getElementById('credits');
function onCredits(n) {
  if (typeof n === 'number') me.user.credits = n;
  creditsEl.textContent = `${fmtCredits(me.user.credits)} credits`;
  creditsEl.style.color = me.user.credits < 10 ? 'var(--warn)' : '';
  chat?.updateCost();
}

// ---------------------------------------------------------------- saving
const saveState = document.getElementById('saveState');
let dirty = false;
let saving = null;
let saveTimer = null;
let lastThumb = 0;
function markDirty() {
  dirty = true;
  saveState.textContent = 'Unsaved';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 1500);
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (saving) await saving;
  if (!dirty) return;
  dirty = false;
  saveState.textContent = 'Saving…';
  const body = { name: nameInput.value, scene: doc.scene, chat: chat.history };
  if (Date.now() - lastThumb > 20_000 && !player.playing) {
    try { body.thumbnail = viewport.thumbnail(); lastThumb = Date.now(); } catch { /* ignore */ }
  }
  saving = api(`/api/projects/${project.id}`, { method: 'PUT', body })
    .then(() => { saveState.textContent = dirty ? 'Unsaved' : 'Saved'; })
    .catch((err) => { dirty = true; saveState.textContent = 'Save failed'; toast(`Save failed: ${err.message}`, 'error'); })
    .finally(() => { saving = null; });
  return saving;
}
window.addEventListener('beforeunload', (e) => { if (dirty) { saveNow(); e.preventDefault(); } });
doc.addEventListener('change', () => { markDirty(); updateUndo(); });
nameInput.addEventListener('change', () => { document.title = `${nameInput.value} — Nezos Studio`; markDirty(); });
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); e.stopPropagation(); });

// ---------------------------------------------------------------- modules
const assets = new Assets(document.getElementById('assets'), {
  useAsset: (a) => {
    if (a.kind === 'image') {
      const sel = viewport.selectedId && doc.byId(viewport.selectedId);
      tools.applyImage(a.url, sel ? 'texture' : 'billboard', sel?.id);
    } else if (a.kind === 'audio') {
      new Audio(a.url).play().catch(() => {});
    } else if (a.kind === 'video') {
      const p = viewport.dropPoint();
      const o = doc.add({ name: 'Video screen', type: 'video', position: [p.x, 2.5, p.z], scale: [6.4, 3.6, 1], video: { src: a.url, loop: true } });
      viewport.select(o.id);
    }
  },
});
// rebuild the asset shelf from what the scene references
const seen = new Set();
const found = [];
JSON.stringify(project.scene, (k, v) => {
  if (typeof v === 'string' && (v.startsWith('/assets/') || /^data:(image|audio|video)\//.test(v)) && !seen.has(v)) {
    seen.add(v);
    const kind = /\.mp3$|^data:audio/.test(v) ? 'audio' : /\.mp4$|^data:video/.test(v) ? 'video' : 'image';
    found.push({ kind, url: v });
  }
  return v;
});
assets.load(found);

const undoSnapshots = new Map();
const player = new Player({ doc, viewport, onStateChange: (on) => { document.getElementById('playBtn').textContent = on ? '■ Stop' : '▶ Play'; } });
const ctx = { doc, viewport, models, me, project, onCredits, assets, saveNow, markDirty, undoSnapshots, player };
const tools = new Tools(ctx);
ctx.tools = tools;

const hooks = {
  editScript: (id) => tools.scriptEditor(id, { onAsk: (q, target) => chat.ask(target ? `${q} (for the object "${target.name}")` : q, 'code') }),
  imageDialog: (o) => tools.imageDialog(o),
  audioDialog: (o) => tools.audioDialog(o),
  videoDialog: (o) => tools.videoDialog(o),
  askAbout: (o) => chat.prefill(`About "${o.name}": `, 'auto'),
};
new Layers(document.getElementById('layers'), document.getElementById('layerCount'), doc, viewport, hooks);
new Inspector(document.getElementById('inspector'), doc, viewport, hooks);
chat = new Chat(ctx);
onCredits();

// ---------------------------------------------------------------- toolbar
function addPrimitive(type) {
  const p = viewport.dropPoint();
  const base = { name: type[0].toUpperCase() + type.slice(1), type, position: [+p.x.toFixed(2), 0.5, +p.z.toFixed(2)] };
  if (type === 'plane') Object.assign(base, { position: [+p.x.toFixed(2), 0.01, +p.z.toFixed(2)], scale: [4, 1, 4] });
  if (type === 'capsule') base.position[1] = 1;
  if (type === 'text') Object.assign(base, { position: [+p.x.toFixed(2), 2, +p.z.toFixed(2)], text: { value: 'Hello!', size: 1, color: '#ffffff' } });
  if (type === 'empty') Object.assign(base, { name: 'Spawn point' });
  if (['box', 'sphere', 'cylinder', 'cone', 'capsule', 'torus'].includes(type)) base.color = ['#7c5cff', '#3ad1ff', '#ffb347', '#3ddc97', '#ff6b81'][Math.floor(Math.random() * 5)];
  const o = doc.add(base);
  viewport.select(o.id);
}

function addLight(kind) {
  const p = viewport.dropPoint();
  const pos = kind === 'directional' || kind === 'hemisphere' ? [10, 18, 8] : [+p.x.toFixed(2), 4, +p.z.toFixed(2)];
  const o = doc.add({ name: { directional: 'Sun', point: 'Point light', spot: 'Spotlight', hemisphere: 'Sky light' }[kind], type: 'light', position: pos, light: { kind, intensity: 1, color: '#ffffff' } });
  viewport.select(o.id);
}

const ACTIONS = {
  'ai-model': () => chat.prefill('', 'model'),
  'ai-scene': () => chat.prefill('', 'scene'),
  'ai-game': () => chat.prefill('', 'game'),
  'ai-architect': () => chat.prefill('', 'architect'),
  'scene-settings': () => viewport.select(null),
  sky: () => tools.imageDialog({ purpose: 'sky' }),
  image: () => {
    const sel = viewport.selectedId && doc.byId(viewport.selectedId);
    tools.imageDialog(sel && !['light', 'audio', 'empty', 'text', 'video'].includes(sel.type) ? { purpose: 'texture', targetId: sel.id } : {});
  },
  audio: () => tools.audioDialog(),
  video: () => tools.videoDialog(),
  script: () => hooks.editScript(null),
  playtest: () => chat.ask('Playtest my game and fix any problems you find.', 'playtest'),
  export: () => tools.exportHtml(),
  share: () => tools.share(),
  shortcuts: () => tools.shortcuts(),
};

function closeMenus() { document.querySelectorAll('.dd.open').forEach((d) => d.classList.remove('open')); }
document.addEventListener('click', (e) => {
  const menuBtn = e.target.closest('[data-menu]');
  if (menuBtn) {
    const dd = menuBtn.parentElement;
    const open = !dd.classList.contains('open');
    closeMenus();
    if (open) {
      dd.classList.add('open');
      const r = menuBtn.getBoundingClientRect();
      const menu = dd.querySelector('.dd-menu');
      menu.style.left = `${Math.min(r.left, innerWidth - 250)}px`;
      menu.style.top = `${r.bottom + 6}px`;
    }
    return;
  }
  const add = e.target.closest('[data-add]');
  const act = e.target.closest('[data-act]');
  const light = e.target.closest('[data-light]');
  if (add || act || light) closeMenus();
  if (add) addPrimitive(add.dataset.add);
  else if (light) addLight(light.dataset.light);
  else if (act) ACTIONS[act.dataset.act]?.();
  else if (!e.target.closest('.dd-menu')) closeMenus();
});

document.querySelectorAll('[data-gizmo]').forEach((b) => b.addEventListener('click', () => setGizmo(b.dataset.gizmo)));
function setGizmo(mode) {
  viewport.setGizmoMode(mode);
  document.querySelectorAll('[data-gizmo]').forEach((x) => x.classList.toggle('on', x.dataset.gizmo === mode));
}
let snap = false;
document.getElementById('snapBtn').onclick = (e) => { snap = !snap; viewport.setSnap(snap); e.currentTarget.classList.toggle('on', snap); };

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
function updateUndo() { undoBtn.disabled = !doc.canUndo; redoBtn.disabled = !doc.canRedo; }
undoBtn.onclick = () => doc.undo();
redoBtn.onclick = () => doc.redo();
updateUndo();

document.getElementById('playBtn').onclick = () => player.toggle();

// ---------------------------------------------------------------- keyboard
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t.matches?.('input, textarea, select') || document.querySelector('.modal-back')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); doc.redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); markDirty(); saveNow(); return; }
  if (mod && e.key === 'Enter') { e.preventDefault(); player.toggle(); return; }
  if (player.playing) { if (e.key === 'Escape') player.stop(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); const c = viewport.selectedId && doc.duplicate(viewport.selectedId); if (c) viewport.select(c.id); return; }
  if (mod) return;
  switch (e.key) {
    case 'w': case 'W': setGizmo('translate'); break;
    case 'e': case 'E': setGizmo('rotate'); break;
    case 'r': case 'R': setGizmo('scale'); break;
    case 'f': case 'F': viewport.focus(); break;
    case 'Delete': case 'Backspace': if (viewport.selectedId) { e.preventDefault(); doc.remove(viewport.selectedId); } break;
    case 'Escape': viewport.select(null); closeMenus(); break;
    case '/': e.preventDefault(); document.getElementById('prompt').focus(); break;
    default:
  }
});

if (new URLSearchParams(location.search).get('prompt')) chat.prefill(new URLSearchParams(location.search).get('prompt'), 'game');
