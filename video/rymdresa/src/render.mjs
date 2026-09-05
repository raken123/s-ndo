// Renders rymdresa.html frame by frame in headless Chromium and encodes it with ffmpeg.
//
//   node src/render.mjs --out rymdresa.mp4 [--w 1920 --h 1080 --fps 24] [--start 0 --end 176]
//   node src/render.mjs --stills "1,15,26" --dir stills/      (PNG stills for review)
//
// Playwright is resolved from PLAYWRIGHT_PATH (default: the global install), ffmpeg from FFMPEG (default: ffmpeg on PATH).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'] : null).filter(Boolean));
const W = +(args.w || 1920), H = +(args.h || 1080), FPS = +(args.fps || 24);
const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = 'file://' + path.resolve(here, '..', 'rymdresa.html') + '?render=1';
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs');

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 1; });
const t0 = Date.now();
await page.goto(page_url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const T_END = await page.evaluate(() => window.__T_END);
console.log(`page ready in ${((Date.now() - t0) / 1000).toFixed(1)}s, film length ${T_END}s`);

if (args.stills) {
  const dir = args.dir || 'stills'; fs.mkdirSync(dir, { recursive: true });
  for (const s of args.stills.split(',')) { const t = parseFloat(s); await page.evaluate(t => window.__renderFrame(t), t); await page.screenshot({ path: path.join(dir, `t${String(t).padStart(6, '0')}.png`), type: 'png' }); console.log('still', t); }
  await browser.close(); process.exit(0);
}

const out = args.out || 'rymdresa.mp4';
const start = +(args.start || 0), end = Math.min(T_END, +(args.end || T_END));
const nFrames = Math.round((end - start) * FPS);
const tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'rymdresa-'));
const wavPath = path.join(tmpDir, 'music.wav');
console.log('rendering soundtrack…');
const b64 = await page.evaluate(() => window.__renderAudio());
fs.writeFileSync(wavPath, Buffer.from(b64, 'base64'));
console.log(`soundtrack ${(fs.statSync(wavPath).size / 1e6).toFixed(1)} MB`);

const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
  '-ss', String(start), '-i', wavPath,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
const write = (buf) => new Promise(res => ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res));

const t1 = Date.now();
for (let f = 0; f < nFrames; f++) {
  const t = start + f / FPS;
  await page.evaluate(t => window.__renderFrame(t), t);
  await write(await page.screenshot({ type: 'png' }));
  if (f % (FPS * 10) === 0) { const el = (Date.now() - t1) / 1000, rate = (f + 1) / el; console.log(`frame ${f}/${nFrames}  t=${t.toFixed(1)}s  ${rate.toFixed(1)} fps  eta ${((nFrames - f) / rate / 60).toFixed(1)} min`); }
}
ff.stdin.end();
await done;
await browser.close();
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`wrote ${out} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
