#!/usr/bin/env node
/* mkicon.js — rasterises web/assets/icon.svg into every icon format the five
   builds need: PNGs for Android mipmaps, an .ico for the Windows exe, and an
   .icns for the macOS bundle.

   Rasterising is done by the same headless Chromium the tests use, so the
   shipped icon is pixel-for-pixel what a browser draws.

   Usage: node build/mkicon.js */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'web', 'assets', 'icon.svg');
const OUT = path.join(ROOT, 'dist', 'icons');

const SIZES = [16, 20, 24, 32, 48, 64, 72, 96, 128, 144, 192, 256, 512, 1024];

/* ---- ICO: a directory of PNG-compressed images (Vista and later) ---- */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // 1 = icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  const blobs = [];

  entries.forEach((e, i) => {
    const b = i * 16;
    dir[b] = e.size >= 256 ? 0 : e.size;       // 0 means 256
    dir[b + 1] = e.size >= 256 ? 0 : e.size;
    dir[b + 2] = 0;                             // palette
    dir[b + 3] = 0;                             // reserved
    dir.writeUInt16LE(1, b + 4);                // colour planes
    dir.writeUInt16LE(32, b + 6);               // bits per pixel
    dir.writeUInt32LE(e.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += e.png.length;
    blobs.push(e.png);
  });

  return Buffer.concat([header, dir, ...blobs]);
}

/* ---- ICNS: 'icns' + length, then type/length/PNG chunks ---- */
function buildIcns(bySize) {
  const TYPES = [
    ['icp4', 16], ['icp5', 32], ['icp6', 64],
    ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
    ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
  ];
  const chunks = [];
  for (const [type, size] of TYPES) {
    const png = bySize[size];
    if (!png) continue;
    const head = Buffer.alloc(8);
    head.write(type, 0, 4, 'ascii');
    head.writeUInt32BE(png.length + 8, 4);
    chunks.push(head, png);
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 4, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const svg = fs.readFileSync(SVG, 'utf8');

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--enable-unsafe-swiftshader', '--force-color-profile=srgb']
  });

  const bySize = {};
  for (const size of SIZES) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1
    });
    await page.setContent(
      '<!doctype html><style>html,body{margin:0;padding:0;background:transparent}' +
      `svg{display:block;width:${size}px;height:${size}px}</style>` + svg,
      { waitUntil: 'load' });
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    await page.close();
    bySize[size] = png;
    fs.writeFileSync(path.join(OUT, `icon-${size}.png`), png);
  }
  await browser.close();

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  fs.writeFileSync(path.join(OUT, 'icon.ico'),
    buildIco(icoSizes.map(s => ({ size: s, png: bySize[s] }))));
  fs.writeFileSync(path.join(OUT, 'icon.icns'), buildIcns(bySize));

  const kb = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
  console.log('AI Judge — icons');
  console.log('  ' + SIZES.length + ' PNGs        ' + SIZES.join(', '));
  console.log('  icon.ico     ' + kb('icon.ico') + ' KB  (' + icoSizes.join(', ') + ')');
  console.log('  icon.icns    ' + kb('icon.icns') + ' KB');
  console.log('  → ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
