// Numeric PIN pad used by Setup, the Lock Screen and Security settings.
import { h, ic } from '../core/dom.js';
import { platform } from '../core/platform.js';
import { settings } from '../core/store.js';

export function pinPad({ length = 4, onComplete, title = 'Enter PIN', subtitle = '', light = false, extraKey = null }) {
  let value = '';
  const dots = h('div', { class: 'pin__dots', 'aria-hidden': 'true' });
  const live = h('div', { class: 'r-visually-hidden', 'aria-live': 'polite' });
  const titleEl = h('div', { class: 'pin__title' }, title);
  const subEl = h('div', { class: 'pin__subtitle' }, subtitle);
  const renderDots = () => {
    dots.replaceChildren(...Array.from({ length }, (_, i) => h('span', { class: `pin__dot ${i < value.length ? 'is-filled' : ''}` })));
    live.textContent = `${value.length} of ${length} digits entered`;
  };
  const press = (d) => {
    if (el.classList.contains('is-busy')) return;
    if (settings.get('haptics')) platform.vibrate(6);
    if (d === 'del') { value = value.slice(0, -1); renderDots(); return; }
    if (value.length >= length) return;
    value += d; renderDots();
    if (value.length === length) {
      const v = value;
      el.classList.add('is-busy');
      setTimeout(() => Promise.resolve(onComplete(v)).finally(() => el.classList.remove('is-busy')), 120);
    }
  };
  const letters = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
  const key = (d) => h('button', { type: 'button', class: 'pin__key', 'aria-label': String(d), onclick: () => press(String(d)) },
    h('span', { class: 'pin__num' }, String(d)), h('span', { class: 'pin__letters' }, letters[d] || ''));
  const keys = h('div', { class: 'pin__keys' },
    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key),
    extraKey || h('span'),
    key(0),
    h('button', { type: 'button', class: 'pin__key pin__key--icon', 'aria-label': 'Delete', onclick: () => press('del') }, ic('arrow-left')));
  const el = h('div', { class: `pin ${light ? 'pin--light' : ''}` }, titleEl, subEl, dots, live, keys);
  el.addEventListener('keydown', (e) => {
    if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
    if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
  });
  el.tabIndex = -1;
  renderDots();
  return {
    el,
    reset(msg, { shake = false } = {}) {
      value = ''; renderDots();
      if (msg != null) subEl.textContent = msg;
      if (shake) { el.classList.remove('is-shaking'); void el.offsetWidth; el.classList.add('is-shaking'); if (settings.get('haptics')) platform.vibrate(40); }
    },
    setTitle(t, s) { titleEl.textContent = t; if (s != null) subEl.textContent = s; },
    setDisabled(on) { el.classList.toggle('is-disabled', on); },
    focus() { el.focus({ preventScroll: true }); },
  };
}
