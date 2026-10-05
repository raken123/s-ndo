<p align="center"><img src="build/icons/mac-256.png" width="160" alt="Motey"></p>

# Motey – AI-mötesappen

Motey är en riktig mötesapp, driven av Gemini, med en liten pratbubbla med två stora ögon som
håller koll på allt. Ni har möten med video och ljud och skriver meddelanden
direkt i Motey – ingen Teams, Zoom eller annan app behövs. Samma app finns för
Android, Windows, macOS och webbläsaren.

Den som bara vill kolla runt väljer **"Bara kolla runt"** och får demon med
påhittade möten. Därifrån går det att trycka **"Börja på riktigt"** när som helst.

| Fil | Plattform | Storlek |
|---|---|---|
| [`dist/Motey.apk`](dist/Motey.apk) | Android 7 och senare | 0,2 MB |
| [`dist/Motey.exe`](dist/Motey.exe) | Windows 10/11 (64-bit), en enda fil | 3,0 MB |
| [`dist/Motey.dmg`](dist/Motey.dmg) | macOS 10.15+, Apple Silicon och Intel | 1,9 MB |
| [`dist/motey.html`](dist/motey.html) | valfri webbläsare | 0,3 MB |

## Riktiga möten och meddelanden

* **Möten:** *Nytt möte* → titel, tid, längd, *varje vecka* och vilka filer som
  ska med → Motey ger dig en inbjudan att skicka (kopiera, dela, e-post, SMS).
  Eller *Starta ett möte nu*.
* **Samtal:** video och ljud direkt mellan deltagarnas enheter (upp till ca 6
  personer), mikrofon/kamera av och på, skärmdelning på datorn och chatt
  under samtalet.
* **📝 Motey antecknar:** i webbläsare som har tal till text skriver Motey ner
  det som sägs i samtalet. Allt hamnar i mötets protokoll tillsammans med
  chatten och anteckningar man skriver – och sedan fungerar sammanfattning,
  Live AI, TikTok-läget och spelläget på det riktiga mötet.
* **Chattar:** vanliga chattar med en person eller en grupp, med filer (upp
  till 750 kB), olästa-räknare och notiser.
* **Missade möten:** var du inte med i samtalet räknas mötet som missat.
  Veckomöten bokas automatiskt av den som skapade mötet och alla bjuds in –
  och innan nästa möte dyker Motey upp och berättar vad som hände. Filerna
  Motey fixar hamnar direkt i mötets chatt hos chefen.

### Hur det fungerar (utan någon Motey-server)

* Varje möte och chatt är ett "rum" med en slumpad 256-bitars nyckel. Nyckeln
  finns bara i inbjudningskoden, så **bara de som har fått inbjudan kan läsa**.
