# gmfy 3.3.0 — HTML and desktop builds

Four builds of the same app. All of them are offline: nothing is fetched at
runtime and no server is involved.

| File | Platform | Size |
|---|---|---|
| `gmfy-3.3.0.html` | any browser | 176 KB |
| `gmfy_3.3.0_amd64.deb` | Debian / Ubuntu x86-64 | 90.4 MB |
| `gmfy-3.3.0-win32-x64.tar.xz` | Windows x86-64 | 85.3 MB |
| `gmfy-3.3.0-macos-arm64.tar.xz` | macOS Apple Silicon | 79.5 MB |

## HTML

One self-contained file — all nine scripts and the styles are inlined. Open it
in any browser, including straight off a USB stick. Games save to that
browser's local storage for the origin the file is opened from.

## Linux (.deb)

```sh
sudo apt install ./gmfy_3.3.0_amd64.deb
gmfy
```

Installs to `/opt/gmfy` with a launcher at `/usr/bin/gmfy` and a desktop entry,
so it also appears in the applications menu. `apt` is used rather than
`dpkg -i` so the dependencies come along; with `dpkg -i` follow up with
`sudo apt-get install -f`.

## Windows

```
tar -xf gmfy-3.3.0-win32-x64.tar.xz
```

Then run `gmfy.exe` from the extracted folder. `tar` is built into Windows 10
and later, and File Explorer on Windows 11 opens `.tar.xz` directly. Keep the
folder together — `gmfy.exe` needs the DLLs and `resources/` beside it.

## macOS

```sh
tar -xf gmfy-3.3.0-macos-arm64.tar.xz
xattr -dr com.apple.quarantine gmfy.app
open gmfy.app
```

The bundle is **not code-signed or notarised**, so Gatekeeper will refuse it
until the quarantine attribute is cleared, as above. Right-click → Open works
too. This build is Apple Silicon only; an Intel Mac needs the `darwin-x64`
runtime instead.

## Why tar.xz rather than zip for Windows and macOS

The Electron binary is 215 MB on Windows. Zipped, the bundle came to 141.7 MB —
past GitHub's 100 MB per-file limit. xz gets it to 85.3 MB, and tar also
preserves the symlinks a macOS `.app` framework needs, which zip handles
poorly. 74 MB of unused Chromium locales were dropped as well; the builds keep
`en-US` only.

## Two changes the offline builds required

`export.js` read its own runtime sources with `fetch()`, which `file://`
forbids, so the Export tab would have been dead in every offline build. It now
prefers sources embedded at build time on `window.GMFY_SRC` and falls back to
`fetch()` when running over http (Cordova's `localhost`, a dev server).

Password hashing uses `crypto.subtle`, which needs a secure context. On
`file://` there isn't one, so `auth.js`'s existing labelled fallback takes over
and hashes are stored with a `weak:` prefix. That is fine for on-device
accounts, which is all this app has, but it is not password storage you should
copy for anything networked.

## What was verified

The HTML build was driven in headless Chromium from `file://` — 11 checks, all
passing: no page errors, all globals present, sign-up completes through the
crypto fallback, the 3D viewport renders 290 distinct colours, tapping the
ground places an object, and a saved world survives a full page restart.
`src/verify_html.py` is that test.

The `.deb` was installed on a real Debian-family system and launched under
`xvfb`, reaching `Status: install ok installed` and reporting the canvas and
every app global live inside the Electron window. `chrome-sandbox` ships
setuid root as Electron requires.

The Windows and macOS archives were checked structurally only — `gmfy.exe` is a
valid PE32+ x86-64 image, `gmfy.app`'s executable is a 64-bit Mach-O with its
exec bit and 20 framework symlinks intact, and `Info.plist` points at the right
executable. **Neither was actually run**, because there is no Windows or macOS
machine in the build environment. They are assembled from official Electron
runtimes with the same payload and `main.js` verified on Linux, but "runs" is
not a claim that has been tested for those two.

## Rebuilding

```sh
python src/mkhtml.py        # the single-file HTML
python src/mkdesktop.py     # downloads Electron, builds the .deb and bundles
python src/repack.py        # trims locales, compresses win/mac as tar.xz
python src/verify_html.py   # the browser test
```

## Checksums (SHA-256)

```
901b97cc88ee55e364f434b3ac33f9d28a4e3c89fee8174fcca6dc7d6399f961  gmfy-3.3.0.html
9e3398a53c2942afe58d15e8ffd38fc2e86be3bcf3d5ac88f6f7281aff1a393d  gmfy_3.3.0_amd64.deb
83db6e00c2941077f35a29aca5751379febd2ae36a135c3b74195cd98d27277b  gmfy-3.3.0-win32-x64.tar.xz
350ec128d7f5e23ca4a438eea42ed6081f734821a332b2c81df5517a119adf6b  gmfy-3.3.0-macos-arm64.tar.xz
```
