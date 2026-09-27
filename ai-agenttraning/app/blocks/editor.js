// The "Koda med block" screen: Scratch's block editor, the stage, sprites,
// costumes and sounds, and saving projects.
(function () {
'use strict';
const RB = window.RB; const B = window.Blockly;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};
const H = () => RB.host;
const LIST_KEY = 'projects', CUR_KEY = 'raken-ai-block-current';
const E = { project: null, targetId: null, ws: null, vm: null, saveT: 0, wsT: 0, glow: new Set(), inited: false, pane: 'blocks', full: false };
RB.E = E;

/* ---------- access for menus and the VM ---------- */
const target = () => E.project && (E.project.targets.find(t => t.id === E.targetId) || E.project.targets[0]);
const stage = () => E.project && E.project.targets.find(t => t.isStage);
const sprites = () => E.project ? E.project.targets.filter(t => !t.isStage) : [];
RB.editor = {
  target, stage, sprites,
  varNames(owner) { return Object.values(E.project ? E.project.variables : {}).filter(v => v.type === '' && v.owner === owner).map(v => v.name); },
  isMonitored(id) { return !!(E.project && E.project.monitors[id] && E.project.monitors[id].visible); },
};

/* ---------- media paths: the editor's images are inlined ---------- */
(function patchMedia() {
  // our workspaces use 'sbmedia/'; a bare Blockly.Workspace falls back to '../media/'
  const map = v => {
    if (typeof v !== 'string' || v.startsWith('data:')) return v;
    const m = /(?:^|\/)(?:sb)?media\/(.+)$/.exec(v);
    return (m && window.SB_MEDIA[m[1]]) || v;
  };
  const ns = Element.prototype.setAttributeNS; Element.prototype.setAttributeNS = function (n, k, v) { return ns.call(this, n, k, map(v)); };
  const sa = Element.prototype.setAttribute; Element.prototype.setAttribute = function (k, v) { return sa.call(this, k, map(v)); };
})();

// Blockly's stylesheet points at its cursors and sprite sheet by path. After each
// inject, inline them and hand Blockly the re-parsed sheet (it removes it later).
(function patchCss() {
  const inject = B.inject;
  B.inject = function () {
    const ws = inject.apply(this, arguments);
    for (const st of document.querySelectorAll('style')) {
      if (!st.textContent.includes('sbmedia/')) continue;
      st.textContent = st.textContent.replace(/sbmedia\/([\w\/.-]+)/g, (m, n) => window.SB_MEDIA[n] || m);
      if (st.textContent.includes('.blocklyDraggable')) B.Css.styleSheet_ = st.sheet;
    }
    return ws;
  };
  Object.assign(B.inject, inject); // it carries helpers such as bindDocumentEvents_
})();

/* ---------- dialogs replacing window.prompt (not available in the desktop app) ---------- */
function promptDialog(message, dflt, callback, title, varType) {
  const d = $('#dlgBlk'); const t = target();
  const newVar = (title === B.Msg.VARIABLE_MODAL_TITLE || title === B.Msg.LIST_MODAL_TITLE) && (varType === '' || varType === 'list');
  $('#blkTitle').textContent = title || message; $('#blkText').textContent = title ? message : '';
  const inp = $('#blkInput'); inp.value = dflt || '';
  $('#blkScope').hidden = !(newVar && t && !t.isStage);
  $('#blkScopeAll').checked = true;
  d.returnValue = '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return callback(null);
    callback(inp.value.trim(), [], { scope: $('#blkScopeOne').checked && !$('#blkScope').hidden ? 'local' : 'global', isCloud: false });
  };
  d.showModal(); inp.select();
}
function simpleDialog(text, withCancel) {
  return new Promise(res => {
    const d = $('#dlgBlk'); $('#blkTitle').textContent = text; $('#blkText').textContent = '';
    $('#blkInput').hidden = true; $('#blkScope').hidden = true; $('#blkCancel').hidden = !withCancel;
    d.returnValue = ''; d.onclose = () => { $('#blkInput').hidden = false; $('#blkCancel').hidden = false; res(d.returnValue === 'ok'); };
    d.showModal();
  });
}
B.prompt = promptDialog;
B.alert = (msg, cb) => simpleDialog(msg, false).then(() => cb && cb());
B.confirm = (msg, cb) => simpleDialog(msg, true).then(ok => cb(ok));

