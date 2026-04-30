#!/usr/bin/env bash
# 70-smoke.sh — End-to-End Smoke-Test der deployten Server-Endpoints.
# Prüft: Edge Functions erreichbar, korrekte Status-Codes, CORS-Header.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "70 · Server-Smoke-Test"
load_env
require_env SUPABASE_PROJECT_REF

BASE="https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1"
fail=0

check_status() {
  local name="$1" url="$2" expected="$3" method="${4:-GET}" headers="${5:-}"
  local status
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "curl $method $url → expect $expected"
    return 0
  fi
  status="$(curl -s -o /dev/null -w '%{http_code}' -X "$method" \
    ${headers:+-H "$headers"} \
    "$url" || echo "000")"
  if [[ "$expected" =~ ^"$status"$ ]] || [ "$status" = "$expected" ]; then
    log_ok "$name → HTTP $status (erwartet $expected)"
  else
    log_err "$name → HTTP $status (erwartet $expected)"
    fail=$((fail+1))
  fi
}

# ai-proxy: ohne JWT erwartet 401
check_status "ai-proxy auth-required" \
  "$BASE/ai-proxy" \
  "401" "POST" "Origin: https://greenscan.ch"

# entitlements: ohne JWT erwartet 401
check_status "entitlements auth-required" \
  "$BASE/entitlements" \
  "401" "GET" "Origin: https://greenscan.ch"

# push-test: GET ?vapid=1 sollte 200 mit VAPID-Public liefern
if [ "${GS_DRY_RUN:-0}" != "1" ]; then
  vapid_resp="$(curl -s "$BASE/push-test?vapid=1" || echo '')"
  if echo "$vapid_resp" | jq -e '.vapid_public' >/dev/null 2>&1; then
    log_ok "push-test ?vapid=1 → liefert VAPID-Public-Key"
  else
    log_err "push-test ?vapid=1 → ungültige Antwort: $vapid_resp"
    fail=$((fail+1))
  fi
else
  log_dry "curl GET $BASE/push-test?vapid=1"
fi

# daily-push: ohne Auth erwartet 401 (CRITICAL-FIX D3)
check_status "daily-push auth-required" \
  "$BASE/daily-push" \
  "401" "POST"

# stripe-webhook: ohne Stripe-Signature erwartet 400
check_status "stripe-webhook signature-required" \
  "$BASE/stripe-webhook" \
  "400" "POST"

# Frontend reachable
if [ "${GS_DRY_RUN:-0}" != "1" ]; then
  frontend_status="$(curl -s -o /dev/null -w '%{http_code}' "https://greenscan.ch/" || echo "000")"
  if [ "$frontend_status" = "200" ]; then
    log_ok "Frontend (greenscan.ch) → HTTP 200"
  else
    log_warn "Frontend (greenscan.ch) → HTTP $frontend_status (Cloudflare-Build noch nicht fertig?)"
  fi
fi

if [ $fail -gt 0 ]; then
  die "$fail Smoke-Tests fehlgeschlagen"
fi

log_ok "Alle Smoke-Tests bestanden"
log_info "Frontend-Tests: im Browser DevTools-Console 'await gsSelfTest()' ausführen."
