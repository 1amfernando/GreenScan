# CODE-ROUTINE-MASTER — GreenScan tägliche Wachstums-Routine

> **Wer das liest:** Claude Code (CLI) bei jedem Session-Start.
> **Was das macht:** Definiert was Code täglich/wöchentlich/monatlich autonom macht, damit GreenScan auch ohne aktive Fernando-Aufträge wächst und sauber bleibt.
> **Wie das genutzt wird:** Code prüft beim Session-Start: ist heute Routine-Tag? Falls ja → diese Datei durchgehen, alle fälligen Tasks abarbeiten, am Ende Status in `STATUS.md` schreiben.
> **Wichtig:** Diese Routine läuft PARALLEL zu Auftrags-Sprints. Wenn ein `AUFTRAG_CODE_v26.x_*.md` offen ist → Auftrag hat Vorrang, Routine danach.

---

## 🎯 Ziele der Routine

1. **Lückenlos** — App bleibt jeden Tag testbar, Bugs werden schnell entdeckt
2. **Selbst-wachsend** — DB-Inhalte, Übersetzungen, A11y-Verbesserungen ohne Fernando-Input
3. **Sauber** — kein technisches Schulden-Aufbau, kein Drift zwischen Backend und Frontend
4. **Transparent** — jede Session hinterlässt einen Status-Eintrag

---

## ⏰ Routine-Frequenzen

| Frequenz | Wann | Dauer | Inhalt |
|---|---|---|---|
| **Daily** | Bei jedem Session-Start | 15–30 Min | Health-Check + DB-Wachstum + Smoke-Test |
| **Weekly** | Montag (oder erster Session-Tag) | 1–2 h | Audit + i18n + Memory-Sync |
| **Monthly** | Erster Werktag jedes Monats | 4–6 h | Cleanup + Cost-Review + Backup-Pruning |
| **Trigger-driven** | Event-basiert | varies | Bug-Triage, Edge-Fn-Failure, Threshold-Alert |

---

## 📅 DAILY ROUTINE (15–30 Min, jeder Session-Start)

### 1. Health-Check (5 Min)

```bash
# 1.1 Cloudflare Live-Version vs Repo
LIVE=$(curl -s https://green-scan.ch/ | grep -oE "GS_VERSION = '[^']*'" | head -1)
REPO=$(grep -oE "GS_VERSION = '[^']*'" repo-clone/index.html | head -1)
echo "LIVE: $LIVE  | REPO: $REPO"
# → Wenn ungleich → Push fällig oder Cloudflare-Build hängt
```

```sql
-- 1.2 Edge-Functions: laufen alle?
SELECT slug, version, status, updated_at FROM (
  SELECT slug, version, status, to_timestamp(updated_at/1000) AS updated_at
  FROM ... -- ListEdgeFunctions via Supabase MCP
) ORDER BY updated_at DESC;
-- Erwartet: 25 ACTIVE, kein ERRORED

-- 1.3 Stripe-Webhook gestern OK?
SELECT
  COUNT(*) FILTER (WHERE status_code = 200) AS ok_200,
  COUNT(*) FILTER (WHERE status_code != 200) AS errors,
  MAX(created_at) AS last
FROM stripe_webhook_events
WHERE created_at > now() - interval '24 hours';
-- Erwartet: ok_200 > 0 ODER (=0 weil keine Subs), errors = 0

-- 1.4 Auth-Errors gestern
SELECT event_type, COUNT(*) FROM analytics_events
WHERE event_type LIKE 'auth.%error%' AND created_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
```

→ **Wenn Anomalie** (Edge-Fn ERRORED, Webhook-Errors, Auth-Spike): Hotfix-Workflow oben in die TODO. Sonst weiter.

### 2. DB-Wachstum (10 Min)

