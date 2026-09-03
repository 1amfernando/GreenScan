# Arten-Daten: woher sie kommen — und woher nicht

> Gemessen am 03.09.2026 gegen `data/plants.v1.js` (4'342 Einträge; nach
> `deduplicateDB` beim Laden 4'337) und gegen die Supabase-Datenbank
> (lesend). Alle Zahlen sind gezählt, keine geschätzt. Der Anlass steht in
> Fernandos Worten:
>
> *„Eine Quelle für die Arten-Daten. 78 % der 4'342 Arten haben keine Farb-
> oder Höhenangabe; dadurch bleiben zwei Scanner-Prüfregeln und die
> Offline-Eingrenzung bei den meisten Arten still."*
>
> Dieses Dokument ergänzt `ARTEN-LUECKEN.md` (02.09.2026), das die Lücken
> **innerhalb** der Liste vermisst. Hier geht es um die Frage **dahinter**:
> gibt es etwas, womit man sie füllen könnte — und was ist beim Nachsehen
> sonst noch aufgefallen.

Kurzfassung für Eilige:

| Frage | Antwort |
|---|---|
| Woher stammt die Liste? | Aus **einem** Commit (`e8441f1`, 24.06.2026). Nie editiert. Kein Herkunftsfeld ausser `bookRef`. |
| Steckt in Supabase mehr? | Nein. `species` ist eine **Kopie** der App-Datei (2'738 × `source = inline_db_v1`), mit **weniger** Zeilen. |
| Ist von hier aus eine Quelle erreichbar? | Nein für GBIF, Wikidata, Wikipedia, iNaturalist (`CONNECT 403`, Richtlinie). Paketregister sind offen — dort liegt aber nichts Passendes. |
| Liegt im Repo etwas? | **Ja, zwei belegte Datensätze** (Pilz-Register, Baum-Spezifikationen), zusammen 9 % der Lücken — und sie **widersprechen** der Liste dort, wo beide etwas sagen. |
| Was war schlimmer als die Lücke? | **657 Gruppen mit demselben lateinischen Namen, 167 davon uneins über die Giftigkeit.** Welche Stufe der Scan zeigte, hing an der Reihenfolge in der Datei. Seit v32.43 gewinnt die vorsichtigere Angabe. |
| Und noch schlimmer? | **1'194 von 4'311 Einträgen (28 %) landeten mit ihrem eigenen Binomen auf einer anderen Art**, weil der deutsche Name zuerst gesucht wurde. Seit v32.43: 0. |

## 1 · Was da ist

Deckung je Feld (4'342 Einträge):

| Feld | gefüllt | Anteil |
|---|---|---|
| `uses`, `emoji`, `name`, `lat`, `tox`, `edible` | 4'342 | 100 % |
| `desc` | 3'577 | 82 % |
| `habitat` | 3'391 | 78 % |
| `warning` | 2'932 | 68 % |
| `season`, `medicinalUse`, `lookalike` | 2'907 | 67 % |
| `bookRef`, `fam` | ≈2'400 | 55 % |
| **`color`, `alt`** | **967** | **22 %** |

Drei Dinge, die man an diesen Zahlen nicht sieht und die für jede Quelle
entscheidend sind:

- **`color` und `alt` fehlen immer gemeinsam.** Nur `color`: 0 Arten. Nur
  `alt`: 0 Arten. Beide: 3'375. Das sind keine zwei Feldlücken, das ist
  **eine Klasse von Datensatz-Rümpfen** — dieselbe Klasse wie die
  Buch-Einlese in `ARTEN-LUECKEN.md` §2.
- **`alt` hat ein sauberes Format**, `color` nicht. 877 von 967 `alt`-Werten
  passen exakt auf `A–Bm` (Gedankenstrich U+2013); die Ausreisser sind
  `0m` ×40 und `Zimmerpflanze` ×30 (beides Hauspflanzen) und `–` ×20.
  `color` dagegen ist Freitext: **333 verschiedene Werte**, 250 davon genau
  einmal (`Grau-Grün-Gelb`, `Braun mit weissen Warzen`). Wer eine Quelle
  einliest, muss `color` auf ein Vokabular abbilden — `_gsFarbWorte`
  (index.html ~Z. 30806) tut das heute schon beim Lesen.
- **Die Lücke folgt der Import-Charge, nicht der Kategorie.** Man könnte
  vermuten, `color` fehle vor allem bei Pilzen und Moosen, wo „Blütenfarbe"
  keinen Sinn ergibt. Gemessen ist das falsch: die blütenlosen Gruppen sind
  **nicht schlechter** abgedeckt als die blühenden (Pilze 37 %, Kräuter
  39 %, Gemüse 100 %); 2'025 der 3'375 Lücken (60 %) sind `wildpflanze` —
  die ID-Präfixe `FD` (1'435) und `W` (617), je Präfix 0 % oder 100 %.
  (Die erste Fassung hier nannte Pilze/Moose „die beste Abdeckung" — die
  Gegenprüfung hat es korrigiert: Gemüse ist besser, Kräuter liegen gleich.)

## 2 · Woher die Liste kommt

`git log --follow -- data/plants.v1.js` hat **einen** Eintrag: `e8441f1`
vom 24.06.2026 (v30.34). Vorher lag die Liste inline in `index.html`; über
alle 676 historischen Fassungen dieser Datei hatte sie **immer** genau 967
`alt`-Werte. Es ist also nichts verlorengegangen — die 3'375 hatten die
Angabe nie.

Ein Herkunftsfeld je Datensatz gibt es nicht. `bookRef` ist bei 55 %
gefüllt und sagt bei 1'435 Einträgen `Schmeil/Fitschen` — das ist die
OCR-Einlese, die `ARTEN-LUECKEN.md` beschreibt. Für die übrigen 2'900
Einträge steht **nirgends**, woher `tox`, `edible` oder `warning` stammen.

Das ist der eigentliche Befund dieses Abschnitts: **die Liste hat keine
Quellenangabe, gegen die man eine neue Quelle halten könnte.** Wer sie
ergänzt, kann nur sagen „stammt aus X" für das Ergänzte — nicht „stimmt
mit dem Bestehenden überein", denn vom Bestehenden weiss niemand, woher es
ist.

## 3 · Drei Wege, alle abgegangen

### 3.1 · Netz — gesperrt, mit einer Ausnahme, die nichts nützt

```
api.gbif.org            CONNECT 403   (Richtlinie, kein Netzfehler — DNS löst auf)
www.wikidata.org        CONNECT 403
de.wikipedia.org        CONNECT 403
api.inaturalist.org     CONNECT 403
```

Der Proxy-Status nennt es `connect_rejected · policy denial`. Offen sind
nur die Paketregister (`registry.npmjs.org`, `pypi.org`,
`raw.githubusercontent.com`). **Nicht** weil sie in `NO_PROXY` stünden —
das hat die Gegenprüfung widerlegt: vor jeder Verbindung sitzt ein
transparentes, TLS-terminierendes Gateway mit Freigabeliste (`jsr.io`
steht in `NO_PROXY` und antwortet trotzdem `403 x-deny-reason:
host_not_allowed`). Die Register sind offen, weil sie auf dieser Liste
stehen. Ein Agent hat dort gesucht und **nichts Passendes** gefunden:
was sich herunterladen liess, war das falsche Reich, nur Namen ohne
Merkmale, oder Merkmale ohne Artnamen. Die Aussage „von hier aus geht
nichts" ist damit **präzisiert**, nicht widerlegt: erreichbar ist etwas,
brauchbar nicht.

Was das für Fernando heisst: **jede echte Quelle braucht eine Umgebung
ohne diese Sperre.** Von hier aus lässt sich eine gelieferte Datei
einlesen, prüfen und abgleichen — nicht beschaffen.

### 3.2 · Supabase — eine Kopie, keine Quelle

| Messung | Ergebnis |
|---|---|
| Zeilen in `public.species` | 2'838 |
| davon `data->>'source' = 'inline_db_v1'` | 2'738 |
| `= 'seed'` | 39 |
| ohne `source` | 61 |
| Zeilen mit `bloom_color` | 586 — davon **568 wortgleich** mit der Datei, 4 abweichend, 9 nicht in der Datei |
| **Farbe in der Datenbank, in der Datei leer** | **5** (Akelei, Sonnenblume, Alpen-Mohn, Aurikel, Kapuzinerkresse) |

Die Tabelle hat **weniger** Zeilen als die Datei und nennt die Datei als
Quelle. Sie wurde aus der App befüllt, nicht umgekehrt. Was dort steht,
weiss die App schon — bis auf fünf Arten, deren Farbe nur in der Datenbank
steht (aus den 39 `seed`-Zeilen der Migration `v24_30_flowers_seed_v3`,
ohne Buchbeleg). Fünf von 3'375: das ist keine Quelle, das ist ein Rest.

**Aber der Schluss war zu eng gefasst** — die Gegenprüfung hat vier
NEBENtabellen gefunden, die Farbe und Höhe tragen, je Zeile mit Quelle:

| Tabelle | Zeilen | Farbe | Höhe | Quelle (Spalte) | im Repo? |
|---|---|---|---|---|---|
| `alpine_garden_plants` | 60 | 60 | 60 | Pro Natura/SAC (48), Pro Natura (11), Pro Specie Rara | **nein — nur live** |
| `water_features` | 60 | 34 | — | Pro Natura (55), Pro Specie Rara, Bioterra | **nein — nur live** |
| `mushroom_register` | 272 | 272 | 87 | VAPKO, SwissFungi, Wikipedia … | ja (§3.3) |
| `tree_planting_specs` | 76 | — | 76 | BAFU, Flora Helvetica, tox.ch | ja (§3.3) |

Über das normalisierte Binomen gegen die Datei gehalten: **114 Arten**
(156 Einträge) hätten Farbe (93 Arten) oder Höhe (51 Arten) aus der
Datenbank. Zwei Dinge dazu, beide gemessen:

- **Zwei der vier Tabellen existieren in keiner Repo-Migration** — die App
  liest sie (`index.html` ~Z. 50118 und ~50156), aber wer sie angelegt hat
  und woher die Zeilen kommen, steht nirgends. Ein weiterer Fall von
  „Arbeit, die getan wurde und dann verstummt ist".
- **`alpine_garden_plants` widerspricht sich selbst:** neun Namen stehen
  mehrfach drin, alle neun mit abweichenden Werten (Rhododendron ferrugineum
  dreimal: 1600–2800 karminrot · 1500–2500 rosa-pink · 1400–2800 karminrot
  bis magenta). Auch dort wurde also keine einzelne Quelle abgeschrieben.

Die Regel aus §3.3 gilt deshalb auch hier: belegte Zeilen, aber ohne
benannte Konvention — **nicht übernommen**, bis jemand sie entscheidet.

### 3.3 · Repo — zwei belegte Datensätze, und warum sie nicht einfach
übernommen werden dürfen

Das hatte ich beim ersten Anlauf übersehen; gefunden hat es der Workflow
(Blickwinkel „liegt es im Repo schon herum?"):

| Datensatz | Datei | Zeilen | Felder | Quellen (Spalte `source`) |
|---|---|---|---|---|
| Pilz-Register | `supabase/migrations/v29_88_mushroom_register_snapshot.sql` | 268 | `cap_color`, `altitude_m_min/max` | je Zeile mehrere: Wikipedia (115 Nennungen), pilzbuch-pilzwelten (67), 123pilze (65), tintling (64); 31 Zeilen allein „VAPKO Schweiz"; dazu Tox Info Suisse, DGfM, SwissFungi |
| Baum-Spezifikationen | `supabase/migrations/v30_00_tree_planting_specs_snapshot.sql` | 76 | `altitude_max_m` | BAFU, Flora Helvetica, tox.ch |

Beide tragen je Zeile eine **namentliche Quelle** — genau das, was der
Arten-Liste fehlt. Abgeglichen über das normalisierte Binomen:

| | Pilz-Register | Baum-Snapshot |
|---|---|---|
| Treffer in der Liste | 172 Register-Zeilen | 66 Snapshot-Zeilen |
| **Lücken, die sich füllen liessen** | **220 × Farbe · 93 × Höhe** | **117 × Höhe** |
| beide haben eine Höhe | 122 | 75 |
| davon **identisch** | **2** | **18** |
| überlappend (Pilze) / Obergrenze bis 300 m auseinander (Bäume) | 120 — davon 8 an der Obergrenze über 500 m auseinander | 48 |
| ohne jede Überlappung (Pilze) / über 300 m auseinander (Bäume) | 0 | 9 |

Die Höhen widersprechen sich also fast immer — beim Pilz-Register
**systematisch** (Register-Untergrenze höher in 115 von 120 Fällen: es
setzt sie auf 300 m, die Liste auf 0), beim Baum-Snapshot **ohne Richtung**
(Snapshot höher in 36, Liste höher in 21 — zwei Quellen, keine Konvention).
Beispiele:

```
Wiesenchampignon   (agaricus campestris)   Liste 0–1200   Register 300–1800
Fliegenpilz        (amanita muscaria)      Liste 0–2000   Register 300–1800
Himbeere           (rubus idaeus)          Liste bis 2000 Snapshot bis 1600
Brombeere          (rubus fruticosus)      Liste bis 1600 Snapshot bis 1200
```

Keine der beiden Seiten ist erkennbar „richtig" — es sind **zwei
Konventionen** (Verbreitungsgrenze vs. Schwerpunkt, Schweiz vs.
Mitteleuropa), und die Liste nennt ihre nicht. Wer die 93 + 117 Höhen und
die 220 Farben aus den Snapshots übernimmt, mischt zwei Konventionen in ein
Feld, das der Scanner als Ausschlussgrund liest (S7, `_gsPasstHoehe`).

**Deshalb nicht übernommen.** Es ist die einzige belegte Quelle, die es
gibt, und sie liegt bereit — aber die Entscheidung, welche Konvention
gilt, ist eine fachliche, keine technische. Sie steht unten in §7.
Reproduzierbar: `node scripts/arten_quellen_vergleich.js` (nur lesend).

## 4 · Der Fund, der nicht warten konnte: Dubletten mit widersprüchlicher Giftstufe

Beim Zählen der Latein-Namen fiel auf, dass die Liste **nicht eine Art je
Zeile** führt:

| Messung (geladene Liste, 4'337) | |
|---|---|
| Gruppen mit demselben normalisierten Binomen | **657** (1'855 Einträge, 43 %) |
| davon uneins über `tox` oder `edible` | **167** (529 Einträge) |
| Spanne der Giftstufe ≥ 2 | 20 Gruppen |
| nur `edible` uneins | 60 Gruppen |

```
sambucus nigra        9 Einträge   tox 0 / 1 / 2
amanita rubescens     6 Einträge   tox 0 / 1 / 2 / 4    edible ja / nein
morchella esculenta   6 Einträge   tox 0 / 1 / 2
juniperus communis    4 Einträge   tox 0 / 2
vaccinium uliginosum  2 Einträge   tox 0 / 3            edible ja / nein
```

Und **jede** Nachschlagung nach einem Scan war ein `DB.find(…)` — der
erste Treffer in Dateireihenfolge. Welche Giftstufe der Nutzer sah, hing
also nicht an der Art, sondern daran, welcher der neun Holunder-Einträge
zufällig weiter oben stand. Für „Holunder" war das der eine mit tox 0.

Dazu ein zweiter Fehler, der erst beim Reparieren sichtbar wurde — und
der sich als der grössere herausstellte: der deutsche Name wurde **vor**
dem lateinischen gesucht. (Die erste Fassung dieses Absatzes behauptete,
„Wacholder / *Juniperus communis*" habe in v32.42 `FD0660 Juniperus nana`
getroffen. **Das war falsch gemessen** — v32.42 traf T018, *Juniperus
communis*, tox 0; die Anekdote beschrieb einen Zwischenstand meines eigenen
Umbaus. Die Gegenprüfung hat es gefunden. Der echte Defekt war tox 0 statt
Gruppenmaximum 2. Die Zahl, die trägt, steht in der Tabelle darunter.)

Wie gross das ist, zeigte erst die Gegenprobe: **jeder Eintrag mit seinem
eigenen Namen und Binomen abgefragt** — die Frage, die ein korrekter Scan
stellt.

| | v32.42 | v32.43 |
|---|---|---|
| Einträge mit Binomen | 4'311 | 4'311 |
| finden ihre **eigene** Art | 3'117 | **4'311** |
| landen auf einer **anderen** Art | **1'194** (28 %) | **0** |

```
Brennnessel / Urtica pilulifera   →  Urtica dioica
Rotbuche    / Fagus silvatica     →  Fagus sylvatica
Aloe Vera   / Aloe barbadensis    →  Aloe vera
Platane     / Platanus occidentalis → Platanus × acerifolia
```

Deutsche Namen teilen sich viele Arten. Für gut ein Viertel der Liste
landete ein Scan mit dem richtigen Binomen auf der Karte einer anderen
Art — mit deren Giftstufe, deren Verwechslungshinweis, deren Saison. Das
ist kein Dubletten-Problem mehr; das ist die Reihenfolge zweier Zeilen.

### Was seit v32.43 gilt

Das lässt sich nicht ohne Botanik **entscheiden**, und Botanik schreibe
ich nicht aus dem Gedächtnis. Was sich ohne Botanik entscheiden lässt, ist
die **Richtung des Zweifels** — dieselbe Regel wie in der Gegenprobe des
Scanners (v31.99):

> Widersprechen sich zwei Einträge zur selben Art, gewinnt die
> vorsichtigere Angabe: höheres `tox`, dann `edible = false`, dann der
> inhaltsreichere Eintrag.

Drei Teile (`index.html` ab ~Z. 16040):

1. `_gsVorsichtigste(treffer)` — sortiert nach obiger Regel.
2. `_gsArtGruppe(sp)` — sammelt nach der Identifikation **alle** Einträge
   derselben Art ein. Ohne das griff die Vorsicht nur innerhalb einer
   Suchstrategie: „Holunder" trifft über den deutschen Namen genau einen
   Eintrag (tox 0), die Art hat neun.
3. In `gsMatchScanToDb` wird das **Binomen vor dem deutschen Namen**
   gesucht. Ein Trivialname ist mehrdeutig, ein Binomen nicht; liefert das
   Modell beides, ist das Binomen die genauere Angabe. Findet es nichts,
   greifen die deutschen Strategien unverändert.

Gemessen: alle 167 Gruppen, Eintrag für Eintrag (527 Abfragen) — **0**
liefern etwas anderes als die vorsichtigste Angabe. Vorher: 106 von 107
(die Wacholder-Gruppe war der Rest). Der Fall steht in `scan_check.js`
(„Dubletten · bei Widerspruch gewinnt die vorsichtigere Angabe") und
prüft beide Reparaturen **getrennt**, mit zwei Gegenproben:

| ausgebaut | Meldung |
|---|---|
| `_gsArtGruppe` | „Holunder" ohne Binomen → tox 0 statt 2 — die Vorsicht hängt an der Suchstrategie statt an der Art |
| Latein-vor-Deutsch | der deutsche Name überstimmt das Binomen: „Wacholder / Juniperus communis" → Wacholder (Juniperus nana) |

**Was das nicht behebt:** die Dubletten selbst. Sie stehen mit allen
Werten in `docs/arten-widersprueche.csv` (167 Zeilen, sortiert nach
Spanne), damit jemand mit einer Flora sie entscheiden kann — welcher
Eintrag bleibt, welche zusammengelegt werden. Bis dahin sorgt die Regel nur
dafür, dass sie nicht mehr in die gefährliche Richtung ausschlagen.

### v32.45 — die Regel hat zwei Dinge gleich behandelt, die es nicht sind

Die gegnerische Prüfung (§6) hat an der Regel selbst zwei Fehler gefunden,
beide mit Zahlen:

| Fehler | Wirkung in v32.43/44 | Korrektur |
|---|---|---|
| **Eine Unterart entschied über die Art.** `_gsNormLat` streicht var./ssp./f. — `PI427 „Kleiner Perlpilz"` (*Amanita rubescens* f. *annulosulphurea*, tox 4) stand in der Gruppe des Perlpilzes (tox 0–2) | jeder „Perlpilz / Amanita rubescens"-Scan zeigte **Stufe 4**, obwohl der Eintrag sich in seinem eigenen `lookalike` vom Perlpilz abgrenzt. Umgekehrt landete „Broccoli / Brassica oleracea var. italica" bei `FD0778 Kohl` | `_gsArtGruppe(sp, abfrageLat)` gruppiert auf der **Stufe der Anfrage**: ohne Qualifier zählen nur Einträge ohne Qualifier; mit Qualifier zuerst der exakte Treffer. Perlpilz → tox 2, die Forma → sie selbst, Broccoli → G023 |
| **Ein Platzhalter galt als Vorsicht.** Einlese-Rümpfe tragen `edible:false` ohne Warnung und ohne Text; „nicht essbar zuerst" hielt sie für vorsichtiger | **94** Namens-Abfragen gepflegter Einträge landeten auf einem Rumpf, **82 davon auf einer anderen Art**; 12 gepflegte Gemüse-Einträge dazu — das Prüfwerk meldete „nur als ungeprüfter Einlese-Eintrag vorhanden" für Broccoli und Mangold | bei gleicher Giftstufe gewinnt der Eintrag **mit** `warning`/`lookalike` (dieselben Felder, an denen v31.90 die Bearbeitung erkennt); `edible` zählt erst danach. Gemessen: 0 von 2'954 |

Und ein dritter Fund beim Reparieren: **zwei Routinen füllen ~4 Sekunden
nach dem Start Vorlagen-Text in `lookalike`, `warning` und `uses`**
(`gsAutoFillDBGaps`, `gsAutoFillLookalikes` — „Ähnliche Arten in der Region.
Merkmale sorgfältig prüfen."). Damit sah jeder Rumpf nach vier Sekunden wie
ein bearbeiteter Eintrag aus, und die Korrektur oben griff nur in den ersten
Sekunden. Die Vorlagen sind jetzt markiert (`_lookalike_tpl`, `_warning_tpl`,
`_uses_tpl`) und zählen nicht als Bearbeitung. Beide Routinen laufen
ausserdem nur **einmal je Gerät** (`gs_db_filled_v3`, `gs_lookalike_filled`
im localStorage) — beim ersten Start füllen sie, bei jedem weiteren nicht.
Dieselbe Karte zeigt also je nach Gerät einen Vorlagen-Satz oder nichts.
Das ist ein eigener Punkt (§7).

### Und eine Ausschluss-Zahl, die zwei Dinge in einen Topf warf

Ebenfalls vom Workflow gefunden: die Offline-Eingrenzung (`gsEingrenzen`)
schloss bei gewählter Farbe **3'229** Arten aus und zählte sie alle als
„andere Farbe". **2'816 davon hatten gar keine Farbangabe.** Die Anzeige
„135 von 4'337" las sich, als hätten 4'202 Arten eine andere Farbe.

Der Ausschluss bleibt — eine Liste, in der drei Viertel „vielleicht" sind,
grenzt nichts ein. Aber er wird seit v32.43 **getrennt gezählt**
(`raus.farbeOhne`) und **genannt**: „2'602 Arten ohne Farbangabe sind nicht
gezeigt — sie könnten passen." Ein Ausschluss ohne Grund muss anders
aussehen als einer mit. Auch das steht in `scan_check.js`, mit Gegenprobe.

## 5 · Was eine brauchbare Quelle mitbringen muss

Damit sie sich gegen die Liste halten und einlesen lässt — jede Zeile ist
eine Lehre aus den Abschnitten oben:

| Anforderung | Warum |
|---|---|
| **Binomen mit Autor** (`Sambucus nigra L.`) | Ohne Autor ist „Juniperus communis" nicht von Synonymen zu unterscheiden — genau der Wacholder-Fall. |
| **Eine stabile Kennung je Art** (z.B. Info-Flora-Nummer, GBIF-Key) | Die Liste hat 657 Gruppen unter demselben Namen. Ein Abgleich über Namen allein reproduziert das. |
| **Herkunft je Datensatz**, nicht je Lieferung | `bookRef` reicht nicht: es sagt „Schmeil/Fitschen" und nicht, welche Auflage, welche Seite, welches Feld. |
| **Geschlossenes Vokabular für Farbe** (oder eine Abbildung darauf) | 333 Freitext-Werte lassen sich nicht vergleichen; `_gsFarbWorte` kennt ~12 Wörter. |
| **Höhe als `min–max` in Metern, mit benannter Konvention** | Register (ab 300 m) und Liste (ab 0 m) widersprechen sich zu 98 % — weil beide ihre Konvention verschweigen. |
| **Schweizer Bezug** | Verbreitung und Höhenlage sind regional. Ein mitteleuropäischer Wert ist für den Scanner S7 eine Fehlerquelle. |
| **Lizenz, die die Weitergabe in einer App erlaubt** | Die Liste wird an jeden Nutzer ausgeliefert (`data/plants.v1.js`, 2,1 MB). |
| **Giftigkeit mit Quelle und Organ** | `tox` ist eine Zahl ohne Bezug. „Beere roh giftig, gekocht essbar" (Holunder) passt in keine Zahl — und genau dort widersprechen sich die Dubletten. |

Kandidaten, die diese Kriterien **prüfen** lassen — nicht: erfüllen; das
kann ich von hier aus nicht nachsehen:

- **Info Flora** (nationales Daten- und Informationszentrum der Schweizer
  Flora) — Checkliste mit stabilen Nummern, Verbreitung, Höhenstufen.
  Lizenz und Bezug klären.
- **SwissFungi / VAPKO** für die Pilze — das Register im Repo zitiert beide
  bereits.
- **GBIF** für Kennungen und Synonymie (Namensauflösung), nicht für
  Merkmale.

## 6 · Gegenprüfung

Die Befunde in §1–§3 stammen aus einem Workflow mit fünf unabhängigen
Blickwinkeln, jeder danach von einem gegnerischen Agenten angegriffen. Der
erste Durchlauf verlor vier gelieferte Befunde an API-Fehler in der
Gegenprüfung (und gab `{}` zurück — ein Skript, das bei einem Fehler in
Stufe 2 die Ergebnisse von Stufe 1 verschluckt, ist derselbe Fehler wie
ein `catch {}`); der zweite Durchlauf läuft mit einem sechsten Blickwinkel
auf §4. Sein Ergebnis wird hier nachgetragen.

Der zweite Durchlauf hat sechs Befunde geliefert und drei davon
gegengeprüft, bevor das Kontingent der Umgebung erschöpft war (die drei
übrigen Gegenprüfungen — Repo-Datensätze, Dubletten, Datenbank — sind
damit **ungeprüft**, nicht bestätigt). Alle drei Urteile lauteten
**„hält nicht stand"** — und in allen drei Fällen hielten die *Zahlen*, aber
nicht die *Folgerung*. Das ist die häufigste Fehlerart in diesem Repo, und
sie hat mich hier dreimal erwischt:

| Befund | Was hielt | Was nicht hielt | Folge |
|---|---|---|---|
| Form der vorhandenen Werte | alle Zahlen (967, 333 Werte, 877 im Format `A–Bm`, Präfix-Muster) | „Pilze/Moose haben die beste Abdeckung" (Gemüse 100 %, Kräuter gleichauf); „der Blühkalender rendert 20 Arten mit `🎨 –`" (Pilze erreichen die Funktion nie, und `showMax = 25` zeigt die übrigen nur im Oktober) | §1 korrigiert |
| Verbraucher der Felder | alle neun Lesestellen, alle Messungen | „ohne dass ein Wort davon auf dem Bildschirm steht" — v32.43 hatte den Satz zwischen Befund und Prüfung eingebaut | Befunde 2b, 3b, 5, 6 waren neu und sind in v32.45 behoben (Vollständigkeit zählt `alt`; „Gut belegt" nennt die Unbekannten; kein `🎨 –`; Höhe aus dem Lebensraum-Text auf der Karte) |
| Netz | alle vier Hosts gesperrt, Register offen, nichts Passendes dort | „Paketregister umgehen den Proxy über `NO_PROXY`" — es ist ein Gateway mit Freigabeliste | §3.1 korrigiert |

Zwei weitere Befunde kamen ohne Gegenprüfung an und stehen hier mit dem
Vermerk **ungeprüft**: der Datenbank-Befund (§3.2, vier Nebentabellen) und
der Dubletten-Befund (§4, die zwei Korrekturen). Den zweiten habe ich selbst
nachgemessen und beide Korrekturen in `scan_check` mit Gegenprobe abgelegt
(Regel ausgebaut → rot); den ersten habe ich für die Zahlen der
Nebentabellen übernommen, ohne sie ein zweites Mal zu zählen.

Die Lehre, die über dieses Dokument hinausgeht: **ein Befund mit richtigen
Zahlen und falscher Folgerung ist gefährlicher als ein falscher Befund** —
er überzeugt. Die Zahlen sind das Erste, was man nachrechnet, und wenn sie
stimmen, hört man auf zu lesen.

## 7 · Was ich Fernando vorschlage

1. **Die 167 Widersprüche entscheiden, bevor irgendetwas gefüllt wird.**
   `docs/arten-widersprueche.csv` ist dafür gebaut: je Gruppe alle
   Einträge, ihre Giftstufen, ihre Warntexte, und welcher heute gewinnt.
   Wer eine Flora hat, braucht dafür einen Nachmittag. Solange die Liste
   für *Sambucus nigra* neun Einträge führt, ist jede neue Quelle ein
   zehnter.
2. **Die zwei Repo-Datensätze sind die einzige belegte Quelle** — 303
   Lücken, mit Namen. Vor der Übernahme braucht es **eine** Entscheidung:
   welche Höhen-Konvention gilt (ab 0 oder ab Schwerpunkt)? Der Abgleich
   steht als Messung bereit — `node scripts/arten_quellen_vergleich.js`
   zählt Treffer, füllbare Lücken und Abweichungen mit Richtung, ohne etwas
   zu schreiben. Nach der Entscheidung ist die Übernahme dieselbe Schleife
   mit einem Schreibbefehl, kein Handgriff mehr.
3. **Für alles darüber hinaus braucht es eine Umgebung ohne Netzsperre**
   und eine der Quellen aus §5. Eine gelieferte Datei kann diese Umgebung
   einlesen und gegen die Liste halten — mit Zahlen wie in §3.3, bevor
   irgendetwas geschrieben wird.
4. **Nicht tun:** die Lücken mit KI-Antworten füllen. Das Modell würde
   liefern, und `_gsFarbWorte` würde es lesen, und der Scanner würde damit
   Arten ausschliessen. Es wäre die Sorte Daten, gegen die diese App seit
   v31.99 gebaut ist: eine Behauptung ohne Herkunft.
5. **Die zwei Nur-live-Tabellen ins Repo holen** (`alpine_garden_plants`,
   `water_features`): einmal `select` ziehen, als Snapshot-Migration
   ablegen wie beim Pilz-Register — sonst ist es Arbeit, die beim nächsten
   Projekt-Umzug verschwindet. Nur lesend, kein Eingriff; ich kann das
   vorbereiten.
6. **Entscheiden, ob Vorlagen-Text auf Artenkarten bleiben soll.** Zwei
   Routinen schreiben „Ähnliche Arten in der Region …" in `lookalike` und
   `warning` — beim ersten Start eines Geräts, danach nie wieder. Entweder
   bei jedem Start (dann sagt die Karte, dass es eine Vorlage ist) oder gar
   nicht. Der jetzige Zustand ist das Schlechteste von beidem.
