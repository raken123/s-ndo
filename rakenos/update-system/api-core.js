/*
 * RakenOS Update API — shared logic.
 *
 * The same functions back the in-app LocalUpdateProvider and the development
 * server in mock-backend/, so both return identical responses for:
 *
 *   GET /api/os/latest
 *   GET /api/os/releases?limit=&before=
 *   GET /api/os/releases/:version
 *   GET /api/os/releases/:version/payload
 *   GET /api/os/check?currentVersion=&rolloutGroup=&since=
 *
 * Responses never include or require any hardware model information.
 */
import { compareVersions } from './version.js';
import { rolloutStatus } from './rollout.js';

export const DEFAULT_DAY_MS = 24 * 60 * 60 * 1000;

export function releaseSummary(r) {
  return {
    version: r.version,
    name: r.name,
    releaseDate: r.releaseDate,
    releaseType: r.releaseType,
    title: r.title,
    summary: r.summary,
    highlights: r.highlights,
    sizeBytes: r.payload.sizeBytes,
  };
}

export function createUpdateApi(dataset) {
  const releases = dataset.releases.slice().sort((a, b) => compareVersions(a.version, b.version));
  const byVersion = new Map(releases.map((r) => [r.version, r]));
  const nextOf = new Map();
  for (const r of releases) if (r.requiresVersion) nextOf.set(r.requiresVersion, r);

  return {
    latest() {
      const r = releases[releases.length - 1];
      return { version: r.version, name: r.name, releaseDate: r.releaseDate, releaseCount: releases.length };
    },

    releases({ limit = releases.length, before } = {}) {
      let list = releases.slice().reverse();
      if (before) list = list.filter((r) => compareVersions(r.version, before) < 0);
      const page = list.slice(0, Math.max(0, Math.min(limit, 500)));
      return { total: releases.length, releases: page.map(releaseSummary) };
    },

    release(version) {
      const r = byVersion.get(version);
      if (!r) return null;
      return r;
    },

    payload(version) {
      const r = byVersion.get(version);
      if (!r) return null;
      return { version: r.version, sha256: r.payload.sha256, sizeBytes: r.payload.sizeBytes, manifest: r.payload.manifest };
    },

    /*
     * Update check. RakenOS updates are sequential: each release is built as a
     * delta against its predecessor, so a device is always offered the next
     * release after the one it runs. `since` is the time the current version
     * was installed; the prototype treats it as the publication time of the
     * next release to this device's channel.
     */
    check({ currentVersion, rolloutGroup = 'D', since, now = Date.now(), dayMs = DEFAULT_DAY_MS } = {}) {
      const current = byVersion.get(currentVersion);
      const latest = releases[releases.length - 1];
      if (!current) {
        return { updateAvailable: false, error: 'unknown-version', currentVersion, latestVersion: latest.version };
      }
      const next = nextOf.get(currentVersion);
      if (!next) {
        return {
          updateAvailable: false, currentVersion, latestVersion: latest.version,
          latestEligibleVersion: currentVersion, rollout: 'none', rolloutGroup, checkedAt: now,
        };
      }
      const publishedAt = Number.isFinite(+since) ? +since : now;
      const st = rolloutStatus(next, rolloutGroup, publishedAt, now, dayMs);
      return {
        updateAvailable: st.eligible,
        currentVersion,
        latestVersion: latest.version,
        latestEligibleVersion: st.eligible ? next.version : currentVersion,
        nextVersion: next.version,
        rollout: st.eligible ? 'available' : 'pending',
        rolloutGroup,
        rolloutDay: st.rolloutDay,
        openGroups: st.openGroups,
        eligibleAt: st.eligibleAt,
        release: releaseSummary(next),
        checkedAt: now,
      };
    },
  };
}
