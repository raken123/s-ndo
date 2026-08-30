#!/usr/bin/env python3
"""
Standalone Blender .blend inspector -- requires no Blender install.

Decompresses the zstd container through the system libzstd and walks the SDNA
(the self-describing struct table Blender writes into every file), so it can
report what is inside a .blend on a machine that cannot run Blender at all.

    python3 blend_inspect.py path/to/file.blend

Understands the Blender 5.0 container: a 17-byte header
(`BLENDER` + header size + pointer-size char + flags + `v` + 4-digit version)
followed by 32-byte block headers laid out as

    code[4]  sdna_index:u32  old_pointer:u64  length:u64  count:u64
"""

import ctypes
import mmap
import os
import re
import struct
import sys
import tempfile


# --------------------------------------------------------------------------
# zstd container
# --------------------------------------------------------------------------

class _Buf(ctypes.Structure):
    _fields_ = [("src", ctypes.c_void_p), ("size", ctypes.c_size_t), ("pos", ctypes.c_size_t)]


def zstd_decompress(path, out_path):
    """Stream-decompress a (possibly multi-frame) zstd file via libzstd."""
    for name in ("libzstd.so.1", "libzstd.so", "libzstd.1.dylib", "libzstd.dylib"):
        try:
            z = ctypes.CDLL(name)
            break
        except OSError:
            continue
    else:
        raise SystemExit("libzstd not found -- cannot decompress this .blend")

    z.ZSTD_createDStream.restype = ctypes.c_void_p
    z.ZSTD_initDStream.argtypes = [ctypes.c_void_p]
    z.ZSTD_initDStream.restype = ctypes.c_size_t
    z.ZSTD_decompressStream.argtypes = [ctypes.c_void_p, ctypes.POINTER(_Buf), ctypes.POINTER(_Buf)]
    z.ZSTD_decompressStream.restype = ctypes.c_size_t
    z.ZSTD_isError.argtypes = [ctypes.c_size_t]
    z.ZSTD_isError.restype = ctypes.c_uint
    z.ZSTD_getErrorName.argtypes = [ctypes.c_size_t]
    z.ZSTD_getErrorName.restype = ctypes.c_char_p
    z.ZSTD_DStreamOutSize.restype = ctypes.c_size_t

    data = open(path, "rb").read()
    ds = z.ZSTD_createDStream()
    z.ZSTD_initDStream(ds)
    osz = z.ZSTD_DStreamOutSize()
    ob = ctypes.create_string_buffer(osz)
    sb = ctypes.create_string_buffer(data, len(data))
    src = _Buf(ctypes.cast(sb, ctypes.c_void_p), len(data), 0)

    with open(out_path, "wb") as fh:
        while src.pos < src.size:
            dst = _Buf(ctypes.cast(ob, ctypes.c_void_p), osz, 0)
            r = z.ZSTD_decompressStream(ds, ctypes.byref(dst), ctypes.byref(src))
            if z.ZSTD_isError(r):
                raise SystemExit("zstd: " + z.ZSTD_getErrorName(r).decode())
            fh.write(ob.raw[:dst.pos])
            if r == 0:
                z.ZSTD_initDStream(ds)      # concatenated frame
    return out_path


# --------------------------------------------------------------------------
# blend / SDNA
# --------------------------------------------------------------------------

