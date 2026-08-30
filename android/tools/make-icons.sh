#!/usr/bin/env sh
# Regenerates every launcher icon from art/icon-512.png (or a source you pass in).
set -e
cd "$(dirname "$0")/.."
SRC="${1:-art/icon-512.png}"
OUT=build/icons
mkdir -p "$OUT"
javac -d "$OUT" tools/icons/MakeIcons.java
java -cp "$OUT" MakeIcons "$SRC" app/src/main/res art
