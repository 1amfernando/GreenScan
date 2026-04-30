#!/usr/bin/env bash
# 10-link.sh — Supabase-Projekt verlinken (idempotent).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "10 · Supabase-Projekt verlinken"
load_env
require_env SUPABASE_PROJECT_REF

cd "$(repo_root)"

# Wenn schon verlinkt, supabase/config.toml hat project_id-Eintrag
if [ -f supabase/.temp/project-ref ] && [ "$(cat supabase/.temp/project-ref 2>/dev/null)" = "$SUPABASE_PROJECT_REF" ]; then
  log_ok "Bereits verlinkt mit $SUPABASE_PROJECT_REF"
  exit 0
fi

run "supabase link --project-ref $SUPABASE_PROJECT_REF"
log_ok "Verlinkt mit Project-Ref $SUPABASE_PROJECT_REF"
