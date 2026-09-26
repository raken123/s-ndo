/*
 * Minimal ZIP container support for .RAS packages.
 * Reading supports stored (0) and deflate (8) entries; deflate uses the
 * platform DecompressionStream. Writing produces stored entries, which keeps
 * package output byte-for-byte reproducible.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Compressed RAS entries are not supported on this platform');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Find the End Of Central Directory record.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a RAS package: missing ZIP directory');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('Corrupt RAS package: bad directory entry');
    const method = dv.getUint16(off + 10, true);
    const crc = dv.getUint32(off + 16, true);
    const csize = dv.getUint32(off + 20, true);
    const usize = dv.getUint32(off + 24, true);
    const nlen = dv.getUint16(off + 28, true);
    const xlen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nlen));
    off += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    if (name.includes('..') || name.startsWith('/') || name.includes('\\')) throw new Error(`Rejected unsafe path in package: ${name}`);
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('Corrupt RAS package: bad local header');
    const lnlen = dv.getUint16(lho + 26, true);
    const lxlen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lxlen;
    const raw = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`Unsupported compression method ${method} for ${name}`);
    if (data.length !== usize) throw new Error(`Corrupt RAS package: size mismatch for ${name}`);
    if (crc32(data) !== crc) throw new Error(`Corrupt RAS package: checksum mismatch for ${name}`);
    files.set(name, data);
  }
  return files;
}

export function writeZip(entries) {
  // entries: Array<[name, Uint8Array]>, written in the given order.
  const enc = new TextEncoder();
  const locals = []; const centrals = []; let offset = 0;
  const DOS_TIME = 0; const DOS_DATE = (2026 - 1980) << 9 | 3 << 5 | 1; // fixed for reproducible output
  for (const [name, data] of entries) {
    const n = enc.encode(name); const crc = crc32(data);
    const lh = new Uint8Array(30 + n.length); const ldv = new DataView(lh.buffer);
    ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(4, 20, true); ldv.setUint16(6, 0x0800, true); ldv.setUint16(8, 0, true);
    ldv.setUint16(10, DOS_TIME, true); ldv.setUint16(12, DOS_DATE, true);
    ldv.setUint32(14, crc, true); ldv.setUint32(18, data.length, true); ldv.setUint32(22, data.length, true);
    ldv.setUint16(26, n.length, true); ldv.setUint16(28, 0, true); lh.set(n, 30);
    const ch = new Uint8Array(46 + n.length); const cdv = new DataView(ch.buffer);
    cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(4, 20, true); cdv.setUint16(6, 20, true); cdv.setUint16(8, 0x0800, true);
    cdv.setUint16(10, 0, true); cdv.setUint16(12, DOS_TIME, true); cdv.setUint16(14, DOS_DATE, true);
    cdv.setUint32(16, crc, true); cdv.setUint32(20, data.length, true); cdv.setUint32(24, data.length, true);
    cdv.setUint16(28, n.length, true); cdv.setUint32(42, offset, true); ch.set(n, 46);
    locals.push(lh, data); centrals.push(ch); offset += lh.length + data.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22); const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, entries.length, true); edv.setUint16(10, entries.length, true);
  edv.setUint32(12, cdSize, true); edv.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
