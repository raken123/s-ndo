// Phone screens for the five update ads (build/screens/v2-*.png), shot in the
// real app. Needs the app served at http://localhost:8765 and a test cloud
// (HUBAI_FAKE_MODELS=1) at http://127.0.0.1:8799. Generation is stubbed with
// the hubs below, so the screens show finished work; the 3D model is the
// cloud's own viewer around a scene made here.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = __dirname + '/build/screens/';

const FOOT = (n) => '<footer style="text-align:center;color:#8a8a8a;font:11px system-ui;padding:8px">Made with Hub AI · ' + n + '</footer>';

const ANIMATION = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rocket to the Moon</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{display:block;width:100%;height:100%}</style></head><body>
<canvas id="stage"></canvas><script>
var c=document.getElementById('stage'),x=c.getContext('2d'),S=[];for(var i=0;i<140;i++)S.push([Math.random(),Math.random(),Math.random()*2+0.5]);
function f(t){var w=c.width=innerWidth*2,h=c.height=innerHeight*2,k=(t/6000)%1;var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0b0f2e');g.addColorStop(1,'#3a1d5c');
x.fillStyle=g;x.fillRect(0,0,w,h);S.forEach(function(s){x.fillStyle='rgba(255,255,255,'+(0.5+0.5*Math.sin(t/400+s[0]*20))+')';x.fillRect(s[0]*w,((s[1]+k*0.5)%1)*h,s[2]*2,s[2]*2)});
x.fillStyle='#ffe066';x.beginPath();x.arc(w*0.72,h*0.22,w*0.16,0,7);x.fill();x.fillStyle='#f0c419';[[0.68,0.19,0.03],[0.77,0.26,0.04],[0.7,0.28,0.02]].forEach(function(m){x.beginPath();x.arc(w*m[0],h*m[1],w*m[2],0,7);x.fill()});
var rx=w*(0.25+0.35*k),ry=h*(0.85-0.6*k);x.save();x.translate(rx,ry);x.rotate(0.5);var u=w*0.06;
x.fillStyle='#ff9b2f';x.beginPath();x.moveTo(-u*0.4,u*1.6);x.lineTo(0,u*(2.4+0.3*Math.sin(t/60)));x.lineTo(u*0.4,u*1.6);x.fill();
x.fillStyle='#e5484d';x.beginPath();x.moveTo(-u,u*1.6);x.lineTo(-u*0.5,u*0.6);x.lineTo(u*0.5,u*0.6);x.lineTo(u,u*1.6);x.fill();
x.fillStyle='#f4f4f4';x.beginPath();x.moveTo(-u*0.5,u*1.6);x.lineTo(-u*0.5,-u*0.6);x.quadraticCurveTo(0,-u*1.8,u*0.5,-u*0.6);x.lineTo(u*0.5,u*1.6);x.fill();
x.fillStyle='#7cc4ff';x.beginPath();x.arc(0,0,u*0.25,0,7);x.fill();x.restore();
x.fillStyle='#fff';x.font='bold '+(w*0.07)+'px system-ui';x.textAlign='center';x.fillText('TO THE MOON',w/2,h*0.93);requestAnimationFrame(f)}requestAnimationFrame(f)
</script>${FOOT('Hub V1 Volt')}</body></html>`;

const SLIDES = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Banana Juice — Pitch</title>
<style>body{margin:0;background:#111;color:#f4f4f4;font:16px system-ui,sans-serif}.deck{padding:14px}.slide{aspect-ratio:16/9;background:linear-gradient(135deg,#1d2b1a,#2e4a1f);border-radius:10px;padding:18px;box-sizing:border-box;display:flex;flex-direction:column;margin-bottom:12px}
h1{font-size:26px;margin:0 0 4px;color:#ffd23a}h2{font-size:18px;margin:0 0 8px;color:#ffd23a}p{margin:0;color:#d9e8cc;font-size:13px}.bars{display:flex;align-items:flex-end;gap:10px;flex:1;margin-top:8px}.bars div{flex:1;background:#ffd23a;border-radius:4px 4px 0 0;position:relative}
.bars span{position:absolute;bottom:-18px;left:0;right:0;text-align:center;font-size:10px;color:#cfe3bd}.nav{display:flex;justify-content:space-between;align-items:center;color:#9a9a9a;font-size:12px;padding:0 4px}.nav b{background:#2a2a2a;border-radius:8px;padding:6px 12px;color:#fff}</style></head><body><div class="deck">
<section class="slide"><h1>🍌 Banana Juice</h1><p>Fresh, fast, everywhere. Seed round · 2026</p><div style="flex:1;display:grid;place-items:center;font-size:54px">🥤</div></section>
<section class="slide"><h2>Sales are going bananas</h2><div class="bars"><div style="height:25%"><span>Q1</span></div><div style="height:42%"><span>Q2</span></div><div style="height:66%"><span>Q3</span></div><div style="height:95%"><span>Q4</span></div></div></section>
<div class="nav"><b>‹ Prev</b><span>Slide 1 / 10 · Print / PDF</span><b>Next ›</b></div></div>${FOOT('Hub V1 Prism')}</body></html>`;

