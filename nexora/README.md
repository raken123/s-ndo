# Nexora – skapa spel med AI

Nexora gör spelbara 2D- och 3D-spel av en beskrivning. Samma app finns som webbplats,
Windows-installation (EXE), macOS-skivavbild (DMG) och Linux-paket (DEB).

| Fil | Plattform |
|---|---|
| `index.html` | Webbplatsen. En fristående fil som går att lägga på valfritt webbhotell. |
| `dist/Nexora-Setup-1.2.0-x64.exe` | Windows 10/11, 64-bit |
| `dist/Nexora-1.2.0-arm64.dmg` | macOS 12+ på Apple Silicon |
| `dist/nexora_1.2.0_amd64.deb` | Debian, Ubuntu, Mint (x86-64) |
| `dist/nexora-1.2.0.html` | Kopian som skrivbordsapparna laddar |
| `colab/Nexora_Flash_1_Colab.ipynb` | Tränar en egen Nexora Flash-modell i Google Colab |
| `marketing/nexora-short-9x16.mp4` | Kortreklam, 26 s, 1080×1920 (Shorts/Reels/TikTok) |

## Modellerna

Varje Nexora-modell är ett eget lager (prompt och inställningar) ovanpå en basmodell.
Leverantören väljs under **⚙️ Inställningar**:

| Modell | Nexora Local (offline, standard) | Anthropic (egen API-nyckel) | Egen endpoint |
|---|---|---|---|
| **Flash 1** – snabb | Spelgenerator med 9 speltyper | `claude-haiku-4-5` | valfritt modell-ID |
| **Pro 1** – långsam men bra | ″ | `claude-opus-5`, effort `medium` | ″ |
| **Core 1** – Pro, men tänker | ″ | `claude-opus-5`, adaptivt tänkande (visas live), effort `xhigh` | ″ |
| **Image 1** – bilder | Procedurella pixel-sprites (SVG) | `claude-opus-5` ritar SVG | `/images/generations` |
| **3D 1** – 3D-modeller | Procedurella low-poly-modeller | `claude-opus-5` skriver mesh-JSON | ″ |
| **Astryx 5 Pro** – AI-agent | Agentloop: bygger, testkör, gör om vid fel | `claude-opus-5` som agent med verktyg | skriv → testa → rätta, upp till 3 varv |

### Nexora Astryx 5 Pro

Astryx 5 Pro är en AI-agent. Den svarar inte med kod i ett enda svep. I stället arbetar den
med fyra verktyg tills spelet fungerar:

| Verktyg | Vad det gör |
|---|---|
| `write_game` | skriver hela spelet |
| `edit_game` | exakt ersättning av en kodbit, för små rättningar |
| `run_game` | kör spelet i en dold iframe, startar det, spelar med tangentbordet och returnerar fel, om bilden rör sig och en **skärmbild** som agenten tittar på |
| `finish` | avslutar, bara tillåtet efter minst en testkörning |

Agenten tänker med adaptivt tänkande, och tankarna visas live. Varje steg syns i Studio med
skärmbilderna. Med Nexora Local kör samma loop offline med den lokala generatorn, och med
en egen endpoint körs skriv → testa → rätta.

Lanseringen styrs av datum per plan (`ROLLOUT` i `src/ai.js`):

| Plan | Astryx 5 Pro |
|---|---|
| Studio (teamplanen) och Enterprise | från 26 september 2026 |
| Pro | från 7 oktober 2026 |
| Creator och Free | från 14 november 2026 |

Före datumet visas en dialog med lanseringsplanen och möjligheten att uppgradera.

### Astryx 5 Pro i Godot-läge (datorappen)

I Nexora för dator kan Astryx bygga riktiga **Godot 4.7-spel med Python**. En körning tar
upp till två timmar. Tiden väljs i Studio (15 min – 2 h) och körningen fortsätter i
bakgrunden, med en live-logg, skärmbilder och en avisering när spelet är klart.

| Verktyg | Vad det gör |
|---|---|
| `run_python` | kör ett Python-skript i projektmappen, som skriver `project.godot`, scener, GDScript och data |
| `write_file`, `read_file`, `list_files` | enskilda filer |
| `godot_run` | importerar projektet och kör huvudscenen i ~9 s speltid. En testsond (`desktop/godot/probe*.gd`) trycker på alla InputMap-actions och tar tre skärmbilder, som agenten tittar på |
| `search_assets`, `download_asset` | bara i hyperrealistiskt läge, se nedan |
| `save_lesson` | sparar en lärdom till nästa körning |
| `finish` | avslutar, bara efter minst en `godot_run` |

