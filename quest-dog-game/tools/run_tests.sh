#!/usr/bin/env bash
#
# Run the headless self-test and report a trustworthy exit code.
#
# The OpenXR vendors GDExtension aborts while the engine tears down its
# singletons, which clobbers Godot's own exit status long after the test has
# finished. So the verdict comes from the summary line the test prints.
#
#   GODOT=/path/to/godot tools/run_tests.sh
#
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
GODOT="${GODOT:-godot}"
LOG="$(mktemp)"

"$GODOT" --headless --path . tools/smoke_test.tscn > "$LOG" 2>&1

grep -E "^(===|  (ok|FAIL)|\[|       )" "$LOG" || true

SUMMARY="$(grep -oE "=== [0-9]+ checks, [0-9]+ failed ===" "$LOG" | tail -1)"
if [[ -z "$SUMMARY" ]]; then
  echo "!! The test never reached its summary - full log:" >&2
  cat "$LOG" >&2
  rm -f "$LOG"
  exit 1
fi
rm -f "$LOG"

if [[ "$SUMMARY" == *", 0 failed ==="* ]]; then
  exit 0
fi
exit 1
