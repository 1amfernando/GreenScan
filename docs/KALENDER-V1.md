# Kalender V1 — eine Ereignis-Schicht für Aufgaben, Tagebuch und „Heute zu tun"

> Geschrieben am 03.09.2026 (Seros), Stand v32.45. Anlass sind Fernandos
> Sätze: *„Integriere irgendwo/irgendwie einen Kalender, damit man sehen
> kann, was zu tun ist. Der Kalender soll mit dem Tagebuch verbunden sein und
> sehr intelligent aufgebaut und verdrahtet sein. ‚Heute zu tun' muss
> ebenfalls mit dem Kalender verknüpft sein."*
>
> Wie `PLANER-V3.md`, `SCANNER-V3.md` und `OEKOSYSTEM-V1.md`: erst die
> Messung, dann der Entwurf, dann die Regeln — und ein Prüfstand, bevor
> etwas als fertig gilt.

## 0 · Die eine Regel

> **Es gibt EINE Frage — „was ist an diesem Tag?" — und EINE Funktion, die
> sie beantwortet.** Der Kalender, „Heute zu tun" auf der Startseite, die
> Fällig-Liste in „Meine Pflanzen", der Notizzettel am Rand und der
> Glocken-Zähler sind fünf Anzeigen derselben Antwort. Keine davon rechnet
> selbst.

Das ist keine neue Idee in diesem Repo: `gsGetDueTasks()` ist seit v31.16
genau diese Funktion für Aufgaben, und vier Anzeigen hängen daran. Der
Kalender erweitert die Frage von „heute" auf „an diesem Tag" und von
„Aufgaben" auf „Ereignisse" — und ändert an der Verdrahtung sonst nichts.

## 1 · Was heute existiert — gemessen

Gelesen am 03.09.2026 in `index.html` (v32.45); Zahlen mit Playwright und
den Beispieldaten aus `scripts/_seed.js` nachgemessen.

### 1.1 · Zwei Pflanzenlisten, eine davon ohne Pflege

| Liste | Schlüssel | Wo sichtbar | Aufgaben |
|---|---|---|---|
| „Meine Pflanzen" (Wohnung) | `ps_myplants` | Tab `favs`, Unterreiter 🏠 | **ja** — `p.tasks = { water, fertilize, repot, rotate, mist, dust, prune, check }`, je `{active, intervalDays, lastDone}` (`TASK_DEFS`, ~Z. 24221) |
| Garten-Pflanzungen | `gs_plantings` | Tab `garden`; im Tab `favs` Unterreiter 🌳 nur als Spiegel mit Deep-Link | **nein** — `savePlanting` (~Z. 70865) schreibt `{id, gardenId, name, variety, date, count, notes, added}`; kein Feld für Pflege |

Folge: **„Heute zu tun" kennt nur Zimmerpflanzen.** Wer Tomaten im Beet
hat, bekommt für sie nie eine Aufgabe — obwohl das der Fall ist, für den
eine Schweizer Garten-App gebaut wird. Das ist die grösste Lücke dieses
Bereichs und sie steht nicht in der Oberfläche, sondern im Datenmodell.

### 1.2 · Die Aufgaben-Rechnung — solide, an einer Stelle

> **Nachtrag v32.53:** die eine Rechnung hat einen vierten Parameter.
> `getDaysUntilDue(lastDone, intervalDays, snoozedUntil, vorgezogenAuf)` —
> eine verletzte Sensor-Regel `task:<key>` zieht auf `vorgezogenAuf` vor
> (nur nach `lastDone`), die Verschiebung der Person gewinnt:
> `fällig = max(min(lastDone + Intervall, vorgezogenAuf), snoozedUntil)`.
> Alle neun Aufrufer geben ihn weiter; `_gsTaskDays(t)` ist der Weg für
> neuen Code. Die Server-Sicht kennt ihn mit
> `20260904_plant_tasks_due_vorgezogen.sql` (`docs/OEKOSYSTEM-V1.md` §11.3b).

