# Nexora – skapa spel med AI

Nexora gör vilket spel som helst av en beskrivning. Allt skapas av AI: spelen, bilderna,
3D-modellerna, texterna, musiken och ljudeffekterna. Det finns inga mallar och inga
speltyper att välja bland. Samma app finns som webbplats, Windows-installation (EXE),
macOS-skivavbild (DMG) och Linux-paket (DEB).

| Fil | Plattform |
|---|---|
| `index.html` | Webbplatsen. En fristående fil som går att lägga på valfritt webbhotell. |
| `dist/Nexora-Setup-1.5.2-x64.exe` | Windows 10/11, 64-bit |
| `dist/Nexora-1.5.2-arm64.dmg` | macOS 12+ på Apple Silicon |
| `dist/nexora_1.5.2_amd64.deb` | Debian, Ubuntu, Mint (x86-64) |
| `dist/nexora-1.5.2.html` | Kopian som skrivbordsapparna laddar |
| `train/` | Tränar **din egen modell** med PyTorch, utan API-nyckel (se `train/README.md`) |
| `colab/Nexora_Flash_1_Colab.ipynb` | Samma träning i Google Colab, på gratis-GPU |
| `marketing/examples/` | AI-exemplen som reklamfilmen visar: sex spel, fyra sprites, fyra 3D-modeller, musik och ljud |
| `marketing/nexora-short-9x16.mp4` | Kortreklam, 26 s, 1080×1920 (Shorts/Reels/TikTok) |
| `marketing/nexora-plans-9x16.mp4` | Kortreklam om alla fem planerna, 38 s, 1080×1920 |
| `marketing/nexora-15-9x16.mp4` | Lanseringsreklam för Nexora 1.5, 32 s, 1080×1920 |

## Nyheter i 1.5.2: din egen modell, tränad med PyTorch

- **Ingen API-nyckel behövs.** `nexora/train` finjusterar en öppen kodmodell
  (Qwen2.5-Coder) med PyTorch och LoRA, på din dator eller i Colab.
- **Självspel.** Modellen tar fram sin egen träningsdata: den skriver spel, bilder,
  3D-modeller, musik, ljud och text. Spelen spelas i en riktig webbläsare, och bara det som
  klarar kontrollerna tränas på, varv efter varv. Misslyckade spel rättas med appens egen
  buggfix-förfrågan.
- **"Din egen modell"** är ny och standardleverantör i appen:
  - `python -m nexora_model serve` startar modellen på `http://127.0.0.1:8000/v1`.
  - Studio visar om den är igång, och Inställningar har "Testa anslutningen".
  - Alla modeller och verktyg går via den, utom Astryx Godot-läge, som kräver Claude.
- **Samma prompter överallt.** Alla förfrågningar byggs av `PROMPTS` i `src/ai.js` och
  exporteras till `colab/nexora_prompts.json`, så modellen tränas på exakt det appen
  frågar.
- **Colab** kör samma kedja utan nyckel. Lärarmodellen, som krävde Claude, är borttagen.

## Nyheter i 1.5.1: bara AI

- **Offline-generatorn är borttagen.** Nexora Local, de tolv spelmallarna och de
  procedurella generatorerna för sprites, 3D, text, musik och ljud finns inte längre.
- **Alla modeller genererar med AI:**
  - Flash, Pro och Core 1.5 skriver hela spelet från grunden efter beskrivningen, i vilken
    genre som helst. Spelprompten säger uttryckligen att modellen ska bygga exakt det
    användaren beskriver och aldrig byta ut idén mot en enklare eller vanligare spelsort.
  - Image 1.5 och 3D 1.5 ritar och modellerar vad som helst.
  - Astryx 5 Pro är alltid en AI-agent, både i HTML5 och i Godot-läget.
- **Musik och ljudeffekter med AI.** AI:n komponerar ett noterat stycke (spår, toner och
  trummor) och designar ljudeffekter som syntlager. `src/media.js` spelar upp och renderar
  dem till WAV. Den kan fritt beskrivna ljud, och rösten kan få sin replik skriven av AI:n.
