// In-browser replacement for server.js, used by the single-file build.
// Implements the same /api/* routes on top of IndexedDB and calls OpenAI
// directly from the page. The studio code runs unchanged on top of it.
import { PLANS, planById, publicPlan, SIGNUP_CREDITS } from '../src/plans.js';
import { allModels, getModel, canUse, refreshModels, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, modelsStatus } from '../src/models.js';
import { systemPrompt, userPrompt, MODE_LIST } from '../src/prompts.js';
import { TEMPLATES, templateScene } from '../src/templates.js';
import * as openai from './openai-browser.js';

const MONTH = 30 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const SESSION_KEY = 'nezos.session';

// ------------------------------------------------------------------ storage
let dbp;
function idb() {
  dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('nezos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
async function kv(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', mode);
    const req = fn(tx.objectStore('kv'));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}
const get = (k) => kv('readonly', (s) => s.get(k));
const put = (k, v) => kv('readwrite', (s) => s.put(v, k));
const del = (k) => kv('readwrite', (s) => s.delete(k));

let state = null; // { users: {}, transactions: [], projects: [{id, ownerId}] }
async function load() {
  state ||= (await get('state')) || { users: {}, transactions: [], projects: [] };
  return state;
}
const save = () => put('state', state);

const rid = (n = 12) => {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function hashPassword(password, salt = rid(16)) {
  if (crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 150_000, hash: 'SHA-256' }, key, 256);
    return `${salt}:${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
  }
  let h = 0;
  for (const c of salt + password) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return `${salt}:${h}`;
}

// ------------------------------------------------------------------ accounts & credits
class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

function currentUser() {
  const id = localStorage.getItem(SESSION_KEY);
  const user = id && state.users[id];
  if (user) applyRefill(user);
  return user || null;
}
function requireUser() {
  const u = currentUser();
  if (!u) throw new HttpError(401, 'Please log in.');
  return u;
}
const publicUser = (u) => { if (!u) return null; const { password, ...rest } = u; return rest; };

function addTx(user, amount, reason) {
  state.transactions.push({ id: rid(6), userId: user.id, amount, reason, balance: user.credits, at: Date.now() });
  if (state.transactions.length > 5000) state.transactions.splice(0, 1000);
}
function applyRefill(user) {
  const plan = planById(user.plan);
  let changed = false;
  while (Date.now() >= user.nextRefillAt) {
    user.nextRefillAt += MONTH;
    user.cycleGranted = 0;
    if (plan.monthlyCredits > 0) {
      user.credits += plan.monthlyCredits;
      user.cycleGranted = plan.monthlyCredits;
      addTx(user, plan.monthlyCredits, `${plan.name} monthly credits`);
    }
    changed = true;
  }
  if (changed) save();
}
function charge(user, amount, reason) {
  if (amount <= 0) return () => {};
  if (user.credits < amount) throw new HttpError(402, `Not enough credits: this needs ${amount}, you have ${user.credits}. Upgrade your plan to get more.`);
  user.credits -= amount;
  addTx(user, -amount, reason);
  save();
  let done = false;
  return (why = 'Refund') => {
    if (done) return;
    done = true;
    user.credits += amount;
    addTx(user, amount, `${why}: ${reason}`);
    save();
  };
}

function resolveModel(user, id, kinds, fallback) {
  const plan = planById(user.plan);
  const model = getModel(id || fallback[plan.id]);
  if (!model || !kinds.includes(model.kind)) throw new HttpError(400, `Unknown or unsupported model "${id}".`);
  if (!canUse(plan, model)) throw new HttpError(403, `${model.name} requires the ${model.minPlanName} plan or higher.`, { upgrade: model.minPlan });
  return { model, plan };
}
function requireFeature(plan, feature, label) {
  if (plan.features[feature]) return;
  const needed = PLANS.find((p) => p.features[feature]);
  throw new HttpError(403, `${label} requires the ${needed.name} plan or higher.`, { upgrade: needed.id });
}
async function checkPrompt(text) {
  const mod = await openai.moderate(text);
  if (mod.flagged) throw new HttpError(422, 'That prompt was flagged by content moderation. Try rephrasing it.');
}

// Swap embedded data: URLs (images, audio) for short tokens so they don't get sent to the model.
function stripData(value) {
  const map = new Map();
  let n = 0;
  const json = JSON.stringify(value, (k, v) => {
    if (typeof v === 'string' && v.startsWith('data:')) { const t = `asset://${++n}`; map.set(t, v); return t; }
    return v;
  });
  return { value: json === undefined ? value : JSON.parse(json), map };
}
function restoreData(value, map) {
  if (!map.size) return value;
  return JSON.parse(JSON.stringify(value), (k, v) => (typeof v === 'string' && map.has(v) ? map.get(v) : v));
}
function parseModelJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s >= 0 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch { /* fall through */ } }
  return { reply: text, ops: [] };
}