/* ---------- "Make a Block" ---------- */
// scratch-blocks names new inputs and labels in English; use Swedish
(function swedishProcedureInputs() {
  const D = B.Blocks.procedures_declaration;
  for (const [fn, to, isLabel] of [['addLabelExternal', 'etikett', true], ['addStringNumberExternal', 'tal eller text'], ['addBooleanExternal', 'sant eller falskt']]) {
    const orig = D[fn];
    D[fn] = function () {
      orig.call(this);
      if (isLabel) this.procCode_ = this.procCode_.replace(/ label text$/, ' ' + to);
      else this.displayNames_[this.displayNames_.length - 1] = to;
      this.updateDisplay_(); if (this.focusLastEditor_) this.focusLastEditor_();
    };
  }
})();
B.Procedures.externalProcedureDefCallback = function (mutation, callback) {
  const d = $('#dlgProc'); const host = $('#procWs'); host.innerHTML = '';
  d.returnValue = ''; d.showModal();
  const pws = B.inject(host, { media: 'sbmedia/', zoom: { controls: false, wheel: false, startScale: 0.9 }, comments: false, collapse: false, scrollbars: true, sounds: false });
  const root = pws.newBlock('procedures_declaration');
  root.domToMutation(mutation); root.initSvg(); root.render(false);
  root.setMovable(false); root.setDeletable(false); root.contextMenu = false;
  const center = () => {
    const m = pws.getMetrics(); const { x, y } = root.getRelativeToSurfaceXY();
    let dx = m.viewWidth / 2 - root.width / 2 - x; const dy = m.viewHeight / 2 - root.height / 2 - y;
    if (root.width > m.viewWidth) dx = m.viewWidth - root.width - x;
    root.moveBy(dx, dy);
  };
  pws.addChangeListener(() => { root.onChangeFn(); center(); });
  center();
  const warp = $('#procWarp'); warp.checked = mutation.getAttribute('warp') === 'true';
  $('#procText').onclick = () => root.addStringNumberExternal();
  $('#procBool').onclick = () => root.addBooleanExternal();
  $('#procLabel').onclick = () => root.addLabelExternal();
  d.onclose = () => {
    let out = null;
    if (d.returnValue === 'ok') { out = root.mutationToDom(true); out.setAttribute('warp', String(warp.checked)); }
    pws.dispose(); callback(out);
  };
};

/* ---------- projects ---------- */
function newTarget(isStage, name, costumes, sounds, extra) {
  return Object.assign({ id: isStage ? 'stage' : RB.uid(), isStage, name, costumes, sounds: sounds || [], currentCostume: 0, blocks: '<xml xmlns="http://www.w3.org/1999/xhtml"></xml>',
    x: 0, y: 0, direction: 90, size: 100, visible: true, draggable: false, rotationStyle: 'all around', volume: 100 }, isStage ? { tempo: 60 } : {}, extra || {});
}
RB.newTarget = newTarget;
async function blankProject(name) {
  const ag = H().agent();
  const cost = await RB.agentCostume(ag, ag ? ag.name : 'Robot');
  return {
    id: RB.uid(), name, created: Date.now(), updated: Date.now(), variables: {}, monitors: {},
    targets: [newTarget(true, 'Scen', [RB.library.backdrop('Vit')]),
      newTarget(false, ag ? ag.name.slice(0, 20) : 'Robot', [cost], [RB.library.sound('Pop')])],
  };
}
RB.blankProject = blankProject;
async function listProjects() { return (await RB.store.get(LIST_KEY)) || []; }
async function persist(now) {
  clearTimeout(E.saveT);
  const go = async () => {
    const p = E.project; if (!p) return;
    E.vm.snapshot(p); p.updated = Date.now();
    await RB.store.set('project:' + p.id, p);
    const list = (await listProjects()).filter(x => x.id !== p.id);
    list.unshift({ id: p.id, name: p.name, updated: p.updated });
    await RB.store.set(LIST_KEY, list);
    try { localStorage.setItem(CUR_KEY, p.id); } catch (e) { }
  };
  if (now) return go();
  E.saveT = setTimeout(go, 700);
}
RB.persist = persist;
async function openProject(p) {
  if (E.project) { saveWorkspace(); await persist(true); }
  // older files may lack parts
  p.variables = p.variables || {}; p.monitors = p.monitors || {};
  if (!p.targets.some(t => t.isStage)) p.targets.unshift(newTarget(true, 'Scen', [RB.library.backdrop('Vit')]));
  E.project = p; E.targetId = (p.targets.find(t => !t.isStage) || p.targets[0]).id;
  await E.vm.load(p);
  loadWorkspace(); renderAll(); await persist(true); fillProjectSelect();
}
RB.openProject = openProject;
async function fillProjectSelect() {
  const sel = $('#pSel'); const list = await listProjects(); sel.innerHTML = '';
  for (const p of list) sel.append(el('option', { value: p.id, text: p.name }));
  if (E.project) sel.value = E.project.id;
}

