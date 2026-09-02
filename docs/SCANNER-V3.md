# Scanner V3 — Entwurf

> Auftrag (Fernando, 02.09.2026): *„Bringe ihn auf ein Highend-Level. Bessere und
> zuverlässigere Scans sowie Resultate … besser als Google Lens. Zusätzlich will
> ich, dass während der Diagnose das Foto gezeigt wird und wie die Blume
> analysiert sowie diagnostiziert wird."*

## 1 · Der Check — was der Scanner heute schon kann

Gemessen am Code, nicht vermutet (`analyzeImage`, `SCAN_SYSTEM_PROMPT`,
`callVisionAI`, `showScanResult`):

| Vorhanden | seit |
|---|---|
| Vision-Aufruf mit gecachtem System-Prompt, JSON-Antwortformat | v28.04 |
| **Multi-Shot** — mehrere Fotos derselben Art werden kombiniert | v30.74 |
| **Bildqualität vor dem Aufruf** (Schärfe, Licht), mit „trotzdem" | v31.79 |
| **Scan-Cache** über dHash — identisches Foto kostet kein Kontingent | v28.04 |
| Kontext: GPS, Kanton, Höhe, Monat, Saison, letzte 30 Scans | v23.x |
| **Ehrlicher Fortschritt** — nur Schritte, die stattfinden | v31.79 |
| Eine Konfidenz-Skala (`gsNormConfidence`) | v31.79 |
| **Giftigkeit der Alternativen** aus Modell ∪ Artenliste | v31.92 |
| Ruhige Karten für offline / Kontingent / fehlenden Schlüssel | v30.24/28.05 |

Das ist eine gute Grundlage. Der Scanner ist **nicht** naiv gebaut.

## 2 · Wo er trotzdem verliert — und wo Google Lens nicht hinkommt

Lens' Stärke ist die visuelle Ähnlichkeitssuche über Milliarden Bilder. **Darin
ist GreenScan nicht zu gewinnen**, und es hat keinen Zweck, so zu tun.

Lens' Schwäche ist genau das, was hier zählt:

1. Lens kennt **Ort und Jahreszeit nicht als Einschränkung**. GreenScan hat GPS,
   Kanton, Höhenlage und Monat — und nutzt sie bisher nur als Prompt-Text.
2. Lens sagt nie: **„das kann man tödlich verwechseln."**
3. Lens prüft seine eigene Antwort **gegen nichts**.
4. Lens weiss nichts über den Nutzer — was in seinem Garten steht, was er
   letzte Woche gefunden hat.

**Daraus folgt die Linie des Entwurfs, und sie ist dieselbe wie beim Planer:**

> Die Überlegenheit liegt nicht im Sehen, sondern im **Prüfen**.
> Was der Code nachrechnen kann, glaubt er der KI nicht auf ihr Wort.

Heute wird die Antwort der KI **an keiner Stelle nachgerechnet** — ausser bei
der Giftigkeit der Alternativen (v31.92). Der Haupttreffer geht ungeprüft durch.

## 3 · Die Stufen

### Stufe 1 — Das Scan-Prüfwerk + der Blick aufs Foto (v31.99)

**Rechnen statt glauben.** Nach jeder Antwort läuft eine Prüfung gegen die
eigenen 4'342 Arten und den Kontext:

| Regel | Frage | Quelle |
|---|---|---|
| S1 · Art bekannt | Gibt es den lateinischen Namen in unserer Artenliste? | `DB` |
| S2 · Sicherheit | Widerspricht die Giftangabe der Artenliste? | `DB.tox` |
| S3 · Jahreszeit | Passt der Aufnahmemonat zur Saison der Art? | `season` |
| S4 · Verbreitung | Ist die Art für die Schweiz vermerkt? | `DB` |
| S5 · Abstand | Wie weit liegt der Zweitbeste zurück? | Antwort |
| S6 · Grundlage | Schärfe, Licht, Zahl der Fotos | gemessen |

Drei Zustände je Regel — erfüllt · widersprochen · nicht prüfbar (mit Grund),
wie im Planer. **Bei Widerspruch in der Sicherheit gewinnt immer die
vorsichtigere Angabe.**

**Und der Blick aufs Foto.** Während des Aufrufs bleibt das eigene Foto stehen,
mit einem wandernden Lichtstreifen darüber. Danach erscheinen die **echten**
`diagnostic_features` nacheinander daneben.

> ⚠️ **Die Regel, die dabei gilt und die v31.79 teuer gelernt hat:** der
> Streifen ist Zierde und darf es sein — die **Texte** dürfen nichts behaupten,
> was nicht geschieht. Vor v31.79 liefen fünf erfundene Meldungen („Merkmale
> werden gelesen", „Vergleich mit der Arten-Bibliothek") über einen einzigen
> Netzaufruf. Das kommt nicht zurück. Merkmale erscheinen **erst, wenn sie
> wirklich da sind** — und dann sind es die gemessenen.

### Stufe 2 — EXIF (v32.00, ausgeliefert)

