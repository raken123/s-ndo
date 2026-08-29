# Linguey 🦉

En Cordova-app (Android) för att lära sig språk med spelifierade lektioner — och
ett **riktigt 3D-spelarläge** som bonuslektion. Allt körs offline i appen, utan
externa bibliotek eller nätverksanrop.

**Färdig APK:** [`dist/Linguey-1.0.0.apk`](dist/Linguey-1.0.0.apk)

## Funktioner

### Spelifierade lektioner
* 5 språk: spanska, franska, tyska, italienska och japanska (romaji) — 30 lektioner,
  ~240 ordpar och meningar, uppdelade i enheter med en lektionsstig som låses upp
  steg för steg.
* Fem övningstyper: flerval (åt båda riktningarna), skriv översättningen,
  bygg meningen med ordbrickor, matcha par och uppläsning med talsyntes.
* XP, nivåer, ädelstenar, kronor per lektion, kombo-bonus, dagsmål, hjärtan som
  fylls på varje dag (eller köps för ädelstenar) och 10 prestationer.
* Progressen sparas per språk i `localStorage` — inget konto behövs.

### Bonuslektioner: 3D-spelarläge
* Förstapersonsspel i egen WebGL-motor (`www/js/world3d.js`): egen matrismatte,
  shaders, procedurell himmel med stjärnor, dimma, rutmark och dekor.
* Ordet visas på svenska i HUD:en — spring in i porten med rätt översättning.
  8 rätta ord innan tiden tar slut klarar bonuslektionen. Fel port kostar tid.
* Styrning byggd för porträtt: styrkula nere till vänster, svep för att titta
  runt, sprintknapp nere till höger.
* **Bonuslektioner kräver porträttläge.** Orienteringen låses med
  `cordova-plugin-screen-orientation`, och en spärr (`#rotate-gate`) pausar
  spelet och ber dig vända tillbaka om enheten hamnar i liggande läge.

### Svit och sviträddning
* Sviten (streak) ökar en gång per dag du övar.
* Missar du en dag **fryses** sviten i stället för att nollställas. Samma dag kan
  du rädda den genom att klara **3 vanliga lektioner + 1 bonuslektion (3D)** —
  då är du tillbaka där du var, plus dagens dag.
* Räddningen måste ske samma dag. Görs den inte i tid nollställs sviten.
* På profilsidan finns "Simulera missad dag" för att prova flödet direkt.

## Struktur

```
linguey/
├── config.xml               # Cordova-konfiguration, ikoner, orientering
├── www/
│   ├── index.html           # Appskal: alla skärmar + porträttspärren
│   ├── css/style.css
│   └── js/
│       ├── data.js          # Språk, enheter, lektioner, prestationer
│       ├── app.js           # Skärmar, sparning, lektionsspel, svitlogik
│       ├── orientation.js   # Porträttlås + spärr för bonuslektioner
│       └── world3d.js       # WebGL-motorn för 3D-bonusläget
├── res/
│   ├── icon.svg             # Ikonens källa (uggla + jordglob + 3D-bubbla)
│   ├── icon-foreground.svg  # Adaptiv ikon: förgrund
│   ├── icon-background.svg  # Adaptiv ikon: bakgrund
│   └── icon/android/        # Genererade PNG-ikoner per densitet
└── dist/Linguey-1.0.0.apk   # Byggd APK
```

## Bygga själv

Kräver Node 18+, JDK 21 och Android SDK (platform 36, build-tools 36).

```bash
cd linguey
npm install
cordova platform add android
cordova build android --debug
```

APK:n hamnar i `platforms/android/app/build/outputs/apk/debug/`.

Den bifogade APK:n är debug-signerad, alltså avsedd för sidladdning
(tillåt "installera okända appar" på telefonen). För en release-signerad APK:
skapa ett eget nyckelvalv med `keytool`, peka ut det i `build.json` och kör
`cordova build android --release`.

## Ikonen

Ikonen ritas i SVG och rastreras till PNG per densitet (både fyrkantig
reservikon och adaptiva lager för Android 8+). Ugglan är appens maskot, jordgloben
står för språken och pratbubblan med kuben för 3D-bonusläget.
