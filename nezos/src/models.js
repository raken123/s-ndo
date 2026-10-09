// OpenAI model catalog. The static table gives known models a family, tier and
// studio role; at startup we merge in the live list from GET /v1/models so new
// models show up automatically (unknown ones land in the Elite-only tier).
import { listModels } from './openai.js';
import { PLANS } from './plans.js';

// Credit cost per request for each tier.
export const TIER_COST = {
  nano: 1, mini: 2, standard: 5, advanced: 10, frontier: 25,
  'image-mini': 3, image: 6, 'image-pro': 10, 'image-ultra': 15,
  video: 60, 'video-pro': 150, utility: 1,
};

// kind: text | image | tts | transcribe | video | moderation | api-only
const T = (id, name, tier, extra = {}) => ({ id, name, kind: 'text', tier, ...extra });

const STATIC = [
  // ---- text / code: nano
  T('gpt-5.4-nano', 'GPT-5.4 nano', 'nano', { reasoning: true }),
  T('gpt-5-nano', 'GPT-5 nano', 'nano', { reasoning: true }),
  T('gpt-4.1-nano', 'GPT-4.1 nano', 'nano'),
  T('gpt-4o-mini', 'GPT-4o mini', 'nano'),
  T('gpt-3.5-turbo', 'GPT-3.5 Turbo', 'nano', { legacy: true }),
  // ---- mini
  T('gpt-5.4-mini', 'GPT-5.4 mini', 'mini', { reasoning: true }),
  T('gpt-5-mini', 'GPT-5 mini', 'mini', { reasoning: true }),
  T('gpt-4.1-mini', 'GPT-4.1 mini', 'mini'),
  T('o4-mini', 'o4-mini', 'mini', { reasoning: true }),
  T('o3-mini', 'o3-mini', 'mini', { reasoning: true }),
  T('gpt-5.1-codex-mini', 'GPT-5.1 Codex mini', 'mini', { reasoning: true, code: true }),
  // ---- standard
  T('gpt-5', 'GPT-5', 'standard', { reasoning: true }),
  T('gpt-5.1', 'GPT-5.1', 'standard', { reasoning: true }),
  T('gpt-5.2', 'GPT-5.2', 'standard', { reasoning: true }),
  T('gpt-4.1', 'GPT-4.1', 'standard'),
  T('gpt-4o', 'GPT-4o', 'standard'),
  T('gpt-4-turbo', 'GPT-4 Turbo', 'standard', { legacy: true }),
  T('gpt-4', 'GPT-4', 'standard', { legacy: true }),
  T('gpt-5-codex', 'GPT-5 Codex', 'standard', { reasoning: true, code: true }),
  T('gpt-5.1-codex', 'GPT-5.1 Codex', 'standard', { reasoning: true, code: true }),
  T('chat-latest', 'ChatGPT latest', 'standard'),
  T('gpt-5-chat-latest', 'GPT-5 Chat', 'standard'),
  T('gpt-5.1-chat-latest', 'GPT-5.1 Chat', 'standard'),
  T('gpt-5.2-chat-latest', 'GPT-5.2 Chat', 'standard'),
  T('gpt-5.3-chat-latest', 'GPT-5.3 Chat', 'standard'),
  // ---- advanced
  T('gpt-5.5', 'GPT-5.5', 'advanced', { reasoning: true }),
  T('gpt-5.4', 'GPT-5.4', 'advanced', { reasoning: true }),
  T('o3', 'o3', 'advanced', { reasoning: true }),
  T('o1', 'o1', 'advanced', { reasoning: true }),
  T('gpt-5.3-codex', 'GPT-5.3 Codex', 'advanced', { reasoning: true, code: true }),
  T('gpt-5.2-codex', 'GPT-5.2 Codex', 'advanced', { reasoning: true, code: true }),
  T('gpt-5.1-codex-max', 'GPT-5.1 Codex Max', 'advanced', { reasoning: true, code: true }),
  // ---- frontier (Elite)
  T('gpt-6.1-sol', 'GPT-6.1 Sol', 'frontier', { reasoning: true }),
  T('gpt-6-sol', 'GPT-6 Sol', 'frontier', { reasoning: true }),
  T('gpt-6-luna', 'GPT-6 Luna', 'frontier', { reasoning: true }),
  T('gpt-6-astra', 'GPT-6 Astra', 'frontier', { reasoning: true }),
  T('gpt-5.6-sol', 'GPT-5.6 Sol', 'frontier', { reasoning: true }),
  T('gpt-5.6-luna', 'GPT-5.6 Luna', 'frontier', { reasoning: true }),
  T('gpt-5.6-terra', 'GPT-5.6 Terra', 'frontier', { reasoning: true }),
  T('gpt-5.5-pro', 'GPT-5.5 Pro', 'frontier', { reasoning: true, cost: 40 }),
  T('gpt-5.4-pro', 'GPT-5.4 Pro', 'frontier', { reasoning: true, cost: 40 }),
  T('gpt-5.2-pro', 'GPT-5.2 Pro', 'frontier', { reasoning: true, cost: 40 }),
  T('gpt-5-pro', 'GPT-5 Pro', 'frontier', { reasoning: true, cost: 40 }),
  T('o3-pro', 'o3-pro', 'frontier', { reasoning: true, cost: 40 }),
  T('o1-pro', 'o1-pro', 'frontier', { reasoning: true, cost: 60 }),

  // ---- images
  { id: 'gpt-image-1-mini', name: 'GPT Image 1 mini', kind: 'image', tier: 'image-mini' },
  { id: 'gpt-image-1', name: 'GPT Image 1', kind: 'image', tier: 'image' },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5', kind: 'image', tier: 'image' },
  { id: 'gpt-image-2', name: 'GPT Image 2', kind: 'image', tier: 'image-pro' },
  { id: 'chatgpt-image-latest', name: 'ChatGPT Image latest', kind: 'image', tier: 'image-pro' },
  { id: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare', kind: 'image', tier: 'image-ultra' },
  { id: 'gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst', kind: 'image', tier: 'image-ultra' },
  { id: 'dall-e-3', name: 'DALL·E 3', kind: 'image', tier: 'image', legacy: true },
  { id: 'dall-e-2', name: 'DALL·E 2', kind: 'image', tier: 'image-mini', legacy: true },

  // ---- video
  { id: 'sora-2', name: 'Sora 2', kind: 'video', tier: 'video' },
  { id: 'sora-2-pro', name: 'Sora 2 Pro', kind: 'video', tier: 'video-pro' },

  // ---- speech (game voice lines / narration)
  { id: 'gpt-4o-mini-tts', name: 'GPT-4o mini TTS', kind: 'tts', tier: 'utility', cost: 2 },
  { id: 'tts-1', name: 'TTS-1', kind: 'tts', tier: 'utility', cost: 2 },
  { id: 'tts-1-hd', name: 'TTS-1 HD', kind: 'tts', tier: 'utility', cost: 3 },

  // ---- transcription (voice prompts in the chat bar)
  { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o mini Transcribe', kind: 'transcribe', tier: 'utility' },
  { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe', kind: 'transcribe', tier: 'utility', cost: 2 },
  { id: 'gpt-transcribe', name: 'GPT Transcribe', kind: 'transcribe', tier: 'utility', cost: 2 },
  { id: 'gpt-4o-transcribe-diarize', name: 'GPT-4o Transcribe Diarize', kind: 'transcribe', tier: 'utility', cost: 2 },
  { id: 'whisper-1', name: 'Whisper', kind: 'transcribe', tier: 'utility' },

  // ---- used internally
  { id: 'omni-moderation-latest', name: 'Omni Moderation', kind: 'moderation', tier: 'utility', cost: 0 },
];

// Families that exist in the API but don't fit the studio's request shapes.
function guessApiOnly(id) {
  if (/embedding/.test(id)) return 'Embeddings';
  if (/realtime|^gpt-live/.test(id)) return 'Realtime (WebRTC/WebSocket)';
  if (/search/.test(id)) return 'Web search';
  if (/deep-research/.test(id)) return 'Deep research';
  if (/^gpt-audio/.test(id)) return 'Audio chat';
  if (/^(babbage|davinci)|instruct/.test(id)) return 'Legacy completions';
  if (/moderation/.test(id)) return 'Moderation';
  return null;
}

function guessFromId(id) {
  const apiOnly = guessApiOnly(id);
  if (apiOnly) return { id, name: id, kind: 'api-only', tier: 'frontier', apiOnly };
  if (/image/.test(id)) return { id, name: id, kind: 'image', tier: 'image-ultra' };
  if (/^sora/.test(id)) return { id, name: id, kind: 'video', tier: 'video-pro' };
  if (/tts/.test(id)) return { id, name: id, kind: 'tts', tier: 'utility', cost: 2 };
  if (/transcribe|whisper/.test(id)) return { id, name: id, kind: 'transcribe', tier: 'utility' };
  // Anything else new from OpenAI is treated as a frontier text model.
  return { id, name: id, kind: 'text', tier: 'frontier', reasoning: /^(gpt-[5-9]|o\d)/.test(id), discovered: true };
}

const SNAPSHOT = /^(.*)-(\d{4}-\d{2}-\d{2}|\d{4})$/;

const byId = new Map(STATIC.map((m) => [m.id, { ...m, available: null }]));
let liveIds = null;
let lastRefresh = 0;

// Some kinds are also gated by a plan feature flag.
const FEATURE_FOR_KIND = { tts: 'audio', transcribe: 'voiceInput', video: 'video' };

export function canUse(plan, model) {
  if (!plan.tiers.includes(model.tier)) return false;
  const f = FEATURE_FOR_KIND[model.kind];
  return !f || !!plan.features[f];
}

function decorate(m) {
  const plan = PLANS.find((p) => canUse(p, m)) || PLANS[PLANS.length - 1];
  return {
    ...m,
    cost: m.cost ?? TIER_COST[m.tier] ?? 5,
    minPlan: plan.id,
    minPlanName: plan.name,
    studio: ['text', 'image', 'tts', 'transcribe', 'video'].includes(m.kind),
  };
}

export async function refreshModels() {
  try {
    const ids = await listModels();
    liveIds = new Set(ids);
    lastRefresh = Date.now();
    for (const m of byId.values()) m.available = liveIds.has(m.id);
    for (const id of ids) {
      if (byId.has(id)) continue;
      const snap = id.match(SNAPSHOT);
      const base = snap && byId.get(snap[1]);
      if (base) {
        byId.set(id, { ...base, id, name: `${base.name} (${snap[2]})`, snapshotOf: base.id, available: true });
      } else {
        byId.set(id, { ...guessFromId(id), available: true });
      }
    }
    console.log(`[models] ${ids.length} live OpenAI models loaded`);
  } catch (err) {
    console.warn('[models] could not load live model list:', err.message);
  }
}

export function startModelRefresh() {
  refreshModels();
  setInterval(refreshModels, 6 * 60 * 60 * 1000).unref();
}

export function getModel(id) {
  const m = byId.get(id);
  return m ? decorate(m) : null;
}

export function allModels() {
  return [...byId.values()]
    .filter((m) => m.available !== false || !liveIds) // hide catalogue entries OpenAI no longer serves
    .map(decorate);
}

export const DEFAULT_TEXT_MODEL = {
  free: 'gpt-5.4-nano',
  mini: 'gpt-5.4-mini',
  starter: 'gpt-5.1',
  pro: 'gpt-5.5',
  elite: 'gpt-6.1-sol',
};

export const DEFAULT_IMAGE_MODEL = {
  free: 'gpt-image-1-mini',
  mini: 'gpt-image-1-mini',
  starter: 'gpt-image-1.5',
  pro: 'gpt-image-2',
  elite: 'gpt-image-2',
};

export function modelsStatus() {
  return { live: !!liveIds, lastRefresh, plans: PLANS.map((p) => p.id) };
}
