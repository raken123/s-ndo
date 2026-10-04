Hub AI 1.0.0 for Android, macOS, Windows and Linux. Payments in the app are a demo.

| File | Platform |
|---|---|
| `HubAI-1.0.0.apk` | Android 7.0+ |
| `HubAI-1.0.0-mac-arm64.dmg` | macOS, Apple Silicon |
| `HubAI-1.0.0-mac-x64.dmg` | macOS, Intel |
| `HubAI-Setup-1.0.0.exe` | Windows 10/11, 64-bit |
| `hub-ai_1.0.0_amd64.deb` | Debian / Ubuntu, 64-bit |

**macOS:** open the `.dmg` and drag Hub AI to Applications. The app has no Apple Developer ID yet, so the first time you open it macOS says it can't verify the developer:
- macOS 15 (Sequoia) and newer: click Done, then open System Settings → Privacy & Security, scroll down and click **Open Anyway**.
- macOS 14 and older: right-click Hub AI in Applications and choose **Open**.
- Or in Terminal: `xattr -dr com.apple.quarantine "/Applications/Hub AI.app"`

Pick `mac-arm64` for Apple Silicon (M1 and later) and `mac-x64` for Intel Macs.

**Windows:** the installer is not code-signed, so SmartScreen may warn. Choose "More info", then "Run anyway".

**Linux:** `sudo apt install ./hub-ai_1.0.0_amd64.deb`, then start Hub AI from the app menu or run `hub-ai`.

Checksums are in `SHA256SUMS.txt`.
