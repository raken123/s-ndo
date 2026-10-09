// Shared helpers for the packaging scripts.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PKG = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(PKG, '..');
export const WORK = path.join(PKG, 'work');
export const ICONS = path.join(PKG, 'icons');
export const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
export const APP_ID = 'app.nezos.studio';

export const log = (...a) => console.log('›', ...a);

export function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { stdio: opts.quiet ? 'pipe' : 'inherit', ...opts });
  } catch (err) {
    const out = [err.stdout, err.stderr].filter(Boolean).map(String).join('\n')
      .split('\n').filter((l) => !l.startsWith('Picked up JAVA_TOOL_OPTIONS')).join('\n').trim();
    throw new Error(`${path.basename(cmd)} failed:\n${out || err.message}`);
  }
}

export function fresh(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  log('download', url);
  run('curl', ['-sSfL', '--retry', '3', '-o', `${dest}.part`, url]);
  fs.renameSync(`${dest}.part`, dest);
  return dest;
}

/**
 * The single-file app (standalone/build.mjs output). If NEZOS_OPENAI_KEY is
 * set, it is written into the file's key slot.
 */
export function appHtml() {
  const file = path.join(ROOT, 'dist/nezos.html');
  run('node', [path.join(ROOT, 'standalone/build.mjs'), file], { quiet: true });
  let html = fs.readFileSync(file, 'utf8');
  const key = process.env.NEZOS_OPENAI_KEY;
  if (key) {
    const slot = 'window.NEZOS_OPENAI_KEY = "";';
    if (!html.includes(slot)) throw new Error('key slot not found in nezos.html');
    html = html.replace(slot, `window.NEZOS_OPENAI_KEY = ${JSON.stringify(key)};`);
  }
  return html;
}

const png = (size) => fs.readFileSync(path.join(ICONS, `icon-${size}.png`));

/** Windows .ico with PNG-compressed entries (supported since Vista). */
export function makeIco() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const imgs = sizes.map(png);
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(s >= 256 ? 0 : s, e);
    head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(imgs[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += imgs[i].length;
  });
  return Buffer.concat([head, ...imgs]);
}

/** macOS .icns built from PNG entries. */
export function makeIcns() {
  const entries = [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]];
  const parts = entries.map(([type, s]) => {
    const data = png(s);
    const h = Buffer.alloc(8);
    h.write(type, 0, 'ascii');
    h.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([h, data]);
  });
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.write('icns', 0, 'ascii');
  h.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([h, body]);
}
