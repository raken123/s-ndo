# Raken Teknik Åk 4 2026/2027 AI Agentträning

Skapa egna AI-agenter som från början **inte förstår någonting**, och träna dem
tills de blir smarta – utan att skriva kod.

- **🧱 Bygg bana** – rita 2D-hinderbanor med väggar, lava, mynt, start och mål.
  Du kan också *koda* banan, antingen som en karta av tecken eller med kommandon
  som `vägg 3 2 till 3 8` och `upprepa 4 { … }`.
- **🎓 Träna** – agenten lär sig hitta vägen med belöningar och straff
  (förstärkningsinlärning / Q-learning). Titta på när den tränar, snabbträna
  1000 rundor, ge 👍/👎, styr den själv med piltangenterna så att den lär sig
  av dig, och slå på **Visa hjärnan** för att se vad den har lärt sig i varje ruta.
- **💬 Prata** – agenten kan inga ord från början och säger bara "bip blopp".
  Lär den svar på frågor, låt den läsa texter och ge 👍 på bra svar. När den
  inte vet svaret hittar den på en mening av orden den har läst.
- **🧩 Koda med block** – alla Scratch-block, på svenska: Rörelse, Utseende, Ljud,
  Händelser, Kontroll, Känna av, Operatorer, Variabler, Mina block, Penna, Musik
  och Text till tal. Dessutom kategorierna **AI-agent** (fråga agenten, lär den
  svar, låt den välja drag och belöna den) och **Schack** (regler och en
  schack-AI). Bygg spel med sprajter, kostymer, bakgrunder och ljud – ladda upp
  egna bilder och ljud, rita, spela in, eller välj ur biblioteket.
- **🤖 Mina agenter** – hur många agenter som helst, var och en med sin egen
  hjärna och gärna en egen bild (🖼). Spara en agent som fil och öppna den på en
  annan dator.

Allt fungerar utan internet och sparas automatiskt på datorn.

## Filer

| Fil | För | Storlek |
|---|---|---|
| [`dist/raken-ai-agenttraning-1.1.0.html`](dist/raken-ai-agenttraning-1.1.0.html) | alla webbläsare | 1,5 MB |
| [`dist/raken-ai-agenttraning_1.1.0_amd64.deb`](dist/raken-ai-agenttraning_1.1.0_amd64.deb) | Debian / Ubuntu (x86-64) | 79,9 MB |
| [`dist/Raken-AI-Agenttraning-1.1.0-arm64.dmg`](dist/Raken-AI-Agenttraning-1.1.0-arm64.dmg) | Mac med Apple-chip (M1–M4) | 98,7 MB |
| [`dist/Raken-AI-Agenttraning-1.1.0-x64.dmg`](dist/Raken-AI-Agenttraning-1.1.0-x64.dmg) | Mac med Intel-processor | 101,4 MB |

### HTML

En enda fil. Dubbelklicka på den så öppnas appen i webbläsaren – det går även
från ett USB-minne. Det du tränar sparas i just den webbläsaren.

### Linux (.deb)

```sh
sudo apt install ./raken-ai-agenttraning_1.1.0_amd64.deb
raken-ai-agenttraning
```

Appen hamnar också i programmenyn under *Utbildning*. Använd `apt` och inte
`dpkg -i`, så följer de paket som behövs med.

### Mac (.dmg)

1. Öppna `.dmg`-filen och dra **AI Agentträning** till **Program**.
2. Appen är inte registrerad hos Apple, så första gången säger macOS att den
   inte kan kontrollera den:
   - **macOS 15 och nyare:** Systeminställningar → Integritet och säkerhet →
     scrolla ner → **Öppna ändå**.
   - **macOS 14 och äldre:** högerklicka på appen → **Öppna** → **Öppna**.
   - Eller i Terminal:
     `xattr -dr com.apple.quarantine "/Applications/AI Agentträning.app"`

Välj `arm64` för Mac med Apple-chip och `x64` för äldre Mac med Intel.
Under Apple-menyn → Om den här datorn står det vilket chip du har.

## Så funkar AI:n

