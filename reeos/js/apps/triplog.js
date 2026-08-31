/** Färddagbok. Loggar sträckan automatiskt så att milersättningen inte
 *  behöver rekonstrueras ur minnet en söndag i januari. */
import { el, icon, toast, fmtDuration, fmtDateTime, downloadFile, confirmBig, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, push, remove, replace, uid, save } from '../core/store.js';
import { sensors, here, distanceBetween } from '../core/sensors.js';

const STOP_AFTER_MS = 3 * 60 * 1000;   // stillastående så länge = resan är slut

let active = null;      // { id, start, meters, from, lastPoint, lastMoveAt }

export function tripStatus() {
  return {
    active: Boolean(active),
    km: active ? active.meters / 1000 : 0,
    durationMs: active ? Date.now() - active.start : 0,
    id: active?.id ?? null,
  };
}

export function startTrip(manual = false) {
  if (active) return active;
  const point = here();
  active = {
    id: uid(),
    start: Date.now(),
    meters: 0,
    from: point ? { ...point } : null,
    lastPoint: point ? { ...point } : null,
    lastMoveAt: Date.now(),
  };
  emit('trip:changed', tripStatus());
  if (manual) toast('Resan loggas.', 'ok');
  return active;
}

export function endTrip({ purpose = 'privat', note = '' } = {}) {
  if (!active) return null;
  const trip = {
    id: active.id,
    start: active.start,
    end: Date.now(),
    km: Number((active.meters / 1000).toFixed(2)),
    from: active.from,
    to: here(),
    purpose,
    note,
  };
  active = null;
  // Under 300 m är det mest GPS-brus på en parkering, inte en resa.
  trip.recorded = trip.km >= 0.3;
  if (trip.recorded) {
    push('trips', trip);
    state.stats.totalKm = Number((state.stats.totalKm + trip.km).toFixed(2));
    state.stats.driveMs += trip.end - trip.start;
    save();
    toast(`Resa sparad: ${trip.km.toFixed(1)} km.`, 'ok');
  }
  emit('trip:changed', tripStatus());
  return trip;
}

/** Kopplas in från main.js och matas av samma GPS-ström som resten. */
export function initTripLogger() {
  on('sensors:fix', () => {
    const point = here();
    if (!point) return;

    if (!active) {
      if (state.settings.autoTripLog && sensors.driving) startTrip();
      return;
    }

    if (active.lastPoint) {
      const step = distanceBetween(active.lastPoint, point);
      // Kasta hopp som är brus (<8 m) eller orimliga (>500 m mellan två fixar).
      if (Number.isFinite(step) && step >= 8 && step < 500) {
        active.meters += step;
        active.lastPoint = { ...point };
        active.lastMoveAt = Date.now();
      }
    } else {
      active.lastPoint = { ...point };
      active.from ??= { ...point };
    }

    if (sensors.speedKmh > 5) active.lastMoveAt = Date.now();
    if (Date.now() - active.lastMoveAt > STOP_AFTER_MS) endTrip();
  });
}

