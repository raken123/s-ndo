// Left (layers + assets) and right (inspector) panels.
import { esc, h } from '../api.js';

const ICON = { box: '▣', sphere: '●', cylinder: '▮', cone: '▲', capsule: '⬮', plane: '▭', torus: '◯', model: '◆', image: '🖼', text: '🔤', light: '💡', audio: '🔊', video: '🎬', empty: '⌖' };

export class Layers {
  constructor(el, countEl, doc, viewport, hooks) {
    Object.assign(this, { el, countEl, doc, viewport, hooks });
    doc.addEventListener('change', (e) => { if (e.detail.kind !== 'transform') this.render(); });
    viewport.addEventListener('select', () => this.render());
    this.render();
  }

  render() {
    const sel = this.viewport.selectedId;
    const objs = this.doc.scene.objects;
    this.countEl.textContent = objs.length;
    this.el.innerHTML = `
      <div class="layer special ${!sel ? 'sel' : ''}" data-special="scene"><span class="ic">🌐</span><span class="nm">Scene settings</span></div>
      <div class="layer special" data-special="script"><span class="ic">{ }</span><span class="nm">Game script${this.doc.scene.script ? '' : ' (empty)'}</span></div>
      ${objs.map((o) => `
        <div class="layer ${o.id === sel ? 'sel' : ''} ${o.visible === false ? 'hidden-obj' : ''}" data-id="${esc(o.id)}" draggable="true">
          <span class="ic">${ICON[o.type] || '▣'}</span><span class="nm">${esc(o.name)}</span>
          ${o.script ? '<span class="ic" title="Has script">{}</span>' : ''}
          <button class="eye ${o.visible === false ? 'off' : ''}" title="Toggle visibility">${o.visible === false ? '◌' : '👁'}</button>
        </div>`).join('')}`;
    this.el.querySelectorAll('.layer').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (row.dataset.special === 'scene') return this.viewport.select(null);
        if (row.dataset.special === 'script') return this.hooks.editScript(null);
        if (e.target.classList.contains('eye')) {
          const o = this.doc.byId(row.dataset.id);
          this.doc.update(o.id, { visible: o.visible === false });
          return;
        }
        this.viewport.select(row.dataset.id);
      });
      if (row.dataset.id) {
        row.addEventListener('dblclick', () => this.rename(row));
        row.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/nezos-id', row.dataset.id));
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData('text/nezos-id');
          const to = row.dataset.id;
          if (!from || from === to) return;
          this.doc.change((s) => {
            const i = s.objects.findIndex((o) => o.id === from);
            const [moved] = s.objects.splice(i, 1);
            s.objects.splice(s.objects.findIndex((o) => o.id === to), 0, moved);
          }, 'script');
          this.render();
        });
      }
    });
  }

  rename(row) {
    const o = this.doc.byId(row.dataset.id);
    const nm = row.querySelector('.nm');
    const input = h(`<input value="${esc(o.name)}">`);
    nm.replaceWith(input);
    input.focus();
    input.select();
    const done = (save) => {
      if (save && input.value.trim() && input.value.trim() !== o.name) this.doc.update(o.id, { name: input.value.trim() });
      else this.render();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); e.stopPropagation(); });
    input.addEventListener('blur', () => done(true));
  }
}

export class Assets {
  constructor(el, hooks) {
    this.el = el;
    this.hooks = hooks;
    this.items = [];
  }
  load(items) { this.items = items || []; this.render(); }
  add(item) { this.items.unshift(item); this.render(); }
  render() {
    if (!this.items.length) {
      this.el.innerHTML = '<div class="empty">AI-generated images, voices and videos appear here.</div>';
      return;
    }
    this.el.innerHTML = this.items.map((a, i) => {
      if (a.kind === 'image') return `<div class="asset" data-i="${i}" title="${esc(a.prompt || '')}" style="background-image:url('${esc(a.url)}')"></div>`;
      return `<div class="asset" data-i="${i}" title="${esc(a.prompt || '')}">${a.kind === 'audio' ? '🔊' : '🎬'}</div>`;
    }).join('');
    this.el.querySelectorAll('.asset').forEach((el) => el.addEventListener('click', () => this.hooks.useAsset(this.items[+el.dataset.i])));
  }
}

