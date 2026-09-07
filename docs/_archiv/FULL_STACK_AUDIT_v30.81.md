# FULL STACK AUDIT — GreenScan v30.81

> **Datum:** 2026-08-27 · **Auditor:** Claude (Code-Agent) · **Umfang:** Frontend
> (`index.html`, `sw.js`), Supabase (178 Tabellen, ~40 Edge-Functions, Advisors),
> Infrastruktur (`_headers`, `manifest.json`, CSP), Wissens-/Content-Abdeckung.
> **Methode:** Live-DB-Abfragen (Supabase MCP), Edge-Function-Quellcode-Review,
> skript-gestützte Frontend-Scans, Advisor-Auswertung (159 KB, 145 Lints).
>
> **Ehrliche Abdeckungs-Notiz:** Die erschöpfende XSS-`innerHTML`-Sichtung
> (668 Sites) und der vollständige Dark-Mode-Sweep wurden durch das
> Org-Monats-Spend-Limit vorzeitig gestoppt (zwei Opus-5-Subagenten, Reset
> 12:20 UTC). Die hier dokumentierten Frontend-Stichproben + die vollständigen
> Backend-/Infra-/DB-Befunde stehen; der Rest-Sweep ist als P2-Follow-up
> markiert (§8).

---

## ⏱️ NACHTRAG v31.08 — was seither erledigt ist

> Dieses Dokument ist der Stand vom **2026-08-27**. Seither sind 18 Releases
> gelaufen (v30.92–v31.08). Ohne diesen Nachtrag würde jemand, der hier liest,
> Arbeit doppeln oder längst geschlossene Lücken für offen halten.

**Erledigt seit diesem Audit** — Belege in `STATUS.md` Sektion 0:

| Thema | Release |
|---|---|
| Sackgasse bei Key-Fehlern (Nicht-Admins hatten keinen Weg vorwärts) · Erstnutzer-Tour startete nach Registrierung nie | v30.92 |
| Marktplatz-Chat erfand Antworten im Namen echter Verkäufer | v30.93 |
| Feedback konnte still verloren gehen · Community-Post-Entwurf nach Serverfehler weg | v30.94 |
| Rollen-Auskunft über fremde Konten für `anon` · `quiz_answers.is_correct` kam vom Client · Pflege-Erinnerungen seit 33 Tagen tot · KI-Kosten mit CHF 0.00 gebucht · Cron-Überwachung blind für HTTP-Jobs | v30.95 |
| Sensor-Messwerte gingen ins Leere · GardenSync-Endlosschleife · Stripe-Webhook nie verarbeitet (Befund) | v30.96 |
| **Cloud-Backup war da, nur nicht erreichbar** | v30.97 |
| **Speicher-Wrapper log** — jeder Quota-Fallback war toter Code, Anmelden schlug still fehl | v30.98 |
| keepalive-Push verbuchte Fehlschläge als Erfolg · fehlgeschlagener Pull entwaffnete den Empty-Clobber-Guard | v30.99 |
| `savePlant` hielt eine Referenz über ein `await` | v31.00 |
| XP-Balken löste den ganzen Login-Übergang aus · Benachrichtigungen aus dem Menü entfernt | v31.01 |
| Last-Write-Wins verglich Geräte- gegen Server-Uhr · Sync log über sich selbst | v31.02 |
| Integritäts-Check zerstörte, was er retten sollte · Speicher-Modal zeigte falsche Grenze · i18n-Cache ass vom Nutzer-Budget | v31.03 |
| **Abmelden + wieder anmelden löschte das Konto auf allen Geräten** | v31.04 |
| Garten-Sync überschrieb lokal hart (gestellte Falle) | v31.05 |
| Foto-Ausgangskorb · Render-Pfad dazu | v31.06 / v31.07 |
| Rotierende Listen archivieren statt wegzuwerfen | v31.08 |

**Zwei Behauptungen aus späteren Audits habe ich WIDERLEGT** — nicht daran „reparieren":

