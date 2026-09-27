#!/usr/bin/env node
/*
 * Renders the RakenOS spot frame by frame and encodes it.
 *   node marketing/ad/render.mjs                 → marketing/ad/rakenos-ad.mp4
 *   node marketing/ad/render.mjs --preview 1,5,9 → PNG stills of those seconds
 * Needs Playwright (Chromium) and an ffmpeg binary (FFMPEG env var or on PATH).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const FPS = 30; const DURATION = 30;
const args = process.argv.slice(2);
const previewIdx = args.indexOf('--preview');
const muxOnly = args.includes('--mux-only'); // reuse output/video.mp4, rebuild only the soundtrack
const OUTDIR = path.join(HERE, 'output');
fs.mkdirSync(OUTDIR, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/marketing/ad/ad.html`);
await page.evaluate(() => window.__ready);
const stage = page.locator('#stage');

if (previewIdx >= 0) {
  for (const s of args[previewIdx + 1].split(',').map(Number)) {
    await page.evaluate((t) => window.renderAt(t), s);
    await stage.screenshot({ path: path.join(OUTDIR, `still-${String(s).padStart(5, '0')}.png`) });
  }
} else {
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const video = path.join(OUTDIR, 'video.mp4');
  if (!muxOnly) {
  const enc = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', video], { stdio: ['pipe', 'ignore', 'inherit'] });
  const total = FPS * DURATION;
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.renderAt(t), f / FPS);
    const buf = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    if (f % 90 === 0) process.stdout.write(`frame ${f}/${total}\n`);
  }
  enc.stdin.end();
  await new Promise((r) => enc.on('close', r));
  }
  // Soundtrack: a simple generated pulse (120 bpm) with a pad; replace with licensed music for release.
  const audio = path.join(OUTDIR, 'music.m4a');
  const expr = [
    'sin(2*PI*t*(45+110*exp(-28*mod(t,0.5))))*exp(-7*mod(t,0.5))*0.55',
    '(random(0)*2-1)*exp(-70*mod(t+0.25,0.5))*0.10',
    '(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t))*0.035*(0.6+0.4*sin(2*PI*0.25*t))',
    'sin(2*PI*t*(110+6*sin(2*PI*0.5*t)))*0.08*exp(-3*mod(t,1))',
  ].join('+').replace(/,/g, '\\,'); // commas must be escaped inside a filter argument
  execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', `aevalsrc=${expr}:s=48000:d=${DURATION}`, '-af', `afade=t=in:d=0.4,afade=t=out:st=${DURATION - 1.8}:d=1.8,alimiter=limit=0.9`, '-c:a', 'aac', '-b:a', '192k', audio], { stdio: 'ignore' });
  const out = path.join(HERE, 'rakenos-ad.mp4');
  execFileSync(ffmpeg, ['-y', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], { stdio: 'ignore' });
  console.log(`✓ ${path.relative(process.cwd(), out)}`);
}
await browser.close(); server.close();
