#!/usr/bin/env bash
# Build an unsigned (ad-hoc signed) Nezos .ipa. Runs on macOS with Xcode
# (see .github/workflows/nezos-ios.yml). Install it on a device with a
# sideloading tool (AltStore, Sideloadly, ...) which re-signs it with your
# Apple ID, or re-sign it with your own developer certificate.
#
#   build-ipa.sh <nezos.html> <out.ipa> <version>
set -euo pipefail
HTML=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
OUT=$2
VERSION=${3:-1.0.0}
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
APP="$WORK/Payload/Nezos.app"
mkdir -p "$APP"

SDK=$(xcrun --sdk iphoneos --show-sdk-path)
echo "› swiftc ($SDK)"
xcrun --sdk iphoneos swiftc -sdk "$SDK" -target arm64-apple-ios15.0 -O -parse-as-library \
  -o "$APP/Nezos" "$HERE/NezosApp.swift"

echo "› app icon"
XC="$WORK/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$XC"
cp "$HERE/../icons/icon-square-1024.png" "$XC/icon.png"
cat > "$WORK/Assets.xcassets/Contents.json" <<'JSON'
{ "info": { "author": "xcode", "version": 1 } }
JSON
cat > "$XC/Contents.json" <<'JSON'
{ "images": [ { "filename": "icon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024" } ],
  "info": { "author": "xcode", "version": 1 } }
JSON
xcrun actool "$WORK/Assets.xcassets" --compile "$APP" --platform iphoneos --minimum-deployment-target 15.0 \
  --target-device iphone --target-device ipad --app-icon AppIcon --output-partial-info-plist "$WORK/icons.plist" \
  --output-format human-readable-text --notices --warnings

echo "› Info.plist"
cp "$HTML" "$APP/index.html"
SDKVER=$(xcrun --sdk iphoneos --show-sdk-version)
cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>Nezos</string>
  <key>CFBundleName</key><string>Nezos</string>
  <key>CFBundleExecutable</key><string>Nezos</string>
  <key>CFBundleIdentifier</key><string>app.nezos.studio</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleSupportedPlatforms</key><array><string>iPhoneOS</string></array>
  <key>DTPlatformName</key><string>iphoneos</string>
  <key>DTSDKName</key><string>iphoneos$SDKVER</string>
  <key>MinimumOSVersion</key><string>15.0</string>
  <key>LSRequiresIPhoneOS</key><true/>
  <key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array>
  <key>UIRequiredDeviceCapabilities</key><array><string>arm64</string></array>
  <key>UILaunchScreen</key><dict/>
  <key>UIStatusBarStyle</key><string>UIStatusBarStyleLightContent</string>
  <key>UISupportedInterfaceOrientations</key><array>
    <string>UIInterfaceOrientationPortrait</string><string>UIInterfaceOrientationLandscapeLeft</string><string>UIInterfaceOrientationLandscapeRight</string>
  </array>
  <key>UISupportedInterfaceOrientations~ipad</key><array>
    <string>UIInterfaceOrientationPortrait</string><string>UIInterfaceOrientationPortraitUpsideDown</string>
    <string>UIInterfaceOrientationLandscapeLeft</string><string>UIInterfaceOrientationLandscapeRight</string>
  </array>
  <key>UIApplicationSupportsIndirectInputEvents</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Nezos uses the microphone for voice prompts.</string>
  <key>ITSAppUsesNonExemptEncryption</key><false/>
</dict>
</plist>
PLIST
/usr/libexec/PlistBuddy -c "Merge $WORK/icons.plist" "$APP/Info.plist"
plutil -lint "$APP/Info.plist"

echo "› ad-hoc sign + package"
codesign --force --sign - --timestamp=none "$APP"
codesign --verify --verbose "$APP"
mkdir -p "$(dirname "$OUT")"
OUT_ABS=$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")
rm -f "$OUT_ABS"
(cd "$WORK" && zip -qry "$OUT_ABS" Payload)
ls -la "$OUT_ABS"
