# Auftrag v25.21+ — Konkurrenz-Killer-Sprint

> **Cowork-Briefing 2026-05-12.** Nach v25.20 ist GreenScan technologisch top — jetzt müssen wir die Features bauen die uns von PlantNet/PictureThis/Seek abheben.
>
> **Status:** plant_companion_matrix HAT JETZT **41 Pairs** (31 gut, 5 schlecht, 5 neutral) → v25.19 ist entsperrt!

---

## Stand vor diesem Sprint

| Bereich | Status |
|---|---|
| Core-Features (v25.16-v25.20) | ✅ alle LIVE |
| species DB | 2'837 (wächst täglich +12 via pg_cron) |
| 11 Knowledge-Tabellen | gewachsen |
| **plant_companion_matrix** | **41 Pairs ready für v25.19** |
| Stripe-Backend | komplett, wartet auf Test-Card-Verify |
| KI-Planer | komplett (3-Foto + 2D + 3D + Chat + PDF + Auto-Sync) |
| pg_cron Auto-Wachstum | läuft täglich 03:30 UTC, 12 Topics rotierend |

---

## 🎯 v25.21+ — 7 Konkurrenz-Killer-Features

### 1. 🌱 v25.19 — Mischkultur-Score beim Add-Plant (entblockiert!)

**Was:** Beim Add-Plant-Flow checkt App das `plant_companion_matrix` mit existing `myPlants` → zeigt Score + Warnung bei Konflikten.

**UI:**
```
[Pflanze hinzufügen — Tomate]
─────────────────────────
🌱 Mischkultur-Check:
✅ Passt gut zu: Basilikum, Karotte (in deinem Garten)
⚠️  Schlecht zu: Kartoffel (gleicher Hochbeet?)
💡 Tipp: 50cm Abstand zu Kartoffel-Beet einhalten
─────────────────────────
[Trotzdem hinzufügen]   [Abbrechen]
```

**Code-Pfad:**
```js
async function gsCheckCompanions(newLat, gardenLats) {
  const res = await sbFetch('/rest/v1/plant_companion_matrix?or=(species_a_lat.eq.' + encodeURIComponent(newLat) +
    ',species_b_lat.eq.' + encodeURIComponent(newLat) + ')&select=*');
  const rels = res.data || [];
  const conflicts = rels.filter(r =>
    (r.species_a_lat === newLat ? gardenLats.includes(r.species_b_lat) : gardenLats.includes(r.species_a_lat))
    && r.relationship === 'schlecht'
  );
  // Plus 'gut' und 'neutral' analog
  return { good, neutral, bad: conflicts };
}
```

**v-Bump:** v25.21

---

### 2. 📷 Pflanzen-Tagebuch mit Foto-Verlauf-Slider

**Was:** Pro Pflanze eine Vorher-Nachher-Timeline mit Fotos. User sieht „Meine Tomate vor 2 Wochen → jetzt".

**UI:**
- Pflanzen-Detail-Modal hat neuen Tab „📸 Verlauf"
- Foto-Karten chronologisch
- Timeline-Slider: drag → Foto wechselt
- Vorher-Nachher-Compare (2 Fotos nebeneinander)
- Export als Animation (canvas-rendered MP4 oder Animated GIF)

**Backend (Cowork hat schon):** `myPlants[].diary[].photo` existiert seit v23.91. `garden_diary` Tabelle für Cloud-Sync.

**v-Bump:** v25.22

---

### 3. 🔔 Smart-Push-Notifications

**Was:** App pingt User wenn:
- Frostgefahr in nächsten 12h (basierend auf Open-Meteo + User-Standort)
- Pflanze X braucht Wasser (basierend auf Tagebuch-Last-Watered + species.water_need)
- Saisonale Aufgabe diese Woche (`garden_tasks_catalog.month_start = current_month`)
- Quiz-Streak in Gefahr (heute kein Quiz gespielt + Streak > 5)

**Stille-Zeiten:** User-Settings „Keine Push 22:00-07:00".

**Backend Pflicht (Cowork macht):**
- `push_subscriptions` Tabelle existiert
- Edge-Fn `daily-push` mit pg_cron 07:00 + 19:00 UTC
- VAPID-Keys generieren (falls noch nicht da)

**Frontend Pflicht (Code):**
- Permission-Request via `gsRequestNotifications()` (existiert)
- Settings-Toggle „Push-Notifications" + Stille-Zeit-Picker
- Service-Worker `notificationclick` → öffnet relevanten Tab

**v-Bump:** v25.23

---

### 4. 🎙️ Voice-Mode: „Hey GreenScan, was ist diese Pflanze?"

**Was:** Web Speech API → User spricht Frage → KI antwortet vorgelesen.

**3 Use-Cases:**
- „Was ist diese Pflanze?" während Scanner offen → Foto + Frage zusammen an Claude
- „Erinnere mich morgen an Tomaten gießen" → erstellt Reminder
- „Was kann ich diesen Monat ernten?" → seasonal_tips-Suche + Voice-Antwort

