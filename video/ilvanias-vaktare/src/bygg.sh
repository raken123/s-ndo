#!/usr/bin/env bash
# Bygger filmen från manus.txt hela vägen till ilvanias-vaktare.mp4.
#
# Kräver: python3 med edge-tts, numpy och scipy; node 22; ffmpeg.
# Rösten talas in via Microsofts talsyntes (edge-tts) och kräver nätverk.
set -euo pipefail
cd "$(dirname "$0")"
B=../build
mkdir -p $B/parts

python3 tts.py            # röst, tidslinje och undertext.srt
python3 audio.py          # musik, ljudmiljöer och mix → build/mix.wav
npm install --silent

# bilderna i fyra delar parallellt
DUR=$(python3 -c "import json;print(json.load(open('$B/timeline.json'))['duration'])")
Q=$(python3 -c "print($DUR/4)")
for i in 0 1 2 3; do
  node render.mjs --from "$(python3 -c "print($i*$Q)")" --to "$(python3 -c "print(($i+1)*$Q)")" \
    --out $B/parts/p$i.mp4 --crf 14 --preset veryfast &
done
wait
printf "file 'parts/p%d.mp4'\n" 0 1 2 3 > $B/concat.txt
ffmpeg -v error -y -f concat -safe 0 -i $B/concat.txt -c copy $B/master.mp4

# ljudnivå: mät först, normalisera sedan linjärt till -16 LUFS
M=$(ffmpeg -hide_banner -i $B/mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 \
  | python3 -c "import sys,json,re;d=json.loads(re.search(r'\{[^}]*\}',sys.stdin.read()).group());print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")

# två pass så att filmen hamnar under GitHubs gräns på 100 MB
V="-c:v libx264 -preset slow -tune animation -b:v 680k -maxrate 1600k -bufsize 3200k -pix_fmt yuv420p -g 96 -passlogfile $B/x264log"
ffmpeg -v error -y -i $B/master.mp4 $V -pass 1 -an -f null /dev/null
ffmpeg -v error -y -i $B/master.mp4 -i $B/mix.wav -i ../undertext.srt -map 0:v -map 1:a -map 2:s \
  $V -pass 2 -af "loudnorm=I=-16:TP=-1.5:LRA=11:$M:linear=true" -c:a aac -b:a 112k -ar 48000 \
  -c:s mov_text -metadata:s:s:0 language=swe -metadata:s:a:0 language=swe \
  -metadata title="Ilvanias väktare – Sommarens bästa dag" -movflags +faststart -t "$DUR" ../ilvanias-vaktare.mp4
echo "klart: ../ilvanias-vaktare.mp4"
