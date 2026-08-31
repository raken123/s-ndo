/** Position, fart, riktning, batteri och skärmlås.
 *  En enda GPS-prenumeration som alla appar delar — flera watchPosition
 *  parallellt dränerar batteriet i onödan. */
import { emit } from './bus.js';
import { state } from './store.js';

export const sensors = {
  supported: 'geolocation' in navigator,
  status: 'idle',        // idle | pending | live | denied | error
  lat: null,
  lon: null,
  accuracy: null,
  heading: null,         // grader, 0 = norr
  speed: 0,              // m/s
  speedKmh: 0,
  altitude: null,
  updatedAt: 0,
  driving: false,
  batteryLevel: null,
  batteryCharging: null,
};

const R_EARTH = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Avstånd i meter mellan två WGS84-punkter. */
export function distanceBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return NaN;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

/** Kompassbäring i grader från a till b. */
export function bearingBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return NaN;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const compassName = (deg) =>
  ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];

/* ---------- Fartutjämning ----------
   Rå GPS-fart hoppar; ett litet glidande medelvärde gör siffran läsbar
   utan att göra den märkbart fördröjd. */
const speedWindow = [];
let lastFix = null;

function smoothSpeed(raw) {
  speedWindow.push(raw);
  if (speedWindow.length > 5) speedWindow.shift();
  return speedWindow.reduce((a, b) => a + b, 0) / speedWindow.length;
}

let watchId = null;

export function startGPS() {
  if (!sensors.supported) {
    sensors.status = 'error';
    emit('sensors:status', sensors);
    return;
  }
  if (watchId !== null) return;
  sensors.status = 'pending';
  emit('sensors:status', sensors);

  watchId = navigator.geolocation.watchPosition(onFix, onFixError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 20000,
  });
}

export function stopGPS() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  sensors.status = 'idle';
  emit('sensors:status', sensors);
}

function onFix(pos) {
  const { latitude, longitude, accuracy, heading, speed, altitude } = pos.coords;
  const now = pos.timestamp || Date.now();
  const here = { lat: latitude, lon: longitude };

  // Vissa enheter lämnar speed = null. Räkna då fram den ur två fixar.
  let mps = Number.isFinite(speed) && speed !== null ? speed : 0;
  if ((!Number.isFinite(speed) || speed === null) && lastFix) {
    const dt = (now - lastFix.t) / 1000;
    const dist = distanceBetween(lastFix, here);
    if (dt > 0.4 && dt < 30 && Number.isFinite(dist)) mps = dist / dt;
  }
  // Stillastående GPS driver runt några meter — under 0,7 m/s är det brus.
  if (mps < 0.7) mps = 0;

  sensors.lat = latitude;
  sensors.lon = longitude;
  sensors.accuracy = accuracy;
  sensors.altitude = altitude;
  sensors.speed = smoothSpeed(mps);
  sensors.speedKmh = sensors.speed * 3.6;
  if (Number.isFinite(heading) && heading !== null && mps > 1) sensors.heading = heading;
  sensors.updatedAt = now;
  sensors.status = 'live';
  lastFix = { ...here, t: now };

  const wasDriving = sensors.driving;
  if (sensors.speedKmh > 8) sensors.driving = true;
  else if (sensors.speedKmh < 3) sensors.driving = false;

  emit('sensors:fix', sensors);
  if (wasDriving !== sensors.driving) emit('sensors:driving', sensors.driving);

  const warnAt = state.settings.speedWarnAt;
  if (warnAt > 0 && sensors.speedKmh > warnAt) emit('sensors:overspeed', sensors.speedKmh);
}

function onFixError(err) {
  sensors.status = err.code === err.PERMISSION_DENIED ? 'denied' : 'error';
  emit('sensors:status', sensors);
}

/** Nuvarande position, eller null innan första fixen. */
export const here = () => (sensors.lat == null ? null : { lat: sensors.lat, lon: sensors.lon });

/** En enstaka färsk position — för "spara p-plats" där det måste vara nu. */
export function fixOnce(timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!sensors.supported) { reject(new Error('Ingen GPS i den här enheten.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Platsåtkomst nekad.' : 'Ingen position ännu.')),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

/* ---------- Skärmlås ---------- */
let wakeLock = null;

export async function keepScreenAwake(on = true) {
  if (!('wakeLock' in navigator)) return false;
  try {
    if (on) {
      wakeLock ??= await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => { wakeLock = null; });
      return true;
    }
    await wakeLock?.release();
    wakeLock = null;
    return false;
  } catch {
    wakeLock = null;
    return false;
  }
}

// Skärmlåset släpps när fliken göms; ta det igen när den syns.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.settings.wakeLock) keepScreenAwake(true);
});

/* ---------- Batteri ---------- */
export async function watchBattery() {
  if (!navigator.getBattery) return;
  try {
    const battery = await navigator.getBattery();
    const sync = () => {
      sensors.batteryLevel = Math.round(battery.level * 100);
      sensors.batteryCharging = battery.charging;
      emit('sensors:battery', sensors);
    };
    battery.addEventListener('levelchange', sync);
    battery.addEventListener('chargingchange', sync);
    sync();
  } catch { /* batteristatus är trevligt men inte nödvändigt */ }
}

/* ---------- Enhetsriktning (kompass utan fart) ---------- */
let orientationBound = false;

export function watchOrientation() {
  if (orientationBound) return;
  orientationBound = true;
  window.addEventListener('deviceorientationabsolute', onOrientation, true);
  window.addEventListener('deviceorientation', onOrientation, true);
}

function onOrientation(event) {
  const deg = event.webkitCompassHeading ?? (event.absolute && event.alpha !== null ? 360 - event.alpha : null);
  if (deg === null || !Number.isFinite(deg)) return;
  // GPS-riktningen är pålitligare i fart; kompassen får ta över när bilen står still.
  if (sensors.speed < 1.5) sensors.heading = deg;
}

/** iOS kräver ett användarklick innan kompassen får läsas. */
export async function requestOrientationPermission() {
  const api = window.DeviceOrientationEvent;
  if (api && typeof api.requestPermission === 'function') {
    try { return (await api.requestPermission()) === 'granted'; } catch { return false; }
  }
  return true;
}
