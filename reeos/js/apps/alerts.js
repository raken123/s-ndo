/** Väglag och varningar.
 *  Markera hål, halka, vilt eller kö där du möter det. ReeOS varnar när du
 *  närmar dig en markering igen — din egen, eller en du fått delad till dig.
 *  Ingen server: listan bor i telefonen och byts som fil mellan bilar. */
import { el, icon, toast, fmtDistance, fmtDate, downloadFile, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, push, remove, replace, uid } from '../core/store.js';
import { sensors, here, distanceBetween, bearingBetween } from '../core/sensors.js';
import { say } from '../core/speech.js';

export const HAZARD_KINDS = {
  pothole: { label: 'Hål i vägen', voice: 'Hål i vägen', icon: 'warn' },
  ice: { label: 'Halka', voice: 'Risk för halka', icon: 'warn' },
  wildlife: { label: 'Vilt', voice: 'Viltstråk', icon: 'warn' },
  queue: { label: 'Kö', voice: 'Köbildning', icon: 'car' },
  roadwork: { label: 'Vägarbete', voice: 'Vägarbete', icon: 'road' },
  camera: { label: 'Fartkamera', voice: 'Fartkamera', icon: 'cam' },
};

const announced = new Map();   // id -> tidpunkt, så samma varning inte upprepas

export function reportHazard(kind, note = '') {
  const pos = here();
  if (!pos) { toast('Ingen position ännu — kan inte markera.', 'warn'); return null; }
  const hazard = { id: uid(), kind, note, lat: pos.lat, lon: pos.lon, at: Date.now() };
  push('hazards', hazard);
  buzz([20, 50]);
  toast(`${HAZARD_KINDS[kind]?.label ?? 'Markering'} sparad här.`, 'ok');
  return hazard;
}

/** Närmaste markering framför dig inom `radius` meter. */
export function nearestHazard(pos, radius = 500) {
  if (!pos) return null;
  let best = null;
  for (const hazard of state.hazards) {
    const distance = distanceBetween(pos, hazard);
    if (!Number.isFinite(distance) || distance > radius) continue;
    if (!best || distance < best.distance) {
      best = { ...hazard, distance, label: HAZARD_KINDS[hazard.kind]?.label ?? 'Varning' };
    }
  }
  return best;
}

/** Bakgrundsvakt: säger till i god tid, men bara för det som ligger framåt. */
export function initHazardWatch() {
  on('sensors:fix', () => {
    if (!sensors.driving) return;
    const pos = here();
    // Ju fortare du kör, desto tidigare behöver du veta — ca 20 sekunders varsel.
    const radius = Math.max(220, sensors.speed * 20);

    for (const hazard of state.hazards) {
      const distance = distanceBetween(pos, hazard);
      if (!Number.isFinite(distance) || distance > radius) continue;

      // Ligger den bakom oss? Då är den redan passerad.
      if (Number.isFinite(sensors.heading)) {
        const bearing = bearingBetween(pos, hazard);
        const offset = Math.abs(((bearing - sensors.heading + 540) % 360) - 180);
        if (offset > 70) continue;
      }

      const lastTime = announced.get(hazard.id) ?? 0;
      if (Date.now() - lastTime < 5 * 60000) continue;
      announced.set(hazard.id, Date.now());

      const kind = HAZARD_KINDS[hazard.kind];
      buzz([30, 60, 30]);
      say(`${kind?.voice ?? 'Varning'} om ${fmtDistance(distance)}.`, { force: true });
      toast(`${kind?.label ?? 'Varning'} · ${fmtDistance(distance)} framåt`, 'warn', 6000);
      emit('hazard:near', hazard);
      break;
    }
  });

  on('alerts:quickreport', () => openQuickReport());
}

/** Ett tryck, sex val, klart — tänkt att gå att träffa utan att titta länge. */
export function openQuickReport() {
  const overlay = document.getElementById('alert-overlay');
  if (!overlay) return;
  overlay.className = 'alert-overlay calm';
  overlay.hidden = false;
  setKids(overlay, 
    el('h2', { text: 'Vad ser du?' }),
    el('div', { class: 'row', style: 'justify-content:center;max-width:560px' },
      ...Object.entries(HAZARD_KINDS).map(([key, kind]) => el('button', {
        class: 'btn', style: 'min-width:150px',
        onClick: () => { overlay.hidden = true; reportHazard(key); },
      }, icon(kind.icon), kind.label)),
    ),
    el('button', { class: 'btn ghost', style: 'color:#fff;border-color:rgba(255,255,255,.4)', onClick: () => { overlay.hidden = true; }, text: 'Avbryt' }),
  );
}

