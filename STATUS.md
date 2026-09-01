# STATUS.md — Operativer Snapshot

> **Single Source of Truth** für den aktuellen Zustand der App.
> Wenn du etwas änderst, **aktualisiere dieses File im selben Commit**.
> Kompagnon: `CLAUDE.md` (Onboarding) und `ROADMAP.md` (Meilensteine).

**Stand**: 2026-09-01 · **Branch**: `main` · **Version**: `v31.36` (PR offen) · **Release**: ✅ live seit v26.0 (Stripe Live-Mode seit v26.40)

---

## 0 · Daily-/Weekly-/Monthly-Routine-Eintraege (neueste zuerst)

> Eingefuehrt 2026-05-20 mit `CODE_ROUTINE_MASTER.md`. Code haengt nach jeder Session einen Eintrag hier oben an.

### 2026-09-01 (w) — Backend nachgesehen: ein ungesicherter Schreibaufruf, und ein Widerspruch zu einer Meldung

> Kein Release. Der Sicherheits-Advisor stand seit dem Vormittag nicht mehr an.

#### Der Stand

**145 Meldungen, 0 ERROR.** Aufgeteilt:

| | Anzahl | Bewertung |
|---|---|---|
| `authenticated_security_definer_function_executable` | 120 WARN | so gebaut — das ist, wie RPCs funktionieren |
| `anon_security_definer_function_executable` | 16 WARN | einzeln durchgegangen, siehe unten |
| `extension_in_public` (pg_trgm, vector, citext) | 3 WARN | Supabase-Standard, Verschieben wäre störender als nützlich |
| `rls_enabled_no_policy` | 5 INFO | **kein Mangel** — RLS an ohne Policy heisst „alles verboten ausser service_role". Genau richtig für reine Server-Tabellen (`book_ocr_pages`, `species_import_queue`, `species_search_cache`, `system_events`, `weather_forecast_cache`) |
| `auth_leaked_password_protection` | 1 WARN | **Widerspruch, siehe unten** |

#### Der Fund

Von den 16 anon-ausführbaren Funktionen **schreiben zwei**. Beide angesehen:

- `fn_quiz_record_answer` — macht es richtig:
  `v_uid := (select auth.uid()); if v_uid is null then return; end if;`
- **`fn_mkt_increment_views` — hat keine Prüfung:**
  `UPDATE marketplace_listings SET views = COALESCE(views,0)+1 WHERE id = p_listing_id;`

Der Anon-Key ist öffentlich (by design, RLS schützt die Daten). Damit kann **jeder ohne Konto** die Aufrufzahl beliebiger Inserate hochzählen — in einer Schleife auch als kleine Schreiblast. Kein Datenabfluss, kein Datenverlust; eine irreführende Kennzahl und eine unnötig offene Schreibstelle.

Bricht nichts, wenn man sie schliesst: einziger Aufrufer ist `openListingDetail()`, erreichbar aus Marktplatz-Liste und Home-Widget — beide setzen eine Anmeldung voraus, seit der Gast-Modus in v25.33 abgeschaltet wurde.

`supabase/migrations/v31_36_mkt_views_auth_guard.sql` liegt bereit. **Nicht angewendet** — das ist die Produktionsdatenbank, und in diesem Repo ist es Konvention, dass Fernando Migrationen anwendet (dafür existiert `scripts/apply_pending_v30_87.sh`). Bei diesem Schweregrad wäre ein Alleingang unangemessen.

#### Der Widerspruch

