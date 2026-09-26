// DOM helpers used throughout the RakenOS shell.
import { icon } from '../../lib/design-system/icons.js';

export { icon };

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else if (typeof c === 'object' && c.html != null) el.insertAdjacentHTML('beforeend', c.html);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

/* Inline SVG icon as a child: h('button', null, ic('plus'), 'Add') */
export const ic = (name, opts) => ({ html: icon(name, opts) });

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function nextFrame() { return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Adds `is-scrolled` to a navbar when its scroll container moves. */
export function trackScroll(scroller, bar) {
  const on = () => bar.classList.toggle('is-scrolled', scroller.scrollTop > 8);
  scroller.addEventListener('scroll', on, { passive: true });
  on();
}

/* Long-press detection for touch and mouse. */
export function onLongPress(el, fn, ms = 480) {
  let t = null; let sx = 0; let sy = 0; let fired = false;
  el.addEventListener('pointerdown', (e) => {
    fired = false; sx = e.clientX; sy = e.clientY;
    t = setTimeout(() => { fired = true; fn(e); }, ms);
  });
  const cancel = () => { clearTimeout(t); t = null; };
  el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!fired) { cancel(); fired = true; fn(e); } });
  el.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
}

export class Emitter {
  constructor() { this.map = new Map(); }
  on(type, fn) { if (!this.map.has(type)) this.map.set(type, new Set()); this.map.get(type).add(fn); return () => this.map.get(type).delete(fn); }
  emit(type, ...args) { for (const fn of this.map.get(type) || []) { try { fn(...args); } catch (e) { console.error(e); } } }
}
