# Skräckappen

Ett skräckspel på svenska, fritt efter en idé ur en bok av Ann Olerot.

Kasper går i sexan på Norrskolan. Varje dag jagar Ruben och Tilda honom genom
korridorerna. En natt säger AI:n i hans mobil att den har hittat en lösning:
**Panterappen**. Den stoppar mobbningen – men den kan aldrig avinstalleras, och
den som inte klarar sina uppdrag får straff. Sedan får Ruben appen. Sedan får
hela skolan den.

- En lång berättelse: prolog, åtta kapitel och en epilog
- Val som spelar roll – lyda Pantern eller vägra, ljuga eller säga sanningen
- Tre olika slut
- Sex banor: jakter i korridoren och gympasalen, en tidsjakt på skolgården,
  smygande förbi "de lydiga" och mörka nivåer där Pantern jagar dig och bara
  mobilens lampa skyddar
- Minispel: försök avinstallera appen, håll andan, pulskontroll, hitta rätt
  meddelande bland Panterns falska, ett kodlås och finalen i aulan
- All grafik, musik och alla ljud skapas i spelet – inga externa filer, inget
  internet behövs

## Ladda ner

Alla filer finns under releasen
[**Skräckappen 1.0.0**](https://github.com/raken123/s-ndo/releases/tag/skrackappen-v1.0.0).

| Fil | Plattform |
|---|---|
| `Skrackappen-Setup-1.0.0.exe` | Windows 10/11 – installerar spelet och lägger en genväg på skrivbordet |
| `Skrackappen-1.0.0-portable.exe` | Windows – startar direkt utan installation |
| `Skrackappen-1.0.0-mac-arm64.dmg` | Mac med Apple-chip (M1, M2, M3, M4 …) |
| `Skrackappen-1.0.0-mac-x64.dmg` | Mac med Intel-processor |
| `Skrackappen-1.0.0.apk` | Android 7.0 eller nyare |
| `skrackappen_1.0.0_amd64.deb` | Linux (Debian/Ubuntu) |
| `Skrackappen-1.0.0.html` | vilken webbläsare som helst – hela spelet i en enda fil |

Du kan också spela direkt från projektet: öppna `www/index.html` i webbläsaren.

### Windows

Dubbelklicka på `Skrackappen-Setup-1.0.0.exe`. Spelet är inte signerat med ett
certifikat, så Windows SmartScreen kan säga *"Windows skyddade datorn"*. Klicka
på **Mer information** och sedan **Kör ändå**.

### macOS

Öppna DMG-filen och dra **Skrackappen** till **Program**. Appen är inte
granskad av Apple, så första gången säger macOS att den inte kan öppnas. Gå då
till **Systeminställningar → Integritet och säkerhet**, scrolla ner och klicka
**Öppna ändå**. Det går också med Terminalen:

```sh
xattr -dr com.apple.quarantine /Applications/Skrackappen.app
```

### Android

Ladda ner `Skrackappen-1.0.0.apk` på mobilen och öppna filen. Android frågar om
du vill tillåta installation från den här källan (till exempel Chrome eller
Filer) – tillåt det och tryck **Installera**. Spelet körs i liggande läge och
behöver inga behörigheter.

## Så spelar du

| | Dator | Mobil |
|---|---|---|
| Läs vidare | klick, mellanslag eller Enter | tryck på skärmen |
| Gå | WASD eller piltangenterna | vänster tumme på skärmen |
| Spring | Shift | knappen SPRING |
| Göm dig i ett skåp | E | knappen E |
| Mobilens lampa | F | knappen LJUS |
| Paus | Esc | II-knappen eller bakåtknappen |
| Helskärm | F11 | – |

Håll Ctrl för att spola fram text du redan har läst. Under **Inställningar**
finns volym, textfart och *lugnare effekter* (mindre skakningar och flimmer).
Om en bana känns för svår dyker knappen **Hoppa över banan** upp efter första
försöket.

Spelet sparar automatiskt i början av varje kapitel. Kapitel du har nått kan du
spela om från menyn **Kapitel**.

## Blir du mobbad?

Du är inte ensam och det är inte ditt fel. Berätta för en vuxen du litar på. Du
kan också ringa eller chatta med **BRIS: 116 111**.

## För utvecklare

```
skrackappen/
  www/          själva spelet (HTML, CSS och JavaScript, inga beroenden)
    js/story.js   hela berättelsen
    js/levels.js  banorna som textkartor
    js/engine.js  banspelet: Kasper, jagarna och Pantern
    js/director.js berättelsemotorn: dialog, mobilen, val, sparning
    js/scenes.js  bakgrunderna   js/art.js  figurer och rutor
    js/audio.js   musik och ljud (Web Audio)   js/minigames.js  minispelen
  desktop/      Electron-skal för Windows (.exe), macOS (.dmg) och Linux (.deb)
  android/      Android-app (WebView) som bygger en .apk
  test/         Playwright-tester
  tools/        make_icons.py ritar alla ikoner, build_single_html.py gör spelet till en fil
```

**Dator:**

```sh
cd skrackappen/desktop
npm install
npm start              # kör spelet
npm run dist:win       # .exe  (på Windows)
npm run dist:mac       # .dmg  (på macOS)
npm run dist:linux     # .deb  (på Linux)
```

**Android** (kräver Android SDK och Java 17):

```sh
cd skrackappen/android
./gradlew assembleRelease   # app/build/outputs/apk/release/app-release.apk
```

APK:n signeras med en demonyckel som ligger i projektet
(`android/app/skrackappen-demo.jks`), så att nya versioner kan installeras över
gamla. Lösenordet står i `app/build.gradle`, så nyckeln är inte hemlig – sätt
`SKRACK_KEYSTORE`, `SKRACK_KEYSTORE_PASSWORD` och `SKRACK_KEY_ALIAS` till en egen
nyckel innan spelet läggs upp någon annanstans.

**Automatiska byggen:** `.github/workflows/skrackappen.yml` bygger alla filer på
GitHubs egna Windows-, macOS- och Linux-maskiner vid varje ändring i
`skrackappen/`, startar apparna för att se att spelet laddas, och lägger upp dem
i releasen.

**Tester** (behöver Playwright och Chromium):

```sh
node test/playthrough.js "0,0,0,1,1,0,1,0"   # spelar igenom hela berättelsen med de valen
node test/levels.js                          # en bot försöker klara varje bana
```
