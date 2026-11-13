# KREUZ-C · Runde 2 — nachgezählt, zusammengeführt, gekreuzt

Stand: v33.58, nur gelesen. Gelesen: `IDEE-A.md`, `IDEE-B.md`, das Brett bis 05:10, `AUFGABEN.md`.
Nachgezählt mit den echten App-Funktionen in einer Node-Sandbox:
`node /home/claude/team/ideen/IDEE-C-zaehlskripte/kreuz1.js` (nach `zaehl3.js`).
Nicht im Browser gefahren; kein Live-Zugriff; keine Web-Recherche.

Die sechs Zahlen, die in dieser Runde am meisten entscheiden:

| Zahl | Was sie trifft |
|---|---|
| 1'383 Einträge sind beim Laden „ungeprüft" (`_unverified`) — **alle tragen tox 0**, das sind 38 % aller 3'658 tox-0-Einträge | jede Liste „nicht als giftig geführt" (Notfallblatt) |
| Von 1'233 essbaren Einträgen lösen 564 (46 %) ihren Verwechsler-Text in keine Art auf; 68 haben gar keinen Text (alle 68 ungeprüft) | Korb-Check, Kontrollzettel, Radar |
| Von 40 Gemüse-Einträgen der Artenliste erreichen 24 eine Aussaat-Kultur, 30 eine Kulturdaten-Kultur, 22 beide | Winterschlaf, Partie-Analyse, Fahrplan, Rechenschaft |
| Keimspanne lesbar bei 37 von 39 Kulturen, Temperatur genannt bei 6; Spanne UND Bodentemperatur bei 26 | Keimprobe, Fahrplan, Keim-Ampel |
| Ein Listenwert für Licht steht bei 40 Arten (0,9 %); alle anderen bekommen aus `gsSpeciesLightDefaults` einen Kategorie-Rückfall | Licht-Zeile in Nachruf und Flugschreiber |
| Der Wetter-Lader holt nur voraus; rückwärts kennt die App höchstens 7 Tage, und nur Stunden von Tagen, an denen sie offen war | Rückkehr-Runde, Wasserkonto, Partie-Analyse, Fundplatz, Reife-Uhr |

---

## 1 · Antwort auf jede fremde Idee

