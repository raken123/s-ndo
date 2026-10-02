// Stripe -> database. Keeps plans in sync and grants monthly credits on every paid invoice.
// Events: checkout.session.completed, customer.subscription.created/updated/deleted, invoice.paid
import { Db, env, json } from '../_shared/http.ts';
import { verifyStripeSignature } from '../_shared/stripe.ts';
import { invoiceGrant, subscriptionPatch } from '../_shared/billing.ts';

Deno.serve(async (req) => {
  const body = await req.text();
  if (!await verifyStripeSignature(body, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'))) {
    return new Response('Bad signature', { status: 400 });
  }
  const event = JSON.parse(body);
  const obj = event.data?.object ?? {};
  const db = new Db();

  const profileByCustomer = async (customer: string | undefined) => {
    return customer ? await db.one('profiles', { stripe_customer_id: `eq.${customer}` }) : null;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.client_reference_id && obj.customer) {
          await db.update('profiles', { id: `eq.${obj.client_reference_id}` }, { stripe_customer_id: obj.customer });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const deleted = event.type === 'customer.subscription.deleted';
        const { userId, patch } = subscriptionPatch(obj, deleted);
        const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        const profile = userId
          ? await db.one('profiles', { id: `eq.${userId}` })
          : await profileByCustomer(customer);
        if (!profile) break;
        // A late event about an older subscription must not overwrite the current one.
        if (profile.stripe_subscription_id && profile.stripe_subscription_id !== obj.id && patch.plan === 'free') break;
        await db.update('profiles', { id: `eq.${profile.id}` }, patch);
        break;
      }
      case 'invoice.paid': {
        const meta = (obj.parent?.subscription_details ?? obj.subscription_details ?? {}).metadata ?? {};
        const profile = meta.user_id ? await db.one('profiles', { id: `eq.${meta.user_id}` }, 'plan') : null;
        const grant = invoiceGrant(obj, profile?.plan ?? null);
        if (grant) {
          await db.rpc('grant_credits', {
            p_user: grant.userId, p_delta: grant.credits, p_reason: `${grant.plan}_monthly`, p_ref: grant.ref,
          });
        }
        break;
      }
    }
  } catch (e) {
    console.error(event.type, e);
    return json({ error: (e as Error).message }, 500); // Stripe retries
  }
  return json({ received: true });
});
