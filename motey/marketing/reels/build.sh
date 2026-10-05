#!/bin/sh
# Bygger Motey-Pro-Reels.mp4 (1080x1920, 30 fps, H.264/AAC) – kräver node+playwright, python3, ffmpeg.
set -e
cd "$(dirname "$0")"
W=$(mktemp -d)
node render.js "$W/frames"
python3 audio.py "$W/music.wav"
ffmpeg -y -framerate 30 -i "$W/frames/f%04d.jpg" -i "$W/music.wav" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 160k -ar 44100 -shortest -movflags +faststart ../Motey-Pro-Reels.mp4
rm -rf "$W"
