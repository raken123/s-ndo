#!/usr/bin/env node
/*
 * Raken Developer Studio — command-line packaging tool for RAS apps.
 * Publishing happens here, never from Raken Store.
 *
 *   node tools/ras-studio.mjs keygen <name>              create a developer signing key
 *   node tools/ras-studio.mjs pack <src-dir> <out.ras>   validate, sign and package an app
 *   node tools/ras-studio.mjs validate <file.ras>        open and verify a package
 *   node tools/ras-studio.mjs build-samples              package store/sample-apps → store/packages + catalog
 *   node tools/ras-studio.mjs publish <file.ras> [url]   upload to a Store backend (mock-backend)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from '../ras-runtime/zip.js';
import { validateManifest, canonicalSigningPayload, openRasPackage, sha256, bytesToB64, SIGNATURE_PATH } from '../ras-runtime/ras-package.js';
import { parse as parseRScript } from '../ras-runtime/rscript.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = path.join(ROOT, 'tools', 'keys');
const TRUSTED = path.join(ROOT, 'ras-runtime', 'trusted-keys.json');
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base)); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

async function keyIdFor(jwk) { return (await sha256(te.encode(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })))).slice(0, 16); }

async function keygen(name, publisher) {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('jwk', kp.privateKey);
  const pub = await subtle.exportKey('jwk', kp.publicKey);
  const keyId = await keyIdFor(pub);
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(path.join(KEYS_DIR, `${name}.private.jwk.json`), JSON.stringify({ keyId, publisher, jwk: priv }, null, 2) + '\n');
  const trusted = fs.existsSync(TRUSTED) ? JSON.parse(fs.readFileSync(TRUSTED, 'utf8')) : {};
  trusted[keyId] = { publisher, jwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
  fs.writeFileSync(TRUSTED, JSON.stringify(trusted, null, 2) + '\n');
  console.log(`Created key ${keyId} for ${publisher}`);
  return keyId;
}

function lint(manifest, files, srcDir) {
  const errors = validateManifest(manifest);
  const script = fs.readFileSync(path.join(srcDir, manifest.entry), 'utf8');
  try { parseRScript(script); } catch (e) { errors.push(`${manifest.entry}: ${e.message}`); }
  let design;
  try { design = JSON.parse(fs.readFileSync(path.join(srcDir, manifest.design), 'utf8')); } catch (e) { errors.push(`${manifest.design}: ${e.message}`); }
  // Accessibility: every icon-only control needs a label.
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'icon-button' && !n.label) errors.push(`${manifest.design}: icon-button "${n.icon}" needs a label for screen readers.`);
    for (const k of ['children', 'else']) if (Array.isArray(n[k])) n[k].forEach(visit);
    if (n.template) visit(n.template);
  };
  visit(design);
  for (const f of files) if (!/^[A-Za-z0-9._/-]+$/.test(f)) errors.push(`Unsupported file name: ${f}`);
  return errors;
}

async function pack(srcDir, outFile, keyFile) {
  const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
  const names = walk(srcDir).filter((f) => !f.startsWith('META-INF/') && !f.startsWith('.'));
  const errors = lint(manifest, names, srcDir);
  if (errors.length) { console.error(`✗ ${manifest.id || srcDir}:\n  - ${errors.join('\n  - ')}`); process.exitCode = 1; return null; }
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  const order = ['manifest.json', ...names.filter((n) => n !== 'manifest.json')];
  const entries = order.map((n) => [n, new Uint8Array(fs.readFileSync(path.join(srcDir, n)))]);
  const digests = {};
  for (const [n, d] of entries) digests[n] = await sha256(d);
  const sig = { format: 1, algorithm: 'ECDSA-P256-SHA256', keyId: key.keyId, publisher: key.publisher, packageId: manifest.id, version: manifest.version, digests };
  const privKey = await subtle.importKey('jwk', key.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, te.encode(canonicalSigningPayload(sig))));
  sig.signature = bytesToB64(signature);
  entries.push([SIGNATURE_PATH, te.encode(JSON.stringify(sig, null, 2))]);
  const zip = writeZip(entries);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zip);
  console.log(`✓ ${manifest.id} ${manifest.version} → ${path.relative(process.cwd(), outFile)} (${zip.length} bytes)`);
  return { manifest, bytes: zip };
}

async function validate(file) {
  const trusted = JSON.parse(fs.readFileSync(TRUSTED, 'utf8'));
  const pkg = await openRasPackage(new Uint8Array(fs.readFileSync(file)), { trustedKeys: trusted });
  console.log(`✓ ${pkg.manifest.id} ${pkg.manifest.version} — signed by ${pkg.signature.publisher} (${pkg.signature.keyId})`);
  return pkg;
}

async function buildSamples() {
  const samplesDir = path.join(ROOT, 'store', 'sample-apps');
  const outDir = path.join(ROOT, 'store', 'packages');
  const keyFile = path.join(KEYS_DIR, 'raken-samples.private.jwk.json');
  if (!fs.existsSync(keyFile)) await keygen('raken-samples', 'Raken Labs');
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'store', 'store-metadata.json'), 'utf8'));
  fs.rmSync(outDir, { recursive: true, force: true });
  const apps = [];
  for (const dir of fs.readdirSync(samplesDir).sort()) {
    const src = path.join(samplesDir, dir);
    if (!fs.statSync(src).isDirectory()) continue;
    const m = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
    const file = `packages/${m.id}-${m.version}.ras`;
    const res = await pack(src, path.join(ROOT, 'store', file), keyFile);
    if (!res) continue;
    await validate(path.join(ROOT, 'store', file));
    const extra = meta.apps[m.id] || {};
    apps.push({
      id: m.id, name: m.name, version: m.version, versionCode: m.versionCode,
      developer: m.store.developer, category: m.store.category, summary: m.store.summary,
      description: m.store.description, releaseNotes: m.store.releaseNotes || '',
      minRakenOS: m.minRakenOS, rasApiLevel: m.rasApiLevel,
      permissions: m.permissions, capabilities: m.capabilities || { required: [], optional: [] },
      icon: m.icon, package: file, sizeBytes: res.bytes.length, sha256: await sha256(res.bytes),
      rating: extra.rating || 4.5, ratingCount: extra.ratingCount || 100, ageRating: extra.ageRating || '4+',
      verified: true, updated: extra.updated || 'March 2',
    });
  }
  // Factory image: older versions preinstalled on first setup, so Store updates can be exercised.
  const preinstalled = [];
  for (const pre of meta.preinstalled || []) {
    const srcDir = fs.readdirSync(samplesDir).map((d) => path.join(samplesDir, d)).find((d) => fs.existsSync(path.join(d, 'manifest.json')) && JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')).id === pre.id);
    if (!srcDir) continue;
    const tmp = fs.mkdtempSync(path.join(ROOT, '.studio-'));
    try {
      fs.cpSync(srcDir, tmp, { recursive: true });
      const m = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
      Object.assign(m, { version: pre.version, versionCode: pre.versionCode });
      m.store.releaseNotes = pre.releaseNotes || m.store.releaseNotes;
      fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m, null, 2));
      const file = `packages/factory/${m.id}-${m.version}.ras`;
      const res = await pack(tmp, path.join(ROOT, 'store', file), keyFile);
      if (res) preinstalled.push({ id: m.id, version: m.version, package: file, sha256: await sha256(res.bytes) });
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  const catalog = { schema: 'raken.store.catalog/1', generatedBy: 'Raken Developer Studio', categories: meta.categories, featured: meta.featured, collections: meta.collections, preinstalled, apps };
  fs.writeFileSync(path.join(ROOT, 'store', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Catalog: ${apps.length} apps → store/catalog.json`);
}

async function publish(file, url = 'http://localhost:8787') {
  const bytes = fs.readFileSync(file);
  const res = await fetch(`${url}/api/studio/publish`, { method: 'POST', headers: { 'Content-Type': 'application/vnd.raken.ras' }, body: bytes });
  console.log(res.status, await res.text());
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  keygen: () => keygen(args[0] || 'developer', args[1] || 'Independent Developer'),
  pack: () => pack(args[0], args[1], args[2] || path.join(KEYS_DIR, 'raken-samples.private.jwk.json')),
  validate: () => validate(args[0]),
  'build-samples': buildSamples,
  publish: () => publish(args[0], args[1]),
}[cmd];
if (!run) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 11).join('\n')); process.exit(cmd ? 1 : 0); }
run().catch((e) => { console.error('✗', e.message, e.details || ''); process.exit(1); });
