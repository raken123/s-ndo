# Slut

Ett spel på svenska där du spelar som **Elsa** i 6A på Ekbackens skola.

Fröken gör Elsa till fadder för nya killen Jason: de ska hålla ihop hela tiden.
Förra utflykten åkte Elsa och hennes pojkvän Johan vanlig skolbuss. Den här
gången får Elsa och Jason åka röd dubbeldäckare och sitta själva längst fram på
övervåningen. Jason ger henne sitt nummer. Och Johan vet vad de skriver –
under Elsas meddelanden står det plötsligt *Läst av 2*. Han tänker ta hämnd.

- En berättelse i jagform: prolog, sex kapitel och en epilog
- Du väljer vad Elsa skriver i chatten – och Johan citerar det dagen efter
- Tre olika slut, beroende på om du berättar för någon, försöker lösa allt
  själv eller tar hämnd tillbaka
- Fyra banor: frågesport i museet medan Johan följer efter, riv ner
  utskrifterna av dina meddelanden innan rasten, ta dig hem genom en mörk park
  där någon går efter dig, och smyg till teknikrummet på avslutningsdagen
- Sex minispel, bland annat att logga ut okända enheter från ditt konto och
  välja ett lösenord som ingen kan gissa
- All grafik, musik och alla ljud skapas i spelet – inga externa filer, inget
  internet behövs

## Ladda ner

Alla filer finns under releasen
[**Slut 1.0.0**](https://github.com/raken123/s-ndo/releases/tag/slut-v1.0.0).

| Fil | Plattform |
|---|---|
| `Slut-Setup-1.0.0.exe` | Windows 10/11 – installerar spelet och lägger en genväg på skrivbordet |
| `Slut-1.0.0-portable.exe` | Windows – startar direkt utan installation |
| `Slut-1.0.0-mac-arm64.dmg` | Mac med Apple-chip (M1, M2, M3, M4 …) |
| `Slut-1.0.0-mac-x64.dmg` | Mac med Intel-processor |
| `Slut-1.0.0.apk` | Android 7.0 eller nyare |
| `slut_1.0.0_amd64.deb` | Linux (Debian/Ubuntu) |
| `Slut-1.0.0.html` | vilken webbläsare som helst – hela spelet i en enda fil |

**Windows:** spelet är inte signerat med ett certifikat. Om SmartScreen säger
*"Windows skyddade datorn"*, klicka **Mer information** och sedan **Kör ändå**.

**macOS:** öppna DMG-filen och dra **Slut** till **Program**. Första gången säger
macOS att appen inte kan öppnas – gå till **Systeminställningar → Integritet
och säkerhet** och klicka **Öppna ändå**.

**Android:** öppna APK-filen på mobilen och tillåt installation från den källan.
Spelet körs i liggande läge och behöver inga behörigheter.

## Så spelar du

| | Dator | Mobil |
|---|---|---|
| Läs vidare | klick, mellanslag eller Enter | tryck på skärmen |
| Gå | WASD eller piltangenterna | vänster tumme på skärmen |
| Spring | Shift | knappen SPRING |
| Göm dig i ett skåp | E | knappen E |
| Mobilens lampa | F | knappen LJUS |
| Paus | Esc | II-knappen eller bakåtknappen |

Spelet sparar i början av varje kapitel. Om en bana känns för svår dyker knappen
**Hoppa över banan** upp efter första försöket.

## Om någon läser dina meddelanden

Det är inte ditt fel, och det är inte kärlek att läsa någons mobil. Berätta för
en vuxen du litar på. Du kan också ringa eller chatta med **BRIS: 116 111**.

## För utvecklare

Slut bygger på samma motor som Skräckappen (`../skrackappen`), men i en egen
kopia så att spelen kan ändras var för sig.

```
slut/
  www/          själva spelet (HTML, CSS och JavaScript, inga beroenden)
    js/story.js   berättelsen, rollistan (SK.CAST), sluten och menytexterna (SK.GAME)
    js/levels.js  banorna som textkartor; "cast" bestämmer vem som jagar eller patrullerar
  desktop/      Electron-skal för Windows (.exe), macOS (.dmg) och Linux (.deb)
  android/      Android-app (WebView) som bygger en .apk
  test/         Playwright-tester
  tools/        make_icons.py ritar ikonerna, build_single_html.py gör spelet till en fil
```

```sh
cd slut/desktop && npm install && npm start      # kör spelet på datorn
cd slut/android && ./gradlew assembleRelease     # bygger APK:n (Android SDK + Java 17)
node test/playthrough.js "0,0,0,0,0,0,0,0"       # spelar igenom berättelsen med de valen
```

APK:n signeras med en demonyckel som ligger i projektet
(`android/app/slut-demo.jks`); lösenordet står i `app/build.gradle`. Sätt
`SLUT_KEYSTORE`, `SLUT_KEYSTORE_PASSWORD` och `SLUT_KEY_ALIAS` till en egen
nyckel innan spelet läggs upp någon annanstans.

`.github/workflows/slut.yml` bygger alla filer på GitHubs Windows-, macOS- och
Linux-maskiner vid varje ändring i `slut/`, startar apparna för att se att
spelet laddas, och lägger upp dem i releasen.
