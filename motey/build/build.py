#!/usr/bin/env python3
"""Build Motey for every platform from the web app in motey/app.

    python3 motey/build/build.py all        # web + apk + exe + dmg
    python3 motey/build/build.py apk exe    # just some

Outputs land in motey/dist/:
    Motey.apk              Android 7+ (WebView shell, signed)
    Motey.exe              Windows 10/11 x64, one file (Neutralino + WebView2)
    Motey.dmg              macOS 10.15+, universal (Apple Silicon + Intel)
    motey.html             the whole app in one file, for any browser

Needs only Python 3, Java 17+, git and a C compiler with cmake (for the DMG
tool). Third-party tools are downloaded once into motey/build/.tools, pinned
by version and SHA-256.
"""
import base64, hashlib, io, json, os, plistlib, re, shutil, struct, subprocess, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP = os.path.join(ROOT, 'app')
ANDROID = os.path.join(ROOT, 'android')
DIST = os.path.join(ROOT, 'dist')
WORK = os.path.join(HERE, '.work')
TOOLS = os.environ.get('MOTEY_TOOLS', os.path.join(HERE, '.tools'))
ICONS = os.path.join(HERE, 'icons')

VERSION = '1.2.0'
APP_ID = 'se.motey.app'
PORT = 47391  # fixed so the desktop app keeps its localStorage between runs

DOWNLOADS = {
    'apktool.jar': ('https://github.com/iBotPeaches/Apktool/releases/download/v2.12.1/apktool_2.12.1.jar',
                    '66cf4524a4a45a7f56567d08b2c9b6ec237bcdd78cee69fd4a59c8a0243aeafa'),
    'uber-apk-signer.jar': ('https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar',
                            'e1299fd6fcf4da527dd53735b56127e8ea922a321128123b9c32d619bba1d835'),
    'neutralinojs.zip': ('https://github.com/neutralinojs/neutralinojs/releases/download/v6.3.0/neutralinojs-v6.3.0.zip',
                         '93acf0b426f1c6b1a57c7f7c41be45761f137576e6ab00214a1a5b586745f424'),
}
REPOS = {
    'pycdlib': ('https://github.com/clalancette/pycdlib', 'f1a7ebc84626f889eeec98b8cc1938d10b664f14'),
    'libdmg-hfsplus': ('https://github.com/fanquake/libdmg-hfsplus', '1cc791e4173da9cb0b0cc16c5a1aaa25d5eb5efa'),
}


def log(*a):
    print('[motey]', *a, flush=True)


def run(cmd, **kw):
    log('$', ' '.join(cmd))
    subprocess.run(cmd, check=True, **kw)


# ---------------------------------------------------------------- tools
def tool(name):
    os.makedirs(TOOLS, exist_ok=True)
    path = os.path.join(TOOLS, name)
    url, sha = DOWNLOADS[name]
    if not os.path.exists(path) or hashlib.sha256(open(path, 'rb').read()).hexdigest() != sha:
        log('downloading', url)
        data = urllib.request.urlopen(url, timeout=120).read()
        got = hashlib.sha256(data).hexdigest()
        if got != sha:
            sys.exit('checksum mismatch for %s: %s' % (name, got))
        open(path, 'wb').write(data)
    return path


def repo(name):
    url, rev = REPOS[name]
    path = os.path.join(TOOLS, name)
    if not os.path.isdir(os.path.join(path, '.git')):
        run(['git', 'clone', '-q', url, path])
    if subprocess.run(['git', '-C', path, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip() != rev:
        run(['git', '-C', path, 'fetch', '-q', 'origin', rev])
        run(['git', '-C', path, 'checkout', '-q', rev])
    return path


def neutralino(binary):
    z = zipfile.ZipFile(tool('neutralinojs.zip'))
    return z.read(binary)


# ---------------------------------------------------------------- web
def web_files():
    """Every file of the web app as {relative path: bytes}."""
    out = {}
    for base, _, files in os.walk(APP):
        for f in sorted(files):
            p = os.path.join(base, f)
            out[os.path.relpath(p, APP).replace(os.sep, '/')] = open(p, 'rb').read()
    return out


def build_html():
    """motey.html: the whole app inlined into one file."""
    files = web_files()
    html = files['index.html'].decode()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>\n' + files[m.group(1)].decode() + '\n</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '<script>\n' + files[m.group(1)].decode().replace('</script', '<\\/script') + '\n</script>', html)
    icon = base64.b64encode(files['img/icon-192.png']).decode()
    html = html.replace('href="img/icon-192.png"', 'href="data:image/png;base64,' + icon + '"')
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'motey.html')
    open(out, 'w', encoding='utf-8').write(html)
    log('wrote', out, '%.0f KB' % (os.path.getsize(out) / 1024))
    return out


