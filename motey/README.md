<p align="center"><img src="build/icons/mac-256.png" width="160" alt="Motey"></p>

# Motey – AI-mötesappen

Motey är en riktig mötesapp med en liten pratbubbla med två stora ögon som
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

## AI

Motey fungerar helt offline med en inbyggd svensk AI-motor (sammanfattning,
beslut, att göra-listor, stilbyten, videomanus och spelbanor). Lägg in en
**Claude API-nyckel** under *Mer → AI* så används Claude (`claude-opus-5-5`)
i stället, med automatisk återgång till offline-motorn om något går fel.
Nyckeln sparas bara på enheten och skickas bara till `api.anthropic.com`.

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

Inte testat här: APK:n på en riktig telefon/emulator och EXE/DMG på riktiga
Windows- och Mac-datorer (byggmiljön saknade dem), samt de publika reläerna
och Wikipedia/Claude, som byggmiljön inte når. Nätverkstesterna kördes mot
Moteys eget relä (`server/relay.py`), som talar samma protokoll.
