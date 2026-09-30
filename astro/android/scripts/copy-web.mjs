// Kopierar spelet (../web) till www/ som Capacitor paketerar in i APK:n.
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', '..', 'web');
const dst = path.join(here, '..', 'www');
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`Kopierade ${src} -> ${dst}`);
