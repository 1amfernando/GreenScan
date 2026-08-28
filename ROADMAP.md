# ROADMAP.md — Meilensteine für GreenScan

> **Priorisierung**: P0 = Blocker · P1 = große Wirkung kurzfristig ·
> P2 = Wettbewerbsvorteil · P3 = nice to have.
> Kompagnon: `STATUS.md` (operativer Snapshot) · `CLAUDE.md` (Onboarding) ·
> `BACKEND_FRONTEND_MAP_v26.76.md` (Architektur-Detailkarte).

**Stand:** v30.79 · App **live** auf green-scan.ch · released seit v26.0.

---

## ✅ Geschafft (grober Überblick)

Die App ist ein reifes, live-laufendes Produkt. Erreicht u.a.:

- **KI-Scanner** — Claude Vision, autonome Klassifikation (Pflanze/Pilz/Baum),
  Multi-Shot bei niedriger Konfidenz, voller Steckbrief auch für Arten (noch)
  nicht in der DB.
- **Pilz-Scanner** (sicherheitskritisch) — roter Vollbild-Warnscreen bei
  tödlich/giftig, Tox-Info-145-Notruf, VAPKO-Region-Lookup.
- **Pflanzendoktor / Schädlings-Scanner** — eigene Edge-Functions
  (`plant-doctor-diagnose`, `pest-identify`, `garden-scan-analyze`).
- **KI-Garten-Planer** — 5 Plan-Intents (Selbstversorgung / Bienen / Permakultur
  / Container / Vogel-Garten), Forest-Garden-7-Schichten-Designer, Balkon-Wizard.
- **Wissen** — 11 Sub-Tabs (u.a. Alpen, Vögel, Garten-Besucher), Bulk-Gen-Pipeline
  über `knowledge-bulk-gen`.
- **Home-Widgets** — Bauernregel · Saison-Pilze · Wetter-Alert (MeteoSchweiz).
- **Marketplace** — Stripe-Connect für Experten, Bio-Filter.
- **Abos** — Stripe Live-Mode (Trial → Pro), server-seitige Quota, Token-Kosten-
  Dashboard (Admin) mit Live-Logging pro Edge-Fn.
- **i18n** — DE/EN/FR/IT/ES live (je ~2'050 Keys), Direct-PostgREST-Pull aus
  `i18n_translations`, 24h-TTL, Boot-Auto-Build für nicht-DE-User.
  *Korrektur v30.86: GSW (Schweizerdeutsch) wurde hier fälschlich als „live"
  geführt — es existieren 0 Übersetzungen, und die Sprachauswahl bietet es
  nicht an. Als optionales Vorhaben unter P3 geführt.*
- **Backend-Härtung** — 117 Tabellen alle RLS, 0 Security-ERROR-Advisors,
  SECURITY-DEFINER-Views auf `security_invoker`, admin-only Functions REVOKE.
- **PWA** — Share-Target, Shortcuts, Screenshots, iOS-Standalone, Offline-Cache.

Detaillierte Sprint-Historie: `STATUS.md` Sektion 0 (Routine-Einträge).

---

## 🔥 P0 — Blocker

*Keine offen.* Der v26.51-Self-Audit hat alle Security-ERROR eliminiert.

---

## 🚀 P1 — Owner-Aktionen (kein Code)

| # | Punkt | Wer |
|---|---|---|
| P1-1 | **Leaked-Password-Protection** aktivieren (Supabase → Auth → Settings) | Owner, 1 Klick |
| P1-2 | **Stripe Live-Mode** End-to-End verifizieren (Checkout → Webhook `stripe_events` → Tier-Wechsel → Portal → Cancel) | Owner |
| P1-3 | `seasonal_highlights` Knowledge-Tabelle unter Threshold (36/40) — Topic in `knowledge-bulk-gen` ergänzen ODER Seed-Quelle | Backend/Cowork |

---

## 🎯 P2 — Wettbewerbsvorteil

| # | Punkt | Wirkung |
|---|---|---|
| P2-1 | **DB-Waves fortsetzen** — neue Knowledge-Domänen sofern sinnvoll (DB-Wave-15+) | Breitere Abdeckung |
| P2-2 | **Verbleibende `alert()` → `gsToast`** in nicht-kritischen Flows | iOS-PWA-Standalone-Sicherheit |
| P2-3 | **Lighthouse-Pass** sobald Chrome-MCP/Browser-Smoke verfügbar | Performance-/A11y-Score |
| P2-4 | **App-Store-Präsenz** — TWA (Google Play) / Capacitor (Apple), siehe `STORE_SUBMISSION_GUIDE.md` | Sichtbarkeit |

---

## 🌟 P3 — Zukunft

- AR-Pflanzenmarkierung (MVP-Auftrag existiert: `AUFTRAG_CODE_v26.18_AR_VIEW_MVP.md`).
- Weitere Sprachen (EN/ES sind bereits live — nächste Kandidaten: PT, NL).
- **Schweizerdeutsch (GSW)** — Nice-to-have mit Marketing-Wert, aber kein
  Nutzen-Blocker: DE deckt die Deutschschweiz vollständig ab. Voraussetzung
  wäre ein Seeding-Lauf über `i18n-translate` (Dialekt-Qualität vorher an
  einer Stichprobe prüfen — maschinelles GSW klingt schnell unfreiwillig komisch).
- Vogel-Audio-Bestimmung (BirdNET-Style, client-side).

---

## 🎖️ Erfolgs-Definition

**#1 in der Schweiz** — messbar an: aktive CH-User, Conversion Free→Pro,
App-Store-Rating, Erwähnungen in CH-Natur-/Tech-Medien, Zitate von
Info Flora / BAFU / VAPKO.

**Danach:** #1 Europa (weitere Sprachen, EU-Wetter/-Flora-Quellen) →
#1 Welt (globale DBs, Native Apps).