# ---------------------------------------------------------------- android
def build_apk():
    w = os.path.join(WORK, 'android')
    shutil.rmtree(w, ignore_errors=True)
    shutil.copytree(ANDROID, w)
    for rel, data in web_files().items():
        p = os.path.join(w, 'assets', 'www', rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, 'wb').write(data)
    for dpi, size in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
        d = os.path.join(w, 'res', 'mipmap-' + dpi)
        os.makedirs(d, exist_ok=True)
        shutil.copy(os.path.join(ICONS, 'full-%d.png' % size), os.path.join(d, 'ic_launcher.png'))
    unsigned = os.path.join(WORK, 'Motey-unsigned.apk')
    run(['java', '-jar', tool('apktool.jar'), 'b', w, '-p', os.path.join(WORK, 'framework'), '-o', unsigned, '-f'])
    ks = os.path.join(HERE, 'keystore', 'motey-sideload.jks')
    if not os.path.exists(ks):
        os.makedirs(os.path.dirname(ks), exist_ok=True)
        run(['keytool', '-genkeypair', '-keystore', ks, '-alias', 'motey', '-keyalg', 'RSA', '-keysize', '3072',
             '-validity', '10000', '-storepass', 'motey-sideload', '-keypass', 'motey-sideload',
             '-dname', 'CN=Motey, O=Motey, C=SE'])
    signed_dir = os.path.join(WORK, 'signed')
    shutil.rmtree(signed_dir, ignore_errors=True)
    run(['java', '-jar', tool('uber-apk-signer.jar'), '-a', unsigned, '-o', signed_dir,
         '--ks', ks, '--ksAlias', 'motey', '--ksPass', 'motey-sideload', '--ksKeyPass', 'motey-sideload'])
    apk = [f for f in os.listdir(signed_dir) if f.endswith('.apk')][0]
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'Motey.apk')
    shutil.copy(os.path.join(signed_dir, apk), out)
    log('wrote', out, '%.1f MB' % (os.path.getsize(out) / 1e6))
    return out


# ---------------------------------------------------------------- desktop payload
def neutralino_config():
    return {
        'applicationId': APP_ID, 'version': VERSION, 'defaultMode': 'window',
        'port': PORT, 'documentRoot': '/www/', 'url': '/', 'enableServer': True, 'enableNativeAPI': True,
        'tokenSecurity': 'one-time', 'dataLocation': 'system',
        'logging': {'enabled': False, 'writeToLogFile': False},
        'nativeAllowList': ['os.showSaveDialog', 'filesystem.writeBinaryFile', 'os.open', 'os.showNotification', 'app.exit'],
        'globalVariables': {},
        'modes': {'window': {
            'title': 'Motey', 'width': 1180, 'height': 820, 'minWidth': 400, 'minHeight': 600,
            'center': True, 'icon': '/www/img/icon-512.png', 'resizable': True, 'enableInspector': False,
            'exitProcessOnClose': True, 'injectGlobals': True
        }},
    }


def asar(files):
    """Electron asar archive, the format Neutralino reads resources.neu from."""
    tree, blobs, offset = {'files': {}}, [], 0
    for path in sorted(files):
        node = tree
        parts = path.split('/')
        for d in parts[:-1]:
            node = node['files'].setdefault(d, {'files': {}})
        data = files[path]
        node['files'][parts[-1]] = {'size': len(data), 'offset': str(offset)}
        blobs.append(data)
        offset += len(data)
    header = json.dumps(tree, separators=(',', ':'))
    header += ' ' * (-len(header.encode()) % 4)  # pad with spaces, not NULs, so the JSON stays valid
    h = header.encode()
    header_pickle = struct.pack('<II', 4 + len(h), len(h)) + h
    return struct.pack('<II', 4, len(header_pickle)) + header_pickle + b''.join(blobs)


def resources_neu():
    files = {'www/' + k: v for k, v in web_files().items()}
    files['neutralino.config.json'] = json.dumps(neutralino_config(), indent=2).encode()
    return asar(files)


# ---------------------------------------------------------------- windows
def ico_group(pngs):
    """RT_ICON payloads and the RT_GROUP_ICON directory for PNG icons."""
    icons, grp = [], struct.pack('<HHH', 0, 1, len(pngs))
    for i, (size, data) in enumerate(pngs, 1):
        icons.append((i, data))
        grp += struct.pack('<BBBBHHIH', size % 256, size % 256, 0, 0, 1, 32, len(data), i)
    return icons, grp


