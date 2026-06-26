# A-Z FULL-STACK AUDIT — GreenScan v30.51

> **Datum:** 26.06.2026 · **Basis:** v30.50 LIVE → **v30.51 vorbereitet** (deploy pending Fernando)
> **Methode:** 4 parallele Audit-Agenten (Pro-Gating · Offline/Cross-Device · Frontend-pro-Seite · Backend-Live) +
> Live-Checks gegen Supabase `vowbiueikwrauuceilhc`, GitHub `1amfernando/GreenScan`, Stripe, Cloudflare.
> Dedupe gegen v30.42- + v28.95-Audits (bereits gefixte Punkte NICHT neu gezählt).
> **Auftrag Fernando:** „Audit + sichere Fixes live" + alle 4 Schwerpunkte.

---

## 0 · GESAMTBILD (ehrlich)

Die App ist **deutlich gesünder als die alten Doku-Stände behaupten.** CLAUDE.md sagte v28.56 / 63k Zeilen /
„riskanter Perf-Sprint offen" — real ist **v30.50 / 81'249 Zeilen**, Git sauber & in-sync mit origin+Cloudflare,
und der gefürchtete Perf-Sprint ist **erledigt** (auth_rls_initplan 73→0, unindexed_fk 14→0).

- **Backend:** 0 Security-ERRORs, RLS auf **jeder** public-Tabelle, 0 Perf-ERRORs. Sehr solide.
- **Frontend:** node --check 9/9 sauber. Keine toten onclick-Funktionen, keine HL#9/HL#12-Bugs. Sehr reif.
- **Offline:** sw.js-Precache komplett, network-first HTML→offline.html-Fallback korrekt, graceful Offline-UX.
- **Cross-Device:** Architektur gut (expliziter State-Blob + Pull-stateMap + markDirty), wenige Rest-Lücken.
- **Abo/Pro-Gating:** Plumbing (Checkout/Portal/Cancel/TWINT/Lina-frei) **funktioniert** — ABER **eine strukturelle
  Schieflage** (Pro-Karte bewirbt 5 Features, die gar nicht gegated sind). → **Decision nötig (siehe §2).**

**Fazit:** Keine „grossen Löcher" mehr. Die echte offene Arbeit ist (a) **eine Produkt-Entscheidung zum Pro-Tier**
und (b) eine Handvoll mittlere Sync-/Cleanup-Punkte. Kein Notfall, sondern Feinschliff.

---

## 1 · LIVE GEFIXT in v30.51 (sicher, verifiziert, node --check 9/9)

Alle in `repo-clone/` — **deploy pending** (Fernando: `DEPLOY_FULL.command`).

