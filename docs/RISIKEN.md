# Was später schiefgeht — gemessen, nicht vermutet

> Anlass: Fernandos „Detektiere probleme die später auftauchen könnte und bringe
> da 1a Lösungen." Die sechsunddreissig anderen Prüfstände fragen, ob die App
> **heute** stimmt. Dieses Dokument fragt, was an einem **Datum** oder an einer
> **Grösse** aufhört zu stimmen — und niemandem auffällt, weil es heute noch
> geht.
>
> **Stand: 16.09.2026 (v33.44); §1 und §3 am 10.11.2026 um das KI-Modell ergänzt (v33.58); §1, §2, §3 und §7 am 11.11.2026 um die Rest-Risiken der Sicherheitsreparatur ergänzt (v33.59).** Jede Zahl hier ist gemessen; wo sie aus einer
> früheren Messung stammt, steht das Datum daneben. Prüfstand:
> `node scripts/risiko_check.js`.

---

## 0 · Die Regel

**Eine Zahl ohne Datum ist eine Behauptung.** Und: *was sich auszählen lässt,
gehört in einen Prüfstand; was nicht, gehört hierher — mit Datum und mit dem
ausdrücklichen Vermerk, dass es niemand misst.* Beides zu vermischen macht den
Bericht unlesbar (dieselbe Lehre wie `render_check` v32.21).

---

## 1 · Was an einem DATUM aufhört

| Was | Wann | Gemessen | Was dann passiert | Lösung |
|---|---|---|---|---|
| **Das KI-Modell fällt weg** | **17.02.2027** (frühestens) | 10.11.2026, Anthropic „Model deprecations": `claude-sonnet-4-6` — das erste Glied der Kette — wird frühestens an diesem Tag abgeschaltet | Am 15.06.2026 fiel `claude-sonnet-4-20250514` weg: drei Edge-Functions nannten genau dieses eine Modell und waren **fünf Monate tot, ohne dass etwas meldete**. Am 30.11.2026 wäre `claude-sonnet-4-5` gefolgt — der Vorgabewert des Proxys, also jeder Scan. | **Behoben in v33.58:** eine Kette je Rolle (`_shared/modelle.mjs`, in der App `_gsClaudeFallbacks`), Rückfall bei „gibt es nicht", und jedes Modell bekommt seine Einstellungen (Sonnet 5.5 und 5 denken sonst von sich aus nach). Fällt 4.6 weg, übernimmt 5.5 **von selbst** — das Datum hier heisst nur: vorher einmal mit 5.5 scannen (Secret `GS_MODEL_VISION`) und die Abkündigungsseite neu lesen. `modell_check` hält App und Server gegeneinander. |
| **Quiz-Vorrat erschöpft** | **16.06.2027** | 14.09.2026, `quiz_gen_check`: 181 freie Fragen, Zulauf 12 je 35 Tage, Verbrauch 1/Tag → −0,657/Tag | `fn_get_daily_quiz` wiederholt über ihren Rückfall — **ohne dass etwas meldet** | Migration `20260914_quiz_vorrat.sql` anwenden (misst den Vorrat, warnt unter 60 Fragen nach `system_events`). **Nicht angewandt.** |
| **Jahres-Pro für die Quiz-Top-3** | **31.12.2026**, 23:00 UTC — und jedes Jahr wieder | 10.11.2026, Live-DB nur lesend: Cron `quiz-top3-yearend` → `fn_grant_quiz_top3_pro` | Live zählt das Jahres-Pro jede richtige Antwort auf jede Frage, nicht nur auf die Frage ihres Tages, und die Lösungen sind öffentlich lesbar. Die drei Ersten bekommen ein Jahr Pro — wer am meisten nachschlägt, gewinnt. | Migration `20261110_sicherheit_quiz_punkte.sql` VORHER anwenden (Antworten nur auf die Frage des Tages, das Jahres-Pro tagesgebunden). **Nicht angewandt.** Das Datum steht hier bewusst **nicht fett**: `risiko_check` R4 verlangt für jedes fette Datum in §1 einen Eintrag in `GS_FRISTEN`, und den gibt es noch nicht — er gehört in `index.html` nachgetragen. Bis dahin sieht ihn die Karte „Läuft demnächst ab" nicht. |
| **Die Wochen-Texte** | war: 01.01.2027 | 16.09.2026, `risiko_check` R1 | Die App hätte in Woche 13 von der „Pilzsaison 2026" erzählt — jedes Jahr wieder | **Behoben in v33.44.** Elf Zeilen bereinigt; fünf Jahresnennungen bleiben, weil sie feste Punkte nennen (Zieljahr 2030, datierte Berichte) — sie stehen namentlich in `risiko_check`. |

