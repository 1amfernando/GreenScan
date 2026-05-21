#!/usr/bin/env bash
# v26.8 (v26.14-Commit) — i18n Pass-3 Bulk-Translate
#
# Ruft die Supabase Edge-Fn i18n-translate fuer fehlende FR/IT-Keys auf.
# Erfordert SERVICE_ROLE_KEY in Env (oder als .env-File). Chunks von max
# 10 Keys, 8s Pause zwischen Batches gegen Anthropic Rate-Limit.
#
# Voraussetzung:
#   - scripts/i18n_inventory.sh wurde gelaufen → /tmp/all_i18n_keys.txt
#   - /tmp/fr_missing.txt + /tmp/it_missing.txt aus DB-Diff (siehe README)
#   - $SUPABASE_SERVICE_ROLE_KEY in Env
#
# Usage:
#   export SUPABASE_SERVICE_ROLE_KEY="ey..."
#   bash scripts/i18n_translate.sh fr   # nur FR
#   bash scripts/i18n_translate.sh it   # nur IT
#   bash scripts/i18n_translate.sh all  # FR + IT
#
# Cowork-Workflow-Hinweis: Die SQL-Diffs gegen i18n_translations
# (welche Keys fehlen pro Lang) idealerweise direkt via Supabase MCP
# query laufen lassen — dann ist die Pipeline:
#   1. Cowork: SELECT-Diff → /tmp/fr_missing.txt + /tmp/it_missing.txt
#   2. Code: bash scripts/i18n_translate.sh all
#   3. Cowork: SELECT lang, COUNT(*) FROM i18n_translations → Verify

set -euo pipefail

LANG_ARG="${1:-all}"
SB_URL="${SB_URL:-https://vowbiueikwrauuceilhc.supabase.co}"
ENDPOINT="$SB_URL/functions/v1/i18n-translate"
CHUNK_SIZE="${CHUNK_SIZE:-10}"
SLEEP_SEC="${SLEEP_SEC:-8}"

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY nicht in Env gesetzt" >&2
  exit 1
fi

translate_lang() {
  local target="$1"
  local infile="/tmp/${target}_missing.txt"
  local logfile="/tmp/${target}_translate_log.json"

  if [ ! -f "$infile" ]; then
    echo "⚠️  $infile nicht gefunden — bitte erst DB-Diff laufen lassen" >&2
    return 1
  fi

  local total
  total=$(wc -l < "$infile" | tr -d ' ')
  echo "═══ Translate $target ($total keys, chunk=$CHUNK_SIZE, sleep=${SLEEP_SEC}s) ═══"

  : > "$logfile"
  local -a chunk=()
  local processed=0

  while IFS= read -r key; do
    [ -z "$key" ] && continue
    chunk+=("$key")
    if [ "${#chunk[@]}" -ge "$CHUNK_SIZE" ]; then
      _send_chunk "$target" "$logfile" "${chunk[@]}"
      processed=$((processed + ${#chunk[@]}))
      echo "  → $processed / $total"
      chunk=()
      sleep "$SLEEP_SEC"
    fi
  done < "$infile"

  # Letztes Rest-Chunk
  if [ "${#chunk[@]}" -gt 0 ]; then
    _send_chunk "$target" "$logfile" "${chunk[@]}"
    processed=$((processed + ${#chunk[@]}))
    echo "  → $processed / $total"
  fi

  echo "✅ $target done · Log: $logfile"
}

_send_chunk() {
  local target="$1"; shift
  local logfile="$1"; shift
  local keys_json
  keys_json=$(printf '%s\n' "$@" | jq -R . | jq -s .)
  local body
  body=$(jq -n --arg t "$target" --argjson k "$keys_json" \
    '{target_lang:$t, keys:$k, source_lang:"de"}')

  local resp
  resp=$(curl -sS --max-time 120 -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -d "$body")
  echo "$resp" >> "$logfile"
  echo >> "$logfile"
}

case "$LANG_ARG" in
  fr) translate_lang fr ;;
  it) translate_lang it ;;
  all) translate_lang fr; translate_lang it ;;
  *) echo "Usage: $0 [fr|it|all]" >&2; exit 1 ;;
esac

echo "═══ Verify suggested:"
echo "  SELECT lang, COUNT(*) FROM i18n_translations GROUP BY lang ORDER BY lang;"
