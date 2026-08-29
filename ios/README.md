# Sändo Elev — iPhone och CarPlay

SwiftUI på telefonen, CarPlay i bilen, ingen ljuduppspelning. Bara Monni.

## Först, det du behöver veta om CarPlay

Apple delar ut CarPlay-rätten bara till en **fast lista av kategorier** — ljud,
kommunikation, navigation, parkering, laddning, tankning, snabbmat,
körrelaterade uppgifter. En studieapp finns inte på listan. Entitlementet i
`SandoElev.entitlements` går alltså inte att få godkänt av Apple för den här
appen, och utan det förblir bilskärmen tom.

Allt annat fungerar ändå: appen startar och körs som vanligt på telefonen, och
CarPlay-koden är riktig och testad — den saknar bara nyckeln till bilskärmen.
I iOS-simulatorn går den att se ändå (`I/O → External Displays → CarPlay`).

## Vad appen gör

**På telefonen** — SwiftUI, tre flikar:

| Flik | |
|---|---|
| 📖 Boken | Ladda upp arbetsboken som PDF. Varningen om sista sidan går inte att klicka förbi. |
| 💬 Monni | Chatten. Hjälpsteg, svarsvakt, ren text. |
| ⚙️ Mer | Krediter, API-nyckel, vad bilen visar. |

**I bilen** — två mallar, och ingen av dem tar emot något:

| Mall | |
|---|---|
| `CPListTemplate` | de senaste knuffarna Monni gett |
| `CPInformationTemplate` | en knuff, uppslagen |

Här går det **inte att fråga något nytt och inte att ladda upp en bok**. Det
finns varken tangentbord eller filväljare på en bilskärm, och ingenting
genereras medan någon kör. Telefonen frågar, bilen visar.

CarPlay är också den enda delen som inte är SwiftUI, och det går inte att göra
något åt: CarPlay ritar inte vyer utan mallar. Appen beskriver vad som ska stå,
bilen bestämmer hur det ser ut — det är hela poängen, så att föraren känner
igen sig i varje app.

## Monnis regel

Samma tre lager som i webbappen, se [`../MONNI.md`](../MONNI.md):
systemprompten, de fyra hjälpstegen, och svarsvakten som läser Monnis text
innan eleven ser den.

Skillnaden mot webbappen är att **här är regeln testad av en kompilator**.
Reglerna ligger i `Karna/` som ett vanligt Swift-paket, och
`Karna/Tests/SandoKarnaTests/MonniTests.swift` kör samma två tabeller som
webbappens självtest — sju svar som ska stoppas och sex förklaringar som
absolut inte får stoppas — plus hjälpstegen, tjatdetektorn, städningen av
LaTeX och att talet självt aldrig står kvar i texten när vakten slagit till.

```sh
cd ios/Karna && swift test
```

Att de ligger i ett eget paket är inte bokföring: det gör att de går att köra
**utan simulator**, direkt på macOS, på någon sekund. Som iOS-testbundle
krävdes en simulator som startade, och där fastnade bygget två gånger.
Appen läser samma filer via `project.yml` — en kopia av källan, två
byggsystem. Testerna körs i CI före varje bygge; en IPA av kod som inte klarar
svarsvakten byggs inte.

## Bygga

Projektfilen ligger inte i git — ett `.xcodeproj` är en konfliktmaskin.
`project.yml` genererar den i stället:

```sh
brew install xcodegen
cd ios && xcodegen generate
open SandoElev.xcodeproj
```

Utan Mac: `.github/workflows/ios-ipa.yml` gör samma sak på en macOS-runner,
kör testerna och lägger upp IPA:n som artefakt. Starta den från fliken Actions
i GitHub, eller pusha något under `ios/`.

## IPA:n är osignerad

Den som kommer ut ur CI är kompilerad och riktig, men **osignerad**. Den
installeras inte genom att bara kopieras till en telefon — den behöver
signeras med ett certifikat, med Xcode, AltStore eller Sideloadly.

Det är ett medvetet val: alternativet vore att lägga en signeringsnyckel i ett
publikt repo, och en nyckel som checkas in blir skannad och missbrukad inom
timmar. Samma skäl som att API-nyckeln inte ligger i koden.
