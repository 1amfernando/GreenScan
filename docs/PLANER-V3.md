# KI-Planer V3 — Entwurf

> Stand 02.09.2026 · geschrieben zu v31.74 · Umsetzung beginnt mit v31.75
> Gehört zu `CLAUDE.md` §4a (die zwei Fallen) und `STATUS.md`.

## 0 · Warum das hier steht

Fernando: *„Der KI-Planer wurde nicht richtig geupgradet."* — Das stimmt, und
es lohnt sich, genau zu sagen warum, sonst passiert derselbe Fehler nochmal.

Was v31.73 unter dem Namen „Planer V3" geliefert hat, war die **Umsetz-Liste**:
der fertige Plan wird zur abhakbaren Checkliste und schreibt echte Pflanzungen
in den Garten. Das ist nützlich und bleibt. Aber es ist ein **Transportweg für
das Ergebnis** — der Planer selbst wurde dadurch um keinen Deut klüger. Genauso
v31.58–v31.65: Zwilling-Kontext, Lichtprüfung, Nachbarschaftsprüfung, ehrlicher
Fortschritt. Alles Verbesserungen **am Rand** des Plans.

Der Plan in der Mitte ist seit v24 derselbe:

> Ein Rechteck, einmal befüllt, für eine Saison.

Und genau da liegt der Denkfehler.

## 1 · Der Kern-Umbau: von der Fläche zum Jahr

Ein Beet im Schweizer Mittelland ist rund **neun Monate** nutzbar. Der heutige
Plan legt jede Pflanze auf ein Rechteck und lässt sie dort bis zum Winter
liegen. Real bewirtschaftet man denselben Quadratmeter dreimal:

```
   Mär   Apr   Mai   Jun   Jul   Aug   Sep   Okt   Nov
   ┌───────────┐
   │ Radieschen│
   └───────────┘
               ┌───────────────────────────┐
               │ Buschbohne                │
               └───────────────────────────┘
                                           ┌───────────────┐
                                           │ Feldsalat     │
                                           └───────────────┘
```

Dasselbe Rechteck, dreifacher Ertrag, kein Quadratmeter mehr. Das ist der
grösste einzelne Hebel, den der Planer hat — und er ist heute **nicht
vorhanden**. Nicht schlecht umgesetzt: nicht vorhanden. Es gibt im ganzen
Schema kein Feld, in dem stünde, dass ein Platz zweimal im Jahr belegt wird.

### 1.1 · Datenmodell

`plants[]` bleibt — jede bestehende Ansicht (3D, SVG, PDF, Umsetz-Liste, alle
Prüfungen) hängt daran, und ein Bruch dort wäre teuer und ohne Gegenwert.
Dazu kommt **additiv**:

```js
plan.slots = [
  { id: 's1', x_m, y_m, w_m, h_m, label: 'Beet Nord, Reihe 1',
    belegung: [
      { crop:'Radieschen', latin:'Raphanus sativus', rolle:'vor',
        von:'2026-03-15', bis:'2026-05-05', family:'Kreuzblütler', yield_kg:0.9 },
      { crop:'Buschbohne',  latin:'Phaseolus vulgaris', rolle:'haupt',
        von:'2026-05-10', bis:'2026-09-01', family:'Hülsenfrüchtler', yield_kg:2.4 },
      { crop:'Feldsalat',   latin:'Valerianella locusta', rolle:'nach',
        von:'2026-09-05', bis:'2026-11-20', family:'Baldriangewächse', yield_kg:0.6 }
    ] }
]
```

`plants[]` ist dann die **abgeleitete Sicht**: pro Slot die Belegung mit
`rolle:'haupt'`. Alles Bestehende läuft weiter, ohne eine Zeile zu ändern.

### 1.2 · Die Ansicht: ein Jahresband

Ein neuer Reiter **„Jahr"** neben Überblick · Umsetzen · Pflanzen · Zeitplan ·
Pflege · 3D. Zwölf Monatsspalten, eine Zeile je Slot, farbige Balken je
Belegung. Man sieht in einer Sekunde, was heute niemand sieht:

- **Wo das Beet leer steht.** Eine graue Lücke von September bis November ist
  ein Vorwurf, den man sofort versteht.
- **Ob die Ernte verteilt ist.** Drei Balken, die alle im August enden, sind
  eine Zucchini-Schwemme.
