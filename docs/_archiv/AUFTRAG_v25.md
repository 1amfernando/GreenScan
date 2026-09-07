# 50 · Auftrag an Claude Code — Pre-Release-Großupdate v25.x

> **Ziel:** GreenScan vom „guten Prototyp" zum **Konkurrenz-Killer** machen. Pre-Release in 2 Wochen — diese 4 Themen sind Pflicht.
>
> **Stil:** keine Halbsachen. Wenn nicht klar ob es geht — bauen + Feature-Flag, nicht erklären warum nicht.
>
> **Wann updaten:** wenn neue Themen dazukommen oder Code's Antworten dokumentiert sind.

---

## Stand vor diesem Auftrag (2026-05-06)

- **LIVE:** v24.51 (sw.js + index.html). 7/7 node-clean. Auth-Triple gsStore migriert.
- **Backend:** Stripe Test-Mode komplett aktiv (3 Products, 5 Prices, Webhook live, past_due-Migration mit 7d-Grace deployed + 4/4 Tests PASS).
- **Geschützte Files** (vom UPDATE.command v2 nicht überschrieben): `supabase/migrations/`, `supabase/functions/`, `.github/workflows/`, alle `*.md`.
- **Cowork-Backend-Status:** Stripe-Bug (metadata.lookup_key) vorhin gefixt.

## Aktuelle Bugs (von Fernando 2026-05-06 gemeldet)

1. **Auth-Flow-Bug:** „Bei der Anmeldung kommt einmal die Anmelde Seite und dann die Registrierseite nach dem Anmelden." → Login-Erfolg-Pfad zeigt fälschlich Register statt Home. Vermutlich `gsOnboardingHide()` versteckt nur eine Sub-View (`onb-start` / `onb-login` / `onb-register`) inkonsistent, oder Race-Condition in `_onbShowView()`.

2. **Stripe gefixt** (Cowork-Verify): Frontend Z.9002 `p.metadata.lookup_key` funktionierte nicht weil Schema `lookup_key` als Top-Level-Spalte hatte. Cowork hat `metadata` mit `lookup_key` befüllt → Frontend findet wieder. Aber: **Frontend sollte `select=…,lookup_key,metadata,…` abfragen** und beide Wege akzeptieren (`p.lookup_key || p.metadata?.lookup_key`).

---

## 🎯 v25.0 — 4 Mega-Themen

### 1. PWA-Install-Erlebnis — „echte App" statt „Webseite"

**Goal:** User sollen GreenScan als native App empfinden — nicht erkennen dass es eine PWA ist.

**Konkret:**
- **Install-Prompt-Flow erste Klasse**: Wenn User nicht installiert ist (PWA-Detection via `display-mode`), prominenter Banner „📲 Als App installieren — schneller, offline, mit Push" mit Install-Anleitung **pro Plattform**:
  - **iOS Safari**: animierte 3-Step-Anleitung mit Screenshot-Mockups (Teilen-Icon → „Zum Home-Bildschirm" → „Hinzufügen") — nutze evtl. `gsConfirmModal` als Container
  - **Android Chrome**: `beforeinstallprompt`-Event abfangen, dann „Install"-Button im Banner zeigen
  - **Desktop Chrome/Edge**: dito
- **Splash-Screen-Polish**: 13 PWA-Splash-Größen (Cowork hat 1320×2868 + 1206×2622 v2 generiert) + animierte Loading-Bar während App-Init.
- **App-Icon-Maskable** schon da — verifizieren dass auf Android Adaptive-Icon-System sauber funktioniert.
- **Keine Browser-UI** im Standalone-Mode: `display: 'standalone'` in manifest.json (schon da). Plus: hide URL-Bar-Hinweise.
- **Status-Bar-Color** (iOS): theme-color match mit Top-Nav-Hintergrund (passt aktuell, verifizieren).
- **App-Name** im Home-Screen kurz: `short_name: 'GreenScan'` (passt). Lange Name nur in Install-UI.
- **Shortcuts polishen** (iOS Long-Press / Android): aktuelle 4 Shortcuts (Scanner, Garten, Quiz, Wissen) mit besseren Icons (Cowork kann Adobe-MCPs nutzen).
- **Web-Share-Target** validieren: Bilder von WhatsApp/Photos teilen → öffnet Scanner mit dem Foto. Schon da, aber Live-Test fehlt.
- **App-Store-Wrapper-Vorbereitung** (Phase 2 nach Launch): PWABuilder + Capacitor — manifest + service-worker müssen Store-Lint bestehen.

