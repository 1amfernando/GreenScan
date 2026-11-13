# IDEE-A · Blickwinkel Alltag — Runde 1 (Sichten)

Stand: `main` = v33.58, nur gelesen, nichts geändert. Gemessen am 11.11.2026 mit
`grep`, `node` (Daten aus `index.html` herausgelöst) und einem Lauf von
`scripts/versprechen_check.js`. Kein Browser-Lauf, kein Netz, keine KI — wo eine
Aussage nur auf Quelltext steht, steht das dabei.

Acht Ideen, jede an einem Moment aufgehängt, nicht an einer Funktion. Die drei
mit ★ haben mich beim Sichten selbst überrascht — nicht, weil sie gross sind,
sondern weil die App dafür fast alles schon hat und es trotzdem niemand tut.

| # | Titel | Moment | Flag |
|---|---|---|---|
| 1 | Rückkehr-Runde | nach drei Wochen Ferien | `gs_feat_rueckkehr` |
| 2 | Kontroll-Gang | am Waldrand mit einem Pilz | `gs_feat_kontrollgang` |
| 3 | ★ Keimprobe | im Januar | `gs_feat_keimprobe` |
| 4 | ★ Winterschlaf | der Moment vor dem Löschen (November) | `gs_feat_winterschlaf` |
| 5 | ★ Rechenschaft | Sonntagabend, die Woche planen | `gs_feat_rechenschaft` |
| 6 | Nachruf mit Lehre | eine Pflanze ist eingegangen | `gs_feat_nachruf` |
| 7 | Die Fingerprobe zählt | 7:30 auf dem Balkon | `gs_feat_fingerprobe` |
| 8 | Notfallblatt | ein Kind im Haus, morgen hütet jemand anders | `gs_feat_notfallblatt` |

## Was es schon gibt — deshalb hier NICHT vorgeschlagen

Gesichtet, mit dem Namen, unter dem man es findet:

