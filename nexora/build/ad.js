// Renders the Nexora short ad (1080x1920, 30 fps) from nexora/marketing/ad.html.
//   node nexora/build/ad.js
// Needs ffmpeg with libx264 on PATH (or FFMPEG=/path/to/ffmpeg) and the Inter font
// in build/.cache (downloaded on first run). Every frame is rendered on a virtual
// clock, so the video is perfectly smooth no matter how slow the machine is.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const FRAMES = path.join(CACHE, 'ad-frames');
const OUT = path.join(ROOT, 'marketing');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 30, DURATION = 26;

// Replaces time in a game iframe: rAF, timers and clocks only move when __advance(ms) is called.
const CLOCK = '<script>(function(){var now=0,q=[],T=[],id=0;' +
  'performance.now=function(){return now};Date.now=function(){return 1790000000000+now};' +
  'window.requestAnimationFrame=function(cb){q.push(cb);return q.length};window.cancelAnimationFrame=function(){};' +
  'window.setTimeout=function(f,ms){T.push({t:now+(ms||0),f:f,id:++id});return id};' +
  'window.setInterval=function(f,ms){T.push({t:now+ms,f:f,iv:ms,id:++id});return id};' +
  'window.clearTimeout=window.clearInterval=function(i){T=T.filter(function(x){return x.id!==i})};' +
  'window.__advance=function(ms){var end=now+ms;for(;;){T.sort(function(a,b){return a.t-b.t});if(!T.length||T[0].t>end)break;' +
  'var x=T.shift();now=x.t;try{typeof x.f==="function"&&x.f()}catch(e){}if(x.iv){x.t+=x.iv;T.push(x)}}' +
  'now=end;var c=q.splice(0);c.forEach(function(f){try{f(now)}catch(e){}})};})();</' + 'script>';

(async () => {
  const font = path.join(CACHE, 'InterVariable.ttf');
  if (!fs.existsSync(font)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync('curl', ['-sSL', '-o', path.join(CACHE, 'inter.zip'), 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip']);
    execFileSync('unzip', ['-o', '-j', path.join(CACHE, 'inter.zip'), 'InterVariable.ttf', '-d', CACHE]);
  }
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await pw.chromium.launch();

  // 1. games and audio from the real app
  const app = await browser.newPage();
  await app.goto('file://' + path.join(ROOT, 'index.html'));
  const assets = await app.evaluate(async () => {
    const L = NexoraLocal, RT = Nexora.RT;
    const mk = (p, dim, o) => { const cfg = L.config(p, Object.assign({ dim, sfx: true, allowOpenWorld: true, quests: true }, o || {})); cfg.demo = true; return L.buildHtml(cfg, RT); };
    const games = {
      platformer: mk('Ett plattformsspel i en lavavärld där man hoppar på drakar "Lavajakten"', '2d'),
      runner3d: mk('En 3D-löpare på en isväg "Frostrusningen"', '3d'),
      openworld: mk('Open world-äventyr i en skog med uppdrag "Skogsriket"', '2d'),
      shooter: mk('Rymdskjutare med neon-tema och bossar "Neonstormen"', '2d'),
      arena3d: mk('3D arena där man samlar kulor i rymden', '3d'),
    };
    const b64 = async blob => { const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); };
    const music = await L.music('snabb energi action trailer', 27);
    return { games, music: await b64(music.blob), power: await b64(await L.sfx('powerup', 7)), coin: await b64(await L.sfx('mynt', 3)), laser: await b64(await L.sfx('laser', 5)) };
  });
  await app.close();
  for (const k of ['music', 'power', 'coin', 'laser']) fs.writeFileSync(path.join(CACHE, 'ad-' + k + '.wav'), Buffer.from(assets[k], 'base64'));

  // 2. frames
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto('file://' + path.join(OUT, 'ad.html'));
  await page.evaluate(() => document.fonts.ready);
  const withClock = {};
  for (const [k, html] of Object.entries(assets.games)) withClock[k] = html.replace(/<head(\s[^>]*)?>/i, m => m + CLOCK);
  await page.evaluate(g => window.__setup(g), withClock);
  const n = FPS * DURATION;
  for (let i = 0; i < n; i++) {
    await page.evaluate(([t, dt]) => window.__adFrame(t, dt), [i / FPS, 1 / FPS]);
    await page.screenshot({ path: path.join(FRAMES, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
    if (i % 90 === 0) console.log('frame', i, '/', n);
  }
  await page.screenshot({ path: path.join(OUT, 'nexora-short-thumbnail.jpg'), type: 'jpeg', quality: 90 });
  await browser.close();

  // 3. encode: music + sound effects on the cuts
  const out = path.join(OUT, 'nexora-short-9x16.mp4');
  const sfx = [['power', 6.0], ['laser', 7.45], ['power', 13.5], ['coin', 19.25], ['coin', 19.55], ['coin', 19.85], ['laser', 22.4]];
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FRAMES, 'f%05d.jpg'), '-i', path.join(CACHE, 'ad-music.wav')];
  sfx.forEach(([k]) => args.push('-i', path.join(CACHE, 'ad-' + k + '.wav')));
  let filter = `[1:a]volume=0.85,afade=t=in:d=0.4,afade=t=out:st=${DURATION - 1.8}:d=1.8[m]`;
  const labels = ['[m]'];
  sfx.forEach(([, at], i) => { filter += `;[${i + 2}:a]adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},volume=0.7[s${i}]`; labels.push(`[s${i}]`); });
  filter += `;${labels.join('')}amix=inputs=${labels.length}:normalize=0,alimiter=limit=0.95[a]`;
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-t', String(DURATION),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out);
  execFileSync(FFMPEG, args, { stdio: 'inherit' });
  console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
