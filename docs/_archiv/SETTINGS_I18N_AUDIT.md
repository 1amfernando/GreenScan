# Settings + i18n Voll-Audit (v28.41, 07.06.2026)

Read-only Workflow-Audit (4 parallele Agenten, 269k Tokens). Fernando: „Sprache geändert → muss app-weit greifen, 100%, keine halben Sachen."

## ✅ Was funktioniert
- **i18n-Mechanismus ist solide:** `setLang()` (Z.~10605) → `applyToDOM()` (Z.~10589) traversiert ALLE `[data-i18n]`-Elemente (376) + übersetzt synchron in Echtzeit. openModal-Hook + Boot-Hydration vorhanden.
- **Settings-Persistenz:** localStorage + Cloud (`fn_user_prefs_save`) + Cross-Tab-Events. 13 Toggles wirken app-weit 100%.

## 🔧 v28.41 gefixt
- **applyAllPrefs wandte die Sprache NICHT an** (Z.40281) → bei Cross-Device-Pull (neues `gs_lang` aus State-Blob) griff der Sprachwechsel erst nach Reload. Jetzt: `gsI18n.setLang(gs_lang)` in applyAllPrefs (idempotent, guarded).

## ⚠️ Offen — grosses Content-Projekt (NICHT in einem Pass sicher machbar)
Die i18n-Infrastruktur ist da, aber viele Bereiche tragen **hardcodierte deutsche Strings** → bleiben deutsch trotz EN/ES-Umschaltung („halbe Sachen"). ~660 Strings.

### Statische Screens ohne/kaum data-i18n (Prio nach Sichtbarkeit)
| Screen | Lücke | ~Keys |
|---|---|---|
| Scanner (2053-2180) | 0 data-i18n (Lade-/Status-Texte, Hochladen) | ~10 |
| Map (5383-5432) | Header + Layer- + Filter-Buttons | ~20 |
| Season-Kalender (2787-2817) | Titel + Filter + Legende | ~15 |
| Rezepte+Heilmittel (3721-3786) | Filter + Modal-Labels | ~60 |
| AI-Screen (2322-2340) | Vorschläge + Greeting + Placeholder | ~7 |
| Farm/BlattFänger (2691-2786) | Game-UI komplett | ~15 |
| Modals (farm-shop/listing/bid/…) | Titel+Subtitel | ~25 |

### Dynamische Render-Funktionen mit hardcodiertem DE (Prio HOCH — Kern-UI)
`gsNewPlantCard` (Wasser/Licht/Aufgaben), `openDetail` (Tags: Essbar/Giftig/Familie…), `renderMyPlants` (Empty/Status), `renderMarket` (Badges/Empty), `renderSocialFeed` (Zeit-Labels/Empty), `renderRecipes/Remedies` (Empty-States). ~280 Vorkommen.

## 📋 Empfohlener Plan (dedizierte Sprints, screen-by-screen)
1. **Pro Screen:** sichtbare Strings → `data-i18n` (statisch) bzw. `gsI18n.t('key','DE-Fallback')` (dynamisch) + Keys in die DE-Map.
2. **EN/ES automatisch** via bestehender Edge-Fn `i18n-translate` (v2, EN/ES-Lang-Map) — Bulk pro Key-Batch.
3. **Verify pro Screen:** Sprache umschalten → Screen 100% übersetzt, keine DE-Reste.
Reihenfolge nach Sichtbarkeit: dynamische Kern-Renders (Pflanzen/Markt/Community) → Scanner/Map/Season → Rezepte/Farm/Modals.

**Warum nicht in einem Pass:** 660 Strings × 3 Sprachen = riskanter Big-Bang; screen-weise mit Verify ist „pickfein sauber" statt Chaos.
