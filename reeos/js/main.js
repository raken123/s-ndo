/** ReeOS — start och sammankoppling.
 *  Appar registreras här; bakgrundsvakterna startar en gång och lever vidare
 *  oavsett vilken skärm som visas. */
import { $, el, icon, toast, fmtClock, buzz, setKids } from './core/ui.js';
import { on, emit } from './core/bus.js';
import { state } from './core/store.js';
import { register, startRouter, open, back, canGoBack, allApps } from './core/router.js';
import { startGPS, watchBattery, watchOrientation, keepScreenAwake, sensors } from './core/sensors.js';
import { say } from './core/speech.js';

import { home } from './apps/home.js';
import { navApp } from './apps/nav.js';
import { musicApp } from './apps/music.js';
import { phoneApp } from './apps/phone.js';
import { messagesApp } from './apps/messages.js';
import { tripApp, initTripLogger } from './apps/triplog.js';
import { fatigueApp, initFatigueWatch } from './apps/fatigue.js';
import { parkingApp, armMeter } from './apps/parking.js';
import { dashcamApp, initIncidentWatch } from './apps/dashcam.js';
import { alertsApp, initHazardWatch } from './apps/alerts.js';
import { hudApp } from './apps/hud.js';
import { settingsApp } from './apps/settings.js';
import { askAssistant } from './apps/assistant.js';

/* ---------- Register ---------- */
for (const app of [home, navApp, musicApp, phoneApp, messagesApp,
  fatigueApp, parkingApp, dashcamApp, tripApp, alertsApp, hudApp, settingsApp]) {
  register(app);
}

const DOCK = ['home', 'nav', 'music', 'phone', 'fatigue', 'parking', 'dashcam', 'triplog', 'alerts', 'hud', 'settings'];

function buildDock() {
  const dock = $('#dock');
  setKids(dock, ...DOCK.map((id) => {
    const app = allApps().find((a) => a.id === id);
    if (!app) return null;
    return el('button', { class: 'dock-item', dataset: { app: id }, onClick: () => { open(id); buzz(10); } },
      icon(app.icon), el('span', { text: app.name }));
  }).filter(Boolean));
}

function syncDock(activeId) {
  for (const item of $('#dock').children) {
    item.classList.toggle('active', item.dataset.app === activeId);
  }
}

/* ---------- Statusrad ---------- */
function initStatusbar() {
  const clock = $('#sb-clock');
  const speed = $('#sb-speed').querySelector('b');
  const gps = $('#sb-gps');
  const drive = $('#sb-drive');
  const batt = $('#sb-batt');
  const title = $('#sb-title');
  const backBtn = $('#btn-back');

  const tickClock = () => { clock.textContent = fmtClock(); };
  tickClock();
  setInterval(tickClock, 15000);

  $('#btn-home').addEventListener('click', () => open('home'));
  backBtn.addEventListener('click', back);
  $('#btn-mic').addEventListener('click', () => { buzz(); askAssistant(); });

  on('router:changed', ({ id, app }) => {
    title.textContent = app.name;
    backBtn.hidden = id === 'home' || !canGoBack();
    syncDock(id);
  });

  const renderSensors = () => {
    speed.textContent = sensors.status === 'live' ? String(Math.round(sensors.speedKmh)) : '–';
    const live = sensors.status === 'live';
    gps.className = `sb-chip ${live ? 'ok' : sensors.status === 'denied' ? 'warn' : ''}`.trim();
    gps.textContent = live ? 'GPS' : sensors.status === 'denied' ? 'EJ GPS' : 'SÖKER';
    drive.hidden = !sensors.driving;
  };
  on('sensors:fix', renderSensors);
  on('sensors:status', renderSensors);
  renderSensors();

  on('sensors:battery', () => {
    if (sensors.batteryLevel === null) return;
    batt.hidden = false;
    batt.textContent = `${sensors.batteryCharging ? '⚡' : ''}${sensors.batteryLevel}%`;
  });

  $('#btn-mic').classList.toggle('sb-mic', true);
  on('speech:start', () => $('#btn-mic').classList.add('listening'));
  on('speech:end', () => $('#btn-mic').classList.remove('listening'));
}

/* ---------- Tema ---------- */
function applyTheme() {
  const setting = state.settings.theme;
  if (setting === 'auto') {
    // Grov men förutsägbar regel: mörkt läge mellan 19 och 07.
    const hour = new Date().getHours();
    document.body.dataset.theme = (hour >= 19 || hour < 7) ? 'night' : 'day';
  } else {
    document.body.dataset.theme = setting;
  }
}

/* ---------- Fartvarning ---------- */
function initSpeedWarning() {
  let lastWarn = 0;
  on('sensors:overspeed', (kmh) => {
    if (Date.now() - lastWarn < 25000) return;
    lastWarn = Date.now();
    buzz([50, 80, 50]);
    say(`Du kör ${Math.round(kmh)}.`, { force: true });
    toast(`Över inställd gräns: ${Math.round(kmh)} km/h`, 'warn', 4000);
  });
}

/* ---------- Start ---------- */
async function boot() {
  applyTheme();
  setInterval(applyTheme, 5 * 60000);
  on('theme:apply', applyTheme);
  on('settings:changed', ({ key }) => { if (key === 'theme') applyTheme(); });

  buildDock();
  initStatusbar();
  initSpeedWarning();

  // Bakgrundsvakter — dessa ska gå även när deras egen skärm är stängd.
  initTripLogger();
  initFatigueWatch();
  initHazardWatch();
  initIncidentWatch();
  armMeter();

  startGPS();
  watchBattery();
  watchOrientation();
  if (state.settings.wakeLock) keepScreenAwake(true);

  window.addEventListener('online', () => emit('online:changed', true));
  window.addEventListener('offline', () => {
    emit('online:changed', false);
    toast('Offline — kartan visar kompassläge.', 'warn');
  });

  startRouter('home');

  // Bilhållarens vanligaste läge är liggande; påminn en gång.
  if (window.matchMedia('(orientation: portrait)').matches && screen.width < 500) {
    toast('Vrid telefonen till liggande för bästa vy.', '', 4000);
  }

  const boot = $('#boot');
  $('#shell').hidden = false;
  boot.classList.add('gone');
  setTimeout(() => boot.remove(), 500);

  // På file:// finns ingen service worker att registrera; hoppa över tyst.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline-läget är en bonus */ });
  }
}

// Låt boot-skärmen synas ett ögonblick — den signalerar att systemet är igång.
setTimeout(boot, 650);

// Zoom med dubbeltryck är ett olycksfall i bil; stäng av det.
document.addEventListener('dblclick', (ev) => ev.preventDefault(), { passive: false });
