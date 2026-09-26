import crypto from 'node:crypto';

// Minimal Stripe-klient över REST (inga beroenden). Apple Pay och Google Pay går
// via Stripe: på webben med Express Checkout Element, i appen med STPApplePayContext.

function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

export function createStripe(secretKey) {
  async function call(method, path, params) {
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params ? formEncode(params) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      const err = new Error(json.error?.message || `Stripe ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  return {
    createPaymentIntent: ({ amountKr, orderId, orderNumber, email }) => call('POST', '/payment_intents', {
      amount: amountKr * 100,
      currency: 'sek',
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: `Jomni Blommor order #${orderNumber}`,
      metadata: { orderId, orderNumber },
    }),
    retrievePaymentIntent: (id) => call('GET', `/payment_intents/${encodeURIComponent(id)}`),
    createPlusCheckout: ({ userId, email, priceKr, successUrl, cancelUrl }) => call('POST', '/checkout/sessions', {
      mode: 'subscription',
      client_reference_id: userId,
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: { 0: {
        quantity: 1,
        price_data: {
          currency: 'sek', unit_amount: priceKr * 100, recurring: { interval: 'month' },
          product_data: { name: 'Jomni Plus – dubbla mynt' },
        },
      } },
      subscription_data: { metadata: { userId } },
      metadata: { userId, kind: 'plus' },
    }),
    retrieveCheckoutSession: (id) => call('GET', `/checkout/sessions/${encodeURIComponent(id)}?expand[]=subscription`),
    retrieveSubscription: (id) => call('GET', `/subscriptions/${encodeURIComponent(id)}`),
    cancelSubscriptionAtPeriodEnd: (id) => call('POST', `/subscriptions/${encodeURIComponent(id)}`, { cancel_at_period_end: true }),
  };
}

// Verifierar Stripe-Signature-headern för webhooks.
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2 && p[0] !== 'v1'),
  );
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return sigs.some((s) => s.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
