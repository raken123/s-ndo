// POST { plan: 'pro' | 'lite' } or { pack: 'credits_5' | 'credits_10' | 'credits_20' }
// -> { url } of a Stripe Checkout page for the signed-in user.
import { cors, Db, json } from '../_shared/http.ts';
import { CREDIT_PACKS, PLANS, STORE_URL, type PackId } from '../_shared/plans.ts';
import { stripe } from '../_shared/stripe.ts';
import { checkoutParams, packCheckoutParams } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = new Db();
    const user = await db.user(req);
    if (!user) return json({ error: 'Sign in first.' }, 401);
    const { plan, pack } = await req.json().catch(() => ({}));
    const profile = await db.one('profiles', { id: `eq.${user.id}` });

    if (pack !== undefined) {
      if (!(pack in CREDIT_PACKS)) return json({ error: 'Unknown credit pack.' }, 400);
      const session = await stripe<{ url: string }>('POST', 'checkout/sessions', packCheckoutParams({
        pack: pack as PackId, userId: user.id, email: user.email, customerId: profile?.stripe_customer_id, returnUrl: STORE_URL,
      }));
      return json({ url: session.url });
    }
    if (plan !== 'pro' && plan !== 'lite') return json({ error: 'Unknown plan.' }, 400);

    if (profile && profile.plan !== 'free' && ['trialing', 'active', 'past_due'].includes(profile.plan_status)) {
      return json({ error: `You already have BFDI Talk ${profile.plan === 'pro' ? 'Pro' : 'Lite'}. Use "Manage subscription" to switch or cancel.` }, 409);
    }

    const prices = await stripe<{ data: { id: string }[] }>('GET', 'prices', { lookup_keys: [PLANS[plan].lookupKey], active: true });
    if (!prices.data?.length) return json({ error: 'This plan is not set up in Stripe yet.' }, 500);

    const session = await stripe<{ url: string }>('POST', 'checkout/sessions', checkoutParams({
      plan, priceId: prices.data[0].id, userId: user.id, email: user.email,
      customerId: profile?.stripe_customer_id, trialUsed: !!profile?.pro_trial_used,
      introUsed: !!profile?.lite_intro_used, returnUrl: STORE_URL,
    }));
    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
