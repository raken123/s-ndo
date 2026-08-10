#!/bin/sh
# Cut the iOS notification sound from the bundled adhan.
#
# iOS will only play a notification sound that lives in the app bundle, runs
# under 30 seconds, and is CAF/AIFF/WAV -- MP3 is not accepted. So the first 29
# seconds of the recitation become a linear-PCM CAF; the app itself plays the
# full-length MP3 from www/audio/.
#
# On a Mac, afconvert does the same job:
#   afconvert www/audio/adhan.mp3 -o adhan.caf -d LEI16 -f caff
#
# Usage: tools/make_adhan_caf.sh [path/to/ffmpeg]
set -e

cd "$(dirname "$0")/.."
FFMPEG="${1:-ffmpeg}"
SRC="www/audio/adhan.mp3"
OUT="local-plugins/cordova-plugin-addictstop/src/ios/adhan.caf"

"$FFMPEG" -hide_banner -loglevel error -y \
    -i "$SRC" -t 29 -ac 1 -ar 11025 -c:a pcm_s16le -f caf "$OUT"

echo "wrote $OUT"
