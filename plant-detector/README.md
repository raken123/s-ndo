# Växtdetektor 🌿 (Cordova-app)

En Android-app byggd med Apache Cordova som detekterar växter, analyserar deras hälsa och känner igen sjukdomstecken — helt lokalt på enheten, utan internetuppkoppling.

## Funktioner

- **📷 Växtdetektering** — fota eller välj en bild; appen avgör om bilden innehåller en växt och med vilken säkerhet.
- **💚 Hälsopoäng** — bildens vegetation analyseras pixel för pixel (HSV-färgklassning) och ger en hälsopoäng 0–100.
- **🔬 Sjukdomsanalys** — upptäcker symptom som gulnande blad (kloros), bruna partier, mörka fläckar och möjlig mjöldagg, med konkreta åtgärdsråd.
- **🕘 Historik** — tidigare analyser sparas lokalt med miniatyrbild.
- **📖 Växtbibliotek** — skötselråd (ljus, vatten, svårighetsgrad) för 12 populära växter, med sökfunktion.
- **🐛 Sjukdoms- & skadedjursguide** — symptom, orsak och åtgärd för 8 vanliga problem, från bladlöss till rotröta.
- Mörkt läge följer systeminställningen.

## Färdig APK

En byggd debug-APK finns i [`apk/vaxtdetektor-debug.apk`](apk/vaxtdetektor-debug.apk) — ladda ned den till en Android-enhet och installera (kräver att "okända appar" tillåts).

## Bygga själv

Kräver Node.js, JDK 17+ och Android SDK (plattform 36).

```bash
npm install -g cordova
cd plant-detector
cordova platform add android
cordova build android          # debug-APK
cordova build android --release  # signerad release kräver egen nyckel
```

APK:n hamnar i `platforms/android/app/build/outputs/apk/`.

## Struktur

```
res/icon/android/ – appikon (adaptiv + legacy, alla densiteter)
www/
  index.html      – appens vyer (analysera, historik, bibliotek, guide)
  css/index.css   – stil, mobilanpassad med mörkt läge
  js/analyzer.js  – bildanalysen (canvas + HSV-pixelklassning)
  js/data.js      – kunskapsbas: växter och sjukdomar
  js/index.js     – applogik, navigation och lagring
config.xml        – Cordova-konfiguration
```
