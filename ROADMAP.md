# ROADMAP.md — Meilensteine für GreenScan

> **Priorisierung**: P0 = Blocker · P1 = große Wirkung kurzfristig ·
> P2 = Wettbewerbsvorteil · P3 = nice to have.
> Kompagnon: `STATUS.md` (operativer Snapshot) · `CLAUDE.md` (Onboarding) ·
> `BACKEND_FRONTEND_MAP_v26.76.md` (Architektur-Detailkarte).

**Stand:** v31.24 · App **live** auf green-scan.ch · released seit v26.0.

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

**Datenhaltung gehärtet (v30.92–v31.08, 18 Releases).** Zwei Audits — Backend-Integrität und Datenverlust — vollständig abgearbeitet. Die Kernbefunde:

- **Abmelden + wieder anmelden löschte das Konto auf allen Geräten** (v31.04). Der Empty-Clobber-Guard wurde nur bei einem *Konto­wechsel* neu scharf gestellt, nicht beim Logout.
- **Das Cloud-Backup war da, nur nicht erreichbar** (v30.97). Der Wiederherstellen-Banner erschien nur bei komplett leerem Speicher — den der Login-Pull 2,7 s vorher wieder füllte.
- **Der Speicher-Wrapper log** (v30.98). Er verschluckte jeden Quota-Fehler und gab `undefined` zurück: jeder `try/catch`-Fallback im Monolithen war toter Code, und bei vollem Speicher schlug **das Anmelden still fehl**.
- **Der Sync verglich Geräte- gegen Server-Uhr** (v31.02) und stempelte „synchronisiert" auch nach lauter Fehlschlägen.
- **Fotos** liegen nicht mehr im 5-MB-Speicher und gehen nicht mehr verloren (v31.06/07) — Ausgangskorb in IndexedDB, Anzeige über einen Auflöser, idempotente Uploads.
- **Rotierende Listen** archivieren statt wegzuwerfen, mit erreichbarem Export (v31.08).
- **Sicherheit:** Rollen-Auskunft über fremde Konten für `anon` geschlossen, `quiz_answers.is_correct` serverseitig abgeleitet (entschied über ein Jahr PRO gratis), Marktplatz-Chat erfand keine Antworten mehr im Namen echter Verkäufer.

**Community, Einstellungen, Karte (v31.09–v31.12).** Kommentare lassen sich liken/disliken und teilen, Likes erscheinen als Benachrichtigung; ein Datenschutz-Schalter zeigte auf neuen Geräten den falschen Zustand (`opt_in_achievement_feed` wurde nur geschrieben, nie zurückgelesen); ein eigenes Icon-Set liegt unter `assets/icons/`; und die GPS-Aufzeichnung kann jetzt tatsächlich **fortgesetzt** werden — der Kommentar versprach das seit v24.11, der Code bot nur „speichern" oder „verwerfen". Dazu: Wach-Timer statt totem watchId-Test, zeitbasiertes Sichern, Ausdünnen statt Abschneiden langer Tracks, monotone Wander-Zähler (die Achievements liefen ab Track 31 rückwärts) und eine Karte, die mitläuft.

**Release-Notizen wieder ehrlich (v31.13).** Der „Was ist neu"-Dialog setzte die laufende Versionsnummer über den obersten `GS_RELEASES`-Eintrag — und der stand seit Juni auf v30.03. Rund hundert Updates lang las jeder Nutzer dieselben Notizen unter einer neuen Nummer. Sechs Einträge nachgetragen, der Dialog prüft jetzt ab und bleibt bei fehlendem Eintrag lieber aus, die Konvention steht in `CLAUDE.md` §3.1 statt nur in einem Code-Kommentar.

**Streaks halten wieder (v31.14).** Erster Teil von „Bindung und Wachstum" — bevor eine Serie Nutzer hält, muss sie selbst halten. Der Cloud-Abgleich schrieb die vier zusammengehörenden Streak-Schlüssel einzeln; ein Gerät ohne Serie leerte dabei die Prüfsumme, und der nächste Lesevorgang setzte auf 0. Der Login-Streak fiel auf 1, weil nur die Zahl übertragen wurde, nicht der Tag. Dazu rechneten drei Streak-Systeme mit zwei Tagesgrenzen (Ortszeit vs. UTC). Alles behoben, 14/14 Szenarien gegen die Originalfunktionen grün.

**Quiz-Rangliste zeigt den echten Stand (v31.15).** Wer nicht in den Top 50 stand, sah sich selbst mit 0 richtigen Antworten — der lokale Eintrag las Felder, die niemand schreibt. Dazu: die Zahl hiess „Punkte 2026", war aber die Anzahl richtiger Antworten insgesamt; die beste Serie wird jetzt angezeigt. Der Quiz-Tag liegt in einer Funktion mit dem Hinweis, dass er UTC bleiben muss, solange `fn_get_daily_quiz` mit `current_date` rotiert.

