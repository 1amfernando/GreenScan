# 01 · Projekt — was GreenScan ist und was du von hier aus nicht kannst

## In fuenf Zeilen

- **Schweizer PWA fuer Naturbestimmung**: 3'136 Arten in 4'337 Eintraegen
  (`data/plants.v1.js`; Pflanzen, Pilze, Baeume, Kraeuter, Moose, Flechten,
  Algen). Dazu: Meine Pflanzen mit Pflege-Aufgaben, Garten mit Beeten und
  Pflanzungen, Kalender, KI-Planer, Quiz, Community, Marktplatz, Lina (KI-Coach).
- **Ein Monolith**: `index.html` (rund 6 MB, HTML + CSS + JS; Zeilenzahl: `STATUS.md` §1),
  kein Build, kein npm im Root. Editieren = ausliefern.
- **Backend**: Supabase (Auth, Storage, Postgres mit RLS), Edge-Functions
  (Deno) in `supabase/functions/`, Migrationen in `supabase/migrations/`
  (wie viele: `STATUS.md` §1 — die eine Stelle, an der die Zahlen nachgemessen werden).
  **Seit v33.59 liegt eine Sicherheitsreparatur im Repo, deren Server-Seite NICHT
  live ist** (sechs Migrationen `20261110_*`, die ueberarbeiteten Functions) —
  bis Fernando sie anwendet bzw. ausliefert, sind die Luecken aus ihren Koepfen
  live offen. Reihenfolge: FUER-FERNANDO §30.
- **KI**: Claude ueber `callAI` / `callVisionAI`; der globale Schluessel geht
  durch die Edge-Function `ai-proxy`, nie in den Browser.
- **Hosting**: Cloudflare Pages (`greenscan-app`) UND Netlify
  (`green-scanswitzerland`), beide liefern das Repo-Wurzelverzeichnis aus.
  `_headers` (CSP, HSTS) und `_redirects` gelten auf beiden.

## Wo was liegt

```
index.html            die App (Funktions-Praefixe: gs* oeffentlich · _gs* intern · sb* Supabase · dq* Quiz)
data/plants.v1.js     Artenliste · data/releases.v1.js  Changelog-Archiv
sw.js                 Service Worker (Cache-Version = App-Version)
scripts/              Pruefstaende + _seed.js (Beispieldaten) + pruefstaende.sh (alle)
                      + package-lock.json (eingecheckt, CI faehrt `npm ci`)
scripts/sicherheit/ · scripts/edge/ · scripts/rls/   Fall-Dateien der drei Sicherheits-Pruefstaende (v33.59)
assets/               Leaflet, Three.js, pdf.js (assets/pdfjs/<version>/), Schriften (assets/fonts/) — alles selbst gehostet
supabase/functions/   Edge-Functions; _shared/*.mjs = Regeln, die Deno UND Node importieren
supabase/migrations/  SQL, alle idempotent; „nicht angewandt" steht dabei, bis es angewandt ist
docs/                 lebende Doku (KALENDER-V1, PLANER-V3, SCANNER-V3, OEKOSYSTEM-V1, FUER-FERNANDO)
docs/_archiv/         55 historische Auftraege — nicht die Gegenwart
CLAUDE.md             das ausfuehrliche Tagebuch · STATUS.md  was laeuft · ROADMAP.md  was kommt
```

`docs/`, `scripts/`, `supabase/` werden mit ausgeliefert (Web-Root = Repo) —
mit `X-Robots-Tag: noindex`. Neue interne Dateien gehoeren nach `docs/`, nie in
den Root. Keine Geheimnisse in Dateien.

## Versionen und Branches

- Version `vMAJOR.MINOR` (z. B. `v33.33`), fuenf Marker je Bump
  (`08-arbeitsweise.md` §7). `GS_RELEASES[0].v` muss `GS_VERSION` sein, sonst
  bleibt „Was ist neu" bei allen Nutzern still.
- `main` ist Produktion; nie direkt pushen. Feature-Branches
  `claude/<thema>-<id>`, PR-Merge (squash) mit gruener CI.
- Commits sind als **Seros** signiert
  (`git -c user.name="Seros" -c user.email="seros@users.noreply.github.com"`).
  Eigentuemer des Repos ist **Fernando**.

## Was du von einer Cloud-Sitzung aus NICHT kannst — und deshalb nicht behauptest

| Geht nicht | Warum | Stattdessen |
|---|---|---|
| Die Live-Seite aufrufen (`green-scan.ch`, Vorschau-Adressen) | Netzsperre, `CONNECT … 403` fuer alles ausserhalb der Freigabeliste | App lokal rendern (`scripts/render_check.js`), CI-Lauf am PR lesen |
| Die KI aufrufen | kein Netz zu Anthropic | Prompts werden mit Attrappen geprueft; was gelten soll, RECHNET der Code (§4b) |
| DDL auf der Produktivdatenbank | laufende Zahlungen, Fernandos Entscheidung | Migration ins Repo, „nicht angewandt" dazuschreiben; lesend messen ist erlaubt (`execute_sql`, Projekt `vowbiueikwrauuceilhc`) |
| Deno ausfuehren | nicht installiert | Regeln in `_shared/*.mjs` (ESM), von Node geprueft (`ingest_check`, `sensor_push_check`, `loeschung_check`, `edge_check`); die Zahlungs-Functions laufen in `edge_check` als echte `index.ts` in Node 22 |
| Stripe-Werkzeuge | OAuth fehlt in der Sitzung | nichts an Zahlungen aendern |

Wer „live verifiziert" schreibt, sagt womit. Sonst ist es geraten.

## Datenschutz (revDSG) — die Regel, die ueber Features geht

Analytics ist **Opt-in** (`_gsAnalyticsErlaubt()`), jedes Ereignis steht im
Vokabular `GS_EVENTS` mit erlaubten Feldern — ohne Eintrag wird es verworfen.
Keine Fotos, kein Standort, keine Pflanzennamen, kein Eingabetext in einem
Ereignis. Keine Ortung ueber IP. Daten in der EU. Seit v33.59: Fotos verlassen
das Geraet ohne Metadaten (`_gsBildOhneMeta`), ein Ort geht an Dritte nur
gerundet (`_gsOrtGrob`), ein oeffentlicher Name nie aus der E-Mail
(`_gsOeffentlicherName`), und jeder externe Host steht in beiden
Datenschutztexten (`sicherheit_check` 97_empfaenger). Was getrackt wird, wird
auch gelesen (`fn_admin_analytics`) — sonst ist es Speicherplatz.
