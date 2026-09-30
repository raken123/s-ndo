#!/usr/bin/env bash
# Bygger Astro som Meta Quest-APK (PWA/TWA) med Metas egen Bubblewrap-fork.
# Används av GitHub Actions men kan också köras lokalt (kräver Node 20+, JDK 17 och Android SDK).
#
# Miljövariabler:
#   ASTRO_HOST        värd där spelet ligger, t.ex. raken123.github.io
#   ASTRO_PATH        sökväg till spelet, t.ex. /s-ndo/astro/web/  (måste sluta med /)
#   QUEST_APP_MODE    immersive (startar direkt i VR, standard) eller 2D (panel i Horizon OS)
#   QUEST_KEYSTORE / QUEST_KEYSTORE_PASSWORD   befintlig signeringsnyckel (annars skapas en ny)
#   VERSION_NAME / VERSION_CODE
set -euo pipefail
cd "$(dirname "$0")"

: "${ASTRO_HOST:?ASTRO_HOST saknas}"
: "${ASTRO_PATH:=/}"
: "${QUEST_APP_MODE:=immersive}"
: "${VERSION_NAME:=1.0.0}"
: "${VERSION_CODE:=1}"
: "${ICON_BASE:=https://${ASTRO_HOST}${ASTRO_PATH}}"
JAVA17="${JAVA_HOME_17_X64:-${JAVA_HOME:?JAVA_HOME saknas}}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?ANDROID_HOME saknas}}"

mkdir -p build
KEYSTORE="$(pwd)/build/astro-quest.keystore"
if [[ -n "${QUEST_KEYSTORE:-}" ]]; then
  cp "$QUEST_KEYSTORE" "$KEYSTORE"
else
  # Ingen nyckel angiven: skapa en ny (OBS: uppdateringar kräver samma nyckel – spara den!)
  QUEST_KEYSTORE_PASSWORD="${QUEST_KEYSTORE_PASSWORD:-astro-$(date +%s)-${RANDOM}}"
  rm -f "$KEYSTORE"
  "$JAVA17/bin/keytool" -genkeypair -keystore "$KEYSTORE" -alias astro -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$QUEST_KEYSTORE_PASSWORD" -keypass "$QUEST_KEYSTORE_PASSWORD" \
    -dname "CN=Astro, O=Tekniska museet, C=SE"
fi
: "${QUEST_KEYSTORE_PASSWORD:?QUEST_KEYSTORE_PASSWORD saknas}"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$QUEST_KEYSTORE_PASSWORD"
export BUBBLEWRAP_KEY_PASSWORD="$QUEST_KEYSTORE_PASSWORD"

# Bubblewrap-konfiguration: använd befintlig JDK 17 och Android SDK (inga frågor).
mkdir -p "$HOME/.bubblewrap"
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' "$JAVA17" "$SDK" > "$HOME/.bubblewrap/config.json"

cd build
sed -e "s#__HOST__#${ASTRO_HOST}#g" \
    -e "s#__START_PATH__#${ASTRO_PATH}#g" \
    -e "s#__ICON_URL__#${ICON_BASE}icons/icon-512.png#g" \
    -e "s#__MASKABLE_ICON_URL__#${ICON_BASE}icons/icon-512-maskable.png#g" \
    -e "s#__MANIFEST_URL__#${ICON_BASE}manifest.webmanifest#g" \
    -e "s#__KEYSTORE__#${KEYSTORE}#g" \
    -e "s#__APP_MODE__#${QUEST_APP_MODE}#g" \
    -e "s#__VERSION_NAME__#${VERSION_NAME}#g" \
    -e "s#__VERSION_CODE__#${VERSION_CODE}#g" \
    ../twa-manifest.template.json > twa-manifest.json

bubblewrap update --skipVersionUpgrade
bubblewrap build --skipPwaValidation

cp app-release-signed.apk ../Astro-Quest.apk

# Digital Asset Links – måste ligga på https://<värd>/.well-known/assetlinks.json
FP=$("$JAVA17/bin/keytool" -list -v -keystore "$KEYSTORE" -alias astro -storepass "$QUEST_KEYSTORE_PASSWORD" | awk '/SHA256:/{print $2; exit}')
cat > ../assetlinks.json <<JSON
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": { "namespace": "android_app", "package_name": "se.tekniskamuseet.astro.quest", "sha256_cert_fingerprints": ["${FP}"] }
}]
JSON
echo "Klart: $(pwd)/../Astro-Quest.apk"
