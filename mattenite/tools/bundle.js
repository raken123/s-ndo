#!/usr/bin/env node
/* bundle.js — bakar ihop www/ till en enda fristående HTML-fil.
 *
 *   node tools/bundle.js
 *
 * Skapar:
 *   dist/mattenite.html           komplett sida (öppna direkt i webbläsaren)
 *   dist/mattenite-embed.html     samma spel utan <html>/<head>/<body>, för inbäddning
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const DIST = path.join(ROOT, 'dist');

const read = (p) => fs.readFileSync(path.join(WWW, p), 'utf8');

let html = read('index.html');

// CSS in
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  '<style>\n' + read(href) + '\n</style>'
);

// JS in
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  '<script>\n' + read(src) + '\n</script>'
);

// CSP-taggen gäller Cordova-appen; i en enfilsversion blockerar den inline-koden.
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/g, '');

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'mattenite.html'), html);

// Fragmentversion: allt som ligger mellan <head> och </body>, utan sidoskelett.
const headInner = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const bodyInner = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
const keepFromHead = (headInner.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');

const embed =
  '<title>Mattenite — svara, kasta bomben, överlev</title>\n' +
  keepFromHead + '\n' +
  '<script>document.documentElement.dataset.mattenite = "1";</script>\n' +
  bodyInner;

fs.writeFileSync(path.join(DIST, 'mattenite-embed.html'), embed);

const kb = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' kB';
console.log('dist/mattenite.html       ' + kb('mattenite.html'));
console.log('dist/mattenite-embed.html ' + kb('mattenite-embed.html'));
