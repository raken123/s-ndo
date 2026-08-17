#!/usr/bin/env node
/* mktrailer.js — captures the trailer's footage from the real game.
 *
 * The game is stepped by hand rather than recorded in real time: the render
 * loop is cancelled and update()/render() are driven a fixed 1/30s at a time,
 * so every frame is clean 1080p30 no matter how slowly software WebGL draws.
 * Frames come off the canvas, so what you see is the actual hall — the same
 * code path a player runs, only with the camera told where to stand.
 *
 *   node build/mktrailer.js [outdir]
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'trailer');
const GAME = path.join(ROOT, 'dist', 'aijudge.html');

const W = 1920, H = 1080, FPS = 30;
const BATCH = 40;                       // frames per round trip out of the page

/* ---- the shot list ---------------------------------------------------------
   Each shot names a setup (run once, in the page) and a length in seconds.
   `cam` optionally overrides the camera per frame, t = seconds into the shot. */

const ONLY = process.env.TRAILER_ONLY
  ? new Set(process.env.TRAILER_ONLY.split(','))
  : null;

const SHOTS = [
  { name: '01-hall',      seconds: 22, setup: 'menu',
    note: 'the empty hall, a slow orbit past the lamps to the bench' },
  { name: '02-queue',     seconds: 26, setup: 'queue', cam: 'line',
    note: 'the line of strangers, advancing one slot at a time' },
  { name: '03-front',     seconds: 10, setup: 'front', cam: 'front',
    note: 'at the head of the line, beside the drum' },
  { name: '04-robot',     seconds: 14, setup: 'menu', cam: 'closeup',
    note: 'the drum robot, close: snare face, brass eyes, two guns' },
  { name: '05-trial',     seconds: 24, setup: 'trial',
    note: 'first person at your podium, the case on the board' },
  { name: '06-deliberate',seconds: 16, setup: 'deliberate',
    note: 'the drum roll while it reads you both' },
  { name: '07-verdict',   seconds: 18, setup: 'verdict',
    note: 'the ruling, the guns coming up, the shot, the fall' },
  { name: '08-morph',     seconds: 15, setup: 'morph',
    note: 'a drum morph: the hall seen from the bench, you are the drum' },
  { name: '09-wide',      seconds: 18, setup: 'aftermath', cam: 'crane',
    note: 'a slow crane over the hall for the platform titles' }
];

/* ---- setups, evaluated inside the page ---- */

const SETUPS = {
  menu: () => {
    const g = window.AIJUDGE.game;
    g.leave();
    g.orbit = 0.9;
    g.camEye = [Math.sin(0.9) * 8.2, 3.6, -0.6 + Math.cos(0.9) * 8.2];
    g.camTarget = [0, 2.4, -4.4];
  },

  queue: () => {
    const g = window.AIJUDGE.game;
    const names = ['Ida', 'Marcus', 'Priya', 'Tomas', 'Selma'];
    if (!g.net) g.connect();
    g.net._clear();
    g.net.line = names.map((n, i) => ({ name: n, rank: 'Litigant', vip: i === 1 }));
    g.world.queueSign.visible = true;
    g.world.self.tag.visible = false;
    g.onQueue({ pos: 5, total: 6, line: g.net.line.slice(0, 5) });
    /* the line shuffles forward while the shot runs */
    window.__advance = (t) => {
      const want = Math.max(0, 5 - Math.floor(t / 4.4));
      if (want !== g.queuePos) {
        g.onQueue({ pos: want, total: want + 1, line: g.net.line.slice(0, want) });
      }
    };
  },

  front: () => {
    const g = window.AIJUDGE.game;
    if (!g.net) g.connect();
    g.net._clear();
    g.net.line = [];
    g.world.queueSign.visible = true;
    g.world.self.tag.visible = false;
    g.onQueue({ pos: 0, total: 1, line: [] });
  },

  trial: () => {
    const g = window.AIJUDGE.game;
    if (!g.net) g.connect();
    g.net._clear();
    const scene = window.AJJudge.SCENES.find(s => s.t === 'The Dog Named Biscuit');
    g.onMatch({
      matchId: 'trailer', scene, side: 'A',
      opponent: { name: 'Otto', rank: 'Advocate', vip: true }, seconds: 45
    });
  },

  deliberate: () => {
    const g = window.AIJUDGE.game;
    g.submitted = true;
    g.setPhase('deliberation');
  },

  verdict: () => {
    const g = window.AIJUDGE.game;
    const scene = window.AJJudge.SCENES.find(s => s.t === 'The Dog Named Biscuit');
    if (!g.match) {
      g.match = { matchId: 'trailer', scene, side: 'A',
                  opponent: { name: 'Otto', rank: 'Advocate', vip: true }, seconds: 45 };
    }
    g.submitted = true;
    g.onVerdict({
      verdict: {
        winner: 'B', scoreA: 41, scoreB: 88,
        ruling: 'Walking him is devotion. The papers are the case. The bench finds for Otto.',
        noteA: 'felt, but did not evidence', noteB: 'brought the document',
        model: 'gemini-3.6-flash', source: 'gemini'
      },
      nameA: 'Brass Kettle', nameB: 'Otto', scene,
      argA: 'I walk him every morning before work, in the rain, for three years.',
      argB: 'My name is on the adoption papers and I have never missed a vet bill.'
    });
  },

  morph: () => {
    const g = window.AIJUDGE.game;
    const scene = window.AJJudge.SCENES.find(s => s.t === 'The Inherited Piano');
    g.match = { matchId: 'trailer', scene, side: 'A',
                opponent: { name: 'Selma', rank: 'Counsel', vip: false }, seconds: 45 };
    g.morphing = true;
    g.onAwaitMorph({
      scene, nameA: 'Brass Kettle', nameB: 'Selma',
      argA: 'I am the one who actually plays it. Badly, but every single day.',
      argB: 'She taught me on that piano. I have not touched it since she died.'
    });
  },

  aftermath: () => {
    const g = window.AIJUDGE.game;
    g.morphing = false;
    for (const c of g.world.morphCards) c.visible = false;
    g.setPhase('aftermath');
  }
};

