#!/usr/bin/env bash
# deploy.sh — Master-Deploy. Führt alle 7 Sub-Skripte sequenziell aus.
# Idempotent: kann beliebig oft laufen, ohne Schaden.
#
# Usage:
#   ./scripts/deploy.sh             # Voll-Deploy
#   GS_DRY_RUN=1 ./scripts/deploy.sh # Plan zeigen, nicht ausführen
#   GS_INTERACTIVE=1 ./scripts/deploy.sh # mit Bestätigung pro Schritt

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

START_TS=$(date +%s)

log_step "🚀 GreenScan Master-Deploy startet"
load_env

if [ "${GS_DRY_RUN:-0}" = "1" ]; then
  log_warn "DRY-RUN-MODUS — keine echten Änderungen"
fi

# Reihenfolge:
#   00-prereq    → Tools + Login + ENV-Variablen prüfen
#   10-link      → Supabase verlinken
#   20-migrations → SQL-Migrations ausspielen
#   30-secrets   → Anthropic + VAPID + Stripe-Webhook (falls schon vorhanden)
#   40-functions → 5 Edge Functions deployen
#   60-stripe    → Stripe-Webhook anlegen/aktualisieren (gibt evtl. neues Secret)
#   30-secrets   → falls Stripe-Secret neu, jetzt setzen (re-run mit erweiterter ENV)
#   40-functions → stripe-webhook neu deployen falls neues Secret
#   50-cron      → pg_cron einrichten
#   70-smoke     → End-to-End Smoke-Test

steps=(
  "00-prereq.sh"
  "10-link.sh"
  "20-migrations.sh"
  "30-secrets.sh"
  "40-functions.sh"
  "60-stripe-webhook.sh"
  "50-cron.sh"
  "70-smoke.sh"
)

failed=()
for step in "${steps[@]}"; do
  if [ "${GS_INTERACTIVE:-0}" = "1" ]; then
    confirm "Schritt $step ausführen?" || { log_warn "Schritt $step übersprungen."; continue; }
  fi
  if bash "$SCRIPT_DIR/$step"; then
    :
  else
    log_err "Schritt $step fehlgeschlagen — Abbruch"
    failed+=("$step")
    break
  fi
done

DUR=$(( $(date +%s) - START_TS ))

echo ""
log_step "📊 Deploy-Bilanz"
log_info "Dauer: ${DUR}s"
if [ ${#failed[@]} -eq 0 ]; then
  log_ok "Alle Schritte erfolgreich"
  echo ""
  echo "🎯 Nächste Schritte (manuell):"
  echo "   1. Browser https://greenscan.ch öffnen"
  echo "   2. DevTools-Console: await gsSelfTest()"
  echo "   3. Erwartung: alle 33 Tests ✅"
  echo ""
  echo "📋 Falls iNaturalist genutzt:"
  echo "   - https://www.inaturalist.org/oauth/applications/new"
  echo "   - Redirect-URI: https://greenscan.ch/"
  echo "   - Client-ID in <meta name='gs-inat-client-id'> oder localStorage eintragen"
  echo ""
  echo "📋 Falls App-Store-Wrapper:"
  echo "   - DEPLOY.md §17 lesen"
else
  log_err "Fehlgeschlagene Schritte: ${failed[*]}"
  echo ""
  echo "🔧 Rollback verfügbar:"
  echo "   ./scripts/99-rollback.sh"
  exit 1
fi
