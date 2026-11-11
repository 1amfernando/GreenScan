# KREUZ-B · Runde 2 (Kreuzen) — Blickwinkel „fremde Welten"

Stand: `main` v33.58, weiter nur gelesen (11.11.2026). Gelesen: `IDEE-A.md` und
`IDEE-C.md` ganz, das Brett bis 05:05, `AUFGABEN.md`. 39 Funktionsnamen, auf
die A und C bauen, habe ich nachgezählt — jede hat genau eine Definition;
darunter sind alle, die ich unten weiterverwende. Neu gemessen für diese Runde
(Skript `/home/claude/team/ideen/IDEE-B-runde2.js`): die Zahlen zu
Winterschlaf und Hauspflanzen; dazu von Hand die Scan-Korrekturen.

Inhalt: 1 · Antworten auf die 16 fremden Ideen · 2 · fünf Zusammenführungen ·
3 · vier Kreuzungen · 4 · Top 5 und die eine zuerst.

---

## 1 · Antworten — je eine Zeile, mit dem Mechanismus aus einer anderen Welt

### IDEE-A (Alltag)

| Idee | Urteil | Fremde Welt, die sie schärfer oder sicherer macht |
|---|---|---|
| A1 Rückkehr-Runde | **trägt** | Zeitsteuerungen kennen das als Regel für verpasste Läufe: nach einem Stillstand werden N verpasste Termine zu EINEM zusammengezogen, nicht nachgeholt. Schärfer: bei „Zum Teil" ist der gedruckte Giess-Zettel das Übergabeprotokoll — dieselben Zeilen (`gsGiessZettel`) mit Kästchen „hat sie gemacht". |
| A2 Kontroll-Gang | **trägt** — fast dieselbe wie mein Korb-Check, siehe Z2 | Hausarzt und Facharzt: die App stellt keine Diagnose, sie schreibt die Überweisung — Befund, Verdacht, Frage an die Fachperson. |
| A3 Keimprobe | **trägt** | Software nennt es Smoke-Test vor dem Rollout, die Qualitätskontrolle Stichprobe vor der Charge. Schärfer: das Ergebnis eicht meinen Kultur-Fahrplan (siehe K2). |
| A4 Winterschlaf | **trägt** — für mich die stärkste Idee aller drei Dateien | Schweizer Alltag: Kontrollschilder über den Winter hinterlegen — stillgelegt mit Datum, nicht abgemeldet. Gemessen: im November stehen 13 von 29 Gemüse-Kulturen des Aussaatkalenders ausserhalb ihres Erntefensters, darunter Knoblauch und Zwiebeln, die gerade erst gesteckt wurden — As Regel mit dem Pflanzdatum ist also nötig, nicht Zierde. |
| A5 Rechenschaft | **trägt** — siehe Z4 | Wissenschaft: Präregistrierung. Abrechnen kann man nur eine Vorhersage, die vorher feststand. Die Ernte-Schätzung wird heute bei jedem Öffnen neu aus den Kulturdaten gerechnet (Pflanzdatum + Mitte aus `minDays`/`maxDays`); ändert jemand die Kulturdaten, ändert sich die „Vorhersage" rückwirkend. Sicherer: beim ersten Zeigen einfrieren. |
| A6 Nachruf mit Lehre | **trägt** — fast dieselbe wie mein Flugschreiber, siehe Z1 | Flugunfall-Untersuchung: Bericht ohne Schuld, am Ende eine Empfehlung. |
| A7 Fingerprobe | **trägt** — siehe Z5 | Medizin: Dosis-Titration — in kleinen Schritten, erst nach mehreren gleichen Beobachtungen, nie von selbst. A hat das schon so gebaut; die Falle mit dem Intervall-Wähler stimmt (`TASK_DEFS.water` kennt 1, 2, 3, 7, 10, 14, 21 — keine 4). |
| A8 Notfallblatt | **trägt**, Gruppe 2 ist **gefährlich**, wenn sie grün aussieht — siehe Z3 | Arbeitssicherheit: Gefahrstoff-Verzeichnis plus Aushang an der Tür. Gemessen: von 286 Hauspflanzen-Einträgen der Artenliste tragen 76 Giftstufe 2 oder mehr, 20 Stufe 3 oder mehr. |

### IDEE-C (Daten kreuzen)

