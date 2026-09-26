import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = new URL('../../tools/scan-model-names.mjs', import.meta.url).pathname;
const run = (root) => spawnSync(process.execPath, [tool], { env: { ...process.env, ...(root ? { RAKENOS_SCAN_ROOT: root } : {}) }, encoding: 'utf8' });

test('the RakenOS project contains no device model names', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
});

test('the guard catches a planted model name and model APIs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rakenos-guard-'));
  const name = ['Ra', 'ken', ' S', '1 P', 'ro'].join(''); // assembled so this file stays clean
  fs.writeFileSync(path.join(dir, 'about.js'), `export const label = '${name}';\n`);
  fs.writeFileSync(path.join(dir, 'Info.java'), 'String m = android.os.Build.' + 'MODEL;\n');
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /about\.js:1 \[model name\]/);
  assert.match(r.stderr, /Info\.java:1 \[model identifier API\]/);
  fs.rmSync(dir, { recursive: true, force: true });
});
