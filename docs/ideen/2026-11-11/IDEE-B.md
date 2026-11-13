# IDEE-B · Blickwinkel „fremde Welten" — Runde 1 (Sichten)

Stand: `main` v33.58, nur gelesen (11.11.2026). Acht Ideen. Jede überträgt einen
MECHANISMUS aus einem anderen Feld, nicht ein Feature einer anderen Pflanzen-App.
Jede Zahl unten ist nachfahrbar; wo ich etwas nicht messen konnte, steht es da.

## Was für alle acht gilt (einmal, statt achtmal)

- **Schalter.** `localStorage.gs_feat_<name> === '1'`, Vorgabe aus. Den einzigen
  Schalter dieser Art gibt es schon: `gs_feat_aiproxy`, er steht in
  `GS_KEEP_ON_LOGOUT`. Jeder neue gehört ebenfalls dorthin (Gerätewahl), sonst
  meldet ihn `storage_check`.
- **Kein zweiter Rechenweg.** Giftigkeit nur über `_gsArtAnzeige` /
  `_gsVorsichtigste(_gsArtGruppe(...))`, Arten im Text nur über `_gsArtenTreffer`,
  Tage nur über `gsKalenderEreignisse`, Fälligkeit nur über `gsGetDueTasks` /
  `_gsTaskDays`. Eine neue Kalender-Quelle zieht den Fall „Ohne Daten" in
  `kalender_check` nach.
- **Drei Zustände** an jeder rechnenden Aussage: erfüllt · verletzt · nicht
  bekannt (mit Grund). Keine der acht Ideen braucht in ihrer ersten Scheibe die KI.
- **Texte** über `_t` / `_gsSatz` mit Eintrag in `GS_I18N_JS_STRINGS`
  (`i18n_check`), neue Fenster über `gsRegisterOverlay` (`android_check`), neue
  Schlüssel in genau einer Speicherliste.
- **Nachfahren.** Zählhelfer liegen in `/home/claude/team/ideen/`
  (`IDEE-B-gp_messung.js`, `IDEE-B-verweise.js`, `IDEE-B-menue.js`); „0 Treffer"
  heisst `grep -c -i '<Wort>' index.html` → 0.

## Die acht Ideen in einer Zeile

| # | Titel | Herkunftswelt | fremd? |
|---|---|---|---|
| 1 | Korb-Check — das „sterile Cockpit" vor dem Essen | Luftfahrt | |
| 2 | Notfall-Übergabe — die Karte fürs Telefon mit 145 | Rettungsdienst | |
| 3 | Flugschreiber — der Unfallbericht für eine eingegangene Pflanze | Flugunfall-Untersuchung | **ja** |
| 4 | Partie-Analyse — das Gartenjahr Zug um Zug, mit Jahrgangs-Etikett | Schach, Wein | **ja** |
| 5 | Wasserkonto — Giessen nach Kontostand statt nach Kalender | Buchhaltung | |
| 6 | Kultur-Fahrplan mit Verspätungsmeldung | Bahn, Paketverfolgung | |
| 7 | Jahreszeit-Peilung — der Scan als Messung der Jahreszeit | Navigation, Phänologie | **ja** |
| 8 | Rundgang — die Visite durchs Beet | Spital, Museum | |

---

## 1 · Korb-Check — das „sterile Cockpit" vor dem Essen

**Herkunftswelt und Mechanismus.** Luftfahrt: die Checkliste mit Pflichtpunkten,
die Regel „Sterile Cockpit" (in der kritischen Phase läuft nichts, was nicht zum
Flug gehört) und die No-Go-Logik (ein offener Punkt = kein Start; eine Liste kann
nur stoppen, nie freigeben). Es passt, weil der gefährlichste Moment dieser App
nicht der Scan im Wald ist, sondern der Abend in der Küche — Stunden später,
mit mehreren Funden auf einmal — und die App dort heute nur einen Satz hat.

**Was passiert.** An der Scan-Karte einer als essbar gemeldeten Wildpflanze oder
eines Pilzes steht „In den Korb". „Korb prüfen" öffnet ein Vollbild, in dem
sonst nichts läuft (keine Toasts, kein Quiz-Teaser, keine Abzeichen), und geht
Fund für Fund durch. Der Code rechnet je Fund die Punkte aus vorhandenen Daten:

1. Giftstufe der ART (nicht des Eintrags): `tox ≥ 3` oder nicht essbar → **STOPP**, nicht abhakbar.
2. Sicherheit des Scans (`_gsScanKonfidenz`) fehlt oder liegt im Bereich, den die
   Verlaufsliste schon rot zeigt (unter 65) → **STOPP** „Bestimmung zu unsicher".
3. Jeder Verwechsler ist ein Pflichtpunkt: aus der Scan-Antwort (`alternatives`,
   `_altGefahr`) und aus `lookalike` der Art. Löst sich der Text in eine Art
   auf, steht sie mit Giftstufe und `warning` da; löst er sich NICHT auf, steht
   der Text wörtlich da mit „nicht zugeordnet — behandle ihn als giftig".
