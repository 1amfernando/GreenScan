#!/usr/bin/env bash
# 00-prereq.sh — Voraussetzungs-Check.
# Verifiziert Tools, Login-Status, ENV-Variablen.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "00 · Pre-Flight-Check"
load_env

# Required CLIs
require_cmd git
require_cmd curl
require_cmd jq
require_cmd npx
require_cmd node
ensure_supabase_cli

# Supabase-Login-Status (CLI signalisiert via exit-code)
if ! supabase projects list >/dev/null 2>&1; then
  die "Nicht bei Supabase eingeloggt. Bitte 'supabase login' ausführen."
fi
log_ok "Supabase-Login OK"

# Pflicht-ENV-Variablen
require_env SUPABASE_PROJECT_REF
require_env SUPABASE_SERVICE_ROLE_KEY
require_env ANTHROPIC_API_KEY

# Optionale aber empfohlen
[ -n "${VAPID_PUBLIC_KEY:-}" ] && [ -n "${VAPID_PRIVATE_KEY:-}" ] || \
  log_warn "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY leer — werden in 30-secrets.sh generiert."

[ -n "${STRIPE_SECRET_KEY:-}" ] || \
  log_warn "STRIPE_SECRET_KEY leer — Stripe-Webhook-Auto-Setup wird übersprungen."

# Repo-Stand
cd "$(repo_root)"
local_branch="$(git rev-parse --abbrev-ref HEAD)"
log_info "Branch: $local_branch"
if [ "$local_branch" != "main" ] && [ "${GS_INTERACTIVE:-0}" = "1" ]; then
  log_warn "Du bist nicht auf 'main' — soll wirklich deployed werden?"
  confirm "Trotzdem fortfahren?" || die "Abgebrochen."
fi

log_ok "00-prereq erfolgreich"
