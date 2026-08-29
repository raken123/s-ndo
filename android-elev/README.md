# Sändo Elev — Android

Ett tunt WebView-skal runt webbappen i [`../elev`](../elev/README.md), plus en
Android Auto-del som ritar mallar i stället för vyer.

## Bygga

```sh
cd android-elev
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease
```

APK:n hamnar i `app/build/outputs/apk/release/app-release.apk`. Webbappen
kopieras in som assets av gradle-uppgiften `copyWebApp` vid varje bygge —
`../elev` är enda källan, det finns ingen kopia att glömma uppdatera.

Signeringen läser `keystore.properties` i den här mappen. Nyckeln är en
självdistributionsnyckel, inte en Play-nyckel.

## https, inte file://

Det här är den viktigaste raden i hela skalet, och den syns inte i något
byggfel.

Appen laddades tidigare från `file:///android_asset/index.html`. Det såg ut att
fungera — men en WebView har sedan API 16 `allowUniversalAccessFromFileURLs =
false`, och en sida på `file://` har inget riktigt ursprung. Alla anrop till
`generativelanguage.googleapis.com` dog inne i WebView:n. Monni svarade aldrig
och arbetsboken gick inte att ladda upp.

Flaggan går att slå på och det är fel väg: den ger vilken lokal html-fil som
helst rätt att läsa vad som helst. I stället serveras assets över
`https://appassets.androidplatform.net/assets/` med `WebViewAssetLoader`.
Värdnamnet är reserverat av Google för just det här och slår aldrig upp mot en
riktig server.

Tre saker följde med på köpet:

* `localStorage` fick ett stabilt ursprung
* `navigator.geolocation` började fungera — den vägrar också på `file://`
* `allowFileAccess` och `allowContentAccess` kunde stängas av helt

## Vad skalet gör

Så lite som möjligt. Webben klarar resten själv.

| | |
|---|---|
| Assets över https | `WebViewAssetLoader` — utan det når appen inte nätet alls |
| Filväljare | `onShowFileChooser` — utan den gör knappen "Ladda upp arbetsbok" ingenting i en WebView |
| Position | `onGeolocationPermissionsShowPrompt` — två lager tillstånd, Androids och WebView:ns |
| Bron till bilen | `Delat` — telefonen skriver, bilskärmen läser |
| Tillbakaknapp | Stänger först ett öppet bottenark, sedan tillbaka till Boken, sedan ut ur appen |
| Tangentbord | `adjustResize`, så att skrivraden inte hamnar under tangentbordet |
| Textzoom | Låst till 100 % — systemets textstorlek får inte spränga en layout byggd i css-pixlar |
| Länkar utåt | Öppnas i webbläsaren i stället för att kapa appens vy |

## Android Auto

`bil/SandoBilTjanst` är ingången. Android Auto startar den tjänsten, inte
`MainActivity` — bilen får aldrig se en WebView.

| Skärm | Visar |
|---|---|
| `StartSkarm` | två vägar in, och kreditsaldot |
| `PlatserSkarm` | Matteplatserna i närheten, med kartnål och avstånd |
| `PlatsSkarm` | en plats: avstånd, nivå, belöning — bara i stillastående bil |
| `KnuffarSkarm` | Monnis senaste knuffar — bara i stillastående bil |

Det går inte att svara på frågor i bilen, inte att fråga något nytt och inte
att ladda upp en bok. En bilskärm har varken tangentbord eller filväljare, och
en tjugosekundersfråga är exakt fel sak att lägga framför någon som kör.

Kategorin är `androidx.car.app.category.POI`. Det är inte en efterhandsursäkt:
det appen visar i bilen *är* platser i närheten, med koordinater bilen sätter
ut på kartan.

### Att köra den

```sh
adb install -r app/build/outputs/apk/release/app-release.apk
```

Sedan, en gång per telefon:

1. Android Auto → Inställningar → tryck tio gånger på "Version"
2. Trepunktsmenyn → Utvecklarinställningar → **Okända källor** på
3. Anslut till bilen, eller kör Desktop Head Unit från Android SDK

Steg 2 behövs för att appen inte är distribuerad via Play. Till skillnad från
CarPlay finns det ingen rättighet att ansöka om och bli nekad: Android Auto kör
en app man installerat själv så snart flaggan är på. Distribution via Play
skulle däremot kräva att appen passar in i en av Googles bilkategorier, och en
studieapp gör inte det.

## Behörigheter

`INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_COARSE_LOCATION`,
`ACCESS_FINE_LOCATION`.

Ingen mikrofon, ingen kamera, ingen lagring. Monni är en textmodell. Positionen
används bara till Matteplatser och lämnar aldrig telefonen — platserna räknas
fram lokalt ur koordinaterna, det finns ingen karttjänst att fråga. Gps är inte
ett krav: utan den försvinner Matteplatser, inte appen.

Appen är låst till stående läge: `screenOrientation="portrait"`.

## Krav

* Android 8.0 (API 26) och uppåt
* AGP 8.7.3, compileSdk 35, Java 17
