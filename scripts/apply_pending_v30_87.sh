#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# GreenScan — Ausstehende Backend-Arbeiten anwenden (Stand v30.95)
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
#
#   20260831_rollen_leak_fix_v30_95.sql            ← NEU, SICHERHEIT (v30.95)
#     fn_is_role / fn_role_at_least: der optionale zweite Parameter `_uid`
#     beantwortete Fragen zu FREMDEN Konten — für jeden, auch ohne Login.
#     Als anon reproduziert:
#         set local role anon;
#         select fn_is_role('admin','<uuid>');  -> true
#     User-UUIDs stehen öffentlich in social_posts.user_id und
#     v_marketplace_listings.user_id → die Admin-Konten waren ohne Login
#     aufzählbar. Nach dem Fix gibt es Auskunft über fremde UUIDs nur noch
#     für Staff/Admin; ohne `_uid` (so rufen alle 16 RLS-Policies und
#     fn_set_global_api_key auf) ändert sich nichts.
#
#   20260831_quiz_antworten_serverseitig_v30_95.sql  ← NEU, SICHERHEIT (v30.95)
#     quiz_answers.is_correct kam vom Client (data-Attribut im DOM) und
#     entschied über fn_grant_quiz_top3_pro ein JAHR PRO gratis (Cron jobid=23,
#     31.12. 23:00). Jetzt: BEFORE-INSERT/UPDATE-Trigger leitet is_correct und
#     xp_earned aus daily_quizzes.options[selected_option] ab, UPDATE/DELETE für
#     anon+authenticated entzogen, und die Grant-Funktion zählt nur noch
#     gegenprüfbare Antworten.
#     ⚠ REIHENFOLGE: Das dazugehörige Frontend (v30.95, schickt selected_option
#       mit) muss LIVE sein, bevor diese Migration läuft — sonst gelten neue
#       Antworten als nicht überprüfbar und zählen nicht. Nach dem Merge nach
#       main deployt Cloudflare automatisch; kurz nachsehen, dann diese Datei.
#
#   20260831_benachrichtigungen_dedup_fix_v30_95.sql ← NEU (v30.95)
#     Die täglichen Pflege-Erinnerungen sind seit 33 Tagen still tot: der
#     dedup_key-Index ist GLOBAL unique, der Guard in fn_create_notification
#     prüft aber nur ein 60-Minuten-Fenster — die unique_violation verschluckte
#     `EXCEPTION WHEN OTHERS`. Der Cron meldete trotzdem jeden Morgen Erfolg.
#     Fix an einer Stelle, heilt alle 5 Aufrufer.
#
#   20260831_kosten_und_cron_wachhund_v30_95.sql     ← NEU (v30.95)
#     (A) fn_log_ai_usage buchte ohne p_model still CHF 0.00 — 111 echte Calls
#         mit 471'430 Token standen mit 0.0000 in den Büchern.
#     (B) fn_monitor_health war blind für alle 5 HTTP-Cron-Jobs (net.http_post
#         ist fire-and-forget, der Cron meldet immer "succeeded"). Jetzt mit
#         net._http_response-Scan + Staleness-Check.
# ══════════════════════════════════════════════════════════════════════
# 0 · ZUERST: ZWEI OFFENE SCHREIB-ENDPUNKTE AUF public.species SCHLIESSEN
# ══════════════════════════════════════════════════════════════════════
# admin-seed-species (v3) und species-bulk-seed (v4) sind beide ACTIVE mit
#   verify_jwt = false        → für jeden im Internet aufrufbar
#   SERVICE_ROLE_KEY          → schreibt an der RLS vorbei
#   Schutz: EIN hartcodiertes Secret im Quelltext
# und genau dieses Secret liegt im Klartext im ÖFFENTLICHEN Repo, im aktuellen
# Tree von sechs gepushten claude/*-Branches (Stand 2026-08-31 nachgeprüft):
#   claude/lucid-cerf-3ooy72 · -XIpgp · -dfxwv7 · -dix1vr · -o5b8ie
#   claude/happy-gates-HK3zX
# Die v29-Rotation (HL#19) hat sie übersehen, weil sie kein Repo-Verzeichnis
# hatten — es gab keine Datei zum Durchsuchen.
#
# GEPRÜFT: kein Missbrauch. public.species = 2.838 Zeilen, genau 1 Zeile in
# den letzten 90 Tagen, neueste vom 2026-07-02. Das Fenster stand offen, es
# ist aber niemand hindurchgegangen.
#
# Beide Funktionen sind fachlich erledigt (Einmal-Seeding). Repo enthält jetzt
# 410-Gone-Stubs. Künftiges Seeding: SQL-Editor, kein offener HTTP-Endpunkt.
echo "── 0/4 · Offene species-Schreib-Endpunkte stilllegen (BLOCKER) ──"
supabase functions deploy admin-seed-species --project-ref "$PROJECT_REF"
supabase functions deploy species-bulk-seed  --project-ref "$PROJECT_REF"
echo "✓ admin-seed-species + species-bulk-seed liefern jetzt 410 Gone"
echo ""
echo "   Gegenprobe (muss 410 liefern):"
echo "     curl -s -o /dev/null -w '%{http_code}\\n' -X POST \\"
echo "       -H 'X-Admin-Secret: <altes Secret>' \\"
echo "       https://$PROJECT_REF.supabase.co/functions/v1/admin-seed-species"
echo ""

