// Talk-usage meter. One shared pool for both Live models; Extended Thinking drains it faster.
// At 0% talking is locked for an hour, then the meter refills to 100%.
// Paid credits ($1 = 5%) are added on top and can take the meter above 100%.

export const USAGE = {
  FULL: 100,
  // 100% lasts this many seconds of connected talk time on Flash Live.
  SECONDS_PER_FULL: 20 * 60,
  LOCK_MS: 60 * 60 * 1000,
  PERCENT_PER_DOLLAR: 5,
  MIN_PURCHASE_USD: 5,
};

const KEY = 'bfdi.usage.v1';

export class Usage extends EventTarget {
  constructor(storage = globalThis.localStorage) {
    super();
    this.storage = storage;
    this.state = this.load();
    this.tick();
  }

  load() {
    try {
      const s = JSON.parse(this.storage.getItem(KEY));
      if (s && typeof s.percent === 'number') return s;
    } catch { /* fresh start */ }
    return { percent: USAGE.FULL, lockedUntil: 0, receipts: [] };
  }

  save() {
    try { this.storage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage full/blocked */ }
    this.dispatchEvent(new Event('change'));
  }

  /** Unlocks + refills when the hour is up. Call regularly. */
  tick(now = Date.now()) {
    if (this.state.lockedUntil && now >= this.state.lockedUntil) {
      this.state.lockedUntil = 0;
      this.state.percent = Math.max(this.state.percent, USAGE.FULL);
      this.save();
    }
  }

  get percent() { return this.state.percent; }
  get locked() { return this.state.lockedUntil > Date.now() && this.state.percent <= 0; }
  get msLeft() { return Math.max(0, this.state.lockedUntil - Date.now()); }

  /** Drain for `seconds` of talk at `costMultiplier`. Returns false once the meter hits 0. */
  consume(seconds, costMultiplier = 1) {
    if (this.locked) return false;
    const drain = (seconds / USAGE.SECONDS_PER_FULL) * USAGE.FULL * costMultiplier;
    this.state.percent = Math.max(0, this.state.percent - drain);
    if (this.state.percent <= 0) {
      this.state.percent = 0;
      this.state.lockedUntil = Date.now() + USAGE.LOCK_MS;
      this.save();
      this.dispatchEvent(new Event('empty'));
      return false;
    }
    this.save();
    return true;
  }

  /** Minutes of talk the current meter buys on a model. */
  minutesLeft(costMultiplier = 1) {
    return (this.state.percent / USAGE.FULL) * USAGE.SECONDS_PER_FULL / 60 / costMultiplier;
  }

  hasReceipt(id) { return this.state.receipts.includes(id); }

  /** Adds purchased credit. Ids (image hash, order number) stop the same receipt being used twice. */
  addCredits(usd, ids) {
    const pct = usd * USAGE.PERCENT_PER_DOLLAR;
    this.state.percent += pct;
    this.state.lockedUntil = 0; // buying credits ends the cooldown right away
    this.state.receipts.push(...ids.filter(Boolean));
    this.save();
    return pct;
  }
}

export function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
