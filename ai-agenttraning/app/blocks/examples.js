// Example projects, built from the toolbox's own block templates so every
// block has exactly the inputs and shadows the editor expects.
(function () {
'use strict';
const RB = window.RB;

/* ---------- a tiny builder for block XML ---------- */
const XMLNS = 'http://www.w3.org/1999/xhtml';
let templates = null;
const EXTRA = {
  data_variable: '<block type="data_variable"><field name="VARIABLE"/></block>',
  data_setvariableto: '<block type="data_setvariableto"><field name="VARIABLE"/><value name="VALUE"><shadow type="text"><field name="TEXT">0</field></shadow></value></block>',
  data_changevariableby: '<block type="data_changevariableby"><field name="VARIABLE"/><value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>',
  data_showvariable: '<block type="data_showvariable"><field name="VARIABLE"/></block>',
  data_hidevariable: '<block type="data_hidevariable"><field name="VARIABLE"/></block>',
  data_listcontents: '<block type="data_listcontents"><field name="LIST"/></block>',
  data_addtolist: '<block type="data_addtolist"><field name="LIST"/><value name="ITEM"><shadow type="text"><field name="TEXT">sak</field></shadow></value></block>',
  data_deleteoflist: '<block type="data_deleteoflist"><field name="LIST"/><value name="INDEX"><shadow type="math_integer"><field name="NUM">1</field></shadow></value></block>',
  data_deletealloflist: '<block type="data_deletealloflist"><field name="LIST"/></block>',
  data_insertatlist: '<block type="data_insertatlist"><field name="LIST"/><value name="INDEX"><shadow type="math_integer"><field name="NUM">1</field></shadow></value><value name="ITEM"><shadow type="text"><field name="TEXT">sak</field></shadow></value></block>',
  data_replaceitemoflist: '<block type="data_replaceitemoflist"><field name="LIST"/><value name="INDEX"><shadow type="math_integer"><field name="NUM">1</field></shadow></value><value name="ITEM"><shadow type="text"><field name="TEXT">sak</field></shadow></value></block>',
  data_itemoflist: '<block type="data_itemoflist"><field name="LIST"/><value name="INDEX"><shadow type="math_integer"><field name="NUM">1</field></shadow></value></block>',
  data_itemnumoflist: '<block type="data_itemnumoflist"><field name="LIST"/><value name="ITEM"><shadow type="text"><field name="TEXT">sak</field></shadow></value></block>',
  data_lengthoflist: '<block type="data_lengthoflist"><field name="LIST"/></block>',
  data_listcontainsitem: '<block type="data_listcontainsitem"><field name="LIST"/><value name="ITEM"><shadow type="text"><field name="TEXT">sak</field></shadow></value></block>',
  data_showlist: '<block type="data_showlist"><field name="LIST"/></block>',
  data_hidelist: '<block type="data_hidelist"><field name="LIST"/></block>',
  event_whenbroadcastreceived: '<block type="event_whenbroadcastreceived"><field name="BROADCAST_OPTION"/></block>',
};
function loadTemplates() {
  if (templates) return templates;
  templates = {};
  const fake = RB.newTarget(false, 'x', [{ name: 'k' }], [{ name: 'l' }]), st = RB.newTarget(true, 'Scen', [{ name: 'b' }], []);
  const parse = s => new DOMParser().parseFromString(s, 'text/xml').documentElement;
  const add = root => { for (const b of root.querySelectorAll('block')) if (!templates[b.getAttribute('type')] && b.parentElement.tagName !== 'value') templates[b.getAttribute('type')] = b; };
  add(parse(RB.toolbox(fake, st)));
  add(parse(RB.toolbox(st, st)));
  for (const s of Object.values(EXTRA)) add(parse('<xml>' + s + '</xml>'));
  return templates;
}
// the field name of a menu shadow, e.g. motion_goto_menu → TO
const fieldNames = {};
function menuField(type) {
  if (fieldNames[type]) return fieldNames[type];
  const ws = new Blockly.Workspace(); let name = 'TEXT';
  try { const blk = ws.newBlock(type); for (const inp of blk.inputList) for (const f of inp.fieldRow) if (f.name) { name = f.name; break; } } catch (e) { }
  ws.dispose(); return fieldNames[type] = name;
}
const isVar = v => v && v.__var;
const isBlock = v => v && v.op;

function Builder(project) {
  const P = project;
  let doc = document.implementation.createDocument(null, 'xml', null);
  const self = {};
  // variables, lists and messages
  self.V = (name, owner = 'stage', type = '', value) => {
    let id = Object.keys(P.variables).find(k => { const v = P.variables[k]; return v.name === name && v.type === type && v.owner === owner; });
    if (!id) { id = RB.uid(); P.variables[id] = { name, type, owner, value: value != null ? value : (type === 'list' ? [] : 0) }; }
    return { __var: true, id, name, type };
  };
  self.L = (name, owner, value) => self.V(name, owner, 'list', value);
  self.M = name => self.V(name, 'stage', 'broadcast_msg');
  const k = (op, args = {}) => ({ op, args });
  self.k = k;
  function setVarField(f, v) { f.setAttribute('id', v.id); f.setAttribute('variabletype', v.type); f.textContent = v.name; }
  function block(spec, asShadowOf) {
    if (spec.op === 'procedures_call') return callBlock(spec);
    if (spec.op === 'procedures_definition') return defBlock(spec);
    if (spec.op === 'argument_reporter_string_number' || spec.op === 'argument_reporter_boolean') {
      const b = doc.createElement('block'); b.setAttribute('type', spec.op); b.setAttribute('id', RB.uid());
      const f = doc.createElement('field'); f.setAttribute('name', 'VALUE'); f.textContent = spec.args.name; b.append(f); return b;
    }
    const tpl = loadTemplates()[spec.op];
    if (!tpl) throw new Error('Ingen mall för ' + spec.op);
    const b = doc.importNode(tpl, true); b.removeAttribute('id'); b.setAttribute('id', RB.uid());
    for (const s of b.querySelectorAll('shadow')) s.setAttribute('id', RB.uid());
    for (const [key, val] of Object.entries(spec.args)) {
      if (val == null) continue;
      const direct = [...b.children];
      const value = direct.find(c => c.tagName === 'value' && c.getAttribute('name') === key);
      const field = direct.find(c => c.tagName === 'field' && c.getAttribute('name') === key);
      if (key.startsWith('SUBSTACK')) {
        const st = doc.createElement('statement'); st.setAttribute('name', key);
        const chain = stack(val); if (chain) st.append(chain);
        b.append(st); continue;
      }
      if (field || (!value && !isBlock(val))) { // a dropdown the template leaves at its default
        const f = field || b.appendChild(doc.createElement('field'));
        f.setAttribute('name', key);
        if (isVar(val)) setVarField(f, val); else f.textContent = String(val);
        continue;
      }
      let v = value;
      if (!v) { v = doc.createElement('value'); v.setAttribute('name', key); b.append(v); }
      if (isBlock(val)) {
        for (const old of [...v.children]) if (old.tagName === 'block') old.remove();
        v.append(block(val));
      } else {
        for (const old of [...v.children]) if (old.tagName === 'block') old.remove(); // a value replaces a default block
        const sh = [...v.children].find(c => c.tagName === 'shadow');
        if (!sh) throw new Error(spec.op + '.' + key + ' kan inte ta ett värde');
        let f = sh.querySelector('field');
        if (!f) { f = doc.createElement('field'); f.setAttribute('name', menuField(sh.getAttribute('type'))); sh.append(f); }
        if (isVar(val)) setVarField(f, val); else f.textContent = String(val);
      }
    }
    return b;
  }
  function stack(list) {
    if (!list || !list.length) return null;
    const first = block(list[0]); let cur = first;
    for (const spec of list.slice(1)) {
      const nx = doc.createElement('next'); const b = block(spec); nx.append(b); cur.append(nx); cur = b;
    }
    return first;
  }
  // my blocks: proccode like "lägg %s på %s", args are names
  const argId = (code, i) => 'a' + Math.abs([...code].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36) + i;
  function mutation(code, names, warp) {
    const m = doc.createElement('mutation');
    m.setAttribute('proccode', code);
    m.setAttribute('argumentids', JSON.stringify(names.map((n, i) => argId(code, i))));
    m.setAttribute('argumentnames', JSON.stringify(names));
    m.setAttribute('argumentdefaults', JSON.stringify(names.map(() => '')));
    m.setAttribute('warp', String(!!warp));
    return m;
  }
  function defBlock(spec) {
    const { code, names, warp, body } = spec.args;
    const b = doc.createElement('block'); b.setAttribute('type', 'procedures_definition'); b.setAttribute('id', RB.uid());
    const v = doc.createElement('value'); v.setAttribute('name', 'custom_block');
    const sh = doc.createElement('shadow'); sh.setAttribute('type', 'procedures_prototype'); sh.setAttribute('id', RB.uid());
    sh.append(mutation(code, names, warp));
    names.forEach((n, i) => {
      const iv = doc.createElement('value'); iv.setAttribute('name', argId(code, i));
      const kinds = code.match(/%[sb]/g) || [];
      const as = doc.createElement('shadow'); as.setAttribute('type', kinds[i] === '%b' ? 'argument_reporter_boolean' : 'argument_reporter_string_number');
      as.setAttribute('id', RB.uid());
      const f = doc.createElement('field'); f.setAttribute('name', 'VALUE'); f.textContent = n; as.append(f); iv.append(as); sh.append(iv);
    });
    v.append(sh); b.append(v);
    const chain = stack(body); if (chain) { const nx = doc.createElement('next'); nx.append(chain); b.append(nx); }
    return b;
  }
  function callBlock(spec) {
    const { code, values = [], warp, names } = spec.args;
    const b = doc.createElement('block'); b.setAttribute('type', 'procedures_call'); b.setAttribute('id', RB.uid());
    b.append(mutation(code, names || values.map((x, i) => 'x' + i), warp));
    values.forEach((val, i) => {
      const v = doc.createElement('value'); v.setAttribute('name', argId(code, i));
      const sh = doc.createElement('shadow'); sh.setAttribute('type', 'text'); sh.setAttribute('id', RB.uid());
      const f = doc.createElement('field'); f.setAttribute('name', 'TEXT'); f.textContent = isBlock(val) ? '' : String(val); sh.append(f); v.append(sh);
      if (isBlock(val)) v.append(block(val));
      b.append(v);
    });
    return b;
  }
  const procs = {};
  self.def = (code, names, warp, body) => { procs[code] = { names, warp }; return k('procedures_definition', { code, names, warp, body }); };
  self.call = (code, ...values) => k('procedures_call', { code, values, warp: procs[code] ? procs[code].warp : false, names: procs[code] && procs[code].names });
  self.arg = name => k('argument_reporter_string_number', { name });
  // a whole workspace: stacks placed in a column, optional note
  self.scripts = (stacks, note) => {
    doc = document.implementation.createDocument(null, 'xml', null);
    const root = doc.documentElement; root.setAttribute('xmlns', XMLNS);
    let y = 30;
    if (note) {
      const c = doc.createElement('comment'); c.setAttribute('id', RB.uid()); c.setAttribute('x', '560'); c.setAttribute('y', '30');
      c.setAttribute('w', '300'); c.setAttribute('h', '220'); c.setAttribute('pinned', 'false'); c.setAttribute('minimized', 'false'); c.textContent = note; root.append(c);
    }
    for (const s of stacks) {
      const b = stack(s); b.setAttribute('x', '30'); b.setAttribute('y', String(y)); root.append(b);
      y += 60 + 48 * countBlocks(s);
    }
    return new XMLSerializer().serializeToString(doc);
  };
  function countBlocks(list) {
    let n = 0;
    for (const s of list) { n++; for (const [kk, v] of Object.entries(s.args || {})) if (kk.startsWith('SUBSTACK') || kk === 'body') n += countBlocks(v) + 1; }
    return n;
  }
  // shorthands
  self.get = v => k(v.type === 'list' ? 'data_listcontents' : 'data_variable', v.type === 'list' ? { LIST: v } : { VARIABLE: v });
  self.set = (v, val) => k('data_setvariableto', { VARIABLE: v, VALUE: val });
  self.change = (v, val) => k('data_changevariableby', { VARIABLE: v, VALUE: val });
  self.eq = (a, b) => k('operator_equals', { OPERAND1: a, OPERAND2: b });
  self.gt = (a, b) => k('operator_gt', { OPERAND1: a, OPERAND2: b });
  self.lt = (a, b) => k('operator_lt', { OPERAND1: a, OPERAND2: b });
  self.and = (a, b) => k('operator_and', { OPERAND1: a, OPERAND2: b });
  self.not = a => k('operator_not', { OPERAND: a });
  self.join = (a, b) => k('operator_join', { STRING1: a, STRING2: b });
  self.letter = (i, s) => k('operator_letter_of', { LETTER: i, STRING: s });
  self.add = (a, b) => k('operator_add', { NUM1: a, NUM2: b });
  self.sub = (a, b) => k('operator_subtract', { NUM1: a, NUM2: b });
  self.mul = (a, b) => k('operator_multiply', { NUM1: a, NUM2: b });
  self.div = (a, b) => k('operator_divide', { NUM1: a, NUM2: b });
  self.mod = (a, b) => k('operator_mod', { NUM1: a, NUM2: b });
  self.floor = a => k('operator_mathop', { OPERATOR: 'floor', NUM: a });
  self.bc = name => k('event_broadcast', { BROADCAST_INPUT: self.M(name) });
  self.bcw = name => k('event_broadcastandwait', { BROADCAST_INPUT: self.M(name) });
  self.when = name => k('event_whenbroadcastreceived', { BROADCAST_OPTION: self.M(name) });
  self.flag = () => k('event_whenflagclicked');
  self.say = m => k('looks_say', { MESSAGE: m });
  self.sayFor = (m, s) => k('looks_sayforsecs', { MESSAGE: m, SECS: s });
  self.ifThen = (c, a) => k('control_if', { CONDITION: c, SUBSTACK: a });
  self.ifElse = (c, a, b) => k('control_if_else', { CONDITION: c, SUBSTACK: a, SUBSTACK2: b });
  self.repeat = (n, a) => k('control_repeat', { TIMES: n, SUBSTACK: a });
  self.forever = a => k('control_forever', { SUBSTACK: a });
  self.waitUntil = c => k('control_wait_until', { CONDITION: c });
  return self;
}
RB.Builder = Builder;

/* ---------- the examples ---------- */
async function base(name, backdropName) {
  const p = { id: RB.uid(), name, created: Date.now(), updated: Date.now(), variables: {}, monitors: {}, targets: [] };
  p.targets.push(RB.newTarget(true, 'Scen', [RB.library.backdrop(backdropName)]));
  return p;
}
async function agentSprite(extra) {
  const ag = RB.host.agent();
  const cost = await RB.agentCostume(ag, ag ? ag.name : 'Robot');
  return RB.newTarget(false, ag ? ag.name.slice(0, 20) : 'Robot', [cost], [RB.library.sound('Pling'), RB.library.sound('Pop')], extra);
}

async function hej() {
  const p = await base('Min första sprajt', 'Rutnät med x och y'); const b = Builder(p); const k = b.k;
  const a = await agentSprite({ x: 0, y: 0, size: 80 });
  a.blocks = b.scripts([
    [b.flag(), k('motion_gotoxy', { X: 0, Y: 0 }), k('motion_pointindirection', { DIRECTION: 90 }), k('looks_cleargraphiceffects'),
      b.forever([k('motion_movesteps', { STEPS: 4 }), k('motion_ifonedgebounce'), k('looks_changeeffectby', { EFFECT: 'COLOR', CHANGE: 2 })])],
    [k('event_whenthisspriteclicked'), k('sound_play', { SOUND_MENU: 'Pling' }), b.sayFor(b.join('Hej! Jag heter ', k('ai_name')), 2)],
    [k('event_whenkeypressed', { KEY_OPTION: 'up arrow' }), k('looks_changesizeby', { CHANGE: 10 })],
    [k('event_whenkeypressed', { KEY_OPTION: 'down arrow' }), k('looks_changesizeby', { CHANGE: -10 })],
  ], 'Tryck på den gröna flaggan!\n\nKlicka på agenten så säger den hej.\nPil upp och pil ner ändrar storleken.\n\nDra block från vänster och testa själv.');
  a.cleanup = true; p.targets.push(a); return p;
}

async function prata() {
  const p = await base('Prata med agenten', 'Äng'); const b = Builder(p); const k = b.k;
  const a = await agentSprite({ x: 0, y: -40, size: 110 });
  const svar = b.V('svar'), fraga = b.V('fråga');
  a.blocks = b.scripts([
    [b.flag(), b.say('Klicka på mig och skriv något! Tryck L för att lära mig ett svar.')],
    [k('event_whenthisspriteclicked'), k('sensing_askandwait', { QUESTION: 'Vad vill du säga till mig?' }),
      b.set(svar, k('ai_ask', { TEXT: k('sensing_answer') })), b.say(b.get(svar)), k('text2speech_speakAndWait', { WORDS: b.get(svar) })],
    [k('event_whenkeypressed', { KEY_OPTION: 'l' }), k('sensing_askandwait', { QUESTION: 'Vad ska någon säga till mig?' }), b.set(fraga, k('sensing_answer')),
      k('sensing_askandwait', { QUESTION: 'Vad ska jag svara då?' }), k('ai_teach', { QUESTION: b.get(fraga), ANSWER: k('sensing_answer') }),
      b.sayFor('Tack! Nu kan jag det.', 2)],
  ], 'Agenten svarar med det den har lärt sig under 💬 Prata.\n\nTryck L för att lära den något nytt härifrån.\n\nBlocken finns i kategorin AI-agent.');
  a.cleanup = true; p.targets.push(a); return p;
}

async function penna() {
  const p = await base('Rita med pennan', 'Vit'); const b = Builder(p); const k = b.k;
  const s = RB.newTarget(false, 'Penna', [RB.library.costume('Pil')], [], { size: 40 });
  const steg = b.V('steg', s.id);
  s.blocks = b.scripts([
    [b.flag(), k('pen_clear'), k('motion_gotoxy', { X: 0, Y: 0 }), k('pen_setPenSizeTo', { SIZE: 2 }), b.set(steg, 1), k('pen_penDown'),
      b.repeat(150, [k('motion_movesteps', { STEPS: b.get(steg) }), k('motion_turnright', { DEGREES: 61 }), b.change(steg, 2),
        k('pen_changePenColorParamBy', { COLOR_PARAM: 'color', VALUE: 1 })]), k('pen_penUp')],
  ], 'Pennan ritar en spiral. Ändra 61 grader till något annat och tryck på flaggan igen!');
  s.cleanup = true; p.targets.push(s); return p;
}

async function luffarschack() {
  const p = await base('Luffarschack som lär sig', 'Luffarschack'); const b = Builder(p); const k = b.k;
  const br = RB.newTarget(false, 'Bricka', [RB.library.costume('Kryss'), RB.library.costume('Ring')], [RB.library.sound('Pop')], { visible: false });
  const bräde = b.V('bräde'), vinnare = b.V('vinnare'), tur = b.V('tur');
  const lediga = b.L('lediga'), linjer = b.L('linjer');
  const i = b.V('i', br.id), ny = b.V('ny', br.id), val = b.V('val', br.id), linje = b.V('linje', br.id), a_ = b.V('a', br.id);
  const kol = b.V('kolumn', br.id), rad = b.V('rad', br.id), ruta = b.V('ruta', br.id);
  const at = (n, s) => b.letter(n, s);
  const cell = n => at(n, b.get(bräde));
  const defs = [
    b.def('ny omgång', [], true, [
      b.set(bräde, '.........'), b.set(vinnare, ''), k('ai_newround'),
      k('data_deletealloflist', { LIST: linjer }),
      ...['123', '456', '789', '147', '258', '369', '159', '357'].map(l => k('data_addtolist', { LIST: linjer, ITEM: l })),
    ]),
    b.def('lägg %s på %s', ['tecken', 'plats'], true, [
      b.set(ny, ''), b.set(i, 0),
      b.repeat(9, [b.change(i, 1), b.ifElse(b.eq(b.get(i), b.arg('plats')), [b.set(ny, b.join(b.get(ny), b.arg('tecken')))], [b.set(ny, b.join(b.get(ny), cell(b.get(i))))])]),
      b.set(bräde, b.get(ny)),
    ]),
    b.def('rita %s på %s', ['tecken', 'plats'], false, [
      b.ifElse(b.eq(b.arg('tecken'), 'X'), [k('looks_switchcostumeto', { COSTUME: 'Kryss' })], [k('looks_switchcostumeto', { COSTUME: 'Ring' })]),
      k('motion_gotoxy', { X: b.sub(b.mul(b.mod(b.sub(b.arg('plats'), 1), 3), 100), 100), Y: b.sub(100, b.mul(b.floor(b.div(b.sub(b.arg('plats'), 1), 3)), 100)) }),
      k('looks_show'), k('pen_stamp'), k('looks_hide'), k('sound_play', { SOUND_MENU: 'Pop' }),
    ]),
    b.def('kolla vinnare', [], true, [
      b.set(vinnare, ''), b.set(i, 0),
      b.repeat(k('data_lengthoflist', { LIST: linjer }), [
        b.change(i, 1), b.set(linje, k('data_itemoflist', { LIST: linjer, INDEX: b.get(i) })),
        b.set(a_, cell(at(1, b.get(linje)))),
        b.ifThen(b.and(b.not(b.eq(b.get(a_), '.')), b.and(b.eq(b.get(a_), cell(at(2, b.get(linje)))), b.eq(b.get(a_), cell(at(3, b.get(linje)))))), [b.set(vinnare, b.get(a_))]),
      ]),
      b.ifThen(b.and(b.eq(b.get(vinnare), ''), b.not(k('operator_contains', { STRING1: b.get(bräde), STRING2: '.' }))), [b.set(vinnare, 'oavgjort')]),
    ]),
    b.def('fyll lediga', [], true, [
      k('data_deletealloflist', { LIST: lediga }), b.set(i, 0),
      b.repeat(9, [b.change(i, 1), b.ifThen(b.eq(cell(b.get(i)), '.'), [k('data_addtolist', { LIST: lediga, ITEM: b.get(i) })])]),
    ]),
    b.def('agentens drag', [], true, [
      b.call('fyll lediga'),
      b.set(val, k('ai_choose', { OPTIONS: b.get(lediga), STATE: b.get(bräde) })),
      b.call('lägg %s på %s', 'O', b.get(val)),
    ]),
    b.def('slumpdrag', [], true, [
      b.call('fyll lediga'),
      b.set(val, k('data_itemoflist', { LIST: lediga, INDEX: k('operator_random', { FROM: 1, TO: k('data_lengthoflist', { LIST: lediga }) }) })),
      b.call('lägg %s på %s', 'X', b.get(val)),
    ]),
    b.def('belöna', [], true, [
      b.ifThen(b.eq(b.get(vinnare), 'O'), [k('ai_reward', { REWARD: 1 })]),
      b.ifThen(b.eq(b.get(vinnare), 'X'), [k('ai_reward', { REWARD: -1 })]),
      b.ifThen(b.eq(b.get(vinnare), 'oavgjort'), [k('ai_reward', { REWARD: 0.5 })]),
    ]),
    b.def('träna %s omgångar', ['antal'], true, [
      b.repeat(b.arg('antal'), [
        b.call('ny omgång'),
        k('control_repeat_until', { CONDITION: b.not(b.eq(b.get(vinnare), '')), SUBSTACK: [
          b.call('slumpdrag'), b.call('kolla vinnare'),
          b.ifThen(b.eq(b.get(vinnare), ''), [b.call('agentens drag'), b.call('kolla vinnare')]),
        ] }),
        b.call('belöna'),
      ]),
      b.call('ny omgång'),
    ]),
  ];
  br.blocks = b.scripts([
    [b.flag(), k('looks_hide'), k('pen_clear'), b.call('ny omgång'), b.set(tur, 'du'),
      b.forever([
        b.waitUntil(k('sensing_mousedown')),
        b.set(kol, b.add(b.floor(b.div(b.add(k('sensing_mousex'), 150), 100)), 1)),
        b.set(rad, b.add(b.floor(b.div(b.sub(150, k('sensing_mousey')), 100)), 1)),
        b.ifThen(b.and(b.eq(b.get(tur), 'du'), b.and(b.and(b.gt(b.get(kol), 0), b.lt(b.get(kol), 4)), b.and(b.gt(b.get(rad), 0), b.lt(b.get(rad), 4)))), [
          b.set(ruta, b.add(b.mul(b.sub(b.get(rad), 1), 3), b.get(kol))),
          b.ifThen(b.eq(cell(b.get(ruta)), '.'), [
            b.call('lägg %s på %s', 'X', b.get(ruta)), b.call('rita %s på %s', 'X', b.get(ruta)), b.call('kolla vinnare'),
            b.ifThen(b.eq(b.get(vinnare), ''), [
              b.set(tur, 'agent'), k('control_wait', { DURATION: 0.4 }), b.call('agentens drag'), b.call('rita %s på %s', 'O', b.get(val)), b.call('kolla vinnare'), b.set(tur, 'du'),
            ]),
            b.ifThen(b.not(b.eq(b.get(vinnare), '')), [b.set(tur, 'slut'), b.call('belöna'), b.bcw('slut'), k('pen_clear'), b.call('ny omgång'), b.set(tur, 'du')]),
          ]),
        ]),
        b.waitUntil(b.not(k('sensing_mousedown'))),
      ])],
    [k('event_whenkeypressed', { KEY_OPTION: 't' }), b.set(tur, 'tränar'), b.bc('tränar'), b.call('träna %s omgångar', 300), k('pen_clear'), b.set(tur, 'du'), b.bc('tränat')],
    ...defs.map(d => [d]),
  ], 'Du är X och agenten är O.\n\nAgenten väljer drag med blocket "agenten väljer bland … i läget …" och får +1 när den vinner och −1 när den förlorar ("belöna agenten").\n\nTryck T så spelar den 300 övningsomgångar mot slumpen på några sekunder. Blir den svårare att slå?');
  br.cleanup = true;
  const a = await agentSprite({ x: 196, y: -96, size: 45 });
  a.blocks = b.scripts([
    [b.flag(), b.say('Du är X. Klicka i en ruta! Tryck T så tränar jag.')],
    [b.when('slut'),
      b.ifThen(b.eq(b.get(vinnare), 'O'), [b.sayFor('Jag vann!', 2)]),
      b.ifThen(b.eq(b.get(vinnare), 'X'), [b.sayFor('Du vann! Jag lär mig av det.', 2)]),
      b.ifThen(b.eq(b.get(vinnare), 'oavgjort'), [b.sayFor('Oavgjort!', 2)]),
      b.say('Din tur!')],
    [b.when('tränar'), b.say('Jag tränar …')],
    [b.when('tränat'), b.say(b.join('Klart! Nu minns jag ', b.join(k('ai_states'), ' lägen.')))],
  ]);
  a.cleanup = true;
  p.targets.push(br, a); return p;
}

async function schack() {
  const p = await base('Schack mot agenten', 'Schackbräde'); const b = Builder(p); const k = b.k;
  const codes = ['vK', 'vD', 'vT', 'vL', 'vS', 'vB', 'sK', 'sD', 'sT', 'sL', 'sS', 'sB'];
  const pj = RB.newTarget(false, 'Pjäs', codes.map(c => RB.chessPiece(c)), [], { visible: false });
  const mk = RB.newTarget(false, 'Markör', [RB.library.costume('Ram')], [], { visible: false });
  const vald = b.V('vald', 'stage', '', ''), klick = b.V('klick', 'stage', '', ''), niva = b.V('nivå', 'stage', '', 2);
  const nr = b.V('nr', pj.id), rutan = b.V('rutan', pj.id), klon = b.V('klon', pj.id);
  const piece = sq => k('chess_piece', { SQUARE: sq });
  const st = p.targets[0];
  st.blocks = b.scripts([
    [b.flag(), k('chess_new'), b.set(vald, ''), b.bc('avmarkera'), b.bcw('rita'), b.bc('din tur'),
      b.forever([
        b.waitUntil(k('sensing_mousedown')),
        b.set(klick, k('chess_square_at', { X: k('sensing_mousex'), Y: k('sensing_mousey') })),
        b.ifThen(b.and(b.eq(k('chess_turn'), 'vit'), b.not(k('chess_over'))), [
          b.ifElse(b.and(b.not(b.eq(b.get(vald), '')), k('chess_legal', { FROM: b.get(vald), TO: b.get(klick) })), [
            k('chess_move', { FROM: b.get(vald), TO: b.get(klick) }), b.set(vald, ''), b.bc('avmarkera'), b.bcw('rita'), b.bcw('agentens tur'),
          ], [
            b.ifElse(b.eq(b.letter(1, piece(b.get(klick))), 'v'), [b.set(vald, b.get(klick)), b.bc('markera')], [b.set(vald, ''), b.bc('avmarkera')]),
          ]),
        ]),
        b.waitUntil(b.not(k('sensing_mousedown'))),
      ])],
  ], 'Du spelar vit. Klicka på en av dina pjäser och sedan på rutan den ska till.\n\nAgenten tänker "nivå" drag framåt (1–4). Ändra variabeln nivå för att göra den svårare.\n\nNär ett parti är slut minns agenten vilka drag som ledde till vinst eller förlust.');
  pj.blocks = b.scripts([
    [b.flag(), k('looks_hide'), b.set(klon, 0)],
    // clones hear messages too, so only the original draws the board
    [b.when('rita'), b.ifThen(b.eq(b.get(klon), 0), [b.call('rita pjäserna')])],
    [b.def('rita pjäserna', [], true, [
      b.bcw('rensa'), k('looks_hide'), b.set(nr, 0),
      b.repeat(64, [
        b.change(nr, 1),
        b.set(rutan, b.join(b.letter(b.add(b.mod(b.sub(b.get(nr), 1), 8), 1), 'abcdefgh'), b.add(b.floor(b.div(b.sub(b.get(nr), 1), 8)), 1))),
        b.ifThen(b.not(b.eq(piece(b.get(rutan)), '')), [
          k('looks_switchcostumeto', { COSTUME: piece(b.get(rutan)) }),
          k('motion_gotoxy', { X: k('chess_square_x', { SQUARE: b.get(rutan) }), Y: k('chess_square_y', { SQUARE: b.get(rutan) }) }),
          k('control_create_clone_of', { CLONE_OPTION: '_myself_' }),
        ]),
      ]),
    ])],
    [k('control_start_as_clone'), b.set(klon, 1), k('looks_show')],
    [b.when('rensa'), b.ifThen(b.eq(b.get(klon), 1), [k('control_delete_this_clone')])],
  ]);
  mk.blocks = b.scripts([
    [b.flag(), k('looks_hide')],
    [b.when('markera'), k('motion_gotoxy', { X: k('chess_square_x', { SQUARE: b.get(vald) }), Y: k('chess_square_y', { SQUARE: b.get(vald) }) }),
      k('looks_show'), k('looks_gotofrontback', { FRONT_BACK: 'front' })],
    [b.when('avmarkera'), k('looks_hide')],
  ]);
  const a = await agentSprite({ x: 204, y: -110, size: 45 });
  const over = [b.say(b.join('Partiet är slut: ', k('chess_status')))];
  a.blocks = b.scripts([
    [b.when('din tur'), b.say('Du spelar vit. Din tur!')],
    [b.when('agentens tur'),
      b.ifElse(k('chess_over'), over, [
        k('looks_think', { MESSAGE: 'Hmm …' }),
        k('chess_ai_move', { DEPTH: b.get(niva) }),
        b.bcw('rita'), k('sound_play', { SOUND_MENU: 'Pling' }),
        b.ifElse(k('chess_over'), over, [
          b.ifElse(b.eq(k('chess_status'), 'schack'), [b.say(b.join('Schack! ', k('chess_last')))], [b.say(b.join('Jag flyttade ', k('chess_last')))]),
        ]),
      ])],
  ]);
  pj.cleanup = mk.cleanup = a.cleanup = st.cleanup = true;
  p.monitors[niva.id] = { id: niva.id, opcode: 'data_variable', targetId: null, visible: true, x: 4, y: 4 };
  p.targets.push(pj, mk, a); return p;
}

RB.examples = [
  { id: 'hej', icon: '👋', name: 'Min första sprajt', text: 'Agenten studsar runt, byter färg och säger hej när du klickar.', make: hej },
  { id: 'schack', icon: '♟', name: 'Schack mot agenten', text: 'Ett helt schackspel byggt med block. Spela mot agenten – den lär sig av varje parti.', make: schack },
  { id: 'luffar', icon: '⭕', name: 'Luffarschack som lär sig', text: 'Agenten lär sig spela med belöningar. Tryck T så tränar den 300 omgångar.', make: luffarschack },
  { id: 'prata', icon: '💬', name: 'Prata med agenten', text: 'Klicka på agenten och skriv. Den svarar med det du lärt den och kan läsa upp svaret.', make: prata },
  { id: 'penna', icon: '🖊', name: 'Rita med pennan', text: 'En spiral i regnbågens färger med penn-blocken.', make: penna },
];
})();
