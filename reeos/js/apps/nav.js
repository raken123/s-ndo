/** Navigation.
 *  Online: OpenStreetMap-rutor + OSRM-rutt med svängar.
 *  Offline: kompassläge med bäring och fågelvägen — hellre en ärlig pil
 *  än en karta som ljuger när täckningen tar slut. */
import { el, icon, toast, fmtDistance, fmtDuration, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, push, uid, save } from '../core/store.js';
import { sensors, here, distanceBetween, bearingBetween, compassName, fixOnce } from '../core/sensors.js';
import { say } from '../core/speech.js';

const TILE = 256;
const tileCache = new Map();     // "z/x/y" -> Image
const MAX_TILES = 260;

/* navigator.onLine kan säga "uppkopplad" när rutorna ändå inte kommer fram
   (tunnel, blockerad brandvägg, död wifi). Vi litar på utfallet, inte flaggan. */
const tileHealth = { ok: 0, fail: 0, since: Date.now() };

function tilesUsable() {
  if (Date.now() - tileHealth.since > 30000) {
    // Ge nätet en ny chans med jämna mellanrum.
    tileHealth.ok = 0;
    tileHealth.fail = 0;
    tileHealth.since = Date.now();
  }
  return !(tileHealth.fail >= 5 && tileHealth.ok === 0);
}

const nav = {
  destination: null,   // { label, lat, lon }
  route: null,         // { coords: [[lat,lon]], steps: [...], distance, duration }
  stepIndex: 0,
  zoom: 15,
  headingUp: true,
  online: navigator.onLine,
  spokenStep: -1,
};

/* ---------- Web Mercator ---------- */
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

function getTile(z, x, y) {
  const max = 2 ** z;
  if (y < 0 || y >= max) return null;
  const wrapped = ((x % max) + max) % max;
  const key = `${z}/${wrapped}/${y}`;
  let img = tileCache.get(key);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'strict-origin-when-cross-origin';
    img.decoding = 'async';
    img.src = `https://tile.openstreetmap.org/${z}/${wrapped}/${y}.png`;
    img.onload = () => { tileHealth.ok += 1; };
    img.onerror = () => { img.failed = true; tileHealth.fail += 1; };
    tileCache.set(key, img);
    if (tileCache.size > MAX_TILES) tileCache.delete(tileCache.keys().next().value);
  }
  return img.failed ? null : img;
}

