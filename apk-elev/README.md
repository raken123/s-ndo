# Sändo Elev 1.1.0 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandoelev-1.1.0.apk` | Android 8.0+ (mobil och Android Auto) | 2,1 MB |

En studieapp för elever. Ladda upp din arbetsbok som PDF, så hjälper **Monni**
dig när du fastnar — utan att säga svaret.

## Installera

```sh
adb install -r sandoelev-1.1.0.apk
```

Eller kopiera filen till telefonen och öppna den i filhanteraren. Slå på
"Installera okända appar" för filhanteraren när Android frågar.

## Vad appen gör

* **📖 Boken** — din arbetsbok som PDF. Monni utgår från just den.
* **💬 Monni** — hjälp när du fastnat, i fyra steg. Sista steget är alltid ditt.
* **🧩 Canvas** — interaktiva exempel du kan dra i: talrad, bråk, rektangel,
  räta linjen, klockan och meningsbyggnad.
* **✏️ Sagor** — uppslag när du inte vet vad du ska skriva om.
* **📍 Matteplatser** — fem frågor per plats, tjugo sekunder var. Rätt svar
  ger krediter.
* **🚗 Android Auto** — bilskärmen visar platserna i närheten och Monnis
  senaste knuffar.
* **💎 5 000 000 krediter** gratis från start.

## Monni säger aldrig svaret

Inte om du ber snällt, inte om du ber tio gånger. Regeln hålls på tre ställen
i appen och det finns ingen väg runt den — se
[`../MONNI.md`](../MONNI.md).

## Behörigheter

| Behörighet | Används till |
|---|---|
| Internet | frågorna till Monni och uppladdningen av arbetsboken |
| Plats | Matteplatser — vilka som ligger inom 400 meter |

Ingen mikrofon, ingen kamera. Positionen lämnar aldrig telefonen: platserna
räknas fram lokalt ur koordinaterna, det finns ingen karttjänst att fråga.

## Rättat i 1.1.0 — appen fungerade inte

Monni svarade aldrig och arbetsboken gick inte att ladda upp. Vyerna ritades,
knapparna gick att trycka på, men allt som krävde nätet dog tyst.

Appen laddades från `file:///android_asset/index.html`. En WebView har sedan
API 16 `allowUniversalAccessFromFileURLs = false`: en sida på `file://` har
inget riktigt ursprung och får inte göra fetch någon annanstans. Varje anrop
till Google dog inne i WebView:n innan det blev ett nätverksanrop.

Flaggan går att slå på, och det är fel väg — den ger vilken lokal html-fil som
helst rätt att läsa vad som helst. I stället serveras appen nu över ett riktigt
https-ursprung med `WebViewAssetLoader`. Det gav tre saker på köpet:
localStorage fick ett stabilt ursprung, `navigator.geolocation` började
fungera (den vägrar också på `file://`), och `allowFileAccess` kunde stängas av
helt.

## Nytt i 1.1.0

**📍 Matteplatser.** Inom 400 meter från där du står ligger fem platser. Gå dit
— du måste vara inom 40 meter — och svara på fem frågor med tjugo sekunder på
dig per fråga. Rätt svar ger 400, 900 eller 1600 krediter beroende på nivå.

Platserna räknas fram ur koordinaterna med en slumpgenerator som såddes med
rutans eget nummer, så samma gata ger alltid samma platser, i dag och nästa år
— utan att någon någonsin fick veta var du stod. Frågorna räknas fram lokalt av
samma skäl som de måste: tjugo sekunder räcker inte till ett API-anrop, och en
fråga som kostar krediter är fel sätt att dela ut krediter.

**🚗 Android Auto.** Läxan ligger tre timmar bort och Monni finns i telefonen.
Bilskärmen visar Matteplatserna i närheten på kartan och de senaste knuffarna
Monni gav — läsbart under färd, resten först när bilen står still.

Det går inte att fråga något nytt i bilen och inte att ladda upp en bok. En
bilskärm har varken tangentbord eller filväljare, och en tjugosekundersfråga är
exakt fel sak att lägga framför någon som kör.

Till skillnad från CarPlay-versionen går den här att köra på riktigt: Apple
delar bara ut CarPlay-rättigheten till en fast lista kategorier som en
studieapp inte finns på, medan Android Auto kör en app man installerat själv så
snart "Okända källor" är påslaget i utvecklarinställningarna.

## Rättat i 1.0.1

Monni svarade halva meningar, eller inget alls. Textmodellen är en tänkande
modell och tanken ryms i samma budget som svaret: uppmätt mot API:t åt den
862 av 900 tokens och lämnade 34 till svaret. Tänkandet är avstängt nu, och
hela budgeten går till det eleven ser. Samtidigt:

* ett avhugget svar märks ut i stället för att visas som ett helt
* LaTeX och markdown städas bort — `$8 \times 7$` blev stående som just det
* utan API-nyckel står det i appen vad som saknas och var man fixar det,
  i stället för att knapparna bara inte gör något

Signerad med självdistributionsnyckeln i `../android-elev/sandoelev.keystore`.
Bygginstruktioner: [`../android-elev/README.md`](../android-elev/README.md).