**Das Foto weiss besser, wann und wo es entstand.** `gsBuildScanContext` nahm
immer den heutigen Monat und den aktuellen Standort — für ein Galeriefoto oft
falsch, und doppelt teuer: die KI rechnete mit der falschen Jahreszeit *und*
Regel S3 meldete anschliessend einen Widerspruch, den es gar nicht gab.

- `_gsExifLesen` / `gsExifVonDatei` lesen `DateTimeOriginal` und die GPS-Tags,
  **vor** dem Komprimieren (Canvas verwirft EXIF).
- Datum in der Zukunft oder vor 1990 → kaputte Uhr, verworfen; GPS bleibt.
- Auftragstext und Karte **nennen die Herkunft** — keine stille Korrektur.
- Kein EXIF → heutiger Tag, ohne Behauptung.

**Zwei Lehren aus dem Bau:**

1. **Ein Binär-Parser, der nie gegen echte Bytes gelaufen ist, ist eine
   Behauptung.** `scripts/_exifjpeg.js` baut ein echtes JPEG mit APP1,
   TIFF-Kopf, Exif-IFD und GPS-IFD.
2. **`gsSaisonMonate` liefert NULLBASIERTE Monate** (`[7,8,9]` = Aug/Sep/Okt).
   S3 verglich einen einsbasierten — jede Saison-Aussage war still um einen
   Monat verschoben. Gefunden nur, weil der EXIF-Fall Juli gegen September
   stellte.

### Offen für Stufe 2

- Mehrere Fotos automatisch anbieten, wenn die Prüfung dünn ausfällt.

### Stufe 3 — Gegenprobe (v32.10, ausgeliefert)

Wenn die Art als **essbar** gilt UND eine Alternative Giftstufe ≥ 3 hat: ein
zweiter, unabhängiger Aufruf mit **umgekehrtem Auftrag**. Der erste soll
bestimmen, der zweite soll **widerlegen** — ein Modell, das seine eigene
Antwort bestätigen soll, bestätigt sie fast immer.

Der zweite Aufruf bekommt die erste Bestimmung als **Behauptung** vorgesetzt
(Art, Sicherheit, genannte Alternativen, angeführte Merkmale) und antwortet in
festem Format: `urteil` · `dagegen[]` · `dafuer[]` · `fehlend` ·
`bessere_erklaerung` · `verzehr`.

**Nur auf Knopfdruck** — sie kostet ein weiteres Kontingent des Nutzers, und
der Knopf nennt den Preis. Drei Ausgänge, und beim vierten (Aufruf
gescheitert) bleibt die Unsicherheit ausdrücklich stehen.

> **Die Formulierung, auf die es ankommt:** Einigkeit wird *nie* als Beweis
> verkauft. „Zwei unabhängige Blicke, dasselbe Ergebnis — ein Beweis ist es
> nicht." Ein eigener Prüffall hält genau diesen Satz fest.

## 4 · Was bewusst NICHT gebaut wird

- **Keine eigene Bilderkennung.** Ohne Trainingsdaten wäre das geraten.
- **Keine erfundene Genauigkeit.** Wenn die Prüfung nichts sagen kann, sagt sie
  das — sie erfindet keinen Haken.
- **Keine Merkmale, die nicht aus der Antwort stammen.** Ein Marker auf dem Foto,
  den niemand berechnet hat, zeigt überzeugend auf die falsche Stelle (dieselbe
  Falle wie beim Garten-Zwilling, CLAUDE.md §4a.1).


## Nachtrag v32.08 — das Gitter, die Liste und der Weg zurück

**Das Scangitter wird gerechnet.** `_gsScanKanten(img)` legt das Foto auf ein
160-px-Canvas, macht Graustufen und fährt einen Sobel-Kantenfilter darüber. Die
Punkte über einer **relativen** Schwelle (28 % des stärksten Werts im Bild —
ein flaues Foto soll trotzdem ein Gitter bekommen) werden als 0–1-Koordinaten
gespeichert und auf 4'000 gedünnt. `_gsScanAnimation` zeichnet sie: der Balken
wandert, und was er passiert hat, leuchtet auf und verglimmt.

Gemessen: 1'427 Punkte auf einem gezeichneten Blatt, **0 auf einer leeren
Fläche**. Wo keine Pflanze ist, erscheint kein Gitter.

**Die Schrittliste.** Fünf Schritte, jeder mit seinem gemessenen Ergebnis
(siehe STATUS.md cu). Die Regel dabei ist dieselbe wie im ganzen Dokument:

> Ein Schritt darf nur angezeigt werden, wenn er stattfindet, und sein
> Ergebnis nur, wenn es gemessen ist.

Der KI-Aufruf ist der einzige lange, und über ihn wird weiterhin nur gesagt,
was stimmt: er läuft, seit N Sekunden.

**Und der Weg zurück** aus dem Ergebnis — eine `sticky`-Leiste zuoberst. Nur
dort, nicht während der Analyse.


### Stufe 4 — Der Scanner sieht selbst hin (v32.12, ausgeliefert)

