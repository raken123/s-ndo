/** Location, Qibla bearing and distance to the Kaaba. */

export const KAABA = { lat: 21.4224779, lng: 39.8251832, name: 'Al-Masjid al-Haram, Makkah' };

const DEG = Math.PI / 180;
const EARTH_R_KM = 6371.0088;

/**
 * Great-circle initial bearing from an observer to the Kaaba, in degrees
 * clockwise from true north. This is the Qibla.
 */
export function qiblaBearing(lat, lng) {
  const φ1 = lat * DEG;
  const φ2 = KAABA.lat * DEG;
  const Δλ = (KAABA.lng - lng) * DEG;
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Great-circle distance to the Kaaba in kilometres. */
export function distanceToKaaba(lat, lng) {
  const φ1 = lat * DEG, φ2 = KAABA.lat * DEG;
  const Δφ = (KAABA.lat - lat) * DEG;
  const Δλ = (KAABA.lng - lng) * DEG;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Compass point name for a bearing, e.g. 118° -> "ESE". */
export function compassPoint(bearing) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return names[Math.round(((bearing % 360) + 360) % 360 / 22.5) % 16];
}

/** A few well-known cities so the app is useful before location is granted. */
export const CITIES = [
  { name: 'Makkah',       lat: 21.3891,  lng: 39.8579,  tz: 'Asia/Riyadh' },
  { name: 'Madinah',      lat: 24.4686,  lng: 39.6142,  tz: 'Asia/Riyadh' },
  { name: 'Al-Quds',      lat: 31.7767,  lng: 35.2345,  tz: 'Asia/Jerusalem' },
  { name: 'Istanbul',     lat: 41.0082,  lng: 28.9784,  tz: 'Europe/Istanbul' },
  { name: 'Cairo',        lat: 30.0444,  lng: 31.2357,  tz: 'Africa/Cairo' },
  { name: 'Dubai',        lat: 25.2048,  lng: 55.2708,  tz: 'Asia/Dubai' },
  { name: 'Karachi',      lat: 24.8607,  lng: 67.0011,  tz: 'Asia/Karachi' },
  { name: 'Jakarta',      lat: -6.2088,  lng: 106.8456, tz: 'Asia/Jakarta' },
  { name: 'Kuala Lumpur', lat: 3.1390,   lng: 101.6869, tz: 'Asia/Kuala_Lumpur' },
  { name: 'Dhaka',        lat: 23.8103,  lng: 90.4125,  tz: 'Asia/Dhaka' },
  { name: 'Lagos',        lat: 6.5244,   lng: 3.3792,   tz: 'Africa/Lagos' },
  { name: 'London',       lat: 51.5074,  lng: -0.1278,  tz: 'Europe/London' },
  { name: 'Paris',        lat: 48.8566,  lng: 2.3522,   tz: 'Europe/Paris' },
  { name: 'Berlin',       lat: 52.5200,  lng: 13.4050,  tz: 'Europe/Berlin' },
  { name: 'Stockholm',    lat: 59.3293,  lng: 18.0686,  tz: 'Europe/Stockholm' },
  { name: 'Oslo',         lat: 59.9139,  lng: 10.7522,  tz: 'Europe/Oslo' },
  { name: 'Moscow',       lat: 55.7558,  lng: 37.6173,  tz: 'Europe/Moscow' },
  { name: 'New York',     lat: 40.7128,  lng: -74.0060, tz: 'America/New_York' },
  { name: 'Chicago',      lat: 41.8781,  lng: -87.6298, tz: 'America/Chicago' },
  { name: 'Toronto',      lat: 43.6532,  lng: -79.3832, tz: 'America/Toronto' },
  { name: 'Los Angeles',  lat: 34.0522,  lng: -118.2437, tz: 'America/Los_Angeles' },
  { name: 'Sydney',       lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' },
];

/** Best-effort city guess from the browser's IANA time zone. */
export function cityFromTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return CITIES.find((c) => c.tz === tz) || null;
  } catch {
    return null;
  }
}

/**
 * Ask for precise location. Resolves to a location object either way — a
 * refusal or a headset without GPS falls back to the time-zone guess, then
 * to Makkah, so every feature keeps working.
 */
export function requestLocation({ timeout = 8000 } = {}) {
  const fallback = () => {
    const city = cityFromTimeZone();
    return city
      ? { lat: city.lat, lng: city.lng, name: city.name, source: 'timezone' }
      : { lat: KAABA.lat, lng: KAABA.lng, name: 'Makkah', source: 'default' };
  };

  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(fallback());
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done(fallback()), timeout);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          elevation: pos.coords.altitude || 0,
          accuracy: pos.coords.accuracy,
          name: 'Your location',
          source: 'gps',
        });
      },
      () => { clearTimeout(timer); done(fallback()); },
      { enableHighAccuracy: false, timeout, maximumAge: 10 * 60 * 1000 },
    );
  });
}