**Die Regel dahinter:** `WEEKLY_SEASONAL_FACTS` (521 Einträge) wird **nur nach
Kalenderwoche** ausgewählt (`gsGetKW`) — die Liste wiederholt sich jedes Jahr.
Ein Text darin, der „dieses Jahr" meint, ist ab dem 1. Januar falsch.

---

## 2 · Was mit der GRÖSSE aufhört

| Was | Deckel | Heute | Was ohne Deckel passiert |
|---|---|---|---|
| `localStorage` gesamt | ~5 MB (Browser) | `speicher_check` stellt den vollen Speicher HER und fährt zehn Rettungswege | Ohne Rettungsweg meldet die App Erfolg und speichert nichts (v31.65) |
| Tagebuch | 300 Einträge (`slice(0, 300)`) | — | — |
| Lernkarten | `GS_TRAINING_KARTEN_MAX` = **500** | — | — |
| Quiz-Tagesschlüssel | `GS_DQ_TAGE_MAX` = **30** | einer je Tag | Ohne Deckel ein Schlüssel je Tag, für immer |
| Messwerte auf dem Gerät | `GS_MESSWERTE_MAX` = **2000** | hochgeladene fallen zuerst | Bis v33.45 hiess der Deckel nur `2000` an seiner Aufrufstelle — **ein Deckel ohne Namen steht in keinem Dokument und in keiner Regel.** |
| Nutzungsereignisse | `GS_ANALYTICS_TAGE` = **180** Tage | Migration `20260910_analytics_retention.sql` **nicht angewandt** | Eine Zählung, die nie endet, ist ein Archiv |
| Bild-Cache (Service Worker) | `IMAGE_CACHE_MAX` 500 Kacheln (~17 MB), geprüft alle 50 | in `sw.js` — `risiko_check` R3 liest nur `index.html`, diese Zahl ist **nicht** maschinell geprüft | Geht der Platz aus, räumt mancher Browser den **ganzen Ursprung** ab, mitsamt `localStorage` |
| Changelog-Archiv | inline 20, Rest im Archiv | **571 Einträge, 1,2 MB** | Wird erst beim Öffnen geladen — nicht vorgecacht (v33.01) |
| Artenliste | — | **2,1 MB, 4'337 Einträge / 3'136 Arten** | Separat gecacht; wächst nur durch Kuratierung |
| Nur lokal gespeicherte Pläne nach dem Abmelden (`gs_plans_wartend`) | 20 je Konto, 90 Tage (`WARTEND_MAX` / `WARTEND_TAGE` in `gsPlans`) | seit v33.59; nicht maschinell geprüft (keine `GS_`-Konstante) | Sie warten gestempelt, bis dasselbe Konto wiederkommt. Wird das Gerät vorher zurückgesetzt, sind sie weg — wie jede lokale Warteschlange. |
| Runtime-Cache (Service Worker) | `RUNTIME_CACHE_MAX` 60, geprüft alle 10 | seit v33.59, in `sw.js` — **nicht** maschinell geprüft | Bis v33.58 legte der Worker jede fremde API-Antwort ungedeckelt ab, und Abmelden räumte sie nicht. |
| Push-Abos je Nutzer | 10 (`ABOS_JE_NUTZER` in `_shared/push_helfer.mjs` = Trigger `fn_push_subs_deckel`) | der Datenbank-Deckel gilt erst nach `20261110_sicherheit_konto_speicher.sql` — **nicht angewandt** | Ohne Deckel verlangsamen tausend Abos eines Kontos jeden Cron-Lauf. |
| KI-Aufrufe je Tag und Function | `KI_GRENZEN` in `_shared/ki_tor.mjs`, gezählt in `feature_usage` unter `ki:<function>` | gilt erst nach Migration UND Auslieferung; die Zahlen sind **gesetzt, nicht gemessen** | Ohne Tor zählte `ai-proxy` nach dem Aufruf (parallele Anfragen lasen denselben Stand), vier Bild-Functions hatten nur eine Stundenbremse, die bei einem Fehler offen blieb. |
| `ai_usage` | **kein Aufräumen** | gemessen 10.11.2026 (Gruppe w1): weder ein Prune noch eine genannte Frist | Wächst mit jeder KI-Anfrage, für immer — und eine Aufbewahrung, die nirgends steht, steht auch nicht in der Datenschutzerklärung. |
| `index.html` | — | **5,8 MB** | Der Preis des Monolithen. `perf_check` trennt App-JS von Parsen/Kompilieren — nur die erste Spalte ist beeinflussbar. |

