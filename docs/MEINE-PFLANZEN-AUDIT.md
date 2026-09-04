# „Meine Pflanzen" — Bestandsaufnahme vom 03.09.2026

> Fernando: *„Die nächsten Aufträge sind die Seite Meine Pflanzen verbessern.
> Finde Lösungen für alles was aus deiner Sicht nicht gut gelöst ist. Nur die
> besten Lösungen."*
>
> Gelesen und gemessen in `index.html` v32.45, mit Playwright und den
> Beispieldaten aus `scripts/_seed.js` (seit v32.46 mit echten Aufgaben).
> Solo — das Agenten-Kontingent der Umgebung war erschöpft; die gegnerische
> Prüfung der Befunde steht deshalb noch aus und ist unten je Punkt
> vermerkt. Screenshots liegen im Sitzungs-Protokoll, nicht im Repo.

## Was gut gelöst ist — und deshalb bleibt

| Was | Warum es bleibt |
|---|---|
| **Eine Aufgaben-Rechnung** (`getDaysUntilDue`, `gsGetDueTasks`) mit vier Anzeigen daran | genau die Verdrahtung, die der Kalender braucht; sie wurde erweitert, nicht ersetzt |
| **Karten nach Dringlichkeit sortiert**, Fällig-Liste oben, Abhaken mit Kreis | eine Person sieht als Erstes, was zu tun ist |
| **Drei Kopfzahlen** (Pflanzen · heute fällig · gut versorgt) | ehrliche Zahlen, aus denselben Daten |
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
| 7 | **Der Notizzettel verdeckt den Pfeil der ersten Karte.** Er klebt bei 38 % Höhe am rechten Rand — genau dort, wo bei drei fälligen Aufgaben die erste Pflanzenkarte ihr „›" hat. Gemessen im Screenshot 412 px. | 2 | **behoben v32.49** — gemessen bei 0/1/3/8 fälligen Aufgaben: der Zettel wandert mit der Liste (`position:fixed` in einem animierten Vorfahren wirkt wie absolute), ein anderer `top` hilft nicht. Solange er sichtbar ist, bekommen die Karten rechts 56 px Luft (`body.gs-zettel-da`); `kalender_check` misst alle vier Stände |
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
  waren). Er bleibt, weil er eine Rückfrage hat — geprüft, nicht angenommen.

## Wie es weitergeht

Stufe 2 (v32.47) hat 1, 8 und 10 geschlossen; v32.49 die 3 und 7. Offen
bleiben 9 (Migration, Fernando) und 11 (Entscheidung, Fernando). Die
gegnerische Prüfung der Befunde ist am 03.09. (21:30 UTC) am Kontingent
gescheitert und läuft seit dem 04.09., 02:00 UTC, erneut — das Ergebnis
wird hier nachgetragen.
