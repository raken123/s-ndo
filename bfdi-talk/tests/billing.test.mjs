// Pure server logic. Run: node --experimental-strip-types --test tests/billing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkoutParams, invoiceGrant, subscriptionPatch } from '../supabase/functions/_shared/billing.ts';
import { formEncode, verifyStripeSignature } from '../supabase/functions/_shared/stripe.ts';
import { judge } from '../supabase/functions/_shared/receipt.ts';

const base = { priceId: 'price_1', userId: 'u1', email: 'a@b.c', customerId: null, returnUrl: 'https://x.io/p' };

test('Pro checkout: 7-day trial only the first time', () => {
  const first = checkoutParams({ ...base, plan: 'pro', trialUsed: false, introUsed: false });
  assert.equal(first.subscription_data.trial_period_days, 7);
  assert.equal(first.mode, 'subscription');
  assert.deepEqual(first.subscription_data.metadata, { user_id: 'u1', plan: 'pro' });
  const again = checkoutParams({ ...base, plan: 'pro', trialUsed: true, introUsed: false });
  assert.equal(again.subscription_data.trial_period_days, undefined);
});

test('Lite checkout: $5-off-for-5-months coupon only the first time', () => {
  const first = checkoutParams({ ...base, plan: 'lite', trialUsed: false, introUsed: false });
  assert.deepEqual(first.discounts, [{ coupon: 'BFDI_LITE_INTRO' }]);
  assert.equal(first.allow_promotion_codes, undefined, 'Stripe forbids discounts + promotion codes together');
  const again = checkoutParams({ ...base, plan: 'lite', trialUsed: false, introUsed: true });
  assert.equal(again.discounts, undefined);
});

test('existing Stripe customer is reused instead of the email', () => {
  const p = checkoutParams({ ...base, plan: 'pro', customerId: 'cus_9', trialUsed: true, introUsed: true });
  assert.equal(p.customer, 'cus_9');
  assert.equal(p.customer_email, undefined);
});

test('form encoding matches Stripe nesting', () => {
  const s = decodeURIComponent(formEncode({ line_items: [{ price: 'p', quantity: 1 }], subscription_data: { metadata: { user_id: 'u' } }, lookup_keys: ['a'] }));
  assert.equal(s, 'line_items[0][price]=p&line_items[0][quantity]=1&subscription_data[metadata][user_id]=u&lookup_keys[0]=a');
});

test('webhook signature check', async () => {
  const body = '{"a":1}', t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', 'whsec_x').update(`${t}.${body}`).digest('hex');
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_x'), true);
  assert.equal(await verifyStripeSignature(body + ' ', `t=${t},v1=${sig}`, 'whsec_x'), false);
  assert.equal(await verifyStripeSignature(body, `t=${t - 1000},v1=${sig}`, 'whsec_x'), false, 'old timestamps are replays');
  assert.equal(await verifyStripeSignature(body, null, 'whsec_x'), false);
});

test('past_due keeps the plan; incomplete does not', () => {
  const s = (status) => ({ id: 's', status, customer: 'c', created: 1, metadata: { user_id: 'u', plan: 'pro' }, items: { data: [] } });
  assert.equal(subscriptionPatch(s('past_due')).patch.plan, 'pro');
  assert.equal(subscriptionPatch(s('incomplete')).patch.plan, 'free');
});

test('$0 invoices (free trial) grant nothing', () => {
  assert.equal(invoiceGrant({ id: 'i', amount_paid: 0, parent: { subscription_details: { metadata: { user_id: 'u', plan: 'pro' } } } }, 'pro'), null);
});

const report = (o = {}) => ({
  is_payment_confirmation: true, is_itch_io: true, product_matches: true, seller_matches: true,
  amount_paid: 10, currency: 'USD', order_id: 'ABC123', looks_edited: false, reason: 'ok', ...o,
});

test('receipt: $10 on itch.io = 600 credits, order id becomes a one-time ref', () => {
  assert.deepEqual(judge(report()), { ok: true, usd: 10, credits: 600, orderRef: 'order:abc123' });
});

test('receipt rejections', () => {
  assert.equal(judge(report({ amount_paid: 3 })).ok, false);
  assert.equal(judge(report({ currency: 'EUR' })).ok, false);
  assert.equal(judge(report({ looks_edited: true })).ok, false);
  assert.equal(judge(report({ is_itch_io: false })).ok, false);
  assert.equal(judge(report({ is_payment_confirmation: false })).ok, false);
});
