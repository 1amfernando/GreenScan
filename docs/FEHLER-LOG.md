# Fehler-Log — historische Bugs und was daraus zu lernen war

> Bis v31.50 lag diese Liste als `const GS_ERROR_LOG` **in `index.html`** — 6,8 KB,
> die jedes Telefon bei jedem Kaltstart mitgeparst hat, für eine Dokumentation, die
> in der App niemand sehen konnte. Die einzige Leserin war `gsLookupError(stichwort)`,
> eine Funktion ohne einen einzigen Aufrufer. Gefunden mit `scripts/wiring_check.js`.

> Hier ist sie auffindbar, durchsuchbar und kostet keinen Nutzer etwas.

| Feld | Wert |
|---|---|
| Fassung | `1.0` |
| zuletzt gepflegt | 2026-03-27 |
| Einträge | 8 |

---

## ERR-001 · Script error: Service Worker iOS Crash

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v16 |

**Symptom** — App friert nach dem Laden ein. Fehler: async is not defined.

**Ursache** — Service Worker Blob-URL mit async-Syntax crasht auf iOS Safari.

**Behebung** — Service Worker vollständig entfernen. iOS unterstützt keine Blob-URL SW.

**Vorbeugung** — Keinen Service Worker mit Blob URLs verwenden. PWA-Offline nur via normaler SW-Registration mit separater sw.js Datei.

---

## ERR-002 · TypeError: Cannot read properties of undefined (reading "id") - Menü-Suche

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v16 |

**Symptom** — Infokarten aus der Menü-Suche öffnen nicht. Fehler: TypeError: Cannot read properties of undefined (reading "id").

**Ursache** — Menü-Suche generierte onclick="openDetail(W001)" OHNE Anführungszeichen. Browser interpretiert W001 als JS-Variable → undefined → .id crash.

**Behebung** — Anführungszeichen hinzufügen — ID muss als String uebergeben werden, nicht als Variable.

**Vorbeugung** — Bei dynamisch generierten onclick-Attributen: ID-Werte IMMER in Anführungszeichen einschliessen. Test: Generierte HTML prüfen ob ID als String oder Variable interpretiert wird.

---

## ERR-003 · TypeError: Cannot read properties of undefined (reading "id") - Duplikate IDs

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v16 |

**Symptom** — Viele Infokarten öffnen nicht. Fehler wie ERR-002.

**Ursache** — Beim Hinzufügen neuer Arten-Batches wurden einige IDs (z.B. W051-W200, K031-K130) doppelt eingefügt. DB.find() gibt das erste Vorkommen zurück, aber die Rendering-Logik kann inkonsistent sein.

**Behebung** — DB deduplizieren: Alle Einträge mit identischen IDs entfernen, nur erstes Vorkommen behalten. Code: const seen=new Set(); const cleanDB=DB.filter(e=>{ if(seen.has(e.id))return false; seen.add(e.id); return true; });

**Vorbeugung** — Vor jedem Einfügen neuer Arten prüfen: DB IDs auf Duplikate scannen. Neue IDs mit höchster vorhandener Nummer + 1 vergeben. Batch-Validierung: node --check UND Duplikat-Check.

---

## ERR-004 · SyntaxError: Unexpected token ] - Doppeltes Array-Ende

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v16 |

**Symptom** — Gesamte App lädt nicht. SyntaxError im Browser.

**Ursache** — Beim Einfügen neuer DB-Einträge wurde ein doppeltes ]
]; am Ende der DB erzeugt.

**Behebung** — Suche und ersetze: "
]
];" durch "
];" in der DB-Section.

**Vorbeugung** — Nach jedem DB-Edit: node --check ausführen. DB-Ende immer mit genau einem ]
]; abschliessen.

---

## ERR-005 · Alle Screens blank - display:none Bug

| | |
|---|---|
| **Datum** | 2026-03-26 |
| **Status** | FIXED |
| **betroffen** | v15, v16 |

**Symptom** — Nach Code-Änderungen werden alle Screens leer/blank.

**Ursache** — CSS-Regel  überschreibt inline styles.

**Behebung** — .screen { display:none; } OHNE !important. Aktive Screens: .screen.active { display:block !important }

**Vorbeugung** — NIEMALS display:none !important auf .screen setzen. switchTab() setzt cssText mit !important für aktive Screens.

---

## ERR-006 · Karte/Map zeigt kein Internet obwohl online

| | |
|---|---|
| **Datum** | 2026-03-26 |
| **Status** | FIXED |
| **betroffen** | v15, v16 |

**Symptom** — Map-Screen zeigt Kein Internet Fehler, obwohl Leaflet im Head ist.

**Ursache** — Leaflet lazy-loaded statt im <head> preloaded. Bei Tab-Switch nicht verfügbar.

**Behebung** — Leaflet CSS+JS immer im <head> preloaden. Nie lazy-loaden.

**Vorbeugung** — Leaflet im <head>: <link rel=stylesheet href=leaflet.css> und <script src=leaflet.js> vor dem Main-Script.

---

## ERR-007 · buildPlantCard crash - undefined.id

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v16 |

**Symptom** — Mein Garten Screen lädt nicht, Fehler: Cannot read properties of undefined (reading "id").

**Ursache** — buildPlantCard(p) wird mit undefined aufgerufen wenn myPlants korrupte Einträge enthält.

**Behebung** — Guard am Anfang von buildPlantCard: if (!p || !p.id) return "";

**Vorbeugung** — Alle render-Funktionen die ein Objekt erwarten müssen Guards haben: if(!obj || !obj.id) return "".

---

## ERR-008 · Navigationsleiste (Tab-Bar) verschwunden / unsichtbar

| | |
|---|---|
| **Datum** | 2026-03-27 |
| **Status** | FIXED |
| **betroffen** | v19 |

**Symptom** — Die untere Tab-Bar (Home, Suche, Scanner, Pflanzen, Menü) ist nicht mehr sichtbar und kann nicht mehr benutzt werden.

**Ursache** — Beim Einbauen des neuen screen-more Inhalts (Über-Seite) fehlte ein schliessendes </div>. Dadurch blieb <div id="screen-more"> dauerhaft offen. Alle nachfolgenden Screens (screen-garden, screen-farm, screen-map etc.) wurden als Kinder von screen-more behandelt. Da screen-more overflow:scroll und position:absolute hat, wurde die Tab-Bar (position:fixed) durch den verschachtelten Stacking-Context auf iOS Safari abgeschnitten und unsichtbar.

**Behebung** — HTML-Balance prüfen

**Vorbeugung** — Nach JEDER HTML-Änderung an einem Screen: 1) Div-Balance prüfen (opens == closes). 2) Div-Stack vor Tab-Bar prüfen (muss 0 sein). 3) Regel: Neuer Screen-Inhalt immer in einem eigenen Branch testen bevor er in Produktion geht. 4) Bei jedem screen-Umbau: gsRunSplash + switchTab testen.

---
