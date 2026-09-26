/*
 * RAS — Raken App Software packages.
 *
 * A .ras file is a ZIP container:
 *   manifest.json            package identity, entry points, permissions, capabilities, Store metadata
 *   main.rscript             RScript program (manifest.entry)
 *   ui.rdesign.json          RDesign interface (manifest.design)
 *   assets/…                 icons, images, data
 *   META-INF/SIGNATURE.json  per-file SHA-256 digests signed with the developer key (ECDSA P-256)
 *
 * Installation pipeline: parse → validate manifest → verify signature →
 * check compatibility → ask for permissions → install.
 */
import { readZip } from './zip.js';

export const RAS_FORMAT = 1;
export const SIGNATURE_PATH = 'META-INF/SIGNATURE.json';

export const KNOWN_PERMISSIONS = {
  notifications: { label: 'Send notifications', icon: 'bell' },
  storage: { label: 'Store data on this device', icon: 'storage' },
  vibrate: { label: 'Use haptic feedback', icon: 'vibrate' },
  camera: { label: 'Use the camera', icon: 'camera' },
  nfc: { label: 'Read NFC tags', icon: 'nfc' },
  scanner: { label: 'Receive barcode scans', icon: 'scanner' },
  network: { label: 'Access the internet', icon: 'globe' },
  clipboard: { label: 'Read and write the clipboard', icon: 'file-text' },
};

export const KNOWN_CAPABILITIES = ['camera', 'advancedCamera', 'torch', 'nfc', 'scanner2d', 'vibration', 'bluetooth', 'wifi', 'telephony', 'fingerprint', 'gps'];

const ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){2,}$/;
const VER_RE = /^\d+\.\d+\.\d+$/;

const td = new TextDecoder();
const te = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256(bytes) { return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes)); }

