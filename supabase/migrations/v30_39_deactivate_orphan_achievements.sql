-- Audit-Welle 3 #2 (Teil b): book_uploaded + pollinator_plant_count deaktivieren (keine echten User-Features)
-- → v_active_total in fn_achievements_bump sinkt → Capstone master_gardener wieder erreichbar.
-- Angewendet 2026-06-25 via MCP. Die übrigen 8 Waisen-Metriken werden im Frontend (v30.39) verdrahtet.
update public.achievements_catalog set is_active = false
where slug in ('book_uploader','bee_friendly_5') and is_active = true;