| Idee | Urteil | Fremde Welt, die sie schärfer oder sicherer macht |
|---|---|---|
| C1 Doppelgänger-Radar | **trägt** — die Grundlage für alles rund um den Fund | Hausarzt-Medizin: der „abwendbar gefährliche Verlauf" — zuerst wird das Gefährliche ausgeschlossen, egal wie unwahrscheinlich. Genau Cs Regel „Saison und Höhe dürfen nur verschärfen". |
| C2 Erst der Doppelgänger, dann der Korb | **trägt**; **gefährlich**, sobald „geübt" wie „darf sammeln" aussieht | Spitalapotheke: Listen verwechselbarer Medikamente — geübt und beschriftet wird das PAAR, nicht das einzelne Mittel. Schärfer: Paar-Karten („Bärlauch oder Maiglöckchen — woran?"). Und aus der Fliegerei: Übung verfällt; eine Karte von vor einem Jahr zählt nicht. |
| C3 Keim-Ampel | **trägt**, heute mit Thermometer von Hand | Bodenleger: vor dem Verlegen wird die Restfeuchte gemessen, nicht „vier Wochen gewartet". Belegreife messen statt Wochen zählen — das ist die Idee in einem Satz. |
| C4 Giess-Rhythmus | **trägt mit Sensor**; ohne Sensor schwach (Regen-Historie nur 7 Tage und nur an Tagen mit App-Start) — siehe Z5 | Regelungstechnik: ein Regelkreis, drei Messglieder verschiedener Güte. |
| C5 Reife-Uhr | **trägt erst mit einem Tagesarchiv, das stimmt** — heute nicht | Das Server-Archiv taugt dafür so nicht: `avg_temp_c` bekommt `current_weather.temperature`, den Momentanwert beim Abruf (Brett 04:51, Aufgabe 10). Eine Temperatursumme daraus hinge an der Uhrzeit, zu der jemand die App öffnet. Wenn, dann aus Tagesminimum und -maximum. |
| C6 Ertragsbilanz | **trägt**, mit einer Auflage | Detailhandel: Umsatz je Quadratmeter funktioniert, weil die Kasse JEDEN Verkauf bucht. Das Ernte-Buch bucht, was jemand einträgt. „Unter Richtwert" kann schlicht „nicht alles eingetragen" heissen — die Zeile braucht „aus N Einträgen" und vergleicht erst, wenn die Person „alles eingetragen" bestätigt. |
| C7 Fundplatz-Gedächtnis | **trägt nicht als Vergleich**, solange nur Funde zählen | Angler führen ein Fangbuch — und tragen auch den Tag ohne Fang ein. Aus drei Erfolgen allein lässt sich „unter welchen Bedingungen" nicht beantworten. 0 Treffer für „ohne Fund", „Nullfang" im Quelltext. Mit dem Besuch ohne Fund trägt es (siehe K4). |
| C8 Vom Beet zum Teller | **trägt** für den Garten; für Wildfunde richtig gesperrt | Grossküche: der kritische Kontrollpunkt vor dem Kochen (Wareneingang). Schärfer: bei den 130 Rezepten mit giftigem Verwechsler steht die Kontrolle als gerechneter Schritt 0 VOR Schritt 1, nicht als Hinweis am Rand. |

Kein „gibt es schon": ich habe bei keiner der 16 einen bestehenden Bau gefunden,
der sie vorwegnimmt.

---

## 2 · Fünf Zusammenführungen — aus je zwei oder drei wird EINE

### Z1 · Nachruf mit Lehre (A6 + Flugschreiber B3)

- **A bringt:** das Blatt mit höchstens drei Zeilen (Giessen · Licht · Wetter),
  die Antippwörter „Was denkst du?", den Fund, dass der Weg nur `myPlants`
  kennt, und dass der Lichtmesser nur den letzten Wert behält.
- **B bringt:** den Bericht ohne Schuld, die Zeitleiste aus dem Verlauf, und
  die Kennzahl „längster Abstand".
- **Die eine Form:** As Name und Blatt; als Giess-Zeile mein „längster Abstand
  19 Tage bei Intervall 7 (aus 6 Einträgen)" — eine Pflanze geht am längsten
  Loch ein, nicht am Durchschnitt, und „4 von 10" liest sich wie eine Schulnote.
  As Zahl steht im aufklappbaren Grund. Die Lehre beim Wieder-Anlegen ist bei
  beiden Scheibe 2.
- **Vorher:** Aufgabe 8 (`doneTask` ohne Verlaufseintrag), sonst steht häufig
  eine falsche Zahl da.

### Z2 · Überweisung zur Pilzkontrolle (Kontroll-Gang A2 + Korb-Check B1)

- **A bringt:** den einen Fund am Waldrand, die vier geführten Fotos, den
  Kontrollzettel mit „NICHT GEPRÜFT", den Zustand „wartet auf Kontrolle", das
  Urteil danach — und die kleinere erste Scheibe.
- **B bringt:** mehrere Funde am Abend, die Liste, die nur stoppen kann, und
  den Bildschirm, auf dem sonst nichts läuft.
- **C1 bringt die Daten:** die aufgelösten Gegenkandidaten mit Giftstufe.
- **Die eine Form:** ein Gegenstand, „Fund", mit einem Lebenslauf — gesammelt →
  durchgegangen → wartet auf Kontrolle → Urteil. Der Korb ist der Behälter, der
  Zettel sein Ausdruck, die Liste entscheidet, was auf dem Zettel als STOPP
  steht, das Urteil schliesst den Kreis.
- **Erste Scheibe:** As Zettel aus dem vorhandenen Ergebnis — ohne Speicher.
  Dann der Korb.
- **Vorher:** Aufgabe 1. Der Pilz-Scanner schreibt keinen Verlauf und hat
  keinen Prüfstands-Fall; der Zettel muss aus BEIDEN Ergebnis-Karten entstehen
  (`showScanResult` und `gsMushroomRenderResult`).

### Z3 · Notfall: das Blatt davor, die Karte währenddessen (A8 + B2)

- **A bringt:** „Was bei uns giftig ist" — beide Pflanzenlisten in drei
  Gruppen, der Holunder-Fall (18 Einträge, Stufe 0 bis 5), der Ausdruck.
- **B bringt:** den festen Einstieg, die Nummer zuerst, „Was?" aus den Scans
  der letzten 24 Stunden, nichts wird gespeichert.
- **Was erst zusammen entsteht:** „Was?" auf der Karte bekommt eine zweite
  Quelle. Ein Kleinkind kaut an der Zimmerpflanze, nicht an einem Scan — dann
  ist mein Scan-Verlauf leer und As Liste die Antwort. Reihenfolge auf der
  Karte: eigene Pflanzen der Gruppe 1, dann Scans, dann „weiss ich nicht".
- **Erste Scheibe:** der Menüeintrag (ohnehin Aufgabe 7) öffnet ein Fenster mit
  der Nummer und As Liste.

### Z4 · Abrechnung (Rechenschaft A5 + Reife-Uhr C5 + Partie-Analyse B4)

- **A bringt:** das Urteil über die APP — Schätzung gegen erste Ernte, als Zahl
  am Ereignis und sonntags in „Deine Woche".
- **B bringt:** das Urteil über die ZÜGE der Person — gesät, gepflanzt,
  geerntet gegen Fenster und Wetter.
- **C bringt:** die erklärende Grösse — die Wärme. „5 Tage später" ist eine
  Zahl; „5 Tage später bei weniger Wärme als im Vorjahr" ist eine Erklärung.
- **Die eine Form:** zwei Spalten, eine Regel. „Was ich vorhergesagt habe" und
  „Was du getan hast", beide gegen das, was eingetreten ist.
- **Erste Scheibe:** As Abstand im Grund des Ernte-Ereignisses. Dazu von mir:
  die Schätzung beim ersten Zeigen festhalten. Meine Zugliste ist Scheibe 2,
  Cs Wärme Scheibe 3 — erst nach Aufgabe 10.

### Z5 · „Wie lange hält das Wasser hier?" (Fingerprobe A7 + Giess-Rhythmus C4 + Wasserkonto B5)

- **A bringt:** den Knopf „Noch feucht", die Regel drei in Folge, die EINE
  Rückfrage mit Vorher und Nachher.
- **C bringt:** mit Sensor die Antwort aus der Kurve („hält 5 Tage, aus 3
  Zyklen") und die Erkennung eines Giessens am Sprung.
- **B bringt:** den Regen über mehrere Tage — als Grund, warum eine Fingerprobe
  nicht zählt, und als eigener Hinweis.
- **Die eine Form:** ein Vorschlag fürs Intervall, drei mögliche Belege, immer
  mit Herkunft: „aus 3 Giess-Zyklen der Kurve" · „aus 3 Fingerproben" · „aus
  dem Regen der letzten Tage". Rangfolge Sensor vor Finger vor Wetter. Geändert
  wird nur mit Ja.
- **Erste Scheibe:** As Knopf und Frage.

---

## 3 · Vier Kreuzungen — was keiner von uns allein hatte

### K1 · Wiedervorlage — der Wecktermin trägt die Lehre

*Winterschlaf (A4) × Partie-Analyse (B4), später × Rechenschaft (A5) und Ertragsbilanz (C6)*

**Herkunftswelt und Mechanismus.** Büro: die Wiedervorlage — eine Akte kommt am
richtigen Tag von selbst wieder auf den Tisch. Buchhaltung: der Saldovortrag —
der Abschluss des einen Jahres ist die Eröffnung des nächsten. Es passt, weil
alle drei Rückblick-Ideen ihre Zahl im Herbst zeigen, wenn man sie liest und
vergisst; gebraucht wird sie im Februar, vor dem nächsten Zug.

**Was passiert.** Sagt die Person beim Winterschlaf „Ja, bis zum Frühling",
schreibt die App neben dem Ruhen EINEN Eintrag in die Zukunft, auf den
Wecktermin derselben Kultur: „Tomaten vorziehen — letztes Jahr: am 20.4. ins
Beet, vor dem Fenster (Mai, Juni)." Später wachsen Zeilen dazu, wo es Daten
gibt: „erste Ernte 5 Tage nach der Schätzung" · „3,7 kg je m², aus 6
Einträgen". Ohne Daten steht nur der Wecktermin.

**Warum neu.** A4 hat den Wecktermin ohne Inhalt, mein „Für 2027 merken"
verlangt, dass jemand die Analyse öffnet, C6 und A5 liefern Zahlen im Herbst.
0 Treffer für `Wiedervorlage`, `Saisonabschluss`.

**Worauf es aufbaut.** `_gsSaeZuPflanze`, `GS_SAE_DB` (`harvest`, `indoor`,
`outdoor`), `gsAussaatEreignisse` (Wecktermin), `snoozedUntil`,
`gsTagebuchSave` (ein Eintrag in der Zukunft erscheint als Erinnerung),
`gsKalenderEreignisse`, später R4 in `_gsKalPruefwerk` und `gsErnteLoad`.

**Kleinste erste Scheibe** (`gs_feat_wiedervorlage`, setzt A4 voraus). Beim
„Ja" ein Zukunfts-Eintrag am ersten Aussaatfenster mit dem Fenster-Urteil über
das Pflanzdatum dieses Jahres. Sonst nichts.

**Woran man es prüft.** `kalender_check`, Uhr 15. November: Pflanzung „Tomate",
gepflanzt am 20.4. → nach „Ja" liegt im Februar genau **1** Erinnerung, ihr Text
nennt „20.4." und „vor dem Fenster"; Pflanzung ohne Datum → Erinnerung ohne
Lehre („Pflanzdatum nicht bekannt"); zweites „Ja" für dieselbe Kultur → weiter
**1**; „Noch nicht" → **0**. Gegenprobe: Lehre aus dem heutigen Tag statt dem
Pflanzdatum → im Text steht „15.11." → rot.

**Risiko.** Eine Lehre vom Vorjahr passt nicht zwingend (anderes Beet, andere
Sorte) — der Text sagt „letztes Jahr" und nennt den Garten. Der Eintrag ist ein
Tagebuch-Eintrag der Person und löschbar. Erbt alle Voraussetzungen von A4:
Snooze-Migration auf dem Server, der löchrige Weg von der Pflanze zur Kultur,
die Monate ab 0.

### K2 · „Warum kommt nichts?" — der Fehlerbaum der Keimung

*Keimprobe (A3) × Keim-Ampel (C3) × Kultur-Fahrplan (B6)*

**Herkunftswelt und Mechanismus.** Störungssuche in der Technik: bei einem
Ausfall prüft man die möglichen Ursachen der Reihe nach, die billigste Prüfung
zuerst, und jede Prüfung schliesst eine Ursache aus. Es passt, weil „es keimt
nicht" genau drei Ursachen hat, die sich messen lassen — und jede der drei
Ideen misst genau eine davon.

**Was passiert.** Meldet der Fahrplan „Keimung überfällig", stehen darunter
drei Zeilen: **Saatgut** — „Keimprobe dieses Tütchens: 4 von 10" oder „nicht
geprüft". **Wärme** — „Boden 8 °C, Buschbohnen keimen ab 10 °C" oder „nicht
gemessen". **Zeit** — „Tag 16, Kulturdaten 7 bis 14". Daraus EIN Satz nach
fester Tabelle: schwaches Saatgut → „neues Saatgut"; gutes Saatgut, kalter
Boden → „warten, nicht nachsäen"; alles gut, Zeit um → „nachsäen"; etwas
unbekannt → „zuerst messen", und zwar die billigste fehlende Prüfung.

**Warum neu.** Mein Fahrplan hätte nur „nachsäen?" gefragt — im kalten März der
falsche Rat. C3 warnt VOR der Aussaat, A3 prüft im Januar; danach fragt niemand
mehr. 0 Treffer für `Fehlerbaum`.

**Worauf es aufbaut.** Der Hinweis „überfällig" aus B6 (`_gsKalHinweis`),
`gs_seed_inventory` mit dem Feld aus A3, `_gsKulturZuPflanze` (`bodentemp`),
`gsMesswerte` (`soil_temp`, nur gemessene Werte), `gsMesswertEintragen`.

**Kleinste erste Scheibe** (`gs_feat_keimdiagnose`, setzt die erste Scheibe von
B6 voraus). Nur Wärme und Zeit: liegt eine Bodentemperatur der letzten 48
Stunden unter der Keimtemperatur der Kultur, heisst der Hinweis „noch zu kalt —
warten" statt „nachsäen?".

**Woran man es prüft.** `kalender_check`: Buschbohnen, gesät vor 16 Tagen
(Spanne 7–14). (a) Boden 8 °C → der Hinweis nennt **8** und **10**, das Wort
„nachsäen" steht **0×**; (b) Boden 14 °C → „seit 2 Tagen überfällig —
nachsäen?"; (c) kein Wert → „Bodentemperatur nicht bekannt — zuerst messen";
(d) Wert älter als 48 Stunden → wie (c), mit dem Alter. Gegenprobe:
Temperaturzweig ausbauen → (a) sagt „nachsäen" → rot.

**Risiko.** 12 der 39 Aussaat-Kulturen haben keine Keimtemperatur (IDEE-C) —
dort bleibt die Zeile „nicht bekannt". Zehn Samen sind eine kleine Stichprobe
(IDEE-A): die Tabelle sagt „schwach", nie eine Prozentzahl. Ein Luftwert ist
keine Bodentemperatur. Keine KI.

### K3 · Ringversuch — Rechenschaft für den Scanner

*Rechenschaft (A5) × das Urteil der Kontrolle (A2) × zwei Brett-Befunde (Gegenprobe 04:47, Pilz-Scanner ohne Verlauf 05:00)*

**Herkunftswelt und Mechanismus.** Medizinische Labors: der Ringversuch — das
Labor bestimmt Proben, deren Wahrheit eine andere Stelle kennt, und sieht
danach schwarz auf weiss, wo es danebenlag. Wetterdienste rechnen dasselbe für
ihre Prozentzahlen. Es passt, weil A5 die Ernte-Schätzung abrechnet — die
Vorhersage mit dem höchsten Einsatz in dieser App ist aber „das ist ein
Speisepilz, 78 %", und die rechnet niemand ab.

**Was passiert.** In der Scan-Historie eine Zeile: „9 Bestimmungen hast du
berichtigt — bei 6 davon war ich mir zu mindestens 85 % sicher." Kommt das
Urteil der Pilzkontrolle dazu (Z2), wird daraus die ganze Rechnung:
„Kontrolliert: 7 · bestätigt: 5 · aussortiert: 2." An der nächsten Bestimmung
derselben Gattung steht dann ein Satz mehr: „Bei Röhrlingen lag ich bei dir
schon einmal daneben."

**Warum neu — mit einem Fund.** Die Wahrheit liegt schon im Gerät und wird
nirgends gezeigt: `gsSubmitScanMistake` legt jede Berichtigung lokal ab
(`gs_scan_corrections`, bis 200 Einträge, mit `ai_name`, `ai_confidence`,
`user_name`). Der Schlüssel steht in 9 Zeilen des Quelltexts
(`grep -n -P "gs_scan_corrections(?!_queue)" index.html`) — der Schreiber,
Speicherlisten, das Backup hin und zurück, Kommentare; eine Anzeige ist nicht
darunter. 0 Treffer für `Ringversuch`.

**Worauf es aufbaut.** `gs_scan_corrections`, `gsSubmitScanMistake`,
`gsNormConfidence` (über denselben Weg wie `_gsScanKonfidenz`),
`_gsBuildScanHistList`, `openScanHistory`, später das Urteil aus Z2.

**Kleinste erste Scheibe** (`gs_feat_ringversuch`). Die eine Zeile in der
Scan-Historie, nur aus den eigenen Berichtigungen. Kein neuer Speicher.

**Woran man es prüft.** `scan_check`: drei Berichtigungen mit `ai_confidence`
0.94 · 88 · 40 — bewusst beide Schreibweisen, Bruch und Prozent — → „3
berichtigt, **2** davon bei mindestens 85 %"; keine Berichtigung → **keine**
Zeile (nicht „0 Fehler"); Berichtigung ohne Sicherheitswert → „bei 1 nicht
bekannt". Gegenprobe: Rohwert statt der einen Normalisierung → 0.94 fällt
durch, die Zahl wird 1 → rot.

**Risiko.** „Nicht berichtigt" heisst nicht „richtig" — die App darf aus
unkontrollierten Scans nie eine Trefferquote machen; gezählt wird nur, was
jemand nachgeprüft hat. Eine Berichtigung ist eine Angabe der Person, kein
Beweis. Kein Artname in ein Analytics-Ereignis. Der Pilz-Scanner fehlt, solange
er keinen Verlauf schreibt (Aufgabe 1) — und das steht dann in der Zeile.

### K4 · Der Platz merkt sich das Urteil — und den Tag ohne Fund

*Fundplatz-Gedächtnis (C7) × Kontroll-Gang (A2), mit der Liste aus dem Korb-Check (B1)*

**Herkunftswelt und Mechanismus.** Das Fangbuch der Angler: Ort, Datum,
Bedingungen — und auch der Tag ohne Fang. Erst mit den Fehlversuchen sagt ein
Protokoll etwas über Bedingungen. Dazu das Tourenbuch der Bergsteiger: was an
einer Stelle einmal gefährlich war, steht dort für das nächste Mal.

**Was passiert.** An einem gespeicherten Fundplatz ein Knopf „War da" mit zwei
Antworten: gefunden · nichts. Jeder Besuch trägt die Regensumme der sieben Tage
davor, wenn sie gemessen ist. Trägt die Person nach der Pilzkontrolle das
Urteil ein, landet es am Platz: „21.9.: Kontrolle hat 1 aussortiert —
Gallenröhrling." Beim nächsten Fund von diesem Platz hat die Liste aus Z2 einen
Pflichtpunkt mehr: „Hier hat die Kontrolle schon einmal aussortiert:
Gallenröhrling."

**Warum neu.** C7 zählt nur Funde, A2 lässt das Urteil am einzelnen Fund
stehen. Dass an DIESEM Platz ein bestimmter Doppelgänger wächst, weiss danach
niemand mehr. 0 Treffer für „ohne Fund", „Nullfang".

**Worauf es aufbaut.** `greenscan_markers` über `gsAddMarker`, `_gsFundZeit`,
`gsOpenMyFinds`, `gsWetterGeraetAbgleich` (Regen der letzten sieben Tage),
`_gsArtenTreffer` für den Namen des Aussortierten, das Urteil aus Z2.

**Kleinste erste Scheibe** (`gs_feat_fangbuch`). Nur der Besuch ohne Fund:
Knopf am Platz, Liste der Besuche mit Regensumme, ohne Vergleich.

**Woran man es prüft.** `kalender_check` (liest die Fundorte schon): ein Platz
mit zwei Funden (30 und 41 mm) und einem Besuch ohne Fund (4 mm) → „**2 von 3**
Besuchen mit Fund"; ein Platz mit zwei Besuchen → nur die Liste, kein „von";
Besuch ohne Regenwert → „Regen davor: nicht bekannt". Gegenprobe: Besuche ohne
Fund ausfiltern → „2 von 2" → rot.

**Risiko.** Fundplätze sind das Geheimste, was Sammler haben, und Standortdaten:
alles bleibt am Gerät, nichts in ein Ereignis, das Wetter kommt vom Wohnort und
heisst auch so (IDEE-C). Drei Besuche sind keine Vorhersage — „bei deinen
Besuchen", nie „Chance". Das Urteil ist Freitext der Person und wird als Text
behandelt. Ein Platz ohne Urteil ist nicht „unbedenklich".

---

## 4 · Top 5 über alle drei Dateien und die Kreuzungen

*(Geschrieben, bevor ich `KREUZ-A.md` und `KREUZ-C.md` gelesen habe — beide
entstanden gleichzeitig. Was sich danach ändert, steht in §5.)*

1. **Winterschlaf (A4), mit Wiedervorlage (K1).** Die einzige Idee, die einen
   Fehler behebt, den heute jeder Garten-Nutzer sieht: Freiland-Pflanzungen
   mahnen „giessen alle 3 Tage" das ganze Jahr (`GS_PFLANZUNG_VORGABEN`), und
   im November sind 13 von 29 Gemüse-Kulturen aus ihrem Erntefenster.
2. **Notfall: Blatt und Karte (Z3 = A8 + B2).** Höchster Einsatz bei kleinster
   Scheibe; die Menü-Suche findet „Notfall" heute nicht, und 76 von 286
   Hauspflanzen-Einträgen sind mit Stufe 2 oder mehr geführt.
3. **Doppelgänger-Radar (C1).** Macht aus einem Textfeld 186 gerechnete Paare
   „essbar → giftig" und ist die Datengrundlage für Z2, C2, C8 und K4.
4. **Überweisung zur Pilzkontrolle (Z2 = A2 + B1).** Schliesst die Lücke
   zwischen Scan und Teller, ohne dass die App je „essbar" sagt — braucht
   vorher Aufgabe 1.
5. **„Wie lange hält das Wasser hier?" (Z5 = A7 + C4 + B5).** Macht die Person
   zum ersten Messgerät, täglich, und ist derselbe Weg, den später der Sensor
   nimmt.

Knapp dahinter: Abrechnung (Z4) und Keimprobe (A3).

**Die eine, die ich zuerst bauen würde: Winterschlaf (A4).** Sie ist jetzt
fällig — die Saison ist am 11. November vorbei, das Fenster dieser Idee reicht
bis Februar — sie braucht keinen neuen Schlüssel, und sie ist die Idee, die
niemand von einer Pflanzen-App erwartet: eine App, die von sich aus sagt „ich
bin jetzt still, bis zum 1. Februar". Zwei Dinge gehören vor den Bau gemessen:
ob der Server `snoozedUntil` kennt (sonst ruht die App und der Push kommt
trotzdem), und wie viele Pflanzungen den Weg zur Kultur gar nicht finden.

Den Menüeintrag „Notfall" würde ich unabhängig davon sofort setzen — das ist
kein Ideen-Bau, sondern Aufgabe 7.

## 5 · Nachtrag — nach dem Lesen von KREUZ-A und KREUZ-C

Die drei Kreuz-Dateien wurden gleichzeitig geschrieben (alle 05:14). Was
übereinstimmt, ist also unabhängig entstanden.

### 5.1 · Wo wir unabhängig an derselben Stelle ankamen

| Stelle | KREUZ-A | KREUZ-B | KREUZ-C |
|---|---|---|---|
| Keimung überfällig: Saatgut · Boden · Zeit nebeneinander | K1 Keim-Kette | K2 Fehlerbaum | X2 Keim-Befund (und Z6) |
| Der Scanner wird abgerechnet | — | K3 Ringversuch | X1 Bestimmungs-Bilanz |
| Dieselben fünf Zusammenführungen | M1–M5 | Z1–Z5 | Z1–Z5 |
| Erste Scheiben von Nachruf, Notfall, Abrechnung, Wasser | gleich | gleich | gleich |
| Zuerst bauen | Winterschlaf | Winterschlaf | Radar (Winterschlaf auf Platz 2) |

Für die Keim-Kreuzung gibt es damit drei Namen und drei Schalter
(`gs_feat_keimkette` · `gs_feat_keimdiagnose` · `gs_feat_keimbefund`) — der Head
wählt einen.

### 5.2 · Wo wir uns unterscheiden — zwei Entscheide für den Head

1. **Keim-Kreuzung: schliessen oder nebeneinanderlegen?** A und C legen die drei
   Zeilen nur nebeneinander („das Wort ‚weil' kommt nicht vor"). Ich leite EINEN
   Satz aus einer festen Tabelle ab. Mein Satz benutzt nur Schlüsse, die A3 und
   C3 einzeln schon ziehen (unter 5 von 10 → ersetzen; unter der Keimtemperatur
   → warten). Die vorsichtigere Form ist trotzdem leicht zu haben: Tabelle
   weglassen, nur die Reihenfolge „billigste fehlende Prüfung zuerst" behalten.
   Und ein gemeinsamer Fall genügt: A und C nehmen den Radieschen-Fall aus
   meinem Fahrplan (gesät 20.8., seit 2 Tagen überfällig; Keimtemperatur der
   Kultur 5 °C, nachgesehen) — mein Buschbohnen-Fall kann dafür entfallen.
2. **Reihenfolge der Kontrollkette.** Ich hatte den Zettel zuerst, A den Korb, C
   das Radar. Nach dem Lesen: **C hat recht.** Das Radar an der Artenkarte
   braucht weder Speicher noch die Pilz-Karte; Zettel und Korb hängen beide an
   Aufgabe 1.

### 5.3 · Was die anderen an MEINEN Ideen gemessen haben — übernommen

- **Wasserkonto, erste Scheibe (C): trägt kaum.** Ohne eigenen Abruf kennt das
  Wetter-Gerät am Morgen rund 9 von 72 Stunden; „nicht bekannt" wäre der
  Normalfall. Das deckt sich mit dem Code (der Lader holt sieben Tage voraus,
  nichts zurück). Ich ziehe „kein neuer Abruf" zurück: der Regen-Rückblick
  braucht einen eigenen Abruf mit eigenem Schlüssel. Den Aufruf gibt es in der
  App schon einmal — `past_days=3` in der Pilz-Vorhersage (1 Zeile). Für drei
  Tage ist mein Vorbehalt „Rückblick nicht belegt" damit erledigt, für mehr nicht.
- **Notfall-Übergabe (C):** der Scan-Verlauf lässt sich abschalten
  (`userPrefs.scanHistory === false` in `gsAddScanHistory`, nachgesehen). Die
  Karte braucht dafür einen eigenen Satz — „Verlauf ist ausgeschaltet" ist nicht
  „kein Scan".
- **Notfallblatt (C):** 1'383 Einträge gelten beim Laden als ungeprüft, alle mit
  Stufe 0. Sie gehören in „nicht bekannt", nie in „nicht als giftig geführt".
- **Licht-Zeile im Nachruf (C):** einen Listenwert gibt es bei 40 Arten; für
  alle anderen käme ein Rückfall nach Kategorie. Die Zeile heisst dort „nicht
  bekannt". Mein Lux-Beispiel in Idee 3 gilt nur für diese 40.
- **Rundgang (A):** täglich geht niemand mit dem Telefon durchs Beet. Mit Anlass
  ja — vor und nach den Ferien, nach einer Frostnacht. As Ferien-Klammer (K2) ist
  die bessere Fassung meiner Idee 8.
- **Jahreszeit-Peilung (C):** ohne Quelle keine Phasen-Namen. Die erste Scheibe
  sagt „Apfel blüht — beobachtet am 21.4.", nicht „Vollfrühling". Cs Blüten-Uhr
  (X4) gibt der Beobachtung schon im ersten Jahr einen Gegenwert.
- **Korb (A):** den Korb mit den heute als essbar gemeldeten Scans vorbelegen,
  zum Abwählen — statt eines Tipps mit nassen Fingern.
- **Ringversuch (C):** Cs Sperre ist die bessere Regel — kein Prozentzeichen,
  unter drei Fällen nur die Einzelfälle. Mein Beitrag bleibt die erste Scheibe
  ohne neues Feld (`gs_scan_corrections`).

### 5.4 · Top 5, nach dem Lesen aller Kreuzungen

Zwei Änderungen gegenüber §4: As **Rückruf** kommt hinein, und Radar und
Überweisung sind EINE Kette (Cs Form).

1. **Winterschlaf (A4), mit Wiedervorlage (K1).** Unverändert. C hat die
   Reichweite gezählt: der Weg von der Pflanze zur Aussaat-Kultur trägt bei 24
   von 40 Gemüse-Einträgen der Artenliste — die übrigen bleiben aktiv, und die
   Karte sagt, wie viele.
2. **Notfall: Blatt und Karte (Z3).** Unverändert.
3. **Rückruf (KREUZ-A K3).** Die einzige Idee, die eine Berichtigung der
   Artenliste zu denen bringt, die die Art schon gescannt haben — und sie muss
   da sein, bevor ARTENs Berichtigungen ausgeliefert werden. Aus meinem
   Blickwinkel der sauberste übertragene Mechanismus der Runde: gezielt, nur
   verschärfend, mit Quittung.
4. **Kontrollkette: Radar → Korb → Kontrollzettel (C1 + Z2).**
5. **„Wie lange hält das Wasser hier?" (Z5),** mit der Fingerprobe zuerst und
   As Stimmen-Leiter (K4) als Quellenangabe an der Zeile.

**Zuerst bauen: weiter Winterschlaf.** A kommt unabhängig zum selben Schluss; C
setzt das Radar zuerst und Winterschlaf auf Platz 2.

## Nicht gemessen

- Die Zahlen aus KREUZ-A und KREUZ-C (1'383 · 24 von 40 · 9 von 72 Stunden)
  habe ich nicht nachgerechnet; nachgesehen habe ich nur die drei Stellen, die
  ich übernehme (`scanHistory`, `past_days`, Keimtemperatur Radieschen).
- Weiter nichts im Browser gefahren, kein Prüfstand.
- Ob die Snooze-Migration auf dem Server angewandt ist (kein Live-Zugriff).
- Die Zahl „13 von 29" zählt Erntemonate ohne Pflanzdatum; wie viele echte
  Pflanzungen betroffen sind, weiss ich nicht.
- `gs_scan_corrections`: dass keine Anzeige es liest, steht auf der Durchsicht
  der 9 Fundzeilen, nicht auf einem Lauf.
