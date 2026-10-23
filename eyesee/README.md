# Raken EyeSee: EyeSee OS 1.0

Ett operativsystem för de smarta glasögonen Raken EyeSee, simulerat i en enda
HTML-fil (`index.html`). Inget byggsteg och inga beroenden. Öppna filen i en
webbläsare, eller gå till `/eyesee/` på GitHub Pages när grenen är mergad till
`main`.

## Vad du ser

- **Världen**: en procedurgenererad gågata med skyltar, gatlyktor och folk.
  Dagsljuset följer Stockholms soluppgång och solnedgång för dagens datum.
  Byt till kameran eller ett eget foto i *Simulator*.
- **HUD:en**: en additiv skärm (svart blir genomskinligt) i ett synfält på
  30°. Fem HUD-färger med våglängd, ljusstyrka i nits och linsdimning bakom
  skärmytan.
- **Bågen**: pekyta, kameraknapp och kameralampa längst ned.

## Styrning

| Gest på pekytan | Tangent | Gör |
|---|---|---|
| Svep ← → | ← → | Flytta markören |
| Tryck | Enter | Välj |
| Svep nedåt | Esc | Tillbaka (på hemskärmen: släck skärmen) |
| Håll inne | A | Raken AI |
| Kameraknappen | C | Ta ett foto, från vilken app som helst |
| | H / S | Hem / släck skärmen |

Det går också att klicka och svepa direkt i bilden.

## Appar

Raken AI · Navigera · Kamera · Galleri · Meddelanden · Undertexter · Musik ·
Timer · Hälsa · Inställningar · Om EyeSee

## Raken AI

- **Öppnad som artefakt i Claude**: frågorna går till Claude. "Vad ser jag?"
  och "Läs skyltarna" skickar en bild av vyn. Assistenten kan också styra
  glasögonen, till exempel öppna appar, starta timer, navigera, fota, styra
  musiken och byta HUD-färg.
- **Öppnad som fristående fil**: lokala kommandon fungerar utan nät, till
  exempel "timer 5 minuter", "navigera hem", "ta ett foto", "spela musik" och
  "vad är klockan". Bildfrågor besvaras då bara med en mätning av ljus och
  färger.

Röstinmatning och live-undertexter använder webbläsarens taligenkänning
(Chrome) och kräver mikrofonåtkomst. Svar läses upp med svensk talsyntes.

## Vad som är simulerat

Batteriet, meddelandena (märkta som exempeldata), trafik- och väderinfo samt
gången i Navigera är påhittade. Stegen räknas från den simulerade gången, eller
från telefonens rörelsesensor när en sådan finns. Svar på meddelanden skickas
inte någonstans. Foton, meddelanden, inställningar och dagens steg sparas i
webbläsarens lokala lagring.

## Testat

Filen har körts i headless Chromium på 1280×800 och 390×844: uppstart och
gestguide, alla elva appar, navigering med sväng, kameraknapp och galleri,
lokala AI-kommandon, svar på meddelanden, undertexter, inställningar,
pekytan, skärmvila, inkommande notiser och ingen horisontell scroll på mobil.
Inga fel i konsolen. Claude-anslutningen i artefakten går inte att köra i den
testmiljön.
