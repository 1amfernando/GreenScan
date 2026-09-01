# ROADMAP.md — Meilensteine für GreenScan

> **Priorisierung**: P0 = Blocker · P1 = große Wirkung kurzfristig ·
> P2 = Wettbewerbsvorteil · P3 = nice to have.
> Kompagnon: `STATUS.md` (operativer Snapshot) · `CLAUDE.md` (Onboarding) ·
> `BACKEND_FRONTEND_MAP_v26.76.md` (Architektur-Detailkarte).

**Stand:** v31.37 · App **live** auf green-scan.ch · released seit v26.0.

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

**Startseite optisch geschlossen (v31.21–v31.28).** Die Entwürfe zeigen ruhige helle Karten; die App hatte an mehreren Stellen noch Farbflächen und Token, die für den falschen Zusammenhang benutzt wurden. Nacheinander repariert: Rollentrennung der Token (eine Farbe ist entweder Text **oder** Fläche, nie beides — 29 Token, 146 Flächen, 124 davon mit weisser Schrift auf 2,36:1), Kopfleiste (1,64:1), untere Navigation im **Hell**modus (1,86:1), zuletzt die Wetterkarte (v31.28): blauer Verlauf → Karten-Material, Farbe nur noch bei der Sturmwarnung. Dabei fiel auf, dass die Wetter-Vorschau an **zwei** Stellen unabhängig gerendert wurde (3 vs. 4 Spalten, ein Weg mit fest verdrahtetem Weiss) — jetzt eine gemeinsame Funktion. **Offen:** die Radien-Skala — 2'287 `border-radius`-Angaben in 58 Varianten, bewusst als eigenes Vorhaben aufgehoben.

**Radien-Skala (v31.29).** 2'286 `border-radius`-Angaben in 55 Varianten, lückenlos von 2px bis 28px — jetzt ein 4px-Raster mit sechs benannten Stufen plus `50%` für Kreise. Keine Bewegung grösser als 2px (eine Ausnahme, im Browser nachgemessen); 11 Werte bewusst stehen gelassen, weil ihre Verschiebung eine Gestaltungsentscheidung wäre. Dabei aufgefallen: Export und Druck erzeugen eigenständige Dokumente, in denen `:root` nicht gilt — die Farb-Token dort waren **seit v31.20 tot**. Behoben über `GS_DOC_TOKENS`. Damit ist die in v31.22 aufgeschobene Aufgabe erledigt.

**Optische Änderungen sind überprüfbar (v31.30).** `scripts/render_check.js` lädt die App ohne Netz, baut alle elf Tabs auf und vermisst jedes sichtbare Element; im Vergleichsmodus meldet er getrennt Radius-, Schrift-, **Grössen**- und Farbunterschiede. Abdeckung 11 → 2'596 Elemente. Der Grund für die frühere Blockade war nicht die fehlende Anmeldung, sondern der Login-Flash-Guard (`html.gs-preauth`). Damit wurde v31.29 nachträglich belegt: 316 Radien geändert, 0 Layout-Verschiebungen. **Damit ist die Regel möglich, die vorher fehlte:** eine reine Farb- oder Radius-Änderung muss `GROESSE geaendert: 0` ergeben.

**Typo-Skala (v31.31).** 4'739 Schriftgrössen in 53 Varianten, darunter 1'387 Halbpixel-Werte — jetzt sieben Stufen, keine Bewegung grösser als 2px. Weil bei Schrift `GROESSE geaendert: 0` unmöglich ist, wurde vorher das passende Mass gebaut: Überlauf- und Ellipsis-Prüfung. Ergebnis: 0 neue Überläufe, 6 Zutaten-Vorschauen kürzen +0,5px früher. **Offen und für v31.32 vorgemerkt:** `applyThemeColors()` überschreibt die Text-Token zur Laufzeit per `setProperty` auf `documentElement` — `--muted` ist dadurch `#888888` (3,54:1) statt der geprüften Werte. Die Farbwelle ab v31.20 kam dort nie an; 270 Textstellen liegen im Hellmodus unter AA. Ebenfalls notiert: 53 stille CSS-Konflikte (gleiche Klasse, gleiche Eigenschaft, zwei Werte).

**Lesbarkeit: 291 → 0 (v31.32).** Der Kontrast-Prüfstand fand 270 Textstellen im Hell- und 21 im Dunkelmodus unter AA. Hauptursache: `applyThemeColors()` überschrieb `--text`/`--text2`/`--muted`/`--border` per `setProperty` auf `documentElement` — ein Inline-Stil, der jede `:root`-Regel schlägt. **Die Farbarbeit ab v31.20 kam an diesen Token nie an.** Dazu: `body` hatte nie eine `color` (in beiden Modi Schwarz), die Hauptfarben der Themen Grün und Orange lagen unter AA, und vierzehn Bildschirme mit dunkler Leinwand trugen Text in Hell-Token. Jetzt 0 + 0, mit 0 Layout-Änderungen gegengeprüft. Ein struktureller Lösungsversuch (gemeinsame Textfarbe auf den Leinwänden) wurde **verworfen**, weil die Messung ihn widerlegte.

**Stille CSS-Konflikte bereinigt (v31.33).** 22 Klassen waren zweimal deklariert — die ursprüngliche Regel oben im Dokument, eine zweite aus einem späteren Umbau weiter unten. Bei gleicher Spezifität gewinnt die spätere; die frühere galt nie. 52 tote Deklarationen entfernt, streng abgegrenzt auf Einzelklassen ohne `@media` und ohne `!important`. Nachgemessen 0/0/0/0. Dabei einen Messfehler im eigenen Prüfstand behoben: `getBoundingClientRect()` misst die gedrehte Hülle, ein rotierender Ladekreisel erschien dadurch als Layout-Änderung — jetzt `offsetWidth`/`offsetHeight`.

