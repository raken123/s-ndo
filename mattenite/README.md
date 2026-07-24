# Mattenite 💣

**Svara. Kasta. Överlev.** Ett mattespel för Android (Apache Cordova) där du svarar
på en fråga och sedan kastar bomben vidare till en annan spelare — som då måste
svara på sin fråga. Den som håller i bomben när klockan tar slut förlorar ett liv.
Sist kvar vinner.

Hela spelet körs offline och all data sparas lokalt på enheten.

## Färdig APK

`dist/Mattenite-1.0.0-debug.apk` (3,4 MB, minSdk 24 / Android 7+).

Installera: kopiera filen till telefonen, öppna den och tillåt "installera okända
appar" för din filhanterare. Appen heter **Mattenite** och har den lila
bomb-ikonen.

Varje push till `mattenite/**` bygger dessutom en ny APK via GitHub Actions
(`.github/workflows/mattenite-apk.yml`) som kan laddas ner under Actions →
senaste körningen → Artifacts.

## Så spelas det

1. **Lobbies** — gå till fliken *Lobbies* och tryck på en lobby för att gå med.
   Du kan också skapa en egen lobby eller gå med via en femteckens kod. I lobbyn
   ser du spelarlistan, chatten och vem som är redo. Tryck **Starta** när minst
   två är redo.
2. **I matchen** — den som har bomben får en mattefråga. Svarar du rätt får du
   välja vem bomben kastas till. Svarar du fel brinner två sekunder av klockan
   och du får en ny fråga. Vid noll sekunder smäller bomben hos den som håller i
   den: ett liv försvinner och en ny runda börjar med kortare tid.
3. **Sist kvar vinner** och får mynt och XP.

### Spellägen

| Läge | Vad som händer |
|------|----------------|
| 💣 Het bomb | Klassiskt: svara, kasta vidare, sist kvar vinner. 2–8 spelare. |
| ⚡ Blixt | 60 sekunder, flest rätta svar vinner. |
| 🛡️ Överlevnad | Ensam mot en klocka som blir snabbare för varje rätt svar. |
| ⚔️ Duell | 1 mot 1 — bomben studsar tills någon faller. |
| 🎯 Träning | Ingen klocka, ingen press. |
| 📅 Dagens utmaning | 10 frågor som är exakt likadana för alla, varje dag. Bygg din dagssvit. |

### Power-ups

Var tredje rätt svar i en match ger en power-up (max tre i taget):

⏸️ **Frys** pausar bomben i 4 sekunder · ⏭️ **Hoppa** byter ut frågan ·
🛡️ **Sköld** studsar tillbaka nästa bomb som kastas på dig ·
🔀 **Kasta** släpper bomben direkt utan att svara · 💎 **Dubbel** ger dubbel XP resten av matchen.

### Övrigt innehåll

- **12 frågekategorier** med fyra svårighetsgrader: addition, subtraktion,
  multiplikation, division, potenser & rötter, procent, bråk, ekvationer,
  geometri, negativa tal, talföljder och primtal. Frågorna genereras slumpmässigt,
  så de tar aldrig slut.
- **100 prestationer** i 13 grupper, inklusive sex hemliga. Varje prestation ger mynt.
- **Nivåer och XP**, mynt, butik med avatarer, sex teman och sex bombskinn.
- **Topplista**, matchhistorik, statistik per kategori, lobbychatt, ljudeffekter
  och vibration — allt kan stängas av i inställningarna.

## Utveckling

```bash
cd mattenite
npm install

npm run serve      # http://localhost:8080 — spela i webbläsaren
npm run icons      # generera om appikonen (kräver Pillow)
npm run bundle     # bakar ihop www/ till dist/mattenite.html + dist/mattenite-embed.html
```

Bygga APK lokalt (kräver Java 21 och Android SDK med `platforms;android-34` och
`build-tools;34.0.0`):

```bash
export ANDROID_HOME=~/Android/Sdk
npx cordova platform add android@13.0.0
npx cordova build android                 # dist: platforms/android/app/build/outputs/apk/debug/
npx cordova build android --release       # osignerad release, signera med apksigner
```

### Filer

```
mattenite/
├─ config.xml              Cordova-inställningar, ikoner, splash
├─ www/
│  ├─ index.html           appskalet
│  ├─ css/style.css        teman och layout
│  └─ js/
│     ├─ data.js           frågegenerator, kategorier, prestationer, butik, lobbymallar
│     ├─ state.js          profil, sparning, XP/nivåer, prestationsmotor
│     ├─ ui.js             navigering, vyer, lobbyer, butik, ljud, toasts
│     ├─ game.js           spelmotorn (bomben, botarna, alla lägen)
│     └─ app.js            start, Cordova-koppling, bakåtknapp
├─ res/icon/               appikonen i alla densiteter (legacy + adaptiv)
├─ tools/make-icons.py     ritar ikonen från grunden
├─ tools/bundle.js         enfilsbygge för webb/inbäddning
└─ dist/                   färdig APK och enfilsversioner
```

Motståndarna är botar som simulerar spelare (de tänker olika snabbt, svarar fel
ibland och siktar helst på den som har flest liv). Det finns ingen server och
inget nätverk inblandat — appen behöver ingen internetanslutning.
