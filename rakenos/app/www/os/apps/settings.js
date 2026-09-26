// Settings app.
import { h, ic } from '../core/dom.js';
import { settings, storage } from '../core/store.js';
import { has, detectedCaps, caps, CAPABILITY_INFO } from '../core/capabilities.js';
import { platform } from '../core/platform.js';
import { NavStack } from '../ui/nav.js';
import { section, row, switchRow, slider, sliderRow, choiceRows, segmented, appIcon } from '../ui/components.js';
import { confirm, prompt, toast, sheet } from '../ui/overlays.js';
import { updates } from '../services/updates.js';
import { security } from '../services/security.js';
import { rasApps, KNOWN_PERMISSIONS } from '../services/ras-apps.js';
import { allApps, getApp, systemApp } from '../services/apps.js';
import { usage } from '../services/usage.js';
import { battery } from '../services/battery.js';
import { system } from '../shell/system.js';
import { WALLPAPERS, wallpaperUrl, effectiveTheme } from '../shell/theme.js';
import { pinPad } from '../shell/pinpad.js';
import { rakenMark } from '../shell/logo.js';
import { SETTINGS_INDEX, ROW_COLORS as C } from './settings-index.js';
import { updatePage, autoPage, historyPage, releasePage } from './settings-update.js';
import { RSCRIPT_VERSION } from '../../lib/ras-runtime/rscript.js';

