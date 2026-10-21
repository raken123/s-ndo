// Renderar filmens bilder utifrån build/timeline.json.
//
//   node render.mjs --from 0 --to 120 --out del.mp4   video (utan ljud) för ett tidsintervall
//   node render.mjs --shots hav@50%,koket@12 --out dir  enstaka stillbilder (PNG) för kontroll
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { W, H, canvas, clamp, smooth, vignette } from './lib.mjs';
import * as A from './scenes1.mjs';
import * as B from './scenes2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FPS = 24;
const XFADE = 1.2;

const SCENES = {
  titel: A.titel, hav: A.hav, hamn: A.hamn, rummet: A.rummet, festival: A.festival,
  parken: A.parken, dalen: A.dalen, vanner: A.vanner, vaktare: A.vaktare,
  gong: B.gong, spangen: B.spangen, salen: B.salen, kansla: B.kansla, ensam: B.ensam,
  haji: B.haji, koket: B.koket, radet: B.radet, koket2: B.koket2, redo: B.redo,
  vida: B.vida, station: B.station, ljussten: B.ljussten, taget: B.taget, resan: B.resan, slut: B.slut,
};

const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json'), 'utf8'));
const scenes = tl.scenes;
for (const s of scenes) if (!SCENES[s.id]) throw new Error(`saknar scen: ${s.id}`);
for (const s of scenes) s.cues = tl.cues.filter(c => c.start >= s.start && c.start < s.end);

const main = canvas(W, H), mctx = main.getContext('2d');
const prev = canvas(W, H), pctx = prev.getContext('2d');

function drawScene(ctx, s, T) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  SCENES[s.id](ctx, T - s.start, s, T);
  ctx.restore();
}

export function frame(T) {
  const i = Math.max(0, scenes.findIndex(s => T >= s.start && T < s.end));
  const s = scenes[i] ?? scenes[scenes.length - 1];
  drawScene(mctx, s, T);
  const into = T - s.start;
  if (i > 0 && into < XFADE) {
    drawScene(pctx, scenes[i - 1], T);
    mctx.save();
    mctx.globalAlpha = 1 - smooth(into / XFADE);
    mctx.drawImage(prev, 0, 0);
    mctx.restore();
  }
  vignette(mctx, 0.42);
  const fade = Math.min(clamp(T / 1.5), clamp((tl.duration - T) / 2.5));
  if (fade < 1) {
    mctx.fillStyle = `rgba(0,0,0,${1 - smooth(fade)})`;
    mctx.fillRect(0, 0, W, H);
  }
  return main;
}

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));

if (args.shots) {
  fs.mkdirSync(args.out, { recursive: true });
  for (const shot of args.shots.split(',')) {
    const [id, at] = shot.split('@');
    const s = scenes.find(x => x.id === id);
    const T = s.start + (at.endsWith('%') ? (s.end - s.start) * parseFloat(at) / 100 : parseFloat(at));
    const t0 = Date.now();
    frame(T);
    const name = `${id}_${at.replace('%', 'p')}.png`;
    fs.writeFileSync(path.join(args.out, name), main.encodeSync('png'));
    console.log(name, `${Date.now() - t0} ms`);
  }
} else {
  const from = parseFloat(args.from ?? 0), to = parseFloat(args.to ?? tl.duration);
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
  const crf = args.crf ?? '20';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', args.preset ?? 'medium', '-crf', crf, '-tune', 'animation', '-pix_fmt', 'yuv420p', '-g', String(FPS * 4), args.out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    frame(f / FPS);
    if (!ff.stdin.write(main.data())) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 240 === 0) console.log(`${args.out}: ${((f - f0) / (f1 - f0) * 100).toFixed(0)}%  (${((Date.now() - t0) / Math.max(1, f - f0)).toFixed(0)} ms/bild)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`${args.out}: klart på ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