- **Wann Arbeit anfällt.** Jeder Balkenanfang ist eine Aussaat.

### 1.3 · Die Lückenfüller — und warum sie ohne KI auskommen

Der wichtigste Teil rechnet **lokal**, ohne einen einzigen Netzaufruf:

1. Aus `sow_date` / `harvest_from` / `harvest_to` jeder Pflanze das Band bauen.
2. Pro Slot die freien Zeitfenster suchen (≥ 6 Wochen).
3. In `garden_crop_agronomy` (schon geladen, §`gsPPloadAgronomy`) alle Kulturen
   suchen, deren `sow_months` im Fenster liegt und deren Standdauer hineinpasst.
4. Familien-Konflikt ausschliessen (keine Kreuzblütler nach Kreuzblütlern).
5. Vorschlagen — mit Herkunftsangabe: *„aus der geprüften Agronomie-Tabelle"*.

Das ist keine erfundene Empfehlung, sondern eine Auswahl aus geprüften Daten.
Genau die Sorte Aussage, die diese App treffen darf.

## 2 · Das Prüfwerk — die zweite Hälfte

Heute prüft der Planer vier Dinge (Bestand · Licht · Nachbarn · Platz). Die
Prüfung ist gut gebaut, mit drei Zuständen und ehrlichem „nicht geprüft" — aber
sie ist **zu kurz**. Die KI erfindet weiterhin ungestraft:

| Was die KI behauptet | Was heute prüft | Was prüfen könnte |
|---|---|---|
| „Tomate aussäen: 12.03." (Freiland!) | niemand | `sow_months` der Agronomie-Tabelle |
| „12 Kohlrabi, Abstand 30 cm, auf 0,4 m²" | niemand | 12 × 0,30² = 1,08 m² ≫ 0,4 |
| „Ernte 14,2 kg, Wert 89 CHF" | niemand | Preistabelle × geprüfte kg |
| „Wasser 60 l/Woche" | niemand | gegen gemessenen Niederschlag |
| „Ernte Juli–August" | niemand | Verteilung über die Monate |
| „Pflege: wöchentlich giessen, mulchen, …" | niemand | Minuten pro Woche über das Jahr |
| „Saatgut: Ochsenherz-Tomate" | niemand | dein `gs_seed_inventory` |

Jede dieser Zeilen ist **rechenbar**. Keine braucht Netz zur KI. Das ist die
Lehre aus `CLAUDE.md` §4a.2, konsequent zu Ende gedacht: *was der Prompt
verlangt, prüft von hier aus niemand.*

Die Regeln, nummeriert, jede mit drei Zuständen (**erfüllt · verletzt · nicht
prüfbar**):

- **R1 Aussaatfenster** — `sow_date` gegen `sow_months`. Nur für Kulturen, die
  in der Tabelle stehen; sonst „nicht prüfbar".
- **R2 Standdauer** — `harvest_from − sow_date` plausibel? Radieschen in 4
  Wochen ist richtig, Kürbis in 4 Wochen ist falsch.
- **R3 Platzrechnung** — `count × (spacing_cm/100)² ≤ w_m × h_m`. Meldet
  Überbelegung mit der konkreten Zahl, nicht mit einem Gefühl.
- **R4 Saatgut** — Abgleich gegen `gs_seed_inventory`: was du hast (mit
  Ablaufdatum!), was du kaufen musst. Ein Plan, der zwölf Tütchen in deiner
  Schublade ignoriert, ist kein Plan für **deinen** Garten.
- **R5 Fruchtfolge gegen echte Historie** — heute geht nur eine Namensliste in
  den Prompt. Rechnen lässt sich mehr: `gs_plantings` + `gs_ernte_log` je
  Garten → welche Familie stand dort zuletzt, und wie lange ist das her.
- **R6 Wasserbilanz** — Summe `water_l_per_week` gegen den gemessenen
  Niederschlag der letzten 14 Tage (Open-Meteo liegt schon vor). Ergebnis:
  *„dein Plan braucht 42 l/Woche, der Regen liefert 18 — 24 l bleiben an dir."*
- **R7 Frost** — `sow_date` gegen Eisheilige / Frostgrenze der Klimazone.
- **R8 Licht** (v31.62, bleibt) · **R9 Nachbarn** (v31.63, bleibt) — neu:
  Nachbarschaft auch **zeitlich**, zwei Gegenspieler dürfen auch nicht
  nacheinander auf denselben Slot.