function toCSV(trips) {
  const rows = [['Datum', 'Start', 'Slut', 'Kilometer', 'Ärende', 'Anteckning', 'Från', 'Till']];
  for (const trip of trips) {
    const coord = (p) => (p ? `${p.lat.toFixed(5)} ${p.lon.toFixed(5)}` : '');
    rows.push([
      new Date(trip.start).toLocaleDateString('sv-SE'),
      new Date(trip.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      new Date(trip.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
      trip.km.toFixed(2).replace('.', ','),
      trip.purpose,
      trip.note ?? '',
      coord(trip.from),
      coord(trip.to),
    ]);
  }
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

export const tripApp = {
  id: 'triplog',
  name: 'Färddagbok',
  icon: 'book',

  mount(root) {
    const live = el('div', { class: 'card' });
    const list = el('div', { class: 'list' });
    const totals = el('div', { class: 'row' });

    root.append(
      live,
      el('div', { style: 'height:12px' }),
      totals,
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card' },
        el('div', { class: 'spread', style: 'margin-bottom:10px' },
          el('h3', { style: 'margin:0', text: 'Resor' }),
          el('div', { class: 'row' },
            el('button', {
              class: 'btn small',
              onClick: () => {
                if (!state.trips.length) { toast('Inga resor att exportera.', 'warn'); return; }
                downloadFile(`reeos-farddagbok-${new Date().toISOString().slice(0, 10)}.csv`,
                  '﻿' + toCSV(state.trips), 'text/csv;charset=utf-8');
              },
            }, icon('download'), 'CSV'),
            el('button', {
              class: 'btn small ghost',
              onClick: async () => {
                if (!state.trips.length) return;
                if (await confirmBig('Radera alla resor?', 'Färddagboken töms permanent.', 'Radera')) {
                  replace('trips', []);
                  state.stats.totalKm = 0;
                  save();
                  render();
                }
              },
            }, icon('trash'), 'Töm'),
          ),
        ),
        list,
      ),
    );

    function renderLive() {
      const status = tripStatus();
      setKids(live, 
        el('div', { class: 'spread' },
          el('div', {},
            el('div', { class: 'big-num' }, status.km.toFixed(1), el('small', { text: 'km' })),
            el('div', { class: 'hint', text: status.active ? `Pågår · ${fmtDuration(status.durationMs)}` : 'Ingen resa pågår' }),
          ),
          el('span', { class: `pill ${status.active ? 'green' : ''}`, text: status.active ? 'LOGGAR' : 'VILAR' }),
        ),
        el('div', { style: 'height:14px' }),
        status.active
          ? el('div', { class: 'row' },
              el('button', { class: 'btn grow', onClick: () => { endTrip({ purpose: 'tjänst' }); render(); } }, icon('check'), 'Avsluta som tjänst'),
              el('button', { class: 'btn grow', onClick: () => { endTrip({ purpose: 'privat' }); render(); } }, icon('check'), 'Avsluta som privat'),
            )
          : el('button', { class: 'btn block primary', onClick: () => { startTrip(true); render(); } }, icon('play'), 'Starta resa manuellt'),
      );
    }

    function renderTotals() {
      const work = state.trips.filter((t) => t.purpose === 'tjänst').reduce((sum, t) => sum + t.km, 0);
      const priv = state.trips.filter((t) => t.purpose !== 'tjänst').reduce((sum, t) => sum + t.km, 0);
      const card = (label, value, hint) => el('div', { class: 'card grow', style: 'min-width:140px' },
        el('div', { class: 'big-num', style: 'font-size:32px' }, value, el('small', { text: 'km' })),
        el('div', { class: 'hint', text: label }),
        hint ? el('div', { class: 'hint', text: hint }) : null,
      );
      setKids(totals, 
        card('Tjänsteresor', work.toFixed(1), `${(work * 25).toFixed(0)} kr vid 25 kr/mil`),
        card('Privat', priv.toFixed(1)),
      );
    }

    function renderList() {
      const sorted = [...state.trips].sort((a, b) => b.start - a.start);
      setKids(list, 
        ...sorted.slice(0, 60).map((trip) => el('div', { class: 'list-item' },
          el('span', { class: 'avatar' }, icon('car')),
          el('button', {
            class: 'li-main', style: 'background:none;border:0;text-align:left',
            onClick: () => {
              const note = prompt('Anteckning för resan:', trip.note ?? '');
              if (note === null) return;
              trip.note = note;
              save();
              renderList();
            },
          },
            el('b', { text: `${trip.km.toFixed(1)} km · ${trip.purpose}` }),
            el('small', { text: `${fmtDateTime(trip.start)} · ${fmtDuration(trip.end - trip.start)}${trip.note ? ` · ${trip.note}` : ''}` }),
          ),
          el('button', {
            class: 'btn small ghost', 'aria-label': 'Ta bort resan',
            onClick: () => { remove('trips', trip.id); render(); },
          }, icon('trash')),
        )),
        sorted.length ? null : el('div', { class: 'empty' },
          el('b', { text: 'Inga resor än' }),
          el('span', { class: 'hint', text: 'Dagboken startar av sig själv när bilen rullar över 8 km/h.' })),
      );
    }

    const render = () => { renderLive(); renderTotals(); renderList(); };
    render();
    const timer = setInterval(renderLive, 3000);
    const unbind = on('trip:changed', render);
    return () => { clearInterval(timer); unbind(); };
  },
};
