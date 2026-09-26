// Minimal ZIP reader (stored + deflate, no encryption) for Godot downloads.
// Godot's release zips and the export-template .tpz are plain zips.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function findEOCD(fd, size) {
  const len = Math.min(size, 65557), buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, size - len);
  for (let i = len - 22; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) return { buf, i, base: size - len };
  throw new Error('not a zip file');
}

function entries(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const { buf, i } = findEOCD(fd, size);
    let count = buf.readUInt16LE(i + 10), cdSize = buf.readUInt32LE(i + 12), cdOff = buf.readUInt32LE(i + 16);
    if (cdOff === 0xffffffff || count === 0xffff) {
      // ZIP64 end of central directory
      const loc = Buffer.alloc(20);
      fs.readSync(fd, loc, 0, 20, size - (buf.length - i) - 20);
      const z64 = Buffer.alloc(56);
      fs.readSync(fd, z64, 0, 56, Number(loc.readBigUInt64LE(8)));
      count = Number(z64.readBigUInt64LE(32)); cdSize = Number(z64.readBigUInt64LE(40)); cdOff = Number(z64.readBigUInt64LE(48));
    }
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdOff);
    const out = [];
    for (let p = 0, n = 0; n < count; n++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
      const method = cd.readUInt16LE(p + 10), nameLen = cd.readUInt16LE(p + 28), extraLen = cd.readUInt16LE(p + 30), commentLen = cd.readUInt16LE(p + 32);
      let comp = cd.readUInt32LE(p + 20), uncomp = cd.readUInt32LE(p + 24), local = cd.readUInt32LE(p + 42);
      const attr = cd.readUInt32LE(p + 38) >>> 16;
      const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
      // ZIP64 extra field
      for (let e = p + 46 + nameLen; e < p + 46 + nameLen + extraLen;) {
        const id = cd.readUInt16LE(e), sz = cd.readUInt16LE(e + 2);
        if (id === 1) {
          let q = e + 4;
          if (uncomp === 0xffffffff) { uncomp = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (comp === 0xffffffff) { comp = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (local === 0xffffffff) { local = Number(cd.readBigUInt64LE(q)); }
        }
        e += 4 + sz;
      }
      out.push({ name, method, comp, uncomp, local, mode: attr & 0o777, isLink: (attr & 0o170000) === 0o120000 });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  } finally { fs.closeSync(fd); }
}

// Extracts entries whose names pass filter(name) (default: all). rename(name) maps to a relative output path.
function extract(file, dest, opts) {
  opts = opts || {};
  const list = entries(file), fd = fs.openSync(file, 'r'), root = path.resolve(dest);
  let done = 0;
  try {
    for (const e of list) {
      if (opts.filter && !opts.filter(e.name)) continue;
      const rel = opts.rename ? opts.rename(e.name) : e.name;
      if (!rel) continue;
      const out = path.resolve(root, rel);
      if (out !== root && !out.startsWith(root + path.sep)) throw new Error('unsafe path in zip: ' + e.name);
      if (e.name.endsWith('/')) { fs.mkdirSync(out, { recursive: true }); continue; }
      const head = Buffer.alloc(30);
      fs.readSync(fd, head, 0, 30, e.local);
      const start = e.local + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
      const data = Buffer.alloc(e.comp);
      fs.readSync(fd, data, 0, e.comp, start);
      const body = e.method === 0 ? data : e.method === 8 ? zlib.inflateRawSync(data) : null;
      if (!body) throw new Error('unsupported compression in ' + e.name);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      if (e.isLink && process.platform !== 'win32') { try { fs.unlinkSync(out); } catch (x) { /* none */ } fs.symlinkSync(body.toString('utf8'), out); }
      else fs.writeFileSync(out, body, { mode: e.mode || 0o644 });
      if (opts.progress) opts.progress(++done, list.length, e.name);
    }
  } finally { fs.closeSync(fd); }
  return list.length;
}

module.exports = { entries, extract };
