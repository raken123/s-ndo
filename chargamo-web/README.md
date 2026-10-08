# Chargamo på webben

En enda sida, `index.html`, utan några beroenden. Bara två fyrkantiga blå ögon på svart bakgrund.

- **Tryck en gång på skärmen** för att väcka Chargamo. Webbläsare tillåter ljud, kamera, helskärm och rörelsesensorer först efter ett tryck.
- När enheten laddar vaknar Gemini Live (`gemini-3.8-live`) och ser dig via frontkameran och hör dig via mikrofonen.
- Vrid mobilen 180° långsamt → ljuset blir mörkare och ögonen stängs. Vrid tillbaka långsamt så vaknar den.
- Skärmen hålls tänd medan sidan är öppen (Wake Lock).

## Länkar

- `#penalty` i slutet av adressen startar 1 timmes straff om enheten laddar (för en Genvägar-/MacroDroid-automation när Facebook eller TikTok öppnas).
- `#key=DIN-NYCKEL` byter Gemini-nyckel. Ögonen blinkar två gånger.

## Begränsningar på webben

- Laddning syns bara i Chrome/Edge/Samsung Internet (Battery API). I Safari och Firefox går det inte att se om enheten laddar, så där är AI:n vaken så fort sidan är öppen.
- En webbsida kan inte se andra appar, inte stoppa laddning och inte starta sig själv när laddaren kopplas in.
- Sidan måste ligga på https (eller localhost) för att kamera och mikrofon ska fungera.
