#!/usr/bin/env node
/* Inlines the app into a single self-contained HTML file that can be opened
   from disk or hosted anywhere — same game as the APK, no Cordova.

   usage: node tools/build-web.js  ->  dist/blackgate-web.html
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('www/index.html');
const css = read('www/css/style.css');
const js = read('www/js/levels.js') + '\n' + read('www/js/game.js');

const body = html
  .replace(/[\s\S]*?<body>/, '')
  .replace(/<\/body>[\s\S]*/, '')
  .replace(/\s*<script src="cordova\.js"><\/script>/, '')
  .replace(/\s*<script src="js\/levels\.js"><\/script>/, '')
  .replace(/\s*<script src="js\/game\.js"><\/script>/, '')
  .trim();

const out = `<title>Escape from Blackgate</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
${css}
/* the page is embedded, so claim the whole frame */
html, body { margin: 0; padding: 0; height: 100%; background: #07090d; }
</style>
${body}
<script>
${js}
</script>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/blackgate-web.html'), out);
console.log('dist/blackgate-web.html', (out.length / 1024).toFixed(1) + ' kB');