const CARD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you, team!</title>
<style>body{margin:0;min-height:100vh;background:#0f0f14;display:grid;place-items:center;font-family:Georgia,serif}.card{width:82vw;aspect-ratio:5/7;background:linear-gradient(160deg,#fff7e0,#ffe3a3);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#3b2a0a;padding:20px;box-sizing:border-box}
.card .e{font-size:64px}.card h1{font-size:34px;margin:10px 0 6px}.card p{font-size:16px;margin:4px 0;color:#6b4a14}.card .s{margin-top:18px;font-style:italic}</style></head><body><div class="card"><div class="e">🍌✨</div><h1>Thank you, team!</h1><p>We pitched it. We nailed it.</p><p>Banana Juice is happening.</p><p class="s">— Max</p></div>${FOOT('Hub V1 Prism')}</body></html>`;

const UI = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RocketGo — UI design</title>
<style>body{margin:0;background:#16161c;color:#eee;font:13px system-ui,sans-serif;padding:12px}.row{display:flex;gap:10px}.ph{flex:1;background:#0b0d14;border:3px solid #2b2b38;border-radius:22px;padding:12px 10px;min-height:330px}
.ph h3{margin:6px 0 10px;font-size:15px}.hero{background:linear-gradient(135deg,#6c2bd9,#e5484d);border-radius:14px;padding:12px;font-weight:700;font-size:16px}.hero small{display:block;font-weight:400;opacity:.85;font-size:11px;margin-top:4px}
.it{background:#1b1e29;border-radius:10px;padding:9px;margin-top:8px;display:flex;justify-content:space-between}.btn{background:#ffd23a;color:#111;border-radius:10px;padding:10px;text-align:center;font-weight:700;margin-top:12px}
.ds{margin-top:12px;background:#1b1e29;border-radius:12px;padding:10px}.sw{display:inline-block;width:34px;height:34px;border-radius:8px;margin-right:6px;vertical-align:middle}</style></head><body>
<div class="row"><div class="ph"><h3>🚀 RocketGo</h3><div class="hero">Next launch<small>Banana Moon · T-00:10</small></div><div class="it"><span>Fuel</span><b>98%</b></div><div class="it"><span>Crew</span><b>2 cats</b></div><div class="btn">Launch</div></div>
<div class="ph"><h3>Mission log</h3><div class="it"><span>Liftoff</span><b>✓</b></div><div class="it"><span>Orbit</span><b>✓</b></div><div class="it"><span>Landing</span><b>…</b></div><div class="it"><span>Bananas</span><b>12</b></div></div></div>
<div class="ds"><b>Design system</b><div style="margin-top:8px"><span class="sw" style="background:#6c2bd9"></span><span class="sw" style="background:#e5484d"></span><span class="sw" style="background:#ffd23a"></span><span class="sw" style="background:#1b1e29"></span> Inter · 13/15/22</div></div>${FOOT('Hub V1 Titan')}</body></html>`;

// A banana rocket for the 3D model, wrapped by the cloud's own viewer.
function rocket3d() {
  const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(__dirname + '/../../cloud')})
from hubcloud import viewer3d
P = []
def part(shape, scale, pos, color, rot=(0, 0, 0)):
    P.append({"shape": shape, "scale": list(scale), "position": list(pos), "rotation": list(rot), "color": color})
part("cylinder", (1.1, 2.4, 1.1), (0, 1.7, 0), "#ffd23a")
part("cone", (1.1, 1.2, 1.1), (0, 3.5, 0), "#f0b400")
part("sphere", (0.18, 0.18, 0.18), (0, 4.15, 0), "#6b4512")
part("sphere", (0.5, 0.5, 0.25), (0, 2.3, 0.5), "#7cc4ff")
part("torus", (1.25, 1.25, 1.25), (0, 2.3, 0), "#e5484d")
for a in (0, 120, 240):
    import math
    r = math.radians(a)
    part("box", (0.14, 0.9, 0.8), (0.62 * math.sin(r), 0.65, 0.62 * math.cos(r)), "#e5484d", (0, a, 0))
part("cone", (0.7, 0.8, 0.7), (0, 0.1, 0), "#ff9b2f", (180, 0, 0))
scene = viewer3d.clean({"title": "Banana Rocket", "background": "#101418", "parts": P})
print(viewer3d.page(scene, "Made with Hub AI · Hub V1 Titan"))
`;
  return execFileSync('python3', ['-c', py]).toString();
}

function imagePage(title, pngPath) {
  const b64 = fs.readFileSync(pngPath).toString('base64');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title +
    '</title><style>html,body{margin:0;min-height:100%;background:#0d0d0d;color:#9a9a9a;font:12px system-ui,sans-serif}main{min-height:calc(100vh - 28px);display:grid;place-items:center;padding:8px;box-sizing:border-box}' +
    'img{max-width:100%;max-height:calc(100vh - 44px);border-radius:8px}footer{text-align:center;padding:6px}</style></head><body><main><img id="art" alt="' + title +
    '" src="data:image/png;base64,' + b64 + '"></main><footer>Made with Hub AI · Hub V1 Pixel</footer></body></html>';
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  // the photo, before and after
  const ph = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const v of ['before', 'after']) {
    await ph.goto('file://' + __dirname + '/photo-booth.html?' + v); await ph.waitForTimeout(200);
    await ph.screenshot({ path: OUT + 'v2-photo-' + v + '.png' });
  }
  await ph.close();
  const ROCKET = rocket3d(), PHOTO = imagePage('Max at sunset', OUT + 'v2-photo-after.png');

  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8765/index.html');
  await p.evaluate(() => { localStorage.clear(); localStorage['hubai.settings'] = JSON.stringify({ cloudUrl: 'http://127.0.0.1:8799' }); localStorage['hubai.whatsnew'] = '"v2"'; });
  await p.reload(); await p.waitForTimeout(1000);
  await p.evaluate(async () => { await Cloud.subscribe('plus'); await Cloud.refresh(); });
  const hubs = { animation: ANIMATION, slides: SLIDES, card: CARD, ui: UI, model3d: ROCKET, image: PHOTO };
  const fresh = async () => {
    await p.reload(); await p.waitForTimeout(800);
    await p.evaluate((h) => {
      Cloud.generate = function (engine, prompt, extra) {
        var k = (extra && extra.kind) || 'app', html = h[k] || h.slides;
        return new Promise(function (r) { setTimeout(function () {
          r({ html: html, title: (/<title>([^<]*)/.exec(html) || [])[1] || prompt, kind: k, engine: engine, engineName: Plans.engine(engine).name, seconds: 4.2, me: Plans.me() });
        }, 150); });
      };
      localStorage['hubai.draft'] = 'null';
    }, hubs);
  };
  const shot = async (name) => { await p.screenshot({ path: OUT + 'v2-' + name + '.png' }); };
  const make = async (kind, prompt, engine) => {
    await fresh();
    await p.click('[data-kind=' + kind + ']'); await p.waitForTimeout(150);
    if (engine) { await p.click('[data-engine=' + engine + ']'); }
    await p.fill('#prompt', prompt);
  };
  const go = async () => {
    await p.click('#gen'); await p.waitForFunction(() => !document.querySelector('#gen .spinner'));
    await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById('result').scrollIntoView());
    await p.waitForTimeout(1500);
  };

  // 1. the agents
  await make('app', 'A habit tracker', 'titan');
  await p.evaluate(() => document.querySelector('.engines').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300); await shot('agents');
  await p.click('[data-kind=image]'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector('.engines').scrollIntoView({ block: 'center' }));
  await shot('pixel');
  // kinds grid
  await fresh(); await p.evaluate(() => window.scrollTo(0, 0)); await shot('kinds');
  // 2. animation and video
  await make('animation', 'An animation of a rocket flying to the moon', 'volt'); await shot('studio-create');
  await go(); await shot('studio-result');
  await p.click('[data-kact=video]'); await p.waitForTimeout(300);
  await p.click('#sheet [data-x=go]'); await p.waitForTimeout(2500); await shot('studio-video');
  await p.waitForFunction(() => document.getElementById('sheet').hidden, null, { timeout: 30000 }).catch(() => {});
  // 3. slides and a card
  await make('slides', 'A pitch deck for Banana Juice', 'prism'); await shot('pitch-create');
  await go(); await shot('pitch-result');
  await make('card', 'A thank-you card for my team', 'prism'); await go(); await shot('pitch-card');
  // 4. 3D model and UI design
  await make('model3d', 'A banana rocket', 'titan'); await shot('lab-create');
  await go(); await p.waitForTimeout(1200); await shot('lab-result');
  await make('ui', 'Screens for a rocket launch app', 'titan'); await go(); await shot('lab-ui');
  // 5. photo edit
  await fresh();
  await p.click('[data-kind=image]'); await p.waitForTimeout(150);
  await p.setInputFiles('#photoFile', OUT + 'v2-photo-before.png'); await p.waitForTimeout(500);
  await p.fill('#prompt', 'Remove the banana peel and add a sunset');
  await p.evaluate(() => document.getElementById('prompt').scrollIntoView({ block: 'center' }));
  await shot('photo-create');
  await go(); await shot('photo-result');
  await b.close();
  console.log('screens done');
})();
