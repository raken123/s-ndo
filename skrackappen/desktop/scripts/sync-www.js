// Kopierar spelet (../www) in i Electron-appen innan den byggs.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', '..', 'www');
const dst = path.resolve(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Kopierade', src, '->', dst);