```sql
-- 2.1 Knowledge-Tabellen-Counts
SELECT 'recipes' AS t, COUNT(*) FROM recipes
UNION ALL SELECT 'plant_diseases', COUNT(*) FROM plant_diseases
UNION ALL SELECT 'garden_techniques', COUNT(*) FROM garden_techniques
UNION ALL SELECT 'pollinators', COUNT(*) FROM pollinators
UNION ALL SELECT 'garden_tasks_catalog', COUNT(*) FROM garden_tasks_catalog
UNION ALL SELECT 'plant_companion_matrix', COUNT(*) FROM plant_companion_matrix
UNION ALL SELECT 'remedies', COUNT(*) FROM remedies
UNION ALL SELECT 'folk_lore', COUNT(*) FROM folk_lore
UNION ALL SELECT 'daily_quizzes', COUNT(*) FROM daily_quizzes
UNION ALL SELECT 'swiss_climate_zones', COUNT(*) FROM swiss_climate_zones
UNION ALL SELECT 'garden_problems', COUNT(*) FROM garden_problems
UNION ALL SELECT 'harvest_preservation', COUNT(*) FROM harvest_preservation
UNION ALL SELECT 'seed_starting_calendar', COUNT(*) FROM seed_starting_calendar
UNION ALL SELECT 'seasonal_tips', COUNT(*) FROM seasonal_tips
UNION ALL SELECT 'seasonal_highlights', COUNT(*) FROM seasonal_highlights
UNION ALL SELECT 'did_you_know_facts', COUNT(*) FROM did_you_know_facts;
```

→ **Tabellen unter Threshold → bulk-gen triggern:**

| Tabelle | Min-Threshold | Target |
|---|---:|---:|
| recipes | 150 | 200 |
| plant_diseases | 100 | 150 |
| garden_techniques | 100 | 150 |
| pollinators | 100 | 150 |
| garden_tasks_catalog | 140 | 200 |
| plant_companion_matrix | 90 | 130 |
| remedies | 120 | 170 |
| folk_lore | 110 | 150 |
| daily_quizzes | 150 | 200 |
| swiss_climate_zones | 60 | 100 |
| garden_problems | 60 | 100 |
| harvest_preservation | 80 | 130 |
| seed_starting_calendar | 70 | 130 |
| seasonal_tips | 60 | 100 (saturiert, focus_topics nutzen!) |
| seasonal_highlights | 40 | 80 |
| did_you_know_facts | 80 | 130 (saturiert, focus_topics nutzen!) |

Bulk-Gen Pattern (via `pg_net.http_post` ODER direkter Edge-Fn-Call):
```sql
SELECT net.http_post(
  url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
  body := '{"topic":"<TABLE>","count":12,"focus_topics":["<spez1>","<spez2>"]}'::jsonb,
  headers := '{"Content-Type":"application/json","X-Admin-Secret":"a217d1a3674f91e99c1f66b25794f8301ae8a231a906bbe3b1cfd137b4bc061b"}'::jsonb,
  timeout_milliseconds := 120000
);
```

→ Max 6 parallele Calls, dann 60s warten, dann nächste 6.

→ Verify nach 60s: `SELECT id, status_code, (content::jsonb->>'inserted')::int, (content::jsonb->>'topic') FROM net._http_response ORDER BY id DESC LIMIT 6;`

### 3. Live-Smoke-Test (10 Min via Chrome-MCP wenn verfügbar)

1. `https://green-scan.ch` öffnen → erwartet: keine Console-Errors, GS_VERSION sichtbar
2. Map-Tab → Tiles laden (kein graue Fläche)
3. Scan-Tab → Foto-Permission-Prompt erscheint
4. Garten → Add-Plant-Modal öffnet
5. Settings → About → „Was ist neu" zeigt aktuelle Version

→ **Wenn ein Step failt:** screenshot + console.log dump + neuer `BUG_<datum>.md` in repo-clone/ + im Daily-Status-Eintrag dokumentieren.

### 4. Daily-Status-Eintrag (2 Min)