**Deliverable:** v25.0 mit prominentem Install-Banner, Plattform-spezifischer Anleitung, sichtbarem Vorteil-Hinweis.

---

### 2. Auth-Flow professionalisieren (Login → Home, Logout → sauber)

**Bug-Fix:**
- **Login-Bug**: Nach erfolgreichem Login muss Home-Tab kommen, nicht Register. Root-Cause-Analyse + Fix.
- **gsOnboardingHide()** muss alle 3 Sub-Views (`onb-start`, `onb-login`, `onb-register`) gemeinsam verstecken UND `gs-onboarding`-Wrapper hiden. Idempotent.
- **_onbShowView()** sicher machen — nicht wieder einblenden wenn kein Onboarding aktiv ist.

**Plus Polish:**
- **Login-Screen sauberer**: Logo oben, Welcome-Text, dann Form. Dezenter „Noch kein Account? Registrieren →"-Link unten.
- **Register-Screen**: Step-1 (Email + PW) → Step-2 (Display-Name + optional Bild) → Step-3 (Welcome + Tour-Start). Mehrstufig statt 1 Big-Form.
- **Vergessen-Passwort-Flow**: aktueller Pfad funktioniert (Magic-Link) aber UI prominenter. „🔑 Passwort vergessen?"-Link unter Login-Form, klick → Magic-Link-Form.
- **Logout-Flow**:
  - Bestätigungs-Modal („Sicher abmelden? Lokale Daten bleiben erhalten")
  - Beim Bestätigen: Token weg + Onboarding zeigen (mit Welcome-Back-Hinweis)
  - Plus: explizit Cloud-Sync triggern bevor Logout (damit User nichts verliert)
- **„Continue as Guest"-Button** im Onboarding, prominent — User kann erst probieren bevor Registrierung.
- **Email-Confirm-Redirect** sauber: nach Klick auf Bestätigungs-Link in der Mail muss App auf Home-Tab zeigen + grüne Erfolgs-Toast „✅ Email bestätigt!".
- **Profile-Setup-Flow nach Confirm**: Wenn `email_confirmed=1` URL-Param da ist, optional Display-Name + Avatar abfragen.
- **Session-Recovery**: Wenn Token expired aber Refresh-Token noch gültig, automatisch Re-Login ohne dass User es merkt.

**Deliverable:** v25.0 mit Login-Bug-Fix + 3-Step-Register-Flow + sauberem Logout-Modal + verbessertem Vergessen-Passwort-UI.

---

### 3. KI-Garten-Planer mit Foto-Scan + besseren Plänen

**Idee:** Wie eine PDF-Scanner-App — User fotografiert Garten / Beet / Wand → KI analysiert räumliche Lage, Licht-Verhältnisse, vorhandene Pflanzen → generiert besseren Pflanz-Plan.

**Konkret:**
- **Neuer Flow im Garten-Tab**: „📸 Garten scannen" Button neben „➕ Pflanze hinzufügen"
- **Scan-Modus**:
  - Kamera öffnen mit Frame-Hilfe („Halte Kamera horizontal über das Beet")
  - Optional Multi-Foto (3 Winkel) für 360°-Kontext
  - Bilder werden komprimiert + zu base64 gewandelt
- **KI-Analyse via callVisionAI mit `brain:'gaertner'`**:
  - System-Prompt: „Du bist Gartenplaner. Analysiere das Foto und identifiziere: Größe (geschätzt in m²), Boden-Typ (Erde/Mulch/Steine), Licht (Vollsonne/Halbschatten/Schatten), vorhandene Pflanzen (mit Namen + Zustand), Raum-Layout. Gib JSON zurück: `{size_m2, soil_type, light_level, existing_plants[{name, lat, condition}], layout_description, recommended_plants[{name, lat, reason, position_x_y}], notes}`."
  - Output validieren + parsen
- **Plan-Renderer**: Visuelle Garten-Skizze mit:
  - Top-Down-Mock-View (SVG) mit existing/recommended Plants als Punkte
  - Klickbare Pflanzen-Karten mit Pflege-Tipps (von gsBrain)
  - Auto-Zuordnung zu Saekalender (was wann säen)
  - Export als PDF (pdf.js schon im Stack)
  - Speichern als „Garten-Plan #1" in user_gardens.data.plans[]
- **Plan-Iteration**: User kann Plan editieren („Ich will keinen Bambus") → KI generiert neue Variante
- **Optional Phase 2**: Multi-Step-Plan über Saison (Spring/Summer/Fall/Winter)

**Schema-Update (Cowork macht das):**
```sql
ALTER TABLE user_gardens
ADD COLUMN IF NOT EXISTS scan_history jsonb DEFAULT '[]'::jsonb;

-- Storage-Bucket für Garten-Scans
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('garden-scans', 'garden-scans', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
```

**Deliverable:** v25.0 mit „📸 Garten scannen"-Flow, Multi-Foto-Capture, Vision-AI-Analyse, Top-Down-Plan-Visualisierung.

---

### 4. Konkurrenz-Killer-Features (gegen PlantNet, PictureThis, Seek, PlantIn, etc.)

**Recherche-Pflicht:** Vor dem Bauen → 30 Min Konkurrenz-Apps in App-Store anschauen, Top-3 Features die uns fehlen identifizieren.

**Wahrscheinliche Lücken:**

a) **Krankheits-/Schädlings-Erkennung mit Bild + Behandlungs-Vorschlag**
   - User fotografiert kranke Pflanze → KI: „Vermutlich Echter Mehltau (Erysiphe). Spritze mit Backpulver 1:9 in Wasser, 3× wöchentlich morgens." Plus: Link zu organischen Bekämpfungs-Mitteln + Prevent-Tipps.

b) **Pflanzen-Tagebuch mit Foto-Verlauf**
   - Jede Pflanze hat eine Timeline mit Fotos über Wochen/Monate. Vorher/Nachher-Slider. Export als PDF.

c) **Community-Feed mit verifizierten Experten**
   - User kann Foto+Frage posten, Experten antworten. Stripe-monetarisiert (Pro-User können fragen, Experten verdienen).

