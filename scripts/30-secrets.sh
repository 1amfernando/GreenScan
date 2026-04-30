#!/usr/bin/env bash
# 30-secrets.sh — Secrets in Supabase setzen.
# Generiert VAPID-Keys wenn nicht vorhanden und schreibt sie zurück in .env.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "30 · Supabase Secrets setzen"
load_env
require_env ANTHROPIC_API_KEY

cd "$(repo_root)"

# VAPID-Keys generieren wenn fehlen und in .env zurückschreiben
if [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  log_info "VAPID-Keys fehlen — generiere mit web-push CLI…"
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "npx web-push generate-vapid-keys --json"
    VAPID_PUBLIC_KEY="DRY_PUB"
    VAPID_PRIVATE_KEY="DRY_PRIV"
  else
    vapid_json="$(npx -y web-push generate-vapid-keys --json)"
    VAPID_PUBLIC_KEY="$(echo "$vapid_json" | jq -r '.publicKey')"
    VAPID_PRIVATE_KEY="$(echo "$vapid_json" | jq -r '.privateKey')"
    [ -n "$VAPID_PUBLIC_KEY" ] || die "VAPID-Pub-Key konnte nicht generiert werden"
    log_ok "VAPID-Keys generiert"
    # In .env zurückschreiben (nur wenn vorhanden)
    if [ -f .env ]; then
      # Falls Werte leer sind in .env, ersetze. Sonst append (auskommentiert nicht ueberschreibend).
      if grep -q "^VAPID_PUBLIC_KEY=" .env; then
        sed -i.bak "s|^VAPID_PUBLIC_KEY=.*$|VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY|" .env
        sed -i.bak "s|^VAPID_PRIVATE_KEY=.*$|VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY|" .env
        rm -f .env.bak
        log_info ".env aktualisiert mit VAPID-Keys"
      else
        printf "\nVAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n" "$VAPID_PUBLIC_KEY" "$VAPID_PRIVATE_KEY" >> .env
        log_info ".env ergaenzt um VAPID-Keys"
      fi
    fi
    export VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY
  fi
fi

VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:info@greenscan.ch}"

# Stripe-Webhook-Secret wird ggf. in 60-stripe-webhook.sh erst erzeugt.
# Hier setzen wir nur was sicher vorhanden ist.

# Setzen via Supabase CLI
run "supabase secrets set ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'"
run "supabase secrets set VAPID_PUBLIC_KEY='$VAPID_PUBLIC_KEY'"
run "supabase secrets set VAPID_PRIVATE_KEY='$VAPID_PRIVATE_KEY'"
run "supabase secrets set VAPID_SUBJECT='$VAPID_SUBJECT'"

# STRIPE_WEBHOOK_SECRET nur wenn schon bekannt
if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  run "supabase secrets set STRIPE_WEBHOOK_SECRET='$STRIPE_WEBHOOK_SECRET'"
fi

log_ok "Secrets gesetzt"
log_info "Verifizieren: supabase secrets list"
