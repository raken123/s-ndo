import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openRasPackage, checkCompatibility, validateManifest, RasError } from '../../ras-runtime/ras-package.js';
import { readZip, writeZip } from '../../ras-runtime/zip.js';

const trustedKeys = JSON.parse(fs.readFileSync(new URL('../../ras-runtime/trusted-keys.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../../store/catalog.json', import.meta.url), 'utf8'));
const pkg = (id) => new Uint8Array(fs.readFileSync(new URL(`../../store/${catalog.apps.find((a) => a.id === id).package}`, import.meta.url)));
const ctx = (over = {}) => ({ rakenosVersion: '1.0.0', rasApiLevel: 1, capabilities: {}, ...over });

test('every catalog package opens, validates and verifies', async () => {
  assert.ok(catalog.apps.length >= 10);
  for (const a of catalog.apps) {
    const p = await openRasPackage(pkg(a.id), { trustedKeys });
    assert.equal(p.manifest.id, a.id);
    assert.equal(p.signature.trusted, true);
    assert.equal(p.signature.publisher, 'Raken Labs');
    assert.ok(p.script.length > 0 && p.design.type === 'screen');
  }
});

test('a modified file is detected as tampered', async () => {
  const files = await readZip(pkg('com.raken.samples.tally'));
  const entries = [...files].map(([n, d]) => [n, n === 'main.rscript' ? new TextEncoder().encode(new TextDecoder().decode(d) + '\nnotify("x", "y")') : d]);
  await assert.rejects(openRasPackage(writeZip(entries), { trustedKeys }), (e) => e instanceof RasError && e.code === 'tampered');
});

test('unknown developer keys are rejected unless explicitly allowed', async () => {
  await assert.rejects(openRasPackage(pkg('com.raken.samples.units'), { trustedKeys: {} }), (e) => e.code === 'untrusted');
  const p = await openRasPackage(pkg('com.raken.samples.units'), { trustedKeys: {}, allowUntrusted: true });
  assert.equal(p.signature.trusted, false);
});

test('unsigned packages and bad manifests are rejected', async () => {
  const files = await readZip(pkg('com.raken.samples.dice'));
  const unsigned = writeZip([...files].filter(([n]) => !n.startsWith('META-INF/')));
  await assert.rejects(openRasPackage(unsigned, { trustedKeys }), (e) => e.code === 'unsigned');
  assert.ok(validateManifest({ format: 1, id: 'bad id', name: '' }).length > 3);
});

test('compatibility follows RakenOS version, API level and hardware capabilities', () => {
  const habits = catalog.apps.find((a) => a.id === 'com.raken.samples.habits');
  assert.equal(checkCompatibility(habits, ctx()).compatible, false);
  assert.equal(checkCompatibility(habits, ctx({ rakenosVersion: '12.0.0', rasApiLevel: 12 })).compatible, true);
  const tag = catalog.apps.find((a) => a.id === 'com.raken.samples.tagreader');
  assert.deepEqual(checkCompatibility(tag, ctx()).problems[0].missing, ['nfc']);
  assert.equal(checkCompatibility(tag, ctx({ capabilities: { nfc: true } })).compatible, true);
  const stock = catalog.apps.find((a) => a.id === 'com.raken.samples.stockcount');
  assert.equal(checkCompatibility(stock, ctx({ capabilities: { scanner2d: true } })).compatible, true);
});

test('zip reader rejects path traversal', async () => {
  const z = writeZip([['../evil.txt', new Uint8Array([1])]]);
  await assert.rejects(readZip(z), /unsafe path/);
});
