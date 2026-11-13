# Aufgaben aus dem Austausch (gefuehrt vom Head) — Stand 11.11.2026

Jede Zeile ist aus einem Brett-Eintrag entstanden. Beleg und Messung stehen dort (BRETT.md, Suche nach dem Titel).

## Vergeben (laeuft)
| Aufgabe | Quelle | Agent |
|---|---|---|
| Standort: `lon` gegen `lng`, ein Leser | IDEE-C | ORT |
| Gegenprobe: „Verzehr vertretbar" folgt nur dem KI-Feld | IDEE-B | SCANSCHUTZ |
| Kalender: toter Knopf `gsSearchSpecies` | IDEE-B | SCANSCHUTZ |
| Saatgut-Leiste einen Monat versetzt | IDEE-A | GARTEN |
| Garten-Insights zaehlt nur `myPlants` | IDEE-A | GARTEN |
| Checkout live kaputt (`automatic_payment_methods`, `stripe_customers`), Webhook `.catch`, Rueckkehr-Adressen | ZAHLUNG + HEAD | ZAHLUNG |
| Tagebuchfoto wird gar nicht gerendert (`photo` gegen `photo_url`) | HUELLE | HUELLE |

## Offen (noch ohne Besitzer) — nach Dringlichkeit
| # | Aufgabe | Quelle | Warum es zaehlt |
|---|---|---|---|
| 1 | Pilz-Scanner: kein einziger Pruefstand-Fall; schreibt keinen Scan-Verlauf | IDEE-A, IDEE-B | hoechster Einsatz der App, ungemessen; im Notfall laesst sich „was war es?" nicht nachschlagen |
| 2 | Vier Pruefstaende (render/contrast/touch/a11y) vermessen unter Last den Anmeldebildschirm und bleiben gruen; contrast/render setzen keinen Exit-Code | SICHT | die Messgrundlage: 320 ms Abstand, bei 4x-Drossel kippt es |
| 3 | „Stille Tage": „pausiert" ohne Antwort des Servers (und neun Schalter durch denselben Helfer) | IDEE-A | Ferien, taeglich Pushes, die App sagt „pausiert" |
| 4 | Garten-Seite erfindet ein Erntedatum (`calcHarvestDate`, Rueckfall 60–90 Tage; „Rose" trifft Rosenkohl) | IDEE-A | genau die Erfindung, die v33.34 im Kalender abgestellt hat |
| 5 | Kulturdaten × Artenliste: 10 von 40 Gemuese-Eintraegen erreichen keine Kultur (Tomate!) → Frost-Regel schweigt | IDEE-C | Frost × Tomate ist der Paradefall |
| 6 | Tiefer Pfad im Web: SPA-Rueckfall liefert `index.html` ALS `plants.v1.js` → App ohne Arten, fuer immer „laedt" | HUELLE | falsch geteilter Link = kaputte App ohne Meldung |
| 7 | Menue-Suche: „Notfall", „145", „Tox Info" finden nichts | IDEE-B | Eile, leere Liste |
| 8 | `doneTask` schreibt keinen Verlaufseintrag (dritter Erledigt-Weg) | IDEE-B | Tagebuch/Rueckblick mit Luecke |
| 9 | `gsSaeLogAsSowed` schreibt am `gsTagebuchSave` vorbei, meldet immer Erfolg | IDEE-B | voller Speicher: Eintrag weg, Meldung steht |
| 10 | Wetter-Log: Merker vor der Antwort, UTC-Tag gegen Zuercher Werte, Momentanwert als „avg" — und 0 Leser | IDEE-B | Daten fuer Rueckblick-Ideen waeren schief |
| 11 | 98 von 253 „giftig/toedlich"-Verwechslern zeigen auf keine Art der Liste | IDEE-C → ARTEN | Doppelgaenger-Ideen stehen auf diesem Feld |
| 12 | Todesursache „hilft dir beim naechsten Mal" — 0 Leser | IDEE-B | Versprechen ohne Einloesung (→ Idee „Flugschreiber") |
| 13 | Dunkelmodus: `#loc-status` 1,51:1 (contrast_check meldet es, endet aber gruen) | SICHT | unlesbar |
| 14 | Seed meldet wirklich an (Token mit drei Teilen + uid) — beruehrt alle 41 Pruefstaende | SICHT | eigene Scheibe, nach #2 |