// ------------------------------------------------------------------ inspector
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const fx = (n) => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0);

export class Inspector {
  constructor(el, doc, viewport, hooks) {
    Object.assign(this, { el, doc, viewport, hooks });
    viewport.addEventListener('select', () => this.render());
    viewport.addEventListener('transform', () => this.render());
    doc.addEventListener('change', (e) => { if (!this._editing) this.render(); });
    this.render();
  }

  render() {
    const id = this.viewport.selectedId;
    const o = id && this.doc.byId(id);
    this.el.innerHTML = '';
    this.el.appendChild(o ? this.objectPanel(o) : this.scenePanel());
  }

  // commit a patch without re-rendering the panel under the user's cursor
  commit(id, patch) {
    this._editing = true;
    try { this.doc.update(id, patch); } finally { this._editing = false; }
  }

  v3Row(label, key, o, step = 0.1) {
    const vals = o[key] || [0, 0, 0];
    const row = h(`<div class="row"><label>${label}</label><div class="v3">
      ${['x', 'y', 'z'].map((a, i) => `<div class="num"><span class="${a}">${a.toUpperCase()}</span><input class="f" type="number" step="${step}" data-i="${i}" value="${fx(vals[i])}"></div>`).join('')}
    </div></div>`);
    row.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => {
      const cur = [...(this.doc.byId(o.id)[key] || [0, 0, 0])];
      cur[+inp.dataset.i] = num(inp.value);
      this.commit(o.id, { [key]: cur });
    }));
    return row;
  }

  field(label, html, onChange, evt = 'change') {
    const row = h(`<div class="row"><label>${label}</label><div class="grow">${html}</div></div>`);
    const inp = row.querySelector('input,select,textarea');
    inp.addEventListener(evt, () => onChange(inp.type === 'checkbox' ? inp.checked : inp.value, inp));
    return row;
  }

  objectPanel(o) {
    const wrap = h('<div class="insp"></div>');
    const title = h(`<div class="title"><input class="f" value="${esc(o.name)}" aria-label="Name"></div>`);
    title.querySelector('input').addEventListener('change', (e) => this.commit(o.id, { name: e.target.value.trim() || o.name }));
    wrap.appendChild(title);
    wrap.appendChild(h(`<div class="type">${esc(o.type)}${o.type === 'model' ? ` · ${(o.parts || []).length} parts` : ''}</div>`));

    wrap.appendChild(h('<h4>Transform</h4>'));
    wrap.appendChild(this.v3Row('Position', 'position', o));
    wrap.appendChild(this.v3Row('Rotation', 'rotation', o, 5));
    wrap.appendChild(this.v3Row('Scale', 'scale', o));

    const hasMaterial = !['light', 'audio', 'empty', 'text', 'video'].includes(o.type);
    if (hasMaterial) {
      wrap.appendChild(h('<h4>Appearance</h4>'));
      wrap.appendChild(this.field('Color', `<input class="f" type="color" value="${esc(o.color || '#9aa4b2')}">`, (v) => this.commit(o.id, { color: v })));
      wrap.appendChild(this.field('Emissive', `<input class="f" type="color" value="${esc(o.emissive || '#000000')}">`, (v) => this.commit(o.id, { emissive: v })));
      wrap.appendChild(this.field('Metal', `<input class="f" type="range" min="0" max="1" step="0.05" value="${num(o.metalness, 0.05)}">`, (v) => this.commit(o.id, { metalness: +v })));
      wrap.appendChild(this.field('Rough', `<input class="f" type="range" min="0" max="1" step="0.05" value="${num(o.roughness, 0.75)}">`, (v) => this.commit(o.id, { roughness: +v })));
      wrap.appendChild(this.field('Opacity', `<input class="f" type="range" min="0.05" max="1" step="0.05" value="${num(o.opacity, 1)}">`, (v) => this.commit(o.id, { opacity: +v })));
      if (o.type !== 'model') {
        wrap.appendChild(h('<h4>Texture</h4>'));
        if (o.texture) wrap.appendChild(h(`<div class="tex-preview" style="background-image:url('${esc(o.texture)}')"></div>`));
        if (o.texture && o.type !== 'image') wrap.appendChild(this.field('Repeat', `<input class="f" type="number" min="0.1" step="0.5" value="${num(o.textureRepeat?.[0], 1)}">`, (v) => this.commit(o.id, { textureRepeat: [num(v, 1), num(v, 1)] })));
        const btns = h(`<div class="btn-row"><button class="chip-btn" data-a="gen">✨ ${o.texture ? 'New' : 'Generate'} texture</button>${o.texture ? '<button class="chip-btn danger" data-a="rm">Remove</button>' : ''}</div>`);
        btns.querySelector('[data-a=gen]').onclick = () => this.hooks.imageDialog({ purpose: o.type === 'image' ? 'billboard' : 'texture', targetId: o.id });
        btns.querySelector('[data-a=rm]')?.addEventListener('click', () => this.commit(o.id, { texture: null }));
        wrap.appendChild(btns);
      }
    }

    if (o.type === 'light') {
      const L = o.light || {};
      wrap.appendChild(h('<h4>Light</h4>'));
      wrap.appendChild(this.field('Kind', `<select class="f">${['directional', 'point', 'spot', 'hemisphere', 'ambient'].map((k) => `<option ${k === (L.kind || 'directional') ? 'selected' : ''}>${k}</option>`).join('')}</select>`, (v) => this.commit(o.id, { light: { kind: v } })));
      wrap.appendChild(this.field('Color', `<input class="f" type="color" value="${esc(L.color || '#ffffff')}">`, (v) => this.commit(o.id, { light: { color: v } })));
      wrap.appendChild(this.field('Intensity', `<input class="f" type="number" min="0" step="0.1" value="${num(L.intensity, 1)}">`, (v) => this.commit(o.id, { light: { intensity: num(v, 1) } })));
      if (L.kind === 'point' || L.kind === 'spot') wrap.appendChild(this.field('Range', `<input class="f" type="number" min="0" step="1" value="${num(L.distance, 0)}">`, (v) => this.commit(o.id, { light: { distance: num(v) } })));
    }

    if (o.type === 'text') {
      const t = o.text || {};
      wrap.appendChild(h('<h4>Text</h4>'));
      wrap.appendChild(this.field('Text', `<textarea class="f" rows="2">${esc(t.value ?? o.name)}</textarea>`, (v) => this.commit(o.id, { text: { value: v } })));
      wrap.appendChild(this.field('Color', `<input class="f" type="color" value="${esc(t.color || '#ffffff')}">`, (v) => this.commit(o.id, { text: { color: v } })));
      wrap.appendChild(this.field('Size', `<input class="f" type="number" min="0.1" step="0.1" value="${num(t.size, 1)}">`, (v) => this.commit(o.id, { text: { size: num(v, 1) } })));
    }

    if (o.type === 'audio') {
      const a = o.audio || {};
      wrap.appendChild(h('<h4>Audio</h4>'));
      wrap.appendChild(a.src ? h(`<audio controls src="${esc(a.src)}" style="width:100%;height:32px"></audio>`) : h('<div class="muted">No clip yet.</div>'));
      wrap.appendChild(this.field('Autoplay', `<input type="checkbox" ${a.autoplay ? 'checked' : ''}>`, (v) => this.commit(o.id, { audio: { autoplay: v } })));
      wrap.appendChild(this.field('Loop', `<input type="checkbox" ${a.loop ? 'checked' : ''}>`, (v) => this.commit(o.id, { audio: { loop: v } })));
      const b = h('<div class="btn-row"><button class="chip-btn">🎙 New voice line</button></div>');
      b.querySelector('button').onclick = () => this.hooks.audioDialog({ targetId: o.id });
      wrap.appendChild(b);
    }

    if (o.type === 'video') {
      wrap.appendChild(h('<h4>Video</h4>'));
      wrap.appendChild(o.video?.src ? h(`<video controls muted src="${esc(o.video.src)}" style="width:100%;border-radius:8px"></video>`) : h('<div class="muted">No clip yet.</div>'));
      const b = h('<div class="btn-row"><button class="chip-btn">🎬 Generate clip</button></div>');
      b.querySelector('button').onclick = () => this.hooks.videoDialog({ targetId: o.id });
      wrap.appendChild(b);
    }

    if (!['light', 'audio'].includes(o.type)) {
      const p = o.physics || {};
      wrap.appendChild(h('<h4>Physics</h4>'));
      wrap.appendChild(this.field('Body', `<select class="f">${['none', 'static', 'dynamic', 'kinematic', 'trigger'].map((k) => `<option ${k === (p.body || 'none') ? 'selected' : ''}>${k}</option>`).join('')}</select>`, (v) => this.commit(o.id, { physics: { body: v } })));
      if (p.body === 'dynamic') wrap.appendChild(this.field('Bounce', `<input class="f" type="range" min="0" max="1" step="0.05" value="${num(p.bounce, 0)}">`, (v) => this.commit(o.id, { physics: { bounce: +v } })));
    }

    wrap.appendChild(h('<h4>Gameplay</h4>'));
    wrap.appendChild(this.field('Tags', `<input class="f" placeholder="enemy, coin" value="${esc((o.tags || []).join(', '))}">`, (v) => this.commit(o.id, { tags: v.split(',').map((s) => s.trim()).filter(Boolean) })));
    wrap.appendChild(this.field('Shadow', `<input type="checkbox" ${o.castShadow !== false ? 'checked' : ''}>`, (v) => this.commit(o.id, { castShadow: v })));
    wrap.appendChild(this.field('Billboard', `<input type="checkbox" ${o.billboard ? 'checked' : ''}>`, (v) => this.commit(o.id, { billboard: v })));

    const actions = h(`<div class="btn-row">
      <button class="chip-btn" data-a="script">⌨ ${o.script ? 'Edit' : 'Add'} script</button>
      <button class="chip-btn" data-a="ask">✨ Ask AI</button>
      <button class="chip-btn" data-a="dup">⧉ Duplicate</button>
      <button class="chip-btn danger" data-a="del">🗑 Delete</button></div>`);
    actions.querySelector('[data-a=script]').onclick = () => this.hooks.editScript(o.id);
    actions.querySelector('[data-a=ask]').onclick = () => this.hooks.askAbout(o);
    actions.querySelector('[data-a=dup]').onclick = () => { const c = this.doc.duplicate(o.id); if (c) this.viewport.select(c.id); };
    actions.querySelector('[data-a=del]').onclick = () => { this.doc.remove(o.id); };
    wrap.appendChild(h('<h4>Actions</h4>'));
    wrap.appendChild(actions);
    return wrap;
  }

  scenePanel() {
    const s = this.doc.scene.settings;
    const set = (patch) => {
      this._editing = true;
      try { this.doc.change((sc) => { sc.settings = { ...sc.settings, ...patch }; }, 'settings'); } finally { this._editing = false; }
    };
    const wrap = h('<div class="insp"></div>');
    wrap.appendChild(h('<div class="title"><b style="font-size:14px">Scene</b></div>'));
    wrap.appendChild(h(`<div class="type">${this.doc.scene.objects.length} objects</div>`));
    wrap.appendChild(h('<h4>Environment</h4>'));
    wrap.appendChild(this.field('Sky', `<input class="f" type="color" value="${esc(s.background || '#8ec5ff')}">`, (v) => set({ background: v })));
    wrap.appendChild(this.field('Ambient', `<input class="f" type="range" min="0" max="2" step="0.05" value="${num(s.ambient, 0.6)}">`, (v) => set({ ambient: +v })));
    wrap.appendChild(this.field('Fog', `<input type="checkbox" ${s.fog ? 'checked' : ''}>`, (v) => { set({ fog: v ? { color: s.background || '#8ec5ff', near: 30, far: 140 } : null }); this.render(); }));
    if (s.fog) {
      wrap.appendChild(this.field('Fog near', `<input class="f" type="number" step="5" value="${num(s.fog.near, 30)}">`, (v) => set({ fog: { ...s.fog, near: num(v, 30) } })));
      wrap.appendChild(this.field('Fog far', `<input class="f" type="number" step="5" value="${num(s.fog.far, 140)}">`, (v) => set({ fog: { ...s.fog, far: num(v, 140) } })));
    }
    if (s.skyTexture) wrap.appendChild(h(`<div class="tex-preview" style="background-image:url('${esc(s.skyTexture)}')"></div>`));
    const sky = h(`<div class="btn-row"><button class="chip-btn" data-a="sky">🌌 ${s.skyTexture ? 'New' : 'AI'} skybox</button>${s.skyTexture ? '<button class="chip-btn danger" data-a="rm">Remove sky</button>' : ''}</div>`);
    sky.querySelector('[data-a=sky]').onclick = () => this.hooks.imageDialog({ purpose: 'sky' });
    sky.querySelector('[data-a=rm]')?.addEventListener('click', () => { set({ skyTexture: null }); this.doc.emit('full'); this.render(); });
    wrap.appendChild(sky);

    wrap.appendChild(h('<h4>Physics</h4>'));
    wrap.appendChild(this.field('Gravity', `<input class="f" type="number" step="1" value="${num(s.gravity, 20)}">`, (v) => set({ gravity: num(v, 20) })));

    const cam = s.camera || {};
    wrap.appendChild(h('<h4>Play camera</h4>'));
    wrap.appendChild(this.field('Mode', `<select class="f">${['orbit', 'follow', 'firstPerson', 'fixed'].map((k) => `<option ${k === (cam.mode || 'orbit') ? 'selected' : ''}>${k}</option>`).join('')}</select>`, (v) => { set({ camera: { ...cam, mode: v } }); this.render(); }));
    if (cam.mode === 'follow' || cam.mode === 'firstPerson') {
      wrap.appendChild(this.field('Target', `<select class="f"><option value="">—</option>${this.doc.scene.objects.map((o) => `<option ${o.name === cam.target ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`, (v) => set({ camera: { ...cam, target: v } })));
    }
    const camBtn = h('<div class="btn-row"><button class="chip-btn">📷 Use current view as start camera</button></div>');
    camBtn.querySelector('button').onclick = () => {
      const p = this.viewport.camera.position, t = this.viewport.orbit.target;
      set({ camera: { ...cam, position: [fx(p.x), fx(p.y), fx(p.z)], lookAt: [fx(t.x), fx(t.y), fx(t.z)] } });
    };
    wrap.appendChild(camBtn);

    wrap.appendChild(h('<h4>Code</h4>'));
    const code = h(`<div class="btn-row"><button class="chip-btn">⌨ Edit game script</button></div>`);
    code.querySelector('button').onclick = () => this.hooks.editScript(null);
    wrap.appendChild(code);
    wrap.appendChild(h('<p class="muted" style="margin-top:16px">Tip: select an object to edit it, or ask the AI in the chat to build something.</p>'));
    return wrap;
  }
}
