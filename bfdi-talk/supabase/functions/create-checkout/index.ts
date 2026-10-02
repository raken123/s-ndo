// POST { plan: 'pro' | 'lite' } -> { url } of a Stripe Checkout page for the signed-in user.
import { cors, Db, json } from '../_shared/http.ts';
import { PLANS, STORE_URL } from '../_shared/plans.ts';
import { stripe } from '../_shared/stripe.ts';
import { checkoutParams } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = new Db();
    const user = await db.user(req);
    if (!user) return json({ error: 'Sign in first.' }, 401);
    const { plan } = await req.json().catch(() => ({}));
    if (plan !== 'pro' && plan !== 'lite') return json({ error: 'Unknown plan.' }, 400);

    const profile = await db.one('profiles', { id: `eq.${user.id}` });
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
