// Files: Documents, Downloads and Pictures with basic file management.
import { h, ic, onLongPress } from '../core/dom.js';
import { vfs } from '../services/vfs.js';
import { idb } from '../core/idb.js';
import { NavStack } from '../ui/nav.js';
import { section, row, emptyState } from '../ui/components.js';
import { menu, prompt, confirm, toast, sheet } from '../ui/overlays.js';

const dateFmt = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const sizeFmt = (b) => (b < 1024 ? `${b} bytes` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export default {
  mount(container, ctx) {
    const nav = new NavStack(container);
    let sortBy = 'name';
    const off = vfs.on('change', () => nav.top && nav.top.refresh());

    const rootPage = {
      title: 'Files',
      build() {
        const recents = vfs.nodes.filter((n) => n.kind === 'file').sort((a, b) => b.modified - a.modified).slice(0, 4);
        return h('div', null,
          section({ header: 'Locations' }, ...vfs.children('root').map((n) => row({ icon: n.id === 'pictures' ? 'image' : n.id === 'downloads' ? 'download' : 'folder', color: '#2f7ad8', title: n.name, value: n.virtual ? '' : String(vfs.children(n.id).length), onClick: () => nav.push(folderPage(n.id)) }))),
          recents.length ? section({ header: 'Recent' }, ...recents.map((f) => fileRow(f))) : null);
      },
    };

    function fileRow(n) {
      const r = row({
        icon: n.kind === 'folder' ? 'folder' : 'file-text', color: n.kind === 'folder' ? '#2f7ad8' : '#7b818c',
        title: n.name, subtitle: `${dateFmt(n.modified)} · ${n.kind === 'folder' ? `${vfs.children(n.id).length} items` : sizeFmt(vfs.size(n))}`,
        onClick: () => nav.push(n.kind === 'folder' ? folderPage(n.id) : filePage(n.id)),
      });
      onLongPress(r, () => menu(r, [
        { label: 'Rename', icon: 'pencil', action: () => rename(n) },
        { label: 'Information', icon: 'info', action: () => infoSheet(n) },
        { label: 'Delete', icon: 'trash', destructive: true, action: () => remove(n) },
      ]));
      return r;
    }

    async function rename(n) {
      const v = await prompt('Rename', { value: n.name, confirmLabel: 'Rename' });
      if (v == null || !v.trim() || v === n.name) return;
      if (!vfs.rename(n.id, v.trim())) toast('An item with that name already exists');
    }
    async function remove(n) {
      if (await confirm(`Delete “${n.name}”?`, n.kind === 'folder' ? 'The folder and everything in it will be deleted.' : 'This file will be deleted.', { confirmLabel: 'Delete', destructive: true })) { vfs.remove(n.id); toast('Deleted'); }
    }
    function infoSheet(n) {
      sheet({ title: n.name, build: () => section({},
        row({ title: 'Kind', value: n.kind === 'folder' ? 'Folder' : 'Text document' }),
        row({ title: 'Location', value: vfs.path(n.parent).map((p) => p.name).join(' › ') }),
        row({ title: n.kind === 'folder' ? 'Items' : 'Size', value: n.kind === 'folder' ? String(vfs.children(n.id).length) : sizeFmt(vfs.size(n)) }),
        row({ title: 'Created', value: dateFmt(n.created) }),
        row({ title: 'Modified', value: dateFmt(n.modified) })) });
    }

    function folderPage(id) {
      const folder = vfs.get(id);
      const add = h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'New', onclick: (e) => menu(e.currentTarget, [
        { label: 'New Folder', icon: 'folder', action: async () => { const v = await prompt('New Folder', { value: 'New Folder', confirmLabel: 'Create' }); if (v && v.trim()) vfs.createFolder(id, v.trim()); } },
        { label: 'New Text File', icon: 'file-text', action: async () => { const v = await prompt('New Text File', { value: 'Untitled.txt', confirmLabel: 'Create' }); if (v && v.trim()) { const f = vfs.createFile(id, v.trim().endsWith('.txt') ? v.trim() : `${v.trim()}.txt`); nav.push(filePage(f.id)); } } },
        { label: sortBy === 'name' ? 'Sort by Date' : 'Sort by Name', icon: 'arrow-down', action: () => { sortBy = sortBy === 'name' ? 'date' : 'name'; nav.top.refresh(); } },
      ]) }, ic('plus'));
      return {
        title: folder.name, trailing: folder.virtual ? null : add,
        build(page) {
          if (folder.virtual === 'photos') {
            const box = h('div', null, h('div', { class: 'r-empty' }, h('span', { class: 'r-spinner' })));
            idb.all('photos').then((ps) => {
              const list = (ps || []).filter((p) => p && p.blob).sort((a, b) => b.time - a.time);
              box.replaceChildren(list.length ? section({ footer: 'Photos are managed in Gallery.' }, ...list.map((p) => row({ icon: 'image', color: '#e1574c', title: `${p.id}.jpg`, subtitle: `${dateFmt(p.time)} · ${sizeFmt(p.blob.size)}`, onClick: () => ctx.openApp('gallery') }))) : emptyState('image', 'No pictures', 'Photos you take with Camera appear here.'));
            });
            return box;
          }
          const items = vfs.children(id).sort((a, b) => (a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : sortBy === 'name' ? collator.compare(a.name, b.name) : b.modified - a.modified));
          return items.length ? section({ footer: `${items.length} ${items.length === 1 ? 'item' : 'items'} · Press and hold an item for more options.` }, ...items.map(fileRow)) : emptyState('folder', 'This folder is empty', 'Tap + to create a folder or a text file.');
        },
      };
    }

    function filePage(id) {
      const n = vfs.get(id);
      let t = null;
      return {
        title: n.name, large: false, noAutoRefresh: true,
        build(page) {
          const ta = h('textarea', { class: 'file-editor', 'aria-label': n.name, spellcheck: 'true' });
          ta.value = n.content || '';
          ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => vfs.write(id, ta.value), 400); });
          page.ta = ta;
          return h('div', { class: 'file-page' }, h('div', { class: 'file-meta r-footnote r-secondary' }, `Edited ${dateFmt(n.modified)} · Saved automatically`), ta);
        },
        onDestroy(page) { clearTimeout(t); if (page.ta) vfs.write(id, page.ta.value); },
      };
    }

    // Folder pages refresh on vfs changes, but editors must not re-render while typing.
    const origRefresh = nav.refresh.bind(nav);
    nav.refresh = (p = nav.top) => { if (p && p.def.noAutoRefresh) return; origRefresh(p); };

    nav.push(rootPage, { animate: false });
    return {
      async route(r) {
        if (!r.startsWith('node:')) return;
        const n = vfs.get(r.slice(5)); if (!n) return;
        await nav.popToRoot();
        const chain = vfs.path(n.kind === 'folder' ? n.id : n.parent).filter((x) => x.parent !== undefined);
        for (const f of chain) await nav.push(folderPage(f.id), { animate: false });
        if (n.kind === 'file') await nav.push(filePage(n.id));
      },
      back: () => nav.pop(),
      unmount() { off(); nav.destroy(); },
    };
  },
};
