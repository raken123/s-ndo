/*
 * RScript — the scripting language of RAS applications.
 *
 *   state count = 0                   // observable state, re-renders the RDesign UI
 *   let items = []                    // plain variable
 *   fn add(n) { count += n }          // functions (closures), `return`
 *   on start { count = storage.get("count", 0) }
 *   on action "add" { add(1) }        // triggered by RDesign buttons
 *   on action "remove" (i) { … }      // with an argument
 *   on change "draft" (value) { … }   // two-way bound inputs
 *   on timer "tick" { … }             // timer.every(1000, "tick")
 *   if / else if / else, while, for x in list, for k, v in map, break, continue
 *   and / or / not (also && || !), == != < <= > >=, + - * / %
 *   lists [1, 2], maps { key: value }, lambdas fn (x) { return x * 2 }
 *
 * The interpreter is sandboxed: programs only see RScript values and the
 * host APIs passed in by the RAS host. Every evaluation step is counted, so a
 * runaway loop is stopped instead of freezing the system.
 */

export const RSCRIPT_VERSION = '1.0';

const KEYWORDS = new Set(['state', 'let', 'fn', 'on', 'if', 'else', 'while', 'for', 'in', 'return', 'break', 'continue', 'true', 'false', 'null', 'and', 'or', 'not']);

export class RScriptError extends Error {
  constructor(message, line) { super(line ? `${message} (line ${line})` : message); this.line = line; this.rscript = true; }
}

// ----------------------------------------------------------------- Lexer --
function tokenize(src) {
  const toks = []; let i = 0; let line = 1;
  const push = (type, value) => toks.push({ type, value, line });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === ';') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i; while (j < src.length && /[0-9_]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1])) { j++; while (j < src.length && /[0-9_]/.test(src[j])) j++; }
      push('num', Number(src.slice(i, j).replace(/_/g, ''))); i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1; let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { const n = src[j + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; }
        if (src[j] === '\n') throw new RScriptError('Unterminated string', line);
        s += src[j++];
      }
      if (j >= src.length) throw new RScriptError('Unterminated string', line);
      push('str', s); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j); push(KEYWORDS.has(w) ? 'kw' : 'id', w); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/='].includes(two)) { push('op', two); i += 2; continue; }
    if ('+-*/%<>=!(){}[],.:'.includes(c)) { push('op', c); i++; continue; }
    throw new RScriptError(`Unexpected character "${c}"`, line);
  }
  push('eof', null);
  return toks;
}

// ---------------------------------------------------------------- Parser --
class Parser {
  constructor(src) { this.t = tokenize(src); this.p = 0; }
  peek(o = 0) { return this.t[this.p + o]; }
  next() { return this.t[this.p++]; }
  is(type, value) { const k = this.peek(); return k.type === type && (value === undefined || k.value === value); }
  accept(type, value) { if (this.is(type, value)) return this.next(); return null; }
  expect(type, value) {
    const k = this.peek();
    if (k.type !== type || (value !== undefined && k.value !== value)) throw new RScriptError(`Expected ${value || type} but found ${k.value === null ? 'end of script' : `"${k.value}"`}`, k.line);
    return this.next();
  }

  program() { const body = []; while (!this.is('eof')) body.push(this.statement(true)); return { type: 'Program', body }; }

  block() {
    this.expect('op', '{'); const body = [];
    while (!this.is('op', '}')) { if (this.is('eof')) throw new RScriptError('Missing "}"', this.peek().line); body.push(this.statement(false)); }
    this.next(); return body;
  }

  params() {
    this.expect('op', '('); const ps = [];
    while (!this.is('op', ')')) { ps.push(this.expect('id').value); if (!this.accept('op', ',')) break; }
    this.expect('op', ')'); return ps;
  }