/* ---------- workspace ---------- */
function varsXml(t) {
  const vars = Object.entries(E.project.variables).filter(([, v]) => v.owner === 'stage' || v.owner === t.id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return '<variables>' + vars.map(([id, v]) => `<variable type="${v.type}" id="${esc(id)}" islocal="${v.owner !== 'stage'}" iscloud="false">${esc(v.name)}</variable>`).join('') + '</variables>';
}
function loadWorkspace() {
  const t = target(); if (!t || !E.ws) return;
  const dom = B.Xml.textToDom(t.blocks || '<xml></xml>');
  const old = dom.querySelector('variables'); if (old) old.remove();
  dom.insertBefore(B.Xml.textToDom('<xml>' + varsXml(t) + '</xml>').firstChild, dom.firstChild);
  B.Events.disable();
  try {
    E.ws.clear();
    E.ws.updateToolbox(RB.toolbox(t, stage()));
    B.Xml.domToWorkspace(dom, E.ws);
  } catch (e) { console.error(e); }
  finally { B.Events.enable(); }
  reconcileVars();
  if (t.cleanup) { delete t.cleanup; E.ws.cleanUp(); saveWorkspace(); }
  E.ws.clearUndo(); E.glow.clear();
  if (E.ws.getToolbox && E.ws.getToolbox()) E.ws.getToolbox().refreshSelection();
}
function refreshToolbox() {
  if (!E.ws) return;
  E.ws.updateToolbox(RB.toolbox(target(), stage()));
  if (E.ws.getToolbox && E.ws.getToolbox()) E.ws.getToolbox().refreshSelection();
}
RB.refreshToolbox = refreshToolbox;
function reconcileVars() { // variables Blockly made on its own (e.g. from a pasted script) join the project
  const t = target();
  for (const v of E.ws.getAllVariables()) {
    const reg = E.project.variables[v.getId()];
    if (!reg) addVar(v.getId(), v.name, v.type, v.isLocal && !t.isStage && v.type !== 'broadcast_msg' ? t.id : 'stage');
    else if (reg.name !== v.name) reg.name = v.name;
  }
}
function addVar(id, name, type, owner) {
  E.project.variables[id] = { name, type, owner, value: type === 'list' ? [] : 0 };
  const vt = owner === 'stage' ? E.vm.stage : E.vm.targets.find(x => x.id === owner && !x.isClone);
  if (vt && type !== 'broadcast_msg') vt.vars.set(id, { id, name, type, value: type === 'list' ? [] : 0 });
}
function saveWorkspace() {
  clearTimeout(E.wsT);
  const t = target(); if (!t || !E.ws) return;
  const dom = B.Xml.workspaceToDom(E.ws); const v = dom.querySelector('variables'); if (v) v.remove();
  const xml = B.Xml.domToText(dom);
  if (xml !== t.blocks) { t.blocks = xml; E.vm.recompile(t.id, xml); persist(); }
}
function onWsEvent(e) {
  if (!E.project) return;
  if (e.type === B.Events.VAR_CREATE) {
    if (!E.project.variables[e.varId]) {
      const t = target(); addVar(e.varId, e.varName, e.varType, e.isLocal && !t.isStage && e.varType !== 'broadcast_msg' ? t.id : 'stage'); persist();
    }
    return;
  }
  if (e.type === B.Events.VAR_RENAME) {
    const v = E.project.variables[e.varId]; if (v) v.name = e.newName;
    for (const t of E.vm.targets) { const x = t.vars.get(e.varId); if (x) x.name = e.newName; }
    persist(); return;
  }
  if (e.type === B.Events.VAR_DELETE) {
    delete E.project.variables[e.varId]; delete E.project.monitors[e.varId];
    for (const t of E.vm.targets) t.vars.delete(e.varId);
    E.vm.monitors.delete(e.varId); renderMonitors(true); persist(); return;
  }
  if (e.type === B.Events.UI) {
    if (e.element === 'stackclick') runClicked(e.blockId);
    return;
  }
  if (e.type === B.Events.CHANGE && e.element === 'checkbox') { toggleMonitor(e.blockId, e.newValue); return; }
  if (e.type === B.Events.CREATE || e.type === B.Events.DELETE || e.type === B.Events.CHANGE || e.type === B.Events.MOVE) {
    clearTimeout(E.wsT); E.wsT = setTimeout(saveWorkspace, 250);
  }
}
function runClicked(id) {
  const b = E.ws.getBlockById(id); if (!b) return;
  const root = b.getRootBlock();
  const xml = '<xml>' + B.Xml.domToText(B.Xml.blockToDom(root)) + '</xml>';
  const top = RB.parseXml(xml)[0]; if (!top) return;
  if (RB.HATS.has(top.op) && top.op !== 'procedures_definition' && !top.next) return;
  saveWorkspace();
  E.vm.toggleStack(target().id, top.op === 'procedures_definition' ? top.next : top);
}
function toggleMonitor(id, on) {
  const P = E.project; const t = target();
  if (!on) { if (P.monitors[id]) P.monitors[id].visible = false; E.vm.monitors.delete(id); renderMonitors(true); persist(); return; }
  let m;
  const v = P.variables[id];
  if (v) m = { id, opcode: v.type === 'list' ? 'data_listcontents' : 'data_variable', targetId: v.owner === 'stage' ? null : v.owner, visible: true };
  else {
    const fb = E.ws.getFlyout().getWorkspace().getBlockById(id); if (!fb) return;
    const fields = {}; for (const inp of fb.inputList) for (const f of inp.fieldRow) if (f.name) fields[f.name] = f.getValue();
    m = { id, opcode: fb.type, targetId: id.startsWith(t.id + '_') ? t.id : null, fields, visible: true, label: monitorLabel(fb, t) };
  }
  P.monitors[id] = m; E.vm.monitors.set(id, Object.assign({}, m)); renderMonitors(true); persist();
}
function monitorLabel(fb, t) {
  const text = fb.inputList.map(i => i.fieldRow.map(f => f.getText ? f.getText() : '').join(' ')).join(' ').replace(/\s+/g, ' ').trim();
  return (fb.type.startsWith('motion_') || fb.type.startsWith('looks_costume') || fb.type === 'looks_size' || fb.type === 'sound_volume' ? t.name + ': ' : '') + text;
}

/* ---------- monitors on the stage ---------- */
let monCache = {};
function renderMonitors(rebuild) {
  const box = $('#monitors'); if (!box || !E.vm) return;
  if (rebuild) { box.innerHTML = ''; monCache = {}; }
  let yAuto = 5;
  for (const [id, m] of E.vm.monitors) {
    const P = E.project; const reg = P.variables[id];
    let node = monCache[id];
    const isList = m.opcode === 'data_listcontents';
    if (!node) {
      const owner = m.targetId && P.targets.find(t => t.id === m.targetId);
      const label = reg ? (owner ? owner.name + ': ' : '') + reg.name : (m.label || m.opcode);
      node = monCache[id] = el('div', { class: 'mon' + (isList ? ' list' : '') }, el('span', { class: 'mon-l', text: label }), el(isList ? 'ol' : 'b', { class: 'mon-v' }));
      box.append(node);
    }
    node.style.left = (m.x != null ? m.x : 5) + 'px'; node.style.top = (m.y != null ? m.y : yAuto) + 'px';
    yAuto += isList ? 150 : 27;
    const val = E.vm.monitorValue(m);
    const key = isList ? JSON.stringify(val) : String(val);
    if (node._v !== key) {
      node._v = key; const v = node.querySelector('.mon-v');
      if (isList) { v.innerHTML = ''; (val || []).slice(0, 200).forEach(x => v.append(el('li', { text: String(x) }))); if (!(val || []).length) v.append(el('li', { class: 'empty', text: '(tom)' })); }
      else { let s = String(val); if (typeof val === 'number' && !Number.isInteger(val)) s = String(Math.round(val * 1e6) / 1e6); v.textContent = s; }
    }
  }
}

/* ---------- stage input ---------- */
function stagePoint(ev) {
  const r = $('#stage').getBoundingClientRect();
  return { x: Math.round(((ev.clientX - r.left) / r.width) * 480 - 240), y: Math.round(180 - ((ev.clientY - r.top) / r.height) * 360) };
}
let drag = null;
function wireStage() {
  const cv = $('#stage');
  cv.addEventListener('pointerdown', ev => {
    ev.preventDefault(); cv.setPointerCapture(ev.pointerId); E.vm.sound.ac();
    const p = stagePoint(ev); Object.assign(E.vm.mouse, p, { down: true });
    const t = E.vm.topAt(p.x, p.y);
    E.vm.click(t);
    if (t && (!E.full || t.draggable)) {
      drag = { t, dx: t.x - p.x, dy: t.y - p.y, moved: false };
      if (!t.isClone && t.id !== E.targetId) selectTarget(t.id);
    }
  });
  cv.addEventListener('pointermove', ev => {
    const p = stagePoint(ev); Object.assign(E.vm.mouse, p);
    $('#stageXY').textContent = `x: ${p.x}  y: ${p.y}`;
    if (drag) { drag.moved = true; drag.t.setXY(p.x + drag.dx, p.y + drag.dy); if (!drag.t.isClone && drag.t.id === E.targetId) fillSpriteInfo(); }
  });
  const up = () => {
    E.vm.mouse.down = false;
    if (drag && drag.moved && !drag.t.isClone) { refreshToolbox(); persist(); }
    drag = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const KEYS = { ' ': 'space', ArrowUp: 'up arrow', ArrowDown: 'down arrow', ArrowLeft: 'left arrow', ArrowRight: 'right arrow', Enter: 'enter' };
  const keyName = e => KEYS[e.key] || (e.key.length === 1 ? e.key.toLowerCase() : null);
  const typing = () => { const a = document.activeElement; return a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable) || (B.WidgetDiv && B.WidgetDiv.isVisible()); };
  document.addEventListener('keydown', e => {
    if ($('#v-code').hidden || typing() || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyName(e); if (!k) return;
    if (e.key === 'Escape' && E.full) return;
    if (!E.vm.keys.has(k)) E.vm.keyDown(k);
    if (k === 'space' || k.endsWith('arrow')) e.preventDefault();
  });
  document.addEventListener('keyup', e => { const k = keyName(e); if (k) E.vm.keyUp(k); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && E.full) setFull(false); });
  $('#askBox').addEventListener('submit', e => {
    e.preventDefault(); const q = E.vm.askQ; if (q) q.done($('#stageAsk').value); $('#stageAsk').value = '';
  });
}
function sizeStage() {
  const wrap = $('#stageWrap'); if (!wrap) return;
  let w = wrap.clientWidth;
  if (E.full) w = Math.min(window.innerWidth - 32, (window.innerHeight - 90) * 4 / 3);
  const h = w * 0.75, cv = $('#stage'), dpr = window.devicePixelRatio || 1;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const pw = Math.round(w * dpr); if (cv.width !== pw) { cv.width = pw; cv.height = Math.round(h * dpr); }
  $('#monitors').style.transform = `scale(${w / 480})`;
  E.vm && (E.vm.redraw = true);
}
function setFull(on) {
  E.full = on; $('#stageWrap').classList.toggle('full', on); document.body.classList.toggle('stage-full', on);
  $('#goFull').textContent = on ? '✕' : '⛶'; sizeStage();
}

/* ---------- side panels ---------- */
function renderAll() { renderSprites(); fillSpriteInfo(); renderPane(); renderMonitors(true); sizeStage(); }
function selectTarget(id) {
  saveWorkspace(); E.targetId = id; loadWorkspace(); renderSprites(); fillSpriteInfo(); renderPane();
}
RB.selectTarget = selectTarget;
function thumb(c) { return el('img', { src: c ? c.url : '', alt: '', draggable: 'false' }); }
function renderSprites() {
  const box = $('#spriteList'); box.innerHTML = '';
  for (const s of sprites()) {
    box.append(el('button', { class: 'sprite-tile' + (s.id === E.targetId ? ' on' : ''), title: s.name, onclick: () => selectTarget(s.id) },
      thumb(s.costumes[s.currentCostume]), el('span', { text: s.name })));
  }
  const st = stage();
  const sb = $('#stageTile'); sb.innerHTML = ''; sb.classList.toggle('on', st.id === E.targetId);
  sb.append(thumb(st.costumes[st.currentCostume]), el('span', { text: 'Scen' }));
  $('#paneCostTab').textContent = target().isStage ? '🖼 Bakgrunder' : '🎭 Kostymer';
}
function fillSpriteInfo() {
  const t = target(); const box = $('#spriteInfo');
  box.hidden = !t || t.isStage; if (!t || t.isStage) return;
  const live = E.vm.targets.find(x => x.id === t.id && !x.isClone);
  const val = live || t;
  const set = (id, v) => { const i = $(id); if (document.activeElement !== i) i.value = v; };
  set('#siName', t.name); set('#siX', Math.round(val.x)); set('#siY', Math.round(val.y));
  set('#siSize', Math.round(val.size)); set('#siDir', Math.round(val.dir != null ? val.dir : val.direction));
  $('#siShow').classList.toggle('on', val.visible); $('#siHide').classList.toggle('on', !val.visible);
}
function liveTarget() { const t = target(); return E.vm.targets.find(x => x.id === t.id && !x.isClone); }
function wireSpriteInfo() {
  const num = v => Number.isFinite(+v) ? +v : 0;
  $('#siName').onchange = e => {
    const t = target(); let n = e.target.value.trim().slice(0, 30) || t.name;
    if (sprites().some(s => s !== t && s.name === n)) n += '2';
    t.name = n; const l = liveTarget(); if (l) l.name = n; renderSprites(); fillSpriteInfo(); persist();
  };
  $('#siX').onchange = e => { const l = liveTarget(); l.setXY(num(e.target.value), l.y); E.vm.snapshot(E.project); persist(); };
  $('#siY').onchange = e => { const l = liveTarget(); l.setXY(l.x, num(e.target.value)); E.vm.snapshot(E.project); persist(); };
  $('#siSize').onchange = e => { const l = liveTarget(); l.setSize(num(e.target.value)); E.vm.snapshot(E.project); persist(); fillSpriteInfo(); };
  $('#siDir').onchange = e => { const l = liveTarget(); l.setDir(num(e.target.value)); E.vm.snapshot(E.project); persist(); fillSpriteInfo(); };
  $('#siShow').onclick = () => { const l = liveTarget(); l.visible = true; E.vm.redraw = true; E.vm.snapshot(E.project); persist(); fillSpriteInfo(); };
  $('#siHide').onclick = () => { const l = liveTarget(); l.visible = false; E.vm.redraw = true; E.vm.snapshot(E.project); persist(); fillSpriteInfo(); };
}
async function reloadVM() { // after adding or removing sprites
  saveWorkspace(); E.vm.snapshot(E.project); await E.vm.load(E.project);
  renderAll(); refreshToolbox(); persist();
}
async function refreshAssets(t) { // costumes or sounds of one target changed
  const live = E.vm.targets.filter(x => x.id === t.id);
  const costumes = await Promise.all(t.costumes.map(async c => {
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = c.url; });
    const w = img ? img.naturalWidth : 1, h = img ? img.naturalHeight : 1;
    return Object.assign({}, c, { img, w, h, cx: c.cx != null ? c.cx : w / 2, cy: c.cy != null ? c.cy : h / 2, res: c.res || 1 });
  }));
  if (live[0]) { live[0].sprite.costumes = costumes; live[0].sprite.sounds = t.sounds; }
  for (const l of live) l.costume = Math.min(l.costume, costumes.length - 1);
  const orig = live.find(x => !x.isClone); if (orig) orig.costume = t.currentCostume = Math.min(t.currentCostume, costumes.length - 1);
  E.vm.redraw = true; renderSprites(); renderPane(); refreshToolbox(); persist();
}
RB.refreshAssets = refreshAssets;
function uniqueName(list, name) { let n = name, k = 2; while (list.some(x => x.name === n)) n = name + k++; return n; }

