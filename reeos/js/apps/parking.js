/** Parkering: var bilen står, hur lång tid som är betald, och vägen tillbaka.
 *  Allt sparas lokalt — ingen behöver veta var du parkerar. */
import { el, icon, toast, fmtDistance, fmtDuration, fmtDateTime, confirmBig, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, setValue } from '../core/store.js';
import { sensors, here, distanceBetween, bearingBetween, compassName, fixOnce, requestOrientationPermission, watchOrientation } from '../core/sensors.js';
import { say } from '../core/speech.js';

let meterTimer = null;

export async function saveSpot({ note = '', level = '', photo = null, minutes = 0 } = {}) {
  const pos = await fixOnce();
  const spot = {
    lat: pos.lat, lon: pos.lon, accuracy: pos.accuracy,
    at: Date.now(), note, level, photo,
    meterEndsAt: minutes > 0 ? Date.now() + minutes * 60000 : null,
  };
  setValue('parking', spot);
  emit('parking:changed', spot);
  armMeter();
  return spot;
}

export function clearSpot() {
  setValue('parking', null);
  emit('parking:changed', null);
  clearTimeout(meterTimer);
}

/** Larmar fem minuter innan p-tiden går ut, och när den gör det. */
export function armMeter() {
  clearTimeout(meterTimer);
  const spot = state.parking;
  if (!spot?.meterEndsAt) return;

  const schedule = (at, fn) => {
    const delay = at - Date.now();
    if (delay <= 0 || delay > 2 ** 31 - 1) return null;
    return setTimeout(fn, delay);
  };

  meterTimer = schedule(spot.meterEndsAt - 5 * 60000, () => {
    buzz([60, 100, 60]);
    say('Fem minuter kvar på parkeringen.', { force: true });
    toast('Fem minuter kvar på p-tiden.', 'warn', 8000);
    meterTimer = schedule(spot.meterEndsAt, expired);
  }) ?? schedule(spot.meterEndsAt, expired);
}

function expired() {
  buzz([120, 80, 120, 80, 120]);
  say('Parkeringstiden har gått ut.', { force: true });
  toast('P-tiden har gått ut.', 'err', 10000);
}

