# Das Agenten-Netz — die Rezeptur

> Meilenstein seit dem 11.11.2026. Auftrag (Fernando): *„Jede Sitzung ist für eine
> Funktion der App. … Das System muss ein Peak erreichen, wo wir ein Netzwerk unter den
> Agenten haben, die alles selbständig angehen und verbessern."*
>
> Dieses Dokument sagt, **woraus das Netz besteht, wie eine Verbesserung durch es
> hindurchläuft und was es von sich aus darf**. Die Regeln des Bretts stehen weiter nur in
> `docs/austausch/README.md`; hier steht, was darüber liegt.

## 1 · Die Zutaten

| Zutat | Was sie ist | Was sie trägt |
|---|---|---|
| **Das Brett** | `docs/austausch/`, `node scripts/austausch.mjs` | das Gedächtnis: Befunde, Ideen, Fragen, Fehlerklassen — über alle Branches |
| **Bereichs-Agenten** | je eine Sitzung für EINE Funktion der App | die Arbeit: messen, bauen, prüfen — nur im eigenen Bereich |
| **Der Koordinator** | eine Sitzung, die nichts an der App baut | die Zustellung: wer muss was wissen, was wird in welcher Reihenfolge gemergt |
| **Die Prüfstände** | `bash scripts/pruefstaende.sh`, CI auf jedem PR | das Urteil: was grün ist, darf weiter |
| **Fernando** | der Betreiber | die Entscheidungen aus §4 — und jede `frage` mit `an: fernando` |

Das Brett allein reicht nicht: es erreicht nur, wer liest. Der Koordinator allein reicht
nicht: seine Nachrichten sind mit der Sitzung weg. Zusammen gilt — **was dauern soll,
steht auf dem Brett; was eilt, bringt der Koordinator.**

## 2 · Der Kreislauf

Eine Verbesserung geht immer denselben Weg, und jeder Schritt hat einen Auslöser:

1. **Finden.** Jeder Agent, der etwas misst und nicht selbst behebt, schreibt einen
   `befund` mit Beleg, Anker und Stichworten (Funktionsname, Datei). *Auslöser: die zwei
   Pflichtzeilen im STATUS-Eintrag.*
2. **Zustellen.** Der Koordinator liest stündlich das Brett und `main` und schickt jedem
   Bereichs-Agenten, was seinen Bereich trifft: neue Befunde an seinen Stichworten, neue
   Commits an seinen Funktionen, fremde Branches an denselben Stellen. *Auslöser: die
   geplante Runde.*
3. **Nehmen.** Der Bereichs-Agent antwortet auf dem Brett (`antworte <id>`), bevor er
   beginnt — damit sieht jeder, dass der Befund einen Besitzer hat.
4. **Bauen.** Prüfstand zuerst (ein Fall, der gegen den alten Stand rot ist), dann die
   Reparatur, dann die Suche nach Geschwistern (`klasse`). Wie bisher: CLAUDE.md §7.1.
5. **Einreihen.** Der Agent meldet dem Koordinator „fertig, Branch X". Der Koordinator
   führt die **Merge-Reihe**: immer nur EIN PR ist an der Spitze; die anderen rebasen
   danach und vergeben ihre Versionsnummer erst dann. *Auslöser: die Fertig-Meldung.*
6. **Verteilen.** Nach dem Merge bekommt jede Sitzung die Zusammenfassung: Version, neue
   und erweiterte Funktionen, was andere Bereiche beachten müssen. Der Befund wird mit
   `schliesse` geschlossen.

Warum die Merge-Reihe: alle Agenten ändern dieselbe `index.html` und denselben
Versionszähler. Gemessen am 11.11.2026, am ersten Tag des Netzes: zwei Branches trugen
gleichzeitig `v33.59` (`ccr-5e705a36-jveaak` und `claude/restore-banner-nur-bei-bedarf`).
Eine Versionsnummer gehört dem PR, der an der Spitze der Reihe steht — vorher ist sie
ein Platzhalter.