In `STATUS.md` am Repo-Root oben anhängen:
```markdown
## YYYY-MM-DD — Code-Daily

- **Health:** ✅ alle Edge-Fns ACTIVE, Webhook OK, keine Auth-Spikes
- **DB-Wachstum:** +N entries (Tabelle1 X→Y, Tabelle2 ...)
- **Smoke-Test:** ✅ 5/5 OK | oder ⚠ Step3 failed → BUG_2026-05-21.md
- **Followup:** [optional, was morgen offen ist]
```

---

## 📅 WEEKLY ROUTINE (1–2h, Montag oder erster Tag der Woche)

### 1. Code-Audit (45 Min)

```bash
cd repo-clone

# 1.1 TODO/FIXME/XXX-Tags (sollte 0 bleiben)
grep -cE "(TODO|FIXME|XXX|HACK)[:\s]" index.html
# Erwartet: 0

# 1.2 Plus-Legacy-Strings ausserhalb Kommentaren/Changelog
grep -nE "GreenScan\s+Plus|Plus monthly|Plus-Plan" index.html | grep -v "^[0-9]*://\|^[0-9]*: */\*\|GS_RELEASES"
# Erwartet: 0

# 1.3 Icon-only Buttons ohne aria-label NACH _gsAutoArias
# (das Auto-Labeler-System sollte alle catchen, aber check via dom-cosmic)
python3 << 'EOF'
import re
with open('index.html','r') as f: html = f.read()
btns = re.findall(r'<button\b([^>]*)>([^<]{1,4})</button>', html)
no_label = [c for a,c in btns if 'aria-label' not in a and 'aria-labelledby' not in a and not re.search(r'[a-zA-Z0-9äöüÄÖÜß]', c.strip()) and c.strip()]
print(f"Icon-only Buttons ohne statisches aria-label: {len(no_label)} (alle werden by _gsAutoArias gepatcht)")
EOF

# 1.4 Hardcoded magic numbers in z-index
grep -cE "z-index:\s*9999[0-9]" index.html
# Erwartet: < 5 (alles sollte var(--z-*) sein)

# 1.5 console.log in Production-Pfad (sollte silent sein durch v26.5)
echo "Boot-Logs: $(grep -cE 'console\.log\(' index.html) (alle silenced by _gsConsoleCleanup in prod)"

# 1.6 Inline-Scripts node-clean
node /tmp/check_inline.js
for f in /tmp/inline_*.js; do node --check "$f" || echo "FAIL: $f"; done
```

→ **Jede Auffälligkeit** in `AUDIT_YYYY-WW.md` dokumentieren + Fix-Patch ins nächste v26.x Sprint einbauen.

### 2. i18n-Sync (30 Min)

```bash
# Neue data-i18n Marker seit letztem Sync
grep -oE 'data-i18n="[^"]+"' repo-clone/index.html | sort -u > /tmp/keys_now.txt
diff /tmp/keys_last_week.txt /tmp/keys_now.txt | grep "^>" | sed 's/^> //' > /tmp/new_keys.txt
wc -l /tmp/new_keys.txt
cp /tmp/keys_now.txt /tmp/keys_last_week.txt
```

Wenn neue Keys: `i18n-translate` Edge-Fn batch-call für FR + IT (Pattern siehe AUFTRAG_CODE_v26.8_I18N_PASS3.md).

### 3. Memory-Files-Update (15 Min)

In `~/Library/Application Support/Claude/.../memory/`:
- `01_STATUS_LIVE.md` → aktuelle Version, OFFEN-Liste, letzte Audits
- `02_CHANGELOG.md` → neue Releases der Woche
- `11_ARCHITEKTUR_MAP.md` → falls neue Funktionen/Bereiche

### 4. Backup-Pruning (15 Min)

