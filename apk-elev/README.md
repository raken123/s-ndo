# Sändo Elev 1.0.1 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandoelev-1.0.1.apk` | Android 8.0+ (mobil) | 43 KB |

En studieapp för elever. Ladda upp din arbetsbok som PDF, så hjälper **Monni**
dig när du fastnar — utan att säga svaret.

## Installera

```sh
adb install -r sandoelev-1.0.1.apk
```

Eller kopiera filen till telefonen och öppna den i filhanteraren. Slå på
"Installera okända appar" för filhanteraren när Android frågar.

## Vad appen gör

* **📖 Boken** — din arbetsbok som PDF. Monni utgår från just den.
* **💬 Monni** — hjälp när du fastnat, i fyra steg. Sista steget är alltid ditt.
* **🧩 Canvas** — interaktiva exempel du kan dra i: talrad, bråk, rektangel,
  räta linjen, klockan och meningsbyggnad.
* **✏️ Sagor** — uppslag när du inte vet vad du ska skriva om.
* **💎 5 000 000 krediter** gratis från start.

## Monni säger aldrig svaret

Inte om du ber snällt, inte om du ber tio gånger. Regeln hålls på tre ställen
i appen och det finns ingen väg runt den — se
[`../MONNI.md`](../MONNI.md).

## Behörigheter

| Behörighet | Används till |
|---|---|
| Internet | frågorna till Monni och uppladdningen av arbetsboken |

Ingen mikrofon, ingen kamera. Allt utom arbetsboken och frågorna stannar på
telefonen.

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
