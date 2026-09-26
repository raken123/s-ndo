# RAS — Raken App Software

A `.ras` file is a ZIP container:

```
manifest.json            identity, entry points, permissions, capabilities, Store metadata
main.rscript             RScript program
ui.rdesign.json          RDesign interface
assets/…                 images and data (optional)
META-INF/SIGNATURE.json  SHA-256 of every file, signed with the developer key (ECDSA P-256)
```

## Manifest

```json
{
  "format": 1,
  "id": "com.raken.samples.tally",
  "name": "Tally",
  "version": "2.1.0",
  "versionCode": 7,
  "minRakenOS": "1.0.0",
  "rasApiLevel": 1,
  "entry": "main.rscript",
  "design": "ui.rdesign.json",
  "icon": { "glyph": "counter", "background": "#2F5AE0" },
  "permissions": [{ "id": "storage", "reason": "Keeps your counts between sessions." }],
  "capabilities": { "required": [], "optional": ["vibration"] },
  "store": { "developer": "Raken Labs", "category": "productivity", "summary": "…", "description": "…", "releaseNotes": "…" }
}
```

Permissions: `notifications`, `storage`, `vibrate`, `camera`, `nfc`, `scanner`, `network`, `clipboard`. Each has a reason shown in the permission sheet and can be changed in Settings → Privacy.

Capabilities: `camera`, `advancedCamera`, `torch`, `nfc`, `scanner2d`, `vibration`, `bluetooth`, `wifi`, `telephony`, `fingerprint`, `gps`. A *required* capability makes the app unavailable on devices without it; *optional* capabilities can be queried at runtime with `device.has("nfc")`. There is no API for device models.

## Installation pipeline

1. **Download** from the Store and compare the SHA-256 with the catalog listing.
2. **Parse** the ZIP (path traversal and CRC errors are rejected).
3. **Validate** the manifest (`ras-runtime/ras-package.js`).
4. **Verify the signature**: every file must be covered by `SIGNATURE.json`, every digest must match, and the ECDSA P-256 signature must verify against a trusted developer key (`ras-runtime/trusted-keys.json`). With Settings → Security → *Only allow verified RAS apps* turned off, unknown keys are accepted but labelled.
5. **Compatibility**: `minRakenOS`, `rasApiLevel` (from the installed system components) and required capabilities.
6. **Permissions** are reviewed in the install sheet.
7. **Install**. Updates must be signed by the same key and have a higher `versionCode`.

## RScript

```rscript
state count = 0                         // observable; re-renders the interface
let history = []
fn add(n) { count += n; push(history, n) }
on start { count = storage.get("count", 0) }
on action "add" { add(1); storage.set("count", count) }
on action "remove" (i) { remove_at(history, i) }
on change "step" (value) { … }
on timer "tick" { … }                   // timer.every(1000, "tick")
```

Values: numbers, strings, booleans, `null`, lists, maps, functions (`fn (x) { return x * 2 }`). Control flow: `if / else`, `while`, `for x in list`, `for k, v in map`, `break`, `continue`, `return`. Operators: `+ - * / %`, comparisons, `and or not`.

Host APIs (permission-gated): `ui.toast`, `ui.alert`, `notify`, `storage.get/set/remove`, `haptics.tap`, `clipboard.copy`, `timer.every/after/cancel`, `device.has`, `system.version`, `system.api_level`, `clock.now`.

The interpreter is sandboxed: programs see only RScript values and these APIs, every step is counted (runaway loops stop), and interface bindings can only call pure functions.

## RDesign

A JSON tree rendered with the Raken Design System: `screen`, `section`, `card`, `column`, `row`, `grid`, `text`, `button`, `icon-button`, `cell`, `toggle`, `slider`, `input`, `segmented`, `progress`, `list`, `if`, `badge`, `stat`, `image`, `icon`, `spacer`, `divider`. Text supports `{expression}` bindings; `toggle`, `slider`, `input` and `segmented` bind two-way to state variables.

```json
{ "type": "button", "label": "{running and 'Pause' or 'Start'}", "action": "toggle", "variant": "primary" }
```

## Developer Studio — publishing

Apps are published with Developer Studio, **not** from Raken Store. Store only discovers, searches, installs, updates, opens and lists apps.

```bash
node tools/ras-studio.mjs keygen my-key "My Company"
node tools/ras-studio.mjs pack path/to/app out/app.ras tools/keys/my-key.private.jwk.json
node tools/ras-studio.mjs validate out/app.ras
node tools/ras-studio.mjs publish out/app.ras http://localhost:8787
node tools/ras-studio.mjs build-samples      # rebuilds store/packages and store/catalog.json
```

`pack` validates the manifest, parses the RScript, checks that icon-only controls have accessibility labels, computes per-file digests and signs them. The sample publisher key in `tools/keys/` is a development key for the bundled sample apps only.