let modelsLoaded = null;
export function reloadModels() {
  modelsLoaded = window.NEZOS_HAS_KEY() ? refreshModels() : Promise.resolve();
  return modelsLoaded;
}

// ------------------------------------------------------------------ routes
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

on('POST', '/api/auth/signup', async ({ body }) => {
  const { email, password, name } = body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) throw new HttpError(400, 'Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  const e = email.trim().toLowerCase();
  if (Object.values(state.users).some((u) => u.email === e)) throw new HttpError(409, 'An account with this email already exists.');
  const now = Date.now();
  const user = {
    id: rid(), email: e, name: (typeof name === 'string' && name.trim() ? name.trim() : e.split('@')[0]).slice(0, 60),
    password: await hashPassword(password), plan: 'free', credits: SIGNUP_CREDITS, createdAt: now, nextRefillAt: now + MONTH, cycleGranted: 0,
  };
  state.users[user.id] = user;
  addTx(user, SIGNUP_CREDITS, 'Welcome bonus');
  await save();
  localStorage.setItem(SESSION_KEY, user.id);
  return { user: publicUser(user) };
});

on('POST', '/api/auth/login', async ({ body }) => {
  const { email, password } = body || {};
  const user = Object.values(state.users).find((u) => u.email === String(email || '').trim().toLowerCase());
  const [salt] = String(user?.password || 'x:').split(':');
  if (!user || (await hashPassword(String(password || ''), salt)) !== user.password) throw new HttpError(401, 'Wrong email or password.');
  localStorage.setItem(SESSION_KEY, user.id);
  return { user: publicUser(user) };
});

on('POST', '/api/auth/logout', () => { localStorage.removeItem(SESSION_KEY); return { ok: true }; });

on('GET', '/api/me', () => {
  const user = currentUser();
  if (!user) return { user: null };
  const plan = planById(user.plan);
  return { user: publicUser(user), plan: publicPlan(plan), defaults: { text: DEFAULT_TEXT_MODEL[plan.id], image: DEFAULT_IMAGE_MODEL[plan.id] } };
});

on('GET', '/api/plans', () => ({ plans: PLANS.map(publicPlan), billingMode: 'demo' }));

on('POST', '/api/billing/plan', async ({ body }) => {
  const user = requireUser();
  const plan = planById(String(body?.plan || ''));
  if (plan.id !== body?.plan) throw new HttpError(400, 'Unknown plan.');
  const granted = Math.max(0, plan.monthlyCredits - (user.cycleGranted || 0));
  user.plan = plan.id;
  if (granted > 0) {
    user.credits += granted;
    user.cycleGranted = (user.cycleGranted || 0) + granted;
    addTx(user, granted, `${plan.name} plan credits`);
  }
  await save();
  return { user: publicUser(user), plan: publicPlan(plan), granted };
});

on('GET', '/api/billing/transactions', () => {
  const user = requireUser();
  return { transactions: state.transactions.filter((t) => t.userId === user.id).slice(-100).reverse() };
});

on('GET', '/api/models', async () => {
  await Promise.race([modelsLoaded, new Promise((r) => setTimeout(r, 8000))]);
  const user = currentUser();
  const plan = planById(user?.plan || 'free');
  return { models: allModels().map((m) => ({ ...m, allowed: !!user && canUse(plan, m) && m.studio })), status: modelsStatus() };
});