  statement(top) {
    const k = this.peek(); const line = k.line;
    if (k.type === 'kw') {
      switch (k.value) {
        case 'state': {
          if (!top) throw new RScriptError('state can only be declared at the top level', line);
          this.next(); const name = this.expect('id').value; this.expect('op', '=');
          return { type: 'State', name, init: this.expr(), line };
        }
        case 'let': { this.next(); const name = this.expect('id').value; this.expect('op', '='); return { type: 'Let', name, init: this.expr(), line }; }
        case 'fn': {
          if (this.peek(1).type === 'id') { this.next(); const name = this.next().value; const params = this.params(); return { type: 'FnDecl', name, params, body: this.block(), line }; }
          break;
        }
        case 'on': {
          if (!top) throw new RScriptError('Event handlers can only be declared at the top level', line);
          this.next(); const event = this.expect('id').value; let name = null; let params = [];
          if (this.is('str')) name = this.next().value;
          if (this.is('op', '(')) params = this.params();
          return { type: 'On', event, name, params, body: this.block(), line };
        }
        case 'if': return this.ifStatement();
        case 'while': { this.next(); const test = this.expr(); return { type: 'While', test, body: this.block(), line }; }
        case 'for': {
          this.next(); const a = this.expect('id').value; let b = null;
          if (this.accept('op', ',')) b = this.expect('id').value;
          this.expect('kw', 'in'); const iter = this.expr();
          return { type: 'For', key: b ? a : null, value: b || a, iter, body: this.block(), line };
        }
        case 'return': {
          this.next();
          const hasValue = !this.is('op', '}') && !this.is('eof') && this.peek().line === line;
          return { type: 'Return', arg: hasValue ? this.expr() : null, line };
        }
        case 'break': this.next(); return { type: 'Break', line };
        case 'continue': this.next(); return { type: 'Continue', line };
        default: break;
      }
    }
    const target = this.expr();
    const op = this.peek();
    if (op.type === 'op' && ['=', '+=', '-=', '*=', '/='].includes(op.value)) {
      this.next();
      if (!['Ident', 'Member', 'Index'].includes(target.type)) throw new RScriptError('Invalid assignment target', line);
      return { type: 'Assign', op: op.value, target, value: this.expr(), line };
    }
    return { type: 'ExprStmt', expr: target, line };
  }

  ifStatement() {
    const line = this.expect('kw', 'if').line; const test = this.expr(); const cons = this.block(); let alt = null;
    if (this.accept('kw', 'else')) alt = this.is('kw', 'if') ? [this.ifStatement()] : this.block();
    return { type: 'If', test, cons, alt, line };
  }

  expr() { return this.or(); }
  or() { let l = this.and(); while (this.is('kw', 'or') || this.is('op', '||')) { const line = this.next().line; l = { type: 'Logical', op: 'or', l, r: this.and(), line }; } return l; }
  and() { let l = this.not(); while (this.is('kw', 'and') || this.is('op', '&&')) { const line = this.next().line; l = { type: 'Logical', op: 'and', l, r: this.not(), line }; } return l; }
  not() { if (this.is('kw', 'not') || this.is('op', '!')) { const line = this.next().line; return { type: 'Unary', op: 'not', arg: this.not(), line }; } return this.cmp(); }
  cmp() {
    let l = this.add();
    while (this.peek().type === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(this.peek().value)) { const t = this.next(); l = { type: 'Binary', op: t.value, l, r: this.add(), line: t.line }; }
    return l;
  }
  add() { let l = this.mul(); while (this.is('op', '+') || this.is('op', '-')) { const t = this.next(); l = { type: 'Binary', op: t.value, l, r: this.mul(), line: t.line }; } return l; }
  mul() { let l = this.unary(); while (this.is('op', '*') || this.is('op', '/') || this.is('op', '%')) { const t = this.next(); l = { type: 'Binary', op: t.value, l, r: this.unary(), line: t.line }; } return l; }
  unary() { if (this.is('op', '-')) { const line = this.next().line; return { type: 'Unary', op: '-', arg: this.unary(), line }; } return this.postfix(); }
  postfix() {
    let e = this.primary();
    for (;;) {
      if (this.is('op', '(')) {
        const line = this.next().line; const args = [];
        while (!this.is('op', ')')) { args.push(this.expr()); if (!this.accept('op', ',')) break; }
        this.expect('op', ')'); e = { type: 'Call', callee: e, args, line };
      } else if (this.is('op', '.')) {
        const line = this.next().line; e = { type: 'Member', obj: e, prop: this.expect('id').value, line };
      } else if (this.is('op', '[')) {
        const line = this.next().line; const idx = this.expr(); this.expect('op', ']'); e = { type: 'Index', obj: e, idx, line };
      } else return e;
    }
  }
  primary() {
    const k = this.next(); const line = k.line;
    if (k.type === 'num' || k.type === 'str') return { type: 'Lit', value: k.value, line };
    if (k.type === 'kw') {
      if (k.value === 'true') return { type: 'Lit', value: true, line };
      if (k.value === 'false') return { type: 'Lit', value: false, line };
      if (k.value === 'null') return { type: 'Lit', value: null, line };
      if (k.value === 'fn') { const params = this.params(); return { type: 'Lambda', params, body: this.block(), line }; }
    }
    if (k.type === 'id') return { type: 'Ident', name: k.value, line };
    if (k.type === 'op' && k.value === '(') { const e = this.expr(); this.expect('op', ')'); return e; }
    if (k.type === 'op' && k.value === '[') {
      const items = []; while (!this.is('op', ']')) { items.push(this.expr()); if (!this.accept('op', ',')) break; }
      this.expect('op', ']'); return { type: 'List', items, line };
    }
    if (k.type === 'op' && k.value === '{') {
      const entries = [];
      while (!this.is('op', '}')) {
        const kt = this.next();
        if (!['id', 'str', 'kw'].includes(kt.type)) throw new RScriptError('Expected a map key', kt.line);
        this.expect('op', ':'); entries.push([String(kt.value), this.expr()]);
        if (!this.accept('op', ',')) break;
      }
      this.expect('op', '}'); return { type: 'MapLit', entries, line };
    }
    throw new RScriptError(`Unexpected ${k.value === null ? 'end of script' : `"${k.value}"`}`, line);
  }
}

