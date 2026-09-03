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

**Teilweise beantwortet (01.09.2026).** Der Netlify-Bot kommentiert an jedem PR
mit einer Deploy-Preview-Adresse der Form
`https://deploy-preview-<PR>--green-scanswitzerland.netlify.app`, zuletzt an
PR #83 mit dem Vermerk „Deploy Preview … ready". **Belegt ist damit:** Netlify
baut pro PR eine eigene Vorschau, und diese Vorschauen sind erreichbare
Adressen. Das ist nützlich — sie sind der einzige Weg, einen Stand vor dem
Merge auf einem echten Telefon anzusehen (den QR-Code hängt der Bot an).

**Weiterhin nicht verifiziert:** ob die nackte Adresse
`green-scanswitzerland.netlify.app` eine öffentliche Produktions-Auslieferung
bedient oder nur die Vorschauen existieren. Die Netzwerk-Richtlinie der
Claude-Cloud-Umgebung blockiert ausgehende Verbindungen dorthin
(`CONNECT … 403`), der Bot-Kommentar sagt dazu nichts. Wer es prüfen kann:
einmal aufrufen und hier eintragen — und dann entscheiden, ob die zweite
Auslieferung bleiben soll.

**Warum das nicht egal ist:** existiert sie öffentlich, ist sie eine zweite
PWA-Installationsquelle mit **eigenem** localStorage (siehe oben) — und damit
eine wiederkehrende Support-Frage.

**Auch `green-scan.ch` selbst ist von hier aus nicht erreichbar** (geprüft
01.09.2026, ebenfalls `CONNECT … 403`). Eine Claude-Cloud-Session kann die
**Live-Seite also nicht abrufen** — weder um ein Deployment zu bestätigen noch
um einen Nutzer-Report nachzustellen. Was von hier aus geht:

- die App **lokal** aus dem Repo rendern (`scripts/render_check.js` und die
  drei anderen Prüfstände, §7.1),
- die Deploy-Meldung der Cloudflare-Pages-Bot-Kommentare am PR lesen.

**Und die Vorschau-Adressen ebenfalls nicht** (geprüft 01.09.2026). Der
Cloudflare-Bot hängt an jeden PR zwei Adressen an — eine pro Deploy
(`<hash>.greenscan-app.pages.dev`) und eine pro Branch
(`<branch>.greenscan-app.pages.dev`). Beide sehen aus wie der naheliegende
Ausweg. Beide liefern dasselbe `CONNECT … 403`:

```
curl -sS https://54e6aba1.greenscan-app.pages.dev
curl: (56) CONNECT tunnel failed, response 403
```

Der Proxy-Status nennt es beim Namen: `connect_rejected · gateway answered
403 to CONNECT (policy denial)`. Dasselbe gilt für die Netlify-Vorschauen.
**Nicht noch einmal probieren** — die Sperre gilt für alles ausserhalb der
Freigabeliste, nicht für einzelne Hostnamen.

Wer schreibt „live verifiziert", muss also sagen, **womit** — sonst ist es
geraten. Für echte Live-Prüfungen braucht es Fernando oder eine Umgebung ohne
diese Sperre.

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
- **Seit v31.36 ist die Liste zweigeteilt.** In `index.html` stehen nur noch
  die **neuesten ~12** Einträge (vorher alle 383 — 787 KB, 14 % der Datei,
  bei jedem Kaltstart geparst). Alles Ältere liegt in
  `data/releases.v1.js` (`window.GS_RELEASES_ARCHIVE`) und wird erst geladen,
  wenn jemand den Changelog im Über-Modal öffnet.
  - Neue Einträge kommen weiterhin **oben in `index.html`** dazu — daran
    ändert sich nichts.
  - Wer die **vollständige** Liste braucht: `gsAllReleases()`, nie
    `GS_RELEASES` direkt. Letzteres sind nur die inline vorhandenen.
  - Wird die Inline-Liste zu lang, wandern die ältesten Einträge an den
    **Anfang** von `data/releases.v1.js` — die Reihenfolge ist überall neu → alt.
  - Das Archiv ist bewusst **nicht** in `SHELL_URLS` vor-gecacht: sonst lädt
    jeder 778 KB für einen Bildschirm, den die meisten nie öffnen.

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
| Garten-Zwilling | `localStorage.gs_garden_twin` (über `gsTwinGet`/`gsTwinSave`) | nie direkt parsen — `gsTwinNormalize` klemmt und verwirft |
| Mischkultur | Supabase `plant_companion_matrix` / `v_companion_lookup` | **keine** Nachbarschaftstabelle im Code anlegen |

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