- **Modell:** `claude-opus-5` med adaptivt tänkande på `xhigh`, fallbacks och
  kontextrensning (`clear_tool_uses_20250919`), så att gamla skärmbilder inte fyller
  kontexten under långa körningar.
- **Tidsgräns:** vid 85 % av tiden får agenten beskedet att sluta lägga till funktioner, och
  körningen avbryts hårt strax efter gränsen.
- **Utan API-nyckel** bygger Nexora Local ett spelbart tredjepersonsspel i 3D med samma
  kedja (Python → Godot → testkörning).
- **Godot** 4.7.2 laddas ner automatiskt vid första körningen (80–170 MB beroende på
  plattform). **Python 3.8+** måste finnas på datorn.
- **Export:** Windows (.exe), Linux, macOS (.app i .zip) och webb, via Godots exportmallar
  som hämtas vid första export (~1,3 GB). Projektet kan också laddas ner som .zip eller
  öppnas direkt i Godot-editorn.

**Säkerhet.** Koden som körs är skriven av AI, så Nexora frågar om lov första gången.
Python körs genom `desktop/python_guard.py`, som nekar filåtkomst utanför projektmappen och
blockerar processer, nätverk och `ctypes`. Det är ett skyddsräcke, inte en fullständig
sandlåda.

### Hyperrealistiskt läge (10 krediter)

Hyperrealistiskt läge är ett tillval i Godot-läget. Astryx söker i Poly Havens bibliotek av
fotoskannade CC0-assets, laddar ner dem och bygger världen med dem:

- **Modeller:** glTF i verklig skala, 2k eller 4k.
- **Himmel:** en HDRI-himmel.
- **Mark:** PBR-texturer (albedo, normal, roughness).

Renderingen använder Godots Forward+ med AgX-tonemapping, SDFGI, SSAO, SSIL, SSR,
volymetrisk dimma och TAA. Varje asset listas i projektets `assets/polyhaven/CREDITS.md`.
Läget kostar alltid 10 krediter, även inom planens kvot. En körning som misslyckas eller
avbryts betalas tillbaka.

### Träning

Claude går inte att finjustera. Astryx tränas i stället på tre sätt:

1. **Inbyggd Godot-kunskap.** Systemprompten `GODOT_GUIDE` i `src/ai.js` täcker Godot
   4.7/GDScript 2: omdöpta API:er, `.tscn`-fallgropar, InputMap, UI, ljud utan filer och
   en realism-guide för hyperrealistiskt läge.
2. **Lärdomar.** Agenten sparar varje ny fallgrop med `save_lesson` (i `astryx-lessons.json`
   i appdatan) och läser de 40 senaste före varje körning. Sidan 🤖 Astryx visar dem och kan
   starta **träningspass**: 3, 5 eller 8 spel från en varierad testsvit, 20 min per spel.
   Träningspassen kostar API-avgifter men inga krediter.
3. **Egen modell i Colab.** `colab/nexora_godot_seed.jsonl` innehåller 120 Godot-byggskript
   i Python, och varje exempel är verifierat i Godot. Notebooken tränar på HTML-, Godot- eller
   båda dataseten (`DATASET`) och kan provköra Godot-läget: modellen skriver ett byggskript,
   Godot kör projektet med testsonden och notebooken rapporterar fel.

### Krediter

Är månadens spel slut kan man köpa krediter i stället för att byta till en dyrare plan.
Krediterna är engångsköp och går aldrig ut: 25 för 49 kr, 100 för 149 kr eller 500 för 499 kr.
Ett spel kostar 1 kredit, en Astryx-körning 3 och hyperrealistiskt läge 10. Krediter dras bara när planens kvot är
slut och låser inte upp funktioner från dyrare planer. Saldot visas i toppraden (🪙), och
köp sker, precis som planerna, i demoläge utan betalning.

