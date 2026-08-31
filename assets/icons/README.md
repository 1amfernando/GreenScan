# GreenScan Icon-Set

Eigenes Strich-Icon-Set für GreenScan. 23 Symbole, zusammen ~7 KB.

## Warum eigene Icons statt Emoji

Die App nutzte bisher durchgehend Emoji (🌱 🔔 📷). Das hat drei Nachteile:

- **Jede Plattform zeichnet sie anders.** Ein 🍄 sieht auf iOS, Android und
  Windows unterschiedlich aus — die App wirkt dadurch zusammengesetzt statt
  gestaltet.
- **Sie lassen sich nicht einfärben.** Im Dunkelmodus bleiben sie bunt, auch
  wenn alles andere sich anpasst.
- **Sie sind nicht bedeutungstragend für Screenreader** — ein Emoji im Text
  wird vorgelesen, oft mit einem Namen, der nichts mit der Funktion zu tun hat.

## Aufbau

| Eigenschaft | Wert |
|---|---|
| Raster | 24 × 24 |
| Strichstärke | 1.75 |
| Enden / Ecken | rund |
| Farbe | `currentColor` — erbt die Textfarbe |
| Füllung | keine (außer wenigen Punkten, z. B. Pilzflecken) |

**`currentColor` ist der wichtigste Teil.** Die Icons nehmen die Farbe des
umgebenden Textes an. Damit stimmen sie im Hellmodus, im Dunkelmodus und in
jedem Akzent-Thema automatisch — ohne eine einzige zusätzliche Regel.

## Verwendung

Im Code über den Helfer (liefert Inline-SVG, kein zusätzlicher Netz-Abruf):

```js
gsIcon('leaf')            // Standardgröße 20
gsIcon('bell', 24)        // eigene Größe
gsIcon('heart', 18, 'Gefällt mir')   // mit Beschriftung für Screenreader
```

Ohne Beschriftung wird das Icon als rein dekorativ markiert
(`aria-hidden="true"`) — richtig, wenn daneben ohnehin Text steht.

Direkt in HTML:

```html
<img src="assets/icons/leaf.svg" alt="" width="20" height="20">
```

Das erbt allerdings **nicht** die Textfarbe — für gefärbte Icons den Helfer
benutzen.

## Bestand

`bell` · `book` · `calendar` · `chat` · `community` · `garden` · `harvest` ·
`heart` · `herb` · `leaf` · `market` · `mushroom` · `pin` · `profile` ·
`scan` · `search` · `settings` · `share` · `streak` · `sun` · `track` ·
`tree` · `water`

`preview.html` im selben Ordner zeigt alle auf hellem und dunklem Grund.

## Herkunft

Für GreenScan gezeichnet (v31.10). Keine fremden Vorlagen, keine
Fremdlizenzen — sie gehören zum Projekt und können frei geändert werden.

## Ändern

Die `.svg`-Dateien sind die Quelle. Wer eines anpasst: Raster, Strichstärke
und `currentColor` beibehalten, sonst fällt es aus der Reihe. Nach einer
Änderung `preview.html` öffnen und gegen die anderen halten.