| Idee | Urteil | Tragen die Daten das? (gezählt) |
|---|---|---|
| **A1 Rückkehr-Runde** | **trägt** (Kern) · Wetterzeile **trägt nicht** | Der Kern steht auf `lastDone` und Intervall — an jeder Aufgabe vorhanden. Die Zeile „in der Zeit: 38 mm Regen" kann heute nie etwas wissen: war die App drei Wochen zu, hat das Wetter-Gerät für diese Zeit 0 Stunden. „Draussen" ist nur für Garten-Pflanzungen bekannt (`p.location` hat bei eigenen Pflanzen keinen Schreiber) — die Regen-Reihung im Rundgang gilt also nur dort. |
| **A2 Kontroll-Gang** | **trägt** → zusammenführen (Z2) | Der Zettel steht auf der Server-Antwort. Lokal gegengezählt: von 375 essbaren Pilz-Einträgen haben 99 einen aufgelösten giftigen Verwechsler, 159 nur Text — der Zettel muss den Text wörtlich tragen. |
| **A3 Keimprobe** | **trägt** → Z6 | `germ` 39 von 39, Spanne lesbar 37, Zähltag also bei 95 % rechenbar. Die Angabe gilt für Zimmertemperatur (6 nennen sie) — passt zur Probe auf Küchenpapier genau. Tütchen → Kultur ist ein Teilstring. |
| **A4 Winterschlaf** | **trägt**, aber nur für 60 % | `harvest` 39 von 39. Der Weg Pflanze → Aussaat-Kultur reisst bei 16 von 40 Gemüse-Einträgen der Artenliste (Fleischtomate, Rosenkohl, Kohlrabi, Erdbeeren, Fenchel, Chinakohl …) — die mahnen im Januar weiter. Ohne den Schlüssel hält die Idee das Versprechen „dein Garten ruht" nicht. |
| **A5 Rechenschaft** | **trägt** → Z4 | Eine Schätzung gibt es nur mit Kultur (30 von 40). Die Zuordnung Ernte ↔ Pflanzung läuft über Freitext; in den Beispieldaten gibt es 0 abrechenbare Paare (Ernte „Tomate", Pflanzung „Zucchini") — der Fall stellt seine Daten selbst. |
| **A6 Nachruf mit Lehre** | Giess-Zeile **trägt** · Licht-Zeile **gefährlich** → Z1 | `gsResolvePlantLightRange` gibt für 99 % der Arten einen Rückfall nach Kategorie zurück (`source: 'default'`), ungekennzeichnet; neun Kulturen mit `sun: 'part_sun'` bekommen gar nichts (Befund auf dem Brett). „Die Art braucht laut Liste mindestens 2'000 lx" wäre fast immer eine Erfindung mit plausiblem Grund. Frost-Zeile: `frost −1` bei 11 von 41 Kulturen, Wetter rückwärts 7 Tage. |
| **A7 Fingerprobe** | **trägt** → Z5 | Braucht keine Artendaten. Erzeugt die Messreihe, die meinem Giess-Rhythmus ohne Sensor fehlt. |
| **A8 Notfallblatt** | **trägt** — **gefährlich** ohne eine Regel → Z3 | Gruppe 2 („nicht als giftig geführt") darf keine ungeprüften Einträge enthalten: 1'383 Stück, alle tox 0, 68 davon `edible: true`. Sie gehören in Gruppe 3. Hauspflanzen: 286 Einträge, 99 mit tox ≥ 1, 20 mit tox ≥ 3, 0 ungeprüft; bei 116 beginnt `warning` mit „Keine …" — nur durch `_gsWarnungEcht` drucken. |
| **B1 Korb-Check** | **trägt** → Z2 | Bei 46 % der essbaren Einträge ist der Pflichtpunkt der wörtliche Text, keine Art — B hat dafür vorgesorgt. Die 68 essbaren Einträge ohne Text sind alle ungeprüft: dort STOPP „ungeprüft", nie „keine Verwechsler". |
| **B2 Notfall-Übergabe** | **trägt** → Z3 | Der Scan-Verlauf lässt sich abschalten (`userPrefs.scanHistory === false` in `gsAddScanHistory`): die Karte braucht dafür einen eigenen Zustand — „Scan-Verlauf ist ausgeschaltet" ist nicht „kein Scan". Foto nur an den 24 jüngsten Scans. |
| **B3 Flugschreiber** | wie A6 → Z1 | Giess-Abstände tragen („aus N Einträgen"); Licht nur bei 40 Arten, Frost bei 11 Kulturen. |
| **B4 Partie-Analyse** | Fenster-Urteil **trägt** für 60 % · Jahrgang **trägt nicht** → Z4 | Urteil gegen den Aussaatkalender: 24 von 40. „Jahrgang aus N von 365 Tagen" bleibt lange klein: lokal 7 Tage, das Server-Archiv hat keinen Leser und drei Unschärfen (`AUFGABEN.md` Nr. 10). |
| **B5 Wasserkonto** | Scheibe 1 **trägt kaum** → Z5 | „Kein neuer Abruf" heisst: bekannt sind die Stunden seit Mitternacht des Öffnungstags plus frühere Tage, an denen die App offen war. Wer alle drei Tage öffnet, hat morgens rund 9 von 72 Stunden — „nicht bekannt" wäre der Normalfall (gerechnet aus dem Abruf, nicht im Browser gemessen). Verdunstung: 0 Treffer im Lader. |
| **B6 Kultur-Fahrplan** | **trägt** → Z6 | Keimspanne 37 von 39. Draussen bleibt es „nicht bekannt", bis eine Bodentemperatur da ist — und die hat die Kultur bei 26 von 39. |
| **B7 Jahreszeit-Peilung** | **trägt** als Beobachtung | Alle sieben genannten Arten stehen in der Liste (3 bis 9 Einträge), alle in einer Blüh-Kategorie, alle mit `season` (Hasel Jan–Apr, Forsythie Mär–Apr, Apfel Apr–Mai, Sommerlinde Jun–Jul). Die Liste kann also selbst sagen, wann die Frage „Blüht sie?" sinnvoll ist. Die Zuordnung Art → Phase braucht eine Quelle. |
| **B8 Rundgang** | **trägt** | Läuft über Pflanzungen (Garten bekannt), nicht über eigene Pflanzen. Liefert dieselbe Beobachtung wie A7, nur an allen Halten. |

**Gibt es schon:** keine der sechzehn — bei jeder habe ich den Neuheits-Beleg der anderen Seite
nachgefahren, soweit er auf `grep` steht.

---

## 2 · Sechs Zusammenführungen — was jede Seite beiträgt

**Z1 · Abschied mit Befund** (Nachruf A6 + Flugschreiber B3)
B bringt die Form: ein Bericht aus der Aufzeichnung, ohne Schuld, mit EINER Empfehlung, die beim
nächsten Mal gilt. A bringt die drei Zustände je Zeile und die Einlösung im Anlege-Formular.
Die Zählung entscheidet den Umfang: es trägt nur die Giess-Zeile. Licht nur bei `source: 'species'`
(40 Arten), sonst „nicht bekannt". Erste Scheibe: Giess-Abstand „aus N Einträgen" — nach dem
dritten Erledigt-Weg (`doneTask`, `AUFGABEN.md` Nr. 8).

**Z2 · Die Kontrollkette** (Kontroll-Gang A2 + Korb-Check B1 + Doppelgänger-Radar C1)
C bringt die ARTEN hinter dem Verwechsler-Text (281 Einträge mit aufgelöstem giftigem Verwechsler,
1'727 ohne Auflösung). B bringt die Form für den Abend: mehrere Funde, eine Liste, die nur stoppen
kann. A bringt den Ausgang: der Zettel für die Pilzkontrolle und das Urteil danach. Reihenfolge der
Scheiben: Radar an der Artenkarte (kein Speicher) → Korb mit Pflichtpunkten → Zettel.
Vorher: der Pilz-Scanner schreibt den Fund (`AUFGABEN.md` Nr. 1).

**Z3 · Notfall-Mappe** (Notfallblatt A8 + Notfall-Übergabe B2)
A ist das Blatt davor, B die Karte im Moment. Zusammen entsteht, was keine Seite hatte: der Block
„Was?" auf der Telefon-Karte bekommt drei Quellen in fester Reihenfolge — Scans der letzten
24 Stunden · „eine von euren Pflanzen" (die Hausliste, als giftig geführte zuerst) · „weiss ich
nicht". Das Kleinkind, das an der Zimmerpflanze kaut, ist kein Scan. Pflicht aus der Zählung:
ungeprüfte Einträge in „nicht bekannt"; ausgeschalteter Verlauf als eigener Zustand.

**Z4 · Jahres-Abrechnung** (Rechenschaft A5 + Partie-Analyse B4 + Reife-Uhr C5)
A bringt die Zahl je Vorhersage („5 Tage nach der Mitte"). B bringt die Ansicht: das Jahr Zug um
Zug, und „für nächstes Jahr merken". C bringt die Uhr, die erklärt — Wärme statt Tage. Die Zählung
ordnet: A zuerst (kein Speicher, kein Wetter), B nur das Fenster-Urteil, C erst mit einem
Wetter-Rückblick, den es heute nicht gibt (oder mit X4).

**Z5 · Wasser-Dreiklang** (Fingerprobe A7 + Wasserkonto B5 + Giess-Rhythmus C4, dazu Rundgang B8)
Eine Frage — „Wie lange hält das Wasser hier?" — und drei Geräte mit fester Rangfolge: Sensor vor
Finger vor Wetter, jedes beim Namen. A liefert das erste Gerät, das jeder hat; B die Buchführung
dazwischen; C die Kurve. Die Zählung dreht B um: zuerst der Finger, dann das Konto — das Konto
braucht einen eigenen Regen-Rückblick, sonst sagt es meistens „nicht bekannt".

**Z6 · Keim-Kette** (Keimprobe A3 + Keim-Ampel C3 + Kultur-Fahrplan B6)
A misst im Januar das Saatgut, C im Frühling den Boden, B setzt die Erwartung und stellt die Frage
„gekeimt?". Jede Seite deckt die Lücke der anderen: die Keimspanne gilt für Zimmertemperatur (A
passt, B draussen nicht), die Bodentemperatur macht B draussen prüfbar. Deckung: Spanne 37,
Spanne und Bodentemperatur 26 von 39 Kulturen.

---

## 3 · Vier neue Kreuzungen

### X1 · Bestimmungs-Bilanz — „Wie oft lag der Scanner bei mir richtig?"

- **Die Kreuzung:** Kontroll-Gang (A2: das Urteil der Pilzkontrolle wird eingetragen) × Rechenschaft (A5: jede nachprüfbare Vorhersage wird abgerechnet) × Lerndeck (C2) × Brett-Befund „98 Verwechsler zeigen auf keine Art".
- **Die Frage, die sich rechnen lässt:** Von meinen kontrollierten Funden — wie viele hat die Kontrolle so benannt wie die App, und bei welchen nicht?
- **Was passiert:** In „Meine Funde" steht über den kontrollierten Funden eine Zeile in ganzen Zahlen: „6 Funde kontrolliert: bei 5 nannte die Kontrolle dieselbe Art, bei 1 eine andere (App: Steinpilz · Kontrolle: Gallenröhrling). 2 warten. 1 nicht hingegangen." Jeder „andere" Fall wird zweierlei: eine Lernkarte für genau dieses Paar, und — nach Antippen — eine Korrekturmeldung auf dem Weg, den es seit v32.05 gibt (`feedback_items`, `kind = 'species_correction'`). So kommt die fehlende Art in die Liste aus der Hand derer, die es wissen.
- **Datenlage (gezählt):** Das Urteil ist ein neues Feld — heute gibt es 0 davon, auch kein Feld dafür. Die Sicherheit des Scans liest `_gsScanKonfidenz`. Der Pilz-Scanner schreibt heute keinen Verlauf (IDEE-B, Brett 05:00): ohne das fehlt der Bilanz genau die Pilze. Lernkarten gibt es je Binom in 7 Typen; ein Paar ist nur dann eine Karte, wenn die genannte Art in der Liste steht — bei den Verwechslern ist das bei 41 % der Texte so.
- **Kleinste erste Scheibe:** am Fund das Feld `urteil` (gleiche Art · andere Art · nicht hingegangen) und die Zählzeile. Ohne Lernkarte, ohne Meldung. Hinter `localStorage.gs_feat_bilanz`.
- **Woran man es prüft:** `scan_check`, neuer Block. Vier gestellte Funde (gleiche Art · andere Art · wartet · nicht hingegangen) → die Zeile nennt **1 · 1 · 1 · 1**. *Nicht prüfbar:* Fund ohne Urteil zählt nie als „gleiche Art". *Sperre:* im ganzen Text 0 Prozentzeichen und 0 Treffer auf `sicher|zuverlässig|essbar`. Gegenprobe: „wartet" als bestätigt zählen → 2 statt 1.
- **Risiko:** Eine Trefferzahl liest sich schnell als „die App ist zu 83 % sicher" — darum nie ein Prozentwert, nie ein Satz über künftige Funde, und unter drei kontrollierten Funden nur die Einzelfälle. Das Urteil ist eine Angabe der Person. Nichts verlässt das Gerät ohne Antippen; auf einer Meldung steht die Gemeinde, nie die Koordinate.

### X2 · Keim-Befund — wenn nichts kommt, sagt die App, welche Zahl auffällt

- **Die Kreuzung:** Keimprobe (A3) × Kultur-Fahrplan (B6) × Keim-Ampel (C3).
- **Die Frage:** Die Keimung ist überfällig — liegt eine gemessene Zahl ausserhalb dessen, was die Kulturdaten nennen: Saatgut, Boden oder Zeit?
- **Was passiert:** B fragt bei überfälliger Keimung „Gekeimt? Ja · Noch nicht · Nachsäen". Neu stehen darüber bis zu drei Zeilen, jede mit ihrem Zustand: „Saatgut: 7 von 10 gekeimt am 19.1." · „Boden: 6 °C am 12.3. — Kulturdaten: Keimung ab 10 °C" · „Zeit: 14 Tage, Kulturdaten 7–14 bei Zimmertemperatur". Fehlt eine Messung, steht „nicht bekannt" und der Weg dazu (Keimprobe starten · Bodentemperatur eintragen). Die App nennt keine Ursache; sie zeigt, welche Zeile ausserhalb liegt.
- **Datenlage (gezählt):** Zeit-Zeile bei 37 von 39 Kulturen. Boden-Zeile bei 26 von 39 (Spanne UND Bodentemperatur); 11 haben nur die Spanne. Saatgut-Zeile nur nach einer Keimprobe — das Feld gibt es noch nicht. Tütchen → Kultur ist ein Teilstring; Pflanze → Aussaat-Kultur trägt bei 24 von 40 Listen-Gemüsen.
- **Kleinste erste Scheibe:** nur die Zeit- und die Boden-Zeile am Überfällig-Hinweis; die Saatgut-Zeile kommt mit der Keimprobe. Hinter `localStorage.gs_feat_keimbefund`.
- **Woran man es prüft:** `kalender_check` (Uhr 01.09.2025). Radieschen gesät am 20.8. (Keimspanne 5–10 Tage, also seit 2 Tagen überfällig — derselbe Aufbau wie in IDEE-Bs Fahrplan-Fall), Bodentemperatur 3 °C heute (Kulturdaten: 5) → 2 Zeilen, die Boden-Zeile markiert. Ohne Bodenwert → „Boden: nicht bekannt". Zwiebeln („Steckzwiebeln sofort") → keine Zeit-Zeile, Grund „keine Keimdauer hinterlegt". Gegenprobe: Altersgrenze des Bodenwerts entfernt → ein Wert von vor 20 Tagen markiert, Fall rot.
- **Risiko:** Drei Zahlen nebeneinander sind keine Diagnose — das Wort „weil" kommt nicht vor. Eine Keimprobe mit zehn Samen bleibt „7 von 10", nie eine Eigenschaft der Sorte. Erst nachdem `gsSaeLogAsSowed` über den geprüften Speicherweg schreibt (`AUFGABEN.md` Nr. 9).

### X3 · Geeichter Regen — der Finger sagt, ab wie viel Regen es bei dir reicht

- **Die Kreuzung:** Fingerprobe (A7) und Rundgang (B8) × Wasserkonto (B5); später derselbe Satz aus dem Sensor (C4).
- **Die Frage:** Bei welcher Regenmenge der letzten drei Tage war die Erde in DIESEM Garten am Giesstag noch feucht — und bei welcher trocken?
- **Was passiert:** Die App behauptet heute für alle dasselbe: ab 6 mm heute übernimmt der Regen (`GS_REGEN_REICHT_MM`). Neu merkt sie zu jeder Aussage „noch feucht" oder „trocken" die Regensumme der 72 Stunden davor. Am Grund der Giess-Aufgabe steht dann das eigene Muster: „Bei dir: 4-mal noch feucht nach 12 bis 31 mm · 3-mal trocken nach 0 bis 4 mm (aus 7 Proben seit Mai)". Die 6-mm-Regel bleibt, wie sie ist.
- **Datenlage (gezählt):** Die Aussage ist ein Knopf, keine Artendaten nötig. Der Engpass ist der Regen rückwärts: ohne eigenen Abruf sind am Morgen des Giesstags rund 9 von 72 Stunden bekannt, wenn die App seit drei Tagen zu war. „Draussen" ist nur für Pflanzungen bekannt, bei eigenen Pflanzen nicht — dort entsteht kein Paar.
- **Kleinste erste Scheibe:** ein Regen-Rückblick als eigener Abruf mit eigenem Schlüssel (ein Schreiber), der Knopf „Noch feucht" aus A7, und das Paar am Tagebuch-Eintrag — nur wenn alle 72 Stunden bekannt sind. Anzeige erst ab drei Paaren je Seite. Hinter `localStorage.gs_feat_regenprobe`.
- **Woran man es prüft:** `kalender_check`. Sieben gestellte Proben mit Regensummen → die Zeile nennt „4-mal … 12 bis 31" und „3-mal … 0 bis 4". *Nicht prüfbar:* Probe mit 20 von 72 Stunden → kein Paar, gezählt als „1 Probe ohne Regenwert". *Kein Fall:* Pflanze drinnen. Gegenprobe: Deckungsprüfung entfernt → 8 statt 7 Proben.
- **Risiko:** Sieben Proben sind ein Muster, keine Schwelle — die App rechnet daraus keine eigene Regel und verschiebt keine Aufgabe. Topf und Beet nicht mischen: Paare gelten je Garten. Der Rückblick-Abruf darf den bestehenden Wetterstand nicht verschieben (IDEE-B hat gemessen, wer Index 0 liest).

### X4 · Blüten-Uhr — die eigene Beobachtung als Uhr des Jahres

- **Die Kreuzung:** Jahreszeit-Peilung (B7) × Rechenschaft (A5) × Reife-Uhr (C5).
- **Die Frage:** Wie viele Tage nach MEINER beobachteten Blüte kam die erste Ernte — und wie weit ist dieses Jahr gegen das letzte?
- **Was passiert:** Meine Reife-Uhr braucht Tagestemperaturen, die es rückwärts nicht gibt. B7 liefert eine Uhr ohne Wetterarchiv: die Person bestätigt am Scan „blüht". Daraus wird an der Ernte-Schätzung eine zweite Zeile: „41 Tage seit deiner Beobachtung ‚Apfel blüht' (21.4.)". Im zweiten Jahr rechnet die Abrechnung aus A5 damit: „Schätzung +6 Tage · deine Apfelblüte 8 Tage später als 2026 · erste Zucchini-Ernte letztes Jahr 62 Tage nach der Apfelblüte, dieses Jahr 64." Zwei Zahlen nebeneinander, kein verschobenes Fenster.
- **Datenlage (gezählt):** Alle sieben von B genannten Arten stehen in der Liste (3 bis 9 Einträge, alle mit `season`) — die Liste selbst sagt, in welchen Monaten die Frage gestellt wird. Den Tagebuch-Typ `flowering` gibt es, kein Scan-Weg schreibt ihn (B). Eine Schätzung gibt es für 30 von 40 Listen-Gemüsen. Die Zuordnung Art → Phase ist bei B aus dem Gedächtnis; ohne Quelle keine Phasen-Namen — die erste Scheibe sagt nur „Apfel blüht", nicht „Vollfrühling".
- **Kleinste erste Scheibe:** die Frage am Scan für Arten einer kurzen, belegten Liste, der Tagebuch-Eintrag, und die Zeile „N Tage seit …" an der Ernte-Schätzung. Hinter `localStorage.gs_feat_bluetenuhr`.
- **Woran man es prüft:** `kalender_check`. Beobachtung am 21.4., Schätzung im Juli → die Zeile nennt die Tageszahl. *Nicht prüfbar:* keine Beobachtung in diesem Jahr → keine Zeile, im Grund „keine eigene Blüh-Beobachtung". *Vergleich:* zwei Jahre → Differenz in Tagen; nur ein Jahr → kein Vergleich. Gegenprobe: Zuordnung über den Namen statt das Binomen → der Eintrag „Echter Apfelbaum" fällt durch.
- **Risiko:** `docs/KALENDER-V2.md` §10 schliesst Gartenlore als Rechnung aus — hier wird nichts verschoben, es stehen zwei Daten nebeneinander. Eine Fehlbestimmung wäre eine falsche Uhr: nur bei hoher Scan-Sicherheit und nur nach der Antwort der Person. Der Tag der Beobachtung ist nicht der Tag des Blühbeginns — „beobachtet am", nie „blüht seit".

---

## 4 · Meine Top 5 über alle drei Dateien und die Kreuzungen

1. **Die Kontrollkette (Z2: Radar → Korb → Kontrollzettel).** Drei Blickwinkel sind unabhängig an derselben Stelle angekommen, es ist der Moment mit dem höchsten Einsatz, und die Daten tragen den ersten Schritt ohne neuen Speicher.
2. **Winterschlaf (A4).** Die einzige Idee, die einen Grund zum Löschen der App beseitigt — mit einem Datum, das der Code rechnet; `harvest` steht bei allen 39 Kulturen.
3. **Wasser-Dreiklang (Z5), mit der Fingerprobe zuerst.** Das ist die Positionierung „Pflanze + Wetter + Sensor" in einer Frage, und der erste Schritt braucht kein Gerät.
4. **Notfall-Mappe (Z3).** Schliesst ein gemessenes Loch (die Menü-Suche findet „Notfall" nicht), ist klein, speichert nichts — und die Hausliste ist das, was am Telefon mit 145 wirklich fehlt.
5. **Rechenschaft (A5), als Anfang der Jahres-Abrechnung (Z4).** Keine andere Idee baut Vertrauen so billig: eine Zahl im Grund eines Ereignisses, das es schon gibt.

**Zuerst bauen würde ich: das Doppelgänger-Radar an der Artenkarte** — die erste Scheibe der
Kontrollkette. Es braucht keinen Speicher und keine KI, sein Prüfstandsfall läuft über die ganze
echte Liste (281 · 899 · 1'727), und Korb, Kontrollzettel, Lerndeck und Notfall-Mappe erben die
Auflösung.

**Der eine Schlüssel (Ding → Art und Kultur) — wer ohne ihn nicht hält:**

| Hält ohne ihn | Hält nur halb | Hält nicht |
|---|---|---|
| Fingerprobe, Rundgang, Rückkehr-Runde (Kern), Notfall-Übergabe, Radar und Korb (stehen auf Binom und `_gsArtenTreffer`) | Winterschlaf (60 %), Partie-Analyse (60 %), Keim-Kette (Boden-Zeile 26 von 39), Notfallblatt (von Hand angelegte Pflanzen ohne lateinischen Namen landen in „nicht bekannt") | Rechenschaft und Reife-Uhr über die Ernte (Freitext ↔ Pflanzung), Ertragsbilanz, Rezepte aus dem Bestand, die Frost-Zeile im Nachruf (die Tomate erreicht ihre Kultur nicht) |

Zwei weitere Fundamente tragen je mehrere Ideen und sind unabhängig zu legen: **ein Wetter-Rückblick
mit einem Schreiber** (Rückkehr-Wetter, Wasserkonto, Geeichter Regen, Fundplatz, Jahrgang) und **der
Pflege-Verlauf ohne Loch** (`doneTask`; Abschied mit Befund, Giess-Rhythmus).

---

## 5 · Nachtrag nach dem Lesen von `KREUZ-A.md`, `KREUZ-B.md` und dem Brett bis 05:15

**Wo drei Blickwinkel unabhängig am selben Punkt ankamen** — das stärkste Signal dieser Runde:

| Kreuzung | bei A | bei B | bei C | Was nur eine Seite hat |
|---|---|---|---|---|
| „Warum kommt nichts?" (Saatgut · Boden · Zeit) | K1 Keim-Kette | K2 Fehlerbaum | X2 Keim-Befund | B: die Reihenfolge „billigste Prüfung zuerst". C: die Deckung — Zeit-Zeile 37, Boden-Zeile 26 von 39 Kulturen |
| Der Scanner wird abgerechnet | — | K3 Ringversuch (eigene Berichtigungen, nach Sicherheit des Scans) | X1 Bestimmungs-Bilanz (Urteil der Pilzkontrolle) | B misst ohne Kontrolle, was die Person selbst berichtigt hat; C nimmt das Urteil von aussen. Beides gehört in EINE Zeile, getrennt benannt |
| Die Kontrollkette | M2 | Z2 | Z2 | alle drei gleich: Radar → Korb → Zettel |

**A und B wählen beide den Winterschlaf zuerst** — mit dem Grund, dass sein Moment jetzt ist (11. November).
Mein Radar-zuerst bleibt eine andere Gewichtung, kein Widerspruch: das Radar braucht weder Speicher noch
Server, der Winterschlaf braucht zwei Dinge, die B selbst als „vor dem Bau zu messen" nennt. Die eine
Messung liegt vor: **von 40 Gemüse-Einträgen der Artenliste erreichen 24 eine Aussaat-Kultur, 16 nicht**
(`kreuz1.js`, Block 3; gerechnet mit Listenname und Listen-Latein, also so, wie eine aus einem Scan
übernommene Pflanze heisst — frei getippte Namen wie „Tomate" treffen besser, das ist nicht gezählt).
Die andere (kennt der Server `snoozedUntil`?) kann nur der Head lesend messen. Wiegt „der Moment ist
jetzt" schwerer, ist der Winterschlaf zuerst richtig — dann gehört die Aussaat-Hälfte des Schlüssels in
dieselbe Scheibe, sonst mahnen Fleischtomate, Rosenkohl und Kohlrabi im Januar weiter.

**Drei Brett-Befunde, die in die Kontrollkette und in den Schlüssel gehören:**

- **SCANSCHUTZ (05:11):** `gsPickAlternative` baut die Karte der gewählten Alternative aus dem
  ursprünglichen Ergebnis und erbt dessen Gegenprobe — „Verzehr vertretbar" stand auf der Karte der
  Herbstzeitlose. Für das Radar heisst das: ein angetippter Gegenkandidat öffnet die ARTENKARTE
  (`openDetail`), er tauscht nie das Scan-Ergebnis aus.
- **SCANSCHUTZ (05:11):** `gsSaveConfirmedScan` und `gsAutoEnrichNewSpecies` legen KI-Einträge ohne
  `_unverified` in die Artenliste. Für Radar, Korb und Notfallblatt ist ein solcher Eintrag kein Beleg —
  die Regel „ungeprüft gehört in ‚nicht bekannt'" muss sie mitfassen, nicht nur die 1'383 aus der
  Buch-Einlese.
- **ARTEN (05:10):** 544 Einträge tragen ein Synonym, 477 einen Namen, den keine Rückgratliste kennt
  (466 davon aus der Buch-Einlese). Die Synonym-Spalte ist genau die Brücke, die dem Schlüssel fehlt —
  die Tomate („Lycopersicon lycopersicum" gegen „Solanum lycopersicum") ist so ein Fall. Und ARTENs
  Rat gilt für das Radar wörtlich: ein Einlese-Eintrag der Klasse „unbekannt" ist kein Gegenkandidat.
