// Database rules against a local Supabase (`supabase start`). Run: node --test tests/db.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);

async function newUser(username) {
  const c = createClient(URL, ANON, opts);
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: 'password123', options: { data: { username } } });
  assert.ifError(error);
  return { c, id: data.user.id };
}

test('sign-up creates a profile with the username and 0 credits', async () => {
  const name = 'Bouncy' + Date.now() % 100000;
  const { c, id } = await newUser(name);
  const { data } = await c.from('profiles').select('*').single();
  assert.equal(data.id, id);
  assert.equal(data.username, name);
  assert.equal(data.credits, 0);
  assert.equal(data.plan, 'free');
});

test('taken username still creates the account (without a name)', async () => {
  const name = 'Dup' + Date.now() % 100000;
  await newUser(name);
  const { c } = await newUser(name);
  const { data } = await c.from('profiles').select('username').single();
  assert.equal(data.username, null);
  const { data: free } = await c.rpc('username_available', { p_name: name.toLowerCase() });
  assert.equal(free, false);
});

test('users cannot give themselves credits or change their row directly', async () => {
  const { c, id } = await newUser(null);
  await c.from('profiles').update({ credits: 999999, plan: 'pro' }).eq('id', id);
  const { error: rpcErr } = await c.rpc('grant_credits', { p_user: id, p_delta: 1000, p_reason: 'hack', p_ref: null });
  assert.ok(rpcErr, 'grant_credits must not be callable by users');
  const { error: insErr } = await c.from('credit_ledger').insert({ user_id: id, delta: 5, reason: 'hack' });
  assert.ok(insErr);
  const { data } = await c.from('profiles').select('credits, plan').single();
  assert.deepEqual(data, { credits: 0, plan: 'free' });
});

test('users only see their own profile', async () => {
  const a = await newUser(null);
  await newUser(null);
  const { data } = await a.c.from('profiles').select('id');
  assert.equal(data.length, 1);
  assert.equal(data[0].id, a.id);
});

test('grants are idempotent per ref and spending never goes below 0', async () => {
  const { c, id } = await newUser(null);
  const ref = 'invoice:in_' + id;
  assert.equal((await admin.rpc('grant_credits', { p_user: id, p_delta: 5000, p_reason: 'pro_monthly', p_ref: ref })).data, 5000);
  assert.equal((await admin.rpc('grant_credits', { p_user: id, p_delta: 5000, p_reason: 'pro_monthly', p_ref: ref })).data, null);
  assert.equal((await c.rpc('spend_credits', { p_amount: 30 })).data, 4970);
  const { error } = await c.rpc('spend_credits', { p_amount: -50 });
  assert.ok(error, 'negative spend rejected');
  await admin.rpc('grant_credits', { p_user: id, p_delta: -4960, p_reason: 'test', p_ref: null });
  assert.equal((await c.rpc('spend_credits', { p_amount: 25 })).data, 0);
});

test('December 23 bonus: only Lite/Pro accounts that switched before the cutoff, once', async () => {
  const pro = await newUser(null);
  const lite = await newUser(null);
  const trial = await newUser(null);
  const late = await newUser(null);
  const day = 86400e3;
  const before = new Date(Date.now() - 60 * day).toISOString();     // subscribed before the (test) cutoff
  const testCutoff = new Date(Date.now() - 30 * day).toISOString(); // a cutoff that has already passed
  const after = new Date(Date.now() - 10 * day).toISOString();      // subscribed after it
  await admin.from('profiles').update({ plan: 'pro', plan_status: 'active', subscribed_at: before }).eq('id', pro.id);
  await admin.from('profiles').update({ plan: 'lite', plan_status: 'active', subscribed_at: before }).eq('id', lite.id);
  await admin.from('profiles').update({ plan: 'pro', plan_status: 'trialing', subscribed_at: before }).eq('id', trial.id);
  await admin.from('profiles').update({ plan: 'pro', plan_status: 'active', subscribed_at: after }).eq('id', late.id);

  // Today is before the cutoff (unless this test runs after Dec 23 2026)
  if (Date.now() < Date.parse('2026-12-23T00:00:00Z')) {
    assert.equal((await pro.c.rpc('claim_dec23_bonus')).data, 0, 'nothing before Dec 23');
  }

  // Pretend it's after the cutoff by moving the cutoff into the past (needs psql + DB_URL).
  const dbUrl = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const setCutoff = (ts) => execFileSync('psql', [dbUrl, '-qc',
    `create or replace function public.dec23_cutoff() returns timestamptz language sql stable as $$ select timestamptz '${ts}' $$`]);
  setCutoff(testCutoff);
  try {
    assert.equal((await pro.c.rpc('claim_dec23_bonus')).data, 500000000);
    assert.equal((await pro.c.rpc('claim_dec23_bonus')).data, 0, 'only once');
    assert.equal((await lite.c.rpc('claim_dec23_bonus')).data, 100000);
    assert.equal((await trial.c.rpc('claim_dec23_bonus')).data, 0, 'inactive plans do not count');
    assert.equal((await late.c.rpc('claim_dec23_bonus')).data, 0, 'subscribed after the cutoff');
    const { data } = await pro.c.from('profiles').select('credits, dec23_bonus_claimed').single();
    assert.deepEqual(data, { credits: 500000000, dec23_bonus_claimed: true });
    // becomes active later -> can claim then
    await admin.from('profiles').update({ plan_status: 'active' }).eq('id', trial.id);
    assert.equal((await trial.c.rpc('claim_dec23_bonus')).data, 500000000);
  } finally {
    setCutoff('2026-12-23 00:00:00+00');
  }
});

test('switching plans is instant and free, with monthly credits once per period', async () => {
  const { c, id } = await newUser(null);
  const profile = async () => (await c.from('profiles').select('plan, plan_status, credits, subscribed_at').single()).data;

  assert.equal((await c.rpc('switch_plan', { p_plan: 'lite' })).data, 1500);
  let p = await profile();
  assert.equal(p.plan, 'lite');
  assert.equal(p.plan_status, 'active');
  assert.equal(p.credits, 1500);
  assert.ok(p.subscribed_at);
  const since = p.subscribed_at;

  // upgrading tops up to Pro's 5,000; switching around never pays the period twice
  assert.equal((await c.rpc('switch_plan', { p_plan: 'pro' })).data, 3500);
  assert.equal((await c.rpc('switch_plan', { p_plan: 'lite' })).data, 0);
  assert.equal((await c.rpc('switch_plan', { p_plan: 'pro' })).data, 0);
  assert.equal((await c.rpc('claim_monthly_credits')).data, 0);
  p = await profile();
  assert.equal(p.credits, 5000);
  assert.equal(p.subscribed_at, since, 'moving between paid plans keeps the start date');

  // a new 30-day period pays again
  await admin.from('profiles').update({ monthly_period_start: new Date(Date.now() - 31 * 86400e3).toISOString() }).eq('id', id);
  assert.equal((await c.rpc('claim_monthly_credits')).data, 5000);
  assert.equal((await profile()).credits, 10000);

  // back to Free: no monthly credits, credits stay
  assert.equal((await c.rpc('switch_plan', { p_plan: 'free' })).data, 0);
  p = await profile();
  assert.deepEqual([p.plan, p.plan_status, p.credits, p.subscribed_at], ['free', 'none', 10000, null]);

  const { error } = await c.rpc('switch_plan', { p_plan: 'ultra' });
  assert.ok(error, 'unknown plans are refused');
  const anon = createClient(URL, ANON, opts);
  assert.ok((await anon.rpc('switch_plan', { p_plan: 'pro' })).error, 'needs a signed-in user');
});