**Listen-Abfragen an den Server** sind seit v33.44 eingeordnet
(`risiko_check` R2): **80 gedeckelt · 25 Katalog · 13 Einzelzeile · 13
wächst-mit-der-Person** — jede der letzten dreizehn mit einem Grund, warum sie
keinen Deckel hat. Wer eine neue Abfrage baut, ordnet sie ein; sonst meldet der
Prüfstand sie.

> **Mein eigener Messfehler dabei, weil er sich wiederholen wird:** ein Pfad
> wird aus MEHREREN Literalen zusammengesetzt
> (`'…&device_id=eq.' + id + '&limit=' + N`). Wer nur das erste liest, meldet
> `device_readings` als „ohne Deckel", obwohl das `limit=` im zweiten steht.
> `risiko_check` liest den **ganzen ersten Parameter** von `sbFetch(`.

---

## 3 · Was von ANDEREN abhängt

Keines davon lässt sich hier messen — die Claude-Cloud-Umgebung hat kein Netz
dorthin. **Das steht hier ausdrücklich ohne Prüfstand.**

| Wovon | Was daran hängt | Wenn es ausfällt |
|---|---|---|
| **Anthropic** | Scanner, Lina, Planer, Quiz-Generator | Der Offline-Chat (`getSmartAnswer`) antwortet weiter und ist an die Artenliste geerdet (v33.30) — der Scanner nicht. **Und Anthropic schaltet Modelle ab** — das ist kein Ausfall, sondern ein Datum (§1). Ob die Namen der Kette heute antworten, misst von hier niemand: `select model, count(*), max(created_at) from ai_usage group by 1`. |
| **Supabase** | Anmeldung, Sync, Community, Zahlungen | Die App läuft offline aus dem Service Worker; Geschriebenes geht in die Warteschlange (`offline_check`). |
| **Open-Meteo** | Frost, Regen, Wetterwarnung | `_gsWetterTage()` gibt `null` für „nichts geladen" — **Stille ist keine Entwarnung** (v33.36). |
| **swisstopo / OpenStreetMap** | Karte | Kacheln aus dem Cache, sonst leere Karte. |
| ~~cdnjs (pdf.js)~~ | Buch-Einlesen (Admin) | **Seit v33.59 kein CDN mehr:** pdf.js 4.0.379 liegt unter `assets/pdfjs/`, die Schriften unter `assets/fonts/` (vorher Google Fonts bei jedem Start). Die CSP kennt weder cdnjs noch Google. |
| **npm / jsr / esm.sh** | Jede Edge-Function beim Ausliefern | Seit v33.59 nennt jede Import-Angabe eine exakte Version — die Abhängigkeiten der Pakete aber nicht (kein `deno.lock`). Siehe §7. |
| **GitHub Actions** | Die Prüfstände auf jedem PR | Seit v33.59 auf Commit-SHAs festgelegt, nicht auf Tags; `npm ci` gegen `scripts/package-lock.json`. Wer eine Action hebt, liest den SHA selbst (`git ls-remote`). |
| **Ein Supabase-Projekt** | Alles ausser den Karten | Seit v33.59 nennt die CSP genau EIN Projekt in `connect-src`, und die Bild-Prüfung der Datenbank kennt sein Speicher-Präfix als Literal (`fn_gs_bild_url_ok`). Wer das Projekt oder die Speicher-Domain wechselt, ändert `_headers`, `_gsFremdBild` und diese Funktion mit. |
| **Stripe** | Pro / Lifetime | Siehe §4. |
| **Play App Signing** | Die Android-App | Ohne die zwei Fingerabdrücke zeigt Android die Adressleiste (`android_check`, `docs/ANDROID-APK.md`). |

---

## 4 · Was eine ENTSCHEIDUNG braucht (nicht Code)

