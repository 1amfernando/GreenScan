# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-09-05 · **Branch**: `main` · **Version**: `v32.59` · **Release**: ✅ live seit v26.0 (Stripe Live-Mode seit v26.40)

---

## 0 · Daily-/Weekly-/Monthly-Routine-Eintraege (neueste zuerst)

> Eingefuehrt 2026-05-20 mit `CODE_ROUTINE_MASTER.md`. Code haengt nach jeder Session einen Eintrag hier oben an.

### 2026-09-05 (ev) — v32.59: der Giess-Zettel für die Abwesenheit

`docs/OEKOSYSTEM-V1.md` §11 Idee 13, Stufe 0. `gsGiessZettel` listet
jede Fälligkeit im Fenster (Stille Tage, sonst 14 Tage) aus beiden Listen,
aus derselben Rechnung wie „Heute zu tun", Intervall für Intervall; mit
Ort (Standort / Gartenname), Aufgabe, Intervall, „schon fällig". Fenster
mit Tabelle, Druckansicht mit Abhak-Kästchen, Zugänge in „Stille Tage" und
der Menü-Suche. Nichts wird gefälscht: was die Nachbarin giesst, steht
nicht in der App. `kalender_check` 17 Fälle. Zwei Gegenproben rot.

### 2026-09-05 (eu) — v32.58: „Deine Woche" auf der Startseite

`docs/OEKOSYSTEM-V1.md` §11 Idee 8. Neue Karte im Startseiten-Stapel
(`#woche-card`, zweite Karte): erledigte und heute offene Aufgaben,
Tagebuch-Einträge, Regen und Frostnächte aus den **gemessenen** Werten
des Wetterdiensts, Feuchte-Tief je Gerät, schweigende Geräte. Keine Note;
„kein Wert" statt 0; ohne Daten sagt die Karte, wie sie zu Daten kommt.
`sensor_check` 21 Fälle. Gegenprobe rot.

### 2026-09-05 (et) — v32.57: zwei Standorte im selben Diagramm; Messwerte als CSV mit Einheit

`docs/OEKOSYSTEM-V1.md` §11 Ideen 9 und 12.

- **Vergleich** im Messwerte-Dashboard: Messgrösse, Gerät A, Gerät B, zwei
  Linien mit Legende und Wertezahl; nur Messgrössen, die mindestens zwei
  Geräte haben; Hinweis „Verlauf, nicht Zahl". `_gsVerlauf` schreibt
  `data-reihen`.
- **CSV-Export der Messwerte** (`gsExportMesswerteCSV`): Zeitpunkt, Gerät,
  Messgrösse, Wert, **Einheit**, Qualität, Quelle — ein Wert je Zeile,
  chronologisch; dritter Knopf in „Daten exportieren". Der alte
  Download-Helfer ist lokal in `gsExportPlantsCSV` — der neue Export hat
  seinen eigenen.

`sensor_check` 20 Fälle (+2). Zwei Gegenproben rot.

### 2026-09-04 (es) — v32.56: Lina kennt die Zahlen; Frost aus der Vorhersage im Kalender

`docs/OEKOSYSTEM-V1.md` §11 Ideen 6 und 10 (Stufe 0).

- **Lina.** `gsLinaZahlen()` im Kontext: fällige Aufgaben, verletzte
  Regeln, je Gerät letzter plausibler Rohwert mit Zeit, Anzahl (7 Tage)
  und Lücke; ohne Daten „keine"; Deckel 700 Zeichen; Anweisung „nur aus
  dem Kontext zitieren". Bis v32.55 wusste sie Pflanzenzahl, Region,
  Jahreszeit. Der Prüfstand hält jede Zahl gegen einen Datensatz — und hat
  die gerundete Anzeige (31.5 → 32) sofort gemeldet.
- **Frost.** Ereignis „❄️ Frost möglich — Tiefstwert 1.2 °C" aus
  `gs_weather_cache.daily` (≤ 2 °C, `GS_FROST_GRENZE_C`), nur heute und
  später, mit Quelle, Standort, Alter und „kein Messwert" im Grund.

`sensor_check` 18 Fälle, `kalender_check` 16. Zwei Gegenproben rot.

### 2026-09-04 (er) — v32.55: Regel-Vorlagen nur, wo eine Zahl steht; Messgrössen in vier Sprachen

`docs/OEKOSYSTEM-V1.md` §11 Ideen 5 und 22.

- **Vorlagen.** `gsSchwellwertVorlagen(g)` aus drei Quellen mit Namen im
  Grund: Artenliste (Licht bei 40 Hauspflanzen), Kulturdaten
  (`PLANT_DB.bodentemp`), eigener Verlauf (14 Tage → Tief und Hoch). Nie
  Bodenfeuchte aus Artendaten (Prozent ist sensorabhängig). Im
  Regel-Formular als Knöpfe; Antippen füllt, angelegt wird von Hand; ohne
  Zahl „keine Empfehlung hinterlegt".
- **Labels.** `_gsMetricLabel(k)` an allen acht Stellen statt `label_de`:
  Tabellenspalte (`label_fr/it/en`), dann Sprachschicht (`metric_<key>`,
  elf neue Schlüssel), dann Deutsch. `_gsGeraetArt` übersetzbar.
  `i18n_check` kennt den Katalog als Datenliste (Präfix).

`sensor_check` 17 Fälle (+2). Drei Gegenproben rot. Eine Falle beim Bau:
der erste Verlaufs-Filter konnte nie eine Vorlage finden (der älteste
Wert im Fenster ist nie 14 Tage alt) — der Prüfstand hat es gemeldet.

### 2026-09-04 (eq) — v32.54: das Meldungs-Budget — eine Meldung am Tag, Stille-Zeit auch lokal

`docs/OEKOSYSTEM-V1.md` §11 Idee 7. Die Erinnerungen, die das Gerät selbst
zeigt (`gsNotif`, `scheduleAllNotifications`), kannten weder Stille-Zeit
noch Pause, planten eine Meldung je Aufgabe und lasen nur `myPlants` —
Garten-Pflanzungen mit Aufgaben (seit v32.47) meldeten sich lokal nie.

- `gsNotif.stille()` — dieselbe Regel wie der Server (`gs_push_settings`:
  22–7 Uhr, `pauseUntil`); `show` schweigt in der Stille und sagt warum;
  `showKategorie` — eine je Kategorie und Tag; Protokoll `gs_notif_log`.
- `scheduleAllNotifications` bündelt aus `gsGetDueTasks()` (beide Listen,
  Sensor-Grund als 📶), lässt `gs_reminder_prefs.disabled` aus, verschiebt
  in der Stille ans Ende statt zu verwerfen.
- `gsSensorAlarmeMelden()` — verletzte `notify`-Regeln, eine Meldung am
  Tag, `cooldown_minutes` je Regel (seit v32.48 im Datensatz, nie gelesen).
- Wochenzähler in den Push-Einstellungen.

`einstellungen_check` 33 Fragen (+4). Drei Gegenproben rot mit echten
Zahlen („3 Meldungen statt 1", „Tomate giessen" trotz Stummschaltung,
zweite Alarm-Meldung am selben Tag).

### 2026-09-04 (ep) — v32.53: ein Sensor macht Giessen fällig, das Abhaken bestätigt sich am Sensor

Die Verbindung aus `docs/OEKOSYSTEM-V1.md` §6 (§11 Idee 4) — der Teil, der
aus einem Sensor ein Werkzeug macht:

- **Regel → Aufgabe.** `gsSensorAufgabenAbgleich()` ist die eine Stelle,
  die `device_rules.action` liest (bis v32.52 las es niemand). Je Pflanze und
  Aufgabe alle `task:<key>`-Regeln an ihren Geräten (`plant_id` zuerst,
  sonst der Garten): verletzt → `vorgezogenAuf` heute + Grund; erfüllt →
  aufgehoben; nur „nicht prüfbar" → nichts. `getDaysUntilDue` hat den
  vierten Parameter an allen neun Aufrufern; die Verschiebung der Person
  gewinnt; Erledigen hebt auf. Tagesplan, Glocke, Kalender (`quelle:
  'sensor'`) nennen Gerät und Messwert. Regel-Formular mit Aktion. Server:
  `20260904_plant_tasks_due_vorgezogen.sql` (nicht angewandt).
- **Giess-Bestätigung.** `gsGiessBestaetigung(p, ts)`: Δ ≥ 10 Punkte innert
  60 Min → bestätigt · sonst nicht gemerkt · ohne Wert/Gerät nicht prüfbar;
  vorsichtigstes Gerät zählt; im Kalender und im Pflanzentagebuch. Kein
  Messwert setzt ein `lastDone`.
- **Nebenfund:** der Lösch-Knopf im Pflanzentagebuch war für alle
  Abhak-Einträge tot (`gsDeleteDiaryEntry('p2',2025-09-01T12:00:00.000Z)` —
  Zeitstempel unzitiert im `onclick`), die Liste unsortiert (String minus
  String). Beides behoben.

`sensor_check` 15 Fälle (+Regel → Aufgabe, +Giess-Bestätigung). Vier
Gegenproben rot mit echten Zahlen. Eine Falle beim Bau: Pflanzungen bekommen
ihre Aufgaben beim Laden mit `lastDone = jetzt` — „heute erledigt" darf ein
Sensor am selben Tag nicht wieder fällig machen; der Fall stellt „gestern
gegossen" her.

### 2026-09-04 (eo) — v32.52: der Wetterdienst ist das erste Gerät; ein Weg hinein mit Dublettensperre

Vier Schritte aus `docs/OEKOSYSTEM-V1.md` §11 (Ideen 2 · 3 · 11 · 21), alle
Stufe 0, alle ohne Fernandos Entscheid möglich (Idee 1 wartet darauf):

- **Ein Weg hinein.** `_gsMesswerteAnhaengen(g, liste)` — ein Wert wie
  hundert, einmal lesen, einmal schreiben, nach `ts` sortiert, Dublettensperre
  auf `(geraet_id, metric, ts)` wie der Primärschlüssel in `device_readings`.
  Ein Wert ohne Zeitangabe ist immer neu (bei gestellter Uhr rückt er eine
  Millisekunde weiter — der Prüfstand hat es gefunden: zwei Handmessungen in
  derselben Millisekunde galten als Dublette). Ids sind UUIDs.
- **Wetter als Gerät.** `gsWetterGeraetAbgleich()`: Open-Meteo-Stunden →
  Gerät „Wetterdienst · Ort" mit `air_temp` und `rain`, nur bis jetzt, sieben
  Tage lokal, idempotent; nach jedem Wetterabruf und beim Öffnen von
  „Messwerte". Nicht im Eintrags-Formular, kein Tages-Ereignis; entfernen
  merkt sich die App (`gs_wetter_geraet_aus`), ein Schalter holt es zurück.
- **Katalog vom Server.** `gsMetricKatalogLaden()` ersetzt `gs_metric_catalog`
  nur bei Erfolg (≥ 3 vollständige Zeilen); bis die Migration angewandt ist,
  passiert nichts — genau richtig.
- **Gerät in den Beispieldaten.** `_seed.js` hat ein Gerät, 15 Werte, eine
  verletzte Regel; jeder Prüfstand vermisst jetzt ein gefülltes Dashboard.

`sensor_check` 13 Fälle (+Dublette, +Wetter, +Katalog), `kalender_check`
„Ohne Daten" räumt auch die Geräte. Vier Gegenproben rot mit echten Zahlen
(„zweiter Abgleich neu 74 statt doppelt 74", „96 statt 74 Werte", „eine leere
Antwort ersetzt den Katalog", „1 Ereignis ohne Datengrundlage").

### 2026-09-04 (en) — v32.51: Ideen für die Sensoren (§11), vier Stufe-0-Reparaturen

Fernandos Auftrag „Bringe Ideen die auch mit den zukünftigen Sensoren eine
Rolle spielen könnte […] Nichts darf fehlen" — beantwortet in
`docs/OEKOSYSTEM-V1.md` **§11**: 25 Ideen, jede mit Nutzen · Daten und
Anknüpfung im Repo · Stufe · prüfbar ohne Hardware · Falle · Aufwand;
Vermutungen als solche markiert. Drei Berichte aus drei Blickwinkeln
(Hardware/Anbindung · Alltag · Daten/Modell), danach **35 Behauptungen
einzeln nachgeprüft** — 30 bestätigt, 4 präzisiert, 1 widerlegt. Ehrlich
dazu: die Prüfer-Flotte (39 Agenten) fiel nach zwei Urteilen am
Monatslimit der Organisation aus; 33 Behauptungen von Hand nachgezählt, die
drei Diff-Gegenleser und der Lücken-Prüfer liefen nicht (Lücken selbst
gesucht: Ideen 21–25). Drei Dinge bleiben ungeprüft, weil sie die lebende
Datenbank brauchen (in §11 benannt).

**Der wichtigste Befund korrigiert den Entwurf selbst:** §1 sagte
„Tabellen für Geräte: keine" — live existieren `sensor_devices` ·
`sensor_readings` · `sensor_alerts`, dazu eine BLE-Schicht und ein
ESP32-Assistent, der das **Sitzungs-Token** in die Firmware kopieren lässt.
Zwei Geräteschichten sind „zwei Speicher für dieselbe Frage"; Idee 1 ist
deshalb die Voraussetzung, kein Wunsch. Weitere Korrekturen: §2.3
(„Tagesaggregate unbegrenzt" hält das Schema nicht — die View stirbt mit
dem Prune), CLAUDE.md §3.4 (`opts.brain` injiziert **keine** Persona, nur
ein Log-Label).

**v32.51 — vier Reparaturen, die schon Stufe 0 sind:**

- **Der Regen-Draht aus v31.84 war tot.** `gsPflanzeDraussen` las
  `p.location` — ein Feld, das keine Speicherstelle schreibt. Der Hinweis
  „Regen heute — Giessen kann warten" erschien in 66 Versionen für keine
  Pflanze; `kalender_check` kannte nur „ohne Wetter kein Hinweis". Jetzt
  beantwortet die Gartenart die Frage (`GS_GARTEN_ARTEN.unter_glas`), und
  der Fall stellt 8 mm her: Zucchini (Balkon) ja, Basilikum (Küchenfenster)
  nein, Tagesplan zeigt „8 mm Regen heute".
- **Das Backup kannte die Messwerte nicht** (`gs_geraete` ·
  `gs_geraete_regeln` · `gs_messwerte`). Version 16; `_gsBackupDaten()` /
  `_gsBackupEinspielen()` als prüfbare Funktionen; bei vollem Speicher sagt
  das Einspielen, was nicht gesichert wurde, und lädt nicht neu.
- **Der Deckel der Messwerte nahm blind die ältesten** — in Stufe 0 also
  Handmessungen ohne Kopie. `_gsMesswerteDeckel`: hochgeladene zuerst, dann
  der alte Deckel mit Archiv.
- `GS_NOTIF_ZIELE.sensor_alert` stand zweimal im Objekt.

`sensor_check` 10 Fälle, `kalender_check` 15 (Regen-Fall erweitert). Drei
Gegenproben, alle rot mit den echten Zahlen. Regression: 16 Prüfstände
grün, Layout-Vergleich 0 Änderungen, Kontrast 0/0.

### 2026-09-04 (em) — v32.50: drei Aussagen widerlegt, drei behoben

Die gegnerische Prüfung von `docs/MEINE-PFLANZEN-AUDIT.md` (drei Prüfer,
Auftrag: widerlegen, am Code v32.49) hat die elf Befunde bestätigt und
**drei Aussagen des Textes** gekippt. Alle drei behoben, je mit Fall und
Gegenprobe in `kalender_check` (jetzt 15 Fälle).

- **„Alle erledigt ✓" hatte keine Rückfrage** — der Text behauptete eine
  („geprüft, nicht angenommen"), die Prüfung zählte 0 Aufrufe von
  `gsConfirmModal`. Und der Knopf lief nur über `myPlants`: `Zucchini:water`
  blieb nach dem Tipp fällig. Jetzt: Rückfrage mit Aufgabenliste
  (Pflanze · Aufgabe, bis sechs, dann „… +n"); Fälligkeit aus
  `gsGetDueTasks` (KALENDER-V1: eine Rechnung, beide Listen); Zugehörigkeit
  über die Referenz, Speichern je Liste (`savePlantsToStorage` /
  `saveGardenData`); Glocke, Zettel, Tagesplan ziehen mit. Sechs neue
  i18n-Schlüssel.
- **Die Kopfzahlen zählten verschiedene Listen** — „Pflanzen" nur
  `myPlants`, „fällig"/„versorgt" seit v32.47 beide: „3 · 4 · 1". Ohne
  Zimmerpflanzen stand „Noch keine Pflanzen" neben einer Kopfzahl 1. Jetzt
  zählt die Summe `_alleMitAufgaben`; der 🏠-Reiter sagt bei reinen
  Garten-Pflanzungen „Keine Zimmerpflanzen — deine Pflanzen stehen im
  Garten" und führt per Knopf zum 🌳-Reiter; „Alles erledigt für heute"
  erscheint auch ohne Zimmerpflanzen. Der Fall hält
  `versorgt + Pflanzen mit Aufgaben = Pflanzen` fest.
- **Befund 7 war halb behoben** — die Pfeile frei, aber bei 3 und 8
  fälligen Aufgaben lag der Zettel auf den ⏰-Knöpfen der Fällig-Liste
  (19 %/39 % bzw. 40 %/17 %). Der Prüfstand kannte nur den Pfeil. Jetzt
  `body.gs-zettel-da … .due-card{padding-right:44px}`, und der Fall prüft
  **jedes** Bedienelement unter dem Zettel: schmale (≤ 120 px) ganz frei,
  breite zu zwei Dritteln. Gegenprobe: „due-card-btn 19 %, due-card-btn
  39 %" — dieselben Zahlen wie in der Prüfung.

**Die Lehre steht schon dreimal in CLAUDE.md und traf trotzdem mich:** ein
Satz wie „geprüft, nicht angenommen" ist erst dann einer, wenn der Aufruf
gezählt wurde. Und: **eine Frage, die nur EIN Ziel kennt, meldet nur
dieses** — der Pfeil-Fall war grün, während daneben zwei Knöpfe verdeckt
waren.

Regression: siehe Prüfstand-Zeile unten im Eintrag (el) — dieselben
Prüfstände, dieselben Nullen.

### 2026-09-04 (el) — v32.49: das dritte Tagebuch, und ein Zettel, der Platz bekommt

Zwei offene Befunde aus `docs/MEINE-PFLANZEN-AUDIT.md` (3 und 7), beide
mit Prüfstand-Fall und Gegenprobe.

#### Das Cloud-Tagebuch (Befund 3, Rest)

`gsDiarySubmitEntry` (das Formular mit Typwahl, Foto, Erntemenge,
Schädling) schrieb nur in `garden_diary` — lokal wusste niemand davon; das
Gartentagebuch und der Kalender sahen es nie. Jetzt:

- **Spiegel** `gs_garden_diary_cache` (500 neueste Zeilen, schlank: id,
  Typ, Titel, Text, Latein, Erntemenge, Foto-URL, Zeit), aufgefrischt beim
  Öffnen des Gartentagebuchs und 6 s nach dem Start. Bei vollem Speicher
  bleibt der alte Stand (`setItem === false`, CLAUDE.md §3.5).
- `gsTagebuchAlle()` liest jetzt **drei** Quellen; Cloud-Einträge tragen
  `herkunft: 'cloud'` und die Id `cd:<uuid>`. Die Pflanze wird über den
  lateinischen Namen zugeordnet — **nur wenn er in beiden Listen genau eine
  trifft** (`_gsPflanzeAusLatein`), sonst bleibt der Name stehen.
- Löschen aus der gemeinsamen Sicht: `DELETE` mit `return=representation`,
  geprüft mit `_gsSchreibOk`; aus dem Spiegel fliegt der Eintrag erst nach
  bestätigter Löschung.
- Ohne Netz: der Spiegel bleibt, mit Vermerk „aus der Cloud".
  `GS_USER_KEYS` kennt den Schlüssel — er geht beim Abmelden weg.

#### Der Notizzettel (Befund 7)

Gemessen bei 0, 1, 3 und 8 fälligen Aufgaben (412 px): bei 1 und 3 lag der
Zettel (x ab 367) genau über dem Pfeil der ersten Pflanzenkarte (x bis
381). Er wandert mit der Liste — `position:fixed` in einem animierten
Vorfahren wirkt wie `absolute` — also hilft kein anderer `top`. Die Karten
lassen ihm jetzt Platz (`body.gs-zettel-da` → `padding-right:56px` am
Kartenkopf), und nur solange er sichtbar ist; `gsRenderTaskNote` setzt die
Klasse. `kalender_check` misst alle vier Stände.

#### Und eine Falle im eigenen Prüfstand

Der Fall „ohne Daten" leerte Pflanzen und Gartentagebuch — und liess den
neuen Cloud-Spiegel stehen. Er wurde rot („1 Ereignis ohne
Datengrundlage"), sobald der Spiegel existierte. **Wer eine Quelle
hinzufügt, muss jeden Fall nachziehen, der „keine Quelle" herstellt.**

`kalender_check` 13 Fälle grün. Die gegnerische Prüfung der drei Entwürfe
(Audit, Kalender V1, Ökosystem V1) ist am 03.09. um 21:30 UTC am
Kontingent gescheitert und lief am 04.09. erneut — Ergebnis in (em) und in
`docs/MEINE-PFLANZEN-AUDIT.md`, Abschnitt „Gegnerische Prüfung".

### 2026-09-03 (ek) — v32.48: die Person ist das erste Gerät — Messwerte, Stufe 0

Fernandos Auftrag: *„Ein Dashboard, das die Werte der Sensoren trackt, so
aufgebaut, dass weitere Systeme gekoppelt werden können; die App muss für
das Ökosystem vorbereitet sein."* Entwurf `docs/OEKOSYSTEM-V1.md` (Stand
v32.45), Schema als Migration (nicht angewandt), jetzt das Frontend von
Stufe 0 — **ohne ein einziges Stück Hardware**, und genau das ist der Punkt.

#### Gebaut

- **Katalog** `gsMetricKatalog()` — elf Messgrössen mit Einheit, Bereich,
  Aggregation; eingebauter Startbestand, ersetzt durch den Cache der Tabelle,
  sobald es sie gibt. Nirgends ein `if (metric === …)`.
- **Geräte** (`gsGeraetAnlegen`, Art `manual`) — „wartet auf den ersten
  Wert", dann `active`. Verbunden heisst erst nach dem ersten Wert.
- **Messwerte** (`gsMesswertEintragen`) — Katalogprüfung, `quality` 2/1, nie
  verworfen; bei vollem Speicher `ok:false` mit Grund (nicht „gespeichert").
- **Regeln** (`gsRegelnPruefen`) — unter/über/schweigt, drei Zustände, jede
  mit Grund („zuletzt 31,5 % um 12:00, Schwelle 40").
- **Dashboard** `gsMesswerteOeffnen()` — Kacheln, Verlauf (`_gsVerlauf`,
  Canvas, ~40 Zeilen, keine 200 KB), Markierungen „💧" aus dem Tagebuch der
  verknüpften Pflanze, Regeln, Formulare. Zugänge: Menü-Suche, Kalender.
- **Kalender**: Messwerte als `messung` (ein Ereignis je Gerät und Tag),
  verletzte Regeln als `alarm` am heutigen Tag. `GS_NOTIF_ZIELE.sensor_alert`
  → Dashboard (Stufe 1 schreibt die Art).
- Speicherlisten, `state`-Blob, `stateMap`, `STATE_KEYS` nachgezogen.

#### Der Prüfstand kam zuerst

`sensor_check.js` (8 Fälle) wurde gegen den Vertrag in `OEKOSYSTEM-V1.md`
§9a geschrieben, BEVOR eine Zeile Code stand — erster Lauf: acht rote Fälle
(„gsMetricKatalog fehlt"). Nach dem Bau: acht grüne. Gegenprobe: unplausible
Werte verworfen → rot („250 % wurde verworfen — ein kaputter Sensor ist eine
Information"); Regel ohne Werte auf „erfüllt" → rot.

Zwei Nachträge aus den Läufen: die **Achse des Verlaufs** folgt nur noch
plausiblen Werten (ein 250-%-Wert zog sie auf 272 und drückte die Linie auf
einen Strich; jetzt am Rand markiert, `data-vmax` im Prüfstand) — und
`contrast_check` fand im Dunkelmodus den Knopf „📊 Messwerte" im Kalender mit
**1,35:1** (Schwarz auf dunkler Karte, weil `.gs-dp-kal` keine `color`
setzte). Ein Knopf trägt seine Textfarbe selbst; nachgemessen 14,5:1.

**Offen (Stufe 1):** `device-ingest` (Edge, Geräte-Token), Cron
`device-alerts`, Push `sensor_alert`, Wetter als virtuelles Gerät,
Bestätigung erledigter Aufgaben durch Messwerte — braucht ein Gerät zum
Testen und die Migration.

### 2026-09-03 (ej) — v32.47: Garten-Pflanzungen bekommen Pflege — Kalender Stufe 2

Die grösste Lücke aus `docs/MEINE-PFLANZEN-AUDIT.md`: **Garten-Pflanzungen
hatten keine Pflege.** `gs_plantings` kannte kein `tasks`; „Heute zu tun"
galt nur für Zimmerpflanzen — in einer Garten-App. Jetzt:

- **Vorgaben je Gartenart** (`GS_PFLANZUNG_VORGABEN`: Balkon giessen 2 /
  düngen 14 / prüfen 7 · Freiland 3 / 30 / 7 · unter Glas 1 / 14 / 7) — Intervalle,
  keine Botanik; das Pflanzungs-Detail sagt, dass es eine Vorgabe ist.
  Bestehende Pflanzungen werden beim ersten Lesen nachgerüstet
  (`_gsPflanzungenNachruesten`), mit `lastDone = jetzt`.
- **`_gsPflanzeFinden(id)`** sagt, in welcher Liste eine Pflanze steht und
  wo gespeichert wird — `gsQuickDone` und `gsSnoozeTask` laufen für beide
  Listen über denselben Weg, ins richtige Buch, in den richtigen Speicher.
- **Ernte-Schätzung** (`calcHarvestDate`, seit v13 im Code, nie im Kalender)
  als Info-Ereignis mit Grund „Schätzung … kein Versprechen"; **Regen** nur
  mit Messwert; das **Tagebuch-Formular** hat ein Datum (Zukunft =
  Erinnerung) und speichert `pflanze_id`, wenn der Name eindeutig ist.
- `buildPlantCard` (60 Zeilen, nie aufgerufen) entfernt.

`kalender_check` 11 Fälle (4 neu, test-first: geschrieben vor dem Code,
beim ersten Lauf danach alle grün — die Gegenprobe war deshalb Pflicht:
Nachrüsten ausgebaut → rot, Zukunfts-Erkennung ausgebaut → rot).

**Offen:** das Cloud-Tagebuch (`garden_diary`) in `gsTagebuchAlle`;
Aussaatfenster aus `season`; der Notizzettel über dem Karten-Pfeil (Befund 7).

### 2026-09-03 (ei) — v32.46: der Kalender — und die Beispielpflanzen, die nie eine Aufgabe hatten

Fernandos nächster Auftrag: *„Meine Pflanzen verbessern … einen Kalender,
mit dem Tagebuch verbunden, sehr intelligent verdrahtet; ‚Heute zu tun'
muss damit verknüpft sein."* Die Untersuchung (solo — das Agenten-Kontingent
der Umgebung war bis 20:00 UTC erschöpft) steht in `docs/KALENDER-V1.md` §1;
die drei wichtigsten Befunde:

| Befund | Beleg |
|---|---|
| **Garten-Pflanzungen haben keine Pflege.** `gs_plantings` trägt kein `tasks`-Feld; „Heute zu tun" kennt nur Zimmerpflanzen | `savePlanting` ~Z. 70865 |
| **Verschieben fälschte die Geschichte.** `gsSnoozeTask` setzte `lastDone` auf ein erfundenes Datum | ~Z. 9788 |
| **Drei Tagebücher, die nichts voneinander wissen.** Jedes Abhaken landet in `p.diary`; das Gartentagebuch las nur `gs_gartentagebuch` — der Kommentar versprach beides, der Code tat eines | `gsQuickDone` ~Z. 9737 |

#### Gebaut (Stufe 1 des Entwurfs)

- **`gsKalenderEreignisse(von, bis)`** — EINE Funktion für „was ist an diesem
  Tag": Aufgaben (aus `lastDone + Intervall`, mit Verschiebung), Tagebuch
  (beide Bücher), Pflanzungen. Gerechnet, nicht gespeichert; jedes Ereignis
  trägt `grund`. `gsGetDueTasks` bleibt die Sonderform für heute.
- **Kalender-Bildschirm** `gsKalenderOeffnen(tag?)`: Monatsraster mit Punkten
  je Ereignisart, darunter der Tag mit Kästchen zum Abhaken; Tippen zeigt den
  Grund. Drei Zugänge (Startseite, Meine Pflanzen, Menü-Suche).
- **`gsTagebuchAlle()`** — Gartentagebuch ∪ Pflanzentagebücher, eine
  Lesefunktion; `openGartenTagebuch` und das Startseiten-Widget lesen sie.
  Löschen aus der gemeinsamen Sicht trifft das richtige Buch (`pd:`-Ids).
- **`snoozedUntil`** statt gefälschtem `lastDone`; `getDaysUntilDue` hat den
  dritten Parameter, alle elf Aufrufstellen geben ihn mit; Erledigen räumt
  ihn ab. Migration `20260903_plant_tasks_due_snooze.sql` für den Server-Cron
  (nicht angewandt — bis dahin kann der Push eine verschobene Aufgabe
  anmahnen; steht in `docs/FUER-FERNANDO.md` §5).

#### Und der Fund, der alles andere erst messbar machte

`_seed.js` gab den drei Beispielpflanzen `lastWatered`/`waterEvery` — Felder,
die die App nirgends liest. **Von v31.46 bis v32.45 hatten sie keine einzige
Aufgabe.** Fällig-Liste, „Heute zu tun", Notizzettel, Glocke: in allen 22
Prüfständen leer vermessen. Richtiger Schlüssel (die Lehre aus v31.46),
falsche Felder. Seit v32.46: eine überfällig, eine heute, eine in Ordnung —
`favs` misst 206 statt 120 Elemente, `home` 225 statt 195, und der erste Lauf
meldete den Notizzettel, der 1 px über den Rand ragte (`right:0` +
`rotate(-1.5deg)`).

`kalender_check.js` (Prüfstand 23, sieben Fälle, gestellte Uhr): eine
Antwort · Verschieben fälscht nichts · Abhaken steht im Gartentagebuch ·
Anzeige aus dem HTML · drei Zugänge · ohne Daten ein leerer Kalender, der
es sagt. Gegenprobe je Reparatur gemacht.

Zwei Fallen beim Bau: der erste Lauf erwartete „September 2026" — `now` in
`_seed.js` ist 2025, und die Beispieldaten sind relativ dazu gebaut (das
Jahr ist egal, die Erwartung war der Fehler); und `MENU_ITEMS` ist ein
Skript-Bereichs-Name ohne `window.`, wie `socialPosts` seit v32.24.

Die ganze Bestandsaufnahme mit elf Befunden (5 behoben, 2 teilweise, 4
offen) steht in `docs/MEINE-PFLANZEN-AUDIT.md` — darunter der Notizzettel,
der bei drei fälligen Aufgaben den Pfeil der ersten Karte verdeckt, und
`buildPlantCard`, 60 Zeilen ohne einen einzigen Aufruf.

**Offen (Stufe 2, `KALENDER-V1.md` §6):** Aufgaben für Garten-Pflanzungen,
Aussaat-/Erntefenster aus den Artendaten, Regen als Ereignis, Datumsfeld im
Tagebuch-Formular; das dritte Tagebuch (Cloud-Formular `gsDiarySubmitEntry`
→ `garden_diary`) in die gemeinsame Sicht.

### 2026-09-03 (eh) — v32.45: die Vorsichts-Regel, gegnerisch geprüft — und dreimal korrigiert

Der Arten-Daten-Workflow (sechs Blickwinkel, drei Gegenprüfungen, dann war
das Kontingent der Umgebung erschöpft) hat die Regel aus v32.43 an zwei
Stellen widerlegt, und beim Reparieren fand ich eine dritte. Alle drei
verbindet dasselbe: **richtige Zahlen, falsche Folgerung.**

#### 1 · Eine Unterart ist nicht die Art

`_gsNormLat` streicht var./ssp./f. — damit stand `PI427 Kleiner Perlpilz`
(*Amanita rubescens* f. *annulosulphurea*, **tox 4**) in der Gruppe des
Perlpilzes (tox 0–2) und gewann jeden Perlpilz-Scan. Sein eigenes
`lookalike`-Feld grenzt ihn vom Perlpilz ab. Umgekehrt landete „Broccoli /
Brassica oleracea var. italica" bei `FD0778 Kohl`, einem Einlese-Rumpf ohne
Text. **`_gsArtGruppe(sp, abfrageLat)` gruppiert jetzt auf der Stufe der
Anfrage** — ohne Qualifier zählen nur Einträge ohne Qualifier, mit
Qualifier zuerst der exakte Treffer.

#### 2 · Ein Platzhalter ist keine Vorsicht

Einlese-Rümpfe tragen `edible:false` ohne Warnung und ohne Verwechslung.
„Nicht essbar zuerst" hielt sie für vorsichtiger: **94 Namens-Abfragen
gepflegter Einträge landeten auf einem Rumpf, 82 davon auf einer anderen
Art**, dazu 12 gepflegte Gemüse-Einträge — das Prüfwerk meldete „nur als
ungeprüfter Einlese-Eintrag vorhanden" für Broccoli und Mangold. Bei
gleicher Giftstufe gewinnt jetzt der Eintrag **mit** `warning`/`lookalike`;
`edible` zählt erst danach. Gemessen: 0 von 2'954.

#### 3 · Vier Sekunden nach dem Start sah jeder Rumpf bearbeitet aus

Der Fall blieb rot, obwohl die Regel stimmte — und die Ursache war eine
Zeitfrage: `gsAutoFillDBGaps` und `gsAutoFillLookalikes` schreiben ~4 s nach
dem Laden **Vorlagen-Text** („Ähnliche Arten in der Region …") in
`lookalike`, `warning` und `uses` jedes Eintrags, der leer ist. Danach hat
jeder Rumpf ein `lookalike`. Die Vorlagen sind jetzt markiert
(`_lookalike_tpl` …) und zählen nicht als Bearbeitung.

> **Eine Probe, die sofort nach dem Laden misst, misst einen anderen
> Zustand als der Prüfstand, der 4 s wartet.** Meine Einzel-Probe war grün,
> der Prüfstand rot — beide richtig. Wer widersprechende Messungen hat,
> misst beide Stände mit demselben Werkzeug (CLAUDE.md §7.1, v32.07).

Und dabei gefunden: beide Routinen laufen nur **einmal je Gerät**
(`gs_db_filled_v3`, `gs_lookalike_filled`). Dieselbe Artenkarte zeigt je nach
Gerät einen Vorlagen-Satz oder nichts — bewusst offen gelassen, Entscheidung
für Fernando (`docs/ARTEN-DATEN.md` §7).

#### Dazu vier Stellen aus dem Blickwinkel „Verbraucher"

`gsGetCompleteness` kannte `alt` nicht (fehlende Höhe kostete 0 %) ·
„Gut belegt" verschwieg die Regeln, die nichts sagen konnten · der
Blühkalender zeigte `🎨 –` als Wert · die Artenkarte las die Höhe nicht aus
dem Lebensraum-Text, das Prüfwerk schon (26 Arten). Alle vier behoben.

#### Korrekturen an meinen eigenen Aussagen

Die Wacholder-Anekdote aus (ef) war falsch gemessen (v32.42 traf T018,
nicht FD0660). „Pilze/Moose haben die beste Abdeckung" war falsch (Gemüse
100 %). „Paketregister umgehen den Proxy über NO_PROXY" war falsch (es ist
ein Gateway mit Freigabeliste). Alles in `docs/ARTEN-DATEN.md` §6 mit dem
Vermerk, was hielt und was nicht.

Prüfstände: `scan_check` 55 Fälle grün (2 neu, je mit Gegenprobe: Regel
ausgebaut → rot), `speicher_check` 10/10, `render_check` 0/0/0,
`contrast_check` 0/0, `a11y_check` 0, `wiring_check` 0.

### 2026-09-03 (eg) — v32.44: die Welle aus (bc), zwei Tage später geschlossen

Vor Fernandos neuen Aufträgen (Meine Pflanzen, Kalender, Sensoren) das
Angefangene zu Ende: die **toten Rettungswege um `localStorage.setItem`**.
Der Wrapper wirft nie (v30.98), also lief kein `catch { Rettungsweg }` je —
(bc) hatte drei repariert und sechs benannt.

#### Nachgezählt, nicht geglaubt

Die Liste aus (bc) war zwei Tage alt. Ein Skript über alle 336
`setItem`-Aufrufe (250 in `try`) fand **30 `catch`-Blöcke mit Inhalt**; nach
Lesen jeder Stelle blieben **sechs echte**, drei davon anders als in (bc)
vermerkt (`_gsRestoreStats` und die Backup-Flags waren längst am
Rückgabewert). Die sechs:

| Stelle | sagte bei vollem Gerät | jetzt |
|---|---|---|
| `gsTagebuchSave` | nichts — Eintrag still weg, Schrumpf-Rückfall tot | schrumpft auf 300, dann Meldung, `false` |
| `gsAddMarker` | `lsOk = true` bedingungslos → „gespeichert" | `lsOk` nur bei Erfolg, Quota-Meldung erscheint |
| `_gsTrackSaveTrack` | Index zurück → Track galt als gespeichert | `-1` + Meldung, Live-Stand bleibt liegen |
| `gsPlans.save` (`writeLS`) | `return true` immer; Schrumpf auf 20 tot | echter Rückgabewert, `entry.local_failed`, Meldung |
| `vote` (Abstimmung) | `_vk = 'anon:fallback'` — **EIN Schlüssel für alle** mit vollem Speicher | Sitzungs-Schlüssel je Person, nie geteilt |
| `doChangePassword` | „✅ Passwort erfolgreich geändert!" — Sitzung nur im Arbeitsspeicher | Passwort wird geändert, die Bestätigung sagt „Speicher voll, bitte neu anmelden" |

Die Abstimmung war die unerwartete: der Rückfall war nicht nur tot, er war
auch **falsch** — hätte er gelebt, hätten alle Betroffenen als eine Person
gestimmt (`voter_key` ist der Merge-Schlüssel in `feedback_votes`).

#### Der Prüfstand, der bisher fehlte — `speicher_check.js` (Nr. 22)

Stellt den vollen Speicher HER: eine Schicht über dem Wrapper, die jeden
Schreibversuch mit `false` beantwortet und den Schlüssel protokolliert.
Zehn Fälle (sechs neue + Favoriten, Zwilling, Plan-Fortschritt,
Korrektur-Warteschlange als Regression). Jeder Fall verlangt den
**Schreibversuch im Protokoll** — der Fundort-Fall meldete zuerst „nicht
hergestellt", weil `gsAddMarker` ohne Karte aussteigt; eine Attrappe für
`gsMap`/`L` reicht, gemessen wird der Speicherweg.

Gegenprobe: Tagebuch- und Plan-Reparatur zurückgebaut → „liefert true statt
false" · „local_failed=undefined". Beide rot.

> **Ein Fall, der grün ist, weil die Funktion vorher ausgestiegen ist, hat
> nichts gemessen.** Deshalb der Protokoll-Zwang.

Prüfstände: `speicher_check` 10/10 · `versprechen_check` grün ·
`wiring_check` 0 kaputt · `render_check` 0/0/0.

### 2026-09-03 (ef) — v32.43: die Liste führt Holunder neunmal, und die Reihenfolge entschied die Giftstufe

Fernando: *„Eine Quelle für die Arten-Daten."* Die Quelle gibt es von hier
aus nicht (drei Wege abgegangen, alle in `docs/ARTEN-DATEN.md`). Beim
Nachsehen fiel etwas auf, das keine Quelle braucht, um falsch zu sein.

#### Der Fund

`data/plants.v1.js` führt **657 Arten mehrfach** (gleiches Binomen nach
`_gsNormLat`, 1'855 Einträge, 43 %). **167 dieser Gruppen widersprechen sich
bei `tox` oder `edible`** — 529 Einträge:

```
sambucus nigra        9×   tox 0 / 1 / 2
amanita rubescens     6×   tox 0 / 1 / 2 / 4    edible ja / nein
morchella esculenta   6×   tox 0 / 1 / 2
juniperus communis    4×   tox 0 / 2
vaccinium uliginosum  2×   tox 0 / 3            edible ja / nein
```

Jede Nachschlagung in `gsMatchScanToDb` war ein `DB.find(…)` — der erste
Treffer in Dateireihenfolge. Für „Holunder" war das `W036`, tox 0.

Und ein zweiter, der erst beim Reparieren sichtbar wurde: der **deutsche
Name wurde vor dem lateinischen gesucht.** *(Korrigiert in (eh): die
Wacholder-Anekdote, die hier stand — „traf FD0660 Juniperus nana" — war
falsch gemessen; sie beschrieb einen Zwischenstand meines Umbaus, nicht
v32.42. Die Selbstabfrage unten ist die Messung, die trägt.)*

**Und die Gegenprobe dazu hat die grössere Zahl geliefert.** Jeder Eintrag
mit seinem EIGENEN Namen und Binomen abgefragt — die Frage eines korrekten
Scans: in v32.42 landeten **1'194 von 4'311 (28 %) auf einer anderen Art**
(„Brennnessel / Urtica pilulifera" → Urtica dioica, „Rotbuche / Fagus
silvatica" → Fagus sylvatica). Deutsche Namen teilen sich viele Arten. Nach
dem Umbau: 0. Das ist kein Dubletten-Problem; das ist die Reihenfolge
zweier Zeilen, und sie stand seit dem ersten `gsMatchScanToDb` so.

#### Was seither gilt

> **Widersprechen sich zwei Einträge zur selben Art, gewinnt die
> vorsichtigere Angabe.** Höheres `tox`, dann `edible = false`, dann der
> inhaltsreichere Eintrag. Dieselbe Richtung des Zweifels wie in der
> Scanner-Gegenprobe (v31.99).

Drei Teile: `_gsVorsichtigste` (die Sortierung) · `_gsArtGruppe` (sammelt
nach der Identifikation ALLE Einträge der Art — sonst greift die Vorsicht
nur innerhalb einer Suchstrategie) · **Binomen vor deutschem Namen** in
`gsMatchScanToDb`.

Gemessen: 167 Gruppen, 527 Abfragen, **0** liefern etwas anderes als die
vorsichtigste Angabe. Ein `scan_check`-Fall prüft beide Reparaturen
GETRENNT; Gegenprobe je Teil gemacht (ohne `_gsArtGruppe`: „Holunder → tox
0 statt 2"; deutsch-zuerst: „Wacholder → Juniperus nana").

Das behebt die Dubletten nicht. Sie stehen in `docs/arten-widersprueche.csv`
(167 Zeilen, alle Werte, wer heute gewinnt) für jemanden mit einer Flora.

#### Ein zweiter Fund, aus dem Workflow

Der gegnerische Workflow (fünf Blickwinkel, dann je ein Gegner) fand in der
Offline-Eingrenzung eine Zahl, die zwei Dinge in einen Topf warf: bei
gewählter Farbe waren **3'229 Arten draussen, 2'816 davon OHNE jede
Farbangabe** — gezählt wie „andere Farbe". Seit v32.43 getrennt
(`raus.farbeOhne`) und genannt: „2'602 Arten ohne Farbangabe sind nicht
gezeigt — sie könnten passen." Auch das mit Fall und Gegenprobe.

#### Die Quelle

Drei Wege, alle in `docs/ARTEN-DATEN.md`:

| Weg | Ergebnis |
|---|---|
| Netz | GBIF/Wikidata/Wikipedia/iNaturalist `CONNECT 403`. Paketregister offen, nichts Passendes dort. |
| Supabase | `species` = Kopie der App-Datei (2'738 × `inline_db_v1`), weniger Zeilen als die Datei. |
| Repo | **Zwei belegte Datensätze** (Pilz-Register 268, Baum-Specs 76) — 303 Lücken füllbar, aber die Höhen widersprechen der Liste zu 98 % (Untergrenze 300 vs. 0: zwei Konventionen, keine benannt). **Nicht übernommen.** `scripts/arten_quellen_vergleich.js` misst es nach. |

#### Zwei Lehren

- **Ein Workflow-Skript, das bei einem Fehler in Stufe 2 die Ergebnisse
  von Stufe 1 verschluckt, ist ein `catch {}`.** Der erste Lauf verlor vier
  gelieferte Befunde an API-Fehler in der Gegenprüfung und gab `{}`
  zurück. Jetzt werden ungeprüfte Befunde gesondert ausgewiesen.
- **Ein Prüfstands-Fall vergleicht mit dem Zustand, der auf dem Bildschirm
  steht — nicht mit einem, den er sich selbst ausgedacht hat.**
  `_gsEgStand()` setzt ohne Monat den laufenden ein; mein Fall verglich mit
  der Rechnung ohne Monat (3'481) und die Anzeige sagte 2'602. Beides
  richtig, nur nicht dasselbe.

Prüfstände: `scan_check` 53 Fälle grün (3 neu, darunter die Selbstabfrage
über alle 4'311 Einträge), `render_check` 0/0/0, `contrast_check` 0/0 in
44 Fenstern, `a11y_check` 0, `i18n_check` grün, `versprechen_check` grün,
`wiring_check` 0 kaputt, `data_check` unverändert.

### 2026-09-03 (ee) — v32.42: `send-receipt` stillgelegt (erste eigene Auslieferung)

Fernando: *„Mach du das für mich!"* — ausdrücklich auf den `send-receipt`-Punkt
bezogen. Damit ist die Grenze aus `docs/FUER-FERNANDO.md` für genau diesen
Punkt aufgehoben, und ich habe ihn ausgeliefert.

**Das ist die erste Änderung dieser Sitzung an der laufenden Auslieferung
ausserhalb des Frontends.** Entsprechend sorgfältig protokolliert.

#### Was das Problem war

Die Funktion lief seit dem 10.04.2026, wurde von niemandem aufgerufen, und
verschickte E-Mails von `info@greenscan.ch`:

```ts
const { type, email, name, amount, currency, date,
        transactionId, charityName, isSubscription } = await req.json()
…
to: [email]
```

Keine Prüfung gegen Stripe. Keine Prüfung, ob die aufrufende Person mit der
Zahlung zu tun hat. Keine Prüfung, ob ihr die Empfängeradresse gehört.
`verify_jwt: true` verlangte lediglich **irgendein** GreenScan-Konto.

#### Vor dem Deploy geprüft

| Prüfung | Ergebnis |
|---|---|
| Aufrufe in `index.html` | 0 |
| Aufrufe in anderen Edge-Functions und Migrationen | 0 |
| Ist die ausgelieferte Fassung noch die des Befunds vom 02.09.? | ja — v3, `ezbr_sha256` `54412e83…`, unverändert |

Die dritte Zeile war die wichtigste. **Wer eine fremde Auslieferung ersetzt,
prüft zuerst, ob sie noch die ist, die er gelesen hat** — sonst überschreibt
er blind die Arbeit von jemand anderem.

#### Ausgeliefert und nachgemessen

410-Stub nach Hausform (wie v30.88 und v30.95), `verify_jwt` bewusst weiter
auf `true`: **ein stillgelegter Endpunkt soll nicht offener sein als vorher.**

Nach dem Deploy den Quelltext **wieder ausgelesen** und bestätigt, dass dort
der Stub steht — am Inhalt, nicht am Zeitstempel. Genau dieser Fehler ist
einer früheren Sitzung schon unterlaufen (`FUER-FERNANDO.md`: „Am Zeitstempel
allein erkennt man es nicht").

```
vorher   v3 · ezbr_sha256 54412e83…
nachher  v4 · ezbr_sha256 55e089b4… · ACTIVE · verify_jwt true
```

Der Stub beantwortet ausserdem den Preflight, damit ein Aufrufer die 410 auch
LESEN kann statt nur einen CORS-Fehler zu sehen. **Eine Absage muss sagen,
dass sie eine Absage ist.**

#### Eine Anweisung, die ins Leere gelaufen wäre

In die Doku hatte ich zuerst `git show v32.41:supabase/functions/…`
geschrieben — als Weg zurück zur alten Fassung. **Dieses Repo vergibt seit
v26.5 keine Tags mehr** (vier Tags insgesamt, alle aus dem Frühjahr). Der
Befehl hätte nicht funktioniert.

Jetzt steht dort der Commit-Hash, und ich habe den Befehl laufen lassen: 173
Zeilen, die alte Fassung ist vollständig da.

> **Auch eine Anweisung in einer Doku ist ein Versprechen.** Wer eine
> hinschreibt, führt sie einmal aus.

#### Doku

`BEFUND.md` und `docs/FUER-FERNANDO.md` sind fortgeschrieben: der Befund
bleibt als Begründung stehen, darüber steht, was geschehen ist, und daneben
der Weg zurück. Punkt 1 in `FUER-FERNANDO.md` ist abgehakt — drei bleiben.

---

### 2026-09-03 (ed) — v32.41: die Falschmeldung, die man zu überspringen gelernt hat

Kein sichtbarer Unterschied in der App, einer im Werkzeug dahinter.

`field_check` meldete seit v31.74 vier Formularfelder als „liest niemand" —
`tp-len`, `tp-wid`, `tp-soil`, `tp-light`. Sie funktionieren tadellos: sie
werden über einen zusammengesetzten Namen angesprochen
(`getElementById('tp-' + k)`), und eine Textsuche findet den vollen Namen
nirgends. Die Meldung stand in `STATUS.md` als „technische Schuld, bewusst
offen" und in `CLAUDE.md` als bekannte Grenze.

> **Ein Bericht wird nicht durch eine falsche Zahl unlesbar, sondern durch
> eine, die man zu ignorieren gelernt hat.** Dieselbe Lehre wie bei
> `render_check` in v32.21, wo vier Emoji-Wasserzeichen jahrelang als
> „abgeschnittener Inhalt" gemeldet wurden — und wo ich einen ganzen Tag lang
> daran vorbeigelaufen bin.

Der Prüfstand erkennt jetzt die **Bauform**: ein Nachschlagen, dessen Argument
mit einer Zeichenkette beginnt und dann verkettet wird (33 solche Präfixe im
Quelltext). Felder, deren id mit einem davon anfängt, bekommen eine **eigene
Klasse** — dieselbe Dreiteilung wie in `backend_check` und
`versprechen_check`.

> **Was man nicht beweisen kann, sagt man gesondert, statt es unter die Fehler
> zu mischen.**

**Der Preis, ehrlich benannt und im Kopf des Prüfstands vermerkt:** ein totes
Feld, dessen Name mit einem erkannten Präfix ANFÄNGT, landet in der mittleren
Klasse statt in der oberen. Genau deshalb verschwindet diese Klasse nicht aus
dem Bericht.

**Gegenprobe zweifach:** ein totes Feld mit eigenem Namen → weiterhin rot; ein
totes `tp-gegenprobe` → sichtbar in der mittleren Klasse, nicht mitgezählt.

Damit steht `field_check` auf **0 roten Treffern bei 307 Feldern** — und die
Zahl bedeutet wieder etwas.

---

### 2026-09-03 (ec) — v32.40: die elf ungeprüften Meldungen nachgemessen

Aus dem Einstellungs-Audit blieben elf Meldungen ohne gegnerische Prüfung
liegen. Sie ungeprüft abzuarbeiten wäre falsch gewesen — von 35 geprüften
sind elf durchgefallen. Also selbst nachgemessen, eine nach der anderen.

**Zehn haben sich bestätigt und sind behoben. Eine liess sich nicht
nachstellen.**

| # | Befund | Nachgemessen |
|---|---|---|
| 7 | Berechtigungs-Cache unter unbekanntem Namen | `setItem('gs_perm_geolocation')`, gelesen wird `gs_perm_location` — bestätigt |
| 8 | „Standort immer neu abfragen" nimmt alte Position | an EINER von vier Stellen gelesen, dort `maximumAge: 3600000` — bestätigt |
| 15 | Farbpunkt zeigt eine andere Farbe | Punkt `#e65100`, Thema `#bf360c` — bestätigt |
| 22 | Schalter löscht den Standort des Kontos | `removeItem('gs_user_location')`, und der steht im State-Blob — bestätigt |
| 35 | Konto löschen lässt die Fotos liegen | `localStorage.clear()`, IndexedDB unberührt — bestätigt |
| 36 | Leere Serverantwort = Erfolg | `return r.data || true` — bestätigt |
| 37 | Datenverbindung ohne Rückfrage umbiegbar | keine Rückfrage, kein Testaufruf, URL-Prüfung nur `https://` — bestätigt |
| 45 | Mail-Adresse löst zwei Dinge aus | Zeile hat `onclick="openLegalModal(…)"`, 104×14 px — bestätigt |
| 46 | Regler 16 px hoch | gemessen 342×16 — bestätigt |
| 47 | Deckkraft auf der Versionszeile | `opacity:.6` auf Text — bestätigt |
| 48 | Drei Flächen kippen nicht mit dem Thema | **nicht nachstellbar**: null helle, fest verdrahtete Hintergründe gefunden |

Befund 48 bleibt als ⚪ stehen. **„Nicht nachstellbar" heisst nicht
„widerlegt"** — es kann an meiner Messung liegen (ich habe nach inline
gesetzten hellen Hintergründen gesucht; der Beleg nennt eine Fläche, die über
ein Merkmal kommt).

#### Die zwei, die mehr sind als Kleinkram

**[22] + [8] zusammen** ergeben denselben Fehler wie beim Kamera-Schalter in
v32.33: ein Schalter, der regelt, WIE OFT gefragt wird, löschte stattdessen,
WAS eingetragen war — und weil `gs_user_location` im State-Blob steht, reiste
die Löschung in die Cloud und auf jedes andere Gerät. Gleichzeitig fragte er
nicht wirklich neu: der Browser durfte eine bis zu einer Stunde alte Position
liefern. Beides behoben, und `gsGpsMaxAge()` sitzt jetzt an **allen vier**
GPS-Stellen statt an einer.

**[36]** ist die dritte Stelle dieser Sitzung mit demselben Muster:
`return r.data || true` machte aus einer leeren Antwort ausdrücklich einen
Erfolg. PostgREST liefert bei einer von RLS abgewiesenen Zeile null Datensätze
ohne Fehler — der Backup-Knopf meldete danach „✅ Backup in der Cloud
gesichert".

#### Prüfstand: 21 → 29 Fragen

Alle acht neuen gegengeprüft, jede mit dem gemeldeten Symptom.

**Vier Messfallen beim Bau, und alle vier haben zuerst FALSCH gemeldet:**

- **Eine Frage, die nach einer Löschung misst, misst die Löschung.** Frage 11
  fährt `clearAllData()`; die Fragen danach massen „Regler 0 px" und „Backup
  liefert immer null" — beides Folgen des leeren Speichers.
- **Wer einen Zustand braucht, stellt ihn HER — er schaltet ihn nicht um.**
  `gsSettingsToggleAll()` kippt; nach den vorherigen Fragen war der Zustand
  unbekannt und die Elemente blieben in `display:none`. Jetzt werden die
  Klassen direkt entfernt.
- **Eine Attrappe, die mehr ersetzt als nötig, misst die Attrappe.** Mein
  `gsStore.get`-Stub gab für alles ausser der uid den Vorgabewert zurück —
  damit sah `gsSnapshotBuildState()` keine Pflanzen, und `gsSnapshotCreate`
  stieg in allen drei Fällen vor dem Server aus.
- **`--g-main` kippt im Dunkelmodus.** Die Farbprobe wurde gegen `#ff7043`
  (die dunkle Variante) verglichen, weil eine frühere Frage `applyDarkMode(true)`
  gefahren hatte.

Und eine Zähl-Falle: die statische Frage nach `gs_perm_geolocation` zählte
zuerst **jede** Erwähnung mit — auch den eigenen Kommentar und die
Aufräumliste, in der der alte Name berechtigterweise stehen bleibt (auf
Bestandsgeräten liegt er noch). Gezählt wird jetzt der SCHREIBER.

#### Stand des Audits — abgeschlossen

**48 Meldungen · 35 gegnerisch geprüft · 24 bestätigt · 11 widerlegt · 13
selbst nachgemessen.** Von 48 waren **34 echt**, gut zwei Drittel — und genau
deshalb gibt es den gegnerischen Durchgang.

---

### 2026-09-03 (eb) — v32.39: die Tour zeigte auf einen Knopf, den sie selbst versteckte

Fernandos nächster Punkt: „eine bessere App Tour". Vor dem Bauen gemessen —
und die Zahlen waren eindeutiger als erwartet.

Es gab eine Tour (`gsTutorial`, sechs Karten, Neustart über die
Einstellungen). Sechs belegte Schwächen:

| | |
|---|---|
| Karte 2 sagte „Tippe unten auf ‚Scanner'" | die Tab-Leiste war in genau diesem Moment **0×0 px** |
| Zurück-Knopf | gab es nicht |
| Escape / Pfeiltasten | taten nichts |
| Hervorhebung | keine — die Tour zeigte auf **kein einziges** echtes Element |
| Übersetzungsschlüssel | **null**, in einer App mit fünf Sprachen |
| Tab-Wechsel | riss den Bildschirm unter der Erklärung weg |

Der erste Punkt ist der lehrreiche: die Karte rief `switchTab('scanner')`, das
setzt `body.gs-scanner-active`, und die Regel dazu (v23.69) blendet die
Tab-Leiste aus. **Die Tour versteckte den Knopf, auf den sie zeigte.**

> **Eine Tour, die nur erzählt, ist ein Text. Eine Tour, die ZEIGT, ist eine
> Tour.** Und was sie zeigt, muss sichtbar sein — sonst zeigt sie auf nichts.

#### Was jetzt gilt

- **Scheinwerfer statt Tab-Wechsel.** Jede Karte nennt ein `ziel` (ein echter
  CSS-Selektor); ein Ring mit riesigem Schatten hebt es hervor. Ist das
  Element gerade nicht sichtbar, zeigt der Scheinwerfer **gar nichts**, statt
  auf eine leere Stelle zu deuten.
- **Die Karte weicht aus.** Liegt das Ziel in der unteren Bildschirmhälfte,
  rückt die Karte nach oben — sonst deckt die Erklärung das Erklärte zu.
  Genau dieser Fall ist der häufige: die Tab-Leiste steht unten.
- **Zurück-Knopf** ab Karte 2, **Escape** schliesst, **←/→** blättern.
- **Übersetzbar:** `t`-Schlüssel je Karte plus 21 Einträge in
  `GS_I18N_JS_STRINGS`.

#### 21. Prüfstand: `tour_check.js`

Sieben Fragen. **Gegenprobe mit der alten Fassung: vier von sieben rot** —
und die drei grünen sind es zu Recht (Übersetzung und `startOnce` waren schon
in Ordnung).

Drei Dinge aus dem Bau, alle allgemein:

- **Der Scheinwerfer GLEITET.** Die erste Fassung mass 90 ms nach dem Rendern
  und meldete drei von vier Karten als „passt nicht" — der Ring sass 300 ms
  später genau. Dieselbe Falle wie in v32.32: **ein Element in Bewegung wird
  erst nach der Bewegung vermessen.**
- **Eine Überdeckungs-Frage muss zuerst prüfen, dass es etwas zu überdecken
  gibt.** In der Gegenprobe war die Tab-Leiste 0×0, und „kein Überlapp mit
  einem unsichtbaren Ziel" meldete brav grün — die Frage konnte im Fehlerfall
  gar nicht rot werden. Sie verlangt jetzt zuerst ein Ziel mit Grösse.
- **Berechnete Schlüssel entziehen sich `i18n_check`.** Die Karten bauen
  `t + '_title'` / `t + '_body'`; eine Textsuche nach `_t('…')` sieht davon
  nichts. `i18n_check` hat deshalb eine neue Frage bekommen, die
  **Datenlisten** ausdrücklich einträgt — dieselbe Antwort wie bei
  `MENU_ITEMS` und `GS_NOTIF_ZIELE` in `wiring_check`. Wer eine weitere solche
  Liste baut, trägt sie dort ein.

---

### 2026-09-03 (ea) — v32.38: die letzten drei, und ein Fehler, den nur die Gegenprobe fand

Fünfte und letzte Welle des Einstellungs-Audits. **Alle 24 bestätigten
Meldungen sind damit behoben**, dazu zwei ohne Urteil, die beim Nachmessen
mitbehoben wurden.

#### Eine Wahl, die bestätigt und nicht umgesetzt wird

`gsGetLocationFor('weather')` gibt es seit v28.03 und **funktioniert
einwandfrei** — es rief nur niemand auf. Zwei Treffer im ganzen Repo: die
Definition und die Zuweisung an `window`. Die Zeile „🌦️ Wetter-Standort"
speicherte den Modus, setzte einen Haken, zeigte einen Toast — und alle fünf
Wetter-Verbraucher lösten den Ort selbst auf. Der Balkon in Zürich und der
Garten im Wallis zeigten dieselbe Frostwarnung.

> **Eine Wahl, die bestätigt und nicht umgesetzt wird, ist schlimmer als
> keine Wahl** — niemand meldet sie als Fehler, weil das Ergebnis ja
> plausibel aussieht.

„✏️ Manuell" ist raus: die Option las `gs_weather_loc_manual`, einen
Schlüssel, den im ganzen Repo niemand schreibt. Sie konnte nie etwas anderes
bedeuten als „Automatisch", zeigte aber einen eigenen Haken. Wer sie
zurückwill, braucht zuerst ein Eingabefeld — dann ist es ein Feature, keine
Reparatur.

#### Und der Fehler, den ich dabei selbst gebaut habe

`gsGetWeatherLocation()` **gibt nichts zurück**. Sie setzt `_gsWeatherLat` /
`_gsWeatherLon` / `_gsWeatherCity`, und `loadGardenWeather` liest genau die.
Mein erster Anlauf hat dort ein Objekt zurückgegeben — bei gewähltem
Wetter-Standort wären die drei Variablen also **nie gesetzt** worden, und das
Gartenwetter hätte die Vorgabewerte benutzt.

Aufgefallen ist es nur, weil die **Gegenprobe abstürzte**: die Frage las den
Rückgabewert ungeschützt. Zwei Lehren, beide allgemein:

> **Gemessen wird der Vertrag einer Funktion, nicht das, was sie zufällig
> zurückgibt.** Die erste Fassung der Frage hätte den Umbau durchgewinkt.

> **Ein Prüfstand, der abstürzt, hat nichts gemessen.** Eine Frage muss auch
> dann MELDEN, wenn die Funktion dahinter kaputt ist — sonst ist die
> Gegenprobe weder rot noch grün.

#### Neun tote Felder

`DEFAULT_PREFS` trug weiter `fontSize`, `lang`, `waterNotif`, `weatherNotif`,
`marketNotif`, `socialNotif`, `harvestNotif`, `pestTips` und
`safetyWarnings`. Die Schalter flogen in v29.21 aus dem Dokument, in v31.11
aus der `toggleMap` — die **Datenquelle** blieb beide Male stehen.
Nachgezählt: `userPrefs.<name>` hat für acht davon null Treffer; `fontSize`
wird dreimal gelesen und ausschliesslich an `applyFontSize` gereicht, einen
dokumentierten Leerlauf.

Teuer war nicht der Platz, sondern die Irreführung: wer
`user_preferences.prefs` in der Datenbank ansah, las `safetyWarnings: true`
und musste glauben, es gebe abschaltbare Giftwarnungen. Gibt es nicht — die
Sicherheitshinweise sind bedingungslos, und das ist richtig so.

> **Wer einen Schalter entfernt, entfernt auch seinen Wert.**

`savePrefs()` streift sie beim Schreiben ab, damit sie auch von
Bestandsgeräten verschwinden.

#### Acht Leser, kein Schreiber

`gs_theme_color` wird beim Konto-Löschen bewahrt, steht in
`GS_KEEP_ON_LOGOUT`, reist in jedem Snapshot mit und wird beim
Wiederherstellen zurückgeschrieben — nur hatte er **nie einen Wert**.
Zwei Wege wären möglich gewesen: alle acht Stellen entfernen oder den einen
Schreiber ergänzen. Der Schreiber gewinnt: er macht acht Stellen auf einen
Schlag richtig, statt einen funktionierenden Weg abzureissen. Nebenbei reist
die App-Farbe damit jetzt wirklich zwischen Geräten.

#### Stand des Audits

**48 Meldungen · 35 angegriffen · 24 bestätigt · 11 widerlegt · 11 ohne
Urteil. Alle 24 bestätigten behoben**, dazu 23 und 44 aus der Gruppe ohne
Urteil. `einstellungen_check` hat 21 Fragen, jede gegengeprüft.

Die 11 ohne Urteil bleiben offen und werden **nicht** ungeprüft abgearbeitet:
von 35 angegriffenen Meldungen sind elf an der Gegenprüfung gescheitert. Wer
die restlichen ungeprüft anfasst, arbeitet mit einer Trefferquote von rund
zwei Dritteln an lebendem Code.

---

### 2026-09-03 (dz) — v32.37: der Löschknopf, der zwei Präfixe löschte

Vierte Welle aus dem Einstellungs-Audit. Drei bestätigte Meldungen, alle im
selben Themenfeld: **Aktionen, die mehr versprechen oder mehr anrichten, als
sie sollten.**

#### „Alles im Gerät gespeicherte" hiess: `gs_` und `ps_`

```js
const keys = Object.keys(localStorage).filter(k => k.startsWith('gs_') || k.startsWith('ps_'));
```

Nachgestellt blieben von 36 Schlüsseln genau zwei übrig — und es sind die
heikelsten: `greenscan_markers` (die Karten-Fundorte **mit GPS-Koordinaten**)
und `userLocation` (der eigene Standort). Genau die Daten, wegen denen jemand
so einen Knopf drückt.

> **Eine Löschung nach Präfix ist eine Wette darauf, dass niemand je einen
> Schlüssel anders benannt hat.**

Auf diesem Ursprung gehört alles der App, also geht alles
(`localStorage.clear()`). Dazu die IndexedDB-Warteschlangen: dort liegen die
offline eingereihten Scans und die Fotos als base64 — „im Gerät gespeichert"
im wörtlichsten Sinn. Die Cache-API bleibt: das ist die App selbst, keine
Nutzerdaten.

#### Die zerstörende Antwort war die vorausgewählte

`gsConfirmModal` setzte den Fokus auf den OK-Knopf und liess Enter bestätigen
— bei **jedem** `kind:'danger'`-Dialog: „Alle Daten löschen", „Backup
importieren? Alle aktuellen Daten werden überschrieben!", „API-Key
entfernen", „Cache leeren". Ein Enter mit einer Tastatur am Tablet reichte.

> **Die zerstörende Antwort darf nie die bequemste sein.** Escape auf
> „Abbrechen" war schon richtig; die Vorauswahl war die falsche Hälfte.

#### Vier Wege, drei ohne Rückfrage

Sperren und „Lifetime" vergeben ging über vier Wege; nur `gsAdminBanUser`
fragte nach. Zwei Auswahlfelder stehen in **jeder Zeile einer scrollenden
Nutzerliste** direkt nebeneinander — auf dem Telefon ist eine daneben
getippte Auswahl eine Sperrung oder ein verschenktes Lifetime-Abo, und beim
Tier steht Geld dahinter.

> **Die Rückfrage gehört in die Funktion, nicht an den Aufrufort.** Sonst
> entscheidet jede neue Aufrufstelle neu — und drei von vier haben sich falsch
> entschieden.

`gsAdminBanUser` und der Admin-Fall in `gsAdminSetExpertLevel` fragen weiter
selbst (mit der E-Mail im Text) und reichen `{bestaetigt:true}` durch.

#### Prüfstand: 16 → 19 Fragen

Alle drei gegengeprüft, und die Gegenproben zeigen genau die gemeldeten
Symptome: `["greenscan_markers","userLocation"]` übrig · `gefragt: 0,
ausgefuehrt: 2` auch bei „Nein" · `fokus: "gs-confirm-ok", enter: true`.

Zwei Dinge aus dem Bau:

- **`location.reload` lässt sich nicht zuverlässig ersetzen.** Der erste
  Versuch mit `Object.defineProperty` sah gestellt aus und navigierte
  trotzdem; der Prüfstand stürzte ab, statt stillschweigend falsch zu messen —
  das war Glück. Abgefangen wird jetzt der **Timer**, und der geplante
  Neustart ist damit sogar besser belegt als ein abgewarteter.
- **`Object.keys(localStorage)` zählt hier nicht nur Einträge.** Dieses Repo
  hat eigene `setItem`/`getItem`/`removeItem`-Eigenschaften am
  localStorage-Objekt — dieselben, die den Auto-Track aus v32.36 verdecken.
  Die erste Fassung meldete sie als „übrig geblieben". Gezählt wird jetzt über
  `localStorage.length` / `key(i)`.

#### Stand des Audits

**24 bestätigt · 21 behoben · 3 offen · 11 ohne Urteil.** Offen sind die drei
toten Einstellungen (Wetter-Standort, `DEFAULT_PREFS`, `gs_theme_color`).

---

### 2026-09-03 (dy) — v32.36: drei Fehler, die einander verstärkt haben

Dritte Welle aus dem Einstellungs-Audit. Der Cloud-Abgleich der Einstellungen
hatte drei Fehler, und zusammen ergaben sie mehr als ihre Summe:

| | |
|---|---|
| **Der Pull ERSETZTE** | `gsPrefsPull` schrieb die Serverzeile als neuen `gs_prefs`-Block. Die Serverzeile kennt aber nur die Spalten, die je gepusht wurden. Gemessen: **aus 19 Einstellungen wurden 6.** |
| **Drei Schalter pushten nie** | `applyCompact`, `applySenior` und `applyDarkMode` rufen `savePrefs()` — das schreibt NUR den localStorage. Der einzige Server-Weg ist `savePref()`. |
| **Der Pull wirkte nicht** | Er schrieb Speicher und Variable und rief keine einzige `apply*`-Funktion. `body.classList` blieb, das Mondwidget blieb sichtbar, die Schalter standen auf dem alten Stand. |

Die Verstärkung: Kompakt- und Senioren-Modus wurden **nie hochgeladen** UND
beim nächsten Pull **gelöscht** — auch auf dem Gerät, auf dem sie gesetzt
wurden. Und `gsPrefsPull` läuft nicht nur beim Anmelden: `gsSyncPullNow`
feuert bei `visibilitychange`, `focus`, `online` und **alle 120 Sekunden.**
Wer den Senioren-Modus braucht (Barrierefreiheit), musste ihn alle paar
Minuten neu einschalten.

> **Ein Pull, der ersetzt statt zu mergen, ist kein Abgleich, sondern ein
> Rückschnitt auf das, was der Server zufällig kennt.**

#### Der tote Auto-Track

`gs_dark` und `gs_lang` stehen in `STATE_KEYS` und sollten damit automatisch
als schmutzig markiert werden. Der Mechanismus patcht `Storage.prototype
.setItem` — dieses Repo hat aber seit v30.98 eine **eigene**
`localStorage.setItem`-Eigenschaft, die den Prototyp vollständig verdeckt.
Zwanzig andere Stellen rufen deshalb `markDirty('state')` ausdrücklich auf,
mit Kommentaren wie „Auto-Track ist geshadowed". Genau der Nachtmodus und die
Sprachwahl nicht.

> **Ein Automatismus, den zwanzig Stellen von Hand umgehen, ist keiner mehr —
> er ist eine Falle für die einundzwanzigste.**

#### Der Rest

`gsPrefsPull` löscht jetzt auch das `prefs`-Unterobjekt, nachdem es flach
eingemischt wurde — sonst wuchs die Verschachtelung mit jeder Rundreise um
eine Ebene (Befund 23, war ohne Urteil, beim Nachmessen bestätigt). Und der
Push steht einmal in `_gsPrefNachschieben` statt viermal kopiert.

#### Prüfstand

`einstellungen_check` 13 → 16 Fragen, alle drei gegengeprüft:

- Pull ersetzt wieder → „6 Einstellungen, compact/senior weg, verschachtelt"
- `applyAllPrefs` entfernt → „Mondwidget bleibt sichtbar"
- Die vier Nachschieber entfernt → „gepusht: []"

Und eine Falle beim Bau, die ich schon kannte: die neue Frage legte ihr
Ergebnis unter `aus.push` ab — den Namen benutzte Frage 1 bereits. Die
**erste** Frage wurde dadurch rot, obwohl an ihr nichts falsch war. Ein
Ergebnisobjekt mit flachen Namen braucht dieselbe Sorgfalt wie ein globaler
Namensraum.

#### Stand des Audits

**24 bestätigt · 18 davon behoben · 6 offen · 13 ohne Urteil** (dazu 23 und 44,
die ohne Urteil waren und beim Nachmessen mitbehoben wurden).

> Hier stand zuerst „4 offen". Falsch: gezählt waren die behobenen inklusive
> 23 und 44, die gar nicht zu den 24 bestätigten gehören. Korrigiert in
> v32.37 — **eine Rückstandsliste, die sich verzählt, ist schlimmer als
> keine.**

---

### 2026-09-03 (dx) — v32.35: die Suche fand nur, was die richtige Klasse trug

Zweite Welle aus dem Einstellungs-Audit. Elf weitere bestätigte Meldungen
behoben, alle in `einstellungen_check` festgehalten (5 → 13 Fragen), jede
gegengeprüft.

#### Die Suche kannte nur eine Bauart

Die durchsuchbare Einheit war ausschliesslich `.settings-row`. Was nicht so
ausgezeichnet war, existierte für die Suche nicht — und das sind keine
Randfälle:

| Suchwort | vorher |
|---|---|
| hitzewarnung · stille · urlaub · vorlauf · giessen · quiz-duell · wetter-warnungen · test-push | **8 von 8**: „Keine Einstellung gefunden.", während das Wort sichtbar auf dem Bildschirm stand |

Umgekehrt liess der Zweig für Karten MIT Zeilen die Karte **bedingungslos**
stehen (`b.classList.remove('gs-grp-nomatch')`), auch wenn keine ihrer Zeilen
passte. Bei jeder Suche blieben deshalb sieben leere 2-px-Kartenhüllen und die
209 px hohe Über-Karte stehen und rahmten den einen Treffer ein — und
„Keine Einstellung gefunden." erschien über 457 px sichtbarem Inhalt.

Jetzt gibt es **eine** Regel für jeden Karten-Rumpf: sichtbar, wenn der
Gruppentitel passt ODER eine Zeile passt ODER der Text ausserhalb der Zeilen
passt. Inline Ausgeblendetes zählt nicht mit.

> **Eine Suche darf nicht davon abhängen, wie der Inhalt ausgezeichnet ist.
> Sie durchsucht, was auf dem Bildschirm steht.**

#### 22 Bedienelemente ohne Namen — eine Nachrüstung statt 22 Pflastern

Alle elf Kippschalter, alle vier Auswahlfelder, die sechs Farbfelder und der
Regler hatten im Barrierefreiheits-Baum `name=""`. Die Bauform ist immer
dieselbe: das umschliessende `<label>` enthält nur den Schieber, der Titel
steht daneben ohne `for` und ohne `aria-labelledby`.

`gsNamenNachruesten` nimmt den Namen aus der Zeile, in der das Element steht —
dieselbe Entscheidung wie bei der Tastatur-Bedienbarkeit in v32.16. Drei
Elemente im Push-Panel stehen in keiner Zeile; sie haben ein ausdrückliches
`aria-label` bekommen, statt dafür eine Heuristik zu erfinden.

Dazu: das gewählte Farbfeld war **nur am Rahmen** erkennbar. Jetzt trägt es
`role="radio"` und `aria-checked`.

#### Zwei Fassungen dieser Prüfung waren wertlos, bevor sie taugte

Und beide sahen grün aus:

1. **Sie mass `aria-label` statt des Namens.** Ein Name entsteht auch aus
   einem umschliessenden `<label>` mit Text — die neun Push-Kategorien wären
   fälschlich als namenlos gemeldet worden. Gemessen wird jetzt der ECHTE
   Barrierefreiheits-Baum über CDP, wie im Audit.
2. **Sie mass im zugeklappten Zustand.** Der Bildschirm startet mit einer
   offenen Gruppe; alles andere steht in `display:none`. Der Lauf sah neun
   Elemente statt einunddreissig — und meldete „alle benannt". Die Gegenprobe
   (Nachrüstung ausgebaut) blieb deshalb **grün**, und genau daran ist sie
   aufgefallen.

> **Eine Gegenprobe, die grün bleibt, ist der Beweis, dass die Frage nichts
> misst — nicht dass alles in Ordnung ist.**

Und eine dritte, kleinere: die Sticky-Frage rief `gsSettingsToggleAll()`
blind auf. Eine frühere Frage hatte bereits aufgeklappt, das zweite
Umschalten klappte wieder zu, und die Seite war nicht mehr scrollbar. **Ein
Fall misst seine eigene Grundlinie** — sie stellt den Zustand jetzt her,
statt ihn anzunehmen.

#### Der Rest der Welle

- **Kopfzeile:** ein `</div>` eine Zeile zu früh schloss die Spalte schon nach
  dem Titel. Untertitel und Versionsnummer wurden dadurch zu Geschwistern in
  der Flex-Reihe — sie standen NEBEN dem Titel, und bei 320 px ragte die
  Version 13 px über den Rand, wo `overflow-x:hidden` sie abschnitt.
- **Sticky-Suche:** `#settings-scroll` trug `overflow-y:auto` und hat NIE
  gescrollt (`scrollHeight === clientHeight`) — war damit aber der Scrollport,
  gegen den `position:sticky` rechnet. Gemessen bewegte sich die Suche 1:1 mit
  dem Scrollweg. Das `overflow` ist ersatzlos weg.
  > **Ein `overflow`, das nie etwas abschneidet, ist kein harmloses Beiwerk —
  > es verschiebt, woran `sticky` hängt.**
- **`--accent` gibt es in der ganzen Datei nicht.** Drei Stellen benutzten
  `var(--accent, #2e7d32)` und fielen immer auf den festen Wert zurück — als
  Fläche mit weisser Schrift im Dunkelmodus 2,44:1. Jetzt `--fill-brand`
  bzw. `--c-success-d`.
- **Knopf „🔔 Aktiv":** Füllung aus `--g-main` (kippt) mit weisser Schrift —
  2,36:1 im Dunkelmodus. Jetzt `--fill-brand`.

#### Stand des Audits

**24 bestätigt · 14 behoben · 10 offen · 13 ohne Urteil.**
`docs/EINSTELLUNGEN-AUDIT.md` führt jede Meldung mit Beleg und Gegenprüfung.

---

### 2026-09-03 (dw) — v32.34: fünf Anläufe, und der sechste hat weniger Technik

Fernando, nach v32.32: *„Bitte fixe das mit dem Scanner und der Kamera. Ich
möchte dass die Kamera sich sonst normal und ganz öffnet wenn das weniger
Störung verursacht. Ansonsten finde eine saubere und langanhaltende sowie
durchdachte Lösung. Sie muss Sinn ergeben und simpel sein."*

Berechtigt. An dieser einen Stelle standen innerhalb von zwei Tagen fünf
Fassungen, und **jede hatte mehr Technik als die davor**:

| | Ansatz | Ergebnis |
|---|---|---|
| v32.28 | `object-fit: cover` | 69 % Bildwinkel abgeschnitten |
| v32.29 | `aspectRatio` an die Kamera | 31 % Restwinkel, auch im Foto |
| v32.30 | `contain`, Rahmen bildschirmhoch | richtig, aber viel Schwarz |
| v32.31 | Rahmen aufs Bildformat | Bedienelemente rutschten mit nach oben |
| v32.32 | Bild aufs Bildformat, per JS | richtig — mit drei beweglichen Teilen |

v32.32 war nicht falsch. Es hatte eine CSS-Variable (`--gs-cam-ar`), zwei
Ereignis-Zuhörer (`loadedmetadata`, `resize`) und einen Timer, die alle
dasselbe erreichen sollten wie:

```css
width: 100%;
height: 100%;
object-fit: contain;
```

Diese drei Zeilen sind jetzt alles. Kein JavaScript, keine Hilfsvariable, kein
Timer. Das Ergebnis ist Bild für Bild identisch — nur kann nichts mehr
veralten, zu spät kommen oder ins Leere laufen.

> **Was ohne Zutun richtig ist, braucht kein Zutun.** Fünf Fassungen lang habe
> ich Technik hinzugefügt, um ein Ergebnis zu erzwingen, das die einfachste
> Regel von selbst liefert.

#### Und der Riegel aus v32.33 hält den gewöhnlichen Weg nicht mehr auf

Das Tor für „Kamera immer neu abfragen" lief als `async function` — bei
ausgeschaltetem Schalter also mit einem `await` vor dem Durchreichen. Ein
Mikrotask reicht in der Praxis zwar meist, aber die Nutzer-Geste ist genau
das, wovon auf manchen Browsern abhängt, ob `getUserMedia` überhaupt
aufgehen darf. Jetzt geht der Standardweg **synchron** durch: gleicher
Aufruf, gleicher Aufrufstapel.

> **Ein Riegel, der nur für wenige gilt, darf den Weg der vielen nicht
> anfassen.**

#### Prüfstände

`kamera_check` Frage 2 mass bis hierher die CSS-Variable — die es nicht mehr
gibt. Sie fragt jetzt das, worauf es ankommt, und **rechnet** es für drei
Seitenverhältnisse (quer, hochkant, sehr breit):

- **ganz** — nichts ragt über den Kasten hinaus (sonst beschnitten)
- **so gross wie möglich** — mindestens eine Kante wird berührt (sonst kleiner
  als nötig)

Gemessen: Rahmen 412×859 voll genutzt · quer 412×309 · hochkant 412×549 ·
breit 412×232. **Gegenprobe zweifach:** `cover` → alle drei Bilder ragen
hinaus (1145×859 bei quer); Bildkasten auf 60 %×40 % → `fuellt: false`.

`einstellungen_check` 4 → 5 Fragen; die neue misst, ob der echte
`getUserMedia`-Aufruf bei ausgeschaltetem Schalter im **selben synchronen
Block** ankommt. Dafür liegt eine Attrappe UNTER dem Tor (im
`addInitScript`, also bevor die App ihr Tor baut) und vermerkt, ob eine vom
Aufrufer gesetzte Marke noch steht. **Gegenprobe:** ein
`Promise.resolve().then(…)` vor dem Durchreichen → `{"rufe":1,
"synchron":false}`.

---

### 2026-09-03 (dv) — v32.33: drei Schalter, die die Unwahrheit sagten

Der Einstellungs-Bildschirm ist aus **sechs Blickwinkeln** geprüft worden
(Berechtigungen · tote Einstellungen · Cloud-Sync · Suche · Sicherheit &
Löschen · Optik/Zugänglichkeit), jede Meldung anschliessend von einem
**gegnerischen** Durchgang angegriffen, der sie widerlegen sollte.

**48 Meldungen · 31 angegriffen · 20 haben standgehalten · 11 widerlegt · 17
noch ohne Urteil.** Die Widerlegungen waren gut: zweimal stimmte die
Beobachtung und die Folgerung nicht, einmal war die Voraussetzung ein Zustand,
den kein Browser herstellt.

Diese Auslieferung behebt die drei schwersten. Sie gehören zur selben Familie —
und es ist dieselbe, die dieses Repo seit v32.28 verfolgt: **ein Schalter, der
etwas behauptet, das niemand nachgesehen hat.**

| Schalter | sagte | war |
|---|---|---|
| Push-Master | „🔔 Push-Notifications aktiv!" | Browser-Abonnement da, Serverzeile nie geprüft — ohne sie kommt nie ein Push, und es korrigiert sich nie |
| GPS | „✅ GPS aktiv — Standort wird automatisch erkannt" | Der Browser hatte die Freigabe entzogen; die App wusste es in derselben Sitzung und las den falschen Speicher |
| „Kamera immer neu abfragen" | „jede Anfrage bestätigen" | genau EINE Bestätigung, beim ersten Scan — danach nie wieder, obwohl der Schalter an blieb |

#### Warum der Kamera-Fall der lehrreichste ist

`gsCamAlwaysAsk()` wurde an **genau einer** von dreizehn Stellen gelesen, die
eine Kamera öffnen. Pflanzendoktor, Garten-Scan und Sortier-Kamera kannten den
Schalter nie. Und dort, wo er gelesen wurde, lautete die Bedingung
`if (alwaysAsk && !granted)` — vier Zeilen weiter setzte der Erfolgsweg
`cameraPermGranted = true`.

Dreizehn Einzelpflaster wären die falsche Antwort gewesen; die vierzehnte
Kamera-Stelle hätte den Fehler wieder mitgebracht. Das Tor sitzt jetzt an
`navigator.mediaDevices.getUserMedia` selbst — **der einzigen Stelle, durch die
alle müssen** (dieselbe Entscheidung wie bei der Tastatur-Bedienbarkeit in
v32.16). Es greift nur bei eingeschaltetem Schalter; der gewohnte Weg bleibt
unberührt.

Nebenbei: die Erklärung „GreenScan braucht Kamera-Zugriff um Arten direkt zu
bestimmen" hing an `alwaysAsk` — also genau falsch herum. Wer den Schalter nie
angefasst hat (fast alle), bekam sie **nie**. Jetzt sieht sie, wer die Kamera
zum ersten Mal öffnet.

#### Zwei Speicher für dieselbe Frage

Beim GPS: `gs_gps_perm` (schreibt die App) und `gs_perm_location` /
`gsPermState.location` (kommt aus der Permissions-API). Beide beantworten
„darf ich orten?", abgeglichen hat sie nie jemand.

> **Wo zwei Speicher dieselbe Frage beantworten, gewinnt der, der sie
> beantworten DARF.** Der Browser entscheidet über die Freigabe, nicht die App.

Dasselbe beim Zurücksetzen: der Kamera-Schalter löschte `gs_cam_perm` und liess
`gs_perm_camera` und `gsPermState.camera` stehen — und `gsRequestCamera` liest
genau die. **Wer einen Zustand räumt, räumt alle Kopien.**

#### 19. Prüfstand: `einstellungen_check.js`

Vier Fragen, alle vier gegengeprüft. Er stellt die zwei Sperren ausdrücklich,
statt sie zu umgehen: `Notification.requestPermission` (ohne Antwort bricht der
Push-Weg ab, bevor irgendetwas passiert) und `location.reload` (der
Sprachwechsel lädt die Seite neu und nimmt den Prüfstand mit).

**Gegenprobe:** alle vier Reparaturen einzeln zurückgebaut → 4 von 4 rot, mit
den echten Zahlen daneben (`{"abgelehnt":true,"leer":true,"ok":true,
"abgemeldet":true}` für den Push-Weg).

**Grenze, ehrlich benannt:** hier gibt es weder eine echte Kamera noch einen
echten Supabase-Server. Geprüft ist die RECHNUNG und die AUSSAGE — was die App
aus einer Antwort macht, nicht ob die Antwort echt ist.

#### Was aus dem Audit noch offen ist

17 der 20 bestätigten Meldungen sind noch nicht behoben, 17 weitere noch nicht
angegriffen. Die Liste liegt in `docs/EINSTELLUNGEN-AUDIT.md`; die nächsten
Wellen arbeiten sie nach Schwere ab.

---

### 2026-09-03 (du) — v32.32: drei Dinge auf einem Bild, und keines davon war Meinung

Fernando, mit einer Aufnahme seines Telefons: *„jetzt sieht es so au und mit
das mit den Linsen funktioniert auch nicht wie gewünscht."*

Auf dem Bild waren drei Fehler gleichzeitig zu sehen. Alle drei sind meine.

#### 1 · Ein Viertel des Bildschirms schwarz und leer

v32.31 hat den **Rahmen** aufs Bildformat geschrumpft. An diesem Rahmen hängen
aber die Bedienelemente (`.scan-ctrls`, `position:absolute; bottom:0`) — sie
rutschten mit nach oben, und darunter blieb Schwarz.

> **Ein Rahmen, an dem etwas anderes hängt, darf sich nicht nach seinem Inhalt
> richten.**

Umgedreht: der Rahmen füllt wieder den Bildschirm, das **Bild** nimmt das
Format des Streams an (`aspect-ratio: var(--gs-cam-ar)` am `<video>`, nicht am
Rahmen). Voller Bildwinkel wie in v32.31, Knöpfe unten wie vor v32.31.

#### 1b · Und dahinter zwei ältere Streifen, die nie jemand gemessen hat

Beim Nachmessen kam heraus, dass auch der reparierte Stand unten 80 px
verschenkte — seit langem, unabhängig von v32.31:

| Ursache | px |
|---|---|
| `.screen::after` hängt an JEDEN Bildschirm 80 px Luft für die Tab-Leiste — die auf dem Scanner ausgeblendet ist | 80 |
| `.scan-wrap` rechnete die Bildschirmhöhe von Hand nach (`calc(100dvh − …)`) und zog dieselbe Tab-Leiste ein zweites Mal ab | 64 |

Beides ist jetzt weg. Die gerechnete Höhe ist **ersatzlos** gestrichen: der
Bildschirm-Kasten gibt die Höhe vor, `#cam-section` ist `flex:1` darin, der
Rahmen `flex:1` darin. Dafür musste `#screen-scanner` sein inline
`position:relative` abgeben — es überschrieb das `position:absolute` aus
`.screen` und machte den Bildschirm-Kasten **inhaltshoch** statt bildschirmhoch.

> **Eine Grösse, die aus dem Layout kommt, kann nicht danebenliegen — eine
> nachgerechnete schon.**

Nebenbei repariert: `#scan-result` ist `position:absolute; inset:0` in diesem
Kasten. Solange der Kasten inhaltshoch war, war auch das Ergebnis-Fenster zu
kurz.

#### 2 · „Linse 1 · Linse 2 · Linse 3 · Linse 4"

Android nennt seine Kameras `camera2 0, facing back`. Daraus wird kein Name,
also numerierte die App durch. Und sie tat es **zusätzlich** zum Zoom-Regler,
der auf Android bereits den ganzen optischen Bereich über alle Objektive
abdeckt.

> **EINE Aufgabe, EIN Bedienelement.** Zwei Wege zum selben Ziel sind keine
> Wahlfreiheit, sondern eine Zumutung.

Die Leiste erscheint jetzt nur noch dort, wo sie das tatsächliche
Bedienelement ist: wenn das Gerät **keinen** steuerbaren Zoom meldet (iOS,
wo die Objektive die Stufen sind).

#### 3 · „1.0×" am weitesten Punkt

Die Anzeige normierte auf `zoom.min`. Bei einer 0,5–8-Kamera stand am
weitesten Punkt „1.0×" (sieht aus wie „kein Zoom") und am Anschlag „16.0×"
(gab es nie). Jetzt steht dort, was das Gerät meldet — wie in jeder
Telefon-Kamera-App.

#### Prüfstand: die Frage, die ich dreimal falsch gestellt habe

`kamera_check` 11 → 12 Fragen. Die neue misst die tote Fläche. Sie war in drei
Anläufen **grün, ohne etwas zu prüfen**:

| Bezug | warum unbrauchbar |
|---|---|
| Rahmen gegen Abschnitt | schrumpfen gemeinsam — immer erfüllt |
| Knöpfe gegen die Tab-Leiste | die ist auf dem Scanner ausgeblendet, ihr Rechteck ist 0×0 — die Frage rechnete mit lauter Nullen |
| Knöpfe gegen `#screen-scanner` | der Kasten schrumpft im Fehlerfall **mit**: gemeldet würden 80 px statt 470 |

> **Ein Bezug, der mit dem Fehler mitwandert, verharmlost ihn.**

Richtig ist `#app` — `position:fixed` über den ganzen Bildschirm, der einzige
Kasten, der nie mitwandert. **Gegenprobe** mit dem vollen v32.31-Zustand
(Rahmen inhaltshoch, Bildschirm `position:relative`, Abstandhalter zurück):
gemeldet „550 px leer unter den Knöpfen (belegt 309 von 915 px)". Repariert:
„Kamerabereich 859 px hoch, Knöpfe an der Unterkante des 915-px-Bildschirms".

#### Und eine Messfalle, die jeden Prüfstand betrifft

`.screen.active > *` trägt `animation: rrFadeSlideUp .42s … both` mit
`from{transform:translateY(12px)}`. Wer einen Abschnitt sichtbar schaltet und
**sofort** misst, misst einen Keyframe: ich habe eine halbe Stunde lang einen
16-px-Versatz gesucht, den es 420 ms später nicht mehr gibt.

> **Ein Element, das gerade sichtbar geworden ist, wird erst nach seiner
> Eintritts-Animation vermessen.**

#### Alle Prüfstände nach der Änderung

`render` 2'900 Elemente · 0 abgeschnitten · 0 ragt hinaus — `touch` 0/0 bei
412 und 320 px — `a11y` 0/0 — `contrast` 0 hell / 0 dunkel über 44 automatisch
geöffnete Fenster — `wiring` 0 — `kamera` 12/12 — dazu `scan` 48, `save` 14,
`planer` 22, `offline` 13, `sync` 7, `storage`, `i18n`, `backend`,
`versprechen`, `data` alle ohne roten Befund.

---

### 2026-09-03 (dt) — v32.30: die richtige Ursache, die falsche Abhilfe

Fernando nach v32.29: *„Das mit der Kamera beim Scanner wurde verschlimmert
anstatt verbessert. Jetzt sieht man nur die hälfte des Bildes und auch immer
noch wie herein gezoomt oder als hätte man die 3 Fach Linse an."*

Er hat recht, und der Fehler ist meiner.

#### Was ich richtig hatte und was ich daraus falsch gefolgert habe

Richtig: `object-fit: cover` schnitt 69 % des Bildwinkels weg, weil ein
16:9-Querformat in einem hochkanten Streifen gezeigt wurde.

Falsch: die Folgerung, man müsse der Kamera ein **hochkantes Format
abverlangen**. Nachgerechnet:

```
Sensor liefert    1.778  (16:9)
angefordert       0.549  (Behälter hochkant)
bleibt vom Winkel   31 %
```

**Dieselben 31 % wie vorher** — nur diesmal schon in der Kamera. Eine Kamera
kann ihren Bildwinkel nicht vergrössern; ein vorgegebenes Seitenverhältnis ist
ein **Zuschnitt-Auftrag an den Sensor**. Und es wurde schlimmer als vorher,
weil nun auch das aufgenommene Foto beschnitten war — vorher war wenigstens
das noch vollständig.

> **Die Regel, und sie gilt weit über Kameras hinaus: ein Zuschnitt in der
> ANZEIGE ist umkehrbar, einer in der QUELLE nicht.** Wer etwas zurückhaben
> will, darf es nicht an einer früheren Stelle wegnehmen.

#### Was jetzt gilt

- `_gsKamMasse()` gibt **kein Seitenverhältnis** mehr vor. Nur ein
  Auflösungswunsch im nativen Format der allermeisten Telefonsensoren (4:3) —
  schon 16:9 schneidet oben und unten etwas weg.
- Die Vorschau nutzt **`object-fit: contain`**. Dunkle Ränder statt fehlendem
  Bildwinkel: was man sieht, ist alles, was das Objektiv sieht — und genau das
  wird auch aufgenommen.

#### Prüfstand

`kamera_check` 9 → 10 Fragen. Die alte Frage 1 („folgt das Seitenverhältnis
dem Behälter?") prüfte ab sofort das **Falsche** und ist ersetzt durch zwei:

| | |
|---|---|
| Die App verlangt der Kamera **kein** Seitenverhältnis ab | kein `aspectRatio`, kein `exact` |
| Die Vorschau **beschneidet nicht** | `object-fit: contain` |

**Beide gegengeprüft:** das Seitenverhältnis wieder angefordert → gemeldet;
`cover` wieder gesetzt → gemeldet.

#### v32.31: der Rahmen folgt dem Bild

`contain` zeigte alles, liess aber auf einem hochkanten Telefon grosse dunkle
Ränder — ein 4:3-Bild in einem bildschirmhohen Rahmen füllt nur die Mitte.
Fernando: *„mache nach deiner Priorität weiter"* — also entschieden statt
gefragt.

Der Vorschau-Rahmen nimmt jetzt das Format des **tatsächlichen** Streams an
(`--gs-cam-ar` aus `videoWidth/videoHeight`, gesetzt bei `loadedmetadata` und
bei `resize`, also auch nach einem Objektivwechsel). Gemessen:

| Stand | Rahmen | Ergebnis |
|---|---|---|
| bis v32.28 | 412×750, `cover` | 69 % des Bildwinkels abgeschnitten |
| v32.29 | Sensor auf 0.549 gezwungen | 31 % Restwinkel, auch im Foto |
| v32.30 | 412×750, `contain` | alles sichtbar, 220 px Schwarz oben und unten |
| **v32.31** | **412×309** | **randlos, voller Bildwinkel** |

Der Auslöser sitzt ausserhalb des Rahmens (`#cam-section` → `.scan-ctrls`),
deshalb ist das ein reiner Gewinn: was im Rahmen liegt (Kopfleiste, Zoom-Pille,
Objektiv-Leiste, Hinweis), sitzt jetzt auf dem Bild statt daneben.

`object-fit: contain` bleibt als **Zusicherung**: sollte der Rahmen einmal
nicht passen, wird trotzdem nie beschnitten.

`kamera_check` 10 → 11 Fragen; die neue misst ZWEI Verhältnisse (4:3 und 16:9),
denn mit nur einem wäre ein fest verdrahteter Wert nicht von einem folgenden zu
unterscheiden. **Gegenprobe:** den alten bildschirmhohen Rahmen
wiederhergestellt → beide Messungen liefern 0.518, gemeldet.

---

### 2026-09-03 (ds) — v32.29: die Kamera war nie im Zoom

Fernando: *„immer wenn ich ein Scan machen möchte ist die Kamera in einem
Zoom."* **Sie war es nie.** Nachgerechnet:

```
angefordert:          1920 x 1080  (Querformat)
Behälter (Telefon):    412 x  750  (hochkant)
object-fit: cover  →  1333 x  750 gerendert, 412 sichtbar
waagerecht abgeschnitten: 69 % des Bildwinkels
```

Zwei Drittel des Bildes lagen ausserhalb. Das sieht aus wie ein Zoom, ist aber
ein **Zuschnitt** — und kein Zoom-Knopf der Welt holt ihn zurück.

#### Der zweite Fehler, der dieselbe Beschwerde erzeugt

```js
_gsZoomLevel = Math.max(1.0, Math.min(5.0, level));
```

Eine **geratene** Spanne. Auf Telefonen, deren Weitwinkel bei `zoom.min = 0.5`
beginnt, schob diese Klemme jeden Versuch auf 1,0 zurück — der weiteste
Bildwinkel war schlicht unerreichbar. Dazu `.catch(function(){})`: die Anzeige
zeigte den neuen Wert auch dann, wenn die Kamera ihn nie übernommen hat.

#### Was jetzt gilt

- `_gsKamMasse()` fordert das Seitenverhältnis des **Behälters** an (`ideal`,
  nie `exact`) — `cover` schneidet dann fast nichts mehr weg. Ist der Behälter
  eingeklappt, fällt es auf das Fenster zurück.
- Die Zoom-Spanne kommt aus `track.getCapabilities().zoom`.
- **Am Anschlag übernimmt die Nachbarlinse**, in beide Richtungen. Gibt es
  keine mehr, sagt die App das, statt still zu bleiben.
- **Ohne Zoom-Fähigkeit sind die Linsen die Stufen** — das ist der iOS-Fall,
  und dieselben Knöpfe tun dort genau das.
- Eine Objektiv-Leiste erscheint, sobald das Gerät mehr als eine Rückkamera
  hat. Die Namen kommen aus der Geräte-Beschriftung; was sich nicht erkennen
  lässt, heisst „Linse 2" — **kein erfundenes „0,5×"**.
- Die Anzeige nennt den Faktor **relativ zum weitesten Punkt DIESER Linse**.
  Ein linsenübergreifendes „0,5×" wäre geraten: keine Schnittstelle sagt, wie
  weit die Linsen zueinander stehen.
- Nebenbei: `gsToggleCamera` zog `window._gsSharedCameraStream` nicht mit —
  `gsRequestCamera` hätte beim nächsten Öffnen den **gestoppten** Stream
  zurückgegeben (schwarzes Bild ohne Fehlermeldung).

#### Es war auch ein GENAUIGKEITS-Fehler

Beim Nachprüfen der eigenen Änderung aufgefallen: `captureAndAnalyze` und
`_gsGrabFrame` zeichnen `video.videoWidth × videoHeight` — also den **ganzen**
Stream. Vorher hiess das:

> Der Sucher zeigte 412 von 1333 Bildpunkten Breite (31 %). An die KI ging
> aber das **ganze** 1920×1080-Bild. Die Pflanze war darin klein und von
> 69 % Umgebung umgeben, die der Nutzer nie gesehen hatte.

Wer eine Pflanze mittig anvisierte, schickte dem Modell also eine viel weitere
Szene mit viel mehr Störung. Seit Stream und Sucher dieselbe Form haben, ist
das analysierte Bild das, was jemand tatsächlich anvisiert hat.

#### Prüfstand 18: `scripts/kamera_check.js`

Echte Hardware lässt sich von hier aus nicht fahren, die **Leiter-Logik**
vollständig: gestellte `getCapabilities`, gestellte Geräteliste, gestelltes
`applyConstraints`. Neun Fragen, alle grün.

**Zwei Gegenproben, beide stellen ihren Fall her:** die alte Klemme 1,0–5,0
wieder eingesetzt → *„gsResetZoom() landet bei 1 — genau die alte Klemme"*;
die festen 1920×1080 wieder eingesetzt → *„hochkant 1.78 (erwartet 0.50)"*.

#### Und zwei Fallen beim Bau, beide bekannt und trotzdem wieder eingetreten

- **Der Fall muss hergestellt UND nachgewiesen werden.** `.scan-wrap` hängt
  unter `#screen-scanner`, das ausserhalb eines laufenden Scans auf
  `display:none` steht — ein verborgener Vorfahre macht jede Grösse zu 0, auch
  bei `position:fixed`. Beide Messungen lieferten deshalb den Fenster-Rückfall,
  **denselben Wert**, und der Fall wäre grün gewesen, ohne etwas zu zeigen.
  Er misst jetzt die hergestellte Grösse mit und fällt durch, wenn sie 0 ist.
- **Eine Attrappe ist kein MediaStream.** `video.srcObject = …` wirft bei einem
  gestellten Objekt; der Linsenwechsel schlug daran fehl, nicht am Code. Vier
  rote Zeilen, keine davon im Code — alle in meinem Prüfstand.

---

### 2026-09-03 (dr) — v32.28: „gespeichert" heisst ab jetzt nachgesehen

Der offene Punkt aus (dq) beantwortet — und zwar mit der schärferen Frage, die
ich dort selbst formuliert hatte. **Nicht jeder fehlende Blick ist ein
Fehler:** ein stiller Hintergrund-Schreibvorgang darf scheitern, er verspricht
ja nichts. Zum Fehler wird es erst, wenn die App dem Nutzer sagt
„gespeichert", ohne nachgesehen zu haben.

#### Prüfstand 17: `scripts/versprechen_check.js`

`save_check` fährt einzelne Wege wirklich zu Ende — genauer, aber Handarbeit
je Weg. Dieser stellt dieselbe Frage **statisch über alle 103**, in drei
Klassen: **rot** (Versprechen ohne Prüfung) · **grün** (Antwort angesehen) ·
**still** (kein Versprechen, wird nur gezählt).

Erster Lauf: **vier rot, alle vier echt.**

| Stelle | Was versprochen wurde |
|---|---|
| `gsDoctorFollowup` | „Danke für dein Feedback!" |
| `gsPestAddToDiary` | „📓 Im Garten-Tagebuch gespeichert" |
| `gsFertilizerLogDone` | „✅ Düngung im Tagebuch festgehalten" |
| `saveListing` | „🌱 Bio" in der Bestätigung — auch wenn genau der PATCH, der dieses Feld schreibt, abgelehnt worden war |

#### Die Regel, und sie gilt für jeden Schreibvorgang

`sbFetch` **wirft nicht**. Ein `try/catch` fängt nur Netz- und JS-Fehler; eine
Ablehnung läuft mitten hindurch. Und PostgREST liefert bei einer von RLS
abgewiesenen Zeile **0 Datensätze und keinen Fehler**.

Seit v32.28 gibt es dafür `_gsSchreibOk(r)` — beides in einer Zeile, damit die
nächste Stelle es nicht wieder einzeln macht. Und: wer `Prefer: return=minimal`
schickt, macht die Ablehnung **unsichtbar**; für geprüftes Schreiben gehört
dort `return=representation` hin. Alle vier Stellen sind entsprechend
umgestellt.

Beim Marktplatz war die richtige Antwort nicht, die ganze Meldung umzuwerfen —
das Inserat ist ja da. Sondern **genau das wegzulassen, was nicht stimmt**,
und es zu sagen: „⚠️ Bio-/Pestizid-Angabe nicht gespeichert".

#### Drei Fallen aus dem Bau, alle allgemein

- **Eine Absage ist kein Versprechen.** Nach der Reparatur meldete der
  Prüfstand meine eigenen Fehlermeldungen — „Eintrag NICHT gespeichert"
  enthält „gespeichert". Wer nach Wortstämmen sucht, braucht die Verneinung.
- **Ein Zeichen, das zwei Dinge bedeuten kann, taugt nicht als Merkmal.** 🚫
  stand in meiner Absage-Liste und heisst in dieser App „Pestizid-frei" — es
  hat den einen echten Fund verschluckt, und der Prüfstand meldete grün.
- **Reparatur und Prüfung brauchen dieselbe Regel** (schon v32.16): der neue
  Helfer musste in die Erkennung, sonst meldet der Prüfstand jede Stelle rot,
  die ihn benutzt.

Dazu ein `--alle`-Schalter, der auch grün und still zeigt. **Ein Prüfstand,
der nur Fehler druckt, lässt offen, WARUM eine Stelle nicht auffällt** — daran
habe ich beim Bau zweimal falsch geraten und musste beide Male nachsehen
statt schliessen.

**Gegenprobe gemacht:** eine Reparatur zurückgenommen → sofort
`!! gsFertilizerLogDone`.

**Grenze, ehrlich benannt:** rein statisch. Wer die Antwort in einem HELFER
prüft, den die Funktion aufruft, wird rot gemeldet. Ein Treffer ist ein
Verdacht, kein Urteil — wie bei `field_check.py`.

---

### 2026-09-03 (dq) — v32.27: vier Fehler in einer Ecke, drei davon still

Nach Fernandos fünf Punkten die nächste Frage gestellt: **sieht überhaupt
jemand hin, was der Server geantwortet hat?** `save_check` prüft das für
sechs Wege — die App hat **109 echte Schreibvorgänge** (214 `sbFetch` mit
POST/PATCH/DELETE, davon 105 RPC-Aufrufe, bei denen POST das Protokoll ist
und kein Schreiben).

**Erst das Werkzeug prüfen.** Mein erster Zähler meldete „180 von 214 sehen
nicht hin" — Unsinn aus zwei Gründen: RPCs als Schreibvorgänge gezählt, und
ein `.rstrip()`, das genau das Leerzeichen nach `await` entfernte, auf das
mein Muster wartete. Erst die Stichprobe an vier Fundstellen hat es gezeigt.
**Eine Zahl, die man nicht an einem Einzelfall nachgesehen hat, ist keine
Zahl.**

Richtig gezählt: **34 von 109** sehen die Antwort nirgends an. Und sie sind
nicht gleich schwer — was daraus einen Fehler macht, ist nicht der fehlende
Blick, sondern **ein Versprechen, das niemand geprüft hat.**

#### Die Ecke, in der vier zusammenkamen

`scan_corrections` — der Weg, auf dem Nutzer dem Scanner einen Fehler melden.

1. **`gsSubmitScanMistake` schickte fire-and-forget** und dankte danach
   bedingungslos: `🙏 Danke für die Korrektur!`. Wurde sie abgewiesen, lag sie
   nur in `gs_scan_corrections` — einer Liste, die **niemand sendet** (sie
   steht nur im Backup-Snapshot).
2. **Der Offline-Zweig von `gsScanCorrect` schrieb `correct_name`** — eine
   Spalte, die es in `scan_corrections` nicht gibt (nachgesehen, nicht
   geraten: `user_name` ist die richtige und `NOT NULL`). Der Kommentar
   daneben sagt es selbst: *„v29.07 (Bug-Sweep): 'correct_name'/'scan_ts'
   existieren NICHT … Korrektur ging sonst IMMER verloren (trotz
   'Danke'-Toast)."* **Damals wurde nur der ONLINE-Zweig repariert.**
   Dieselbe Klasse wie der Tagebuch-Reiter gestern: zwei Stellen, eine
   behoben.
3. **`gs_scan_corrections_queue` wurde nie gesendet.** Der Toast versprach
   „Wird beim nächsten Login synchronisiert" — es gab keinen Flush. Kein
   Aufrufer, kein Zuhörer, nichts.
4. **`.then()` auf `sbFetch` ist keine Erfolgsprüfung.** `sbFetch` wirft
   nicht, es liefert `{data, error}`. Der Erfolgs-Toast lief also auch dann,
   wenn der Server abgelehnt hatte — die v31.95-Klasse zum wiederholten Mal.

#### Was jetzt gilt

Ein Sender, eine Warteschlange, eine Wahrheit:

- `_gsKorrekturSatz` baut den Satz aus den **echten** Spalten.
- `_gsKorrekturSenden` prüft `error` **und** ein leeres Ergebnis (PostgREST
  liefert bei einer von RLS abgewiesenen Zeile 0 Datensätze und keinen
  Fehler) und liefert `ok` · `abgelehnt` · `kein-netz`.
- `gsFlushKorrekturen` gibt es überhaupt erst — er läuft beim Start und beim
  Wiederverbinden, dort wo die anderen zwei Warteschlangen abgearbeitet
  werden. **Was abgelehnt wird, bleibt liegen**; nur Zugestelltes
  verschwindet.
- Beide Meldewege sagen jetzt dasselbe und die Wahrheit: Dank nur bei
  Zustellung, sonst „gespeichert, wird später übertragen" — und bei vollem
  Gerät die dritte Antwort, statt stillschweigend zu verlieren.

#### Prüfstand

`save_check` `SERVER_WEGE` 6 → 7, vier Fälle: Ablehnung · **leere Antwort
ohne Fehler** · Erfolg · Flush (ablehnen lässt liegen, annehmen räumt weg).
Dazu die Spaltenprüfung: die Warteschlange darf `user_name` tragen und
`correct_name` nicht.

**Gegenprobe gemacht:** den bedingungslosen Dank wiederhergestellt → sofort
`!! Arten-Korrektur (gsSubmitScanMistake → scan_corrections)`.

**Offen und benannt:** 33 weitere Schreibvorgänge sehen die Antwort nicht an.
Die meisten sind stille Hintergrund-Schreibvorgänge ohne Versprechen
(Sammlungs-Aufräumen, Garten-Punktestand) — das ist vertretbar. Die Frage für
die nächste Runde ist nicht „wer sieht nicht hin", sondern **„wer verspricht
etwas, das niemand geprüft hat"**.

---

### 2026-09-03 (dp) — v32.26: dreizehn Stellen, eine Rechnung

Der offene Punkt aus (do) abgearbeitet. Die 26 verbliebenen Kontrast-Stellen
waren **in beiden Modi dieselben dreizehn** — also modusunabhängig, also kein
Kipp-Fehler mehr, sondern durchweg derselbe Typ: **eine Fläche, die für weisse
Schrift ein wenig zu hell ist.**

Eine Rechnung für alle: weisse Schrift braucht eine Fläche mit relativer
Leuchtdichte **≤ 0,183** (aus `1,05 / (L + 0,05) ≥ 4,5`).

| Stelle | Was |
|---|---|
| Sensor-Knöpfe (2×) | `#0277bd`→`#01579b`, `#388e3c`→`#1b5e20` |
| Tagebuch: Reiter + Chip „Alle" | `#558b2f`→`#33691e`, `#607d8b`→`#455a64` |
| Säkalender-Chip „Alle" | die letzte `var(--g-main)`-Füllung → `var(--fill-brand)` |
| Mondkalender „Fruchttag" | `#e65100`→`#bf360c` |
| Doktor · Trial · Garten-Scan · Tagebuch (4×) | weisse Schrift mit `opacity` — die Fläche trägt sie, die Deckkraft nahm sie wieder weg |
| API-Hilfe | `#888` → `var(--text2)` |
| Naturjahr-Rangziffer | `#43a047` → `var(--g-main)` |

**Gemessen nach der Welle: `automatisch geoeffnet: 44 Fenster · ohne Befund`
— 0 Textstellen unter AA in BEIDEN Modi.** Von 100 auf 0, in zwei Schritten
(v32.25: 100 → 26 · v32.26: 26 → 0).

**Drei Dinge, die dabei auffielen:**

- **`#e65100` war ein Rest.** Das Farbsystem hat seit v31.58 `--c-warn-d:#bf360c`
  mit dem Kommentar „war `#e65100`, unter AA". In `MOON_TYPES` stand der alte
  Wert weiter — weil diese Tabelle bis v32.25 in keinem gemessenen Fenster lag.
  **Eine Regel, die nur dort gilt, wo jemand hinsieht, ist keine Regel.**
- **Der Gold-Knopf war der einzige, der eine Entscheidung statt einer Rechnung
  brauchte.** Weiss trägt auf Gold nie (2,2:1); ein Gold, das Weiss trägt, ist
  kein Gold mehr, sondern Oliv. Also die andere Richtung: helleres Gold,
  **dunkle** Schrift. Lesbar — und als „Lifetime"-Angebot eher hochwertiger.
  Wo die Rechnung zwei Auswege hat, entscheidet der Zweck der Fläche.
- **Eine Reparatur kann richtig aussehen und trotzdem nichts ändern.** Der
  Tagebuch-Reiter setzt seine Farbe an ZWEI Stellen: in der Auszeichnung des
  Knopfes und in `gsDiarySwitchTab`, das beim Umschalten den ganzen `cssText`
  überschreibt. Ich hatte nur die erste — und der Prüflauf meldete danach in
  beiden Modi **genau diese eine** Stelle weiter. Ohne ihn wäre sie als
  „behoben" durchgegangen. Genau dafür ist er da.

  Nachgemessen nach dem zweiten Fix, gezielt in beiden Modi und beiden
  Zuständen des Reiters: **6,55:1 hell, 6,60:1 dunkel.**

  Und noch eine Regel aus derselben Minute: mein Wegwerf-Skript meldete
  daneben **1,70:1** für den INAKTIVEN Reiter — eine Zahl, die der Prüfstand
  nie gemeldet hat, weil er den tatsächlich gerenderten Grund misst statt
  `backgroundColor` am Element. **Ein ad-hoc-Skript ist kein Gegenbeweis zu
  einem gegengeprüften Prüfstand** (die Lehre aus v32.07, hier zum zweiten
  Mal).

---

### 2026-09-03 (do) — v32.25: der Kontrast-Prüfstand mass sechs von vierzig Fenstern

Fernandos fünfter Punkt: **die Optik**. Alle vier optischen Prüfstände melden
null — `render_check`, `contrast_check`, `touch_check`, `a11y_check`. Also die
Frage gestellt, was sie NICHT ansehen. Die Antwort stand seit v31.78 in
`CLAUDE.md` §7.1, als Satz, den alle gelesen und niemand befolgt hat:

> „Wer Farbe in einem Modal setzt, das der Prüfstand nicht öffnet, rechnet
> selbst nach."

**Niemand rechnet selbst nach.** `contrast_check` mass sechs Fenster. Die App
hat rund vierzig.

#### Die Reparatur am Prüfstand

Die Liste von Hand zu verlängern wäre der falsche Weg gewesen — sie veraltet,
wie jede gepflegte Liste. Stattdessen dieselbe Entdeckung wie in
`wiring_check` Richtung 3: **jeder Öffner ohne Parameter mit `openModal(` im
Rumpf wird wirklich aufgerufen und vermessen.** Neue Fenster sind damit ab dem
Tag ihrer Entstehung dabei. Die sechs von Hand gestellten bleiben — sie
brauchen Daten, die kein Öffner allein herbeiruft (Musterplan, Scan-Ergebnis).

Erster Lauf: **44 Stellen im Hellmodus, 56 im Dunkelmodus**, in Fenstern, die
noch nie jemand gemessen hatte. Die schlimmste bei **1,01:1** — hellgrüner Text
auf hellrosa Fläche, also schlicht unsichtbar.

#### Vier Ursachen, vier Regeln

| Ursache | Regel |
|---|---|
| Text aus einem **kippenden** Merkmal auf **fest heller** Fläche | Eine feste Fläche braucht eine **feste** Schrift. `--g-dark` wird im Dunkelmodus `#a5d6a7` — auf einem festen Pastellton sind das 1,0:1. |
| Fest dunkelgrüne Schrift (`#1a3d1a`) auf einer Fläche, die im Dunkelmodus dunkel wird | Umgekehrt: Schrift auf einer **Themen**-Fläche nimmt ein Merkmal, keine feste Farbe. (15 Stellen) |
| **Füllung** aus `--g-main` / `--g-dark` / `--c-success` mit weisser Schrift | Füllungen nehmen `--fill-brand` (hell `#1f6b2f`, dunkel `#2b7530` — beide tragen Weiss). Die Grün-Merkmale sind Marken-Töne und kippen. |
| `opacity` auf **Text**, um einen Zustand zu zeigen | Deckkraft senkt den Kontrast **blind** — sie fragt nicht, worauf der Text steht. „Gesperrt" zeigt man mit `filter:grayscale(1)` oder einer anderen Textfarbe. |

Betroffen waren unter anderem: die sechs Knöpfe im „Was möchtest du
teilen?"-Fenster, die acht Kacheln in „Mein Naturjahr", die Abo-Karten, die
Meilenstein-Chips im Profil, der Hofladen, der Säkalender und die
Jahres-Umschalter in Ernte und Tagebuch.

**Ergebnis nach der Reparatur: 100 → 26.** Hellmodus 44 → 13, Dunkelmodus
56 → 13.

Und die beiden Listen sind jetzt **fast deckungsgleich** — das ist die
eigentliche Aussage: die verbliebenen Stellen sind **modusunabhängig**, also
keine Kipp-Fehler mehr, sondern schlicht Füllungen, die ein wenig zu hell für
weisse Schrift sind (2,36:1 bis 4,39:1; neun davon knapp unter der
4,5er-Schwelle). Keine einzige ist unsichtbar. Namentlich:

| Fenster | Was |
|---|---|
| `gsShowFirstTrialModal` (3×) | weiss auf Gold `#c79415` — Gold trägt kein Weiss |
| `openDevicesModal` (2×) | weiss auf `#429f46` bzw. `#027fc7` |
| `openDiaryEntryModal` (2×), `gsOpenGardenScan`, `openDoctorModal` | weiss auf mittelgrünen/petrolfarbenen Flächen, teils mit `opacity` |
| `openSaekalender`, `openGartenTagebuch` | ausgewählter Filter-Chip |
| `openMoonCalendar` | `#e65100` auf `#fff3e0` |
| `openApiKey` | `#888` als Hilfetext |

Alle mit derselben Rechnung zu beheben: eine Fläche für weisse Schrift braucht
eine Leuchtdichte ≤ 0,183. Nächste Welle.

#### Der Fehler, den ich dabei selbst gemacht habe

Ich habe `background:#2e7d32;color:#fff;` **global** durch `var(--fill-brand)`
ersetzt — und damit **21 nie gemessene Stellen** mitgenommen. Die Rücknahme
traf dann **122**, weil die Gegenrichtung auch die ursprünglichen
`--fill-brand`-Nutzer erwischte. Die Datei war beschädigt und musste aus dem
letzten Commit zurückgeholt werden.

> **Ein Suchen-und-Ersetzen über eine 5-MB-Datei ist keine Aufräumarbeit,
> sondern ein Eingriff.**

Der zweite Anlauf prüft jede einzelne Ersetzung gegen eine **erwartete
Trefferzahl** (`viele(alt, neu, name, 7)`) und bricht ab, wenn sie nicht
stimmt. Und die Regel aus v31.77 gilt weiter: eine Farbe wird nur dort
geändert, wo ein Messwert vorliegt — nicht vorbeugend, nicht „passt schon".

#### `touch_check` misst zwei Breiten

412 px und **320 px** (iPhone SE, ältere Android-Geräte). Eine Antippfläche,
die bei 412 passt und bei 320 aus dem Bild läuft, fällt sonst niemandem auf.
Beide Breiten sauber. **Gegenprobe:** ein Fehler, den es nur unter 340 px gibt
— gemeldet, mit der Breite dahinter, und zwar ausschliesslich für 320 px.
(Zwei frühere Anläufe der Gegenprobe zeigten NICHTS und waren trotzdem
richtig: sie trafen ein `div` und einen Knopf in einem geschlossenen Fenster —
beides sieht die Regel zu Recht nicht an.)

---

### 2026-09-03 (dn) — v32.24: drei Erzeuger, null Leser — Deep-Links endeten immer oben

Fernandos vierter Punkt: **Verdrahtung**. `wiring_check` meldete an allen vier
bestehenden Richtungen null; die 46 „abgesicherten Nachschlagungen" aus v31.46
sind abgearbeitet. Also die Frage gestellt, die kein Prüfstand stellte:
**führt ein Deep-Link irgendwohin?**

Drei Stellen erzeugen seit jeher Links mit einem Anker:

| Erzeuger | Link |
|---|---|
| `gsSharePost()` (Teilen-Knopf) | `https://green-scan.ch/?screen=social#post-<id>` |
| `fn_notify_post_like` (DB-Trigger) | `/?screen=social#post-<id>` |
| `fn_notify_comment_like` (DB-Trigger) | dasselbe |
| `gsShareComment()` | `…#comment-<id>` |
| Aufgaben-Cron | `/?screen=garden#task-<id>` |

**Gelesen hat den Anker niemand.** Und zwar an zwei Stellen zugleich:

- `gsHandleShortcutUrl` sah nur `?screen=` und schrieb danach `location.pathname`
  **ohne Hash** zurück — der Anker war weg, bevor ihn jemand gelesen hatte.
- Der Benachrichtigungs-Router schnitt ihn mit `.split('#')[0]` **ausdrücklich
  ab** und vergaß ihn.
- Und selbst wenn jemand gelesen hätte: **es gab kein Element mit dieser id.**
  Keine Beitragskarte trug `id="post-<id>"`.

Ergebnis: „❤️ Anna gefällt dein Beitrag" antippen → Community-Reiter, oben.
*Welcher* Beitrag gemeint war, erfuhr niemand. Bei einem geteilten Link
dasselbe. **Ein Link, der oben auf der Seite endet, sieht aus wie ein Link, der
funktioniert hat — genau deshalb fällt er niemandem auf.**

#### Was jetzt passiert

- Die Beitragskarte trägt ihren Anker.
- `gsAnkerAnspringen(hash)` wartet (gedeckelt) auf das Element, scrollt hin und
  hebt es 2,6 s hervor. Der Feed lädt seitenweise zu 20 — ist der Beitrag
  älter, wird er **einzeln nachgeladen** und vorne eingefügt (das Anhängen
  entdoppelt seither nach id, sonst käme er mit seiner Seite ein zweites Mal).
- `#comment-<id>` kennt nur sich selbst, nicht seinen Beitrag. Die App schlägt
  `post_comments.post_id` nach, springt den Beitrag an und öffnet die
  Kommentare.
- Findet sich nichts, **sagt sie das**. Vorher blieb sie stumm oben stehen.
- Hervorgehoben wird mit einem abklingenden Ring — **nie mit einer Animation
  nach unsichtbar** (die Regel aus v32.11). `--g-main` statt `--g-dark`, weil
  Letzteres im Dunkelmodus kippt.

#### `wiring_check` Richtung 5

Sammelt die erzeugten Anker-Arten aus `index.html`, den Migrationen und den
Edge-Functions, und hält sie gegen das, was der Leser kennt. **Drei Klassen,
nicht zwei** (dieselbe Regel wie in `backend_check`): gelesen · bewusst ohne
Ziel, mit Grund · unbegründet ungelesen. Ohne die mittlere stünde `#task-`
dauerhaft als Fehler im Bericht, obwohl die Entscheidung getroffen ist: der
Cron verlinkt eine Zeile aus `garden_tasks`, und die App zeigt ihre Aufgaben
aus `myPlants` — es gibt schlicht kein Element, auf das der Anker zeigen
könnte.

Dazu ein **lebender** Fall: ein Beitrag wird wirklich in den Feed gelegt,
`gsAnkerAnspringen` wirklich aufgerufen, und geprüft wird die Markierung am
Element — nicht der Rückgabewert allein.

#### Drei Dinge aus dem Bau, alle allgemein

- **Eine Zeitmessung ist keine Aussage.** Der erste Bau erkannte „kennt der
  Leser diese Art?" daran, ob er länger als 300 ms wartete. `comment` fiel
  prompt durch — sein Datenbank-Blick kam ohne Netz sofort zurück. Jetzt
  deklariert der Leser seine Arten als Daten (`GS_ANKER_ARTEN`), wie
  `GS_NOTIF_ZIELE` es seit v31.81 tut.
- **`socialPosts` ist ein `let`, kein `window.`-Feld.** `window.socialPosts = […]`
  legt eine zweite, unbenutzte Eigenschaft an; `renderSocialFeed` meldet
  danach „Noch keine Posts". Eine halbe Stunde.
- **Eine Gegenprobe, deren Aufbau still fehlschlägt, sieht aus wie eine
  bestandene Gegenprobe.** Meine erste (Anker-id entfernen) meldete grün —
  weil das Skript, das die Zeile entfernen sollte, nichts geändert hatte.
  Erst der zweite, sauber gebaute Anlauf zeigte den Unterschied.

---

### 2026-09-03 (dm) — v32.23: 46 von 47 Feldern kommen zurück. Das eine war der Ausschalter.

Fernandos dritter Punkt: **Vernetzung**. Die App schiebt drei Blobs in die
Cloud (`user_plants`, `user_gardens`, `user_app_state`), gebaut aus **47**
localStorage-Schlüsseln. Der Rückweg ist eine **andere**, von Hand gepflegte
Liste — und ob beide deckungsgleich sind, hatte nie jemand nachgezählt.

Nachgezählt: **46 von 47.** Der fehlende war `gs_reminder_prefs`.

#### Warum ausgerechnet der wehtut

Er steht seit v24.26 im hochgeladenen Blob, und der **Server-Cron liest ihn**
(`reminder_prefs.disabled[plantId]`). Die Abschaltung war also serverseitig
wirksam — aber gerätelokal bekannt. Daraus wird eine Kette, die genau falsch
herum ausgeht:

1. Handy: „Giess-Erinnerung für diese Pflanze aus." → Cloud bekommt
   `{disabled:{p1:true}}`.
2. Tablet: kennt den Schlüssel nicht, hat `{}`.
3. Nächster State-Push vom Tablet: `{}` überschreibt die Cloud.
4. Der Cron schickt die Erinnerung wieder.

Der Nutzer hatte sie ausgeschaltet. Sie kam zurück, und niemand konnte ihm
sagen warum.

#### Und ein zweiter Fund an derselben Stelle

Der Schutz aus v28.97 („ein leeres Cloud-**Array** darf keine gefüllte lokale
Liste ersetzen") prüfte `Array.isArray(v) && v.length === 0`. Vier
State-Felder sind aber **Objekte**: `ps_votes`, `gs_wissen_read`,
`gs_dq_stats` und jetzt `gs_reminder_prefs`. Für sie galt der Schutz nie —
derselbe Verlust, andere Klammern. Der Guard kennt jetzt beide Formen.

#### Prüfstand 16: `scripts/sync_check.js`

Er stellt `sbFetch`: ein Push landet in einer Attrappe der Cloud, ein Pull
holt ihn von dort, dazwischen wird der localStorage geleert. Was danach fehlt,
hat die Rundreise nicht überlebt.

**Die Schlüsselliste liest er aus dem Quelltext** (aus den drei Blob-Bauern),
nicht aus einer eigenen Tabelle. Wer dem Blob ein Feld hinzufügt, ist damit
automatisch geprüft — und Frage 7 meldet ihn, solange er keinen Probewert
hinterlegt hat. Genau das ist der Unterschied zu einer Liste, die man pflegen
müsste und die deshalb veraltet.

Sieben Fragen: gehen die drei Blobs überhaupt hinaus · kommt jedes Feld zurück
· **Gegenprobe** (ein Feld umbenennen → muss gemeldet werden) · leerer
Cloud-Wert löscht weder Liste noch Objekt (mit Gegenprobe: eine **gefüllte**
Cloud MUSS überschreiben) · ein Pull markiert nichts als ungesendet · sagt der
Server NEIN, bleibt es schmutzig (die v30.99-Klasse) · hat jeder Blob-Schlüssel
einen Probewert.

**Gegenprobe zu beiden Reparaturen gemacht:** die `gs_reminder_prefs`-Zeile
und die Objekt-Hälfte des Guards entfernt → sofort *„kommt NICHT zurück:
gs_reminder_prefs"* und *„das leere Cloud-OBJEKT hat den lokalen Stand
gelöscht"*.

#### Zwei Fallen beim Bau, beide allgemein

- **`flushNow()` ist nicht der Weg.** Das ist der Beacon-Pfad (`sync = true`)
  und geht mit rohem `fetch` an `sbFetch` vorbei. Der erste Lauf meldete
  fröhlich „0 Tabellen gepusht" und hätte damit **alle 47 Felder als fehlend
  gemeldet** — ein Prüfstand, der nichts sieht, sieht auch keinen Fehler.
  Der echte Weg im Betrieb ist `markDirty(scope)` → `flushDebounced`.
- **Falsche Probewerte ERFINDEN Befunde.** Mit `gs_streak = '{"n":7}'` meldete
  der Lauf vier Fehler, die keine waren: `_gsStreakApplyCloud` macht
  `parseInt` daraus, bekommt `NaN` und steigt aus — richtigerweise. Mit einem
  Tag von vorgestern greift die Lückenprüfung — ebenfalls richtig. In v31.98
  haben falsche Beispieldaten einen echten Fehler **verdeckt**; hier hätten sie
  drei erfunden. Beide Richtungen kosten dieselbe halbe Stunde.

---

### 2026-09-02 (dl) — v32.22: v31.04 war nur die halbe Reparatur

Der Speicher-Audit von gestern (dk) endete mit einem offenen Punkt: IndexedDB
überlebt das Abmelden vollständig. Nachgesehen, was das konkret heisst — und
es ist derselbe Fehler, den **v31.04 im `localStorage` schon einmal behoben
hat**, an der anderen Ablage:

> `gs_sync_queue` überlebte den Logout. Die `user_id` wird aber erst **beim
> Flush** eingesetzt — ungesendete Vorgänge von Nutzer A landeten im Konto
> von Nutzer B.

In IndexedDB stand er weiter, und dort geht es um mehr als eine Zeile:

| Ablage | Was passierte |
|---|---|
| `pending_scans` · `pending_diary` · `pending_sync` | `gsScanPersistToCloud` schreibt für den, der **gerade** angemeldet ist. A scannt offline, B meldet sich an — der Scan wird B gutgeschrieben. |
| `pending_photos` | `gsUploadImage` lädt in den Bucket des Angemeldeten. As Foto landet in Bs Speicher und auf Bs Kontingent. |
| `dropped_entries` | Der Archiv-Export gab As gekürzte Tagebuch-Einträge an jeden weiter, der danach am Gerät sass. |

#### Warum nicht „beim Abmelden wegwerfen"

Das wäre die schnelle Antwort und die falsche: dann verliert A seine offline
gemachte Arbeit **in dem Moment, in dem er sich abmeldet** — genau die Arbeit,
für die die Warteschlange existiert.

Stattdessen trägt jeder Eintrag seit v32.22 die `uid` seines Einreichers
(`gsQueueOffline` · `gsQueuePhoto` · `gsArchiveDropped`). Der Flush
**überspringt** fremde Sätze, statt sie zu löschen. Kommt A zurück, gehen sie
raus — nachgemessen, siehe unten.

- Sätze **ohne** `uid` stammen aus einer Version vor v32.22 und gelten als
  eigene. Die Alternative wäre, sie zu verwerfen — das hiesse, beim Update
  jede bestehende Warteschlange lautlos zu leeren. Das Fenster ist begrenzt
  und schliesst sich mit dem ersten Einreihen.
- Damit Fremdes nicht ewig mitwandert: **90-Tage-Deckel** (`_gsRaeumeFremde`),
  bei jedem Flush. Ohne ihn hält ein einmal benutztes Gerät base64-Fotos eines
  Kontos fest, das nie wiederkommt.
- `gsFlushOfflineQueue` braucht jetzt eine **Anmeldung**. Ohne sie konnte er
  nichts übertragen, setzte im generischen Zweig aber `ok = true` und löschte
  die Sätze.

#### Zwei Nebenfunde derselben Stelle

- **`gsCountOfflineQueue` zählte über alle fünf Ablagen** — also auch über
  `dropped_entries`. Das Archiv wartet auf gar nichts und wird nie kleiner.
  Wer einmal 3'000 gekürzte Einträge archiviert hatte, sah dauerhaft
  „3'000 wartend" im Offline-Banner. Zählt jetzt `SYNC_STORES` +
  `pending_photos`, und nur das eigene.
- **`gsArchiveCount` / `gsArchiveExport` zeigten beide Konten.** Filtern jetzt
  über `_gsArchivEigene()`.

#### Prüfstand: `offline_check` 10 → 13 Fragen

Jede der drei neuen Fragen wird **zweimal gefahren** — einmal als der Fremde
(nichts darf passieren) und einmal als der Eigentümer (es MUSS passieren).
Nur die zweite Hälfte unterscheidet „schützt richtig" von „tut gar nichts
mehr".

**Gegenprobe gemacht:** die beiden Eigentums-Zeilen aus `index.html` entfernt
→ der Prüfstand meldete sofort *„B hat den Scan von A ins eigene Konto
geschrieben"* und *„B hat das Foto von A in den eigenen Bucket geladen"*.

**Und eine Lehre über diesen Fall hinaus:** die drei neuen Fragen liessen die
bestehenden Fragen 6, 8 und 9 rot werden — der Prüfstand stellte „angemeldet"
bisher nur mit einem Token her, und Eigentum braucht eine `uid`. Ein Prüfstand,
der einen Zustand nur halb herstellt, prüft ab dem Moment etwas anderes, als
er behauptet. Der erste Anlauf der Zähler-Frage erwartete ausserdem eine feste
Zahl (2 archivierte) und mass 4, weil Frage 8 als derselbe Nutzer schon
archiviert hatte — **ein Fall misst seine eigene Grundlinie, statt eine Zahl
zu erwarten, die eine andere Frage mitbestimmt.**

---

### 2026-09-02 (dk) — v32.21: 130 Speicherplätze überlebten das Abmelden, 123 hatte niemand entschieden

Fernandos Liste begann mit **Speicherorten**. Gemessen statt gelesen: alle 205
im Quelltext vorkommenden `localStorage`-Schlüssel plus die zur Laufzeit
entstandenen auf `SPUR-VON-NUTZER-A` gesetzt, dann den echten Abmelde-Weg
gefahren (`gsClearUserDataKeys` · `sbClearSession` · `gsOnLogout`) und
nachgezählt.

```
gesetzt: 209 · nach dem Abmelden noch da: 130
davon in einer der beiden Listen genannt: 7
```

**123 Schlüssel blieben liegen, ohne dass je jemand entschieden hatte, dass
sie liegen bleiben sollen.** Die schwersten:

| Schlüssel | Was drinsteht |
|---|---|
| `ps_api_key` | der persönlich hinterlegte Anthropic-Schlüssel (`sk-ant-…`) |
| `gs_global_api_key` (+5) | der vom Admin hinterlegte globale Schlüssel |
| `gs_auth_db` | lokale Anmelde-Ablage **mit E-Mail-Adressen** |
| `gs_sb_user` | das ganze Nutzerobjekt aus Supabase |
| `gs_admin_pw_hash` · `gs_admin_log` | Admin-Zugang und Admin-Protokoll |

Und die zweite Hälfte des Fundes, die den ersten erst teuer macht:
`getApiConfig()` (Z. ~26574) liest `ps_api_key` und `gs_global_api_key`
**ohne jede Anmelde-Prüfung**. Auf einem geteilten Gerät scannte der nächste
Nutzer damit auf Rechnung des vorigen.

#### Warum es sechsmal repariert wurde und trotzdem offen war

Diese Klasse ist seit v29.10 **sechsmal** einzeln nachgetragen worden —
v29.10 (Abo-Cache), v29.19 (GPS-Tracks, Anzeigename), v29.44
(Marktplatz-Chats, Experten-Antrag), v30.94 (Community-Entwurf), v30.97
(Snapshot-Spur), v31.12 (Wander-Aufzeichnung). Jedes Mal ein Fund, jedes Mal
ein Eintrag in `GS_USER_KEYS`, **nie eine Prüfung dahinter**.

`GS_KEEP_ON_LOGOUT` gab es seit v26.69 — mit neun Einträgen und der Ansage im
eigenen Kopf: *„Dient als Doku."* Alles, was in keiner der beiden Listen
stand, blieb implizit liegen. Genau darin liegt der Fehler: eine Doku, die
nichts erzwingt, wächst nicht mit.

#### Was jetzt gilt

**Beide Listen sind vollständig, und die Regel ist umgekehrt:**

> Jeder Schlüssel, der das Abmelden überlebt, muss **namentlich** in
> `GS_KEEP_ON_LOGOUT` (oder `GS_KEEP_PREFIXES`) stehen.

- `GS_USER_KEYS` 70 → **118** (+48), dazu `GS_USER_PREFIXES`
  (`gs_aicalls_`, `gs_sync_dirty_at_`, `gs_sync_synced_at_` — `gsOnLogout`
  räumte bisher genau drei Bereiche, jeder weitere blieb liegen).
- `GS_KEEP_ON_LOGOUT` 9 → **77**, gruppiert und **je Gruppe begründet**:
  Oberfläche · Backend-Adresse · Standort · Geräte-Berechtigungen ·
  Zwischenspeicher öffentlicher Inhalte · Ansicht/Filter · einmalige
  Hinweise · Entwickler-Schalter · Einmal-Migrationen.
- `gsClearUserDataKeys` räumt jetzt auch **Präfix-Familien** und die
  **Spiegel im Arbeitsspeicher** (`marketListings`, `farmState`,
  `_gsDev.registry`). Ohne die zweiten wäre der Speicher sauber und der
  Bildschirm nicht.
- `getApiConfig()` gibt **ohne Anmeldung keinen Schlüssel** mehr heraus.
  Bewusst als Schranke, nicht als Löschung: auf Bestandsgeräten liegt der
  Schlüssel schon; ihn bei einer bloss **abgelaufenen** Sitzung zu vernichten
  wäre Datenverlust an etwas, das der Nutzer selbst eingetippt hat. Meldet
  sich ein anderes Konto an, räumt der User-Wechsel-Zweig ihn ohnehin weg.

Ergebnis nach dem Umbau: **219 gesetzt · 79 überleben · 0 unbenannt.**

#### Der 15. Prüfstand: `scripts/storage_check.js`

Fünf Fragen, jede mit eigener Zeile im Bericht:

| | |
|---|---|
| **A** | überlebt, steht in KEINER Liste → Fehler |
| **B** | steht in `GS_USER_KEYS`, überlebt trotzdem → Fehler |
| **C** | wird als bleibend geführt, ist aber weg → Fehler |
| **D** | steht in BEIDEN Listen → Widerspruch |
| **E** | in einer Liste, im Quelltext unbekannt → Hinweis |

**Zwei Gegenproben, beide stellen den Fall wirklich her** — ein fremder
Schlüssel, den niemand eingeordnet hat (muss in A auftauchen), und ein
Schlüssel, der als bleibend geführt wird, aber gelöscht wird (muss in C
auftauchen). Ohne die zweite wäre eine Prüfung, die C gar nicht mehr rechnet,
ebenfalls grün.

**Grenze, ehrlich benannt:** geprüft wird der `localStorage`. IndexedDB
(`pending_scans`, `pending_photos`, `dropped_entries`) und die Cache-API
prüft er **nicht** — ein Foto in der Warteschlange überlebt das Abmelden
weiterhin. Das ist die nächste Frage, nicht diese.

---

### 2026-09-02 (dj) — Kaltstart untersucht, kein lohnender Angriffspunkt

Ohne Code-Änderung. Festgehalten, damit es niemand ein zweites Mal untersucht.

`perf_check` meldet auf einem Einsteiger-Telefon (6×) **3,3 s** bis DCL und
**5,6 s** Parsen. Das ist der grösste verbleibende messbare Nutzerkosten-Posten
der App. Die Frage war: gibt es noch einen Block wie den Changelog von v31.36
(787 KB ausgelagert, ~145 ms gewonnen)?

#### Gemessen

Die Datei ist **5,31 MB** in 88'260 Zeilen und 2'681 Deklarationen auf oberster
Ebene. Die grössten:

| | |
|---|---|
| `DEFAULT_RECIPES` | 296,6 KB |
| `WEEKLY_SEASONAL_FACTS` | 147,8 KB |
| `GS_I18N_JS_STRINGS` | 86,6 KB |
| `gsRegisterServiceWorker` | 77,4 KB |
| `gsPPrenderPlan` | 45,3 KB |
| `PLANT_DB` | 35,6 KB |
| Summe der grössten 22 | **1,31 MB** von 5,31 MB |

#### Warum ich es trotzdem gelassen habe

`DEFAULT_RECIPES` war der einzige ernsthafte Kandidat. Drei Gründe dagegen,
und der dritte allein hätte gereicht:

1. **Sie wird nicht nur im Rezepte-Tab gebraucht.** `openDetail` (Z. 32884)
   prüft für JEDE Art, ob es ein Rezept dazu gibt — das Arten-Detail ist eine
   der meistbenutzten Ansichten überhaupt.
2. **Offline müsste sie ohnehin mitgeladen werden**, sonst bricht der
   Rezepte-Tab ohne Empfang — genau das Versprechen, das v32.13 repariert hat.
   Der Gewinn wäre also reine PARSE-Zeit, nicht Übertragung.
3. **Und der ist klein.** Der Changelog-Split brachte ~145 ms für 787 KB;
   296 KB entsprechen grob **55 ms**. Dafür einen Umbau, der Rezepte,
   Heilmittel, Arten-Detail, den Service-Worker-Vorrat und drei Prüfstände
   berührt — das Verhältnis stimmt nicht.

`WEEKLY_SEASONAL_FACTS` (148 KB) fällt aus einem anderen Grund weg: die
Tages-Info der **Startseite** liest sie (Z. 23175). Auslagern hiesse, die
Startseite auf einen Nachladevorgang warten zu lassen.

#### Und ein Verdacht, der sich auflöste

Meine erste, grobe Segmentierung meldete `async function gsOpenWeatherWarn`
mit **208 KB** — das klang nach einer Funktion, die aus dem Ruder gelaufen
ist. Nachgesehen: es ist schlicht das Dateiende, 5'098 Zeilen gewöhnlicher
Code ohne weitere Deklaration auf oberster Ebene, die mein Muster hätte
finden können. Kein Fund.

> Eine Messung mit einem groben Werkzeug erzeugt Verdachtsfälle, keine
> Befunde. Nachsehen kostet Minuten, ein Umbau auf falscher Grundlage Tage.

**Fazit:** die Parse-Zeit bleibt eine Eigenschaft der Architektur, wie
`CLAUDE.md` §7.1 es beschreibt. Wer sie wirklich angehen will, braucht einen
echten Aufteilungsschritt (Tabs als eigene Dateien), nicht das Auslagern
einzelner Datenblöcke.

### 2026-09-02 (di) — a11y_check prüfte elf Tabs und null Fenster

Wieder kein Versionssprung: die App ist unverändert.

`contrast_check` misst längst in **sechs** Fenstern. `a11y_check` prüfte
**null** — obwohl Modale gerade die Stellen mit den meisten Eingaben sind
(Planer, Eingrenzen, Korrektur, Doktor-Fragebogen). Dreizehn Prüfstände, und
die Zugänglichkeit hörte an der Fensterkante auf.

Jetzt drei Fenster: „Ohne Netz eingrenzen", Blühkalender, Scan-Ergebnis —
geöffnet über die öffentlichen Öffner, nicht über nachgebaute Zustände.
Ergebnis: **0 Funde** in allen dreien.

#### Und wieder die Falle mit der Bezugsgrösse

Der erste Anlauf meldete stolz „**1'275 Bedienelemente**" für ein Fenster mit
vier Auswahlfeldern. Das war die Zahl des **ganzen Dokuments** — mit und ohne
offenes Fenster dieselbe. Sie hätte also auch dann gestimmt, wenn gar nichts
aufgegangen wäre.

Genau die Falle, die ich bei `contrast_check` in v31.78 selbst aufgeschrieben
habe („ohne diese Zahl sieht ein Fenster, das gar nicht aufging, genauso aus
wie eines ohne Fehler") — und hier prompt selbst gebaut. Gezählt wird jetzt,
was **im** Fenster steht:

```
eingrenzen → 0 Funde bei 308 Bedienelementen IM Fenster
blühkalender → 0 Funde bei  88 Bedienelementen IM Fenster
scan-ergebnis → 0 Funde bei  11 Bedienelementen IM Fenster
```

Drei verschiedene Zahlen — das ist der Beleg. Ein Fenster, das nicht aufgeht,
zählt jetzt als Fehler statt als leeres Ergebnis.

#### Zwei Gegenproben, und die erste war die lehrreichere

**Erst falsch angesetzt:** einem Auswahlfeld das `aria-label` genommen →
**kein Fund**. Ich hätte das als Lücke im Prüfstand lesen können. Es war aber
richtig: die Felder stehen in einem umschliessenden `<label>`, das sie bereits
benennt — mein `aria-label` war Gürtel und Hosenträger.

**Dann richtig:** ein Feld ganz ohne Namen und ein Bild ohne `alt` ins Fenster
gesetzt → beide gemeldet, und die Fensterzahl stieg von 308 auf 312.

> Eine Gegenprobe, die den Fall nicht herstellt, beweist nichts — auch dann
> nicht, wenn sie plausibel aussieht.

Das ist heute die dritte Gegenprobe, die zunächst am Ziel vorbeiging (nach dem
600-px-Knopf in v32.07 und dem 560-Kacheln-Deckel in v32.15). Offenbar ist das
die häufigste Art, sich selbst zu täuschen: nicht die Messung ist falsch,
sondern der Fall, den man herstellt.

### 2026-09-02 (dh) — der Prüfstand meldete vier Dinge, die keine sind

Kein Versionssprung: die App ist unverändert. Nur `render_check` ist schärfer.

Er meldete seit jeher **„abgeschnittener Inhalt: 4"** — die Kopfbereiche von
Wissen, Rezepte, Heilmittel und Community. Ich bin heute zehn Versionen lang
daran vorbeigelaufen, ohne einmal nachzusehen.

Nachgesehen: alle vier tragen ein riesiges Emoji als Wasserzeichen
(`position:absolute`, 140 px, `opacity:.06`) und beschneiden es **absichtlich**
mit `overflow:hidden`. Gemessen, ob echter Text verloren geht:

```
wissen:   Kasten  97px, scrollHeight 144 · echter Text abgeschnitten: NEIN
recipes:  Kasten  69px, scrollHeight  97 · echter Text abgeschnitten: NEIN
remedies: Kasten  69px, scrollHeight  97 · echter Text abgeschnitten: NEIN
social:   Kasten  70px, scrollHeight  97 · echter Text abgeschnitten: NEIN
```

Vier Falschmeldungen. Die Regel `scrollHeight > clientHeight` war zu grob.

**Jetzt zählt nur, was wirklich Text verliert:** ein Nachfahre mit eigenem
Textknoten, der nicht absolut positioniert ist und über den Kasten hinausragt.
Dieselbe Regel wie in `touch_check` seit v32.07.

**Gegenprobe mit zwei Fällen**, weil einer nichts beweist:

| Fall | erwartet | gemessen |
|---|---|---|
| zu hoher Textblock in einem 30-px-Kasten | gemeldet | ✅ „Diese Zeile ist viel zu …" |
| derselbe Kasten, nur ein absolutes Emoji darin | still | ✅ still |

Von 4 auf **0** — und die Regel ist dabei **schärfer** geworden, nicht
nachgiebiger.

> Ein Bericht wird nicht durch eine falsche Zahl unlesbar, sondern durch eine,
> die man zu ignorieren gelernt hat.

Das ist der eigentliche Fund: nicht die vier Zeilen, sondern dass ich sie
zehn Versionen lang gelesen und übergangen habe. Wer einen Prüfstand baut,
schuldet ihm, jede Zeile einmal nachzugehen — sonst erzieht er sich selbst
zum Wegsehen.

### 2026-09-02 (dg) — v32.20: im Wald ohne Empfang endet der Scanner nicht mehr im Nichts

Der Fall, für den diese App gebaut ist: jemand steht vor einer Pflanze, kein
Empfang. Der Scanner braucht die KI und sagte deshalb **„📡 Offline"** — und
das war das Ende.

Dabei liegt alles Nötige längst auf dem Gerät:

- seit **v32.13** wirklich alle 4'342 Arten (vorher waren es offline **null**),
- seit **v32.12** drei rechnende Prädikate — Monat, Farbe, Höhenlage.

Aus zwei Reparaturen dieser Session wird damit ein Bildschirm: **„🧭 Ohne Netz
eingrenzen"**. Er nimmt, was das Gerät von selbst weiss (Monat; Höhe aus dem
Standort), fragt nach dem, was man sieht (Farbe, Gruppe), und zeigt, was
übrig bleibt. Kein Netz, kein KI-Aufruf, Millisekunden.

Gemessen: **4'337 → 2'087** im Januar · mit Gelb **199** · nur Pilze **636**.

#### Die Höhenlage wird zum ersten Mal benutzt

877 Arten tragen ein Verbreitungsband (`alt: '0–1500m'`). Bis heute hat das
**nichts** in der App gelesen — ausser der Scan-Prüfregel S7 aus v32.12. Wer
auf 1'850 m steht, sieht jetzt nur, was dort auch wächst.

#### Zwei Regeln, an denen alles hängt

1. **Es ist KEINE Bestimmung, und es sagt das auch.** In einer App, die
   Giftiges von Essbarem trennt, wäre eine Liste, die wie ein Ergebnis
   aussieht, fahrlässig. Sie heisst „kommt in Frage", steht unter einem
   ausdrücklichen Hinweis, und jede Zeile trägt ihre Giftigkeitsstufe mit.
2. **Ausgeschlossen wird nur, was sich begründen lässt.** Eine Art ohne
   Höhenangabe fällt nicht heraus. Und der Kopf nennt, worauf eingegrenzt
   wurde **und** was nicht genutzt werden konnte — ohne Standort steht dort
   „Nicht genutzt: ohne Standort blieb die Höhenlage aussen vor — dafür wurde
   nichts ausgeschlossen."

Der Prüfstand hält beides fest: **3'464 Arten ohne Höhenangabe bleiben auch
bei 3'000 m in der Liste**, und die Anzeige nennt ihre Grundlage.

#### Drei Fehler, alle in meinem eigenen neuen Code, alle von Prüfständen gefangen

**1 · Das Fenster ging gar nicht auf.** `#modal-content` ist die innere
Tafel, die Hülle heisst `#detail-modal`. Mein `openModal('modal-content')`
öffnete die Tafel und liess die Hülle zu — sichtbar passierte nichts, und die
`try/catch`-Klammer darum hätte es auch noch verschluckt.

Gefunden hat es `wiring_check`, aber **erst nachdem ich sein Namensmuster
erweitert hatte**: es kannte nur `open…` / `gsOpen…` / `show…`. Dieses Repo
benennt auf Deutsch — `gsKorrekturOeffnen` (v32.05) und mein
`gsEingrenzenOeffnen` fielen beide durch. **Zwei Fenster, die nie jemand
geprüft hat, ohne dass irgendetwas rot war.**

> Ein Prüfstand, der nach NAMEN sucht, übersieht genau das, was anders heisst.

**2 · Ich habe eine Farbe vorbeugend kaputt gemacht.** `--g-dark` und
`--g-light` **kippen** im Dunkelmodus (dort ist `--g-dark` = `#a5d6a7`, das
helle Grün). Ich hatte „vorsorglich" eine `body.dark`-Zeile auf `--g-light`
gesetzt — dunkelgrün auf dunkelgrün, **1,23:1**. Der Basiswert war von Anfang
an in beiden Modi richtig. Dieselbe Lehre wie in v31.76, diesmal ohne
Falschmeldung als Ausrede: **eine Farbe erst ändern, wenn der Messwert da
ist.**

**3 · Falsche Feldnamen.** `TOX` heisst `sym`/`color`/`bg`, nicht
`icon`/`fg`. Beim Schreiben nachgesehen statt es dem Prüfstand zu überlassen —
billiger.

#### Einstiege

- Aus der **Offline-Karte des Scanners** — der Moment, in dem es zählt.
- Aus dem **Hauptmenü** (49 Einträge, alle geprüft).

Alle vierzehn Prüfstände grün. `scan_check` 48 Fälle, `contrast_check` jetzt
über **sechs** Fenster (72 Textstellen im neuen), `wiring_check` 44 Öffner.

### 2026-09-02 (df) — v32.19: fünf Server-Funktionen hatten keinen Quelltext im Repo

Fortsetzung von (de). Der neue Prüfstand fragte nach Tabellen und RPCs; die
Edge-Functions kamen danach. 35 sind ausgeliefert.

#### Der Ausgangsbefund

**Fünf aktive Funktionen hatten keinen Spiegel im Repo** — obwohl die
Konvention dieses Repos „mirror-first" heisst und in einem Dutzend
Changelog-Einträgen so steht. Betroffen unter anderem `marketplace-publish`,
die im Namen des Nutzers Inserate anlegt und Fotos in einen öffentlichen
Bucket lädt.

Vier davon liegen jetzt als **wortgetreue Abbilder** im Repo, mit Datum,
Version und `ezbr_sha256` im Kopf. Die fünfte (`book-ingest`, ~250 sehr dichte
Zeilen) ist **dokumentiert statt gespiegelt** — siehe unten, warum.

#### Befund 1 · `send-receipt` verschickt E-Mails, die niemand bestellt hat

Ausgeliefert seit April, `verify_jwt: true`, **0 Aufrufe** aus Frontend, cron
oder anderen Funktionen. Sie schickt eine gestaltete Quittung über Resend von
`GreenScan <info@greenscan.ch>` — und nimmt **alles** aus dem Anfrage-Rumpf:

```ts
const { type, email, name, amount, currency, date,
        transactionId, charityName, isSubscription } = await req.json()
```

Keine Prüfung gegen Stripe. Keine Prüfung, ob die aufrufende Person mit dieser
Zahlung zu tun hat. Keine Prüfung, ob ihr die Empfängeradresse gehört.
`verify_jwt: true` verlangt nur **irgendeinen** gültigen Nutzer-Token.

**Jede angemeldete Person kann damit eine frei erfundene GreenScan-Quittung an
jede beliebige Adresse schicken** — beliebiger Betrag, beliebige Organisation,
von der verifizierten Absenderdomäne. Im Text steht wörtlich „Diese E-Mail ist
deine Zahlungsbestätigung. Bitte aufbewahren."

Kein Datenabfluss — eine Vorlage für Betrug im Namen der App, und nebenbei
verbraucht es das Resend-Kontingent.

**Empfehlung:** stilllegen (410-Stub), wie in v30.18 und v30.95 mit den
anderen Einmal-Werkzeugen. Sollen Quittungen später wirklich verschickt
werden, gehört der Auslöser in den `stripe-webhook` — dort ist die Zahlung
durch Stripes Signatur belegt statt vom Aufrufer behauptet.
Analyse: `supabase/functions/send-receipt/BEFUND.md`.

**Ausgeliefert habe ich nichts.** Das Stilllegen ist ein Eingriff in die
laufende Auslieferung und gehört zu Fernando — wie die offenen Migrationen.

#### Befund 2 · Neun fest verdrahtete Modellnamen ohne Rückfall

| Funktion | Modell |
|---|---|
| `garden-scan-analyze`, `plan-iterate`, `plant-doctor-diagnose` (3×) | `claude-sonnet-4-20250514` |
| `i18n-translate` (2×), `mushroom-identify`, `pest-identify` | `claude-haiku-4-5-20251001` |
| `feedback-triage` | `claude-sonnet-4-6` |

Jede dieser Stellen nennt **einen** Namen. Fällt er weg, endet jeder Aufruf in
einem Fehler — und die Funktion hört still auf zu arbeiten.

**Das Frontend hat für genau diese Frage längst eine Kette**
(`index.html` ~Z. 27079: `sonnet-4-6` → `sonnet-4-5` → `sonnet-4-5-20250929`
→ `sonnet-4-20250514` → `3-5-sonnet`). Und **`book-ingest` macht es auch schon
richtig**: `CLAUDE_MODELS` als Liste, bei `404` das nächste, und erst wenn alle
scheitern eine Meldung. Die Vorlage liegt also im eigenen Repo.

**Was ich NICHT behaupte:** dass einer dieser Namen heute nicht mehr auflöst.
Von hier aus ist das nicht prüfbar — die Netz-Richtlinie lässt keine Anfrage
an Anthropic zu. Der Befund ist die **fehlende Kette**, nicht ein bewiesener
Ausfall.

#### Ein Fall, der sich nicht entscheiden lässt — und warum das der Punkt ist

`feedback_analysis` hat **0 Zeilen**, bei 2 Feedback-Einträgen (letzter vom
07.06.2026). Die Funktion wird von Hand ausgelöst. „Nie gedrückt" sieht damit
**genau gleich aus** wie „bricht jedes Mal ab". Ich kann es von hier aus nicht
unterscheiden und sage das, statt eine Zahl zu deuten.

Ein Knopfdruck würde es entscheiden.

#### Wo ich mich selbst korrigiert habe

Aus den Zeitstempeln schloss ich zunächst, sieben 410-Stubs lägen **nur** im
Repo und die gefährlichen Fassungen liefen weiter (Repo-Stub 28.08., letztes
Deployment 22.06.). Dann habe ich den **ausgelieferten Quelltext gelesen**: es
sind längst Stubs, seit v30.18. Der Repo-Kommentar war nur später erneuert
worden.

> Ein Zeitstempel sagt, wann etwas geschrieben wurde — nicht, was drinsteht.

#### `book-ingest`: dokumentiert statt gespiegelt

~250 sehr dichte Zeilen. Eine Handabschrift, die ich „wortgetreu" nenne und
die es an einer Stelle nicht ist, wäre schlechter als keine — sie sähe aus wie
eine Quelle und wäre keine. Stattdessen `BEFUND.md` mit Herkunft, Prüfsumme
und Bezugsanweisung.

`backend_check` hat dafür jetzt **drei** Zustände statt zwei: gespiegelt ·
dokumentiert (wird bei JEDEM Lauf namentlich genannt) · nichts (rot). Dieselbe
Bauweise wie bei den offenen Migrationen, aus demselben Grund: ein dauerhaft
roter Prüfstand wird ignoriert, ein stillschweigend grüner verschweigt.
**Gegenprobe:** `BEFUND.md` entfernt → sofort rot.

#### Nebenbei

Drei Verzeichnisse liegen im Repo, sind aber **nicht** (mehr) ausgeliefert:
`daily-push`, `entitlements`, `push-test`. Der Prüfstand nennt sie —
entweder nie deployed oder inzwischen entfernt, beides ist eine Frage wert.

Alle vierzehn Prüfstände grün.

### 2026-09-02 (de) — v32.18: ruft das Frontend etwas auf, das es nicht gibt?

Dreizehn Prüfstände fragen, was **im Browser** passiert. Keiner fragte nach der
Naht dahinter: die App spricht **97 RPCs** und **111 Tabellen/Views** in
Supabase an. Existiert jede davon?

Ein Aufruf ins Leere sieht nach nichts aus. PostgREST antwortet mit einem
Fehler, die App fängt ihn ab — und die Ansicht bleibt leer. Kein Absturz,
keine Meldung.

#### Gemessen (nur lesend gegen die Produktivdatenbank)

- **97 von 97 RPCs** existieren.
- **110 von 111 Tabellen/Views** existieren.
- Die eine Ausnahme: **`comment_reactions`**.

#### Und was dahinter steckt, war schon dokumentiert

`comment_reactions` trägt die Kommentar-Reaktionen aus v31.09 — Liken und
Disliken von Kommentaren, das Fernando ausdrücklich gewünscht hatte. Das
Frontend ist **fertig und vorbildlich gebaut**: es tastet die Tabelle ab und
rendert die Knöpfe gar nicht erst, wenn sie fehlt, statt sie sichtbar ins
Leere laufen zu lassen. Bei einem fehlgeschlagenen Schreibvorgang nimmt es die
optimistische Anzeige zurück, statt Erfolg zu behaupten.

Die Migration `20260831_community_reaktionen_v31_09.sql` liegt im Repo, ist
idempotent und hat saubere RLS. Sie ist **bewusst nicht angewandt** — STATUS.md
(y) führt sie in einer Liste offener Migrationen, eine frühere Session hat sie
gegen das Live-Schema vorgeprüft und die Anwendung ausdrücklich Fernando
überlassen.

**Ich habe sie nicht angewandt.** Eine gesetzte Grenze bleibt eine Grenze,
auch wenn man sie überschreiten könnte: DDL auf einer Produktivdatenbank mit
laufenden Zahlungen ist nichts, was nebenbei passiert.

#### Die Liste war an einer Stelle veraltet

Beim Nachmessen (alles lesend):

| Artefakt | STATUS (y) sagte | heute gemessen |
|---|---|---|
| `comment_reactions` + 2 Notify-Funktionen | nein | **weiterhin nein** |
| `daily_quizzes.image_url` | nein | **weiterhin nein** |
| Integritäts-Trigger auf `quiz_answers` | nein | **JA** — `trg_quiz_answers_verify` ist da |
| `fn_is_role`/`fn_role_at_least` für `anon` | offen | **weiterhin offen** |

Ein Rückstand, der „noch offen" sagt für etwas längst Erledigtes, kostet den
Nächsten Zeit. Zeile korrigiert.

#### `backend_check.js` — der vierzehnte Prüfstand

Er vergleicht nicht gegen die lebende Datenbank, sondern gegen eine
Momentaufnahme im Repo (`docs/backend-inventar.json`, 213 Objekte, einmal
lesend gezogen). Preis und Gewinn stehen im Kopf der Datei:

> **Preis:** die Momentaufnahme veraltet — deshalb nennt der Bericht IMMER ihr
> Datum. Eine Zahl ohne Datum wäre eine Behauptung.
> **Gewinn:** er läuft ohne Netz und ohne Zugangsdaten wie die anderen
> dreizehn — und VOR dem Ausliefern, nicht danach.

**Drei Klassen, nicht zwei** — das ist der Punkt, an dem so ein Prüfstand
sonst unbrauchbar wird:

- **rot** — angesprochen, existiert nicht, nichts vorbereitet.
- **offen** — existiert nicht, aber eine Migration liegt bereit. Kein Fehler
  im Code. Wird **namentlich** genannt, nie stillschweigend durchgewunken.
- **neu** — seit der Momentaufnahme dazugekommen; heisst: nachziehen.

Ohne die mittlere Klasse wäre `comment_reactions` dauerhaft rot, der Prüfstand
dauerhaft rot, und damit wertlos.

**Gegenprobe, beide Klassen:** eine erfundene Tabelle eingesetzt → rot mit
Namen. Einen RPC umbenannt → als „seit der Momentaufnahme dazugekommen,
noch niemand hat nachgesehen" gemeldet.

#### Was der Advisor sagt

**0 ERROR**, 144 Hinweise. Davon sind 136 das bewusste
SECURITY-DEFINER-RPC-Muster dieser App (jede solche Funktion wird generisch
gemeldet) — kein Fund. Die fünf Tabellen mit RLS ohne Policy habe ich einzeln
geprüft: vier werden nur serverseitig benutzt, `system_events` erreicht das
Frontend ausschliesslich über SECURITY-DEFINER-RPCs. Die Sperre ist dort also
richtig, nicht vergessen.

`fn_quiz_record_answer` ist für anonyme Aufrufer erreichbar — gelesen: sie
bricht bei `auth.uid() IS NULL` sofort ab. Ebenfalls kein Fund.

Alle vierzehn Prüfstände grün.

### 2026-09-02 (dd) — v32.17: 47 Texte konnten nie übersetzt werden

GreenScan führt fünf Sprachen. Die Übersetzungen liegen in Supabase und werden
über die **deutsche Phrase** nachgeschlagen:

```js
keyBundle[key] = srcMap[ GS_I18N_JS_STRINGS[key] ]
```

Daraus folgt eine Regel, die nirgends stand: **ein Schlüssel ohne Eintrag in
`GS_I18N_JS_STRINGS` wird nie nachgeschlagen.** Er zeigt in allen vier
Sprachen seinen deutschen Rückfalltext. Für immer, ohne Fehlermeldung, ohne
Lücke im Layout.

**45 solcher Schlüssel.** Darunter der komplette Bildschirm „Mein Naturjahr",
die Garten-Bibliothek und die Giftigkeits-Einstufungen.

#### Und der teuerste Teil daran

Von den ersten fünfzehn geprüften Phrasen sind **acht in der Datenbank längst
in allen vier Sprachen übersetzt** — „Alle", „Arten", „Scans", „Funde",
„Erfolge", „Streak", „Mein Naturjahr", „Einstufung offen". Die Arbeit war
getan und bezahlt. Gefragt hat nur nie jemand.

Das ist dieselbe Form wie der ganze Rest dieser Session: nicht fehlende
Arbeit, sondern **fertige Arbeit, die verstummt**.

#### Zwei Sonderfälle

- **`tasks_due_aria`** rief `_t(key, n === 1 ? 'Aufgabe fällig' : 'Aufgaben
  fällig')` — ein Schlüssel mit ZWEI möglichen deutschen Texten lässt sich
  nicht nachschlagen, weil das Sprachpaket über genau eine Phrase je Schlüssel
  gebaut wird. Jetzt zwei Schlüssel.
- **`btn_done`** trägt in der Tabelle „✓ Erledigt", die Aufrufstelle ist aber
  ein `aria-label` an einem Knopf, dessen sichtbarer Inhalt bereits „✓" ist.
  Ein Haken im Vorlesetext wäre Unsinn („Haken Erledigt"). Auch hier: ein
  eigener Schlüssel statt eines erzwungenen Kompromisses.

#### Drei Stellen, zwei Wahrheiten

Nachgeschlagen wird über den **Tabellen**wert; der Rückfall am Aufrufort
erscheint nur auf Deutsch. Wo beide auseinandergehen, liest ein deutscher
Nutzer einen anderen Satz als ein französischer:

| Schlüssel | Tabelle (übersetzt) | Aufrufort (nur Deutsch) |
|---|---|---|
| `garden_empty_title` | „Noch kein Garten" | „Noch kein Garten angelegt." |
| `voucher_redeem_msg` | „Gutschein-Code eingeben:" | „Gutschein-Code:" |

**Vor dem Ändern nachgesehen, welche Fassung übersetzt vorliegt:** die
Tabellenwerte haben alle vier Sprachen, die Aufrufvarianten **keine einzige**.
Also die Aufrufstellen angeglichen — die andere Richtung hätte drei
funktionierende Übersetzungen zerstört.

#### `i18n_check.js` — der dreizehnte Prüfstand

Sechs Fragen. Die zwei wichtigsten prüfen nicht den Quelltext, sondern die
**Schicht**: die App wird ein zweites Mal geladen, mit einem untergeschobenen
Sprachpaket im Cache, den sie beim Start ohnehin liest.

- Ein Schlüssel **mit** Übersetzung muss sie zeigen.
- Ein Schlüssel **ohne** muss sauber auf Deutsch zurückfallen — nicht den
  rohen Schlüsselnamen zeigen.

Ohne die zweite Richtung wäre eine Schicht, die alles auf den Schlüsselnamen
wirft, ebenfalls grün.

**Gegenprobe gemacht, beide Hälften:** einen Schlüssel aus der Tabelle
entfernt → Frage 1 rot. Den Paket-Zugriff gekappt → Frage 5 rot („liefert
„Plan" statt der Übersetzung — die Schicht trägt nicht").

#### Was er bewusst nicht prüft

Ob die Übersetzung in der Datenbank **existiert** und ob sie **gut** ist. Das
braucht Netz und einen Menschen, der die Sprache spricht. Er prüft, ob eine
vorhandene Übersetzung überhaupt ankommen **kann**.

#### Nebenbei gemessen (einmalig, über die Datenbank)

2'041 Phrasen für EN/ES, 2'050 für FR/IT, keine leeren Übersetzungen. Die App
verwendet 1'641 verschiedene deutsche Phrasen. Der genaue Abgleich beider
Mengen ist **nicht** Teil des Prüfstands — er bräuchte Netz.

Alle dreizehn Prüfstände grün.

### 2026-09-02 (dc) — v32.16: 213 Stellen waren nur mit der Maus erreichbar

Elf Prüfstände messen, ob die App **aussieht** wie gedacht, ob sie **rechnet**
wie behauptet und ob sie **speichert**, was sie zusagt. Keiner fragte, ob man
sie überhaupt bedienen kann, wenn man sie nicht sieht oder die Maus nicht
benutzt. `a11y_check.js` ist der zwölfte.

#### Was gut war — und deshalb genannt gehört

`<html lang="de">` gesetzt · keine doppelten ids · **0** Knöpfe ohne Namen ·
**0** Bilder ohne `alt` · **0** Knöpfe, deren einziger Name ein Emoji ist.
Ein Prüfstand, der nur Fehler zeigt, verzerrt das Bild.

#### Der Fund

**18 Stellen im Code, 213 Elemente auf dem Bildschirm** tragen ein `onclick`
auf einem `div` oder `span` — ohne `tabindex`, ohne `role`. Für die Maus ein
Knopf. Für die Tastatur unsichtbar: kein Fokus, kein Enter, und ein
Screenreader liest es als gewöhnlichen Textblock.

Betroffen war der **Inhalt**, nicht die Ränder: 81 Suchergebnisse, 40 Rezepte,
40 Heilmittel, die Startseiten-Kacheln, die Garten-Karten, die Upload-Zone.
Wer die App mit Tastatur oder Schalter bedient, kam an nichts davon heran.

Beide Zahlen stehen im Bericht, und das ist Absicht: eine Karten-Vorlage
erzeugt vierzig Karten, und **eine** Reparatur behebt sie alle. Nur „18" zu
melden verharmlost, nur „213" lässt es unlösbar aussehen.

#### Eine Regel statt achtzehn Pflaster

Achtzehn Einzelfixes hätten die nächste Renderstelle nicht erfasst. Also eine
zentrale Nachrüstung (`gsTastaturNachruesten`) plus **ein** Zuhörer für Enter
und Leertaste, gehalten von einem `MutationObserver`. Sie unterscheidet zwei
Fälle:

| | |
|---|---|
| ohne innere Bedienelemente | der Kasten **selbst** wird zum Knopf |
| mit inneren Bedienelementen | ein Knopf im Knopf wäre falsch → die **Überschrift** darin wird fokussierbar; ihr Klick steigt ohnehin zum Kasten auf |

Findet sich keine Überschrift, bleibt es liegen und der Prüfstand meldet es
weiter. Lieber eine offene Zeile im Bericht als eine stille Halbheit.

Dazu ein sichtbarer Fokusrahmen (`:focus-visible`, erscheint **nur** bei
Tastatur-Bedienung) und drei fehlende Namen (zwei Marktplatz-Auswahlfelder,
der Profil-Kreis der Community).

#### Und drei Fehler, die ich selbst gemacht habe

1. **Reparatur und Prüfung hatten zwei verschiedene Regeln.** Der Prüfstand
   meldete danach 80 Karten als unerreichbar, die längst erreichbar waren —
   weil er nur auf den Kasten sah und nicht auf den fokussierbaren Titel
   darin. Dieselbe Falle wie die zwei Matcher in v32.02, nur diesmal von mir
   gebaut. Der Prüfstand prüft jetzt die **Struktur** (`tabindex` + `role`),
   nicht ein Merkmal, das die App sich selbst anheftet — `data-tast` wäre
   bloss eine Selbstauskunft.
2. **„Hat einen Schatten" ist kein Nachweis für einen Fokusrahmen.** Karten
   und Knöpfe dieser App haben ohnehin einen. Gemessen wird jetzt der
   **Unterschied** zwischen fokussiert und nicht fokussiert.
3. **`touch_check` sprang von 0 auf 79** — alle 79 waren Rezept- und
   Heilmittel-Titel mit `352×18`. Sie sind **Tastatur**-Ziele; angetippt wird
   die ganze Karte. WCAG 2.5.8 meint die Fläche, die den Zeiger annimmt.
   `touch_check` kennt das jetzt — aber **eng**: der erste Anlauf war zu
   grosszügig und hätte auch ein echtes kleines Herz-Symbol in einer Karte
   durchgewinkt. Gegenprobe mit drei Fällen: 10×10-Knopf frei → gemeldet ·
   derselbe Knopf in einer 300×80-Karte → gemeldet · Titel-Div mit
   `role="button"` darin → still.

#### Verhalten, nicht nur Struktur

Ein `tabindex` kann dastehen und ins Leere führen. Zwei Fragen drücken
deshalb **wirklich** die Taste — mit einem echten Tastendruck des Browsers:

```
ok   Enter öffnet: Rezeptkarte (über den Titel)   [Bärlauch-Pesto → Ansicht öffnet]
ok   Enter öffnet: Suchergebnis (Karte selbst)    [Abbiß · Succisa australis → Ansicht öffnet]
ok   Der Fokus ist sichtbar                       [Rand +2px gegenüber unfokussiert, zusätzlicher Ring]
```

Gegenprobe: Nachrüstung ausgebaut → **16 Stellen / 211 Elemente**, und beide
Enter-Proben melden „kein fokussierbares Element gefunden".

#### Aufwand

Der erste vollständige Durchgang kostet auf einem Mittelklasse-Telefon rund
**35 ms** (`perf_check`). Er läuft deshalb in einer ruhigen Minute
(`requestIdleCallback`), nicht beim Start — ein paar hundert Millisekunden
später merkt niemand, ein ruckelnder Start schon.

Alle zwölf Prüfstände grün.

### 2026-09-02 (db) — v32.15: der Kartenspeicher hatte keine Obergrenze

Die Frage, mit der ich in diese Ecke ging, war: **verspricht die App eine
Karte ohne Empfang?** Antwort: nein. Die einzige Stelle, an der „Offline-
Karten" steht, handelt von SchweizMobil, nicht von GreenScan. Kein
gebrochenes Versprechen — Fall geschlossen.

Beim Nachsehen fiel aber etwas anderes auf. Regel 4 des Service Workers legt
**jedes** Bild in den `IMAGE_CACHE`, und dazu gehören die Kartenkacheln:
swisstopo (`wmts.geo.admin.ch`) steht auf keiner Ausnahmeliste, OpenStreetMap
schon. Eine Wanderung auf Zoomstufe 16 zieht schnell Tausende davon.

**Eine Obergrenze gab es nicht.** Geleert wurde der Cache nur durch einen
Versionswechsel — `activate` löscht jeden Cache, dessen Name nicht zur
laufenden Version gehört. Das ist Zufall, kein Entwurf: bei einer ruhigen
Woche wächst er ungebremst weiter.

**Warum das mehr ist als Speicherplatz:** geht der Platz aus, räumt der
Browser auf — und mancher räumt den **ganzen Ursprung** ab, also auch
`localStorage`. Dort liegt der Garten-Zwilling, das Ernte-Log, die
Einstellungen. Der grösste unbegrenzte Verbraucher gefährdete damit den
wertvollsten Speicher. Dieselbe Sorgfalt, die diese App seit v30.98 den 5 MB
localStorage widmet, hatte die Cache-API nie bekommen — obwohl sie um
Grössenordnungen mehr fasst.

#### Der Deckel ist ein Ziel, keine Schranke — und das steht dabei

500 Einträge, nachgesehen alle 50 Bilder. Bei jedem einzelnen `keys()`
aufzurufen kostet mehr, als es bringt. Die echte Obergrenze ist deshalb
`ZIEL + INTERVALL` plus das gerade Unterwegse — und genau so ist es im Code
benannt (`IMAGE_CACHE_MAX`, `IMAGE_CACHE_INTERVALL`), statt eine Schärfe zu
behaupten, die es nicht gibt.

Der erste Anlauf hat mich das gelehrt: der Prüfstand holte 560 Kacheln und
meldete 516 — rot, obwohl der Deckel arbeitete. Die Zahl war richtig, die
**Erwartung** war falsch.

#### Gefahren, nicht behauptet

Der Fall holt **900 Kacheln wirklich durch den Service Worker** (der
Prüfserver liefert dafür synthetische 1×1-PNGs unter `/__kachel/<n>.png`),
statt den Cache von aussen zu füllen. Nur so ist auch geprüft, dass der
Deckel überhaupt **ausgelöst** wird.

- mit Deckel: **900 geholt → 507 im Cache**
- Gegenprobe ohne Deckel: rot

#### Ehrlich zur Grenze

Wie gross der Cache in der Praxis wirklich wird, ist von hier aus **nicht
messbar** — die Kachel-Server sind aus dieser Umgebung nicht erreichbar
(`CONNECT … 403`). Geprüft ist der **Mechanismus**, nicht die Zahl. Der
Deckel ist deshalb bewusst grosszügig gewählt (~17 MB bei 35 KB je Kachel).

`offline_check`: **10 Fragen, 0 rot.**

### 2026-09-02 (da) — v32.14: das Aufräumen löschte, was es hätte hochladen sollen

Direkt aus dem Prüfstand von v32.13 heraus gefunden. Beim Lesen von
`gsFlushOfflineQueue` fiel eine Zeile auf, die zu weit greift:

```js
for (var i = 0; i < STORES.length; i++) {        // ← ALLE fünf Ablagen
```

`STORES` ist die Liste der Ablagen, die `_open()` **anlegen** muss. Zwei davon
gehören diesem Flush aber gar nicht:

| Ablage | Zuständig | Was geschah |
|---|---|---|
| `pending_photos` | `gsFlushPhotoQueue` (Upload, Versuchszähler) | gelöscht, bevor je hochgeladen |
| `dropped_entries` | **niemand** — Archiv aus v31.08 | 3,5 s nach jedem Start geleert |

Beide Satzarten tragen kein `type`-Feld. Sie fielen deshalb in den generischen
Zweig, bekamen `ok = true` und wurden entfernt.

**Und die Reihenfolge machte es sicher, nicht zufällig:**

- Wieder online: `gsFlushOfflineQueue` nach **800 ms**, `gsFlushPhotoQueue`
  nach **1400 ms**.
- Beim Start: **3500 ms** gegen **4200 ms**.

Der falsche Flush war also immer 600 Millisekunden schneller. Wer ohne Empfang
ein Foto aufnahm, verlor es beim nächsten Start — und im Eintrag blieb ein
`gsphoto://<id>`, das auf nichts mehr zeigte.

Beim Archiv war es noch stiller: es ist das Sicherheitsnetz für gekürzte
Listen (Gartentagebuch, Pflege-Historie, Gartenpläne, GPX-Tracks), gebaut in
v31.08 mit genau der Begründung, dass nichts mehr lautlos verschwinden soll.
Danach meldete `gsArchiveCount()` **0** und der Export sagte „Archiv ist leer".

#### Gemessen, nicht vermutet

`offline_check` reiht wirklich ein Foto und zwei Archiv-Einträge ein, räumt
auf und zählt nach:

```
!!   Ein offline eingereihtes Foto überlebt den Flush
       → von 1 Foto(s) sind nach dem Flush 0 übrig
!!   Das Archiv gekürzter Einträge überlebt den Flush
       → von 2 archivierten Einträgen sind 0 übrig (gsArchiveCount meldet 0)
```

#### Die Reparatur

`SYNC_STORES = ['pending_scans', 'pending_diary', 'pending_sync']` — der Flush
läuft nur noch über die drei, die er auch übertragen kann. `STORES` bleibt
vollständig, weil `_open()` es braucht.

#### Und eine Frage, ohne die die anderen zwei wertlos wären

Dass ein Foto den Flush **überlebt**, heisst noch nicht, dass es je ankommt —
liegen bleiben täte es auch, wenn niemand es abholte. Also eine neunte Frage:
`gsFlushPhotoQueue` mit gestelltem `gsUploadImage` laufen lassen und prüfen,
dass es **hochlädt und erst dann räumt**. Ergebnis: `1× hochgeladen
(scans/find:test-1), Warteschlange danach leer`.

Dazu die Gegenprobe in die andere Richtung: ein übertragener Scan **muss**
verschwinden (`1 eingereiht → 0 übrig`). Ohne den wären die zwei neuen Fragen
auch dann grün, wenn man den Flush ganz entfernte.

`offline_check`: **9 Fragen, 0 rot.**

### 2026-09-02 (cz) — v32.13: ohne Empfang standen 0 von 4'342 Arten zur Verfügung

Der teuerste Fund dieser Woche, und er lag nicht im Code, den ich gerade
geschrieben habe, sondern in einem Versprechen, das seit Jahren niemand
nachgemessen hat.

GreenScan ist eine PWA. Ihr ganzer Sinn ist Wald und Wiese — genau dort, wo
es keinen Empfang gibt. Der Service Worker lädt beim Installieren 23 Dateien
aufs Gerät, darunter die **2,1 MB Artenliste**, mit dem ausdrücklichen
Kommentar im Code: „damit App offline mit voller Pflanzen-DB funktioniert
(sonst nur leere DB)".

**Sie funktionierte nicht.** Gemessen: `0 von 4'342 Arten`.

#### Warum

`/data/plants.v1.js?v=1` fiel unter die Default-Regel des `fetch`-Handlers —
`networkFirst(req, RUNTIME_CACHE)`. Vorgeladen wurde sie in den
**SHELL_CACHE**, und dort hat sie niemand je gesucht. Der Runtime-Cache war
leer, weil der Service Worker beim **ersten** Besuch erst während des Ladens
installiert wird: die Unterdateien der Seite holt der Browser da noch ohne
ihn.

Wer die App also installierte und dann in den Wald fuhr, hatte eine App, die
startete, die Version anzeigte, die Oberfläche aufbaute — und keine einzige
Art kannte. Kein Absturz, keine Meldung. Und melden kann es dort niemand.

Dasselbe galt für Leaflet, Three.js und die Symbole.

#### Die Reparatur

- **`ausShell(req)`** — der letzte Ausweg für **jede** Strategie
  (`networkFirst`, `cacheFirst`, `staleWhileRevalidate`). Was vorgeladen
  wurde, wird auch gefunden, egal wo die Strategie zuerst gesucht hat.
- **Regel 3b: vorgeladene Dateien → `cacheFirst(SHELL_CACHE)`.** Die grossen
  unveränderlichen Brocken kommen sofort aus dem Vorrat statt über einen
  Netz-Versuch, der erst ablaufen muss. Aktuell gehalten werden sie über den
  Cache-**Namen**: er trägt die Version, und `activate` löscht jeden Cache,
  der nicht zur laufenden gehört.
- Nebenbei **2,9 MB** gespart: Artenliste, Leaflet und Three.js lagen doppelt
  auf dem Gerät (Shell **und** Runtime).

#### `offline_check.js` — der elfte Prüfstand

Fünf Fragen: installiert sich der Service Worker · enthält der Shell-Cache,
was `SHELL_URLS` verspricht · liegt etwas doppelt · startet die App ohne Netz
· überlebt eine vorgeladene Datei die Verdrängung des Runtime-Caches.

Er braucht als einziger einen **eigenen HTTP-Server** (30 Zeilen, kein
Paket): ein Service Worker läuft nur in einem sicheren Kontext, `file://` ist
keiner. Und er geht **wirklich** offline — `setOffline(true)` plus Server zu.

**Reihenfolge eingehalten:** erst der Prüfstand, dann der Fund (2 von 5 rot),
dann die Reparatur, dann grün.

#### Und ein Fehler im Prüfstand selbst, gleich im ersten Lauf

Die Doppelspeicher-Frage war grün — **auch mit ausgebauter Weiche**. Sie lief
vor dem zweiten Besuch mit Netz, und ohne den kann gar keine zweite Kopie
entstehen. Sie prüfte also nur, dass nichts passiert.

Nach dem Umbau (zweiter Besuch **mit** Netz, dann zählen) meldete sie sofort:
`4× doppelt: leaflet.js · leaflet.css · three.min.js · plants.v1.js?v=1, je
in gs-v32.13-shell + gs-v32.13-runtime`.

> Dieselbe Lehre wie in v32.07: **ein Fall, der den Zustand nicht herstellt,
> beweist nichts.**

### 2026-09-02 (cy) — v32.12: der Scanner sieht selbst hin, bevor die KI antwortet

v32.11 war die optische Hälfte von Fernandos „BOOOOOOM". Das hier ist die
funktionale: zwischen Foto und Antwort arbeitet die App jetzt **selbst**.

Bis hierher stand zwischen „Ort und Jahreszeit" und dem langen KI-Aufruf
nichts als ein Cache-Blick. Die Wartezeit war ehrlich, aber leer — und das
war eine verpasste Gelegenheit: die App hat 4'342 kuratierte Arten und ein
Foto, aus dem sich etwas ausrechnen lässt.

#### Zwei Vorgänge, beide gerechnet

- **`gsBildFarben(quelle)`** — HSV-Klassierung auf 96×72 px, deutsche
  Farbnamen im Vokabular der Artenliste. HSV, weil Blüten unter Schweizer
  Licht in RGB wandern: dieselbe gelbe Blüte ist im Schatten `#8a7a10` und in
  der Sonne `#ffe94a` — der Farbton bleibt beide Male bei ~52°. Dunkles
  Orange (`v < 0,55`) gilt als **Braun**; ohne diese eine Zeile wäre jeder
  Waldboden eine gelbe Blüte.
- **`gsScanVorauswahl(ctx, farben)`** — grenzt aus Monat, gemessener Farbe
  und Höhenlage ein, welche Arten hier und jetzt überhaupt in Frage kommen.
  Im Januar: **4'342 → 2'087**.

Beide erscheinen als eigene Schritte in der Liste, mit ihrem echten Ergebnis
— beim Farb-Schritt zusätzlich als Farbtupfen. Die Tupfen stehen **neben**
der Zahl, nie statt ihr: wer Farben nicht unterscheidet, läse sonst nichts.

#### Die eine Entscheidung, an der alles hängt

**Das Ergebnis geht NICHT in den Prompt.**

Es wäre leicht gewesen, „Farbanteile: Gelb 25 %" und „diese 2'087 Arten
kommen in Frage" mitzuschicken — das klingt nach besserer Genauigkeit. Es ist
das Gegenteil. Ein Modell, dem man die eigene Vorauswahl zeigt, bestätigt
sie; die spätere Gegenprüfung wäre dann ein Echo und keine Prüfung. Der ganze
Wert liegt in der Unabhängigkeit.

`scan_check` hält das fest — der Fall liest den echten Prompt aus einem
vollen `analyzeImage`-Durchlauf **und** prüft, dass beide Schritte trotzdem
gelaufen sind. Ohne die zweite Hälfte prüfte er nur, dass nichts passiert.

#### Drei Prädikate, je eine Quelle

`_gsPasstMonat` · `_gsPasstFarbe` · `_gsPasstHoehe` werden von zwei Seiten
gebraucht: von den Prüfregeln (die EINE Art) und von der Vorauswahl (alle
4'342). Zwei Rechnungen für dieselbe Frage driften auseinander — genau der
Fehler aus v32.02.

Jedes hat **drei** Rückgaben, und `null` ist nicht `false`:

> Die Vorauswahl schliesst nur aus, was sich **begründen** lässt.

3'465 der 4'342 Arten haben keine Höhenangabe. Würde `null` wie `false`
wirken, bliebe ein Fünftel übrig und die Zahl daneben wäre eine Lüge.
**Gegenprobe gemacht:** `null` → `false` geändert, der Prüfstand meldete
sofort („Arten ohne Höhenangabe wurden auf 3000 m ausgeschlossen").

#### Zwei neue Prüfregeln — und eine, die bewusst keine ist

- **S6 · Farbe.** Erfüllt ab 5 % der hinterlegten Farbe im Foto. Vorbehalt
  nur, wenn davon **nichts** da ist UND eine fremde Farbe ≥ 12 % überwiegt.
  Sonst „nicht prüfbar" — ein reines Blattfoto sagt weder ja noch nein.
- **S7 · Höhenlage.** Nur mit Standort UND hinterlegtem Höhenband, Toleranz
  200 m (Verbreitungsangaben sind gerundet).
- **Die Vorauswahl ist KEINE Regel.** Eine Art fällt genau dann heraus, wenn
  Monat, Farbe oder Höhe sie ausschliessen — dafür gibt es S3, S6 und S7. Als
  vierte Regel gezählt, stünde derselbe Einwand zweimal in der Bilanz. Sie
  steht deshalb als **Beleg** unter den Regeln.

#### Was der Kontrast-Prüfstand nebenbei fand

Die neue Vorauswahl-Zeile macht die Karte höher — und dadurch rutschte der
Knopf „Gegenprobe starten" erstmals in den vermessenen Bereich. Er stand seit
v32.10 mit **weisser Schrift auf `--c-danger-d`** da, im Dunkelmodus hellrot:
**2,15:1**. Dieselbe Falle wie bei `.gs-btn-info` in v31.20 — ein `-d`-Token
ist eine **Text**farbe, keine Füllung. Jetzt fest `#b71c1c` (6,6:1 in beiden
Modi).

Beim Nachsehen fiel eine Zeile höher dasselbe auf, und die sieht der
Prüfstand **nicht**: die Häkchen der Schrittliste sind ein Hintergrundbild,
keine Textstelle. Weiss auf `#a5d6a7` sind 1,64:1 — im Dunkelmodus war dort
ein leerer Kreis. Dunkelmodus-Füllung nachgezogen.

**Die Lehre, und sie gilt über diesen Fall hinaus:** ein Prüfstand misst, was
er **erreicht**. Wächst eine Karte, wächst sein Blickfeld — ein Fund kann
also einen Fehler betreffen, der lange vorher entstanden ist. Und was gar
keine Textstelle ist (Hintergrundbilder, SVG, `::before`-Inhalte), sieht er
nie.

#### Aufwand und Zahlen

- Farbmessung **1,5 ms**, Vorauswahl über alle 4'342 Arten **6,1 ms** (Mittel
  aus fünf Läufen, ungedrosselt). Budget im Prüfstand: 20 bzw. 60 ms.
- `scan_check` **46 Fälle, 0 kaputt** (vorher 36). Neu: Farbmessung
  (gut/schlecht/nicht messbar), S6, S7, Vorauswahl (drei Fälle),
  Unabhängigkeit, Aufwand.
- Alle zehn Prüfstände grün: `contrast_check` 0/0 über fünf Fenster,
  `touch_check` 0/0, `wiring_check` 0 kaputt, `data_check` 0 Zugriffe ins
  Leere, `save_check` 13/13, `planer_check` 22/22, `render_check` 0
  verdächtige Textstellen.
- Nebenbei: die Inline-Changelog-Liste war wieder auf 21 Einträge (31 KB)
  gewachsen. Die ältesten 9 sind ins Archiv gewandert — 12 inline, 448 im
  Archiv, **0 Löcher, 0 Doppelte**, Naht durchgehend (v32.02 → v32.01 →
  v32.00 → v31.99).

### 2026-09-02 (cx) — v32.11: ein Drahtgitter, das die Blätter kennt

Fernando wollte einen Wow-Effekt — „Brainfuck und Brainmelting". Der billige
Weg wäre mehr Glühen und mehr Partikel gewesen; das sieht drei Sekunden lang
gut aus. Was hängen bleibt, ist etwas anderes: **dass die App sichtbar
versteht, was sie ansieht.**

#### Aus Punkten wird eine Struktur

`_gsScanStruktur` liefert drei Dinge statt einem:

- **Punkte** — die Kanten aus dem Foto (v32.08).
- **Kanten** — welche Punkte benachbart sind, über ein Raster statt über alle
  Paare (bei 900 Punkten wären das sonst 810'000 Vergleiche). Daraus wird ein
  Drahtgitter, das der Form folgt statt sie zu überziehen.
- **Fokuszonen** — die Zellen mit der höchsten Kantendichte. Blattspitzen,
  Aderkreuzungen, der Stielansatz. Dort rastet der Scanner ein.

Gemessen: **732 Knoten · 1'097 Linien · 4 Fokuszonen** auf einem gezeichneten
Blatt, **nichts auf einer leeren Fläche**. Jede Linie kürzer als die
Nachbarschaftsreichweite (sonst ginge das Netz quer durchs Bild), keine zwei
Ringe übereinander.

#### Drei Phasen an drei echten Vorgängen

`tasten` während Bildprüfung und Kontext · `netz` während die KI rechnet, so
lange wie sie braucht · `treffer` wenn die Antwort da ist. **Kein Timer
erfindet einen Fortschritt** — `gsScanPhase()` wird aus dem echten Ablauf
gerufen, und ein Prüffall hält fest, dass beim KI-Aufruf wirklich `netz` läuft.

#### Die Enthüllung

Ring zählt von 0 hoch, Merkmale erscheinen nacheinander, Prüfregeln haken der
Reihe nach ab — in derselben Reihenfolge, in der sie gerechnet wurden.

#### Zwei Anläufe, derselbe Fehler — und die Regel daraus

1. `opacity:0` per Klasse, per Timer wieder weggenommen. Fällt der Timer aus,
   bleibt die Zeile **für immer unsichtbar**. `contrast_check`: **1:1**.
2. `animation … both` mit `from{opacity:0}`. Läuft die Animation nie — etwa
   weil das Element beim Rendern in einem verborgenen Bereich liegt — gilt der
   `from`-Zustand weiter. `scan_check`: **„5 von 5 Zeilen bleiben unsichtbar"**.

> **Inhalt, auf den es ankommt, wird nie NACH UNSICHTBAR animiert.**

Jetzt bewegt sich die Zeile und bekommt kurz einen farbigen Grund — sichtbar
in jedem Zustand, auch wenn gar nichts läuft. Der Prüffall misst das
ausdrücklich **zu Beginn** der Animation, nicht erst am Ende.

#### Leistung gemessen, nicht gehofft

Bei 6-facher Drosselung: Struktur einmalig **36 ms**, ein Bild **1,0 ms** —
also rund 6 % des Bildbudgets bei 60 Bildern/s.

#### Prüfstände

`scan_check` **36/36** (drei Fälle mehr) · `contrast_check` fünf Fenster, 0/0 ·
alle übrigen grün.

---

### 2026-09-02 (cw) — v32.10: Scanner V3 Stufe 3 — die Gegenprobe

Der gefährlichste Fall, den dieser Scanner kennt: die Bestimmung sagt
**essbar**, und eine der Verwechslungsmöglichkeiten ist **giftig**. Bärlauch
gegen Herbstzeitlose ist genau das.

**Die Idee ist die Umkehrung des Auftrags.** Der erste Aufruf soll bestimmen;
der zweite soll **widerlegen**. Ein Modell, das man bittet, seine eigene
Antwort zu bestätigen, bestätigt sie fast immer — deshalb bekommt der zweite
Aufruf die erste Bestimmung als **Behauptung** vorgesetzt, samt der genannten
Alternativen und Merkmale, und den ausdrücklichen Auftrag, dagegen zu
argumentieren.

**Sie läuft nicht von selbst.** Sie kostet einen weiteren Aufruf aus dem
Tageskontingent *des Nutzers*, und darüber entscheidet der Mensch. Der Knopf
sagt beides: warum es sich lohnt und was es kostet.

Drei Ausgänge, alle mit klarer Ansage:
- **bestätigt** → „Zwei unabhängige Blicke, dasselbe Ergebnis" — und
  ausdrücklich: **ein Beweis ist es nicht.**
- **widerlegt** → „☠️ Der zweite Blick WIDERSPRICHT. **Iss das nicht.**"
- **unsicher** → bei giftiger Verwechslung heisst das: nicht verzehren.
- **Aufruf gescheitert** → gesagt, nicht überspielt; die Unsicherheit bleibt
  stehen, mit einem Weg zum zweiten Versuch.

#### Nebenbei: `_altTox` war eine Kopie zu viel

Sie lag als lokale Funktion in `showScanResult` und wurde nach der Stelle
berechnet, an der die Gegenprobe-Karte sie braucht — die Reihenfolge-Falle aus
v31.90. Jetzt `_gsAltTox`/`_gsAltGefahr` oben, **eine** Funktion für beide.

#### Drei unlesbare Gift-Plaketten

Der neue Kontrast-Fall (fünftes Fenster) brachte sie ans Licht: „Ungiftig"
**2,55:1**, „Leicht giftig" **1,85:1**, „Mässig giftig" **2,81:1**. In v31.99
hatte ich nur die tödliche Stufe repariert; die anderen kamen nie in ein
gemessenes Fenster. **Diesmal alle sechs ausgerechnet statt abgewartet** —
WCAG-Leuchtdichte, direkt im Terminal, statt auf einen Prüfstand zu warten,
der immer nur eine Stufe rendert.

#### Prüfstände

`scan_check` **33/33** — fünf Fälle mehr: wann die Gegenprobe erscheint (vier
Kombinationen), dass der Auftrag „widerlegen" lautet und die Bestimmung als
Behauptung vorliegt, dass Widerspruch „iss das nicht" sagt, dass Einigkeit
**nicht als Beweis** verkauft wird, und dass ein gescheiterter Aufruf die
Unsicherheit stehen lässt. `contrast_check` misst jetzt **fünf** Fenster, 0/0.

---

### 2026-09-02 (cv) — v32.09: der Zurück-Knopf führt ins Hauptmenü

Fernando: „Zurück zum Scanner gibt es ja schon, lieber ein Zurück ins
Hauptmenü." Stimmt — `gsResetScanner()` ist genau das, und „📸 Neues Foto"
steht ohnehin auf der Karte.

- Links **☰ Hauptmenü** → `gsScanZumMenue()`: schliesst das Ergebnis **und**
  öffnet das Menü.
- Rechts **✕** → `gsResetScanner()`: zurück zum Scanner.

`gsResetScanner()` läuft in beiden Fällen zuerst. Das startet die Kamera wieder
— kostet einen Moment, ist aber richtig: wer das Menü gleich wieder zumacht,
stünde sonst vor einem toten Sucher.

Der Prüffall dazu klickt jetzt **beide** Knöpfe und prüft, dass jeder das Seine
tut — vorher hätte ein Knopf, der ins Leere führt, nicht auffallen können.

---

### 2026-09-02 (cu) — v32.08: Zurück-Knopf, Scangitter auf der echten Pflanze, Schrittliste

Drei Wünsche von Fernando, und der dritte hat eine Vorgeschichte.

#### 1 · Der Weg zurück

„Ich komme eben nicht ins Menü zurück, sobald ein Resultat aufplopt." Stimmt:
`#scan-result` legt sich über den Scanner, und der einzige Ausweg lag **ganz
unten** hinter Alternativen, Steckbrief, Merkmalen und Prüfung. Jetzt eine
`position:sticky`-Leiste zuoberst, die `gsResetScanner()` ruft — die Funktion
gab es längst. **Nur beim Ergebnis**, wie gewünscht: sie steht in
`showScanResult` und nirgends sonst.

#### 2 · Das Gitter wird gerechnet, nicht gemalt

„Der Scan soll die Pflanze quasi benetzen … man soll visuell dieses Scangitter
sehen, wie es die Blätter analysiert, den Stiel."

Ein hübsches Gitter über dem Bild wäre wieder eine Behauptung — es läge über
der Pflanze, ohne sie zu kennen. Stattdessen: **Sobel-Kantenfilter auf dem
eigenen Foto** (160 px, ~15 ms, einmal). Was herauskommt, sind die
Blattränder, Blattadern, der Stiel und der Blütenumriss. Der Lichtbalken fährt
darüber und lässt sie aufleuchten und verglimmen.

Belegt: **1'427 Kantenpunkte** auf einem gezeichneten Blatt, **0** auf einer
leeren Fläche. Es folgt der wirklichen Pflanze, und wo keine ist, erscheint
nichts.

#### 3 · Die Schrittliste — und warum sie diesmal darf

⚠️ **Genau so eine Liste hat v31.79 entfernt.** Sie zählte fünf Schritte
herunter, während die App auf EINEN Netzaufruf wartete. Nichts geschah in dem
Moment, in dem es behauptet wurde.

Sie kommt zurück, aber jeder Schritt findet wirklich statt und **jedes Ergebnis
ist gemessen**:

| Schritt | Ergebnis |
|---|---|
| 📷 Bild geprüft | „Schärfe 72 · Licht 80" (gemessen) |
| 🗺️ Ort und Jahreszeit | „Juli · Sommer · Kanton UR · aus dem Foto" |
| 💾 Scan-Speicher | „kein Treffer" / „Treffer — kostet kein Kontingent" |
| 🌐 Die KI vergleicht | läuft, `N s` → „Antwort nach 7 s" |
| 🔍 Gegenprüfung | „5 Regeln · 1 Vorbehalt" |

Das ist **besser** als die alte Liste: sie zeigt nicht, was gerade behauptet
wird, sondern was herausgekommen ist.

#### Ein eigener Fehler, vom Kontrast-Prüfstand gefunden

`li.offen{opacity:.45}` machte die noch offenen Schritte unlesbar — **2,43:1
hell, 3,51:1 dunkel**. Statt den Text zu dimmen jetzt `var(--muted)`; der leere
Kreis links sagt ohnehin, dass ein Schritt noch nicht dran war.

#### Prüfstände

`scan_check` **28/28** — fünf Fälle mehr, darunter ein **Durchlauf durch
`analyzeImage`** mit gestelltem Netz: der KI-Schritt muss während des Aufrufs
als laufend markiert sein, die zwei davor abgehakt und mit echten Werten
gefüllt, die Gitter-Leinwand über dem Foto liegen, und danach die
Zurück-Leiste stehen.

`contrast_check` misst jetzt **vier** Fenster — die Analyse-Ansicht kam dazu.
0/0 in beiden Modi. Alle übrigen grün.

---

### 2026-09-02 (ct) — v32.07: ein Knopf lag 38 px ausserhalb des Bildschirms

Keiner der neun Prüfstände fragte bisher, ob etwas **seitlich aus dem Bild
ragt**. Auf 412 px gemessen: fünf Tabs melden etwas, die Seite scrollt aber
nirgends waagrecht.

- **Vier davon sind Falschmeldungen** — die grossen Emoji-Wasserzeichen hinter
  den Überschriften (Wissen, Rezepte, Heilmittel, Community) liegen mit
  `position:absolute` absichtlich über dem Rand. Genau die Sorte, vor der
  CLAUDE.md §7.1 warnt.
- **Einer ist echt:** „↻ Zurücksetzen" im Marktplatz, im normalen Fluss,
  `left 353 → right 450`. 38 px der Antippfläche ausserhalb, Beschriftung
  abgeschnitten. Die Filterzeile war eine Flex-Zeile ohne Umbruch.

#### Der Umweg, den ich dabei genommen habe

Zwei Debug-Skripte massen den Knopf bei 396 px — **innerhalb**. Ich habe daraus
geschlossen, der Fund sei ein Artefakt, und die Änderung **zurückgenommen**
(nach der Lehre aus v31.76: nichts ändern auf einem nicht reproduzierbaren
Messwert). Danach meldete `touch_check` gegen die zurückgesetzte Datei prompt
wieder „38px draussen".

Die Skripte waren unzuverlässig, nicht die Messung. Der saubere Beleg ist ein
Dreifach-Durchlauf durch **dasselbe** Instrument: **ohne Fix 1 · mit Fix 0 ·
wieder ohne Fix 1.**

**Die Lehre:** ein ad-hoc-Skript ist kein Gegenbeweis zu einem gegengeprüften
Prüfstand. Wer widersprechende Messungen hat, misst beide Stände mit
demselben Werkzeug — nicht mit dem jeweils bequemeren.

#### `touch_check` bekommt eine zweite Frage

Ein Knopf halb ausserhalb ist so unerreichbar wie einer mit 8×8 px — dieselbe
Frage, andere Ursache. Gemeldet wird **nur, was im normalen Fluss liegt**;
`position:absolute` ist ausgenommen, und zwar nach einer Regel, nicht nach
einer Liste.

**Gegenprobe zweimal gemacht.** Der erste Versuch (ein Knopf mit `width:600px`)
schlug fehl: der Flex-Container staucht ihn auf 380 px, er ragt gar nicht
hinaus. Erst `min-width:600px` erzeugt den Fall — gemeldet mit „204px
draussen". **Eine Gegenprobe, die den Fall nicht herstellt, beweist nichts.**

---

### 2026-09-02 (cs) — v32.06: eine Maschine sollte nicht über eine Giftigkeits-Korrektur urteilen

Nachfassen zu dem, was ich gerade gebaut habe. `feedback_items` hat eine
automatische KI-Triage (`_gsFeedbackTriageOne`): ein „Product Owner" urteilt
`accepted|rejected|needs_info|duplicate`, Priorität 1–5, Aufwand, Kategorie.
Für Ideen und Fehlerberichte ist das richtig.

**Für die zwei Arten, die ich heute in dieselbe Tabelle gelegt habe, ist es
falsch** — und das wäre ein Fehler gewesen, den ich selbst erzeugt hätte:

- `species_correction` — eine **sachliche Behauptung** über eine Art,
  womöglich über die Essbarkeit. Sie braucht jemanden mit einem Buch, keine
  Prioritäts-Zahl. Ein „rejected" auf der Karte hätte Staff gesagt, sie
  könnten eine Giftigkeits-Korrektur übergehen.
- `expert_application` — ein Mensch bewirbt sich mit Biografie und Diplomen.
  „rejected: aus Scope, Aufwand low" wäre die Antwort einer Maschine auf eine
  Bewerbung.

Beide bleiben auf `ki_status: 'pending'` und damit im Filter „Offen", wo ein
Mensch sie sieht. Nebenwirkung: sie kosten auch kein KI-Kontingent mehr.

#### Prüfstand

`save_check` **13/13** — ein Fall mehr, mit Gegenprobe: Korrektur und
Bewerbung werden übersprungen (und die KI **gar nicht erst gefragt**), eine
normale Idee wird weiterhin bewertet.

---

### 2026-09-02 (cr) — v32.05: ein Weg, Arten-Angaben zu korrigieren

Die Arten-Daten stehen seit Wochen auf Fernandos Liste. Ich kann sie nicht aus
dem Gedächtnis füllen — botanische Angaben in einer App, die Giftiges von
Essbarem trennt, schreibe ich nicht ungeprüft. Was ich bauen kann, ist der
**Weg für Leute, die es wissen**.

#### Der Befund vorweg: `user_submissions` ist nicht benutzbar

Die Tabelle gibt es — `species_id`, `field`, `value`, `evidence_url`,
`status`, `reviewer_id`, `reviewed_at`, `review_note`. Ein vollständiger
Prüf-Ablauf. Sie wird von der App **nirgends** angefasst, und beim Nachsehen
in der Datenbank (02.09.2026) zeigte sich der Grund, warum das auch richtig
war: sie hat **nur eine INSERT-Regel und keine einzige SELECT-Regel**.

Ein Nutzer könnte hineinschreiben. **Niemand könnte es lesen** — auch kein
Admin. Hätte ich darauf gebaut, wäre es genau der Fehler geworden, den diese
Session überall repariert: ein Schreiber ohne Leser.

#### Gebaut auf `feedback_items`

Dessen Rechte sind heute schon geprüft (v31.95): INSERT mit eigener `user_id`,
SELECT für den Einreicher **und Staff aufwärts**, UPDATE für Staff.
`kind='species_correction'`, im `context` die Art, der Bereich, der Beleg und
ob der Eintrag ungeprüft ist.

- Knopf auf **jeder** Artenkarte; bei den `_unverified`-Einträgen hervorgehoben
  und anders beschriftet („Kennst du diese Art? Angabe prüfen helfen").
- Mindestens 20 Zeichen, Quelle muss eine Adresse sein oder leer bleiben.
- **Erfolg nur nach einer echten Antwort** — eine leere Antwort ist kein Erfolg
  (dieselbe Regel wie seit v31.95).
- In der Feedback-Liste als „✏️ Arten-Korrektur" erkennbar, **mit Art, Bereich
  und Beleg** — sonst wäre die Meldung wertlos. Ohne Beleg steht das da: „muss
  von Hand nachgeschlagen werden".

#### Prüfstände

`save_check` **12/12** — zwei Wege mehr. Der erste fährt fünf Fälle: zu kurzer
Text (kein Serveraufruf), krumme Quelle (kein Serveraufruf), leere Antwort
(kein Erfolg), echte Antwort (Erfolg mit vollständigem `context`). Der zweite
liest die gerenderte Karte.

Ein Fehler dabei war meiner: `feedbackItems` ist mit `let` deklariert und liegt
damit **nicht** auf `window` — mein `window.feedbackItems = …` erreichte die
Funktion nicht. Blosse Zuweisung greift durch.

---

### 2026-09-02 (cq) — v32.04: die Inline-Changelog-Liste war auf 40 gewachsen

Nach dem Roadmap-Nachtrag den einen Prüfstand laufen lassen, der die ganze
Session nie lief: `perf_check`. Dabei zuerst gemessen, was der Tag gekostet hat
— `index.html` **+346 KB** (5'157 → 5'503 KB). Ein grosser Teil davon: meine
eigenen Release-Notizen.

#### Der Befund

`CLAUDE.md` §3.1 sagt, nur die **neuesten ~12** Einträge bleiben inline, alles
Ältere gehört in `data/releases.v1.js`. Es waren **40** (69 KB). Ich habe heute
zwölf dazugelegt und **keinen** ausgelagert — genau der Weg, auf dem die Liste
schon einmal auf 787 KB gewachsen war (v31.36).

28 Einträge ins Archiv, an den **Anfang** (die Reihenfolge ist überall neu→alt,
und `gsAllReleases` macht `basis.concat(arch)`).

#### Zwei Fehler beim Auslagern, beide vom Prüfen gefunden

1. **Ein führendes Komma erzeugte ein Loch im Array.** Die zusammengesetzte
   Liste hatte an der Nahtstelle einen `undefined`-Eintrag zwischen v31.92 und
   v31.91. Zurückgesetzt und sauber wiederholt statt daran herumzuflicken.
2. **Meine Zahl in der Release-Notiz war falsch.** Ich hatte „299 KB"
   geschrieben; gemessen sind es **50 KB**. Korrigiert, bevor es rausging.

Gegengeprüft: Archiv 411 → **439** Einträge (genau +28), **0 Löcher**, und der
eine Reihenfolge-Bruch (v25.28 → v25.29) war **vorher schon da** — alte
Historie, nicht von dieser Änderung. Bleibt als kosmetischer Restposten stehen.

#### Und was NICHT belegt ist

`perf_check` vorher/nachher: Mittelklasse-Telefon 3811 → 4112 ms Parsen,
Einsteiger 5907 → 5236 ms. **Das schwankt stärker als der Gewinn.** Eine
schnellere Startzeit ist daraus nicht ableitbar, und sie steht deshalb auch
nicht in der Release-Notiz. Belegt ist nur: 50 KB weniger im Startpfad.

#### Prüfstände

Alle neun grün.

---

### 2026-09-02 (cp) — ROADMAP.md nachgeführt, und ein P0 war seit einem Tag erledigt

`CLAUDE.md` §5 verlangt, abgeschlossene Meilensteine in `ROADMAP.md` zu
verschieben. Die Datei stand auf **v31.44** — 59 Releases zurück. Das ist meine
Nachlässigkeit über die ganze Session.

#### Drei Punkte an der Produktionsdatenbank geprüft, nicht am Changelog

- **P0-1 ist geschlossen.** Die beiden offenen Schreib-Endpunkte auf
  `public.species` (`admin-seed-species`, `species-bulk-seed`) wurden am
  **01.09.2026** durch 410-Stubs ersetzt. Der ausgelieferte Quelltext enthält
  **keinen Service-Role-Key und kein Secret mehr** — an der Quelle gelesen.
  `species` unverändert bei 2'838 Zeilen, neueste vom 2026-07-02: kein
  Missbrauch. **Der einzige P0 der Roadmap stand einen Tag lang zu Unrecht auf
  🔴 offen.** Eine veraltete Warnung ist billiger als eine veraltete Entwarnung
  — aber sie kostet Vertrauen in das ganze Dokument, und es ist das erste, was
  jemand liest.
- **P1-1** (Leaked-Password-Protection) erscheint im Advisor vom 02.09. **nicht
  mehr** — 144 Meldungen, 0 ERROR. Notiert als *wahrscheinlich erledigt*, nicht
  als erledigt: **Abwesenheit aus einer Prüfliste ist kein Beweis**, der Advisor
  könnte die Regel auch nicht mehr prüfen.
- **P1-2** (Stripe-Webhook) **bestätigt offen**: `stripe_webhook_events` hat
  weiterhin **0 Zeilen**.

#### Nachgeführt

Planer V3, Scanner V3, der grosse Funktionscheck und die neun Prüfstände als
eigener Abschnitt — mit der Tabelle, welche Frage jeder beantwortet.

---

### 2026-09-02 (co) — v32.03: eine Warnung, die aus einer Leerstelle kam

Der Scan-Prompt verlangt 21 Felder. Die Frage war: liest die sie überhaupt
jemand? **Korrektur an meiner ersten Zählung** — mein Suchmuster zählte die
Prompt-Zeilen mit, und ich hielt zunächst drei Felder für unbenutzt. Es ist
eines. Aber beim Nachsehen kam etwas Schlimmeres heraus.

#### `!r.found_in_switzerland` — eine Behauptung aus einem fehlenden Feld

```js
if (!r.found_in_switzerland) extras.push({ …'kommt möglicherweise nicht in der Schweiz vor'});
```

`!undefined` ist wahr. Liefert die Bestimmung das Feld **nicht** — was oft
vorkommt —, stand die Warnung trotzdem da. Eine Aussage aus einer Leerstelle
ist keine Aussage, und wer sie oft grundlos sieht, glaubt ihr auch dann nicht
mehr, wenn sie stimmt. Jetzt: `=== false`.

#### `db_search` ist raus

Ein Suchwort für die eigene Artenliste, bei **jedem** Scan mitgeliefert und an
**keiner** Stelle gelesen (0 Vorkommen ausser im Prompt). Die Zuordnung macht
längst `gsMatchScanToDb`, und die kann mehr. Ein Feld, das niemand liest,
kostet bei jeder Antwort Tokens und Zeit.

#### Und daraus eine Regel

`scan_check` hält jetzt fest: **jedes Feld im JSON-Beispiel des Prompts muss
im Code gelesen werden.** „Abgefragt, geliefert, weggeworfen" war heute der
häufigste Fehler überhaupt — bei der Giftigkeit der Alternativen (v31.92) und
den Merkmalen (v31.99) war er teuer.

Gegenprobe gemacht: `db_search` zurückgelegt → „verlangt und nirgends gelesen:
db_search". Wieder entfernt → 21 Felder, alle gelesen.

#### Prüfstände

`scan_check` **23/23**. Alle übrigen grün.

---

### 2026-09-02 (cn) — v32.02: eine Karte, die sich nicht selbst widerspricht

Beim Nachsehen, ob die Scan-Karte auf den vollen Arten-Eintrag verlinkt (sie
tut es, seit v30.26), fielen zwei Dinge auf — beide durch meine eigene Arbeit
von heute entstanden:

1. **Zwei Matcher für dieselbe Frage.** Die Karte nutzt `gsMatchScanToDb`
   (Synonyme, Normalisierung, Namenssegmente, lateinischer Name). Mein
   Prüfwerk brachte einen zweiten, einfacheren mit. Zwei Antworten auf
   dieselbe Frage driften auseinander: die Karte konnte „📖 Vollständiger
   Eintrag" anbieten, während die Prüfung darüber „steht in keiner unserer
   4'342 Arten" meldete. Ein Widerspruch auf einem Bildschirm.

   `_gsScanArtFinden` nutzt jetzt `gsMatchScanToDb`, mit Rückfall auf den
   exakten lateinischen Namen. **Was bleibt, ist die strengere Regel:** ein
   ungeprüft eingelesener Eintrag (`_unverified`) taugt zur Verlinkung, aber
   nicht als **Beleg** — er ist selbst ungeprüft.

2. **Das Foto stand zweimal auf der Karte.** Im Kopf (seit v30.26) und noch
   einmal in meiner Merkmals-Karte von v31.99. Die Doppelung ist raus; die
   Merkmale bleiben.

#### Prüfstände

`scan_check` **21/21**, zwei Fälle mehr — und beide halten genau das fest, was
gerade schiefging: die Prüfung darf nie eine Art kennen, die die Karte nicht
kennt (vier Proben), und das Scan-Foto muss genau **einmal** vorkommen. Alle
übrigen grün.

---

### 2026-09-02 (cm) — v32.01: ein Vorbehalt ohne Ausweg ist nur ein Vorwurf

Das Prüfwerk aus v31.99 meldet Vorbehalte — und liess den Nutzer damit stehen.
Den Knopf „Weiteres Foto hinzufügen" gab es seit v30.74, aber seine Bedingung
war die **Selbsteinschätzung des Modells**:

```js
if ((r.next_photo_hint && conf < 85) || (conf > 0 && conf < 60))
```

Genau das falsche Signal. Meldet das Modell 94 % und die Prüfung findet zwei
Widersprüche, stand dort nichts.

- Der Knopf hängt jetzt an `_pw.warn > 0` und steht **dort, wo das Urteil
  steht** — nicht weit unten auf der Karte.
- Die untere Karte bietet ihn dann nicht mehr an: zwei Knöpfe für dieselbe
  Handlung sind keine Auswahl.

#### Und noch eine unlesbare Stelle

`contrast_check` misst im Scan-Fenster jetzt **46 statt 40** Stellen — weil der
Prüfstand so tut, als läge ein erstes Foto vor und damit auch der neue Knopf
rendert. Prompt fiel etwas auf, das vorher **gar nicht messbar war**: die
Prozentzahl neben einer Verwechslungsmöglichkeit, weiss auf `#ef5350` =
**3,49:1 in beiden Modi**. Die drei Farben dort waren für Flächen ohne Text
gedacht.

**Die Lehre:** ein Prüfstand misst nur, was wirklich gerendert wird. Wer eine
Ansicht misst, muss sie auch in ihren Zuständen herstellen — sonst ist „0
Fehler" eine Aussage über zu wenig.

#### Prüfstände

`scan_check` **19/19** (zwei Fälle mehr: Knopf bei Vorbehalten trotz 94 %
Modell-Sicherheit · kein Knopf bei sauberem Fund · kein doppelter Knopf).
`contrast_check` 0/0. Alle übrigen grün.

---

### 2026-09-02 (cl) — v32.00: Scanner V3, Stufe 2 — das Foto weiss, wann und wo es entstand

#### Der Fehler

`gsBuildScanContext` nahm **immer** den heutigen Monat und den aktuellen
Standort. Für ein Live-Foto stimmt das. Für ein Galeriefoto — seit v31.83 einer
der Hauptwege in den Scanner — oft nicht: ein Bild vom Wanderurlaub im Juli, im
September hochgeladen, ging mit „September" und dem Wohnort in den Auftrag.

Doppelt teuer: die KI rechnete mit der falschen Jahreszeit **und** die neue
Saison-Regel (S3, v31.99) meldete anschliessend einen Widerspruch, den es gar
nicht gab.

#### Gebaut

- `_gsExifLesen(buf)` / `gsExifVonDatei(file)` — liest `DateTimeOriginal` und
  die GPS-Tags. **Vor** dem Komprimieren: `gsCompressImage` zeichnet auf ein
  Canvas, danach ist EXIF weg.
- Ein Datum in der Zukunft oder vor 1990 ist eine kaputte Uhr, keine
  Aufnahmezeit → verworfen, das GPS bleibt.
- Kontext und Prüfwerk-Regel S3 nutzen den Monat des Fotos.
- Der Auftragstext **nennt die Herkunft**: „Aufnahmedatum aus dem Foto:
  2026-07-14", „Ort aus dem Foto, nicht der aktuelle Standort". Und die Karte
  sagt es dem Nutzer ebenso — keine stille Korrektur.
- Kein EXIF → wie bisher der heutige Tag, **ohne Behauptung**.

#### Zwei Dinge, die der Prüfstand gefunden hat

1. **Ein Binär-Parser, der nie gegen echte Bytes gelaufen ist, ist eine
   Behauptung.** `scripts/_exifjpeg.js` baut jetzt ein echtes JPEG mit APP1,
   TIFF-Kopf, Exif-IFD und GPS-IFD. Erst damit ist „liest EXIF" eine Aussage.
2. **`gsSaisonMonate` liefert NULLBASIERTE Monate** (`[7,8,9]` = Aug/Sep/Okt).
   Meine Regel S3 verglich einen einsbasierten — **jede Saison-Aussage war um
   einen Monat verschoben, und zwar still.** Aufgefallen ist es nur, weil der
   EXIF-Fall Juli gegen September stellte; im „guten" Fall war die Regel aus
   der Behauptung ausgenommen und fiel deshalb nicht auf.

   Die Stelle aus v31.98 (Blüten-Widget) ist geprüft und richtig — sie nutzt
   `getMonth()`.

#### Prüfstände

`scan_check` **17/17** (vier EXIF-Fälle mehr: echte Bytes, ohne EXIF, kaputte
Uhr, Auftragstext + Karte). Alle übrigen grün, `contrast_check` 0/0.

---

### 2026-09-02 (ck) — v31.99: Scanner V3, Stufe 1 — der Scanner glaubt der KI nicht mehr aufs Wort

Auftrag (Fernando): *„Bringe ihn auf ein Highend-Level … besser als Google
Lens. Zusätzlich will ich, dass während der Diagnose das Foto gezeigt wird."*
Entwurf und Begründung: `docs/SCANNER-V3.md`.

#### Der Check zuerst

Der Scanner ist **nicht** naiv gebaut: Multi-Shot, Bildqualität vor dem Aufruf,
dHash-Cache, GPS/Saison-Kontext, ehrlicher Fortschritt, Giftigkeit der
Alternativen. Was fehlte, war die Ebene, die diese ganze Session durchzieht:
**die Antwort wurde an keiner Stelle nachgerechnet** — ausser bei den
Alternativen (v31.92). Der Haupttreffer ging ungeprüft durch.

**Die Linie des Entwurfs:** in der Bilderkennung ist gegen Lens nichts zu
gewinnen, und es hat keinen Zweck, so zu tun. Was Lens *nicht* hat: eine
kuratierte Artenliste, den Monat, den Kanton, die gemessene Bildqualität.
**Die Überlegenheit liegt nicht im Sehen, sondern im Prüfen.**

#### Gebaut: `_gsScanPruefwerk` — fünf Regeln, drei Zustände

| Regel | Frage |
|---|---|
| S1 · Art bekannt | Steht der lateinische Name in unseren 4'342 Arten? |
| S2 · Sicherheit | Widerspricht die Giftangabe der Artenliste? |
| S3 · Jahreszeit | Passt der Aufnahmemonat zur hinterlegten Saison? |
| S4 · Abstand | Wie weit liegt der Zweitbeste zurück? |
| S5 · Grundlage | Schärfe, Licht, Zahl der Fotos |

**Bei S2 gewinnt immer die vorsichtigere Angabe** — `r.toxicity` wird nach oben
korrigiert, `edible` auf `false` gesetzt, und die Karte sagt warum. Deshalb
läuft das Prüfwerk als **allererstes** in `showScanResult`: die nächste Zeile
liest `r.toxicity`. Stünde es weiter unten, zeigte die Karte die ungeprüften
Zahlen und die Korrektur daneben — der Fehler aus v31.90.

#### Gebaut: der Blick aufs Foto

Während des Aufrufs bleibt das eigene Foto stehen, mit Lichtstreifen und
Sucher-Ecken. **Die Texte bleiben die gemessenen** — die fünf erfundenen
Meldungen von vor v31.79 kommen nicht zurück. Danach erscheinen die
`diagnostic_features`: ein Feld, das der Prompt seit jeher verlangt und das an
**keiner** Stelle angezeigt wurde. Bewusst **ohne** Marker auf dem Bild — die
Antwort enthält keine Koordinaten, und ein Marker an erfundener Stelle zeigt
überzeugend daneben (§4a.1).

#### Fünf unlesbare Stellen — auf dem Bildschirm, auf dem man über Gift liest

`contrast_check` misst jetzt das **Scan-Ergebnis** als drittes Fenster. Erster
Lauf: 5 hell, danach 3 dunkel. Alle bestanden vorher:

- **„☠️ Tödlich giftig" mit 3,27:1** — dunkelrot auf rot. Die wichtigste Angabe
  der Karte war die am schlechtesten lesbare.
- **„Wahrscheinlich" mit 1,87:1** — die Ring-Farbe wurde als Textfarbe benutzt.
  Jetzt getrennt: `ccRing` für die Fläche, `ccTxt` für den Text.
- **Die ganze Sicherheits-Karte war fest hell** (`rgba(255,255,255,.96)`), die
  Schrift theme-abhängig → im Dunkelmodus „71 %" mit **1,02:1**.
- Dazu zwei Labels knapp unter AA.

**Zweimal in derselben Runde in dieselbe Falle getappt** (CLAUDE.md §7.1: eine
feste Farbe bedient selten beide Modi) — erst hell repariert, dann dunkel
kaputt gemacht. Erst die Variablen lösen es.

Und: beim Einbau zeigte das Fenster zunächst **18 Stellen bei 71 Textknoten** —
die Karte war vollständig da und trotzdem unmessbar, weil der Scanner-Tab
ausgeblendet ist. Genau dafür nennt der Bericht je Fenster die Zahl.

#### Prüfstände

**`scripts/scan_check.js` (neu) — 10/10.** Der wichtigste Fall: eine Art, die
unsere Liste als tödlich führt, vom Modell als „essbar" gemeldet → muss auf 5/5
korrigiert werden **und** auf der Karte stehen. Dazu: gute Antwort meldet
nichts, erfundene Art wird erkannt, knapper Abstand benannt, ohne Artenliste
ist **nichts** „in Ordnung".

Alle übrigen grün · `contrast_check` 0/0 in beiden Modi.

---

### 2026-09-02 (cj) — v31.98: jetzt wird geprüft, ob ein Fenster überhaupt aufgeht

Der teuerste Fund dieser Woche (v31.95) war, dass **vier Bildschirme sich nicht
öffnen liessen** und es niemandem auffiel — ein Fenster, das nicht aufgeht,
sieht aus wie ein Fingerfehler. `wiring_check` bekommt dafür eine dritte
Richtung.

#### Richtung 3: 43 Öffner, wirklich aufgerufen

Jede Funktion nach der Öffner-Konvention (`open…` / `gsOpen…` / `show…`) ohne
Parameter, deren Rumpf `openModal(` enthält, wird aufgerufen; danach wird
nachgesehen, ob ein Fenster sichtbar ist und Inhalt hat.

**Zwei Verfeinerungen, beide nötig:**

- **Sperren werden erfüllt, nicht umgangen.** Vier Öffner brechen ohne
  Anmeldung oder Admin-Rechte ab — das ist richtig und wurde im ersten Lauf
  als Fehler gemeldet.
- **Bewusstes Ablehnen ist kein Fehler.** `gsOpenExpertApplication` sagt
  Admins „bist du schon". Unterschieden wird daran, ob die Funktion etwas
  **sagt**: wer nichts öffnet und nichts sagt, ist kaputt.

Gegenprobe gemacht: eine künstlich wieder eingesetzte tote `.modal-title`-Kette
wird als „wirft" gemeldet.

#### Zwei Fehler, einer hinter dem anderen

1. **`openErnteTracking` starb an `e.ts.slice(0,10)`.** Ursache waren MEINE
   Beispieldaten: `ts` ist im Ernte-Log ein ISO-String (so schreibt es die App
   an vier Stellen), `_seed.js` benutzte eine Zahl. Dieselbe Lehre wie v31.46 —
   **Beispieldaten gegen `index.html` prüfen, nicht gegen den Namen.** Der Code
   ist trotzdem gehärtet (`String(e.ts).slice(…)`): ein krummer Eintrag darf
   keinen Jahresüberblick töten.
2. **Der dritte `s.bloom` — und er hat v31.78 überlebt.** Das Blumen-Widget der
   Gartenübersicht fragte weiter ein Feld ab, das es bei keiner der 4'342 Arten
   gibt: `wildCount` war immer 0. Rechnet jetzt wie der Blühkalender
   (`gsBlueht` + `gsSaisonMonate`).

**Und der Zusammenhang ist die eigentliche Lehre:** Fund 2 war *unerreichbar*,
weil Fund 1 die Funktion vorher abbrach. Falsche Beispieldaten haben einen
echten Fehler die ganze Session lang verdeckt — `data_check` meldete brav 0.

#### Prüfstände

`wiring_check` 43 Öffner · 42 gehen auf · 1 lehnt mit Meldung ab · **0 kaputt**.
`data_check` wieder 0 (kurzzeitig 1, siehe oben). Alle übrigen grün.

---

### 2026-09-02 (ci) — v31.97: erst das Urteil, dann die Einzelheiten

Durch R11 und R12 hat die Plan-Prüfung bis zu zwölf Zeilen. Zwölf Zeilen sind
keine Auskunft, sondern eine Wand — und in einer Wand sieht ein „⚠" genauso
aus wie ein „✓".

- **Zählung oben:** `⚠ n Hinweise · ✓ n bestanden · – n nicht prüfbar`.
- **Zeilen nach Dringlichkeit sortiert** — die Reihenfolge ist die Aussage.
- **Ein Fusshinweis** statt dreimal derselbe Grund, wenn Prüfungen mangels
  Garten-Scan nicht gelten. Erkannt am **Text** der Zeilen, nicht geraten.
- **Bewusst nicht eingeklappt:** was in einem `<details>` steckt, misst der
  Kontrast-Prüfstand nicht (CLAUDE.md §7.1) — und ein Grund, den niemand
  liest, ist so gut wie keiner.

#### Prüfstände

`planer_check` **22/22**, zwei Fälle mehr: die Zählung wird gegen die Zahl der
gerenderten Zeilen geprüft, und die Reihenfolge der Marken aus dem HTML
gelesen. `contrast_check`: das Planer-Fenster misst jetzt **249 statt 239**
Textstellen — das Urteil wird also wirklich vermessen und nicht stillschweigend
übersprungen; beide Modi 0 unter AA.

---

### 2026-09-02 (ch) — v31.96: die Rollen-Vergabe geht den Weg, den es schon gab

#### Eine Korrektur an der eigenen Arbeit von vorhin

v31.95 hat `gsAdminSetExpertLevel` und `gsAdminBanUser` von einer
Falschmeldung zu einem echten PATCH auf `profiles` gemacht. Ehrlich, aber der
schlechtere Weg — und das war beim Weitersuchen zu sehen: es gibt eine zweite,
funktionierende Admin-Oberfläche (`openAdminPanel` / `gsAdminAssignRole`), die
über die RPC **`fn_assign_role`** geht. An der Datenbank nachgesehen, was die
kann und der PATCH nicht:

- prüft die Admin-Rolle **serverseitig** (nicht nur `gsIsAdmin()` im Browser),
- verhindert, dass sich der **letzte Admin** selbst degradiert,
- setzt `is_admin` mit (der PATCH tat das nicht),
- schreibt einen Eintrag ins **`audit_log`**,
- **benachrichtigt die betroffene Person** („✓ Du bist jetzt verifizierter
  Experte").

Beide Funktionen delegieren jetzt an `gsAdminAssignRole`; die doppelte
PATCH-Logik ist weg, `_gsAdminUidZu(email)` bleibt als gemeinsamer
Adresse→id-Schritt.

#### Und ein verschluckter Fehlschlag

`✅ Neue Art in DB` stimmte — lokal. Die Cloud-Übertragung lief als
`.catch(function(){})` ins Leere. Jetzt sagt eine zweite Meldung, wenn die Art
nur auf diesem Gerät liegt.

#### Prüfstand

`save_check` prüft den Weg jetzt gegen die RPC: schlägt jemand künftig wieder
einen direkten PATCH vor, meldet der Fall es mit Begründung („umgeht
Audit-Log, Benachrichtigung und die Letzter-Admin-Sperre"). 10/10, alle
übrigen grün.

---

### 2026-09-02 (cg) — v31.95: vier Bildschirme liessen sich nicht öffnen, ein Antrag wurde nie eingereicht

#### Wie es gefunden wurde

Nicht durch Lesen. Fernando: „Checke ab was vernetzt/verdrahtet werden kann."
Also alle 191 `gs_*`-localStorage-Schlüssel gegen Lese- und Schreibstellen
gehalten. `gs_expert_application`: geschrieben, nirgends gelesen. Beim
Nachsehen war das nur die Spitze.

#### Vier Funde, alle derselben Familie

1. **Vier Bildschirme gingen gar nicht auf.** Alle setzten
   `getElementById('modal-recipe-detail').querySelector('.modal-title').textContent`
   — dieses Modal enthält **kein** `.modal-title` (die Klasse gibt es sechsmal
   in der Datei, aber nicht hier). Die Zeile warf jedes Mal, und zwar **vor**
   `openModal`. Betroffen: „Bestätigte Scans", „Supabase API-Key", das
   **Admin-Panel** und der Experten-Antrag.
2. **`gsSubmitExpertApplication` verschickte nichts.** Sie schrieb Biografie
   und Diplome in den localStorage des eigenen Geräts und meldete „✅ Antrag
   eingereicht! … Du wirst per E-Mail benachrichtigt." Dazu schrieb sie in
   `_sbProfile.biography`/`.diplomas` — zwei Felder, die es in `profiles`
   nicht gibt (an der Datenbank nachgesehen: es gibt `bio`).
3. **`gsAdminSetExpertLevel` und `gsAdminBanUser` ebenso** — lokales Log,
   Erfolgsmeldung, nichts geschehen. Der Kommentar im Code sagte es sogar:
   „vereinfacht: localStorage + API".
4. **Der grüne Haken erschien bei niemandem.** `gsIsVerifiedExpert` las
   `profile.expert_level` — keine solche Spalte. Die App hatte zwei
   Rollen-Systeme, und nur `profiles.role` existiert serverseitig; der
   Kommentar bei `GS_ROLE_HIERARCHY` nennt es selbst „Server-Wahrheit".

#### Was gebaut wurde

- `gsSetModalTitel(modalId, text)` + ein Titel-Element im Modal; alle fünf
  Aufrufer darauf umgestellt (der fünfte leert ihn, sonst stünde „🛡️
  Admin-Panel" über einem Pesto).
- Antrag → `feedback_items` (`kind='expert_application'`). An der Datenbank
  geprüft: RLS erlaubt INSERT mit eigener `user_id`, SELECT für Staff
  aufwärts, und `v_feedback_public` läuft mit `security_invoker=true` — der
  Antrag ist also **nicht** öffentlich. Erfolg wird nur nach einer echten
  Antwort gemeldet.
- Rollen-Vergabe und Sperre → PATCH auf `profiles` (role, role_note,
  role_assigned_at/by, is_expert), Auswahl auf die Werte beschränkt, die der
  CHECK-Constraint annimmt.
- Badge liest `profile.role`.
- Antrag ist in der Feedback-Liste sichtbar: `kindToType` erweitert und
  `context` beim Einlesen **mitgenommen** — es wurde bisher gelesen und
  weggeworfen, die Diplome wären sonst unsichtbar geblieben.

#### Prüfstände

- `save_check` **10/10** — neu: drei Server-Wege mit gestelltem `sbFetch`. Je
  Weg drei Fälle, und der dritte ist der wichtige: **eine leere Antwort ist
  kein Erfolg** (PostgREST liefert bei RLS-Ablehnung 0 Zeilen und keinen
  Fehler). Dieser Prüfstand hat Fund 1 gefunden, beim Auslösen.
- `wiring_check` — neue Richtung 2b: sofort dereferenzierte
  `querySelector('.klasse')`-Ketten ohne passendes Element. Gegenprobe
  gemacht: eine künstlich eingesetzte tote Klasse wird mit Zeile gemeldet.
- Alle übrigen unverändert grün.

---

### 2026-09-02 (cf) — v31.94: aus einer Lücke im Kalender wird ein Platz im Garten

#### Der Befund

`_gsPlanLuecken` (R6, seit v31.75) meldet Lücken als **Zeitraum**: „von Ende
Juli bis Oktober passiert nichts mehr". Richtig gerechnet, aber ohne Ort — man
liest es und weiss nicht, wohin. Seit v31.93 kennt jede Pflanze ihr Beet; damit
ist dieselbe Rechnung umsetzbar.

#### Was gebaut wurde

- **R12 · `_gsPlanNachkultur`** — je Beet: wann wird es frei (erst wenn ALLES
  darin geerntet ist), wie gross ist es, was trägt dort noch in dieser Saison.
  Ausgeschlossen wird jede Familie, die dieses Jahr in **diesem** Beet stand
  oder in den letzten drei Jahren — dieselbe Historie wie R11.
- **Fehlendes Erntedatum wird benannt**, nicht überspielt: eine einzige Pflanze
  ohne Termin macht die Aussage unmöglich, und dann steht das da.
- **Bewusst nicht gerechnet:** Starkzehrer → Schwachzehrer. `garden_crop_agronomy`
  hat keine Nährstoffklasse; eine ergänzte sähe aus wie eine gemessene.
- **Nebenbefund:** `p._beet` wurde in der Fruchtfolge-Regel gesetzt, und die
  steigt bei einem einzigen Beet früh aus — die Zuordnung war also genau im
  häufigsten Fall leer (ein Hochbeet). Jetzt eigene, immer laufende Runde
  `_gsPlanBeetZuordnung`.

#### Prüfstände

`planer_check` 20/20 (fünf Fälle mehr, darunter Anzeige aus dem gerenderten
HTML) · `render_check` 0/0 · `contrast_check` 0/0 · `touch_check` 0 ·
`wiring_check` 0/0/0 · `save_check` 7/7 · `data_check` 0/0.

---

### 2026-09-02 (ce) — v31.93: Fruchtfolge je Beet, und ein Prüfstand, der drei Fehler beim ersten Lauf fand

#### Der Befund

R5 (v31.77) prüft die Fruchtfolge **garten-weit**: „stand diese Familie schon
bei dir?" In einem Garten mit vier Beeten ist das die falsche Frage — man
verzichtet nicht drei Jahre auf Tomaten, man stellt sie ins andere Beet. Der
Hinweistext von R5 sagte es selbst: „Ob im selben Beet, weiss ‚Meine Pflanzen'
nicht."

#### Was gebaut wurde

- **R11 · `_gsPlanBeetFolge`** — Vorgeschichte je Beet aus zwei Quellen mit
  Koordinaten: dem Garten-Zwilling (dieses Jahr) und früheren gespeicherten
  Plänen **derselben Fläche** (26-cm-Toleranz wie überall). `gs_plantings` und
  `gs_ernte_log` bewusst **nicht** — sie sagen DASS, nie WO.
- **Der Platzierer verteilt.** Jede Kultur bekommt eine Rangfolge der Beete
  (längste Familien-Pause zuerst, bei Gleichstand das Beet, in dem schon ein
  Familienmitglied liegt). Als Vorliebe *innerhalb* der Strenge-Stufen — ein
  Jahr Bodenpause ist weniger wert als eine Tomate, die reif wird.
- **`plan._beetgeo`** reist mit dem Plan; sonst kann ein später geöffneter Plan
  nicht mehr sagen, welche Pflanze in welchem Beet lag.
- **Prompt**: Beet-Vorgeschichte im Auftragstext, plus die Pflicht, eine
  Familie in EIN Beet zu bündeln.
- **Anzeige**: Zeile „Beet-Wechsel" in der Plan-Prüfung — Konflikt mit
  Ausweichvorschlag, oder die Verteilung („Beet A: 1 · Beet B: 1 · Beet C: 1").
  An jeder Pflanze steht ihr Beet in der Begründung.

#### `scripts/planer_check.js` — neu, und sofort rot

Das Prüfwerk hatte **dreizehn Regeln und keinen Prüfstand**. Fünfzehn Fälle,
darunter zwei gegen einen *guten* Plan (darf nichts melden) und einer, der die
Drei-Zustände-Regel festhält (`null` + Grund, nie `{}` oder `0`). Erster Lauf:
drei Fehler, alle älter als heute:

1. **Der Platzierer sprang über die Beete hinweg, wenn kein Bestand da war**
   (`if (fest.length || zonen.length)`). Gescannter, leerer Garten → Reihen
   quer über die Wege. Seit v31.88.
2. **Der Auftragstext erwähnte einen leeren gescannten Garten gar nicht** —
   `gsPPtwinBlock` stieg bei `!t.plants.length` aus, `gsPPbuildUserContext`
   baute `ctx.twin` erst gar nicht.
3. **Zum dritten Mal „frei ist nicht sinnvoll"** — Stufe 1 nahm die Stelle der
   KI, ohne zu fragen, ob dort letztes Jahr dieselbe Familie stand. Nach Licht
   (v31.62) und Nachbarschaft (v31.63) dieselbe Lücke ein drittes Mal.

#### Prüfstände

`planer_check` 15/15 · `render_check` 0 JS-Fehler / 0 verdächtig ·
`contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 ·
`save_check` 7/7 · `data_check` 0/0 · `field_check` 4 (die dokumentierten
`tp-*`-Falschmeldungen).

---

### 2026-09-02 (cd) — v31.92: der Scan verschwieg, dass eine Verwechslung tödlich sein kann

Der dritte Fund derselben Familie an einem Tag: **abgefragt, geliefert, dann weggeworfen.**

#### Der Befund

Der System-Prompt des Scanners verlangt ausdrücklich:

> „`alternatives` = IMMER 2 weitere Kandidaten mit name/latin/confidence/distinguishing_feature **SOWIE toxicity(0..5)+edible(true|false) je Alternative** — konservativ"

Das Modell liefert sie. **Die Anzeige hat sie nie gelesen** — sie rendert Name, Latein, Unterscheidungsmerkmal und Prozentwert.

Der Fall steht wörtlich im Prompt-Beispiel:

```
Bärlauch                    62 %
  Maiglöckchen              28 %      ← tox 4
  Herbstzeitlose            12 %      ← tox 5, tödlich
```

Drei Namen mit Prozentzahlen nebeneinander. Kein Hinweis darauf, dass eine davon tödlich ist.

#### Was jetzt passiert

Die Giftigkeit steht **am Namen**, nicht in einer Fussnote, und darüber ein Warnkasten, sobald irgendeine Alternative bei ≥ 3 liegt.

**Zwei Quellen, die vorsichtigere gewinnt:** was das Modell zur Alternative sagt, und was die Arten-DB über denselben botanischen Namen weiss (ungeprüfte Einträge zählen dabei nicht). Widersprechen sie sich, gilt der höhere Wert.

#### Vier Fälle nachgestellt

| Fall | Ergebnis |
|---|---|
| Modell liefert `toxicity` (Bärlauch-Beispiel) | Warnkasten „☠️ Achtung bei den Alternativen … **tödlich giftig**", Marken am Namen |
| Modell liefert **keine** `toxicity` | **DB springt ein** — Colchicum autumnale, tox 5, geprüft → Warnkasten erscheint trotzdem |
| harmlose Alternativen | kein Warnkasten, „🍽️ essbar"-Marke |
| gar keine Angabe | **nichts behauptet** — keine Marke, keine Warnung |

Der zweite Fall ist der wichtigste: er schützt auch dann, wenn das Modell die Angabe weglässt.

#### Kontrast nachgerechnet (Scan-Ergebnis ist kein gemessener Bildschirm)

`#b71c1c` auf `#ffebee` = **5,75:1** · dunkel `#ef9a9a` auf komponiertem `#302d1d` = **6,43:1** · die grüne Marke 7,00:1 hell und 7,57:1 dunkel.

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7 · `data_check` 0/0.

---

### 2026-09-02 (cc) — v31.91: die Suchliste zeigte weiter „Essbar", was die Karte schon zurückgenommen hatte

Aufgefallen beim Testen der Suchreihenfolge — nicht gesucht, sondern gesehen.

#### Eine halbe Korrektur ist keine

In v31.90 habe ich die grüne „🍽️ Essbar"-Plakette auf ungeprüften Artenkarten zurückgenommen. Die **Trefferliste** zeigte sie weiter:

```
🌸 Ampfer · Rumex ucranicus     ✅ Essbar
🌸 Ampfer · Rumex maritimus     ✅ Essbar
🌸 Ampfer · Rumex pulcher       ✅ Essbar        … 28×
```

Und die Trefferliste sieht man **vor** der Karte. Dieselbe Zusage, einen Bildschirm früher — genau die Sorte halbe Arbeit, die ich diese Woche mehrfach an fremdem Code kritisiert habe.

Jetzt steht dort „❔ nicht geprüft", und der grüne Rand der Karte fällt ebenfalls weg. **An beiden Listenrenderern** — es gibt zwei, und einer davon hätte es sonst weiter angezeigt.

#### Geprüfte Arten zuerst

„Brennnessel" trifft neun Einträge, „Ampfer" achtundzwanzig. Bei gleicher Relevanz entschied bisher das Alphabet — ganz oben stand, wer zufällig vorne im ABC lag.

Jetzt:

```
🌸 Brennnessel · Urtica dioica       ✅ Essbar · 💊 Heilpflanze     ← geprüft
🌸 Brennnessel · Urtica pilulifera   ❔ nicht geprüft
🌸 Brennnessel · Urtica officinalis  ❔ nicht geprüft
🌸 Brennnessel · Urtica ramiflora    ❔ nicht geprüft
```

**Die Relevanz selbst bleibt unangetastet** (`b.sc − a.sc` steht weiterhin zuerst): ein exakter Treffer schlägt alles. Es geht nur um die Reihenfolge bei Gleichstand — und dort ist „geprüft vor ungeprüft" die einzige Ordnung, die etwas aussagt.

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 (die neue graue Marke: 6,3:1 hell, 5,3:1 dunkel, nachgerechnet) · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7 · `data_check` 0/0.

---

### 2026-09-02 (cb) — v31.90: was nie geprüft wurde, sagt es jetzt

Fortsetzung von (ca). Der „verwendbar"-Satz war die Spitze; darunter liegt das Eigentliche.

#### Der Befund

Dieselben Einträge aus der Buch-Einlese tragen **kein `warning`, kein `lookalike` und keine `season`** — die drei Felder, an denen man einen redaktionell bearbeiteten Eintrag erkennt.

**1'383 Stück. 68 davon behaupten `edible: true`** und zeigten dafür eine grüne „🍽️ Essbar"-Plakette — gleichwertig neben Bärlauch, der einen vollständigen Warntext und eine Verwechslungsliste hat.

#### Kein neuer Mechanismus — ein nie angewandter

Die App unterdrückt grüne Plaketten bei ungeprüften Arten **seit v30.66/v30.73** (`_unverified`, HL#24). Der Mechanismus war da, getestet, richtig — und nur auf Community-Vorschläge angewandt. Die 1'383 Einträge der Buch-Einlese kannte er nicht.

Jetzt wird das Kennzeichen beim Laden gesetzt. **Es wird nichts hinzugedichtet: es werden positive Behauptungen zurückgenommen, die die Daten nicht tragen.**

Nachgemessen:

| | |
|---|---|
| Brennnessel (Urtica pilulifera), ungeprüft | Essbar-Plakette **weg** · „❔ Einstufung offen · Noch nicht geprüft" |
| Bärlauch, gepflegt | „Essbar" und „Ungiftig" **bleiben** — hat `warning` und `lookalike` |
| Storchschnabel, giftig + korrigiert | kein „verwendbar", stattdessen „Keine Verwendung" |

#### Der zweite Widerspruch, gefunden im selben Zug

Die Toxizitäts-Überschrift zeigte weiter die Einstufung, während die Unterzeile schon „Noch nicht geprüft" sagte:

```
✅ Ungiftig
Noch nicht geprüft
```

Dieselbe Sorte wie „verwendbar" neben „nicht essen" — eine Zusage und ihr Dementi auf derselben Karte. Das gab es seit v30.66 für alle Community-Arten; meine Änderung hätte es auf 1'383 weitere ausgeweitet. Bei ungeprüften, **nicht-giftigen** Einträgen steht dort jetzt „❔ Einstufung offen".

**Warnungen bleiben unverändert.** Zurückgehalten wird nur die Entwarnung — im Zweifel lieber eine Warnung zu viel.

#### Und ein eigener Fehler, der nur aufgefallen ist, weil ich die Karte angesehen habe

Meine erste Fassung stand im Code **vor** der Zeile `var _unv = !!sp._unverified;`. Durch Hoisting war `_unv` dort `undefined` — die Bedingung war still falsch, **ohne jede Fehlermeldung**. Der Code sah richtig aus, der Prüfstand meldete 0 JS-Fehler, und die Karte zeigte weiter „✅ Ungiftig".

Aufgefallen ist es nur, weil der Test die **fertige Karte** liest und nicht den Quelltext. Genau dieselbe Lehre wie beim Fenster-Zähler in `contrast_check` und beim Proxy in `data_check`: **ein Werkzeug, das nur prüft, ob etwas eingebaut wurde, prüft das Falsche.**

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7 · `data_check` 0/0.

---

### 2026-09-02 (ca) — v31.89: bei 25 giftigen Arten stand „verwendbar" auf derselben Karte wie „nicht essen"

Fernando hat auf meine Frage nach einer botanischen Quelle noch nicht geantwortet. Was ich ohne Antwort tun kann, ist **messen** — und beim Messen ist etwas aufgetaucht, das nicht warten konnte.

#### Der Fund

**1'408 Einträge** der Arten-DB tragen im Feld `uses` denselben Satz:

> „Wildpflanze der Schweizer Flora. Junge Blätter, Blüten oder Samen je nach Art **verwendbar**. Vor Verzehr sicher bestimmen."

Bei **25** davon steht im selben Datensatz `toxic: true, tox: 3`. Die Gattungen:

> Geranium · Alisma · Ranunculus · Delphinium · **Aconitum** · **Daphne** · **Oenanthe** · **Solanum** · **Datura** · **Digitalis**

Eisenhut, Rebendolde, Stechapfel, Fingerhut, Seidelbast. Auf ihrer Karte stand unter „Verwendung", junge Blätter seien verwendbar — **während das Warnfeld derselben Karte „⚠️ Giftig — nicht essen." sagte.**

Der Satz stand nie da, weil jemand diese Art geprüft hätte. Er stand auf 1'408 Einträgen gleichzeitig.

#### Die Korrektur

Beim Laden der Datenbank: wo der Datensatz **selbst** die Art als giftig einstuft (`toxic:true` oder `tox≥2`) und der generische Satz dort steht, wird er ersetzt durch „Keine Verwendung — dieser Eintrag ist als giftig eingestuft."

**Hier wird nichts botanisch entschieden.** Die Einstufung kommt aus dem Datensatz; entfernt wird ein Text, der ihr widerspricht. Die Korrektur läuft bei jedem Start und fängt denselben Fall wieder auf, falls eine künftige Datenlieferung ihn erneut mitbringt.

Nachgemessen: 25 korrigiert, 0 offen, **1'383 ungiftige Einträge unverändert**.

#### Die Dauerprüfung — und zwei Anläufe, bis sie taugte

`data_check.js` prüft ab sofort: **generischer Text darf auf einer als giftig eingestuften Art keine Verwendung versprechen.** „Generisch" ist messbar: derselbe Text auf ≥ 50 Arten — ein Text, der auf vielen Arten gleichzeitig steht, kann über keine einzelne etwas aussagen.

| Anlauf | Meldung | Warum falsch |
|---|---|---|
| 1 | u. a. Knollenblätterpilz | suchte „essbar" und traf „**NICHT** essbar oder nur mit Fachkenntnis" |
| 2 | 16 Treffer | Robinie (Blüten essbar, Rinde giftig), Tintling (essbar, aber nicht mit Alkohol) — **sorgfältig geschriebene** Einträge |
| 3 | **0** | nur noch generische Texte; Gegenprobe ohne Korrektur: **25** |

Ein Prüfstand, der die richtigen Einträge anschwärzt, wird weggeklickt. Deshalb werden die 16 einzeln geschriebenen Texte ausgewiesen statt gemeldet.

#### Der Rest des Befunds: `docs/ARTEN-LUECKEN.md`

Die Kurzfassung, alles gezählt:

- **Die Lücken sind nicht verteilt.** Pilze, Kräuter, Zimmerpflanzen: 100 % in allen Feldern. Bäume: 94–98 %. Nur `wildpflanze` (2'226 Arten) liegt bei 37–66 %.
- **Und auch dort konzentriert.** 133 Trivialnamen zeigen auf mehr als zwei Binome — „Levkoje" auf **98**, „Königskerze" auf 97, „Gaspeldorn" auf 96. Zusammen 1'276 Einträge, und die sind systematisch leer: season 2 %, warning 4 %, lookalike 2 % (im Rest der DB je 94 %).
- **Woher sie kommen:** `bookRef: "Schmeil/Fitschen"`, `desc` sind rohe OCR-Fetzen. Das ist die Buch-Einlese aus der Roadmap („PDF → OCR → Kandidaten → **Review**") — der Review-Schritt hat für diese Einträge nie stattgefunden.
- **Deshalb ist „vervollständigen" wahrscheinlich die falsche Antwort.** Ob „Rumex persicaria" oder „Urtica officinalis" akzeptierte Namen sind, kann ich von hier aus **nicht** prüfen. Die Häufung ist ein Signal, zuerst zu prüfen und zusammenzufassen statt auszufüllen.
- **Sonst ist die Sicherheit in Ordnung:** 0 giftige Arten ohne Warntext. Die 35 Einträge mit gleichzeitig `edible` und `toxic` sind **korrekt** (Holunder roh giftig/gekocht essbar, Morchel, Perlpilz, Hallimasch) — nachgesehen, nicht angenommen.

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7 · `data_check` 0 Zugriffe ins Leere, **0 generische Verwendungs-Versprechen auf giftigen Arten**.

---

### 2026-09-02 (bz) — v31.88: der Planer setzt nichts mehr auf den Weg

Stufe 3 aus `docs/PLANER-V3.md`, erster Teil.

Wer seinen Garten gescannt hat, hat **Beete** — und dazwischen Wege, Rasen, eine Terrasse. Der Platzierer kannte bisher nur **ein** Rechteck: die ganze Fläche. Eine Tomate mitten auf dem Weg ist kein Plan, sondern ein Bild.

#### Wie es funktioniert

- `_inBeet(x,y,w,h)` prüft, ob ein Rechteck **ganz** in einem Beet liegt. Teilweise reicht nicht: eine Pflanze halb auf dem Weg steht auf dem Weg.
- Die Beete gelten nur, wenn die geplante Fläche **die gescannte ist** (Toleranz 26 cm) — dieselbe Bedingung wie bei den Lichtzonen seit v31.62. Ein Beet am falschen Ort wäre schlimmer als keines.
- Als **Vorliebe**, nie als Sperre. Die Kette hat jetzt acht Stufen statt vier, und das Beet wird **zuletzt** aufgegeben: eine Pflanze im falschen Licht wächst schlecht, eine auf dem Weg wächst gar nicht.

#### Drei Fälle nachgestellt

Testaufbau: 6 × 4 m, zwei Beete (0–2,5 m und 3,5–6 m), dazwischen ein Meter Weg. Die KI legt drei Pflanzen genau auf den Weg (x = 2,8 / 3,0 / 2,9).

| Fall | Ergebnis |
|---|---|
| **mit Beeten** | Tomate 2,8 → **1,2** · Salat 3,0 → **3,5** · Bohne 2,9 → **1,9**. `drin: 4, daneben: []` |
| **ohne Beete** | unverändert (2,8 / 3,0 / 2,9) — **keine erfundene Einschränkung** |
| **Beete zu klein** (1,2 × 1,2 m) | alle gesetzt, **keine weggelassen**, drei namentlich als „ausserhalb" gemeldet |

Der dritte Fall ist der wichtigste: er beweist die Regel aus `CLAUDE.md` §4a.2 — *keine Vorliebe darf eine Pflanze verhindern*, und was aufgegeben werden musste, wird benannt.

#### In der Plan-Prüfung

> 🧱 **Beete** — Tomate, Salat, Bohne liegen ausserhalb deiner 1 gescannten Beete — dort ist Weg oder Rasen. Es war kein Platz mehr im Beet; verschieb sie von Hand oder mach das Beet grösser.

bzw. bei Erfolg: *„alle 4 Pflanzen liegen in deinen 2 gescannten Beeten."*

#### Eine Kleinigkeit beim Testen

Der erste Durchlauf meldete `_beete: null` — mein Test-Zwilling hatte kein `v: 1`, und `gsTwinGet` verlangt das. Kein Fehler im Code, aber ein Hinweis für den nächsten Prüfstand: **wer einen Zwilling im Test baut, braucht die Versionsmarke.**

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 (11 Bildschirme + 2 Fenster) · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7 · `data_check` 0.

---

### 2026-09-02 (by) — v31.87: „Plan für diesen Garten" — ein Tipp statt vier Schritte

Die App hat **alle** Angaben deines Gartens: Masse, Standort, Licht, Boden, seit gestern auch die Art. Trotzdem war der Weg zum Plan: Planer öffnen → Schritt 1 → Vorlagen-Liste finden → „einen deiner Gärten übernehmen" → durch vier Schritte klicken.

Jetzt steht der Knopf dort, wo der Garten steht — auf der Gartenkarte selbst.

#### Was er tut

Planer öffnen · Vorlage anwenden · zum letzten Schritt springen (dort steht „🧠 Plan generieren").

Nachgeprüft mit einem Gewächshaus als Testgarten:

| | |
|---|---|
| Breite / Länge | 4 / 8 |
| Ort | Bern |
| Boden · Licht | lehmig · Vollsonne |
| **Gewächshaus-Modus** | **an** |
| Schritt | 4 (der letzte vor dem Plan) |
| Modal sichtbar | ja, 915 px hoch |

#### Was NICHT von selbst passiert

**Der Plan wird nicht ungefragt erzeugt.** Ein KI-Aufruf, der von allein startet, kostet Tageskontingent und überrascht. Der letzte Schritt gehört dem Menschen — samt Feld für Wünsche und Einschränkungen.

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `save_check` 7/7.

---

### 2026-09-02 (bx) — v31.86: „Jetzt dran" — dein Saatgut weiss, wann es Zeit ist

Zwei Verbindungen, die es nicht gab, obwohl **beide Seiten seit Langem da sind**:

| hat die App | hat die App auch | fehlte |
|---|---|---|
| `gs_seed_inventory` — was in deiner Schublade liegt | `GS_SAE_DB` — 39 Kulturen mit Vorkultur-, Auspflanz- und Erntemonaten | „das kannst du jetzt säen" |
| deine erfassten Arten (`_gsBlMeineArten`) | die geprüften Saison-Angaben | „das blüht bei dir gerade" |

Beides rechnet lokal. Kein Netz, keine KI, keine neue Datenquelle — nur zwei Listen, die nebeneinander lagen.

#### Was jetzt in „Mein Garten" steht

> 🌤️ **Jetzt ins Beet:** Feldsalat — Saatgut hast du.
> ⚠️ **Abgelaufen:** Tomate Ochsenherz — Keimfähigkeit prüfen oder ersetzen.
> 🌻 **Blüht im September:** Schafgarbe, Löwenzahn, Basilikum — aus deinen erfassten Arten.

Jede Zeile führt an ihren Ort (Saatgut-Inventar bzw. Blühkalender). **Abgelaufenes Saatgut wird nicht empfohlen**, sondern gemeldet. Was sich keiner Kultur zuordnen lässt („Etwas Unbekanntes"), fällt weg — eine erfundene Aussaatzeit wäre schlimmer als keine. Und wenn es nichts zu sagen gibt, ist die Leiste **gar nicht da**: eine Kachel, die „nichts" meldet, ist Platz ohne Aussage.

#### Die Korrektur, die der Testlauf erzwungen hat

Der erste Anlauf schrieb: *„Blüht im September: Schafgarbe, Löwenzahn, Basilikum, **Monstera, Fleischtomate**"*.

Beides falsch — und aus **demselben Grund wie bei den Pilzen in v31.78**: das Feld heisst `season`, nicht `bloom`. Bei Wildpflanzen, Kräutern und Bäumen fällt Saison mit Blüte zusammen; bei Gemüse steht dort die **Ernte**, bei Zimmerpflanzen die Verfügbarkeit. Eine Tomate im September blüht nicht, sie ist reif.

`GS_BLUEHT_NICHT` schliesst jetzt auch `hauspflanze` und `gemuese` aus — **und das gilt auch im Blühkalender**, wo die Junizahl dadurch von 1'395 auf 1'130 sinkt. Weniger Einträge, aber keine falschen mehr.

Dass ich denselben Fehler zweimal in vier Tagen gemacht habe, ist der eigentliche Hinweis: **ein Feldname, der etwas anderes bedeutet als er suggeriert, wird immer wieder falsch gelesen.** Deshalb steht die Begründung jetzt direkt an der Tabelle, nicht nur im Log.

#### Prüfstände

`render_check` 2872 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `save_check` 7/7 · `data_check` 0 · `wiring_check` 0/0/0 + 31 Ziele.

---

### 2026-09-02 (bw) — v31.85: neuer Prüfstand `save_check.js` — kommt an, was gespeichert wird?

Fernando: *„Prüfe das Speichern und alles andere im Hintergrund."*

Die vier bestehenden Prüfstände messen, wie die App **aussieht**, ob ein Tipp **ankommt**, ob jemand ein Eingabefeld **liest** und ob die gelesenen Daten **existieren**. Keiner fährt einen Speicherweg zu Ende. Genau dort lagen aber die teuersten Fehler dieses Meilensteins:

| | |
|---|---|
| v31.72 | Gartenmasse wurden nie geschrieben — der Leser war da, der Schreiber fehlte |
| v31.65 | `gsTwinSave` meldete Erfolg, obwohl nichts geschrieben wurde |
| v31.76 | `gsPPsavePlan` ebenso — der Rettungsweg lag in totem Code |

Drei Fehler derselben Familie, drei Mal beim Lesen gefunden statt beim Messen.

#### Was er tut

Formular füllen → Speicherfunktion aufrufen → **aus dem localStorage zurücklesen** → Feld für Feld vergleichen. Sieben Wege:

Garten (Name, Masse, Art, Licht, Boden) · Pflanzung (Garten, Name, Sorte, Datum, Anzahl, Notiz) · Saatgut · Einstellungen · Garten-Zwilling · Plan · Aufgaben-Fortschritt.

Alle sieben grün.

#### Die Gegenprobe — und warum sie nötig war

Ein Prüfstand, der beim ersten Lauf „alles grün" meldet, ist **erst dann etwas wert, wenn er auch einen Fehler findet**. Dieselbe Lehre wie beim Fenster-Zähler in `contrast_check` und beim Proxy in `data_check`, beide vorgestern.

Also zwei Felder absichtlich entfernt:

```
!!   Garten     →  nicht gespeichert: kind (=undefined, erwartet gewaechshaus)
!!   Pflanzung  →  nicht gespeichert: notes
```

Beide beim Namen genannt, samt erwartetem Wert. Danach zurückgesetzt.

#### Was ihn vorher unmöglich machte

`gsRequire('save_garden')` und Geschwister sperren mehrere Speicherwege ohne echte Anmeldung ab; der Pseudo-Token aus `_seed.js` reicht nicht. Der Prüfstand überbrückt die Sperre bewusst — sonst vermisst er eine Funktion, die gar nicht läuft. Genau das hat mich gestern bei v31.82 eine halbe Stunde gekostet, und es steht jetzt an drei Stellen: im Werkzeug, in CLAUDE.md §7.1 und hier.

#### Grenze

Gemeldet wird nur, was in der Liste `WEGE` steht. **Die Liste ist die Prüfung** — wer einen neuen Speicherweg baut, trägt ihn dort ein.

#### Prüfstände (jetzt sechs)

`render_check` · `contrast_check` · `touch_check` · `wiring_check` · `field_check` · `data_check` · **`save_check` 7/7**.

---

### 2026-09-02 (bv) — v31.84: Regen und Giessplan wussten nichts voneinander

Fernando: *„Checke ab was vernetzt/verdrahtet werden kann und die App noch intelligenter zu machen. Sie soll selbstständig intelligent sein."*

Das hier ist genau diese Sorte Arbeit: **nichts Neues holen, sondern zusammenbringen, was die App schon weiss.**

Seit v26.60 holt sie stündliche Niederschlagswerte von Open-Meteo (`gs_weather_cache`). Seit je führt sie einen Giessplan mit Intervallen je Pflanze. Die beiden liefen nebeneinander her — nach einem Gewitter stand am nächsten Morgen „💧 Giessen fällig" für den Balkon, als wäre nichts gewesen.

#### Drei Regeln, damit daraus keine falsche Zusage wird

1. **Gemessen wird, was GEFALLEN ist** — die Stunden von Mitternacht bis jetzt aus dem stündlichen Verlauf. Eine Vorhersage ist kein Regen. (Im Testlauf standen für morgen 99 mm im Datensatz; sie werden korrekt nicht mitgezählt.)
2. **Nur für Pflanzen, von denen die App weiss, dass sie draussen stehen.** Balkon, Terrasse, Beet, Hochbeet → ja. Wohnzimmer, Küchenfenster, **Gewächshaus**, Wintergarten → nein: dort regnet es nicht. Ohne Standort-Angabe → **keine Aussage**.
3. **Die Aufgabe verschwindet nicht.** Sie bekommt einen Vermerk mit der gemessenen Menge — entschieden wird nicht für den Menschen.

#### Nachgestellt

| Pflanze | Standort | Hinweis |
|---|---|---|
| Tomate | Balkon | **🌧️ 20.6 mm Regen heute — kann warten** |
| Gurke | Gewächshaus | keiner |
| Monstera | Wohnzimmer | keiner |

Ohne Regen: kein Hinweis. Ohne Wetterdaten: `null`, nicht `0` — „kein Regen" und „keine Angabe" sind verschiedene Aussagen.

#### An beiden Stellen, nicht an einer

Der Hinweis steht in **„Nächste Schritte"** auf der Startseite *und* im Benachrichtigungs-Fenster. Beide lesen dieselbe Quelle (`gsGetDueTasks`), also reichte eine Ergänzung an der Quelle — ein Hinweis nur im Fenster wäre die halbe Verdrahtung gewesen.

#### Die Schwelle

6 mm, und das ist kein willkürlicher Wert: rund 6 Liter je Quadratmeter durchfeuchten die oberen Zentimeter zuverlässig. Darunter wird nichts behauptet.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele.

---

### 2026-09-02 (bu) — v31.83: vier Zahlen zuerst · der Planer-Kopf passt wieder

Fernando: *„Der KI-Planer soll optisch sowie funktionell einen riesigen Fortschritt machen."* Erster Teil davon.

#### Kennzahlen als erster Blick

Das Plan-Ergebnis begann mit Prüfungen und Listen — richtig, aber ohne ersten Eindruck. Jetzt stehen ganz oben vier Zahlen:

> **12 m²** Fläche · **3** Arten · **11 kg** Ernte · **8.3/Wo** Handgriffe

**Alle vier gerechnet**, keine aus der KI-Antwort: die Ernte aus `_gsPlanErnteMonate` (Summe der geprüften Erträge), der Aufwand aus `_gsPlanArbeit` (Spitze über das Jahr). Wo nichts gerechnet werden konnte, steht ein **Strich** und keine Null — „0 kg" und „keine Angabe" sind verschiedene Aussagen. Darunter die Zusammenfassung, die vorher unter der Checkliste begraben war.

#### Der Kopfbereich passte nicht

Titel und **drei** Werkzeug-Knöpfe standen in EINER Flex-Reihe. Auf 412 px blieben der Überschrift **96 px** — „KI-Gartenplaner PRO" brach auf drei Zeilen, die Unterzeile auf acht, und „🌳 Bäume" ragte rechts hinaus. Das war mir schon bei den Messungen in v31.77 aufgefallen und stand seither als offener Punkt in diesem Log.

Jetzt zwei Zeilen: Titel oben über die volle Breite, Werkzeuge darunter als umbrechende Reihe.

#### Und was dabei sichtbar wurde

Sobald der Kopf richtig umbricht, meldet `contrast_check` zwei Stellen, die vorher unter dem Radar lagen:

| | |
|---|---|
| 3,54:1 | Unterzeile — `--muted` bei `opacity:.75`. Die Farbe ist geprüft, die Transparenz macht sie kaputt. |
| 4,06:1 | „🌳 Bäume" — weiss auf dem hellen Ende `#43a047` |

**Ein zusammengequetschter Text entzieht sich der Prüfung.** Was nicht richtig gerendert wird, wird auch nicht richtig gemessen — die Layoutkorrektur war die Voraussetzung dafür, die Farbfehler überhaupt zu sehen. Beide behoben, jetzt wieder 0/0.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 (11 Bildschirme + 2 Fenster, 239 Stellen allein im Planer) · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `data_check` 0.

#### Weiter offen aus Fernandos Liste

Planer Stufe 3 (Mehrbeet aus dem Zwilling) · Varianten-Vergleich · Scanner: Multi-Shot als angebotener Weg · der grosse Verdrahtungs-Durchgang.

---

### 2026-09-02 (bt) — v31.82: Gewächshaus, Treibhaus, Hochbeet — dein Garten hat jetzt eine Art

Fernando: *„Gewächshäuser und Treibhäuser die man gespeichert hat (z.B. in Mein Garten) sollen ebenfalls angezeigt werden können."*

**Den Begriff gab es in der App nicht.** Ein Garten hatte Name, Standort, Masse, Grössenstufe (klein/mittel/gross), Licht und Boden — mehr nicht. Im Planer gab es einen Gewächshaus-Haken, den man bei jedem Plan neu setzen musste, ohne Verbindung zum eigenen Garten.

#### Sieben Arten, an einer Stelle definiert

`GS_GARTEN_ARTEN`: Freiland-Beet · Hochbeet · Balkon/Terrasse · **Gewächshaus** · **Folientunnel/Treibhaus** · Wintergarten · Zimmer. Jede mit Symbol, Bezeichnung und dem fachlich entscheidenden Merkmal `unter_glas` — was unter Glas oder Folie steht, hat andere Aussaatfenster, keine Eisheiligen-Grenze und eine längere Saison.

Vier Anzeigen lesen diese eine Tabelle (Gartenkarte in „Mein Garten", Übersichtskarte auf der Startseite, Planer-Vorlagenliste, Planer-Übernahme). Vier Kopien wären vier Gelegenheiten auseinanderzulaufen.

#### Alle vier Stellen, absichtlich

Formular → **speichern** → beim Bearbeiten **wieder einlesen** → auf der Karte **anzeigen** → vom Planer **übernehmen**. Ein Feld, das nur geschrieben wird, ist dasselbe stille Nichts wie die Gartenmasse vor v31.72.

Nachgestellt: Art auf „Treibhaus" ändern → gespeichert `treibhaus`, im Speicher `treibhaus`, Karte zeigt 🫧 „Folientunnel / Treibhaus", Planer-Vorlage ebenso.

#### Das Symbol sagt jetzt etwas

Auf jeder Gartenkarte stand dieselbe Sonnenblume — hübsch, aber ohne Aussage; ein Gewächshaus sah aus wie ein Balkon. Jetzt trägt jede Karte ihr eigenes Zeichen, mit der Bezeichnung im `title`.

#### Der Planer weiss Bescheid

Vorlage „Grosses Gewächshaus" wählen → **Gewächshaus-Modus setzt sich selbst**, und es steht in der Liste der übernommenen Felder. Danach den Balkon wählen → er geht wieder aus. Ein Schalter, der sich von selbst umlegt, ohne dass es jemand sagt, ist eine Überraschung, keine Hilfe.

Zusätzlich geht die Art als Wort in den Prompt: Hochbeet erwärmt sich früher, Balkon braucht Topfkultur — Unterschiede, die der Haken allein nicht ausdrücken kann.

#### Eine halbe Stunde für nichts, und die Lehre daraus

Der erste Testlauf zeigte: Art wird gelesen (`treibhaus`), aber nie gespeichert. Ich habe den Sync-Hook verdächtigt, dann `renderGarden`, dann `Object.assign`. Der wahre Grund stand in der **ersten Zeile** von `saveGarden`:

```js
if (!gsRequire('save_garden', 'Bitte anmelden …')) return;
```

Der Pseudo-Token aus `_seed.js` ist keine echte Anmeldung — die Funktion brach ab, bevor irgendetwas passierte. **Jeder Prüfstand, der ein Speichern prüft, muss `gsRequire` überbrücken**, sonst misst er eine Funktion, die gar nicht gelaufen ist. Steht jetzt in CLAUDE.md §7.1.

Der verräterische Wert war `editingGardenId`: nach dem Speichern hätte er `null` sein müssen und war noch `g2` — also lief der Rumpf nie. **Ein Zustand, der sich nicht geändert hat, sagt mehr als ein Wert, der falsch ist.**

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 + 31 Ziele · `field_check` 4/304 · `data_check` 0.

---

### 2026-09-02 (bs) — v31.81: Galerie neben dem Auslöser · Mitteilungen führen an ihren Ort

Erste zwei Punkte aus Fernandos neuer Liste.

#### 1 · „Kamera öffnen oder Bilder von der Galerie aufladen"

Der zweite Weg in den Scanner gab es — als kleines Symbol zwischen fünf gleich aussehenden in der oberen Leiste. Ein Kommentar von v23.74 erklärt, warum er unten entfernt wurde: *„Doppel-Button — Top-Bar hat schon Hochladen"*. Die Begründung stimmte, die Folge nicht: wer keine Kamera benutzen will oder kann, findet ihn dort nicht.

Jetzt steht er **unten, beschriftet, neben dem Auslöser** — und oben ist er weg. Ein Umzug, kein Doppel. Dazu tragen alle Nebenknöpfe ein Wort: **🖼️ Galerie · ➕📷 Sammeln · ⬤ · 🔄 Wechseln**. Ein blosses Emoji sagt nicht, was es tut.

Nachgemessen mit einer Fake-Kamera im Prüfstand (`--use-fake-device-for-media-stream`): vier Knöpfe, 60 px breit, kein Überlauf (398 von 412 px), `touch_check` 0. Weisse Beschriftung auf `rgba(0,0,0,.78)` über beliebigem Video: **im schlechtesten Fall 11,7:1** (nachgerechnet, weil kein Prüfstand über Video messen kann).

#### 2 · „Beim Anwählen einer Benachrichtigung soll es mich direkt auf die entsprechende Seite weiterleiten"

Der Wegweiser stand eingebettet in `gsCollectNotifs` und kannte **sieben** Arten. Alles andere ohne `link`:

```js
} else {
  action = "closeMainMenu();";     // ein Tipp, der nur das Fenster schliesst
}
```

Jetzt eine Tabelle an einer Stelle — `GS_NOTIF_ZIELE`, **31 Arten**: Ernte, Wetter, Frost und Sensor-Alarm in den Garten · Likes, Kommentare, Follows in die Community · Nachrichten in den Marktplatz-Posteingang · Abo-Hinweise ins Abo · Erfolge ins Erfolge-Fenster · Scans in den Verlauf.

**Und wenn wirklich keine Zuordnung besteht**, sagt die App das (mit der Art im Text) statt still zu schliessen. Ein Fehler, der sich meldet, wird behoben; einer, der schweigt, bleibt.

#### 3 · Der Prüfstand, der das absichert

`wiring_check` hat eine dritte Liste bekommen. Sie fährt jede der 31 Arten durch den Router und prüft, ob die Zielfunktion existiert und der Tab bekannt ist — dieselbe Bauart wie die `MENU_ITEMS`-Prüfung, weil beides **reine Datenstrukturen** sind, die kein Blick aufs Dokument findet.

**Beim ersten Lauf meldete er drei Zeilen — meine eigenen.** Ich hatte `openSubscriptionModal` eingetragen; die Funktion heisst `gsShowAboScreen`. Ohne den Prüfstand wären drei Abo-Mitteilungen still ins Leere gelaufen, und zwar genau die, mit denen Geld zusammenhängt.

Ende-zu-Ende nachgestellt: 15 Arten durch `gsCollectNotifs` geschickt, **0 ohne Ziel**, ein `#garden`-Link weiterhin korrekt geroutet, eine erfundene Art meldet sich ehrlich.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 (11 Bildschirme + 2 Fenster) · `touch_check` 0 · `wiring_check` 0/0/0 + **31 Benachrichtigungs-Ziele, 0 kaputt** · `field_check` 4/303 · `data_check` 0.

#### Als Nächstes aus Fernandos Liste

KI-Planer optisch und funktionell · Gewächshäuser aus „Mein Garten" im Planer · Verdrahtungs- und Speicher-Durchgang.

---

### 2026-09-02 (br) — v31.80: neuer Prüfstand `data_check.js` — gibt es überhaupt, was der Code liest?

Nach dem Blühkalender-Fund (`s.bloom` existiert in **keiner** der 4'342 Arten) war klar: das ist eine eigene Fehlerklasse, und keiner der bestehenden Prüfstände sieht sie.

| Prüfstand | Frage |
|---|---|
| `wiring_check` | kommt an, was angetippt wird? |
| `field_check` | liest überhaupt jemand, was eingegeben wird? |
| **`data_check`** | **gibt es, was gelesen wird?** |

#### Wie er arbeitet

**Dynamisch, nicht per Textsuche.** `window.DB` wird durch einen Proxy ersetzt, der jeden Feldzugriff auf einen Arten-Datensatz mitschreibt; danach läuft die App durch alle elf Tabs, den Blühkalender in drei Monaten, ein Arten-Detail und die Suche. Jeder Zugriff auf einen Namen, den **kein** Datensatz kennt, ist ein belegter Fund — kein Verdacht.

Zwei Klassen im Bericht, und nur die erste ist ein Fehler:
- **Existiert nirgends** → Zugriff ins Leere.
- **Optionales Feld** (existiert bei manchen Arten) → normal.

Dazu eine Deckungsliste: `.color` und `.alt` sind nur bei **967 von 4'342** Arten gefüllt (22 %), `.care`/`.lightMin`/`.waterFrequency` bei 40. Wer eine Anzeige darauf baut, sollte das wissen.

#### Erster Durchlauf: ein Fund

`.tip` — **26'042 Zugriffe ins Leere**. Die Bienen-Erkennung (`isBeeFriendly`) durchsucht `uses` + `desc` + `tip`; das dritte Feld gibt es nur an den Garten-Blumen aus `GS_SAE_DB`, nicht an Arten. Ein Drittel ihrer Beweislage war immer leer. Ersetzt durch `medicinalUse` — das Ergebnis ändert sich von **78 auf 79** von 4'342, was die gestrige Entscheidung bestätigt, die Erkennung ehrlich zu beschriften statt eine Anzeige darauf zu bauen.

#### Ein Fehler im Prüfstand selbst, und er ist der lehrreichste

Der erste Anlauf band die Array-Methoden ans **rohe** Array:

```js
return typeof v === 'function' ? v.bind(t) : v;   // FALSCH
```

`DB.filter(fn)` lief damit am Proxy vorbei, die Datensätze kamen ungewickelt beim Aufrufer an — und der Späher meldete **3** Feldzugriffe statt 26'000. Ein Prüfstand, der nichts sieht, meldet „alles in Ordnung". **Wer so ein Werkzeug baut, prüft zuerst, ob es überhaupt etwas sieht** — dieselbe Lehre wie beim Fenster-Zähler in `contrast_check` gestern.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 · `field_check` 4/303 · **`data_check` 0 Zugriffe ins Leere**.

---

### 2026-09-02 (bq) — v31.79: Scanner V2, erste Stufe — erst messen, dann bestimmen

Fernando: *„verbessere den scaner"* / *„Scanner V2"*. Drei Funde, alle beim Lesen der vier Wege in `analyzeImage`.

#### 1 · Die Bildqualität wurde nur an EINEM der vier Wege geprüft

`gsScannerQualityCheck` misst seit je Schärfe (Laplace-Varianz) und Helligkeit — aber der einzige Aufrufer ist der Auslöser der **Live-Kamera**. Galerie, Teilen-Dialog und abgelegte Datei gingen ungeprüft in den KI-Aufruf.

Das ist nicht nur eine verpasste Warnung: ein unlesbares Foto kostet einen Aufruf aus dem Tageskontingent **und** liefert eine Bestimmung, der man nicht ansieht, wie dünn ihr Grund ist. In einer App, die Giftiges von Essbarem unterscheidet, ist das die falsche Reihenfolge.

Jetzt misst `gsBildQualitaetVonB64` jedes Einzelbild vor dem Aufruf. `gsScannerQualityCheck` ist nur noch ein Durchreicher — zwei Kopien derselben Rechnung wären genau die Doppelpflege, die auseinanderläuft.

**Geblockt wird nichts.** Bei einem wirklich unlesbaren Foto stehen die gemessenen Werte da („Schärfe 0/100 · Licht 71/100") und zwei Knöpfe: *Neues Foto* oder *Trotzdem bestimmen*.

**Ein eigener Fehler, vom Testlauf gefunden:** die erste Schwelle prüfte nur den Mischwert `blur*0.6 + light*0.4`. Ein vollkommen unscharfes, aber gut belichtetes Testbild kam damit auf **28** und rutschte durch — der Mischwert verdeckt genau die Angabe, auf die es ankommt. Jetzt zusätzlich `blur < 8` (Laplace-Varianz unter 24; das ist keine schlechte Aufnahme mehr, das ist eine Fläche).

| Testbild | quality | blur | light | Tor |
|---|---|---|---|---|
| scharf (Raster) | 90 | 100 | 74 | nein |
| unscharf (Verlauf) | 28 | 0 | 71 | **ja** |
| dunkel | 0 | 0 | 0 | **ja** |

„Trotzdem bestimmen" ausgelöst: 0 KI-Aufrufe im Tor, 1 danach, Ergebnis gerendert.

#### 2 · Der Fortschritt war wieder eine Uhr

```js
var stageTimer = setInterval(function(){ … }, 2200);   // fünf Meldungen nach Stoppuhr
'<style>@keyframes scanbar{from{width:0%}to{width:92%}}</style>'   // erfundener Balken
```

„Merkmale werden gelesen", „Vergleich mit der Arten-Bibliothek", „Doppelgänger werden geprüft" — nichts davon geschah in dem Moment, in dem es behauptet wurde; die App wartete auf **einen** Netzaufruf. Derselbe Fehler wie im Planer vor v31.65, dieselbe Antwort: nur echte Schritte melden (Qualität → Kontext → Scan-Speicher), und über den langen Aufruf die einzige ehrliche Aussage — er läuft, seit N Sekunden. Nachgemessen: `🌐 Die KI schaut sich das Foto an … (1 s)`, Balken unbestimmt.

#### 3 · Die Sicherheitsangabe konnte um den Faktor 100 danebenliegen

Der System-Prompt verlangt `confidence` als 0..100. Die **Historie** normalisiert seit v23.85 sauber (0–1 oder 0–100) — die **Anzeige** tat es nicht. Liefert das Modell einmal `0.42` statt `42`, stand dort **„0.42 %"**: liest sich als „so gut wie nichts", gemeint war „nicht ganz die Hälfte".

Jetzt eine Funktion (`gsNormConfidence`) für beide Stellen. Die Grenze liegt bewusst **unter** 1: eine glatte `1` ist zweideutig, und sie als 1 % zu lesen irrt in die vorsichtige Richtung — zu wenig Sicherheit anzuzeigen kostet einen zweiten Blick, zu viel kostet im Zweifel mehr.

Geprüft: `0.42→42 · 42→42 · 1→1 · 0.99→99 · 100→100 · 150→100 · "abc"→null`.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 (11 Bildschirme + 2 Fenster) · `touch_check` 0 · `wiring_check` 0/0/0.

#### Offen für Scanner V2

Multi-Shot als angebotener Weg statt nur als Nachbesserung · Qualitätswert im Ergebnis sichtbar machen · Verwechslungspartner prominenter, wenn die Sicherheit tief ist.

---

### 2026-09-02 (bp) — v31.78: der Blühkalender war zur Hälfte leer, seit jeher

Fernando: *„Blühkalender ausbauen (mehr Infos, die gespeicherten Arten einbinden)."* — Beim Öffnen der Datei stand da:

```js
wildBlooms = DB.filter(function(s) {
  if (!s.bloom) return false;      // ← s.bloom gibt es NIRGENDS
  …
});
```

**Nachgezählt, nicht vermutet: `bloom` existiert bei keiner einzigen der 4'342 Arten.** Die Zeile hat also seit jeher alles aussortiert. Der Reiter „🌿 Wild" war dauerhaft leer, der Bienen-Schalter meldete „0 von 0 Wildblüten", und der Zähler daneben sagte brav `0` — als wäre das ein Ergebnis und kein Fehler.

Dieselbe Sorte stiller Rest wie der Pflanzenfriedhof (v31.46) und die Gartenmasse (v31.72): **etwas fertig gebaut und dann verstummt.**

#### Was es wirklich gibt

`season` — bei **2'907** Arten, in der Form „Apr–Jun", „Ganzjährig", vereinzelt „Blüte: Mai–Jul; Frucht: Sep". `gsSaisonMonate()` übersetzt das in Monate: **2'907 von 2'907 gelesen**, inklusive Jahreswechsel („Nov–Feb" → Nov, Dez, Jan, Feb) und Jahreszeitworten.

**Eine Ehrlichkeitsgrenze:** `season` heisst Saison, nicht Blüte. Bei Wildpflanzen, Kräutern und Bäumen fällt beides zusammen; Pilze, Moose, Flechten und Algen blühen gar nicht — die werden ausgeschlossen (`gsBlueht`). Bleiben 1'935 blühfähige Arten mit lesbarer Angabe, im Juni 1'395.

#### Neu

- **Reiter „🪴 Meine"** — aus `ps_myplants`, `gs_confirmed_species` und `gs_scan_history`, zugeordnet zur Arten-DB.
- **Jahresband je Art** — zwölf Punkte, der laufende Monat umrandet.
- **Marken** — essbar / **giftig** / geschützt / Blütenfarbe / Höhenlage. In einer App, die Giftiges von Essbarem unterscheidet, gehört die Warnung in jede Liste, nicht nur in die Detailseite.
- **Blüh-Lücke** über deine Arten.

#### Zwei eigene Fehlgriffe, vom Testlauf korrigiert

- **645 botanische Namen stehen mehrfach in der DB.** „Allium ursinum" ist Bärlauch, Echter Bärlauch, Bärlauch-Pesto und Echter Bärlauch (Wald). Der erste Abgleich lieferte für 4 gespeicherte Arten **32 Zeilen**. Jetzt: je botanischem Namen ein Eintrag — der direkt benannte, sonst der mit dem kürzesten Namen (das ist verlässlich der Grundeintrag, nicht die Zubereitung). 32 → 7.
- **Die Bestäuber-Lücke musste wieder raus.** `isBeeFriendly` sucht „Bienen/Hummeln/Nektar/Pollen" in den Beschreibungstexten und findet sie bei **78 von 4'342** Arten — nicht bei Löwenzahn, nicht bei Schafgarbe, nicht bei Bärlauch. Ein Mangel-Befund auf dieser Grundlage hätte fast jedem „Lücke in allen Monaten" gemeldet. **Ein Fehlalarm im Gewand einer Erkenntnis ist schlechter als gar keine Anzeige.** Stattdessen die schlichtere, belegbare Blüh-Lücke — und der Schalter heisst jetzt „Nur mit Bestäuber-Hinweis" und sagt darunter, dass es um die Textnennung geht.

#### Der Prüfstand: zweites Fenster, zwei neue Regeln

`contrast_check` öffnet jetzt **zwei** Fenster (Planer + Blühkalender). Beim Einbau drei Fehler im Prüfstand selbst, jeder für sich lehrreich:

| Fehler | Symptom |
|---|---|
| Aufräumen mit `[id^="modal-"]` blendete `#modal-content` aus | zweites Fenster mass **0 Stellen** und sah aus wie „keine Fehler" |
| Text, den ein **scrollender** Vorfahre abschneidet, wurde vermessen | vier Zeilen mit 1,2:1 gemeldet, die in Wahrheit 18:1 haben |
| kein Zähler je Fenster | ein Fenster, das gar nicht aufging, war von einem fehlerfreien nicht zu unterscheiden |

Der Zähler steht jetzt im Bericht: **Planer 224 · Blühkalender 168 Textstellen**. `elementFromPoint` allein reicht dort nicht — es liefert an einer abgeschnittenen Stelle den Vorfahren, und der *enthält* das Element, also winkt die Prüfung es durch.

#### Prüfstände

`render_check` 2865 · 0 JS-Fehler · 0 verdächtig · **`contrast_check` 0/0 über 11 Bildschirme + 2 Fenster (392 Textstellen)** · `touch_check` 0 · `wiring_check` 0/0/0 · `field_check` 4/303.

---

### 2026-09-02 (bo) — v31.77: Begründungen je Pflanze · zwei neue Regeln · und der Prüfstand schaut endlich ins Fenster

Stufe 2 fertig (`docs/PLANER-V3.md`). Der grössere Teil dieses Eintrags handelt aber von einem Prüfstand, der eine Lücke hatte — und davon, dass diese Lücke mich gestern eine falsche „Korrektur" gekostet hat.

#### N9 · Warum steht sie hier?

Unter jeder Pflanze im Plan stehen kleine Marken, **aus den Regeln gebaut, nicht aus dem Prompt**:

> `Licht passt (gemessen)` · `Nachbarschaft geprüft` · `Saatgut vorhanden (Mär 2027)` · `⚠ Familie stand vor 1 Jahr im Beet`

Der Unterschied ist nicht kosmetisch: eine Begründung aus dem Prompt kann von hier aus niemand nachprüfen, eine aus der Rechnung schon. Und ein Plan, dessen Begründungen man nachlesen kann, ist einer, dem man widersprechen kann.

#### R2 Standdauer · R5 Fruchtfolge gegen die echte Historie

| Regel | Testlauf |
|---|---|
| R2 | „Kürbis: 29 Tage von der Aussaat bis zur Ernte, die Referenz nennt rund 122" — die drei plausiblen Kulturen blieben still |
| R5 | „Kohlrabi (Kreuzblütler) — dieselbe Familie stand dieses Jahr schon in deinem Beet (Ernte)" |

R2 prüft **nur die schädliche Richtung** (zu schnell) und mit 40 % Toleranz. R5 unterscheidet die Quellen: `gs_plantings`/`gs_ernte_log` tragen ein Datum und ein Beet → Vorwurf. `myPlants` sagt WAS du hast, nicht WO → nur ein Hinweis. Ohne diese Trennung bekäme jeder mit dreissig Pflanzen den halben Plan angestrichen.

#### Der eigentliche Fund: `contrast_check` sah nie in ein Fenster

CLAUDE.md §7.1 nannte die Grenze seit v31.51 beim Namen: *„beide vermessen, was auf den elf Bildschirmen sichtbar ist. Was in einem geschlossenen Fenster steckt, sehen sie nicht."* Der KI-Planer ist das grösste dieser Fenster.

Der Prüfstand rendert ihn jetzt selbst (Musterplan in `scripts/_seed.js`), **ungefaltet** — ohne Reiter, weil verborgene Abschnitte nicht gemessen werden — und scrollt ihn in Bildschirmhöhen durch.

**Ergebnis beim ersten Lauf: 24 Stellen im Hellmodus, 19 im Dunkelmodus.** Darunter:

| Ratio | Stelle |
|---|---|
| **1,08:1** | „Vorbeugen:" / „Behandeln:" — heller Text auf fest weissem Kasten, im Dunkelmodus praktisch unsichtbar |
| 1,35:1 | „📅 Saisonkalender" — `--c-success-d` wird dunkel zu Hellgrün, auf hellgrünem Verlauf |
| 1,62:1 | „🔄 Fruchtfolge" — `#5d4037` auf dunklem Grund |
| 1,94:1 | „💧 Bewässerungs-Plan" — `#01579b` auf dunklem Grund |
| 2,70:1 | **„💾 Plan speichern"** — weiss auf `#f57c00`. Der wichtigste Knopf des ganzen Bildschirms |

Alle behoben: feste helle Flächen bekommen feste dunkle Schrift, feste dunkle Überschriften werden `var(--text)`, `background:#fff` wird `var(--card)`, `#eee` wird `var(--surface2)`, die Punktzahl-Farben werden Themenvariablen (**eine** feste Farbe kann nicht beide Modi bedienen — `#bf360c` ist hell richtig mit 5,6:1 und dunkel falsch mit 2,8:1). **Jetzt 0 in beiden Modi**, Fenster eingeschlossen.

#### Und die Lehre, die weh tut

Gestern habe ich in v31.76 `#88a888` durch `var(--muted)` ersetzt — „2,62:1, unter AA". Diese Zahl war **falsch**: mein damaliger Behelfs-Prüflauf konnte Verläufe nicht lesen und hielt den Grund für Weiss. In Wahrheit sitzt der Text auf einem dunklen 3D-Feld, wo `#88a888` **6,87:1** hat und `var(--muted)` nur **1,83:1**. Ich habe eine gute Stelle kaputtgemacht, um eine Falschmeldung zu bedienen. **Alle 12 Stellen zurückgenommen.**

Drei Fehler im eigenen Behelfs-Prüflauf, bis er brauchbar war — jeder für sich plausibel:

| Anlauf | Meldung | Warum falsch |
|---|---|---|
| 1 | 10 Fehler, alle „1:1" | `backgroundColor` ist bei einem Verlauf durchsichtig |
| 2 | 14 Fehler | Verlaufsstufen sind oft `rgba(46,125,50,0.08)` — Deckkraft ignoriert = sattes Dunkelgrün statt fast Weiss |
| 3 | 24 Fehler | Text unter einer klebenden, halbdurchsichtigen Kopfleiste gemessen: 1,93:1 für eine Marke, die 7:1 hat |

Der dritte steckt jetzt als Regel im echten Prüfstand: **was von etwas Festem oder Klebendem überlappt wird, wird nicht vermessen.** Hit-Testing allein reicht nicht — eine Leiste mit `pointer-events:none` fängt keinen Treffer ab und verdeckt trotzdem.

#### Prüfstände

`render_check` 2867 · 0 JS-Fehler · 0 verdächtig · **`contrast_check` 0/0 inkl. Planer-Fenster** · `touch_check` 0 · `wiring_check` 0/0/0 · `field_check` 4/303 (die bekannten zusammengesetzten `tp-*`).

#### Offen

Kopfbereich des Planer-Fensters: der Titel „KI-Gartenplaner PRO" wird von der Knopfreihe daneben in eine schmale Spalte gequetscht, „🌳 Bäume" ragt rechts hinaus. Vermessen, nicht behoben.

---

### 2026-09-02 (bn) — v31.76: der gespeicherte Plan meldet sich · das Speichern funktioniert wirklich

Stufe 2 aus `docs/PLANER-V3.md`, erster Teil. Und ein Fehler, der beim Bauen aufgefallen ist und schwerer wiegt als alles Neue.

#### `gsPPsavePlan` hatte den §3.5-Fehler — zum zweiten Mal in dieser Codebasis

```js
try { localStorage.setItem('gs_garden_plans', …); localSaved = true; }
catch (e) { „Speicher voll" + return; }          // lief NIE
```

Der Wrapper (~Z. 7344) **wirft nie**, er gibt `false` zurück. Also: `localSaved = true` auch bei gescheitertem Schreiben, danach der Erfolgs-Toast. Wer bei vollem Gerät einen Plan speicherte, sah „✅ Plan gespeichert" und hatte nichts. Identisch zu `gsTwinSave` in v31.65 — der zweite von den 13 gefährlichen `catch`-Blöcken aus CLAUDE.md §3.5.

Jetzt: Rückgabewert prüfen, stufenweise kürzen (30 → 10 → 5 → 2 → 1), **der neue Plan steht vorn und überlebt als letzter**, und wenn alte weichen mussten, wird es gesagt. Leise löschen wäre schlimmer als der Fehler.

**Ausgelöst, nicht behauptet** (CLAUDE.md §3.5: „Wer einen Rettungsweg für vollen Speicher baut, muss ihn auslösen"). Mit einer gedrosselten `setItem` beide Zweige durchlaufen:

| Fall | Ergebnis |
|---|---|
| Speicher knapp (13 Pläne, Platz für 2) | neuer Plan gesichert, Toast „die 11 ältesten Pläne mussten weichen" |
| Speicher ganz voll | Fehler-Toast, **alter Bestand unverändert**, kein falscher Erfolg |

#### N4 — der Plan altert und meldet sich

Beim Öffnen eines gespeicherten Plans steht oben eine Leiste: wie alt, wie viel umgesetzt, welcher Aussaattermin verstrichen. Kein KI-Aufruf.

Der erste Anlauf meldete *„Tomate vor 150 Tagen fällig"* an einem **19 Tage alten** Plan — der Termin lag schon beim Speichern in der Vergangenheit. Das ist keine verpasste Gelegenheit, sondern ein Plan für eine andere Saison. Jetzt getrennt: fällig **seit** dem Speichern vs. „2 Termine lagen schon beim Speichern in der Vergangenheit".

Ausserdem läuft das **Prüfwerk beim Öffnen neu** — es rechnet mit dem heutigen Saatgut und dem heutigen Regen, und `_jahr` überlebt die JSON-Runde nicht als Datum.

#### R7 Frost — mit dem Unterschied, auf den es ankommt

Frostempfindlich + vor den Eisheiligen ist nur dann ein Fehler, wenn das Datum **ausserhalb** des Vorkultur-Fensters der Referenz liegt. Tomate am 5. April ist die Fensterbank, nicht das Beet. Zwei Zustände statt einem — sonst wäre es dieselbe Falle wie bei R1 gestern.

#### R10 Aufwand über das Jahr

Zweite Säulengrafik neben der Ernte, auf derselben Achse: viel Ernte bei viel Arbeit ist ein fairer Handel, viel Arbeit ohne Ernte nicht. Gezählt werden **Handgriffe je Woche**, keine Minuten — im `careSchedule` steht keine Dauer, und sie zu erfinden wäre genau das, was das Prüfwerk verhindern soll. Die einmalige Aufbauzeit aus `stepByStep.duration_min` gibt es dagegen wirklich.

#### Nebenbei

`3D benötigt Internet · siehe PDF-Plan` stand in `#88a888` auf Weiss — **2,62:1**, unter AA. Der Prüfstand sieht es nicht, weil der Text nur bei fehlgeschlagenem Three.js-Laden erscheint. Gefunden beim Durchmessen des gerenderten Plans, jetzt `var(--muted)`.

#### Prüfstände

`render_check` 2868 · 0 JS-Fehler · 0 verdächtig · `contrast_check` 0/0 · `touch_check` 0 · `wiring_check` 0/0/0 · eigener Durchlauf: 136 Textstellen im gerenderten Plan, beide Modi, alle neuen bestanden.

---

### 2026-09-02 (bm) — v31.75: der Planer denkt in Jahren · Entwurf für V3 im Repo

Fernando: *„Der KI-Planer wurde nicht richtig geupgradet. Ich möchte dass du V3 planst mit wahnsinnig gute ideen und neuerungen."*

Er hat recht, und es lohnt sich zu sagen warum. Was v31.73 unter dem Namen „Planer V3" lieferte, war die **Umsetz-Liste** — der fertige Plan wird zur Checkliste und schreibt echte Pflanzungen. Nützlich, aber ein **Transportweg für das Ergebnis**. Dasselbe gilt für v31.58–v31.65: Zwilling-Kontext, Lichtprüfung, Nachbarschaftsprüfung, ehrlicher Fortschritt. Alles Verbesserungen **am Rand**. Der Plan in der Mitte war seit v24 derselbe: **ein Rechteck, einmal befüllt, für eine Saison.**

#### Der Entwurf: `docs/PLANER-V3.md`

Zehn Neuerungen, fünf Stufen, und eine Trennlinie, die für die ganze App gilt:

| rechnet (Code, prüfbar, offline) | rät (KI) |
|---|---|
| Aussaatfenster, Standdauer, Frost | Sortenwahl und Begründung |
| Platzbedarf, Deckung, Kollisionen | Gestaltung, Reihenfolge |
| Wasserbilanz, Arbeitslast, Ernteverteilung | Tipps, Fallstricke |
| Saatgut-Abgleich, Fruchtfolge-Historie | Klimazonen-Einschätzung |

**Alles links darf die KI vorschlagen, aber nie allein entscheiden.** Die Reihenfolge der Stufen folgt daraus: zuerst alles, was ohne Netz zur KI beweisbar ist.

#### Gebaut: Stufe 1

**Das Gartenjahr.** Ein Beet im Mittelland ist neun Monate nutzbar und trägt drei Kulturen — Radieschen, Bohne, Feldsalat auf demselben Quadratmeter. Im ganzen Schema gab es kein Feld, in dem stünde, dass ein Platz zweimal belegt wird. Neuer Reiter **„Jahr"**: ein Balken je Kultur über März–November, aus `sow_date`/`harvest_from`/`harvest_to`. Wo Daten fehlen, gibt es **keinen** Balken — ein erfundener wäre schlimmer als eine Leerstelle.

**Die Lückenfüller.** Zu jeder Lücke ≥ 6 Wochen sucht `_gsPlanLuecken` in `garden_crop_agronomy` nach Kulturen, deren Aussaat- **und** Erntemonate wirklich hineinfallen — Familie der Hauptkultur ausgeschlossen (Fruchtfolge). Kein KI-Aufruf, eine Auswahl aus geprüften Daten.

**Vier neue rechnende Prüfungen** in derselben Tafel, mit demselben Dreizustandsschema:

| Regel | Was sie fand (Testlauf) |
|---|---|
| R1 Aussaatfenster | „Kohlrabi am 10. Jan — geprüftes Fenster ist Mär/Apr/Jul" |
| R3 Stückzahl | „12× Kohlrabi mit 30 cm braucht 1.08 m², das Feld hat 0.7 — dort passen 7" |
| R4 Saatgut | „2 von 4 hast du schon — abgelaufen: Radieschen Sora. Kaufen: Kohlrabi, Basilikum" |
| R6 Wasser | „braucht 40 l/Woche, gemessener Regen liefert 66 l — das reicht" |

Dazu R11, die Ernte über die Monate als Säulen: zeigt die Zucchini-Schwemme im August neben dem leeren Mai.

#### Zwei Dinge, die der eigene Testlauf korrigiert hat

- **R1 meldete zuerst die Tomate.** Die Referenz sagt „Aussaat Mär/Apr" (Vorkultur), der Plan nennt den 20. Mai (Auspflanzen) — **beides richtig**. Eine Prüfung, die genau die Fälle meldet, in denen die KI recht hat, ist wertlos. Jetzt ein Monat Toleranz, begründet im Code. Kohlrabi im Januar (zwei Monate daneben) bleibt ein Fund.
- **Weiss auf dem Balken sind 3,3:1.** Die Balkenfarbe kommt aus der KI-Antwort und kann alles sein. `_gsAufFarbe()` rechnet die relative Leuchtdichte aus und wählt Schwarz oder Weiss. Nachgemessen: **50 Textstellen, beide Modi, 0 unter AA** — auch auf Gelb (`#ffee58`) und Dunkelgrün (`#1b5e20`).

Ebenso korrigiert: die Balkenbeschriftung ragte aus schmalen Balken heraus. Drei Stufen jetzt — volle Spanne, nur Monate, gar nichts; die volle Angabe steht immer im `title`.

#### Nebenbei: die Release-Liste wieder auf Mass

`GS_RELEASES` war inline auf **27** Einträge gewachsen — CLAUDE.md §3.1 sagt ~12, der Rest gehört ins Archiv. 15 Einträge (31 KB) sind nach `data/releases.v1.js` gewandert, Archiv jetzt 411 Einträge, **keine Doppelten**. Das ist genau der Zweck der Zweiteilung: nicht jeder Kaltstart soll die ganze Historie parsen.

#### Prüfstände

`render_check` 2865 Elemente · 0 JS-Fehler · 0 verdächtige Textstellen · `contrast_check` 0/0 (hell + dunkel) · `touch_check` 0 · `wiring_check` 0/0/0 · eigener Jahr-Durchlauf 0 Fehler, 50 Kontrastmessungen bestanden.

#### Offen (Stufen 2–5 des Entwurfs)

Nachprüfung „Plan gegen Wirklichkeit" · Begründungszeile je Pflanze · Fruchtfolge gegen echte Historie · Mehrbeet-Planung aus dem Zwilling · Varianten-Vergleich · Kalender-Termine · belegbare Preistabelle.

---

### 2026-09-02 (bl) — v31.74: „Angemeldet bleiben" tat nichts · neuer Prüfstand `field_check.py`

Fernando: *„Checke allgemein jede einzelne Seite, jedes Tool und jedes Widget nach Funktionalität, Verdrahtung, ob das speichern funktioniert."*

Der Fehler von gestern (Gartenmasse werden nie gespeichert) wurde beim Lesen gefunden, nicht beim Messen. Daraus wurde ein Prüfstand.

#### Was er sucht — die Umkehrung von `wiring_check`

`wiring_check` fragt: *kommt an, was angetippt wird?* `field_check.py` fragt: **liest überhaupt jemand, was eingegeben wird?**

Er zählt jedes Vorkommen einer Feld-id im Quelltext **ausserhalb ihrer eigenen Definition**. Bewusst grob — so erfasst er auch Helfer (`g('x')`), maskierte Anführungszeichen (`\'x\'`) und jede querySelector-Variante.

#### Drei Anläufe, bis er brauchbar war

| Anlauf | Ergebnis | Warum falsch |
|---|---|---|
| 1 | **172 von 172 kaputt** | Suchmuster im Template kaputt-maskiert |
| 2 | 37 kaputt | zählte `onchange="savePref(…,this.checked)"` nicht mit — meldete fast jede Einstellung |
| 3 | 11 kaputt | fand `getElementById(\'x\')` mit maskierten Anführungszeichen nicht, und Helfer `g('x')` |
| 4 | **1 echter Fund** von 303 | zählt jedes Vorkommen ausserhalb der Definition |

Ein Werkzeug, das alles für defekt erklärt, ist schlechter als keines. Die Grenzen stehen jetzt im Prüfstand selbst und in CLAUDE.md §7.1.

**Was er nicht finden kann:** zusammengesetzte Namen. `getElementById('tp-' + k)` ist von keiner Textsuche zu erfassen — `tp-len`/`tp-wid`/`tp-soil`/`tp-light` sind so verdrahtet und funktionieren. Sie bleiben als bekannte Fehlalarme in der Ausgabe, dokumentiert.

#### Der eine echte Fund

**„Angemeldet bleiben" wurde nie gelesen.** `onbDoLogin()` holt E-Mail und Passwort — der Haken `onb-login-remember` kommt in der ganzen Datei kein zweites Mal vor. Er ist vorangekreuzt, also passte das Verhalten zum Standard. Aber wer ihn auf einem **geteilten Gerät** bewusst entfernte, blieb trotzdem angemeldet. Eine Zusage, die die App nicht hielt — und auf einem fremden Rechner keine Kleinigkeit.

Umgesetzt, **ohne den Token-Weg anzufassen** (jeder Leser holt ihn über `gsStore`): ein Merker in `localStorage` sagt „nur diese Sitzung", ein zweiter in `sessionStorage` sagt „dieselbe Sitzung wie damals". Beim Start ohne den zweiten wird abgemeldet — genau dann, wenn der Browser zwischendurch zu war. Die Prüfung läuft **vor** dem Login-Flash-Guard, damit gar kein `#app` aufblitzt.

Nur die Anmeldung fällt weg. Pflanzen, Gärten und Einstellungen bleiben — die gehören dem Gerät, nicht der Sitzung.

```
A · Haken gesetzt, neue Sitzung        → angemeldet (preauth false)
B · ohne Haken, Sitzung lebt noch      → angemeldet (preauth false)
C · ohne Haken, Browser war geschlossen→ abgemeldet (preauth true),
                                          Merker geräumt, Pflanzen + Gärten da
```

**Zur Ehrlichkeit der Messung:** in A und B zeigt der Test `token:false` — das ist nicht mein Code, sondern die App-eigene Token-Prüfung, die mein Platzhalter-Token (`'tok'`, kein echtes JWT) verwirft. Das aussagekräftige Signal ist `preauth`, das zum Zeitpunkt des Guards gesetzt wird, und es trennt alle drei Fälle richtig.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 48/0 · 940 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `field_check` 303 Felder, 4 bekannte Fehlalarme, 0 echte · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · drei Sitzungs-Fälle durchgespielt · `GS_RELEASES[0].v` = `GS_VERSION` · `gsAllReleases()` 421 → **422**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.74 · `sw.js` gs-v31.74 · `_headers` v31.74 · meta 31.74.20260902.

#### Offen aus Fernandos Liste

Scanner V2 · Blühkalender ausbauen · Arten-Infos vervollständigen. Der Funktionscheck geht weiter: `field_check` deckt Eingaben ab, aber nicht, ob die gespeicherten Werte beim nächsten Öffnen auch **angezeigt** werden.

---

### 2026-09-02 (bk) — v31.73: Planer V3 — der Plan wird zur Checkliste

Fernando: *„sobald man ein neuen Plan hat kann man diese sachen auf den eigenen Garten übertragen … der Nutzer kann dann einzelne Sachen Schritt für Schritt wie abhacken und es wird dann automatisch im Garten hinzugefügt. Mit dem Abstand und weiteren Angaben vom generierten Ki-planer."*

#### Der Plan wusste alles — nur übernommen hat es niemand

Ein Plan enthält je Pflanze: Position in Metern, Abstand in cm, Pflanztiefe, Wasserbedarf pro Woche, Saatdatum, Erntefenster, eine Begründung. Das alles stand im Dokument, und wer es im Garten haben wollte, musste es abtippen.

Jetzt ein Reiter **„✅ Umsetzen"** mit einer Zeile je Pflanze. Ein Tipp legt sie im gewählten Garten an:

```
name    „Tomate"
count   3
date    „2026-04-15"            (Saatdatum aus dem Plan)
notes   „Aus KI-Plan · Position 0.4/0.2 m · Abstand 60 cm · Tiefe 2 cm
         · 8 l Wasser/Woche · Ernte ab 2026-07-10 · Sonnig stellen"
```

#### Drei Entscheidungen, die dazugehören

**Zurücknehmen muss gehen.** Nochmal antippen entfernt die Pflanzung wieder. Eine Liste, aus der man nicht herauskommt, ist eine Falle — ein Fehlgriff (falscher Garten, falsche Pflanze) muss sich korrigieren lassen.

**Der Fortschritt hängt am Plan, nicht am Bildschirm.** Der Schlüssel wird aus Fläche und Pflanzennamen gebildet: derselbe Plan ergibt denselben Schlüssel. Fenster schliessen, wiederkommen — „2 von 3 übernommen" steht noch da. Und beim Speichern wird der **Rückgabewert** geprüft, nicht auf eine Ausnahme gewartet (CLAUDE.md §3.5): bei vollem Speicher sagt die App das.

**Ohne Garten kein Blindflug.** Gibt es keinen Garten, steht das da — samt Knopf, der direkt zum Anlegen führt. Eine Auswahlliste ohne Auswahl wäre eine Frage ohne Antwort.

Durchgespielt:

```
Reiter        📋 Überblick · ✅ Umsetzen · 🌱 Pflanzen · 🌐 3D
Liste         3 Zeilen, „0 von 3 übernommen"
übernehmen    plantings 0 → 1, „✓ Tomate in „Hochbeet Nord" angelegt"
              mit Position, Abstand, Tiefe, Wasser, Erntedatum, Notiz
zurücknehmen  plantings 1 → 0, „Zurückgenommen: Tomate"
neu rendern   „2 von 3 übernommen", 2 Zeilen abgehakt
ohne Garten   Hinweis mit Anlegen-Knopf
```

Farben 4,74 bis 18,88:1 in beiden Modi.

#### Ein Fehler in meinem eigenen Test, kein App-Fehler

Der erste Durchlauf legte nichts an. Diagnose statt Raten: `plan_da: false` — `_gsPP.plan` war leer. Ursache: mein Test setzte den Plan **vor** `openGardenAI()`, und das setzt `_gsPP` zurück. Der Aufbau war falsch, nicht der Code. Wer so testet, muss den Zustand nach dem Öffnen setzen.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 48/0 · 939 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · sechs Umsetz-Fälle durchgespielt · Farben gerechnet · `GS_RELEASES[0].v` = `GS_VERSION` · `gsAllReleases()` 420 → **421**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.73 · `sw.js` gs-v31.73 · `_headers` v31.73 · meta 31.73.20260902.

#### Offen aus Fernandos Liste

Scanner V2 · Blühkalender ausbauen · Arten vervollständigen · der grosse Funktionscheck über alle Seiten, Werkzeuge und Speicherwege.

---

### 2026-09-02 (bj) — v31.72: Die Gartenmasse wurden nie gespeichert

Fernando: *„Dann möchte ich das beim Garten hinzufügen du das mehr aufbaust … Mein Garten soll vom Ki-Planer als Option angesehen werden, so muss mann nicht immer die Masse und weiteres von neuem Angeben."*

Beim Nachsehen, warum man die Masse doppelt eingeben muss, kam die eigentliche Ursache heraus.

#### Der Leser war da, der Schreiber fehlte

Das Garten-Formular hat `gard-width` und `gard-length`. `gsUpdateGardenArea` rechnet daraus live „📐 Fläche: 15.0 m² (3 m × 5 m)". Und `editGarden` **liest** `g.width`/`g.length`, um sie beim Bearbeiten wieder einzusetzen.

Nur schreibt sie niemand. `saveGarden()` baute sein `data`-Objekt aus Name, Standort, Grösse, Licht und Boden — die Masse fehlten.

Folge: man tippt 3 × 5 m ein, sieht die Fläche, speichert — und beim nächsten Öffnen sind die Felder leer. **Genau deshalb muss Fernando die Masse jedes Mal neu angeben.** Der Weg vom Formular in die Daten war nie gebaut; alles davor und danach schon.

Jetzt gespeichert, und nur was wirklich eingegeben wurde: 0 oder Unsinn wird verworfen — ein Garten mit 0 m² wäre schlechter als einer ohne Massangabe. Auf der Gartenkarte steht die Fläche statt der groben Stufe („15 m²" sagt mehr als „Mittel"), was gleichzeitig zeigt, dass die Eingabe angekommen ist.

```
Vorschau        „📐 Fläche: 15.0 m² (3 m × 5 m)"
gespeichert     {"width":3,"length":5}
beim Bearbeiten {"w":"3","l":"5"}
Karte           „Bern · 0 gepflanzt · 15 m² · ⛅ Halbschatten"
ohne Masse      {"width":null,"length":null}  → Karte zeigt „🌿 Mittel"
```

#### Einen Garten in den Planer übernehmen

Ganz oben in Schritt 1, **vor** der Flächenerfassung: wer seinen Garten angelegt hat, soll ihn nicht ein zweites Mal ausmessen. Übernommen werden Masse, Standort, Licht und Boden — und die Meldung sagt, **was** übernommen wurde.

Ein Garten ohne Masse füllt die Massfelder **nicht**: er gibt Standort, Licht und Boden, und die Fläche misst man wie bisher. Erfundene Zahlen wären schlimmer als leere Felder. Gibt es gar keine Gärten, erscheint der Kasten nicht — eine leere Auswahl ist eine Frage ohne Antwort.

Die Fläche wird dabei **nicht** selbst gesetzt: das Feld ist `readonly` und wird von `gsPPcalcArea` aus Breite × Länge berechnet. Eine zweite Stelle, die dieselbe Zahl schreibt, läuft früher oder später auseinander.

```
Hochbeet Nord (3×5)   → Breite, Länge, Fläche, Standort, Licht, Boden
Balkon ohne Masse     → Standort, Licht, Boden   (Massfelder unberührt)
keine Gärten          → Kasten erscheint nicht
```

#### Der Lebenszyklus als Warteanzeige

Fernando: *„eine Pflanze die vom Sammen aus wächst, alt wird, kaputt geht und dann eine neue wächst."*

Sieben Phasen über elf Sekunden: Same → Keimling → Blätter → Blüte/Frucht → Vergehen (kippt und verblasst) → neuer Same. Danach die nächste Art. Sieben Arten mit eigener Form: Blume (Sonnenblume, Mohn), Frucht (Tomate, Kürbis), Baum (Apfel), Ähre (Lavendel), Wurzel (Karotte).

Gezeichnet auf einer Leinwand statt mit Bildern: kostet keine Datei und lässt sich in jeder Farbe malen. `prefers-reduced-motion` bekommt ein **stehendes Bild** der ausgewachsenen Pflanze — kein Zappeln, aber auch keine leere Fläche.

Gemessen an den gezeichneten Bildpunkten: leer 0 → nach 1 s 3466 → nach 6 s 5436 (Blüte) → nach 12 s neue Art. Nach `gsZyklusStop` steht das Bild still.

**Und die Animation muss überall stoppen.** Der Ladebereich wird an **sieben** Stellen versteckt — Erfolg, kein Ergebnis, Fehler, Abbruch. An allen sieben wird jetzt gestoppt; sonst hielte ein `requestAnimationFrame` das Telefon wach, während niemand hinsieht.

#### Zwei erfundene Zahlen weniger

Der Ladebereich zeigte statisch „5 %" und „~ 60 s" — bevor irgendetwas gelaufen war. Genau das, was v31.65 aus dem Balken entfernt hat, stand noch im HTML. Beide leer; `gsPPstufe` füllt sie, sobald es etwas zu sagen gibt.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 48/0 · 936 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Garten-Speichern in sechs Schritten durchgespielt · Vorlage-Übernahme in drei Fällen · Zyklus an den gezeichneten Bildpunkten gemessen und als Bild angesehen · `GS_RELEASES[0].v` = `GS_VERSION` · `gsAllReleases()` 419 → **420**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.72 · `sw.js` gs-v31.72 · `_headers` v31.72 · meta 31.72.20260902.

---

### 2026-09-02 (bi) — v31.71: Nur Aufgaben in den Schritten, Bilanz zuklappbar, Doktor ins Menü

Drei Korrekturen aus Fernandos Liste — die erste widerlegt eine Entscheidung, die ich gestern getroffen habe.

#### Der Wetter-Rat gehört nicht in eine Aufgabenliste

Fernando: *„Dort sollen nur aufgaben aufplopen und nicht das Wetter."*

In v31.69 hatte ich den Wetter-Rat in „Nächste Schritte" gestellt, mit der Begründung, er sei wie die anderen beiden eine Empfehlung. Das stimmt — und trifft trotzdem nicht.

Der schärfere Grund: **ein Schritt ist etwas, das man tut und abhaken kann.** „Morgen wird heiss (29 °C)" ist eine Lage, keine Aufgabe. Es stünde in der Liste, ohne je zu verschwinden — während alles daneben abgehakt wird.

Der Rat ist nicht weg, er steht jetzt in der **Wetterkarte** als deren Beschreibungszeile. Dort ist er richtig, denn er ist aus dem Wetter abgeleitet. `gsBuildSmartReminder` weiss mehr als der bisherige einfache Tipp: Frost in den nächsten Stunden, Regen in den nächsten zwölf, Trockenperiode, Zahl der giess-fälligen Pflanzen. Hat es etwas zu sagen, sagt es das; sonst bleibt der einfache Tipp.

```
Frost in 12 h      → „❄️ Frost in den nächsten Stunden!"
Regen kommt        → „🌧️ Giessen kannst du heute sparen"
morgen heiss       → „☀️ Morgen wird heiss (29°C)"
nichts Besonderes  → „💧 1 Pflanze giessen"
Wetter in den Schritten? → nein
```

#### Die Bilanz klappt zu

`grid-template-rows: 0fr → 1fr` statt `max-height`. Das ist der eine Weg, der die Höhe **weich** animiert, ohne sie vorher zu kennen: `max-height` braucht einen geratenen Endwert (zu klein schneidet ab, zu gross macht die Bewegung ruckartig), und `height:auto` lässt sich gar nicht animieren.

Startet zugeklappt — wer ganz nach unten scrollt, ist am Ende der Seite angekommen, nicht auf der Suche nach der Bilanz. Der Zustand wird gemerkt, **aber nur wenn ein Mensch getippt hat**: das Wiederherstellen beim Aufbau darf nicht als neue Entscheidung zählen.

```
1 · beim Aufbau    zu    · 0px   · gemerkt: nichts
2 · nach Antippen  offen · 74px  · gemerkt: 1
3 · nochmal        zu    · 0px   · gemerkt: 0
4 · Neuaufbau      offen bleibt offen
5 · ohne Bewegung  offen, Übergang ~0 s
```

#### Der Pflanzendoktor ist im Menü

Samt Fragebogen und den vier Diagnose-Werkzeugen, die in ihm stecken. Damit ist auf „Mein Garten" **keine** Werkzeug-Zeile mehr übrig. Menü-Einträge 47 → **48**, davon kaputt: 0; alle 18 Umzugsziele weiterhin erreichbar.

Die Seite: **1019 px, 1,1 Bildschirme** (zugeklappt).

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü **48**/0 · 933 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · vier Wetter-Fälle und fünf Klapp-Fälle durchgespielt (inkl. abgeschalteter Bewegung) · alle 18 Umzugsziele erneut geprüft · `GS_RELEASES[0].v` = `GS_VERSION` · `gsAllReleases()` 418 → **419**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.71 · `sw.js` gs-v31.71 · `_headers` v31.71 · meta 31.71.20260902.

#### Als Nächstes aus Fernandos Liste

Garten als Planer-Vorlage · Lebenszyklus-Animation beim Generieren · Planer V3 mit Schritt-für-Schritt-Übernahme in den Garten · Blühkalender ausbauen · Arten vervollständigen · grosser Funktionscheck.

---

### 2026-09-01 (bh) — v31.70: Fragebogen im Pflanzendoktor, drei Gruppen umgezogen

Die restlichen drei Punkte aus Fernandos Liste.

#### Der Fragebogen — der Inhalt war schon da, nur an der falschen Stelle

Fernando: *„anhand von Bilder und einem Fragebogen gezielt eine sehr gute diagnose"*.

Der Doktor hatte ein Notizfeld mit dem Platzhalter **„z.B. seit wann · Standort · Düngung · Wassergabe…"**. Das ist der Fragebogen — als grauer Beispieltext in einem leeren Feld. So beantwortet ihn niemand.

Jetzt sechs Fragen mit Antworten zum Antippen:

| Frage | warum sie zählt |
|---|---|
| Seit wann? | akut oder chronisch |
| **Wo an der Pflanze?** | junge gegen alte Blätter trennt Stickstoff- von Eisenmangel |
| **Breitet es sich aus?** | eine Pflanze gegen mehrere trennt Standortproblem von Krankheit |
| Standort | drinnen/draussen/Gewächshaus/Balkon |
| Zuletzt gegossen | die häufigste Ursache überhaupt |
| Zuletzt gedüngt | Mangel oder Überdüngung |

Die zwei fett markierten sind nicht aus dem Platzhalter — sie machen in der Pflanzenpathologie den grössten Unterschied.

Alles freiwillig. Was leer bleibt, geht **nicht** in die Anfrage: eine geratene Antwort ist schlechter als keine. Erneutes Antippen wählt ab — sonst könnte man eine versehentliche Angabe nie zurücknehmen.

Die Antworten werden dem Freitext vorangestellt statt in ein neues Feld gelegt: die Edge-Function reicht `user_note` an die KI durch, ein neues Feld müsste dort erst ausgewertet werden. **Ein Fragebogen, dessen Antworten nirgends ankommen, wäre Zierde** — auf diesem Weg wirkt er sofort.

Durchgespielt: 6 Fragen / 24 Knöpfe · leer → `[]` · drei gesetzt → drei Zeilen · Wechseln ersetzt · nochmal tippen wählt ab · in der Anfrage steht `„Wo an der Pflanze? junge Blätter · Zuletzt gegossen unregelmässig\nBlätter fühlen sich weich an"` · Neu-Öffnen setzt zurück.

#### Achtzehn Werkzeuge haben einen Ort bekommen

| Gruppe | wohin | warum |
|---|---|---|
| 🩺 Pflege & Diagnose (5) | 4 in den **Pflanzendoktor**, unter die Diagnose | wer den Doktor öffnet, will zuerst diagnostizieren; wer nicht weiterkommt, sucht dort den Schädling-Scanner |
| 🗓️ Planen & Gestalten (6) | in den **KI-Planer** | alles davon ist Planung; auf der Gartenseite war es eine zweite Tür zum selben Raum |
| 📚 Wissen & Werkzeuge (7) | ins **Hauptmenü** | ein Sammelsurium aus Spielstand, Nachschlagewerk, Statistik und Zubehör — dort stehen sie neben ihresgleichen und sind durchsuchbar |

Auf „Mein Garten" bleibt **eine** Zeile: „🩺 Pflanzendoktor · Foto + Fragebogen".

**Nachgemessen statt gehofft.** Alle 18 Ziele am laufenden Programm geprüft — jedes ist von mindestens einer Stelle erreichbar, **keines begraben**:

```
openDoctorModal            Garten          gsPPopenSavedPlans         Planer
openPestModal              Doktor          gsSeasonalOpen             Planer
gsDiseaseOpen              Doktor          openRegionalCalendarModal  Planer
openSoilAmendmentModal     Doktor          openGardenLayoutsModal     Planer
openFertilizerModal        Doktor          openForestGardenModal      Planer
                                           gsBeeFriendlyOpen          Planer
openAchievementsModal      Menü            openHarvestStatsModal      Menü
gsOpenGardenLibrary        Menü            openDiaryEntryModal        Menü
gsInsightsOpen             Menü            gsVoiceOpen                Menü
                                           gsShOpen                   Menü
```

Menü-Einträge 40 → **47**, davon kaputt: **0**.

Die Gartenseite: **213 → 132 Elemente**. Antippbare Stellen 48 → 31 — diesmal ein gewollter Rückgang, und der einzige Fall in dieser Reihe, in dem er richtig ist: die 18 Einträge sind nicht weg, sie sind woanders.

#### Ein Verlust, den ich benenne statt zu verschweigen

Der Sensor-Dashboard-Knopf trug einen **Live-Punkt** (`gs-sh-livedot`), der anzeigte, dass mindestens ein Sensor online ist. Ein Menü-Eintrag kann ihn nicht tragen — `MENU_ITEMS` kennt nur Beschriftung und Unterzeile. Der Hinweis ist damit weg, und das ist ein echter Verlust: er war die einzige Stelle, an der man ohne Öffnen sah, dass Sensoren laufen. Der Status steht weiterhin im Dashboard selbst („n Sensoren · m online").

Gefunden hat das mein eigener Prüfstand: vor dem Umzug 0 verwaiste Nachschlagungen, danach 1. **Wer Sensoren wirklich nutzt, soll es sagen — dann bekommt der Menü-Eintrag ein Merkmal.**

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü **47**/0 · 931 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Fragebogen in sieben Schritten durchgespielt · alle 18 Umzugsziele auf Erreichbarkeit geprüft · `GS_RELEASES[0].v` = `GS_VERSION` geprüft · `gsAllReleases()` 417 → **418**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.70 · `sw.js` gs-v31.70 · `_headers` v31.70 · meta 31.70.20260901.

---

### 2026-09-01 (bg) — v31.69: Drei Widgets, die dasselbe sagten, sind eins geworden

Fernandos Liste hatte sechs Punkte. Zwei davon — *„Das Wetter ist zwei mal darauf"* und *„Im September im Garten → soll bei nächsten Schritt angezeigt werden"* — hatten dieselbe Ursache, die er selbst nicht benannt hat.

#### Der Befund

Auf der Seite standen **drei** Kästen, die alle dieselbe Frage beantworteten: *was ist jetzt zu tun?*

| Widget | Inhalt |
|---|---|
| „Nächster Schritt" | die nächste fällige Pflanzen-Aufgabe |
| Wetter-Ratgeber | „Morgen wird heiss (28°C)" · „Frost in den nächsten Stunden!" · „Giessen kannst du heute sparen" |
| „📅 Im September im Garten" | die Saison-Aufgaben |

Drei Überschriften, drei Rahmen, eine Frage. Fernando sah beim mittleren „ein zweites Wetter-Widget" — richtig, aber der Inhalt ist **Handlungsrat**, kein Wetter. Genau deshalb gehört er zu den anderen beiden.

#### Eine Liste, nach Dringlichkeit

```
1. Wetter-Warnung   zeitkritisch — heute Abend oder gar nicht (roter Streifen)
2. Fällige Pflege   was JETZT dran ist, direkt abhakbar (bis zu 3, Rest gebündelt)
3. Saison           was diesen Monat ansteht, ohne Termin
```

`gsBuildSmartReminder` bleibt die Quelle für Punkt 1 — die Logik dort (Frost ≤ 1 °C, Regen ≥ 70 %, Hitze ≥ 26 °C, Trockenperiode ≥ 4 Tage) ist gut und wird nicht dupliziert, nur anders dargestellt.

Die Saison-Aufgaben kommen aus Supabase und werden **nachgetragen**, sobald sie da sind (`gsFillSaisonSchritte`). Die Übersicht darauf warten zu lassen hiesse, die halbe Seite für einen Netzaufruf anzuhalten. Beim Nachtragen wird das Element erneut gesucht — zwischen `await` und Rückkehr kann die Seite neu gebaut worden sein.

Durchgespielt:

```
A · nichts fällig        → eine Zeile „Alles versorgt"
B · Frost + 5 fällige    → Frost (rot) · 3 abhakbare · „Und 2 weitere fällig"
C · + Saison             → zwei Zeilen „Im September im Garten · 3 Aufgaben"
D · zweiter Aufruf       → 7 Zeilen, keine Dopplung
```

#### Nur noch ein Wetter-Widget

Die Prognose steht jetzt in der Wetterkarte: „Morgen ☀️ 29° / 18° · 45 % Regen". Regen nur, wenn er eine Rolle spielt (ab 20 %) — „0 % Regen" ist keine Information.

**Und dabei ein Fehler, der still durchgegangen wäre:** die Wetter-Schnittstelle wurde gar nicht nach `precipitation_probability_max` gefragt. Der Code hätte richtig ausgesehen und den Regen **nie** angezeigt. Feld ergänzt, plus ein Rückfall auf Millimeter für Antworten aus dem 30-Minuten-Cache, die von vor dieser Version stammen.

Vier Fälle nachgestellt:

```
mit Wahrscheinlichkeit    → „Morgen ☀️ 28° / 17° · 45 % Regen"
trocken                   → „Morgen ☀️ 24° / 12°"        (kein Regenteil)
alte Antwort ohne Feld    → „Morgen 🌧️ 15° / 9° · 4.2 mm Regen"
nur ein Tag Daten         → leer                          (keine erfundene Prognose)
```

#### Die Zahlen nach unten

„Mein Garten in Zahlen" ist eine Bilanz. Sie beantwortet eine Frage, die niemand stellt, bevor er gesehen hat, was ansteht. `gsRenderGardenOverview` schreibt jetzt in drei Ziele (`#garden-overview`, `#garden-cta`, `#garden-zahlen`); fehlt eines, bleibt alles beisammen.

#### Toter Code mitgenommen

`gsRenderSeasonalInline` (2092 Zeichen) baute den Kasten, den es nicht mehr gibt — entfernt. Der Schreiber für `#garden-smart-reminder` ebenso. Beide hatte `wiring_check` sofort als verwaiste Nachschlagungen gemeldet; danach wieder **0**.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 931 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Farben der Liste 5,13 bis 18,88:1 beide Modi · vier Schritte-Fälle und vier Wetter-Fälle durchgespielt · antippbare Stellen 48 → 48 (die Zeile „Alles versorgt" führt weiterhin zu den Pflanzen) · beide Modi als Bild angesehen · `GS_RELEASES[0].v` = `GS_VERSION` geprüft · `gsAllReleases()` 416 → **417**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.69 · `sw.js` gs-v31.69 · `_headers` v31.69 · meta 31.69.20260901.

#### Offen aus Fernandos Liste

Drei Punkte kommen als eigener Release: „Pflege & Diagnose" in den Pflanzendoktor (mit Fragebogen), „Wissen & Werkzeuge" woandershin, „Planen & Gestalten" ausblenden oder durchdacht lösen. Das sind Umzüge über mehrere Fenster — die gehören nicht in denselben Release wie eine Layout-Umstellung.

---

### 2026-09-01 (bf) — v31.68: Die Gärten nach oben, vier Abschnitte statt eines Stapels

Fernando, nach zwei Kürzungsrunden: *„Ich finde immer noch dass die Seite (Mein Garten) soviele Sachen/Widget hat und es chaotisch wirkt. Der eigene Garten muss zudem höher gelistet werden."*

Er hat recht, und ich hatte am falschen Hebel gezogen. In v31.64 und v31.66 habe ich **gekürzt** — von 1,9 auf 1,3 Bildschirme. Aber die **Reihenfolge** habe ich nie in Frage gestellt.

#### Der Befund

Die tatsächliche Reihenfolge der Seite „Mein Garten":

```
 1. Kopfzeile          6. Werkzeugkacheln
 2. Zahlen             7. Mondkalender
 3. Nächster Schritt   8. Statistik-Karte
 4. Garten scannen     9. ── MEINE GÄRTEN ──   ← hier erst
 5. Gartenwetter      10. Einpflanzen / KI-Planer
```

Die Gärten standen an **neunter** Stelle. Wer „Mein Garten" öffnet, sucht seinen Garten — nicht den Mondkalender.

Und das „Chaos" kam nicht von der Menge: es waren zehn gleich aussehende Karten **ohne eine einzige Überschrift**. Nichts sagte, was zusammengehört.

#### Vier Abschnitte, in der Reihenfolge, in der man fragt

| | |
|---|---|
| 🪴 **MEIN GARTEN** | die Gärten selbst (mit „+ Garten" daneben), die Zahlen dazu, was ansteht |
| ⚡ **TUN** | Einpflanzen · KI-Planer · Garten scannen |
| ☀️ **HEUTE** | Wetter und Mond |
| 🧰 **WERKZEUGE** | Säen/Tagebuch/Ernte/Blumen und die drei Gruppen |

Die Zahlen stehen jetzt **unter** den Gärten statt darüber: sie fassen zusammen, was man gerade gesehen hat. Vorher standen sie vor dem, was sie beschreiben.

Der Scan-Knopf ist aus der Übersicht nach „Tun" gewandert — er ist eine Handlung, keine Übersicht. `gsRenderGardenOverview` rendert ihn jetzt in einen eigenen Container; fehlt der, bleibt alles beisammen (ein Knopf, der nirgends landet, wäre schlimmer als einer am falschen Ort).

#### Wetter und Mond in eine Karte

Beide beantworten dieselbe Frage. Ein Trennstrich statt einer zweiten Karte, beide Zeilen weiter einzeln antippbar. Beim Zusammenlegen polsterte es doppelt (`#moon-widget` ist nur ein Behälter, die Zeile darin bringt ihr eigenes Polster mit) — **gemessen 158 statt 116 px**, dann behoben.

#### Der Widerspruch, den erst die neue Reihenfolge zeigte

Auf den Gartenkarten stand „0 Pflanzen" — und direkt darunter „8 Pflanzen in Pflege". Beides stimmt: `plantings` sind Einpflanzungen **in dieses Beet** (Datum, Menge, über „Einpflanzen" angelegt), `myPlants` sind Pflanzen **in deiner Pflege** (Giessplan, Aufgaben). Solange die Gärten unten standen, sah man beides nie zusammen.

Jetzt sagt die Karte **„0 gepflanzt"**. Erster Versuch war „noch nichts eingepflanzt" — zu lang, die Zeile brach um und die Seite wurde länger statt kürzer. Gemessen, verworfen, ersetzt.

#### Diesmal keine Kürzung, sondern eine Ordnung

```
1 Garten :  1071px → 1076px   +5px
3 Gärten :  1205px → 1210px   +5px
6 Gärten :  1406px → 1411px   +5px
```

Die vier Überschriften kosten rund 48 px; die zusammengelegte Heute-Karte, der gekürzte Erklärsatz und die geschlossene Lücke bringen sie wieder herein. **Das ist ehrlich so zu sagen: dieser Release macht die Seite nicht kürzer, er macht sie lesbar.** Eine Grössenersparnis zu behaupten wäre falsch. Antippbare Stellen unverändert 38/48/63.

#### Und ein Fehler von mir, den der eigene Prüfstand gefunden hat

Der neue „+ Garten"-Knopf war **41×15 px** — unter den 24×24 aus WCAG 2.5.8. `touch_check` hat ihn gemeldet, bevor er ausgeliefert wurde.

Dazu ein zweiter: meine Befehlskette lief aus dem Scratchpad-Verzeichnis, die relativen `sed`-Pfade trafen eine alte Kopie statt des Repos, und die Kette brach ab, bevor der `GS_RELEASES`-Eintrag gesetzt war. Ergebnis: `GS_VERSION` v31.68, Changelog v31.67 — der „Was ist neu"-Dialog wäre stumm geblieben. Gefunden von `relcheck`, der genau diese Gleichheit prüft. **Nach jedem Versions-Bump gehört diese Prüfung gefahren, nicht nur die Prüfstände.**

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 930 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 (nach dem Fund) · Überschriften 4,87 / 7,84:1, „+ Garten" 5,99 / 7,77:1 · Hell- und Dunkelmodus als Bild angesehen · Höhe bei 1/3/6 Gärten · `GS_RELEASES[0].v` = `GS_VERSION` geprüft · `gsAllReleases()` 415 → **416**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.68 · `sw.js` gs-v31.68 · `_headers` v31.68 · meta 31.68.20260901.

---

### 2026-09-01 (be) — v31.67: Rasen statt Filz, ein Knopf ins Leere, und eine Messung, die mich widerlegt hat

#### Der Scanner bot an, was nicht gehen kann

Der Scanner-Bildschirm ohne Kamera, angesehen statt gelesen: der Text sagt *„Dein Gerät hat keine zugängliche Kamera — bitte Foto hochladen."* Darunter, in voller Breite und vollem Grün, der auffälligste Knopf der Seite: **„🔄 Kamera erneut öffnen"**.

Die Gewichtung stand auf dem Kopf. Der Weg, der **jetzt** funktioniert (die gestrichelte Fläche „Foto aus Galerie wählen"), sah zweitrangig aus; der Weg, der gerade gescheitert ist, sah aus wie der Hauptweg. Und bei `NotFoundError` — kein Kameragerät vorhanden — kann das Wiederholen **nie** gelingen.

| Fall | Wiederholen-Knopf |
|---|---|
| keine Kamera vorhanden | **weg** — er könnte nie funktionieren |
| Erlaubnis verweigert | bleibt — der Mensch kann sie erteilen |
| Kamera von anderer App belegt | bleibt — die App lässt sich schliessen |

Der Knopf ist ausserdem von Vollgrün auf Kartenoptik zurückgestuft, damit die Hochladefläche der Hauptweg ist. Text 12,16:1 hell / 9,47:1 dunkel. Alle drei Fälle am laufenden Programm nachgestellt.

#### Der Rasen war Filz

Im 3D-Modell eine glatte Fläche in `0x2e5d2e` — das Beet wirkte daraufgeklebt statt darin zu stehen. Zwei billige Änderungen: eine gemalte Grastextur (2600 Halme, deterministisch aus festem Startwert, damit beim Neuzeichnen nichts flackert) und ein weicher Kontaktschatten rings um das Beet. Der Sonnenschatten trifft nur eine Seite; ein Körper auf dem Boden dunkelt ihn ringsum ab. Ohne diesen Kontakt schwebt alles.

#### Und die Messung, die mich widerlegt hat

Die Namensschilder aus v31.66 flackerten während der Eröffnungsdrehung: **14 Zustandswechsel in fünf Sekunden**, einzelne Schilder bis zu fünfmal. Zwei Mittel: Trägheit (ein Wechsel braucht drei aufeinanderfolgende Auswertungen) und seltenere Auswertung während der Drehung (alle 400 ms statt 100 ms). Ergebnis: **14 → 8**.

Dabei fiel ein Fehler in meiner **eigenen Messung von gestern** auf. Ich hatte die Sichtbarkeit 900 ms nach dem Aufbau gemessen — mitten in der Eröffnungsdrehung, bevor überhaupt etwas ausgeblendet sein kann. Die schönen „100 %" waren ein Artefakt. Am eingeschwungenen Bild gemessen sieht es anders aus.

Und damit war auch mein Stufen-Vergleich von gestern ungültig. Nachgeholt, vier Varianten, 5/7/9/12 Pflanzen, jeweils nach dem Einschwingen:

```
3 x 0,20 m :  4/5   6/7   6/9   10/12   = 79 %   ← gewählt
5 x 0,26 m :  3/5   5/7   8/9    8/12   = 73 %
4 x 0,24 m :  4/5   5/7   5/9    7/12   = 64 %
4 x 0,30 m :  5/5   5/7   5/9    6/12   = 64 %
```

**Drei Stufen gewinnen** — genau der Wert, den ich in v31.66 als „Verbesserung" auf vier erhöht hatte, weil es plausibel klang. Mehr Stufen sind hier nicht besser: hoch gestapelte Schilder wandern in den Bereich der Nachbarn dahinter. Der Befund steht jetzt als Tabelle im Code, damit ihn nicht der Nächste erneut „verbessert".

Endstand sichtbarer Schilder: 100 / 80 / 86 / 78 / 83 % bei 3/5/7/9/12 Pflanzen.

**Eine Warnung an mich selbst:** die Mess-Schleife schreibt die Quelldatei um. Sie lief in die Zeitgrenze und ihre Aufräumzeile kam nicht mehr dran — `index.html` trug danach die Variante `5 × 0,34`. Gemerkt, weil ich nachgesehen habe. Wer so misst, prüft danach den Dateizustand.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · **929** Nachschlagungen (die neue id `sr-retry-cam`) / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · drei Kamera-Fehlerfälle nachgestellt · Modell in vier Stufen-Varianten × vier Bestückungen vermessen · Flackern über 50 Abtastungen gezählt · Modell als Bild angesehen · `gsAllReleases()` 414 → **415**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.67 · `sw.js` gs-v31.67 · `_headers` v31.67 · meta 31.67.20260901.

---

### 2026-09-01 (bd) — v31.66: Namensschilder im 3D-Modell, und „Mein Garten" als ein Stück

Fernando: *„Mein Garten hat zu viele Widgets und die Seite sieht optisch einfach nicht schön aus"* — und die 3D-Modelle verbessern.

Diesmal habe ich die Seite **angesehen**, nicht nur vermessen. Ein Bildschirmfoto zeigt in einer Sekunde, was zehn Messungen nicht zeigen.

#### Was das Bild zeigte

Ein **100 Pixel hohes Loch** zwischen der letzten Gartenkarte und „Einpflanzen". Ursache:

```css
#garden-list { padding-bottom: 100px !important; }
```

Diese Regel gibt Listen einen Sockel, damit ihr Ende nicht hinter der Navigationsleiste verschwindet — sie steht dort mit acht Geschwistern (`#recipes-list`, `#favs-list` …). Für all die stimmt sie: sie sind das **Letzte** auf ihrem Bildschirm. Die Gartenliste ist es nicht — darunter kommen zwei Knöpfe und drei Werkzeug-Gruppen. Direkt unter dem Block steht sogar ein Kommentar von v31.47, der genau diese Überlegung für einen anderen Fall schon einmal angestellt hat.

Dazu vier Dinge, die man nur sieht:

| | vorher | jetzt |
|---|---|---|
| Statistik | vier Kacheln, 2×2, ~300 px — und die vierte war gar keine Zahl, sondern eine Handlungsaufforderung mit anderem Grund, anderer Ausrichtung, anderen Schriftgrössen | drei Zahlen nebeneinander in **einer** Karte (72 px); der nächste Schritt darunter als eigene Karte — sieht weiter anders aus, jetzt aber absichtlich |
| Symbole | „▦" und „🗺" wirkten wie Platzhalter | keine — eine grosse Zahl mit klarer Beschriftung braucht kein Bild |
| Mondkalender | der einzige dunkelblaue Balken zwischen lauter hellen Karten | dieselbe Karte wie alles andere (das volle Fenster behält seinen Nachthimmel) |
| Werkzeug-Gruppen | nackter Text auf dem Seitengrund, nur eine Trennlinie | Karten wie der Rest, mit Winkel, der sich beim Aufklappen dreht |

Die Trennlinie von v31.56 ist gegangen: sie löste ein Problem, das es nicht mehr gibt (zwei randlose Blöcke, die als ein Klotz gelesen wurden). Inzwischen ist jeder Block eine Karte — da trennt der Abstand, und der Strich war der einzige nackte Strich auf dem Bildschirm.

```
1 Garten :  1234px → 1071px   −13 %
3 Gärten :  1368px → 1205px   −12 %
6 Gärten :  1569px → 1406px   −10 %
```

Antippbare Stellen: **38→38, 48→48, 63→63.** Zusammen mit v31.64 sind das von ursprünglich 1693 px (3 Gärten) auf 1205 px — **−29 %**.

#### Das 3D-Modell hatte keine Namen

Ich habe es gerendert und angesehen: vier Pflanzen, alle grün, keine Beschriftung. Hecke, Kohl und Basilikum waren nicht auseinanderzuhalten. Ein Plan, den man nicht lesen kann, ist Dekoration.

Jetzt trägt jede Pflanze ein Schild — als Sprite, dreht sich also immer zur Kamera. Grau für Bestand, mit grünem Rand für Vorschläge: **dieselbe Zeichensprache wie die Ringe am Boden** aus v31.59. Gruppen bekommen ein Schild mit Anzahl („Karotte ×12") statt zwölf gleicher Schilder übereinander.

#### Zwei eigene Fehler dabei, beide durch Messen gefunden

1. **Die Schilder drängelten.** Bei neun Pflanzen lagen sie übereinander. Erster Versuch: vier Höhenstufen statt drei — das machte es **schlechter** (5 statt 7 sichtbar). Statt weiter zu raten habe ich gezählt.
2. **Die Kollisionsprüfung war geraten.** Ich hatte die Schildbreite im Bildraum mit einem Faktor geschätzt; er machte die Schilder rechnerisch über viermal so breit wie sie sind, und blendete selbst bei **drei** Pflanzen eines aus. Jetzt wird die Grösse gemessen: Mitte und Ecke werden beide projiziert, die Differenz ist die halbe Breite in Bildkoordinaten.

Gemessen an den tatsächlich erzeugten Sprites:

```
 3 Pflanzen → 3/3 sichtbar (100 %)
 5 Pflanzen → 5/5 (100 %)
 7 Pflanzen → 5/7 (71 %)
 9 Pflanzen → 8/9 (89 %)
12 Pflanzen → 9/12 (75 %)
```

Alles sichtbar, solange Platz ist; sanfter Abbau, wenn es eng wird. Was sich überdeckt, tritt zurück — das vordere gewinnt, denn es gehört zu der Pflanze, die man gerade ansieht.

#### Und der Scanner bekommt es mit

`gsTwinOpen3D` nutzt denselben Renderer — das Scan-Modell hat also ab jetzt auch Namen. Dabei fiel auf: der Zwilling übergab seine Pflanzen **ohne** `existing:true`. Jede hätte den Ring und den grünen Schildrahmen bekommen, also die Zeichensprache für „das wäre neu" — im Scan des Bestands. Eine Zeichensprache, die je nach Fenster etwas anderes bedeutet, ist keine. Nachgemessen: **0 Ringe**, 3 Schilder, alle sichtbar.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Hell- **und** Dunkelmodus als Bild angesehen · Modell in fünf Bestückungen gerendert und die Sprites gezählt · Zwilling-Modell auf 0 Ringe geprüft · Höhe bei 1/3/6 Gärten · `gsAllReleases()` 413 → **414**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.66 · `sw.js` gs-v31.66 · `_headers` v31.66 · meta 31.66.20260901.

#### Nebenbei gelernt

Das 3D-Modell liess sich bisher **gar nicht** prüfen: `_gsLoadThree` lädt `/assets/three.min.js` absolut, und unter `file://` zeigt das aufs Dateisystem-Wurzelverzeichnis. Mit einem lokalen Webserver (`python3 -m http.server`) läuft es. Wer am 3D arbeitet, braucht diesen Weg — sonst prüft man ein Modell, das nie gebaut wurde.

#### Offen

Der Rasen ist eine flache grüne Fläche und das Beet wirkt daraufgelegt; „0 Pflanzen" auf den Gartenkarten steht im Widerspruch zu „8 Pflanzen in Pflege" darüber (zwei verschiedene Datenquellen: `plantings` gegen `myPlants`). Beides eigene Arbeiten.

---

### 2026-09-01 (bc) — v31.65: Planer-Optik, ehrlicher Fortschritt — und ein Speicher-Fehler, den ich selbst gebaut habe

Fernandos zweiter Auftrag: den KI-Planer optisch und funktionell verbessern, mit Bildern aus dem Internet arbeiten.

#### Zuerst das, was nicht geht

**Bilder aus dem Internet sind aus dieser Umgebung nicht erreichbar.** Wikimedia Commons, Unsplash — alles `connect_rejected · gateway answered 403 to CONNECT (policy denial)`. Die Freigabeliste des Proxys enthält nur Paket-Register (npm, PyPI, crates.io, Go) und die Anthropic-API. Das ist dieselbe Sperre, die schon `green-scan.ch` und die Vorschau-Adressen betrifft (CLAUDE.md §2.1) — sie gilt für alles ausserhalb der Liste, nicht für einzelne Hostnamen.

Statt zu behaupten, ich hätte damit gearbeitet: **Testbilder lokal gemalt** (Rasen, Hochbeet, 14 Pflanzen, Schattenzone, Hecke) und damit den Scan-Weg vermessen. Das prüft die Verarbeitung, **nicht die Erkennung** — dafür bräuchte es die KI, und zu der gibt es von hier aus ebenfalls kein Netz.

#### Optik: eine Tafel statt vier Kästen

Vor dem Plan stapelten sich bis zu vier eigene Hinweiskästen — Bestand, kein Platz, zu nah, Licht. **Drei davon hatte ich selbst gebaut** (v31.58, v31.62, v31.63), jeden für sich sinnvoll, zusammen ein Wall. Genau der Befund, den Fernando eine Stunde vorher über „Mein Garten" gemacht hat.

Jetzt eine Tafel „🔍 Plan-Prüfung", eine Zeile je Prüfung, drei Zustände:

| Fall | vorher | nachher |
|---|---|---|
| alles gut | 170 px in 2 Kästen | 134 px in 1 | **−21 %** |
| zwei Hinweise | 309 px in 3 | 215 px in 1 | **−30 %** |
| alles + kein Platz | 291 px in 3 | 212 px in 1 | **−27 %** |
| nicht prüfbar | 85 px in 1 | 163 px in 1 | **+92 %** |

Der letzte Fall ist **absichtlich länger** — und er ist der eigentliche Gewinn. Konnte eine Prüfung nicht laufen (geplante Fläche ≠ gescannte, Mischkultur-Daten noch nicht geladen), stand vorher **gar nichts** da. „Geprüft und in Ordnung" sah aus wie „gar nicht prüfbar". Jetzt steht der Grund da.

#### Funktion: der Fortschrittsbalken hat gelogen

Sieben Meldungen — „🌙 Mondphase + Saison berücksichtigen …", „🌱 Mischkultur-Kombinationen prüfen …" — liefen nach `elapsed / EXPECTED_MS` ab, während die App auf **einen** Netzaufruf wartete. Nichts davon geschah in dem Moment, in dem es behauptet wurde. Prozentwert aus derselben Uhr, Restzeit = Konstante minus verstrichene Zeit. Im HTML stand darüber: „Echter Progress-Balken".

Jetzt melden nur Schritte, die es gibt: Zusammenstellen (10 %) → **unbestimmter Balken**, solange die KI arbeitet, mit „läuft seit N s" → Antwort prüfen (60 %) → Pflanzen setzen und messen (80 %) → aufbauen (95 %).

Ein wandernder Streifen sagt „ich arbeite"; „73 %" sagt „ich bin bei 73 %", und das weiss dort niemand. `prefers-reduced-motion` bekommt einen ruhigen Balken.

**Am laufenden Programm nachgewiesen** — mit einer untergeschobenen KI (4 s Wartezeit), an den echten Codewegen abgelesen:

```
läuft seit 0 s … 4 s   (unbestimmter Balken, kein Prozentwert, keine Restzeit)
vor dem Setzen der Pflanzen  →  „🌱 Pflanzen setzen, Licht und Nachbarn prüfen …" bei 80%
vor dem Aufbauen des Plans   →  „✨ Plan aufbauen …" bei 95%
Ergebnis sichtbar: true · Plan-Prüfung: 3 Zeilen, alle ✓
```

#### Und dann der eigentliche Fund

Der Scan-Weg hielt über vier Kameraformate (4032×3024, 3000×4000, 16:9, quadratisch): Seitenverhältnis bleibt, Ausgabe immer JPEG, Rückweg identisch, Marker auf den Prozent genau. Also der Härtefall — **voller Gerätespeicher**.

`gsTwinSave` hatte dafür einen Rückfall: Foto weg, Zwilling behalten. **Er ist nie gelaufen.**

Die App umhüllt `localStorage.setItem` global (Z. ~7145) und lässt die Ausnahme **nicht** durch — sie gibt `false` zurück. Der Kommentar an jener Stelle sagt es seit v30.98 wörtlich:

> *„dadurch war JEDER `try{ localStorage.setItem(...) }catch{ …Fallback… }` im ganzen Monolithen toter Code (die Ausnahme kam nie an)"*

Ich habe den Rückfall in v31.57 trotzdem in einen `catch` geschrieben. Folge auf einem vollen Gerät: nicht nur das Foto war weg, sondern der **ganze** Zwilling — Pflanzen, Korrekturen, Lichtzonen — und `gsTwinSave` gab `true` zurück.

Nachgestellt und danach belegt:

```
gs_garden_twin 78 KB → abgelehnt (false)
gs_garden_twin  0 KB → angenommen
gsTwinSave sagt: 'ohne_foto'  ·  Pflanzen: 1  ·  Bildposition erhalten: true
```

Der Zwilling merkt sich jetzt `photo_weg`, damit die Liste sagen kann, warum die Marker fehlen — sonst sieht eine Platzentscheidung wie ein Fehler aus.

#### Zwei weitere Warnungen, die nie erschienen

Dieselbe Ursache:

| Stelle | eingebaut | versprach |
|---|---|---|
| `toggleFav` | v30.46 | „Speicher voll — Favorit evtl. nicht gesichert." |
| Supabase-Key speichern | v28.67 | „klares Feedback statt stillem Abbruch mit falschem ✅" |

Beide bekamen genau den stillen Abbruch mit falschem ✅. Beide gehen jetzt, die Favoriten-Warnung am laufenden Programm ausgelöst.

#### Die Zahlen zum Muster

**228 der 316 `setItem`-Aufrufe** stehen in einem `try/catch`; **nur 12** prüfen den Rückgabewert. Die meisten `catch`-Blöcke sind harmlos (leer oder nur `console.warn`). **13 enthalten einen echten Rettungsweg.** Drei davon waren Nutzer-Warnungen; zwei sind hier repariert.

**Offen, nicht angefasst** (bewusst — das ist eine eigene Welle, kein Anhängsel):
`gsPPsavePlan` (Z. ~57000, Plan-Speicherung) · `_gsRestoreStats.failed++` an zwei Stellen (Z. ~72212) · Backup-Flags `okW`/`bakOk` (Z. ~2219/2233) · `_vk = 'anon:fallback'` (Z. ~32629) · zwei Passwort-Pfade (Z. ~70077).

In `CLAUDE.md` §3.5 steht die Falle jetzt mit dem richtigen Muster daneben.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Tafel in fünf Zuständen durchgespielt · ganzer Planer-Lauf mit untergeschobener KI, Stufen an den Codewegen abgelesen · Scan-Weg über vier Kameraformate · Speicher-Härtefall nachgestellt · Favoriten-Warnung ausgelöst · Licht (v31.62) und Nachbarn (v31.63) unverändert richtig · Farben der Tafel 5,33 bis 18,88:1 beide Modi · `gsAllReleases()` 412 → **413**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.65 · `sw.js` gs-v31.65 · `_headers` v31.65 · meta 31.65.20260901.

#### Für Fernando

Wenn du echte Gartenfotos hast: schick sie, oder leg sie ins Repo. Dann kann ich `gsTwinPrompt()` an **konkreten** Fehlerkennungen schärfen statt an Vermutungen — und die Marker an echten Perspektiven prüfen statt an gemalten.

---

### 2026-09-01 (bb) — v31.64: „Mein Garten" um ein Fünftel kürzer, ohne Verlust

Fernandos Befund: *„sehr lang und hat sehr zu viele Sachen"*. Also erst gemessen, dann geschnitten.

#### Ausgangslage

| Gärten | vorher | nachher | |
|---|---|---|---|
| 1 | 1521 px (1,7 Bildschirme) | 1234 px (1,3) | **−19 %** |
| 3 | 1693 px (1,9) | 1368 px (1,5) | **−19 %** |
| 6 | 1951 px (2,1) | 1569 px (1,7) | **−20 %** |

Sichtbare Blöcke 14 → 12. Und die Zahl, auf die es ankommt: **antippbare Stellen 38→38, 48→48, 63→63.** Kürzer heisst hier nicht weniger — es heisst dichter.

#### Was weg ist

- **Der doppelte Titel.** Die Kopfzeile sagt „🌻 Mein Garten · Planen · Pflegen · Ernten", und 20 px darunter sagte `garden-overview` noch einmal „Mein Garten · Dein digitaler Gartenüberblick". Zwei Titel für eine Seite (−42 px). Die beiden CSS-Klassen `.gs-go-head`/`.gs-go-sub` waren danach ohne Träger und sind mitgegangen.
- **Der Mondkalender als Block** (123 px → 55 px). Grosser Mond, Phase in Playfair, Alter, Beleuchtung, Typ-Plakette, Gartentipp im eigenen Kasten — alles davon steht im Mondkalender, den ein Tipp öffnet. Jetzt dieselbe Form wie die Wetterkarte darüber. **Am laufenden Programm angetippt:** `modal-moon-calendar` öffnet.
- **Die zweite Zeile auf jeder Gartenkarte.** Standort, Pflanzenzahl, Grösse und Licht standen als Text plus zwei Plaketten untereinander. Vier kurze Angaben in einer Zeile: „Zürich · 0 Pflanzen · 🌿 Mittel · ☀️ Vollsonne", 14 px hoch. −20 px **je Garten** — das ist der Posten, der mit echter Nutzung mitwächst.
- **Die eigene Zeile „Meine gespeicherten Garten-Pläne"** (−55 px). Planung stand auf dieser Seite an drei Stellen: als Kachel in der Übersicht, als eigene Zeile, und im Akkordeon. Die Zeile war die überflüssige der drei.
- **Der Erklärsatz unter „Garten scannen"** erscheint nur noch, solange es nichts zu erklären gibt — er stand in einem Zweig, der ohnehin nur ohne Zwilling läuft.

#### Der Fehler, der beinahe durchgegangen wäre

Die Achievements-Kachel sollte weg: fünfte Kachel in einem Zweierraster, macht aus zwei Reihen drei mit einer Waise. Ich habe sie entfernt und dabei behauptet, sie sei über das Hauptmenü erreichbar — **das war falsch.** Mein eigener Durchlauf hat es widerlegt (`im_menue: false`), und der Griff in den Quelltext bestätigte es: ausser dieser Kachel gab es **keinen** Aufruf von `openAchievementsModal`, der einzige weitere steht im Benachrichtigungs-Router und greift nur, wenn eine Erfolgs-Meldung ankommt.

Sie zu streichen hätte ein ganzes Feature begraben — genau das Muster, das dieser Meilenstein überall entfernt hat. Sie ist deshalb als Zeile in „📚 Wissen & Werkzeuge" gewandert: kostet eingeklappt 0 px, das Raster ist trotzdem gerade.

Dabei fiel auf, dass ihr Rahmen `#ffd54f` gegen den hellen Seitengrund nur **1,29:1** trägt — der Knopf war durch nichts umrissen (Soll 3:1 für Nicht-Text). Für die neue Zeile auf `#b26a00` gesetzt: **3,87:1**. Text 7,94 bis 8,77:1.

#### Was NICHT weg ist, obwohl es leer aussah

`garden-sync-status` (14 px), `seasonal-tasks-host`, `garden-smart-reminder`, `garden-stats-card`, `frost-warning-banner`, `garden-water-banner` — alle sechs sehen leer aus und **alle sechs werden zur Laufzeit befüllt**. Nachgesehen statt angenommen. Nur das 8-px-Polster des leeren `seasonal-tasks-host` ist gegangen; das trägt der Injektor selbst, wenn er füllt.

Ein echter Fund am Rande: `widget-achievements-subline` hatte eine id, die **niemand** je gelesen oder beschrieben hat.

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · sieben Punkte am laufenden Programm durchgespielt (Gartenkarte einzeilig · Mondzeile öffnet den Kalender · Titel nur noch einmal · Achievements aus dem Raster und in der Gruppe · Pläne im Akkordeon · vier Werkzeuge statt fünf · alle drei Akkordeons zu) · Höhe bei 1/3/6 Gärten gemessen · `gsAllReleases()` 411 → **412**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.64 · `sw.js` gs-v31.64 · `_headers` v31.64 · meta 31.64.20260901.

#### Offen

Die übrigen Knöpfe in den Akkordeon-Gruppen tragen dasselbe Muster wie die alte Achievements-Kachel: heller Verlauf mit hellem Rahmen, gegen den Seitengrund unter 3:1. Sie sind über ihre Beschriftung erkennbar (AA erfüllt), aber ihre Umrisse sind es nicht. Das wäre eine eigene, saubere Welle — nicht etwas, das man nebenbei in einen Kürzungs-Release schiebt.

---

### 2026-09-01 (ba) — v31.63: Mischkultur nach Abstand, nicht nach Anwesenheit

Zweite Hälfte derselben Sache wie v31.62. Und diesmal war es **kein** fehlendes Feature — es war ein vorhandenes, das die falsche Frage stellte.

#### Zuerst gesucht, dann gebaut

Der Prompt verlangt seit je Mischkultur. Bevor ich eine Nachbarschaftstabelle in den Code geschrieben habe, habe ich nachgesehen, was schon da ist — die Lehre dieser Sitzung. Ergebnis:

- **`v_companion_lookup`** in Supabase: 248 Zeilen, 4 Beziehungsarten (`gut` 150 · `schlecht` 42 · `neutral` 32 · `kritisch_schlecht` 24)
- **`gsLoadCompanionsForPlanPlant`**: zeigt pro Pflanze im Plan-Detail gute und schlechte Nachbarn
- **`conflictPaint`** (v28.79): roter Schimmer im 3D-Modell für sich nicht vertragende Pflanzen

Eine eigene Tabelle im Code wäre eine zweite Quelle geworden, die auseinanderläuft (§3.3). Es wird deshalb **dieselbe** benutzt: `plant_companion_matrix`.

#### Was der Schimmer wirklich prüfte

```js
var hasConflict = conflictMeshes.some(function(other){
  return other.lat && other.lat !== lat && conflictMap[lat].has(other.lat);
});
```

Kein Abstand. Nirgends. Zwei Antagonisten an entgegengesetzten Enden eines 10-Meter-Gartens leuchteten **beide** rot — der Schimmer sagte nichts über die **Anordnung**, nur über die **Artenliste**. Wer die Pflanzen auseinanderzieht, sieht genau dasselbe Rot; die Anzeige konnte einem also nichts beibringen. Mischkultur wirkt aber über Wurzelkonkurrenz und Ausdünstungen, also über Nähe.

#### Was jetzt passiert

| | |
|---|---|
| `_gsAbstand` | Zwischenraum zwischen den **Rechtecken**, nicht Mittelpunkt zu Mittelpunkt — eine breite Pflanze reicht weiter |
| `_gsZuNah` | 0,5 m; bei `kritisch_schlecht` 1,0 m |
| `_gsNachbarnOk` | Der Platzierer meidet Gegenspieler-Nähe schon beim Setzen |
| `_gsPlanNachbarn` | Misst den **fertigen** Plan und hängt das Ergebnis an ihn |

Der Platzierer hat jetzt bis zu vier Vorlieben, von streng nach nachgiebig: Licht **und** Nachbarschaft → nur Nachbarschaft → nur Licht → irgendwo frei. **Keine davon darf eine Pflanze verhindern.** Findet er nichts Besseres, wird gesetzt und gemeldet — eine Pflanze wegzulassen wäre die schlechtere Antwort.

Die Matrix wird beim Öffnen des Planers vorgeladen (ein Aufruf, ≤200 Zeilen). Bis das mehrstufige Formular ausgefüllt ist, steht sie. Ist sie es nicht, bleibt `_nachbarn` **`null`** — keine Aussage, kein erfundener Vorwurf.

#### Zwei eigene Fehler, beide beim Testen gefunden

1. **Stufe 1 prüfte nur das Licht.** Der Vorschlag der KI wurde genommen, sobald er frei war — die Tomate blieb 10 cm neben der Kartoffel stehen, obwohl der halbe Garten leer war. Genau derselbe Fehler wie gestern beim Licht, einen Tag später noch einmal. Stufe 1 prüft jetzt beides.
2. **Zwei Regeln statt einer.** Der Platzierer rechnete mit rohen Fliesskommazahlen (die 10-cm-Schritte summieren sich zu `1.0000000000000002`), die Prüfung danach mit den gerundeten. Ergebnis: der Planer setzte eine Pflanze bewusst auf genau 1,00 m Abstand — und beklagte anschliessend genau diesen Abstand. Jetzt fragen beide Seiten `_gsZuNah`, mit einem Zentimeter Toleranz.

#### Sieben Durchgänge

```
0 · _gsAbstand    berührend 0 · halber Meter 0.5 · diagonal 1.41 · überlappend 0
A · weit auseinander (9 m)          → kein Vorwurf
B · direkt nebeneinander            → gemeldet: Tomate/Kartoffel, 0.2 m, kritisch
C · 0,7 m bei Schwelle 0,5          → kein Vorwurf
D · Platzierer weicht aus           → 0.6,0 → 1.5,0 (1,00 m) — und beklagt es NICHT
E · Beet wirklich voll (1,2×0,6 m)  → trotzdem gesetzt, gemeldet mit 0.1 m
F · Matrix nicht geladen            → _nachbarn:null, Position unangetastet
    Licht aus v31.62 unverändert    → alle sechs Fälle weiterhin richtig
```

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Vergleich 2281 Elemente: **0** Layout-, 0 Farb-, 0 Radius-, 0 Schriftgrössenänderungen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Meldung nutzt dasselbe Warnmuster wie v31.62 (Titel 5,11 / 7,16:1 · Text 9,21 bis 10,37:1) · `gsAllReleases()` 410 → **411**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.63 · `sw.js` gs-v31.63 · `_headers` v31.63 · meta 31.63.20260901.

---

### 2026-09-01 (az) — v31.62: Der Planer plant ins gemessene Licht

Wieder das Muster, das diese Sitzung ein Dutzend Mal getroffen hat: **Arbeit, die getan und dann stillgelegt wird.**

Seit v31.58 steht im Planer-Prompt wörtlich „Beachte die Lichtzonen (Sonnenpflanzen nicht in den Schatten)". Die KI hält sich daran. Danach lief `_gsSanitizePlannerPlan` und ordnete **jede** neue Pflanze aus (0,0) heraus neu an — erste freie 10-cm-Stelle gewinnt. Der Auftrag kam nie an.

Am laufenden Programm nachgestellt, bevor eine Zeile geändert wurde:

```
KI hatte gelegt: Hecke@0,0 · Tomate@3,2.2 · Farn@0.2,1.5
Packer machte  : Hecke@0,0 · Tomate@1.2,0 · Farn@1.8,0
```

Die Tomate lag in der Sonnenecke, der Farn im Schatten. Beide landeten in der obersten Reihe.

#### Die Platzierung in drei Stufen

| Stufe | Regel |
|---|---|
| 1 | Die Stelle der KI **bleibt** — wenn sie frei ist **und** das Licht passt |
| 2 | Sonst: Rastersuche, **erster Durchgang nur über Stellen im passenden Licht** |
| 3 | Sonst: irgendeine freie Stelle — und der Konflikt wird **benannt** |

Stufe 3 ist Absicht. Der Platz kann schlicht knapp sein; dann ist die richtige Antwort ein Hinweis an den Menschen, keine heimliche Verschiebung und kein Weglassen der Pflanze.

**Ein Fehler, den ich beim Testen selbst gebaut habe** und der genau deshalb aufgefallen ist: Stufe 1 nahm zuerst *jede* kollisionsfreie Stelle der KI. „Frei" ist aber nicht dasselbe wie „sinnvoll" — im Durchgang B blieb die Tomate im Schatten stehen, obwohl die Sonnenzone leer war. Stufe 1 prüft jetzt beides.

#### Vier Funktionen, alle rein rechnend

`_gsLichtNorm` (alles, was nicht auf eine der drei Stufen fällt, ist **unbekannt** — nicht „Sonne"), `_gsZoneAn`, `_gsLichtPasst`, `_gsPlanLichtPruefung`. Rein rechnend, also **prüfbar** — im Unterschied zu einer Prompt-Zeile, die sich von hier aus nicht messen lässt. Das ist der eigentliche Punkt: die Absicht steht weiterhin im Prompt, aber sie hängt nicht mehr allein daran.

Gemeldet werden nur die zwei **echten** Fehler: Sonnenpflanze im Schatten (kümmert) und Schattenpflanze in der prallen Sonne (verbrennt). Halbschatten ist die Mitte und verträgt sich mit allem. Strenger zu sein hiesse, Warnungen zu erfinden.

#### Die Zonen gelten nur, wenn sie gelten dürfen

Der Plan hat eine eigene Fläche (aus dem Formular), der Scan eine gemessene. Sind das nicht dieselben Masse (Toleranz 26 cm), liegen die Zonen-Koordinaten auf einem **anderen Rechteck** — dann bleiben sie ungenutzt und es wird nichts behauptet. Dieselbe Regel wie bei den Foto-Markern gestern.

#### Sechs Durchgänge

```
A · KI legt richtig  → Tomate@3,2.2 · Farn@0.2,1.5 bleiben  | 2 passen, 0 Konflikte
B · KI legt falsch   → Tomate 0.3,2.0 (Schatten) → 1.8,0 (Sonne) | 0 Konflikte
C · Sonnenzone voll  → steht trotzdem im Plan, gemeldet: „Tomate: sonne/schatten"
D · kein Lichtbedarf → nicht bewertet, ohne_aussage:1, kein erfundener Vorwurf
E · andere Fläche    → _licht:null, Zonen gelten nicht, Position unangetastet
F · gar kein Scan    → Reihen-Packung wie bisher (A@0,0 · B@1.1,0)
```

#### Anzeige

Zwei Meldungen über dem Plan. „☀️ Licht geprüft" steht nur da, wenn **wirklich** gegen gemessene Zonen geprüft wurde — sonst wäre es eine Floskel. „☀️ Licht passt nicht überall" nennt Pflanze, Bedarf und gemessene Zone.

Farben gerechnet (beide sitzen in einem Dialog): Titel 7,00 / 7,57:1 grün · 5,11 / 7,16:1 orange · Fliesstext 9,21 bis 10,37:1 · Rahmen 4,56 / 6,18:1 (Nicht-Text, Soll 3:1).

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Vergleich 2275 Elemente: **0** Layout-, 0 Farb-, 0 Radius-, 0 Schriftgrössenänderungen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · sechs Platzierungsfälle am laufenden Programm · `gsAllReleases()` 409 → **410**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.62 · `sw.js` gs-v31.62 · `_headers` v31.62 · meta 31.62.20260901.

#### Was als Nächstes drankäme

Mischkultur ist die zweite Hälfte derselben Sache: der Prompt verlangt sie, geprüft wird sie nicht. Eine Nachbarschaftstabelle gegen die tatsächlichen Abstände im fertigen Plan wäre genauso deterministisch — und genauso prüfbar — wie das Licht jetzt.

---

### 2026-09-01 (ay) — v31.61: Marker auf dem Foto — man sieht, WELCHE Pflanze gemeint ist

Direkt aus Fernandos zweitem Bild („Garten wird erkannt", mit Beschriftungen auf den Pflanzen). Und es ist kein Schmuck, sondern die Voraussetzung für das, was gestern gebaut wurde: **die Korrektur aus v31.60 ist ohne diesen Schritt ein Ratespiel.** Eine Liste sagt „Tomate, 92 %". Sie sagt nicht, welche der drei Pflanzen im Bild damit gemeint ist — und wer das nicht weiss, kann nicht korrigieren.

#### Warum das nicht einfach aus den vorhandenen Daten geht

Der Zwilling hatte schon Koordinaten: `x_m`/`y_m`, Meter innerhalb der Beetfläche. Die sind für das 3D-Modell richtig und **für das Foto falsch** — das eine ist ein Grundriss von oben, das andere eine perspektivische Aufnahme. Wer die Meter aufs Bild legt, bekommt Marker, die überzeugend aussehen und daneben zeigen.

Also ein zweites, ehrliches Feld: `ix`/`iy`, die Mitte der Pflanze **im Bild**, 0–1 von links oben. Der Prompt sagt ausdrücklich, dass das etwas anderes ist als `x_m`/`y_m`, und:

> *Kannst du bei einer Pflanze NICHT sagen, wo im Bild sie steht, dann LASS ix/iy WEG. Eine geratene Markierung ist schlimmer als keine.*

#### Drei Stellen, an denen bewusst nichts erfunden wird

| Fall | Verhalten |
|---|---|
| KI nennt keine Bildposition | `ix`/`iy` bleiben **`null`**, nicht `0` — sonst zeigt der Marker auf „links oben", weil ein Feld fehlte |
| Koordinate ausserhalb 0–1 | verworfen, **nicht** an den Rand geklemmt |
| Kein Foto, oder keine einzige Position | der ganze Block fällt weg — dann ist die Liste eben eine Liste, wie bis v31.60 |

Unter dem Bild steht, bei wie vielen Pflanzen die Stelle unbekannt blieb. Weglassen wäre die bequemere Variante gewesen.

#### Sicherheit

Das Foto kommt aus `localStorage` zurück — aus etwas, das sich von aussen beschreiben lässt. `gsEscHtml` verhindert schon das Ausbrechen aus dem Attribut; dazu kommt jetzt, dass überhaupt nur `data:image/(png|jpe?g|webp);base64,…` durchgeht. Am laufenden Programm nachgestellt: `photo = 'javascript:alert(1)'` → **kein** Bildblock, die Liste bleibt vollständig.

#### Farben — Marker liegen auf einem Foto, nicht auf einer Fläche

Welcher Anzeigemodus eingestellt ist, sagt **nichts** darüber, wie hell das Foto darunter ist. Deshalb feste Farben statt Variablen:

| | Wert |
|---|---|
| Ziffer `#fff` auf Scheibe `#1b5e20` | 7,87:1 |
| Marker aktiv, `#1b5e20` auf `#fff` | 7,87:1 |
| Zeilennummer dunkel `#0d2818` auf `#a5d6a7` | 9,58:1 |
| Hervorgehobene Zeile, alle drei Textstufen | 4,74 bis 16,79:1 |

Ein Fall bleibt offen und wird deshalb getragen statt behauptet: die Scheibe `#1b5e20` gegen ein **schwarzes** Foto ist 2,67:1 — unter den 3:1 für Nicht-Text. Dafür ist der weisse 2-px-Ring da (21:1 gegen Schwarz), plus Schlagschatten gegen Weiss.

#### Durchgespielt

Vier Pflanzen: zwei mit Position, eine ohne, eine mit `ix:7, iy:-2`.

```
1 · normalisiert : Tomate:0.31/0.62 · Kohl:0.7/0.4 · Basilikum:kein Ort · Ausreisser:kein Ort
2 · Marker       : 1@31%,62% · 2@70%,40%
3 · Zeilennummern: 1, 2   | Foto da: true | src ok: true
4 · Hinweis      : „Bei 2 Pflanzen konnte die KI die Stelle im Bild nicht angeben"
5 · Tipp auf Marker 2 → Zeile gs-twin-row-1 UND Marker hervorgehoben
6 · photo='javascript:alert(1)' → kein Bildblock, 4 Zeilen bleiben
7 · alter Scan ohne ix/iy       → kein Bildblock, 0 Nummern, 4 Zeilen
```

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Vergleich 2277 Elemente: **0** Layout-, 0 Farb-, 0 Radius-, 0 Schriftgrössenänderungen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 (Marker sind 26 px) · `GS_RELEASES[0].v` = `GS_VERSION` am laufenden Programm geprüft, `gsAllReleases()` 408 → **409**, 0 Dopplungen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.61 · `sw.js` gs-v31.61 · `_headers` v31.61 · meta 31.61.20260901.

#### Grenze, die bleibt

`wiring_check` sieht `gsTwinZeig` nicht: der Aufruf entsteht erst beim Rendern, in einer Zeichenkette. Deshalb hier von Hand am laufenden Programm angetippt (Punkt 5 oben) — genau die Sorte Prüfung, die der Prüfstand nach eigener Dokumentation nicht leisten kann.

---

### 2026-09-01 (ax) — v31.60: Den Garten-Scan korrigieren, und ihn in die Pflege übernehmen

Der Garten-Zwilling (v31.57) erkennt Pflanzen. Bis heute war das eine **Anzeige**: was die KI falsch benannte, blieb falsch, und was sie richtig erkannte, musste man trotzdem von Hand in „Meine Pflanzen" anlegen. Zwei Lücken, und die zweite ist die grössere — ohne sie bleibt der Scan eine Vorführung.

Der Anlass ist Fernandos Ansage, dass morgen echte Bilder kommen. Genau deshalb war die Korrektur zuerst dran: **eine Erkennung, die man korrigieren kann, muss nicht perfekt sein.**

#### Was jede Zeile jetzt kann

| Knopf | Wirkung |
|---|---|
| **Umbenennen** | `gsPromptModal`, dann Suche in der Artendatenbank → lateinischer Name und Symbol kommen mit. Namen mit `<` oder `>` werden abgelehnt. |
| **Stimmt** | `confidence = 1`, `bestaetigt = true` → die Zeile zeigt „✓ von dir" statt einer Prozentzahl |
| **Entfernen** | `splice` aus dem Zwilling |

„✓ von dir" statt „100 %" ist Absicht: es sagt, **woher** die Sicherheit kommt. Der Knopf „Stimmt" verschwindet danach — bestätigen, was schon bestätigt ist, führt nur in die Irre.

#### Vom Scan in die Pflege

`gsTwinAdopt()` legt jede erkannte Pflanze in `myPlants` an — mit dem **vollen** Aufgabensatz aus `savePlant()` (acht Aufgaben: Giessen, Düngen, Umtopfen, Schneiden …), mit Beet und Lichtzone in der Notiz, `fromTwin: true`.

Der Giess-Rhythmus kommt nicht aus einem Standardwert, sondern aus `gsTwinWaterStufe()`: Wasserbedarf der Art aus der Datenbank → Stufe 1/2/3. Findet die Datenbank nichts, bleibt es bei 2 (Mittel) — der ehrlichste Standard.

Namen, die schon in der Pflege stehen, werden übersprungen (kleingeschrieben verglichen). Ein zweiter Druck legt also nichts doppelt an.

#### Unsicheres wird als unsicher gezeigt

Über der Liste steht, wie viele Erkennungen unter der Schwelle liegen — **bevor** man übernimmt. Eine App, die 30 % Sicherheit genauso darstellt wie 95 %, lügt durch Weglassen.

#### Nebenbei: die Release-Liste war wieder auf 27 gewachsen

§3.1 sagt „die neuesten ~12" inline, der Rest ins Archiv. Seit v31.36 war sie unbemerkt auf 26 gewachsen. 15 Einträge (v31.48 … v31.34) sind ans **Archiv-Ende vorne** gewandert: **44 KB weniger** bei jedem Kaltstart.

Am laufenden Programm gegengeprüft, nicht am Text: vorher 407 Einträge über `gsAllReleases()`, nachher 408 (der neue), **0 Dopplungen**, und die Reihenfolge am Übergang lückenlos (v31.50 · v31.49 · v31.48 · v31.47).

#### Farben von Hand gerechnet

Die neuen Knöpfe sitzen in einem Dialog — `contrast_check` sieht dort nicht hinein, und genau das ist jetzt dreimal schiefgegangen. Also nachgerechnet, beide Modi:

| | hell | dunkel |
|---|---|---|
| Korrekturknopf `--text2`/`--surface2` | 10,36:1 | 9,30:1 |
| „Entfernen" `--c-danger` | 5,12:1 | 5,48:1 |
| Warnfeld, fett `--c-warn-d` | 5,11:1 | 7,16:1 |
| Sicherheitsmarke, alle drei Stufen | 5,13–5,60:1 | 6,64–8,99:1 |

Niedrigster Wert 5,11:1. Der Dunkelmodus-Grund des Warnfelds ist `rgba(255,167,38,.12)` über `--card` — auskomponiert `#323718`.

#### Durchgespielt statt behauptet

Vier erkannte Pflanzen, zwölf Korrekturknöpfe:

```
1 · Liste offen    : 4 Zeilen, 12 Knöpfe, Warnhinweis da, Übernehmen da
2 · nach Entfernen : Unkraut weg
3 · nach Stimmt    : Kohl → „✓ von dir"
4 · nach Umbenennen: Kohl → Federkohl
5 · nach Übernahme : Federkohl in der Pflege, 8 Aufgaben, giessen alle 7 Tage,
                     Notiz „Aus dem Garten-Scan übernommen · Beet A · Sonne"
6 · zweite Übernahme: keine Dopplung
```

#### Verify

`wiring_check` 307 Namen / **0** nicht auflösbar · Menü 40/0 · 928 Nachschlagungen / **0** nie erzeugt / **0** ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Vergleich 2275 Elemente: **0** Layout-, 0 Farb-, 0 Radius-, 0 Schriftgrössenänderungen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Changelog am laufenden Programm: `GS_RELEASES[0].v` = `GS_VERSION` (sonst bliebe der Dialog stumm) · 9/9 Inline-Scripts + `sw.js` + `releases.v1.js` `node --check` OK · `GS_VERSION` v31.60 · `sw.js` gs-v31.60 · `_headers` v31.60 · meta 31.60.20260901.

#### Offen für morgen

Kommen die echten Bilder, wird `gsTwinPrompt()` an den **konkreten** Fehlerkennungen geschärft — nicht an Vermutungen darüber, was eine Bilderkennung falsch machen könnte.

---

### 2026-09-01 (aw) — v31.59: Bestand und Vorschlag im 3D unterscheidbar

Nachtrag zu V3, und beim Benutzen sofort spürbar. Seit v31.58 enthält ein Plan beides — Pflanzen aus dem Garten-Scan (`existing:true`) und neu vorgeschlagene. Im Modell sahen sie **identisch** aus.

#### Die Lösung

Der Footprint unter jeder Pflanze trug bisher immer die Pflanzenfarbe bei 15 %. Jetzt:

| | Fläche | Ring |
|---|---|---|
| Bestand | `#bdbdbd`, 10 % — neutral, zurückhaltend | — |
| Vorschlag | Pflanzenfarbe, 22 % | `#7cb342`, flache `RingGeometry` |

`RingGeometry` statt Torus: flach auf dem Boden, keine zusätzliche Höhe, kein Schattenwurf.

Legende darunter — **nur wenn der Plan tatsächlich Bestand enthält**. Ohne Garten-Scan gibt es nichts zu unterscheiden, und eine Legende für eine Unterscheidung, die es nicht gibt, verwirrt mehr als sie hilft.

#### Gemessen an dem, was der Renderer baut

Der erste Versuch scheiterte: `_gsPP3DInlineState` legt die Szene nicht offen, also kam `{meshes: 0}` heraus — kein Beweis, sondern eine Messlücke. Zweiter Anlauf: die Konstruktoren `THREE.RingGeometry` und `THREE.MeshStandardMaterial` vorübergehend umhüllen und mitzählen. Das prüft den tatsächlich gegangenen Codeweg, unabhängig davon, was der Renderer hinterher offenlegt.

Bei 2 vorhandenen und 2 neuen Pflanzen:

```
ringe: 2
fuesse: #bdbdbd @0.10 · #bdbdbd @0.10 · #66bb6a @0.22 · #66bb6a @0.22
canvas: 1
```

#### Farben

Legendentext `--text2` auf `--card`: hell 11,37:1 · dunkel 11,57:1. Ring `#7cb342` gegen den 3D-Grund `#0d2818`: 6,29:1 (Nicht-Text, Soll 3:1). Bestand `#bdbdbd`: 8,38:1.

#### Verify

`wiring_check` 307 Namen / 0 nicht auflösbar · Menü 40/0 · **0** offene Nachschlagungen · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Renderer-Konstruktoren am laufenden Programm gezählt · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.59 · `sw.js` gs-v31.59 · `_headers` v31.59 · meta 31.59.20260901.

---

### 2026-09-01 (av) — v31.58: Planer V3 — er plant in den Garten, nicht auf ein leeres Rechteck

Der Zwilling aus v31.57 wird Eingabe für den KI-Planer.

#### Was der Planer bisher vom Bestand wusste

Namen. `gsPPbuildUserContext` lieferte `myPlants` als Liste von Zeichenketten. Keine Positionen, keine Beete, keine Lichtzonen.

Jetzt kommt der gemessene Garten dazu — als Auftragstext in Metern:

```
📐 GEMESSENER BESTAND (Garten-Scan vor 3 Tagen) — Fläche 3m × 2m, Nullpunkt links oben:
VORHANDENE PFLANZEN:
  · Tomate bei (0m, 0m), 0.6m×0.6m, Beet A, Sonne
  · Rosmarin bei (2.4m, 1.4m), 0.5m×0.5m, Töpfe, Halbschatten
BEETE:   · Beet A: 0m,0m → 1.5m×1m
LICHTZONEN:
  · Sonne (Südseite): 0m,0m → 2m×2m
  · Halbschatten (Hauswand): 2m,0m → 1m×2m
PFLICHT: Plane IN diesen Garten. …
```

Mit **Altersangabe** — ein Scan von vor einem Jahr beschreibt einen anderen Garten als einer von gestern, und die KI soll das gewichten können statt es zu übersehen.

#### Der Packer musste umlernen

`_gsSanitizePlannerPlan` sortierte **alle** Pflanzen in saubere Reihen. Richtig auf leerer Fläche — falsch, sobald echte Koordinaten da sind. Eine Tomate, die an der Wand steht, steht dort; sie in Reihe zwei zu schieben wäre kein Plan, sondern eine Behauptung.

Jetzt: `existing:true` behält die Position (nur geklemmt), Neues wird in die Lücken gesetzt — 10-cm-Raster, erste freie Stelle gewinnt, mit Abstandsprüfung gegen den Bestand. Kein Optimierer: nachvollziehbar schlägt clever, und ein Gärtner soll sehen können, *warum* etwas dort liegt.

Gemessen mit 2 Bestands- und 3 neuen Pflanzen:

| Pflanze | Position | |
|---|---|---|
| Tomate | (0, 0) | Bestand, unverändert |
| Rosmarin | (2.4, 1.4) | Bestand, unverändert |
| Salat | (0.7, 0) | neu, in der Lücke neben der Tomate |
| Karotte | (1.2, 0) | neu |
| Kürbis (2.9×1.9) | — | **kein Platz**, ehrlich markiert |

**0 Überschneidungen.**

#### „Kein Platz" darf nicht still bleiben

Der Packer setzt ein Flag, wenn nach dem Bestand nichts mehr passt. Ohne Anzeige läge die Pflanze bei (0,0) im Plan und der Nutzer glaubte, sie passe — genau die Sorte stiller Rest, die dieser Meilenstein überall entfernt hat. Jetzt zwei Meldungen über dem Plan: „In deinen Garten geplant" (n Pflanzen bleiben) und „Kein Platz mehr" (welche).

#### Ein Farbfehler an 95 Stellen

Beim Bauen der Warnmeldung wollte ich `--c-warn-d` auf `--bg-warn-soft` verwenden. Nachgerechnet: **3,46:1**. Dann geprüft, wo diese Kombination sonst noch steht — **36 Mal**. Und `--c-warn-d` insgesamt **95 Mal**.

Der alte Wert `#e65100` lag als Text auf **jedem** Untergrund unter AA:

| Untergrund | alt | neu |
|---|---|---|
| `--bg-warn-soft` | 3,46:1 | **5,11:1** |
| `--card` | 3,79:1 | **5,60:1** |
| `--surface2` | 3,45:1 | **5,10:1** |
| `--g-bg` | 3,36:1 | **4,97:1** |
| `--bg-yellow-soft` | 3,69:1 | **5,46:1** |

`contrast_check` hatte **nichts** gemeldet: die Stellen sitzen fast alle in Dialogen, und er misst nur, was auf den elf Bildschirmen sichtbar ist. Von Hand gefunden, weil ich vor dem Verwenden gerechnet habe.

An der Wurzel behoben (`#bf360c` hell, `#ffb74d` dunkel — beides Werte, auf die die App bereits vereinheitlicht ist), plus die Token-Kopie für PDF und Druck und sieben Rückfallwerte, die sonst dem alten Wert widersprochen hätten.

#### Verify

`wiring_check` 307 Namen / 0 nicht auflösbar · Menü 40/0 · **0** offene Nachschlagungen · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Kontext, Auftragstext und Packer am laufenden Programm · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.58 · `sw.js` gs-v31.58 · `_headers` v31.58 · meta 31.58.20260901.

---

### 2026-09-01 (au) — v31.57: Der Garten-Zwilling

Fernandos Vorlage (vier Bilder): Garten scannen → erkennen → 3D-Modell → Überblick mit echten Zahlen.

#### Zuerst nachgesehen, was es schon gibt

Die Lektion des Tages, diesmal im grössten Massstab. Es gab **zwei** ausgewachsene Systeme:

| | Umfang |
|---|---|
| `gsGardenScan*` | 3 Fotos, GPS, KI-Analyse, Pflanzendetails, 3D-Umschalter, What-if, Chat, PDF |
| `gsPP*` (Planer) | LiDAR, Flächenfoto, Zeichenfläche, Bodenfoto, Lux, Wetter, Agronomie, Mondphase, Constraint-Validator, 2D-SVG, **Three.js-3D**, Verfeinerung, Speichern/Laden/Umbenennen/Duplizieren, PDF |

Und: **Three.js ist selbst gehostet** (`assets/three.min.js`, 603 KB) und war in `CLAUDE.md` nicht dokumentiert — dort standen nur Leaflet und pdf.js. Jetzt korrigiert.

#### Die eigentliche Lücke

Der vorhandene Scan **empfiehlt** Pflanzen (`site_analysis` + `recommended_plants`). Fernandos Bilder zeigen das Gegenteil: „12 Pflanzen **erkannt**". Ein Planungswerkzeug, kein Bestandsaufnahme-Werkzeug.

Genau daran scheiterte v31.17. Dort steht im Code:

> „Pflegezonen" und „Lichtzonen" stammen aus dem Sensor-Produkt und haben in dieser App **KEINE Entsprechung**. Kacheln mit erfundenen Zahlen zu füllen wäre genau die Sorte Lüge, die ich in dieser Sitzung reihenweise entfernt habe.

Diese Begründung war richtig. Die Antwort ist nicht, die Kacheln zu füllen — sondern die Daten zu schaffen.

#### Der Zwilling

`gsTwin*`: Foto → `callVisionAI` → `{bed, plants[x_m,y_m,w_m,h_m], beds, zones}`.

**Bewusst dieselbe Datenform wie ein Planer-Plan.** Damit rendert `gsPP3DRenderInline` das 3D-Modell ohne eine Zeile neuen Renderer-Code. Keine zweite Engine, keine Divergenz. Am laufenden Programm belegt: Three.js geladen, Canvas erzeugt, Modell gezeichnet.

Die drei Stufen aus der Vorlage („Analyse läuft" → „Modellierung" → fertig) sind **keine Dekoration**: die erste ist der echte Vision-Aufruf, die zweite das Aufbereiten und Speichern.

#### Sicherheit: alles aus der KI wird geklemmt

Jede Zahl auf einen Bereich, jeder Text auf eine Länge, jede Lichtart auf die drei bekannten. Mit einem Angriffs-String am laufenden Programm geprüft:

| | |
|---|---|
| `window.__geknackt` | `false` |
| eingeschleuste `<img>` | 0 |
| eingeschleuste `<script>` | 0 |
| Browser-Meldungen | 0 |

Zusätzlich verwirft `txt()` jetzt alles mit spitzen Klammern — was `<` enthält, kam nicht aus einer Bilderkennung. Verteidigung in der Tiefe, nicht als Ersatz für das Escaping.

#### Zum achten Mal die Doppel-Klassen-Falle

Fünf meiner neuen Klassennamen gab es schon (`.gs-go-head`, `-grid`, `-num`, `-lbl`, `-cta`). Teils gewann meine Regel, teils die alte — bei `.gs-go-cta` die alte mit `var(--fill-brand)`, womit **mein durchgerechneter Dunkelmodus-Fix gar nicht wirkte**. Aufgefallen nur, weil ich die Farben gemessen habe. Alle fünf alten entfernt: eine Regel pro Klasse.

#### Zwei Farbfehler, die kein Prüfstand gefunden hätte

- **`.gs-go-cta`**: `#fff` auf `var(--g-dark)`. Im Dunkelmodus ist `--g-dark` **hellgrün** (`#a5d6a7`) → **1,64:1**. Jetzt feste Werte je Modus: hell 12,16:1, dunkel 11,17:1, Knopf gegen Karte 9,47:1.
- **Vertrauenswert**: `#bf360c` ist hell richtig (5,60:1), dunkel 2,78:1. Jetzt zwei Werte, dunkel `#ffb74d` (8,99:1).

Beide von Hand nachgerechnet — `contrast_check` misst nur, was auf den elf Bildschirmen sichtbar ist, und beides sitzt im Gartenüberblick bzw. in einem Fenster.

#### Und der Prüfstand hat dazugelernt

Er meldete `1,27:1` an der Achievements-Kachel. Gegen `origin/main` geprüft: **identische Farben, identische Kachel** — nur 158px tiefer, weil mein Überblick länger ist. Ursache: die Verdeckungs-Prüfung nimmt die **Mitte** des Textes, die Messung die **ganze Box**. Ein Text, dessen Mitte frei liegt, dessen Unterkante aber schon unter der Navigationsleiste steckt, wurde halb gegen die Leiste gemessen.

`contrast_check` überspringt jetzt, was die Leiste anschneidet. Kein echter Fund ging dabei verloren — beide Modi weiterhin 0.

#### Verify

`wiring_check` 307 Namen / 0 nicht auflösbar · Menü 40/0 · **0** offene Nachschlagungen · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Scan-Rundlauf, Normalisierung, Angriffs-String und 3D-Modell am laufenden Programm · 9/9 Inline-Scripts + `sw.js` + alle Prüfstände `node --check` OK · `GS_VERSION` v31.57 · `sw.js` gs-v31.57 · `_headers` v31.57 · meta 31.57.20260901.

#### Als Nächstes

KI-Planer V3: den Zwilling als Eingabe für den Planer nutzen. Wer seinen Bestand gescannt hat, soll nicht noch einmal Fläche, Boden und Licht eintippen müssen — das steht dann schon da.

---

### 2026-09-01 (at) — v31.56: Startseite neu geordnet

Vier Wünsche von Fernando, alle gemessen statt gehofft.

#### Neue Reihenfolge auf der Startseite

| vorher | nachher |
|---|---|
| Wetter · Heute zu tun · **XP-Balken** · Zahlen · Wochenübersicht · Quiz · Inserate · Rangliste | Wetter · Heute zu tun · Zahlen · Wochenübersicht · **Inserate** · **Rangliste** · **Quiz** |

Am laufenden Programm ausgelesen (die Reihenfolge lässt sich mit `render_check` nicht vergleichen — positionsbasierte Schlüssel, siehe `CLAUDE.md` §7.1):

```
 835  home-marketplace-live   🛒 Aktive Inserate · Live
 943  home-lb-card            🏆 Quiz-Rangliste
1024  quiz-card               🎯 Täglich-Quiz
```

Die beiden Karten standen bisher **ausserhalb** des Containers, der `padding:0 16px` liefert, und brachten ihren eigenen 16px-Rand mit. Beim Verschieben hätte sich das verdoppelt. Nachgemessen: alle drei sitzen bei `x=16`, Breite 380 — bündig wie zuvor.

#### XP-Balken: die zweite Hälfte war die wichtigere

Das Markup zu entfernen war trivial. `gsUpdateXPBar` bedient aber **beide** Balken über eine `widgets`-Liste, alle Zugriffe abgesichert. Hätte ich nur das Sichtbare entfernt, wären fünf Nachschlagungen auf nicht mehr vorhandene Elemente zurückgeblieben — genau die stille Sorte Rest, die der Meilenstein heute auf null gebracht hat. Der Home-Eintrag ist deshalb auch aus der Liste raus.

Gegenprobe: `wiring_check` weiterhin **0** offene Nachschlagungen.

#### Luft zwischen Wetter und Werkzeugen

Wetterkarte `margin-bottom: 0`, Werkzeug-Raster `margin-top: 6px`, dazwischen nur die 14px hohe und meist leere Sync-Zeile — gemessener Abstand **24px**. Das las sich als ein Klotz.

Jetzt **39px** mit einer 1px-Linie in `--border` darin. Bewusst keine weitere Karte: der Garten-Bildschirm ist ohnehin lang, und eine Trennung braucht keinen eigenen Rahmen.

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · **0** offene Nachschlagungen · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · Home-Reihenfolge und Ränder am laufenden Programm ausgelesen · Garten-Abstand 24 → 39px gemessen · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.56 · `sw.js` gs-v31.56 · `_headers` v31.56 · meta 31.56.20260901.

---

### 2026-09-01 (as) — Leaked-Password-Protection ist aktiv · Backend-Block geschlossen

Fernando hat den Schalter gesetzt (`Authentication → Providers → Email`). **Gegengeprüft, nicht geglaubt** — genau der Punkt, an dem eine frühere Meldung schon einmal von der Realität abwich:

Der Advisor meldet `auth_leaked_password_protection` **nicht mehr**. Das ist derselbe Melder, der es heute früh noch als `Disabled` führte; sein eigener Zustand hat sich geändert.

Die Zahlen gehen restlos auf:

| Stand | Advisor-Einträge |
|---|---|
| heute früh | 145 |
| + `fn_quiz_answers_verify` (neu, 2 Einträge: anon + authenticated) | 147 |
| − `revoke execute` darauf | 145 |
| − Leaked-Password-Protection | **144** |

Durchgehend **0 ERROR**.

#### Damit ist der gesamte Backend-Block zu

| Punkt | Stand |
|---|---|
| Zwei offene Schreib-Endpunkte auf `species` | ✅ 410, Secret aus dem ausgelieferten Code |
| Rollen-Leak über fremde UUIDs | ✅ vorher `true`, nachher `false`, Gast-Stöbern unverändert |
| Quiz: `is_correct` kam vom Client | ✅ Server leitet ab, `UPDATE`/`DELETE` gesperrt |
| Marktplatz-Zähler ohne Auth-Guard | ✅ 10 Versuche als anon, Zähler unverändert |
| Standard-Grants (`TRUNCATE`/`REFERENCES`/`TRIGGER`) | ✅ 0 Reste |
| Leaked-Password-Protection | ✅ aktiv, Advisor-gegengeprüft |

#### Was bewusst NICHT gemacht wurde

- **Die sechs `claude/*`-Branches mit dem alten Secret löschen.** Das Secret ist wertlos, seit beide Endpunkte 410 liefern. Branches zu löschen ist unumkehrbar und war nicht beauftragt.
- **Das Secret rotieren.** Es schützte ausschliesslich diese zwei Funktionen; die tun nichts mehr. Eine Rotation wäre Beschäftigung ohne Wirkung.

Kein App-Code, kein Versions-Bump.

---

### 2026-09-01 (ar) — v31.55: Backend abgesichert · Verdrahtungs-Liste auf 0

Fernando hat den Schreibzugriff freigegeben; der Supabase-Server hatte sich neu verbunden und die Schreibwerkzeuge funktionierten. **Drei der vier offenen Punkte konnte ich damit selbst erledigen**, einer bleibt bei ihm.

#### 1 · Die zwei offenen Schreib-Endpunkte (erledigt)

`admin-seed-species` (v3→v4) und `species-bulk-seed` (v4→v5) liefern jetzt 410. Vorher: `verify_jwt: false`, `SUPABASE_SERVICE_ROLE_KEY`, geschützt nur durch ein hartcodiertes Secret, das im Klartext in sechs gepushten Branches lag.

Gegenprobe am ausgelieferten Code: Secret weg, `createClient` weg, `SERVICE_ROLE_KEY` weg. Nachweis kein Missbrauch: `species` 2’838 Zeilen, 1 in 90 Tagen, 0 in 7 Tagen.

#### 2 · Drei Sicherheits-Migrationen (erledigt, jede einzeln belegt)

**Rollen-Leak.** Vorher als `anon` reproduziert: `fn_role_at_least` auf eine fremde UUID lieferte `true`. Die UUID steht öffentlich in `social_posts.user_id`. Nachher: `false`.

**Und die Regressionsprobe**, vor der die Migration ausdrücklich warnt: Gast-Stöbern läuft — species 2’838, recipes 194, remedies 173, facts 162, quests 3, techniques 161, quizzes 203, diseases 135. Der Feed zeigt 1 von 3 Beiträgen, weil zwei `is_archived = true` sind, nicht wegen der Änderung.

**Quiz-Antworten.** Reihenfolge vorher geprüft: der lebende Einfügepfad schickt `selected_option` (`index.html:11192`), `data-idx` ist der DB-Index (`11081`), und die App macht auf `quiz_answers` nur SELECT und INSERT — das `REVOKE UPDATE, DELETE` ist gefahrlos. Nachher belegt: Trigger hängt · Ableitung liefert bei Index 0 `true`, bei Index 1 `false` · anon und authenticated haben nur noch `INSERT, SELECT`.

**Marktplatz-Zähler.** Zehn Aufrufe als `anon` gegen ein echtes Inserat: Zähler bleibt bei **6**.

#### 3 · Härtung, die ich als optional geführt hatte (erledigt)

`TRUNCATE`, `REFERENCES`, `TRIGGER` auf allen 200 Tabellen von `anon`/`authenticated` entzogen, inklusive Default Privileges. Rest: **0**. anon hat noch genau `DELETE, INSERT, SELECT, UPDATE` — was die App braucht. Gast-Stöbern danach erneut geprüft: unverändert. Dazu `revoke execute` auf `fn_quiz_answers_verify` (Trigger-Funktion, die niemand direkt aufrufen soll): Direktaufruf verwehrt, Trigger läuft. Advisor: **0 ERROR**.

#### 4 · Die Wetterwarnungs-Karte — und eine Entscheidung, die schon getroffen war

Ich wollte sie bauen. Die Live-Daten sprachen dafür: `weather_alerts` hat **4 offene Warnungen**, neueste vom 28.08., der Cron läuft.

Dann fiel auf, dass ich **zwei Dinge verwechselt hatte**:

| Tabelle | Stand |
|---|---|
| `weather_alerts` | persönliche Live-Warnungen, Push + Inbox. **Hat eine Ansicht**: `gsOpenWeatherAlerts()` am Knopf in den Push-Einstellungen. Funktioniert. |
| `garden_weather_alerts` | saisonale Typ-Warnungen (für September: Herbst-Frost, Starkregen, Trockenheit — je mit Warnzeichen und Sofortmassnahmen). **Das** war die Karte ohne Element. |

Und für die zweite steht die Antwort seit v29.78 in der Startseite: *Home-Unwetter-Card entfernt (Fernando: unnötig im Home). Wetter-Warnungen-Inbox + Push-Alerts bleiben unabhängig erhalten.*

Keine vergessene Arbeit, sondern eine getroffene Produktentscheidung. v29.78 entfernte die Aufrufe und liess die Rümpfe stehen — genau die tauchten in der Verdrahtungs-Liste auf. Jetzt sind auch sie weg (~150 Zeilen). Die Tabelle bleibt, sie ist Wissensbestand.

**Meine frühere Aussage war falsch** (*Backend und Cron liefern per Push, nur die Ansicht in der App fehlt*) — das galt für `weather_alerts`, und die hat eine Ansicht.

#### Verdrahtungs-Meilenstein: 42 → 0

Dazu noch `tab-map`: der zweite Parameter von `switchTab` war ein Element, das es nicht gibt. `switchTab` deklariert `btn`, liest es aber nirgends — folgenlos, nur irreführend.

#### Was bei Fernando bleibt

**Leaked-Password-Protection.** Der Supabase-Server hat kein Werkzeug für die Auth-Konfiguration. Zwei Dinge nachgeschlagen statt geraten:

- Die Organisation ist auf **Pro** — die Funktion ist verfügbar (sie ist Pro-only). Meine Vermutung Plan-Beschränkung war falsch, sie ist schlicht aus.
- Der **richtige Pfad** ist `Authentication → Providers → Email`, nicht Policies wie ich zuletzt geschrieben hatte.

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · **0** offene Nachschlagungen (von 42) · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.55 · `sw.js` gs-v31.55 · `_headers` v31.55 · meta 31.55.20260901.

---

### 2026-09-01 (aq) — v31.54: Meilenstein „Alles verdrahtet" — von 42 auf 7

Letzte Welle. Was übrig ist: **6 Wetterwarnungs-Elemente** (Fernandos Entscheidung) und **1 geprüft harmloser Rest** (`tab-map` — `switchTab` benutzt seinen zweiten Parameter gar nicht).

#### Der letzte echte Fund

`switchTab` berechnete beim Betreten der Mehr-Seite die **Aufschlüsselung der Artendatenbank** — zehn Kategorien mit Zahlen plus Gesamtsumme — und schrieb sie in `#more-db-cats`. Das Element gab es nie. Jetzt zugeklappt auf der Mehr-Seite, gemessen:

> 🌿 Wildpflanzen 2'226 · 🍄 Pilze 636 · 🌳 Bäume & Sträucher 431 · 🌱 Kräuter 388 · 🪴 Hauspflanzen 286 · 🔵 Flechten 118 · 🌾 Moose 115 · 🫧 Algen 97 · 🥦 Gemüse 40 · **Total 4'337 Arten**

#### Ein Spiel, das es zweimal gab

Beim Wechsel auf den Farm-Reiter baute `switchTab` jedes Mal `#gc-start`, `#gc-gameover` und `#gc-canvas` auf — den BlattFänger als **Arcade-Spiel auf einer Zeichenfläche**. Nachgesehen: `#screen-farm` enthält heute `farm-grid`, `farm-seeds`, `farm-tools`, `farm-shop` und **kein einziges `<canvas>`**. Es ist ein Rasterspiel. Auch `window.gcGame` wurde nirgends gesetzt, die äussere Bedingung konnte also nie zutreffen.

#### Ich habe die App dabei kurz zerbrochen

Beim Herausschneiden des Spiel-Codes blieb der Rest des Blocks samt drei schliessenden Klammern stehen. Ergebnis: `Unexpected token '}'` — das **gesamte** Inline-Programm war nicht mehr lesbar, die App hätte nicht mehr gestartet.

Der Prüfstand meldete es im selben Lauf: `JS-Fehler beim Aufbau: Unexpected token '}'`, `NICHT AUFLOESBAR: 276` (statt 0). Repariert, bevor irgendetwas gepusht wurde. Das ist der beste Beleg für den Wert dieses Meilensteins: **die teuerste Änderung des Tages wurde in derselben Minute gefunden, in der ich sie gemacht habe.**

#### Weitere Reste entfernt

`cam-perm-dialog` schloss bei **jedem** Tabwechsel einen Dialog, den es seit v31.50 nicht mehr gibt (samt seiner CSS-Regel) · `more-stat-total` an zwei Stellen · `chip-all` in `gsClearSearch` (die Zeile darüber setzt ohnehin alle Chips zurück).

#### Der Prüfstand meldet keinen Falschalarm mehr

Drei Funde waren **vorbildlicher Code**: Rückfallketten der Form

```js
getElementById('camera-wrapper') || video.parentElement || document.body
getElementById('kb-loading-biblio') || getElementById('kb-loading')
  || getElementById('bibliothek-loading') || querySelector('.kb-loading')
```

Wer ein `||` dahinter schreibt, hat den leeren Fall bereits bedacht. `wiring_check` überspringt solche Glieder jetzt — das **letzte** Glied einer Kette wird weiter geprüft, denn wenn auch das ins Leere geht, fällt die Kette als Ganzes um.

Ein Prüfstand, der an gutem Code meckert, wird ignoriert; und dann findet er auch die echten Fehler nicht mehr.

#### Bilanz des Meilensteins

| Welle | Version | Fund |
|---|---|---|
| 1 | v31.49 | GPS im Gartenformular · Garten-Standort überschrieb den Nutzer-Standort |
| 2 | v31.50 | neun tote Funktionen · Kamera-Begründung zurückgeholt · ein Repointing-Risiko |
| 3 | v31.51 | drei von vier Bodenarten lieferten ihre Warnungen nie aus |
| 4 | v31.52 | Beitragstyp wurde beim Absenden weggeworfen |
| 5 | v31.53 | KI-Tageskontingent war nirgends zu sehen |
| 6 | v31.54 | Artendatenbank-Aufschlüsselung · abgelöstes Spiel · Falschalarme |

**42 → 7 offene Nachschlagungen, 0 ungesicherte, 0 nicht auflösbare Aufrufe, 40/40 Menü-Einträge intakt.**

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · **7** abgesichert (6 davon Wetter) · 0 ungesichert · Aufschlüsselung und Farm-Reiter am laufenden Programm geprüft · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · 9/9 Inline-Scripts + `sw.js` + alle Prüfstände `node --check` OK · `GS_VERSION` v31.54 · `sw.js` gs-v31.54 · `_headers` v31.54 · meta 31.54.20260901.

---

### 2026-09-01 (ap) — v31.53: Das KI-Tageskontingent war nirgends zu sehen

Welle 5. Die Einstellungs- und Menü-Gruppe: `about-db`, `settings-ai-quota-row`, `settings-ai-quota-sub`, `mi-adminpanel`, `dedup-badge`.

#### Der Fund

Gratis-Nutzer haben **15 KI-Aufrufe pro Tag** (`gsAboGetAIQuota`). `initSettingsScreen` füllt seit v26.65 zwei Elemente damit — `#settings-ai-quota-row` und `#settings-ai-quota-sub`. Beide gab es **nie**.

Nachgesehen, wo das Kontingent sonst auftaucht: an genau zwei Stellen, `callAI` und `callVisionAI` — und zwar erst **im Fehlerfall**:

```
🚫 Tageslimit erreicht — heute 15/15 KI-Aufrufe verbraucht.
```

Man konnte nicht einteilen, was man nicht sehen konnte. Der erste Hinweis auf ein Limit war die Absage.

#### Die Lösung

Eine Zeile in der Abo-Karte der Einstellungen, dort wo Plan und Abrechnung stehen. Startet verborgen wie die Portal-Zeile daneben; `initSettingsScreen` blendet sie ein, sobald es etwas anzuzeigen gibt — bei Pro oder eigenem Schlüssel bleibt sie weg, weil es dann kein Limit gibt.

Gemessen, alle drei Zustände:

| verbraucht | Text | Farbe |
|---|---|---|
| 0 | `✅ 0 / 15 Calls heute · 15 übrig` | `--muted` |
| 12 | `⚠️ 12 / 15 Calls heute · 3 übrig` | `rgb(191,54,12)` |
| 15 | `🚫 15 / 15 Calls heute · 0 übrig` | `rgb(198,40,40)` |

#### Und die Farbe stimmte nicht

Der vorhandene Code setzte bei ≤3 verbleibenden Aufrufen `#e65100` — auf der weissen Karte **3,79:1**, unter AA. Auf `#bf360c` gebracht: **5,60:1**.

Das ist der zweite Fall dieser Art in Folge (v31.51 war es die Boden-Infobox). Beide Male hätte `contrast_check` nichts gefunden — beim ersten Mal steckte die Stelle in einem geschlossenen Fenster, hier existierte sie überhaupt nicht. **Was nicht gerendert wird, wird nicht gemessen.** Wer eine neue Farbe in Code schreibt, der bisher tot war, rechnet selbst nach.

#### Drei Reste aufgelöst

- **`mi-adminpanel`** — ein Menü-Eintrag aus einer früheren Fassung. Das Admin-Panel ist erreichbar: `#settings-admin-dashboard-row` in den Einstellungen und ein Menü-Sucheintrag, der `openAdminPanel()` direkt aufruft.
- **`about-db`** — zwölf Zeilen tiefer wird die Artenzahl ohnehin in vier Elemente geschrieben, plus `modal-about-arten` aus dem Über-Dialog. Die Zahl war nie weg, nur diese Stelle.
- **`dedup-badge`** — Abzeichen aus derselben früheren Fassung. `deduplicateDB` läuft beim Start und räumt selbstständig auf; es braucht keine Bedienung.

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · 22 → **17** abgesichert · 0 ungesichert · Kontingent-Anzeige in allen drei Zuständen gemessen · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · `GS_VERSION` v31.53 · `sw.js` gs-v31.53 · `_headers` v31.53 · meta 31.53.20260901.

#### Stand des Meilensteins

Von 42 offenen Nachschlagungen sind **17** übrig, davon **8 die Wetterwarnungs-Gruppe**, die auf Fernandos Entscheidung wartet. Die übrigen 9: `camera-wrapper` (hat einen absichtlichen Rückfall), `chip-all`, `cam-perm-dialog`, `gc-*`×3, `more-db-cats`, `more-stat-total`, `kb-loading`/`bibliothek-loading` (Rückfallkette), `tab-map` (geprüft harmlos).

---

### 2026-09-01 (ao) — v31.52: Der Beitragstyp wurde beim Absenden weggeworfen

Welle 4. Die Community-Gruppe der Liste — `post-category`×2, `post-submit-btn`, `post-photo-section`.

#### Der Fund

`submitPost` ist live, am Knopf „🌿 Post veröffentlichen" im Beitrags-Fenster. Ihre Zeile:

```js
var cat = ((document.getElementById('post-category')||{}).value) || 'fund';
```

`#post-category` gibt es nicht — das Auswahlfeld heisst `#post-type`. Also `{}` → `.value` undefined → **immer `'fund'`**. Showcase, Hilfe, Tipp, Frage und Rarität wurden alle als dasselbe gespeichert, ebenso der Typ, mit dem `openPostWithType` das Fenster geöffnet hatte. Dasselbe Feld im Entwurf-Wiederherstellen (`_gsRestoreSocialDraft`).

#### Warum es lange nicht auffiel — und was das für die Bewertung heisst

Der Hauptweg ist der Inline-Composer (`submitInlinePost`), und der **macht es richtig**: eigene `catMap`, korrekte Zuordnung.

An der Live-Datenbank nachgesehen: `social_posts` enthält **3 Beiträge, alle `showcase`** — durch das Fenster ist noch keiner gegangen. Der Schaden ist bisher also null. Der Weg steht trotzdem offen, und ein Knopf führt direkt hinein.

#### Der naheliegende Fix wäre falsch gewesen

Einfach `#post-type` lesen hätte „💬 Status" kaputt gemacht. An der Live-DB geprüft:

```
CHECK (category = ANY (ARRAY['fund','help','tip','showcase','rare','question']))
```

`openPostWithType` kennt aber die Typen `status` und `photo`, die dort **nicht** vorkommen. Wer „Status" gewählt hätte, bekäme eine Serverabweisung statt eines Beitrags.

Also **eine** Abbildung `gsPostKategorie(typ)` für beide Wege, die nur Werte aus dem CHECK herauslässt — dasselbe Muster wie `gsBodenKey` in v31.51. Der Inline-Weg hatte seine Tabelle richtig, aber eben nur für sich.

Gemessen, alle sechs Einstiege:

| gewählt | `#post-type` | gesendete `category` | im CHECK |
|---|---|---|---|
| showcase | `showcase` | `showcase` | ✅ |
| status | `fund` | `fund` | ✅ |
| help | `help` | `help` | ✅ |
| tip | `tip` | `tip` | ✅ |
| question | `question` | `question` | ✅ |
| photo | `showcase` | `showcase` | ✅ |

Auch Unsinn und `null` landen sicher auf `fund`.

#### Zwei Dinge, die erst beim Messen auffielen

**„Status" hatte gar keine Option.** `openPostWithType('status')` setzte `typeSelect.value = 'status'`, aber das `<select>` kennt diesen Wert nicht — der Browser lässt das Feld dann **leer**. Wer über „💬 Status" einstieg, sah ein Auswahlfeld ohne Auswahl. Option ergänzt, mit `value="fund"`, weil der CHECK nichts anderes zulässt.

**Der Absende-Knopf hatte seine Kennung nicht.** `submitPost` sucht seit jeher `#post-submit-btn`, um „⏳ Poste …" zu zeigen und Doppeltippen zu sperren. Der Knopf trug die id nicht — also keine Rückmeldung. Ergänzt.

Dazu eine tote lokale Variable entfernt (`photoSection` auf `#post-photo-section`, nie benutzt, mit einem Kommentar daneben, der selbst sagte, dass der Bereich immer sichtbar ist).

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · 25 → **22** abgesichert · 0 ungesichert · Beitrags-Rundlauf über alle sechs Typen · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · `GS_VERSION` v31.52 · `sw.js` gs-v31.52 · `_headers` v31.52 · meta 31.52.20260901.

---

### 2026-09-01 (an) — v31.51: Drei von vier Bodenarten lieferten ihre Warnungen nie aus

Welle 3 des Meilensteins. `soil-info-box` sah nach dem harmlosesten Fund der Liste aus — eine Infobox, die fehlt. Dahinter lag der bisher schwerste Fehler dieses Meilensteins.

#### Zwei Namenswelten für dieselbe Sache

| | |
|---|---|
| `<select id="gard-soil">` liefert | `sand`, `loam`, `clay`, `humus` |
| `BODENTYPEN` und die Warntexte kennen | `sandig`, `lehmig`, `tonig`, `humusreich`, `kalkreich`, `moorig` |

Die Zuordnung in `getBodenTipp` fragte `gespeicherterWert.includes(schluessel)`:

```
'sand'.includes('sandig')  → false
'loam'.includes('lehm')    → false
'clay'.includes('ton')     → false
'humus'.includes('humus')  → true   ← der einzige Treffer, und der war Zufall
```

#### Was das gekostet hat — gemessen, nicht geschätzt

Für Tomaten, `renderBodenInfoCard`:

| gespeicherter Wert | erkannter Boden | Warnung | Karte |
|---|---|---|---|
| `sand` | — | nein | 1'220 Zeichen |
| `loam` | — | nein | 1'220 Zeichen |
| `clay` | — | nein | 1'220 Zeichen |
| `humus` | `humusreich` | nein | 1'220 Zeichen |
| *(Gegenprobe)* `sandig` | `sandig` | **ja** | **2'228 Zeichen** |
| *(Gegenprobe)* `tonig` | `tonig` | **ja** | **2'022 Zeichen** |

Rund **tausend Zeichen konkreter Abhilfe** — „Boden-Warnung: Tomaten" plus Lösungsschritte — wurden drei von vier Nutzern still vorenthalten. `renderBodenInfoCard` ist live und läuft in der Pflanzenansicht.

#### Die Lösung

Eine gemeinsame Normalisierung `gsBodenKey(wert)`, die beide Schreibweisen kennt, **erst exakt, dann als Teilzeichenkette** (damit Freitext wie „sandiger Lehm" weiter trifft). Bewusst **nicht** die gespeicherten Werte umgeschrieben: in den Gärten der Nutzer stehen die englischen Kürzel, und eine Datenmigration für ein Anzeigeproblem wäre das falsche Werkzeug.

Nachher: `sand → sandig` mit Warnung und 2'228 Zeichen, `clay → tonig` mit 2'022. `loam` und `humus` zeigen korrekt keine Warnung — Tomaten stehen dort gut.

#### Dazu der Eingang, der ursprünglich gesucht war

`showSoilInfo` zeichnet aus `BODENTYPEN` Beschreibung, geeignete Pflanzen, Nachteile und einen Verbesserungs-Tipp. Sie hatte **weder Ziel noch Auslöser**: `#soil-info-box` fehlte, und das Auswahlfeld hatte kein `onchange`. Beides ergänzt — wer den Boden wählt, sieht jetzt sofort, was ihn ausmacht.

`showSoilInfo` griff ausserdem mit dem Rohwert in `BODENTYPEN` (bei `loam` also ins Leere) und mischte in der Gut-Prüfung deutsche und englische Schlüssel (`'humusreich' || 'lehmig' || 'loam'`). Jetzt beides über `gsBodenKey`.

#### Ein Fehler, den kein Prüfstand gefunden hätte

Die neue Infobox hätte ihren Warntext in `#e65100` auf `#fff3e0` bekommen — **3,46:1**, unter AA. `contrast_check` misst, was auf den elf Bildschirmen **sichtbar** ist; diese Box steckt in einem geschlossenen Fenster. Von Hand nachgerechnet und auf `#bf360c` gesetzt (5,11:1) — dasselbe Warnrot, auf das v31.20 die App bereits vereinheitlicht hat.

Diese Grenze steht jetzt in `CLAUDE.md` §7.1: **wer Farbe in einem Modal setzt, rechnet selbst nach.**

#### Verify

`wiring_check` 305 Namen / 0 nicht auflösbar · Menü 40/0 · 26 → **25** abgesichert · 0 ungesichert · Boden-Rundlauf am laufenden Programm (Normalisierung, Warnkarten, Infobox) · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · 9/9 Inline-Scripts + `sw.js` `node --check` OK · `GS_VERSION` v31.51 · `sw.js` gs-v31.51 · `_headers` v31.51 · meta 31.51.20260901.

---

### 2026-09-01 (am) — v31.50: Neun tote Funktionen weg · Meilenstein „Alles verdrahtet", Welle 2

Die Funde, die sich in Welle 1 als Reste erwiesen haben, sind jetzt entfernt. **41 → 26** offene Nachschlagungen, **−10 KB** in `index.html`, rund 215 Zeilen.

#### Entfernt

| | warum |
|---|---|
| `openPlantOfDay` + `initPlantOfDay` + `initPlantOfDayUpgraded` | POTD ausdrücklich abgeschafft, zwei der drei waren leere Stubs |
| `openNewPost` | zweiter Öffner für `modal-new-post`; `openPostWithType` macht es und setzt zusätzlich den Typ |
| `profileRequestMagicLink` | der passwortlose Login existiert im Onboarding |
| `profSaveSupabaseConfig` | siehe unten |
| `grantCameraPermission`, `skipCameraPermission` | Knöpfe eines Dialogs, den es nicht gibt |
| `GS_ERROR_LOG` + `gsLookupError` | 6,8 KB Dokumentation als JavaScript |
| `pendingCameraAction` | nach dem Obigen nur noch geschrieben, nie gelesen |
| 4 Nachschlagungen | `gs-guest-banner`×2, `legal-arten-info`, `cnt-all` |

#### Eine davon war ein Risiko

**`profSaveSupabaseConfig`** liess URL und Schlüssel einer **beliebigen** Supabase-Instanz eintragen und schrieb sie nach `gs_sb_url` / `gs_sb_key`. Die App hätte danach ihre Daten woanders hingeschickt. Als Entwickler-Werkzeug gedacht, ohne Aufrufer, ihre beiden Eingabefelder gibt es in `renderProfileLogin` längst nicht mehr — der Code lag aber bei jedem Nutzer ausgeliefert mit. Eine Oberfläche, die das Ziel der eigenen Datenverbindung umbiegt, gehört nicht in eine veröffentlichte App.

#### Und eine Sache habe ich beim Entfernen zurückgeholt

Der eigene Kamera-Erlaubnis-Dialog war unerreichbar (`#cam-perm-dialog` existiert nirgends), es lief immer nur der Rückfall: direkt `getUserMedia`, der Browser fragt selbst.

Dabei ging etwas verloren, das im Code steht: die zwei Aufrufer übergeben seit jeher `opts` mit Symbol, Titel und **Begründung** — „GreenScan braucht Kamera-Zugriff um Arten direkt zu bestimmen". Ohne Dialog wurde das stillschweigend weggeworfen. Der Nutzer sah nur die nackte Browser-Abfrage.

Jetzt kommt die Begründung als kurzer Hinweis, **bevor** der Browser fragt. Am laufenden Programm mit gefälschtem `getUserMedia` geprüft:

| Fall | Hinweis | Anfragen | Aktion lief | gemerkt |
|---|---|---|---|---|
| erlaubt | ✅ | 1 | ✅ | `granted` |
| verweigert | ✅ | 1 | — | — |

Das ist der Punkt des ganzen Meilensteins: nicht nur wegräumen, sondern nachsehen, was beim Wegräumen von damals verloren ging.

#### Die Fehler-Dokumentation ist umgezogen, nicht gelöscht

`docs/FEHLER-LOG.md` — acht Einträge mit Symptom, Ursache, Behebung und Vorbeugung, maschinell aus der Datenstruktur erzeugt, damit nichts von Hand verlorengeht. In der App war sie unsichtbar und wurde trotzdem von jedem Telefon bei jedem Kaltstart mitgeparst.

#### Verify

`wiring_check` 304 Namen / 0 nicht auflösbar · Menü 40/0 · **41 → 26** abgesichert · 0 ungesichert · Kamera-Rundlauf beide Fälle · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · `index.html` 5'134'747 → 5'124'444 Bytes · 9/9 Inline-Scripts + `sw.js` + Archiv + sechs Prüfstände `node --check` OK · `GS_VERSION` v31.50 · `sw.js` gs-v31.50 · `_headers` v31.50 · meta 31.50.20260901.

#### Was von den 26 noch offen ist

`cam-perm-dialog` (Rest im `switchTab`-Aufräumen) · `gc-start`/`gc-gameover`/`gc-canvas` (ein Spiel?) · `more-db-cats`/`more-stat-total` · `post-category`×2/`post-submit-btn`/`post-photo-section` · `soil-info-box` · `kb-loading`/`bibliothek-loading` (Rückfallkette, vermutlich Falschmeldung) · `about-db`/`settings-ai-quota-*` · `mi-adminpanel`/`dedup-badge` · `camera-wrapper` · `chip-all` · `tab-map` (geprüft harmlos) · `weather-alert-card`×3 + `wa-*`×5 (Fernandos Entscheidung).

---

### 2026-09-01 (al) — v31.49: GPS im Gartenformular · Meilenstein „Alles verdrahtet", Welle 1

Fernandos Wahl für den nächsten Meilenstein: die 42 verbliebenen Verdrahtungs-Funde **einzeln** durchgehen. Erste Welle: die sieben Funktionen ohne Aufrufer.

#### Vollständige Triage zuerst

| Funktion | Bezüge | betroffene ids |
|---|---|---|
| `openPlantOfDay` | 0 | `plant-of-day-card` |
| `grantCameraPermission` | 0 | `cpd-allow-btn`, `lidar-toggle` |
| `openNewPost` | 0 | `compose-name` |
| `detectGardenLocation` | 0 | `loc-gps-status`×2 |
| `profileRequestMagicLink` | 0 | `prof-magic-email/err/btn` |
| `profSaveSupabaseConfig` | 0 | `prof-sb-url/key` |
| `gsLookupError` | 0 | — (Fehlzuordnung, siehe unten) |

#### Vier lösten sich beim Nachsehen auf — es sind keine fehlenden Features

Das ist der wichtigste Teil: **nicht jeder Fund ist ein Friedhof.**

- **`openPlantOfDay`** — „Pflanze des Tages" wurde ausdrücklich entfernt. Daneben stehen `initPlantOfDay(){/* POTD entfernt */}` und `initPlantOfDayUpgraded(){/* POTD entfernt */}`, beide leer, beide ohne Aufrufer. Ein Rest, kein Verlust.
- **`profileRequestMagicLink`** — ich wollte das schon als „fehlender passwortloser Login" einbauen. Dann nachgesehen: **es gibt ihn bereits**, im Onboarding (`onb-magic-btn` → `onbMagicLink()`, Zeile 2368). Die Profil-Fassung ist eine überholte Zweitfassung.
- **`openNewPost`** — `modal-new-post` ist erreichbar, über `openPostWithType` (7 Bezüge). Zwei Öffner, einer davon verwaist.
- **`gsLookupError`** — die ihm zugeordneten ids (`legal-arten-info`, `cnt-all`) gehören gar nicht zu ihm; meine Rückwärtssuche nach der umschliessenden Funktion landete falsch. Beide stehen im Boot-Block; `cnt-all` trägt seit v28.22 sogar den Kommentar „Home-Kategorien entfernt".

#### Einer war ein echter Fund — und ein Fehler dazu

**`detectGardenLocation`.** Beim Anlegen eines Gartens gibt es ein Feld „Standort (optional)" und daneben `#gard-loc-status` — ein Meldefeld, das **immer verborgen** ist, weil nie etwas hineinschreibt. Die GPS-Funktion dafür liegt fertig im Code, ohne Aufrufer. Abtippen war der einzige Weg.

Und die Funktion selbst war kaputt: eine verunglückte Kopie aus dem Standort-Fenster. Sie liest `#gard-loc` / `#gard-loc-status`, schreibt im Rückruf aber in `#loc-name-input`, `#loc-status` und `#loc-gps-status` — Felder eines anderen Formulars, von denen eines gar nicht existiert.

**Der schwerere Teil:** sie rief `saveUserLocation(locObj)`. Der Standort **eines Gartens** hätte damit den Standort des **Nutzers** überschrieben. Wer einen Balkon in Bern einträgt, wohnt deswegen nicht dort — und der Nutzer-Standort steuert Wetter, Frostwarnungen und Saisonkalender.

Gemessen mit gefälschtem GPS auf Bern und abgefangenem Nominatim:

| | |
|---|---|
| Knopf | 44×42 px |
| Feld nach dem Tipp | `Bern` |
| Meldung | `✅ Bern` |
| **`gs_user_location`** | **bleibt `Zürich`** |

#### Verify

`wiring_check` 304 Namen / 0 nicht auflösbar · Menü 40/0 · 42 → **41** abgesichert · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA beide Modi · `touch_check` 0 unter 24×24 · `GS_VERSION` v31.49 · `sw.js` gs-v31.49 · `_headers` v31.49 · meta 31.49.20260901.

#### Als Nächstes (Welle 2)

Die sechs aufgelösten Funde entfernen — sie sind belegt tot, aber das ist eine eigene, zusammenhängende Änderung. Dazu `GS_ERROR_LOG`: 6,8 KB Fehler-Dokumentation als JavaScript, die jeder Nutzer bei jedem Kaltstart parst, zuletzt gepflegt am 27.03.2026, lesbar für niemanden. Die gehört als Markdown ins Repo.

---

### 2026-09-01 (ak) — Backend gegen die Live-DB geprüft: zwei meiner Angaben waren überholt

Fernando wollte die offenen Backend-Punkte gemeinsam durchgehen. Ich habe sie deshalb **an der Produktionsdatenbank nachgemessen** statt aus dem vorbereiteten Skript abzuschreiben — und zwei Angaben stimmen nicht mehr.

#### Was ich korrigieren muss

**1. Die Pflege-Erinnerungen sind NICHT tot.** Das Skript sagt „seit 33 Tagen still tot". Live:

| kind | Anzahl | neueste |
|---|---|---|
| `plant_task` | 600 | **2026-09-01** |
| `plant_task_pre` | 19 | 2026-08-30 |

231 Benachrichtigungen in den letzten 30 Tagen. Die dedup-Migration ist damit eine Robustheits-Verbesserung, kein Notfall — die Dringlichkeit, die ich zuletzt genannt habe, war falsch.

**2. Der Trigger auf `quiz_answers` ist ein anderer.** Vorhanden ist `trg_quiz_answers_sync_lb` (Ranglisten-Abgleich), **nicht** die serverseitige Antwortprüfung. `fn_quiz_answers_verify` existiert nicht (0 Treffer). Die Migration ist also wirklich offen.

#### Was live bestätigt offen ist

**A · `quiz_answers` — anon darf INSERT, UPDATE, DELETE, TRUNCATE.** `is_correct` kommt weiter vom Client, und Cron `jobid=23` verteilt am 31.12. ein Jahr PRO gratis an die Top 3. Heutiger Umfang: 28 Antworten, 50 % richtig — der Schaden wäre klein, das Loch ist offen.

**B · Rollen-Leak.** `fn_is_role(_role, _uid)` mit zwei Parametern ist live. Auskunft über fremde Konten, ohne Login.

**C · `fn_mkt_increment_views`.** `security_definer = true`, `anon_darf = true`, **`hat_uid_bezug = false`** — kein einziger Bezug auf `auth.uid()`. Die Schwester `fn_quiz_record_answer` hat beides. Nur diese wurde vergessen.

**D · Zwei offene Schreib-Endpunkte auf `public.species`** — der schwerste Punkt. `admin-seed-species` v3 ist **ACTIVE**, `verify_jwt: false`, schreibt mit dem Service-Role-Key an der RLS vorbei. Schutz: ein hartcodiertes Secret im Quelltext — und das liegt im Klartext in sechs gepushten Branches (`claude/happy-gates-HK3zX`, `claude/lucid-cerf-{3ooy72,XIpgp,dfxwv7,dix1vr,o5b8ie}`). In `origin/main` ist es nicht.

Nachweis geprüft: **kein Missbrauch.** `species` = 2'838 Zeilen, 1 Zeile in 90 Tagen, 0 in 7 Tagen, neueste vom 2026-07-02.

#### Ein Fund, den ich bewusst NICHT dramatisiere

Beim Prüfen von C fiel auf: anon und authenticated haben auf **allen 200 Tabellen** `TRUNCATE`, `REFERENCES` und `TRIGGER`. TRUNCATE unterliegt keiner RLS.

Bevor ich das als Loch melde, habe ich nachgesehen, ob es erreichbar ist:

- PostgREST hat kein Verb für TRUNCATE; der Anon-Schlüssel ist ein PostgREST-JWT, kein Postgres-Login.
- Der einzige Umweg wäre eine anon-aufrufbare Funktion mit dynamischem SQL. **0 Treffer.**

Also: unnötig weite Standard-Grants, kein offenes Loch. Als optionaler Block angehängt, klar getrennt.

#### Warum ich es nicht selbst angewendet habe

Lesen geht, schreiben nicht: `apply_migration` und `deploy_edge_function` verlangen eine Bestätigung, die in einer Cloud-Sitzung niemand geben kann. Ich habe es an beiden versucht.

`scripts/SICHERHEIT_JETZT.sql` fasst A, B, C in einer einfügbaren Datei zusammen. **Keine äussere Transaktions-Klammer** — zwei der drei Migrationen bringen ihre eigene mit, und das erste innere `COMMIT` hätte eine äussere beendet; alles danach wäre ungeschützt gelaufen. Jede ist für sich atomar und idempotent.

---

### 2026-09-01 (aj) — v31.48: Drei Menü-Einträge, die nirgendwohin führten

Eine blinde Stelle des Verdrahtungs-Prüfstands: er sammelt `on*`-Attribute aus dem **Dokument**. Die 40 Einträge der Menü-Suche tragen ihre Aktion aber als **Text in einer Liste** (`MENU_ITEMS`), nicht am Element. Sie wurden nie geprüft.

Beim ersten gezielten Durchgang: **3 von 40 kaputt.** Alle drei nach demselben Muster — auf einen Bildschirm springen, dann dort ein Element antippen, das es nicht gibt:

| Eintrag | wollte | gibt es nicht |
|---|---|---|
| 📅 Blühkalender | `menuNav('home')` → scroll zu `#bluehkalender-widget` | der Kalender liegt im **Garten**-Reiter |
| 📜 Scan-Historie | `menuNav('favs')` → `#tab-scans`.click() | dort gibt es keinen solchen Reiter |
| 🌾 Lichtmesser kalibrieren | `openLightMeter()` → nach 400ms `#lux-calibrate-btn`.click() | den Knopf gibt es nicht |

Der Nutzer sucht im Menü, tippt den Treffer an — und landet irgendwo, wo nichts passiert. Ohne Fehlermeldung, ohne Hinweis.

#### Die Lösung

Alle drei rufen jetzt direkt die Funktion, die es längst gibt: `openBluehkalender()`, `openScanHistory()`, `gsLuxCalibrate()`. Die Umleitung über „Bildschirm wechseln, warten, Knopf antippen" ist ohnehin die zerbrechlichste Form der Verdrahtung — sie bricht bei jeder Umbenennung, und zwar lautlos.

Beim Kalibrieren ist die direkte Fassung sogar besser: `gsLuxCalibrate` sagt von sich aus „Bitte zuerst eine Messung machen", wenn noch keine vorliegt. Vorher passierte nichts.

**Am laufenden Programm geprüft** — jeder Eintrag einzeln ausgeführt und das Ergebnis angesehen:

- Blühkalender → `modal-content`: „🌻 Blühkalender · September · 4 blühende Arten"
- Scan-Historie → `modal-scan-history-full`: „4 Scans · 3 Arten · 2 in DB"
- Kalibrieren ohne Messung → Lichtmesser + Hinweis
- Kalibrieren mit Messung → `modal-lux-calib` öffnet

#### Damit es nicht wiederkommt

`wiring_check.js` geht `MENU_ITEMS` jetzt bei jedem Lauf durch — alle 40 Einträge, je Funktion und angesprochenes Element. Stand jetzt: **0 kaputt**.

Das ist die allgemeine Lehre: Aktionen, die als *Zeichenkette in einer Datenstruktur* stehen statt am Knopf, entziehen sich jeder Prüfung, die nur das Dokument ansieht. Wer weitere solche Listen anlegt, muss sie hier eintragen.

#### Verify

`wiring_check` 303 Namen / 0 nicht auflösbar · **Menü 40/0 kaputt** (vorher 3) · 45 → **42** abgesicherte Nachschlagungen · 0 ungesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 gegen `origin/main` · `contrast_check` 0 unter AA in beiden Modi · `touch_check` 0 unter 24×24 · `GS_VERSION` v31.48 · `sw.js` gs-v31.48 · `_headers` v31.48 · meta 31.48.20260901.

---

### 2026-09-01 (ai) — v31.47: Zehn Garten-Artikel, die seit v28.57 niemand sehen konnte

Weiter durch die Liste der abgesicherten Nachschlagungen — und der zweite Fund derselben Art wie der Friedhof.

#### Der Fund

`GARDEN_LIBRARY` enthält **zehn geschriebene Artikel** in zehn Kategorien (Boden, Bewässerung, Düngen, Pflanzenschutz, Kompost, Aussaat, Ernte, Hochbeet, Balkon, Biodiversität), rund 4'000 Zeichen Text mit Lesezeit und Schwierigkeitsgrad. Dazu:

- `renderGardenLibrary(catFilter, searchTerm)` — vollständig, mit Filter und Suche
- `openGardenArticle(id)` — Detail-Fenster, **existiert** (`#garden-article-modal-content`)
- eine eigene Stilregel `#garden-library-content { padding-bottom: 100px !important; }`
- ein Aufruf bei **jedem** Wechsel auf den Garten-Reiter (`index.html:22963`)

Fehlt: das `<div id="garden-library-content">`. Zweite Zeile von `renderGardenLibrary`, `if (!container) return`. Der Aufruf kehrte seit v28.57 jedes Mal sofort um.

#### Die Lösung

Ein Fenster, kein Seitenabschnitt. Der Garten-Bildschirm ist ohnehin lang, und Pflanzendoktor, Krankheits-Lexikon, Bodenverbesserer und Erntekalender sind alle Fenster — die Bibliothek fügt sich damit ein. Eingang in der Gruppe **„📚 Wissen & Werkzeuge"**, wo sie hingehört.

`catFilter` und `searchTerm` waren immer schon Parameter, hatten aber nie eine Bedienung. Jetzt gibt es zehn Kategorie-Chips und ein Suchfeld; beide gehen über dieselbe Stelle (`gsGardenLibFilter`), damit das eine das andere nicht zurücksetzt.

Gemessen: Eingang in der richtigen Gruppe · 10 Artikel · Kategorie „Boden & Erde" → 1 · Suche „biene" → Wildbienen-Artikel · Detail-Fenster öffnet mit 496 Zeichen Inhalt · keine JS-Fehler.

Der tote Aufruf beim Tab-Wechsel ist weg, ebenso der 100px-Sockel in der Stilregel — der galt für die Liste als Bildschirm-Abschnitt und würde im Fenster nur einen leeren Streifen erzeugen.

#### Der Prüfstand nannte eine Zahl, die niemand nachprüfen konnte

`render_check` meldete `Farbe geaendert: 3` — und sagte nicht, welche. Eine solche Zahl kann man nur glauben oder ignorieren, und beides ist falsch. Er nennt die Stellen jetzt.

In diesem Fall waren es die drei `›`-Pfeile in der Werkzeug-Gruppe:

```
Schrift rgb(1,87,155)   → rgb(26,61,26)     garden::DIV>DIV:0>BUTTON>SPAN:1
Schrift rgb(255,255,255) → rgb(1,87,155)    garden::DIV>DIV:1>BUTTON>SPAN:1
Schrift rgb(230,81,0)   → rgb(255,255,255)  garden::DIV>DIV:4>BUTTON>SPAN:1
```

Jedes Element trägt die Farbe seines Vorgängers — der neue Knopf sitzt an Position 0 und hat alle Schlüssel um eins verschoben. Das ist die bekannte Grenze der positionsbasierten Schlüssel, dieselbe, die schon Umsortierungen nicht vergleichen kann (`CLAUDE.md` §7.1). Keine Farbänderung, eine Einfügung.

#### Verify

`wiring_check` 303 Namen / 0 nicht auflösbar / 0 ungesichert · 46 → **45** abgesichert · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift je 0, Farbe 3 (Schlüsselverschiebung, oben belegt) · `contrast_check` 0 unter AA in beiden Modi · `touch_check` 0 unter 24×24 · Bibliotheks-Rundlauf am laufenden Programm · `GS_VERSION` v31.47 · `sw.js` gs-v31.47 · `_headers` v31.47 · meta 31.47.20260901.

---

### 2026-09-01 (ah) — v31.46: Der Pflanzenfriedhof hatte einen Eingang, aber keinen Ausgang

Der Verdrahtungs-Prüfstand aus v31.45 liess 52 **abgesicherte** Nachschlagungen offen — still und folgenlos, hiess es. Beim Durchgehen stellte sich heraus: eine davon war alles andere als folgenlos.

#### Der Fund

Auf **jeder** Pflanzenkarte steht `🪦 Pflanzenfriedhof` (`index.html:29083`, dazu ein Icon-Knopf bei `7389`). Der Weg dahinter funktioniert vollständig:

1. `moveToCemetery` fragt nach der Todesursache,
2. schiebt die Pflanze von `myPlants` nach `deadPlants`,
3. speichert beides — `savePlantsToStorage()` **und** `gs_dead_plants`.

Und dann hört es auf.

- `renderCemetery` schreibt in `#cemetery-list` — **existiert nicht** → `if (!list) return`.
- Der einzige Weg dorthin war `switchPlantsTab` — **0 Aufrufer**, und ihre beiden Abschnitte `plants-alive-section` / `plants-cemetery-section` existieren ebenfalls nicht.
- `restoreFromCemetery` hängt an einem Knopf, der nur in der nie gerenderten Friedhofs-Karte steht.

**Am laufenden Programm nachgestellt:** Pflanze verabschieden → `myPlants` 3 → 2, `gs_dead_plants` 0 → 1, im Dokument **nichts** über den Friedhof sichtbar. Die Daten waren immer da. Der Weg zurück nicht.

Für Leute, die Pflanzen benennen und pflegen, ist das kein Schönheitsfehler.

#### Die Lösung

Kein Reiter, sondern ein Fenster — `gsOpenCemetery()` über den vorhandenen `_gsNlOpen`-Überlagerer, mit `<div id="cemetery-list">` darin. `renderCemetery` bleibt unverändert, es hat jetzt einfach sein Element.

Der Eingang steht oben auf „Meine Pflanzen" und **nur dann, wenn es dort etwas zu sehen gibt** — `renderMyPlants` blendet ihn ein und aus. Dazu eine Rückmeldung beim Verabschieden (`Basilikum → 🪦 Pflanzenfriedhof`) und beim Wiederherstellen. Gemessener Rundlauf: verborgen → sichtbar mit Zahl 1 → Karte mit Name, Ursache und Knopf → wiederhergestellt, Eingang wieder verborgen. Keine JS-Fehler.

#### Zum siebten Mal die Inline-Stil-Falle

Mein erster Anlauf gab dem Knopf `style="…display:flex…"` und verliess sich auf `hidden`. Gemessen: `hidden=true`, trotzdem **380×34 sichtbar** — ein Inline-Stil schlägt die Browser-Vorgabe `[hidden]{display:none}`. Dieselbe Falle wie bei `.tab-badge` in v31.45, einen Tag alt. Jetzt eine Klasse `.gs-cem-entry` mit `[hidden]`-Zeile.

#### Zwei weitere Funde

**Die Kamera-Erlaubnis ging bei jedem Neustart verloren.** Fünf Stellen schreiben `gs_cam_perm`, vier davon `'granted'` — der Kamerastart im Scanner schrieb `'1'`. Der Leser beim Start kannte nur `'granted'`. Wer die Kamera im Scanner erlaubte, wurde vom Pflanzendoktor beim nächsten Start wieder gefragt. Jemand hatte das früher bemerkt und in `initScanner` einen Notbehelf eingebaut, der genau diesen Wert abfängt — behoben war es damit nicht, nur an einer Stelle überdeckt. Jetzt schreibt die Stelle `'granted'`, der Leser akzeptiert weiterhin `'1'` (bestehende Installationen), der Notbehelf ist weg.

**`switchPlantsTab` hätte Schaden angerichtet.** Ihre erste Zeile: `document.querySelectorAll('.mp-htab').forEach(b => b.classList.remove('active'))`. Diese Klasse tragen inzwischen die drei Reiter im **Marktplatz** (Aktiv / Gewonnen / Gekauft). Tot, aber nicht harmlos. Entfernt.

#### Der Prüfstand stand sich selbst im Weg

**Falscher Alarm:** `gs-community-body` wurde dreimal als „nie erzeugt" gemeldet. Es entsteht über `var bodyId = '…'` und dann `id="' + bodyId + '"` — mein Abgleich sah nur Literale. Der Prüfstand kennt jetzt auch diesen Umweg (beschränkt auf Variablennamen, die auf `id` enden; alles andere machte jede Zeichenkette zur möglichen id).

**Der eigentliche Fehler war schwerer.** `scripts/_seed.js` legte die Beispiel-Pflanzen unter `myPlants` ab. Die App liest `ps_myplants`. **Seit v31.30 haben also alle Prüfstände immer eine leere Pflanzenliste vermessen** — Leerzustand statt Karten, kein Pflegeplan, keine Aufgaben. Aufgefallen erst, als ein Versuch `myPlants[0]` lesen wollte und `undefined` bekam. Genau deshalb blieb der Friedhof so lange unentdeckt: ohne Pflanzen gibt es nichts zu verabschieden.

Der Pflanzen-Bildschirm misst jetzt 120 statt 104 Elemente. Was sonst noch unter dem Leerzustand verborgen lag, wird sich in den nächsten Läufen zeigen.

#### Verify

`wiring_check` 302 Namen / 0 nicht auflösbar / 0 ungesichert · 51 → **46** abgesicherte Nachschlagungen · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 geändert gegen `origin/main` · `contrast_check` 0 unter AA in beiden Modi · `touch_check` 0 unter 24×24 · Friedhofs-Rundlauf am laufenden Programm · 9/9 Inline-Scripts + `sw.js` + Archiv + sechs Prüfstände `node --check` OK · `GS_VERSION` v31.46 · `sw.js` gs-v31.46 · `_headers` v31.46 · meta 31.46.20260901.

Die eine gemessene Layout-Änderung ist dieselbe wie in v31.45: die Arten-Zahl im Wissen-Kopf erscheint innerhalb des Messfensters. Keine Regression.

---

### 2026-09-01 (ag) — v31.45: ein Prüfstand für die Verdrahtung

Die vier vorhandenen Prüfstände messen alle dasselbe: wie die App **aussieht**. Keiner prüft, ob das Angetippte **ankommt**. Genau das war in v31.40 die Lücke — der Lichtmesser war komplett tot, und gefunden habe ich das beim Durchsehen, nicht beim Messen.

`scripts/wiring_check.js` löst beide Richtungen auf.

#### Richtung 1 — Knopf → Funktion

301 `on*`-Aufrufe über elf Tabs, alle auflösbar. **0 Funde.** Ein negatives Ergebnis, aber jetzt ein wiederholbares.

#### Richtung 2 — Funktion → Element

1'010 Nachschlagungen mit festem Namen, davon **71 auf ids, die nirgends entstehen**. Entscheidend ist die Unterscheidung, die der Prüfstand trifft:

| | | |
|---|---|---|
| **abgesichert** (`if (el) …`) | 58 | still und folgenlos |
| **ungesichert** (`.textContent` direkt) | **13** | wirft — der Rest der Funktion läuft nicht mehr |

#### Die Funde

**1. Der Lichtmesser zeigte die alte Messung.** Beim erneuten Öffnen soll die Anzeige zurücksetzen:

```js
const lvEl = document.getElementById('lux-val') || document.getElementById('lux-n');
if (lvEl) lvEl.textContent = '—';
```

Beide ids gibt es nicht; das Element heisst `lux-value`. Das `if` verschluckte es. Folge: die Zahl der vorigen Messung stand noch da, während die Kategorie daneben schon leer war — mitsamt ihrer alten Farbe, weil die als Inline-Stil gesetzt wird und `textContent=''` sie nicht mitnimmt. **Dieselbe Wurzel wie v31.40, zwei Zeilen weiter.**

**2. 220 Zeilen für eine entfernte Funktion.** Ein „Raum-Lichtscan" in fünf Schritten lag noch vollständig im Code: `updateScanStepUI`, `captureCurrentStep`, `finishRoomScan`, `cancelRoomScan`, `renderRoomScanResult`, dazu `calcLuxFromPixels` und drei Aufräum-Blöcke an anderer Stelle. Ohne Knopf, ohne Oberfläche — und mit **fünf Variablen, die nirgends deklariert werden** (`SCAN_STEPS`, `scanStep`, `scanResults`, `scanStream`, `scanLiveTick`). Die erste Zeile hätte einen `ReferenceError` geworfen. Der `pagehide`-Block warf ihn bei jedem Verstecken der Seite, gefangen von einem `try`.

**Bewusst nicht umgehängt:** In dieser Insel lag mit `calcLuxFromPixels` eine sorgfältige Lux-Berechnung — sRGB-Gamma-Dekodierung, perzeptuelle Luminanz, stückweise Kalibrierkurve. Verlockend, den laufenden Lichtmesser darauf zu zeigen. Aber der hat inzwischen Zonen-Abtastung, Varianz-Warnung, `gsLuxApplyCalibration` und Sensor-Fusion — und ist gegen **seine eigene** Helligkeits-Skala kalibriert. Die gespeicherte Nutzer-Kalibrierung wäre still ungültig geworden. Genauer aussehen und falscher rechnen ist kein Fortschritt.

**3. `gsUpdateGardenBadge` — ein Abzeichen ohne beide Enden.** Seit v30.34 vorhanden, zielte auf `garden-tab-badge`. Einen Garten-Reiter hat die Leiste gar nicht, und die Funktion hatte **keinen einzigen Aufrufer**. Fällige Pflege war nirgends zu sehen. Jetzt am Pflanzen-Reiter, aufgerufen aus `savePlantsToStorage` (dem einen Engpass für Pflanzen- und Aufgaben-Änderungen, 23 Aufrufstellen) und einmal beim Start. Gemessen: 2 → 1 → 0 und dann verborgen.

**4. `updateScanHistoryBadge` war doppelt tot.** Sie zielte auf `scan-hist-badge` (existiert nicht) und war ausserdem unerreichbar: weiter oben setzt `window.updateScanHistoryBadge = function(){ gsRenderNotifBadge(); }` denselben globalen Namen neu. Da die Zuweisung zur Laufzeit nach dem Hochziehen der Deklaration greift, lief seit v28.59 immer die neue Fassung.

#### Zweimal hat sich der Prüfstand selbst korrigiert

**Zu viel:** Der erste Lauf meldete acht Fehler, von denen keiner einer war — `then` und `classList` aus verketteten Aufrufen, `rgba` und `var` aus CSS in `style`-Zuweisungen, und `e`/`p`/`_l` aus Variablen, die **im Attribut selbst** deklariert werden.

**Zu wenig — und das ist die gefährlichere Richtung:** Beim Ausblenden der Kommentare verschwanden elf **echte** Funde. Ursache: Zeile ~29648 enthält `accept="image/*"`. Das `/*` steht in einer Zeichenkette und schliesst nie, also galt ab dort der halbe Rest der Datei als Kommentar. Die naive Prüfung „steht ein `/*` näher als das letzte `*/`?" ist auf dieser Datei unbrauchbar; er führt jetzt beim Durchgehen Zeichenketten mit.

#### Zum sechsten Mal dasselbe Muster — diesmal bei mir

Ich schrieb eine `.tab-badge`-Regel für das neue Abzeichen und mass danach `#e53935` statt des geschriebenen `#c62828`. Die Klasse gab es schon, 570 Zeilen weiter unten, als Rest der Menü-Badge, die v31.01 entfernt hat — kein Element trug sie mehr. Die spätere Regel gewinnt. Genau der Fehler, den ich in v31.33 zweiundfünfzigmal aufgeräumt habe. Jetzt eine Regel statt zwei, und `#c62828` statt `#e53935`: Weiss darauf sind 5,9:1 gegen 3,8:1 — bei einer 10px-Ziffer der Unterschied zwischen lesbar und geraten.

#### Nebenbei

- `scripts/_seed.js` herausgezogen — die Beispieldaten lagen nur in `render_check.js`, der neue Prüfstand brauchte dieselben. Zweimal dasselbe zu pflegen läuft auseinander.
- `GS_RELEASES` rotiert: 22 Einträge inline waren fast das Doppelte des in `CLAUDE.md` festgehaltenen Ziels. Zehn ins Archiv, **63 → 37 KB** inline, 393 gesamt, keine Lücke an der Naht (`v31.34 → v31.33`), keine Duplikate.
- Zwei abgelöste Rezept-Zähler entfernt (`recipes-total-count`, `recipes-filter-count`): die Zahl steht längst in der Leiste darunter.

#### Verify

`wiring_check` 301 Namen / 0 nicht auflösbar / **0 ungesichert** (vorher 13) · `render_check` 0 JS-Fehler, 0 verdächtige Textstellen, Radius/Schrift/Farbe je 0 geändert · `contrast_check` 0 unter AA in beiden Modi · `touch_check` 0 unter 24×24 · 9/9 Inline-Scripts, `sw.js`, `data/releases.v1.js` und alle sechs Prüfstände `node --check` OK.

**Zur einen gemessenen Layout-Änderung:** im Wissen-Bereich wächst die Kopfzeile um 13px, weil ein dritter Chip erscheint — `🌿 4'337 Arten`. Der rendert erst, wenn die Arten-Datenbank geladen ist; nach dem Entfernen der 220 Zeilen schafft sie das innerhalb des Messfensters, vorher nicht. Direkt nachgesehen, nicht geschlossen: keine Regression, sondern der Grund dafür.

#### Offen (52 abgesicherte Nachschlagungen)

Kein Fehler, sondern eine Arbeitsliste: Reste entfernter Oberflächen — `cam-perm-dialog` (4×), `gc-canvas`/`gc-start`/`gc-gameover`, `cemetery-list`/`cnt-alive`/`cnt-dead`, `weather-alert-card` (3×) plus sechs `wa-*`. Jede einzeln zu prüfen: manche sind harmlos, manche eine Funktion ohne Anzeige. Die `weather-alert-*`-Gruppe ist die bekannte, auf Fernandos Entscheidung wartende.

---

### 2026-09-01 (af) — Nachtrag: aus dem Zufallsfund eine wiederholbare Prüfung gemacht

Der `undefined`-Fund in v31.44 war ein Vertreter einer **Klasse**: eine Zuordnung greift daneben, und das Ergebnis landet wörtlich im Text. Ich habe systematisch nach den anderen Vertretern gesucht — `undefined`, `null`, `NaN`, `[object Object]`, `Invalid Date`, `{{platzhalter}}` — über elf Tabs in beiden Modi.

**Ergebnis: 0.** Die Klasse ist nach v31.44 sauber.

Damit das nicht wieder vom Zufall abhängt, meldet `render_check.js` diese Zahl jetzt bei jedem Lauf. Sie muss **0** sein; steht dort etwas anderes, ist irgendwo eine Zuordnung oder Formatierung danebengegangen.

Kein Versions-Bump — reines Werkzeug plus Dokumentation, kein App-Code.

---

### 2026-09-01 (ae) — v31.44: „undefined" auf 22 Karten — gefunden beim Durchsehen, nicht beim Messen

Nach sieben Releases mit sichtbaren Änderungen wollte ich mich nicht auf „0 Fehler" verlassen. Also alle zehn Seiten in beiden Modi gerendert und **angesehen**. Auf einer Heilmittel-Karte stand im Kategorie-Chip wörtlich `undefined`.

#### Die Spur

Die Daten führen ein Feld `cat`. Fünf Werte darin stehen in **keiner** Zuordnungstabelle:

| Bereich | fehlende Kategorie | Karten |
|---|---|---|
| Rezepte | `fermentation`, `salat`, `backen` | **19** |
| Heilmittel | `oel`, `inhalation` | **3** |

Die Tabellen enthielten stattdessen `ferment` und `gebaeck` — ähnliche Namen, die nie zugeordnet wurden.

#### Die eigentliche Ursache

```js
const catInfo = cats[r.cat] || {emoji:'🌿', bg:'#e8f5e9', color:'#2e7d32'};
```

Der Rückfall hat **kein `label`**. Bei einer unbekannten Kategorie wird `catInfo.label` zu `undefined` und landet wörtlich im Chip.

Der Rückfall in der **Detail**ansicht (66 Zeilen weiter) hat `label:''` — deshalb fiel es nur in der Liste auf. Jetzt sind beide gleich.

#### Zwei Fehler, die sich gegenseitig verdeckten

Die Kategorie `ferment` trägt `color:#e65100` auf `bg:#fff3e0` — **3,46:1**, unter AA. Genau das Paar, das ich in v31.37 an zwei anderen Stellen korrigiert habe.

Mein Kontrast-Prüfstand konnte es nicht finden, **weil kein Rezept diese Kategorie benutzt** und der Chip nie gerendert wird. Hätte ich `fermentation` einfach als Kopie von `ferment` ergänzt, wäre der schlechte Wert mitgekommen und der Prüfstand hätte ihn beim nächsten Lauf gemeldet — als „neuer" Fehler, den ich gerade selbst eingebaut hätte.

Beide stehen jetzt auf `#bf360c` (5,11:1). Alle fünf neuen Farbpaare vorher gerechnet: 4,78 bis 6,08:1.

#### Was das über Prüfstände sagt

Ein Werkzeug misst, was gerendert wird. Was **nie** gerendert wird, ist für es nicht vorhanden — auch wenn es falsch ist und beim nächsten Datensatz sichtbar würde. Das ist keine Lücke, die man schliessen kann; es ist die Natur der Sache. Deshalb bleibt Durchsehen nötig.

---

### 2026-09-01 (ad) — v31.43: Die Kopfleiste, und ein Band das niemand sehen konnte

Nach Startseite (v31.37), Navigationsleiste (v31.38) und allen übrigen Bildschirmen (v31.41) war die Kopfzeile das **letzte dunkle Element**. Sie stand auf `--fill-dark` — in beiden Modi dunkelgrün — und brauchte genau deshalb feste `#fff`-Werte, ein `color:#ffffff !important` und zwei Dunkelmodus-Überschreibungen.

Jetzt `--card`/`--border`: sie kippt selbst, der Titel nutzt `--g-dark`, die Symbole `--text`. Alle drei Sonderregeln sind weg. Dasselbe Muster wie bei der Navigationsleiste — feste Farben sind fast immer ein Zeichen dafür, dass die Fläche darunter nicht mitkippt.

#### Der Fund beim Hinsehen

Nach der Umstellung zeigte sich ein **dunkelgrünes Band** zwischen Kopfleiste und Inhalt.

Ursache: `body` und `#app` standen ebenfalls auf `--fill-dark`. Solange Kopf- **und** Navigationsleiste dunkel waren, hat man diesen Hintergrund **nie** gesehen — er war immer von etwas Dunklem verdeckt. Erst als beide hell wurden, kam er zum Vorschein.

Das ist die interessante Sorte Fehler: er war die ganze Zeit da, hat aber erst durch eine *Verbesserung* Wirkung bekommen. Kein Prüfstand hätte ihn vorher melden können — es war ja nichts falsch zu sehen.

#### Stand der Optik-Serie

| | |
|---|---|
| v31.37 | Kopfzeile der Startseite hell |
| v31.38 | Navigationsleiste hell, Strich-Icons, Edelweiss |
| v31.39 | Startseite neu geordnet |
| v31.41 | alle vierzehn Bildschirme hell |
| v31.42 | Kopfleisten-Symbole gezeichnet |
| v31.43 | Kopfleiste hell, body/#app nachgezogen |

Die App ist damit von oben bis unten in einer Sprache.

---

### 2026-09-01 (ac) — v31.42: Kopfleiste — und ein Emoji, das sich zweimal zurückschlich

Nach der Navigationsleiste (v31.38) jetzt die Kopfzeile: Mond, Glocke und Menü als gezeichnete Symbole. Drei fehlten im Satz (Mond, Schlüssel, Menü) — im selben Stil ergänzt: 24×24, Strichstärke 1,75, runde Enden.

#### Der Fund kam vom Hinsehen, nicht vom Messen

Im gerenderten Bild waren Glocke und Menü Symbole — **der Mond aber weiter ein gelbes Emoji.**

Ursache: `initDark()` und der Umschalter in den Einstellungen setzen beide

```js
btn.textContent = on ? '☀️' : '🌙';
```

und überschreiben damit das Markup. Zwei Stellen, dieselbe Zeile, beide unabhängig geschrieben.

Beide nutzen jetzt `innerHTML` mit den Symbolen — und die sind **einmal** als `GS_ICON_MOON`/`GS_ICON_SUN` definiert, damit es nicht ein drittes Mal auseinanderläuft.

Kein Prüfstand hätte das gefunden: der Kontrast stimmte, die Antippfläche stimmte, es gab keinen JS-Fehler. Nur das Bild sah falsch aus.

---

### 2026-09-01 (ab) — v31.41: Alle Bildschirme hell — und zum vierten Mal dasselbe Muster

Vierzehn Bildschirme hatten dunkle Volltöne als Fläche: Garten grün, Rezepte braun, Heilmittel blau, Einstellungen schiefer, Licht orange. Die Startseite ist seit v31.37 hell. Fernandos Vorlage zeigt durchgehend eine ruhige helle Fläche mit Karten darauf.

#### Zum vierten Mal heute

Die hellen Fassungen waren **teils längst geschrieben**. Zeile ~1249 definiert für Rezepte und Heilmittel warme helle Verläufe — überstimmt von einem Block mit vierzehn `!important`-Dunkelfarben am Dateiende.

Damit ist es heute viermal dasselbe:

| Version | Fertig, aber nicht angeschlossen |
|---|---|
| v31.37 | die helle Kopfzeile der Startseite |
| v31.38 | der Icon-Satz mit 23 Symbolen |
| v31.40 | `displayLuxResult` (die korrekte Lichtmess-Ausgabe) |
| v31.41 | die hellen Bildschirm-Flächen |

Das ist kein Zufall mehr. In diesem Repo wird Arbeit fertiggestellt und dann von einer `!important`-Regel oder einem nicht umgehängten Aufrufer stillgelegt. Wer hier etwas „neu bauen" will, sollte **zuerst suchen, ob es schon da ist**.

#### Zwei Token wieder abgeschafft

`--on-canvas` und `--on-canvas-2` kamen in v31.32 dazu, **weil** die Leinwände dunkel waren. Auf hellen Flächen wären sie jetzt genau die Falle, gegen die sie erfunden wurden: hell auf hell.

Der Prüfstand hat das sofort gezeigt — acht Stellen bei 1,03 bis 1,09:1, und zwar **exakt** die 14 Stellen, die diese Token nutzten. Alle zurück auf `--text` und `--muted`, die Token entfernt.

#### Die Reihenfolge war wichtig

Erst die Leinwände umgestellt, **dann** gemessen, dann repariert. Hätte ich beides in einem Schritt gemacht, wäre nicht belegt, dass genau diese acht Stellen betroffen sind — und warum.

---

### 2026-09-01 (aa) — v31.40: Funktionscheck — 44 Funktionen greifen ins Leere, eine stürzte dabei ab

> Fernando: „Zusätzlich machst du einen Funktioncheck und schaust auf die In und Outputs sowie die verdrahtungen ob da auch alles intelligent und sauber verdrahtet ist."

#### Wie ich geprüft habe

Alle **1'012** im Code angesprochenen Element-Kennungen (`getElementById`, `querySelector('#…')`) gegen alle **irgendwo erzeugten** gestellt — statisches HTML, JS-Strings in jeder Schreibweise, `.id = …`, `setAttribute`. Dann zur Laufzeit über alle elf Tabs gegengeprüft.

| | |
|---|---|
| angesprochen | 1'012 |
| irgendwo erzeugt | 1'277 |
| **nirgends erzeugt** | **75** |
| betroffene Funktionen | **44** |
| davon ohne jeden Aufrufer (toter Code) | 16 |
| davon laufen wirklich | 28 |
| doppelte ids zur Laufzeit | **0** |
| JS-Fehler beim Durchlauf | **0** |

Die 28 laufenden Funktionen prüfen — bis auf eine — vorher auf `null` und tun dann still nichts. Unschön, aber harmlos.

#### Die eine Ausnahme war ein echter Ausfall

```js
function showLuxResult(lux, isReal){
  document.getElementById('lux-val').textContent = …   // ← lux-val gibt es nicht
```

Die Elemente heissen **`lux-value`**, **`lux-marker`** und **`lux-plants`**. Und dieser Zugriff ist ungeschützt.

Am laufenden Programm nachgewiesen:

| | vorher | nachher |
|---|---|---|
| Fehler | `TypeError: Cannot set properties of null` | keiner |
| Lux-Wert | `0` | `26'554` |
| Ergebnis sichtbar | `none` | `block` |
| Kategorie | „Messung startet…" (hängt) | „🔥 Volle Sonne" |
| Knopf | hängt | „💡 Erneut messen" |

Weil die Ausnahme den Rest der Funktion abbrach, wurden auch die Zeilen **nach** dem Aufruf nie erreicht — der Knopf blieb im Messzustand stehen. Die Lichtmessung war komplett tot.

#### Und wieder lag die Lösung daneben

`displayLuxResult` macht dasselbe **richtig**: korrekte ids, `if (!result) return;` als Schutz, und zwei andere Stellen benutzen sie bereits. Nur dieser eine Aufrufer wurde beim Umbau nicht umgehängt.

Das ist heute das **dritte** Mal in derselben Form: die helle Kopfzeile (v31.37), der Icon-Satz (v31.38), jetzt `displayLuxResult`. Die richtige Arbeit war jedes Mal fertig — und nicht angeschlossen.

#### Ein Fund zum Entscheiden, nicht zum Reparieren

Die **Wetter-Warnkarte in der App** (~130 Zeilen, drei Funktionen) hat kein Element im Dokument, und ihr Lader hat **null Aufrufer**.

Das klingt schlimmer als es ist, und das gehört dazu: Migration (`v27_00_weather_alerts.sql`), Edge-Function (`weather-alert-checker`) und Cron existieren — die Warnungen **erreichen** Nutzer über Push und Posteingang. Nur die Karte *in* der App wurde nie gebaut.

Entweder bauen oder entfernen. Das ist eine Produktentscheidung, keine Aufräumarbeit, also lasse ich sie Fernando.

---

### 2026-09-01 (z) — v31.39: Startseite neu geordnet — erst wissen, dann tun

#### Was die Vorlage anders macht

Fernandos Bild zeigt: Begrüssung → **Wetter** (mit einem Satz Rat) → **„Dein Tagesplan"** mit Aufgabenzeilen → **„Nächster Schritt"**. Das ist eine klare Rangfolge: *was muss ich wissen* vor *was soll ich tun* vor allem Übrigen.

Die App zeigte: XP · Kennzahlen · Marktplatz · Wetter · **Tagesplan** · Quiz · Tagesinfo. Der Tagesplan — das Einzige, was den Nutzer zum Handeln bringt — stand an **sechster** Stelle.

Neu: **Wetter · Tagesplan · Fortschritt · Kennzahlen · Tagesinfo · Marktplatz · Quiz.** Kein Baustein entfällt.

#### Verdrahtung zuerst, dann umgeordnet

Vor dem Verschieben habe ich gesucht, was an DOM-Reihenfolge hängt. Zwei Stellen:

- **`gsBuildWidgetStack`** baut aus vier Karten den wischbaren Stapel. Sie sucht **per id** und verschiebt die Karten selbst in einen Viewport — Adjazenz ist ihr egal. Ordnungsunabhängig.
- **`gsMoreFeedbackFirst`** nutzt `hero.nextSibling`, betrifft aber `#screen-more`, nicht die Startseite.

Am laufenden Programm bestätigt: Stapel baut sich (4 Folien, 4 Punkte), Tagesplan füllt sich mit 3 Einträgen, alle 13 geprüften ids genau einmal vorhanden, keine JS-Fehler.

#### Wo mein Vergleichswerkzeug hier nicht hilft

`render_check.js` paart Elemente über einen Schlüssel aus **DOM-Pfad**, id, Klasse und Text. Eine Umordnung ändert genau diesen Pfad — also paart es zwangsläufig falsch.

Es meldete eine Schriftgrössenänderung von **12px** an einem `🌱`. Nachgemessen: alle vier `🌱`-Elemente sind in beiden Ständen identisch (40×32, 40×36, 69×24, 52×49 — jeweils gleiche Schriftgrösse), nur ihre Position ist eine andere.

Das ist keine Schwäche, die man wegprogrammiert — es ist die Natur eines positionsbasierten Vergleichs. Die Grenze steht jetzt in `CLAUDE.md` §7.1, samt dem, was für Umordnungen stattdessen trägt: ids zählen, JS-Fehler prüfen, die abhängigen Funktionen laufen lassen, die tatsächliche Reihenfolge auslesen.

---

### 2026-09-01 (y) — v31.38: Navigationsleiste nach Vorlage — und ein Icon-Satz, der seit Monaten ungenutzt im Repo lag

> Fernando hat ein Referenzbild geschickt: helle Leiste, gezeichnete Strich-Icons, kleine Beschriftungen in Normalschreibung, dunkelgrüner runder Mittelknopf. Dazu: „den Home Button wie das Edelweiss Logo."

#### Der Icon-Satz war schon da

`assets/icons/` enthält **23 eigene Strich-Symbole** mit eigenem README. Und in diesem README steht wörtlich die Begründung, die Fernando jetzt genannt hat:

> „Jede Plattform zeichnet [Emoji] anders. … Sie lassen sich nicht einfärben. … Sie sind nicht bedeutungstragend für Screenreader."

Gebaut, dokumentiert — **nie eingebaut**. Die Leiste benutzte weiter 📷 🌱 🏠 🌿 ⋯. Dasselbe Muster wie beim Hero in v31.37: Arbeit, die fertig war und nie angeschlossen wurde.

Jetzt inline eingesetzt (nicht als `<img>`), damit die Symbole über `currentColor` mit dem Modus mitgehen und keine zusätzlichen Anfragen kosten.

#### Das Edelweiss

Dieselbe Geometrie wie `icons/icon.svg` — zwölf Blütenblätter in zwei Lagen, sieben goldene Röhrenblüten. Für 30 px mit flachen Farben statt Verläufen: bei der Grösse trägt ein Verlauf nichts und kostet nur Bytes.

#### Die Leiste kippt jetzt selbst

Sie war in **beiden** Modi dunkelgrün (`--fill-dark`). Genau deshalb brauchten die Beschriftungen in v31.27 feste Farbwerte — die Fläche kippte ja nicht mit. Jetzt `--card`/`--border`, also hell im Hell- und dunkel im Dunkelmodus, und die Beschriftungen können wieder `--muted` und `--g-dark` nutzen.

Drei Dunkelmodus-Überschreibungen wurden dadurch überflüssig. Eine davon hätte den Ring um den Mittelknopf im Dunkelmodus **hell**grün gemacht.

#### Ein Fallstrick auf dem Weg

`.tab.tab-center .tl` stand auf `color:#fff`. Auf der neuen hellen Leiste: weiss auf weiss. Exakt dieselbe Falle wie der Wetter-Trenner in v31.28 — was auf dunklem Grund richtig war, verschwindet auf hellem. Beim Schreiben bemerkt, nicht erst beim Messen.

#### Und wieder das Werkzeug

Der Vorher/Nachher-Vergleich meldete eine Grössenänderung an einem `svg`, das es vorher gar nicht gab. Ursache: Elemente **ohne** id, Klasse und Text teilten sich den Schlüssel `SVG|||`, und der Vergleich paarte zwei völlig verschiedene Elemente.

`render_check.js` baut den Schlüssel jetzt aus einem kurzen DOM-Pfad. Vergleichbare Elemente stiegen dadurch von 1'388 auf **1'792**, und der Selbstvergleich der Datei ergibt 0/0/0/0 bei 2'860 Elementen.

Achter Fall in dieser Serie, in dem die Messung selbst der Fehler war — und der erste, bei dem die Korrektur die Abdeckung *erhöht* hat.

---

### 2026-09-01 (x) — v31.37: Fernando hatte recht, und mein Prüfstand war blind dafür

> „Bei der Home-Seite sieht es nicht so schön aus da man kaum lesen kann was oben steht."

#### Er hatte recht — und ich hatte „0 Stellen unter AA" gemeldet

`contrast_check.js` überspringt Text auf Farbverläufen. Das stand sogar als bewusste Einschränkung im Kopf der Datei. Der Hero der Startseite **ist** ein Verlauf. Also war ausgerechnet der schlimmste Fall der ganzen App für mein Werkzeug unsichtbar:

| | gemessen | nötig |
|---|---|---|
| „Natur entdecken" | **1,32:1** | 3,0 |
| „Pilze · Nüsse · Hagebutten" | **1,11:1** | 4,5 |
| „Guten Morgen, …" | **1,93:1** | 4,5 |

#### Die Ursache: zwei Hälften eines Umbaus, die sich nie getroffen haben

```css
#screen-home .hero { background: var(--g-bg); color: var(--text); }   /* Zeile ~1599 */
#screen-home .hero #home-hero-title { color: var(--g-dark); }
#screen-home .hero #home-hero-sub   { color: var(--muted); }
```

Die **helle** Kopfzeile steht seit Längerem fertig im Code, samt Dunkelmodus-Variante. Sie wurde von einer `.hero`-Regel am Dateiende mit `!important` überstimmt (dunkelgrüner Verlauf, `color:#fff`). Die Kindregeln für Titel und Untertitel sind aber **ohne** `!important` — und damit wirksam. Ergebnis: dunkelgrüner und grauer Text auf dunklem Verlauf.

`class="hero"` kommt in der ganzen App **genau einmal** vor. Die Sperre betraf also nichts anderes; sie ist weg, zusammen mit drei weiteren `.hero`-Regeln, die nie gewirkt haben. Damit greift der vorhandene helle Entwurf — und der entspricht Fernandos Referenzbild.

#### Das Werkzeug repariert, nicht nur den Fall

`contrast_check.js` nimmt die Seite jetzt **zweimal** auf: einmal normal, einmal mit `color:transparent`. Unter jeder Textstelle wird der echte Pixel-Median gelesen. Verläufe, Bilder und halbtransparente Schichten sind damit automatisch richtig berücksichtigt.

Ein erster Anlauf **entfernte** den Text statt ihn durchsichtig zu machen — das liess das Layout umfliessen, die vorher gemessenen Koordinaten zeigten woanders hin, und der Prüfstand meldete „weiss auf weiss". Siebter Fall in dieser Serie, in dem die Messung selbst der Fehler war.

Zwei Falschmeldungs-Klassen habe ich zusätzlich beseitigt: Text **hinter** der fixierten Navigationsleiste (dort wird ein Hintergrund gemessen, den niemand sieht) und **deaktivierte** Bedienelemente, die WCAG 1.4.3 ausdrücklich ausnimmt.

#### Was der Prüfstand dann fand

**28 im Hell-, 12 im Dunkelmodus** — statt 0. Alle behoben:

- Zähler-Chips und Intro-Karten in Wissen/Rezepte/Heilmittel: 10-%-Tönungen über dunkler Leinwand mit Text für helle Flächen (1,05–1,59:1) → richtige Karten.
- Pillen im Wissens-Hero und Kennzahl-Kästen bei den Pflanzen: **weisse** Transparenz über Grün hellt den Untergrund auf und lässt weissen Text durchfallen → jetzt dunkle Transparenz.
- Zwei `rgba(255,255,255,.96)`-Flächen blieben im Dunkelmodus weiss → `var(--card)`.
- **41× `#2d8a2d`**: dieser Grünton scheitert in *beide* Richtungen mit 4,39:1. Das Token hatte ich in v31.32 gezogen, die fest verdrahteten Vorkommen nicht.

#### Eine gemeldete Grössenänderung, die diesmal echt war

Der Vergleich meldete `GROESSE geaendert: 5` an den Wissens-Chips. Dieselbe Signatur war vorher schon zweimal Rauschen — also habe ich **direkt nachgemessen** statt sie erneut abzutun. Diesmal war sie echt: 72×18 → 63×32.

Ursache war aber nicht meine Änderung, sondern der **dritte Chip**, der dazukommt, sobald die Arten-Datenbank geladen ist. Drei passen nicht nebeneinander, und ohne `flex-wrap` schrumpften sie und brachen *innerhalb* um — „🍂 / Herbst" auf zwei Zeilen. Trotzdem behoben, weil es hässlich ist.

---

### 2026-09-01 (w) — Backend nachgesehen: ein ungesicherter Schreibaufruf, und ein Widerspruch zu einer Meldung

> Kein Release. Der Sicherheits-Advisor stand seit dem Vormittag nicht mehr an.

#### Der Stand

**145 Meldungen, 0 ERROR.** Aufgeteilt:

| | Anzahl | Bewertung |
|---|---|---|
| `authenticated_security_definer_function_executable` | 120 WARN | so gebaut — das ist, wie RPCs funktionieren |
| `anon_security_definer_function_executable` | 16 WARN | einzeln durchgegangen, siehe unten |
| `extension_in_public` (pg_trgm, vector, citext) | 3 WARN | Supabase-Standard, Verschieben wäre störender als nützlich |
| `rls_enabled_no_policy` | 5 INFO | **kein Mangel** — RLS an ohne Policy heisst „alles verboten ausser service_role". Genau richtig für reine Server-Tabellen (`book_ocr_pages`, `species_import_queue`, `species_search_cache`, `system_events`, `weather_forecast_cache`) |
| `auth_leaked_password_protection` | 1 WARN | **Widerspruch, siehe unten** |

#### Der Fund

Von den 16 anon-ausführbaren Funktionen **schreiben zwei**. Beide angesehen:

- `fn_quiz_record_answer` — macht es richtig:
  `v_uid := (select auth.uid()); if v_uid is null then return; end if;`
- **`fn_mkt_increment_views` — hat keine Prüfung:**
  `UPDATE marketplace_listings SET views = COALESCE(views,0)+1 WHERE id = p_listing_id;`

Der Anon-Key ist öffentlich (by design, RLS schützt die Daten). Damit kann **jeder ohne Konto** die Aufrufzahl beliebiger Inserate hochzählen — in einer Schleife auch als kleine Schreiblast. Kein Datenabfluss, kein Datenverlust; eine irreführende Kennzahl und eine unnötig offene Schreibstelle.

Bricht nichts, wenn man sie schliesst: einziger Aufrufer ist `openListingDetail()`, erreichbar aus Marktplatz-Liste und Home-Widget — beide setzen eine Anmeldung voraus, seit der Gast-Modus in v25.33 abgeschaltet wurde.

`supabase/migrations/v31_36_mkt_views_auth_guard.sql` liegt bereit. **Nicht angewendet** — das ist die Produktionsdatenbank, und in diesem Repo ist es Konvention, dass Fernando Migrationen anwendet (dafür existiert `scripts/apply_pending_v30_87.sh`). Bei diesem Schweregrad wäre ein Alleingang unangemessen.

#### Der Widerspruch

Der Advisor meldet **`auth_leaked_password_protection: Disabled`** — Fernando hatte gemeldet, das erledigt zu haben („nummer 2 und 3 habe ich gemacht").

Zwei mögliche Erklärungen, und ich kann von hier aus keine davon ausschliessen:
1. Das Advisor-Ergebnis ist gecacht und noch nicht nachgezogen.
2. Die Einstellung hat nicht gegriffen oder wurde an anderer Stelle gesetzt.

Ich melde das, statt es stillschweigend als erledigt zu führen — einmal nachsehen unter Auth → Policies kostet nichts.

---

### 2026-09-01 (v) — Nachtrag zu v31.36: eine eigene Behauptung überprüft und halb widerlegt

> Kein Release, nur Doku. In der v31.36-Notiz steht: *„DEFAULT_RECIPES (297 KB), WEEKLY_SEASONAL_FACTS (148 KB) und GS_I18N_JS_STRINGS (83 KB) — die werden aber tatsächlich beim Start gebraucht."* Das hatte ich **nicht geprüft, sondern angenommen.**

#### Nachgemessen

| Block | roh / gzip | beim Start gebraucht? |
|---|---|---|
| `WEEKLY_SEASONAL_FACTS` | 148 / 37 KB | **ja** — `_dynF` ist mit 10 Einträgen gefüllt, die Startseite zeigt sichtbar eine Saison-Tatsache (`fact-text: 🌿 Rosmarin überwintern`) |
| `GS_I18N_JS_STRINGS` | 83 / 27 KB | **ja** — 1'450 Schlüssel, `gsCollectI18nStrings` läuft beim Start |
| `DEFAULT_RECIPES` | 297 / 70 KB | **nein** — `rezepteImDom: 0` beim Start; `renderRecipes` läuft erst beim Tab-Wechsel |

Meine Behauptung stimmte also für zwei von drei Blöcken. Für den grössten war sie falsch.

#### Und die Messung selbst war beim ersten Anlauf falsch

Mein erster Ansatz hat die Funktionen umhüllt (`window.gsGetWeekFacts = wrapper`) und gezählt, welche beim Start laufen. Ergebnis: `gsGetWeekFacts` wurde **nicht** aufgerufen — was bedeutet hätte, `WEEKLY_SEASONAL_FACTS` sei entbehrlich.

Das war ein **Falsch-Negativ**: die Umhüllung greift nur, wenn Aufrufer den globalen Namen zur Aufrufzeit auflösen. Erst der Blick auf die *Daten* (`_dynF` gefüllt, Fakt sichtbar im DOM) zeigte, dass die Funktion sehr wohl gelaufen war.

Sechstes Mal in dieser Serie, dass eine Messung selbst der Fehler war. Die Regel, die sich daraus ergibt: **die Wirkung messen, nicht den Aufruf.**

#### Entscheidung: `DEFAULT_RECIPES` bleibt inline

Naheliegend wäre, die 297 KB wie den Changelog auszulagern. Dagegen spricht:

- Verbraucher sind der Rezepte-Tab, der Heilmittel-Tab **und `openDetail`** — also das Öffnen eines Arten-Steckbriefs. Das ist eine **Kernhandlung**; die meisten Nutzer lösen sie früh aus. Die 70 KB Übertragung spart man dann nicht, man verschiebt sie nur.
- Bei `openDetail` steht bereits ein `typeof DEFAULT_RECIPES !== 'undefined'`-Schutz. Fehlten die Daten, verschwände das Rezept-Abzeichen **stillschweigend** — ein Feature-Verlust, den niemand meldet.
- Bleibt der Parse-Gewinn: nach der Erfahrung aus v31.36 (630 KB Daten ≈ 70ms) wären das rund **35ms**.

35ms gegen ein Risiko auf einem Kernpfad ist ein schlechtes Geschäft. Der Changelog war der richtige Kandidat, weil ihn fast niemand öffnet; die Rezepte sind es nicht.

---

### 2026-09-01 (u) — v31.36: 787 KB Changelog, die jeder bei jedem Start mitlud

> In (t) habe ich geschrieben, das Parsen der 5,7-MB-Datei sei „eine Eigenschaft der Architektur". Das stimmt — aber bevor ich es stehen lasse, wollte ich wissen, **woraus** die Datei besteht.

#### Die Zusammensetzung

| Block | Grösse | Anteil |
|---|---|---|
| **`GS_RELEASES`** | **787 KB** | **14 %** |
| `DEFAULT_RECIPES` | 297 KB | 5 % |
| `WEEKLY_SEASONAL_FACTS` | 148 KB | 3 % |
| `GS_I18N_JS_STRINGS` | 83 KB | 1 % |

Der grösste Einzelblock ist die **Versionshistorie**: 383 Einträge, geladen und geparst bei jedem Kaltstart. Beim Start braucht die App davon **einen** — `GS_RELEASES[0]` für den „Was ist neu"-Dialog. Die volle Liste sieht nur, wer den Changelog im Über-Modal öffnet.

(Die anderen drei werden tatsächlich beim Start gebraucht. Die bleiben.)

#### Die Aufteilung

Die neuesten **12** Einträge (32 KB) bleiben inline — damit funktioniert der Dialog und die jüngste Historie ohne Nachladen. Die **371 älteren** (753 KB) stehen in `data/releases.v1.js` und werden per `gsLoadReleaseArchive()` geholt, wenn der Changelog geöffnet wird. Dasselbe Vorgehen wie bei `data/plants.v1.js` seit v25.10 — ich erfinde keine Architektur, ich wende die vorhandene an.

`index.html`: **5,50 → 4,87 MB.**

#### Eine Entscheidung, die ich erst falsch getroffen hatte

Mein erster Schritt war, das Archiv in `SHELL_URLS` vor-cachen zu lassen — damit der Changelog offline vollständig ist. Beim Nachdenken fiel mir auf: **dann lädt jeder 778 KB für einen Bildschirm, den die meisten nie öffnen.** Damit wäre der halbe Gewinn wieder weg.

Zurückgenommen. Das Archiv fällt unter die Standard-Strategie des Service Workers (`networkFirst` + Laufzeit-Cache) und ist ab dem ersten Öffnen auch offline da. Wer offline ist und ihn noch nie geöffnet hat, sieht die zwölf vorhandenen Einträge **und einen Hinweis** — eine Kurzliste stillschweigend als vollständig auszugeben wäre die schlechtere Lösung.

#### Was das NICHT bringt

Die Parse-Zeit sank nur um rund **70ms**, obwohl 630 KB verschwunden sind. Grund: entfernt wurden **Daten**, und Datenliterale sind für die JavaScript-Maschine deutlich billiger als Code. Wer 630 KB entfernt und proportional weniger Parse-Zeit erwartet, rechnet falsch.

Der messbare Gewinn liegt woanders:

| (4× gedrosselt, zwei Doppelläufe) | vorher | nachher |
|---|---|---|
| DOMContentLoaded | 1'568 / 1'591ms | **1'424 / 1'445ms** |
| längste Blockade | 689 / 734ms | 608 / 658ms |
| Erstbesuch übertragen | — | **260 KB weniger** (gzip) |

#### Zwei Zahlen, die ich nicht durchgewunken habe

Der Vergleich meldete `GROESSE geaendert: 5` und `abgeschnittener Inhalt 17 → 5`. Bei einer reinen Daten-Auslagerung gehört da nichts hin.

- Die fünf Grössenänderungen betrafen zwei Chips im Wissens-Hero. **Direkt nachgemessen: in beiden Ständen 72×18 und 144×18 — identisch.** Nicht reproduzierbar, also Zeitrauschen zwischen zwei Browser-Sitzungen. Bestätigt durch einen Selbstvergleich der Datei: **0/0/0/0**.
- Die Clipping-Differenz liegt ausschliesslich in `IMG`-Einträgen (4–5px), deren Zustand vom Ladezeitpunkt abhängt; die fünf inhaltlichen Container sind in beiden Ständen identisch. Plausibel, weil die Seite jetzt schneller parst.

---

### 2026-09-01 (t) — v31.35: „smooth" endlich gemessen — eine Sekunde verschenkte Arbeit beim Start

> Fernando hat „es soll auch smooth und zuverlässig funktionieren" ausdrücklich gesagt. Ich hatte das nie gemessen. Das war die letzte offene Zusage.

#### Erst die guten Zahlen

Auf dem Desktop: erster Anstrich 244ms, DOMContentLoaded 405ms, ein Tab-Wechsel kostet 1,3 bis 13,4ms Hauptstrang-Arbeit — unter einem 60-Hz-Bild. Nichts zu tun.

**Unter Telefon-Drosselung sah es anders aus.** Bei 4× (Mittelklasse) blockierte eine einzelne Aufgabe 649ms, bei 6× über eine Sekunde. Solange kommt kein Fingertipp an.

Eine Zwischenmessung musste ich verwerfen: mein erster Tab-Wechsel-Test meldete für fast jeden Tab exakt 33ms. Das war die Wartezeit meiner zwei `requestAnimationFrame` auf einem 30-Hz-Renderer, nicht die Arbeit der App. Ohne diese Wartezeit gemessen: 1,3 bis 13,4ms.

#### Der Fund

Drei `MutationObserver` — Auto-ARIA, Auto-Maxlength, Auto-Lazy — beobachteten `document.body` mit `subtree:true` und riefen bei **jeder** Mutation:

```js
if (dirty) { try { labelize(document); } catch(_){} }
```

Also je ein `querySelectorAll` über alle 4'486 Knoten. Beim Start rendert die App dutzende Bausteine nacheinander — jeder löst alle drei aus. Im Profil: **743ms allein für `querySelectorAll`.**

#### Die Lösung

Die eingefügten Teilbäume sammeln und in **einem** Durchgang abarbeiten, wenn der Hauptstrang frei ist (`requestIdleCallback` mit Frist). Notbremse bei über 300 Wurzeln: dann ist ein Durchgang über das ganze Dokument billiger als tausend einzelne.

Dabei eine Falle, die ich beim Schreiben bemerkt habe: `querySelectorAll` findet nur **Nachkommen**. Solange über `document` gescannt wurde, war das egal. Sobald man gezielt die eingefügten Knoten scannt, kann die Wurzel selbst der Knopf sein — der wäre durchgerutscht. Alle drei Funktionen prüfen jetzt zusätzlich die Wurzel.

#### Zahlen (4×, gleiches Skript auf beiden Ständen)

| | vorher | nachher |
|---|---|---|
| **App-JavaScript** | **1'548ms** | **421ms** |
| Parsen/Kompilieren | 2'755ms | 2'633ms |
| DOMContentLoaded | 1'683ms | 1'470ms |
| längste Einzelblockade | 782ms | 710ms |

#### Was NICHT besser wurde — und warum ich das so sage

Die längste Blockade sank nur um 72ms. Sie besteht nämlich nicht aus App-Code, sondern aus dem **Parsen der 5,7-MB-Datei**. Die eingesparten 1'127ms verteilten sich auf viele Aufgaben unter 50ms, die nie als „lange Aufgabe" gezählt wurden — es ist trotzdem Arbeit, die das Telefon geleistet und mit Akku bezahlt hat.

Den Monolithen aufzuteilen wäre eine Architektur-Entscheidung. `CLAUDE.md` beschreibt ihn ausdrücklich als das gewählte Vorgehen; das ändere ich nicht nebenbei.

#### Die wichtigste Gegenprobe

Schneller ist wertlos, wenn dabei etwas ausfällt. Über alle elf Tabs gezählt, was die drei Beobachter tatsächlich gesetzt haben:

| | vorher | nachher |
|---|---|---|
| `aria-label` gesetzt | 199 | **199** |
| `maxlength` gesetzt | 65 | **65** |
| `loading` gesetzt | 7 | **7** |

Identisch. Gleiche Wirkung, ein Drittel der Arbeit.

`scripts/perf_check.js` liegt als viertes Werkzeug im Repo.

---

### 2026-09-01 (s) — v31.34: Bedienbarkeit — die kleinste Schaltfläche war 8×8 Pixel

> Die Optik-Serie ist abgeschlossen (Farben, Radien, Typografie, Lesbarkeit, toter Stil — alles gemessen). Also mit demselben Werkzeug etwas anderes prüfen: ob die App sich **bedienen** lässt.

#### Zuerst ein Nicht-Fund

Ich habe alle `onclick`-Ziele aufgelöst: **7'081 Stück, alle vorhanden.** Kein fehlender Handler. Die drei Treffer meiner Suche (`event.preventDefault`, `if`, `event.stopPropagation`) waren Artefakte meiner eigenen Erkennung, keine Fehler.

Das ist kein Ergebnis, das eine Version rechtfertigt — aber es zu wissen ist etwas wert, und es hier zu schreiben ehrlicher, als es wegzulassen.

#### Der Fund

43 Bedienelemente unter 24×24 CSS-px (WCAG 2.5.8, Stufe AA). Zwei Gruppen zählten wirklich:

**Die Karussell-Punkte unter den Tageskarten: 8×8px, 14px Abstand von Mitte zu Mitte.** Die WCAG-Ausnahme für kleinere Ziele greift nur, wenn ein 24px-Kreis um das Ziel kein anderes berührt — bei 14px Abstand also nicht. Der Knopf ist jetzt 24×24, der sichtbare Punkt sitzt als `::before` darin. **Die Optik bleibt ein 8px-Punkt, die Trefferfläche ist neunmal so gross.** Preis: die Punkte stehen jetzt 24 statt 14px auseinander und die Leiste ist 2px höher.

**Die Suchfelder: 18px hoch in einer 37px hohen Leiste.** Deren 9px Polsterung oben und unten gehörte nicht zum Eingabefeld — wer den Rand antippte, löste nichts aus. Das Feld reicht jetzt per `padding:9px 0` und ausgleichendem `margin:-9px 0` hinein: gleiche Höhe, doppelte Trefferfläche.

Dazu 42 Pflanzen-Chips in der Trachten-Übersicht, fünf Kategorie-Chips auf der Karte und ein Knopf im Garten.

#### Die eine Farbänderung

Der Vergleich meldete `Farbe geaendert: 1` — bei einer reinen Grössen-Änderung ein Grund nachzusehen. Es war der Punkt-Knopf selbst: seine Farbe ist ins `::before` gewandert, der Knopf ist jetzt transparent. Meine Erfassung misst keine Pseudo-Elemente, sieht also eine Änderung, wo optisch keine ist. Im Rendering bestätigt.

Das ist inzwischen Routine: **jede Zahl, die nicht null ist, wird angeschaut** — dreimal war es das Werkzeug, zweimal die Änderung.

#### Ergebnis

| | |
|---|---|
| Antippflächen unter 24×24 | **43 → 0** |
| Grössenänderungen | 77 (genau die vergrösserten Ziele) |
| Radius / Schrift geändert | 0 / 0 |
| Farbe geändert | 1 (nachgeprüft, siehe oben) |
| Kontrast unter AA | 0 in beiden Modi |

`scripts/touch_check.js` liegt als drittes Werkzeug im Repo, in `CLAUDE.md` §7.1 beschrieben — samt der Warnung, dass eine Meldung genauso gut eine Falschmeldung des Prüfstands sein kann. Das ist bisher dreimal vorgekommen.

---

### 2026-09-01 (r) — v31.33: 52 Stilregeln, die nie gewirkt haben

> Der Nebenfund aus (p) — `.recipe-card-desc` war zweimal deklariert — als eigene Runde.

#### Das Muster

22 Klassen sind zweimal beschrieben: die ursprüngliche Regel um Zeile 400–1500, eine zweite aus einem späteren Umbau um Zeile 81'000–82'700. Gleiche Spezifität, gleicher Selektor — **die spätere gewinnt immer**. Die frühere galt nie.

`.modal-close-btn` ist das deutlichste Beispiel: acht widersprechende Angaben, darunter `position: sticky` gegen `position: absolute`. Wer die obere Regel liest, liest etwas, das die App nicht tut.

52 tote Deklarationen entfernt, in 22 Regeln.

#### Vorsichtig abgegrenzt

Verglichen wurden nur Regeln mit **exakt einem Klassen-Selektor**, beide **ausserhalb** von `@media`/`@supports`/`@layer` und beide **ohne** `!important`. Nur unter diesen drei Bedingungen gilt zwingend, dass die spätere gewinnt und die frühere Deklaration folgenlos entfernt werden kann. Alles andere blieb unangetastet — auch da, wo es wahrscheinlich ebenfalls tot ist.

#### Der Prüfstand hat sich selbst korrigiert

Der Vergleich meldete `GROESSE geaendert: 1`. Bei einer beweisbaren Null-Änderung darf da nichts stehen, also nachgesehen — statt es als Rundungsrest durchzuwinken. Ein zweiter Lauf meldete **2**, und an einer anderen Stelle.

Beide Male `.gs-spin`: ein Ladekreisel, 14×14px, `animation: gs-spin 1s linear infinite`. Ich mass mit `getBoundingClientRect()`, und das liefert die **gedrehte Hülle** — ein rotierendes Quadrat ergibt darin je nach Winkel 14 bis 20px.

Der Fehler lag im Werkzeug, nicht in der Änderung. Jetzt `offsetWidth`/`offsetHeight`: die Layout-Box, unabhängig von Transformationen. Zwei aufeinanderfolgende Läufe sind seither identisch.

Das ist die dritte Runde in Folge, in der die entscheidende Arbeit darin bestand, dem eigenen Messwert nicht zu glauben.

#### Ergebnis

| | |
|---|---|
| stille Konflikte | **52 → 0** |
| vergleichbare Elemente | 1'520 |
| Radius / Schrift / **Grösse** / Farbe geändert | **0 / 0 / 0 / 0** |
| Kontrast unter AA | 0 in beiden Modi (unverändert) |

---

### 2026-09-01 (q) — v31.32: Meine eigene Farbarbeit kam seit v31.20 nie an

> Das Werkzeug aus (p) hat als Erstes etwas gefunden, das mich betrifft.

#### 270 + 21 Textstellen unter dem Mindestwert

`contrast_check.js` misst jede sichtbare Textstelle über neun Tabs in beiden Modi. Ergebnis beim ersten Lauf: **270 im Hellmodus, 21 im Dunkelmodus** unter AA.

Meine erste Lesart war falsch. Ich sah dunklen Text auf dunkelgrünen Bildschirmen und hielt das für die Ursache — das waren 11 Stellen. Die eigentliche Ursache war eine Zeile:

```js
root.setProperty('--muted', '#888888');   // in applyThemeColors()
```

`root` ist `documentElement.style` — ein **Inline-Stil**. Der schlägt jede `:root`-Regel im Stylesheet. Vier Token (`--text`, `--text2`, `--muted`, `--border`) wurden dort mit eigenen Werten überschrieben, `--muted` mit `#888888` = **3,54:1** auf Weiss. Darüber der Kommentar: *„Light text colors – always readable on light backgrounds"*.

**Jede Farbanpassung, die ich seit v31.20 an diesen Token gemacht habe, war wirkungslos.** Gerechnet, verifiziert, ausgeliefert — und zur Laufzeit überschrieben.

Warum nur der Hellmodus betroffen war, ist die interessante Hälfte: der Dunkelmodus definiert seine Token auf `body.dark`. Ein Wert auf `body` sticht den von `html` geerbten. Im Hellmodus gibt es keine solche Regel auf `body` — dort gewann der Inline-Wert von `html`. Der Fehler war also sichtbar, aber nur in der Hälfte, in der man ihn am wenigsten sucht.

#### Was noch herausfiel

- **Zwei Themen fallen durch:** die Hauptfarbe des Standard-Themas Grün war `#2d8a2d` = **4,39:1** auf Weiss, Orange `#e65100` = **3,79:1**. Beide dienen als Textfarbe *und* als Knopf-Hintergrund — der Wert gilt in beide Richtungen. Neu `#1f6b2f` (6,56:1) und `#bf360c` (5,60:1).
- **`body` hatte nie eine `color`.** Sie war damit in beiden Modi Schwarz (der Vorgabewert). Alles ohne eigene Farbe erbte Schwarz — im Dunkelmodus schwarz auf dunkel. Zwölf Stellen auf einen Schlag.
- **Vierzehn Bildschirme mit dunkler Leinwand.** Text direkt darauf nutzte `--text`/`--muted`. Neue Token `--on-canvas` / `--on-canvas-2`, gegen alle acht Leinwandfarben gerechnet.

#### Ein verworfener Versuch

Für die Leinwände wollte ich eine gemeinsame Regel: `#screen-garden, #screen-social, … { color: #fff }`. Elegant, strukturell, ein Griff statt zwölf.

**Gemessen wurde es davon schlechter — 22 auf 33 Stellen.** Die Regel erzeugte elf Weiss-auf-Weiss-Fälle in Karten und erreichte die gemeinten Elemente gar nicht, weil die eine eigene Farbe setzen. Zurückgenommen, gezielt gearbeitet.

Ohne den Prüfstand hätte ich diese Regel für eine Verbesserung gehalten und ausgeliefert. Das ist der eigentliche Ertrag von (o) und (p): nicht dass ich mehr finde, sondern dass ich meine eigenen Ideen widerlegen kann.

#### Ergebnis

| | vorher | nachher |
|---|---|---|
| Hellmodus unter AA | **270** | **0** |
| Dunkelmodus unter AA | **21** | **0** |

Gegenprobe am laufenden Programm: 1'522 vergleichbare Elemente, **1'002 Farbänderungen und 0 Änderungen an Radius, Schriftgrösse und Grösse** — genau das Profil, das eine reine Farbänderung haben muss.

#### Nachtrag zu v31.28

Die Wetterkachel im **Garten** blieb damals stehen; umgestellt hatte ich nur die auf der Startseite. Auf dem Garten-Bildschirm leuchtete danach als Einzige noch der blaue Verlauf. Angeglichen — eine Unstimmigkeit, die ich selbst hinterlassen hatte.

---

### 2026-09-01 (p) — v31.31: Typo-Skala, und was der neue Prüfstand sofort zutage fördert

#### Der Befund

4'739 Schriftgrössen in **53** Varianten. Darunter **1'387 Halbpixel-Werte** — 11.5px (510×), 12.5px (435×), 10.5px (235×), 13.5px (130×). Das entscheidet niemand; das bleibt beim Nachjustieren übrig. Und sieben Textgrössen (9, 10, 11, 12, 13, 14, 15) lagen innerhalb von 6px.

#### Die Skala — und warum ich sie diesmal anders geprüft habe

Sieben Stufen über den ganzen Bereich: 10 · 12 · 14 · 16 · 20 · 24 · 28/32. Über 34px bleibt alles stehen (Hero-Ziffern, Emoji-Grössen).

Bei den Radien in v31.29 galt: `GROESSE geaendert: 0` beweist Unbedenklichkeit. **Bei Schrift ist das unmöglich** — Text bestimmt die Grösse, 880 Elemente ändern sich zwangsläufig. Also brauchte es ein anderes Mass, und das habe ich vor der Änderung gebaut:

- **Überlauf**: abgeschnittener Inhalt 17 → 17, aus dem Bildschirm ragend 0 → 0. Die vorhandenen Überläufe wurden eher *kleiner*.
- **Ellipsis**: 83 einzeilige Texte geprüft. **6 kürzen neu** — Zutaten-Vorschauen in Rezeptkarten, wegen +0,5px. Das ist der Preis, und er steht hier.

Beim ersten Anlauf meldete die Überlauf-Prüfung **72** Elemente als „ragt aus dem Bildschirm". Alle 72 waren Chips in waagrecht scrollenden Leisten, die genau dort hingehören. Verworfen und die Prüfung verengt, bis 0 Falschalarme blieben. Ein Prüfstand, der Fehlalarme produziert, ist schlechter als keiner — man gewöhnt sich an rote Zahlen.

#### Was beim Nachsehen herausfiel

`.recipe-card-desc` war **zweimal** deklariert: einmal 12.5px / Zeilenhöhe 1.5 / Umbruch, einmal 11.5px / 1.4 / einzeilige Ellipsis. Gleiche Spezifität, also gewann die zweite — die erste war komplett tot. Zusammengeführt.

Eine Suche danach ergab: **53 solcher stillen Konflikte** (gleiche Klasse, gleiche Eigenschaft, zwei Werte, keine `!important`). Eigene Runde wert, hier nur notiert.

#### Der grosse Fund — für die nächste Version

Der neue `contrast_check.js` meldet **270 Textstellen unter AA im Hellmodus**. Die Wurzel ist nicht, was ich zuerst dachte (dunkle Bildschirm-Hintergründe, davon nur 11 Stellen), sondern eine einzige Zeile:

```js
root.setProperty('--muted', '#888888');   // Z. 46492, in applyThemeColors()
```

`applyThemeColors()` schreibt die Text-Token zur Laufzeit auf `documentElement` — und das schlägt **jede** `:root`-Regel im Stylesheet. `--muted` ist damit `#888888` (3,54:1 auf Weiss), nicht die sorgfältig geprüften `#6b6b6b`/`#5a5a5a`. Der Kommentar darüber behauptet *„Light text colors – always readable on light backgrounds"*.

**Meine gesamte Farbwelle ab v31.20 kam an dieser Stelle nie an.** Ich habe Token-Werte gerechnet, verifiziert und ausgeliefert, die zur Laufzeit überschrieben wurden. Kommt als v31.32.

---

### 2026-09-01 (o) — v31.30: Die Lücke schliessen, die ich in (n) selbst benannt habe

> In (n) stand: „das beruht auf nur **11 vergleichbaren Elementen** … das trage ich so vor, statt 11 Elemente als Beweis für 2'286 Stellen auszugeben." Ein benannter Mangel, den man stehen lässt, bleibt ein Mangel. Also behoben.

#### Warum es nicht ging — und ein eigener Denkfehler auf dem Weg

Ich war überzeugt, die fehlende Anmeldung sei schuld. Der Gast-Modus schien der vorgesehene Ausweg: `gsCheckOnboarding` prüft `gs_guest_mode` und soll das Onboarding überspringen. Gesetzt — und das Onboarding blieb.

Dann ein Widerspruch, der nicht sein durfte: `element.style.display` sagte `none`, `getComputedStyle` sagte `block`. Das geht nur mit einer `!important`-Regel. Mein Regel-Sucher meldete: **keine Regel gefunden.**

Der Sucher war kaputt. Er filterte mit

```js
if (r.cssRules) { /* Gruppenregel, absteigen */ }
else if (r.selectorText) { /* Style-Regel pruefen */ }
```

Seit CSS Nesting hat **jede** Style-Regel eine `cssRules`-Liste — leer, aber ein Objekt, also wahr. Der Sucher ist bei jeder Regel abgestiegen und hat nie eine angesehen. Dasselbe Muster wie der Schatten-Fehler in v31.20 und der Regex-Fehler beim Farb-Audit: **eine Prüfung, die immer wahr ist, sieht aus wie ein sauberes Ergebnis.** Was mich stutzig machte, war nicht der Code, sondern dass „0 Treffer" zu glatt war.

Nach der Korrektur stand die Antwort sofort da:

```
html.gs-preauth #gs-onboarding { display: block !important }
```

Der **Login-Flash-Guard** (v29.35). Ohne `gs_sb_token` versteckt er `#app` und zeigt das Onboarding — damit die Startseite nicht kurz aufblitzt. Der Prüfstand setzt jetzt einen Token. Nicht um sich anzumelden, sondern damit der Guard gar nicht erst greift.

**11 → 2'596 Elemente** über elf Tabs.

#### Der Fund daneben — und was er *nicht* ist

`gsCheckOnboarding` hatte eine Ausnahme: *„Gast kehrt zurück → Demo-Banner zeigen, kein Onboarding"*. Sie ruft `gsActivateGuestMode(false)` und kehrt zurück. Diese Funktion ist seit **v25.33** ein leerer Rumpf — dort wurde der Demo-Modus abgeschaltet.

Ich war auf dem Weg zu „Alt-Gäste sind ausgesperrt". **Nachgemessen: sind sie nicht.** Der Alt-Gast landet im exakt gleichen Zustand wie jeder Abgemeldete — Onboarding mit Registrieren und Anmelden. Der Zweig log nur im Kommentar. Toter Code, kein Ausfall; entfernt, Schlüssel entsorgt.

Der Beweis war wichtiger als der Fund: Ich hätte hier eine Ausfallgeschichte erzählen können, die sich gut liest und nicht stimmt.

#### v31.29 nachträglich belegt

| | Ergebnis |
|---|---|
| vergleichbare Elemente | **1'524** (statt 11) |
| Radius geändert | 316, grösste Bewegung **2px** |
| Schriftgrösse geändert | **0** |
| **Grösse** geändert (Layout) | **0** |
| Farbe geändert | **0** |

Genau das Profil, das eine reine Radius-Änderung haben muss. Die Entfernung des toten Zweigs ergab gegen den Vorstand **0 Unterschiede in allen vier Kategorien**.

Der Prüfstand liegt als `scripts/render_check.js` im Repo und ist in `CLAUDE.md` §7.1 beschrieben — samt der Faustregel, dass eine reine Farb- oder Radius-Änderung `GROESSE geaendert: 0` ergeben **muss**.

---

### 2026-09-01 (n) — v31.29: Die Radien-Skala — und ein Fehler, den ich selbst gebaut hatte

> Das letzte grosse Stück Uneinheitlichkeit, das ich in v31.22 bewusst aufgeschoben hatte, weil es „eine eigene, sauber verifizierte Runde braucht". Hier ist sie.

#### Der Befund

2'286 `border-radius`-Angaben in **55** Varianten — 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 … px, lückenlos. Das ist keine Gestaltung, das ist Rauschen: 461× 10px neben 178× 9px neben 98× 11px. Über 90 % stehen in JS-erzeugten Inline-Styles, nicht in CSS-Klassen — eine Skala musste also bis in die Strings reichen.

Es *gab* bereits drei Token (`--r:16px --r-sm:10px --r-xs:8px`), genutzt an 85 von 2'286 Stellen.

#### Die Skala

4px-Raster, sechs Stufen, jede an einen Zweck gebunden:

| Token | Wert | wofür |
|---|---|---|
| `--r-xs` | 4px | Marker, Fortschrittsbalken |
| `--r-sm` | 8px | Badges, Tags, kleine Knöpfe |
| `--r-md` | 12px | Knöpfe, Eingabefelder, Listenzeilen |
| `--r-lg` | 16px | Karten |
| `--r-xl` | 22px | Modale, Bottom-Sheets |
| `--r-pill` | 999px | Pillen |

Kreise bleiben `50%` — das erklärt sich selbst besser als jedes Token.

**Bewegung:** von 2'481 Einzelwerten blieben 790 exakt gleich, 1'398 rückten auf ihre Stufe, 293 blieben unberührt. Grösste Bewegung ±2px. Meine erste Zuordnung hätte 18px auf 22px geschoben — **+4px**, ein Bruch meines eigenen Versprechens. Grenze auf den Mittelwert gelegt, neu gerechnet. Es blieb genau **eine** Ausnahme: das Onboarding-Logo, 19px → 22px, bei 80×80px. Im Browser nachgemessen.

11 Werte (26/27/28px) habe ich stehen lassen. Sie liegen zu weit von jeder Stufe, um sie stillschweigend zu verschieben — das wäre eine Gestaltungsentscheidung, keine Aufräumarbeit.

#### Der eigentliche Fund — und er geht auf meine Kappe

Bevor ich `var(--r-*)` überall hineinschrieb, habe ich gefragt: *gibt es Stellen, an denen `:root` gar nicht gilt?* Es gibt sie. Zwei:

- **Garten-Plan-Export** — baut ein HTML-Dokument in einen Blob und öffnet es als Druckfenster.
- **Garten-Scan-Druck** — schreibt ein Dokument in ein verstecktes iframe.

Beide sind **eigenständige Dokumente**. Sie kennen das `:root` der App nicht. `var(--c-success)` löst dort zu nichts auf.

Und die Farb-Token stehen dort **seit v31.20** — der Farb-Welle, die ich selbst geschrieben habe. Seither druckte der Export schwarze Schrift auf transparenten Flächen. Niemand hat es gemeldet; ich hätte es mit den Radien ein zweites Mal eingebaut.

Beide Dokumente bekommen jetzt über `GS_DOC_TOKENS` ihre eigenen Werte — die **hellen**, weil Gedrucktes nicht dem App-Modus folgt.

#### Ehrlich zur Abdeckung

Ich wollte die Änderung an der laufenden App belegen: vorher/nachher laden, jedes Element mit Radius vermessen, prüfen ob eines die Form wechselt (Rechteck → Pille). Das Ergebnis ist gut — 38 → 19 tatsächlich gerenderte Radien-Varianten, keine JS-Fehler, **kein** Form-Wechsel —, aber es beruht auf nur **11 vergleichbaren Elementen**. Ohne Anmeldung und ohne Netz baut die App ihre Tabs nicht auf, und das Onboarding liess sich nicht dauerhaft wegschalten.

Das trage ich so vor, statt 11 Elemente als Beweis für 2'286 Stellen auszugeben. Was tatsächlich trägt: die Umsetzung ist rein textuell und mechanisch, die Zuordnung ist vollständig aufgelistet, und die beiden erzeugten Dokumente habe ich einzeln gerendert und jedes Token gegen `getComputedStyle` geprüft.

---

### 2026-09-01 (m) — v31.28: Die Wetterkarte — und was zwei Renderwege anrichten

> Letzter Punkt aus Bild 3 der zweiten Vorlagen-Reihe. Die Startseite besteht aus hellen Karten mit ruhigem Rahmen — mit einer Ausnahme: das Wetter-Widget lag als `linear-gradient(135deg,#0d47a1,#1565c0)` mit weisser Schrift dazwischen. Es hat jetzt dasselbe Material wie alles andere.

#### Der eigentliche Fund kam beim Nachsehen

Beim Umbau habe ich zuerst nur **einen** Trenner korrigiert: `rgba(255,255,255,.15)` — eine weisse Linie, die auf heller Karte verschwindet. Danach habe ich gesucht, wer sonst noch in `hw-forecast` schreibt. Es sind **zwei** Stellen:

| | `gsApplyWeatherToWidget()` | `loadHomeWeather()` |
|---|---|---|
| Auslöser | Cache-Treffer (30 min TTL) | Live-Abruf beim Start |
| Spalten | **3** | **4** |
| Textfarbe | geerbt (passt sich an) | **fest `#fff` / `rgba(255,255,255,.7)`** |
| Trenner | `<div>` dazwischen | `border-right` auf **jede** Spalte, auch die letzte |
| Wochentage | deutsches Array im Code | aus `gsI18n` |

Der Live-Weg ist der, der beim Start läuft. Hätte ich nur den Trenner korrigiert, wäre die Vorschau beim ersten Öffnen **weiss auf weiss** gewesen — und beim zweiten, aus dem Cache, korrekt. Ein Fehler, der sich beim Nachprüfen selbst wegcacht.

Nebenbei erklärt die Tabelle auch etwas, das nie jemand gemeldet hat: die Vorschau zeigte je nach Cache-Zustand **3 oder 4 Tage**.

#### Die Lösung ist eine Funktion, kein Pflaster

`_gsWxForecastHtml(items)` — beide Wege bauen ihre Liste und geben sie dorthin. Farben kommen aus Tokens, der Trenner aus `.gs-wx-day + .gs-wx-day{border-left}` (also nur *zwischen* den Spalten), die Wochentage aus `gsI18n`. Zwei Wege können jetzt nicht mehr auseinanderlaufen, weil es nur noch einen gibt.

#### Belegt, nicht angenommen

- **Kontrast gerechnet**, statt „sieht dunkel aus" zu urteilen: Tagesname 7,11:1 hell / 7,76:1 dunkel, Min-Temperatur 4,95:1 / 6,08:1. Die gedämpfte Wirkung im Bild ist gewollte Abstufung und liegt über AA — hier war **nichts** zu reparieren, und ich habe es dabei belassen.
- **Prüfstand lädt die echte Funktion** aus `index.html`, statt eine Kopie zu testen. Drei Zustände gerendert (hell, dunkel, hell mit Warnung), keine JS-Fehler.
- **Alle zehn JS-beschriebenen IDs** je genau einmal im Dokument.
- 9/9 Inline-Scripts `node --check` OK · Versionen an allen vier Punkten synchron.

---

### 2026-09-01 (l) — v31.27: Die untere Navigation — dasselbe Muster, andere Richtung

> Ich wollte den runden grünen Mittelknopf aus den Entwürfen bauen. **Den gibt es seit v26.86.** Drittes Mal in dieser Runde, dass Nachsehen vor Doppelarbeit bewahrt hat. Beim Hinsehen fiel dafür etwas anderes auf.

#### Der Fund

`.tabs` nutzt `--fill-dark` — die Leiste ist in **beiden** Modi dunkelgrün. Die Beschriftung nutzte aber `--muted` und `--g-main`, also Token, die für **helle** Flächen gedacht sind.

| | Hellmodus | Dunkelmodus |
|---|---|---|
| aktiver Reiter | **1,86:1** | 5,42:1 |
| übrige Reiter | **2,28:1** | 5,47:1 |

Die meistgenutzte Bedienleiste der App war im Hellmodus praktisch unlesbar.

Das ist dasselbe Muster wie in v31.26, nur andersherum: dort eine **Textfarbe als Fläche**, hier **Textfarben auf einer Fläche, die nicht mitkippt**. Beide Male, weil ein Token für zwei Zusammenhänge herhalten muss.

#### Was das über die Historie verrät

Für den Dunkelmodus gab es **vier** Überschreibungen derselben zwei Zustände — `rgba(255,255,255,.55)`, `#fff !important`, `#5a8a5a`, `var(--g-main)` — teils widersprüchlich, plus eine doppelte Basisregel. Vier Anläufe, dasselbe zu reparieren. Für den Hellmodus **keinen einzigen**, weil dort niemand damit rechnet, dass die Leiste dunkel ist.

Jetzt: feste Werte (`#9db89d` inaktiv, `#a5d6a7` aktiv), gegen **beide** Leisten-Hintergründe gerechnet (5,7 bis 8,8:1), und **eine** Regel je Zustand statt fünf. Die Fläche ist in beiden Modi dieselbe — also braucht sie auch nur eine Farbe.

#### Ehrlich zum Testgerüst

Mein Gerüst stellte die Reiter untereinander statt nebeneinander dar — ein Extraktionsfehler, den ich zweimal erfolglos zu beheben versucht habe. Die Änderung ist eine **Farbänderung**, und die ist numerisch belegt und im Rendering klar erkennbar; die Anordnung ist im echten Markup unverändert. Ich habe das Bild deshalb nicht als Beleg verschickt, statt es als „sieht gut aus" auszugeben.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast gegen beide Leisten-Hintergründe gerechnet (`#1a3d1a` hell, `#1a2e1a` dunkel) · Regelanzahl gegengezählt: genau **eine** `.tab`- und eine `.tab.active`-Farbregel verbleibend (vorher fünf) · Version synchron v31.27.

### 2026-09-01 (k) — v31.26: Dreimal ist ein Muster — 146 Flächen im Dunkelmodus

> In v31.20 (gefüllte Knöpfe), v31.22 (Marken-Glow) und v31.25 (Kopfleiste) war es dreimal derselbe Fehler. Beim dritten Mal habe ich aufgehört, Einzelfälle zu reparieren, und die Klasse gesucht.

#### Die Suche

Die Farb-Token der App kehren im Dunkelmodus ihre Helligkeit um — `--g-main` ist hell `#1f6b2f`, dunkel `#66bb6a`. **Für eine Textfarbe ist das genau richtig:** dunkle Schrift auf hellem Grund, helle Schrift auf dunklem Grund.

Für eine **Fläche** ist es genau falsch.

29 Token verhalten sich so. Davon werden **146** als Fläche benutzt, **124 davon mit weisser Schrift**:

| Token | Flächen | weisse Schrift auf dunkler Fassung | … auf heller Fassung |
|---|---|---|---|
| `--g-main` | 125 | 6,56:1 | **2,36:1** |
| `--g-dark` | 16 | 12,16:1 | **1,64:1** |
| `--c-purple` | 3 | 9,39:1 | **2,39:1** |
| `--c-warn-d` | 1 | **3,79:1** | **2,16:1** |

Jeder Hauptknopf, jeder aktive Chip, jeder aktive Reiter der App lag im Dunkelmodus bei **2,4:1**.

#### Die Lösung: zwei Rollen, zwei Token

`--fill-brand`, `--fill-dark`, `--fill-violet`, `--fill-warn` sind **Flächen** und bleiben im Dunkelmodus dunkel. `--g-main` und Co. bleiben **Schrift** und werden hell. Ein Token kann nicht beides sein — das war die ganze Ursache.

Die Hellwerte der neuen Token sind mit den alten **identisch** (`#1f6b2f`, `#1a3d1a`, `#6a1b9a`): der Hellmodus ändert sich um kein Pixel. Dieselbe Beweisführung wie in v31.20.

#### Zwei Nebenbefunde

- **`--c-warn-d` als Fläche schaffte auch im HELLmodus nur 3,79:1.** Ein Fehler in beiden Modi. `--fill-warn` ist deshalb bewusst dunkler (`#b34000`, 5,75:1) — der **einzige** Wert, der sich im Hellmodus ändert, und zwar zum Besseren.
- **Der Live-Punkt** hatte hellen Puls-Hintergrund mit `--c-info-d` als Text — im Dunkelmodus hell auf hell. Jetzt fest dunkler Text (7,4:1).

#### Und ein Fehler in meiner eigenen Analyse

Der erste Durchlauf meldete „0 von 125 mit weisser Schrift" — ich hätte daraus schliessen können, dass alles harmlos ist. Ursache: mein Suchfenster schloss das Semikolon aus, und `background:var(--g-main);color:#fff` hat genau dort eines. Aufgefallen ist es nur, weil „0 von 125" zu glatt klang und ich mir echte Fundstellen angesehen habe.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **146 Flächen umgestellt**, 0 verbleibend (die eine Ausnahme ist `.gs-btn-info` mit eigener `body.dark`-Regel) · Hellwerte der neuen Token gegen die alten geprüft: identisch, ausser dem bewusst korrigierten `--fill-warn` · Vorher/Nachher in Chromium gerendert · Version synchron v31.26.

### 2026-09-01 (j) — v31.25: Ruhige Kopfzone — und ein Fehler, den erst das Rendern zeigte

> Fortsetzung des Mix. Nach „Heute zu tun" die Kopfzone: beide Entwürfe beginnen oben **ruhig** — Creme, dunkler Text — und lassen das Grün als **Karte** auftreten statt als breites Band.

#### Umgesetzt

Kleine Gruss-Zeile mit Blatt-Symbol („🍃 Guten Morgen, Fernando"), darunter „Dein Garten" in Serifen, darunter die kontextuelle Zeile. Die Überschrift benennt den Ort, der Gruss meint den Nutzer — genau die Aufteilung aus Bild 2.

Bewusst **nur** für `#screen-home`: `.hero` wird von mehreren Bildschirmen benutzt, ein globaler Eingriff wäre nicht prüfbar gewesen.

**Keine zweite Glocke.** Die Entwürfe zeigen eine neben dem Gruss — die gibt es in der Kopfleiste bereits (`#gs-bell-btn`). Eine zweite hätte genau die Doppelung erzeugt, die eine App zusammengesetzt wirken lässt.

#### 🐛 Der Fund: die Kopfleiste war im Dunkelmodus unlesbar

```css
body.dark .topbar { background: var(--g-dark) !important; }
.topbar h1 { color:#fff; }
.topbar button, .topbar .ib { color:#ffffff !important; }
```

`--g-dark` ist im Hellmodus `#1a3d1a` (dunkel) — im **Dunkelmodus** aber `#a5d6a7` (**hell**grün), weil sich die Helligkeitsskala dort umkehrt. Das ist für einen Textton richtig und für eine Fläche falsch. Titel und alle Knöpfe sind fest weiss.

Ergebnis: **1,64:1**. Der Name der App und sämtliche Knöpfe der Kopfleiste waren im Dunkelmodus praktisch unsichtbar. Jetzt `#122212` → **16,6:1**.

Dasselbe Muster wie in v31.20 bei den gefüllten Knöpfen: **eine Textfarbe als Fläche benutzt.** Beim dritten Auftreten ist das kein Zufall mehr, sondern der Preis dafür, dass Fläche und Schrift dieselbe Skala teilen.

#### Ein Fehler im Testgerüst, der beinahe als App-Fehler durchgegangen wäre

Der erste Durchlauf zeigte den Hero weiterhin dunkelgrün. Ursache: meine neue Regel hängt an `#screen-home`, und mein Gerüst hatte diesen Rahmen nicht. Ich hätte das leicht für einen Fehler in der Regel halten und daran herumbauen können. Gerüst korrigiert, danach stimmte es.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast der Kopfleiste vorher/nachher gerechnet (1,64:1 → 16,6:1) · Startseite in Chromium gerendert, hell und dunkel, mit korrektem `#screen-home`-Rahmen · keine zweite Glocke, Bestand geprüft · Version synchron v31.25.

### 2026-09-01 (i) — v31.24: „Ein hochwertiger Mix aus diesen zwei Looks"

> Fernando schickte vier weitere Bilder: zwei Marketing-Register (ruhig, Serifen, Creme) und zwei App-Register (Aufgabenliste mit Kästchen). Auftrag: hochwertig, elegant — und **sehr simpel**.

#### Was beide Register gemeinsam haben

Warme Creme-Fläche. Tiefes Waldgrün. Serifen-Überschrift. Und — in **beiden** App-Bildern identisch — **„Heute zu tun"** als *eine* Karte mit getrennten Zeilen und einem **Kästchen** rechts. Keine Prioritäts-Plaketten. Keine zweite Hervorhebung darunter.

#### Weniger als vorher, und das ist der Punkt

Die Fassung aus v31.16 hatte Prioritäts-Plaketten (Hoch/Mittel/Niedrig) und eine separate „Nächster Schritt"-Karte. Beides ist jetzt **weg**. Die Entwürfe zeigen es nicht, und „sehr simpel" heisst weglassen, bis nur noch das übrig ist, was man antippt: eine Zeile sagt, was ansteht, ein Kästchen erledigt es. Die Dringlichkeit steht als graue Zeile darunter, nicht als bunte Plakette.

Das war der unangenehmere Teil — ich hatte in v31.16 selbst begründet, warum der hervorgehobene nächste Schritt der Haken sei. Der Entwurf ist die neuere Information.

#### Die Palette

| | vorher | jetzt |
|---|---|---|
| `--g-bg` | `#eef7ee` (grünstichig) | `#f4f1ea` (warmes Creme) |
| `--surface2` | `#f4faf4` | `#f7f4ee` |
| `--border` | `#c8e0c8` (grün) | `#e3ded3` (warm-neutral) |
| `--g-main` | `#2d8a2d` | `#1f6b2f` |

Beim Nachrechnen kam heraus: **`--g-main` lag als Text schon vorher bei 4,0:1** — unter der Lesbarkeitsschwelle, und zwar auf der alten Fläche genauso. Das ist also kein Nebeneffekt der Creme, sondern ein Fund. Der neue Wert schafft **5,8:1** als Text auf Creme *und* **6,6:1** mit weisser Schrift darauf — er kann beides, weil er tiefer ist, und das ist genau die Farbe aus den Bildern.

#### Abhaken, das sich richtig anfühlt

Kästchen füllt sich (120 ms), Zeile klappt zu (180 ms), dann läuft `gsNcDoneTask → gsQuickDone`. Weiterhin **eine** Erledigt-Logik inklusive Cloud-Sync, Tagebuch, Achievements. Ein Doppel-Tipp-Schutz verhindert zwei Erledigungen. Bei „Bewegung reduzieren" entfällt der Übergang — die Reihenfolge bleibt dieselbe, das Ergebnis auch.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast der neuen Palette durchgerechnet (Text 16,7:1 · gedämpft 6,1:1 · Grün 5,8:1) · vier Zustände in Chromium gerendert (Aufgaben, alles erledigt, dunkel, keine Pflanze), keine JS-Fehler · Reste der alten Fassung gegengezählt: 0 · Version synchron v31.24.

### 2026-09-01 (h) — v31.23: Bewegung — und ein Fix, den ich fast doppelt gebaut hätte

> Dritte Ebene nach Farbe und Fläche. 192 Übergänge in 85 Varianten, dazu neun einzelne `prefers-reduced-motion`-Blöcke, die je nur ihre eigenen Bauteile abdecken.

#### Was ich bauen wollte — und was es schon gab

Mein Plan war eine **globale** reduced-motion-Regel. Beim Nachsehen fand ich sie: seit **v24.43**, Zeile 1709, exakt in der Form, die ich schreiben wollte (`*, *::before, *::after { animation-duration:.01ms !important; … }`). Die neun lokalen Blöcke sind Zusatz, nicht Ersatz — die Grundabdeckung steht.

Das ist in dieser Sitzung das zweite Mal, dass Messen vor Bauen mich vor erfundener Arbeit bewahrt hat (das erste Mal: kein einziger Fremdschlüssel ohne Index).

#### Die echte Lücke

**13× `scrollIntoView({behavior:'smooth'})`.** Der JS-Parameter hat laut Spezifikation **Vorrang** vor `scroll-behavior` aus CSS — die globale Regel greift dort also nicht. Wer im Betriebssystem „Bewegung reduzieren" gewählt hat, bekam diese Bildläufe trotzdem gleitend. Für Menschen mit vestibulären Beschwerden ist ein unerwartet gleitender Bildlauf ein echtes Problem, kein Schönheitsfehler.

Neuer Helfer `gsScrollBehavior()` fragt `matchMedia` ab und liefert `'auto'` statt `'smooth'`. Alle 13 Stellen umgestellt, inklusive der zwei, die in Zeichenketten für `onclick` stehen.

Ebenfalls geprüft: Konfetti und der Widget-Stapel fragen die Einstellung **bereits** ab. Auch dort nichts zu tun.

#### Drei Geschwindigkeiten

`--dur-fast` (.12s) · `--dur` (.18s) · `--dur-slow` (.3s). **190 von 194** Übergängen umgestellt (245 einzelne Dauer-Angaben, weil ein `transition` mehrere Eigenschaften mit eigenen Dauern haben kann). Die vier Ausnahmen: zweimal `none` und die beiden `.01ms` aus dem reduced-motion-Block — die dürfen nicht angefasst werden.

**Animationen bewusst nicht angefasst:** 76 Stück mit 60 Keyframes, darunter Ladeanzeigen, Splash-Sequenz und Puls-Effekte. Deren Dauern sind gestalterische Entscheidungen, keine Systemwerte.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `transition` mit Token **190/194** · alle 13 Scroll-Aufrufe umgestellt, 0 verbleibende `behavior:'smooth'` · die `.01ms`-Werte des reduced-motion-Blocks nachweislich unberührt · Version synchron v31.23.

### 2026-09-01 (g) — v31.22: Oberflächen aus einem Guss — Tiefe und Glas

> „So futuristisch wie in den Bildern." Nach den Farben die zweite Ebene: was eine Oberfläche modern wirken lässt, sind nicht einzelne Effekte, sondern dass alle Flächen **derselben** Sprache folgen.

#### Die Messung

| | Angaben | verschiedene Werte |
|---|---|---|
| `border-radius` | 2 287 | **58** |
| `box-shadow` | 237 | **133** |
| `transition` | 192 | **85** |
| `backdrop-filter` | 90 | **10** |

133 verschiedene Schatten sind keine Gestaltung, das ist Rauschen. Genau daher kommt der Eindruck „zusammengesetzt" statt „aus einem Guss".

#### Was ich angefasst habe — und was nicht

**Schatten und Glas.** Beides ist begrenzt (rund 330 Stellen), hat hohe optische Wirkung und lässt sich prüfen.

**Die 2 287 Radien nicht.** Ein Umbau von 58 auf 6 Stufen wäre ein Eingriff ins Layout jeder einzelnen Fläche, mit einer Streubreite, die ich nicht seriös verifizieren kann. Das ist ein eigenes Vorhaben, kein Nebensatz.

#### Vier Höhenstufen, drei Unschärfen

`--elev-1` Listenzeile · `--elev-2` Karte · `--elev-3` hervorgehoben · `--elev-4` Dialog, dazu `--elev-brand` für die Hauptaktion. Im Dunkelmodus **eigene Werte**: ein Schatten mit 7 % Deckkraft ist auf dunklem Grund schlicht unsichtbar, dort braucht Tiefe 40–65 %. Der Marken-Glow wird dunkel neutral, weil Grün auf Grün keine Kante zeichnet.

Glas: `blur(3–14px)` auf `--blur-sm/md/lg` (4/8/12) abgebildet. Die beiden häufigsten Werte (`blur(8px)` 27×, `blur(4px)` 13×) bleiben dabei **unverändert**.

#### Bewusst nicht umgestellt

- **13 mehrschichtige Schatten** — das sind Puls-Animationen, keine Höhen
- **Fokus-Ringe** (`0 0 0 3px`) — dieselbe CSS-Eigenschaft, völlig andere Aufgabe
- **4 Inset-Schatten** — Vertiefung statt Erhebung

#### Ein eigener Fehler, der die Arbeit fast wertlos gemacht hätte

Der erste Lauf ersetzte **3 von 132** Schatten. Mein Schutz gegen mehrschichtige Werte prüfte auf ein Komma — und **jedes `rgba(0,0,0,.07)` enthält Kommas**. Der Filter hat praktisch alles abgelehnt. Aufgefallen ist es nur, weil ich die Trefferzahl ausgegeben und mit der Erwartung verglichen habe. Jetzt werden Klammer-Ausdrücke zuerst entfernt, dann auf echte Schicht-Kommas geprüft.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **74/74** `backdrop-filter` auf Token · `box-shadow` mit Token **73 → 195 von 238**; die 43 verbleibenden sind genau die drei ausgenommenen Klassen · Höhenstufen und Glas in Chromium gerendert, hell und dunkel · Version synchron v31.22.

### 2026-09-01 (f) — v31.21: Farbsystem, zweite Welle — und ein Abschnitt, der nachts unsichtbar war

> Fortsetzung von v31.20. Nach der ersten Welle blieben 225 helle Hintergründe ohne Token-Zwilling. Die brauchten **neue** Token — und die Frage, ob man Töne zusammenlegen darf.

#### Die Messung, die den Plan geändert hat

Mein erster Plan war, ähnliche Töne auf vorhandene Token zusammenzulegen. Vor dem Umbau habe ich den **Farbabstand (CIE76)** ausgerechnet:

| Zusammenlegung | ΔE | Urteil |
|---|---|---|
| `#f0f7ee` → `--surface2` | **1,98** | unter der Wahrnehmungsschwelle |
| `#f1f8e9` → `--surface2` | 4,73 | sichtbar |
| `#ede7f6` → `#e8eaf6` | 3,24 | sichtbar |
| `#311b92` → `#283593` | 18,55 | deutlich |
| `#880e4f` → `#c2185b` | 22,50 | deutlich |

Nur **eine** Zusammenlegung ist unsichtbar. Alles andere hätte das **helle** Design verändert — und das hat niemand bestellt. Ich wäre unter der Überschrift „Dunkelmodus-Fix" dabei gewesen, Fernandos Farben umzugestalten.

Also: **jeder Ton bekommt einen eigenen Token mit exakt seinem Hellwert.** 11 neue Token, jeder Dunkel-Wert gegen den eigenen Tint *und* gegen die Karte durchgerechnet.

#### Der Fund beim Rendern

Die neutralen Panel-Flächen (`#f9fafb`, 23×, u.a. die Abschnitte im Diagnose- und Detail-Dialog) blieben im Dunkelmodus **weiss** — mit hellem Text darauf. Im Vorher-Bild ist die Zeile „Diagnose-Abschnitt" praktisch nicht zu lesen. Interessant: für die Schwester-Klasse `.di` gab es längst ein manuelles `body.dark`-Override, für `.dsec` nicht. Genau die Art Lücke, die entsteht, wenn man Ausnahmen pflegt statt ein System.

#### Was ich bewusst NICHT angefasst habe

**`#fff` als Hintergrund, 25 Stellen.** Ich wollte sie auf `--card` mappen — und habe vorher die Kontexte angesehen. Darunter sind:

- **weisse Knöpfe auf farbigen Bannern** (Abo-Hinweis, Notruf 145, Update-Banner, Wiederherstellen) — in Dunkel würde daraus ein dunkler Knopf mit dunklem Text
- ein **SVG für den PDF-Export** (`background:#fff;border:1px solid #333`) — muss weiss bleiben
- die **Raster-Linien des Scanners** (1 px weisse Linien über dem Kamerabild)

Ein pauschales Ersetzen hätte alle drei kaputtgemacht. Das braucht Einzelfall-Prüfung, keine Tabelle — eigene Aufgabe.

#### Bilanz

| | hartkodierte helle Hintergründe |
|---|---|
| Ausgangslage | 474 |
| nach Welle 1 (v31.20) | 225 |
| nach Welle 2 | **111** |

Davon 25× `#fff` (bewusst offen) und ein langer Schwanz aus Einzelfällen (`#e0f7fa` 7×, `#e1f5fe` 6×, `#fffde7` 6×, `#f5f5f5` 6× …).

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **11/11 neue Token lösen im Hellmodus exakt auf den ersetzten Wert auf** · alle **18** vorkommenden Tint+Text-Kombinationen ≥ 4,5:1 (Welle 1 und 2 zusammen) · Vorher/Nachher in Chromium gerendert · Kontexte aller sieben Töne vor dem Ersetzen stichprobenartig geprüft (Panels, Icon-Flächen, Tags — keine Knöpfe auf farbigen Bannern) · Version synchron v31.21.

*Nebenbei: mein erstes Testgerüst zeigte „nachher" identisch zu „vorher" — ein überzähliges `}` im generierten CSS hatte die Regeln zerschossen. Nicht die App, das Gerüst. Ohne die Sichtprüfung wäre mir das nicht aufgefallen, und ich hätte den Fehler beim nächsten Vergleich wiederholt.*

### 2026-09-01 (e) — Backend durchgemessen: gesund, mit einer lohnenden Aufräumung

> Fernando wollte „Peakfein" auch im Backend. Also zum ersten Mal die **Leistungs-Advisors** ausgewertet — und nicht bei der Zusammenfassung stehengeblieben.

#### Der Befund ist gut, und das ist die eigentliche Nachricht

| Prüfung | Ergebnis |
|---|---|
| Leistungs-Advisors | **0 ERROR, 0 WARN**, 146 INFO |
| Sicherheits-Advisors | 0 ERROR |
| Fremdschlüssel ohne führenden Index | **0** |
| Tabellen mit auffälligen Seq-Scans | 3, alle klein (2 164 / 2 838 / 8 182 Zeilen) |

Bei kleinen Tabellen wählt Postgres bewusst den vollen Scan — das ist kein Fehler. Ich hätte hier Arbeit erfinden können; es gibt keine.

#### Die eine echte Aufräumung — und warum ich sie anders begründe als der Advisor

Der Advisor meldet **145 „unused_index"**. Danach zu löschen wäre falsch: ein Index kann ungenutzt sein, weil das Feature selten benutzt wird, nicht weil er überflüssig ist. Wer so aufräumt, nimmt der App irgendwann genau den Index weg, den sie beim Wachsen braucht.

Deshalb ein hartes Kriterium statt einer Statistik: **ein Index ist überflüssig, wenn seine Spalten ein echtes Präfix eines anderen Index derselben Tabelle sind.** Dann kann Postgres den breiteren für jede Abfrage nutzen, die der schmalere bedienen würde — der schmalere trägt nichts bei und wird trotzdem bei jedem Schreibvorgang mitgepflegt.

Das ergibt **38** Indizes, nicht 145.

#### Drei Fehler, die die Prüfung selbst fast gemacht hätte

1. **Textvergleich statt Array.** `pg_index.indkey` ist `"1 2"`. Mit `LIKE '1%'` wäre `"12 3"` ein Treffer gewesen — Spalte 12 als Präfix von Spalte 1. Jetzt `int[]`-Vergleich.
2. **Zugriffstyp ignoriert.** Der erste Lauf meldete `species_name_trgm` (GIN, Trigramm) als „enthalten in" `species_elevation_idx` (B-Tree). Zwei völlig verschiedene Indexarten. Jetzt Abgleich über `amname`.
3. **Partielle Indizes.** `idx_notifications_user_id` schien durch `idx_notifications_dedup` gedeckt — das ist aber ein **partieller** Index und deckt nur einen Teil der Zeilen. Drei Kandidaten sind genau daran gescheitert und stehen deshalb **nicht** in der Migration.

Alle drei wären als saubere Liste durchgegangen, wenn ich das erste Ergebnis genommen hätte.

#### Ehrliche Einordnung des Nutzens

Plattenplatz: **504 kB**. Das ist nichts. Der Gewinn liegt im Schreibpfad — `notifications`, `push_send_log`, `user_scans`, `garden_diary` und `sensor_readings` pflegen bei jedem Schreibvorgang einen Index, den keine Abfrage braucht. Spürbar, nicht dramatisch. Wer mehr verspricht, übertreibt.

Die Migration `20260901_redundante_indizes.sql` liegt bereit, ist **nicht** Teil der Pflichtschritte im Runbook (reine Hygiene, jederzeit nachholbar) und jederzeit umkehrbar — die `CREATE`-Zeilen stehen auskommentiert darin. Nachkontroll-Abfrage ebenfalls enthalten; erwartet werden danach 0 Zeilen.

- **Verify:** alle 38 Indexnamen gegen die Live-DB geprüft — **38 existieren, 0 fehlen, 0 sind unique, 0 sind partiell** · Deckungs-Index je Zeile in der Migration dokumentiert · `bash -n` auf dem Runbook OK · nur lesende Abfragen, keine DDL ausgeführt · **kein Versions-Bump**, weil sich an der App nichts ändert.

### 2026-09-01 (d) — v31.20: Der Dunkelmodus leuchtete an 523 Stellen

> Fernandos Auftrag: mehr Selbstinitiative, „Peakfein" in Front- und Backend, so futuristisch wie die Entwürfe. Statt weiter Bildschirm für Bildschirm zu gehen, habe ich zuerst **gemessen**, wo die App vom Anspruch entfernt ist. Das Ergebnis war eindeutig genug, um es zur eigenen Aufgabe zu machen.

#### Die Messung

474 hartkodierte helle Hintergründe in Inline-Styles. Spitzenreiter: `#e8f5e9` (76×), `#fff3e0` (50×), `#fff8e1` (41×), `#ffebee` (39×), `#e3f2fd` (32×).

Und dann der eigentliche Befund: **die App hat längst ein Farbsystem für genau diese Töne** — `--bg-success-soft`, `--bg-warn-soft`, `--bg-danger-soft`, `--bg-info-soft` … **mit korrekten Dunkel-Varianten** (`rgba(102,187,106,.12)` statt `#e8f5e9`). 523 Stellen umgehen ein fertiges, gut gebautes System und schreiben den Hellwert nochmal hin. Deshalb leuchtet der Dunkelmodus.

#### Warum ein blosses Suchen-und-Ersetzen falsch gewesen wäre

Ich habe vor dem Umbau den Kontrast im Dunkelmodus nachgerechnet — und drei Paare fielen durch:

| Kombination | vorher | Befund |
|---|---|---|
| `--bg-info-soft` + `--c-info-d` | **2,2:1** | praktisch unlesbar |
| `--bg-danger-soft` + `--c-danger-d` | **2,5:1** | praktisch unlesbar |
| `--bg-yellow-soft` + `--c-brown` | 3,5:1 | zu wenig |

Der Grund: die Hintergründe werden im Dunkelmodus **durchscheinend dunkel**, während die zugehörigen Textfarben **dunkel blieben**. Ein reines Umstellen hätte das Leuchten behoben und dafür unlesbaren Text erzeugt — der Fehler wäre nur umgezogen.

Also zuerst **sechs Dunkel-Werte repariert** (`--c-success-d`, `--c-danger-d`, `--c-info-d`, `--c-danger`, `--c-success`, `--c-brown`), jeder aus einer Kandidatenliste mit ausgerechnetem Kontrast gewählt — und zwar gegen **beide** Untergründe, die getönte Fläche *und* die Karte.

#### Füllung ist nicht Textfarbe

Beim Aufhellen fiel auf: vier gefüllte Knöpfe benutzen eine **Textfarbe** als Hintergrund (`background:var(--c-info-d); color:#fff`). Wird die im Dunkelmodus hell — und das muss sie, sonst 2,2:1 —, ist weisse Schrift darauf unlesbar. Zwei Dinge, die man nicht in einen Token pressen kann. Jetzt eigene Klassen `.gs-btn-info` / `.gs-btn-ok` mit eigener `body.dark`-Regel.

#### Ergebnis

- **523 Ersetzungen** (249 Hintergründe, 274 Textfarben)
- helle hartkodierte Hintergründe: **474 → 225**
- schlechtester Kontrast im Dunkelmodus: **2,2:1 → 4,8:1**; alle **12 tatsächlich vorkommenden** Kombinationen ≥ 4,5:1
- **Hellmodus pixelgleich** — nachgewiesen, nicht behauptet: alle 18 Token lösen exakt auf den ersetzten Hexwert auf, 0 Abweichungen

#### Was bewusst offen bleibt

225 helle Hintergründe **ohne** Token-Zwilling (`#f0f7ee` 25×, `#f9fafb` 23×, `#ede7f6` 18×, `#e8eaf6` 17×, `#fce4ec` 10×, `#efebe9` 8×) und die Farbverläufe (`linear-gradient(135deg,#e3f2fd,#bbdefb)` mit Textfarben ausserhalb des Systems). Die brauchen **neue** Token — das ist Welle 2 und kein Anhängsel dieses Commits.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Hellmodus-Identität programmatisch bewiesen (18/18 Token exakt) · Kontrast aller 12 realen Kombinationen ausgerechnet, 0 unter 4,5:1 · **Vorher/Nachher in Chromium gerendert** (drei Spalten: hell unverändert, dunkel vorher, dunkel nachher) · Token-Definitionen und Release-Historie waren beim Ersetzen ausgeschlossene Schutzzonen · Version synchron v31.20.

### 2026-09-01 (c) — v31.19: Foto-zu-3D zeigt seine Stufen — letzter Entwurfs-Schritt

> Bilder 4, 5 und 7: „Garten wird erkannt" → „3D-Modell wird erstellt · 65 %" → „3D-Modell erstellt". Wie angekündigt zuerst nachgesehen, was es gibt.

#### Was ich vorgefunden habe

Den ganzen Ablauf. Der **Baum-Planer** hat seit v30.02 „Aus Fotos einen 3D-Plan": bis zu vier Bilder → `callVisionAI` → `TP.scene` mit erkannten Objekten, Himmelsrichtung, Hangneigung → 3D-Vorschau. Die Bilder zeigen also nichts Neues, sondern **etwas Vorhandenes ohne Rückmeldung**.

Denn während des gesamten Vision-Aufrufs über bis zu vier Fotos stand dort **eine** Zeile: „⏳ KI analysiert deine Gartenfotos…". Sekundenlang, ohne Hinweis, ob noch etwas passiert.

#### Was ich gebaut habe — und was bewusst nicht

Vier Stufen mit Zeitachse: *Fotos werden gelesen · Grundstück wird geschätzt · Beete, Bäume und Zonen werden zugeordnet · 3D-Modell wird aufgebaut*. Alle 600 ms neu gezeichnet, gestoppt in **jedem** Ausgang der Analyse — Erfolg wie Fehler.

**Nicht** gebaut habe ich den Prozentwert aus dem Entwurf als Fortschrittsmeldung. Ein Vision-Aufruf liefert keinen Fortschritt; eine Zahl, die so tut, wäre erfunden. Der Balken ist deshalb ausdrücklich eine **Zeit-Schätzung**, hält bei **90 %** und springt erst auf fertig, wenn die Antwort wirklich da ist — mit genau diesem Satz darunter: „Der Balken schätzt die Dauer — fertig ist es, wenn das Ergebnis da ist."

Das ist dieselbe Linie wie bei den Pflegezonen in v31.17 und den Diagnose-Prozenten in v31.18: die Form aus den Entwürfen übernehmen, aber nichts behaupten, was die App nicht weiss.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**: Stufe 1, Stufe 3 und Stufe 4, hell und dunkel, keine JS-Fehler. Für die gezielten Stufen musste die Uhr im Testgerüst manipuliert werden — der erste Versuch war falsch (`t0` wurde nach der Manipulation gesetzt, alle Stufen zeigten 0 %), das fiel im gerenderten Text auf und wurde korrigiert · `prog.stop()` liegt vor allen frühen Rücksprüngen · Version synchron v31.19.

#### Damit sind die Entwürfe umgesetzt

| Bild | Umgesetzt in |
|---|---|
| 1 — Startseite mit Tagesplan | v31.16 |
| 6 — Mein Garten mit Kacheln | v31.17 |
| 3 — Scan-Ergebnis mit Ursachen + Lina | v31.18 |
| 4/5/7 — Foto zu 3D-Modell | v31.19 |

Die Bilder 2 und 8–16 sind Pitch-Deck (Markt, Go-to-Market, Handel, Investoren) — kein App-Code.

### 2026-09-01 (b) — v31.18: Pflanzendoktor — Ursachen mit Wahrscheinlichkeit, dann zu Lina

> Dritter Schritt aus den Entwürfen. Bild 3 zeigt „Gelbe Blätter erkannt / Mögliche Ursachen" mit Prozentwerten und einem prominenten Knopf „Zu Lina wechseln".

#### Zuerst geprüft, wie versprochen: die Zahlen sind echt

Ich hatte angekündigt, vor dem Bauen nachzusehen, ob die Diagnose solche Werte überhaupt liefert. Sie tut es: `plant-doctor-diagnose` gibt `hypotheses: [{ name, confidence (0–1), reason }]` zurück, und das Frontend zeigte die Prozente sogar schon an — nur in einer anderen Form. **Nichts zu erfinden.**

#### Was sich ändert

Statt „Wahrscheinlichste Diagnose" gross und „Weitere Möglichkeiten" als graue Restposten darunter jetzt **eine** Liste „Mögliche Ursachen" mit Balken und Prozent, nach Wahrscheinlichkeit sortiert. Das ist nicht nur näher am Entwurf, es ist ehrlicher: bei 70 % / 60 % / 30 % ist die zweite Hypothese keine Fussnote.

#### Der Knopf, der wirklich gefehlt hat

„Zu Lina wechseln" gab es nicht. `gsOpenLina()` nahm keine Argumente und lud immer nur die letzte Konversation — es war schlicht **kein Weg vorgesehen, eine Diagnose zu übergeben**. Dabei ist das die Frage, die nach jeder Diagnose kommt: *und was mache ich jetzt konkret?*

`gsDoctorToLina()` öffnet Lina und schreibt die Frage samt Pflanzenname und Top-Ursache ins **normale Eingabefeld**; `gsLinaSend()` übernimmt. Bewusst ohne eigenen Sendeweg: so gelten dieselben Regeln wie für jede andere Nachricht — Konversation anlegen, in `coach_messages` speichern, Quota zählen, Verlauf mitschicken, Fehler behandeln. Ein zweiter Pfad wäre genau die Doppel-Logik, die in dieser App schon zweimal auseinandergelaufen ist (Streak-Zähler, Erledigt-Logik). Ist man nicht angemeldet, zeigt `gsOpenLina` seinen Hinweis-Bildschirm ohne Eingabefeld — dann bricht die Funktion ab, statt etwas vorzutäuschen.

#### Ein Fund, der nicht von mir stammt

Im gerenderten Dunkelmodus leuchteten das **Dringlichkeits-Band** (`#fff8e1`) und der **„Profi rufen"-Kasten** (`#fff3e0`) wie ein Scheinwerfer — fest verdrahtete Farben, derselbe Fehler, den ich beim Tagesplan von vornherein vermieden habe, hier nur schon vorhanden. Jetzt CSS-Klassen mit `body.dark`-Varianten (warmes Bernstein auf dunklem Braun).

**Nicht angefasst:** die drei Rückmeldungs-Knöpfe („Hilfreich", „Wurde besser", „Wurde schlechter") sind im Dunkelmodus weiterhin helle Chips. Lesbar, nur hell — eigene Aufgabe, kein Grund, diesen Schritt aufzublähen.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**, hell und dunkel (dunkel in einem eigenen `body.dark`-Rahmen, damit die Klassen wirklich greifen), keine JS-Fehler · Antwortformat der Edge-Function im Quelltext nachgelesen statt angenommen · Version synchron v31.18.

### 2026-09-01 (a) — v31.17: „Mein Garten" bekommt den Überblick aus den Entwürfen

> Zweiter Schritt aus Fernandos Bildern. Bild 6 zeigt „Mein Garten" mit vier Kennzahl-Kacheln und einem Knopf zum Pflegeplan.

#### Die interessante Entscheidung: zwei Kacheln habe ich nicht gebaut

Der Entwurf zeigt **„4 Pflegezonen eingerichtet"** und **„2 Lichtzonen erstellt"**. Beides stammt aus dem Sensor-Produkt und hat in dieser App **keine Entsprechung** — es gibt weder Pflege- noch Lichtzonen. Ich hätte Kacheln bauen können, die irgendetwas Plausibles anzeigen. Das wäre genau die Sorte Lüge, die ich in dieser Sitzung reihenweise entfernt habe: die Quiz-Rangliste zeigte Nullen, „Was ist neu" zeigte hundert Updates lang v30.03, der Tracking-Kommentar versprach ein Fortsetzen, das es nicht gab.

Also dieselbe **Form**, aber nur Zahlen, die es wirklich gibt: **Pflanzen in Pflege** (`ps_myplants`), **Beete angelegt** (`gs_gardens`), **Pläne gespeichert** (`gs_garden_plans`) — und als vierte Kachel der **nächste Schritt** aus `gsGetDueTasks()`, den ein Tippen erledigt.

#### Zwei eigene Fehler, gefunden bevor sie ausgeliefert wurden

1. **Ich hatte `gsOpenGardenBeds()` und `gsOpenMyPlans()` aufgerufen — beide existieren nicht.** Erfundene Funktionsnamen, direkt nach dem Absatz, in dem ich erfundene Zahlen ablehne. Nachgesehen: die Pläne öffnet `gsPlansOpen()` (Rückfall `gsPPopenSavedPlans()`), und für Beete gibt es **kein** Modal — die Liste steht auf demselben Bildschirm, also scrollt die Kachel dorthin.
2. **`'Plan' + (n===1?'':'ä') + (n===1?'':'ne')`** ergibt bei drei Plänen „Planäne". Jetzt schlicht `Plan` / `Pläne`.

Beides fiel auf, weil ich den Code **gerendert** habe statt ihn nur zu lesen.

#### Gelesen wird frisch aus dem Speicher

Nicht aus den globalen `gardens`/`plantings`-Variablen: die stehen auf dem Stand von vor dem letzten Cloud-Pull. Dieselbe Falle wie beim Tagesplan.

Ohne Pflanzen führt „Pflegeplan ansehen" auf eine leere Liste — dann heisst der Knopf „Erste Pflanze scannen".

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**: vier Zustände (voller Garten, alles erledigt, dunkel, leer), keine JS-Fehler, Plural in allen Fällen geprüft · Ziel-Funktionen im Monolithen nachgeschlagen statt angenommen · Version synchron v31.17.

### 2026-08-31 (z) — v31.16: Startseite nach Fernandos Entwürfen — „Dein Tagesplan"

> Fernando hat 16 Bilder geschickt: sieben zeigen die App, neun sind Pitch-Deck. Auftrag: „genau so soll es ungefähr aussehen … so dass es auch 100% funktionsfähig ist und auch sauber im backend ist". Erster Schritt: die Startseite.

#### Was die Entwürfe sagen

Die Startseite ist dort **eine einzige Frage**: *Was mache ich jetzt?* Begrüssung mit Namen als Überschrift, Wetter, dann **„Dein Tagesplan"** mit Prioritäten (Hoch/Mittel/Niedrig) — und darunter **genau ein** hervorgehobener **„Nächster Schritt"** mit rundem grünem Pfeilknopf. Kein Abzeichen, keine Punktzahl. Das ist die ehrlichere Antwort auf „süchtig machen": nicht mehr Belohnung, sondern weniger Ratlosigkeit.

#### Umgesetzt

`gsRenderDayPlan()` liest **`gsGetDueTasks()`** — Pflanze, Aufgabe, Tage bis fällig. Diese Daten gab es längst; sie standen nur auf dem Pflanzen-Tab (Notizzettel) und in der Glocke, also **überall ausser dort, wo man zuerst hinschaut**. Erledigen läuft über `gsNcDoneTask → gsQuickDone`, es gibt weiterhin **genau eine** Erledigt-Logik (inkl. Cloud-Sync, Tagebuch-Eintrag, Achievements) — keine zweite, die auseinanderläuft.

Vier Zustände, alle gebaut und gerendert:

| Lage | Was steht da |
|---|---|
| Aufgaben offen | bis zu 3 Zeilen + „+ N weitere" + Nächster Schritt (Tippen = erledigt) |
| Alles erledigt | „Alles versorgt … auf Kurs." + Nächster Schritt „Neue Art entdecken" |
| Keine Pflanze | Erklärung + Nächster Schritt „Erste Pflanze scannen" |
| Dunkelmodus | dieselbe Karte, nur Token-Farben |

Gezeichnet wird in **`initHomeBoard()`**, nicht in `switchTab` — sonst bliebe die Karte beim allerersten Start leer, weil „Home" da schon offen ist. Dazu nach jedem Erledigen und am Ende von `renderMyPlants()`, damit nach einem Cloud-Pull nicht „keine Pflanze" behauptet wird, während nebenan zwölf stehen.

#### Der Kopf der Seite

Die Begrüssung war bisher eine kleine Zeile **über** einem Titel, der jeden Tag derselbe war („Natur bestimmen & entdecken"). Die Entwürfe drehen das um, und das ist richtig: die erste Zeile soll den Nutzer meinen, nicht die App. Jetzt Überschrift = „Guten Morgen, Fernando", darüber nur noch die Jahreszeit.

Der Untertitel sagt, **was gerade gilt** — offene Aufgaben zuerst, dann demnächst Fälliges, dann „Dein Garten im Blick.", sonst die Saison-Zeile. Letzteres bewusst: für reine Bestimmungs-Nutzer ohne Pflanzen wäre „Dein Garten im Blick" eine leere Behauptung. Alle fünf Zweige einzeln nachgerechnet, inklusive Singular/Plural.

`home-hero-title` und `home-hero-sub` haben dafür ihre `data-i18n`-Attribute **verloren**: sie werden jetzt in JS gesetzt und holen ihre Texte über `gsI18n.t`, sonst hätte der nächste i18n-Durchlauf die Begrüssung wieder überschrieben.

#### Zwei Dinge, die beim Rendern auffielen

- **„Basilikum schädlinge prüfen".** Ein pauschales `toLowerCase()` auf den Anzeigenamen aus `TASK_DEFS` ergibt Unsinn, sobald der Name aus zwei Wörtern besteht. Im Entwurf steht schlicht „Basilikum prüfen" — jetzt eine kleine Verb-Tabelle je Aufgabenart, mit Rückfall auf den Anzeigenamen (und nur bei **einem** Wort kleingeschrieben).
- **Dunkelmodus.** Die Entwürfe sind cremefarben. Fest verdrahtet hätte die Karte im Dunkelmodus geleuchtet wie ein Scheinwerfer — deshalb ausschliesslich `--card`/`--surface2`/`--border`. Beide Modi gerendert und angesehen, nicht nur vermutet.

#### Wie es weitergeht

Die restlichen Entwürfe (Mein Garten mit Kennzahl-Kacheln, Scan-Ergebnis mit Wahrscheinlichkeits-Zeilen, 3D-Modell-Fortschritt) sind je ein eigener, prüfbarer Schritt. Ein Rundumschlag über 82 000 Zeilen in einem Zug ist genau der Weg, auf dem etwas kaputtgeht — und „durchdacht" war die Vorgabe.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · **In Chromium gerendert** (Playwright, 2× Pixeldichte): vier Zustände nebeneinander, hell und dunkel, **keine JS-Fehler** · Untertitel-Logik in fünf Zweigen nachgerechnet · `GS_RELEASES[0].v === GS_VERSION` · Version synchron v31.16.

### 2026-08-31 (y) — Vorabprüfung des Runbooks gegen die Live-Datenbank (lesend, keine Code-Änderung)

> Der Supabase-Lesezugriff funktioniert in dieser Sitzung. Damit liess sich der Stand faktisch prüfen, statt ihn zu vermuten — und die sieben wartenden Migrationen gegen das echte Schema abgleichen, bevor Fernando sie einspielt.

#### Was live noch offen ist (geprüft, nicht vermutet)

| Artefakt | Migration | Live vorhanden |
|---|---|---|
| `comment_reactions`, `fn_notify_post_like`, `fn_notify_comment_like` | v31.09 | **nein** |
| `daily_quizzes.image_url` | v30.85 | **nein** |
| Integritäts-Trigger auf `quiz_answers` | v30.95 | ~~nein~~ → **ja** (am 02.09.2026 nachgemessen: `trg_quiz_answers_verify` ist da) |
| `fn_is_role` / `fn_role_at_least` für `anon` gesperrt | v30.95 | **nein** (Leak offen) |
| Leaked-Password-Protection | Dashboard | **nein** |

Zum Quiz-Trigger: `quiz_answers` **hat** einen Trigger, aber es ist `trg_quiz_answers_sync_lb` (Leaderboard-Sync) — nicht der Integritäts-Trigger. Eine reine Spalten-Prüfung (`answered_on` existiert) hätte hier ein falsches „ist schon drin" geliefert; die Trigger-Definition zu lesen war nötig.

#### Vorabprüfung: der Runbook-Lauf sollte durchlaufen

- **Jedes referenzierte Objekt existiert** — 13 Tabellen plus `cron.job`, `cron.job_run_details`, `net._http_response`. Fehlend sind nur die vier Funktionen, welche die Migrationen selbst anlegen.
- **Spaltentypen passen** (uuid-Fremdschlüssel, `social_posts.likes` integer, `notifications` mit `dedup_key`).
- **Funktions-Signaturen stimmen mit den live vorhandenen überein.** Das war der wichtigste Punkt: weicht die Argumentliste ab, legt `CREATE OR REPLACE` eine **Überladung** an statt zu ersetzen — die Migration liefe fehlerfrei durch, und der Cron riefe weiter die alte Fassung auf. Sieben Signaturen abgeglichen, alle identisch.
- **`fn_get_daily_quiz` wird gelöscht und neu angelegt** (die Rückgabe bekommt drei Bild-Spalten). Kein View hängt daran, und die Migration setzt `GRANT EXECUTE` für `anon` + `authenticated` wieder — ohne das wäre das Quiz nach dem Lauf für alle tot. Geprüft, weil ein DROP die Rechte mitnimmt.
- **Das Frontend liest `image_url`/`image_alt`/`image_credit` bereits** (`index.html:10542`) — die Bildfragen wirken sofort.

Alles davon steht jetzt als Kommentarblock im Runbook selbst (`scripts/apply_pending_v30_87.sh`), nicht nur hier.

#### Advisor-Stand (live)

**0 ERROR**, 140 WARN, 5 INFO. Die WARNs sind zu 136 das bewusste SECURITY-DEFINER-RPC-Muster; die einzige andere ist `auth_leaked_password_protection`. Fünf Tabellen haben RLS **ohne Policy** (`book_ocr_pages`, `species_import_queue`, `species_search_cache`, `system_events`, `weather_forecast_cache`) — das ist Deny-all für normale Nutzer und passt: geschrieben wird dort nur aus SECURITY-DEFINER-Funktionen, die RLS umgehen.

#### Ein Verdacht, der sich auflöste

Achievement-Zähler, die wie `track_count` rückwärts laufen: Ich habe alle zehn `gsAchBump`-Aufrufstellen gegen die **live** ausgelesenen Schwellen geprüft. `diary_count` (Deckel 500, höchste Stufe **30**) und `harvest_count` (Deckel 1000, höchste Stufe **10**) sind nicht erreichbar — theoretisch, kein Fund. Und `fn_achievements_bump` setzt `unlocked_at` per `COALESCE`: ein gesunkener Wert **entzieht** kein Abzeichen, er lässt nur den Fortschrittsbalken zurückspringen. Das relativiert v31.12 nicht (bei `track_distance_km`, Stufe 50 km, war der Rückwärtslauf echt), aber es ist die genauere Beschreibung.

- **Verify:** Alle Aussagen oben stammen aus `execute_sql`/`get_advisors` gegen `vowbiueikwrauuceilhc` (nur lesend, keine DDL) · `bash -n scripts/apply_pending_v30_87.sh` OK · keine Code-Änderung, deshalb **kein Versions-Bump** und kein `GS_RELEASES`-Eintrag.

### 2026-08-31 (x) — v31.15: In der Quiz-Rangliste standest du mit 0

> Zweiter Teil von „Bindung und Wachstum". Beim Durchgehen des Quiz habe ich mehr verworfen als repariert — zwei Verdachtsfälle liessen sich nicht halten, und einen Fix habe ich rückgängig gemacht, weil er einen echten Fehler erzeugt hätte.

#### 🏆 Der Fund: der eigene Eintrag war immer 0

`openDqRanking` baut die Liste aus zwei Quellen: den Cloud-Zeilen aus `fn_quiz_leaderboard_top` und — falls man dort **nicht** vorkommt — einem lokalen Eintrag. Der lokale las `stats.yearPoints`, `stats.yearCorrect`, `stats.yearTotal`. Diese Felder legt `dqGetStats()` gar nicht an, und **niemand schreibt sie**: der einzige Schreiber war `dqShowResult`, eine Funktion, die im ganzen Monolithen **keine Aufrufstelle** hat (nachgezählt).

Wer also neu angemeldet ist, wessen Übertragung fehlschlug oder wer ausserhalb der Top 50 liegt, sah sich mit **0 richtig, 0 %, 0 Fragen** — während `gs_dq_stats` den richtigen Stand hielt. Genau die Nutzer, die man halten will, bekamen die Rückmeldung, sie hätten nichts erreicht.

Jetzt nimmt der lokale Eintrag die Felder, die die beiden **echten** Antwort-Handler pflegen (`correct`, `total`, `bestStreak`) — und dieselbe Währung wie die Cloud-Zeilen. Denn:

#### 🏷️ Die Zahl hiess „Punkte 2026" und war keine

`quiz_leaderboard` speichert `total_correct`, `total_attempts`, `streak_current`, `streak_max` — **keine Punkte-Spalte, keinen Jahresbezug**. Die grosse Zahl rechts zeigte `total_correct` unter der Beschriftung „Punkte 2026", während die Überschrift zwei Zeilen darüber „Rangliste (gesamt)" sagte. Dieselbe Zahl stand ausserdem gleich nochmal in der Zeile darunter („x/y Fragen"). Hätte ich den lokalen Eintrag auf `stats.points` gesetzt — die naheliegende Lesart der Feldnamen —, stünde ein Nutzer mit 850 Punkten über allen Cloud-Zeilen mit 12: aus einer Null wäre eine noch grössere Lüge geworden.

Jetzt heisst die Zahl **„richtig gesamt"**, die Doppelung ist weg, und `streak_max` — kam schon immer vom Server mit, wurde nie angezeigt — steht als „🔥 x in Folge" in der Zeile. Der eigene Streak-Wert war zudem der **laufende**, während alle anderen ihren **besten** zeigten; auch das stimmt jetzt überein.

#### 📅 Ein Fix, den ich zurückgenommen habe

Der Quiz-Tag wird an vier Stellen mit `new Date().toISOString().slice(0,10)` gerechnet — UTC, wie die drei Streak-Systeme vor v31.14. Ich wollte ihn auf Ortszeit umstellen. **Das wäre ein echter Fehler gewesen:** die Frage kommt aus `fn_get_daily_quiz`, und die rotiert mit dem Postgres-`current_date` (auf Supabase UTC). Stellt man nur den Client um, hält er zwischen 00:00 und 02:00 Ortszeit den nächsten Tag für angebrochen, bekommt vom Server aber **dieselbe** Frage — und weil auch die „heute gespielt"-Sperre einen neuen Schlüssel hätte, liesse sich dieselbe Frage **zweimal beantworten und doppelt punkten**.

Stattdessen: eine Funktion `dqDayKey()` für alle vier Stellen, mit dem Grund im Kommentar und der Anleitung, wie beide Seiten gemeinsam wechseln müssten (`(now() AT TIME ZONE 'Europe/Zurich')::date`, so macht es `v28_05_feature_quota` bereits). Damit kann niemand mehr eine der vier Stellen einzeln „reparieren".

#### Zwei Verdachtsfälle, die sich nicht halten liessen

- **„Das Mini-Quiz lässt sich beliebig oft beantworten."** `initDailyQuiz` liest `gs_quiz_lastday`, und dieser Schlüssel wird **nirgends geschrieben** — die Sperre kann nie greifen. Aber: `initDailyQuiz` hat selbst keine Aufrufstelle, es wurde längst von `renderDailyQuizTeaser`/`initQuiz` abgelöst. Toter Code, kein Fehler.
- **„`dqShowResult` erzeugt NaN in den Statistiken."** Stimmt (`undefined++`), aber die Funktion wird nirgends aufgerufen. Ich habe die Phantom-Zeilen trotzdem entfernt, damit sie keine Falle ist, falls sie je verdrahtet wird — und es als Hygiene deklariert, nicht als Fix.

#### Nicht angefasst

`gs_quiz_lastday` steht in `GS_USER_KEYS` und in drei Sync-Listen, obwohl niemand den Schlüssel schreibt. Aufräumen ist eine eigene Aufgabe. Ebenso das Nachziehen der 42 neuen Quiz-Fragen — die Migration `20260827_quiz_bilder_und_fragen_v30_85.sql` liegt bereit, kann aber nur der Betreiber einspielen (Runbook).

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Feld-Abgleich im Block `openDqRanking` programmatisch geprüft: beide Produzenten liefern denselben Satz (`username, correct, attempts, streakMax, isMe`), alle konsumierten Felder werden auch produziert, kein Phantom-Feld mehr im Code (nur noch in Kommentaren) · `initDailyQuiz` und `dqShowResult` als aufruflos nachgezählt · `GS_RELEASES[0].v === GS_VERSION` · Version synchron v31.15.

### 2026-08-31 (w) — v31.14: Die Tages-Serie verschwand beim zweiten Gerät

> Erster Teil von „Bindung und Wachstum", der nichts mit Aussehen zu tun hat. Bevor man Nutzer mit einer Serie hält, muss die Serie halten. Sie tat es nicht.

#### 🔥 Der Streak wurde beim Cloud-Abgleich gelöscht

`gs_streak` ist kein einzelner Wert, sondern **ein Datensatz aus vier Schlüsseln**: Wert, letzter aktiver Tag, Zeitstempel und eine FNV-Signatur gegen Handarbeit im localStorage. `gsGetStreak()` prüft die Signatur bei **jedem** Lesevorgang und setzt bei Nichtübereinstimmung auf 0.

Der Cloud-Writeback schrieb die vier durch dieselbe generische Schleife wie alles andere — mit `if (v == null) continue`. Ein Gerät, das noch nie eine Serie hatte, baut aber genau diesen Blob:

```
streak: null   (JSON.parse(getItem('gs_streak') || 'null'))   → übersprungen
streak_sig: '' (getItem(...) || '')                           → GESCHRIEBEN
```

Der Wert blieb also stehen, die Signatur wurde geleert — und der nächste Lesevorgang hielt den Datensatz für manipuliert. **Wer zwanzig Tage gesammelt hatte, verlor sie, sobald er sich einmal auf einem zweiten Gerät anmeldete.** Zweitens galt für den ganzen `state`-Blob „Cloud ist massgeblich"; für einen Streak ist das falsch, denn Aktivität auf **irgendeinem** Gerät zählt — ein zurückgebliebenes Gerät zog den Wert nach unten.

Beides **vor dem Fix mit den echten Funktionen nachgestellt** (Fake-`localStorage`, `_gsStreakSig`/`gsGetStreak` unverändert aus `index.html` extrahiert): 20 → **0** beim leeren Blob, 20 → **5** beim niedrigeren Cloud-Wert. Nach dem Fix 7/7 Szenarien grün.

Jetzt übernimmt `_gsStreakApplyCloud` die vier Schlüssel **als Ganzes** und nur, wenn die Cloud weiter ist (späterer Tag; bei gleichem Tag der höhere Wert). Die Signatur wird lokal neu erzeugt — über die Leitung transportiert sie ohnehin nichts, was nicht schon in den Daten steht. Bleibt der lokale Stand stehen, wird über das bestehende `_gsStateRepairNeeded`-Signal aus v28.97 ein Reparatur-Push angestossen.

#### 🔑 Der Login-Streak fiel auf 1, sobald ein zweites Gerät im Spiel war

Im State-Blob stand `login_streak`, aber **nicht** `gs_last_login`. Gerät B bekam die Zahl ohne den zugehörigen Tag, sah beim nächsten Start eine Lücke, setzte auf 1 — und schob die 1 zurück in die Cloud, von wo Gerät A sie holte. Der Tag ist jetzt Teil des Blobs, und beide werden wie oben nur gemeinsam übernommen. `gs_last_login` steht dazu in `STATE_KEYS`, damit ein Schreiben den Scope überhaupt als geändert markiert.

#### 🕛 Drei Streak-Systeme, zwei Tagesgrenzen

`gs_streak` rechnet seit v23.56 mit `_gsDayKey()` in **Ortszeit** („Timezone-safe, kein UTC-Drift" steht sogar im Kommentar). `gsCheckLoginStreak` und `checkAndUpdateStreak` rechneten mit `new Date().toISOString().slice(0,10)` — dem **UTC-Tag**. Nachgerechnet mit `TZ=Europe/Zurich`:

| Zeitpunkt | Ortszeit | UTC |
|---|---|---|
| 31.08. 00:30 (Sommerzeit) | `2026-08-31` | `2026-08-30` |
| 15.01. 00:30 (Winterzeit) | `2026-01-15` | `2026-01-14` |
| 31.08. 14:00 | `2026-08-31` | `2026-08-31` |

In der Schweiz begann der neue Tag für zwei der drei Systeme also erst um **01:00 bzw. 02:00 Uhr**. Wer um halb eins nachts noch hereinschaute, zählte für gestern — und dieselbe Sitzung wurde vom einen System als „heute", vom anderen als „gestern" gewertet. Alle drei nutzen jetzt dieselbe Grenze.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · **14/14 Szenarien** in zwei Node-Suiten gegen die aus `index.html` extrahierten Originalfunktionen (Aktiv-Streak 7, Login-Streak + Tagesgrenze 7); die zwei Fehlerfälle waren vor dem Fix rot · Zeitzonen-Divergenz mit `TZ=Europe/Zurich` belegt · `GS_RELEASES[0].v === GS_VERSION` (die Prüfung aus v31.13 greift) · Version synchron v31.14.

### 2026-08-31 (v) — v31.13: „Was ist neu" zeigte über hundert Updates lang dasselbe

> Beim Aufräumen des Tracking-Codes fiel mir auf, dass `GS_RELEASES` bei **v30.03** endet. Ich habe das als Nebenbefund notiert und dann nachgesehen, was der Eintrag eigentlich steuert. Die Antwort war unangenehmer als erwartet.

#### 📰 Der Fund

`showWhatsNew` baut den Dialog nach einem Update so: **Überschrift aus `GS_VERSION`**, **Inhalt aus `GS_RELEASES[0]`** — ohne zu prüfen, ob beides zusammengehört. Die Liste steht seit dem 21. Juni auf v30.03. Seither hat jeder Nutzer nach **jedem** Update einen Dialog gesehen mit dem Titel *„Was ist neu in v31.xx"* und darunter den Notizen von v30.03 („💾 Pläne speichern — zuverlässig, mit ‚Meine Pläne'"). Rund **110 Versionen** lang. Dasselbe im Über-Modal: der Block *„✨ Aktuelle Version"* zeigte v30.03, während direkt daneben im selben Modal die echte laufende Version stand.

Das ist kein Schönheitsfehler. Wer die App aktualisiert und dreimal dieselbe Meldung bekommt, hört auf hinzusehen — und erfährt dann auch nichts mehr, wenn wieder etwas Echtes drinsteht.

#### Was ich geändert habe

1. **Sechs Einträge nachgetragen.** v31.09, v31.10, v31.11, v31.12 einzeln; dazu zwei ehrlich als solche gekennzeichnete Sammel-Einträge: `v30.92 – v31.08` (die Datenhaltungs-Welle) und `v30.04 – v30.91`. Über hundert Einzel-Einträge rückwirkend zu erfinden wäre Theater gewesen — die vollständige Historie steht in `STATUS.md`, und die Sammel-Einträge sagen genau das.
2. **Der Dialog prüft jetzt ab.** Stimmt `GS_RELEASES[0].v` nicht mit `GS_VERSION` überein, **bleibt er aus** und schreibt in die Konsole, welcher Eintrag fehlt. Lieber nichts zeigen als etwas Falsches. `gs_seen_version` wird dabei bewusst **nicht** gestempelt: wird der Eintrag später nachgetragen, bekommt der Nutzer ihn noch zu sehen.
3. **Das Über-Modal widerspricht sich nicht mehr.** Der Block heisst nur dann „Aktuelle Version", wenn er es auch ist — sonst „Letzter dokumentierter Eintrag".
4. **Die Konvention steht jetzt in `CLAUDE.md` §3.1**, nicht nur in einem Kommentar über dem Array. Ein Schritt, den man nur findet, wenn man ohnehin an der richtigen Stelle liest, wird übersehen — genau das ist hier passiert, mir eingeschlossen: ich habe in dieser Session zwanzig Releases gebaut und keinen einzigen Eintrag hinterlassen.

#### 🧹 Nebenbefund beim Nachzählen: 49 Zeilen wurden beim Rendern verstümmelt

Die Notizen gehen per `innerHTML` ins Modal. **49 technische Zeilen** enthalten Tag-Namen und Platzhalter als **Prosa** — `<head>`, `<uuid>`, `<slug>`, `<script>`, `<img onerror>`. Der Browser hat sie als Markup gelesen: die Wörter verschwanden mitten im Satz, und die v29.36-Zeile baute tatsächlich ein `<img onerror>`-Element in den Dialog. Kein XSS (die Texte stammen aus dem Repo, nicht von Nutzern, und `<script>` via `innerHTML` läuft nicht), aber schlicht falsch dargestellt. Alle 13 Einsetzstellen in beiden Render-Funktionen escapen jetzt; gegengerechnet: 49/49 Zeilen kommen sauber durch.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `GS_RELEASES` als Array ausgewertet: **361 Einträge**, keine doppelten Versionen, keine ohne `v`/`headline` · Guard mit drei Fällen durchgespielt (passend → Dialog, unpassend → kein Dialog, real v31.13/v31.13 → Dialog) · Escaping an Stichproben gegengerechnet · Version synchron v31.13.

### 2026-08-31 (u) — v31.12: Karte & Tracking — das Fortsetzen war nur ein Kommentar

> Fernandos Auftrag „die Karte mit dem Tracking verbessern". Ich habe die Aufzeichnung von vorne durchgelesen, statt nur Kosmetik anzufassen — und fünf Stellen gefunden, an denen sie still verlor, was sie aufgezeichnet hatte.

#### ▶️ Der Kern: „Fortsetzen" gab es nicht

Über dem Tracking-Code steht seit v24.11 die Zeile *„Recovery beim App-Start: angefangener Track wird angeboten zum Fortsetzen"*. Der Dialog bot aber nur **„Als beendet speichern"** und **„Verwerfen"** an. Wer auf halber Wanderung die App verlor, konnte den Track abschliessen oder wegwerfen — weitergehen konnte er nur als **zweiter** Track. Ein Kommentar, der etwas verspricht, das der Code nicht tut, ist schlimmer als gar keiner: er verhindert, dass jemand nachsieht.

Jetzt gibt es drei Wege: **Fortsetzen** (hängt neue Punkte an denselben Track, wechselt dafür auf die Karte und wartet, bis sie bereit ist), **Als beendet speichern**, **Verwerfen**. Wegtippen heisst neu „später entscheiden" — der Snapshot bleibt liegen und wird beim nächsten Start wieder angeboten. Vorher löschte jeder Weg ausser „Speichern" die Aufzeichnung, **auch der Fehlerfall**: war `gsConfirmModal` nicht verfügbar, ging der Track kommentarlos verloren, ohne dass je jemand gefragt wurde.

#### 🔧 Vier weitere Stellen, an denen still Daten verschwanden

1. **Der Wiederanlauf des GPS war toter Code.** Beim App-Wake prüfte er `_gsTrack.watchId == null`. Der Browser setzt die watchId aber **nie** zurück, wenn er einen Watch einschläfert — die Bedingung konnte nicht wahr werden. Ein eingeschlafener Watch sah aus wie eine Pause: die Karte zeigte weiter Statistik, es kam nur nichts mehr an. Jetzt entscheidet ein Wach-Timer anhand des **letzten Fixes** (45 s ohne Signal → neu anhängen, frühestens alle 30 s), hängt vorher sauber ab (zwei parallele Watches hätten jeden Punkt doppelt gezählt) und schreibt **„⚠️ kein GPS-Signal"** in die Statuszeile, statt es zu verschweigen.
2. **Gesichert wurde „alle 10 Punkte"** — der Kommentar daneben sagte „alle 10 s". Wer stillsteht, bekommt keine neuen Punkte und damit **keine Sicherung**. Jetzt zeitbasiert, plus einmal beim Wegschalten (`visibilitychange`) und beim Schliessen (`pagehide`) — genau dann räumt das Betriebssystem die Seite ab.
3. **Lange Tracks wurden hinten abgeschnitten** (`.slice(-5000)` beim Speichern, `.slice(-2000)` im Snapshot). Eine Sechs-Stunden-Wanderung **begann danach in der Mitte**. Jetzt gleichmässig ausgedünnt: erster und letzter Punkt bleiben immer, die Form bleibt, nur die Auflösung sinkt. Gegengerechnet: 28 800 Punkte → 5 000, Start 0, Ende 28 799, keine Duplikate, streng steigend.
4. **Die Wander-Achievements liefen rückwärts.** Sie meldeten `saved.length` und die Summe der **30 aufbewahrten** Tracks — beides schrumpft, sobald der Deckel greift, und `p_set=true` schreibt den kleineren Wert auf dem Server fest. Ab Track 31 stand der Zähler auf 30 und die Kilometer **sanken** mit jedem weiteren Track. Jetzt zählen `gs_track_total_n`/`gs_track_total_m` monoton; fehlen sie, werden sie einmalig aus der vorhandenen Liste abgeleitet, damit niemand bei null anfängt.

#### 🗺️ Und die Karte selbst

- **Sie läuft mit.** Die Linie wuchs bisher aus dem Bild heraus — nach zehn Minuten sah man leere Karte. Nachgeführt wird nur, wenn der neue Punkt den Ausschnitt verlässt, und **nie**, während der Nutzer selbst verschoben hat (25 s Karenz): wer die Karte in die Hand nimmt, will sie behalten.
- **Ein Kopf-Marker** zeigt, wo man gerade steht — auf einer verwinkelten Route war das aus der Linie allein nicht zu lesen.
- **Funkzellen-Fixes verzerren die Linie nicht mehr.** Der erste Fix liegt oft hunderte Meter daneben; er zog einen Strich quer durch den Kanton und die Karte sprang dorthin. Solche Punkte werden weiterhin **gespeichert** (die Statistik filtert sie ohnehin selbst), aber nicht gezeichnet — mit derselben 70-km/h-Schwelle wie `_gsRobustDistance`, damit Linie und Statistik dieselbe Wirklichkeit zeigen. Nach 60 s ohne brauchbaren Punkt wird neu verankert, damit im Zug oder nach einem Tunnel nicht dauerhaft nichts mehr ankommt.
- **Voller Speicher verliert den Track nicht mehr.** Schlägt das Schreiben fehl, bleibt der Live-Snapshot liegen und der Nutzer erfährt es — vorher landete es in einem `catch` mit einer Zeile Konsole.
- **Ein liegengebliebener Snapshot wird beim Neustart einer Aufzeichnung gerettet**, statt vom ersten Sichern überschrieben zu werden.
- **`gs_track_live` und die neuen Zähler stehen in `GS_USER_KEYS`** — sonst bekäme der nächste Nutzer auf demselben Gerät angeboten, den Track eines Fremden fortzusetzen.

#### Nebenbefund (nicht angefasst)

`GS_RELEASES` endet bei **v30.03**. Alles danach — über hundert Versionen — steht nur in `STATUS.md`, nicht im „Was ist neu?"-Modal der App. Das nachzuziehen ist eine eigene Aufgabe, keine Beifracht dieses Commits.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Ausdünnung und Plausibilitätsfilter mit Node gegengerechnet (Länge, Start/Ende, Duplikate, Gehen/Sprung/Stillstand/Funkzelle) · `_gsHaversine` bleibt für die drei Aufrufer weiter unten erhalten · Version synchron v31.12 (`GS_VERSION`, `meta app-version`, `sw.js gs-v31.12`, `_headers`).

### 2026-08-31 (t) — v31.11: Einstellungen durchgegangen — ein Datenschutz-Schalter zeigte den falschen Zustand

> Fernandos Auftrag „Einstellungen abchecken und alles verbessern + stabilisieren". Systematisch geprüft statt punktuell — und dabei zweimal meine eigene Prüfung korrigiert.

#### Was in Ordnung war (und ich deshalb nicht angefasst habe)

- **Alle 33 Einstellungs-Zeilen mit Aktion haben ein existierendes Ziel.** Keine toten Klicks.
- **Alle 11 Schalter haben einen Handler**, und jede Handler-Funktion ist definiert.
- **Die Schalter werden korrekt aus dem Speicher initialisiert.** Mein erster Scan meldete „11× nie gesetzt" — das war ein **zu enges Suchmuster**, die Zuweisung läuft über eine Zwischenvariable in `toggleMap`. Nachgesehen, bevor ich etwas „repariert" hätte.
- **Das `!== false`-Muster ist konsistent.** Ich hielt es kurz für einen Fehler (nicht gesetzte Vorliebe → Schalter zeigt „an"), aber die Features lesen mit derselben Regel (`=== false ? aus : an`). Kein Widerspruch.

#### 🔒 Der echte Fund: eine Datenschutz-Einstellung log

`profiles.opt_in_achievement_feed` steuert, ob die eigenen Erfolge im Community-Feed erscheinen — **massgeblich ist der Server** (`fn_achievements_feed` liest ihn). Der Schalter in den Einstellungen las aber `userPrefs.achFeed`, einen rein **lokalen Spiegel**, der **nur geschrieben und nie zurückgelesen** wurde.

Folge: auf einem neuen Gerät stand der Schalter auf dem Standard „an" — auch wenn man sich anderswo bewusst abgemeldet hatte. Bei einer Datenschutz-Einstellung ist ein falsch angezeigter Zustand das eigentliche Problem: **wer „aus" gewählt hat, muss „aus" sehen.** Schlimmer noch, ein späteres Speichern hätte den Server-Wert stillschweigend zurück auf „an" gedreht.

`sbLoadProfile()` spiegelt den Server-Wert jetzt in die lokale Vorliebe **und** in die Checkbox, sobald das Profil geladen ist. Spalte vorher in der Live-DB geprüft: `boolean`, Standard `true`.

#### 🧹 Sieben verwaiste Einträge entfernt

`toggleMap` enthielt `toggle-water-notif`, `-weather-notif`, `-market-notif`, `-social-notif`, `-harvest-notif`, `-pest-tips`, `-safety` — **null** davon existiert noch im DOM (nachgezählt). `getElementById` lieferte `null`, die Zeilen liefen ins Leere. Harmlos, aber irreführend: wer die Karte liest, hält diese Einstellungen für vorhanden. Push-Kategorien laufen längst über `gs_push_settings`. Übrig bleiben **5 Einträge, alle mit echtem Element**.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `toggleMap` gegengezählt (5/5 im DOM) · Version synchron v31.11.

### 2026-08-31 (s) — v31.10: Eigenes Icon-Set — 23 Symbole, 7 KB, erben die Textfarbe

> Fernandos Wunsch nach eigenen Icons. **Wichtige Einschränkung vorweg:** eine „Expansions-Festplatte" ist in dieser Umgebung **nicht eingebunden** (`df` zeigt nur den Container). Die Icons liegen deshalb im Repo unter `assets/icons/` — das ist der Weg auf Fernandos Rechner, per `git pull`.

- **Warum eigene Icons statt Emoji.** Die App nutzt durchgehend 🌱 🔔 📷. Drei Nachteile: jede Plattform zeichnet sie **anders** (die App wirkt zusammengesetzt statt gestaltet), sie lassen sich **nicht einfärben** (im Dunkelmodus bleiben sie bunt, während alles andere umschaltet), und Screenreader lesen oft einen Namen vor, der mit der Funktion nichts zu tun hat.
- **Das Set:** 23 Strich-Symbole, 24×24, Strichstärke 1.75, runde Enden — `leaf` `mushroom` `tree` `herb` `scan` `pin` `track` `bell` `community` `heart` `share` `chat` `garden` `harvest` `book` `market` `settings` `search` `profile` `streak` `water` `sun` `calendar`. Zusammen **7 KB**.
- **`currentColor` ist der Kern.** Die Icons nehmen die Farbe des umgebenden Textes an — damit stimmen sie im Hell-, Dunkel- und jedem Akzent-Thema **ohne eine einzige zusätzliche Regel**. Genau das, was Emoji nicht können.
- **Eingebettet statt nachgeladen.** `gsIcon(name, size, label)` liefert Inline-SVG. Die App baut ihre Ansichten als HTML-Strings; ein `<img>` oder `<use href="datei.svg#id">` würde die Textfarbe nicht erben und zusätzliche Abrufe kosten.
- **Barrierefreiheit eingebaut, nicht nachgereicht:** mit `label` bekommt das Icon `role="img"` + `aria-label` (es *trägt* dann die Bedeutung); ohne `label` wird es als `aria-hidden` markiert — richtig, wenn daneben ohnehin Text steht.
- **`assets/icons/preview.html`** zeigt alle 23 mit Umschaltern für Dunkelmodus, Größe und Farbe. Wer eines ändert, hält es dort gegen die anderen.
- **Verify:** alle 23 SVGs mit einem XML-Parser geprüft — valide, `currentColor` vorhanden, Raster korrekt · Helfer in Node getestet: dekorativ/mit Label, Größe wird übernommen, unbekannter Name liefert leeren String, alle 23 erzeugen fehlerfreies Markup.
- **⚠️ Eine eigene Prüfung war zu naiv, und das ist erwähnenswert:** ich hatte „kein `onload` im Markup" per Substring-Suche geprüft — die schlug an, obwohl das Escaping korrekt war (`onload=` steht als harmloser Text *innerhalb* des Attributwerts). Erst das echte Parsen des Markups zeigt es sauber: es gibt **kein** `onload`-Attribut, der Angriffsstring ist der **Wert** von `aria-label`. Ein Test, der die falsche Frage stellt, ist schlimmer als keiner.
- **Noch nicht gemacht:** die Icons sind noch nirgends im UI eingesetzt. Emoji durch sie zu ersetzen berührt sehr viele Render-Stellen — das gehört in einen eigenen Schritt, sonst wird ein Rendering-Fehler zwischen 200 Änderungen unauffindbar.

### 2026-08-31 (r) — v31.09: Community — Kommentare liken und disliken, Teilen, Likes als Benachrichtigung

> Fernandos Auftrag: Likes sollen überall auch als Benachrichtigung erscheinen · Kommentare liken **und** disliken · Teilen. Dazu der Wunsch, dass die App mehr bindet.

- **Warum das eine Migration braucht und nicht nur Client-Code.** Geprüft, nicht angenommen: `notifications` hat RLS `insert_own` — ein Client kann keine Meldung für **jemand anderen** anlegen. Und `fn_create_notification` ist SECURITY DEFINER, aber nur für `postgres` + `service_role` ausführbar (`proacl` nachgesehen). Das ist richtig so: wäre sie für `authenticated` offen, könnte jeder jedem beliebige Meldungen schicken. **Ein Trigger ist damit der einzige saubere Weg** — er läuft als Owner, ist vom Client nicht fälschbar und funktioniert unabhängig davon, welche App-Version gerade liket.
- **Neu in der Migration** (`20260831_community_reaktionen_v31_09.sql`, im Runbook als M7):
  - `comment_reactions` — eine Zeile pro Nutzer und Kommentar, `UNIQUE (comment_id, user_id)`. Wechsel Like ↔ Dislike ist ein **Upsert**, nicht Löschen+Neuanlegen. Doppelstimmen sind dadurch auch bei parallelen Taps auf zwei Geräten unmöglich. RLS: lesen alle (Zählstände sind öffentlich), schreiben nur die eigene Stimme.
  - Trigger auf `post_likes` und auf `comment_reactions` → Benachrichtigung an den Autor. **Selbst-Likes lösen nichts aus.** `dedup_key` ist `like:post:<id>:<liker>` — wer wegnimmt und neu liked, erzeugt keine zweite Meldung.
  - **Dislikes benachrichtigen bewusst niemanden.** „Jemandem gefällt dein Kommentar nicht" wäre entmutigend und lädt zu Schikane ein. Sie zählen sichtbar mit, mehr nicht.
  - `social_posts.likes` wird jetzt **serverseitig** gezählt. Vorher schrieb der Client den Zähler selbst — bei zwei Geräten driftete er, und fälschbar war er ohnehin.
- **Client:** Reaktionsleiste unter jedem Kommentar (❤️ / 👎 / 🔗), optimistisch geschaltet und **bei Fehlschlag sauber zurückgesetzt** statt Erfolg vorzutäuschen. Teilen-Knopf an jedem Beitrag. Alle Reaktionen einer Kommentarliste werden in **einem** Aufruf geholt — nicht 30 Anfragen bei 30 Kommentaren.
- **Verhalten vor der Migration:** `_gsCommentReactionsOk` merkt sich beim ersten Abruf, ob die Tabelle da ist. Fehlt sie, werden die Knöpfe **gar nicht** gerendert — statt sichtbar ins Leere zu laufen. Sobald die Migration angewandt ist, erscheinen sie von selbst.
- **Teilen** nutzt die System-Freigabe (`navigator.share`), sonst die Zwischenablage; ein Abbruch durch den Nutzer wird als solcher erkannt und nicht als Fehler gemeldet.
- **Bewusst NICHT gebaut:** Benachrichtigung bei Marktplatz-Likes. `mktLike` zählt nur einen Zähler auf `marketplace_listings` hoch, ohne Pro-Nutzer-Zeile — eine Meldung wäre durch wiederholtes Tippen beliebig oft auslösbar. Das bräuchte erst eine eigene Tabelle wie `post_likes`.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · Version synchron v31.09.

### 2026-08-31 (q) — v31.08: Die still rotierenden Listen werfen nicht mehr weg, sie archivieren

> Der letzte offene Punkt aus dem Quota-Bereich. Der zweite von Fernandos zwei Architektur-Fragen — mit seiner Freigabe umgesetzt.

- **Der Befund.** Zehn Nutzerdaten-Listen werden per `slice()` gedeckelt. Bei **vier** davon ist der abgeschnittene Eintrag danach **auch in der Cloud weg**, weil der Sync-Blob aus der bereits gekürzten Liste gebaut wird — nachgeprüft: `_buildPlantsBlob` liest `gs_gartentagebuch`, `_buildGardenBlob` liest `gs_garden_plans` und `gs_gpx_tracks`, und `p.diary` steckt in `ps_myplants`. Und es geschah **lautlos**: der Nutzer erfuhr nie, dass etwas fehlt.
- **Die Deckel bleiben** — sie schützen die 5 MB, und das zu Recht. Was sich ändert: der herausfallende Eintrag wandert ins **Archiv** (IndexedDB, eigenes Kontingent) statt ins Nichts.
- **Und das Archiv ist erreichbar.** Einstellungen → Speicher zeigt die Zahl und hat einen „Sichern"-Knopf, der alles als JSON herunterlädt. Das war mir wichtig: heute habe ich schon **ein** Sicherheitsnetz repariert, das niemand erreichen konnte (v30.97, der Wiederherstellen-Banner). Ein zweites unerreichbares hätte ich nicht gebaut.
- **Einmaliger Hinweis** pro Schlüssel und Sitzung — nicht bei jedem Speichern nerven, aber auch nicht schweigen.
- **11 Kürzungsstellen** umgestellt: Gartentagebuch (2), Gartenpläne (4), GPX-Tracks (2), Pflege-Historie pro Pflanze (3). Das Archiv selbst ist auf 3'000 Einträge gedeckelt und räumt die ältesten ab — sonst hätte ich das Problem nur verschoben.
- **⚠️ Beim Umbau zweimal in dieselbe Falle getappt und sie beide Male vor dem Schreiben bemerkt:** die stärker eingerückten Zeilen (`          if (p.diary…`) enthalten die schwächer eingerückten als **Substring**, ein `str.replace` hätte also die falsche Stelle getroffen. Meine Zusicherung auf die Trefferzahl hat es beide Male abgefangen, bevor die Datei geschrieben wurde. Danach zeilennummernbasiert ersetzt — eindeutig.
- **Verify in Node, 9 Fälle.** `head` (Liste neueste-zuerst): 35 → 30 behalten, **die 5 ältesten** archiviert (`p30…p34`) ✅ · `tail` (Liste älteste-zuerst): ebenfalls **die 5 ältesten** (`t0…t4`) ✅ — in beiden Richtungen fällt das Alte heraus, nicht das Neue · genau am Deckel / darunter / leere Liste → nichts archiviert ✅ · `null` und Nicht-Array unverändert durchgereicht ✅ · **drei Kürzungen → genau ein Hinweis** ✅.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · IndexedDB-Version 2 → 3 (neuer Store `dropped_entries`; `onupgradeneeded` legt fehlende Stores ohnehin an) · Version synchron v31.08.

### 2026-08-31 (p) — v31.07: Der Render-Pfad zum Ausgangskorb — Fotos sind sofort sichtbar, auch vor dem Upload

> Der zweite Teil der Foto-Pipeline, der in v31.06 bewusst offen blieb. Damit ist sie rund: retten (v31.06) **und** anzeigen (jetzt).

- **Das Problem.** Ein Foto im Ausgangskorb liegt als base64 in IndexedDB. Die App baut ihre Ansichten als HTML-Strings zusammen — ein `<img src="gsphoto://7">` würde dort schlicht nicht laden. Nach v31.06 war das Bild also gerettet, aber bis zum Upload unsichtbar.
- **Der Weg, den ich NICHT gegangen bin:** jede einzelne Render-Stelle umbauen. Es sind viele, jede wäre eine neue Fehlerquelle, und der nächste Foto-Ort würde wieder vergessen.
- **Stattdessen ein Auflöser, der nach dem Rendern greift.** `gsResolvePhotosIn()` sucht `img[src^="gsphoto://"]`, holt die Bytes aus IndexedDB und setzt eine Object-URL. Ein `MutationObserver` auf `document.body` stösst das gebündelt (120 ms) an — **kein Aufrufer muss etwas davon wissen**, auch künftige nicht.
  - Object-URLs werden pro id **gecacht** (nicht bei jedem Render neu erzeugt) und nach erfolgreichem Upload **freigegeben** — sonst hielte der Browser die Bytes für die ganze Sitzung fest, obwohl das Bild längst aus der Cloud kommt.
  - Ist der Eintrag nicht mehr im Korb (hochgeladen und aufgeräumt), wird das Bild ausgeblendet statt ein kaputtes Symbol zu zeigen.
- **`gsQueuePhoto` liefert jetzt eine Referenz** (`gsphoto://<id>`) statt nur true/false. Fund, Pflanze-Bearbeiten und Pflanze-Neuanlage hinterlegen sie als Foto-Wert — das Bild erscheint sofort.
- **⚠️ Der Punkt, an dem es hätte schiefgehen können — und den ich an drei Stellen abgedichtet habe:** ein `gsphoto://…` ist eine **rein lokale** Referenz auf den Ausgangskorb *dieses* Geräts. Gerät sie in die Cloud, ist sie auf jedem anderen Gerät eine tote URL und rendert als kaputtes Bild. Abgefangen in:
  1. `map_user_finds`-Payload (Fund) — Platzhalter → `null`
  2. `_buildPlantsBlob` (Sync in `user_plants`) — via `_gsStripPhotoRefs`
  3. `gsSnapshotBuildState` (Backup, wird auf **anderen** Geräten wiederhergestellt) — via `_gsStripSnapPhotoRefs`
  „Kein Bild" ist für die anderen Geräte die ehrliche Aussage, bis der Upload durch ist; `gsFlushPhotoQueue` trägt das echte nach.
- **Verify in Node, 12 Prüfungen.** Kein Platzhalter im Cloud-Blob ✅ · echte URLs und base64 unangetastet ✅ · **unveränderte Einträge behalten ihre Objekt-Identität** (kein unnötiges Kopieren) ✅ · `null`, Nicht-Array, leeres Array, `null`-Eintrag in der Liste ✅ · **und das Original bleibt unverändert** — entscheidend, denn der lokale Platzhalter muss überleben, sonst verschwindet das Bild aus der Anzeige ✅.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.07.

### 2026-08-31 (o) — v31.06: Foto-Ausgangskorb — Fotos gehen nicht mehr verloren und fressen nicht mehr den Nutzer-Speicher

> Fernandos Freigabe für die Foto-Pipeline. Löst die drei verbliebenen Audit-Befunde **und** nimmt den Druck von der 5-MB-Grenze, der heute ab ~13–20 fotografierten Pflanzen alles blockiert.

#### Warum IndexedDB und nicht localStorage

Ein Foto belegt als base64 leicht **200 KB**. In den ~5 MB von localStorage liegen Pflanzen, Tagebuch, Ernte und Einstellungen — dort haben Fotos nichts verloren. IndexedDB hat ein eigenes, viel grösseres Kontingent. Der neue Store `pending_photos` (DB-Version 1 → 2; `onupgradeneeded` legt fehlende Stores ohnehin an, Bestandsinstallationen ziehen also sauber nach).

#### 1 · Fund-Fotos wurden verworfen

Schlug der Upload fehl, hiess es „Fund wird ohne Bild gespeichert" — und das Bild war **endgültig weg**, auch wenn nur kurz das Netz fehlte. Jetzt wandert es in den Ausgangskorb und wird nachgetragen, sobald wieder Verbindung besteht. Auch der Fall „gar nicht angemeldet" ist abgedeckt: früher wurde da nicht einmal ein Versuch gemacht und das Bild fiel weg; jetzt hält der Korb es fest, bis ein Konto da ist.

#### 2 · Der eingereihte Scan bekam ein FREMDES Foto

`gsScanPersistToCloud` las das Bild beim Flush aus `window._gsLastScanB64` — einer **globalen Variable**. Ein gestern eingereihter Scan bekam heute also entweder gar kein Foto (nach einem Neustart ist die Variable leer) oder das Foto eines **anderen, neueren** Scans. Das Foto reist jetzt **mit** dem Warteschlangen-Eintrag; die globale Variable dient nur noch dem Live-Pfad direkt nach dem Scannen.

#### 3 · Duplikate bei Timeout

`gsUploadImage` erzeugte pro Aufruf einen Zufallsnamen. Lief ein Upload in einen Timeout, der serverseitig aber durchlief, legte die Wiederholung eine **zweite Datei** an — verwaiste Bytes, die niemand referenziert. Neuer vierter Parameter `stableKey`: FNV-1a über den Schlüssel ergibt einen deterministischen, pfadsicheren Dateinamen; zusammen mit dem ohnehin gesetzten `x-upsert: true` wird dieselbe Datei überschrieben statt einer zweiten angelegt. Aufrufer ohne Schlüssel verhalten sich unverändert. Auch `gsRetryPhotoUploads` nutzt ihn jetzt — vorher legte **jeder** Nachhol-Versuch eine neue Datei an.

#### 4 · Pflanzen-Fotos landen nicht mehr im 5-MB-Speicher

Beide base64-Notnägel in `savePlant` (Bearbeiten und Neuanlage) gehen jetzt in den Ausgangskorb. Bei der Neuanlage steht die `id` erst nach dem `push` fest — das Foto wird deshalb dort eingereiht (`_gsPendingNewPlantPhoto`). Ist der Korb nicht verfügbar, greift weiterhin der alte base64-Weg, damit nie ein Bild verloren geht.

#### Verify

- **Zustandsautomat in Node, 5 Fälle:** Upload ok + Ziel da → nachgetragen, Eintrag weg · Upload ok + Fund inzwischen gelöscht → Eintrag weg (wandert nicht ewig mit) · Fehlschlag 1 und 5 → bleibt, Zähler hoch · **8. Fehlschlag → aufgeben** (ohne Deckel liefe ein dauerhaft abgelehntes Bild für immer).
- **Idempotenz belegt:** gleicher Schlüssel → identischer Pfad, andere Scans → andere Pfade, umlautsicher (`scan-…-Bärlauch` → `k68c9z0_scan175664000000.jpg`).
- 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.06.

#### Ehrlich zum Rest

Für **Gäste** liegt das Foto im Korb, bis ein Konto da ist — `gsFlushPhotoQueue` braucht eine Anmeldung. Besser als verwerfen, aber kein Upload ohne Konto. **Altbestand** an base64 in `ps_myplants` räumt weiterhin `gsMigrateBase64Photos` ab. Was noch fehlt, ist der Render-Pfad: ein Bild im Korb ist bis zum Upload nicht anzeigbar. Das ist der nächste Schritt (Auflöser, der aus dem Korb eine Object-URL macht) — bewusst getrennt, weil er die Anzeige an vielen Stellen berührt.

### 2026-08-31 (n) — v31.05: Die gestellte Falle im Garten-Sync entschärft

> Der Punkt aus v31.04s Restliste, der **von selbst** scharf wird. Kein Designproblem — die Hausregel für genau diesen Fall existiert längst, sie war hier nur nicht angewandt.

- **Der Befund.** `gsGardenSync.pullAll()` schrieb den Remote-Stand **hart** über den lokalen — bei Gartentagebuch, Ernte-Log, Gärten und Pflanzungen. Der einzige Schutz war „die Cloud-Antwort ist nicht leer" (`d.data.length`). Hat die Cloud **einen** Eintrag und lokal liegen zweihundert, waren die anderen 199 weg.
- **Warum es heute nicht auffällt — und genau deshalb gefährlich ist:** `garden_diary` hat in Produktion **0 Zeilen**. Der Empty-Guard greift also immer, und nichts passiert. Sobald aber der erste Eintrag entsteht, räumt der nächste Start das lokale Tagebuch leer. Eine Falle, die sich selbst stellt, sobald das Feature benutzt wird.
- **Zweiter Fehler daneben:** geladen wird mit `limit=500`, lokal geschrieben wurde aber `slice(0,200)` — während der lokale Schreiber (Z. ~8182) bei 500 deckelt. Selbst ein völlig sauberer Sync hätte also gekürzt.
- **Die Lösung ist die Hausregel, die es schon gibt.** `_gsMergeById()` führt über die `id` zusammen, bei Kollision **gewinnt der lokale Stand**, sortiert nach Zeit — genau wie `_gsRestoreKey` im Snapshot-Restore. Ein Eintrag, den dieses Gerät kennt, geht nie verloren; Einträge von anderen Geräten kommen hinzu. Caps jetzt konsistent mit den lokalen Schreibern: Tagebuch 500, Ernte 1000.
- **Verify in Node, 11 Fälle.** Der Ernstfall zuerst: Cloud 1 Eintrag, lokal 200 → **201 statt 1**, alle 200 lokalen nachweislich erhalten, der Cloud-Eintrag dazu. Kollision auf derselben `id` → lokale Fassung gewinnt. 600 Einträge mit Cap 500 → 500, neuester zuerst. Sonderfälle: beide leer, nur Cloud, nur lokal, **Eintrag ohne `id`** (wird nicht verschluckt), `null`-Eingaben. Dazu `_gsReadArr` gegen gültiges JSON, Müll, Nicht-Array und fehlenden Schlüssel.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.05.
- **Aus der v31.04-Restliste noch offen:** offline aufgenommene Fund-Fotos werden bei fehlgeschlagenem Upload verworfen · ein in die Offline-Queue gelegter Scan bekommt beim Flush kein oder ein **fremdes** Foto · fehlender Idempotenz-Schlüssel erzeugt Duplikate bei Timeout. Alle drei hängen am selben Thema wie die noch offene Produktfrage (Fotos im Blob) und gehören sinnvollerweise gemeinsam gelöst.

### 2026-08-31 (m) — v31.04: 🔴 Abmelden und wieder anmelden löschte das Konto auf ALLEN Geräten

> Der schwerste Befund der ganzen Session. Aus den beiden Audit-Bereichen „multi-geraet" und „offline", die ich zuvor noch nicht gelesen hatte — beide selbst am Code nachvollzogen und die Kette in Node nachgestellt.

#### Die Kette

1. `gsOnLogout()` → `gsClearUserDataKeys()` leert `ps_myplants`, Tagebuch, Totliste, Saatgut-Inventar — **und markiert dabei über den `setItem`-Patch alles als dirty**.
2. `window._gsInitialSyncDone` steht weiter auf `true` vom vorigen Login. Der v27.01-Empty-Clobber-Guard wurde nämlich **nur bei einem Wechsel des Kontos** neu scharf gestellt (`lastUid !== uid`, Z. ~73338) — beim Logout nicht.
3. Re-Login mit **demselben** Konto, ohne Seiten-Neuladen: der Wechsel-Zweig greift nicht, der Guard bleibt entwaffnet.
4. Der nächste Flush schiebt einen **leeren** Pflanzen-Blob hoch.
5. Das Konto ist in der Cloud leer — **und das erreicht alle Geräte.**

Eine völlig normale Handlung — abmelden, wieder anmelden — löschte damit den gesamten Bestand überall.

#### Der zweite Fund an derselben Stelle

`gs_sync_queue` und `gs_sync_dirty` stehen **nicht** in `GS_USER_KEYS` und überlebten den Logout. Die `user_id` wird aber erst **beim Flush** eingesetzt (`Object.assign({user_id: _uid()}, op.row)`). Ungesendete Ernte- und Tagebuch-Vorgänge von Nutzer A landeten dadurch im Konto von Nutzer B — Datenverfälschung und Datenschutz-Problem in einem. Auf einem Familien-Tablet reicht ein Kontowechsel.

#### Die Lösung

- **`window._gsInitialSyncDone = false` in `gsOnLogout()`** — der Guard ist wieder scharf, bis der erste Pull des neuen Logins durch ist. Das ist der eigentliche Fix.
- **Sync-Zustand des scheidenden Nutzers räumen:** `gs_sync_queue`, `gs_sync_dirty`, `gs_sync_last_push` und die Pro-Scope-Marker.
- **Verlustfrei, weil vorher zweimal gesichert wird:** `sbLogout()` legt bereits den `pre_logout`-Snapshot an, und **neu** kommt davor ein `gsCloudSync.flushNow()` — beides noch mit gültigem Token, beides im 2,5-s-Rennen, damit der Logout nie hängt. Die Reihenfolge war entscheidend: `sbClearSession()` löscht den Token **vor** `gsOnLogout()`, ein Flush aus `gsOnLogout` heraus wäre also zwangsläufig fehlgeschlagen.
- **Verify — die Kette in Node nachgestellt, vorher/nachher:** vorher „LEERER Blob gepusht — Cloud-Pflanzen: 0" und „Warteschlange von Nutzer A liegt noch da → flusht ins nächste Konto"; nachher „kein Push — Cloud-Pflanzen: 3" und „Warteschlange geräumt". 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.04.

#### Noch offen aus diesen zwei Bereichen

Bewusst nicht in diesem Release, weil je eigener Umfang: offline aufgenommene Fund-Fotos werden bei fehlgeschlagenem Upload verworfen · ein in die Offline-Queue gelegter Scan bekommt beim Flush kein oder ein **fremdes** Foto (das Bild wird aus einer globalen Variable statt aus dem Queue-Eintrag gelesen) · `gsGardenSync.pullAll` überschreibt Tagebuch und Ernte-Log hart (aktuell harmlos, weil `garden_diary` 0 Zeilen hat — sobald die erste entsteht, wischt der nächste Boot die lokalen Einträge weg) · fehlender Idempotenz-Schlüssel erzeugt Duplikate bei Timeout.

### 2026-08-31 (l) — v31.03: Das Sicherheitsnetz für den Speicher zerstörte Daten, log über die Grenze und verschenkte Platz

> Drei Punkte aus dem Quota-Bereich des Datenverlust-Audits, die **keine** Produktentscheidung brauchen. Alle drei am Code nachvollzogen, die riskanteste Änderung in Node gegen 13 Fälle geprüft.

#### 🗑️ Der Integritäts-Check vernichtete genau das, was er retten sollte

- **Der Befund.** Bei kaputtem JSON schrieb `gsStorageIntegrityCheck` die **ersten 2000 Zeichen** als „Backup" weg und löschte dann den **ganzen** Schlüssel. Der Kommentar darüber behauptete „räumt auf ohne Datenverlust". Bei einer echten Pflanzenliste (Zehntausende Zeichen) ist das ein abgeschnittenes, nie wieder verwertbares Fragment — abgeschnittenes JSON lässt sich auch nicht mehr reparieren. Für Schlüssel ohne Cloud-Spiegel (`gs_scan_corrections`, `ps_feedback`, `ps_votes`, `gs_ki_analyses`, `userLocation`) war das **endgültige Vernichtung**.
- **Neu, in dieser Reihenfolge:**
  1. **Retten statt wegwerfen.** Die häufigste Korruption ist ein abgeschnittener Schreibvorgang — die Quota hat mittendrin abgebrochen. `_gsSalvageJson()` schneidet bis zum letzten **vollständigen** Element zurück und schliesst die Klammer. Aus „kaputt" wird so „fast alles noch da".
  2. Nicht rettbar → **vollständig** sichern (nicht abschneiden) und die Sicherung **zurücklesen**. Nur wenn sie wirklich steht, darf das Original weg.
  3. Sicherung fehlgeschlagen (Speicher voll) → **Schlüssel bleibt unangetastet**. Ein kaputter Schlüssel, den man noch ansehen kann, ist besser als stille Vernichtung.
- **In Node gegen 13 Fälle geprüft:** abgeschnitten nach 1/2 Einträgen → gerettet · mitten im 3. Eintrag → 2 gerettet · **mitten im ersten Eintrag → `null`** (erfindet nichts) · nur öffnende Klammer, leeres Array, Müll, leerer String, `null` → alle `null` · **eckige/geschweifte Klammern innerhalb von Strings** und **escapte Anführungszeichen** werden korrekt nicht mitgezählt · Objekte ebenso. Die geretteten Daten wurden gegengeprüft: echte Namen, echte Struktur.

#### 📏 Das Speicher-Modal zeigte die falsche Grenze

- Angezeigt wurde `navigator.storage.estimate()` — die **Origin-Quota**, hunderte MB bis GB. Der Balken stand bei ~0.8 % und beruhigte, während die tatsächlich bindende Grenze die **~5 MB von localStorage** sind. Genau die falsche Auskunft für jemanden, der nachsieht, *weil* Daten fehlen. Die einzige ehrliche Zahl („Lokal belegt: 4980 KB") stand ohne Vergleichswert ganz unten.
- **Jetzt:** „Lokaler Speicher — 4.87 MB / 5 MB" ganz oben, mit Balken, der ab 75 % orange und ab 90 % rot wird, plus Klartext („Fast voll. Neue Einträge und Fotos können ab jetzt fehlschlagen"). Die Origin-Quota bleibt als klar benannte Nebeninformation („Cache & Bilder — separates, viel grösseres Kontingent").

#### 🌍 Der Übersetzungs-Cache ass vom Budget der Nutzerdaten

- `gs_i18n_bundles` wuchs **ungedeckelt**: ~150–200k Zeichen pro je besuchter Sprache, bis zu ~0.8 MB der 5 MB — für Daten, die jederzeit neu ladbar sind. Und weil Nutzer-Speicher und Cache sich dieselben 5 MB teilen, ging das direkt zulasten von Pflanzen, Tagebuch und Ernte.
- **Jetzt** wird nur die **aktuelle** Sprache gesichert (Deutsch braucht kein Bundle — es ist der Fallback im Code). Andere Sprachen bleiben zur Laufzeit im Speicher, werden aber nicht persistiert. Kostet einen Abruf beim Sprachwechsel, spart dauerhaft Platz, der Nutzerdaten gehört. Dasselbe für `gs_i18n_srcmaps`.
- **Und wenn selbst das nicht passt:** der Cache wird ganz geräumt statt halb stehen zu lassen. Übersetzungen sind ersetzbar, Nutzerdaten nicht. Möglich wurde das erst durch v30.98 — vorher konnte `setItem` einen Fehlschlag gar nicht melden.
- Kompatibilität geprüft: der Lade-Pfad iteriert über `SUPPORTED` und weist nur zu, was vorhanden ist — eine schlanke Sicherung mit einer Sprache lädt korrekt. `current` wird in `setLang` **vor** dem Abruf gesetzt, die Sicherung trifft also immer die richtige Sprache.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · zwei ungenutzt gewordene Variablen entfernt (`_lsKB`) · Version synchron v31.03.

### 2026-08-31 (k) — v31.02: Der Sync verglich zwei verschiedene Uhren — und log über sich selbst

> Die letzten zwei offenen Punkte aus dem Bereich „sync-zuverlaessigkeit" des Datenverlust-Audits. Beide selbst am Code nachvollzogen und in Node durchgespielt.

#### ⏰ Last-Write-Wins stellte die Geräte-Uhr gegen die Server-Uhr

- **Der Befund.** `_shouldOverwriteLocal()` entschied mit
  `new Date(dirtyAt).getTime() > new Date(cloudUpdatedAt).getTime()`.
  `dirtyAt` kommt aus `markDirty()` — `new Date().toISOString()`, also vom **Gerät**. `cloudUpdatedAt` ist `updated_at` aus Postgres, also vom **Server**.
- **Wirkung.** Geht die Geräte-Uhr nach — nach leerem Akku, falsch gestellt, ohne Zeit-Sync — sieht eine soeben getippte lokale Änderung **älter** aus als der Cloud-Stand. Die Schutzbedingung greift nicht, der Pull überschreibt ungepushte Arbeit. Kein Randfall: eine um Minuten nachgehende Uhr genügt.
- **Ein Vergleich gegen `gs_sync_synced_at_<scope>` wäre auch nicht sauber gewesen** — dieser Schlüssel wird je nach Pfad mal mit der Server-Zeit (Pull) und mal mit der Geräte-Zeit (`_markSuccess` im Push) geschrieben. Das habe ich geprüft, bevor ich es als Alternative verworfen habe.
- **Lösung: gar kein Uhrenvergleich mehr.** Die Dirty-Markierung **existiert** genau dann, wenn es eine noch nicht gepushte lokale Änderung gibt — `markDirty()` setzt sie, `_markSuccess()` löscht sie erst nach einem nachweislich erfolgreichen Push (seit v30.99 mit HTTP-Status-Prüfung). Genau das ist die Frage, die hier zu beantworten ist, und sie braucht keine Zeitrechnung.
- **Bewusste Abwägung, offen benannt:** hat ein anderes Gerät zwischenzeitlich etwas Neueres gepusht, gewinnt jetzt das hier ungepushte Lokal und wird hochgeschoben. Dieselbe Last-Write-Wins-Semantik wie bisher, nur richtig entschieden — und sie fällt zugunsten dessen aus, was auf **diesem** Gerät noch nicht gesichert ist. Gegen das Ersetzen einer grösseren Liste durch eine kleinere schützt weiterhin der Count-Guard (v28.22).

#### 🤥 „gerade eben synchronisiert", während nichts ankam

- **Der Befund.** `gs_sync_last_push` wurde am Ende von `_flush()` **bedingungslos** gestempelt — auch wenn jeder Push in einen 401 lief und `stillDirty` randvoll blieb.
- **Was der Nutzer las:** „gerade eben synchronisiert · 3 ausstehend". Der beruhigende Teil vorn, der eigentliche Zustand als Nachsatz — genau falsch herum für jemanden, der nachsieht, **weil** Daten fehlen.
- **Lösung, zwei Teile:** der Zeitstempel wird nur noch bei vollständigem Erfolg gesetzt (leeres `stillDirty` **und** leere Warteschlange) und bedeutet damit „letzte nachweislich vollständige Synchronisierung"; ein unvollständiger Lauf schreibt stattdessen eine Warnung mit den offenen Bereichen ins Log. Und die Statuszeile stellt das Problem nach vorn: „⚠️ 3 Änderung(en) noch nicht gesichert · zuletzt vollständig vor 42 Min".
- **Verify in Node durchgespielt.** LWW: nichts Ungepushtes → Cloud autoritativ · ungepusht bei vorgehender Uhr → lokal behalten · **ungepusht bei 20 Min nachgehender Uhr → lokal behalten** (vorher: überschrieben) · Uhr Jahre daneben → lokal behalten · kein Cloud-Stand → lokal behalten. Stempel: alles durch → gesetzt · ein Scope offen → nicht gesetzt · Warteschlange nicht leer → nicht gesetzt. Statuszeile in allen drei Zuständen geprüft.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.02.
- **Damit ist der Bereich „sync-zuverlaessigkeit" des Audits abgearbeitet.** Offen bleiben nur die zwei Punkte, die eine Produktentscheidung brauchen: Fotos als base64 im Blob und die still per `slice()` rotierenden Listen.

### 2026-08-31 (j) — v31.01: XP-Balken-Bug an der Wurzel + Benachrichtigungen haben nur noch EINEN Ort

> Zwei Aufträge von Fernando. Beide bewusst an der Ursache gelöst, nicht am Symptom.

#### 🐛 „Ich klicke auf den XP-Balken und dann fängt alles an zu bugen" (dritte Meldung)

- **Ursache gefunden — und sie ist grösser als der Toast.** `renderProfileLoggedIn()` rief bei **jedem** Öffnen des Profils `gsOnLoginSuccess()` auf, also den kompletten Login-Übergang. Der XP-Balken im Home öffnet genau dieses Profil. Pro Klick lief damit ab:
  - `closeModal('modal-profile')` — **auf das Modal, das gerade geöffnet wird**
  - `gsPullGlobalApiKey()` (Netz)
  - „🛡️ Admin-Modus aktiv" nach 600 ms ← genau das, was Fernando sah
  - `gsAboStartTrial()` — Abo-Logik bei jedem Profil-Blick
  - `gsLoadCloudScans()` nach 1200 ms (Netz, plus Toast bei Treffern)
  - `gsRequestPersistentStorage()` und `gsKnowledgePull()` aus den beiden Wrappern
- Weil `renderProfileLoggedIn` **async** ist und `openUserProfile` direkt danach `openModal()` aufruft, schlossen und öffneten sich Modal und Schliess-Befehl gegenseitig — und 600/1200 ms später schoben Toasts und Netz-Antworten die UI weiter durcheinander. Das ist das „dann fängt alles an zu bugen".
- **Lösung — zwei getrennte Zuständigkeiten statt einer überladenen Funktion:**
  - `_gsApplyAuthUiState()` — billig, idempotent, jederzeit aufrufbar: nur Onboarding-Key, Gast-Flag, Gast-Banner, Admin-Zeilen. Kein Netz, keine Toasts, keine Modals, keine Abo-Logik. **Das** ruft `renderProfileLoggedIn` jetzt.
  - `gsOnLoginSuccess()` — der Übergang, mit Wachposten auf der `uid`: läuft pro echtem Login genau einmal. `gsOnLogout()` setzt ihn zurück, ein Kontowechsel lässt ihn wieder zu.
  - Die beiden Wrapper prüfen denselben Wachposten — sie sitzen **vor** der Basisfunktion und hätten sonst weiter bei jedem Aufruf gefeuert.
- **Nebenbefund mit erledigt:** `sbLogin()` **und** `onbDoLogin()` riefen beide `gsOnLoginSuccess()` auf — der Übergang lief also schon beim normalen Anmelden doppelt. Der Wachposten beendet das.
- **Verify in Node durchgespielt** (Wachposten + beide Wrapper + billiger Abgleich): echter Login → Übergang **einmal** · zweiter Login-Aufruf → nur UI-Abgleich · drei XP-Klicks → **nur** UI-Abgleich, kein Toast/Netz/Trial · nach Logout → Übergang wieder · Kontowechsel → Übergang wieder.

#### 🔔 Benachrichtigungen und Mitteilungen aus dem Menü entfernt

Seit v30.85 gibt es den Glocken-Knopf in der Kopfzeile, der direkt ins Benachrichtigungs-Center führt — mit Verlauf, abhakbaren Aufgaben und mehr Platz. Zwei Orte für dieselbe Sache hiess: zwei Render-Pfade, zwei Zustände, doppelte Pflege.

- **Entfernt:** `#gs-notif-panel` (Markup), `gsRenderNotifPanelInMenu()` (68 Zeilen), alle 6 Aufrufstellen, 22 CSS-Regeln.
- **Der Server-Pull beim Menü-Öffnen bleibt** — er hält jetzt die Glocken-Badge frisch statt das Panel zu füllen.
- **Zwei Folge-Reste gleich mitgenommen, weil sie sonst falsch geworden wären:**
  - Die rote Badge am **Menü-Tab** ist weg. Sie hätte weiter ungelesene Benachrichtigungen angezeigt und damit ins Menü geführt, wo es keine mehr gibt. `gsRenderNotifBadge()` bleibt als Name (≈20 Aufrufer) und ist jetzt ein Synonym für `gsRenderBellBadge()`.
  - **`closeMainMenu()` quittiert die Badge nicht mehr.** Das stammte aus v30.81, als „Menü zu" gleichbedeutend mit „gesehen" war. Ohne Panel hätte es Mitteilungen als gelesen markiert, die niemand angesehen hat — Menü auf, Menü zu, Glocke leer. Quittiert wird jetzt dort, wo man wirklich hinschaut: `gsOpenNotifCenter()`.
- **Bewusst behalten:** `.gs-notif-openall` (nutzt der Aufgaben-Notizzettel bei „Meine Pflanzen") und der Notizzettel selbst.
- **Verify:** 0 verbliebene Referenzen auf `gs-notif-panel`, `gs-notif-header`, `gs-notif-item`, `gs-notif-scroll`, `gsNotifPulse` · Glocke und Center unangetastet (14 Referenzen) · ungenutzt gewordene Variable `wasOpen` entfernt · 9/9 Inline-Scripts `node --check` OK · Version synchron v31.01.

### 2026-08-31 (i) — v31.00: Eine Pflanzen-Bearbeitung konnte im Nichts landen — plus ein widerlegter Audit-Befund

- **`savePlant` hielt eine Objekt-Referenz über ein `await` hinweg.** `const p = myPlants.find(…)` — danach ein `await` auf den Foto-Upload, der über das Netz geht und Sekunden dauern kann. Genau in diesem Fenster kann `gsSyncUserDataOnLogin` `myPlants = pd.plants` ausführen und das **ganze Array durch frische Objekte aus der Cloud ersetzen**. `p` zeigte dann auf ein verwaistes Objekt: Name, Spitzname, Emoji, Wasser, Sonne, Notizen und Foto landeten im Nichts, `savePlantsToStorage()` serialisierte das **neue** Array — und der Nutzer bekam trotzdem „✅ Aktualisiert."
  - **Fix ohne Referenz über den `await`:** Felder erst in ein einfaches Objekt einsammeln, dann uploaden, dann die Pflanze **frisch per id** auflösen und alles auf einmal anwenden.
  - **Der Fall „Pflanze ist weg" wird jetzt ehrlich behandelt:** wurde sie während des Uploads von einem anderen Gerät gelöscht, sagt die App das, statt still zu schlucken — inkl. aufgeräumtem Foto-State.
- **Nebenwirkung von v30.98, positiv:** `savePlantsToStorage()` gibt `gsStore.setJSON(…)` zurück, und das meldet seit v30.98 einen Quota-Fehlschlag wirklich. Damit ist der bereits vorhandene Zweig `else gsToast('⚠️ Speicher fast voll — …')` **wieder erreichbarer Code** statt Dekoration. Der Wurzelfix zahlt sich hier direkt aus.
- **⚠️ Ein Audit-Befund WIDERLEGT** — dokumentiert, damit niemand daran „repariert":
  - Behauptung war: „Der Gartentagebuch-Cap ist inkonsistent: lokal 500 Einträge, im pullAll-Pfad aber 200 — ein Sync könnte 300 lokal vorhandene Einträge wegwerfen."
  - **Stimmt nicht.** Die 200er-Caps (index.html:7431, 7505, 28910) sitzen auf **`p.diary`** — der *per-Pflanze*-Pflegehistorie. Die 500 sitzt auf **`gs_gartentagebuch`** — dem *globalen* Gartentagebuch. Zwei verschiedene Arrays, jedes für sich konsistent gedeckelt. `_buildPlantsBlob` liest `gs_gartentagebuch` sogar **ohne** Cap. Es gibt keinen Pfad, auf dem 300 Einträge verloren gehen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `editingPlantId` ist modulweit (`let`, Z. 20766) und nach dem Umbau weiterhin im Scope · der frühe `return` im Abbruch-Zweig überspringt nur Speichern/Rendern, was ohne Pflanze auch nichts zu tun hätte · Version synchron **v31.00** (Rollover bei .99, wie v26.99 → v27.00).
- **Weiterhin offen** (je eigene Entscheidung): Last-Write-Wins vergleicht Geräte-Uhr gegen Server-Zeitstempel · der Sync meldet „gerade eben synchronisiert" auch bei durchgehend fehlgeschlagenen Pushes · Fotos als base64 im Blob · ungedeckelte `gs_gpx_tracks`.

### 2026-08-31 (h) — v30.99: Zwei Sync-Pfade, die Fehlschläge als Erfolg verbuchten

> Aus dem Datenverlust-Audit (Bereich „sync-zuverlaessigkeit"). Beide Befunde selbst am Code nachvollzogen. Beide sind **echte Datenverlust-Ketten**, keine Schönheitsfehler — und beide enden damit, dass ein veralteter Cloud-Stand die lokalen Daten überschreibt.

- **Kette 1 — der keepalive-Push auf Mobile.** Beim Schliessen/Backgrounding der App (`pagehide`/`beforeunload`) läuft der Push über `fetch(…, {keepalive:true})`. Danach wurde `_markSuccess()` **bedingungslos** aufgerufen: kein Blick auf den HTTP-Status. Ein 401 oder 500 galt als erfolgreicher Push — und `_markSuccess` schreibt `gs_sync_synced_at_<scope>` und **löscht den dirty-Marker**. Beim nächsten Start sieht `_shouldOverwriteLocal` daraufhin „lokal sauber, synchronisiert um T" und lässt den veralteten Cloud-Stand über die lokalen Daten schreiben. Auf Mobile ist das der **Haupt**-Push-Pfad, also der Normalfall.
  - Verschärfend: dieser Pfad nutzt den **rohen** Token aus dem Speicher, ohne den Auto-Refresh, den `sbFetch` hat. Supabase-JWTs laufen nach ~1 h ab — ein 401 war damit nicht der Ausnahmefall, sondern nach einer Stunde Nutzung die Regel.
  - **Fix:** HTTP-Status auswerten, bei Fehler dirty bleiben. Und vorher die Token-Frische gegen `gs_sb_expires` prüfen (30 s Puffer) — beim Schliessen der App lässt sich nicht mehr zuverlässig refreshen, also lieber gar nicht senden und schmutzig bleiben; der nächste Start holt es nach.
- **Kette 2 — ein fehlgeschlagener Pull sah aus wie ein leerer.** `sbFetch` **wirft nicht**, es liefert `{error}`. Die Bedingungen `if (g && !g.error && …)` überspringen den Block dann einfach — ein Netzfehler war von „die Cloud hat noch nichts" nicht zu unterscheiden. Am Ende wurde trotzdem `window._gsInitialSyncDone = true` gesetzt, was den **v27.01-Empty-Clobber-Guard entwaffnet**, und das direkt folgende `flushNow()` schrieb den womöglich leeren lokalen Stand über die Cloud. Genau der Datenverlust, gegen den der Guard gebaut wurde.
  - **Fix:** die drei Blob-Pulls zählen ihre Fehler. Bei `_pullErrors > 0` bleibt der Guard scharf und es wird **nicht** geflusht; der nächste Pull-Versuch entscheidet neu. Eine leere Antwort **ohne** Fehler zählt weiterhin als Erfolg — ein frischer Nutzer hat legitim nichts in der Cloud und muss seinen ersten echten Stand pushen können.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `return` im Erfolgspfad liegt im `try`, das `finally` (Race-Guard-Reset) läuft also weiterhin · `gs_sb_expires` ist im selben Millisekunden-Format, in dem `sbSaveSession` es schreibt (Vergleich verifiziert) · Version synchron v30.99.
- **Aus demselben Bereich noch offen** (je eigene Entscheidung): Last-Write-Wins vergleicht Geräte-Uhr gegen Server-Zeitstempel (Clock-Skew verliert ungepushte Änderungen) · `savePlant` hält eine Objekt-Referenz über ein `await` hinweg, während der Pull `myPlants` ersetzen kann · der Sync meldet „gerade eben synchronisiert" auch dann, wenn jeder Push fehlschlug.

### 2026-08-31 (g) — v30.98: Der Speicher-Wrapper log — und mit ihm die halbe App

> Aus dem Datenverlust-Audit (Bereich „quota-stille-fehler", 14 Befunde). Die Wurzel selbst am Code nachvollzogen und mit einem simulierten vollen Speicher in Node durchgespielt.

- **Die Wurzel.** Der globale `localStorage.setItem`-Patch (v28.91) fing jeden `QuotaExceededError` ab und gab **`undefined`** zurück. Das hat zwei Folgen, die zusammen ein halbes System entwerten:
  1. **Jeder** `try { localStorage.setItem(…) } catch { …Fallback… }` im ganzen Monolithen ist toter Code — die Ausnahme kommt nie an.
  2. `gsStore.set()` wartete ebenfalls nur auf eine Ausnahme und meldete deshalb **ausnahmslos Erfolg**, auch wenn nichts geschrieben wurde.
- **Warum nicht einfach wieder werfen lassen:** genau dagegen wurde der Wrapper gebaut (iOS-Safari-Privatmodus, wo `setItem` grundsätzlich wirft). Der Rückgabewert ist der einzige ehrliche Kanal, der bleibt. Native `setItem` liefert `undefined` — `=== false` ist also eindeutig unser eigenes Signal, und ein ungepatchter Pfad bleibt über die Ausnahme weiterhin korrekt abgedeckt.
- **Drei Stellen, die dadurch gelogen haben, jetzt ehrlich:**
  - **Das Anmelden schlug bei vollem Speicher still fehl.** `sbSaveSession` ignorierte den Rückgabewert; der Nutzer landete nach *korrekter* Passworteingabe wieder auf dem Login-Screen — ohne Fehlermeldung, ohne Zugriff auf seine Cloud-Daten. `sbSaveSession` gibt jetzt true/false zurück und prüft per **Rücklesen**, ob der Token wirklich im Speicher steht (der einzige echte Beweis; bei zwei kurzen Strings billig). `sbLogin` bricht mit einer klaren Meldung ab, statt Erfolg zu melden.
  - **`gsSnapshotRestore` meldete „✅ Daten wiederhergestellt!"**, auch wenn bei voller Quota **kein einziger** Schlüssel geschrieben wurde — das letzte Sicherheitsnetz log den Nutzer an. Jetzt wird mitgezählt: nichts geschrieben → Fehlermeldung; teilweise → „x von y, bitte nach dem Aufräumen nochmal"; und in beiden Fällen `return false`.
  - `gsStore.set` zählte den Quota-Treffer ein zweites Mal, den der Wrapper schon gezählt hatte — die Statistik stand doppelt.
- **Verify — mit simuliertem vollem Speicher in Node**, nicht nur `node --check`: Normalbetrieb → `true` · Speicher voll → `gsStore.set` **false** (vorher immer true), `setItem` **false** (vorher undefined), `setJSON` false · Lesen bleibt intakt · **`setItem` wirft weiterhin nicht** (iOS-Privatmodus-Schutz nachweislich unversehrt) · Quota-Zähler exakt 3 bei 3 Fehlschlägen (vorher 5). 9/9 Inline-Scripts OK · Version synchron v30.98.
- **Bewusst noch offen** aus demselben Audit-Bereich, weil je eigene Entscheidung nötig: Fotos als base64 im `ps_myplants`-Blob (sprengt die 5-MB-Grenze ab ~13–20 Pflanzen), `gs_gpx_tracks` ungedeckelt (bis ~8 MB), zehn Listen die still per `slice()` rotieren (bei vier davon ist der abgeschnittene Eintrag auch in der Cloud weg), und das Speicher-Modal, das die Origin-Quota statt der ~5-MB-Grenze zeigt.

### 2026-08-31 (f) — v30.97: Das Cloud-Backup war da — nur nicht erreichbar

> Grundlage: Datenverlust-Audit (59 Agenten, adversarisch gegengeprüft). Kernbefund selbst am Code nachvollzogen, nicht übernommen.

- **Der Befund.** `gsSnapshotMaybeOfferRestore()` brach ab, sobald `_gsSnapshotHasContent(local)` true war. Diese Prüfung schaut auf genau **10 Domänen** (plants, diary, ernte, achievements, markers, scan_history …) — dieselben, die der Login-Pull **2,7 Sekunden früher** wieder befüllt (`t=1800ms` vs. `t=4500ms`). Nach einem Speicher-Wipe war der Wiederherstellen-Banner also **nie** zu sehen. Und dieser Banner-Knopf war die **einzige** Aufrufstelle von `gsSnapshotRestore()` — nachgezählt: 3 Treffer im ganzen Repo (Definition, `window`-Export, Banner).
- **Was dadurch praktisch verloren war**, obwohl es vollständig in `user_state_snapshots` lag: eigene Rezepte & Heilmittel, Bodenprofil, Garten-Standort, Scan-Korrekturen, Marktplatz-Käufe/Gebote, abgegebene Bewertungen, Aktions-Zähler, `gs_prefs` — und `gs_reminder_prefs` (die Per-Pflanzen-Giesserinnerungen: wird **gepusht**, aber die Pull-`stateMap` liest sie nicht zurück; der Snapshot ist ihr einziger Rückweg).
- **Verschärfend — der gute Snapshot wurde aktiv verdrängt.** Die Aufbewahrung behält 6 Snapshots plus den je neuesten pro Typ. Nach dem Wipe ist `_gsSnapshotHasContent` durch die gepullten Pflanzen wieder true → alle ~3 h legte ein `auto_periodic`-Snapshot nach, dem die verlorenen Domänen fehlen. **Binnen Stunden war das brauchbare Backup weg.**
- **Der Fix, drei Teile:**
  1. **Ein erreichbarer Weg:** neue Einstellungs-Zeile „♻️ Aus Cloud-Backup wiederherstellen" → `gsSnapshotRestoreManual()` mit Rückfrage. Gefahrlos, weil `_gsRestoreKey` nur in **leere** Schlüssel schreibt und id-Arrays mit Vorrang für lokal merged — es kann nichts überschreiben (im Code verifiziert).
  2. **Die richtige Frage:** der Banner hängt nicht mehr am Gesamt-Content, sondern an `_gsSnapshotHasExclusiveGap()` — „fehlt etwas, das **nur** im Snapshot steht?".
  3. **Verdrängungs-Schutz:** automatische Snapshots halten an, solange etwas fehlt, das zuletzt noch da war, und bieten stattdessen die Wiederherstellung an. Vom Nutzer ausgelöste Snapshots (`manual`/`pre_logout`/`pre_migration`) laufen weiter — dort ist der Wille eindeutig.
- **Eine eigene Schwäche gefunden und behoben:** der erste Entwurf des Verdrängungs-Schutzes stützte sich auf eine Spur in `localStorage` (`gs_snapshot_had`) — die bei „Browserdaten gelöscht" **mitgelöscht** wird, also genau im Ernstfall fehlt. Die massgebliche Prüfung vergleicht jetzt gegen den **Cloud-Snapshot** (`fn_user_snapshot_latest`); die lokale Spur ist nur noch die Abkürzung, die den Netz-Aufruf spart. Kosten: ein RPC alle ~3 h.
- **Verify — nicht nur `node --check`:** die neue Logik in Node gegen einen simulierten `localStorage` + Cloud durchgespielt, 6 Szenarien: kompletter Wipe ohne lokale Spur → **greift** · alles vorhanden → greift nicht · gar kein Backup → greift nicht · Cloud-Exklusivdomänen leer → kein Fehlalarm · `reminder_prefs` im `state`-Blob → greift · **Netzfehler → greift nicht** (fail-open, ein Ausfall darf das Backup nie stoppen). Dazu: `_GS_SNAPSHOT_ONLY` vor die erste Verwendung gezogen (hoisting hätte zwar getragen, ist aber unlesbar), `gs_snapshot_had` in `GS_USER_KEYS` (sonst blockierte die Spur beim Konto-Wechsel die Snapshots des nächsten Nutzers). 9/9 Inline-Scripts OK · Version synchron v30.97.

### 2026-08-31 (e) — v30.96: Die drei „unbelegten" Audit-Behauptungen selbst nachgeprüft

> Das Backend-Audit markierte drei Befunde ausdrücklich als **nicht belegt** („Beweislage dünn — muss nachgeprüft werden, bevor jemand daran arbeitet"). Genau richtig so. Ich habe alle drei selbst gegen Code und Live-DB geprüft: **alle drei treffen zu** — aber zwei sind deutlich harmloser als behauptet, und einer ist ernster.

#### 1 · Sensor-Messwerte gingen ins Leere — zutrifft, aber schlafend

`gsPushSensorReading` schickte `value:`, die Spalte heisst `value_num` (double precision). PostgREST antwortet auf eine unbekannte Spalte mit 400 — und der `catch(e){ console.warn }` verschluckte das. Kurios: der ESP32-Beispielcode in derselben Datei (Z. ~59659) und der Lesepfad (Z. ~59947, `select=metric,value_num,ts`) benutzen längst den richtigen Namen — nur der App-eigene Schreibpfad nicht.

- **Ehrliche Einordnung:** `gsPushSensorReading` hat aktuell **null Aufrufer**. Der Fehler ist real, aber schlafend — er wäre beim ersten echten Einsatz zugeschlagen. Live: `sensor_devices` = 1, `sensor_readings` = 0.
- Gefixt, plus: die Funktion gibt jetzt `true`/`false` zurück, damit ein künftiger Aufrufer den Fehlschlag überhaupt bemerken kann.

#### 2 · GardenSync lief in eine Endlosschleife — zutrifft, aber **kein** Datenverlust

`pushDiary` sendet `id: entry.id`, und lokale Tagebuch-Einträge bekommen `id: Date.now()` — eine **Zahl**. `garden_diary.id` ist aber `uuid`. Postgres antwortet `22P02 invalid input syntax for type uuid`. Gleiches Bild bei `gardens` (`id: 'gard_default'`) und `garden_plantings`. Belegt: **garden_diary = 0, gardens = 0, garden_plantings = 0 Zeilen** — seit jeher.

`flushQueue` schob **jeden** Fehlschlag zurück in die Warteschlange, ohne Zähler und ohne zwischen „gleich nochmal" und „gelingt nie" zu unterscheiden. Ergebnis: bis zu 500 Vorgänge, die bei **jeder** Änderung und **jedem** `online`-Event erneut gegen dieselbe Wand liefen, plus ein dauerhaftes „⚠️ N Sync pending".

- **Wichtige Korrektur zur Behauptung des Ermittlers:** es geht **nichts verloren**. Tagebuch, Gärten und Pflanzungen sind über die `gsCloudSync`-Blobs (`user_plants`, `user_gardens`) längst cloud-gesichert. GardenSync ist ein **zweiter, nie funktionierender Weg zu denselben Daten**. Der Schaden war der endlose Wiederholungslauf und die falsche Statusanzeige — nicht Datenverlust.
- **Fix bewusst minimal statt Refactor:** `flushQueue` unterscheidet jetzt dauerhafte Datenfehler (22P02, Constraint-Verletzungen, 4xx → sofort raus) von vorübergehenden (Netz/5xx → bis zu 5 Versuche, dann raus, mit Log). Plus eine Einmal-Bereinigung der bereits vergifteten Warteschlange (`gs_garden_sync_queue_purged_v3096`, behält nur Vorgänge mit gültiger UUID).
- **Offen als Eigentümer-Entscheid:** GardenSync und `gsCloudSync` decken dieselben Daten ab. Zwei Sync-Wege für eine Domäne sind genau die Mehrdeutigkeit, die Fehler erzeugt. Entweder GardenSync stilllegen oder die IDs auf echte UUIDs umstellen — nicht beiläufig, deshalb hier nur benannt.
- **Ich habe zusätzlich geprüft, ob das Ernte-Log betroffen ist: nein.** `gs_ernte_log` ist lokaler Cache, die Cloud-Wahrheit liegt in `garden_harvests` (4 Zeilen) über `gsCloudSync.pushHarvestAdd`. Der Verdacht war unbegründet.

#### 3 · Die Stripe-Webhook-Strecke hat noch **nie** geliefert — zutrifft, und das ist das ernste

| Beleg | Wert |
|---|---|
| `stripe_webhook_events` | **0 Zeilen, seit jeher** |
| `stripe_subscriptions` | 1 Zeile, `status='trialing'`, `current_period_end = 2026-05-23` (>3 Monate her), `updated_at = 2026-05-27` |
| `audit_log` (stripe/subscription) | 0 Zeilen |

`stripe-webhook/index.ts:305` schreibt **jedes** empfangene Event nach `stripe_webhook_events` — direkt nach der Signaturprüfung, **vor** jedem Handler. Null Zeilen heisst also: kein einziges Event hat je die Signaturprüfung passiert. Und wäre die Strecke intakt, hätte Stripe zum Trial-Ende am 23.05. ein `customer.subscription.updated` geschickt; die Zeile stünde auf `active` oder `canceled` statt weiterhin auf `trialing`.

- **Entwarnung zur Schwere, weil sie zählt:** es ist noch niemandem etwas verloren gegangen. Alle 9 bezahlten Konten sind **comp_tier-Zuteilungen von Hand** — es hat noch nie jemand über Stripe wirklich bezahlt. Die Strecke ist **unerprobt, nicht beschädigt**. Beim ersten echten Zahlungsvorgang wäre sie es aber: Abo-Start, Kündigung und fehlgeschlagene Karte kämen nie in der App an.
- **Ursache von hier aus nicht bestimmbar** — dafür braucht es das Stripe-Dashboard. Deshalb kein Rate-Spiel, sondern eine 4-Schritt-Diagnose im Runbook (Endpunkt vorhanden? Test- vs. Live-Modus? Recent deliveries → 401/400 = Secret-Mismatch? Gegenprobe mit „Send test webhook").
- **Damit ändert sich der Charakter der ohnehin anstehenden Secret-Rotation:** sie ist nicht nur Leak-Hygiene, sie ist möglicherweise die Lösung.
- **Was ich NICHT behaupte:** `app_settings.stripe_publishable_key` trägt zwar den Prefix `pk_test_`, aber die Zeile wird vom Frontend **nirgends gelesen** (0 Treffer). Das ist Altlast, kein Beweis für einen Modus-Fehler — im Runbook entsprechend als blosser Prüfanlass notiert, nicht als Ursache.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · Version synchron v30.96.

### 2026-08-31 (d) — v30.95: Backend-Audit — 1 Blocker, 4 Defekte, alles vorbereitet

> Grundlage: Backend-Integritäts-Audit über 5 unabhängige Ermittlungen (34 Agenten), **jeder Befund einzeln adversarisch gegengeprüft** — inklusive Korrekturen an den Belegen der Ermittler. Gesamturteil zuerst, weil es fair ist: **das Fundament ist überdurchschnittlich solide.** 129 FK-Constraints mit exakt null verwaisten Zeilen · profiles/auth.users 13:13 deckungsgleich · 186 von 186 RLS-Policies wrappen `auth.uid()` korrekt in `(SELECT …)` · alle 178 Tabellen mit RLS · 8'843 Cron-Läufe ohne einen Fehlschlag. Die Probleme sitzen nicht in den Daten, sondern daneben.

#### 🔴 BLOCKER — zwei offene Schreib-Endpunkte auf `public.species` (Owner-Aktion)

`admin-seed-species` (v3) und `species-bulk-seed` (v4) sind beide **ACTIVE mit `verify_jwt=false`**, schreiben mit dem **Service-Role-Key** an der RLS vorbei und sind nur durch **ein hartcodiertes Secret** geschützt — das im Klartext im **öffentlichen** Repo liegt, im *aktuellen Tree* von 6 gepushten Branches (`claude/lucid-cerf-3ooy72 · -XIpgp · -dfxwv7 · -dix1vr · -o5b8ie` und `claude/happy-gates-HK3zX`). Die v29-Rotation (HL#19) hat sie übersehen, weil sie **kein Repo-Verzeichnis** hatten — es gab keine Datei zum Durchsuchen.

- **Selbst nachgeprüft, nicht nur übernommen:** beide Quelltexte über die Management-API gezogen (byte-identisches Secret), Branch-Trees einzeln durchsucht (6 von 113), und **auf Missbrauch geprüft: keiner.** `public.species` = 2'838 Zeilen, genau **1** in den letzten 90 Tagen, neueste vom 02.07. Das Fenster stand offen, es ist niemand hindurchgegangen.
- **Vorbereitet:** 410-Gone-Stubs für beide im Repo, als **Schritt 0** im Runbook. Künftiges Seeding läuft über den SQL-Editor — kein dauerhaft offener HTTP-Endpunkt für eine Aufgabe, die einmal im Jahr vorkommt.

#### 🔒 Rollen-Auskunft über fremde Konten — als `anon` reproduziert

`fn_is_role(_role, _uid)` und `fn_role_at_least(_required, _uid)` sind SECURITY DEFINER (umgehen also die RLS auf `profiles`) und haben EXECUTE für `anon`. Der zweite Parameter war frei wählbar:

```
set local role anon;
select fn_is_role('admin','<uuid>');   -->  true
```

User-UUIDs stehen öffentlich in `social_posts.user_id` und `v_marketplace_listings.user_id` — **die Admin-Konten waren ohne Login aufzählbar.** Ein `REVOKE` wäre falsch: die Policies `social_posts_select_all` u. a. rufen `fn_role_at_least('staff')` auch für Gäste auf, das hätte das Gast-Browsing zerschossen. **Der Parameter war das Problem, nicht die Funktion** — Auskunft über fremde UUIDs gibt es jetzt nur noch für Staff/Admin. Geprüft: alle 16 RLS-Policies und `fn_set_global_api_key` rufen **ohne** `_uid` auf, Frontend und Edge-Functions gar nicht → bricht nichts.

#### 🔒 `quiz_answers.is_correct` kam vom Client — und entschied über ein Jahr PRO

Die Korrektheit stammte aus einem `data`-Attribut im DOM; keine Policy, kein CHECK, kein Default prüfte sie. `fn_grant_quiz_top3_pro()` (Cron jobid=23, **31.12. 23:00**) rankt danach und setzt `comp_tier='pro', comp_expires_at = now() + 1 year`. Bei insgesamt 10 echten richtigen Antworten war die Top-3-Hürde trivial — **die geringe Nutzung machte die Lücke schlimmer, nicht harmloser.** Der Kommentar in der Funktion („FK + UNIQUE = unfälschbarer Korrekt-Count") war nachweislich falsch: beide begrenzen die *Anzahl* Zeilen, nicht den *Wahrheitswert*.

- **Fix ohne Reihenfolge-Falle:** ein BEFORE-INSERT/UPDATE-Trigger leitet `is_correct` und `xp_earned` aus `daily_quizzes.options[selected_option]` ab und **überschreibt** den Client-Wert. Kein `REVOKE INSERT` nötig → alte Cache-Stände brechen nicht. `UPDATE`/`DELETE` für `anon`+`authenticated` **entzogen** (sonst wäre der Trigger per nachträglichem PATCH umgehbar; es gibt im Frontend keinen einzigen solchen Pfad).
- **Frontend-Hälfte:** der Supa-Quiz mischt die Optionen clientseitig, die angezeigte Reihenfolge ist also **nicht** die DB-Reihenfolge. Deshalb wird der DB-Index jetzt **vor** dem Mischen auf jede Option gestempelt (`_idx` → `data-idx`) und als `selected_option` mitgeschickt. Ohne Index gilt eine Antwort als nicht überprüfbar und zählt nicht — bewusst: im Zweifel nicht anrechnen.
- **Altlast ehrlich behandelt:** alle 24 bestehenden Zeilen haben `selected_option = NULL` (10 davon „richtig") und sind nachträglich **nicht** prüfbar. Die Grant-Funktion zählt sie deshalb nicht mit, statt sie zu raten.
- **Nebenbefund:** `gsAnswerSupaQuiz` (65 Zeilen) hatte **null Aufrufer** — und war die einzige Stelle, die je `selected_option` mitschickte. Genau daher stammt die NULL-Altlast. Entfernt.

#### 🐛 Die täglichen Pflege-Erinnerungen sind seit 33 Tagen still tot

`garden_tasks` pending/überfällig = 66, **alle** mit `reminded_at` von heute 07:00 → der Cron arbeitet. `notifications` kind='reminder' = 66, aber `min(created_at) = max(created_at) = 2026-07-29`. Seit 33 Tagen läuft der Job jeden Morgen grün und erzeugt **nichts**.

- **Ursache — zwei Fehler, die sich gegenseitig verstecken:** der Index ist `UNIQUE (dedup_key)` — **global**, ohne WHERE, ohne Zeitanteil, nicht einmal pro `user_id`. Der Guard in `fn_create_notification` prüft aber nur ein 60-Minuten-Fenster. Danach lässt er durch, der INSERT läuft in die `unique_violation`, und `EXCEPTION WHEN OTHERS` verschluckt sie lautlos zu `RETURN NULL`. Zusätzlich baut `fn_remind_garden_tasks` den Schlüssel **ohne Datum**. Kontrollexperiment in derselben Tabelle: `kind='plant_task'` (Schlüssel *mit* Datum) = 597 Zeilen über 75 Tage · `kind='reminder'` (ohne) = 66 Zeilen an **einem** Tag.
- **Besonders heimtückisch:** `fn_cleanup_old_data` gibt den Schlüssel nach 90 Tagen frei — der Fehler kaschiert sich selbst alle 90 Tage.
- **Fix an einer Stelle, heilt alle 5 Aufrufer:** `fn_create_notification` stellt dem Schlüssel die `user_id` voran (der global-unique Index wird dadurch pro Nutzer eindeutig — heilt zugleich `'bloom:…'` und `'quest:…'`, die bisher **zwischen** Nutzern kollidierten) und nutzt `ON CONFLICT DO NOTHING` statt einer abgefangenen Ausnahme. Fehler landen jetzt in `system_events`. `fn_remind_garden_tasks` bekommt den Datumsanteil — erst dadurch ergibt die vorhandene 20-Stunden-Drossel überhaupt Sinn.
- **Alters-Deckel 30 Tage:** die 66 offenen Aufgaben sind Testdaten eines internen staff-Kontos mit `due_at` 2023-04-01 … 2023-08-01. Ohne Deckel würden sie ab morgen täglich nagen. Unabhängig davon die bessere Produktregel.

#### 💸 KI-Kosten wurden systematisch mit CHF 0.00 gebucht

`fn_log_ai_usage`: `if p_cost_chf … elsif p_model … else v_cost := 0`. Beide Parameter haben `DEFAULT NULL` — alle fünf Edge-Functions übergaben nur `p_edge_fn/p_tokens_in/p_tokens_out` und liefen still in den else-Zweig. `knowledge-bulk-gen` hat so **111 echte Calls mit 471'430 Output-Token über 101 Tage mit 0.0000 CHF** gebucht; `fn_finance_snapshot` meldete dadurch eine um **Faktor ~7,5 zu optimistische** Deckung (95.9 statt ~12.7).

- **Code:** `p_model` in allen fünf Funktionen durchgereicht (rein additiv).
- **Gürtel zum Hosenträger:** der else-Zweig bucht nicht mehr 0, sondern konservativ zum Sonnet-Tarif und meldet einmal täglich nach `system_events`. Ein vergessener Parameter fällt damit auf, statt die Kostenrechnung still zu schönen. **Bewusst keine Nachbuchung der Vergangenheit** — geschätzte Zahlen in einer Ist-Kostentabelle wären schlimmer als die Lücke.

#### 👁 Die Cron-Überwachung war blind für alle HTTP-Jobs

`fn_monitor_health` liest ausschliesslich `cron.job_run_details`. `net.http_post` ist aber fire-and-forget: der Aufruf kehrt sofort zurück, der Lauf gilt **immer** als `succeeded` — egal ob Timeout, 403 oder 500. Beweis am lebenden Objekt: `knowledge-growth-daily` lief **21 ms** und meldete Erfolg, während `net._http_response` zeitgleich „Timeout of 50000 ms reached" verzeichnete. Die Blindheit ist total: `fn_admin_ops_digest` und `fn_admin_cron_health` hängen an derselben Quelle — **alle drei Oberflächen zeigen dieselbe falsche grüne Ampel.**

- **Fix:** zweiter Scan über `net._http_response` im selben 75-Minuten-Fenster (dedupliziert über die response-id) **plus** ein Staleness-Check für Jobs, die seit über 49 h gar nicht mehr gelaufen sind — die einzige Fehlerklasse, die sonst durch beide Netze fällt.
- **Ehrlich zur Beweislage:** im erhaltenen Fenster ist **kein** echter HTTP-Ausfall nachweisbar — der Timeout oben war ein pg_net-Client-Timeout bei erfolgreicher Arbeit (`forest_garden_design` bekam an dem Tag 11 neue Zeilen um 03:31:17). Das Risiko ist strukturell und zukünftig, nicht akut.

#### Was in diesem Commit steckt

| Datei | Wirkt |
|---|---|
| `index.html` (Quiz-Index, tote Funktion raus) | sofort mit dem Deploy |
| `supabase/functions/{admin-seed-species,species-bulk-seed}` (410-Stubs) | erst nach Deploy |
| `supabase/functions/{knowledge-bulk-gen,pest-identify,mushroom-identify,garden-scan-analyze,plant-doctor-diagnose}` (`p_model`) | erst nach Deploy |
| 4 neue Migrationen unter `supabase/migrations/20260831_*` | erst nach Anwendung |
| `scripts/apply_pending_v30_87.sh` (jetzt Stand v30.95) | führt alles davon aus |

> ⚠️ **Owner-Aktion nötig:** `deploy_edge_function` und `apply_migration` sind in der Session gesperrt. Alles ist geprüft und vorbereitet — `bash scripts/apply_pending_v30_87.sh` führt es aus. **Schritt 0 ist der Blocker.** Reihenfolge beachten: das Frontend (v30.95) muss live sein, bevor die Quiz-Migration läuft.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · alle 6 Migrationen in `BEGIN/COMMIT` gekapselt · Signaturen aller ersetzten Funktionen gegen die Live-DB geprüft (`fn_monitor_health` → `()` / `integer` / SECDEF / `search_path=public, cron, pg_catalog`) · `postgres` hat SELECT auf `net._http_response` verifiziert · Version synchron v30.95.

### 2026-08-31 (c) — v30.94: Zwei Wege, auf denen Nutzer-Texte still verschwanden

> Auftrag Fernando: „so dass die Nutzer ihre Daten immer gespeichert haben bzw. nie fehlen."
> Vorgehen: alle 65 Keys aus `GS_USER_KEYS` (werden beim Logout geleert) gegen die Sync-Pfade
> gestellt. 25 stehen in keinem LS-Blob — für 23 davon ist das korrekt, weil sie eine eigene
> Server-Quelle haben (`profiles.xp` mit atomarem `fn_add_xp` + Boot-Reconcile, `v_user_entitlements`,
> `quiz_leaderboard`, `marketplace_messages`, `feedback_items` …). Zwei Lücken blieben echt.

- **Lücke 1 — Feedback konnte still verloren gehen.** Der Push nach `feedback_items` war ein Fire-and-Forget mit `.catch(console.warn)`. Schlug er fehl (offline, 5xx, abgelaufener Token), blieb der Eintrag nur lokal und ohne `sb_id` — und weil `ps_feedback` in `GS_USER_KEYS` steht, löschte ihn der **nächste Logout ersatzlos**. Der Nutzer sah „Danke für dein Feedback", niemand bekam es je zu sehen.
  - **Neu: eine Outbox.** `_gsFeedbackPushOne()` liefert nur bei nachgewiesenem Server-Erfolg `true` (2xx ohne zurückgegebene Zeile gilt bewusst als Fehlschlag — Raten wäre schlimmer als ein zweiter Versuch). Fehlgeschlagene Einträge werden als `_push_pending` markiert.
  - `gsFeedbackFlushOutbox()` schickt sie nach — beim Start (+6 s), beim `online`-Event und **vor dem Logout-Wipe**.
  - **Ehrliche Anzeige:** solange ein Eintrag den Server nicht erreicht hat, steht „📤 Noch nicht gesendet" daneben. Vorher sah ein nur-lokaler Report exakt aus wie ein angekommener.
- **Lücke 2 — der Community-Post-Entwurf war nach einem Serverfehler weg.** `submitPost()` leerte die Textarea und schloss das Modal, *bevor* der Server antwortete. Bei Fehler wurde zusätzlich der optimistische Post entfernt — übrig blieb ein Toast. Der geschriebene Text war unwiederbringlich verloren, der Nutzer musste alles neu tippen.
  - Der Entwurf wird jetzt **vor** dem Leeren nach `gs_social_draft` gesichert, bei Erfolg verworfen, bei Fehler sofort ins wieder geöffnete Formular zurückgespielt („Dein Text ist erhalten.").
  - Auch beim nächsten Öffnen des Formulars kommt ein liegengebliebener Entwurf zurück (überlebt also App-Neustart und Absturz). Entwürfe älter als 7 Tage werden verworfen.
  - `gs_social_draft` steht in `GS_USER_KEYS` — auf einem geteilten Gerät darf der eigene Text nicht zum nächsten Konto durchsickern.
- **Geprüft und in Ordnung:** XP (`gsAddXP` spiegelt jeden Gewinn debounced und atomar über `fn_add_xp`, Boot-Reconcile in beide Richtungen), Pflanzen/Garten/State (`gsCloudSync` mit Dirty-Flags, Empty-Clobber-Guard v27.01, Count-Guard v28.22, `beforeunload`-Flush), Community-Post-Erfolgspfad (optimistisches Update mit sauberem Rollback).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.94.

### 2026-08-31 (b) — v30.93: Marktplatz-Chat erfand Antworten im Namen echter Verkäufer

- **Der Befund.** `sendChatMsg()` hängte nach jeder gesendeten Nachricht mit 60 % Wahrscheinlichkeit eine von fünf Floskeln an den Verlauf — **zugeschrieben an den echten Verkäufer-Namen** (`author: l.seller`) — und löste zusätzlich eine Benachrichtigung „💬 Neue Nachricht von \<Name\>" aus. Beim Öffnen eines Chats wurde ausserdem eine erfundene Begrüssung des Verkäufers mit Zeitstempel „vor einer Minute" eingefügt. Für den Nutzer war beides von einer echten Antwort nicht zu unterscheiden — **während seine eigene Nachricht nirgendwo ankam.**
- **Wer war betroffen.** Der Demo-Pfad greift, sobald `openMarketChat` keinen Backend-Thread starten kann. Real ist das der **ausgeloggte Besucher auf einem echten Inserat**: `loggedIn` ist falsch → Fallback → Fake-Chat mit dem echten Namen des Verkäufers. (Beide Cloud-Lesepfade liefern `user_id` korrekt mit — `v_marketplace_listings` per `select=*`, `fn_marketplace_search` als Rückgabespalte — der eingeloggte Fall landete also richtig im Backend-Chat.)
- **Der Fix — ehrliche Wege statt Illusion:**
  - Erfundene Verkäufer-Antwort und erfundene Begrüssung **ersatzlos entfernt**. Ein leerer Verlauf ist ehrlich.
  - Gast auf echtem Inserat → `_gsMarketChatLoginPrompt()`: „Um \<Verkäufer\> zu schreiben, brauchst du ein Konto — so kommt deine Nachricht auch wirklich an." mit Login-Knopf. Kein Chat-Fenster, das ins Leere führt.
  - Eingeloggt, aber Verkäufer-ID fehlt → `_gsMarketChatUnavailable()`: sagt es klar und bietet die im Inserat hinterlegte Kontaktangabe zum Kopieren an.
  - Nur noch **lokale Entwürfe** (nicht-UUID-ID, das eigene unveröffentlichte Inserat) benutzen den lokalen Chat.
- **Einmal-Bereinigung für bestehende Nutzer:** Echte Chats laufen über `marketplace_messages` und stehen **nie** in `gs_market_chats` — alles dort mit `isMe:false` ist also nachweislich erfunden und wird einmalig entfernt (Flag `gs_market_chats_purged_v3093`). Eigene Nachrichten (`isMe:true`) bleiben unangetastet.
- **`DEMO_LISTINGS` entfernt** — 49 Zeilen erfundene Inserate („PlantQueen_Zuri", „BioBauer_BE") mit **null Lesern**. Seit v28.02 sehen auch Gäste nur echte Cloud-Inserate; die Konstante war reine Altlast.
- **Gegenprobe:** kein weiterer Generator im Code, der Inhalte im Namen realer Personen erfindet (Sweep über alle `Math.random()`-Stellen mit Bezug zu Nachrichten/Namen/Posts → 2 Treffer, beide reine ID-Erzeugung).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.93.

### 2026-08-31 (a) — v30.92: Zwei Sackgassen im Erstnutzer-Pfad geschlossen (Key-Fehler + Erstnutzer-Tour)

- **Blocker: der Scan-Fehlerbildschirm war für Nicht-Admins eine Sackgasse.** Auf *jedem* Key-Fehler war der einzige Handlungsknopf `openApiKey()` — und der ist ADMIN-only (`GS_PERMISSIONS.ADMIN` enthält `api_key`). `openModal('apikey-modal')` existiert genau **einmal** in der Datei, nämlich in `openApiKey`. Für jeden normalen Nutzer hiess das: tippen → „Keine Berechtigung", und danach kein Weg vorwärts ausser die App zu schliessen.
  - **Neu `_gsKeyErrorCta(onLight)`** — ein CTA nach Rolle: **Admin** → „🔑 API-Key einrichten"; **eingeloggt** → „🔄 Nochmal versuchen" (zieht via `_gsRetryAfterKeyPull()` den globalen Key frisch nach und wiederholt den letzten Scan über `_gsRetryLastScan()`); **ausgeloggt** → „✨ Kostenlos Konto anlegen". Beide Fehlerbildschirme (Kein-Key-Karte und Hero-CTA im Fail-Screen) nutzen jetzt dieselbe Quelle, inklusive passendem Icon und Text.
  - **`analyzeImage` zieht den Key einmal nach, bevor es abbricht.** `callAI`/`callVisionAI` machen das längst mit Backoff — `analyzeImage` war die einzige Stelle, die sofort aufgab. Direkt nach dem Login gab es dadurch ein Zeitfenster, in dem der allererste Scan mit „API-Key wird benötigt" scheiterte, obwohl der globale Key Sekundenbruchteile später da war. (`const {key}` → `let {key}` + einmaliger `gsPullGlobalApiKey()`-Nachzug.)
  - **Drei weitere tote Wege zu `openApiKey()` geschlossen:** der rote Chip `sr-apikey-chip` (beim Tab-Wechsel *und* im Fehlerfall), der Knopf „🧪 Key testen" und die Benachrichtigung „API-Key Problem" erscheinen nur noch für Admins. Für alle anderen waren das Alarmknöpfe ohne Ziel — und eine Fehlermeldung über etwas, das gar nicht ihre Sache ist.
- **Die Erstnutzer-Tour startete nach einer Registrierung nie.** Sie hing ausschliesslich im Login-Pfad (`onbDoLogin`). Bei aktivem Auto-Confirm — dem Normalfall — loggt `onbDoRegister` aber **selbst** sofort ein, `onbDoLogin` wird nie durchlaufen. Folge: keine Tour, und das gesetzte `gs_first_login`-Flag blieb liegen, bis Tage später ein echter Login sie an völlig unpassender Stelle aufpoppen liess.
  - **Neu `gsRunFirstRunWelcome()`** als gemeinsame Quelle für beide Pfade: verbraucht das Flag, zeigt den Willkommens-Toast und startet die Tour nach 1.6 s.
  - **`gsTutorial.startOnce()`** liest endlich `GS_TUTORIAL_KEY` (`gs_onboarded_v1`). Der Schlüssel wurde bisher in `_close` **geschrieben, aber nirgends gelesen** — reine Dekoration. Der manuelle Neustart (Einstellungen → Tour) ruft weiterhin `start()` und ignoriert den Schlüssel bewusst.
  - Der alte 1.6-s-Timer im Login-Pfad ist entfernt, sonst wäre die Tour bei einem First-Login doppelt aufgepoppt.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.92 (index.html · meta app-version · sw.js `gs-v30.92` · `_headers`).

### 2026-08-28 (f) — v30.91: Dark-Mode-Sweep abgeschlossen (Inline-Styles) + drei Audit-Punkte als erledigt nachgewiesen

- **Dark-Mode Teil 2:** Nach dem CSS-Block (v30.90) jetzt die Inline-Styles: **141 Hintergründe + 122 Textfarben** in 235 Zeilen auf Design-Tokens. Betrifft echte Bildschirme — Marktplatz, Pilz-Scanner, Einstellungen, Farm, Community-Post, Garten-Scan.
- **Wieder pixelgleich im Hellmodus:** Die Tokens sind hell exakt die Altwerte (`--bg-success-soft` = `#e8f5e9`, `--c-brown` = `#5d4037`). Nur der Dunkelmodus ändert sich.
- **Kontrast-Regressionen konsequent nachgezogen:** Erst 22, dann nach dem zweiten Mapping-Durchgang noch 2 (`#827717` Oliv auf Gelb) — per Luminanz-Analyse (< 140) aufgespürt und geschlossen. **Endstand: 0 Dunkel-auf-Dunkel-Kombinationen in der gesamten Datei.**
- **Canvas/SVG geprüft:** Der Diff enthält keine `fillStyle`/`strokeStyle`/`<svg>`-Zeile — dort greift `var()` nicht, das wäre ein stiller Fehler gewesen.
- **⚠️ Drei „offene" Audit-Punkte nachgeprüft und als erledigt/unbegründet belegt** (neue Sektion 2a im Audit-Dokument, damit niemand Phantom-Arbeit macht):
  - **`alert()`/`confirm()` (P2-3):** faktisch erledigt. Nachgezählt: 1 `alert()` — der Notnagel *innerhalb* von `gsToast` selbst (korrekt so) — und 14 `confirm()`, **alle** in `else`-Zweigen hinter `gsConfirmModal`. Kein nativer Dialog feuert. Die alte Zahl „62× alert" kam aus einem groben grep inkl. Changelog-Strings.
  - **`garden_diary`/`client_errors` leer trotz Schreibpfad:** unbegründet. Schema live gegen den Frontend-Insert geprüft (kein Drift), RLS-Policies korrekt (`diary_owner_all`, `cerr_insert_own`). Echte Nicht-Nutzung, **kein stiller 4xx**.
  - **GSW als „live" beworben:** erledigt. Seit **v26.65** nicht mehr in `SUPPORTED`, also gar nicht auswählbar; Doku in v30.86 korrigiert.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · 0 Kontrast-Regressionen (gesamte Datei) · Token-Definitionen frei von `var()` · keine Canvas/SVG-Zeile berührt · Version synchron v30.91.

### 2026-08-28 (e) — v30.90: Dark-Mode-Sweep im CSS-Block (Badges/Status-Pillen auf Design-Tokens)

- **Auftrag/Kontext:** Offener P2-Punkt aus dem Audit: hartcodierte helle Farben ohne `body.dark`-Override → grelle Flecken im Dunkelmodus. Gesamt-Scan fand 459 Treffer.
- **Vorgehen bewusst eng gefasst:** nur der zentrale `<style>`-Block (Zeilen 198–1594). Eine CSS-Regel wirkt auf viele Fundstellen — deutlich sicherer als 459 Inline-Edits. `:root`/`body.dark`-Token-**Definitionen** (81–197) ausgenommen, sonst Zirkelbezug; `body.dark`-Overrides ausgenommen, die behalten ihre expliziten Werte.
- **Pixelgleich im Hellmodus:** Die Soft-Tokens sind hell exakt die bisherigen Werte (`--bg-success-soft: #e8f5e9`, `--c-info: #1565c0` …). Der Tausch ändert also im Hellmodus **nichts** und wirkt nur im Dunkelmodus (dort `rgba(102,187,106,.12)` statt `#e8f5e9`). 43 Hintergründe + 20 Textfarben auf Tokens umgestellt.
- **⚠️ Selbst eingebaute Regression gefunden und behoben:** Nach dem ersten Durchgang standen **17 dunkle Textfarben** (z.B. `#2d7a2d`, `#1565c0`, `#bf5600`) auf jetzt-dunklem Grund → im Dunkelmodus **schlechterer** Kontrast als vorher. Per Luminanz-Analyse (< 140) aufgespürt und 15 davon ebenfalls auf Tokens gemappt, die im Dunkelmodus aufhellen (`--c-info` hell `#1565c0` → dunkel `#42a5f5`). Gegenprobe: **0 verbleibende Dunkel-auf-Dunkel-Kombinationen**.
- **Kleine bewusste Farbdrift im Hellmodus** (marginal, zugunsten der Dark-Mode-Lesbarkeit): `#bf5600`→`--c-warn-d` (#e65100), `#7b1fa2`→`--c-purple` (#6a1b9a), `#e53935`→`--c-danger` (#c62828). Die übrigen Mappings sind identisch oder praktisch identisch.
- **`border-color` bewusst ausgenommen** — der erste Regex-Entwurf hätte `border-color:` mitgetroffen (das `\bcolor:` matcht nach dem Bindestrich). Mit `(?<!-)` ausgeschlossen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Token-Definitionen frei von `var()` (kein Zirkelbezug) · 0 verbleibende harte Hell-Hintergründe im CSS-Block · 0 Kontrast-Regressionen · Version synchron v30.90.
- **Rest:** Inline-Styles in JS-Templates (der grössere Teil der 459) bleiben offen — die sind einzeln zu prüfen, weil dort auch Canvas-/SVG-Kontexte vorkommen, in denen `var()` nicht greift.

### 2026-08-28 (d) — v30.89: Overlay-Rettungsleine auf 22 weitere Dialoge ausgeweitet (inkl. „friert ein"-Ursache)

- **Warum:** In v30.85 hingen erst 2 von 31 dynamischen Overlays an der Rettungsleine. Die übrigen konnten denselben Bug auslösen, den der User zweimal gemeldet hat („beim Tippen kommt nur noch Konto löschen").
- **Wahrscheinliche Ursache des gemeldeten „friert ein" gefunden:** `gsConfirmModal` und `gsPromptModal` geben ein **Promise** zurück. Wird so ein Dialog nur aus dem DOM entfernt, ohne dass `finish()` läuft, **wartet der aufrufende Code für immer** — die Funktion wirkt eingefroren. Beide sind jetzt mit `onDismiss`-Callback registriert (`finish(false)` bzw. `finish(null)` = abgebrochen); der vorhandene `done`-Guard verhindert Doppel-Auflösung.
- **20 weitere Dialoge registriert** (skriptgesteuert, von hinten eingefügt damit Zeilennummern stabil bleiben): achievements-modal, gs-gallery-overlay, modal-mushroom-lookalikes, gs-scan-tips-modal, modal-shot-preview, gs-loc-pick, plant-diary-modal, verify-post-modal, gs-conn-test-modal, modal-plan-3dcad, photo-timeline-modal, voice-mode-modal, modal-saved-plans, modal-agent, gs-global-key-admin, gs-conn-detail, gs-storage-modal, gs-univ-modal, gs-export-modal, gs-wx-overlay.
- **Bewusst NICHT registriert** (und gegengeprüft, dass sie unangetastet blieben): `gs-mushroom-danger` (sicherheitskritischer Gift-Warnschirm — MUSS aktiv bestätigt werden, ein Wegräumen per Navigation wäre gefährlich) · `gs-tutorial` / `gs-auth-pflicht-modal` (Onboarding- und Pflicht-Gates) · `saison-pilze-screen` / `gs-plans-screen` / `tree-planner-screen` (Vollbild-Screens, keine Dialoge).
- **Methodik:** Skript prüfte je Dialog, dass die Variable im `.id =` und im `appendChild()` übereinstimmt — ein Kandidat (`gs-gal-species-ov`) hatte kein passendes `appendChild` und wurde übersprungen statt geraten.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Ausschlüsse per grep gegengeprüft · Stichproben (plant-diary-modal `var=m`, gs-wx-overlay `var=ov`) auf korrekte Platzierung und Einrückung geprüft · Version synchron v30.89.
- **Rest:** 9 Overlays bleiben bewusst ohne Rettungsleine (Begründung oben). Backend-Arbeiten weiterhin über `scripts/apply_pending_v30_87.sh` (Schreibzugriff der Session gesperrt).

### 2026-08-28 (c) — v30.88: 6 tote Stripe-Setup-Funktionen stillgelegt + Secret-Rotation dokumentiert

- **Auftrag:** „Stripe-Webhook-Secret rotieren und die obsoleten Stripe-Setup-Funktionen löschen/stilllegen — mach du das bitte."
- **Stripe-Secret-Rotation — bewusst NICHT ausgeführt, mit Begründung:** In dieser Session ist (a) kein Stripe-Zugriff verbunden und (b) der Supabase-Schreibzugriff gesperrt. Entscheidender Punkt: Zwischen dem Rotieren in Stripe und dem Speichern des neuen Secrets in `app_settings` schlägt **jede** Webhook-Signaturprüfung fehl — in diesem Fenster landen Abo-Wechsel, Zahlungen und Kündigungen nicht mehr in der DB. Halb ausgeführt wäre also schlimmer als gar nicht. Stattdessen: **präzise 5-Schritt-Anleitung im Skript** — inkl. Sicherung des Alt-Werts als Rückweg, Hinweis auf die Übergangsfrist („Roll secret, expire in 24h" → gar kein Ausfallfenster), Vorrang-Falle `STRIPE_WEBHOOK_SECRET`-Env vor `app_settings`, und Verifikation über Stripe-Test-Webhook + `stripe_events`.
- **6 tote Stripe-Setup-Funktionen stillgelegt (P1-1):** `stripe-restructure-pro-only`, `stripe-import-fernando-sub`, `stripe-complete-setup`, `stripe-final-audit`, `create-checkout`, `customer-portal`. Alle waren **ACTIVE mit `verify_jwt:false`**, also für jeden im Internet aufrufbar — vier davon mutieren echte Stripe-Daten. Jetzt 410-Gone-Stubs im Repo (Muster `stripe-setup-webhook`), reine Antwort ohne Code und ohne Secrets.
- **Vor der Stilllegung verifiziert:** 0 Aufrufe aus `index.html` · 0 Referenzen in `cron.job`. Gegenprobe, dass die aktiven Fns (`stripe-checkout`, `stripe-portal`, `stripe-webhook`) unangetastet blieben.
- **⚠️ Eigener Audit-Fehler korrigiert:** `key-health-check` stand auf meiner Totliste — sie wird aber von einem **Cron-Job täglich um 03:00** aufgerufen (`key-health-daily`) und ist NICHT tot. Wäre sie mit gestubbt worden, hätte das die tägliche Schlüssel-Überwachung abgeschaltet. Im Audit-Dokument richtiggestellt.
- **Skript erweitert:** `scripts/apply_pending_v30_87.sh` hat jetzt Schritt 4/4 (Stilllegung) + Prüf-`curl`, der 410 erwartet.
- **Verify:** `bash -n` OK · alle 6 Stubs enthalten `status: 410` · keiner enthält Logik/Secrets (grep auf `createClient`/`sk_live`/`ADMIN_SECRET` leer) · aktive Fns unverändert · Version synchron v30.88.

### 2026-08-28 (b) — v30.87: P0-3 `send-push` gehärtet + Ausführungs-Skript für alle offenen Backend-Arbeiten

- **Auftrag:** „Volle Freigabe — mache alles perfekt und sauber, rebuild mit den Verdrahtungen die es braucht."
- **Ehrliche Einordnung zur Freigabe:** Die Schreibzugriffe auf Supabase (`apply_migration`, `deploy_edge_function`) werden vom **Werkzeug-Berechtigungssystem** dieser nicht-interaktiven Cloud-Session blockiert — das lässt sich nicht per Zuruf freischalten. Deshalb: alles fertig vorbereitet + geprüft, Ausführung als Ein-Befehl-Skript.
- **P0-3 · `send-push` gehärtet (letzte offene P0-Lücke):** v2 las Rolle und User-ID aus dem **unsignierten** JWT-Payload und akzeptierte `authHdr.includes(SERVICE_ROLE)` — einen Substring-Test auf einen Vollmacht-Schlüssel — als Service-Nachweis. Geschützt war das **einzig** durch das Gateway-Flag `verify_jwt:true`; ein Dashboard-Klick hätte daraus einen offenen Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht. Neu `authenticate()`: Constant-Time-Compare des vollen Keys **oder** `sb.auth.getUser(token)` (serverseitig signaturgeprüft), fail-closed 401. Admin-Broadcast-Check + 500er-Cap unverändert. Patch sitzt auf der **Live-Quelle** (v2 abgeholt), nicht auf einer veralteten Repo-Kopie.
- **Ausführungs-Skript `scripts/apply_pending_v30_87.sh`:** wendet in einem Lauf an — 2 Migrationen (Wissen v30.84, Quiz-Bilder v30.85) + 3 Edge-Functions (mushroom-identify, pest-identify, send-push). Mit Vorabprüfung, Rückfrage vor Produktiv-Zugriff, `set -euo pipefail` und Verifikations-Abfragen am Ende (inkl. curl-Test, der ein **gefälschtes** Token gegen send-push wirft und 401 erwartet).
- **Fallstrick vermieden — `supabase db push` wäre falsch gewesen:** Das Migrations-Register der DB nutzt 14-stellige Zeitstempel (`20260827073101`), die Repo-Dateinamen weichen ab (`v30_32_*.sql`). `db push` hätte Dutzende **bereits angewandte** Migrationen für ausstehend gehalten und erneut angestossen. Das Skript spielt deshalb gezielt nur die zwei neuen Dateien ein (psql oder Dashboard-SQL-Editor), mit Begründung im Kopf.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Skript `bash -n` OK · alle referenzierten Dateien existieren · `decodeJwt`/`includes(SERVICE_ROLE)` in send-push nur noch im Erklär-Kommentar, kein ausführbarer Pfad · Version synchron v30.87.
- **Danach noch offen (nur Dashboard):** Leaked-Password-Protection aktivieren · Stripe-Webhook-Secret rotieren · obsolete Stripe-Setup-Edge-Fns löschen/stubben (P1-1).

### 2026-08-28 — v30.86: Offene Audit-Punkte abgearbeitet (Secret redigiert, Overlays gehärtet, GSW ehrlich gemacht, Dark-Mode)

- **Auftrag:** „Baue es weiter auf und löse alle Probleme sauber." → die offene P1/P2-Liste aus `FULL_STACK_AUDIT_v30.81.md` abgearbeitet, soweit ohne DB-Freigabe möglich.
- **P1-2 · Geleaktes Secret redigiert:** Das `whsec_`-Prefix eines Stripe-Webhook-Signing-Secrets stand im Klartext in `AUFTRAG_v25.4_AUTH_TRIAL_ABO.md:270`. Aus HEAD entfernt (`whsec_***REDACTED***`) — **und ebenso aus meinem eigenen Audit-Dokument**, das den Wert zitiert und den Leak damit selbst weitergetragen hätte. Verifiziert: der echte Prefix kommt in HEAD nicht mehr vor. **Rest-Aufgabe Owner:** Secret in Stripe rotieren; History-Purge nur nötig, falls das Repo je public wird.
- **Overlay-Rettungsleine ausgebaut (Fortsetzung des v30.85-Bugs):** Ein Scan fand **31 dynamisch erzeugte Vollbild-Overlays**, von denen nach v30.85 noch **29 ohne jeden zentralen Ausweg** waren. Neu: kuratierte Liste `GS_DISMISSIBLE_OVERLAYS` (25 Dialoge), die beim Navigieren aufgeräumt werden. **Wichtig gelöst:** `_gsCloseOverlayGracefully()` klickt bevorzugt den **eigenen** Abbrechen-/Schliessen-Knopf des Dialogs, statt das Element wegzureissen — sonst hätten die Promise-basierten `gsConfirmModal`/`gsPromptModal` ihr Versprechen nie aufgelöst und den aufrufenden Code für immer hängen lassen.
- **Bewusst NICHT auto-schliessbar** (mit Begründung im Code): `gs-mushroom-danger` (sicherheitskritische Giftpilz-Warnung — muss aktiv bestätigt werden), `gs-auth-pflicht-modal` (absichtliche Anmelde-Schranke), `gs-tutorial` (eigene Schritt-Logik), sowie die drei Vollbild-*Screens*. Per Skript gegengeprüft.
- **P1-4 · GSW ehrlich gemacht:** Befund war ungenauer als gedacht — Schweizerdeutsch steht **gar nicht** in der Sprachauswahl (die bietet DE/EN/FR/IT/ES). Es war also kein kaputtes Feature, sondern ein **falsches Versprechen in README + ROADMAP**. Beide korrigiert; GSW als P3-Kandidat mit ehrlicher Nutzen-Einschätzung eingeordnet (DE deckt die Deutschschweiz ab; maschinelles GSW klingt schnell unfreiwillig komisch → Stichprobe vor Seeding).
- **Toter Code entfernt:** `gsAutoLogin()` — wurde nirgends aufgerufen und stieg ohnehin sofort mit `if (!window.supabase) return;` aus. Ersetzt durch einen Kommentar, der auf den echten Auth-Pfad zeigt, damit künftige Audits nicht wieder darüber stolpern. Die zweite `window.supabase`-Stelle (`authToken`-Fallback) **bleibt** — sie ist ein bewusster, dokumentierter Notfall-Rückfall.
- **P2-2 · Dark-Mode:** 9 hardcodierte helle Flächen ohne Token ersetzt — 3 CSS-Klassen (`.td` Avatar-Platzhalter, `.post-action:active`, `.farm-quest-prog` Fortschrittsbalken) und 6 gut sichtbare Inline-Stellen (Menü-Symbole, Pflanzenkarten-Foto-Platzhalter, Foto-Hero, Archiv-Badge). Alle auf `var(--surface2)` / `var(--muted)`. Vorher prüft: nur die Chat-Blase hatte bereits eine `body.dark`-Korrektur.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Ausnahmeliste per Skript gegengeprüft · Secret-Redaktion per grep verifiziert · Version synchron v30.86.
- **Weiterhin offen (brauchen Freigabe/Owner):** 2 Migrationen (v30.84 Wissen, v30.85 Quiz-Bilder) · 2 Edge-Fn-Deploys (KI-Kostenschutz) · P0-3 `send-push` (gleiches unsignierte-JWT-Muster) · P1-1 obsolete Stripe-Setup-Fns · P1-3 Leaked-Password-Protection (1 Dashboard-Klick) · Stripe-Secret-Rotation · restliche ~36 hardcodierte Hex-Farben.

### 2026-08-27 (f) — v30.85: Overlay-Rettungsleine (User-Bug) + Glocke + Aufgaben-Notizzettel + Quiz-Bildfragen

- **User-Bug (2× gemeldet, jetzt richtig getroffen):** „Menü → XP-Balken → ich lande im Home, und beim Tippen auf die Navigation kommt nur noch *Konto wirklich löschen*. Manchmal wechselt es in den Admin-Modus und friert ein."
- **Echte Ursache (die v30.83-Analyse lag daneben):** „Konto wirklich löschen?" ist die Überschrift des **Bestätigungs-Dialogs** `#delete-account-modal`, nicht des Profils. Dieser Dialog wird per `createElement` gebaut, an `<body>` gehängt, liegt auf `z-index 99999` (Tab-Leiste: 1500) — und wird von **nichts** zentral geschlossen: nicht von `closeModal`, nicht von Escape, nicht beim Tab-Wechsel. Wer nicht exakt „Abbrechen" oder den Rand trifft, sitzt fest; jeder weitere Tap landet auf diesem Overlay. **Scan ergab 53 solcher handgebauter Vollbild-Overlays** — das erklärt auch das „Einfrieren" im Admin-Modus.
- **Fix (systemisch, v30.85):** Neue Rettungsleine `gsRegisterOverlay()` / `gsDismissOverlay()` / `gsDismissOrphanOverlays()`. Registrierte Overlays sind IMMER auf drei Wegen verlassbar: ✕-Knopf, Escape, **jeder Navigations-Wechsel** (`switchTab` räumt auf). Optionaler `onDismiss`-Callback, damit Promise-basierte Dialoge (z.B. `gsConfirmModal`) sauber auflösen statt zu hängen. Angewandt auf `delete-account-modal` + `change-pw-modal`, plus sichtbarer ✕ im Lösch-Dialog.
- **Benachrichtigungen bekommen einen eigenen Platz (User-Wunsch):** 🔔-Glocke fest in der Kopfleiste mit eigenem Badge — zählt **Aufgaben + Mitteilungen zusammen** und öffnet direkt das Notification-Center. Vorher war das Center nur über Menü → Panel → „Alle anzeigen" erreichbar (drei Schritte, versteckt). `gsRenderBellBadge()` hängt an `gsRenderNotifBadge()`, bleibt also automatisch synchron.
- **Aufgaben-Notizzettel bei „Meine Pflanzen" (User-Wunsch):** Klebt als Merkzettel am rechten Rand (Papieroptik, leicht geneigt), zeigt die Anzahl offener Aufgaben, klappt beim Tippen auf (`gsToggleTaskNote`), Abhaken läuft über `gsNcDoneTask` → `gsQuickDone` (echtes Erledigen inkl. Cloud-Sync) → landet im Archiv-Tab „Erledigt". Erscheint nur auf dem Pflanzen-Tab und nur bei offenen Aufgaben.
- **Quiz: Bildfragen + 42 neue Fragen** (`20260827_quiz_bilder_und_fragen_v30_85.sql`, Anwendung offen): Schema um `image_url`/`image_credit`/`image_alt` erweitert · `fn_get_daily_quiz` liefert die neuen Spalten (Rückgabe-Signatur geändert → DROP+CREATE, Rechte für anon/authenticated neu gesetzt) · 43 Fragen, davon **12 mit Foto** (Wikimedia Commons). Frontend rendert das Bild statt des Emojis, URL gefiltert durch `_gsSafeUrl`, bei Ladefehler stiller Rückfall aufs Emoji.
- **Migration-Fallstrick vermieden:** Ein `UNIQUE INDEX` auf `daily_quizzes(question)` wäre gescheitert — die Tabelle enthält **bereits 2 doppelte Fragetexte**. Löschen ist heikel (FKs aus `daily_quiz_history`/`quiz_answers`). Die Migration fasst deshalb keine Bestandsdaten an und filtert per `NOT EXISTS` selbst → wiederholbar. Muster live gegen die echte Tabelle getestet.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Migration strukturell geprüft (Klammer-Balance, keine offenen Literale) · **alle 43 Fragen: genau 1 richtige Antwort, ≥2 Optionen, Label+Erklärung vollständig** · Version synchron v30.85.
- **Offen:** 2 Alt-Duplikate in `daily_quizzes` aufräumen · übrige 51 handgebaute Overlays schrittweise an die Rettungsleine hängen · beide Migrationen (v30.84 Wissen, v30.85 Quiz) + 2 Edge-Fn-Deploys brauchen DB-Freigabe.

### 2026-08-27 (e) — v30.84: Wissens-Ausbau (Bauernregeln, Wusstest-du, Gartenwissen) + Optik-Fix

- **Auftrag:** „Füge mehr Wissen hinzu — Bauernregel des Tages, Wusstest du? Und Gartenwissen optisch verbessern + auffüllen."
- **Live-Befund vor dem Ausbau:** `traditional_garden_wisdom` 82 Zeilen, aber pro Monat sehr ungleich — **Januar 11, Dezember 11, Februar 14**. Bei 31 Tagen wiederholt sich die „Bauernregel des Tages" im Winter also alle ~11 Tage. `did_you_know_facts` 162 Zeilen, aber Kategorien **doppelt in DE und EN** (pilz/pilze/fungi, baum/trees, heilpflanze/heilpflanzen, fauna/animals, flora/plants, ecology/oekologie) → Filter-Dropdown unbrauchbar. `garden_techniques` 161 Zeilen, davon nur **20 mit Emoji**.
- **Migration `20260827_wissen_ausbau_v30_84.sql` (im Repo, Anwendung offen — DB-Schreibzugriff braucht Freigabe):** +34 Bauernregeln mit Schwerpunkt Nov–Feb (jede mit ehrlicher Einordnung `wissenschaftlich_bestaetigt` / `tendenziell_richtig` / `umstritten` / `aberglaube_widerlegt` statt unkritischer Folklore) · +40 „Wusstest du?"-Fakten mit CH-Bezug · Kategorie-Normalisierung DE/EN · `UNIQUE INDEX` auf `did_you_know_facts(title)` (Tabelle hatte nur PK auf id → Migration wäre sonst ein Duplikat-Generator; live geprüft: 0 bestehende Doppel) · Emoji-Auffüllung je Kategorie.
- **Gartenwissen-Optik (ausgeliefert):** Die Technik-Karten zeigten **englische Rohwerte** in deutscher UI — `easy`/`expert` als Schwierigkeit, `pest_control`/`mulching` im Kategorie-Filter. Neu: `_gsKbCatLabel()` + `_gsKbDiffLabel()` übersetzen beides, Schwierigkeit als **farbiges Badge** (grün/gelb/rot/violett), Kategorie als grünes Badge.
- **Verstecktes Wissen sichtbar gemacht:** **141 von 161** Techniken haben Werkzeug-Angaben (`tools`), die nie gerendert wurden — jetzt als 🧰-Zeile, zusammen mit 📅 Saison. Reines Freilegen vorhandener Daten, ohne neue Abfragen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.84 · Migration idempotent (ON CONFLICT auf slug bzw. title).
- **Nächste:** Migration anwenden (dann Bauernregeln Jan/Dez von 11 → ~19, Fakten 162 → 202) · restliche Kategorie-Labels prüfen · Dark-Mode-Sweep.

### 2026-08-27 (d) — v30.83: XP-Balken-Falle behoben + 4 Cross-User-XSS geschlossen + 2 KI-Kostenschutz-Deploys

- **User-Bug (sehr ärgerlich, zu Recht):** „Ich klicke auf den XP-Balken, dann kommt beim Antippen der Navigation nur *Konto löschen*."
- **Root-Cause:** Das Profil-Sheet (`#modal-profile`) liegt auf `z-index:4000`, die Tab-Leiste `.tabs` auf `1500` — das Sheet deckt die Navigation vollständig ab. Da es unten andockt (`align-items:flex-end`), lagen die **letzten** Buttons der Profil-Liste („🗑️ Konto löschen", „🚪 Abmelden") exakt auf der Bildschirmposition der Navigation. Der Griff zur Navi traf den Löschen-Button. **Kein Datenverlust möglich** — der Löschdialog verlangt das Eintippen von `LÖSCHEN`.
- **Fix (v30.83):** (1) Destruktive Aktion in ein zugeklapptes `<details>` („⚠️ Erweitert — Konto dauerhaft löschen") verschoben → nicht mehr versehentlich erreichbar; (2) Reihenfolge korrigiert (Abmelden vor Gefahrenzone); (3) Sicherheits-Spacer `height:calc(var(--tab-h)+var(--sb))` am Listenende → **kein** Button liegt mehr in der Navi-Zone.
- **XSS-Tiefen-Sweep nachgeholt (4 echte Cross-User-Lücken, alle behoben):** Community-Funde-Zähler (`species_name` fremder Funde, ungeescaped im innerHTML) · Karten-Popup-Fotos (2 Pfade) · Marktplatz-`certification_label` im `title`-Attribut · Marktplatz-Bilder (3 Stellen). Helfer `_esc()` um `"`/`'` gehärtet (wurde in Attribut-Kontexten genutzt) + neuer `_gsSafeUrl()` (nur `https?://`/`data:image/`, Quote-Escape, blockt `javascript:`). Verifiziert: echte Storage-URLs und `data:image/jpeg`-Uploads passieren unverändert.
- **Backend P0 live deployed:** `i18n-translate` **v5** — der Gate las die Rolle aus dem **unsignierten** JWT-Payload (bei `verify_jwt=false` = jeder konnte `service_role` fälschen → unbegrenzte Anthropic-Kosten). Jetzt: Constant-Time-Compare des vollen Service-Keys **oder** echte Signaturprüfung via `auth.getUser()`. Verifiziert: `decodeJwt` ist aus der deployten Quelle verschwunden.
- **`mushroom-identify` / `pest-identify`:** In-Code-User-Verifikation + `fn_check_rate_limit` (30/h, fail-open) ergänzt. **Wichtig:** Die Repo-Kopien waren **veraltet** (ohne das v26.50-`fn_log_ai_usage`-Logging) — ein Deploy daraus hätte Backend-Arbeit zurückgerollt. Beide Dateien wurden auf den **Live-Stand + Patch** neu geschrieben und sind jetzt repo↔deploy-synchron.
- **Audit-Korrektur (Ehrlichkeit):** Die Meldung „7 doppelte DOM-IDs" in `FULL_STACK_AUDIT_v30.81.md` war **falsch** — das Skript zählte `id="…"` in Changelog-Strings mit. Echte Duplikate: **3**, alle harmlos (exklusive Render-Pfade). `main-tabs`/`screen-more`/`plant-name` waren False Positives. Dokument korrigiert.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Escape-Helfer per Unit-Test geprüft (javascript: blockiert, Quote-Ausbruch neutralisiert) · Version synchron v30.83.
- **Nächste:** P0-3 `send-push` (gleiches unsignierte-JWT-Muster, aktuell nur durch Gateway-Flag geschützt) · P1-1 obsolete Stripe-Setup-Fns stubben · P1-3 Leaked-Password-Protection (1 Dashboard-Klick) · P1-4 GSW seeden oder Versprechen zurücknehmen · Dark-Mode-Sweep.

### 2026-08-27 (c) — v30.82 RIESEN-AUDIT + Notfall-Doku (P0-Sicherheitsluecke gefunden)

- **Auftrag:** User: „Mache ein riesengrosses Audit und filtere alle Luecken (Sicherheit, fehlendes Wissen, Optik, alles weitere) — pingelig alles hinterfragen. Speichere alles auf der Festplatte ab, so dass man alles findet falls der Laptop nicht funktioniert."
- **Neue Doku (dauerhaft im Repo = laptop-unabhaengig auf GitHub):**
  - **`FULL_STACK_AUDIT_v30.81.md`** — Voll-Audit mit Ampel, 12 priorisierten Massnahmen, Belegen (Zeilennummern/Live-DB-Zahlen).
  - **`DISASTER_RECOVERY.md`** — Wiederherstellung nach Laptop-Verlust: 4-Saeulen-Modell (GitHub/Supabase/Cloudflare/Stripe), Clone-Anleitung, DB-Dump-Prozedur, Secret-/2FA-Checkliste, Bus-Faktor.
- **🔴 P0-FUND (verifiziert am Quellcode):** `i18n-translate` (`verify_jwt:false`) prueft Auth via `decodeJwt()` — das **base64-decodiert den JWT-Payload OHNE Signaturpruefung** (`index.ts:24-46`). Jeder anonyme Aufrufer kann `role:"service_role"` faelschen → **unbegrenzte Anthropic-Kosten auf Owner-Rechnung**. Gleiches Muster in `send-push` (dort nur durch `verify_jwt:true` gedeckt). Fix ist Cowork-Domaene (Edge-Fn-Redeploy) — im Audit dokumentiert.
- **🔴 P0-2:** `mushroom-identify` + `pest-identify` — Anthropic-Vision mit service-role-Client, **keine In-Code-Auth, keine Quota/Rate-Limit**. Vorbild-Muster existiert bereits (`ai-proxy`: tier-basierte Quota; `garden-scan-analyze`: `fn_check_rate_limit`).
- **🟠 P1:** 9/18 `verify_jwt:false`-Edge-Fns haben **keinen Quellcode im Repo** (4 davon live Stripe-mutierende „DEAD-CODE"-Setup-Tools, weiterhin ACTIVE) · geleaktes (rotiertes) `ADMIN_SECRET` in Git-History + `whsec_`-Prefix in `AUFTRAG_v25.4_*.md:270` · Leaked-Password-Protection weiterhin aus.
- **🟠 Wissens-Luecke:** **GSW (Schweizerdeutsch) = 0 Uebersetzungen** in `i18n_translations` (fr/it je 2050, en/es je 2041) — obwohl README/ROADMAP/CLAUDE.md „DE/FR/IT/GSW live" versprechen. Entweder seeden oder Versprechen zuruecknehmen.
- **🟢 Gesund bestaetigt:** 178/178 Tabellen RLS · **0 Security-ERROR-Advisors** (145 Lints: 140 WARN by-design SD-Fns, 5 INFO) · 0 SD-Fns mit mutable search_path · Frontend-Escaping-Disziplin (`escHtml`/`ed`/`gsSanitize`) in Stichproben sauber · Stripe-Webhook HMAC-verifiziert + Replay-Dedup · `delete-user` korrekt uid-gated.
- **Direkt gefixt (v30.82):** CSP `script-src` von 3 CDNs auf die **eine real genutzte** eingegrenzt (`cdnjs` fuer pdf.js) — `unpkg`/`jsdelivr` waren seit dem Leaflet-Self-Host (v25.36) ungenutzte Angriffsflaeche; ebenso `unpkg` aus `style-src` entfernt. Verifiziert: kein einziger echter Load von beiden Hosts.
- **Weitere Funde (dokumentiert, nicht gefixt):** 7 doppelte DOM-IDs (`plant-name` x3, `main-tabs` x2 …) · 3'872 hardcoded Hex-Farben (Dark-Mode-Luecken) · 16 `alert()` + 34 `confirm()` · toter Code (`window.supabase` x9, `gsBrain` x62, `quiz_ranking`-Tabelle).
- **Ehrliche Abdeckungs-Notiz:** Der erschoepfende XSS-Sweep (668 `innerHTML`-Sites) und der komplette Dark-Mode-Sweep wurden vom Org-Monats-Spend-Limit gestoppt → als Follow-up in `FULL_STACK_AUDIT_v30.81.md §8` festgehalten.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Version synchron v30.82 (GS_VERSION/sw.js/_headers/meta) · CSP-Aenderung gegen echte Loads gegengeprueft.
- **Naechste:** P0-Fixes an Cowork (i18n-translate + 2x Rate-Limit + send-push) · GSW-Entscheid · doppelte DOM-IDs · Dark-Mode-Sweep.

### 2026-08-27 (b) — v30.81 Notification-Center: wieder aufrufbare Inbox + abhakbare Aufgaben (Meine Pflanzen + Menü redesigned)

- **Auftrag:** User-Feedback nach v30.80: „Bei Meine Pflanzen und im Menü sieht das mit den Benachrichtigungen hässlich/unprofessionell aus. Man soll sie nochmals aufrufen können. Aufgabenfeld zum Abhaken mit Archiv. Alles eine grosse Stufe besser — smoother, intelligenter."
- **Live-DB-Befund (Kern des Hässlich-Problems):** 348 ungelesene `plant_task`-Zeilen bei einem aktiven User — der 07:00-Checker erzeugt PRO TAG eine neue Zeile pro fälliger Aufgabe (dedup_key `plant_<id>_<task>_<datum>`). Die v30.80-Inbox zeigte diese Wand ungefiltert.
- **Neues Notification-Center (`gsOpenNotifCenter`, Modal `#modal-notif-center`):** Bottom-Sheet im App-Muster, Tabs **Neu/Erledigt**. Neu = abhakbare Aufgaben (live aus `myPlants` via `gsGetDueTasks` — EINE Zeile pro Aufgabe statt eine pro Tages-Push) + Mitteilungen mit Tages-Gruppierung (Heute/Gestern/…). Erledigt = Pflege-Verlauf aus `p.diary[]` + gelesene Mitteilungen → alles jederzeit wieder aufrufbar.
- **Abhaken ist funktional, nicht kosmetisch:** ✓ ruft `gsQuickDone` (lastDone→now, `fn_plant_task_done`-RPC, Diary, Cloud-Blob-Sync, Reminder-Rows gelesen) — Checker pusht die Aufgabe danach nicht wieder. Häkchen-Kreis-Animation + Slide-out.
- **Intelligente Hygiene:** `gsNcCleanupTaskRows` markiert die Tages-Push-Duplikate (plant_task/plant_task_pre/reminder, unread) server-seitig gelesen (max 1×/6h) — die 348er-Wand verschwindet für jeden User beim ersten Öffnen. `gsCollectNotifs` blendet Task-Kinds als Inbox-Zeilen aus (live in Aufgaben-Liste vertreten).
- **Semantik getrennt:** Badge-Quittierung (`gsNotifAckBadge`, beim Menü-Schliessen, `badgeAckTs` + Migration von den alten seen-Keys) ≠ Archivieren (explizit per Item-✓ oder „Alle ✓"). Einträge verschwinden nicht mehr durch blosses Menü-Öffnen (v30.80-Schwäche behoben). Badge zählt fällige Aufgaben (bis zum ersten Blick des Tages) + echte Neuigkeiten.
- **Menü-Panel kompakt:** max 3 Aufgaben (abhakbar) + 3 Mitteilungen + „Alle anzeigen →"; leerer Zustand = schlanke Verlauf-Brücke statt verschwundenem Panel.
- **Meine Pflanzen redesigned:** Due-Cards als To-do-Rows mit Abhak-Kreis, präzise Fälligkeit („Seit N Tagen überfällig" statt „Jetzt fällig!"), Header „📋 Aufgaben (N)" + 🕘-Verlauf-Button ins Center; alle hardcoded Hex-Farben (#ffcdd2/#fff8e1/#e65100) → Design-Tokens (Dark-Mode jetzt korrekt).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Version synchron v30.81 (GS_VERSION/sw.js/_headers/meta) · kein DB-Change nötig (nutzt bestehende RPCs/Tabellen).
- **Nächste:** Am Gerät testen (Abhaken → kein Re-Push am Folgetag) · i18n-Keys für neue Strings (tasks_heading/due_since_prefix/due_overdue/due_today) in `i18n_translations` ergänzen (Cowork) · ggf. Snooze-Optionen (2/7 Tage) im Center.

### 2026-08-27 — v30.80 Bugfix-Sprint: Quiz-Rangliste (Race-Condition) + Benachrichtigungen professionalisiert

- **Auftrag:** User-Bug-Report: (1) "Quizrangliste aktualisiert sich nicht — richtige Antwort, aber gleich viele Punkte." (2) "Benachrichtigungen wirken gebastelt, nicht professionell smooth — mach es wie bei anderen Apps."
- **Root-Cause Quiz (Live-DB-verifiziert):** `fn_quiz_leaderboard_upsert` zählt server-seitig aus `quiz_answers` (Anti-Cheat, korrekt) — aber der Client-Push ist 500ms-debounced, während der `quiz_answers`-INSERT erst in einem 800ms-setTimeout läuft → der Upsert zählte VOR dem Insert (Beweis: lb.updated_at 09:54:14.879 < answers.created_at 09:54:15.197). GREATEST() hielt danach den alten Wert → Rangliste eingefroren.
- **Fix Quiz (Migration `20260826_quiz_leaderboard_race_fix.sql`, LIVE applied):** AFTER-INSERT-Trigger auf `quiz_answers` aktualisiert das Leaderboard atomar in derselben Transaktion + Backfill aller eingefrorenen Zeilen (6/6 verifiziert konsistent). Client: Leaderboard-Push/Refresh erst NACH dem Insert (`.then`) · 2 tote `window.supabase`-Pfade (Home-Tagesfrage: falsche Spalte `answer_index`→`selected_option` + `openDqRanking`) auf gsStore/sbFetch revived · Legacy `dqPushToSupabase` feedet jetzt das echte RPC-System (4 Call-Sites) · isMe-Highlight in der Cloud-Rangliste.
- **Root-Cause Notifications (Frontend-Audit, 11 Findings):** Web-Push und In-App-Inbox KOMPLETT entkoppelt (Push-Checker schrieben 0× in `notifications` → Inbox zeigte faktisch nur Stripe) · Badge zählte eigene Scans/Level-Ups als "ungelesen" · 1,8s-Auto-Mark-All-Timer blendete Panel aus, während der User noch las · Panel hart bei 8 gecuttet (totes "+N weitere") · Toast-Singleton überschrieb Meldungen bei Bursts kommentarlos · SW meldete empfangene Pushes nicht an offene Tabs.
- **Fix Notifications (Migration `20260826_push_to_inbox_bridge.sql` LIVE + Frontend):** AFTER-INSERT-Trigger spiegelt `push_send_log` → `notifications` (deckt ALLE heutigen + künftigen Push-Checker ohne eine einzige Edge-Fn-Änderung; inkl. `suppressed_quiet` — stumm ≠ weg; 30d-Backfill als gelesen). Frontend: Mark-Seen beim Menü-SCHLIESSEN statt 1,8s-Timer · Badge zählt nur noch echte Neuigkeiten (eigene Scans/Level-Ups raus) · Panel scrollbar (max-height 46vh, Cap 50 statt Cut bei 8) · Batch-PATCH statt N Einzel-Requests beim Mark-All · SW postMessage `GS_PUSH_RECEIVED` → Badge/Inbox aktualisieren live in offenen Tabs · visibilitychange-Pull (max 1×/60s) · Toast-FIFO-Queue (max 3, Dedup, beschleunigtes Ausblenden bei Wartenden) — deckt `showProfileToast` + `gsToast` (700+ Call-Sites) gemeinsam ab.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` `node --check` OK · beide Migrationen LIVE applied + Backfill verifiziert · GS_VERSION=v30.80 · sw.js gs-v30.80 · _headers v30.80 · meta=30.80.20260827.
- **Nächste:** Push-E2E am Gerät testen (OS-Push → Live-Badge-Update im offenen Tab) · optional `showMarketNotif`/`gsNotif.show` auf gsToast konsolidieren · Toast-Progress-Flows beobachten (Queue statt Sofort-Replace).

### 2026-05-24 (c) — Self-Audit-Sprint v26.51 (Backend-Security-Hardening nach Supabase-Advisors)

- **Auftrag:** User-Request "Auditiere und verbesser bzw. erweitere intelligent alles. Es soll auch Backend alles perfekt aufgebaut sein." Proaktiver Audit ohne externes Briefing.
- **Audit-Findings:** Supabase-Advisor lieferte 98 Security Lints (14 ERROR + 84 WARN) + 376 Perf Lints. Frontend 7/7 OK, 5× 100vh (alle in CHANGELOG-Strings = false positive), 2× raw fetch (eine ist die _gsFetch-impl selbst → OK), 62× alert() (62-davon davon viele in admin/fallback-Pfaden, aber 4 user-facing in Marketplace+Recipes).
- **Migration v26_51 LIVE applied:** 14 SECURITY DEFINER Views → security_invoker=true (war kritisch: views bypassen RLS, jeder authenticated User konnte über sie Daten anderer lesen) + feedback_votes RLS-Hardening (war ALWAYS-TRUE → own-votes only) + 29 FK-Indexes + 6 Duplicate-Indexes gedroppt + 2 function_search_path_mutable Fix.
- **Migration v26_51b LIVE:** 4 admin-only Functions REVOKE EXECUTE für public/anon/authenticated (fn_assign_role, fn_cleanup_old_data, fn_set_global_api_key, is_admin_user). Service-role behält EXECUTE.
- **Frontend Hard-Lesson #2 Fix:** 4 native alert() → gsToast in submitListing (3×) + saveRecipe (1×) — iOS-PWA-Standalone blockiert sonst Webview.
- **Re-Audit-Diff:** Security 14 ERROR + 84 WARN → 0 ERROR + 75 WARN (-23%, alle ERROR-Level weg). Verbleibende 75 WARN: 35 SD-Functions public (by-design für Frontend-RPCs), 6 storage-bucket-listing (by-design für avatars/marketplace), 3 extension_in_public (kein User-Action), 1 leaked_password_protection (Dashboard-Setting).
- **Verify:** 7/7 inline-scripts node --check OK · sw.js gs-v26.51 · GS_VERSION=v26.51 · _headers v26.51 · meta=26.51.20260524 · 2 Migrations LIVE.
- **Naechste:** Dashboard-Settings (Leaked-Password-Protection enable) · ggf. weitere alert→gsToast in nicht-kritischen Flows · Stripe Live-Mode-Switch.

### 2026-05-24 (b) — Trio-Sprint #4 v26.48-v26.50 abgeschlossen (DB-Wave-14 + Edge-Fn-Logging)

- **Auftrag:** Cowork-Briefing — DB-Wave-14 (garden_visitors_animals 12 + garden_weather_alerts 10) + ai_daily_usage Backend komplett (fn_log_ai_usage RPC + v_ai_usage_summary View mit Haiku+Sonnet-Pricing). AI_USAGE_LOGGING_PATCH_GUIDE.md als 1-Min-Patch-Anleitung.
- **v26.48 Garten-Besucher Sub-Tab** (`2af64a1`): 11. Wissen-Sub-Tab "🦔 Besucher" (12 garden_visitors_animals: Igel/Marienkäfer/Fledermaus/Salamander/Eidechse/Regenwurm/Hornisse). Card-Accent farbig nach Nützling vs Schädling vs Rote-Liste. Detail-Modal mit beneficial_role als grosse grüne Box, conservation_actions, what_attracts/repels. PLUS v26.47 Token-Cost-Widget wired to v_ai_usage_summary View mit pre-computed Haiku-Cost.
- **v26.49 Weather-Alert-Widget Home** (`05594df`): Neues #weather-alert-card über der Mushroom-Saison-Card. Query garden_weather_alerts mit typical_months overlap + Region-Filter heuristisch (GS_WA_REGION_TOKENS-Map). Severity-Sort katastrophal first, Pulse-Animation bei katastrophal, MeteoSchweiz-Link, immediate_actions.
- **v26.50 ai_daily_usage Edge-Fn-Logging** (Pending Push): 5 Edge-Fns LIVE redeployed mit fn_log_ai_usage RPC fire-and-forget vor success-Return — pest-identify v2, mushroom-identify v2, garden-scan-analyze v5, plan-iterate v3, knowledge-bulk-gen v11. Pattern: try/catch nicht-blockierend, Tokens aus anthropicData.usage/aiJson.usage/aiData.usage. v26.47 Admin-Widget zeigt jetzt echte Live-Daten.
- **Trio-#4-Bilanz:** 3 Pushes, 0 Migrations (Cowork-Backend ready), **5 Edge-Fn-Redeploys** in einem Sprint! 1 neuer Wissen-Sub-Tab (10→11), 1 Home-Widget (Weather-Alert). Total seit v26.33: **18 Pushes in 4 Sessions (Pentagon #1 + #2 + #3 + Trio #4)**.
- **GreenScan-Stand:** 11 Wissen-Sub-Tabs · 5 Plan-Intents · 3 Home-Widgets (Bauernregel + Saison-Pilze + Wetter-Alert) · Pilz-Scanner mit 145-Notruf · Tagebuch mit 11 Typen · Marketplace mit Bio-Filter · Forest-Garden 7-Schichten · Balkon-Wizard · Admin-Token-Dashboard mit Live-Logging.
- **Cowork-Restpflichten:** Stripe Live-Mode-Switch sobald Fernando bereit · DB-Wave-15 falls neue Domains sinnvoll.

### 2026-05-24 (a) — Pentagon-Sprint #3 v26.43-v26.47 abgeschlossen (DB-Wave-13 + Token-Cost-Widget)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.43_v26.47.md — DB-Wave-13 (alpine_garden_plants 12 + forest_garden_design 8 + indoor_houseplants 20 + urban_balcony_design 16) + garden-scan-analyze v4 LIVE mit bird_friendly + knowledge-bulk-gen v10 mit 35 Topics. 5 Sprints in Reihenfolge.
- **v26.43 Alpine-Pflanzen** (`a74ff09`): 9. Wissen-Sub-Tab "🏔️ Alpen". 12 alpine_garden_plants inkl. Eisenhut (TÖDLICH GIFTIG roter Banner + tel:145), Edelweiss/Arnika (geschützt orange Banner + NHG-Hinweis), Enzian/Soldanelle. Card-Accent farbig nach Sicherheit. Höhenband-Badge prominent. Steingarten-Rolle + Companion-Plants.
- **v26.44 Forest-Garden Designer** (`83054f0`): Neuer Garten-Aktion-Button. Modal mit 8 forest_garden_design + Filter-Pills. Vertikales 7-Schichten-SVG-Diagramm (Canopy oben → Wurzel + Pilz-Etage). Pflanzen-Pills pro Schicht in Schicht-Farbe. Eckdaten-Pills + Pro-Tips + Pitfalls. "Plan übernehmen" erstellt garden_plan plan_intent=permaculture_hugel mit recommended_plants flat aus allen Layern.
- **v26.45 Indoor-Pflanzen** (`f8e407c`): 10. Wissen-Sub-Tab "🪴 Zimmer". 20 indoor_houseplants. Card-Accent rot bei Pet/Kinder-Tox, grün bei air_purifying. Detail-Modal mit Tox-Banner ZUERST + tel:145, Air-Purifying-Banner als Pluspunkt, 2x2-Pflege-Profil-Grid (Licht/Wasser/Temp/Feuchte), Vermehrung, Probleme, Pet-Disclaimer.
- **v26.46 Urban-Balkon-Wizard** (`43e5fd8`): Plan-Typ-Picker mit container_balcony zeigt inline Balkon-Wizard: m²-Input + Orientation-Select + Match-Button. Query urban_balcony_design via size-Range + orientation (Fallback ohne orientation). 6 inline-Result-Cards, Click öffnet Vollbild-Detail-Modal (Eckdaten + recommended_plants + pro_tips/pitfalls). "Vorlage übernehmen" erstellt garden_plan mit balcony_template_slug.
- **v26.47 Token-Cost-Widget Admin** (Pending Push): Migration v26_47_ai_daily_usage LIVE applied (composite-PK date+edge_fn, RLS, Index). Cowork ergänzt Edge-Fn-Logging via UPSERT in alle 8 Edge-Fns. Frontend: admin-only Settings-Row "📊 KI-Nutzung & Kosten". Modal mit Heute-Tab (pro Edge-Fn Calls/Tokens/CHF) + 7-Tage-Trend-Tab (Mini-Bar-Chart + Tages-Total + Ø/Tag). Anthropic Haiku 4.5 Pricing client-side estimate.
- **Pentagon-#3-Bilanz:** 5 Pushes für 5 Sprints, 1 Migration applied (ai_daily_usage), 0 Edge-Fn-Deploys (Cowork: v4 + v10 separat + ergänzt v26.47-Logging als Followup). 2 neue Wissen-Sub-Tabs (8 → 10 total), 1 neuer Garten-Aktion-Button (Forest-Garden), 1 inline Plan-Picker-Wizard (Balkon), 1 Admin-Dashboard. 16+ neue Functions inkl. 2 neue Vollbild-Modals (Forest-Detail + Balkon-Detail + Token-Cost). Total seit v26.33 heute: **15 Pushes in 2 Sessions (Pentagon #1-#3)**.
- **GreenScan-Stand:** Voll ausgebaute Schweizer Naturgarten-PWA mit 10 Wissen-Sub-Tabs (Kompost/Vermehrung/Boden/Heilpflanzen/Samen/Pilze/Wasser/Vögel/Alpen/Zimmer), 5 Plan-Intents (Selbstversorgung/Pollinator/Permakultur/Container/Bird-Friendly), Forest-Garden 7-Schichten-Designer, Balkon-Wizard, Pilz-Scanner mit Tox-Info-145, Tagebuch mit 11 Typen, Marketplace mit Bio-Filter, 2 Home-Widgets (Bauernregel + Saison-Pilze), Admin-Token-Cost-Dashboard.
- **Cowork-Restpflichten:** Edge-Fn-Logging fuer ai_daily_usage (alle 8 Anthropic-callers) · Stripe Live-Mode-Switch begleiten · DB-Wave-14 falls neue Domains sinnvoll.

### 2026-05-23 (e) — Pentagon-Sprint #2 v26.38-v26.42 abgeschlossen (Bonus-Aufgaben + DB-Wave-12)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.38_v26.42.md — DB-Wave-12 (water_features 24 + mushroom_recipes 25 + garden_birds_register 19) + garden-scan-analyze v3 LIVE mit plan_intent + knowledge-bulk-gen v9 mit 31 Topics. 5 Sprints (3 Bonus-Aufgaben aus v26.33-Backlog + 2 neue Domains).
- **v26.38 Mushroom-Glossar** (`c7518c5`, Bonus B-C): 6. Wissen-Sub-Tab "🍄 Pilze". mushroom_register sortiert nach edibility ASC (toedlich zuerst). Card-Accent farbig nach Sicherheit. Detail-Modal mit Lebensgefahr-Banner + tel:145 ZUERST, Edibility-Pill/VAPKO/Habitat/Symbiose/Saison/Morph/Toxine/Symptome/Notfall. Async-Sub-Loads: Lookalikes bidirektional + Rezepte (bei isEdible) via primary_mushroom_slugs cs.{}. Eigener gsMushroomRecipeOpen-Modal. Forward-compat: configs[wasser]+configs[voegel]+Renderer bereits enthalten.
- **v26.39 Mushroom-Saison-Widget** (`1a8e315`, Bonus B-A): Home-Widget lila zwischen Wisdom-Card und Quiz. Query mushroom_seasonal_patches mit best_months overlap currentMonth + region_canton_codes overlap userCantons via gsGetRegionContext. Day-of-year deterministisch eine Patch pro Tag. 6h Cache. typical_mushrooms-Liste + weather_trigger + VAPKO-Telefon + 2 Action-Buttons.
- **v26.40 Companion-Lookup mit View** (`cb8eef9`, Bonus B-B): Im Plan-Detail-Modal (gsGardenScanShowPlant) async-Block zusätzlich zur v26.24 Pest-Box. v_companion_lookup View (Cowork-Backend) statt alter OR-Logik → 1 Query pro Pflanze. Top-3 'gut' + Top-2 'schlecht' mit confidence-Badge + reason + effect_on_self. 15min Cache.
- **v26.41 Wassergarten-Sub-Tab** (`3f906f1`): 7. Wissen-Sub-Tab "💧 Wassergarten" aktiviert. 24 water_features. Card-Accent rot bei invasive, blau bei teich_design, grün bei swiss_native. Detail-Modal mit Invasiv-Banner + best_paired_with/do_not_pair + CH-Recht-Hinweis bei teich_design.
- **v26.42 Vogel-Garten + bird_friendly Modus** (Pending Push): 8. Wissen-Sub-Tab "🦜 Vögel" aktiviert (19 garden_birds_register). Card-Accent nach Rote-Liste-Status. Detail-Modal mit Lockpflanzen + Futter + Nistkasten + attracting_tips + Bedrohungen + Fun-Fact. Plus: KI-Planer Plan-Typ-Picker um 5. Option "🦜 Vogel-Garten" erweitert. Hint-Box bei Auswahl. Plant-Liste mit birdTag forward-compat (pl.bird_tags ODER bei isBirdFriendly + pl.attracts_birds).
- **Pentagon-#2-Bilanz:** 5 Pushes für 5 Sprints, 0 Migrations applied (alle DB-Tabellen ready durch Cowork), 0 Edge-Fn-Deploys (Cowork hat v3 + v9 + v4 separat deployed). 3 neue Wissen-Sub-Tabs (5→8 total Wave-9-Tabs), 1 neues Home-Widget (Mushroom-Saison), 1 KI-Planer-Plan-Typ-Erweiterung (4→5 Optionen), 1 Plan-Detail-Erweiterung (Companions-Box), 10+ neue Functions inkl. eigener mushroom-recipe-Modal.
- **Total seit v26.33:** 10 Pushes in 1 Session (Pentagon #1 + #2). GreenScan ist jetzt eine voll ausgebaute Schweizer Garten-, Pilz-, Wassergarten- und Vogel-PWA.
- **Cowork-Restpflichten:** DB-Wave-13 (alpine_garden_plants / forest_garden_design / indoor_houseplants falls sinnvoll) · Stripe Live-Mode-Switch begleiten.

### 2026-05-23 (d) — Pentagon-Sprint v26.33-v26.37 abgeschlossen (5 Sprints in 1 Session)

- **Auftrag:** Cowork hat DB-Wave-11 (4 Tabellen + 57 Einträge + 2 Views) + AUFTRAG_v26.33-v26.37 freigegeben. 5 Sprints in Reihenfolge umgesetzt.
- **v26.33 Pilz-Scanner** (`02575f1`): Edge-Fn mushroom-identify v1 LIVE (verify_jwt:true, Anthropic Vision + 20-Pilze-Knowledge). 4. Scan-Modus mit Modal + Habitat-Picker. ROTER VOLLBILD-Warnscreen (gsShowMushroomDangerOverlay) bei toedlich/giftig mit pulse-Animation + ☎️-Tox-Info-145. safetyMap aus v_mushroom_safety + bidirektionale Lookalikes + VAPKO-Box mit Region-Lookup.
- **v26.34 Tagebuch UI-Form** (`01dcd44`): Garten-Aktion-Button "📔 Tagebuch-Eintrag" + 2-Tab-Modal (➕ Neuer Eintrag | 📊 Saison-Statistik). Type-Picker mit allen 11 GS_DIARY_TYPES + Conditional Fields pro Type (Species-Picker / harvest_kg / pest_slug / Dünger / Wasser / Krankheit). Saison-Stats-Tab via gsDiaryStats: total + Ernte-Total-kg + Top-5-Pflanzen + Pest-Count + Per-Type-Liste.
- **v26.35 Bauernregeln-Widget** (`49c87b5`): Home-Widget #wisdom-card zwischen "Wusstest du?" und "Schnell-Quiz". Daily-Rotation aus traditional_garden_wisdom mit applicable_months-Filter + day-of-year deterministisch + 12h-Cache. Validity-Badge (4 Farben: 🟢 bestaetigt / 🟡 tendenziell / 🟠 umstritten / 🔴 Mythos). Click rotiert zur nächsten Regel mit Fade.
- **v26.36 Marketplace Pestizid-frei-Filter** (`a201060`): Migration v26_36_marketplace_pesticide_free LIVE applied (3 Spalten + 2 partial Indexes). Bio + Pestizid-frei Checkboxen in beiden Listing-Forms (submitListing + saveListing). Cert-Label-Dropdown mit 6 Optionen (Knospe / EU-Bio / Demeter / Naturland / Bioland / Sonstiges). renderMarket-Cards mit grünem Bio-Badge + orangem Pestizid-frei-Badge. 2 Filter-Pills "🌱 Bio-zertifiziert" + "🚫 Pestizid-frei" oberhalb Listings.
- **v26.37 Pollinator-Garten-Modus** (Pending Push): Plan-Typ-Picker im KI-Garten-Scan-Wizard mit 4 Optionen (🥕 Selbstversorgung default / 🐝 Bienen-Garten / 🌳 Permakultur / 🪴 Container). body.metadata.plan_intent wird an garden-scan-analyze gesendet. Cowork-Ergänzung v3 wird das nutzen. Result-Preview zeigt Intent-Badge + Plant-Liste forward-compatible mit 🐝-Tag bei pl.pollinator_tags ODER ecological_value>=7.
- **Pentagon-Bilanz:** 5 Pushes für 5 Sprints, 1 Migration applied, 1 Edge-Fn deployed (mushroom-identify v1, verify_jwt:true), 14+ neue Functions, 4 neue Modals, 4 neue Garten-Aktion-Buttons, 1 Home-Widget, 1 KI-Planer-Erweiterung.
- **Cowork-Restpflichten:** garden-scan-analyze v3 mit plan_intent + pollinator-Modus · Bonus B-A Mushroom-Saison-Widget · B-B Companion-Lookup-View-Nutzung · B-C Mushroom-Glossar im Wissen-Tab · DB-Wave-12 (water_features, traditional_recipes_per_canton, mushroom_recipes).

### 2026-05-23 (c) — v26.33 Pilz-Scanner (sicherheitskritisch, mushroom-identify Edge-Fn LIVE)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.33_v26.37.md — DB-Wave-11 (mushroom_register 20 / mushroom_lookalikes 9 / mushroom_seasonal_patches 8 / traditional_garden_wisdom 20 + v_mushroom_safety + v_companion_lookup Views). v26.33 als erster Sprint umgesetzt (P1, ~4h).
- **Edge-Fn mushroom-identify v1 LIVE:** verify_jwt:true, Anthropic Vision Haiku 4.5 mit allen 20 Pilzen im System-Prompt-Knowledge-Context (slug/name/edibility/VAPKO-Klasse/Hut/Lamellen/Sporen/Stiel/Geruch/Merkmale/Habitat). Force vapko_required=true bei confidence<70 ODER edibility ∈ {toedlich,giftig}. Bidirektionale Lookalikes-Query via .or(edible_slug.eq...,lookalike_slug.eq...). Region-aware VAPKO-Kontrollstelle aus mushroom_seasonal_patches.region_canton_codes mit Fallback. Repo-File supabase/functions/mushroom-identify/index.ts 1:1 mit deployed Source synced.
- **Frontend 4. Scan-Modus:** Garten-Aktion-Button "🍄 Pilz-Scanner" (violetter Gradient #6a1b9a→#4a148c). Modal mit gelbem Tox-Info-145-Disclaimer ZUERST, 8MB Foto-Inputs (Kamera/Galerie), Habitat-Picker (7 Typen). 6 neue Functions: openMushroomModal / gsMushroomLoadPhoto / gsMushroomRunScan / gsMushroomRenderResult / gsMushroomVapkoBox / gsShowMushroomDangerOverlay.
- **gsShowMushroomDangerOverlay (sicherheitskritisch):** position:fixed inset:0 z:99999 #b71c1c-Vollbild mit eigener gs-mushroom-pulse-keyframe-Animation, 72px ☠️/⚠️ Icon, 28px Playfair-Headline "TÖDLICH GIFTIG"/"GIFTIG", KI-Match-Card mit common_name_de + scientific_name, NICHT-ESSEN-Warning, full-width "☎️ Tox-Info: 145"-tel-Link-Button (min-width:240px), "Verstanden — Details anzeigen"-Dismiss-Button. User MUSS aktiv dismissen.
- **safetyMap aus v_mushroom_safety:** red→🚫 TÖDLICH/GIFTIG, orange→⚠️ NUR JUNG/BEDINGT, yellow→⚠️ Vorsicht, green→✅ Speisepilz. Plus symptoms_if_toxic + emergency_action + 145-Footer bei toedlich/giftig; cooking_preparation + conservation_methods bei Speisepilz; Confidence<60 → gelbe UNSICHER-Box (statt false-positive).
- **Lookalikes bidirektional gerendert:** confusion_risk-Badge (hoch=#c62828, mittel=#e65100, niedrig=#827717) plus visual_differences + smell_differences + spore_print_differences + pro_tip (grün) pro Lookalike.
- **VAPKO-Pflicht-Box:** gsMushroomVapkoBox mit Kontrollstelle + tel-Link (Spaces gestrippt) + vapko_link external — aus user-region.
- **Verify:** 7/7 inline-scripts node --check OK · sw.js gs-v26.33 OK · GS_VERSION=v26.33 OK · meta=26.33.20260523 OK · _headers v26.33 OK.
- **Naechste Sprints:** v26.34 Tagebuch-UI-Form (Type-Picker 11 entry_types + Saison-Stats), v26.35 Bauernregeln-Widget (traditional_garden_wisdom Daily-Rotation + Validity-Color), v26.36 Marketplace Pestizid-frei-Filter, v26.37 Pollinator-Garten-Modus.

### 2026-05-23 (b) — Quartet-Sprint v26.28-v26.32 (DB-Wave-10-Frontend + Migration)

- **Auftrag:** Cowork hat DB-Wave-10 + bulk-gen v8 + region-aware Edge-Fns deployed. 5 Sprints freigegeben (CODE_AUFTRAEGE_v26.28_v26.32.md). v26.29 + v26.31 als Bundle ausgeliefert weil gleiches Pattern → 4 Pushes für 5 Sprints.
- **v26.28 KI-Planer Region-Wiring** (`7c73d7b`): gsRunGardenScan body.metadata bekommt async region_slug (aus v26.27 gsGetRegionContext) + soil_type + soil_ph (aus v26.25 gs_soil_profile). Backend garden-scan-analyze v2 + plan-iterate v2 sind region-aware.
- **v26.29 Düngeplan-Coach + Beet-Layout-Designer** (`d0a5314`, Bundle v26.29+v26.31): 2 neue Garten-Aktion-Buttons. Düngeplan: Modal mit Pflanzen-Picker (auto-select bei myPlants-Match), Phasen-Liste aus fertilization_schedules mit NPK-Focus, Bio + Mineral-Optionen, CHF-Kosten, "Erledigt"-Button → garden_diary. Layouts: 10 garden_layouts mit Filter-Pills + Detail-Modal (plant_combinations, rotation_plan, pro_tips, common_pitfalls).
- **v26.30 Samen-Gewinnung** (`d2c8b53`): 5. Wave-9-Sub-Tab im Wissen "🌰 Samen ernten". configs[samen] erweitert + neue _gsWave9RenderSeedSaving Detail-Modal mit WICHTIG-Cucurbita-Kreuzung-Warning ZUERST + Badges (Bestäubung/Isolation/Keimfähigkeit) + Extraktion/Reinigung/Trocknung/Lagerung.
- **v26.32 Garten-Tagebuch v2** (`fbf2b0c`): Migration v26_32_garden_diary_v2_kategorien LIVE applied (entry_type CHECK 11 values + pest_slug FK + species_lat + harvest_kg + metadata jsonb + 2 Indexes). **Bug-Fix:** v26.21+v26.29 Inserts schlugen silent fehl (type/notes Spalten existierten nicht) → korrigiert. Neue gsDiaryAddEntry + gsDiaryStats Helper.
- **Cowork-Restpflichten:** Stripe-Dashboard Connect + Live-Mode-Switch · Bonus B1 (did_you_know/seasonal_tips Bulk-Refill jetzt mit bulk-gen v8 möglich) · B2 (Marketplace Pestizid-frei-Filter) · B3 (Pollinator-Garten-Modus).
- **Sprint-Bilanz:** 4 Pushes für 5 Sprints, 1 Migration applied, 0 Edge-Fn-Deploys, 5 neue Garten-Aktion-Buttons + 1 Wissen-Sub-Tab + 2 generic API-Helper (gsDiaryAddEntry, gsDiaryStats).

### 2026-05-23 (a) — Quintuple-Sprint v26.23-v26.27 (DB-Wave-9-Frontend)

- **Auftrag:** Cowork hat DB-Wave-9 mit 4 neuen kuratierten Tabellen + knowledge-bulk-gen v7 deployed. 5 Sprints freigegeben (CODE_AUFTRAEGE_v26.23_v26.27.md). Reihenfolge wie spezifiziert: v26.23 → v26.24 → v26.25 → v26.26 → v26.27.
- **v26.23 Wissen-Tab Erweiterung** (`908c0a9`): 4 neue Sub-Tabs (🌱 Kompostieren / ✂️ Vermehrung / 🪨 Boden-Pflege / 🌿 Heilpflanzen). gsRenderWissenWave9 generic Renderer + Filter-Pills + 4 spezifische Detail-Render-Funktionen. Heilpflanzen mit PROMINENT rote Kontraindikations-Box (rechtssicher).
- **v26.24 Pest-Filter im KI-Planer** (`20ad51e`): gsLoadPestsForPlanPlant async-Block im Plan-Detail-Modal. Top-3 plant_pests via host_plants @>[lat] + pest_companion_plants via effective_against-Overlap. Severity-Dots + Prevention + Bio-Behandlung + Schutzpflanzen-Vorschläge. "🪲 Schädling fotografieren"-CTA öffnet v26.21 Pest-Scanner.
- **v26.25 Bodenverbesserer-Recommender** (`537580d`): Garten-Aktion-Button "🪨 Boden verbessern" + Modal mit pH/Bodenart/Goal-Pickers + Client-Scoring (50 pH-Match, 18 Type-Match, 25 Goal-Match) → Top-5 aus 15 soil_amendments. Profil-Persistenz in gs_soil_profile.
- **v26.26 Heilpflanzen-Profile** (`20060dd`): openDetail Pflanzen-Detail-Modal bekommt async medicinal_plants_register-Block falls scientific_name-Match. WARNUNGEN ZUERST (Kontraindikationen rot border-2, Wechselwirkungen orange, Toxizität gelb), dann Used-Parts, Wirkstoffe, traditionelle vs evidenz-basierte Anwendung, Dosierung, Erntezeit, CH-Rechtslage. Disclaimer-Footer.
- **v26.27 Regional-Calendar** (`b2ccb1d`): Garten-Aktion-Button "🗓️ Regional-Kalender" + Modal mit Picker für 7 CH-Höhenzonen aus regional_garden_calendars. Aktueller Monat prominent in oranger Box + best_vegetables (grün) + challenging_plants (orange) + 12-Monats-Accordion (current open). gsGetRegionContext() API für künftige KI-Planer-Integration. Persistenz gs_region.
- **Bekannte Bugs (laut Briefing):** did_you_know_facts + seasonal_tips bulk-gen Schema-Mismatch (insertion silent fails) — debug-fähig in net._http_response.
- **Cowork-Restpflichten:** Stripe-Dashboard Connect aktivieren · Stripe Live-Mode-Switch · Bonus v26.23a/b/c (knowledge-bulk-gen v8 mit Wave-9-Schemas + Marketplace Pestizid-frei-Filter + Garten-Tagebuch-Verbesserung).
- **Sprint-Bilanz:** 5 saubere Pushes in einer Session, 0 Backend-Migrations (alles ready), 4 neue Garten-Aktion-Buttons, 7 neue Modals, 1 erweiterte Wissen-Section (12 → 16 Tabs), 1 KI-Planer-Erweiterung, 1 Pflanzen-Detail-Hook.

### 2026-05-22 (e) — Triple-Sprint v26.18+v26.19+v26.20

- **Auftrag:** Cowork hat 3 grosse Sprints freigegeben (CODE_AUFTRAEGE_v26.18_v26.20.md). Reihenfolge: v26.20 i18n (höchster Impact, niedrigstes Risiko) → v26.19 Pest-Scanner (Vision-AI + 25 Schädlinge) → v26.18 AR-View (Three.js MVP).
- **v26.20 i18n Frontend-Switcher** (commit `b10709d`, GS_VERSION='v26.20'): gsI18n erweitert um Direct-PostgREST-Pull aus i18n_translations (1 GET-Query, keine Anthropic-Calls). 24h-TTL via bundleTs-Map. Boot-Auto-Build: bei detectLang()!=de UND isStale(lang) → async loadFromDb → applyToDOM. openModal-Hook (idempotent) übersetzt dynamisch geöffnete Modals. gsHandleLangChange Fast-Path. FR/IT/GSW-User sehen jetzt schon beim Erst-Visit ihre Sprache.
- **v26.21 = v26.19 Schädlings-Scanner** (commit `6978f02`, GS_VERSION='v26.21'): Edge-Fn `pest-identify` v1 LIVE (verify_jwt:true, Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context mit 25 AGFF-Schädlingen). Frontend: neuer Garten-Aktion-Button "🪲 Schädling-Scanner" + #modal-pest mit Foto-Upload (Kamera/Galerie, 8MB Limit) + Host-Plant-Picker aus myPlants. 5 neue Functions (openPestModal/gsPestLoadPhoto/gsPestRunScan/gsPestRenderResult/gsPestAddToDiary). Confidence-Badge 3 Stufen (Gering/Mittel/Hoch). Bei Confidence < 40 zeigt "bitte näher"-Hint statt false-positive.
- **v26.22 = v26.18 AR-View MVP** (commit `076afad`, GS_VERSION='v26.22'): Three.js basierter 3D-View für 30 Seed-Pflanzen aus ar_models (gltf_url=NULL → Fallback-Geometrie). gsAROpen + _gsARInitScene + _gsARRenderFallback + _gsARDispose. Eigene Drag/Pinch/Wheel-Pointer-Logic statt OrbitControls (spart externe Abhängigkeit). _gsARColors-Map mit 30 species-spezifischen Krone-Farben. Memory-Leak-frei via closeModal-Hook. Three.js bereits self-hosted (/assets/three.min.js seit v25.36).
- **Cowork-Restpflichten:**
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um account.updated + account.application.deauthorized als Enabled-Events ergänzen (für v26.6/v26.17 Marketplace-Connect-Loop)
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 Stripe Live-Mode-Switch (Fernando)
  - 🟡 Bonus v26.18a/b/c (optionale Nachzieh-Sprints): seasonal_highlights als 17. knowledge-bulk-gen Topic · compost_recipes + propagation_methods im Frontend (Wissen-Tab) · Pest-Filter im KI-Planer.
- **Followup naechste Session:** Browser-Smoke-Test via Chrome-MCP (FR-Switch, Schädling-Foto, AR-View für Tomate) falls verfügbar. Bonus-Sprints v26.18a/b/c bei Bandbreite.

### 2026-05-22 (d) — AUFTRAG_v26.17 Refinements (stripe-webhook v10)

- **Auftrag:** Nach v9-Push schrieb Cowork das AUFTRAG_v26.17 mit 3 spezifizierten Refinements. Meine v9 matched zu ~95%, aber: (a) `account.application.deauthorized` Handler fehlte komplett, (b) v9 setzte `disabled` bei JEDEM disabled_reason (zu aggressiv — Stripe nutzt das auch für transient `pending_verification`), (c) v9 hatte impliziten Skip via UPDATE statt expliziten Pre-Check + warn-log.
- **Edge-Fn `stripe-webhook` v10 LIVE:**
  - `handleAccountUpdated`: jetzt Pre-Check (`SELECT marketplace_sellers WHERE stripe_account_id=...maybeSingle()`), skip mit warn-log wenn kein Eintrag. Status-Mapping konservativer — `disabled` NUR wenn `disabled_reason.startsWith('rejected')`. Sonst `restricted` (für `pending_verification` etc.).
  - `handleAccountDeauthorized` (NEU): bei `account.application.deauthorized` → status='disabled', charges/payouts=false. Account-ID-Lookup zuerst via `event.account` (top-level), Fallback via `event.data.object.account` (API-Version-tolerant).
  - Switch-Case erweitert um `case "account.application.deauthorized"`.
  - Repo-File 1:1 mit v10 synced.
- **Definition of Done v26.17 erfüllt:**
  - ✅ account.updated → marketplace_sellers.status/charges_enabled/payouts_enabled/details_submitted/requirements/business_type sync
  - ✅ account.application.deauthorized → status=disabled
  - ✅ Status-Mapping wie spezifiziert (pending/active/restricted/disabled)
  - ✅ Header-Kommentar v10-Notiz
- **Cowork-Restpflichten (weiter reduziert):**
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um `account.updated` + `account.application.deauthorized` als Enabled-Events ergänzen (sonst kommen die Events nicht beim Webhook an) — siehe AUFTRAG_v26.17 §1.
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe Live-Mode-Switch
- **Followup naechste Session:** Smoke-Test via AUFTRAG_v26.17 Variante A (synthetic) wenn Cowork den Webhook-Endpoint erweitert hat.

### 2026-05-22 (c) — Autonome Backend-Erweiterung (i18n Pass-3 Live + stripe-webhook v9)

- **Auftrag:** User-Freigabe „lets go" → autonome Wertschoepfung auf 2 Tracks: (1) i18n FR/IT komplett, (2) stripe-webhook v9 mit account.updated Handler.
- **i18n Pass-3 LIVE:**
  - 316 unique DE-Keys aus index.html extrahiert (data-i18n + GS_I18N_JS_STRINGS-Map).
  - i18n-translate Edge-Fn API verstanden: nimmt `{source_lang, target_langs:[fr,it], strings:{key:text}, context}`, macht intern Chunking + Cache via i18n_translations(source_lang, target_lang, source_hash) Schema (NICHT lang/key-Tabelle wie urspruenglich angenommen).
  - 4 Batches × 80 Keys × 2 Sprachen = 632 Translations via curl (Edge-Fn ist verify_jwt:false, kein Auth-Header noetig). Total ~115s, ~22.3k tokens in / 19.6k tokens out = ~$0.10 Anthropic-Cost (Haiku-Pricing).
  - DB-Coverage **VORHER → NACHHER**: DE→FR 30 → **321** (+291) · DE→IT **5 → 313** (+308) · DE→GSW 297 (unveraendert, war Cowork-Pass-2). Schweizer Markt jetzt 100% DE/FR/IT covered. AUFTRAG_CODE_v26.8 Definition-of-Done erfuellt.
- **stripe-webhook v8 → v9 LIVE:**
  - v8-Source komplett uebernommen (kein Behavior-Change fuer existing Triggers Subscription/Checkout/PaymentIntent/Invoice).
  - Neuer `case "account.updated"` mit `handleAccountUpdated` Handler. Logik: Stripe.Account.charges_enabled + payouts_enabled + details_submitted + requirements.currently_due → status-Mapping (active/pending/restricted/disabled).
  - User-Lookup zuerst via `account.metadata.gs_user_id` (von stripe-create-connect-account gesetzt), Fallback via `stripe_account_id` (eindeutig in marketplace_sellers).
  - Sync-Felder: status + charges_enabled + payouts_enabled + details_submitted + requirements (jsonb) + business_type.
  - Damit v26.6 Marketplace-Connect-Loop komplett: Frontend ruft Edge-Fn → Stripe-Onboarding → account.updated Webhook → marketplace_sellers.status sync → gsMarketplaceRefreshSettingsRow zeigt korrekten Status.
  - Repo-File supabase/functions/stripe-webhook/index.ts 1:1 mit deployed v9 synced.
- **Cowork-Restpflichten (reduziert):**
  - ✅ DONE: marketplace_sellers Migration · stripe-create-connect-account · daily-push-checker v3 · stripe-webhook v9 account.updated · i18n FR/IT Bulk-Translate
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt stripe-create-connect-account `account_invalid`
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic erweitern (aus heute-morgen Daily-Routine flagged)
  - 🟡 Stripe Live-Mode-Switch (Fernando Dashboard-Action)
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Browser-Smoke-Test mit Chrome-MCP falls verfuegbar (Sprachen-Switch FR/IT) · Lighthouse-Pass.

### 2026-05-22 (b) — Backend-Deploy-Session (v26.6/v26.7 Backend)

- **Auftrag:** Cowork hat freigegeben — Backend-Files fuer v26.6 (Marketplace-Connect) + v26.7 (Trial-Reminder) via Supabase MCP deployen.
- **Migration `v26_6_marketplace_sellers`:** ✅ APPLIED. CREATE TABLE marketplace_sellers + 3 RLS-Policies (own_select/insert/update) + index_marketplace_sellers_stripe + view v_my_marketplace_seller (joined mit profiles) + touch_updated_at Trigger.
- **Migration `20260521_push_dedup.sql`:** ❌ NICHT APPLIED — schema-incompatible (push_send_log hat keinen dedup_key Column). Statt eines neuen Indexes wird die existing (user_id, category)-Dedup via fn_push_already_sent_today RPC genutzt. File im Repo als NO-OP-Marker neu geschrieben.
- **Edge-Fn `stripe-create-connect-account`:** ✅ DEPLOYED v1 (verify_jwt: true). Express-Onboarding mit CH/CHF/individual + idempotent (existing account reused) + AccountLink mit refresh/return-URLs. Slug: stripe-create-connect-account.
- **Edge-Fn `daily-push-checker`:** ✅ DEPLOYED v3 (verify_jwt: false). v2-Source komplett uebernommen (Frost / Seasonal / Quiz-Streak Triggers unangetastet) + neuer notifyTrialEndingSoon-Helper am Ende des Handlers. Trial-End nutzt category='trial_end' mit alreadySentToday-Check, push_subscriptions.auth_secret (statt auth), webpush.setVapidDetails aus app_settings. Repo-File jetzt 1:1 mit deployed Code.
- **Cowork-Restpflichten:**
  - 🟡 stripe-webhook v9 muss account.updated-Event handlen → marketplace_sellers.status/charges_enabled/payouts_enabled syncen
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt Edge-Fn account_invalid
  - 🟡 daily-push-checker v3 Smoke-Test (curl mit cron-secret oder service_role) waehrend Fernando-Trial gerade laeuft → verify trial_sent ≥ 0
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Stripe Live-Mode-Switch wartet auf Fernandos Dashboard-Action.

### 2026-05-22 — Code-Daily (Fr, KW 21)

- **Sync:** Lokale Divergence aufgeloest — `git reset --hard origin/main` (Cowork-lokale `83f2d40` v26.11-Performance war redundant, Inhalt bereits in meiner v26.12-Bundle).
- **Sprint-Status:** v26.6 Marketplace-Connect (f24f37d → v26.12), v26.7 Trial-Reminder (de5067a → v26.13), v26.8 i18n-Tooling (83bc00e → v26.14), v26.2 User-friendly Release-Notes (0117c23 → v26.15) **alle LIVE** auf origin/main + green-scan.ch.
- **Health:** ✅ LIVE=v26.15 = REPO=v26.15. SW gs-v26.15. Cloudflare antwortet `cache-control: must-revalidate`. 25 Edge-Fns ACTIVE. Webhook 24h: 0 Events (keine Sub-Aktivitaet), 0 Errors. audit_log 24h: nur `knowledge_growth_daily` (pg_cron laeuft).
- **DB-Wachstum:** 16 Knowledge-Tabellen; nur **`seasonal_highlights = 36 (Min 40)`** unter Threshold. Bulk-Gen-Trigger via `pg_net.http_post` → **HTTP 400 "Unknown topic"** — `knowledge-bulk-gen` Edge-Fn kennt `seasonal_highlights` nicht (nur `seasonal_tips`).  → **Cowork-Pflicht:** Topic in `knowledge-bulk-gen` v7 ergaenzen ODER alternative Seed-Quelle definieren.
- **Smoke-Test (HTTP):** ✅ `/` (3.57 MB), `/assets/leaflet.js` (148 KB), `/sw.js` (17 KB), `/data/plants.v1.js` (2.17 MB) — alle HTTP 200, <300ms. (Browser-Smoke fehlt mangels Chrome-MCP.)
- **Cowork-Backend-Pflichten offen** (aus v26.6/v26.7 Sprints):
  - 🟠 `stripe-create-connect-account` Edge-Fn nicht deployed (File: `supabase/functions/stripe-create-connect-account/index.ts`)
  - 🟠 `daily-push-checker` ist noch **v2** — v3 mit `notifyTrialEndingSoon` Re-Deploy ueberfaellig (File: `supabase/functions/daily-push-checker/index.ts`, **existing v2-Trigger Frost/Wasser/Saisonal/Quiz beim Re-Deploy mit dem neuen Trial-Helper im Handler kombinieren**)
  - 🟠 Migrations `20260520_marketplace_sellers.sql` + `20260521_push_dedup.sql` apply
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect)
  - 🟡 FR/IT Bulk-Translate via `scripts/i18n_translate.sh` (235 Keys-Pipeline ready)
- **Followup naechste Session:** seasonal_highlights Topic-Erweiterung verifizieren · Lighthouse-Pass falls Chrome-MCP verfuegbar.

---

## 1 · Aktueller Stand (statischer Snapshot)

> Die tagesaktuellen Details stehen in Sektion 0 (Routine-Einträge, neueste zuerst).
> Dieser Abschnitt hält nur die groben Eckdaten.
>
> **Nachgemessen am 02.09.2026.** Er stand bis dahin auf `v30.80` — 140
> Versionen daneben. Ein Überblick, der so weit hinterherhinkt, führt den
> nächsten Leser in die Irre, statt ihm Arbeit zu sparen. Wer eine Version
> ausliefert, zieht diesen Abschnitt bitte mit nach; die Zahlen darin sind
> alle mit einem Befehl nachzählbar.

- **Version:** `v32.59` (Client) · SW-Cache `gs-v32.59` · Domain **green-scan.ch** (kanonisch mit Bindestrich).
- **Release:** ✅ live seit v26.0. Stripe **Live-Mode** aktiv seit v26.40.
- **Frontend:** `index.html` **89'283 Zeilen / 5,4 MB** (Monolith HTML+CSS+JS, kein Build) · `sw.js` · `data/plants.v1.js` (2,1 MB, **4'342 Arten**) · `data/releases.v1.js` (Changelog-Archiv, 448 Einträge, wird erst beim Öffnen geladen).
- **Backend:** Supabase — **213 Objekte** (178 Tabellen + 35 Views, alle RLS) · **97 RPCs** vom Frontend gerufen, alle vorhanden · **38 Edge-Function-Verzeichnisse** im Repo, **35 ausgeliefert** · **206 Migrationen**. Advisor: **0 ERROR**.
- **Prüfstände:** **21** in `scripts/` (siehe `CLAUDE.md` §7.1). Alle grün, keine Falschmeldungen. Neu seit v32.33: `einstellungen_check.js` (hält der Schalter, was er verspricht?) und seit v32.39 `tour_check.js` (zeigt die App-Tour auf etwas?).
- **Architektur-Detailkarte:** `BACKEND_FRONTEND_MAP_v26.76.md` (älter — die verlässliche, nachgemessene Momentaufnahme ist `docs/backend-inventar.json`, 02.09.2026).

## 2 · Offene Punkte

### Warten auf Fernando (Eingriffe in die laufende Auslieferung)

| Punkt | Warum es wartet | Belegt in |
|---|---|---|
| **Migration `comment_reactions`** | Kommentar-Reaktionen sind im Frontend fertig und tasten die Tabelle ab; die Migration liegt idempotent im Repo und ist bewusst nicht angewandt. | `20260831_community_reaktionen_v31_09.sql` · (de) |
| `daily_quizzes.image_url` | Aus derselben Liste offener Migrationen. | (2026-08-31 y) |
| `fn_is_role` / `fn_role_at_least` für `anon` sperren | Weiterhin offen (am 02.09. nachgemessen). | (de) |
| Leaked-Password-Protection | Ein Dashboard-Klick. | (2026-08-31 y) |
| **Migration `20260903_plant_tasks_due_snooze.sql`** | Seit v32.46 schreibt „Verschieben" `snoozedUntil` statt ein gefälschtes `lastDone`; die Server-Sicht des Push-Crons kennt das Feld erst nach der Migration — bis dahin kann ein Push eine verschobene Aufgabe anmahnen. Bringt Server und App auf dieselbe Regel (Kalendertag). | `docs/FUER-FERNANDO.md` §5 · (ei) |
| **Migration `20260904_plant_tasks_due_vorgezogen.sql`** | Nachfolgerin der Snooze-Sicht (enthält sie): eine Sensor-Regel `task:<key>` zieht eine Aufgabe vor (`vorgezogenAuf`, v32.53); bis dahin hält der Push-Cron eine vorgezogene Aufgabe erst am regulären Tag für fällig. Nur diese anwenden genügt. | `docs/FUER-FERNANDO.md` §5 · (ep) |
| Migration `20260903_oekosystem_v1_geraete.sql` | Ökosystem V1 Stufe 0 (Geräte, Messwerte, Regeln, Befehle, Sichten, RLS). Bewusst nicht angewandt; das Frontend dazu folgt. | `docs/OEKOSYSTEM-V1.md` §8 · (eh) |

### Braucht eine Entscheidung oder eine Quelle

| Punkt | Was fehlt |
|---|---|
| **Arten-Daten vervollständigen** | 78 % der 4'342 Arten haben keine verwertbare Farb- oder Höhenangabe. Drei Wege abgegangen (`docs/ARTEN-DATEN.md`): keine Quelle von hier aus; vier Nebentabellen in der Datenbank (114 Arten, zwei Tabellen nur live); **167 Dubletten-Gruppen mit widersprüchlicher Giftstufe** in `docs/arten-widersprueche.csv` — brauchen eine Flora, keinen Code. Seit v32.43 gewinnt bei Widerspruch die vorsichtigere Angabe (v32.45 korrigiert: Unterarten, Platzhalter). |
| Feinere Experten-Level | Braucht eine DB-Spalte; die Migration würde ins Repo geschrieben und NICHT angewandt. |
| Stripe-Webhook End-to-End | `stripe_webhook_events` = 0 Zeilen. Owner-Aktion. |

### Technische Schuld, benannt und bewusst offen

| Punkt | Stand |
|---|---|
| **Modell-Rückfallketten in 8 Edge-Functions** | Neun Stellen nennen genau EIN Modell ohne Ausweichmöglichkeit. Vorlage liegt im Repo (`book-ingest`, `CLAUDE_MODELS`). Ob ein Name heute noch auflöst, ist von hier aus nicht prüfbar. (df) |
| `book-ingest` ohne Spiegel | Dokumentiert statt gespiegelt. **Am 03.09. nachgeprüft:** Quelltext gezogen und gelesen, ausgelieferter Stand unverändert (v9, `611bb9da…`). Bewusst NICHT abgelegt — eine Abschrift ist nur dann eine Quelle, wenn sich maschinell zeigen lässt, dass sie stimmt, und dafür gibt es von hier aus keinen Weg. Der richtige Weg ist `supabase functions download`. Die Schnittstelle steht jetzt vollständig in der `BEFUND.md`. |
| `feedback_analysis` = 0 Zeilen | „Nie gedrückt" und „bricht immer ab" sind von hier aus nicht zu unterscheiden. Ein Knopfdruck im Admin-Panel klärt es. (df) |
| Kaltstart 3,3 s (Einsteiger-Telefon) | Untersucht, kein lohnender Angriffspunkt für Teil-Auslagerung. Bräuchte einen echten Aufteilungsschritt. (dj) |
| 3 Verzeichnisse im Repo ohne Auslieferung | `daily-push`, `entitlements`, `push-test` — nie deployed oder entfernt? (df) |


Keine **Release-Blocker** offen.

## 3 · Konventionen

Vor jedem Edit: `CLAUDE.md` lesen (Versionierung, KI-Call-Wrapper, RLS-Regeln,
Multi-Agent-Sync). Nach jedem Edit: Routine-Eintrag oben in Sektion 0 anhängen
+ `GS_VERSION` / `sw.js` / `meta app-version` / `_headers` gemeinsam bumpen.
