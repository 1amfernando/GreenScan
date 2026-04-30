#!/usr/bin/env bash
# GreenScan Deploy-Utilities — gemeinsame Helpers fuer alle scripts/

# ANSI-Farben (nur wenn TTY)
if [ -t 1 ]; then
  C_RESET='\033[0m'
  C_RED='\033[0;31m'
  C_GREEN='\033[0;32m'
  C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'
  C_CYAN='\033[0;36m'
  C_BOLD='\033[1m'
else
  C_RESET=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_CYAN=''; C_BOLD=''
fi

log_info()  { echo -e "${C_CYAN}ℹ${C_RESET}  $*" >&2; }
log_ok()    { echo -e "${C_GREEN}✅${C_RESET} $*" >&2; }
log_warn()  { echo -e "${C_YELLOW}⚠${C_RESET}  $*" >&2; }
log_err()   { echo -e "${C_RED}❌${C_RESET} $*" >&2; }
log_step()  { echo -e "\n${C_BOLD}${C_BLUE}▶ $*${C_RESET}" >&2; }
log_dry()   { echo -e "${C_YELLOW}🔬 [DRY-RUN]${C_RESET} $*" >&2; }

die() {
  log_err "$*"
  exit 1
}

# Lade .env aus Repo-Root, wenn vorhanden
load_env() {
  local repo_root
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if [ -f "$repo_root/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$repo_root/.env"
    set +a
    log_info ".env aus $repo_root/.env geladen"
  else
    log_warn "Keine .env gefunden — nutze Shell-Environment. Vorlage: .env.example"
  fi
}

# Prüfe ob Befehl verfügbar
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Befehl '$1' nicht gefunden. Bitte installieren."
}

# Prüfe ob ENV-Variable gesetzt
require_env() {
  local name="$1"
  local val="${!name:-}"
  [ -n "$val" ] || die "ENV-Variable $name ist nicht gesetzt (.env oder Shell)."
}

# Run-or-DryRun Wrapper
run() {
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "$*"
  else
    log_info "$ $*"
    eval "$@"
  fi
}

# Run-or-DryRun für Pipes (eval würde Quoting brechen)
run_quiet() {
  if [ "${GS_DRY_RUN:-0}" = "1" ]; then
    log_dry "$*"
    return 0
  fi
  "$@"
}

# Bestätigung wenn interaktiv
confirm() {
  local prompt="${1:-Fortfahren?}"
  if [ "${GS_INTERACTIVE:-0}" != "1" ]; then
    return 0
  fi
  read -r -p "$(echo -e "${C_YELLOW}❓ $prompt [y/N] ${C_RESET}")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# Zentrale Repo-Root-Resolution (von beliebigen Sub-Skript-Pfaden aus)
repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

# Supabase-CLI-Check
ensure_supabase_cli() {
  require_cmd supabase
  local ver
  ver="$(supabase --version 2>/dev/null | head -n1)"
  log_info "Supabase CLI: $ver"
}
