// Tests for the block runtime. Every case builds a small program out of real
// blocks (the same XML the editor makes), runs it on a hidden stage and
// checks the result. Also checks that every block in the palette runs.
//
//   NODE_PATH=$(npm root -g) node build/verify-blocks.cjs [app.html]
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'index.html'));

const HARNESS = `
window.T = {
  async run(build, ms, before) {
    const p = { id: 'test' + Math.random(), name: 't', variables: {}, monitors: {}, targets: [] };
    p.targets.push(RB.newTarget(true, 'Scen', [RB.library.backdrop('Vit'), RB.library.backdrop('Rymden')]));
    const s = RB.newTarget(false, 'A', [RB.library.costume('Kvadrat'), RB.library.costume('Boll')], [RB.library.sound('Pop')]);
    const s2 = RB.newTarget(false, 'B', [RB.library.costume('Kvadrat')], [], { x: 200, y: 0 });
    p.targets.push(s, s2);
    const b = RB.Builder(p);
    const out = build(b, b.k, s, s2, p) || {};
    if (out.a) s.blocks = b.scripts(out.a);
    if (out.b) s2.blocks = b.scripts(out.b);
    if (out.stage) p.targets[0].blocks = b.scripts(out.stage);
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360;
    const vm = window.__vm = window.__vm || new RB.VM(cv);
    await vm.load(p);
    if (before) before(vm);
    vm.greenFlag();
    if (out.after) await out.after(vm);
    await new Promise(r => setTimeout(r, ms || 200));
    const A = vm.targets.find(t => t.name === 'A' && !t.isClone), B = vm.targets.find(t => t.name === 'B' && !t.isClone);
    const vars = {}; for (const t of vm.targets) for (const v of t.vars.values()) if (!t.isClone) vars[v.name] = v.value;
    const res = { vm, A, B, vars, clones: vm.targets.filter(t => t.isClone).length };
    return res;
  },
};
`;

