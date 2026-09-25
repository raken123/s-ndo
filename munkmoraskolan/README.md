# Munkmoraskolan · Ansiktsnyckel

Två skärmar i storleken 800 × 480 (samma som Arduino GIGA Display):

| Fil | Tema |
|-----|------|
| `kille.html` | Blå – ”Kille-skanner” |
| `tjej.html` | Rosa/lila – ”Tjej-skanner” |

Öppna filen i en webbläsare på en enhet med kamera och internet (surfplatta, dator, Raspberry Pi).
Sidan startar kameran och laddar ansiktsigenkänningen ([face-api.js](https://github.com/vladmandic/face-api))
automatiskt.

### Lägga in ansikten

1. Tryck **➕ Lägg till ansikte**.
2. Personen ställer sig i ramen, och du trycker på personens namn.
3. Skärmen tar 5 bilder, så vrid huvudet lite mellan bilderna. Namnet får en grön ✓.
4. Tryck **✔ Klar** när alla är inlagda.

Varje person lägger in sitt eget ansikte framför kameran. Det ger mycket bättre igenkänning
än små ansikten från ett klassfoto.
Om ett ansikte redan liknar någon annan som är sparad, sparas det inte.
**🗑 Ta bort** raderar en persons ansikte, till exempel om någon ångrar sig.

### Skanna

Välj plats uppe till höger (**Klassrum 4**, **Klubben**, **Rakens låda**) och titta in i kameran.

- Grönt = upplåst („Välkommen, Raken!”)
- Rött = okänt ansikte, eller personen har inte nyckel till just den platsen

Utan kamera eller internet startar sidan i **demoläge**. Då trycker man på namnen i stället.

### Var sparas ansiktena?

Inga bilder sparas. Varje ansikte blir 128 tal, och de sparas bara i webbläsaren på den
enheten (`localStorage`). Inget laddas upp och inget hamnar i det här repot. Alla som ska vara
med behöver också ett ja från en förälder, och skolan bör veta om det.

## Ändra inställningar

Överst i `<script>` i varje fil:

- `GRUPP` – vilka som hör till skärmen, t.ex. `["Raken", "Loke"]`. Tom lista = hela klassen.
- `PLATSER` – vem som får öppna vad. Lådan är satt till `["Raken"]`.
- `KLASSEN` – alla namn. Mattias och Janet är lärare och får öppna klassrum och klubben.
- `PIN` – en kod som behövs för att lägga till eller ta bort ansikten. **Sätt en kod**, annars kan
  vem som helst spara sitt ansikte under namnet ”Raken”.
- `TROSKEL` – hur lika ansiktena måste vara (lägre = strängare). Standard är 0.5.

## Viktigt om Arduino

GIGA Display Shield kan **inte** köra HTML. Den ritar med LVGL / `Arduino_GigaDisplay_GFX` i C++.
Så du kan antingen:

1. Visa HTML-filen på en surfplatta eller en Raspberry Pi med skärm i helskärmsläge, eller
2. Använda den här designen som mall och bygga om den i LVGL på GIGA:n.

## Bra att veta

Det här är ett skolprojekt och inget riktigt lås. Ansiktsigenkänning kan luras av ett foto
och kan ibland ta fel på syskon. Använd den inte för saker som måste vara säkra.
