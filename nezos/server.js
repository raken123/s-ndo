import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { db, save, ASSET_DIR } from './src/db.js';
import {
  attachUser, requireUser, createUser, checkLogin, createSession, destroySession, findUserByEmail,
  charge, changePlan, publicUser, EMAIL_RE,
} from './src/auth.js';
import { PLANS, planById, publicPlan } from './src/plans.js';
import {
  startModelRefresh, allModels, getModel, canUse, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL, modelsStatus,
} from './src/models.js';
import * as openai from './src/openai.js';
import { systemPrompt, userPrompt, MODE_LIST } from './src/prompts.js';
import { TEMPLATES, templateScene } from './src/templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');

// Minimal .env loader (avoids a dependency).
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
const BILLING_MODE = process.env.BILLING_MODE || 'demo';
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT) || 10; // sign-up/login attempts per IP per minute

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');

// ------------------------------------------------------------------ basics
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use('/api', express.json({ limit: '8mb' }));
app.use(attachUser);

// Cross-site request guard: every state-changing API call must carry this header,
// which HTML forms and simple cross-origin requests can't set.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('x-nezos') !== '1') return res.status(403).json({ error: 'Missing request header.' });
  next();
});

// Fixed-window rate limiter.
const buckets = new Map();
function limit(name, max, windowMs, keyFn = (req) => req.user?.id || req.ip) {
  return (req, res, next) => {
    const key = `${name}:${keyFn(req)}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
    if (++b.n > max) return res.status(429).json({ error: 'Too many requests, slow down a little.' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60_000).unref();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ------------------------------------------------------------------ static
const corsStatic = { setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*') };
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { ...corsStatic, maxAge: '7d' }));
app.use('/assets', express.static(ASSET_DIR, { ...corsStatic, maxAge: '30d', index: false }));

const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC, file));
app.get('/', page('index.html'));
app.get(['/login', '/signup'], page('auth.html'));
app.get('/dashboard', page('dashboard.html'));
app.get('/models', page('models.html'));
app.get('/studio/:id', page('studio.html'));
app.get('/play.html', (req, res) => {
  // The game runtime executes AI/user-written code: give it an opaque origin.
  res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-pointer-lock');
  res.sendFile(path.join(PUBLIC, 'play.html'));
});
app.use(express.static(PUBLIC, { ...corsStatic, index: false }));

// ------------------------------------------------------------------ auth
app.post('/api/auth/signup', limit('auth', AUTH_LIMIT, 60_000, (r) => r.ip), (req, res) => {
  const { email, password, name } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (findUserByEmail(email.trim())) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = createUser({ email: email.trim(), password, name: typeof name === 'string' ? name.trim() : '' });
  createSession(res, user, PROD);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/login', limit('auth', AUTH_LIMIT, 60_000, (r) => r.ip), (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Email and password are required.' });
  const user = checkLogin(email.trim(), password);
  if (!user) return res.status(401).json({ error: 'Wrong email or password.' });
  createSession(res, user, PROD);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const plan = planById(req.user.plan);
  res.json({
    user: publicUser(req.user),
    plan: publicPlan(plan),
    defaults: { text: DEFAULT_TEXT_MODEL[plan.id], image: DEFAULT_IMAGE_MODEL[plan.id] },
  });
});

// ------------------------------------------------------------------ plans & billing
app.get('/api/plans', (req, res) => res.json({ plans: PLANS.map(publicPlan), billingMode: BILLING_MODE }));

app.post('/api/billing/plan', requireUser, (req, res) => {
  if (BILLING_MODE !== 'demo') {
    return res.status(402).json({ error: 'Payments are not connected yet. Configure a payment provider to enable upgrades.' });
  }
  const granted = changePlan(req.user, String(req.body?.plan || ''));
  res.json({ user: publicUser(req.user), plan: publicPlan(planById(req.user.plan)), granted });
});

app.get('/api/billing/transactions', requireUser, (req, res) => {
  const tx = db.state.transactions.filter((t) => t.userId === req.user.id).slice(-100).reverse();
  res.json({ transactions: tx });
});

// ------------------------------------------------------------------ models
app.get('/api/models', (req, res) => {
  const plan = planById(req.user?.plan || 'free');
  const models = allModels().map((m) => ({ ...m, allowed: !!req.user && canUse(plan, m) && m.studio }));
  res.json({ models, status: modelsStatus() });
});

// ------------------------------------------------------------------ projects
const ownProject = (req, res) => {
  const p = db.state.projects[req.params.id];
  if (!p || p.ownerId !== req.user.id) { res.status(404).json({ error: 'Project not found.' }); return null; }
  return p;
};
const projectSummary = (p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt, objects: p.scene.objects?.length || 0, thumbnail: p.thumbnail || null, shareId: p.shareId || null });

app.get('/api/templates', (req, res) => res.json({ templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name })) }));

app.get('/api/projects', requireUser, (req, res) => {
  const list = Object.values(db.state.projects).filter((p) => p.ownerId === req.user.id).sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ projects: list.map(projectSummary) });
});

app.post('/api/projects', requireUser, (req, res) => {
  const plan = planById(req.user.plan);
  const count = Object.values(db.state.projects).filter((p) => p.ownerId === req.user.id).length;
  if (count >= plan.maxProjects) {
    return res.status(403).json({ error: `Your ${plan.name} plan allows ${plan.maxProjects} projects. Upgrade for more.` });
  }
  const id = db.id(9);
  const now = Date.now();
  const p = {
    id,
    ownerId: req.user.id,
    name: String(req.body?.name || 'Untitled game').slice(0, 80),
    scene: templateScene(req.body?.template),
    chat: [],
    createdAt: now,
    updatedAt: now,
  };
  db.state.projects[id] = p;
  save();
  res.json({ project: p });
});

app.get('/api/projects/:id', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (p) res.json({ project: p });
});

app.put('/api/projects/:id', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  const { name, scene, chat, thumbnail } = req.body || {};
  if (typeof name === 'string') p.name = name.slice(0, 80) || 'Untitled game';
  if (scene && typeof scene === 'object' && Array.isArray(scene.objects)) p.scene = scene;
  if (Array.isArray(chat)) p.chat = chat.slice(-200);
  if (typeof thumbnail === 'string' && thumbnail.startsWith('data:image/') && thumbnail.length < 200_000) p.thumbnail = thumbnail;
  p.updatedAt = Date.now();
  save();
  res.json({ ok: true, updatedAt: p.updatedAt });
});

app.delete('/api/projects/:id', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  delete db.state.projects[p.id];
  save();
  res.json({ ok: true });
});

app.post('/api/projects/:id/publish', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  if (req.body?.publish === false) delete p.shareId;
  else p.shareId ||= db.id(9);
  save();
  res.json({ shareId: p.shareId || null });
});

// --- export / published games
const engineSource = () => fs.readFileSync(path.join(PUBLIC, 'js/engine/engine.js'), 'utf8');
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.180.0';

function gameHtml(project, { inlineAssets, origin }) {
  let json = JSON.stringify(project.scene);
  json = json.replace(/"\/assets\/([A-Za-z0-9_-]+\.(png|mp3|mp4|webp|jpg))"/g, (whole, file, ext) => {
    if (!inlineAssets) return JSON.stringify(`${origin}/assets/${file}`);
    const fp = path.join(ASSET_DIR, file);
    if (!fs.existsSync(fp)) return whole;
    const mime = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', mp3: 'audio/mpeg', mp4: 'video/mp4' }[ext];
    return JSON.stringify(`data:${mime};base64,${fs.readFileSync(fp).toString('base64')}`);
  });
  const safeJson = json.replace(/</g, '\\u003c');
  const title = project.name.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — made with Nezos</title>
<style>html,body{margin:0;height:100%;background:#0b0d17;overflow:hidden}#game{position:fixed;inset:0}
#nz-badge{position:fixed;right:12px;bottom:10px;font:600 12px system-ui,sans-serif;color:#fff;opacity:.7;text-decoration:none;z-index:5}</style>
<script type="importmap">{"imports":{"three":"${THREE_CDN}/build/three.module.js","three/addons/":"${THREE_CDN}/examples/jsm/"}}</script>
</head>
<body>
<div id="game"></div>
<a id="nz-badge" href="${origin}" target="_blank" rel="noopener">Made with Nezos</a>
<script type="module">
${engineSource()}
const doc = ${safeJson};
new Runtime(document.getElementById('game'), doc, { onLog: (level, text) => console[level === 'error' ? 'error' : 'log'](text) });
</script>
</body>
</html>`;
}

const originOf = (req) => `${req.protocol}://${req.get('host')}`;

app.get('/api/projects/:id/export', requireUser, (req, res) => {
  const p = ownProject(req, res);
  if (!p) return;
  const file = `${p.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'game'}.html`;
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  res.type('html').send(gameHtml(p, { inlineAssets: true, origin: originOf(req) }));
});

app.get('/g/:shareId', (req, res) => {
  const p = Object.values(db.state.projects).find((x) => x.shareId && x.shareId === req.params.shareId);
  if (!p) return res.status(404).send('Game not found');
  res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-pointer-lock allow-popups');
  res.type('html').send(gameHtml(p, { inlineAssets: false, origin: originOf(req) }));
});

// ------------------------------------------------------------------ AI
const aiLimit = limit('ai', 30, 60_000);

function resolveModel(req, id, kinds, fallback) {
  const plan = planById(req.user.plan);
  const model = getModel(id || fallback[plan.id]);
  if (!model || !kinds.includes(model.kind)) {
    throw Object.assign(new Error(`Unknown or unsupported model "${id}".`), { status: 400 });
  }
  if (!canUse(plan, model)) {
    throw Object.assign(new Error(`${model.name} requires the ${model.minPlanName} plan or higher.`), { status: 403, upgrade: model.minPlan });
  }
  return { model, plan };
}

function requireFeature(plan, feature, label) {
  if (!plan.features[feature]) {
    const needed = PLANS.find((p) => p.features[feature]);
    throw Object.assign(new Error(`${label} requires the ${needed.name} plan or higher.`), { status: 403, upgrade: needed.id });
  }
}

function parseModelJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return { reply: text, ops: [] };
}

