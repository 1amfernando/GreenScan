# „Meine Pflanzen" — Bestandsaufnahme vom 03.09.2026

> Fernando: *„Die nächsten Aufträge sind die Seite Meine Pflanzen verbessern.
> Finde Lösungen für alles was aus deiner Sicht nicht gut gelöst ist. Nur die
> besten Lösungen."*
>
> Gelesen und gemessen in `index.html` v32.45, mit Playwright und den
> Beispieldaten aus `scripts/_seed.js` (seit v32.46 mit echten Aufgaben).
> Solo geschrieben — das Agenten-Kontingent der Umgebung war erschöpft. Die
> gegnerische Prüfung lief am 04.09. (v32.49, HEAD `617e668`) und hat die elf
> Befunde bestätigt, aber **drei Aussagen dieses Textes widerlegt** — siehe
> den Abschnitt „Gegnerische Prüfung" unten; alle drei sind seit v32.50
> behoben. Screenshots liegen im Sitzungs-Protokoll, nicht im Repo.

## Was gut gelöst ist — und deshalb bleibt

| Was | Warum es bleibt |
|---|---|
| **Eine Aufgaben-Rechnung** (`getDaysUntilDue`, `gsGetDueTasks`) mit vier Anzeigen daran | genau die Verdrahtung, die der Kalender braucht; sie wurde erweitert, nicht ersetzt |
| **Karten nach Dringlichkeit sortiert**, Fällig-Liste oben, Abhaken mit Kreis | eine Person sieht als Erstes, was zu tun ist |
| **Drei Kopfzahlen** (Pflanzen · heute fällig · gut versorgt) | ~~ehrliche Zahlen, aus denselben Daten~~ — **widerlegt** (04.09.): „Pflanzen" zählte nur `myPlants`, die beiden anderen seit v32.47 beide Listen („3 · 4 · 1"). **Seit v32.50** zählen alle drei dieselben Listen; `kalender_check` hält `versorgt + mit Aufgaben = Pflanzen` fest |
| **Leerzustand mit zwei Wegen** (scannen / von Hand) | keine Sackgasse |
| **Regen und Giessen** zusammengebracht (v31.84) | die App weiss etwas, das die Person nicht weiss |

## Was nicht gut gelöst war — und was daraus wurde

| # | Befund | Schwere | Stand |
|---|---|---|---|
| 1 | **Garten-Pflanzungen haben keine Pflege.** `gs_plantings` kennt kein `tasks`; „Heute zu tun" gilt nur für Zimmerpflanzen. Der 🌳-Reiter ist ein Spiegel mit Deep-Link. | 3 | **behoben v32.47** — Vorgaben je Gartenart, beim ersten Lesen nachgerüstet; Erledigen/Verschieben über `_gsPflanzeFinden`; Pflege-Abschnitt im Pflanzungs-Detail |
| 2 | **Verschieben fälschte `lastDone`.** Nach einem Snooze stand im Datensatz ein Giessen, das nie war. | 3 | **behoben v32.46** — `snoozedUntil`; Server-Sicht als Migration bereit |
| 3 | **Drei Tagebücher ohne Verbindung.** Abhaken → `p.diary`; das Gartentagebuch las nur `gs_gartentagebuch`; das Cloud-Formular schreibt in `garden_diary`. | 3 | **behoben v32.49** — `gsTagebuchAlle()` liest alle drei: Gartentagebuch, Pflanzentagebücher, und den Spiegel des Cloud-Tagebuchs (`gs_garden_diary_cache`, beim Öffnen und beim Start aufgefrischt, bleibt ohne Netz) |
| 4 | **Die Beispieldaten hatten keine Aufgaben** — alle 22 Prüfstände massen die Fällig-Liste leer (Felder `lastWatered`/`waterEvery`, die die App nie liest). | 3 (für die Prüfbarkeit) | **behoben v32.46** — `favs` 120 → 207 Elemente, `home` 195 → 226 |
| 5 | **Kein Kalender.** Nichts zeigte Aufgaben, Tagebuch und Pflanzungen nach Tag. | 2 | **gebaut v32.46** — `gsKalenderOeffnen`, drei Zugänge, `kalender_check` |
| 6 | **Der Notizzettel ragte 1 px über den Rand** (`right:0` + `rotate(-1.5deg)`). | 1 | **behoben v32.46** |
| 7 | **Der Notizzettel verdeckt den Pfeil der ersten Karte.** Er klebt bei 38 % Höhe am rechten Rand — genau dort, wo bei drei fälligen Aufgaben die erste Pflanzenkarte ihr „›" hat. Gemessen im Screenshot 412 px. | 2 | **behoben v32.49, vervollständigt v32.50** — gemessen bei 0/1/3/8 fälligen Aufgaben: der Zettel wandert mit der Liste (`position:fixed` in einem animierten Vorfahren wirkt wie absolute), ein anderer `top` hilft nicht. Solange er sichtbar ist, bekommen die Karten rechts 56 px Luft (`body.gs-zettel-da`). **Die gegnerische Prüfung fand die Hälfte, die v32.49 übersehen hatte:** bei 3 und 8 fälligen Aufgaben lag der Zettel auf den ⏰-Knöpfen der Fällig-Liste (19 %/39 % bzw. 40 %/17 % verdeckt) — der Prüfstand kannte nur den Pfeil. Seit v32.50 bekommt auch die Fällig-Liste die Luft, und der Fall prüft **jedes** Bedienelement unter dem Zettel |
| 8 | **`buildPlantCard` ist tot** — definiert (~Z. 34680), nie aufgerufen; `gsNewPlantCard` rendert seit v26.x. 60 Zeilen mit `p.water`/`p.sun`-Punkten, die es im Modell nicht gibt. | 1 | **behoben v32.47** — entfernt; `kalender_check` hält fest, dass die Funktion weg ist |
| 9 | **Server und App rechnen Fälligkeit verschieden** (Sekunde vs. Kalendertag). | 2 | **Migration bereit** (`20260903_plant_tasks_due_snooze.sql`), nicht angewandt |
| 10 | **Das Tagebuch koppelt Pflanzen über den Namen**, nicht die Id — zwei „Tomate" sind dieselbe. | 2 | **behoben v32.47** — `gsTbAdd` speichert `pflanze_id`, wenn der Name in beiden Listen eindeutig ist; die Datalist führt die eigenen Pflanzen zuerst |
| 11 | **Vorlagen-Text auf Karten** — `gsAutoFillDBGaps`/`gsAutoFillLookalikes` schreiben „Ähnliche Arten in der Region …" in `lookalike`/`warning`, aber nur beim ersten Start je Gerät. | 2 | **markiert v32.45**, Entscheidung offen (`ARTEN-DATEN.md` §7) |