**Hitta vägen.** Agenten har ett minne (en tabell) med ett värde för varje
ruta och varje riktning. Från början är alla värden noll, så den går på
måfå. Efter varje steg justeras värdet mot belöningen den fick plus det
bästa den tror finns i nästa ruta. Mål ger +10, lava −10, varje steg −0,1
och en krock i väggen −0,5 – så efter många rundor lönar det sig att ta den
kortaste säkra vägen. Alla belöningar går att ändra under *Belöningar och straff*.

Det finns två sorters hjärnor:

- **Platsminne** minns varje ruta på varje bana. Den lär sig en bana perfekt
  men måste börja om på en ny bana.
- **Sinnen** ser bara de fyra rutorna runt sig, vet åt vilket håll målet ligger
  och känner om det blir *varmare* eller *kallare*. Den kan klara banor den
  aldrig sett, men fastnar lätt i labyrinter. Bra att jämföra i klassen!

**Prata.** Svar som du lär ut matchas mot frågan ord för ord (utan att bry sig
om böjningar som *hund/hunden* och med mindre vikt på småord som *du* och
*vad*). Texter som agenten läser blir en tabell över vilka ord som brukar
komma efter varandra, och ur den hittar agenten på meningar – samma grundidé
som stora språkmodeller, i mycket liten skala.

**Block som lär sig.** Blocket *agenten väljer bland (sten sax påse) i läget
(…)* väljer ett alternativ. I början är valet slumpat; *belöna agenten med (1)*
ger poäng till valen i rundan, mest till det senaste, så nästa gång väljer
agenten oftare det som gav belöning i samma läge. Agentens *nyfikenhet* styr
hur ofta den ändå testar något nytt. Varje projekt har ett eget minne i agenten.

**Schack.** Blocken kan alla regler (rockad, en passant, bondeförvandling,
schack, matt, patt, remi). *Agenten gör ett drag och tänker (2) drag framåt*
letar bland dragen (alfa-beta-sökning). När ett parti är slut minns agenten
vilka av sina drag som ledde till vinst eller förlust och väljer hellre de
vinnande när flera drag är ungefär lika bra.

**Smarthet.** *Hitta vägen* räknas som ett prov på alla banor: hur nära den
kortaste vägen agenten kommer utan att chansa. *Prata* växer med antal svar,
antal ord och antal 👍.

## Exempel under ⭐ Exempel

- **Schack mot agenten** – ett helt schackspel byggt med block. Pjäserna ritas
  som kloner, du klickar på en pjäs och sedan på en ruta, agenten svarar.
- **Luffarschack som lär sig** – tryck **T** så spelar agenten 300 omgångar mot
  slumpen och lär sig med belöningar. Blir den svårare att slå?
- **Prata med agenten** – klicka och skriv; tryck **L** för att lära den något.
- **Min första sprajt** och **Rita med pennan** – att börja med.

## Vad som är testat

**Webbläsaren** (single-file HTML från `file://` i Chromium), tre testfiler:

- `build/verify.cjs` – agenter, banor, träning och prat. 30 kontroller, alla godkända.
- `build/verify-blocks.cjs` – blockmotorn. Kontrollerar först att **alla 195
  block i paletten** (för sprajt och scen) har en körbar implementation, och
  kör sedan små program av riktiga block för varje kategori: rörelse, glid,
  studs, utseende och alla grafiska effekter, lager, ljud, meddelanden (och
  vänta), tangenter, klick, timer-hatt, loopar, stopp, kloner, att röra
  kant/sprajt/mus/färg, fråga/svar, operatorer med Scratchs regler för
  jämförelser, variabler, listor, egna block med indata, rekursion och "kör
  utan skärmuppdatering", penna, musik, röst, AI-blocken (agenten lär sig vilket
  val som ger belöning) och schackblocken (drag, otillåtna drag, schackmatt).
  94 kontroller, alla godkända.
