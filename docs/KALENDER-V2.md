# KALENDER-V2 — der denkende Kalender

> Entwurf vom 15.09.2026, auf gemessener Grundlage (Kartierung vom 14./15.09.:
> eine Funktion, 13 Geschwister-Oberflächen, 20 Befunde mit Zeilennummern —
> fünf davon in v33.33 behoben). Auftrag von Fernando (14.09.): der intelligenteste
> Kalender, verknüpft mit Mein Naturjahr, Saisonkalender und Garten-Timeline;
> intelligentes Filtersystem; „der Kalender soll selber denken können"; Backend und
> Frontend sauber; **nicht vollgepumpt**; Lina komplett verknüpft; super einfach.
> `KALENDER-V1.md` bleibt gültig — V2 ändert nichts an der einen Regel, es baut
> darauf.

## 0 · Die eine Regel bleibt — und die neue dazu

> **Es gibt EINE Frage — „was ist an diesem Tag?" — und EINE Funktion, die sie
> beantwortet:** `gsKalenderEreignisse(von, bis)`. (V1, Regel 1.)

> **NEU: „Denken" heisst nicht, mehr zu wissen, sondern das, was die App schon
> weiss, GEGENEINANDER zu halten — und zu sagen, woher.** Ein Frosttag und ein
> Aussaatfenster im selben Monat sagen einander heute nichts; ein gemessener
> Regen und eine Giess-Aufgabe ebenso (der Draht existiert nur in
> `gsGetDueTasks`, `eintrag.regen`, und erreicht den Kalender nicht). Der
> denkende Kalender ist ein **Prüfwerk über dem Ergebnis der einen Funktion** —
> dieselbe Bauform wie `_gsPlanPruefwerk` (PLANER-V3): jede Regel rechnet
> offline aus Daten, die im Repo liegen, hat drei Zustände (erfüllt · verletzt
> · nicht prüfbar mit Grund) und schreibt ihr Urteil als Feld `hinweise[]` an
> die beteiligten Ereignisse. Danach kommt ein **Sieb** (Filter), nie ein
> zweiter Rechner; jede Zahl auf dem Bildschirm trägt ihr „N von M". Lina liest
> dieselben Ereignisse und dieselben Hinweise — sie redet darüber, sie rechnet
> nicht.

Reihenfolge, fest: **Rechnung → Prüfwerk → Sieb → Anzeige.** Was der Code
ausrechnen kann, entscheidet nie die KI allein (CLAUDE.md §4b).

## 1 · Fünf Entscheidungen

| # | Frage | Entscheidung | Grund |
|---|---|---|---|
| 1 | Filter als drittes Argument oder als Sieb danach? | **Sieb danach**: `_gsKalFiltern(liste, f)`. Signatur `gsKalenderEreignisse(von, bis)` bleibt. | Vier Leser rufen die Funktion (`_gsKalRender` 2×, `_gsDayPlanKalender`, `gsLinaZahlen`); keiner darf eine gefilterte Antwort bekommen, sonst laufen Startseite, Lina und Kalender auseinander (v32.87-Klasse). „14 Ereignisse, 9 gezeigt" ist nur ehrlich, wenn die 14 wirklich gerechnet wurden. Und das Prüfwerk läuft VOR dem Sieb: wer `wetter` ausblendet, sieht an der Aussaat-Zeile trotzdem den Frost-Hinweis. |
| 2 | Garten-Timeline: Rückblick-Modus oder aufheben? | **Aufheben.** Der Menüeintrag `mi-timeline` öffnet den Kalender mit eingeschalteter Gruppe „Rückblick". Kein zweites Fenster, kein Modus. | Die Timeline (v23.57) hat null Rechnung, las bis v33.33 einen toten Schlüssel (0 Scans, immer), zeigt sechs feste deutsche Daten ohne Bezug zu Standort oder Höhe. Alles, was sie zeigen sollte, zeigt der Kalender aus denselben Quellen — sobald `scan` eine Art ist und die echte Ernte ein Ereignis. Ein Modus wäre ein zweiter Zustand, den jeder Prüfstand mitstellen müsste. |
| 3 | Aussaatfenster: Vorgabe aus, oder nur gemerkte Kulturen? | **Vorgabe AN.** Die Merkliste `gs_sae_merkliste` wird ZWEITE Quelle (Grund „auf deiner Merkliste"), keine Sperre. Vorgabe AUS bekommen `messung` und `scan`. | Nachgemessen: die 13 Aussaat-Ereignisse des Seeds kommen aus den DREI eigenen Kulturen (Tomaten 5, Basilikum 5, Zucchini 3) — `gsAussaatEreignisse` liefert nur für Kulturen, die die Person hat (28752: `if (!listen.length) return out`). Das ist nicht vollgepumpt. Was flutet: `messung` (je Gerät und Tag eins — bis 30 im Monat für ein Handgerät) und `scan` (bis 200). |
| 4 | Konflikt als eigene Ereignisart oder als Feld? | **Feld** `hinweise: [{regel, zustand, text, grund}]` an jedem beteiligten Ereignis, gesetzt von `_gsKalPruefwerk(liste)` am Ende der einen Funktion. Nur `verletzt` wird als Zeile gezeigt; `nicht_pruefbar` steht im Grund; `erfuellt` bleibt im Objekt. | Ein Hinweis ist eine Aussage ÜBER ein Ereignis, kein eigenes Ding am Tag. Eine zehnte Art bräuchte Punkt, Chip, Rang, i18n, Filterzustand — und bläht die Zählung (aus 14 würden 17, davon 3 Wiederholungen). Am Feld hängt der Konflikt an beiden Seiten und reist unverändert zu Lina und zur Startseite. Dieselbe Entscheidung wie `plan._licht` / `plan._nachbarn`. |
| 5 | Wochenansicht neben Monat und Tag? | **Nein.** Die Woche ist eine RECHNUNG (`gsKalenderEreignisse(heute, heute+6)`, aggregiert) und erscheint als EINE Zeile: Startseite, Lina-Kontext, Kalender-Fuss. `gsWochenrueckblick` liest die Rückrichtung aus derselben Funktion. | „Super einfach": Monat oben, Tag unten ist gelernt; ein dritter Reiter ist ein dritter Zustand für drei Prüfstände. Was die Woche leistet („5 Aufgaben · 1 Fenster · Frost am Mi") ist eine Aggregation. |