echo "── 1/4 · Migrationen anwenden ─────────────────────────────"

M1="supabase/migrations/20260827_wissen_ausbau_v30_84.sql"
M2="supabase/migrations/20260827_quiz_bilder_und_fragen_v30_85.sql"
M3="supabase/migrations/20260831_rollen_leak_fix_v30_95.sql"
M4="supabase/migrations/20260831_benachrichtigungen_dedup_fix_v30_95.sql"
M5="supabase/migrations/20260831_quiz_antworten_serverseitig_v30_95.sql"
M6="supabase/migrations/20260831_kosten_und_cron_wachhund_v30_95.sql"

if [ -n "${SUPABASE_DB_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  echo "   Wende via psql an (SUPABASE_DB_URL gesetzt)…"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M1"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M2"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M3"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M4"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M5"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$M6"
  echo "✓ Alle sechs Migrationen angewendet"
  echo ""
  echo "   Gegenprobe zum Rollen-Leak (muss jetzt 'false' liefern):"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c \
    "set local role anon; select fn_is_role('admin', id) as darf_anon_sehen from profiles where role='admin' limit 1;"
else
  cat <<'MANUELL'
   ⚠️  Kein psql / kein SUPABASE_DB_URL — bitte MANUELL einspielen:

   Variante A (empfohlen, kein Werkzeug nötig):
     Supabase Dashboard → SQL Editor → Inhalt dieser zwei Dateien
     nacheinander einfügen und ausführen:
       supabase/migrations/20260827_wissen_ausbau_v30_84.sql
       supabase/migrations/20260827_quiz_bilder_und_fragen_v30_85.sql
       supabase/migrations/20260831_rollen_leak_fix_v30_95.sql            ← Sicherheit
       supabase/migrations/20260831_quiz_antworten_serverseitig_v30_95.sql ← Sicherheit
       supabase/migrations/20260831_benachrichtigungen_dedup_fix_v30_95.sql
       supabase/migrations/20260831_kosten_und_cron_wachhund_v30_95.sql

     Gegenprobe danach im selben SQL-Editor (muss `false` liefern):
       set local role anon;
       select fn_is_role('admin', id) from profiles where role='admin' limit 1;

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
echo "── 2/4 · Vision-Funktionen deployen (Kostenschutz) ────────"
supabase functions deploy mushroom-identify --project-ref "$PROJECT_REF"
supabase functions deploy pest-identify     --project-ref "$PROJECT_REF"
# v30.95: diese drei zusaetzlich — sie reichen jetzt p_model an fn_log_ai_usage
# durch. Ohne p_model lief die Funktion in den else-Zweig und buchte CHF 0.00.
supabase functions deploy knowledge-bulk-gen    --project-ref "$PROJECT_REF"
supabase functions deploy garden-scan-analyze   --project-ref "$PROJECT_REF"
supabase functions deploy plant-doctor-diagnose --project-ref "$PROJECT_REF"
echo "✓ 5 KI-Funktionen deployed (Limit + Kostenerfassung)"
echo ""

# ── 3 · SEND-PUSH (Audit P0-3, Sicherheit) ─────────────────────────────
# v2 las Rolle und User-ID aus dem UNSIGNIERTEN JWT-Payload und akzeptierte
# `authHdr.includes(SERVICE_ROLE)` als Service-Nachweis. Nur das Gateway-Flag
# verhinderte den Missbrauch — ein Klick im Dashboard hätte daraus einen
# offenen Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht.
# v3: Constant-Time-Compare des vollen Keys + echte auth.getUser()-Prüfung.
echo "── 3/5 · send-push härten (P0-3) ──────────────────────────"
supabase functions deploy send-push --project-ref "$PROJECT_REF"
echo "✓ send-push v3 deployed"
echo ""

# ── 4 · TOTE STRIPE-SETUP-FUNKTIONEN STILLLEGEN (Audit P1-1) ───────────
# Diese 6 waren weiterhin ACTIVE und mit verify_jwt:false deployed — also für
# JEDEN im Internet aufrufbar — obwohl laut Projekt-Doku toter Setup-Code.
# Vier davon mutieren ECHTE Stripe-Daten (Produkte, Preise, Webhooks, Abos).
#
# VOR DER STILLLEGUNG VERIFIZIERT (2026-08-28):
#   • 0 Aufrufe aus index.html      • 0 Referenzen in cron.job
# NICHT dabei: key-health-check — die wird von einem Cron-Job (täglich 03:00)
# aufgerufen und ist NICHT tot. (Korrektur zum ersten Audit-Entwurf.)
echo "── 4/5 · Tote Stripe-Setup-Funktionen stilllegen (P1-1) ───"
for FN in stripe-restructure-pro-only stripe-import-fernando-sub \
          stripe-complete-setup stripe-final-audit \
          create-checkout customer-portal; do
  echo "   → $FN (410-Gone)"
  supabase functions deploy "$FN" --project-ref "$PROJECT_REF"
done
echo "✓ 6 Setup-Funktionen auf 410 stillgelegt"
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

  5) Tote Stripe-Fns liefern jetzt 410 (Beispiel):
     curl -s -o /dev/null -w '%{http_code}\n' -X POST \
       "https://vowbiueikwrauuceilhc.supabase.co/functions/v1/stripe-final-audit"
     → erwartet: 410

  ═══════════════════════════════════════════════════════════
  NOCH OFFEN — Stripe-Webhook-Secret rotieren
  ═══════════════════════════════════════════════════════════
  BEWUSST NICHT AUTOMATISIERT. Die Reihenfolge ist kritisch: Zwischen dem
  Rotieren in Stripe und dem Speichern in Supabase schlägt JEDE Webhook-
  Signaturprüfung fehl. In diesem Fenster werden Abo-Wechsel, Zahlungen und
  Kündigungen NICHT mehr in die DB übernommen. Darum von Hand, zügig, in
  genau dieser Reihenfolge:

    1. Supabase → SQL Editor: aktuellen Wert sichern (Rückweg!)
         SELECT value FROM app_settings WHERE key = 'stripe_webhook_secret';

    2. Stripe → Developers → Webhooks → Endpoint (zeigt auf
       .../functions/v1/stripe-webhook) → "Roll secret".
       Falls angeboten: Übergangsfrist ("expire in 24 hours") wählen —
       dann gilt das alte Secret noch und es gibt KEIN Ausfallfenster.
       Neues whsec_… kopieren.

    3. SOFORT in Supabase speichern:
         UPDATE app_settings SET value = '<NEUES_whsec_>'
         WHERE key = 'stripe_webhook_secret';
       (Hinweis: Ist zusätzlich die Env-Variable STRIPE_WEBHOOK_SECRET
        gesetzt, hat DIESE Vorrang — dann dort ebenfalls aktualisieren,
        Supabase → Edge Functions → Secrets, danach stripe-webhook neu
        deployen.)

    4. Prüfen: Stripe → Webhooks → "Send test webhook".
       Erwartet: HTTP 200. Und in der DB:
         SELECT type, created_at FROM stripe_events
         ORDER BY created_at DESC LIMIT 5;
       → der Test-Event muss auftauchen.

    5. Erst wenn 4 grün ist: in Stripe das alte Secret endgültig verfallen
       lassen (falls Übergangsfrist gewählt).

    Rückweg, falls etwas klemmt: den in Schritt 1 gesicherten Wert wieder
    in app_settings zurückschreiben und in Stripe das alte Secret reaktivieren.

  ══════════════════════════════════════════════════════════════════════
  WICHTIG — die Secret-Rotation oben ist NICHT nur Hygiene
  ══════════════════════════════════════════════════════════════════════
  Befund vom 2026-08-31: die Stripe-Webhook-Strecke hat noch NIE geliefert.

    stripe_webhook_events          = 0 Zeilen, seit jeher
    stripe_subscriptions           = 1 Zeile, status='trialing',
                                     current_period_end = 2026-05-23
                                     (ueber 3 Monate her),
                                     updated_at = 2026-05-27
    audit_log (stripe/subscription)= 0 Zeilen

  Warum das aussagekraeftig ist: stripe-webhook/index.ts:305 schreibt JEDES
  empfangene Event nach stripe_webhook_events — direkt nach der Signatur-
  pruefung, VOR jedem Handler. Null Zeilen heisst also: kein einziges Event
  hat je die Signaturpruefung passiert. Und waere die Strecke intakt, haette
  Stripe zum Trial-Ende am 23.05. ein customer.subscription.updated
  geschickt; die Zeile stuende auf 'active' oder 'canceled' statt weiterhin
  auf 'trialing'.

  ENTWARNUNG zur Schwere: es ist noch niemandem etwas verloren gegangen.
  Alle 9 bezahlten Konten sind comp_tier-Zuteilungen von Hand — es hat noch
  NIE jemand ueber Stripe wirklich bezahlt. Die Strecke ist unerprobt, nicht
  beschaedigt. Beim ersten echten Zahlungsvorgang waere sie es aber:
  Abo-Start, Kuendigung und fehlgeschlagene Karte kaemen nie in der App an.

  URSACHE VON HIER AUS NICHT BESTIMMBAR — dafuer braucht es das Stripe-
  Dashboard. Bitte in dieser Reihenfolge pruefen:

    1. Stripe → Developers → Webhooks: Gibt es ueberhaupt einen Endpunkt auf
         https://vowbiueikwrauuceilhc.supabase.co/functions/v1/stripe-webhook
       Wenn nein → das ist die Ursache. Anlegen, Events abonnieren
       (checkout.session.completed, customer.subscription.*,
        invoice.payment_failed, charge.failed, charge.dispute.created,
        customer.updated, account.updated).

    2. Modus pruefen: Test- und Live-Modus haben GETRENNTE Endpunkte UND
       getrennte Signing-Secrets. Ein im Test-Modus angelegter Endpunkt sieht
       keine Live-Events. (Hinweis am Rande: app_settings.stripe_publishable_key
       traegt den Prefix `pk_test_` — die Zeile wird vom Frontend allerdings
       nirgends gelesen, ist also eher Altlast als Beweis. Trotzdem ein
       Anlass, den Modus bewusst zu pruefen.)

    3. Falls ein Endpunkt existiert: dessen "Recent deliveries" ansehen.
       401/400 → Signing-Secret passt nicht zu app_settings.stripe_webhook_secret
       (dort steht ein 38-Zeichen-Wert mit Prefix whsec, zuletzt geaendert
       am 2026-05-16). Dann ist die Rotation unten genau die Loesung.
       Keine Deliveries → es wurde nie etwas gesendet, siehe 1./2.

    4. Gegenprobe nach jeder Aenderung: Stripe → "Send test webhook" und
         SELECT id, type, created_at, error FROM stripe_webhook_events
         ORDER BY created_at DESC LIMIT 5;
       Der Test-Event MUSS dort auftauchen. Erst dann ist die Strecke belegt.

  ══════════════════════════════════════════════════════════════════════

  NOCH OFFEN — Supabase-Dashboard (1 Klick):
  • Auth → Settings → "Leaked password protection" aktivieren

PRUEF