1. *„Gartentagebuch-Cap inkonsistent: lokal 500, im pullAll 200 → 300 Einträge weg."* Stimmt nicht: die 200er-Caps sitzen auf `p.diary` (Pflege-Historie **pro Pflanze**), die 500 auf `gs_gartentagebuch` (**globales** Tagebuch). Zwei verschiedene Arrays, jedes konsistent gedeckelt.
2. *„Der 50-s-Timeout im Cron war ein Ausfall."* War keiner — die Edge-Function hat 77 s nach dem Trigger erfolgreich geschrieben (11 neue Zeilen). Der Befund zur **strukturellen** Blindheit der Cron-Überwachung stimmt trotzdem und ist in v30.95 behoben.

**Weiterhin offen und nur vom Owner lösbar:** siehe `ROADMAP.md` P0-1 (offene
`species`-Schreib-Endpunkte) sowie P1-1 (Leaked-Password-Protection) und P1-2
(Stripe-Webhook hat noch nie ein Event verarbeitet).

---

## 0 · Executive Summary — Ampel

| Bereich | Status | Kernaussage |
|---|---|---|
| **DB-Sicherheit (RLS)** | 🟢 | 178/178 Tabellen RLS-aktiv · 0 Security-ERROR-Advisors · 0 SECURITY-DEFINER-Fns mit mutable search_path |
| **Edge-Function-Auth** | 🟢 | Alle 3 P0 im Code behoben (i18n-translate live · Vision-Fns + send-push deploy-bereit) · 6 tote Stripe-Setup-Fns auf 410 stillgelegt (v30.88) |
| **Secrets** | 🟠 | Working-Tree sauber · **aber** 1 rotiertes Admin-Secret in Git-History + 1 `whsec_`-Prefix in Markdown committed |
| **Frontend-XSS** | 🟢 | Tiefen-Sweep: 4 echte Cross-User-Lücken gefunden — **alle in v30.83 behoben** (§1a). Sonst durchgängig sauber escaped |
| **Optik / Dark-Mode** | 🟠 | 3 (harmlose) doppelte DOM-IDs · viele hardcoded Hex-Farben (Dark-Mode-Lücken) · Notif-CSS seit v30.81 tokenisiert |
| **Wissens-Abdeckung** | 🟠 | **GSW (Schweizerdeutsch) = 0 Übersetzungen trotz „live"-Versprechen** · species-Tabelle 2'838 vs. 4'342 beworben |
| **Infrastruktur** | 🟢 | CSP/HSTS/COOP solide · manifest vollständig · nur CSP-`script-src` zu weit (ungenutzte CDNs) |

**Status 2026-08-27:** ✅ **P0-1 und P0-2 sind behoben und live deployed** (v30.83,
siehe §1). Offen bleibt P0-3 (`send-push`, Defense-in-Depth) sowie die P1-Punkte.

---

## 1 · 🔴 P0 — Kritische Sicherheitslücken

### P0-1 · `i18n-translate` Auth-Bypass → unbegrenzte KI-Kosten (VERIFIZIERT)
**Datei:** `supabase/functions/i18n-translate/index.ts:24-46`
**Deploy:** `verify_jwt:false`, Version 4, ACTIVE.

Die Funktion prüft „Admin oder service_role" über `decodeJwt()` — das
**base64-decodiert den JWT-Payload OHNE Signaturprüfung**:
```ts
function decodeJwt(authHeader){ … const p = JSON.parse(atob(seg)); return { sub:p.sub, role:p.role }; }
…
const isService = role === "service_role" || authHdr.includes(SERVICE_ROLE);
if (isService) return null;   // ← Gate offen
```
Da das Gateway mit `verify_jwt:false` nichts verifiziert, genügt ein
selbstgebauter Header `Authorization: Bearer x.<base64 von {"role":"service_role"}>.x`
→ Gate passiert → **jeder anonyme Aufrufer löst Anthropic-Calls (`max_tokens`
serverseitig, Haiku 4.5) auf Kosten des Owners aus.**

**Fix (eine der beiden, Cowork-Domäne):**
1. **Bevorzugt:** `verify_jwt:true` am Gateway setzen **und** den In-Code-Gate
   auf einen `X-Admin-Secret`-Header gegen `app_settings` umstellen (Muster von
   `knowledge-bulk-gen`, das korrekt gated ist). Damit funktionieren die
   Cron-/Admin-/Skript-Aufrufe weiter; normale User lesen ohnehin direkt aus
   `i18n_translations` per PostgREST (kein Edge-Call nötig).