class Blend:
    def __init__(self, path):
        self.fh = open(path, "rb")
        self.mm = mmap.mmap(self.fh.fileno(), 0, access=mmap.ACCESS_READ)
        if self.mm[:7] != b"BLENDER":
            raise SystemExit("not an uncompressed .blend")
        self.version = self.mm[13:17].decode("ascii", "replace")
        self.blocks = []
        self.by_old = {}
        self._scan()
        self._dna()

    def _scan(self):
        mm, n, p = self.mm, len(self.mm), 17
        while p + 32 <= n:
            code = mm[p:p + 4].rstrip(b"\0")
            if code == b"ENDB":
                break
            sdna, = struct.unpack_from("<I", mm, p + 4)
            old, = struct.unpack_from("<Q", mm, p + 8)
            ln, = struct.unpack_from("<Q", mm, p + 16)
            cnt, = struct.unpack_from("<Q", mm, p + 24)
            blk = (code, sdna, old, p + 32, ln, cnt)
            self.blocks.append(blk)
            self.by_old[old] = blk
            p += 32 + ln

    def _dna(self):
        d = next((self.mm[b[3]:b[3] + b[4]] for b in self.blocks if b[0] == b"DNA1"), None)
        if not d or d[:8] != b"SDNANAME":
            raise SystemExit("no SDNA block")
        o = 8
        n, = struct.unpack_from("<I", d, o); o += 4
        names = []
        for _ in range(n):
            e = d.index(b"\0", o); names.append(d[o:e].decode()); o = e + 1
        o = (o + 3) & ~3
        o += 4
        nt, = struct.unpack_from("<I", d, o); o += 4
        types = []
        for _ in range(nt):
            e = d.index(b"\0", o); types.append(d[o:e].decode()); o = e + 1
        o = (o + 3) & ~3
        o += 4
        tlens = list(struct.unpack_from("<%dH" % nt, d, o)); o += 2 * nt
        o = (o + 3) & ~3
        o += 4
        ns, = struct.unpack_from("<I", d, o); o += 4
        structs = []
        for _ in range(ns):
            ti, nf = struct.unpack_from("<2H", d, o); o += 4
            f = list(struct.unpack_from("<%dH" % (2 * nf), d, o)); o += 4 * nf
            structs.append((ti, [(f[i], f[i + 1]) for i in range(0, 2 * nf, 2)]))
        self.names, self.types, self.tlens, self.structs = names, types, tlens, structs
        self.sname = {types[s[0]]: i for i, s in enumerate(structs)}

    def fields(self, sidx):
        off = 0
        for ti, ni in self.structs[sidx][1]:
            nm, tn = self.names[ni], self.types[ti]
            sz = 8 if nm.startswith("*") else self.tlens[ti]
            for m in re.findall(r"\[(\d+)\]", nm):
                sz *= int(m)
            yield nm, tn, off, sz
            off += sz

    def fmap(self, sname):
        return {n: (t, o, s) for n, t, o, s in self.fields(self.sname[sname])}

    def field(self, blk, name):
        for nm, tn, off, sz in self.fields(blk[1]):
            if nm.lstrip("*").split("[")[0] == name:
                return self.mm[blk[3] + off:blk[3] + off + sz], tn
        return None, None

    def ptr(self, blk, name):
        raw, _ = self.field(blk, name)
        return struct.unpack("<Q", raw[:8])[0] if raw else 0

    def cstr_at(self, base, fm, key):
        _, o, s = fm[key]
        return self.mm[base + o:base + o + s].split(b"\0")[0].decode("utf-8", "replace")

    def idname(self, blk):
        raw, _ = self.field(blk, "id")
        if raw is None:
            return None
        fm = self.fmap("ID")
        k = next(k for k in fm if k.startswith("name["))
        _, o, s = fm[k]
        return raw[o:o + s].split(b"\0")[0].decode("utf-8", "replace")

    def listbase(self, blk, name, sname):
        """Walk a ListBase field, yielding (block, base_offset)."""
        raw, _ = self.field(blk, name)
        if raw is None:
            return
        p = struct.unpack_from("<Q", raw, 0)[0]
        fm = self.fmap(sname)
        seen = set()
        while p and p in self.by_old and p not in seen:
            seen.add(p)
            b = self.by_old[p]
            yield b, b[3]
            p = struct.unpack_from("<Q", self.mm, b[3] + fm["*next"][1])[0]


# --------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------

