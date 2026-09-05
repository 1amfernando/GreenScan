# ROADMAP.md — Meilensteine für GreenScan

> **Priorisierung**: P0 = Blocker · P1 = große Wirkung kurzfristig ·
> P2 = Wettbewerbsvorteil · P3 = nice to have.
> Kompagnon: `STATUS.md` (operativer Snapshot) · `CLAUDE.md` (Onboarding) ·
> `BACKEND_FRONTEND_MAP_v26.76.md` (Architektur-Detailkarte).

**Stand:** v32.20 · App **live** auf green-scan.ch · released seit v26.0.
**Zuletzt gegen die Produktionsdatenbank geprüft:** 02.09.2026 (P0-1, P1-1, P1-2 — siehe unten).

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

**„undefined" auf 22 Karten (v31.44).** Beim Durchsehen aller Seiten nach der Optik-Serie gefunden: fünf von den Daten benutzte Kategorien (`fermentation`, `salat`, `backen`, `oel`, `inhalation`) standen in keiner Zuordnungstabelle, und der Rückfall in der Listenansicht hatte **kein `label`** — also stand dort wörtlich „undefined". Behoben, plus ein Farbpaar mit 3,46:1, das der Kontrast-Prüfstand **nicht finden konnte**, weil die betreffende Kategorie nie gerendert wird. Zwei Fehler, die sich gegenseitig verdeckten.

**Kopfleiste hell (v31.43).** Das letzte dunkle Element der App folgt jetzt `--card`/`--border` statt `--fill-dark`; ein `color:#ffffff !important` und zwei Dunkelmodus-Überschreibungen wurden dadurch überflüssig. **Dabei ein Band sichtbar geworden, das niemand sehen konnte:** `body` und `#app` standen ebenfalls auf `--fill-dark` — solange Kopf- und Navigationsleiste dunkel waren, war dieser Hintergrund immer verdeckt. Erst als beide hell wurden, erschien er als dunkler Streifen. Beide folgen jetzt `--g-bg`. Damit ist die Optik-Serie v31.37–v31.43 abgeschlossen: die App ist von oben bis unten in einer Sprache.

**Kopfleiste auf Strich-Symbole (v31.42).** Mond, Glocke und Menü gezeichnet statt Emoji; drei fehlende Symbole im Stil des Satzes ergänzt. Dabei gefunden: `initDark()` und der Einstellungs-Umschalter setzten beide `btn.textContent = '🌙'` und überschrieben das Markup — jetzt `innerHTML` mit einer **einmal** definierten Konstante. Gefunden allein durch Hinsehen: Kontrast, Antippfläche und JS-Fehler waren alle in Ordnung.

**Alle Bildschirme hell (v31.41).** Vierzehn Leinwände in dunklen Volltönen auf `--g-bg` umgestellt — dieselbe Sprache wie die Startseite seit v31.37 und wie Fernandos Vorlage. **Viertes Mal desselben Musters an einem Tag:** die hellen Fassungen für Rezepte und Heilmittel standen bereits im Code und wurden von einem `!important`-Block überstimmt. Die Token `--on-canvas`/`--on-canvas-2` aus v31.32 sind wieder entfernt — sie gab es nur wegen der dunklen Flächen und wären jetzt selbst die Falle (hell auf hell); der Prüfstand zeigte genau die 14 betroffenen Stellen. Ergebnis wieder 0 + 0 unter AA.

