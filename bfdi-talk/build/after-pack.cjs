// Trims files BFDI Talk never uses so each installer stays under GitHub's 100 MB file limit
// (the builds are committed to the repo). Runs before code signing.
//  - Windows: DirectX shader compilers, only needed for WebGPU.
//  - macOS: SwiftShader, Chromium's software-GPU fallback; Macs render with Metal and the
//    app draws with SVG/CSS only (no WebGL).
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const out = context.appOutDir;
  let files = [];
  if (context.electronPlatformName === 'win32') {
    files = ['dxcompiler.dll', 'dxil.dll'].map(f => path.join(out, f));
  } else if (context.electronPlatformName === 'darwin') {
    const libs = path.join(out, `${context.packager.appInfo.productFilename}.app`,
      'Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries');
    files = ['libvk_swiftshader.dylib', 'vk_swiftshader_icd.json'].map(f => path.join(libs, f));
  }
  for (const p of files) if (fs.existsSync(p)) fs.rmSync(p);
};