d) **AR-View: Pflanze im Raum platzieren** (iOS only, ARKit via WebXR)
   - „So sähe deine Monstera im Wohnzimmer aus" — Vorschau-Augmented-Reality.

e) **Notification-Smartness**:
   - Push wenn morgens Frostgefahr (basierend auf Open-Meteo + User-Standort)
   - Push wenn Pflanze X bald Wasser braucht (basierend auf Tagebuch-Last-Watered)
   - Stille während Schlafzeiten (User-Settings)

f) **Voice-Mode**: „Hey GreenScan, was ist diese Pflanze?" → Voice-Capture → KI-Antwort vorgelesen
   - Web Speech API (Chrome only, aber bei Safari nice-to-have)

g) **Mehrsprachig**: Aktuell nur Deutsch + GSW-Mundart. Französisch + Italienisch bereits in i18n-Infrastruktur (v23.97 Sprint 9). Aktivieren + Übersetzungen vervollständigen.

h) **PRO-Mode-Tools**: Boden-pH-Tracker, Wetter-7d-Forecast pro Garten, Pflanzen-Rotation-Empfehlungen pro Saison.

**Deliverable:** Recherche-Doc + Top-3-Lücken implementiert in v25.0/v25.1.

---

## 🤝 Was Cowork parallel macht (während Code an v25.x arbeitet)

Cowork hat:
- Supabase-MCP (Migrations, Edge-Fns, RPCs, RLS)
- Cloudflare-MCP (Pages-Status, Cache-Purge, Workers, KV)
- Chrome-MCP (Live-Test, Console-Inspect)
- Adobe-MCPs (Splash-PNGs, Social-Variations, Photo-Retouch)
- Skills (docx, pdf, pptx) für Docs

**Cowork-Tasks (parallel zu Code):**
1. **Backend für KI-Planer**: Storage-Bucket `garden-scans` anlegen + RLS, Edge-Fn `garden-scan-analyze` (Vision-AI-Call mit Prompt + Response-Validation), Schema-Migration für `user_gardens.scan_history`.
2. **Krankheits-Erkennung Backend**: ähnlicher Edge-Fn-Pfad wie Garten-Scan.
3. **Push-Notifications-Setup**: VAPID-Keys generieren + speichern, Edge-Fn `daily-push` für Frost/Wetter-Reminder mit pg_cron.
4. **i18n-Übersetzungen**: aktuelle deutsche Strings extrahieren, FR + IT via GPT-Übersetzung, JSON-Files generieren.
5. **Splash-PNGs für noch fehlende Größen** (iPhone 15/16 + iPads via Adobe-MCPs).
6. **Konkurrenz-Recherche** (Cowork via WebSearch + WebFetch): PlantNet, PictureThis, Seek, PlantIn — Top-Features extrahieren, Doc als `51_KONKURRENZ_RECHERCHE.md`.
7. **Live-Smoke-Test** nach jedem Code-Push via Chrome-MCP: Auth-Flow, Stripe-Checkout, Scanner-Flow, Garten-Scan-Flow.

