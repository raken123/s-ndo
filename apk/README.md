# Sändo Tavla 1.4.1 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandotavla-1.4.1.apk` | Android 8.0+ (tablet, smartboard, telefon) | 90 KB |

En whiteboard med sidor, där alla andra verktyg är komponenter man placerar ut
på tavlan — 47 komponenter, varav 15 använder AI: tramsdetektorn med cringe-skanning, AI-Läraren som utgår från lärarens PDF:er, och tretton kort till för prov, planering, rättning och förklaringar.

## Installera

```sh
adb install -r sandotavla-1.4.1.apk
```

Eller kopiera filen till plattan och öppna den i filhanteraren. Slå på
"Installera okända appar" för filhanteraren när Android frågar.

## Behörigheter

| Behörighet | Används till |
|---|---|
| Mikrofon | ljuddetektorn och tramsdetektorn |
| Kamera | kameravakten under en utvisning (ingen bild lagras eller skickas) |
| Internet | enbart tramsdetektorns AI-läge mot Gemini Live |

Allt annat i appen fungerar offline och all data ligger kvar på enheten.

Signerad med självdistributionsnyckeln i `../android/sandotavla.keystore`.
Bygginstruktioner: [`../android/README.md`](../android/README.md).
Om tramsdetektorn: [`../TRAMSDETEKTOR.md`](../TRAMSDETEKTOR.md).
