-- v29.48b Hygiene (backend-only): redundanten Doppel-Trigger auf marketplace_listings entfernen.
--
-- marketplace_listings hatte ZWEI funktional identische BEFORE-UPDATE-Trigger (beide setzen nur
-- new.updated_at = now()):
--   • mkt_update_ts → fn_mkt_update_ts  (marketplace-spezifisch, nur diese 1 Tabelle)
--   • trg_marketplace_updated_at → fn_touch_updated_at  (generischer Standard, 19 Tabellen)
-- Der marketplace-spezifische Trigger + seine nur-hier-genutzte Funktion werden entfernt.
-- updated_at bleibt durch den Standard-Trigger gesetzt → keine Verhaltensänderung, weniger
-- Arbeit pro UPDATE. Verifiziert: trg_marketplace_updated_at bleibt, fn_mkt_update_ts weg,
-- Advisors weiterhin 0 ERROR (security + performance).

drop trigger if exists mkt_update_ts on public.marketplace_listings;
drop function if exists public.fn_mkt_update_ts();
