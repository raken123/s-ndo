# Sändo Tavla — Android-bygge

APK:n byggs av det här Gradle-projektet. Webbappen i `../whiteboard` är enda
källan till gränssnittet — Gradle-tasken `copyWebApp` kopierar in den som
assets vid varje bygge, så en ändring i `whiteboard/` räcker för att uppdatera
appen.

| | |
|---|---|
| Paketnamn | `se.sando.tavla` |
| minSdk | 26 (Android 8.0) |
| targetSdk / compileSdk | 35 (Android 15) |
| Behörigheter | `RECORD_AUDIO`, `CAMERA`, `INTERNET` |
| Nätverk | används bara av tramsdetektorns AI-läge (Gemini Live) |

## Bygga

```sh
export ANDROID_HOME=/sökväg/till/android-sdk
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease
```

APK:n hamnar i `app/build/outputs/apk/release/app-release.apk`.

Behöver du en osignerad snabbvariant för test:

```sh
./gradlew assembleDebug
```

## Signering

`keystore.properties` pekar ut nyckeln som release-bygget signeras med.
Nyckeln i repot (`sandotavla.keystore`, lösenord `sandotavla`) är en
självdistributionsnyckel för sidoladdning på skolans plattor — den ligger med i
repot så att en ombyggd APK behåller samma signatur och kan installeras över en
tidigare version. Den är **inte** avsedd för Google Play. Ska appen läggas upp i
en butik eller distribueras utanför den egna skolan: skapa en egen nyckel, håll
den utanför repot och peka om `keystore.properties`.

```sh
keytool -genkeypair -v -keystore min.keystore -alias mintavla \
  -keyalg RSA -keysize 2048 -validity 10950
```

Saknas `keystore.properties` byggs release-varianten osignerad, och måste då
signeras manuellt med `apksigner` innan den kan installeras.

## Installera på platta eller smartboard

```sh
adb install -r ../apk/sandotavla-1.5.0.apk
```

Eller kopiera APK-filen till enheten och öppna den — då behöver
"Installera okända appar" vara påslaget för filhanteraren.

## Så fungerar skalet

`MainActivity` är en WebView i helskärm (immersive) som laddar
`file:///android_asset/index.html`:

* skärmen hålls tänd under lektionen (`FLAG_KEEP_SCREEN_ON`)
* bakåtknappen stänger först öppet verktyg, sedan appen
* mikrofon- och kameraförfrågningar från webbappen kopplas till Androids
  runtime-behörigheter i `onPermissionRequest` (mikrofon till ljuddetektorn och
  tramsdetektorn, kamera till kameravakten vid utvisning)
* `AndroidBridge.saveImage()` sparar tavlan som PNG i galleriet
  (Bilder/Sando Tavla)
