// The AI chat bar next to the designer.
import { api, esc, h, toast, markdown, fmtCredits } from '../api.js';

export const MODES = [
  { id: 'auto', label: 'Auto', hint: 'Ask for anything: a game, a level, a model, code…' },
  { id: 'game', label: '🎮 Game', hint: 'Describe the game to generate, e.g. “a snowy sled race with ramps”' },
  { id: 'scene', label: '🌄 Scene', hint: 'Describe the world, e.g. “a cosy village square with market stalls”' },
  { id: 'model', label: '🧊 3D Model', hint: 'Describe one model, e.g. “a cute low-poly fox”' },
  { id: 'code', label: '⌨️ Code', hint: 'Describe the behaviour, e.g. “enemies chase the player when close”' },
  { id: 'architect', label: '🧭 Architect', hint: 'Describe the game to plan, e.g. “a co-op dungeon crawler”' },
  { id: 'playtest', label: '🧪 Playtest', hint: 'Press send to let a bot play your game and the AI fix what it finds', feature: 'playtest' },
];

const WELCOME = [
  'Make a platformer on floating islands with coins, a moving platform and a castle goal',
  'Build a top-down arena where slimes chase me and I dodge for 60 seconds',
  'Create a first-person maze with glowing crystals to collect',
];

export class Chat {
  constructor(ctx) {
    this.ctx = ctx; // { doc, viewport, models, me, project, onCredits, tools, player }
    this.mode = 'auto';
    this.busy = false;
    this.history = Array.isArray(ctx.project.chat) ? ctx.project.chat : [];
    this.el = {
      modes: document.getElementById('modes'),
      messages: document.getElementById('messages'),
      form: document.getElementById('composer'),
      prompt: document.getElementById('prompt'),
      model: document.getElementById('modelSelect'),
      effort: document.getElementById('effortSelect'),
      cost: document.getElementById('costHint'),
      send: document.getElementById('sendBtn'),
      mic: document.getElementById('micBtn'),
      ctxLine: document.getElementById('ctx'),
    };
    this.renderModes();
    this.renderModels();
    this.renderHistory();
    this.bind();
    ctx.viewport.addEventListener('select', () => this.renderContext());
    this.renderContext();
  }

  get plan() { return this.ctx.me.plan; }