export const alertsApp = {
  id: 'alerts',
  name: 'Väglag',
  icon: 'warn',

  mount(root) {
    const list = el('div', { class: 'list' });

    root.append(
      el('div', { class: 'card' },
        el('h3', { text: 'Markera här' }),
        el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr))' },
          ...Object.entries(HAZARD_KINDS).map(([key, kind]) => el('button', {
            class: 'btn', style: 'min-height:74px',
            onClick: () => { reportHazard(key); render(); },
          }, icon(kind.icon), kind.label)),
        ),
        el('p', { class: 'hint', style: 'margin-top:10px', text: 'Markeringen läggs på din nuvarande position. Under körning finns samma knappar bakom varningsikonen i kartvyn.' }),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card' },
        el('div', { class: 'spread', style: 'margin-bottom:10px' },
          el('h3', { style: 'margin:0', text: 'Mina markeringar' }),
          el('div', { class: 'row' },
            el('button', {
              class: 'btn small',
              onClick: () => {
                if (!state.hazards.length) { toast('Inget att dela.', 'warn'); return; }
                downloadFile(`reeos-vaglag-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify({ app: 'ReeOS', kind: 'hazards', hazards: state.hazards }, null, 2), 'application/json');
              },
            }, icon('download'), 'Dela'),
            el('button', { class: 'btn small', onClick: () => importInput.click() }, icon('upload'), 'Läs in'),
          ),
        ),
        list,
      ),
      el('div', { style: 'height:12px' }),
      el('p', { class: 'hint', text: 'Markeringarna ligger bara i den här telefonen. Vill du dela med någon annan bil exporterar du filen och läser in den där.' }),
    );

    const importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only' });
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = Array.isArray(parsed) ? parsed : parsed.hazards;
        if (!Array.isArray(incoming)) throw new Error('Filen innehåller inga markeringar.');
        const known = new Set(state.hazards.map((h) => `${h.lat.toFixed(5)}|${h.lon.toFixed(5)}|${h.kind}`));
        const fresh = incoming
          .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && HAZARD_KINDS[h.kind])
          .filter((h) => !known.has(`${h.lat.toFixed(5)}|${h.lon.toFixed(5)}|${h.kind}`))
          .map((h) => ({ id: uid(), kind: h.kind, note: h.note ?? '', lat: h.lat, lon: h.lon, at: h.at ?? Date.now() }));
        replace('hazards', [...state.hazards, ...fresh]);
        toast(`${fresh.length} nya markeringar inlästa.`, 'ok');
        render();
      } catch (err) { toast(err.message, 'err'); }
    });
    root.append(importInput);

    function render() {
      const pos = here();
      const sorted = [...state.hazards].sort((a, b) => {
        if (!pos) return b.at - a.at;
        return distanceBetween(pos, a) - distanceBetween(pos, b);
      });
      setKids(list, 
        ...sorted.map((hazard) => {
          const kind = HAZARD_KINDS[hazard.kind] ?? { label: 'Varning', icon: 'warn' };
          const distance = distanceBetween(pos, hazard);
          return el('div', { class: 'list-item' },
            el('span', { class: 'avatar' }, icon(kind.icon)),
            el('div', { class: 'li-main' },
              el('b', { text: kind.label }),
              el('small', { text: `${fmtDate(hazard.at)}${hazard.note ? ` · ${hazard.note}` : ''}` }),
            ),
            el('span', { class: 'li-end', text: Number.isFinite(distance) ? fmtDistance(distance) : '' }),
            el('button', { class: 'btn small ghost', 'aria-label': 'Ta bort', onClick: () => { remove('hazards', hazard.id); render(); } }, icon('trash')),
          );
        }),
        sorted.length ? null : el('div', { class: 'empty' },
          el('b', { text: 'Inga markeringar' }),
          el('span', { class: 'hint', text: 'Markera det du möter — hålet finns kvar nästa gång du kör här.' })),
      );
    }

    render();
    const unbind = on('hazards:changed', render);
    return () => unbind();
  },
};
