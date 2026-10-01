// Trims files BFDI Talk never uses so each installer stays under GitHub's 100 MB file limit
// (the builds are committed to the repo). DirectX shader compilers are only needed for WebGPU.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  for (const f of ['dxcompiler.dll', 'dxil.dll']) {
    const p = path.join(context.appOutDir, f);
    if (fs.existsSync(p)) fs.rmSync(p);
  }
};
