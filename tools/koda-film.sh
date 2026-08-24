#!/bin/bash
# Renderar, ljudsätter och kodar en reklamfilm till MP4.
#   tools/koda-film.sh <namn> <arbetskatalog>
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
ut="$rot/reklam/sando-tavla-$namn"

"$ff" -y -loglevel error -framerate 30 -i "$frames/f%05d.png" -i "$ljud" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 160k -shortest "$ut.mp4"
"$ff" -y -loglevel error -i "$ut.mp4" -vf scale=1080:-2 \
  -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart \
  -c:a copy "$ut-1080.mp4"
cp "$frames/$(ls "$frames" | sed -n '90p')" "$rot/reklam/affisch-$namn.png"

rm -rf "$frames" "$ljud"
ls -lh "$ut.mp4" "$ut-1080.mp4" "$rot/reklam/affisch-$namn.png" | awk '{print $5, $9}'
