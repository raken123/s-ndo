/** Startskärmen: stora brickor, viktigast överst, inget som kräver läsning i fart. */
import { el, icon, fmtDistance, fmtDuration, setKids } from '../core/ui.js';
import { open } from '../core/router.js';
import { on } from '../core/bus.js';
import { state } from '../core/store.js';
import { sensors, distanceBetween, here } from '../core/sensors.js';
import { tripStatus } from './triplog.js';
import { fatigueStatus } from './fatigue.js';
import { nearestHazard } from './alerts.js';

const STANDARD = [
  { id: 'nav', icon: 'nav', title: 'Navigation', sub: 'Karta och färdmål' },
  { id: 'music', icon: 'music', title: 'Musik', sub: 'Spela från telefonen' },
  { id: 'phone', icon: 'phone', title: 'Telefon', sub: 'Ring handsfree' },
  { id: 'messages', icon: 'message', title: 'Meddelanden', sub: 'Diktera och svara' },
];

const SPECIAL = [
  { id: 'fatigue', icon: 'coffee', title: 'Trötthetsvakt', sub: 'Paus i rätt tid' },
  { id: 'parking', icon: 'parking', title: 'Parkering', sub: 'Hitta tillbaka' },
  { id: 'dashcam', icon: 'cam', title: 'Dashcam', sub: 'Rullande 60 s' },
  { id: 'triplog', icon: 'book', title: 'Färddagbok', sub: 'Milersättning' },
  { id: 'alerts', icon: 'warn', title: 'Väglag', sub: 'Varningar på vägen' },
  { id: 'hud', icon: 'hud', title: 'HUD', sub: 'Spegla i vindrutan' },
];

export const home = {
  id: 'home',
  name: 'Hem',
  icon: 'home',
  dock: true,

  mount(root) {
    const summary = el('div', { class: 'stack' });
    const grid = el('div', { class: 'grid' });
    const specialGrid = el('div', { class: 'grid' });

    const tile = (spec, special = false) => {
      const badge = el('span', { class: 'badge', hidden: true });
      const node = el('button', {
        class: `tile${special ? ' special' : ''}`,
        onClick: () => open(spec.id),
      },
        icon(spec.icon),
        el('span', {}, el('b', { text: spec.title }), el('small', { text: spec.sub })),
        badge,
      );
      node.badge = badge;
      return node;
    };

    const tiles = new Map();
    for (const spec of STANDARD) { const t = tile(spec); tiles.set(spec.id, t); grid.append(t); }
    for (const spec of SPECIAL) { const t = tile(spec, true); tiles.set(spec.id, t); specialGrid.append(t); }

    root.append(
      summary,
      el('h3', { class: 'card-label', style: 'font-size:14px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--r-muted);margin:6px 2px' , text: 'Vanliga' }),
      grid,
      el('h3', { style: 'font-size:14px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--r-violet);margin:16px 2px 6px', text: 'Bara i ReeOS' }),
      specialGrid,
      el('div', { style: 'height:8px' }),
      el('button', { class: 'btn block ghost', onClick: () => open('settings') }, icon('gear'), 'Inställningar'),
    );

    function renderSummary() {
      const cards = [];
      const trip = tripStatus();
      const fatigue = fatigueStatus();
      const park = state.parking;

      if (fatigue.dueForBreak) {
        cards.push(el('button', { class: 'card tight', style: 'border-color:var(--r-amber);text-align:left', onClick: () => open('fatigue') },
          el('div', { class: 'spread' },
            el('div', {}, el('b', { style: 'font-size:18px', text: 'Dags för paus' }),
              el('div', { class: 'hint', text: `Du har kört ${fmtDuration(fatigue.drivingMs)} utan rast.` })),
            icon('coffee', 'grow-0'),
          )));
      }

      if (trip.active) {
        cards.push(el('button', { class: 'card tight', style: 'text-align:left', onClick: () => open('triplog') },
          el('div', { class: 'spread' },
            el('div', {}, el('b', { text: 'Resa pågår' }),
              el('div', { class: 'hint', text: `${trip.km.toFixed(1)} km · ${fmtDuration(trip.durationMs)}` })),
            el('span', { class: 'pill green', text: 'LOGGAR' }),
          )));
      }

      if (park) {
        const dist = distanceBetween(here(), park);
        const left = park.meterEndsAt ? park.meterEndsAt - Date.now() : null;
        cards.push(el('button', { class: 'card tight', style: `text-align:left${left !== null && left < 0 ? ';border-color:var(--r-red)' : ''}`, onClick: () => open('parking') },
          el('div', { class: 'spread' },
            el('div', {}, el('b', { text: 'Sparad p-plats' }),
              el('div', { class: 'hint', text: Number.isFinite(dist) ? `${fmtDistance(dist)} härifrån` : (park.note || 'Position sparad') })),
            left === null ? icon('parking')
              : el('span', { class: `pill ${left < 0 ? 'red' : left < 600000 ? 'amber' : 'green'}`, text: left < 0 ? 'TIDEN UTE' : fmtDuration(left) }),
          )));
      }

      const hazard = nearestHazard(here(), 800);
      if (hazard) {
        cards.push(el('button', { class: 'card tight', style: 'border-color:var(--r-amber);text-align:left', onClick: () => open('alerts') },
          el('div', { class: 'spread' },
            el('div', {}, el('b', { text: hazard.label }),
              el('div', { class: 'hint', text: `${fmtDistance(hazard.distance)} framåt` })),
            icon('warn'),
          )));
      }

      setKids(summary, ...cards);
    }

    function renderBadges() {
      const trip = tripStatus();
      const fatigue = fatigueStatus();
      const setBadge = (id, text, kind = '') => {
        const t = tiles.get(id);
        if (!t) return;
        t.badge.hidden = !text;
        t.badge.textContent = text ?? '';
        t.badge.className = `badge ${kind}`.trim();
      };
      setBadge('triplog', trip.active ? 'PÅ' : (state.trips.length ? String(state.trips.length) : null), trip.active ? 'live' : '');
      setBadge('fatigue', fatigue.dueForBreak ? 'PAUS' : null, 'hot');
      setBadge('parking', state.parking ? 'SPARAD' : null);
      setBadge('alerts', state.hazards.length ? String(state.hazards.length) : null);
      setBadge('dashcam', state.clips.length ? String(state.clips.length) : null);
    }

    renderSummary();
    renderBadges();

    const timer = setInterval(() => { renderSummary(); renderBadges(); }, 5000);
    const unbind = [
      on('sensors:fix', renderSummary),
      on('trip:changed', () => { renderSummary(); renderBadges(); }),
      on('parking:changed', renderSummary),
    ];

    return () => { clearInterval(timer); unbind.forEach((fn) => fn()); };
  },
};
