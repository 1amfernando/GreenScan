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

## 0 · Executive Summary — Ampel

| Bereich | Status | Kernaussage |
|---|---|---|
| **DB-Sicherheit (RLS)** | 🟢 | 178/178 Tabellen RLS-aktiv · 0 Security-ERROR-Advisors · 0 SECURITY-DEFINER-Fns mit mutable search_path |
| **Edge-Function-Auth** | 🔴 | **1 kritische Auth-Bypass-Lücke** (`i18n-translate`) + 2 ungedrosselte KI-Spender + 9/18 `verify_jwt:false`-Fns ohne Quellcode im Repo |
| **Secrets** | 🟠 | Working-Tree sauber · **aber** 1 rotiertes Admin-Secret in Git-History + 1 `whsec_`-Prefix in Markdown committed |
| **Frontend-XSS** | 🟢 | Starke Escaping-Disziplin (`escHtml`/`ed`/`gsSanitize` durchgängig); Stichproben ohne User-Injection |
| **Optik / Dark-Mode** | 🟠 | 7 doppelte DOM-IDs · viele hardcoded Hex-Farben (Dark-Mode-Lücken) · Notif-CSS in v30.81 bereits tokenisiert |
| **Wissens-Abdeckung** | 🟠 | **GSW (Schweizerdeutsch) = 0 Übersetzungen trotz „live"-Versprechen** · species-Tabelle 2'838 vs. 4'342 beworben |
| **Infrastruktur** | 🟢 | CSP/HSTS/COOP solide · manifest vollständig · nur CSP-`script-src` zu weit (ungenutzte CDNs) |

**Sofort-Handlung nötig (P0):** `i18n-translate` Auth-Bypass schliessen — sonst
kann jeder im Internet unbegrenzt Anthropic-Tokens auf deine Rechnung verbrennen.

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

### P0-3 · `send-push` — fälschbarer service_role-Claim
**Datei:** `supabase/functions/send-push/index.ts:37-46,90`
Gleiches `decodeJwt()`-Muster wie P0-1. Sicher **nur solange**
`verify_jwt:true` bleibt; der `role==="service_role"`-Zweig ist bei einem
Flag-Flip ein unauthentifizierter Broadcast-Endpunkt an alle Push-Abonnenten.
**Fix:** Wie P0-1 — echte Signaturprüfung statt Payload-Vertrauen.

---

## 2 · 🟠 P1 — Hohe Priorität

### P1-1 · 9 von 18 `verify_jwt:false`-Edge-Functions ohne Quellcode im Repo
Nicht auditierbar, weil kein Ordner in `supabase/functions/`:
`create-checkout`, `customer-portal`, `admin-seed-species`, `species-bulk-seed`,
`stripe-restructure-pro-only`, `stripe-import-fernando-sub`,
`stripe-complete-setup`, `stripe-final-audit`, `key-health-check`.
Vier davon sind **live Stripe-mutierende Setup-Tools**, laut eigener Audit-Doku
„💀 DEAD-CODE" aber **weiterhin ACTIVE**.
**Fix (Cowork):** Obsolete Setup-/Migrations-Fns **löschen oder auf 410-Gone
stubben** (Muster: `stripe-setup-webhook` ist bereits korrekt neutralisiert).
Verbleibende Fns mit Quellcode ins Repo committen → auditierbar + wiederherstellbar.

### P1-2 · Geleakte Secrets in Git-History & Doku
- **Git-History:** Commit vor `e6fc9d2` enthält 3× `const ADMIN_SECRET =
  "a217d1a…061b"` (stripe-bootstrap/knowledge-bulk-gen/stripe-setup-webhook).
  Entfernt aus HEAD, **aber via `git log -p` weiterhin lesbar** wenn das Repo
  public ist. Laut Commit rotiert — dennoch: History-Purge erwägen (BFG/
  filter-repo) falls je public.
- **`AUFTRAG_v25.4_AUTH_TRIAL_ABO.md:270`:** `whsec_a1dWVK5xWxEbOd…`-Prefix eines
  Stripe-Webhook-Signing-Secrets im Klartext committed. **Fix:** Zeile
  redigieren + Secret in Stripe rotieren.

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

## 3 · 🟡 P2 — Mittel (Optik / Konsistenz / Hygiene)

### P2-1 · 7 doppelte DOM-IDs (statisches HTML)
| ID | Vorkommen | Risiko |
|---|---|---|
| `plant-name` | ×3 | `getElementById` trifft nur das erste → Formular-Prefill kann ins Leere greifen |
| `main-tabs` | ×2 | Navigations-Container doppelt — potenziell doppelte Event-Handler |
| `screen-more` | ×2 | Screen-Container-Kollision |
| `abo-sub-info-host` | ×2 | Abo-Info-Slot |
| `gs-prompt-input` | ×2 | Prompt-Modal (textarea/input-Variante — vermutlich exklusiv gerendert, tolerierbar) |
| `gs-admin-finance-sec` | ×2 | Admin-Cockpit (2 Render-Pfade) |
| `gs-admin-cockpit-sec` | ×2 | Admin-Cockpit (2 Render-Pfade) |
**Fix:** IDs eindeutig machen; wo zwei Render-Varianten dasselbe ID nutzen,
per Suffix trennen (`-textarea`/`-input`) oder auf Klassen umstellen.

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
