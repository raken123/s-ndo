# Sändo Fandom

En Cordova-app för att bygga upp en publik: redigera foton med stil, göra affischer,
spela in korta presentationsvideor, publicera allt på en gemensam vägg och planera event
som automatiskt får sitt eget kampanjmaterial.

Hela appen är en enda självbärande fil (`www/index.html`) — ingen byggkedja, inga externa
beroenden, inga nätverksanrop. All data ligger kvar på enheten.

## Vad appen gör

| Vy | Vad du gör där |
| --- | --- |
| **Hem** | Följare, räckvidd, streak och nästa milstolpe. Dagens utmaning och konkreta tillväxtråd. |
| **Foto** | 8 stilar (Neon, Retro 90, Filmisk, Midnatt …), 7 justeringar, ramar, textplattor i fyra typsnitt, stickers som dras direkt i bilden. Format 1:1, 4:5, 9:16 och 16:9. |
| **Affisch** | 6 mallar (konsert, merch-släpp, fan-meet, livesändning, turné, fanart-tävling), 8 paletter, 4 layouter, 5 mönster. Kan även lägga ett foto bakom. |
| **Video** | Inspelning med kamera och rullande manus i bild, max 30 s. Utan kamera: animerad teaser-video som renderas på canvas och spelas in via `captureStream`. |
| **Vägg** | Gemensamt flöde med filter och sortering. Gillningar, kommentarer, följ-knapp och trendande taggar. |
| **Event** | Datum med live-nedräkning, checklista per eventtyp, gästlista med OSA — och ett klick som genererar affisch, story och teaser från eventets uppgifter. |
| **Profil** | Namn, handle, bio, profilbild, utmärkelser och galleri. |

Tillväxten är en modell, inte en simulering av riktiga användare: varje inlägg poängsätts
efter typ, bildtext, taggar och streak, och ger följare och räckvidd därefter. Videor ger mest.

## Bygga appen

```bash
cd cordova
npm install
npx cordova platform add android    # och/eller: ios
npx cordova run android
```

Ikoner och splash-bilder ligger färdiggenererade i `res/`. Vill du ändra märket:

```bash
pip install pillow
npm run icons        # ritar om allt från tools/make_icons.py
```

## Öppna utan att bygga

`www/index.html` fungerar direkt i en webbläsare — dubbelklicka på filen. Appen upptäcker
att `cordova.js` saknas och startar ändå. Kameran kräver `https://` eller `localhost`
i webbläsare; på enhet fungerar den via appens egna behörigheter.

## Struktur

```
cordova/
├── config.xml              Cordova-manifest: ikoner, splash, behörigheter, plugins
├── package.json            Byggskript och plugin-versioner
├── www/index.html          Hela appen: markup, designsystem och logik
├── www/img/                Ikon i webbstorlekar
├── res/icon/               Ikoner för Android (inkl. adaptiva) och iOS
├── res/screen/             Splash-bilder
└── tools/make_icons.py     Genererar alla ikoner och splash-bilder
```

## Behörigheter

Kamera och mikrofon används enbart när du själv startar en inspelning. Bilder, videor och
all annan data sparas i enhetens `localStorage` och `IndexedDB` — inget lämnar telefonen,
och `Nollställ all data` under Profil raderar allt.

## Färdig APK

En installerbar debug-APK byggs automatiskt av `.github/workflows/android.yml` vid varje
push till `cordova/` — ladda ner den under **Actions → Bygg Android-APK → Artifacts**.

Bygga lokalt i stället:

```bash
cd cordova
npm install
npx cordova platform add android
npx cordova build android --debug
# → platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

Kräver JDK 21 och Android SDK 35. APK:n är signerad med Androids debug-nyckel, vilket räcker
för att installera direkt på en telefon (slå på "Installera okända appar"), men inte för
Google Play — dit krävs en `--release`-build signerad med en egen nyckel.