const onOff = (v) => (v ? 'On' : 'Off');
const AUTOLOCK = [[30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [0, 'Never']];

export default {
  mount(container) {
    const nav = new NavStack(container);
    const offs = [];
    const refreshTop = () => nav.top && nav.top.refresh();
    offs.push(settings.on('change', () => { if (!nav.top || !nav.top.def.noAutoRefresh) refreshTop(); }));
    offs.push(rasApps.on('change', refreshTop));

    const choicePage = (title, key, options, footer) => ({
      title, back: 'Back', large: false,
      build: () => section({ footer }, ...choiceRows({ options, value: settings.get(key), onChange: (v) => settings.set({ [key]: v }) })),
    });

    // ------------------------------------------------------------- Root
    const rootPage = {
      title: 'Settings',
      build(page) {
        const q = page.query || '';
        const field = h('input', { type: 'search', placeholder: 'Search settings', value: q, 'aria-label': 'Search settings' });
        const results = h('div');
        const renderResults = () => {
          const s = field.value.trim().toLowerCase();
          page.query = field.value;
          body.hidden = !!s; results.hidden = !s;
          if (!s) return;
          const hits = SETTINGS_INDEX().filter((e) => (e.title + ' ' + e.keywords).toLowerCase().includes(s));
          results.replaceChildren(hits.length ? section({}, ...hits.map((e) => row({ icon: e.icon, color: e.color, title: e.title, subtitle: e.path !== 'Settings' ? e.path : null, onClick: () => open(e.route) }))) : h('div', { class: 'r-empty' }, ic('search'), h('div', { class: 'r-empty__title' }, 'No results')));
        };
        field.addEventListener('input', renderResults);
        const eng = updates.engine.snapshot;
        const updBadge = ['available', 'ready'].includes(eng.status) ? 1 : null;
        const s = settings.data;
        const body = h('div', null,
          h('button', { class: 'set-hero', onclick: () => open('about') },
            h('span', { class: 'set-hero__mark', html: rakenMark(30, { color: '#fff' }) }),
            h('span', { class: 'set-hero__text' }, h('span', { class: 'set-hero__title' }, 'RakenOS'), h('span', { class: 'set-hero__sub' }, `Version ${updates.installed}`)),
            h('span', { class: 'r-row__chevron' }, ic('chevron-right'))),
          updBadge ? section({}, row({ icon: 'update', color: C.update, title: `RakenOS ${eng.target} ${eng.status === 'ready' ? 'is ready to install' : 'is available'}`, onClick: () => open('update'), tone: 'accent' })) : null,
          section({},
            switchRow({ icon: 'airplane', color: C.airplane, title: 'Airplane Mode', checked: s.airplane, onChange: (v) => settings.set({ airplane: v }) }),
            row({ icon: 'wifi', color: C.wifi, title: 'Wi-Fi', value: s.airplane ? 'Off' : onOff(s.wifi), onClick: () => open('wifi') }),
            row({ icon: 'bluetooth', color: C.bluetooth, title: 'Bluetooth', value: s.airplane ? 'Off' : onOff(s.bluetooth), onClick: () => open('bluetooth') }),
            has('nfc') ? row({ icon: 'nfc', color: C.nfc, title: 'NFC', value: onOff(s.nfc), onClick: () => open('nfc'), id: 'nfc' }) : null),
          section({},
            row({ icon: 'bell', color: C.notifications, title: 'Notifications', onClick: () => open('notifications') }),
            row({ icon: 'volume', color: C.sound, title: 'Sound & Haptics', onClick: () => open('sound') }),
            row({ icon: 'display', color: C.display, title: 'Display', onClick: () => open('display') }),
            row({ icon: 'palette', color: C.wallpaper, title: 'Wallpaper', onClick: () => open('wallpaper') }),
            row({ icon: 'battery', color: C.battery, title: 'Battery', value: `${battery.state.level}%`, onClick: () => open('battery') })),
          section({},
            has('scanner2d') ? row({ icon: 'scanner', color: C.scanner, title: 'Scanner', value: onOff(s.scannerEnabled), onClick: () => open('scanner'), id: 'scanner' }) : null,
            row({ icon: 'accessibility', color: C.accessibility, title: 'Accessibility', onClick: () => open('accessibility') })),
          section({},
            row({ icon: 'shield', color: C.security, title: 'Security', onClick: () => open('security') }),
            row({ icon: 'hand', color: C.privacy, title: 'Privacy', onClick: () => open('privacy') })),
          section({},
            row({ icon: 'grid', color: C.apps, title: 'Apps', value: String(allApps().length), onClick: () => open('apps') }),
            row({ icon: 'storage', color: C.storage, title: 'Storage', onClick: () => open('storage') })),
          section({},
            row({ icon: 'update', color: C.update, title: 'System Update', badge: updBadge, onClick: () => open('update'), id: 'system-update' }),
            s.developerEnabled ? row({ icon: 'code', color: C.developer, title: 'Developer Options', onClick: () => open('developer') }) : null,
            row({ icon: 'info', color: C.about, title: 'About RakenOS', onClick: () => open('about'), id: 'about' })));
        const wrap = h('div', null, h('div', { class: 'set-search' }, h('label', { class: 'r-search' }, ic('search'), field)), results, body);
        renderResults();
        return wrap;
      },
    };

    // ----------------------------------------------------------- Pages
    const pages = {
      wifi: () => ({
        title: 'Wi-Fi', back: 'Settings',
        build: () => h('div', null,
          section({ footer: settings.get('airplane') ? 'Airplane Mode is on. Wi-Fi can still be turned on manually.' : null },
            switchRow({ icon: 'wifi', color: C.wifi, title: 'Wi-Fi', checked: settings.get('wifi'), onChange: (v) => settings.set({ wifi: v }) })),
          settings.get('wifi') ? section({ header: 'Network' },
            row({ title: 'Internet', value: navigator.onLine ? 'Connected' : 'Not connected' }),
            row({ title: 'Connection type', value: navigator.connection && navigator.connection.type ? navigator.connection.type : 'Wireless' })) : null,
          platform.isNative ? section({ footer: 'Network selection and passwords are managed by Android.' }, row({ title: 'Choose a network', onClick: () => platform.openSystemSettings('wifi') })) : null),
      }),
      bluetooth: () => ({
        title: 'Bluetooth', back: 'Settings',
        build: () => h('div', null,
          section({ footer: 'When Bluetooth is on, this device can connect to headphones, keyboards and other accessories.' },
            switchRow({ icon: 'bluetooth', color: C.bluetooth, title: 'Bluetooth', checked: settings.get('bluetooth'), onChange: (v) => settings.set({ bluetooth: v }) })),
          platform.isNative && settings.get('bluetooth') ? section({}, row({ title: 'Pair a new accessory', onClick: () => platform.openSystemSettings('bluetooth') })) : null),
      }),
      nfc: () => ({
        title: 'NFC', back: 'Settings',
        build: () => h('div', null,
          section({ footer: 'Read NFC tags and use contactless features by holding the back of the device near a tag or reader.' },
            switchRow({ icon: 'nfc', color: C.nfc, title: 'NFC', checked: settings.get('nfc'), onChange: (v) => settings.set({ nfc: v }) })),
          section({ header: 'Tags' }, row({ title: 'Open links from tags', value: 'Ask first' }), row({ title: 'Tag reading', value: settings.get('nfc') ? 'Available' : 'Off' })),
          platform.isNative ? section({}, row({ title: 'Android NFC settings', onClick: () => platform.openSystemSettings('nfc') })) : null),
      }),
      notifications: () => ({
        title: 'Notifications', back: 'Settings',
        build: (page) => {
          const muted = new Set(settings.get('notificationsMuted') || []);
          return h('div', null,
            section({ header: 'Lock Screen', footer: 'Choose how notification content appears while the device is locked.' },
              ...choiceRows({ options: [{ value: 'always', label: 'Show content' }, { value: 'unlocked', label: 'Show content when unlocked', subtitle: 'Requires a PIN' }, { value: 'never', label: 'Don’t show notifications' }], value: settings.get('lockNotifications'), onChange: (v) => settings.set({ lockNotifications: v }) })),
            section({}, switchRow({ icon: 'moon', color: '#5b4fd6', title: 'Do Not Disturb', subtitle: 'Silences notifications except time-sensitive ones.', checked: settings.get('dnd'), onChange: (v) => settings.set({ dnd: v }) })),
            section({ header: 'Apps' }, ...allApps().map((a) => switchRow({ title: a.name, checked: !muted.has(a.id), onChange: (v) => { const m = new Set(settings.get('notificationsMuted') || []); v ? m.delete(a.id) : m.add(a.id); settings.set({ notificationsMuted: [...m] }); } }))));
        },
      }),
      sound: () => ({
        title: 'Sound & Haptics', back: 'Settings', noAutoRefresh: true,
        build: () => h('div', null,
          section({}, switchRow({ icon: 'bell-off', color: C.sound, title: 'Silent Mode', checked: settings.get('silent'), onChange: (v) => settings.set({ silent: v }) })),
          section({ header: 'Media' }, sliderRow({ value: settings.get('volumeMedia'), iconStart: 'volume-low', iconEnd: 'volume', label: 'Media volume', onInput: (v) => settings.set({ volumeMedia: v }) })),
          section({ header: 'Ringtone and alerts' }, sliderRow({ value: settings.get('volumeRing'), iconStart: 'volume-low', iconEnd: 'volume', label: 'Ringtone volume', onInput: (v) => settings.set({ volumeRing: v }) })),
          section({ header: 'Notifications' }, sliderRow({ value: settings.get('volumeNotifications'), iconStart: 'volume-low', iconEnd: 'volume', label: 'Notification volume', onInput: (v) => settings.set({ volumeNotifications: v }) })),
          section({ footer: has('vibration') ? 'Subtle feedback for keypads, toggles and gestures.' : 'This device has no vibration motor.' },
            switchRow({ title: 'System Haptics', checked: settings.get('haptics') && has('vibration'), disabled: !has('vibration'), onChange: (v) => { settings.set({ haptics: v }); if (v) platform.vibrate(12); } }))),
      }),
      display: () => ({
        title: 'Display', back: 'Settings', noAutoRefresh: true,
        build: (page) => {
          const theme = settings.get('theme');
          const previews = h('div', { class: 'set-themes' }, [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Automatic']].map(([v, l]) => h('button', {
            class: 'theme-option', role: 'radio', 'aria-checked': String(theme === v), type: 'button',
            onclick: () => { settings.set({ theme: v }); page.refresh(); },
          }, h('span', { class: `theme-option__preview theme-option__preview--${v}`, style: { backgroundImage: wallpaperUrl(settings.get('wallpaper'), v === 'auto' ? 'light' : v), '--dark-wp': wallpaperUrl(settings.get('wallpaper'), 'dark') } }, h('span', { class: 'theme-option__ui' })), h('span', { class: 'theme-option__label' }, l), h('span', { class: 'theme-option__radio' }, theme === v ? ic('check') : null))));
          return h('div', null,
            section({ header: 'Appearance', footer: theme === 'auto' ? `Follows the system appearance. Currently ${effectiveTheme()}.` : null }, h('div', { class: 'r-row set-themes-row' }, previews)),
            section({ header: 'Brightness' },
              sliderRow({ value: settings.get('brightness'), min: 0.05, max: 1, iconStart: 'sun-dim', iconEnd: 'sun', label: 'Brightness', onInput: (v) => settings.set({ brightness: v, autoBrightness: false }) }),
              switchRow({ title: 'Automatic brightness', checked: settings.get('autoBrightness'), onChange: (v) => settings.set({ autoBrightness: v }) })),
            section({},
              row({ title: 'Text Size', value: { small: 'Small', default: 'Default', large: 'Large', larger: 'Larger' }[settings.get('textSize')], onClick: () => nav.push(textSizePage()) }),
              switchRow({ title: 'Bold Text', checked: settings.get('boldText'), onChange: (v) => settings.set({ boldText: v }) }),
              row({ title: 'Wallpaper', value: WALLPAPERS.find((w) => w.id === settings.get('wallpaper')).name, onClick: () => open('wallpaper') })),
            section({}, row({ title: 'Auto-Lock', value: AUTOLOCK.find(([s]) => s === settings.get('autoLock'))?.[1], onClick: () => nav.push(choicePage('Auto-Lock', 'autoLock', AUTOLOCK.map(([value, label]) => ({ value, label })), 'The display turns off and the device locks after this period of inactivity.')) })));
        },
      }),
      wallpaper: () => ({
        title: 'Wallpaper', back: 'Settings', noAutoRefresh: true,
        build: (page) => h('div', { class: 'set-wallpapers' }, WALLPAPERS.map((w) => h('button', {
          type: 'button', class: 'wp-option', 'aria-pressed': String(settings.get('wallpaper') === w.id), 'aria-label': w.name,
          onclick: () => { settings.set({ wallpaper: w.id }); page.refresh(); },
        }, h('span', { class: 'wp-option__img', style: { backgroundImage: wallpaperUrl(w.id) } }), h('span', { class: 'wp-option__name' }, w.name)))),
      }),
      battery: () => ({
        title: 'Battery', back: 'Settings',
        build: () => {
          const b = battery.state; const u = usage.today();
          const total = Object.values(u.apps).reduce((a, x) => a + x, 0) || 1;
          const rows = Object.entries(u.apps).sort((a, x) => x[1] - a[1]).slice(0, 8);
          const mins = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
          return h('div', null,
            h('div', { class: 'batt-hero' },
              h('div', { class: 'batt-hero__level r-tabular' }, `${b.level}%`),
              h('div', { class: 'batt-hero__state' }, b.charging ? 'Charging' : settings.get('batterySaver') ? 'Battery Saver is on' : 'On battery'),
              h('div', { class: 'batt-hero__bar' }, h('span', { style: { width: `${b.level}%` }, class: b.level <= 20 && !b.charging ? 'is-low' : '' })),
              b.source === 'estimate' ? h('div', { class: 'r-footnote r-secondary' }, 'Battery information is not available on this platform.') : null),
            section({ footer: 'Reduces background activity, animations and refresh rates to extend battery life.' },
              switchRow({ icon: 'leaf', color: C.battery, title: 'Battery Saver', checked: settings.get('batterySaver'), onChange: (v) => settings.set({ batterySaver: v }) }),
              row({ title: 'Turn on automatically', value: settings.get('batterySaverAuto') ? `At ${settings.get('batterySaverAuto')}%` : 'Never', onClick: () => nav.push(choicePage('Automatic Battery Saver', 'batterySaverAuto', [{ value: 0, label: 'Never' }, { value: 10, label: 'At 10%' }, { value: 15, label: 'At 15%' }, { value: 20, label: 'At 20%' }])) })),
            section({ header: 'Today', footer: 'Usage is measured on this device and never leaves it.' },
              row({ title: 'Screen on', value: mins(u.screenOn) }),
              ...(rows.length ? rows.map(([id, ms]) => { const a = getApp(id) || { name: id }; return h('div', { class: 'r-row usage-row' }, appIcon(a, 'sm'), h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, a.name), h('span', { class: 'usage-bar' }, h('span', { style: { width: `${Math.max(3, (ms / total) * 100)}%` } }))), h('span', { class: 'r-row__value' }, mins(ms))); }) : [row({ title: 'No app usage recorded yet today' })])));
        },
      }),
      scanner: () => ({
        title: 'Scanner', back: 'Settings',
        build: () => {
          const sym = settings.get('scannerSymbologies');
          const names = { qr: 'QR Code', datamatrix: 'Data Matrix', code128: 'Code 128', ean13: 'EAN-13', pdf417: 'PDF417' };
          return h('div', null,
            section({ footer: 'The built-in 2D scanner reads codes when you press the scan trigger.' },
              switchRow({ icon: 'scanner', color: C.scanner, title: 'Scanner', checked: settings.get('scannerEnabled'), onChange: (v) => settings.set({ scannerEnabled: v }) })),
            section({ header: 'Trigger' }, ...choiceRows({ options: [{ value: 'hardware', label: 'Hardware scan button' }, { value: 'screen', label: 'On-screen button' }], value: settings.get('scannerTrigger'), onChange: (v) => settings.set({ scannerTrigger: v }) })),
            section({ header: 'Feedback' }, ...choiceRows({ options: [{ value: 'beep-vibrate', label: 'Sound and vibration' }, { value: 'vibrate', label: 'Vibration only' }, { value: 'silent', label: 'Silent' }], value: settings.get('scannerFeedback'), onChange: (v) => settings.set({ scannerFeedback: v }) })),
            section({ header: 'Symbologies' }, ...Object.keys(names).map((k) => switchRow({ title: names[k], checked: !!sym[k], onChange: (v) => settings.set({ scannerSymbologies: { ...settings.get('scannerSymbologies'), [k]: v } }) }))),
            section({}, row({ title: 'Test scanner', onClick: () => system.openApp('scanner'), tone: 'accent', chevron: false })));
        },
      }),
      accessibility: () => ({
        title: 'Accessibility', back: 'Settings',
        build: () => h('div', null,
          section({ header: 'Vision' },
            row({ title: 'Text Size', value: { small: 'Small', default: 'Default', large: 'Large', larger: 'Larger' }[settings.get('textSize')], onClick: () => nav.push(textSizePage()) }),
            switchRow({ title: 'Bold Text', checked: settings.get('boldText'), onChange: (v) => settings.set({ boldText: v }) }),
            switchRow({ title: 'Increase Contrast', subtitle: 'Darkens secondary text and separators.', checked: settings.get('increaseContrast'), onChange: (v) => settings.set({ increaseContrast: v }) })),
          section({ header: 'Motion' }, switchRow({ title: 'Reduce Motion', subtitle: 'Replaces sliding and scaling transitions with simple fades.', checked: settings.get('reduceMotion'), onChange: (v) => settings.set({ reduceMotion: v }) })),
          section({ header: 'Touch' }, switchRow({ title: 'System Haptics', checked: settings.get('haptics'), disabled: !has('vibration'), onChange: (v) => settings.set({ haptics: v }) }))),
      }),
      security: () => ({
        title: 'Security', back: 'Settings',
        build: () => {
          const st = security.status(updates.engine.snapshot);
          const rel = updates.installedRelease();
          return h('div', null,
            h('div', { class: `sec-status ${st.ok ? 'is-ok' : 'is-warn'}` }, h('span', { class: 'sec-status__icon' }, ic(st.ok ? 'shield-check' : 'alert')), h('div', null, h('div', { class: 'sec-status__title' }, st.ok ? 'Your device is protected' : 'Review recommended'), h('div', { class: 'sec-status__text' }, `${st.items.filter((i) => i.ok).length} of ${st.items.length} protections active`))),
            section({ header: 'Security status' }, ...st.items.map((i) => row({ icon: i.ok ? 'check' : 'alert', color: i.ok ? 'var(--r-success)' : 'var(--r-warning)', title: i.label, subtitle: i.detail, onClick: i.id === 'update' ? () => open('update') : i.id === 'lock' && !i.ok ? () => changePin() : null }))),
            section({ header: 'Screen lock' },
              row({ icon: 'lock', color: C.security, title: security.hasPin() ? 'Change PIN' : 'Set up PIN', onClick: () => changePin() }),
              security.hasPin() ? row({ title: 'Turn off PIN', tone: 'destructive', onClick: async () => { if (await confirm('Turn off PIN?', 'Anyone with access to this device will be able to use it.', { confirmLabel: 'Turn Off', destructive: true })) { security.removePin(); toast('PIN turned off'); } } }) : null,
              row({ title: 'Auto-Lock', value: AUTOLOCK.find(([s]) => s === settings.get('autoLock'))?.[1], onClick: () => nav.push(choicePage('Auto-Lock', 'autoLock', AUTOLOCK.map(([value, label]) => ({ value, label })))) })),
            section({ header: 'Apps', footer: 'RakenOS checks the developer signature of every RAS package before installation. Turning this off allows packages signed by unknown developers.' },
              switchRow({ title: 'Only allow verified RAS apps', checked: settings.get('verifiedAppsOnly'), onChange: async (v) => {
                if (!v && !(await confirm('Allow unverified apps?', 'Packages from unknown developers can harm your device and data.', { confirmLabel: 'Allow', destructive: true }))) { nav.top.refresh(); return; }
                settings.set({ verifiedAppsOnly: v });
              } })),
            section({ header: 'Security content' },
              row({ title: 'Installed security content', value: `RakenOS ${rel.security.patchLevel}` }),
              row({ title: 'Advisories in this release', value: String(rel.security.advisories.length), onClick: () => nav.push(releasePage(rel.version)) })));
        },
      }),
      privacy: () => ({
        title: 'Privacy', back: 'Settings',
        build: () => {
          const perms = Object.keys(KNOWN_PERMISSIONS).map((p) => ({ p, apps: rasApps.list().filter((a) => p in a.permissions) })).filter((x) => x.apps.length);
          return h('div', null,
            section({ header: 'Permissions', footer: 'Apps can only use what you allow. Changes apply immediately.' },
              ...(perms.length ? perms.map(({ p, apps }) => row({ icon: KNOWN_PERMISSIONS[p].icon, color: C.privacy, title: KNOWN_PERMISSIONS[p].label, value: `${apps.filter((a) => a.permissions[p]).length} of ${apps.length}`, onClick: () => nav.push(permissionPage(p)) })) : [row({ title: 'No apps have requested permissions' })])),
            section({ header: 'Analytics', footer: 'Diagnostics never include personal data, app content or hardware identifiers.' },
              switchRow({ title: 'Share diagnostics', checked: settings.get('diagnostics'), onChange: (v) => settings.set({ diagnostics: v }) })),
            section({ header: 'Search' },
              switchRow({ title: 'Remember recent searches', checked: settings.get('searchHistory'), onChange: (v) => { settings.set({ searchHistory: v }); if (!v) storage.set('rakenos.search.recent', []); } }),
              row({ title: 'Clear search history', tone: 'accent', chevron: false, onClick: () => { storage.set('rakenos.search.recent', []); toast('Search history cleared'); } })),
            section({ header: 'System updates', footer: 'Staged rollouts use a random identifier created on this device. It is not linked to you or to this device’s hardware. Resetting it may move the device to a different rollout group.' },
              row({ title: 'Rollout group', value: `Group ${updates.rollout.group}` }),
              row({ title: 'Reset rollout identifier', tone: 'accent', chevron: false, onClick: async () => { if (await confirm('Reset rollout identifier?', 'A new anonymous identifier will be created.', { confirmLabel: 'Reset' })) { const g = updates.rollout.reset(); toast(`Now in rollout group ${g}`); nav.top.refresh(); } } })));
        },
      }),
      apps: () => ({
        title: 'Apps', back: 'Settings',
        build: () => {
          const ras = rasApps.list();
          const sys = allApps().filter((a) => a.kind === 'system');
          return h('div', null,
            section({ header: `Installed apps · ${ras.length}` }, ...(ras.length ? ras.map((r) => row({ title: r.manifest.name, subtitle: `${r.manifest.store.developer} · ${r.manifest.version}`, trailing: null, icon: null, onClick: () => open(`app:${r.manifest.id}`), value: null })) : [row({ title: 'No apps installed from Raken Store yet' })])),
            section({ header: 'System apps' }, ...sys.map((a) => row({ title: a.name, onClick: () => open(`app:${a.id}`) }))));
        },
      }),
      storage: () => ({
        title: 'Storage', back: 'Settings',
        build: () => {
          let bytes = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch {}
          const box = h('div');
          const est = navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null);
          est.then((e) => {
            box.replaceChildren(section({ header: 'This device' },
              row({ title: 'Used by RakenOS data', value: fmt(bytes + (e ? e.usage : 0)) }),
              e && e.quota ? row({ title: 'Available to RakenOS', value: fmt(e.quota) }) : null,
              row({ title: 'RAS apps', value: String(rasApps.list().length) })));
          });
          return box;
        },
      }),
      developer: () => ({
        title: 'Developer Options', back: 'Settings',
        build: () => {
          const eng = updates.engine; const det = detectedCaps(); const off = settings.get('capabilityOverrides') || {};
          const dayOpts = [[86400000, 'Real time (24 hours)'], [3600000, '1 hour'], [60000, '1 minute'], [10000, '10 seconds']];
          return h('div', null,
            section({ header: 'Staged rollout simulation', footer: 'Controls how long one rollout day lasts on this device, so rollout waves can be tested.' },
              ...choiceRows({ options: dayOpts.map(([value, label]) => ({ value, label })), value: eng.settings.rolloutDayMs, onChange: (v) => { eng.setSettings({ rolloutDayMs: v }); nav.top.refresh(); } })),
            section({ header: 'Update source', footer: 'Use a RakenOS update server such as the development server in mock-backend/. Leave empty to use the bundled update service. Restart RakenOS after changing.' },
              row({ title: 'Update server', value: settings.get('updateServer') || 'Bundled', onClick: async () => { const v = await prompt('Update server', { value: settings.get('updateServer'), placeholder: 'http://10.0.2.2:8787' }); if (v !== null) settings.set({ updateServer: v.trim() }); } })),
            section({ header: 'Hardware capabilities', footer: 'Detected capabilities control which features RakenOS enables. You can simulate a missing capability to test apps.' },
              ...Object.keys(CAPABILITY_INFO).map((k) => switchRow({ title: CAPABILITY_INFO[k], subtitle: det[k] ? (off[k] === false ? 'Detected · simulated as missing' : 'Detected') : 'Not detected', checked: !!caps()[k], disabled: !det[k], onChange: (v) => { const o = { ...(settings.get('capabilityOverrides') || {}) }; if (v) delete o[k]; else o[k] = false; settings.set({ capabilityOverrides: o }); } }))),
            section({},
              row({ title: 'Turn off Developer Options', tone: 'accent', chevron: false, onClick: () => { settings.set({ developerEnabled: false }); nav.popToRoot(); } }),
              row({ title: 'Erase all content and settings', tone: 'destructive', chevron: false, onClick: async () => { if (await confirm('Erase everything?', 'All apps, data and settings will be removed and Setup will start again.', { confirmLabel: 'Erase', destructive: true })) { try { localStorage.clear(); indexedDB.deleteDatabase('rakenos'); } catch {} location.reload(); } } })));
        },
      }),
      about: () => {
        let taps = 0;
        return {
          title: 'About RakenOS', back: 'Settings',
          build: () => {
            const rel = updates.installedRelease(); const comp = updates.components(); const eng = updates.engine.snapshot;
            const st = security.status(eng);
            return h('div', null,
              h('div', { class: 'about-hero' }, h('div', { class: 'about-hero__mark', html: rakenMark(44, { color: '#fff' }) }), h('div', { class: 'about-hero__name' }, 'RakenOS'), h('div', { class: 'about-hero__ver', dataset: { testid: 'about-version' } }, `Version ${updates.installed}`)),
              section({},
                row({ title: 'Operating system', value: 'RakenOS' }),
                h('button', { class: 'r-row', type: 'button', 'data-row': 'version', onclick: () => {
                  taps++;
                  if (settings.get('developerEnabled')) { if (taps === 1) toast('Developer Options are already on'); return; }
                  if (taps >= 7) { settings.set({ developerEnabled: true }); toast('Developer Options are now on'); }
                  else if (taps >= 3) toast(`${7 - taps} more taps to turn on Developer Options`);
                } }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, 'Version')), h('span', { class: 'r-row__value' }, updates.installed)),
                row({ title: 'Released', value: rel.releaseDate }),
                row({ title: 'Security status', value: st.ok ? 'Protected' : 'Review recommended', onClick: () => open('security') }),
                row({ title: 'System update', value: ['available', 'ready'].includes(eng.status) ? 'Update available' : 'Up to date', onClick: () => open('update') })),
              section({ header: 'Platform' },
                row({ title: 'RAS API level', value: String(comp.rasApiLevel || 1) }),
                row({ title: 'RAS Runtime', value: comp.rasRuntime }),
                row({ title: 'RScript', value: `${comp.rscript} (engine ${RSCRIPT_VERSION})` }),
                row({ title: 'Interface', value: comp.interface }),
                row({ title: 'Store service', value: comp.store })),
              section({ header: 'Legal' },
                row({ title: 'Open source licenses', onClick: () => sheet({ title: 'Open source licenses', build: () => h('div', { class: 'r-stack r-subhead' }, h('p', null, 'Raken Sans is based on Inter, © The Inter Project Authors, licensed under the SIL Open Font License 1.1.'), h('p', null, 'RakenOS runs on Apache Cordova, licensed under the Apache License 2.0.')) }) })));
          },
        };
      },
      update: updatePage,
      'update-auto': autoPage,
      'update-history': historyPage,
    };

    function textSizePage() {
      return {
        title: 'Text Size', back: 'Back', noAutoRefresh: true,
        build: (page) => h('div', null,
          h('div', { class: 'text-preview r-card' }, h('div', { class: 'r-headline' }, 'Reading is easier'), h('div', { class: 'r-body r-secondary' }, 'Apps that support RakenOS text sizes adjust to the size you choose below.')),
          section({}, ...choiceRows({ options: [{ value: 'small', label: 'Small' }, { value: 'default', label: 'Default' }, { value: 'large', label: 'Large' }, { value: 'larger', label: 'Larger' }], value: settings.get('textSize'), onChange: (v) => { settings.set({ textSize: v }); page.refresh(); } }))),
      };
    }

    function permissionPage(p) {
      return {
        title: KNOWN_PERMISSIONS[p].label, back: 'Privacy',
        build: () => section({}, ...rasApps.list().filter((a) => p in a.permissions).map((a) => switchRow({ title: a.manifest.name, subtitle: (a.manifest.permissions.find((x) => (x.id || x) === p) || {}).reason, checked: a.permissions[p], onChange: (v) => rasApps.setPermission(a.manifest.id, p, v) }))),
      };
    }

    function appPage(id) {
      const r = rasApps.get(id);
      const sysApp = systemApp(id);
      return {
        title: r ? r.manifest.name : sysApp ? sysApp.name : 'App', back: 'Apps',
        build: () => {
          const rr = rasApps.get(id);
          if (!rr) {
            const a = getApp(id);
            return a ? h('div', null, h('div', { class: 'app-hero' }, appIcon(a, 'lg'), h('div', { class: 'app-hero__name' }, a.name), h('div', { class: 'app-hero__sub' }, 'System app')), section({}, row({ title: 'Open', tone: 'accent', chevron: false, onClick: () => system.openApp(id) }))) : h('div', { class: 'r-empty' }, 'This app is not installed.');
          }
          const m = rr.manifest; const stor = rasApps.appStorage(id);
          return h('div', null,
            h('div', { class: 'app-hero' }, appIcon(m, 'lg'), h('div', { class: 'app-hero__name' }, m.name), h('div', { class: 'app-hero__sub' }, `${m.store.developer} · Version ${m.version}`)),
            section({},
              row({ title: 'Open', tone: 'accent', chevron: false, onClick: () => system.openApp(id) }),
              row({ title: 'Signed by', value: rr.signature.trusted ? rr.signature.publisher : 'Unverified developer' }),
              row({ title: 'Installed from', value: rr.source === 'factory' ? 'Preinstalled' : rr.source === 'store' ? 'Raken Store' : 'Package file' }),
              row({ title: 'Requires', value: `RakenOS ${m.minRakenOS} · API ${m.rasApiLevel}` })),
            m.permissions.length ? section({ header: 'Permissions' }, ...m.permissions.map((p) => { const pid = p.id || p; return switchRow({ title: KNOWN_PERMISSIONS[pid].label, subtitle: p.reason, checked: rr.permissions[pid], onChange: (v) => rasApps.setPermission(id, pid, v) }); })) : null,
            section({ header: 'Storage' },
              row({ title: 'App data', value: fmt(stor.size()) }),
              row({ title: 'Clear app data', tone: 'accent', chevron: false, onClick: async () => { if (await confirm(`Clear data for ${m.name}?`, 'The app will start as if it was newly installed.', { confirmLabel: 'Clear', destructive: true })) { system.wm.close(id); stor.clear(); toast('App data cleared'); nav.top.refresh(); } } })),
            section({}, row({ title: 'Remove app', tone: 'destructive', chevron: false, onClick: async () => { if (await confirm(`Remove ${m.name}?`, 'The app and its data will be removed.', { confirmLabel: 'Remove', destructive: true })) { system.wm.close(id); await rasApps.uninstall(id); nav.pop(); toast(`${m.name} removed`); } } })));
        },
      };
    }

    function changePin() {
      let first = null;
      const s = sheet({ title: security.hasPin() ? 'Change PIN' : 'Set up PIN', build: () => {
        const pad = pinPad({ title: 'Enter a new PIN', subtitle: 'Use 4 digits you will remember.', onComplete: async (v) => {
          if (!first) { first = v; pad.reset(); pad.setTitle('Confirm PIN', 'Enter the new PIN again.'); return; }
          if (v !== first) { first = null; pad.setTitle('Enter a new PIN'); pad.reset('The PINs didn’t match. Try again.', { shake: true }); return; }
          await security.setPin(v); s.close(); toast('PIN saved', { icon: 'check' });
        } });
        setTimeout(() => pad.focus(), 400);
        return pad.el;
      } });
    }

    function pageFor(route) {
      if (!route) return null;
      if (route.startsWith('app:')) return appPage(route.slice(4));
      if (route.startsWith('release:')) return releasePage(route.slice(8));
      if ((route === 'nfc' && !has('nfc')) || (route === 'scanner' && !has('scanner2d'))) return null;
      return pages[route] ? pages[route]() : null;
    }

    async function open(route) { const p = pageFor(route); if (p) await nav.push(p); }

    nav.push(rootPage, { animate: false });

    return {
      async route(r) {
        await nav.popToRoot();
        if (r === 'update' || r.startsWith('release:')) { await nav.push(updatePage(), { animate: false }); if (r.startsWith('release:')) await nav.push(releasePage(r.slice(8))); return; }
        if (r.startsWith('app:')) { await nav.push(pages.apps(), { animate: false }); }
        await open(r);
      },
      back() { return nav.pop(); },
      unmount() { offs.forEach((f) => f()); nav.destroy(); },
    };
  },
};

function fmt(b) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
