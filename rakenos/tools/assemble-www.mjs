#!/usr/bin/env node
/*
 * Assembles app/www/lib from the shared RakenOS modules, so the single
 * RakenOS app (Cordova) and the browser preview use exactly the same code:
 *   design-system → lib/design-system     update-system → lib/update-system
 *   ras-runtime   → lib/ras-runtime       store (catalog + packages) → lib/store
 *   data          → lib/data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'app', 'www', 'lib');
const copy = (from, to, filter = () => true) => {
  const src = path.join(ROOT, from); const dst = path.join(LIB, to);
  fs.cpSync(src, dst, { recursive: true, filter: (p) => !p.endsWith('package.json') && !/README\.md$/.test(p) && !p.includes('sample-apps') && !p.endsWith('store-metadata.json') && filter(p) });
};
fs.rmSync(LIB, { recursive: true, force: true });
fs.mkdirSync(LIB, { recursive: true });
copy('design-system', 'design-system');
copy('update-system', 'update-system');
copy('ras-runtime', 'ras-runtime');
copy('store', 'store');
copy('data', 'data');
let files = 0; let bytes = 0;
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; } } };
walk(LIB);
console.log(`Assembled app/www/lib: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
