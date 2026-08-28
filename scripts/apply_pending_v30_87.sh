#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# GreenScan — Ausstehende Backend-Arbeiten anwenden (Stand v30.87)
# ═══════════════════════════════════════════════════════════════════════
#
# WARUM DIESES SKRIPT?
# Die Claude-Cloud-Session darf keine Schreibzugriffe auf Supabase ausführen
# (Werkzeug-Berechtigung, nicht Code-Problem). Alles ist fertig vorbereitet
# und geprüft — dieses Skript führt es aus.
#
# VORAUSSETZUNGEN
#   1. Supabase CLI:  https://supabase.com/docs/guides/cli
#   2. supabase login
#   3. supabase link --project-ref vowbiueikwrauuceilhc
#
# AUSFÜHREN (aus dem Repo-Wurzelverzeichnis):
#   bash scripts/apply_pending_v30_87.sh
#
# Das Skript ist IDEMPOTENT: Ein zweiter Lauf ändert nichts mehr.
# Es bricht bei jedem Fehler ab (set -e), damit nichts halb angewendet wird.

set -euo pipefail

PROJECT_REF="vowbiueikwrauuceilhc"
cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════════════"
echo " GreenScan — ausstehende Backend-Arbeiten"
echo " Projekt: $PROJECT_REF"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Vorabprüfung ───────────────────────────────────────────────────────
command -v supabase >/dev/null 2>&1 || {
  echo "FEHLER: Supabase CLI nicht gefunden."
  echo "        → https://supabase.com/docs/guides/cli"
  exit 1
}
echo "✓ Supabase CLI gefunden: $(supabase --version 2>/dev/null | head -1)"
echo ""

read -r -p "Fortfahren und auf die PRODUKTIV-Datenbank anwenden? [j/N] " ok
case "$ok" in j|J|y|Y) ;; *) echo "Abgebrochen."; exit 0 ;; esac
echo ""

# ── 1 · MIGRATIONEN ────────────────────────────────────────────────────
# ACHTUNG, bewusst NICHT `supabase db push`:
# Das Migrations-Register dieser DB nutzt 14-stellige Zeitstempel
# (z.B. 20260827073101), die Dateinamen im Repo weichen davon ab
# (v30_32_*.sql, 20260827_*.sql). `db push` würde die lokalen Dateien für
# "noch nicht angewendet" halten und Dutzende bereits laufender Migrationen
# erneut anstossen. Deshalb: NUR die zwei neuen Dateien gezielt einspielen.
#
# Beide sind additiv und idempotent (ON CONFLICT / NOT EXISTS):
#   20260827_wissen_ausbau_v30_84.sql
#     +34 Bauernregeln (Schwerpunkt Nov–Feb; Jan/Dez hatten nur je 11 →
#     die "Bauernregel des Tages" wiederholte sich im Winter alle ~11 Tage)
#     +40 "Wusstest du?"-Fakten · Kategorie-Normalisierung DE/EN
#     · Emoji-Auffüllung (nur 20 von 161 Techniken hatten eines)
#   20260827_quiz_bilder_und_fragen_v30_85.sql
#     Bild-Spalten + erweiterte fn_get_daily_quiz + 43 Fragen (12 mit Foto)
echo "── 1/3 · Migrationen anwenden ─────────────────────────────"

M1="supabase/migrations/20260827_wissen_ausbau_v30_84.sql"
M2="supabase/migrations/20260827_quiz_bilder_und_fragen_v30_85.sql"

if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  echo "   Wende via psql an (SUPABASE_DB_URL gesetzt)…"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M1"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M2"
  echo "✓ Beide Migrationen angewendet"