`getDaysUntilDue(lastDone, intervalDays)` (~Z. 34167) rechnet datumsbasiert
(Mitternacht, v24.25) und fällt bei fehlendem `lastDone` auf „sofort
fällig". `gsGetDueTasks()` (~Z. 26265) sammelt alles mit `days ≤ 2`, bringt
Regen und Giessen zusammen (v31.84) und sortiert. Vier Verbraucher:
`renderMyPlants` (Fällig-Liste + Kopfzahlen), `gsRenderDayPlan`
(Startseite), `gsRenderTaskNotePop` (Notizzettel), `gsCountUnreadNotifs`
(Glocke). **Das ist richtig gebaut** und der Grund, warum der Kalender
darauf aufsetzen kann statt daneben.

Zwei Dinge daran sind es nicht:

- **Verschieben fälscht die Geschichte.** `gsSnoozeTask` (~Z. 9788) setzt
  `lastDone` auf ein erfundenes Datum, damit die Aufgabe in N Tagen wieder
  fällig ist. Danach steht im Datensatz, die Pflanze sei vor kurzem gegossen
  worden — sie wurde es nicht. Ein Tagebuch, das daraus liest, lügt.
- **Der Server rechnet anders als der Client.** `v_plant_tasks_due`
  (`v26_93`) vergleicht `last_done + interval <= now()` — auf die Sekunde;
  der Client vergleicht Kalendertage. Eine um 14:00 gegossene Pflanze ist
  für den Push-Cron ab 14:00 des Fälligkeitstags fällig, für die App ab
  00:00. Zwei Regeln für dieselbe Frage.

### 1.3 · Drei Tagebücher, die nichts voneinander wissen

| Ablage | Was drin steht | Wer schreibt | Wer liest |
|---|---|---|---|
| `gs_gartentagebuch` (global) | `{id, ts, text, emoji, cat, plant: NAME, date}` — Pflanze als **Name**, nicht als Id | `gsTagebuchAdd` über das Formular `openDiaryEntryModal` (Typwahl, Foto) | `openGartenTagebuch` (Statistik, Streak, Top-Pflanzen, Filter), Startseiten-Widget, Cloud (`data.diary` im plants-Blob) |
| `p.diary[]` (je Pflanze) | `{ts, action, title, note?, photo?, source}` — gedeckelt auf 200 | `gsQuickDone` (jedes Abhaken!), `gsAddDiaryEntry` aus `openPlantDiary` | nur `openPlantDiary` und der Foto-Verlauf |
| `gs_ernte_log` / `gs_harvest_log` | Ernten | Ernte-Tracking | Ernte-Tracking, Naturjahr |

`gsQuickDone` trägt „💧 Giessen (Quick)" in `p.diary` ein — der Kommentar
darüber verspricht „+ global gs_gartentagebuch", der Code tut es nicht. Wer
also das Gartentagebuch öffnet, sieht **kein einziges Abhaken**; wer das
Pflanzentagebuch öffnet, sieht keine Notiz aus dem grossen. Die Verbindung,
die Fernando verlangt, fehlt nicht zwischen Kalender und Tagebuch — sie
fehlt schon zwischen den Tagebüchern.

### 1.4 · Kalender-Ansichten, die es schon gibt

Blühkalender (Artenwissen nach Monat), Säkalender, Regionalkalender,
Mondkalender, „Mein Naturjahr" (Jahresrückblick aus Tagebuch, Pflanzungen,
Scans). **Keiner zeigt Nutzer-Termine nach Tag**, keiner erzeugt Aufgaben,
alle arbeiten auf Monatsauflösung. Wiederverwendbar sind die Monatsnamen,
`gsTsd`, und die Saison-Helfer (`gsSaisonMonate`, `_gsScanMonate`), die aus
`season` einer Art Monate machen — sie liefern später die Aussaat- und
Erntefenster (§3.2).

