#!/bin/bash
# Renderar, ljudsätter och kodar en reklamfilm till MP4.
#   tools/koda-film.sh <namn> <arbetskatalog> [affischsekund]
# Ger reklam/sando-tavla-<namn>.mp4 (1920), -1080.mp4 och reklam/affisch-<namn>.png.
# Rutorna tas bort efteråt — de är ~150 MB per film.
set -euo pipefail
namn="$1"
arb="${2:-/tmp/film}"
rot="$(cd "$(dirname "$0")/.." && pwd)"
ff="$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"
export NODE_PATH=/opt/node22/lib/node_modules

mkdir -p "$arb"
node "$rot/tools/render-film.js" "$namn" "$arb"
python3 "$rot/tools/film-ljud.py" "$arb" "$namn"

frames="$arb/frames-$namn"
ljud="$arb/ljud-$namn.wav"
# Filmerna om Sändo Tavla och den om Sändo Elev är olika produkter och ska
# inte heta samma sak.
case "$namn" in
  elev) ut="$rot/reklam/sando-elev-laxan" ;;
  *)    ut="$rot/reklam/sando-tavla-$namn" ;;
esac

"$ff" -y -loglevel error -framerate 30 -i "$frames/f%05d.png" -i "$ljud" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -shortest "$ut.mp4"
"$ff" -y -loglevel error -i "$ut.mp4" -vf scale=1080:-2 \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart \
  -c:a copy "$ut-1080.mp4"
# Affischen tas ur den färdiga filmen, inte ur ruta 90: en film kan mycket väl
# ha en mörk skärm i början och sin bästa bild långt senare. Tredje argumentet
# är sekunden att plocka den ur (3 s om inget anges).
"$ff" -y -loglevel error -ss "${3:-3}" -i "$ut.mp4" -frames:v 1 "$rot/reklam/affisch-$namn.png"

rm -rf "$frames" "$ljud"
ls -lh "$ut.mp4" "$ut-1080.mp4" "$rot/reklam/affisch-$namn.png" | awk '{print $5, $9}'
