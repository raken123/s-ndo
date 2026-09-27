// The block palette: every Scratch 3 category in Swedish (the same blocks and
// default values as Scratch's own toolbox), menus that list the project's
// sprites, costumes and sounds, and the extension blocks.
(function () {
'use strict';
const RB = window.RB = window.RB || {};
const B = window.Blockly;
B.ScratchMsgs.setLocale('sv');
// without this, a workspace made without a toolbox (like "Make a Block") gets a demo palette
B.Blocks.defaultToolbox = null;
const T = (id, dflt) => B.ScratchMsgs.translate(id, dflt);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- icons for the extension categories ---------- */
const svg = s => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
const ICON = {
  pen: SB_MEDIA['extensions/pen-block-icon.svg'],
  music: SB_MEDIA['extensions/music-block-icon.svg'],
  tts: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="9" fill="#0FBD8C"/><path d="M9 15h6l8-7v24l-8-7H9z" fill="#fff" stroke-linejoin="round"/><path d="M27 14c3 3 3 9 0 12M30.5 10.5c5 5 5 14 0 19" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>'),
  ai: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="9" fill="#5C6BF0"/><path d="M20 7v4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="7" r="2.6" fill="#fff"/><rect x="9" y="12" width="22" height="19" rx="6" fill="#fff"/><circle cx="16" cy="21" r="2.6" fill="#3f51d6"/><circle cx="24" cy="21" r="2.6" fill="#3f51d6"/><path d="M16 26.5q4 2.5 8 0" stroke="#3f51d6" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'),
  chess: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="9" fill="#A0714F"/><path d="M13 32h14l-1.5-4h-11zM15.5 28l1.8-12h5.4l1.8 12z" fill="#fff"/><path d="M13 12.5l2.2 3.8h9.6l2.2-3.8-3.2 1.3-2.4-4.3-1.4 3.2-1.4-3.2-2.4 4.3z" fill="#fff" stroke="#fff" stroke-linejoin="round"/><circle cx="20" cy="7.5" r="2.2" fill="#fff"/></svg>'),
};
RB.ICON = ICON;

/* ---------- extension categories ---------- */
const EXT = {
  pen: { name: 'Penna', c: ['#0FBD8C', '#0DA57A', '#0B8E69'], icon: ICON.pen },
  music: { name: 'Musik', c: ['#0FBD8C', '#0DA57A', '#0B8E69'], icon: ICON.music },
  tts: { name: 'Text till tal', c: ['#0FBD8C', '#0DA57A', '#0B8E69'], icon: ICON.tts },
  ai: { name: 'AI-agent', c: ['#5C6BF0', '#4A58DA', '#3F4CC2'], icon: ICON.ai },
  chess: { name: 'Schack', c: ['#A0714F', '#8C6143', '#7A5439'], icon: ICON.chess },
};
RB.EXT = EXT;
const SHAPE = { command: 'shape_statement', reporter: 'output_string', boolean: 'output_boolean', number: 'output_number' };
// text uses [NAME] for inputs; args lists {name, type}
function defineExt(cat, type, kind, text, inputs = {}) {
  const E = EXT[cat]; const args = []; let k = 0;
  const msg = text.replace(/\[([A-Z_0-9]+)\]/g, (m, name) => {
    const def = inputs[name] || { type: 'input_value' };
    args.push(Object.assign({ name }, def)); return '%' + (++k);
  });
  B.Blocks[type] = {
    init() {
      this.jsonInit({
        type, inputsInline: true, category: cat, colour: E.c[0], colourSecondary: E.c[1], colourTertiary: E.c[2],
        message0: '%1 %2', args0: [{ type: 'field_image', src: E.icon, width: 40, height: 40 }, { type: 'field_vertical_separator' }],
        message1: msg, args1: args, extensions: ['scratch_extension', SHAPE[kind]],
      });
    },
  };
}
function defineMenu(cat, type, field, options) {
  const E = EXT[cat];
  B.Blocks[type] = {
    init() {
      this.jsonInit({
        message0: '%1', args0: [{ type: 'field_dropdown', name: field, options: typeof options === 'function' ? options : options }],
        inputsInline: true, output: 'String', colour: E.c[1], colourSecondary: E.c[1], colourTertiary: E.c[2], outputShape: B.OUTPUT_SHAPE_ROUND,
      });
    },
  };
}

// Pen
defineExt('pen', 'pen_clear', 'command', 'radera allt');
defineExt('pen', 'pen_stamp', 'command', 'stämpla');
defineExt('pen', 'pen_penDown', 'command', 'penna ned');
defineExt('pen', 'pen_penUp', 'command', 'penna upp');
defineExt('pen', 'pen_setPenColorToColor', 'command', 'sätt pennfärg till [COLOR]');
defineExt('pen', 'pen_changePenColorParamBy', 'command', 'ändra penna [COLOR_PARAM] med [VALUE]');
defineExt('pen', 'pen_setPenColorParamTo', 'command', 'sätt penna [COLOR_PARAM] till [VALUE]');
defineExt('pen', 'pen_changePenSizeBy', 'command', 'ändra pennstorlek med [SIZE]');
defineExt('pen', 'pen_setPenSizeTo', 'command', 'sätt pennstorlek till [SIZE]');
defineMenu('pen', 'pen_menu_colorParam', 'colorParam', [['färg', 'color'], ['mättnad', 'saturation'], ['ljusstyrka', 'brightness'], ['genomskinlighet', 'transparency']]);
// Music
defineExt('music', 'music_playDrumForBeats', 'command', 'spela trumma [DRUM] i [BEATS] takter');
defineExt('music', 'music_restForBeats', 'command', 'pausa i [BEATS] takter');
defineExt('music', 'music_playNoteForBeats', 'command', 'spela ton [NOTE] i [BEATS] takter');
defineExt('music', 'music_setInstrument', 'command', 'sätt instrument till [INSTRUMENT]');
defineExt('music', 'music_setTempo', 'command', 'sätt tempo till [TEMPO]');
defineExt('music', 'music_changeTempo', 'command', 'ändra tempo med [TEMPO]');
defineExt('music', 'music_getTempo', 'number', 'tempo');
defineMenu('music', 'music_menu_DRUM', 'DRUM', () => RB.DRUMS.map((d, i) => [`(${i + 1}) ${d.name}`, String(i + 1)]));
defineMenu('music', 'music_menu_INSTRUMENT', 'INSTRUMENT', () => RB.INSTRUMENTS.map((d, i) => [`(${i + 1}) ${d.name}`, String(i + 1)]));
// Text to speech
defineExt('tts', 'text2speech_speakAndWait', 'command', 'säg [WORDS]');
defineExt('tts', 'text2speech_setVoice', 'command', 'sätt röst till [VOICE]');
defineExt('tts', 'text2speech_setLanguage', 'command', 'sätt språk till [LANGUAGE]');
defineMenu('tts', 'text2speech_menu_voices', 'voices', [['alt', 'ALTO'], ['tenor', 'TENOR'], ['pip', 'SQUEAK'], ['jätte', 'GIANT'], ['kattunge', 'KITTEN']]);
RB.LANGS = [['svenska', 'sv-SE'], ['engelska', 'en-US'], ['norska', 'nb-NO'], ['danska', 'da-DK'], ['finska', 'fi-FI'], ['tyska', 'de-DE'], ['franska', 'fr-FR'],
  ['spanska', 'es-ES'], ['italienska', 'it-IT'], ['nederländska', 'nl-NL'], ['polska', 'pl-PL'], ['portugisiska', 'pt-BR'], ['ryska', 'ru-RU'], ['turkiska', 'tr-TR'],
  ['arabiska', 'ar-SA'], ['kinesiska', 'zh-CN'], ['japanska', 'ja-JP'], ['koreanska', 'ko-KR'], ['hindi', 'hi-IN']];
defineMenu('tts', 'text2speech_menu_languages', 'languages', RB.LANGS);
// AI agent
defineExt('ai', 'ai_ask', 'reporter', 'fråga agenten [TEXT]');
defineExt('ai', 'ai_teach', 'command', 'lär agenten: när någon säger [QUESTION] svara [ANSWER]');
defineExt('ai', 'ai_read', 'command', 'låt agenten läsa [TEXT]');
defineExt('ai', 'ai_choose', 'reporter', 'agenten väljer bland [OPTIONS] i läget [STATE]');
defineExt('ai', 'ai_reward', 'command', 'belöna agenten med [REWARD]');
defineExt('ai', 'ai_newround', 'command', 'ny runda för agenten');
defineExt('ai', 'ai_set_curiosity', 'command', 'sätt agentens nyfikenhet till [VALUE] %');
defineExt('ai', 'ai_curiosity', 'number', 'agentens nyfikenhet');
defineExt('ai', 'ai_states', 'number', 'antal lägen agenten minns');
defineExt('ai', 'ai_forget', 'command', 'agenten glömmer det här spelet');
defineExt('ai', 'ai_name', 'reporter', 'agentens namn');
defineExt('ai', 'ai_smart', 'number', 'agentens smarthet');
// Chess
defineExt('chess', 'chess_new', 'command', 'nytt schackparti');
defineExt('chess', 'chess_move', 'command', 'flytta från [FROM] till [TO]');
defineExt('chess', 'chess_legal', 'boolean', 'draget från [FROM] till [TO] är tillåtet?');
defineExt('chess', 'chess_ai_move', 'command', 'agenten gör ett drag och tänker [DEPTH] drag framåt');
defineExt('chess', 'chess_last', 'reporter', 'senaste draget');
defineExt('chess', 'chess_piece', 'reporter', 'pjäs på [SQUARE]');
defineExt('chess', 'chess_turn', 'reporter', 'vems tur');
defineExt('chess', 'chess_status', 'reporter', 'ställning');
defineExt('chess', 'chess_over', 'boolean', 'partiet är slut?');
defineExt('chess', 'chess_square_at', 'reporter', 'ruta vid x: [X] y: [Y]');
defineExt('chess', 'chess_square_x', 'number', 'x för ruta [SQUARE]');
defineExt('chess', 'chess_square_y', 'number', 'y för ruta [SQUARE]');
defineExt('chess', 'chess_moves_from', 'reporter', 'tillåtna drag från [SQUARE]');
defineExt('chess', 'chess_undo', 'command', 'ångra senaste draget');
defineExt('chess', 'chess_games', 'number', 'antal schackpartier agenten spelat');

/* ---------- menus that list the project's own things ---------- */
// RB.editor supplies: target() (the sprite being edited), stage(), sprites()
const ED = () => RB.editor;
function menuJson(name, fn, colors, start) {
  return {
    message0: '%1', args0: [{ type: 'field_dropdown', name, options: () => { const o = start.concat(fn()); return o.length ? o : [['', '']]; } }],
    inputsInline: true, output: 'String', colour: colors.secondary, colourSecondary: colors.secondary, colourTertiary: colors.tertiary, outputShape: B.OUTPUT_SHAPE_ROUND,
  };
}
const spriteMenu = () => ED() ? ED().sprites().filter(s => s !== ED().target()).map(s => [s.name, s.name]) : [];
const costumesMenu = () => { const t = ED() && ED().target(); return t && t.costumes.length ? t.costumes.map(c => [c.name, c.name]) : [['', '']]; };
const soundsMenu = () => { const t = ED() && ED().target(); return t && t.sounds.length ? t.sounds.map(s => [s.name, s.name]) : [['', '']]; };
const backdrops = () => { const s = ED() && ED().stage(); return s && s.costumes.length ? s.costumes.map(c => [c.name, c.name]) : [['', '']]; };
const C = B.Colours;
B.Blocks.sound_sounds_menu.init = function () { this.jsonInit(menuJson('SOUND_MENU', soundsMenu, C.sounds, [])); };
B.Blocks.looks_costume.init = function () { this.jsonInit(menuJson('COSTUME', costumesMenu, C.looks, [])); };
B.Blocks.looks_backdrops.init = function () {
  this.jsonInit(menuJson('BACKDROP', () => backdrops().concat([[T('LOOKS_NEXTBACKDROP', 'next backdrop'), 'next backdrop'],
    [T('LOOKS_PREVIOUSBACKDROP', 'previous backdrop'), 'previous backdrop'], [T('LOOKS_RANDOMBACKDROP', 'random backdrop'), 'random backdrop']]), C.looks, []));
};
B.Blocks.event_whenbackdropswitchesto.init = function () {
  this.jsonInit({ message0: B.Msg.EVENT_WHENBACKDROPSWITCHESTO, args0: [{ type: 'field_dropdown', name: 'BACKDROP', options: backdrops }],
    colour: C.event.primary, colourSecondary: C.event.secondary, colourTertiary: C.event.tertiary, extensions: ['shape_hat'] });
};
B.Blocks.motion_pointtowards_menu.init = function () { this.jsonInit(menuJson('TOWARDS', spriteMenu, C.motion, [[T('MOTION_POINTTOWARDS_POINTER', 'mouse-pointer'), '_mouse_'], [T('MOTION_POINTTOWARDS_RANDOM', 'random direction'), '_random_']])); };
B.Blocks.motion_goto_menu.init = function () { this.jsonInit(menuJson('TO', spriteMenu, C.motion, [[T('MOTION_GOTO_RANDOM', 'random position'), '_random_'], [T('MOTION_GOTO_POINTER', 'mouse-pointer'), '_mouse_']])); };
B.Blocks.motion_glideto_menu.init = function () { this.jsonInit(menuJson('TO', spriteMenu, C.motion, [[T('MOTION_GOTO_RANDOM', 'random position'), '_random_'], [T('MOTION_GOTO_POINTER', 'mouse-pointer'), '_mouse_']])); };
B.Blocks.sensing_of_object_menu.init = function () {
  const all = () => ED() ? ED().sprites().map(s => [s.name, s.name]) : [];
  this.jsonInit(menuJson('OBJECT', all, C.sensing, [[T('SENSING_OF_STAGE', 'Stage'), '_stage_']]));
};
B.Blocks.sensing_of.init = function () {
  const block = this;
  const menu = () => {
    const stageOpts = [[T('SENSING_OF_BACKDROPNUMBER', 'backdrop #'), 'backdrop #'], [T('SENSING_OF_BACKDROPNAME', 'backdrop name'), 'backdrop name'], [T('SENSING_OF_VOLUME', 'volume'), 'volume']];
    const spriteOpts = [[T('SENSING_OF_XPOSITION', 'x position'), 'x position'], [T('SENSING_OF_YPOSITION', 'y position'), 'y position'],
      [T('SENSING_OF_DIRECTION', 'direction'), 'direction'], [T('SENSING_OF_COSTUMENUMBER', 'costume #'), 'costume #'],
      [T('SENSING_OF_COSTUMENAME', 'costume name'), 'costume name'], [T('SENSING_OF_SIZE', 'size'), 'size'], [T('SENSING_OF_VOLUME', 'volume'), 'volume']];
    const ed = ED(); if (!ed) return stageOpts;
    const input = block.getInput('OBJECT'); const target = input && input.connection && input.connection.targetBlock();
    const obj = target && target.type === 'sensing_of_object_menu' ? target.getFieldValue('OBJECT') : '_stage_';
    if (obj === '_stage_') return stageOpts.concat(ed.varNames('stage').map(n => [n, n]));
    const s = ed.sprites().find(x => x.name === obj);
    return spriteOpts.concat(s ? ed.varNames(s.id).map(n => [n, n]) : []);
  };
  this.jsonInit({ message0: B.Msg.SENSING_OF, args0: [{ type: 'field_dropdown', name: 'PROPERTY', options: menu }, { type: 'input_value', name: 'OBJECT' }],
    output: true, colour: C.sensing.primary, colourSecondary: C.sensing.secondary, colourTertiary: C.sensing.tertiary, outputShape: B.OUTPUT_SHAPE_ROUND });
};
B.Blocks.sensing_distancetomenu.init = function () { this.jsonInit(menuJson('DISTANCETOMENU', spriteMenu, C.sensing, [[T('SENSING_DISTANCETO_POINTER', 'mouse-pointer'), '_mouse_']])); };
B.Blocks.sensing_touchingobjectmenu.init = function () {
  this.jsonInit(menuJson('TOUCHINGOBJECTMENU', spriteMenu, C.sensing, [[T('SENSING_TOUCHINGOBJECT_POINTER', 'mouse-pointer'), '_mouse_'], [T('SENSING_TOUCHINGOBJECT_EDGE', 'edge'), '_edge_']]));
};
B.Blocks.control_create_clone_of_menu.init = function () {
  const opts = () => {
    const ed = ED(); if (ed && ed.target() && ed.target().isStage) return spriteMenu();
    return [[T('CONTROL_CREATECLONEOF_MYSELF', 'myself'), '_myself_']].concat(spriteMenu());
  };
  this.jsonInit(menuJson('CLONE_OPTION', opts, C.control, []));
};
B.VerticalFlyout.getCheckboxState = id => !!(RB.editor && RB.editor.isMonitored(id));

/* ---------- the toolbox XML ---------- */
const sep = '<sep gap="36"/>';
const num = (name, v, type = 'math_number') => `<value name="${name}"><shadow type="${type}"><field name="NUM">${esc(v)}</field></shadow></value>`;
const txt = (name, v) => `<value name="${name}"><shadow type="text"><field name="TEXT">${esc(v)}</field></shadow></value>`;
const menu = (name, type, field, v) => `<value name="${name}"><shadow type="${type}">${field ? `<field name="${field}">${esc(v)}</field>` : ''}</shadow></value>`;
const col = name => `<value name="${name}"><shadow type="colour_picker"/></value>`;
const blk = (type, inner = '', id = '') => `<block type="${type}"${id ? ` id="${id}"` : ''}>${inner}</block>`;
const cat = (key, id, colour, secondary, body, extra = '') => `<category name="${esc(key)}" id="${id}" colour="${colour}" secondaryColour="${secondary}"${extra}>${body}</category>`;

function toolbox(target, stage) {
  const isStage = !!target.isStage, tid = target.id;
  const x = Math.round(target.x || 0), y = Math.round(target.y || 0);
  const costume = target.costumes[target.currentCostume] || target.costumes[0];
  const backdrop = stage.costumes[stage.currentCostume] || stage.costumes[0];
  const sound = target.sounds[0];
  const motion = isStage ? `<label text="${esc(T('MOTION_STAGE_SELECTED', 'Stage selected: no motion blocks'))}"></label>` : [
    blk('motion_movesteps', num('STEPS', 10)), blk('motion_turnright', num('DEGREES', 15)), blk('motion_turnleft', num('DEGREES', 15)), sep,
    blk('motion_goto', menu('TO', 'motion_goto_menu')), blk('motion_gotoxy', num('X', x) + num('Y', y)),
    blk('motion_glideto', num('SECS', 1) + menu('TO', 'motion_glideto_menu')), blk('motion_glidesecstoxy', num('SECS', 1) + num('X', x) + num('Y', y)), sep,
    blk('motion_pointindirection', num('DIRECTION', 90, 'math_angle')), blk('motion_pointtowards', menu('TOWARDS', 'motion_pointtowards_menu')), sep,
    blk('motion_changexby', num('DX', 10)), blk('motion_setx', num('X', x)), blk('motion_changeyby', num('DY', 10)), blk('motion_sety', num('Y', y)), sep,
    blk('motion_ifonedgebounce'), sep, blk('motion_setrotationstyle'), sep,
    blk('motion_xposition', '', tid + '_xposition'), blk('motion_yposition', '', tid + '_yposition'), blk('motion_direction', '', tid + '_direction'),
  ].join('');
  const looks = [
    isStage ? '' : [blk('looks_sayforsecs', txt('MESSAGE', T('LOOKS_HELLO', 'Hello!')) + num('SECS', 2)), blk('looks_say', txt('MESSAGE', T('LOOKS_HELLO', 'Hello!'))),
      blk('looks_thinkforsecs', txt('MESSAGE', T('LOOKS_HMM', 'Hmm...')) + num('SECS', 2)), blk('looks_think', txt('MESSAGE', T('LOOKS_HMM', 'Hmm...'))), sep].join(''),
    isStage ? '' : blk('looks_switchcostumeto', menu('COSTUME', 'looks_costume', 'COSTUME', costume ? costume.name : '')) + blk('looks_nextcostume'),
    blk('looks_switchbackdropto', menu('BACKDROP', 'looks_backdrops', 'BACKDROP', backdrop ? backdrop.name : '')),
    isStage ? blk('looks_switchbackdroptoandwait', menu('BACKDROP', 'looks_backdrops', 'BACKDROP', backdrop ? backdrop.name : '')) : '',
    blk('looks_nextbackdrop'), sep,
    isStage ? '' : blk('looks_changesizeby', num('CHANGE', 10)) + blk('looks_setsizeto', num('SIZE', 100)) + sep,
    blk('looks_changeeffectby', num('CHANGE', 25)), blk('looks_seteffectto', num('VALUE', 0)), blk('looks_cleargraphiceffects'), sep,
    isStage ? '' : blk('looks_show') + blk('looks_hide') + sep + blk('looks_gotofrontback') + blk('looks_goforwardbackwardlayers', num('NUM', 1, 'math_integer')) + sep,
    isStage ? '' : blk('looks_costumenumbername', '', tid + '_costumenumbername'),
    blk('looks_backdropnumbername', '', 'backdropnumbername'),
    isStage ? '' : blk('looks_size', '', tid + '_size'),
  ].join('');
  const sound_ = [
    blk('sound_playuntildone', menu('SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', sound ? sound.name : '')),
    blk('sound_play', menu('SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', sound ? sound.name : '')), blk('sound_stopallsounds'), sep,
    blk('sound_changeeffectby', num('VALUE', 10)), blk('sound_seteffectto', num('VALUE', 100)), blk('sound_cleareffects'), sep,
    blk('sound_changevolumeby', num('VOLUME', -10)), blk('sound_setvolumeto', num('VOLUME', 100)), blk('sound_volume', '', tid + '_volume'),
  ].join('');
  const events = [
    blk('event_whenflagclicked'), blk('event_whenkeypressed'),
    isStage ? blk('event_whenstageclicked') : blk('event_whenthisspriteclicked'),
    blk('event_whenbackdropswitchesto'), sep, blk('event_whengreaterthan', num('VALUE', 10)), sep,
    blk('event_whenbroadcastreceived'), blk('event_broadcast', menu('BROADCAST_INPUT', 'event_broadcast_menu')),
    blk('event_broadcastandwait', menu('BROADCAST_INPUT', 'event_broadcast_menu')),
  ].join('');
  const control = [
    blk('control_wait', num('DURATION', 1, 'math_positive_number')), sep,
    blk('control_repeat', num('TIMES', 10, 'math_whole_number')), blk('control_forever'), sep,
    blk('control_if'), blk('control_if_else'), blk('control_wait_until'), blk('control_repeat_until'), sep, blk('control_stop'), sep,
    isStage ? blk('control_create_clone_of', menu('CLONE_OPTION', 'control_create_clone_of_menu'))
      : blk('control_start_as_clone') + blk('control_create_clone_of', menu('CLONE_OPTION', 'control_create_clone_of_menu')) + blk('control_delete_this_clone'),
  ].join('');
  const sensing = [
    isStage ? '' : [blk('sensing_touchingobject', menu('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu')), blk('sensing_touchingcolor', col('COLOR')),
      blk('sensing_coloristouchingcolor', col('COLOR') + col('COLOR2')), blk('sensing_distanceto', menu('DISTANCETOMENU', 'sensing_distancetomenu')), sep].join(''),
    blk('sensing_askandwait', txt('QUESTION', T('SENSING_ASK_TEXT', "What's your name?"))), blk('sensing_answer', '', 'answer'), sep,
    blk('sensing_keypressed', menu('KEY_OPTION', 'sensing_keyoptions')), blk('sensing_mousedown'), blk('sensing_mousex'), blk('sensing_mousey'),
    isStage ? '' : blk('sensing_setdragmode'), sep,
    blk('sensing_loudness', '', 'loudness'), sep, blk('sensing_timer', '', 'timer'), blk('sensing_resettimer'), sep,
    blk('sensing_of', menu('OBJECT', 'sensing_of_object_menu')), sep, blk('sensing_current'), blk('sensing_dayssince2000'), sep, blk('sensing_username', '', 'username'),
  ].join('');
  const ops = [
    blk('operator_add', num('NUM1', '') + num('NUM2', '')), blk('operator_subtract', num('NUM1', '') + num('NUM2', '')),
    blk('operator_multiply', num('NUM1', '') + num('NUM2', '')), blk('operator_divide', num('NUM1', '') + num('NUM2', '')), sep,
    blk('operator_random', num('FROM', 1) + num('TO', 10)), sep,
    blk('operator_gt', txt('OPERAND1', '') + txt('OPERAND2', '50')), blk('operator_lt', txt('OPERAND1', '') + txt('OPERAND2', '50')),
    blk('operator_equals', txt('OPERAND1', '') + txt('OPERAND2', '50')), sep,
    blk('operator_and'), blk('operator_or'), blk('operator_not'), sep,
    blk('operator_join', txt('STRING1', T('OPERATORS_JOIN_APPLE', 'apple') + ' ') + txt('STRING2', T('OPERATORS_JOIN_BANANA', 'banana'))),
    blk('operator_letter_of', num('LETTER', 1, 'math_whole_number') + txt('STRING', T('OPERATORS_JOIN_APPLE', 'apple'))),
    blk('operator_length', txt('STRING', T('OPERATORS_JOIN_APPLE', 'apple'))),
    blk('operator_contains', txt('STRING1', T('OPERATORS_JOIN_APPLE', 'apple')) + txt('STRING2', T('OPERATORS_LETTEROF_APPLE', 'a'))), sep,
    blk('operator_mod', num('NUM1', '') + num('NUM2', '')), blk('operator_round', num('NUM', '')), sep, blk('operator_mathop', num('NUM', '')),
  ].join('');
  const pen = [blk('pen_clear'), sep, blk('pen_stamp'), sep, blk('pen_penDown'), blk('pen_penUp'), sep,
    blk('pen_setPenColorToColor', col('COLOR')), blk('pen_changePenColorParamBy', menu('COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'color') + num('VALUE', 10)),
    blk('pen_setPenColorParamTo', menu('COLOR_PARAM', 'pen_menu_colorParam', 'colorParam', 'color') + num('VALUE', 50)), sep,
    blk('pen_changePenSizeBy', num('SIZE', 1)), blk('pen_setPenSizeTo', num('SIZE', 1))].join('');
  const music = [blk('music_playDrumForBeats', menu('DRUM', 'music_menu_DRUM', 'DRUM', '1') + num('BEATS', 0.25)), blk('music_restForBeats', num('BEATS', 0.25)),
    blk('music_playNoteForBeats', `<value name="NOTE"><shadow type="note"><field name="NOTE">60</field></shadow></value>` + num('BEATS', 0.25)),
    blk('music_setInstrument', menu('INSTRUMENT', 'music_menu_INSTRUMENT', 'INSTRUMENT', '1')), blk('music_setTempo', num('TEMPO', 60)),
    blk('music_changeTempo', num('TEMPO', 20)), blk('music_getTempo', '', 'music_getTempo')].join('');
  const tts = [blk('text2speech_speakAndWait', txt('WORDS', 'hej')), blk('text2speech_setVoice', menu('VOICE', 'text2speech_menu_voices', 'voices', 'ALTO')),
    blk('text2speech_setLanguage', menu('LANGUAGE', 'text2speech_menu_languages', 'languages', 'sv-SE'))].join('');
  const ai = [blk('ai_ask', txt('TEXT', 'hej')), blk('ai_teach', txt('QUESTION', 'vad heter du') + txt('ANSWER', 'Jag heter Robban!')),
    blk('ai_read', txt('TEXT', 'Solen är en stjärna.')), sep,
    blk('ai_choose', txt('OPTIONS', 'sten sax påse') + txt('STATE', 'start')), blk('ai_reward', num('REWARD', 1)), blk('ai_newround'), sep,
    blk('ai_set_curiosity', num('VALUE', 20)), blk('ai_curiosity', '', 'ai_curiosity'), blk('ai_states', '', 'ai_states'), blk('ai_forget'), sep,
    blk('ai_name', '', 'ai_name'), blk('ai_smart', '', 'ai_smart')].join('');
  const chess = [blk('chess_new'), blk('chess_move', txt('FROM', 'e2') + txt('TO', 'e4')), blk('chess_legal', txt('FROM', 'e2') + txt('TO', 'e4')),
    blk('chess_ai_move', num('DEPTH', 2)), blk('chess_undo'), sep,
    blk('chess_piece', txt('SQUARE', 'e1')), blk('chess_moves_from', txt('SQUARE', 'e2')), blk('chess_turn', '', 'chess_turn'),
    blk('chess_status', '', 'chess_status'), blk('chess_over'), blk('chess_last', '', 'chess_last'), sep,
    blk('chess_square_at', `<value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow><block type="sensing_mousex"/></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow><block type="sensing_mousey"/></value>`),
    blk('chess_square_x', txt('SQUARE', 'e4')), blk('chess_square_y', txt('SQUARE', 'e4')), blk('chess_games', '', 'chess_games')].join('');
  const ext = k => ` iconURI="${EXT[k].icon}"`;
  return '<xml style="display:none">' + [
    cat(T('CATEGORY_MOTION', 'Motion'), 'motion', '#4C97FF', '#3373CC', motion),
    cat(T('CATEGORY_LOOKS', 'Looks'), 'looks', '#9966FF', '#774DCB', looks),
    cat(T('CATEGORY_SOUND', 'Sound'), 'sound', '#D65CD6', '#BD42BD', sound_),
    cat(T('CATEGORY_EVENTS', 'Events'), 'events', '#FFD500', '#CC9900', events),
    cat(T('CATEGORY_CONTROL', 'Control'), 'control', '#FFAB19', '#CF8B17', control),
    cat(T('CATEGORY_SENSING', 'Sensing'), 'sensing', '#4CBFE6', '#2E8EB8', sensing),
    cat(T('CATEGORY_OPERATORS', 'Operators'), 'operators', '#40BF4A', '#389438', ops),
    cat(T('CATEGORY_VARIABLES', 'Variables'), 'variables', '#FF8C1A', '#DB6E00', '', ' custom="VARIABLE"'),
    cat(T('CATEGORY_MYBLOCKS', 'My Blocks'), 'myBlocks', '#FF6680', '#FF4D6A', '', ' custom="PROCEDURE"'),
    cat(EXT.ai.name, 'ai', EXT.ai.c[0], EXT.ai.c[2], ai, ext('ai')),
    cat(EXT.chess.name, 'chess', EXT.chess.c[0], EXT.chess.c[2], chess, ext('chess')),
    cat(EXT.pen.name, 'pen', EXT.pen.c[0], EXT.pen.c[2], pen, ext('pen')),
    cat(EXT.music.name, 'music', EXT.music.c[0], EXT.music.c[2], music, ext('music')),
    cat(EXT.tts.name, 'tts', EXT.tts.c[0], EXT.tts.c[2], tts, ext('tts')),
  ].join('') + '</xml>';
}
RB.toolbox = toolbox;
})();
