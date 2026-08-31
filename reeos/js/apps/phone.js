/** Telefon. Webben får inte ringa själv — ReeOS lämnar över till telefonens
 *  egen appellare via tel:, vilket i praktiken är ett tryck för föraren. */
import { el, icon, toast, buzz, setKids } from '../core/ui.js';
import { state, push, remove, uid, save } from '../core/store.js';
import { on } from '../core/bus.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function callNumber(number) {
  const clean = String(number).replace(/[^\d+*#]/g, '');
  if (!clean) { toast('Inget nummer att ringa.', 'warn'); return false; }
  buzz([20, 40, 20]);
  location.href = `tel:${clean}`;
  return true;
}

/** Ring en kontakt på namn — används av röstassistenten. */
export function callContactByName(name) {
  const needle = name.toLowerCase().trim();
  const match = state.contacts.find((c) => c.name.toLowerCase() === needle)
    ?? state.contacts.find((c) => c.name.toLowerCase().includes(needle));
  if (!match) return { ok: false, reason: `Hittar ingen kontakt som heter ${name}.` };
  if (!match.number) return { ok: false, reason: `${match.name} saknar telefonnummer.` };
  callNumber(match.number);
  return { ok: true, contact: match };
}

export const phoneApp = {
  id: 'phone',
  name: 'Telefon',
  icon: 'phone',
  dock: true,

  mount(root) {
    const contactList = el('div', { class: 'list' });
    const readout = el('div', { class: 'dial-readout', text: '' });
    const pad = el('div', { class: 'dialpad' });
    let typed = '';

    const setTyped = (value) => { typed = value.slice(0, 20); readout.textContent = typed; };

    for (const key of KEYS) {
      pad.append(el('button', { onClick: () => { setTyped(typed + key); buzz(12); }, text: key }));
    }

    const dialView = el('div', { class: 'stack', hidden: true },
      readout,
      pad,
      el('div', { class: 'row', style: 'justify-content:center;margin-top:6px' },
        el('button', { class: 'btn', onClick: () => setTyped(typed.slice(0, -1)) }, icon('x'), 'Radera'),
        el('button', { class: 'btn primary', onClick: () => callNumber(typed) }, icon('phone'), 'Ring'),
      ),
      el('button', {
        class: 'btn block ghost',
        onClick: () => {
          if (!typed) { toast('Slå ett nummer först.', 'warn'); return; }
          const name = prompt('Vad heter kontakten?');
          if (!name) return;
          push('contacts', { id: uid(), name, number: typed, note: '' });
          setTyped('');
          renderContacts();
          toast('Kontakt sparad.', 'ok');
        },
      }, icon('plus'), 'Spara som kontakt'),
    );

    const toggleDial = el('button', {
      class: 'btn block',
      onClick: () => {
        dialView.hidden = !dialView.hidden;
        toggleDial.lastChild.textContent = dialView.hidden ? 'Knappsats' : 'Dölj knappsats';
      },
    }, icon('phone'), el('span', { text: 'Knappsats' }));

    root.append(
      el('div', { class: 'card' },
        el('div', { class: 'spread', style: 'margin-bottom:10px' },
          el('h3', { style: 'margin:0', text: 'Snabbval' }),
          el('button', {
            class: 'btn small',
            onClick: () => {
              const name = prompt('Namn?');
              if (!name) return;
              const number = prompt(`Telefonnummer till ${name}?`) ?? '';
              push('contacts', { id: uid(), name, number: number.trim(), note: '' });
              renderContacts();
            },
          }, icon('plus'), 'Ny'),
        ),
        contactList,
      ),
      el('div', { style: 'height:12px' }),
      toggleDial,
      el('div', { style: 'height:12px' }),
      dialView,
      el('p', { class: 'hint', style: 'margin-top:14px', text: 'Samtalet kopplas till telefonens vanliga appellare, så bilens handsfree och rattknappar fungerar som de brukar.' }),
    );

    function renderContacts() {
      setKids(contactList, 
        ...state.contacts.map((contact) => el('div', { class: 'list-item' },
          el('span', { class: 'avatar', text: contact.name.slice(0, 1).toUpperCase() }),
          el('button', {
            class: 'li-main', style: 'background:none;border:0;text-align:left',
            onClick: () => (contact.number ? callNumber(contact.number) : editContact(contact)),
          },
            el('b', { text: contact.name }),
            el('small', { text: contact.number || 'Tryck för att lägga till nummer' }),
          ),
          el('button', { class: 'btn small ghost', 'aria-label': `Ändra ${contact.name}`, onClick: () => editContact(contact) }, icon('gear')),
        )),
        state.contacts.length ? null : el('div', { class: 'empty' }, el('b', { text: 'Inga kontakter' })),
      );
    }

    function editContact(contact) {
      const number = prompt(`Telefonnummer till ${contact.name}?`, contact.number);
      if (number === null) return;
      if (number.trim() === '' && confirm(`Ta bort ${contact.name}?`)) { remove('contacts', contact.id); renderContacts(); return; }
      contact.number = number.trim();
      save();
      renderContacts();
    }

    renderContacts();
    const unbind = on('contacts:changed', renderContacts);
    return () => unbind();
  },
};
