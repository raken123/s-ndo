<p align="center"><img src="build/icons/mac-256.png" width="160" alt="Motey"></p>

# Motey – AI-mötesappen

Motey är en liten pratbubbla med två stora ögon som håller koll på dina möten.
Samma app finns för Android, Windows, macOS och webbläsaren.

| Fil | Plattform | Storlek |
|---|---|---|
| [`dist/Motey.apk`](dist/Motey.apk) | Android 7 och senare | 0,2 MB |
| [`dist/Motey.exe`](dist/Motey.exe) | Windows 10/11 (64-bit), en enda fil | 2,9 MB |
| [`dist/Motey.dmg`](dist/Motey.dmg) | macOS 10.15+, Apple Silicon och Intel | 1,8 MB |
| [`dist/motey.html`](dist/motey.html) | valfri webbläsare | 0,2 MB |

## Vad Motey gör

**1. Du missade mötet – Motey berättar.** Ronny var på stan och missade
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
* `android/` – Android-skalet: en WebView med en liten brygga
  (`window.MoteyAndroid`) för att spara filer, öppna länkar och tala svenska.
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

* Webbappen kördes i headless Chromium (mobil och desktop): introduktion,
  Motey-popupen, "fixa filerna" (riktig PDF och XLSX skapas och "skickas"),
  Live AI, TikTok-videon, spelet och quiz-väggen – utan JavaScript-fel.
* `Motey.exe` lästes tillbaka med pefile: kontrollsumma, ikon, versionsinfo
  och den inbäddade appen byte för byte.
* `Motey.dmg` packades upp igen och jämfördes med skivavbilden; app,
  körbar fil och genvägen till Program stämmer.
* Neutralino-skalet kördes på Linux: appen serverades ur `resources.neu` och
  Moteys egen Neutralino-klient skrev en fil via det inbyggda API:t.
* APK:n kontrollerades med aapt2 och apktool (manifest, ikoner, dex) och
  signaturen v2/v3 verifierades.

Inte testat här: att köra APK:n på en riktig telefon/emulator och att starta
EXE/DMG på Windows och Mac – byggmiljön saknade både emulator och de systemen.
Bilder från Wikipedia och Claude-anropen kunde inte nås från byggmiljön; utan
nät visar TikTok-läget emoji-illustrationer i stället.
