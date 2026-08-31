/** HUD. Lägg telefonen platt på instrumentbrädan — bilden är spegelvänd så att
 *  vindrutan vänder den rätt. Bara det du behöver se i ögonvrån. */
import { el, icon, fmtDistance, setKids } from '../core/ui.js';
import { on } from '../core/bus.js';
import { state, setSetting } from '../core/store.js';
import { sensors, here, distanceBetween, compassName } from '../core/sensors.js';
import { open } from '../core/router.js';
import { currentDestination } from './nav.js';
import { keepScreenAwake } from '../core/sensors.js';

export const hudApp = {
  id: 'hud',
  name: 'HUD',
  icon: 'hud',
  flush: true,

  mount(root) {
    const speed = el('div', { class: 'hud-speed', text: '0' });
    const row = el('div', { class: 'hud-row' });
    const hud = el('div', { class: `hud${state.settings.hudMirror ? '' : ' no-mirror'}` },
      speed,
      el('div', { class: 'hud-unit', text: 'KM/H' }),
      row,
    );

    // Kontrollerna sitter uppochned i spegelläget; egen rad utanför spegeln.
    const controls = el('div', {
      style: 'position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;padding:14px;z-index:2',
    },
      el('button', { class: 'btn small', onClick: () => open('home') }, icon('home'), 'Stäng'),
      el('button', {
        class: 'btn small',
        onClick: (ev) => {
          const mirror = !state.settings.hudMirror;
          setSetting('hudMirror', mirror);
          hud.classList.toggle('no-mirror', !mirror);
          ev.currentTarget.lastChild.textContent = mirror ? 'Spegling på' : 'Spegling av';
        },
      }, icon('hud'), el('span', { text: state.settings.hudMirror ? 'Spegling på' : 'Spegling av' })),
    );

    root.append(hud, controls);
    keepScreenAwake(true);

    function render() {
      const kmh = Math.round(sensors.speedKmh);
      speed.textContent = Number.isFinite(kmh) ? String(kmh) : '0';

      const limit = state.settings.speedWarnAt;
      hud.classList.toggle('warn', limit > 0 && kmh > limit);

      const dest = currentDestination();
      const remaining = dest ? distanceBetween(here(), dest) : NaN;
      setKids(row, 
        el('span', { text: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) }),
        Number.isFinite(sensors.heading) ? el('span', { text: compassName(sensors.heading) }) : null,
        Number.isFinite(remaining) ? el('span', { text: fmtDistance(remaining) }) : null,
      );
    }

    render();
    const timer = setInterval(render, 500);
    const unbind = on('sensors:fix', render);
    return () => { clearInterval(timer); unbind(); };
  },
};