- **Nexora Local** fungerar utan internet och utan nyckel. Den tolkar prompten (speltyp,
  tema, svårighet, antal spelare) och bygger ett av nio spel: plattformsspel, rymdskjutare,
  orm, blockkross, undvik-spel, samlarspel (1–2 spelare), open world med NPC:er och uppdrag,
  3D-löpare och 3D-arena. Alla spel har titelskärm, poäng, rekord, game over, ljud,
  procedurell musik och touchknappar.
- **Anthropic** anropar Claude direkt från appen med användarens egen nyckel. Opus-anropen
  har `fallbacks: "default"` påslaget, så en förfrågan som säkerhetsfiltret avböjer körs om
  på en annan modell i stället för att bara misslyckas.
- **Egen endpoint** fungerar med vilket OpenAI-kompatibelt API som helst: OpenAI, vLLM,
  Ollama, LM Studio och servern från Colab-anteckningsboken.

### Colab

GPT-5 Fast, GPT-6 Astra, GPT Images 2.5 och Meshy 7 har inga öppna vikter, så de kan inte
finjusteras i Colab. Anteckningsboken finjusterar i stället Qwen2.5-Coder med LoRA på
`colab/nexora_seed.jsonl` (200 spel, alla speltyper), provkör modellen och startar en
OpenAI-kompatibel server med en publik tunnel. Den adressen anger du sedan under
*Egen endpoint*. Du kan träna vidare på dina egna spel: *Mina spel → 🧠 Träningsdata*
exporterar dem i samma format.

## Planerna

| | Free | Creator | Pro | Studio | Enterprise |
|---|---|---|---|---|---|
| Pris/mån | 0 kr | 199 kr | 499 kr | 999 kr | 2 999 kr |
| Spel/månad | 10 | 100 | obegränsat | obegränsat | obegränsat |

Varje funktion i prislistan är kopplad till en plan i appen (`FEAT` i `src/app.js`), och
låsta funktioner öppnar en uppgraderingsdialog. Så här ser det ut i den här versionen:

- **Fungerar:** 2D/3D, alla fem modellerna, kod-, grafik-, story-, dialog-, NPC-, uppdrags-,
  musik-, ljudeffekt- och röstgeneratorn, open world, lokal multiplayer för två spelare,
  Buggfix-AI (kör spelet dolt, samlar fel och låter AI:n rätta dem), egna assets,
  versionshantering (30 versioner per spel), delade projekt via `.nexora.json` och en
  lokal teamlista.
- **Export:** HTML (webb), PWA (mobil), Electron-projekt (PC → .exe/.dmg/.deb) och
  Steam-paket med Steamworks-byggskript. För Xbox, PlayStation och Nintendo skapas ett
  *portningspaket* med instruktioner. Riktiga konsolbyggen kräver tillverkarens avtal och
  devkit och kan inte göras av en tredje part.
- **Demoläge:** planer aktiveras lokalt utan betalning, eftersom Stripe eller Klarna kräver
  en server. Privat molnlagring, dedikerade servrar, API-åtkomst och teamsynk i realtid
  kräver också en backend. De visas i planerna och på Team-sidan som "Kräver Nexora Cloud".

Spel och assets sparas i webbläsarens IndexedDB och inställningar i localStorage.
API-nycklar lämnar aldrig enheten, förutom till den leverantör de hör till.

## Installation

**Windows:** kör `Nexora-Setup-1.2.0-x64.exe`. Nexora installeras för din användare i
`%LOCALAPPDATA%\Programs\Nexora`, utan administratörsrättigheter, med genvägar på
skrivbordet och i Start-menyn. Avinstallera via *Inställningar → Appar*. Filen är inte
kodsignerad, så SmartScreen varnar: välj *Mer info → Kör ändå*.

**macOS:** öppna DMG-filen och dra Nexora till Program. Appen är ad hoc-signerad men inte
notariserad. Första gången: högerklicka på appen och välj *Öppna*. På macOS 15 och senare
godkänner du den under *Systeminställningar → Integritet och säkerhet → Öppna ändå*.

**Linux:** `sudo apt install ./nexora_1.2.0_amd64.deb` och starta sedan `nexora` eller
välj Nexora i programmenyn.

## Bygga