2. **Minimal:** In `denyIfNotAdmin` die Signatur echt verifizieren
   (`supabase.auth.getUser(token)`), statt dem base64-Payload zu vertrauen.

**Impact:** Direkter finanzieller Schaden + möglicher Anthropic-Rate-Limit-Ban
der ganzen App. **Blast-Radius: gesamte KI-Funktionalität.**

### P0-2 · Ungedrosselte KI-Spender ohne Quota
**Dateien:** `supabase/functions/mushroom-identify/index.ts`,
`supabase/functions/pest-identify/index.ts`
Beide: Anthropic-Vision, **service-role DB-Client, KEINE In-Code-Auth, KEINE
Quota/Rate-Limit** — geschützt einzig durch das Dashboard-Flag `verify_jwt:true`.
Jeder eingeloggte User kann unbegrenzt teure Vision-Calls auslösen; würde das
Flag je versehentlich umgestellt, wären sie vollständig offen.
**Fix:** `fn_check_rate_limit`-Aufruf ergänzen (Muster von
`garden-scan-analyze`/`plant-doctor-diagnose`) — idealerweise tier-basiert wie
`ai-proxy` (die einzige Fn mit echter Quota-Enforcement).

### P0-3 · `send-push` — fälschbarer service_role-Claim ✅ IM CODE BEHOBEN (v30.87)
**Datei:** `supabase/functions/send-push/index.ts`
War dasselbe `decodeJwt()`-Muster wie P0-1: Rolle und User-ID aus dem
**unsignierten** JWT-Payload, plus `authHdr.includes(SERVICE_ROLE)` — ein
Substring-Test auf einen Vollmacht-Schlüssel. Sicher war das nur, solange
`verify_jwt:true` steht; ein Klick im Dashboard hätte daraus einen
unauthentifizierten Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht.

**Fix v30.87 (im Repo, Deploy ausstehend):** `authenticate()` ersetzt
`decodeJwt()` — (a) service_role via **Constant-Time-Compare des vollen Keys**
(Muster `daily-push`), (b) User via **`sb.auth.getUser(token)`**, also
serverseitig signaturgeprüft. Fail-closed → 401. Admin-Broadcast-Check und
500er-Cap unverändert erhalten.
**Ausrollen:** `bash scripts/apply_pending_v30_87.sh` (Schritt 3/3).

---

## 1a · ✅ Frontend-XSS — 4 Cross-User-Lücken gefunden und behoben (v30.83)

Der vollständige Tiefen-Sweep (nach dem Spend-Limit nachgeholt) prüfte gezielt
Daten, die **andere Personen** befüllen können. Vier echte Lücken — alle gefixt:

| # | Ort | Angreifer-kontrolliertes Feld | Wirkung | Fix |
|---|---|---|---|---|
| 1 | `index.html` Community-Funde-Zähler | `species_name` aus fremden, öffentlichen `map_user_finds` (freier Text) | `<img onerror>` lief bei **jedem** Betrachter der Saison-Pilz-Karte | `escHtml()` |
| 2 | Karten-Popup (2 Render-Pfade) | `photo_url` fremder Funde | `"`-Ausbruch aus `src="…"` → `onerror=` | neuer `_gsSafeUrl()` |
| 3 | Marktplatz-Badge | `certification_label` (Verkäufer-PATCH, unvalidiert) | Ausbruch aus `title="…"` → `onmouseover=` | `_esc()` gehärtet |
| 4 | Marktplatz-Bilder (3 Stellen) | `photo_urls` fremder Inserate | `"`-Ausbruch aus `src="…"` | `_gsSafeUrl()` |

**Zwei Helfer neu/gehärtet:**
- `_esc()` escaped jetzt auch `"` und `'` — es wurde in **Attribut**-Kontexten
  benutzt, wo fehlende Quotes der eigentliche Ausbruchsweg sind.
- `_gsSafeUrl()` (neu): erlaubt nur `https?://` und `data:image/`, escaped Quotes.
  Blockiert `javascript:`-URLs. Verifiziert gegen echte Storage-URLs — keine
  bestehenden Bilder betroffen.

