// Prices, credit amounts and offer dates. Keep in sync with www/js/plans.js.

export type PlanId = 'pro' | 'lite';

export const PLANS: Record<PlanId, {
  lookupKey: string;       // Stripe price lookup key (created by scripts/stripe-setup.mjs)
  monthlyCredits: number;  // granted on every paid invoice
  trialDays?: number;      // first-time free trial
  introCoupon?: string;    // first-time discount coupon id
}> = {
  pro: { lookupKey: 'bfdi_pro_monthly', monthlyCredits: 5000, trialDays: 7 },
  lite: { lookupKey: 'bfdi_lite_monthly', monthlyCredits: 1500, introCoupon: 'BFDI_LITE_INTRO' },
};

// One-time Usage Credit packs, paid through Stripe Checkout: $1 = 60 credits (1 minute of Flash Live).
export type PackId = 'credits_5' | 'credits_10' | 'credits_20';
export const CREDIT_PACKS: Record<PackId, { usd: number; credits: number }> = {
  credits_5: { usd: 5, credits: 300 },
  credits_10: { usd: 10, credits: 600 },
  credits_20: { usd: 20, credits: 1200 },
};

export const STORE_URL = 'https://jooykoll.itch.io/bfdi-talk-ai';

export function planFromLookupKey(key: string | null | undefined): PlanId | null {
  for (const [id, p] of Object.entries(PLANS)) if (p.lookupKey === key) return id as PlanId;
  return null;
}
