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
| v33.61 (16.11.) | Suche 1–8, 10 · Lina 1, 2, 3, 5, 6 (Lina-Untersitzung), 4, 7, 8 · Scanner 1, 2, 3, 5, 7 (Scanner-Untersitzung) · Scanner 6, 8, 10 · Home 1, 1b, 2, 5, 6, 7 — Einzelheiten in STATUS (je) |
| v33.64 (19.11.) | Scanner 11 — Pilz-Scanner: alle Register-Arten ans Modell (Server, braucht die Auslieferung), Schwelle wie am Server, rote Kopfzeile auch ohne Farbe, Kandidaten mit Namen und Warnung, Fehler als Satz, keine Antwort nach dem Abmelden |
| v33.67 (19.11.) | Scanner 4 — „Abbrechen" auf der Wartefläche (die späte Antwort wird weder gezeigt noch gespeichert), ein neuer Scan ersetzt den laufenden (ein Zähler, eine Antwort), keine erfundenen Meldungen mehr über der Kamera |

## Offen — Scanner

1. ✅ v33.61 — **Alternative wählen erzeugt einen zweiten Scan.** `gsPickAlternative` ruft
   `showScanResult` erneut; dort laufen `gsAddToScanHistory`, `gsScanPersistToCloud` und
   `saveScanToHistory` noch einmal. Der falsche Eintrag bleibt im Verlauf und in der Cloud.
2. ✅ v33.61 — **Die gewählte Alternative zeigt die Merkmale der verworfenen Art.** `Object.assign`
   übernimmt `diagnostic_features` und `next_photo_hint`.
3. ✅ v33.61 (Karte, Verlauf und Artvorschläge im Feld) — **Eine Korrektur ändert nichts Sichtbares.** `gsSubmitScanMistake` sendet nur; Ergebnis
   und Verlauf behalten den falschen Namen. Freitext ohne Artvorschlag.
