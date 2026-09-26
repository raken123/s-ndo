// Boot animation. Shows the RakenOS mark and wordmark while services start.
import { h, wait } from '../core/dom.js';
import { rakenMark } from './logo.js';

export async function bootScreen(layer, work, { label = '' } = {}) {
  const el = h('div', { class: 'boot', role: 'status', 'aria-label': 'RakenOS is starting' },
    h('div', { class: 'boot__mark', html: rakenMark(64, { color: '#f4f5f7' }) }),
    h('div', { class: 'boot__word' }, 'RakenOS'),
    h('div', { class: 'boot__progress' }, h('div', { class: 'boot__bar' })),
    label ? h('div', { class: 'boot__label' }, label) : null);
  layer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-running'));
  const started = Date.now();
  let result;
  try { result = await work(); } finally {
    const minimum = 1900;
    await wait(Math.max(0, minimum - (Date.now() - started)));
    el.classList.add('is-done');
    await wait(520);
    el.remove();
  }
  return result;
}
