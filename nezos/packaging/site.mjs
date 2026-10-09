// Writes the downloads page (index.html) for whatever builds are in a folder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ICONS, VERSION } from './lib.mjs';

const PLATFORMS = [
  {
    id: 'windows', os: 'Windows', match: /windows-x64\.exe$/, label: 'Windows app (portable, no install)', ext: 'EXE', icon: '🪟',
    req: 'Windows 10 or 11 (64-bit). Uses the built-in Microsoft Edge WebView2.',
    steps: ['Download and double-click the .exe. It\'s a single portable file, so there\'s nothing to install.', 'If SmartScreen says "Windows protected your PC", click <b>More info → Run anyway</b> (the app isn\'t code-signed yet).'],
  },
  {
    id: 'mac', os: 'macOS', match: /macos\.dmg$/, label: 'Mac app (Apple Silicon + Intel)', ext: 'DMG', icon: '',
    req: 'macOS 12 or later, Apple Silicon or Intel.',
    steps: ['Open the .dmg and drag <b>Nezos</b> into <b>Applications</b>.', 'The app isn\'t notarized by Apple yet. The first time, run <code>xattr -cr /Applications/Nezos.app</code> in Terminal (or System Settings → Privacy &amp; Security → <b>Open Anyway</b>).'],
  },
  {
    id: 'linux', os: 'Linux', match: /_amd64\.deb$/, label: 'Debian / Ubuntu package', ext: 'DEB', icon: '🐧',
    req: 'Debian 12+, Ubuntu 22.04+ or derivatives (x86-64).',
    steps: ['<code>sudo apt install ./nezos_' + VERSION + '_amd64.deb</code>', 'Start <b>Nezos</b> from your app menu, or run <code>nezos</code>.'],
  },
  {
    id: 'android', os: 'Android', match: /\.apk$/, label: 'Android app', ext: 'APK', icon: '🤖',
    req: 'Android 7.0 or later, phones and tablets (tablets recommended for the studio).',
    steps: ['Download the .apk on your device and open it.', 'Allow "Install unknown apps" for your browser when Android asks.'],
  },
  {
    id: 'play', os: 'Google Play', match: /\.aab$/, label: 'Android App Bundle for the Play Store', ext: 'AAB', icon: '▶️',
    req: 'For publishing: upload it in Google Play Console → Release → Create new release.',
    steps: ['App bundles aren\'t installed directly. Upload this file to Google Play Console.', 'Play App Signing re-signs it for distribution.'],
  },
  {
    id: 'ios', os: 'iOS / iPadOS', match: /\.ipa$/, label: 'iPhone & iPad app', ext: 'IPA', icon: '📱',
    req: 'iOS / iPadOS 15 or later.',
    steps: ['Install with a sideloading tool such as <b>AltStore</b> or <b>Sideloadly</b>, which signs it with your Apple ID.', 'With an Apple Developer account you can also re-sign it for TestFlight / the App Store.'],
  },
  {
    id: 'web', os: 'Any browser', match: /^nezos\.html$/, label: 'Single-file web app', ext: 'HTML', icon: '🌐',
    req: 'Chrome, Edge, Firefox or Safari (current versions).',
    steps: ['Download and double-click the .html file, so it opens in your browser.', 'Your account and projects are saved in that browser.'],
  },
];

