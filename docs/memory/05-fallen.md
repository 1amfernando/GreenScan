# 05 · Die Fallen — woran die Vorgaenger gescheitert sind

Jede in vier Zeilen: was passierte, warum es niemand sah, was seither gilt.
Nach Klassen, nicht nach Datum. Die Versionsnummer fuehrt zum Tagebuch in
`CLAUDE.md`, wo die ganze Geschichte steht.

## A · Zwei Rechnungen fuer eine Frage

- **v32.87** „HEUTE FAELLIG" zeigte 3 Tage (`d <= 2`), der Notizzettel daneben
  heute — zwei Zahlen, gleichzeitig sichtbar. Regel: `gsGetDueTasks`, und die
  Zahl gehoert zum Titel.
- **v32.65** Der Server wertete Quiz-Antworten nach EINEM Format, der Client
  kannte drei — fuenf Tage lang galt jede Antwort als falsch, waehrend der
  Bildschirm „Richtig!" sagte. Regel: wer den Server entscheiden laesst, liest
  die Entscheidung (`return=representation`).
- **v33.26** Zwei Regeln fuer „Backup faellig" (Kalendertag UTC vs. > 3 h)
  liefen auseinander; keine fragte, ob sich etwas geaendert hat. Regel: eine
  Funktion mit immer einem GRUND (`_gsSnapshotAutoFaellig`).
- **v33.33** Drei Zeitfelder in der Scan-Historie, ein Leser verlangte genau
  eines — nach dem Cloud-Abgleich sah Lina null Scans. Regel: `_gsScanZeit(h)`.

## B · Eine Ansicht, die nie etwas zeigen konnte

- **v31.78** Der Bluehkalender fragte `s.bloom` — ein Feld, das keine Art hat.
  Zaehler brav 0. Regel: `data_check` fragt „gibt es, was gelesen wird?".
- **v32.51** Der Regen-Hinweis las `p.location`, das keine Speicherstelle
  schreibt — 66 Versionen lang fuer keine Pflanze. Regel: eine Frage, die nur
  die Verneinung kennt, ist auch dann gruen, wenn die Funktion nichts tut.
- **v33.33** Die Garten-Timeline las `'scan_history'` (ohne `gs_`) — null
  Scans seit v23.57, obwohl das Repo den toten Schluessel an zwei Stellen
  kannte. Regel: ein Schluessel steht als Konstante (`SCAN_HISTORY_KEY`).
- **v32.38** `gsGetLocationFor('weather')` funktionierte seit v28.03 — es rief
  nur niemand. Der Schalter setzte einen Haken und zeigte einen Toast. Regel:
  eine Wahl, die bestaetigt und nicht umgesetzt wird, ist schlimmer als keine.

## C · Beispieldaten, die gruen luegen

- **v31.46** Seed schrieb `myPlants`, die App liest `ps_myplants` — 15
  Versionen lang vermassen alle Pruefstaende eine leere Pflanzenliste.
- **v32.46** Richtiger Schluessel, falsche Felder (`lastWatered` statt
  `tasks[key].lastDone`) — keine einzige Aufgabe in allen Pruefstaenden.
- **v33.02** Der Zeitanker stand fest auf 2025 — ein Jahr spaeter waren alle
  Aufgaben ueberfaellig, keine heute, kein Messwert der letzten Woche.
- **v33.33** Ernte-Log mit `{plant, amount}` statt `{pflanze, menge}` —
  Naturjahr NaN, Timeline „? · 0 g". Regel: `robust_check` Fall 25 misst die
  WIRKUNG der Beispieldaten (neun Listen muessen ankommen); wer Seed aendert,
  prueft Schluessel, Felder UND Zeitanker gegen die Lesestellen.

## D · Ein Deckel, eine Liste, ein Praefix — Annahmen ueber Zustaendigkeit

- **v32.13** `gsFlushOfflineQueue` lief ueber ALLE fuenf IndexedDB-Ablagen und
  loeschte, was es nicht einordnen konnte — Fotos und Archiv weg, bei jedem
  Start. Regel: eine Schleife ueber „alles" ist eine Annahme; `STORES` vs.
  `SYNC_STORES`.
- **v32.37** „Alle Daten loeschen" raeumte nach Praefix `gs_`/`ps_` — die
  Fundorte (`greenscan_markers`) blieben. Regel: eine Loeschung nach Praefix
  ist eine Wette.
- **v33.27** `gs_dq_<datum>` stand in keiner Speicherliste, ueberlebte das
  Abmelden, entstand je Tag, wurde nie geraeumt. Regel: ein Schluessel, den
  kein Pruefstand SETZT, hat niemand gemessen; Familien brauchen Listen.
- **v33.01** Aus 12 Inline-Changelog-Eintraegen waren 100 geworden — jede
  Sitzung haengte brav oben an. Regel: eine Regel ohne Ausloeser ist eine
  Bitte (`robust_check` deckelt bei 20).

## E · Der Pruefstand, der nichts mass