function b64ToBytes(b64) {
  if (typeof atob === 'function') return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
export function bytesToB64(bytes) {
  if (typeof btoa === 'function') { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
  return Buffer.from(bytes).toString('base64');
}

export class RasError extends Error {
  constructor(code, message, details) { super(message); this.code = code; this.details = details; }
}

export function validateManifest(m) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  req(m && typeof m === 'object', 'Manifest must be a JSON object.');
  if (!m || typeof m !== 'object') return errors;
  req(m.format === RAS_FORMAT, `Unsupported RAS format ${m.format}.`);
  req(typeof m.id === 'string' && ID_RE.test(m.id), 'id must be a reverse-domain identifier such as "com.example.app".');
  req(typeof m.name === 'string' && m.name.length > 0 && m.name.length <= 30, 'name must be 1–30 characters.');
  req(typeof m.version === 'string' && VER_RE.test(m.version), 'version must be MAJOR.MINOR.PATCH.');
  req(Number.isInteger(m.versionCode) && m.versionCode > 0, 'versionCode must be a positive integer.');
  req(typeof m.minRakenOS === 'string' && VER_RE.test(m.minRakenOS), 'minRakenOS must be a RakenOS version.');
  req(Number.isInteger(m.rasApiLevel) && m.rasApiLevel >= 1, 'rasApiLevel must be a positive integer.');
  req(typeof m.entry === 'string' && m.entry.endsWith('.rscript'), 'entry must point to an .rscript file.');
  req(typeof m.design === 'string' && m.design.endsWith('.rdesign.json'), 'design must point to an .rdesign.json file.');
  req(Array.isArray(m.permissions), 'permissions must be a list.');
  if (Array.isArray(m.permissions)) for (const p of m.permissions) req(KNOWN_PERMISSIONS[p.id || p], `Unknown permission "${p.id || p}".`);
  const caps = m.capabilities || {};
  for (const c of [...(caps.required || []), ...(caps.optional || [])]) req(KNOWN_CAPABILITIES.includes(c), `Unknown capability "${c}".`);
  req(m.icon && typeof m.icon === 'object' && (m.icon.glyph || m.icon.asset), 'icon must define a glyph or an asset.');
  req(m.store && typeof m.store === 'object', 'store metadata is required.');
  if (m.store) {
    req(typeof m.store.summary === 'string' && m.store.summary.length <= 80, 'store.summary must be at most 80 characters.');
    req(typeof m.store.category === 'string', 'store.category is required.');
    req(typeof m.store.developer === 'string', 'store.developer is required.');
  }
  return errors;
}

export function canonicalSigningPayload(sig) {
  const digests = {};
  for (const k of Object.keys(sig.digests).sort()) digests[k] = sig.digests[k];
  return JSON.stringify({ format: sig.format, algorithm: sig.algorithm, keyId: sig.keyId, packageId: sig.packageId, version: sig.version, digests });
}

export async function importPublicKey(jwk) {
  return globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

/*
 * Verifies the package signature. `trustedKeys` maps keyId → { publisher, jwk }.
 * Returns { trusted, keyId, publisher } or throws RasError.
 */
export async function verifySignature(files, manifest, trustedKeys, { allowUntrusted = false } = {}) {
  const raw = files.get(SIGNATURE_PATH);
  if (!raw) throw new RasError('unsigned', 'This package is not signed.');
  let sig;
  try { sig = JSON.parse(td.decode(raw)); } catch { throw new RasError('bad-signature', 'The package signature is unreadable.'); }
  if (sig.algorithm !== 'ECDSA-P256-SHA256') throw new RasError('bad-signature', `Unsupported signature algorithm ${sig.algorithm}.`);
  if (sig.packageId !== manifest.id || sig.version !== manifest.version) throw new RasError('bad-signature', 'The signature belongs to a different package.');
  // Every file except the signature itself must be covered, and match.
  const covered = new Set(Object.keys(sig.digests || {}));
  for (const [name, data] of files) {
    if (name === SIGNATURE_PATH) continue;
    if (!covered.has(name)) throw new RasError('tampered', `File "${name}" is not covered by the signature.`);
    if ((await sha256(data)) !== sig.digests[name]) throw new RasError('tampered', `File "${name}" was modified after signing.`);
    covered.delete(name);
  }
  if (covered.size) throw new RasError('tampered', `Signed file "${[...covered][0]}" is missing from the package.`);

  const key = trustedKeys[sig.keyId];
  if (!key) {
    if (allowUntrusted) return { trusted: false, keyId: sig.keyId, publisher: sig.publisher || 'Unknown developer' };
    throw new RasError('untrusted', 'This package is signed by an unknown developer key.');
  }
  const pub = await importPublicKey(key.jwk);
  const ok = await globalThis.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64ToBytes(sig.signature), te.encode(canonicalSigningPayload(sig)));
  if (!ok) throw new RasError('bad-signature', 'The package signature is invalid.');
  return { trusted: true, keyId: sig.keyId, publisher: key.publisher };
}

/* Compatibility with this RakenOS installation and this device's hardware. */
export function checkCompatibility(manifest, { rakenosVersion, rasApiLevel, capabilities }) {
  const problems = [];
  const cmp = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  if (cmp(rakenosVersion, manifest.minRakenOS) < 0) problems.push({ code: 'os-version', message: `Requires RakenOS ${manifest.minRakenOS} or later.` });
  if (manifest.rasApiLevel > rasApiLevel) problems.push({ code: 'api-level', message: `Requires RAS API level ${manifest.rasApiLevel}.` });
  const missing = ((manifest.capabilities && manifest.capabilities.required) || []).filter((c) => !capabilities[c]);
  if (missing.length) problems.push({ code: 'capability', message: `Requires hardware this device does not have (${missing.join(', ')}).`, missing });
  const optionalMissing = ((manifest.capabilities && manifest.capabilities.optional) || []).filter((c) => !capabilities[c]);
  return { compatible: problems.length === 0, problems, optionalMissing };
}

/* Parse + validate + verify. Returns an installable package record. */
export async function openRasPackage(bytes, { trustedKeys, allowUntrusted = false } = {}) {
  const files = await readZip(bytes);
  const mRaw = files.get('manifest.json');
  if (!mRaw) throw new RasError('invalid', 'The package has no manifest.');
  let manifest;
  try { manifest = JSON.parse(td.decode(mRaw)); } catch { throw new RasError('invalid', 'The package manifest is not valid JSON.'); }
  const errors = validateManifest(manifest);
  if (errors.length) throw new RasError('invalid', 'The package manifest is invalid.', errors);
  for (const p of [manifest.entry, manifest.design]) if (!files.has(p)) throw new RasError('invalid', `The package is missing ${p}.`);
  if (manifest.icon.asset && !files.has(manifest.icon.asset)) throw new RasError('invalid', `The package is missing ${manifest.icon.asset}.`);
  let design;
  try { design = JSON.parse(td.decode(files.get(manifest.design))); } catch { throw new RasError('invalid', 'The RDesign file is not valid JSON.'); }
  const signature = await verifySignature(files, manifest, trustedKeys || {}, { allowUntrusted });
  const assets = {};
  for (const [name, data] of files) if (name.startsWith('assets/')) assets[name] = data;
  return { manifest, script: td.decode(files.get(manifest.entry)), design, assets, signature, digest: await sha256(bytes) };
}