```bash
cd repo-clone
# Backup-Branches älter als 30 Tage löschen
git branch -a | grep "backup/" | while read b; do
  AGE=$(git log -1 --format="%cr" "$b" 2>/dev/null)
  if [[ "$AGE" == *"month"* ]] || [[ "$AGE" == *"year"* ]]; then
    git branch -D "${b#refs/heads/}" 2>/dev/null
  fi
done
```

### 5. Weekly-Status (5 Min)

In `STATUS.md` Wochen-Sektion ergänzen:
```markdown
## Woche YYYY-WW — Code-Weekly

- Audit: ✅ 0 TODO/FIXME, 0 Plus-Legacy, X Icon-Buttons gepatcht
- i18n: +N keys FR + N keys IT
- Memory: aktualisiert auf v26.x
- Backups: N alte Branches gelöscht
- Releases der Woche: v26.X (Feature), v26.Y (Bug-Fix)
```

---

## 📅 MONTHLY ROUTINE (4–6h, erster Werktag)

### 1. DB-Cleanup (1h)

```sql
-- 1.1 Orphaned scan_events (User gelöscht, Events blieben)
DELETE FROM scan_events
WHERE user_id NOT IN (SELECT id FROM auth.users);
-- Plus: garden_diary, harvest_log, plant_doctor_history mit gleicher Logik

-- 1.2 push_subscriptions mit > 90 Tage no activity
DELETE FROM push_subscriptions
WHERE updated_at < now() - interval '90 days';

-- 1.3 stripe_webhook_events älter als 90 Tage (Audit-Log)
DELETE FROM stripe_webhook_events WHERE created_at < now() - interval '90 days';

-- 1.4 net._http_response älter als 7 Tage (Cron-Log)
DELETE FROM net._http_response WHERE created < now() - interval '7 days';

-- 1.5 audit_log älter als 1 Jahr
DELETE FROM audit_log WHERE created_at < now() - interval '1 year';
```

→ Vorher Backup via `pg_dump`-Snapshot wenn massive Delete-Zahl. Bei Unsicherheit: `SELECT COUNT(*)` zuerst, dann DELETE.

### 2. User-Feedback-Triage (2h)

```sql
-- Was hat sich angesammelt?
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status='new') AS new_count,
  COUNT(*) FILTER (WHERE status='triaged') AS triaged_count,
  COUNT(*) FILTER (WHERE priority IN ('p1','p2')) AS hot
FROM feedback_items
WHERE created_at > now() - interval '30 days';
```

`feedback-triage` Edge-Fn callen für unprocessed feedback. Dann manuell:
- P1/P2 → Bug-Fix-Sprint (neuer AUFTRAG_CODE_v26.x_BUGFIX_*.md)
- P3/P4 → Feature-Backlog (in `ROADMAP.md` einsortieren)
- Spam → status='spam'

### 3. Performance-Pass (1h)

Wenn Chrome-MCP verfügbar: Lighthouse-Audit auf green-scan.ch.
Ziele:
- Performance ≥ 85
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 90
- PWA ≥ 95

Sub-90 Werte → Issue + Fix-Sprint planen.

### 4. Cost-Review (30 Min)

```sql
-- Anthropic-Calls (über ai_queries oder analytics_events)
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS calls,
  SUM((data->>'input_tokens')::int) AS in_tok,
  SUM((data->>'output_tokens')::int) AS out_tok
FROM ai_queries
WHERE created_at > now() - interval '30 days'
GROUP BY 1 ORDER BY 1 DESC;
```

Wenn > $50/Monat → Quota-Check ob globale Keys exhausted, Model-Switch (Haiku statt Sonnet wo OK).

### 5. Version-Tag-Pflege (30 Min)

```bash
# Alte Tags älter als 6 Monate: behalten als Annotated, aber keine Lightweight
git tag -l "v25.*" | while read t; do
  AGE=$(git log -1 --format="%cr" "$t")
  echo "$t — $AGE"
done

# Doppelte oder fehlerhafte Tags ausmisten
```

