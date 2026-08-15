/* Agenter itself: routing, plan gating, and the offline scaffolds.
 *
 * A reply is a list of blocks the UI knows how to paint:
 *   {type:'md',       text}
 *   {type:'refusal',  capability}                 → the hard "No." for free plans
 *   {type:'artifact', kind, title, filename, html}
 */
window.AGENTER = window.AGENTER || {};

(function () {
  'use strict';
  var Store = AGENTER.Store;

  var SYSTEM = [
    'You are Agenter, an AI coding agent built into a small cross-platform app',
    '(Android via Cordova, and Windows / macOS / Linux via Electron).',
    '',
    'How you answer:',
    '- You are a coding agent, not a chat bot. Lead with the code.',
    '- Ship complete, runnable files. No "..." placeholders, no truncated bodies.',
    '- Put every file in its own fenced block, and name the file on the line above it.',
    '- Keep prose short: what you built, how to run it, what to change next.',
    '- If a request is ambiguous, pick the most useful reading, build it, and say',
    '  in one line what you assumed.',
    '',
    'The user is on the ' + (Store.isPro() ? 'Pro' : 'Free') + ' plan.'
  ].join('\n');

  /* ── which capability is this? ──────────────────────────── */
  function classify(text) {
    return AGENTER.matchGate(text);
  }

  /* ── offline scaffolds, used when no API key is configured ─ */

  function gameScaffold() {
    return {
      type: 'artifact', kind: '3D game', title: 'cube-runner.html', filename: 'cube-runner.html',
      html: GAME_HTML
    };
  }

  var GAME_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
'<title>Cube Runner</title>\n<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'body{background:#05070d;color:#e8ecf7;font-family:system-ui,sans-serif;display:flex;\n' +
'  flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:10px;padding:14px}\n' +
'canvas{width:100%;max-width:900px;aspect-ratio:16/10;border-radius:12px;background:#070b16;\n' +
'  display:block;touch-action:none}\n' +
'.hud{font-size:13px;color:#93a0bd}\n.hud b{color:#22d3ee}\n' +
'</style>\n</head>\n<body>\n<canvas id="g" width="900" height="562"></canvas>\n' +
'<p class="hud">Arrow keys or drag to steer · Score <b id="s">0</b> · <b id="m">running</b></p>\n' +
'<script>\n' +
'(function(){\n' +
'var cv=document.getElementById("g"),cx=cv.getContext("2d"),W=cv.width,H=cv.height;\n' +
'var FOV=420,camX=0,camZ=0,speed=13,score=0,alive=true;\n' +
'var cubes=[];\n' +
'function spawn(z){cubes.push({x:(Math.random()-.5)*900,y:0,z:z,s:46,hit:false,\n' +
'  good:Math.random()>.32});}\n' +
'for(var i=0;i<26;i++)spawn(300+i*180);\n' +
'\n' +
'function project(x,y,z){var d=z-camZ;if(d<12)return null;var k=FOV/d;\n' +
'  return{x:W/2+(x-camX)*k,y:H/2+40+(y+120)*k,k:k};}\n' +
'\n' +
'function face(pts,fill,stroke){\n' +
'  cx.beginPath();cx.moveTo(pts[0].x,pts[0].y);\n' +
'  for(var i=1;i<pts.length;i++)cx.lineTo(pts[i].x,pts[i].y);\n' +
'  cx.closePath();cx.fillStyle=fill;cx.fill();\n' +
'  cx.strokeStyle=stroke;cx.lineWidth=1.4;cx.stroke();}\n' +
'\n' +
'function drawCube(c){\n' +
'  var s=c.s,n=[],f=[];\n' +
'  var corners=[[-1,-1],[1,-1],[1,1],[-1,1]];\n' +
'  for(var i=0;i<4;i++){\n' +
'    var a=project(c.x+corners[i][0]*s,c.y+corners[i][1]*s,c.z);\n' +
'    var b=project(c.x+corners[i][0]*s,c.y+corners[i][1]*s,c.z+s*2);\n' +
'    if(!a||!b)return;n.push(a);f.push(b);}\n' +
'  var hue=c.good?"34,211,238":"248,113,113";\n' +
'  var fade=Math.max(.12,Math.min(1,n[0].k*2.4));\n' +
'  face(f,"rgba("+hue+",."+Math.round(fade*22)+")","rgba("+hue+",.25)");\n' +
'  face([n[1],f[1],f[2],n[2]],"rgba("+hue+",."+Math.round(fade*38)+")","rgba("+hue+",.4)");\n' +
'  face(n,"rgba("+hue+",."+Math.round(fade*70)+")","rgba("+hue+",.95)");}\n' +
'\n' +
'function grid(){\n' +
'  cx.strokeStyle="rgba(99,102,241,.22)";cx.lineWidth=1;\n' +
'  for(var x=-1200;x<=1200;x+=150){\n' +
'    var a=project(x,120,camZ+40),b=project(x,120,camZ+2600);\n' +
'    if(a&&b){cx.beginPath();cx.moveTo(a.x,a.y);cx.lineTo(b.x,b.y);cx.stroke();}}\n' +
'  for(var z=0;z<2600;z+=180){\n' +
'    var zz=camZ+40+((z-camZ*0)%2600);\n' +
'    var a2=project(-1200,120,zz),b2=project(1200,120,zz);\n' +
'    if(a2&&b2){cx.beginPath();cx.moveTo(a2.x,a2.y);cx.lineTo(b2.x,b2.y);cx.stroke();}}}\n' +
'\n' +
'var keys={};\n' +
'addEventListener("keydown",function(e){keys[e.key]=true;\n' +
'  if(["ArrowLeft","ArrowRight"].indexOf(e.key)>=0)e.preventDefault();});\n' +
'addEventListener("keyup",function(e){keys[e.key]=false;});\n' +
'var drag=null;\n' +
'cv.addEventListener("pointerdown",function(e){drag=e.clientX;cv.setPointerCapture(e.pointerId);});\n' +
'cv.addEventListener("pointermove",function(e){if(drag!==null){camX+=(e.clientX-drag)*-2.4;drag=e.clientX;}});\n' +
'cv.addEventListener("pointerup",function(){drag=null;});\n' +
'\n' +
'var sEl=document.getElementById("s"),mEl=document.getElementById("m");\n' +
'function tick(){\n' +
'  if(alive){\n' +
'    if(keys.ArrowLeft)camX-=11;if(keys.ArrowRight)camX+=11;\n' +
'    camX=Math.max(-620,Math.min(620,camX));\n' +
'    camZ+=speed;speed=Math.min(30,speed+0.004);\n' +
'  }\n' +
'  cx.fillStyle="#070b16";cx.fillRect(0,0,W,H);\n' +
'  var sky=cx.createLinearGradient(0,0,0,H*.55);\n' +
'  sky.addColorStop(0,"rgba(79,70,229,.28)");sky.addColorStop(1,"rgba(6,182,212,0)");\n' +
'  cx.fillStyle=sky;cx.fillRect(0,0,W,H*.55);\n' +
'  grid();\n' +
'  cubes.sort(function(a,b){return b.z-a.z;});\n' +
'  for(var i=0;i<cubes.length;i++){var c=cubes[i];\n' +
'    if(!c.hit)drawCube(c);\n' +
'    if(!c.hit&&Math.abs(c.z-camZ-90)<40&&Math.abs(c.x-camX)<c.s+58){\n' +
'      c.hit=true;\n' +
'      if(c.good){score+=10;sEl.textContent=score;}\n' +
'      else{alive=false;mEl.textContent="crashed — reload to retry";}}\n' +
'    if(c.z<camZ-200){c.z+=26*180;c.hit=false;c.x=(Math.random()-.5)*900;c.good=Math.random()>.32;}}\n' +
'  requestAnimationFrame(tick);}\n' +
'tick();\n' +
'})();\n' +
'<\/script>\n</body>\n</html>\n';

  var ANIM_HTML = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
'<title>Motion study</title>\n<style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'body{min-height:100vh;background:#05070d;display:grid;place-items:center;padding:24px;\n' +
'  font-family:system-ui,sans-serif;color:#e8ecf7}\n' +
'.stage{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:22px;max-width:760px;width:100%}\n' +
'.card{background:#121727;border:1px solid #232c45;border-radius:14px;padding:22px;text-align:center}\n' +
'.card p{font-size:11.5px;color:#93a0bd;margin-top:14px;letter-spacing:.04em;text-transform:uppercase}\n' +
'.dot{width:52px;height:52px;margin:0 auto;border-radius:14px;\n' +
'  background:linear-gradient(135deg,#6366f1,#22d3ee)}\n' +
'.a1{animation:float 2.4s cubic-bezier(.45,0,.25,1) infinite}\n' +
'.a2{animation:spin 3.2s cubic-bezier(.7,0,.3,1) infinite}\n' +
'.a3{animation:pulse 1.8s ease-in-out infinite}\n' +
'.a4{animation:morph 4s ease-in-out infinite}\n' +
'@keyframes float{0%,100%{transform:translateY(-14px)}50%{transform:translateY(14px)}}\n' +
'@keyframes spin{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(.72)}\n' +
'  100%{transform:rotate(360deg) scale(1)}}\n' +
'@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.55)}\n' +
'  70%{box-shadow:0 0 0 22px rgba(34,211,238,0)}}\n' +
'@keyframes morph{0%,100%{border-radius:14px}33%{border-radius:50%}66%{border-radius:4px 30px}}\n' +
'@media(prefers-reduced-motion:reduce){.dot{animation:none!important}}\n' +
'</style>\n</head>\n<body>\n<div class="stage">\n' +
'<div class="card"><div class="dot a1"></div><p>float</p></div>\n' +
'<div class="card"><div class="dot a2"></div><p>spin + scale</p></div>\n' +
'<div class="card"><div class="dot a3"></div><p>pulse ring</p></div>\n' +
'<div class="card"><div class="dot a4"></div><p>morph</p></div>\n' +
'</div>\n</body>\n</html>\n';

  function cordovaScaffold() {
    var tree = [
      'myapp/',
      '├── config.xml',
      '├── package.json',
      '├── www/',
      '│   ├── index.html',
      '│   ├── css/app.css',
      '│   └── js/app.js',
      '├── res/icon/android/   ← ldpi…xxxhdpi pngs',
      '└── platforms/android/  ← generated, do not commit'
    ].join('\n');

    return [
      { type: 'md', text:
        '### Cordova project\n\n' +
        'Project tree:\n\n```\n' + tree + '\n```\n\n' +
        '`config.xml`:\n\n' +
        '```xml\n' +
        '<?xml version="1.0" encoding="utf-8"?>\n' +
        '<widget id="com.example.myapp" version="1.0.0"\n' +
        '        xmlns="http://www.w3.org/ns/widgets"\n' +
        '        xmlns:cdv="http://cordova.apache.org/ns/1.0">\n' +
        '  <name>MyApp</name>\n' +
        '  <description>Built with Agenter.</description>\n' +
        '  <content src="index.html" />\n' +
        '  <allow-intent href="http://*/*" />\n' +
        '  <allow-intent href="https://*/*" />\n' +
        '  <preference name="AndroidWindowSplashScreenAnimatedIcon" value="res/icon/android/xxxhdpi.png" />\n' +
        '  <preference name="BackgroundColor" value="0xff0b0e17" />\n' +
        '  <platform name="android">\n' +
        '    <icon density="ldpi"    src="res/icon/android/ldpi.png" />\n' +
        '    <icon density="mdpi"    src="res/icon/android/mdpi.png" />\n' +
        '    <icon density="hdpi"    src="res/icon/android/hdpi.png" />\n' +
        '    <icon density="xhdpi"   src="res/icon/android/xhdpi.png" />\n' +
        '    <icon density="xxhdpi"  src="res/icon/android/xxhdpi.png" />\n' +
        '    <icon density="xxxhdpi" src="res/icon/android/xxxhdpi.png" />\n' +
        '  </platform>\n' +
        '</widget>\n```\n\n' +
        'Build it:\n\n' +
        '```sh\n' +
        'npm i -g cordova\n' +
        'cordova create myapp com.example.myapp MyApp\n' +
        'cd myapp\n' +
        'cordova platform add android\n' +
        'cordova build android --release -- \\\n' +
        '  --keystore=my.keystore --alias=my --storePassword=… --password=…\n' +
        '```\n\n' +
        'The APK lands in `platforms/android/app/build/outputs/apk/release/`. ' +
        'Needs a JDK (17 or 21) and the Android SDK with `platforms;android-35` ' +
        'and `build-tools;35.0.0` installed.' }
    ];
  }

  /* ── the free-plan refusal ──────────────────────────────── */
  function refuse(cap) {
    return [{ type: 'refusal', capability: cap }];
  }

  /* ── main entry ─────────────────────────────────────────── */
  var Agent = {
    systemPrompt: function () { return SYSTEM; },
    classify: classify,

    /* Resolves to { blocks, spent } */
    respond: function (prompt, history) {
      var cap = classify(prompt);
      var pro = Store.isPro();

      // Free plan + a Pro capability: a flat no, every time.
      if (cap && !pro) {
        return Promise.resolve({ blocks: refuse(cap), spent: false });
      }

      if (Store.remaining() <= 0) {
        return Promise.resolve({
          blocks: [{ type: 'md', text:
            "You're out of " + (pro ? 'Pro' : 'free') + ' runs for today (' +
            Store.limit() + '/day). ' +
            (pro ? 'The allowance resets at midnight, local time.'
                 : 'Pro is 5× this — ' + Store.limit() * 5 + ' a day — and the allowance ' +
                   'resets at midnight either way.') }],
          spent: false, outOfRuns: true
        });
      }

      // Pro + a capability we can serve locally, no round trip needed.
      if (cap && pro) {
        if (cap.id === 'video') {
          Store.spend();
          var spec = AGENTER.Video.specFromPrompt(prompt);
          return Promise.resolve({ blocks: [
            { type: 'md', text: 'Built you a video out of HTML — ' + spec.scenes.length +
              ' scenes on a canvas timeline. Press **Record .webm** inside it to encode a ' +
              'real file through MediaRecorder; the document itself is self-contained.' },
            { type: 'artifact', kind: 'Video', title: spec.title,
              filename: AGENTER.Video.slug(spec.title) + '.html',
              html: AGENTER.Video.buildHTML(spec) }
          ], spent: true });
        }
        if (cap.id === 'device') {
          Store.spend();
          return AGENTER.Device.report().then(function (md) {
            return { blocks: [
              { type: 'md', text: 'Here is what this device reports right now.\n\n' + md },
              { type: 'device' }
            ], spent: true };
          });
        }
      }

      // Everything else goes to the model, with local scaffolds as the fallback.
      if (!AGENTER.Gemini.configured()) {
        Store.spend();
        return Promise.resolve({ blocks: Agent.offline(prompt, cap), spent: true });
      }

      Store.spend();
      return AGENTER.Gemini.generate(SYSTEM, history.concat([{ role: 'user', text: prompt }]))
        .then(function (text) {
          var blocks = [{ type: 'md', text: text }];
          if (cap && pro) blocks = blocks.concat(Agent.bonusArtifact(cap, prompt));
          return { blocks: blocks, spent: true };
        })
        .catch(function (err) {
          return { blocks: [{ type: 'md', text:
            '**' + (err && err.message ? err.message : 'The request failed.') + '**\n\n' +
            'Falling back to the built-in scaffold.' }].concat(Agent.offline(prompt, cap)),
            spent: true };
        });
    },

    /* Artifacts worth attaching alongside a model answer. */
    bonusArtifact: function (cap, prompt) {
      if (cap.id === 'game3d') return [gameScaffold()];
      if (cap.id === 'anim') {
        return [{ type: 'artifact', kind: 'Animation', title: 'Motion study',
                  filename: 'motion-study.html', html: ANIM_HTML }];
      }
      return [];
    },

    /* No key configured — still do something real. */
    offline: function (prompt, cap) {
      var head = AGENTER.Gemini.configured() ? [] : [{ type: 'md', text:
        'No API key is set, so this is the built-in scaffold rather than a model answer. ' +
        'Add a Gemini key under **⚙ Settings** to get answers written for your exact prompt.' }];

      if (cap && cap.id === 'game3d') {
        return head.concat([
          { type: 'md', text:
            '### Cube Runner\n\nSoftware-projected 3D on a 2D canvas — no WebGL, no libraries. ' +
            'Perspective divide in `project()`, painter\'s algorithm by depth sort, cyan cubes ' +
            'score and red ones end the run. Arrow keys on desktop, drag on a phone.' },
          gameScaffold()
        ]);
      }
      if (cap && cap.id === 'anim') {
        return head.concat([
          { type: 'md', text:
            '### Four motion primitives\n\nFloat, spin-with-scale, pulse ring and a border-radius ' +
            'morph — each on a cubic-bezier that is not the browser default, which is most of ' +
            'what separates motion that reads as designed from motion that reads as a transition. ' +
            'The whole sheet is disabled under `prefers-reduced-motion`.' },
          { type: 'artifact', kind: 'Animation', title: 'Motion study',
            filename: 'motion-study.html', html: ANIM_HTML }
        ]);
      }
      if (cap && cap.id === 'cordova') return head.concat(cordovaScaffold());

      return head.concat([{ type: 'md', text:
        'I can scaffold this once a key is set. What I can build without one, right now:\n\n' +
        '- **3D games** — canvas projection, no dependencies\n' +
        '- **Cordova apps** — full project tree and build commands\n' +
        '- **Videos** — HTML documents that play and record themselves\n' +
        '- **Animations** — CSS and canvas motion\n' +
        '- **Device control** — battery, vibration, sensors, clipboard\n\n' +
        'Ask for any of those by name.' }]);
    }
  };

  AGENTER.Agent = Agent;
})();