def version_info():
    def node(key, value=b'', vtype=0, children=b'', wlen=None):
        k = (key + '\0').encode('utf-16-le')
        head = 6 + len(k)
        pad1 = b'\0' * (-head % 4)
        body = value + b'\0' * (-len(value) % 4) + children
        length = head + len(pad1) + body.__len__()
        vl = wlen if wlen is not None else len(value)
        return struct.pack('<HHH', length, vl, vtype) + k + pad1 + body

    def string(key, val):
        v = (val + '\0').encode('utf-16-le')
        return node(key, v, 1, wlen=len(v) // 2)

    nums = [int(x) for x in VERSION.split('.')] + [0]
    ms, ls = (nums[0] << 16) | nums[1], (nums[2] << 16) | nums[3]
    ffi = struct.pack('<13I', 0xFEEF04BD, 0x10000, ms, ls, ms, ls, 0x3F, 0, 0x40004, 1, 0, 0, 0)
    strings = b''.join(string(k, v) for k, v in [
        ('CompanyName', 'Motey'), ('FileDescription', 'Motey – AI-mötesappen'), ('FileVersion', VERSION + '.0'),
        ('InternalName', 'Motey'), ('LegalCopyright', '© Motey'), ('OriginalFilename', 'Motey.exe'),
        ('ProductName', 'Motey'), ('ProductVersion', VERSION)])
    sfi = node('StringFileInfo', children=node('040904B0', children=strings, vtype=1), vtype=1)
    vfi = node('VarFileInfo', children=node('Translation', struct.pack('<HH', 0x0409, 0x04B0), 0), vtype=1)
    return node('VS_VERSION_INFO', ffi, 0, children=sfi + vfi)


MANIFEST = b'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="se.motey.app" version="1.0.0.0" processorArchitecture="amd64"/>
  <description>Motey</description>
  <dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency>
  <application xmlns="urn:schemas-microsoft-com:asm.v3"><windowsSettings>
    <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
    <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
  </windowsSettings></application>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application>
    <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
  </application></compatibility>
</assembly>'''


def rsrc_section(tree, rva):
    """Serialize {type: {name: {lang: bytes}}} into a .rsrc section placed at rva.
    Keys are ints (IDs) or str (names)."""
    dirs, strings, entries, blobs = [], [], [], []
    # pass 1: lay out directory tables breadth-first
    order = []

    def plan(node, level):
        idx = len(order)
        order.append((node, level))
        return idx
    plan(tree, 0)
    i = 0
    while i < len(order):
        node, level = order[i]
        if level < 2:
            for k in sorted([k for k in node if isinstance(k, str)]) + sorted([k for k in node if isinstance(k, int)]):
                plan(node[k], level + 1)
        i += 1
    sizes = [16 + 8 * len(n) for n, _ in order]
    dir_off = [sum(sizes[:j]) for j in range(len(order))]
    pos = sum(sizes)
    name_off = {}
    for n, level in order:
        for k in n:
            if isinstance(k, str) and k not in name_off:
                name_off[k] = pos
                pos += 2 + 2 * len(k)
    pos += -pos % 4
    leaves = [(n, k) for n, level in order if level == 2 for k in sorted(n)]
    entry_off = {}
    for n, k in leaves:
        entry_off[id(n), k] = pos
        pos += 16
    data_off = {}
    for n, k in leaves:
        pos += -pos % 8
        data_off[id(n), k] = pos
        pos += len(n[k])
    buf = bytearray(pos + (-pos % 8))
    child_index = 1
    for j, (n, level) in enumerate(order):
        keys = sorted([k for k in n if isinstance(k, str)]) + sorted([k for k in n if isinstance(k, int)])
        named = sum(1 for k in keys if isinstance(k, str))
        struct.pack_into('<IIHHHH', buf, dir_off[j], 0, 0, 0, 0, named, len(keys) - named)
        for e, k in enumerate(keys):
            name = (0x80000000 | name_off[k]) if isinstance(k, str) else k
            if level < 2:
                target = 0x80000000 | dir_off[child_index]
                child_index += 1
            else:
                target = entry_off[id(n), k]
            struct.pack_into('<II', buf, dir_off[j] + 16 + 8 * e, name, target)
    for k, off in name_off.items():
        s = k.encode('utf-16-le')
        struct.pack_into('<H', buf, off, len(k))
        buf[off + 2:off + 2 + len(s)] = s
    for n, k in leaves:
        struct.pack_into('<IIII', buf, entry_off[id(n), k], rva + data_off[id(n), k], len(n[k]), 0, 0)
        buf[data_off[id(n), k]:data_off[id(n), k] + len(n[k])] = n[k]
    return bytes(buf)


def build_exe():
    exe = bytearray(neutralino('neutralino-win_x64.exe'))
    # 1. tell postject's lookup that a resource is embedded
    fuse = b'POSTJECT_SENTINEL_fce680ab2cc467b6e072b8b5df1996b2:'
    at = exe.find(fuse)
    if at < 0 or exe.count(fuse) != 1:
        sys.exit('sentinel fuse not found exactly once')
    exe[at + len(fuse)] = ord('1')
    # 2. a new resource tree: app payload, icon, version info, manifest
    pngs = [(s, open(os.path.join(ICONS, 'full-%d.png' % s), 'rb').read()) for s in (16, 24, 32, 48, 64, 128, 256)]
    icons, grp = ico_group(pngs)
    tree = {
        3: {i: {1033: d} for i, d in icons},                        # RT_ICON
        10: {'NEUTRALINOJS_RESOURCES_NEU': {1033: resources_neu()}},  # RT_RCDATA, found by FindResourceA
        14: {'MAINICON': {1033: grp}},                              # RT_GROUP_ICON
        16: {1: {1033: version_info()}},                            # RT_VERSION
        24: {1: {1033: MANIFEST}},                                  # RT_MANIFEST
    }
    pe = struct.unpack_from('<I', exe, 0x3C)[0]
    nsec, = struct.unpack_from('<H', exe, pe + 6)
    optsz, = struct.unpack_from('<H', exe, pe + 20)
    opt = pe + 24
    if struct.unpack_from('<H', exe, opt)[0] != 0x20B:
        sys.exit('expected a PE32+ executable')
    salign, falign = struct.unpack_from('<II', exe, opt + 32)
    size_headers, = struct.unpack_from('<I', exe, opt + 60)
    if struct.unpack_from('<II', exe, opt + 112 + 8 * 4) != (0, 0):
        sys.exit('executable is signed; refusing to modify it')
    table = opt + optsz
    if table + 40 * (nsec + 1) > size_headers:
        sys.exit('no room for another section header')
    last_va = max(struct.unpack_from('<I', exe, table + 40 * i + 12)[0] + struct.unpack_from('<I', exe, table + 40 * i + 8)[0] for i in range(nsec))
    last_raw = max(struct.unpack_from('<I', exe, table + 40 * i + 20)[0] + struct.unpack_from('<I', exe, table + 40 * i + 16)[0] for i in range(nsec))
    if last_raw != len(exe):
        sys.exit('executable has overlay data')
    va = (last_va + salign - 1) // salign * salign
    data = rsrc_section(tree, va)
    raw = data + b'\0' * (-len(data) % falign)
    struct.pack_into('<8sIIIIIIHHI', exe, table + 40 * nsec, b'.motey\0\0', len(data), va, len(raw), len(exe), 0, 0, 0, 0, 0x40000040)
    struct.pack_into('<H', exe, pe + 6, nsec + 1)
    struct.pack_into('<I', exe, opt + 56, (va + len(data) + salign - 1) // salign * salign)  # SizeOfImage
    init, = struct.unpack_from('<I', exe, opt + 8)
    struct.pack_into('<I', exe, opt + 8, init + len(raw))                                  # SizeOfInitializedData
    struct.pack_into('<II', exe, opt + 112 + 8 * 2, va, len(data))                         # resource directory
    struct.pack_into('<I', exe, opt + 64, 0)                                               # CheckSum (recomputed below)
    exe += raw
    struct.pack_into('<I', exe, opt + 64, pe_checksum(exe, opt + 64))
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'Motey.exe')
    open(out, 'wb').write(exe)
    log('wrote', out, '%.1f MB' % (len(exe) / 1e6))
    return out


def pe_checksum(data, csum_off):
    s = 0
    n = len(data) // 2 * 2
    words = struct.unpack_from('<%dH' % (n // 2), data)
    skip = (csum_off // 2, csum_off // 2 + 1)
    for i, w in enumerate(words):
        if i in skip:
            continue
        s += w
        s = (s & 0xFFFF) + (s >> 16)
    if len(data) % 2:
        s += data[-1]
        s = (s & 0xFFFF) + (s >> 16)
    s = (s & 0xFFFF) + (s >> 16)
    return (s + len(data)) & 0xFFFFFFFF


# ---------------------------------------------------------------- macOS
def icns():
    parts = b''
    for typ, size in ((b'icp4', 16), (b'icp5', 32), (b'icp6', 64), (b'ic07', 128), (b'ic08', 256),
                      (b'ic09', 512), (b'ic10', 1024), (b'ic11', 32), (b'ic12', 64), (b'ic13', 256), (b'ic14', 512)):
        png = open(os.path.join(ICONS, 'mac-%d.png' % size), 'rb').read()
        parts += typ + struct.pack('>I', 8 + len(png)) + png
    return b'icns' + struct.pack('>I', 8 + len(parts)) + parts


def app_bundle():
    """{path inside the volume: (bytes, mode)} for Motey.app."""
    plist = plistlib.dumps({
        'CFBundleDevelopmentRegion': 'sv', 'CFBundleDisplayName': 'Motey', 'CFBundleName': 'Motey',
        'CFBundleExecutable': 'motey', 'CFBundleIconFile': 'motey', 'CFBundleIdentifier': APP_ID,
        'CFBundleInfoDictionaryVersion': '6.0', 'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': VERSION, 'CFBundleVersion': '1',
        'LSApplicationCategoryType': 'public.app-category.productivity', 'LSMinimumSystemVersion': '10.15',
        'NSHighResolutionCapable': True, 'NSHumanReadableCopyright': '© Motey',
        'NSMicrophoneUsageDescription': 'Motey använder mikrofonen i möten och när du startar Live AI.',
        'NSCameraUsageDescription': 'Motey använder kameran när du är med i ett möte med video.',
        'NSSpeechRecognitionUsageDescription': 'Motey gör om tal till text i Live AI.',
    })
    c = 'Motey.app/Contents/'
    return {
        c + 'Info.plist': (plist, 0o644),
        c + 'PkgInfo': (b'APPL????', 0o644),
        c + 'MacOS/motey': (neutralino('neutralino-mac_universal'), 0o755),
        # Neutralino reads resources.neu from the executable's directory.
        c + 'MacOS/resources.neu': (resources_neu(), 0o644),
        c + 'Resources/motey.icns': (icns(), 0o644),
    }


def build_dmg():
    sys.path.insert(0, repo('pycdlib'))
    import pycdlib
    dmgtool = os.path.join(TOOLS, 'libdmg-hfsplus', 'build', 'dmg', 'dmg')
    if not os.path.exists(dmgtool):
        src = repo('libdmg-hfsplus')
        os.makedirs(os.path.join(src, 'build'), exist_ok=True)
        run(['cmake', '..', '-DCMAKE_BUILD_TYPE=Release'], cwd=os.path.join(src, 'build'))
        run(['make', '-j4', 'dmg-bin'], cwd=os.path.join(src, 'build'))
    files = app_bundle()
    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, vol_ident='Motey', rock_ridge='1.09')
    made, n = {'': '/'}, [0]

    def iso_name(prefix):
        n[0] += 1
        return '%s%05d' % (prefix, n[0])

    def ensure_dir(path):
        if path in made:
            return made[path]
        parent, _, name = path.rpartition('/')
        p = ensure_dir(parent)
        ip = p.rstrip('/') + '/' + iso_name('D')
        iso.add_directory(ip, rr_name=name, file_mode=0o40755)
        made[path] = ip
        return ip
    keep = []
    for path in sorted(files):
        data, mode = files[path]
        parent, _, name = path.rpartition('/')
        d = ensure_dir(parent)
        fp = io.BytesIO(data)
        keep.append(fp)
        iso.add_fp(fp, len(data), d.rstrip('/') + '/' + iso_name('F') + '.;1', rr_name=name, file_mode=0o100000 | mode)
    iso.add_symlink('/' + iso_name('L') + '.;1', rr_symlink_name='Applications', rr_path='/Applications')
    w = os.path.join(WORK, 'mac')
    os.makedirs(w, exist_ok=True)
    raw = os.path.join(w, 'motey-uncompressed.iso')
    iso.write(raw)
    iso.close()
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'Motey.dmg')
    if os.path.exists(out):
        os.remove(out)
    run([dmgtool, raw, out], stdout=subprocess.DEVNULL)
    log('wrote', out, '%.1f MB' % (os.path.getsize(out) / 1e6))
    return out


TARGETS = {'web': build_html, 'apk': build_apk, 'exe': build_exe, 'dmg': build_dmg}

if __name__ == '__main__':
    want = sys.argv[1:] or ['all']
    if 'all' in want:
        want = list(TARGETS)
    for t in want:
        if t not in TARGETS:
            sys.exit('unknown target %s (choose from %s)' % (t, ', '.join(TARGETS)))
        TARGETS[t]()
    for f in sorted(os.listdir(DIST)):
        p = os.path.join(DIST, f)
        log('%-14s %8.1f MB  sha256 %s' % (f, os.path.getsize(p) / 1e6, hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16]))
