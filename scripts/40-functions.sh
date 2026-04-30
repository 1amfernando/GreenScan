#!/usr/bin/env bash
# 40-functions.sh — Alle 5 Edge Functions deployen.
# Funktionen: ai-proxy, entitlements, push-test, daily-push, stripe-webhook
# Jede mit --no-verify-jwt (sie validieren Auth selbst).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "40 · Edge Functions deployen"
load_env

cd "$(repo_root)"

functions=(
  "ai-proxy"
  "entitlements"
  "push-test"
  "daily-push"
  "stripe-webhook"
)

# Verifiziere alle Sources existieren
for fn in "${functions[@]}"; do
  [ -f "supabase/functions/$fn/index.ts" ] || die "Edge-Fn fehlt: supabase/functions/$fn/index.ts"
done
log_info "${#functions[@]} Edge Functions zum Deploy"

failed=()
for fn in "${functions[@]}"; do
  if run "supabase functions deploy $fn --no-verify-jwt"; then
    log_ok "Deployed: $fn"
  else
    log_err "Failed: $fn"
    failed+=("$fn")
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  die "Folgende Functions sind fehlgeschlagen: ${failed[*]}"
fi

log_ok "Alle 5 Edge Functions deployed"
