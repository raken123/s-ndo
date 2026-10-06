// Copies the web app (one-ai/web) into www/ so the installers ship it.
// Run before `electron .` or electron-builder (the npm scripts do it).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'web');
const dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Copied ' + path.relative(process.cwd(), src) + ' -> ' + path.relative(process.cwd(), dst));