- `build/verify-editor.cjs` – blockeditorn som en elev använder den: gröna
  flaggan, stopp, klick på skript, skapa variabel/lista (bara för sprajten eller
  för alla) och eget block via de riktiga dialogerna, visa variabel på scenen,
  ladda upp bild och ljud, välja ur biblioteket, rita en kostym, en hinderbana
  som bakgrund, sprajter in och ut, dra sprajten på scenen, projekt kvar efter
  omstart, spara/öppna projektfil, alla fyra exemplen (i schack: 32 pjäser, ditt
  drag, agentens svar, otillåtna drag stoppas, agenten minns ett förlorat parti;
  i luffarschack: 300 övningsomgångar), "Spara allt" tar med projekten, ingen
  sidledsscroll i mobilbredd. 34 kontroller, alla godkända.

Schackreglerna är dessutom kontrollerade mot de vedertagna *perft*-talen (antal
möjliga ställningar några drag framåt) för fem standardställningar – 17 av 17
stämmer exakt.

**Linux:** `.deb`-paketet installerades med `apt` på Ubuntu 24.04 och kördes i
ett riktigt Electron-fönster (under `xvfb`). `build/verify-desktop.cjs` tränade
en agent, öppnade blockeditorn, startade schackexemplet (32 pjäser), stängde
appen och startade igen – träningen och projekten fanns kvar.

**Mac-filerna är inte körda på en Mac**, eftersom det inte finns någon Mac i
byggmiljön. Det som är kontrollerat: båda `.dmg` packas upp av två oberoende
program (`dmg2img` och 7-Zip, som även kontrollerar CRC) till exakt samma
skiva som byggdes; skivan innehåller appen, en genväg till Program och en
läs-mig-fil; ramverkets symlänkar och körbarhetsbitar finns kvar; och appen,
dess hjälpprogram och ramverk har en ad-hoc-signatur. Appen bygger på den
officiella Electron-körningen med samma innehåll som testades på Linux.

Det som inte finns med från Scratch: tilläggen som kräver internet eller extra
hårdvara (Översätt, Videoavkänning, LEGO, micro:bit m.fl.) och Scratchs
målarprogram (här finns ett enklare). Det går inte heller att öppna
Scratch-filer (`.sb3`) – projekt sparas som `.rakenprojekt.json`.

## Bygga själv

```sh
python3 build/vendor.py                              # hämtar Scratchs blockeditor (scratch-blocks)
python3 build/build.py                               # html, deb, arm64- och x64-dmg
NODE_PATH=$(npm root -g) node build/verify.cjs       # och verify-blocks.cjs, verify-editor.cjs
```

Blockeditorn är [scratch-blocks](https://github.com/scratchfoundation/scratch-blocks)
1.3.0 från Scratch Foundation (Apache-2.0), med dess svenska översättning.
Licensen ligger i `app/vendor/scratch-blocks/LICENSE`. Motorn som kör blocken,
AI-blocken, schack och resten är skrivna för den här appen (`app/blocks/`).

Byggskriptet behöver `dpkg-deb`, `unzip`, `xorrisofs`, Pillow,
[`rcodesign`](https://github.com/indygreg/apple-platform-rs) och `dmg` från
[fanquake/libdmg-hfsplus](https://github.com/fanquake/libdmg-hfsplus) med
`build/libdmg-hfsplus-bzip2.patch` (skriver bzip2-komprimerade `.dmg`, samma
format som `hdiutil -format UDBZ`, så att filerna blir under GitHubs gräns på
100 MB). Det laddar ner Electron 43.2.0 första gången.

## Kontrollsummor (SHA-256)

```
2bf574ccf600133c98cd38cfbee9f7c4312757a262f80efb4cb4922e6d6313e0  raken-ai-agenttraning-1.1.0.html
4d1fc08545e954e52a9c30b91d83eaedb342b8e64fec8a16a6ebb5a288a0fc42  raken-ai-agenttraning_1.1.0_amd64.deb
00ebfe0a8ce20f0ac757403343893f9fdf3d3dbefbe9e61cc89971033274ef32  Raken-AI-Agenttraning-1.1.0-arm64.dmg
8bfc317185e863d18ce629135f4b4b8ed4a16b084396c2016e734fc13b6e71de  Raken-AI-Agenttraning-1.1.0-x64.dmg
```
