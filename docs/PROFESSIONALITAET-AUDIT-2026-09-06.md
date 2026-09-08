# Was noch nicht professionell ist — Bestandsaufnahme vom 06.09.2026

> Auftrag (Fernando): „finde weitere Sachen, die noch nicht professionell
> gemacht sind." Stand `main` @ `33518f6` (v32.64).
>
> **Methode.** Vier Suchdurchgänge (Sicherheit · Robustheit · Code-Hygiene ·
> Nutzersicht) über `index.html`, `sw.js`, `_headers`, alle 42
> Edge-Functions, alle 195 Migrationen und die Begleitseiten. **Jede
> Behauptung in diesem Dokument ist nachgemessen** — mit Zeilennummer,
> Zählung oder einem lesenden Blick in die Live-Datenbank
> (`information_schema`, `pg_class`, `pg_get_functiondef`). Was sich von
> hier aus nicht messen lässt, steht als solches da. Was schon in der
> Doku als bewusst markiert ist (Anon-Key öffentlich, Token im
> localStorage, Inline-Scripts in der CSP), ist ausgelassen.
>
> **Nichts davon ist repariert.** Das ist die Liste, nicht der Umbau.
> §G nennt die Reihenfolge, in der ich ihn angehen würde.

## Stand der Umsetzung (nachgeführt)

