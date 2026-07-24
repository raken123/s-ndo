#!/usr/bin/env node
/* serve.js — liten statisk server för att testa spelet i webbläsaren.
 *
 *   node tools/serve.js  →  http://localhost:8080
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
const PORT = process.env.PORT || 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Mattenite på http://localhost:' + PORT));