async function addSprite(costume, name) {
  const s = newTarget(false, uniqueName(sprites(), name || costume.name || 'Sprajt'), [costume], [RB.library.sound('Pop')],
    { x: Math.round(Math.random() * 200 - 100), y: Math.round(Math.random() * 140 - 70) });
  saveWorkspace(); E.vm.snapshot(E.project);
  E.project.targets.push(s); E.targetId = s.id; await reloadVM(); loadWorkspace();
}
async function deleteSprite(id) {
  const s = E.project.targets.find(t => t.id === id); if (!s || s.isStage) return;
  if (!await simpleDialog(`Ta bort sprajten "${s.name}"?`, true)) return;
  E.project.targets = E.project.targets.filter(t => t !== s);
  for (const [vid, v] of Object.entries(E.project.variables)) if (v.owner === id) delete E.project.variables[vid];
  E.targetId = (sprites()[0] || stage()).id; await reloadVM(); loadWorkspace();
}
async function duplicateSprite(id) {
  const s = E.project.targets.find(t => t.id === id); if (!s || s.isStage) return;
  saveWorkspace(); E.vm.snapshot(E.project);
  const c = JSON.parse(JSON.stringify(s)); c.id = RB.uid(); c.name = uniqueName(sprites(), s.name); c.x += 20; c.y -= 20;
  // local variables are copied with new ids
  for (const [vid, v] of Object.entries(E.project.variables)) if (v.owner === id) {
    const nid = RB.uid(); E.project.variables[nid] = Object.assign({}, v, { owner: c.id });
    c.blocks = c.blocks.split(`id="${vid}"`).join(`id="${nid}"`);
  }
  E.project.targets.push(c); E.targetId = c.id; await reloadVM(); loadWorkspace();
}

