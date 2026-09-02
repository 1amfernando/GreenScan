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

### Stufe 2 — Mehr aus dem Foto, bevor die KI ran muss

- **EXIF lesen**: Aufnahmedatum und GPS *aus dem Bild*. Heute nimmt ein
  Galeriefoto den heutigen Standort — ein Urlaubsfoto bekommt so den falschen
  Ort und die falsche Jahreszeit in den Prompt.
- Mehrere Fotos automatisch anbieten, wenn die Prüfung dünn ausfällt.

### Stufe 3 — Gegenprobe, aber nur wo es zählt

Wenn die Art als **essbar** gilt UND eine Alternative Giftstufe ≥ 3 hat: ein
zweiter, unabhängiger Aufruf mit umgekehrtem Auftrag („widerlege diese
Bestimmung"). Kostet ein zusätzliches Kontingent — deshalb **nur im
gefährlichen Fall**, nie als Regel.

## 4 · Was bewusst NICHT gebaut wird

- **Keine eigene Bilderkennung.** Ohne Trainingsdaten wäre das geraten.
- **Keine erfundene Genauigkeit.** Wenn die Prüfung nichts sagen kann, sagt sie
  das — sie erfindet keinen Haken.
- **Keine Merkmale, die nicht aus der Antwort stammen.** Ein Marker auf dem Foto,
  den niemand berechnet hat, zeigt überzeugend auf die falsche Stelle (dieselbe
  Falle wie beim Garten-Zwilling, CLAUDE.md §4a.1).
