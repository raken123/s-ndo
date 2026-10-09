# Nezos native apps

`nezos/downloads/` holds the released builds and their downloads page (`index.html`):

| File | Platform | How it's built |
|---|---|---|
| `Nezos-<v>-windows-x64.exe` | Windows 10/11 | Neutralino + WebView2, app embedded, one portable file |
| `Nezos-<v>-macos.dmg` | macOS 12+ (Apple Silicon + Intel) | Neutralino universal binary in `Nezos.app`, ISO/Rock Ridge `.dmg` |
| `nezos_<v>_amd64.deb` | Debian / Ubuntu | Neutralino + WebKitGTK, installs to `/opt/nezos` |
| `Nezos-<v>.apk` | Android 7+ | WebView app (aapt2, d8, apksigner) |
| `Nezos-<v>.aab` | Google Play | Same app as an App Bundle (bundletool, jarsigner) |
| `Nezos-<v>.ipa` | iOS / iPadOS 15+ | WKWebView app, built on macOS by `.github/workflows/nezos-ios.yml` |
| `nezos.html` | Any browser | `standalone/build.mjs` |

All of them wrap the single-file app (`standalone/`), so accounts, projects
and credits live on the device, and the app calls OpenAI directly.

## Building

```bash
cd nezos/packaging
npm install
node build.mjs                 # -> ../downloads (no API key: users add theirs in the app)
```

Needs Node 20+, a JDK (javac, keytool, jarsigner), `dpkg-deb`, `zip`/`unzip`,
`curl`, and Python 3 with `pycdlib` (`pip install pycdlib`). Neutralino, the
Android build tools and platform, and bundletool are downloaded into
`work/` on first run.

The iOS app can only be compiled on macOS. Pushing changes runs the workflow,
which commits `downloads/Nezos-<v>.ipa`. On a Mac you can also run
`ios/build-ipa.sh <nezos.html> <out.ipa> <version>` yourself.

### Private builds with a built-in key

```bash
NEZOS_OPENAI_KEY=sk-... node build.mjs ~/nezos-private
```

writes the key into every package so the apps work without asking for one.
Anyone who has these files can extract the key, so never commit or publish
them; the public builds in `downloads/` stay key-free.

## Signing

- **Android:** `keys/nezos-release.jks` (password in `keys/password.txt`) is
  created on the first build and git-ignored. Keep it safe: updates to an
  installed app must be signed with the same key. For Google Play, enrol in
  Play App Signing and use this as the upload key.
- **iOS:** the `.ipa` is ad-hoc signed. Install it with AltStore or
  Sideloadly (they re-sign it with your Apple ID), or re-sign it with an Apple
  Developer certificate for TestFlight / the App Store.
- **macOS / Windows:** not code-signed or notarized, so Gatekeeper and
  SmartScreen warn on first launch (the downloads page explains how to open
  it). Code-signing certificates from Apple and Microsoft remove the warnings.
