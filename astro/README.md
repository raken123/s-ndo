# Astro – ett 3D-rymdspel för Tekniska museet

Du går uppför rampen, in i rymdskeppet, sätter dig i cockpiten och skjuts upp.
Första uppdraget är att flyga till **Månen**. När du kommer fram går du in i
omloppsbana (eller landar), läser fakta och svarar på en fråga. Då låses
**warpmotorn** och nya resmål upp: Venus, Mars och sedan Merkurius, Jupiter,
Saturnus, Uranus, Neptunus och dvärgplaneten Pluto.

* **3D** med Three.js, fungerar på skärm, pekskärm och i VR (WebXR).
* **Status i cockpiten:** hastighet, bränsle, syre, skrov, yttertemperatur,
  mål, avstånd, beräknad ankomst, stjärnor och besökta platser – både på
  instrumentpanelens skärmar och i en HUD.
* **Tidsgräns 20 minuter** per besökare. Varningar vid 5 och 1 minut kvar,
  sedan en sammanfattning och spelet återgår till startskärmen.
* **Kameran känner av om någon står vid spelet** – men aldrig *vem*.
  Se [Kamera och integritet](#kamera-och-integritet).
* Svenska och engelska. Fakta från NASA, ESA m.fl. (se [Källor](#källor)).
* Fungerar helt offline – inga externa filer, all grafik och allt ljud skapas i koden.

## Rymdresan på mejlen

När tiden är slut kan besökaren trycka **📧 Skicka min rymdresa till min e-post**,
skriva in sin adress (på skärmtangentbordet eller ett vanligt tangentbord) och
godkänna. Ett mejl från **astro@tekniskamuseet.se** skickas då med en länk till
inspelningen av hela resan.

* Bara spelets bild och ljud spelas in (960×540) – aldrig kamerabilden.
* Filmen laddas upp till museets **Astro-server** (`astro/server`), som skickar mejlet
  och visar filmen i 30 dagar. Därefter raderas den. E-postadressen sparas inte.
* Funktionen slås på i administratörspanelen genom att fylla i serveradressen och
  API-nyckeln. Se [`server/README.md`](server/README.md).
* Spelas på dator och Android. I VR går det inte att spela in.

## Plattformar

| Plattform | Fil | Hur den byggs |
|---|---|---|
| Windows | `Astro-Setup-<version>.exe` (installation) och `Astro-<version>-portable.exe` | Electron + electron-builder (`astro/desktop`) |
| macOS | `Astro-<version>.dmg` (Intel + Apple Silicon) | Electron + electron-builder (`astro/desktop`) |
| Android (mobil/surfplatta) | `Astro-Android.apk` | Capacitor (`astro/android`) |
| Meta Quest | `Astro-Quest.apk` | Metas Bubblewrap (PWA/TWA, `astro/quest`) |
| Webb | `astro/web/` | Statiska filer, ingen byggprocess |

Alla fyra paketen byggs automatiskt av GitHub Actions
(`.github/workflows/astro-build.yml`) vid varje ändring i `astro/`.
Filerna laddas ner under **Actions → körningen → Artifacts**. Kör arbetsflödet
manuellt (**Run workflow**) och kryssa i *release* för att få en GitHub Release
med alla filer.

### Windows
Kör `Astro-Setup-….exe`, eller starta den portabla `.exe`-filen direkt.
Programmet är inte kodsignerat, så SmartScreen kan fråga – välj *Mer info → Kör ändå*.

### macOS
Öppna `.dmg`-filen och dra Astro till Program. Appen är inte signerad av Apple:
högerklicka → *Öppna* första gången. Om macOS säger att appen är skadad, kör
`xattr -cr /Applications/Astro.app` i Terminal.

### Android
Tillåt installation från okänd källa och öppna `Astro-Android.apk`.
Spelet körs i liggande helskärm; godkänn kameran för närvarodetektering.

### Meta Quest
Quest-versionen är en installerbar webbapp (PWA) inpackad som APK enligt Metas
rekommenderade metod (Bubblewrap / Trusted Web Activity). Den startar direkt i VR.

1. Spelet måste ligga på en https-adress. Som standard används GitHub Pages:
   `https://<ägare>.github.io/<repo>/astro/web/` (repots Pages-arbetsflöde
   publicerar hela repot när ändringarna finns på `main`).
2. Lägg `assetlinks.json` (finns bland Quest-artefakterna) på
   `https://<värd>/.well-known/assetlinks.json`. För en github.io-adress betyder det
   repot `<ägare>/<ägare>.github.io`. Annars vägrar Quest starta appen.
3. Installera APK:n med SideQuest eller Meta Quest Developer Hub (utvecklarläge).

Signeringsnyckel: utan hemligheter skapas en ny nyckel vid varje bygge, vilket
betyder att appen måste avinstalleras före uppdatering och att `assetlinks.json`
måste bytas. Spara en fast nyckel som repo-hemligheterna
`QUEST_KEYSTORE_B64` (base64 av keystore-filen, alias `astro`) och
`QUEST_KEYSTORE_PASSWORD`.

Vill man hellre visa spelet som ett fönster i Horizon OS kan man välja
`quest_app_mode = 2D` när arbetsflödet körs manuellt. I Quest-webbläsaren
fungerar spelet också direkt via knappen **Starta i VR**.

## Styrning

| | Tangentbord | Handkontroll | Pekskärm | VR (Quest) |
|---|---|---|---|---|
| Styra | Piltangenter / WASD (Q/E rolla) | Vänster spak | Spaken till vänster | Vänster spak |
| Gas | Mellanslag | RT | GAS | Höger avtryckare |
| Broms | B / Shift | LT | BROMS | Vänster avtryckare |
| Autopilot | P / Enter | Start / A | Autopilot | A |
| Warp | F | X | Warp | B |
| Stjärnkarta | M | Y | Karta | Y |
| Cockpit/jaktvy | C | Back | Vy | – |

Dialoger väljs med mus/finger, piltangenter + Enter, handkontrollens A-knapp
eller VR-kontrollens stråle + avtryckare.

## Kamera och integritet

Kameran används **bara** för att avgöra om någon står vid spelet, och därmed
när en ny besökare har tagit över:

* Bilden skalas ner till 64 × 48 pixlar i gråskala och jämförs med en bild av
  den tomma platsen (bakgrund) och med föregående bildruta (rörelse).
  I webbläsare som har det inbyggda Shape Detection API:t används dessutom
  `FaceDetector`, som bara säger *att* det finns ett ansikte.
* **Ingen ansiktsigenkänning och ingen identifiering av personer.**
  Inga bilder sparas, skickas eller lagras – allt sker i minnet på enheten.
* Om ingen syns (och ingen rör kontrollerna) på 45 sekunder visas
  *”Är du kvar?”* med 15 sekunders nedräkning. Därefter startar spelet om för
  nästa besökare, med en ny 20-minuterstid.
* Utan kamera används aktivitet på kontrollerna som närvarosignal (90 sekunder).
* På Meta Quest används headsetets närhetssensor: tar man av headsetet räknas
  det som att besökaren har gått.
* En skylt i spelet talar om att kameran används. Kameran kan stängas av i
  administratörspanelen.

## Administratörspanel

Öppna med **Ctrl + Shift + A** eller genom att trycka **5 gånger snabbt i övre
vänstra hörnet** av skärmen. Här ställer man in språk, speltid (standard 20 min),
tid innan omstart vid frånvaro, kamerans känslighet, kalibrering av tom bild
(kör när ingen står framför kameran) och helskärm. Felsökningsbilden visar bara
en förgrundsmask, aldrig kamerabilden.

URL-parametrar för webbversionen: `?minutes=20`, `?lang=en`, `?camera=0`,
`?absent=45`, `?mailServer=https://…&mailKey=…`.

Skrivbordsversionen kan startas i museiläge med `Astro.exe --kiosk`
(avsluta med **Ctrl + Shift + Q**).

## Utveckling

Webbspelet behöver ingen byggprocess:

```sh
cd astro/web
python3 -m http.server 8080   # öppna http://localhost:8080
```

Kameran kräver `localhost` eller https.

```sh
# Skrivbord (Electron)
cd astro/desktop && npm install && npm start
npm run dist:win   # eller dist:mac

# Android (kräver JDK 21 och Android SDK)
cd astro/android && npm install && npm run build:debug

# Meta Quest (kräver JDK 17, Android SDK och npm i -g @meta-quest/bubblewrap-cli)
ASTRO_HOST=exempel.se ASTRO_PATH=/astro/ astro/quest/build-quest.sh
```

### Kodstruktur (`astro/web/js`)

| Fil | Innehåll |
|---|---|
| `main.js` | Tillståndsmaskin: start → ombordstigning → flygning ⇄ omloppsbana → slut |
| `data.js` | Himlakroppar, fakta, frågor och ”Visste du?”-tips (sv/en) |
| `world.js` | Solsystemet, stjärnor, asteroidbälte, verkliga avstånd och temperatur |
| `ship.js` | Rymdskeppet, cockpiten och instrumentskärmarna |
| `hangar.js` | Uppskjutningsplatsen: gå in i skeppet, nedräkning och uppskjutning |
| `flight.js` | Flygmodell, bränsle/syre/skrov, autopilot, warp, faror |
| `presence.js` | Anonym närvarodetektering med kamera |
| `ui.js`, `xr.js`, `input.js`, `audio.js`, `textures.js`, `i18n.js` | Dialoger (HTML + VR-panel), WebXR, kontroller, syntetiskt ljud, procedurella texturer, språk |

Solsystemet är komprimerat så att resor tar sekunder. Statuspanelen räknar om
till verkliga avstånd (t.ex. 384 400 km till Månen) och visar warpfarten som
multiplar av ljusets hastighet – med en påminnelse om att det är science fiction.

## Källor

* NASA Planetary Fact Sheets – <https://nssdc.gsfc.nasa.gov/planetary/factsheet/>
* NASA Science – <https://science.nasa.gov/>
* NASA Artemis II (flög runt Månen 1–10 april 2026)
* ESA – BepiColombo (omloppsbana runt Merkurius november 2026), Christer Fuglesang, Marcus Wandt
* Minor Planet Center / Sky & Telescope – antal månar (mars 2026: Jupiter 101, Saturnus 285)
* NASA – Parker Solar Probe, närmaste passage 24 december 2024

Three.js (MIT-licens) ingår i `astro/web/vendor/`.
