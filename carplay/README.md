# Sändo Elev på CarPlay — vad som går och vad som inte går

## Först: Sändo Elev kan inte bli en CarPlay-app

CarPlay är inte öppet för vilken app som helst. Apple delar ut CarPlay-rätten
(entitlement) bara till appar i en **fast lista av kategorier**:

> ljud · kommunikation · navigation · parkering · laddning · tankning ·
> snabbmatsbeställning · körrelaterade uppgifter · biltillverkare

En studieapp finns inte på listan och kommer inte att göra det. Listan är kort
med flit: allt på en bilskärm konkurrerar med vägen. En förare ska inte läsa
mattetips i 90 km/h, och Apple kommer inte att godkänna en app som ber hen
göra det. Ansöker man ändå får man avslag, inte en diskussion.

Det gäller Android Auto också. Samma tanke, samma korta lista.

## Vad som däremot går: **Repet**, en ljudapp

Kategorin **ljud** är öppen för alla. Och det finns precis en sak en elev kan
göra i en bil utan att någon behöver titta på en skärm: **lyssna**.

*Sändo Elev · Repet* spelar upp en repetition av kapitlet eleven jobbar med,
på väg till skolan. Frågorna läses upp med en paus efter varje, så att eleven
hinner svara högt i baksätet. Sedan kommer nästa fråga.

Föraren rör aldrig annat än play och paus. Skärmen visar en lista med kapitel
och en Spelas nu-vy — samma två mallar som en podcastapp. Det är den appen
Apple kan säga ja till.

## Monnis regel gäller även här — hårdare

I appen finns en svarsvakt som läser Monnis text innan eleven ser den. I en bil
finns ingen sådan väg: ljudet är redan i luften när någon hör det, och ingen
kan avbryta det.

Därför är regeln flyttad in i **datat**. Repetitionsformatet har inget fält för
svar. Inte dolt, inte filtrerat — det finns inte. En repetition är en lista med
frågor och pauser, och det går inte att uttrycka ett facit i den även om man
vill. Självtestet kontrollerar det: skulle någon lägga till ett svarsfält i
formatet faller testet.

## Vad som finns här

```
SandoElevCarPlay/
  CarPlaySceneDelegate.swift   CarPlay-scenen, listmallen, Spelas nu
  Repetition.swift             modellen: kapitel, frågor, pauser
  RepetitionPlayare.swift      uppläsning, ljudsession, fjärrkommandon
  Info.plist                   scenmanifestet CarPlay kräver
  SandoElevCarPlay.entitlements
exempel/repet-matte5-kap4.json  en riktig repetition i formatet
forhandsvisning/index.html      mallarna renderade i webbläsaren
```

## Det här är obyggd kod

En iOS-app kräver Xcode och macOS. Den här maskinen är Linux utan Swift, så
**koden är skriven men aldrig kompilerad och aldrig kört**. Räkna med att den
behöver rättas första gången den öppnas i Xcode. Jag har inte testat den och
påstår inte att den fungerar.

Det som **är** kontrollerat är formatet och mallarna:
`forhandsvisning/index.html` ritar upp exakt de två skärmar Swift-koden
beskriver, ur samma JSON-fil, i CarPlays riktiga upplösningar.
`tools/carplay-selftest.js` kör den och kontrollerar layouten, radantalet,
träffytorna och att formatet inte kan bära ett svar.

## Bygga den på riktigt

1. Öppna ett nytt iOS-projekt i Xcode, lägg in filerna ur `SandoElevCarPlay/`.
2. Ansök om `com.apple.developer.carplay-audio` hos Apple. Beskriv appen som
   det den är: en ljudapp som spelar upp inspelade repetitioner. Beskriv den
   inte som en studieapp — då är det fel kategori och det blir avslag.
3. Testa i simulatorn: `I/O → External Displays → CarPlay`.
4. Kör i bil bara som passagerare tills flödet sitter.
