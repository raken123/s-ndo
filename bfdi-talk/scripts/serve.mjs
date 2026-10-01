// Tiny static server for trying the app in a desktop browser: npm run serve -> http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WWW = join(dirname(fileURLToPath(import.meta.url)), '..', 'www');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 5173;

createServer(async (req, res) => {
  const path = normalize(join(WWW, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const file = path.endsWith('/') || path === WWW ? join(path, 'index.html') : path;
  if (!file.startsWith(WWW)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`BFDI Talk running at http://localhost:${port}`));