## 2 · Das Ereignismodell V2

Unverändert: die 14 Felder aus V1 (`id, art, datum, zeit, ts, titel, emoji,
pflanze, garten_id, quelle, status, faellig_seit, verweis, grund`). Berichtigt
gegen den Code (V1 nannte Werte, die nie vergeben werden): `quelle` ∈
{regel, hand, plan, sensor, wetter, kulturdaten} — **neu** `lina` (von Lina
vorgeschlagen, von der Person bestätigt); `status` ∈ {offen, verschoben, info}
— ein erledigtes Ereignis verschwindet, weil `lastDone` die Fälligkeit
verschiebt; es gibt kein `erledigt`.

Neu:

| Feld | Wo | Bedeutung |
|---|---|---|
| `hinweise` | jedes Ereignis, Array | `[{regel:'frost_aussaat', zustand:'verletzt'|'erfuellt'|'nicht_pruefbar', text, grund}]` — vom Prüfwerk gesetzt; leer, wenn keine Regel das Ereignis berührt |
| `fenster` | `art: 'aussaat'` | `'indoor'` \| `'outdoor'` — statt Textsuche im Titel |
| Art `scan` | quelle `hand`, Rückblick | aus `gs_scan_history` über `_gsScanZeit(h)` (v33.33); Verweis Scan-Verlauf; Vorgabe im Sieb: aus |
| Art `ernte` mit quelle `hand` | aus `gs_ernte_log` | die ECHTE Ernte an ihrem `ts` — heute schreibt kein Ernte-Schreiber ins Tagebuch, die Ernte stand nie im Kalender (K4). Ein Eintrag, zwei Ansichten: kein zusätzlicher Tagebuch-Eintrag |

Zehn Arten: aufgabe · alarm · erinnerung · aussaat · ernte · wetter · tagebuch
· gepflanzt · messung · scan. `_GS_KAL_ART` ist die EINE Quelle für ihre
Beschriftung; die Legende von heute (6 von 9, kein CSS-Punkt für `aussaat`)
entfällt zugunsten der Chips.

## 3 · Die rechnenden Regeln (das Prüfwerk)

Jede Regel: Eingaben, die im Repo liegen · Ausgabe als `hinweise`-Eintrag ·
ein **guter** Fall, ein **schlechter**, ein **nicht prüfbarer** — alle drei im
Prüfstand, aus dem gerenderten HTML gelesen. Keine Regel schreibt: kein
`lastDone`, kein Datum wird angefasst (V1 Regel 7).