**Entwürfe umgesetzt (v31.16–v31.19).** Startseite mit „Dein Tagesplan" (v31.16), „Mein Garten" mit Kennzahl-Kacheln (v31.17), Scan-Ergebnis mit Ursachen-Wahrscheinlichkeiten und Übergabe an Lina (v31.18), Foto-zu-3D mit Stufen-Anzeige (v31.19). Durchgehendes Prinzip: die Form aus den Entwürfen übernehmen, aber nichts behaupten, was die App nicht weiss — keine erfundenen Pflegezonen, kein erfundener Fortschritt.

*(Historie)* **Entwürfe werden umgesetzt (ab v31.16).** Fernandos Bilder zeigen die Startseite als eine einzige Frage: *Was mache ich jetzt?* Umgesetzt als „Dein Tagesplan" mit Prioritäten und genau einem hervorgehobenen nächsten Schritt, gespeist aus `gsGetDueTasks()` und erledigt über den bestehenden `gsQuickDone`-Weg. Offen und je ein eigener Schritt: Mein Garten (Kennzahl-Kacheln), Scan-Ergebnis (Wahrscheinlichkeits-Zeilen), 3D-Modell-Fortschritt.

**Farbsystem durchgesetzt (v31.20).** Die App hatte längst semantische Farb-Token mit korrekten Dunkel-Varianten — 523 Stellen umgingen sie und schrieben den Hellwert hart hinein, weshalb der Dunkelmodus leuchtete. Alle umgestellt; sechs Dunkel-Werte repariert, die sonst unlesbaren Text erzeugt hätten. Hellmodus pixelgleich, schlechtester Kontrast 2,2:1 → 4,8:1. **Offen (Welle 2):** 225 helle Hintergründe ohne Token-Zwilling und die Farbverläufe brauchen neue Token.

**Backend durchgemessen (01.09.).** Leistungs-Advisors zum ersten Mal ausgewertet: 0 ERROR, 0 WARN, kein Fremdschlüssel ohne Index. Die Datenbank ist gesund. Einzige lohnende Aufräumung: 38 Indizes, deren Spalten ein echtes Präfix eines breiteren Index sind — bereitgelegt als `20260901_redundante_indizes.sql`, umkehrbar, nicht Teil der Pflichtschritte.

Detaillierte Sprint-Historie: `STATUS.md` Sektion 0 (Routine-Einträge).

---

## 🔥 P0 — Blocker

> ⚠️ **Diese Sektion stand bis v31.08 auf „Keine offen" — das war seit dem
> Backend-Audit (v30.95) falsch.** Genau diese Art veralteter Entwarnung ist
> gefährlich: wer hier nachsieht, hört auf zu suchen.

| # | Punkt | Wer | Stand |
|---|---|---|---|
| **P0-1** | **Zwei offene Schreib-Endpunkte auf `public.species`.** `admin-seed-species` (v3) und `species-bulk-seed` (v4) sind ACTIVE mit `verify_jwt=false`, schreiben mit dem Service-Role-Key an der RLS vorbei und sind nur durch **ein hartcodiertes Secret** geschützt — das im Klartext im **öffentlichen** Repo liegt (aktueller Tree von 6 gepushten `claude/*`-Branches). Die v29-Rotation hat sie übersehen, weil sie kein Repo-Verzeichnis hatten. **Kein Missbrauch nachweisbar** (species = 2'838 Zeilen, 1 in 90 Tagen, neueste 02.07.). | **Owner** | 🔴 **offen** — 410-Stubs liegen fertig im Repo, `bash scripts/apply_pending_v30_87.sh` (Schritt 0) legt sie still |

Der v26.51-Self-Audit hat seinerzeit alle Security-**ERROR**-Advisors eliminiert;
das gilt weiterhin (Stand v31.08: 0 ERROR, nur WARNs). P0-1 ist kein
Advisor-Befund, sondern eine Edge-Function ausserhalb des Repos — genau deshalb
hat ihn keine automatische Prüfung gefunden.

---

## 🚀 P1 — Owner-Aktionen (kein Code)

| # | Punkt | Wer |
|---|---|---|
| P1-1 | **Leaked-Password-Protection** aktivieren (Supabase → Auth → Settings). Alle 13 Konten nutzen E-Mail+Passwort, `auth.mfa_factors` = 0 — das Passwort ist der einzige Credential, auch bei den 6 internen Admin-/Staff-Konten. | Owner, 1 Klick |
| P1-2 | **Stripe-Webhook reparieren.** Nicht mehr nur „verifizieren": `stripe_webhook_events` hat **0 Zeilen**, und die Tabelle wird *vor* jedem Handler beschrieben — es hat also **noch nie ein Event die Signaturprüfung passiert**. Die eine Subscription hängt seit 23.05. auf `trialing` mit abgelaufener Periode; alle 9 „bezahlten" Konten sind manuelle `comp_tier`-Zuteilungen. **Entwarnung:** niemandem ist etwas verloren gegangen, es hat schlicht noch nie jemand über Stripe bezahlt. Beim ersten echten Zahlungsvorgang wäre es aber so. Die Secret-Rotation ist womöglich gleich die Lösung — 4-Schritt-Diagnose im Runbook. | Owner |
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
