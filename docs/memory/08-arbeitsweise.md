# 08 · Arbeitsweise — von der Messung bis zum Merge

Jede Aenderung an GreenScan ist eine **Scheibe**: klein genug fuer eine
Version, gross genug fuer einen Pruefstand-Fall. So geht eine Scheibe, in der
Reihenfolge, in der sie gegangen wird. Keine Stufe wird uebersprungen; jede
hat eine Ausgabe, die man vorzeigen kann.

## 0 · Vor dem ersten Edit

```
git fetch origin main && git status         # bist du auf dem aktuellen Stand?
sed -n '1,40p' STATUS.md                     # was ist gerade in Arbeit?
node scripts/austausch.mjs holen             # was haben ANDERE Sitzungen gefunden, gefragt, vorgeschlagen — und wer arbeitet parallel?
```

Du bist nicht die einzige Sitzung. Was du findest und nicht selbst behebst,
was du nicht messen konntest und was dir einfaellt, gehoert aufs Brett
(`node scripts/austausch.mjs hilfe`, Regeln: `docs/austausch/README.md`) —
und der STATUS-Eintrag am Ende traegt zwei feste Zeilen: `**Offen:**` (mit
`brett:<id>` oder „nichts") und `**Nicht geprüft:**`.

Arbeite in einer **Kopie** (`tar --exclude=.git -cf - . | (cd KOPIE && tar -xf -)`),
nie im Repo selbst, solange die Suite nicht gruen ist. Beide Dateien eines
Vergleichs muessen im Repo-Verzeichnis liegen — `data/plants.v1.js` loest
sonst nicht auf und die Artenliste ist leer (CLAUDE.md §7.1, v32.96).

## 1 · Messen

Bevor etwas gebaut wird, wird der Ist-Zustand vermessen: `grep -n` mit
Zeilennummern, ein Zaehlskript ueber die Daten, ein Pruefstand-Lauf. Die
Messung steht in einer Datei (`befunde.md`), jede Zeile mit Beleg. Ein
Sprachmodell — auch Lina, auch du — weiss nicht zuverlaessig, was in seinem
eigenen Kontext steht: **was eine KI ueber sich selbst sagt, wird gemessen
wie alles andere.**

## 2 · Entwerfen

Ein kurzer Entwurf mit den Entscheidungen, die zu treffen sind, und je einem
Grund. Regel, die ueber alles geht (PLANER-V3, CLAUDE.md §4b): **Was der Code
ausrechnen kann, entscheidet nie die KI allein.** Jede rechnende Regel hat
drei Zustaende — erfuellt · verletzt · nicht pruefbar — nie `{}` oder `0` fuer
„keine Daten".

## 3 · Pruefstand zuerst

Der Fall wird geschrieben, BEVOR der Code geaendert wird, und gegen den alten
Stand gefahren: er muss **rot** sein. Ein Fall, der schon vorher gruen ist,
misst nichts. Regeln fuer einen Fall (`04-pruefstaende.md` hat die Liste):

- Er stellt den Zustand HER (Uhr, Speicher, Attrappe), er schaltet ihn nicht um.
- Er misst die WIRKUNG (gerendertes HTML, gespeicherter Wert), nicht das Objekt.
- Er kennt beide Richtungen: guter Fall UND schlechter Fall.
- Er nennt eine Zahl, die im Fehlerfall anders waere.

## 4 · Code

So klein wie moeglich. Ein Suchen-und-Ersetzen ueber die 5,7-MB-Datei ist ein
Eingriff, keine Aufraeumarbeit: jede Ersetzung mit erwarteter Trefferzahl
(`assert s.count(alt) == 1`). Kommentar am Ort mit Version und dem GRUND
(was war gemessen, warum so) — der naechste Leser hat diese Sitzung nicht.

## 5 · Gegenprobe

Die Reparatur EINZELN zurueckbauen (in einer weiteren Kopie), den Fall fahren:
**rot, mit der echten Zahl** („3 von 12 verpasst"). Dann Reparatur zurueck,
gruen. Eine Gegenprobe, die gruen bleibt, beweist, dass der Fall nichts misst
— nicht, dass alles in Ordnung ist. Nachsehen, ob der Rueckbau wirklich
gegriffen hat (ein Skript, das nichts geaendert hat, sieht aus wie eine
bestandene Gegenprobe).

## 6 · Nachbarn und die Suite

Erst die Pruefstaende, die deine Dateien lesen (`robust_check` fuer neue
Funktionen ohne Aufrufer, `i18n_check` fuer neue Texte, `storage_check` /
`sync_check` fuer neue Schluessel, `wiring_check` fuer neue `onclick`). Dann
ALLE:

```
GS_PG_URL=postgresql://postgres@127.0.0.1:54329/postgres bash scripts/pruefstaende.sh
# Erwartung: „N Pruefstaende · rot: 0 · nicht pruefbar: 0"
```

Dauer 15–25 Minuten. `perf_check` misst nur und urteilt nie.

## 7 · Bump

Fuenf Marker, immer zusammen (`robust_check` Fall 24 haelt sie zusammen):

| Marker | wo |
|---|---|
| `<meta name="app-version" content="33.33.20260915">` | `index.html` `<head>` |
| `var GS_VERSION = 'v33.34';` | `index.html` |
| `const VERSION = 'gs-v33.34';` | `sw.js` |
| `# GreenScan — Cloudflare Pages Security Headers (v33.34)` | `_headers` Zeile 1 |
| neuer Eintrag GANZ OBEN in `window.GS_RELEASES` | `index.html` |

Der Eintrag: `{v, date, headline, summary, user_summary, user_items: [{emoji, bold, text}], items: []}`.
`user_items` sind OBJEKTE, Emoji als ZEICHEN (`'📚'`, nie `'\U0001f4da'`).
Inline hoechstens 20 Eintraege — der aelteste wandert an den ANFANG von
`data/releases.v1.js`. Fehlt der Eintrag, bleibt „Was ist neu" bei allen still.

## 8 · Doku

- `STATUS.md`: Routine-Eintrag oben (`### <Datum> (<kuerzel>) - vXX.YY: <Satz>`)
  UND die Stand-Zeile in §1 (`**Version**: \`vXX.YY\``). Beides.
- `CLAUDE.md` §7.1: die Regel, die du gelernt hast — als Kasten, mit Version.
- Diese `docs/memory/`-Dateien, wenn sich eine Regel oder ein Eigner aendert.
- Ein Befund ist ein Protokoll: alte Messungen werden nicht auf den heutigen
  Stand umgeschrieben (v32.94).

## 9 · Commit, PR, CI, Merge

```
git -c user.name="Seros" -c user.email="seros@users.noreply.github.com" commit -F msg.txt
git push -u origin claude/<thema>-<id>
```

Commit-Betreff `vXX.YY: <Satz>`, Rumpf mit Bereichs-Bullets. PR gegen `main`;
**CI muss gruen sein** (`.github/workflows/pruefstaende.yml` faehrt alle mit
Postgres). Ein gruener Lauf auf der eigenen Maschine ist keine Aussage ueber
den Runner (v33.x: 32 von 32 rot, weil ein Pfad fest verdrahtet war). Squash-
Merge, dann den Branch nachziehen:

```
git fetch origin main && git reset --hard origin/main
git push --force-with-lease -u origin claude/<thema>-<id>
```

**Und Zwischenstaende werden gepusht, nicht nur gespeichert** (v33.55). Der
Container einer Cloud-Sitzung wird zwischendurch neu aufgesetzt — mitten in
v33.55 waren danach Worker, Manifest, `_redirects`, der Seiten-Block und elf
Pruefstands-Faelle weg; nur der gepushte Zwischenstand-Commit stand noch, und
mit ihm verschwanden auch die nachinstallierten Android-Werkzeuge (`apk_check`
sagt dann „nicht pruefbar", nie gruen). Ein Commit + Push je fertigem Teil
kostet nichts; der Merge buendelt sie ohnehin.

Nie direkt auf `main`. Nie DDL auf der Produktivdatenbank — Migrationen
liegen in `supabase/migrations/` und heissen „nicht angewandt", bis Fernando
sie anwendet. Nie „live verifiziert" schreiben, ohne zu sagen womit — die
Live-Seite ist aus einer Cloud-Sitzung nicht erreichbar (`CONNECT … 403`).

## 9b · Ein breiter Audit ist ein Workflow, nicht acht lose Agenten

Seit v33.59 liegt er im Repo: `.claude/workflows/greenscan-audit.js` — acht
Blickwinkel (`robust` · `escape` · `datum` · `edge` · `sw` · `css` · `daten` ·
`android`), je ein Auditor (nur lesend) und ein Gegenpruefer, der jeden Fund zu
widerlegen versucht. `args.linsen` waehlt aus, `args.scratch` sagt, wohin die
Agenten schreiben (nie ins Repo). Fuer EINEN Auftrag gibt es zwei Rollen:
`.claude/agents/gs-auditor.md` und `gs-gegenpruefer.md`. Das ist Werkzeug von
Claude Code; eine andere KI liest die Dateien als Auftragstext — die Regeln
darin gelten fuer jede.

Warum ein Workflow: acht lose Agenten rissen am 11.11.2026 zweimal am
Nutzungslimit, bevor einer berichtet hatte. Ein Workflow merkt sich jeden
fertigen Agenten und laesst sich fortsetzen. Und jeder Auditor schreibt seine
Funde ZUERST in eine Datei. Was der Audit findet, wird NICHT ungeprueft
behoben: ein Fund ist erst einer, wenn ein Fall ihn gegen den alten Stand rot
zeigt (`docs/AUDIT-2026-11-11.md`: 70 Funde aus zwei Laeufen, 49 bestaetigt,
21 teilweise, keiner widerlegt).

Drei Dinge aus dem ersten Gebrauch (11.11.2026): **(1)** ein Workflow, der in
der laufenden Sitzung entsteht, ist unter seinem NAMEN noch nicht bekannt —
`Workflow({ scriptPath: '.claude/workflows/greenscan-audit.js', args: … })`
geht immer. **(2)** Vor dem Lauf `git fetch origin main` und nachziehen: der
zweite Lauf las einen Stand, den `main` schon ueberholt hatte, und drei seiner
Funde waren dort laengst behoben. **(3)** Was offen bleibt, kommt mit einem
Anker aufs Brett (`node scripts/austausch.mjs einspielen <stapel.json>`) —
ein Sicherheitsfund nur mit Titel, Stichworten und `details_bei`.

## 10 · Was eine Zusammenfassung ist

Eine Aufgabenliste, ein Kommentar, eine Release-Notiz — alles, was sagt „ist
gebaut", wird gegen `git show` gelesen, bevor es weitergeschrieben wird. Die
Zusammenfassung zu v33.31 nannte drei Dinge als geliefert, die in keinem
Commit standen; gefunden hat es ein Messender (v33.33). **Eine Zusammenfassung
ist kein Diff.**