const CASES = [
  // ---- motion ----
  ['gå 10 steg', `b.flag(), k('motion_movesteps', {STEPS: 10})`, r => r.A.x === 10 && r.A.y === 0],
  ['rotera höger/vänster', `b.flag(), k('motion_turnright', {DEGREES: 45}), k('motion_turnleft', {DEGREES: 15})`, r => r.A.dir === 120],
  ['riktning slår runt', `b.flag(), k('motion_pointindirection', {DIRECTION: 270})`, r => r.A.dir === -90],
  ['gå till x y', `b.flag(), k('motion_gotoxy', {X: 30, Y: -40})`, r => r.A.x === 30 && r.A.y === -40],
  ['gå till annan sprajt', `b.flag(), k('motion_goto', {TO: 'B'})`, r => r.A.x === 200 && r.A.y === 0],
  ['glid till x y', `b.flag(), k('motion_glidesecstoxy', {SECS: 0.2, X: 100, Y: 50})`, r => r.A.x === 100 && r.A.y === 50, 500],
  ['glid pågår', `b.flag(), k('motion_glidesecstoxy', {SECS: 2, X: 100, Y: 0})`, r => r.A.x > 0 && r.A.x < 100, 300],
  ['peka mot', `b.flag(), k('motion_pointtowards', {TOWARDS: 'B'})`, r => Math.abs(r.A.dir - 90) < 1e-9],
  ['ändra x/y, sätt x/y', `b.flag(), k('motion_changexby', {DX: 5}), k('motion_changeyby', {DY: -7}), k('motion_setx', {X: k('operator_add', {NUM1: k('motion_xposition'), NUM2: 1})}), k('motion_sety', {Y: 12})`, r => r.A.x === 6 && r.A.y === 12],
  ['studsa mot kanten', `b.flag(), k('motion_gotoxy', {X: 235, Y: 0}), k('motion_pointindirection', {DIRECTION: 90}), k('motion_ifonedgebounce')`, r => r.A.dir < 0],
  ['stannar innanför scenen', `b.flag(), k('motion_gotoxy', {X: 1000, Y: 1000})`, r => r.A.x < 280 && r.A.y < 220],
  ['rotationsstil', `b.flag(), k('motion_setrotationstyle', {STYLE: 'left-right'}), k('motion_pointindirection', {DIRECTION: -90})`, r => r.A.rotationStyle === 'left-right' && r.A.flip() === -1],
  // ---- looks ----
  ['säg', `b.flag(), b.say('Hej!')`, r => r.A.bubble && r.A.bubble.text === 'Hej!'],
  ['säg i sekunder försvinner', `b.flag(), b.sayFor('Hej!', 0.1)`, r => r.A.bubble === null, 500],
  ['tänk', `b.flag(), k('looks_think', {MESSAGE: 'Hmm'})`, r => r.A.bubble.type === 'think'],
  ['byt kostym med namn och nummer', `b.flag(), k('looks_switchcostumeto', {COSTUME: 'Boll'}), b.set(b.V('c'), k('looks_costumenumbername', {NUMBER_NAME: 'number'})), k('looks_switchcostumeto', {COSTUME: 1})`, r => r.vars.c === 2 && r.A.costume === 0],
  ['nästa kostym slår runt', `b.flag(), k('looks_nextcostume'), k('looks_nextcostume')`, r => r.A.costume === 0],
  ['byt bakgrund startar hatt', `b.flag(), k('looks_switchbackdropto', {BACKDROP: 'Rymden'})`, r => r.vars.hatt == 1, 300,
    `stage: [[k('event_whenbackdropswitchesto', {BACKDROP: 'Rymden'}), b.set(b.V('hatt'), 1)]]`],
  ['nästa bakgrund / namn', `b.flag(), k('looks_nextbackdrop'), b.set(b.V('bn'), k('looks_backdropnumbername', {NUMBER_NAME: 'name'}))`, r => r.vars.bn === 'Rymden'],
  ['storlek', `b.flag(), k('looks_setsizeto', {SIZE: 50}), k('looks_changesizeby', {CHANGE: 25}), b.set(b.V('s'), k('looks_size'))`, r => r.vars.s === 75],
  ['effekter', `b.flag(), k('looks_seteffectto', {EFFECT: 'GHOST', VALUE: 150}), k('looks_changeeffectby', {EFFECT: 'COLOR', CHANGE: 25}), k('looks_changeeffectby', {EFFECT: 'COLOR', CHANGE: 25})`, r => r.A.effects.ghost === 100 && r.A.effects.color === 50],
  ['ta bort effekter', `b.flag(), k('looks_seteffectto', {EFFECT: 'WHIRL', VALUE: 50}), k('looks_cleargraphiceffects')`, r => Object.keys(r.A.effects).length === 0],
  ['alla effekter ritas', `b.flag(), ...['COLOR','FISHEYE','WHIRL','PIXELATE','MOSAIC','BRIGHTNESS','GHOST'].map(e => k('looks_seteffectto', {EFFECT: e, VALUE: 40}))`, r => { r.vm.render(); return r.vm.fxCache.size > 0; }],
  ['göm och visa', `b.flag(), k('looks_hide')`, r => r.A.visible === false],
  ['lager', `b.flag(), k('looks_gotofrontback', {FRONT_BACK: 'front'})`, r => r.vm.drawOrder().slice(-1)[0] === r.A],
  ['lager bakåt', `b.flag(), k('looks_gotofrontback', {FRONT_BACK: 'front'}), k('looks_goforwardbackwardlayers', {FORWARD_BACKWARD: 'backward', NUM: 1})`, r => r.vm.drawOrder()[0] === r.A],
  // ---- sound ----
  ['volym', `b.flag(), k('sound_setvolumeto', {VOLUME: 150}), k('sound_changevolumeby', {VOLUME: -30}), b.set(b.V('v'), k('sound_volume'))`, r => r.vars.v === 70],
  ['ljudeffekter', `b.flag(), k('sound_seteffectto', {EFFECT: 'PITCH', VALUE: 50}), k('sound_changeeffectby', {EFFECT: 'PAN', VALUE: 20}), k('sound_changeeffectby', {EFFECT: 'PAN', VALUE: 500})`, r => r.A.sfx.pitch === 50 && r.A.sfx.pan === 100],
  ['spela ljud tills klart', `b.flag(), k('sound_playuntildone', {SOUND_MENU: 'Pop'}), b.set(b.V('klar'), 1)`, r => r.vars.klar == 1, 900],
  ['stoppa alla ljud', `b.flag(), k('sound_play', {SOUND_MENU: 'Pop'}), k('sound_stopallsounds'), k('sound_cleareffects')`, r => r.A.sfx.pitch === 0],
  // ---- events ----
  ['meddelande', `b.flag(), b.bc('hej')`, r => r.vars.fick == 'ja', 300, `b: [[b.when('hej'), b.set(b.V('fick'), 'ja')]]`],
  ['meddelande och vänta', `b.flag(), b.bcw('hej'), b.set(b.V('ordning'), b.join(b.get(b.V('ordning')), 'A'))`, r => r.vars.ordning === 'BA', 600,
    `b: [[b.when('hej'), k('control_wait', {DURATION: 0.2}), b.set(b.V('ordning'), 'B')]]`],
  ['tangent trycks', `k('event_whenkeypressed', {KEY_OPTION: 'space'}), b.set(b.V('t'), 1)`, r => r.vars.t == 1, 200, `after: async vm => vm.keyDown('space')`],
  ['vilken tangent som helst', `k('event_whenkeypressed', {KEY_OPTION: 'any'}), b.set(b.V('t'), 2)`, r => r.vars.t == 2, 200, `after: async vm => vm.keyDown('q')`],
  ['sprajt klickas', `k('event_whenthisspriteclicked'), b.set(b.V('k'), 1)`, r => r.vars.k == 1, 200, `after: async vm => vm.click(vm.topAt(0, 0))`],
  ['scenen klickas', `b.flag()`, r => r.vars.sk == 1, 200, `stage: [[k('event_whenstageclicked'), b.set(b.V('sk'), 1)]], after: async vm => vm.click(null)`],
  ['när timer > värde', `k('event_whengreaterthan', {WHENGREATERTHANMENU: 'TIMER', VALUE: 0.1}), b.set(b.V('g'), 1)`, r => r.vars.g == 1, 500],
  // ---- control ----
  ['repetera', `b.flag(), b.set(b.V('n'), 0), b.repeat(7, [b.change(b.V('n'), 1)])`, r => r.vars.n === 7, 600],
  ['för alltid + stoppa allt', `b.flag(), b.set(b.V('n'), 0), b.forever([b.change(b.V('n'), 1), b.ifThen(b.eq(b.get(b.V('n')), 5), [k('control_stop', {STOP_OPTION: 'all'})])])`, r => r.vars.n === 5 && r.vm.threads.length === 0, 600],
  ['om annars', `b.flag(), b.ifElse(b.gt(3, 2), [b.set(b.V('x'), 'ja')], [b.set(b.V('x'), 'nej')])`, r => r.vars.x === 'ja'],
  ['vänta tills', `b.flag(), b.set(b.V('w'), 0), b.waitUntil(b.gt(k('sensing_timer'), 0.15)), b.set(b.V('w'), 1)`, r => r.vars.w == 1, 500],
  ['repetera tills', `b.flag(), b.set(b.V('n'), 1), k('control_repeat_until', {CONDITION: b.gt(b.get(b.V('n')), 100), SUBSTACK: [b.set(b.V('n'), b.mul(b.get(b.V('n')), 2))]})`, r => r.vars.n === 128, 800],
  ['vänta', `b.flag(), b.set(b.V('w'), 0), k('control_wait', {DURATION: 0.3}), b.set(b.V('w'), 1)`, r => r.vars.w == 0, 150],
  ['stoppa detta skript', `b.flag(), b.set(b.V('s'), 1), k('control_stop', {STOP_OPTION: 'this script'}), b.set(b.V('s'), 2)`, r => r.vars.s == 1],
  ['stoppa andra skript', `b.flag(), k('control_wait', {DURATION: 0.05}), k('control_stop', {STOP_OPTION: 'other scripts in sprite'}), b.set(b.V('snap'), b.get(b.V('o')))`, r => r.vars.o > 0 && r.vars.o === r.vars.snap, 400,
    `a2: true`],
  ['kloner', `b.flag(), b.repeat(3, [k('control_create_clone_of', {CLONE_OPTION: '_myself_'})])`, r => r.clones === 3 && r.vars.kl === 3, 500,
    `extra: [[k('control_start_as_clone'), b.change(b.V('kl'), 1)]]`],
  ['radera klon', `b.flag(), k('control_create_clone_of', {CLONE_OPTION: 'B'})`, r => r.clones === 0, 500,
    `b: [[k('control_start_as_clone'), k('control_wait', {DURATION: 0.05}), k('control_delete_this_clone')]]`],
  ['klon ärver läge och egna variabler', `b.flag(), b.set(b.V('mina', s.id), 5), k('motion_gotoxy', {X: 11, Y: 0}), k('control_create_clone_of', {CLONE_OPTION: '_myself_'})`, r => { const c = r.vm.targets.find(t => t.isClone); return c && c.x === 11 && [...c.vars.values()][0].value == 5; }, 300],
  // ---- sensing ----
  ['rör kanten', `b.flag(), k('motion_gotoxy', {X: 240, Y: 0}), b.set(b.V('r'), k('sensing_touchingobject', {TOUCHINGOBJECTMENU: '_edge_'}))`, r => r.vars.r === true],
  ['rör annan sprajt', `b.flag(), k('motion_gotoxy', {X: 190, Y: 0}), b.set(b.V('r'), k('sensing_touchingobject', {TOUCHINGOBJECTMENU: 'B'})), k('motion_gotoxy', {X: 0, Y: 0}), b.set(b.V('r2'), k('sensing_touchingobject', {TOUCHINGOBJECTMENU: 'B'}))`, r => r.vars.r === true && r.vars.r2 === false],
  ['rör musen', `b.flag(), b.set(b.V('r'), k('sensing_touchingobject', {TOUCHINGOBJECTMENU: '_mouse_'}))`, r => r.vars.r === true, 200, `before: true`],
  ['rör färg', `b.flag(), k('motion_gotoxy', {X: 180, Y: 0}), b.set(b.V('r'), k('sensing_touchingcolor', {COLOR: '#1baf7a'})), k('motion_gotoxy', {X: -100, Y: 0}), b.set(b.V('r2'), k('sensing_touchingcolor', {COLOR: '#1baf7a'}))`, r => r.vars.r === true && r.vars.r2 === false],
  ['färg rör färg', `b.flag(), k('motion_gotoxy', {X: 180, Y: 0}), b.set(b.V('r'), k('sensing_coloristouchingcolor', {COLOR: '#1baf7a', COLOR2: '#1baf7a'}))`, r => r.vars.r === true],
  ['avstånd', `b.flag(), b.set(b.V('d'), k('sensing_distanceto', {DISTANCETOMENU: 'B'}))`, r => r.vars.d === 200],
  ['fråga och svar', `b.flag(), k('sensing_askandwait', {QUESTION: 'Vad heter du?'}), b.set(b.V('svar'), k('sensing_answer'))`, r => r.vars.svar === 'Robban', 400,
    `after: async vm => { await new Promise(r => setTimeout(r, 100)); vm.askQ.done('Robban'); }`],
  ['tangent nedtryckt', `b.flag(), b.set(b.V('p'), k('sensing_keypressed', {KEY_OPTION: 'a'}))`, r => r.vars.p === true, 200, `before: vm => vm.keys.add('a')`],
  ['mus', `b.flag(), b.set(b.V('mx'), k('sensing_mousex')), b.set(b.V('md'), k('sensing_mousedown'))`, r => r.vars.mx === 33 && r.vars.md === true, 200, `before: vm => Object.assign(vm.mouse, {x: 33, y: 0, down: true})`],
  ['dragläge', `b.flag(), k('sensing_setdragmode', {DRAG_MODE: 'draggable'})`, r => r.A.draggable === true],
  ['timer nollställs', `b.flag(), k('control_wait', {DURATION: 0.2}), k('sensing_resettimer'), b.set(b.V('t'), k('sensing_timer'))`, r => r.vars.t < 0.1, 500],
  ['av annan sprajt', `b.flag(), b.set(b.V('x'), k('sensing_of', {PROPERTY: 'x position', OBJECT: 'B'})), b.set(b.V('bn'), k('sensing_of', {PROPERTY: 'backdrop name', OBJECT: '_stage_'}))`, r => r.vars.x === 200 && r.vars.bn === 'Vit'],
  ['av annan sprajts variabel', `b.flag(), k('control_wait', {DURATION: 0.05}), b.set(b.V('x'), k('sensing_of', {PROPERTY: 'hemlis', OBJECT: 'B'}))`, r => r.vars.x == 42, 300,
    `b: [[b.flag(), b.set(b.V('hemlis', s2.id), 42)]]`],
  ['datum och tid', `b.flag(), b.set(b.V('y'), k('sensing_current', {CURRENTMENU: 'YEAR'})), b.set(b.V('d'), k('sensing_dayssince2000'))`, r => r.vars.y >= 2026 && r.vars.d > 9000],
  ['ljudnivå utan mikrofon', `b.flag(), b.set(b.V('l'), k('sensing_loudness'))`, r => typeof r.vars.l === 'number'],
  ['användarnamn', `b.flag(), b.set(b.V('u'), k('sensing_username'))`, r => typeof r.vars.u === 'string'],
  // ---- operators ----
  ['räknesätt', `b.flag(), b.set(b.V('r'), b.join(b.join(b.add(2, 3), b.sub(2, 10)), b.join(b.mul(3, 4), b.div(7, 2))))`, r => r.vars.r === '5-8123.5'],
  ['slump heltal', `b.flag(), b.set(b.V('r'), k('operator_random', {FROM: 1, TO: 6}))`, r => Number.isInteger(r.vars.r) && r.vars.r >= 1 && r.vars.r <= 6],
  ['slump decimal', `b.flag(), b.set(b.V('r'), k('operator_random', {FROM: 1, TO: '2.5'}))`, r => r.vars.r >= 1 && r.vars.r <= 2.5],
  ['jämförelser som Scratch', `b.flag(), b.set(b.V('r'), b.join(b.join(b.lt('10', '9'), b.eq('Hej', 'hej')), b.gt('b', 'a')))`, r => r.vars.r === 'falsetruetrue'],
  ['och eller inte', `b.flag(), b.set(b.V('r'), b.join(b.and(b.eq(1,1), b.eq(1,2)), k('operator_or', {OPERAND1: b.eq(1,1), OPERAND2: b.eq(1,2)})))`, r => r.vars.r === 'falsetrue'],
  ['text', `b.flag(), b.set(b.V('r'), b.join(b.letter(2, 'äpple'), b.join(k('operator_length', {STRING: 'banan'}), k('operator_contains', {STRING1: 'äpple', STRING2: 'P'}))))`, r => r.vars.r === 'p5true'],
  ['modulo och avrunda', `b.flag(), b.set(b.V('r'), b.join(b.mod(-7, 3), k('operator_round', {NUM: 2.5})))`, r => r.vars.r === '23'],
  ['matematik', `b.flag(), ...['abs','floor','ceiling','sqrt','sin','cos','tan','asin','acos','atan','ln','log','e ^','10 ^'].map((o, i) => b.set(b.V('m' + i), k('operator_mathop', {OPERATOR: o, NUM: o === 'asin' || o === 'acos' ? 0.5 : 16})))`,
    r => r.vars.m0 === 16 && r.vars.m3 === 4 && Math.abs(r.vars.m7 - 30) < 1e-9 && Math.abs(r.vars.m11 - Math.log10(16)) < 1e-12 && r.vars.m13 === 1e16],
  // ---- variables and lists ----
  ['variabler', `b.flag(), b.set(b.V('v'), 5), b.change(b.V('v'), 2.5), k('data_showvariable', {VARIABLE: b.V('v')})`, r => r.vars.v === 7.5 && r.vm.monitors.size === 1],
  ['listor', `b.flag(), k('data_deletealloflist', {LIST: b.L('l')}), ...['a','b','c','d'].map(x => k('data_addtolist', {LIST: b.L('l'), ITEM: x})),
      k('data_deleteoflist', {LIST: b.L('l'), INDEX: 2}), k('data_insertatlist', {LIST: b.L('l'), INDEX: 1, ITEM: 'z'}), k('data_replaceitemoflist', {LIST: b.L('l'), INDEX: 'last', ITEM: 'q'}),
      b.set(b.V('r'), b.join(b.get(b.L('l')), b.join(k('data_itemoflist', {LIST: b.L('l'), INDEX: 2}), b.join(k('data_itemnumoflist', {LIST: b.L('l'), ITEM: 'c'}), b.join(k('data_lengthoflist', {LIST: b.L('l')}), k('data_listcontainsitem', {LIST: b.L('l'), ITEM: 'Z'})))))),
      k('data_showlist', {LIST: b.L('l')}), k('data_hidelist', {LIST: b.L('l')})`,
    r => r.vars.r === 'zacqa34true' && r.vm.monitors.size === 0],
  ['lista med långa saker', `b.flag(), k('data_deletealloflist', {LIST: b.L('l')}), k('data_addtolist', {LIST: b.L('l'), ITEM: 'hej'}), k('data_addtolist', {LIST: b.L('l'), ITEM: 'då'}), b.set(b.V('r'), b.get(b.L('l')))`, r => r.vars.r === 'hej då'],
  // ---- my blocks ----
  ['eget block med indata', `b.flag(), b.call('dubbla %s', 21)`, r => r.vars.svar === 42, 300,
    `extra: [[b.def('dubbla %s', ['tal'], false, [b.set(b.V('svar'), b.mul(b.arg('tal'), 2))])]]`],
  ['rekursion utan skärmuppdatering', `b.flag(), b.set(b.V('f'), 1), b.call('fak %s', 10)`, r => r.vars.f === 3628800, 300,
    `extra: [[b.def('fak %s', ['n'], true, [b.ifThen(b.gt(b.arg('n'), 1), [b.set(b.V('f'), b.mul(b.get(b.V('f')), b.arg('n'))), b.call('fak %s', b.sub(b.arg('n'), 1))])])]]`],
  ['utan skärmuppdatering är snabbt', `b.flag(), b.call('räkna')`, r => r.vars.n === 3000, 200,
    `extra: [[b.def('räkna', [], true, [b.set(b.V('n'), 0), b.repeat(3000, [b.change(b.V('n'), 1)])])]]`],
  // ---- pen ----
  ['penna ritar', `b.flag(), k('pen_clear'), k('pen_setPenColorToColor', {COLOR: '#ff0000'}), k('pen_setPenSizeTo', {SIZE: 8}), k('motion_gotoxy', {X: -100, Y: 0}), k('pen_penDown'), k('motion_gotoxy', {X: 100, Y: 0}), k('pen_penUp'), k('looks_hide')`,
    r => { const d = r.vm.pg.getImageData(480, 360, 1, 1).data; return d[0] > 200 && d[1] < 60 && d[3] > 200; }],
  ['pennfärg och storlek', `b.flag(), k('pen_changePenColorParamBy', {COLOR_PARAM: 'color', VALUE: 50}), k('pen_setPenColorParamTo', {COLOR_PARAM: 'transparency', VALUE: 30}), k('pen_changePenSizeBy', {SIZE: 4})`, r => r.A.pen.h === 16 && r.A.pen.t === 30 && r.A.pen.size === 5],
  ['stämpla och radera', `b.flag(), k('pen_stamp')`, r => { const d = r.vm.pg.getImageData(480, 360, 1, 1).data; return d[3] > 0; }],
  // ---- music and speech ----
  ['tempo', `b.flag(), k('music_setTempo', {TEMPO: 120}), k('music_changeTempo', {TEMPO: -20}), b.set(b.V('t'), k('music_getTempo'))`, r => r.vars.t === 100],
  ['ton väntar takter', `b.flag(), k('music_setTempo', {TEMPO: 240}), k('music_setInstrument', {INSTRUMENT: 3}), k('music_playNoteForBeats', {NOTE: 60, BEATS: 1}), k('music_playDrumForBeats', {DRUM: 2, BEATS: 0.5}), k('music_restForBeats', {BEATS: 0.5}), b.set(b.V('m'), 1)`, r => r.vars.m == 1 && r.A.instrument === 3, 900],
  ['röst och språk', `b.flag(), k('text2speech_setVoice', {VOICE: 'KITTEN'}), k('text2speech_setLanguage', {LANGUAGE: 'en-US'})`, r => r.A.voice === 'KITTEN' && r.vm.ttsLang === 'en-US'],
  // ---- AI agent ----
  ['agenten lär sig vilket val som ger belöning', `b.flag(), k('ai_forget'), k('ai_set_curiosity', {VALUE: 30}),
      b.repeat(120, [b.set(b.V('val'), k('ai_choose', {OPTIONS: 'sten sax påse', STATE: 'start'})), b.ifElse(b.eq(b.get(b.V('val')), 'påse'), [k('ai_reward', {REWARD: 1})], [k('ai_reward', {REWARD: -1})])]),
      k('ai_set_curiosity', {VALUE: 0}), b.set(b.V('bäst'), k('ai_choose', {OPTIONS: 'sten sax påse', STATE: 'start'})), b.set(b.V('lägen'), k('ai_states')), k('ai_set_curiosity', {VALUE: 20})`,
    r => r.vars.bäst === 'påse' && r.vars.lägen === 1, 3000],
  ['agenten svarar och lär sig svar', `b.flag(), k('ai_teach', {QUESTION: 'vad är 2+2', ANSWER: 'Fyra!'}), b.set(b.V('s'), k('ai_ask', {TEXT: 'vad är 2+2'})), b.set(b.V('n'), k('ai_name'))`, r => r.vars.s === 'Fyra!' && r.vars.n === 'Testa'],
  ['agentens nyfikenhet', `b.flag(), k('ai_set_curiosity', {VALUE: 35}), b.set(b.V('c'), k('ai_curiosity')), k('ai_set_curiosity', {VALUE: 20}), k('ai_read', {TEXT: 'Månen lyser.'}), k('ai_newround'), b.set(b.V('sm'), k('ai_smart'))`, r => r.vars.c === 35 && typeof r.vars.sm === 'number'],
  // ---- chess ----
  ['schack: drag och pjäser', `b.flag(), k('chess_new'), k('chess_move', {FROM: 'e2', TO: 'e4'}), b.set(b.V('p'), k('chess_piece', {SQUARE: 'e4'})), b.set(b.V('tur'), k('chess_turn')),
      b.set(b.V('ok'), k('chess_legal', {FROM: 'e7', TO: 'e5'})), b.set(b.V('fel'), k('chess_legal', {FROM: 'e7', TO: 'e4'})), b.set(b.V('drag'), k('chess_moves_from', {SQUARE: 'g8'}))`,
    r => r.vars.p === 'vB' && r.vars.tur === 'svart' && r.vars.ok === true && r.vars.fel === false && r.vars.drag.split(' ').sort().join(' ') === 'f6 h6'],
  ['schack: agenten drar', `b.flag(), k('chess_new'), k('chess_move', {FROM: 'e2', TO: 'e4'}), k('chess_ai_move', {DEPTH: 2}), b.set(b.V('tur'), k('chess_turn')), b.set(b.V('senast'), k('chess_last'))`,
    r => r.vars.tur === 'vit' && /^[a-h][78] [a-h][5-6]$/.test(r.vars.senast), 1500],
  ['schack: schackmatt', `b.flag(), k('chess_new'), ...[['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']].map(([f,t]) => k('chess_move', {FROM: f, TO: t})), b.set(b.V('st'), k('chess_status')), b.set(b.V('slut'), k('chess_over'))`,
    r => r.vars.st === 'svart vann' && r.vars.slut === true],
  ['schack: ångra och rutor', `b.flag(), k('chess_new'), k('chess_move', {FROM: 'd2', TO: 'd4'}), k('chess_undo'), b.set(b.V('p'), k('chess_piece', {SQUARE: 'd2'})),
      b.set(b.V('r'), k('chess_square_at', {X: -150, Y: -150})), b.set(b.V('x'), k('chess_square_x', {SQUARE: 'h8'})), b.set(b.V('y'), k('chess_square_y', {SQUARE: 'h8'})), b.set(b.V('g'), k('chess_games'))`,
    r => r.vars.p === 'vB' && r.vars.r === 'a1' && r.vars.x === 140 && r.vars.y === 140 && typeof r.vars.g === 'number'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('.card.new'); await page.fill('#nName', 'Testa'); await page.press('#nName', 'Enter');
  await page.addScriptTag({ content: HARNESS });
  let failed = 0;
  const check = (name, ok, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  (' + extra + ')' : '')); if (!ok) failed++; };

  // every block in the palette, for a sprite and for the stage, has an implementation
  const cov = await page.evaluate(() => {
    const fake = RB.newTarget(false, 'x', [{ name: 'k' }], [{ name: 'l' }]), st = RB.newTarget(true, 'Scen', [{ name: 'b' }], []);
    const types = new Set();
    for (const xml of [RB.toolbox(fake, st), RB.toolbox(st, st)]) for (const b of new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('block,shadow')) types.add(b.getAttribute('type'));
    // blocks the Variables and My Blocks categories add themselves
    for (const t of ['data_variable', 'data_setvariableto', 'data_changevariableby', 'data_showvariable', 'data_hidevariable', 'data_listcontents', 'data_addtolist',
      'data_deleteoflist', 'data_deletealloflist', 'data_insertatlist', 'data_replaceitemoflist', 'data_itemoflist', 'data_itemnumoflist', 'data_lengthoflist',
      'data_listcontainsitem', 'data_showlist', 'data_hidelist', 'procedures_call', 'argument_reporter_string_number', 'argument_reporter_boolean']) types.add(t);
    const hats = [...types].filter(t => RB.HATS.has(t));
    const missing = [...types].filter(t => !RB.HATS.has(t) && !RB.implemented(t));
    const noDef = [...types].filter(t => !Blockly.Blocks[t]);
    return { n: types.size, hats: hats.length, missing, noDef };
  });
  check(`alla ${cov.n} block i paletten har en körbar implementation (${cov.hats} hattar)`, cov.missing.length === 0, cov.missing.join(', '));
  check('alla block i paletten finns i editorn', cov.noDef.length === 0, cov.noDef.join(', '));

  for (const [name, stack, test, ms, extra] of CASES) {
    let src = `(b, k, s, s2) => ({ a: [[${stack}]]`;
    if (extra && extra.startsWith('stage:')) src += `, ${extra.replace(/,\s*after:.*$/s, '')}`;
    if (extra && extra.startsWith('b:')) src += `, ${extra}`;
    if (extra && extra.startsWith('extra:')) src = `(b, k, s, s2) => ({ a: [[${stack}], ...${extra.slice(6)}]`;
    if (extra === 'a2: true') src = `(b, k, s, s2) => ({ a: [[${stack}], [b.flag(), b.set(b.V('o'), 0), b.forever([b.change(b.V('o'), 1)])]]`;
    if (extra && /after:/.test(extra)) src += `, after: ${extra.replace(/^.*after:\s*/s, '')}`;
    src += '})';
    let before = 'null';
    if (extra === 'before: true') before = 'vm => Object.assign(vm.mouse, {x: 0, y: 0})';
    else if (extra && extra.startsWith('before:')) before = extra.slice(7);
    try {
      const res = await page.evaluate(async ([src, before, ms, testSrc]) => {
        const build = eval(src); const pre = eval(before);
        const r = await T.run(build, ms, pre);
        const ok = eval(testSrc)(r);
        return { ok, vars: JSON.stringify(r.vars).slice(0, 200), A: r.A && { x: r.A.x, y: r.A.y, dir: r.A.dir, costume: r.A.costume } };
      }, [src, before, ms || 200, test.toString()]);
      check(name, res.ok, res.ok ? '' : res.vars + ' ' + JSON.stringify(res.A));
    } catch (e) { check(name, false, e.message.split('\n')[0]); }
  }
  check('inga sidfel', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