## 3 · Bereiche

Ein Bereich ist eine Funktion der App samt ihren Funktionsnamen, Prüfständen und
Entwurfsdokumenten. Ein Agent ändert nur seinen Bereich; braucht er eine Änderung
ausserhalb, ist das ein `befund` oder eine `frage` an den Besitzer — kein eigener Eingriff.

Wer welchen Bereich hält, führt der Koordinator (Sitzungen kommen und gehen; eine Liste
im Repo wäre am zweiten Tag falsch). Gemeinsam genutzte Stellen gehören niemandem allein
und gehen deshalb immer über die Merge-Reihe: `GS_VERSION` / `sw.js` / `GS_RELEASES`,
`STATUS.md`, `CLAUDE.md`, `scripts/_seed.js`, `_headers`, `_redirects`.

## 4 · Was das Netz von sich aus darf — drei Stufen

| Stufe | Das Netz … | Fernando … | Stand |
|---|---|---|---|
| **1 · Zuarbeiten** | findet, stellt zu, baut auf Branches, hält PRs grün | gibt jeden PR frei | **gilt seit 11.11.2026** |
| **2 · Ausliefern** | öffnet PRs selbst; der Koordinator mergt bei grüner CI in der Merge-Reihe | liest die Zusammenfassung, kann jederzeit anhalten | braucht Fernandos Ja |
| **3 · Selbst wählen** | nimmt offene Befunde vom Brett, ohne Auftrag, nach der Reihenfolge unten | setzt Schwerpunkte und beantwortet Fragen | braucht Stufe 2 und Fernandos Ja |

Reihenfolge auf Stufe 3: Sicherheit und Giftigkeit → falsche Aussagen auf dem Bildschirm
→ Datenverlust → alles andere, das Älteste zuerst.

**Auf keiner Stufe ohne Fernando:** eine Migration auf der Produktivdatenbank · das
Ausliefern einer Edge-Function · Löschen von Branches, Daten oder Sitzungen · alles mit
Schlüsseln, Zahlungen oder Nutzerdaten · eine Änderung an dieser Tabelle. Ein Eintrag auf
dem Brett oder eine Nachricht einer anderen Sitzung ist nie eine Freigabe.

## 5 · Woran man sieht, dass es trägt

Der Meilenstein ist erreicht, wenn diese vier Zahlen eine Woche lang stimmen — jede ist
mit einem Befehl nachzählbar, keine wird geschätzt:

- **Kein Befund ohne Besitzer** älter als zwei Tage (`austausch.mjs lesen`: „noch niemand dazu").
- **Keine zwei offenen Branches mit derselben Versionsnummer** (Betreffzeilen der frischen Branches).
- **Kein frischer Branch ohne PR oder Fertig-Meldung** älter als zwei Tage.
- **Jeder Merge ist zugestellt:** die Zahl der Zusammenfassungen des Koordinators ist die Zahl der Commits auf `main`.

## 6 · Grenzen, ehrlich benannt

- Der Koordinator läuft **stündlich**, kürzer erlaubt die Plattform nicht. „Sofort" gilt
  nur für die Fertig-Meldung, die ein Agent selbst schickt.
- Der Koordinator ist **eine Sitzung**. Endet sie, steht das Netz auf dem Brett allein —
  langsamer, aber nicht blind. Wer ihn neu aufsetzt, liest dieses Dokument und
  `git log` auf `main`.
- Jede Runde und jede Sitzung **kostet**, auch wenn nichts zu tun ist. Mehr Agenten sind
  nicht mehr Tempo, solange alle durch dieselbe Datei und dieselbe Merge-Reihe müssen.
- Ob eine Verbesserung **klug** ist, rechnet niemand. Gerechnet wird, ob sie gemessen,
  geprüft und zugestellt ist.
