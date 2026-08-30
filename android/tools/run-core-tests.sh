#!/usr/bin/env sh
# Compiles the Android-free game core together with the head-less harness and
# runs it. Needs nothing but a JDK - no Android SDK, no Gradle, no network.
set -e
cd "$(dirname "$0")/.."
OUT=build/coretests
rm -rf "$OUT"
mkdir -p "$OUT"
find app/src/main/java/com/raken/bfdia5b/core tools/src -name '*.java' > "$OUT/sources.txt"
javac -Xlint:all -d "$OUT" @"$OUT/sources.txt"
java -cp "$OUT" dev.bfdia5b.HeadlessTests app/src/main/assets/levels.txt
