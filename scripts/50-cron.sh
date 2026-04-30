#!/usr/bin/env bash
# 50-cron.sh — pg_cron einrichten via direktem psql/SQL.
# Speichert SERVICE_ROLE_KEY in vault.secrets und legt stündlichen
# Trigger für daily-push an. Idempotent (cron.unschedule + cron.schedule).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/utils.sh
source "$SCRIPT_DIR/lib/utils.sh"

log_step "50 · pg_cron einrichten"
load_env
require_env SUPABASE_PROJECT_REF
require_env SUPABASE_SERVICE_ROLE_KEY

cd "$(repo_root)"

PROJECT_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
DAILY_URL="${PROJECT_URL}/functions/v1/daily-push"

# SQL als HEREDOC zusammenbauen
sql=$(cat <<EOF
create extension if not exists pg_cron;
create extension if not exists http;

-- Service-Role-Key in vault speichern (idempotent)
insert into vault.secrets (name, secret)
values ('service_role_key', '${SUPABASE_SERVICE_ROLE_KEY}')
on conflict (name) do update set secret = excluded.secret;

-- Bestehenden Job entfernen (idempotent)
do \$\$
begin
  perform cron.unschedule('greenscan-daily-push');
exception when others then
  null; -- Job existierte nicht
end \$\$;

-- Stündlicher Push-Trigger
select cron.schedule(
  'greenscan-daily-push',
  '0 * * * *',
  \$cron\$
    select net.http_post(
      url := '${DAILY_URL}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key')
      ),
      body := '{}'
    );
  \$cron\$
);

select jobname, schedule, active from cron.job where jobname = 'greenscan-daily-push';
EOF
)

# Via supabase CLI direkt ausführen
if [ "${GS_DRY_RUN:-0}" = "1" ]; then
  log_dry "supabase db query <<< (cron-SQL)"
  log_info "SQL preview:"
  echo "$sql" | head -20
else
  echo "$sql" | supabase db query --linked
  log_ok "pg_cron konfiguriert (greenscan-daily-push, stündlich)"
fi
