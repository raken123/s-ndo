// Copies the app UI from the Android project so both builds ship the same
// files. Run before `electron .` or electron-builder (npm scripts do it).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'app', 'src', 'main', 'assets', 'www');
const dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Copied ' + path.relative(process.cwd(), src) + ' -> ' + path.relative(process.cwd(), dst));
