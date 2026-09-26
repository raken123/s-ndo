// RakenOS — system start.
import { $ } from './core/dom.js';
import { settings } from './core/store.js';
import { detectCapabilities } from './core/capabilities.js';
import { setOverlayLayer, toast, dialog } from './ui/overlays.js';
import { watchAppearance } from './shell/theme.js';
import { bootScreen } from './shell/boot.js';
import { runSetup } from './shell/setup.js';
import { system } from './shell/system.js';
import { StatusBar } from './shell/statusbar.js';
import { Home } from './shell/home.js';
import { WindowManager, Recents, installGestureBar } from './shell/windows.js';
import { Panels } from './shell/panels.js';
import { Search } from './shell/search.js';
import { LockScreen } from './shell/lockscreen.js';
import { battery } from './services/battery.js';
import { initUpdates, updates } from './services/updates.js';
import { rasApps } from './services/ras-apps.js';
import { loadCatalog, store } from './services/store-service.js';
import { usage } from './services/usage.js';
import { clockService } from './services/alarms.js';

async function startServices() {
  await detectCapabilities();
  await battery.init();
  await initUpdates();
  const trustedKeys = await (await fetch('lib/ras-runtime/trusted-keys.json')).json();
  await rasApps.init({ trustedKeys, systemInfo: () => ({ rakenosVersion: updates.installed, rasApiLevel: updates.rasApiLevel() }) });
  try { await loadCatalog(); await store.installFactoryApps(); store.refreshBadge(); } catch (e) { console.warn('Store catalog unavailable', e); }
}

async function start() {
  const device = $('#device');
  setOverlayLayer($('#overlay'));
  watchAppearance();

  await bootScreen($('#system-layer'), startServices);

  const status = new StatusBar($('#statusbar'), battery);
  system.statusbar = status;
  system.home = new Home($('#home'), battery);
  system.wm = new WindowManager($('#windows'));
  system.recents = new Recents($('#recents'), system.wm);
  system.panels = new Panels($('#panels'), $('#banners'));
  system.search = new Search($('#search'));
  system.lockscreen = new LockScreen($('#lock'), $('#screen-off'), battery);
  installGestureBar($('#gesturebar'), system.wm);
  status.render();
  rasApps.on('change', () => store.refreshBadge());
  system.on('lock', () => device.classList.add('is-locked'));
  system.on('unlock', () => device.classList.remove('is-locked'));

  const engine = updates.engine;
  engine.on((type, detail) => {
    if (type === 'installed' && !system.locked) restartAfterUpdate(detail);
    if (type === 'installed') { store.refreshBadge(); system.home.render(); }
  });

  clockService.on('alarm', (a) => {
    system.notify('clock', a.label, `Alarm · ${a.time}`, { priority: 'time-sensitive' });
    if (system.lockscreen.asleep) system.lockscreen.wake();
    dialog({ title: a.label, message: `It’s ${a.time}.`, actions: [{ label: 'Snooze', value: 'snooze' }, { label: 'Stop', primary: true, value: 'stop' }] })
      .then((v) => { if (v === 'snooze') setTimeout(() => clockService.fire({ ...a, label: `${a.label} (snoozed)` }), 9 * 60000); });
  });
  clockService.on('timerDone', (label) => {
    system.notify('clock', 'Timer finished', label, { priority: 'time-sensitive' });
    dialog({ title: 'Timer finished', message: `${label} is done.`, actions: [{ label: 'OK', primary: true }] });
  });

  // Handle for automated tests and debugging (no hardware information is exposed here).
  window.__rakenos = { system, updates, settings, rasApps, store };

  if (!settings.get('setupComplete')) {
    system.lockscreen.layer.hidden = true;
    await runSetup($('#system-layer'));
    system.locked = false;
    engine.setLocked(false);
    usage.screen(true);
  } else {
    system.lockscreen.lock({ sleep: false });
    usage.screen(true);
  }
  engine.start();

  // Navigation: Android back button, Escape key.
  document.addEventListener('backbutton', (e) => { e.preventDefault(); system.back(); }, false);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { if (!system.back()) system.goHome(); }
  });
  device.classList.add('is-ready');
}

async function restartAfterUpdate({ to }) {
  await bootScreen($('#system-layer'), async () => {}, { label: `RakenOS ${to}` });
  system.wm.closeAll();
  system.lockscreen.lock({ sleep: false });
  toast(`RakenOS ${to} installed`, { icon: 'check' });
}

if (window.cordova) document.addEventListener('deviceready', start, false);
else start();
