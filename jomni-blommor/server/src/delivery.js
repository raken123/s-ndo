import { SHOP, SLOTS, ZONES } from './config.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function partsIn(ts, tz) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

function offsetAt(ts, tz) {
  const p = partsIn(ts, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ts / 1000) * 1000;
}

// Lokal tid (datum + timme) i butikens tidszon → UTC-tidsstämpel.
export function localToUtc(dateStr, hour, tz = SHOP.timezone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  let ts = guess - offsetAt(guess, tz);
  ts = guess - offsetAt(ts, tz); // justera vid sommartidsskifte
  return ts;
}

export function localDate(ts, tz = SHOP.timezone) {
  const p = partsIn(ts, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = söndag
}

function isValidDate(dateStr) {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function normalizePostcode(pc) {
  const digits = String(pc || '').replace(/\s+/g, '');
  return /^\d{5}$/.test(digits) ? digits : null;
}

export function formatPostcode(pc) {
  return `${pc.slice(0, 3)} ${pc.slice(3)}`;
}

// Alla zoner som kan leverera till postnumret (billigast/snabbast först).
export function zonesFor(postcode) {
  const pc = normalizePostcode(postcode);
  if (!pc) return [];
  const n = Number(pc);
  return ZONES.filter((z) => n >= z.from && n <= z.to);
}

export function zoneById(id) {
  return ZONES.find((z) => z.id === id) || null;
}

function slotAvailable(zone, dateStr, slot, now) {
  const start = localToUtc(dateStr, slot.start);
  return now <= start - zone.prepHours * 3600 * 1000;
}

function dateAllowed(zone, dateStr, now) {
  if (!isValidDate(dateStr)) return false;
  const today = localDate(now);
  if (dateStr < addDays(today, zone.minDaysAhead || 0)) return false;
  if (dateStr > addDays(today, zone.maxDaysAhead)) return false;
  if (zone.weekdaysOnly && [0, 6].includes(weekday(dateStr))) return false;
  return true;
}

export function slotsFor(zone, dateStr, now = Date.now()) {
  if (!zone.slots || !dateAllowed(zone, dateStr, now)) return [];
  return SLOTS.filter((s) => slotAvailable(zone, dateStr, s, now));
}

export function earliestDate(zone, now = Date.now()) {
  let d = localDate(now);
  for (let i = 0; i <= zone.maxDaysAhead; i += 1, d = addDays(d, 1)) {
    if (!dateAllowed(zone, d, now)) continue;
    if (!zone.slots || slotsFor(zone, d, now).length) return d;
  }
  return null;
}

// Kontrollerar ett leveransval. Returnerar { ok, zone, error }.
export function validateDelivery({ postcode, zoneId, date, slot }, now = Date.now()) {
  const pc = normalizePostcode(postcode);
  if (!pc) return { ok: false, error: 'Ange ett giltigt svenskt postnummer (5 siffror).' };
  const zone = zonesFor(pc).find((z) => z.id === zoneId);
  if (!zone) return { ok: false, error: 'Vi kan tyvärr inte leverera med valt sätt till det postnumret.' };
  if (!dateAllowed(zone, date, now)) return { ok: false, error: 'Leveransdagen är inte tillgänglig.' };
  if (zone.slots) {
    const s = SLOTS.find((x) => x.id === slot);
    if (!s || !slotAvailable(zone, date, s, now)) return { ok: false, error: 'Tidsfönstret är inte längre tillgängligt.' };
  }
  return { ok: true, zone, postcode: pc };
}

export function deliveryFee(zone, subtotal) {
  if (zone.freeOver != null && subtotal >= zone.freeOver) return 0;
  return zone.fee;
}

// Förslag till kunden: vilka leveranssätt finns, vad kostar de, vilka tider.
export function quote(postcode, date, now = Date.now()) {
  const pc = normalizePostcode(postcode);
  if (!pc) return { ok: false, error: 'Ange ett giltigt svenskt postnummer (5 siffror).' };
  const options = zonesFor(pc).map((z) => {
    const earliest = earliestDate(z, now);
    const d = date && dateAllowed(z, date, now) ? date : earliest;
    return {
      id: z.id, name: z.name, description: z.description, fee: z.fee, freeOver: z.freeOver,
      hasSlots: z.slots, weekdaysOnly: !!z.weekdaysOnly, earliestDate: earliest,
      maxDate: addDays(localDate(now), z.maxDaysAhead),
      date: d, slots: d ? slotsFor(z, d, now) : [],
    };
  }).filter((o) => o.earliestDate);
  if (!options.length) return { ok: false, error: 'Vi levererar tyvärr inte till det postnumret ännu.' };
  return { ok: true, postcode: formatPostcode(pc), options };
}

export function slotStartUtc(order) {
  const s = SLOTS.find((x) => x.id === order.delivery.slot);
  return s ? localToUtc(order.delivery.date, s.start) : localToUtc(order.delivery.date, 9);
}
