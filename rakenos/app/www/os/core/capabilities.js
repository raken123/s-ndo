/*
 * Hardware capability detection.
 *
 * RakenOS is one system for every compatible device. Features are enabled
 * from detected capabilities — never from a device model. Nothing in this
 * module reads, stores or returns a model name.
 *
 * Capability ids: camera, multipleCameras, advancedCamera, torch, nfc,
 * scanner2d, vibration, bluetooth, wifi, telephony, fingerprint, gps.
 */
import { platform } from './platform.js';
import { settings } from './store.js';

export const CAPABILITY_INFO = {
  camera: 'Camera',
  multipleCameras: 'Front and rear cameras',
  advancedCamera: 'Advanced camera controls',
  torch: 'Flashlight',
  nfc: 'NFC',
  scanner2d: '2D barcode scanner',
  vibration: 'Haptics',
  bluetooth: 'Bluetooth',
  wifi: 'Wi-Fi',
  telephony: 'Mobile network',
  fingerprint: 'Fingerprint sensor',
  gps: 'Location (GNSS)',
};

let detected = null;
let effective = null;
const listeners = new Set();

async function detectWeb() {
  const caps = {
    camera: false, multipleCameras: false, advancedCamera: false, torch: false, nfc: 'NDEFReader' in globalThis,
    scanner2d: false, vibration: typeof navigator.vibrate === 'function', bluetooth: 'bluetooth' in navigator,
    wifi: true, telephony: false, fingerprint: !!globalThis.PublicKeyCredential, gps: 'geolocation' in navigator,
  };
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      caps.camera = cams.length > 0 || !!navigator.mediaDevices.getUserMedia;
      caps.multipleCameras = cams.length > 1;
    }
  } catch {}
  return caps;
}

/* Development-only simulation: ?caps=nfc,scanner2d adds capabilities in a browser build. */
function queryOverrides() {
  try {
    const q = new URLSearchParams(location.search).get('caps');
    if (!q) return {};
    return Object.fromEntries(q.split(',').filter(Boolean).map((c) => (c.startsWith('-') ? [c.slice(1), false] : [c, true])));
  } catch { return {}; }
}

function computeEffective() {
  // Developer options can only simulate a *missing* capability, never add hardware.
  const off = settings.get('capabilityOverrides') || {};
  effective = { ...detected };
  for (const [k, v] of Object.entries(off)) if (v === false) effective[k] = false;
  return effective;
}

export async function detectCapabilities() {
  let caps;
  try { caps = await platform.capabilities(); } catch { caps = null; }
  if (!caps) caps = { ...(await detectWeb()), ...(platform.isNative ? {} : queryOverrides()) };
  // Keep only known boolean capability flags — defensive against any extra fields.
  detected = Object.fromEntries(Object.keys(CAPABILITY_INFO).map((k) => [k, !!caps[k]]));
  computeEffective();
  return effective;
}

export function caps() { return effective || {}; }
export function detectedCaps() { return detected || {}; }
export function has(cap) { return !!(effective && effective[cap]); }

export function refineCapability(cap, value) {
  if (!detected || detected[cap] === value) return;
  detected[cap] = value; computeEffective();
  for (const fn of listeners) fn(effective);
}

export function onCapabilitiesChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

settings.on('capabilityOverrides', () => { if (detected) { computeEffective(); for (const fn of listeners) fn(effective); } });
