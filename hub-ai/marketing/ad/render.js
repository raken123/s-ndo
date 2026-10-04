// Renders ad.html frame by frame and encodes build/hub-ai-ad.mp4 with ffmpeg.
//
//   python3 make_audio.py        # build/audio.wav + build/timeline.json
//   node screens.js              # build/screens/*.png (needs the app + a cloud running)
//   node render.js [--still=9.2,15.6]   # all frames, or just a few stills for checking
//   node render.js --page=school.html --build=build/school   # ad 2
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const arg = (k, d) => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').slice(k.length + 3) || d;
const dir = __dirname, page = arg('page', 'ad.html'), build = path.join(dir, arg('build', 'build')), frames = path.join(build, 'frames');
const still = arg('still', '');

(async () => {
  const timeline = JSON.parse(fs.readFileSync(path.join(build, 'timeline.json'), 'utf8'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const LENGTH = timeline.length;
  await p.goto('file://' + path.join(dir, page));
  await p.evaluate(tl => init(tl), timeline);
  await p.evaluate(() => Promise.all(Array.from(document.images || []).map(i => i.decode && i.decode().catch(() => {}))));
  await p.waitForTimeout(500);
  if (still) {
    for (const t of still.split(',').map(Number)) {
      await p.evaluate(x => render(x), t);
      await p.screenshot({ path: path.join(build, 'still-' + t + '.png') });
    }
    await b.close();
    return;
  }
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const n = FPS * LENGTH;
  for (let i = 0; i < n; i++) {
    await p.evaluate(x => render(x), i / FPS);
    await p.screenshot({ path: path.join(frames, 'f' + String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 150 === 0) console.log('frame', i, '/', n);
  }
  await b.close();
  const out = path.join(build, 'hub-ai-ad.mp4');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.jpg'),
    '-i', path.join(build, 'audio.wav'), '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('wrote', out);
})();