**Sauber befundene Bereiche** (kein Handlungsbedarf): Community-Feed, Profile,
Freunde, Marktplatz-Chat, Orgs/Klassen, Lina-Coach, Feedback, Quiz-Ranglisten,
Benachrichtigungen — alle konsequent über `escHtml`/`_gsCEsc`.

---

## 2 · 🟠 P1 — Hohe Priorität

### P1-1 · Obsolete Edge-Functions ✅ IM CODE STILLGELEGT (v30.88)

**Befund:** 9 von 18 `verify_jwt:false`-Funktionen hatten keinen Quellcode im
Repo. Sechs davon waren nachweislich tot, liefen aber weiter **ACTIVE und für
jeden im Internet aufrufbar** — vier davon mutieren ECHTE Stripe-Daten
(Produkte, Preise, Webhooks, Abos).

**⚠️ Korrektur zum ersten Entwurf:** `key-health-check` stand faelschlich auf
der Totliste. Sie wird von einem **Cron-Job taeglich um 03:00** aufgerufen
(`cron.job` → `key-health-daily`) und ist NICHT tot. Nicht anfassen.

**Vor der Stilllegung verifiziert (2026-08-28):**
- 0 Aufrufe aus `index.html` (Frontend)
- 0 Referenzen in `cron.job`

**v30.88 — 410-Gone-Stubs im Repo** (Muster: `stripe-setup-webhook`), reine
Antwort ohne Code und ohne Secrets:

| Funktion | Grund | Ersatz |
|---|---|---|
| `stripe-restructure-pro-only` | Einmaliges Preis-Umbau-Tool | Stripe-Dashboard |
| `stripe-import-fernando-sub` | Einmalige Abo-Migration | Stripe-Dashboard |
| `stripe-complete-setup` | Einmaliges Setup-Tool | Stripe-Dashboard |
| `stripe-final-audit` | Einmaliges Audit-Tool | Stripe-Dashboard |
| `create-checkout` | Aeltere Dublette | `stripe-checkout` |
| `customer-portal` | Aeltere Dublette | `stripe-portal` |

**Ausrollen:** `bash scripts/apply_pending_v30_87.sh` (Schritt 4/4).
**Rest-Aufgabe:** `admin-seed-species` / `species-bulk-seed` pruefen und
Quellcode der weiter genutzten Fns ins Repo committen.

### P1-2 · Geleakte Secrets in Git-History & Doku
- **Git-History:** Commit vor `e6fc9d2` enthält 3× `const ADMIN_SECRET =
  "a217d1a…061b"` (stripe-bootstrap/knowledge-bulk-gen/stripe-setup-webhook).
  Entfernt aus HEAD, **aber via `git log -p` weiterhin lesbar** wenn das Repo
  public ist. Laut Commit rotiert — dennoch: History-Purge erwägen (BFG/
  filter-repo) falls je public.
- **`AUFTRAG_v25.4_AUTH_TRIAL_ABO.md:270`:** ein `whsec_`-Prefix eines
  Stripe-Webhook-Signing-Secrets war im Klartext committed. **v30.86: aus HEAD
  redigiert** (`whsec_***REDACTED***`). Rest-Aufgabe Owner: Secret in Stripe
  rotieren + ggf. Git-History bereinigen, falls das Repo je public wird.

### P1-3 · Leaked-Password-Protection deaktiviert
Advisor `auth_leaked_password_protection` WARN. **Fix:** Supabase Dashboard →
Auth → Settings → „Leaked password protection" aktivieren (1 Klick, kein Code).
Prüft Passwörter gegen HaveIBeenPwned. Steht seit v26.51 offen (ROADMAP P1-1).

### P1-4 · GSW (Schweizerdeutsch) beworben, aber 0 Übersetzungen
`i18n_translations` Live-Stand: `fr`=2050, `it`=2050, `en`=2041, `es`=2041,
**`gsw`=0**. README, ROADMAP, CLAUDE.md werben aber „DE/FR/IT/GSW **live**".
→ Wähler-Option führt ins Leere (Fallback auf DE), Versprechen nicht eingelöst.
**Fix:** Entweder GSW seeden (via korrekt-gate-tem `i18n-translate` nach P0-1)
**oder** GSW aus der Sprachauswahl + den Docs entfernen bis geseedet.

