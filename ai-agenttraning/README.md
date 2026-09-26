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
- **🤖 Mina agenter** – hur många agenter som helst, var och en med sin egen
  hjärna. Spara en agent som fil och öppna den på en annan dator.

Allt fungerar utan internet och sparas automatiskt på datorn.

## Filer

| Fil | För | Storlek |
|---|---|---|
| [`dist/raken-ai-agenttraning-1.0.0.html`](dist/raken-ai-agenttraning-1.0.0.html) | alla webbläsare | 0,1 MB |
| [`dist/raken-ai-agenttraning_1.0.0_amd64.deb`](dist/raken-ai-agenttraning_1.0.0_amd64.deb) | Debian / Ubuntu (x86-64) | 79,7 MB |
| [`dist/Raken-AI-Agenttraning-1.0.0-arm64.dmg`](dist/Raken-AI-Agenttraning-1.0.0-arm64.dmg) | Mac med Apple-chip (M1–M4) | 98,4 MB |
| [`dist/Raken-AI-Agenttraning-1.0.0-x64.dmg`](dist/Raken-AI-Agenttraning-1.0.0-x64.dmg) | Mac med Intel-processor | 101,1 MB |

### HTML

En enda fil. Dubbelklicka på den så öppnas appen i webbläsaren – det går även
från ett USB-minne. Det du tränar sparas i just den webbläsaren.

### Linux (.deb)

```sh
sudo apt install ./raken-ai-agenttraning_1.0.0_amd64.deb
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

**Smarthet.** *Hitta vägen* räknas som ett prov på alla banor: hur nära den
kortaste vägen agenten kommer utan att chansa. *Prata* växer med antal svar,
antal ord och antal 👍.

## Vad som är testat

`build/verify.cjs` kör appen i Chromium från `file://` och klickar sig igenom
den som en elev skulle – 30 kontroller, alla godkända: agenten skapas och kan
ingenting, lär sig bana 1 efter 300 rundor och klarar provet, lär sig
labyrinten, lär sig när du styr med piltangenterna, kommandokod och kartkod
bygger rätt bana, felmeddelanden på svenska, chatten svarar på inlärda och
omformulerade frågor, hittar på meningar och lär sig rätt svar. Allt finns kvar
efter omstart, agentfiler kan sparas och öppnas, inga sidfel, och ingen
sidledsscroll i mobilbredd.

`.deb`-paketet installerades med `apt` på Ubuntu 24.04 och startades i ett
riktigt fönster (under `xvfb`). `build/verify-desktop.cjs` skapade och tränade
en agent i skrivbordsappen, stängde den och startade igen – träningen fanns kvar.

**Mac-filerna är inte körda på en Mac**, eftersom det inte finns någon Mac i
byggmiljön. Det som är kontrollerat: båda `.dmg` packas upp av två oberoende
program (`dmg2img` och 7-Zip, som även kontrollerar CRC) till exakt samma
skiva som byggdes; skivan innehåller appen, en genväg till Program och en
läs-mig-fil; ramverkets symlänkar och körbarhetsbitar finns kvar; och appen,
dess hjälpprogram och ramverk har en ad-hoc-signatur. Appen bygger på den
officiella Electron-körningen med samma innehåll som testades på Linux.

## Bygga själv

```sh
python3 build/build.py                         # html, deb, arm64- och x64-dmg
NODE_PATH=$(npm root -g) node build/verify.cjs  # webbläsartestet
```

Byggskriptet behöver `dpkg-deb`, `unzip`, `xorrisofs`, Pillow,
[`rcodesign`](https://github.com/indygreg/apple-platform-rs) och `dmg` från
[fanquake/libdmg-hfsplus](https://github.com/fanquake/libdmg-hfsplus) med
`build/libdmg-hfsplus-bzip2.patch` (skriver bzip2-komprimerade `.dmg`, samma
format som `hdiutil -format UDBZ`, så att filerna blir under GitHubs gräns på
100 MB). Det laddar ner Electron 43.2.0 första gången.

## Kontrollsummor (SHA-256)

```
710ca12a6c35daeea5116b17238e0efd539e48f0a35fee1edd83728e6aea851e  raken-ai-agenttraning-1.0.0.html
cb4c0e4943974d1f85878fa56f9957cce24a2a3f48f9ba2c09580c3d2158e3d3  raken-ai-agenttraning_1.0.0_amd64.deb
220d5460deacce5f82d2ba1820cb361eb9ffcfb3e6fab51f7e49ed0ca3331c1a  Raken-AI-Agenttraning-1.0.0-arm64.dmg
464b9f121f32c2953f1ddef0a7417034647276ec5d6987fdc3cc115301df5708  Raken-AI-Agenttraning-1.0.0-x64.dmg
```
