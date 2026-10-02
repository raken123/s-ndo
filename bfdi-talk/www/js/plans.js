// Subscription plans as shown in the app. Prices/credits must match
// supabase/functions/_shared/plans.ts and scripts/stripe-setup.mjs.

export const PLANS = {
  free: { name: 'Free', refillMinutes: 60 },
  lite: {
    name: 'Lite',
    price: '$1/month for 5 months',
    after: 'then $6/month',
    monthlyCredits: 1500,
    refillMinutes: 60,
    dec23Credits: 100000,
    perks: ['1,500 Usage Credits every month', 'Credits never expire', 'Cancel any time'],
  },
  pro: {
    name: 'Pro',
    price: '$10/month',
    after: '7-day free trial',
    monthlyCredits: 5000,
    refillMinutes: 30,
    dec23Credits: 500000000,
    perks: [
      '📷 Video live: your character sees you through the camera',
      '🖥️ Screen live: show your screen and talk about it',
      '5,000 Usage Credits every month',
      'Usage meter refills in 30 minutes instead of 1 hour',
      '👑 Gold PRO crown',
    ],
  },
};

// "Subscribe before December 23" offer (midnight UTC).
export const DEC23 = Date.parse('2026-12-23T00:00:00Z');

// 1 Usage Credit = 1 second of Flash Live talk. Extended Thinking spends 2.5 per second.
export const CREDITS_PER_USD = 60;

export function formatCredits(n) {
  n = Math.floor(n);
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  return n.toLocaleString('en-US');
}

export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}
