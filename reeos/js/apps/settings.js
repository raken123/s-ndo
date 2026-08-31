/** Inställningar. Få reglage, stora ytor, inget som behöver läsas i fart. */
import { el, icon, toast, downloadFile, confirmBig } from '../core/ui.js';
import { state, setSetting, resetAll, exportJSON, importJSON } from '../core/store.js';
import { emit } from '../core/bus.js';
import { sensors, keepScreenAwake, startGPS } from '../core/sensors.js';
import { say, canListen } from '../core/speech.js';

function toggleRow(key, title, subtitle, onChange) {
  const knob = el('span', { class: `switch${state.settings[key] ? ' on' : ''}` });
  return el('button', {
    class: 'toggle',
    onClick: () => {
      const value = !state.settings[key];
      setSetting(key, value);
      knob.classList.toggle('on', value);
      onChange?.(value);
    },
  },
    el('div', { class: 't-main' }, el('b', { text: title }), el('small', { text: subtitle })),
    knob,
  );
}

export const settingsApp = {
  id: 'settings',
  name: 'Inställningar',
  icon: 'gear',

  mount(root) {
    const themeChips = el('div', { class: 'chips' },
      ...[['auto', 'Automatiskt'], ['night', 'Mörkt'], ['day', 'Ljust']].map(([value, label]) =>
        el('button', {
          class: `chip-btn${state.settings.theme === value ? ' on' : ''}`,
          onClick: (ev) => {
            setSetting('theme', value);
            [...themeChips.children].forEach((c) => c.classList.remove('on'));
            ev.currentTarget.classList.add('on');
            emit('theme:apply');
          },
          text: label,
        })),
    );

    const speedChips = el('div', { class: 'chips' },
      ...[0, 50, 70, 90, 110, 120].map((limit) =>
        el('button', {
          class: `chip-btn${state.settings.speedWarnAt === limit ? ' on' : ''}`,
          onClick: (ev) => {
            setSetting('speedWarnAt', limit);
            [...speedChips.children].forEach((c) => c.classList.remove('on'));
            ev.currentTarget.classList.add('on');
          },
          text: limit === 0 ? 'Av' : `${limit} km/h`,
        })),
    );

    const rate = el('input', { type: 'range', min: '70', max: '150', value: String((state.settings.voiceRate ?? 1) * 100), class: 'grow' });
    rate.addEventListener('change', () => {
      setSetting('voiceRate', Number(rate.value) / 100);
      say('Så här låter det.');
    });

    const importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only' });
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      try {
        importJSON(await file.text());
        toast('Inställningar och data inlästa.', 'ok');
        setTimeout(() => location.reload(), 900);
      } catch (err) { toast(err.message, 'err'); }
    });

    root.append(
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Skärm' }),
        themeChips,
        el('p', { class: 'hint', text: 'Automatiskt växlar till mörkt läge mellan solnedgång och gryning.' }),
        el('div', { class: 'divider' }),
        toggleRow('wakeLock', 'Håll skärmen tänd', 'Skärmen slocknar inte medan ReeOS är öppet', (on) => keepScreenAwake(on)),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Röst' }),
        toggleRow('voice', 'Röstsvar', 'ReeOS läser upp svängar och varningar'),
        el('div', { class: 'row', style: 'align-items:center;gap:12px' }, icon('volume'), rate),
        el('p', { class: 'hint', text: canListen ? 'Rösttolkning fungerar i den här webbläsaren.' : 'Rösttolkning saknas här — dikteringen kräver Chrome eller Safari.' }),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Körning' }),
        toggleRow('speedVolume', 'Fartanpassad volym', 'Musiken lyfts något när vägbruset ökar'),
        toggleRow('lockWhileDriving', 'Lås textinmatning i rörelse', 'Tangentbordet ersätts av diktering över 8 km/h'),
        toggleRow('autoTripLog', 'Automatisk färddagbok', 'Resan börjar loggas när bilen rullar'),
        el('div', { class: 'divider' }),
        el('div', {}, el('b', { text: 'Fartvarning' }), el('div', { class: 'hint', style: 'margin-bottom:8px', text: 'Pip och röd HUD över vald hastighet.' }), speedChips),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Data' }),
        el('p', { class: 'hint', text: 'Allt ReeOS sparar ligger i den här telefonen: resor, platser, kontakter, markeringar och klipp. Ingenting skickas till någon server.' }),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn grow',
            onClick: () => downloadFile(`reeos-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(), 'application/json'),
          }, icon('download'), 'Exportera allt'),
          el('button', { class: 'btn grow', onClick: () => importInput.click() }, icon('upload'), 'Importera'),
        ),
        el('button', {
          class: 'btn block danger',
          onClick: async () => {
            if (await confirmBig('Nollställ ReeOS?', 'Alla resor, platser, kontakter och markeringar raderas.', 'Nollställ')) {
              resetAll();
              toast('ReeOS är nollställt.', 'ok');
              setTimeout(() => location.reload(), 800);
            }
          },
        }, icon('trash'), 'Nollställ allt'),
        importInput,
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Status' }),
        el('div', { class: 'spread' }, el('span', { text: 'GPS' }),
          el('span', { class: `pill ${sensors.status === 'live' ? 'green' : sensors.status === 'denied' ? 'red' : 'amber'}`, text: sensors.status })),
        sensors.status !== 'live'
          ? el('button', { class: 'btn block', onClick: () => { startGPS(); toast('Begär plats…'); } }, icon('target'), 'Aktivera plats')
          : el('div', { class: 'hint', text: `Noggrannhet ±${Math.round(sensors.accuracy ?? 0)} m` }),
        el('div', { class: 'hint', text: `Totalt loggat: ${state.stats.totalKm.toFixed(1)} km · ${state.trips.length} resor` }),
      ),
      el('div', { style: 'height:12px' }),
      el('p', { class: 'hint', style: 'text-align:center', text: 'ReeOS · körs helt i webbläsaren · version 1.0' }),
    );
  },
};
