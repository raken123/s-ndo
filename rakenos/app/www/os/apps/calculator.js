// Calculator with operator precedence, percent, sign change and history.
import { h, ic } from '../core/dom.js';
import { storage } from '../core/store.js';
import { sheet } from '../ui/overlays.js';
import { emptyState } from '../ui/components.js';

const OPS = { '+': 1, '−': 1, '×': 2, '÷': 2 };
const clean = (n) => (Number.isFinite(n) ? Number(n.toPrecision(12)) : NaN);
function evaluate(tokens) {
  const out = []; const ops = [];
  const apply = () => { const b = out.pop(); const a = out.pop(); const o = ops.pop(); out.push(o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : b === 0 ? NaN : a / b); };
  for (const t of tokens) {
    if (typeof t === 'number') out.push(t);
    else { while (ops.length && OPS[ops[ops.length - 1]] >= OPS[t]) apply(); ops.push(t); }
  }
  while (ops.length) apply();
  return clean(out[0]);
}
const fmt = (n) => {
  if (Number.isNaN(n)) return 'Error';
  const s = Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-7 && n !== 0) ? n.toExponential(6).replace('e+', 'e') : String(n);
  const [i, d] = s.split('.');
  if (s.includes('e')) return s;
  return Number(i).toLocaleString(undefined, { maximumFractionDigits: 0 }).replace(/^-?0$/, i) + (d !== undefined ? `${(0.1).toLocaleString().charAt(1)}${d}` : '');
};

export default {
  mount(container) {
    let tokens = []; let entry = '0'; let fresh = true; let lastOp = null;
    const history = storage.get('rakenos.calc.history') || [];
    const expr = h('div', { class: 'calc__expr r-tabular', 'aria-live': 'polite' });
    const display = h('div', { class: 'calc__display r-tabular', role: 'status' });
    const SEP = (0.1).toLocaleString().charAt(1);
    const typed = (e) => { const neg = e.startsWith('-'); const [i, d] = e.replace('-', '').split('.'); return (neg ? '-' : '') + Number(i).toLocaleString() + (d !== undefined ? SEP + d : ''); };
    const render = () => {
      const txt = fresh ? fmt(Number(entry)) : typed(entry);
      display.textContent = txt;
      display.style.fontSize = txt.length > 11 ? '40px' : txt.length > 8 ? '54px' : '';
      expr.textContent = tokens.map((t) => (typeof t === 'number' ? fmt(t) : ` ${t} `)).join('');
      for (const b of keys.querySelectorAll('[data-op]')) b.classList.toggle('is-active', fresh && tokens.length > 0 && tokens[tokens.length - 1] === b.dataset.op);
      ac.textContent = entry !== '0' && !fresh ? 'C' : 'AC';
    };
    const digit = (d) => {
      if (fresh) { entry = d === '.' ? '0.' : d; fresh = false; }
      else { if (d === '.' && entry.includes('.')) return; if (entry.replace(/[-.]/g, '').length >= 12) return; entry = entry === '0' && d !== '.' ? d : entry + d; }
      render();
    };
    const op = (o) => {
      const last = tokens[tokens.length - 1];
      if (fresh && typeof last === 'string') tokens[tokens.length - 1] = o;
      else tokens.push(Number(entry), o);
      const nums = tokens.slice(0, -1);
      // Show the value of what is already decided: everything for + and −, the trailing product for × and ÷.
      let i = nums.length - 1;
      if (OPS[o] === 2) { while (i >= 2 && OPS[nums[i - 1]] === 2) i -= 2; } else i = 0;
      entry = String(evaluate(nums.slice(i)));
      fresh = true; render();
    };
    const equals = () => {
      if (!tokens.length) { if (lastOp) { tokens = [Number(entry), lastOp[0], lastOp[1]]; } else return; }
      else { if (fresh && typeof tokens[tokens.length - 1] === 'string') tokens.pop(); else tokens.push(Number(entry)); }
      const r = evaluate(tokens);
      if (tokens.length >= 3) lastOp = [tokens[tokens.length - 2], tokens[tokens.length - 1]];
      history.unshift({ expr: tokens.map((t) => (typeof t === 'number' ? fmt(t) : t)).join(' '), result: fmt(r) });
      storage.set('rakenos.calc.history', history.slice(0, 30));
      tokens = []; entry = String(r); fresh = true; render();
      expr.textContent = history[0].expr + ' =';
    };
    const clear = () => { if (entry !== '0' && !fresh) { entry = '0'; fresh = true; } else { tokens = []; entry = '0'; lastOp = null; } render(); };
    const key = (label, cls, fn, extra = {}) => h('button', { type: 'button', class: `calc__key ${cls || ''}`, onclick: fn, 'aria-label': extra.label || label, ...(extra.op ? { 'data-op': extra.op } : {}) }, label);
    const ac = key('AC', 'is-fn', clear, { label: 'Clear' });
    const keys = h('div', { class: 'calc__keys' },
      ac, key('±', 'is-fn', () => { entry = entry.startsWith('-') ? entry.slice(1) : entry === '0' ? '0' : `-${entry}`; fresh = false; render(); }, { label: 'Change sign' }),
      key('%', 'is-fn', () => { entry = String(clean(Number(entry) / 100)); render(); }, { label: 'Percent' }),
      key('÷', 'is-op', () => op('÷'), { op: '÷', label: 'Divide' }),
      ...['7', '8', '9'].map((d) => key(d, '', () => digit(d))), key('×', 'is-op', () => op('×'), { op: '×', label: 'Multiply' }),
      ...['4', '5', '6'].map((d) => key(d, '', () => digit(d))), key('−', 'is-op', () => op('−'), { op: '−', label: 'Subtract' }),
      ...['1', '2', '3'].map((d) => key(d, '', () => digit(d))), key('+', 'is-op', () => op('+'), { op: '+', label: 'Add' }),
      key('0', 'is-zero', () => digit('0')), key((0.1).toLocaleString().charAt(1), '', () => digit('.'), { label: 'Decimal point' }), key('=', 'is-op is-eq', equals, { label: 'Equals' }));
    const histBtn = h('button', { class: 'r-icon-btn calc__hist', 'aria-label': 'History', onclick: () => sheet({ title: 'History', build: () => history.length ? h('div', { class: 'r-list' }, history.map((x) => h('div', { class: 'r-row' }, h('span', { class: 'r-row__body' }, h('span', { class: 'r-row__subtitle r-tabular' }, x.expr), h('span', { class: 'r-row__title r-tabular' }, x.result))))) : emptyState('history', 'No history', 'Calculations you complete appear here.') }) }, ic('history'));
    const root = h('div', { class: 'calc' }, histBtn, h('div', { class: 'calc__screen' }, expr, display), keys);
    root.addEventListener('keydown', (e) => {
      const m = { '*': '×', '/': '÷', '-': '−', '+': '+' };
      if (/^[0-9.]$/.test(e.key)) digit(e.key); else if (m[e.key]) op(m[e.key]); else if (e.key === 'Enter' || e.key === '=') equals(); else if (e.key === 'Backspace') { entry = entry.length > 1 ? entry.slice(0, -1) : '0'; render(); } else if (e.key.toLowerCase() === 'c') clear(); else return;
      e.preventDefault();
    });
    root.tabIndex = 0;
    container.appendChild(root);
    render();
    return { resume: () => root.focus({ preventScroll: true }) };
  },
};