/* ---- camera overrides, evaluated per frame in the page ---- */

const CAMERAS = {
  /* pushes in on the robot's face and drifts down to the guns */
  closeup: (t) => {
    const g = window.AIJUDGE.game, L = window.AJScene.LAYOUT, r = L.robot;
    const k = Math.min(1, t / 13);
    const ease = k * k * (3 - 2 * k);
    const dist = 6.2 - ease * 3.1;
    const ang = -0.42 + ease * 0.66;
    g.renderer.eye = [r[0] + Math.sin(ang) * dist, 3.5 - ease * 0.75,
                      r[2] + Math.cos(ang) * dist];
    g.renderer.target = [r[0], 3.15 - ease * 1.25, r[2]];
  },
  /* down the length of the line, drifting toward the bench */
  line: (t) => {
    const g = window.AIJUDGE.game;
    const k = Math.min(1, t / 26);
    const ease = k * k * (3 - 2 * k);
    g.renderer.eye = [4.3 - ease * 1.9, 4.0 - ease * 0.7, 8.2 - ease * 3.4];
    g.renderer.target = [-0.1, 2.3 - ease * 0.2, -3.8];
  },
  /* three-quarter on the front of the line: you, small, and the bench above */
  front: (t) => {
    const g = window.AIJUDGE.game;
    const k = Math.min(1, t / 10);
    const ease = k * k * (3 - 2 * k);
    g.renderer.eye = [4.6 - ease * 1.0, 2.75, 2.6 - ease * 0.9];
    g.renderer.target = [-0.5, 2.35, -3.6];
  },
  /* a slow crane back and up over the whole hall */
  crane: (t) => {
    const g = window.AIJUDGE.game;
    const k = Math.min(1, t / 16);
    g.renderer.eye = [0.4 + k * 0.8, 2.6 + k * 3.4, 3.2 + k * 6.5];
    g.renderer.target = [0, 2.2 - k * 0.5, -4.2];
  }
};

/* ---------------------------------------------------------------------- */

