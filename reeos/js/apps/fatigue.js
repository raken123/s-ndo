/** Trötthetsvakt.
 *  Räknar sammanhängande körtid, väger in klockslaget och påminner om paus.
 *  Varningen tar aldrig över skärmen medan bilen rullar — då kommer den som
 *  röst och banner, och helskärmen väntar tills du står stilla. */
import { el, icon, toast, fmtDuration, buzz, setKids } from '../core/ui.js';
import { on, emit } from '../core/bus.js';
import { state, save } from '../core/store.js';
import { sensors } from '../core/sensors.js';
import { say } from '../core/speech.js';

const BREAK_MS = 10 * 60 * 1000;   // stillastående så länge räknas som rast

const watch = {
  drivingMs: 0,
  lastTick: Date.now(),
  stoppedSince: null,
  warned: 0,          // 0 = inget, 1 = förvarning, 2 = full varning
  lastCheckAt: 0,
  reactionMs: null,
};

/** 0–1. Riktvärde, inte en medicinsk bedömning. */
export function riskScore() {
  const limitMs = state.settings.breakAfterMin * 60 * 1000;
  const fromTime = Math.min(watch.drivingMs / limitMs, 1.3) * 0.6;
  const hour = new Date().getHours();
  // Dygnsrytmens två svackor: natten och tidiga eftermiddagen.
  const fromHour = (hour >= 1 && hour < 6) ? 0.34 : (hour >= 13 && hour < 15) ? 0.16 : (hour >= 22 || hour < 1) ? 0.2 : 0;
  const fromReaction = watch.reactionMs && watch.reactionMs > 420 ? 0.14 : 0;
  return Math.min(1, fromTime + fromHour + fromReaction);
}

export function fatigueStatus() {
  const limitMs = state.settings.breakAfterMin * 60 * 1000;
  return {
    drivingMs: watch.drivingMs,
    limitMs,
    dueForBreak: watch.drivingMs >= limitMs,
    risk: riskScore(),
    reactionMs: watch.reactionMs,
    sinceBreak: watch.stoppedSince,
  };
}

export function takeBreak(quiet = false) {
  watch.drivingMs = 0;
  watch.warned = 0;
  state.stats.breaks += 1;
  save();
  emit('fatigue:changed', fatigueStatus());
  if (!quiet) toast('Körtiden nollställd. Kör försiktigt.', 'ok');
}

export function initFatigueWatch() {
  setInterval(() => {
    const now = Date.now();
    const delta = now - watch.lastTick;
    watch.lastTick = now;
    if (delta > 60000) return;   // fliken har legat i bakgrunden

    if (sensors.driving) {
      watch.drivingMs += delta;
      watch.stoppedSince = null;
    } else {
      watch.stoppedSince ??= now;
      if (now - watch.stoppedSince >= BREAK_MS && watch.drivingMs > 0) {
        takeBreak(true);
        toast('Rasten är räknad — körtiden nollställd.', 'ok');
      }
    }

    const { limitMs, dueForBreak } = fatigueStatus();
    if (watch.warned < 1 && watch.drivingMs > limitMs * 0.85) {
      watch.warned = 1;
      say('Du har snart kört i ' + Math.round(limitMs / 60000) + ' minuter. Leta upp ett bra ställe att stanna på.', { force: true });
      toast('Paus om ungefär en kvart — börja titta efter en rastplats.', 'warn', 6000);
    } else if (watch.warned < 2 && dueForBreak) {
      watch.warned = 2;
      buzz([80, 120, 80, 120, 80]);
      say('Dags för paus. Du har kört i ' + fmtDuration(watch.drivingMs) + ' utan rast.', { force: true });
      if (sensors.speedKmh < 3) showBreakOverlay();
      else toast('Dags för paus — stanna vid nästa möjlighet.', 'err', 8000);
    }
    emit('fatigue:tick', fatigueStatus());
  }, 5000);

  // Står bilen stilla när full varning redan gått ut? Då kommer helskärmen.
  on('sensors:driving', (driving) => {
    if (!driving && watch.warned >= 2 && watch.drivingMs >= fatigueStatus().limitMs) showBreakOverlay();
  });
}

function showBreakOverlay() {
  const overlay = document.getElementById('alert-overlay');
  if (!overlay || !overlay.hidden) return;
  overlay.className = 'alert-overlay';
  overlay.hidden = false;
  setKids(overlay, 
    el('h2', { text: 'Ta en paus' }),
    el('p', { text: `Du har kört ${fmtDuration(watch.drivingMs)} utan rast. Femton minuter och lite frisk luft gör verklig skillnad.` }),
    el('div', { class: 'row', style: 'justify-content:center' },
      el('button', { class: 'btn', onClick: () => { overlay.hidden = true; }, text: 'Senare' }),
      el('button', { class: 'btn', onClick: () => { overlay.hidden = true; takeBreak(); }, text: 'Jag rastar nu' }),
    ),
  );
}

