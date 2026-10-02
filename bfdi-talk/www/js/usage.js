// Free usage meter + Usage Credits wallet.
//
// The meter is free: 100% lasts 20 minutes of Flash Live (Extended Thinking drains 2.5x faster).
// When it hits 0% it refills to 100% after an hour (30 minutes on Pro).
// Usage Credits are separate and have no limit: 1 credit = 1 second of Flash Live talk. They are
// spent only while the meter is empty, so you can keep talking during the refill wait.
// Credits come from the account (subscriptions, purchases) or, for guests, are kept on this device.

import { PLANS, CREDITS_PER_USD } from './plans.js';

export const USAGE = {
  FULL: 100,
  SECONDS_PER_FULL: 20 * 60,
  CREDITS_PER_USD,
  MIN_PURCHASE_USD: 5,
};

const KEY = 'bfdi.usage.v2';
const OLD_KEY = 'bfdi.usage.v1';

export class Usage extends EventTarget {
  constructor(storage = globalThis.localStorage) {
    super();
    this.storage = storage;
    this.plan = 'free';
    this.cloud = null;   // signed-in account: { credits, spend(n) }
    this.carry = 0;      // fraction of a credit not spent yet
    this.state = this.load();
    this.tick();
  }

  load() {
    try {
      const s = JSON.parse(this.storage.getItem(KEY));
      if (s && typeof s.percent === 'number') return s;
    } catch { /* fresh start */ }
    const state = { percent: USAGE.FULL, emptiedAt: 0, localCredits: 0, receipts: [] };
    // Version 1 kept bought credits inside the meter (above 100%): move them into the wallet.
    try {
      const old = JSON.parse(this.storage.getItem(OLD_KEY));
      if (old && typeof old.percent === 'number') {
        state.receipts = old.receipts || [];
        if (old.percent > USAGE.FULL) state.localCredits = Math.round((old.percent - USAGE.FULL) / 100 * USAGE.SECONDS_PER_FULL);
        state.percent = Math.min(old.percent, USAGE.FULL);
        if (old.lockedUntil > Date.now()) state.emptiedAt = old.lockedUntil - 60 * 60 * 1000;
      }
    } catch { /* ignore */ }
    return state;
  }

  save() {
    try { this.storage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage full/blocked */ }
    this.dispatchEvent(new Event('change'));
  }

  get refillMs() { return (PLANS[this.plan] || PLANS.free).refillMinutes * 60 * 1000; }
  get refillAt() { return this.state.emptiedAt ? this.state.emptiedAt + this.refillMs : 0; }
  get msLeft() { return Math.max(0, this.refillAt - Date.now()); }
  get percent() { return this.state.percent; }
  get meterEmpty() { return this.state.percent <= 0; }
  get localCredits() { return Math.floor(this.state.localCredits); }
  get credits() { return this.localCredits + (this.cloud ? Math.floor(this.cloud.credits) : 0); }
  /** Meter empty and no credits: wait for the refill. */
  get locked() { return this.meterEmpty && this.credits < 1; }

  /** Refills the meter once the wait is over. Call regularly. */
  tick(now = Date.now()) {
    if (this.state.emptiedAt && now >= this.refillAt) {
      this.state.emptiedAt = 0;
      this.state.percent = USAGE.FULL;
      this.save();
      this.dispatchEvent(new Event('refilled'));
    }
  }

  /** Spends `seconds` of talk at `cost` (2.5 for Extended Thinking). Returns false when nothing is left. */
  consume(seconds, cost = 1) {
    this.tick();
    let need = seconds * cost; // in Flash Live seconds = credits
    if (this.state.percent > 0) {
      const meterSecs = (this.state.percent / 100) * USAGE.SECONDS_PER_FULL;
      const take = Math.min(meterSecs, need);
      this.state.percent = ((meterSecs - take) / USAGE.SECONDS_PER_FULL) * 100;
      need -= take;
      if (this.state.percent <= 1e-6) {
        this.state.percent = 0;
        this.state.emptiedAt = Date.now();
        this.dispatchEvent(new Event('empty'));
      }
    }
    if (need > 0) {
      this.carry += need;
      let whole = Math.floor(this.carry);
      if (whole > 0) {
        this.carry -= whole;
        const fromLocal = Math.min(whole, this.localCredits);
        this.state.localCredits -= fromLocal;
        whole -= fromLocal;
        if (whole > 0 && this.cloud) {
          const fromCloud = Math.min(whole, Math.floor(this.cloud.credits));
          if (fromCloud > 0) this.cloud.spend(fromCloud);
          whole -= fromCloud;
        }
        if (whole > 0) this.carry = 0; // ran out mid-second
      }
    }
    this.save();
    return !this.locked;
  }

  /** Minutes of talk left on a model, meter + credits. */
  minutesLeft(cost = 1) {
    return ((this.state.percent / 100) * USAGE.SECONDS_PER_FULL + this.credits) / 60 / cost;
  }

  hasReceipt(id) { return this.state.receipts.includes(id); }

  /** Guest purchases (no account): credits kept on this device. */
  addLocalCredits(credits, ids = []) {
    this.state.localCredits += credits;
    this.state.receipts.push(...ids.filter(Boolean));
    this.save();
  }
}

export function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