### 1.5 · Was die Prüfstände bis v32.45 nicht sahen

`scripts/_seed.js` legte die drei Beispielpflanzen mit `lastWatered` und
`waterEvery` an — Felder, die die App **nirgends** liest. Sie rechnet aus
`p.tasks`. Bis v32.45 hatten die Prüfstände also drei Pflanzen **ohne eine
einzige Aufgabe**: Fällig-Liste leer, Startseiten-Plan „Alles versorgt",
Notizzettel unsichtbar, Glocke ohne Zahl. Dieselbe Falle wie v31.46
(falscher Schlüssel), eine Ebene tiefer (richtiger Schlüssel, falsche
Felder). Seit v32.46 tragen die drei echte Aufgaben — eine überfällig, eine
heute, eine in Ordnung — und der erste Lauf danach meldete prompt den
Notizzettel, der 1 px über den Rand ragte. **Ein Bildschirm, den kein
Prüfstand erreicht, ist ein Bildschirm, dessen Fehler niemand meldet.**

## 2 · Das Modell — ein Ereignis

```js
{
  id:        'aufgabe:p1:water:2026-09-03',   // stabil, aus Quelle + Bezug + Tag
  art:       'aufgabe' | 'tagebuch' | 'gepflanzt' | 'aussaat' | 'ernte'
           | 'erinnerung' | 'messung' | 'alarm' | 'wetter',
  datum:     '2026-09-03',                     // Kalendertag, lokal
  zeit:      '10:12' | null,                   // nur bei Ereignissen mit Uhrzeit
  titel:     'Basilikum giessen',
  pflanze:   { id:'p1', name:'Basilikum', liste:'myPlants' | 'plantings' } | null,
  garten_id: 'g1' | null,
  quelle:    'regel' | 'hand' | 'plan' | 'art' | 'sensor' | 'wetter',
  status:    'offen' | 'erledigt' | 'verschoben' | 'info',
  faellig_seit: -1 | 0 | 3 | null,             // Tage, nur bei Aufgaben
  verweis:   { fn:'gsQuickDone', args:['p1','water'] } | { fn:'openPlantDiary', … } | null,
  grund:     'Intervall 3 Tage, zuletzt 30.08.' | 'aus dem Tagebuch' | …   // woher es das weiss
}
```

Drei Entscheidungen stecken darin:

1. **Ereignisse werden gerechnet, nicht gespeichert.** Aufgaben entstehen
   aus `lastDone + intervalDays`, Tagebuch-Ereignisse aus den Einträgen,
   Pflanzungen aus `gs_plantings.date`, Fenster aus den Artendaten. Es gibt
   **keine** Kalender-Tabelle, die mit fünf anderen Speichern synchron
   gehalten werden müsste. Gespeichert wird nur, was die Person tut:
   abhaken (`lastDone`), verschieben (`snoozedUntil`, §3.1), schreiben
   (Tagebuch).
2. **Jedes Ereignis nennt seinen Grund.** `grund` ist Pflicht. Ein Kalender,
   der „Tomate düngen" sagt, sagt auch „Intervall 14 Tage, zuletzt 20.08."
   — dieselbe Regel wie im Planer-Prüfwerk (v31.75): eine Anzeige, die etwas
   behauptet, kann sagen, woher.
3. **`status: 'info'` ist ein eigener Zustand.** Ein Aussaatfenster, ein
   Regen-Ereignis, eine Messung sind nichts zum Abhaken. Sie stehen im
   Kalender, damit man sie sieht — ohne Kästchen.

## 3 · Die Verdrahtung

### 3.1 · Aufgaben — dieselbe Funktion, ein Tag weiter

`gsGetDueTasks()` bleibt und wird zur Sonderform von
`gsKalenderEreignisse(vonDatum, bisDatum)` mit `art === 'aufgabe'` und
`datum === heute`. Neu daran:

