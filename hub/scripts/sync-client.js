#!/usr/bin/env node
'use strict';
// Copies the web client (and, for desktop, the server) into the platform shells.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const targets = {
  desktopApp: path.join(root, 'desktop', 'app'),
  desktopServer: path.join(root, 'desktop', 'server'),
  android: path.join(root, 'android', 'app', 'src', 'main', 'assets', 'www'),
};
function copy(src, dst, skip = []) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (skip.includes(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copy(s, d, skip); else fs.copyFileSync(s, d);
  }
}
copy(path.join(root, 'client'), targets.desktopApp);
copy(path.join(root, 'server'), targets.desktopServer, ['data', 'test']);
copy(path.join(root, 'client'), targets.android);
console.log('synced client → desktop/app, android assets; server → desktop/server');
