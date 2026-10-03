// Pure server logic. Run: node --experimental-strip-types --test tests/billing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkoutCredits, checkoutParams, invoiceGrant, packCheckoutParams, subscriptionPatch } from '../supabase/functions/_shared/billing.ts';
import { formEncode, verifyStripeSignature } from '../supabase/functions/_shared/stripe.ts';

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

test('credit pack checkout: one-time payment priced from the pack list', () => {
  const p = packCheckoutParams({ pack: 'credits_10', userId: 'u1', email: 'a@b.c', returnUrl: 'https://x.io/p' });
  assert.equal(p.mode, 'payment');
  assert.equal(p.line_items[0].price_data.unit_amount, 1000);
  assert.match(p.line_items[0].price_data.product_data.name, /600 Usage Credits/);
  assert.deepEqual(p.metadata, { user_id: 'u1', pack: 'credits_10', credits: '600' });
  assert.equal(p.customer_creation, 'always');
});

test('credit pack webhook: only paid, full-price, known packs; one ref per session', () => {
  const s = (o = {}) => ({ id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 500, metadata: { user_id: 'u1', pack: 'credits_5', credits: '999999' }, ...o });
  assert.deepEqual(checkoutCredits(s()), { userId: 'u1', credits: 300, ref: 'checkout:cs_1' }, 'credits come from the pack, not metadata');
  assert.equal(checkoutCredits(s({ payment_status: 'unpaid' })), null);
  assert.equal(checkoutCredits(s({ mode: 'subscription' })), null);
  assert.equal(checkoutCredits(s({ amount_total: 100 })), null, 'discounted below the pack price');
  assert.equal(checkoutCredits(s({ metadata: { user_id: 'u1', pack: 'credits_1000' } })), null);
});