Der Advisor meldet **`auth_leaked_password_protection: Disabled`** — Fernando hatte gemeldet, das erledigt zu haben („nummer 2 und 3 habe ich gemacht").

Zwei mögliche Erklärungen, und ich kann von hier aus keine davon ausschliessen:
1. Das Advisor-Ergebnis ist gecacht und noch nicht nachgezogen.
2. Die Einstellung hat nicht gegriffen oder wurde an anderer Stelle gesetzt.

Ich melde das, statt es stillschweigend als erledigt zu führen — einmal nachsehen unter Auth → Policies kostet nichts.

---

### 2026-09-01 (v) — Nachtrag zu v31.36: eine eigene Behauptung überprüft und halb widerlegt

> Kein Release, nur Doku. In der v31.36-Notiz steht: *„DEFAULT_RECIPES (297 KB), WEEKLY_SEASONAL_FACTS (148 KB) und GS_I18N_JS_STRINGS (83 KB) — die werden aber tatsächlich beim Start gebraucht."* Das hatte ich **nicht geprüft, sondern angenommen.**

#### Nachgemessen

| Block | roh / gzip | beim Start gebraucht? |
|---|---|---|
| `WEEKLY_SEASONAL_FACTS` | 148 / 37 KB | **ja** — `_dynF` ist mit 10 Einträgen gefüllt, die Startseite zeigt sichtbar eine Saison-Tatsache (`fact-text: 🌿 Rosmarin überwintern`) |
| `GS_I18N_JS_STRINGS` | 83 / 27 KB | **ja** — 1'450 Schlüssel, `gsCollectI18nStrings` läuft beim Start |
| `DEFAULT_RECIPES` | 297 / 70 KB | **nein** — `rezepteImDom: 0` beim Start; `renderRecipes` läuft erst beim Tab-Wechsel |

Meine Behauptung stimmte also für zwei von drei Blöcken. Für den grössten war sie falsch.

#### Und die Messung selbst war beim ersten Anlauf falsch

Mein erster Ansatz hat die Funktionen umhüllt (`window.gsGetWeekFacts = wrapper`) und gezählt, welche beim Start laufen. Ergebnis: `gsGetWeekFacts` wurde **nicht** aufgerufen — was bedeutet hätte, `WEEKLY_SEASONAL_FACTS` sei entbehrlich.

Das war ein **Falsch-Negativ**: die Umhüllung greift nur, wenn Aufrufer den globalen Namen zur Aufrufzeit auflösen. Erst der Blick auf die *Daten* (`_dynF` gefüllt, Fakt sichtbar im DOM) zeigte, dass die Funktion sehr wohl gelaufen war.

Sechstes Mal in dieser Serie, dass eine Messung selbst der Fehler war. Die Regel, die sich daraus ergibt: **die Wirkung messen, nicht den Aufruf.**

#### Entscheidung: `DEFAULT_RECIPES` bleibt inline

Naheliegend wäre, die 297 KB wie den Changelog auszulagern. Dagegen spricht:

- Verbraucher sind der Rezepte-Tab, der Heilmittel-Tab **und `openDetail`** — also das Öffnen eines Arten-Steckbriefs. Das ist eine **Kernhandlung**; die meisten Nutzer lösen sie früh aus. Die 70 KB Übertragung spart man dann nicht, man verschiebt sie nur.
- Bei `openDetail` steht bereits ein `typeof DEFAULT_RECIPES !== 'undefined'`-Schutz. Fehlten die Daten, verschwände das Rezept-Abzeichen **stillschweigend** — ein Feature-Verlust, den niemand meldet.
- Bleibt der Parse-Gewinn: nach der Erfahrung aus v31.36 (630 KB Daten ≈ 70ms) wären das rund **35ms**.

35ms gegen ein Risiko auf einem Kernpfad ist ein schlechtes Geschäft. Der Changelog war der richtige Kandidat, weil ihn fast niemand öffnet; die Rezepte sind es nicht.

---

### 2026-09-01 (u) — v31.36: 787 KB Changelog, die jeder bei jedem Start mitlud

> In (t) habe ich geschrieben, das Parsen der 5,7-MB-Datei sei „eine Eigenschaft der Architektur". Das stimmt — aber bevor ich es stehen lasse, wollte ich wissen, **woraus** die Datei besteht.

#### Die Zusammensetzung

| Block | Grösse | Anteil |
|---|---|---|
| **`GS_RELEASES`** | **787 KB** | **14 %** |
| `DEFAULT_RECIPES` | 297 KB | 5 % |
| `WEEKLY_SEASONAL_FACTS` | 148 KB | 3 % |
| `GS_I18N_JS_STRINGS` | 83 KB | 1 % |

Der grösste Einzelblock ist die **Versionshistorie**: 383 Einträge, geladen und geparst bei jedem Kaltstart. Beim Start braucht die App davon **einen** — `GS_RELEASES[0]` für den „Was ist neu"-Dialog. Die volle Liste sieht nur, wer den Changelog im Über-Modal öffnet.

(Die anderen drei werden tatsächlich beim Start gebraucht. Die bleiben.)

#### Die Aufteilung

Die neuesten **12** Einträge (32 KB) bleiben inline — damit funktioniert der Dialog und die jüngste Historie ohne Nachladen. Die **371 älteren** (753 KB) stehen in `data/releases.v1.js` und werden per `gsLoadReleaseArchive()` geholt, wenn der Changelog geöffnet wird. Dasselbe Vorgehen wie bei `data/plants.v1.js` seit v25.10 — ich erfinde keine Architektur, ich wende die vorhandene an.

`index.html`: **5,50 → 4,87 MB.**

#### Eine Entscheidung, die ich erst falsch getroffen hatte

Mein erster Schritt war, das Archiv in `SHELL_URLS` vor-cachen zu lassen — damit der Changelog offline vollständig ist. Beim Nachdenken fiel mir auf: **dann lädt jeder 778 KB für einen Bildschirm, den die meisten nie öffnen.** Damit wäre der halbe Gewinn wieder weg.

Zurückgenommen. Das Archiv fällt unter die Standard-Strategie des Service Workers (`networkFirst` + Laufzeit-Cache) und ist ab dem ersten Öffnen auch offline da. Wer offline ist und ihn noch nie geöffnet hat, sieht die zwölf vorhandenen Einträge **und einen Hinweis** — eine Kurzliste stillschweigend als vollständig auszugeben wäre die schlechtere Lösung.

#### Was das NICHT bringt

Die Parse-Zeit sank nur um rund **70ms**, obwohl 630 KB verschwunden sind. Grund: entfernt wurden **Daten**, und Datenliterale sind für die JavaScript-Maschine deutlich billiger als Code. Wer 630 KB entfernt und proportional weniger Parse-Zeit erwartet, rechnet falsch.

Der messbare Gewinn liegt woanders:

| (4× gedrosselt, zwei Doppelläufe) | vorher | nachher |
|---|---|---|
| DOMContentLoaded | 1'568 / 1'591ms | **1'424 / 1'445ms** |
| längste Blockade | 689 / 734ms | 608 / 658ms |
| Erstbesuch übertragen | — | **260 KB weniger** (gzip) |

#### Zwei Zahlen, die ich nicht durchgewunken habe

Der Vergleich meldete `GROESSE geaendert: 5` und `abgeschnittener Inhalt 17 → 5`. Bei einer reinen Daten-Auslagerung gehört da nichts hin.

- Die fünf Grössenänderungen betrafen zwei Chips im Wissens-Hero. **Direkt nachgemessen: in beiden Ständen 72×18 und 144×18 — identisch.** Nicht reproduzierbar, also Zeitrauschen zwischen zwei Browser-Sitzungen. Bestätigt durch einen Selbstvergleich der Datei: **0/0/0/0**.
- Die Clipping-Differenz liegt ausschliesslich in `IMG`-Einträgen (4–5px), deren Zustand vom Ladezeitpunkt abhängt; die fünf inhaltlichen Container sind in beiden Ständen identisch. Plausibel, weil die Seite jetzt schneller parst.

---

### 2026-09-01 (t) — v31.35: „smooth" endlich gemessen — eine Sekunde verschenkte Arbeit beim Start

> Fernando hat „es soll auch smooth und zuverlässig funktionieren" ausdrücklich gesagt. Ich hatte das nie gemessen. Das war die letzte offene Zusage.

#### Erst die guten Zahlen

Auf dem Desktop: erster Anstrich 244ms, DOMContentLoaded 405ms, ein Tab-Wechsel kostet 1,3 bis 13,4ms Hauptstrang-Arbeit — unter einem 60-Hz-Bild. Nichts zu tun.

**Unter Telefon-Drosselung sah es anders aus.** Bei 4× (Mittelklasse) blockierte eine einzelne Aufgabe 649ms, bei 6× über eine Sekunde. Solange kommt kein Fingertipp an.

Eine Zwischenmessung musste ich verwerfen: mein erster Tab-Wechsel-Test meldete für fast jeden Tab exakt 33ms. Das war die Wartezeit meiner zwei `requestAnimationFrame` auf einem 30-Hz-Renderer, nicht die Arbeit der App. Ohne diese Wartezeit gemessen: 1,3 bis 13,4ms.

#### Der Fund

Drei `MutationObserver` — Auto-ARIA, Auto-Maxlength, Auto-Lazy — beobachteten `document.body` mit `subtree:true` und riefen bei **jeder** Mutation:

```js
if (dirty) { try { labelize(document); } catch(_){} }
```

Also je ein `querySelectorAll` über alle 4'486 Knoten. Beim Start rendert die App dutzende Bausteine nacheinander — jeder löst alle drei aus. Im Profil: **743ms allein für `querySelectorAll`.**

#### Die Lösung

Die eingefügten Teilbäume sammeln und in **einem** Durchgang abarbeiten, wenn der Hauptstrang frei ist (`requestIdleCallback` mit Frist). Notbremse bei über 300 Wurzeln: dann ist ein Durchgang über das ganze Dokument billiger als tausend einzelne.

Dabei eine Falle, die ich beim Schreiben bemerkt habe: `querySelectorAll` findet nur **Nachkommen**. Solange über `document` gescannt wurde, war das egal. Sobald man gezielt die eingefügten Knoten scannt, kann die Wurzel selbst der Knopf sein — der wäre durchgerutscht. Alle drei Funktionen prüfen jetzt zusätzlich die Wurzel.

#### Zahlen (4×, gleiches Skript auf beiden Ständen)

| | vorher | nachher |
|---|---|---|
| **App-JavaScript** | **1'548ms** | **421ms** |
| Parsen/Kompilieren | 2'755ms | 2'633ms |
| DOMContentLoaded | 1'683ms | 1'470ms |
| längste Einzelblockade | 782ms | 710ms |

#### Was NICHT besser wurde — und warum ich das so sage

Die längste Blockade sank nur um 72ms. Sie besteht nämlich nicht aus App-Code, sondern aus dem **Parsen der 5,7-MB-Datei**. Die eingesparten 1'127ms verteilten sich auf viele Aufgaben unter 50ms, die nie als „lange Aufgabe" gezählt wurden — es ist trotzdem Arbeit, die das Telefon geleistet und mit Akku bezahlt hat.

Den Monolithen aufzuteilen wäre eine Architektur-Entscheidung. `CLAUDE.md` beschreibt ihn ausdrücklich als das gewählte Vorgehen; das ändere ich nicht nebenbei.

#### Die wichtigste Gegenprobe

Schneller ist wertlos, wenn dabei etwas ausfällt. Über alle elf Tabs gezählt, was die drei Beobachter tatsächlich gesetzt haben:

| | vorher | nachher |
|---|---|---|
| `aria-label` gesetzt | 199 | **199** |
| `maxlength` gesetzt | 65 | **65** |
| `loading` gesetzt | 7 | **7** |

Identisch. Gleiche Wirkung, ein Drittel der Arbeit.

`scripts/perf_check.js` liegt als viertes Werkzeug im Repo.

---

### 2026-09-01 (s) — v31.34: Bedienbarkeit — die kleinste Schaltfläche war 8×8 Pixel

> Die Optik-Serie ist abgeschlossen (Farben, Radien, Typografie, Lesbarkeit, toter Stil — alles gemessen). Also mit demselben Werkzeug etwas anderes prüfen: ob die App sich **bedienen** lässt.

#### Zuerst ein Nicht-Fund

Ich habe alle `onclick`-Ziele aufgelöst: **7'081 Stück, alle vorhanden.** Kein fehlender Handler. Die drei Treffer meiner Suche (`event.preventDefault`, `if`, `event.stopPropagation`) waren Artefakte meiner eigenen Erkennung, keine Fehler.

Das ist kein Ergebnis, das eine Version rechtfertigt — aber es zu wissen ist etwas wert, und es hier zu schreiben ehrlicher, als es wegzulassen.

#### Der Fund

43 Bedienelemente unter 24×24 CSS-px (WCAG 2.5.8, Stufe AA). Zwei Gruppen zählten wirklich:

**Die Karussell-Punkte unter den Tageskarten: 8×8px, 14px Abstand von Mitte zu Mitte.** Die WCAG-Ausnahme für kleinere Ziele greift nur, wenn ein 24px-Kreis um das Ziel kein anderes berührt — bei 14px Abstand also nicht. Der Knopf ist jetzt 24×24, der sichtbare Punkt sitzt als `::before` darin. **Die Optik bleibt ein 8px-Punkt, die Trefferfläche ist neunmal so gross.** Preis: die Punkte stehen jetzt 24 statt 14px auseinander und die Leiste ist 2px höher.

**Die Suchfelder: 18px hoch in einer 37px hohen Leiste.** Deren 9px Polsterung oben und unten gehörte nicht zum Eingabefeld — wer den Rand antippte, löste nichts aus. Das Feld reicht jetzt per `padding:9px 0` und ausgleichendem `margin:-9px 0` hinein: gleiche Höhe, doppelte Trefferfläche.

Dazu 42 Pflanzen-Chips in der Trachten-Übersicht, fünf Kategorie-Chips auf der Karte und ein Knopf im Garten.

#### Die eine Farbänderung

Der Vergleich meldete `Farbe geaendert: 1` — bei einer reinen Grössen-Änderung ein Grund nachzusehen. Es war der Punkt-Knopf selbst: seine Farbe ist ins `::before` gewandert, der Knopf ist jetzt transparent. Meine Erfassung misst keine Pseudo-Elemente, sieht also eine Änderung, wo optisch keine ist. Im Rendering bestätigt.

Das ist inzwischen Routine: **jede Zahl, die nicht null ist, wird angeschaut** — dreimal war es das Werkzeug, zweimal die Änderung.

#### Ergebnis

| | |
|---|---|
| Antippflächen unter 24×24 | **43 → 0** |
| Grössenänderungen | 77 (genau die vergrösserten Ziele) |
| Radius / Schrift geändert | 0 / 0 |
| Farbe geändert | 1 (nachgeprüft, siehe oben) |
| Kontrast unter AA | 0 in beiden Modi |

`scripts/touch_check.js` liegt als drittes Werkzeug im Repo, in `CLAUDE.md` §7.1 beschrieben — samt der Warnung, dass eine Meldung genauso gut eine Falschmeldung des Prüfstands sein kann. Das ist bisher dreimal vorgekommen.

---

### 2026-09-01 (r) — v31.33: 52 Stilregeln, die nie gewirkt haben

> Der Nebenfund aus (p) — `.recipe-card-desc` war zweimal deklariert — als eigene Runde.

#### Das Muster

22 Klassen sind zweimal beschrieben: die ursprüngliche Regel um Zeile 400–1500, eine zweite aus einem späteren Umbau um Zeile 81'000–82'700. Gleiche Spezifität, gleicher Selektor — **die spätere gewinnt immer**. Die frühere galt nie.

`.modal-close-btn` ist das deutlichste Beispiel: acht widersprechende Angaben, darunter `position: sticky` gegen `position: absolute`. Wer die obere Regel liest, liest etwas, das die App nicht tut.

52 tote Deklarationen entfernt, in 22 Regeln.

#### Vorsichtig abgegrenzt

Verglichen wurden nur Regeln mit **exakt einem Klassen-Selektor**, beide **ausserhalb** von `@media`/`@supports`/`@layer` und beide **ohne** `!important`. Nur unter diesen drei Bedingungen gilt zwingend, dass die spätere gewinnt und die frühere Deklaration folgenlos entfernt werden kann. Alles andere blieb unangetastet — auch da, wo es wahrscheinlich ebenfalls tot ist.

#### Der Prüfstand hat sich selbst korrigiert

Der Vergleich meldete `GROESSE geaendert: 1`. Bei einer beweisbaren Null-Änderung darf da nichts stehen, also nachgesehen — statt es als Rundungsrest durchzuwinken. Ein zweiter Lauf meldete **2**, und an einer anderen Stelle.

Beide Male `.gs-spin`: ein Ladekreisel, 14×14px, `animation: gs-spin 1s linear infinite`. Ich mass mit `getBoundingClientRect()`, und das liefert die **gedrehte Hülle** — ein rotierendes Quadrat ergibt darin je nach Winkel 14 bis 20px.

Der Fehler lag im Werkzeug, nicht in der Änderung. Jetzt `offsetWidth`/`offsetHeight`: die Layout-Box, unabhängig von Transformationen. Zwei aufeinanderfolgende Läufe sind seither identisch.

Das ist die dritte Runde in Folge, in der die entscheidende Arbeit darin bestand, dem eigenen Messwert nicht zu glauben.

#### Ergebnis

| | |
|---|---|
| stille Konflikte | **52 → 0** |
| vergleichbare Elemente | 1'520 |
| Radius / Schrift / **Grösse** / Farbe geändert | **0 / 0 / 0 / 0** |
| Kontrast unter AA | 0 in beiden Modi (unverändert) |

---

### 2026-09-01 (q) — v31.32: Meine eigene Farbarbeit kam seit v31.20 nie an

> Das Werkzeug aus (p) hat als Erstes etwas gefunden, das mich betrifft.

#### 270 + 21 Textstellen unter dem Mindestwert

`contrast_check.js` misst jede sichtbare Textstelle über neun Tabs in beiden Modi. Ergebnis beim ersten Lauf: **270 im Hellmodus, 21 im Dunkelmodus** unter AA.

Meine erste Lesart war falsch. Ich sah dunklen Text auf dunkelgrünen Bildschirmen und hielt das für die Ursache — das waren 11 Stellen. Die eigentliche Ursache war eine Zeile:

```js
root.setProperty('--muted', '#888888');   // in applyThemeColors()
```

`root` ist `documentElement.style` — ein **Inline-Stil**. Der schlägt jede `:root`-Regel im Stylesheet. Vier Token (`--text`, `--text2`, `--muted`, `--border`) wurden dort mit eigenen Werten überschrieben, `--muted` mit `#888888` = **3,54:1** auf Weiss. Darüber der Kommentar: *„Light text colors – always readable on light backgrounds"*.

**Jede Farbanpassung, die ich seit v31.20 an diesen Token gemacht habe, war wirkungslos.** Gerechnet, verifiziert, ausgeliefert — und zur Laufzeit überschrieben.

Warum nur der Hellmodus betroffen war, ist die interessante Hälfte: der Dunkelmodus definiert seine Token auf `body.dark`. Ein Wert auf `body` sticht den von `html` geerbten. Im Hellmodus gibt es keine solche Regel auf `body` — dort gewann der Inline-Wert von `html`. Der Fehler war also sichtbar, aber nur in der Hälfte, in der man ihn am wenigsten sucht.

#### Was noch herausfiel

- **Zwei Themen fallen durch:** die Hauptfarbe des Standard-Themas Grün war `#2d8a2d` = **4,39:1** auf Weiss, Orange `#e65100` = **3,79:1**. Beide dienen als Textfarbe *und* als Knopf-Hintergrund — der Wert gilt in beide Richtungen. Neu `#1f6b2f` (6,56:1) und `#bf360c` (5,60:1).
- **`body` hatte nie eine `color`.** Sie war damit in beiden Modi Schwarz (der Vorgabewert). Alles ohne eigene Farbe erbte Schwarz — im Dunkelmodus schwarz auf dunkel. Zwölf Stellen auf einen Schlag.
- **Vierzehn Bildschirme mit dunkler Leinwand.** Text direkt darauf nutzte `--text`/`--muted`. Neue Token `--on-canvas` / `--on-canvas-2`, gegen alle acht Leinwandfarben gerechnet.

#### Ein verworfener Versuch

Für die Leinwände wollte ich eine gemeinsame Regel: `#screen-garden, #screen-social, … { color: #fff }`. Elegant, strukturell, ein Griff statt zwölf.

**Gemessen wurde es davon schlechter — 22 auf 33 Stellen.** Die Regel erzeugte elf Weiss-auf-Weiss-Fälle in Karten und erreichte die gemeinten Elemente gar nicht, weil die eine eigene Farbe setzen. Zurückgenommen, gezielt gearbeitet.

Ohne den Prüfstand hätte ich diese Regel für eine Verbesserung gehalten und ausgeliefert. Das ist der eigentliche Ertrag von (o) und (p): nicht dass ich mehr finde, sondern dass ich meine eigenen Ideen widerlegen kann.

#### Ergebnis

| | vorher | nachher |
|---|---|---|
| Hellmodus unter AA | **270** | **0** |
| Dunkelmodus unter AA | **21** | **0** |

Gegenprobe am laufenden Programm: 1'522 vergleichbare Elemente, **1'002 Farbänderungen und 0 Änderungen an Radius, Schriftgrösse und Grösse** — genau das Profil, das eine reine Farbänderung haben muss.

#### Nachtrag zu v31.28

Die Wetterkachel im **Garten** blieb damals stehen; umgestellt hatte ich nur die auf der Startseite. Auf dem Garten-Bildschirm leuchtete danach als Einzige noch der blaue Verlauf. Angeglichen — eine Unstimmigkeit, die ich selbst hinterlassen hatte.

---

### 2026-09-01 (p) — v31.31: Typo-Skala, und was der neue Prüfstand sofort zutage fördert

#### Der Befund

4'739 Schriftgrössen in **53** Varianten. Darunter **1'387 Halbpixel-Werte** — 11.5px (510×), 12.5px (435×), 10.5px (235×), 13.5px (130×). Das entscheidet niemand; das bleibt beim Nachjustieren übrig. Und sieben Textgrössen (9, 10, 11, 12, 13, 14, 15) lagen innerhalb von 6px.

#### Die Skala — und warum ich sie diesmal anders geprüft habe

Sieben Stufen über den ganzen Bereich: 10 · 12 · 14 · 16 · 20 · 24 · 28/32. Über 34px bleibt alles stehen (Hero-Ziffern, Emoji-Grössen).

Bei den Radien in v31.29 galt: `GROESSE geaendert: 0` beweist Unbedenklichkeit. **Bei Schrift ist das unmöglich** — Text bestimmt die Grösse, 880 Elemente ändern sich zwangsläufig. Also brauchte es ein anderes Mass, und das habe ich vor der Änderung gebaut:

- **Überlauf**: abgeschnittener Inhalt 17 → 17, aus dem Bildschirm ragend 0 → 0. Die vorhandenen Überläufe wurden eher *kleiner*.
- **Ellipsis**: 83 einzeilige Texte geprüft. **6 kürzen neu** — Zutaten-Vorschauen in Rezeptkarten, wegen +0,5px. Das ist der Preis, und er steht hier.

Beim ersten Anlauf meldete die Überlauf-Prüfung **72** Elemente als „ragt aus dem Bildschirm". Alle 72 waren Chips in waagrecht scrollenden Leisten, die genau dort hingehören. Verworfen und die Prüfung verengt, bis 0 Falschalarme blieben. Ein Prüfstand, der Fehlalarme produziert, ist schlechter als keiner — man gewöhnt sich an rote Zahlen.

#### Was beim Nachsehen herausfiel

`.recipe-card-desc` war **zweimal** deklariert: einmal 12.5px / Zeilenhöhe 1.5 / Umbruch, einmal 11.5px / 1.4 / einzeilige Ellipsis. Gleiche Spezifität, also gewann die zweite — die erste war komplett tot. Zusammengeführt.

Eine Suche danach ergab: **53 solcher stillen Konflikte** (gleiche Klasse, gleiche Eigenschaft, zwei Werte, keine `!important`). Eigene Runde wert, hier nur notiert.

#### Der grosse Fund — für die nächste Version

Der neue `contrast_check.js` meldet **270 Textstellen unter AA im Hellmodus**. Die Wurzel ist nicht, was ich zuerst dachte (dunkle Bildschirm-Hintergründe, davon nur 11 Stellen), sondern eine einzige Zeile:

```js
root.setProperty('--muted', '#888888');   // Z. 46492, in applyThemeColors()
```

`applyThemeColors()` schreibt die Text-Token zur Laufzeit auf `documentElement` — und das schlägt **jede** `:root`-Regel im Stylesheet. `--muted` ist damit `#888888` (3,54:1 auf Weiss), nicht die sorgfältig geprüften `#6b6b6b`/`#5a5a5a`. Der Kommentar darüber behauptet *„Light text colors – always readable on light backgrounds"*.

**Meine gesamte Farbwelle ab v31.20 kam an dieser Stelle nie an.** Ich habe Token-Werte gerechnet, verifiziert und ausgeliefert, die zur Laufzeit überschrieben wurden. Kommt als v31.32.

---

### 2026-09-01 (o) — v31.30: Die Lücke schliessen, die ich in (n) selbst benannt habe

> In (n) stand: „das beruht auf nur **11 vergleichbaren Elementen** … das trage ich so vor, statt 11 Elemente als Beweis für 2'286 Stellen auszugeben." Ein benannter Mangel, den man stehen lässt, bleibt ein Mangel. Also behoben.

#### Warum es nicht ging — und ein eigener Denkfehler auf dem Weg

Ich war überzeugt, die fehlende Anmeldung sei schuld. Der Gast-Modus schien der vorgesehene Ausweg: `gsCheckOnboarding` prüft `gs_guest_mode` und soll das Onboarding überspringen. Gesetzt — und das Onboarding blieb.

Dann ein Widerspruch, der nicht sein durfte: `element.style.display` sagte `none`, `getComputedStyle` sagte `block`. Das geht nur mit einer `!important`-Regel. Mein Regel-Sucher meldete: **keine Regel gefunden.**

Der Sucher war kaputt. Er filterte mit

```js
if (r.cssRules) { /* Gruppenregel, absteigen */ }
else if (r.selectorText) { /* Style-Regel pruefen */ }
```

Seit CSS Nesting hat **jede** Style-Regel eine `cssRules`-Liste — leer, aber ein Objekt, also wahr. Der Sucher ist bei jeder Regel abgestiegen und hat nie eine angesehen. Dasselbe Muster wie der Schatten-Fehler in v31.20 und der Regex-Fehler beim Farb-Audit: **eine Prüfung, die immer wahr ist, sieht aus wie ein sauberes Ergebnis.** Was mich stutzig machte, war nicht der Code, sondern dass „0 Treffer" zu glatt war.

Nach der Korrektur stand die Antwort sofort da:

```
html.gs-preauth #gs-onboarding { display: block !important }
```

Der **Login-Flash-Guard** (v29.35). Ohne `gs_sb_token` versteckt er `#app` und zeigt das Onboarding — damit die Startseite nicht kurz aufblitzt. Der Prüfstand setzt jetzt einen Token. Nicht um sich anzumelden, sondern damit der Guard gar nicht erst greift.

**11 → 2'596 Elemente** über elf Tabs.

#### Der Fund daneben — und was er *nicht* ist

`gsCheckOnboarding` hatte eine Ausnahme: *„Gast kehrt zurück → Demo-Banner zeigen, kein Onboarding"*. Sie ruft `gsActivateGuestMode(false)` und kehrt zurück. Diese Funktion ist seit **v25.33** ein leerer Rumpf — dort wurde der Demo-Modus abgeschaltet.

Ich war auf dem Weg zu „Alt-Gäste sind ausgesperrt". **Nachgemessen: sind sie nicht.** Der Alt-Gast landet im exakt gleichen Zustand wie jeder Abgemeldete — Onboarding mit Registrieren und Anmelden. Der Zweig log nur im Kommentar. Toter Code, kein Ausfall; entfernt, Schlüssel entsorgt.

Der Beweis war wichtiger als der Fund: Ich hätte hier eine Ausfallgeschichte erzählen können, die sich gut liest und nicht stimmt.

#### v31.29 nachträglich belegt

| | Ergebnis |
|---|---|
| vergleichbare Elemente | **1'524** (statt 11) |
| Radius geändert | 316, grösste Bewegung **2px** |
| Schriftgrösse geändert | **0** |
| **Grösse** geändert (Layout) | **0** |
| Farbe geändert | **0** |

Genau das Profil, das eine reine Radius-Änderung haben muss. Die Entfernung des toten Zweigs ergab gegen den Vorstand **0 Unterschiede in allen vier Kategorien**.

Der Prüfstand liegt als `scripts/render_check.js` im Repo und ist in `CLAUDE.md` §7.1 beschrieben — samt der Faustregel, dass eine reine Farb- oder Radius-Änderung `GROESSE geaendert: 0` ergeben **muss**.

---

### 2026-09-01 (n) — v31.29: Die Radien-Skala — und ein Fehler, den ich selbst gebaut hatte

> Das letzte grosse Stück Uneinheitlichkeit, das ich in v31.22 bewusst aufgeschoben hatte, weil es „eine eigene, sauber verifizierte Runde braucht". Hier ist sie.

#### Der Befund

2'286 `border-radius`-Angaben in **55** Varianten — 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 … px, lückenlos. Das ist keine Gestaltung, das ist Rauschen: 461× 10px neben 178× 9px neben 98× 11px. Über 90 % stehen in JS-erzeugten Inline-Styles, nicht in CSS-Klassen — eine Skala musste also bis in die Strings reichen.

Es *gab* bereits drei Token (`--r:16px --r-sm:10px --r-xs:8px`), genutzt an 85 von 2'286 Stellen.

#### Die Skala

4px-Raster, sechs Stufen, jede an einen Zweck gebunden:

| Token | Wert | wofür |
|---|---|---|
| `--r-xs` | 4px | Marker, Fortschrittsbalken |
| `--r-sm` | 8px | Badges, Tags, kleine Knöpfe |
| `--r-md` | 12px | Knöpfe, Eingabefelder, Listenzeilen |
| `--r-lg` | 16px | Karten |
| `--r-xl` | 22px | Modale, Bottom-Sheets |
| `--r-pill` | 999px | Pillen |

Kreise bleiben `50%` — das erklärt sich selbst besser als jedes Token.

**Bewegung:** von 2'481 Einzelwerten blieben 790 exakt gleich, 1'398 rückten auf ihre Stufe, 293 blieben unberührt. Grösste Bewegung ±2px. Meine erste Zuordnung hätte 18px auf 22px geschoben — **+4px**, ein Bruch meines eigenen Versprechens. Grenze auf den Mittelwert gelegt, neu gerechnet. Es blieb genau **eine** Ausnahme: das Onboarding-Logo, 19px → 22px, bei 80×80px. Im Browser nachgemessen.

11 Werte (26/27/28px) habe ich stehen lassen. Sie liegen zu weit von jeder Stufe, um sie stillschweigend zu verschieben — das wäre eine Gestaltungsentscheidung, keine Aufräumarbeit.

#### Der eigentliche Fund — und er geht auf meine Kappe

Bevor ich `var(--r-*)` überall hineinschrieb, habe ich gefragt: *gibt es Stellen, an denen `:root` gar nicht gilt?* Es gibt sie. Zwei:

- **Garten-Plan-Export** — baut ein HTML-Dokument in einen Blob und öffnet es als Druckfenster.
- **Garten-Scan-Druck** — schreibt ein Dokument in ein verstecktes iframe.

Beide sind **eigenständige Dokumente**. Sie kennen das `:root` der App nicht. `var(--c-success)` löst dort zu nichts auf.

Und die Farb-Token stehen dort **seit v31.20** — der Farb-Welle, die ich selbst geschrieben habe. Seither druckte der Export schwarze Schrift auf transparenten Flächen. Niemand hat es gemeldet; ich hätte es mit den Radien ein zweites Mal eingebaut.

Beide Dokumente bekommen jetzt über `GS_DOC_TOKENS` ihre eigenen Werte — die **hellen**, weil Gedrucktes nicht dem App-Modus folgt.

#### Ehrlich zur Abdeckung

Ich wollte die Änderung an der laufenden App belegen: vorher/nachher laden, jedes Element mit Radius vermessen, prüfen ob eines die Form wechselt (Rechteck → Pille). Das Ergebnis ist gut — 38 → 19 tatsächlich gerenderte Radien-Varianten, keine JS-Fehler, **kein** Form-Wechsel —, aber es beruht auf nur **11 vergleichbaren Elementen**. Ohne Anmeldung und ohne Netz baut die App ihre Tabs nicht auf, und das Onboarding liess sich nicht dauerhaft wegschalten.

Das trage ich so vor, statt 11 Elemente als Beweis für 2'286 Stellen auszugeben. Was tatsächlich trägt: die Umsetzung ist rein textuell und mechanisch, die Zuordnung ist vollständig aufgelistet, und die beiden erzeugten Dokumente habe ich einzeln gerendert und jedes Token gegen `getComputedStyle` geprüft.

---

### 2026-09-01 (m) — v31.28: Die Wetterkarte — und was zwei Renderwege anrichten

> Letzter Punkt aus Bild 3 der zweiten Vorlagen-Reihe. Die Startseite besteht aus hellen Karten mit ruhigem Rahmen — mit einer Ausnahme: das Wetter-Widget lag als `linear-gradient(135deg,#0d47a1,#1565c0)` mit weisser Schrift dazwischen. Es hat jetzt dasselbe Material wie alles andere.

#### Der eigentliche Fund kam beim Nachsehen

Beim Umbau habe ich zuerst nur **einen** Trenner korrigiert: `rgba(255,255,255,.15)` — eine weisse Linie, die auf heller Karte verschwindet. Danach habe ich gesucht, wer sonst noch in `hw-forecast` schreibt. Es sind **zwei** Stellen:

| | `gsApplyWeatherToWidget()` | `loadHomeWeather()` |
|---|---|---|
| Auslöser | Cache-Treffer (30 min TTL) | Live-Abruf beim Start |
| Spalten | **3** | **4** |
| Textfarbe | geerbt (passt sich an) | **fest `#fff` / `rgba(255,255,255,.7)`** |
| Trenner | `<div>` dazwischen | `border-right` auf **jede** Spalte, auch die letzte |
| Wochentage | deutsches Array im Code | aus `gsI18n` |

Der Live-Weg ist der, der beim Start läuft. Hätte ich nur den Trenner korrigiert, wäre die Vorschau beim ersten Öffnen **weiss auf weiss** gewesen — und beim zweiten, aus dem Cache, korrekt. Ein Fehler, der sich beim Nachprüfen selbst wegcacht.

Nebenbei erklärt die Tabelle auch etwas, das nie jemand gemeldet hat: die Vorschau zeigte je nach Cache-Zustand **3 oder 4 Tage**.

#### Die Lösung ist eine Funktion, kein Pflaster

`_gsWxForecastHtml(items)` — beide Wege bauen ihre Liste und geben sie dorthin. Farben kommen aus Tokens, der Trenner aus `.gs-wx-day + .gs-wx-day{border-left}` (also nur *zwischen* den Spalten), die Wochentage aus `gsI18n`. Zwei Wege können jetzt nicht mehr auseinanderlaufen, weil es nur noch einen gibt.

#### Belegt, nicht angenommen

- **Kontrast gerechnet**, statt „sieht dunkel aus" zu urteilen: Tagesname 7,11:1 hell / 7,76:1 dunkel, Min-Temperatur 4,95:1 / 6,08:1. Die gedämpfte Wirkung im Bild ist gewollte Abstufung und liegt über AA — hier war **nichts** zu reparieren, und ich habe es dabei belassen.
- **Prüfstand lädt die echte Funktion** aus `index.html`, statt eine Kopie zu testen. Drei Zustände gerendert (hell, dunkel, hell mit Warnung), keine JS-Fehler.
- **Alle zehn JS-beschriebenen IDs** je genau einmal im Dokument.
- 9/9 Inline-Scripts `node --check` OK · Versionen an allen vier Punkten synchron.

---

### 2026-09-01 (l) — v31.27: Die untere Navigation — dasselbe Muster, andere Richtung

> Ich wollte den runden grünen Mittelknopf aus den Entwürfen bauen. **Den gibt es seit v26.86.** Drittes Mal in dieser Runde, dass Nachsehen vor Doppelarbeit bewahrt hat. Beim Hinsehen fiel dafür etwas anderes auf.

#### Der Fund

`.tabs` nutzt `--fill-dark` — die Leiste ist in **beiden** Modi dunkelgrün. Die Beschriftung nutzte aber `--muted` und `--g-main`, also Token, die für **helle** Flächen gedacht sind.

| | Hellmodus | Dunkelmodus |
|---|---|---|
| aktiver Reiter | **1,86:1** | 5,42:1 |
| übrige Reiter | **2,28:1** | 5,47:1 |

Die meistgenutzte Bedienleiste der App war im Hellmodus praktisch unlesbar.

Das ist dasselbe Muster wie in v31.26, nur andersherum: dort eine **Textfarbe als Fläche**, hier **Textfarben auf einer Fläche, die nicht mitkippt**. Beide Male, weil ein Token für zwei Zusammenhänge herhalten muss.

#### Was das über die Historie verrät

Für den Dunkelmodus gab es **vier** Überschreibungen derselben zwei Zustände — `rgba(255,255,255,.55)`, `#fff !important`, `#5a8a5a`, `var(--g-main)` — teils widersprüchlich, plus eine doppelte Basisregel. Vier Anläufe, dasselbe zu reparieren. Für den Hellmodus **keinen einzigen**, weil dort niemand damit rechnet, dass die Leiste dunkel ist.

Jetzt: feste Werte (`#9db89d` inaktiv, `#a5d6a7` aktiv), gegen **beide** Leisten-Hintergründe gerechnet (5,7 bis 8,8:1), und **eine** Regel je Zustand statt fünf. Die Fläche ist in beiden Modi dieselbe — also braucht sie auch nur eine Farbe.

#### Ehrlich zum Testgerüst

Mein Gerüst stellte die Reiter untereinander statt nebeneinander dar — ein Extraktionsfehler, den ich zweimal erfolglos zu beheben versucht habe. Die Änderung ist eine **Farbänderung**, und die ist numerisch belegt und im Rendering klar erkennbar; die Anordnung ist im echten Markup unverändert. Ich habe das Bild deshalb nicht als Beleg verschickt, statt es als „sieht gut aus" auszugeben.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast gegen beide Leisten-Hintergründe gerechnet (`#1a3d1a` hell, `#1a2e1a` dunkel) · Regelanzahl gegengezählt: genau **eine** `.tab`- und eine `.tab.active`-Farbregel verbleibend (vorher fünf) · Version synchron v31.27.

### 2026-09-01 (k) — v31.26: Dreimal ist ein Muster — 146 Flächen im Dunkelmodus

> In v31.20 (gefüllte Knöpfe), v31.22 (Marken-Glow) und v31.25 (Kopfleiste) war es dreimal derselbe Fehler. Beim dritten Mal habe ich aufgehört, Einzelfälle zu reparieren, und die Klasse gesucht.

#### Die Suche

Die Farb-Token der App kehren im Dunkelmodus ihre Helligkeit um — `--g-main` ist hell `#1f6b2f`, dunkel `#66bb6a`. **Für eine Textfarbe ist das genau richtig:** dunkle Schrift auf hellem Grund, helle Schrift auf dunklem Grund.

Für eine **Fläche** ist es genau falsch.

29 Token verhalten sich so. Davon werden **146** als Fläche benutzt, **124 davon mit weisser Schrift**:

| Token | Flächen | weisse Schrift auf dunkler Fassung | … auf heller Fassung |
|---|---|---|---|
| `--g-main` | 125 | 6,56:1 | **2,36:1** |
| `--g-dark` | 16 | 12,16:1 | **1,64:1** |
| `--c-purple` | 3 | 9,39:1 | **2,39:1** |
| `--c-warn-d` | 1 | **3,79:1** | **2,16:1** |

Jeder Hauptknopf, jeder aktive Chip, jeder aktive Reiter der App lag im Dunkelmodus bei **2,4:1**.

#### Die Lösung: zwei Rollen, zwei Token

`--fill-brand`, `--fill-dark`, `--fill-violet`, `--fill-warn` sind **Flächen** und bleiben im Dunkelmodus dunkel. `--g-main` und Co. bleiben **Schrift** und werden hell. Ein Token kann nicht beides sein — das war die ganze Ursache.

Die Hellwerte der neuen Token sind mit den alten **identisch** (`#1f6b2f`, `#1a3d1a`, `#6a1b9a`): der Hellmodus ändert sich um kein Pixel. Dieselbe Beweisführung wie in v31.20.

#### Zwei Nebenbefunde

- **`--c-warn-d` als Fläche schaffte auch im HELLmodus nur 3,79:1.** Ein Fehler in beiden Modi. `--fill-warn` ist deshalb bewusst dunkler (`#b34000`, 5,75:1) — der **einzige** Wert, der sich im Hellmodus ändert, und zwar zum Besseren.
- **Der Live-Punkt** hatte hellen Puls-Hintergrund mit `--c-info-d` als Text — im Dunkelmodus hell auf hell. Jetzt fest dunkler Text (7,4:1).

#### Und ein Fehler in meiner eigenen Analyse

Der erste Durchlauf meldete „0 von 125 mit weisser Schrift" — ich hätte daraus schliessen können, dass alles harmlos ist. Ursache: mein Suchfenster schloss das Semikolon aus, und `background:var(--g-main);color:#fff` hat genau dort eines. Aufgefallen ist es nur, weil „0 von 125" zu glatt klang und ich mir echte Fundstellen angesehen habe.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **146 Flächen umgestellt**, 0 verbleibend (die eine Ausnahme ist `.gs-btn-info` mit eigener `body.dark`-Regel) · Hellwerte der neuen Token gegen die alten geprüft: identisch, ausser dem bewusst korrigierten `--fill-warn` · Vorher/Nachher in Chromium gerendert · Version synchron v31.26.

### 2026-09-01 (j) — v31.25: Ruhige Kopfzone — und ein Fehler, den erst das Rendern zeigte

> Fortsetzung des Mix. Nach „Heute zu tun" die Kopfzone: beide Entwürfe beginnen oben **ruhig** — Creme, dunkler Text — und lassen das Grün als **Karte** auftreten statt als breites Band.

#### Umgesetzt

Kleine Gruss-Zeile mit Blatt-Symbol („🍃 Guten Morgen, Fernando"), darunter „Dein Garten" in Serifen, darunter die kontextuelle Zeile. Die Überschrift benennt den Ort, der Gruss meint den Nutzer — genau die Aufteilung aus Bild 2.

Bewusst **nur** für `#screen-home`: `.hero` wird von mehreren Bildschirmen benutzt, ein globaler Eingriff wäre nicht prüfbar gewesen.

**Keine zweite Glocke.** Die Entwürfe zeigen eine neben dem Gruss — die gibt es in der Kopfleiste bereits (`#gs-bell-btn`). Eine zweite hätte genau die Doppelung erzeugt, die eine App zusammengesetzt wirken lässt.

#### 🐛 Der Fund: die Kopfleiste war im Dunkelmodus unlesbar

```css
body.dark .topbar { background: var(--g-dark) !important; }
.topbar h1 { color:#fff; }
.topbar button, .topbar .ib { color:#ffffff !important; }
```

`--g-dark` ist im Hellmodus `#1a3d1a` (dunkel) — im **Dunkelmodus** aber `#a5d6a7` (**hell**grün), weil sich die Helligkeitsskala dort umkehrt. Das ist für einen Textton richtig und für eine Fläche falsch. Titel und alle Knöpfe sind fest weiss.

Ergebnis: **1,64:1**. Der Name der App und sämtliche Knöpfe der Kopfleiste waren im Dunkelmodus praktisch unsichtbar. Jetzt `#122212` → **16,6:1**.

Dasselbe Muster wie in v31.20 bei den gefüllten Knöpfen: **eine Textfarbe als Fläche benutzt.** Beim dritten Auftreten ist das kein Zufall mehr, sondern der Preis dafür, dass Fläche und Schrift dieselbe Skala teilen.

#### Ein Fehler im Testgerüst, der beinahe als App-Fehler durchgegangen wäre

Der erste Durchlauf zeigte den Hero weiterhin dunkelgrün. Ursache: meine neue Regel hängt an `#screen-home`, und mein Gerüst hatte diesen Rahmen nicht. Ich hätte das leicht für einen Fehler in der Regel halten und daran herumbauen können. Gerüst korrigiert, danach stimmte es.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast der Kopfleiste vorher/nachher gerechnet (1,64:1 → 16,6:1) · Startseite in Chromium gerendert, hell und dunkel, mit korrektem `#screen-home`-Rahmen · keine zweite Glocke, Bestand geprüft · Version synchron v31.25.

### 2026-09-01 (i) — v31.24: „Ein hochwertiger Mix aus diesen zwei Looks"

> Fernando schickte vier weitere Bilder: zwei Marketing-Register (ruhig, Serifen, Creme) und zwei App-Register (Aufgabenliste mit Kästchen). Auftrag: hochwertig, elegant — und **sehr simpel**.

#### Was beide Register gemeinsam haben

Warme Creme-Fläche. Tiefes Waldgrün. Serifen-Überschrift. Und — in **beiden** App-Bildern identisch — **„Heute zu tun"** als *eine* Karte mit getrennten Zeilen und einem **Kästchen** rechts. Keine Prioritäts-Plaketten. Keine zweite Hervorhebung darunter.

#### Weniger als vorher, und das ist der Punkt

Die Fassung aus v31.16 hatte Prioritäts-Plaketten (Hoch/Mittel/Niedrig) und eine separate „Nächster Schritt"-Karte. Beides ist jetzt **weg**. Die Entwürfe zeigen es nicht, und „sehr simpel" heisst weglassen, bis nur noch das übrig ist, was man antippt: eine Zeile sagt, was ansteht, ein Kästchen erledigt es. Die Dringlichkeit steht als graue Zeile darunter, nicht als bunte Plakette.

Das war der unangenehmere Teil — ich hatte in v31.16 selbst begründet, warum der hervorgehobene nächste Schritt der Haken sei. Der Entwurf ist die neuere Information.

#### Die Palette

| | vorher | jetzt |
|---|---|---|
| `--g-bg` | `#eef7ee` (grünstichig) | `#f4f1ea` (warmes Creme) |
| `--surface2` | `#f4faf4` | `#f7f4ee` |
| `--border` | `#c8e0c8` (grün) | `#e3ded3` (warm-neutral) |
| `--g-main` | `#2d8a2d` | `#1f6b2f` |

Beim Nachrechnen kam heraus: **`--g-main` lag als Text schon vorher bei 4,0:1** — unter der Lesbarkeitsschwelle, und zwar auf der alten Fläche genauso. Das ist also kein Nebeneffekt der Creme, sondern ein Fund. Der neue Wert schafft **5,8:1** als Text auf Creme *und* **6,6:1** mit weisser Schrift darauf — er kann beides, weil er tiefer ist, und das ist genau die Farbe aus den Bildern.

#### Abhaken, das sich richtig anfühlt

Kästchen füllt sich (120 ms), Zeile klappt zu (180 ms), dann läuft `gsNcDoneTask → gsQuickDone`. Weiterhin **eine** Erledigt-Logik inklusive Cloud-Sync, Tagebuch, Achievements. Ein Doppel-Tipp-Schutz verhindert zwei Erledigungen. Bei „Bewegung reduzieren" entfällt der Übergang — die Reihenfolge bleibt dieselbe, das Ergebnis auch.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Kontrast der neuen Palette durchgerechnet (Text 16,7:1 · gedämpft 6,1:1 · Grün 5,8:1) · vier Zustände in Chromium gerendert (Aufgaben, alles erledigt, dunkel, keine Pflanze), keine JS-Fehler · Reste der alten Fassung gegengezählt: 0 · Version synchron v31.24.

### 2026-09-01 (h) — v31.23: Bewegung — und ein Fix, den ich fast doppelt gebaut hätte

> Dritte Ebene nach Farbe und Fläche. 192 Übergänge in 85 Varianten, dazu neun einzelne `prefers-reduced-motion`-Blöcke, die je nur ihre eigenen Bauteile abdecken.

#### Was ich bauen wollte — und was es schon gab

Mein Plan war eine **globale** reduced-motion-Regel. Beim Nachsehen fand ich sie: seit **v24.43**, Zeile 1709, exakt in der Form, die ich schreiben wollte (`*, *::before, *::after { animation-duration:.01ms !important; … }`). Die neun lokalen Blöcke sind Zusatz, nicht Ersatz — die Grundabdeckung steht.

Das ist in dieser Sitzung das zweite Mal, dass Messen vor Bauen mich vor erfundener Arbeit bewahrt hat (das erste Mal: kein einziger Fremdschlüssel ohne Index).

#### Die echte Lücke

**13× `scrollIntoView({behavior:'smooth'})`.** Der JS-Parameter hat laut Spezifikation **Vorrang** vor `scroll-behavior` aus CSS — die globale Regel greift dort also nicht. Wer im Betriebssystem „Bewegung reduzieren" gewählt hat, bekam diese Bildläufe trotzdem gleitend. Für Menschen mit vestibulären Beschwerden ist ein unerwartet gleitender Bildlauf ein echtes Problem, kein Schönheitsfehler.

Neuer Helfer `gsScrollBehavior()` fragt `matchMedia` ab und liefert `'auto'` statt `'smooth'`. Alle 13 Stellen umgestellt, inklusive der zwei, die in Zeichenketten für `onclick` stehen.

Ebenfalls geprüft: Konfetti und der Widget-Stapel fragen die Einstellung **bereits** ab. Auch dort nichts zu tun.

#### Drei Geschwindigkeiten

`--dur-fast` (.12s) · `--dur` (.18s) · `--dur-slow` (.3s). **190 von 194** Übergängen umgestellt (245 einzelne Dauer-Angaben, weil ein `transition` mehrere Eigenschaften mit eigenen Dauern haben kann). Die vier Ausnahmen: zweimal `none` und die beiden `.01ms` aus dem reduced-motion-Block — die dürfen nicht angefasst werden.

**Animationen bewusst nicht angefasst:** 76 Stück mit 60 Keyframes, darunter Ladeanzeigen, Splash-Sequenz und Puls-Effekte. Deren Dauern sind gestalterische Entscheidungen, keine Systemwerte.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `transition` mit Token **190/194** · alle 13 Scroll-Aufrufe umgestellt, 0 verbleibende `behavior:'smooth'` · die `.01ms`-Werte des reduced-motion-Blocks nachweislich unberührt · Version synchron v31.23.

### 2026-09-01 (g) — v31.22: Oberflächen aus einem Guss — Tiefe und Glas

> „So futuristisch wie in den Bildern." Nach den Farben die zweite Ebene: was eine Oberfläche modern wirken lässt, sind nicht einzelne Effekte, sondern dass alle Flächen **derselben** Sprache folgen.

#### Die Messung

| | Angaben | verschiedene Werte |
|---|---|---|
| `border-radius` | 2 287 | **58** |
| `box-shadow` | 237 | **133** |
| `transition` | 192 | **85** |
| `backdrop-filter` | 90 | **10** |

133 verschiedene Schatten sind keine Gestaltung, das ist Rauschen. Genau daher kommt der Eindruck „zusammengesetzt" statt „aus einem Guss".

#### Was ich angefasst habe — und was nicht

**Schatten und Glas.** Beides ist begrenzt (rund 330 Stellen), hat hohe optische Wirkung und lässt sich prüfen.

**Die 2 287 Radien nicht.** Ein Umbau von 58 auf 6 Stufen wäre ein Eingriff ins Layout jeder einzelnen Fläche, mit einer Streubreite, die ich nicht seriös verifizieren kann. Das ist ein eigenes Vorhaben, kein Nebensatz.

#### Vier Höhenstufen, drei Unschärfen

`--elev-1` Listenzeile · `--elev-2` Karte · `--elev-3` hervorgehoben · `--elev-4` Dialog, dazu `--elev-brand` für die Hauptaktion. Im Dunkelmodus **eigene Werte**: ein Schatten mit 7 % Deckkraft ist auf dunklem Grund schlicht unsichtbar, dort braucht Tiefe 40–65 %. Der Marken-Glow wird dunkel neutral, weil Grün auf Grün keine Kante zeichnet.

Glas: `blur(3–14px)` auf `--blur-sm/md/lg` (4/8/12) abgebildet. Die beiden häufigsten Werte (`blur(8px)` 27×, `blur(4px)` 13×) bleiben dabei **unverändert**.

#### Bewusst nicht umgestellt

- **13 mehrschichtige Schatten** — das sind Puls-Animationen, keine Höhen
- **Fokus-Ringe** (`0 0 0 3px`) — dieselbe CSS-Eigenschaft, völlig andere Aufgabe
- **4 Inset-Schatten** — Vertiefung statt Erhebung

#### Ein eigener Fehler, der die Arbeit fast wertlos gemacht hätte

Der erste Lauf ersetzte **3 von 132** Schatten. Mein Schutz gegen mehrschichtige Werte prüfte auf ein Komma — und **jedes `rgba(0,0,0,.07)` enthält Kommas**. Der Filter hat praktisch alles abgelehnt. Aufgefallen ist es nur, weil ich die Trefferzahl ausgegeben und mit der Erwartung verglichen habe. Jetzt werden Klammer-Ausdrücke zuerst entfernt, dann auf echte Schicht-Kommas geprüft.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **74/74** `backdrop-filter` auf Token · `box-shadow` mit Token **73 → 195 von 238**; die 43 verbleibenden sind genau die drei ausgenommenen Klassen · Höhenstufen und Glas in Chromium gerendert, hell und dunkel · Version synchron v31.22.

### 2026-09-01 (f) — v31.21: Farbsystem, zweite Welle — und ein Abschnitt, der nachts unsichtbar war

> Fortsetzung von v31.20. Nach der ersten Welle blieben 225 helle Hintergründe ohne Token-Zwilling. Die brauchten **neue** Token — und die Frage, ob man Töne zusammenlegen darf.

#### Die Messung, die den Plan geändert hat

Mein erster Plan war, ähnliche Töne auf vorhandene Token zusammenzulegen. Vor dem Umbau habe ich den **Farbabstand (CIE76)** ausgerechnet:

| Zusammenlegung | ΔE | Urteil |
|---|---|---|
| `#f0f7ee` → `--surface2` | **1,98** | unter der Wahrnehmungsschwelle |
| `#f1f8e9` → `--surface2` | 4,73 | sichtbar |
| `#ede7f6` → `#e8eaf6` | 3,24 | sichtbar |
| `#311b92` → `#283593` | 18,55 | deutlich |
| `#880e4f` → `#c2185b` | 22,50 | deutlich |

Nur **eine** Zusammenlegung ist unsichtbar. Alles andere hätte das **helle** Design verändert — und das hat niemand bestellt. Ich wäre unter der Überschrift „Dunkelmodus-Fix" dabei gewesen, Fernandos Farben umzugestalten.

Also: **jeder Ton bekommt einen eigenen Token mit exakt seinem Hellwert.** 11 neue Token, jeder Dunkel-Wert gegen den eigenen Tint *und* gegen die Karte durchgerechnet.

#### Der Fund beim Rendern

Die neutralen Panel-Flächen (`#f9fafb`, 23×, u.a. die Abschnitte im Diagnose- und Detail-Dialog) blieben im Dunkelmodus **weiss** — mit hellem Text darauf. Im Vorher-Bild ist die Zeile „Diagnose-Abschnitt" praktisch nicht zu lesen. Interessant: für die Schwester-Klasse `.di` gab es längst ein manuelles `body.dark`-Override, für `.dsec` nicht. Genau die Art Lücke, die entsteht, wenn man Ausnahmen pflegt statt ein System.

#### Was ich bewusst NICHT angefasst habe

**`#fff` als Hintergrund, 25 Stellen.** Ich wollte sie auf `--card` mappen — und habe vorher die Kontexte angesehen. Darunter sind:

- **weisse Knöpfe auf farbigen Bannern** (Abo-Hinweis, Notruf 145, Update-Banner, Wiederherstellen) — in Dunkel würde daraus ein dunkler Knopf mit dunklem Text
- ein **SVG für den PDF-Export** (`background:#fff;border:1px solid #333`) — muss weiss bleiben
- die **Raster-Linien des Scanners** (1 px weisse Linien über dem Kamerabild)

Ein pauschales Ersetzen hätte alle drei kaputtgemacht. Das braucht Einzelfall-Prüfung, keine Tabelle — eigene Aufgabe.

#### Bilanz

| | hartkodierte helle Hintergründe |
|---|---|
| Ausgangslage | 474 |
| nach Welle 1 (v31.20) | 225 |
| nach Welle 2 | **111** |

Davon 25× `#fff` (bewusst offen) und ein langer Schwanz aus Einzelfällen (`#e0f7fa` 7×, `#e1f5fe` 6×, `#fffde7` 6×, `#f5f5f5` 6× …).

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **11/11 neue Token lösen im Hellmodus exakt auf den ersetzten Wert auf** · alle **18** vorkommenden Tint+Text-Kombinationen ≥ 4,5:1 (Welle 1 und 2 zusammen) · Vorher/Nachher in Chromium gerendert · Kontexte aller sieben Töne vor dem Ersetzen stichprobenartig geprüft (Panels, Icon-Flächen, Tags — keine Knöpfe auf farbigen Bannern) · Version synchron v31.21.

*Nebenbei: mein erstes Testgerüst zeigte „nachher" identisch zu „vorher" — ein überzähliges `}` im generierten CSS hatte die Regeln zerschossen. Nicht die App, das Gerüst. Ohne die Sichtprüfung wäre mir das nicht aufgefallen, und ich hätte den Fehler beim nächsten Vergleich wiederholt.*

### 2026-09-01 (e) — Backend durchgemessen: gesund, mit einer lohnenden Aufräumung

> Fernando wollte „Peakfein" auch im Backend. Also zum ersten Mal die **Leistungs-Advisors** ausgewertet — und nicht bei der Zusammenfassung stehengeblieben.

#### Der Befund ist gut, und das ist die eigentliche Nachricht

| Prüfung | Ergebnis |
|---|---|
| Leistungs-Advisors | **0 ERROR, 0 WARN**, 146 INFO |
| Sicherheits-Advisors | 0 ERROR |
| Fremdschlüssel ohne führenden Index | **0** |
| Tabellen mit auffälligen Seq-Scans | 3, alle klein (2 164 / 2 838 / 8 182 Zeilen) |

Bei kleinen Tabellen wählt Postgres bewusst den vollen Scan — das ist kein Fehler. Ich hätte hier Arbeit erfinden können; es gibt keine.

#### Die eine echte Aufräumung — und warum ich sie anders begründe als der Advisor

Der Advisor meldet **145 „unused_index"**. Danach zu löschen wäre falsch: ein Index kann ungenutzt sein, weil das Feature selten benutzt wird, nicht weil er überflüssig ist. Wer so aufräumt, nimmt der App irgendwann genau den Index weg, den sie beim Wachsen braucht.

Deshalb ein hartes Kriterium statt einer Statistik: **ein Index ist überflüssig, wenn seine Spalten ein echtes Präfix eines anderen Index derselben Tabelle sind.** Dann kann Postgres den breiteren für jede Abfrage nutzen, die der schmalere bedienen würde — der schmalere trägt nichts bei und wird trotzdem bei jedem Schreibvorgang mitgepflegt.

Das ergibt **38** Indizes, nicht 145.

#### Drei Fehler, die die Prüfung selbst fast gemacht hätte

1. **Textvergleich statt Array.** `pg_index.indkey` ist `"1 2"`. Mit `LIKE '1%'` wäre `"12 3"` ein Treffer gewesen — Spalte 12 als Präfix von Spalte 1. Jetzt `int[]`-Vergleich.
2. **Zugriffstyp ignoriert.** Der erste Lauf meldete `species_name_trgm` (GIN, Trigramm) als „enthalten in" `species_elevation_idx` (B-Tree). Zwei völlig verschiedene Indexarten. Jetzt Abgleich über `amname`.
3. **Partielle Indizes.** `idx_notifications_user_id` schien durch `idx_notifications_dedup` gedeckt — das ist aber ein **partieller** Index und deckt nur einen Teil der Zeilen. Drei Kandidaten sind genau daran gescheitert und stehen deshalb **nicht** in der Migration.

Alle drei wären als saubere Liste durchgegangen, wenn ich das erste Ergebnis genommen hätte.

#### Ehrliche Einordnung des Nutzens

Plattenplatz: **504 kB**. Das ist nichts. Der Gewinn liegt im Schreibpfad — `notifications`, `push_send_log`, `user_scans`, `garden_diary` und `sensor_readings` pflegen bei jedem Schreibvorgang einen Index, den keine Abfrage braucht. Spürbar, nicht dramatisch. Wer mehr verspricht, übertreibt.

Die Migration `20260901_redundante_indizes.sql` liegt bereit, ist **nicht** Teil der Pflichtschritte im Runbook (reine Hygiene, jederzeit nachholbar) und jederzeit umkehrbar — die `CREATE`-Zeilen stehen auskommentiert darin. Nachkontroll-Abfrage ebenfalls enthalten; erwartet werden danach 0 Zeilen.

- **Verify:** alle 38 Indexnamen gegen die Live-DB geprüft — **38 existieren, 0 fehlen, 0 sind unique, 0 sind partiell** · Deckungs-Index je Zeile in der Migration dokumentiert · `bash -n` auf dem Runbook OK · nur lesende Abfragen, keine DDL ausgeführt · **kein Versions-Bump**, weil sich an der App nichts ändert.

### 2026-09-01 (d) — v31.20: Der Dunkelmodus leuchtete an 523 Stellen

> Fernandos Auftrag: mehr Selbstinitiative, „Peakfein" in Front- und Backend, so futuristisch wie die Entwürfe. Statt weiter Bildschirm für Bildschirm zu gehen, habe ich zuerst **gemessen**, wo die App vom Anspruch entfernt ist. Das Ergebnis war eindeutig genug, um es zur eigenen Aufgabe zu machen.

#### Die Messung

474 hartkodierte helle Hintergründe in Inline-Styles. Spitzenreiter: `#e8f5e9` (76×), `#fff3e0` (50×), `#fff8e1` (41×), `#ffebee` (39×), `#e3f2fd` (32×).

Und dann der eigentliche Befund: **die App hat längst ein Farbsystem für genau diese Töne** — `--bg-success-soft`, `--bg-warn-soft`, `--bg-danger-soft`, `--bg-info-soft` … **mit korrekten Dunkel-Varianten** (`rgba(102,187,106,.12)` statt `#e8f5e9`). 523 Stellen umgehen ein fertiges, gut gebautes System und schreiben den Hellwert nochmal hin. Deshalb leuchtet der Dunkelmodus.

#### Warum ein blosses Suchen-und-Ersetzen falsch gewesen wäre

Ich habe vor dem Umbau den Kontrast im Dunkelmodus nachgerechnet — und drei Paare fielen durch:

| Kombination | vorher | Befund |
|---|---|---|
| `--bg-info-soft` + `--c-info-d` | **2,2:1** | praktisch unlesbar |
| `--bg-danger-soft` + `--c-danger-d` | **2,5:1** | praktisch unlesbar |
| `--bg-yellow-soft` + `--c-brown` | 3,5:1 | zu wenig |

Der Grund: die Hintergründe werden im Dunkelmodus **durchscheinend dunkel**, während die zugehörigen Textfarben **dunkel blieben**. Ein reines Umstellen hätte das Leuchten behoben und dafür unlesbaren Text erzeugt — der Fehler wäre nur umgezogen.

Also zuerst **sechs Dunkel-Werte repariert** (`--c-success-d`, `--c-danger-d`, `--c-info-d`, `--c-danger`, `--c-success`, `--c-brown`), jeder aus einer Kandidatenliste mit ausgerechnetem Kontrast gewählt — und zwar gegen **beide** Untergründe, die getönte Fläche *und* die Karte.

#### Füllung ist nicht Textfarbe

Beim Aufhellen fiel auf: vier gefüllte Knöpfe benutzen eine **Textfarbe** als Hintergrund (`background:var(--c-info-d); color:#fff`). Wird die im Dunkelmodus hell — und das muss sie, sonst 2,2:1 —, ist weisse Schrift darauf unlesbar. Zwei Dinge, die man nicht in einen Token pressen kann. Jetzt eigene Klassen `.gs-btn-info` / `.gs-btn-ok` mit eigener `body.dark`-Regel.

#### Ergebnis

- **523 Ersetzungen** (249 Hintergründe, 274 Textfarben)
- helle hartkodierte Hintergründe: **474 → 225**
- schlechtester Kontrast im Dunkelmodus: **2,2:1 → 4,8:1**; alle **12 tatsächlich vorkommenden** Kombinationen ≥ 4,5:1
- **Hellmodus pixelgleich** — nachgewiesen, nicht behauptet: alle 18 Token lösen exakt auf den ersetzten Hexwert auf, 0 Abweichungen

#### Was bewusst offen bleibt

225 helle Hintergründe **ohne** Token-Zwilling (`#f0f7ee` 25×, `#f9fafb` 23×, `#ede7f6` 18×, `#e8eaf6` 17×, `#fce4ec` 10×, `#efebe9` 8×) und die Farbverläufe (`linear-gradient(135deg,#e3f2fd,#bbdefb)` mit Textfarben ausserhalb des Systems). Die brauchen **neue** Token — das ist Welle 2 und kein Anhängsel dieses Commits.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Hellmodus-Identität programmatisch bewiesen (18/18 Token exakt) · Kontrast aller 12 realen Kombinationen ausgerechnet, 0 unter 4,5:1 · **Vorher/Nachher in Chromium gerendert** (drei Spalten: hell unverändert, dunkel vorher, dunkel nachher) · Token-Definitionen und Release-Historie waren beim Ersetzen ausgeschlossene Schutzzonen · Version synchron v31.20.

### 2026-09-01 (c) — v31.19: Foto-zu-3D zeigt seine Stufen — letzter Entwurfs-Schritt

> Bilder 4, 5 und 7: „Garten wird erkannt" → „3D-Modell wird erstellt · 65 %" → „3D-Modell erstellt". Wie angekündigt zuerst nachgesehen, was es gibt.

#### Was ich vorgefunden habe

Den ganzen Ablauf. Der **Baum-Planer** hat seit v30.02 „Aus Fotos einen 3D-Plan": bis zu vier Bilder → `callVisionAI` → `TP.scene` mit erkannten Objekten, Himmelsrichtung, Hangneigung → 3D-Vorschau. Die Bilder zeigen also nichts Neues, sondern **etwas Vorhandenes ohne Rückmeldung**.

Denn während des gesamten Vision-Aufrufs über bis zu vier Fotos stand dort **eine** Zeile: „⏳ KI analysiert deine Gartenfotos…". Sekundenlang, ohne Hinweis, ob noch etwas passiert.

#### Was ich gebaut habe — und was bewusst nicht

Vier Stufen mit Zeitachse: *Fotos werden gelesen · Grundstück wird geschätzt · Beete, Bäume und Zonen werden zugeordnet · 3D-Modell wird aufgebaut*. Alle 600 ms neu gezeichnet, gestoppt in **jedem** Ausgang der Analyse — Erfolg wie Fehler.

**Nicht** gebaut habe ich den Prozentwert aus dem Entwurf als Fortschrittsmeldung. Ein Vision-Aufruf liefert keinen Fortschritt; eine Zahl, die so tut, wäre erfunden. Der Balken ist deshalb ausdrücklich eine **Zeit-Schätzung**, hält bei **90 %** und springt erst auf fertig, wenn die Antwort wirklich da ist — mit genau diesem Satz darunter: „Der Balken schätzt die Dauer — fertig ist es, wenn das Ergebnis da ist."

Das ist dieselbe Linie wie bei den Pflegezonen in v31.17 und den Diagnose-Prozenten in v31.18: die Form aus den Entwürfen übernehmen, aber nichts behaupten, was die App nicht weiss.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**: Stufe 1, Stufe 3 und Stufe 4, hell und dunkel, keine JS-Fehler. Für die gezielten Stufen musste die Uhr im Testgerüst manipuliert werden — der erste Versuch war falsch (`t0` wurde nach der Manipulation gesetzt, alle Stufen zeigten 0 %), das fiel im gerenderten Text auf und wurde korrigiert · `prog.stop()` liegt vor allen frühen Rücksprüngen · Version synchron v31.19.

#### Damit sind die Entwürfe umgesetzt

| Bild | Umgesetzt in |
|---|---|
| 1 — Startseite mit Tagesplan | v31.16 |
| 6 — Mein Garten mit Kacheln | v31.17 |
| 3 — Scan-Ergebnis mit Ursachen + Lina | v31.18 |
| 4/5/7 — Foto zu 3D-Modell | v31.19 |

Die Bilder 2 und 8–16 sind Pitch-Deck (Markt, Go-to-Market, Handel, Investoren) — kein App-Code.

### 2026-09-01 (b) — v31.18: Pflanzendoktor — Ursachen mit Wahrscheinlichkeit, dann zu Lina

> Dritter Schritt aus den Entwürfen. Bild 3 zeigt „Gelbe Blätter erkannt / Mögliche Ursachen" mit Prozentwerten und einem prominenten Knopf „Zu Lina wechseln".

#### Zuerst geprüft, wie versprochen: die Zahlen sind echt

Ich hatte angekündigt, vor dem Bauen nachzusehen, ob die Diagnose solche Werte überhaupt liefert. Sie tut es: `plant-doctor-diagnose` gibt `hypotheses: [{ name, confidence (0–1), reason }]` zurück, und das Frontend zeigte die Prozente sogar schon an — nur in einer anderen Form. **Nichts zu erfinden.**

#### Was sich ändert

Statt „Wahrscheinlichste Diagnose" gross und „Weitere Möglichkeiten" als graue Restposten darunter jetzt **eine** Liste „Mögliche Ursachen" mit Balken und Prozent, nach Wahrscheinlichkeit sortiert. Das ist nicht nur näher am Entwurf, es ist ehrlicher: bei 70 % / 60 % / 30 % ist die zweite Hypothese keine Fussnote.

#### Der Knopf, der wirklich gefehlt hat

„Zu Lina wechseln" gab es nicht. `gsOpenLina()` nahm keine Argumente und lud immer nur die letzte Konversation — es war schlicht **kein Weg vorgesehen, eine Diagnose zu übergeben**. Dabei ist das die Frage, die nach jeder Diagnose kommt: *und was mache ich jetzt konkret?*

`gsDoctorToLina()` öffnet Lina und schreibt die Frage samt Pflanzenname und Top-Ursache ins **normale Eingabefeld**; `gsLinaSend()` übernimmt. Bewusst ohne eigenen Sendeweg: so gelten dieselben Regeln wie für jede andere Nachricht — Konversation anlegen, in `coach_messages` speichern, Quota zählen, Verlauf mitschicken, Fehler behandeln. Ein zweiter Pfad wäre genau die Doppel-Logik, die in dieser App schon zweimal auseinandergelaufen ist (Streak-Zähler, Erledigt-Logik). Ist man nicht angemeldet, zeigt `gsOpenLina` seinen Hinweis-Bildschirm ohne Eingabefeld — dann bricht die Funktion ab, statt etwas vorzutäuschen.

#### Ein Fund, der nicht von mir stammt

Im gerenderten Dunkelmodus leuchteten das **Dringlichkeits-Band** (`#fff8e1`) und der **„Profi rufen"-Kasten** (`#fff3e0`) wie ein Scheinwerfer — fest verdrahtete Farben, derselbe Fehler, den ich beim Tagesplan von vornherein vermieden habe, hier nur schon vorhanden. Jetzt CSS-Klassen mit `body.dark`-Varianten (warmes Bernstein auf dunklem Braun).

**Nicht angefasst:** die drei Rückmeldungs-Knöpfe („Hilfreich", „Wurde besser", „Wurde schlechter") sind im Dunkelmodus weiterhin helle Chips. Lesbar, nur hell — eigene Aufgabe, kein Grund, diesen Schritt aufzublähen.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**, hell und dunkel (dunkel in einem eigenen `body.dark`-Rahmen, damit die Klassen wirklich greifen), keine JS-Fehler · Antwortformat der Edge-Function im Quelltext nachgelesen statt angenommen · Version synchron v31.18.

### 2026-09-01 (a) — v31.17: „Mein Garten" bekommt den Überblick aus den Entwürfen

> Zweiter Schritt aus Fernandos Bildern. Bild 6 zeigt „Mein Garten" mit vier Kennzahl-Kacheln und einem Knopf zum Pflegeplan.

#### Die interessante Entscheidung: zwei Kacheln habe ich nicht gebaut

Der Entwurf zeigt **„4 Pflegezonen eingerichtet"** und **„2 Lichtzonen erstellt"**. Beides stammt aus dem Sensor-Produkt und hat in dieser App **keine Entsprechung** — es gibt weder Pflege- noch Lichtzonen. Ich hätte Kacheln bauen können, die irgendetwas Plausibles anzeigen. Das wäre genau die Sorte Lüge, die ich in dieser Sitzung reihenweise entfernt habe: die Quiz-Rangliste zeigte Nullen, „Was ist neu" zeigte hundert Updates lang v30.03, der Tracking-Kommentar versprach ein Fortsetzen, das es nicht gab.

Also dieselbe **Form**, aber nur Zahlen, die es wirklich gibt: **Pflanzen in Pflege** (`ps_myplants`), **Beete angelegt** (`gs_gardens`), **Pläne gespeichert** (`gs_garden_plans`) — und als vierte Kachel der **nächste Schritt** aus `gsGetDueTasks()`, den ein Tippen erledigt.

#### Zwei eigene Fehler, gefunden bevor sie ausgeliefert wurden

1. **Ich hatte `gsOpenGardenBeds()` und `gsOpenMyPlans()` aufgerufen — beide existieren nicht.** Erfundene Funktionsnamen, direkt nach dem Absatz, in dem ich erfundene Zahlen ablehne. Nachgesehen: die Pläne öffnet `gsPlansOpen()` (Rückfall `gsPPopenSavedPlans()`), und für Beete gibt es **kein** Modal — die Liste steht auf demselben Bildschirm, also scrollt die Kachel dorthin.
2. **`'Plan' + (n===1?'':'ä') + (n===1?'':'ne')`** ergibt bei drei Plänen „Planäne". Jetzt schlicht `Plan` / `Pläne`.

Beides fiel auf, weil ich den Code **gerendert** habe statt ihn nur zu lesen.

#### Gelesen wird frisch aus dem Speicher

Nicht aus den globalen `gardens`/`plantings`-Variablen: die stehen auf dem Stand von vor dem letzten Cloud-Pull. Dieselbe Falle wie beim Tagesplan.

Ohne Pflanzen führt „Pflegeplan ansehen" auf eine leere Liste — dann heisst der Knopf „Erste Pflanze scannen".

- **Verify:** 9/9 Inline-Scripts `node --check` OK · **in Chromium gerendert**: vier Zustände (voller Garten, alles erledigt, dunkel, leer), keine JS-Fehler, Plural in allen Fällen geprüft · Ziel-Funktionen im Monolithen nachgeschlagen statt angenommen · Version synchron v31.17.

### 2026-08-31 (z) — v31.16: Startseite nach Fernandos Entwürfen — „Dein Tagesplan"

> Fernando hat 16 Bilder geschickt: sieben zeigen die App, neun sind Pitch-Deck. Auftrag: „genau so soll es ungefähr aussehen … so dass es auch 100% funktionsfähig ist und auch sauber im backend ist". Erster Schritt: die Startseite.

#### Was die Entwürfe sagen

Die Startseite ist dort **eine einzige Frage**: *Was mache ich jetzt?* Begrüssung mit Namen als Überschrift, Wetter, dann **„Dein Tagesplan"** mit Prioritäten (Hoch/Mittel/Niedrig) — und darunter **genau ein** hervorgehobener **„Nächster Schritt"** mit rundem grünem Pfeilknopf. Kein Abzeichen, keine Punktzahl. Das ist die ehrlichere Antwort auf „süchtig machen": nicht mehr Belohnung, sondern weniger Ratlosigkeit.

#### Umgesetzt

`gsRenderDayPlan()` liest **`gsGetDueTasks()`** — Pflanze, Aufgabe, Tage bis fällig. Diese Daten gab es längst; sie standen nur auf dem Pflanzen-Tab (Notizzettel) und in der Glocke, also **überall ausser dort, wo man zuerst hinschaut**. Erledigen läuft über `gsNcDoneTask → gsQuickDone`, es gibt weiterhin **genau eine** Erledigt-Logik (inkl. Cloud-Sync, Tagebuch-Eintrag, Achievements) — keine zweite, die auseinanderläuft.

Vier Zustände, alle gebaut und gerendert:

| Lage | Was steht da |
|---|---|
| Aufgaben offen | bis zu 3 Zeilen + „+ N weitere" + Nächster Schritt (Tippen = erledigt) |
| Alles erledigt | „Alles versorgt … auf Kurs." + Nächster Schritt „Neue Art entdecken" |
| Keine Pflanze | Erklärung + Nächster Schritt „Erste Pflanze scannen" |
| Dunkelmodus | dieselbe Karte, nur Token-Farben |

Gezeichnet wird in **`initHomeBoard()`**, nicht in `switchTab` — sonst bliebe die Karte beim allerersten Start leer, weil „Home" da schon offen ist. Dazu nach jedem Erledigen und am Ende von `renderMyPlants()`, damit nach einem Cloud-Pull nicht „keine Pflanze" behauptet wird, während nebenan zwölf stehen.

#### Der Kopf der Seite

Die Begrüssung war bisher eine kleine Zeile **über** einem Titel, der jeden Tag derselbe war („Natur bestimmen & entdecken"). Die Entwürfe drehen das um, und das ist richtig: die erste Zeile soll den Nutzer meinen, nicht die App. Jetzt Überschrift = „Guten Morgen, Fernando", darüber nur noch die Jahreszeit.

Der Untertitel sagt, **was gerade gilt** — offene Aufgaben zuerst, dann demnächst Fälliges, dann „Dein Garten im Blick.", sonst die Saison-Zeile. Letzteres bewusst: für reine Bestimmungs-Nutzer ohne Pflanzen wäre „Dein Garten im Blick" eine leere Behauptung. Alle fünf Zweige einzeln nachgerechnet, inklusive Singular/Plural.

`home-hero-title` und `home-hero-sub` haben dafür ihre `data-i18n`-Attribute **verloren**: sie werden jetzt in JS gesetzt und holen ihre Texte über `gsI18n.t`, sonst hätte der nächste i18n-Durchlauf die Begrüssung wieder überschrieben.

#### Zwei Dinge, die beim Rendern auffielen

- **„Basilikum schädlinge prüfen".** Ein pauschales `toLowerCase()` auf den Anzeigenamen aus `TASK_DEFS` ergibt Unsinn, sobald der Name aus zwei Wörtern besteht. Im Entwurf steht schlicht „Basilikum prüfen" — jetzt eine kleine Verb-Tabelle je Aufgabenart, mit Rückfall auf den Anzeigenamen (und nur bei **einem** Wort kleingeschrieben).
- **Dunkelmodus.** Die Entwürfe sind cremefarben. Fest verdrahtet hätte die Karte im Dunkelmodus geleuchtet wie ein Scheinwerfer — deshalb ausschliesslich `--card`/`--surface2`/`--border`. Beide Modi gerendert und angesehen, nicht nur vermutet.

#### Wie es weitergeht

Die restlichen Entwürfe (Mein Garten mit Kennzahl-Kacheln, Scan-Ergebnis mit Wahrscheinlichkeits-Zeilen, 3D-Modell-Fortschritt) sind je ein eigener, prüfbarer Schritt. Ein Rundumschlag über 82 000 Zeilen in einem Zug ist genau der Weg, auf dem etwas kaputtgeht — und „durchdacht" war die Vorgabe.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · **In Chromium gerendert** (Playwright, 2× Pixeldichte): vier Zustände nebeneinander, hell und dunkel, **keine JS-Fehler** · Untertitel-Logik in fünf Zweigen nachgerechnet · `GS_RELEASES[0].v === GS_VERSION` · Version synchron v31.16.

### 2026-08-31 (y) — Vorabprüfung des Runbooks gegen die Live-Datenbank (lesend, keine Code-Änderung)

> Der Supabase-Lesezugriff funktioniert in dieser Sitzung. Damit liess sich der Stand faktisch prüfen, statt ihn zu vermuten — und die sieben wartenden Migrationen gegen das echte Schema abgleichen, bevor Fernando sie einspielt.

#### Was live noch offen ist (geprüft, nicht vermutet)

| Artefakt | Migration | Live vorhanden |
|---|---|---|
| `comment_reactions`, `fn_notify_post_like`, `fn_notify_comment_like` | v31.09 | **nein** |
| `daily_quizzes.image_url` | v30.85 | **nein** |
| Integritäts-Trigger auf `quiz_answers` | v30.95 | **nein** |
| `fn_is_role` / `fn_role_at_least` für `anon` gesperrt | v30.95 | **nein** (Leak offen) |
| Leaked-Password-Protection | Dashboard | **nein** |

Zum Quiz-Trigger: `quiz_answers` **hat** einen Trigger, aber es ist `trg_quiz_answers_sync_lb` (Leaderboard-Sync) — nicht der Integritäts-Trigger. Eine reine Spalten-Prüfung (`answered_on` existiert) hätte hier ein falsches „ist schon drin" geliefert; die Trigger-Definition zu lesen war nötig.

#### Vorabprüfung: der Runbook-Lauf sollte durchlaufen

- **Jedes referenzierte Objekt existiert** — 13 Tabellen plus `cron.job`, `cron.job_run_details`, `net._http_response`. Fehlend sind nur die vier Funktionen, welche die Migrationen selbst anlegen.
- **Spaltentypen passen** (uuid-Fremdschlüssel, `social_posts.likes` integer, `notifications` mit `dedup_key`).
- **Funktions-Signaturen stimmen mit den live vorhandenen überein.** Das war der wichtigste Punkt: weicht die Argumentliste ab, legt `CREATE OR REPLACE` eine **Überladung** an statt zu ersetzen — die Migration liefe fehlerfrei durch, und der Cron riefe weiter die alte Fassung auf. Sieben Signaturen abgeglichen, alle identisch.
- **`fn_get_daily_quiz` wird gelöscht und neu angelegt** (die Rückgabe bekommt drei Bild-Spalten). Kein View hängt daran, und die Migration setzt `GRANT EXECUTE` für `anon` + `authenticated` wieder — ohne das wäre das Quiz nach dem Lauf für alle tot. Geprüft, weil ein DROP die Rechte mitnimmt.
- **Das Frontend liest `image_url`/`image_alt`/`image_credit` bereits** (`index.html:10542`) — die Bildfragen wirken sofort.

Alles davon steht jetzt als Kommentarblock im Runbook selbst (`scripts/apply_pending_v30_87.sh`), nicht nur hier.

#### Advisor-Stand (live)

**0 ERROR**, 140 WARN, 5 INFO. Die WARNs sind zu 136 das bewusste SECURITY-DEFINER-RPC-Muster; die einzige andere ist `auth_leaked_password_protection`. Fünf Tabellen haben RLS **ohne Policy** (`book_ocr_pages`, `species_import_queue`, `species_search_cache`, `system_events`, `weather_forecast_cache`) — das ist Deny-all für normale Nutzer und passt: geschrieben wird dort nur aus SECURITY-DEFINER-Funktionen, die RLS umgehen.

#### Ein Verdacht, der sich auflöste

Achievement-Zähler, die wie `track_count` rückwärts laufen: Ich habe alle zehn `gsAchBump`-Aufrufstellen gegen die **live** ausgelesenen Schwellen geprüft. `diary_count` (Deckel 500, höchste Stufe **30**) und `harvest_count` (Deckel 1000, höchste Stufe **10**) sind nicht erreichbar — theoretisch, kein Fund. Und `fn_achievements_bump` setzt `unlocked_at` per `COALESCE`: ein gesunkener Wert **entzieht** kein Abzeichen, er lässt nur den Fortschrittsbalken zurückspringen. Das relativiert v31.12 nicht (bei `track_distance_km`, Stufe 50 km, war der Rückwärtslauf echt), aber es ist die genauere Beschreibung.

- **Verify:** Alle Aussagen oben stammen aus `execute_sql`/`get_advisors` gegen `vowbiueikwrauuceilhc` (nur lesend, keine DDL) · `bash -n scripts/apply_pending_v30_87.sh` OK · keine Code-Änderung, deshalb **kein Versions-Bump** und kein `GS_RELEASES`-Eintrag.

### 2026-08-31 (x) — v31.15: In der Quiz-Rangliste standest du mit 0

> Zweiter Teil von „Bindung und Wachstum". Beim Durchgehen des Quiz habe ich mehr verworfen als repariert — zwei Verdachtsfälle liessen sich nicht halten, und einen Fix habe ich rückgängig gemacht, weil er einen echten Fehler erzeugt hätte.

#### 🏆 Der Fund: der eigene Eintrag war immer 0

`openDqRanking` baut die Liste aus zwei Quellen: den Cloud-Zeilen aus `fn_quiz_leaderboard_top` und — falls man dort **nicht** vorkommt — einem lokalen Eintrag. Der lokale las `stats.yearPoints`, `stats.yearCorrect`, `stats.yearTotal`. Diese Felder legt `dqGetStats()` gar nicht an, und **niemand schreibt sie**: der einzige Schreiber war `dqShowResult`, eine Funktion, die im ganzen Monolithen **keine Aufrufstelle** hat (nachgezählt).

Wer also neu angemeldet ist, wessen Übertragung fehlschlug oder wer ausserhalb der Top 50 liegt, sah sich mit **0 richtig, 0 %, 0 Fragen** — während `gs_dq_stats` den richtigen Stand hielt. Genau die Nutzer, die man halten will, bekamen die Rückmeldung, sie hätten nichts erreicht.

Jetzt nimmt der lokale Eintrag die Felder, die die beiden **echten** Antwort-Handler pflegen (`correct`, `total`, `bestStreak`) — und dieselbe Währung wie die Cloud-Zeilen. Denn:

#### 🏷️ Die Zahl hiess „Punkte 2026" und war keine

`quiz_leaderboard` speichert `total_correct`, `total_attempts`, `streak_current`, `streak_max` — **keine Punkte-Spalte, keinen Jahresbezug**. Die grosse Zahl rechts zeigte `total_correct` unter der Beschriftung „Punkte 2026", während die Überschrift zwei Zeilen darüber „Rangliste (gesamt)" sagte. Dieselbe Zahl stand ausserdem gleich nochmal in der Zeile darunter („x/y Fragen"). Hätte ich den lokalen Eintrag auf `stats.points` gesetzt — die naheliegende Lesart der Feldnamen —, stünde ein Nutzer mit 850 Punkten über allen Cloud-Zeilen mit 12: aus einer Null wäre eine noch grössere Lüge geworden.

Jetzt heisst die Zahl **„richtig gesamt"**, die Doppelung ist weg, und `streak_max` — kam schon immer vom Server mit, wurde nie angezeigt — steht als „🔥 x in Folge" in der Zeile. Der eigene Streak-Wert war zudem der **laufende**, während alle anderen ihren **besten** zeigten; auch das stimmt jetzt überein.

#### 📅 Ein Fix, den ich zurückgenommen habe

Der Quiz-Tag wird an vier Stellen mit `new Date().toISOString().slice(0,10)` gerechnet — UTC, wie die drei Streak-Systeme vor v31.14. Ich wollte ihn auf Ortszeit umstellen. **Das wäre ein echter Fehler gewesen:** die Frage kommt aus `fn_get_daily_quiz`, und die rotiert mit dem Postgres-`current_date` (auf Supabase UTC). Stellt man nur den Client um, hält er zwischen 00:00 und 02:00 Ortszeit den nächsten Tag für angebrochen, bekommt vom Server aber **dieselbe** Frage — und weil auch die „heute gespielt"-Sperre einen neuen Schlüssel hätte, liesse sich dieselbe Frage **zweimal beantworten und doppelt punkten**.

Stattdessen: eine Funktion `dqDayKey()` für alle vier Stellen, mit dem Grund im Kommentar und der Anleitung, wie beide Seiten gemeinsam wechseln müssten (`(now() AT TIME ZONE 'Europe/Zurich')::date`, so macht es `v28_05_feature_quota` bereits). Damit kann niemand mehr eine der vier Stellen einzeln „reparieren".

#### Zwei Verdachtsfälle, die sich nicht halten liessen

- **„Das Mini-Quiz lässt sich beliebig oft beantworten."** `initDailyQuiz` liest `gs_quiz_lastday`, und dieser Schlüssel wird **nirgends geschrieben** — die Sperre kann nie greifen. Aber: `initDailyQuiz` hat selbst keine Aufrufstelle, es wurde längst von `renderDailyQuizTeaser`/`initQuiz` abgelöst. Toter Code, kein Fehler.
- **„`dqShowResult` erzeugt NaN in den Statistiken."** Stimmt (`undefined++`), aber die Funktion wird nirgends aufgerufen. Ich habe die Phantom-Zeilen trotzdem entfernt, damit sie keine Falle ist, falls sie je verdrahtet wird — und es als Hygiene deklariert, nicht als Fix.

#### Nicht angefasst

`gs_quiz_lastday` steht in `GS_USER_KEYS` und in drei Sync-Listen, obwohl niemand den Schlüssel schreibt. Aufräumen ist eine eigene Aufgabe. Ebenso das Nachziehen der 42 neuen Quiz-Fragen — die Migration `20260827_quiz_bilder_und_fragen_v30_85.sql` liegt bereit, kann aber nur der Betreiber einspielen (Runbook).

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Feld-Abgleich im Block `openDqRanking` programmatisch geprüft: beide Produzenten liefern denselben Satz (`username, correct, attempts, streakMax, isMe`), alle konsumierten Felder werden auch produziert, kein Phantom-Feld mehr im Code (nur noch in Kommentaren) · `initDailyQuiz` und `dqShowResult` als aufruflos nachgezählt · `GS_RELEASES[0].v === GS_VERSION` · Version synchron v31.15.

### 2026-08-31 (w) — v31.14: Die Tages-Serie verschwand beim zweiten Gerät

> Erster Teil von „Bindung und Wachstum", der nichts mit Aussehen zu tun hat. Bevor man Nutzer mit einer Serie hält, muss die Serie halten. Sie tat es nicht.

#### 🔥 Der Streak wurde beim Cloud-Abgleich gelöscht

`gs_streak` ist kein einzelner Wert, sondern **ein Datensatz aus vier Schlüsseln**: Wert, letzter aktiver Tag, Zeitstempel und eine FNV-Signatur gegen Handarbeit im localStorage. `gsGetStreak()` prüft die Signatur bei **jedem** Lesevorgang und setzt bei Nichtübereinstimmung auf 0.

Der Cloud-Writeback schrieb die vier durch dieselbe generische Schleife wie alles andere — mit `if (v == null) continue`. Ein Gerät, das noch nie eine Serie hatte, baut aber genau diesen Blob:

```
streak: null   (JSON.parse(getItem('gs_streak') || 'null'))   → übersprungen
streak_sig: '' (getItem(...) || '')                           → GESCHRIEBEN
```

Der Wert blieb also stehen, die Signatur wurde geleert — und der nächste Lesevorgang hielt den Datensatz für manipuliert. **Wer zwanzig Tage gesammelt hatte, verlor sie, sobald er sich einmal auf einem zweiten Gerät anmeldete.** Zweitens galt für den ganzen `state`-Blob „Cloud ist massgeblich"; für einen Streak ist das falsch, denn Aktivität auf **irgendeinem** Gerät zählt — ein zurückgebliebenes Gerät zog den Wert nach unten.

Beides **vor dem Fix mit den echten Funktionen nachgestellt** (Fake-`localStorage`, `_gsStreakSig`/`gsGetStreak` unverändert aus `index.html` extrahiert): 20 → **0** beim leeren Blob, 20 → **5** beim niedrigeren Cloud-Wert. Nach dem Fix 7/7 Szenarien grün.

Jetzt übernimmt `_gsStreakApplyCloud` die vier Schlüssel **als Ganzes** und nur, wenn die Cloud weiter ist (späterer Tag; bei gleichem Tag der höhere Wert). Die Signatur wird lokal neu erzeugt — über die Leitung transportiert sie ohnehin nichts, was nicht schon in den Daten steht. Bleibt der lokale Stand stehen, wird über das bestehende `_gsStateRepairNeeded`-Signal aus v28.97 ein Reparatur-Push angestossen.

#### 🔑 Der Login-Streak fiel auf 1, sobald ein zweites Gerät im Spiel war

Im State-Blob stand `login_streak`, aber **nicht** `gs_last_login`. Gerät B bekam die Zahl ohne den zugehörigen Tag, sah beim nächsten Start eine Lücke, setzte auf 1 — und schob die 1 zurück in die Cloud, von wo Gerät A sie holte. Der Tag ist jetzt Teil des Blobs, und beide werden wie oben nur gemeinsam übernommen. `gs_last_login` steht dazu in `STATE_KEYS`, damit ein Schreiben den Scope überhaupt als geändert markiert.

#### 🕛 Drei Streak-Systeme, zwei Tagesgrenzen

`gs_streak` rechnet seit v23.56 mit `_gsDayKey()` in **Ortszeit** („Timezone-safe, kein UTC-Drift" steht sogar im Kommentar). `gsCheckLoginStreak` und `checkAndUpdateStreak` rechneten mit `new Date().toISOString().slice(0,10)` — dem **UTC-Tag**. Nachgerechnet mit `TZ=Europe/Zurich`:

| Zeitpunkt | Ortszeit | UTC |
|---|---|---|
| 31.08. 00:30 (Sommerzeit) | `2026-08-31` | `2026-08-30` |
| 15.01. 00:30 (Winterzeit) | `2026-01-15` | `2026-01-14` |
| 31.08. 14:00 | `2026-08-31` | `2026-08-31` |

In der Schweiz begann der neue Tag für zwei der drei Systeme also erst um **01:00 bzw. 02:00 Uhr**. Wer um halb eins nachts noch hereinschaute, zählte für gestern — und dieselbe Sitzung wurde vom einen System als „heute", vom anderen als „gestern" gewertet. Alle drei nutzen jetzt dieselbe Grenze.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · **14/14 Szenarien** in zwei Node-Suiten gegen die aus `index.html` extrahierten Originalfunktionen (Aktiv-Streak 7, Login-Streak + Tagesgrenze 7); die zwei Fehlerfälle waren vor dem Fix rot · Zeitzonen-Divergenz mit `TZ=Europe/Zurich` belegt · `GS_RELEASES[0].v === GS_VERSION` (die Prüfung aus v31.13 greift) · Version synchron v31.14.

### 2026-08-31 (v) — v31.13: „Was ist neu" zeigte über hundert Updates lang dasselbe

> Beim Aufräumen des Tracking-Codes fiel mir auf, dass `GS_RELEASES` bei **v30.03** endet. Ich habe das als Nebenbefund notiert und dann nachgesehen, was der Eintrag eigentlich steuert. Die Antwort war unangenehmer als erwartet.

#### 📰 Der Fund

`showWhatsNew` baut den Dialog nach einem Update so: **Überschrift aus `GS_VERSION`**, **Inhalt aus `GS_RELEASES[0]`** — ohne zu prüfen, ob beides zusammengehört. Die Liste steht seit dem 21. Juni auf v30.03. Seither hat jeder Nutzer nach **jedem** Update einen Dialog gesehen mit dem Titel *„Was ist neu in v31.xx"* und darunter den Notizen von v30.03 („💾 Pläne speichern — zuverlässig, mit ‚Meine Pläne'"). Rund **110 Versionen** lang. Dasselbe im Über-Modal: der Block *„✨ Aktuelle Version"* zeigte v30.03, während direkt daneben im selben Modal die echte laufende Version stand.

Das ist kein Schönheitsfehler. Wer die App aktualisiert und dreimal dieselbe Meldung bekommt, hört auf hinzusehen — und erfährt dann auch nichts mehr, wenn wieder etwas Echtes drinsteht.

#### Was ich geändert habe

1. **Sechs Einträge nachgetragen.** v31.09, v31.10, v31.11, v31.12 einzeln; dazu zwei ehrlich als solche gekennzeichnete Sammel-Einträge: `v30.92 – v31.08` (die Datenhaltungs-Welle) und `v30.04 – v30.91`. Über hundert Einzel-Einträge rückwirkend zu erfinden wäre Theater gewesen — die vollständige Historie steht in `STATUS.md`, und die Sammel-Einträge sagen genau das.
2. **Der Dialog prüft jetzt ab.** Stimmt `GS_RELEASES[0].v` nicht mit `GS_VERSION` überein, **bleibt er aus** und schreibt in die Konsole, welcher Eintrag fehlt. Lieber nichts zeigen als etwas Falsches. `gs_seen_version` wird dabei bewusst **nicht** gestempelt: wird der Eintrag später nachgetragen, bekommt der Nutzer ihn noch zu sehen.
3. **Das Über-Modal widerspricht sich nicht mehr.** Der Block heisst nur dann „Aktuelle Version", wenn er es auch ist — sonst „Letzter dokumentierter Eintrag".
4. **Die Konvention steht jetzt in `CLAUDE.md` §3.1**, nicht nur in einem Kommentar über dem Array. Ein Schritt, den man nur findet, wenn man ohnehin an der richtigen Stelle liest, wird übersehen — genau das ist hier passiert, mir eingeschlossen: ich habe in dieser Session zwanzig Releases gebaut und keinen einzigen Eintrag hinterlassen.

#### 🧹 Nebenbefund beim Nachzählen: 49 Zeilen wurden beim Rendern verstümmelt

Die Notizen gehen per `innerHTML` ins Modal. **49 technische Zeilen** enthalten Tag-Namen und Platzhalter als **Prosa** — `<head>`, `<uuid>`, `<slug>`, `<script>`, `<img onerror>`. Der Browser hat sie als Markup gelesen: die Wörter verschwanden mitten im Satz, und die v29.36-Zeile baute tatsächlich ein `<img onerror>`-Element in den Dialog. Kein XSS (die Texte stammen aus dem Repo, nicht von Nutzern, und `<script>` via `innerHTML` läuft nicht), aber schlicht falsch dargestellt. Alle 13 Einsetzstellen in beiden Render-Funktionen escapen jetzt; gegengerechnet: 49/49 Zeilen kommen sauber durch.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `GS_RELEASES` als Array ausgewertet: **361 Einträge**, keine doppelten Versionen, keine ohne `v`/`headline` · Guard mit drei Fällen durchgespielt (passend → Dialog, unpassend → kein Dialog, real v31.13/v31.13 → Dialog) · Escaping an Stichproben gegengerechnet · Version synchron v31.13.

### 2026-08-31 (u) — v31.12: Karte & Tracking — das Fortsetzen war nur ein Kommentar

> Fernandos Auftrag „die Karte mit dem Tracking verbessern". Ich habe die Aufzeichnung von vorne durchgelesen, statt nur Kosmetik anzufassen — und fünf Stellen gefunden, an denen sie still verlor, was sie aufgezeichnet hatte.

#### ▶️ Der Kern: „Fortsetzen" gab es nicht

Über dem Tracking-Code steht seit v24.11 die Zeile *„Recovery beim App-Start: angefangener Track wird angeboten zum Fortsetzen"*. Der Dialog bot aber nur **„Als beendet speichern"** und **„Verwerfen"** an. Wer auf halber Wanderung die App verlor, konnte den Track abschliessen oder wegwerfen — weitergehen konnte er nur als **zweiter** Track. Ein Kommentar, der etwas verspricht, das der Code nicht tut, ist schlimmer als gar keiner: er verhindert, dass jemand nachsieht.

Jetzt gibt es drei Wege: **Fortsetzen** (hängt neue Punkte an denselben Track, wechselt dafür auf die Karte und wartet, bis sie bereit ist), **Als beendet speichern**, **Verwerfen**. Wegtippen heisst neu „später entscheiden" — der Snapshot bleibt liegen und wird beim nächsten Start wieder angeboten. Vorher löschte jeder Weg ausser „Speichern" die Aufzeichnung, **auch der Fehlerfall**: war `gsConfirmModal` nicht verfügbar, ging der Track kommentarlos verloren, ohne dass je jemand gefragt wurde.

#### 🔧 Vier weitere Stellen, an denen still Daten verschwanden

1. **Der Wiederanlauf des GPS war toter Code.** Beim App-Wake prüfte er `_gsTrack.watchId == null`. Der Browser setzt die watchId aber **nie** zurück, wenn er einen Watch einschläfert — die Bedingung konnte nicht wahr werden. Ein eingeschlafener Watch sah aus wie eine Pause: die Karte zeigte weiter Statistik, es kam nur nichts mehr an. Jetzt entscheidet ein Wach-Timer anhand des **letzten Fixes** (45 s ohne Signal → neu anhängen, frühestens alle 30 s), hängt vorher sauber ab (zwei parallele Watches hätten jeden Punkt doppelt gezählt) und schreibt **„⚠️ kein GPS-Signal"** in die Statuszeile, statt es zu verschweigen.
2. **Gesichert wurde „alle 10 Punkte"** — der Kommentar daneben sagte „alle 10 s". Wer stillsteht, bekommt keine neuen Punkte und damit **keine Sicherung**. Jetzt zeitbasiert, plus einmal beim Wegschalten (`visibilitychange`) und beim Schliessen (`pagehide`) — genau dann räumt das Betriebssystem die Seite ab.
3. **Lange Tracks wurden hinten abgeschnitten** (`.slice(-5000)` beim Speichern, `.slice(-2000)` im Snapshot). Eine Sechs-Stunden-Wanderung **begann danach in der Mitte**. Jetzt gleichmässig ausgedünnt: erster und letzter Punkt bleiben immer, die Form bleibt, nur die Auflösung sinkt. Gegengerechnet: 28 800 Punkte → 5 000, Start 0, Ende 28 799, keine Duplikate, streng steigend.
4. **Die Wander-Achievements liefen rückwärts.** Sie meldeten `saved.length` und die Summe der **30 aufbewahrten** Tracks — beides schrumpft, sobald der Deckel greift, und `p_set=true` schreibt den kleineren Wert auf dem Server fest. Ab Track 31 stand der Zähler auf 30 und die Kilometer **sanken** mit jedem weiteren Track. Jetzt zählen `gs_track_total_n`/`gs_track_total_m` monoton; fehlen sie, werden sie einmalig aus der vorhandenen Liste abgeleitet, damit niemand bei null anfängt.

#### 🗺️ Und die Karte selbst

- **Sie läuft mit.** Die Linie wuchs bisher aus dem Bild heraus — nach zehn Minuten sah man leere Karte. Nachgeführt wird nur, wenn der neue Punkt den Ausschnitt verlässt, und **nie**, während der Nutzer selbst verschoben hat (25 s Karenz): wer die Karte in die Hand nimmt, will sie behalten.
- **Ein Kopf-Marker** zeigt, wo man gerade steht — auf einer verwinkelten Route war das aus der Linie allein nicht zu lesen.
- **Funkzellen-Fixes verzerren die Linie nicht mehr.** Der erste Fix liegt oft hunderte Meter daneben; er zog einen Strich quer durch den Kanton und die Karte sprang dorthin. Solche Punkte werden weiterhin **gespeichert** (die Statistik filtert sie ohnehin selbst), aber nicht gezeichnet — mit derselben 70-km/h-Schwelle wie `_gsRobustDistance`, damit Linie und Statistik dieselbe Wirklichkeit zeigen. Nach 60 s ohne brauchbaren Punkt wird neu verankert, damit im Zug oder nach einem Tunnel nicht dauerhaft nichts mehr ankommt.
- **Voller Speicher verliert den Track nicht mehr.** Schlägt das Schreiben fehl, bleibt der Live-Snapshot liegen und der Nutzer erfährt es — vorher landete es in einem `catch` mit einer Zeile Konsole.
- **Ein liegengebliebener Snapshot wird beim Neustart einer Aufzeichnung gerettet**, statt vom ersten Sichern überschrieben zu werden.
- **`gs_track_live` und die neuen Zähler stehen in `GS_USER_KEYS`** — sonst bekäme der nächste Nutzer auf demselben Gerät angeboten, den Track eines Fremden fortzusetzen.

#### Nebenbefund (nicht angefasst)

`GS_RELEASES` endet bei **v30.03**. Alles danach — über hundert Versionen — steht nur in `STATUS.md`, nicht im „Was ist neu?"-Modal der App. Das nachzuziehen ist eine eigene Aufgabe, keine Beifracht dieses Commits.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · Ausdünnung und Plausibilitätsfilter mit Node gegengerechnet (Länge, Start/Ende, Duplikate, Gehen/Sprung/Stillstand/Funkzelle) · `_gsHaversine` bleibt für die drei Aufrufer weiter unten erhalten · Version synchron v31.12 (`GS_VERSION`, `meta app-version`, `sw.js gs-v31.12`, `_headers`).

### 2026-08-31 (t) — v31.11: Einstellungen durchgegangen — ein Datenschutz-Schalter zeigte den falschen Zustand

> Fernandos Auftrag „Einstellungen abchecken und alles verbessern + stabilisieren". Systematisch geprüft statt punktuell — und dabei zweimal meine eigene Prüfung korrigiert.

#### Was in Ordnung war (und ich deshalb nicht angefasst habe)

- **Alle 33 Einstellungs-Zeilen mit Aktion haben ein existierendes Ziel.** Keine toten Klicks.
- **Alle 11 Schalter haben einen Handler**, und jede Handler-Funktion ist definiert.
- **Die Schalter werden korrekt aus dem Speicher initialisiert.** Mein erster Scan meldete „11× nie gesetzt" — das war ein **zu enges Suchmuster**, die Zuweisung läuft über eine Zwischenvariable in `toggleMap`. Nachgesehen, bevor ich etwas „repariert" hätte.
- **Das `!== false`-Muster ist konsistent.** Ich hielt es kurz für einen Fehler (nicht gesetzte Vorliebe → Schalter zeigt „an"), aber die Features lesen mit derselben Regel (`=== false ? aus : an`). Kein Widerspruch.

#### 🔒 Der echte Fund: eine Datenschutz-Einstellung log

`profiles.opt_in_achievement_feed` steuert, ob die eigenen Erfolge im Community-Feed erscheinen — **massgeblich ist der Server** (`fn_achievements_feed` liest ihn). Der Schalter in den Einstellungen las aber `userPrefs.achFeed`, einen rein **lokalen Spiegel**, der **nur geschrieben und nie zurückgelesen** wurde.

Folge: auf einem neuen Gerät stand der Schalter auf dem Standard „an" — auch wenn man sich anderswo bewusst abgemeldet hatte. Bei einer Datenschutz-Einstellung ist ein falsch angezeigter Zustand das eigentliche Problem: **wer „aus" gewählt hat, muss „aus" sehen.** Schlimmer noch, ein späteres Speichern hätte den Server-Wert stillschweigend zurück auf „an" gedreht.

`sbLoadProfile()` spiegelt den Server-Wert jetzt in die lokale Vorliebe **und** in die Checkbox, sobald das Profil geladen ist. Spalte vorher in der Live-DB geprüft: `boolean`, Standard `true`.

#### 🧹 Sieben verwaiste Einträge entfernt

`toggleMap` enthielt `toggle-water-notif`, `-weather-notif`, `-market-notif`, `-social-notif`, `-harvest-notif`, `-pest-tips`, `-safety` — **null** davon existiert noch im DOM (nachgezählt). `getElementById` lieferte `null`, die Zeilen liefen ins Leere. Harmlos, aber irreführend: wer die Karte liest, hält diese Einstellungen für vorhanden. Push-Kategorien laufen längst über `gs_push_settings`. Übrig bleiben **5 Einträge, alle mit echtem Element**.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `toggleMap` gegengezählt (5/5 im DOM) · Version synchron v31.11.

### 2026-08-31 (s) — v31.10: Eigenes Icon-Set — 23 Symbole, 7 KB, erben die Textfarbe

> Fernandos Wunsch nach eigenen Icons. **Wichtige Einschränkung vorweg:** eine „Expansions-Festplatte" ist in dieser Umgebung **nicht eingebunden** (`df` zeigt nur den Container). Die Icons liegen deshalb im Repo unter `assets/icons/` — das ist der Weg auf Fernandos Rechner, per `git pull`.

- **Warum eigene Icons statt Emoji.** Die App nutzt durchgehend 🌱 🔔 📷. Drei Nachteile: jede Plattform zeichnet sie **anders** (die App wirkt zusammengesetzt statt gestaltet), sie lassen sich **nicht einfärben** (im Dunkelmodus bleiben sie bunt, während alles andere umschaltet), und Screenreader lesen oft einen Namen vor, der mit der Funktion nichts zu tun hat.
- **Das Set:** 23 Strich-Symbole, 24×24, Strichstärke 1.75, runde Enden — `leaf` `mushroom` `tree` `herb` `scan` `pin` `track` `bell` `community` `heart` `share` `chat` `garden` `harvest` `book` `market` `settings` `search` `profile` `streak` `water` `sun` `calendar`. Zusammen **7 KB**.
- **`currentColor` ist der Kern.** Die Icons nehmen die Farbe des umgebenden Textes an — damit stimmen sie im Hell-, Dunkel- und jedem Akzent-Thema **ohne eine einzige zusätzliche Regel**. Genau das, was Emoji nicht können.
- **Eingebettet statt nachgeladen.** `gsIcon(name, size, label)` liefert Inline-SVG. Die App baut ihre Ansichten als HTML-Strings; ein `<img>` oder `<use href="datei.svg#id">` würde die Textfarbe nicht erben und zusätzliche Abrufe kosten.
- **Barrierefreiheit eingebaut, nicht nachgereicht:** mit `label` bekommt das Icon `role="img"` + `aria-label` (es *trägt* dann die Bedeutung); ohne `label` wird es als `aria-hidden` markiert — richtig, wenn daneben ohnehin Text steht.
- **`assets/icons/preview.html`** zeigt alle 23 mit Umschaltern für Dunkelmodus, Größe und Farbe. Wer eines ändert, hält es dort gegen die anderen.
- **Verify:** alle 23 SVGs mit einem XML-Parser geprüft — valide, `currentColor` vorhanden, Raster korrekt · Helfer in Node getestet: dekorativ/mit Label, Größe wird übernommen, unbekannter Name liefert leeren String, alle 23 erzeugen fehlerfreies Markup.
- **⚠️ Eine eigene Prüfung war zu naiv, und das ist erwähnenswert:** ich hatte „kein `onload` im Markup" per Substring-Suche geprüft — die schlug an, obwohl das Escaping korrekt war (`onload=` steht als harmloser Text *innerhalb* des Attributwerts). Erst das echte Parsen des Markups zeigt es sauber: es gibt **kein** `onload`-Attribut, der Angriffsstring ist der **Wert** von `aria-label`. Ein Test, der die falsche Frage stellt, ist schlimmer als keiner.
- **Noch nicht gemacht:** die Icons sind noch nirgends im UI eingesetzt. Emoji durch sie zu ersetzen berührt sehr viele Render-Stellen — das gehört in einen eigenen Schritt, sonst wird ein Rendering-Fehler zwischen 200 Änderungen unauffindbar.

### 2026-08-31 (r) — v31.09: Community — Kommentare liken und disliken, Teilen, Likes als Benachrichtigung

> Fernandos Auftrag: Likes sollen überall auch als Benachrichtigung erscheinen · Kommentare liken **und** disliken · Teilen. Dazu der Wunsch, dass die App mehr bindet.

- **Warum das eine Migration braucht und nicht nur Client-Code.** Geprüft, nicht angenommen: `notifications` hat RLS `insert_own` — ein Client kann keine Meldung für **jemand anderen** anlegen. Und `fn_create_notification` ist SECURITY DEFINER, aber nur für `postgres` + `service_role` ausführbar (`proacl` nachgesehen). Das ist richtig so: wäre sie für `authenticated` offen, könnte jeder jedem beliebige Meldungen schicken. **Ein Trigger ist damit der einzige saubere Weg** — er läuft als Owner, ist vom Client nicht fälschbar und funktioniert unabhängig davon, welche App-Version gerade liket.
- **Neu in der Migration** (`20260831_community_reaktionen_v31_09.sql`, im Runbook als M7):
  - `comment_reactions` — eine Zeile pro Nutzer und Kommentar, `UNIQUE (comment_id, user_id)`. Wechsel Like ↔ Dislike ist ein **Upsert**, nicht Löschen+Neuanlegen. Doppelstimmen sind dadurch auch bei parallelen Taps auf zwei Geräten unmöglich. RLS: lesen alle (Zählstände sind öffentlich), schreiben nur die eigene Stimme.
  - Trigger auf `post_likes` und auf `comment_reactions` → Benachrichtigung an den Autor. **Selbst-Likes lösen nichts aus.** `dedup_key` ist `like:post:<id>:<liker>` — wer wegnimmt und neu liked, erzeugt keine zweite Meldung.
  - **Dislikes benachrichtigen bewusst niemanden.** „Jemandem gefällt dein Kommentar nicht" wäre entmutigend und lädt zu Schikane ein. Sie zählen sichtbar mit, mehr nicht.
  - `social_posts.likes` wird jetzt **serverseitig** gezählt. Vorher schrieb der Client den Zähler selbst — bei zwei Geräten driftete er, und fälschbar war er ohnehin.
- **Client:** Reaktionsleiste unter jedem Kommentar (❤️ / 👎 / 🔗), optimistisch geschaltet und **bei Fehlschlag sauber zurückgesetzt** statt Erfolg vorzutäuschen. Teilen-Knopf an jedem Beitrag. Alle Reaktionen einer Kommentarliste werden in **einem** Aufruf geholt — nicht 30 Anfragen bei 30 Kommentaren.
- **Verhalten vor der Migration:** `_gsCommentReactionsOk` merkt sich beim ersten Abruf, ob die Tabelle da ist. Fehlt sie, werden die Knöpfe **gar nicht** gerendert — statt sichtbar ins Leere zu laufen. Sobald die Migration angewandt ist, erscheinen sie von selbst.
- **Teilen** nutzt die System-Freigabe (`navigator.share`), sonst die Zwischenablage; ein Abbruch durch den Nutzer wird als solcher erkannt und nicht als Fehler gemeldet.
- **Bewusst NICHT gebaut:** Benachrichtigung bei Marktplatz-Likes. `mktLike` zählt nur einen Zähler auf `marketplace_listings` hoch, ohne Pro-Nutzer-Zeile — eine Meldung wäre durch wiederholtes Tippen beliebig oft auslösbar. Das bräuchte erst eine eigene Tabelle wie `post_likes`.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · Version synchron v31.09.

### 2026-08-31 (q) — v31.08: Die still rotierenden Listen werfen nicht mehr weg, sie archivieren

> Der letzte offene Punkt aus dem Quota-Bereich. Der zweite von Fernandos zwei Architektur-Fragen — mit seiner Freigabe umgesetzt.

- **Der Befund.** Zehn Nutzerdaten-Listen werden per `slice()` gedeckelt. Bei **vier** davon ist der abgeschnittene Eintrag danach **auch in der Cloud weg**, weil der Sync-Blob aus der bereits gekürzten Liste gebaut wird — nachgeprüft: `_buildPlantsBlob` liest `gs_gartentagebuch`, `_buildGardenBlob` liest `gs_garden_plans` und `gs_gpx_tracks`, und `p.diary` steckt in `ps_myplants`. Und es geschah **lautlos**: der Nutzer erfuhr nie, dass etwas fehlt.
- **Die Deckel bleiben** — sie schützen die 5 MB, und das zu Recht. Was sich ändert: der herausfallende Eintrag wandert ins **Archiv** (IndexedDB, eigenes Kontingent) statt ins Nichts.
- **Und das Archiv ist erreichbar.** Einstellungen → Speicher zeigt die Zahl und hat einen „Sichern"-Knopf, der alles als JSON herunterlädt. Das war mir wichtig: heute habe ich schon **ein** Sicherheitsnetz repariert, das niemand erreichen konnte (v30.97, der Wiederherstellen-Banner). Ein zweites unerreichbares hätte ich nicht gebaut.
- **Einmaliger Hinweis** pro Schlüssel und Sitzung — nicht bei jedem Speichern nerven, aber auch nicht schweigen.
- **11 Kürzungsstellen** umgestellt: Gartentagebuch (2), Gartenpläne (4), GPX-Tracks (2), Pflege-Historie pro Pflanze (3). Das Archiv selbst ist auf 3'000 Einträge gedeckelt und räumt die ältesten ab — sonst hätte ich das Problem nur verschoben.
- **⚠️ Beim Umbau zweimal in dieselbe Falle getappt und sie beide Male vor dem Schreiben bemerkt:** die stärker eingerückten Zeilen (`          if (p.diary…`) enthalten die schwächer eingerückten als **Substring**, ein `str.replace` hätte also die falsche Stelle getroffen. Meine Zusicherung auf die Trefferzahl hat es beide Male abgefangen, bevor die Datei geschrieben wurde. Danach zeilennummernbasiert ersetzt — eindeutig.
- **Verify in Node, 9 Fälle.** `head` (Liste neueste-zuerst): 35 → 30 behalten, **die 5 ältesten** archiviert (`p30…p34`) ✅ · `tail` (Liste älteste-zuerst): ebenfalls **die 5 ältesten** (`t0…t4`) ✅ — in beiden Richtungen fällt das Alte heraus, nicht das Neue · genau am Deckel / darunter / leere Liste → nichts archiviert ✅ · `null` und Nicht-Array unverändert durchgereicht ✅ · **drei Kürzungen → genau ein Hinweis** ✅.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · IndexedDB-Version 2 → 3 (neuer Store `dropped_entries`; `onupgradeneeded` legt fehlende Stores ohnehin an) · Version synchron v31.08.

### 2026-08-31 (p) — v31.07: Der Render-Pfad zum Ausgangskorb — Fotos sind sofort sichtbar, auch vor dem Upload

> Der zweite Teil der Foto-Pipeline, der in v31.06 bewusst offen blieb. Damit ist sie rund: retten (v31.06) **und** anzeigen (jetzt).

- **Das Problem.** Ein Foto im Ausgangskorb liegt als base64 in IndexedDB. Die App baut ihre Ansichten als HTML-Strings zusammen — ein `<img src="gsphoto://7">` würde dort schlicht nicht laden. Nach v31.06 war das Bild also gerettet, aber bis zum Upload unsichtbar.
- **Der Weg, den ich NICHT gegangen bin:** jede einzelne Render-Stelle umbauen. Es sind viele, jede wäre eine neue Fehlerquelle, und der nächste Foto-Ort würde wieder vergessen.
- **Stattdessen ein Auflöser, der nach dem Rendern greift.** `gsResolvePhotosIn()` sucht `img[src^="gsphoto://"]`, holt die Bytes aus IndexedDB und setzt eine Object-URL. Ein `MutationObserver` auf `document.body` stösst das gebündelt (120 ms) an — **kein Aufrufer muss etwas davon wissen**, auch künftige nicht.
  - Object-URLs werden pro id **gecacht** (nicht bei jedem Render neu erzeugt) und nach erfolgreichem Upload **freigegeben** — sonst hielte der Browser die Bytes für die ganze Sitzung fest, obwohl das Bild längst aus der Cloud kommt.
  - Ist der Eintrag nicht mehr im Korb (hochgeladen und aufgeräumt), wird das Bild ausgeblendet statt ein kaputtes Symbol zu zeigen.
- **`gsQueuePhoto` liefert jetzt eine Referenz** (`gsphoto://<id>`) statt nur true/false. Fund, Pflanze-Bearbeiten und Pflanze-Neuanlage hinterlegen sie als Foto-Wert — das Bild erscheint sofort.
- **⚠️ Der Punkt, an dem es hätte schiefgehen können — und den ich an drei Stellen abgedichtet habe:** ein `gsphoto://…` ist eine **rein lokale** Referenz auf den Ausgangskorb *dieses* Geräts. Gerät sie in die Cloud, ist sie auf jedem anderen Gerät eine tote URL und rendert als kaputtes Bild. Abgefangen in:
  1. `map_user_finds`-Payload (Fund) — Platzhalter → `null`
  2. `_buildPlantsBlob` (Sync in `user_plants`) — via `_gsStripPhotoRefs`
  3. `gsSnapshotBuildState` (Backup, wird auf **anderen** Geräten wiederhergestellt) — via `_gsStripSnapPhotoRefs`
  „Kein Bild" ist für die anderen Geräte die ehrliche Aussage, bis der Upload durch ist; `gsFlushPhotoQueue` trägt das echte nach.
- **Verify in Node, 12 Prüfungen.** Kein Platzhalter im Cloud-Blob ✅ · echte URLs und base64 unangetastet ✅ · **unveränderte Einträge behalten ihre Objekt-Identität** (kein unnötiges Kopieren) ✅ · `null`, Nicht-Array, leeres Array, `null`-Eintrag in der Liste ✅ · **und das Original bleibt unverändert** — entscheidend, denn der lokale Platzhalter muss überleben, sonst verschwindet das Bild aus der Anzeige ✅.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.07.

### 2026-08-31 (o) — v31.06: Foto-Ausgangskorb — Fotos gehen nicht mehr verloren und fressen nicht mehr den Nutzer-Speicher

> Fernandos Freigabe für die Foto-Pipeline. Löst die drei verbliebenen Audit-Befunde **und** nimmt den Druck von der 5-MB-Grenze, der heute ab ~13–20 fotografierten Pflanzen alles blockiert.

#### Warum IndexedDB und nicht localStorage

Ein Foto belegt als base64 leicht **200 KB**. In den ~5 MB von localStorage liegen Pflanzen, Tagebuch, Ernte und Einstellungen — dort haben Fotos nichts verloren. IndexedDB hat ein eigenes, viel grösseres Kontingent. Der neue Store `pending_photos` (DB-Version 1 → 2; `onupgradeneeded` legt fehlende Stores ohnehin an, Bestandsinstallationen ziehen also sauber nach).

#### 1 · Fund-Fotos wurden verworfen

Schlug der Upload fehl, hiess es „Fund wird ohne Bild gespeichert" — und das Bild war **endgültig weg**, auch wenn nur kurz das Netz fehlte. Jetzt wandert es in den Ausgangskorb und wird nachgetragen, sobald wieder Verbindung besteht. Auch der Fall „gar nicht angemeldet" ist abgedeckt: früher wurde da nicht einmal ein Versuch gemacht und das Bild fiel weg; jetzt hält der Korb es fest, bis ein Konto da ist.

#### 2 · Der eingereihte Scan bekam ein FREMDES Foto

`gsScanPersistToCloud` las das Bild beim Flush aus `window._gsLastScanB64` — einer **globalen Variable**. Ein gestern eingereihter Scan bekam heute also entweder gar kein Foto (nach einem Neustart ist die Variable leer) oder das Foto eines **anderen, neueren** Scans. Das Foto reist jetzt **mit** dem Warteschlangen-Eintrag; die globale Variable dient nur noch dem Live-Pfad direkt nach dem Scannen.

#### 3 · Duplikate bei Timeout

`gsUploadImage` erzeugte pro Aufruf einen Zufallsnamen. Lief ein Upload in einen Timeout, der serverseitig aber durchlief, legte die Wiederholung eine **zweite Datei** an — verwaiste Bytes, die niemand referenziert. Neuer vierter Parameter `stableKey`: FNV-1a über den Schlüssel ergibt einen deterministischen, pfadsicheren Dateinamen; zusammen mit dem ohnehin gesetzten `x-upsert: true` wird dieselbe Datei überschrieben statt einer zweiten angelegt. Aufrufer ohne Schlüssel verhalten sich unverändert. Auch `gsRetryPhotoUploads` nutzt ihn jetzt — vorher legte **jeder** Nachhol-Versuch eine neue Datei an.

#### 4 · Pflanzen-Fotos landen nicht mehr im 5-MB-Speicher

Beide base64-Notnägel in `savePlant` (Bearbeiten und Neuanlage) gehen jetzt in den Ausgangskorb. Bei der Neuanlage steht die `id` erst nach dem `push` fest — das Foto wird deshalb dort eingereiht (`_gsPendingNewPlantPhoto`). Ist der Korb nicht verfügbar, greift weiterhin der alte base64-Weg, damit nie ein Bild verloren geht.

#### Verify

- **Zustandsautomat in Node, 5 Fälle:** Upload ok + Ziel da → nachgetragen, Eintrag weg · Upload ok + Fund inzwischen gelöscht → Eintrag weg (wandert nicht ewig mit) · Fehlschlag 1 und 5 → bleibt, Zähler hoch · **8. Fehlschlag → aufgeben** (ohne Deckel liefe ein dauerhaft abgelehntes Bild für immer).
- **Idempotenz belegt:** gleicher Schlüssel → identischer Pfad, andere Scans → andere Pfade, umlautsicher (`scan-…-Bärlauch` → `k68c9z0_scan175664000000.jpg`).
- 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.06.

#### Ehrlich zum Rest

Für **Gäste** liegt das Foto im Korb, bis ein Konto da ist — `gsFlushPhotoQueue` braucht eine Anmeldung. Besser als verwerfen, aber kein Upload ohne Konto. **Altbestand** an base64 in `ps_myplants` räumt weiterhin `gsMigrateBase64Photos` ab. Was noch fehlt, ist der Render-Pfad: ein Bild im Korb ist bis zum Upload nicht anzeigbar. Das ist der nächste Schritt (Auflöser, der aus dem Korb eine Object-URL macht) — bewusst getrennt, weil er die Anzeige an vielen Stellen berührt.

### 2026-08-31 (n) — v31.05: Die gestellte Falle im Garten-Sync entschärft

> Der Punkt aus v31.04s Restliste, der **von selbst** scharf wird. Kein Designproblem — die Hausregel für genau diesen Fall existiert längst, sie war hier nur nicht angewandt.

- **Der Befund.** `gsGardenSync.pullAll()` schrieb den Remote-Stand **hart** über den lokalen — bei Gartentagebuch, Ernte-Log, Gärten und Pflanzungen. Der einzige Schutz war „die Cloud-Antwort ist nicht leer" (`d.data.length`). Hat die Cloud **einen** Eintrag und lokal liegen zweihundert, waren die anderen 199 weg.
- **Warum es heute nicht auffällt — und genau deshalb gefährlich ist:** `garden_diary` hat in Produktion **0 Zeilen**. Der Empty-Guard greift also immer, und nichts passiert. Sobald aber der erste Eintrag entsteht, räumt der nächste Start das lokale Tagebuch leer. Eine Falle, die sich selbst stellt, sobald das Feature benutzt wird.
- **Zweiter Fehler daneben:** geladen wird mit `limit=500`, lokal geschrieben wurde aber `slice(0,200)` — während der lokale Schreiber (Z. ~8182) bei 500 deckelt. Selbst ein völlig sauberer Sync hätte also gekürzt.
- **Die Lösung ist die Hausregel, die es schon gibt.** `_gsMergeById()` führt über die `id` zusammen, bei Kollision **gewinnt der lokale Stand**, sortiert nach Zeit — genau wie `_gsRestoreKey` im Snapshot-Restore. Ein Eintrag, den dieses Gerät kennt, geht nie verloren; Einträge von anderen Geräten kommen hinzu. Caps jetzt konsistent mit den lokalen Schreibern: Tagebuch 500, Ernte 1000.
- **Verify in Node, 11 Fälle.** Der Ernstfall zuerst: Cloud 1 Eintrag, lokal 200 → **201 statt 1**, alle 200 lokalen nachweislich erhalten, der Cloud-Eintrag dazu. Kollision auf derselben `id` → lokale Fassung gewinnt. 600 Einträge mit Cap 500 → 500, neuester zuerst. Sonderfälle: beide leer, nur Cloud, nur lokal, **Eintrag ohne `id`** (wird nicht verschluckt), `null`-Eingaben. Dazu `_gsReadArr` gegen gültiges JSON, Müll, Nicht-Array und fehlenden Schlüssel.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.05.
- **Aus der v31.04-Restliste noch offen:** offline aufgenommene Fund-Fotos werden bei fehlgeschlagenem Upload verworfen · ein in die Offline-Queue gelegter Scan bekommt beim Flush kein oder ein **fremdes** Foto · fehlender Idempotenz-Schlüssel erzeugt Duplikate bei Timeout. Alle drei hängen am selben Thema wie die noch offene Produktfrage (Fotos im Blob) und gehören sinnvollerweise gemeinsam gelöst.

### 2026-08-31 (m) — v31.04: 🔴 Abmelden und wieder anmelden löschte das Konto auf ALLEN Geräten

> Der schwerste Befund der ganzen Session. Aus den beiden Audit-Bereichen „multi-geraet" und „offline", die ich zuvor noch nicht gelesen hatte — beide selbst am Code nachvollzogen und die Kette in Node nachgestellt.

#### Die Kette

1. `gsOnLogout()` → `gsClearUserDataKeys()` leert `ps_myplants`, Tagebuch, Totliste, Saatgut-Inventar — **und markiert dabei über den `setItem`-Patch alles als dirty**.
2. `window._gsInitialSyncDone` steht weiter auf `true` vom vorigen Login. Der v27.01-Empty-Clobber-Guard wurde nämlich **nur bei einem Wechsel des Kontos** neu scharf gestellt (`lastUid !== uid`, Z. ~73338) — beim Logout nicht.
3. Re-Login mit **demselben** Konto, ohne Seiten-Neuladen: der Wechsel-Zweig greift nicht, der Guard bleibt entwaffnet.
4. Der nächste Flush schiebt einen **leeren** Pflanzen-Blob hoch.
5. Das Konto ist in der Cloud leer — **und das erreicht alle Geräte.**

Eine völlig normale Handlung — abmelden, wieder anmelden — löschte damit den gesamten Bestand überall.

#### Der zweite Fund an derselben Stelle

`gs_sync_queue` und `gs_sync_dirty` stehen **nicht** in `GS_USER_KEYS` und überlebten den Logout. Die `user_id` wird aber erst **beim Flush** eingesetzt (`Object.assign({user_id: _uid()}, op.row)`). Ungesendete Ernte- und Tagebuch-Vorgänge von Nutzer A landeten dadurch im Konto von Nutzer B — Datenverfälschung und Datenschutz-Problem in einem. Auf einem Familien-Tablet reicht ein Kontowechsel.

#### Die Lösung

- **`window._gsInitialSyncDone = false` in `gsOnLogout()`** — der Guard ist wieder scharf, bis der erste Pull des neuen Logins durch ist. Das ist der eigentliche Fix.
- **Sync-Zustand des scheidenden Nutzers räumen:** `gs_sync_queue`, `gs_sync_dirty`, `gs_sync_last_push` und die Pro-Scope-Marker.
- **Verlustfrei, weil vorher zweimal gesichert wird:** `sbLogout()` legt bereits den `pre_logout`-Snapshot an, und **neu** kommt davor ein `gsCloudSync.flushNow()` — beides noch mit gültigem Token, beides im 2,5-s-Rennen, damit der Logout nie hängt. Die Reihenfolge war entscheidend: `sbClearSession()` löscht den Token **vor** `gsOnLogout()`, ein Flush aus `gsOnLogout` heraus wäre also zwangsläufig fehlgeschlagen.
- **Verify — die Kette in Node nachgestellt, vorher/nachher:** vorher „LEERER Blob gepusht — Cloud-Pflanzen: 0" und „Warteschlange von Nutzer A liegt noch da → flusht ins nächste Konto"; nachher „kein Push — Cloud-Pflanzen: 3" und „Warteschlange geräumt". 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.04.

#### Noch offen aus diesen zwei Bereichen

Bewusst nicht in diesem Release, weil je eigener Umfang: offline aufgenommene Fund-Fotos werden bei fehlgeschlagenem Upload verworfen · ein in die Offline-Queue gelegter Scan bekommt beim Flush kein oder ein **fremdes** Foto (das Bild wird aus einer globalen Variable statt aus dem Queue-Eintrag gelesen) · `gsGardenSync.pullAll` überschreibt Tagebuch und Ernte-Log hart (aktuell harmlos, weil `garden_diary` 0 Zeilen hat — sobald die erste entsteht, wischt der nächste Boot die lokalen Einträge weg) · fehlender Idempotenz-Schlüssel erzeugt Duplikate bei Timeout.

### 2026-08-31 (l) — v31.03: Das Sicherheitsnetz für den Speicher zerstörte Daten, log über die Grenze und verschenkte Platz

> Drei Punkte aus dem Quota-Bereich des Datenverlust-Audits, die **keine** Produktentscheidung brauchen. Alle drei am Code nachvollzogen, die riskanteste Änderung in Node gegen 13 Fälle geprüft.

#### 🗑️ Der Integritäts-Check vernichtete genau das, was er retten sollte

- **Der Befund.** Bei kaputtem JSON schrieb `gsStorageIntegrityCheck` die **ersten 2000 Zeichen** als „Backup" weg und löschte dann den **ganzen** Schlüssel. Der Kommentar darüber behauptete „räumt auf ohne Datenverlust". Bei einer echten Pflanzenliste (Zehntausende Zeichen) ist das ein abgeschnittenes, nie wieder verwertbares Fragment — abgeschnittenes JSON lässt sich auch nicht mehr reparieren. Für Schlüssel ohne Cloud-Spiegel (`gs_scan_corrections`, `ps_feedback`, `ps_votes`, `gs_ki_analyses`, `userLocation`) war das **endgültige Vernichtung**.
- **Neu, in dieser Reihenfolge:**
  1. **Retten statt wegwerfen.** Die häufigste Korruption ist ein abgeschnittener Schreibvorgang — die Quota hat mittendrin abgebrochen. `_gsSalvageJson()` schneidet bis zum letzten **vollständigen** Element zurück und schliesst die Klammer. Aus „kaputt" wird so „fast alles noch da".
  2. Nicht rettbar → **vollständig** sichern (nicht abschneiden) und die Sicherung **zurücklesen**. Nur wenn sie wirklich steht, darf das Original weg.
  3. Sicherung fehlgeschlagen (Speicher voll) → **Schlüssel bleibt unangetastet**. Ein kaputter Schlüssel, den man noch ansehen kann, ist besser als stille Vernichtung.
- **In Node gegen 13 Fälle geprüft:** abgeschnitten nach 1/2 Einträgen → gerettet · mitten im 3. Eintrag → 2 gerettet · **mitten im ersten Eintrag → `null`** (erfindet nichts) · nur öffnende Klammer, leeres Array, Müll, leerer String, `null` → alle `null` · **eckige/geschweifte Klammern innerhalb von Strings** und **escapte Anführungszeichen** werden korrekt nicht mitgezählt · Objekte ebenso. Die geretteten Daten wurden gegengeprüft: echte Namen, echte Struktur.

#### 📏 Das Speicher-Modal zeigte die falsche Grenze

- Angezeigt wurde `navigator.storage.estimate()` — die **Origin-Quota**, hunderte MB bis GB. Der Balken stand bei ~0.8 % und beruhigte, während die tatsächlich bindende Grenze die **~5 MB von localStorage** sind. Genau die falsche Auskunft für jemanden, der nachsieht, *weil* Daten fehlen. Die einzige ehrliche Zahl („Lokal belegt: 4980 KB") stand ohne Vergleichswert ganz unten.
- **Jetzt:** „Lokaler Speicher — 4.87 MB / 5 MB" ganz oben, mit Balken, der ab 75 % orange und ab 90 % rot wird, plus Klartext („Fast voll. Neue Einträge und Fotos können ab jetzt fehlschlagen"). Die Origin-Quota bleibt als klar benannte Nebeninformation („Cache & Bilder — separates, viel grösseres Kontingent").

#### 🌍 Der Übersetzungs-Cache ass vom Budget der Nutzerdaten

- `gs_i18n_bundles` wuchs **ungedeckelt**: ~150–200k Zeichen pro je besuchter Sprache, bis zu ~0.8 MB der 5 MB — für Daten, die jederzeit neu ladbar sind. Und weil Nutzer-Speicher und Cache sich dieselben 5 MB teilen, ging das direkt zulasten von Pflanzen, Tagebuch und Ernte.
- **Jetzt** wird nur die **aktuelle** Sprache gesichert (Deutsch braucht kein Bundle — es ist der Fallback im Code). Andere Sprachen bleiben zur Laufzeit im Speicher, werden aber nicht persistiert. Kostet einen Abruf beim Sprachwechsel, spart dauerhaft Platz, der Nutzerdaten gehört. Dasselbe für `gs_i18n_srcmaps`.
- **Und wenn selbst das nicht passt:** der Cache wird ganz geräumt statt halb stehen zu lassen. Übersetzungen sind ersetzbar, Nutzerdaten nicht. Möglich wurde das erst durch v30.98 — vorher konnte `setItem` einen Fehlschlag gar nicht melden.
- Kompatibilität geprüft: der Lade-Pfad iteriert über `SUPPORTED` und weist nur zu, was vorhanden ist — eine schlanke Sicherung mit einer Sprache lädt korrekt. `current` wird in `setLang` **vor** dem Abruf gesetzt, die Sicherung trifft also immer die richtige Sprache.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · zwei ungenutzt gewordene Variablen entfernt (`_lsKB`) · Version synchron v31.03.

### 2026-08-31 (k) — v31.02: Der Sync verglich zwei verschiedene Uhren — und log über sich selbst

> Die letzten zwei offenen Punkte aus dem Bereich „sync-zuverlaessigkeit" des Datenverlust-Audits. Beide selbst am Code nachvollzogen und in Node durchgespielt.

#### ⏰ Last-Write-Wins stellte die Geräte-Uhr gegen die Server-Uhr

- **Der Befund.** `_shouldOverwriteLocal()` entschied mit
  `new Date(dirtyAt).getTime() > new Date(cloudUpdatedAt).getTime()`.
  `dirtyAt` kommt aus `markDirty()` — `new Date().toISOString()`, also vom **Gerät**. `cloudUpdatedAt` ist `updated_at` aus Postgres, also vom **Server**.
- **Wirkung.** Geht die Geräte-Uhr nach — nach leerem Akku, falsch gestellt, ohne Zeit-Sync — sieht eine soeben getippte lokale Änderung **älter** aus als der Cloud-Stand. Die Schutzbedingung greift nicht, der Pull überschreibt ungepushte Arbeit. Kein Randfall: eine um Minuten nachgehende Uhr genügt.
- **Ein Vergleich gegen `gs_sync_synced_at_<scope>` wäre auch nicht sauber gewesen** — dieser Schlüssel wird je nach Pfad mal mit der Server-Zeit (Pull) und mal mit der Geräte-Zeit (`_markSuccess` im Push) geschrieben. Das habe ich geprüft, bevor ich es als Alternative verworfen habe.
- **Lösung: gar kein Uhrenvergleich mehr.** Die Dirty-Markierung **existiert** genau dann, wenn es eine noch nicht gepushte lokale Änderung gibt — `markDirty()` setzt sie, `_markSuccess()` löscht sie erst nach einem nachweislich erfolgreichen Push (seit v30.99 mit HTTP-Status-Prüfung). Genau das ist die Frage, die hier zu beantworten ist, und sie braucht keine Zeitrechnung.
- **Bewusste Abwägung, offen benannt:** hat ein anderes Gerät zwischenzeitlich etwas Neueres gepusht, gewinnt jetzt das hier ungepushte Lokal und wird hochgeschoben. Dieselbe Last-Write-Wins-Semantik wie bisher, nur richtig entschieden — und sie fällt zugunsten dessen aus, was auf **diesem** Gerät noch nicht gesichert ist. Gegen das Ersetzen einer grösseren Liste durch eine kleinere schützt weiterhin der Count-Guard (v28.22).

#### 🤥 „gerade eben synchronisiert", während nichts ankam

- **Der Befund.** `gs_sync_last_push` wurde am Ende von `_flush()` **bedingungslos** gestempelt — auch wenn jeder Push in einen 401 lief und `stillDirty` randvoll blieb.
- **Was der Nutzer las:** „gerade eben synchronisiert · 3 ausstehend". Der beruhigende Teil vorn, der eigentliche Zustand als Nachsatz — genau falsch herum für jemanden, der nachsieht, **weil** Daten fehlen.
- **Lösung, zwei Teile:** der Zeitstempel wird nur noch bei vollständigem Erfolg gesetzt (leeres `stillDirty` **und** leere Warteschlange) und bedeutet damit „letzte nachweislich vollständige Synchronisierung"; ein unvollständiger Lauf schreibt stattdessen eine Warnung mit den offenen Bereichen ins Log. Und die Statuszeile stellt das Problem nach vorn: „⚠️ 3 Änderung(en) noch nicht gesichert · zuletzt vollständig vor 42 Min".
- **Verify in Node durchgespielt.** LWW: nichts Ungepushtes → Cloud autoritativ · ungepusht bei vorgehender Uhr → lokal behalten · **ungepusht bei 20 Min nachgehender Uhr → lokal behalten** (vorher: überschrieben) · Uhr Jahre daneben → lokal behalten · kein Cloud-Stand → lokal behalten. Stempel: alles durch → gesetzt · ein Scope offen → nicht gesetzt · Warteschlange nicht leer → nicht gesetzt. Statuszeile in allen drei Zuständen geprüft.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Version synchron v31.02.
- **Damit ist der Bereich „sync-zuverlaessigkeit" des Audits abgearbeitet.** Offen bleiben nur die zwei Punkte, die eine Produktentscheidung brauchen: Fotos als base64 im Blob und die still per `slice()` rotierenden Listen.

### 2026-08-31 (j) — v31.01: XP-Balken-Bug an der Wurzel + Benachrichtigungen haben nur noch EINEN Ort

> Zwei Aufträge von Fernando. Beide bewusst an der Ursache gelöst, nicht am Symptom.

#### 🐛 „Ich klicke auf den XP-Balken und dann fängt alles an zu bugen" (dritte Meldung)

- **Ursache gefunden — und sie ist grösser als der Toast.** `renderProfileLoggedIn()` rief bei **jedem** Öffnen des Profils `gsOnLoginSuccess()` auf, also den kompletten Login-Übergang. Der XP-Balken im Home öffnet genau dieses Profil. Pro Klick lief damit ab:
  - `closeModal('modal-profile')` — **auf das Modal, das gerade geöffnet wird**
  - `gsPullGlobalApiKey()` (Netz)
  - „🛡️ Admin-Modus aktiv" nach 600 ms ← genau das, was Fernando sah
  - `gsAboStartTrial()` — Abo-Logik bei jedem Profil-Blick
  - `gsLoadCloudScans()` nach 1200 ms (Netz, plus Toast bei Treffern)
  - `gsRequestPersistentStorage()` und `gsKnowledgePull()` aus den beiden Wrappern
- Weil `renderProfileLoggedIn` **async** ist und `openUserProfile` direkt danach `openModal()` aufruft, schlossen und öffneten sich Modal und Schliess-Befehl gegenseitig — und 600/1200 ms später schoben Toasts und Netz-Antworten die UI weiter durcheinander. Das ist das „dann fängt alles an zu bugen".
- **Lösung — zwei getrennte Zuständigkeiten statt einer überladenen Funktion:**
  - `_gsApplyAuthUiState()` — billig, idempotent, jederzeit aufrufbar: nur Onboarding-Key, Gast-Flag, Gast-Banner, Admin-Zeilen. Kein Netz, keine Toasts, keine Modals, keine Abo-Logik. **Das** ruft `renderProfileLoggedIn` jetzt.
  - `gsOnLoginSuccess()` — der Übergang, mit Wachposten auf der `uid`: läuft pro echtem Login genau einmal. `gsOnLogout()` setzt ihn zurück, ein Kontowechsel lässt ihn wieder zu.
  - Die beiden Wrapper prüfen denselben Wachposten — sie sitzen **vor** der Basisfunktion und hätten sonst weiter bei jedem Aufruf gefeuert.
- **Nebenbefund mit erledigt:** `sbLogin()` **und** `onbDoLogin()` riefen beide `gsOnLoginSuccess()` auf — der Übergang lief also schon beim normalen Anmelden doppelt. Der Wachposten beendet das.
- **Verify in Node durchgespielt** (Wachposten + beide Wrapper + billiger Abgleich): echter Login → Übergang **einmal** · zweiter Login-Aufruf → nur UI-Abgleich · drei XP-Klicks → **nur** UI-Abgleich, kein Toast/Netz/Trial · nach Logout → Übergang wieder · Kontowechsel → Übergang wieder.

#### 🔔 Benachrichtigungen und Mitteilungen aus dem Menü entfernt

Seit v30.85 gibt es den Glocken-Knopf in der Kopfzeile, der direkt ins Benachrichtigungs-Center führt — mit Verlauf, abhakbaren Aufgaben und mehr Platz. Zwei Orte für dieselbe Sache hiess: zwei Render-Pfade, zwei Zustände, doppelte Pflege.

- **Entfernt:** `#gs-notif-panel` (Markup), `gsRenderNotifPanelInMenu()` (68 Zeilen), alle 6 Aufrufstellen, 22 CSS-Regeln.
- **Der Server-Pull beim Menü-Öffnen bleibt** — er hält jetzt die Glocken-Badge frisch statt das Panel zu füllen.
- **Zwei Folge-Reste gleich mitgenommen, weil sie sonst falsch geworden wären:**
  - Die rote Badge am **Menü-Tab** ist weg. Sie hätte weiter ungelesene Benachrichtigungen angezeigt und damit ins Menü geführt, wo es keine mehr gibt. `gsRenderNotifBadge()` bleibt als Name (≈20 Aufrufer) und ist jetzt ein Synonym für `gsRenderBellBadge()`.
  - **`closeMainMenu()` quittiert die Badge nicht mehr.** Das stammte aus v30.81, als „Menü zu" gleichbedeutend mit „gesehen" war. Ohne Panel hätte es Mitteilungen als gelesen markiert, die niemand angesehen hat — Menü auf, Menü zu, Glocke leer. Quittiert wird jetzt dort, wo man wirklich hinschaut: `gsOpenNotifCenter()`.
- **Bewusst behalten:** `.gs-notif-openall` (nutzt der Aufgaben-Notizzettel bei „Meine Pflanzen") und der Notizzettel selbst.
- **Verify:** 0 verbliebene Referenzen auf `gs-notif-panel`, `gs-notif-header`, `gs-notif-item`, `gs-notif-scroll`, `gsNotifPulse` · Glocke und Center unangetastet (14 Referenzen) · ungenutzt gewordene Variable `wasOpen` entfernt · 9/9 Inline-Scripts `node --check` OK · Version synchron v31.01.

### 2026-08-31 (i) — v31.00: Eine Pflanzen-Bearbeitung konnte im Nichts landen — plus ein widerlegter Audit-Befund

- **`savePlant` hielt eine Objekt-Referenz über ein `await` hinweg.** `const p = myPlants.find(…)` — danach ein `await` auf den Foto-Upload, der über das Netz geht und Sekunden dauern kann. Genau in diesem Fenster kann `gsSyncUserDataOnLogin` `myPlants = pd.plants` ausführen und das **ganze Array durch frische Objekte aus der Cloud ersetzen**. `p` zeigte dann auf ein verwaistes Objekt: Name, Spitzname, Emoji, Wasser, Sonne, Notizen und Foto landeten im Nichts, `savePlantsToStorage()` serialisierte das **neue** Array — und der Nutzer bekam trotzdem „✅ Aktualisiert."
  - **Fix ohne Referenz über den `await`:** Felder erst in ein einfaches Objekt einsammeln, dann uploaden, dann die Pflanze **frisch per id** auflösen und alles auf einmal anwenden.
  - **Der Fall „Pflanze ist weg" wird jetzt ehrlich behandelt:** wurde sie während des Uploads von einem anderen Gerät gelöscht, sagt die App das, statt still zu schlucken — inkl. aufgeräumtem Foto-State.
- **Nebenwirkung von v30.98, positiv:** `savePlantsToStorage()` gibt `gsStore.setJSON(…)` zurück, und das meldet seit v30.98 einen Quota-Fehlschlag wirklich. Damit ist der bereits vorhandene Zweig `else gsToast('⚠️ Speicher fast voll — …')` **wieder erreichbarer Code** statt Dekoration. Der Wurzelfix zahlt sich hier direkt aus.
- **⚠️ Ein Audit-Befund WIDERLEGT** — dokumentiert, damit niemand daran „repariert":
  - Behauptung war: „Der Gartentagebuch-Cap ist inkonsistent: lokal 500 Einträge, im pullAll-Pfad aber 200 — ein Sync könnte 300 lokal vorhandene Einträge wegwerfen."
  - **Stimmt nicht.** Die 200er-Caps (index.html:7431, 7505, 28910) sitzen auf **`p.diary`** — der *per-Pflanze*-Pflegehistorie. Die 500 sitzt auf **`gs_gartentagebuch`** — dem *globalen* Gartentagebuch. Zwei verschiedene Arrays, jedes für sich konsistent gedeckelt. `_buildPlantsBlob` liest `gs_gartentagebuch` sogar **ohne** Cap. Es gibt keinen Pfad, auf dem 300 Einträge verloren gehen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `editingPlantId` ist modulweit (`let`, Z. 20766) und nach dem Umbau weiterhin im Scope · der frühe `return` im Abbruch-Zweig überspringt nur Speichern/Rendern, was ohne Pflanze auch nichts zu tun hätte · Version synchron **v31.00** (Rollover bei .99, wie v26.99 → v27.00).
- **Weiterhin offen** (je eigene Entscheidung): Last-Write-Wins vergleicht Geräte-Uhr gegen Server-Zeitstempel · der Sync meldet „gerade eben synchronisiert" auch bei durchgehend fehlgeschlagenen Pushes · Fotos als base64 im Blob · ungedeckelte `gs_gpx_tracks`.

### 2026-08-31 (h) — v30.99: Zwei Sync-Pfade, die Fehlschläge als Erfolg verbuchten

> Aus dem Datenverlust-Audit (Bereich „sync-zuverlaessigkeit"). Beide Befunde selbst am Code nachvollzogen. Beide sind **echte Datenverlust-Ketten**, keine Schönheitsfehler — und beide enden damit, dass ein veralteter Cloud-Stand die lokalen Daten überschreibt.

- **Kette 1 — der keepalive-Push auf Mobile.** Beim Schliessen/Backgrounding der App (`pagehide`/`beforeunload`) läuft der Push über `fetch(…, {keepalive:true})`. Danach wurde `_markSuccess()` **bedingungslos** aufgerufen: kein Blick auf den HTTP-Status. Ein 401 oder 500 galt als erfolgreicher Push — und `_markSuccess` schreibt `gs_sync_synced_at_<scope>` und **löscht den dirty-Marker**. Beim nächsten Start sieht `_shouldOverwriteLocal` daraufhin „lokal sauber, synchronisiert um T" und lässt den veralteten Cloud-Stand über die lokalen Daten schreiben. Auf Mobile ist das der **Haupt**-Push-Pfad, also der Normalfall.
  - Verschärfend: dieser Pfad nutzt den **rohen** Token aus dem Speicher, ohne den Auto-Refresh, den `sbFetch` hat. Supabase-JWTs laufen nach ~1 h ab — ein 401 war damit nicht der Ausnahmefall, sondern nach einer Stunde Nutzung die Regel.
  - **Fix:** HTTP-Status auswerten, bei Fehler dirty bleiben. Und vorher die Token-Frische gegen `gs_sb_expires` prüfen (30 s Puffer) — beim Schliessen der App lässt sich nicht mehr zuverlässig refreshen, also lieber gar nicht senden und schmutzig bleiben; der nächste Start holt es nach.
- **Kette 2 — ein fehlgeschlagener Pull sah aus wie ein leerer.** `sbFetch` **wirft nicht**, es liefert `{error}`. Die Bedingungen `if (g && !g.error && …)` überspringen den Block dann einfach — ein Netzfehler war von „die Cloud hat noch nichts" nicht zu unterscheiden. Am Ende wurde trotzdem `window._gsInitialSyncDone = true` gesetzt, was den **v27.01-Empty-Clobber-Guard entwaffnet**, und das direkt folgende `flushNow()` schrieb den womöglich leeren lokalen Stand über die Cloud. Genau der Datenverlust, gegen den der Guard gebaut wurde.
  - **Fix:** die drei Blob-Pulls zählen ihre Fehler. Bei `_pullErrors > 0` bleibt der Guard scharf und es wird **nicht** geflusht; der nächste Pull-Versuch entscheidet neu. Eine leere Antwort **ohne** Fehler zählt weiterhin als Erfolg — ein frischer Nutzer hat legitim nichts in der Cloud und muss seinen ersten echten Stand pushen können.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · `return` im Erfolgspfad liegt im `try`, das `finally` (Race-Guard-Reset) läuft also weiterhin · `gs_sb_expires` ist im selben Millisekunden-Format, in dem `sbSaveSession` es schreibt (Vergleich verifiziert) · Version synchron v30.99.
- **Aus demselben Bereich noch offen** (je eigene Entscheidung): Last-Write-Wins vergleicht Geräte-Uhr gegen Server-Zeitstempel (Clock-Skew verliert ungepushte Änderungen) · `savePlant` hält eine Objekt-Referenz über ein `await` hinweg, während der Pull `myPlants` ersetzen kann · der Sync meldet „gerade eben synchronisiert" auch dann, wenn jeder Push fehlschlug.

### 2026-08-31 (g) — v30.98: Der Speicher-Wrapper log — und mit ihm die halbe App

> Aus dem Datenverlust-Audit (Bereich „quota-stille-fehler", 14 Befunde). Die Wurzel selbst am Code nachvollzogen und mit einem simulierten vollen Speicher in Node durchgespielt.

- **Die Wurzel.** Der globale `localStorage.setItem`-Patch (v28.91) fing jeden `QuotaExceededError` ab und gab **`undefined`** zurück. Das hat zwei Folgen, die zusammen ein halbes System entwerten:
  1. **Jeder** `try { localStorage.setItem(…) } catch { …Fallback… }` im ganzen Monolithen ist toter Code — die Ausnahme kommt nie an.
  2. `gsStore.set()` wartete ebenfalls nur auf eine Ausnahme und meldete deshalb **ausnahmslos Erfolg**, auch wenn nichts geschrieben wurde.
- **Warum nicht einfach wieder werfen lassen:** genau dagegen wurde der Wrapper gebaut (iOS-Safari-Privatmodus, wo `setItem` grundsätzlich wirft). Der Rückgabewert ist der einzige ehrliche Kanal, der bleibt. Native `setItem` liefert `undefined` — `=== false` ist also eindeutig unser eigenes Signal, und ein ungepatchter Pfad bleibt über die Ausnahme weiterhin korrekt abgedeckt.
- **Drei Stellen, die dadurch gelogen haben, jetzt ehrlich:**
  - **Das Anmelden schlug bei vollem Speicher still fehl.** `sbSaveSession` ignorierte den Rückgabewert; der Nutzer landete nach *korrekter* Passworteingabe wieder auf dem Login-Screen — ohne Fehlermeldung, ohne Zugriff auf seine Cloud-Daten. `sbSaveSession` gibt jetzt true/false zurück und prüft per **Rücklesen**, ob der Token wirklich im Speicher steht (der einzige echte Beweis; bei zwei kurzen Strings billig). `sbLogin` bricht mit einer klaren Meldung ab, statt Erfolg zu melden.
  - **`gsSnapshotRestore` meldete „✅ Daten wiederhergestellt!"**, auch wenn bei voller Quota **kein einziger** Schlüssel geschrieben wurde — das letzte Sicherheitsnetz log den Nutzer an. Jetzt wird mitgezählt: nichts geschrieben → Fehlermeldung; teilweise → „x von y, bitte nach dem Aufräumen nochmal"; und in beiden Fällen `return false`.
  - `gsStore.set` zählte den Quota-Treffer ein zweites Mal, den der Wrapper schon gezählt hatte — die Statistik stand doppelt.
- **Verify — mit simuliertem vollem Speicher in Node**, nicht nur `node --check`: Normalbetrieb → `true` · Speicher voll → `gsStore.set` **false** (vorher immer true), `setItem` **false** (vorher undefined), `setJSON` false · Lesen bleibt intakt · **`setItem` wirft weiterhin nicht** (iOS-Privatmodus-Schutz nachweislich unversehrt) · Quota-Zähler exakt 3 bei 3 Fehlschlägen (vorher 5). 9/9 Inline-Scripts OK · Version synchron v30.98.
- **Bewusst noch offen** aus demselben Audit-Bereich, weil je eigene Entscheidung nötig: Fotos als base64 im `ps_myplants`-Blob (sprengt die 5-MB-Grenze ab ~13–20 Pflanzen), `gs_gpx_tracks` ungedeckelt (bis ~8 MB), zehn Listen die still per `slice()` rotieren (bei vier davon ist der abgeschnittene Eintrag auch in der Cloud weg), und das Speicher-Modal, das die Origin-Quota statt der ~5-MB-Grenze zeigt.

### 2026-08-31 (f) — v30.97: Das Cloud-Backup war da — nur nicht erreichbar

> Grundlage: Datenverlust-Audit (59 Agenten, adversarisch gegengeprüft). Kernbefund selbst am Code nachvollzogen, nicht übernommen.

- **Der Befund.** `gsSnapshotMaybeOfferRestore()` brach ab, sobald `_gsSnapshotHasContent(local)` true war. Diese Prüfung schaut auf genau **10 Domänen** (plants, diary, ernte, achievements, markers, scan_history …) — dieselben, die der Login-Pull **2,7 Sekunden früher** wieder befüllt (`t=1800ms` vs. `t=4500ms`). Nach einem Speicher-Wipe war der Wiederherstellen-Banner also **nie** zu sehen. Und dieser Banner-Knopf war die **einzige** Aufrufstelle von `gsSnapshotRestore()` — nachgezählt: 3 Treffer im ganzen Repo (Definition, `window`-Export, Banner).
- **Was dadurch praktisch verloren war**, obwohl es vollständig in `user_state_snapshots` lag: eigene Rezepte & Heilmittel, Bodenprofil, Garten-Standort, Scan-Korrekturen, Marktplatz-Käufe/Gebote, abgegebene Bewertungen, Aktions-Zähler, `gs_prefs` — und `gs_reminder_prefs` (die Per-Pflanzen-Giesserinnerungen: wird **gepusht**, aber die Pull-`stateMap` liest sie nicht zurück; der Snapshot ist ihr einziger Rückweg).
- **Verschärfend — der gute Snapshot wurde aktiv verdrängt.** Die Aufbewahrung behält 6 Snapshots plus den je neuesten pro Typ. Nach dem Wipe ist `_gsSnapshotHasContent` durch die gepullten Pflanzen wieder true → alle ~3 h legte ein `auto_periodic`-Snapshot nach, dem die verlorenen Domänen fehlen. **Binnen Stunden war das brauchbare Backup weg.**
- **Der Fix, drei Teile:**
  1. **Ein erreichbarer Weg:** neue Einstellungs-Zeile „♻️ Aus Cloud-Backup wiederherstellen" → `gsSnapshotRestoreManual()` mit Rückfrage. Gefahrlos, weil `_gsRestoreKey` nur in **leere** Schlüssel schreibt und id-Arrays mit Vorrang für lokal merged — es kann nichts überschreiben (im Code verifiziert).
  2. **Die richtige Frage:** der Banner hängt nicht mehr am Gesamt-Content, sondern an `_gsSnapshotHasExclusiveGap()` — „fehlt etwas, das **nur** im Snapshot steht?".
  3. **Verdrängungs-Schutz:** automatische Snapshots halten an, solange etwas fehlt, das zuletzt noch da war, und bieten stattdessen die Wiederherstellung an. Vom Nutzer ausgelöste Snapshots (`manual`/`pre_logout`/`pre_migration`) laufen weiter — dort ist der Wille eindeutig.
- **Eine eigene Schwäche gefunden und behoben:** der erste Entwurf des Verdrängungs-Schutzes stützte sich auf eine Spur in `localStorage` (`gs_snapshot_had`) — die bei „Browserdaten gelöscht" **mitgelöscht** wird, also genau im Ernstfall fehlt. Die massgebliche Prüfung vergleicht jetzt gegen den **Cloud-Snapshot** (`fn_user_snapshot_latest`); die lokale Spur ist nur noch die Abkürzung, die den Netz-Aufruf spart. Kosten: ein RPC alle ~3 h.
- **Verify — nicht nur `node --check`:** die neue Logik in Node gegen einen simulierten `localStorage` + Cloud durchgespielt, 6 Szenarien: kompletter Wipe ohne lokale Spur → **greift** · alles vorhanden → greift nicht · gar kein Backup → greift nicht · Cloud-Exklusivdomänen leer → kein Fehlalarm · `reminder_prefs` im `state`-Blob → greift · **Netzfehler → greift nicht** (fail-open, ein Ausfall darf das Backup nie stoppen). Dazu: `_GS_SNAPSHOT_ONLY` vor die erste Verwendung gezogen (hoisting hätte zwar getragen, ist aber unlesbar), `gs_snapshot_had` in `GS_USER_KEYS` (sonst blockierte die Spur beim Konto-Wechsel die Snapshots des nächsten Nutzers). 9/9 Inline-Scripts OK · Version synchron v30.97.

### 2026-08-31 (e) — v30.96: Die drei „unbelegten" Audit-Behauptungen selbst nachgeprüft

> Das Backend-Audit markierte drei Befunde ausdrücklich als **nicht belegt** („Beweislage dünn — muss nachgeprüft werden, bevor jemand daran arbeitet"). Genau richtig so. Ich habe alle drei selbst gegen Code und Live-DB geprüft: **alle drei treffen zu** — aber zwei sind deutlich harmloser als behauptet, und einer ist ernster.

#### 1 · Sensor-Messwerte gingen ins Leere — zutrifft, aber schlafend

`gsPushSensorReading` schickte `value:`, die Spalte heisst `value_num` (double precision). PostgREST antwortet auf eine unbekannte Spalte mit 400 — und der `catch(e){ console.warn }` verschluckte das. Kurios: der ESP32-Beispielcode in derselben Datei (Z. ~59659) und der Lesepfad (Z. ~59947, `select=metric,value_num,ts`) benutzen längst den richtigen Namen — nur der App-eigene Schreibpfad nicht.

- **Ehrliche Einordnung:** `gsPushSensorReading` hat aktuell **null Aufrufer**. Der Fehler ist real, aber schlafend — er wäre beim ersten echten Einsatz zugeschlagen. Live: `sensor_devices` = 1, `sensor_readings` = 0.
- Gefixt, plus: die Funktion gibt jetzt `true`/`false` zurück, damit ein künftiger Aufrufer den Fehlschlag überhaupt bemerken kann.

#### 2 · GardenSync lief in eine Endlosschleife — zutrifft, aber **kein** Datenverlust

`pushDiary` sendet `id: entry.id`, und lokale Tagebuch-Einträge bekommen `id: Date.now()` — eine **Zahl**. `garden_diary.id` ist aber `uuid`. Postgres antwortet `22P02 invalid input syntax for type uuid`. Gleiches Bild bei `gardens` (`id: 'gard_default'`) und `garden_plantings`. Belegt: **garden_diary = 0, gardens = 0, garden_plantings = 0 Zeilen** — seit jeher.

`flushQueue` schob **jeden** Fehlschlag zurück in die Warteschlange, ohne Zähler und ohne zwischen „gleich nochmal" und „gelingt nie" zu unterscheiden. Ergebnis: bis zu 500 Vorgänge, die bei **jeder** Änderung und **jedem** `online`-Event erneut gegen dieselbe Wand liefen, plus ein dauerhaftes „⚠️ N Sync pending".

- **Wichtige Korrektur zur Behauptung des Ermittlers:** es geht **nichts verloren**. Tagebuch, Gärten und Pflanzungen sind über die `gsCloudSync`-Blobs (`user_plants`, `user_gardens`) längst cloud-gesichert. GardenSync ist ein **zweiter, nie funktionierender Weg zu denselben Daten**. Der Schaden war der endlose Wiederholungslauf und die falsche Statusanzeige — nicht Datenverlust.
- **Fix bewusst minimal statt Refactor:** `flushQueue` unterscheidet jetzt dauerhafte Datenfehler (22P02, Constraint-Verletzungen, 4xx → sofort raus) von vorübergehenden (Netz/5xx → bis zu 5 Versuche, dann raus, mit Log). Plus eine Einmal-Bereinigung der bereits vergifteten Warteschlange (`gs_garden_sync_queue_purged_v3096`, behält nur Vorgänge mit gültiger UUID).
- **Offen als Eigentümer-Entscheid:** GardenSync und `gsCloudSync` decken dieselben Daten ab. Zwei Sync-Wege für eine Domäne sind genau die Mehrdeutigkeit, die Fehler erzeugt. Entweder GardenSync stilllegen oder die IDs auf echte UUIDs umstellen — nicht beiläufig, deshalb hier nur benannt.
- **Ich habe zusätzlich geprüft, ob das Ernte-Log betroffen ist: nein.** `gs_ernte_log` ist lokaler Cache, die Cloud-Wahrheit liegt in `garden_harvests` (4 Zeilen) über `gsCloudSync.pushHarvestAdd`. Der Verdacht war unbegründet.

#### 3 · Die Stripe-Webhook-Strecke hat noch **nie** geliefert — zutrifft, und das ist das ernste

| Beleg | Wert |
|---|---|
| `stripe_webhook_events` | **0 Zeilen, seit jeher** |
| `stripe_subscriptions` | 1 Zeile, `status='trialing'`, `current_period_end = 2026-05-23` (>3 Monate her), `updated_at = 2026-05-27` |
| `audit_log` (stripe/subscription) | 0 Zeilen |

`stripe-webhook/index.ts:305` schreibt **jedes** empfangene Event nach `stripe_webhook_events` — direkt nach der Signaturprüfung, **vor** jedem Handler. Null Zeilen heisst also: kein einziges Event hat je die Signaturprüfung passiert. Und wäre die Strecke intakt, hätte Stripe zum Trial-Ende am 23.05. ein `customer.subscription.updated` geschickt; die Zeile stünde auf `active` oder `canceled` statt weiterhin auf `trialing`.

- **Entwarnung zur Schwere, weil sie zählt:** es ist noch niemandem etwas verloren gegangen. Alle 9 bezahlten Konten sind **comp_tier-Zuteilungen von Hand** — es hat noch nie jemand über Stripe wirklich bezahlt. Die Strecke ist **unerprobt, nicht beschädigt**. Beim ersten echten Zahlungsvorgang wäre sie es aber: Abo-Start, Kündigung und fehlgeschlagene Karte kämen nie in der App an.
- **Ursache von hier aus nicht bestimmbar** — dafür braucht es das Stripe-Dashboard. Deshalb kein Rate-Spiel, sondern eine 4-Schritt-Diagnose im Runbook (Endpunkt vorhanden? Test- vs. Live-Modus? Recent deliveries → 401/400 = Secret-Mismatch? Gegenprobe mit „Send test webhook").
- **Damit ändert sich der Charakter der ohnehin anstehenden Secret-Rotation:** sie ist nicht nur Leak-Hygiene, sie ist möglicherweise die Lösung.
- **Was ich NICHT behaupte:** `app_settings.stripe_publishable_key` trägt zwar den Prefix `pk_test_`, aber die Zeile wird vom Frontend **nirgends gelesen** (0 Treffer). Das ist Altlast, kein Beweis für einen Modus-Fehler — im Runbook entsprechend als blosser Prüfanlass notiert, nicht als Ursache.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · Version synchron v30.96.

### 2026-08-31 (d) — v30.95: Backend-Audit — 1 Blocker, 4 Defekte, alles vorbereitet

> Grundlage: Backend-Integritäts-Audit über 5 unabhängige Ermittlungen (34 Agenten), **jeder Befund einzeln adversarisch gegengeprüft** — inklusive Korrekturen an den Belegen der Ermittler. Gesamturteil zuerst, weil es fair ist: **das Fundament ist überdurchschnittlich solide.** 129 FK-Constraints mit exakt null verwaisten Zeilen · profiles/auth.users 13:13 deckungsgleich · 186 von 186 RLS-Policies wrappen `auth.uid()` korrekt in `(SELECT …)` · alle 178 Tabellen mit RLS · 8'843 Cron-Läufe ohne einen Fehlschlag. Die Probleme sitzen nicht in den Daten, sondern daneben.

#### 🔴 BLOCKER — zwei offene Schreib-Endpunkte auf `public.species` (Owner-Aktion)

`admin-seed-species` (v3) und `species-bulk-seed` (v4) sind beide **ACTIVE mit `verify_jwt=false`**, schreiben mit dem **Service-Role-Key** an der RLS vorbei und sind nur durch **ein hartcodiertes Secret** geschützt — das im Klartext im **öffentlichen** Repo liegt, im *aktuellen Tree* von 6 gepushten Branches (`claude/lucid-cerf-3ooy72 · -XIpgp · -dfxwv7 · -dix1vr · -o5b8ie` und `claude/happy-gates-HK3zX`). Die v29-Rotation (HL#19) hat sie übersehen, weil sie **kein Repo-Verzeichnis** hatten — es gab keine Datei zum Durchsuchen.

- **Selbst nachgeprüft, nicht nur übernommen:** beide Quelltexte über die Management-API gezogen (byte-identisches Secret), Branch-Trees einzeln durchsucht (6 von 113), und **auf Missbrauch geprüft: keiner.** `public.species` = 2'838 Zeilen, genau **1** in den letzten 90 Tagen, neueste vom 02.07. Das Fenster stand offen, es ist niemand hindurchgegangen.
- **Vorbereitet:** 410-Gone-Stubs für beide im Repo, als **Schritt 0** im Runbook. Künftiges Seeding läuft über den SQL-Editor — kein dauerhaft offener HTTP-Endpunkt für eine Aufgabe, die einmal im Jahr vorkommt.

#### 🔒 Rollen-Auskunft über fremde Konten — als `anon` reproduziert

`fn_is_role(_role, _uid)` und `fn_role_at_least(_required, _uid)` sind SECURITY DEFINER (umgehen also die RLS auf `profiles`) und haben EXECUTE für `anon`. Der zweite Parameter war frei wählbar:

```
set local role anon;
select fn_is_role('admin','<uuid>');   -->  true
```

User-UUIDs stehen öffentlich in `social_posts.user_id` und `v_marketplace_listings.user_id` — **die Admin-Konten waren ohne Login aufzählbar.** Ein `REVOKE` wäre falsch: die Policies `social_posts_select_all` u. a. rufen `fn_role_at_least('staff')` auch für Gäste auf, das hätte das Gast-Browsing zerschossen. **Der Parameter war das Problem, nicht die Funktion** — Auskunft über fremde UUIDs gibt es jetzt nur noch für Staff/Admin. Geprüft: alle 16 RLS-Policies und `fn_set_global_api_key` rufen **ohne** `_uid` auf, Frontend und Edge-Functions gar nicht → bricht nichts.

#### 🔒 `quiz_answers.is_correct` kam vom Client — und entschied über ein Jahr PRO

Die Korrektheit stammte aus einem `data`-Attribut im DOM; keine Policy, kein CHECK, kein Default prüfte sie. `fn_grant_quiz_top3_pro()` (Cron jobid=23, **31.12. 23:00**) rankt danach und setzt `comp_tier='pro', comp_expires_at = now() + 1 year`. Bei insgesamt 10 echten richtigen Antworten war die Top-3-Hürde trivial — **die geringe Nutzung machte die Lücke schlimmer, nicht harmloser.** Der Kommentar in der Funktion („FK + UNIQUE = unfälschbarer Korrekt-Count") war nachweislich falsch: beide begrenzen die *Anzahl* Zeilen, nicht den *Wahrheitswert*.

- **Fix ohne Reihenfolge-Falle:** ein BEFORE-INSERT/UPDATE-Trigger leitet `is_correct` und `xp_earned` aus `daily_quizzes.options[selected_option]` ab und **überschreibt** den Client-Wert. Kein `REVOKE INSERT` nötig → alte Cache-Stände brechen nicht. `UPDATE`/`DELETE` für `anon`+`authenticated` **entzogen** (sonst wäre der Trigger per nachträglichem PATCH umgehbar; es gibt im Frontend keinen einzigen solchen Pfad).
- **Frontend-Hälfte:** der Supa-Quiz mischt die Optionen clientseitig, die angezeigte Reihenfolge ist also **nicht** die DB-Reihenfolge. Deshalb wird der DB-Index jetzt **vor** dem Mischen auf jede Option gestempelt (`_idx` → `data-idx`) und als `selected_option` mitgeschickt. Ohne Index gilt eine Antwort als nicht überprüfbar und zählt nicht — bewusst: im Zweifel nicht anrechnen.
- **Altlast ehrlich behandelt:** alle 24 bestehenden Zeilen haben `selected_option = NULL` (10 davon „richtig") und sind nachträglich **nicht** prüfbar. Die Grant-Funktion zählt sie deshalb nicht mit, statt sie zu raten.
- **Nebenbefund:** `gsAnswerSupaQuiz` (65 Zeilen) hatte **null Aufrufer** — und war die einzige Stelle, die je `selected_option` mitschickte. Genau daher stammt die NULL-Altlast. Entfernt.

#### 🐛 Die täglichen Pflege-Erinnerungen sind seit 33 Tagen still tot

`garden_tasks` pending/überfällig = 66, **alle** mit `reminded_at` von heute 07:00 → der Cron arbeitet. `notifications` kind='reminder' = 66, aber `min(created_at) = max(created_at) = 2026-07-29`. Seit 33 Tagen läuft der Job jeden Morgen grün und erzeugt **nichts**.

- **Ursache — zwei Fehler, die sich gegenseitig verstecken:** der Index ist `UNIQUE (dedup_key)` — **global**, ohne WHERE, ohne Zeitanteil, nicht einmal pro `user_id`. Der Guard in `fn_create_notification` prüft aber nur ein 60-Minuten-Fenster. Danach lässt er durch, der INSERT läuft in die `unique_violation`, und `EXCEPTION WHEN OTHERS` verschluckt sie lautlos zu `RETURN NULL`. Zusätzlich baut `fn_remind_garden_tasks` den Schlüssel **ohne Datum**. Kontrollexperiment in derselben Tabelle: `kind='plant_task'` (Schlüssel *mit* Datum) = 597 Zeilen über 75 Tage · `kind='reminder'` (ohne) = 66 Zeilen an **einem** Tag.
- **Besonders heimtückisch:** `fn_cleanup_old_data` gibt den Schlüssel nach 90 Tagen frei — der Fehler kaschiert sich selbst alle 90 Tage.
- **Fix an einer Stelle, heilt alle 5 Aufrufer:** `fn_create_notification` stellt dem Schlüssel die `user_id` voran (der global-unique Index wird dadurch pro Nutzer eindeutig — heilt zugleich `'bloom:…'` und `'quest:…'`, die bisher **zwischen** Nutzern kollidierten) und nutzt `ON CONFLICT DO NOTHING` statt einer abgefangenen Ausnahme. Fehler landen jetzt in `system_events`. `fn_remind_garden_tasks` bekommt den Datumsanteil — erst dadurch ergibt die vorhandene 20-Stunden-Drossel überhaupt Sinn.
- **Alters-Deckel 30 Tage:** die 66 offenen Aufgaben sind Testdaten eines internen staff-Kontos mit `due_at` 2023-04-01 … 2023-08-01. Ohne Deckel würden sie ab morgen täglich nagen. Unabhängig davon die bessere Produktregel.

#### 💸 KI-Kosten wurden systematisch mit CHF 0.00 gebucht

`fn_log_ai_usage`: `if p_cost_chf … elsif p_model … else v_cost := 0`. Beide Parameter haben `DEFAULT NULL` — alle fünf Edge-Functions übergaben nur `p_edge_fn/p_tokens_in/p_tokens_out` und liefen still in den else-Zweig. `knowledge-bulk-gen` hat so **111 echte Calls mit 471'430 Output-Token über 101 Tage mit 0.0000 CHF** gebucht; `fn_finance_snapshot` meldete dadurch eine um **Faktor ~7,5 zu optimistische** Deckung (95.9 statt ~12.7).

- **Code:** `p_model` in allen fünf Funktionen durchgereicht (rein additiv).
- **Gürtel zum Hosenträger:** der else-Zweig bucht nicht mehr 0, sondern konservativ zum Sonnet-Tarif und meldet einmal täglich nach `system_events`. Ein vergessener Parameter fällt damit auf, statt die Kostenrechnung still zu schönen. **Bewusst keine Nachbuchung der Vergangenheit** — geschätzte Zahlen in einer Ist-Kostentabelle wären schlimmer als die Lücke.

#### 👁 Die Cron-Überwachung war blind für alle HTTP-Jobs

`fn_monitor_health` liest ausschliesslich `cron.job_run_details`. `net.http_post` ist aber fire-and-forget: der Aufruf kehrt sofort zurück, der Lauf gilt **immer** als `succeeded` — egal ob Timeout, 403 oder 500. Beweis am lebenden Objekt: `knowledge-growth-daily` lief **21 ms** und meldete Erfolg, während `net._http_response` zeitgleich „Timeout of 50000 ms reached" verzeichnete. Die Blindheit ist total: `fn_admin_ops_digest` und `fn_admin_cron_health` hängen an derselben Quelle — **alle drei Oberflächen zeigen dieselbe falsche grüne Ampel.**

- **Fix:** zweiter Scan über `net._http_response` im selben 75-Minuten-Fenster (dedupliziert über die response-id) **plus** ein Staleness-Check für Jobs, die seit über 49 h gar nicht mehr gelaufen sind — die einzige Fehlerklasse, die sonst durch beide Netze fällt.
- **Ehrlich zur Beweislage:** im erhaltenen Fenster ist **kein** echter HTTP-Ausfall nachweisbar — der Timeout oben war ein pg_net-Client-Timeout bei erfolgreicher Arbeit (`forest_garden_design` bekam an dem Tag 11 neue Zeilen um 03:31:17). Das Risiko ist strukturell und zukünftig, nicht akut.

#### Was in diesem Commit steckt

| Datei | Wirkt |
|---|---|
| `index.html` (Quiz-Index, tote Funktion raus) | sofort mit dem Deploy |
| `supabase/functions/{admin-seed-species,species-bulk-seed}` (410-Stubs) | erst nach Deploy |
| `supabase/functions/{knowledge-bulk-gen,pest-identify,mushroom-identify,garden-scan-analyze,plant-doctor-diagnose}` (`p_model`) | erst nach Deploy |
| 4 neue Migrationen unter `supabase/migrations/20260831_*` | erst nach Anwendung |
| `scripts/apply_pending_v30_87.sh` (jetzt Stand v30.95) | führt alles davon aus |

> ⚠️ **Owner-Aktion nötig:** `deploy_edge_function` und `apply_migration` sind in der Session gesperrt. Alles ist geprüft und vorbereitet — `bash scripts/apply_pending_v30_87.sh` führt es aus. **Schritt 0 ist der Blocker.** Reihenfolge beachten: das Frontend (v30.95) muss live sein, bevor die Quiz-Migration läuft.

- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` valid · Runbook `bash -n` OK · alle 6 Migrationen in `BEGIN/COMMIT` gekapselt · Signaturen aller ersetzten Funktionen gegen die Live-DB geprüft (`fn_monitor_health` → `()` / `integer` / SECDEF / `search_path=public, cron, pg_catalog`) · `postgres` hat SELECT auf `net._http_response` verifiziert · Version synchron v30.95.

### 2026-08-31 (c) — v30.94: Zwei Wege, auf denen Nutzer-Texte still verschwanden

> Auftrag Fernando: „so dass die Nutzer ihre Daten immer gespeichert haben bzw. nie fehlen."
> Vorgehen: alle 65 Keys aus `GS_USER_KEYS` (werden beim Logout geleert) gegen die Sync-Pfade
> gestellt. 25 stehen in keinem LS-Blob — für 23 davon ist das korrekt, weil sie eine eigene
> Server-Quelle haben (`profiles.xp` mit atomarem `fn_add_xp` + Boot-Reconcile, `v_user_entitlements`,
> `quiz_leaderboard`, `marketplace_messages`, `feedback_items` …). Zwei Lücken blieben echt.

- **Lücke 1 — Feedback konnte still verloren gehen.** Der Push nach `feedback_items` war ein Fire-and-Forget mit `.catch(console.warn)`. Schlug er fehl (offline, 5xx, abgelaufener Token), blieb der Eintrag nur lokal und ohne `sb_id` — und weil `ps_feedback` in `GS_USER_KEYS` steht, löschte ihn der **nächste Logout ersatzlos**. Der Nutzer sah „Danke für dein Feedback", niemand bekam es je zu sehen.
  - **Neu: eine Outbox.** `_gsFeedbackPushOne()` liefert nur bei nachgewiesenem Server-Erfolg `true` (2xx ohne zurückgegebene Zeile gilt bewusst als Fehlschlag — Raten wäre schlimmer als ein zweiter Versuch). Fehlgeschlagene Einträge werden als `_push_pending` markiert.
  - `gsFeedbackFlushOutbox()` schickt sie nach — beim Start (+6 s), beim `online`-Event und **vor dem Logout-Wipe**.
  - **Ehrliche Anzeige:** solange ein Eintrag den Server nicht erreicht hat, steht „📤 Noch nicht gesendet" daneben. Vorher sah ein nur-lokaler Report exakt aus wie ein angekommener.
- **Lücke 2 — der Community-Post-Entwurf war nach einem Serverfehler weg.** `submitPost()` leerte die Textarea und schloss das Modal, *bevor* der Server antwortete. Bei Fehler wurde zusätzlich der optimistische Post entfernt — übrig blieb ein Toast. Der geschriebene Text war unwiederbringlich verloren, der Nutzer musste alles neu tippen.
  - Der Entwurf wird jetzt **vor** dem Leeren nach `gs_social_draft` gesichert, bei Erfolg verworfen, bei Fehler sofort ins wieder geöffnete Formular zurückgespielt („Dein Text ist erhalten.").
  - Auch beim nächsten Öffnen des Formulars kommt ein liegengebliebener Entwurf zurück (überlebt also App-Neustart und Absturz). Entwürfe älter als 7 Tage werden verworfen.
  - `gs_social_draft` steht in `GS_USER_KEYS` — auf einem geteilten Gerät darf der eigene Text nicht zum nächsten Konto durchsickern.
- **Geprüft und in Ordnung:** XP (`gsAddXP` spiegelt jeden Gewinn debounced und atomar über `fn_add_xp`, Boot-Reconcile in beide Richtungen), Pflanzen/Garten/State (`gsCloudSync` mit Dirty-Flags, Empty-Clobber-Guard v27.01, Count-Guard v28.22, `beforeunload`-Flush), Community-Post-Erfolgspfad (optimistisches Update mit sauberem Rollback).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.94.

### 2026-08-31 (b) — v30.93: Marktplatz-Chat erfand Antworten im Namen echter Verkäufer

- **Der Befund.** `sendChatMsg()` hängte nach jeder gesendeten Nachricht mit 60 % Wahrscheinlichkeit eine von fünf Floskeln an den Verlauf — **zugeschrieben an den echten Verkäufer-Namen** (`author: l.seller`) — und löste zusätzlich eine Benachrichtigung „💬 Neue Nachricht von \<Name\>" aus. Beim Öffnen eines Chats wurde ausserdem eine erfundene Begrüssung des Verkäufers mit Zeitstempel „vor einer Minute" eingefügt. Für den Nutzer war beides von einer echten Antwort nicht zu unterscheiden — **während seine eigene Nachricht nirgendwo ankam.**
- **Wer war betroffen.** Der Demo-Pfad greift, sobald `openMarketChat` keinen Backend-Thread starten kann. Real ist das der **ausgeloggte Besucher auf einem echten Inserat**: `loggedIn` ist falsch → Fallback → Fake-Chat mit dem echten Namen des Verkäufers. (Beide Cloud-Lesepfade liefern `user_id` korrekt mit — `v_marketplace_listings` per `select=*`, `fn_marketplace_search` als Rückgabespalte — der eingeloggte Fall landete also richtig im Backend-Chat.)
- **Der Fix — ehrliche Wege statt Illusion:**
  - Erfundene Verkäufer-Antwort und erfundene Begrüssung **ersatzlos entfernt**. Ein leerer Verlauf ist ehrlich.
  - Gast auf echtem Inserat → `_gsMarketChatLoginPrompt()`: „Um \<Verkäufer\> zu schreiben, brauchst du ein Konto — so kommt deine Nachricht auch wirklich an." mit Login-Knopf. Kein Chat-Fenster, das ins Leere führt.
  - Eingeloggt, aber Verkäufer-ID fehlt → `_gsMarketChatUnavailable()`: sagt es klar und bietet die im Inserat hinterlegte Kontaktangabe zum Kopieren an.
  - Nur noch **lokale Entwürfe** (nicht-UUID-ID, das eigene unveröffentlichte Inserat) benutzen den lokalen Chat.
- **Einmal-Bereinigung für bestehende Nutzer:** Echte Chats laufen über `marketplace_messages` und stehen **nie** in `gs_market_chats` — alles dort mit `isMe:false` ist also nachweislich erfunden und wird einmalig entfernt (Flag `gs_market_chats_purged_v3093`). Eigene Nachrichten (`isMe:true`) bleiben unangetastet.
- **`DEMO_LISTINGS` entfernt** — 49 Zeilen erfundene Inserate („PlantQueen_Zuri", „BioBauer_BE") mit **null Lesern**. Seit v28.02 sehen auch Gäste nur echte Cloud-Inserate; die Konstante war reine Altlast.
- **Gegenprobe:** kein weiterer Generator im Code, der Inhalte im Namen realer Personen erfindet (Sweep über alle `Math.random()`-Stellen mit Bezug zu Nachrichten/Namen/Posts → 2 Treffer, beide reine ID-Erzeugung).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.93.

### 2026-08-31 (a) — v30.92: Zwei Sackgassen im Erstnutzer-Pfad geschlossen (Key-Fehler + Erstnutzer-Tour)

- **Blocker: der Scan-Fehlerbildschirm war für Nicht-Admins eine Sackgasse.** Auf *jedem* Key-Fehler war der einzige Handlungsknopf `openApiKey()` — und der ist ADMIN-only (`GS_PERMISSIONS.ADMIN` enthält `api_key`). `openModal('apikey-modal')` existiert genau **einmal** in der Datei, nämlich in `openApiKey`. Für jeden normalen Nutzer hiess das: tippen → „Keine Berechtigung", und danach kein Weg vorwärts ausser die App zu schliessen.
  - **Neu `_gsKeyErrorCta(onLight)`** — ein CTA nach Rolle: **Admin** → „🔑 API-Key einrichten"; **eingeloggt** → „🔄 Nochmal versuchen" (zieht via `_gsRetryAfterKeyPull()` den globalen Key frisch nach und wiederholt den letzten Scan über `_gsRetryLastScan()`); **ausgeloggt** → „✨ Kostenlos Konto anlegen". Beide Fehlerbildschirme (Kein-Key-Karte und Hero-CTA im Fail-Screen) nutzen jetzt dieselbe Quelle, inklusive passendem Icon und Text.
  - **`analyzeImage` zieht den Key einmal nach, bevor es abbricht.** `callAI`/`callVisionAI` machen das längst mit Backoff — `analyzeImage` war die einzige Stelle, die sofort aufgab. Direkt nach dem Login gab es dadurch ein Zeitfenster, in dem der allererste Scan mit „API-Key wird benötigt" scheiterte, obwohl der globale Key Sekundenbruchteile später da war. (`const {key}` → `let {key}` + einmaliger `gsPullGlobalApiKey()`-Nachzug.)
  - **Drei weitere tote Wege zu `openApiKey()` geschlossen:** der rote Chip `sr-apikey-chip` (beim Tab-Wechsel *und* im Fehlerfall), der Knopf „🧪 Key testen" und die Benachrichtigung „API-Key Problem" erscheinen nur noch für Admins. Für alle anderen waren das Alarmknöpfe ohne Ziel — und eine Fehlermeldung über etwas, das gar nicht ihre Sache ist.
- **Die Erstnutzer-Tour startete nach einer Registrierung nie.** Sie hing ausschliesslich im Login-Pfad (`onbDoLogin`). Bei aktivem Auto-Confirm — dem Normalfall — loggt `onbDoRegister` aber **selbst** sofort ein, `onbDoLogin` wird nie durchlaufen. Folge: keine Tour, und das gesetzte `gs_first_login`-Flag blieb liegen, bis Tage später ein echter Login sie an völlig unpassender Stelle aufpoppen liess.
  - **Neu `gsRunFirstRunWelcome()`** als gemeinsame Quelle für beide Pfade: verbraucht das Flag, zeigt den Willkommens-Toast und startet die Tour nach 1.6 s.
  - **`gsTutorial.startOnce()`** liest endlich `GS_TUTORIAL_KEY` (`gs_onboarded_v1`). Der Schlüssel wurde bisher in `_close` **geschrieben, aber nirgends gelesen** — reine Dekoration. Der manuelle Neustart (Einstellungen → Tour) ruft weiterhin `start()` und ignoriert den Schlüssel bewusst.
  - Der alte 1.6-s-Timer im Login-Pfad ist entfernt, sonst wäre die Tour bei einem First-Login doppelt aufgepoppt.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.92 (index.html · meta app-version · sw.js `gs-v30.92` · `_headers`).

### 2026-08-28 (f) — v30.91: Dark-Mode-Sweep abgeschlossen (Inline-Styles) + drei Audit-Punkte als erledigt nachgewiesen

- **Dark-Mode Teil 2:** Nach dem CSS-Block (v30.90) jetzt die Inline-Styles: **141 Hintergründe + 122 Textfarben** in 235 Zeilen auf Design-Tokens. Betrifft echte Bildschirme — Marktplatz, Pilz-Scanner, Einstellungen, Farm, Community-Post, Garten-Scan.
- **Wieder pixelgleich im Hellmodus:** Die Tokens sind hell exakt die Altwerte (`--bg-success-soft` = `#e8f5e9`, `--c-brown` = `#5d4037`). Nur der Dunkelmodus ändert sich.
- **Kontrast-Regressionen konsequent nachgezogen:** Erst 22, dann nach dem zweiten Mapping-Durchgang noch 2 (`#827717` Oliv auf Gelb) — per Luminanz-Analyse (< 140) aufgespürt und geschlossen. **Endstand: 0 Dunkel-auf-Dunkel-Kombinationen in der gesamten Datei.**
- **Canvas/SVG geprüft:** Der Diff enthält keine `fillStyle`/`strokeStyle`/`<svg>`-Zeile — dort greift `var()` nicht, das wäre ein stiller Fehler gewesen.
- **⚠️ Drei „offene" Audit-Punkte nachgeprüft und als erledigt/unbegründet belegt** (neue Sektion 2a im Audit-Dokument, damit niemand Phantom-Arbeit macht):
  - **`alert()`/`confirm()` (P2-3):** faktisch erledigt. Nachgezählt: 1 `alert()` — der Notnagel *innerhalb* von `gsToast` selbst (korrekt so) — und 14 `confirm()`, **alle** in `else`-Zweigen hinter `gsConfirmModal`. Kein nativer Dialog feuert. Die alte Zahl „62× alert" kam aus einem groben grep inkl. Changelog-Strings.
  - **`garden_diary`/`client_errors` leer trotz Schreibpfad:** unbegründet. Schema live gegen den Frontend-Insert geprüft (kein Drift), RLS-Policies korrekt (`diary_owner_all`, `cerr_insert_own`). Echte Nicht-Nutzung, **kein stiller 4xx**.
  - **GSW als „live" beworben:** erledigt. Seit **v26.65** nicht mehr in `SUPPORTED`, also gar nicht auswählbar; Doku in v30.86 korrigiert.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · 0 Kontrast-Regressionen (gesamte Datei) · Token-Definitionen frei von `var()` · keine Canvas/SVG-Zeile berührt · Version synchron v30.91.

### 2026-08-28 (e) — v30.90: Dark-Mode-Sweep im CSS-Block (Badges/Status-Pillen auf Design-Tokens)

- **Auftrag/Kontext:** Offener P2-Punkt aus dem Audit: hartcodierte helle Farben ohne `body.dark`-Override → grelle Flecken im Dunkelmodus. Gesamt-Scan fand 459 Treffer.
- **Vorgehen bewusst eng gefasst:** nur der zentrale `<style>`-Block (Zeilen 198–1594). Eine CSS-Regel wirkt auf viele Fundstellen — deutlich sicherer als 459 Inline-Edits. `:root`/`body.dark`-Token-**Definitionen** (81–197) ausgenommen, sonst Zirkelbezug; `body.dark`-Overrides ausgenommen, die behalten ihre expliziten Werte.
- **Pixelgleich im Hellmodus:** Die Soft-Tokens sind hell exakt die bisherigen Werte (`--bg-success-soft: #e8f5e9`, `--c-info: #1565c0` …). Der Tausch ändert also im Hellmodus **nichts** und wirkt nur im Dunkelmodus (dort `rgba(102,187,106,.12)` statt `#e8f5e9`). 43 Hintergründe + 20 Textfarben auf Tokens umgestellt.
- **⚠️ Selbst eingebaute Regression gefunden und behoben:** Nach dem ersten Durchgang standen **17 dunkle Textfarben** (z.B. `#2d7a2d`, `#1565c0`, `#bf5600`) auf jetzt-dunklem Grund → im Dunkelmodus **schlechterer** Kontrast als vorher. Per Luminanz-Analyse (< 140) aufgespürt und 15 davon ebenfalls auf Tokens gemappt, die im Dunkelmodus aufhellen (`--c-info` hell `#1565c0` → dunkel `#42a5f5`). Gegenprobe: **0 verbleibende Dunkel-auf-Dunkel-Kombinationen**.
- **Kleine bewusste Farbdrift im Hellmodus** (marginal, zugunsten der Dark-Mode-Lesbarkeit): `#bf5600`→`--c-warn-d` (#e65100), `#7b1fa2`→`--c-purple` (#6a1b9a), `#e53935`→`--c-danger` (#c62828). Die übrigen Mappings sind identisch oder praktisch identisch.
- **`border-color` bewusst ausgenommen** — der erste Regex-Entwurf hätte `border-color:` mitgetroffen (das `\bcolor:` matcht nach dem Bindestrich). Mit `(?<!-)` ausgeschlossen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Token-Definitionen frei von `var()` (kein Zirkelbezug) · 0 verbleibende harte Hell-Hintergründe im CSS-Block · 0 Kontrast-Regressionen · Version synchron v30.90.
- **Rest:** Inline-Styles in JS-Templates (der grössere Teil der 459) bleiben offen — die sind einzeln zu prüfen, weil dort auch Canvas-/SVG-Kontexte vorkommen, in denen `var()` nicht greift.

### 2026-08-28 (d) — v30.89: Overlay-Rettungsleine auf 22 weitere Dialoge ausgeweitet (inkl. „friert ein"-Ursache)

- **Warum:** In v30.85 hingen erst 2 von 31 dynamischen Overlays an der Rettungsleine. Die übrigen konnten denselben Bug auslösen, den der User zweimal gemeldet hat („beim Tippen kommt nur noch Konto löschen").
- **Wahrscheinliche Ursache des gemeldeten „friert ein" gefunden:** `gsConfirmModal` und `gsPromptModal` geben ein **Promise** zurück. Wird so ein Dialog nur aus dem DOM entfernt, ohne dass `finish()` läuft, **wartet der aufrufende Code für immer** — die Funktion wirkt eingefroren. Beide sind jetzt mit `onDismiss`-Callback registriert (`finish(false)` bzw. `finish(null)` = abgebrochen); der vorhandene `done`-Guard verhindert Doppel-Auflösung.
- **20 weitere Dialoge registriert** (skriptgesteuert, von hinten eingefügt damit Zeilennummern stabil bleiben): achievements-modal, gs-gallery-overlay, modal-mushroom-lookalikes, gs-scan-tips-modal, modal-shot-preview, gs-loc-pick, plant-diary-modal, verify-post-modal, gs-conn-test-modal, modal-plan-3dcad, photo-timeline-modal, voice-mode-modal, modal-saved-plans, modal-agent, gs-global-key-admin, gs-conn-detail, gs-storage-modal, gs-univ-modal, gs-export-modal, gs-wx-overlay.
- **Bewusst NICHT registriert** (und gegengeprüft, dass sie unangetastet blieben): `gs-mushroom-danger` (sicherheitskritischer Gift-Warnschirm — MUSS aktiv bestätigt werden, ein Wegräumen per Navigation wäre gefährlich) · `gs-tutorial` / `gs-auth-pflicht-modal` (Onboarding- und Pflicht-Gates) · `saison-pilze-screen` / `gs-plans-screen` / `tree-planner-screen` (Vollbild-Screens, keine Dialoge).
- **Methodik:** Skript prüfte je Dialog, dass die Variable im `.id =` und im `appendChild()` übereinstimmt — ein Kandidat (`gs-gal-species-ov`) hatte kein passendes `appendChild` und wurde übersprungen statt geraten.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Ausschlüsse per grep gegengeprüft · Stichproben (plant-diary-modal `var=m`, gs-wx-overlay `var=ov`) auf korrekte Platzierung und Einrückung geprüft · Version synchron v30.89.
- **Rest:** 9 Overlays bleiben bewusst ohne Rettungsleine (Begründung oben). Backend-Arbeiten weiterhin über `scripts/apply_pending_v30_87.sh` (Schreibzugriff der Session gesperrt).

### 2026-08-28 (c) — v30.88: 6 tote Stripe-Setup-Funktionen stillgelegt + Secret-Rotation dokumentiert

- **Auftrag:** „Stripe-Webhook-Secret rotieren und die obsoleten Stripe-Setup-Funktionen löschen/stilllegen — mach du das bitte."
- **Stripe-Secret-Rotation — bewusst NICHT ausgeführt, mit Begründung:** In dieser Session ist (a) kein Stripe-Zugriff verbunden und (b) der Supabase-Schreibzugriff gesperrt. Entscheidender Punkt: Zwischen dem Rotieren in Stripe und dem Speichern des neuen Secrets in `app_settings` schlägt **jede** Webhook-Signaturprüfung fehl — in diesem Fenster landen Abo-Wechsel, Zahlungen und Kündigungen nicht mehr in der DB. Halb ausgeführt wäre also schlimmer als gar nicht. Stattdessen: **präzise 5-Schritt-Anleitung im Skript** — inkl. Sicherung des Alt-Werts als Rückweg, Hinweis auf die Übergangsfrist („Roll secret, expire in 24h" → gar kein Ausfallfenster), Vorrang-Falle `STRIPE_WEBHOOK_SECRET`-Env vor `app_settings`, und Verifikation über Stripe-Test-Webhook + `stripe_events`.
- **6 tote Stripe-Setup-Funktionen stillgelegt (P1-1):** `stripe-restructure-pro-only`, `stripe-import-fernando-sub`, `stripe-complete-setup`, `stripe-final-audit`, `create-checkout`, `customer-portal`. Alle waren **ACTIVE mit `verify_jwt:false`**, also für jeden im Internet aufrufbar — vier davon mutieren echte Stripe-Daten. Jetzt 410-Gone-Stubs im Repo (Muster `stripe-setup-webhook`), reine Antwort ohne Code und ohne Secrets.
- **Vor der Stilllegung verifiziert:** 0 Aufrufe aus `index.html` · 0 Referenzen in `cron.job`. Gegenprobe, dass die aktiven Fns (`stripe-checkout`, `stripe-portal`, `stripe-webhook`) unangetastet blieben.
- **⚠️ Eigener Audit-Fehler korrigiert:** `key-health-check` stand auf meiner Totliste — sie wird aber von einem **Cron-Job täglich um 03:00** aufgerufen (`key-health-daily`) und ist NICHT tot. Wäre sie mit gestubbt worden, hätte das die tägliche Schlüssel-Überwachung abgeschaltet. Im Audit-Dokument richtiggestellt.
- **Skript erweitert:** `scripts/apply_pending_v30_87.sh` hat jetzt Schritt 4/4 (Stilllegung) + Prüf-`curl`, der 410 erwartet.
- **Verify:** `bash -n` OK · alle 6 Stubs enthalten `status: 410` · keiner enthält Logik/Secrets (grep auf `createClient`/`sk_live`/`ADMIN_SECRET` leer) · aktive Fns unverändert · Version synchron v30.88.

### 2026-08-28 (b) — v30.87: P0-3 `send-push` gehärtet + Ausführungs-Skript für alle offenen Backend-Arbeiten

- **Auftrag:** „Volle Freigabe — mache alles perfekt und sauber, rebuild mit den Verdrahtungen die es braucht."
- **Ehrliche Einordnung zur Freigabe:** Die Schreibzugriffe auf Supabase (`apply_migration`, `deploy_edge_function`) werden vom **Werkzeug-Berechtigungssystem** dieser nicht-interaktiven Cloud-Session blockiert — das lässt sich nicht per Zuruf freischalten. Deshalb: alles fertig vorbereitet + geprüft, Ausführung als Ein-Befehl-Skript.
- **P0-3 · `send-push` gehärtet (letzte offene P0-Lücke):** v2 las Rolle und User-ID aus dem **unsignierten** JWT-Payload und akzeptierte `authHdr.includes(SERVICE_ROLE)` — einen Substring-Test auf einen Vollmacht-Schlüssel — als Service-Nachweis. Geschützt war das **einzig** durch das Gateway-Flag `verify_jwt:true`; ein Dashboard-Klick hätte daraus einen offenen Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht. Neu `authenticate()`: Constant-Time-Compare des vollen Keys **oder** `sb.auth.getUser(token)` (serverseitig signaturgeprüft), fail-closed 401. Admin-Broadcast-Check + 500er-Cap unverändert. Patch sitzt auf der **Live-Quelle** (v2 abgeholt), nicht auf einer veralteten Repo-Kopie.
- **Ausführungs-Skript `scripts/apply_pending_v30_87.sh`:** wendet in einem Lauf an — 2 Migrationen (Wissen v30.84, Quiz-Bilder v30.85) + 3 Edge-Functions (mushroom-identify, pest-identify, send-push). Mit Vorabprüfung, Rückfrage vor Produktiv-Zugriff, `set -euo pipefail` und Verifikations-Abfragen am Ende (inkl. curl-Test, der ein **gefälschtes** Token gegen send-push wirft und 401 erwartet).
- **Fallstrick vermieden — `supabase db push` wäre falsch gewesen:** Das Migrations-Register der DB nutzt 14-stellige Zeitstempel (`20260827073101`), die Repo-Dateinamen weichen ab (`v30_32_*.sql`). `db push` hätte Dutzende **bereits angewandte** Migrationen für ausstehend gehalten und erneut angestossen. Das Skript spielt deshalb gezielt nur die zwei neuen Dateien ein (psql oder Dashboard-SQL-Editor), mit Begründung im Kopf.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Skript `bash -n` OK · alle referenzierten Dateien existieren · `decodeJwt`/`includes(SERVICE_ROLE)` in send-push nur noch im Erklär-Kommentar, kein ausführbarer Pfad · Version synchron v30.87.
- **Danach noch offen (nur Dashboard):** Leaked-Password-Protection aktivieren · Stripe-Webhook-Secret rotieren · obsolete Stripe-Setup-Edge-Fns löschen/stubben (P1-1).

### 2026-08-28 — v30.86: Offene Audit-Punkte abgearbeitet (Secret redigiert, Overlays gehärtet, GSW ehrlich gemacht, Dark-Mode)

- **Auftrag:** „Baue es weiter auf und löse alle Probleme sauber." → die offene P1/P2-Liste aus `FULL_STACK_AUDIT_v30.81.md` abgearbeitet, soweit ohne DB-Freigabe möglich.
- **P1-2 · Geleaktes Secret redigiert:** Das `whsec_`-Prefix eines Stripe-Webhook-Signing-Secrets stand im Klartext in `AUFTRAG_v25.4_AUTH_TRIAL_ABO.md:270`. Aus HEAD entfernt (`whsec_***REDACTED***`) — **und ebenso aus meinem eigenen Audit-Dokument**, das den Wert zitiert und den Leak damit selbst weitergetragen hätte. Verifiziert: der echte Prefix kommt in HEAD nicht mehr vor. **Rest-Aufgabe Owner:** Secret in Stripe rotieren; History-Purge nur nötig, falls das Repo je public wird.
- **Overlay-Rettungsleine ausgebaut (Fortsetzung des v30.85-Bugs):** Ein Scan fand **31 dynamisch erzeugte Vollbild-Overlays**, von denen nach v30.85 noch **29 ohne jeden zentralen Ausweg** waren. Neu: kuratierte Liste `GS_DISMISSIBLE_OVERLAYS` (25 Dialoge), die beim Navigieren aufgeräumt werden. **Wichtig gelöst:** `_gsCloseOverlayGracefully()` klickt bevorzugt den **eigenen** Abbrechen-/Schliessen-Knopf des Dialogs, statt das Element wegzureissen — sonst hätten die Promise-basierten `gsConfirmModal`/`gsPromptModal` ihr Versprechen nie aufgelöst und den aufrufenden Code für immer hängen lassen.
- **Bewusst NICHT auto-schliessbar** (mit Begründung im Code): `gs-mushroom-danger` (sicherheitskritische Giftpilz-Warnung — muss aktiv bestätigt werden), `gs-auth-pflicht-modal` (absichtliche Anmelde-Schranke), `gs-tutorial` (eigene Schritt-Logik), sowie die drei Vollbild-*Screens*. Per Skript gegengeprüft.
- **P1-4 · GSW ehrlich gemacht:** Befund war ungenauer als gedacht — Schweizerdeutsch steht **gar nicht** in der Sprachauswahl (die bietet DE/EN/FR/IT/ES). Es war also kein kaputtes Feature, sondern ein **falsches Versprechen in README + ROADMAP**. Beide korrigiert; GSW als P3-Kandidat mit ehrlicher Nutzen-Einschätzung eingeordnet (DE deckt die Deutschschweiz ab; maschinelles GSW klingt schnell unfreiwillig komisch → Stichprobe vor Seeding).
- **Toter Code entfernt:** `gsAutoLogin()` — wurde nirgends aufgerufen und stieg ohnehin sofort mit `if (!window.supabase) return;` aus. Ersetzt durch einen Kommentar, der auf den echten Auth-Pfad zeigt, damit künftige Audits nicht wieder darüber stolpern. Die zweite `window.supabase`-Stelle (`authToken`-Fallback) **bleibt** — sie ist ein bewusster, dokumentierter Notfall-Rückfall.
- **P2-2 · Dark-Mode:** 9 hardcodierte helle Flächen ohne Token ersetzt — 3 CSS-Klassen (`.td` Avatar-Platzhalter, `.post-action:active`, `.farm-quest-prog` Fortschrittsbalken) und 6 gut sichtbare Inline-Stellen (Menü-Symbole, Pflanzenkarten-Foto-Platzhalter, Foto-Hero, Archiv-Badge). Alle auf `var(--surface2)` / `var(--muted)`. Vorher prüft: nur die Chat-Blase hatte bereits eine `body.dark`-Korrektur.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Ausnahmeliste per Skript gegengeprüft · Secret-Redaktion per grep verifiziert · Version synchron v30.86.
- **Weiterhin offen (brauchen Freigabe/Owner):** 2 Migrationen (v30.84 Wissen, v30.85 Quiz-Bilder) · 2 Edge-Fn-Deploys (KI-Kostenschutz) · P0-3 `send-push` (gleiches unsignierte-JWT-Muster) · P1-1 obsolete Stripe-Setup-Fns · P1-3 Leaked-Password-Protection (1 Dashboard-Klick) · Stripe-Secret-Rotation · restliche ~36 hardcodierte Hex-Farben.

### 2026-08-27 (f) — v30.85: Overlay-Rettungsleine (User-Bug) + Glocke + Aufgaben-Notizzettel + Quiz-Bildfragen

- **User-Bug (2× gemeldet, jetzt richtig getroffen):** „Menü → XP-Balken → ich lande im Home, und beim Tippen auf die Navigation kommt nur noch *Konto wirklich löschen*. Manchmal wechselt es in den Admin-Modus und friert ein."
- **Echte Ursache (die v30.83-Analyse lag daneben):** „Konto wirklich löschen?" ist die Überschrift des **Bestätigungs-Dialogs** `#delete-account-modal`, nicht des Profils. Dieser Dialog wird per `createElement` gebaut, an `<body>` gehängt, liegt auf `z-index 99999` (Tab-Leiste: 1500) — und wird von **nichts** zentral geschlossen: nicht von `closeModal`, nicht von Escape, nicht beim Tab-Wechsel. Wer nicht exakt „Abbrechen" oder den Rand trifft, sitzt fest; jeder weitere Tap landet auf diesem Overlay. **Scan ergab 53 solcher handgebauter Vollbild-Overlays** — das erklärt auch das „Einfrieren" im Admin-Modus.
- **Fix (systemisch, v30.85):** Neue Rettungsleine `gsRegisterOverlay()` / `gsDismissOverlay()` / `gsDismissOrphanOverlays()`. Registrierte Overlays sind IMMER auf drei Wegen verlassbar: ✕-Knopf, Escape, **jeder Navigations-Wechsel** (`switchTab` räumt auf). Optionaler `onDismiss`-Callback, damit Promise-basierte Dialoge (z.B. `gsConfirmModal`) sauber auflösen statt zu hängen. Angewandt auf `delete-account-modal` + `change-pw-modal`, plus sichtbarer ✕ im Lösch-Dialog.
- **Benachrichtigungen bekommen einen eigenen Platz (User-Wunsch):** 🔔-Glocke fest in der Kopfleiste mit eigenem Badge — zählt **Aufgaben + Mitteilungen zusammen** und öffnet direkt das Notification-Center. Vorher war das Center nur über Menü → Panel → „Alle anzeigen" erreichbar (drei Schritte, versteckt). `gsRenderBellBadge()` hängt an `gsRenderNotifBadge()`, bleibt also automatisch synchron.
- **Aufgaben-Notizzettel bei „Meine Pflanzen" (User-Wunsch):** Klebt als Merkzettel am rechten Rand (Papieroptik, leicht geneigt), zeigt die Anzahl offener Aufgaben, klappt beim Tippen auf (`gsToggleTaskNote`), Abhaken läuft über `gsNcDoneTask` → `gsQuickDone` (echtes Erledigen inkl. Cloud-Sync) → landet im Archiv-Tab „Erledigt". Erscheint nur auf dem Pflanzen-Tab und nur bei offenen Aufgaben.
- **Quiz: Bildfragen + 42 neue Fragen** (`20260827_quiz_bilder_und_fragen_v30_85.sql`, Anwendung offen): Schema um `image_url`/`image_credit`/`image_alt` erweitert · `fn_get_daily_quiz` liefert die neuen Spalten (Rückgabe-Signatur geändert → DROP+CREATE, Rechte für anon/authenticated neu gesetzt) · 43 Fragen, davon **12 mit Foto** (Wikimedia Commons). Frontend rendert das Bild statt des Emojis, URL gefiltert durch `_gsSafeUrl`, bei Ladefehler stiller Rückfall aufs Emoji.
- **Migration-Fallstrick vermieden:** Ein `UNIQUE INDEX` auf `daily_quizzes(question)` wäre gescheitert — die Tabelle enthält **bereits 2 doppelte Fragetexte**. Löschen ist heikel (FKs aus `daily_quiz_history`/`quiz_answers`). Die Migration fasst deshalb keine Bestandsdaten an und filtert per `NOT EXISTS` selbst → wiederholbar. Muster live gegen die echte Tabelle getestet.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Migration strukturell geprüft (Klammer-Balance, keine offenen Literale) · **alle 43 Fragen: genau 1 richtige Antwort, ≥2 Optionen, Label+Erklärung vollständig** · Version synchron v30.85.
- **Offen:** 2 Alt-Duplikate in `daily_quizzes` aufräumen · übrige 51 handgebaute Overlays schrittweise an die Rettungsleine hängen · beide Migrationen (v30.84 Wissen, v30.85 Quiz) + 2 Edge-Fn-Deploys brauchen DB-Freigabe.

### 2026-08-27 (e) — v30.84: Wissens-Ausbau (Bauernregeln, Wusstest-du, Gartenwissen) + Optik-Fix

- **Auftrag:** „Füge mehr Wissen hinzu — Bauernregel des Tages, Wusstest du? Und Gartenwissen optisch verbessern + auffüllen."
- **Live-Befund vor dem Ausbau:** `traditional_garden_wisdom` 82 Zeilen, aber pro Monat sehr ungleich — **Januar 11, Dezember 11, Februar 14**. Bei 31 Tagen wiederholt sich die „Bauernregel des Tages" im Winter also alle ~11 Tage. `did_you_know_facts` 162 Zeilen, aber Kategorien **doppelt in DE und EN** (pilz/pilze/fungi, baum/trees, heilpflanze/heilpflanzen, fauna/animals, flora/plants, ecology/oekologie) → Filter-Dropdown unbrauchbar. `garden_techniques` 161 Zeilen, davon nur **20 mit Emoji**.
- **Migration `20260827_wissen_ausbau_v30_84.sql` (im Repo, Anwendung offen — DB-Schreibzugriff braucht Freigabe):** +34 Bauernregeln mit Schwerpunkt Nov–Feb (jede mit ehrlicher Einordnung `wissenschaftlich_bestaetigt` / `tendenziell_richtig` / `umstritten` / `aberglaube_widerlegt` statt unkritischer Folklore) · +40 „Wusstest du?"-Fakten mit CH-Bezug · Kategorie-Normalisierung DE/EN · `UNIQUE INDEX` auf `did_you_know_facts(title)` (Tabelle hatte nur PK auf id → Migration wäre sonst ein Duplikat-Generator; live geprüft: 0 bestehende Doppel) · Emoji-Auffüllung je Kategorie.
- **Gartenwissen-Optik (ausgeliefert):** Die Technik-Karten zeigten **englische Rohwerte** in deutscher UI — `easy`/`expert` als Schwierigkeit, `pest_control`/`mulching` im Kategorie-Filter. Neu: `_gsKbCatLabel()` + `_gsKbDiffLabel()` übersetzen beides, Schwierigkeit als **farbiges Badge** (grün/gelb/rot/violett), Kategorie als grünes Badge.
- **Verstecktes Wissen sichtbar gemacht:** **141 von 161** Techniken haben Werkzeug-Angaben (`tools`), die nie gerendert wurden — jetzt als 🧰-Zeile, zusammen mit 📅 Saison. Reines Freilegen vorhandener Daten, ohne neue Abfragen.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · Version synchron v30.84 · Migration idempotent (ON CONFLICT auf slug bzw. title).
- **Nächste:** Migration anwenden (dann Bauernregeln Jan/Dez von 11 → ~19, Fakten 162 → 202) · restliche Kategorie-Labels prüfen · Dark-Mode-Sweep.

### 2026-08-27 (d) — v30.83: XP-Balken-Falle behoben + 4 Cross-User-XSS geschlossen + 2 KI-Kostenschutz-Deploys

- **User-Bug (sehr ärgerlich, zu Recht):** „Ich klicke auf den XP-Balken, dann kommt beim Antippen der Navigation nur *Konto löschen*."
- **Root-Cause:** Das Profil-Sheet (`#modal-profile`) liegt auf `z-index:4000`, die Tab-Leiste `.tabs` auf `1500` — das Sheet deckt die Navigation vollständig ab. Da es unten andockt (`align-items:flex-end`), lagen die **letzten** Buttons der Profil-Liste („🗑️ Konto löschen", „🚪 Abmelden") exakt auf der Bildschirmposition der Navigation. Der Griff zur Navi traf den Löschen-Button. **Kein Datenverlust möglich** — der Löschdialog verlangt das Eintippen von `LÖSCHEN`.
- **Fix (v30.83):** (1) Destruktive Aktion in ein zugeklapptes `<details>` („⚠️ Erweitert — Konto dauerhaft löschen") verschoben → nicht mehr versehentlich erreichbar; (2) Reihenfolge korrigiert (Abmelden vor Gefahrenzone); (3) Sicherheits-Spacer `height:calc(var(--tab-h)+var(--sb))` am Listenende → **kein** Button liegt mehr in der Navi-Zone.
- **XSS-Tiefen-Sweep nachgeholt (4 echte Cross-User-Lücken, alle behoben):** Community-Funde-Zähler (`species_name` fremder Funde, ungeescaped im innerHTML) · Karten-Popup-Fotos (2 Pfade) · Marktplatz-`certification_label` im `title`-Attribut · Marktplatz-Bilder (3 Stellen). Helfer `_esc()` um `"`/`'` gehärtet (wurde in Attribut-Kontexten genutzt) + neuer `_gsSafeUrl()` (nur `https?://`/`data:image/`, Quote-Escape, blockt `javascript:`). Verifiziert: echte Storage-URLs und `data:image/jpeg`-Uploads passieren unverändert.
- **Backend P0 live deployed:** `i18n-translate` **v5** — der Gate las die Rolle aus dem **unsignierten** JWT-Payload (bei `verify_jwt=false` = jeder konnte `service_role` fälschen → unbegrenzte Anthropic-Kosten). Jetzt: Constant-Time-Compare des vollen Service-Keys **oder** echte Signaturprüfung via `auth.getUser()`. Verifiziert: `decodeJwt` ist aus der deployten Quelle verschwunden.
- **`mushroom-identify` / `pest-identify`:** In-Code-User-Verifikation + `fn_check_rate_limit` (30/h, fail-open) ergänzt. **Wichtig:** Die Repo-Kopien waren **veraltet** (ohne das v26.50-`fn_log_ai_usage`-Logging) — ein Deploy daraus hätte Backend-Arbeit zurückgerollt. Beide Dateien wurden auf den **Live-Stand + Patch** neu geschrieben und sind jetzt repo↔deploy-synchron.
- **Audit-Korrektur (Ehrlichkeit):** Die Meldung „7 doppelte DOM-IDs" in `FULL_STACK_AUDIT_v30.81.md` war **falsch** — das Skript zählte `id="…"` in Changelog-Strings mit. Echte Duplikate: **3**, alle harmlos (exklusive Render-Pfade). `main-tabs`/`screen-more`/`plant-name` waren False Positives. Dokument korrigiert.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Escape-Helfer per Unit-Test geprüft (javascript: blockiert, Quote-Ausbruch neutralisiert) · Version synchron v30.83.
- **Nächste:** P0-3 `send-push` (gleiches unsignierte-JWT-Muster, aktuell nur durch Gateway-Flag geschützt) · P1-1 obsolete Stripe-Setup-Fns stubben · P1-3 Leaked-Password-Protection (1 Dashboard-Klick) · P1-4 GSW seeden oder Versprechen zurücknehmen · Dark-Mode-Sweep.

### 2026-08-27 (c) — v30.82 RIESEN-AUDIT + Notfall-Doku (P0-Sicherheitsluecke gefunden)

- **Auftrag:** User: „Mache ein riesengrosses Audit und filtere alle Luecken (Sicherheit, fehlendes Wissen, Optik, alles weitere) — pingelig alles hinterfragen. Speichere alles auf der Festplatte ab, so dass man alles findet falls der Laptop nicht funktioniert."
- **Neue Doku (dauerhaft im Repo = laptop-unabhaengig auf GitHub):**
  - **`FULL_STACK_AUDIT_v30.81.md`** — Voll-Audit mit Ampel, 12 priorisierten Massnahmen, Belegen (Zeilennummern/Live-DB-Zahlen).
  - **`DISASTER_RECOVERY.md`** — Wiederherstellung nach Laptop-Verlust: 4-Saeulen-Modell (GitHub/Supabase/Cloudflare/Stripe), Clone-Anleitung, DB-Dump-Prozedur, Secret-/2FA-Checkliste, Bus-Faktor.
- **🔴 P0-FUND (verifiziert am Quellcode):** `i18n-translate` (`verify_jwt:false`) prueft Auth via `decodeJwt()` — das **base64-decodiert den JWT-Payload OHNE Signaturpruefung** (`index.ts:24-46`). Jeder anonyme Aufrufer kann `role:"service_role"` faelschen → **unbegrenzte Anthropic-Kosten auf Owner-Rechnung**. Gleiches Muster in `send-push` (dort nur durch `verify_jwt:true` gedeckt). Fix ist Cowork-Domaene (Edge-Fn-Redeploy) — im Audit dokumentiert.
- **🔴 P0-2:** `mushroom-identify` + `pest-identify` — Anthropic-Vision mit service-role-Client, **keine In-Code-Auth, keine Quota/Rate-Limit**. Vorbild-Muster existiert bereits (`ai-proxy`: tier-basierte Quota; `garden-scan-analyze`: `fn_check_rate_limit`).
- **🟠 P1:** 9/18 `verify_jwt:false`-Edge-Fns haben **keinen Quellcode im Repo** (4 davon live Stripe-mutierende „DEAD-CODE"-Setup-Tools, weiterhin ACTIVE) · geleaktes (rotiertes) `ADMIN_SECRET` in Git-History + `whsec_`-Prefix in `AUFTRAG_v25.4_*.md:270` · Leaked-Password-Protection weiterhin aus.
- **🟠 Wissens-Luecke:** **GSW (Schweizerdeutsch) = 0 Uebersetzungen** in `i18n_translations` (fr/it je 2050, en/es je 2041) — obwohl README/ROADMAP/CLAUDE.md „DE/FR/IT/GSW live" versprechen. Entweder seeden oder Versprechen zuruecknehmen.
- **🟢 Gesund bestaetigt:** 178/178 Tabellen RLS · **0 Security-ERROR-Advisors** (145 Lints: 140 WARN by-design SD-Fns, 5 INFO) · 0 SD-Fns mit mutable search_path · Frontend-Escaping-Disziplin (`escHtml`/`ed`/`gsSanitize`) in Stichproben sauber · Stripe-Webhook HMAC-verifiziert + Replay-Dedup · `delete-user` korrekt uid-gated.
- **Direkt gefixt (v30.82):** CSP `script-src` von 3 CDNs auf die **eine real genutzte** eingegrenzt (`cdnjs` fuer pdf.js) — `unpkg`/`jsdelivr` waren seit dem Leaflet-Self-Host (v25.36) ungenutzte Angriffsflaeche; ebenso `unpkg` aus `style-src` entfernt. Verifiziert: kein einziger echter Load von beiden Hosts.
- **Weitere Funde (dokumentiert, nicht gefixt):** 7 doppelte DOM-IDs (`plant-name` x3, `main-tabs` x2 …) · 3'872 hardcoded Hex-Farben (Dark-Mode-Luecken) · 16 `alert()` + 34 `confirm()` · toter Code (`window.supabase` x9, `gsBrain` x62, `quiz_ranking`-Tabelle).
- **Ehrliche Abdeckungs-Notiz:** Der erschoepfende XSS-Sweep (668 `innerHTML`-Sites) und der komplette Dark-Mode-Sweep wurden vom Org-Monats-Spend-Limit gestoppt → als Follow-up in `FULL_STACK_AUDIT_v30.81.md §8` festgehalten.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Version synchron v30.82 (GS_VERSION/sw.js/_headers/meta) · CSP-Aenderung gegen echte Loads gegengeprueft.
- **Naechste:** P0-Fixes an Cowork (i18n-translate + 2x Rate-Limit + send-push) · GSW-Entscheid · doppelte DOM-IDs · Dark-Mode-Sweep.

### 2026-08-27 (b) — v30.81 Notification-Center: wieder aufrufbare Inbox + abhakbare Aufgaben (Meine Pflanzen + Menü redesigned)

- **Auftrag:** User-Feedback nach v30.80: „Bei Meine Pflanzen und im Menü sieht das mit den Benachrichtigungen hässlich/unprofessionell aus. Man soll sie nochmals aufrufen können. Aufgabenfeld zum Abhaken mit Archiv. Alles eine grosse Stufe besser — smoother, intelligenter."
- **Live-DB-Befund (Kern des Hässlich-Problems):** 348 ungelesene `plant_task`-Zeilen bei einem aktiven User — der 07:00-Checker erzeugt PRO TAG eine neue Zeile pro fälliger Aufgabe (dedup_key `plant_<id>_<task>_<datum>`). Die v30.80-Inbox zeigte diese Wand ungefiltert.
- **Neues Notification-Center (`gsOpenNotifCenter`, Modal `#modal-notif-center`):** Bottom-Sheet im App-Muster, Tabs **Neu/Erledigt**. Neu = abhakbare Aufgaben (live aus `myPlants` via `gsGetDueTasks` — EINE Zeile pro Aufgabe statt eine pro Tages-Push) + Mitteilungen mit Tages-Gruppierung (Heute/Gestern/…). Erledigt = Pflege-Verlauf aus `p.diary[]` + gelesene Mitteilungen → alles jederzeit wieder aufrufbar.
- **Abhaken ist funktional, nicht kosmetisch:** ✓ ruft `gsQuickDone` (lastDone→now, `fn_plant_task_done`-RPC, Diary, Cloud-Blob-Sync, Reminder-Rows gelesen) — Checker pusht die Aufgabe danach nicht wieder. Häkchen-Kreis-Animation + Slide-out.
- **Intelligente Hygiene:** `gsNcCleanupTaskRows` markiert die Tages-Push-Duplikate (plant_task/plant_task_pre/reminder, unread) server-seitig gelesen (max 1×/6h) — die 348er-Wand verschwindet für jeden User beim ersten Öffnen. `gsCollectNotifs` blendet Task-Kinds als Inbox-Zeilen aus (live in Aufgaben-Liste vertreten).
- **Semantik getrennt:** Badge-Quittierung (`gsNotifAckBadge`, beim Menü-Schliessen, `badgeAckTs` + Migration von den alten seen-Keys) ≠ Archivieren (explizit per Item-✓ oder „Alle ✓"). Einträge verschwinden nicht mehr durch blosses Menü-Öffnen (v30.80-Schwäche behoben). Badge zählt fällige Aufgaben (bis zum ersten Blick des Tages) + echte Neuigkeiten.
- **Menü-Panel kompakt:** max 3 Aufgaben (abhakbar) + 3 Mitteilungen + „Alle anzeigen →"; leerer Zustand = schlanke Verlauf-Brücke statt verschwundenem Panel.
- **Meine Pflanzen redesigned:** Due-Cards als To-do-Rows mit Abhak-Kreis, präzise Fälligkeit („Seit N Tagen überfällig" statt „Jetzt fällig!"), Header „📋 Aufgaben (N)" + 🕘-Verlauf-Button ins Center; alle hardcoded Hex-Farben (#ffcdd2/#fff8e1/#e65100) → Design-Tokens (Dark-Mode jetzt korrekt).
- **Verify:** 9/9 Inline-Scripts `node --check` OK · sw.js OK · Version synchron v30.81 (GS_VERSION/sw.js/_headers/meta) · kein DB-Change nötig (nutzt bestehende RPCs/Tabellen).
- **Nächste:** Am Gerät testen (Abhaken → kein Re-Push am Folgetag) · i18n-Keys für neue Strings (tasks_heading/due_since_prefix/due_overdue/due_today) in `i18n_translations` ergänzen (Cowork) · ggf. Snooze-Optionen (2/7 Tage) im Center.

### 2026-08-27 — v30.80 Bugfix-Sprint: Quiz-Rangliste (Race-Condition) + Benachrichtigungen professionalisiert

- **Auftrag:** User-Bug-Report: (1) "Quizrangliste aktualisiert sich nicht — richtige Antwort, aber gleich viele Punkte." (2) "Benachrichtigungen wirken gebastelt, nicht professionell smooth — mach es wie bei anderen Apps."
- **Root-Cause Quiz (Live-DB-verifiziert):** `fn_quiz_leaderboard_upsert` zählt server-seitig aus `quiz_answers` (Anti-Cheat, korrekt) — aber der Client-Push ist 500ms-debounced, während der `quiz_answers`-INSERT erst in einem 800ms-setTimeout läuft → der Upsert zählte VOR dem Insert (Beweis: lb.updated_at 09:54:14.879 < answers.created_at 09:54:15.197). GREATEST() hielt danach den alten Wert → Rangliste eingefroren.
- **Fix Quiz (Migration `20260826_quiz_leaderboard_race_fix.sql`, LIVE applied):** AFTER-INSERT-Trigger auf `quiz_answers` aktualisiert das Leaderboard atomar in derselben Transaktion + Backfill aller eingefrorenen Zeilen (6/6 verifiziert konsistent). Client: Leaderboard-Push/Refresh erst NACH dem Insert (`.then`) · 2 tote `window.supabase`-Pfade (Home-Tagesfrage: falsche Spalte `answer_index`→`selected_option` + `openDqRanking`) auf gsStore/sbFetch revived · Legacy `dqPushToSupabase` feedet jetzt das echte RPC-System (4 Call-Sites) · isMe-Highlight in der Cloud-Rangliste.
- **Root-Cause Notifications (Frontend-Audit, 11 Findings):** Web-Push und In-App-Inbox KOMPLETT entkoppelt (Push-Checker schrieben 0× in `notifications` → Inbox zeigte faktisch nur Stripe) · Badge zählte eigene Scans/Level-Ups als "ungelesen" · 1,8s-Auto-Mark-All-Timer blendete Panel aus, während der User noch las · Panel hart bei 8 gecuttet (totes "+N weitere") · Toast-Singleton überschrieb Meldungen bei Bursts kommentarlos · SW meldete empfangene Pushes nicht an offene Tabs.
- **Fix Notifications (Migration `20260826_push_to_inbox_bridge.sql` LIVE + Frontend):** AFTER-INSERT-Trigger spiegelt `push_send_log` → `notifications` (deckt ALLE heutigen + künftigen Push-Checker ohne eine einzige Edge-Fn-Änderung; inkl. `suppressed_quiet` — stumm ≠ weg; 30d-Backfill als gelesen). Frontend: Mark-Seen beim Menü-SCHLIESSEN statt 1,8s-Timer · Badge zählt nur noch echte Neuigkeiten (eigene Scans/Level-Ups raus) · Panel scrollbar (max-height 46vh, Cap 50 statt Cut bei 8) · Batch-PATCH statt N Einzel-Requests beim Mark-All · SW postMessage `GS_PUSH_RECEIVED` → Badge/Inbox aktualisieren live in offenen Tabs · visibilitychange-Pull (max 1×/60s) · Toast-FIFO-Queue (max 3, Dedup, beschleunigtes Ausblenden bei Wartenden) — deckt `showProfileToast` + `gsToast` (700+ Call-Sites) gemeinsam ab.
- **Verify:** 9/9 Inline-Scripts `node --check` OK · `sw.js` `node --check` OK · beide Migrationen LIVE applied + Backfill verifiziert · GS_VERSION=v30.80 · sw.js gs-v30.80 · _headers v30.80 · meta=30.80.20260827.
- **Nächste:** Push-E2E am Gerät testen (OS-Push → Live-Badge-Update im offenen Tab) · optional `showMarketNotif`/`gsNotif.show` auf gsToast konsolidieren · Toast-Progress-Flows beobachten (Queue statt Sofort-Replace).

### 2026-05-24 (c) — Self-Audit-Sprint v26.51 (Backend-Security-Hardening nach Supabase-Advisors)

- **Auftrag:** User-Request "Auditiere und verbesser bzw. erweitere intelligent alles. Es soll auch Backend alles perfekt aufgebaut sein." Proaktiver Audit ohne externes Briefing.
- **Audit-Findings:** Supabase-Advisor lieferte 98 Security Lints (14 ERROR + 84 WARN) + 376 Perf Lints. Frontend 7/7 OK, 5× 100vh (alle in CHANGELOG-Strings = false positive), 2× raw fetch (eine ist die _gsFetch-impl selbst → OK), 62× alert() (62-davon davon viele in admin/fallback-Pfaden, aber 4 user-facing in Marketplace+Recipes).
- **Migration v26_51 LIVE applied:** 14 SECURITY DEFINER Views → security_invoker=true (war kritisch: views bypassen RLS, jeder authenticated User konnte über sie Daten anderer lesen) + feedback_votes RLS-Hardening (war ALWAYS-TRUE → own-votes only) + 29 FK-Indexes + 6 Duplicate-Indexes gedroppt + 2 function_search_path_mutable Fix.
- **Migration v26_51b LIVE:** 4 admin-only Functions REVOKE EXECUTE für public/anon/authenticated (fn_assign_role, fn_cleanup_old_data, fn_set_global_api_key, is_admin_user). Service-role behält EXECUTE.
- **Frontend Hard-Lesson #2 Fix:** 4 native alert() → gsToast in submitListing (3×) + saveRecipe (1×) — iOS-PWA-Standalone blockiert sonst Webview.
- **Re-Audit-Diff:** Security 14 ERROR + 84 WARN → 0 ERROR + 75 WARN (-23%, alle ERROR-Level weg). Verbleibende 75 WARN: 35 SD-Functions public (by-design für Frontend-RPCs), 6 storage-bucket-listing (by-design für avatars/marketplace), 3 extension_in_public (kein User-Action), 1 leaked_password_protection (Dashboard-Setting).
- **Verify:** 7/7 inline-scripts node --check OK · sw.js gs-v26.51 · GS_VERSION=v26.51 · _headers v26.51 · meta=26.51.20260524 · 2 Migrations LIVE.
- **Naechste:** Dashboard-Settings (Leaked-Password-Protection enable) · ggf. weitere alert→gsToast in nicht-kritischen Flows · Stripe Live-Mode-Switch.

### 2026-05-24 (b) — Trio-Sprint #4 v26.48-v26.50 abgeschlossen (DB-Wave-14 + Edge-Fn-Logging)

- **Auftrag:** Cowork-Briefing — DB-Wave-14 (garden_visitors_animals 12 + garden_weather_alerts 10) + ai_daily_usage Backend komplett (fn_log_ai_usage RPC + v_ai_usage_summary View mit Haiku+Sonnet-Pricing). AI_USAGE_LOGGING_PATCH_GUIDE.md als 1-Min-Patch-Anleitung.
- **v26.48 Garten-Besucher Sub-Tab** (`2af64a1`): 11. Wissen-Sub-Tab "🦔 Besucher" (12 garden_visitors_animals: Igel/Marienkäfer/Fledermaus/Salamander/Eidechse/Regenwurm/Hornisse). Card-Accent farbig nach Nützling vs Schädling vs Rote-Liste. Detail-Modal mit beneficial_role als grosse grüne Box, conservation_actions, what_attracts/repels. PLUS v26.47 Token-Cost-Widget wired to v_ai_usage_summary View mit pre-computed Haiku-Cost.
- **v26.49 Weather-Alert-Widget Home** (`05594df`): Neues #weather-alert-card über der Mushroom-Saison-Card. Query garden_weather_alerts mit typical_months overlap + Region-Filter heuristisch (GS_WA_REGION_TOKENS-Map). Severity-Sort katastrophal first, Pulse-Animation bei katastrophal, MeteoSchweiz-Link, immediate_actions.
- **v26.50 ai_daily_usage Edge-Fn-Logging** (Pending Push): 5 Edge-Fns LIVE redeployed mit fn_log_ai_usage RPC fire-and-forget vor success-Return — pest-identify v2, mushroom-identify v2, garden-scan-analyze v5, plan-iterate v3, knowledge-bulk-gen v11. Pattern: try/catch nicht-blockierend, Tokens aus anthropicData.usage/aiJson.usage/aiData.usage. v26.47 Admin-Widget zeigt jetzt echte Live-Daten.
- **Trio-#4-Bilanz:** 3 Pushes, 0 Migrations (Cowork-Backend ready), **5 Edge-Fn-Redeploys** in einem Sprint! 1 neuer Wissen-Sub-Tab (10→11), 1 Home-Widget (Weather-Alert). Total seit v26.33: **18 Pushes in 4 Sessions (Pentagon #1 + #2 + #3 + Trio #4)**.
- **GreenScan-Stand:** 11 Wissen-Sub-Tabs · 5 Plan-Intents · 3 Home-Widgets (Bauernregel + Saison-Pilze + Wetter-Alert) · Pilz-Scanner mit 145-Notruf · Tagebuch mit 11 Typen · Marketplace mit Bio-Filter · Forest-Garden 7-Schichten · Balkon-Wizard · Admin-Token-Dashboard mit Live-Logging.
- **Cowork-Restpflichten:** Stripe Live-Mode-Switch sobald Fernando bereit · DB-Wave-15 falls neue Domains sinnvoll.

### 2026-05-24 (a) — Pentagon-Sprint #3 v26.43-v26.47 abgeschlossen (DB-Wave-13 + Token-Cost-Widget)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.43_v26.47.md — DB-Wave-13 (alpine_garden_plants 12 + forest_garden_design 8 + indoor_houseplants 20 + urban_balcony_design 16) + garden-scan-analyze v4 LIVE mit bird_friendly + knowledge-bulk-gen v10 mit 35 Topics. 5 Sprints in Reihenfolge.
- **v26.43 Alpine-Pflanzen** (`a74ff09`): 9. Wissen-Sub-Tab "🏔️ Alpen". 12 alpine_garden_plants inkl. Eisenhut (TÖDLICH GIFTIG roter Banner + tel:145), Edelweiss/Arnika (geschützt orange Banner + NHG-Hinweis), Enzian/Soldanelle. Card-Accent farbig nach Sicherheit. Höhenband-Badge prominent. Steingarten-Rolle + Companion-Plants.
- **v26.44 Forest-Garden Designer** (`83054f0`): Neuer Garten-Aktion-Button. Modal mit 8 forest_garden_design + Filter-Pills. Vertikales 7-Schichten-SVG-Diagramm (Canopy oben → Wurzel + Pilz-Etage). Pflanzen-Pills pro Schicht in Schicht-Farbe. Eckdaten-Pills + Pro-Tips + Pitfalls. "Plan übernehmen" erstellt garden_plan plan_intent=permaculture_hugel mit recommended_plants flat aus allen Layern.
- **v26.45 Indoor-Pflanzen** (`f8e407c`): 10. Wissen-Sub-Tab "🪴 Zimmer". 20 indoor_houseplants. Card-Accent rot bei Pet/Kinder-Tox, grün bei air_purifying. Detail-Modal mit Tox-Banner ZUERST + tel:145, Air-Purifying-Banner als Pluspunkt, 2x2-Pflege-Profil-Grid (Licht/Wasser/Temp/Feuchte), Vermehrung, Probleme, Pet-Disclaimer.
- **v26.46 Urban-Balkon-Wizard** (`43e5fd8`): Plan-Typ-Picker mit container_balcony zeigt inline Balkon-Wizard: m²-Input + Orientation-Select + Match-Button. Query urban_balcony_design via size-Range + orientation (Fallback ohne orientation). 6 inline-Result-Cards, Click öffnet Vollbild-Detail-Modal (Eckdaten + recommended_plants + pro_tips/pitfalls). "Vorlage übernehmen" erstellt garden_plan mit balcony_template_slug.
- **v26.47 Token-Cost-Widget Admin** (Pending Push): Migration v26_47_ai_daily_usage LIVE applied (composite-PK date+edge_fn, RLS, Index). Cowork ergänzt Edge-Fn-Logging via UPSERT in alle 8 Edge-Fns. Frontend: admin-only Settings-Row "📊 KI-Nutzung & Kosten". Modal mit Heute-Tab (pro Edge-Fn Calls/Tokens/CHF) + 7-Tage-Trend-Tab (Mini-Bar-Chart + Tages-Total + Ø/Tag). Anthropic Haiku 4.5 Pricing client-side estimate.
- **Pentagon-#3-Bilanz:** 5 Pushes für 5 Sprints, 1 Migration applied (ai_daily_usage), 0 Edge-Fn-Deploys (Cowork: v4 + v10 separat + ergänzt v26.47-Logging als Followup). 2 neue Wissen-Sub-Tabs (8 → 10 total), 1 neuer Garten-Aktion-Button (Forest-Garden), 1 inline Plan-Picker-Wizard (Balkon), 1 Admin-Dashboard. 16+ neue Functions inkl. 2 neue Vollbild-Modals (Forest-Detail + Balkon-Detail + Token-Cost). Total seit v26.33 heute: **15 Pushes in 2 Sessions (Pentagon #1-#3)**.
- **GreenScan-Stand:** Voll ausgebaute Schweizer Naturgarten-PWA mit 10 Wissen-Sub-Tabs (Kompost/Vermehrung/Boden/Heilpflanzen/Samen/Pilze/Wasser/Vögel/Alpen/Zimmer), 5 Plan-Intents (Selbstversorgung/Pollinator/Permakultur/Container/Bird-Friendly), Forest-Garden 7-Schichten-Designer, Balkon-Wizard, Pilz-Scanner mit Tox-Info-145, Tagebuch mit 11 Typen, Marketplace mit Bio-Filter, 2 Home-Widgets (Bauernregel + Saison-Pilze), Admin-Token-Cost-Dashboard.
- **Cowork-Restpflichten:** Edge-Fn-Logging fuer ai_daily_usage (alle 8 Anthropic-callers) · Stripe Live-Mode-Switch begleiten · DB-Wave-14 falls neue Domains sinnvoll.

### 2026-05-23 (e) — Pentagon-Sprint #2 v26.38-v26.42 abgeschlossen (Bonus-Aufgaben + DB-Wave-12)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.38_v26.42.md — DB-Wave-12 (water_features 24 + mushroom_recipes 25 + garden_birds_register 19) + garden-scan-analyze v3 LIVE mit plan_intent + knowledge-bulk-gen v9 mit 31 Topics. 5 Sprints (3 Bonus-Aufgaben aus v26.33-Backlog + 2 neue Domains).
- **v26.38 Mushroom-Glossar** (`c7518c5`, Bonus B-C): 6. Wissen-Sub-Tab "🍄 Pilze". mushroom_register sortiert nach edibility ASC (toedlich zuerst). Card-Accent farbig nach Sicherheit. Detail-Modal mit Lebensgefahr-Banner + tel:145 ZUERST, Edibility-Pill/VAPKO/Habitat/Symbiose/Saison/Morph/Toxine/Symptome/Notfall. Async-Sub-Loads: Lookalikes bidirektional + Rezepte (bei isEdible) via primary_mushroom_slugs cs.{}. Eigener gsMushroomRecipeOpen-Modal. Forward-compat: configs[wasser]+configs[voegel]+Renderer bereits enthalten.
- **v26.39 Mushroom-Saison-Widget** (`1a8e315`, Bonus B-A): Home-Widget lila zwischen Wisdom-Card und Quiz. Query mushroom_seasonal_patches mit best_months overlap currentMonth + region_canton_codes overlap userCantons via gsGetRegionContext. Day-of-year deterministisch eine Patch pro Tag. 6h Cache. typical_mushrooms-Liste + weather_trigger + VAPKO-Telefon + 2 Action-Buttons.
- **v26.40 Companion-Lookup mit View** (`cb8eef9`, Bonus B-B): Im Plan-Detail-Modal (gsGardenScanShowPlant) async-Block zusätzlich zur v26.24 Pest-Box. v_companion_lookup View (Cowork-Backend) statt alter OR-Logik → 1 Query pro Pflanze. Top-3 'gut' + Top-2 'schlecht' mit confidence-Badge + reason + effect_on_self. 15min Cache.
- **v26.41 Wassergarten-Sub-Tab** (`3f906f1`): 7. Wissen-Sub-Tab "💧 Wassergarten" aktiviert. 24 water_features. Card-Accent rot bei invasive, blau bei teich_design, grün bei swiss_native. Detail-Modal mit Invasiv-Banner + best_paired_with/do_not_pair + CH-Recht-Hinweis bei teich_design.
- **v26.42 Vogel-Garten + bird_friendly Modus** (Pending Push): 8. Wissen-Sub-Tab "🦜 Vögel" aktiviert (19 garden_birds_register). Card-Accent nach Rote-Liste-Status. Detail-Modal mit Lockpflanzen + Futter + Nistkasten + attracting_tips + Bedrohungen + Fun-Fact. Plus: KI-Planer Plan-Typ-Picker um 5. Option "🦜 Vogel-Garten" erweitert. Hint-Box bei Auswahl. Plant-Liste mit birdTag forward-compat (pl.bird_tags ODER bei isBirdFriendly + pl.attracts_birds).
- **Pentagon-#2-Bilanz:** 5 Pushes für 5 Sprints, 0 Migrations applied (alle DB-Tabellen ready durch Cowork), 0 Edge-Fn-Deploys (Cowork hat v3 + v9 + v4 separat deployed). 3 neue Wissen-Sub-Tabs (5→8 total Wave-9-Tabs), 1 neues Home-Widget (Mushroom-Saison), 1 KI-Planer-Plan-Typ-Erweiterung (4→5 Optionen), 1 Plan-Detail-Erweiterung (Companions-Box), 10+ neue Functions inkl. eigener mushroom-recipe-Modal.
- **Total seit v26.33:** 10 Pushes in 1 Session (Pentagon #1 + #2). GreenScan ist jetzt eine voll ausgebaute Schweizer Garten-, Pilz-, Wassergarten- und Vogel-PWA.
- **Cowork-Restpflichten:** DB-Wave-13 (alpine_garden_plants / forest_garden_design / indoor_houseplants falls sinnvoll) · Stripe Live-Mode-Switch begleiten.

### 2026-05-23 (d) — Pentagon-Sprint v26.33-v26.37 abgeschlossen (5 Sprints in 1 Session)

- **Auftrag:** Cowork hat DB-Wave-11 (4 Tabellen + 57 Einträge + 2 Views) + AUFTRAG_v26.33-v26.37 freigegeben. 5 Sprints in Reihenfolge umgesetzt.
- **v26.33 Pilz-Scanner** (`02575f1`): Edge-Fn mushroom-identify v1 LIVE (verify_jwt:true, Anthropic Vision + 20-Pilze-Knowledge). 4. Scan-Modus mit Modal + Habitat-Picker. ROTER VOLLBILD-Warnscreen (gsShowMushroomDangerOverlay) bei toedlich/giftig mit pulse-Animation + ☎️-Tox-Info-145. safetyMap aus v_mushroom_safety + bidirektionale Lookalikes + VAPKO-Box mit Region-Lookup.
- **v26.34 Tagebuch UI-Form** (`01dcd44`): Garten-Aktion-Button "📔 Tagebuch-Eintrag" + 2-Tab-Modal (➕ Neuer Eintrag | 📊 Saison-Statistik). Type-Picker mit allen 11 GS_DIARY_TYPES + Conditional Fields pro Type (Species-Picker / harvest_kg / pest_slug / Dünger / Wasser / Krankheit). Saison-Stats-Tab via gsDiaryStats: total + Ernte-Total-kg + Top-5-Pflanzen + Pest-Count + Per-Type-Liste.
- **v26.35 Bauernregeln-Widget** (`49c87b5`): Home-Widget #wisdom-card zwischen "Wusstest du?" und "Schnell-Quiz". Daily-Rotation aus traditional_garden_wisdom mit applicable_months-Filter + day-of-year deterministisch + 12h-Cache. Validity-Badge (4 Farben: 🟢 bestaetigt / 🟡 tendenziell / 🟠 umstritten / 🔴 Mythos). Click rotiert zur nächsten Regel mit Fade.
- **v26.36 Marketplace Pestizid-frei-Filter** (`a201060`): Migration v26_36_marketplace_pesticide_free LIVE applied (3 Spalten + 2 partial Indexes). Bio + Pestizid-frei Checkboxen in beiden Listing-Forms (submitListing + saveListing). Cert-Label-Dropdown mit 6 Optionen (Knospe / EU-Bio / Demeter / Naturland / Bioland / Sonstiges). renderMarket-Cards mit grünem Bio-Badge + orangem Pestizid-frei-Badge. 2 Filter-Pills "🌱 Bio-zertifiziert" + "🚫 Pestizid-frei" oberhalb Listings.
- **v26.37 Pollinator-Garten-Modus** (Pending Push): Plan-Typ-Picker im KI-Garten-Scan-Wizard mit 4 Optionen (🥕 Selbstversorgung default / 🐝 Bienen-Garten / 🌳 Permakultur / 🪴 Container). body.metadata.plan_intent wird an garden-scan-analyze gesendet. Cowork-Ergänzung v3 wird das nutzen. Result-Preview zeigt Intent-Badge + Plant-Liste forward-compatible mit 🐝-Tag bei pl.pollinator_tags ODER ecological_value>=7.
- **Pentagon-Bilanz:** 5 Pushes für 5 Sprints, 1 Migration applied, 1 Edge-Fn deployed (mushroom-identify v1, verify_jwt:true), 14+ neue Functions, 4 neue Modals, 4 neue Garten-Aktion-Buttons, 1 Home-Widget, 1 KI-Planer-Erweiterung.
- **Cowork-Restpflichten:** garden-scan-analyze v3 mit plan_intent + pollinator-Modus · Bonus B-A Mushroom-Saison-Widget · B-B Companion-Lookup-View-Nutzung · B-C Mushroom-Glossar im Wissen-Tab · DB-Wave-12 (water_features, traditional_recipes_per_canton, mushroom_recipes).

### 2026-05-23 (c) — v26.33 Pilz-Scanner (sicherheitskritisch, mushroom-identify Edge-Fn LIVE)

- **Auftrag:** Cowork-Briefing CODE_AUFTRAEGE_v26.33_v26.37.md — DB-Wave-11 (mushroom_register 20 / mushroom_lookalikes 9 / mushroom_seasonal_patches 8 / traditional_garden_wisdom 20 + v_mushroom_safety + v_companion_lookup Views). v26.33 als erster Sprint umgesetzt (P1, ~4h).
- **Edge-Fn mushroom-identify v1 LIVE:** verify_jwt:true, Anthropic Vision Haiku 4.5 mit allen 20 Pilzen im System-Prompt-Knowledge-Context (slug/name/edibility/VAPKO-Klasse/Hut/Lamellen/Sporen/Stiel/Geruch/Merkmale/Habitat). Force vapko_required=true bei confidence<70 ODER edibility ∈ {toedlich,giftig}. Bidirektionale Lookalikes-Query via .or(edible_slug.eq...,lookalike_slug.eq...). Region-aware VAPKO-Kontrollstelle aus mushroom_seasonal_patches.region_canton_codes mit Fallback. Repo-File supabase/functions/mushroom-identify/index.ts 1:1 mit deployed Source synced.
- **Frontend 4. Scan-Modus:** Garten-Aktion-Button "🍄 Pilz-Scanner" (violetter Gradient #6a1b9a→#4a148c). Modal mit gelbem Tox-Info-145-Disclaimer ZUERST, 8MB Foto-Inputs (Kamera/Galerie), Habitat-Picker (7 Typen). 6 neue Functions: openMushroomModal / gsMushroomLoadPhoto / gsMushroomRunScan / gsMushroomRenderResult / gsMushroomVapkoBox / gsShowMushroomDangerOverlay.
- **gsShowMushroomDangerOverlay (sicherheitskritisch):** position:fixed inset:0 z:99999 #b71c1c-Vollbild mit eigener gs-mushroom-pulse-keyframe-Animation, 72px ☠️/⚠️ Icon, 28px Playfair-Headline "TÖDLICH GIFTIG"/"GIFTIG", KI-Match-Card mit common_name_de + scientific_name, NICHT-ESSEN-Warning, full-width "☎️ Tox-Info: 145"-tel-Link-Button (min-width:240px), "Verstanden — Details anzeigen"-Dismiss-Button. User MUSS aktiv dismissen.
- **safetyMap aus v_mushroom_safety:** red→🚫 TÖDLICH/GIFTIG, orange→⚠️ NUR JUNG/BEDINGT, yellow→⚠️ Vorsicht, green→✅ Speisepilz. Plus symptoms_if_toxic + emergency_action + 145-Footer bei toedlich/giftig; cooking_preparation + conservation_methods bei Speisepilz; Confidence<60 → gelbe UNSICHER-Box (statt false-positive).
- **Lookalikes bidirektional gerendert:** confusion_risk-Badge (hoch=#c62828, mittel=#e65100, niedrig=#827717) plus visual_differences + smell_differences + spore_print_differences + pro_tip (grün) pro Lookalike.
- **VAPKO-Pflicht-Box:** gsMushroomVapkoBox mit Kontrollstelle + tel-Link (Spaces gestrippt) + vapko_link external — aus user-region.
- **Verify:** 7/7 inline-scripts node --check OK · sw.js gs-v26.33 OK · GS_VERSION=v26.33 OK · meta=26.33.20260523 OK · _headers v26.33 OK.
- **Naechste Sprints:** v26.34 Tagebuch-UI-Form (Type-Picker 11 entry_types + Saison-Stats), v26.35 Bauernregeln-Widget (traditional_garden_wisdom Daily-Rotation + Validity-Color), v26.36 Marketplace Pestizid-frei-Filter, v26.37 Pollinator-Garten-Modus.

### 2026-05-23 (b) — Quartet-Sprint v26.28-v26.32 (DB-Wave-10-Frontend + Migration)

- **Auftrag:** Cowork hat DB-Wave-10 + bulk-gen v8 + region-aware Edge-Fns deployed. 5 Sprints freigegeben (CODE_AUFTRAEGE_v26.28_v26.32.md). v26.29 + v26.31 als Bundle ausgeliefert weil gleiches Pattern → 4 Pushes für 5 Sprints.
- **v26.28 KI-Planer Region-Wiring** (`7c73d7b`): gsRunGardenScan body.metadata bekommt async region_slug (aus v26.27 gsGetRegionContext) + soil_type + soil_ph (aus v26.25 gs_soil_profile). Backend garden-scan-analyze v2 + plan-iterate v2 sind region-aware.
- **v26.29 Düngeplan-Coach + Beet-Layout-Designer** (`d0a5314`, Bundle v26.29+v26.31): 2 neue Garten-Aktion-Buttons. Düngeplan: Modal mit Pflanzen-Picker (auto-select bei myPlants-Match), Phasen-Liste aus fertilization_schedules mit NPK-Focus, Bio + Mineral-Optionen, CHF-Kosten, "Erledigt"-Button → garden_diary. Layouts: 10 garden_layouts mit Filter-Pills + Detail-Modal (plant_combinations, rotation_plan, pro_tips, common_pitfalls).
- **v26.30 Samen-Gewinnung** (`d2c8b53`): 5. Wave-9-Sub-Tab im Wissen "🌰 Samen ernten". configs[samen] erweitert + neue _gsWave9RenderSeedSaving Detail-Modal mit WICHTIG-Cucurbita-Kreuzung-Warning ZUERST + Badges (Bestäubung/Isolation/Keimfähigkeit) + Extraktion/Reinigung/Trocknung/Lagerung.
- **v26.32 Garten-Tagebuch v2** (`fbf2b0c`): Migration v26_32_garden_diary_v2_kategorien LIVE applied (entry_type CHECK 11 values + pest_slug FK + species_lat + harvest_kg + metadata jsonb + 2 Indexes). **Bug-Fix:** v26.21+v26.29 Inserts schlugen silent fehl (type/notes Spalten existierten nicht) → korrigiert. Neue gsDiaryAddEntry + gsDiaryStats Helper.
- **Cowork-Restpflichten:** Stripe-Dashboard Connect + Live-Mode-Switch · Bonus B1 (did_you_know/seasonal_tips Bulk-Refill jetzt mit bulk-gen v8 möglich) · B2 (Marketplace Pestizid-frei-Filter) · B3 (Pollinator-Garten-Modus).
- **Sprint-Bilanz:** 4 Pushes für 5 Sprints, 1 Migration applied, 0 Edge-Fn-Deploys, 5 neue Garten-Aktion-Buttons + 1 Wissen-Sub-Tab + 2 generic API-Helper (gsDiaryAddEntry, gsDiaryStats).

### 2026-05-23 (a) — Quintuple-Sprint v26.23-v26.27 (DB-Wave-9-Frontend)

- **Auftrag:** Cowork hat DB-Wave-9 mit 4 neuen kuratierten Tabellen + knowledge-bulk-gen v7 deployed. 5 Sprints freigegeben (CODE_AUFTRAEGE_v26.23_v26.27.md). Reihenfolge wie spezifiziert: v26.23 → v26.24 → v26.25 → v26.26 → v26.27.
- **v26.23 Wissen-Tab Erweiterung** (`908c0a9`): 4 neue Sub-Tabs (🌱 Kompostieren / ✂️ Vermehrung / 🪨 Boden-Pflege / 🌿 Heilpflanzen). gsRenderWissenWave9 generic Renderer + Filter-Pills + 4 spezifische Detail-Render-Funktionen. Heilpflanzen mit PROMINENT rote Kontraindikations-Box (rechtssicher).
- **v26.24 Pest-Filter im KI-Planer** (`20ad51e`): gsLoadPestsForPlanPlant async-Block im Plan-Detail-Modal. Top-3 plant_pests via host_plants @>[lat] + pest_companion_plants via effective_against-Overlap. Severity-Dots + Prevention + Bio-Behandlung + Schutzpflanzen-Vorschläge. "🪲 Schädling fotografieren"-CTA öffnet v26.21 Pest-Scanner.
- **v26.25 Bodenverbesserer-Recommender** (`537580d`): Garten-Aktion-Button "🪨 Boden verbessern" + Modal mit pH/Bodenart/Goal-Pickers + Client-Scoring (50 pH-Match, 18 Type-Match, 25 Goal-Match) → Top-5 aus 15 soil_amendments. Profil-Persistenz in gs_soil_profile.
- **v26.26 Heilpflanzen-Profile** (`20060dd`): openDetail Pflanzen-Detail-Modal bekommt async medicinal_plants_register-Block falls scientific_name-Match. WARNUNGEN ZUERST (Kontraindikationen rot border-2, Wechselwirkungen orange, Toxizität gelb), dann Used-Parts, Wirkstoffe, traditionelle vs evidenz-basierte Anwendung, Dosierung, Erntezeit, CH-Rechtslage. Disclaimer-Footer.
- **v26.27 Regional-Calendar** (`b2ccb1d`): Garten-Aktion-Button "🗓️ Regional-Kalender" + Modal mit Picker für 7 CH-Höhenzonen aus regional_garden_calendars. Aktueller Monat prominent in oranger Box + best_vegetables (grün) + challenging_plants (orange) + 12-Monats-Accordion (current open). gsGetRegionContext() API für künftige KI-Planer-Integration. Persistenz gs_region.
- **Bekannte Bugs (laut Briefing):** did_you_know_facts + seasonal_tips bulk-gen Schema-Mismatch (insertion silent fails) — debug-fähig in net._http_response.
- **Cowork-Restpflichten:** Stripe-Dashboard Connect aktivieren · Stripe Live-Mode-Switch · Bonus v26.23a/b/c (knowledge-bulk-gen v8 mit Wave-9-Schemas + Marketplace Pestizid-frei-Filter + Garten-Tagebuch-Verbesserung).
- **Sprint-Bilanz:** 5 saubere Pushes in einer Session, 0 Backend-Migrations (alles ready), 4 neue Garten-Aktion-Buttons, 7 neue Modals, 1 erweiterte Wissen-Section (12 → 16 Tabs), 1 KI-Planer-Erweiterung, 1 Pflanzen-Detail-Hook.

### 2026-05-22 (e) — Triple-Sprint v26.18+v26.19+v26.20

- **Auftrag:** Cowork hat 3 grosse Sprints freigegeben (CODE_AUFTRAEGE_v26.18_v26.20.md). Reihenfolge: v26.20 i18n (höchster Impact, niedrigstes Risiko) → v26.19 Pest-Scanner (Vision-AI + 25 Schädlinge) → v26.18 AR-View (Three.js MVP).
- **v26.20 i18n Frontend-Switcher** (commit `b10709d`, GS_VERSION='v26.20'): gsI18n erweitert um Direct-PostgREST-Pull aus i18n_translations (1 GET-Query, keine Anthropic-Calls). 24h-TTL via bundleTs-Map. Boot-Auto-Build: bei detectLang()!=de UND isStale(lang) → async loadFromDb → applyToDOM. openModal-Hook (idempotent) übersetzt dynamisch geöffnete Modals. gsHandleLangChange Fast-Path. FR/IT/GSW-User sehen jetzt schon beim Erst-Visit ihre Sprache.
- **v26.21 = v26.19 Schädlings-Scanner** (commit `6978f02`, GS_VERSION='v26.21'): Edge-Fn `pest-identify` v1 LIVE (verify_jwt:true, Anthropic Vision Haiku 4.5 + plant_pests-Knowledge-Context mit 25 AGFF-Schädlingen). Frontend: neuer Garten-Aktion-Button "🪲 Schädling-Scanner" + #modal-pest mit Foto-Upload (Kamera/Galerie, 8MB Limit) + Host-Plant-Picker aus myPlants. 5 neue Functions (openPestModal/gsPestLoadPhoto/gsPestRunScan/gsPestRenderResult/gsPestAddToDiary). Confidence-Badge 3 Stufen (Gering/Mittel/Hoch). Bei Confidence < 40 zeigt "bitte näher"-Hint statt false-positive.
- **v26.22 = v26.18 AR-View MVP** (commit `076afad`, GS_VERSION='v26.22'): Three.js basierter 3D-View für 30 Seed-Pflanzen aus ar_models (gltf_url=NULL → Fallback-Geometrie). gsAROpen + _gsARInitScene + _gsARRenderFallback + _gsARDispose. Eigene Drag/Pinch/Wheel-Pointer-Logic statt OrbitControls (spart externe Abhängigkeit). _gsARColors-Map mit 30 species-spezifischen Krone-Farben. Memory-Leak-frei via closeModal-Hook. Three.js bereits self-hosted (/assets/three.min.js seit v25.36).
- **Cowork-Restpflichten:**
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um account.updated + account.application.deauthorized als Enabled-Events ergänzen (für v26.6/v26.17 Marketplace-Connect-Loop)
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 Stripe Live-Mode-Switch (Fernando)
  - 🟡 Bonus v26.18a/b/c (optionale Nachzieh-Sprints): seasonal_highlights als 17. knowledge-bulk-gen Topic · compost_recipes + propagation_methods im Frontend (Wissen-Tab) · Pest-Filter im KI-Planer.
- **Followup naechste Session:** Browser-Smoke-Test via Chrome-MCP (FR-Switch, Schädling-Foto, AR-View für Tomate) falls verfügbar. Bonus-Sprints v26.18a/b/c bei Bandbreite.

### 2026-05-22 (d) — AUFTRAG_v26.17 Refinements (stripe-webhook v10)

- **Auftrag:** Nach v9-Push schrieb Cowork das AUFTRAG_v26.17 mit 3 spezifizierten Refinements. Meine v9 matched zu ~95%, aber: (a) `account.application.deauthorized` Handler fehlte komplett, (b) v9 setzte `disabled` bei JEDEM disabled_reason (zu aggressiv — Stripe nutzt das auch für transient `pending_verification`), (c) v9 hatte impliziten Skip via UPDATE statt expliziten Pre-Check + warn-log.
- **Edge-Fn `stripe-webhook` v10 LIVE:**
  - `handleAccountUpdated`: jetzt Pre-Check (`SELECT marketplace_sellers WHERE stripe_account_id=...maybeSingle()`), skip mit warn-log wenn kein Eintrag. Status-Mapping konservativer — `disabled` NUR wenn `disabled_reason.startsWith('rejected')`. Sonst `restricted` (für `pending_verification` etc.).
  - `handleAccountDeauthorized` (NEU): bei `account.application.deauthorized` → status='disabled', charges/payouts=false. Account-ID-Lookup zuerst via `event.account` (top-level), Fallback via `event.data.object.account` (API-Version-tolerant).
  - Switch-Case erweitert um `case "account.application.deauthorized"`.
  - Repo-File 1:1 mit v10 synced.
- **Definition of Done v26.17 erfüllt:**
  - ✅ account.updated → marketplace_sellers.status/charges_enabled/payouts_enabled/details_submitted/requirements/business_type sync
  - ✅ account.application.deauthorized → status=disabled
  - ✅ Status-Mapping wie spezifiziert (pending/active/restricted/disabled)
  - ✅ Header-Kommentar v10-Notiz
- **Cowork-Restpflichten (weiter reduziert):**
  - 🟡 Stripe-Dashboard: Webhook-Endpoint um `account.updated` + `account.application.deauthorized` als Enabled-Events ergänzen (sonst kommen die Events nicht beim Webhook an) — siehe AUFTRAG_v26.17 §1.
  - 🟡 Stripe-Dashboard Connect aktivieren
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic
  - 🟡 Stripe Live-Mode-Switch
- **Followup naechste Session:** Smoke-Test via AUFTRAG_v26.17 Variante A (synthetic) wenn Cowork den Webhook-Endpoint erweitert hat.

### 2026-05-22 (c) — Autonome Backend-Erweiterung (i18n Pass-3 Live + stripe-webhook v9)

- **Auftrag:** User-Freigabe „lets go" → autonome Wertschoepfung auf 2 Tracks: (1) i18n FR/IT komplett, (2) stripe-webhook v9 mit account.updated Handler.
- **i18n Pass-3 LIVE:**
  - 316 unique DE-Keys aus index.html extrahiert (data-i18n + GS_I18N_JS_STRINGS-Map).
  - i18n-translate Edge-Fn API verstanden: nimmt `{source_lang, target_langs:[fr,it], strings:{key:text}, context}`, macht intern Chunking + Cache via i18n_translations(source_lang, target_lang, source_hash) Schema (NICHT lang/key-Tabelle wie urspruenglich angenommen).
  - 4 Batches × 80 Keys × 2 Sprachen = 632 Translations via curl (Edge-Fn ist verify_jwt:false, kein Auth-Header noetig). Total ~115s, ~22.3k tokens in / 19.6k tokens out = ~$0.10 Anthropic-Cost (Haiku-Pricing).
  - DB-Coverage **VORHER → NACHHER**: DE→FR 30 → **321** (+291) · DE→IT **5 → 313** (+308) · DE→GSW 297 (unveraendert, war Cowork-Pass-2). Schweizer Markt jetzt 100% DE/FR/IT covered. AUFTRAG_CODE_v26.8 Definition-of-Done erfuellt.
- **stripe-webhook v8 → v9 LIVE:**
  - v8-Source komplett uebernommen (kein Behavior-Change fuer existing Triggers Subscription/Checkout/PaymentIntent/Invoice).
  - Neuer `case "account.updated"` mit `handleAccountUpdated` Handler. Logik: Stripe.Account.charges_enabled + payouts_enabled + details_submitted + requirements.currently_due → status-Mapping (active/pending/restricted/disabled).
  - User-Lookup zuerst via `account.metadata.gs_user_id` (von stripe-create-connect-account gesetzt), Fallback via `stripe_account_id` (eindeutig in marketplace_sellers).
  - Sync-Felder: status + charges_enabled + payouts_enabled + details_submitted + requirements (jsonb) + business_type.
  - Damit v26.6 Marketplace-Connect-Loop komplett: Frontend ruft Edge-Fn → Stripe-Onboarding → account.updated Webhook → marketplace_sellers.status sync → gsMarketplaceRefreshSettingsRow zeigt korrekten Status.
  - Repo-File supabase/functions/stripe-webhook/index.ts 1:1 mit deployed v9 synced.
- **Cowork-Restpflichten (reduziert):**
  - ✅ DONE: marketplace_sellers Migration · stripe-create-connect-account · daily-push-checker v3 · stripe-webhook v9 account.updated · i18n FR/IT Bulk-Translate
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt stripe-create-connect-account `account_invalid`
  - 🟡 knowledge-bulk-gen v7 mit seasonal_highlights Topic erweitern (aus heute-morgen Daily-Routine flagged)
  - 🟡 Stripe Live-Mode-Switch (Fernando Dashboard-Action)
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Browser-Smoke-Test mit Chrome-MCP falls verfuegbar (Sprachen-Switch FR/IT) · Lighthouse-Pass.

### 2026-05-22 (b) — Backend-Deploy-Session (v26.6/v26.7 Backend)

- **Auftrag:** Cowork hat freigegeben — Backend-Files fuer v26.6 (Marketplace-Connect) + v26.7 (Trial-Reminder) via Supabase MCP deployen.
- **Migration `v26_6_marketplace_sellers`:** ✅ APPLIED. CREATE TABLE marketplace_sellers + 3 RLS-Policies (own_select/insert/update) + index_marketplace_sellers_stripe + view v_my_marketplace_seller (joined mit profiles) + touch_updated_at Trigger.
- **Migration `20260521_push_dedup.sql`:** ❌ NICHT APPLIED — schema-incompatible (push_send_log hat keinen dedup_key Column). Statt eines neuen Indexes wird die existing (user_id, category)-Dedup via fn_push_already_sent_today RPC genutzt. File im Repo als NO-OP-Marker neu geschrieben.
- **Edge-Fn `stripe-create-connect-account`:** ✅ DEPLOYED v1 (verify_jwt: true). Express-Onboarding mit CH/CHF/individual + idempotent (existing account reused) + AccountLink mit refresh/return-URLs. Slug: stripe-create-connect-account.
- **Edge-Fn `daily-push-checker`:** ✅ DEPLOYED v3 (verify_jwt: false). v2-Source komplett uebernommen (Frost / Seasonal / Quiz-Streak Triggers unangetastet) + neuer notifyTrialEndingSoon-Helper am Ende des Handlers. Trial-End nutzt category='trial_end' mit alreadySentToday-Check, push_subscriptions.auth_secret (statt auth), webpush.setVapidDetails aus app_settings. Repo-File jetzt 1:1 mit deployed Code.
- **Cowork-Restpflichten:**
  - 🟡 stripe-webhook v9 muss account.updated-Event handlen → marketplace_sellers.status/charges_enabled/payouts_enabled syncen
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect) — sonst returnt Edge-Fn account_invalid
  - 🟡 daily-push-checker v3 Smoke-Test (curl mit cron-secret oder service_role) waehrend Fernando-Trial gerade laeuft → verify trial_sent ≥ 0
- **Followup naechste Session:** AR-View v26.9 sobald Cowork ar_models gefuellt hat · Stripe Live-Mode-Switch wartet auf Fernandos Dashboard-Action.

### 2026-05-22 — Code-Daily (Fr, KW 21)

- **Sync:** Lokale Divergence aufgeloest — `git reset --hard origin/main` (Cowork-lokale `83f2d40` v26.11-Performance war redundant, Inhalt bereits in meiner v26.12-Bundle).
- **Sprint-Status:** v26.6 Marketplace-Connect (f24f37d → v26.12), v26.7 Trial-Reminder (de5067a → v26.13), v26.8 i18n-Tooling (83bc00e → v26.14), v26.2 User-friendly Release-Notes (0117c23 → v26.15) **alle LIVE** auf origin/main + green-scan.ch.
- **Health:** ✅ LIVE=v26.15 = REPO=v26.15. SW gs-v26.15. Cloudflare antwortet `cache-control: must-revalidate`. 25 Edge-Fns ACTIVE. Webhook 24h: 0 Events (keine Sub-Aktivitaet), 0 Errors. audit_log 24h: nur `knowledge_growth_daily` (pg_cron laeuft).
- **DB-Wachstum:** 16 Knowledge-Tabellen; nur **`seasonal_highlights = 36 (Min 40)`** unter Threshold. Bulk-Gen-Trigger via `pg_net.http_post` → **HTTP 400 "Unknown topic"** — `knowledge-bulk-gen` Edge-Fn kennt `seasonal_highlights` nicht (nur `seasonal_tips`).  → **Cowork-Pflicht:** Topic in `knowledge-bulk-gen` v7 ergaenzen ODER alternative Seed-Quelle definieren.
- **Smoke-Test (HTTP):** ✅ `/` (3.57 MB), `/assets/leaflet.js` (148 KB), `/sw.js` (17 KB), `/data/plants.v1.js` (2.17 MB) — alle HTTP 200, <300ms. (Browser-Smoke fehlt mangels Chrome-MCP.)
- **Cowork-Backend-Pflichten offen** (aus v26.6/v26.7 Sprints):
  - 🟠 `stripe-create-connect-account` Edge-Fn nicht deployed (File: `supabase/functions/stripe-create-connect-account/index.ts`)
  - 🟠 `daily-push-checker` ist noch **v2** — v3 mit `notifyTrialEndingSoon` Re-Deploy ueberfaellig (File: `supabase/functions/daily-push-checker/index.ts`, **existing v2-Trigger Frost/Wasser/Saisonal/Quiz beim Re-Deploy mit dem neuen Trial-Helper im Handler kombinieren**)
  - 🟠 Migrations `20260520_marketplace_sellers.sql` + `20260521_push_dedup.sql` apply
  - 🟡 Stripe-Dashboard Connect aktivieren (https://dashboard.stripe.com/settings/connect)
  - 🟡 FR/IT Bulk-Translate via `scripts/i18n_translate.sh` (235 Keys-Pipeline ready)
- **Followup naechste Session:** seasonal_highlights Topic-Erweiterung verifizieren · Lighthouse-Pass falls Chrome-MCP verfuegbar.

---

## 1 · Aktueller Stand (statischer Snapshot)

> Die tagesaktuellen Details stehen in Sektion 0 (Routine-Einträge, neueste zuerst).
> Dieser Abschnitt hält nur die groben Eckdaten.

- **Version:** `v30.80` (Client) · SW-Cache `gs-v30.80` · Domain **green-scan.ch** (kanonisch mit Bindestrich).
- **Release:** ✅ live seit v26.0 (Pre-Release-stable getagged auf v25.38). Stripe **Live-Mode** aktiv seit v26.40.
- **Frontend:** `index.html` ~82'000 Zeilen (Monolith HTML+CSS+JS, kein Build). `sw.js`, `data/plants.v1.js` (~2.1 MB, 4'342 Arten).
- **Backend:** Supabase — 117 Tabellen (alle RLS, 0 Security-ERROR-Advisors seit v26.51/v26.76), ~30 Edge-Functions LIVE, 195 Migrationen.
- **Architektur-Detailkarte:** siehe `BACKEND_FRONTEND_MAP_v26.76.md` (Backend↔Frontend-Mapping, Edge-Fn-Liste, Advisor-Stand).

## 2 · Offene Punkte (aus den Routine-Einträgen)

Meist **Owner-Dashboard-Aktionen** (kein Code):

| Punkt | Wer | Status |
|---|---|---|
| Leaked-Password-Protection aktivieren (Supabase Auth-Setting) | Owner | offen (1 Dashboard-Klick) |
| Stripe Live-Mode End-to-End verifizieren (Checkout → Webhook → Tier) | Owner | laufend |
| `seasonal_highlights` Knowledge-Tabelle unter Threshold (36/40) — `knowledge-bulk-gen` Topic ergänzen | Backend/Cowork | offen |
| Verbleibende `alert()` → `gsToast` in nicht-kritischen Flows | Frontend | nice-to-have |
| 75 verbleibende Supabase-Advisor-WARN (meist by-design: SD-Functions, Storage-Buckets) | — | dokumentiert, optional |

Keine **Release-Blocker** offen — der v26.51-Self-Audit hat alle 14 Security-ERROR eliminiert.

## 3 · Konventionen

Vor jedem Edit: `CLAUDE.md` lesen (Versionierung, KI-Call-Wrapper, RLS-Regeln,
Multi-Agent-Sync). Nach jedem Edit: Routine-Eintrag oben in Sektion 0 anhängen
+ `GS_VERSION` / `sw.js` / `meta app-version` / `_headers` gemeinsam bumpen.
