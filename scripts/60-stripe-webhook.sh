#!/usr/bin/env bash
# 60-stripe-webhook.sh — Stripe-Webhook-Endpoint via Stripe-API automatisch
# anlegen oder aktualisieren. Speichert das Signing-Secret in
# Supabase + .env.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "60 · Stripe-Webhook konfigurieren"
load_env

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  log_warn "STRIPE_SECRET_KEY leer — überspringe Stripe-Webhook-Setup."
  log_warn "Du musst den Webhook manuell anlegen, siehe DEPLOY.md §11.5."
  exit 0
fi

require_env SUPABASE_PROJECT_REF

ENDPOINT="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
EVENTS=(
  "checkout.session.completed"
  "customer.subscription.created"
  "customer.subscription.updated"
  "customer.subscription.deleted"
  "invoice.paid"
  "invoice.payment_failed"
)

# Existierenden Webhook für unsere URL suchen
log_info "Prüfe ob Webhook für $ENDPOINT bereits existiert…"
existing="$(curl -s -u "${STRIPE_SECRET_KEY}:" \
  "https://api.stripe.com/v1/webhook_endpoints?limit=100" | \
  jq -r --arg url "$ENDPOINT" '.data[] | select(.url == $url) | .id' | head -n1)"

if [ -n "$existing" ]; then
  log_info "Webhook existiert bereits: $existing — wird aktualisiert."
  webhook_id="$existing"
  enabled_events_args=()
  for ev in "${EVENTS[@]}"; do
    enabled_events_args+=(-d "enabled_events[]=$ev")
  done
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "POST /v1/webhook_endpoints/$webhook_id mit ${#EVENTS[@]} Events"
  else
    curl -s -u "${STRIPE_SECRET_KEY}:" \
      -X POST "https://api.stripe.com/v1/webhook_endpoints/$webhook_id" \
      "${enabled_events_args[@]}" >/dev/null
    log_ok "Webhook aktualisiert"
  fi
  # Stripe gibt Secret nur beim ERSTEN Create zurück. Wenn schon existiert,
  # müssen wir das Secret aus der .env nehmen oder neu rotieren.
  if [ -z "${STRIPE_WEBHOOK_SECRET:-}" ]; then
    log_warn "STRIPE_WEBHOOK_SECRET in .env leer."
    log_warn "Webhook existiert, aber Secret ist nur beim Create einsehbar."
    log_warn "Optionen:"
    log_warn "  a) Webhook im Stripe-Dashboard löschen und Skript neu laufen lassen"
    log_warn "  b) Secret manuell aus dem Dashboard kopieren und in .env eintragen"
  fi
else
  log_info "Erstelle neuen Webhook…"
  enabled_events_args=()
  for ev in "${EVENTS[@]}"; do
    enabled_events_args+=(-d "enabled_events[]=$ev")
  done
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "POST /v1/webhook_endpoints url=$ENDPOINT mit ${#EVENTS[@]} Events"
    STRIPE_WEBHOOK_SECRET="whsec_DRYRUN"
  else
    response="$(curl -s -u "${STRIPE_SECRET_KEY}:" \
      -X POST "https://api.stripe.com/v1/webhook_endpoints" \
      -d "url=$ENDPOINT" \
      "${enabled_events_args[@]}")"
    webhook_id="$(echo "$response" | jq -r '.id // empty')"
    STRIPE_WEBHOOK_SECRET="$(echo "$response" | jq -r '.secret // empty')"
    if [ -z "$webhook_id" ] || [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
      log_err "Stripe-API-Fehler:"
      echo "$response" | jq . >&2 || echo "$response" >&2
      die "Webhook-Erstellung fehlgeschlagen"
    fi
    log_ok "Webhook erstellt: $webhook_id"
    # In .env speichern
    if [ -f .env ]; then
      if grep -q "^STRIPE_WEBHOOK_SECRET=" .env; then
        sed -i.bak "s|^STRIPE_WEBHOOK_SECRET=.*$|STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET|" .env
        rm -f .env.bak
      else
        printf "\nSTRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_WEBHOOK_SECRET" >> .env
      fi
      log_info ".env aktualisiert"
    fi
  fi
fi

# Secret in Supabase setzen
if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  run "supabase secrets set STRIPE_WEBHOOK_SECRET='$STRIPE_WEBHOOK_SECRET'"
  # stripe-webhook Edge Fn neu deployen, damit das Secret greift
  run "supabase functions deploy stripe-webhook --no-verify-jwt"
  log_ok "stripe-webhook Edge Fn mit aktuellem Secret neu deployed"
fi

log_ok "Stripe-Webhook fertig"
