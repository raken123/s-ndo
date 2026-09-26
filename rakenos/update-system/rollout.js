/*
 * Staged rollout.
 *
 * Every device keeps an anonymous, random rollout identifier that is generated
 * once and stored locally. It contains no personal data and no hardware
 * information. The identifier maps to a stable bucket (0–99), and the bucket
 * maps to a rollout group (A–D) according to the share of each phase.
 *
 * All groups receive exactly the same RakenOS version; only the day differs.
 */

export const ROLLOUT_GROUPS = [
  { group: 'A', share: 10 },
  { group: 'B', share: 25 },
  { group: 'C', share: 30 },
  { group: 'D', share: 35 },
];

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// FNV-1a — small, stable and good enough for bucketing.
export function bucketFor(id) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 100;
}

export function groupForBucket(bucket, groups = ROLLOUT_GROUPS) {
  let acc = 0;
  for (const g of groups) { acc += g.share; if (bucket < acc) return g.group; }
  return groups[groups.length - 1].group;
}

export class RolloutIdentity {
  constructor(storage, key = 'rakenos.rollout') {
    this.storage = storage; this.key = key;
    let rec = storage.get(key);
    if (!rec || typeof rec.id !== 'string' || rec.id.length < 16) {
      rec = { id: randomHex(16), createdAt: Date.now() };
      storage.set(key, rec);
    }
    this.record = rec;
  }
  get id() { return this.record.id; }
  get bucket() { return bucketFor(this.record.id); }
  get group() { return groupForBucket(this.bucket); }
  reset() {
    this.record = { id: randomHex(16), createdAt: Date.now() };
    this.storage.set(this.key, this.record);
    return this.group;
  }
}

/*
 * Decides whether a device in `group` may receive `release`.
 *   publishedAt — when the release became available to this device's channel
 *   now, dayMs  — clock and the length of one rollout day
 */
export function rolloutStatus(release, group, publishedAt, now, dayMs) {
  const phases = (release.rollout && release.rollout.phases) || [{ group, offsetDays: 0 }];
  const phase = phases.find((p) => p.group === group) || phases[phases.length - 1];
  const eligibleAt = publishedAt + phase.offsetDays * dayMs;
  const elapsedDays = Math.max(0, Math.floor((now - publishedAt) / dayMs));
  const openGroups = phases.filter((p) => p.offsetDays <= elapsedDays).map((p) => p.group);
  return {
    group,
    phase,
    eligibleAt,
    eligible: now >= eligibleAt,
    rolloutDay: elapsedDays,
    openGroups,
    complete: openGroups.length === phases.length,
  };
}
