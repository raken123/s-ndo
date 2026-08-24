# Sändo Elev 1.0.0 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandoelev-1.0.0.apk` | Android 8.0+ (mobil) | 40 KB |

En studieapp för elever. Ladda upp din arbetsbok som PDF, så hjälper **Monni**
dig när du fastnar — utan att säga svaret.

## Installera

```sh
adb install -r sandoelev-1.0.0.apk
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

Signerad med självdistributionsnyckeln i `../android-elev/sandoelev.keystore`.
Bygginstruktioner: [`../android-elev/README.md`](../android-elev/README.md).
