# One AI

One AI är en vanlig chattapp (samma upplägg som ChatGPT och Claude: chattar i
sidofältet, modellväljare överst, en ruta att skriva i längst ner) med ett
multiagentsystem bakom. Fråga något och One svarar, eller be One skapa något
och rätt agent gör en riktig fil: dokument, kod, appar, bilder, video, musik,
presentationer, formulär, webbplatser, mejl, design och 3D-modeller.

| Plattform | Fil |
|---|---|
| Windows 10/11 | `OneAI-Setup-1.0.0.exe` |
| macOS (Apple Silicon / Intel) | `OneAI-1.0.0-mac-arm64.dmg` / `OneAI-1.0.0-mac-x64.dmg` |
| Debian / Ubuntu | `one-ai_1.0.0_amd64.deb` |
| Android 8+ | `OneAI-1.0.0.apk` (installera direkt) och `OneAI-1.0.0.aab` (Google Play) |
| iPhone / iPad (iOS 15+) | `OneAI-1.0.0.ipa` (osignerad, se [iOS](#ios)) |
| Webbläsare | `OneAI-1.0.0.html` (en enda fil), eller webbappen som servern själv visar |

CI (`.github/workflows/one-ai.yml`) bygger alla sju vid varje push som ändrar
`one-ai/` och lägger dem på GitHub-releasen **`one-ai-v1.0.0`**.

## Modeller

| Modell | Till för | Enheter per meddelande |
|---|---|---|
| One 1 Mini | snabba svar, enkla filer | 1 |
| One 1 Standard | det mesta, varje dag | 1 |
| One 1 Plus | bättre kod och resonemang | 2 |
| One 1 Max | svåra uppgifter, stora appar | 4 |
| One 1 Max Fast | nästan Max, mycket snabbare | 3 |
| One 1 Ultra | granskar och rättar sitt eget arbete (bara Enterprise) | 10 |
| One 2 Mini / Standard / Plus / Max / Max Fast / Ultra | nästa generation (Enterprise) | 1 / 2 / 3 / 6 / 5 / 15 |

Ultra och One 2 Max/Max Fast gör två pass (bygg, granska och rätta). One 2
Ultra gör tre (planera, bygg, granska).

**Om "egen, vältränad modell":** att träna en egen grundmodell från noll går
inte att göra i kod här; det kräver datacenter och månader av träning. One-
modellerna är därför One AI:s egna modeller i produkten (namn, instruktioner,
granskningspass, agenter och planer), som körs ovanpå Googles Gemini-modeller.
Vilken modell som ligger bakom varje One-modell styrs på servern
(`cloud/onecloud/config.py`, eller `ONEAI_MODEL_ONE_1_MAX=...` i miljön) och
syns aldrig i apparna: `/v1/config` och alla svar innehåller bara One-namn, och
testerna kontrollerar att inga fel avslöjar leverantören. Byt till en annan
eller egen modell senare genom att ändra `providers.py`.

## Agenter

| Agent | Gör | Filer |
|---|---|---|
| 📄 Filegent | vanliga filer | PDF, Word (DOCX), Excel (XLSX), PowerPoint, CSV, JSON, Markdown, kod i alla språk, alla textformat |
| 🖼️ Imagent | bilder och fotoredigering (bifoga en bild) | PNG/JPEG |
| 🎬 Vidagent | video (bifoga en bild för att animera den) | MP4 |
| 🧩 Appagent | appar och spel som fungerar direkt | HTML + installerbar webbapp (ZIP) |
| 📽️ Presegent | presentationer | PPTX + bildspel i webbläsaren |
| 📝 Formegent | formulär och enkäter, svar exporteras som CSV | HTML |
| 🌐 Sitegent | webbplatser med flera sidor | ZIP + förhandsvisning |
| ✉️ Inboxagent | mejl, svar och nyhetsbrev | .eml (öppnas som utkast i mejlprogram) |
| 🎵 Musigent | låtar | MP3; utan musikmodell: WAV + MIDI som One komponerar och syntar själv |
| 🧊 Modelgent | 3D-modeller | GLB (Blender, Windows 3D, webben); visas i 3D i appen |
| 🎨 Designgent | logotyper, ikoner, affischer, UI-skisser | SVG |

I **Auto** (standard) bestämmer One själv vilka agenter som behövs, upp till
tre samtidigt, och kör dem parallellt. Man kan också välja en agent i rutan
bredvid gem-knappen. Uppföljningar som "gör den blå" fungerar: textfiler från
förra svaret skickas med.

Alla PDF-, Word-, Excel-, PowerPoint-, WAV-, MIDI-, GLB-, ZIP- och EML-filer
byggs av servern själv (`cloud/onecloud/files.py`, bara Pythons standard-
bibliotek), så de är riktiga filer, inte text med fel filändelse.

## Planer

| | Pris/mån | Modeller | Agenter | Användning | MCP-kopplingar |
|---|---|---|---|---|---|
| **One Lite** | 0 kr | One 1 Mini, Standard, Plus | Filegent (vanliga filer). Ingen Imagent eller Vidagent | 50 enheter/dag | 1 |
| **One Go** | 60 kr | som Lite | + Imagent, enkel variant (svagare bildmodell, 3 bilder/dag) | 50 enheter/dag | 2 |
| **One Plus** | 129 kr | + One 1 Max, Max Fast | Vidagent, Appagent, Imagent, Presegent, Formegent, Sitegent, Inboxagent + Musigent, Modelgent, Designgent | 1 500 enheter/dag (video 5/dag, bilder 60/dag, musik 20/dag) | 5 |
| **One Pro** | 1 299 kr | som Plus | som Plus | 50 000 % av Plus = 500× (750 000 enheter/dag) | 25 |
| **One Enterprise Lite** | 4 999 kr | + One 1 Ultra, One 2 Standard | alla | som Pro | 100 |
| **One Enterprise** | 13 499 kr | + hela One 2-familjen | alla | obegränsad | obegränsat |

Tolkningar att känna till (allt ändras på ett ställe, `PLANS` i
`cloud/onecloud/config.py`):

- **One Pro** "hälften av 100 000 % användning" är tolkat som 50 000 % av
  One Plus, alltså 500 gånger Plus gränser.
- **One Enterprise** "oändlighets användning med hälften av funktionerna":
  den dyraste planen har här **alla** funktioner, eftersom färre funktioner än
  billigare Enterprise Lite verkade vara ett skrivfel. Vill du verkligen
  begränsa den, ta bort agenter ur dess `agents`-lista.
- Planerna gäller per konto och dag; enheter för agenter som misslyckas
  betalas tillbaka.

**Betalningen är en demo:** "Betala" aktiverar planen och skapar ett
`DEMO-`-kvitto men drar inga pengar och tar inga kortuppgifter. Koppla in
Stripe, Klarna eller Swish (och för iOS/Android: köp i appen enligt Apples
och Googles regler) innan riktiga pengar ska tas. En operatör kan flytta ett
konto direkt:

```sh
python -m onecloud set-plan acc_1234abcd enterprise        # där databasen ligger
curl -X POST https://DIN-SERVER/v1/admin/plan -H "X-Admin-Key: $ONEAI_ADMIN_KEY" \
     -H "Content-Type: application/json" -d '{"account": "acc_1234abcd", "plan": "enterprise"}'
```

## MCP

One AI pratar MCP (Model Context Protocol) åt båda hållen:

- **Koppla MCP-servrar till One:** Inställningar → Kopplingar (MCP) → namn,
  adress (Streamable HTTP, `https://…`) och nyckel. One ser servrarnas verktyg
  i chatten och anropar dem själv; svaret visar vilka verktyg som användes.
  Servern går bara mot publika `https`-adresser (inga interna nät, inga
  omdirigeringar).
- **Använd One i andra appar:** One AI Cloud är själv en MCP-server på
  `https://DIN-SERVER/mcp`. Lägg in den i Claude, Cursor eller andra
  MCP-klienter med kontots nyckel som `Authorization: Bearer …` (Inställningar
  → Kopplingar visar adress, nyckel och färdig konfiguration). Verktyg:
  `one_chat` (fråga en One-modell), `one_create` (låt en agent skapa filer,
  som filer tillbaka) och `one_account`.

## One AI Cloud (servern)

Apparna behöver en server: den håller API-nyckeln hemlig, räknar planer och
användning, kör agenterna och MCP. Modellerna i sig körs i Googles moln, så
servern är liten: bara Python 3.10+ och standardbiblioteket, och den visar
också webbappen på `/`.

```sh
cd one-ai/cloud
cp .env.example .env            # fyll i GEMINI_API_KEY (och ONEAI_ADMIN_KEY)
python -m onecloud --port 8788  # data i ./oneai.sqlite3 (eller ONEAI_DB)
```

Öppna `http://localhost:8788` för webbappen. Med Docker (från `one-ai/`):

```sh
docker build -f cloud/Dockerfile -t one-ai .
docker run -p 8788:8788 -e GEMINI_API_KEY=... -v oneai-data:/data one-ai
```

På Render: New → Web Service → det här repot, Root Directory `one-ai`,
Dockerfile `cloud/Dockerfile`, miljövariabeln `GEMINI_API_KEY` och en disk på
`/data`.

Sätt sedan repo-variabeln **`ONEAI_CLOUD_URL`** (Settings → Secrets and
variables → Actions → Variables) till serverns adress, så ansluter alla appar
som CI bygger direkt. Annars anger man adressen i appen under Inställningar →
Allmänt.

Kolla modell-id:na innan du driftsätter: Googles modeller byter namn och
pensioneras ofta. Standardvärdena (oktober 2026) står i `config.py`; byt utan
kodändring med `ONEAI_MODEL_<MODELL>` och `ONEAI_MEDIA_<AGENT>` (se
`.env.example`). Om ett id inte finns misslyckas svaret och enheterna betalas
tillbaka.

| Miljövariabel | |
|---|---|
| `GEMINI_API_KEY` | krävs |
| `ONEAI_ADMIN_KEY` | för `/v1/admin/plan` |
| `ONEAI_DB` | databasfil (standard `oneai.sqlite3`) |
| `ONEAI_FAKE_MODELS=1` | inga riktiga modeller, för test och demo utan nyckel |
| `ONEAI_MCP_ALLOW_PRIVATE=1` | tillåt MCP-servrar på interna adresser (egen drift) |

API:t står överst i `cloud/onecloud/server.py`.

## Installera

- **Windows:** kör `OneAI-Setup-1.0.0.exe`. Den är inte kodsignerad, så
  SmartScreen kan varna: välj "Mer information" → "Kör ändå".
- **macOS:** öppna `.dmg` och dra One AI till Program. Appen saknar Apple
  Developer ID, så första gången: Systeminställningar → Integritet och
  säkerhet → Öppna ändå (macOS 15+), eller högerklicka → Öppna. Eller kör
  `xattr -dr com.apple.quarantine "/Applications/One AI.app"`.
- **Linux:** `sudo apt install ./one-ai_1.0.0_amd64.deb`, starta One AI från
  menyn eller kör `one-ai`.
- **Android:** öppna `OneAI-1.0.0.apk` på telefonen och tillåt "Installera
  okända appar". APK och AAB är signerade med demonyckeln
  `android/app/oneai-demo.jks`; byt nyckel innan Google Play
  (`ONEAI_KEYSTORE`, `ONEAI_KEYSTORE_PASSWORD`, `ONEAI_KEY_ALIAS`).
- **Webben:** öppna `OneAI-1.0.0.html` i valfri webbläsare, eller gå till
  serverns adress.

### iOS

Apple låter bara signerade appar installeras, och signering kräver ditt eget
Apple-konto. CI bygger därför en **osignerad** `OneAI-1.0.0.ipa`. Installera
den genom att signera med Sideloadly, AltStore eller Xcode (gratis Apple-ID
räcker för egen telefon, 7 dagar i taget), eller bygg och skicka till
TestFlight/App Store med ett Apple Developer-konto: `ios/build-ipa.sh` på en
Mac, eller öppna projektet efter `cd ios && xcodegen generate`.

## Hur det är byggt

- `cloud/`: One AI Cloud. `config.py` (modeller, agenter, planer),
  `agents.py` (routning och agenterna), `files.py` (filbyggarna), `mcp.py`
  (MCP-klient och -server), `providers.py` (modellanropen), `store.py`
  (konton, användning, kopplingar i SQLite), `server.py` (HTTP-API och
  webbappen). Testerna (`python -m unittest discover -s tests`) kör hela
  flödet med låtsasmodeller och mot en låtsas-Gemini.
- `web/`: själva appen, vanlig HTML/CSS/JS utan ramverk. Alla plattformar
  visar samma filer. Chattar och filer sparas bara på enheten (IndexedDB).
- `desktop/`: Electron-skal för Windows, macOS och Linux.
- `android/`: WebView-skal (Java) med spara/dela-brygga; webbappen kopieras
  in vid bygget.
- `ios/`: WKWebView-skal (Swift, XcodeGen) med spara/dela via delningsbladet.
- `scripts/build-html.py`: bygger HTML-filen; `scripts/make-icons.py` ritar
  ikonerna.

Förhandsvisningar av appar och sajter körs i sandlådade iframes utan
åtkomst till appen eller bryggan; bryggan tar bara emot anrop från appens
egen sida.