def report(b):
    from collections import Counter

    print(f"Blender version : {b.version}")
    print(f"data blocks     : {len(b.blocks)}")
    print(f"SDNA structs    : {len(b.structs)}")

    c = Counter(x[0].decode() for x in b.blocks)
    print("\n== datablocks ==")
    print("  " + ", ".join(f"{k}={v}" for k, v in sorted(c.items(), key=lambda t: -t[1])))

    # scene
    sc = next((x for x in b.blocks if x[0] == b"SC"), None)
    if sc:
        raw, _ = b.field(sc, "r")
        rm = b.fmap("RenderData")
        g = lambda k, f: struct.unpack_from(f, raw, rm[k][1])[0]
        print("\n== scene ==")
        print(f"  frames {g('sfra','<i')}-{g('efra','<i')} @ {g('frs_sec','<h')} fps"
              f"  {g('xsch','<i')}x{g('ysch','<i')} @ {g('size','<h')}%")

    # objects
    T = {0: "EMPTY", 1: "MESH", 2: "CURVE", 4: "FONT", 10: "LIGHT",
         11: "CAMERA", 12: "SPEAKER", 22: "LATTICE", 25: "ARMATURE"}
    om = b.fmap("Object")
    tc = Counter()
    for x in (y for y in b.blocks if y[0] == b"OB"):
        tc[struct.unpack_from("<h", b.mm, x[3] + om["type"][1])[0]] += 1
    print("\n== objects ==")
    print("  " + ", ".join(f"{T.get(k,k)}={v}" for k, v in sorted(tc.items())))

    # armatures
    bm = b.fmap("Bone")
    bk = next(k for k in bm if k.startswith("name["))
    print("\n== armatures ==")
    for ar in (y for y in b.blocks if y[0] == b"AR"):
        names = []

        def walk(p):
            seen = set()
            while p and p in b.by_old and p not in seen:
                seen.add(p)
                blk = b.by_old[p]
                names.append(b.cstr_at(blk[3], bm, bk))
                ch = struct.unpack_from("<Q", b.mm, blk[3] + bm["childbase"][1])[0]
                if ch:
                    walk(ch)
                p = struct.unpack_from("<Q", b.mm, blk[3] + bm["*next"][1])[0]

        raw, _ = b.field(ar, "bonebase")
        walk(struct.unpack_from("<Q", raw, 0)[0])
        ctrl = [n for n in names if not n.startswith(("MCH-", "ORG-", "DEF-"))]
        print(f"  {b.idname(ar):16s} {len(names):4d} bones ({len(ctrl)} controls)")

    # shape keys
    print("\n== shape keys ==")
    km = b.fmap("KeyBlock")
    kk = next(k for k in km if k.startswith("name["))
    any_key = False
    for ke in (y for y in b.blocks if y[0] == b"KE"):
        any_key = True
        nm = [b.cstr_at(base, km, kk) for _, base in b.listbase(ke, "block", "KeyBlock")]
        print(f"  {b.idname(ke):14s} {nm}")
    if not any_key:
        print("  (none)")

    # actions
    print("\n== actions ==")
    acts = [b.idname(x) for x in b.blocks if x[0] == b"AC"]
    print("  " + ", ".join(acts) if acts else "  (none)")

    # slider limits
    print("\n== slider Limit Location ranges ==")
    pm, cm = b.fmap("bPoseChannel"), b.fmap("bConstraint")
    lm = b.fmap("bLocLimitConstraint")
    pk = next(k for k in pm if k.startswith("name["))
    for ob in (y for y in b.blocks if y[0] == b"OB"):
        pose = b.by_old.get(b.ptr(ob, "pose"))
        if not pose:
            continue
        for blk, base in b.listbase(pose, "chanbase", "bPoseChannel"):
            nm = b.cstr_at(base, pm, pk)
            if "Slider" not in nm:
                continue
            for cb, cbase in b.listbase(blk, "constraints", "bConstraint"):
                if struct.unpack_from("<h", b.mm, cbase + cm["type"][1])[0] != 6:
                    continue
                db = b.by_old.get(struct.unpack_from("<Q", b.mm, cbase + cm["*data"][1])[0])
                if not db:
                    continue
                v = {k: round(struct.unpack_from("<f", b.mm, db[3] + lm[k][1])[0], 4)
                     for k in ("xmin", "xmax", "ymin", "ymax", "zmin", "zmax")}
                print(f"  {b.idname(ob)}/{nm:20s} x[{v['xmin']},{v['xmax']}] "
                      f"y[{v['ymin']},{v['ymax']}] z[{v['zmin']},{v['zmax']}]")
        break

    # audio
    print("\n== audio ==")
    sounds = [x for x in b.blocks if x[0] == b"SO"]
    speakers = tc.get(12, 0)
    sigs = {b"OggS": "ogg", b"ID3": "mp3", b"fLaC": "flac", b"ftypM4A": "m4a"}
    hits = {n: b.mm.find(p) for p, n in sigs.items()}
    hits["wav"] = -1 if not re.search(rb"RIFF....WAVE", b.mm, re.S) else 1
    paths = set(m.group(0).decode("ascii", "replace") for m in
                re.finditer(rb"[\x20-\x7e]{3,120}\.(mp3|wav|ogg|flac|aac|m4a|opus)\b",
                            b.mm, re.I))
    print(f"  bSound datablocks : {len(sounds)}")
    print(f"  Speaker objects   : {speakers}")
    present = {k: v for k, v in hits.items() if v != -1}
    print(f"  audio signatures  : {present or 'none'}")
    print(f"  audio filepaths   : {sorted(paths) if paths else 'none'}")
    if not sounds and not speakers and not paths:
        print("  -> this file contains NO audio")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = sys.argv[1]
    head = open(src, "rb").read(4)
    tmp = None
    try:
        if head == b"\x28\xb5\x2f\xfd":
            tmp = tempfile.NamedTemporaryFile(suffix=".blend", delete=False).name
            print(f"zstd container -> decompressing ...")
            zstd_decompress(src, tmp)
            print(f"  {os.path.getsize(tmp):,} bytes\n")
            src = tmp
        report(Blend(src))
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)


if __name__ == "__main__":
    main()
