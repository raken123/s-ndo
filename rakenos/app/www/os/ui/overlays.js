// System dialogs, sheets, action menus and toasts.
import { h, ic, nextFrame, wait } from '../core/dom.js';

let layer = null;
export function setOverlayLayer(el) { layer = el; }
const stack = [];

function scrim(onTap) {
  const s = h('div', { class: 'r-scrim' });
  if (onTap) s.addEventListener('click', onTap);
  return s;
}

export function dialog({ title, message, actions = [{ label: 'OK', primary: true }], content }) {
  return new Promise((resolve) => {
    const sc = scrim();
    const d = h('div', { class: 'r-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'r-dialog__body' },
        title && h('h2', { class: 'r-dialog__title' }, title),
        message && h('p', { class: 'r-dialog__message' }, message),
        content || null),
      h('div', { class: 'r-dialog__actions' }, actions.map((a, i) => h('button', {
        type: 'button', class: `${a.primary ? 'is-primary' : ''} ${a.destructive ? 'is-destructive' : ''}`,
        onclick: () => close(a.value !== undefined ? a.value : i),
      }, a.label))));
    const entry = { close: () => close(null) };
    async function close(v) {
      sc.classList.remove('is-open'); d.classList.remove('is-open');
      stack.splice(stack.indexOf(entry), 1);
      await wait(240); sc.remove(); d.remove(); resolve(v);
    }
    stack.push(entry);
    layer.append(sc, d);
    nextFrame().then(() => { sc.classList.add('is-open'); d.classList.add('is-open'); const b = d.querySelector('.is-primary') || d.querySelector('button'); b && b.focus({ preventScroll: true }); });
  });
}

export const confirm = (title, message, { confirmLabel = 'OK', destructive = false, cancelLabel = 'Cancel' } = {}) =>
  dialog({ title, message, actions: [{ label: cancelLabel, value: false }, { label: confirmLabel, value: true, primary: !destructive, destructive }] }).then((v) => v === true);

export function prompt(title, { message, value = '', placeholder = '', confirmLabel = 'Save', type = 'text' } = {}) {
  const input = h('input', { class: 'r-field', value, placeholder, type, style: { marginTop: '14px' }, 'aria-label': title });
  const p = dialog({ title, message, content: input, actions: [{ label: 'Cancel', value: null }, { label: confirmLabel, value: 'ok', primary: true }] });
  setTimeout(() => { input.focus(); input.select(); }, 280);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.closest('.r-dialog').querySelector('.is-primary').click(); });
  return p.then((v) => (v === 'ok' ? input.value : null));
}

/* Bottom sheet. `build(close)` returns the content node. */
export function sheet({ title, build, trailing, onClose, className = '' }) {
  let closed = false;
  const sc = scrim(() => close());
  const content = h('div', { class: 'r-sheet__content' });
  const s = h('div', { class: `r-sheet ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Sheet' },
    h('div', { class: 'r-sheet__grabber' }),
    (title || trailing !== false) && h('div', { class: 'r-sheet__header' },
      h('div', { class: 'r-sheet__title' }, title || ''),
      trailing === false ? null : h('button', { class: 'r-icon-btn sheet-close', 'aria-label': 'Close', onclick: () => close() }, ic('close'))),
    content);
  const entry = { close: () => close() };
  async function close(v) {
    if (closed) return; closed = true;
    sc.classList.remove('is-open'); s.classList.remove('is-open');
    stack.splice(stack.indexOf(entry), 1);
    onClose && onClose(v);
    await wait(380); sc.remove(); s.remove();
  }
  content.appendChild(build(close));
  // Drag down to dismiss
  let sy = null; let dy = 0;
  s.querySelector('.r-sheet__grabber').parentElement.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, textarea, .r-sheet__content')) return;
    sy = e.clientY; dy = 0; s.style.transition = 'none'; s.setPointerCapture(e.pointerId);
  });
  s.addEventListener('pointermove', (e) => { if (sy == null) return; dy = Math.max(0, e.clientY - sy); s.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (sy == null) return; sy = null; s.style.transition = ''; s.style.transform = ''; if (dy > 90) close(); };
  s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
  stack.push(entry);
  layer.append(sc, s);
  nextFrame().then(() => { sc.classList.add('is-open'); s.classList.add('is-open'); });
  return { close, element: s };
}

/* Action menu anchored to a point or element. items: [{ label, icon, action, destructive }] */
export function menu(anchor, items) {
  const sc = h('div', { class: 'menu-catcher' });
  const m = h('div', { class: 'r-menu', role: 'menu' }, items.filter(Boolean).map((it) => h('button', {
    type: 'button', role: 'menuitem', class: it.destructive ? 'is-destructive' : '',
    onclick: () => { close(); it.action && it.action(); },
  }, h('span', null, it.label), it.icon ? ic(it.icon) : null)));
  const entry = { close: () => close() };
  function close() { m.classList.remove('is-open'); stack.splice(stack.indexOf(entry), 1); setTimeout(() => { m.remove(); sc.remove(); }, 200); }
  sc.addEventListener('pointerdown', (e) => { e.preventDefault(); close(); });
  layer.append(sc, m);
  const L = layer.getBoundingClientRect();
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, bottom: anchor.y, right: anchor.x, width: 0 };
  const mw = m.offsetWidth; const mh = m.offsetHeight;
  let x = r.left - L.left; let y = r.bottom - L.top + 6;
  if (x + mw > L.width - 12) x = Math.max(12, r.right - L.left - mw);
  if (y + mh > L.height - 30) { y = r.top - L.top - mh - 6; m.style.transformOrigin = 'bottom left'; }
  m.style.left = `${Math.max(12, x)}px`; m.style.top = `${Math.max(40, y)}px`;
  stack.push(entry);
  nextFrame().then(() => m.classList.add('is-open'));
  return close;
}

let toastEl = null; let toastTimer = null;
export function toast(message, { icon: iconName } = {}) {
  if (!toastEl) { toastEl = h('div', { class: 'r-toast', role: 'status', 'aria-live': 'polite' }); layer.appendChild(toastEl); }
  toastEl.replaceChildren(...[iconName ? h('span', { html: '' }) : null].filter(Boolean));
  toastEl.innerHTML = '';
  if (iconName) toastEl.appendChild(h('span', { style: { display: 'contents' } }, ic(iconName)));
  toastEl.appendChild(document.createTextNode(message));
  clearTimeout(toastTimer);
  requestAnimationFrame(() => toastEl.classList.add('is-open'));
  toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), 2600);
}

/* Closes the top-most overlay; used by the back gesture. */
export function closeTopOverlay() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close(); return true;
}
export const hasOverlay = () => stack.length > 0;
