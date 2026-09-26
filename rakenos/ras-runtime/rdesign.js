/*
 * RDesign — declarative interfaces for RAS apps.
 *
 * An .rdesign.json file is a tree of components that render with the Raken
 * Design System. Text may contain `{expression}` bindings that are evaluated
 * against the app's RScript state; inputs bind two-way to state variables.
 *
 * Components: screen, section, card, column, row, grid, text, button,
 * icon-button, cell, toggle, slider, input, segmented, progress, list, if,
 * badge, stat, image, icon, spacer, divider.
 */
import { toDisplay } from './rscript.js';

export const RDESIGN_VERSION = '1.0';
const TEXT_STYLES = ['display', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption'];
const COLORS = { secondary: 'var(--r-text-2)', tertiary: 'var(--r-text-3)', accent: 'var(--r-accent)', danger: 'var(--r-danger)', success: 'var(--r-success)', warning: 'var(--r-warning)' };

function el(tag, cls, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
}

export class RDesignRenderer {
  /* ctx: { vm, icon(name), asset(path) → url, onAction(name, arg), onBind(name, value) } */
  constructor(root, design, ctx) {
    this.root = root; this.design = design; this.ctx = ctx;
  }

  interp(text, scope) {
    if (text == null) return '';
    return String(text).replace(/\{([^{}]+)\}/g, (_, expr) => {
      try { return toDisplay(this.ctx.vm.evaluate(expr.trim(), scope)); } catch (e) { return '⚠'; }
    });
  }
  value(expr, scope, fallback = null) {
    if (expr == null) return fallback;
    if (typeof expr !== 'string') return expr;
    try { return this.ctx.vm.evaluate(expr, scope); } catch { return fallback; }
  }

  render() {
    // Preserve focus and caret of a bound input across re-renders.
    const active = document.activeElement;
    const focusKey = active && this.root.contains(active) ? active.getAttribute('data-bind') : null;
    const sel = focusKey && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scrollTop = this.root.scrollTop;
    const frag = document.createDocumentFragment();
    frag.appendChild(this.node(this.design, {}));
    this.root.replaceChildren(frag);
    this.root.scrollTop = scrollTop;
    if (focusKey) {
      const n = this.root.querySelector(`[data-bind="${CSS.escape(focusKey)}"]`);
      if (n) { n.focus({ preventScroll: true }); if (sel && n.setSelectionRange) try { n.setSelectionRange(sel[0], sel[1]); } catch {} }
    }
  }

  children(list, scope, parent) {
    for (const c of list || []) { const n = this.node(c, scope); if (n) parent.appendChild(n); }
    return parent;
  }

  action(node, scope) {
    return () => this.ctx.onAction(node.action, node.arg !== undefined ? this.value(String(node.arg), scope) : null);
  }

  node(n, scope) {
    if (!n || typeof n !== 'object') return null;
    const icon = (name) => this.ctx.icon(name);
    switch (n.type) {
      case 'screen': {
        const s = el('div', 'rd-screen');
        if (n.title) { const h = el('h1', 'r-large-title'); h.textContent = this.interp(n.title, scope); s.appendChild(h); }
        const body = el('div', 'rd-body'); this.children(n.children, scope, body); s.appendChild(body);
        return s;
      }
      case 'section': {
        const s = el('section', 'r-section');
        if (n.header) { const h = el('div', 'r-section__header'); h.textContent = this.interp(n.header, scope); s.appendChild(h); }
        const l = el('div', 'r-list'); this.children(n.children, scope, l); s.appendChild(l);
        if (n.footer) { const f = el('div', 'r-section__footer'); f.textContent = this.interp(n.footer, scope); s.appendChild(f); }
        return s;
      }
      case 'card': { const c = el('div', 'r-card rd-card'); return this.children(n.children, scope, c); }
      case 'column': case 'row': case 'grid': {
        const c = el('div', `rd-${n.type}`);
        if (n.gap != null) c.style.gap = `${+n.gap}px`;
        if (n.align) c.style.alignItems = n.align;
        if (n.justify) c.style.justifyContent = n.justify;
        if (n.padding != null) c.style.padding = `${+n.padding}px`;
        if (n.type === 'grid') c.style.gridTemplateColumns = `repeat(${Math.max(1, Math.min(6, n.columns || 2))}, minmax(0, 1fr))`;
        return this.children(n.children, scope, c);
      }
      case 'text': {
        const t = el('div', `r-${TEXT_STYLES.includes(n.style) ? n.style : 'body'} rd-text`);
        t.textContent = this.interp(n.text, scope);
        if (n.color && COLORS[n.color]) t.style.color = COLORS[n.color];
        if (n.align) t.style.textAlign = n.align;
        if (n.mono) t.classList.add('r-tabular');
        return t;
      }
      case 'button': {
        const v = { primary: 'r-btn--primary', tinted: 'r-btn--tinted', plain: 'r-btn--plain', destructive: 'r-btn--destructive' }[n.variant] || '';
        const b = el('button', `r-btn ${v} ${n.block ? 'r-btn--block' : ''} ${n.size === 'sm' ? 'r-btn--sm' : ''}`, { type: 'button' });
        if (n.icon) b.insertAdjacentHTML('beforeend', icon(n.icon));
        if (n.label) b.appendChild(document.createTextNode(this.interp(n.label, scope)));
        if (n.disabled && this.value(n.disabled, scope)) b.disabled = true;
        b.addEventListener('click', this.action(n, scope));
        return b;
      }
      case 'icon-button': {
        const b = el('button', 'r-icon-btn r-icon-btn--accent', { type: 'button', 'aria-label': this.interp(n.label || n.icon, scope) });
        b.innerHTML = icon(n.icon); b.addEventListener('click', this.action(n, scope));
        return b;
      }
      case 'cell': {
        const tag = n.action ? 'button' : 'div';
        const r = el(tag, `r-row ${n.icon ? 'r-row--icon' : ''} ${n.tone === 'destructive' ? 'r-row--destructive' : ''}`, n.action ? { type: 'button' } : null);
        if (n.icon) { const i = el('span', 'r-row__icon'); i.style.background = n.iconColor || 'var(--r-accent)'; i.innerHTML = icon(n.icon); r.appendChild(i); }
        const body = el('span', 'r-row__body');
        const t = el('span', 'r-row__title'); t.textContent = this.interp(n.title, scope); body.appendChild(t);
        if (n.subtitle) { const s = el('span', 'r-row__subtitle'); s.textContent = this.interp(n.subtitle, scope); body.appendChild(s); }
        r.appendChild(body);
        if (n.value != null) { const v = el('span', 'r-row__value'); v.textContent = this.interp(n.value, scope); r.appendChild(v); }
        if (n.action) { r.addEventListener('click', this.action(n, scope)); if (n.chevron !== false) r.insertAdjacentHTML('beforeend', `<span class="r-row__chevron">${icon('chevron-right')}</span>`); }
        return r;
      }
      case 'toggle': {
        const r = el('label', 'r-row is-pressable');
        const body = el('span', 'r-row__body');
        const t = el('span', 'r-row__title'); t.textContent = this.interp(n.label, scope); body.appendChild(t);
        if (n.subtitle) { const s = el('span', 'r-row__subtitle'); s.textContent = this.interp(n.subtitle, scope); body.appendChild(s); }
        const sw = el('span', 'r-switch');
        const input = el('input', null, { type: 'checkbox', role: 'switch', 'data-bind': n.bind, 'aria-label': this.interp(n.label, scope) });
        input.checked = !!this.value(n.bind, scope, false);
        input.addEventListener('change', () => this.ctx.onBind(n.bind, input.checked));
        sw.append(input, el('span', 'r-switch__track'), el('span', 'r-switch__thumb'));
        r.append(body, sw);
        return r;
      }
      case 'slider': {
        const wrap = el('div', 'r-slider rd-slider');
        if (n.icon) wrap.insertAdjacentHTML('beforeend', icon(n.icon));
        const input = el('input', null, { type: 'range', min: n.min ?? 0, max: n.max ?? 100, step: n.step ?? 1, 'data-bind': n.bind, 'aria-label': n.label || n.bind });
        const cur = Number(this.value(n.bind, scope, 0));
        input.value = String(cur);
        const setFill = () => { const lo = +input.min; const hi = +input.max; input.style.setProperty('--fill', `${((+input.value - lo) / (hi - lo || 1)) * 100}%`); };
        setFill();
        input.addEventListener('input', setFill);
        input.addEventListener('change', () => this.ctx.onBind(n.bind, Number(input.value)));
        wrap.appendChild(input);
        return wrap;
      }
      case 'input': {
        const input = el('input', 'r-field', { type: n.inputType === 'number' ? 'number' : 'text', placeholder: this.interp(n.placeholder || '', scope), 'data-bind': n.bind, enterkeyhint: n.submit ? 'done' : null, 'aria-label': n.placeholder || n.bind });
        const v = this.value(n.bind, scope, '');
        input.value = v == null ? '' : String(v);
        input.addEventListener('input', () => this.ctx.onBind(n.bind, n.inputType === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value, { silent: true }));
        if (n.submit) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.ctx.onAction(n.submit, null); } });
        return input;
      }
      case 'segmented': {
        const s = el('div', 'r-segmented rd-segmented', { role: 'group' });
        const cur = this.value(n.bind, scope);
        for (const o of n.options || []) {
          const b = el('button', null, { type: 'button', 'aria-pressed': String(cur === o.value) });
          b.textContent = this.interp(o.label, scope);
          b.addEventListener('click', () => this.ctx.onBind(n.bind, o.value));
          s.appendChild(b);
        }
        return s;
      }
      case 'progress': {
        const p = el('div', 'r-progress rd-progress', { role: 'progressbar' });
        const bar = el('div', 'r-progress__bar');
        const v = Math.max(0, Math.min(1, Number(this.value(n.value, scope, 0)) || 0));
        bar.style.width = `${v * 100}%`; p.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        p.appendChild(bar); return p;
      }
      case 'list': {
        const items = this.value(n.items, scope, []);
        const arr = Array.isArray(items) ? items : [];
        const box = el('div', n.plain ? 'rd-list-plain' : 'r-list');
        if (!arr.length) {
          if (!n.empty) return el('div');
          const e = el('div', 'rd-empty r-footnote r-secondary'); e.textContent = this.interp(n.empty, scope); return e;
        }
        arr.forEach((item, index) => { const c = this.node(n.template, { ...scope, item, index }); if (c) box.appendChild(c); });
        return box;
      }
      case 'if': {
        const ok = !!this.value(n.cond, scope, false);
        const frag = el('div', 'rd-if');
        this.children(ok ? n.children : n.else, scope, frag);
        return frag;
      }
      case 'badge': {
        const tone = { accent: 'r-badge--accent', success: 'r-badge--success', warning: 'r-badge--warning', danger: 'r-badge--danger' }[n.tone] || '';
        const b = el('span', `r-badge ${tone}`); b.textContent = this.interp(n.text, scope); return b;
      }
      case 'stat': {
        const s = el('div', 'rd-stat');
        const v = el('div', 'rd-stat__value r-tabular'); v.textContent = this.interp(n.value, scope);
        const l = el('div', 'rd-stat__label'); l.textContent = this.interp(n.label, scope);
        s.append(v, l); return s;
      }
      case 'image': {
        const url = this.ctx.asset(n.asset);
        if (!url) return null;
        const img = el('img', 'rd-image', { src: url, alt: this.interp(n.alt || '', scope) });
        if (n.height) img.style.height = `${+n.height}px`;
        return img;
      }
      case 'icon': { const s = el('span', 'rd-icon'); s.innerHTML = icon(n.name); if (n.size) s.style.fontSize = `${+n.size}px`; if (n.color && COLORS[n.color]) s.style.color = COLORS[n.color]; return s; }
      case 'spacer': { const s = el('div', 'rd-spacer'); if (n.size) s.style.height = `${+n.size}px`; return s; }
      case 'divider': return el('div', 'r-divider');
      default: {
        const w = el('div', 'rd-unknown r-footnote r-tertiary'); w.textContent = `Unsupported component "${n.type}"`; return w;
      }
    }
  }
}