- **v32.35** Eine Frage mass im ZUGEKLAPPTEN Zustand (9 statt 31 Elemente) und
  meldete „alle benannt" — aufgefallen, weil die Gegenprobe gruen blieb.
- **v33.00** E4 renderte eine EIGENE Attrappe von `GS_RELEASES` — vierzehn
  Auslieferungen lang stand `function bold() { [native code] }` auf dem
  Bildschirm. Regel: echte Daten in den Fall.
- **v32.96** Ein Pruefstand, der `scripts/*.js` liest, fand seine eigene
  Deklarationsliste als zweite Nennung — „0 ohne Aufrufer".
- **v33.34** Eine neue Gegenprobe wollte den Wetter-Zwischenspeicher aus
  `sichern.wc` wiederherstellen — der war `null`, weil ein FRUEHERER Fall
  ihn geraeumt und nicht zurueckgelegt hatte. Die Frage lief nie und meldete
  gruen. Regel: **eine Gegenprobe, deren Aufbau still fehlschlaegt, sieht aus
  wie eine bestandene** — jeder Fall stellt seinen Zustand SELBST her.
- **v33.34** Das Kalender-Fenster in `contrast_check` mass nichts (es suchte
  `plant_seed_1`, und dieser Pruefstand hat seinen EIGENEN, winzigen Seed) —
  und meldete das als „Fenster uebersprungen". Seither wirft es. Regel: ein
  Fenster ohne Messung sieht sonst aus wie ein Fenster ohne Funde.
- **v33.32** Die Sicherung suchte ganze Woerter; der Fall enthielt genau
  diese. End-to-end gemessen: 8 von 9 echten Saetzen ohne Warnung. Regel: mit
  den GEMESSENEN Saetzen pruefen, nicht mit ausgewaehlten.
- **v32.23** `gsCloudSync.flushNow()` ging an `sbFetch` vorbei — die Attrappe
  sah nichts, „0 Tabellen gepusht" haette 47 Fehler gemeldet. Regel: erst
  pruefen, ob der Pruefstand ueberhaupt etwas sieht.

## F · Die richtige Ursache, die falsche Abhilfe

- **v32.30** Der Sucher zeigte 31 % des Bildwinkels; v32.29 verlangte der
  Kamera ein hochkantes Format ab — dieselben 31 %, jetzt auch im Foto. Regel:
  ein Zuschnitt in der ANZEIGE ist umkehrbar, einer in der QUELLE nicht.
- **v31.76** Zwoelf Farben wegen einer Falschmeldung geaendert: 6,87:1 vorher,
  1,83:1 nachher. Regel: eine Farbe erst aendern, wenn der Messwert
  reproduzierbar ist.
- **v32.25** Ein globales Suchen-und-Ersetzen ueber die 5-MB-Datei nahm 21 nie
  gemessene Stellen mit; die Ruecknahme traf 122. Regel: jede Ersetzung mit
  erwarteter Trefferzahl.
- **v32.34** Fuenf Fassungen der Kameravorschau in zwei Tagen, jede mit mehr
  Technik — drei Zeilen CSS taten es. Regel: was ohne Zutun richtig ist,
  braucht kein Zutun.

## G · Versprechen ohne Pruefung

- **v32.28** „gespeichert!" stand VOR dem POST; „Inserat geloescht" vor dem
  DELETE; „🌱 Bio" auch nach abgelehntem PATCH. Regel: die Meldung kommt NACH
  der Antwort, `_gsSchreibOk(r)`.
- **v31.65** `gsTwinSave` meldete Erfolg bei vollem Speicher — der ganze
  Garten-Zwilling war weg. Regel: `setItem` gibt `false` zurueck, ein
  `catch` faengt nichts.
- **v32.33** „Push aktiv!" ohne Serverzeile, „GPS aktiv" bei entzogener
  Freigabe, „jede Anfrage bestaetigen" fuer genau eine. Regel: ein Schalter
  behauptet nichts, was niemand nachgesehen hat (`einstellungen_check`).
- **v33.33** Eine Aufgaben-Zusammenfassung nannte drei Dinge als geliefert,
  die in keinem Commit stehen. Regel: eine Zusammenfassung ist kein Diff.

## H · Sicherheit im Kleinen

- **v32.66** `escHtml` allein in `onclick="…"`: ein `'` beendet den String —
  der Wert durchlaeuft ZWEI Parser (`_gsOcStr`).
- **v32.68** Der globale Anthropic-Schluessel lag im `localStorage` — jetzt
  nur im Proxy. Ein Umschalter, den niemand je umgelegt hat, ist kein
  Sicherheitsnetz (`ai_usage` hatte null Zeilen).
- **v32.72** Ein Service-Key wurde mit `includes` verglichen — nahm „Bearer
  <key>" und den Key irgendwo im Header an. Regel: `constantTimeEquals`.
- **v33.17** „Konto loeschen" versprach „alle Scans & Bilder" und loeschte
  kein einziges Storage-Objekt (169). Regel: gegen die Datenbank messen,
  nicht gegen die Liste im Code.