| Punkt | Stand | Wo |
|---|---|---|
| A2 · `social_posts.type` roh im `title`-Attribut | ✅ v32.66 — `escHtml`, Bild-Adresse durch `_gsSafeUrl` | `escape_check` Fall 1 |
| A3 · `escHtml` ohne `'` in `onclick`-Strings; Artendetail rendert `warning`/`lat`/`uses`/… roh | ✅ v32.66 — `escHtml` kennt `'`; `_gsOcStr` an den vier Stellen; zehn Felder im Artendetail escaped | `escape_check` Fälle 2–3 |
| A4 · Mitteilungs-Link ungeprüft in `location.href`/`window.open`; `sw.js` navigiert auf `data.url` | ✅ v32.66 — `_gsSafeLink` (eigener Ursprung oder https), `swSafeUrl` (nur eigener Ursprung) | `escape_check` Fälle 4–5 |
| A10 · HTML-Teil: KI-Ausgabe roh (Scan-Chat, Admin-Triage), `data-i18n-html`, Bild-URLs ohne Schema-Prüfung | ✅ v32.66 — `gsSanitizeHtml` (Allowlist), Triage escaped, `_gsSafeUrl` in Feed und „Meine Funde" | `escape_check` Fälle 6–7 |
| A10 · Server-Teil (fünf `includes()`-Vergleiche, `feedback-triage`, `ai-proxy`-CORS) | offen | §G 12 |
| B1 · `sbFetch` ohne zweites Argument stürzt vor dem `try` ab (Wetterwarnungen, Verkäufer-Status tot) | ✅ v32.67 — `opts = opts || {}` | `robust_check` Fall 1 |
| B5 · `gsToast` verwirft die Dauer (126 Aufrufer) | ✅ v32.67 — Dauer reist durch `showProfileToast` und die Warteschlange | `robust_check` Fall 2 |
| B6 · Escape schliesst alle Fenster | ✅ v32.67 — nur das oberste (zuletzt geöffnet, sonst höchster z-index) | `robust_check` Fall 3 |
| B3 · Service Worker aktiviert sich selbst (`skipWaiting` im Install) | ✅ v32.67 — wartet auf `SKIP_WAITING` vom Banner; Rückfall-Reload 4 s | `robust_check` Fall 4 · `offline_check` |
| A1 · globaler Anthropic-Schlüssel im Browser jedes Nutzers | ✅ v32.68 (App) — Proxy zuerst, Schlüssel nie mehr auf der Platte, Übergangs-Rückfall; ⏳ Migration `20260907_global_api_key_nur_proxy.sql` + `deploy ai-proxy` (Fernando, §8) | `schluessel_check` 10 Fälle |
| B4 · Versprechen ohne Prüfung (Plan löschen/umbenennen, Inserat, Scan, Feed-Opt-In, Push aus, Sammlungen, Lina) + `versprechen_check` blind für „gelöscht" | ✅ v32.69 — Meldung nach der Antwort, „nur lokal" bei Ablehnung; Prüfstand kennt die Stämme, Versprechen VOR dem Schreiben und die richtige Funktion (0 → 7 → 0 rot) | `versprechen_check`, `save_check` +2 |
| D1 · `github/` ohne Punkt | ✅ v32.69 — `.github/` | Workflow läuft ab jetzt |
| D2 · 28 Prüfstände ohne CI, Playwright über Cloud-Pfad | ✅ v32.69 — `scripts/package.json`, `scripts/pruefstaende.sh`, `.github/workflows/pruefstaende.yml` (Postgres-Service) | erster Lauf auf dem nächsten PR |
| D3 · Web-Root ist das Repo, 53 interne Dateien, kein `X-Robots-Tag` | ✅ v32.69 — 49 Dateien nach `docs/_archiv/`, `X-Robots-Tag: noindex` + `robots.txt` für docs/supabase/scripts/store; 404 ist auf Cloudflare Pages nicht erzwingbar | `_headers`, `robots.txt` |
| D4 · drei Versionsnummern (install/offline/App), Sitemap ohne lastmod | ✅ v32.69 (Versionsnummern raus aus install/offline) · lastmod offen (eine gepflegte Zahl wäre falsch, eine ungepflegte auch) | — |
| E2 · Lina antwortet immer Deutsch, nennt Tabs, die es nicht gibt | ✅ v32.70 — Sprache aus `gsI18n.getLang()` im Kontext; Wege über „Mehr" | `nutzersicht_check` Fall 3 |
| E3 · Menü-Zahlen um das Vier- bis Zehnfache daneben | ✅ v32.70 — aus der Artenliste gezählt (`_gsMenuSub`) | `nutzersicht_check` Fall 1 |
| E4 · „Was ist neu" verschluckt die fetten Labels | ✅ v32.70 — Dialog und Über-Liste rendern `bold` + `text` | `nutzersicht_check` Fall 2 |
| E5 · Entwickler-Jargon auf Nutzerseiten | ✅ v32.70 — „Cowork pg_cron", „Super-Agent", „24h-Lock", „Supabase nicht verfügbar" (×8), „gequeued", „anfaellig fuer" raus | `nutzersicht_check` Fall 4 |
| E8 · Kompakt + Senioren gleichzeitig; Menü-Emojis ohne `aria-hidden` | ✅ v32.70 (beides) · Einheiten-Abstand und „—"-Leerzustände offen | `nutzersicht_check` Fall 5 |
| A8 · CSP mit `unsafe-eval`, `worker-src` blockiert pdf.js-Worker, `frame-ancestors 'self'` | ✅ v32.71 — ohne `unsafe-eval`, cdnjs in `worker-src`, `'none'` + `X-Frame-Options: DENY` · pdf.js seit v32.79 nur bei Bedarf (kein Boot-Laden, kein Precache); selbst hosten braucht Netz zu cdnjs — von hier nicht möglich (kein Netz von hier) | `robust_check` Fall 5 |
| A9 · `ipapi.co` ohne Zustimmung, `client_errors` mit `user_id`, Analytics-Guard verkehrt, kein Consent-Dialog | ✅ v32.71 — IP-Ortung gestrichen; Fehlerberichte und Messung nur mit `_gsAnalyticsErlaubt()`; Über-Liste ehrlich · Consent-Dialog selbst offen (Entscheidung) | `robust_check` Fall 6 |
| B7 · Toasts ohne Live-Region | ✅ v32.71 (`role=status`, `aria-live=polite`) · Fokus in dynamischen Dialogen offen | `robust_check` Fall 7 |
| B9 · `gsRequireOnline` tot, 4'342er-Schleife ohne Leser | ✅ v32.71 · `type=number` ohne `max`, `plan-iterate`-Fehlerform, `plants.v1.js` im `<head>` offen | `robust_check` Fall 8 |
| C1 · `_gsNorm` und `gsIsAdmin` doppelt | ✅ v32.71 | `robust_check` Fall 8 |
| E7 · `install.html`-Versprechen | ✅ v32.71 | — |
| A10 · Server-Teil: fünf `includes()`-Vergleiche, `feedback-triage` für Experten, `ai-proxy` CORS `*.pages.dev` | ✅ v32.72 (Repo) — `_shared/auth_vergleich.mjs`, `is_admin` + UUID, nur `*.greenscan-app.pages.dev` · ⏳ Deploy (§9) | `robust_check` Fall 6 |
| B2 · 60/30 s Client gegen 14'000/8'000 Tokens Server, Plan trotzdem gespeichert | ✅ v32.72 (Repo) — Server 110 s Abbruch + 504 ohne Insert, Client 120 s + ehrliche Timeout-Meldung · ⏳ Deploy (§9) | `robust_check` Fall 7 |
| B9 · `plan-iterate` liefert `error` als String → „Unbekannter Fehler" | ✅ v32.72 — `_gsEdgeFehler` normalisiert | `robust_check` Fall 7 |
| C3 · 431 KB Changelog im Service Worker | ✅ v32.72 — `docs/_archiv/SW-CHANGELOG.md`, `sw.js` 21 KB · 0,8 MB Kommentare im Haupt-Script offen | `robust_check` Fall 5 |
| B8 · rohe Server-Fehler an Nutzer (`error.message` von PostgREST wörtlich, eigene Toasts mit 80 Zeichen Serverfehler) | ✅ v32.73 — `_gsFehlerText` an 39 Anzeige-Zeilen, `sbFetch` mit `status`, Profil-Anmeldung über `gsTranslateAuthError` | `robust_check` Fall 11 |
| A5 · alter Sensor-Assistent zeigt das Sitzungs-Token, rät zum Service-Role-Key | ✅ v32.74 — Wegweiser zu Messwerte, Alt-Geräte nur löschbar, Smart-Home-Dashboard aus dem Menü (live: 1 Alt-Gerät, 0 Messwerte) | `robust_check` Fall 12 |
| A6 · Admin-Passwort-Hash im öffentlichen HTML | ✅ v32.74 — `doAdminLogin` fragt `is_admin_user()`; Hash, Seed und `GS_ADMINS` (zwei private Adressen) weg; Spiegel `gs_is_admin` aus derselben RPC | `robust_check` Fall 13 |
| C4 · vier Push-Checker, zwölf Kopien derselben drei Helfer, `corsHeaders` achtmal | ✅ v32.75 — `_shared/push_helfer.mjs` (Client und web-push als Parameter), Adapter in vier Sendern, VAPID-Rückfall `info@greenscan.ch`; `feedback-triage` fragt `is_admin_user` statt E-Mail-Liste + `atob` · `corsHeaders`/README/`book-ingest` offen | `robust_check` Fall 14 |
| A7 · `species-search` ohne Authentifizierung, mit Service-Role, mit Schreibzugriff, CORS `*`, rohe Fehlertexte | ✅ v32.76 (Repo) — Bearer Pflicht + GoTrue-Prüfung, RPC mit Nutzer-Token, Cache nur nach gültiger Suche, Allowlist, `search_failed` statt Rohtext, q/lim gedeckelt · ⏳ Deploy (§9) | `robust_check` Fall 15 |
| C2 · 66 Funktionen ohne Aufrufer (nachgezählt: 105) | ✅ v32.77 — 114 entfernt (1790 Zeilen) mit Parser-Grenzen; `closeAbout` bleibt (dynamischer Name); der Scan ist jetzt ein Prüfstand-Deckel | `robust_check` Fall 16 |
| E1 · Rückmeldungen nur Deutsch (351 `gsToast`, 56 `gsConfirmModal`, 133 `placeholder`, 95 `aria-label`, 52 `MENU_ITEMS`, 56× `de-CH`) | ✅ v32.78 Welle 1 — Phrasen aus dem Quelltext an den Übersetzer, `placeholder`/`aria-label`/Menü per `tText`, `gsLocale()` statt 133× `de-CH` · Welle 2 offen: zusammengesetzte Meldungen, Monatsnamen-Listen, `toFixed()` · ⏳ Admin-Knopf (§11) | `i18n_check` Fragen 9–16 |
| E6 · Impressum ohne Rechtsträger/Adresse/UID, fester Monat als Stand, siezen, „Fotos nicht dauerhaft gespeichert“ | ✅ v32.79 (Client) — Stand/Version/Artenzahl dynamisch, du statt Sie, Fotos-/Nutzungsdaten-/Kontodaten-Sätze stimmen, Impressum nennt die Lücke · ⏳ Rechtsträger, Postadresse, UID: Fernando (§12) | `nutzersicht_check` Fall E6 |
| C5 | offen | §G |