```sh
python3 nexora/build/build.py      # src/ → index.html + dist/nexora-1.2.0.html
python3 nexora/build/desktop.py    # → dist/*.exe, *.dmg, *.deb  (körs på Linux)
python3 nexora/build/build.py      # lägger in storlekar och SHA-256 på nedladdningssidan
node nexora/build/dataset.js       # → colab/nexora_seed.jsonl
node nexora/build/verify.js        # testar appen i headless Chromium (Playwright)
python3 nexora/build/desktop.py dev   # oinstallerad Linux-app för tester
NEXORA_APP=… NEXORA_GODOT=… [NEXORA_TPZ=…] xvfb-run -a node nexora/build/verify_desktop.js
node nexora/build/dataset_godot.js     # → colab/nexora_godot_seed.jsonl
python3 nexora/build/make_notebook.py  # → colab/Nexora_Flash_1_Colab.ipynb
FFMPEG=ffmpeg node nexora/build/ad.js   # renderar marketing/nexora-short-9x16.mp4
```

## Reklamfilmen

`marketing/nexora-short-9x16.mp4` är en kortreklam på 26 sekunder i 1080×1920 med H.264 och
AAC, för YouTube Shorts, Instagram Reels och TikTok. Scenerna:

1. "Du har en spelidé. Nexora gör den spelbar."
2. En prompt skrivs i Studio.
3. Riktiga Nexora-spel: 2D-plattformsspel, 3D-löpare, open world och rymdskjutare.
4. Astryx 5 Pro med agentens steg och lanseringsdatumen.
5. Krediterna.
6. Slutskylt.

Spelen i filmen är genererade av appen och spelas av en bot. `build/ad.js` renderar varje
bildruta på en virtuell klocka, så filmen blir jämn oavsett maskin. Musiken och
ljudeffekterna kommer från appens egna generatorer. `marketing/nexora-short-thumbnail.jpg`
är slutskylten som miniatyrbild.

`desktop.py` hämtar Electron 43.2.0 och bygger allt på Linux. Verktygen hämtas och byggs
automatiskt till `build/.cache`:

- EXE: 7-Zips installationsmodul `7zSD.sfx`, ett LZMA2-arkiv och ett PowerShell-skript
  som installerar appen.
