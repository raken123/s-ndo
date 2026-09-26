// Gallery: photos from Camera, favourites and a full-screen viewer.
import { h, ic } from '../core/dom.js';
import { idb } from '../core/idb.js';
import { NavStack } from '../ui/nav.js';
import { segmented, emptyState, section, row } from '../ui/components.js';
import { confirm, sheet, toast } from '../ui/overlays.js';

export default {
  mount(container, ctx) {
    const nav = new NavStack(container);
    let photos = []; let filter = 'all'; const urls = new Map();
    const url = (p) => { if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); return urls.get(p.id); };
    const load = async () => { photos = ((await idb.all('photos')) || []).filter((p) => p && p.blob).sort((a, b) => b.time - a.time); };

    const gridPage = {
      title: 'Gallery',
      build(page) {
        const list = filter === 'fav' ? photos.filter((p) => p.favorite) : photos;
        const groups = new Map();
        for (const p of list) { const k = new Date(p.time).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
        return h('div', { class: 'gal' },
          h('div', { class: 'gal__filter' }, segmented({ options: [{ label: 'All Photos', value: 'all' }, { label: 'Favourites', value: 'fav' }], value: filter, onChange: (v) => { filter = v; page.refresh(); }, label: 'Album' })),
          list.length ? [...groups].map(([day, ps]) => h('section', { class: 'gal__day' }, h('div', { class: 'gal__day-title' }, day), h('div', { class: 'gal__grid' }, ps.map((p) => h('button', { class: 'gal__cell', 'aria-label': `Photo from ${day}`, onclick: () => nav.push(viewer(list, list.indexOf(p))) }, h('img', { src: url(p), alt: '', loading: 'lazy' }), p.favorite ? h('span', { class: 'gal__fav' }, ic('heart')) : null)))))
            : emptyState('image', filter === 'fav' ? 'No favourites' : 'No photos yet', filter === 'fav' ? 'Tap the heart on a photo to add it here.' : 'Photos you take with Camera appear here.', filter === 'fav' ? null : h('button', { class: 'r-btn r-btn--tinted', onclick: () => ctx.openApp('camera') }, 'Open Camera')),
          list.length ? h('div', { class: 'gal__count r-footnote r-secondary' }, `${list.length} ${list.length === 1 ? 'photo' : 'photos'}`) : null);
      },
    };

    function viewer(list, index) {
      let i = index;
      return {
        title: '', large: false, back: 'Gallery',
        trailing: h('div', { class: 'r-hstack' },
          h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'Photo information', onclick: () => info(list[i]) }, ic('info'))),
        build(page) {
          const p = list[i];
          if (!p) return emptyState('image', 'Photo deleted', '');
          page.setTitle(new Date(p.time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
          const img = h('img', { class: 'viewer__img', src: url(p), alt: 'Photo' });
          const stage = h('div', { class: 'viewer__stage' }, img);
          let sx = null;
          stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
          stage.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (dx < -50 && i < list.length - 1) { i++; page.refresh(); } if (dx > 50 && i > 0) { i--; page.refresh(); } });
          return h('div', { class: 'viewer' }, stage,
            h('div', { class: 'viewer__bar' },
              h('button', { class: `r-icon-btn ${p.favorite ? 'is-fav' : ''}`, 'aria-label': p.favorite ? 'Remove from favourites' : 'Add to favourites', 'aria-pressed': String(!!p.favorite), onclick: async () => { p.favorite = !p.favorite; await idb.set('photos', p.id, p); page.refresh(); } }, ic('heart')),
              h('span', { class: 'viewer__pos r-footnote r-tabular' }, `${i + 1} of ${list.length}`),
              h('button', { class: 'r-icon-btn', 'aria-label': 'Delete photo', onclick: async () => {
                if (!(await confirm('Delete this photo?', 'It will be removed from this device.', { confirmLabel: 'Delete', destructive: true }))) return;
                await idb.delete('photos', p.id); list.splice(i, 1); photos = photos.filter((x) => x.id !== p.id); toast('Photo deleted');
                if (!list.length) { nav.pop(); gridPage.refreshNeeded = true; return; }
                i = Math.min(i, list.length - 1); page.refresh();
              } }, ic('trash'))));
        },
        onDestroy: () => nav.pages[0] && nav.pages[0].refresh(),
      };
    }

    function info(p) {
      sheet({ title: 'Information', build: () => section({},
        row({ title: 'Taken', value: new Date(p.time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) }),
        row({ title: 'Resolution', value: `${p.width} × ${p.height}` }),
        row({ title: 'File size', value: `${(p.blob.size / 1048576).toFixed(1)} MB` }),
        row({ title: 'Format', value: 'JPEG' })) });
    }

    load().then(() => nav.push(gridPage, { animate: false }));
    return {
      async resume() { await load(); if (nav.pages[0]) nav.pages[0].refresh(); },
      back: () => nav.pop(),
      unmount() { for (const u of urls.values()) URL.revokeObjectURL(u); nav.destroy(); },
    };
  },
};
