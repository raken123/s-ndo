# Sändo Tavla 1.5.1 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandotavla-1.5.1.apk` | Android 8.0+ (tablet, smartboard, telefon) | 96 KB |

En whiteboard med sidor, där alla andra verktyg är komponenter man placerar ut
på tavlan — 47 komponenter, varav 15 använder AI: tramsdetektorn med cringe-skanning, AI-Läraren som utgår från lärarens PDF:er, och tretton kort till för prov, planering, rättning och förklaringar.

## Installera

```sh
adb install -r sandotavla-1.5.1.apk
```

Eller kopiera filen till plattan och öppna den i filhanteraren. Slå på
"Installera okända appar" för filhanteraren när Android frågar.

## Behörigheter

| Behörighet | Används till |
|---|---|
| Mikrofon | ljuddetektorn och tramsdetektorn |
| Kamera | kameravakten under en utvisning och skanningen av id-kortet vid lärarverifiering (ingen bild lagras eller skickas i något av fallen) |
| Internet | tramsdetektorns AI-läge mot Gemini Live, AI-komponenterna och PDF-uppladdningen |

Allt annat i appen fungerar offline och all data ligger kvar på enheten.

## Rättat i 1.5.1

Textmodellen är en tänkande modell och tanken ryms i samma budget som svaret —
uppmätt ~700 tokens per fråga, som betalades i krediter utan att någon fick se
dem. Tänkandet är avstängt nu, svaren kommer snabbare och kostar mindre, och
ett avhugget svar märks ut i stället för att se ut som ett helt.

## Nytt i 1.5.0

* **Lärarverifiering.** Skanna id-kortet med kameran, så höjs krediterna från
  5 000 kr till 5 000 000 kr. Bilden granskas i minnet och kastas direkt — den
  sparas aldrig och skickas ingenstans. Kvar blir namn, skola och datum.
* **Varning innan en PDF laddas upp.** Läraren måste intyga att sista sidan i
  boken är läst och att det inte står något förbud mot att använda materialet
  med AI, innan filen skickas till Google.

Signerad med självdistributionsnyckeln i `../android/sandotavla.keystore`.
Bygginstruktioner: [`../android/README.md`](../android/README.md).
Om tramsdetektorn: [`../TRAMSDETEKTOR.md`](../TRAMSDETEKTOR.md).
