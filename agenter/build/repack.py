"""Compress the Electron trees for the repository and print checksums.

tar.xz rather than zip for two reasons: a zipped Windows tree lands past
GitHub's 100 MB per-file limit, and zip mangles the framework symlinks a macOS
.app depends on. Locale trimming already happened in mkdesktop.py, so the .deb
gets a trimmed tree too; the call here is only a safety net for stale trees.
"""
import os, subprocess, sys, hashlib

from mkdesktop import trim_locales

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
DIST = os.path.join(ROOT, "dist")
WORK = os.path.join(HERE, "work")

VERSION = "1.0.0"
TREES = [
    ("agenter-%s-win32-x64" % VERSION,   "agenter-%s-win32-x64.tar.xz" % VERSION),
    ("agenter-%s-macos-arm64" % VERSION, "agenter-%s-macos-arm64.tar.xz" % VERSION),
    ("agenter-%s-linux-x64" % VERSION,   "agenter-%s-linux-x64.tar.xz" % VERSION),
]


def log(*a):
    print(*a, flush=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    if not os.path.isdir(WORK):
        sys.exit("run mkdesktop.py first — %s is missing" % WORK)

    sums = []
    for tree_name, archive in TREES:
        tree = os.path.join(WORK, tree_name)
        if not os.path.isdir(tree):
            log("skip", tree_name, "(not built)")
            continue

        trim_locales(tree)
        out = os.path.join(DIST, archive)
        if os.path.exists(out):
            os.remove(out)

        # -T0 uses every core; -9 is what gets Windows under the 100 MB limit.
        subprocess.run(["tar", "-C", WORK, "-cf", out, "--use-compress-program",
                        "xz -9 -T0", tree_name], check=True)
        log("   %-38s %6.1f MB" % (archive, os.path.getsize(out) / 1e6))
        sums.append(out)

    deb = os.path.join(DIST, "agenter_%s_amd64.deb" % VERSION)
    if os.path.exists(deb):
        sums.append(deb)
    html = os.path.join(DIST, "agenter-%s.html" % VERSION)
    if os.path.exists(html):
        sums.insert(0, html)
    apk = os.path.join(DIST, "agenter-%s.apk" % VERSION)
    if os.path.exists(apk):
        sums.append(apk)

    log("\nsha256")
    for p in sums:
        log("%s  %s" % (sha256(p), os.path.basename(p)))

    over = [p for p in sums if os.path.getsize(p) > 100e6]
    if over:
        log("\nWARNING: past GitHub's 100 MB per-file limit:")
        for p in over:
            log("   %s  %.1f MB" % (os.path.basename(p), os.path.getsize(p) / 1e6))


if __name__ == "__main__":
    main()
