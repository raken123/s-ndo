// Builders for Raken Design System list rows and controls.
import { h, ic } from '../core/dom.js';

export function section({ header, footer, className = '' } = {}, ...rows) {
  return h('section', { class: `r-section ${className}` },
    header ? h('div', { class: 'r-section__header' }, header) : null,
    h('div', { class: 'r-list' }, rows),
    footer ? h('div', { class: 'r-section__footer' }, footer) : null);
}

function rowIcon(iconName, color) {
  if (!iconName) return null;
  return h('span', { class: 'r-row__icon', style: { background: color || 'var(--r-text-3)' } }, ic(iconName));
}

/* Navigation / value row. */
export function row({ icon: iconName, color, title, subtitle, value, onClick, chevron = !!onClick, tone, badge, id, trailing }) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, {
    class: `r-row ${iconName ? 'r-row--icon' : ''} ${tone === 'destructive' ? 'r-row--destructive' : ''} ${tone === 'accent' ? 'r-row--accent' : ''}`,
    type: onClick ? 'button' : null, onclick: onClick || null, 'data-row': id || null,
  },
  rowIcon(iconName, color),
  h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, title), subtitle ? h('span', { class: 'r-row__subtitle' }, subtitle) : null),
  badge != null ? h('span', { class: 'r-count' }, badge) : null,
  value != null ? h('span', { class: 'r-row__value' }, value) : null,
  trailing || null,
  chevron ? h('span', { class: 'r-row__chevron' }, ic('chevron-right')) : null);
}

export function switchEl({ checked, onChange, label, disabled }) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, disabled: disabled || null, 'aria-label': label });
  input.addEventListener('change', () => onChange(input.checked));
  return h('span', { class: 'r-switch' }, input, h('span', { class: 'r-switch__track' }), h('span', { class: 'r-switch__thumb' }));
}

export function switchRow({ icon: iconName, color, title, subtitle, checked, onChange, disabled, id }) {
  return h('label', { class: `r-row is-pressable ${iconName ? 'r-row--icon' : ''}`, 'data-row': id || null },
    rowIcon(iconName, color),
    h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, title), subtitle ? h('span', { class: 'r-row__subtitle' }, subtitle) : null),
    switchEl({ checked, onChange, label: title, disabled }));
}

export function slider({ value, min = 0, max = 1, step = 0.01, onInput, onChange, iconStart, iconEnd, label }) {
  const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
  const fill = () => input.style.setProperty('--fill', `${((+input.value - min) / (max - min)) * 100}%`);
  fill();
  input.addEventListener('input', () => { fill(); onInput && onInput(+input.value); });
  input.addEventListener('change', () => onChange && onChange(+input.value));
  const el = h('div', { class: 'r-slider' }, iconStart ? ic(iconStart) : null, input, iconEnd ? ic(iconEnd) : null);
  el.setValue = (v) => { input.value = v; fill(); };
  return el;
}

export function sliderRow(opts) {
  return h('div', { class: 'r-row r-row--slider' }, slider(opts));
}

/* Single-choice list with checkmarks. */
export function choiceRows({ options, value, onChange }) {
  return options.map((o) => h('button', {
    type: 'button', class: 'r-row', role: 'radio', 'aria-checked': String(o.value === value),
    onclick: () => onChange(o.value),
  },
  h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__title' }, o.label), o.subtitle ? h('span', { class: 'r-row__subtitle' }, o.subtitle) : null),
  o.value === value ? h('span', { class: 'r-row__check' }, ic('check')) : null));
}

export function segmented({ options, value, onChange, label }) {
  const el = h('div', { class: 'r-segmented', role: 'group', 'aria-label': label || null });
  const render = (v) => {
    el.replaceChildren(...options.map((o) => h('button', { type: 'button', 'aria-pressed': String(o.value === v), onclick: () => { render(o.value); onChange(o.value); } }, o.label)));
  };
  render(value);
  return el;
}

export function appIcon(app, size = '') {
  const glyph = app.glyph || (app.icon && app.icon.glyph) || 'grid';
  const bg = app.color || (app.icon && app.icon.background) || '#6b7280';
  return h('span', { class: `r-app-icon ${size ? `r-app-icon--${size}` : ''}`, style: { '--icon-bg': bg } }, ic(glyph));
}

export function emptyState(iconName, title, text, action) {
  return h('div', { class: 'r-empty' }, ic(iconName), h('div', { class: 'r-empty__title' }, title), text ? h('div', { class: 'r-empty__text' }, text) : null, action || null);
}
