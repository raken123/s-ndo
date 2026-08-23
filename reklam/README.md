# Reklamfilmer — Sändo Tavla

Tre storytime-filmer i samma stil och med samma motor — två i klassrummet
och en ute på skolgården.

| Fil | Film | Längd | Storlek |
|---|---|---|---|
| `sando-tavla-reklam.mp4` | **Skriket** — eleven som blir utvisad | 39 s | 4,9 MB |
| `sando-tavla-reklam-1080.mp4` | Skriket, mindre version för mobil och chatt | 39 s | 2,0 MB |
| `sando-tavla-vikarien.mp4` | **Vikarien** — hennes första lektion i 5B | 44 s | 3,0 MB |
| `sando-tavla-vikarien-1080.mp4` | Vikarien, mindre version | 44 s | 1,3 MB |
| `sando-tavla-rasten.mp4` | **Rasten** — rastvakten på skolgården | 42 s | 3,8 MB |
| `sando-tavla-rasten-1080.mp4` | Rasten, mindre version | 42 s | 1,5 MB |

Källor: `reklam.html`, `reklam-vikarien.html`, `reklam-rasten.html` och den
gemensamma motorn `filmkit.js`. Affischbilder: `affisch.png`,
`affisch-vikarien.png`, `affisch-rasten.png`.

## Film 1 — Skriket

| Tid | Scen |
|---|---|
| 0–4 s | Mattelektion. Lugnt, tavlan visar tramsdetektorn på cringe-nivå 12. |
| 4–7 s | En elev reser sig och skriker **"JAG HATAR DIG LÄRARE!!!"**. Bilden skakar. |
| 6–10 s | Cringe-mätaren klättrar till 98, trafikljuset slår om till rött, tavlan larmar: **SUPER CRINGE — utvisad, 5:00**. |
| 10–13 s | Eleven går ut genom dörren. |
| 13–17 s | **INSTALLERA FÖR BRA ELEVER** fyller skärmen, ett finger trycker, installationen går igenom. |
| 17–28 s | Delad bild: han i korridoren med nedräkningen, klassen kör lyckohjul, tärning och poängtavla. |
| 28–33 s | Han kommer in och läraren säger: **"Kom in! Men skrik inte nästa gång — annars kickar smartboarden ut dig igen."** |
| 33–39 s | Slutkort. |

## Film 2 — Vikarien

| Tid | Scen |
|---|---|
| 0–4 s | En vikarie kliver in i 5B med kaffemuggen i handen. Hon har aldrig träffat klassen. |
| 4–9 s | Klassen testar henne: **"Vi brukar ha rast nu!"** Alla ser oskyldiga ut. |
| 9–14 s | Hon trycker på tavlan. Schemat: matematik till 09:00, **23 minuter kvar**. Rasten står svart på vitt. |
| 14–19 s | Ett tryck till, och fyra grupper slumpas fram med namn. Inget tjafs. |
| 19–25 s | Ljudnivån stiger, trafikljuset går till gult — och klassen sänker sig själv. Hon behövde aldrig höja rösten. |
| 25–31 s | En elev frågar **"Vad är fotosyntes?"** Hon vet inte. AI-Läraren svarar ur klassens egen arbetsbok, med sidhänvisning. |
| 31–36 s | Lyckohjulet väljer vem som svarar, timern går, poängen och stjärnorna tickar. |
| 36–43 s | Exit ticket på tavlan när klockan slår 09:00. Ordinarie läraren tittar in: **"Hur gick det?"** — **"Bäst hittills."** |
| 43–44 s | Slutkort. |

## Film 3 — Rasten

Utanför klassrummet, men mitt i skolan. Här är appen på en platta i handen på
rastvakten i stället för på smartboarden.

| Tid | Scen |
|---|---|
| 0–4 s | Klockan ringer, barnen strömmar ut på skolgården. Rasttimern startar på 15:00. |
| 4–9 s | Två elever bråkar om lagen: **"Jag vill inte vara i hans lag!"** |
| 9–14 s | Rastvakten slumpar två lag på plattan. De två hamnar i olika lag, och ingen väljs sist. |
| 14–18 s | **Vem börjar?** Slumpa elev landar på Noah. Avspark. |
| 18–24 s | Matchen rullar, poängen hålls på plattan: 2–1 till Blå. **"MÅÅÅL!"** |
| 24–31 s | En elev sitter ensam på bänken. Rastvakten sätter sig bredvid och visar Dagens fråga: *"Om du fick välja en superkraft — vilken skulle du ta?"* En kompis slår sig ner. |
| 31–36 s | Klockan ringer ut rasten. Plattan visar: **Ställ er i led — 5B, matematik, sal 12.** |
| 36–42 s | Slutkort: *Hela skolan, inte bara klassrummet.* |

## Så är de gjorda

Varje film är en HTML-fil som ritar allt i SVG och animerar med en egen
tidslinje i `render(t)`. Det gemensamma — ritverktyg, figurer, klassrummet,
tavelramen och uppspelningen — ligger i `filmkit.js`, så en ny film bara
behöver sin egen scen och sitt eget manus. Filmerna spelas direkt i en
webbläsare och renderas ruta för ruta med `window.__seek(ms)`.

Tavlan i filmerna visar appens riktiga gränssnitt: cringe-mätaren, schemat,
trafikljuset, gruppindelningen, AI-Läraren med sina PDF:er och exit ticket.

Ljudet är genererat, inte inspelat. Larmet är samma 1480/1180 Hz fyrkantvåg
som appen spelar vid en utvisning, och lektionssignalen är appens egen chime.

### Rendera om

```sh
node tools/render-reklam.js              # rutor för film 1
node tools/render-vikarien.js            # rutor för film 2
node tools/render-rasten.js              # rutor för film 3
python3 tools/reklam-ljud.py             # ljudspår film 1
python3 tools/vikarien-ljud.py           # ljudspår film 2
python3 tools/rasten-ljud.py             # ljudspår film 3

ffmpeg -framerate 30 -i frames/f%05d.png -i ljud.wav \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest reklam/sando-tavla-reklam.mp4
```
