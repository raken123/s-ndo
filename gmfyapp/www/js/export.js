/* gmfy — export a game as a buildable Cordova (Android) or Electron (desktop)
 * project, as a .zip you download and build on a computer.
 *
 * SCOPE: phones have no Android SDK / Gradle / Node, so nothing is compiled
 * here. What you get is a complete project tree — sources, config, manifest and
 * every icon size — plus the one command that turns it into an APK or an .exe.
 */
(function (global) {
  'use strict';

  /* ---------------- minimal ZIP writer (store, no compression) ------------ */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    if (global.TextEncoder) return new TextEncoder().encode(str);
    var out = [], s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return new Uint8Array(out);
  }

  function w16(a, o, v) { a[o] = v & 255; a[o + 1] = (v >>> 8) & 255; }
  function w32(a, o, v) { w16(a, o, v & 0xFFFF); w16(a, o + 2, (v >>> 16) & 0xFFFF); }

  /* files: [{name, data:Uint8Array}] -> Blob */
  function zip(files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = f.data, sum = crc32(data);
      var lh = new Uint8Array(30 + name.length);
      w32(lh, 0, 0x04034b50); w16(lh, 4, 20); w16(lh, 6, 0); w16(lh, 8, 0);
      w16(lh, 10, 0); w16(lh, 12, 0);
      w32(lh, 14, sum); w32(lh, 18, data.length); w32(lh, 22, data.length);
      w16(lh, 26, name.length); w16(lh, 28, 0);
      lh.set(name, 30);
      chunks.push(lh, data);

      var cd = new Uint8Array(46 + name.length);
      w32(cd, 0, 0x02014b50); w16(cd, 4, 20); w16(cd, 6, 20); w16(cd, 8, 0);
      w16(cd, 10, 0); w16(cd, 12, 0); w16(cd, 14, 0);
      w32(cd, 16, sum); w32(cd, 20, data.length); w32(cd, 24, data.length);
      w16(cd, 28, name.length); w16(cd, 30, 0); w16(cd, 32, 0);
      w16(cd, 34, 0); w16(cd, 36, 0); w32(cd, 38, 0);
      w32(cd, 42, offset);
      cd.set(name, 46);
      central.push(cd);
      offset += lh.length + data.length;
    });

    var cdSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var eocd = new Uint8Array(22);
    w32(eocd, 0, 0x06054b50); w16(eocd, 4, 0); w16(eocd, 6, 0);
    w16(eocd, 8, files.length); w16(eocd, 10, files.length);
    w32(eocd, 12, cdSize); w32(eocd, 16, offset); w16(eocd, 20, 0);

    return new Blob(chunks.concat(central).concat([eocd]), { type: 'application/zip' });
  }

  /* ---------------- icon handling ---------------- */
  function dataURLtoBytes(url) {
    var b64 = url.split(',')[1];
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* draw src (Image) into a size x size PNG, cover-cropped */
  function iconAt(srcImg, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var x = c.getContext('2d');
    if (srcImg) {
      var s = Math.min(srcImg.width, srcImg.height);
      x.drawImage(srcImg, (srcImg.width - s) / 2, (srcImg.height - s) / 2, s, s,
                  0, 0, size, size);
    } else {
      // fall back to the gmfy mark
      var g = x.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#7c5cff'); g.addColorStop(1, '#22d3ee');
      x.fillStyle = g; x.fillRect(0, 0, size, size);
      x.fillStyle = '#fff';
      x.font = 'bold ' + Math.round(size * 0.66) + 'px -apple-system,Roboto,sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('g', size / 2, size * 0.54);
    }
    return dataURLtoBytes(c.toDataURL('image/png'));
  }

  /* ---------------- the standalone player ---------------- */
  function playerHTML(name) {
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n' +
      '<title>' + esc(name) + '</title>\n<style>\n' +
      '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}\n' +
      'html,body{height:100%;overflow:hidden;background:#05060a}\n' +
      'body{display:flex;flex-direction:column;font-family:-apple-system,Roboto,sans-serif;user-select:none}\n' +
      '#c{flex:1;width:100%;display:block;touch-action:none}\n' +
      '#pad{position:fixed;right:14px;bottom:14px;display:grid;gap:6px;' +
      'grid-template-columns:repeat(3,52px);grid-template-rows:repeat(2,52px)}\n' +
      '#pad button{background:rgba(8,10,18,.55);border:1px solid rgba(255,255,255,.25);' +
      'color:#fff;border-radius:12px;font-size:18px}\n' +
      '#again{position:fixed;left:14px;bottom:14px;border:none;border-radius:12px;' +
      'padding:12px 20px;font-size:15px;font-weight:700;background:#3ddc84;color:#062012}\n' +
      '</style>\n</head>\n<body>\n<canvas id="c"></canvas>\n' +
      '<button id="again">Restart</button>\n<div id="pad">' +
      '<button style="grid-column:2;grid-row:1" data-k="f">&#9650;</button>' +
      '<button style="grid-column:1;grid-row:2" data-k="l">&#9664;</button>' +
      '<button style="grid-column:2;grid-row:2" data-k="b">&#9660;</button>' +
      '<button style="grid-column:3;grid-row:2" data-k="r">&#9654;</button></div>\n' +
      '<script src="game.json.js"><\/script>\n<script src="engine.js"><\/script>\n' +
      '<script src="game.js"><\/script>\n<script src="blocks.js"><\/script>\n' +
      '<script src="player.js"><\/script>\n</body>\n</html>\n';
  }

  var PLAYER_JS =
    "(function(){'use strict';\n" +
    "var D=window.GMFY_GAME||{};\n" +
    "var cv=document.getElementById('c');\n" +
    "var eng=new window.Gmfy.Engine(cv);\n" +
    "var w=window.Gmfy.worldFromSpec({biome:(D.world||{}).biomeKey,props:(D.world||{}).props,\n" +
    "  relief:(D.world||{}).relief},'export');\n" +
    "eng.load(w);\n" +
    "var game=new window.GmfyGame(eng,function(ev){ if(blk.running) blk.fire(ev); });\n" +
    "var blk=new window.GmfyBlocks(eng,game,function(){});\n" +
    "if(D.script&&D.script.length) blk.script=D.script;\n" +
    "var held=null;\n" +
    "Array.prototype.forEach.call(document.querySelectorAll('#pad button'),function(b){\n" +
    " var k=b.getAttribute('data-k');\n" +
    " b.addEventListener('pointerdown',function(e){e.preventDefault();held=k;});\n" +
    " ['pointerup','pointerleave','pointercancel'].forEach(function(ev){\n" +
    "  b.addEventListener(ev,function(){ if(held===k) held=null; });});});\n" +
    "var drag=null;\n" +
    "cv.addEventListener('pointerdown',function(e){drag={x:e.clientX,y:e.clientY};" +
    "cv.setPointerCapture(e.pointerId);});\n" +
    "cv.addEventListener('pointermove',function(e){ if(!drag)return;\n" +
    " eng.cam.yaw-=(e.clientX-drag.x)*0.006;\n" +
    " eng.cam.pitch=Math.max(-0.15,Math.min(0.75,eng.cam.pitch+(e.clientY-drag.y)*0.0035));\n" +
    " drag.x=e.clientX; drag.y=e.clientY;});\n" +
    "['pointerup','pointercancel'].forEach(function(ev){cv.addEventListener(ev,function(){drag=null;});});\n" +
    "function start(){ game.start(); blk.run(); }\n" +
    "document.getElementById('again').addEventListener('click',start);\n" +
    "window.addEventListener('resize',function(){eng.resize();});\n" +
    "var last=performance.now();\n" +
    "function loop(now){var dt=Math.min(0.05,(now-last)/1000);last=now;\n" +
    " if(held) eng.move(held,dt*1.4);\n" +
    " blk.tick(dt); game.tick(dt); eng.render(); game.draw(eng.ctx,eng.w,eng.h);\n" +
    " requestAnimationFrame(loop);}\n" +
    "eng.resize(); start(); requestAnimationFrame(loop);\n" +
    "})();\n";

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function slug(s) {
    return String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'game';
  }

  /* Pull the runtime sources straight out of this app.
     Desktop and single-file builds run from file://, where fetch() is blocked,
     so those builds embed the sources on window.GMFY_SRC at build time and we
     use them directly. Over http (Cordova's localhost, a dev server) we fetch. */
  var SRC_FILES = ['js/engine.js', 'js/game.js', 'js/blocks.js'];

  function runtime() {
    var pre = global.GMFY_SRC;
    if (pre) {
      var missing = SRC_FILES.filter(function (p) { return typeof pre[p] !== 'string'; });
      if (!missing.length) {
        return Promise.resolve(SRC_FILES.map(function (p) { return pre[p]; }));
      }
    }
    return Promise.all(SRC_FILES.map(function (p) {
      return fetch(p).then(function (r) {
        if (!r.ok) throw new Error(p);
        return r.text();
      });
    }));
  }

  /* ---------------- Cordova project ---------------- */
  var CDV_DENS = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

  function cordovaFiles(opts, src, iconImg) {
    var name = opts.name, id = opts.pkg, files = [];
    var icons = '';
    Object.keys(CDV_DENS).forEach(function (dens) {
      files.push({ name: 'res/icon/android/' + dens + '.png',
                   data: iconAt(iconImg, CDV_DENS[dens]) });
      icons += '        <icon density="' + dens + '" src="res/icon/android/' + dens + '.png" />\n';
    });

    var config =
      '<?xml version=\'1.0\' encoding=\'utf-8\'?>\n' +
      '<widget id="' + esc(id) + '" version="1.0.0" xmlns="http://www.w3.org/ns/widgets">\n' +
      '    <name>' + esc(name) + '</name>\n' +
      '    <description>A game built with gmfy.</description>\n' +
      '    <content src="index.html" />\n' +
      '    <preference name="Orientation" value="portrait" />\n' +
      '    <preference name="BackgroundColor" value="#FF05060A" />\n' +
      '    <platform name="android">\n' + icons + '    </platform>\n' +
      '</widget>\n';

    files.push({ name: 'config.xml', data: utf8(config) });
    files.push({ name: 'www/index.html', data: utf8(playerHTML(name)) });
    files.push({ name: 'www/engine.js', data: utf8(src[0]) });
    files.push({ name: 'www/game.js', data: utf8(src[1]) });
    files.push({ name: 'www/blocks.js', data: utf8(src[2]) });
    files.push({ name: 'www/player.js', data: utf8(PLAYER_JS) });
    files.push({ name: 'www/game.json.js',
                 data: utf8('window.GMFY_GAME = ' + JSON.stringify(opts.game) + ';\n') });
    files.push({ name: 'README.md', data: utf8(
      '# ' + name + '\n\nExported from gmfy as a Cordova project.\n\n' +
      '## Build an APK\n\n```bash\nnpm install -g cordova\ncordova platform add android\n' +
      'cordova build android\n```\n\nThe APK lands in\n' +
      '`platforms/android/app/build/outputs/apk/debug/`.\n\n' +
      'Needs a JDK, the Android SDK and Gradle on the machine you build on.\n\n' +
      '## Release build\n\n```bash\ncordova build android --release -- --packageType=bundle\n```\n') });
    return files;
  }

  /* ---------------- Electron project ---------------- */
  function electronFiles(opts, src, iconImg) {
    var name = opts.name, files = [];
    files.push({ name: 'build/icon.png', data: iconAt(iconImg, 512) });
    files.push({ name: 'assets/icon-256.png', data: iconAt(iconImg, 256) });

    var pkg = {
      name: slug(name), version: '1.0.0', description: 'A game built with gmfy.',
      main: 'main.js', scripts: { start: 'electron .', dist: 'electron-builder' },
      devDependencies: { electron: '^32.0.0', 'electron-builder': '^25.0.0' },
      build: { appId: opts.pkg, productName: name,
               files: ['main.js', 'renderer/**'],
               directories: { output: 'dist', buildResources: 'build' },
               win: { target: 'nsis' }, mac: { target: 'dmg' }, linux: { target: 'AppImage' } }
    };
    files.push({ name: 'package.json', data: utf8(JSON.stringify(pkg, null, 2) + '\n') });

    var main =
      "const { app, BrowserWindow } = require('electron');\n" +
      "const path = require('path');\n\n" +
      "function createWindow () {\n" +
      "  const win = new BrowserWindow({\n" +
      "    width: 520, height: 900, backgroundColor: '#05060a',\n" +
      "    title: " + JSON.stringify(name) + ",\n" +
      "    icon: path.join(__dirname, 'assets', 'icon-256.png'),\n" +
      "    webPreferences: { contextIsolation: true }\n" +
      "  });\n" +
      "  win.setMenuBarVisibility(false);\n" +
      "  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));\n" +
      "}\n\n" +
      "app.whenReady().then(() => {\n" +
      "  createWindow();\n" +
      "  app.on('activate', () => {\n" +
      "    if (BrowserWindow.getAllWindows().length === 0) createWindow();\n" +
      "  });\n" +
      "});\n\n" +
      "app.on('window-all-closed', () => {\n" +
      "  if (process.platform !== 'darwin') app.quit();\n" +
      "});\n";
    files.push({ name: 'main.js', data: utf8(main) });

    files.push({ name: 'renderer/index.html', data: utf8(playerHTML(name)) });
    files.push({ name: 'renderer/engine.js', data: utf8(src[0]) });
    files.push({ name: 'renderer/game.js', data: utf8(src[1]) });
    files.push({ name: 'renderer/blocks.js', data: utf8(src[2]) });
    files.push({ name: 'renderer/player.js', data: utf8(PLAYER_JS) });
    files.push({ name: 'renderer/game.json.js',
                 data: utf8('window.GMFY_GAME = ' + JSON.stringify(opts.game) + ';\n') });
    files.push({ name: 'README.md', data: utf8(
      '# ' + name + '\n\nExported from gmfy as an Electron app.\n\n' +
      '## Run it\n\n```bash\nnpm install\nnpm start\n```\n\n' +
      '## Build installers\n\n```bash\nnpm run dist\n```\n\n' +
      'Produces a Windows .exe, macOS .dmg or Linux AppImage in `dist/`,\n' +
      'depending on the machine you build on.\n') });
    return files;
  }

  /* ---------------- public API ---------------- */
  function build(target, opts, iconImg) {
    return runtime().then(function (src) {
      var files = (target === 'electron')
        ? electronFiles(opts, src, iconImg)
        : cordovaFiles(opts, src, iconImg);
      var blob = zip(files);
      return { blob: blob, count: files.length,
               filename: slug(opts.name) + '-' + target + '.zip' };
    });
  }

  function save(blob, filename) {
    try {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 4000);
      return true;
    } catch (e) { return false; }
  }

  global.GmfyExport = { build: build, save: save, zip: zip, iconAt: iconAt, slug: slug };
})(window);