export function parse(src) { return new Parser(src).program(); }
export function parseExpression(src) {
  const p = new Parser(src); const e = p.expr();
  if (!p.is('eof')) throw new RScriptError(`Unexpected "${p.peek().value}" in expression`);
  return e;
}

// ----------------------------------------------------------------- Values --
class Scope {
  constructor(parent = null) { this.parent = parent; this.vars = new Map(); }
  lookup(name) { let s = this; while (s) { if (s.vars.has(name)) return s; s = s.parent; } return null; }
}
class Fn { constructor(name, params, body, scope) { this.name = name; this.params = params; this.body = body; this.scope = scope; } }
export class Native { constructor(name, fn, { pure = false, vm = false } = {}) { this.name = name; this.fn = fn; this.pure = pure; this.vm = vm; } }
const BREAK = Symbol('break'); const CONTINUE = Symbol('continue');
class ReturnSignal { constructor(v) { this.value = v; } }

export function typeOf(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'list';
  if (v instanceof Map) return 'map';
  if (v instanceof Fn || v instanceof Native) return 'function';
  return typeof v;
}

export function toDisplay(v) {
  const t = typeOf(v);
  if (t === 'null') return 'null';
  if (t === 'number') return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
  if (t === 'string') return v;
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'list') return '[' + v.map(toDisplay).join(', ') + ']';
  if (t === 'map') return '{' + [...v].map(([k, x]) => `${k}: ${toDisplay(x)}`).join(', ') + '}';
  return '<fn ' + (v.name || 'anonymous') + '>';
}

const truthy = (v) => !(v === null || v === undefined || v === false || v === 0 || v === '');

function equals(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  if (a instanceof Map && b instanceof Map) return a.size === b.size && [...a].every(([k, v]) => b.has(k) && equals(v, b.get(k)));
  return a === b || (a == null && b == null);
}

/* Converts between RScript values and JSON-compatible JS values. */
export function toJS(v) {
  if (Array.isArray(v)) return v.map(toJS);
  if (v instanceof Map) { const o = {}; for (const [k, x] of v) o[k] = toJS(x); return o; }
  if (v instanceof Fn || v instanceof Native) return null;
  return v === undefined ? null : v;
}
export function fromJS(v) {
  if (v instanceof Map || v instanceof Fn || v instanceof Native) return v;
  if (Array.isArray(v)) return v.map(fromJS);
  if (v && typeof v === 'object') { const m = new Map(); for (const k of Object.keys(v)) m.set(k, fromJS(v[k])); return m; }
  return v === undefined ? null : v;
}

