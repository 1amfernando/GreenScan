# Was später schiefgeht — gemessen, nicht vermutet

> Anlass: Fernandos „Detektiere probleme die später auftauchen könnte und bringe
> da 1a Lösungen." Die sechsunddreissig anderen Prüfstände fragen, ob die App
> **heute** stimmt. Dieses Dokument fragt, was an einem **Datum** oder an einer
> **Grösse** aufhört zu stimmen — und niemandem auffällt, weil es heute noch
> geht.
>
> **Stand: 16.09.2026 (v33.44).** Jede Zahl hier ist gemessen; wo sie aus einer
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
| **Quiz-Vorrat erschöpft** | **16.06.2027** | 14.09.2026, `quiz_gen_check`: 181 freie Fragen, Zulauf 12 je 35 Tage, Verbrauch 1/Tag → −0,657/Tag | `fn_get_daily_quiz` wiederholt über ihren Rückfall — **ohne dass etwas meldet** | Migration `20260914_quiz_vorrat.sql` anwenden (misst den Vorrat, warnt unter 60 Fragen nach `system_events`). **Nicht angewandt.** |
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
| **Anthropic** | Scanner, Lina, Planer, Quiz-Generator | Der Offline-Chat (`getSmartAnswer`) antwortet weiter und ist an die Artenliste geerdet (v33.30) — der Scanner nicht. |
| **Supabase** | Anmeldung, Sync, Community, Zahlungen | Die App läuft offline aus dem Service Worker; Geschriebenes geht in die Warteschlange (`offline_check`). |
| **Open-Meteo** | Frost, Regen, Wetterwarnung | `_gsWetterTage()` gibt `null` für „nichts geladen" — **Stille ist keine Entwarnung** (v33.36). |
| **swisstopo / OpenStreetMap** | Karte | Kacheln aus dem Cache, sonst leere Karte. |
| **cdnjs (pdf.js)** | Buch-Einlesen (Admin) | **Der einzige CDN-Rest.** Zwei Adressen (`pdf.min.mjs`, `pdf.worker.min.mjs`), erst bei Bedarf geladen (v32.79). Fällt cdnjs aus, geht nur dieses eine Admin-Werkzeug nicht. Alles andere liegt selbst gehostet unter `assets/`. |
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

**Wer eine Frist oder einen Deckel einführt, trägt ihn hier ein** — und wenn er
als Konstante im Quelltext steht, mit der Schreibweise `` `GS_X` = **n** ``,
damit R3 ihn gegen den Quelltext halten kann. Eine Doku, die nichts erzwingt,
wächst nicht mit (v32.21).
