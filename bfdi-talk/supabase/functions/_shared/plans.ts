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

// One-time Usage Credits bought on itch.io: $1 = 60 credits (= 1 minute of Flash Live).
export const CREDITS_PER_USD = 60;
export const MIN_PURCHASE_USD = 5;

export const STORE_URL = 'https://jooykoll.itch.io/bfdi-talk-ai';

export function planFromLookupKey(key: string | null | undefined): PlanId | null {
  for (const [id, p] of Object.entries(PLANS)) if (p.lookupKey === key) return id as PlanId;
  return null;
}