---

## 🛡️ Pflicht-Disziplin für Code

Wegen der UPDATE.command-v1-Erfahrung (v24.52 + v24.53 wurden überschrieben):

1. **NACH JEDEM COMMIT direkt pushen** (`git push origin main`) — nicht stapeln. Sonst Risiko bei nächstem UPDATE.command.
2. **Vor jedem Edit `git pull --rebase origin main`** — sonst Konflikt mit Cowork's Backend-Files.
3. **Cowork's Files niemals überschreiben:**
   - `supabase/migrations/20260504_*` (past_due-Migration)
   - `supabase/functions/stripe-bootstrap/`, `stripe-setup-webhook/`, `stripe-webhook/`
   - `.github/workflows/weekly-cleanup.yml`
4. **STATUS.md im Repo bei jedem Commit updaten** mit „Recently shipped" + „Wartet auf Cowork/Fernando" sections.
5. **Für jede Mega-Feature einen separaten Branch** (`claude/v25-pwa-install`, `claude/v25-auth-fix`, `claude/v25-garden-scan`) — falls was schiefgeht, nicht der ganze v25.0 Branch im Eimer.

---

## 📋 Empfohlene Reihenfolge

| Sprint | Was | Wer | Dauer |
|---|---|---|---|
| Sprint A (jetzt) | Auth-Flow-Fix (v25.0) | Code | 2-4h |
| Sprint A | Stripe-Frontend `lookup_key` Fallback | Code | 30min |
| Sprint A | Konkurrenz-Recherche-Doc | Cowork | 1h |
| Sprint A | Backend-Setup KI-Garten-Planer (Bucket + Schema + Edge-Fn-Stub) | Cowork | 2h |
| Sprint B (~3 Tage) | PWA-Install-Erlebnis + Plattform-Anleitungen | Code | 1 Tag |
| Sprint B | KI-Planer Frontend (Scan + Vision-Analyse + Plan-Render) | Code | 2 Tage |
| Sprint C (~Woche 2) | Top-3 Konkurrenz-Lücken + i18n FR/IT | Code | 3-4 Tage |
| Sprint C | Push-Notifications Setup + Edge-Fn | Cowork | 1 Tag |
| Pre-Release | Live-Tests, Stripe-E2E, Echt-Geräte (iOS+Android) | Fernando | 2-3 Tage |

---

## 🎯 Definition of Done für v25.0

- [ ] LIVE auf green-scan.ch
- [ ] Stripe-Checkout durchläuft mit Test-Card 4242 (Cowork-DB-Verify)
- [ ] Login-Bug behoben (Login → Home, nicht Register)
- [ ] PWA-Install funktioniert auf iOS Safari + Android Chrome
- [ ] „📸 Garten scannen" Button im Garten-Tab vorhanden + funktional
- [ ] 7/7 Inline-Scripts node --check
- [ ] STATUS.md updated
- [ ] CHANGELOG-Eintrag in GS_RELEASES + 02_CHANGELOG.md (Memory)
- [ ] sw.js v25.0 + index.html v25.0 + _headers v25.0 + GS_RELEASES gebumpt
- [ ] Echt-Geräte-Tests (Fernando) bestanden

---

## ⚠️ Wenn was unklar ist

Code-Antwort-Format an Fernando:
- **Was ich gemacht habe** (Liste)
- **Was geblockt ist** (mit konkreter Ursache + Vorschlag wie unblocken)
- **Was als nächstes** (klare A/B/C-Optionen)

Niemals stillschweigend abbrechen. Niemals raten. Niemals Entscheidungen autonom treffen die irreversibel sind (DB-Drops, Force-Push, Prod-Stripe-Switch).

---

**Stand:** 2026-05-06 · Cowork erstellt · Auftrag liegt im Workspace-Root + ist Code-frei zugänglich via repo-clone