const human = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function writeSite(dir, { note = '' } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f !== 'index.html');
  const builds = PLATFORMS.map((p) => {
    const file = files.find((f) => p.match.test(f));
    if (!file) return { ...p, file: null };
    const data = fs.readFileSync(path.join(dir, file));
    return { ...p, file, size: human(data.length), sha: crypto.createHash('sha256').update(data).digest('hex') };
  });
  const logo = `data:image/png;base64,${fs.readFileSync(path.join(ICONS, 'icon-128.png')).toString('base64')}`;
  const apple = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.37 12.6c.02 2.5 2.2 3.33 2.22 3.34-.02.06-.35 1.18-1.14 2.34-.69 1-1.4 2-2.53 2.02-1.1.02-1.46-.65-2.72-.65-1.27 0-1.66.63-2.71.67-1.09.04-1.92-1.08-2.61-2.08-1.42-2.05-2.5-5.79-1.05-8.32.72-1.25 2.01-2.05 3.41-2.07 1.07-.02 2.08.72 2.73.72.66 0 1.88-.89 3.17-.76.54.02 2.05.22 3.02 1.64-.08.05-1.8 1.05-1.79 3.15zM14.3 5.25c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.53.62-1 1.62-.88 2.57.93.07 1.88-.47 2.46-1.17z"/></svg>';

  const card = (b) => `
    <article class="card ${b.file ? '' : 'pending'}" data-os="${b.id}">
      <div class="top">
        <div class="ic">${b.id === 'mac' ? apple : b.icon}</div>
        <div><h3>${esc(b.os)}</h3><div class="lbl">${esc(b.label)}</div></div>
        <span class="ext">.${b.ext.toLowerCase()}</span>
      </div>
      ${b.file
        ? `<a class="dl" href="${encodeURIComponent(b.file)}" download>Download ${b.ext}<small>${b.size}</small></a>`
        : '<div class="dl off">Building…<small>not available yet</small></div>'}
      <p class="req">${b.req}</p>
      <ol>${b.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
      ${b.file ? `<details><summary>SHA-256</summary><code class="sha">${b.sha}</code></details>` : ''}
    </article>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Download Nezos</title>
<meta name="description" content="Download Nezos, the AI 3D game studio, for Windows, macOS, Linux, Android and iOS.">
<link rel="icon" href="${logo}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;--bg:#0b0d17;--panel:#151827;--panel2:#1b1f33;--line:#262b45;--ink:#eef0ff;--muted:#9aa0c3;--dim:#6b7096;--brand:#7c5cff;--brand2:#3ad1ff;--ok:#3ddc97}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--ink);font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}code{font:12.5px ui-monospace,"SF Mono",Menlo,monospace;background:#0f1220;border:1px solid var(--line);padding:1px 6px;border-radius:6px}
header{position:relative;overflow:hidden;padding:72px 20px 40px;text-align:center}
header::before{content:"";position:absolute;inset:-40% -10% auto;height:620px;background:radial-gradient(closest-side,#7c5cff40,transparent 70%),radial-gradient(closest-side at 70% 40%,#3ad1ff22,transparent 70%);pointer-events:none}
header>*{position:relative}
.logo{width:88px;height:88px;border-radius:22px;box-shadow:0 20px 60px #7c5cff55}
h1{font-size:clamp(36px,6vw,60px);letter-spacing:-.04em;line-height:1.05;margin:18px 0 10px;font-weight:900}
h1 span{background:linear-gradient(90deg,#b9a6ff,#6ee0ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--muted);max-width:620px;margin:0 auto;font-size:17px}
.ver{display:inline-flex;gap:8px;margin-top:18px;padding:4px 12px;border-radius:999px;font-size:12.5px;font-weight:700;background:#7c5cff22;color:#c3b5ff;border:1px solid #7c5cff44}
.rec{max-width:560px;margin:28px auto 0;padding:18px;border-radius:18px;background:var(--panel);border:1px solid var(--brand);box-shadow:0 0 0 1px var(--brand),0 20px 60px #7c5cff30;display:none}
.rec.on{display:block}.rec p{margin:0 0 12px;color:var(--muted);font-size:14px}
main{max-width:1180px;margin:0 auto;padding:10px 20px 60px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{display:flex;flex-direction:column;gap:12px;padding:20px;border-radius:18px;background:var(--panel);border:1px solid var(--line);transition:border-color .15s,transform .15s}
.card:hover{border-color:#3a4170;transform:translateY(-2px)}.card.hl{border-color:var(--brand)}
.card.pending{opacity:.6}
.top{display:flex;gap:12px;align-items:center}
.ic{width:44px;height:44px;flex:none;border-radius:12px;display:grid;place-items:center;font-size:22px;background:#7c5cff22}
.top h3{margin:0;font-size:17px}.lbl{color:var(--muted);font-size:13px}
.ext{margin-left:auto;font:700 12px ui-monospace,Menlo,monospace;color:#9fe9ff;background:#3ad1ff14;border:1px solid #3ad1ff33;padding:3px 8px;border-radius:7px}
.dl{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-radius:12px;font-weight:700;text-decoration:none;color:#fff;background:linear-gradient(135deg,var(--brand),#5b7cff);box-shadow:0 6px 24px #7c5cff40}
.dl:hover{background:linear-gradient(135deg,#8b6dff,#6a89ff)}
.dl small{font-weight:600;opacity:.8}.dl.off{background:var(--panel2);box-shadow:none;color:var(--muted)}
.req{margin:0;color:var(--muted);font-size:13px}
ol{margin:0;padding-left:20px;font-size:13.5px;color:#cfd3f2;display:grid;gap:6px}
details{font-size:12px;color:var(--dim)}summary{cursor:pointer}
.sha{display:block;margin-top:6px;word-break:break-all;font-size:11px}
.note{max-width:1180px;margin:0 auto 18px;padding:12px 16px;border-radius:12px;background:#ffc85714;border:1px solid #ffc85744;color:#ffe2a3;font-size:13.5px}
footer{text-align:center;color:var(--dim);font-size:13px;padding:30px 20px 50px;border-top:1px solid #ffffff0d}
@media (max-width:420px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <img class="logo" src="${logo}" alt="Nezos">
  <h1>Download <span>Nezos</span></h1>
  <p class="sub">The AI game studio for building 3D games: describe a game and Nezos generates the models, images, scenes, code and playtests.</p>
  <div class="ver">Version ${VERSION} · ${builds.filter((b) => b.file).length} platforms</div>
  <div class="rec" id="rec"><p>Recommended for your device</p><div id="recBtn"></div></div>
</header>
${note ? `<div class="note">${note}</div>` : ''}
<main><div class="grid">${builds.map(card).join('')}</div></main>
<footer>Nezos ${VERSION}. Every account starts with 100 free credits. Builds are not code-signed by Apple, Microsoft or Google yet.</footer>
<script>
(function () {
  var ua = navigator.userAgent, p = navigator.platform || '';
  var os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) || (p === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios'
    : /Mac/i.test(p) ? 'mac' : /Win/i.test(p) ? 'windows' : /Linux/i.test(p) ? 'linux' : null;
  var card = os && document.querySelector('.card[data-os="' + os + '"]');
  if (!card) return;
  card.classList.add('hl');
  var dl = card.querySelector('a.dl');
  if (!dl) return;
  document.getElementById('recBtn').appendChild(dl.cloneNode(true));
  document.getElementById('rec').classList.add('on');
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return builds;
}
