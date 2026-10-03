// Plans as shown in the app. Switching is free and instant for now (no payments).
// Monthly credits must match public.plan_monthly_credits() in supabase/migrations.

export const PLANS = {
  free: { name: 'Free', refillMinutes: 60 },
  lite: {
    name: 'Lite',
    price: '$1/month for 5 months, then $6/month',
    monthlyCredits: 1500,
    refillMinutes: 60,
    dec23Credits: 100000,
    perks: ['1,500 Usage Credits every month', 'Credits never expire', 'Bigger Playshow episodes with eliminations'],
  },
  pro: {
    name: 'Pro',
    price: '$10/month',
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

// "Be on Lite/Pro before December 23" offer (midnight UTC).
export const DEC23 = Date.parse('2026-12-23T00:00:00Z');

const PERIOD_MS = 30 * 86400e3;

/**
 * Monthly credits for a plan, once per 30-day period. Switching up mid-period tops up the
 * difference; switching back and forth never pays a period twice. (Same rules as the server.)
 * state: { periodStart, granted, ... } -> { state, owed }
 */
export function monthlyTopUp(state, plan, now = Date.now()) {
  const monthly = PLANS[plan]?.monthlyCredits || 0;
  if (!monthly) return { state, owed: 0 };
  let { periodStart = 0, granted = 0 } = state;
  if (!periodStart || now >= periodStart + PERIOD_MS) { periodStart = now; granted = 0; }
  const owed = Math.max(0, monthly - granted);
  return { state: { ...state, periodStart, granted: granted + owed }, owed };
}

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
