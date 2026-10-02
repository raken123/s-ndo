import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Usage, USAGE } from '../www/js/usage.js';

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};
const cloudWallet = (credits) => ({ credits, spent: 0, spend(n) { this.credits -= n; this.spent += n; } });

test('meter: 20 minutes of Flash Live, Extended Thinking 2.5x faster', () => {
  const u = new Usage(mem());
  u.consume(60, 1);
  assert.equal(Math.round(u.percent * 100) / 100, 95);
  u.consume(60, 2.5);
  assert.equal(Math.round(u.percent * 100) / 100, 82.5);
});

test('empty meter with no credits locks; refills after 1 hour (free) or 30 minutes (pro)', () => {
  const u = new Usage(mem());
  assert.equal(u.consume(USAGE.SECONDS_PER_FULL + 5, 1), false);
  assert.equal(u.locked, true);
  assert.ok(Math.abs(u.msLeft - 60 * 60e3) < 2000);
  u.plan = 'pro';
  assert.ok(Math.abs(u.msLeft - 30 * 60e3) < 2000, 'Pro refills in 30 minutes');
  u.tick(Date.now() + 31 * 60e3);
  assert.equal(u.percent, 100);
  assert.equal(u.locked, false);
});

test('credits are spent only once the meter is empty, local first then account', () => {
  const u = new Usage(mem());
  u.addLocalCredits(10);
  const cloud = cloudWallet(1000);
  u.cloud = cloud;
  u.consume(USAGE.SECONDS_PER_FULL - 1, 1);
  assert.equal(cloud.spent, 0);
  assert.equal(u.localCredits, 10);
  assert.equal(u.consume(31, 1), true);   // 1 s of meter, then 10 local + 20 cloud
  assert.equal(u.meterEmpty, true);
  assert.equal(u.localCredits, 0);
  assert.equal(cloud.spent, 20);
  assert.equal(u.locked, false, 'credits left, keep talking during the refill wait');
  u.consume(10, 2.5);                        // Extended Thinking: 25 credits
  assert.equal(cloud.spent, 45);
});

test('running out of credits locks', () => {
  const u = new Usage(mem());
  u.cloud = cloudWallet(5);
  assert.equal(u.consume(USAGE.SECONDS_PER_FULL + 10, 1), false);
  assert.equal(u.cloud.credits, 0);
  assert.equal(u.locked, true);
});

test('infinite-ish balances work (500,000,000 credits)', () => {
  const u = new Usage(mem());
  u.cloud = cloudWallet(500_000_000);
  u.consume(USAGE.SECONDS_PER_FULL + 3600, 2.5);
  assert.equal(u.cloud.credits, 500_000_000 - 10800); // (1200 + 3600) s x 2.5 = 12000, the meter covers 1200
  assert.ok(u.minutesLeft(1) > 8_000_000);
});

test('version 1 data: bought % above 100 becomes credits', () => {
  const u = new Usage(mem({ 'bfdi.usage.v1': JSON.stringify({ percent: 125, lockedUntil: 0, receipts: ['img:abc'] }) }));
  assert.equal(u.percent, 100);
  assert.equal(u.localCredits, 300);       // 25% of 20 min = 5 min = 300 s
  assert.equal(u.hasReceipt('img:abc'), true);
});
