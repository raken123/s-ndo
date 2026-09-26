// Settings › System Update, Automatic Updates, Update History and release notes.
import { h, ic } from '../core/dom.js';
import { formatBytes } from '../../lib/update-system/version.js';
import { updates } from '../services/updates.js';
import { section, row, switchRow, segmented } from '../ui/components.js';
import { rakenMark } from '../shell/logo.js';

const PHASES = [
  ['checking', 'Checking'], ['available', 'Update Available'], ['downloading', 'Downloading'], ['verifying', 'Verifying'],
  ['preparing', 'Preparing'], ['ready', 'Ready'], ['updated', 'Updated'],
];
const PHASE_INDEX = { checking: 0, available: 1, downloading: 2, verifying: 3, preparing: 4, ready: 5, installing: 5, updated: 6 };

const timeFmt = (t) => {
  if (!t) return 'Never';
  const d = new Date(t); const today = new Date().toDateString() === d.toDateString();
  return today ? `Today, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const inTime = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} seconds`;
  if (s < 5400) return `${Math.round(s / 60)} minutes`;
  if (s < 129600) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(s / 86400)} days`;
};
const groupsLabel = (g) => { const l = g && g.length ? g : ['A']; return l.length === 1 ? `Group ${l[0]} has` : `Groups ${l.slice(0, -1).join(', ')} and ${l[l.length - 1]} have`; };
const typeLabel = { major: 'Major release', maintenance: 'Maintenance update', polish: 'Security & polish' };

export function updatePage() {
  const engine = updates.engine;
  let off = null;
  return {
    title: 'System Update',
    build(page) {
      const s = engine.snapshot;
      const root = h('div', { class: 'upd' });
      const cur = updates.installedRelease();
      const statusText = {
        idle: 'Check for updates to make sure you have the latest security content.',
        checking: 'Checking for updates…',
        'up-to-date': 'RakenOS is up to date.',
        'rollout-pending': `RakenOS ${s.target} is rolling out in stages.`,
        available: `RakenOS ${s.target} is available.`,
        downloading: `Downloading RakenOS ${s.target}…`,
        verifying: `Verifying RakenOS ${s.target}…`,
        preparing: `Preparing RakenOS ${s.target}…`,
        ready: `RakenOS ${s.target} is ready to install.`,
        installing: `Installing RakenOS ${s.target}…`,
        updated: `RakenOS ${s.system.version} has been installed.`,
        error: s.error || 'The update could not be completed.',
      }[s.status];

      root.appendChild(h('div', { class: 'upd__hero' },
        h('div', { class: 'upd__mark', html: rakenMark(40, { color: '#fff' }) }),
        h('div', { class: 'upd__name' }, 'RakenOS'),
        h('div', { class: 'upd__version r-tabular', dataset: { testid: 'current-version' } }, s.system.version),
        h('div', { class: `upd__status ${s.status === 'error' ? 'is-error' : ''}`, role: 'status', dataset: { testid: 'update-status', status: s.status } }, statusText)));

      // Phase stepper for an update in progress
      if (PHASE_INDEX[s.status] != null) {
        const idx = PHASE_INDEX[s.status];
        root.appendChild(h('ol', { class: 'upd__phases', 'aria-label': 'Update progress' }, PHASES.map(([k, label], i) => h('li', { class: i < idx ? 'is-done' : i === idx ? 'is-current' : '' }, h('span', { class: 'upd__dot' }, i < idx ? ic('check') : null), label))));
      }

      const card = h('div', { class: 'upd__card' });
      const rel = s.release;
      if (rel && ['available', 'downloading', 'verifying', 'preparing', 'ready', 'installing', 'rollout-pending'].includes(s.status)) {
        card.append(
          h('div', { class: 'upd__rel-head' }, h('div', null, h('div', { class: 'upd__rel-name' }, rel.name), h('div', { class: 'upd__rel-meta' }, `${rel.releaseDate} · ${formatBytes(rel.payload.sizeBytes)} · ${typeLabel[rel.releaseType]}`)), h('span', { class: 'r-badge r-badge--accent' }, rel.title)),
          h('p', { class: 'upd__rel-summary' }, rel.summary),
          h('button', { class: 'r-btn r-btn--plain upd__notes-link', onclick: () => page.nav.push(releasePage(rel.version)) }, 'Release notes', ic('chevron-right')));
      }
      if (s.status === 'rollout-pending' && s.lastCheck) {
        const wait = s.lastCheck.eligibleAt - Date.now();
        card.appendChild(h('div', { class: 'upd__rollout' },
          ic('history'),
          h('div', null,
            h('div', { class: 'upd__rollout-title' }, `Your device is in rollout group ${s.rolloutGroup}`),
            h('div', { class: 'upd__rollout-text' }, `${groupsLabel(s.lastCheck.openGroups)} received this update. Your device receives it ${wait > 0 ? `in about ${inTime(wait)}` : 'shortly'}.`))));
      }
      if (['downloading', 'verifying', 'preparing', 'installing'].includes(s.status)) {
        const prog = h('div', { class: `r-progress ${s.status !== 'downloading' ? 'r-progress--indeterminate' : ''}` }, h('div', { class: 'r-progress__bar', style: { width: s.status === 'downloading' ? `${Math.round(s.progress * 100)}%` : '' } }));
        const label = h('div', { class: 'upd__prog-label r-tabular' }, s.status === 'downloading' ? `${formatBytes(s.received)} of ${formatBytes(s.total)}` : s.status === 'verifying' ? 'Checking the package signature' : s.status === 'preparing' ? 'Staging system components' : 'Applying system components');
        card.append(prog, label);
        page.progressEls = { prog, label };
      }
      if (card.childNodes.length) root.appendChild(card);

      const actions = h('div', { class: 'upd__actions' });
      const btn = (label, fn, cls = 'r-btn--primary', testid) => actions.appendChild(h('button', { class: `r-btn ${cls} r-btn--block upd__btn`, onclick: fn, dataset: testid ? { testid } : null }, label));
      if (['idle', 'up-to-date', 'error', 'updated', 'rollout-pending'].includes(s.status)) btn(s.status === 'rollout-pending' ? 'Check Again' : 'Check for Updates', () => engine.check({ userInitiated: true }), s.status === 'rollout-pending' ? 'r-btn--tinted' : 'r-btn--primary', 'check-updates');
      if (s.status === 'checking') actions.appendChild(h('button', { class: 'r-btn r-btn--primary r-btn--block upd__btn', disabled: true }, h('span', { class: 'r-spinner upd__spin' }), 'Checking…'));
      if (s.status === 'available') btn('Download and Install', () => engine.download(), 'r-btn--primary', 'download');
      if (s.status === 'downloading') btn('Cancel Download', () => engine.cancelDownload(), '', 'cancel');
      if (s.status === 'ready') {
        btn('Install Now', () => engine.install(), 'r-btn--primary', 'install');
        if (s.settings.autoInstall) actions.appendChild(h('p', { class: 'upd__hint' }, 'Install when ready is on — this update installs the next time the device is locked.'));
      }
      if (s.status === 'updated' && s.updatedFrom) btn(`What’s new in ${s.system.version}`, () => page.nav.push(releasePage(s.system.version)), 'r-btn--tinted', 'whats-new');
      if (rel && rel.shellUpdate && s.status === 'ready') actions.appendChild(h('p', { class: 'upd__hint' }, 'This update includes a new RakenOS app package. Android will ask you to confirm the installation.'));
      root.appendChild(actions);

      root.appendChild(section({},
        row({ title: 'RakenOS', value: s.system.version }),
        row({ title: 'Current Version', value: `RakenOS ${s.system.version}`, subtitle: cur ? `Released ${cur.releaseDate}` : null, onClick: () => page.nav.push(releasePage(s.system.version)) }),
        row({ title: 'Last Checked', value: timeFmt(s.lastChecked), id: 'last-checked' }),
        row({ title: 'Automatic Updates', value: s.settings.automaticUpdates ? (s.settings.autoInstall ? 'On' : 'Download only') : 'Off', onClick: () => page.nav.push(autoPage()), id: 'automatic-updates' }),
        row({ title: 'Update History', value: `${updates.history().length}`, onClick: () => page.nav.push(historyPage()), id: 'update-history' })));
      root.appendChild(section({ header: 'Staged rollout', footer: 'Each RakenOS release reaches devices in stages over several days. Your group comes from an anonymous identifier stored only on this device — it contains no personal or hardware information.' },
        row({ title: 'Rollout group', value: `Group ${s.rolloutGroup}`, id: 'rollout-group' }),
        row({ title: 'Update source', value: engine.provider.kind === 'remote' ? 'Update server' : 'RakenOS update service' })));
      return root;
    },
    onShow(page) {
      off = engine.on((type) => {
        if (type !== 'state' && type !== 'settings') return;
        const st = engine.state.status;
        if (st === 'downloading' && page.progressEls && page.renderedStatus === 'downloading') {
          const s = engine.state;
          page.progressEls.prog.firstChild.style.width = `${Math.round(s.progress * 100)}%`;
          page.progressEls.label.textContent = `${formatBytes(s.received)} of ${formatBytes(s.total)}`;
          return;
        }
        page.renderedStatus = st;
        page.refresh();
      });
      page.renderedStatus = engine.state.status;
    },
    onHide() { off && off(); off = null; },
  };
}

export function autoPage() {
  const engine = updates.engine;
  return {
    title: 'Automatic Updates', back: 'Back',
    build() {
      const s = engine.settings;
      return h('div', null,
        section({ footer: 'RakenOS checks for updates in the background and downloads them over Wi-Fi when your rollout group becomes eligible.' },
          switchRow({ title: 'Automatic Updates', checked: s.automaticUpdates, onChange: (v) => { engine.setSettings({ automaticUpdates: v }); } , id: 'auto-updates' })),
        section({ header: 'When an update is available', footer: 'With Install when ready, updates install while the device is locked. You can always install sooner from System Update.' },
          switchRow({ title: 'Download updates automatically', checked: s.autoDownload, onChange: (v) => engine.setSettings({ autoDownload: v }), id: 'auto-download' }),
          switchRow({ title: 'Install when ready', checked: s.autoInstall, onChange: (v) => engine.setSettings({ autoInstall: v }), id: 'auto-install' })));
    },
  };
}

export function historyPage() {
  let mode = 'installed';
  return {
    title: 'Update History',
    build(page) {
      const list = mode === 'installed' ? updates.history() : updates.all();
      const installed = updates.installed;
      const root = h('div', null,
        h('div', { class: 'hist__switch' }, segmented({ options: [{ label: 'Installed and earlier', value: 'installed' }, { label: 'All releases', value: 'all' }], value: mode, onChange: (v) => { mode = v; page.refresh(); }, label: 'History range' })));
      const byMajor = new Map();
      for (const r of list) { if (!byMajor.has(r.major)) byMajor.set(r.major, []); byMajor.get(r.major).push(r); }
      for (const [major, rels] of byMajor) {
        root.appendChild(section({ header: `RakenOS ${major} · ${updates.release(`${major}.0.0`).title}` },
          ...rels.map((r) => row({
            title: r.name, subtitle: r.releaseDate, id: `release-${r.version}`,
            value: r.version === installed ? 'Installed' : r.sequence > updates.installedRelease().sequence ? 'Not installed' : null,
            onClick: () => page.nav.push(releasePage(r.version)),
          }))));
      }
      return root;
    },
  };
}

export function releasePage(version) {
  const r = updates.release(version);
  return {
    title: r.name, back: 'Back',
    build() {
      const installed = updates.installedRelease();
      const state = r.version === installed.version ? 'Installed' : r.sequence < installed.sequence ? 'Previously installed' : 'Not installed yet';
      const root = h('article', { class: 'rel', dataset: { testid: 'release-notes', version: r.version } },
        h('div', { class: 'rel__head' },
          h('div', { class: 'rel__meta' }, h('span', { class: 'r-badge r-badge--accent' }, typeLabel[r.releaseType]), h('span', { class: 'r-badge' }, state)),
          h('div', { class: 'rel__title' }, r.title),
          h('div', { class: 'rel__date' }, `Released ${r.releaseDate} · ${formatBytes(r.payload.sizeBytes)}`),
          h('p', { class: 'rel__summary' }, r.summary)));
      for (const s of r.sections) {
        root.appendChild(h('section', { class: 'rel__section' }, h('h3', null, s.title), h('ul', null, s.items.map((it) => h('li', null, it)))));
      }
      root.appendChild(section({ header: 'Staged rollout', footer: 'Every group receives the same version; only the day differs.' },
        ...r.rollout.phases.map((p) => row({ title: `Group ${p.group}`, subtitle: `${p.share}% of devices`, value: p.offsetDays ? `${p.date} · day ${p.offsetDays}` : `${p.date} · release day` }))));
      root.appendChild(section({ header: 'Security' },
        row({ title: 'Security advisories', value: String(r.security.advisories.length) }),
        row({ title: 'Security content', value: `RakenOS ${r.security.patchLevel}` })));
      const c = r.components;
      root.appendChild(section({ header: 'System components' },
        row({ title: 'Interface', value: c.interface }),
        row({ title: 'RAS Runtime', value: c.rasRuntime }),
        row({ title: 'RAS API level', value: String(c.rasApiLevel) }),
        row({ title: 'RScript', value: c.rscript }),
        row({ title: 'Store service', value: c.store })));
      return root;
    },
  };
}

export { timeFmt };
