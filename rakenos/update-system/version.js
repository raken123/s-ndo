// RakenOS version helpers. Versions are MAJOR.MINOR.PATCH.

export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  if (!m) throw new Error(`Invalid RakenOS version: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

export function compareVersions(a, b) {
  const x = parseVersion(a); const y = parseVersion(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
}

export const isNewer = (a, b) => compareVersions(a, b) > 0;
export const isAtLeast = (a, b) => compareVersions(a, b) >= 0;

export function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