4. ✅ v33.67 (`scan_check` AB1–AB4) — **Kein Abbrechen während des Scans.** Nur ein Sekundenzähler; `callVisionAI` hat 60 s
   Timeout und eine Wiederholung. Gemessen 19.11.: auf der Wartefläche waren nur Glocke und
   Hauptmenü antippbar; der Zurück-Knopf führte zur Startseite, und die Antwort wurde trotzdem
   gezeichnet und gespeichert. Dazu zwei Fehler derselben Form: ein zweiter Scan bekam den
   Zähler des ersten in seine Wartefläche („0 · 5 · 1 · 6 · 2 s") und dessen spätere Antwort
   über sein Ergebnis; und der Auslöser startete fünf erfundene Meldungen („🧬 Prüfe
   Merkmale…"), die nach einem Fehler endlos über der Kamera wechselten. Jetzt: „Abbrechen"
   führt zur Kamera, jeder Scan hat eine Nummer (`_gsScanNr`), nach jedem `await` gilt nur
   der laufende; die erfundenen Meldungen sind weg. Abgebrochen wird die Folge, nicht der
   Aufruf — ein echtes Signal in `callVisionAI` bleibt Brett-Idee 2026-11-16-8186 (der Satz
   nach dem Abbrechen sagt, dass der Versuch zählen kann). Der Zurück-Knopf bleibt, was er
   war: wer weggeht, findet das Ergebnis beim Zurückkommen.
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
11. ✅ v33.64 (`edge_check` 80_pilz, `scan_check` PZ1–PZ4) — **Pilz-Scanner** (Brett 2714): das Modell
    kannte live nur 200 der 276 Register-Arten (19 giftige fehlten — Satansröhrling, Tiger-Ritterling,
    Grünling, Käppchenmorchel …); die App sagte bei 60–69 % „✅ Speisepilz", der Server verlangte die
    Kontrolle; ein tödlicher Pilz ohne `safety_color` bekam die Kopfzeile „⚠️ Vorsicht"; Kandidaten
    standen als roher Slug da; Fehler als Kennung („rate_limited"); eine Antwort nach dem Abmelden wurde
    gezeichnet. **Offen:** der Eintrag im Scan-Verlauf — erst, wenn der Verlauf die Essbarkeit des
    Registers zeigt und die vorsichtigere gewinnt: die Artenliste ist bei 10 Giftpilzen milder als das
    Register, 34 fehlen ihr (Brett 2026-11-19-a24a). Die Function muss Fernando ausliefern
    (FUER-FERNANDO §31).
    **Nachtrag v33.71 (`scan_check` PZ5, PZ6) — ein Ergebnis gehört zu seinem Foto.** Gemessen 19.11.: ein
    neues Foto liess das Urteil des vorigen stehen („✅ Speisepilz" unter einem anderen Pilz); wer während der
    Bestimmung das Fenster schloss und mit einem neuen Foto wieder öffnete, sah den Knopf weiter auf
    „⏳ Identifiziere…", und die Antwort zum alten Foto erschien unter dem neuen — bei einem Giftpilz samt
    Vollbild; nach dem Schliessen legte sich die Vollbild-Warnung später über die App. Jetzt eine Nummer je
    Bestimmung (`gsPilzAbbrechen`), und der Knopf trägt danach wieder seine eigene Beschriftung statt fest
    „🔍 Pilz identifizieren" in jeder Sprache.
    **Nachtrag 24.11. (gegnerische Prüfung, `scan_check` PZ7):** in fr/it/en/es wartet die Anzeige auf bis zu zwei
    Übersetzungs-Abfragen — NACH der Prüfung, und `gsMushroomRunScan` wartete nicht auf sie: unter einem neuen Foto
    stand „✅ Speisepilz" des alten, sogar über einem neueren „TÖDLICH"; PZ5 lief nur auf Deutsch. Jetzt wartet die
    Bestimmung auf ihre Anzeige und reicht `gilt` hinein. Dazu: ein später kodiertes älteres Foto verdrängt kein neueres
    mehr (`_gsPilzFotoNr`), ein abgelöster Netzfehler bleibt still (der Zweig war ungeprüft), wer während der
    Bestimmung schliesst (ein Tipp auf den dunklen Rand genügt), bekommt einen Satz statt Stille, und „⏳ Identifiziere…"
    geht durch die Sprachschicht.

12. ✅ v33.74 (`scan_check` VG1–VG7, gebaut 24.11.) — **Die Bestimmung lässt sich nicht am Bild prüfen.** Referenzbilder
    gab es nur in der Artenansicht und im Scan-Verlauf; auf der Ergebniskarte, wo man die Bestimmung liest, keines —
    und keines für die Alternativen. Jetzt „🔍 Mit Bildern vergleichen" unter der KI-Sicherheit: dein Foto steht fest
    oben, darunter die erkannte Art und bis zu drei Alternativen, je mit Referenzbild (freigegebenes Community-Foto aus
    dem eigenen Speicher, sonst Wikipedia), der Marke aus dem Streifen (`_gsAltMarke`, EINE Rechnung) und dem
    Unterscheidungsmerkmal; „Das ist es" wählt wie ein Tipp auf die Alternative. **Geladen wird erst auf Antippen** — die
    Datenschutzerklärung nennt Wikipedia „wenn du eine Art öffnest". Das Bild einer Art holen jetzt zwei Funktionen an
    EINER Stelle (`_gsWikiBildHolen`, `_gsCommunityBilderHolen`); die Artenansicht zeichnet sie wie bisher. Dabei
    behoben: ein Netzfehler galt als „kein Bild" (bis zum Neuladen blieb die Art ohne Bild), und ein Bild aus der
    Wikipedia-Antwort wurde von jedem Host genommen (jetzt nur `upload.wikimedia.org`). Jedes Wikipedia-Bild trägt
    seinen Nachweis (Dateiseite auf Commons: Urheber und Lizenz).
13. ✅ v33.74 (`scan_check` PV1–PV4, gebaut 24.11.) — **Pilz: die Verwechsler hatten keinen Namen und kein Bild.**
    `mushroom-identify` schickt die Verwechsler als Paare von Slugs (ohne Namen); die Warnbox zeigte „Amanita
    Phalloides" statt „Grüner Knollenblätterpilz", in jeder Sprache — genau dort, wo „☠️ LEBENSGEFAHR" steht. Der Fall
    dazu (PZ1) stellte einen Namen, den die Function nie schickt. Jetzt kommen Name (in der Sprache der App), Latein und
    Essbarkeit aus dem REGISTER (`_gsPilzRegister`, ein Leser `_gsPilzVerwechsler`, höchstens 2,5 s, ein Fehler wird
    nicht gemerkt), und „☠️ TÖDLICH" steht beim Verwechsler. Dazu „🔍 Mit Bildern vergleichen" im Pilz-Ergebnis: dein Foto,
    die Art und bis zu drei Verwechsler (die gefährlichsten zuerst, jeder einmal), je mit Referenzbild, Essbarkeit aus dem
    Register, Risiko und sichtbarem Unterschied — bewusst ohne „Das ist es" (bei Pilzen entscheidet die Kontrolle, und das
    steht im Fenster). Dasselbe Fenster wie Scanner 12 (`_gsVglFenster`), dieselben drei Regeln; der Vergleich gilt nur,
    solange die Bestimmung gilt (`_gsPilzNr`). Dazu (Brett bc4f) der regionale Pilz-Hinweis und die Verwechsler-Galerie:
    dieselben Namen aus dem Register statt kleingeschriebenem Latein (`_gsPilzNameBekannt`, `scan_check` PV5).
14. ✅ v33.78 (`scan_check` PV7, Prüfung von #347, gebaut 24.11.) — **Der Pilz-Vergleich liess die gefährlichsten
    Verwechsler weg.** Er sortierte nur nach dem Paar-Risiko, und die erste Nennung einer Art gewann: gemessen fielen bei
    sechs Paaren BEIDE Knollenblätterpilze heraus (einmal „gering" zuerst genannt, einmal „mittel"), stehen blieben
    zwei Speisepilze — still gekürzt auf drei. Antwortete das Register nicht, standen Latein-Slugs ohne jeden Hinweis da.
    Jetzt zuerst nach der Gefahr laut Register (tödlich vor giftig vor unbekannt), je Art ihr höchstes Paar-Risiko,
    „N weitere Doppelgänger stehen nur in der Warnbox“; fehlt die Register-Angabe, sagt die Warnbox es (mit Zahl), und
    am Verwechsler steht „❓ Essbarkeit nicht geladen“.

## Offen — Lina

1. ✅ v33.61 — **KI fällt aus, Gerät ist online:** nur „versuch es nochmal". `getSmartAnswer` greift nur
   bei `!navigator.onLine`; kein Knopf zum erneuten Senden.
2. ✅ v33.61 (Zeitangabe seit L8; ein Abbruch braucht ein Signal in callAI → Brett 2026-11-16-8186) — **Entwurf geht beim Warten verloren.** `gsLinaRender` baut das Fenster samt Eingabefeld
   neu. Kein Abbruch, keine Zeitangabe (45 s Timeout, 2 Wiederholungen).
3. ✅ v33.61 — **Sternchen stehen roh da.** Antworten laufen durch `escHtml` ohne Auszeichnung — auch die
   Notfallzeile trägt `**…**`. Vorlage: `addScanChatMsg` seit v33.61.
4. ✅ v33.61 (Verlauf mit den letzten 20; „＋ Neu" verliert damit nichts; `sensor_check` L5 —
   und seit L9 bleibt das laufende Gespräch offline und „nur lokal" erhalten) — **Ältere Gespräche sind unerreichbar.** Nur die neueste Unterhaltung wird geladen; „＋ Neu"
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
9. ✅ v33.71 (`sensor_check` L12, gefunden 24.11. beim Nachlesen von `gsLinaSend`) — **Eine Antwort
   landet im falschen Gespräch.** Wer während „Lina denkt nach…" auf „＋ Neu" tippte, sah das neue
   Gespräch mit der Antwort auf eine Frage beginnen, die dort nicht stand; die nächste Frage ging mit
   dieser Antwort als Vorgeschichte an die KI. Wer ein früheres Gespräch öffnete, bekam die Antwort dort
   angehängt UND unter dessen Id in der Cloud gespeichert — im gefragten Gespräch fehlte sie. Wurde
   während des Anlegens eines neuen Gesprächs gewechselt, bekam das andere Gespräch dessen Id. Eine
   zweite Frage verschluckte der Riegel wortlos. Jetzt zählt jeder Wechsel (`_gsLinaGespraechNr`),
   Vorgeschichte, Id und Antwort bleiben beim gefragten Gespräch (Cloud), ein Satz sagt, wo die Antwort
   ist, und die zweite Frage bekommt einen Satz statt Stille.
10. ✅ v33.74 (`sensor_check` „Lina · Einblick ehrlich", Brett 2026-11-24-6bbf, gefunden 24.11. beim Nachprüfen
   von v33.70) — **Der Einblick hält nicht, was er sagt.** „Aus" nahm nur den Einblick-Block weg: Pflanzenzahl,
   Ort, fällige Aufgaben mit Pflanzennamen, Geräte, Messwerte, Kalender und der letzte Scan gingen weiter an die
   KI, während das Fenster „Lina sieht deine Pflanzen und Gärten gerade nicht" sagte. Der Schalter stand nur im
   leeren Verlauf, bei vollem Speicher blieb er still an, und ein Ort ohne Namen ging als „46.948°N, 7.447°E"
   mit („keine Koordinaten"). Der Schädlings-Filter konnte nie anschlagen (die Schreiber legen
   `pest_observation` ohne Pflanze an), und die Entwarnung nannte „kein Schädling" trotzdem als geprüft. Die
   Essbarkeits-Gegenprobe sah weder die eigene Pflanze hinter einem Spitznamen („Lilli" = Maiglöckchen) noch
   eine giftige Art, die erst in der Antwort steht. Jetzt: ohne Einblick nur Frage, Sprache, Jahreszeit und die
   Arten der Frage; der Schalter auch im laufenden Gespräch; voller Speicher → aus bis zum Neuladen, mit Satz;
   `_gsOrtNameFuerKi`; `gsSchaedlingeNotiert` (eigene Zeile, „kein Schädling" nur mit geladenem Tagebuch);
   `_gsLinaTrefferMitPflanzen` und Arten der Antwort mit ganzem Namen. Den Wortlaut der Datenschutzerklärung
   entscheidet Fernando (FUER-FERNANDO §33).
11. ✅ v33.79 (`sensor_check` „Lina 11 · Gift-Gegenprobe (kg)", Prüfung von #347, Brett 288f; die erste Fassung
   v33.76 ist vor dem Merge zurückgenommen) — **Die Gift-Gegenprobe schwieg bei Mehrzahl und warnte bei Pflege.**
   „Tollkirschen kannst du essen.", „des Gefleckten Schierlings", „Oleanderblätter" kamen ohne Warnung durch; bei drei
   eigenen Pflanzen in einer Frage prüfte sie nur zwei; Pflegesätze mit „bedenkenlos" und Gegensätze, die selbst warnen,
   warnten. Jetzt bleibt die Erkennung der Basis, und Neues kommt dazu: deklinierte Namen, alle eigenen Pflanzen,
   „Lilli auch." nach einer Zusage. Still werden nur Pflegesätze in drei engen Formen und Gegensätze mit eigener anderer
   Art. Gemessen mit einem Orakel über alle 3'138 Namen in sechs Formen: Was die Basis warnt, warnt weiter, und kein
   harmloser Name warnt neu. Ein eben notierter Schädling steht sofort bei Lina.

## Offen — Suche

> **Geliefert mit v33.61** (16.11.2026): Punkte 1, 2, 3, 4, 5, 6, 7 und die toten Reste aus 9.
> Prüfstand: `scan_check` SU1–SU8. Dazu 8 (Menü-Suche, SU7) und 10 (Rangfolge, SU8) — die Suche hat keinen offenen Punkt mehr.
> Dazu 11 (Pflanzen-Vorschläge, SU9, v33.76).

1. ✅ v33.61 (dazu: die Kategorie-Einträge im Menü warfen einen Fehler; das ✕ im Suchfeld nahm
   den Filter weg und liess den Knopf markiert) — **Filter und Suchtext schliessen sich aus.** `gsFilter` löscht `searchText`; es gibt nur
   `currentFilter` — „Pilz + giftig" geht nicht.
2. ✅ v33.61 (SU1) — **Tippfehler-Suche ist schwach** (`getFiltered`, `_gsLeven`): läuft nur bei 0 Treffern,
   vergleicht den ganzen Namen (nicht die „/"-Teile, nicht das Binomen), bricht bei mehr als
   2 Zeichen Längenunterschied ab.
3. ✅ v33.61 (SU2) — **Synonyme nur bei exakter Eingabe** (`GS_SYNONYMS`, 20 Einträge).
4. ✅ v33.61 — **Mehrere Wörter werden als ein Stück gesucht;** keine Mindestlänge.
5. ✅ v33.61 (dazu: der Giftrand war auf Seite 2 einen Pixel breit) — **„Mehr laden" baut die Karte anders** als die erste Seite (`loadMoreList`: ohne
   Hervorhebung, eigener Rand-Stil) — doppelter Kartencode.
6. ✅ v33.61 (SU3) — **Hervorhebung ohne Umlaut-Faltung:** „barlauch" findet Bärlauch, markiert nichts.
7. ✅ v33.61 — **Statuszeile zeigt den internen Filterschlüssel** („· geschuetzt"); der Leerzustand bietet
   weder „Filter zurücksetzen" noch „Meintest du …".
8. ✅ v33.61 (dazu: keine Giftangabe an den Arten; `scan_check` SU7) — **Menü-Suche** (`searchMenu`): je Tastendruck 51 × `DB.filter`, Ergebnis verworfen
   (`dbMatch`); der Artenteil ist eine zweite Suchlogik ohne Umlaute und Ranking.
9. ✅ v33.61 (die toten Reste) — Tote Reste: `_origGetFiltered`, `_gsSearchDebounce`; `getFiltered` setzt nebenbei
   `_listPage = 1`.
10. ✅ v33.61 (Rangfolge SU8; Umlaute SU3, Synonyme SU2, Tippfehler SU1, `loadMoreList` SU6, Menü SU7) — Kein Prüffall für Ranking, Umlaute, Synonyme, Tippfehler, `loadMoreList`.
11. ✅ v33.76 (`scan_check` SU9, Brett 2026-11-24-66d7, gebaut 24.11.) — **„Pflanze hinzufügen": die Vorschlagsliste hatte
    eine eigene Suche** (`_gsRenderSuggestions`: `toLowerCase` + `indexOf`) — „barlauch", „brennessel", „lowenzahn" fanden ohne Netz
    nichts. Jetzt `_gsSucheRang`, aber nur Treffer über Name, Binomen, Familie, Synonym oder Vertipper (`info.vorschlaege`): im
    Fliesstext nennen sich Verwechsler gegenseitig („maigl" → Bärlauch, „giersch" → Herbstzeitlose). Die Marke „giftig" las das
    Feld des Eintrags (58 Einträge giftiger Arten ohne Warnung) und stand im gekürzten Namen; jetzt `gsIstGiftig` mit dem Wort der
    Skala, neben dem Namen, und Online-Treffer gehen über `gsMatchScanToDb` zu ihrer Art.

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
3. ✅ v33.71 (`nutzersicht_check` E9 Teil 4, `scan_check` D1g) — **„Arten" zählt verschieden:** Lexikon zeigt `DB.length`, Home `gsArtenZahlen().arten`.
   Die Startseite zählt richtig; der Fehler liegt im Wissen-Tab → Brett `2026-11-16-4d79`
   (dort auch „Essbar" und „Giftig" mit eigenen Regeln).
   **Behoben 19.11.:** Kopf-Chip und Kachel „Arten" zeigen 3'136 (vorher 4'337 Einträge), „Essbar"
   1'062 wie Startkachel und Filter (vorher 1'130 — die 68 ungeprüften Einträge zählten mit),
   „Giftig" 675 wie der Filter (vorher 598 — die 77 Einträge der Stufe 1 mit `toxic` fehlten:
   Spitzmorchel roh, Stinktäubling, Gelbe Teichrose). „Giftig" ist jetzt EINE Funktion
   (`gsIstGiftig`) für Filter und Kachel, und jede Kachel öffnet die Liste, die sie zählt — E9 tippt
   sie an und vergleicht die Zahl mit den Treffern danach. Dabei: E9 las die Startkachel mitten in
   ihrer Hochzähl-Animation, sobald er früh lief (3'129 … 3'134) — er wartet jetzt, bis die Zahl steht.
   Und `scan_check` D1g verlangte für dieselbe Kachel noch die alte Regel (598): zwei Fälle, zwei Regeln —
   D1g rechnet jetzt die Regel des Filters mit eigenem Massstab nach.
4. ❎ nachgesehen 16.11.: kein Fehler — beide zählen dasselbe wie die Liste, die die Kachel öffnet (Verlauf + bestätigte Karten). **`stat-scans` hat zwei Schreiber;** Verdacht auf Doppelzählung. Fester Ersatzwert 4330.
5. ✅ v33.61 (bestätigt: ohne Bauernregel eine leere Folie mit Punkt; `scan_check` HK1) — **Karten-Stapel** (`gsBuildWidgetStack`): `wisdom-card` immer eingeblendet (leer ohne
   Bauernregel?), dreht alle 8 s ohne Pause-Knopf, `gsRenderWochenrueckblick` doppelt gerufen
   (nachgesehen: Tagesplan und erster Aufbau rendern dieselben Daten — kein Fehler).
6. ✅ v33.61 (`scan_check` HP1) — STATUS „N4": Hinweis auf der Startseite, wenn alle Pläne veraltet sind.
   Dabei: eine Pflanze mit `"sow_date": null` machte aus einem Plan einen Plan von 1970 (Kachel und
   Vorlage) — jetzt eine Jahresregel (`_gsPlanJahr`) für Kachel, Vorlage und Startseite.
7. ✅ v33.61 (`scan_check` HF1) — **„Wusstest du?" vom Server:** nur die ersten 30 von 192
   Fakten, Wochenfakten in jeder Woche, nur „<" escaped. Offen bleibt die Frage, ob die eigene
   Wochenliste (`WEEKLY_SEASONAL_FACTS`, nach `gsGetKW`) und die Server-Fakten EINE Auswahl sein
   sollen — heute ersetzt der Server die Liste, sobald er antwortet (so gewollt: „Supabase-Daily-
   Content überschreibt Hardcoded"). Der Inhaltsfehler „4342 Pflanzenarten" → Brett `2026-11-16-397d`.

## Gegnerische Prüfung (16.11.2026, Pakete 7891b1d..d030e40)

Sechs Befunde, alle nachgemessen und behoben (Einzelheiten STATUS, Eintrag 16.11.): eine Antwort nach
dem Abmelden (Lina zeigte und spiegelte sie, der Scanner speicherte sie unter dem nächsten Konto —
Fehlerklasse `2026-11-16-89ee`, Regel `_gsPerson`, CLAUDE.md §3.6); Linas Spiegel trug die Zeit des
Zeichnens; „Jetzt sammeln" mit Petersilie (Schierling) und dem Lärchen-Röhrling (ein Pilz als „baum");
die Menü-Suche ungetrimmt und mit Arten bei Menüwörtern; eine Prüfung auf eine Option, die niemand liest
(`rolle`); die Kartenreihe vergass die zuletzt gezeigte Karte. **Gelernt:** zwei der Prüffälle (HS3,
L9) waren grün, weil sie die Regel der App kopierten bzw. ihre Eingabe schon die Antwort enthielt —
Brett `c699`. Wer hier einen Fall baut, misst mit eigenem Massstab und realistischen Zeiten.

## Nebenfunde (nicht in den vier Funktionen)

- ✅ v33.71 — Das Lexikon (Wissen) schreibt `DB.length` (4'337 Einträge) unter „Arten" — CLAUDE.md §1
  verlangt `gsArtenZahlen()` (3'136 Arten). Gefunden 16.11.2026, gemessen und aufs Brett gelegt als
  `2026-11-16-4d79` (auch der Kopf-Chip des Wissen-Tabs, „Essbar" und „Giftig" mit eigenen Regeln);
  behoben 19.11. als Home 3.
- Standort-Fenster ohne Standort: im Dunkelmodus 1,51:1 (fest heller Kasten, kippende Schrift)
  → Brett `2026-11-16-a082`.
- Der Lärchen-Röhrling (T039, *Suillus grevillei*) steht als `baum` in der Artenliste, dieselbe Art
  fünfmal als `pilz` — Datenkorrektur für die Daten-Seite (Brett `2026-11-16-09f5`); die App erkennt
  ihn seit v33.61 trotzdem als Pilz (`_gsIstPilz`, über die Gattung).
- 18 KI-Wege ausserhalb der vier Funktionen warten auf eine Antwort, ohne danach die Person zu prüfen
  (Fehlerklasse `2026-11-16-89ee`, Liste dort).
- Nach „Alternative wählen" bleibt in `user_scans` die Zeile mit dem Namen der KI stehen
  (die Tabelle erlaubt kein Update). Dieses Gerät blendet sie über `ki_name` aus; ein zweites
  Gerät zeigt die erste Bestimmung. Ein Ersatz (neue Zeile mit demselben Foto anlegen, alte
  löschen — `DELETE` eigener Zeilen ist erlaubt) wäre der nächste Schritt. Ausgearbeitet und
  gemessen (RLS live: SELECT/INSERT/DELETE eigener Zeilen, kein UPDATE; 116 Zeilen von 4 Konten)
  als Brett-Idee `2026-11-16-34d2` — bewusst nicht gebaut, solange kaum jemand zwei Geräte nutzt.

## Reihenfolge

Scanner 1–3 und Lina 1–3 zuerst (jemand verliert Arbeit oder liest etwas Falsches), dann
Suche 1–4, dann Home. Ausgeliefert wird einzeln: jede Auslieferung ändert `GS_VERSION`,
`GS_RELEASES` und `sw.js`.

**Stand 19.11.2026 (nach Scanner 4 und Home 3):** in den vier Funktionen ist nur noch offen, was nicht
an dieser Sitzung hängt — Scanner 9 (der Abo-Zähler fürs Scannen, eine Entscheidung über
Pläne und Zahlung: Brett 2e3a) und der Pilz-Eintrag im Scan-Verlauf (Scanner 11, erst nach der
Datenseite: Brett a24a). Home 3 ist behoben (Wissen-Tab, Brett 4d79). Ein echtes
Abbrechen der KI-Anfrage (statt ihre Folge zu verwerfen) braucht ein Signal in `callAI` /
`callVisionAI` — Brett-Idee 8186, bei der Sitzung „KI-Modelle".
