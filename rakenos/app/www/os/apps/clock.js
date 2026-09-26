// Clock: World Clock, Alarms, Stopwatch and Timer.
import { h, ic, onLongPress } from '../core/dom.js';
import { settings } from '../core/store.js';
import { clockService as cs } from '../services/alarms.js';
import { section, row, switchEl, emptyState } from '../ui/components.js';
import { sheet, menu, toast } from '../ui/overlays.js';

const ZONES = [
  ['Europe/Stockholm', 'Stockholm'], ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'], ['Europe/Helsinki', 'Helsinki'],
  ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Los_Angeles', 'Los Angeles'], ['America/Sao_Paulo', 'São Paulo'],
  ['Asia/Tokyo', 'Tokyo'], ['Asia/Singapore', 'Singapore'], ['Asia/Kolkata', 'Mumbai'], ['Asia/Dubai', 'Dubai'], ['Asia/Shanghai', 'Shanghai'],
  ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland'], ['Africa/Nairobi', 'Nairobi'], ['Africa/Johannesburg', 'Johannesburg'],
];
const cityName = (z) => (ZONES.find((x) => x[0] === z) || [z, z.split('/').pop().replace(/_/g, ' ')])[1];
const pad = (n) => String(n).padStart(2, '0');
function offsetLabel(zone) {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US'));
  const there = new Date(now.toLocaleString('en-US', { timeZone: zone }));
  const diff = Math.round((there - local) / 3600000 * 2) / 2;
  const day = there.getDate() === local.getDate() ? 'Today' : there > local ? 'Tomorrow' : 'Yesterday';
  return `${day}, ${diff === 0 ? 'same time' : `${diff > 0 ? '+' : ''}${diff} h`}`;
}
const fmtSW = (ms) => { const cs_ = Math.floor(ms / 10) % 100; const s = Math.floor(ms / 1000) % 60; const m = Math.floor(ms / 60000); return `${pad(m)}:${pad(s)},${pad(cs_)}`; };
const fmtTimer = (ms) => { const t = Math.ceil(ms / 1000); const hh = Math.floor(t / 3600); const m = Math.floor(t / 60) % 60; const s = t % 60; return hh ? `${hh}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };

export default {
  mount(container, ctx) {
    let tab = 'world'; let raf = null; let tick = null;
    const body = h('div', { class: 'clock__body' });
    const tabs = h('nav', { class: 'tabbar', role: 'tablist' });
    const root = h('div', { class: 'clock' }, body, tabs);
    container.appendChild(root);
    const TABS = [['world', 'World Clock', 'globe'], ['alarms', 'Alarms', 'alarm'], ['stopwatch', 'Stopwatch', 'stopwatch'], ['timer', 'Timer', 'timer']];
    const renderTabs = () => tabs.replaceChildren(...TABS.map(([k, l, i]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), class: `tabbar__item ${tab === k ? 'is-active' : ''}`, onclick: () => { tab = k; render(); } }, ic(i), h('span', null, l))));
    const header = (title, trailing) => h('div', { class: 'app-head' }, h('h1', { class: 'r-large-title' }, title), trailing || null);

    const views = {
      world() {
        const cities = settings.get('clockCities');
        const add = h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'Add city', onclick: () => sheet({ title: 'Choose a city', build: (close) => h('div', { class: 'r-list' }, ZONES.filter(([z]) => !cities.includes(z)).map(([z, n]) => h('button', { class: 'r-row', onclick: () => { settings.set({ clockCities: [...settings.get('clockCities'), z] }); close(); render(); } }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, n), h('span', { class: 'r-row__subtitle' }, offsetLabel(z)))))) }) }, ic('plus'));
        const list = h('div', { class: 'r-list' }, cities.map((z) => {
          const r = h('div', { class: 'r-row world-row', role: 'group', 'aria-label': cityName(z) },
            h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__subtitle' }, offsetLabel(z)), h('span', { class: 'world-row__city' }, cityName(z))),
            h('span', { class: 'world-row__time r-tabular', dataset: { zone: z } }, new Date().toLocaleTimeString(undefined, { timeZone: z, hour: '2-digit', minute: '2-digit' })));
          onLongPress(r, () => menu(r, [{ label: 'Remove', icon: 'trash', destructive: true, action: () => { settings.set({ clockCities: settings.get('clockCities').filter((x) => x !== z) }); render(); } }]));
          return r;
        }));
        tick = setInterval(() => body.querySelectorAll('[data-zone]').forEach((e) => { e.textContent = new Date().toLocaleTimeString(undefined, { timeZone: e.dataset.zone, hour: '2-digit', minute: '2-digit' }); }), 5000);
        return [header('World Clock', add), h('div', { class: 'clock__pad' }, cities.length ? list : emptyState('globe', 'No cities', 'Tap + to add a city.'), h('p', { class: 'r-footnote r-secondary clock__hint' }, 'Press and hold a city to remove it.'))];
      },
      alarms() {
        const add = h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'Add alarm', onclick: () => alarmSheet() }, ic('plus'));
        const list = cs.alarms();
        return [header('Alarms', add), h('div', { class: 'clock__pad' }, list.length ? h('div', { class: 'r-list' }, list.map((a) => {
          const r = h('div', { class: `r-row alarm-row ${a.on ? '' : 'is-off'}` },
            h('button', { class: 'r-row__body alarm-row__main', onclick: () => alarmSheet(a) }, h('span', { class: 'alarm-row__time r-tabular' }, a.time), h('span', { class: 'r-row__subtitle' }, a.label)),
            switchEl({ checked: a.on, label: `${a.label} ${a.time}`, onChange: (v) => { cs.updateAlarm(a.id, { on: v }); render(); } }));
          return r;
        })) : emptyState('alarm', 'No alarms', 'Tap + to add an alarm.'))];
      },
      stopwatch() {
        const sw = cs.stopwatch;
        const elapsed = () => sw.elapsed + (sw.running ? Date.now() - sw.start : 0);
        const disp = h('div', { class: 'sw__time r-tabular', role: 'timer' }, fmtSW(elapsed()));
        const laps = h('div', { class: 'r-list sw__laps' });
        const renderLaps = () => laps.replaceChildren(...sw.laps.map((l, i) => row({ title: `Lap ${sw.laps.length - i}`, value: fmtSW(l) })));
        const left = h('button', { class: 'round-btn', onclick: () => { if (sw.running) { sw.laps.unshift(elapsed() - sw.laps.reduce((a, b) => a + b, 0)); renderLaps(); } else { sw.elapsed = 0; sw.laps = []; disp.textContent = fmtSW(0); renderLaps(); } upd(); } });
        const right = h('button', { class: 'round-btn round-btn--go', onclick: () => { if (sw.running) { sw.elapsed = elapsed(); sw.running = false; } else { sw.start = Date.now(); sw.running = true; } upd(); } });
        const upd = () => { left.textContent = sw.running ? 'Lap' : 'Reset'; left.disabled = !sw.running && !elapsed(); right.textContent = sw.running ? 'Stop' : 'Start'; right.classList.toggle('round-btn--stop', sw.running); };
        const loop = () => { disp.textContent = fmtSW(elapsed()); raf = requestAnimationFrame(loop); };
        loop(); upd(); renderLaps();
        return [header('Stopwatch'), h('div', { class: 'clock__pad sw' }, disp, h('div', { class: 'sw__btns' }, left, right), laps)];
      },
      timer() {
        const t = cs.timer;
        if (!t) {
          const presets = [1, 3, 5, 10, 15, 30];
          const m = h('input', { class: 'r-field timer-in', type: 'number', min: 0, max: 99, value: 5, 'aria-label': 'Minutes' });
          const s = h('input', { class: 'r-field timer-in', type: 'number', min: 0, max: 59, value: 0, 'aria-label': 'Seconds' });
          return [header('Timer'), h('div', { class: 'clock__pad' },
            h('div', { class: 'timer-presets' }, presets.map((p) => h('button', { class: 'timer-preset', onclick: () => { cs.startTimer(p * 60000, `${p} min timer`); } }, h('span', { class: 'r-tabular' }, String(p)), 'min'))),
            section({ header: 'Custom' }, h('div', { class: 'r-row timer-custom' }, m, h('span', null, 'min'), s, h('span', null, 'sec'), h('span', { class: 'r-spacer' }), h('button', { class: 'r-btn r-btn--primary r-btn--sm', onclick: () => { const ms = ((+m.value || 0) * 60 + (+s.value || 0)) * 1000; if (ms > 0) cs.startTimer(ms, 'Timer'); else toast('Choose a duration'); } }, 'Start'))))];
        }
        const R = 110; const C = 2 * Math.PI * R;
        const ring = h('div', { class: 'timer-ring', html: `<svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="8"/><circle class="timer-ring__arc" cx="120" cy="120" r="${R}" fill="none" stroke="var(--r-accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" transform="rotate(-90 120 120)"/></svg>` });
        const disp = h('div', { class: 'timer-ring__time r-tabular', role: 'timer' });
        ring.appendChild(disp);
        const loop = () => { const rem = cs.timerRemaining(); disp.textContent = fmtTimer(rem); const arc = ring.querySelector('.timer-ring__arc'); if (arc && cs.timer) arc.setAttribute('stroke-dashoffset', String(C * (1 - rem / cs.timer.total))); raf = requestAnimationFrame(loop); };
        loop();
        return [header('Timer'), h('div', { class: 'clock__pad timer-run' }, h('div', { class: 'r-footnote r-secondary' }, t.label), ring,
          h('div', { class: 'sw__btns' },
            h('button', { class: 'round-btn', onclick: () => cs.cancelTimer() }, 'Cancel'),
            h('button', { class: `round-btn ${t.running ? 'round-btn--stop' : 'round-btn--go'}`, onclick: () => (t.running ? cs.pauseTimer() : cs.resumeTimer()) }, t.running ? 'Pause' : 'Resume')))];
      },
    };

    function alarmSheet(a) {
      sheet({ title: a ? 'Edit Alarm' : 'New Alarm', build: (close) => {
        const now = new Date(); const time = h('input', { class: 'r-field alarm-time', type: 'time', value: a ? a.time : `${pad((now.getHours() + 1) % 24)}:00`, 'aria-label': 'Time' });
        const label = h('input', { class: 'r-field', placeholder: 'Label', value: a ? a.label : 'Alarm', 'aria-label': 'Label' });
        return h('div', { class: 'r-stack' }, time, label,
          h('button', { class: 'r-btn r-btn--primary r-btn--block', onclick: () => { if (!time.value) return; if (a) cs.updateAlarm(a.id, { time: time.value, label: label.value || 'Alarm', on: true }); else cs.addAlarm(time.value, label.value); close(); render(); toast(`Alarm set for ${time.value}`); } }, 'Save'),
          a ? h('button', { class: 'r-btn r-btn--destructive r-btn--block', onclick: () => { cs.removeAlarm(a.id); close(); render(); } }, 'Delete Alarm') : null);
      } });
    }

    function render() {
      cancelAnimationFrame(raf); clearInterval(tick);
      renderTabs();
      body.replaceChildren(...views[tab]());
    }
    const offT = cs.on('timer', () => { if (tab === 'timer') render(); });
    render();
    return {
      route(r) { if (TABS.some(([k]) => k === r)) { tab = r; render(); } },
      pause() { cancelAnimationFrame(raf); clearInterval(tick); },
      resume() { render(); },
      unmount() { cancelAnimationFrame(raf); clearInterval(tick); offT(); },
    };
  },
};
