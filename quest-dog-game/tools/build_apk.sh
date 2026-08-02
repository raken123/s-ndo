#!/usr/bin/env bash
#
# Build the Meta Quest APK for Dog Blaster VR.
#
# Prerequisites (override any of these with environment variables):
#   GODOT             Godot 4.4.x binary (Linux/macOS headless-capable build)
#   ANDROID_SDK_ROOT  Android SDK with platform-tools, build-tools;34.0.0,
#                     platforms;android-34
#   JAVA_17_HOME      A JDK 17 install (the bundled Gradle 8.2 cannot run on 21+)
#
# Usage:
#   tools/build_apk.sh              # signed release APK -> build/DogBlasterVR.apk
#   tools/build_apk.sh --debug      # debug-signed APK   -> build/DogBlasterVR-debug.apk
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

GODOT="${GODOT:-godot}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Android/Sdk}}"
JAVA_17_HOME="${JAVA_17_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
GODOT_VERSION="${GODOT_VERSION:-4.4.1.stable}"
TEMPLATE_DIR="${TEMPLATE_DIR:-$HOME/.local/share/godot/export_templates/$GODOT_VERSION}"
BUILD_MODE="release"
OUTPUT="build/DogBlasterVR.apk"

if [[ "${1:-}" == "--debug" ]]; then
  BUILD_MODE="debug"
  OUTPUT="build/DogBlasterVR-debug.apk"
fi

echo "==> Project:  $PROJECT_DIR"
echo "==> Godot:    $GODOT"
echo "==> SDK:      $ANDROID_SDK_ROOT"
echo "==> JDK 17:   $JAVA_17_HOME"

# 1. The Android "gradle build" template ships inside the export templates.
#    It is large and fully regenerable, so it is not committed to the repo.
if [[ ! -d android/build/src ]]; then
  echo "==> Installing the Android build template"
  mkdir -p android/build
  unzip -q -o "$TEMPLATE_DIR/android_source.zip" -d android/build
  echo "$GODOT_VERSION" > android/.build_version
fi

# android/build must stay invisible to Godot's asset scanner. Two things go
# wrong otherwise: the launcher icons the export writes into res/mipmap-* come
# back as .import files that aapt rejects, and Gradle's output tree contains a
# *copy* of the OpenXR addon, which then gets registered a second time and
# crashes the editor on shutdown.
touch android/build/.gdignore
find android/build -name "*.import" -delete

# A crashed editor leaves a lock behind and the next launch silently enters
# recovery mode, which disables every addon - including the OpenXR plugin -
# and quietly produces an APK that installs but never enters VR. The teardown
# crash in the vendors extension makes this happen on *every* second run, so
# the lock is cleared immediately before each invocation.
godot_run() {
  find "${XDG_DATA_HOME:-$HOME/.local/share}/godot" -name ".recovery_mode_lock" -delete 2>/dev/null || true
  "$GODOT" "$@"
}

# Drop any extension registrations cached from an earlier, dirtier scan.
if grep -q "android/build" .godot/extension_list.cfg 2>/dev/null; then
  echo "==> Clearing a stale import cache"
  rm -rf .godot
fi

# 2. Point the headless editor at the SDK, the JDK and a debug keystore.
mkdir -p "$HOME/.android" "$HOME/.config/godot"
if [[ ! -f "$HOME/.android/debug.keystore" ]]; then
  echo "==> Creating the Android debug keystore"
  keytool -keyalg RSA -genkeypair -alias androiddebugkey -keypass android \
    -keystore "$HOME/.android/debug.keystore" -storepass android \
    -dname "CN=Android Debug,O=Android,C=US" -validity 9999 -deststoretype pkcs12 >/dev/null
fi

cat > "$HOME/.config/godot/editor_settings-4.4.tres" <<EOF
[gd_resource type="EditorSettings" format=3]

[resource]
export/android/android_sdk_path = "$ANDROID_SDK_ROOT"
export/android/java_sdk_path = "$JAVA_17_HOME"
export/android/debug_keystore = "$HOME/.android/debug.keystore"
export/android/debug_keystore_user = "androiddebugkey"
export/android/debug_keystore_pass = "android"
export/android/force_system_user = false
export/android/shutdown_adb_on_exit = true
EOF

