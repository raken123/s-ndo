#!/usr/bin/env node
/*
 * Builds a web-embeddable copy of RakenOS (the same app/www code) into a folder:
 *   node tools/build-artifact.mjs <out-dir>
 * The page file contains only the body markup (the host supplies the document
 * head); Cordova's script tag and the device CSP meta tag are left out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'web'));
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'assemble-www.mjs')], { stdio: 'inherit' });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const www = path.join(ROOT, 'app', 'www');
for (const d of ['os', 'lib']) fs.cpSync(path.join(www, d), path.join(OUT, d), { recursive: true });

// Hosts that only serve web media types get each .ras package as base64 text; the
// catalog digests still refer to the decoded package bytes.
const storeDir = path.join(OUT, 'lib', 'store');
const catalogPath = path.join(storeDir, 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
for (const entry of [...catalog.apps, ...(catalog.preinstalled || [])]) {
  const src = path.join(storeDir, entry.package);
  if (fs.existsSync(src)) { fs.writeFileSync(`${src}.b64.txt`, fs.readFileSync(src).toString('base64')); fs.rmSync(src); }
  entry.package = `${entry.package}.b64.txt`;
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

const html = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
const links = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join('\n');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/\s*<script src="cordova\.js"[^>]*><\/script>/, '');
fs.writeFileSync(path.join(OUT, 'index.html'), `<title>RakenOS</title>\n<meta name="theme-color" content="#f3f4f6">\n${links}\n${body.trim()}\n`);

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p !== path.join(OUT, 'index.html')) files.push(path.relative(OUT, p).split(path.sep).join('/')); } };
walk(OUT);
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files, null, 2));
console.log(`Web build: ${files.length} supporting files → ${path.relative(process.cwd(), OUT)}`);