**Funktionscheck der Verdrahtung (v31.40).** Alle 1'012 im Code angesprochenen Element-Kennungen gegen die tatsächlich erzeugten geprüft: **75 werden nirgends erzeugt**, verteilt auf 44 Funktionen (16 ohne Aufrufer = toter Code, 28 laufen). Zur Laufzeit: 0 doppelte ids, 0 JS-Fehler. **Ein echter Ausfall gefunden:** `showLuxResult` griff ungeschützt auf `lux-val` zu (heisst `lux-value`) — TypeError in Zeile 1, die Lichtmessung zeigte nie ein Ergebnis und der Knopf blieb hängen. Die korrekte Fassung `displayLuxResult` existierte daneben; nur dieser Aufrufer war nie umgehängt worden. Behoben und nachgemessen. **Offen zum Entscheiden:** die Wetter-Warnkarte in der App (~130 Zeilen) hat kein DOM-Element und keinen Aufrufer — Migration, Edge-Function und Cron existieren aber, die Warnungen erreichen Nutzer über Push/Posteingang. Bauen oder entfernen ist eine Produktentscheidung.

**Startseite neu geordnet (v31.39).** Nach der Logik der Vorlage: erst was ich wissen muss (Wetter), dann was ich tun soll (Tagesplan), danach Fortschritt, Kennzahlen, Lesestoff, Entdeckung. Der Tagesplan stand vorher an **sechster** Stelle, hinter Kennzahlen und Marktplatz. Kein Baustein entfällt. Vor dem Umordnen wurde geprüft, was an DOM-Reihenfolge hängt (`gsBuildWidgetStack` sucht per id — ordnungsunabhängig; `gsMoreFeedbackFirst` betrifft einen anderen Bildschirm) und danach am laufenden Programm bestätigt. **Grenze dokumentiert:** `render_check.js` paart positionsbasiert und ist für Umordnungen kein taugliches Mass — steht jetzt in `CLAUDE.md` §7.1.

**Navigationsleiste nach Vorlage (v31.38).** Helle Fläche statt dunkelgrünem Balken, gezeichnete Strich-Icons statt Emoji, Beschriftungen in Normalschreibung, Edelweiss im Mittelknopf. Der Icon-Satz (`assets/icons/`, 23 Symbole) lag mit eigenem README seit Längerem im Repo und war **nie eingebaut** — dasselbe Muster wie der halbe Hero-Umbau in v31.37. Die Leiste nutzt jetzt `--card`/`--border` und kippt selbst; drei Dunkelmodus-Überschreibungen wurden dadurch überflüssig. `render_check.js` baut Element-Schlüssel jetzt aus einem DOM-Pfad (vorher teilten sich id-, klassen- und textlose Elemente einen Schlüssel und wurden falsch gepaart) — vergleichbare Elemente 1'388 → 1'792.

**Lesbarkeit, zweite Runde (v31.37).** Fernando meldete, oben auf der Startseite sei kaum etwas zu lesen — mein Prüfstand hatte „0 unter AA" gemeldet. Ursache: `contrast_check.js` übersprang Text auf **Farbverläufen**, und der Hero ist einer. „Natur entdecken" lag bei **1,32:1**. Das Werkzeug misst jetzt pixelgenau (Seite zweimal aufnehmen, einmal mit `color:transparent`, echten Hintergrund-Median lesen) und fand damit **28 + 12** Stellen; alle behoben, wieder 0 + 0. Der Kern war ein halber Umbau: die helle Kopfzeile stand fertig im Code und wurde von einer `.hero`-Regel mit `!important` überstimmt, während die Kindregeln für Titel/Untertitel (ohne `!important`) für Hell geschrieben waren. Dazu 41 fest verdrahtete `#2d8a2d` (4,39:1 in beide Richtungen) auf `#1f6b2f` gezogen.

**Backend-Sicherheit nachgesehen (01.09.).** Security-Advisor: 145 Meldungen, **0 ERROR**. Die 5 `rls_enabled_no_policy` sind kein Mangel (RLS an ohne Policy = alles verboten ausser `service_role`, richtig für reine Server-Tabellen); die 3 `extension_in_public` sind Supabase-Standard. Von den 16 anon-ausführbaren SECURITY-DEFINER-Funktionen schreiben zwei: `fn_quiz_record_answer` sichert sich korrekt über `auth.uid()`, **`fn_mkt_increment_views` gar nicht** — jeder mit dem öffentlichen Anon-Key kann die Aufrufzahl beliebiger Inserate hochzählen. Migration liegt bereit (`v31_36_mkt_views_auth_guard.sql`), **nicht angewendet** (Produktionsdatenbank, Konvention: Fernando wendet an). **Offen zu klären:** der Advisor meldet Leaked-Password-Protection weiterhin als deaktiviert, obwohl als erledigt gemeldet — entweder gecacht oder nicht gegriffen.