(async () => {
  if (!fs.existsSync(GAME)) {
    console.error('! build dist/aijudge.html first (make web)');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
           '--allow-file-access-from-files', '--force-color-profile=srgb',
           '--hide-scrollbars', '--mute-audio']
  });
  const page = await browser.newPage({
    viewport: { width: W, height: H }, deviceScaleFactor: 1
  });
  page.on('pageerror', e => console.error('  ! page error:', e.message));

  await page.goto('file://' + GAME);
  await page.waitForTimeout(2000);

  /* Take the wheel: no rAF, no network, no timers deciding what happens. */
  await page.evaluate(() => {
    cancelAnimationFrame(window.AIJUDGE.game._raf);
    window.AIJUDGE.game.renderer.resize();
    window.AJAudio.setMuted(true);
    window.AJAccount.set({ name: 'Brass Kettle', vip: true, wins: 24, bestStreak: 6 });
    document.getElementById('ui').style.display = 'none';   // trailer carries its own type
  });

  /* Ship the camera moves into the page; functions cannot cross the boundary,
     so they go over as source and are rebuilt there. */
  await page.evaluate((srcs) => {
    window.__CAMS = {};
    for (const k in srcs) window.__CAMS[k] = eval('(' + srcs[k] + ')');
  }, Object.fromEntries(Object.entries(CAMERAS).map(([k, f]) => [k, f.toString()])));

  console.log('AI Judge — trailer capture');
  console.log(`  ${W}x${H} @ ${FPS}fps, stepped by hand\n`);

  const started = Date.now();
  let grand = 0;

  for (const shot of SHOTS) {
    if (ONLY && !ONLY.has(shot.name)) continue;
    const dir = path.join(OUT, shot.name);
    fs.mkdirSync(dir, { recursive: true });
    const total = Math.round(shot.seconds * FPS);

    await page.evaluate(SETUPS[shot.setup]);
    /* let easing settle so a shot does not open mid-lerp */
    await page.evaluate((n) => {
      const g = window.AIJUDGE.game;
      for (let i = 0; i < n; i++) g.update(1 / 30);
    }, shot.setup === 'verdict' || shot.setup === 'morph' ? 2 : 45);

    const t0 = Date.now();
    let frame = 0;
    while (frame < total) {
      const n = Math.min(BATCH, total - frame);
      const jpegs = await page.evaluate(
        ({ n, startFrame, camName }) => {
          const g = window.AIJUDGE.game;
          const cam = camName ? window.__CAMS[camName] : null;
          const canvas = document.getElementById('stage');
          const out = [];
          for (let i = 0; i < n; i++) {
            const t = (startFrame + i) / 30;
            if (window.__advance) window.__advance(t);
            g.update(1 / 30);
            if (cam) cam(t);
            g.renderer.render(g.world.root);
            out.push(canvas.toDataURL('image/jpeg', 0.94).slice(23));
          }
          return out;
        },
        { n, startFrame: frame, camName: shot.cam || null });

      for (let i = 0; i < jpegs.length; i++) {
        fs.writeFileSync(
          path.join(dir, 'f' + String(frame + i + 1).padStart(5, '0') + '.jpg'),
          Buffer.from(jpegs[i], 'base64'));
      }
      frame += jpegs.length;
      process.stdout.write(`\r  ${shot.name}  ${frame}/${total}`);
    }
    await page.evaluate(() => { delete window.__advance; });

    const secs = (Date.now() - t0) / 1000;
    grand += total;
    console.log(`\r  ${shot.name}  ${total} frames  ${shot.seconds}s  ` +
                `(${secs.toFixed(0)}s to capture)  — ${shot.note}`);
  }

  /* A few full-page stills so the trailer can show the interface itself, which
     lives in the DOM and never appears on the canvas. */
  const uiDir = path.join(OUT, 'ui');
  fs.mkdirSync(uiDir, { recursive: true });
  await page.evaluate(() => { document.getElementById('ui').style.display = ''; });

  const stills = [
    ['menu', SETUPS.menu],
    ['queue', SETUPS.queue],
    ['trial', SETUPS.trial],
    ['verdict', SETUPS.verdict]
  ];
  for (const [name, setup] of stills) {
    await page.evaluate(setup);
    await page.evaluate(() => {
      const g = window.AIJUDGE.game;
      for (let i = 0; i < 90; i++) g.update(1 / 30);
      g.renderer.render(g.world.root);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(uiDir, name + '.jpg'), type: 'jpeg', quality: 94 });
    console.log('  ui/' + name + '.jpg');
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(
    { width: W, height: H, fps: FPS, shots: SHOTS.map(s => ({ name: s.name, seconds: s.seconds })) },
    null, 2));

  console.log(`\n  ${grand} frames, ${(grand / FPS).toFixed(0)}s of footage ` +
              `in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  console.log('  → ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
