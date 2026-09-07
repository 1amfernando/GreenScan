# AUFTRAG CODE v26.8 — i18n FR/IT Pass-3 (kompletter Bestand übersetzen)

> **Wer:** Claude Code (CLI)
> **Wann:** Nach v26.6 + v26.7 (oder parallel falls bandbreite)
> **Stand:** Backend `i18n-translate` Edge-Fn deployt (Cowork v25.27), Pass-2 (v25.28) hat ~170 data-i18n + ~80 JS-String-Keys eingeführt. Aber FR + IT Übersetzungen sind unvollständig.
> **Dauer:** 3–4 h (davon 1h Inventur, 2h Batch-Translate, 1h Verify + Frontend-Sync)
> **Branch:** main

---

## 🎯 Ziel

Schweizer Markt braucht **alle drei Amtssprachen** (DE/FR/IT). Aktuell ist DE 100%, FR + IT haben Lücken seit v25.28.

Endzustand: `SELECT lang, COUNT(*) FROM i18n_translations GROUP BY lang` zeigt für DE = FR = IT die gleiche Zahl (Coverage 100%).

---

## 📋 Schritt-für-Schritt

### Schritt 1 — Inventur (15 Min)

```bash
cd repo-clone

# Alle DE-Keys aus HTML extrahieren
grep -oE 'data-i18n="[^"]+"' index.html | sort -u | wc -l
# erwartet: ~250-300 unique keys

# Alle JS gsT() calls
grep -oE 'gsT\([\x27"][^\x27"]+[\x27"]' index.html | sort -u | wc -l
# erwartet: ~80-120

# Liste in Datei
{
  grep -oE 'data-i18n="[^"]+"' index.html | sed 's/data-i18n="//; s/"$//'
  grep -oE 'gsT\([\x27"][^\x27"]+[\x27"]' index.html | sed -E 's/gsT\(["\x27]//; s/["\x27]$//'
} | sort -u > /tmp/all_i18n_keys.txt
wc -l /tmp/all_i18n_keys.txt
```

### Schritt 2 — Diff DB-Bestand vs HTML (15 Min)

```sql
-- Aktuelle Coverage
SELECT lang, COUNT(*) AS n
FROM i18n_translations
GROUP BY lang
ORDER BY lang;
-- erwartet: de=300, fr=150, it=120 (ungefaehr — Werte muessen unausgeglichen sein)

-- Welche DE-Keys haben KEIN FR-Pendant?
SELECT de.key
FROM (SELECT DISTINCT key FROM i18n_translations WHERE lang='de') de
LEFT JOIN (SELECT DISTINCT key FROM i18n_translations WHERE lang='fr') fr USING (key)
WHERE fr.key IS NULL
ORDER BY de.key;

-- Gleicher Diff fuer IT
SELECT de.key
FROM (SELECT DISTINCT key FROM i18n_translations WHERE lang='de') de
LEFT JOIN (SELECT DISTINCT key FROM i18n_translations WHERE lang='it') it USING (key)
WHERE it.key IS NULL
ORDER BY de.key;
```

→ Speichere Diff-Ergebnisse in `/tmp/fr_missing.txt` und `/tmp/it_missing.txt`.

### Schritt 3 — Bulk-Translate via Edge-Function (90 Min)

`i18n-translate` Edge-Fn akzeptiert:
```json
{
  "target_lang": "fr",
  "keys": ["key1","key2",...],
  "source_lang": "de"
}
```

Antwort: `{ inserted: N, errors: [...] }`.

Pseudo-Code für Code:
```bash
# Batch-Loop fuer FR
while read -r KEY; do
  CHUNK_KEYS+=("$KEY")
  if [ ${#CHUNK_KEYS[@]} -ge 10 ]; then
    JSON=$(printf '%s\n' "${CHUNK_KEYS[@]}" | jq -R . | jq -s '{target_lang:"fr",keys:.,source_lang:"de"}')
    curl -X POST 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/i18n-translate' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -d "$JSON" >> /tmp/fr_translate_log.json
    echo >> /tmp/fr_translate_log.json
    CHUNK_KEYS=()
    sleep 8  # Anthropic rate-limit
  fi
done < /tmp/fr_missing.txt

# Gleicher Loop fuer IT
# ...
```

ODER via Supabase MCP + pg_net wenn Code Cowork's Approach nutzt:
```sql
SELECT net.http_post(
  url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/i18n-translate',
  body := '{"target_lang":"fr","keys":[...],"source_lang":"de"}'::jsonb,
  headers := '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb,
  timeout_milliseconds := 120000
);
```

→ Code soll Chunks von max 10 Keys pro Call halten (Haiku 4.5 + Quality), 8s Pause dazwischen.

### Schritt 4 — Verify (15 Min)

```sql
-- Beide Langs sollten jetzt = DE-Count sein
SELECT lang, COUNT(*) FROM i18n_translations GROUP BY lang;

-- Stichproben pruefen
SELECT key, value FROM i18n_translations WHERE lang='fr' AND key IN ('settings.title','garden.add','scan.result.match');
SELECT key, value FROM i18n_translations WHERE lang='it' AND key IN ('settings.title','garden.add','scan.result.match');
```

Manueller Smoke-Test im Browser:
1. https://green-scan.ch öffnen
2. Settings → Sprache → Français → alle UI-Strings sollten FR sein (keine DE-Fallbacks mehr)
3. Settings → Sprache → Italiano → gleich für IT

### Schritt 5 — Frontend-Update für GSW (optional, low-prio)

Schweizerdeutsch (gsw) ist Bonus-Feature. Code kann das mit i18n-translate auch machen wenn Zeit, sonst v26.10+.

---

## 📦 Versions-Disziplin

```
[ ] index.html: GS_VERSION = 'v26.8'
[ ] index.html: <meta app-version 26.8.20260521>
[ ] sw.js: VERSION = 'gs-v26.8'
[ ] _headers: v26.8
[ ] GS_RELEASES Eintrag mit user_summary
[ ] 7/7 inline-scripts node --check OK
[ ] Coverage: SELECT lang, COUNT(*) FROM i18n_translations zeigt 3 gleiche Werte
[ ] Browser-Verify: FR + IT zeigen keine DE-Fallbacks mehr
```

---

## ⚠️ Wichtige Constraints

1. **Haiku 4.5 Rate-Limit** — ca. 50 RPM. Bei 30+ Batches pro Lang heisst das ca. 5-7 Min pro Lang. Code soll Sleep einhalten, sonst 429-Errors.
2. **Anthropic-Cost** — pro Call ~200-400 Tokens, total ca. $0.05-0.20 für FR+IT. Negligible.
3. **Plurals/Context** — `i18n-translate` Edge-Fn hat einen System-Prompt der Schweizer Kontext beruecksichtigt. Wenn FR/IT-Übersetzung holprig wirkt, System-Prompt-Anpassung in der Edge-Fn nötig.
4. **GSW** — nicht via Edge-Fn pflegbar (Haiku kennt kein Schweizerdeutsch). Bonus-Feature, manuell durch Native-Speaker oder skip.

---

**Estimated Time:** 3-4 h · Live-Verify ~10 Min nach Push, FR/IT sofort sichtbar bei Settings-Sprachenwechsel.