- **Beide Pflanzenlisten.** `gs_plantings`-Einträge bekommen `tasks` wie
  `ps_myplants` — mit Vorgaben je Gartenart (`GS_PFLANZUNG_VORGABEN`:
  Balkon giessen 2 / düngen 14 / prüfen 7; Freiland 3 / 30 / 7; unter Glas
  1 / 14 / 7). Keine Botanik: das sind Intervalle, die die Person ändern
  kann, und das Pflanzungs-Detail sagt „Vorgabe für Balkon — keine Aussage
  über diese Art". Bestehende Pflanzungen bekommen sie beim ersten Lesen
  nachgerüstet (`_gsPflanzungenNachruesten`), mit `lastDone = jetzt`, damit
  nichts „seit 27 Tagen" überfällig ist (die Lehre aus v28: `lastDone = now`
  statt `null`). Erledigen, Verschieben und Tagebuch laufen über
  `_gsPflanzeFinden(id)`, das sagt, in welcher Liste die Pflanze steht und wo
  gespeichert wird (`saveGardenData` statt `savePlantsToStorage`).
- **Verschieben speichert `snoozedUntil`** statt `lastDone` zu fälschen. Die
  Rechnung: fällig = max(lastDone + Intervall, snoozedUntil). Das Tagebuch
  behält das echte letzte Giessen. `gsSnoozeTask` wird umgebaut, nicht
  ergänzt; ein bestehendes gefälschtes `lastDone` lässt sich nicht
  zurückrechnen — das steht im Bericht, nicht im Code.
- **Eine Regel für Server und Client.** `v_plant_tasks_due` bekommt
  `(last_done + interval)::date <= current_date` in `Europe/Zurich` — als
  Migration im Repo, nicht angewandt, wie alles DDL. Bis sie angewandt ist,
  nennt `kalender_check` die Abweichung mit Uhrzeit.

### 3.2 · Aussaat- und Erntefenster — aus den Artendaten, nur wo sie stehen

