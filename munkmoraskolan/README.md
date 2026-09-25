# Munkmoraskolan · Ansiktsnyckel

Två skärmar i storleken 800 × 480 (samma som Arduino GIGA Display):

| Fil | Tema |
|-----|------|
| `kille.html` | Blå – ”Kille-skanner” |
| `tjej.html` | Rosa/lila – ”Tjej-skanner” |

Öppna filen i en webbläsare. Välj plats uppe till höger (**Klassrum 4**, **Klubben**, **Rakens låda**)
och tryck på ett namn för att låtsas att den personen står framför kameran.

- Grönt = upplåst („Välkommen, Raken!”)
- Rött = nekad (okänt ansikte, eller personen har inte nyckel till just den platsen)
- **📷 Kamera** visar din webbkamera i ramen (bara bild, inget sparas och ingen igenkänning)

## Ändra inställningar

Överst i `<script>` i varje fil:

- `GRUPP` – vilka som hör till skärmen, t.ex. `["Raken", "Loke"]`. Tom lista = hela klassen.
- `PLATSER` – vem som får öppna vad. Lådan är satt till `["Raken"]`.
- `KLASSEN` – alla namn. Mattias och Janet är lärare och får öppna klassrum och klubben.

## Viktigt om Arduino

GIGA Display Shield kan **inte** köra HTML. Den ritar med LVGL / `Arduino_GigaDisplay_GFX` i C++.
Så du kan antingen:

1. Visa HTML-filen på en surfplatta eller en Raspberry Pi med skärm i helskärmsläge, eller
2. Använda den här designen som mall och bygga om den i LVGL på GIGA:n.

## Om riktig ansiktsigenkänning

Just nu är skanningen en demo. Du trycker på ett namn och ingen kamera känner igen någon.
Ansikten räknas som känsliga personuppgifter enligt GDPR, särskilt för barn. 2019 fick
Skellefteå kommun böter på 200 000 kr för att en skola testade ansiktsigenkänning.
Om du vill bygga en riktig version:

- Lås bara upp **din egen låda** med **ditt eget ansikte**.
- Lägg inte in klasskompisars ansikten (t.ex. från klassfotot) utan att de och deras föräldrar har sagt ja.
- Använd hellre ett RFID-kort eller en PIN-kod för klassrum och klubben.
