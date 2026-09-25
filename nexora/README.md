# Nexora – skapa spel med AI

Nexora gör spelbara 2D- och 3D-spel av en beskrivning. Samma app finns som webbplats,
Windows-installation (EXE), macOS-skivavbild (DMG) och Linux-paket (DEB).

| Fil | Plattform |
|---|---|
| `index.html` | Webbplatsen. En fristående fil som går att lägga på valfritt webbhotell. |
| `dist/Nexora-Setup-1.0.0-x64.exe` | Windows 10/11, 64-bit |
| `dist/Nexora-1.0.0-arm64.dmg` | macOS 12+ på Apple Silicon |
| `dist/nexora_1.0.0_amd64.deb` | Debian, Ubuntu, Mint (x86-64) |
| `dist/nexora-1.0.0.html` | Kopian som skrivbordsapparna laddar |
| `colab/Nexora_Flash_1_Colab.ipynb` | Tränar en egen Nexora Flash-modell i Google Colab |

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

**Windows:** kör `Nexora-Setup-1.0.0-x64.exe`. Nexora installeras för din användare i
`%LOCALAPPDATA%\Programs\Nexora`, utan administratörsrättigheter, med genvägar på
skrivbordet och i Start-menyn. Avinstallera via *Inställningar → Appar*. Filen är inte
kodsignerad, så SmartScreen varnar: välj *Mer info → Kör ändå*.

**macOS:** öppna DMG-filen och dra Nexora till Program. Appen är ad hoc-signerad men inte
notariserad. Första gången: högerklicka på appen och välj *Öppna*. På macOS 15 och senare
godkänner du den under *Systeminställningar → Integritet och säkerhet → Öppna ändå*.

**Linux:** `sudo apt install ./nexora_1.0.0_amd64.deb` och starta sedan `nexora` eller
välj Nexora i programmenyn.

## Bygga

```sh
python3 nexora/build/build.py      # src/ → index.html + dist/nexora-1.0.0.html
python3 nexora/build/desktop.py    # → dist/*.exe, *.dmg, *.deb  (körs på Linux)
python3 nexora/build/build.py      # lägger in storlekar och SHA-256 på nedladdningssidan
node nexora/build/dataset.js       # → colab/nexora_seed.jsonl
node nexora/build/verify.js        # testar appen i headless Chromium (Playwright)
```

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
  (giltiga zip-filer) och att sidan inte scrollar i sidled i mobilbredd.
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
- **Inte testat:** EXE-filen har inte körts på Windows och DMG-filen har inte öppnats på
  en Mac, eftersom byggmiljön saknar båda. Colab-anteckningsboken är syntaxkontrollerad
  men har inte körts, eftersom byggmiljön saknar GPU.

## Källkod

```
src/runtime.js   spelmotor: canvas, input (tangentbord + touch), ljud, musik, 3D-renderare
src/games.js     de nio spelmallarna
src/localgen.js  Nexora Local: tolkar prompten, text-/sprite-/3D-/musik-/ljudgeneratorer
src/ai.js        Nexora-modellerna → Anthropic / OpenAI-kompatibel endpoint
src/app.js       gränssnitt, planer, Studio, verktyg, bibliotek, export
src/app.css      stil
src/shell.html   mall som build.py fyller i
```

Funktionerna i `runtime.js` och `games.js` bäddas in i varje exporterat spel med
`Function.toString()`. Ett exporterat spel är därför en enda fil som inte behöver Nexora
för att köras.
