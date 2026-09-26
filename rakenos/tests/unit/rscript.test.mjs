import test from 'node:test';
import assert from 'node:assert/strict';
import { RScriptVM, parse } from '../../ras-runtime/rscript.js';

const vm = (src, natives = {}) => new RScriptVM(src, { natives }).init();

test('state, functions, closures and events', () => {
  const v = vm(`
    state count = 0
    let step = 2
    fn add(n) { count += n }
    fn make(k) { return fn (x) { return x * k } }
    on action "inc" { add(step) }
    on action "set" (n) { count = make(3)(n) }
  `);
  v.emit('action', 'inc'); v.emit('action', 'inc');
  assert.equal(v.getState().count, 4);
  v.emit('action', 'set', 5);
  assert.equal(v.getState().count, 15);
});

test('control flow, lists, maps and builtins', () => {
  const v = vm(`
    state out = []
    state m = { a: 1 }
    on start {
      for i in range(6) { if i % 2 == 0 { continue } push(out, i) }
      let n = 0
      while true { n += 1; if n > 3 { break } }
      m.b = n
      for k, val in m { push(out, k + "=" + str(val)) }
    }
  `);
  v.emit('start');
  assert.deepEqual(v.getState().out, [1, 3, 5, 'a=1', 'b=4']);
  assert.equal(v.evaluate('join(map_sum, ",")', { map_sum: [1, 2] }), '1,2');
  assert.equal(v.evaluate('len(out) > 3 and "many" or "few"'), 'many');
  assert.equal(v.evaluate('fixed(0.1 + 0.2, 2)'), '0.30');
});

test('sandbox: runaway loops stop, bindings are read-only, no host access', () => {
  const v = vm('state x = 0\nfn f() { return 1 }\non action "spin" { while true { x = x } }');
  assert.throws(() => v.emit('action', 'spin'), /too many steps/);
  assert.throws(() => v.evaluate('f()'), /cannot be called/);
  assert.throws(() => v.evaluate('globalThis'), /Unknown name/);
  assert.throws(() => v.evaluate('x.constructor'), /has no field/);
});

test('host APIs are only what the RAS host provides', () => {
  const log = [];
  const v = vm('on start { ui.toast("hi " + str(device.has("nfc"))) }', { ui: { toast: (m) => log.push(m) }, device: { has: (c) => c === 'nfc' } });
  v.emit('start');
  assert.deepEqual(log, ['hi true']);
});

test('syntax errors report line numbers', () => {
  assert.throws(() => parse('let a = 1\nlet b = (2 + \n'), /line/);
  assert.throws(() => parse('state x = "unterminated'), /Unterminated string/);
});
