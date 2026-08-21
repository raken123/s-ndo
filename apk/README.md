# Sändo Tavla 1.0.0 — APK

| Fil | Plattform | Storlek |
|---|---|---|
| `sandotavla-1.0.0.apk` | Android 8.0+ (tablet, smartboard, telefon) | 51 KB |

Klassrumstavla med 33 verktyg. Appen är helt offline — den saknar
INTERNET-behörighet och all data sparas lokalt på enheten.

## Installera

```sh
adb install -r sandotavla-1.0.0.apk
```

Eller kopiera filen till plattan och öppna den i filhanteraren. Slå på
"Installera okända appar" för filhanteraren när Android frågar.

Signerad med självdistributionsnyckeln i `../android/sandotavla.keystore`.
Bygginstruktioner finns i [`../android/README.md`](../android/README.md).