**Weitere Auslagerung geprüft und VERWORFEN (01.09.).** Nach dem Changelog lag nahe, auch `DEFAULT_RECIPES` (297 KB / 70 KB gzip) auszulagern. Nachgemessen: es wird beim Start tatsächlich **nicht** gebraucht (`rezepteImDom: 0`) — meine gegenteilige Aussage in der v31.36-Notiz war ungeprüft. Trotzdem bleibt es inline: Verbraucher sind Rezepte-Tab, Heilmittel-Tab **und `openDetail`** (Arten-Steckbrief, eine Kernhandlung), und der vorhandene `typeof`-Schutz würde das Rezept-Abzeichen bei fehlenden Daten stillschweigend weglassen. Gewinn wären ~35ms Parse-Zeit — zu wenig gegen ein Risiko auf einem Kernpfad. `WEEKLY_SEASONAL_FACTS` (148 KB) und `GS_I18N_JS_STRINGS` (83 KB, 1'450 Schlüssel) werden beim Start nachweislich gebraucht und bleiben ebenfalls.

**Changelog ausgelagert (v31.36).** `GS_RELEASES` war mit **787 KB der grösste Einzelblock** in `index.html` (14 %) — 383 Einträge, geparst bei jedem Kaltstart, obwohl beim Start nur `[0]` gebraucht wird. Die neuesten 12 bleiben inline, die 371 älteren liegen in `data/releases.v1.js` und werden beim Öffnen des Changelogs nachgeladen (Muster von `data/plants.v1.js`). `index.html` 5,50 → 4,87 MB, DOMContentLoaded auf einem Mittelklasse-Telefon ~145ms schneller, Erstbesuch 260 KB weniger. **Bewusst nicht vor-gecacht** — sonst lädt jeder 778 KB für einen selten geöffneten Bildschirm; der Offline-Fall zeigt stattdessen einen Hinweis. Parse-Zeit sank nur ~70ms: Datenliterale sind billiger zu parsen als Code.

**Backend durchgemessen (01.09.).** Leistungs-Advisors zum ersten Mal ausgewertet: 0 ERROR, 0 WARN, kein Fremdschlüssel ohne Index. Die Datenbank ist gesund. Einzige lohnende Aufräumung: 38 Indizes, deren Spalten ein echtes Präfix eines breiteren Index sind — bereitgelegt als `20260901_redundante_indizes.sql`, umkehrbar, nicht Teil der Pflichtschritte.

**Planer V3 (v31.75–v31.94).** Der Planer rechnet nach, statt der KI zu
glauben. Ein Prüfwerk mit dreizehn Regeln (Aussaatfenster, Standdauer, Dichte,
Saatgut, Wasser, Erntemonate, Frost, Arbeitslast, Fruchtfolge), jede mit **drei**
Zuständen — erfüllt · verletzt · **nicht prüfbar mit Grund**. Dazu die
**Fruchtfolge je Beet** (v31.93): aus dem Garten-Scan und früheren Plänen
derselben Fläche wird je Beet berechnet, welche Familie dort zuletzt stand; der
Platzierer setzt neue Kulturen dorthin, wo ihre Familie am längsten weg ist. Und
die **Nachkultur** (v31.94): aus einer Lücke im Kalender wird ein Platz im Garten
(„Frühbeet wird am 10. Juli frei, 2,4 m², nach Kohlrabi"). Entwurf und Grenzen:
`docs/PLANER-V3.md`.

**Scanner V3 (v31.99–v32.12).** Dieselbe Linie beim Scanner. In der
Bilderkennung ist gegen Google Lens nichts zu gewinnen — was Lens *nicht* hat,
ist eine kuratierte Artenliste, der Monat, der Kanton und eine gemessene
Bildqualität. **Die Überlegenheit liegt nicht im Sehen, sondern im Prüfen.**
Sieben Regeln nach jeder Bestimmung; bei einem Widerspruch in der Giftigkeit
gewinnt **immer** die vorsichtigere Angabe (eine als „essbar" gemeldete
Herbstzeitlose wird auf 5/5 korrigiert, sichtbar). Dazu EXIF (ein Urlaubsfoto
wird nach dem Urlaub beurteilt, nicht nach heute), eine **unabhängige
Gegenprobe** bei „essbar + giftige Verwechslung" (v32.10), ein Drahtgitter,
das aus den Kanten des echten Fotos gerechnet wird (v32.11), und seit v32.12
**eigene Arbeit vor der Antwort**: die App misst die Farben des Fotos und
grenzt aus den 4'342 Arten die ein, die hier und jetzt in Frage kommen —
beides bewusst **nicht** im Prompt, sonst bestätigte das Modell nur die
eigene Vorgabe. Entwurf: `docs/SCANNER-V3.md`.

**Der grosse Funktionscheck (v31.45–v31.98).** Systematisch geprüft, was die
App **erhebt und dann verschweigt**. Neun Funde, zwei davon ernst:

- **Der Experten-Antrag wurde nie eingereicht** (v31.95). Er landete im
  localStorage des eigenen Geräts, und die App meldete „✅ Antrag eingereicht,
  du wirst per E-Mail benachrichtigt". Dasselbe bei Rollenvergabe und Sperren.
- **Vier Bildschirme liessen sich gar nicht öffnen** (v31.95) — alle setzten
  einen Fenstertitel an einem Element, das es in diesem Fenster nicht gibt, und
  warfen **vor** dem Öffnen. Betroffen: Bestätigte Scans, Supabase-Schlüssel,
  das **Admin-Panel** und der Experten-Antrag.
- **1'408 Arten trugen denselben generischen Verwendungs-Satz** (v31.89), 25
  davon als tödlich giftig eingestuft — korrigiert und dauerhaft geprüft.
- Dazu: der dritte überlebende `s.bloom` (v31.98), eine Warnung aus einem
  fehlenden Feld (v32.03), die Giftigkeit der Verwechslungs-Alternativen
  (v31.92), die Merkmale aus dem Scan (v31.99).

**Vierzehn Prüfstände (`scripts/`).** Aus dem Funktionscheck ist Infrastruktur
geworden. Jeder beantwortet **eine** Frage:

| Prüfstand | Frage |
|---|---|
| `render_check` | wie sieht es aus, und was hat sich verschoben? |
| `contrast_check` | ist jede Textstelle lesbar (11 Tabs + 5 Fenster, beide Modi)? |
| `touch_check` | ist jede Antippfläche gross genug? |
| `perf_check` | wie lange dauert der Kaltstart unter Drosselung? |
| `wiring_check` | kommt an, was angetippt wird — und **geht das Fenster auf**? |
| `field_check` | liest überhaupt jemand, was eingegeben wird? |
| `data_check` | gibt es, was gelesen wird? |
| `save_check` | kommt an, was gespeichert wird — auch auf dem Server? |
| `planer_check` · `scan_check` | rechnet die App, was sie behauptet? |
| `offline_check` | läuft die App ohne Empfang — mit allen 4'342 Arten? |
| `a11y_check` | bedienbar ohne Augen und ohne Maus? |
| `i18n_check` | kommt in vier Sprachen an, was auf Deutsch dasteht? |
| `backend_check` | ruft das Frontend etwas auf, das es in Supabase nicht gibt? |

Detaillierte Sprint-Historie: `STATUS.md` Sektion 0 (Routine-Einträge).

---

### Seit dem 03.09.2026 (v32.43 – v32.56)

- **Scanner-Zuordnung**: Binomen vor deutschem Namen (1'194 von 4'311 Einträgen landeten auf einer anderen Art → 0); bei Dubletten gewinnt die vorsichtigere Angabe, Unterarten und Einlese-Rümpfe entscheiden nicht mit (`scan_check` 55 Fälle).
- **Voller Speicher**: alle 13 Rettungswege am Rückgabewert, `speicher_check` (Prüfstand 22).
- **Kalender V1 Stufen 1+2** (`docs/KALENDER-V1.md`, v32.46–v32.47): eine Ereignis-Schicht für Aufgaben, Tagebuch, Pflanzungen, Ernte-Schätzung, Regen, Erinnerungen; Verschieben fälscht nichts mehr; Garten-Pflanzungen haben Pflege; `kalender_check` (13 Fälle). **Stufe 3** kommt mit den Sensoren (`messung`/`alarm`).
- **Ökosystem V1 Stufe 0** (`docs/OEKOSYSTEM-V1.md`): Schema im Repo (nicht angewandt), Messwerte von Hand, Dashboard mit Verlauf und Regeln, Kalender-Anschluss, `sensor_check` (Prüfstand 24, test-first). **Stufe 1 offen:** `device-ingest`, Token-Pairing, Cron, Push — braucht ein Gerät.
- **Ideen für die Sensoren** (`docs/OEKOSYSTEM-V1.md` §11, v32.51): 25 Ideen nach Stufe, 35 Behauptungen nachgeprüft; §1 des Entwurfs korrigiert (es gibt eine Alt-Schicht `sensor_*` + BLE + ESP32-Assistent mit Sitzungs-Token). Vier Stufe-0-Reparaturen: Regen-Draht (tot seit v31.84), Backup mit Messwerten, Deckel-Reihenfolge, `sensor_alert`-Dublette. **v32.52 hat 2 · 3 · 11 · 21 gebaut** (Katalog-Leser, Wetter als Gerät, Dublettensperre + UUID, Gerät im Seed), **v32.53 die 4** (Regel `task:<key>` → Aufgabe mit `vorgezogenAuf`, Giess-Bestätigung am Sensor, Migration `20260904_plant_tasks_due_vorgezogen.sql`), **v32.54 die 7** (Stille-Zeit lokal, eine Aufgaben-Meldung je Tag aus beiden Listen, Sensor-Alarme mit Abkühlzeit, Wochenzähler), **v32.55 die 5 und 22** (Vorlagen nur mit belegter Zahl, Messgrössen in vier Sprachen), **v32.56 die 6 und 10/Stufe 0** (Lina kennt die Zahlen, Frost aus der Vorhersage im Kalender). **Nächste Schritte:** Idee 1 (eine Geräteschicht, braucht Fernandos Entscheid) → 8 (Wochenrückblick) → 9 (zwei Standorte nebeneinander) → 12 (CSV-Export mit Messwerten) → 13 (Urlaub: Zettel und Pause).
- **Drei Tagebücher, eine Sicht** (v32.49): Gartentagebuch, Pflanzentagebücher und der Spiegel des Cloud-Tagebuchs in `gsTagebuchAlle()`; `docs/MEINE-PFLANZEN-AUDIT.md` (11 Befunde: 9 behoben, 2 bei Fernando).
- **Gegnerische Prüfung des Audits** (v32.50): drei Aussagen widerlegt und behoben — „Alle erledigt ✓" fragt jetzt und erledigt in beiden Listen; die Kopfzahlen zählen dieselben Listen; der Notizzettel lässt auch der Fällig-Liste Platz (`kalender_check` 15 Fälle, jede Reparatur mit Gegenprobe).

## 🔥 P0 — Blocker

> ⚠️ **Diese Sektion stand bis v31.08 auf „Keine offen" — das war seit dem
> Backend-Audit (v30.95) falsch.** Genau diese Art veralteter Entwarnung ist
> gefährlich: wer hier nachsieht, hört auf zu suchen.

| # | Punkt | Wer | Stand |
|---|---|---|---|
| **P0-1** | **Zwei offene Schreib-Endpunkte auf `public.species`.** `admin-seed-species` und `species-bulk-seed` waren ACTIVE mit `verify_jwt=false`, schrieben mit dem Service-Role-Key an der RLS vorbei und waren nur durch **ein hartcodiertes Secret** geschützt — das im Klartext im **öffentlichen** Repo lag. | Owner | ✅ **erledigt** — siehe darunter |

**P0-1 ist geschlossen (geprüft 02.09.2026 an der Quelle, nicht am Changelog).**
Beide Funktionen wurden am **01.09.2026** durch die 410-Stubs ersetzt. Der
Quelltext, den Supabase heute ausliefert, enthält **keinen Service-Role-Key und
kein Secret mehr** — nur noch:

```
Deno.serve(() => new Response(JSON.stringify({error:"gone", …}), {status:410}))
```

`verify_jwt` bleibt bewusst `false`: die Funktion tut nichts mehr, und ein 410
ist die ehrlichere Antwort an Altaufrufer als ein 401. Gegengeprüft:
`species` = **2'838 Zeilen, neueste vom 2026-07-02** — unverändert gegenüber
dem Befund von v30.95, also kein Missbrauch in der Zwischenzeit.

**Wird wieder geseedet?** Nicht diese Funktionen reaktivieren, sondern den
SQL-Editor mit dem Service-Key aus dem Dashboard benutzen — kein dauerhaft
offener HTTP-Endpunkt für eine Aufgabe, die einmal im Jahr vorkommt.

Der v26.51-Self-Audit hat seinerzeit alle Security-**ERROR**-Advisors eliminiert;
das gilt weiterhin (Stand v31.08: 0 ERROR, nur WARNs). P0-1 ist kein
Advisor-Befund, sondern eine Edge-Function ausserhalb des Repos — genau deshalb
hat ihn keine automatische Prüfung gefunden.

---

## 🚀 P1 — Owner-Aktionen (kein Code)

| # | Punkt | Wer |
|---|---|---|
| P1-1 | **Leaked-Password-Protection** — im Security-Advisor vom 02.09.2026 **nicht mehr gemeldet** (144 Meldungen, 0 ERROR: 120+16 SECURITY-DEFINER-WARNs, 5 `rls_enabled_no_policy`, 3 `extension_in_public`). ⚠️ **Abwesenheit ist kein Beweis für Aktivierung** — der Advisor könnte die Regel auch nicht mehr prüfen. Wer es genau wissen will: Supabase → Auth → Settings ansehen. Bis dahin gilt der Punkt als *wahrscheinlich erledigt*, nicht als erledigt. | Owner, 1 Blick |
| P1-2 | **Stripe-Webhook reparieren** (🔴 **bestätigt offen, 02.09.2026**: `stripe_webhook_events` = **0 Zeilen**, 1 Subscription, 9 `comp_tier`-Konten). Nicht mehr nur „verifizieren": `stripe_webhook_events` hat **0 Zeilen**, und die Tabelle wird *vor* jedem Handler beschrieben — es hat also **noch nie ein Event die Signaturprüfung passiert**. Die eine Subscription hängt seit 23.05. auf `trialing` mit abgelaufener Periode; alle 9 „bezahlten" Konten sind manuelle `comp_tier`-Zuteilungen. **Entwarnung:** niemandem ist etwas verloren gegangen, es hat schlicht noch nie jemand über Stripe bezahlt. Beim ersten echten Zahlungsvorgang wäre es aber so. Die Secret-Rotation ist womöglich gleich die Lösung — 4-Schritt-Diagnose im Runbook. | Owner |
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