// ------------------------------------------------------------ Interpreter --
export class RScriptVM {
  constructor(source, { natives = {}, stepLimit = 200000, onStateChange } = {}) {
    this.stepLimit = stepLimit; this.steps = 0; this.depth = 0;
    this.onStateChange = onStateChange || (() => {});
    this.globals = new Scope();
    this.stateNames = new Set();
    this.handlers = [];
    this.exprCache = new Map();
    this.dirty = false;
    for (const [k, v] of Object.entries(builtins())) this.globals.vars.set(k, v);
    for (const [k, v] of Object.entries(natives)) this.globals.vars.set(k, wrapNative(k, v));
    this.program = parse(source);
  }

  /* Runs top-level declarations. Must be called once before emitting events. */
  init() {
    this.run(() => { for (const st of this.program.body) this.exec(st, this.globals); });
    return this;
  }

  getState() { const o = {}; for (const n of this.stateNames) o[n] = toJS(this.globals.vars.get(n)); return o; }
  getRaw(name) { return this.globals.vars.get(name); }
  setState(name, value) {
    if (!this.stateNames.has(name)) throw new RScriptError(`"${name}" is not a state variable`);
    this.globals.vars.set(name, fromJS(value)); this.dirty = true; this.flush();
  }
  hasHandler(event, name) { return this.handlers.some((h) => h.event === event && (h.name === null || h.name === name)); }

  emit(event, name = null, ...args) {
    const hs = this.handlers.filter((h) => h.event === event && (h.name === null || h.name === name));
    for (const h of hs) {
      this.run(() => {
        const scope = new Scope(this.globals);
        h.params.forEach((p, i) => scope.vars.set(p, fromJS(args[i] === undefined ? null : args[i])));
        try { this.execBlock(h.body, scope); } catch (e) { if (!(e instanceof ReturnSignal)) throw e; }
      });
    }
    return hs.length;
  }

  /* Evaluates an RDesign binding expression. Only pure functions may be called. */
  evaluate(src, extra = {}) {
    let ast = this.exprCache.get(src);
    if (!ast) { ast = parseExpression(src); this.exprCache.set(src, ast); }
    const scope = new Scope(this.globals);
    for (const [k, v] of Object.entries(extra)) scope.vars.set(k, fromJS(v));
    this.readOnly = true; this.steps = 0;
    try { return this.eval(ast, scope); } finally { this.readOnly = false; }
  }

  run(fn) {
    this.steps = 0; this.depth = 0;
    try { fn(); } finally { this.flush(); }
  }
  flush() { if (this.dirty) { this.dirty = false; this.onStateChange(this.getState()); } }

  tick(node) { if (++this.steps > this.stepLimit) throw new RScriptError('Script stopped: too many steps (possible infinite loop)', node && node.line); }

  execBlock(body, scope) { for (const st of body) this.exec(st, scope); }