* Meddelanden krypteras (AES-GCM) på din enhet och lämnas i en "brevlåda" på
  publika [Nostr](https://nostr.com)-reläer, så de som var offline får allt när
  de öppnar appen. Reläerna ser bara krypterade data och en nyckel som är unik
  per rum, så de kan inte koppla ihop dina rum.
* Samtal går **direkt mellan enheterna** (WebRTC). Reläerna förmedlar bara den
  krypterade uppkopplingen. I mycket låsta nätverk kan en egen TURN-server
  behövas (*Mer → Nätverk*).
* Historiken sparas också på varje enhet. Publika reläer lovar inte att spara
  allt för alltid – vill man ha full kontroll kör man ett eget relä:

  ```sh
  python3 motey/server/relay.py --port 7777 --db motey-relay.jsonl
  ```

  och skriver in `wss://din-server` under *Mer → Nätverk → Reläer* (bakom en
  TLS-proxy som Caddy eller nginx). Reläet behöver bara Python.
* Inbjudningslänken öppnar webbversionen av Motey på GitHub Pages
  (`raken123.github.io/s-ndo/motey/dist/motey.html`) när den här grenen har
  slagits ihop med `main`. Koden fungerar alltid: *Gå med* i appen och klistra in.

Begränsningar: inga push-notiser när appen är helt stängd (det skulle kräva en
server); på Android kommer notiser så länge appen ligger i bakgrunden. Tal till
text finns inte i alla appvarianter (Chrome/Edge i webbläsaren och Safari har
det; Android- och Windows-appen har det inte) – där skriver man i chatten.

## Vad Motey gör

**1. Du missade mötet – Motey berättar.** (Fungerar både i demon och på
riktiga möten.) Ronny var på stan och missade
veckomötet. När nästa möte i samma serie närmar sig hoppar Motey upp av sig
själv, läser upp vad som hände, vilka beslut som togs och vad Ronny ska göra.
Han glömde också filerna – Motey ser vilka filer som saknas. Bifoga dina egna,
eller låt Motey göra riktiga utkast (PDF, Excel, Word) av det som sades på
mötet. Med *Skicka automatiskt* skickas de direkt till chefen.

**2. Motey Live AI.** Noa har en arg och sträng chef. Välj vem Motey ska
ersätta och en stil – snäll, lugn coach, pirat, godnattsaga, sportkommentator,
poet, robot eller Gen Z. Samma meningar och samma fakta, fast i en annan stil,
uppläst av Motey. Originalet är dolt tills du vill se det.

**3. TikTok-läge.** Karin vill bara kolla på TikTok. Motey gör mötet till en
vertikal video på ungefär 30 sekunder: en animerad presentatör, bilder från
Wikipedia om det mötet handlade om, text ord för ord och ett eget beat. Spara
videon som fil.

**4. Spelläge.** Johan älskar att spela. Finansmötet blir en bana: spring runt
på kontoret med Motey bredvid dig. Varje vägg är ett begrepp från mötet –
F-skatt, moms, arbetsgivaravgifter, kassaflöde … Gå fram till väggen, så
förklarar Motey vad den betyder och hur man "förstör" den i verkligheten.
Svara rätt på frågan och väggen rasar. Du kan också fråga Motey vad som helst
under spelets gång.

## Motey Studio – design, kod och tutorials

Karl och hans team ska bygga en transformer-AI, men de kan inte designa, inte
koda och vet inte hur grejerna sitter ihop. I **Studio** beskriver de vad de vill
bygga, och kan lägga till bilder från datorn eller internet (sök bland fria
bilder på Wikimedia Commons eller klistra in en bildlänk). Motey:

* **🧭 Plan** – förklarar hur allt hänger ihop: delarna, stegen och svåra ord.
* **💻 Kod** – flera kompletta kodvarianter. Webbvarianter kan köras direkt i
  appen, och allt går att ladda ner som zip.
* **🎨 Design** – loggor, startsidor, app-skärmar, diagram och affischer, som
  visas direkt (de bifogade bilderna kan användas i designen).
* **📚 Tutorial** – steg-för-steg-guider på olika nivåer, med kod, bockar och
  uppläsning. Kan sparas som PDF eller Markdown.
* **🛒 Inköp** – vad de ska köpa, i olika budgetnivåer med ungefärliga priser.
* **🏷️ Namn** – namn, slogan och domänförslag.
* **✨ Mer** – tidsplan, roller i teamet, risker, pitch, testplan, budget,
  README, FAQ, marknadsföring, licenser, mötesagenda – eller något eget.

Allt finns i flera varianter: *🔁 Fler varianter* gör nya, och *✏️ Ändra*
("gör den mörkare", "använd TensorFlow") gör om dem. Lite får 2 varianter per
gång, Plus 3 och Pro 5. Hela projektet kan exporteras som zip eller delas
med teamet i en Motey-chatt. Karls transformer-projekt finns med som exempel,
med riktig kod: en egen mini-GPT i PyTorch, uppmärksamhet i NumPy, och
finjustering av GPT-2/GPT-SW3 med Hugging Face.

Studio drivs av Gemini 3.8 Flash. Utan Gemini fyller offline-mallar i
grunderna. Det kostar (i procent av Plus): plan 2, kod 3, design 3,
tutorial 3, inköpslista 1, namn 1, mer 2.

## AI – Gemini

Motey drivs av Googles Gemini API:

| Vad | Modell |
|---|---|
| AI-Live (stilbytet – chefen blir snäll, pirat, sportkommentator …, med Moteys egen röst) | **Gemini 3.8 Flash Live** |
| Live Replace (3D-du pratar i mötet) | **Gemini 3.8 Flash Live** |
| TikTok-manus och spelbanor | **Gemini 3.8 Flash** |
| Sammanfattningar, "vad hände förra gången", frågor, var ögon och mun sitter vid 3D-skanningen | **Gemini 3.8 Flash** |

Motey slår upp de exakta modell-ID:na i Googles modellista första gången (de
kan också skrivas in under *Mer → AI → Modeller*). AI-Live strömmar ljud åt
båda hållen över Live-API:ts WebSocket: chefens röst går in, Moteys röst
kommer ut. Utan Gemini kör Motey sin inbyggda offline-motor.

### API-nyckeln

Nyckeln ska **inte** byggas in i appen eller ligga i repot: allt som finns i en
APK/EXE/DMG eller på GitHub kan plockas ut, och då betalar du för andras
användning. Därför finns två sätt:

1. **Motey-servern** (det riktiga sättet – se nedan) håller nyckeln och räknar
   användningen per prenumeration. Appen får bara serverns adress.
2. **Egen nyckel för test:** *Mer → AI → egen Gemini API-nyckel*. Den sparas
   bara på enheten och skickas bara till Google.

## Prenumerationer

| | Pris | Användning | AI-Live | Live Replace |
|---|---|---|---|---|
| **Motey Lite** | gratis | 25 % av Plus – gräns på allting, även spel och TikTok | – | – |
| **Motey Plus** | 12 kr/mån | 100 % (AI-Live tar 5 % per minut – passar för ca 4 online-möten i månaden) | ✓ | – |
| **Motey Pro** | 310 kr/mån | 20 × Plus | ✓ | ✓ 3D-du |

Allt räknas i procent av månadens kvot och nollställs den 1:a. Det här
kostar saker (i procent av Plus): sammanfattning 1, "vad hände" 1, fråga 0,5,
Motey fixar en fil 1, TikTok-video 4, spelbana 3, 3D-skanning 2, AI-Live 5
per minut, Live Replace 5 per minut. Siffrorna finns i `app/js/plans.js` och
`server/motey_server.py`. I demon räknas ingenting.

### Live Replace (Pro)

1. *Mer → Mitt 3D-ansikte*: kameran tar 8 bilder **automatiskt** (rakt fram,
   vänster, höger, upp, ned, le, öppen mun, rakt fram) – den väntar tills du
   håller still i varje läge. Gemini 3.8 Flash hittar ögon och mun i bilden.
2. Motey bygger ett 3D-huvud (WebGL): bilderna projiceras på ett 3D-huvud från
   vinkeln de togs i och blandas efter hur huvudet vrids. Käken och den
   öppna munnen följer rösten.
3. I ett samtal trycker du 🏖️. Gemini 3.8 Flash Live lyssnar på mötet och
   pratar som du (med det du skrivit under "Det här ska 3D-du veta"). De andra
   ser 3D-huvudet och hör rösten; du kan skriva till 3D-du vad den ska säga och
   ta över när du vill. Allt den hör och säger hamnar i mötesprotokollet.

3D-huvudet visar alltid märket **"🤖 AI-tvilling · Motey"**, Motey skriver i
chatten när tvillingen tar över, och frågar någon om det är en AI svarar den
ärligt. De andra i mötet ska veta vem de pratar med.

### Motey-servern

```sh
GEMINI_API_KEY=… PUBLIC_URL=https://motey.example.se \
STRIPE_SECRET_KEY=sk_live_… STRIPE_WEBHOOK_SECRET=whsec_… \
STRIPE_PRICE_PLUS=price_… STRIPE_PRICE_PRO=price_… \
python3 motey/server/motey_server.py --port 8787 --data motey-data
```

* Bara Pythons standardbibliotek. Kör den bakom HTTPS (Caddy, nginx eller en
  molntjänst) och skriv in adressen i Motey under *Mer → AI → Motey-server*.
* Den skickar vidare vanliga Gemini-anrop och Live-WebSocketen, kontrollerar
  plan och kvot före varje anrop och räknar varje minut av Live.
* Betalning: skapa två återkommande priser i Stripe (12 kr och 310 kr per
  månad) och en webhook till `https://din-server/v1/stripe/webhook` för
  `checkout.session.completed`, `customer.subscription.updated` och
  `customer.subscription.deleted`. *Uppgradera* i appen öppnar Stripe
  Checkout; webhooken (signaturen kontrolleras) byter plan. *Hantera
  prenumeration* öppnar Stripes kundportal.
* Utan Stripe kan planerna provas i appen i testläge (*Mer → AI*).
* Ska appen ut på Google Play eller App Store gäller deras egna regler för
  digitala prenumerationer (Play Billing / App Store-köp) i stället för Stripe
  i appen.

Transkript kan klistras in (`Namn: text` per rad) eller importeras som
`.vtt`/`.srt`/`.txt` från Teams, Zoom eller Google Meet.

## Skicka till chefen

* **E-post** (standard): Motey sparar filerna, öppnar e-postappen med
  ämne och sammanfattning ifyllt – du drar in filerna och trycker skicka.
* **Webhook – helt automatiskt**: ange en URL från Zapier, Make, Power
  Automate eller n8n. Motey skickar JSON med mottagare, ämne, text och filerna
  i base64, och flödet mejlar vidare.

## Installera

**Android:** öppna `Motey.apk` på telefonen och tillåt installation från den
källan. Filer sparas i *Hämtade filer/Motey*.

**Windows:** dubbelklicka `Motey.exe`. Appen använder Microsoft Edge WebView2,
som redan finns i Windows 10 och 11. Filen är inte kodsignerad, så SmartScreen
kan fråga – välj *Mer info → Kör ändå*.

**macOS:** öppna `Motey.dmg` och dra Motey till Program. Appen är inte
notariserad hos Apple: första gången, högerklicka → *Öppna*, eller gå till
*Systeminställningar → Integritet och säkerhet → Öppna ändå*.

## Bygga själv

```sh
python3 motey/build/build.py all     # eller: web apk exe dmg
```

Kräver Python 3, Java 17+, git, cmake och en C-kompilator. Verktygen laddas ned
en gång till `motey/build/.tools` (fasta versioner, kontrollerade med SHA-256).
GitHub Actions (`.github/workflows/motey-build.yml`) bygger alla filer vid
varje ändring i `motey/`.

Hur det hänger ihop:

* `app/` – själva appen (HTML/CSS/JS, inga beroenden). Samma kod överallt.
  `nostr.js` (BIP-340-signaturer, reläer, kryptering – skrivet från
  specifikationerna och testat mot BIP-340:s testvektorer), `net.js` (rum,
  inbjudningar, meddelanden, filer, möten), `chat.js` och `call.js` (WebRTC).
* `server/relay.py` – ett eget Nostr-relä med bara Python, för den som vill.
* `android/` – Android-skalet: en WebView med en liten brygga
  (`window.MoteyAndroid`) för att spara filer, öppna länkar, tala svenska,
  dela, visa notiser och ge samtal tillgång till kamera och mikrofon.
  Skrivet i smali och byggt med apktool, så inget Android SDK behövs.
* Windows och macOS använder [Neutralino](https://neutralino.js.org).
  `build.py` packar appen i `resources.neu` (asar), bäddar in den som resurs i
  `Motey.exe` tillsammans med ikon, versionsinfo och manifest, och lägger den
  bredvid binären i `Motey.app` för macOS. DMG:n byggs som ISO med Rock Ridge
  och komprimeras med libdmg-hfsplus – samma metod som Bitcoin Core använder.
* `build/keystore/motey-sideload.jks` signerar APK:n (lösenord
  `motey-sideload`). Den är medvetet inte hemlig – den finns för att
  uppdateringar ska kunna installeras över varandra. Använd en egen nyckel om
  appen ska till Google Play.

## Testat

* **Riktiga möten och chattar, från början till slut:** två separata
  webbläsare (Anna och Bertil) mot ett lokalt relä. Anna skapar ett möte och
  bjuder in; Bertil går med via koden; de chattar åt båda hållen; Bertil
  skickar en fil på 40 kB som kommer fram byte för byte och bockar av mötets
  "Budget.xlsx"; båda går med i samtalet och videon går fram åt båda hållen
  (ansluten på ca 3 sekunder); en protokollrad delas. Samma test klarades
  också av enfilsversionen `motey.html`.
* **Missat veckomöte:** Ronny är inbjuden men går aldrig med. Birgittas Motey
  bokar nästa vecka automatiskt och Ronny bjuds in. När Ronny öppnar Motey
  dyker figuren upp och berättar vad som hände; "fixa filerna" skapar
  `Kundrapport_Q3.pdf` som kommer fram till Birgitta i mötets chatt.
* **Demon:** introduktion, Motey-popupen, "fixa filerna", Live AI,
  TikTok-videon, spelet och quiz-väggen – utan JavaScript-fel.
* Signeringen (BIP-340) klarar de officiella testvektorerna.
* `Motey.exe` lästes tillbaka med pefile: kontrollsumma, ikon, versionsinfo
  och den inbäddade appen byte för byte. `Motey.dmg` packades upp igen och
  jämfördes med skivavbilden. Neutralino-skalet kördes på Linux och skrev en
  fil via det inbyggda API:t. APK:n kontrollerades med aapt2/apktool och
  signaturen (v2/v3) verifierades.

* **Gemini och prenumerationer** (mot en lokal Gemini-attrapp som talar samma
  REST- och Live-protokoll, eftersom Google inte går att nå från byggmiljön):
  modell-ID:n hittas i modellistan; sammanfattning, spelbana och TikTok-manus
  går via Gemini 3.8 Flash och räknas (Lite 4 → 16 → 32 %); Lite får ingen
  AI-Live och en spärr när kvoten tar slut; via Motey-servern nekas en
  förfalskad Stripe-webhook och en korrekt ger Pro; AI-Live via servern
  skriver om chefen och räknas per minut; 3D-skanningen tar 8 bilder av sig
  själv och WebGL-huvudet byggs; i ett riktigt samtal hör 3D-tvillingen mötet,
  svarar, syns hos den andra och hamnar i protokollet.

Inte testat här: APK:n på en riktig telefon/emulator och EXE/DMG på riktiga
Windows- och Mac-datorer (byggmiljön saknade dem), samt de publika reläerna
och Wikipedia/Gemini, som byggmiljön inte når. Nätverkstesterna kördes mot
Moteys eget relä (`server/relay.py`), som talar samma protokoll.