  renderModes() {
    this.el.modes.innerHTML = MODES.map((m) => {
      const locked = m.feature && !this.plan.features[m.feature];
      return `<button type="button" class="mode ${m.id === this.mode ? 'on' : ''}" data-mode="${m.id}" title="${esc(m.hint)}">${m.label}${locked ? '<span class="lk">🔒</span>' : ''}</button>`;
    }).join('');
    this.el.modes.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => this.setMode(b.dataset.mode)));
  }

  setMode(mode, { focus = true } = {}) {
    this.mode = mode;
    this.renderModes();
    const m = MODES.find((x) => x.id === mode);
    this.el.prompt.placeholder = m.hint;
    if (mode === 'playtest' && !this.el.prompt.value) this.el.prompt.value = 'Playtest my game and fix any problems you find.';
    if (focus) this.el.prompt.focus();
    this.updateCost();
  }

  renderModels() {
    const text = this.ctx.models.filter((m) => m.kind === 'text' && !m.snapshotOf);
    const tiers = [['nano', 'Nano'], ['mini', 'Mini'], ['standard', 'Standard'], ['advanced', 'Advanced'], ['frontier', 'Frontier']];
    const saved = localStorageGet('nezos.model');
    const preferred = [saved, this.ctx.me.defaults?.text].find((id) => text.some((m) => m.id === id && m.allowed));
    this.el.model.innerHTML = tiers.map(([tier, label]) => {
      const list = text.filter((m) => m.tier === tier);
      if (!list.length) return '';
      return `<optgroup label="${label}">${list.map((m) => `<option value="${esc(m.id)}" ${m.allowed ? '' : 'disabled'} ${m.id === preferred ? 'selected' : ''}>${esc(m.name)}${m.allowed ? '' : ` 🔒 ${esc(m.minPlanName)}`}</option>`).join('')}</optgroup>`;
    }).join('');
    this.updateCost();
  }

  get model() { return this.ctx.models.find((m) => m.id === this.el.model.value); }

  updateCost() {
    const m = this.model;
    if (!m) { this.el.cost.textContent = ''; return; }
    this.el.effort.style.display = m.reasoning ? '' : 'none';
    const mult = { low: 1, medium: 1.5, high: 2.5 }[m.reasoning ? this.el.effort.value : 'low'];
    const cost = Math.ceil(m.cost * mult) + (this.mode === 'playtest' ? 1 : 0);
    this.el.cost.textContent = `${cost} cr`;
    this.el.cost.title = `This request costs ${cost} credits · ${fmtCredits(this.ctx.me.user.credits)} left`;
  }

  renderContext() {
    const id = this.ctx.viewport.selectedId;
    const o = id && this.ctx.doc.byId(id);
    this.el.ctxLine.innerHTML = o ? `Context: <b>${esc(o.name)}</b> selected` : '';
  }

  bind() {
    this.el.form.addEventListener('submit', (e) => { e.preventDefault(); this.send(); });
    this.el.prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      e.stopPropagation();
    });
    this.el.prompt.addEventListener('input', () => {
      this.el.prompt.style.height = 'auto';
      this.el.prompt.style.height = `${Math.min(200, this.el.prompt.scrollHeight)}px`;
    });
    this.el.model.addEventListener('change', () => { localStorageSet('nezos.model', this.el.model.value); this.updateCost(); });
    this.el.effort.addEventListener('change', () => this.updateCost());
    this.el.mic.addEventListener('click', () => this.toggleMic());
  }

  // ------------------------------------------------------------ messages
  renderHistory() {
    this.el.messages.innerHTML = '';
    if (!this.history.length) {
      const w = h(`<div class="welcome"><div style="font-size:30px">✦</div><h3>What are we building?</h3>
        <div>Describe a game and I'll generate the world, models, code and UI. Use the toolbar for images, voices and more.</div>
        <div class="sugs">${WELCOME.map((s) => `<button type="button" class="sug">${esc(s)}</button>`).join('')}</div></div>`);
      w.querySelectorAll('.sug').forEach((b) => b.addEventListener('click', () => { this.setMode('game', { focus: false }); this.send(b.textContent); }));
      this.el.messages.appendChild(w);
      return;
    }
    for (const m of this.history) this.appendMessage(m, { scroll: false });
    this.scroll();
  }

  scroll() { this.el.messages.scrollTop = this.el.messages.scrollHeight; }

  appendMessage(m, { scroll = true } = {}) {
    this.el.messages.querySelector('.welcome')?.remove();
    let el;
    if (m.role === 'user') {
      el = h(`<div class="msg user"></div>`);
      el.textContent = m.text;
    } else {
      el = h(`<div class="msg ai ${m.error ? 'err' : ''}">${markdown(m.text || (m.error ? '' : 'Done.'))}</div>`);
      if (m.error && m.upgrade) el.appendChild(h('<div class="meta"><a class="link-btn" href="/dashboard#plans" target="_blank">Upgrade plan →</a></div>'));
      if (m.summary) el.appendChild(this.opsChips(m.summary));
      if (m.plan) {
        const card = h(`<div class="plan-card">${markdown(m.plan)}</div>`);
        el.appendChild(card);
        const b = h('<div class="meta"><button class="link-btn">🎮 Build this plan</button></div>');
        b.querySelector('button').onclick = () => { this.setMode('game', { focus: false }); this.send('Build the game from the plan above. Start with the core loop and level.'); };
        el.appendChild(b);
      }
      if (m.images?.length) {
        const box = h('<div class="sugs"></div>');
        for (const img of m.images) {
          const b = h(`<button type="button" class="sug">🖼 Generate ${img.target === 'sky' ? 'skybox' : `texture for ${esc(img.target || 'scene')}`}: “${esc(img.prompt.slice(0, 80))}”</button>`);
          b.onclick = () => {
            const target = img.target && img.target !== 'sky' ? this.ctx.doc.byName(img.target) : null;
            this.ctx.tools.imageDialog({ purpose: img.target === 'sky' ? 'sky' : target ? 'texture' : 'billboard', targetId: target?.id, prompt: img.prompt });
          };
          box.appendChild(b);
        }
        el.appendChild(box);
      }
      if (m.suggestions?.length) {
        const box = h('<div class="sugs"></div>');
        for (const s of m.suggestions) {
          const b = h(`<button type="button" class="sug">→ ${esc(s)}</button>`);
          b.onclick = () => this.send(s);
          box.appendChild(b);
        }
        el.appendChild(box);
      }
      const meta = h(`<div class="meta">${m.model ? `<span>${esc(m.model)}</span>` : ''}${m.cost ? `<span>· ${m.cost} cr</span>` : ''}</div>`);
      if (m.undo && this.ctx.undoSnapshots.has(m.undo)) {
        const u = h('<button class="link-btn">↶ Undo this change</button>');
        u.onclick = () => {
          this.ctx.doc.restore(this.ctx.undoSnapshots.get(m.undo));
          this.ctx.undoSnapshots.delete(m.undo);
          u.remove();
          toast('Reverted the AI change');
        };
        meta.appendChild(u);
      }
      if (meta.childNodes.length) el.appendChild(meta);
    }
    this.el.messages.appendChild(el);
    if (scroll) this.scroll();
    return el;
  }

  opsChips(s) {
    const box = h('<div class="ops"></div>');
    const add = (cls, text) => box.appendChild(h(`<span class="op ${cls}">${esc(text)}</span>`));
    if (s.replaced) add('', 'New scene');
    if (s.added?.length) add('', `+ ${s.added.length > 3 ? `${s.added.length} objects` : s.added.join(', ')}`);
    if (s.updated?.length) add('up', `~ ${s.updated.length > 3 ? `${s.updated.length} objects` : [...new Set(s.updated)].join(', ')}`);
    if (s.removed?.length) add('rm', `− ${s.removed.join(', ')}`);
    if (s.settings) add('up', 'Scene settings');
    if (s.script) add('up', 'Game script');
    if (s.errors?.length) add('rm', `${s.errors.length} skipped`);
    return box;
  }

  thinking(label) {
    const el = h(`<div class="msg ai"><div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="lbl">${esc(label)}</span><span class="t"></span></div></div>`);
    this.el.messages.appendChild(el);
    this.scroll();
    const t0 = Date.now();
    const timer = setInterval(() => { el.querySelector('.t').textContent = `${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);
    return {
      set: (text) => { el.querySelector('.lbl').textContent = text; },
      done: () => { clearInterval(timer); el.remove(); },
    };
  }

  push(m) {
    this.history.push({ ...m, at: Date.now() });
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    this.ctx.markDirty();
  }

  // ------------------------------------------------------------ send
  async send(text) {
    const message = (text ?? this.el.prompt.value).trim();
    if (!message || this.busy) return;
    const mode = this.mode;
    const model = this.model;
    if (!model) return toast('Pick a model first.', 'error');
    if (mode === 'playtest' && !this.plan.features.playtest) {
      return this.appendMessage({ role: 'ai', error: true, upgrade: true, text: 'AI playtesting is available on the **Mini** plan and above.' });
    }
    this.busy = true;
    this.el.send.disabled = true;
    this.el.prompt.value = '';
    this.el.prompt.style.height = '';
    const userMsg = { role: 'user', text: message, mode };
    this.push(userMsg);
    this.appendMessage(userMsg);

    const label = { game: 'Designing your game', scene: 'Building the scene', model: 'Modelling', code: 'Writing code', architect: 'Architecting', playtest: 'Playtesting', auto: 'Thinking' }[mode];
    const t = this.thinking(`${label} with ${model.name}…`);
    try {
      let report = null;
      let screenshot = null;
      if (mode === 'playtest') {
        t.set('Bot is playing your game…');
        report = await this.ctx.player.playtest(12);
        screenshot = report.screenshot;
        delete report.screenshot;
        t.set(`Analysing playtest with ${model.name}…`);
      }
      const sel = this.ctx.viewport.selectedId && this.ctx.doc.byId(this.ctx.viewport.selectedId);
      const before = JSON.stringify(this.ctx.doc.scene);
      const r = await api('/api/ai/chat', {
        method: 'POST',
        body: {
          mode,
          model: model.id,
          effort: this.el.effort.value,
          message,
          scene: this.ctx.doc.scene,
          selection: sel ? JSON.stringify(sel) : null,
          history: this.history.slice(-9, -1).map((x) => ({ role: x.role, text: x.text })),
          report,
          screenshot,
        },
      });
      this.ctx.onCredits(r.credits);
      const summary = this.ctx.doc.applyOps(r.ops);
      const changed = JSON.stringify(this.ctx.doc.scene) !== before;
      let undo = null;
      if (changed) {
        undo = Math.random().toString(36).slice(2);
        this.ctx.undoSnapshots.set(undo, before);
        if (summary.replaced || summary.added.length > 3) this.ctx.viewport.focus(null);
        if (mode === 'model' && summary.added.length === 1) {
          const o = this.ctx.doc.byName(summary.added[0]);
          if (o) { this.ctx.viewport.select(o.id); this.ctx.viewport.focus(o.id); }
        }
      }
      const aiMsg = {
        role: 'ai', text: r.reply || (changed ? 'Done. Press ▶ Play to try it.' : 'No changes needed.'), mode, model: r.model, cost: r.cost,
        summary: changed ? summary : null, plan: r.plan, suggestions: r.suggestions, images: r.images, undo,
      };
      t.done();
      this.push(aiMsg);
      this.appendMessage(aiMsg);
      if (mode === 'playtest' || mode === 'architect') this.setMode('auto', { focus: false });
    } catch (err) {
      t.done();
      const errMsg = { role: 'ai', error: true, upgrade: !!err.upgrade || err.status === 402, text: `⚠️ ${err.message}` };
      this.appendMessage(errMsg);
      if (err.status !== 402 && !err.upgrade) this.el.prompt.value = message;
    } finally {
      this.busy = false;
      this.el.send.disabled = false;
      this.updateCost();
    }
  }

  ask(text, mode = 'auto') {
    this.setMode(mode, { focus: false });
    this.send(text);
  }

  prefill(text, mode) {
    if (mode) this.setMode(mode);
    this.el.prompt.value = text;
    this.el.prompt.focus();
    this.el.prompt.setSelectionRange(text.length, text.length);
  }

  // ------------------------------------------------------------ voice input
  async toggleMic() {
    if (!this.plan.features.voiceInput) {
      toast('Voice prompts are available on the Starter plan and above.', 'error');
      return;
    }
    if (this.rec) { this.rec.stop(); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast('Microphone permission denied.', 'error');
      return;
    }
    const chunks = [];
    const rec = new MediaRecorder(stream);
    this.rec = rec;
    this.el.mic.classList.add('rec');
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      this.rec = null;
      this.el.mic.classList.remove('rec');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size < 1000) return;
      try {
        const r = await api('/api/ai/transcribe', { method: 'POST', raw: blob, headers: { 'Content-Type': blob.type.split(';')[0] || 'audio/webm' } });
        this.ctx.onCredits(r.credits);
        this.el.prompt.value = (this.el.prompt.value ? `${this.el.prompt.value} ` : '') + r.text;
        this.el.prompt.focus();
      } catch (err) {
        toast(err.message, 'error');
      }
    };
    rec.start();
    setTimeout(() => { if (this.rec === rec) rec.stop(); }, 60_000);
  }
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
