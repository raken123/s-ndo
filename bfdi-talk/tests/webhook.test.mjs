// Stripe webhook against local Supabase + `supabase functions serve` (STRIPE_WEBHOOK_SECRET=whsec_test_local123).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_local123';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const now = Math.floor(Date.now() / 1000);

async function newUser() {
  const c = createClient(URL, process.env.SUPABASE_ANON_KEY, opts);
  const { data, error } = await c.auth.signUp({ email: `w${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'password123' });
  assert.ifError(error);
  return { c, id: data.user.id };
}

async function send(type, object, { secret = SECRET } = {}) {
  const body = JSON.stringify({ id: 'evt_' + Math.random().toString(36).slice(2), type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  const res = await fetch(`${URL}/functions/v1/stripe-webhook`, {
    method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=${sig}`, 'content-type': 'application/json' },
  });
  return res.status;
}

const profile = async (c) => (await c.from('profiles').select('*').single()).data;

function sub({ id, userId, plan, status, trialEnd = null, discount = false }) {
  return {
    id, object: 'subscription', customer: 'cus_' + userId.slice(0, 8), status, created: now - 60,
    trial_end: trialEnd, metadata: { user_id: userId, plan },
    discounts: discount ? ['di_123'] : [],
    items: { data: [{ current_period_end: now + 30 * 86400, price: { id: 'price_x', lookup_key: `bfdi_${plan}_monthly` } }] },
  };
}

function invoice({ id, userId, plan, amountPaid }) {
  return {
    id, object: 'invoice', amount_paid: amountPaid,
    parent: { subscription_details: { subscription: 'sub_x', metadata: { user_id: userId, plan } } },
    lines: { data: [{ pricing: { price_details: { price: 'price_x' } } }] },
  };
}

test('rejects events with a bad signature', async () => {
  assert.equal(await send('invoice.paid', {}, { secret: 'whsec_wrong' }), 400);
});

test('Pro: free trial gives Pro but no credits; each paid month gives 5000 once', async () => {
  const { c, id } = await newUser();
  assert.equal(await send('checkout.session.completed', { client_reference_id: id, customer: 'cus_' + id.slice(0, 8) }), 200);
  assert.equal(await send('customer.subscription.created', sub({ id: 'sub_p' + id, userId: id, plan: 'pro', status: 'trialing', trialEnd: now + 7 * 86400 })), 200);
  assert.equal(await send('invoice.paid', invoice({ id: 'in_trial' + id, userId: id, plan: 'pro', amountPaid: 0 })), 200);
  let p = await profile(c);
  assert.equal(p.plan, 'pro');
  assert.equal(p.plan_status, 'trialing');
  assert.equal(p.pro_trial_used, true);
  assert.ok(p.trial_ends_at);
  assert.equal(p.credits, 0);

  await send('customer.subscription.updated', sub({ id: 'sub_p' + id, userId: id, plan: 'pro', status: 'active' }));
  await send('invoice.paid', invoice({ id: 'in_m1' + id, userId: id, plan: 'pro', amountPaid: 1000 }));
  await send('invoice.paid', invoice({ id: 'in_m1' + id, userId: id, plan: 'pro', amountPaid: 1000 })); // Stripe retry
  p = await profile(c);
  assert.equal(p.plan_status, 'active');
  assert.equal(p.credits, 5000);

  await send('invoice.paid', invoice({ id: 'in_m2' + id, userId: id, plan: 'pro', amountPaid: 1000 }));
  assert.equal((await profile(c)).credits, 10000);
});

test('Lite: $1 intro month gives 1500 credits and marks the intro as used', async () => {
  const { c, id } = await newUser();
  await send('customer.subscription.created', sub({ id: 'sub_l' + id, userId: id, plan: 'lite', status: 'active', discount: true }));
  await send('invoice.paid', invoice({ id: 'in_l1' + id, userId: id, plan: 'lite', amountPaid: 100 }));
  const p = await profile(c);
  assert.equal(p.plan, 'lite');
  assert.equal(p.lite_intro_used, true);
  assert.equal(p.credits, 1500);
});

test('first invoice arriving before the subscription event still grants the right plan', async () => {
  const { c, id } = await newUser();
  await send('invoice.paid', invoice({ id: 'in_early' + id, userId: id, plan: 'lite', amountPaid: 100 }));
  assert.equal((await profile(c)).credits, 1500);
});

test('cancelling drops to free but keeps credits; a stale delete for an old sub is ignored', async () => {
  const { c, id } = await newUser();
  await send('customer.subscription.created', sub({ id: 'sub_old' + id, userId: id, plan: 'lite', status: 'active' }));
  await send('invoice.paid', invoice({ id: 'in_c1' + id, userId: id, plan: 'lite', amountPaid: 600 }));
  await send('customer.subscription.created', sub({ id: 'sub_new' + id, userId: id, plan: 'pro', status: 'active' }));
  await send('customer.subscription.deleted', sub({ id: 'sub_old' + id, userId: id, plan: 'lite', status: 'canceled' }));
  let p = await profile(c);
  assert.equal(p.plan, 'pro', 'old subscription ending must not cancel the new one');

  await send('customer.subscription.deleted', sub({ id: 'sub_new' + id, userId: id, plan: 'pro', status: 'canceled' }));
  p = await profile(c);
  assert.equal(p.plan, 'free');
  assert.equal(p.plan_status, 'canceled');
  assert.equal(p.credits, 1500, 'credits are kept after cancelling');
});

async function callFn(name, body, token) {
  const res = await fetch(`${URL}/functions/v1/${name}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('checkout and receipt functions need a signed-in user; checkout refuses a second plan', async () => {
  assert.equal((await callFn('create-checkout', { plan: 'pro' })).status, 401);
  assert.equal((await callFn('verify-receipt', { image: 'x', mimeType: 'image/png' })).status, 401);
  const { c, id } = await newUser();
  const token = (await c.auth.getSession()).data.session.access_token;
  assert.equal((await callFn('create-checkout', { plan: 'gold' }, token)).status, 400);
  await admin.from('profiles').update({ plan: 'lite', plan_status: 'active' }).eq('id', id);
  const r = await callFn('create-checkout', { plan: 'pro' }, token);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /Manage subscription/);
  assert.equal((await callFn('billing-portal', {}, token)).status, 404, 'no Stripe customer yet');
});
