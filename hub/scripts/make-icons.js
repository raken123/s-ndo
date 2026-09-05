#!/usr/bin/env node
'use strict';
// Generates the desktop app icon (PNG) without any image library: a gradient tile with a gem.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function icon(size) {
  const r = size * 0.22;
  const inRound = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - r), cy = Math.min(Math.max(y, r), size - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  // gem: a diamond with a flat top
  const gem = (x, y) => {
    const u = (x - size / 2) / size, v = (y - size / 2) / size;
    if (v < -0.16 || v > 0.3) return 0;
    if (v < 0) return Math.abs(u) <= 0.26 + (v + 0.16) * 0.4 ? (Math.abs(u) < 0.09 ? 2 : 1) : 0;
    return Math.abs(u) <= 0.30 * (1 - v / 0.3) ? (Math.abs(u) < 0.09 * (1 - v / 0.3) ? 2 : 1) : 0;
  };
  return png(size, (x, y) => {
    if (!inRound(x + 0.5, y + 0.5)) return [0, 0, 0, 0];
    const t = (x + y) / (2 * size);
    let R = Math.round(109 + (76 - 109) * t), G = Math.round(92 + (194 - 92) * t), B = Math.round(255 + (255 - 255) * t);
    const g = gem(x, y);
    if (g === 1) { R = 255; G = 236; B = 170; }
    if (g === 2) { R = 255; G = 255; B = 255; }
    return [R, G, B, 255];
  });
}
const out = path.join(__dirname, '..', 'desktop', 'build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), icon(512));
console.log('wrote desktop/build/icon.png');
