# Sändo Elev — webbappen

En studieapp för **en elev och en telefon**. Ingen lärarvy, inga klasslistor,
ingen mikrofon och ingen kamera. Eleven laddar upp sin arbetsbok som PDF, och
Monni hjälper när hen fastnar — utan att säga svaret.

Öppna `index.html` i en mobil webbläsare, eller bygg APK:n i
[`../android-elev`](../android-elev/README.md).

## Filerna

```
index.html          skalet: topbar, vy, tabbar, bottenark, toast
css/app.css         mobil först — en spalt, tumstora träffytor, ljust och mörkt
js/core.js          lagring, krediter, Gemini, vyväxling, UI-hjälpmedel
js/canvas.js        de interaktiva exemplen, och valideringen av dem
js/monni.js         systemprompt, hjälpsteg, svarsvakt och chatten
js/bok.js           arbetsboken: uppladdning, val och varningen om sista sidan
js/sagor.js         sagouppslag — idéer, inte färdig text
js/mer.js           krediter, API-nyckel, canvas-provrum, tema, rensa data
js/main.js          start
```

Ingen byggkedja, inga beroenden. Skripten laddas i ordning och vyerna
registrerar sig själva med `App.registrera(namn, bygg)`.

## De fyra vyerna

| Tabb | Vad den gör |
|---|---|
| 📖 Boken | Ladda upp arbetsboken som PDF, välj vilken som gäller, ta bort |
| 💬 Monni | Chatten. Hjälpsteg, svarsvakt och interaktiva exempel |
| ✏️ Sagor | Välj genre och längd, få uppslag att skriva vidare på |
| ⚙️ Mer | Krediter, API-nyckel, canvas-provrum, tema, rensa data |

## Monni

Regeln — *aldrig svaret* — och hur den hålls på tre ställen står i
[`../MONNI.md`](../MONNI.md). Kort version: systemprompten säger vad Monni gör
i stället, hjälpstegen växer i fyra steg och stannar där, och svarsvakten
läser Monnis text innan eleven ser den.

## Krediter

5 000 000 gratis. En fråga kostar 80, ett svar 300, en uppladdad bok 80.
Saldot syns i topbaren och historiken ligger under ⚙️ Mer.

## Data

Allt sparas i `localStorage` under `sandoelev.` — boken, samtalet, hjälpsteget,
krediterna, nyckeln och temat. Det enda som lämnar telefonen är arbetsboken,
som laddas upp till Google och ligger kvar där i 48 timmar, och frågorna till
Monni.

API-nyckeln ligger avsiktligt **inte** i koden: en nyckel som checkas in i ett
publikt repo blir skannad och missbrukad inom timmar. Den läggs in under
⚙️ Mer och sparas bara på telefonen.

## Mobil, på riktigt

Appen har ingen brytpunkt för dator. På en bred skärm håller den sig i en
telefonbred spalt mitt på sidan i stället för att breda ut sig till något den
inte är. Layouten räknar med `safe-area-inset` upptill och nedtill, alla
träffytor är minst 52 px, och WebView:n är låst till 100 % textzoom så att
systemets textstorlek inte spränger den.

Självtestet kör i 390 × 844 och kontrollerar bland annat att ingen vy spiller
över i sidled.

## Självtest

```sh
NODE_PATH=/opt/node22/lib/node_modules node tools/elev-selftest.js
```

Kör appen i en mobilstor webbläsare med ett stubbat Gemini-API och
kontrollerar:

* att alla metoder koden anropar finns, och att alla fyra vyer monterar
* att startkrediterna är 5 000 000
* **att svarsvakten stoppar sju levererade svar och släpper igenom sex
  förklaringar** — båda tabellerna måste gå
* att tjatdetektorn känner igen sex sätt att be om facit utan att fastna på
  vanliga frågor
* att alla sex canvastyper ritar, att skräpspecar nekas och att gränsvärden
  klipps i stället för att krascha
* att en uppladdning fungerar och att boken följer med i frågan
* att en Monni-runda där modellen försöker leverera svaret ändå fastnar i
  vakten, och att talet inte når eleven
* att hjälpen inte går förbi steg 4 och att tjat inte flyttar fram stegen
* att sagornas "första mening" är en mening
* att ingen vy spiller över i sidled på 390 px