> ⚠️ **Die Falle, in die ich selbst gelaufen bin (v31.65).**
> `localStorage.setItem` ist **global umhüllt** (`index.html` ~Z. 7145) und
> **wirft nie**. Bei vollem Speicher gibt es `false` zurück und zeigt einen
> Hinweis. Das heisst:
>
> ```js
> try { localStorage.setItem(k, v); } catch (e) { /* Rettungsweg */ }   // TOT
> if (localStorage.setItem(k, v) === false) { /* Rettungsweg */ }        // richtig
> ```
>
> Der Kommentar an der Wrapper-Stelle sagt es seit v30.98 wörtlich — trotzdem
> habe ich in v31.57 einen Rückfall in einen `catch` geschrieben, der nie
> lief. Folge: bei vollem Gerät war nicht nur das Scan-Foto weg, sondern der
> **ganze** Garten-Zwilling, und `gsTwinSave` meldete Erfolg.
>
> **Stand v32.44: die Welle ist geschlossen.** 336 `setItem`-Aufrufe, 250
> davon in einem `try/catch`; die `catch`-Blöcke sind entweder harmlos
> (leer, `console.warn`) oder decken etwas anderes ab (Netz, JSON). Die
> **dreizehn echten Rettungswege** sind alle am Rückgabewert: Favoriten und
> Supabase-Key (v31.65), `gsPPsavePlan` (v31.76), und in v32.44 Tagebuch
> (schrumpft auf 300, dann Meldung), Fundorte (`lsOk` nur bei Erfolg),
> GPS-Tracks (`-1` + Meldung), gespeicherte Pläne (`local_failed`),
> Abstimmungs-Schlüssel (kein geteilter `anon:fallback` mehr — der war EIN
> Schlüssel für alle mit vollem Speicher) und Passwortänderung (sagt, wenn
> die Sitzung nicht gesichert wurde).
>
> **Und seither gibt es den Prüfstand dafür:** `node scripts/speicher_check.js`
> stellt den vollen Speicher HER (jeder Schreibversuch liefert `false` und
> wird protokolliert) und löst alle zehn Wege aus. Gegenprobe gemacht: zwei
> Reparaturen zurückgebaut → beide rot, mit der echten Rückgabe daneben
> („liefert true statt false"). **Wer einen neuen Rettungsweg baut, trägt
> ihn dort ein** — und der Fall muss den Schreibversuch im Protokoll sehen,
> sonst hat er eine Funktion vermessen, die vorher ausgestiegen ist (der
> Fundort-Fall brauchte eine Karten-Attrappe, sonst kam er nie bis zum
> Speichern).
>
> Gefunden wurde das nicht beim Lesen, sondern beim Nachstellen mit einem
> echten Telefonfoto. **Wer einen Rettungsweg für vollen Speicher baut, muss
> ihn auslösen** — sonst schreibt man Trost, keinen Code.
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
- Vanilla JS, ES6+. Kein TypeScript, kein React. Externe Bibliotheken —
  **alle selbst gehostet** unter `assets/`, keine CDN-Abhängigkeit:
  | | | |
  |---|---|---|
  | **Leaflet** | 147 KB | Karte |
  | **Three.js** | 603 KB | 3D-Modelle (Planer + Garten-Zwilling) |
  | **pdf.js** | — | Plan-Export |

  Three.js fehlte hier bis v31.57, obwohl es die grösste der drei ist. Es wird
  **erst bei Bedarf** geladen (`_gsLoadThree()`), nie beim Start — wer nie ein
  3D-Modell öffnet, lädt die 603 KB nie.
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

## 4a · Garten-Zwilling und Planer — die zwei Fallen

Beides seit v31.57 bzw. v31.58 gebaut und in dieser Reihenfolge gewachsen.
Wer daran arbeitet, tritt sonst in dieselben zwei Löcher wie ich.

### 4a.1 · Zwei Koordinatensysteme, die gleich aussehen

Der Zwilling (`gs_garden_twin`) trägt pro Pflanze **beides**:

| Feld | Bedeutung | Wofür |
|---|---|---|
| `x_m` / `y_m` / `w_m` / `h_m` | Meter im **Grundriss**, Nullpunkt links oben | 3D-Modell, Planer |
| `ix` / `iy` | 0–1 **im Foto**, von links oben | Marker auf dem Bild |

Das ist **nicht** ineinander umrechenbar: das eine ist eine Draufsicht, das
andere eine perspektivische Aufnahme. Wer die Meter aufs Foto legt, bekommt
Marker, die überzeugend aussehen und daneben zeigen.

`ix`/`iy` sind **`null`**, wenn die KI nichts sagen konnte — nicht `0`. Sonst
zeigt der Marker auf „links oben", weil ein Feld fehlte. Dieselbe Regel gilt
überall im Zwilling: **lieber keine Angabe als eine erfundene.**

Funktionen: `gsTwinRun` (Scan) · `gsTwinNormalize` (klemmt alles, verwirft
Namen mit `<`/`>`) · `gsTwinOpenListe` (Liste mit Foto und Markern) ·
`gsTwinFix` / `gsTwinRename` (Korrektur) · `gsTwinAdopt` (übernimmt in
`myPlants` mit vollem Aufgabenplan).

### 4a.2 · Eine Prompt-Zeile ist keine Garantie

Der Planer-Prompt verlangte seit v31.58 „Sonnenpflanzen nicht in den
Schatten". Die KI hielt sich daran. Danach lief `_gsSanitizePlannerPlan` und
ordnete **jede** neue Pflanze aus (0,0) heraus neu an — die Überlegung war
weg. Dasselbe bei der Mischkultur: verlangt, nie gemessen.

**Die Lehre, und sie gilt über den Planer hinaus:** was der Prompt verlangt,
prüft von hier aus niemand — die Claude-Cloud-Umgebung hat kein Netz zur KI.
Alles, was wirklich gelten soll, braucht **zusätzlich** eine rechnende
Prüfung im Code. Die steht dann auch im Prüfstand.

Der Platzierer arbeitet deshalb mit **Vorlieben**, von streng nach nachgiebig:

```
1. Die Stelle der KI — wenn frei UND Licht passt UND kein Gegenspieler daneben
2. Rastersuche: Licht UND Nachbarschaft
3. Rastersuche: nur Nachbarschaft  →  4. nur Licht  →  5. irgendwo frei
```

**Keine Vorliebe darf eine Pflanze verhindern.** Findet sich nichts Besseres,
wird gesetzt und gemeldet (`plan._licht`, `plan._nachbarn`, `plan._ohnePlatz`)
— eine Pflanze wegzulassen wäre die schlechtere Antwort, und ein Plan, der
behauptet alles passe, wäre kein Plan.

Zwei Fehler, die ich beim Bauen selbst gemacht habe und die beide erst der
Durchlauf gezeigt hat:

- **„Frei" ist nicht „sinnvoll".** Stufe 1 nahm anfangs jede kollisionsfreie
  Stelle der KI — die Tomate blieb im Schatten bzw. 10 cm neben der
  Kartoffel stehen, obwohl der halbe Garten leer war. Zweimal derselbe
  Fehler, an zwei Tagen.
- **Zwei Regeln statt einer.** Der Platzierer rechnete mit rohen
  Fliesskommazahlen (10-cm-Schritte summieren sich zu `1.0000000000000002`),
  die Prüfung danach mit gerundeten. Der Planer setzte eine Pflanze bewusst
  auf genau 1,00 m Abstand und beklagte anschliessend genau diesen Abstand.
  Seither fragen beide Seiten dieselbe Funktion (`_gsZuNah`).

### 4a.3 · Wann Messungen gelten dürfen

Der Plan hat eine eigene Fläche (aus dem Formular), der Scan eine gemessene.
Sind das nicht dieselben Masse (Toleranz 26 cm), liegen die Zonen-Koordinaten
auf einem **anderen Rechteck** — dann bleiben sie ungenutzt und es wird
nichts behauptet (`plan._licht = null`). Genauso, wenn die
Mischkultur-Matrix noch nicht geladen ist: `plan._nachbarn = null`, kein
erfundener Vorwurf.

Grundregel für alles in diesem Bereich: **eine Anzeige, die etwas behauptet,
muss sagen können, woher sie es weiss.**

## 4b · KI-Planer — der Entwurf steht in `docs/PLANER-V3.md`

Wer am Planer arbeitet, liest **zuerst** `docs/PLANER-V3.md`. Dort steht, was V3
sein soll, in fuenf Stufen — und die eine Regel, die ueber den Planer
hinausgeht:

> **Was der Code ausrechnen kann, entscheidet nie die KI allein.**

Die Trennlinie in Kurzform: Aussaatfenster, Standdauer, Frost, Platzbedarf,
Kollisionen, Wasserbilanz, Arbeitslast, Ernteverteilung, Saatgut und
Fruchtfolge **rechnen** (Code, offline pruefbar). Sortenwahl, Gestaltung,
Tipps und Klimazonen-Einschaetzung **raet** die KI. Wo beide sich
widersprechen, gewinnt die Rechnung — und die Anzeige sagt, dass korrigiert
wurde.

Seit v31.75 gibt es dafuer ein Pruefwerk (`_gsPlanPruefwerk`, ruft
`_gsPlanBelegung` · `_gsPlanLuecken` · `_gsPlanAussaat` · `_gsPlanDichte` ·
`_gsPlanSaatgut` · `_gsPlanWasser` · `_gsPlanErnteMonate`). Jede Regel hat
**drei** Zustaende: erfuellt · verletzt · **nicht pruefbar** (Ergebnis `null`,
mit Grund in der Anzeige). Nie `{}` oder `0` fuer „keine Daten" — das laese
sich als „alles in Ordnung" lesen.

Zwei Fallen aus dem Bau von v31.75, damit sie niemand neu findet:

- **Eine Pruefung, die die richtigen Faelle meldet, ist wertlos.** R1 verglich
  `sow_date` mit `sow_months` und meldete die Tomate: Referenz „Mär/Apr"
  (Vorkultur), Plan „20. Mai" (Auspflanzen) — beides richtig. Ein Monat
  Toleranz, im Code begruendet. Wer eine neue Regel baut, laesst sie einmal
  gegen einen **guten** Plan laufen, nicht nur gegen einen schlechten.
- **Farben aus der KI-Antwort haben keinen garantierten Kontrast.** Weiss auf
  `#43a047` sind 3,3:1. `_gsAufFarbe(hex)` rechnet die relative Leuchtdichte
  und waehlt Schwarz oder Weiss — fuer jede Stelle, an der Text auf einer
  Farbe aus einer Antwort steht.

## 5 · Multi-Agent-Sync

Mehrere Sessions arbeiten parallel an diesem Repo. Damit kein Knoten platzt:

### Vor dem Edit
1. `git fetch && git status` — sind du auf dem aktuellsten Branch?
2. `STATUS.md` öffnen — was ist gerade in Arbeit, was ist offen?
3. Wenn unklar: zuerst kurze Notiz unter „In Progress" in `STATUS.md`
   schreiben + committen, damit andere Agenten wissen, dass du dran bist.

### Nach dem Edit
1. `STATUS.md` aktualisieren („Recently shipped" / „Known issues").
   **Und zwar BEIDES**: den Routine-Eintrag oben in Sektion 0 UND die
   Zusammenfassung in Sektion 1/2. Am 02.09.2026 stand Sektion 1 auf
   `v30.80`, waehrend die App bei `v32.20` war — **140 Versionen daneben**,
   weil hundert Sitzungen brav ihren Routine-Eintrag angehaengt und den
   Ueberblick nie mitgezogen haben. Ein Ueberblick, der so weit
   hinterherhinkt, kostet den naechsten Leser mehr Zeit als er ihm spart.
   Die Zahlen dort sind alle mit einem Befehl nachzaehlbar (Zeilen,
   Migrationen, Edge-Verzeichnisse, Pruefstaende) — es dauert eine Minute.
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

**Und eine Sperre, über die jeder Prüfstand stolpert:** viele Speicherwege
beginnen mit `gsRequire('…')` und brechen ohne echte Anmeldung ab — der
Pseudo-Token aus `_seed.js` reicht dafür nicht. Ein Test, der ein Speichern
prüft, muss `window.gsRequire = function(){ return true; };` setzen, sonst
misst er eine Funktion, die gar nicht gelaufen ist. Beim Bau von v31.82
hat mich das eine halbe Stunde gekostet: die Gartenart kam nie im Speicher
an, und der Fehler lag nicht im neuen Code, sondern in der Anmelde-Sperre.

Faustregel für die Auswertung: eine reine Farb- oder Radius-Änderung **muss**
`GROESSE geaendert: 0` ergeben. Steht dort etwas anderes, verschiebt die
Änderung Layout — dann vor dem Ausliefern nachsehen, wo.

**Seit v32.21 zählt „abgeschnittener Inhalt" nur noch echten TEXT.** Vorher
reichte `scrollHeight > clientHeight` — und damit meldete der Prüfstand vier
Kopfbereiche (Wissen, Rezepte, Heilmittel, Community), die ein riesiges Emoji
als Wasserzeichen tragen (`position:absolute`, 140 px, `opacity:.06`) und es
ABSICHTLICH beschneiden. Vier ständige Falschmeldungen — an denen ich einen
ganzen Tag lang vorbeigelaufen bin, ohne sie nachzusehen. **Genau so wird ein
Bericht unlesbar: nicht durch eine falsche Zahl, sondern durch eine, die man
zu ignorieren gelernt hat.**

Die schärfere Frage lautet jetzt: ragt ein Nachfahre mit EIGENEM Textknoten,
der NICHT absolut positioniert ist, über den Kasten hinaus? Dieselbe Regel wie
in `touch_check` seit v32.07 — Dekoration darf hinausragen, Inhalt nicht.
**Gegenprobe mit zwei Fällen:** ein zu hoher Textblock in einem 30-px-Kasten →
gemeldet; derselbe Kasten mit nur einem absolut positionierten Emoji darin →
still.

`render_check.js` meldet ausserdem **verdächtige Textstellen** — `undefined`,
`null`, `NaN`, `[object Object]`, `Invalid Date`, `{{platzhalter}}`. Anlass war
v31.44: fünf Kategorien standen in keiner Zuordnungstabelle und der Rückfall
hatte kein `label`, also stand auf 22 Karten wörtlich „undefined". Diese Zahl
muss **0** sein.

**Grenze:** der Vergleich paart Elemente über einen Schlüssel aus DOM-Pfad, id,
Klasse und Text. Wer Bausteine **umordnet**, ändert genau diesen Pfad — dann
paart das Werkzeug zwangsläufig falsch und meldet Änderungen, die es nicht gibt.
Für Umordnungen ist der Vergleich also **nicht** das richtige Mass. Was dort
trägt: jede id genau einmal vorhanden, keine JS-Fehler, die abhängigen
Funktionen laufen (bei der Startseite z.B. `gsBuildWidgetStack`), und die
tatsächliche Reihenfolge im DOM auslesen.

Zwei weitere Prüfstände liegen daneben:

```bash
node scripts/contrast_check.js   # WCAG-Kontrast jeder Textstelle, beide Modi
node scripts/touch_check.js      # Antippflächen unter 24×24 px (WCAG 2.5.8)
node scripts/perf_check.js       # Kaltstart unter Telefon-Drosselung (1×/4×/6×)
node scripts/wiring_check.js     # Verdrahtung: kommt an, was angetippt wird? (seit v31.45)
python3 scripts/field_check.py   # Formularfelder, die niemand liest (seit v31.74)
node scripts/data_check.js       # liest der Code Felder, die es nicht gibt? (seit v31.80)
node scripts/save_check.js       # kommt an, was gespeichert wird? (seit v31.85)
node scripts/planer_check.js     # rechnet der Planer, was er behauptet? (seit v31.93)
node scripts/scan_check.js       # glaubt der Scanner der KI aufs Wort? (seit v31.99)
node scripts/offline_check.js    # haelt die PWA, was sie ohne Empfang verspricht? (seit v32.13)
node scripts/a11y_check.js       # bedienbar ohne Augen und ohne Maus? (seit v32.16)
node scripts/i18n_check.js       # kommt in vier Sprachen an, was deutsch dasteht? (seit v32.17)
node scripts/backend_check.js    # ruft das Frontend etwas auf, das es nicht gibt? (seit v32.18)
node scripts/storage_check.js    # was ueberlebt das Abmelden? (seit v32.21)
node scripts/sync_check.js       # kommt zurueck, was hochgeladen wird? (seit v32.23)
node scripts/versprechen_check.js # wer verspricht etwas, das niemand geprueft hat? (seit v32.28)
node scripts/einstellungen_check.js # haelt der Schalter, was er verspricht? (seit v32.33)
node scripts/tour_check.js       # zeigt die App-Tour auf etwas, oder erzaehlt sie nur? (seit v32.39)
node scripts/kamera_check.js     # stimmt, was der Scanner ueber seine Kamera behauptet? (seit v32.29)
node scripts/arten_quellen_vergleich.js # was sagen die zwei belegten Repo-Datensaetze zur Artenliste? (seit v32.43, nur Messung)
node scripts/speicher_check.js   # was tut die App, wenn der Geraetespeicher voll ist? (seit v32.44)
#   save_check prueft seit v31.95 auch SERVER-Wege mit gestelltem sbFetch:
#   meldet die Funktion Erfolg, wenn der Server NEIN sagt — oder gar nichts?
#   wiring_check meldet seit v31.95 zusaetzlich sofort dereferenzierte
#   querySelector('.klasse')-Ketten ohne passendes Element.
#   data_check prueft seit v31.89 zusaetzlich Widersprueche in den
#   Sicherheitsangaben — siehe docs/ARTEN-LUECKEN.md
```

Elf der siebzehn JS-Prüfstände teilen die Beispieldaten in `scripts/_seed.js` — dort
ändern, nicht in den einzelnen Prüfständen. `field_check.py` liest nur den
Quelltext und braucht keine.

`planer_check.js` fährt die rechnenden Regeln des Planers gegen konstruierte
Fälle. Anlass: das Prüfwerk hatte dreizehn Regeln und **keinen** Prüfstand —
die schlechteste Kombination, die es gibt, denn eine ungeprüfte Prüfung sagt
„alles in Ordnung" auch dann noch, wenn sie gar nichts mehr rechnet. Im
ersten Lauf (v31.93) fand er drei Fehler, keinen davon hätte man beim Lesen
gesehen (siehe `docs/PLANER-V3.md` §10).

Zwei Regeln, nach denen er gebaut ist, gelten für **jede** neue Prüfung:

- **Jede Regel läuft gegen einen guten Plan UND gegen einen schlechten.** Nur
  beides zusammen ist eine Aussage — eine Prüfung, die die richtigen Fälle
  meldet, ist wertlos (§4b).
- **Was die Anzeige zeigt, wird aus dem gerenderten HTML gelesen**, nicht aus
  dem Objekt. In v31.90 war ein Anzeige-Block wegen Hoisting tot, ohne dass
  irgendetwas einen Fehler meldete — die Karte sah nur unverändert aus.

`field_check.py` sucht die Umkehrung von `wiring_check`: **Eingabefelder, die
niemand liest.** Anlass war v31.72 — das Garten-Formular hatte Breite und
Länge, eine Vorschau rechnete live die Fläche daraus, und `editGarden` LAS
sie beim Bearbeiten wieder ein. Nur geschrieben hat sie nie jemand. Man tippte
die Masse ein, sah die Fläche, speicherte, und beim nächsten Öffnen war alles
leer.

**Seit v32.41 kennt er zusammengesetzte Namen.** `getElementById('tp-' + k)`
enthaelt die id `tp-len` nirgends als Zeichenkette; die vier Felder
`tp-len`/`tp-wid`/`tp-soil`/`tp-light` standen deshalb seit v31.74 als
DAUERHAFTE Falschmeldung im Bericht. Er erkennt jetzt die Bauform (ein
Nachschlagen, dessen Argument verkettet wird) und gibt diesen Feldern eine
EIGENE Klasse — sie verschwinden nicht, sie zaehlen nur nicht mehr als Fehler.

> **Was man nicht beweisen kann, sagt man gesondert, statt es unter die Fehler
> zu mischen.** Ein Bericht wird nicht durch eine falsche Zahl unlesbar,
> sondern durch eine, die man zu ignorieren gelernt hat (dieselbe Lehre wie
> bei `render_check` in v32.21).

Der Preis, ehrlich benannt: ein totes Feld, das mit einem erkannten Praefix
ANFAENGT, landet in der mittleren Klasse statt in der oberen. Gegenprobe
gemacht: ein totes Feld mit eigenem Namen wird weiter rot gemeldet.

**Eine Grenze bleibt:**
Und Felder mit eigenem `on*`-Attribut werden übersprungen; ohne diese Regel
meldet er fast jede Einstellung als kaputt. **Ein Treffer ist ein Verdacht,
kein Urteil** — beim ersten gezielten Durchgang blieb von 303 Feldern genau
einer übrig, der wirklich nichts tat: „Angemeldet bleiben".

`save_check.js` faehrt sieben Speicherwege **wirklich zu Ende**: Formular
fuellen → Speicherfunktion aufrufen → aus dem localStorage zuruecklesen →
Feld fuer Feld vergleichen. Anlass sind die drei teuersten Fehler dieses
Meilensteins, die alle dort lagen: v31.72 (Gartenmasse nie geschrieben),
v31.65 (`gsTwinSave` meldete Erfolg ohne zu speichern), v31.76
(`gsPPsavePlan` ebenso).

**Er ueberbrueckt `gsRequire` bewusst** — siehe die Anmerkung weiter unten;
ohne das vermisst er eine Funktion, die gar nicht laeuft.

**Gegenprobe gemacht:** zwei Felder absichtlich entfernt, beide wurden mit
Namen und erwartetem Wert gemeldet (`kind (=undefined, erwartet
gewaechshaus)`). Ein Pruefstand, der beim ersten Lauf alles gruen meldet,
ist erst etwas wert, wenn er auch einen Fehler findet.

**Seit v31.95 gibt es eine zweite Liste: `SERVER_WEGE`.** Sie prueft nicht
den Speicher, sondern die **Aussage** — mit gestelltem `sbFetch`, je Weg drei
Faelle: Server lehnt ab · Server antwortet **leer** · Server bestaetigt. Der
mittlere ist der wichtige: PostgREST liefert bei einer von RLS abgewiesenen
Zeile **0 Datensaetze und keinen Fehler**. Wer nur `error` prueft, meldet dann
Erfolg fuer nichts — genau das taten `gsSubmitExpertApplication`,
`gsAdminSetExpertLevel` und `gsAdminBanUser` bis v31.94.

**Grenze:** gemeldet wird nur, was in den Listen `WEGE` und `SERVER_WEGE`
steht. Ein Speicherweg, der dort fehlt, faellt nicht auf — **die Liste ist die
Pruefung**. Wer einen neuen Speicherweg baut, traegt ihn dort ein.

`data_check.js` stellt die dritte Frage. `wiring_check` fragt *kommt an, was
angetippt wird?*, `field_check` *liest überhaupt jemand, was eingegeben
wird?* — `data_check` fragt: **gibt es, was gelesen wird?**

Anlass war v31.78: der Blühkalender fragte seit jeher `s.bloom` ab, ein Feld,
das in **keiner** der 4'342 Arten vorkommt. Kein Absturz, keine Lücke im
Layout — nur eine Ansicht, die nie etwas zeigen konnte, mit einem Zähler
daneben, der brav `0` meldete.

Er arbeitet **dynamisch**, nicht per Textsuche: `window.DB` wird durch einen
Proxy ersetzt, der jeden Feldzugriff mitschreibt; danach läuft die App durch
alle elf Tabs und ein paar Fenster. Zwei Klassen im Bericht — ein Name, den
**kein** Datensatz kennt (Fehler), und ein optionales Feld, das nur manche
haben (kein Fehler). Dazu eine Deckungsliste: `.color` und `.alt` stehen nur
bei 22 % der Arten, `.care`/`.lightMin` bei 40 von 4'342.

**Zwei Grenzen:** gemeldet wird nur, was in diesem Durchlauf wirklich lief —
ein Zweig, den niemand betritt, fällt nicht auf. Und beim Bau war der erste
Anlauf falsch: die Array-Methoden waren ans **rohe** Array gebunden, `DB.filter`
lief am Proxy vorbei, und der Späher sah **3** Feldzugriffe statt 26'000. Wer
so ein Werkzeug baut, prüft zuerst, ob es überhaupt etwas sieht.

`wiring_check.js` prüft, was die anderen vier nicht sehen: die vier messen, wie
die App **aussieht**, dieser prüft, ob das Angetippte **ankommt**. Zwei
Richtungen, und die zweite ist die teurere:

1. **Knopf → Funktion.** Jedes `on*`-Attribut aller elf Tabs einsammeln, die
   aufgerufenen Namen ziehen, im Seitenkontext auflösen. Ein
   `onclick="gsMachWas()"` ohne Funktion sieht normal aus, misst sich normal
   und tut beim Antippen nichts.
2. **Funktion → Element.** Jede `getElementById('…')`/`querySelector('#…')` mit
   festem Namen gegen die ids, die im Quelltext wirklich entstehen. Getrennt
   ausgewiesen wird, ob der Zugriff **abgesichert** ist (`if (el)` → still und
   folgenlos) oder **ungesichert** (`.textContent` direkt am Ergebnis → wirft,
   und alles danach in der Funktion läuft nicht mehr). Nur das Zweite ist ein
   Fehler; genau so lag v31.40 im Argen.

3. **Benachrichtigungs-Ziele.** `GS_NOTIF_ZIELE` (31 Arten) bildet die Art
   einer Mitteilung auf eine Zielfunktion oder einen Tab ab — auch das eine
   reine Datenstruktur, die kein Blick aufs Dokument findet. Bis v31.81
   deckte der Router **sieben** Arten ab; alles andere ohne `link` landete
   bei `closeMainMenu();`, einem Tipp ins Leere. Beim ersten Durchgang meldete
   der Prüfstand prompt drei Zeilen, in denen ich selbst eine Zielfunktion
   erfunden hatte (`openSubscriptionModal` heisst `gsShowAboScreen`).
   **Neue Art? In `GS_NOTIF_ZIELE` eintragen** — sonst meldet er sie.

4. **Menü-Liste.** `MENU_ITEMS` (40 Einträge der Menü-Suche) trägt die Aktion
   als **Zeichenkette in einem Feld**, nicht als `onclick` am Element —
   Richtung 1 sieht sie deshalb nicht. Beim ersten gezielten Durchgang
   (v31.48) waren drei kaputt: sie sprangen auf einen Bildschirm und tippten
   dort ein Element an, das es nicht gibt. **Wer weitere solche Listen anlegt,
   muss sie hier eintragen** — was nur als Datenstruktur existiert, entzieht
   sich jeder Prüfung, die bloss das Dokument ansieht.

**Richtung 5 (seit v32.24): fuehrt ein DEEP-LINK irgendwohin?** Fuenf Stellen
erzeugen Links mit einem Anker (`gsSharePost`, `gsShareComment`, zwei
Like-Trigger in der DB, der Aufgaben-Cron). **Gelesen hat ihn bis v32.23
niemand** — `gsHandleShortcutUrl` schrieb `location.pathname` ohne Hash
zurueck, der Benachrichtigungs-Router schnitt ihn mit `.split('#')[0]`
ausdruecklich ab, und ein Element mit dieser id gab es ohnehin nicht.
„❤️ Anna gefaellt dein Beitrag" landete oben im Feed. **Ein Link, der oben auf
der Seite endet, sieht aus wie ein Link, der funktioniert hat.**

Der Pruefstand sammelt die erzeugten Anker-Arten aus `index.html`, den
Migrationen und den Edge-Functions und haelt sie gegen `GS_ANKER_ARTEN` —
**drei Klassen** wie in `backend_check`: gelesen · bewusst ohne Ziel (mit Grund
in `GS_ANKER_OHNE_ZIEL`) · unbegruendet ungelesen. Dazu ein lebender Fall, der
einen Beitrag wirklich in den Feed legt und die Markierung am Element prueft.

Zwei Regeln daraus:

- **Eine Zeitmessung ist keine Aussage.** Der erste Bau erkannte „kennt der
  Leser diese Art?" daran, ob er laenger als 300 ms wartete — `comment` fiel
  prompt durch, weil sein Datenbank-Blick ohne Netz sofort zurueckkam. Was
  geprueft werden soll, wird DEKLARIERT (wie `GS_NOTIF_ZIELE` seit v31.81),
  nicht am Laufzeitverhalten abgelesen.
- **Eine Gegenprobe, deren Aufbau still fehlschlaegt, sieht aus wie eine
  bestandene Gegenprobe.** Meine erste meldete gruen, weil das Skript, das die
  Anker-id entfernen sollte, nichts geaendert hatte. Nach jeder Gegenprobe
  nachsehen, ob der Zustand wirklich hergestellt wurde.

Und eine Falle aus derselben Sitzung, die jeden Pruefstand betrifft, der
Zustand im Browser setzt: **`socialPosts` ist ein `let` im Skript-Bereich und
steht NICHT auf `window`.** `window.socialPosts = […]` legt eine zweite,
unbenutzte Eigenschaft an; `renderSocialFeed` meldet danach „Noch keine Posts".
In `page.evaluate` ohne `window.` zuweisen.

**Richtung 3 (seit v31.98): geht das Fenster ueberhaupt auf?** Alle 43
Oeffner ohne Parameter (`open…` / `gsOpen…` / `show…` mit `openModal(` im
Rumpf) werden **wirklich aufgerufen**. Zwei Regeln stecken drin, beide im
ersten Lauf gelernt: **Sperren werden erfuellt, nicht umgangen** (vier Oeffner
brechen ohne Anmeldung oder Admin-Rechte ab — das ist richtig), und
**bewusstes Ablehnen ist kein Fehler** — unterschieden wird daran, ob die
Funktion etwas *sagt*. Wer nichts oeffnet und nichts sagt, ist kaputt.

**Und eine Warnung zu den Beispieldaten:** im selben Lauf starb
`openErnteTracking` an `e.ts.slice(…)` — weil `_seed.js` eine Zahl schrieb, wo
die App einen ISO-String schreibt. Dahinter lag ein echter Fehler (der dritte
`s.bloom`, siehe v31.98), den `data_check` die ganze Zeit **nicht** sehen
konnte, weil die Zeile unerreichbar war. **Falsche Beispieldaten verdecken
echte Fehler und melden dabei gruen.**

**Richtung 2b (seit v31.95): Klassen-Ketten.** `getElementById` deckt ids ab.
Nicht abgedeckt war
`getElementById('x').querySelector('.y').textContent = …` — und genau daran
hingen **vier Bildschirme**: `.modal-title` gibt es in `#modal-recipe-detail`
nicht, die Zeile warf jedes Mal, und zwar **vor** `openModal`. „Bestätigte
Scans", „Supabase API-Key", das **Admin-Panel** und der Experten-Antrag
liessen sich dadurch gar nicht öffnen. Keine Fehlermeldung, kein leeres
Fenster — es passierte nichts. Gemeldet wird nur, was wirklich wirft: eine
Klasse, die in keinem `class="…"`, `classList.add` oder `className` vorkommt.

**Und die Lehre daraus, die über diesen einen Fall hinausgeht:** ein Fenster,
das sich nicht öffnet, sieht aus wie ein Knopf, den man danebengetippt hat.
Niemand meldet das als Fehler. Deshalb war dahinter ein zweiter Fehler
jahrelang unbemerkt — der Experten-Antrag, den niemand absenden konnte, wurde
auch nie abgeschickt, wenn man es doch tat.

**Die Grenzen, damit sie niemand neu entdecken muss:**

- Namen, die erst zur Laufzeit entstehen (`window[name]()`), findet er nicht.
- Richtung 2 liest den **Quelltext**, nicht das Dokument: die meisten ids
  entstehen erst beim Rendern, ein laufender Abgleich wäre lauter Falschalarm.
- Kommentare müssen raus, sonst meldet er die eigene Fehlerdokumentation als
  Fehler. Die naive Prüfung („steht ein `/*` näher als das letzte `*/`?")
  reicht nicht: Zeile ~29648 enthält `accept="image/*"` — das `/*` steht in
  einer **Zeichenkette** und schliesst nie, ab dort galt der halbe Rest der
  Datei als Kommentar und elf echte Funde verschwanden. Er führt deshalb beim
  Durchgehen Zeichenketten mit.

Die verbleibenden **abgesicherten** Nachschlagungen (46, Stand v31.46) sind
kein Fehler, sondern eine Arbeitsliste — und sie ist es wert, durchgegangen zu
werden. „Abgesichert" heisst nur, dass nichts abstürzt; es heisst **nicht**,
dass nichts fehlt. In v31.46 verbarg sich in dieser Liste der Pflanzenfriedhof:
der Knopf auf jeder Pflanzenkarte verschob die Pflanze korrekt, aber
`renderCemetery` schrieb in ein `#cemetery-list`, das es nicht gab — es gab
schlicht keinen Weg zurück. Jede Zeile einzeln prüfen: manche sind Reste
entfernter Oberflächen, manche eine **Funktion ohne Anzeige**.

**Und noch eine Lehre aus v31.46:** `scripts/_seed.js` legte die
Beispiel-Pflanzen unter `myPlants` ab — die App liest `ps_myplants`. Von v31.30
bis v31.45 haben deshalb *alle* Prüfstände eine leere Pflanzenliste vermessen.
Wer die Beispieldaten erweitert: **den Schlüssel gegen `index.html` prüfen**,
nicht gegen den Namen der globalen Variablen.

`perf_check.js` trennt **App-JS** von **Parsen/Kompilieren**. Nur die erste
Spalte ist beeinflussbar — die zweite ist der Preis des 5,7-MB-Monolithen und
eine Eigenschaft der Architektur, kein Fehler. Für einen Vergleich beide Stände
mit **demselben** Aufruf messen; die Zahlen schwanken zwischen Läufen.

**Eine Regel aus v32.11, die ueber die Optik hinausgeht:** *Inhalt, auf den es
ankommt, wird nie NACH UNSICHTBAR animiert.* Zwei Anlaeufe an derselben Stelle
sind daran gescheitert — erst `opacity:0` per Timer (contrast_check: **1:1**),
dann `animation … both` mit `from{opacity:0}` (scan_check: „5 von 5 Zeilen
bleiben unsichtbar", weil die Animation in einem verborgenen Bereich nie
startet). Wer eine Zeile einlaufen laesst: **bewegen und faerben, nicht
ausblenden** — und den Pruefstand zu BEGINN der Animation messen lassen, nicht
erst am Ende.

**Seit v31.99 misst `contrast_check` in DREI Fenstern** — dazu kam das
**Scan-Ergebnis**, der Bildschirm, auf dem jemand ueber Giftigkeit liest. Er
gehoert zu keinem der elf Tabs und war deshalb nie vermessen; der erste Lauf
fand fuenf Stellen unter AA, darunter „☠️ Toedlich giftig" mit **3,27:1** und
das Sicherheitswort mit **1,87:1**. Beim Einbau meldete das Fenster zuerst
**18 Stellen bei 71 Textknoten** — die Karte war vollstaendig da und trotzdem
unmessbar, weil der Scanner-Tab ausgeblendet ist (`switchTab('scanner')` fehlte).

**Eine Regel aus `scan_check`, die ueber den Scanner hinausgeht:** *was ein
Prompt verlangt, muss auch jemand lesen.* Jedes Feld im JSON-Beispiel des
`SCAN_SYSTEM_PROMPT` wird gegen seine Verwendung im Code gehalten. „Abgefragt,
geliefert, weggeworfen" war der haeufigste Fehler dieser Session — bei der
Giftigkeit der Alternativen (v31.92) und den Merkmalen (v31.99) war er teuer,
bei `db_search` kostete er nur Tokens. **Wer einen neuen Prompt mit festem
Antwortformat baut, sollte dieselbe Pruefung dafuer anlegen.**

**Und ein neuer Prueftand: `scan_check.js`** — er fragt, ob der Scanner der KI
aufs Wort glaubt. Kernfall: eine Art, die unsere Liste als toedlich fuehrt, vom
Modell als „essbar" gemeldet. Die vorsichtigere Angabe MUSS gewinnen, und zwar
sichtbar. `docs/SCANNER-V3.md` erklaert, warum das der Punkt ist, an dem diese
App eine reine Bilderkennung schlagen kann: **nicht im Sehen, im Pruefen.**

**Seit v32.43 haelt `scan_check` auch die DUBLETTEN-REGEL fest.** Die
Artenliste fuehrt 657 Arten mehrfach (gleiches Binomen nach `_gsNormLat`),
167 Gruppen widersprechen sich bei `tox`/`edible`. Bis v32.42 war jede
Nachschlagung ein `DB.find(…)` — der ERSTE Treffer in Dateireihenfolge
entschied, welche Giftstufe der Scan zeigte. Seither:

- **Bei Widerspruch gewinnt die vorsichtigere Angabe** (`_gsVorsichtigste`:
  hoeheres `tox`, dann `edible=false`, dann der inhaltsreichere Eintrag).
- **Die Vorsicht haengt an der ART, nicht an der Suchstrategie**
  (`_gsArtGruppe` sammelt nach der Identifikation alle Eintraege derselben
  Art ein — „Holunder" trifft ueber den deutschen Namen genau EINEN Eintrag,
  tox 0; die Art hat neun).
- **Das Binomen wird VOR dem deutschen Namen gesucht.** „Wacholder /
  Juniperus communis" traf sonst `FD0660 Wacholder` = *Juniperus nana*, eine
  andere Art. Ein Trivialname ist mehrdeutig, ein Binomen nicht. Gemessen
  mit der Selbstabfrage (jeder Eintrag mit eigenem name+lat): v32.42
  landeten **1'194 von 4'311** auf einer anderen Art, seither 0. Der Fall
  bleibt im Pruefstand — wer die Reihenfolge je wieder umdreht, sieht ihn.

Der Fall prueft alle drei Teile GETRENNT, weil jeder fuer sich unbemerkt
zurueckfallen kann; Gegenprobe je Teil gemacht. Wer `gsMatchScanToDb` eine
neue Strategie hinzufuegt, gibt ihr Ergebnis durch
`_gsVorsichtigste(_gsArtGruppe(hit))` — nie `DB.find`. Die Dubletten selbst
stehen in `docs/arten-widersprueche.csv` und brauchen eine Flora, keinen
Code (`docs/ARTEN-DATEN.md`).

**Seit v32.12 haelt `scan_check` eine Eigenschaft fest, die man leicht
kaputtmacht, ohne es zu merken: die UNABHAENGIGKEIT.** Der Scanner misst vor
der Antwort die Farben des Fotos (`gsBildFarben`) und grenzt die 4'342 Arten
selbst ein (`gsScanVorauswahl`). Beides geht **bewusst nicht** in den Prompt —
ein Modell, dem man die eigene Vorauswahl zeigt, bestaetigt sie, und die
spaetere Gegenpruefung waere ein Echo statt einer Pruefung.

Der Pruefstand liest deshalb den echten Prompt aus einem vollen
`analyzeImage`-Durchlauf UND prueft, dass beide Schritte trotzdem gelaufen
sind. **Ohne die zweite Haelfte prueft ein solcher Fall nur, dass nichts
passiert** — und ist damit gruen, auch wenn man die ganze Funktion entfernt.
(Gegenprobe gemacht: Farbmessung ausgebaut → der Fall meldete sofort.)

Wer eine weitere Rechnung baut, die die KI gegenpruefen soll, traegt sie dort
ein. Und wer eine Vorauswahl baut, merkt sich die eine Regel dahinter:
**ausgeschlossen wird nur, was sich begruenden laesst.** Ein Praedikat hat
drei Rueckgaben — `true`, `false`, `null` — und `null` ist nicht `false`.
3'465 der 4'342 Arten haben keine Hoehenangabe; wuerde `null` wie `false`
wirken, bliebe ein Fuenftel uebrig und die Zahl daneben waere eine Luege.

**`offline_check.js` (seit v32.13) stellt die Frage, die keiner der anderen
zehn stellt: laeuft die App ueberhaupt ohne Netz?** GreenScan wird im Wald
benutzt — genau dort, wo es keinen Empfang gibt, und genau dafuer gibt es den
Service Worker.

Er braucht als einziger einen **eigenen HTTP-Server** (30 Zeilen im Skript,
kein Paket): ein Service Worker laeuft nur in einem sicheren Kontext, und
`file://` ist keiner. Danach: installieren lassen · den Shell-Cache gegen
`SHELL_URLS` halten · **wirklich offline gehen** (`setOffline(true)`, Server
zu) · neu laden · die Arten zaehlen.

Der erste Lauf fand den teuersten Fehler dieser Woche: **0 von 4'342 Arten**.
`plants.v1.js` wurde beim Install in den SHELL_CACHE gelegt und danach nie
dort gesucht — der `fetch`-Handler schaute nur in den RUNTIME_CACHE, und der
war leer, weil der Service Worker beim ERSTEN Besuch waehrend des Ladens
installiert wird und die Unterdateien der Seite gar nicht sieht. Wer die App
installierte und dann in den Wald fuhr, hatte eine App ohne Artenliste.
Nichts stuerzte ab; die Liste war einfach leer.

**Zwei Regeln, die daraus folgen:**

- **Vorladen ist nur die halbe Miete.** Was in einen Cache gelegt wird, muss
  auch von dort GELESEN werden — jede Strategie braucht den Nachschlag
  (`ausShell`), sonst ist das Vorladen Zierde.
- **Ein Fall, der den Zustand nicht herstellt, prueft nichts.** Die
  Doppelspeicher-Frage war im ersten Anlauf gruen, auch mit ausgebauter
  Weiche — sie lief vor dem zweiten Besuch MIT Netz, und ohne den kann gar
  keine zweite Kopie entstehen. Nach dem Umbau meldete sie sofort 2,9 MB
  doppelt (Artenliste, Leaflet, Three.js). Dieselbe Lehre wie beim
  Ausserhalb-des-Bildschirms-Fall in v32.07.

**Seit v32.14 prueft er auch die WARTESCHLANGE** — das zweite Versprechen an
einen Ort ohne Empfang: „📵 Offline gespeichert, wird beim naechsten Online
uebertragen." Drei Ablagen, drei Zustaendigkeiten, und die duerfen sich nicht
vermischen:

| Ablage | Wer raeumt sie |
|---|---|
| `pending_scans` · `pending_diary` · `pending_sync` | `gsFlushOfflineQueue` |
| `pending_photos` | `gsFlushPhotoQueue` (laedt hoch, zaehlt Versuche) |
| `dropped_entries` | **niemand** — Archiv (v31.08), nur lesen |

`gsFlushOfflineQueue` lief bis v32.13 ueber `STORES` (alle fuenf) und loeschte
jeden Satz, den es nicht einordnen konnte. Gemessen: **1 Foto eingereiht → 0
uebrig, 2 Eintraege archiviert → 0 uebrig.** Beides lautlos, beides bei jedem
Start, und der falsche Flush war immer 600 ms schneller als der richtige.

**Wer eine neue Ablage anlegt, traegt sie in `STORES` ein — und nur dann
zusaetzlich in `SYNC_STORES`, wenn dieser Flush sie auch uebertragen kann.**

Und die Regel dahinter, die ueber IndexedDB hinausgeht: **eine Schleife ueber
„alles" ist eine Annahme ueber Zustaendigkeit.** Sie stimmt so lange, bis
jemand eine Ablage dazulegt, die anders funktioniert — und dann faellt es
niemandem auf, weil Loeschen keine Fehlermeldung erzeugt.

**Seit v32.22 prueft er auch das EIGENTUM an den Warteschlangen.** v31.04 hat
diesen Fehler im `localStorage` schon einmal behoben — `gs_sync_queue`
ueberlebte den Logout, die `user_id` wird aber erst BEIM FLUSH eingesetzt, also
landeten ungesendete Vorgaenge von Nutzer A im Konto von Nutzer B. **In
IndexedDB stand er weiter**, und dort geht es um Scans, Fotos und das Archiv:
`gsScanPersistToCloud` schreibt fuer den gerade Angemeldeten, `gsUploadImage`
laedt in dessen Bucket.

Seit v32.22 traegt jeder Satz die `uid` seines Einreichers
(`gsQueueOffline` · `gsQueuePhoto` · `gsArchiveDropped`), und der Flush
**ueberspringt** Fremdes statt es zu loeschen. Wer eine neue Ablage anlegt,
stempelt sie ebenso.

Drei Regeln daraus, alle allgemein:

- **„Beim Abmelden wegwerfen" ist die schnelle und die falsche Antwort.** Dann
  verliert A seine offline gemachte Arbeit in genau dem Moment, in dem er sich
  abmeldet — die Arbeit, fuer die die Warteschlange existiert. Ueberspringen
  statt loeschen, und ein Deckel (90 Tage) fuer das, was nie abgeholt wird.
- **Ein Pruefstand, der einen Zustand nur halb herstellt, prueft ab dem Moment
  etwas anderes, als er behauptet.** Die drei neuen Fragen liessen die
  bestehenden 6, 8 und 9 rot werden: „angemeldet" war dort nur ein Token, und
  Eigentum braucht eine `uid`.
- **Ein Fall misst seine eigene Grundlinie.** Die Zaehler-Frage erwartete eine
  feste Zahl (2 archivierte) und mass 4, weil eine fruehere Frage als
  derselbe Nutzer schon archiviert hatte. Feste Zahlen, die eine andere Frage
  mitbestimmt, gehen bei der naechsten Erweiterung kaputt, ohne dass am Code
  etwas falsch waere.

**Gegenprobe gemacht:** die zwei Eigentums-Zeilen aus `index.html` entfernt →
der Pruefstand meldete sofort „B hat den Scan von A ins eigene Konto
geschrieben" und „B hat das Foto von A in den eigenen Bucket geladen".

**Seit v32.15 prueft er auch den BILD-CACHE.** Regel 4 des Service Workers
legt jedes Bild ab — Kartenkacheln eingeschlossen (swisstopo steht auf keiner
Ausnahmeliste, OpenStreetMap schon). Eine Obergrenze gab es nicht; geleert
wurde nur durch einen Versionswechsel, also durch Zufall statt durch Entwurf.

Das ist nicht bloss Speicherplatz: geht der Platz aus, raeumt der Browser auf
— und mancher raeumt den **ganzen Ursprung** ab, mitsamt `localStorage`.
Dieselbe Sorgfalt, die dieses Repo seit v30.98 den 5 MB localStorage widmet,
gehoert der Cache-API erst recht.

**Zwei Regeln aus dem Bau, beide allgemein:**

- **Ein Deckel, der alle N Eintraege nachsieht, ist ein ZIEL, keine
  Schranke.** Die echte Obergrenze ist `ZIEL + INTERVALL` plus das gerade
  Unterwegse — und genau so muss sie heissen (`IMAGE_CACHE_MAX`,
  `IMAGE_CACHE_INTERVALL`), statt eine Schaerfe zu behaupten, die es nicht
  gibt. Der erste Lauf meldete rot bei 516 von 500: die Zahl war richtig, die
  ERWARTUNG war falsch.
- **Ein Fall muss weit genug ueber das Ziel hinausfahren, um „gedeckelt" von
  „nicht gedeckelt" zu unterscheiden.** Bei 560 geholten Kacheln liegen beide
  Antworten zu nah beieinander; bei 900 nicht (900 → 507 mit Deckel, ~900
  ohne). Und er faehrt den ECHTEN Weg — die Kacheln gehen wirklich durch den
  Service Worker (der Pruefserver liefert dafuer `/__kachel/<n>.png`), sonst
  waere nicht geprueft, ob der Deckel ueberhaupt ausgeloest wird.

**Und die Grenze, ehrlich benannt:** wie gross der Cache in der Praxis wird,
ist von hier aus NICHT messbar — die Kachel-Server sind aus dieser Umgebung
nicht erreichbar. Geprueft ist der Mechanismus, nicht die Zahl.

**`a11y_check.js` (seit v32.16) fragt, was keiner der elf anderen fragt:
laesst sich die App bedienen, wenn man sie NICHT SIEHT oder die Maus nicht
benutzt?** `touch_check` misst die Groesse einer Flaeche, `contrast_check` die
Lesbarkeit eines Textes — beides setzt voraus, dass jemand hinsieht.

Erster Lauf: **18 Stellen im Code, 213 Elemente auf dem Bildschirm** trugen
ein `onclick` auf einem `div` ohne `tabindex` und ohne `role`. Fuer die Maus
ein Knopf, fuer die Tastatur unsichtbar. Betroffen war der INHALT — 81
Suchergebnisse, 40 Rezepte, 40 Heilmittel. Kein Absturz, keine Meldung.

Beide Zahlen stehen im Bericht, und das ist Absicht: **eine Karten-Vorlage
erzeugt vierzig Karten, und EINE Reparatur behebt sie alle.** Nur „18" zu
melden verharmlost, nur „213" laesst es unloesbar aussehen.

Die Antwort war eine zentrale Nachruestung (`gsTastaturNachruesten` +
EIN Zuhoerer fuer Enter/Leertaste + `MutationObserver`), nicht achtzehn
Einzelpflaster — die naechste Renderstelle haette den Fehler wieder
mitgebracht. Sie laeuft in `requestIdleCallback`, weil der erste Durchgang auf
einem Mittelklasse-Telefon 35 ms kostet.

**Drei Lehren aus dem Bau, alle allgemein:**

1. **Reparatur und Pruefung brauchen DIESELBE Regel.** Meine Nachruestung
   machte bei Karten mit eigenen Knoepfen die UEBERSCHRIFT fokussierbar (ein
   Knopf im Knopf waere falsch) — der Pruefstand sah nur auf den Kasten und
   meldete 80 Karten als unerreichbar, die es laengst nicht mehr waren.
   Dieselbe Falle wie die zwei Matcher in v32.02, diesmal von mir gebaut.
   Und: **gemessen wird die Struktur** (`tabindex` + `role`), nie ein Merkmal,
   das die App sich selbst anheftet — `data-tast` waere eine Selbstauskunft.
2. **„Hat einen Schatten" beweist keinen Fokusrahmen.** Karten und Knoepfe
   dieser App haben ohnehin einen. Nachweisbar ist nur der UNTERSCHIED
   zwischen fokussiert und nicht fokussiert — derselbe Knopf, zweimal
   gemessen.
3. **Eine neue Auszeichnung kann einen anderen Pruefstand verwirren.**
   `touch_check` sprang von 0 auf 79: die neuen `role="button"`-Titel sind
   352x18 px. Sie sind aber TASTATUR-Ziele; angetippt wird die ganze Karte,
   und WCAG 2.5.8 meint die Flaeche, die den Zeiger annimmt. Die Regel dort
   kennt das jetzt — aber **eng**: der erste Anlauf haette auch ein echtes
   kleines Herz-Symbol in einer Karte durchgewinkt. Gegenprobe mit DREI
   Faellen, nicht mit einem.

**Seit v32.21 prueft er auch FENSTER** — bis dahin nur die elf Tabs, waehrend
`contrast_check` laengst in sechs Fenstern misst. Modale sind aber gerade die
Stellen mit den meisten Eingaben (Planer, Eingrenzen, Korrektur). Geprueft
werden „Ohne Netz eingrenzen", der Bluehkalender und das Scan-Ergebnis;
geoeffnet ueber die oeffentlichen Oeffner, nicht ueber nachgebaute Zustaende.

**Und die Zahl daneben ist Pflicht — mit der richtigen Bezugsgroesse.** Der
erste Anlauf meldete „1'275 Bedienelemente" fuer ein Fenster mit vier
Auswahlfeldern: das war die Zahl des GANZEN DOKUMENTS, mit und ohne offenes
Fenster dieselbe. Sie haette also auch dann gestimmt, wenn gar nichts
aufgegangen waere. Gezaehlt wird jetzt, was IM Fenster steht (308 / 88 / 11) —
drei verschiedene Zahlen sind der Beleg, dass wirklich drei Fenster gemessen
wurden. Dieselbe Falle wie in v31.78, diesmal von mir selbst gebaut.

**Zwei Gegenproben, und die erste war die lehrreichere:** einem Auswahlfeld
das `aria-label` genommen → **kein Fund**, und das ist RICHTIG: die Felder
stehen in einem umschliessenden `<label>`, das sie bereits benennt. Erst ein
Feld ganz ohne Namen (und ein Bild ohne `alt`) im Fenster wird gemeldet. Eine
Gegenprobe, die den Fall nicht herstellt, beweist nichts — auch dann nicht,
wenn sie plausibel aussieht.

**Was er bewusst NICHT tut:** einen Screenreader ersetzen. Er misst die
maschinell nachweisbare Haelfte; ob ein Name auch VERSTAENDLICH ist, kann nur
ein Mensch beurteilen. Und er meldet nur SICHTBARES — ein Feld in einem
geschlossenen Fenster ist fuer niemanden ein Problem.

**`i18n_check.js` (seit v32.17) — und die eine Regel der Sprachschicht, die
nirgends stand.** Uebersetzungen werden ueber die DEUTSCHE PHRASE
nachgeschlagen:

```js
keyBundle[key] = srcMap[ GS_I18N_JS_STRINGS[key] ]
```

Daraus folgt: **ein `_t`-Schluessel ohne Eintrag in `GS_I18N_JS_STRINGS` wird
nie nachgeschlagen** und zeigt in allen vier Sprachen seinen deutschen
Rueckfall — fuer immer, ohne Fehlermeldung. Erster Lauf: **45 solche
Schluessel**, darunter der ganze Bildschirm „Mein Naturjahr".

Zwei Muster, die daraus folgen und beim Schreiben zu beachten sind:

- **Ein Schluessel, EINE deutsche Phrase.** `_t(key, n === 1 ? 'a' : 'b')`
  laesst sich nicht nachschlagen — Einzahl und Mehrzahl brauchen zwei
  Schluessel. Dasselbe, wenn derselbe Schluessel einmal als sichtbare
  Beschriftung („✓ Erledigt") und einmal als `aria-label` („Erledigt")
  gebraucht wird.
- **Tabelle und Aufrufort muessen denselben deutschen Text tragen.**
  Nachgeschlagen wird der TABELLENwert; der Rueckfall am Aufrufort erscheint
  nur auf Deutsch. Gehen sie auseinander, liest ein deutscher Nutzer einen
  anderen Satz als ein franzoesischer.

**Und die Regel fuer solche Angleichungen: erst nachsehen, welche Fassung
uebersetzt VORLIEGT.** In v32.17 hatten die Tabellenwerte alle vier Sprachen
und die Aufrufvarianten keine einzige — die andere Richtung haette drei
funktionierende Uebersetzungen zerstoert.

Die zwei wichtigsten Fragen pruefen nicht den Quelltext, sondern die SCHICHT:
die App wird ein zweites Mal geladen, mit untergeschobenem Sprachpaket in
`gs_i18n_bundles`. Ein Schluessel MIT Uebersetzung muss sie zeigen, einer OHNE
muss auf Deutsch zurueckfallen statt den rohen Schluesselnamen zu zeigen —
**ohne die zweite Richtung waere eine Schicht, die alles auf den
Schluesselnamen wirft, ebenfalls gruen.**

**Was er nicht prueft:** ob die Uebersetzung in der Datenbank existiert und ob
sie gut ist. Das braucht Netz und Sprachkenntnis. Er prueft, ob eine
vorhandene Uebersetzung ueberhaupt ankommen KANN.

**Und noch eine Falle, die kein Pruefstand sieht:** `_t` ist KEINE globale
Funktion. Jede Funktion legt sich einen eigenen Alias an
(`var _t = (window.gsI18n && gsI18n.t) ? gsI18n.t : function(k,f){return f;}`).
Das ist richtig so — er bindet beim AUFRUF, nicht beim Laden. Wer `window._t`
prueft, prueft eine Variable, die es nie gab; die oeffentliche Schnittstelle
heisst `gsI18n.t`.

**`backend_check.js` (seit v32.18) prueft die NAHT** — die App spricht 97 RPCs
und 111 Tabellen/Views in Supabase an; existiert jede davon? Ein Aufruf ins
Leere sieht nach nichts aus: PostgREST meldet einen Fehler, die App faengt ihn
ab, die Ansicht bleibt leer.

Er vergleicht gegen eine **Momentaufnahme im Repo**
(`docs/backend-inventar.json`), nicht gegen die lebende Datenbank. Preis: sie
veraltet — deshalb nennt der Bericht IMMER ihr Datum; eine Zahl ohne Datum
waere eine Behauptung. Gewinn: er laeuft ohne Netz und ohne Zugangsdaten wie
die anderen dreizehn, und VOR dem Ausliefern.

**Drei Klassen, nicht zwei** — daran haengt, ob so ein Pruefstand brauchbar
bleibt:

- **rot** — angesprochen, existiert nicht, nichts vorbereitet.
- **offen** — existiert nicht, aber eine Migration liegt bereit. Kein Fehler im
  Code, sondern eine Aufgabe fuer jemanden mit Schreibrecht. Wird NAMENTLICH
  genannt, nie stillschweigend durchgewunken.
- **neu** — seit der Momentaufnahme dazugekommen; heisst: nachziehen.

Ohne die mittlere Klasse waere `comment_reactions` dauerhaft rot und der
Pruefstand damit wertlos.

**Eine Lehre aus v32.20, die JEDEN Pruefstand betrifft, der nach Namen
sucht:** `wiring_check` Richtung 3 kannte nur `open…` / `gsOpen…` / `show…`.
Dieses Repo benennt aber auch auf Deutsch — `gsKorrekturOeffnen` (v32.05) und
`gsEingrenzenOeffnen` (v32.20) fielen beide durch das Muster. **Zwei Fenster,
die nie jemand geprueft hat, ohne dass irgendetwas rot war.** Muster
erweitert; wer eine neue Namensform einfuehrt, traegt sie dort nach.

**Und noch einmal die Farbregel, diesmal in der anderen Richtung:**
`--g-dark` und `--g-light` KIPPEN im Dunkelmodus (dort ist `--g-dark` das
HELLE Gruen). In v32.20 habe ich „vorsorglich" eine `body.dark`-Zeile
geschrieben und damit dunkelgruen auf dunkelgruen erzeugt — 1,23:1. Der
Basiswert war in beiden Modi richtig. **Eine Farbe erst aendern, wenn der
Messwert da ist** — nicht vorbeugend, und auch nicht auf Verdacht.

**Und die Grenze, die dabei gilt und die keine Sitzung ueberschreiten
sollte:** `STATUS.md` (2026-08-31 y) fuehrt eine LISTE OFFENER MIGRATIONEN,
die bewusst NICHT angewandt sind. Eine fruehere Sitzung hat sie gegen das
Live-Schema vorgeprueft und die Anwendung Fernando ueberlassen. DDL auf einer
Produktivdatenbank mit laufenden Zahlungen ist nichts, was nebenbei passiert —
auch dann nicht, wenn die Migration im Repo liegt, idempotent ist und man den
Zugang haette. Nachmessen: ja, jederzeit, nur lesend. Anwenden: nein.

**Was beim Nachmessen aufgefallen ist und allgemein gilt:** ein Rueckstand
veraltet auch. Eine der fuenf Zeilen stand seit zwei Tagen auf „offen",
obwohl der Trigger laengst da war. Wer so eine Liste liest, misst sie besser
nach, statt sie zu glauben.

**`kamera_check.js` (seit v32.29) prueft die Rechnung hinter dem Sucherbild.**
Anlass war Fernandos Satz „immer wenn ich ein Scan machen moechte ist die
Kamera in einem Zoom". **Sie war es nie.** Zwei Ursachen, beide im Code:

1. Angefordert wurde **1920x1080 — Querformat** — und gezeigt mit
   `object-fit: cover` in einem hochkanten Streifen. Nachgerechnet fuer ein
   uebliches Telefon (412x750 sichtbar): das Bild wird auf 1333x750 skaliert,
   sichtbar bleiben 412 — **69 % des Bildwinkels liegen ausserhalb.** Das
   sieht aus wie ein Zoom und ist ein Zuschnitt; kein Zoom-Knopf holt es
   zurueck. (Die Abhilfe von v32.29 war falsch — siehe den Kasten unten.)
2. `gsSetZoom` klemmte auf eine **geratene** Spanne 1,0–5,0. Auf Telefonen,
   deren Weitwinkel bei `zoom.min = 0.5` beginnt, war der weiteste Bildwinkel
   damit unerreichbar. Die Spanne kommt jetzt aus
   `track.getCapabilities().zoom`.

**UND DIE TEUERSTE LEHRE (v32.30): die richtige Ursache, die falsche Abhilfe.**
v32.29 hat aus dem Zuschnitt gefolgert, man muesse der Kamera ein hochkantes
Format ABVERLANGEN. Eine Kamera kann ihren Bildwinkel aber nicht vergroessern —
ein vorgegebenes Seitenverhaeltnis ist ein **Zuschnitt-Auftrag an den Sensor**:

```
Sensor liefert    1.778  (16:9)
angefordert       0.549  (Behaelter hochkant)
bleibt vom Winkel   31 %
```

Dieselben 31 % wie vorher, nur frueher — und damit auch im aufgenommenen Foto.
Es wurde SCHLIMMER als der Zustand, den es reparieren sollte.

> **Ein Zuschnitt in der ANZEIGE ist umkehrbar, einer in der QUELLE nicht.**
> Wer etwas zurueckhaben will, darf es nicht an einer frueheren Stelle
> wegnehmen. Das gilt weit ueber Kameras hinaus — fuer jede Kette, in der
> Daten erst erhoben und dann dargestellt werden.

Seit v32.30 wird der Kamera **kein** Seitenverhaeltnis vorgegeben (nur ein
Aufloesungswunsch im nativen 4:3), und die Vorschau nutzt `object-fit: contain`.
`kamera_check` haelt beides fest.

**Die Regel, die daraus folgt:** eine Spanne, die man nicht beim Geraet
erfragt hat, ist geraten — und Geraeteklassen unterscheiden sich hier
tatsaechlich.

**v32.32 hat drei weitere Fehler behoben, alle auf EINER Aufnahme von Fernandos
Telefon sichtbar — und alle drei aus dieser Sitzung.** Sie sind hier
festgehalten, weil jeder davon eine Regel traegt, die weit ueber die Kamera
hinausgeht.

**0 · Und v32.34 hat das Ganze wieder VEREINFACHT.** Fuenf Fassungen in zwei
Tagen, jede mit mehr Technik als die davor — v32.32 loeste es mit einer
CSS-Variablen, zwei Ereignis-Zuhoerern und einem Timer. Dasselbe Bild liefern
drei Zeilen: `width:100%; height:100%; object-fit:contain` in einem
bildschirmfuellenden Kasten. Alles andere ist ersatzlos weg.

> **Was ohne Zutun richtig ist, braucht kein Zutun.** Wer an einer Stelle
> mehrfach nachbessert, sollte pruefen, ob die einfachste Regel das Ergebnis
> nicht von selbst liefert — statt Technik hinzuzufuegen, um es zu erzwingen.

`kamera_check` misst das entsprechend **rechnend** statt ablesend: fuer drei
Seitenverhaeltnisse muss das dargestellte Bild GANZ in den Kasten passen
(sonst beschnitten) UND mindestens eine Kante BERUEHREN (sonst kleiner als
noetig). Gegengeprueft mit `cover` (ragt hinaus) und einem verkleinerten
Kasten (fuellt den Rahmen nicht).

**1 · Ein Viertel des Bildschirms schwarz.** v32.31 hat den RAHMEN aufs
Bildformat geschrumpft; die Bedienelemente haengen mit `position:absolute;
bottom:0` an ihm und rutschten mit.

> **Ein Rahmen, an dem etwas anderes haengt, darf sich nicht nach seinem
> Inhalt richten.**

Seither traegt das `<video>` das `aspect-ratio`, nicht der Rahmen.

**1b · Und zwei aeltere Streifen, die nie jemand gemessen hat.** `.screen::after`
haengt an JEDEN Bildschirm 80 px Luft fuer die Tab-Leiste — die auf dem Scanner
ausgeblendet ist. Und `.scan-wrap` rechnete die Bildschirmhoehe von Hand nach
(`calc(100dvh − --st − --top-h − --sb − --tab-h)`) und zog dieselbe Tab-Leiste
ein zweites Mal ab. Die gerechnete Hoehe ist **ersatzlos** gestrichen; die
Hoehe kommt jetzt aus dem Layout. Dafuer musste `#screen-scanner` sein inline
`position:relative` abgeben — es ueberschrieb das `position:absolute` aus
`.screen` und machte den Bildschirm-Kasten **inhaltshoch** statt bildschirmhoch
(womit nebenbei auch `#scan-result` mit seinem `inset:0` zu kurz war).

> **Eine Groesse, die aus dem Layout kommt, kann nicht danebenliegen — eine
> nachgerechnete schon.**

**2 · „Linse 1 · Linse 2 · Linse 3 · Linse 4".** Android nennt seine Kameras
`camera2 0, facing back`; daraus wird kein Name. Und die Leiste stand
ZUSAETZLICH zum Zoom-Regler, der auf Android bereits alle Objektive abdeckt.

> **EINE Aufgabe, EIN Bedienelement.** Zwei Wege zum selben Ziel sind keine
> Wahlfreiheit, sondern eine Zumutung.

Die Leiste erscheint jetzt nur, wenn das Geraet **keinen** steuerbaren Zoom
meldet (iOS, wo die Objektive die Stufen sind).

**3 · „1.0x" am weitesten Punkt.** Die Anzeige normierte auf `zoom.min` — bei
einer 0,5–8-Kamera stand am weitesten Punkt „1.0x" (sieht aus wie „kein
Zoom") und am Anschlag „16.0x" (gab es nie). Jetzt steht dort der Wert des
Geraets, wie in jeder Telefon-Kamera-App. Die Normierung war gut gemeint:
sie sollte nichts erfinden, was die Schnittstelle nicht hergibt. Sie hat
stattdessen etwas VERAENDERT, was die Schnittstelle klar sagt.

**Und die Frage nach der toten Flaeche war in drei Anlaeufen gruen, ohne etwas
zu pruefen** — je nach Bezug: Rahmen gegen Abschnitt (schrumpfen gemeinsam),
Knoepfe gegen die Tab-Leiste (die auf dem Scanner ausgeblendet ist, Rechteck
0x0 — es wurde mit lauter Nullen gerechnet), Knoepfe gegen `#screen-scanner`
(der Kasten schrumpft im Fehlerfall MIT: gemeldet wuerden 80 px statt 470).

> **Ein Bezug, der mit dem Fehler mitwandert, verharmlost ihn.** Gemessen wird
> gegen den einzigen Kasten, der nie mitwandert — hier `#app`
> (`position:fixed` ueber den ganzen Bildschirm).

**Dazu eine Messfalle, die JEDEN Pruefstand betrifft:** `.screen.active > *`
traegt `animation: rrFadeSlideUp .42s … both` mit
`from{transform:translateY(12px)}`. Wer einen Abschnitt sichtbar schaltet und
**sofort** misst, misst einen Keyframe — ich habe eine halbe Stunde einen
16-px-Versatz gesucht, den es 420 ms spaeter nicht mehr gibt.

> **Ein Element, das gerade sichtbar geworden ist, wird erst NACH seiner
> Eintritts-Animation vermessen.**

Neun Fragen, alle mit gestellten Faehigkeiten: Seitenverhaeltnis folgt dem
Behaelter · Spanne kommt vom Geraet · weitester Punkt erreichbar · am oberen
und am unteren Anschlag uebernimmt die Nachbarlinse · ohne Zoom-Faehigkeit
sind die Linsen die Stufen (iOS) · bei Ablehnung aendert sich die Anzeige
nicht · ist keine Linse mehr da, sagt die App das · die Objektivnamen kommen
aus der Beschriftung, sonst eine Nummer.

**Zwei Fallen beim Bau, beide schon bekannt und trotzdem wieder eingetreten:**

- **Der Fall muss hergestellt UND nachgewiesen werden.** `.scan-wrap` haengt
  unter `#screen-scanner`, das ausserhalb eines laufenden Scans auf
  `display:none` steht — ein verborgener Vorfahre macht jede Groesse zu 0,
  auch bei `position:fixed`. Beide Messungen lieferten deshalb den
  FENSTER-Rueckfall, also denselben Wert, und der Fall waere gruen gewesen,
  ohne etwas zu zeigen. Er misst jetzt die hergestellte Groesse mit und faellt
  durch, wenn sie 0 ist.
- **Eine Attrappe ist kein MediaStream.** `video.srcObject = …` wirft bei
  einem gestellten Objekt; der Linsenwechsel schlug daran fehl, nicht am
  Code. Im Pruefstand wird `srcObject` deshalb entschaerft.

**`tour_check.js` (seit v32.39) fragt, ob die App-Tour auf etwas ZEIGT.**
Anlass war Fernandos „eine bessere App Tour". Vor dem Bauen gemessen — und
der erste Befund war der lehrreiche: Karte 2 sagte „Tippe unten auf
‚Scanner'", und die Tab-Leiste war in genau diesem Moment **0x0 px gross**.
Die Karte rief `switchTab('scanner')`, das setzt `body.gs-scanner-active`, und
die Regel dazu (v23.69) blendet die Leiste aus. **Die Tour versteckte den
Knopf, auf den sie zeigte.** Dazu: kein Zurueck, keine Tastatur, keine
Hervorhebung, null Uebersetzungsschluessel.

> **Eine Tour, die nur erzaehlt, ist ein Text. Eine Tour, die ZEIGT, ist eine
> Tour.** Und was sie zeigt, muss sichtbar sein — sonst zeigt sie auf nichts.

Seit v32.39 nennt jede Karte ein `ziel` (echter CSS-Selektor), ein Ring hebt
es hervor, und die Karte weicht nach oben aus, wenn das Ziel unten steht.
**Gegenprobe mit der alten Fassung: vier von sieben Fragen rot.**

Drei Dinge aus dem Bau, alle allgemein:

- **Der Scheinwerfer GLEITET** (CSS-Uebergang). Die erste Fassung mass 90 ms
  nach dem Rendern und meldete drei von vier Karten als „passt nicht" — der
  Ring sass 300 ms spaeter genau. Dieselbe Falle wie in v32.32.
- **Eine Ueberdeckungs-Frage muss zuerst pruefen, dass es etwas zu ueberdecken
  GIBT.** In der Gegenprobe war die Tab-Leiste 0x0, und „kein Ueberlapp mit
  einem unsichtbaren Ziel" meldete gruen — die Frage konnte im Fehlerfall gar
  nicht rot werden.
- **Berechnete Schluessel entziehen sich `i18n_check`.** Die Karten bauen
  `t + '_title'` / `t + '_body'`; eine Textsuche nach `_t('…')` sieht davon
  nichts. `i18n_check` hat deshalb eine Frage bekommen, die DATENLISTEN
  ausdruecklich eintraegt — dieselbe Antwort wie bei `MENU_ITEMS` und
  `GS_NOTIF_ZIELE` in `wiring_check`. **Wer eine weitere solche Liste baut,
  traegt sie dort ein.**

**`einstellungen_check.js` (seit v32.33) faehrt die Versprechen der Schalter
wirklich durch.** Anlass war ein Audit des Einstellungs-Bildschirms aus sechs
Blickwinkeln: 48 Stellen, 20 davon haben eine gegnerische Gegenpruefung
ueberstanden. Der rote Faden war derselbe wie im ganzen Repo — **ein Schalter,
der etwas behauptet, das niemand nachgesehen hat.** Die drei schwersten:

| Schalter | sagte | war |
|---|---|---|
| Push-Master | „🔔 Push-Notifications aktiv!" | Browser-Abonnement da, Serverzeile nie geprueft — ohne sie kommt nie ein Push |
| GPS | „✅ GPS aktiv — Standort wird automatisch erkannt" | Browser hatte die Freigabe entzogen, die App wusste es und las den falschen Speicher |
| „Kamera immer neu abfragen" | „jede Anfrage bestaetigen" | genau EINE Bestaetigung, beim ersten Scan; zwoelf weitere Kamera-Wege kannten den Schalter nie |

Drei Regeln daraus, alle allgemein:

- **Zwei Speicher fuer dieselbe Frage sind ein Fehler, der auf sein Datum
  wartet.** `gs_gps_perm` (App) und `gs_perm_location` / `gsPermState`
  (Browser) beantworteten beide „darf ich orten?", und niemand glich sie ab.
  Wo zwei Speicher dieselbe Frage beantworten, gewinnt der, der sie
  beantworten DARF — hier der Browser.
- **Dasselbe beim Zuruecksetzen: wer einen Zustand raeumt, raeumt ALLE
  Kopien.** Der Kamera-Schalter loeschte `gs_cam_perm` und liess
  `gs_perm_camera` und `gsPermState.camera` stehen — und `gsRequestCamera`
  liest genau die.
- **Dreizehn Aufrufstellen brauchen EINE Nachruestung, nicht dreizehn
  Pflaster** (dieselbe Entscheidung wie bei der Tastatur in v32.16). Das Tor
  fuer „jede Anfrage bestaetigen" sitzt an `navigator.mediaDevices
  .getUserMedia` selbst — der einzigen Stelle, durch die alle muessen. Die
  naechste Kamera-Stelle bringt den Fehler damit nicht wieder mit.

**v32.35 hat ihn auf 13 Fragen erweitert** — Einstellungs-Suche, Namen,
Kopfzeile, Klebeverhalten. Drei Lehren aus dem Bau, alle allgemein:

- **Eine Suche darf nicht davon abhaengen, wie der Inhalt AUSGEZEICHNET ist.**
  Die Einstellungs-Suche kannte nur `.settings-row`. Die 18 Bedienelemente des
  Push-Panels waren damit gar nicht auffindbar (8 von 8 Suchwoertern:
  „Keine Einstellung gefunden.", waehrend das Wort sichtbar dastand), und
  Karten mit Zeilen blieben umgekehrt bedingungslos stehen. Jetzt gibt es EINE
  Regel fuer jeden Rumpf, und sie fragt den Text ausserhalb der Zeilen mit.
- **Ein Name ist nicht `aria-label`.** Er entsteht auch aus einem
  umschliessenden `<label>` mit Text, aus `for`, aus `title`. Die erste
  Fassung dieser Frage suchte nach `aria-label` und haette neun korrekt
  benannte Kaestchen als namenlos gemeldet. Gemessen wird der ECHTE
  Barrierefreiheits-Baum ueber CDP (`Accessibility.getPartialAXTree`).
- **Und sie mass im ZUGEKLAPPTEN Zustand** — neun Elemente statt
  einunddreissig, und meldete „alle benannt". Aufgefallen ist das nur, weil
  die Gegenprobe (Nachruestung ausgebaut) **gruen blieb**.

  > **Eine Gegenprobe, die gruen bleibt, ist der Beweis, dass die Frage nichts
  > misst — nicht dass alles in Ordnung ist.**

Dazu zwei Fundstuecke, die ueber die Einstellungen hinausgehen:

- **Ein `overflow`, das nie etwas abschneidet, ist kein harmloses Beiwerk.**
  `#settings-scroll` trug `overflow-y:auto` und hat NIE gescrollt
  (`scrollHeight === clientHeight`) — war damit aber der Scrollport, gegen den
  das `position:sticky` der Suche rechnet. Die Suche bewegte sich 1:1 mit dem
  Scrollweg.
- **`--accent` gibt es in dieser Datei nicht** (0 Definitionen, 3 Nutzungen).
  Ein `var(--X, fallback)` mit einem Namen, den niemand definiert, ist eine
  feste Farbe mit Tarnkappe: sie kippt nicht mit dem Modus und faellt keinem
  auf, der nach Farbnamen sucht.

**v32.36 kam der Cloud-Abgleich der Einstellungen dazu** (16 Fragen). Drei
Fehler, die einander verstaerkt haben — und zwei Regeln daraus:

> **Ein Pull, der ERSETZT statt zu mergen, ist kein Abgleich, sondern ein
> Rueckschnitt auf das, was der Server zufaellig kennt.** `gsPrefsPull`
> schrieb die Serverzeile als neuen `gs_prefs`-Block; gemessen wurden aus 19
> Einstellungen sechs. Zusammen mit „drei Schalter pushen nie" heisst das:
> Kompakt- und Senioren-Modus wurden nie hochgeladen UND beim naechsten Pull
> geloescht — auch auf dem Geraet, auf dem sie gesetzt wurden. Und der Pull
> laeuft alle 120 Sekunden.

> **Ein Automatismus, den zwanzig Stellen von Hand umgehen, ist keiner mehr.**
> Der Auto-Track fuer `STATE_KEYS` patcht `Storage.prototype.setItem` — dieses
> Repo hat seit v30.98 eine EIGENE `localStorage.setItem`-Eigenschaft, die den
> Prototyp vollstaendig verdeckt. Zwanzig Stellen rufen `markDirty('state')`
> deshalb ausdruecklich auf, mit Kommentaren wie „Auto-Track ist geshadowed".
> Wer eine neue Stelle baut, die einen STATE_KEY schreibt, ruft ihn ebenso —
> sonst reist der Wert nur zufaellig.

Dazu ein drittes Muster: **ein Pull muss WIRKEN, nicht nur schreiben.**
`gsPrefsPull` schrieb Speicher und Variable und rief keine `apply*`-Funktion;
der Bildschirm sagte danach etwas anderes als der Speicher, und beim naechsten
`loadPrefs()` sprang die Oberflaeche ohne erkennbaren Anlass um.

**v32.37 kamen die zerstoerenden Aktionen dazu** (19 Fragen). Drei Regeln:

> **Eine Loeschung nach PRAEFIX ist eine Wette darauf, dass niemand je einen
> Schluessel anders benannt hat.** „Alle Daten loeschen" raeumte `gs_` und
> `ps_`; von 36 Schluesseln blieben zwei — `greenscan_markers` (Fundorte mit
> GPS) und `userLocation`. Genau die Daten, wegen denen jemand den Knopf
> drueckt.

> **Die zerstoerende Antwort darf nie die bequemste sein.** `gsConfirmModal`
> fokussierte den OK-Knopf und liess Enter bestaetigen — bei JEDEM
> `kind:'danger'`-Dialog. Escape auf „Abbrechen" war schon richtig; die
> Vorauswahl war die falsche Haelfte.

> **Die Rueckfrage gehoert in die FUNKTION, nicht an den Aufrufort.** Vier
> Wege fuehrten zum Sperren und zum Lifetime-Abo, drei ohne Rueckfrage. Wer
> die Frage am Aufrufort platziert, laesst jede neue Aufrufstelle neu
> entscheiden — hier haben sich drei von vier falsch entschieden.

Zwei Messfallen aus derselben Sitzung, beide allgemein:

- **`location.reload` laesst sich nicht zuverlaessig ersetzen.**
  `Object.defineProperty(location,'reload',…)` sah gestellt aus und
  navigierte trotzdem. Abfangen laesst sich statt dessen der TIMER — der
  geplante Neustart ist damit sogar besser belegt als ein abgewarteter.
- **`Object.keys(localStorage)` zaehlt in diesem Repo nicht nur Eintraege.**
  Die eigenen `setItem`/`getItem`/`removeItem`-Eigenschaften am
  localStorage-Objekt tauchen dort auf. Ueber `localStorage.length` /
  `key(i)` zaehlen.

**v32.38 schloss das Audit ab** (21 Fragen, alle 24 bestaetigten Meldungen
behoben). Drei Regeln aus der letzten Welle:

> **Eine Wahl, die bestaetigt und nicht umgesetzt wird, ist schlimmer als
> keine Wahl.** `gsGetLocationFor('weather')` gab es seit v28.03 und
> funktionierte — es rief nur niemand auf (zwei Treffer im Repo: Definition
> und `window`-Zuweisung). Die Zeile „Wetter-Standort" setzte einen Haken,
> zeigte einen Toast, und alle fuenf Wetter-Verbraucher loesten den Ort selbst
> auf. Niemand meldet so etwas, weil das Ergebnis plausibel aussieht.

> **Wer einen Schalter entfernt, entfernt auch seinen Wert.** Neun Felder in
> `DEFAULT_PREFS` ueberlebten das Entfernen ihrer Schalter (v29.21) und ihrer
> `toggleMap`-Eintraege (v31.11). `safetyWarnings: true` stand damit in der
> Datenbank und liess auf abschaltbare Giftwarnungen schliessen, die es nicht
> gibt.

> **Gemessen wird der VERTRAG einer Funktion, nicht das, was sie zufaellig
> zurueckgibt.** `gsGetWeatherLocation()` gibt nichts zurueck — sie setzt
> `_gsWeatherLat`/`_gsWeatherLon`/`_gsWeatherCity`. Mein erster Anlauf gab
> dort ein Objekt zurueck und haette die drei Variablen nie gesetzt. Die
> erste Fassung der Pruefstands-Frage las den Rueckgabewert und haette den
> Umbau durchgewinkt.

Dazu, aus derselben Stelle: **ein Pruefstand, der abstuerzt, hat nichts
gemessen.** Eine Frage muss auch dann MELDEN, wenn die Funktion dahinter
kaputt ist — sonst ist die Gegenprobe weder rot noch gruen.

**v32.40 hat die elf ungeprueften Meldungen des Audits selbst nachgemessen**
(29 Fragen; zehn bestaetigt und behoben, eine nicht nachstellbar). Vier
Messfallen dabei, alle vier haben ZUERST FALSCH gemeldet — und alle vier
gelten fuer jeden Pruefstand mit mehreren Fragen in EINEM Lauf:

- **Eine Frage, die nach einer Loeschung misst, misst die Loeschung.** Eine
  fruehere Frage faehrt `clearAllData()`; die spaeteren massen „Regler 0 px"
  und „Backup liefert immer null".
- **Wer einen Zustand braucht, stellt ihn HER — er schaltet ihn nicht um.**
  `gsSettingsToggleAll()` kippt; nach vorherigen Fragen war der Zustand
  unbekannt.
- **Eine Attrappe, die mehr ersetzt als noetig, misst die Attrappe.** Ein
  `gsStore.get`-Stub, der fuer alles ausser einem Schluessel den Vorgabewert
  zurueckgibt, hungert jede Funktion aus, die den Speicher liest.
- **Eine Zaehlung im Quelltext zaehlt auch Kommentare und Aufraeumlisten.**
  Die Frage nach `gs_perm_geolocation` meldete rot fuer eine Reparatur, die
  schon da war. Gezaehlt wird der SCHREIBER (`setItem('…')`), nicht die
  Erwaehnung.

**Und eine Frage, die es ohne v32.34 nicht gaebe:** geht die Kamera-Anfrage
bei AUSGESCHALTETEM Schalter unveraendert durch? Das Tor lief als
`async function`, also mit einem `await` vor dem Durchreichen. Gemessen wird
mit einer Attrappe UNTER dem Tor (im `addInitScript`, bevor die App ihr Tor
baut), die vermerkt, ob eine vom Aufrufer gesetzte Marke noch steht.

> **Ein Riegel, der nur fuer wenige gilt, darf den Weg der vielen nicht
> anfassen.**

**Zwei Sperren stellt er ausdruecklich, statt sie zu umgehen:**
`Notification.requestPermission` (ohne Antwort bricht der Push-Weg ab, bevor
irgendetwas passiert) und `location.reload` (der Sprachwechsel laedt die Seite
neu und nimmt den Pruefstand mit).

**Gegenprobe gemacht** — alle Reparaturen einzeln zurueckgebaut: der
Pruefstand meldete jede davon rot, mit den echten Zahlen daneben
(`{"abgelehnt":true,"leer":true,"ok":true,"abgemeldet":true}`).

**Grenze:** es gibt hier weder eine echte Kamera noch einen echten
Supabase-Server. Geprueft ist die RECHNUNG und die AUSSAGE — was die App aus
einer Antwort macht, nicht ob die Antwort echt ist.

**`versprechen_check.js` (seit v32.28) stellt `save_check`s Frage STATISCH
ueber alle.** `save_check` faehrt einzelne Wege wirklich zu Ende — genauer,
aber Handarbeit je Weg (7 Eintraege). Die App hat **103 Schreibvorgaenge**.

Und er stellt sie schaerfer, denn **nicht jeder fehlende Blick ist ein
Fehler**: ein stiller Hintergrund-Schreibvorgang darf scheitern, er verspricht
ja nichts. Zum Fehler wird es erst, wenn die App dem Nutzer sagt
„gespeichert", ohne nachgesehen zu haben. Drei Klassen: **rot** (Versprechen
ohne Pruefung) · **gruen** (Antwort angesehen) · **still** (kein Versprechen,
wird nur gezaehlt).

Erster Lauf: **vier rot, alle vier echt.** Doktor-Rueckmeldung,
Schaedling-Eintrag, Duengungs-Eintrag und die Bio-Auszeichnung eines Inserats
— Letztere nannte „🌱 Bio" in der Bestaetigung, auch wenn genau der PATCH,
der dieses Feld schreibt, abgelehnt worden war.

**Die Regel dahinter, und sie gilt fuer jeden Schreibvorgang:** `sbFetch`
WIRFT NICHT. Ein `try/catch` faengt nur Netz- und JS-Fehler; eine Ablehnung
laeuft mitten hindurch. Und PostgREST liefert bei einer von RLS abgewiesenen
Zeile **0 Datensaetze und keinen Fehler**. Seit v32.28 gibt es dafuer
`_gsSchreibOk(r)` — beides in einer Zeile, damit die naechste Stelle es nicht
wieder einzeln macht. Wer `Prefer: return=minimal` schickt, macht die
Ablehnung uebrigens UNSICHTBAR; fuer geprueftes Schreiben gehoert dort
`return=representation` hin.

Drei Fallen aus dem Bau, alle allgemein:

- **Eine Absage ist kein Versprechen.** Nach der Reparatur meldete der
  Pruefstand meine eigenen Fehlermeldungen — „Eintrag NICHT gespeichert"
  enthaelt „gespeichert". Wer nach Wortstaemmen sucht, braucht die
  Verneinung.
- **Ein Zeichen, das zwei Dinge bedeuten kann, taugt nicht als Merkmal.** 🚫
  stand in meiner Absage-Liste und heisst in dieser App „Pestizid-frei" — es
  hat den einen echten Fund verschluckt.
- **Reparatur und Pruefung brauchen dieselbe Regel** (schon v32.16): der neue
  Helfer `_gsSchreibOk` musste in die Erkennung, sonst meldet der Pruefstand
  jede Stelle rot, die ihn benutzt.

`--alle` zeigt auch gruen und still. **Ein Pruefstand, der nur Fehler druckt,
laesst offen, WARUM eine Stelle nicht auffaellt** — daran habe ich beim Bau
zweimal falsch geraten.

**Grenze:** rein statisch. Wer die Antwort in einem HELFER prueft, den die
Funktion aufruft, wird rot gemeldet. Ein Treffer ist ein Verdacht, kein
Urteil — wie bei `field_check.py`.

**`sync_check.js` (seit v32.23) fragt die Umkehrung zu `save_check`:** dieser
prueft, ob das Gespeicherte im Geraet ankommt — jener, ob es aus der Cloud
auch **zurueckkommt**.

Die App schiebt drei Blobs hinaus (`user_plants` · `user_gardens` ·
`user_app_state`), gebaut aus **47** localStorage-Schluesseln. Der Rueckweg
(`stateMap` im Pull) ist eine **andere**, von Hand gepflegte Liste. Erster
Lauf: **46 von 47.** Der fehlende war `gs_reminder_prefs` — seit v24.26 im
Blob, in keiner Zeile des Rueckwegs, und vom Server-Cron gelesen. Die
abgeschaltete Erinnerung war serverseitig wirksam und nur EINEM Geraet
bekannt; das zweite schickte sein leeres `{}` hoch und schaltete sie wieder
ein.

**Die Schluesselliste liest er aus dem QUELLTEXT** (aus den drei Blob-Bauern),
nicht aus einer eigenen Tabelle. Wer dem Blob ein Feld hinzufuegt, ist damit
automatisch geprueft — und Frage 7 meldet ihn, solange er keinen Probewert
hinterlegt hat. Eine Liste, die man pflegen muesste, veraltet; eine, die sich
aus dem Code speist, nicht.

Zwei Fallen aus dem Bau, beide allgemein:

- **`gsCloudSync.flushNow()` ist nicht der Weg.** Das ist der Beacon-Pfad
  (`sync = true`) und geht mit rohem `fetch` an `sbFetch` vorbei — die
  Attrappe sieht nichts. Der erste Lauf meldete „0 Tabellen gepusht" und
  haette damit ALLE 47 Felder als fehlend gemeldet. Der echte Weg im Betrieb
  ist `markDirty(scope)` → `flushDebounced` (500 ms). **Ein Pruefstand, der
  nichts sieht, sieht auch keinen Fehler** — erst pruefen, ob er ueberhaupt
  etwas misst.
- **Falsche Probewerte ERFINDEN Befunde.** Mit `gs_streak = '{"n":7}'` meldete
  der Lauf vier Fehler, die keine waren: `_gsStreakApplyCloud` macht
  `parseInt` daraus und steigt bei `NaN` richtigerweise aus; mit einem Tag von
  vorgestern greift die Lueckenpruefung. In v31.98 haben falsche
  Beispieldaten einen echten Fehler VERDECKT — hier haetten sie drei
  erfunden. Beide Richtungen kosten dieselbe halbe Stunde.

**Und eine Regel fuer den Pull-Schutz:** der Guard aus v28.97 („ein leeres
Cloud-Array darf keine gefuellte lokale Liste ersetzen") prueft seit v32.23
auch **Objekte**. `ps_votes`, `gs_wissen_read`, `gs_dq_stats` und
`gs_reminder_prefs` sind keine Listen — fuer sie galt der Schutz nie.
**Derselbe Verlust, andere Klammern.** Wer einen Schutz fuer eine Datenform
baut, sieht nach, welche anderen Formen dieselbe Stelle passieren.

**Grenze:** geprueft wird der Weg localStorage → Blob → localStorage. Ob die
Cloud den Blob wirklich annimmt (RLS, Spaltentypen), sagt nur ein echter
Server; dafuer ist `save_check` mit seinen SERVER_WEGEN zustaendig.

**`storage_check.js` (seit v32.21) fragt, was auf dem Geraet LIEGEN BLEIBT,
wenn sich jemand abmeldet.** Keiner der vierzehn anderen fragte das — und
genau dort lag eine Klasse, die seit v29.10 **sechsmal** einzeln repariert
wurde (v29.10, v29.19, v29.44, v30.94, v30.97, v31.12): jedes Mal ein Fund,
jedes Mal ein Nachtrag in `GS_USER_KEYS`, nie eine Pruefung dahinter.

Erster Lauf: von 209 gesetzten Schluesseln ueberlebten **130** das Abmelden,
**123 davon standen in keiner Liste** — darunter `ps_api_key` (der persoenlich
hinterlegte Anthropic-Schluessel), `gs_global_api_key`, `gs_auth_db` (lokale
Anmelde-Ablage mit E-Mail-Adressen) und `gs_admin_pw_hash`. Dazu die zweite
Haelfte, die den Fund erst teuer macht: `getApiConfig()` las beide Schluessel
**ohne jede Anmelde-Pruefung** — auf einem geteilten Geraet scannte der
naechste Nutzer auf Rechnung des vorigen.

**Die Regel, die seither gilt und die der Pruefstand durchsetzt:**

> Jeder Schluessel, der das Abmelden ueberlebt, muss **namentlich** in
> `GS_KEEP_ON_LOGOUT` (oder `GS_KEEP_PREFIXES`) stehen.

`GS_KEEP_ON_LOGOUT` gab es seit v26.69 — mit neun Eintraegen und der Ansage im
eigenen Kopf: *„Dient als Doku."* **Eine Doku, die nichts erzwingt, waechst
nicht mit.** Wer einen neuen Schluessel anlegt, traegt ihn in eine der beiden
Listen ein, sonst meldet der Pruefstand ihn.

Fuenf Fragen (A ueberlebt/unbenannt · B in `GS_USER_KEYS` und ueberlebt
trotzdem · C als bleibend gefuehrt, aber weg · D in beiden Listen · E in einer
Liste, im Quelltext unbekannt). **Zwei Gegenproben, beide stellen den Fall
wirklich her** — ohne die zweite waere eine Pruefung, die C gar nicht mehr
rechnet, ebenfalls gruen.

Drei Dinge aus dem Bau, die allgemein gelten:

- **Ein Praefix ist kein Schluessel.** Der erste Bericht meldete
  `gs_aicalls_` als unklassifiziert — diesen Schluessel gibt es nie, nur
  `gs_aicalls_<datum>`. Praefix-Familien brauchen eigene Listen
  (`GS_USER_PREFIXES` / `GS_KEEP_PREFIXES`) und eigene Probewerte.
- **Ein sauberer Speicher ist kein sauberer Bildschirm.** `marketListings`,
  `farmState` und `_gsDev.registry` spiegeln geloeschte Schluessel im
  Arbeitsspeicher; ohne Ruecksetzen zeigt die Oberflaeche bis zum naechsten
  Neuladen die Inserate des vorigen Kontos. Und: bei `let` **wirft** ein
  `typeof` in der zeitlichen Totzone — jede Zuweisung braucht ihr eigenes
  `try/catch`.
- **Eine Schranke ist nicht dasselbe wie eine Loeschung.** Auf
  Bestandsgeraeten liegt der Schluessel schon; ihn bei einer bloss
  ABGELAUFENEN Sitzung zu vernichten waere Datenverlust an etwas, das der
  Nutzer selbst eingetippt hat. Deshalb gibt `getApiConfig()` ohne Anmeldung
  nichts heraus, statt zu loeschen — und der User-Wechsel-Zweig raeumt auf,
  sobald wirklich jemand anderes kommt.

**Grenze, ehrlich benannt:** geprueft wird der `localStorage`. IndexedDB und
die Cache-API prueft er **nicht** — dafuer ist `offline_check` zustaendig
(seit v32.22 mit den Eigentums-Fragen, siehe unten). Ein Foto in der
Warteschlange ueberlebt das Abmelden weiterhin; es geht seither aber nur noch
an das Konto, das es aufgenommen hat.

**Seit v32.25 oeffnet `contrast_check` JEDES Fenster selbst.** Bis dahin mass
er SECHS — die App hat rund vierzig. Fuer alles andere galt die Ansage aus
diesem Abschnitt: „wer Farbe in einem Modal setzt, das der Pruefstand nicht
oeffnet, rechnet selbst nach". **Niemand rechnet selbst nach.**

Die Liste von Hand zu verlaengern waere der falsche Weg gewesen — sie
veraltet, wie jede gepflegte Liste. Stattdessen dieselbe Entdeckung wie in
`wiring_check` Richtung 3: jeder Oeffner ohne Parameter, dessen Rumpf
`openModal(` enthaelt, wird wirklich aufgerufen und vermessen. **Neue Fenster
sind damit ab dem Tag ihrer Entstehung vermessen.** Die sechs von Hand
gestellten bleiben — sie brauchen Daten, die kein Oeffner allein herbeiruft
(Musterplan, Scan-Ergebnis).

Der erste Lauf fand **44 Stellen im Hellmodus und 56 im Dunkelmodus**, in
Fenstern, die noch nie jemand gemessen hatte. Vier Ursachen, und alle vier
sind allgemeine Regeln:

| Ursache | Regel |
|---|---|
| Text aus einem KIPPENDEN Merkmal auf FEST heller Flaeche | Eine feste Flaeche braucht eine FESTE Schrift. `--g-dark` wird im Dunkelmodus `#a5d6a7` — auf einem festen Pastellton sind das 1,0:1. |
| Fest dunkelgruene Schrift (`#1a3d1a`) auf einer Flaeche, die im Dunkelmodus dunkel wird | Umgekehrt: eine Schrift auf einer THEMEN-Flaeche nimmt ein Merkmal, keine feste Farbe. |
| FLAECHE aus `--g-main` / `--g-dark` / `--c-success` mit weisser Schrift | Fuellungen nehmen `--fill-brand` (hell `#1f6b2f`, dunkel `#2b7530` — beide tragen Weiss). Die Grün-Merkmale sind MARKEN-Toene und kippen. |
| `opacity` auf TEXT, um einen Zustand zu zeigen | Deckkraft senkt den Kontrast BLIND — sie fragt nicht, worauf der Text steht. „Gesperrt" zeigt man mit `filter:grayscale(1)` oder einer anderen Textfarbe. |

**Eine Lehre aus dem Aufraeumen selbst, und sie ist teuer:** ich habe
`background:#2e7d32;color:#fff;` global durch `var(--fill-brand)` ersetzt und
damit **21 nie gemessene Stellen** mitgenommen; die Ruecknahme traf dann 122
Stellen, weil die Gegenrichtung auch die urspruenglichen `--fill-brand`-Nutzer
erwischte. Die Datei war beschaedigt und musste aus dem letzten Commit
zurueckgeholt werden. **Eine Suchen-und-Ersetzen-Aktion ueber eine 5-MB-Datei
ist keine Aufraeumarbeit, sondern ein Eingriff** — jede Ersetzung braucht eine
erwartete Trefferzahl, gegen die sie prueft (`viele(alt, neu, name, 7)`), und
Farben werden nur geaendert, wo ein Messwert vorliegt.

**Seit v31.78 misst `contrast_check` in ZWEI Fenstern** — KI-Planer und
Blühkalender — und der Bericht nennt **je Fenster die Zahl der vermessenen
Textstellen**. Ohne diese Zahl sieht ein Fenster, das gar nicht aufging,
genauso aus wie eines ohne Fehler; genau das ist beim Einbau passiert (das
Aufräumen nach dem ersten Fenster blendete `#modal-content` mit aus). Zwei
weitere Regeln stecken drin: was von etwas **Festem oder Klebendem**
überlappt wird und was ein **scrollender Vorfahre abschneidet**, wird nicht
vermessen — `elementFromPoint` hilft im zweiten Fall nicht, weil es dort den
Vorfahren liefert und der das Element *enthält*, die Prüfung es also
durchwinkt.

**Und zwei Grenzen, die v32.12 gezeigt hat — beide gelten fuer jeden
Pruefstand, nicht nur fuer diesen:**

1. **Ein Pruefstand misst, was er ERREICHT.** Die neue Vorauswahl-Zeile machte
   die Scan-Karte hoeher; dadurch rutschte der Knopf „Gegenprobe starten"
   erstmals in den vermessenen Bereich — und meldete **2,15:1**. Der Fehler
   war seit v32.10 da. Ein neuer Fund heisst also nicht, dass die letzte
   Aenderung ihn verursacht hat; vor dem Beheben nachsehen, **seit wann** die
   Stelle so aussieht (`git stash` + denselben Pruefstand laufen lassen).
2. **Was keine Textstelle ist, sieht er nie.** Der Haken der Schrittliste ist
   ein `background-image` mit weissem SVG-Strich — im Dunkelmodus weiss auf
   `#a5d6a7`, also 1,64:1 und damit ein leerer Kreis. Kein Pruefstand hat das
   gemeldet, gefunden wurde es beim Nachsehen eine Zeile hoeher. Dasselbe gilt
   fuer `::before`-Inhalte und SVG-Fuellungen.

Und die Ursache in beiden Faellen war dieselbe wie in v31.20: **ein
`-d`-Token ist eine TEXTfarbe, keine Fuellung.** `--c-danger-d` ist hell
`#b71c1c` und dunkel `#ef9a9a`; als Hintergrund mit `color:#fff` ist das
einmal 6,6:1 und einmal 2,15:1. Wer eine Flaeche faerbt, nimmt eine feste
dunkle Farbe oder schreibt eine `body.dark`-Regel dazu.

**Seit v31.77 misst `contrast_check` auch im Planer-Fenster.** Er rendert den
KI-Planer mit dem Musterplan aus `scripts/_seed.js` (`MUSTERPLAN` +
`AGRONOMIE`), **ungefaltet** — ohne `gsPPTabify`, weil verborgene Abschnitte
nicht gemessen werden — und scrollt ihn in Bildschirmhöhen durch. Der erste
Lauf fand **24 Stellen hell und 19 dunkel**, darunter „Vorbeugen:" mit 1,08:1
(heller Text auf fest weissem Kasten) und den Knopf „Plan speichern" mit
2,70:1. Wer ein weiteres Fenster prüfen will: dieselbe Stelle in
`contrast_check.js` erweitern, nicht einen zweiten Prüfstand bauen.

**Seit v32.07 fragt `touch_check` zweierlei:** zu kleine Antippflaechen *und*
Bedienelemente, die **seitlich aus dem Bildschirm ragen**. Ein Knopf halb
draussen ist so unerreichbar wie einer mit 8×8 px. Gemeldet wird nur, was im
NORMALEN FLUSS liegt — `position:absolute` ist ausgenommen, sonst meldet er die
grossen Emoji-Wasserzeichen hinter den Ueberschriften (Wissen, Rezepte,
Heilmittel, Community), die absichtlich ueber den Rand ragen.

Zwei Dinge aus dem Bau, die allgemein gelten:

- **Eine Gegenprobe, die den Fall nicht herstellt, beweist nichts.** Der erste
  Versuch (`width:600px`) wurde vom Flex-Container auf 380 px gestaucht und ragte
  gar nicht hinaus. Erst `min-width:600px` erzeugt den Fall.
- **Ein ad-hoc-Skript ist kein Gegenbeweis zu einem gegengeprueften Pruefstand.**
  Zwei Debug-Skripte massen den Marktplatz-Knopf „innerhalb" und brachten mich
  dazu, den Fix zurueckzunehmen — der Pruefstand meldete ihn danach sofort
  wieder. Wer widersprechende Messungen hat, misst beide Staende mit
  **demselben** Werkzeug.

**`touch_check` misst seit v32.25 ZWEI Breiten** — 412 px und 320 px (iPhone SE,
aeltere Android-Geraete). Eine Antippflaeche, die bei 412 passt und bei 320 aus
dem Bild laeuft, faellt sonst niemandem auf; der Bericht nennt die Breite bei
jedem Fund. **Seine andere Grenze bleibt** — es misst nur die elf
Bildschirme. Und für Farbe gilt unverändert: **wer Farbe in einem Modal setzt,
das der Prüfstand nicht öffnet, rechnet selbst nach.**

**Drei Fallen beim Kontrast-Messen**, alle in v31.77 durchgemacht:

1. **Ein Verlauf macht `backgroundColor` durchsichtig.** Wer die Elternkette
   hochsteigt, misst einen Grund, der gar nicht dort ist.
2. **Verlaufsstufen sind oft `rgba(…, 0.08)`.** Deckkraft ignorieren heisst
   mit sattem Dunkelgrün rechnen, wo fast Weiss steht — 13 Fehler, die es
   nicht gibt.
3. **Was von etwas Festem oder Klebendem überlappt wird, darf nicht vermessen
   werden.** Hit-Testing allein reicht nicht: eine Kopfleiste mit
   `pointer-events:none` fängt keinen Treffer ab und verdeckt trotzdem.

Das ist kein akademischer Hinweis. In v31.76 habe ich wegen Falle 1 zwölf
Stellen von `#88a888` auf `var(--muted)` geändert — auf dem dunklen 3D-Feld
sind das **6,87:1 vorher und 1,83:1 nachher**. Eine gute Stelle kaputt gemacht,
um eine Falschmeldung zu bedienen. In v31.77 zurückgenommen. **Eine Farbe erst
ändern, wenn der Messwert reproduzierbar ist.**

**Und: eine feste Farbe kann selten beide Modi bedienen.** `#bf360c` ist hell
richtig (5,6:1) und dunkel falsch (2,8:1). Für Text auf Themenflächen die
Variablen nehmen (`--c-warn-d`, `--c-success-d`, `--text`); umgekehrt braucht
eine **fest helle** Fläche eine **fest dunkle** Schrift — dort wird
`var(--c-success-d)` im Dunkelmodus zu Hellgrün auf Hellgrün.

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