Schwere: 3 = verliert Daten oder führt in die Irre · 2 = kostet Vertrauen
oder Zeit · 1 = Schönheit.

## Was ich bewusst NICHT geändert habe

- **Die Karte selbst** (`gsNewPlantCard`): Emoji/Foto, Name, Ort, dringendste
  Aufgabe, bis zu vier Aufgaben-Knöpfe, aufklappbar. Sie ist dicht, aber
  jede Zeile trägt etwas. Eine Neugestaltung ohne Fernandos Bilder wäre
  Geschmack, kein Befund.
- **Die Unterreiter 🏠/🌳**: die Trennung ist richtig, nur der 🌳-Inhalt
  ist zu dünn — das löst Befund 1, nicht ein Umbau der Reiter.
- **„Alle erledigt ✓"**: ein Knopf, der alles Fällige auf einmal abhakt, ist
  bequem und gefährlich (er schreibt fünf „gegossen", die vielleicht drei
  waren). ~~Er bleibt, weil er eine Rückfrage hat — geprüft, nicht
  angenommen.~~ **Das war falsch, und zwar genau in der Art, vor der der
  Satz warnt:** die gegnerische Prüfung zählte 0 Aufrufe von
  `gsConfirmModal`; der Knopf schrieb drei Aufgaben sofort auf
  `lastDone = jetzt`. Und er lief nur über `myPlants` — nach dem Tipp stand
  `Zucchini:water` weiter fällig. **Seit v32.50** fragt er zuerst, nennt die
  Aufgaben mit Pflanze, und erledigt über `gsGetDueTasks` in beiden Listen
  (`kalender_check`: nein → nichts geschrieben; ja → 0 fällig, beide
  Speicherwege, zwei Tagebuch-Einträge).

## Gegnerische Prüfung (04.09.2026, gegen v32.49)

Drei unabhängige Prüfer, jeder mit dem Auftrag zu **widerlegen**, am Code
(HEAD `617e668`), mit Playwright und den Beispieldaten. Ergebnis:

| Aussage dieses Textes | Urteil | Was daraus wurde |
|---|---|---|
| Befunde 1–11 | **bestätigt** | — |
| „Drei Kopfzahlen … aus denselben Daten" | **widerlegt** — `total = myPlants.length`, fällig/versorgt über beide Listen: „3 · 4 · 1". Mit `myPlants = []` und einer Pflanzung „0 · 1 · 0", darunter „Noch keine Pflanzen" | **v32.50**: die Summe zählt beide Listen; ohne Zimmerpflanzen sagt der 🏠-Reiter „Keine Zimmerpflanzen — deine Pflanzen stehen im Garten" und führt hin; die „Alles erledigt"-Ansicht gilt auch für reine Garten-Pflanzungen |
| „Alle erledigt ✓ … hat eine Rückfrage — geprüft, nicht angenommen" | **widerlegt** — 0 Aufrufe von `gsConfirmModal`/`confirm`; nur `myPlants`; `Zucchini:water` blieb fällig | **v32.50**: Rückfrage mit Aufgabenliste; Fälligkeit aus `gsGetDueTasks` (eine Rechnung, beide Listen); Speichern je Liste; Tagebuch, Glocke, Zettel und Tagesplan ziehen mit |
| Befund 7 „behoben v32.49" | **halb** — die Pfeile sind frei, aber bei 3 und 8 fälligen Aufgaben liegt der Zettel auf den ⏰-Knöpfen der Fällig-Liste (`.due-card-btn`, 35×30 px, 19 %/39 % bzw. 40 %/17 % verdeckt) | **v32.50**: `body.gs-zettel-da … .due-card{padding-right:44px}`; der Prüfstand hält jetzt **jedes** Bedienelement unter dem Zettel — schmale (≤ 120 px) müssen ganz frei sein, breite zu zwei Dritteln |

Die Lehre, und sie steht schon dreimal in `CLAUDE.md`: **„geprüft, nicht
angenommen" ist eine Behauptung, keine Prüfung.** Ich habe den Satz
geschrieben, ohne den Aufruf zu zählen. Alle drei Reparaturen haben jetzt
einen Fall in `kalender_check` mit Gegenprobe (jede Reparatur einzeln
zurückgebaut → der Fall rot, mit den echten Zahlen: „due-card-btn 19 %,
due-card-btn 39 %" — dieselben, die die Prüfung gemessen hat).

## Wie es weitergeht

Stufe 2 (v32.47) hat 1, 8 und 10 geschlossen; v32.49 die 3 und 7; v32.50
die drei widerlegten Aussagen. Offen bleiben 9 (Migration, Fernando) und 11
(Entscheidung, Fernando). `kalender_check`: 15 Fälle.
