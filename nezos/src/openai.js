// Thin wrapper over the OpenAI REST API (no SDK needed on Node 20+).
const BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

export class OpenAIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new OpenAIError('OPENAI_API_KEY is not configured on the server.', 503);
  return k;
}

async function call(path, { method = 'POST', body, form, raw = false, timeout = 300_000 } = {}) {
  const headers = { Authorization: `Bearer ${key()}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    let msg = `OpenAI request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
    } catch { /* not JSON */ }
    throw new OpenAIError(msg, res.status);
  }
  if (raw) return res;
  return res.json();
}

export async function listModels() {
  const j = await call('/models', { method: 'GET', timeout: 20_000 });
  return j.data.map((m) => m.id).sort();
}

function maxOutputFor(id) {
  if (/^gpt-3\.5|^gpt-4(-\d{4})?$/.test(id)) return 4000;
  if (/^gpt-4-turbo|^gpt-4o|^chat-latest/.test(id)) return 16000;
  return 32000;
}

function extractResponsesText(j) {
  if (j.status === 'incomplete') {
    throw new OpenAIError(`The model stopped early (${j.incomplete_details?.reason || 'incomplete'}). Try a shorter request or a bigger model.`, 502);
  }
  const parts = [];
  for (const item of j.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c.type === 'output_text') parts.push(c.text);
      if (c.type === 'refusal') throw new OpenAIError(`Model refused: ${c.refusal}`, 422);
    }
  }
  return parts.join('');
}

/**
 * Text generation. Uses the Responses API and falls back to Chat Completions
 * for older models that only speak that API.
 */
export async function generateText({ model, instructions, input, images = [], json = true, effort, reasoning = false }) {
  const content = [{ type: 'input_text', text: input }];
  for (const url of images) content.push({ type: 'input_image', image_url: url });

  const body = {
    model,
    instructions,
    input: [{ role: 'user', content }],
    max_output_tokens: maxOutputFor(model),
  };
  if (json) body.text = { format: { type: 'json_object' } };
  if (reasoning) body.reasoning = { effort: effort || 'low' };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const j = await call('/responses', { body });
      return { text: extractResponsesText(j), usage: j.usage };
    } catch (err) {
      const m = err.message || '';
      if (err.status === 400 && /reasoning/i.test(m) && body.reasoning) { delete body.reasoning; continue; }
      if (err.status === 400 && /image/i.test(m) && images.length) { body.input[0].content = [content[0]]; continue; }
      if (err.status === 400 && /max_output_tokens/i.test(m)) { body.max_output_tokens = 4000; continue; }
      if (err.status === 400 && /not supported with the Responses API/i.test(m)) {
        return chatCompletion({ model, instructions, input, json });
      }
      throw err;
    }
  }
  throw new OpenAIError('Model rejected the request parameters.', 400);
}

async function chatCompletion({ model, instructions, input, json }) {
  const body = {
    model,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: input },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  const j = await call('/chat/completions', { body });
  return { text: j.choices?.[0]?.message?.content || '', usage: j.usage };
}

export async function generateImage({ model, prompt, size = '1024x1024', transparent = false, quality }) {
  const body = { model, prompt, n: 1, size };
  if (/^dall-e/.test(model)) body.response_format = 'b64_json';
  else {
    if (transparent) body.background = 'transparent';
    if (quality) body.quality = quality;
  }
  try {
    const j = await call('/images/generations', { body });
    return Buffer.from(j.data[0].b64_json, 'base64');
  } catch (err) {
    // Some image models don't accept background/quality — retry plain.
    if (err.status === 400 && (body.background || body.quality)) {
      delete body.background; delete body.quality;
      const j = await call('/images/generations', { body });
      return Buffer.from(j.data[0].b64_json, 'base64');
    }
    throw err;
  }
}

export async function speech({ model, input, voice = 'alloy', instructions }) {
  const body = { model, input, voice, response_format: 'mp3' };
  if (instructions && /gpt/.test(model)) body.instructions = instructions;
  const res = await call('/audio/speech', { body, raw: true, timeout: 120_000 });
  return Buffer.from(await res.arrayBuffer());
}

export async function transcribe({ model, audio, filename = 'speech.webm', mime = 'audio/webm' }) {
  const form = new FormData();
  form.append('model', model);
  form.append('file', new Blob([audio], { type: mime }), filename);
  const j = await call('/audio/transcriptions', { form, timeout: 120_000 });
  return j.text || '';
}

export async function moderate(input) {
  try {
    const j = await call('/moderations', { body: { model: 'omni-moderation-latest', input }, timeout: 15_000 });
    return j.results?.[0] || { flagged: false };
  } catch (err) {
    console.warn('[moderation] skipped:', err.message);
    return { flagged: false };
  }
}

export async function startVideo({ model, prompt, seconds = '4', size = '1280x720' }) {
  return call('/videos', { body: { model, prompt, seconds: String(seconds), size } });
}

export async function getVideo(id) {
  return call(`/videos/${encodeURIComponent(id)}`, { method: 'GET', timeout: 30_000 });
}

export async function downloadVideo(id) {
  const res = await call(`/videos/${encodeURIComponent(id)}/content`, { method: 'GET', raw: true, timeout: 120_000 });
  return Buffer.from(await res.arrayBuffer());
}