---

## 2a · ✅ Drei Audit-Punkte nachgeprüft — erledigt bzw. unbegründet (v30.91)

Beim Abarbeiten stellte sich heraus, dass drei als „offen" geführte Punkte
gar keine Arbeit mehr brauchen. Festgehalten, damit niemand Phantom-Arbeit
hinterherläuft:

| Punkt | Prüfergebnis |
|---|---|
| **P2-3 `alert()`/`confirm()` ersetzen** | ✅ **Faktisch erledigt.** Nachgezählt: 1 `alert()` (nur der Notnagel *innerhalb* von `gsToast` selbst — korrekt so) und 14 `confirm()`, davon **alle** in `else`-Zweigen hinter `gsConfirmModal`. Da `gsConfirmModal` immer definiert ist, feuert kein nativer Dialog. Die frühere Zahl („62× alert") stammte aus einem groben grep inkl. Changelog-Strings. |
| **`garden_diary` / `client_errors` leer trotz Schreibpfad** | ✅ **Unbegründet.** Schema live gegen den Frontend-Insert geprüft: alle Spalten vorhanden, kein Drift. RLS-Policies korrekt (`diary_owner_all` mit `auth.uid() = user_id`; `cerr_insert_own`). Die Leere ist echte Nicht-Nutzung (13 User, Nischen-Pfade), **kein stiller 4xx**. |
| **GSW als „live" beworben** | ✅ **Erledigt.** GSW ist seit **v26.65** gar nicht mehr in `SUPPORTED` — also nicht auswählbar. Verbliebene `gsw`-Treffer sind Kommentare/Changelog. Doku in v30.86 korrigiert. |

---

## 3 · 🟡 P2 — Mittel (Optik / Konsistenz / Hygiene)

### P2-1 · 3 doppelte DOM-IDs *(korrigiert 2026-08-27)*

> ⚠️ **Korrektur:** Die ursprüngliche Meldung „7 doppelte IDs" war falsch — das
> Prüfskript hatte `id="…"` auch in Changelog-**Strings** mitgezählt. Nachgemessen
> nur auf echtem Markup sind es **3**, und alle drei sind sich gegenseitig
> ausschliessende Render-Pfade (harmlos):

| ID | Vorkommen | Bewertung |
|---|---|---|
| `gs-prompt-input` | ×2 (14276/14277) | textarea- **oder** input-Variante, nie beide gleichzeitig → OK |
| `gs-admin-finance-sec` | ×2 (76527/76539) | zwei Render-Zweige derselben Admin-Box → OK |
| `gs-admin-cockpit-sec` | ×2 (76566/76588) | zwei Render-Zweige derselben Admin-Box → OK |

`main-tabs`, `screen-more`, `plant-name`, `abo-sub-info-host` waren **False
Positives**. Kein Handlungsbedarf.

### P2-2 · Hardcoded Hex-Farben → Dark-Mode-Lücken
3'872 `#rrggbb`-Literale gesamt (viele in Changelog-Strings = false positive,
aber ein signifikanter Teil in user-sichtbarer Feature-UI ohne `body.dark`-
Override → blendend-helle Kästen im Dark-Mode). Notification-CSS wurde in
v30.81 bereits vollständig auf Tokens umgestellt (Vorlage). **Fix:** Feature-für-
Feature auf `var(--card)/--text/--border/--c-*` migrieren. **Follow-up-Sweep
nötig** (siehe §8).

