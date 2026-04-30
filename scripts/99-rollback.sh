#!/usr/bin/env bash
# 99-rollback.sh — Notfall-Rollback.
# Stoppt Cron, deaktiviert Stripe-Webhook, optional Edge Functions löschen.
# Datenbank-Tabellen (Migrations) werden NICHT angetastet.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "99 · ROLLBACK"
load_env

if [ "${GS_INTERACTIVE:-0}" = "1" ]; then
  log_warn "ROLLBACK setzt:"
  log_warn "  - cron.unschedule('greenscan-daily-push')"
  log_warn "  - Stripe-Webhook 'disabled' (NICHT gelöscht — manueller Cleanup im Dashboard)"
  log_warn "  - Edge Functions BLEIBEN (sonst muss neu deployed werden)"
  confirm "Wirklich rollback?" || die "Abgebrochen."
fi

cd "$(repo_root)"

# 1) Cron stoppen
log_info "Stoppe Cron-Job…"
sql='do $$ begin perform cron.unschedule(''greenscan-daily-push''); exception when others then null; end $$;'
if [ "${GS_DRY_RUN:-0}" = "1" ]; then
  log_dry "supabase db query: $sql"
else
  echo "$sql" | supabase db query --linked || log_warn "Cron-unschedule fehlgeschlagen (vielleicht schon weg)"
fi

# 2) Stripe-Webhook deaktivieren (nicht löschen)
if [ -n "${STRIPE_SECRET_KEY:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  ENDPOINT="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
  webhook_id="$(curl -s -u "${STRIPE_SECRET_KEY}:" \
    "https://api.stripe.com/v1/webhook_endpoints?limit=100" | \
    jq -r --arg url "$ENDPOINT" '.data[] | select(.url == $url) | .id' | head -n1 || echo '')"
  if [ -n "$webhook_id" ]; then
    if [ "${GS_DRY_RUN:-0}" = "1" ]; then
      log_dry "POST /v1/webhook_endpoints/$webhook_id disabled=true"
    else
      curl -s -u "${STRIPE_SECRET_KEY}:" \
        -X POST "https://api.stripe.com/v1/webhook_endpoints/$webhook_id" \
        -d "disabled=true" >/dev/null
      log_ok "Stripe-Webhook deaktiviert: $webhook_id"
    fi
  fi
fi

log_warn "Edge Functions BLEIBEN deployed (Rollback würde sie sonst dauerhaft löschen)."
log_warn "Falls du sie wirklich löschen willst:"
echo "  supabase functions delete ai-proxy entitlements push-test daily-push stripe-webhook"
log_warn "Datenbank-Tabellen bleiben (kein Datenverlust)."
log_warn "Frontend zurück: git revert <commit> && git push origin main"

log_ok "Rollback durch — manuelle Final-Checks nötig"
