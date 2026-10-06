#!/bin/bash
# Builds an unsigned One AI .ipa on macOS with Xcode (CI runs this).
# Install it with your own Apple signing (Xcode, AltStore, Sideloadly) or
# sign it for TestFlight/App Store with your developer account.
set -euo pipefail
cd "$(dirname "$0")"
command -v xcodegen >/dev/null || brew install xcodegen
rm -rf OneAI/www build Payload
cp -R ../web OneAI/www
xcodegen generate
xcodebuild -project OneAI.xcodeproj -target OneAI -configuration Release -sdk iphoneos \
  SYMROOT="$PWD/build" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
mkdir -p Payload ../dist
cp -R build/Release-iphoneos/OneAI.app Payload/
rm -f ../dist/OneAI-1.0.0.ipa
zip -qry ../dist/OneAI-1.0.0.ipa Payload
ls -l ../dist/OneAI-1.0.0.ipa
