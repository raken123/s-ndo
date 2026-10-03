// Pure helpers that turn Stripe objects into database changes (unit-tested in billing_test.ts).
import { CREDIT_PACKS, PLANS, type PackId, type PlanId, planFromLookupKey } from './plans.ts';

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

const ENTITLED = new Set(['trialing', 'active', 'past_due']);
const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Plan of a subscription: from its price lookup key, else the metadata we set at checkout. */
export function subscriptionPlan(sub: Obj): PlanId | null {
  for (const item of sub.items?.data ?? []) {
    const p = planFromLookupKey(item.price?.lookup_key);
    if (p) return p;
  }
  const m = sub.metadata?.plan;
  return m === 'pro' || m === 'lite' ? m : null;
}

/** Profile columns to write for a customer.subscription.* event. */
export function subscriptionPatch(sub: Obj, deleted = false): { userId: string | null; patch: Obj } {
  const plan = subscriptionPlan(sub);
  const status: string = deleted ? 'canceled' : sub.status;
  const entitled = !deleted && ENTITLED.has(status) && plan !== null;
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const patch: Obj = {
    plan: entitled ? plan : 'free',
    plan_status: status,
    stripe_subscription_id: entitled ? sub.id : null,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    trial_ends_at: entitled ? iso(sub.trial_end) : null,
    current_period_end: entitled ? iso(periodEnd) : null,
    subscribed_at: entitled ? iso(sub.created) : null,
  };
  if (plan === 'pro' && sub.trial_end) patch.pro_trial_used = true;
  if (plan === 'lite' && (sub.discount || sub.discounts?.length)) patch.lite_intro_used = true;
  return { userId: sub.metadata?.user_id ?? null, patch };
}

/** Monthly credits for an invoice.paid event, or null when nothing should be granted. */
export function invoiceGrant(inv: Obj, profilePlan: string | null): { userId: string; plan: PlanId; credits: number; ref: string } | null {
  if (!inv.amount_paid || inv.amount_paid <= 0) return null; // $0 trial invoices give no credits
  const details = inv.parent?.subscription_details ?? inv.subscription_details ?? {};
  const meta = details.metadata ?? {};
  const userId: string | undefined = meta.user_id;
  if (!userId) return null;
  let plan: PlanId | null = null;
  for (const line of inv.lines?.data ?? []) {
    plan = planFromLookupKey(line.price?.lookup_key ?? line.pricing?.price_details?.lookup_key);
    if (plan) break;
  }
  if (!plan && (profilePlan === 'pro' || profilePlan === 'lite')) plan = profilePlan;
  if (!plan && (meta.plan === 'pro' || meta.plan === 'lite')) plan = meta.plan;
  if (!plan) return null;
  return { userId, plan, credits: PLANS[plan].monthlyCredits, ref: `invoice:${inv.id}` };
}

/** Parameters for a Stripe Checkout Session. */
export function checkoutParams(opts: {
  plan: PlanId; priceId: string; userId: string; email?: string; customerId?: string | null;
  trialUsed: boolean; introUsed: boolean; returnUrl: string;
}): Obj {
  const p = PLANS[opts.plan];
  const params: Obj = {
    mode: 'subscription',
    line_items: [{ price: opts.priceId, quantity: 1 }],
    client_reference_id: opts.userId,
    success_url: `${opts.returnUrl}?bfdi=subscribed`,
    cancel_url: `${opts.returnUrl}?bfdi=canceled`,
    subscription_data: { metadata: { user_id: opts.userId, plan: opts.plan } },
    metadata: { user_id: opts.userId, plan: opts.plan },
  };
  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  if (p.trialDays && !opts.trialUsed) params.subscription_data.trial_period_days = p.trialDays;
  if (p.introCoupon && !opts.introUsed) params.discounts = [{ coupon: p.introCoupon }];
  else params.allow_promotion_codes = true;
  return params;
}

/** Parameters for a one-time Checkout Session that buys a credit pack. */
export function packCheckoutParams(opts: {
  pack: PackId; userId: string; email?: string; customerId?: string | null; returnUrl: string;
}): Obj {
  const p = CREDIT_PACKS[opts.pack];
  const meta = { user_id: opts.userId, pack: opts.pack, credits: String(p.credits) };
  const params: Obj = {
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: p.usd * 100,
        product_data: { name: `BFDI Talk — ${p.credits.toLocaleString('en-US')} Usage Credits` },
      },
    }],
    client_reference_id: opts.userId,
    success_url: `${opts.returnUrl}?bfdi=credits`,
    cancel_url: `${opts.returnUrl}?bfdi=canceled`,
    metadata: meta,
    payment_intent_data: { metadata: meta },
  };
  if (opts.customerId) params.customer = opts.customerId;
  else {
    if (opts.email) params.customer_email = opts.email;
    params.customer_creation = 'always'; // so receipts and the portal work later
  }
  return params;
}

/** Credits to add for a completed one-time Checkout, or null (unpaid, subscription, unknown pack). */
export function checkoutCredits(session: Obj): { userId: string; credits: number; ref: string } | null {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return null;
  const userId = session.metadata?.user_id || session.client_reference_id;
  const pack = CREDIT_PACKS[session.metadata?.pack as PackId];
  if (!userId || !pack) return null;
  // Trust the pack's price list, not a number in metadata, and check Stripe charged the full price.
  if (typeof session.amount_total === 'number' && session.amount_total < pack.usd * 100) return null;
  return { userId, credits: pack.credits, ref: `checkout:${session.id}` };
}