/* ---------- costumes / sounds panes ---------- */
function renderPane() {
  for (const b of document.querySelectorAll('[data-pane]')) b.classList.toggle('on', b.dataset.pane === E.pane);
  $('#blocklyDiv').style.visibility = E.pane === 'blocks' ? 'visible' : 'hidden';
  $('#costumePane').hidden = E.pane !== 'costumes'; $('#soundPane').hidden = E.pane !== 'sounds';
  const t = target(); if (!t) return;
  if (E.pane === 'costumes') {
    const box = $('#costList'); box.innerHTML = '';
    t.costumes.forEach((c, i) => {
      box.append(el('div', { class: 'asset' + (i === t.currentCostume ? ' on' : '') },
        el('button', { class: 'asset-pick', title: 'Välj', onclick: () => { t.currentCostume = i; const l = liveTarget(); if (l) l.setCostume(i); refreshAssets(t); } },
          el('span', { class: 'asset-n', text: i + 1 }), thumb(c)),
        el('input', { type: 'text', value: c.name, 'aria-label': 'Namn', onchange: e => { c.name = uniqueName(t.costumes.filter(x => x !== c), e.target.value.trim() || c.name); refreshAssets(t); } }),
        el('div', { class: 'asset-acts' },
          el('button', { class: 'btn sm', text: '🖌', title: 'Rita på den', onclick: () => paint(t, i) }),
          el('button', { class: 'btn sm', text: '⧉', title: 'Kopiera', onclick: () => { t.costumes.splice(i + 1, 0, Object.assign({}, c, { id: RB.uid(), name: uniqueName(t.costumes, c.name) })); refreshAssets(t); } }),
          t.costumes.length > 1 ? el('button', { class: 'btn sm bad', text: '✖', title: 'Ta bort', onclick: () => { t.costumes.splice(i, 1); t.currentCostume = Math.min(t.currentCostume, t.costumes.length - 1); refreshAssets(t); } }) : null)));
    });
    $('#costAgent').hidden = t.isStage;
    $('#costLib').textContent = t.isStage ? '📚 Välj bakgrund' : '📚 Välj kostym';
  }
  if (E.pane === 'sounds') {
    const box = $('#sndList'); box.innerHTML = '';
    if (!t.sounds.length) box.append(el('p', { class: 'muted small', text: 'Inga ljud än.' }));
    t.sounds.forEach((s, i) => {
      box.append(el('div', { class: 'asset' },
        el('button', { class: 'btn sm', text: '▶', title: 'Spela', onclick: () => { const l = liveTarget(); E.vm.sound.play(l || E.vm.stage, s); } }),
        el('input', { type: 'text', value: s.name, 'aria-label': 'Namn', onchange: e => { s.name = uniqueName(t.sounds.filter(x => x !== s), e.target.value.trim() || s.name); refreshAssets(t); } }),
        el('div', { class: 'asset-acts' }, el('button', { class: 'btn sm bad', text: '✖', title: 'Ta bort', onclick: () => { t.sounds.splice(i, 1); refreshAssets(t); } }))));
    });
  }
}
function pickFile(accept, cb) {
  const f = $('#blkFile'); f.accept = accept; f.value = '';
  f.onchange = async () => { for (const file of f.files) { try { await cb(file); } catch (e) { H().toast('Det gick inte: ' + e.message); } } };
  f.click();
}
function library(kind, onPick) {
  const d = $('#dlgLib'); const grid = $('#libGrid'); grid.innerHTML = '';
  $('#libTitle').textContent = { costumes: 'Välj en kostym', backdrops: 'Välj en bakgrund', sounds: 'Välj ett ljud', sprites: 'Välj en sprajt' }[kind];
  const items = kind === 'sounds' ? RB.library.sounds : kind === 'backdrops' ? RB.library.backdrops.concat(H().levelBackdrops()) : RB.library.costumes;
  for (const [name, make] of items) {
    if (kind === 'sounds') {
      grid.append(el('div', { class: 'lib-item' }, el('div', { class: 'lib-snd', text: '🔊' }), el('span', { text: name }),
        el('div', { class: 'row', style: 'justify-content:center;gap:4px' },
          el('button', { class: 'btn sm', text: '▶', onclick: () => { E.vm.sound.play(E.vm.stage, { url: make() }); } }),
          el('button', { class: 'btn sm primary', text: 'Lägg till', onclick: () => { d.close(); onPick({ id: RB.uid(), name, url: make() }); } }))));
      continue;
    }
    let made = null; const get = () => made || (made = make());
    const img = el('img', { alt: '' });
    grid.append(el('button', { class: 'lib-item', onclick: () => { d.close(); onPick(get()); } }, img, el('span', { text: name })));
    setTimeout(() => { img.src = get().url; }, 0);
  }
  d.showModal();
}
function wirePanes() {
  for (const b of document.querySelectorAll('[data-pane]')) b.onclick = () => { E.pane = b.dataset.pane; renderPane(); if (E.pane === 'blocks') B.svgResize(E.ws); };
  const addCost = c => { const t = target(); c.name = uniqueName(t.costumes, c.name); t.costumes.push(c); t.currentCostume = t.costumes.length - 1; const l = liveTarget(); refreshAssets(t).then(() => { if (l) l.setCostume(t.currentCostume); }); };
  $('#costUpload').onclick = () => pickFile('image/*', async file => addCost(await RB.imageToCostume(file, target().isStage)));
  $('#costLib').onclick = () => library(target().isStage ? 'backdrops' : 'costumes', addCost);
  $('#costPaint').onclick = () => paint(target(), -1);
  $('#costAgent').onclick = async () => addCost(await RB.agentCostume(H().agent()));
  const addSnd = s => { const t = target(); s.name = uniqueName(t.sounds, s.name); t.sounds.push(s); refreshAssets(t); };
  $('#sndUpload').onclick = () => pickFile('audio/*', async file => addSnd(await RB.fileToSound(file)));
  $('#sndLib').onclick = () => library('sounds', addSnd);
  $('#sndRec').onclick = () => record(addSnd);
  $('#addAgent').onclick = async () => { const ag = H().agent(); addSprite(await RB.agentCostume(ag), ag ? ag.name : 'Robot'); };
  $('#addLib').onclick = () => library('sprites', c => addSprite(c, c.name.replace(/^Schack /, '')));
  $('#addUpload').onclick = () => pickFile('image/*', async file => addSprite(await RB.imageToCostume(file, false)));
  $('#addPaint').onclick = () => paint(null, -1);
  $('#spriteDup').onclick = () => { const t = target(); if (!t.isStage) duplicateSprite(t.id); };
  $('#spriteDel').onclick = () => { const t = target(); if (!t.isStage) deleteSprite(t.id); };
  $('#stageTile').onclick = () => selectTarget('stage');
}

