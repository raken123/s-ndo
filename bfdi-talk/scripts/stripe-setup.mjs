// One-time Stripe setup for BFDI Talk subscriptions. Safe to run again (skips what exists).
//
//   STRIPE_SECRET_KEY=sk_live_... SUPABASE_URL=https://xxxx.supabase.co node scripts/stripe-setup.mjs
//
// Creates:
//   - "BFDI Talk Pro"  $10/month   (price lookup key bfdi_pro_monthly)
//   - "BFDI Talk Lite" $6/month    (price lookup key bfdi_lite_monthly)
//   - coupon BFDI_LITE_INTRO: $5 off for 5 months  ->  Lite is $1/month for 5 months, then $6
//   - a customer portal (cancel, switch Lite <-> Pro, update card, invoices)
//   - the webhook to your Supabase stripe-webhook function (prints its signing secret)
// The Pro 7-day free trial is added per checkout by the create-checkout function.

const KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
if (!KEY || !SUPABASE_URL) {
  console.error('Set STRIPE_SECRET_KEY and SUPABASE_URL first.');
  process.exit(1);
}

function formEncode(obj, prefix = '') {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => parts.push(typeof item === 'object' ? formEncode(item, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`));
    } else if (typeof v === 'object') parts.push(formEncode(v, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return parts.filter(Boolean).join('&');
}

async function stripe(method, path, params = {}) {
  const qs = formEncode(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && qs ? `?${qs}` : ''}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? qs : undefined,
  });
  const data = await res.json();
  if (!res.ok && res.status !== 404) throw new Error(`${path}: ${data.error?.message}`);
  return res.ok ? data : null;
}

async function ensurePrice({ lookupKey, name, description, cents }) {
  const found = await stripe('GET', 'prices', { lookup_keys: [lookupKey], expand: ['data.product'] });
  if (found.data.length) {
    console.log(`✔ ${name}: already set up (${found.data[0].id})`);
    return found.data[0];
  }
  const product = await stripe('POST', 'products', { name, description });
  const price = await stripe('POST', 'prices', {
    product: product.id, unit_amount: cents, currency: 'usd', recurring: { interval: 'month' }, lookup_key: lookupKey,
  });
  console.log(`✔ ${name}: created ${price.id} ($${cents / 100}/month)`);
  return price;
}

const pro = await ensurePrice({
  lookupKey: 'bfdi_pro_monthly', name: 'BFDI Talk Pro', cents: 1000,
  description: 'Video & screen live, 5,000 Usage Credits every month, meter refills in 30 minutes. 7-day free trial.',
});
const lite = await ensurePrice({
  lookupKey: 'bfdi_lite_monthly', name: 'BFDI Talk Lite', cents: 600,
  description: '1,500 Usage Credits every month. $1/month for your first 5 months.',
});

if (await stripe('GET', 'coupons/BFDI_LITE_INTRO')) {
  console.log('✔ Lite intro coupon: already set up');
} else {
  await stripe('POST', 'coupons', {
    id: 'BFDI_LITE_INTRO', name: 'Lite: $1/month for 5 months', amount_off: 500, currency: 'usd',
    duration: 'repeating', duration_in_months: 5,
  });
  console.log('✔ Lite intro coupon: created ($5 off for 5 months)');
}

const productId = (p) => (typeof p.product === 'string' ? p.product : p.product.id);
const portals = await stripe('GET', 'billing_portal/configurations', { limit: 100 });
if (portals.data.some((c) => c.metadata?.app === 'bfdi-talk')) {
  console.log('✔ Customer portal: already set up');
} else {
  await stripe('POST', 'billing_portal/configurations', {
    metadata: { app: 'bfdi-talk' }, // the billing-portal function finds it by this tag
    business_profile: { headline: 'Manage your BFDI Talk subscription' },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations',
        products: [{ product: productId(pro), prices: [pro.id] }, { product: productId(lite), prices: [lite.id] }],
      },
    },
    default_return_url: 'https://jooykoll.itch.io/bfdi-talk-ai',
  });
  console.log('✔ Customer portal: configured');
}

const hookUrl = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
const hooks = await stripe('GET', 'webhook_endpoints', { limit: 100 });
if (hooks.data.some((h) => h.url === hookUrl)) {
  console.log('✔ Webhook: already set up (its signing secret was shown when it was created)');
} else {
  const hook = await stripe('POST', 'webhook_endpoints', {
    url: hookUrl,
    enabled_events: ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid'],
  });
  console.log(`✔ Webhook: created. Signing secret (save it as STRIPE_WEBHOOK_SECRET):\n\n    ${hook.secret}\n`);
}
console.log('Done!');