| Regel | Eingaben | verletzt heisst | nicht prüfbar, wenn |
|---|---|---|---|
| **R1 Frost trifft Aussaat draussen** | die Tage ≥ heute aus `gs_weather_cache.daily` (nicht die Frost-Ereignisse der Liste — die hängen an [von, bis]) × `aussaat` mit `fenster:'outdoor'` im selben Monat; das Frost-Ereignis trägt den Wert als FELD `wert` (die Regel liest kein übersetztes Titelfeld) | an beiden Seiten: „Frost am 03.09. (1.2 °C laut Vorhersage) — draussen lieber danach säen" / „trifft das Aussaatfenster: Feldsalat säen (draussen)" | keine Vorhersage geladen, oder die Vorhersage deckt keinen Tag ≥ heute in diesem Monat → „Frost: keine Wettervorhersage für diese Tage geladen" (nur im LAUFENDEN Monat — an einem Fenster im übernächsten Monat stünde der Satz zwölfmal, ohne dass er je anders lauten könnte). **`erfuellt` gibt es nur, wenn die Vorhersage einen Tag dieses Monats wirklich abdeckt** („kein Frost in der Wettervorhersage bis 07.09."), nie aus einem alten Cache |
| **R2 Regen übernimmt das Giessen** | `aufgabe` key `water`, **heute fällig** × `gsPflanzeDraussen(p)` × `gsRegenGefallen()` ≥ `GS_REGEN_REICHT_MM` (6). **EINE Implementierung**: `_gsRegenUebernimmt(p)` — `gsGetDueTasks` (`eintrag.regen`, v31.84) und das Prüfwerk rufen dieselbe; der Fall zählt beide Seiten gegeneinander. *Bewusst NICHT mitgeaendert:* die Startseite zeigt den Regen-Vermerk seit v31.84 an jeder Giess-Aufgabe mit `d ≤ 2`, also auch an einer von übermorgen. Das ist fragwürdig, aber es ist der Bestand — und eine Aenderung daran ist eine eigene, gemessene Scheibe, keine Nebenwirkung dieser hier. Das Prüfwerk urteilt nur ueber HEUTE | „Regen übernimmt: 8 mm bis jetzt" — Grund „Wetterdienst, Stand vor 20 min — abhaken bleibt dir"; die Aufgabe bleibt, das Kästchen bleibt | `gsPflanzeDraussen === null` („Standort unbekannt"); keine Regenwerte geladen; ein Programmfehler ist „nicht bekannt", nie „drinnen". Drinnen (`false`) ist kein Zustand — die Regel gilt nicht |
| **R3 Ernte-Schätzung nur mit Kulturdaten** | Pflanzungen mit `date`; bis v33.33 rief Nr. 4 `calcHarvestDate(p, null)` → `getPlantInfo(name)`, das für Unbekanntes `{minDays:60, maxDays:90}` liefert — **gemessen: eine Monstera-Pflanzung bekam „Ernte voraussichtlich 16.10."**, Rosen „15.12.". Jetzt EINE Nachschlagung `_gsKulturZuPflanze(p)` (41 Kulturen in `PLANT_DB`, exakt), und das Datum rechnet aus DEREN `minDays/maxDays` (Mitte), nicht aus einer zweiten unscharfen Suche | — (kein Hinweis; die Regel entscheidet, ob es das Ereignis GIBT). Grund in Alltagssprache: „Zucchini braucht meist 50–65 Tage — gepflanzt am 2.8. Eine Schätzung, kein Versprechen" | kein Kultur-Treffer → KEIN `ernte`-Ereignis; das Pflanzungs-Detail sagt „keine Kulturdauer hinterlegt". Nie ein Datum aus dem Rückfall |
| **R4 Erntereif geschätzt, nichts eingetragen** | `ernte` quelle `regel`, datum ≤ heute im betrachteten Bereich × `gs_ernte_log` (Zuordnung `plant_local_id === p.id` oder normierter Name `pflanze`, `ts ≥ p.date`; die Felder heissen `pflanze`/`menge` — kein Schreiber schreibt `name`/`amount`) | „seit 5 Tagen voraussichtlich erntereif — noch keine Ernte eingetragen" mit Verweis `openErnteTracking`; erfüllt: „Ernte eingetragen am 29.8. (420 g)" im Grund. **Grenze dieser Scheibe:** der Hinweis hängt am Ereignis in der Vergangenheit — wer in der Oktober-Ansicht steht, sieht die September-Schätzung nur beim Zurückblättern; Scheibe 4 (echte Ernte) legt die offene Ernte zusätzlich an „heute" | Log-Zeile ohne lesbares `pflanze` → „1 Ernte-Eintrag ohne Pflanzennamen — nicht bekannt, ob geerntet wurde" (nie „nichts eingetragen") |
| **R5 Überfällig-Stufe** | `faellig_seit` ≤ −`GS_UEBERFAELLIG_LANGE_TAGE` (7 = „wöchentlich", die mittlere Giess-Stufe) | nur die Klasse `gs-kal-lange` — KEIN eigener Satz: die Unterzeile sagt „Seit 11 Tagen fällig" schon, und ein Satz steht einmal (v32.87) | `lastDone` fehlt: `getDaysUntilDue` gibt 0 (sieht aus wie „heute") → „noch nie abgehakt" |
| **R6 Frost trifft frostempfindliche Pflanze draussen** | `wetter`-Frost × Pflanzen beider Listen mit `gsPflanzeDraussen(p) === true` und `_gsKulturZuPflanze(p).k.frost === -1` (11 Kulturen −1, 30 tolerant, sonst 0) | am Frost-Ereignis: „trifft: Zucchini (Balkon Süd), Tomate" | `frost 0`/keine Kultur („für Monstera keine Frostangabe"); Standort unbekannt; kein Cache → das Frost-Ereignis existiert nicht, die Regel schweigt |
| **R7 Vier Wetter-Schwellen aus EINER Tabelle** | `gs_weather_cache.daily` (wird schon geholt: tmax, precipitation_sum, windspeed_10m_max) × `GS_WETTER_GRENZEN = {frost:2, hitze:30, starkregen:20, sturm:40}` — heute vier Literale in `gsOpenWeatherWarn`, das dazu einen EIGENEN Open-Meteo-Aufruf macht und den Legacy-Schlüssel `userLocation` liest | je Tag und Schwelle ein `wetter`-Info-Ereignis wie Frost („Hitze erwartet — Höchstwert 31 °C", Grund: Vorhersage, Standort, Alter). `gsOpenWeatherWarn` liest denselben Cache und dieselbe Tabelle | kein Cache → keine Ereignisse UND das Warnfenster sagt „keine Vorhersage" statt „✅ alles im grünen Bereich" (heute die Antwort, wenn der Aufruf fehlschlägt: Stille als erfüllt) |
| **R8 Leere Tage sind eine Aussage** | Liste je Tag VOR dem Sieb, Filterzustand, Datengrundlage `_gsKalDatenlage()`: Pflanzen, Tagebuch, Geräte OHNE das Pseudo-Gerät „Wetterdienst", Pläne (Scans und Merkliste erst, wenn sie Ereignisse liefern — Scheibe 4). **Nicht der Wetter-Zwischenspeicher:** den hat jede Person mit Standort ab dem Start, er würde „Noch keine Daten" im Betrieb unerreichbar machen | drei verschiedene Sätze: „Nichts an diesem Tag" (Daten da) · „3 Einträge ausgeblendet — alle zeigen" (Filter) · „Noch keine Daten — leg eine Pflanze an, dann füllt sich der Kalender" (keine Quelle) | `localStorage` nicht lesbar → dritter Satz mit „Speicher nicht lesbar" |
| **R9 Abwesenheit trifft Aufgaben** | `gs_push_settings.pauseUntil` (dieselbe Regel, die der Giess-Zettel als Fenster nimmt) × `aufgabe` in [heute, pauseUntil] | „in deinen Stillen Tagen (bis 20.9.) — Giess-Zettel" mit Verweis `gsGiessZettelOeffnen`; Fuss: „6 Aufgaben fallen in deine Abwesenheit" | `pauseUntil` unlesbar → „Stille Tage: Datum unlesbar"; keine Pause → kein Feld |
| **R10 Die Woche als Aggregat** | `gsKalenderEreignisse(heute, heute+6)` → Zähler je Art + Frosttag + verletzte Hinweise; rückwärts `(heute−7, heute)` → erledigt (tagebuch quelle regel), messung, wetter | EINE Zeile: „Diese Woche: 5 Aufgaben · 1 Aussaatfenster · Frost am Mi · 2 Hinweise" — Startseite, Lina, Kalender-Fuss. `gsWochenrueckblick` wird Leser statt eigener Schleifen | kein Cache → „Frost: keine Vorhersage"; keine Pflanzen → die Zeile entfällt (ein „0 Aufgaben" ohne Pflanzen ist keine Aussage) |

Was **nicht** gerechnet wird, mit Grund: Mondkalender (keine belegte Wirkung —
bleibt Anzeige); Höhenlage (`gs_user_location.elevation`: 2 Leser, 0
Schreiber — die `s.bloom`-Klasse; der Satz „höhere Lagen 2–3 Wochen später"
bleibt Text im Grund); „Eisheilige 15.05." und die anderen fünf festen Daten
der Timeline (Gartenlore ohne Standort); Schädlingswellen (keine Tabelle mit
Sichtungen); „du giesst zu oft" (Sollwerte bei 40 von 4'342 Arten).

## 4 · Das Sieb

- **Gespeichert wird nach ART, gezeigt nach GRUPPE.** `gs_kal_filter =
  {aus: ['messung','scan'], garten: null}` — die Liste der AUSGEBLENDETEN
  Arten, damit eine neue Art automatisch sichtbar ist. **Fünf** Gruppen-Chips (gebaut v33.35):
  **Zu tun** (aufgabe · alarm · erinnerung) · **Säen & Ernten** (aussaat ·
  ernte · Plan-Termine — nicht „Fenster": in dieser App ist ein Fenster ein
  Standort, `_GS_DRINNEN` kennt es, Basilikum steht am „Küchenfenster") ·
  **Wetter** (wetter) · **Rückblick** (tagebuch · gepflanzt) · **Messwerte**
  (messung · später scan).

  *Warum fünf und nicht vier:* die Vorgabe blendet `messung` aus
  (Entscheidung 3). Stände sie im Rückblick, wäre dessen Chip von Anfang an
  HALB aus — ein dritter Zustand, den niemand liest. Ein Chip ist an oder aus.
  Der Entwurf sagte hier zuerst „vier", nannte im selben Abschnitt aber
  „Messwerte 5" als Beispiel für einen ausgeschalteten Chip; der Bau hat den
  Widerspruch aufgelöst.

  **Die Punkte im Raster tragen die Farbe der GRUPPE** (fünf Farben), nicht
  der Art (neun Arten, acht Farben, `aussaat` ohne) — so erklären die Chips
  den Farbcode, und die Legende kann entfallen, ohne dass ein brauner Punkt
  unerklärt bleibt. Garten-Auswahl (`garten_id`) nur bei `gardens.length > 1`.
  Keine Pflanzen-Auswahl (die Pflanze hat ihr Tagebuch). Kein Filter nach
  Quelle auf dem Bildschirm — `quelle` steht im Grund jeder Zeile.
- **Vorgabe:** alles an ausser `messung` und `scan` (Entscheidung 3).
- **Jeder Chip trägt seine Zahl** aus der UNGEFILTERTEN Liste des sichtbaren
  Monats („Rückblick 9"); ein ausgeschalteter Chip sagt so, was er verbirgt.
- **Die Zahl daneben — an EINER Stelle:** am ausgeschalteten Chip („Messwerte
  5") und im Tageskopf nur „(1 ausgeblendet)", wenn > 0. Kein Monatsfuss mit
  „14 · 9 · 5": drei Anzeigen derselben Zählung sind drei Stellen, die
  auseinanderlaufen können (die Richter haben es gemessen).
- **Speicherung** (§3.3/§3.5): `gs_kal_filter` in `GS_USER_KEYS`; im
  state-Blob HIN (`_buildStateBlob`) UND RÜCK (`stateMap`); explizites
  `markDirty('state')` beim Schreiben; Schreibversuch am Rückgabewert `=== false`;
  Probewert für `sync_check`.
- **Die Sperre:** ein Fall „Filter aus ⇒ Liste === `gsKalenderEreignisse`,
  Eintrag für Eintrag". Wer aus Tempo eine Quelle in der RECHNUNG überspringt,
  wenn der Chip aus ist, macht „N von M" falsch und Lina blind.

**Gebaut in v33.35** (`kalender_check` F1–F6): `_gsKalFiltern(liste, f)` nach
dem Prüfwerk, `gs_kal_filter` in `GS_USER_KEYS` und in beiden Richtungen des
state-Blobs, fünf Chips als `button` mit `aria-pressed`, Punkte nach Gruppe,
Legende entfallen, dritter Leerzustand mit „Alle zeigen". Gegenproben: das
Sieb in die Rechnung geschoben → F1 rot; Chip-Zahlen aus der gefilterten Liste
→ F2 rot; dritter Leerzustand ausgebaut → F4 rot; Punkte wieder nach Art →
F5 rot. Und eine Lehre aus dem Bau: F2 war mit leerem Filter zuerst GRÜN mit
der falschen Regel — ungefiltert und gefiltert liefern dann dieselbe Zahl.
**Ein Fall, dessen zwei denkbare Regeln zufällig dasselbe Ergebnis liefern,
prüft keine von beiden** (v33.28); er blendet jetzt zuerst eine Gruppe MIT
Ereignissen aus.

## 5 · Das Fenster (412 px, von oben)

1. Kopf „📅 Kalender" mit der Unterzeile in Alltagssprache: „Aufgaben,
   Aussaat, Wetter und Tagebuch nach Tag — aus deinen Pflanzen. ⚠ heisst:
   hier passt etwas nicht zusammen; antippen zeigt, warum." („Rechnung" ist
   in der Schweiz zuerst etwas zum Bezahlen.)
2. Monatsnavigation ‹ September 2025 › — Wochentage aus `gsWochentage({abMontag:true})`
   (heute: `_GS_KAL_WT` ist eine feste deutsche Liste — i18n-Verstoss, geht mit).
3. EINE horizontal scrollbare Chip-Zeile, `button` mit `aria-pressed`, je Chip
   Name + Zahl. Die Legende entfällt; die Farbe steht als Punkt im Chip.
4. Das Raster wie heute (bis drei Punkte je Tag, Zahl bei mehr). NEU: eine
   ⚠-Ecke an Tagen mit mindestens einem verletzten Hinweis, der einen TEXT
   trägt (in `em`, wächst mit dem Senioren-Modus); sie ist das eine Signal
   „schau hier" — der rote Überfällig-Rand bleibt, R5 zählt nicht zusätzlich
   zur Ecke. Die `aria-label` des Tages nennt den Hinweis. Marken aus der
   ungefilterten Liste, Punkte aus der gefilterten.
5. Tageskopf mit „N (M ausgeblendet)".
6. Die Zeilen wie heute (Emoji · Titel · Unterzeile · Kästchen für aufgabe, ›
   für Verweis, Punkt für info); darunter je Zeile höchstens EINE Hinweiszeile
   in der Warnfarbe — `--c-warn-d` ist eine TEXTfarbe, nie eine Füllung
   (`contrast_check` misst dieses Fenster in beiden Modi). **Gedeckelt:**
   EIN Satz sichtbar, dann „+N weitere", der Rest im Grund (R1 schreibt je
   Frosttag einen Satz — eine Novemberwoche hätte sieben; der Fall stellt drei
   Frosttage her und liest „+2 weitere" aus dem HTML). Tippen klappt den
   Grund auf; dort stehen die „Nicht bekannt:"-Sätze. Ein Satz steht nur
   EINMAL: R5 schreibt keinen Text (die Unterzeile sagt „Seit 11 Tagen fällig"
   schon), nur die Klasse.
7. Fuss mit höchstens zwei Zahlen: „Diese Woche: 5 Aufgaben · Frost am Mi"
   (Scheibe 6) — nicht „3 offene bis heute" daneben (die Person fragt „3 oder
   5?"). Der „📊 Messwerte"-Knopf im Kopf gehört nicht zur Frage „was ist an
   diesem Tag?" — Messwert-Zeilen tragen ohnehin ein ›; er geht mit Scheibe 2.
8. Drei Leerzustände (R8).

Was NICHT dazukommt: keine Termin-Eingabe im Fenster (ein freier Termin ist
ein Tagebuch-Eintrag mit Datum — `tb-date`, Ereignisart `erinnerung`), keine
Mondphasen, keine Wochenansicht, keine zweite Farbe je Quelle. Antippflächen
≥ 24 px bei 412 und 320 px; Chips als Knöpfe mit Namen.

## 6 · Die drei Namen aus dem Auftrag

| Oberfläche | gibt | nimmt | Befund geschlossen |
|---|---|---|---|
| **Mein Naturjahr** (`gsOpenNaturjahr`) | nichts (ein Rückblick) | Balken und vier Kacheln aus `gsKalenderEreignisse(J-01-01, J-12-31)`: gepflanzt, tagebuch, ernte(hand), messung, scan. Kachelzahl === Ereigniszahl. Funde, Quiz, Erfolge bleiben eigene Quellen | K1 (Arten ohne Jahresfilter — der Scan von 2019 stand unter „2025"), K3 (Pflanzungen 1 vs 4; die Kalender-Zählung gewinnt, die Kachel heisst „aufgenommen und gepflanzt"). K2 (Erfolge nur nach Öffnen des Achievement-Fensters) wird benannt, nicht mit dem Kalender gelöst |
| **Säkalender** (`openSaekalender`, `GS_SAE_DB` 39 Kulturen) | seit v33.13 die Fenster der eigenen Kulturen; NEU die Merkliste als zweite Quelle. `GS_SAE_DB.harvest` NICHT als weitere Ereignisse (vollgepumpt), sondern als Plausibilität im Grund der Ernte-Schätzung („Kulturfenster Jul–Okt") | „als gesät eintragen" (`gsSaeLogAsSowed`, cat `sowed`) ist schon ein Tagebuch-Ereignis — der eine Schreibweg bleibt | — |
| **Garten-Timeline** (`gsOpenGardenTimeline`) | nichts | verschwindet; `mi-timeline` und `MENU_ITEMS` führen zum Kalender mit Rückblick-Gruppe. Entfernen mit dem Parser (`robust_check` Fall 16), BEWUSST-/OHNE_EINSTIEG-Listen prüfen, Wirkung vorher verfolgen (v33.05) | S4 (v33.33), S5 (sechs feste Daten) |

Was NICHT verknüpft wird, mit Grund: Blühkalender, Saison-Tab (`SEASON_DATA`,
50), Wissen-Aussaatkalender (`GARDEN_KNOWLEDGE.aussaatkalender`, 8 Blöcke
Freitext), `garden_tasks_catalog` (189 Zeilen live) und
`regional_garden_calendars` (7 Zeilen live) — **sechs** voneinander unabhängige
Listen sagen in dieser App, was man wann sät. Ein siebter Rechner für dieselbe
Frage wäre der Fehler; erst wenn sie auf `GS_SAE_DB` zusammengeführt sind,
gibt es dort etwas zu geben. Das ist eine eigene Scheibe (Daten, keine
Kalender-Logik).

## 7 · Lina

**Kontext** — die zwei Zeilen aus v33.14 werden EIN Kalender-Block aus der
einen Funktion, drei Zeilen:

- „Kalender heute: Basilikum giessen (seit 1 Tag); Tomate giessen; Balkon Süd
  · Erde: Bodenfeuchte unter 25 % → Giessen; +1 weitere." (alle Arten ausser
  Rückblick; ≤ 3, dann „+N weitere")
- „Nächste 7 Tage: 5 Aufgaben · 1 Aussaatfenster (Feldsalat) · Frost am 3.9.
  (Vorhersage) · 2 Hinweise." (R10)
- „Hinweise: Frost am 3.9. trifft Feldsalat säen (draussen); Regen übernimmt
  Tomate giessen (8 mm)." (nur verletzt, ≤ 3, „+N")

Jeder Eintrag ist der Titel eines Ereignisses — der bestehende
`sensor_check`-Fall prüft das gegen `gsKalenderEreignisse` und gilt weiter.
Ohne Pflanzen keine Zeile, nie ein erfundenes „keine".

**Deckel** — `GS_LINA_ZAHLEN_MAX` (950) schneidet heute hart vom Ende
(`txt.slice(0, 949)`; gemessen mit sechs Geräten: die Scan-Zeile fiel ganz
weg, ein Schnitt mitten in „14.09"). Neu `_gsLinaDeckeln(teile, max)`: ganze
Zeilen vom Ende weglassen und „(+N Zeilen ausgelassen)" anhängen. Reihenfolge
nach Nutzen: Fällig · Hinweise · Woche · Alarme · Kalender heute · Letzter
Scan · Messwerte — was fällt, ist das Längste und Entbehrlichste. Geräte,
Messgrössen und Alarme bekommen ihr „+N weitere" (L5); eine Regel
`nicht_pruefbar` ergibt nie „Alarme: keine verletzte Regel" (OEKOSYSTEM Regel 2).

**Tool** — `add_calendar_note {day, text, plantName?}`: im Dispatcher, nicht
im Prompt erzwungen (§4a.2). `gsConfirmModal` „Soll ich für 12.10. eintragen:
‚Rosen schneiden'?" (Vorauswahl Abbrechen, v32.37); bei Ja ein Eintrag in
`gs_gartentagebuch` {ts: day 12:00 Ortszeit, text, cat:'note', pflanze über
`_gsPflanzeFinden`, quelle:'lina'}; `gsTagebuchAlle` reicht `quelle` durch,
also steht es im Kalender als `erinnerung` (Zukunft) oder `tagebuch`
(Vergangenheit) mit Grund „von Lina vorgeschlagen, von dir bestätigt am
15.9.". Schreibversuch am Rückgabewert; `markDirty('plants')`. `open_calendar
{day}` bleibt; ein Filter-Argument gibt es nicht — Lina verstellt nichts an
der Wahl der Person. Die zwei bestehenden schreibenden Tools bekommen ihren
ersten Prüfstand-Fall (Nein schreibt nichts; Ja schreibt genau eines).

Was in v33.33 schon geschlossen ist: L3 (exakt, beide Listen), L6 (Phantom-
Weg), L7 (neueste 100), S1 (Scan-Zeit). Was Lina architektonisch NICHT kann
und deshalb nicht versprochen wird: Push schreiben, Routinen fahren (0
Edge-Functions kennen `coach_messages`; Lina existiert nur im Tab).

## 8 · Backend — was bleibt, was kommt

**Für die Rechnung nichts Neues.** Jede Eingabe der zehn Regeln liegt im
Browser (Pflanzen, Tagebuch, `gs_weather_cache`, `gs_ernte_log`,
`gs_push_settings`, `GS_SAE_DB`, `PLANT_DB`). Der Filterzustand reist im
vorhandenen `user_app_state`-Blob — keine Tabelle, keine Migration. Ein
Kalender, der nichts speichert, was sich aus Pflanzen und Tagebuch ergibt (V1
Regel 2), hat keinen zweiten Speicher, der auseinanderlaufen kann.

**Zwei Befunde der gegnerischen Prüfung (15.09.).** (a) **erledigt in v33.34:**
`gs_weather_cache` hatte ZWEI Schreiber in zwei FORMEN — der Wetter-Lader
schreibt `{ts, data, lat, lon}`, der Planer eine Karte `{"lat,lon": {ts, data}}`,
gelesen EINMAL beim Start und später ganz zurückgeschrieben. Nach einem
Planer-Wetterabruf lasen 5b, R1, R2 und `_gsKalDatenlage` keine `daily` mehr —
die Frost- und Regenzeilen verschwanden, ohne dass etwas meldet. Der Planer hat
jetzt `gs_weather_cache_planer` (in `GS_USER_KEYS`, dieselbe Klasse wie Hof- und
Gartenwetter). **Die Regel, die bleibt:** ein Schlüssel, dessen Inhalt eine FORM
hat, hat GENAU EINEN Schreiber — wer eine zweite Form braucht, braucht einen
zweiten Schlüssel. Prüfstand: `robust_check` „Wetter-Zwischenspeicher · ein
Schlüssel, ein Schreiber". (b) Es gibt einen FÜNFTEN Frost-Rechner:
`gsCheckFrostWarning` (`< 2`, aus `loadGardenWeather`, meldet an den Server) —
R7 führt ihn und lässt ihn `GS_WETTER_GRENZEN.frost` lesen.

**Und ein dritter Befund aus demselben Zug** (gemessen am 15.09., behoben):
der Planer-Kontext las die Ernte-Erfahrung als `h.name || h.crop || h.plant` —
KEIN Schreiber von `gs_ernte_log` kennt eines dieser Felder (alle drei
schreiben `pflanze`/`menge`). `ctx.harvests` war seit jeher leer, und der
Planer plante ohne die Fruchtfolge-Erfahrung, die der Prompt anfordert.
Dieselbe Klasse wie `_gsScanZeit` (v33.33): **der Leser ist die Regel, nicht
das Feld.**

**Was „Backend sauber" hier konkret heisst — zwei gemessene Lücken, beide
eigene Scheiben, beide Migrationen bleiben „nicht angewandt", bis Fernando sie
anwendet:**

1. **Der Server kennt nur eine Pflanzenliste.** `v_plant_tasks_due`
   (Migrationen v26_93 / 20260903 / 20260904) expandiert `user_plants.data`;
   `user_gardens` kommt in keiner der drei Dateien vor. Der Aufgaben-Cron
   (`daily-push-checker`) erinnert damit nie an eine Garten-Pflanzung — die App
   zählt beide Listen (`gsGetDueTasks`), der Server eine. Zwei Zahlen für
   „fällig". Scheibe: die Sicht liest zusätzlich `user_gardens.data ->
   'plantings'` mit derselben Rechnung; `naht_check`-Fall „App und Sicht zählen
   dieselben Aufgaben" (SQL im lokalen Postgres, wie `quiz_check`).
2. **Die saisonale Checkliste filtert ein Feld, das der Generator nicht
   schreibt.** `daily-push-checker` nimmt `garden_tasks_catalog` mit
   `.eq('priority','high')`; `knowledge-bulk-gen` schreibt `importance:
   kritisch|wichtig|optional`. Vor dem Bauen live (nur lesend) messen, ob
   `priority` je gefüllt ist — wenn nicht, trifft der Filter seit dem Bau nie.

Ein Server-Push „morgen Frost trifft deine Zucchini" (R6 als Push) bräuchte
Gärten und Pflanzungen serverseitig lesbar plus die Frost-Vorhersage je
Nutzer — eine spätere Scheibe über `_shared/push_helfer.mjs` mit
`BRIDGE_MARKER`, nicht Teil des Kalenders.

## 9 · Scheiben

| Scheibe | Version | Inhalt | Prüfstand |
|---|---|---|---|
| 0 | **v33.33 (geliefert)** | `_gsScanZeit` (S1), Timeline liest `SCAN_HISTORY_KEY` (S4), Seed-Ernte in App-Feldern (K5), Lina L3/L6/L7 | sensor_check 44, kalender_check 23 |
| 1 | v33.34 | **Das Prüfwerk**: `_gsKalPruefwerk`, Feld `hinweise`, Feld `fenster`; R1, R2 (herausgelöst als `_gsRegenUebernimmt`, `gsGetDueTasks` ruft ihn), R3 (`_gsKulturZuPflanze`), R4, R5, R8; Hinweiszeile, ⚠-Ecke, drei Leerzustände. Seed: `gs_weather_cache` RELATIV zur gestellten Uhr (ohne ihn sind R1/R2/R6/R7 im Seed stumm — gemessen `wetterCache:false`) | je Regel ein Fall mit gut · schlecht · nicht prüfbar aus dem HTML; „Monstera bekommt kein Erntedatum" mit Gegenprobe; „Regen: gsGetDueTasks und Kalender nennen dieselbe Zahl"; contrast_check misst die Hinweisfarbe |
| 2 | v33.35 | **Das Sieb**: `_gsKalFiltern`, `gs_kal_filter` (Listen, Blob hin/rück, markDirty, Rückgabewert), vier Chips mit Zahl, Garten-Auswahl, „N von M" in Kopf und Fuss; Legende weg, `.gs-kal-p-aussaat`, Wochentage aus `gsWochentage`; alle Texte über `_t`/`_gsSatz`, Arten-/Gruppenliste als Datenliste in `i18n_check` | Vorgabe blendet messung+scan aus und sagt es; Filter aus === ungefiltert; Hin/Rückweg (sync_check); storage_check; a11y_check (aria-pressed); touch_check 320 px |
| 3 | **v33.36 (geliefert)** | **Ein Wetter**: `GS_WETTER_GRENZEN`; Hitze/Starkregen/Sturm als `wetter`-Info aus dem Cache (R7); R6; `gsOpenWeatherWarn` liest denselben Cache und `gs_user_location`, sagt „keine Vorhersage" statt „alles im grünen Bereich" | vier Schwellen knapp darunter/darüber; Cache leer → beide Anzeigen ehrlich; Zucchini (−1, Balkon) trifft Frost, Salat (1) nicht, Basilikum (−1, Küchenfenster) nicht |
| 4 | v33.37 | **Die drei Namen**: Art `scan`; echte Ernte als `ernte` quelle hand (K4); Merkliste als zweite Aussaat-Quelle; Naturjahr aus dem Kalender (K1, K3; K2 benannt); Timeline aufgehoben, `mi-timeline` + `MENU_ITEMS` → Kalender mit Rückblick | Kachel === Ereigniszahl; Scan von 2019 zählt nicht für 2025; Merkliste „Feldsalat" ohne eigene Pflanze → Fenster mit Grund; Log-Zeile → ernte(hand); Menüeintrag öffnet den Kalender (wiring_check Richtung 4) |
| 5 | v33.38 | **Lina**: Kalender-Block (heute · Woche · Hinweise), `_gsLinaDeckeln` an Zeilengrenze, „+N" bei Geräten/Grössen/Alarmen, `nicht_pruefbar` ≠ „keine verletzte Regel", `add_calendar_note` mit Rückfrage und quelle lina | jede Zeile ein Ereignis; sechs Geräte → ganze Zeile weg, kein halber Wert; Tool mit Nein schreibt nichts, mit Ja steht die Erinnerung im Kalender; die zwei alten Schreib-Tools bekommen ihren Fall |
| 6 | v33.39 | **Die Woche**: R9, R10; „Diese Woche"-Zeile Startseite + Fuss; `gsWochenrueckblick` liest den Kalender | Zeile zählt eintragsgenau; ohne Cache „keine Vorhersage"; Rückblick „N erledigt" === tagebuch(regel) der 7 Tage; pauseUntil abgelaufen/unlesbar → kein erfundener Zeitraum |
| 7 | v33.40 | **Backend**: `v_plant_tasks_due` kennt Pflanzungen (Migration, nicht angewandt); `priority`/`importance` live gemessen und bereinigt | naht_check „App und Sicht zählen dieselben Aufgaben" im lokalen Postgres |

## 10 · Was bewusst NICHT gebaut wird

- Keine Kalender-Tabelle, kein zweiter Speicher (V1 Regel 2).
- Keine Termin-Eingabe im Fenster; ein Termin ist ein datierter Tagebuch-Eintrag.
- Keine Mondregeln, keine Höhenlage, keine Gartenlore als Rechnung.
- Keine KI-generierten Termine ohne Rückfrage; kein Tool, das löscht (die
  einzige löschende Funktion ohne Rückfrage, `gsTagebuchDelete`, hat 0
  UI-Aufrufer und wird nie Tool).
- Kein Filter in der Rechnung, kein Deckel in der Quelle (Zuschnitt in der
  Anzeige ist umkehrbar, einer in der Quelle nicht — v32.30).
- Kein siebter Aussaat-Datenbestand; die sechs werden in einer Daten-Scheibe
  zusammengeführt, nicht vom Kalender überbrückt.

## 11 · Prüfstand-Regeln, die hier besonders gelten

- Die Uhr ist gestellt (2025-09-01): jede Frist zählt Versuche, nie `Date.now()`.
- Der Wetter-Cache im Seed liegt RELATIV zur Uhr (`ts = Date.now()` im Fall),
  sonst steht „Stand vor 8'000 h" im Grund und `ftag < heute` verschluckt den Frost.
- Jede Regel: gut, schlecht, nicht prüfbar — und die Gegenprobe „Regel
  ausgebaut → rot" mit der echten Zahl; nachsehen, ob der Ausbau griff.
- Zahlen aus dem gerenderten HTML, nie aus dem Objekt.
- `_seed.js` muss einen verletzten Hinweis herstellen, sonst vermisst
  `contrast_check` die Hinweiszeile nie (ein Prüfstand misst, was er erreicht).