### P2-3 · Verbleibende native Dialoge
16× `alert(`, 34× `confirm(` im Code. In installierten iOS-PWAs blockieren
diese teils das Webview (Hard-Lesson #2). **Fix:** In user-facing Flows durch
`gsToast`/`gsConfirmModal` ersetzen (ROADMAP P2-2, laufend).

### P2-4 · CSP `script-src` zu weit
`_headers`: `script-src` erlaubt `unpkg.com`, `cdnjs.cloudflare.com`,
`cdn.jsdelivr.net` — aber **nur cdnjs wird real genutzt** (pdf.js, `index.html:80590`).
`unpkg`/`jsdelivr` sind ungenutzte Angriffsfläche. **Fix:** Beide aus `script-src`
entfernen (nur `cdnjs.cloudflare.com` behalten).

---

## 4 · 🟢 Was GESUND ist (verifiziert)

- **RLS:** 178/178 Public-Tabellen RLS-aktiv. 0 Security-ERROR-Advisors.
  0 SECURITY-DEFINER-Funktionen mit veränderbarem `search_path`.
- **Edge-Function-Muster (Vorbild):** `ai-proxy` — echte `auth.getUser()` +
  CORS-Allowlist + Model-Allowlist + `max_tokens`-Cap + **tier-basierte Quota**
  (free 15 / plus 200 / pro 2000, gezählt gegen `ai_usage`). `daily-push`
  nutzt **constant-time** Secret-Compare (stärkster Guard im Repo).
- **Stripe-Webhook:** HMAC-Signatur verifiziert + Event-ID-Replay-Dedup. SAFE.
- **`delete-user`:** `getUser()` + `jwtUid !== targetUid → 403`. SAFE.
- **Frontend-Escaping:** `escHtml`/`ed`/`gsEscHtml`/`gsSanitize` durchgängig;
  keine unescaped User-Injection in den Stichproben (Community/Scan/Weather).
- **Session-Handling:** Single-Source `localStorage.gs_sb_token` +
  `_gsFreshToken()`-Refresh, konsistent an ~15 Call-Sites. (`gsAutoLogin` bei
  `index.html:15797` ist toter Alt-Code über `window.supabase` — harmlos, §5.)
- **Race-Fixes v30.80:** Quiz-Leaderboard-Trigger + Push→Inbox-Bridge live &
  verifiziert konsistent.
- **Infrastruktur:** HSTS (1 Jahr, includeSubDomains), COOP, CORP, X-Frame,
  `frame-ancestors 'self'`, `upgrade-insecure-requests`. SW self-update
  (`max-age=0`). manifest vollständig (Shortcuts, Screenshots, maskable Icons,
  share_target). Digital-Asset-Links für TWA vorhanden.

---

## 5 · Toter Code / Hygiene (kein funktionaler Bug)

| Fund | Ort | Bewertung |
|---|---|---|
| `window.supabase`-Referenzen | 9× (`index.html`) — u.a. `gsAutoLogin` 15797, `gsAutoLogin` liest `supabase.auth.getSession()` | **Toter Pfad** (kein supabase-js geladen). `if(!window.supabase)return` failt sauber → No-Op. Entfernen bei Gelegenheit. |
| `gsBrain.*` | 62× | Alle per `typeof gsBrain !== 'undefined'` geschützt → No-Ops (siehe CLAUDE.md §4). Reine Hygiene. |
| `console.log` | 71× | Diagnose-Rauschen in Produktion. Optional strippen. |
| TODO/FIXME | 2× | Prüfen & schliessen. |
| `quiz_ranking`-Tabelle | 0 Zeilen, 0 Frontend-Refs | Totes Alt-System (ersetzt durch `quiz_leaderboard`). Drop-Kandidat. |

---

## 6 · Datenbank-Beobachtungen (Content / leere Tabellen)

Realer Nutzerstand: **13 Profile, 2 Push-Abos, 2'838 species** (Server-Tabelle;
die 4'342 beworbenen Arten sind die Client-DB `data/plants.v1.js`). Viele leere
Tabellen sind schlicht **Vor-Launch-Leerstand**, nicht zwingend Bugs:

- `garden_diary` = 0 & `client_errors` = 0 **trotz** vorhandener Frontend-
  Schreibpfade (`index.html:33124`, `:1708`). Bei nur 13 Usern plausibel „noch
  nie ausgelöst", **aber** verdient einen gezielten End-to-End-Test (könnte auch
  ein stiller 4xx sein — Schema-Drift oder RLS). → **P2-Verifikation.**
- `quiz_ranking`, `weekly_challenges`, `sensor_readings`, `book_*` u.a. leer =
  Features geplant/ungenutzt. Kein Handlungsbedarf ausser Doku-Ehrlichkeit.
