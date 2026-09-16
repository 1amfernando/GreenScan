# 08 · Arbeitsweise — von der Messung bis zum Merge

Jede Aenderung an GreenScan ist eine **Scheibe**: klein genug fuer eine
Version, gross genug fuer einen Pruefstand-Fall. So geht eine Scheibe, in der
Reihenfolge, in der sie gegangen wird. Keine Stufe wird uebersprungen; jede
hat eine Ausgabe, die man vorzeigen kann.

## 0 · Vor dem ersten Edit

```
git fetch origin main && git status         # bist du auf dem aktuellen Stand?
sed -n '1,40p' STATUS.md                     # was ist gerade in Arbeit?
```

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
# Erwartung: „35 Pruefstaende · rot: 0 · nicht pruefbar: 0"
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
**CI muss gruen sein** (`.github/workflows/pruefstaende.yml` faehrt alle 35 mit
Postgres). Ein gruener Lauf auf der eigenen Maschine ist keine Aussage ueber
den Runner (v33.x: 32 von 32 rot, weil ein Pfad fest verdrahtet war). Squash-
Merge, dann den Branch nachziehen:

```
git fetch origin main && git reset --hard origin/main
git push --force-with-lease -u origin claude/<thema>-<id>
```

Nie direkt auf `main`. Nie DDL auf der Produktivdatenbank — Migrationen
liegen in `supabase/migrations/` und heissen „nicht angewandt", bis Fernando
sie anwendet. Nie „live verifiziert" schreiben, ohne zu sagen womit — die
Live-Seite ist aus einer Cloud-Sitzung nicht erreichbar (`CONNECT … 403`).

## 10 · Was eine Zusammenfassung ist

Eine Aufgabenliste, ein Kommentar, eine Release-Notiz — alles, was sagt „ist
gebaut", wird gegen `git show` gelesen, bevor es weitergeschrieben wird. Die
Zusammenfassung zu v33.31 nannte drei Dinge als geliefert, die in keinem
Commit standen; gefunden hat es ein Messender (v33.33). **Eine Zusammenfassung
ist kein Diff.**
