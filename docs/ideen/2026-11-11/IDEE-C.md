# IDEE-C · Blickwinkel „Daten kreuzen" — Runde 1 (Sichten)

Stand: `main` = v33.58, nur gelesen, nichts im Repo geändert. Gemessen am 11.11.2026.
Jede Zahl unten ist gezählt, mit den ECHTEN App-Funktionen (aus `index.html` in eine
Node-Sandbox geladen: `gsSaisonMonate`, `_gsHoehenband`, `_gsArtenTreffer`, `_gsArtAnzeige`,
`_gsKulturZuPflanze`). Nachfahren: `/home/claude/team/ideen/IDEE-C-zaehlskripte/`
(`node zaehl3.js` zuerst, dann `zaehl7.js` (16 s), dann die übrigen).

**Nicht gemessen** (kein Live-Zugriff, tabu): wie viele echte Nutzer Fundorte, Ernte-Einträge,
Messwerte oder Garten-Masse haben; Zeilenzahlen der Server-Tabellen (`plant_companion_matrix`,
`mushroom_lookalikes`, `weather_log_per_garden`); alles zur Community. Wo eine Idee daran hängt,
steht es dabei.

---

## 1 · Die Datenquellen — was es wirklich gibt

| Quelle | Eigner / Leser | Felder, die tragen (gezählt) | Felder, die NICHT tragen |
|---|---|---|---|
| **Artenliste** `data/plants.v1.js` | `DB`, `_gsArtAnzeige(sp)` | 4'342 Einträge roh, 3'136 Binome (661 mehrfach, über `_gsNormLat` gezählt; die Doku nennt 657). `tox`/`edible`/`cat` 100 % (tox 0: 3'658 · 1: 136 · 2: 257 · 3: 160 · 4: 59 · 5: 72; `edible` 1'233; `protected` 37). `season` lesbar 2'907 (67 %), davon mit ECHTEM Fenster (< 12 Monate) 2'314 (53 %). `habitat` 78 %. `lookalike` 2'907 (67 %) | `alt`/`color` 22 %; Höhenband lesbar 903 (21 %; Wildpflanzen 10 %, Hauspflanzen 0 %). `lightMin/Max` 40 Einträge (0,9 %). `season` bei Flechten 0 %, Moosen 5 % echtes Fenster. `warning` sagt bei 1'613 von 2'932 „Keine …" |
| **Verwechsler** (Feld `lookalike`, Freitext) | nur als Text angezeigt | über `_gsArtenTreffer` lösen 1'180 Einträge (41 % derer mit Text, 27 % der Liste) auf ≥ 1 ANDERE Art auf → 755 Binome; 186 Paare „essbares Binom → Binom mit tox ≥ 3" | 59 % der Texte nennen keine Art der Liste („andere Kräuter gleicher Familie", „Karbolchampignon" ohne Bindestrich) |
| **Kulturdaten** `PLANT_DB` | `_gsKulturZuPflanze(p)` | 41 Kulturen. `minDays/maxDays`, `sun`, `water`, `frost` 41 (frost −1: 11). `bodentemp` (Zahl, 4–15 °C) 39. `yield_kg_m2` 39 (35 als kg lesbar, 4 „Stück"). `pflanzabstand/reihenabstand` 39. `gut_mit` 137 / `schlecht_mit` 79 Nennungen | `lightMin` 2. Gradtage/Basistemperatur: kein Feld |
| **Aussaatkalender** `GS_SAE_DB` | `gsAussaatEreignisse`, `_gsSaeZuPflanze` | 39 Kulturen, Monate 0-basiert, `indoor`/`outdoor`/`harvest` 100 % | gilt für „mittlere Lagen 400–800 m" (steht im Grund-Text) |
| **Standort** `gs_user_location` | — | lat/lon, Name, Kanton | `elevation`: 0 Schreiber. `lon`/`lng` uneinheitlich (Befund auf dem Brett, ORT baut) |
| **Wetter** `gs_weather_cache` | `_gsWetterTage()`, `gsRegenGefallen()` | 7 Tage: Tagesmin/-max, Regensumme, Regenwahrscheinlichkeit, Wind, UV; Stundenwerte | keine Bodentemperatur, keine Verdunstung im Lader `loadGardenWeather`. Historie lokal: nur 7 Tage (Wetter-Gerät). Server-Tagesarchiv `weather_log_per_garden`: 1 Schreiber, **0 Leser** |
| **Kalender** | `gsKalenderEreignisse(von, bis)`, `_gsKalPruefwerk` | 11 Ereignisarten (inkl. `scan`, `fund`); im Prüfwerk gebaut: R1, R2, R4, R5, R6, R9 (R3 als Tor in der Rechnung, R10 als `_gsKalWoche`) | Boden, Höhe, Verlauf über mehrere Tage |
| **Meine Pflanzen / Pflanzungen** | `_gsPflanzeFinden(id)` | `tasks[key]` mit Intervall und `lastDone`; `p.diary` (Giess-Historie); `plantings`: `gardenId`, `date`, `count`, `variety` | Art nur als Freitext `name` + evtl. `species` |
| **Garten / Zwilling / Planer** | `gardens`, `gsTwinGet`, `_gsPlanPruefwerk` | Garten: `kind` (7 Arten, `unter_glas`), `width`, `length`, `soil`. Zwilling: je Pflanze `x_m y_m w_m h_m`, `light`, `latin`. Planer: 16 Prüfschritte in `_gsPlanPruefwerk` | `width/length` optional |
| **Messwerte / Geräte / Regeln** | `gsGeraete()`, `gsMesswerte`, `gsRegelnPruefen(id)` | 11 Messgrössen im Katalog (u. a. `soil_moisture`, `soil_temp`, `air_temp`, `light`, `rain`); `quality`; Deckel lokal 2'000 Werte | Tagesaggregat (`device_daily`): Migration bereit, nicht angewandt |
| **Scan-Verlauf** `gs_scan_history` | `_gsScanZeit(h)`, `_gsScanKonfidenz(h)` | Deckel 200; `name`, `latin`, `conf`, `tox`, `edible`, `category`, `context{lat, lon, locName}` | Koordinaten unzuverlässig (siehe Standort) |
| **Fundorte** `greenscan_markers` | `_gsFundZeit(f)`, `gsOpenMyFinds` | `lat`, `lng`, `date` (100 %), `cat` (10 Kategorien), `name` | `name` ist Freitext, keine Art-ID |
| **Ernte-Buch** `gs_ernte_log` | `gsErnteLoad()` | `pflanze` (Freitext), `menge`, `unit` (g kg stk bund ml l), `ts` | Bezug zur Pflanzung nur über Namen oder `plant_local_id` (nur Cloud-Zeilen) |
| **Rezepte / Heilmittel** | `_gsRecipeAllowedPlantIds(r)` | 524 Einträge (500 + 24); 481 mit `plantIds` (92 %) → 112 Binome, 108 davon mit echtem Saisonfenster | 43 ohne `plantIds` |
| **Lernstand** `gs_dq_training` | `gsTrainingLaden()`, `gsTrainingBuchen` | Karten je „Binom\|Typ" mit Box, richtig, falsch; Deckel 500; 7 Typen | kein Bildfeld — geübt wird Wissen, nicht Erkennen |
| **Community** | Server | — | nicht gemessen |

**Drei Join-Schlüssel entscheiden, was sich kreuzen lässt** — das ist die eigentliche Erkenntnis der Zählung:

1. **Binom** (Artenliste ↔ Rezepte ↔ Scan ↔ Lernstand) über `_gsNormLat`: sauber.
2. **Kulturname** (Pflanzung ↔ `PLANT_DB` ↔ `GS_SAE_DB`) über Namensregel ±n und `_GS_SAE_BRUECKE`: löchrig.
   Von den 40 Gemüse-Einträgen der Artenliste erreichen 10 keine Kultur — darunter die Tomate
   (`PLANT_DB.Tomaten.latName` = „Lycopersicon lycopersicum", Artenliste „Solanum lycopersicum";
   Befund auf dem Brett). 27 der 39 Aussaat-Kulturen tragen eine Bodentemperatur, 12 nicht.
3. **Freitext** (Fundort-Name, Ernte-Buch `pflanze`, `lookalike`) nur über `_gsArtenTreffer`: beim
   `lookalike` 41 % Auflösung.

Jede Idee unten sagt, auf welchem Schlüssel sie steht.

---

## 2 · Was schon gekreuzt wird — keine neue Idee

| Kreuzung | Wo |
|---|---|
| Frost × Aussaat draussen; Frost × frostempfindliche Pflanze draussen | `_gsKalPruefwerk` R1, R6 |
| Regen × Giessen heute | `_gsRegenUebernimmt`, R2 |
| Pflanzdatum × Kulturdauer → Ernte-Schätzung; Schätzung × Ernte-Buch | Kalender Nr. 4 / R3, R4 |
| Abwesenheit × Aufgaben | R9, `gsGiessZettelFenster` |
| Scan × Monat × Farbe × Höhe (Plausibilität, Vorauswahl) | `_gsScanPruefwerk` S3 S6 S7, `gsScanVorauswahl` |
| Eigene Arten × Saison (Blühkalender) | `_gsBlMeineArten`, `gsBluehtJetzt` |
| Sensor × Aufgabe (vorziehen); Giessen × Bodenfeuchte (ein Zeitpunkt) | `gsSensorAufgabenAbgleich`, `gsGiessBestaetigung` |
| Art/Kultur × Schwellwert-VORLAGE (Licht 40 Arten, Bodentemperatur 39 Kulturen) | `gsSchwellwertVorlagen` — füllt nur ein Formular |
| Plan × Aussaatfenster, Saatgut, Regen, Frost, echte Fruchtfolge, Licht, Nachbarn | `_gsPlanPruefwerk` (16 Prüfschritte) |
| Rezept → Art, mit Giftsperre | `_gsRecipeAllowedPlantIds`, `rezept_link_check` |
| Lina-Antwort × Giftstufe | `_gsLinaSicherheit` |
| Pilz-Verwechsler als Paare (kuratiert, online, nur Pilze) | Server `mushroom_lookalikes` — laut Migrations-Kommentaren v29.63b/v29.84b mindestens 27 Paare |
| Sensor − Prognose als Zahl | steht als Idee in `docs/OEKOSYSTEM-V1.md` §11 Nr. 10 Stufe 1 — nicht gebaut, aber nicht neu |

---

## 3 · Kreuzungstabelle — A × B → welche Frage lässt sich jetzt RECHNEN?

| A × B | Die Frage | Stand |
|---|---|---|
| Artenliste × Artenliste (`lookalike` als Kante) × Scan × Monat × Höhe | Welche giftige ART kann das auch sein — und ist sie hier und jetzt zu erwarten? | **neu → C1** |
| Verwechsler-Graph × Lernstand × eigene Arten | Welchen Doppelgänger dessen, was ICH sammle, habe ich nie richtig beantwortet? | **neu → C2** |
| Aussaatfenster × `bodentemp` × Messwert `soil_temp` | Ist der Boden an MEINEM Beet heute warm genug zum Keimen? | **neu → C3** (Sensor) |
| Bodenfeuchte-Reihe × Giess-Ereignisse × Regen × Intervall | Wie viele Tage hält das Wasser hier wirklich? | **neu → C4** (Sensor) |
| Pflanzdatum × erste Ernte × Tagestemperaturen | Wie viel Wärme brauchte MEINE Kultur — und wo steht die diesjährige? | **neu → C5** (Sensor) |
| Ernte-Buch × Fläche × `yield_kg_m2` | Was brachte ein Quadratmeter gegen den Richtwert? | **neu → C6** (`yield_kg_m2`: 0 Leser) |
| Fundorte × Datum × Wetter davor | Unter welchen Bedingungen war ich an DIESEM Platz erfolgreich? | **neu → C7** |
| Rezepte × echter Bestand × Verwechsler | Was kann ich aus dem kochen, was ich wirklich habe — und wo steht ein Kontrollschritt? | **neu → C8** |
| Frost × Aussaat, Regen × Giessen, Plan × alles | — | gibt es (§2) |
| Lichtmessung × Art (`lightMin`) × Sonnenstand | Reicht das Licht im Winter? | **trägt nicht**: 40 Arten (0,9 %) |
| Standort-Höhe × Artenliste (`alt`) | Was wächst auf meiner Höhe? | **trägt schwach**: 21 %, und `elevation` hat 0 Schreiber |
| Mischkultur-Matrix × Garten-Zwilling (Abstände wirklicher Pflanzen) | Stehen im ECHTEN Beet zwei schlechte Nachbarn zu nah? | **Kandidat für Runde 2** — lokal 79 „schlecht mit"-Nennungen über 39 Kulturen, Server-Matrix nicht gezählt; `_gsZuNah` gibt es schon für den Plan |
| Community × irgendetwas | — | nicht gemessen |

---

## 4 · Die Ideen

**Für alle acht gilt** (damit es nicht achtmal dasteht): Jede rechnet im Browser und ohne KI.
Jeder neue Schalter `gs_feat_<name>` gehört namentlich in `GS_KEEP_ON_LOGOUT` (dort steht
`gs_feat_aiproxy` unter „Entwickler-Schalter"), sonst meldet `storage_check` ihn. Jeder Satz geht
durch `_gsSatz`/`_t` (vier Sprachen), jede gedeckelte Liste sagt „+N weitere", jede Aussage trägt
ihren `grund`. Auf dem Bildschirm heisst der dritte Zustand „Nicht bekannt". Die Beispielzahlen in
„Was passiert" sind Muster — die Prüfzahlen stehen unter „Woran man es prüft".

### C1 · Doppelgänger-Radar

- **Kreuzung:** Artenliste × Artenliste (das Feld `lookalike`, über `_gsArtenTreffer` zu Arten aufgelöst) × Scan-Ergebnis/Artenkarte × Monat (`gsSaisonMonate`) × Höhe (`_gsHoehenband`).
- **Die Frage:** Welche als giftig geführte ART — nicht: welches Wort — kann das sein, was ich gerade bestimmt habe, und ist sie hier und jetzt zu erwarten?
- **Was passiert:** Unter „Verwechslungsgefahr" steht heute ein Satz. Neu steht dort eine Reihe antippbarer Gegenkandidaten, jeder mit seiner Giftstufe aus `_gsArtAnzeige` und — nur verschärfend — „hat jetzt Saison" / „kommt auf deiner Höhe vor". Bärlauch im April: „Maiglöckchen — tödlich giftig — hat jetzt Saison (Apr–Jun)" und „Herbstzeitlose — tödlich giftig" (ohne Saisonzeile). Darunter unverändert der Originaltext. Ein Antippen öffnet die Karte des Doppelgängers.
- **Warum neu:** `grep -n "_gsArtenTreffer(" index.html` → 4 Zeilen: die Definition und drei Aufrufer, alle in Lina. `showScanResult` zeigt `r.lookalike_warning`, `openDetail` zeigt `sp.lookalike` oder eine Kategorie-Vorlage — beides Text. Die kuratierte Server-Tabelle `mushroom_lookalikes` deckt nur Pilze, nur online, an den Saison-Pilz-Karten.
- **Worauf es aufbaut:** `_gsArtenTreffer`, `_gsArtAnzeige`, `_gsVorsichtigste`, `_gsPasstMonat`, `_gsPasstHoehe`, `_gsScanPruefwerk` (als weitere Regel mit drei Zuständen), `openDetail`, `showScanResult`. Join-Schlüssel: Freitext → Binom.
- **Datenlage:** 2'907 Einträge mit Text; 1'180 lösen auf ≥ 1 andere Art auf (41 %); 755 Binome. Von 641 essbaren Binomen haben 92 (14 %) einen aufgelösten Verwechsler mit tox ≥ 3; das sind 186 Paare. 176 Paare haben beidseitig ein echtes Saisonfenster (161 überlappen, 15 nicht), 110 beidseitig ein Höhenband. 98 von 253 Texten, die „giftig/tödlich" sagen, lösen KEINE giftige Art auf — dort ist die Frage nicht prüfbar, und das wird gesagt.
- **Kleinste erste Scheibe:** nur `openDetail`, nur aufgelöste Arten mit tox ≥ 3, ohne Saison und Höhe. Hinter `localStorage.gs_feat_radar`.
- **Woran man es prüft:** `scan_check` (liest `lookalike` und `_gsScanPruefwerk` schon), mit der echten Artenliste. *Verletzt:* P001 Bärlauch → 2 Arten, beide tox 5. *Nicht prüfbar:* PI475 „Echter Wiesenchampignon" (Text „Knollenblätterpilze, Karbolchampignon", aufgelöst 0) → „2 Verwechsler genannt, keiner in der Artenliste gefunden", Text bleibt sichtbar. *Erfüllt:* F115 „Echter Steinpilz" → Gallenröhrling tox 0: Zeile ohne Warnfarbe und ohne ein entwarnendes Wort. Zahl über die ganze Liste (`zaehl14.js`): verletzt 281 Einträge (171 davon selbst essbar) · erfüllt 899 · nicht prüfbar 1'727 — Summe 2'907; Gegenprobe (Auflösung zurückgebaut): 0 · 0 · 2'907. **Sperrfall:** Uhr auf 15. April, Bärlauch — im HTML steht zur Herbstzeitlose weder „keine Saison" noch „nicht jetzt"; über alle 186 Paare 0 Entwarnungssätze.
- **Risiko:** (1) **Die Saison ist Blüte- oder Fruchtzeit, nicht „Pflanze sichtbar".** Bärlauch [Apr–Jun] × Herbstzeitlose [Aug–Okt] überlappt rechnerisch nicht; eine Zeile „Doppelgänger hat gerade keine Saison" wäre eine tödliche Entwarnung. Saison und Höhe dürfen nur verschärfen. (2) 174 der 303 gefährlichen Kanten kommen über die Namensfamilien-Regel („Gefleckter Schierling" zieht den Wasser-Schierling mit) — Richtung Vorsicht, aber als „laut Namensabgleich" zu kennzeichnen. (3) Keine Gegenkandidaten heisst „keine Verwechslungsangabe aufgelöst", nie „keine Verwechslungsgefahr". (4) `_unverified`-Einträge sind kein Beleg.

### C2 · Erst der Doppelgänger, dann der Korb

- **Kreuzung:** Lernstand (`gs_dq_training`) × Verwechsler-Graph aus C1 × eigene Arten (Scan-Verlauf, Fundorte, Ernte-Buch, „Meine Pflanzen").
- **Die Frage:** Welche giftigen Doppelgänger der Arten, die ICH sammle, habe ich noch nie richtig beantwortet?
- **Was passiert:** In „Üben" eine Gruppe „Deine Doppelgänger (N offen)". In der Artenkarte von Bärlauch: „Maiglöckchen: 0 von 3 Karten sitzen · Herbstzeitlose: noch nie geübt" mit „Jetzt üben".
- **Warum neu:** `gsTrainingNaechste` zieht neue Karten zufällig aus der ganzen Liste — wörtlich `var sp = pool[(Math.random() * pool.length) | 0];`. Die Funktion liest weder Scans noch Fundorte.
- **Worauf es aufbaut:** `gsTrainingNaechste(kat)`, `_gsTrainingSchluessel(sp, typ)`, `gsTrainingBuchen`, `_gsTrainingTypOk`; `_gsBlMeineArten()` sammelt „deine Arten" schon aus drei Quellen für den Blühkalender — diese eine Funktion erweitern, keine zweite bauen. Join-Schlüssel: Binom (sauber).
- **Datenlage:** wie C1 (92 essbare Binome mit giftigem Verwechsler, 186 Paare). Giftstufe, Essbarkeit, Kategorie stehen an 100 % der Einträge; Saison-Karten gehen bei 67 %, Standort-Karten bei 78 %. Die Liste hat kein Bildfeld.
- **Kleinste erste Scheibe:** `gsTrainingNaechste` bekommt die Quelle `'doppelgaenger'` vor `'neu'`. Hinter `localStorage.gs_feat_lerndeck`.
- **Woran man es prüft:** `quiz_check` (fährt `gsTrainingNaechste`). *Erfüllt:* Scan-Verlauf mit Bärlauch, leeres Deck → nächste Karte gehört zu *Convallaria majalis* oder *Colchicum autumnale*, Quelle `'doppelgaenger'`. *Nicht prüfbar:* eigene Art ohne aufgelösten Verwechsler (PI475) → Grund „Verwechsler dieser Art stehen nicht in der Liste". *Kein Fall:* ohne eigene Arten → wie heute `'neu'`, mit Grund. Gegenprobe: Quelle zurückgebaut → Karte kommt aus dem Zufall, „0 von 1".
- **Risiko:** Ein „sitzt" ist kein Sammel-Freibrief. Wortwahl „geübt", nie „beherrscht" oder „sicher". Kein Standort nötig; der Lernstand reist schon im State-Blob.

### C3 · Keim-Ampel am eigenen Beet  *(Sensor-Idee, heute schon mit Thermometer)*

- **Kreuzung:** Aussaatfenster (`gsAussaatEreignisse`, `fenster: 'outdoor'`) × `PLANT_DB.bodentemp` × Messwert `soil_temp` am Garten oder an der Pflanze.
- **Die Frage:** Ist der Boden an MEINEM Beet heute warm genug zum Keimen — der Kalender sagt nur den Monat für mittlere Lagen?
- **Was passiert:** An der Aussaat-Zeile ein Hinweis des Prüfwerks. *Verletzt:* „Boden 8 °C (Gerät ‚Balkon Süd · Erde', heute 07:10) — Buschbohnen keimen ab 10 °C. Lieber warten." *Nicht bekannt:* „Keine Bodentemperatur gemessen — 5 cm tief messen und eintragen", mit dem bestehenden Eingabefenster.
- **Heute ohne Gerät:** die Person misst von Hand (Stufe 0 „die Person als erstes Gerät"; das Formular und die Messgrösse gibt es). **Mit eigenem Sensor:** jeden Morgen von selbst — und über Wochen die Zahl, die sonst niemand hat: an welchem Tag dein Beet die Keimtemperatur wirklich erreicht. Das löst die Höhenlage durch Messen statt durch Faustregel (`docs/KALENDER-V2.md` §10 schliesst Höhenlage als *Rechnung* aus).
- **Warum neu:** `bodentemp` hat ausserhalb der Daten zwei Leser — die Schwellwert-Vorlage (füllt ein Formular) und das Pflanzendetail (Anzeige). `grep -n "soil_temp" index.html` → 5 Zeilen, keine in `_gsKalPruefwerk`.
- **Worauf es aufbaut:** `_gsKalPruefwerk` (neue Regel neben R1), `_gsKalHinweis`, `_gsKulturZuPflanze(p).k.bodentemp`, `_gsPflanzeGeraete(p)`, `gsMesswerte(id, 'soil_temp')` mit `quality === 2`, `gsMesswertEintragen`. Join-Schlüssel: Kulturname (löchrig).
- **Datenlage:** `bodentemp` als Zahl bei 39 von 41 Kulturen (95 %). Von den 39 Kulturen des Aussaatkalenders tragen 27 (69 %) eine Zahl; 12 nicht (Chili, Aubergine, Feldsalat, Rucola, Pastinaken, Grünkohl, Koriander, Sonnenblumen, Ringelblumen, Kapuzinerkresse, Zinnien, Tulpen) → „nicht bekannt". Wie viele Nutzer einen `soil_temp`-Wert haben: nicht gemessen, vermutlich fast keiner — deshalb ist der dritte Zustand hier die Einladung.
- **Kleinste erste Scheibe:** nur die Regel und der Hinweis, nur aus Messwerten der letzten 48 Stunden. Hinter `localStorage.gs_feat_keimampel`.
- **Woran man es prüft:** `kalender_check` (Uhr steht auf 01.09.2025; Spinat hat `outdoor` im September und `bodentemp` 4). Pflanzung „Spinat" im Garten `g1`, Gerät am Garten. *Verletzt:* 3 °C heute → ein Hinweis mit „3" und „4". *Erfüllt:* 12 °C → Grund, kein Satz. *Nicht prüfbar:* ohne Wert, und getrennt: Wert älter als 48 h → „letzte Messung vor N Tagen". Gegenprobe: Altersgrenze entfernt → der alte Wert urteilt, Fall rot.
- **Risiko:** Ein Luft- oder Modellwert ist keine Bodentemperatur am Beet — ein Wetterdienst-Wert dürfte nur mit dem Namen „Modellwert, nicht dein Beet" erscheinen (und der Lader holt das Feld heute nicht). Keimtemperatur ist ein Mindestwert, kein Versprechen. Die Monats-Indizes in `GS_SAE_DB` sind 0-basiert (IDEE-A hat an `gsSaatgutJetzt` gemessen, was passiert, wenn man das übersieht).

### C4 · Giess-Rhythmus aus der eigenen Kurve  *(Sensor-Idee, heute schon mit Tagebuch × Regen)*

- **Kreuzung:** Bodenfeuchte-Reihe × abgehakte Giess-Ereignisse × Regen × eingestelltes Intervall.
- **Die Frage:** Wie viele Tage hält das Wasser an DIESER Pflanze wirklich — und passt mein Intervall dazu?
- **Was passiert:** An der Feuchte-Kurve und in der Giess-Aufgabe: „Gemessen: nach dem Giessen fällt die Bodenfeuchte in 4 bis 6 Tagen auf deine Schwelle 25 % (3 Giess-Zyklen). Dein Intervall: 2 Tage." Später ein Knopf „Intervall auf 4 Tage stellen" — nach Rückfrage, nie von selbst.
- **Heute ohne Gerät:** eine schwächere, aber rechnende Aussage aus Tagebuch × Regen: „An 3 deiner 7 Giess-Tage hatte es bis dahin 6 mm oder mehr geregnet" — nur für Pflanzen draussen. **Mit eigenem Sensor:** die Kurve ist stündlich; die Trocknungsrate wird je Wetterlage rechenbar („über 30 °C hält es 2 statt 5 Tage").
- **Warum neu:** `docs/memory/06-kalender.md`, „Was nicht gerechnet wird: … ‚du giesst zu oft'". `grep -ci "trocknungs\|austrockn" index.html` → 0. `gsGiessBestaetigung` und `gsSensorAufgabenAbgleich` sehen je EINEN Zeitpunkt, keine den Verlauf zwischen zwei Giessen.
- **Worauf es aufbaut:** `gsMesswerte(id, 'soil_moisture')`, `gsGiessBestaetigung(p, ts)` (liefert die bestätigten Zeitpunkte), `gsTagebuchAlle()` (`cat: 'water'`, `quelle: 'regel'` = abgehakt), `gsRegeln()`, `_gsPflanzeGeraete(p)`, `gsPflanzeDraussen(p)`, `GS_REGEN_REICHT_MM`, `gsWetterGeraetAbgleich`. Join-Schlüssel: Geräte-ID ↔ Pflanze (sauber).
- **Datenlage:** lokal höchstens 2'000 Messwerte (`GS_MESSWERTE_MAX`) — bei stündlichen Werten zweier Grössen rund 41 Tage. Die Beispieldaten haben 7 fallende Werte (52 → 22) und keinen einzigen Giess-Zyklus. Eine Feuchte-Schwelle aus Artendaten gibt es bewusst nicht (`docs/OEKOSYSTEM-V1.md` §9 Regel 6) — gerechnet wird gegen die eigene Regel-Schwelle. Regen-Historie lokal: 7 Tage Stundenwerte im Wetter-Gerät (`GS_WETTER_GERAET_TAGE`) — und nur so vollständig, wie die App in diesen Tagen geöffnet wurde (der Lader holt `forecast_days=7`, keine Vergangenheit). Die Tagesdeckung zählt also mit: „aus M von 7 Tagen", darunter „nicht bekannt".
- **Kleinste erste Scheibe:** nur die Zahl „hält N Tage (aus M Zyklen)" an der Kurve, ohne Vorschlag. Hinter `localStorage.gs_feat_giessrhythmus`.
- **Woran man es prüft:** `sensor_check`, der Fall stellt seine Reihe selbst her. *Erfüllt/verletzt:* drei Zyklen, 60 → 24 in 4, 5, 6 Tagen, je ein abgehaktes Giessen → „5 Tage (3 Zyklen)"; Intervall 2 Tage → Abweichung genannt. *Nicht prüfbar:* zwei Zyklen → „erst 2 Giess-Zyklen gemessen". Der unplausible Wert (250, `quality` 1) ändert die Zahl nicht. Gegenprobe: Qualitätsfilter entfernt → andere Zahl.
- **Risiko:** Topf ist nicht Beet, Sensortiefe ist nicht Wurzeltiefe. Drei Zyklen sind eine Stichprobe — immer „aus M Zyklen" und der Zeitraum dabei. Nie `lastDone` anfassen, nie ein Intervall selbst verstellen. **Und die Giess-Historie hat ein Loch:** IDEE-B hat gemessen (Brett, 04:51), dass `doneTask` — der Knopf auf der Karte in „Meine Pflanzen" und im Pflanzen-Detail — nur `lastDone` setzt und keinen Verlaufseintrag schreibt. Wer dort abhakt, fehlt als Zyklus. Bis das geschlossen ist, zählt die Scheibe einen Zyklus auch am Sprung der Kurve selbst (die Rechnung von `gsGiessBestaetigung`, +10 Punkte) und sagt, woher sie ihn hat.

### C5 · Die eigene Reife-Uhr  *(Sensor-Idee, heute schon mit dem Wetterdienst)*

- **Kreuzung:** Pflanzdatum × erste echte Ernte aus dem Ernte-Buch × Tagestemperaturen (Wetterdienst oder eigener Lufttemperatur-Sensor) × Kulturdauer.
- **Die Frage:** Wie viel Wärme hat MEINE Zucchini bis zur ersten Ernte gebraucht — und wo steht die diesjährige?
- **Was passiert:** Die Ernte-Schätzung rechnet heute Pflanzdatum plus die Mitte aus `minDays`/`maxDays`, bei jedem Wetter gleich. Neu daneben, sobald es eine Vorsaison gibt: „Letztes Jahr: erste Ernte nach 61 Tagen und 1'120 °C Temperatursumme. Dieses Jahr bisher 780 °C in 48 Tagen." Ohne Vorsaison steht dort nur die laufende Summe und „noch keine eigene Vergleichssaison".
- **Heute ohne Gerät:** Tagesmittel aus dem Wetterdienst. **Mit eigenem Sensor:** die Summe gilt für das eigene Mikroklima, und der Unterschied Sensor − Wetterdienst wird selbst zu einer Zahl.
- **Warum neu:** `calcHarvestDate` und Kalender Nr. 4 rechnen nur Tage; `grep -ci "gradtag\|GDD" index.html` → 0. Und das Tagesarchiv liegt brach: `weather_log_per_garden` wird von `loadGardenWeather` einmal täglich geschrieben und von niemandem gelesen (`grep -n` → 1 POST, 0 GET; `supabase/functions`: 0).
- **Worauf es aufbaut:** Kalender Nr. 4 und R4 (die Zuordnung Ernte-Zeile ↔ Pflanzung steht dort inline — als eine Funktion herausziehen), `gsErnteLoad`, `_gsKulturZuPflanze`, `gs_weather_cache.daily`. Join-Schlüssel: Kulturname und Freitext (beide löchrig).
- **Datenlage:** `minDays/maxDays` 41 von 41 Kulturen. Eine Basistemperatur oder ein Wärmebedarf je Kultur steht NICHT in den Daten — also keine Reife-Schwelle aus der Literatur, nur der Vergleich mit der eigenen Vorsaison. Lokale Wetterhistorie: 7 Tage; das Server-Archiv hat Lücken an Tagen ohne App-Start (Grösse nicht gemessen). Ob der Wetterdienst genug Tage zurückliefert (`past_days`), ist hier nicht nachgeprüft.
- **Kleinste erste Scheibe:** nur sammeln und zeigen — an der Pflanzung „seit dem Pflanzen: N Tage · Temperatursumme X (aus M von N Tagen)", Tagesmittel über 0 °C aufsummiert, ohne kulturabhängige Basis. Hinter `localStorage.gs_feat_reifeuhr`. Braucht einen Leser für das Archiv oder einen gedeckelten lokalen Tagesspeicher (neuer Schlüssel: Speicherliste, State-Blob hin und zurück).
- **Woran man es prüft:** `kalender_check`. *Erfüllt:* Pflanzung vor 30 Tagen, 30 Tageswerte → die von Hand gerechnete Summe. *Nicht prüfbar:* 18 von 30 Tagen → „nur 18 von 30 Tagen mit Temperatur", keine Summe. *Vergleich:* Vorsaison vorhanden → Differenz genannt. Gegenprobe: Deckungsprüfung entfernt → eine zu kleine Summe erscheint, Fall rot.
- **Risiko:** Lücken auffüllen wäre eine Erfindung. Vergleich nur bei gleicher Kultur UND gleichem Garten; die Sorte (`variety`) kann abweichen und wird genannt. Eine Temperatursumme ist kein Reife-Urteil. Die Scheibe hängt an der Kalender-Rechnung (Tor: Kulturdaten), nicht an `calcHarvestDate` — dort rechnet die Garten-Seite laut IDEE-A (Brett, 04:56) noch mit dem Rückfall 60–90 Tage. Den Wetter-Log ohne Leser hat auch IDEE-B gemessen (Brett, 04:51).

### C6 · Ertragsbilanz je Beet

- **Kreuzung:** Ernte-Buch (kg) × bepflanzte Fläche (Pflanzung `count` × Pflanz- und Reihenabstand, oder Garten `width × length`) × `yield_kg_m2` der Kultur.
- **Die Frage:** Was hat mir ein Quadratmeter gebracht — gegen den Richtwert der Kultur?
- **Was passiert:** Im Ernte-Buch je Kultur eine Zeile: „Zucchini: 7,4 kg von 2 Pflanzen (rund 2 m² bei 100 × 100 cm) = 3,7 kg/m² · Richtwert der Kulturdaten 4,0–6,0". Mit Sensor später daneben eine Beobachtung („davon 9 Tage unter deiner Feuchte-Schwelle") — nie als Ursache.
- **Warum neu:** `grep -n "yield_kg_m2" index.html` → 39 Zeilen, alle im Datenblock: das Feld hat 0 Leser. Der Planer rechnet den Ertrag des PLANS (R11), nie die wirkliche Ernte gegen einen Richtwert.
- **Worauf es aufbaut:** `gsErnteLoad`, `openErnteTracking`, `_gsKulturZuPflanze`, `gsErnteUnitDb`, die Zuordnung aus R4. Join-Schlüssel: Freitext und Kulturname (löchrig).
- **Datenlage:** 35 von 41 Kulturen mit lesbarer kg-Spanne, 4 in „Stück", 2 ohne. Pflanz-/Reihenabstand 39 von 41. Ernte-Einheiten: g, kg, stk, bund, ml, l — rechenbar sind g und kg. Wie oft `width`/`length` gesetzt sind: nicht gemessen.
- **Kleinste erste Scheibe:** nur die Zeile im Ernte-Buch, nur Kulturen mit kg-Richtwert und Einträgen in g/kg. Hinter `localStorage.gs_feat_ertrag`.
- **Woran man es prüft:** `planer_check` (liest `gs_ernte_log`) oder `kalender_check`. *Erfüllt/verletzt:* Zucchini, 2 Pflanzen, 7'400 g → 3,7 kg/m², unter der Spanne. *Nicht prüfbar:* Einheit „stk" → „in Stück eingetragen, Richtwert in kg"; Ernte-Zeile ohne zuordenbare Pflanzung → gezählt. *Kein Fall:* Monstera → keine Zeile. Gegenprobe: Einheitenprüfung entfernt → 7'400 „kg".
- **Risiko:** Ein Richtwert ist kein Versprechen (Sorte, Lage, Jahr) — Quelle an der Zahl. „Unter Richtwert" ohne Wertung. Die Fläche aus dem Abstand ist eine Rechnung: „rund" und die Formel im Grund.

### C7 · Fundplatz-Gedächtnis

- **Kreuzung:** Fundorte (`greenscan_markers`) × Jahr × Regen der Tage davor × Saison der Art.
- **Die Frage:** Unter welchen Bedingungen war ich an DIESEM Platz erfolgreich — und wie steht es diese Woche?
- **Was passiert:** In „Meine Funde" je Platz: „3 Funde: 14.09.2024, 02.10.2025, 21.09.2026 — je 18 bis 41 mm Regen in den 7 Tagen davor. Diese Woche bisher: 6 mm." Kein Prozentwert, keine Aufforderung.
- **Warum neu:** Die „Pilz-Wahrscheinlichkeit heute" (`gsAttachMushroomForecast`) rechnet mit selbst gesetzten Punkten (15–50 mm = +50), artunabhängig, ohne je einen Fund gesehen zu haben, und endet bei „Jetzt sofort raus — perfekte Bedingungen!". Fundorte gehen heute nur als Ereignis in den Kalender (`art: 'fund'`).
- **Worauf es aufbaut:** `gsAddMarker` (Schreiber), `_gsFundZeit(f)`, `gsOpenMyFinds`, `gsWetterGeraetAbgleich` (7 Tage Stundenregen), `_gsArtenTreffer(name)`. Join-Schlüssel: Freitext.
- **Datenlage:** Datum an 100 % der Funde; der Name ist Freitext. Das Wetter „damals" liegt lokal nicht vor — es muss ab jetzt beim Fund mitgeschrieben werden; ältere Funde bleiben „nicht bekannt". Auch die 7 Tage davor sind nur so vollständig, wie die App geöffnet wurde (wie bei C4) — die Summe trägt ihre Deckung („aus 5 von 7 Tagen"), und das Wetter gilt für den Wohnort, nicht für den Fundplatz: das steht dabei. Wie viele Funde Nutzer haben: nicht gemessen.
- **Kleinste erste Scheibe:** beim Anlegen eines Fundes die Regensumme der letzten 7 Tage mitschreiben — nur wenn gemessen, sonst kein Feld — und in „Meine Funde" zeigen. Hinter `localStorage.gs_feat_fundgedaechtnis`.
- **Woran man es prüft:** `kalender_check` (liest `greenscan_markers`). *Mit Wetter:* die Zahl steht am Fund. *Nicht prüfbar:* ohne Wetter → „Regen davor: nicht bekannt". *Spanne:* drei Funde → kleinster bis grösster Wert. Gegenprobe: Schreiber zurückgebaut → Feld fehlt.
- **Risiko:** Fundplätze sind das Geheimste, was Sammler haben, und Standortdaten (revDSG): Rechnung nur lokal, kein Feld in einem Analytics-Ereignis, kein Community-Aggregat ohne ausdrückliche Zustimmung. Drei Funde sind keine Prognose — „bei deinen Funden", nie „Chance". Das Wetter genau am Fundplatz abzufragen hiesse, die Koordinate eines Geheimplatzes an den Wetterdienst zu schicken — die erste Scheibe tut das nicht und nimmt das Wetter des Wohnorts, benannt als solches. Die Koordinate stammt aus dem Kartentipp, nicht aus `gs_user_location`, ist vom Standort-Befund also nicht betroffen.

### C8 · Vom Beet zum Teller — und beim Fund ein Kontrollschritt dazwischen

- **Kreuzung:** Rezepte (`plantIds`) × was die Person wirklich hat (Ernte-Buch, erntereife Pflanzungen) × Verwechsler-Graph × Saison.
- **Die Frage:** Was kann ich diese Woche aus dem kochen, was ich wirklich habe?
- **Was passiert:** Im Rezepte-Bildschirm eine erste Reihe „Aus deinem Garten (N)". Fehlt ein Rezept, sagt die Reihe es („zu Tomaten gibt es noch kein Rezept"). Für Wildfunde gibt es KEINE Vorschlagsreihe — nur an der Rezeptkarte selbst die Radar-Zeile aus C1.
- **Warum neu:** Die Richtung Rezept → Art steht seit v33.58. Die Gegenrichtung Bestand → Rezept gibt es nicht: im Rezeptcode kein Leser für Ernte-Buch oder Pflanzungen.
- **Worauf es aufbaut:** `_gsRecipeAllowedPlantIds(r)`, `renderRecipes`, `openRecipeDetail`, `gsErnteLoad`, Kalender-Ereignisse `art: 'ernte'`. Join-Schlüssel: Binom auf der Rezeptseite (sauber), Freitext und Kulturname auf der Bestandsseite (löchrig).
- **Datenlage:** 481 von 524 Einträgen mit `plantIds` → 112 Binome. Von den 39 Garten-Kulturen mit botanischem Namen haben 25 mindestens ein Rezept (Salbei 15, Thymian 14, Fenchel 7 …), 14 keines — darunter Tomaten, Kartoffeln, Salat, Bohnen, Radieschen; bei der Tomate liegt es am abweichenden Namen (Befund). 27 Rezept-Binome (130 Rezepte) haben einen aufgelösten giftigen Verwechsler.
- **Kleinste erste Scheibe:** nur „Aus deinem Garten", nur Ernte-Zeilen der letzten 14 Tage, die auf eine Pflanzung mit Art zeigen. Hinter `localStorage.gs_feat_bestandrezepte`.
- **Woran man es prüft:** `rezept_link_check` (reines Node): Garten-Kulturen mit Rezept = 25, Sperr-Verstösse weiter 0. Dazu ein Fall am Bildschirm. *Erfüllt:* Zucchini im Ernte-Buch → 3 Rezepte. *Verletzt (als Leerzustand):* Tomate → „noch kein Rezept". *Nicht prüfbar:* Ernte-Zeile ohne zuordenbare Art → gezählt und genannt.
- **Risiko:** Ein Scan ist keine Bestimmung. Aus Scan oder Fundort entsteht nie ein Rezeptvorschlag; die bestehende Sperre (tox ≥ 3 irgendwo in der Art) bleibt; `_unverified` nie. Das ist der Grund, warum die erste Scheibe nur den Garten nimmt.

---

## 5 · Voraussetzung für mehrere Ideen — keine Idee, aber die billigste Hebelstelle

**Ein Schlüssel von jedem Ding zur Art und zur Kultur.** C3, C5, C6, C8 stehen auf dem Kulturnamen,
C1, C7, C8 auf Freitext. Heute löst jede Stelle selbst auf (`_gsKulturZuPflanze`, `_gsSaeZuPflanze`,
`_gsArtZuPflanze`, `_gsBlMeineArten`, die Namensgleichheit in R4). Gemessen reisst das an zehn
Gemüse-Einträgen, an 12 Aussaat-Kulturen und an 59 % der Verwechsler-Texte. Eine Funktion mit drei
Zuständen (eine Art · mehrere, keine gewählt · keine) hebt alle acht Ideen gleichzeitig.

## 6 · Befunde, die beim Zählen anfielen (alle auf dem Brett)

1. `gs_user_location`: drei Schreiber pflegen nur `lon`, sechs Leser nehmen `lng` — ORT baut.
2. An ARTEN: 98 von 253 „giftig/tödlich"-Verwechslern zeigen auf keine Art der Liste.
3. Kulturdaten × Artenliste: die Tomate und neun weitere Gemüse-Einträge erreichen keine Kultur.
4. Ohne eigenen Eintrag, hier vermerkt: `weather_log_per_garden` hat einen Schreiber und keinen Leser; `yield_kg_m2` steht bei 39 Kulturen und wird nie gelesen.

## 7 · Für Runde 2

- C1 ist die Grundlage für C2 und C8 und passt an jede Stelle, an der A oder B dem Scan-Ergebnis etwas hinzufügen wollen (IDEE-B hat an `gsGegenprobeRender` gemessen, dass die Verzehr-Zeile der Art nicht folgt — das Radar liefert genau die Art-Angabe, die dort fehlt).
- C3 und IDEE-As Befund zu `gsSaatgutJetzt` treffen sich: „Jetzt ins Beet" hätte mit einer Bodentemperatur eine zweite, gemessene Stimme.
- Offen für die anderen Blickwinkel: Mischkultur-Matrix × wirklicher Garten-Zwilling (Kandidat in §3), und was die Community tragen könnte, wenn jemand sie zählen darf.
