// Browser flavour of src/openai.js: same API, but binary results come back as
// data: URLs (there is no server to store files on).
import { call, OpenAIError } from '../src/openai.js';

export { listModels, generateText, transcribe, moderate, startVideo, getVideo, OpenAIError } from '../src/openai.js';

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function generateImage({ model, prompt, size = '1024x1024', transparent = false, quality }) {
  const body = { model, prompt, n: 1, size };
  if (/^dall-e/.test(model)) body.response_format = 'b64_json';
  else {
    if (transparent) body.background = 'transparent';
    if (quality) body.quality = quality;
  }
  let j;
  try {
    j = await call('/images/generations', { body });
  } catch (err) {
    if (err.status !== 400 || !(body.background || body.quality)) throw err;
    delete body.background; delete body.quality;
    j = await call('/images/generations', { body });
  }
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new OpenAIError('The image model returned no image.', 502);
  return `data:image/png;base64,${b64}`;
}

export async function speech({ model, input, voice = 'alloy', instructions }) {
  const body = { model, input, voice, response_format: 'mp3' };
  if (instructions && /gpt/.test(model)) body.instructions = instructions;
  const res = await call('/audio/speech', { body, raw: true, timeout: 120_000 });
  return blobToDataUrl(new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' }));
}

export async function downloadVideo(id) {
  const res = await call(`/videos/${encodeURIComponent(id)}/content`, { method: 'GET', raw: true, timeout: 120_000 });
  return blobToDataUrl(new Blob([await res.arrayBuffer()], { type: 'video/mp4' }));
}
