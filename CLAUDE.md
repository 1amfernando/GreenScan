# CLAUDE.md — Onboarding für AI-Agenten in GreenScan

> Dieses Dokument ist die Eintritts-Datei für **jede AI-Session** (Claude Code,
> Cursor, externe Agenten) in diesem Repo. **Lies es zuerst, bevor du Code
> editierst.** Es gehört zusammen mit `STATUS.md` (operativer Snapshot) und
> `ROADMAP.md` (Meilensteine).

## 1 · Was ist GreenScan?

Schweizer PWA für Naturbestimmung — 4'342 Arten (Pflanzen, Pilze, Bäume,
Kräuter, Moose, Flechten, Algen). Live unter `https://green-scan.ch/` (kanonisch MIT Bindestrich; `greenscan.ch` ohne Bindestrich ist nur die Mail-Domain). Hosting:
**Cloudflare Pages** (`greenscan-app`) — und **zusätzlich Netlify**
(`green-scanswitzerland`), siehe §2.1. Backend: **Supabase** (Auth, Storage,
Postgres mit RLS).
KI: **Claude (Anthropic)** — User bringt eigenen API-Key oder Admin hinterlegt
einen globalen Key in Supabase (`fn_get_global_api_key` RPC).

Keine Build-Pipeline, kein npm. Reine statische Files. Editieren = direkt
deployen, sobald der Hoster den Branch zieht.

### 2.1 · Zwei Hoster — was das bedeutet (Stand v31.08)

An jedem PR bauen **beide**: Cloudflare Pages (`greenscan-app`) und Netlify
(`green-scanswitzerland`). Das war bis v31.08 nirgends dokumentiert, obwohl es
für jede Änderung an Auslieferungs-Dateien wichtig ist.

**Konsistent, weil bewusst so gebaut** — geprüft, nicht vermutet:

- **Keine `netlify.toml`, keine Wrangler-/Pages-Konfiguration.** Beide liefern
  schlicht das Repo-Wurzelverzeichnis als statische Dateien aus.
- **`_headers` gilt auf beiden.** Netlify wertet dieselbe Datei aus — CSP,
  HSTS, COOP und Permissions-Policy greifen also überall gleich.
- **`_redirects` gilt auf beiden.** Die Datei sagt es sogar selbst:
  „Format identisch zu Netlify".
- **`<link rel="canonical" href="https://green-scan.ch/">`** steht in
  `index.html:11` (seit v29.23). Suchmaschinen bekommen dadurch unabhängig vom
  ausliefernden Host dieselbe kanonische Adresse — kein Duplicate-Content.

**Was beim Arbeiten zu beachten ist:**

- Eine Änderung an `_headers` oder `_redirects` wirkt auf **beiden** Hostern.
  Nie annehmen, es gebe nur Cloudflare-Semantik.
- `manifest.json` nutzt relative `start_url`/`scope` (`/?source=pwa`, `/`).
  Wer die PWA von der Netlify-Adresse installiert, bekommt eine **eigene**
  Instanz mit **eigenem** localStorage — andere Herkunft, andere Daten. Für
  Support-Fälle relevant: „meine Pflanzen sind weg" kann schlicht die falsche
  Adresse sein.
- Der Anon-Key ist öffentlich by design und die Daten sind über RLS geschützt;
  eine zweite Auslieferung ist deshalb **kein** Datenrisiko.

**Nicht verifiziert:** ob `green-scanswitzerland.netlify.app` tatsächlich
öffentlich erreichbar ist oder nur Deploy-Previews baut. Die Netzwerk-Richtlinie
der Claude-Cloud-Umgebung blockiert ausgehende Verbindungen dorthin
(`CONNECT … 403`). Wer es prüfen kann: einmal aufrufen und hier eintragen —
und dann entscheiden, ob die zweite Auslieferung bleiben soll.

## 2 · Repo-Struktur