- **Tagesplan** „Heute zu tun" mit drei Zeilen, Regen- und Sensor-Vermerk (`gsRenderDayPlan`), Notizzettel, Glocke.
- **Die Woche**: ein Satz voraus (`_gsKalWocheZeile`), ein Rückblick („Deine Woche", `gsWochenrueckblick`).
- **Ferien, Hinweg**: Giess-Zettel zum Drucken (`gsGiessZettel`), Stille Tage (`gsPushPause`), R9 im Kalender („fällt in deine Stillen Tage").
- **Wetter trifft Aufgabe**: Regen übernimmt Giessen — nur GEMESSENER Regen (`_gsRegenUebernimmt`), Frost × Aussaat (R1), Frost × frostempfindlich draussen (R6), vier Schwellen (`GS_WETTER_GRENZEN`).
- **Pilz**: rotes Vollbild, Verwechsler mit Risiko-Stufe, VAPKO-Kasten (`gsMushroomVapkoBox`), Gegenprobe (`gsScanGegenprobe`), „Ohne Netz eingrenzen" (`gsEingrenzen`).
- **Sonst**: Pflanzenfriedhof mit Freitext, Saatgut-Inventar mit Ablaufdatum, Säkalender mit Merkliste, Mein Naturjahr, Üben, Tages-Quiz, Serie, Abzeichen, Klassen, Lichtmesser, Messwerte von Hand, Meldungs-Budget, Lina mit Notfall-Erkennung.

---

## 1 · Rückkehr-Runde — „Hat jemand gegossen?" statt vierzehn roter Zeilen

**Der Moment.** Sonntagabend nach drei Wochen Ferien, der Koffer steht noch im
Flur; sie öffnet die App zum ersten Mal seit dem 20. Juli.

**Was heute passiert (gemessen).** `gsRenderDayPlan` zeigt „Heute zu tun · N
Aufgaben", die drei ältesten zuerst, jede mit „Seit 21 Tagen fällig"
(`_gsDayPlanWhen`). Der Giess-Zettel sagt es selbst: „Was sie giesst, steht nicht
in der App — die Aufgaben bleiben stehen, bis du zurück bist und abhakst."
Abhaken setzt aber `lastDone = jetzt` (`gsQuickDone`, auch „Alle erledigt") — das
stimmt nicht, wenn die Nachbarin vor drei Tagen gegossen hat. Die App empfängt
die Person mit einem Stapel Vorwürfe und zwei falschen Antworten.

**Was passiert.** EINE Karte ersetzt den Stapel: „Seit 21 Tagen wurde nichts
abgehakt — 20 Fälligkeiten sind aufgelaufen." Die App behauptet nicht, sie sei
weg gewesen; sie sagt, was sie weiss. Darunter eine Frage: „Warst du weg, und
hat jemand für dich gegossen?" — [Ja, nach Plan] · [Zum Teil] · [Nein].
- **Ja:** je Aufgabe rückt `lastDone` auf den letzten planmässigen Termin VOR
  heute (`lastDone + ⌊(heute − 1 − lastDone) / Intervall⌋ · Intervall` — dieselbe
  Fortschreibung, mit der `gsGiessZettel` seine Zeilen baut). Vorher eine
  Rückfrage mit VORHER/NACHHER, danach je Pflanze EIN Tagebuch-Eintrag
  `quelle: 'hand'` mit dem Wortlaut „in deiner Abwesenheit gegossen (deine
  Angabe)". Übrig bleibt, was heute wirklich dran ist.
- **Zum Teil / Nein:** ein Rundgang, Pflanze für Pflanze, in gerechneter
  Reihenfolge (Tage überfällig ÷ Intervall; draussen mit Regen weiter hinten),
  je drei Knöpfe: „sieht gut aus" · „jetzt gegossen" · „hat es nicht geschafft"
  (→ Idee 6).
- Darüber, wenn es Wetterdaten gibt: „In der Zeit: 38 mm Regen, 5 Hitzetage,
  kein Frost (Wetterdienst)". Ohne Daten: „Wetter in deiner Abwesenheit: nicht
  bekannt" — nie Stille.

**Warum neu.** `grep -c -i "rueckkehr\|rückkehr" index.html` → 14, alle im
Update-Weg (`_gsUpdateBeiRueckkehr`), in Release-Notizen oder Wochentexten;
`gsRenderDayPlan` hat keinen Zweig für eine lange Pause. `grep -c "past_days"
index.html` → 1 (`&past_days=3`, Pilz-Vorhersage) — der Wetter-Lader
`fetchWeather` holt nur voraus. `grep -n "gsPushPause(" index.html` → 3, 7, 14
Tage: drei Wochen lassen sich nicht einmal einstellen (Befund auf dem Brett).

**Worauf es aufbaut.** `p.tasks[k].lastDone` (das jüngste über beide Listen),
`gsGiessZettelFenster` (`gs_push_settings.pauseUntil`), `gsGetDueTasks`,
`_gsTaskDays`, `gsGiessZettel`, `_gsPflanzeFinden`, `gsConfirmModal`,
`gsTagebuchSave`, `gsPflanzeDraussen`, `moveToCemetery`, `gsRenderDayPlan`.

**Kleinste erste Scheibe.** Karte + Frage + „Ja, nach Plan" — ohne Wetter, ohne
Rundgang. Auslöser aus den Aufgaben selbst gerechnet: das jüngste `lastDone`
aller aktiven Aufgaben liegt ≥ 7 Tage zurück UND ≥ 3 Aufgaben haben
`days < 0`. Bewusst nicht `gs_last_login`: wer in den Ferien eine Palme scannt,
hat die App geöffnet. Kein neuer Schlüssel.

**Woran man es prüft.** `kalender_check`, neuer Fall „Rückkehr" (Uhr gestellt):
drei Pflanzen mit Intervall 2, 3, 7, alle `lastDone` = heute − 22. Erwartet
vorher: 1 Karte, 0 Zeilen „Seit … fällig" im Tagesplan, Zahl in der Karte **20**
(10 + 7 + 3). Nach „Ja": `lastDone` = heute −2 / −1 / −1, und
`gsGetDueTasks().filter(days <= 0).length` = **1** statt 3. Gegenrichtungen:
eine der drei Aufgaben gestern abgehakt → keine Karte; alles alt, aber nichts
überfällig → keine Karte; „Abbrechen" in der Rückfrage → 0 geänderte Felder.
Gegenprobe: `lastDone = jetzt` statt des letzten Termins → die Zahl wird 0 statt
1 → rot. Dazu `save_check` (`WEGE`: der neue Speicherweg kommt an).

**Risiko.** (a) `lastDone` zu setzen ist genau die Stelle, an der v32.46
„pausieren statt fälschen" gelernt hat — deshalb nur auf ausdrückliche Angabe,
mit Rückfrage und mit einem Eintrag, der sagt, dass es eine Angabe ist. (b)
Wann jemand nicht zu Hause war, ist heikel (revDSG): kein Datum und keine Dauer
in ein Ereignis, höchstens ein Zähler `{antwort}` im Vokabular `GS_EVENTS`;
nichts in die Community. (c) Der Pflege-Verlauf hat eine Lücke (Befund IDEE-B:
`doneTask` schreibt keinen Verlaufseintrag) — die Karte rechnet deshalb nur mit
`lastDone`, nie mit dem Tagebuch. (d) Keine KI: Reihenfolge und Zahlen rechnet
der Code.

---

## 2 · Kontroll-Gang — der Pilz geht zuerst zur Kontrolle, und die App packt den Zettel

**Der Moment.** Samstag, 16 Uhr, Waldrand, es nieselt. Sie hält einen Pilz in
der Hand; die App sagt „✅ Speisepilz · 78 %", zwei Zeilen tiefer „☠️
LEBENSGEFAHR: Grüner Knollenblätterpilz".

**Was heute passiert (gemessen).** `gsMushroomRenderResult` zeigt bei
`speisepilz` sofort „🍳 Zubereitung" und daneben „🔒 VAPKO-Kontrolle empfohlen"
(`gsMushroomVapkoBox`: Stelle, Telefon, Link — wenn der Server sie schickt).
Das Ergebnis wird nirgends festgehalten: zwischen `gsMushroomRunScan` und
`gsShowMushroomDangerOverlay` 0 Schreibzugriffe. Wer das Fenster schliesst, hat
nichts mehr in der Hand — ausser dem Pilz.

**Was passiert.** Unter dem Ergebnis EIN Knopf: „Für die Pilzkontrolle
sichern".
1. Vier geführte Fotos — Hut von oben · Unterseite · ganzer Stiel mit Basis
   („ausgraben, nicht abschneiden") · Fundstelle mit Begleitbaum. Die Liste ist
   fest, kein KI-Text; ein fehlendes Foto steht als „fehlt" auf dem Zettel.
2. Der Fund wird ein Eintrag im Zustand **wartet auf Kontrolle**: Datum,
   Gemeinde, die Vermutung der App, ALLE genannten Verwechsler mit Stufe.
3. Ein **Kontrollzettel** zum Zeigen oder Drucken. Oben in Grossschrift:
   „NICHT GEPRÜFT — Vermutung einer App." Dann Fotos, Vermutung, Verwechsler,
   ein leeres Feld für das Urteil — und der Satz „Bring den ganzen Pilz mit."
4. Solange der Fund wartet, steht statt „🍳 Zubereitung": „Zubereitung zeigen
   wir nach der Kontrolle." Die App sagt nie selbst „kannst du essen".
5. Danach trägt die Person das Urteil ein (freigegeben · nicht freigegeben ·
   nicht hingegangen). „Nicht freigegeben" kann sie als Korrektur melden.

**Warum neu.** `grep -c -i "kontrollzettel\|wartet_auf_kontrolle\|kontrollgang\|gs_pilzfund" index.html`
→ 0. Kein Prüfstand kennt die Pilz-Karte:
`grep -l -i "gsMushroom\|mushroom-result\|edibility\|safety_color" scripts/*.js scripts/*.py`
→ 0 Dateien (Befund auf dem Brett).

**Worauf es aufbaut.** `gsMushroomRenderResult` (`j.lookalikes`,
`j.matched_slug`, `j.confidence`), `gsMushroomVapkoBox`, die Edge-Function
`mushroom-identify` (`vapko_kontrollstelle`, `vapko_phone`), `gsAddMultiShot` /
`gsRelabelMultiShot` (mehrere beschriftete Fotos), `gsDrucken` +
`_gsDateiAngekommen`, `gsOpenMyFinds` + `_gsFundZeit`, `gsGetRegionContext`,
`gsReportScanMistake`.

**Kleinste erste Scheibe.** Nur der Zettel (Punkt 3) aus dem vorhandenen
Ergebnis und dem EINEN vorhandenen Foto — kein neuer Speicher, kein Zustand.

**Woran man es prüft.** `scan_check`, neue Fallgruppe „Pilz-Karte /
Kontrollzettel" mit gestellter Server-Antwort (Speisepilz, 78 %, zwei
Verwechsler, einer `sehr_hoch_lebensgefahr`): das HTML, das an `gsDrucken`
geht, enthält **2 von 2** Verwechsler-Namen, „NICHT GEPRÜFT" **1×**, und **0**
Zusage-Sätze ausserhalb der Zeile „Vermutung der App" — gezählt nach der Regel
von `_gsLinaSicherheit` (ihr Muster `STAMM`: essbar · geniess · verzehr ·
speise · unbedenklich; ein Satz mit Verneinung zählt nicht). Gegenrichtungen: Antwort „tödlich" → Zettel trägt ☠️;
kein Foto → „Foto fehlt" statt leerem Rahmen. Dazu `apk_check` (Liste
`EXPORTE` +1, sonst rot „kam über das Netz") und `escape_check` (der Pilzname
aus der Server-Antwort ist Fremdtext).

**Risiko.** (a) Der Zettel darf nie wie eine Freigabe aussehen — darum die
Kopfzeile und die 0 als Prüfstands-Zahl. (b) Das eingetragene Urteil ist eine
Angabe der Person, kein Nachweis: privat, nie ein Abzeichen, schaltet nur die
Zubereitungszeile dieses EINEN Funds frei. (c) Fundorte sind Standortdaten und
bei Pilzlern Geheimnis: auf dem Zettel die Gemeinde, nie die Koordinate; nichts
verlässt das Gerät ohne Antippen. (d) Befund IDEE-C beachten: nie rechnen „der
Verwechsler hat gerade keine Saison". (e) Nicht geprüft (keine Recherche in
meinem Auftrag): ob Kontrollstellen Fotos sehen wollen — der Zettel ersetzt den
Pilz nicht, er spart das Erklären.

---

## 3 · ★ Keimprobe — zehn Samen auf Küchenpapier, und die App rechnet mit dem Ergebnis

**Der Moment.** Ein Sonntag im Januar, draussen wächst nichts. Er findet die
Schuhschachtel mit den angebrochenen Samentütchen von 2023.

**Was heute passiert (gemessen).** Das Inventar kennt je Tütchen
`{name, qty, expires, ts}`. Ist es abgelaufen, sagt die Leiste „Abgelaufen: … —
Keimfähigkeit prüfen oder ersetzen." (`gsJetztDranRender`) — und bietet keinen
Weg dazu. Wie man prüft, steht einmal im Jahr in einem Wochentext (KW 7).

**Was passiert.** Am Tütchen ein Knopf „Keimprobe starten": „Leg 10 Samen auf
feuchtes Küchenpapier und deck sie zu." Die App trägt den Start ins Tagebuch
ein und setzt EINEN Kalender-Eintrag „Keimprobe Tomate zählen" auf Starttag +
obere Keimdauer aus den Kulturdaten (`germ:'6–10 Tage bei 22°C'` → Tag 10).
Am Zähltag fragt sie: „Wie viele von 10 sind gekeimt?" — und rechnet drei
Zustände: 8–10 „keimt gut — normal säen" · 5–7 „keimt schwächer — dichter säen
(10 ÷ n)" · unter 5 „ersetzen" (die 50 % stehen schon im eigenen Wochentext).
Nie gezählt: „nicht bekannt". Das Ergebnis steht danach am Tütchen („7 von 10
am 19.1."), und der Planer sagt „hast du, keimt 7 von 10" statt nur „hast du".
*Mit Kind:* vorher tippt jeder, wie viele kommen; am Zähltag stehen Tipps und
Ergebnis nebeneinander.

**Warum neu — und warum sie mich überrascht.** `grep -c -i "keimprobe" index.html`
→ 0; `grep -c -i "keimtest" index.html` → 1 (der Wochentext). Die App hat die
Tütchen, die Keimdauer (`grep -c "germ:'" index.html` → 39, eine je Kultur; 37
davon als Spanne „a–b Tage" lesbar, Zwiebeln und Tulpen tragen Text),
den Kalender und den Planer — und zwischen ihnen fehlt genau ein Knopf. Es ist
die einzige Messung, die man im Januar machen kann: Erkennen → Messen →
Verstehen → Handeln, ohne Sensor.

**Worauf es aufbaut.** `gs_seed_inventory` (`gsOpenSeedInventory`, `gsSeedAdd`),
`GS_SAE_DB[].germ`, der Kultur-Abgleich in `gsSaatgutJetzt`, `gsTagebuchSave`
(ein Termin ist ein datierter Tagebuch-Eintrag, KALENDER-V2 §10; in der Zukunft
erscheint er als `erinnerung`), `gsKalenderEreignisse`, `_gsPlanSaatgut`.

**Kleinste erste Scheibe.** Knopf + Start-Eintrag + Zähl-Erinnerung + Ergebnis
am Tütchen. Kein neuer Schlüssel: das Ergebnis ist ein Feld am Inventar-Eintrag
(`keim: {n, von, am}`), und `gs_seed_inventory` reist schon. Planer-Anschluss:
zweite Scheibe.

**Woran man es prüft.** `kalender_check`, neuer Fall „Keimprobe" (Uhr
gestellt): Tütchen „Tomate" → nach dem Start genau **1** `erinnerung` am Tag
**+10**; Gegenprobe mit der unteren Zahl → Tag +6 → rot. Tütchen ohne Treffer in
`GS_SAE_DB` oder mit unlesbarer Keimdauer (Zwiebeln: „Steckzwiebeln sofort") →
**0** Erinnerungen, bis die Person einen Tag wählt (kein geratener Tag). Ergebnis 7 → Text nennt „7 von 10" und den Faktor; Ergebnis 4 →
„ersetzen". `save_check` (der Eintrag „Saatgut" in `WEGE` bekommt das Feld),
für Scheibe 2 `planer_check`.

**Risiko.** (a) Zehn Samen sind eine kleine Stichprobe: die Anzeige sagt „7 von
10", nie „70 % Keimfähigkeit" als Eigenschaft der Sorte. (b) Der Abgleich
Tütchen → Kultur ist heute ein Teilstring (`c.indexOf(w) === 0 ||
n.indexOf(c) === 0`); für eine Erinnerung reicht das nur, wenn die getroffene
Kultur dasteht („Keimdauer von: Tomaten"). (c) Vorher den Monatsversatz in
`gsSaatgutJetzt` reparieren (Befund auf dem Brett, GARTEN hat ihn). (d) Keine
Personendaten, keine KI.

---

## 4 · ★ Winterschlaf — die App sagt selbst, dass die Saison vorbei ist, und wann sie sich wieder meldet

**Der Moment.** Ein Dienstag Mitte November. Die Glocke zeigt 9, zuoberst
„Tomate giessen · Seit 34 Tagen fällig" — die Tomaten liegen seit Oktober auf
dem Kompost. Der Daumen bleibt auf dem App-Symbol, „App entfernen" erscheint.

**Was heute passiert (gemessen).** Garten-Pflanzungen bekommen ihre Aufgaben
auf Dauer (`GS_PFLANZUNG_VORGABEN`: Freiland giessen alle 3, düngen alle 30,
prüfen alle 7 Tage; `gsPflanzungAufgabenNachruesten`). `gsGetDueTasks` kennt
weder Monat noch Kultur-Ende. „Stille Tage" bietet 3, 7 oder 14 Tage und stellt
dabei ALLE Mitteilungen ab, auch Frost (`fn_push_already_sent_today` in
`v28_11_push_pause.sql`: „skip ALLE Kategorien"). Im Januar mahnt die App also
jeden dritten Tag, ein leeres Beet zu giessen — oder sie schweigt ganz.

**Was passiert.** Zwischen Oktober und Februar, einmal je Saison, steht im
Tagesplan statt des Stapels: „Die Saison von Tomaten, Zucchini und Buschbohnen
ist laut Aussaatkalender vorbei (letzter Erntemonat Oktober). Ruhen lassen?" —
[Ja, bis zum Frühling] · [Noch nicht]. Bei Ja ruhen die Aufgaben dieser
Pflanzungen bis zum ersten Aussaatfenster derselben Kultur — geschrieben als
`snoozedUntil`, dieselbe Regel wie Verschieben: nichts wird als erledigt
gefälscht. Dazu ein Tagebuch-Eintrag „Saison beendet". Die Startseite sagt
danach EINEN Satz: „Dein Garten ruht. Ich melde mich am 1. Februar: Tomaten
vorziehen. Bis dahin nur bei Frost für das, was draussen bleibt." Mehrjähriges,
Zimmerpflanzen und alles ohne Kulturdaten bleibt, wie es ist („nicht bekannt,
ob die Saison vorbei ist — bleibt aktiv").

**Warum neu — und warum sie mich überrascht.**
`grep -c -i "saisonende\|saison beendet\|abgeräumt\|ruht_bis" index.html` → 0;
`grep -c -i "winterschlaf" index.html` → 5: vier Wochentexte (Igel, Alpenflora)
und ein Kommentar über dem Überwinterungs-Text des Offline-Chats. Ich hatte
nach einer Idee gegen das Löschen gesucht und einen Grund dafür gefunden: die
App weiss, wann Tomaten geerntet werden (`harvest:[6,7,8,9]`), und mahnt
trotzdem im Januar. Eine App, die von sich aus sagt „ich bin jetzt still, und
zwar bis dann" — mit einem Datum, das sie gerechnet hat — kenne ich nicht.

**Worauf es aufbaut.** `_gsSaeZuPflanze(p)` → `GS_SAE_DB[].harvest`,
`gsAussaatEreignisse(von, bis)` (das erste Fenster ist der Wecktermin),
`snoozedUntil` in `getDaysUntilDue` / `_gsTaskDays`, `gsGetDueTasks`,
`_gsKalPruefwerk` R6 (bleibt aktiv), `gsRenderDayPlan`, `gsTagebuchSave`,
`_gsBeetHistorie` (die Pflanzung bleibt für die Fruchtfolge stehen), die Sicht
`v_plant_tasks_due`.

**Die Regel, gerechnet.** „Vorbei" heisst: die erste zusammenhängende Folge von
Erntemonaten NACH dem Pflanzdatum ist zu Ende (Dezember → Januar zählt als
zusammenhängend). Tomate, gepflanzt im Mai: Juli–Oktober → im November vorbei.
Knoblauch, gesteckt im Oktober: Ernte Juni bis August → läuft. Winterporree
(`harvest:[8,9,10,11,0]`): bis Januar → läuft. Kein Pflanzdatum oder keine
Kultur → nicht bekannt.

**Kleinste erste Scheibe.** Angebot + Ruhen + der eine Satz, nur für
Pflanzungen mit Treffer in den sechs Gemüse-Kategorien von `GS_SAE_DB` (29 von
39 Kulturen). Kräuter und Blumen bleiben draussen: Schnittlauch und Tulpen
sind mehrjährig, und die Liste hat kein Feld dafür. Kein neuer Schlüssel
(`snoozedUntil` gibt es; ein Feld `saison` an der Pflanzung reist mit dem
Garten).

**Woran man es prüft.** `kalender_check`, neuer Fall „Winterschlaf", Uhr auf
den 15. November: Pflanzung „Tomate" (Freiland, Mai, Giessen überfällig) und
„Rosmarin". Erwartet: das Angebot nennt **1** Kultur (Tomaten, nicht
Rosmarin); nach „Ja" enthält `gsGetDueTasks()` **0** Einträge der Tomate und
weiter ≥ 1 des Rosmarins; `gsKalenderEreignisse` für Februar enthält „Tomaten
vorziehen (drinnen)" — der Wecktermin ist dieselbe Rechnung, kein Text.
Gegenrichtungen: Uhr 15. Juni → kein Angebot; Knoblauch vom Oktober → nicht im
Angebot; „Noch nicht" → 0 geänderte Felder und kein zweites Angebot in
derselben Saison. Server-Seite: `naht_check` (App und Sicht zählen dieselben
Aufgaben).

**Risiko.** (a) Der Server kennt `snoozedUntil` erst nach
`20260903_plant_tasks_due_snooze.sql`; ist sie nicht angewandt, ruht die App
und der Giess-Push kommt trotzdem — das gehört in den Bericht der Scheibe, vom
Head lesend zu messen. (b) Frost-Schweigen wäre der teuerste Fehler dieser App
(v33.36): darum NICHT über „Stille Tage" bauen. (c) Ein falsches „vorbei" bei
Überwinterndem: deshalb die Regel mit dem Pflanzdatum, und das Angebot nennt
jede Kultur beim Namen. (d) Der Join Pflanze → Kultur reisst an manchen Namen
(Befund IDEE-C: 10 von 40 Gemüse-Einträgen) — die bleiben aktiv, mit Grund. (e)
Nichts wird aus dem Verhalten erraten: Auslöser ist der Kalender, nicht „du
öffnest die App selten".

---

## 5 · ★ Rechenschaft — „Hatte ich recht?"

**Der Moment.** Sonntagabend, sie plant die Woche. Im Kalender steht
„Zucchini — Ernte voraussichtlich 16.10." Sie denkt: Das hat doch letztes Mal
auch nicht gestimmt. Warum soll ich es diesmal glauben?

**Was heute passiert (gemessen).** R4 im Kalender-Prüfwerk hält Schätzung und
Ernte-Buch nebeneinander („Ernte eingetragen am …" · „seit N Tagen
voraussichtlich erntereif — noch keine Ernte eingetragen"). Den Abstand rechnet
niemand, und niemand merkt sich, wie oft die App richtig lag.

**Was passiert.** Jede Vorhersage, die sich später nachprüfen lässt, wird
abgerechnet — sichtbar, in Zahlen. Erste Art: die Ernte-Schätzung.
- Am Ereignis: „Schätzung 16.10. (60 bis 90 Tage) · erste Ernte am 21.10. · in
  der Spanne, 5 Tage nach der Mitte."
- Sonntags in „Deine Woche": „Meine Ernte-Schätzungen bei dir: 3 abgerechnet —
  Tomate +5, Zucchini +6, Salat −1 Tage. 2 offen. 1 nicht bekannt (Ernte ohne
  Pflanzenname)."
- An der NÄCHSTEN Schätzung derselben Kultur: „bei dir bisher 5 und 6 Tage
  später." Die Schätzung selbst wird nie still verschoben.

Später dieselbe Bauart für Frost (Vorhersage gegen Tagesminimum) — und mit
einem Sensor wird aus „laut Wetterdienst" „an deinem Beet".

**Warum neu — und warum sie mich überrascht.**
`grep -c -i "eingetroffen\|rechenschaft\|gs_vorhersage" index.html` → 0. Das
Repo verlangt von jeder Anzeige, zu sagen, woher sie etwas weiss (Regel 10). Den
Schritt danach — zu sagen, wie oft sie damit recht hatte — macht keine
Pflanzen-App, die ich kenne. Und er passt genau auf den Leitsatz: „Nicht mehr
raten" gilt auch für die Frage, ob man der App glauben soll.

**Worauf es aufbaut.** `gsKalenderEreignisse` (Ernte mit `quelle: 'regel'` aus
`_gsKulturZuPflanze`, Pflanzdatum + Mitte aus `minDays`/`maxDays`; Ernte mit
`quelle: 'hand'` aus `gsErnteLoad`), `_gsKalPruefwerk` R4 (dieselbe Zuordnung
über `plant_local_id` oder Name), `_gsKalHinweis`, `gsWochenrueckblick` /
`gsRenderWochenrueckblick`, `gsLinaZahlen` (eine Zeile für Lina). Für Frost:
`_gsWetterTage`, `gsMesswerte(g.id, 'air_temp')`, OEKOSYSTEM §11 Idee 10.

**Kleinste erste Scheibe.** Der Abstand im Grund des Ernte-Ereignisses,
gerechnet aus dem, was schon da ist — kein neuer Speicher. Die Wochenzeile ist
die zweite Scheibe.

**Woran man es prüft.** `kalender_check`, neuer Fall „Abrechnung", drei
Zustände aus dem gerenderten HTML: Pflanzung mit Schätzung 16.10. und zwei
Ernte-Einträgen (21.10., 3.11.) → „5 Tage" (die ERSTE Ernte zählt — R4 nimmt
für seine Zeile die neueste; Gegenprobe mit der neuesten → 18 → rot). Ohne
Ernte → „offen", keine Zahl. Ernte-Zeile ohne Pflanzenname → „nicht bekannt".
`sensor_check` „Lina": die Zahl in Linas Zeile steht in einem Datensatz.

**Risiko.** (a) Ein Ernte-Eintrag ist der Tag des EINTRAGENS, nicht der Reife:
die Zeile sagt „erste Ernte am", nie „reif am". (b) Zwei Abrechnungen sind kein
Mittelwert — unter drei nur Einzelwerte, kein „im Schnitt". (c) Abgerechnet
wird nur die Kalender-Rechnung. Die Garten-Seite rechnet dieselbe Frage anders
und mit einem erfundenen Rückfall (Befund auf dem Brett: „Rose" trifft
Rosenkohl) — die muss vorher weg, sonst rechnet die App eine Zahl ab, die sie
woanders nicht gezeigt hat. (d) Beim Frost kommen Vorhersage und „Messung" vom
selben Dienst: das ist die Abrechnung des Wetterdiensts am Gitterpunkt und
muss so heissen. (e) Keine KI; keine Daten ausser dem Ernte-Buch.

---

## 6 · Nachruf mit Lehre — was die Daten über ihr Ende sagen

**Der Moment.** Mittwochabend, das Basilikum am Küchenfenster ist schwarz. Sie
tippt auf „entfernen" und denkt: Und dafür habe ich eine App.

**Was heute passiert (gemessen).** `moveToCemetery` fragt „Todesursache?" mit
dem Zusatz „Optional — hilft dir beim nächsten Mal." und legt Freitext in
`p.deathCause` ab. `grep -c "deathCause" index.html` → 3: schreiben, beim
Zurückholen löschen, im Friedhof anzeigen. Beim nächsten Mal liest es niemand
(Befund IDEE-B). Und der Weg kennt nur `myPlants`, keine Garten-Pflanzung.

**Was passiert.** Vor dem Verabschieden EIN Blatt mit höchstens drei Zeilen —
jede gerechnet, jede mit drei Zuständen:
- **Giessen:** „In den letzten 30 Tagen 4 von 10 fälligen Terminen abgehakt,
  zuletzt vor 9 Tagen" · „regelmässig abgehakt" · „nicht bekannt — kein
  Verlauf".
- **Licht:** „Gemessen 400 lx am 3.9. — die Art braucht laut Liste mindestens
  2'000 lx" · „passt" · „nicht bekannt — nie gemessen".
- **Wetter** (nur draussen): „2 Frostnächte in den letzten 14 Tagen,
  frostempfindlich laut Kulturdaten" · „keine" · „nicht bekannt".

Darunter die Frage an sie: „Was denkst du?" — vier Antippwörter und das
Freitextfeld. Die App sagt nie „die Ursache war …"; sie legt hin, was sie
weiss. Und sie löst das Versprechen ein: Wird später dieselbe Art oder derselbe
Platz neu angelegt, steht im Formular EINE Zeile — „Letztes Mal hier: 4 von 10
Giessterminen, 400 lx. Alle 2 statt 3 Tage giessen?" — übernehmen nur per
Antippen.

**Warum neu.** Der Friedhof sammelt einen Satz und tut nichts damit (siehe
oben, 3 Treffer). Eine gerechnete Zeile gibt es dort nicht:
`grep -n "function moveToCemetery" -A 12 index.html` zeigt Rückfrage, zwei
Zuweisungen, Speichern.

**Worauf es aufbaut.** `moveToCemetery`, `renderCemetery`, `gs_dead_plants`,
`_gsPflanzeFinden`, `p.tasks[k].lastDone` / `intervalDays`, `gsTagebuchAlle`
(`quelle: 'regel'` = abgehakt; das ist heute nur `source: 'quick_done'`),
`gsResolvePlantLightRange`, `_gsPflanzeGeraete` + `gsMesswerte` (Licht),
`gsPflanzeDraussen`, `_gsWetterTage`, `_gsKalPruefwerk` R6, `_gsArtZuPflanze`.

**Kleinste erste Scheibe.** Nur die Giess-Zeile im Abschied, mit ihren drei
Zuständen, plus Antippwörter. Die Einlösung beim Wieder-Anlegen ist die zweite
Scheibe.

**Woran man es prüft.** `save_check` (neuer Weg „verabschieden": Ursache und
gerechnete Zeile kommen in `gs_dead_plants` an) und ein Fall in
`kalender_check` (dort steht die Uhr): Pflanze mit Intervall 3, im Fenster 10
Fälligkeiten, 4 Verlaufseinträge `quelle: 'regel'` → „4 von 10". Ohne Verlauf →
„nicht bekannt", nie „0 von 10". Gegenprobe: Handnotizen mitzählen → 5 statt
4 → rot (dieselbe Unterscheidung wie v33.40).

**Risiko.** (a) Der Verlauf hat eine Lücke: `doneTask` schreibt keinen Eintrag
(Befund IDEE-B) — wer dort abhakt, bekäme „4 von 10" zu Unrecht. Erst der dritte
Erledigt-Weg in den Verlauf, dann diese Scheibe; bis dahin „nicht bekannt". (b)
Ton: kein Vorwurf, keine Note. „Nicht bekannt" wird häufiger dastehen als eine
Zahl, und das ist in Ordnung. (c) Zusammenhang ist keine Ursache — das Wort
„Ursache" kommt von der Person, nie von der App. (d) Die Licht-Zeile wird
selten etwas wissen: der Lichtmesser merkt sich nur den letzten Wert
(`gs_light_pro10_latest`), nicht die Pflanze — ein Lichtwert zählt nur, wenn
er an einem Gerät dieser Pflanze hängt. Und eine Empfehlung „für diesen Platz
besser …" bleibt draussen: nur 40 Arten tragen `lightMin`.

---

## 7 · Die Fingerprobe zählt — „war noch feucht" ist eine Messung

**Der Moment.** 7:30 auf dem Balkon, Kaffee in der einen Hand, zwei Minuten
Zeit. Die App sagt „Geranien giessen · Heute". Der Finger in der Erde sagt:
nass.

**Was heute passiert (gemessen).** Zwei Antworten: erledigt (`gsQuickDone`
setzt `lastDone`) oder „1 Tag verschieben" (`gsSnoozeTask`;
`grep -c "gsSnoozeTask(" index.html` → 3: die Definition und zwei Knöpfe, beide
mit 1). Beides stimmt nicht — sie hat nicht gegossen, und sie schiebt nichts
auf: sie hat gerade gemessen. Das Intervall ändert nur sie selbst, im
Aufgaben-Fenster (`setTaskInterval`).

**Was passiert.** An Giess-Aufgaben ein dritter Knopf: „Noch feucht". Die
Aufgabe rückt einen Tag (dieselbe `snoozedUntil`-Regel), und die Aussage wird an
der Aufgabe festgehalten — das Datum, höchstens fünf. Nach DREI „noch feucht"
am Fälligkeitstag in Folge fragt die App einmal: „Dreimal war die Erde am
Giesstag noch feucht (3., 6., 9. Juni). Alle 4 statt alle 3 Tage giessen?" —
mit VORHER/NACHHER. Nein heisst: 30 Tage Ruhe mit dieser Frage. Die
Gegenrichtung („hing schon") erst, wenn die erste trägt.

**Warum neu.** `grep -c -i "noch feucht\|war noch nass\|fingerprobe" index.html`
→ 1 (ein Satz im Bibliotheks-Artikel „Richtig giessen"). Ein bestehendes
Intervall ändert genau eine Stelle: `grep -c "\.intervalDays *=" index.html`
→ 1 (`setTaskInterval`, die Person wählt aus der Liste). OEKOSYSTEM §4 nennt
die Person „das erste Gerät" — beim Abhaken darf sie bisher nur Ja sagen.

**Worauf es aufbaut.** `gsSnoozeTask`, `gsQuickDone`, `_gsPflanzeFinden`,
`gsConfirmModal`, `gsRenderDayPlan` (`gsDayPlanCheck`), `gsRenderTaskNote`,
`gsNcDoneTask`, `_gsRegenUebernimmt` (draussen mit Regen zählt die Aussage nicht
fürs Intervall), `gsSensorAufgabenAbgleich` (macht mit Sensor das Umgekehrte:
zieht vor).

**Kleinste erste Scheibe.** Knopf im Tagesplan und im Notizzettel +
Festhalten + die eine Frage. Ein Feld an der Aufgabe (`feucht: [Tage]`) — reist
mit der Pflanze, kein neuer Schlüssel.

**Woran man es prüft.** `kalender_check`, neuer Fall „Fingerprobe" (Uhr
gestellt, Intervall 3): drei Aussagen an drei Fälligkeitstagen → genau **1**
Frage mit den drei Daten im Text; Ja → `intervalDays` **4**; Nein → 3, und eine
vierte Aussage löst **0** weitere Fragen aus. Zwei Aussagen → 0 Fragen. Drei
Aussagen, eine davon an einem Tag mit „Regen übernimmt" → 0 Fragen. Und nach
jeder Aussage: `lastDone` unverändert (Gegenprobe: `gsQuickDone` statt
Verschieben → `lastDone` springt → rot).

**Risiko.** (a) KALENDER-V2 rechnet bewusst kein „du giesst zu oft", und Lina
darf keine Vorliebe aus dem Verhalten erraten. Hier wird nichts erraten: drei
ausdrückliche Aussagen, eine Rückfrage, und geändert wird nur mit Ja. (b) Der
Intervall-Wähler kennt nur seine Liste (1, 2, 3, 7, 10, 14, 21): bei einem Wert
von 4 ist keine Option gewählt, und das Auswahlfeld zeigt die erste („Täglich").
Der Wähler muss den gespeicherten Wert zeigen können — sonst sagt die App nach
der Änderung etwas Falsches. (c) Mit einem Sensor an der Pflanze gilt der
Sensor: der Knopf erscheint dort nicht (eine Messung, ein Gerät).

---

## 8 · Notfallblatt — „Was bei uns giftig ist", für den Kühlschrank

**Der Moment.** Freitagabend. Der Zweijährige läuft seit einer Woche, morgen
hütet die Grossmutter. Im Wohnzimmer stehen elf Pflanzen — und nur eine Person
im Haus kennt ihre Namen.

**Was heute passiert (gemessen).** Die Giftstufe steht an der einzelnen Art
(`_gsArtAnzeige`), die Nummer 145 an zehn Stellen (`grep -c "tel:145"
index.html` → 10) — nach IDEE-Bs Befund alle an einem Steckbrief, am roten
Vollbild oder an einer Lina-Nachricht. Eine Übersicht über
die EIGENEN Pflanzen gibt es nicht: `gsInsightsCompute` („Score + Risiken")
rechnet Bestäuber und Krankheiten, keine Giftigkeit. Und wer am Telefon mit Tox
Info steht, muss sagen können, welche Pflanze es war.

**Was passiert.** Ein Eintrag „Was bei uns giftig ist" (bei „Meine Pflanzen" und
in der Menü-Suche unter kind · haustier · giftig · notfall). Die App geht BEIDE
Pflanzenlisten durch und stellt jede Pflanze in genau eine von drei Gruppen:
1. **als giftig geführt** — Stufe n von 5, deutscher UND lateinischer Name, wo
   sie steht, die Warnzeile der Liste;
2. **nicht als giftig geführt**;
3. **nicht bekannt** — steht nicht in der Artenliste oder hat keinen Namen, der
   sich zuordnen lässt.

Oben fest: Tox Info Suisse 145. Unter Gruppe 3 der Satz, der zählt: „Nicht
bekannt heisst nicht ungiftig." Ein Knopf „Als Blatt drucken": eine Seite für
den Kühlschrank — für die Person, die hütet und die Pflanzen nicht kennt.

**Warum neu.** `grep -c -i "notfallblatt\|giftcheck\|babysitter\|kinderblatt" index.html`
→ 0. Im Rumpf von `gsInsightsCompute` 0 Treffer auf `tox`. Berührt die Idee
„Notfall-Übergabe" von IDEE-B (Brett 04:52: die Menü-Suche findet „Notfall"
nicht) — dort geht es um den Weg im Notfall, hier um das Blatt davor.

**Worauf es aufbaut.** `myPlants` + `plantings` (Summe über `gsPflanzenZahl()`),
`_gsArtZuPflanze(p)` (lateinischer Name), sonst `_gsArtenTreffer(p.name)`;
dann `_gsArtAnzeige` (die ART, nicht der Eintrag — Regel 11). Treffen mehrere
Arten den Namen, zählt die giftigste, und die Zeile sagt es („mehrere Arten
heissen so") — bei einer Warnung gewinnt die Vorsicht (`_gsVorsichtigste`).
`toxInfo`, `_gsWarnungEcht`, `gsDrucken` + `_gsDateiAngekommen`, `MENU_ITEMS`,
`gsGiessZettelDrucken` als Bauvorlage für ein Druckblatt.

**Kleinste erste Scheibe.** Die Liste mit drei Gruppen im Fenster. Der Druck
ist die zweite Scheibe.

**Woran man es prüft.** `nutzersicht_check`, neuer Fall (neben E10, das die
Pflanzenzahl misst): zu den Beispielpflanzen drei gestellte — eine mit dem
Binomen einer Art der Stufe 4; eine nur mit dem Namen „Holunder"; eine ohne
lateinischen Namen und mit einem Namen, den die Liste nicht kennt. Gemessen in
`data/plants.v1.js`: 18 Sambucus-Einträge mit den Stufen 0 bis 5 — und der
Eintrag, der schlicht „Holunder" heisst (W036), trägt Stufe 0 und
`edible: true`. Erwartet aus dem gerenderten HTML: die ersten zwei in Gruppe 1,
der Holunder mit der HÖCHSTEN Stufe unter den Treffern von
`_gsArtenTreffer('Holunder')` (vom Fall selbst nachgezählt) und dem Vermerk
„mehrere Arten"; die dritte in Gruppe 3, nie in Gruppe 2; Gruppe 1 + 2 + 3 =
`gsPflanzenZahl()`; die Wörter ungiftig · unbedenklich · sicher **0×**.
Gegenprobe: den Eintrag nehmen, der genau so heisst (W036, Stufe 0) → der
Holunder rutscht in Gruppe 2 → rot.
Für den Druck `apk_check` (`EXPORTE` +1).

**Risiko.** (a) Die gefährlichste Zeile ist Gruppe 2: sie darf nie wie eine
Entwarnung aussehen — keine grüne Fläche, kein Haken, der Satz darunter ist
Pflicht. Das Blatt ist nur so gut wie die Liste; ARTEN misst gerade ihre
Gift-Widersprüche. (b) Von Hand angelegte Pflanzen haben keinen lateinischen
Namen (`savePlant` schreibt keinen) — es werden viele in Gruppe 3 stehen. Das
ist ehrlich; die Karte nennt die Zahl („7 von 11 zugeordnet"). (c) `tox` meint Menschen. Für Haustiere gibt es Angaben nur in
der Zimmerpflanzen-Tabelle auf dem Server (`toxic_to_pets`) — bis die Quelle
geklärt ist: „für Haustiere: nicht bekannt". (d) Nichts über den Haushalt wird
gefragt oder gespeichert, kein Ereignis trägt „Kind".

---

## Zurückgestellt — gesichtet, aber nicht unter den acht

- **Gartentage** („ich gärtnere Di und Sa" → die Woche in zwei Sitzungen, als
  Sieb auf `gsKalenderEreignisse`): trägt, aber der Server-Push mahnt weiter
  täglich; ohne Migration bleibt es halb. `grep -c "gs_gartentage\b" index.html`
  → 0 (alle Treffer sind `gs_gartentagebuch`).
- **Ein Ort am Morgen** (die Giessrunde nach Standort ordnen): fällt, weil
  `p.location` bei eigenen Pflanzen keinen Schreiber hat (Kommentar in
  `gsPflanzeDraussen`, v32.51).
- **Drei Dinge hier und jetzt** (Suchauftrag mit Kind aus `gsEingrenzen`): die
  Artenliste hat kein Feld für Häufigkeit, und in `data/plants.v1.js` tragen nur
  967 von 4'342 Einträgen eine Farbe — die Aufträge wären oft unlösbar.
- **Bester Tag der Woche** (das Wetter wählt den Tag fürs Säen, Düngen,
  Schneiden): nah an R1/R7, die schon warnen; eher eine Erweiterung des
  Prüfwerks als eine eigene Idee.

## Beim Lesen gefunden — steht als `befund` auf dem Brett

1. `gsSaatgutJetzt` liest den Aussaatkalender einen Monat versetzt (108 von 468
   Kultur×Monat-Paaren; Tomaten „Jetzt ins Beet" im April). → GARTEN.
2. „Stille Tage" meldet „pausiert", ohne die Antwort des Servers zu lesen;
   `versprechen_check` sieht es nicht (Meldung im Aufrufer, PATCH im Helfer).
   Noch ohne Besitzer.
3. Garten-Insights zählt und rechnet nur `myPlants`. → GARTEN.
4. Die Garten-Seite erfindet weiter ein Erntedatum (Rückfall 60–90 Tage; „Rose"
   trifft Rosenkohl).
5. Der Pilz-Scanner hat keinen einzigen Prüfstands-Fall.

## Für Runde 2 — woran die anderen andocken können

- Idee 1, 4 und 7 schreiben alle über dieselben zwei Felder (`lastDone`,
  `snoozedUntil`) und lassen sich als EINE Regel sagen: *Die Person darf der
  App widersprechen, und der Widerspruch ist eine Angabe mit Datum.*
- Idee 3, 5 und 7 erzeugen, was es heute nicht gibt: **eigene Messreihen der
  Person** (7 von 10 gekeimt · 5 Tage nach der Schätzung · dreimal noch
  feucht). Wer vom Blickwinkel Daten oder Sensor kommt, findet hier den
  Rohstoff — und die Stelle, an der ein Gerät später dieselbe Aussage macht.
- Idee 2 und 8 sind zwei Blätter Papier. Beide gehen durch `gsDrucken`, beide
  sagen nie „essbar" oder „ungiftig", und beide sind das, was jemand
  weitererzählt.
