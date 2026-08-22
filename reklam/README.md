# Reklamfilm — Sändo Tavla

| Fil | Vad | Storlek |
|---|---|---|
| `sando-tavla-reklam.mp4` | 39 s, 1920×1080, H.264 + ljud | 4,9 MB |
| `sando-tavla-reklam-1080.mp4` | samma film i 1080 px bredd, för mobil och chatt | 2,0 MB |
| `reklam.html` | källan — filmen ritad i SVG och animerad i webbläsaren | 32 KB |
| `affisch.png` | stillbild ur slutet, att använda som omslag | 0,8 MB |

## Manus

| Tid | Scen |
|---|---|
| 0–4 s | Mattelektion. Lugnt i klassen, tavlan visar tramsdetektorn på cringe-nivå 12. |
| 4–7 s | En elev reser sig och skriker **"JAG HATAR DIG LÄRARE!!!"**. Bilden skakar. |
| 6–10 s | Cringe-mätaren klättrar till 98, trafikljuset slår om till rött, tavlan larmar: **SUPER CRINGE — utvisad från klassrummet, 5:00**. |
| 10–13 s | Eleven går ut genom dörren. |
| 13–17 s | **INSTALLERA FÖR BRA ELEVER** fyller skärmen, ett finger trycker, installationen går igenom. |
| 17–28 s | Delad bild: han sitter i korridoren med nedräkningen, medan klassen kör lyckohjul, tärning, poängtavla och bingo med konfetti i luften. |
| 28–33 s | Nedräkningen tar slut, han kommer in, och läraren säger: **"Kom in! Men skrik inte nästa gång — annars kickar smartboarden ut dig igen."** |
| 33–39 s | Slutkort med logotyp och uppmaningen att installera. |

## Så är den gjord

Hela filmen är en enda HTML-fil. Allt ritas i SVG och animeras av en egen
tidslinje i `render(t)`, så filmen både kan spelas upp direkt i en webbläsare
och renderas ruta för ruta. Ingen extern kod, inga bilder, inga typsnitt att
ladda ner.

Ljudet är genererat, inte inspelat: larmsignalen är samma 1480/1180 Hz
fyrkantvåg som appen själv spelar vid en utvisning, och installationsklicket
och sluttonerna följer appens övriga ljud.

### Rendera om

```sh
# alla rutor
node tools/render-reklam.js
# ljudspåret
python3 tools/reklam-ljud.py
# sätt ihop
ffmpeg -framerate 30 -i frames/f%05d.png -i ljud.wav \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest reklam/sando-tavla-reklam.mp4
```

Öppna `reklam.html` i en webbläsare för att se filmen spela i loop, eller
använd `window.__seek(ms)` för att hoppa till en viss millisekund.
