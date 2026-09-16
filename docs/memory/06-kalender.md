# 06 · Kalender — eine Frage, eine Funktion, ein Prüfwerk, ein Sieb

Wer Aufgaben, Termine, Saison, Naturjahr, Timeline oder Wetter anfasst, liest
zuerst `docs/KALENDER-V1.md` (die eine Regel, das Ereignismodell) und
`docs/KALENDER-V2.md` (der denkende Kalender: Prüfwerk, Sieb, die drei
Namen, Lina, Scheiben). Hier die Kurzform.

## Die eine Regel

**„Was ist an diesem Tag?" beantwortet `gsKalenderEreignisse(von, bis)` —
und nur sie.** Der Kalender, „Heute zu tun" (Startseite), der Notizzettel,
die Glocke, Lina und (V2) Mein Naturjahr und die Wochenzeile sind Anzeigen
derselben Antwort. `gsGetDueTasks()` ist die Sonderform für heute (+2 Tage,
Aufgaben beider Pflanzenlisten). Ein `getDaysUntilDue(...)` in einer neuen
Anzeige ist ein Fehler — `_gsTaskDays(t)` oder eine der beiden.

Die Rechnung: `fällig = max(min(lastDone + Intervall, vorgezogenAuf), snoozedUntil)`
auf lokaler Mitternacht; ohne `lastDone` → 0. Verschieben schreibt
`snoozedUntil`, nie `lastDone` (V1 Regel 7).

## Das Ereignis

14 Felder (V1 §2): `id, art, datum, zeit, ts, titel, emoji, pflanze,
garten_id, quelle, status, faellig_seit, verweis, grund`. `grund` ist Pflicht:
eine Anzeige, die etwas behauptet, sagt, woher sie es weiss. `status: 'info'`
hat kein Kästchen.

Arten (V2: zehn): aufgabe · alarm · erinnerung · aussaat · ernte · wetter ·
tagebuch · gepflanzt · messung · scan. Quellen: regel · hand · plan · sensor ·
wetter · kulturdaten · lina. Berichtigt gegen den Code: `quelle 'art'` und
`status 'erledigt'` gibt es nicht — Erledigtes verschwindet, weil `lastDone`
die Fälligkeit verschiebt.

V2 neu: `hinweise: [{regel, zustand, text, grund}]` an jedem beteiligten
Ereignis (vom Prüfwerk), `fenster: 'indoor'|'outdoor'` an `aussaat`.

## Die Quellen (in der Funktion, ab `index.html` ~28802)

Aufgaben beider Listen (`myPlants` + `plantings`, Vorgaben je Gartenart aus
`GS_PFLANZUNG_VORGABEN`) · Tagebuch über `gsTagebuchAlle()` (drei Bücher:
Gartentagebuch, `p.diary`, Cloud-Spiegel `gs_garden_diary_cache`; ein
Eintrag in der Zukunft ist `erinnerung`) · gepflanzt/aufgenommen · Ernte-
Schätzung (`calcHarvestDate` — V2 R3: nur mit Kulturdaten, nie aus dem
Rückfall) · Regen heute (gemessen) · vier Wetter-Schwellen aus der Vorhersage
(`gs_weather_cache` über `_gsWetterTage()`, `GS_WETTER_GRENZEN` = Frost 2 °C,
Hitze 30 °C, Starkregen 20 mm, Sturm 40 km/h — nur heute und später; `null`
heisst „keine Vorhersage geladen“ und ist NICHT die leere Liste) ·
Messwerte je Gerät und Tag, Alarme aus `gsRegelnPruefen` · Plan-Termine
(`gsPlanEreignisse`) · Aussaatfenster (`gsAussaatEreignisse` aus `GS_SAE_DB`,
39 Kulturen — **nur für Kulturen, die die Person hat**; V2: plus Merkliste).

