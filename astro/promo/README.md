# Astro – reklamfilm

`video/Astro-reklam-1080p.mp4` – 30 s, 1920×1080, 30 fps, H.264 + AAC.

Filmen är renderad direkt ur spelets 3D-motor (inga externa bilder eller ljud):

| Tid | Scen | Text |
|---|---|---|
| 0–3,5 s | Jorden i rymden | Tekniska museet presenterar |
| 3,5–10,5 s | Nedräkning och uppskjutning | Kliv ombord på rymdskeppet |
| 10,5–15 s | Cockpit på väg mot Månen | Flyg till Månen |
| 15–19,5 s | Landat på Månen, jorden över horisonten | Landa och upptäck |
| 19,5–23,5 s | Förbi Saturnus ringar | Lås upp planeterna – ända bort till Pluto |
| 23,5–26,5 s | Warp till Jupiter | I VR, på dator och mobil |
| 26,5–30 s | Slutskylt | ASTRO · Upplev det på Tekniska museet |

## Göra om filmen

```sh
# från repots rot
npx http-server -p 8123 &
cd astro/promo
npm i playwright            # om den inte redan finns
node render-promo.mjs frames 1920 1080        # bildrutor (1080x1920 ger stående format)
python3 soundtrack.py soundtrack.wav          # ljudspår
ffmpeg -framerate 30 -i frames/f%05d.jpg -i soundtrack.wav \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 192k -shortest video/Astro-reklam-1080p.mp4
```

Scenerna och texterna finns i `trailer.js`, musiken i `soundtrack.py`.
