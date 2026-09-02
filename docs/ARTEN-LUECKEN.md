# Arten-Datenbank: was fehlt, und was schlimmer ist als eine Lücke

> Gemessen am 02.09.2026 gegen `data/plants.v1.js` (4'342 Einträge, nach der
> Dedup beim Laden 4'337). Alle Zahlen sind gezählt, keine geschätzt.
> Reproduzierbar mit `node scripts/data_check.js`.

Fernando: *„Arten-Infos vervollständigen und neue Arten hinzufügen."*

Ich habe zweimal gesagt, dass ich botanische Angaben nicht aus dem Gedächtnis
schreiben kann — in einer App, die Giftiges von Essbarem trennt, wäre das
fahrlässig. Was ich statt dessen tun kann, ist **messen**. Das hier ist das
Ergebnis, und es fiel anders aus als erwartet.

## 1 · Die Lücke ist nicht verteilt, sie ist konzentriert

| Kategorie | season | habitat | desc | medicinalUse | warning | lookalike |
|---|---|---|---|---|---|---|
| pilz (641) | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| kraut (388) | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| hauspflanze (286) | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| baum (431) | 94 % | 97 % | 98 % | 94 % | 94 % | 94 % |
| **wildpflanze (2226)** | **37 %** | **58 %** | **66 %** | **37 %** | **38 %** | **37 %** |

Alles ausser `wildpflanze` ist gepflegt. Die halbe Datenbank sieht nur
deshalb lückenhaft aus, weil eine Kategorie es ist.

## 2 · Und auch dort ist sie konzentriert

**133 Trivialnamen zeigen auf mehr als zwei verschiedene botanische Namen:**

| Trivialname | verschiedene Binome |
|---|---|
| Levkoje | 98 |
| Königskerze | 97 |
| Gaspeldorn | 96 |
| Knabenkraut | 42 |
| Binse | 31 |
| Ampfer | 28 |

Zusammen **1'276 Einträge** (29 % der Datenbank). Und diese 1'276 sind
systematisch leer — im Vergleich zum Rest:

| Feld | in diesen Gruppen | im Rest der DB |
|---|---|---|
| season | **2 %** | 94 % |
| warning | **4 %** | 94 % |
| lookalike | **2 %** | 94 % |
| medicinalUse | **2 %** | 94 % |
| habitat | 39 % | 94 % |
| desc | 53 % | 95 % |

Ein Beispiel-Eintrag zeigt, woher sie kommen:

```
name: "Levkoje" · lat: "Matthiola annua" · bookRef: "Schmeil/Fitschen"
desc: "Bltn sehr verschiedenfarbig, oft gefüllt. 6–9. Zierpfl. in Gärten
       2. Cheiránthus L., Goldlack. XV. Bl"
season: ""  habitat: ""  warning: ""  lookalike: ""  medicinalUse: ""
```

`desc` sind rohe OCR-Fetzen, `bookRef` nennt die Quelle. Das ist die
Buch-Einlese aus der Roadmap („PDF → OCR → Kandidaten → **Review**") — und
der Review-Schritt hat für diese Einträge offenbar nie stattgefunden.

**Was das für „vervollständigen" heisst:** die Frage ist nicht, wie man
1'276 Einträge füllt. Die Frage ist, ob sie gültig sind. Ob „Rumex
persicaria" oder „Urtica officinalis" akzeptierte Namen sind, kann ich von
hier aus **nicht** prüfen — das braucht eine botanische Quelle. Aber die
Häufung (ein Trivialname, 98 Binome, alle Felder leer) ist ein starkes
Signal, dass hier zuerst **geprüft und zusammengefasst**, nicht ausgefüllt
werden sollte.

## 3 · Der Fund, der nicht warten konnte

Beim Zählen fiel auf: **1'408 Einträge tragen im Feld `uses` denselben Satz.**

> „Wildpflanze der Schweizer Flora. Junge Blätter, Blüten oder Samen je nach
> Art **verwendbar**. Vor Verzehr sicher bestimmen."

Bei **25** davon steht im selben Datensatz `toxic: true, tox: 3`. Die
Gattungen:

> Geranium · Alisma · Ranunculus · Delphinium · **Aconitum** · **Daphne** ·
> **Oenanthe** · **Solanum** · **Datura** · **Digitalis**

Eisenhut, Rebendolde, Stechapfel, Fingerhut, Seidelbast. Auf ihrer Karte
stand unter „Verwendung", junge Blätter seien verwendbar — **während das
Warnfeld derselben Karte „⚠️ Giftig — nicht essen." sagte.**

Der Satz stand nie da, weil jemand diese Art geprüft hätte. Er stand auf
1'408 Einträgen gleichzeitig.

**Behoben in v31.89**, beim Laden der Datenbank: wo der Datensatz selbst die
Art als giftig einstuft, wird der generische Satz durch „Keine Verwendung —
dieser Eintrag ist als giftig eingestuft." ersetzt. Hier wird **nichts
botanisch entschieden** — es wird nur ein Text entfernt, der der eigenen
Einstufung des Datensatzes widerspricht.

Die Korrektur läuft bei jedem Start. Sie fängt denselben Fall wieder auf,
falls eine künftige Datenlieferung ihn erneut mitbringt.

## 4 · Was `data_check.js` seither dauerhaft prüft

**Generischer Text darf auf einer als giftig eingestuften Art keine
Verwendung versprechen.** Generisch heisst messbar: derselbe Text steht auf
50 oder mehr Arten — ein Text, der auf vielen Arten gleichzeitig steht, kann
über keine einzelne etwas aussagen.

Zwei Anläufe, bis die Prüfung taugte:

| Anlauf | Meldung | Warum falsch |
|---|---|---|
| 1 | u. a. Knollenblätterpilz | suchte „essbar" und traf „**NICHT** essbar oder nur mit Fachkenntnis" |
| 2 | 16 Treffer | darunter Robinie (Blüten essbar, Rinde giftig), Tintling (essbar, aber nicht mit Alkohol) — **sorgfältig geschriebene** Einträge über teilweise essbare Arten |

Jetzt: **0 Treffer** nach der Korrektur, **25** ohne sie (Gegenprobe
gemacht). Die 16 einzeln geschriebenen Texte werden ausgewiesen und nicht
angeschwärzt — ein Prüfstand, der die richtigen Einträge anschwärzt, wird
weggeklickt.

## 4a · Nachtrag v31.90: was nie geprüft wurde, sagt es jetzt

Der „verwendbar"-Satz war nur die Spitze. Dieselben Einträge tragen **kein
`warning`, kein `lookalike` und keine `season`** — die drei Felder, an denen
man einen redaktionell bearbeiteten Eintrag erkennt. **1'383 Stück**, und
**68 davon behaupten `edible: true`** und zeigten dafür eine grüne
„🍽️ Essbar"-Plakette.

Die App hat für genau diesen Fall seit v30.66/v30.73 einen Mechanismus:
`_unverified` unterdrückt die grünen Plaketten und schreibt „Noch nicht
geprüft". Er war nur nie auf die Buch-Einlese angewandt — nur auf
Community-Vorschläge.

Jetzt wird er beim Laden gesetzt. **Es wird nichts hinzugedichtet: es werden
positive Behauptungen zurückgenommen, die die Daten nicht tragen.** Eine
grüne „Essbar"-Plakette auf einem Eintrag ohne jede Verwechslungsangabe ist
genau die Zusage, die diese App nicht machen darf.

Zwei Dinge blieben bewusst:

- **Warnungen.** Zurückgehalten wird nur die *Ent*warnung. Wo ein Eintrag als
  giftig eingestuft ist, steht die Warnung unverändert.
- **Die gepflegten Arten.** Bärlauch behält „Essbar" und „Ungiftig" —
  nachgeprüft; er hat `warning` und `lookalike`.

Dabei fiel ein zweiter Widerspruch auf, den es seit v30.66 gab: die
Toxizitäts-Überschrift zeigte weiter die Einstufung, während die Unterzeile
„Noch nicht geprüft" sagte —

```
✅ Ungiftig
Noch nicht geprüft
```

Dieselbe Sorte wie „verwendbar" neben „nicht essen". Bei ungeprüften,
nicht-giftigen Einträgen steht dort jetzt **„❔ Einstufung offen"**.

## 5 · Was ich Fernando vorschlage

1. **Nicht ausfüllen, sondern prüfen.** Eine Stichprobe der 1'276 Einträge
   gegen eine echte Flora (Info Flora, WSL, Schmeil/Fitschen im Original).
   Wenn die Binome halten, lohnt das Ausfüllen; wenn nicht, gehören sie
   zusammengefasst.
2. **Die gepflegten 3'066 Arten sind gut** (94–100 % in allen Feldern). Wer
   neue Arten will, sollte dort anschliessen, nicht die Buch-Einlese
   vergrössern.
3. **`alt` und `color` fehlen bei 78 %** — das ist kosmetisch und ohne
   Sicherheitsbezug. Niedrige Priorität.
4. **Sicherheit ist sonst in Ordnung:** 0 als giftig eingestufte Arten ohne
   Warntext. Die 35 Einträge, die gleichzeitig `edible` und `toxic` tragen,
   sind **korrekt** — Holunder (roh giftig, gekocht essbar), Morchel,
   Perlpilz, Hallimasch. Nachgesehen, nicht angenommen.