const EFFORT_MULT = { low: 1, medium: 1.5, high: 2.5 };

app.post('/api/ai/chat', requireUser, aiLimit, wrap(async (req, res) => {
  const { mode = 'auto', model: modelId, message, scene, selection, history, effort = 'low', report, screenshot } = req.body || {};
  if (!MODE_LIST.includes(mode)) return res.status(400).json({ error: 'Unknown mode.' });
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Say what you want to build.' });
  if (!scene || !Array.isArray(scene.objects)) return res.status(400).json({ error: 'Missing scene.' });

  const { model, plan } = resolveModel(req, modelId, ['text'], DEFAULT_TEXT_MODEL);
  if (mode === 'playtest') requireFeature(plan, 'playtest', 'AI playtesting');

  const eff = ['low', 'medium', 'high'].includes(effort) && model.reasoning ? effort : 'low';
  const cost = Math.ceil(model.cost * EFFORT_MULT[eff]) + (mode === 'playtest' ? 1 : 0);
  const refund = charge(req.user, cost, `${model.name} · ${mode}`);
  try {
    const images = typeof screenshot === 'string' && screenshot.startsWith('data:image/') && screenshot.length < 1_500_000 ? [screenshot] : [];
    const { text, usage } = await openai.generateText({
      model: model.id,
      instructions: systemPrompt(mode),
      input: userPrompt({ message: message.slice(0, 8000), scene, selection, history: Array.isArray(history) ? history : [], report }),
      images,
      reasoning: !!model.reasoning,
      effort: eff,
    });
    const out = parseModelJson(text);
    res.json({
      reply: typeof out.reply === 'string' ? out.reply : '',
      ops: Array.isArray(out.ops) ? out.ops : [],
      plan: typeof out.plan === 'string' ? out.plan : null,
      suggestions: Array.isArray(out.suggestions) ? out.suggestions.filter((s) => typeof s === 'string').slice(0, 3) : [],
      images: Array.isArray(out.images) ? out.images.filter((i) => i && typeof i.prompt === 'string').slice(0, 4) : [],
      cost,
      credits: req.user.credits,
      model: model.id,
      usage,
    });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
}));

function saveAsset(buffer, ext) {
  const file = `${db.id(18)}.${ext}`;
  fs.writeFileSync(path.join(ASSET_DIR, file), buffer);
  return `/assets/${file}`;
}

async function checkPrompt(text) {
  const mod = await openai.moderate(text);
  if (mod.flagged) throw Object.assign(new Error('That prompt was flagged by content moderation. Try rephrasing it.'), { status: 422 });
}

app.post('/api/ai/image', requireUser, aiLimit, wrap(async (req, res) => {
  const { prompt, model: modelId, size = '1024x1024', transparent = false, purpose } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Describe the image.' });
  const { model } = resolveModel(req, modelId, ['image'], DEFAULT_IMAGE_MODEL);
  const okSize = ['1024x1024', '1536x1024', '1024x1536'].includes(size) ? size : '1024x1024';
  await checkPrompt(prompt);
  const refund = charge(req.user, model.cost, `${model.name} · image`);
  try {
    let full = prompt.slice(0, 3000);
    if (purpose === 'texture') full += '\nSeamless tileable texture, top-down flat lighting, no text, fills the frame.';
    if (purpose === 'sky') full += '\nEquirectangular 360° panorama sky/environment for a video game, no text.';
    if (purpose === 'sprite') full += '\nSingle game sprite/icon centred on a transparent background, no text.';
    const png = await openai.generateImage({ model: model.id, prompt: full, size: purpose === 'sky' ? '1536x1024' : okSize, transparent: transparent || purpose === 'sprite' });
    res.json({ url: saveAsset(png, 'png'), cost: model.cost, credits: req.user.credits, model: model.id });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
}));

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];

app.post('/api/ai/speech', requireUser, aiLimit, wrap(async (req, res) => {
  const { text, voice = 'alloy', model: modelId = 'gpt-4o-mini-tts', instructions } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Enter the line to speak.' });
  const { model, plan } = resolveModel(req, modelId, ['tts'], {});
  requireFeature(plan, 'audio', 'AI voice');
  await checkPrompt(text);
  const refund = charge(req.user, model.cost, `${model.name} · voice`);
  try {
    const mp3 = await openai.speech({ model: model.id, input: text.slice(0, 4000), voice: VOICES.includes(voice) ? voice : 'alloy', instructions: typeof instructions === 'string' ? instructions.slice(0, 500) : undefined });
    res.json({ url: saveAsset(mp3, 'mp3'), cost: model.cost, credits: req.user.credits });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
}));

app.post('/api/ai/transcribe', requireUser, aiLimit, express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '20mb' }), wrap(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No audio received.' });
  const { model, plan } = resolveModel(req, 'gpt-4o-mini-transcribe', ['transcribe'], {});
  requireFeature(plan, 'voiceInput', 'Voice prompts');
  const refund = charge(req.user, model.cost, `${model.name} · voice prompt`);
  try {
    const mime = (req.get('content-type') || 'audio/webm').split(';')[0];
    const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
    const text = await openai.transcribe({ model: model.id, audio: req.body, filename: `speech.${ext}`, mime });
    res.json({ text, credits: req.user.credits });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
}));