export const parkingApp = {
  id: 'parking',
  name: 'Parkering',
  icon: 'parking',

  mount(root) {
    const body = el('div', { class: 'stack' });
    root.append(body);

    const photoInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only' });
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0];
      photoInput.value = '';
      if (!file || !state.parking) return;
      const reader = new FileReader();
      reader.onload = () => {
        // Bilden skalas ned innan den sparas — localStorage rymmer inte en råbild.
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 640 / Math.max(img.width, img.height));
          const canvas = el('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          state.parking.photo = canvas.toDataURL('image/jpeg', 0.62);
          setValue('parking', state.parking);
          render();
          toast('Foto sparat till p-platsen.', 'ok');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    async function doSave() {
      try {
        toast('Läser av position…');
        const minutes = Number(minutesInput.value) || 0;
        await saveSpot({ note: noteInput.value.trim(), level: levelInput.value.trim(), minutes });
        say('Parkeringen är sparad.');
        render();
      } catch (err) { toast(err.message, 'err'); }
    }

    const noteInput = el('input', { class: 'input', placeholder: 'T.ex. Blå zon vid ingång C' });
    const levelInput = el('input', { class: 'input', placeholder: 'Plan / plats' });
    const minutesInput = el('input', { class: 'input', type: 'number', min: '0', max: '1440', placeholder: 'Minuter (valfritt)' });

    function renderEmpty() {
      setKids(body, 
        el('div', { class: 'card stack' },
          el('h3', { style: 'margin:0', text: 'Spara var bilen står' }),
          el('div', { class: 'field' }, el('label', { text: 'Anteckning' }), noteInput),
          el('div', { class: 'field' }, el('label', { text: 'Våning eller platsnummer' }), levelInput),
          el('div', { class: 'field' }, el('label', { text: 'Betald tid' }), minutesInput),
          el('button', { class: 'btn block primary', onClick: doSave }, icon('parking'), 'Spara platsen'),
        ),
        el('p', { class: 'hint', text: 'Positionen sparas bara i den här telefonen och kan raderas när som helst.' }),
      );
    }

    function renderSpot() {
      const spot = state.parking;
      const pos = here();
      const dist = distanceBetween(pos, spot);
      const bearing = bearingBetween(pos, spot);
      const left = spot.meterEndsAt ? spot.meterEndsAt - Date.now() : null;

      const needle = el('div', { class: 'needle' });
      if (Number.isFinite(bearing)) {
        const relative = Number.isFinite(sensors.heading) ? bearing - sensors.heading : bearing;
        needle.style.transform = `rotate(${relative}deg)`;
      }

      setKids(body, 
        el('div', { class: 'card' },
          el('div', { class: 'spread' },
            el('div', {},
              el('div', { class: 'big-num', text: Number.isFinite(dist) ? fmtDistance(dist) : '–' }),
              el('div', { class: 'hint', text: Number.isFinite(bearing) ? `Bilen står mot ${compassName(bearing)}` : 'Väntar på position' }),
            ),
            left === null ? null : el('span', { class: `pill ${left < 0 ? 'red' : left < 600000 ? 'amber' : 'green'}`,
              text: left < 0 ? 'TIDEN UTE' : `${fmtDuration(left)} kvar` }),
          ),
          el('div', { style: 'height:16px' }),
          el('div', { class: 'compass' }, needle),
          el('div', { class: 'hint', style: 'text-align:center;margin-top:10px', text: 'Pilen pekar mot bilen när du håller telefonen framför dig.' }),
        ),
        el('div', { class: 'card stack' },
          el('div', { class: 'spread' }, el('b', { text: 'Parkerad' }), el('span', { class: 'hint', text: fmtDateTime(spot.at) })),
          spot.note ? el('div', { class: 'spread' }, el('b', { text: 'Anteckning' }), el('span', { class: 'hint', text: spot.note })) : null,
          spot.level ? el('div', { class: 'spread' }, el('b', { text: 'Plats' }), el('span', { class: 'hint', text: spot.level })) : null,
          el('div', { class: 'spread' }, el('b', { text: 'Koordinat' }), el('span', { class: 'hint', style: 'user-select:text', text: `${spot.lat.toFixed(5)}, ${spot.lon.toFixed(5)}` })),
          spot.photo ? el('img', { src: spot.photo, alt: 'Foto på parkeringsplatsen', style: 'width:100%;border-radius:14px;margin-top:6px' }) : null,
        ),
        el('div', { class: 'row' },
          el('button', { class: 'btn grow', onClick: () => photoInput.click() }, icon('cam'), spot.photo ? 'Nytt foto' : 'Ta foto'),
          el('button', {
            class: 'btn grow',
            onClick: () => {
              const minutes = Number(prompt('Hur många minuter till?', '60'));
              if (!minutes || minutes < 0) return;
              spot.meterEndsAt = Math.max(Date.now(), spot.meterEndsAt ?? Date.now()) + minutes * 60000;
              setValue('parking', spot);
              armMeter();
              render();
            },
          }, icon('clock'), 'Förläng tid'),
        ),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn grow',
            onClick: () => {
              const url = `https://www.openstreetmap.org/?mlat=${spot.lat}&mlon=${spot.lon}#map=19/${spot.lat}/${spot.lon}`;
              navigator.share?.({ title: 'Här står bilen', url }) ?? window.open(url, '_blank', 'noopener');
            },
          }, icon('share'), 'Dela plats'),
          el('button', {
            class: 'btn grow danger',
            onClick: async () => {
              if (await confirmBig('Rensa p-platsen?', 'Position, foto och tidräkning tas bort.', 'Rensa')) { clearSpot(); render(); }
            },
          }, icon('trash'), 'Kör härifrån'),
        ),
        photoInput,
      );
    }

    const render = () => (state.parking ? renderSpot() : renderEmpty());

    requestOrientationPermission().then((ok) => { if (ok) watchOrientation(); });
    render();
    const timer = setInterval(() => { if (state.parking) render(); }, 2000);
    const unbind = on('parking:changed', render);
    return () => { clearInterval(timer); unbind(); };
  },
};