export const RDESIGN_CSS = `
.rd-screen { padding-bottom: 24px; }
.rd-body { display: flex; flex-direction: column; gap: 16px; padding: 0 16px; }
.rd-body > .r-section { margin: 0; }
.rd-column { display: flex; flex-direction: column; gap: 12px; }
.rd-row { display: flex; flex-direction: row; align-items: center; gap: 12px; }
.rd-row > .r-btn { flex: 1; }
.rd-grid { display: grid; gap: 12px; }
.rd-card { display: flex; flex-direction: column; gap: 12px; }
.rd-text { overflow-wrap: anywhere; }
.rd-stat { background: var(--r-surface); border-radius: var(--r-radius-md); padding: 14px 16px; }
.rd-stat__value { font: var(--r-text-title2); letter-spacing: var(--r-tracking-tight); }
.rd-stat__label { font: var(--r-text-footnote); color: var(--r-text-2); margin-top: 2px; }
.rd-empty { text-align: center; padding: 24px 16px; }
.rd-image { width: 100%; border-radius: var(--r-radius-md); object-fit: cover; }
.rd-icon { display: inline-grid; font-size: 24px; color: var(--r-accent); }
.rd-spacer { height: 8px; }
.rd-list-plain { display: flex; flex-direction: column; gap: 8px; }
.rd-if { display: contents; }
`;