```
GreenScan/
├── index.html           # ~82k Zeilen Monolith (HTML + CSS + JS) — DIE App
├── data/plants.v1.js    # Arten-DB (~2.1 MB, 4'342 Arten) — separat gecacht
├── sw.js                # Service Worker (Cache-Version gs-vXX: Cache, Share-Target, Push)
├── supabase/functions/  # ~30 Edge-Functions (Scan/Pilz/Schädling/Stripe/Push/i18n …)
├── supabase/migrations/ # 195 SQL-Migrationen (alle idempotent)
├── manifest.json        # PWA-Manifest (share_target, file_handlers, etc.)
├── _headers             # Cloudflare Edge: CSP, HSTS, COOP, Permissions-Policy
├── _redirects           # Friendly URLs + SPA-Fallback
├── install.html         # Marketing-Landingpage für PWA-Installation
├── offline.html         # SW-Fallback bei kompletter Offline-Situation
├── sitemap.xml, robots.txt
├── icons/               # PWA-Icons (192/512, maskable, svg)
├── CLAUDE.md            # ← diese Datei
├── STATUS.md            # Aktueller Stand (was läuft, was nicht)
└── ROADMAP.md           # Priorisierte Meilensteine
```

## 3 · Konventionen

### 3.1 · Versionierung
- Versions-Format: `vMAJOR.MINOR` (z.B. `v30.79`). Aktuell: siehe `GS_VERSION`
  in `index.html` und `CACHE_VERSION` in `sw.js`. Bei Bumps **immer beide
  syncen** + `meta name="app-version"` im `<head>`.
- Commit-Message-Format: `vXX.YY: <kurze Aussage>` + Markdown-Body mit
  Bullets pro Bereich (Sicherheit / UX / Feature). Beispiel siehe letzte
  Commits auf `main`.
- **Pflicht bei jedem Bump: ein neuer Eintrag ganz oben in `GS_RELEASES`**
  (`index.html`, gesucht mit `grep -n "window.GS_RELEASES = \["`). Der
  „Was ist neu"-Dialog und der Über-Modal-Changelog lesen ausschliesslich
  diese Liste. Seit v31.13 prüft der Dialog, ob `GS_RELEASES[0].v` der
  laufenden `GS_VERSION` entspricht, und **bleibt sonst aus** — vergisst
  du den Eintrag, sehen die Nutzer gar keine Release-Notizen mehr.
  *Warum die Prüfung existiert:* zwischen v30.04 und v31.12 wurde die
  Liste nicht gepflegt. Über hundert Updates lang zeigte der Dialog die
  Notizen von v30.03 unter der jeweils neuen Versionsnummer.
  Felder: `v`, `date`, `headline`, `summary`, optional `user_summary` /
  `user_items` (werden bevorzugt gerendert). **Reiner Fliesstext** — die
  Werte werden beim Rendern escaped, Markup in den Strings wirkt nicht.

### 3.2 · Branches
- `main` ist Produktion. NIE direkt darauf pushen.
- Feature/Audit-Branches: `claude/<thema>-<id>` (von Claude-Cloud-Sessions
  automatisch vergeben). Lokale Sessions: bitte gleichnamiges Schema.
- PR-basierter Merge ist Pflicht.

### 3.3 · Single Source of Truth pro Domäne
| Domäne | Quelle | Niemals direkt mutieren |
|---|---|---|
| User-Standort | `localStorage.gs_user_location` | globale Var `userLocation` (legacy alias) |
| Auth-Token | `localStorage.gs_sb_token` | nicht in Code zwischenspeichern |
| User-Plan/Tier | Supabase `v_user_entitlements` | NICHT auf `localStorage` für Server-Decisions vertrauen |
| KI-Modell | `localStorage.gs_claude_model` | wird auto-bestimmt durch Fallback-Chain |
| Lina-Gedächtnis | Supabase `coach_conversations` / `coach_messages` | (gsBrain/`gs_brain_memory` ENTFERNT — siehe §4) |

### 3.4 · KI-Calls
**IMMER** über `callAI(messages, systemPrompt, maxTokens, opts)` oder
`callVisionAI(b64, mediaType, prompt, extraImages, opts)` gehen.
- `opts.brain = 'gaertner' | 'phytopathologe' | 'mykologe' | 'botaniker' | 'dendrologe' | 'herbalist' | 'generalist'`
  → injectet automatisch Persona + User-Kontext.
- Direkte `fetch('https://api.anthropic.com/...')` Calls nur in `gsTestApiKey()`
  (Key-Validierung).

### 3.5 · Daten-Speicherung
- Lokal: `localStorage` mit `safeGetItem(key, fallback)` Wrapper benutzen.
  Quota-Errors werden geschluckt — bei großen Listen (Ernte-Log,
  Scan-History) selbst rotieren (`slice(-N)`).
