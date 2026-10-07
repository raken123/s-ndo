# Chargamo

Android-app för den AI-drivna magnetladdaren Chargamo. Skärmen visar bara två fyrkantiga blå ögon på svart bakgrund.

APK: [`apk/Chargamo.apk`](../apk/Chargamo.apk) (byggs automatiskt av GitHub Actions vid varje ändring i `chargamo/`).

## Vad den gör

- **Laddning startar → AI:n vaknar.** Chargamo öppnas av sig själv och startar en Gemini Live-konversation
  (modell `gemini-3.8-live`) som ser dig via frontkameran och hör dig via mikrofonen. Ingen Bluetooth.
- **Du får lämna appen medan den laddar.** AI:n pausar och vaknar igen när du kommer tillbaka.
- **Facebook eller TikTok medan den laddar → laddningen stängs av i 1 timme.**
- **Vrid mobilen 180° långsamt → skärmen dimmas och ögonen stängs** (AI:n sover). Vrid tillbaka långsamt så vaknar den.

## Kom igång

1. Installera `Chargamo.apk` (tillåt installation från okända källor).
2. Öppna appen och godkänn kamera, mikrofon och aviseringar. Appen öppnar sedan systeminställningar för
   **Användningsåtkomst**, **Visa över andra appar** och **Batterioptimering** – slå på Chargamo i alla tre.
   Är Användningsåtkomst gråmarkerad: Inställningar → Appar → Chargamo → ⋮ → *Tillåt begränsade inställningar*.
3. En Gemini API-nyckel är inbyggd i appen. Vill du byta: markera en ny nyckel (börjar med `AIza…` eller `AQ.…`),
   välj **Dela** och dela den till **Chargamo AI-nyckel**. Ögonen blinkar två gånger när den är sparad.

## Att veta

- **Att stänga av själva laddningen kräver root.** Android har inget vanligt sätt för en app att stoppa laddning,
  så Chargamo skriver till laddarens kernel-filer via `su`. Utan root blir straffet att AI:n vägrar vakna i en timme
  och aviseringen visar när laddningen tillåts igen – men strömmen fortsätter gå in i batteriet.
- Facebook och TikTok upptäcks via deras appar (inte via webbläsaren).
- Den inbyggda nyckeln ligger i `app/build.gradle.kts` och är synlig för alla eftersom repot är publikt.
  Bygg med en annan nyckel: `gradle assembleRelease -PGEMINI_API_KEY=...` (Gradle 8.14, JDK 17, Android SDK 35)
  (och `-PGEMINI_MODEL=...` för en annan modell).
- APK:n signeras med nyckeln i `app/chargamo-sideload.jks.b64` (lösenord `chargamo`) så att nya byggen installeras som uppdateringar.