/* ---------- Sökning och ruttberäkning ---------- */
export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=sv&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Sökningen svarade inte.');
  const rows = await res.json();
  return rows.map((r) => ({
    label: r.display_name.split(',').slice(0, 2).join(',').trim(),
    full: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

export async function fetchRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`
    + '?overview=full&geometries=geojson&steps=true&annotations=false';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Ruttjänsten svarade inte.');
  const data = await res.json();
  const leg = data?.routes?.[0];
  if (!leg) throw new Error('Hittade ingen körbar väg dit.');
  return {
    coords: leg.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    distance: leg.distance,
    duration: leg.duration,
    steps: (leg.legs?.[0]?.steps ?? []).map((s) => ({
      lat: s.maneuver.location[1],
      lon: s.maneuver.location[0],
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      name: s.name || '',
      distance: s.distance,
    })),
  };
}

const TURN_TEXT = {
  left: 'Sväng vänster', right: 'Sväng höger',
  'slight left': 'Håll vänster', 'slight right': 'Håll höger',
  'sharp left': 'Skarp vänster', 'sharp right': 'Skarp höger',
  straight: 'Fortsätt rakt fram', uturn: 'Vänd',
};

function stepText(step) {
  if (!step) return 'Fortsätt';
  if (step.type === 'arrive') return 'Framme';
  if (step.type === 'depart') return 'Kör iväg';
  if (step.type === 'roundabout' || step.type === 'rotary') return 'In i rondellen';
  return TURN_TEXT[step.modifier] ?? 'Fortsätt';
}

const stepIcon = (step) => {
  const m = step?.modifier ?? '';
  if (step?.type === 'arrive') return 'target';
  if (m.includes('left')) return 'arrowLeft';
  if (m.includes('right')) return 'arrowRight';
  return 'arrowUp';
};

/** Sätt färdmål utifrån röstkommando eller val i listan. */
export async function navigateTo(place) {
  nav.destination = place;
  nav.route = null;
  nav.stepIndex = 0;
  nav.spokenStep = -1;
  emit('nav:changed', nav);

  const origin = here() ?? await fixOnce().catch(() => null);
  if (!origin) { toast('Väntar på GPS innan rutten kan beräknas.', 'warn'); return; }
  try {
    nav.route = await fetchRoute(origin, place);
    emit('nav:changed', nav);
    say(`Rutt till ${place.label}. ${fmtDistance(nav.route.distance)}, ${Math.round(nav.route.duration / 60)} minuter.`);
  } catch (err) {
    toast(`${err.message} Visar riktning i stället.`, 'warn', 4200);
    say(`${place.label}. ${fmtDistance(distanceBetween(origin, place))} fågelvägen.`);
  }
}

export const currentDestination = () => nav.destination;

export function clearRoute() {
  nav.destination = null;
  nav.route = null;
  emit('nav:changed', nav);
}

/* ---------- Appen ---------- */
export const navApp = {
  id: 'nav',
  name: 'Navigation',
  icon: 'nav',
  dock: true,
  flush: true,

  mount(root) {
    const canvas = el('canvas', { class: 'map-canvas' });
    const turnCard = el('div', { class: 'turn-card', hidden: true });
    const etaBar = el('div', { class: 'eta-bar' });
    const side = el('div', { class: 'map-side' });
    const panel = el('div', { class: 'screen', style: 'background:var(--r-bg);z-index:5', hidden: true });

    const fab = (name, label, onClick) =>
      el('button', { class: 'map-fab', 'aria-label': label, onClick }, icon(name));

    side.append(
      fab('target', 'Sök färdmål', () => { panel.hidden = false; }),
      fab('nav', 'Växla kartriktning', () => {
        nav.headingUp = !nav.headingUp;
        toast(nav.headingUp ? 'Karta i färdriktning' : 'Karta med norr uppåt');
      }),
      fab('plus', 'Zooma in', () => { nav.zoom = Math.min(18, nav.zoom + 1); }),
      fab('warn', 'Rapportera hinder', () => { emit('alerts:quickreport'); }),
    );

    root.append(
      el('div', { class: 'map-wrap' }, canvas),
      el('div', { class: 'map-overlay' }, turnCard, side, etaBar),
      panel,
    );

    buildSearchPanel(panel);

    /* ----- ritning ----- */
    const ctx = canvas.getContext('2d');
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    function draw() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const night = document.body.dataset.theme !== 'day';
      ctx.save();
      ctx.fillStyle = night ? '#070c16' : '#dfe6ef';
      ctx.fillRect(0, 0, w, h);

      const pos = here();
      if (!pos) {
        ctx.fillStyle = night ? '#7c8aa6' : '#4a5568';
        ctx.font = '600 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sensors.status === 'denied' ? 'Platsåtkomst nekad' : 'Söker satelliter…', w / 2, h / 2);
        ctx.restore();
        raf = requestAnimationFrame(draw);
        return;
      }

      const z = nav.zoom;
      const cx = lon2x(pos.lon, z) * TILE;
      const cy = lat2y(pos.lat, z) * TILE;
      // Föraren ser mest värde framåt — lägg egen position en bit ned på skärmen.
      const anchorY = h * 0.68;
      const rot = nav.headingUp && Number.isFinite(sensors.heading) ? (-sensors.heading * Math.PI) / 180 : 0;

      ctx.save();
      ctx.translate(w / 2, anchorY);
      ctx.rotate(rot);
      ctx.translate(-w / 2, -anchorY);

      const project = (lat, lon) => [
        lon2x(lon, z) * TILE - cx + w / 2,
        lat2y(lat, z) * TILE - cy + anchorY,
      ];

      if (nav.online && tilesUsable()) {
        const span = Math.hypot(w, h);
        const x0 = Math.floor((cx - span) / TILE);
        const x1 = Math.ceil((cx + span) / TILE);
        const y0 = Math.floor((cy - span) / TILE);
        const y1 = Math.ceil((cy + span) / TILE);
        ctx.globalAlpha = night ? 0.72 : 1;
        for (let tx = x0; tx <= x1; tx += 1) {
          for (let ty = y0; ty <= y1; ty += 1) {
            const img = getTile(z, tx, ty);
            if (!img?.complete || !img.naturalWidth) continue;
            ctx.drawImage(img, tx * TILE - cx + w / 2, ty * TILE - cy + anchorY, TILE, TILE);
          }
        }
        ctx.globalAlpha = 1;
        if (night) { // dämpa kartan så den inte bländar i mörker
          ctx.fillStyle = 'rgba(6,10,20,.45)';
          ctx.fillRect(-span, -span, w + span * 2, h + span * 2);
        }
      } else {
        drawFallbackGrid(ctx, w, h, cx, cy, night);
      }

      if (nav.route?.coords?.length) {
        ctx.lineWidth = 11;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(4,20,32,.55)';
        traceRoute(ctx, nav.route.coords, project);
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#38bdf8';
        traceRoute(ctx, nav.route.coords, project);
      } else if (nav.destination) {
        const [dx, dy] = project(nav.destination.lat, nav.destination.lon);
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(w / 2, anchorY);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const hazard of state.hazards) {
        const [hx, hy] = project(hazard.lat, hazard.lon);
        if (hx < -60 || hy < -60 || hx > w + 60 || hy > h + 60) continue;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(hx, hy, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      if (state.parking) {
        const [px, py] = project(state.parking.lat, state.parking.lon);
        ctx.fillStyle = '#a78bfa';
        ctx.fillRect(px - 9, py - 9, 18, 18);
      }

      if (nav.destination) {
        const [dx, dy] = project(nav.destination.lat, nav.destination.lon);
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(dx, dy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#04231a';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();

      drawOwnMarker(ctx, w / 2, anchorY, nav.headingUp ? 0 : ((sensors.heading ?? 0) * Math.PI) / 180);

      ctx.font = '500 11px system-ui, sans-serif';
      if (nav.online && tilesUsable()) {
        ctx.fillStyle = night ? 'rgba(200,215,240,.55)' : 'rgba(30,40,60,.65)';
        ctx.textAlign = 'right';
        ctx.fillText('© OpenStreetMap-bidragsgivare', w - 8, h - 7);
      } else {
        ctx.fillStyle = night ? 'rgba(160,180,215,.72)' : 'rgba(40,60,90,.7)';
        ctx.textAlign = 'left';
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(navigator.onLine
          ? 'Ingen kartdata — rutnätet visar skala, inte gator'
          : 'Offline — rutnätet visar skala, inte gator', 12, h - 8);
      }
      ctx.restore();
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);

    /* ----- textpanelerna ----- */
    function renderGuidance() {
      const pos = here();
      const dest = nav.destination;

      if (!dest) {
        turnCard.hidden = true;
        setKids(etaBar, 
          el('div', {}, el('b', { text: Math.round(sensors.speedKmh) || '–' }), el('small', { text: 'km/h' })),
          el('div', {}, el('b', { text: Number.isFinite(sensors.heading) ? compassName(sensors.heading) : '–' }), el('small', { text: 'riktning' })),
          el('div', {}, el('b', { text: sensors.accuracy ? `±${Math.round(sensors.accuracy)} m` : '–' }), el('small', { text: 'GPS' })),
        );
        return;
      }

      const remaining = pos ? distanceBetween(pos, dest) : NaN;

      if (nav.route?.steps?.length && pos) {
        // Nästa manöver = första steget vi ännu inte passerat.
        while (nav.stepIndex < nav.route.steps.length - 1
          && distanceBetween(pos, nav.route.steps[nav.stepIndex]) < 25) nav.stepIndex += 1;
        const step = nav.route.steps[nav.stepIndex];
        const toStep = distanceBetween(pos, step);

        turnCard.hidden = false;
        setKids(turnCard, 
          icon(stepIcon(step), 'turn-icon'),
          el('div', { class: 'grow' },
            el('div', { class: 'turn-dist', text: `${fmtDistance(toStep)} · ${stepText(step)}` }),
            el('div', { class: 'turn-street', text: step.name || dest.label }),
          ),
        );

        // Säg svängen en gång, ca 200 m innan.
        if (toStep < 220 && nav.spokenStep !== nav.stepIndex && step.type !== 'depart') {
          nav.spokenStep = nav.stepIndex;
          say(`Om ${fmtDistance(toStep)}, ${stepText(step)}${step.name ? ` mot ${step.name}` : ''}.`);
          buzz([25, 60, 25]);
        }
      } else {
        const bearing = pos ? bearingBetween(pos, dest) : NaN;
        turnCard.hidden = false;
        setKids(turnCard, 
          icon('target', 'turn-icon'),
          el('div', { class: 'grow' },
            el('div', { class: 'turn-dist', text: fmtDistance(remaining) }),
            el('div', { class: 'turn-street', text: Number.isFinite(bearing) ? `${dest.label} · mot ${compassName(bearing)}` : dest.label }),
          ),
        );
      }

      const speed = sensors.speedKmh > 5 ? sensors.speedKmh : 50;
      const secs = nav.route ? (remaining / Math.max(nav.route.distance, 1)) * nav.route.duration
        : (remaining / (speed / 3.6));
      const eta = new Date(Date.now() + secs * 1000);

      setKids(etaBar, 
        el('div', {}, el('b', { text: fmtDistance(remaining) }), el('small', { text: 'kvar' })),
        el('div', {}, el('b', { text: Number.isFinite(secs) ? fmtDuration(secs * 1000) : '–' }), el('small', { text: 'restid' })),
        el('div', {}, el('b', { text: Number.isFinite(secs) ? eta.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '–' }), el('small', { text: 'framme' })),
        el('button', { class: 'btn small', onClick: () => { clearRoute(); renderGuidance(); } }, 'Avsluta'),
      );

      if (Number.isFinite(remaining) && remaining < 60) {
        clearRoute();
        say('Du är framme.');
        toast('Framme vid färdmålet.', 'ok');
      }
    }

    renderGuidance();
    const unbind = [
      on('sensors:fix', renderGuidance),
      on('nav:changed', renderGuidance),
      on('online:changed', (isOnline) => { nav.online = isOnline; }),
    ];
    const tick = setInterval(renderGuidance, 2000);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearInterval(tick);
      unbind.forEach((fn) => fn());
    };
  },
};

function traceRoute(ctx, coords, project) {
  ctx.beginPath();
  coords.forEach(([lat, lon], i) => {
    const [x, y] = project(lat, lon);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawOwnMarker(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(56,189,248,.22)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#04202e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(12, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-12, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Offline-rutnät: ger rörelsekänsla och skala utan att påstå att det är gator. */
function drawFallbackGrid(ctx, w, h, cx, cy, night) {
  const spacing = 64;
  ctx.strokeStyle = night ? 'rgba(120,150,200,.16)' : 'rgba(40,60,90,.16)';
  ctx.lineWidth = 1;
  const ox = -(cx % spacing);
  const oy = -(cy % spacing);
  ctx.beginPath();
  for (let x = ox - spacing; x < w + spacing * 2; x += spacing) { ctx.moveTo(x, -spacing); ctx.lineTo(x, h + spacing); }
  for (let y = oy - spacing; y < h + spacing * 2; y += spacing) { ctx.moveTo(-spacing, y); ctx.lineTo(w + spacing, y); }
  ctx.stroke();
}

/* ---------- Sök- och favoritpanel ---------- */
function buildSearchPanel(panel) {
  const input = el('input', { class: 'input', type: 'search', placeholder: 'Adress eller plats', enterkeyhint: 'search' });
  const results = el('div', { class: 'list' });
  const favorites = el('div', { class: 'list' });

  async function runSearch() {
    const query = input.value.trim();
    if (query.length < 3) { toast('Skriv minst tre tecken.', 'warn'); return; }
    setKids(results, el('div', { class: 'hint', text: 'Söker…' }));
    try {
      const hits = await geocode(query);
      if (!hits.length) { setKids(results, el('div', { class: 'hint', text: 'Inga träffar.' })); return; }
      setKids(results, ...hits.map((hit) => el('button', {
        class: 'list-item',
        onClick: () => { navigateTo(hit); panel.hidden = true; },
      },
        icon('target'),
        el('div', { class: 'li-main' }, el('b', { text: hit.label }), el('small', { text: hit.full })),
        el('button', {
          class: 'btn small',
          onClick: (ev) => { ev.stopPropagation(); saveFavorite(hit); renderFavorites(); },
          text: 'Spara',
        }),
      )));
    } catch {
      setKids(results, el('div', { class: 'hint warn', text: 'Sökning kräver nätverk. Använd en sparad plats i stället.' }));
    }
  }

  function renderFavorites() {
    const items = state.places.filter((p) => p.lat != null);
    setKids(favorites, 
      ...items.map((place) => el('button', {
        class: 'list-item',
        onClick: () => { navigateTo(place); panel.hidden = true; },
      },
        el('span', { class: 'avatar', text: place.label.slice(0, 1).toUpperCase() }),
        el('div', { class: 'li-main' },
          el('b', { text: place.label }),
          el('small', { text: `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}` })),
        el('span', { class: 'li-end', text: here() ? fmtDistance(distanceBetween(here(), place)) : '' }),
      )),
      items.length ? null : el('div', { class: 'hint', text: 'Inga sparade platser än. Sök fram en adress och tryck Spara, eller spara var du står nu.' }),
    );
  }

  panel.append(
    el('div', { class: 'spread' },
      el('h3', { style: 'font-size:20px;font-weight:800', text: 'Vart ska du?' }),
      el('button', { class: 'btn small', onClick: () => { panel.hidden = true; } }, icon('x'), 'Stäng'),
    ),
    el('div', { class: 'row', style: 'margin:12px 0' },
      el('div', { class: 'grow' }, input),
      el('button', { class: 'btn primary', onClick: runSearch }, 'Sök'),
    ),
    results,
    el('div', { class: 'divider', style: 'margin:16px 0' }),
    el('div', { class: 'spread', style: 'margin-bottom:10px' },
      el('h3', { style: 'font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--r-muted)', text: 'Sparade platser' }),
      el('button', {
        class: 'btn small',
        onClick: async () => {
          try {
            const pos = await fixOnce();
            const label = prompt('Namn på platsen?', 'Ny plats');
            if (!label) return;
            push('places', { id: uid(), label, lat: pos.lat, lon: pos.lon });
            renderFavorites();
            toast('Platsen sparad.', 'ok');
          } catch (err) { toast(err.message, 'err'); }
        },
      }, icon('plus'), 'Spara här'),
    ),
    favorites,
  );

  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') runSearch(); });
  renderFavorites();
  on('places:changed', renderFavorites);
}

function saveFavorite(hit) {
  const existing = state.places.find((p) => p.label === hit.label);
  if (existing) { existing.lat = hit.lat; existing.lon = hit.lon; save(); }
  else push('places', { id: uid(), label: hit.label, lat: hit.lat, lon: hit.lon });
  toast(`${hit.label} sparad.`, 'ok');
}