## Zahlen zuerst

| Messgrösse | Wert |
|---|---|
| `index.html` | 92'971 Zeilen · 5.93 MB · davon 0.8 MB Kommentarzeilen im Haupt-Script (16 %) |
| `sw.js` | 450 KB · davon **431 KB Changelog-Kommentar** (Zeilen 1–346) · ausgeliefert mit `max-age=0` |
| Doppelt definierte globale Funktionen | 2 (`_gsNorm`, `gsIsAdmin`) |
| Funktionen ohne einen einzigen Aufrufer | 66 |
| Leere `catch`-Blöcke | 2'113 |
| Inline-`style=` in JS-gebautem HTML | 5'461 (+1'917 statisch) · 2'125 feste Hex-Farben im Script |
| `gsToast(`-Aufrufe / davon über die Sprachschicht | 351 / 6 |
| `gsConfirmModal`-Aufrufe / übersetzt | 56 / 4 |
| `toLocaleDateString('de-CH')` fest | 56 |
| CI-Workflows, die GitHub sieht | 0 (einer liegt in `github/` ohne Punkt) |
| Branches auf `origin` | 122 |
| Interne `.md`-Dateien im Web-Root | 53 (+1 `.bak`) — beide Hoster liefern sie aus |
| Prüfstände, die Playwright über einen festen Pfad dieser Cloud-Umgebung laden | 20 von 28 |
| Versionsnummern auf drei Seiten | v32.64 (App) · v24.13 (`install.html`) · v30.79 (`offline.html`) |

## A · Sicherheit und Datenschutz

Nach Schwere. Alles hier ist im Quelltext nachgesehen.

