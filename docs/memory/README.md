# docs/memory — das Gedaechtnis von GreenScan, fuer jede KI

> Du bist eine KI (Claude, Cursor, Codex, Gemini, …) und sollst an diesem Repo
> arbeiten. Diese 9 nummerierten Dateien sind alles, was du VOR der ersten
> Aenderung wissen musst. Lesezeit fuer alle zusammen: rund 25 Minuten.
> `CLAUDE.md` ist das ausfuehrliche Tagebuch dahinter — lies es, wenn eine
> Regel hier dir zu kurz vorkommt; jede Regel hier nennt ihre Stelle dort.

| Datei | Beantwortet die Frage | Lies sie, wenn … |
|---|---|---|
| `01-projekt.md` | Was ist das, wo laeuft es, was kann ich von hier aus NICHT? | … immer, zuerst. 3 Minuten. |
| `02-regeln.md` | Welche vierzehn Regeln gelten fuer jede Codezeile? | … du irgendetwas in `index.html` aenderst. |
| `03-daten-eigner.md` | Wem gehoert welcher Zustand, und wer darf ihn schreiben? | … du einen Wert liest, speicherst, zaehlst oder synchronisierst. |
| `04-pruefstaende.md` | Welcher der 40 Pruefstaende stellt welche Frage — und wie baue ich einen Fall? | … du etwas aenderst (immer) oder etwas behauptest („funktioniert"). |
| `05-fallen.md` | Woran sind die Vorgaenger gescheitert — in je vier Zeilen? | … bevor du etwas fuer „offensichtlich" haeltst. |
| `06-kalender.md` | Die eine Frage, die eine Funktion, die Ereignisarten, die Filter. | … du Aufgaben, Termine, Saison, Naturjahr, Timeline oder Wetter anfasst. |
| `07-lina.md` | Was Lina sieht, was sie tun darf, wie sie geerdet ist. | … du am KI-Coach, an Prompts oder an `callAI` arbeitest. |
| `08-arbeitsweise.md` | Wie eine Aenderung von der Messung bis zum Merge geht. | … du deine erste Scheibe ausliefern willst. |
| `09-austausch.md` | Wie hinterlasse ich anderen Agenten etwas — und wie finde ich, was sie mir hinterlassen haben? | … immer: beim Start (lesen), unterwegs (Nebenfund, Frage, Idee), am Ende (Uebergabe). |

## Die drei Saetze, die alles zusammenhalten

1. **Es wird gemessen, nicht vermutet.** Jede Aussage traegt eine Zeilennummer,
   eine Zahl oder einen Pruefstand-Fall. „Vermutlich" ist kein Befund.
2. **Eine Frage, eine Funktion.** Zwei Rechnungen fuer dieselbe Frage laufen
   auseinander — das Repo hat es sieben Mal bezahlt (`05-fallen.md`).
3. **Der Pruefstand kommt VOR dem Code.** Ein Fall, der gegen den alten Stand
   nicht rot wird, misst nichts. Gegenprobe: die Reparatur zurueckbauen, der
   Fall muss rot werden — mit der echten Zahl daneben.

## Und bevor du anfaengst: du bist nicht allein

Parallel arbeiten andere Sitzungen, geplante Laeufe, fremde KIs. Was sie
gefunden, gefragt und vorgeschlagen haben, steht auf dem Brett:

```
node scripts/austausch.js holen     # Anstoesse, wer woran sitzt, offene Fragen, letzte Uebergabe
```

Was DU findest, fragst oder offen laesst, gehoert ebenfalls dorthin
(`09-austausch.md`) — nicht in den Fliesstext eines Berichts.

## Fuer wen diese Dateien sind

Fuer jede KI-Sitzung, unabhaengig vom Werkzeug. Nichts hier setzt Claude Code
voraus. Wer nur ein Terminal und `node` hat, kann jeden Pruefstand fahren
(`scripts/`, Playwright aus `scripts/package.json`, lokales Postgres fuer 7
davon — `quiz_check`, `schluessel_check`, `nutzung_check`, `backup_check`,
`quiz_gen_check`, `naht_check`, `admin_check`; `bash scripts/_pg_local.sh start`).

## Was diese Dateien NICHT sind

Kein Ersatz fuer `STATUS.md` (was gerade in Arbeit ist) und `ROADMAP.md` (was
als naechstes kommt). Beide sind lebende Dokumente; diese neun beschreiben,
was BLEIBT. Wer eine Regel aendert, aendert sie hier UND in `CLAUDE.md` — und
`robust_check` Fall „Memory" prueft, dass jeder Funktions- und Konstantenname,
der hier in Backticks steht, im Quelltext existiert — wer eine Funktion umbenennt,
sieht es beim naechsten Lauf.
