// Desktop builds on Neutralino (system web view: WebView2 / WKWebView / WebKitGTK):
//   Windows  -> single portable .exe with the app embedded
//   Linux    -> .deb installing /opt/nezos
//   macOS    -> universal .app in a .dmg
import fs from 'node:fs';
import path from 'node:path';
import * as ResEdit from 'resedit';
import { PKG, WORK, ICONS, VERSION, APP_ID, log, run, fresh, download, makeIco, makeIcns } from './lib.mjs';

const NEU_VERSION = '6.10.0';
const PORT = 51743; // fixed so the web view's storage (accounts, projects) survives restarts

function neuProject(html) {
  const dir = fresh(path.join(WORK, 'neu'));
  fs.mkdirSync(path.join(dir, 'resources'));
  fs.writeFileSync(path.join(dir, 'resources/index.html'), html);
  fs.copyFileSync(path.join(ICONS, 'icon-256.png'), path.join(dir, 'resources/icon.png'));
  fs.writeFileSync(path.join(dir, 'neutralino.config.json'), JSON.stringify({
    applicationId: APP_ID,
    applicationName: 'Nezos',
    author: 'Nezos',
    description: 'Build 3D games with AI',
    version: VERSION,
    defaultMode: 'window',
    port: PORT,
    documentRoot: '/resources/',
    url: '/',
    enableServer: true,
    enableNativeAPI: false,
    tokenSecurity: 'one-time',
    logging: { enabled: false, writeToLogFile: false },
    modes: {
      window: {
        title: 'Nezos', width: 1440, height: 900, minWidth: 1024, minHeight: 640,
        center: true, resizable: true, icon: '/resources/icon.png', enableInspector: false,
      },
    },
    cli: { binaryName: 'nezos', resourcesPath: '/resources/', extensionsPath: '/extensions/', binaryVersion: NEU_VERSION, clientVersion: NEU_VERSION },
  }, null, 2));
  return dir;
}

async function neuBinaries(dir) {
  const zip = await download(`https://github.com/neutralinojs/neutralinojs/releases/download/v${NEU_VERSION}/neutralinojs-v${NEU_VERSION}.zip`, path.join(WORK, 'cache', `neutralinojs-v${NEU_VERSION}.zip`));
  run('unzip', ['-qo', zip, '-d', path.join(dir, 'bin')]);
}

const neu = (dir, ...args) => run(path.join(PKG, 'node_modules/.bin/neu'), ['build', '--release', ...args], { cwd: dir, quiet: true });

function windowsExe(src, out) {
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(src));
  const res = ResEdit.NtExecutableResource.from(exe);
  const ico = ResEdit.Data.IconFile.from(makeIco());
  // replace Neutralino's own icon group (the first one is what Explorer shows)
  const group = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, group?.id ?? 1, group?.lang ?? 1033, ico.icons.map((i) => i.data));
  const vi = ResEdit.Resource.VersionInfo.createEmpty();
  const [a, b, c] = VERSION.split('.').map(Number);
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: 'Nezos', FileDescription: 'Nezos: build 3D games with AI', CompanyName: 'Nezos',
    OriginalFilename: path.basename(out), InternalName: 'nezos', LegalCopyright: `© ${new Date().getFullYear()} Nezos`,
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(out, Buffer.from(exe.generate()));
}