- **R10 Arbeitslast** — aus `careSchedule` + `timeline` Minuten pro Woche über
  das Jahr, als Kurve. Ein Plan, der im Juni 6 h/Woche fordert, ist für einen
  Anfänger keiner — und heute steht davon nirgends etwas.
- **R11 Ernte-Verteilung** — kg je Monat. Zeigt Lücken und Schwemmen.
- **R12 Deckung** — Summe(w·h) gegen die Fläche (heute implizit im Prompt).

**Und der zweite Teil, der wichtiger ist als die Liste:** wo der Planer
reparieren kann, repariert er — und **sagt, was er repariert hat**. Genau wie
der Platzierer in v31.62/63, der verschiebt statt zu meckern. Nur wo keine
Reparatur möglich ist, wird gemeldet.

## 3 · Zehn Neuerungen

### N1 · Belegungsplan statt Bepflanzungsplan
Siehe §1. Der Kern. Ohne den bleibt alles andere Kosmetik.

### N2 · Das Prüfwerk
Siehe §2. Zwölf rechnende Regeln statt vier.

### N3 · Drei Entwürfe, ein Vergleich
Statt *dem* Plan: drei mit unterschiedlicher Zielfunktion —
**Ertrag** · **Pflegeleicht** · **Vielfalt & Bienen** — nebeneinander auf
**gemessenen** Achsen: kg, Arbeitsminuten je Woche (Median und Spitze),
Artenzahl, Anteil vorhandenes Saatgut, Zusatzwasser. Der Mensch wählt.

