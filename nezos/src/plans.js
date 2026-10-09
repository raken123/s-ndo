// Subscription plans. `tiers` lists the model tiers a plan unlocks (see models.js).
// Every new account receives SIGNUP_CREDITS once, regardless of plan.
export const SIGNUP_CREDITS = 100;

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    monthlyCredits: 0,
    maxProjects: 3,
    tagline: 'Try Nezos with 100 starter credits.',
    tiers: ['nano', 'image-mini', 'utility'],
    features: { playtest: false, audio: false, video: false, voiceInput: false, export: true },
    highlights: ['100 credits on sign-up', '3 projects', 'Nano text models', 'GPT Image 1 mini', 'Export to HTML'],
  },
  {
    id: 'mini',
    name: 'Mini',
    price: 5,
    monthlyCredits: 500,
    maxProjects: 10,
    tagline: 'For hobby games and weekend jams.',
    tiers: ['nano', 'mini', 'image-mini', 'utility'],
    features: { playtest: true, audio: true, video: false, voiceInput: false, export: true },
    highlights: ['+500 credits / month', '10 projects', 'Mini models (GPT-5.4 mini, o4-mini…)', 'AI playtesting', 'AI voice & narration'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 15,
    monthlyCredits: 1500,
    maxProjects: 25,
    tagline: 'Ship complete games with flagship models.',
    tiers: ['nano', 'mini', 'standard', 'image-mini', 'image', 'utility'],
    features: { playtest: true, audio: true, video: false, voiceInput: true, export: true },
    highlights: ['+1,500 credits / month', '25 projects', 'GPT-5, GPT-5.1, GPT-4.1, GPT-4o', 'GPT Image 1 & 1.5', 'Voice prompts'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 40,
    monthlyCredits: 5000,
    maxProjects: 100,
    tagline: 'Reasoning models and AI video for serious creators.',
    tiers: ['nano', 'mini', 'standard', 'advanced', 'image-mini', 'image', 'image-pro', 'video', 'utility'],
    features: { playtest: true, audio: true, video: true, voiceInput: true, export: true },
    highlights: ['+5,000 credits / month', '100 projects', 'GPT-5.5, GPT-5.4, o3, Codex models', 'GPT Image 2', 'Sora 2 cutscenes'],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 100,
    monthlyCredits: 20000,
    maxProjects: Infinity,
    tagline: 'Every OpenAI model, including frontier and Pro.',
    tiers: ['nano', 'mini', 'standard', 'advanced', 'frontier', 'image-mini', 'image', 'image-pro', 'image-ultra', 'video', 'video-pro', 'utility'],
    features: { playtest: true, audio: true, video: true, voiceInput: true, export: true },
    highlights: ['+20,000 credits / month', 'Unlimited projects', 'GPT-6, GPT-5.6, all Pro models', 'GPT Image 2.5', 'Sora 2 Pro', 'New models on day one'],
  },
];

export const planById = (id) => PLANS.find((p) => p.id === id) || PLANS[0];

export const publicPlan = (p) => ({ ...p, maxProjects: Number.isFinite(p.maxProjects) ? p.maxProjects : null });