/* ---------- a small paint program ---------- */
function paint(t, index) {
  const d = $('#dlgPaint'); const cv = $('#paintCv'); const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const editing = t && index >= 0 ? t.costumes[index] : null;
  const isStage = t && t.isStage;
  if (isStage) { g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 360); }
  if (editing) {
    const img = new Image(); img.onload = () => {
      const s = 1 / (editing.res || 1);
      g.drawImage(img, 240 - editing.cx * s, 180 - editing.cy * s, img.width * s, img.height * s);
    }; img.src = editing.url;
  }
  let tool = 'pen', down = false, last = null;
  const pos = ev => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * cv.width / r.width, (ev.clientY - r.top) * cv.height / r.height]; };
  for (const b of d.querySelectorAll('[data-tool]')) b.onclick = () => { tool = b.dataset.tool; for (const o of d.querySelectorAll('[data-tool]')) o.classList.toggle('on', o === b); };
  cv.onpointerdown = ev => { down = true; cv.setPointerCapture(ev.pointerId); last = pos(ev); stroke(last, last); };
  cv.onpointermove = ev => { if (!down) return; const p = pos(ev); stroke(last, p); last = p; };
  cv.onpointerup = () => { down = false; };
  function stroke(a, b) {
    g.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    g.strokeStyle = $('#paintColor').value; g.lineWidth = +$('#paintSize').value; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke();
    g.globalCompositeOperation = 'source-over';
  }
  $('#paintClear').onclick = () => { g.clearRect(0, 0, cv.width, cv.height); if (isStage) { g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 360); } };
  d.returnValue = '';
  d.onclose = async () => {
    if (d.returnValue !== 'ok') return;
    let c;
    if (isStage) c = { id: RB.uid(), name: 'målning', url: cv.toDataURL('image/png'), cx: 240, cy: 180, res: 1 };
    else {
      const cr = RB.cropCanvas(cv); if (!cr) return;
      c = { id: RB.uid(), name: 'målning', url: cr.canvas.toDataURL('image/png'), cx: 240 - cr.left, cy: 180 - cr.top, res: 1 };
    }
    if (!t) return addSprite(c, 'Målning');
    if (editing) { Object.assign(editing, { url: c.url, cx: c.cx, cy: c.cy, res: 1 }); refreshAssets(t); }
    else { c.name = uniqueName(t.costumes, 'målning'); t.costumes.push(c); t.currentCostume = t.costumes.length - 1; refreshAssets(t); }
  };
  d.showModal();
}