on('GET', '/api/templates', () => ({ templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name })) }));

async function ownProject(id) {
  const user = requireUser();
  const p = await get(`project:${id}`);
  if (!p || p.ownerId !== user.id) throw new HttpError(404, 'Project not found.');
  return p;
}
const summary = (p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt, objects: p.scene.objects?.length || 0, thumbnail: p.thumbnail || null, shareId: null });

on('GET', '/api/projects', async () => {
  const user = requireUser();
  const mine = state.projects.filter((x) => x.ownerId === user.id);
  const list = (await Promise.all(mine.map((x) => get(`project:${x.id}`)))).filter(Boolean);
  return { projects: list.sort((a, b) => b.updatedAt - a.updatedAt).map(summary) };
});

on('POST', '/api/projects', async ({ body }) => {
  const user = requireUser();
  const plan = planById(user.plan);
  if (state.projects.filter((x) => x.ownerId === user.id).length >= plan.maxProjects) {
    throw new HttpError(403, `Your ${plan.name} plan allows ${plan.maxProjects} projects. Upgrade for more.`);
  }
  const now = Date.now();
  const p = { id: rid(9), ownerId: user.id, name: String(body?.name || 'Untitled game').slice(0, 80), scene: templateScene(body?.template), chat: [], createdAt: now, updatedAt: now };
  await put(`project:${p.id}`, p);
  state.projects.push({ id: p.id, ownerId: user.id });
  await save();
  return { project: p };
});

on('GET', '/api/projects/:id', async ({ params }) => ({ project: await ownProject(params.id) }));

on('PUT', '/api/projects/:id', async ({ params, body }) => {
  const p = await ownProject(params.id);
  const { name, scene, chat, thumbnail } = body || {};
  if (typeof name === 'string') p.name = name.slice(0, 80) || 'Untitled game';
  if (scene && Array.isArray(scene.objects)) p.scene = scene;
  if (Array.isArray(chat)) p.chat = chat.slice(-200);
  if (typeof thumbnail === 'string' && thumbnail.startsWith('data:image/')) p.thumbnail = thumbnail;
  p.updatedAt = Date.now();
  await put(`project:${p.id}`, p);
  return { ok: true, updatedAt: p.updatedAt };
});

on('DELETE', '/api/projects/:id', async ({ params }) => {
  const p = await ownProject(params.id);
  await del(`project:${p.id}`);
  state.projects = state.projects.filter((x) => x.id !== p.id);
  await save();
  return { ok: true };
});

on('POST', '/api/projects/:id/publish', () => {
  throw new HttpError(400, 'Share links need the Nezos server. In this single-file version, use More → Export HTML game and send that file instead.');
});

const EFFORT_MULT = { low: 1, medium: 1.5, high: 2.5 };