- **Koppla in en AI.** Utan nyckel visar Studio och Verktyg "Koppla in en AI" och öppnar
  Inställningar i stället för att generera. Välj Anthropic (Claude) eller en egen
  OpenAI-kompatibel endpoint, till exempel modellen från Colab. Gamla inställningar som
  pekade på Nexora Local flyttas automatiskt till Claude.
- **Colab:** träningsdatan skapas nu av AI. I 1.5.2 gör modellen det själv, se [Colab](#colab).

## Nyheter i 1.5

1.5-uppdateringen förbättrar alla 1-modellerna:

- **Självtest:** Flash, Pro och Core 1.5 testar sina spel. Varje AI-genererat spel körs i en
  dold webbläsare. Körfel, och spel som står still, skickas tillbaka till modellen för
  rättning innan du får spelet: en runda för Flash 1.5, två för Pro 1.5 och tre för
  Core 1.5. Studio visar "✓ Självtestad" eller hur många problem som finns kvar.
  - Pro 1.5, Image 1.5 och 3D 1.5 kör på effort `high`.
  - Spelprompten kräver nu stöd för handkontroll och paus med Esc, och modellen ska
    granska sin kod innan den svarar.
- **Vilket spel som helst:** spelprompten kräver handkontroll (Gamepad API), paus med
  P/Esc och touchknappar i varje spel.
- **Image 1.5:**
  - fyra stilar: pixel, platt, neon och retro 8-bit
  - animerade sprite-ark med fyra bildrutor och en gångcykel
  - export som PNG (256 px per bildruta) eller SVG
- **3D 1.5:**
  - modeller av vad du än beskriver, med en färg per yta; appen rättar ogiltiga färger och ytor
  - export som binär glTF (`.glb`) med ett PBR-material per färg. Filerna är verifierade
    genom import och rendering i Godot 4.7 och öppnas också i Unity och Blender.
- **Nyhetsruta** på startsidan och i sidfoten.

## Modellerna

Varje Nexora-modell är ett eget lager (prompt och inställningar) ovanpå en AI-basmodell.
Leverantören väljs under **⚙️ Inställningar**:

| Modell | Din egen modell (standard, ingen nyckel) | Anthropic (egen API-nyckel) | Egen endpoint |
|---|---|---|---|
| **Flash 1.5** – snabb + självtest | `nexora-egen`: Qwen2.5-Coder + LoRA, tränad med PyTorch | `claude-haiku-4-5` | valfritt modell-ID |
| **Pro 1.5** – bättre resultat, testar själv | ″ | `claude-opus-5`, effort `high` | ″ |
| **Core 1.5** – tänker, testar, förbättrar | ″ | `claude-opus-5`, adaptivt tänkande (visas live), effort `xhigh` | ″ |
| **Image 1.5** – stilar, animation | ″ (ritar SVG) | `claude-opus-5` ritar SVG | `/images/generations` |
| **3D 1.5** – 3D-modeller, GLB | ″ (skriver mesh-JSON) | `claude-opus-5` skriver mesh-JSON | ″ |
| **Astryx 5 Pro** – AI-agent | skriv → testa → rätta (HTML5) | `claude-opus-5` som agent med verktyg | skriv → testa → rätta, upp till 3 varv |

Verktygen använder samma modeller: story, dialog, NPC:er, uppdrag, ljudeffekter och
röstrepliker går till Flash, och musiken komponeras av Pro.

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
skärmbilderna. Med en egen endpoint körs skriv → testa → rätta.

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
- **Kräver Claude.** Godot-läget behöver verktyg, skärmbilder och långa arbetspass, så det
  körs med en Anthropic-nyckel. Utan nyckel startar ingen körning och Inställningar öppnas.
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
3. **Varierade uppdrag.** Träningspassen täcker plattform, skjutspel, racing, pussel,
   utforskning, tower defense och överlevnad, så lärdomarna inte fastnar i en spelsort.

### Krediter

Är månadens spel slut kan man köpa krediter i stället för att byta till en dyrare plan.
Krediterna är engångsköp och går aldrig ut: 25 för 49 kr, 100 för 149 kr eller 500 för 499 kr.
Ett spel kostar 1 kredit, en Astryx-körning 3 och hyperrealistiskt läge 10. Krediter dras bara när planens kvot är
slut och låser inte upp funktioner från dyrare planer. Saldot visas i toppraden (🪙), och
köp sker, precis som planerna, i demoläge utan betalning.

- **Anthropic** anropar Claude direkt från appen med användarens egen nyckel. Opus-anropen
  har `fallbacks: "default"` påslaget, så en förfrågan som säkerhetsfiltret avböjer körs om
  på en annan modell i stället för att bara misslyckas.
- **Egen endpoint** fungerar med vilket OpenAI-kompatibelt API som helst: OpenAI, vLLM,
  Ollama, LM Studio och servern från Colab-anteckningsboken.

### Colab

GPT-5 Fast, GPT-6 Astra, GPT Images 2.5 och Meshy 7 har inga öppna vikter, så de kan inte
finjusteras. Anteckningsboken kör i stället träningspaketet `nexora/train` på Colabs
gratis-GPU. Den laddar ner Qwen2.5-Coder, kör självspel, tränar med PyTorch + LoRA i två
varv och utvärderar på okända spelidéer. Sedan startar den modellen med en publik adress
som du klistrar in under *Din egen modell*. Ingen API-nyckel behövs. Dina egna spel kan
läggas till: *Mina spel → 🧠 Träningsdata* exporterar dem i samma format. Se
`train/README.md`.

## Planerna

| | Free | Creator | Pro | Studio | Enterprise |
|---|---|---|---|---|---|
| Pris/mån | 0 kr | 199 kr | 499 kr | 999 kr | 2 999 kr |
| Spel/månad | 10 | 100 | obegränsat | obegränsat | obegränsat |

Varje funktion i prislistan är kopplad till en plan i appen (`FEAT` i `src/app.js`), och
låsta funktioner öppnar en uppgraderingsdialog. Så här ser det ut i den här versionen:

- **Fungerar:** 2D/3D, alla sex modellerna, kod-, grafik-, story-, dialog-, NPC-, uppdrags-,
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

**Windows:** kör `Nexora-Setup-1.5.2-x64.exe`. Nexora installeras för din användare i
`%LOCALAPPDATA%\Programs\Nexora`, utan administratörsrättigheter, med genvägar på
skrivbordet och i Start-menyn. Avinstallera via *Inställningar → Appar*. Filen är inte
kodsignerad, så SmartScreen varnar: välj *Mer info → Kör ändå*.

**macOS:** öppna DMG-filen och dra Nexora till Program. Appen är ad hoc-signerad men inte
notariserad. Första gången: högerklicka på appen och välj *Öppna*. På macOS 15 och senare
godkänner du den under *Systeminställningar → Integritet och säkerhet → Öppna ändå*.

**Linux:** `sudo apt install ./nexora_1.5.2_amd64.deb` och starta sedan `nexora` eller
välj Nexora i programmenyn.

## Bygga

```sh
python3 nexora/build/build.py      # src/ → index.html + dist/nexora-1.5.2.html
python3 nexora/build/desktop.py    # → dist/*.exe, *.dmg, *.deb  (körs på Linux)
python3 nexora/build/build.py      # lägger in storlekar och SHA-256 på nedladdningssidan
node nexora/build/verify.js        # testar appen i headless Chromium (Playwright)
python3 nexora/build/desktop.py dev   # oinstallerad Linux-app för tester
NEXORA_APP=… NEXORA_GODOT=… [NEXORA_TPZ=…] xvfb-run -a node nexora/build/verify_desktop.js
node nexora/build/prompts.js           # → colab/nexora_prompts.json (alla förfrågningar, för träningen)
(cd nexora/train && python -m unittest discover -s tests)   # träningspaketet, utan PyTorch
(cd nexora/train && python -m nexora_model all)             # tränar din egen modell (PyTorch)
python3 nexora/build/make_notebook.py  # → colab/Nexora_Flash_1_Colab.ipynb
[NEXORA_ANTHROPIC_KEY=…] FFMPEG=ffmpeg node nexora/build/ad.js launch15.html   # renderar en kortreklam
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
bildruta på en virtuell klocka, så filmen blir jämn oavsett maskin. Filmen gjordes med
1.5.0-versionens spel, musik och ljud. `marketing/nexora-short-thumbnail.jpg`
är slutskylten som miniatyrbild.

`marketing/nexora-plans-9x16.mp4` (38 s) går igenom alla fem planerna.

- **Planerna:** varje plan har en egen scen med pris, hela funktionslistan och när planen
  får Astryx 5 Pro.
- **Bilderna i scenerna:**
  - Free: ett 2D-spel
  - Creator: en 3D-löpare
  - Pro: open world
  - Studio: teamet och versioner
  - Enterprise: White Label, där Nexora-loggan byts mot "DittSpelbolag"
- **Avslutning:** en scen om krediterna och en slutskylt.

Byggs med `FFMPEG=ffmpeg node nexora/build/ad.js plans.html`.

`marketing/nexora-15-9x16.mp4` (32 s) lanserar 1.5-uppdateringen med budskapet att man kan
skapa **vilket spel som helst**:

1. **Krok:** "1.5" slås upp på skärmen.
2. **Vilket spel som helst:** sex vitt skilda idéer skrivs in en i taget, och spelet som
   AI:n skrev för varje idé spelas direkt:
   - pizzor i en food truck
   - robotfotboll på månen
   - ett rytmspel i regnet
   - en katt som smyger förbi hundar
   - en magisk trädgård
   - ett skräckspel med ficklampa i tunnelbanan

   Undertexten lyder "Inga mallar – om du kan beskriva det kan AI:n bygga det".
3. **Självtest:** loggen där modellen testar och rättar sitt spel, och "✓ Självtestad".
4. **Kontroller:** handkontroll, paus och touch.
5. **Image 1.5:** fyra animerade sprite-ark i stilarna pixel, platt, neon och retro.
6. **3D 1.5:** svärd, skattkista, svamp och planet, som `.glb`.
7. **Slutskylt:** "Nexora 1.5 – Vilket spel som helst. Ute nu."

Allt i filmen är AI-utdata. Med `NEXORA_ANTHROPIC_KEY` genererar `build/ad.js` spelen,
modellerna, sprite-arken, musiken och ljuden genom appens egna modeller. Utan nyckel
används exemplen i `marketing/examples/`, i exakt de format modellerna returnerar:

- `games/*.html`
- `meshes.json`
- `sprites/*.svg`
- `music.json`
- `sfx.json`

Exemplen är skrivna av Claude, samma modellfamilj som Pro och Core kör på, eftersom
byggmiljön inte hade någon API-nyckel. Exempelspelen har ett attract-läge
(`window.NEXORA_DEMO`) där de spelar sig själva.

De två äldre filmerna ovan renderades med 1.5.0-versionens spel. De ligger kvar som de
är, och de behöver en nyckel, eller egna exempel under `marketing/examples/games/`, för
att kunna renderas om.

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

- `verify.js` kör webbappen i headless Chromium mot ett simulerat Claude-API som svarar
  som modellerna: spel, SVG, mesh-JSON, noter, syntlager, text och agentturer. Totalt 75
  kontroller:
  - Din egen modell: testet startar den riktiga servern ur `nexora/train` (`serve --dummy`).
    Studio ser att den är igång, och ett spel (självtestat), en 3D-modell och en bild kommer
    från den utan nyckel och utan moln. "Testa anslutningen" hittar den. Om servern inte
    är igång visas hur man startar den, och inget skickas till Claude.
  - Den byggda appen innehåller ingen offline-generator eller spelmall.
  - Utan nyckel genereras ingenting. Studio visar "Koppla in en AI", inställningarna
    erbjuder bara AI-leverantörer och gamla Local-inställningar flyttas till Claude.
  - Idén "Laga pizzor åt otåliga kunder i en food truck" skickas ordagrant till AI:n,
    tillsammans med instruktionen att bygga exakt det spelet i vilken genre som helst.
  - Självtestet: ett trasigt första svar körs, felet skickas i en rättningsförfrågan och
    det rättade spelet visas.
  - Alla verktyg går till AI:n:
    - Story.
    - Image 1.5: neon, fyra bildrutor och en PNG på 1024×256.
    - 3D 1.5: en `.glb` med ett material per färg, där ogiltiga färger rättas.
    - Musik: noterna spelas upp och blir en WAV på 20 s.
    - Ljudeffekt: ett fritt beskrivet ljud blir en WAV.
    - Röstreplik.
  - Övrigt: bibliotek, månadskvot, kodredigerare med versioner, Buggfix med AI, fyra
    exporttyper (giltiga zip-filer), avböjda förfrågningar, 401, egen endpoint, krediter,
    Astryx-lanseringen och mobilbredd.
- Astryx 5 Pro:
  - Lanseringsdatumen testas per plan och datum (26/9, 6/10, 7/10, 13/11 och 14/11).
  - Pro-planen får lanseringsdialogen före 7 oktober.
  - Mot ett simulerat Messages API körs en hel verktygsloop (write_game → run_game →
    finish). Testet kontrollerar att tankeblocket med signatur och `tool_use` skickas
    tillbaka oförändrade, att `run_game` returnerar en riktig skärmbild och mätvärden,
    att `eager_input_streaming` bara sitter på verktygen som bär kod, och att
    `fallbacks` och promptcache är påslagna. Körningen räknas mot kvoten.
- **Skrivbordsappen, end-to-end** (`verify_desktop.js`, 32 kontroller): testet styr den riktiga
  Electron-appen under Xvfb, med riktig Python, riktig Godot 4.7.2, ett simulerat Claude-API
  och en lokal kopia av Poly Havens API med genererade glTF-, HDR- och PNG-filer.
  - **Hyperrealistiskt läge med Claude-agenten, via Studio:**
    - Körningen drar 10 krediter.
    - Agenten får asset-verktygen, söker och laddar ner en modell, en HDRI-himmel och en
      marktextur, och `CREDITS.md` skrivs.
    - Med Python bygger den en skog av dem med AgX. Skogen körs i Godot utan fel med tre
      skärmbilder och sparas i biblioteket.
    - Utan nyckel startar ingen körning.
  - **Claude-agenten mot ett simulerat API:** `run_python` skriver ett projekt och
    `godot_run` kör det utan fel med tre bilder. Sökning och nedladdning fungerar, och
    Python-skyddet blockerar läsning utanför projektet. Lärdomen sparas och finns med i
    nästa körnings instruktioner. `finish` utan testkörning nekas, och kostnaden betalas
    tillbaka.
  - **Riktiga exporter med Godots exportmallar:** Linux (73,7 MB), Windows .exe (109,3 MB),
    webb (40 MB) och macOS .zip (59,7 MB). Det exporterade Linux-spelet startar fristående.
- Krediter: när kvoten är slut öppnas köpdialogen. Ett köp av 25 krediter och ett spel ger
  saldot 24 utan att månadskvoten ändras. Free-planen den 14 november drar 3 krediter för
  Astryx.
- AI-vägen testas mot simulerade svar. Testet kontrollerar att Core 1.5 skickar
  `claude-opus-5` med adaptivt tänkande och effort `xhigh` och att tankeströmmen visas,
  att Flash 1.5 skickar `claude-haiku-4-5`, att rätt headers skickas, att avböjda
  förfrågningar och 401 blir begripliga felmeddelanden och att egen endpoint får en
  OpenAI-förfrågan. Inget anrop gjordes mot det riktiga API:t, eftersom ingen nyckel fanns.
- DEB-paketet packades upp och startades under Xvfb på Ubuntu 24.04. Röktestet bekräftade
  att appen laddar inuti Electron, att standardleverantören är din egen modell, att GLB-exporten
  fungerar och att paketet inte innehåller någon offline-generator. Fyra beroenden (libnotify4, libxss1, xdg-utils,
  libsecret-1-0) gick inte att installera i byggmiljön, så `dpkg` konfigurerade aldrig
  paketet klart, men appen startade ändå.
- DMG-filen packades upp igen: alla filer och symlänkar är identiska med källan,
  exekverbarhetsbitarna finns kvar och alla binärer är ad hoc-signerade arm64-filer.
- EXE-filen: giltig PE-fil, SFX-konfigurationen och 7z-arkivet ligger på rätt plats,
  `7zz t` säger "Everything is Ok" och båda PowerShell-skripten parsas utan fel.
- **Träningspaketet** (`nexora/train/tests`, 13 tester): kontrollerna av svaren,
  datauppdelningen (okända idéer hålls utanför träningen), startdatan, buggfix-förfrågan
  (ordagrant appens), servern (vanlig, strömmande, CORS, felaktig förfrågan) och
  kommandoraden. `data` och `serve --dummy` har också körts för hand.
- **Inte testat:**
  - Själva PyTorch-träningen, självspelet och utvärderingen har inte kunnat köras här.
    Byggmiljön blockerar pypi.org, download.pytorch.org och huggingface.co, så varken
    PyTorch, transformers eller basmodellen gick att hämta, och det finns ingen GPU.
    Koden är skriven för transformers ≥ 4.44, peft ≥ 0.12 och PyTorch ≥ 2.2.
  - EXE-filen har inte körts på Windows och DMG-filen har inte öppnats på en Mac, eftersom
    byggmiljön saknar båda.
  - Colab-anteckningsboken har inte körts, eftersom byggmiljön saknar GPU och API-nyckel.
    Alla kodceller kompilerar.
  - Poly Havens riktiga API är blockerat här, så sökning och nedladdning är testade mot en
    kopia med samma svarsformat.
  - Godot renderade i testerna med OpenGL-reserven (ingen GPU), så SDFGI, SSR och
    volymetrisk dimma syns först på en riktig dator.
  - Ingen verklig Claude-körning har gjorts, varken av spel, verktyg eller Astryx,
    eftersom ingen API-nyckel fanns. Allt AI-flöde är testat mot simulerade svar.

## Källkod

```
src/ai.js        Nexora-modellerna → din egen modell / Anthropic / OpenAI-kompatibel endpoint; PROMPTS = alla förfrågningar
src/media.js     kontrollerar och renderar AI-utdata: .glb/.obj, musik och ljudeffekter till WAV
src/viewer3d.js  3D-visaren för 3D 1.5
src/app.js       gränssnitt, planer, Studio, verktyg, bibliotek, export
src/app.css      stil
src/shell.html   mall som build.py fyller i
desktop/main.js  Electron-huvudprocessen: Godot, Python, projekt, testkörning, export, Poly Haven
desktop/preload.js, unzip.js, python_guard.py
desktop/godot/   testsonden (probe*.gd) som Astryx använder i godot_run
train/nexora_model/   din egen modell: data, selfplay (självspel), selftest (spelar spelen),
                      train (PyTorch + LoRA), evaluate, serve (OpenAI-kompatibel server)
```

Varje spel som AI:n skriver är en fristående HTML-fil som inte behöver Nexora för att köras.
