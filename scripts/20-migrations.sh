#!/usr/bin/env bash
# 20-migrations.sh — Alle Migrations ausspielen (additiv, idempotent).
# Pflegt 4 Tabellen:
#   ai_usage, brain_memory, push_subscriptions, stripe_events

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "20 · Migrations ausspielen"
load_env

cd "$(repo_root)"

# Liste der erwarteten Migrations zur Verifikation
expected=(
  "20260429_ai_usage.sql"
  "20260429_brain_memory.sql"
  "20260429_push_subscriptions.sql"
  "20260430_stripe_events.sql"
)
for f in "${expected[@]}"; do
  [ -f "supabase/migrations/$f" ] || die "Erwartete Migration fehlt: supabase/migrations/$f"
done
log_info "${#expected[@]} Migrations gefunden"

run "supabase db push"
log_ok "Migrations gepusht — 4 Tabellen verfügbar"