**Bedienbarkeit: 43 → 0 (v31.34).** Antippflächen unter 24×24 px (WCAG 2.5.8) gemessen und behoben — die kleinste war 8×8: die Karussell-Punkte unter den Tageskarten. Trefferfläche jetzt 24×24, der sichtbare Punkt sitzt als `::before` darin, die Optik ist unverändert. Zweiter echter Fall: die Suchfelder waren 18px hoch in einer 37px hohen Leiste; deren Polsterung reagierte nicht. `scripts/touch_check.js` liegt als drittes Prüfwerkzeug im Repo. Nebenbei belegt: alle **7'081** `onclick`-Ziele lösen zu echten Funktionen auf, kein fehlender Handler.

**Startleistung: App-JS 1'548ms → 421ms (v31.35).** Drei `MutationObserver` (Auto-ARIA, Auto-Maxlength, Auto-Lazy) durchsuchten bei jeder DOM-Änderung das ganze Dokument neu — 743ms `querySelectorAll` allein beim Start. Jetzt gebündelt und auf die eingefügten Teilbäume beschränkt. Gegengeprüft: die drei setzen exakt dieselben 199 `aria-label`, 65 `maxlength` und 7 `loading`-Attribute wie vorher. `scripts/perf_check.js` neu im Repo. **Bewusst nicht angefasst:** die längste Einzelblockade (710ms auf einem Mittelklasse-Telefon) ist das Parsen der 5,7-MB-Datei — das liesse sich nur durch Aufteilen des Monolithen ändern, und das ist eine Architektur-Entscheidung.

**Lesbarkeit, zweite Runde (v31.37).** Fernando meldete, oben auf der Startseite sei kaum etwas zu lesen — mein Prüfstand hatte „0 unter AA" gemeldet. Ursache: `contrast_check.js` übersprang Text auf **Farbverläufen**, und der Hero ist einer. „Natur entdecken" lag bei **1,32:1**. Das Werkzeug misst jetzt pixelgenau (Seite zweimal aufnehmen, einmal mit `color:transparent`, echten Hintergrund-Median lesen) und fand damit **28 + 12** Stellen; alle behoben, wieder 0 + 0. Der Kern war ein halber Umbau: die helle Kopfzeile stand fertig im Code und wurde von einer `.hero`-Regel mit `!important` überstimmt, während die Kindregeln für Titel/Untertitel (ohne `!important`) für Hell geschrieben waren. Dazu 41 fest verdrahtete `#2d8a2d` (4,39:1 in beide Richtungen) auf `#1f6b2f` gezogen.

**Backend-Sicherheit nachgesehen (01.09.).** Security-Advisor: 145 Meldungen, **0 ERROR**. Die 5 `rls_enabled_no_policy` sind kein Mangel (RLS an ohne Policy = alles verboten ausser `service_role`, richtig für reine Server-Tabellen); die 3 `extension_in_public` sind Supabase-Standard. Von den 16 anon-ausführbaren SECURITY-DEFINER-Funktionen schreiben zwei: `fn_quiz_record_answer` sichert sich korrekt über `auth.uid()`, **`fn_mkt_increment_views` gar nicht** — jeder mit dem öffentlichen Anon-Key kann die Aufrufzahl beliebiger Inserate hochzählen. Migration liegt bereit (`v31_36_mkt_views_auth_guard.sql`), **nicht angewendet** (Produktionsdatenbank, Konvention: Fernando wendet an). **Offen zu klären:** der Advisor meldet Leaked-Password-Protection weiterhin als deaktiviert, obwohl als erledigt gemeldet — entweder gecacht oder nicht gegriffen.

**Weitere Auslagerung geprüft und VERWORFEN (01.09.).** Nach dem Changelog lag nahe, auch `DEFAULT_RECIPES` (297 KB / 70 KB gzip) auszulagern. Nachgemessen: es wird beim Start tatsächlich **nicht** gebraucht (`rezepteImDom: 0`) — meine gegenteilige Aussage in der v31.36-Notiz war ungeprüft. Trotzdem bleibt es inline: Verbraucher sind Rezepte-Tab, Heilmittel-Tab **und `openDetail`** (Arten-Steckbrief, eine Kernhandlung), und der vorhandene `typeof`-Schutz würde das Rezept-Abzeichen bei fehlenden Daten stillschweigend weglassen. Gewinn wären ~35ms Parse-Zeit — zu wenig gegen ein Risiko auf einem Kernpfad. `WEEKLY_SEASONAL_FACTS` (148 KB) und `GS_I18N_JS_STRINGS` (83 KB, 1'450 Schlüssel) werden beim Start nachweislich gebraucht und bleiben ebenfalls.

**Changelog ausgelagert (v31.36).** `GS_RELEASES` war mit **787 KB der grösste Einzelblock** in `index.html` (14 %) — 383 Einträge, geparst bei jedem Kaltstart, obwohl beim Start nur `[0]` gebraucht wird. Die neuesten 12 bleiben inline, die 371 älteren liegen in `data/releases.v1.js` und werden beim Öffnen des Changelogs nachgeladen (Muster von `data/plants.v1.js`). `index.html` 5,50 → 4,87 MB, DOMContentLoaded auf einem Mittelklasse-Telefon ~145ms schneller, Erstbesuch 260 KB weniger. **Bewusst nicht vor-gecacht** — sonst lädt jeder 778 KB für einen selten geöffneten Bildschirm; der Offline-Fall zeigt stattdessen einen Hinweis. Parse-Zeit sank nur ~70ms: Datenliterale sind billiger zu parsen als Code.

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
