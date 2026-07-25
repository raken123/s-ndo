# Eskil i Grytan

Ett Cordova-spel för Android, ritat efter teckningen med samma namn: Eskil står i
grytan med kockmössa och SIGMA-förkläde, och fångar maten som ramlar ner.

All grafik ritas i runtime på en `<canvas>` med en kritrutin (skakiga streck i
flera lager + kladdig fyllning), så spelet har inga bildfiler alls — även
app-ikonen renderas ur samma kod.

## Spela

- **APK:** [`build/eskil-i-grytan-1.1.0-debug.apk`](build/eskil-i-grytan-1.1.0-debug.apk) (debug-signerad, sidoladdas)
- **Webbläsare:** öppna `www/index.html`

Styrning: dra fingret över skärmen, eller piltangenter/A och D. `M` stänger av ljudet.

## Spelet

| | |
|---|---|
| Mat (morot, tomat, broccoli, svamp, lök, ost, ägg, potatis, chili) | poäng |
| Skräp (känga, bomb, fiskben, strumpa) | −1 liv av 3 |
| Gyllene sked | dubbla poäng i 8 sekunder |

Kombo ger upp till +150 % poäng, och farten ökar för var tionde fångad ingrediens.
Rekordet sparas lokalt.

## Mörka hemligheter

Spelet har sex dolda hemligheter. Ingen av dem nämns i spelet — men titelskärmen
räknar hur många du hittat och ger en ledtråd till varje oupptäckt (`MÖRKA
HEMLIGHETER 0/6` nere till vänster). Hittade hemligheter sparas för gott.

En av dem släcker ljuset: papperet svartnar, kritorna blir det enda som syns,
Eskils ögon lyser och allt är värt dubbelt. Två av hemligheterna går bara att
hitta i mörkret.

<details>
<summary>Facit (spoilers)</summary>

| Hemlighet | Så hittar du den | Vad den gör |
|---|---|---|
| MIDNATT | Kombo x13 | 20 s nattläge, dubbla poäng |
| SPÖKET | Fånga spöket, som bara faller i mörkret | 100 poäng |
| ÖGAT | Fånga ögat, sällsynt från nivå 4 | fem fångster värda 3× |
| KOKBOKEN | Nå 666 poäng | ett extra hjärta, plus natt |
| MÖSSAN | Knacka sju gånger på kockmössan på titelskärmen (eller Konami-koden) | en mus flyttar in på grytkanten |
| SPISEN | Tryck fem gånger på vänstra spisplattan på titelskärmen | elden viskar |

</details>

## Bygga om

Kräver Node, JDK 17+ och Android SDK (platform 36 + build-tools 36).

```bash
npm install -g cordova
cordova platform add android
cordova build android --debug
```

Ikonerna ligger i `res/` och genereras av `window.__renderIcon(size, pad)` i
`www/index.html` — kör den i en webbläsare och spara ut PNG:erna om grafiken ändras.

## Struktur

```
config.xml     appnamn, paket-id, orientering, ikoner, splash
www/index.html hela spelet (motor, grafik, ljud) i en fil
res/           app-ikoner per densitet + splash-symbol
build/         färdig APK
```
