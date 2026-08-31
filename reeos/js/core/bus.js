/** Enkel händelsebuss. Apparna pratar aldrig direkt med varandra. */
const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function once(event, fn) {
  const unbind = on(event, (payload) => { unbind(); fn(payload); });
  return unbind;
}

export function emit(event, payload) {
  for (const fn of listeners.get(event) ?? []) {
    try { fn(payload); } catch (err) { console.error(`[bus] ${event}`, err); }
  }
}