### 6. Monthly-Status (15 Min)

Neuer Eintrag in `STATUS.md` Monats-Sektion + High-Level-Update in `MEMORY.md` Memory-Index.

---

## 🚨 TRIGGER-DRIVEN TASKS (event-basiert)

### Trigger 1 — User meldet Bug
1. Reproducer im Browser via Chrome-MCP wenn möglich
2. Console + Network-Tab dump
3. `BUG_YYYYMMDD_<topic>.md` schreiben (Fernando-Style: Beobachtung, Reproduktion, Ursache, Fix)
4. Fix als Patch im nächsten v26.x Sprint

### Trigger 2 — DB-Tabelle < Min-Threshold (Daily-Check)
→ knowledge-bulk-gen mit focus_topics, +12 entries pro Call

### Trigger 3 — Edge-Fn 5xx-Spike (> 5% in 24h)
1. `SELECT body FROM net._http_response WHERE status_code >= 500 ORDER BY id DESC LIMIT 5;`
2. Logs der Edge-Fn checken
3. Hotfix-Deploy ODER alert in `STATUS.md`

### Trigger 4 — Stripe-Webhook-Failure (status_code != 200)
1. `SELECT created_at, event_type, status_code, content FROM stripe_webhook_events WHERE status_code != 200 ORDER BY id DESC LIMIT 10;`
2. Identify Pattern (Signature-Mismatch? RPC fehlt?)
3. Backend-Fix in `stripe-webhook` v(N+1)

### Trigger 5 — Live-Verify nach jedem Push
Nach jedem `git push origin main`:
```bash
sleep 120  # Cloudflare Pages Build
curl -s https://green-scan.ch/ | grep -oE "GS_VERSION = '[^']*'"
# → muss neue Version sein
```

---

## 📈 WACHSTUMS-THEMEN (wenn Bandbreite frei)

Diese sind „Wenn-Zeit-da" Tasks — keine Pflicht, aber compounding-Value:

### A. Neue Knowledge-Tabellen
- `bird_calls` — Vogelstimmen mit Audio-Refs + Saison
- `weather_garden_advice` — Regen → was tun, Frost → was tun
- `regional_dialects` — Schweizerdeutsch-Namen pro Spezies (Bärlauch=Bärlauch, Schnittlauch=Bibernell, etc.)
- `permaculture_principles` — 12 Holmgren-Prinzipien + Schweizer Anwendungen
- `tree_identification_keys` — Bestimmungs-Decision-Trees

→ Pattern: neue Tabelle + Schema-Eintrag in `knowledge-bulk-gen` Edge-Fn + 30 initial entries.

### B. Species-Database erweitern
Aktuell 2837 species. Lücken:
- Schweizer Alpen-Flora (~150 endemic)
- Pilz-Familien jenseits VAPKO-Top-200
- Wassserpflanzen
- Stadt-Flora (Pflastersteine, Mauerritzen)

→ `species-bulk-seed` Edge-Fn mit category-filter triggern.

### C. Onboarding-Funnel-Optimierung
- A/B-Test: Trial-Modal mit „7 Tage gratis" vs „Pro Lifetime statt Abo"
- Setting `gs_onboarding_variant` random A/B, tracken via analytics_events
- Nach 30 Tagen: Conversion-Rate-Vergleich

### D. Marketplace-Listings-Quality
- Listings mit < 3 Fotos → flag „incomplete"
- Spam-Detection (gleicher Preis 1000x, Description-Template-Spam)
- Auto-Translate Listings DE→FR+IT via i18n-translate

### E. Achievement-System polieren
- 50+ Achievements im Catalog, viele ungestestet
- Trigger-Logic verify (level_up, scan_count, plant_planted, etc.)
- UI für Achievement-Detail-Modal

