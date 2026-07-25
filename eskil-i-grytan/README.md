# Eskil i Grytan

Ett Cordova-spel för Android, ritat efter teckningen med samma namn: Eskil står i
grytan med kockmössa och SIGMA-förkläde, och fångar maten som ramlar ner.

All grafik ritas i runtime på en `<canvas>` med en kritrutin (skakiga streck i
flera lager + kladdig fyllning), så spelet har inga bildfiler alls — även
app-ikonen renderas ur samma kod.

## Spela

- **APK:** [`build/eskil-i-grytan-1.0.0-debug.apk`](build/eskil-i-grytan-1.0.0-debug.apk) (debug-signerad, sidoladdas)
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
