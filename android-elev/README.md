# Sändo Elev — Android

Ett tunt WebView-skal runt webbappen i [`../elev`](../elev/README.md).

## Bygga

```sh
cd android-elev
./gradlew assembleRelease
```

APK:n hamnar i `app/build/outputs/apk/release/app-release.apk`. Webbappen
kopieras in som assets av gradle-uppgiften `copyWebApp` vid varje bygge —
`../elev` är enda källan, det finns ingen kopia att glömma uppdatera.

Signeringen läser `keystore.properties` i den här mappen. Nyckeln är en
självdistributionsnyckel, inte en Play-nyckel.

## Vad skalet gör

Så lite som möjligt. Webben klarar resten själv.

| | |
|---|---|
| Filväljare | `onShowFileChooser` — utan den gör knappen "Ladda upp arbetsbok" ingenting i en WebView |
| Tillbakaknapp | Stänger först ett öppet bottenark, sedan tillbaka till Boken, sedan ut ur appen |
| Tangentbord | `adjustResize`, så att skrivraden inte hamnar under tangentbordet |
| Textzoom | Låst till 100 % — systemets textstorlek får inte spränga en layout byggd i css-pixlar |
| Länkar utåt | Öppnas i webbläsaren i stället för att kapa appens vy |

## Behörigheter

Bara `INTERNET` och `ACCESS_NETWORK_STATE`.

Ingen mikrofon, ingen kamera, ingen lagring. Monni är en textmodell och appen
ber aldrig om något annat. Det är skillnaden mot Sändo Tavla, som behöver både
mikrofon och kamera för tramsdetektorn.

Appen är låst till stående läge: `screenOrientation="portrait"`.

## Krav

* Android 8.0 (API 26) och uppåt
* AGP 8.7.3, compileSdk 35, Java 17
