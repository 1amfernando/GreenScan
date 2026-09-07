# Echtzeit-Sync + Persistenz-Voll-Audit — v28.32 (06.06.2026)

Auftrag Fernando: „auditiere ob alles in Echtzeit aktualisiert und synchronisiert wird; alles was zusammengehört perfekt + intelligent verdrahtet; gespeicherte/erstellte Sachen müssen richtig gespeichert werden."

## Methode
Das beim Marktplatz gefundene Bug-Muster (In-Memory-Cache `window._gsX` wird nach Cloud-Pull NICHT invalidiert → `render*()` zeigt Stale-Daten bis Reload) systematisch durch alle Daten-Domänen gejagt. Pro Domäne geprüft: **Save→Cloud** · **Cloud→In-Memory+Render** · **Cross-Device**.

## Ergebnis pro Domäne

| Domäne | Save→Cloud | Cloud→Memory+Render | Verdict |
|---|---|---|---|
| **Marktplatz** | saveListing→Edge-Fn marketplace-publish | ❌→✅ **war DER Bug**: loadMarketFromSupabase schrieb nur LS, nie `window._gsMarket`; saveListing rief nur renderMarket() | ✅ **FIXED v28.32** (B-017): Memory+LS synchron + frischer Pull nach Publish |
| **Pflanzen (myPlants)** | savePlant→LS+markDirty→Cloud-Blob (v28.22 Count-Guard) | Pull reassigned myPlants direkt + `renderMyPlants()` an allen Mutations-Stellen | ✅ korrekt + gehärtet |
| **Garten (Ernten/Tagebuch/Gärten/Pflanzungen)** | gsErnteAdd/pushDiary→Cloud-Queue | pullAll: LS schreiben + `_gsErnteLog=null`/`_gsTagebuch=null` invalidieren + `gardens`/`plantings` reassign + `renderGardenList()`+`gsUpdateGartenWidgets()` | ✅ **Gold-Standard** (Vorbild für alle anderen) |
| **Funde (gsMapFinds)** | gsAddMarker→LS+Cloud (v26.84/v27.01 Fixes) | `gsMapFinds.list()` cloud-preferred; Pull leert `_gsMarkerLayers` + zeichnet Marker neu | ✅ read-fresh |
| **Sammlungen** | REST POST mit RLS | bei jedem Öffnen frisch via sbFetch (kein Lazy-Cache) | ✅ read-fresh |
| **Quiz-Rangliste** | fn_quiz_leaderboard_upsert nach jedem Quiz | fn_quiz_leaderboard_top sortiert LIVE bei jedem Abruf | ✅ kontinuierlich aktuell |
| **Settings/Prefs** | fn_user_prefs_save jsonb deep-merge (v27.03) | applyAllPrefs beim Pull | ✅ (i18n-Propagation = eigener Audit, Task #72) |
| **Bewertungen (Marktplatz-Ratings)** | nur localStorage (`gs_market_ratings`) | nur LS | ⚠️ **Feature-Lücke**: NICHT cross-device (kein Cloud-Table). Low-Prio, kein Datenverlust |

## Sync-Trigger (Cross-Device)
- **Login/Boot:** voller Pull (gsCloudSync + GardenSync.pullAll).
- **Tab-Switch:** Domänen-spezifisch (initMarket→loadMarketFromSupabase, initGarden, etc.).
- **Push-Queue:** Flush alle 5 Min (Z.53360) + debounced bei jeder Mutation.
- **Echte WS-Realtime:** nur Marktplatz-Chat (v28.17) — bewusst, dort nötig.

→ Cross-Device-Updates erscheinen beim nächsten App-Öffnen/Tab-Wechsel (außer Chat = sofort). Für eine PWA dieser Art korrekt dimensioniert.

## Fazit
**Architektur ist solide.** Das GardenSync-Muster (LS + Memory-Invalidierung + Re-Render) ist das richtige Vorbild. Der **Marktplatz war die einzige echte Ausnahme** (Stale-Memory-Cache) — jetzt gefixt (v28.32). Eine Feature-Lücke (Ratings nur lokal) als Low-Prio notiert.

## Offene Folge-Items
- ⚠️ Bewertungen cloud-fähig machen (`marketplace_ratings`-Table + Sync) — Low-Prio.
- Tutti-Lifecycle A.2 (sold/archived für Fremde unsichtbar) — RLS+View, separat.
- Settings/i18n-Voll-Audit (Task #72).