else
  cat <<'MANUELL'
   ⚠️  Kein psql / kein SUPABASE_DB_URL — bitte MANUELL einspielen:

   Variante A (empfohlen, kein Werkzeug nötig):
     Supabase Dashboard → SQL Editor → Inhalt dieser zwei Dateien
     nacheinander einfügen und ausführen:
       supabase/migrations/20260827_wissen_ausbau_v30_84.sql
       supabase/migrations/20260827_quiz_bilder_und_fragen_v30_85.sql

   Variante B (psql):
     export SUPABASE_DB_URL='postgresql://postgres:<PASS>@db.vowbiueikwrauuceilhc.supabase.co:5432/postgres'
     dann dieses Skript erneut ausführen.

   Beide Dateien sind idempotent — ein zweiter Lauf schadet nicht.
MANUELL
  read -r -p "   Migrationen manuell erledigt? Mit Edge-Functions fortfahren? [j/N] " m
  case "$m" in j|J|y|Y) ;; *) echo "Abgebrochen."; exit 0 ;; esac
fi
echo ""

# ── 2 · EDGE-FUNCTIONS (KI-Kostenschutz) ───────────────────────────────
# Beide hatten KEINE In-Code-Auth und KEIN Limit — geschützt nur durch das
# Gateway-Flag. Jetzt: User serverseitig verifiziert + 30 Scans/Stunde/User
# (fail-open, damit der sicherheitskritische Pilz-Scanner nie an einem
# Limit-Fehler scheitert).
echo "── 2/3 · Vision-Funktionen deployen (Kostenschutz) ────────"
supabase functions deploy mushroom-identify --project-ref "$PROJECT_REF"
supabase functions deploy pest-identify     --project-ref "$PROJECT_REF"
echo "✓ mushroom-identify + pest-identify deployed"
echo ""

# ── 3 · SEND-PUSH (Audit P0-3, Sicherheit) ─────────────────────────────
# v2 las Rolle und User-ID aus dem UNSIGNIERTEN JWT-Payload und akzeptierte
# `authHdr.includes(SERVICE_ROLE)` als Service-Nachweis. Nur das Gateway-Flag
# verhinderte den Missbrauch — ein Klick im Dashboard hätte daraus einen
# offenen Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht.
# v3: Constant-Time-Compare des vollen Keys + echte auth.getUser()-Prüfung.
echo "── 3/3 · send-push härten (P0-3) ──────────────────────────"
supabase functions deploy send-push --project-ref "$PROJECT_REF"
echo "✓ send-push v3 deployed"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo " FERTIG. Bitte noch prüfen:"
echo "═══════════════════════════════════════════════════════════"
cat <<'PRUEF'

  1) Bauernregeln pro Monat (Jan/Dez sollten ~19 statt 11 sein):
     SELECT m, count(*) FROM generate_series(1,12) m
     LEFT JOIN traditional_garden_wisdom w ON m = ANY(w.applicable_months)
     GROUP BY m ORDER BY m;

  2) Quiz-Bildfragen vorhanden:
     SELECT count(*) FILTER (WHERE image_url IS NOT NULL) AS mit_bild,
            count(*) AS total FROM daily_quizzes;

  3) Quiz-RPC liefert die Bild-Spalten:
     SELECT * FROM fn_get_daily_quiz();

  4) send-push weist ein gefälschtes Token ab (muss 401 liefern):
     curl -s -o /dev/null -w '%{http_code}\n' -X POST \
       "https://vowbiueikwrauuceilhc.supabase.co/functions/v1/send-push" \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer x.$(printf '{"role":"service_role"}' | base64 | tr -d '=' | tr '/+' '_-').x" \
       -d '{"broadcast":true}'
     → erwartet: 401  (vor dem Fix wäre das durchgegangen)

  NOCH OFFEN (nur im Dashboard möglich):
  • Supabase → Auth → Settings → "Leaked password protection" aktivieren
  • Stripe → Webhook-Signing-Secret rotieren (Prefix war im Repo, jetzt redigiert)
  • Obsolete Stripe-Setup-Edge-Fns löschen/auf 410 stubben (P1-1)

PRUEF
