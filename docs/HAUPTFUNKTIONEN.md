# Die vier Hauptfunktionen — Arbeitsliste

Home · Scanner · Suche · Lina. Seit dem 11.11.2026 kümmert sich eine eigene Sitzung um
diese vier (Auftrag Fernando). Diese Datei ist ihre Arbeitsliste und die Übergabe an jede
Untersitzung: was geliefert ist, was offen ist, wo es im Code steht.

**Lesart:** Die offenen Punkte stammen aus einer Bestandsaufnahme durch zwei Lese-Agenten
(11.11.2026, Stand v33.58). Sie sind **gelesen, nicht gemessen** — wer einen Punkt nimmt,
misst zuerst nach (CLAUDE.md §5: ein Eintrag ist ein Befund, keine Anweisung). Zeilennummern
gelten für v33.58 und wandern; gesucht wird über den Funktionsnamen.

## Geliefert

| Version | Was |
|---|---|
| v33.61 | Filter „Essbar/Giftig/Ungiftig" fragen die Art · `_gsArtAnzeige` macht nichts essbarer · Menü-Einträge setzen den Filter · Trefferliste escaped · Notfall-Erkennung auf Spanisch · Scan-Chat mit Notfallnummer und Gegenprobe |
| v33.61 (16.11.) | Suche 1, 2, 3, 4, 5, 6, 7, 8 · Lina 1, 2, 3, 5, 6 (Lina-Untersitzung), 4, 7, 8 · Scanner 1, 2, 3, 5, 7 (Scanner-Untersitzung) · Scanner 6, 8, 10 · Home 1, 1b, 2, 5 — Einzelheiten in STATUS (je) |

## Offen — Scanner

1. ✅ v33.61 — **Alternative wählen erzeugt einen zweiten Scan.** `gsPickAlternative` ruft
   `showScanResult` erneut; dort laufen `gsAddToScanHistory`, `gsScanPersistToCloud` und
   `saveScanToHistory` noch einmal. Der falsche Eintrag bleibt im Verlauf und in der Cloud.
2. ✅ v33.61 — **Die gewählte Alternative zeigt die Merkmale der verworfenen Art.** `Object.assign`
   übernimmt `diagnostic_features` und `next_photo_hint`.
3. ✅ v33.61 (Karte, Verlauf und Artvorschläge im Feld) — **Eine Korrektur ändert nichts Sichtbares.** `gsSubmitScanMistake` sendet nur; Ergebnis
   und Verlauf behalten den falschen Namen. Freitext ohne Artvorschlag.
4. **Kein Abbrechen während des Scans.** Nur ein Sekundenzähler; `callVisionAI` hat 60 s
   Timeout und eine Wiederholung.
5. ✅ v33.61 — **Fehlermeldungen in Technikersprache** in `analyzeImage` (Rohantwort bei kaputtem JSON,
   `gsTestApiKey()`, Modellname; `errMsg` roh statt über `_gsFehlerText`). „In 60s retry"
   ohne Countdown.
6. ✅ v33.61 (Liste, Detail und Galerie-Detail; `scan_check` SV1–SV3) — **Verlauf rechnet anders als die Ergebniskarte.** `gsScanHistoryOpen` findet die Art über
   einen Namensvergleich statt `gsMatchScanToDb` und hat eigene Sicherheitsstufen.
7. ✅ v33.61 — **`_gsRetryLastScan` gibt `opts` nicht weiter** — „Trotzdem bestimmen" führt beim
   erneuten Versuch wieder zur Qualitätsrückfrage.
