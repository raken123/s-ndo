/** Meddelanden. Webbappar får inte läsa inkorgen — det ReeOS kan göra är att
 *  ta emot diktering, läsa upp klistrad text och skicka via telefonens SMS-app. */
import { el, icon, toast, setKids } from '../core/ui.js';
import { state, push, replace } from '../core/store.js';
import { listen, say, canListen, hush } from '../core/speech.js';
import { sensors } from '../core/sensors.js';

export function sendSMS(number, body) {
  const clean = String(number ?? '').replace(/[^\d+]/g, '');
  const separator = /iPhone|iPad|Macintosh/.test(navigator.userAgent) ? '&' : '?';
  location.href = `sms:${clean}${body ? `${separator}body=${encodeURIComponent(body)}` : ''}`;
}

export const messagesApp = {
  id: 'messages',
  name: 'Meddelanden',
  icon: 'message',
  dock: true,

  mount(root) {
    const body = el('textarea', { class: 'input', placeholder: 'Diktera eller skriv…', rows: '3' });
    const recipient = el('select', { class: 'input' });
    const readBox = el('textarea', { class: 'input', placeholder: 'Klistra in ett meddelande för uppläsning', rows: '3' });
    const quick = el('div', { class: 'chips' });

    function renderRecipients() {
      setKids(recipient, 
        el('option', { value: '', text: 'Välj mottagare' }),
        ...state.contacts.filter((c) => c.number).map((c) => el('option', { value: c.number, text: `${c.name} · ${c.number}` })),
      );
    }

    function renderQuick() {
      setKids(quick, 
        ...state.quickReplies.map((text, i) => el('button', {
          class: 'chip-btn',
          onClick: () => { body.value = text; say(text); },
          onContextmenu: (ev) => {
            ev.preventDefault();
            const edited = prompt('Ändra snabbsvar:', text);
            if (edited === null) return;
            const list = [...state.quickReplies];
            if (edited.trim()) list[i] = edited.trim(); else list.splice(i, 1);
            replace('quickReplies', list);
            renderQuick();
          },
          text,
        })),
        el('button', {
          class: 'chip-btn',
          onClick: () => {
            const text = prompt('Nytt snabbsvar:');
            if (text?.trim()) { push('quickReplies', text.trim()); renderQuick(); }
          },
        }, '+ Nytt'),
      );
    }

    const dictateBtn = el('button', {
      class: 'btn primary',
      onClick: async () => {
        if (!canListen) { toast('Diktering stöds inte i den här webbläsaren.', 'err'); return; }
        dictateBtn.classList.add('on');
        dictateBtn.lastChild.textContent = 'Lyssnar…';
        try {
          const text = await listen();
          body.value = body.value ? `${body.value} ${text}` : text;
        } catch (err) { toast(err.message, 'warn'); }
        finally {
          dictateBtn.classList.remove('on');
          dictateBtn.lastChild.textContent = 'Diktera';
        }
      },
    }, icon('mic'), el('span', { text: 'Diktera' }));

    root.append(
      el('div', { class: 'card' },
        el('h3', { text: 'Snabbsvar' }),
        quick,
        el('p', { class: 'hint', style: 'margin-top:8px', text: 'Håll ett svar intryckt för att ändra det.' }),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Skicka' }),
        el('div', { class: 'field' }, el('label', { text: 'Till' }), recipient),
        body,
        el('div', { class: 'row' },
          dictateBtn,
          el('button', { class: 'btn', onClick: () => { body.value = ''; } }, icon('x'), 'Rensa'),
          el('button', {
            class: 'btn primary grow',
            onClick: () => {
              if (!body.value.trim()) { toast('Meddelandet är tomt.', 'warn'); return; }
              if (!recipient.value) { toast('Välj mottagare först.', 'warn'); return; }
              sendSMS(recipient.value, body.value.trim());
            },
          }, icon('share'), 'Öppna i SMS'),
        ),
        el('p', { class: 'hint', text: 'Sista steget sker i telefonens SMS-app — ReeOS skickar aldrig något i ditt namn utan att du ser det.' }),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'card stack' },
        el('h3', { style: 'margin:0', text: 'Läs upp' }),
        readBox,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary grow', onClick: () => {
            if (!readBox.value.trim()) { toast('Klistra in text först.', 'warn'); return; }
            say(readBox.value.trim(), { force: true });
          } }, icon('volume'), 'Läs upp'),
          el('button', { class: 'btn', onClick: hush }, icon('x'), 'Tyst'),
        ),
      ),
    );

    renderRecipients();
    renderQuick();

    // Textinmatning i rörelse är farligt; låt dikteringen ta över.
    const guard = () => {
      const lock = state.settings.lockWhileDriving && sensors.driving;
      body.readOnly = lock;
      readBox.readOnly = lock;
      body.placeholder = lock ? 'Bilen rullar — använd Diktera' : 'Diktera eller skriv…';
    };
    guard();
    const timer = setInterval(guard, 1500);
    return () => clearInterval(timer);
  },
};