1. **Bezahlen in der Play-App.** Googles Zahlungsrichtlinie verlangt für
   digitale Güter grundsätzlich Play Billing; GreenScan verkauft über Stripe.
   Play Billing einbauen · die Bezahlfunktion in der App ausblenden
   (`gsLaeuftAlsApp()` steht bereit) · ohne Bezahlung einreichen.
   **Vor dem Einreichen die aktuelle Richtlinie lesen** — von hier aus geht das
   nicht.
2. **Die offenen Migrationen.** `STATUS.md` §2 führt sie einzeln. Zwei davon
   wären bis v33.41 beim Anwenden **gescheitert** (`CREATE OR REPLACE VIEW`
   darf Spalten nur anhängen) — seither rechnet `naht_check` jede Sicht-Migration
   in einem lokalen Postgres nach. **Eine Migration, die man nicht anwendet, hat
   man nicht geprüft.**
3. **Die zweite Auslieferung.** Netlify (`green-scanswitzerland`) liefert
   dasselbe Repo. Wer die PWA von dort installiert, bekommt eine **eigene**
   Instanz mit **eigenem** `localStorage` — andere Herkunft, andere Daten. Für
   Support-Fälle die erste Frage („meine Pflanzen sind weg"). Ob die nackte
   Adresse öffentlich bedient, ist **nicht verifiziert** (CLAUDE.md §2.1).
4. **Datenschutz-Erklärung unter eigener URL.** Der Play Store verlangt sie;
   heute steht sie nur im Footer-Modal.

---

## 5 · Was dieser Prüfstand NICHT kann

- Er zählt aus. Ein Dienst, der abgeschaltet wird, eine Richtlinie, die sich
  ändert, ein Schlüssel, der abläuft — davon sieht er nichts. Deshalb §3 und §4.
- Er liest `index.html`. Zahlen in `sw.js` und in den Edge-Functions prüft er
  nicht (der Bild-Cache steht deshalb in §2 ausdrücklich als ungeprüft).
- Er kennt kein Wachstum der echten Datenbank. Wie schnell `device_readings`
  wirklich wächst, sagt erst das erste Gerät.

## 6 · Wer das liest (seit v33.45)

Dieses Dokument ist ein Inventar — und ein Inventar, das niemand aufschlägt,
ist Speicherplatz (dieselbe Lehre wie die Nutzungsmessung, v33.18). Deshalb
gibt es **`GS_FRISTEN`** in der App: dieselben Fristen, aber sie rechnen sich
selbst aus, und das **Admin-Panel zeigt sie** (Karte „Läuft demnächst ab").

- Ein **Datum** ist GEMESSEN, nicht gerechnet — jeder Eintrag trägt sein
  Messdatum und seine Quelle.
- Eine **Schwelle** rechnet die App live auf dem Gerät.
- Vier Zustände: `ok` · `bald` (ab 80 %) · `faellig` (ÜBER dem Deckel) ·
  **`nicht_bekannt` mit Grund**. **Am Deckel ist der Normalzustand, nicht der
  Alarm** — das Changelog steht bei 20 von 20, und der nächste Bump schiebt
  den ältesten ins Archiv. Ein Alarm, der im Normalzustand steht, ist die
  Zahl, die man zu ignorieren lernt (v32.21).

`risiko_check` R4 liest die **gerenderte Karte**, nicht das Objekt — und
prüft beide Richtungen: jeder Eintrag steht auf dem Bildschirm, und jedes
Datum aus §1 hat einen Eintrag.

---

## 7 · Was die Sicherheitsreparatur v33.59 offen lässt

Die Reparatur selbst steht in `STATUS.md` (jd), die Handgriffe in
`docs/FUER-FERNANDO.md` §30. Hier steht nur, was **mit der Zeit** teurer wird oder
**ein Datum** hat. Keine dieser Zeilen ist maschinell geprüft — die Live-Lage misst von
hier niemand fortlaufend; jede Zahl trägt ihr Messdatum.

| Was | Gemessen | Wächst womit | Was dann passiert | Was es schliesst |
|---|---|---|---|---|
| **Die Server-Reparaturen warten auf Anwendung** | 11.11.2026, nur lesend: 0 von 23 neuen Funktionsnamen live; sieben Funktionen weiter für `authenticated` ausführbar, sieben Policies unverändert | mit jedem Tag | Die Lücken aus den Köpfen der sechs `20261110_*`-Migrationen bleiben live offen. Der Client allein schliesst sie nicht — wer die Datenbank direkt anspricht, umgeht jede Oberfläche. | Anwenden in der Reihenfolge aus §30, danach die lesenden Abfragen dort. |
| **Das öffentliche Repo beschreibt sie** | seit dem Push von v33.59 | mit jedem Tag zwischen Push und Anwendung | Die Köpfe der Migrationen nennen, was live offen steht — und `supabase/` liegt im Web-Root (`noindex` verhindert nur die Indexierung, nicht den Abruf). | Dasselbe: anwenden. Die Befunde wegzulassen hiesse, die Migrationen unprüfbar zu machen. |
| **Kein Lockfile für die Edge-Functions** | 10.11.2026: 68 Import-Angaben exakt, kein `deno.lock`, kein `deno.json` | mit jeder Auslieferung | Das Paket ist fest, seine Abhängigkeiten nicht (stripe → qs, die Unterpakete von supabase-js, die esm.sh-Kette): zwei Auslieferungen desselben Commits können verschiedenen Code laden. | Ein `deno.lock` auf einer Maschine mit Deno ≥ 2 und Supabase-CLI (§30). `edge_check` `40_lieferkette` hält die exakten Angaben. |
| **supabase-js frisch festgelegt** | `@supabase/supabase-js` und `functions-js` 2.119.0, veröffentlicht 04.11.2026 — bei der Festlegung am 10.11. sechs Tage alt | — | Eine frisch veröffentlichte Version kann einen noch nicht entdeckten Fehler oder eine bösartige Änderung tragen; dafür gab es keine Woche Abstand. | Entscheidung: 2.118.0 (15.10.2026) für beide — dann nur die Angaben ändern, nicht den Prüfstand. |
| **Drei Archivdateien werden ausgeliefert** | `docs/_archiv/A_Z_AUDIT_FINDINGS_v28.95.json`, `docs/_archiv/SICHERHEIT_JETZT.sql`, `docs/_archiv/apply_pending_v30_87.sh` (v33.59 aus Root bzw. `scripts/` verschoben) | — | Sie sind über ihre Adresse abrufbar: eine Landkarte alter Befunde, ein SQL- und ein Shell-Skript. | Entfernen, wenn sie nicht ausgeliefert werden sollen; die Historie behält sie ohnehin. |
| **Schlüssel in der git-Historie** | ein NVIDIA-Schlüssel (`nvapi-Pr2M…usrB`) · das alte `X-Admin-Secret` (in einer alten Migration im Repo, live im Rumpf von `fn_knowledge_grow` bis zur Migration) · der Anthropic-Schlüssel war bis 10.11.2026 für jedes Konto lesbar | — | Was einmal öffentlich war, bleibt es. Ein Widerruf ist für keinen der drei belegt. | Beim Anbieter widerrufen bzw. neu erzeugen (Anthropic an BEIDEN Stellen, §30). Die Historie umzuschreiben ersetzt keinen Widerruf. |
| **Quiz-Battles** | Migration geprüft am 10.11.2026: `_gs_battle_fragen_ok` prüft die Form, nicht die Richtigkeit | mit jeder Battle | Der Herausforderer liefert Fragen UND Lösungen; ELO und die Erfolge, die daran hängen, sind nur bedingt verlässlich. | Der Server zieht die Fragen (Entscheidung, `STATUS.md` §2). |
| **Scheinkosten in `ai_daily_usage`** | 10.11.2026, lokal nachgestellt mit der reparierten `fn_log_ai_usage`: eine App-Buchung bis rund 4,32 CHF, jeder frei gewählte Name eine neue Zeile | mit jeder Buchung | Die Zeilen tragen `client…` und sind von den Server-Zeilen getrennt — die Summen im Admin-Panel bleiben trotzdem verfälschbar. Negative Kosten und fremde Server-Namen sind verhindert. | Namen auf eine feste Liste; endgültig erst mit dem reinen Proxy-Weg. |

---

**Wer eine Frist oder einen Deckel einführt, trägt ihn hier ein** — und wenn er
als Konstante im Quelltext steht, mit der Schreibweise `` `GS_X` = **n** ``,
damit R3 ihn gegen den Quelltext halten kann. Eine Doku, die nichts erzwingt,
wächst nicht mit (v32.21).
