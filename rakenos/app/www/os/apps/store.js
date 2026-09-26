/*
 * Raken Store — Discover, Search, Categories and Library.
 * Store installs, updates and opens RAS apps. Apps are published with
 * Developer Studio; there is intentionally no upload or publish function here.
 */
import { h, ic } from '../core/dom.js';
import { NavStack } from '../ui/nav.js';
import { section, row, appIcon, emptyState, switchRow } from '../ui/components.js';
import { sheet, dialog, toast } from '../ui/overlays.js';
import { store, loadCatalog } from '../services/store-service.js';
import { rasApps, KNOWN_PERMISSIONS } from '../services/ras-apps.js';
import { updates } from '../services/updates.js';
import { CAPABILITY_INFO } from '../core/capabilities.js';

const kb = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const count = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));
const busy = new Map(); // appId → { phase, progress }

export default {
  async mount(container, ctx) {
    let tab = 'discover';
    const wrap = h('div', { class: 'store' });
    const navHost = h('div', { class: 'store__nav' });
    const tabs = h('nav', { class: 'tabbar', role: 'tablist' });
    wrap.append(navHost, tabs);
    container.appendChild(wrap);
    const nav = new NavStack(navHost);
    const offs = [rasApps.on('change', () => { store.refreshBadge(); refreshAll(); })];
    const refreshAll = () => { for (const p of nav.pages) if (!p.el.hidden) p.refresh(); renderTabs(); };

    if (!store.catalog) { try { await loadCatalog(); } catch { /* shown below */ } }

    const TABS = [['discover', 'Discover', 'sparkle'], ['search', 'Search', 'search'], ['categories', 'Categories', 'grid'], ['library', 'Library', 'package']];
    function renderTabs() {
      const upd = store.updates().length;
      tabs.replaceChildren(...TABS.map(([k, l, i]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), class: `tabbar__item ${tab === k ? 'is-active' : ''}`, onclick: () => switchTab(k) }, h('span', { class: 'tabbar__icon' }, ic(i), k === 'library' && upd ? h('span', { class: 'r-count tabbar__badge' }, String(upd)) : null), h('span', null, l))));
    }
    async function switchTab(k) {
      if (tab === k) { await nav.popToRoot(); nav.top.scroller.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      tab = k; nav.destroy(); await nav.push(roots[k](), { animate: false }); renderTabs();
    }

    // ------------------------------------------------------------ Helpers
    function action(entry, { compact = true } = {}) {
      const installed = rasApps.get(entry.id);
      const b = busy.get(entry.id);
      const compat = rasApps.compatibility(entry);
      const cls = compact ? 'r-btn r-btn--sm store-get' : 'r-btn r-btn--primary store-get store-get--lg';
      if (b) return h('button', { class: `${cls} is-busy`, disabled: true, 'aria-label': b.phase }, h('span', { class: 'store-get__ring', style: { '--p': `${Math.round((b.progress || 0) * 100)}%` } }), b.phase);
      if (installed && entry.versionCode > installed.manifest.versionCode) return h('button', { class: cls, onclick: (e) => { e.stopPropagation(); install(entry, true); }, dataset: { testid: `update-${entry.id}` } }, 'Update');
      if (installed) return h('button', { class: cls, onclick: (e) => { e.stopPropagation(); ctx.openApp(entry.id); }, dataset: { testid: `open-${entry.id}` } }, 'Open');
      if (!compat.compatible) return h('button', { class: `${cls} is-unavailable`, onclick: (e) => { e.stopPropagation(); explain(entry, compat); }, 'aria-label': 'Not available on this device' }, 'Unavailable');
      return h('button', { class: cls, onclick: (e) => { e.stopPropagation(); install(entry); }, dataset: { testid: `get-${entry.id}` } }, 'Get');
    }

    function explain(entry, compat) {
      const needsUpdate = compat.problems.some((p) => p.code === 'os-version' || p.code === 'api-level');
      dialog({ title: `${entry.name} is not available`, message: compat.problems.map((p) => p.message).join(' '), actions: needsUpdate ? [{ label: 'Not Now' }, { label: 'System Update', primary: true, value: 'update' }] : [{ label: 'OK', primary: true }] })
        .then((v) => { if (v === 'update') ctx.openApp('settings', { route: 'update' }); });
    }

    function appRow(entry, i) {
      return h('div', { class: 'store-row', role: 'button', tabindex: '0', onclick: () => nav.push(detail(entry.id)), onkeydown: (e) => { if (e.key === 'Enter') nav.push(detail(entry.id)); } },
        i != null ? h('span', { class: 'store-row__rank r-tabular' }, String(i + 1)) : null,
        appIcon(entry, 'md'),
        h('span', { class: 'store-row__text' }, h('span', { class: 'store-row__name' }, entry.name), h('span', { class: 'store-row__sub' }, entry.summary)),
        action(entry));
    }

    function card(entry) {
      return h('button', { class: 'store-card', onclick: () => nav.push(detail(entry.id)) }, appIcon(entry, 'md'), h('span', { class: 'store-card__name' }, entry.name), h('span', { class: 'store-card__sub' }, store.category(entry.category).name));
    }

    async function install(entry, isUpdate = false) {
      const perms = entry.permissions || [];
      const grants = {};
      if (!isUpdate && perms.length) {
        const ok = await new Promise((resolve) => {
          const s = sheet({ title: `Install ${entry.name}?`, onClose: (v) => resolve(v === true), build: (close) => h('div', { class: 'r-stack' },
            h('div', { class: 'perm-head' }, appIcon(entry, 'md'), h('div', null, h('div', { class: 'r-headline' }, entry.name), h('div', { class: 'r-footnote r-secondary' }, `${entry.developer} · ${kb(entry.sizeBytes)}`))),
            h('p', { class: 'r-subhead r-secondary' }, 'This app asks for the following access. You can change this later in Settings › Privacy.'),
            h('div', { class: 'r-list' }, perms.map((p) => { grants[p.id] = true; return switchRow({ title: KNOWN_PERMISSIONS[p.id].label, subtitle: p.reason, checked: true, onChange: (v) => { grants[p.id] = v; } }); })),
            h('button', { class: 'r-btn r-btn--primary r-btn--block', onclick: () => close(true), dataset: { testid: 'confirm-install' } }, 'Install')) });
          void s;
        });
        if (!ok) return;
      }
      const setB = (phase, progress) => { busy.set(entry.id, { phase, progress }); refreshAll(); };
      try {
        setB('Downloading', 0);
        const bytes = await rasApps.download(store.packageUrl(entry), entry.sha256, (p) => { busy.set(entry.id, { phase: 'Downloading', progress: p }); });
        setB('Verifying', 1);
        await new Promise((r) => setTimeout(r, 450));
        setB('Installing', 1);
        await rasApps.install(bytes, { source: 'store', grants: isUpdate ? undefined : grants });
        await new Promise((r) => setTimeout(r, 300));
        busy.delete(entry.id); refreshAll();
        toast(isUpdate ? `${entry.name} updated` : `${entry.name} installed`, { icon: 'check' });
      } catch (e) {
        busy.delete(entry.id); refreshAll();
        dialog({ title: isUpdate ? 'Update failed' : 'Installation failed', message: e.message + (e.details ? ` ${e.details.join(' ')}` : ''), actions: [{ label: 'OK', primary: true }] });
      }
    }

    // ------------------------------------------------------------- Pages
    const catalogMissing = () => emptyState('bag', 'Raken Store is unavailable', 'Check your connection and try again.', h('button', { class: 'r-btn r-btn--tinted', onclick: async () => { try { await loadCatalog(); refreshAll(); } catch { toast('Still unavailable'); } } }, 'Try Again'));

    const roots = {
      discover: () => ({
        title: 'Discover',
        build() {
          const c = store.catalog; if (!c) return catalogMissing();
          const f = store.entry(c.featured.appId);
          return h('div', { class: 'store-discover' },
            f ? h('button', { class: 'store-feature', style: { '--feature': f.icon.background }, onclick: () => nav.push(detail(f.id)) },
              h('span', { class: 'store-feature__eyebrow' }, c.featured.eyebrow),
              h('span', { class: 'store-feature__title' }, c.featured.title),
              h('span', { class: 'store-feature__text' }, c.featured.text),
              h('span', { class: 'store-feature__app' }, appIcon(f, 'md'), h('span', null, h('span', { class: 'store-feature__name' }, f.name), h('span', { class: 'store-feature__sub' }, f.summary)))) : null,
            c.collections.map((col) => h('section', { class: 'store-col' }, h('h2', { class: 'store-col__title' }, col.title), h('div', { class: 'store-col__track' }, col.apps.map((id) => store.entry(id)).filter(Boolean).map(card)))),
            h('section', { class: 'store-col' }, h('h2', { class: 'store-col__title' }, 'Top apps'), h('div', { class: 'store-list' }, c.apps.slice().sort((a, b) => b.ratingCount - a.ratingCount).map((a, i) => appRow(a, i)))));
        },
      }),
      search: () => {
        let q = '';
        return {
          title: 'Search',
          build(page) {
            const c = store.catalog; if (!c) return catalogMissing();
            const field = h('input', { type: 'search', placeholder: 'Apps, developers and categories', value: q, 'aria-label': 'Search Raken Store' });
            const results = h('div', { class: 'store-list' });
            const run = () => {
              q = field.value.trim().toLowerCase();
              if (!q) { results.replaceChildren(h('div', { class: 'store-chips' }, c.categories.map((cat) => h('button', { class: 'store-chip', onclick: () => nav.push(categoryPage(cat.id)) }, ic(cat.icon), cat.name)))); return; }
              const hits = c.apps.filter((a) => [a.name, a.developer, a.summary, store.category(a.category).name].join(' ').toLowerCase().includes(q));
              results.replaceChildren(...(hits.length ? hits.map((a) => appRow(a)) : [emptyState('search', 'No results', `Nothing matches “${field.value.trim()}”.`)]));
            };
            field.addEventListener('input', run);
            run();
            setTimeout(() => { if (!q) field.focus(); }, 50);
            return h('div', null, h('div', { class: 'set-search' }, h('label', { class: 'r-search' }, ic('search'), field)), results);
          },
        };
      },
      categories: () => ({
        title: 'Categories',
        build() {
          const c = store.catalog; if (!c) return catalogMissing();
          return section({}, ...c.categories.map((cat) => row({ icon: cat.icon, color: '#2f5ae0', title: cat.name, value: String(c.apps.filter((a) => a.category === cat.id).length), onClick: () => nav.push(categoryPage(cat.id)) })));
        },
      }),
      library: () => ({
        title: 'Library',
        build() {
          const ups = store.updates();
          const installed = rasApps.list();
          return h('div', null,
            ups.length ? h('section', { class: 'store-col' },
              h('div', { class: 'store-col__head' }, h('h2', { class: 'store-col__title' }, `Updates · ${ups.length}`), h('button', { class: 'r-btn r-btn--sm r-btn--tinted', onclick: async () => { for (const u of ups) await install(u, true); } }, 'Update All')),
              h('div', { class: 'store-list' }, ups.map((u) => h('div', null, appRow(u), h('p', { class: 'store-notes' }, h('strong', null, `Version ${u.version}. `), u.releaseNotes))))) : null,
            h('section', { class: 'store-col' }, h('h2', { class: 'store-col__title' }, 'Installed'),
              installed.length ? h('div', { class: 'store-list' }, installed.map((r) => appRow(store.entry(r.manifest.id) || { ...r.manifest, summary: r.manifest.store.summary, developer: r.manifest.store.developer, category: r.manifest.store.category, versionCode: r.manifest.versionCode }))) : emptyState('package', 'No apps yet', 'Apps you install from Raken Store appear here.')),
            h('p', { class: 'r-footnote r-secondary store-foot' }, 'Developers publish RAS apps with Raken Developer Studio. Every package is verified before it is installed.'));
        },
      }),
    };

    function categoryPage(id) {
      const cat = store.category(id);
      return { title: cat.name, back: 'Back', build: () => h('div', { class: 'store-list store-list--padded' }, store.catalog.apps.filter((a) => a.category === id).map((a) => appRow(a))) };
    }

    function detail(id) {
      const entry = store.entry(id);
      return {
        title: entry.name, large: false, back: 'Back',
        build() {
          const compat = rasApps.compatibility(entry);
          const installed = rasApps.get(id);
          const reqCaps = entry.capabilities.required || []; const optCaps = entry.capabilities.optional || [];
          return h('div', { class: 'store-detail', dataset: { testid: `detail-${id}` } },
            h('div', { class: 'store-detail__head' }, appIcon(entry, 'lg'),
              h('div', { class: 'store-detail__id' }, h('h1', null, entry.name), h('div', { class: 'store-detail__dev' }, entry.developer, entry.verified ? h('span', { class: 'store-verified', title: 'Verified developer' }, ic('shield-check')) : null), h('div', { class: 'store-detail__cta' }, action(entry, { compact: false })))),
            h('div', { class: 'store-stats' },
              h('div', null, h('strong', null, `${entry.rating.toFixed(1)} `, ic('star')), h('span', null, `${count(entry.ratingCount)} ratings`)),
              h('div', null, h('strong', null, entry.ageRating), h('span', null, 'Age')),
              h('div', null, h('strong', null, kb(entry.sizeBytes)), h('span', null, 'Size')),
              h('div', null, h('strong', null, store.category(entry.category).name), h('span', null, 'Category'))),
            h('div', { class: `store-compat ${compat.compatible ? 'is-ok' : 'is-warn'}` }, ic(compat.compatible ? 'check' : 'alert'),
              h('div', null, h('div', { class: 'store-compat__title' }, compat.compatible ? 'Works with this device' : 'Not available on this device'),
                h('div', { class: 'store-compat__text' }, compat.compatible ? (compat.optionalMissing.length ? `Some features use hardware this device does not have (${compat.optionalMissing.map((c) => CAPABILITY_INFO[c] || c).join(', ')}).` : `Requires RakenOS ${entry.minRakenOS} or later.`) : compat.problems.map((p) => p.message).join(' ')))),
            h('p', { class: 'store-desc' }, entry.description),
            h('section', { class: 'store-col' }, h('h2', { class: 'store-col__title' }, 'What’s New'), h('div', { class: 'store-notes' }, h('div', { class: 'r-footnote r-secondary' }, `Version ${entry.version} · ${entry.updated}`), entry.releaseNotes)),
            section({ header: 'Permissions', footer: entry.permissions.length ? 'You can change permissions at any time in Settings › Privacy.' : null }, ...(entry.permissions.length ? entry.permissions.map((p) => row({ icon: KNOWN_PERMISSIONS[p.id].icon, color: '#3a58d0', title: KNOWN_PERMISSIONS[p.id].label, subtitle: p.reason })) : [row({ title: 'This app requires no permissions' })])),
            section({ header: 'Information' },
              row({ title: 'Developer', value: entry.developer }),
              row({ title: 'Version', value: installed ? `${installed.manifest.version} installed · ${entry.version} available` : entry.version }),
              row({ title: 'Requires', value: `RakenOS ${entry.minRakenOS} · API ${entry.rasApiLevel}` }),
              reqCaps.length ? row({ title: 'Hardware', value: reqCaps.map((c) => CAPABILITY_INFO[c] || c).join(', ') }) : null,
              optCaps.length ? row({ title: 'Uses if available', value: optCaps.map((c) => CAPABILITY_INFO[c] || c).join(', ') }) : null,
              row({ title: 'Package', value: 'RAS · signed' }),
              row({ title: 'Digest', value: entry.sha256.slice(0, 12) })));
        },
      };
    }

    renderTabs();
    await nav.push(roots.discover(), { animate: false });
    return {
      async route(r) { if (r === 'library' || r === 'search') await switchTab(r); else if (r && r.startsWith('app:')) { await nav.push(detail(r.slice(4))); } },
      back: () => nav.pop(),
      unmount() { offs.forEach((f) => f()); nav.destroy(); },
    };
  },
};
