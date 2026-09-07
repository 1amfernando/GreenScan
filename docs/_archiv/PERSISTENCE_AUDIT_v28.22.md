# PERSISTENCE_AUDIT v28.22 — Block A (P0 Datenverlust) + Block C

> AUFTRAG v28.15 ist ein Mega-Sprint (A Persistence + B Marktplatz-Tutti-Full + C Home + D Tools-Edit,
> 8–12 h). Geschrieben für Repo v28.14 — wir sind bei v28.21. **Split (vom Auftrag sanktioniert):**
> **v28.22 = Block A P0-Kern + Block C.** Block B (Marktplatz-Tutti) → v28.23, Block D (Tools-Edit) → v28.24.

## Fernando-Report (P0)
- „Meine erstellten Sachen sind vorhin nicht gespeichert worden."
- „Bei Meinen Pflanzen sehe ich auch nicht das zuletzt gespeicherte Pflanze."

## Diagnose (Pre-Flight, Hard-Lesson #14 — Code gelesen statt Engine blind gebaut)
Der Speicher-Stack ist bereits mehrschichtig solide:
- **`savePlantsToStorage`** (23155): `gsStore.set` (quota-safe Wrapper, Hard-Lesson #10) + `gsPushPlantsNow` + `markDirty('plants')`. ✓
- **`savePlant`** (23693): nach `myPlants.push` → `savePlantsToStorage()` + **`renderMyPlants()`** (23817, existiert/23220) → neue Pflanze sofort sichtbar. ✓ (kein Render-Bug)
- **`gsCloudSync`** (64309): `markDirty` persistiert `gs_sync_dirty_at_<scope>` in localStorage (überlebt Reload), `_flush` re-setzt Dirty bei Fehler (`stillDirty`), `_pushBlob` setzt bei Erfolg `synced_at` + löscht `dirty_at`. ✓
- **`_shouldOverwriteLocal`** (64084): Last-Write-Wins per Timestamp (dirty_at > cloud → local behalten). ✓
- **v27.01 Empty-Clobber-Guard**: leere Cloud überschreibt nie populated local. ✓

## Identifizierte verbleibende Lücke
Der Timestamp-Vergleich versagt bei **Clock-Skew** (Client-Uhr hinter Server) ODER subtilen Boot-Races:
`_shouldOverwriteLocal` kann fälschlich „überschreiben" liefern, und der v27.01-Guard schützt nur gegen
**leere** Cloud — eine **stale, aber nicht-leere kleinere** Cloud-Liste konnte die grössere lokale
(mit der gerade erstellten Pflanze) überschreiben → genau Fernandos „letzte Pflanze weg".

## Fix v28.22 (Block A P0) — COUNT-GUARD
Plants-Pull (gsSyncUserDataOnLogin): eine **kleinere** Cloud-Liste ersetzt eine **grössere** lokale NIE,
solange lokal **ungepushte Änderungen** vorliegen (`gs_sync_dirty_at_plants` gesetzt) → stattdessen local
behalten + Cloud reparieren (Re-Push) + `renderMyPlants`. Bei sauberem lokalen Stand bleibt Cloud
autoritativ (Löschungen von anderen Geräten propagieren). Belt-and-suspenders über Timestamp+Empty-Guard.
**Logik-verifiziert** (7 Fälle): Boot-Race(dirty)→keep · echte Löschung(clean)→overwrite · Cloud-neuer→overwrite.

## Save-Pfad-Status (Kurz-Audit)
| Pfad | LS quota-safe | dirty/Cloud | Status |
|---|---|---|---|
| savePlant/savePlantsToStorage | ✓ gsStore | ✓ markDirty plants + Count-Guard | **gehärtet v28.22** |
| gsErnteAdd | ✓ | ✓ garden_harvests (v28.15) | OK |
| gsAddMarker (Funde) | ✓ (Hard-Lesson #10/#12 gefixt) | ✓ user_id (v27.01) | OK |
| Tagebuch (gsTbAdd) | ✓ | ✓ plants-Blob (v28.16-verifiziert) | OK |
| _gsSaveGardenPlanCloud | ✓ | ✓ (v28.09) + Empty-Guard | OK (Count-Guard → v28.23/24 falls nötig) |
| Marktplatz saveListing | ✓ | ✓ Edge-Fn v4 (v28.10) | OK |
| Prefs (fn_user_prefs_save) | — | ✓ Deep-Merge (v27.03) | OK |
| Doctor/Foto-Diff/Battle | ✓ | ✓ eigene Tabellen | OK |

## Block C — Home-Kategorien entfernt
`#home` „Kategorien"-Sektion (sec + cat-grid, 9 Karten) entfernt (Fernando-Wunsch). cnt-all-Setter (67146)
guarded (war ungeguarded → hätte nach Entfernen geworfen). Kategorie-Browsing bleibt via Suche/Pflanzen/Wissen.

## Bewusst DEFERRED (eigene Sprints, Auftrag-sanktioniert)
- **Block A-Voll** (gsPersist-Universal-Engine + per-Domain-Snapshots + 60s-Auto-Save-Cycle + Header-Status-Indikator):
  Die bestehende gsCloudSync-Engine + Count-Guard decken den realen Datenverlust ab; die grosse Engine-Umschreibung
  ist hoch-invasiv und nicht nötig zur Behebung des P0. Falls Fernando den Header-Sync-Status + 60s-Cycle explizit
  will → eigener Take.
- **Block B Marktplatz-Tutti-Full** (Lifecycle-State-Machine, audit_log, E-Mail+In-App+Push-Notify-Edge-Fn,
  Admin-Archiv, Demo-Hard-Delete) → **v28.23** (gross: 2 Migrationen, 8 RPCs, Edge-Fn, E-Mail-Provider-Klärung).
- **Block D Tools-Edit-Mode** (soft-delete, tool_versions, Edit-Mode in Garten-Planer/Doktor/Foto-Diff) → **v28.24**.