// Video jobs (Sora) run in the background; the client polls.
const videoJobs = new Map();

app.post('/api/ai/video', requireUser, aiLimit, wrap(async (req, res) => {
  const { prompt, model: modelId = 'sora-2', seconds = 4 } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Describe the video.' });
  const { model, plan } = resolveModel(req, modelId, ['video'], {});
  requireFeature(plan, 'video', 'AI video');
  await checkPrompt(prompt);
  const secs = [4, 8, 12].includes(Number(seconds)) ? Number(seconds) : 4;
  const cost = model.cost * (secs / 4);
  const refund = charge(req.user, cost, `${model.name} · ${secs}s video`);
  let started;
  try {
    started = await openai.startVideo({ model: model.id, prompt: prompt.slice(0, 2000), seconds: secs });
  } catch (err) {
    refund('Refund (failed)');
    throw err;
  }
  const job = { id: db.id(9), userId: req.user.id, openaiId: started.id, status: 'queued', progress: 0, url: null, error: null };
  videoJobs.set(job.id, job);
  pollVideo(job, refund);
  res.json({ jobId: job.id, cost, credits: req.user.credits });
}));

async function pollVideo(job, refund) {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 8000));
    try {
      const v = await openai.getVideo(job.openaiId);
      job.status = v.status;
      job.progress = v.progress ?? job.progress;
      if (v.status === 'completed') {
        job.url = saveAsset(await openai.downloadVideo(job.openaiId), 'mp4');
        return;
      }
      if (v.status === 'failed') {
        job.error = v.error?.message || 'Video generation failed.';
        refund('Refund (failed)');
        return;
      }
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      refund('Refund (failed)');
      return;
    }
  }
  job.status = 'failed';
  job.error = 'Timed out.';
  refund('Refund (timeout)');
}

app.get('/api/ai/video/:jobId', requireUser, (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Job not found.' });
  res.json({ status: job.status, progress: job.progress, url: job.url, error: job.error });
});

// ------------------------------------------------------------------ errors
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, _next) => {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[error]', err);
  // OpenAI auth/quota problems are the operator's, not the user's.
  const msg = status === 401 && err instanceof openai.OpenAIError ? 'The AI service is misconfigured. Please try again later.' : err.message || 'Something went wrong.';
  res.status(err instanceof openai.OpenAIError && status === 401 ? 502 : status).json({ error: msg, upgrade: err.upgrade || undefined });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startModelRefresh();
  app.listen(PORT, () => {
    console.log(`Nezos running on http://localhost:${PORT}`);
    if (!process.env.OPENAI_API_KEY) console.warn('⚠  OPENAI_API_KEY is not set — AI features will fail.');
    if (BILLING_MODE === 'demo') console.log('ℹ  BILLING_MODE=demo: plan changes are free (no payment provider connected).');
  });
}

export default app;
