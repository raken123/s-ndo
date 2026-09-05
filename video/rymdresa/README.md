# Rymdresa — en natt bland stjärnorna

En kort 3D-film (2 min 56 s) om Elias, som flyger till rymden en kväll och
lever på en rymdstation hela natten tills solen går upp igen över jordkanten.

Allt i filmen är byggt i kod: jorden, molnen, stadsljusen, raketen, stationen
och astronauten är procedurella Three.js-objekt, och musiken syntetiseras i
WebAudio. Inga bilder, modeller eller ljudfiler laddas in.

| Fil | Vad |
|---|---|
| `rymdresa.mp4` | Den färdiga filmen: 2:56, 1920x1080, 24 fps, H.264 (CRF 19) + AAC 192 kb/s, 39,7 MB. SHA-256 `d9ca834022e69874836c05d3904f4e95431a24811d4e3336665f9ce13454b730` |
| `rymdresa.html` | Samma film som körs live i webbläsaren, med ljud. Öppna filen och klicka *Starta filmen*. Mellanslag pausar. |
| `three.min.js` | Three.js r152, så att HTML-filen fungerar utan nätverk. Saknas den hämtas samma version från jsDelivr. |
| `src/render.mjs` | Renderaren som gjorde MP4-filen |

## Handlingen

| Tid | Scen |
|---|---|
| 0:00 | Titel över stugan och raketen i kvällsljus |
| 0:09 | Elias går från stugan till raketen. Solen går ner. |
| 0:25 | Nedräkning, tändning, start |
| 0:38 | Raketen stiger, himlen blir svart och stjärnorna tänds |
| 0:48 | Omloppsbana. Jorden kröker sig nedanför; stationen väntar |
| 1:16 | Dockning. Elias flyter ut genom luckan medan solen går ner över havet |
| 1:36 | Inne på stationen: städerna glöder under kupolfönstret |
| 1:52 | Middag i tyngdlöshet |
| 2:06 | Han sover i sovsäcken på väggen. Hela natten. |
| 2:22 | Soluppgång i omloppsbana |
| 2:44 | »Han levde där hela natten.« Slut. |

## Så renderades filmen

`rymdresa.html?render=1` stänger av realtidsuppspelningen och exponerar en
funktion som ritar filmen vid en given tidpunkt. `src/render.mjs` öppnar
sidan i headless Chromium (Playwright, WebGL via SwiftShader), tar en
skärmdump per bildruta och matar dem till ffmpeg. Musiken renderas separat i
en `OfflineAudioContext` och muxas in som AAC.

```sh
# kräver node 22, playwright (med chromium) och ffmpeg med libx264
FFMPEG=/path/to/ffmpeg PLAYWRIGHT_PATH=/path/to/playwright/index.mjs \
  node src/render.mjs --w 1920 --h 1080 --fps 24 --out rymdresa.mp4

# stillbilder för granskning
node src/render.mjs --w 1280 --h 720 --stills "3,30,80,118,158" --dir stills/
```

Renderingen är deterministisk: alla slumptal kommer från seedade generatorer,
så samma bildruta ser likadan ut varje gång.