### F. Push-Notification-Cadence
- Push 7:00 Lokal: „Heute ist guter Tag zum {action}" (basierend auf Wetter + Saison)
- Push Trial-End-24h (in AUFTRAG_CODE_v26.7)
- Push „Pflanze X braucht Wasser" (basierend auf garden_tasks + plant_reminder_snoozes)

---

## 🛡️ SCHUTZ-REGELN (was Code NICHT autonom machen darf)

1. **Keine Migrations ohne Fernando-Review** wenn destruktiv (DROP TABLE, ALTER COLUMN TYPE)
2. **Keine User-facing Texte ändern** ohne Sicht — nur via i18n-Sync
3. **Keine Stripe-Operations** (Customer/Subscription/Refund) — Dashboard-only
4. **Keine Push-Notifications senden** ausserhalb von daily-push-checker Cron
5. **Keine Service-Worker-Strategie ändern** ohne v-Bump (sonst Cache-Inkonsistenzen)
6. **Keine Memory-Files überschreiben** — nur appenden
7. **Keine Daten löschen** ohne `SELECT COUNT(*)` Pre-Check + Backup-Branch

---

## 📋 SESSION-START-CHECKLISTE (Copy-Paste für Code)

```
□ git fetch && git pull origin main
□ Daily-Health-Check (Edge-Fns + Webhook + Auth-Errors)
□ DB-Counts vs Threshold-Table
□ Live-Smoke-Test
□ Offene AUFTRAG_CODE_v26.x_*.md prüfen → falls offen, das hat Vorrang
□ Falls Routine-Tag (Mo/erster Tag im Monat): Weekly/Monthly Block
□ Trigger-driven Tasks aus letzter Session abarbeiten
□ STATUS.md Eintrag schreiben
□ Commit + Push wenn Änderungen
```

---

## 📅 ZEITPLAN-GRID

|       | Mo | Di | Mi | Do | Fr | Sa | So |
|---|---|---|---|---|---|---|---|
| **Health** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **DB-Wachstum** | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| **Smoke-Test** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Audit** | ✓ | – | – | – | – | – | – |
| **i18n-Sync** | ✓ | – | – | – | – | – | – |
| **Memory-Update** | ✓ | – | – | – | – | – | – |
| **Cleanup** | (1./Monat) | – | – | – | – | – | – |
| **Feedback-Triage** | (1./Monat) | – | – | – | – | – | – |
| **Performance** | (1./Monat) | – | – | – | – | – | – |
| **Cost-Review** | (1./Monat) | – | – | – | – | – | – |

---

## 🎯 ERFOLG = WAS CODE NACH 30 TAGEN GELIEFERT HAT

Nach einem Monat dieser Routine sollte messbar sein:
1. **DB +600–1000 entries** (Knowledge-Tabellen kontinuierlich gewachsen)
2. **0 TODO/FIXME** im Code (kein Drift)
3. **3 Sprachen 100% Coverage** (i18n weekly-sync)
4. **Lighthouse ≥ 85** (monatlicher Performance-Pass)
5. **STATUS.md hat 30 Daily-Einträge + 4 Weekly + 1 Monthly**
6. **0 ungetriagete Feedback-Items**
7. **Edge-Fn-Uptime ≥ 99%** (Webhook + Auth-Stack)
8. **Bundle-Pipeline klar** — alte AUFTRAG-Files archived, nur aktuelle offen

---

## 📝 ÄNDERUNGS-PROTOKOLL DIESES DOKUMENTS

| Datum | Was | Wer |
|---|---|---|
| 2026-05-20 | Initial Version 1.0 | Cowork (für Code) |

> **Bei Bedarf:** Code darf diese Routine ergänzen wenn neue Patterns entstehen. Änderungen via separatem Commit committen mit Subject `routine: <change>`.

---

**Estimated:** Daily 15-30 Min · Weekly 1-2h · Monthly 4-6h.
**Total/Monat:** ca. 25-30h Code-Zeit.
**Output/Monat:** kontinuierlich wachsende App ohne Fernando-Bottleneck.
