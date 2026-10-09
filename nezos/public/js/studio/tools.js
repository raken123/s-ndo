// Studio dialogs: AI image / voice / video generation, script editor, share.
import { api, esc, h, toast } from '../api.js';

export function modal(html, { wide = false } = {}) {
  const back = h(`<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`);
  document.body.appendChild(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { el: back.querySelector('.modal'), close };
}

function upgradeNote(err) {
  return err.upgrade || err.status === 402
    ? `<div class="upgrade-note">${esc(err.message)} <a href="/dashboard#plans" target="_blank">See plans →</a></div>`
    : `<div class="upgrade-note">${esc(err.message)}</div>`;
}

function modelOptions(models, kind, preferred) {
  const list = models.filter((m) => m.kind === kind && !m.snapshotOf);
  const first = list.find((m) => m.id === preferred && m.allowed) || list.find((m) => m.allowed);
  return list.map((m) => `<option value="${esc(m.id)}" ${m.allowed ? '' : 'disabled'} ${m === first ? 'selected' : ''}>${esc(m.name)} · ${m.cost} cr${m.allowed ? '' : ` 🔒 ${esc(m.minPlanName)}`}</option>`).join('');
}

export class Tools {
  constructor(ctx) {
    this.ctx = ctx; // { doc, viewport, models, me, onCredits, assets, project }
  }

  // ------------------------------------------------------------ image
  imageDialog({ purpose = 'billboard', targetId = null, prompt = '' } = {}) {
    const { doc, models, me } = this.ctx;
    const target = targetId && doc.byId(targetId);
    const m = modal(`
      <h2>✨ Generate image</h2>
      <p class="sub">${target ? `For <b>${esc(target.name)}</b>` : 'Create textures, skyboxes, sprites and in-world images.'}</p>
      <label class="field"><span>Prompt</span><textarea class="input" name="prompt" rows="3" placeholder="e.g. mossy cobblestone, hand-painted fantasy style">${esc(prompt)}</textarea></label>
      <label class="field"><span>Use as</span><div class="radio-row">
        ${[['billboard', '🖼 Image in scene'], ['texture', '🧱 Texture'], ['sky', '🌌 Skybox'], ['sprite', '👾 Sprite (transparent)']].map(([v, l]) => `<label><input type="radio" name="purpose" value="${v}" ${v === purpose ? 'checked' : ''}>${l}</label>`).join('')}
      </div></label>
      <label class="field"><span>Model</span><select class="input" name="model">${modelOptions(models, 'image', me.defaults?.image)}</select></label>
      <div id="out"></div>
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-go>Generate</button></div>`);
    const el = m.el;
    const out = el.querySelector('#out');
    el.querySelector('textarea').focus();
    el.querySelector('[data-go]').onclick = async () => {
      const p = el.querySelector('[name=prompt]').value.trim();
      const purp = el.querySelector('[name=purpose]:checked').value;
      if (!p) return toast('Describe the image first.', 'error');
      const btn = el.querySelector('[data-go]');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      out.innerHTML = '<div class="progress"><i style="width:35%"></i></div>';
      let w = 35;
      const tick = setInterval(() => { w = Math.min(92, w + 3); out.querySelector('i')?.style.setProperty('width', `${w}%`); }, 800);
      try {
        const r = await api('/api/ai/image', { method: 'POST', body: { prompt: p, model: el.querySelector('[name=model]').value, purpose: purp, transparent: purp === 'sprite' } });
        this.ctx.onCredits(r.credits);
        this.ctx.assets.add({ kind: 'image', url: r.url, prompt: p });
        this.applyImage(r.url, purp, targetId, p);
        toast(`Image generated (−${r.cost} credits)`, 'ok');
        m.close();
      } catch (err) {
        out.innerHTML = upgradeNote(err);
        btn.disabled = false;
        btn.textContent = 'Try again';
      } finally {
        clearInterval(tick);
      }
    };
  }

  applyImage(url, purpose, targetId, prompt = '') {
    const { doc, viewport } = this.ctx;
    if (purpose === 'sky') {
      doc.change((s) => { s.settings = { ...s.settings, skyTexture: url }; }, 'settings');
      return;
    }
    const target = targetId && doc.byId(targetId);
    if (purpose === 'texture' && target) {
      doc.update(target.id, { texture: url, color: '#ffffff', textureRepeat: target.type === 'plane' || target.scale?.[0] > 4 ? [Math.max(1, Math.round(target.scale[0] / 4)), Math.max(1, Math.round(target.scale[2] / 4))] : [1, 1] });
      return;
    }
    if (target && target.type === 'image') {
      doc.update(target.id, { texture: url });
      return;
    }
    const p = viewport.dropPoint();
    const o = doc.add({
      name: purpose === 'sprite' ? 'Sprite' : purpose === 'texture' ? 'Textured cube' : 'Image',
      type: purpose === 'texture' ? 'box' : 'image',
      texture: url,
      position: [+p.x.toFixed(2), purpose === 'texture' ? 0.5 : 1.5, +p.z.toFixed(2)],
      scale: purpose === 'texture' ? [1, 1, 1] : [3, 3, 1],
      billboard: purpose === 'sprite',
      props: prompt ? { prompt: prompt.slice(0, 200) } : undefined,
    });
    viewport.select(o.id);
  }

  // ------------------------------------------------------------ voice (TTS)
  audioDialog({ targetId = null } = {}) {
    const { models } = this.ctx;
    const voices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
    const m = modal(`
      <h2>🎙️ AI voice line</h2>
      <p class="sub">Narration, character dialogue or announcer lines. Play them from scripts with <code>game.sound.play("Name")</code>.</p>
      <label class="field"><span>Line</span><textarea class="input" name="text" rows="3" placeholder="Welcome, traveller! Collect all the crystals before the sun sets."></textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label class="field"><span>Voice</span><select class="input" name="voice">${voices.map((v) => `<option>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Model</span><select class="input" name="model">${modelOptions(models, 'tts', 'gpt-4o-mini-tts')}</select></label>
      </div>
      <label class="field"><span>Style (optional)</span><input class="input" name="style" placeholder="excited pirate captain, a little raspy"></label>
      <div id="out"></div>
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-go>Generate voice</button></div>`);
    const el = m.el;
    el.querySelector('textarea').focus();
    el.querySelector('[data-go]').onclick = async () => {
      const text = el.querySelector('[name=text]').value.trim();
      if (!text) return toast('Write the line first.', 'error');
      const btn = el.querySelector('[data-go]');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      try {
        const r = await api('/api/ai/speech', { method: 'POST', body: { text, voice: el.querySelector('[name=voice]').value, model: el.querySelector('[name=model]').value, instructions: el.querySelector('[name=style]').value } });
        this.ctx.onCredits(r.credits);
        this.ctx.assets.add({ kind: 'audio', url: r.url, prompt: text });
        const { doc, viewport } = this.ctx;
        if (targetId && doc.byId(targetId)) doc.update(targetId, { audio: { src: r.url } });
        else {
          const p = viewport.dropPoint();
          const o = doc.add({ name: `Voice ${text.slice(0, 18).replace(/[^\w ]/g, '').trim() || 'line'}`, type: 'audio', position: [+p.x.toFixed(2), 1, +p.z.toFixed(2)], audio: { src: r.url, autoplay: false } });
          viewport.select(o.id);
        }
        new Audio(r.url).play().catch(() => {});
        toast(`Voice line added (−${r.cost} credits)`, 'ok');
        m.close();
      } catch (err) {
        el.querySelector('#out').innerHTML = upgradeNote(err);
        btn.disabled = false;
        btn.textContent = 'Generate voice';
      }
    };
  }

  // ------------------------------------------------------------ video (Sora)
  videoDialog({ targetId = null } = {}) {
    const { models } = this.ctx;
    const m = modal(`
      <h2>🎬 AI video clip</h2>
      <p class="sub">Generate a cutscene or animated screen with Sora. It plays on a screen object in your world. This takes a few minutes.</p>
      <label class="field"><span>Prompt</span><textarea class="input" name="prompt" rows="3" placeholder="Cinematic flyover of a glowing crystal castle at dusk"></textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <label class="field"><span>Model</span><select class="input" name="model">${modelOptions(models, 'video', 'sora-2')}</select></label>
        <label class="field"><span>Length</span><select class="input" name="seconds"><option value="4">4 seconds</option><option value="8">8 seconds</option><option value="12">12 seconds</option></select></label>
      </div>
      <div id="out"></div>
      <div class="actions"><button class="btn" data-close>Close</button><button class="btn btn-primary" data-go>Generate video</button></div>`);
    const el = m.el;
    el.querySelector('textarea').focus();
    el.querySelector('[data-go]').onclick = async () => {
      const prompt = el.querySelector('[name=prompt]').value.trim();
      if (!prompt) return toast('Describe the video first.', 'error');
      const btn = el.querySelector('[data-go]');
      const out = el.querySelector('#out');
      btn.disabled = true;
      btn.textContent = 'Queued…';
      try {
        const r = await api('/api/ai/video', { method: 'POST', body: { prompt, model: el.querySelector('[name=model]').value, seconds: +el.querySelector('[name=seconds]').value } });
        this.ctx.onCredits(r.credits);
        out.innerHTML = '<div class="progress"><i style="width:3%"></i></div><p class="muted" id="vstat">Queued…</p>';
        for (;;) {
          await new Promise((res) => setTimeout(res, 5000));
          const s = await api(`/api/ai/video/${r.jobId}`);
          out.querySelector('i').style.width = `${Math.max(3, s.progress || 0)}%`;
          out.querySelector('#vstat').textContent = `${s.status}${s.progress ? ` · ${s.progress}%` : ''}`;
          btn.textContent = s.status === 'in_progress' ? 'Rendering…' : 'Queued…';
          if (s.url) {
            this.ctx.assets.add({ kind: 'video', url: s.url, prompt });
            const { doc, viewport } = this.ctx;
            if (targetId && doc.byId(targetId)) doc.update(targetId, { video: { src: s.url, loop: true } });
            else {
              const p = viewport.dropPoint();
              const o = doc.add({ name: 'Video screen', type: 'video', position: [+p.x.toFixed(2), 2.5, +p.z.toFixed(2)], scale: [6.4, 3.6, 1], video: { src: s.url, loop: true } });
              viewport.select(o.id);
            }
            toast('Video ready!', 'ok');
            m.close();
            return;
          }
          if (s.status === 'failed') throw new Error(s.error || 'Video generation failed (credits refunded).');
        }
      } catch (err) {
        out.innerHTML = upgradeNote(err);
        btn.disabled = false;
        btn.textContent = 'Generate video';
      }
    };
  }

  // ------------------------------------------------------------ code editor
  scriptEditor(targetId, { onAsk } = {}) {
    const { doc } = this.ctx;
    const target = targetId && doc.byId(targetId);
    const code = target ? target.script || '' : doc.scene.script || '';
    const placeholder = target
      ? `// Runs when the game starts. "self" is ${target.name}.\nself.onUpdate((dt) => {\n  self.rotation.y += dt;\n});`
      : `// Global game script. Runs when the game starts.\nconst player = game.controls.platformer('Player');\ngame.ui.set('score', 'Score: 0');`;
    const m = modal(`
      <h2>⌨️ ${target ? `Script: ${esc(target.name)}` : 'Game script'}</h2>
      <p class="sub">JavaScript using the Nezos API (<code>game</code>, <code>self</code>, <code>THREE</code>). Errors show in the console when you press Play.</p>
      <textarea class="code-area" spellcheck="false" placeholder="${esc(placeholder)}">${esc(code)}</textarea>
      <div class="row" style="margin-top:10px;gap:8px"><input class="input" id="askAi" placeholder="Ask AI to write or change this code… (Enter)"><button class="btn" id="askBtn">✨ Ask</button></div>
      <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button></div>`, { wide: true });
    const ta = m.el.querySelector('textarea');
    ta.focus();
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: a, selectionEnd: b } = ta;
        ta.setRangeText('  ', a, b, 'end');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    });
    const save = () => {
      if (target) doc.update(target.id, { script: ta.value }, 'script');
      else doc.change((s) => { s.script = ta.value; }, 'script');
      toast('Script saved', 'ok', 1500);
      m.close();
    };
    m.el.querySelector('[data-save]').onclick = save;
    const ask = () => {
      const q = m.el.querySelector('#askAi').value.trim();
      if (!q) return;
      if (ta.value !== code) save(); else m.close();
      onAsk?.(q, target);
    };
    m.el.querySelector('#askBtn').onclick = ask;
    m.el.querySelector('#askAi').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  }

  // ------------------------------------------------------------ share / export
  async share() {
    const { project } = this.ctx;
    const m = modal(`<h2>🔗 Share your game</h2><p class="sub">Anyone with the link can play the latest saved version.</p><div id="out"><div class="progress"><i style="width:50%"></i></div></div>
      <div class="actions"><button class="btn" data-unpub hidden>Unpublish</button><button class="btn" data-close>Close</button></div>`);
    try {
      await this.ctx.saveNow();
      const r = await api(`/api/projects/${project.id}/publish`, { method: 'POST', body: { publish: true } });
      const url = `${location.origin}/g/${r.shareId}`;
      m.el.querySelector('#out').innerHTML = `<div class="row"><input class="input" readonly value="${esc(url)}"><button class="btn" id="copy">Copy</button></div><p><a href="${esc(url)}" target="_blank" rel="noopener">Open game ↗</a></p>`;
      m.el.querySelector('#copy').onclick = () => navigator.clipboard.writeText(url).then(() => toast('Link copied', 'ok'));
      const un = m.el.querySelector('[data-unpub]');
      un.hidden = false;
      un.onclick = async () => { await api(`/api/projects/${project.id}/publish`, { method: 'POST', body: { publish: false } }); toast('Game unpublished'); m.close(); };
    } catch (err) {
      m.el.querySelector('#out').innerHTML = upgradeNote(err);
    }
  }

  async exportHtml() {
    await this.ctx.saveNow();
    const a = document.createElement('a');
    a.href = `/api/projects/${this.ctx.project.id}/export`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Exporting a single-file HTML game…', 'ok');
  }

  shortcuts() {
    const rows = [['W / E / R', 'Move / rotate / scale gizmo'], ['F', 'Focus selection'], ['Delete', 'Delete selection'], ['Ctrl+D', 'Duplicate'], ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'], ['Ctrl+S', 'Save'], ['Ctrl+Enter', 'Play'], ['Esc', 'Deselect / stop play'], ['/', 'Focus the AI chat']];
    modal(`<h2>Keyboard shortcuts</h2><table class="shortcuts">${rows.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table><div class="actions"><button class="btn" data-close>Close</button></div>`);
  }
}
