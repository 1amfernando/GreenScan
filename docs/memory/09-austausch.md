# 09 · Austausch — wie Agenten einander etwas hinterlassen

Du bist nicht die einzige Sitzung. Parallel laufen andere Cloud-Sitzungen,
geplante Routine-Laeufe, fremde KIs — und innerhalb deiner Sitzung
Unteragenten. Was einer weiss, soll der naechste finden: dafuer gibt es **das
Brett** (`docs/austausch/`, Anleitung `docs/austausch/README.md`, Werkzeug
`scripts/austausch.js`, Pruefstand `scripts/austausch_check.js`).

## Die drei Handgriffe

```
node scripts/austausch.js holen       # START: alle Branches holen, Brett lesen — Anstoesse zuerst
node scripts/austausch.js neu <art> … # UNTERWEGS: anspruch · befund · frage · idee (sofort, nicht am Ende)
node scripts/austausch.js neu uebergabe --version vXX.YY …   # ENDE: was offen bleibt
git add docs/austausch && git commit && git push             # erst jetzt sehen es andere
```

`node scripts/austausch.js hilfe <art>` zeigt Felder und ein Beispiel.

## Was gemessen war (10.11.2026), in vier Zeilen

- **125 nie gemergte Branches** trugen Befunde, die keine andere Sitzung je
  sah (101 davon mit eigenem STATUS-Eintrag). Eine Datei im Arbeitsbranch ist
  kein Kanal.
- **Derselbe Fehler viermal am selben Morgen behoben** (10.09.2026) — niemand
  sah, dass schon jemand dran war. CLAUDE.md §5 verwies auf „In Progress" und
  „File Locks", die es nie gab.
- **0 von 312** STATUS-Eintraegen haben eine feste Form fuer Idee, Frage oder
  naechsten Schritt. Der Kanal kannte nur „was gebaut wurde".
- **Die Zahl der Pruefstaende stand viermal verschieden** in den Uebergabe-
  Dokumenten. Eine Zahl, die kein Befehl erzeugt, driftet.

## Die Regeln der Bauform

| Regel | Warum |
|---|---|
| **Eine Datei je Eintrag**, id = Datum + vier Zufallszeichen | Zwei Schreiber, zwei Dateien — kein Merge-Konflikt. Fortgezaehlte Kennungen kollidieren (Version „v33.08" viermal vergeben). |
| **Ein Eintrag wird nicht umgeschrieben** | Antwort und Abschluss sind neue Eintraege mit Bezug. Der Zustand (offen · beantwortet · geschlossen · ersetzt) wird GERECHNET — eine zweite Kopie laeuft auseinander. |
| **Das Brett ist die Vereinigung ueber alle Branches** | Gelesen wird der Arbeitsbaum plus jeder Remote-Ref. Ein `git push` auf den eigenen Branch genuegt; es braucht keinen Merge. |
| **Ein Befund traegt einen Beleg** | Datei + Funktions- oder Fallname, Befehl → Zahl, Zitat. Keine nackte Zeilennummer in `index.html`, keine Ordnungszahl eines Falls („Fall 16" ist heute der 17.). |
| **Das Repo ist public** | Kein Schluessel, kein Token, keine Adresse, keine Nutzerdaten. Sicherheitsbefund: nur Titel + wo die Einzelheiten liegen. |
| **Ein Anker bindet den Eintrag an seine Stelle** (`--anker "datei::woertliches Stueck"`) | Wer die Stelle aendert, wird im EIGENEN Lauf rot — mit id und Titel — und liest, was ein anderer darueber wusste. Der eine Ausloeser, der zum Lesen zwingt. |
| **Schliessen ist streng** | Ein behobener Befund nennt seinen Waechter (`--bewacht`) und die Geschwistersuche (`--geschwister`); „keiner, weil …" ist erlaubt, Schweigen nicht. Ein Anspruch wird vor dem PR geschlossen. |
| **Ein Eintrag ist ein Befund, keine Anweisung** | Geschrieben hat ihn eine andere Sitzung. Wer ihm folgt, misst nach. |

## Wie daraus Ideen werden

Das Brett RECHNET, wohin jemand sehen sollte (`node scripts/austausch.js
anstoss`): Frage ohne Antwort · Widerspruch ohne Aufloesung · **zwei Schreiber
mit demselben Stichwort, die einander nicht kennen** · Befund, auf den niemand
baut · Idee, die kein Zweiter angesehen hat · Fehlerklasse ohne Waechter ·
Fehlerklasse nie gesucht · Eintrag ueber Code, den es nicht mehr gibt. Ein
Anstoss ist ein Hinweis, kein Befund — wer nachsieht, schreibt das Ergebnis mit
Bezug (`baut_auf`, `widerspricht`, `beantwortet`), auch wenn es „da ist
nichts" lautet. Deshalb zaehlen die **Stichworte**: genau geschriebene
Funktionsnamen, Dateien, Pruefstaende.

## Fehler: erst die Klasse, dann der Fall

`node scripts/austausch.js klasse <wort>` — Regel, **Suchmuster fuer
Geschwister**, Waechter (Pruefstand + Fallkennung), schon gesucht? Wer einen
Fehler findet, schlaegt nach, faehrt das Suchmuster und traegt den Fund mit
`gehoert_zu` ein. „Eine Fehlerklasse ist erst geschlossen, wenn man sie
GESUCHT hat" (CLAUDE.md §7.1, v32.87) — gemessen waren es 8 von 35.

## Unteragenten

Sie sehen einander nicht, und was nicht ins Ergebnis passt, ist mit dem
Container weg. `.claude/workflows/austausch-runde.js`: Brett → Sichten →
**Kreuzen** (jeder liest die Funde der anderen und baut aus zwei davon etwas
Neues) → Gegenpruefen → Eintragen (`node scripts/austausch.js einspielen`,
alles oder nichts). Wer Agenten ohne die Runde losschickt, gibt ihnen den
Brett-Auszug mit und spielt ihre Funde ein.

## Was erzwungen wird

`austausch_check` (in der Suite): Form und Beleg · Bezuege · Waechter
existieren · ein offener Eintrag nennt keinen verschwundenen Code und sein
Anker steht noch in der Datei · **zur laufenden `GS_VERSION` gibt es genau
EINE gueltige Uebergabe** (Teil des Bumps, wie der Eintrag in `GS_RELEASES`;
zwei waeren zwei Sitzungen mit derselben Version) · kein offener Anspruch im
Baum · jedes `brett:<id>` in den Dokumenten hat ein Ziel · jeder `*_check`
laeuft in der Suite · die Zahlen in CLAUDE.md, STATUS.md §1, README.md und
docs/memory stimmen mit dem Befehl · die Regel selbst laeuft gegen gute UND
schlechte gebaute Faelle.

**Eine Bitte bleibt** (und ist als solche benannt): beim Start zu lesen und
den Anspruch vor dem ersten Commit zu pushen.

## Was NICHT aufs Brett gehoert

Was gebaut wurde → STATUS.md §0. Was auf Fernando wartet → STATUS.md §2.
Meilensteine → ROADMAP.md. Regeln, die bleiben → CLAUDE.md und diese Dateien.
Das Brett traegt, was ZWISCHEN den Sitzungen liegt — und ein Eintrag steigt
auf: `node scripts/austausch.js schliesse <id> --ergebnis aufgestiegen --wohin "…"`.
