# Mattenite 💣

**Svara. Kasta. Överlev.** Ett mattespel för Android (Apache Cordova) i två delar:

- **Minfältet 3D** — förstapersons-3D där du går runt i en arena full av *osynliga*
  bomber. Trampar du på en startar en mattefråga direkt, och klockan tickar.
  Svarar du rätt får du sikta och kasta bomben på någon annan.
- **Arcade Mode** — det klassiska 2D-spelet med lobbies och sex spellägen.
  **Låst från början**: lev sist i fem rundor i Minfältet för att låsa upp det.

Hela spelet körs offline och all data sparas lokalt på enheten.

## Färdig APK

`dist/Mattenite-1.1.0-debug.apk` (3,5 MB, minSdk 24 / Android 7+).

Installera: kopiera filen till telefonen, öppna den och tillåt "installera okända
appar" för din filhanterare. Appen heter **Mattenite** och har den lila
bomb-ikonen.

Varje push till `mattenite/**` bygger dessutom en ny APK via GitHub Actions
(`.github/workflows/mattenite-apk.yml`) som kan laddas ner under Actions →
senaste körningen → Artifacts.

## Minfältet 3D

Egen liten WebGL-motor — inga externa bibliotek, allt ritas från grunden.

1. **Gå runt** med spaken nere till vänster (eller WASD). Dra på höger halva av
   skärmen för att se dig omkring, piltangenter fungerar också.
2. **Minsökaren** uppe till höger slår ut när du är nära en bomb — men den varnar
   sent, så du hinner ofta trampa fel ändå.
3. **Trampar du på en bomb** dyker frågan upp mitt i bilden och bomben hamnar i
   dina händer. Skärmkanten pulserar rött och klockan tickar.
4. **Svara rätt** → sikta med hårkorset (siktet blir rött när någon är i sikte)
   eller tryck på en spelare i listan, och kasta. Svarar du fel brinner två
   sekunder bort och du får en ny fråga.
5. **Smäller bomben i dina händer** förlorar du ett liv av två. Sist kvar vinner
   rundan — och varje vinst är en nyckel till Arcade Mode.

Botarna går runt på egen hand, flyr från den som håller bomben och kastar helst
på den som står närmast.

## Arcade Mode (låses upp)

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
- **112 prestationer** i 14 grupper, inklusive sex hemliga och tolv för Minfältet.
  Varje prestation ger mynt.
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
│     ├─ game.js           arcade-motorn (bomben, botarna, alla lägen)
│     ├─ arena3d.js        3D-motorn: WebGL, arenan, minorna, botarna
│     ├─ arena-ui.js       meny, HUD, minikarta och styrning för 3D-läget
│     └─ app.js            start, Cordova-koppling, bakåtknapp
├─ res/icon/               appikonen i alla densiteter (legacy + adaptiv)
├─ tools/make-icons.py     ritar ikonen från grunden
├─ tools/bundle.js         enfilsbygge för webb/inbäddning
└─ dist/                   färdig APK och enfilsversioner
```

Saknar enheten WebGL kan Minfältet inte köras — då låses Arcade Mode upp direkt
i stället, så spelet alltid går att spela.

Motståndarna är botar som simulerar spelare (de tänker olika snabbt, svarar fel
ibland och siktar helst på den som har flest liv). Det finns ingen server och
inget nätverk inblandat — appen behöver ingen internetanslutning.