/* ---------- recording a sound ---------- */
async function record(onDone) {
  if (!navigator.mediaDevices || !window.MediaRecorder) { H().toast('Inspelning finns inte här.'); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { H().toast('Fick inte använda mikrofonen.'); return; }
  const rec = new MediaRecorder(stream); const parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  rec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const r = new FileReader(); r.onload = () => onDone({ id: RB.uid(), name: 'inspelning', url: r.result }); r.readAsDataURL(new Blob(parts, { type: rec.mimeType }));
  };
  rec.start(); const t0 = Date.now();
  const ok = await simpleDialog('🎙 Spelar in … tryck OK för att sluta (högst 10 sekunder).', true);
  if (rec.state !== 'inactive') rec.stop(); if (!ok) rec.onstop = () => stream.getTracks().forEach(t => t.stop());
  void t0;
}

/* ---------- toolbar ---------- */
function wireToolbar() {
  $('#flagImg').src = window.SB_MEDIA['green-flag.svg'];
  $('#goFlag').onclick = () => { E.vm.sound.ac(); saveWorkspace(); E.vm.greenFlag(); };
  $('#goStop').onclick = () => E.vm.stopAll();
  $('#goTurbo').onclick = () => { E.vm.turbo = !E.vm.turbo; $('#goTurbo').classList.toggle('on', E.vm.turbo); H().toast(E.vm.turbo ? '⚡ Turboläge på' : 'Turboläge av'); };
  $('#goFull').onclick = () => setFull(!E.full);
  $('#pSel').onchange = async e => { const p = await RB.store.get('project:' + e.target.value); if (p) openProject(p); };
  $('#pNew').onclick = async () => {
    const n = await H().ask('Nytt projekt', 'Vad ska projektet heta?', 'Mitt projekt ' + ((await listProjects()).length + 1)); if (!n) return;
    openProject(await blankProject(n.slice(0, 40)));
  };
  $('#pRename').onclick = async () => { const n = await H().ask('Döp om projektet', '', E.project.name); if (n) { E.project.name = n.slice(0, 40); await persist(true); fillProjectSelect(); } };
  $('#pDelete').onclick = async () => {
    const list = await listProjects();
    if (!await simpleDialog(`Ta bort projektet "${E.project.name}"?`, true)) return;
    await RB.store.del('project:' + E.project.id);
    const rest = list.filter(x => x.id !== E.project.id); await RB.store.set(LIST_KEY, rest);
    E.project = null;
    const next = rest[0] && await RB.store.get('project:' + rest[0].id);
    openProject(next || await blankProject('Mitt första projekt'));
  };
  $('#pExport').onclick = async () => {
    saveWorkspace(); await persist(true);
    H().download((E.project.name || 'projekt').replace(/[^\wåäöÅÄÖ-]+/g, '_') + '.rakenprojekt.json', { type: 'raken-block-project', version: 1, project: E.project });
  };
  $('#pImport').onclick = () => pickFile('.json,application/json', async file => {
    const data = JSON.parse(await file.text());
    if (!data || data.type !== 'raken-block-project' || !data.project) throw new Error('det är ingen projektfil');
    const p = data.project; if ((await listProjects()).some(x => x.id === p.id)) p.id = RB.uid();
    openProject(p);
  });
  $('#pExamples').onclick = () => {
    const d = $('#dlgEx'); const box = $('#exList'); box.innerHTML = '';
    for (const ex of RB.examples) box.append(el('button', { class: 'ex-item', onclick: async () => { d.close(); H().toast('Bygger ' + ex.name + ' …'); openProject(await ex.make()); } },
      el('b', { text: ex.icon + ' ' + ex.name }), el('span', { text: ex.text })));
    d.showModal();
  };
}

