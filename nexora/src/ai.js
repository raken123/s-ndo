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
  };

  // What each Nexora model runs on with the Anthropic provider.
  const ANTHROPIC = {
    flash: { model: 'claude-haiku-4-5', max_tokens: 16000 },
    pro: { model: 'claude-opus-5', max_tokens: 64000, output_config: { effort: 'medium' }, fallbacks: true },
    core: { model: 'claude-opus-5', max_tokens: 64000, thinking: { type: 'adaptive', display: 'summarized' }, output_config: { effort: 'xhigh' }, fallbacks: true },
    image: { model: 'claude-opus-5', max_tokens: 32000, output_config: { effort: 'medium' }, fallbacks: true },
    d3: { model: 'claude-opus-5', max_tokens: 32000, output_config: { effort: 'medium' }, fallbacks: true },
  };

  const DEFAULT_SETTINGS = {
    provider: 'local',
    anthropicKey: '',
    openaiBase: 'https://api.openai.com/v1',
    openaiKey: '',
    openaiModels: { flash: 'gpt-5-fast', pro: 'gpt-6-astra', core: 'gpt-6-astra', image: 'gpt-images-2.5', d3: 'gpt-6-astra' },
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

  window.NexoraAI = { MODELS, ANTHROPIC, DEFAULT_SETTINGS, GAME_SYSTEM, gamePrompt, generateGame, fixGame, text, image, mesh, extractHtml };
})();
