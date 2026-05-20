-- v26.7 Trial-End-Reminder
-- Dedup-Index auf push_send_log.dedup_key — verhindert dass
-- daily-push-checker v3 denselben Trial-End-Reminder mehrfach verschickt
-- (Job laeuft 07/19 UTC, ohne Dedup wuerde User 2× pro Tag gepingt werden).

create unique index if not exists idx_push_send_log_dedup
  on push_send_log(dedup_key);
