// Android builds without Gradle: aapt2 + javac + d8 + apksigner (APK) and
// bundletool + jarsigner (AAB), using Google's SDK packages directly.
import fs from 'node:fs';
import path from 'node:path';
import { PKG, WORK, ICONS, VERSION, APP_ID, log, run, fresh, download } from './lib.mjs';

const BUILD_TOOLS = '35.0.1';
const PLATFORM = 35;
const MIN_SDK = 24;
const BUNDLETOOL = '1.18.1';
const SRC = path.join(PKG, 'android');
const KEYS = path.join(PKG, 'keys');
const ALIAS = 'nezos';

async function sdk() {
  const cache = path.join(WORK, 'cache');
  const bt = path.join(WORK, 'android-sdk', 'build-tools');
  const pf = path.join(WORK, 'android-sdk', 'platform');
  if (!fs.existsSync(path.join(bt, 'aapt2'))) {
    const zip = await download(`https://dl.google.com/android/repository/build-tools_r${BUILD_TOOLS}_linux.zip`, path.join(cache, `build-tools-${BUILD_TOOLS}.zip`));
    fresh(bt);
    run('unzip', ['-qo', zip, '-d', bt]);
    const inner = fs.readdirSync(bt)[0]; // zip has one top-level folder
    for (const f of fs.readdirSync(path.join(bt, inner))) fs.renameSync(path.join(bt, inner, f), path.join(bt, f));
  }
  if (!fs.existsSync(path.join(pf, 'android.jar'))) {
    const zip = await download(`https://dl.google.com/android/repository/platform-${PLATFORM}_r02.zip`, path.join(cache, `platform-${PLATFORM}.zip`));
    fresh(pf);
    run('unzip', ['-qo', zip, '-d', pf]);
    const inner = fs.readdirSync(pf)[0];
    for (const f of fs.readdirSync(path.join(pf, inner))) fs.renameSync(path.join(pf, inner, f), path.join(pf, f));
  }
  const bundletool = await download(`https://github.com/google/bundletool/releases/download/${BUNDLETOOL}/bundletool-all-${BUNDLETOOL}.jar`, path.join(cache, `bundletool-all-${BUNDLETOOL}.jar`));
  return {
    aapt2: path.join(bt, 'aapt2'),
    d8: path.join(bt, 'd8'),
    zipalign: path.join(bt, 'zipalign'),
    apksigner: path.join(bt, 'apksigner'),
    androidJar: path.join(pf, 'android.jar'),
    bundletool,
  };
}

/** Release signing key: reused if present (keep it to publish updates). */
function keystore() {
  const ks = path.join(KEYS, 'nezos-release.jks');
  const passFile = path.join(KEYS, 'password.txt');
  if (!fs.existsSync(ks)) {
    fs.mkdirSync(KEYS, { recursive: true });
    const pass = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
    fs.writeFileSync(passFile, pass);
    log('generating signing key', ks);
    run('keytool', ['-genkeypair', '-keystore', ks, '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
      '-storepass', pass, '-keypass', pass, '-dname', 'CN=Nezos, O=Nezos, C=SE'], { quiet: true });
  }
  return { ks, pass: fs.readFileSync(passFile, 'utf8').trim() };
}

export async function buildAndroid(html, outDir) {
  const t = await sdk();
  const key = keystore();
  const w = fresh(path.join(WORK, 'android'));

  // resources: launcher icons + theme
  const res = path.join(w, 'res');
  fs.cpSync(path.join(SRC, 'res'), res, { recursive: true });
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    fs.mkdirSync(path.join(res, `mipmap-${d}`), { recursive: true });
    fs.copyFileSync(path.join(ICONS, `android-${d}.png`), path.join(res, `mipmap-${d}`, 'ic_launcher.png'));
  }
  const assets = path.join(w, 'assets');
  fs.mkdirSync(assets);
  fs.writeFileSync(path.join(assets, 'index.html'), html);

  log('aapt2 compile');
  run(t.aapt2, ['compile', '--dir', res, '-o', path.join(w, 'res.zip')], { quiet: true });
  const [major] = VERSION.split('.');
  const versionCode = String(Number(major) * 10000 + Number(VERSION.split('.')[1]) * 100 + Number(VERSION.split('.')[2]));
  const link = (out, extra = []) => run(t.aapt2, ['link', '-o', out, '-I', t.androidJar, '--manifest', path.join(SRC, 'AndroidManifest.xml'),
    '-A', assets, '--min-sdk-version', String(MIN_SDK), '--target-sdk-version', String(PLATFORM),
    '--version-code', versionCode, '--version-name', VERSION, '--rename-manifest-package', APP_ID, '--auto-add-overlay',
    ...extra, path.join(w, 'res.zip')], { quiet: true });

  log('javac + d8');
  const classes = fresh(path.join(w, 'classes'));
  const sources = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.java')) sources.push(p); } })(path.join(SRC, 'src'));
  run('javac', ['-source', '8', '-target', '8', '-Xlint:-options', '-bootclasspath', t.androidJar, '-cp', t.androidJar, '-d', classes, ...sources], { quiet: true });
  const classFiles = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else classFiles.push(p); } })(classes);
  const dex = fresh(path.join(w, 'dex'));
  run(t.d8, ['--release', '--min-api', String(MIN_SDK), '--lib', t.androidJar, '--output', dex, ...classFiles], { quiet: true });

  // ---- APK
  log('apk');
  const unsigned = path.join(w, 'unsigned.apk');
  link(unsigned);
  run('zip', ['-qj', unsigned, path.join(dex, 'classes.dex')]);
  const aligned = path.join(w, 'aligned.apk');
  run(t.zipalign, ['-p', '-f', '4', unsigned, aligned]);
  const apk = path.join(outDir, `Nezos-${VERSION}.apk`);
  run(t.apksigner, ['sign', '--ks', key.ks, '--ks-key-alias', ALIAS, '--ks-pass', `pass:${key.pass}`, '--key-pass', `pass:${key.pass}`, '--out', apk, aligned], { quiet: true });
  fs.rmSync(`${apk}.idsig`, { force: true });

  // ---- AAB (Play Store)
  log('aab');
  const proto = path.join(w, 'proto.apk');
  link(proto, ['--proto-format']);
  const mod = fresh(path.join(w, 'module'));
  run('unzip', ['-qo', proto, '-d', mod]);
  fs.mkdirSync(path.join(mod, 'manifest'));
  fs.renameSync(path.join(mod, 'AndroidManifest.xml'), path.join(mod, 'manifest/AndroidManifest.xml'));
  fs.mkdirSync(path.join(mod, 'dex'));
  fs.copyFileSync(path.join(dex, 'classes.dex'), path.join(mod, 'dex/classes.dex'));
  const baseZip = path.join(w, 'base.zip');
  run('zip', ['-qr', baseZip, '.'], { cwd: mod });
  const aab = path.join(outDir, `Nezos-${VERSION}.aab`);
  fs.rmSync(aab, { force: true });
  run('java', ['-jar', t.bundletool, 'build-bundle', `--modules=${baseZip}`, `--output=${aab}`], { quiet: true });
  run('jarsigner', ['-keystore', key.ks, '-storepass', key.pass, '-keypass', key.pass, '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', aab, ALIAS], { quiet: true });

  return { apk, aab, tools: t, key };
}