4. Gegenprobe nötig (`gsGegenprobeNoetig`) und nicht gelaufen → Pflichtpunkt;
   „widerlegt" oder „unsicher" → **STOPP**.
5. Drei Fragen an den Menschen (das Gegenstück zur Selbstprüfung der Piloten):
   jedes Exemplar einzeln angesehen? · sicher, weil ich es weiss — oder weil ich
   es möchte? · isst ein Kind oder ein Haustier mit?

Es gibt genau zwei Ausgänge: „STOPP — N Funde nicht essen" oder „Liste
abgearbeitet — jetzt zur Pilzkontrolle" (bei Pilzen immer, sonst „zeig es einer
Fachperson"). Kein grüner Haken am Fund, kein dritter Ausgang.

**Warum neu.** 0 Treffer für `Pilzkorb`, `Sammelkorb`, `gs_korb`, `Checkliste`,
`No-Go`. Was es gibt: die VAPKO-Sätze (`mush_vapko_body`), der Steckbrief und die
Gegenprobe — ein Foto, ein Fund, im Moment des Scans. Nichts fasst mehrere Funde
zusammen, nichts kommt am Abend wieder.

**Worauf es aufbaut.** `gs_scan_history` (`SCAN_HISTORY_KEY`), `_gsScanZeit`,
`_gsScanKonfidenz`, `_gsArtAnzeige`, `_gsVorsichtigste`, `_gsArtGruppe`,
`_gsArtenTreffer`, `gsGegenprobeNoetig`, `gsScanGegenprobe`, `showScanResult`,
`gsRegisterOverlay` / `GS_VOLLBILD_OVERLAYS`, später `gsDrucken` (ein
Kontrollzettel für die Pilzkontrolle).

