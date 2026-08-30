/*  Renders reel.html to frames and encodes the MP4s.
 *  Deterministic: each frame is a seek(t) + screenshot, never wall-clock capture.
 *  Needs: playwright (chromium) and a full ffmpeg with libx264 on PATH.
 *  Usage: node render-reel.js [outDir]              */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS   = 30;
const SLIDE = 4.0;                                  // seconds per artboard
const OUT   = path.resolve(process.argv[2] || __dirname);
const FRAMES = process.env.FRAME_DIR || fs.mkdtempSync('/tmp/reel-');
const ONLY  = process.env.SAMPLE_FRAMES ? Number(process.env.SAMPLE_FRAMES) : 0;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

(async () => {
  const browser = await chromium.launch({ args:['--no-sandbox','--force-device-scale-factor=1',
                                                '--hide-scrollbars','--disable-lcd-text'] });
  const page = await browser.newPage({ viewport:{ width:1080, height:1920 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'reel.html'));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const total  = await page.evaluate(() => window.TOTAL);
  const nFrames = Math.round(total * FPS);
  const stage  = page.locator('#stage');

  if (ONLY){                                        // quick visual spot-check
    for (let i = 0; i < ONLY; i++){
      const t = (total - 0.2) * i / (ONLY - 1);
      await page.evaluate(t => window.seek(t), t);
      await page.waitForTimeout(40);
      await stage.screenshot({ path: `${OUT}/sample-${String(i).padStart(2,'0')}-t${t.toFixed(1)}.png` });
    }
    console.log(`${ONLY} sample frames → ${OUT}`);
    console.log('errors:', errs.join(' | ') || 'none');
    await browser.close();
    return;
  }

  console.log(`rendering ${nFrames} frames (${total}s @ ${FPS}fps) → ${FRAMES}`);
  for (let f = 0; f < nFrames; f++){
    await page.evaluate(t => window.seek(t), f / FPS);
    await stage.screenshot({ path: `${FRAMES}/f${String(f).padStart(5,'0')}.jpg`,
                             type:'jpeg', quality: 96 });
    if (f % 60 === 0) console.log(`  ${f}/${nFrames}`);
  }
  console.log('errors:', errs.join(' | ') || 'none');
  await browser.close();

  const enc = (args) => execFileSync(FFMPEG, args, { stdio:'inherit' });
  const master = path.join(OUT, 'raken-ai-reel.mp4');

  enc(['-y','-framerate',String(FPS),'-i',`${FRAMES}/f%05d.jpg`,
       '-c:v','libx264','-preset','slow','-crf','21',
       '-pix_fmt','yuv420p','-profile:v','high','-level','4.0',
       '-movflags','+faststart','-r',String(FPS), master]);

  // one standalone cut per artboard, each fading up from black
  const names = ['01-launch','02-water','03-compose','04-light','05-safety'];
  names.forEach((n, i) => {
    enc(['-y','-ss',String(i*SLIDE),'-t',String(SLIDE),'-i',master,
         '-vf','fade=t=in:st=0:d=0.35,fade=t=out:st=3.65:d=0.35',
         '-c:v','libx264','-preset','slow','-crf','21',
         '-pix_fmt','yuv420p','-movflags','+faststart',
         path.join(OUT, `raken-ai-ad-${n}.mp4`)]);
  });

  fs.rmSync(FRAMES, { recursive:true, force:true });
  console.log('done →', OUT);
})();