- 5 Tabellen „RLS aktiv, keine Policy" (INFO): `book_ocr_pages`,
  `species_import_queue`, `species_search_cache`, `system_events`,
  `weather_forecast_cache`. RLS-aktiv-ohne-Policy = **standardmässig alles
  verweigert** (sicher), aber falls das Frontend/Service liest, braucht es eine
  explizite Policy. Prüfen ob gewollt.

---

## 7 · Advisor-Zusammenfassung (145 Lints)

- **0 ERROR** ✅
- **140 WARN:** 120 `authenticated_security_definer_function_executable` +
  16 `anon_security_definer_function_executable` (by-design für Frontend-RPCs
  wie `fn_quiz_leaderboard_top`, `fn_knowledge_search`, `fn_marketplace_search`
  — diese SIND für anon/authenticated gedacht; kein Datenleck solange die Fn
  intern `auth.uid()` prüft) + 3 `extension_in_public` (pg_trgm/vector/citext —
  kein User-Action) + 1 `auth_leaked_password_protection` (→ P1-3).
- **5 INFO:** `rls_enabled_no_policy` (§6).

**Bewertung:** Die 136 SD-Function-WARNs sind der bekannte, bewusst akzeptierte
by-design-Zustand (dokumentiert seit v26.51). Kein neuer ERROR seit dem
Self-Audit. **Empfehlung:** Die 16 `anon`-ausführbaren SD-Fns einzeln
gegenprüfen, ob jede wirklich anon erlauben soll (z.B. `fn_quiz_record_answer`
sollte eher `authenticated`-only sein — verifizieren).

---

## 8 · Offene Follow-ups (durch Spend-Limit abgebrochen)

Diese zwei Sweeps waren gestartet, wurden aber vom Org-Monats-Spend-Limit
gestoppt und sind **nachzuholen** (nächste Session / nach Limit-Reset):

1. **Vollständige XSS-`innerHTML`-Sichtung** aller 668 Sites — besonders
   User-Generated-Content (Community-Feedback, Marketplace-Listings,
   Lina-Chat, Freundes-/Profil-Namen, Klassen-Submissions). Stichprobe war
   sauber, aber 668 > Stichprobe.
2. **Vollständiger Dark-Mode-Sweep** — jede hardcoded-Light-Farbe in
   Feature-UI ohne `body.dark`-Override katalogisieren (die ~25 schlimmsten
   zuerst).

---

## 9 · Priorisierte Massnahmen-Liste (für den nächsten Fortschritt)

| # | Prio | Massnahme | Domäne | Aufwand |
|---|---|---|---|---|
| 1 | P0 | `i18n-translate` Auth-Bypass schliessen | Cowork/Backend | 1 Fn-Edit + Redeploy |
| 2 | P0 | `mushroom-identify`/`pest-identify` Rate-Limit | Cowork | 2 Fn-Edits |
| 3 | P0 | `send-push` echte Signaturprüfung | Cowork | 1 Fn-Edit |
| 4 | P1 | Obsolete Stripe-Setup-Fns löschen/stubben + Rest committen | Cowork | Aufräumen |
| 5 | P1 | `whsec_`-Prefix redigieren + Stripe-Secret rotieren | Owner | 5 Min |
| 6 | P1 | Leaked-Password-Protection aktivieren | Owner | 1 Klick |
| 7 | P1 | GSW seeden ODER aus UI/Docs entfernen | Frontend+Cowork | mittel |
| 8 | P2 | 7 doppelte DOM-IDs eindeutig machen | Frontend | klein |
| 9 | P2 | CSP `script-src` auf cdnjs eingrenzen | Frontend | 1 Zeile |
| 10 | P2 | Dark-Mode-Sweep (Feature-für-Feature) | Frontend | gross |
| 11 | P2 | `garden_diary`/`client_errors` E2E-Schreibtest | Frontend | klein |
| 12 | P3 | Toter Code (`window.supabase`, `gsBrain`, `quiz_ranking`) | Frontend/DB | Hygiene |

---

*Erstellt automatisch. Dieses Dokument ist die Single-Source-of-Truth des
v30.81-Audits. Bei Umsetzung: erledigte Punkte hier abhaken + in `STATUS.md`
Routine-Eintrag referenzieren.*
