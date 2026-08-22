# Tramsdetektorn

Appens enda AI-komponent. Den ligger tyst så länge lektionen fungerar och säger
bara till när någon tramsar, skriker, härmar ljudmemes ("Homer let the Barts
out", "dudududu") eller kastar in en helt ovidkommande fråga mitt i lektionen.

## Tre nivåer

| Nivå | Namn | Vad som händer |
|---|---|---|
| 1 | Lite cringe | Snäll och kort tillsägelse, läses upp med talsyntes |
| 2 | Rejält trams | Sträng tillsägelse och en varningston |
| 3 | SUPER CRINGE | Utvisning i 5 minuter med larmsignal och kameravakt |

## Utvisningen

När nivå 3 utlöses startar en femminuterstimer och en hög, upprepad signal.
Kameran används som närvarovakt:

* Rörelse i bilden = eleven är kvar i rummet → signalen fortsätter.
* Bilden lugnar sig i ~2,5 sekunder = eleven har gått ut → signalen tystnar.
* Rörelse igen innan tiden gått ut = eleven kom in för tidigt → signalen börjar
  om, tillsammans med en uppmaning att vänta utanför.

Kameravakten är en rörelseheuristik, inte ansiktsigenkänning: den ser *att* det
rör sig i rummet, inte *vem*. Därför finns knapparna "Eleven gick ut", "Eleven
kom in" och "Avbryt utvisningen" i komponenten, och kameravakten kan stängas av
helt under ⚙️ Inställningar. Ingen bild lämnar enheten och ingenting spelas in —
kameran jämför bara två små gråa miniatyrer med varandra.

## Mikrofonen

Ljuddetektorn och tramsdetektorn delar på **en enda mikrofonström** (`App.Mic`),
med räknare på hur många som använder den. Öppnar två komponenter var sin ström
svarar Android med `NotReadableError` och den andra får ingen mikrofon alls.

Vägrar WebView helt — felet `NotReadableError`, "Could not start audio source",
som betyder att Androids WebView inte fick igång ljudkällan — byter appen
automatiskt till **Androids egen mikrofon** via `AudioRecord` i Java-skalet.
Den provar fem ljudkällor i tur och ordning (MIC, VOICE_RECOGNITION, DEFAULT,
CAMCORDER, VOICE_COMMUNICATION) och skickar 16 kHz PCM till webbappen, som
använder det precis som vanligt ljud — både till nivåmätaren och till Gemini.
Statusraden visar vilken mikrofon som är i bruk.

Går det ändå fel visar detektorn vad som är fel och vad man gör åt det:

| Fel | Vad appen säger |
|---|---|
| `NotReadableError` | Mikrofonen är upptagen av en annan app eller flik |
| `NotAllowedError` | Mikrofonen är blockerad — tillåt den i Androids inställningar |
| `NotFoundError` | Ingen mikrofon hittades på enheten |
| `OverconstrainedError` | Den valda mikrofonen finns inte längre |

Under ⚙️ **Inställningar → Mikrofon** väljer man inspelningsenhet, testar
mikrofonen med en nivåmätare i tre sekunder, kan tvinga fram ett släpp av
mikrofonen, be om mikrofonbehörigheten på nytt, slå av systemets
mikrofonmute och tvinga fram Androids egen mikrofon.

**🩺 Mikrofondiagnos** visar allt på en gång: adress och säker kontext,
behörigheten enligt både Android och webbläsaren, om enheten över huvud taget
har en mikrofon, om den är mutad i systemet, hur många andra appar som spelar
in just nu, vilka ingångar Android ser, resultatet av att öppna varje ljudkälla
med AudioRecord, och resultatet av varje försök via webbläsaren. Appen provar dessutom flera uppsättningar krav
efter varandra och väntar en halv sekund innan omförsöket när enheten svarar att
mikrofonen är upptagen — det räcker oftast för att den ska hinna släppas.

Kameran startas först när en utvisning börjar, och stängs när den är över, så
att den inte krockar med mikrofonen eller drar batteri i onödan.

## Två lägen

**Lokalt läge (standard)** — ingen nyckel, inget nät, inga krediter. Detektorn
reagerar på skrik och hög ljudnivå, och läraren kan rapportera trams manuellt
med nivåknapparna. Det här läget fungerar direkt i klassrummet.

**AI-läge** — ljudet strömmas till Gemini Live över WebSocket. Live-modellerna
svarar med ljud, inte text, så domslutet kommer i stället som ett
**verktygsanrop**: modellen anropar `rapportera_trams(niva, replik, vem, vad)`
och läser sedan upp repliken själv i klassrummet. Appen spelar bara upp ljudet
för turer som innehåller ett verktygsanrop — modellen kan alltså aldrig börja
prata mitt i lektionen. Transkriberingen av både det som hörs och det som sägs
följer med, så loggen visar vad detektorn faktiskt reagerade på.

Standardmodell är `gemini-3.1-flash-live-preview`. Under ⚙️ Inställningar finns
**Hämta modeller nyckeln har**, som listar kontots live-modeller att välja
mellan.

## Krediter

| | |
|---|---|
| Gratis start | 5 000 kr |
| Input | 80 kr per ljudsegment som skickas (15 s som standard, ställbart) |
| Output | 300 kr per tillsägelse från AI:n |

Saldot syns i topbaren, historiken bakom 💳-chipet. Går saldot under en input
stängs AI-läget av och detektorn fortsätter i lokalt läge. Lokalt läge och
manuella rapporter kostar ingenting.

## API-nyckel

Nyckeln skrivs in under ⚙️ **Inställningar → Tramsdetektor** och sparas bara i
enhetens `localStorage`. Den ligger medvetet **inte** i koden eller i repot: en
nyckel som checkas in i ett publikt GitHub-repo blir skannad och missbrukad inom
timmar.

Nyckeln skickas som `?key=…`, vilket är vad Gemini-API:t vill ha — även för
nycklar som inte börjar med `AIza`. Knappen **Testa API-nyckeln** frågar Google
och visar svaret rakt av (HTTP-status och felmeddelande), och provar i tur och
ordning `?key=`, `?access_token=` och `Authorization: Bearer`. Den metod som
godkänns sparas och används sedan av Live-anslutningen.
