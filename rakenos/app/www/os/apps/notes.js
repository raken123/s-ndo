// Notes: quick notes with pinning, search and automatic saving.
import { h, ic, onLongPress } from '../core/dom.js';
import { storage } from '../core/store.js';
import { NavStack } from '../ui/nav.js';
import { emptyState } from '../ui/components.js';
import { menu, confirm, toast } from '../ui/overlays.js';

const KEY = 'rakenos.notes';
const read = () => storage.get(KEY) || [];
const write = (n) => storage.set(KEY, n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const when = (t) => { const d = new Date(t); return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

export default {
  mount(container) {
    const nav = new NavStack(container);
    let query = '';
    const newBtn = h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'New note', onclick: () => openNote(null) }, ic('pencil'));

    const listPage = {
      title: 'Notes', trailing: newBtn,
      build(page) {
        const notes = read().filter((n) => !query || n.text.toLowerCase().includes(query.toLowerCase())).sort((a, b) => (b.pinned - a.pinned) || (b.modified - a.modified));
        const field = h('input', { type: 'search', placeholder: 'Search notes', value: query, 'aria-label': 'Search notes' });
        field.addEventListener('input', () => { query = field.value; const pos = field.selectionStart; page.refresh(); const f = page.scroller.querySelector('input[type=search]'); f.focus(); f.setSelectionRange(pos, pos); });
        const card = (n) => {
          const [title, ...rest] = n.text.split('\n');
          const b = h('button', { class: 'note-card', type: 'button', onclick: () => openNote(n.id) },
            h('span', { class: 'note-card__title' }, n.pinned ? h('span', { class: 'note-card__pin' }, ic('bookmark')) : null, title.trim() || 'New note'),
            h('span', { class: 'note-card__meta' }, h('span', { class: 'r-tabular' }, when(n.modified)), ' ', rest.join(' ').trim().slice(0, 80) || 'No additional text'));
          onLongPress(b, () => menu(b, [
            { label: n.pinned ? 'Unpin' : 'Pin', icon: 'bookmark', action: () => { const all = read(); const x = all.find((y) => y.id === n.id); x.pinned = !x.pinned; write(all); page.refresh(); } },
            { label: 'Delete', icon: 'trash', destructive: true, action: () => del(n.id, page) },
          ]));
          return b;
        };
        const pinned = notes.filter((n) => n.pinned); const others = notes.filter((n) => !n.pinned);
        return h('div', { class: 'notes' },
          h('div', { class: 'set-search' }, h('label', { class: 'r-search' }, ic('search'), field)),
          notes.length ? [
            pinned.length ? h('div', { class: 'notes__group' }, h('div', { class: 'r-section__header' }, 'Pinned'), h('div', { class: 'r-list' }, pinned.map(card))) : null,
            others.length ? h('div', { class: 'notes__group' }, pinned.length ? h('div', { class: 'r-section__header' }, 'Notes') : null, h('div', { class: 'r-list' }, others.map(card))) : null,
            h('div', { class: 'r-footnote r-secondary notes__count' }, `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`),
          ] : emptyState('note', query ? 'No matching notes' : 'No notes', query ? 'Try a different search.' : 'Tap the pencil to write your first note.'));
      },
    };

    async function del(id, page) {
      if (!(await confirm('Delete this note?', 'This cannot be undone.', { confirmLabel: 'Delete', destructive: true }))) return false;
      write(read().filter((n) => n.id !== id)); toast('Note deleted'); page && page.refresh(); return true;
    }

    function openNote(id, animate = true) {
      let note = id ? read().find((n) => n.id === id) : null;
      if (!note) { note = { id: uid(), text: '', created: Date.now(), modified: Date.now(), pinned: false, draft: true }; }
      let t = null;
      const save = (text) => {
        const all = read(); const i = all.findIndex((n) => n.id === note.id);
        if (!text.trim()) { if (i >= 0) { all.splice(i, 1); write(all); } return; }
        note.text = text; note.modified = Date.now(); delete note.draft;
        if (i >= 0) all[i] = note; else all.push(note);
        write(all);
      };
      const more = h('button', { class: 'r-icon-btn r-icon-btn--accent', 'aria-label': 'More', onclick: (e) => menu(e.currentTarget, [
        { label: note.pinned ? 'Unpin' : 'Pin', icon: 'bookmark', action: () => { note.pinned = !note.pinned; save(nav.top.ta.value); } },
        { label: 'Delete', icon: 'trash', destructive: true, action: async () => { if (await del(note.id)) { note.text = ''; nav.top.ta.value = ''; nav.pop(); } } },
      ]) }, ic('more'));
      return nav.push({
        title: '', large: false, back: 'Notes', trailing: more,
        build(page) {
          const ta = h('textarea', { class: 'note-editor', placeholder: 'Title\nStart writing…', 'aria-label': 'Note' });
          ta.value = note.text;
          ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => save(ta.value), 350); });
          page.ta = ta;
          setTimeout(() => { if (!note.text) ta.focus(); }, 420);
          return h('div', { class: 'note-page' }, h('div', { class: 'note-date r-footnote r-secondary' }, new Date(note.modified).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })), ta);
        },
        onDestroy(page) { clearTimeout(t); save(page.ta.value); if (nav.pages[0]) nav.pages[0].refresh(); },
      }, { animate });
    }

    nav.push(listPage, { animate: false });
    return {
      async route(r) {
        await nav.popToRoot();
        if (r === 'new') openNote(null, false);
        else if (r.startsWith('note:')) openNote(r.slice(5), false);
      },
      back: () => nav.pop(),
      unmount() { nav.destroy(); },
    };
  },
};