/* ---------- start ---------- */
async function init() {
  if (E.inited) return; E.inited = true;
  B.ScratchMsgs.setLocale('sv');
  E.vm = new RB.VM($('#stage'));
  E.ws = B.inject('blocklyDiv', {
    toolbox: RB.toolbox(newTarget(false, 'x', [], []), newTarget(true, 'Scen', [], [])), media: 'sbmedia/',
    zoom: { controls: true, wheel: true, startScale: 0.675 }, grid: { spacing: 40, length: 2, colour: '#ddd' },
    comments: true, collapse: false, sounds: false, trashcan: false, scrollbars: true,
  });
  E.ws.addChangeListener(onWsEvent);
  E.vm.on('ask', q => {
    const box = $('#askBox'); box.hidden = !q;
    if (q) { $('#askQ').textContent = q.text; $('#askQ').hidden = !q.text; setTimeout(() => $('#stageAsk').focus(), 0); }
  });
  E.vm.on('monitors', () => {
    renderMonitors(true);
    const fl = E.ws.getFlyout && E.ws.getFlyout();
    if (fl && fl.setCheckboxState) for (const id of Object.keys(E.project ? E.project.variables : {})) fl.setCheckboxState(id, E.vm.monitors.has(id));
    for (const [id, m] of E.vm.monitors) if (!E.project.monitors[id]) E.project.monitors[id] = Object.assign({}, m);
    for (const id of Object.keys(E.project.monitors)) if (!E.vm.monitors.has(id)) E.project.monitors[id].visible = false;
  });
  E.vm.on('report', (id, v) => { if (E.ws.getBlockById(id)) E.ws.reportValue(id, String(typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)); });
  E.vm.on('error', e => H().toast('Ett block gav ett fel: ' + (e && e.message || e)));
  let tick = 0;
  E.vm.on('frame', () => {
    renderMonitors(false);
    if ($('#v-code').hidden || E.pane !== 'blocks') return;
    const t = target(); const now = new Set();
    for (const th of E.vm.threads) if (!th.done && th.target.id === t.id && th.top && th.top.id) now.add(th.top.id);
    for (const id of E.glow) if (!now.has(id) && E.ws.getBlockById(id)) E.ws.glowStack(id, false);
    for (const id of now) if (!E.glow.has(id)) {
      let b = E.ws.getBlockById(id); if (b) { b = b.getRootBlock(); E.ws.glowStack(b.id, true); }
    }
    E.glow = now;
    $('#goFlag').classList.toggle('on', E.vm.threads.length > 0);
    if (++tick % 15 === 0 && t && !t.isStage) fillSpriteInfo();
  });
  wireStage(); wireSpriteInfo(); wirePanes(); wireToolbar();
  window.addEventListener('resize', () => { if (!$('#v-code').hidden) { sizeStage(); B.svgResize(E.ws); } });
  let cur = null; try { cur = localStorage.getItem(CUR_KEY); } catch (e) { }
  const p = (cur && await RB.store.get('project:' + cur)) || (await listProjects())[0] && await RB.store.get('project:' + (await listProjects())[0].id);
  await openProject(p || await RB.examples.find(x => x.id === 'hej').make());
}
RB.showEditor = async function () {
  await init();
  sizeStage(); B.svgResize(E.ws); refreshToolbox(); fillSpriteInfo();
};
RB.hideEditor = function () { if (E.inited) { saveWorkspace(); persist(); if (E.full) setFull(false); } };
})();