on('POST', '/api/ai/chat', async ({ body }) => {
  const user = requireUser();
  const { mode = 'auto', model: modelId, message, scene, selection, history, effort = 'low', report, screenshot } = body || {};
  if (!MODE_LIST.includes(mode)) throw new HttpError(400, 'Unknown mode.');
  if (typeof message !== 'string' || !message.trim()) throw new HttpError(400, 'Say what you want to build.');
  if (!scene || !Array.isArray(scene.objects)) throw new HttpError(400, 'Missing scene.');
  const { model, plan } = resolveModel(user, modelId, ['text'], DEFAULT_TEXT_MODEL);
  if (mode === 'playtest') requireFeature(plan, 'playtest', 'AI playtesting');
  const eff = ['low', 'medium', 'high'].includes(effort) && model.reasoning ? effort : 'low';
  const cost = Math.ceil(model.cost * EFFORT_MULT[eff]) + (mode === 'playtest' ? 1 : 0);
  const refund = charge(user, cost, `${model.name} · ${mode}`);
  try {
    const { value: cleanScene, map } = stripData(scene);
    const { value: cleanSel } = stripData(selection ?? null);
    const images = typeof screenshot === 'string' && screenshot.startsWith('data:image/') ? [screenshot] : [];
    const { text, usage } = await openai.generateText({
      model: model.id,
      instructions: systemPrompt(mode),
      input: userPrompt({ message: message.slice(0, 8000), scene: cleanScene, selection: cleanSel, history: Array.isArray(history) ? history : [], report }),
      images,
      reasoning: !!model.reasoning,
      effort: eff,
    });
    const out = parseModelJson(text);
    return {
      reply: typeof out.reply === 'string' ? out.reply : '',
      ops: restoreData(Array.isArray(out.ops) ? out.ops : [], map),
      plan: typeof out.plan === 'string' ? out.plan : null,
      suggestions: Array.isArray(out.suggestions) ? out.suggestions.filter((s) => typeof s === 'string').slice(0, 3) : [],
      images: Array.isArray(out.images) ? out.images.filter((i) => i && typeof i.prompt === 'string').slice(0, 4) : [],
      cost, credits: user.credits, model: model.id, usage,
    };
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
});

on('POST', '/api/ai/image', async ({ body }) => {
  const user = requireUser();
  const { prompt, model: modelId, size = '1024x1024', transparent = false, purpose } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, 'Describe the image.');
  const { model } = resolveModel(user, modelId, ['image'], DEFAULT_IMAGE_MODEL);
  await checkPrompt(prompt);
  const refund = charge(user, model.cost, `${model.name} · image`);
  try {
    let full = prompt.slice(0, 3000);
    if (purpose === 'texture') full += '\nSeamless tileable texture, top-down flat lighting, no text, fills the frame.';
    if (purpose === 'sky') full += '\nEquirectangular 360° panorama sky/environment for a video game, no text.';
    if (purpose === 'sprite') full += '\nSingle game sprite/icon centred on a transparent background, no text.';
    const okSize = ['1024x1024', '1536x1024', '1024x1536'].includes(size) ? size : '1024x1024';
    const url = await openai.generateImage({ model: model.id, prompt: full, size: purpose === 'sky' ? '1536x1024' : okSize, transparent: transparent || purpose === 'sprite' });
    return { url, cost: model.cost, credits: user.credits, model: model.id };
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
});

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
on('POST', '/api/ai/speech', async ({ body }) => {
  const user = requireUser();
  const { text, voice = 'alloy', model: modelId = 'gpt-4o-mini-tts', instructions } = body || {};
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'Enter the line to speak.');
  const { model, plan } = resolveModel(user, modelId, ['tts'], {});
  requireFeature(plan, 'audio', 'AI voice');
  await checkPrompt(text);
  const refund = charge(user, model.cost, `${model.name} · voice`);
  try {
    const url = await openai.speech({ model: model.id, input: text.slice(0, 4000), voice: VOICES.includes(voice) ? voice : 'alloy', instructions: typeof instructions === 'string' ? instructions.slice(0, 500) : undefined });
    return { url, cost: model.cost, credits: user.credits };
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
});

on('POST', '/api/ai/transcribe', async ({ raw, headers }) => {
  const user = requireUser();
  if (!(raw instanceof Blob) || !raw.size) throw new HttpError(400, 'No audio received.');
  const { model, plan } = resolveModel(user, 'gpt-4o-mini-transcribe', ['transcribe'], {});
  requireFeature(plan, 'voiceInput', 'Voice prompts');
  const refund = charge(user, model.cost, `${model.name} · voice prompt`);
  try {
    const mime = (headers['Content-Type'] || raw.type || 'audio/webm').split(';')[0];
    const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
    const text = await openai.transcribe({ model: model.id, audio: raw, filename: `speech.${ext}`, mime });
    return { text, credits: user.credits };
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
});

const videoJobs = new Map();
on('POST', '/api/ai/video', async ({ body }) => {
  const user = requireUser();
  const { prompt, model: modelId = 'sora-2', seconds = 4 } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, 'Describe the video.');
  const { model, plan } = resolveModel(user, modelId, ['video'], {});
  requireFeature(plan, 'video', 'AI video');
  await checkPrompt(prompt);
  const secs = [4, 8, 12].includes(Number(seconds)) ? Number(seconds) : 4;
  const cost = model.cost * (secs / 4);
  const refund = charge(user, cost, `${model.name} · ${secs}s video`);
  let started;
  try {
    started = await openai.startVideo({ model: model.id, prompt: prompt.slice(0, 2000), seconds: secs });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
  const job = { id: rid(9), status: 'queued', progress: 0, url: null, error: null };
  videoJobs.set(job.id, job);
  (async () => {
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const v = await openai.getVideo(started.id);
        job.status = v.status;
        job.progress = v.progress ?? job.progress;
        if (v.status === 'completed') { job.url = await openai.downloadVideo(started.id); return; }
        if (v.status === 'failed') { job.error = v.error?.message || 'Video generation failed.'; refund('Refund (failed)'); return; }
      } catch (err) {
        Object.assign(job, { status: 'failed', error: err.message });
        refund('Refund (failed)');
        return;
      }
    }
    Object.assign(job, { status: 'failed', error: 'Timed out.' });
    refund('Refund (timeout)');
  })();
  return { jobId: job.id, cost, credits: user.credits };
});