**Kleinste erste Scheibe** (`gs_feat_korb`). Knopf „In den Korb" an der
Scan-Karte (schreibt nur die Scan-Id in `gs_korb`, `GS_USER_KEYS`, Deckel 30 mit
„+N weitere"), Fenster „Korb prüfen" mit den Punkten 1–3 und den zwei Ausgängen.
Ohne Druck, ohne Sync, ohne KI.

**Woran man es prüft.** `scan_check`, neuer Block „Korb": (a) Bärlauch im Korb →
genau **1** Pflichtpunkt mit „Herbstzeitlose", der Ausgang bleibt gesperrt,
solange er offen ist; (b) Grüner Knollenblätterpilz → STOPP, und im ganzen
Fenstertext **0** Treffer auf `essbar|geniessbar|vertretbar|unbedenklich`;
(c) ein Verwechsler-Text, der sich nicht auflöst (PI475 „Knollenblätterpilze,
Karbolchampignon") → **1** Pflichtpunkt mit dem wörtlichen Text, nie „keine
Verwechsler"; (d) Scan ohne Sicherheitswert → STOPP „nicht bekannt". Gegenprobe:
Punkt 3 zurückbauen → (c) zeigt 0 Pflichtpunkte. Dazu `android_check`,
`contrast_check`, `touch_check`, `storage_check`.

**Risiko.** Die Liste darf nie als Freigabe gelesen werden — darum kein grüner
Zustand und der Schlusssatz „abgearbeitet heisst nicht essbar". IDEE-C hat
gemessen, dass 59 % der `lookalike`-Texte keine Art auflösen: Punkt 3 muss mit
dem Text leben, nicht mit der Auflösung. Der Korb hält Scan-Ids, keine Fotos
(Fotos liegen nur an 24 Scans) und keinen Standort. Der Befund „Gegenprobe ·
Verzehr vertretbar" (Brett 04:47, SCANSCHUTZ) muss vorher behoben sein — der
Korb-Check darf diese Zeile nicht erben. **Und es gibt zwei Scan-Wege:** der
eigene Pilz-Scanner (`openMushroomModal` → `gsMushroomRunScan` →
`gsMushroomRenderResult`) schreibt nichts in den Scan-Verlauf (0 Nennungen von
`gsAddScanHistory` / `saveScanToHistory` / `gs_scan_history` in seinem Bereich;
die Edge-Function `mushroom-identify` liest nur). Ein Korb, der vom Verlauf
lebt, sähe genau die Pilze nicht — Scheibe 1 braucht den Knopf an BEIDEN
Ergebnis-Karten. Haftungswortlaut gegen die Rechtstexte im Projekt halten: von
mir nicht geprüft.

---

## 2 · Notfall-Übergabe — die Karte fürs Telefon mit 145

**Herkunftswelt und Mechanismus.** Rettungsdienst und Spital: die strukturierte
Übergabe und die Erste-Hilfe-Karte — unter Stress beantwortet man nur, was vor
einem steht, in der Reihenfolge, in der es gefragt wird. Es passt, weil die App
heute sagt „145 anrufen. Beschreibe welche Pflanze/Pilz, wann und wie viel" und
die Person mit genau diesen Fragen allein lässt, obwohl sie einen Teil der
Antworten hat: den Scan-Verlauf.

**Was passiert.** Ein fester Einstieg „🆘 Notfall" im Menü, und die bestehende
Notfall-Antwort bekommt den Knopf „Karte fürs Telefon". Oben, sofort: der
Anrufknopf 145 (und 144). Darunter ein Lesezettel in grosser Schrift:
**Was** — die Scans der letzten 24 Stunden mit Name, lateinischem Namen, Foto
(falls vorhanden) und „gescannt um 14:10" (nie „gegessen um"); antippen heisst
„das war es", daneben „weiss ich nicht". **Wann · wie viel · wer · wie geht es** —
als Merkfelder nur auf dem Bildschirm. Nichts wird gespeichert, nichts gesendet;
die Karte lebt, solange das Fenster offen ist.

**Warum neu.** Gemessen (Brett 04:52): die Menü-Suche findet für „notfall",
„145", „tox info", „giftnotruf" **keinen** Eintrag; „vergiftung" führt zu
„Giftige Pflanzen" (einer Artensuche), „gegessen" zu „Rezepte". `tel:145` steht an
10 Stellen, alle an einem Pilz-Steckbrief, am Gefahren-Overlay oder an einer
Lina-Nachricht. 0 Treffer für `Notfallkarte`, `ISBAR`.

**Worauf es aufbaut.** `_gsNotfallStufe`, Text `notfall_sofort`,
`gsShowMushroomDangerOverlay`, `_gsBuildScanHistList`, `_gsScanZeit`,
`_gsArtAnzeige`, `MENU_ITEMS`, `gsRegisterOverlay`.

**Kleinste erste Scheibe** (`gs_feat_notfallkarte`). Menüeintrag mit den Tags
notfall · vergiftung · 145 · gegessen; Karte mit Anrufknopf und dem Block „Was"
aus dem Scan-Verlauf. Noch ohne Merkfelder.

**Woran man es prüft.** `scan_check`, neben N1: (a) drei Scans vor 2, 20 und
30 Stunden → die Karte nennt genau **2**, neuester zuerst; (b) leerer Verlauf →
„Kein Scan aus den letzten 24 Stunden", der Anrufknopf steht trotzdem; (c) nach
dem Schliessen: Zahl der Speicher-Schlüssel unverändert, **0** Aufrufe von
`sbFetch`. `nutzersicht_check`: Menü-Suche „notfall", „145", „vergiftung" →
erster Treffer ist die Karte (heute: nichts · nichts · „Giftige Pflanzen").

**Risiko.** Die App berät nicht medizinisch; feste Erste-Hilfe-Zeilen nur im
Wortlaut einer Quelle (Tox Info Suisse) — ich habe keine nachgeschlagen. Keine
Entwarnung auf der Karte, auch nicht bei einer harmlosen Art. Wer · Alter ·
Symptome sind Gesundheitsdaten: nie speichern, nie synchronisieren, nichts davon
in ein Analytics-Ereignis. Scan-Zeit ist nicht Verzehr-Zeit. Die Karte darf den
Anruf nicht verzögern — die Nummer steht zuerst. Der Block „Was" ist nur so
vollständig wie der Verlauf: Bestimmungen aus dem eigenen Pilz-Scanner stehen
heute nicht darin (siehe Idee 1) — bis das gerichtet ist, sagt die Karte „Pilze
aus dem Pilz-Scanner fehlen hier" statt zu schweigen.

---

## 3 · Flugschreiber — der Unfallbericht für eine eingegangene Pflanze

**Herkunftswelt und Mechanismus.** Flugunfall-Untersuchung: Nach einem Absturz
fragt niemand den Piloten nach der Ursache. Man liest den Recorder, schreibt
einen Bericht ohne Schuldzuweisung, und am Ende steht eine Sicherheitsempfehlung,
die den nächsten Flug ändert. Es passt, weil die App beim Weg auf den
Pflanzenfriedhof heute „Todesursache?" in ein leeres Textfeld fragt — die Person
weiss es in diesem Moment gerade nicht, und die App hat die Aufzeichnung.

**Was passiert.** Statt des Textfelds öffnet sich ein Bericht über die letzten
60 Tage der Pflanze: eine Zeitleiste (abgehakte Pflege, Verschiebungen, Standort,
Sensor-Alarme) und darunter die Auffälligkeiten, die der Code rechnet, jede mit
ihrer Datengrundlage: „Längster Abstand zwischen zwei Mal Giessen: 19 Tage, bei
eingestelltem Intervall 7 — aus 6 Einträgen" · „4-mal gegossen in 6 Tagen" ·
„draussen, frostempfindlich laut Kulturdaten" · „Licht gemessen 300 lux,
Artenliste nennt mindestens 1'000". Die Person wählt eine davon als Ursache oder
schreibt selbst. Der Bericht endet mit EINER Empfehlung, die die App behält: wer
dieselbe Art wieder anlegt, liest „Letztes Mal (März 2026): längster
Giess-Abstand 19 Tage — Intervall diesmal 5 statt 7?" — ein Vorschlag, nie automatisch.

**Warum neu.** 0 Treffer für `Flugschreiber`, `Unfallbericht`. `deathCause`
steht in 3 Zeilen: schreiben, beim Zurückholen löschen, im Friedhof anzeigen.
Der Dialog verspricht „hilft dir beim nächsten Mal" — beim Wieder-Anlegen liest
es niemand (Brett 04:51, Punkt 3).

**Worauf es aufbaut.** `moveToCemetery`, `renderCemetery`, `gs_dead_plants`,
`p.diary` (gedeckelt über `gsCapWithArchive`, 200 je Pflanze), `p.tasks[key]`,
`gsPflanzeDraussen`, `_gsKulturZuPflanze` (`frost`), `_gsArtZuPflanze`
(`lightMin`/`lightMax`), `gsRegelnPruefen`, `gsMesswerte`, `openAddPlant`.

**Kleinste erste Scheibe** (`gs_feat_flugschreiber`). In `moveToCemetery` vor
dem Textfeld: Zeitleiste aus `p.diary` und die EINE Auffälligkeit „Giess-Abstände"
mit drei Zuständen. Die Wahl landet wie bisher in `p.deathCause` — kein neuer
Speicher. Die Erinnerung beim Wieder-Anlegen ist Scheibe 2.

**Woran man es prüft.** `nutzersicht_check`, neuer Fall „Friedhof · Bericht":
Pflanze mit Intervall 7 und Giess-Einträgen im Abstand 5 · 6 · 19 · 4 Tage → der
Bericht nennt **19**; Pflanze mit 1 Eintrag → „Nicht bekannt — nur 1 Eintrag",
nie „regelmässig gegossen"; Pflanze ohne Verlauf → „kein Verlauf", das Textfeld
bleibt erreichbar. Gegenprobe: Abstandsrechnung ausbauen → der erste Fall zeigt
nicht mehr 19.

**Risiko.** Der Verlauf hat eine Lücke: `doneTask` (Knopf auf der Karte in „Meine
Pflanzen") schreibt keinen Eintrag, `gsQuickDone` schon (Brett 04:51, Punkt 1) —
darum trägt jede Aussage „aus N Einträgen", und unter drei Einträgen heisst es
„nicht bekannt". Kein Urteil über die Person, nur Zahlen (der Kalender-Entwurf
schliesst „du giesst zu oft" als Rechnung aus). Keine KI in Scheibe 1. Der Ton
ist ohne Schuld — sonst tippt niemand mehr ehrlich auf „eingegangen".

---

## 4 · Partie-Analyse — das Gartenjahr Zug um Zug, mit Jahrgangs-Etikett

**Herkunftswelt und Mechanismus.** Schach: nach der Partie geht man die Zugliste
durch, und die Maschine markiert jeden Zug nachträglich, mit dem besseren Zug
daneben. Wein: der Jahrgang als Etikett für das Wetter eines Jahres. Es passt,
weil das Prüfwerk des Kalenders heute nur nach vorn schaut (Vorhersage, sieben
Tage). Im November weiss man, wie das Jahr WAR — dieselben Regeln rückwärts
gefahren sind keine Warnung mehr, sondern eine Erklärung.

**Was passiert.** In „Mein Naturjahr" steht „Saison nachspielen". Die Züge des
Jahres (gesät, gepflanzt, geerntet) als Liste, jeder mit einem gerechneten Urteil
und dem Grund: „Tomaten am 20.4. ins Beet — vor dem Fenster (Kulturdaten: Mai,
Juni; mittlere Lagen)" · „Salat am 10.5. gesät — im Fenster" · „Monstera — nicht
bekannt, keine Kulturdaten". Später dazu: „drei Tage danach Frost, −1 °C" und
„geerntet nach 84 Tagen, Kulturdaten 60 bis 90". Oben das Etikett „Jahrgang
2026" — nur mit Zahlen, die vorliegen, und mit „aus N von 365 Tagen". Unten „Für
2027 merken": schreibt die ein bis drei Züge mit dem Urteil „Fehler" als
datierte Notiz ins nächste Jahr.

**Warum neu.** 0 Treffer für `Zugliste`, `Jahrgang`; „Partie" 1 Treffer (das
Wort „partiell" in einem Kommentar). „Mein Naturjahr" zählt, der „Rückblick" listet, „Deine Woche" fasst
sieben Tage zusammen — keines BEWERTET einen Zug. Und das tägliche Wetter-Log
`weather_log_per_garden` hat im Repo 1 Schreiber und 0 Leser (Brett 04:51,
Punkt 2): diese Ansicht wäre der erste.

**Worauf es aufbaut.** `gsKalenderEreignisse`, `_gsKalPruefwerk` (R1, R3, R4, R6
als Vorlage), `GS_SAE_DB` über `_gsSaeZuPflanze`, `_gsKulturZuPflanze`,
`gsErnteLoad`, `gsTagebuchAlle`, `gsOpenNaturjahr`, `gsKalRueckblick`,
`GS_WETTER_GRENZEN`.

**Kleinste erste Scheibe** (`gs_feat_partie`). Knopf in „Mein Naturjahr";
Zugliste nur mit dem Fenster-Urteil gegen `GS_SAE_DB`. Kein Wetter, kein Netz,
kein neuer Speicher.

**Woran man es prüft.** `kalender_check` (gestellte Uhr): Tomate gepflanzt am
20.4., Salat gesät am 10.5., eine Monstera → **3 Zeilen, 3 verschiedene
Zustände**; ohne Daten → „Noch keine Züge", nie eine leere Wertung. Sperre wie
F1: Zahl der Züge === Zahl der Kalender-Ereignisse derselben Arten. Gegenprobe:
den Monatsvergleich um 1 verschieben → die Tomate kippt auf „im Fenster".

**Risiko.** Die Monate in `GS_SAE_DB` zählen ab 0 (6 von 39 Kulturen tragen eine
0, keine eine 12) — genau daran hängt IDEE-As Befund zu `gsSaatgutJetzt`; die
Analyse nimmt denselben Leser wie `gsAussaatEreignisse`. Wetter rückwärts gibt
es nur lückenhaft: lokal sieben Tage (`GS_WETTER_GERAET_TAGE`), das Server-Log
fehlt an Tagen ohne App-Start und hat drei Unschärfen — Scheibe 2 erst, wenn es
stimmt. Der Weg von der Pflanze zur Kultur reisst bei Namen aus der Artenliste
(IDEE-C, Brett 04:54: „Fleischtomate" erreicht keine Kultur) — solche Züge
heissen „nicht bekannt", nie „im Fenster". „Fehler" steht nur dort, wo eine
Zahl steht.

---

## 5 · Wasserkonto — Giessen nach Kontostand statt nach Kalender

**Herkunftswelt und Mechanismus.** Buchhaltung: das Kontoblatt mit Soll und
Haben — Regen und Giessen sind Einzahlungen, Verdunstung ist die Abbuchung, und
gehandelt wird nach dem Saldo. Es passt, weil die Regel „Regen übernimmt das
Giessen" nur HEUTE kennt (ab 6 mm bis jetzt). 18 mm von vorgestern zählen nicht;
am dritten Tag steht „Giessen" wieder da, als hätte es nie geregnet.

**Was passiert.** Je Garten im Freien ein Kontoblatt der letzten sieben Tage:
je Tag „+ Regen", „− Verdunstung", darunter der Saldo. An der Giess-Aufgabe
steht dann EIN Satz mit Grund: „Wetter-Saldo +11 mm seit Sonntag — Giessen kann
warten" oder „−23 mm in sieben Tagen". Die Aufgabe bleibt stehen, abhaken bleibt
bei der Person. Hängt ein Bodenfeuchte-Sensor am Beet, steht sein Messwert
daneben und geht vor — der Kontoauszug schlägt die Buchführung.

**Warum neu.** 0 Treffer für `Wasserkonto`, `Kontostand`, `et0`,
`evapotranspiration`. Es gibt `_gsRegenUebernimmt` (nur heute) und im Planer
`_gsPlanWasser` (Wochenbedarf eines PLANS gegen die Regenprognose — nicht je
Tag, nicht an der Aufgabe).

**Worauf es aufbaut.** `_gsRegenUebernimmt`, `gsRegenGefallen`,
`GS_REGEN_REICHT_MM`, `gsPflanzeDraussen`, `GS_GARTEN_ARTEN.unter_glas`,
`gsWetterGeraetAbgleich` (Regen stündlich, sieben Tage, nur Gemessenes),
`gsMesswerte`, `_gsKalPruefwerk`, `gsGetDueTasks`.

**Kleinste erste Scheibe** (`gs_feat_wasserkonto`). Nur die Einzahlungsseite,
die schon gespeichert ist: Regensumme der letzten 72 Stunden aus dem
Wetterdienst-Gerät als zweiter Weg zum Zustand „Regen übernimmt". Kein neuer
Abruf. Verdunstung ist Scheibe 2.

**Woran man es prüft.** `kalender_check`, R2-Block: (a) heute 0, gestern 14,
vorgestern 9 mm → Hinweis mit **„23 mm in 3 Tagen"**; (b) drei Tage je 1 mm →
erfüllt, mit Zahl; (c) nur 20 von 72 Stunden bekannt → „Nicht bekannt: Regen nur
für 20 von 72 Stunden", nie „kein Regen"; (d) Pflanze drinnen → keine Regel.
`sensor_check` „Lina": die Zahl steht im Speicher. Gegenprobe: Fenster zurück
auf heute → (a) rot.

**Risiko.** Bodenspeicher, Topfgrösse und Mulch kennt die App nicht — das Konto
heisst darum „Wetter-Saldo" und behauptet nichts über den Boden; keine
Feuchte-Schwelle aus Artendaten. Die Schwelle für 72 Stunden ist eine
Entscheidung mit Beleg, kein Bauchwert (Vorschlag ohne Beleg: dreimal
`GS_REGEN_REICHT_MM`). Dass der Wetterdienst die Verdunstung als Tagesfeld
liefert, weiss ich aus dem Gedächtnis, nicht aus dieser Sitzung. Und ein
Rückblick im bestehenden Abruf würde `daily[0]` von „heute" wegschieben (das
Wetter-Log liest Index 0, `_gsWetterTage` und R1 lesen die ersten sieben
Einträge) — also eigener Abruf, eigener Schlüssel, ein Schreiber.

---

## 6 · Kultur-Fahrplan mit Verspätungsmeldung

**Herkunftswelt und Mechanismus.** Bahn: Fahrplan mit Halten, Anschlüssen und
der Meldung „12 Minuten später, Anschluss wartet nicht"; dazu die
Paketverfolgung mit „nächster Schritt erwartet bis". Es passt, weil zwischen
„gesät" und „Ernte voraussichtlich" heute nichts liegt. Die häufigste Frage in
dieser Lücke — müsste da nicht längst etwas kommen? — beantwortet die
Kulturtabelle schon, nur liest sie niemand als Termin.

**Was passiert.** Wer im Säkalender „als gesät eintragen" tippt, bekommt für
diese Aussaat einen Fahrplan: Keimung erwartet 12.–16.3. → frühestens ins Beet
ab Mai → Ernte ab Juli. Der nächste Halt steht als Info-Zeile im Kalender, mit
Grund. Ist das Keimfenster um, fragt die App einmal: „Tomaten: Keimung seit 4
Tagen überfällig (Kulturdaten: 6–10 Tage bei 22 °C). Gekeimt? Ja · Noch nicht ·
Nachsäen". Eine Verspätung schiebt die folgenden Halte sichtbar; stösst sie ans
Ende des Kulturfensters, heisst es „Anschluss verpasst: das Auspflanzfenster
endet im Juni".

**Warum neu.** 0 Treffer für `Fahrplan`, `gekeimt`, `Verspätung`, `Abhärten`.
`GS_SAE_DB` trägt `germ` bei allen 39 Kulturen, 37 davon als lesbare Spanne
„N–M Tage" — und im ganzen Quelltext liest genau **1** Stelle das Feld (die
Zeile „Keimzeit" im Säkalender-Detail).

**Worauf es aufbaut.** `gsSaeLogAsSowed` (Tagebuch, `cat: 'sowed'`),
`GS_SAE_DB` (`germ`, `indoor`, `outdoor`, `harvest`), `gsAussaatEreignisse`,
`gsKalenderEreignisse`, `_gsKalPruefwerk`, `_gsKalHinweis`, `gsTagebuchAlle`,
`gsTagebuchSave`.

**Kleinste erste Scheibe** (`gs_feat_fahrplan`). Nur der Halt „Keimung": aus
jedem Eintrag `sowed` der letzten 60 Tage und der Keimspanne ein Info-Ereignis
„Keimung erwartet" (Quelle Kulturdaten) und der Hinweis „überfällig seit N
Tagen", bis es einen Eintrag „gekeimt" gibt.

**Woran man es prüft.** `kalender_check` (Uhr 1.9.): (a) Radieschen gesät am
20.8. (5–10 Tage) → Fenster 25.–30.8., heute **„seit 2 Tagen überfällig"**;
(b) gesät am 28.8. → erwartet 2.–7.9., kein Hinweis; (c) Zwiebeln
(„Steckzwiebeln sofort") und Tulpen („Keimt im Frühjahr") → kein Ereignis, Grund
„keine Keimdauer hinterlegt"; (d) nach „gekeimt" ist der Hinweis weg. Der Fall
„Ohne Daten" räumt die neue Quelle mit leer.

**Risiko.** Nur 6 der 37 Spannen nennen ihre Temperatur („bei 22 °C"); draussen
im März keimt es langsamer. Für Aussaat im Freien heisst der Zustand darum
„nicht bekannt (Angabe gilt für Zimmertemperatur)" — prüfbar wird es mit einer
gemessenen Bodentemperatur. Kein siebter Aussaat-Datenbestand, nur `GS_SAE_DB`.
`gsSaeLogAsSowed` schreibt am geprüften Speicherweg vorbei (Brett 04:51,
Punkt 4) — das gehört vorher gerichtet, sonst steht der Fahrplan auf einem
Eintrag, der bei vollem Speicher fehlt.

---

## 7 · Jahreszeit-Peilung — der Scan als Messung der Jahreszeit

**Herkunftswelt und Mechanismus.** Navigation ohne Satellit: den eigenen
Standort bestimmt, wer bekannte Marken anpeilt. Und die Phänologie, die die
Jahreszeit an Zeigerpflanzen abliest statt am Datum. Es passt, weil die App mit
dem Kalendermonat rechnet und sich im Grund entschuldigt („höhere Lagen 2–3
Wochen später") — während die Person vor einer blühenden Forsythie steht und den
Scanner in der Hand hat. Das ist ein Messwert für genau ihren Ort.

**Was passiert.** Wird eine von rund zehn Zeigerarten gescannt, stellt die Karte
eine Frage: „Blüht sie? Ja · Noch nicht · Verblüht". Ein Ja wird als Beobachtung
ins Gartentagebuch geschrieben (Typ Blüte, mit Art). In „Mein Naturjahr" steht
dann: „Bei dir: Vollfrühling seit 21.4. — Apfelblüte, von dir beobachtet." Im
zweiten Jahr: „10 Tage früher als 2026." Mehr behauptet die erste Scheibe nicht.
Später, als eigener Entscheid: an einer Aussaat-Zeile der Zusatz „dein Frühling
ist 10 Tage voraus" — als Hinweis mit Quelle, nie als verschobenes Fenster.

**Warum neu.** 0 Treffer für `Peilung`; `Zeigerpflanze` 1 (eine Quizfrage);
„phänolog" in 6 Zeilen (Wochen-Fakten, ein Wort im Scan-Auftrag). Den
Tagebuch-Typ `flowering` gibt es in `GS_DIARY_TYPES`; kein Scan-Weg schreibt ihn.
Die Arten stehen in der Liste (Hasel 3 Einträge, Huflattich 4, Forsythie 3,
Vogelkirsche 5, Apfel 3, Schwarzer Holunder 9, Sommerlinde 4).

**Worauf es aufbaut.** `showScanResult`, `gsMatchScanToDb`, `_gsArtGruppe`
(Zuordnung über das Binomen, nicht den Namen), `_gsScanKonfidenz`,
`GS_DIARY_TYPES`, `gsDiaryAddEntry` bzw. `gsTagebuchSave`,
`gsKalenderEreignisse` (erscheint als Tagebuch-Ereignis), `gsOpenNaturjahr`.

**Kleinste erste Scheibe** (`gs_feat_peilung`). Eine Tabelle Binomen → Phase
(höchstens zehn Zeilen, jede mit Quelle im Kommentar), die Frage an der
Scan-Karte, der Tagebuch-Eintrag, die eine Zeile im Naturjahr.

**Woran man es prüft.** `scan_check`: (a) Scan Forsythie → die Frage steht da,
Scan Bärlauch → keine; (b) „Ja" → genau **1** Tagebuch-Eintrag mit Art und
Datum, am selben Tag im Kalender; (c) „Noch nicht" → **0** Einträge; (d) ohne
Beobachtung keine Zeile im Naturjahr (nicht „Winter"). Gegenprobe: Zuordnung
über den Namen statt das Binomen → „Echter Forsythie (Früh)" fällt durch.

**Risiko.** Der Kalender-Entwurf schliesst „Gartenlore als Rechnung" aus —
Scheibe 1 rechnet nichts, sie zeigt eine Beobachtung. Die Zuordnung Art → Phase
braucht eine Quelle (MeteoSchweiz); meine Artenliste oben ist aus dem Gedächtnis
und nicht nachgeschlagen. Eine Fehlbestimmung würde zur falschen Messung — darum
nur bei hoher Scan-Sicherheit und immer mit der Frage an die Person. Der Ort
bleibt am Gerät; eine gemeinsame Karte „wo blüht es schon" wären Ortsdaten
vieler und ist nicht Teil dieser Idee.

---

## 8 · Rundgang — die Visite durchs Beet

**Herkunftswelt und Mechanismus.** Spital: die Visite — jeden Tag dieselbe Runde,
an jedem Bett dieselben wenigen Fragen, alles ins Blatt. Museum: der Audioguide —
am Objekt stehen und zuhören, Hände frei. Es passt, weil „Messen" in dieser App
heute Sensor oder Zahlenfeld heisst. Die meisten haben keinen Sensor, aber Augen
und einen Finger; es fehlt die Form, in der drei Minuten Hinschauen zu Daten werden.

**Was passiert.** „Rundgang starten" führt Halt für Halt durch einen Garten: pro
Pflanzung ein Bildschirm, der Name gross, auf Wunsch vorgelesen, und höchstens
zwei Fragen mit grossen Knöpfen — „Erde in Fingertiefe: trocken · feucht · nass"
und „Etwas Auffälliges? nein · ja". Fällige Aufgaben des Halts stehen dabei und
lassen sich dort abhaken. Am Ende eine Zeile, „7 Halte · 2 trocken · 1
auffällig", und EIN Tagebuch-Eintrag für die Runde mit den Antworten. „Auffällig"
führt zum Pflanzendoktor; „nass" an einer fälligen Giess-Aufgabe ergibt später
den Hinweis „von dir am Rundgang als nass beobachtet".

**Warum neu.** 0 Treffer für `Rundgang`, `Visite`, `Kontrollpunkt`. Es gibt die
Aufgabenliste, die Handmessung mit Zahl (`gsMesswertEintragen`) und den
Sprachmodus (`gsVoiceSpeak`: 2 Nennungen, Definition und eine Antwort) — keine
geführte Runde und keine Beobachtung ohne Zahl.

**Worauf es aufbaut.** `gardens` / `plantings`, `gsGetDueTasks`, `gsQuickDone`,
`gsTagebuchSave`, `gsTagebuchAlle`, `openDoctorModal`, `gsVoiceSpeak`,
`gsPflanzeDraussen`, `_gsKalPruefwerk`.

**Kleinste erste Scheibe** (`gs_feat_rundgang`). Runde über die Pflanzungen
EINES Gartens, eine Frage (Erde), ein Tagebuch-Eintrag, die Schlusszeile. Ohne
Vorlesen, ohne Hinweis-Regel.

**Woran man es prüft.** `save_check` und `kalender_check`: Garten mit drei
Pflanzungen, Antworten trocken · nass · übersprungen → genau **1**
Tagebuch-Eintrag mit **2** Halten (der übersprungene fehlt — Stille ist keine
Beobachtung), am selben Tag im Kalender; **0** veränderte `lastDone` (Messen ist
kein Erledigen); bei vollem Speicher die Meldung am Rückgabewert von
`gsTagebuchSave`.

**Risiko.** Drei Stufen sind kein Prozentwert — nie als Bodenfeuchte in die
Messwerte schreiben (der Katalog verlangt %). Das Gartentagebuch ist auf 500
gedeckelt: darum ein Eintrag je Runde, nicht je Halt. Der Sprachmodus ist heute
fest auf `de-CH` gestellt (Erkennung und Ausgabe) — Vorlesen erst, wenn die
Sprache aus `gsLocale()` kommt.

---

## Wie die acht zusammenhängen (Material für Runde 2)

- **Der Rundgang (8) ist die Datenquelle** für den Flugschreiber (3), die
  Partie-Analyse (4) und das Wasserkonto (5): alle drei leiden daran, dass die
  App wenig über die Vergangenheit weiss.
- **Der Korb (1) ist die beste Antwort auf „Was?"** in der Notfall-Übergabe (2).
- **Der Fahrplan (6) liefert die Züge** für die Partie-Analyse (4): „gekeimt am"
  ist ein Zug, den es heute nicht gibt.
- **Vier Datenlücken tragen mehrere Ideen** und sind unabhängig von ihnen zu
  schliessen: der Pflege-Verlauf (`doneTask` ohne Eintrag), das
  Wetter-Tagesprotokoll (1 Schreiber, 0 Leser, Lücken), die Verwechsler-Texte
  (IDEE-C: 59 % lösen keine Art auf) und der Pilz-Scanner, der keinen
  Scan-Verlauf schreibt.

## Nicht aufgenommen — mit Grund

- **Triage („diese drei zuerst").** Der Mechanismus trägt (Sortieren unter
  Knappheit, samt „kann warten"), stösst aber an Fernandos Entscheid im
  Kommentar zu „Heute zu tun" (v31.24: keine Prioritäts-Plaketten, keine zweite
  Hervorhebung). Nur denkbar als Reihenfolge plus ein Satz plus „Rest auf
  morgen" über `gsSnoozeTask`, nach Rückfrage.
- **Lawinenbulletin / Doppelgänger-Stufe.** Die Rechnung über `season` ist die
  falsche (IDEE-C: Bärlauch × Herbstzeitlose überlappt rechnerisch nicht), die
  „Saison-Pilze" zeigen den tödlichen Doppelgänger schon, und eine Stufe
  „gering" würde als Entwarnung gelesen.
- **Blinde Zweitmeinung (Peer-Review).** Menschen bestimmen, ohne die KI-Antwort
  und ohne einander zu sehen. Verdeckte Antworten sind eine Server-Regel, keine
  Anzeige — braucht Tabelle und RLS, also keine erste Scheibe ohne Migration.
  Offen bestätigen kann ein Experte heute schon (`is_expert_verified`).
- **Versionsverwaltung (Diff, Zweig).** „Was wenn…" und der Entwurfsvergleich
  stehen im Planer, der Foto-Verlauf hat einen Vergleich; übrig bliebe ein
  Garten-Diff, der am Snapshot-Code hängt — in diesem Lauf tabu.
- **Compiler / Typprüfung.** Ist das Prüfwerk des Planers bereits.
- **Nowcasting.** Die Stundenwerte liegen vor; als eigenes Feature dünn — gehört
  als „trocken bis" an die Giess-Zeile von Idee 5.

## Beim Sichten gefunden (alle auf dem Brett, mit Beleg)

1. Gegenprobe im Scanner: „Verzehr vertretbar" folgt allein dem KI-Feld — auch
   unter „WIDERSPRICHT — Iss das nicht" und auch bei Pilzen (04:47).
2. Kalender: der Knopf an jeder Scan-Zeile ruft `gsSearchSpecies`, 0
   Definitionen (04:51).
3. Vier kleine Funde: Pflege-Verlauf mit Lücke · Wetter-Log ohne Leser ·
   Todesursache ohne Einlösung · Säkalender am Speicherweg vorbei (04:51).
4. Menü-Suche: „Notfall", „145", „Tox Info" finden nichts (04:52).
5. Der eigene Pilz-Scanner schreibt keinen Scan-Verlauf — eine dort bestimmte
   Art fehlt in Verlauf, Kalender, Naturjahr und Linas Kontext (05:00).

## Nicht gemessen

- Nichts im Browser gefahren (kein Playwright-Lauf, kein Prüfstand) — alle
  Aussagen stehen auf Quelltext und Zählung.
- Keine Web-Recherche (der Auftrag nennt keine): die Angaben zu Open-Meteo
  (Verdunstung, Rückblick-Tage) und zur Phänologie (Zeigerarten) sind aus dem
  Gedächtnis und vor dem Bau zu belegen.
- Kein Live-Zugriff: ob `weather_log_per_garden` Zeilen hat und ob es ausserhalb
  des Repos einen Leser gibt, weiss ich nicht.
