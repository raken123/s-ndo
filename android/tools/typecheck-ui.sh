#!/usr/bin/env sh
# Type-checks the Android side of the app without an Android SDK, using the
# hand-written stubs in tools/androidstubs. The real build uses android.jar;
# this is only a fast local smoke test.
set -e
cd "$(dirname "$0")/.."
OUT=build/typecheck
rm -rf "$OUT"
mkdir -p "$OUT"
find app/src/main/java tools/androidstubs -name '*.java' > "$OUT/sources.txt"
javac -nowarn -d "$OUT" @"$OUT/sources.txt"
echo "ui type-check passed"