8. ✅ v33.61 (`scan_check` SC2; „nur bei einem Treffer" stimmte nicht mehr — seit v30.73 auch ohne)
   — **Scan-Chat:** Verlauf wird bei jedem Öffnen geleert; erscheint nur bei einem Treffer in
   der Artenliste; Prompt nur deutsch; kein Übergang zu Lina (`gsDoctorToLina` als Vorbild).
9. **brett 2e3a:** `gsAboCanUse('scan')` liest einen Tageszähler, den keine Stelle schreibt.
10. ✅ v33.61 (bestätigt — und auch „Zu meinen Pflanzen" bekam nie ein Foto; `scan_check` SB1) —
    Verdacht: das Vorschaubild im Verlauf ist leer (`video.srcObject` ist nach `stopCamera`
    schon `null`).

## Offen — Lina

1. ✅ v33.61 — **KI fällt aus, Gerät ist online:** nur „versuch es nochmal". `getSmartAnswer` greift nur
   bei `!navigator.onLine`; kein Knopf zum erneuten Senden.
2. ✅ v33.61 (Abbruch und Zeitangabe fehlen weiter) — **Entwurf geht beim Warten verloren.** `gsLinaRender` baut das Fenster samt Eingabefeld
   neu. Kein Abbruch, keine Zeitangabe (45 s Timeout, 2 Wiederholungen).
3. ✅ v33.61 — **Sternchen stehen roh da.** Antworten laufen durch `escHtml` ohne Auszeichnung — auch die
   Notfallzeile trägt `**…**`. Vorlage: `addScanChatMsg` seit v33.61.
4. ✅ v33.61 (Verlauf mit den letzten 20; „＋ Neu" verliert damit nichts; `sensor_check` L5 —
   offline bleibt der Verlauf leer, das ist offen) — **Ältere Gespräche sind unerreichbar.** Nur die neueste Unterhaltung wird geladen; „＋ Neu"
   verwirft ohne Rückfrage; offline ist der Verlauf leer.
5. ✅ v33.61 (Wege sind ein Knopf) — **Aktionen schliessen Lina sofort** (`navigate`, `open_calendar`, `search_species`,
   `prefill_form` in `gsLinaDispatch`) — die Antwort ist weg.
6. ✅ v33.61 (dazu: eine Erinnerung für eine Garten-Pflanzung schrieb gar nichts) — **Schreibaktionen ohne Prüfung:** `propose_reminder` meldet „eingerichtet" ohne
   Rückgabewert; `gsLinaAddPlant` ohne Dublettenprüfung; zwei Rückfragen fest deutsch.
7. ✅ v33.61 (dazu: die Chips waren seit v33.31 in keiner Sprache übersetzt; `sensor_check` L7) —
   **Vorschlags-Chips sind statisch** (`GS_LINA_VORSCHLAEGE`): „…blühen im April?" in jedem
   Monat, ohne Bezug zu fälligen Aufgaben oder zum letzten Scan.
8. ✅ v33.61 (bestätigt und schlimmer: mit Text dahinter stand die Zeile roh in der Antwort;
   `sensor_check` L6) — Verdacht: ein kaputtes `[[GS_ACTION]]` am Antwortende wird still verworfen.

## Offen — Suche

> **Geliefert mit v33.61** (16.11.2026): Punkte 1, 2, 3, 4, 5, 6, 7 und die toten Reste aus 9.
> Prüfstand: `scan_check` SU1–SU7. Dazu 8 (Menü-Suche, SU7). Offen bleibt 10 (Ranking).

1. ✅ v33.61 (dazu: die Kategorie-Einträge im Menü warfen einen Fehler; das ✕ im Suchfeld nahm
   den Filter weg und liess den Knopf markiert) — **Filter und Suchtext schliessen sich aus.** `gsFilter` löscht `searchText`; es gibt nur
   `currentFilter` — „Pilz + giftig" geht nicht.
2. **Tippfehler-Suche ist schwach** (`getFiltered`, `_gsLeven`): läuft nur bei 0 Treffern,
   vergleicht den ganzen Namen (nicht die „/"-Teile, nicht das Binomen), bricht bei mehr als
   2 Zeichen Längenunterschied ab.
3. **Synonyme nur bei exakter Eingabe** (`GS_SYNONYMS`, 20 Einträge).
4. **Mehrere Wörter werden als ein Stück gesucht;** keine Mindestlänge.
5. ✅ v33.61 (dazu: der Giftrand war auf Seite 2 einen Pixel breit) — **„Mehr laden" baut die Karte anders** als die erste Seite (`loadMoreList`: ohne
   Hervorhebung, eigener Rand-Stil) — doppelter Kartencode.
6. **Hervorhebung ohne Umlaut-Faltung:** „barlauch" findet Bärlauch, markiert nichts.
7. **Statuszeile zeigt den internen Filterschlüssel** („· geschuetzt"); der Leerzustand bietet
   weder „Filter zurücksetzen" noch „Meintest du …".
8. ✅ v33.61 (dazu: keine Giftangabe an den Arten; `scan_check` SU7) — **Menü-Suche** (`searchMenu`): je Tastendruck 51 × `DB.filter`, Ergebnis verworfen
   (`dbMatch`); der Artenteil ist eine zweite Suchlogik ohne Umlaute und Ranking.
9. Tote Reste: `_origGetFiltered`, `_gsSearchDebounce`; `getFiltered` setzt nebenbei
   `_listPage = 1`.
10. Kein Prüffall für Ranking, Umlaute, Synonyme, Tippfehler, `loadMoreList`.

## Offen — Home

1. ✅ v33.61 (dazu: in jeder anderen App-Sprache traf gar nichts) — **Saison-Tipp „Jetzt sammeln"** (`gsInitSmartSeasonTip`) vergleicht `season.indexOf(Monat)`
   statt `gsSaisonMonate` — „April–Juni" trifft den Mai nicht.
   **1b ✅ v33.61 — und die Funktion hatte in der App keinen Aufrufer** (nur Prüfstände riefen sie
   direkt). Auf dem Bildschirm stand `SEASON_DATA` aus `initHomeBoard` („Paprika" im März unter
   „Jetzt sammeln") und online ein zufälliger `did_you_know_facts`-Eintrag (`v_today_tip`). Jetzt
   ein Schreiber, und `_gsSammelSicher` lässt Pilze und Arten mit giftigem Doppelgänger draussen
   (`scan_check` HS2 geht den Weg über `initHomeBoard`, HS3 misst 372 Tage).
2. ✅ v33.61 (`scan_check` HW1, HW2; dazu: die Sturmwarnung las die Stunden 00–02 Uhr) — **Wetterkarte hat zwei Schreiber** (`loadHomeWeather`, `gsApplyWeatherToWidget`) mit
   eigenen Regeln für Frost und Regen statt `GS_WETTER_GRENZEN`; was dasteht, hängt davon ab,
   wer zuletzt lief. Kein Prüffall (`hw-*` kommt in `scripts/` nicht vor).
3. **„Arten" zählt verschieden:** Lexikon zeigt `DB.length`, Home `gsArtenZahlen().arten`.
   Die Startseite zählt richtig; der Fehler liegt im Wissen-Tab → Brett `2026-11-16-4d79`
   (dort auch „Essbar" und „Giftig" mit eigenen Regeln).
4. ❎ nachgesehen 16.11.: kein Fehler — beide zählen dasselbe wie die Liste, die die Kachel öffnet (Verlauf + bestätigte Karten). **`stat-scans` hat zwei Schreiber;** Verdacht auf Doppelzählung. Fester Ersatzwert 4330.
5. ✅ v33.61 (bestätigt: ohne Bauernregel eine leere Folie mit Punkt; `scan_check` HK1) — **Karten-Stapel** (`gsBuildWidgetStack`): `wisdom-card` immer eingeblendet (leer ohne
   Bauernregel?), dreht alle 8 s ohne Pause-Knopf, `gsRenderWochenrueckblick` doppelt gerufen
   (nachgesehen: Tagesplan und erster Aufbau rendern dieselben Daten — kein Fehler).
6. STATUS „N4": Hinweis auf der Startseite, wenn alle Pläne veraltet sind.

## Nebenfunde (nicht in den vier Funktionen)

- Das Lexikon (Wissen) schreibt `DB.length` (4'337 Einträge) unter „Arten" — CLAUDE.md §1
  verlangt `gsArtenZahlen()` (3'136 Arten). Gefunden 16.11.2026, nicht angefasst; gemessen und
  aufs Brett gelegt als `2026-11-16-4d79` (auch der Kopf-Chip des Wissen-Tabs, „Essbar" und
  „Giftig" mit eigenen Regeln).
- Standort-Fenster ohne Standort: im Dunkelmodus 1,51:1 (fest heller Kasten, kippende Schrift)
  → Brett `2026-11-16-a082`.
- Nach „Alternative wählen" bleibt in `user_scans` die Zeile mit dem Namen der KI stehen
  (die Tabelle erlaubt kein Update). Dieses Gerät blendet sie über `ki_name` aus; ein zweites
  Gerät zeigt die erste Bestimmung. Ein Ersatz (neue Zeile mit demselben Foto anlegen, alte
  löschen — `DELETE` eigener Zeilen ist erlaubt) wäre der nächste Schritt.

## Reihenfolge

Scanner 1–3 und Lina 1–3 zuerst (jemand verliert Arbeit oder liest etwas Falsches), dann
Suche 1–4, dann Home. Ausgeliefert wird einzeln: jede Auslieferung ändert `GS_VERSION`,
`GS_RELEASES` und `sw.js`.
