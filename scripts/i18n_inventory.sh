#!/usr/bin/env bash
# v26.8 (v26.14-Commit) — i18n Pass-3 Inventory
#
# Extrahiert ALLE Translation-Keys aus index.html (data-i18n + gsI18n.t-
# Calls + GS_I18N_JS_STRINGS Map) in eine sortierte Unique-Liste.
#
# Output: /tmp/all_i18n_keys.txt  (sortiert, unique)
#         /tmp/i18n_inventory.log (Zaehl-Stats)
#
# Usage:  bash scripts/i18n_inventory.sh
#
# Pipeline:
#   1. data-i18n="..." aus HTML
#   2. gsI18n.t('key', ...) aus JS
#   3. GS_I18N_JS_STRINGS-Map keys ('key_name': '...')

set -euo pipefail

SRC="${1:-index.html}"
OUT="/tmp/all_i18n_keys.txt"
LOG="/tmp/i18n_inventory.log"

if [ ! -f "$SRC" ]; then
  echo "❌ $SRC nicht gefunden" >&2
  exit 1
fi

{
  # 1) data-i18n="key_name"
  grep -oE 'data-i18n="[^"]+"' "$SRC" | sed -E 's/data-i18n="([^"]+)"/\1/'

  # 2) gsI18n.t('key', 'fallback') OR gsI18n.t("key", "fallback")
  grep -oE "gsI18n\.t\(['\"][^'\"]+['\"]" "$SRC" \
    | sed -E "s/gsI18n\.t\(['\"]([^'\"]+)['\"]/\1/"

  # 3) GS_I18N_JS_STRINGS-Map keys: 'key_name': 'value'
  # Filter limitiert auf den Block zwischen "window.GS_I18N_JS_STRINGS = {" und "};"
  awk '
    /window\.GS_I18N_JS_STRINGS\s*=\s*\{/ { in_map=1; next }
    in_map && /^\};?/                       { in_map=0 }
    in_map && match($0, /'\''[a-z_][a-z0-9_]*'\''[ \t]*:/) {
      m = substr($0, RSTART+1, RLENGTH-3)
      print m
    }
  ' "$SRC"
} | sort -u > "$OUT"

N_TOTAL=$(wc -l < "$OUT" | tr -d ' ')
N_HTML=$(grep -oE 'data-i18n="[^"]+"' "$SRC" | sort -u | wc -l | tr -d ' ')
N_JS_T=$(grep -oE "gsI18n\.t\(['\"][^'\"]+['\"]" "$SRC" | sort -u | wc -l | tr -d ' ')

{
  echo "i18n inventory · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Source: $SRC"
  echo "----"
  echo "data-i18n unique:    $N_HTML"
  echo "gsI18n.t unique:     $N_JS_T"
  echo "all unique (union):  $N_TOTAL"
  echo "----"
  echo "Output: $OUT"
} | tee "$LOG"
