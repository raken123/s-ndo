# Chargamo för iPhone

IPA: [`ipa/Chargamo.ipa`](../ipa/Chargamo.ipa) (byggs osignerad av GitHub Actions på en Mac vid varje ändring i `chargamo-ios/`).

Samma app som på Android: bara två fyrkantiga blå ögon på svart bakgrund. När mobilen laddar vaknar Gemini Live
(`gemini-3.8-live`) och ser dig via frontkameran och hör dig via mikrofonen. Vrid mobilen 180° långsamt så dimmas
skärmen och ögonen stängs. Ingen Bluetooth.

## Installera gratis (utan utvecklarlicens för 99 $/år)

Du behöver bara ett vanligt, gratis Apple-ID och en dator.

1. Installera **Sideloadly** från sideloadly.io (Windows eller Mac).
   På Windows: installera även iTunes och iCloud *från Apples webbplats* (inte Microsoft Store).
2. Koppla iPhonen till datorn med kabel och tryck **Lita på** på telefonen.
3. Dra in `Chargamo.ipa` i Sideloadly, skriv in ditt Apple-ID och tryck **Start**.
4. På iPhonen: **Inställningar → Allmänt → VPN och enhetshantering** → välj ditt Apple-ID → **Lita på**.
5. **Inställningar → Integritet och säkerhet → Utvecklarläge** → slå på och starta om telefonen.

Begränsningar med gratis Apple-ID: appen slutar starta efter **7 dagar** och måste installeras om
(Sideloadly kan förnya automatiskt över wifi när datorn är på), och max 3 sådana appar samtidigt.
Alternativ: **AltStore** eller **SideStore** (SideStore förnyar direkt på telefonen efter första installationen).

## Automationer i Genvägar (behövs på iPhone)

iOS låter inga appar starta sig själva eller se vilka andra appar som öppnas, så det sköts av Genvägar-appen:

- **AI:n vaknar vid laddning:** Genvägar → Automation → **+** → **Laddare** → *Är ansluten* → *Kör omedelbart* →
  åtgärd **Öppna app** → Chargamo.
- **Facebook/TikTok-straff:** Genvägar → Automation → **+** → **App** → välj Facebook och TikTok → *Är öppnad* →
  *Kör omedelbart* → åtgärd **Öppna URL:er** → `chargamo://penalty`.
  Om mobilen laddar då, vägrar AI:n vakna i 1 timme.

## Skillnader mot Android

- **Laddningen kan inte stängas av.** iOS har inget sätt för appar att stoppa laddning (inte heller med licens),
  så straffet är att AI:n vägrar vakna i en timme.
- AI:n är bara vaken när appen är öppen. iOS kan inte visa den över låsskärmen.
- Byt Gemini-nyckel genom att öppna `chargamo://key/DIN-NYCKEL` i Safari. Ögonen blinkar två gånger.

## Bygga själv

På en Mac med Xcode 16: `brew install xcodegen`, sedan i `chargamo-ios/`: `xcodegen generate` och öppna `Chargamo.xcodeproj`.