| # | Severity | Fix | Datei/Zeile |
|---|---|---|---|
| 1 | **HIGH** | `saveMarket()` ungewrappt → bei vollem Speicher (gs_market hält base64-Fotos **inline**) bricht `submitListing` mittendrin ab → „**publiziere und sehe nichts**" (Modal friert offen, kein Toast, kein renderMarket). Jetzt try/catch. | index.html ~35239 |
| 2 | MED | 5 weitere ungewrappte List-Saves (HL#10): saveMarketChats, saveMyBids, saveMyPurchases, saveRecipesData, saveFarmState. | ~35517-19, ~40920, ~59449 |
| 3 | LOW | 3 kleine ungewrappte Saves: gs_ernte_unit, gs_dark, login_streak. | ~8317, ~43988, ~17608 |
| 4 | MED | Toter Nav-Button „➕ Zum Marktplatz" im Verkäufer-Modal: `switchTab('marktplatz')` → Screen heisst `market` (einziges switchTab-Ziel ohne Screen). Klick führte ins Leere. Jetzt `'market'`. | ~22791 |
| 5 | MED | Malformed Support-Mail `www.greenscan@gmail.com` in **10 user-facing Stellen** (Checkout-Fehler, Verkäufer-deaktiviert-Modal, AGB, Support-Liste) → offizielles **`info@greenscan.ch`** (= GS_SUPPORT_EMAIL). Ein zahlungswilliger User mit Checkout-Fehler bekam vorher eine kaputte Kontakt-Adresse genau im Zahlungs-Moment. | 6184, 11301, 13358, 14184, 14270, 22740, 22808/09, 75839, 75885 |
| 6 | LOW | offline.html-Footer „v24.35" → v30.51. | offline.html:53 |

**v-Bump:** GS_VERSION + meta app-version + sw.js VERSION + _headers → alle `v30.51`. sw.js-Changelog-Eintrag gesetzt.
Warum HL#10-Wraps sicher sind: der `Storage.prototype.setItem`-Patch (markDirty-Auto-Track) feuert weiterhin —
try/catch verhindert nur den Throw, nicht den Sync.

---

## 2 · ⚠️ ENTSCHEIDUNG NÖTIG — Pro-Tier verkauft Features, die es nicht gibt/gated (HIGH)

Das ist der **Kern deiner Frage** („Abofunktion muss perfekt funktionieren, Free-User muss ‚Pro benötigt'-Meldung
sehen"). Befund:

- Es gibt **zwei Schichten**, die leicht verwechselt werden:
  1. **KI-Kosten-Quota** (`fn_quota_peek/consume`, Features: scan/doctor/foto_diff/lina/garden) — **fail-open**,
     warme Sprache, kein Verkaufsdruck. Das ist die „Kosten-Bremse", korrekt deiner Mission entsprechend.
  2. **Pro-Feature-Gate** (`gsIsPaid()` + `gsAboCanUse('offline'|'export'|'ai_unlimited')`).
- **Problem:** `gsAboCanUse('offline'/'export_pro'/'export'/'ai_unlimited')` wird **nirgends aufgerufen.** Die
  Pro-Karte + Trial-Modal bewerben: KI-Doctor, Buch-Wissen, **Familien-Konto (bis 4 User)**, **Offline-Modus mit
  Bildern**, **Export (Tagebuch/Garten/Erntelog)**, Werbefrei.
  **Realität:** KI-Doctor läuft frei (quotaFeature 'doctor'), Offline läuft für alle, **Familien-Konto existiert
  im Code gar nicht**, kein Export-Gate. → Pro kauft aktuell faktisch nur „kein KI-Tageslimit".
- Das ist gleichzeitig **Mis-Selling** (du verlangst Geld für Vorhandenes) **und** Grund, warum die
  „Pro-benötigt"-Meldung fast nie erscheint.

**Zwei saubere Wege — bitte wählen (Details/Empfehlung im Chat):**
- **(A) Ehrlich kürzen** *(Mission-konform, schnell, risikoarm):* Pro-Karte = nur was wirklich exklusiv ist
  („unbegrenzte KI / kein Tageslimit + Indie-Entwickler unterstützen, werbefrei"). „Pro benötigt" erscheint beim
  KI-Limit. Keine Dark Patterns.
- **(B) Echt gaten** *(mehr Arbeit):* Offline-mit-Bildern / Export / Familien-Konto wirklich Pro-only bauen, mit
  klarer „Pro-Abo benötigt"-Meldung + Upgrade-CTA via `gsShowAboScreen()`. Familien-Konto = grösseres Feature
  (Seats-Logik existiert NICHT → echtes Neubau-Projekt).

→ **Empfehlung: A jetzt** (ehrlich + mission-konform), B-Bausteine (Export, Familien-Konto) als bewusste Roadmap.
Lina ist verifiziert **frei & fragt nie nach Geld** (korrekt).

---

## 3 · OFFENE FUNDE nach Bereich (priorisiert, NICHT live geändert)

### 3.1 Cross-Device (MEDIUM)
- **ps_feedback (Arten-Korrekturen/Feedback) synct nicht über den State-Blob** wie sein Sibling ps_votes.
  ABER: ps_feedback hat einen **eigenen Server-Tabellen-Pfad** (Reconcile in ~29878). → **NICHT blind in den Blob
  packen** (Doppel-Sync-Clobber-Gefahr). Entscheidung nötig: ist der dedizierte Feedback-Pfad bereits ausreichend,
  oder muss persönliches Feedback zusätzlich in `_buildStateBlob`+Pull-stateMap? (Ich habe es bewusst nicht angefasst.)
- **gs_recipes / gs_remedies (selbst-erstellte Rezepte/Heilmittel)** synct nicht cross-device (kein markDirty, keine
  User-Tabelle). Veröffentlichte ziehen vom Server, eigene nicht. → markDirty+Blob ODER User-Tabelle (Design-Call).
- **gs_my_bids / gs_purchases (Legacy-Auktion)** device-local, kein Server-Backing. → Server-Tabelle ODER Legacy-
  Auktions-UI deprecaten (der server-gestützte `marketplace_*`-Pfad ist sauber).

### 3.2 Frontend / Pages (LOW, Backlog aus v30.42)
- Close/Back-Buttons <44px für **nicht-DE-Sprachen** (Tap-Target-CSS matcht nur deutsche aria-labels). Fix: stabilen
  Hook `[data-close]`/`.modal-close-btn` statt lokalisiertem aria-label.
- Foto-Entfernen-✕-Overlays 22–30px → gemeinsame Klasse `.gs-photo-x{min-width:44px;min-height:44px}`.
- Kosmetik: „542 Arten"/„100% offline" Alt-Texte vs. real 4'341 Arten (Arten-Zahl ist anderswo bereits dynamisch).

### 3.3 Backend (Supabase) — alles entweder Fernando-Dashboard oder „riskant → Review", daher NICHT live geändert
- **7 obsolete Stripe-Edge-Functions noch ACTIVE** (nicht per MCP löschbar): `create-checkout`, `customer-portal`,
  `stripe-restructure-pro-only`, `stripe-import-fernando-sub`, `stripe-complete-setup`, `stripe-final-audit`,
  `stripe-setup-webhook`. → **Fernando: Supabase-Dashboard → Edge Functions → löschen.** (Live-Pfad nutzt
  `stripe-checkout` v8 + `stripe-webhook` v12 + `stripe-portal` v5.)
- **HL#13 Defense-in-Depth:** 117 SECURITY-DEFINER-Funktionen für `authenticated` ausführbar, 16 für `anon`
  (inkl. `fn_admin_*`, die nur intern is_admin prüfen). Kein aktiver Exploit, aber `REVOKE EXECUTE … FROM anon`
  + explizite GRANTs wären sauberer. **Riskant auf Live-DB (100+ Funktionen) → Per-Function-Review, kein Bulk.**
- **species_images:** 2 überlappende SELECT-Policies (`simg read approved` + `simg read own`) → 1 konsolidieren
  (Perf-WARN, isoliert, niedrig-riskant — Kandidat für nächste Migration).
- **148 unused_index INFO** = reine Hygiene (`INDEX_DROP_CANDIDATES.sql` existiert schon). Vorsicht: einige sind
  für Sensor/Bewässerungs-Features vorgebaut → vor Drop gegen Feature-Roadmap prüfen.
- **leaked_password_protection: aus** → **Fernando: Supabase Auth-Settings → HaveIBeenPwned aktivieren** (1 Klick).

---

## 4 · PLATTFORM-STAND (Live geprüft)

- **GitHub** `1amfernando/GreenScan` (main): Working-Tree war sauber + in-sync. Meine v30.51-Änderungen liegen
  uncommitted im Working-Tree (4 Files). Mehrere alte `claude/*`-Branches auf origin (Cleanup-Kandidaten).
- **Supabase** `vowbiueikwrauuceilhc` (eu-north-1, PG17, ACTIVE_HEALTHY): 188 Migrations, ~33 Edge-Fns (7 obsolet,
  s. §3.3), neue `ai-proxy` v2 LIVE (Key-Leak-Mitigation). Security 0 ERROR / Perf 0 ERROR.
- **Stripe:** Connect LIVE-Pfad intakt (automatic_payment_methods → TWINT erscheint ohne Code-Change sobald im
  Dashboard aktiviert). Cancel/Portal in ~2 Klicks erreichbar (keine Dark Patterns).
- **Cloudflare Pages:** `_headers` solide (CSP/HSTS/COOP, HTML max-age=0 must-revalidate → kein stale Shell).

---

## 5 · ORDNUNG (Auftrag „jeder Chat kennt den neusten Stand")

- **Workspace-`CLAUDE.md`** (Auto-Load) war v28.56-stale → aktualisiert auf v30.51-Realität (Version, Zeilen,
  Perf-Sprint erledigt, obsolete Edge-Fns).
- **Memory** aktualisiert (Speicherort, Konnektoren, aktueller Stand).
- **Archiv-Empfehlung (nicht automatisch gelöscht):** dutzende `AUFTRAG_*`, `AUDIT_*`, `EDGE_FUNCTIONS_v25*`,
  `*_v26.*`-Files in repo-clone-Root sind historisch → nach `archive/2026-06-26-cleanup/` verschieben (auf Wunsch).

---

## 6 · FERNANDO — Manuelle Schritte (kein Code, nur Klicks)

1. **Deploy v30.51 live:** `DEPLOY_FULL.command` doppelklicken (~15s) → danach `git add -A && git commit && git push`.
2. **Entscheidung Pro-Tier:** §2 — Weg (A) oder (B)?
3. **Supabase-Dashboard:** 7 obsolete Stripe-Edge-Fns löschen · HaveIBeenPwned (leaked-password) aktivieren.
4. **Stripe-Dashboard:** TWINT aktivieren (seit Wochen offen) · 4242-Testkauf.
5. (Optional) origin: alte `claude/*`-Branches aufräumen.
