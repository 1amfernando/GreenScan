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

## Offen — Scanner

1. **Alternative wählen erzeugt einen zweiten Scan.** `gsPickAlternative` ruft
   `showScanResult` erneut; dort laufen `gsAddToScanHistory`, `gsScanPersistToCloud` und
   `saveScanToHistory` noch einmal. Der falsche Eintrag bleibt im Verlauf und in der Cloud.
2. **Die gewählte Alternative zeigt die Merkmale der verworfenen Art.** `Object.assign`
   übernimmt `diagnostic_features` und `next_photo_hint`.
3. **Eine Korrektur ändert nichts Sichtbares.** `gsSubmitScanMistake` sendet nur; Ergebnis
   und Verlauf behalten den falschen Namen. Freitext ohne Artvorschlag.
4. **Kein Abbrechen während des Scans.** Nur ein Sekundenzähler; `callVisionAI` hat 60 s
   Timeout und eine Wiederholung.
5. **Fehlermeldungen in Technikersprache** in `analyzeImage` (Rohantwort bei kaputtem JSON,
   `gsTestApiKey()`, Modellname; `errMsg` roh statt über `_gsFehlerText`). „In 60s retry"
   ohne Countdown.
6. **Verlauf rechnet anders als die Ergebniskarte.** `gsScanHistoryOpen` findet die Art über
   einen Namensvergleich statt `gsMatchScanToDb` und hat eigene Sicherheitsstufen.
7. **`_gsRetryLastScan` gibt `opts` nicht weiter** — „Trotzdem bestimmen" führt beim
   erneuten Versuch wieder zur Qualitätsrückfrage.
8. **Scan-Chat:** Verlauf wird bei jedem Öffnen geleert; erscheint nur bei einem Treffer in
   der Artenliste; Prompt nur deutsch; kein Übergang zu Lina (`gsDoctorToLina` als Vorbild).
9. **brett 2e3a:** `gsAboCanUse('scan')` liest einen Tageszähler, den keine Stelle schreibt.
10. Verdacht: das Vorschaubild im Verlauf ist leer (`video.srcObject` ist nach `stopCamera`
    schon `null`).

## Offen — Lina

1. **KI fällt aus, Gerät ist online:** nur „versuch es nochmal". `getSmartAnswer` greift nur
   bei `!navigator.onLine`; kein Knopf zum erneuten Senden.
2. **Entwurf geht beim Warten verloren.** `gsLinaRender` baut das Fenster samt Eingabefeld
   neu. Kein Abbruch, keine Zeitangabe (45 s Timeout, 2 Wiederholungen).
3. **Sternchen stehen roh da.** Antworten laufen durch `escHtml` ohne Auszeichnung — auch die
   Notfallzeile trägt `**…**`. Vorlage: `addScanChatMsg` seit v33.61.
4. **Ältere Gespräche sind unerreichbar.** Nur die neueste Unterhaltung wird geladen; „＋ Neu"
   verwirft ohne Rückfrage; offline ist der Verlauf leer.
5. **Aktionen schliessen Lina sofort** (`navigate`, `open_calendar`, `search_species`,
   `prefill_form` in `gsLinaDispatch`) — die Antwort ist weg.
6. **Schreibaktionen ohne Prüfung:** `propose_reminder` meldet „eingerichtet" ohne
   Rückgabewert; `gsLinaAddPlant` ohne Dublettenprüfung; zwei Rückfragen fest deutsch.
7. **Vorschlags-Chips sind statisch** (`GS_LINA_VORSCHLAEGE`): „…blühen im April?" in jedem
   Monat, ohne Bezug zu fälligen Aufgaben oder zum letzten Scan.
8. Verdacht: ein kaputtes `[[GS_ACTION]]` am Antwortende wird still verworfen.

## Offen — Suche

> **Gebaut auf Branch `claude/hauptfunktionen-suche`** (11.11.2026, noch ohne Version, wartet
> hinter v33.61): Punkte 2, 3, 4, 6, 7 und die toten Reste aus 9. Prüfstand: `scan_check`
> SU1–SU3, Gegenprobe gegen den Stand davor rot. Offen bleiben 1, 5, 8, 10 (Ranking).

1. **Filter und Suchtext schliessen sich aus.** `gsFilter` löscht `searchText`; es gibt nur
   `currentFilter` — „Pilz + giftig" geht nicht.
2. **Tippfehler-Suche ist schwach** (`getFiltered`, `_gsLeven`): läuft nur bei 0 Treffern,
   vergleicht den ganzen Namen (nicht die „/"-Teile, nicht das Binomen), bricht bei mehr als
   2 Zeichen Längenunterschied ab.
3. **Synonyme nur bei exakter Eingabe** (`GS_SYNONYMS`, 20 Einträge).
4. **Mehrere Wörter werden als ein Stück gesucht;** keine Mindestlänge.
5. **„Mehr laden" baut die Karte anders** als die erste Seite (`loadMoreList`: ohne
   Hervorhebung, eigener Rand-Stil) — doppelter Kartencode.
6. **Hervorhebung ohne Umlaut-Faltung:** „barlauch" findet Bärlauch, markiert nichts.
7. **Statuszeile zeigt den internen Filterschlüssel** („· geschuetzt"); der Leerzustand bietet
   weder „Filter zurücksetzen" noch „Meintest du …".
8. **Menü-Suche** (`searchMenu`): je Tastendruck 51 × `DB.filter`, Ergebnis verworfen
   (`dbMatch`); der Artenteil ist eine zweite Suchlogik ohne Umlaute und Ranking.
9. Tote Reste: `_origGetFiltered`, `_gsSearchDebounce`; `getFiltered` setzt nebenbei
   `_listPage = 1`.
10. Kein Prüffall für Ranking, Umlaute, Synonyme, Tippfehler, `loadMoreList`.

## Offen — Home

1. **Saison-Tipp „Jetzt sammeln"** (`gsInitSmartSeasonTip`) vergleicht `season.indexOf(Monat)`
   statt `gsSaisonMonate` — „April–Juni" trifft den Mai nicht.
2. **Wetterkarte hat zwei Schreiber** (`loadHomeWeather`, `gsApplyWeatherToWidget`) mit
   eigenen Regeln für Frost und Regen statt `GS_WETTER_GRENZEN`; was dasteht, hängt davon ab,
   wer zuletzt lief. Kein Prüffall (`hw-*` kommt in `scripts/` nicht vor).
3. **„Arten" zählt verschieden:** Lexikon zeigt `DB.length`, Home `gsArtenZahlen().arten`.
4. **`stat-scans` hat zwei Schreiber;** Verdacht auf Doppelzählung. Fester Ersatzwert 4330.
5. **Karten-Stapel** (`gsBuildWidgetStack`): `wisdom-card` immer eingeblendet (leer ohne
   Bauernregel?), dreht alle 8 s ohne Pause-Knopf, `gsRenderWochenrueckblick` doppelt gerufen.
6. STATUS „N4": Hinweis auf der Startseite, wenn alle Pläne veraltet sind.

## Reihenfolge

Scanner 1–3 und Lina 1–3 zuerst (jemand verliert Arbeit oder liest etwas Falsches), dann
Suche 1–4, dann Home. Ausgeliefert wird einzeln: jede Auslieferung ändert `GS_VERSION`,
`GS_RELEASES` und `sw.js`.