- DMG: en HFS+-volym med `Nexora.app` och en länk till /Applications, byggd med
  [libdmg-hfsplus](https://github.com/mozilla/libdmg-hfsplus) och LZMA-komprimerad
  (ULMO, kräver macOS 10.15+). Med bzip2 blev filen 101,7 MB, alltså över GitHubs gräns
  på 100 MB per fil.
- Signering: macOS-appen ad hoc-signeras med
  [rcodesign](https://github.com/indygreg/apple-platform-rs), eftersom Apple Silicon inte
  startar en ändrad app med ogiltig signatur.

## Vad som är testat

- `verify.js` kör webbappen i headless Chromium. Den kontrollerar att alla vyer renderas
  utan fel och att planlåsningen fungerar. Alla nio speltyper genereras från riktiga
  promptar och spelas med tangenttryckningar utan fel. Den testar också spara/bibliotek,
  månadskvoten, kodredigeraren med versioner, Buggfix, alla verktyg, fyra exporttyper
  (giltiga zip-filer) och att sidan inte scrollar i sidled i mobilbredd. Totalt 68 kontroller.
- Astryx 5 Pro:
  - Lanseringsdatumen testas per plan och datum (26/9, 6/10, 7/10, 13/11 och 14/11).
  - Pro-planen får lanseringsdialogen före 7 oktober.
  - Den lokala agenten testkör spelet, visar skärmbilden och sammanfattningen och räknas
    mot kvoten.
  - Mot ett simulerat Messages API körs en hel verktygsloop (write_game → run_game →
    finish). Testet kontrollerar att tankeblocket med signatur och `tool_use` skickas
    tillbaka oförändrade, att `run_game` returnerar en riktig skärmbild och mätvärden,
    att `eager_input_streaming` bara sitter på verktygen som bär kod, och att
    `fallbacks` och promptcache är påslagna.
- **Skrivbordsappen, end-to-end** (`verify_desktop.js`, 30 kontroller): testet styr den riktiga
  Electron-appen under Xvfb, med riktig Python, riktig Godot 4.7.2 och en lokal kopia av
  Poly Havens API med genererade glTF-, HDR- och PNG-filer.
  - **Hyperrealistiskt läge med Nexora Local:** körningen drar 10 krediter, laddar ner
    tre modeller, en HDRI-himmel och en marktextur och skriver `CREDITS.md`. Den bygger ett
    Godot-projekt som använder dem med AgX, testkör det med tre skärmbilder och sparar
    spelet i biblioteket.
  - **Claude-agenten mot ett simulerat API:** `run_python` skriver ett projekt och
    `godot_run` kör det utan fel med tre bilder. Sökning och nedladdning fungerar, och
    Python-skyddet blockerar läsning utanför projektet. Lärdomen sparas och finns med i
    nästa körnings instruktioner. `finish` utan testkörning nekas, och kostnaden betalas
    tillbaka.
  - **Riktiga exporter med Godots exportmallar:** Linux (73,7 MB), Windows .exe (109,3 MB),
    webb (40 MB) och macOS .zip (59,7 MB). Det exporterade Linux-spelet startar fristående.
- **Träningsdatan för Godot:** exemplen körs med Python, och ett av de genererade projekten
  körs i Godot med testsonden utan skriptfel.
- Krediter: när kvoten är slut öppnas köpdialogen. Ett köp av 25 krediter och ett spel ger
  saldot 24 utan att månadskvoten ändras. Free-planen den 14 november drar 3 krediter för
  Astryx.
- AI-vägen testas mot simulerade svar. Testet kontrollerar att Core 1 skickar
  `claude-opus-5` med adaptivt tänkande och effort `xhigh` och att tankeströmmen visas,
  att Flash 1 skickar `claude-haiku-4-5`, att rätt headers skickas, att avböjda
  förfrågningar och 401 blir begripliga felmeddelanden och att egen endpoint får en
  OpenAI-förfrågan. Inget anrop gjordes mot det riktiga API:t, eftersom ingen nyckel fanns.
- DEB-paketet packades upp och startades under Xvfb på Ubuntu 24.04. Där laddade appen och
  genererade ett spel inuti Electron. Fyra beroenden (libnotify4, libxss1, xdg-utils,
  libsecret-1-0) gick inte att installera i byggmiljön, så `dpkg` konfigurerade aldrig
  paketet klart, men appen startade ändå.
- DMG-filen packades upp igen: alla filer och symlänkar är identiska med källan,
  exekverbarhetsbitarna finns kvar och alla binärer är ad hoc-signerade arm64-filer.
- EXE-filen: giltig PE-fil, SFX-konfigurationen och 7z-arkivet ligger på rätt plats,
  `7zz t` säger "Everything is Ok" och båda PowerShell-skripten parsas utan fel.
- **Inte testat:**
  - EXE-filen har inte körts på Windows och DMG-filen har inte öppnats på en Mac, eftersom
    byggmiljön saknar båda.
  - Colab-anteckningsboken har inte körts, eftersom byggmiljön saknar GPU.
  - Poly Havens riktiga API är blockerat här, så sökning och nedladdning är testade mot en
    kopia med samma svarsformat.
  - Godot renderade i testerna med OpenGL-reserven (ingen GPU), så SDFGI, SSR och
    volymetrisk dimma syns först på en riktig dator.
  - Ingen verklig Claude-körning av Astryx har gjorts, eftersom ingen API-nyckel fanns.

## Källkod

```
src/runtime.js   spelmotor: canvas, input (tangentbord + touch), ljud, musik, 3D-renderare
src/games.js     de nio spelmallarna
src/localgen.js  Nexora Local: tolkar prompten, text-/sprite-/3D-/musik-/ljudgeneratorer
src/ai.js        Nexora-modellerna → Anthropic / OpenAI-kompatibel endpoint
src/app.js       gränssnitt, planer, Studio, verktyg, bibliotek, export
src/app.css      stil
src/shell.html   mall som build.py fyller i
desktop/main.js  Electron-huvudprocessen: Godot, Python, projekt, testkörning, export, Poly Haven
desktop/preload.js, unzip.js, python_guard.py
desktop/godot/   testsonden (probe*.gd) och Nexora Locals Godot-generator i Python
```

Funktionerna i `runtime.js` och `games.js` bäddas in i varje exporterat spel med
`Function.toString()`. Ett exporterat spel är därför en enda fil som inte behöver Nexora
för att köras.
