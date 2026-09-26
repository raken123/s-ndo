// Bygger fristående HTML-filer (allt CSS/JS inbäddat) till jomni-blommor/dist/.
// Användning: node scripts/build-standalone.mjs https://jomniblommor.se
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const web = (f) => fs.readFileSync(path.join(root, 'web', f), 'utf8');
const api = (process.argv[2] || 'https://jomniblommor.se').replace(/\/$/, '');
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const css = web('styles.css');
const icon = `data:image/svg+xml,${encodeURIComponent(web('icon.svg').trim())}`;

function build(htmlFile, js) {
  let html = web(htmlFile);
  // Funktioner som ersättning, annars tolkas "$$" och "$&" i koden som specialmönster.
  html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}</style>`);
  html = html.replace(/href="icon\.svg"/g, () => `href="${icon}"`);
  html = html.replace('<meta charset="utf-8">', () => `<meta charset="utf-8">\n  <meta name="jomni-api" content="${api}">`);
  html = html.replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">\n${esc(js)}\n</script>`);
  return html;
}

const shopJs = web('bouquet.js').replace(/^export /m, '') + '\n'
  + web('app.js').replace(/^import .*\n/m, '');
const shop = build('index.html', shopJs).replace('href="admin.html"', 'href="jomni-admin.html"');
const admin = build('admin.html', web('admin.js')).replace('href="/"', 'href="jomni-blommor.html"');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'jomni-blommor.html'), shop);
fs.writeFileSync(path.join(root, 'dist', 'jomni-admin.html'), admin);
console.log(`dist/jomni-blommor.html och dist/jomni-admin.html → API ${api}`);