function linuxDeb(binary, out) {
  const root = fresh(path.join(WORK, 'deb'));
  const put = (rel, data, mode = 0o644) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
    fs.chmodSync(p, mode);
  };
  put('opt/nezos/nezos', fs.readFileSync(binary), 0o755);
  fs.mkdirSync(path.join(root, 'usr/bin'), { recursive: true });
  fs.symlinkSync('/opt/nezos/nezos', path.join(root, 'usr/bin/nezos'));
  put('usr/share/applications/nezos.desktop', `[Desktop Entry]
Type=Application
Name=Nezos
GenericName=AI 3D game studio
Comment=Build 3D games with AI
Exec=/opt/nezos/nezos
Icon=nezos
Terminal=false
Categories=Development;Game;Graphics;
StartupWMClass=nezos
`);
  for (const s of [48, 64, 128, 256, 512]) put(`usr/share/icons/hicolor/${s}x${s}/apps/nezos.png`, fs.readFileSync(path.join(ICONS, `icon-${s}.png`)));
  const kb = Math.ceil(Number(run('du', ['-sk', '--exclude=DEBIAN', root], { quiet: true }).toString().split('\t')[0]));
  put('DEBIAN/control', `Package: nezos
Version: ${VERSION}
Section: devel
Priority: optional
Architecture: amd64
Maintainer: Nezos <hello@nezos.app>
Installed-Size: ${kb}
Depends: libgtk-3-0t64 | libgtk-3-0, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37
Homepage: https://github.com/raken123/s-ndo
Description: Nezos - build 3D games with AI
 A Figma-style 3D game studio with an AI co-developer that generates
 models, images, scenes, code and playtests using OpenAI models.
`);
  put('DEBIAN/postinst', '#!/bin/sh\nset -e\ncommand -v update-desktop-database >/dev/null && update-desktop-database -q || true\ncommand -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q /usr/share/icons/hicolor || true\n', 0o755);
  run('dpkg-deb', ['--root-owner-group', '-Zxz', '--build', root, out], { quiet: true });
}

function macApp(neuDir, appDir) {
  // Keep Neutralino's original (ad-hoc signed) binary: embedding resources would
  // strip the arm64 signature and Apple Silicon refuses to run unsigned code.
  fresh(appDir);
  const macos = path.join(appDir, 'Contents/MacOS');
  const res = path.join(appDir, 'Contents/Resources');
  fs.mkdirSync(macos, { recursive: true });
  fs.mkdirSync(res, { recursive: true });
  fs.copyFileSync(path.join(neuDir, 'bin/neutralino-mac_universal'), path.join(macos, 'nezos'));
  fs.chmodSync(path.join(macos, 'nezos'), 0o755);
  fs.copyFileSync(path.join(neuDir, 'dist/nezos/resources.neu'), path.join(macos, 'resources.neu'));
  fs.writeFileSync(path.join(res, 'Nezos.icns'), makeIcns());
  fs.writeFileSync(path.join(appDir, 'Contents/PkgInfo'), 'APPL????');
  fs.writeFileSync(path.join(appDir, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>Nezos</string>
  <key>CFBundleName</key><string>Nezos</string>
  <key>CFBundleExecutable</key><string>nezos</string>
  <key>CFBundleIconFile</key><string>Nezos</string>
  <key>CFBundleIdentifier</key><string>${APP_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Nezos uses the microphone for voice prompts.</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict>
</plist>
`);
}

function macDmg(appDir, out) {
  const stage = fresh(path.join(WORK, 'dmg'));
  run('cp', ['-a', appDir, path.join(stage, 'Nezos.app')]);
  fs.symlinkSync('/Applications', path.join(stage, 'Applications'));
  fs.writeFileSync(path.join(stage, 'READ ME FIRST.txt'), `Nezos ${VERSION} for macOS (Apple Silicon and Intel)

1. Drag Nezos into Applications.
2. Nezos is not notarized by Apple, so the first time, open Terminal and run:

     xattr -cr /Applications/Nezos.app

   then open Nezos normally. (Or: try to open it, then System Settings >
   Privacy & Security > "Open Anyway".)

Requires macOS 12 or later with current Safari updates.
`);
  run('python3', [path.join(PKG, 'mkdmg.py'), stage, out, 'Nezos']);
}

export async function buildDesktop(html, outDir) {
  const dir = neuProject(html);
  await neuBinaries(dir);
  log('neutralino: resources.neu (macOS)');
  neu(dir);
  const appDir = path.join(WORK, 'Nezos.app');
  macApp(dir, appDir);
  log('neutralino: embedded binaries (Windows, Linux)');
  neu(dir, '--embed-resources');
  const files = {
    exe: path.join(outDir, `Nezos-${VERSION}-windows-x64.exe`),
    deb: path.join(outDir, `nezos_${VERSION}_amd64.deb`),
    dmg: path.join(outDir, `Nezos-${VERSION}-macos.dmg`),
  };
  log('windows exe');
  windowsExe(path.join(dir, 'dist/nezos/nezos-win_x64.exe'), files.exe);
  log('linux deb');
  linuxDeb(path.join(dir, 'dist/nezos/nezos-linux_x64'), files.deb);
  log('macos dmg');
  macDmg(appDir, files.dmg);
  return files;
}