on('GET', '/api/ai/video/:jobId', ({ params }) => {
  requireUser();
  const job = videoJobs.get(params.jobId);
  if (!job) throw new HttpError(404, 'Job not found.');
  return { status: job.status, progress: job.progress, url: job.url, error: job.error };
});

// ------------------------------------------------------------------ export
export async function exportProject(id, { engineSource, threeCdn }) {
  const p = await ownProject(id);
  const json = JSON.stringify(p.scene).replace(/</g, '\\u003c');
  const title = p.name.replace(/[<>&"]/g, '');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — made with Nezos</title>
<style>html,body{margin:0;height:100%;background:#0b0d17;overflow:hidden}#game{position:fixed;inset:0}</style>
<script type="importmap">{"imports":{"three":"${threeCdn}/build/three.module.js","three/addons/":"${threeCdn}/examples/jsm/"}}</script>
</head>
<body>
<div id="game"></div>
<script type="module">
${engineSource}
const doc = ${json};
new Runtime(document.getElementById('game'), doc, { onLog: (level, text) => console[level === 'error' ? 'error' : 'log'](text) });
</script>
</body>
</html>`;
  saveFile(`${p.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'game'}.html`, 'text/html', html);
}

/** Save a file: native bridge in the Android/iOS apps, a download everywhere else. */
function saveFile(name, mime, text) {
  const b64 = () => {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  if (window.NezosAndroid?.saveFile) return window.NezosAndroid.saveFile(name, mime, b64());
  if (window.webkit?.messageHandlers?.nezosSave) return window.webkit.messageHandlers.nezosSave.postMessage({ name, mime, base64: b64() });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.dataset.nzDownload = '1';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

// ------------------------------------------------------------------ fetch shim
export async function install() {
  await load();
  reloadModels();
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);
    const [path] = url.split('?');
    const method = (init.method || 'GET').toUpperCase();
    const route = routes.find((r) => r.method === method && r.re.test(path));
    let status = 200;
    let payload;
    try {
      if (!route) throw new HttpError(404, 'Not found.');
      const isJson = typeof init.body === 'string';
      payload = await route.fn({
        params: path.match(route.re).groups || {},
        body: isJson ? JSON.parse(init.body) : undefined,
        raw: isJson ? undefined : init.body,
        headers: init.headers || {},
      });
    } catch (err) {
      status = err.status && err.status >= 400 ? err.status : 500;
      if (err instanceof openai.OpenAIError && err.status === 401) {
        status = 400;
        err.message = 'Your OpenAI API key was rejected. Click 🔑 API key to fix it.';
      }
      if (err instanceof openai.OpenAIError && err.status === 503) err.message = 'Add your OpenAI API key first: click 🔑 API key.';
      if (status >= 500 && !(err instanceof HttpError) && !(err instanceof openai.OpenAIError)) console.error(err);
      payload = { error: err.message || 'Something went wrong.', upgrade: err.upgrade };
    }
    return new Response(JSON.stringify(payload ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  };
}