**A1 · Der globale Anthropic-Schlüssel liegt im Browser jedes angemeldeten
Nutzers.** `fn_get_global_api_key` (live gelesen) gibt den echten
`sk-ant-`-Schlüssel an **jeden** Nutzer mit `auth.uid()`, der nicht gesperrt
ist. Die App schreibt ihn nach `localStorage.gs_global_api_key`
(`index.html:29795`) und ruft Anthropic direkt aus dem Browser
(`:30062`, Header `anthropic-dangerous-direct-browser-access`). Der
Server-Proxy `ai-proxy` existiert, ist aber hinter
`localStorage.gs_feat_aiproxy === '1'` versteckt — Vorgabe aus (`:30053`).
Jeder Nutzer, jede Browser-Erweiterung und jeder XSS-Fund weiter unten kann
den Schlüssel lesen und auf Fernandos Rechnung nutzen. CLAUDE.md §3.6
verbietet genau das („pack ihn hinter einen Server-Proxy").

**A2 · Stored XSS im Community-Feed.** `index.html:40259` schreibt
`p.type` ungeprüft in ein `title="…"`-Attribut; alle Nachbarfelder sind
escaped, dieses nicht. `social_posts.type` hat in keiner Migration eine
Check-Constraint, RLS prüft nur `user_id`. Ein angemeldeter Nutzer kann
per `POST /rest/v1/social_posts` ein `type` mit `" onmouseover="…"` setzen
und bekommt Skript-Ausführung bei jedem, der den Feed öffnet.

**A3 · `escHtml` escaped kein `'`, wird aber in einfach zitierte
`onclick`-Strings eingesetzt.** `index.html:36522` (die Funktion) und
`:36022`, `:36037`, `:44697`, `:51227` (die Verwendung:
`onclick="openDetailChat('…','+escHtml(sp.name)+'…")`). Ein Apostroph im
Namen beendet den JS-String. Das Repo hat zwei richtige Helfer für genau
diesen Fall (`gsHTMLEscape` `:36527`, `_gsOcArg` `:36526`), sie werden
hier nicht benutzt. Erreichbar wird es über Community-Arten:
`gsMergeCommunitySpecies` (`:24438`) schiebt Zeilen aus `species` in
dieselbe `DB`, und `openDetail` rendert `sp.warning`, `sp.lat`,
`sp.medicinalUse`, `sp.care` roh (`:35857`, `:35909`, `:35977`, `:35983`).

**A4 · Ein Link aus einer Benachrichtigung landet ungeprüft in
`location.href` und `window.open`.** `index.html:26538` und `:26522`: kein
Schema-Allowlist, `javascript:` geht durch. Direkt ist das Self-XSS
(eigene Zeilen), aber drei `SECURITY DEFINER`-Trigger schreiben `link` für
andere Nutzer. Dasselbe im Service Worker: `sw.js:754–764` navigiert einen
offenen Tab auf `event.notification.data.url` ohne jede Prüfung — wer
pushen kann, kann den vertrauten App-Tab auf eine fremde Seite lenken.

**A5 · Der alte Sensor-Assistent zeigt das Sitzungs-Token und rät zum
Service-Role-Key.** `index.html:71960–71984` (`gsDevShowSensorCode`),
automatisch nach dem Anlegen eines Geräts aufgerufen (`:71951`): `curl`
mit `Authorization: Bearer <JWT des Nutzers>` zum Kopieren, Arduino-Code
mit dem Anon-Key, und der Hinweis „nutze die Service-Role-Key". Bekannt
seit §11 Idee 1 und bisher an Fernandos Entscheid gebunden — **seit v32.62
gibt es den richtigen Weg** (Koppeln mit Geräte-Token). Der alte Assistent
(`📶 Sensoren & Geräte`, `MENU_ITEMS :54814`) sollte jetzt auf „Messwerte"
umgeleitet oder entfernt werden.

**A6 · Admin-Passwort-Hash im öffentlichen HTML.** `index.html:73401`:
ein unsalted SHA-256, mit dem der Client-Admin-Gate vergleicht (`:73476`).
Die Datenbank ist getrennt über `is_admin_user()` geschützt — das
Admin-Panel und seine RPC-Oberfläche öffnen sich aber nach einem
Client-Vergleich. Für eine GPU ist ein unsalted SHA-256 eines von Menschen
gewählten Passworts kein Hindernis.

**A7 · `species-search` ohne Authentifizierung, mit Service-Role, mit
Schreibzugriff.** `supabase/functions/species-search/index.ts`: kein
`Authorization`-Check, `Access-Control-Allow-Origin: *`, jede Anfrage läuft
mit `SUPABASE_SERVICE_ROLE_KEY` und **schreibt** in `species_search_cache`
(`:75`); rohe PostgREST-Fehlertexte gehen an anonyme Aufrufer (`:84`). Ob
das Gateway `verify_jwt` erzwingt, steht nicht im Repo — von hier nicht
messbar.

**A8 · CSP.** `_headers:14`: `'unsafe-eval'` ist erlaubt, aber
`index.html` enthält kein `eval(` und kein `new Function(` (0 Treffer) —
reine Angriffsfläche. `worker-src 'self' blob:` blockiert den pdf.js-Worker
von `cdnjs` (`index.html:90783`), der still auf den Hauptthread
zurückfällt; das dynamische `import()` desselben Moduls (`:90782`) hat
keine Integritätsprüfung — und es ist die letzte CDN-Abhängigkeit, die
CLAUDE.md §3.8 ausschliesst. `frame-ancestors 'self'`, während CLAUDE.md
§3.6 das Token-Risiko mit `'none'` begründet. Stripe-Hosts in `connect-src`
und `frame-src`, die kein Code je anspricht.

**A9 · Personendaten ohne Zustimmung.** `index.html:24047` schickt bei
verweigertem GPS die IP an `ipapi.co` („ohne Permission", sagt der
Kommentar). `:2528` schickt Fehlerberichte mit `user_id` nach
`client_errors`. Der Analytics-Guard (`:85607`) ist verkehrt gebaut —
`=== false` statt `=== true` — und `gs_consent` wird nirgends gelesen; es
gibt **keinen** Consent-Dialog, obwohl CLAUDE.md §3.7 und die
Über-Liste (`:7497`) einen behaupten. Heute rettet nur, dass
`gsTrackEvent` keinen Aufrufer hat.

**A10 · Edge-Functions.** Fünf Funktionen prüfen den Service-Key mit
`includes()` statt konstantzeitig (`key-health-check:30`,
`daily-push-checker:306`, `engagement-push-checker:104`, `sensor-push:71`,
`weather-alert-checker:317`) — `send-push` hat den richtigen Vergleich
längst. `feedback-triage:121–128` macht jeden `is_expert` zum Admin und
setzt `body.id` ungeprüft in einen PostgREST-Filter (`:147`).
`ai-proxy:32` lässt jede `*.pages.dev`-Herkunft zu. KI-Ausgaben werden roh
ins HTML gesetzt: Scan-Chat (`index.html:34670`, `isHtml=true`),
Admin-Triage (`:74258–74260`), i18n-Zeilen mit `data-i18n-html`
(`:14245`). Bild-URLs aus Serverzeilen ohne Schema-Prüfung (`:55780`
Karte, `:40269` Feed) — ein Tracking-Pixel je Betrachter.

**Kein Loch (nachgemessen):** `v_admin_users` und `v_admin_subscriptions`
haben live `security_invoker=on`. Alle 162 `SECURITY DEFINER`-Funktionen
setzen `search_path`. Keine Schreib-Policy mit `true` ausser für
`service_role`. Keine Secrets im Repo. Der Stripe-Webhook prüft Signatur
und Replay.

## B · Robustheit — was Nutzer als Fehler erleben

**B1 · Zwei Funktionen sind seit jeher tot, weil `sbFetch` ohne zweites
Argument abstürzt.** `index.html:76192` liest `opts.headers` **vor** dem
`try`; `:85403` (Wetterwarnungen-Panel) und `:29533` (Verkäuferstatus im
Marktplatz) rufen mit einem Argument. Ergebnis: das Panel zeigt immer
„Konnte Warnungen nicht laden", ein verbundener Stripe-Verkäufer sieht
immer „Verkäufer-Konto verbinden". Beide Aufrufer schlucken den Fehler.

**B2 · KI-Garten-Scan: 60 s Client-Timeout gegen 14'000 Tokens auf dem
Server, der den Plan trotzdem speichert.** `index.html:66731` bricht nach
60 s ab; `garden-scan-analyze/index.ts:312` rechnet bis 14'000 Tokens ohne
Abbruch und fügt in `garden_plans` ein (`:343`). Der Nutzer sieht
„Zeitüberschreitung", der Plan entsteht trotzdem, der zweite Versuch kostet
noch einmal und hinterlässt ein Duplikat. Dasselbe bei `plan-iterate`
(30 s gegen 8'000 Tokens, `:68958` / `index.ts:111`).

**B3 · Der Service Worker aktiviert sich selbst und löscht die Caches
unter der laufenden Seite.** `sw.js:527` `skipWaiting()` im `install`,
`:543` `clients.claim()` nach `caches.delete()` aller alten Caches. Der
Update-Banner (`index.html:77909`) fragt danach um Erlaubnis für etwas,
das schon passiert ist; jede spätere Nachladung der alten Seite
(`data/releases.v1.js`, Shell-Dateien) geht ins Netz und scheitert offline.

**B4 · Versprechen ohne Prüfung, die `versprechen_check` nicht sieht.**
„Der Plan wird auf allen deinen Geräten entfernt" (`:70938`), dann drei
ungeprüfte Aufrufe und „🗑 Plan gelöscht" (`:70960–70979`); gleich beim
Umbenennen (`:71001–71014`). „Inserat gelöscht" **vor** einem
nicht abgewarteten DELETE (`:18766–18768`). „gespeichert!" vor dem
`user_scans`-Schreiben (`:32616–32623`) — mit dem Kommentar darüber, dass
genau dieser Aufruf einmal eine ganze Versionsreihe lang still scheiterte.
Push-Einstellungen, die der Server durchsetzt, ohne Rückmeldung
(`:85190`); „Push deaktiviert" ohne Prüfung (`:85152`); Sammlungen löschen
ohne jede Rückmeldung (`:9649`, `:9678`); Linas Nachrichten ohne
Bestätigung (`:84722`). Alle `.catch()` daran sind tot — `sbFetch` wirft
nicht. **Der Prüfstand meldet 0 rot**, weil er Wortstämme sucht, die hier
nicht vorkommen: er braucht „gelöscht", „entfernt", „deaktiviert".

**B5 · `gsToast(msg, type)` — 60 Aufrufe geben eine Dauer mit, die
verworfen wird.** `index.html:17180`, `:77555`; jede Meldung dauert 3,5 s,
auch die mit 230 Zeichen und angehängtem Server-Fehler (`:27210`). Etliche
davon habe ich selbst geschrieben.

**B6 · Escape schliesst alle Fenster, nicht das oberste.** `:25838`
iteriert alle offenen Modale; das `return` verlässt nur den Callback.
`openModal` unterstützt Stapel ausdrücklich (`:25673`).

**B7 · Toasts haben keine Live-Region** (`:77637`, kein `role="status"`,
kein `aria-live`) — 352 Meldungen sind für Screenreader stumm.
`gsRegisterOverlay` (`:25752`) verwaltet keinen Fokus, ~25 dynamische
Dialoge inklusive Konto-Löschen ohne `role="dialog"`. Keine `<form>`, kein
`required`, kein `aria-invalid` in der ganzen Datei (239 `<input>`).

**B8 · Rohe Server-Fehler an Nutzer.** `:44419`, `:80707`, `:72016`,
`:74594`, `:75945` und andere zeigen `error.message` von PostgREST
wörtlich („new row violates row-level security policy for table …"). Auch
meine eigenen Toasts seit v32.62 hängen bis 80 Zeichen Serverfehler an.

**B9 · Kleinere.** `gsRequireOnline` (`:17190`), der „zentrale
Offline-Guard", hat null Aufrufer. Ein toter 4'342-Schritte-Loop im
Start-Pfad (`:54957–54965`, `hasDupes` wird nie gelesen). 32 von 36
`type="number"` ohne `max` (Pflege-Stunden pro Woche akzeptieren 500).
`plan-iterate` liefert `error` als String, der Client liest
`error.message` → immer „Unbekannter Fehler" (`index.ts:119`,
`index.html:68987`). `data/plants.v1.js` (2 MB) blockiert synchron im
`<head>` (`:2349`, bekannt und kommentiert).

## C · Code-Hygiene

**C1 · `_gsNorm` ist zweimal global definiert** (`:23063`, `:63872`), im
selben Skript, mit anderer Rechnung (Leerzeichen raus / `ö→o` gegen
Leerzeichen bleiben / `ö→oe`). Nur die zweite gilt. Zwölf Aufrufer des
Pilz-Registers (`:16582`, `:16624`, `:23167`, `:42445`, `:42743` …) wurden
gegen die erste geschrieben; sie laufen seit dem Planer-Einbau auf der
anderen. Beide Seiten einer Suche nutzen dieselbe Funktion, deshalb fällt
es nicht auf — die Längenschwellen (`>= 4`, `>= 5`) meinen aber die alte
Form. `gsIsAdmin` ebenso doppelt (`:75750` Stub, `:85710` echt).

**C2 · 66 Funktionen ohne Aufrufer.** Darunter ganze Wege: zwei
Magic-Link-Sender (`sbSendMagicLink :76939` tot, `sbMagicLink :77287`
lebt), `gsHandleMagicLinkCallback`, `gsFlipCamera`, `switchCamera`,
`openGardenScanner`, `gsRequireOnline`. Drei Prüfstände sichern tote
Funktionen ab (`gsIsStaff`, `gsIsVerifiedExpert`, `gsResetZoom`) — grün
für Code, den die App nie ruft.

**C3 · Ballast, den jedes Gerät lädt.** 431 KB Changelog im Service
Worker (ein drittes Changelog neben `GS_RELEASES` und
`data/releases.v1.js`), 0.8 MB Kommentarzeilen im Haupt-Script.

**C4 · Vier Push-Checker, zwölf Kopien derselben drei Helfer**
(`loadSettings`, `sendPush`, `zurichHour`), schon in drei Varianten
auseinandergelaufen; `corsHeaders` achtmal. `supabase/functions/_shared/`
existiert und enthält nur die zwei Regel-Module vom 05./06.09.
38 von 42 Functions ohne README; `book-ingest/` hat kein `index.ts`.

**C5 · Stil.** 2'113 leere `catch`, 5'461 Inline-Styles in JS-HTML,
2'125 feste Hex-Farben im Script gegen 162 definierte Variablen (die
13'690-mal benutzt werden). `console.warn` ist in Produktion stillgelegt
(`:2472`) — 223 Warnungen, die nie jemand sieht.

## D · Repo und Betrieb

**D1 · `github/workflows/weekly-cleanup.yml` — ohne Punkt, seit v24.51.**
GitHub Actions hat ihn nie gesehen. Der Workflow sollte gemergte Branches
nach 14 Tagen löschen; `origin` hat 122.

**D2 · 28 Prüfstände, kein CI.** 20 laden Playwright über
`/opt/node22/lib/node_modules/playwright`, einen Pfad dieser
Cloud-Umgebung. `.gitignore:33` verbietet `package.json` im Root bewusst
(Cloudflare würde bauen) — in `scripts/` wäre eines möglich.

**D3 · Der Web-Root ist das Repo.** 53 interne Audit- und
Auftragsdateien, `_archiv/AUFTRAG_v25.33_FERNANDO_BUGS.md.bak`, `supabase/`
(8.5 MB), `scripts/`, `docs/`, `store/` werden von Cloudflare und Netlify
ausgeliefert; `robots.txt` erlaubt Google alles, `_headers` setzt kein
`X-Robots-Tag`. Ob Google sie indexiert hat, ist von hier nicht messbar.

**D4 · Drei Versionsnummern.** `install.html:67/188` v24.13,
`offline.html:53` v30.79, App v32.64. `sitemap.xml` ohne `lastmod`.

## E · Nutzersicht

**E1 · Die App spricht in vier Sprachen — die Rückmeldungen nur Deutsch.**
351 `gsToast`, 6 über die Sprachschicht; 56 `gsConfirmModal`, 4 übersetzt;
133 statische deutsche `placeholder`; 95 deutsche `aria-label`; alle 52
`MENU_ITEMS` (`:54777–54858`) mit deutschem `label`/`sub`, die Menü-Suche
zeigt sie roh. 56 × `toLocaleDateString('de-CH')`, 25 feste
Monatsnamen-Listen, `['Mo','Di',…]`, 135 × `toFixed()` ohne
Dezimaltrenner nach Sprache.

**E2 · Lina.** `LINA_SYSTEM :84523` „Du antwortest auf Deutsch" — für
jede App-Sprache. Und sie verweist auf Tabs „Garten", „Saison", „Suche",
„Karte", „Marktplatz" (`:84533–84540`); die Leiste hat Scanner, Pflanzen,
Home, Community, Mehr.

**E3 · Falsche Zahlen im Menü.** `MENU_ITEMS :54822–54826`:
„252 Arten" Wildpflanzen (es sind 2'226), Pilze 205 (641), Kräuter 184
(388), Bäume 159 (431), Hauspflanzen 70 (286). Die App nennt daneben
„Alle 4342 Arten" und „über 4300 Arten".

**E4 · „Was ist neu" verschluckt die fetten Labels.** `:79702`
`_e(it.text || (it.bold ? …))` — `bold` fällt weg, sobald `text` da ist,
und das ist immer; jeder Eintrag beginnt mit Leerzeichen mitten im Satz.
Dasselbe in der Über-Liste (`:75614`). 87 von 446 archivierten Einträgen
haben keine `user_summary`, dann steht Entwicklerprosa da.

**E5 · Entwickler-Jargon auf Nutzerseiten.** „Cowork pg_cron erweitert
die DB taeglich" (`:69909`), „Supabase nicht verfügbar" (`:43544`,
`:67208`), „Neue Einträge werden gequeued" (`offline.html:43`),
„Super-Agent mit Ernte-Prognose", „24h-Lock". Umlaut-Tippfehler
„anfaellig fuer" (`:69873`).

**E6 · Rechtliches.** Impressum (`:87339–87348`) ohne Rechtsträger, ohne
Postadresse, ohne UID — für ein Abo-Angebot (CHF 3.90/7.90) verlangt UWG
Art. 3 Abs. 1 lit. s klare Angaben zur Identität und Kontaktadresse.
Rechtstexte „Stand März 2026", „App-Version: März 2026" (`:87294`,
`:87308`, `:87345`). Die App duzt, die Rechtstexte siezen (`:87322`,
`:87326`). Datenschutz sagt „Pflanzenfotos nicht dauerhaft gespeichert"
(`:87313`) neben dem Community-Foto-Weg, der sie veröffentlicht (`:20968`).

**E7 · `install.html`** verspricht iCloud-Sync (`:154`, es gibt keinen),
„1000 % flüssiger", „100 % Offline-fähig" neben „Scanner und Chat brauchen
Internet", „Vier Sprachen inklusive Schweizerdeutsch" (es sind fünf, ohne
Mundart), und `kontakt@greenscan.ch` statt `info@greenscan.ch`.

**E8 · Kleineres.** Kompakt-Ansicht und Senioren-Modus lassen sich
gleichzeitig einschalten (`:6431`, `:6443`). Einheiten-Abstand uneinheitlich
(`humid + '%'` gegen `pct + ' %'`). 52 von 52 Menü-Labels beginnen mit
Emoji, als blosses `<span>` ohne `aria-hidden` — der Screenreader liest
„stethoscope Pflanzendoktor". Leere Zustände, die nur „—" zeigen
(`:68687`, `:68705`, `:68732`).

## F · Was gut ist (damit die Liste fair bleibt)

Die Tab-Leiste (SVG, `role="tab"`, `aria-selected`, übersetzt).
`manifest.json` und der `<head>` (maskable Icons, Screenshots, Shortcuts,
Splash für 11 Geräte, alle Dateien vorhanden). `_gsApiFetch` mit
AbortController, Retry nur bei 429/5xx, `Retry-After`, Jitter, Modell-
Fallback. `gsConfirmModal` (Fokus, Trap, Escape, Enter bestätigt nie
Zerstörendes). `prefers-reduced-motion` als Blanket-Regel mit `!important`.
Der Service Worker umgeht `addAll` bewusst und deckelt den Bild-Cache.
`sbLogin` mit echter Fehlertaxonomie. Kein Lorem, keine erfundenen
Bewertungen. Stripe-Webhook mit Signatur und Replay-Schutz. RLS-Schreibseite
dicht, `search_path` überall gesetzt.

## G · In welcher Reihenfolge ich es angehen würde

| # | Was | Aufwand | Braucht Fernando |
|---|---|---|---|
| 1 | A1: `ai-proxy` ausliefern, Flag `gs_feat_aiproxy` auf Vorgabe **an**, `fn_get_global_api_key` auf eine Prüfung reduzieren, Schlüssel nie mehr an den Client | mittel | Deploy + Migration |
| 2 | A2–A4, A10 (HTML-Teil): Escapes, Schema-Allowlist für Links und Bild-URLs, `_gsOcArg` an den vier `onclick`-Stellen, SW-URL nur same-origin | klein | nein |
| 3 | A5: alten Sensor-Assistenten auf „Messwerte" umleiten | klein | Entscheid (Idee 1) |
| 4 | B1, B5, B6, B3: `opts = opts || {}` in `sbFetch`, Toast-Dauer durchreichen, Escape nur oberstes Fenster, `skipWaiting` nur auf Befehl des Banners | klein | nein |
| 5 | B4 + `versprechen_check` um „gelöscht/entfernt/deaktiviert" erweitern, dann die Stellen mit `_gsSchreibOk` | mittel | nein |
| 6 | D1, D2, D3: `git mv github .github`, `scripts/package.json` + Workflow, der die Prüfstände auf jedem PR fährt; interne Dateien nach `docs/_archiv/` und `X-Robots-Tag: noindex` + `robots.txt` für `/docs/`, `/supabase/`, `/scripts/` | klein | nein |
| 7 | B2: Server-Timeout in `garden-scan-analyze`/`plan-iterate` mit `AbortSignal`, Client wartet so lange wie der Server, Plan nur einmal | mittel | Deploy |
| 8 | E3, E4, D4, E5: Zähler aus der Datenbank rechnen, `bold` rendern, Versionen aus einer Quelle, Jargon raus | klein | nein |
| 9 | E2: Lina in der App-Sprache, richtige Tab-Namen im Prompt | klein | nein |
| 10 | E1: Toasts, Modale, Platzhalter, Menü-Liste durch die Sprachschicht — die grösste Baustelle | gross | nein |
| 11 | E6: Impressum mit Rechtsträger und Adresse, Rechtstexte datieren | klein | Angaben von Fernando |
| 12 | A8, A9, A10 (Server-Teil): CSP straffen, `ipapi.co` hinter eine Frage, Consent wirklich bauen, fünf Vergleiche konstantzeitig, `feedback-triage` nur Admin | mittel | Deploy |
| 13 | C1–C4: `_gsNorm` eine Definition, tote Funktionen raus, Changelog aus `sw.js`, Push-Helfer nach `_shared/` | mittel | Deploy für die Functions |

Nicht messbar von hier: ob `species-search` am Gateway `verify_jwt` hat,
ob Google die internen Dateien indexiert hat, und wie sich B2 auf der
Rechnung zeigt. Alles andere steht mit Zeilennummer da und lässt sich
nachschlagen.
