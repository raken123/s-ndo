#!/usr/bin/env node
/*
 * Model-name guard.
 *
 * RakenOS must never show a phone model name. This scan fails the build if
 *   1. a known Raken device model name appears in any project text file, or
 *   2. code reads hardware model identifiers that could end up in the UI
 *      (Android Build.MODEL/DEVICE/PRODUCT/BRAND/MANUFACTURER, or the web
 *      User-Agent Client Hints "model" value).
 *
 * The patterns are assembled from fragments so this file does not contain the
 * names it is looking for. The e2e suite additionally checks the rendered text
 * of every screen at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.RAKENOS_SCAN_ROOT ? path.resolve(process.env.RAKENOS_SCAN_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'platforms', 'plugins', '.git', 'dist', '.gradle', 'build', 'screenshots']);
const TEXT = /\.(js|mjs|cjs|json|html|css|md|xml|java|kt|txt|rscript|sh|yml|yaml)$/i;

const brand = ['R', 'a', 'k', 'e', 'n'].join('');
const series = String.fromCharCode(83); // the device series letter
const MODEL_PATTERNS = [
  new RegExp(`${brand}[\\s_-]*${series}\\s*\\d+(\\s*(Pro|Max|Plus|Lite|Mini))?`, 'i'), // brand + series + number
  new RegExp(`\\b${series}\\d+[\\s_-]*(Pro|Max|Plus|Lite|Mini)\\b`), // series number with a tier name
];
const CODE_PATTERNS = [
  /Build\.(MODEL|DEVICE|PRODUCT|BRAND|MANUFACTURER|HARDWARE)\b/,
  /getHighEntropyValues\s*\(\s*\[[^\]]*['"]model['"]/,
  /userAgentData\s*\.\s*model/,
];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name)); }
    else if (TEXT.test(e.name)) yield path.join(dir, e.name);
  }
}

const hits = [];
let files = 0;
for (const f of walk(ROOT)) {
  files++;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const re of MODEL_PATTERNS) if (re.test(line)) hits.push({ f, line: i + 1, kind: 'model name', text: line.trim().slice(0, 120) });
    if (!f.endsWith('scan-model-names.mjs')) for (const re of CODE_PATTERNS) if (re.test(line)) hits.push({ f, line: i + 1, kind: 'model identifier API', text: line.trim().slice(0, 120) });
  });
}

if (hits.length) {
  console.error(`✗ Model-name guard: ${hits.length} finding(s)`);
  for (const h of hits) console.error(`  ${path.relative(ROOT, h.f)}:${h.line} [${h.kind}] ${h.text}`);
  process.exit(1);
}
console.log(`✓ Model-name guard: no device model names or model identifier APIs in ${files} files`);
