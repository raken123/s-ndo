#!/usr/bin/env bash
# Builds the single RakenOS app (com.raken.rakenos) with Apache Cordova,
# the Android SDK command-line tools and Gradle — no Android Studio.
# Output: dist/RakenOS.apk
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
MODE="${1:-debug}"
if [ -n "${RAKENOS_MAVEN_MIRROR:-}" ]; then
  mkdir -p "$HOME/.gradle/init.d"
  cp "$ROOT/tools/gradle-maven-mirror.gradle" "$HOME/.gradle/init.d/rakenos-maven-mirror.gradle"
  echo "› Maven Central is resolved through $RAKENOS_MAVEN_MIRROR"
fi

echo "› Checking toolchain"
command -v java >/dev/null || { echo "Java (JDK 17+) is required"; exit 1; }
command -v gradle >/dev/null || { echo "Gradle is required on PATH"; exit 1; }
[ -d "$ANDROID_HOME/platforms/android-36" ] || { echo "Android SDK platform 36 missing: sdkmanager \"platforms;android-36\" \"build-tools;36.0.0\""; exit 1; }

echo "› Assembling shared RakenOS modules into app/www"
node "$ROOT/tools/assemble-www.mjs"
echo "› Checking for device model names"
node "$ROOT/tools/scan-model-names.mjs"

cd "$ROOT/app"
[ -d node_modules/cordova ] || npm install --no-audit --no-fund
if [ ! -d platforms/android ]; then npx cordova platform add android --nosave; fi
npx cordova prepare android
if [ "$MODE" = "release" ]; then
  : "${RAKENOS_KEYSTORE:?Set RAKENOS_KEYSTORE, RAKENOS_KEYSTORE_PASSWORD, RAKENOS_KEY_ALIAS for release builds}"
  npx cordova build android --release -- --packageType=apk --keystore="$RAKENOS_KEYSTORE" --storePassword="$RAKENOS_KEYSTORE_PASSWORD" --alias="$RAKENOS_KEY_ALIAS" --password="$RAKENOS_KEYSTORE_PASSWORD"
  SRC=platforms/android/app/build/outputs/apk/release/app-release.apk
else
  npx cordova build android --debug
  SRC=platforms/android/app/build/outputs/apk/debug/app-debug.apk
fi
mkdir -p "$ROOT/dist"
cp "$SRC" "$ROOT/dist/RakenOS.apk"
echo "✓ Built $ROOT/dist/RakenOS.apk ($(du -h "$ROOT/dist/RakenOS.apk" | cut -f1))"