# 3. A self-signed release key. Keep it: Android only lets you upgrade an
#    installed app with the key it was first signed with.
RELEASE_KEYSTORE="${RELEASE_KEYSTORE:-$PROJECT_DIR/android/release.keystore}"
RELEASE_ALIAS="${RELEASE_ALIAS:-dogblaster}"
RELEASE_PASSWORD="${RELEASE_PASSWORD:-dogblaster}"
if [[ "$BUILD_MODE" == "release" && ! -f "$RELEASE_KEYSTORE" ]]; then
  echo "==> Creating a self-signed release keystore at $RELEASE_KEYSTORE"
  keytool -keyalg RSA -keysize 2048 -genkeypair -alias "$RELEASE_ALIAS" \
    -keypass "$RELEASE_PASSWORD" -keystore "$RELEASE_KEYSTORE" \
    -storepass "$RELEASE_PASSWORD" -validity 10000 -deststoretype pkcs12 \
    -dname "CN=Dog Blaster VR,O=Sideload,C=US" >/dev/null
fi
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$RELEASE_KEYSTORE"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="$RELEASE_ALIAS"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$RELEASE_PASSWORD"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export ANDROID_SDK_ROOT

# 4. Import assets, then export.
mkdir -p build
echo "==> Importing assets"
# The OpenXR vendors GDExtension can trip over its own singletons while the
# headless editor tears down; the import itself has already finished by then.
godot_run --headless --path . --import >/dev/null 2>&1 || \
  echo "    (headless editor exited noisily after import - continuing)"
if [[ ! -d .godot/imported ]]; then
  echo "!! Asset import did not produce .godot/imported" >&2
  exit 1
fi

echo "==> Exporting $BUILD_MODE APK"
rm -f "$PROJECT_DIR/$OUTPUT"
EXPORT_LOG="$(mktemp)"
# Same teardown abort as the test runner: the export finishes, then the
# extension crashes on the way out and takes the exit code with it. Judge the
# build by the artifact instead.
set +e
godot_run --headless --path . "--export-$BUILD_MODE" "Quest" "$PROJECT_DIR/$OUTPUT" \
  > "$EXPORT_LOG" 2>&1
set -e
grep -E "BUILD FAILED|error:|ERROR: Export" "$EXPORT_LOG" && {
  echo "!! Export reported errors - full log at $EXPORT_LOG" >&2
  exit 1
}
rm -f "$EXPORT_LOG"

if [[ ! -f "$PROJECT_DIR/$OUTPUT" ]]; then
  echo "!! No APK was produced" >&2
  exit 1
fi

echo "==> Verifying this is an OpenXR package"
# Capture first, match second: piping into `grep -q` under `set -o pipefail`
# reports the SIGPIPE from the upstream command as a pipeline failure.
APK_LISTING="$(unzip -l "$PROJECT_DIR/$OUTPUT")"
MANIFEST_DUMP="$("$ANDROID_SDK_ROOT/build-tools/34.0.0/aapt" dump xmltree \
  "$PROJECT_DIR/$OUTPUT" AndroidManifest.xml 2>/dev/null || true)"

for required in libopenxr_loader.so libgodotopenxrvendors.so; do
  case "$APK_LISTING" in
    *"$required"*) ;;
    *)
      echo "!! $required is missing - the OpenXR plugin did not load, so this" >&2
      echo "   APK would install but never enter VR. Delete .godot and retry." >&2
      exit 1 ;;
  esac
done
case "$MANIFEST_DUMP" in
  *org.khronos.openxr.intent.category.IMMERSIVE_HMD*) ;;
  *) echo "!! The manifest is missing the immersive-HMD intent category" >&2; exit 1 ;;
esac

echo "==> Verifying the signature"
"$ANDROID_SDK_ROOT/build-tools/34.0.0/apksigner" verify "$PROJECT_DIR/$OUTPUT" 2>/dev/null \
  || { echo "!! The APK is not correctly signed" >&2; exit 1; }

echo
echo "==> Built $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "    Install with:  adb install -r $OUTPUT"
