# CLAUDE.md — Onboarding für AI-Agenten in GreenScan

> Dieses Dokument ist die Eintritts-Datei für **jede AI-Session** (Claude Code,
> Cursor, externe Agenten) in diesem Repo. **Lies es zuerst, bevor du Code
> editierst.** Es gehört zusammen mit `STATUS.md` (operativer Snapshot) und
> `ROADMAP.md` (Meilensteine).

## 1 · Was ist GreenScan?

Schweizer PWA für Naturbestimmung — 4'342 Arten (Pflanzen, Pilze, Bäume,
Kräuter, Moose, Flechten, Algen). Live unter `https://greenscan.ch/`. Hosting:
**Cloudflare Pages**. Backend: **Supabase** (Auth, Storage, Postgres mit RLS).
KI: **Claude (Anthropic)** — User bringt eigenen API-Key oder Admin hinterlegt
einen globalen Key in Supabase (`fn_get_global_api_key` RPC).

Keine Build-Pipeline, kein npm. Reine statische Files. Editieren = direkt
deployen, sobald Cloudflare Pages den Branch zieht.

## 2 · Repo-Struktur

```
GreenScan/
├── index.html           # 46k+ Zeilen Monolith (HTML + CSS + JS) — DIE App
├── sw.js                # Service Worker (v23.86: Cache, Share-Target, Push)
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
- Versions-Format: `vMAJOR.MINOR` (z.B. `v23.87`). Aktuell: siehe `GS_VERSION`
  in `index.html` und `CACHE_VERSION` in `sw.js`. Bei Bumps **immer beide
  syncen** + `meta name="app-version"` im `<head>`.
- Commit-Message-Format: `vXX.YY: <kurze Aussage>` + Markdown-Body mit
  Bullets pro Bereich (Sicherheit / UX / Feature). Beispiel siehe letzte
  Commits auf `claude/audit-app-features-CXtrI`.

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
| Brain-Memory | `localStorage.gs_brain_memory` | über `gsBrain.observe()` schreiben |

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
- **innerHTML mit User-Input**: ab v24.02 nutze `gsSafeHTML`-Tagged-Template
  (auto-escape):
  ```js
  el.innerHTML = gsSafeHTML`<div>${userName} sagt: ${msg}</div>`;
  ```
  Helpers: `gsSafeHTML.escape(s)`, `.attr(s)`, `.url(s)` (nur https/http/
  mailto/relative), `.unsafe(html)` (bypass für bereits-escapte Sub-
  Templates). `gsHTMLEscape` als Kurz-Alias. Für reine Text-Inserts
  weiterhin `textContent` bevorzugen.
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

## 4 · gsBrain (das „Gehirn" der App, seit v23.87)

Zentraler Kontext-/Lern-/Empfehlungs-Hub. **Nutze das immer**, wenn du:
- einen KI-Call machst → `callAI(..., {brain:'<rolle>'})`
- ein User-Event hast, aus dem die App lernen sollte →
  `gsBrain.observe('event_name', {data})`
- eine Empfehlung anzeigen willst → `gsBrain.recommend('next_plant')` oder
  `gsBrain.dailyTip()`

API-Referenz im Code (Zeile ~18495): `index.html` → Suche nach
`window.gsBrain = (function(){`.

Memory-Schema (`gs_brain_memory`, LRU 200):
```json
{ "ts": 1714000000000, "date": "2026-04-29", "event": "scan_added",
  "data": { "name": "Bärlauch", "category": "wildpflanze" } }
```

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
- Service-Worker-Updates kommen via Update-Banner (v23.86) zum User —
  Cache-Version in `sw.js` muss bei größeren Releases hochgesetzt werden.

## 7 · Hilfe-Adressen

- VAPKO (Pilzkontrollen): `https://vapko.ch/`
- swisstopo Tiles: `https://wmts.geo.admin.ch/`
- Open-Meteo: `https://api.open-meteo.com/`
- Anthropic Docs: `https://docs.anthropic.com/`
- Supabase Dashboard: bei Owner

## 8 · Wenn du dich verlaufen hast

- Suchst du eine Funktion? `grep -nE "function <name>" index.html`
- Suchst du einen localStorage-Key? `grep -nE "<key>" index.html`
- Suchst du eine Call-Site einer KI? `grep -n "callAI(\|callVisionAI(" index.html`
- Brain testen: in DevTools-Console `gsBrain.context()` / `gsBrain.dailyTip()`.