  exec(st, scope) {
    this.tick(st);
    switch (st.type) {
      case 'State': this.stateNames.add(st.name); this.globals.vars.set(st.name, this.eval(st.init, scope)); this.dirty = true; return;
      case 'Let': scope.vars.set(st.name, this.eval(st.init, scope)); return;
      case 'FnDecl': scope.vars.set(st.name, new Fn(st.name, st.params, st.body, scope)); return;
      case 'On': this.handlers.push({ event: st.event, name: st.name, params: st.params, body: st.body }); return;
      case 'ExprStmt': this.eval(st.expr, scope); return;
      case 'Assign': return this.assign(st, scope);
      case 'If': {
        if (truthy(this.eval(st.test, scope))) this.execBlock(st.cons, new Scope(scope));
        else if (st.alt) this.execBlock(st.alt, new Scope(scope));
        return;
      }
      case 'While': {
        while (truthy(this.eval(st.test, scope))) {
          try { this.execBlock(st.body, new Scope(scope)); } catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
        }
        return;
      }
      case 'For': {
        const it = this.eval(st.iter, scope); let pairs;
        if (Array.isArray(it)) pairs = it.map((v, i) => [i, v]);
        else if (it instanceof Map) pairs = [...it];
        else if (typeof it === 'string') pairs = [...it].map((v, i) => [i, v]);
        else throw new RScriptError(`Cannot loop over ${typeOf(it)}`, st.line);
        for (const [k, v] of pairs) {
          const s = new Scope(scope); if (st.key) s.vars.set(st.key, k); s.vars.set(st.value, st.key || !(it instanceof Map) ? v : k);
          try { this.execBlock(st.body, s); } catch (e) { if (e === BREAK) break; if (e === CONTINUE) continue; throw e; }
        }
        return;
      }
      case 'Return': throw new ReturnSignal(st.arg ? this.eval(st.arg, scope) : null);
      case 'Break': throw BREAK;
      case 'Continue': throw CONTINUE;
      default: throw new RScriptError(`Unknown statement ${st.type}`, st.line);
    }
  }

  assign(st, scope) {
    const compute = (old) => {
      const v = this.eval(st.value, scope);
      if (st.op === '=') return v;
      return this.binary(st.op[0], old, v, st);
    };
    const t = st.target;
    if (t.type === 'Ident') {
      const s = scope.lookup(t.name);
      if (!s) throw new RScriptError(`Unknown variable "${t.name}" (declare it with let)`, st.line);
      if (s.vars.get(t.name) instanceof Native) throw new RScriptError(`Cannot assign to built-in "${t.name}"`, st.line);
      s.vars.set(t.name, compute(s.vars.get(t.name)));
      if (s === this.globals && this.stateNames.has(t.name)) this.dirty = true;
      return;
    }
    const obj = this.eval(t.obj, scope);
    const key = t.type === 'Member' ? t.prop : this.eval(t.idx, scope);
    if (Array.isArray(obj)) {
      if (!Number.isInteger(key) || key < 0 || key > obj.length) throw new RScriptError(`List index ${toDisplay(key)} out of range`, st.line);
      obj[key] = compute(obj[key]);
    } else if (obj instanceof Map) {
      obj.set(String(key), compute(obj.get(String(key)) ?? null));
    } else throw new RScriptError(`Cannot set a field on ${typeOf(obj)}`, st.line);
    this.dirty = true; // containers may be referenced by state
  }

  eval(e, scope) {
    this.tick(e);
    switch (e.type) {
      case 'Lit': return e.value;
      case 'Ident': {
        const s = scope.lookup(e.name);
        if (!s) throw new RScriptError(`Unknown name "${e.name}"`, e.line);
        return s.vars.get(e.name);
      }
      case 'List': return e.items.map((x) => this.eval(x, scope));
      case 'MapLit': { const m = new Map(); for (const [k, v] of e.entries) m.set(k, this.eval(v, scope)); return m; }
      case 'Lambda': return new Fn(null, e.params, e.body, scope);
      case 'Unary': {
        const v = this.eval(e.arg, scope);
        if (e.op === 'not') return !truthy(v);
        if (typeof v !== 'number') throw new RScriptError(`Cannot negate ${typeOf(v)}`, e.line);
        return -v;
      }
      case 'Logical': {
        const l = this.eval(e.l, scope);
        if (e.op === 'and') return truthy(l) ? this.eval(e.r, scope) : l;
        return truthy(l) ? l : this.eval(e.r, scope);
      }
      case 'Binary': return this.binary(e.op, this.eval(e.l, scope), this.eval(e.r, scope), e);
      case 'Member': {
        const o = this.eval(e.obj, scope);
        if (o instanceof Map) return o.has(e.prop) ? o.get(e.prop) : null;
        if ((Array.isArray(o) || typeof o === 'string') && e.prop === 'length') return o.length;
        throw new RScriptError(`${typeOf(o)} has no field "${e.prop}"`, e.line);
      }
      case 'Index': {
        const o = this.eval(e.obj, scope); const k = this.eval(e.idx, scope);
        if (Array.isArray(o) || typeof o === 'string') {
          if (!Number.isInteger(k)) throw new RScriptError('List index must be a whole number', e.line);
          const i = k < 0 ? o.length + k : k; return i >= 0 && i < o.length ? o[i] : null;
        }
        if (o instanceof Map) return o.has(String(k)) ? o.get(String(k)) : null;
        throw new RScriptError(`Cannot index ${typeOf(o)}`, e.line);
      }
      case 'Call': {
        const f = this.eval(e.callee, scope);
        const args = e.args.map((a) => this.eval(a, scope));
        return this.call(f, args, e);
      }
      default: throw new RScriptError(`Unknown expression ${e.type}`, e.line);
    }
  }