Das ist ehrlicher als „hier ist DER Plan", und es kostet drei Aufrufe — deshalb
**opt-in** („Varianten vergleichen"), im Kompakt-Modus ein Aufruf mit drei
kurzen Varianten.

### N4 · Der Plan altert und meldet sich
Ein gespeicherter Plan bekommt beim Öffnen eine **Nachprüfung, ohne KI**:
Plan gegen Wirklichkeit. Was ist laut `gs_plantings` wirklich gepflanzt? Welcher
Termin ist verstrichen? Was hat das Wetter seither gemacht?

> *3 von 8 Schritten erledigt · Aussaat Karotten war vor 9 Tagen fällig ·
> seit dem Plan 4 mm Regen — giessen.*

Ein Plan, der sich nie wieder meldet, ist ein PDF. Ein Plan, der weiss, wie weit
du bist, ist ein Werkzeug.

### N5 · Mehrere Beete statt ein Rechteck
Der Zwilling liefert `beds[]` mit Koordinaten. Der Planer plant trotzdem immer
**ein** Rechteck. V3: Beete auswählen, Plan verteilt über alle, und die
Fruchtfolge rotiert **zwischen** den Beeten über Jahre. Das ist der eigentliche
Grund, warum es den Zwilling gibt.

### N6 · Eine Rückfrage statt einer Vermutung
„Viel Ernte, wenig Arbeit" ist ein Zielkonflikt. „Für Kinder" ist unterbestimmt
(essbar? ungiftig? robust?). V3 stellt **eine** Rückfrage mit konkreten
Optionen — wie der Doktor-Fragebogen aus v31.70 — statt still eine Annahme zu
treffen, die der Mensch nie sieht.

### N7 · Zahlen, die man belegen kann
`est_value_chf` ist heute frei erfunden. V3: eine kleine, versionierte
Preistabelle im Repo (CH-Detailhandel-Richtwerte, ausdrücklich als Schätzung
gekennzeichnet) × **geprüfte** kg, minus Saatgutkosten aus R4. Netto statt
Brutto, und mit Quellenangabe an der Zahl.

### N8 · Der Plan wird zum Kalender
`notifications[]` steht seit v24 im Schema und wird nirgends zu einem Termin.
Der Belegungsplan erzeugt echte Termine — Aussaat, Pikieren, Auspflanzen,
Ernte-Fenster, Nachsaat — die im Garten auftauchen; N4 hält sie aktuell.

### N9 · Jede Pflanze sagt, warum sie dort steht
Eine Zeile je Karte, **aus den Regeln, nicht aus dem Prompt**:

> *Hier, weil: Vollsonne (gemessen 48 000 lx) · guter Nachbar zu Basilikum ·
> Familie stand hier zuletzt 2023 · Saatgut vorhanden (läuft 03/2027 ab)*

Erklärbarkeit ist kein Beiwerk. Ein Plan, dessen Begründungen man nachlesen
kann, ist ein Plan, dem man widersprechen kann.

### N10 · Ein Plan, der funktioniert hat, wird zur Vorlage
Mit Jahresversatz und automatischer Fruchtfolge-Rotation der Familien. Gärtnern
ist eine mehrjährige Tätigkeit; der Planer behandelt sie bisher als
Einmal-Ereignis.

## 4 · Die Trennlinie: was rechnet, was rät

Das ist die wichtigste Regel des ganzen Entwurfs, und sie ist die Antwort auf
`CLAUDE.md` §4a.2.

| rechnet (Code, prüfbar, offline) | rät (KI, Prompt) |
|---|---|
| Aussaatfenster, Standdauer, Frost | Sortenwahl und Begründung |
| Platzbedarf, Deckung, Kollisionen | Gestaltung, Ästhetik, Reihenfolge |
| Licht- und Nachbarschaftsabstände | Tipps, Fallstricke, Pflegetexte |
| Wasserbilanz, Arbeitslast, Ernteverteilung | Sortenspezifische Hinweise |
| Saatgut-Abgleich, Fruchtfolge-Historie | Klimazonen-Einschätzung |
| Preis/Wert aus Tabelle | — |

**Alles in der linken Spalte darf die KI vorschlagen, aber nie allein
entscheiden.** Wo Rechnung und Prompt sich widersprechen, gewinnt die Rechnung
— und die Anzeige sagt, dass korrigiert wurde.

## 5 · Stufenplan

| Stufe | Inhalt | Prüfbar von hier? |
|---|---|---|
| **1** (v31.75) | N1 Belegungsplan + Jahr-Reiter + Lückenfüller · R1/R3/R4/R6/R11 | **ja**, vollständig — rechnet lokal |
| **2** ✅ | N4 Nachprüfung · R7 Frost · R10 Aufwand (v31.76) · N9 Begründungen · R2 Standdauer · R5 Fruchtfolge (v31.77) | ja |
| **3** | N5 Beete aus dem Zwilling (v31.88) · Mehrbeet-Verteilung durch die KI · R9 zeitlich | ja |
| **4** | N3 Varianten-Vergleich · N6 Rückfrage | teilweise (braucht KI-Antworten) |
| **5** | N8 Kalender-Termine · N10 Jahresvorlage · N7 Preistabelle | ja |

Reihenfolge ist bewusst so: **zuerst alles, was ohne Netz zur KI beweisbar
ist.** Was nur im Prompt steht, kann von dieser Umgebung aus niemand prüfen
(§4a.2) — das kommt zuletzt und mit einer rechnenden Prüfung daneben.

## 6 · Was in v31.75 gebaut ist

Stufe 1, vollständig:

- `_gsPlanBelegung(plan)` — baut aus `sow_date`/`harvest_from`/`harvest_to` das
  Jahresband je Slot, erkennt Überlappungen und freie Fenster.
- `_gsPlanLuecken(plan)` — schlägt Nachkulturen aus `garden_crop_agronomy` vor,
  mit Familien-Ausschluss.
- `_gsPlanAussaatfenster` (R1) · `_gsPlanPlatzrechnung` (R3) ·
  `_gsPlanSaatgut` (R4) · `_gsPlanWasser` (R6) · `_gsPlanErnteMonate` (R11).
- Reiter **„Jahr"** mit Monatsband, Lücken und Vorschlägen.
- Die fünf neuen Regeln als Zeilen in der bestehenden Plan-Prüfungstafel — mit
  demselben Dreizustandsschema, kein zweiter Kasten.

Alles davon rechnet lokal und ist mit `scripts/render_check.js` und einem
eigenen Durchlauf nachvollziehbar.


## 7 · Was in v31.76 dazukam (Stufe 2, erster Teil)

- **N4 · Der Plan altert und meldet sich.** `_gsPlanNachpruefung` + `gsPPnachBlock`:
  beim Öffnen eines gespeicherten Plans steht oben, wie alt er ist, wie viel
  umgesetzt wurde und welcher Aussaattermin **seit dem Speichern** fällig war.
  Termine, die schon beim Speichern vorbei waren, werden getrennt gemeldet —
  „vor 150 Tagen fällig" an einem 19 Tage alten Plan wäre falsch erzählt.
  Kein KI-Aufruf.
- **R7 · Frost**, mit dem nötigen Unterschied: frostempfindlich + vor den
  Eisheiligen ist nur dann ein Fehler, wenn das Datum **ausserhalb** des
  Vorkultur-Fensters der Referenz liegt. Dieselbe Pflanze im März auf der
  Fensterbank ist richtig. Zwei Zustände statt einem.
- **R10 · Aufwand über das Jahr.** Aus `careSchedule.freq` + `months` eine Kurve
  der **Handgriffe je Woche**, plus die einmalige Aufbauzeit aus
  `stepByStep.duration_min`. Bewusst keine Minuten für die Pflege: eine Dauer
  steht dort nicht drin, und sie zu erfinden wäre genau das, was dieses
  Prüfwerk verhindern soll.
- **Beim Öffnen eines gespeicherten Plans läuft das Prüfwerk neu.** Zwei
  Gründe: es rechnet mit dem heutigen Saatgut-Inventar und dem heutigen
  Regen — und `_jahr` überlebt die JSON-Runde nicht als Datum.
- **`gsPPsavePlan` hatte den §3.5-Fehler.** Der Speicher-voll-Zweig lag in
  einem `catch`, das nie feuert; `localSaved = true` wurde auch bei
  gescheitertem Schreiben gesetzt. Jetzt Rückgabewert prüfen, stufenweise
  kürzen (10 → 5 → 2 → 1), der neue Plan hat Vorrang, und was weichen musste,
  wird gesagt. **Beide Zweige ausgelöst**, nicht behauptet.

## 8 · Was in v31.77 dazukam (Stufe 2 abgeschlossen)

- **N9 · Jede Pflanze sagt, warum sie dort steht.** `_gsPlanBegruendung` sammelt
  ein, was die anderen Regeln markiert haben, und rendert es als Marken unter
  jeder Pflanze. Aus der Rechnung, nicht aus dem Prompt.
- **R2 · Standdauer** — nur die schädliche Richtung (zu schnell), 40 % Toleranz
  gegen die schnellste belegte Spanne der Referenz.
- **R5 · Fruchtfolge gegen die echte Historie** — `gs_plantings` und
  `gs_ernte_log` tragen Datum und Beet → Vorwurf. `myPlants` sagt WAS du hast,
  nicht WO → nur ein Hinweis. Ohne diese Trennung bekäme jeder mit dreissig
  Pflanzen den halben Plan angestrichen.
- **`contrast_check.js` misst jetzt im Planer-Fenster** (Musterplan in
  `scripts/_seed.js`, ungefaltet, durchgescrollt). Erster Lauf: 24 Stellen
  hell, 19 dunkel — alle behoben, jetzt 0/0.

## 9 · Was in v31.88 dazukam (Stufe 3, erster Teil)

**Der Platzierer respektiert die Beete des Zwillings.** Er kannte bisher nur
EIN Rechteck — die ganze Fläche — und konnte eine Pflanze mitten auf den Weg
legen.

- `_inBeet(x,y,w,h)` prüft, ob ein Rechteck **ganz** in einem Beet liegt.
  Teilweise reicht nicht: eine Pflanze halb auf dem Weg steht auf dem Weg.
- Die Beete gelten nur, wenn die geplante Fläche **die gescannte ist**
  (Toleranz 26 cm) — dieselbe Bedingung wie bei den Lichtzonen.
- Als **Vorliebe**, nie als Sperre. Die Kette hat jetzt acht Stufen; das Beet
  wird **zuletzt** aufgegeben: eine Pflanze im falschen Licht wächst schlecht,
  eine auf dem Weg wächst gar nicht.
- `plan._beete = {beete, drin, daneben}` — was am Ende wirklich im Beet liegt,
  gerechnet und in der Plan-Prüfung genannt.

Drei Fälle nachgestellt: mit Beeten (alle vier Pflanzen hinein, Weg frei) ·
ohne Beete (unverändert, keine erfundene Einschränkung) · Beete zu klein
(alle gesetzt, drei namentlich als „ausserhalb" gemeldet, **keine
weggelassen**).

### Weiter offen für Stufe 3

Mehrbeet-**Verteilung** durch die KI (ein Plan, der Beete benennt) ·
R9 zeitliche Nachbarschaft.