Bis v32.11 lief zwischen Foto und Antwort nichts als ein Cache-Blick. Die
Wartezeit war ehrlich, aber leer — und das war eine verpasste Gelegenheit:
die App hat 4'342 kuratierte Arten und ein Foto, aus dem sich etwas
ausrechnen lässt.

**Zwei Vorgänge, beide gerechnet, beide vor der Antwort:**

| | | |
|---|---|---|
| `gsBildFarben(quelle)` | HSV-Klassierung auf 96×72 px | „Grün 75 % · Gelb 25 %" |
| `gsScanVorauswahl(ctx, farben)` | Monat · Farbe · Höhenlage über die ganze Liste | „4'342 → 2'087" |

Die Farbklassierung arbeitet in HSV, weil Blüten unter Schweizer Licht in RGB
wandern: dieselbe gelbe Blüte ist im Schatten `#8a7a10` und in der Sonne
`#ffe94a` — der Farbton bleibt beide Male bei ~52°. Dunkles Orange (`v < 0,55`)
wird als **Braun** geführt; ohne diese eine Zeile wäre jeder Waldboden und
jede Rinde eine gelbe Blüte.

**Die eine Entscheidung, an der alles hängt: das Ergebnis geht NICHT in den
Prompt.**

Es wäre leicht gewesen, „Farbanteile: Gelb 25 %" und „diese 2'087 Arten
kommen in Frage" in den Auftrag zu schreiben — das klingt nach besserer
Genauigkeit. Es ist das Gegenteil. Ein Modell, dem man die eigene Vorauswahl
zeigt, bestätigt sie; die spätere Gegenprüfung wäre dann ein Echo und keine
Prüfung. Der ganze Wert liegt in der Unabhängigkeit: was danach
übereinstimmt, stimmt aus **zwei getrennten Richtungen** überein.

`scan_check` hält das fest — der Fall *„Unabhängigkeit · Farben und
Vorauswahl gehen NICHT in den Auftrag"* liest den echten Prompt aus einem
vollen `analyzeImage`-Durchlauf und prüft zugleich, dass beide Schritte
trotzdem gelaufen sind. Ohne diese zweite Hälfte prüfte er nur, dass nichts
passiert.

**Drei Prädikate, je eine Quelle.** `_gsPasstMonat` · `_gsPasstFarbe` ·
`_gsPasstHoehe`. Sie werden von zwei Seiten gebraucht — von den Prüfregeln
(sie beurteilen die EINE bestimmte Art) und von der Vorauswahl (sie
beurteilt alle 4'342). Wären das zwei Rechnungen, würden sie auseinander-
driften; genau der Fehler aus v32.02, wo zwei Matcher für dieselbe Frage
dazu führten, dass die Karte einen Eintrag verlinkte, über den die Prüfung
darüber sagte, es gebe ihn nicht.

Jedes Prädikat hat **drei** Rückgaben: `true` · `false` · `null`. Und `null`
ist nicht `false`:

> Die Vorauswahl schliesst nur aus, was sich **begründen** lässt.

3'465 der 4'342 Arten haben keine Höhenangabe. Würde `null` wie `false`
wirken, bliebe von der Liste ein Fünftel übrig und die Zahl daneben wäre eine
Lüge. Der Prüfstand hält genau das fest (Gegenprobe gemacht: `null` → `false`
geändert, der Fall meldete sofort).

**Zwei neue Prüfregeln.**

- **S6 · Farbe.** Erfüllt, wenn eine der hinterlegten Farben im Foto ≥ 5 %
  ausmacht. Vorbehalt nur, wenn davon **nichts** da ist UND eine fremde Farbe
  ≥ 12 % überwiegt. Sonst „nicht prüfbar" — ein reines Blattfoto sagt weder
  ja noch nein, und das steht dann auch so da.
- **S7 · Höhenlage.** Erfüllt/Vorbehalt nur mit Standort UND hinterlegtem
  Höhenband, Toleranz 200 m (Verbreitungsangaben sind gerundet).

**Die Vorauswahl ist KEINE Prüfregel.** Eine Art fällt genau dann aus ihr
heraus, wenn Monat, Farbe oder Höhe sie ausschliessen — und dafür gibt es
S3, S6 und S7. Als vierte Regel gezählt, stünde derselbe Einwand zweimal in
der Bilanz und die Karte läse sich als doppelt so schlecht. Sie steht
deshalb als **Beleg** unter den Regeln: „Vor der Antwort eingegrenzt:
4'342 → 2'087 Arten (Monat · Farbe). Bärlauch war darunter."

**Aufwand, gemessen:** Farbmessung 1,5 ms, Vorauswahl über alle 4'342 Arten
6,1 ms (Mittel aus fünf Läufen, ungedrosselt). Auf einem Einsteiger-Telefon
etwa das Sechsfache — gegen einen KI-Aufruf von mehreren Sekunden nicht
messbar. `scan_check` hält ein Budget von 20 bzw. 60 ms fest, damit das so
bleibt.