**Tech:** Chrome/Edge nativ, Safari hat WebKitSpeechRecognition Fallback.

**v-Bump:** v25.24

---

### 5. 📐 AR-View: „So sähe deine Monstera im Wohnzimmer aus"

**Was:** iOS-Safari + ARKit via WebXR-Polyfill → User platziert virtuelle Pflanze im Raum.

**MVP:**
- Im KI-Planer-Plan: „🪟 In meinem Raum sehen"-Button
- Öffnet AR-View mit ausgewählter Pflanze als 3D-Mesh
- User kann positionieren, skalieren
- Screenshot-Funktion „📸 Speichern"

**Tech:** WebXR Device API (iOS Safari 17+). Three.js hat ARButton-Helper.

**v-Bump:** v25.25 (advanced — kann Phase 2 nach Launch sein)

---

### 6. 👥 Community-Feed mit Verifikation durch Experten

**Was:** Vorhandener `social_posts` + Experten-Verifikation:
- User postet Foto + Frage „Was ist das?"
- Experten (User mit `is_expert=true`) können „Verifiziert"-Badge geben
- Pro Like + 1 XP für Experten
- Stripe-monetarisiert: PRO-User können Experten-Verifikation anfragen (CHF 0.50)

**Backend (Cowork prüft):**
- `social_posts` existiert
- Brauche neue Tabelle `expert_verifications` mit (post_id, expert_id, status, fee_paid)
- `is_expert`-Spalte in profiles existiert

**v-Bump:** v25.26 (groß — eigener Sprint)

---

### 7. 🌍 i18n FR + IT aktivieren (Schweizer Markt komplett)

**Was:** `gsI18n` existiert seit v23.97 mit DE/FR/IT-Bundle-Stubs. Aktivieren + Vervollständigen.

**Backend (Cowork):**
- Edge-Fn `i18n-translate` ruft Anthropic mit allen DE-Strings → liefert FR + IT bulk
- In `app_settings.i18n_translations` speichern
- Frontend lädt es beim Boot

**Frontend (Code):**
- Sprachauswahl-Picker im Settings-Tab (DE/FR/IT/GSW)
- Auto-Detection via `navigator.language`
- `data-i18n`-Attribute auf alle hardcoded Strings
- hreflang-Tags fürs SEO

**v-Bump:** v25.27 + v25.28

---

## 🤝 Cowork-Pflichten (parallel)

### Sofort (heute)
- ✅ plant_companion_matrix mit 41 Pairs gefüllt — v25.19 entsperrt
- ✅ pg_cron-Rotation um plant_companion_matrix erweitert

### Sprint A (bei v25.21-v25.23)
- VAPID-Keys generieren + in `app_settings.vapid_public_key` + `vapid_private_key` (oder Edge-Fn-Env)
- Edge-Fn `daily-push-checker` mit pg_cron 07:00 + 19:00 UTC (checkt Frost, Wasser, Saisonal, Quiz)
- `expert_verifications` Schema für v25.26

### Sprint B (bei v25.24+)
- `i18n-translate` Edge-Fn (Bulk-Übersetzung DE → FR + IT via Anthropic)
- Falls AR-View: `ar_models` Tabelle für glTF-URLs pro species

### Live-Smoke-Tests
- Nach jedem Push: Cowork verifiziert via WebFetch + DB-Read

---

## ✅ Definition of Done v25.21+

- [ ] **v25.21**: Mischkultur-Score-Modal beim Add-Plant
- [ ] **v25.22**: Foto-Verlauf-Slider im Pflanzen-Detail
- [ ] **v25.23**: Smart-Push-Notifications (4 Trigger)
- [ ] **v25.24**: Voice-Mode (3 Use-Cases)
- [ ] **v25.25**: AR-View MVP (iOS Safari)
- [ ] **v25.26**: Community-Feed mit Experten-Badge
- [ ] **v25.27/28**: i18n FR + IT live
- [ ] Pre-Release-stable Tag v26.0

---

## Reihenfolge-Empfehlung

| Priorität | Sprint | Aufwand | Konkurrenz-Schmerz |
|---|---|---|---|
| **P0** | v25.21 Mischkultur (3h) | leicht | hoch — niemand hat das so smart |
| **P0** | v25.22 Foto-Verlauf (1 Tag) | mittel | sehr hoch (PictureThis hat das, wir nicht) |
| **P0** | v25.23 Push-Notifications (1-2 Tage) | mittel | hoch (alle anderen haben es) |
| **P1** | v25.24 Voice-Mode (4h) | leicht | mittel — uniques USP |
| **P1** | v25.27 i18n FR/IT (2 Tage) | gross | hoch für Schweizer Markt |
| **P2** | v25.26 Community-Experten (3 Tage) | sehr gross | mittel (Phase 2 nach Launch) |
| **P3** | v25.25 AR-View (1 Woche) | gross | nice-to-have |

---

**Stand:** 2026-05-12 · Cowork-Briefing nach Mega-DB-Sprint