- Cloud: `sbFetch(path, opts)` — hat Auto-Retry/Backoff für GET, einmaliges
  Retry für POST/PATCH/DELETE bei Netzwerk-Errors. Liefert
  `{data, error: {message, status?}}`.

### 3.6 · Sicherheit (Pflicht!)
- **NIE** API-Keys, Secrets, Tokens hardcoden. NVIDIA-Demo-Key war geleakt
  (jetzt entfernt + Migration-Hook). Wenn du je einen Demo-Key brauchst,
  pack ihn hinter einen Server-Proxy.
- **CSP** ist aktiv (siehe `_headers`). Wenn du externe URLs einbaust,
  Allowlist erweitern. Inline-Scripts sind erlaubt, weil Monolith.
- **innerHTML mit User-Input**: NIEMALS ungeprüft. Nutze `gsEscHtml(s)` zum
  HTML-Escapen einzelner Werte, `gsSanitize(s)` für ganze Fragmente:
  ```js
  el.innerHTML = '<div>' + gsEscHtml(userName) + ' sagt: ' + gsEscHtml(msg) + '</div>';
  ```
  Für reine Text-Inserts `textContent` bevorzugen. Für KI-Plan-Objekte:
  `gsSanitizeGardenPlan` / `gsSanitizePlannerPlan`.
- **localStorage für Auth**: bewusst akzeptiert, weil mit CSP
  `frame-ancestors 'none'` + `strict-origin-when-cross-origin` Risiko klein
  ist. JWT-Migration in HttpOnly-Cookies ist Roadmap-Punkt P2.

### 3.7 · revDSG (Schweizer Datenschutz)
- Analytics ist **Opt-In** (Consent-Banner beim ersten Launch). Niemals
  ohne User-Consent in `analytics_events` schreiben. Check via:
  `gs_consent.analytics === true ODER gs_prefs.privacy.analytics === true`.
- Daten landen in Supabase EU-Region. Datenschutz-Erklärung verlinkt im
  Footer-Modal.

### 3.8 · Code-Style
- Vanilla JS, ES6+. Kein TypeScript, kein React. Keine externen Libs außer
  **Leaflet** (Karte) und **pdf.js** (Plan-Export).
- Defensive try/catch um nicht-essenzielle Operations (z.B. localStorage,
  Notifications). User darf nie wegen einer Sub-Funktion ein Crash sehen.
- Funktions-Prefixes:
  - `gs*` — Public/Helper im GreenScan-Namespace
  - `_gs*` — Privat, intern
  - `sb*` — Supabase-Layer
  - `dq*` — Daily-Quiz-Layer

## 4 · gsBrain — ENTFERNT (Stand v28.75, ehemals „Gehirn" der App)

> ⚠️ **VERALTET:** `gsBrain` ist in der aktuellen Codebasis **NICHT mehr definiert**
> (keine `window.gsBrain = …`-Definition, kein `gs_brain_memory`-Key, keine
> `observe`/`recommend`/`dailyTip`-Methoden). Es existieren nur noch ~31 historische
> `gsBrain.observe(...)`-Aufrufe — ALLE per `if (typeof gsBrain !== 'undefined' && …)`
> geschützt → harmlose **No-Ops**. Verlasse dich NICHT auf gsBrain; rufe es nicht neu auf.
>
> **KI-Kontext heute:** `callAI(messages, systemPrompt, maxTokens, opts)` /
> `callVisionAI(...)` direkt (siehe §3.4). Linas Gedächtnis = Supabase-Tabellen
> `coach_conversations` + `coach_messages` (RLS own-only, **geräteübergreifend**;
> `gsOpenLina` lädt die letzte Konversation aus der Cloud, `gsLinaSend` persistiert).
> Pflanzen-/Garten-Kontext kommt aus `myPlants`/`gardens` (bereits cloud-synced).
>
> Die historischen No-Op-`gsBrain.observe`-Call-Sites können bei Gelegenheit
> ersatzlos entfernt werden (reine Hygiene, kein funktionaler Effekt).

## 5 · Multi-Agent-Sync

Mehrere Sessions arbeiten parallel an diesem Repo. Damit kein Knoten platzt:

### Vor dem Edit
1. `git fetch && git status` — sind du auf dem aktuellsten Branch?
2. `STATUS.md` öffnen — was ist gerade in Arbeit, was ist offen?
3. Wenn unklar: zuerst kurze Notiz unter „In Progress" in `STATUS.md`
   schreiben + committen, damit andere Agenten wissen, dass du dran bist.

### Nach dem Edit
1. `STATUS.md` aktualisieren („Recently shipped" / „Known issues").
2. Wenn ein Meilenstein abgeschlossen wurde, in `ROADMAP.md` von
   „In Progress" → „Shipped" verschieben + Commit-Hash daneben.
3. Commit-Message gemäß Konvention in 3.1.

### Konflikt-Vermeidung
- Große Bereiche per Convention reservieren (siehe „File Locks" in
  `STATUS.md`). Wer als Erstes editiert, schreibt seinen Bereich rein.
- Feature-Flags statt Branch-Wettlauf: neue Features zuerst hinter
  `localStorage.gs_feat_X = '1'` Toggle, später aktivieren.

## 6 · Deployment

- Push auf `main` → Cloudflare Pages baut automatisch (kein Build-Step).
- `_headers` und `sw.js` greifen erst nach Re-Deploy + Hard-Refresh.
- Service-Worker-Updates kommen via Update-Banner zum User —
  Cache-Version in `sw.js` muss bei größeren Releases hochgesetzt werden.

## 7 · Hilfe-Adressen

- VAPKO (Pilzkontrollen): `https://vapko.ch/`
- swisstopo Tiles: `https://wmts.geo.admin.ch/`
- Open-Meteo: `https://api.open-meteo.com/`
- Anthropic Docs: `https://docs.anthropic.com/`
- Supabase Dashboard: bei Owner

## 7.1 · Optische Änderungen überprüfen (seit v31.30)

```bash
node scripts/render_check.js                      # aktuellen Stand vermessen
node scripts/render_check.js vorher.html nachher.html   # zwei Stände vergleichen
```

Lädt `index.html` ohne Netz, baut **jeden der elf Tabs** auf und vermisst jedes
sichtbare Element. Der Vergleichsmodus meldet getrennt, was sich an **Radius**,
**Schriftgrösse**, **Grösse** (= Layout!) und **Farbe** geändert hat.

Zwei Dinge, die man wissen muss:

- **Der Prüfstand setzt `gs_sb_token`** — nicht um sich anzumelden, sondern weil
  der Login-Flash-Guard (`index.html` ~Z. 1836) ohne diesen Schlüssel
  `html.gs-preauth` setzt und damit `#app{display:none!important}`. Ohne Token
  misst man 11 Elemente statt 2'596.
- **Der Gast-Modus ist kein Weg hinein.** Er wurde in v25.33 abgeschaltet,
  `gsActivateGuestMode` ist ein leerer Rumpf.

Faustregel für die Auswertung: eine reine Farb- oder Radius-Änderung **muss**
`GROESSE geaendert: 0` ergeben. Steht dort etwas anderes, verschiebt die
Änderung Layout — dann vor dem Ausliefern nachsehen, wo.

Zwei weitere Prüfstände liegen daneben:

```bash
node scripts/contrast_check.js   # WCAG-Kontrast jeder Textstelle, beide Modi
node scripts/touch_check.js      # Antippflächen unter 24×24 px (WCAG 2.5.8)
```

Beide sollen **0** melden. Wenn nicht, ist es entweder ein echter Fund oder
eine Falschmeldung des Prüfstands — und die zweite Möglichkeit ist schon
dreimal eingetreten (Chip-Leisten, die absichtlich hinausragen; Emoji, deren
`color` nichts über die Darstellung sagt; ein rotierender Ladekreisel, dessen
gemessene Grösse vom Winkel abhing). Erst nachsehen, dann ändern.

## 8 · Wenn du dich verlaufen hast

- Suchst du eine Funktion? `grep -nE "function <name>" index.html`
- Suchst du einen localStorage-Key? `grep -nE "<key>" index.html`
- Suchst du eine Call-Site einer KI? `grep -n "callAI(\|callVisionAI(" index.html`
- Lina testen: App öffnen → KI-Coach-Tab; Gedächtnis liegt in Supabase
  `coach_messages` (cross-device). gsBrain existiert nicht mehr (§4).
