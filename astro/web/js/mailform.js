// Formulär där besökaren skriver sin e-postadress efter resan.
// Har ett eget skärmtangentbord så att det fungerar på pekskärmar i museet utan fysiskt tangentbord.
import { t } from './i18n.js';

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}$/;
export function validEmail(s) { return s.length <= 254 && EMAIL_RE.test(s); }

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '⌫'],
  ['@', '.se', '.com', '@gmail.com', '@hotmail.com', '@outlook.com'],
];

export class MailForm {
  constructor({ onSubmit, onCancel }) {
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
    this.el = document.createElement('section');
    this.el.id = 'mailform';
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.busy = false;
  }

  get isOpen() { return !this.el.hidden; }

  open(retentionDays) {
    this.busy = false;
    this.finished = false;
    this.el.innerHTML = `
      <div class="dlg mail">
        <div class="kicker">ASTRO</div>
        <h2></h2>
        <p class="mtext"></p>
        <input id="mailInput" type="email" inputmode="email" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="osk"></div>
        <label class="consent"><input id="mailConsent" type="checkbox"> <span></span></label>
        <div class="mstatus" role="status"></div>
        <div class="btns">
          <button class="mcancel"></button>
          <button class="primary msend"></button>
        </div>
      </div>`;
    this.el.querySelector('h2').textContent = t('mailTitle');
    this.el.querySelector('.mtext').textContent = t('mailText');
    this.input = this.el.querySelector('#mailInput');
    this.input.placeholder = t('mailPlaceholder');
    this.consent = this.el.querySelector('#mailConsent');
    this.el.querySelector('.consent span').textContent = t('mailConsent', retentionDays);
    this.status = this.el.querySelector('.mstatus');
    this.sendBtn = this.el.querySelector('.msend');
    this.cancelBtn = this.el.querySelector('.mcancel');
    this.sendBtn.textContent = t('mailSend');
    this.cancelBtn.textContent = t('mailCancel');

    const osk = this.el.querySelector('.osk');
    for (const row of ROWS) {
      const r = document.createElement('div');
      r.className = 'okrow';
      for (const k of row) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = k;
        if (k.length > 2) b.className = 'wide';
        // pointerdown + preventDefault: fältet behåller fokus och det känns snabbt på pekskärm
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.key(k); });
        r.appendChild(b);
      }
      osk.appendChild(r);
    }
    this.sendBtn.addEventListener('click', () => this.submit());
    this.cancelBtn.addEventListener('click', () => { if (!this.busy) { const f = this.finished; this.close(); this.onCancel?.(f); } });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.submit(); } });
    this.consent.addEventListener('change', () => this.setStatus(''));
    this.el.hidden = false;
    setTimeout(() => this.input.focus({ preventScroll: true }), 50);
  }

  key(k) {
    if (this.busy) return;
    if (k === '⌫') this.input.value = this.input.value.slice(0, -1);
    else this.input.value = (this.input.value + k).slice(0, 254);
    this.setStatus('');
  }

  submit() {
    if (this.busy) return;
    const email = this.input.value.trim();
    if (!validEmail(email)) { this.setStatus(t('mailInvalid'), 'error'); return; }
    if (!this.consent.checked) { this.setStatus(t('mailNeedConsent'), 'error'); return; }
    this.onSubmit?.(email);
  }

  setBusy(b) {
    this.busy = b;
    this.sendBtn.disabled = b;
    this.cancelBtn.disabled = b;
    this.input.disabled = b;
    this.el.querySelectorAll('.osk button').forEach((x) => { x.disabled = b; });
  }

  setStatus(text, kind = '') {
    if (!this.status) return;
    this.status.textContent = text;
    this.status.className = 'mstatus ' + kind;
  }

  done(text) {
    this.setBusy(true);
    this.setStatus(text, 'ok');
    this.cancelBtn.disabled = false;
    this.cancelBtn.textContent = t('playAgain');
    this.busy = false;
    this.finished = true;
  }

  close() {
    this.el.hidden = true;
    this.el.innerHTML = '';
    this.busy = false;
  }
}
