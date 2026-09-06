-- ═══════════════════════════════════════════════════════════════════════════
-- Ökosystem V1 · `device_commands.expires_at` (docs/GERAETE-VERTRAG.md §4,
-- docs/OEKOSYSTEM-V1.md §11 Idee 20)
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent.
-- Setzt 20260903_oekosystem_v1_geraete.sql voraus.
--
-- Der Fund (06.09.2026, `node scripts/naht_check.js`, erster Lauf): der
-- Vertrag verspricht „ein Befehl mit expires_at in der Vergangenheit wird nie
-- gesendet", das Regel-Modul liest `c.expires_at`, der Empfänger selektiert
-- die Spalte — und die Tabelle aus 20260903 hat sie nicht. Drei Stellen
-- nannten eine Spalte, die keine Migration anlegt; keine davon hätte es
-- gemerkt: PostgREST antwortet mit einem Fehler, der Empfänger gibt 500, das
-- Gerät puffert und versucht es beim nächsten Kontakt wieder — für immer.
-- ═══════════════════════════════════════════════════════════════════════════

alter table if exists public.device_commands
  add column if not exists expires_at timestamptz;   -- null = läuft nie ab; der Absender setzt es (Stufe 3)

comment on column public.device_commands.expires_at is
  'Ablauf des Befehls. Abgelaufen wird NIE gesendet, sondern failed (docs/GERAETE-VERTRAG.md §4; ingest_regeln.mjs befehleAufbereiten). null = kein Ablauf.';