Für jede Pflanze mit erkannter Art (`gsMatchScanToDb(name, lat)` — seit
v32.45 mit Latein-Vorrang und Vorsichts-Regel) liest der Kalender `season`
über `gsSaisonMonate` und, wo vorhanden, die Planer-Daten (`sow_months`,
`harvest`). Daraus werden Ereignisse der Art `aussaat` / `ernte` mit
`status: 'info'` — auf den **Monatsanfang** gelegt, weil die Daten
Monatsauflösung haben, und mit `grund: 'Artenliste: Mai–Juli'`. Ohne Daten:
**kein Ereignis**, kein Vorschlag, keine Schätzung. 2'907 der 4'342 Arten
tragen `season`; für die übrigen bleibt der Kalender still und sagt es auf
der Pflanzenkarte („kein Saisonfenster hinterlegt").

### 3.3 · Tagebuch — ein Eintrag, zwei Ansichten

Die Trennung aus §1.3 wird nicht durch Kopieren behoben (zwei Speicher, die
man synchron halten müsste), sondern durch **eine Lesefunktion**:

```
gsTagebuchAlle()  =  gs_gartentagebuch  ∪  Σ p.diary  (myPlants ∪ plantings)
```

jeder Eintrag mit `pflanze.id` (wo bekannt) und `herkunft`. Das
Gartentagebuch zeigt damit auch die Abhaken-Einträge, das Pflanzentagebuch
auch die Notizen aus dem grossen Formular — und der Kalender beide, je am
Tag des `ts`. Beim Schreiben ändert sich zweierlei: `gsTagebuchAdd`
bekommt `pflanze_id` (das Formular hat die Auswahl schon, es speichert nur
den Namen), und `gsQuickDone` schreibt **einen** Eintrag, nicht zwei.

**Erledigt heisst Tagebuch.** Jedes Abhaken erzeugt ein Tagebuch-Ereignis
mit `quelle: 'regel'` und dem Grund („fällig seit 2 Tagen"). Rückwärts:
wer im Tagebuch „gegossen" einträgt, setzt damit `lastDone` — heute muss
man beides tun, und wer nur schreibt, bekommt die Aufgabe trotzdem
angemahnt. Beide Wege führen zu **derselben** Funktion (`gsAufgabeErledigt`),
so wie im Planer alle Öffner zu einem `gsConfirmModal` führen (v32.37).

### 3.4 · Sensoren und Wetter — die Stellen sind vorbereitet

`OEKOSYSTEM-V1.md` §6 beschreibt die drei Verbindungen: Regel → Aufgabe
(`quelle: 'sensor'`), Abhaken → Markierung im Messwert-Verlauf, Messwert →
Bestätigung des Abhakens. Im Kalender sind das Ereignisse der Arten
`messung` (info) und `alarm` (offen, mit Verweis aufs Gerät). Regen ist
schon heute da (`gsRegenGefallen`, v31.84) und wird zum Ereignis `wetter`
am Tag, an dem er fiel — mit `grund: 'Open-Meteo, 12 mm'`.

Nichts davon braucht einen Umbau, wenn die Geräte kommen: eine neue Quelle
ist ein weiterer Lieferant für `gsKalenderEreignisse`, nicht ein neuer
Bildschirm.

## 4 · Die Ansichten

**Ein Bildschirm, zwei Ebenen.** Oben der **Monat** als Raster (7 Spalten,
Wochenbeginn Montag, Schweizer Feiertage nicht — das ist kein
Terminkalender), je Tag bis zu drei Punkte in den Farben der Ereignisarten
und eine Zahl bei mehr. Darunter der **Tag**: die Liste der Ereignisse des
angetippten Tages, Aufgaben mit Kästchen zuerst, dann Tagebuch, dann
Fenster und Wetter. Heute ist beim Öffnen gewählt.

Erreichbar aus drei Richtungen (Stufe 1), alle mit `gsKalenderOeffnen(datum?)`:
„Heute zu tun" auf der Startseite (📅 in der Kopfzeile), „Meine Pflanzen"
(neben der Fällig-Liste), die Menü-Suche (`MENU_ITEMS`, damit `wiring_check`
sie sieht). In Stufe 2 dazu: das Datum eines Tagebuch-Eintrags.

Was der Kalender **nicht** ist: ein zweiter Ort zum Anlegen von Aufgaben.
Aufgaben entstehen aus Pflanzen und Intervallen — wer am 12. giessen will,
ändert das Intervall oder verschiebt, statt einen Termin zu setzen. Ein
freier Termin ist ein Tagebuch-Eintrag mit Datum in der Zukunft
(`art: 'erinnerung'`), und den gibt es, weil das Formular ein Datumsfeld
bekommt.

## 5 · Der Prüfstand — `kalender_check.js`

Bevor der Kalender etwas zeigt, muss er das hier bestehen. Alle Fälle mit
**gestellter Uhr** (`Date` wird im `addInitScript` auf einen festen
Zeitpunkt gesetzt — sonst ist „heute" jeden Tag ein anderer Fall) und den
Beispieldaten aus `_seed.js`:

1. **Eine Antwort.** `gsGetDueTasks()` und `gsKalenderEreignisse(heute,
   heute)` mit `art === 'aufgabe'` liefern dieselbe Menge — Eintrag für
   Eintrag. Ohne diesen Fall könnten Startseite und Kalender auseinanderlaufen.
2. **Abhaken schreibt ins Tagebuch, und der Kalender zeigt es.** Nach
   `gsQuickDone('p1','water')` steht ein Ereignis `tagebuch` am heutigen
   Tag; `gsTagebuchAlle()` enthält es; das Gartentagebuch rendert es.
3. **Verschieben fälscht nichts.** Nach `gsSnoozeTask('p1','water',2)` ist
   `lastDone` unverändert, das Ereignis steht in zwei Tagen, und der Grund
   sagt „verschoben".
4. **Garten-Pflanzungen haben Aufgaben.** Eine Pflanzung im Beet erzeugt am
   dritten Tag eine Giess-Aufgabe; die Karte nennt die Vorgabe.
5. **Fenster nur mit Daten.** Eine Pflanze mit erkannter Art und `season`
   bekommt ein `aussaat`-/`ernte`-Ereignis mit Grund; eine ohne bekommt
   keins und die Karte sagt es.
6. **Der Tag ist ein Kalendertag.** Um 23:59 und um 00:01 fällt dieselbe
   Aufgabe am selben Tag — und der Fall nennt, was der Server dazu sagt
   (bis die Migration angewandt ist: „weicht ab").
7. **Die Anzeige wird gelesen, nicht das Objekt.** Das Monatsraster hat für
   jeden Tag mit Ereignissen die Punkte, die Tagesliste die Zeilen, die
   Kästchen tragen `aria-label` — gemessen im gerenderten HTML (Lehre aus
   v31.90).
8. **Gegenprobe je Fall.** Jede Reparatur wird einmal zurückgebaut; der
   Fall muss rot werden, mit der echten Zahl daneben.

## 6 · Stufen

| Stufe | Inhalt | Version |
|---|---|---|
| **0** | Beispieldaten mit echten Aufgaben (erledigt) · Rand-Fehler des Notizzettels | v32.46 |
| **1** | `gsKalenderEreignisse` + `gsTagebuchAlle` · Snooze ohne Fälschung · Abhaken = ein Tagebuch-Eintrag · Kalender-Bildschirm (Monat + Tag) · vier Zugänge · `kalender_check` Fälle 1–3, 7, 8 | v32.46 |
| **2** | Aufgaben für Garten-Pflanzungen (Vorgaben je Gartenart, beim ersten Lesen nachgerüstet) · Ernte-Schätzung aus `calcHarvestDate` als Info-Ereignis · Regen als Ereignis · Datumsfeld und `pflanze_id` im Tagebuch, Zukunft = Erinnerung · Pflege-Abschnitt im Pflanzungs-Detail · `buildPlantCard` entfernt · `kalender_check` 11 Fälle · Migration für die Server-Regel (nicht angewandt) | **v32.47 gebaut** |
| **2b** | Aussaatfenster aus den Artendaten (`gsSaisonMonate` auf `season` — Monatsauflösung, nur wo hinterlegt) · das Cloud-Tagebuch (`gsDiarySubmitEntry` → `garden_diary`) in `gsTagebuchAlle` | offen |
| **3** | Sensor-Ereignisse (`messung`, `alarm`) aus `OEKOSYSTEM-V1` Stufe 0 · Bestätigung erledigter Aufgaben durch Messwerte | mit dem Dashboard |

## 7 · Regeln, die beim Bau gelten

1. **Kein zweiter Rechner.** Wer eine Fälligkeit braucht, ruft
   `gsKalenderEreignisse` oder `gsGetDueTasks`. Ein `getDaysUntilDue` in
   einer neuen Anzeige ist ein Fehler.
2. **Kein zweiter Speicher.** Der Kalender speichert nichts, was sich aus
   Pflanzen, Tagebuch und Artendaten ergibt.
3. **Jedes Ereignis hat einen Grund**, und die Anzeige zeigt ihn auf Tippen.
4. **`info` ist kein Kästchen.** Was man nicht erledigen kann, hat keins.
5. **Ohne Daten kein Ereignis** — und die Karte sagt, was fehlt.
6. **Ein Eintrag, zwei Ansichten.** Tagebücher werden zusammen gelesen,
   nicht kopiert.
7. **Verschieben ist kein Erledigen.** `lastDone` schreibt nur, wer wirklich
   erledigt hat.
8. **Die Uhr wird gestellt, nicht abgewartet.** Kein Fall im Prüfstand hängt
   am echten Datum.
