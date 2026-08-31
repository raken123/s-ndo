# ReeOS

Ett operativsystem för telefonen i bilhållaren. ReeOS gör det CarPlay och
Android Auto gör — karta, musik, samtal, meddelanden och röststyrning — och
lägger till sex saker de inte gör.

Allt körs i webbläsaren. Ingen installation, inget konto, ingen server:
resor, platser, kontakter och klipp ligger kvar i telefonen.

**Öppna:** `reeos/index.html` (publiceras via GitHub Pages på `/reeos/`).
Lägg till den på hemskärmen så startar den i helskärm som en vanlig app.

**Eller: `reeos/ReeOS.html`** — hela appen i en enda fil, att dubbelklicka på
eller mejla vidare. Den behöver ingen webbserver. Skillnaden mot mappversionen
är att den saknar service worker och manifest, så den cachar inget och startar
i webbläsarfliken i stället för i helskärm. I övrigt är den identisk, och
byggs om med:

```
python3 reeos/build-single-file.py
```

## Vanliga funktioner

| Funktion | Vad den gör |
|---|---|
| **Navigation** | Karta med färdriktning uppåt, adressökning, sväng-för-sväng med röst. Utan täckning växlar den till kompassläge med bäring och avstånd i stället för att visa en tom ruta. |
| **Musik** | Spelar ljudfiler från telefonens eget minne. Spellista, blanda, upprepa, och styrning från låsskärmen och rattknapparna via Media Session. |
| **Telefon** | Snabbval och knappsats. Samtalet lämnas över till telefonens egen appellare, så bilens handsfree fungerar som vanligt. |
| **Meddelanden** | Diktering, snabbsvar och uppläsning. Sista steget sker i telefonens SMS-app — ReeOS skickar aldrig något i ditt namn utan att du ser det. |
| **Röststyrning** | Svenska kommandon som tolkas lokalt: *kör mig till Lund*, *ring hemma*, *spela musik*, *spara parkering*, *markera hål i vägen*, *jag tar paus*. |

## Bara i ReeOS

- **Trötthetsvakt** — räknar sammanhängande körtid, väger in klockslaget
  (natten och tidiga eftermiddagen är riskigast) och påminner om paus i tid.
  Tio minuters stillastående nollställer räknaren automatiskt. Varningen tar
  aldrig över skärmen medan bilen rullar; då kommer den som röst och banner.
  Vakenhetskollen mäter reaktionstid — men bara när bilen står still.
- **Parkeringsminne** — sparar var bilen står med GPS, foto, våningsplan och
  p-tid. Kompasspil och avstånd leder tillbaka, och larmet går fem minuter
  innan tiden tar slut.
- **Dashcam med rullande minne** — kameran spelar in hela tiden men behåller
  bara den senaste minuten. Vid en kraftig inbromsning sparas klippet
  automatiskt; annars skrivs bufferten över.
- **Färddagbok** — loggar sträckan automatiskt när bilen rullar, delar upp
  tjänst och privat och exporterar CSV för milersättningen.
- **Väglag** — markera hål, halka, vilt eller kö där du möter dem. ReeOS
  varnar när du närmar dig en markering igen, i god tid utifrån farten och
  bara för det som ligger framför dig. Listan kan exporteras och läsas in i
  en annan bil.
- **HUD** — spegelvänd hastighetsvisning att lägga platt på instrumentbrädan
  och läsa i vindrutan.

## Byggt för hållaren

- Träffytor på minst 60 px, tabellsiffror och hög kontrast.
- Mörkt läge mellan 19 och 07, ljust däremellan — eller lås det manuellt.
- Skärmen hålls tänd via Wake Lock.
- Textinmatning låses över 8 km/h och ersätts av diktering.
- Volymen lyfts något med farten så man slipper skruva under körning.
- Fungerar offline: appskalet cachas av en service worker, och nyss körda
  kartrutor ligger kvar.

## Vad ReeOS inte gör

Ärlighet om gränserna är en säkerhetsfråga, inte en brasklapp:

- **Läser inte inkommande SMS.** Webbläsare får inte komma åt inkorgen.
  Meddelandeappen dikterar, läser upp text du klistrar in, och lämnar över
  till telefonens SMS-app för att skicka.
- **Ringer inte själv.** Den öppnar `tel:` — ett tryck återstår.
- **Ersätter inte en riktig trötthetsmätning.** Vakten känner till körtid och
  klockslag, inte ditt tillstånd. Känner du dig trött ska du stanna oavsett
  vad appen säger.
- **Dashcam-klipp ligger i webbläsarens lagring** och kan rensas av systemet.
  Ladda ner det du vill behålla.
- **Kartsökning och ruttberäkning kräver nät.** Utan nät blir navigationen
  kompassläge — riktning och avstånd, inte gator.

## Teknik

Vanilla ES-moduler, inget byggsteg, inga beroenden.

```
reeos/
  index.html            skal: statusrad, vy, dock
  css/reeos.css         hela formspråket
  js/core/              bus, store, ui, sensors, speech, router
  js/apps/              en fil per app
  sw.js                 offline-cache
  build-single-file.py  bygger ReeOS.html
  ReeOS.html            enfilsversionen (genererad)
```

Kärnan delar en enda GPS-prenumeration mellan alla appar — flera
`watchPosition` parallellt tömmer batteriet. Apparna pratar aldrig direkt med
varandra utan går via händelsebussen, och bakgrundsvakterna (färddagbok,
trötthet, väglag, händelsedetektering) startas en gång i `main.js` och lever
vidare oavsett vilken skärm som visas.

Kartdata från [OpenStreetMap](https://www.openstreetmap.org/copyright),
ruttberäkning via OSRM, adressökning via Nominatim.

## Behörigheter

| Behörighet | Används till | Krävs? |
|---|---|---|
| Plats | Karta, färddagbok, parkering, väglag, fart | Ja |
| Mikrofon | Röststyrning och diktering | Nej |
| Kamera | Dashcam och foto på p-platsen | Nej |
| Rörelsesensor | Kompass och händelsedetektering | Nej |

Ingen data lämnar telefonen. Adressökning och ruttberäkning är de enda
anropen ut, och de sker bara när du själv söker efter ett färdmål.
