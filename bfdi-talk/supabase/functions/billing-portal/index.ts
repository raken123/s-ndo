// POST -> { url } of the Stripe customer portal (cancel, switch plan, update card, invoices).
import { cors, Db, json } from '../_shared/http.ts';
import { STORE_URL } from '../_shared/plans.ts';
import { stripe } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const db = new Db();
    const user = await db.user(req);
    if (!user) return json({ error: 'Sign in first.' }, 401);
    const profile = await db.one('profiles', { id: `eq.${user.id}` }, 'stripe_customer_id');
    if (!profile?.stripe_customer_id) return json({ error: "You don't have a subscription yet." }, 404);
    // Use the portal made by scripts/stripe-setup.mjs (lets people switch Lite <-> Pro).
    const portals = await stripe<{ data: { id: string; metadata?: Record<string, string> }[] }>(
      'GET', 'billing_portal/configurations', { active: true, limit: 100 });
    const configuration = portals.data.find((c) => c.metadata?.app === 'bfdi-talk')?.id;
    const session = await stripe<{ url: string }>('POST', 'billing_portal/sessions', {
      customer: profile.stripe_customer_id, return_url: STORE_URL, configuration,
    });
    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