export const fatigueApp = {
  id: 'fatigue',
  name: 'Trötthetsvakt',
  icon: 'coffee',

  mount(root) {
    const summary = el('div', { class: 'card' });
    const test = el('div', { class: 'card' });

    root.append(
      summary,
      el('div', { style: 'height:12px' }),
      test,
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Pausintervall' }),
        el('div', { class: 'chips' },
          ...[45, 60, 90, 120].map((min) => el('button', {
            class: `chip-btn${state.settings.breakAfterMin === min ? ' on' : ''}`,
            onClick: (ev) => {
              state.settings.breakAfterMin = min;
              save();
              [...ev.currentTarget.parentElement.children].forEach((c) => c.classList.remove('on'));
              ev.currentTarget.classList.add('on');
              render();
            },
            text: `${min} min`,
          })),
        ),
        el('p', { class: 'hint', text: 'Vakten räknar bara tid då bilen faktiskt rullar. Tio minuter stillastående nollställer räknaren automatiskt.' }),
      ),
      el('div', { style: 'height:12px' }),
      el('p', { class: 'hint', text: 'ReeOS mäter körtid och klockslag — inte ditt medicinska tillstånd. Känner du dig trött ska du stanna oavsett vad appen säger.' }),
    );

    function render() {
      const status = fatigueStatus();
      const pct = Math.min(100, (status.drivingMs / status.limitMs) * 100);
      const risk = status.risk;
      const bar = el('i', { class: risk > 0.75 ? 'high' : risk > 0.45 ? 'mid' : '' });
      bar.style.width = `${Math.max(3, risk * 100)}%`;

      setKids(summary, 
        el('div', { class: 'spread' },
          el('div', {},
            el('div', { class: 'big-num', text: fmtDuration(status.drivingMs) }),
            el('div', { class: 'hint', text: `av ${state.settings.breakAfterMin} min till nästa paus` }),
          ),
          el('span', { class: `pill ${risk > 0.75 ? 'red' : risk > 0.45 ? 'amber' : 'green'}`,
            text: risk > 0.75 ? 'HÖG RISK' : risk > 0.45 ? 'VAR VAKSAM' : 'PIGG' }),
        ),
        el('div', { style: 'height:12px' }),
        el('div', { class: 'bar-meter' }, bar),
        el('div', { class: 'hint', style: 'margin-top:8px', text: `Körtid ${Math.round(pct)} % · klockslag väger in mellan 01–06 och 13–15.` }),
        el('div', { style: 'height:14px' }),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary grow', onClick: () => { takeBreak(); render(); } }, icon('coffee'), 'Jag tar paus nu'),
        ),
        el('div', { class: 'hint', style: 'margin-top:10px', text: `Totalt ${state.stats.breaks} registrerade pauser.` }),
      );
    }

    /* Vakenhetskoll: enkel reaktionsmätning, bara när bilen står still. */
    function renderTest(phase = 'idle', payload = null) {
      if (sensors.driving) {
        setKids(test, 
          el('h3', { text: 'Vakenhetskoll' }),
          el('div', { class: 'hint warn', text: 'Testet går bara att göra när bilen står stilla.' }),
        );
        return;
      }

      if (phase === 'idle') {
        setKids(test, 
          el('h3', { text: 'Vakenhetskoll' }),
          el('p', { class: 'hint', style: 'margin-bottom:12px', text: 'Tryck när rutan blir grön. Under 400 ms är normalt utvilat.' }),
          watch.reactionMs ? el('div', { class: 'hint', style: 'margin-bottom:10px', text: `Senaste: ${watch.reactionMs} ms` }) : null,
          el('button', { class: 'btn block primary', onClick: runTest }, icon('eye'), 'Starta test'),
        );
      } else if (phase === 'wait') {
        setKids(test, 
          el('h3', { text: 'Vakenhetskoll' }),
          el('button', { class: 'btn block', id: 'reaction-pad', style: 'min-height:150px;font-size:20px', text: 'Vänta på grönt…' }),
        );
      } else if (phase === 'go') {
        const pad = el('button', { class: 'btn block', style: 'min-height:150px;font-size:20px;background:var(--r-green);color:#04231a', text: 'TRYCK!' });
        pad.addEventListener('click', payload, { once: true });
        setKids(test, el('h3', { text: 'Vakenhetskoll' }), pad);
      } else if (phase === 'done') {
        const ms = payload;
        setKids(test, 
          el('h3', { text: 'Vakenhetskoll' }),
          el('div', { class: 'big-num' }, String(ms), el('small', { text: 'ms' })),
          el('p', { class: 'hint', style: 'margin:10px 0', text: ms < 400
            ? 'Normal reaktionstid. Kör vidare, men glöm inte pausen.'
            : ms < 550 ? 'Något långsamt. Överväg en kort paus.'
            : 'Klart långsammare än vaket normalläge. Stanna och vila.' }),
          el('button', { class: 'btn block', onClick: () => renderTest('idle') }, 'Kör om testet'),
        );
      }
    }

    let testTimer = null;
    function runTest() {
      renderTest('wait');
      testTimer = setTimeout(() => {
        const startedAt = performance.now();
        renderTest('go', () => {
          const ms = Math.round(performance.now() - startedAt);
          watch.reactionMs = ms;
          watch.lastCheckAt = Date.now();
          buzz();
          renderTest('done', ms);
          render();
        });
      }, 1600 + Math.random() * 2600);
    }

    render();
    renderTest();
    const timer = setInterval(() => { render(); if (!testTimer) renderTest(); }, 4000);
    const unbind = on('fatigue:changed', render);
    return () => { clearInterval(timer); clearTimeout(testTimer); unbind(); };
  },
};
