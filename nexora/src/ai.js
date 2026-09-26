/* Nexora AI layer: maps the five Nexora models onto a provider.
 *
 *   local     – Nexora Local, the offline generator in localgen.js (no key needed)
 *   anthropic – Claude via the Messages API, called straight from the app with the user's own key
 *   openai    – any OpenAI-compatible endpoint, e.g. the model trained in the Colab notebook
 *               and served with vLLM/Ollama, or a hosted GPT model
 *
 * The app is a single offline HTML file with no bundler, so it talks to the APIs
 * with fetch() and parses the server-sent event stream itself. */
(function () {
  'use strict';

  const MODELS = {
    flash: { name: 'Nexora Flash 1', short: 'Flash 1', tag: 'Snabb', kind: 'text', minTier: 0, desc: 'Snabbast. Bra för prototyper och små spel på några sekunder.' },
    pro: { name: 'Nexora Pro 1', short: 'Pro 1', tag: 'Långsam men bra resultat', kind: 'text', minTier: 1, desc: 'Tar längre tid men skriver större, mer polerade spel med fler mekaniker.' },
    core: { name: 'Nexora Core 1', short: 'Core 1', tag: 'Pro, men tänker', kind: 'text', minTier: 2, desc: 'Ingen bryr sig om den – men den planerar spelet steg för steg innan den skriver en rad kod. Du ser tankarna live.' },
    image: { name: 'Nexora Image 1', short: 'Image 1', tag: 'Bildmodell', kind: 'image', minTier: 1, desc: 'Sprites, bakgrunder och ikoner till dina spel.' },
    d3: { name: 'Nexora 3D 1', short: '3D 1', tag: '3D-generator', kind: 'mesh', minTier: 1, desc: 'Low-poly 3D-modeller som du kan rotera och exportera som .obj.' },
    astryx: { name: 'Nexora Astryx 5 Pro', short: 'Astryx 5 Pro', tag: 'AI-agent', kind: 'agent', minTier: 0, agent: true,
      desc: 'Vår första AI-agent. Den planerar, skriver spelet, testkör det, tittar på resultatet, hittar buggar och rättar dem – helt själv – tills spelet fungerar. På datorn bygger den riktiga Godot-spel med Python i upp till två timmar, och i hyperrealistiskt läge av fotoskannade modeller.' },
  };
  // Staged rollout of Astryx 5 Pro: plan index → first day it is available (local date, YYYY-MM-DD).
  const ROLLOUT = { astryx: ['2026-11-14', '2026-11-14', '2026-10-07', '2026-09-26', '2026-09-26'] };

  // What each Nexora model runs on with the Anthropic provider.
  const ANTHROPIC = {
    flash: { model: 'claude-haiku-4-5', max_tokens: 16000 },
    pro: { model: 'claude-opus-5', max_tokens: 64000, output_config: { effort: 'medium' }, fallbacks: true },
    core: { model: 'claude-opus-5', max_tokens: 64000, thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'xhigh' }, fallbacks: true },
    image: { model: 'claude-opus-5', max_tokens: 32000, output_config: { effort: 'medium' }, fallbacks: true },
    d3: { model: 'claude-opus-5', max_tokens: 32000, output_config: { effort: 'medium' }, fallbacks: true },
    astryx: { model: 'claude-opus-5', max_tokens: 64000, thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'high' }, fallbacks: true },
    astryxGodot: { model: 'claude-opus-5', max_tokens: 64000, thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'xhigh' }, fallbacks: true },
  };

  const DEFAULT_SETTINGS = {
    provider: 'local',
    anthropicKey: '',
    openaiBase: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiModels: { flash: 'gpt-5-fast', pro: 'gpt-6-astra', core: 'gpt-6-astra', image: 'gpt-images-2.5', d3: 'gpt-6-astra', astryx: 'gpt-6-astra' },
    openaiImageApi: true,
  };

  const GAME_SYSTEM = [
    'You are Nexora, an AI game studio. You write complete, polished, playable browser games.',
    'Output exactly one HTML document inside a single ```html fenced block and nothing after it.',
    'Hard requirements:',
    '- Everything inline in that one file: no external scripts, fonts, images, CDNs or network requests. Draw graphics with canvas or inline SVG; make sound with the Web Audio API.',
    '- It runs inside a sandboxed iframe: wrap any localStorage access in try/catch.',
    '- Full-window responsive canvas that handles resize and devicePixelRatio.',
    '- Keyboard controls (arrows/WASD + Space) AND on-screen touch buttons on touch devices.',
    '- A title screen with the game name and how to play, a score/HUD, a game-over or win screen, and restart.',
    '- A steady requestAnimationFrame loop with delta time; no runaway memory growth.',
    '- All player-facing text in Swedish.',
    'Make it genuinely fun: juice (particles, screen shake, sound), a difficulty curve, and a clear goal.',
  ].join('\n');

  const FEATURE_TEXT = {
    threeD: '3D: render in real-time 3D with WebGL or your own canvas projection written from scratch (no libraries).',
    story: 'Story: include a short narrative intro and an ending that pays it off.',
    dialog: 'Dialogue: characters speak in dialogue boxes the player advances with Space/tap.',
    openworld: 'Open world: a large procedurally generated world with a camera that follows the player and a minimap.',
    npc: 'NPCs: several named NPCs with distinct personalities and schedules or behaviours.',
    quest: 'Quests: a quest log with at least three quests, tracked progress and rewards.',
    music: 'Music: a procedural background soundtrack with Web Audio, toggled with M.',
    sfx: 'Sound effects for every important action.',
    multiplayer: 'Multiplayer: local 2-player on one keyboard (P1 WASD+F, P2 arrows+Enter) with split scores.',
    assets: 'Use these user-supplied SVG assets where they fit (embed them as data URIs):',
  };

  function gamePrompt(prompt, opts) {
    const lines = ['Game idea: ' + prompt, '', 'Dimension: ' + (opts.dim === '3d' ? '3D' : '2D') + '.'];
    for (const k of opts.features || []) if (FEATURE_TEXT[k] && k !== 'assets') lines.push(FEATURE_TEXT[k]);
    if (opts.assets && opts.assets.length) {
      lines.push(FEATURE_TEXT.assets);
      opts.assets.slice(0, 6).forEach(a => lines.push('- ' + a.name + ': ' + a.svg.slice(0, 6000)));
    }
    return lines.join('\n');
  }

  function extractHtml(text) {
    const m = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*(<!doctype[\s\S]*?)```/i);
    if (m) return m[1].trim();
    const i = text.search(/<!doctype html|<html/i);
    if (i >= 0) return text.slice(i).replace(/```\s*$/, '').trim();
    return null;
  }
  function extractJson(text) {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const s = m ? m[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(s);
  }
  function extractSvg(text) {
    const i = text.search(/<svg[\s>]/i), j = text.lastIndexOf('</svg>');
    return i >= 0 && j > i ? text.slice(i, j + 6) : null;
  }

  async function readSSE(res, onEvent, signal) {
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      if (signal && signal.aborted) { reader.cancel(); throw new DOMException('Avbruten', 'AbortError'); }
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const data = chunk.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
        if (!data || data === '[DONE]') continue;
        try { onEvent(JSON.parse(data)); } catch (e) { if (e && e.nexora) throw e; }
      }
    }
  }

  function apiError(msg) { const e = new Error(msg); e.nexora = true; return e; }

  async function httpError(res) {
    let detail = '';
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error.type)) || JSON.stringify(j); } catch (e) { detail = res.statusText; }
    if (res.status === 401) return apiError('Ogiltig API-nyckel (401). Kontrollera nyckeln under Inställningar.');
    if (res.status === 429) return apiError('För många förfrågningar just nu (429). Vänta en stund och försök igen.');
    if (res.status === 529 || res.status >= 500) return apiError('AI-tjänsten är överbelastad (' + res.status + '). Försök igen om en stund.');
    return apiError('API-fel ' + res.status + ': ' + detail);
  }

  // Claude Messages API, streamed.
  async function anthropic(settings, modelKey, system, user, cb, signal) {
    const spec = ANTHROPIC[modelKey];
    const body = { model: spec.model, max_tokens: spec.max_tokens, stream: true, system, messages: [{ role: 'user', content: user }] };
    if (spec.thinking) body.thinking = spec.thinking;
    if (spec.output_config) body.output_config = spec.output_config;
    const headers = {
      'content-type': 'application/json',
      'x-api-key': settings.anthropicKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (spec.fallbacks) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw await httpError(res);
    let text = '', stop = null;
    await readSSE(res, ev => {
      if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta') { text += ev.delta.text; cb.text && cb.text(ev.delta.text, text); }
        else if (ev.delta.type === 'thinking_delta') cb.thinking && cb.thinking(ev.delta.thinking);
      } else if (ev.type === 'message_delta' && ev.delta) stop = ev.delta.stop_reason || stop;
      else if (ev.type === 'error') throw apiError('AI-fel: ' + ((ev.error && ev.error.message) || 'okänt'));
    }, signal);
    if (stop === 'refusal') throw apiError('Modellen avböjde den här förfrågan. Försök formulera spelidén annorlunda.');
    if (stop === 'max_tokens' && !text) throw apiError('Svaret blev för långt och klipptes av. Be om ett mindre spel.');
    return { text, stop, model: spec.model };
  }

  // Any OpenAI-compatible /chat/completions endpoint, streamed.
  async function openai(settings, modelKey, system, user, cb, signal) {
    const model = settings.openaiModels[modelKey];
    const res = await fetch(settings.openaiBase.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST', signal,
      headers: Object.assign({ 'content-type': 'application/json' }, settings.openaiKey ? { authorization: 'Bearer ' + settings.openaiKey } : {}),
      body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw await httpError(res);
    let text = '', stop = null;
    await readSSE(res, ev => {
      const c = ev.choices && ev.choices[0];
      if (!c) return;
      const d = c.delta || {};
      if (d.reasoning_content && cb.thinking) cb.thinking(d.reasoning_content);
      if (d.content) { text += d.content; cb.text && cb.text(d.content, text); }
      if (c.finish_reason) stop = c.finish_reason;
    }, signal);
    return { text, stop, model };
  }

  async function openaiImage(settings, prompt, signal) {
    const res = await fetch(settings.openaiBase.replace(/\/$/, '') + '/images/generations', {
      method: 'POST', signal,
      headers: Object.assign({ 'content-type': 'application/json' }, settings.openaiKey ? { authorization: 'Bearer ' + settings.openaiKey } : {}),
      body: JSON.stringify({ model: settings.openaiModels.image, prompt, size: '1024x1024', n: 1 }),
    });
    if (!res.ok) throw await httpError(res);
    const j = await res.json(), d = j.data && j.data[0];
    if (!d) throw apiError('Bild-API:t returnerade ingen bild.');
    return d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url;
  }

  function complete(settings, modelKey, system, user, cb, signal) {
    if (settings.provider === 'anthropic') {
      if (!settings.anthropicKey) throw apiError('Lägg in din Anthropic API-nyckel under Inställningar, eller välj Nexora Local.');
      return anthropic(settings, modelKey, system, user, cb || {}, signal);
    }
    if (settings.provider === 'openai') return openai(settings, modelKey, system, user, cb || {}, signal);
    throw apiError('Ingen AI-leverantör vald.');
  }

  async function generateGame(settings, modelKey, prompt, opts, cb, signal) {
    const r = await complete(settings, modelKey, GAME_SYSTEM, gamePrompt(prompt, opts), cb, signal);
    const html = extractHtml(r.text);
    if (!html) throw apiError('Modellen returnerade ingen HTML. Försök igen.');
    return { html, model: r.model, stop: r.stop };
  }

  async function fixGame(settings, modelKey, html, errors, cb, signal) {
    const sys = GAME_SYSTEM + '\nYou are now fixing bugs in an existing game. Keep everything that works; change only what is needed.';
    const user = 'These errors were captured while running the game:\n' + (errors.length ? errors.join('\n') : '(no runtime errors captured – review the code for logic bugs, broken controls or missing restart)') + '\n\nThe game:\n```html\n' + html + '\n```';
    const r = await complete(settings, modelKey, sys, user, cb, signal);
    const out = extractHtml(r.text);
    if (!out) throw apiError('Buggfix-AI:n returnerade ingen HTML.');
    return out;
  }

  const TEXT_TASKS = {
    story: 'Write a game story (premise, three acts, ending) in Swedish, as Markdown, max 250 words.',
    npc: 'Create 4 NPCs for this game in Swedish. For each: name, role, personality, what they want, a signature line. Markdown list.',
    quest: 'Design 3 quests for this game in Swedish. For each: title, quest giver, goal, steps, reward. Markdown.',
    dialog: 'Write a short dialogue scene (6-10 lines) between two characters in this game, in Swedish, formatted "Namn: replik".',
  };
  async function text(settings, modelKey, task, prompt, cb, signal) {
    const r = await complete(settings, modelKey, 'You are Nexora, a creative writing assistant for game developers. Answer only with the requested content.', TEXT_TASKS[task] + '\n\nGame: ' + prompt, cb, signal);
    return r.text.trim();
  }

  async function image(settings, prompt, cb, signal) {
    if (settings.provider === 'openai' && settings.openaiImageApi) return { url: await openaiImage(settings, prompt, signal) };
    const r = await complete(settings, 'image', 'You are Nexora Image 1, a game artist that draws with SVG code.',
      'Draw a game asset as a single self-contained SVG (viewBox 0 0 256 256, no external references, no text unless asked). Clean shapes, strong silhouette, game-ready. Return only the SVG.\n\nAsset: ' + prompt, cb, signal);
    const svg = extractSvg(r.text);
    if (!svg) throw apiError('Ingen SVG i svaret. Försök igen.');
    return { svg };
  }

  async function mesh(settings, prompt, cb, signal) {
    const r = await complete(settings, 'd3', 'You are Nexora 3D 1, a low-poly 3D modeller.',
      'Model this as a low-poly mesh (40-400 faces), ground at y=0, about 2 units tall, centred on x/z. ' +
      'Return only JSON: {"name": string, "vertices": [[x,y,z],...], "faces": [[i,j,k,...],...] (0-based, counter-clockwise seen from outside), "colors": ["#rrggbb" per face]}.\n\nModel: ' + prompt, cb, signal);
    const m = extractJson(r.text);
    if (!Array.isArray(m.vertices) || !Array.isArray(m.faces)) throw apiError('Ogiltig 3D-modell i svaret.');
    return m;
  }

  // ------------------------------------------------------------------ Astryx 5 Pro: the agent
  const AGENT_SYSTEM = GAME_SYSTEM + `

You are Nexora Astryx 5 Pro, an autonomous game-building agent. You do not answer with code in text; you work through tools:
1. write_game – write the complete game (one HTML document).
2. run_game – run it in a real browser. You get runtime errors, whether the canvas animates, and a screenshot after the game has been started and played with the keyboard.
3. Look hard at the result. Fix problems with edit_game (small exact replacements) or write_game (larger rewrites), then run_game again.
4. finish – only after a run with no errors where the screenshot shows the game working. Give a short summary in Swedish.
Always run the game at least once before finishing. Stay under about ten tool calls.`;

  const AGENT_TOOLS = [
    { name: 'write_game', eager_input_streaming: true,
      description: 'Write the complete game as one self-contained HTML document. Replaces the current game entirely.',
      input_schema: { type: 'object', properties: { title: { type: 'string', description: 'Game title in Swedish' }, html: { type: 'string', description: 'The full HTML document' } }, required: ['title', 'html'] } },
    { name: 'edit_game', eager_input_streaming: true,
      description: 'Replace one exact snippet in the current game. `find` must occur exactly once. Prefer this for small fixes.',
      input_schema: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, required: ['find', 'replace'] } },
    { name: 'run_game',
      description: 'Run the current game in a headless browser for about four seconds: presses Space to start, then arrow keys and WASD. Returns runtime errors, console errors, canvas activity and a screenshot.',
      input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'finish',
      description: 'Finish when the game is written, tested and working. The summary is shown to the player.',
      input_schema: { type: 'object', properties: { summary: { type: 'string', description: 'Two or three sentences in Swedish' } }, required: ['summary'] } },
  ];

  const isStr = v => typeof v === 'string';
  function validate(name, input) {
    if (!input || typeof input !== 'object') return 'input is not an object';
    if (name === 'write_game') return isStr(input.html) && input.html.length > 200 && isStr(input.title) ? null : 'write_game needs `title` and a complete `html` document';
    if (name === 'edit_game') return isStr(input.find) && input.find.length > 0 && isStr(input.replace) ? null : 'edit_game needs `find` and `replace` strings';
    if (name === 'finish') return isStr(input.summary) ? null : 'finish needs `summary`';
    if (name === 'run_game') return null;
    return 'unknown tool ' + name;
  }

  // One streamed Messages API turn, reassembled into content blocks we can send back unchanged.
  // conf (optional): { system, tools, spec, betas: [], extra: {} } – defaults to the HTML agent.
  async function agentTurn(settings, messages, hooks, signal, conf) {
    conf = conf || {};
    const spec = conf.spec || ANTHROPIC.astryx;
    const body = Object.assign({ model: spec.model, max_tokens: spec.max_tokens, stream: true, system: conf.system || AGENT_SYSTEM, tools: conf.tools || AGENT_TOOLS,
      thinking: spec.thinking, output_config: spec.output_config, cache_control: { type: 'ephemeral' }, fallbacks: 'default', messages }, conf.extra || {});
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal, body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-api-key': settings.anthropicKey, 'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', 'anthropic-beta': ['server-side-fallback-2026-07-01'].concat(conf.betas || []).join(',') },
    });
    if (!res.ok) throw await httpError(res);
    const blocks = [];
    let stop = null;
    await readSSE(res, ev => {
      if (ev.type === 'content_block_start') {
        const b = Object.assign({}, ev.content_block);
        if (b.type === 'tool_use') { b._json = ''; hooks.step && hooks.step('tool_start', b.name); }
        blocks[ev.index] = b;
      } else if (ev.type === 'content_block_delta') {
        const b = blocks[ev.index], d = ev.delta;
        if (!b) return;
        if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; hooks.text && hooks.text(d.text); }
        else if (d.type === 'thinking_delta') { b.thinking = (b.thinking || '') + d.thinking; hooks.thinking && hooks.thinking(d.thinking); }
        else if (d.type === 'signature_delta') b.signature = (b.signature || '') + d.signature;
        else if (d.type === 'input_json_delta') { b._json += d.partial_json; hooks.progress && hooks.progress(b.name, b._json.length); }
      } else if (ev.type === 'content_block_stop') {
        const b = blocks[ev.index];
        if (b && b.type === 'tool_use') {
          try { b.input = b._json ? JSON.parse(b._json) : {}; b._bad = null; } catch (e) { b.input = {}; b._bad = b._json; }
        }
      } else if (ev.type === 'message_delta' && ev.delta) stop = ev.delta.stop_reason || stop;
      else if (ev.type === 'error') throw apiError('AI-fel: ' + ((ev.error && ev.error.message) || 'okänt'));
    }, signal);
    if (stop === 'refusal') throw apiError('Astryx avböjde den här förfrågan. Försök formulera spelidén annorlunda.');
    if (stop === 'max_tokens') throw apiError('Astryx svar blev för långt och klipptes av. Be om ett mindre spel.');
    // After a mid-output fallback only text before the last `fallback` marker is echoed (and nothing there is run).
    let cut = -1;
    blocks.forEach((b, i) => { if (b && b.type === 'fallback') cut = i; });
    const content = [], calls = [];
    blocks.forEach((b, i) => {
      if (!b || b.type === 'fallback') return;
      if (i < cut && b.type !== 'text') return;
      if (b.type === 'tool_use') { content.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input }); calls.push(b); }
      else if (b.type === 'text') { if (b.text) content.push({ type: 'text', text: b.text }); }
      else if (b.type === 'thinking') content.push({ type: 'thinking', thinking: b.thinking || '', signature: b.signature || '' });
      else content.push(b);
    });
    return { content, calls, stop };
  }

  // hooks: { runGame(html) → {errors, frames, colors, animating, image}, step(kind, detail), thinking(t), progress(tool, chars) }
  async function agent(settings, prompt, opts, hooks, signal) {
    const state = { html: null, title: null, summary: null, runs: 0, turns: 0 };
    if (settings.provider !== 'anthropic') return agentPipeline(settings, prompt, opts, hooks, signal, state);
    if (!settings.anthropicKey) throw apiError('Lägg in din Anthropic API-nyckel under Inställningar, eller välj Nexora Local.');
    const messages = [{ role: 'user', content: gamePrompt(prompt, opts) }];
    for (state.turns = 1; state.turns <= 14; state.turns++) {
      const turn = await agentTurn(settings, messages, hooks, signal);
      messages.push({ role: 'assistant', content: turn.content });
      if (!turn.calls.length) break;
      const results = [];
      let done = false;
      for (const c of turn.calls) {
        const r = { type: 'tool_result', tool_use_id: c.id };
        const bad = c._bad != null ? JSON.stringify({ INVALID_JSON: c._bad.slice(0, 2000) }) : validate(c.name, c.input);
        if (bad) { r.is_error = true; r.content = bad; results.push(r); continue; }
        const inp = c.input;
        if (c.name === 'write_game') {
          state.html = inp.html; state.title = inp.title;
          hooks.step && hooks.step('write', Math.round(inp.html.length / 1000) + ' kB');
          r.content = 'Saved (' + inp.html.length + ' chars). Run it with run_game.';
        } else if (c.name === 'edit_game') {
          const n = state.html ? state.html.split(inp.find).length - 1 : 0;
          if (n !== 1) { r.is_error = true; r.content = state.html ? '`find` occurs ' + n + ' times; it must occur exactly once.' : 'There is no game yet; use write_game.'; }
          else { state.html = state.html.replace(inp.find, () => inp.replace); r.content = 'Edited.'; hooks.step && hooks.step('edit', inp.find.slice(0, 60)); }
        } else if (c.name === 'run_game') {
          if (!state.html) { r.is_error = true; r.content = 'There is no game yet; use write_game first.'; }
          else {
            hooks.step && hooks.step('run');
            const t = await hooks.runGame(state.html);
            state.runs++;
            hooks.step && hooks.step('ran', t.errors.length ? t.errors.length + ' fel' : 'inga fel');
            r.content = [{ type: 'text', text: JSON.stringify({ errors: t.errors, canvas_colours: t.colors, animating: t.animating, frames_rendered: t.frames }) }];
            if (t.image) r.content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: t.image } });
          }
        } else if (c.name === 'finish') {
          if (!state.runs) { r.is_error = true; r.content = 'Run the game with run_game before finishing.'; }
          else { state.summary = inp.summary; r.content = 'Done.'; done = true; }
        }
        results.push(r);
      }
      messages.push({ role: 'user', content: results });
      if (done) break;
    }
    if (!state.html) throw apiError('Astryx hann inte skriva något spel. Försök igen.');
    return { html: state.html, title: state.title, summary: state.summary || 'Astryx byggde och testade spelet.', turns: state.turns, runs: state.runs, model: ANTHROPIC.astryx.model };
  }

  // The same plan → write → test → fix loop for endpoints without tool calling.
  async function agentPipeline(settings, prompt, opts, hooks, signal, state) {
    hooks.step && hooks.step('tool_start', 'write_game');
    const g = await generateGame(settings, 'astryx', prompt, opts, { thinking: hooks.thinking, text: (d, all) => hooks.progress && hooks.progress('write_game', all.length) }, signal);
    state.html = g.html; hooks.step && hooks.step('write', Math.round(g.html.length / 1000) + ' kB');
    for (let i = 0; i < 3; i++) {
      hooks.step && hooks.step('run');
      const t = await hooks.runGame(state.html); state.runs++;
      hooks.step && hooks.step('ran', t.errors.length ? t.errors.length + ' fel' : 'inga fel');
      if (!t.errors.length && t.animating) break;
      if (i === 2) break;
      hooks.step && hooks.step('edit', 'rättar ' + (t.errors.length ? t.errors.length + ' fel' : 'stillastående spel'));
      state.html = await fixGame(settings, 'astryx', state.html, t.errors.length ? t.errors : ['The canvas did not change after pressing Space and arrow keys – the game may not start or render.'], { thinking: hooks.thinking }, signal);
    }
    const tm = state.html.match(/<title>([^<]{1,80})<\/title>/i);
    return { html: state.html, title: tm ? tm[1].trim() : null, summary: 'Astryx skrev spelet, testkörde det ' + state.runs + ' gång' + (state.runs > 1 ? 'er' : '') + ' och rättade det som behövdes.', turns: state.runs, runs: state.runs, model: settings.openaiModels.astryx };
  }

  // ------------------------------------------------------------------ Astryx 5 Pro, Godot mode
  // Everything Astryx knows about Godot beyond the base model lives here and in the
  // lessons it saves after each run (see save_lesson) – that is how it is trained.
  const GODOT_GUIDE = `You are Nexora Astryx 5 Pro in Godot mode: an autonomous game studio of one. You build a complete, polished game in Godot 4.7 (GDScript 2) inside a project folder on the user's computer, working for as long as the time budget allows (often an hour or more). Quality matters more than speed.

# How you work
- Python is your hands: run_python executes a Python 3 script with the project folder as working directory. Use it to write project.godot, scenes, GDScript, generated levels and data. write_file is fine for single files.
- godot_run is your eyes: it imports the project, runs the main scene for ~9 s of game time while pressing every InputMap action, and returns errors plus three screenshots. Look at them critically, like a player would.
- Loop: design → build the smallest playable core → godot_run → fix → add one feature → godot_run → … → polish → final godot_run → save_lesson (new pitfalls only) → finish.
- Start with a short design.md (goal, controls, loop, win/lose, art direction, feature list). Tick features off as you go.
- Never finish with errors in the last godot_run or with screenshots that show a blank or broken screen.

# Project rules
- project.godot: config_version=5; [application] config/name, run/main_scene="res://main.tscn", config/features=PackedStringArray("4.7", "Forward Plus"); [display] window/size/viewport_width=1280, viewport_height=720.
- Keep .tscn files tiny (a root node + script). Build the rest in code – hand-written .tscn is the #1 source of load errors. If you write one: [gd_scene load_steps=N format=3], ext_resource ids are strings, load_steps = resources + 1.
- Define input in code at startup (InputMap.add_action / action_add_event with InputEventKey.physical_keycode = KEY_W …). The tester presses every action in InputMap, so every action must do something sensible.
- The game must start playing within ~2 s or on any action (no mouse-only menus). Restart with get_tree().reload_current_scene().
- Never touch _nexora/ (Nexora's test probe) and don't delete project files you did not create.

# GDScript 2 / Godot 4 (the classic mistakes)
- Tabs for indentation, never mixed with spaces. Typed code: var speed := 5.0, func f(x: int) -> void.
- @export, @onready, @tool; signals: button.pressed.connect(_on_pressed); await get_tree().create_timer(1.0).timeout (no yield).
- Renamed APIs: Spatial→Node3D, KinematicBody→CharacterBody3D (velocity property, move_and_slide() without args, is_on_floor() after it), instance()→instantiate(), rand_range→randf_range, deg2rad→deg_to_rad, OS.get_ticks_msec→Time.get_ticks_msec, change_scene→change_scene_to_file, PoolStringArray→PackedStringArray, Engine.editor_hint→Engine.is_editor_hint(), get_world()→get_world_3d(), translation→position.
- := cannot infer from a Variant (e.g. a Dictionary value) – write var x: float = d.value.
- Colors: Color("#rrggbb"); vectors are value types; Array[Node3D] typed arrays.
- UI: CanvasLayer → Control/Label; font size via add_theme_font_size_override("font_size", 28).
- Sound without files: AudioStreamGenerator + push_frame, or build an AudioStreamWAV from a PackedByteArray.
- Many identical objects: MultiMeshInstance3D. Physics: StaticBody3D/CharacterBody3D/Area3D + CollisionShape3D with a Shape3D resource.`;

  const HYPERREAL_GUIDE = `

# Hyperrealistic mode
The user paid for photorealism. Build the world from real photoscanned CC0 assets from Poly Haven:
- search_assets (English keywords, several searches: hero props, nature, architecture) → download_asset. type models → glTF (real-world scale in metres), hdris → .hdr sky, textures → PBR maps (albedo/normal/roughness/ao).
- Use 2k resolution by default, 4k only for the hero asset; 4–10 models, 1 HDRI, 1–3 ground/surface textures.
- Downloaded glTFs load as PackedScene after import: (load("res://assets/polyhaven/<id>/<file>.gltf") as PackedScene).instantiate(). Run godot_run once right after downloading so everything is imported.
- Scatter vegetation/rocks with MultiMeshInstance3D using a mesh taken from the glTF (find_children("*", "MeshInstance3D")[0].mesh); vary scale and rotation; add collisions only where the player can reach.
- WorldEnvironment: PanoramaSkyMaterial with the HDRI, background BG_SKY, ambient + reflections from sky, tonemap_mode = TONE_MAPPER_AGX, sdfgi_enabled, ssao_enabled, ssil_enabled, ssr_enabled, glow_enabled, volumetric_fog_enabled (low density). DirectionalLight3D matching the HDRI sun, shadows on, directional_shadow_max_distance ~120.
- Materials: StandardMaterial3D with albedo_texture, normal_enabled + normal_texture, roughness_texture, ao; uv1_scale or uv1_triplanar for large surfaces.
- project.godot [rendering]: anti_aliasing/quality/msaa_3d=2 and anti_aliasing/quality/use_taa=true. Camera: CameraAttributesPractical, subtle DOF.
- Keep the gameplay first: realism must not make the game unplayable or slow. Credits for every asset are written to assets/polyhaven/CREDITS.md automatically.`;

  const GODOT_TOOLS = [
    { name: 'run_python', eager_input_streaming: true,
      description: 'Run a Python 3 script (standard library only) with the project folder as working directory. Use it to create or change project files. No network, no subprocesses, no files outside the project. Returns exit code, stdout and stderr.',
      input_schema: { type: 'object', properties: { purpose: { type: 'string', description: 'One short sentence in Swedish shown to the user' }, code: { type: 'string' } }, required: ['purpose', 'code'] } },
    { name: 'write_file', eager_input_streaming: true,
      description: 'Write one text file in the project (path relative to the project or res://...). Overwrites.',
      input_schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    { name: 'read_file', description: 'Read a text file from the project.',
      input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'list_files', description: 'List the project files with sizes.', input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'godot_run',
      description: 'Import the project and run the main scene for about 9 seconds of game time while pressing every InputMap action. Returns errors, whether the run completed, and up to three screenshots.',
      input_schema: { type: 'object', properties: {}, required: [] } },
    { name: 'search_assets', hyperreal: true,
      description: 'Search Poly Haven (CC0, photoscanned, hyperrealistic). type: models, hdris or textures. Query with English keywords. Returns ids, names, tags and polycounts.',
      input_schema: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string', enum: ['models', 'hdris', 'textures'] } }, required: ['query', 'type'] } },
    { name: 'download_asset', hyperreal: true,
      description: 'Download a Poly Haven asset into the project. Returns res:// paths (glTF for models, .hdr for hdris, map paths for textures).',
      input_schema: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string', enum: ['models', 'hdris', 'textures'] }, resolution: { type: 'string', enum: ['1k', '2k', '4k'] } }, required: ['id', 'type'] } },
    { name: 'save_lesson',
      description: 'Save one short, general lesson for future Astryx runs: a Godot/GDScript pitfall you actually hit and how to avoid it. Not project-specific. Use sparingly.',
      input_schema: { type: 'object', properties: { lesson: { type: 'string' } }, required: ['lesson'] } },
    { name: 'finish',
      description: 'Finish when the game is complete, the last godot_run had no errors and the screenshots look right. The summary (Swedish, 2–4 sentences) is shown to the player.',
      input_schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } },
  ];

  function godotValidate(name, i) {
    if (!i || typeof i !== 'object') return 'input is not an object';
    const need = { run_python: ['code'], write_file: ['path', 'content'], read_file: ['path'], search_assets: ['query', 'type'], download_asset: ['id', 'type'], save_lesson: ['lesson'], finish: ['summary'] }[name] || [];
    for (const k of need) if (!isStr(i[k]) || (k !== 'content' && !i[k].length)) return name + ' needs a string `' + k + '`';
    return null;
  }

  function godotPrompt(prompt, opts) {
    return ['Game idea: ' + prompt, '',
      'Engine: Godot 4.7 (GDScript). 3D unless the idea is clearly 2D. All player-facing text in Swedish.',
      'Time budget: up to ' + opts.maxMinutes + ' minutes of work. Use it to build, test and improve – but finish before it runs out.',
      opts.hyperreal ? 'HYPERREALISTIC MODE is on: build the world from photoscanned Poly Haven models, an HDRI sky and PBR textures that fit the idea.' : 'Art style: stylised and colourful, built from primitives and procedural materials.',
    ].concat((opts.features || []).map(k => FEATURE_TEXT[k]).filter(Boolean).map(t => t.replace(/Web Audio/g, 'Godot audio'))).join('\n');
  }

  // exec(name, input) runs a tool on the desktop and returns tool_result content.
  async function agentGodot(settings, prompt, opts, hooks, signal) {
    if (!settings.anthropicKey) throw apiError('Godot-läget med Claude kräver en Anthropic API-nyckel. Utan nyckel bygger Nexora Local spelet offline.');
    const started = Date.now(), limitMs = (opts.maxMinutes || 120) * 60000;
    const tools = GODOT_TOOLS.filter(t => opts.hyperreal || !t.hyperreal).map(t => { const c = Object.assign({}, t); delete c.hyperreal; return c; });
    const lessons = (opts.lessons || []).slice(-40);
    const system = GODOT_GUIDE + (opts.hyperreal ? HYPERREAL_GUIDE : '') + (lessons.length ? '\n\n# Lessons from earlier Astryx runs\n' + lessons.map(l => '- ' + l).join('\n') : '');
    const conf = { system, tools, spec: ANTHROPIC.astryxGodot, betas: ['context-management-2025-06-27'], extra: { context_management: { edits: [{ type: 'clear_tool_uses_20250919' }] } } };
    const messages = [{ role: 'user', content: godotPrompt(prompt, opts) }];
    const st = { runs: 0, cleanRuns: 0, turns: 0, summary: null, lastShots: [], lessons: [], warned: false, idle: 0 };
    for (st.turns = 1; st.turns <= 400; st.turns++) {
      const turn = await agentTurn(settings, messages, hooks, signal, conf);
      messages.push({ role: 'assistant', content: turn.content });
      const elapsed = Date.now() - started;
      if (!turn.calls.length) {
        if (st.summary || elapsed > limitMs || ++st.idle > 2) break;
        messages.push({ role: 'user', content: 'Fortsätt med verktygen. Kör godot_run och avsluta med finish när spelet är klart och testat.' });
        continue;
      }
      st.idle = 0;
      const results = [];
      let done = false;
      for (const c of turn.calls) {
        const r = { type: 'tool_result', tool_use_id: c.id };
        const bad = c._bad != null ? JSON.stringify({ INVALID_JSON: c._bad.slice(0, 2000) }) : godotValidate(c.name, c.input);
        if (bad) { r.is_error = true; r.content = bad; results.push(r); continue; }
        if (c.name === 'finish') {
          if (!st.runs) { r.is_error = true; r.content = 'Run godot_run before finishing.'; }
          else { st.summary = c.input.summary; r.content = 'Done.'; done = true; }
        } else if (c.name === 'save_lesson') {
          st.lessons.push(c.input.lesson.slice(0, 300)); hooks.lesson && hooks.lesson(c.input.lesson.slice(0, 300)); r.content = 'Saved.';
        } else {
          try {
            const out = await hooks.exec(c.name, c.input);
            if (c.name === 'godot_run') { st.runs++; if (out.ok) st.cleanRuns++; st.lastShots = out.shots || []; }
            r.content = out.content; if (out.is_error) r.is_error = true;
          } catch (e) { r.is_error = true; r.content = String(e.message || e); }
        }
        results.push(r);
      }
      // Time: tell Astryx how much is left; stop hard at the limit.
      const left = Math.round((limitMs - (Date.now() - started)) / 60000);
      if (!done && left <= Math.max(3, (opts.maxMinutes || 120) * 0.15) && !st.warned) {
        st.warned = true;
        results.push({ type: 'text', text: '⏱ About ' + Math.max(0, left) + ' minutes of the time budget remain. Stop adding features: fix what is broken, run godot_run once more, save lessons and call finish.' });
      }
      messages.push({ role: 'user', content: results });
      if (done) break;
      if (Date.now() - started > limitMs + 5 * 60000) break;
    }
    if (!st.runs) throw apiError('Astryx hann inte testa något spel. Försök igen.');
    return { summary: st.summary || 'Astryx arbetade tills tiden tog slut. Spelet testkördes ' + st.runs + ' gånger.', runs: st.runs, cleanRuns: st.cleanRuns, turns: st.turns, minutes: Math.round((Date.now() - started) / 60000), lessons: st.lessons, shots: st.lastShots, model: ANTHROPIC.astryxGodot.model };
  }

  window.NexoraAI = { MODELS, ROLLOUT, ANTHROPIC, DEFAULT_SETTINGS, GAME_SYSTEM, AGENT_TOOLS, GODOT_TOOLS, GODOT_GUIDE, gamePrompt, generateGame, fixGame, text, image, mesh, agent, agentGodot, extractHtml };
})();