  call(f, args, node) {
    if (f instanceof Native) {
      if (this.readOnly && !f.pure) throw new RScriptError(`"${f.name}" cannot be used in an interface binding`, node && node.line);
      try { const r = f.vm ? f.fn(this, ...args) : f.fn(...args); return r === undefined ? null : r; } catch (err) {
        if (err.rscript) throw err;
        throw new RScriptError(`${f.name}: ${err.message}`, node && node.line);
      }
    }
    if (f instanceof Fn) {
      if (this.readOnly) throw new RScriptError('Functions cannot be called from interface bindings', node && node.line);
      if (++this.depth > 180) throw new RScriptError('Too much recursion', node && node.line);
      const s = new Scope(f.scope);
      f.params.forEach((p, i) => s.vars.set(p, args[i] === undefined ? null : args[i]));
      try { this.execBlock(f.body, s); return null; } catch (err) { if (err instanceof ReturnSignal) return err.value; throw err; } finally { this.depth--; }
    }
    throw new RScriptError(`${typeOf(f)} is not a function`, node && node.line);
  }

  binary(op, a, b, node) {
    switch (op) {
      case '+':
        if (typeof a === 'number' && typeof b === 'number') return a + b;
        if (typeof a === 'string' || typeof b === 'string') return toDisplay(a) + toDisplay(b);
        if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
        break;
      case '-': case '*': case '/': case '%':
        if (typeof a === 'number' && typeof b === 'number') {
          if ((op === '/' || op === '%') && b === 0) throw new RScriptError('Division by zero', node.line);
          return op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : a % b;
        }
        if (op === '*' && typeof a === 'string' && Number.isInteger(b)) return a.repeat(Math.max(0, Math.min(b, 10000)));
        break;
      case '==': return equals(a, b);
      case '!=': return !equals(a, b);
      case '<': case '>': case '<=': case '>=':
        if ((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')) {
          return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
        }
        break;
      default: break;
    }
    throw new RScriptError(`Cannot apply "${op}" to ${typeOf(a)} and ${typeOf(b)}`, node && node.line);
  }
}

function wrapNative(name, v) {
  if (v instanceof Native) return v;
  if (typeof v === 'function') return new Native(name, (...a) => fromJS(v(...a.map(toJS))));
  if (v && typeof v === 'object') {
    const m = new Map();
    for (const [k, x] of Object.entries(v)) m.set(k, wrapNative(`${name}.${k}`, x));
    return m;
  }
  return fromJS(v);
}

function builtins() {
  const P = (name, fn) => new Native(name, fn, { pure: true });
  const num = (x, name) => { if (typeof x !== 'number') throw new Error(`${name} expects a number`); return x; };
  const list = (x, name) => { if (!Array.isArray(x)) throw new Error(`${name} expects a list`); return x; };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    len: P('len', (x) => (Array.isArray(x) || typeof x === 'string' ? x.length : x instanceof Map ? x.size : 0)),
    str: P('str', (x) => toDisplay(x)),
    num: P('num', (x) => { const n = Number(x); return Number.isFinite(n) ? n : null; }),
    int: P('int', (x) => Math.trunc(Number(x)) || 0),
    type: P('type', (x) => typeOf(x)),
    round: P('round', (x, d = 0) => { const f = 10 ** d; return Math.round(num(x, 'round') * f) / f; }),
    floor: P('floor', (x) => Math.floor(num(x, 'floor'))),
    ceil: P('ceil', (x) => Math.ceil(num(x, 'ceil'))),
    abs: P('abs', (x) => Math.abs(num(x, 'abs'))),
    min: P('min', (...a) => Math.min(...(Array.isArray(a[0]) ? a[0] : a))),
    max: P('max', (...a) => Math.max(...(Array.isArray(a[0]) ? a[0] : a))),
    clamp: P('clamp', (x, lo, hi) => Math.min(hi, Math.max(lo, x))),
    random: new Native('random', (lo = 0, hi = 1) => lo + Math.floor(Math.random() * (hi - lo + 1))),
    range: P('range', (a, b) => { const [s, e] = b === undefined || typeof b !== 'number' ? [0, a] : [a, b]; const out = []; for (let i = s; i < e && out.length < 100000; i++) out.push(i); return out; }),
    push: new Native('push', (l, v) => { list(l, 'push').push(v); return l; }),
    pop: new Native('pop', (l) => (list(l, 'pop').length ? l.pop() : null)),
    insert: new Native('insert', (l, i, v) => { list(l, 'insert').splice(i, 0, v); return l; }),
    remove_at: new Native('remove_at', (l, i) => (list(l, 'remove_at').splice(i, 1)[0] ?? null)),
    slice: P('slice', (l, a, b) => (typeof l === 'string' || Array.isArray(l) ? l.slice(a, typeof b === 'number' ? b : undefined) : null)),
    contains: P('contains', (c, v) => (typeof c === 'string' ? c.includes(toDisplay(v)) : Array.isArray(c) ? c.some((x) => equals(x, v)) : c instanceof Map ? c.has(String(v)) : false)),
    index_of: P('index_of', (c, v) => (typeof c === 'string' ? c.indexOf(toDisplay(v)) : Array.isArray(c) ? c.findIndex((x) => equals(x, v)) : -1)),
    keys: P('keys', (m) => (m instanceof Map ? [...m.keys()] : [])),
    values: P('values', (m) => (m instanceof Map ? [...m.values()] : [])),
    has: P('has', (m, k) => (m instanceof Map ? m.has(String(k)) : false)),
    delete: new Native('delete', (m, k) => (m instanceof Map ? m.delete(String(k)) : false)),
    join: P('join', (l, sep = ', ') => list(l, 'join').map(toDisplay).join(typeof sep === 'string' ? sep : ', ')),
    split: P('split', (s, sep) => String(s).split(sep)),
    upper: P('upper', (s) => String(s).toUpperCase()),
    lower: P('lower', (s) => String(s).toLowerCase()),
    trim: P('trim', (s) => String(s).trim()),
    replace: P('replace', (s, a, b) => String(s).split(String(a)).join(String(b))),
    starts_with: P('starts_with', (s, p) => String(s).startsWith(String(p))),
    pad_start: P('pad_start', (s, n, c = ' ') => toDisplay(s).padStart(n, c)),
    fixed: P('fixed', (x, d = 2) => num(x, 'fixed').toFixed(d)),
    format_number: P('format_number', (x, d = 0) => num(x, 'format_number').toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })),
    map: new Native('map', (vm, l, f) => list(l, 'map').map((x, i) => vm.call(f, [x, i])), { vm: true }),
    filter: new Native('filter', (vm, l, f) => list(l, 'filter').filter((x, i) => truthy(vm.call(f, [x, i]))), { vm: true }),
    reduce: new Native('reduce', (vm, l, f, init = null) => list(l, 'reduce').reduce((acc, x) => vm.call(f, [acc, x]), init), { vm: true }),
    sort: new Native('sort', (vm, l, f) => {
      const c = list(l, 'sort').slice();
      if (f instanceof Fn || f instanceof Native) return c.sort((a, b) => vm.call(f, [a, b]));
      return c.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }, { vm: true }),
    reverse: P('reverse', (l) => list(l, 'reverse').slice().reverse()),
    sum: P('sum', (l) => list(l, 'sum').reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)),
    now: new Native('now', () => Date.now()),
    time_hm: P('time_hm', (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }),
    duration: P('duration', (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return `${pad(m)}:${pad(s % 60)}`; }),
    date_label: P('date_label', (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })),
  };
}