Wer eine neue Quelle anlegt, zieht den Fall „Ohne Daten" in
`kalender_check` nach — er räumt jede Quelle leer, und eine, die er stehen
lässt, macht ihn rot („1 Ereignis ohne Datengrundlage").

## Das Prüfwerk (V2 §3) — „denken" heisst rechnen

Reihenfolge fest: **Rechnung → Prüfwerk → Sieb → Anzeige.** Zehn Regeln
(R1 Frost × Aussaat draussen · R2 Regen übernimmt Giessen — EINE
Implementierung `_gsRegenUebernimmt`, `gsGetDueTasks` ruft sie · R3 Ernte
nur mit Kulturdaten · R4 erntereif ohne Eintrag · R5 Überfällig-Stufe ·
R6 Frost × frostempfindlich draussen · R7 vier Wetter-Schwellen aus EINER
Tabelle GS_WETTER_GRENZEN (geplant, Scheibe 3) · R8 drei Leerzustände ·
R9 Abwesenheit ·
R10 die Woche als Aggregat). Jede hat drei Zustände; `nicht_pruefbar`
steht mit Grund im Ereignis, nie als Stille. Keine Regel schreibt.

**Gebaut seit v33.34** (`_gsKalPruefwerk`, Scheibe 1): R1, R2, R3, R4, R5, R8.
Drei Dinge, die dabei für JEDE Anzeige gelten:

- **Ein Satz steht einmal.** R5 schreibt KEINEN Text — die Unterzeile der
  Zeile sagt „Seit 11 Tagen fällig" bereits; die Stufe ist eine Klasse
  (`gs-kal-lange`). Zwei Texte für dieselbe Frage nebeneinander ist die
  Klasse aus v32.87.
- **Gedeckelt heisst „+N weitere".** Je Zeile ist EIN Hinweissatz sichtbar,
  der Rest steht im aufklappbaren Grund (R1 schreibt je Frosttag einen).
- **Auf dem Bildschirm heisst der dritte Zustand „Nicht bekannt"**, nicht
  „nicht prüfbar" — das ist das Wort der Prüfstände. Und die Gründe sagen
  „Wetterdienst", nicht „Open-Meteo"; „noch keine Ernte eingetragen", nicht
  „kein Eintrag im Ernte-Log".

Was nicht gerechnet wird: Mond, Höhenlage (`elevation`: 0 Schreiber),
Gartenlore („Eisheilige 15.05."), Schädlingswellen, „du giesst zu oft".

## Das Sieb (V2 §4, gebaut v33.35)

`_gsKalFiltern(liste, f)` laeuft NACH dem Pruefwerk — ein Filter ist ein Sieb
auf dem ERGEBNIS, nie eine Bedingung in der Rechnung. `gs_kal_filter =
{aus:[Arten], garten}` speichert die AUSGEBLENDETEN Arten, damit eine neue Art
automatisch sichtbar ist statt stillschweigend verschluckt.

**Fünf** Gruppen-Chips: Zu tun · Säen & Ernten · Wetter · Rückblick ·
Messwerte. Nicht „Fenster" — in dieser App ist ein Fenster ein STANDORT
(`_GS_DRINNEN` kennt es, das Basilikum steht am „Küchenfenster"). Und
„Messwerte" ist eine EIGENE Gruppe, weil die Vorgabe sie ausblendet: im
Rückblick stünde dessen Chip von Anfang an halb aus, ein dritter Zustand, den
niemand liest.

Jeder Chip trägt seine Zahl aus der UNGEFILTERTEN Liste des Monats — ein
ausgeschalteter sagt so, was er zurückhält. Der Tageskopf sagt
„(N ausgeblendet)" nur, wenn es etwas zu sagen gibt; einen Monatsfuss mit drei
Zahlen gibt es nicht. Die Punkte im Raster tragen die Farbe der GRUPPE (fünf),
nicht der Art (neun) — so erklären die Chips den Farbcode, und die Legende ist
weg. Dritter Leerzustand: „3 Einträge sind ausgeblendet" mit „Alle zeigen".

Der Schlüssel steht in `GS_USER_KEYS`, im Blob hin UND rück, `markDirty('state')`
von Hand, Schreibversuch am Rückgabewert. Die Sperre im Prüfstand
(`kalender_check` F1): Filter aus ⇒ Liste === `gsKalenderEreignisse`, Eintrag
für Eintrag — und mit gesetztem Filter liefert die Rechnung dieselbe Zahl.

## Die drei Namen

Mein Naturjahr liest seine Balken und die vier Kacheln seit v33.38 aus
`gsKalenderEreignisse(J-01-01, J-12-31)`: `scan`, `fund`, `gepflanzt` und
`ernte` mit `quelle === 'hand'` — die Schätzung (`quelle: 'regel'`) zählt
NICHT mit. Die Kachel heisst „Gepflanzt“, weil sie beide Wege zählt
(Garten-Pflanzung und Aufnahme in „Meine Pflanzen“). Davor rechnete es
selbst und lag zweimal daneben: „Funde“ stand IMMER auf 0 (gelesen wurde
`ts/time/found_at`, geschrieben wird `date`), und „Arten“ war die einzige
Kachel ohne Jahresfilter.

Säkalender gibt Fenster (eigene Kulturen + Merkliste) und nimmt „als gesät
eintragen“ als Tagebuch-Ereignis. Die **Garten-Timeline ist seit v33.38 weg**
(mit dem Parser entfernt, nicht mit einer Zeilensuche); `mi-timeline` heisst
„Rückblick“ und ruft `gsKalRueckblick()` — Gruppe `rueckblick` einschalten,
dann `gsKalenderOeffnen()`.

Sechs unabhängige Aussaat-Listen gibt es im Repo (`GS_SAE_DB`, `SEASON_DATA`,
`PLANT_DB`, `GARDEN_KNOWLEDGE.aussaatkalender`, `garden_tasks_catalog`,
`regional_garden_calendars`). Der Kalender liest EINE (`GS_SAE_DB`). Eine
siebte anzulegen ist der Fehler; die sechs zusammenzuführen ist eine
Daten-Scheibe, keine Kalender-Logik.

## Prüfstände

`kalender_check` (49 Fälle, Stand v33.40, Uhr gestellt auf 2025-09-01 12:00 UTC,
kein Fall hängt am echten Datum; je Regel gut · schlecht · nicht prüfbar, aus
dem gerenderten HTML gelesen) · `sensor_check` (Messwerte, Alarme, Lina-Kalender-
Zeilen) · `contrast_check` öffnet das Kalender-Fenster · `wiring_check` die
Zugänge. Der Wetter-Cache im Seed liegt RELATIV zur gestellten Uhr, sonst
„Stand vor 8'000 h" und `ftag < heute` verschluckt den Frost.
