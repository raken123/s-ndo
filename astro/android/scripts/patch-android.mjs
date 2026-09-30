// Anpassar det genererade Android-projektet: kamerabehörighet, liggande läge,
// helskärm och att skärmen inte släcks.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', 'android', 'app', 'src', 'main');
const manifestPath = path.join(app, 'AndroidManifest.xml');
let m = readFileSync(manifestPath, 'utf8');

const perms = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.front" android:required="false" />',
];
for (const p of perms) {
  if (!m.includes(p)) m = m.replace('</manifest>', `    ${p}\n</manifest>`);
}
// Liggande läge och ingen omstart vid rotation
if (!m.includes('android:screenOrientation')) {
  m = m.replace(/<activity(\s)/, '<activity android:screenOrientation="sensorLandscape"$1');
}
writeFileSync(manifestPath, m);

// Ersätt MainActivity med en version som ger helskärm och håller skärmen tänd.
const javaRoot = path.join(app, 'java');
function find(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = find(p); if (r) return r; } else if (e.name === 'MainActivity.java') return p;
  }
  return null;
}
const target = find(javaRoot);
if (!target) throw new Error('MainActivity.java hittades inte');
const pkg = readFileSync(target, 'utf8').match(/package\s+([\w.]+);/)[1];
const tpl = readFileSync(path.join(here, '..', 'native', 'MainActivity.java'), 'utf8').replace('__PACKAGE__', pkg);
writeFileSync(target, tpl);
console.log('Android-projektet anpassat:', manifestPath, target);
