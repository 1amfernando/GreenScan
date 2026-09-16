# docs/memory — das Gedaechtnis von GreenScan, fuer jede KI

> Du bist eine KI (Claude, Cursor, Codex, Gemini, …) und sollst an diesem Repo
> arbeiten. Diese acht Dateien sind alles, was du VOR der ersten Aenderung
> wissen musst. Lesezeit fuer alle zusammen: rund 20 Minuten. `CLAUDE.md`
> (1'400 Zeilen) ist das ausfuehrliche Tagebuch dahinter — lies es, wenn eine
> Regel hier dir zu kurz vorkommt; jede Regel hier nennt ihre Stelle dort.

| Datei | Beantwortet die Frage | Lies sie, wenn … |
|---|---|---|
| `01-projekt.md` | Was ist das, wo laeuft es, was kann ich von hier aus NICHT? | … immer, zuerst. 3 Minuten. |
| `02-regeln.md` | Welche zwoelf Regeln gelten fuer jede Codezeile? | … du irgendetwas in `index.html` aenderst. |
| `03-daten-eigner.md` | Wem gehoert welcher Zustand, und wer darf ihn schreiben? | … du einen Wert liest, speicherst, zaehlst oder synchronisierst. |
| `04-pruefstaende.md` | Welcher der 35 Pruefstaende stellt welche Frage — und wie baue ich einen Fall? | … du etwas aenderst (immer) oder etwas behauptest („funktioniert"). |
| `05-fallen.md` | Woran sind die Vorgaenger gescheitert — in je vier Zeilen? | … bevor du etwas fuer „offensichtlich" haeltst. |
| `06-kalender.md` | Die eine Frage, die eine Funktion, die Ereignisarten, die Filter. | … du Aufgaben, Termine, Saison, Naturjahr, Timeline oder Wetter anfasst. |
| `07-lina.md` | Was Lina sieht, was sie tun darf, wie sie geerdet ist. | … du am KI-Coach, an Prompts oder an `callAI` arbeitest. |
| `08-arbeitsweise.md` | Wie eine Aenderung von der Messung bis zum Merge geht. | … du deine erste Scheibe ausliefern willst. |

## Die drei Saetze, die alles zusammenhalten

1. **Es wird gemessen, nicht vermutet.** Jede Aussage traegt eine Zeilennummer,
   eine Zahl oder einen Pruefstand-Fall. „Vermutlich" ist kein Befund.
2. **Eine Frage, eine Funktion.** Zwei Rechnungen fuer dieselbe Frage laufen
   auseinander — das Repo hat es sieben Mal bezahlt (`05-fallen.md`).
3. **Der Pruefstand kommt VOR dem Code.** Ein Fall, der gegen den alten Stand
   nicht rot wird, misst nichts. Gegenprobe: die Reparatur zurueckbauen, der
   Fall muss rot werden — mit der echten Zahl daneben.

## Fuer wen diese Dateien sind

Fuer jede KI-Sitzung, unabhaengig vom Werkzeug. Nichts hier setzt Claude Code
voraus. Wer nur ein Terminal und `node` hat, kann jeden Pruefstand fahren
(`scripts/`, Playwright aus `scripts/package.json`, lokales Postgres fuer fuenf
davon — `quiz_check`, `schluessel_check`, `nutzung_check`, `backup_check`,
`quiz_gen_check`; `bash scripts/_pg_local.sh start`).

## Was diese Dateien NICHT sind

Kein Ersatz fuer `STATUS.md` (was gerade in Arbeit ist) und `ROADMAP.md` (was
als naechstes kommt). Beide sind lebende Dokumente; diese acht beschreiben,
was BLEIBT. Wer eine Regel aendert, aendert sie hier UND in `CLAUDE.md` — und
`robust_check` Fall „Memory" prueft, dass jeder Funktions- und Konstantenname,
der hier in Backticks steht, im Quelltext existiert — wer eine Funktion umbenennt,
sieht es beim naechsten Lauf.
