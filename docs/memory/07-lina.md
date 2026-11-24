# 07 · Lina — was der KI-Coach sieht, darf und nicht kann

Lina ist ein Prompt plus ein Kontext plus ein Dispatcher — alles im Browser,
nichts auf dem Server ausser dem Gespraechsverlauf. Stand v33.34, gemessen.

## Der Weg einer Nachricht

```
gsLinaSend()                                index.html, grep "async function gsLinaSend"
 ├─ _gsNotfallStufe(text)                    Vergiftungs-Notfall in vier Sprachen → Nummer ZUERST, Antwort trotzdem
 ├─ gsLinaContext(text)                      Sprache · Pflanzenzahl (gsPflanzenZahl) · Region · Jahreszeit
 │    │                                      Einblick aus (gsLinaEinblickAn): NUR Sprache, Jahreszeit, ARTEN — sonst nichts
 │    ├─ gsLinaZahlen()                       Faellig · Alarme · Messwerte · letzter Scan · Aussaatfenster · Plan-Termine
 │    └─ _gsLinaArtenZeile(text)              die Arten aus der FRAGE, geerdet ueber _gsArtenTreffer + _gsArtAnzeige
 ├─ callAI(hist.slice(-16), LINA_SYSTEM + ctx, 900)   kein Tool-Use: {model, max_tokens, system, messages}
 ├─ _gsLinaSicherheit(antwort, treffer)      Zusage „essbar" ueber eine Art mit tox ≥ 3 → Warnzeile darueber
 │    └─ _gsLinaTrefferMitPflanzen(text, t) dazu die Arten eigener Pflanzen, die die Frage (auch beim Spitznamen) nennt
 └─ gsLinaDispatch(aktion)                   EINE Textzeile am Antwortende, Whitelist, Schreiben nur nach gsConfirmModal
```

Ohne Netz oder Schluessel antwortet `getSmartAnswer` (Offline-Chat) — seine
Artkarte gilt nur, wenn `_gsArtenTreffer` dieselbe Art nennt.

## Der Spiegel und wem eine Antwort gehört (v33.61)

`gs_lina_verlauf` (in `GS_USER_KEYS`) hält das laufende Gespräch auf dem Gerät,
höchstens 40 Nachrichten, geschrieben nur von `gsLinaRender`. Er trägt die `uid`
(ohne Anmeldung wird nichts geschrieben, ein fremder Spiegel nie gelesen) und `ts` =
das Alter des INHALTS (aus der Cloud geladen: deren `updated_at`; unverändert: die
alte Zeit). Beim Öffnen gewinnt er nur, wenn er dasselbe Gespräch ist wie das
neueste der Cloud — oder eines, das sie nicht hat — UND jünger. Nach jedem `await`
fragen `gsOpenLina`, `gsLinaSend` und `gsLinaGespraechOeffnen`, ob noch dieselbe
Person angemeldet ist (`_gsPerson`). *(sensor_check L9, L10, L11)*

## Was Lina SIEHT (Kontext, `gsLinaContext` + `gsLinaZahlen`)

| Zeile | Quelle | Deckel |
|---|---|---|
| SPRACHE | `gsI18n.getLang()` | — |
| Pflanzenzahl | `gsPflanzenZahl()` (beide Listen) | die ZAHL — die Namen stehen im Einblick (unten) |
| Region, Jahreszeit | `gs_user_location.name`, Monat → 4 Werte | kein Datum, keine Hoehe |
| Faellig | `gsGetDueTasks().filter(days <= 0)` | 5 Namen + „+N weitere" |
| Alarme / Messwerte | `gsGeraete()`, `gsRegelnPruefen`, `gsMesswerte` — Rohwerte, nie gerundet | 4 Geraete, 3 Groessen, 3 Alarme, je mit „+N weitere“ (v33.39). Eine Regel im Zustand `nicht_pruefbar` ergibt NIE „keine verletzte Regel“ |
| Letzter Scan | `gs_scan_history` ueber `_gsScanZeit` (Zeit) und `_gsScanKonfidenz` (Sicherheit — 0.94 und 94 ergeben beide 94) | 1 Eintrag |
| Kalender heute · Nächste 7 Tage · Hinweise | `gsKalenderEreignisse(heute, +6 Tage)` — drei Zeilen, v33.39 | je 3 + „+N weitere“; Hinweise nur `verletzt` |
| Naechste Aussaat, Plan-Termine | `gsKalenderEreignisse(heute, +60 Tage)` | je 3 + „+N" |
| ARTEN | `_gsArtenTreffer(frage)` → `_gsArtAnzeige` je Art | `GS_LINA_ARTEN_MAX` 260 Zeichen |
| Gesamt | | `GS_LINA_ZAHLEN_MAX` 1000 Zeichen — seit v33.39 faellt EINE GANZE ZEILE, nie ein halber Satz (`_gsLinaDeckeln`), Reihenfolge und Fallordnung aus `GS_LINA_ZEILEN_RANG`, und „(+N Zeilen ausgelassen)“ steht dabei |

### Der Einblick (`gsLinaEinblick(frage)`, zweiter Block, eigener Deckel)

Seit dem Paket „Lina · Einblick" (Punkt 8) kennt Lina den Garten beim Namen.
Ein zweiter Block neben `gsLinaZahlen`, abschaltbar im Lina-Fenster
(`gs_lina_einblick = '0'`, in `GS_KEEP_ON_LOGOUT`; `gsLinaEinblickAn()`).

**„Aus" heisst aus** (Brett 6bbf, seit v33.74): ohne Einblick gibt `gsLinaContext` NUR Sprache,
Jahreszeit und die ARTEN der Frage weiter — keine Pflanzenzahl, keine Region, nichts aus
`gsLinaZahlen` —, und die KI erfährt, dass sie die Daten nicht kennt. Das bisherige Gespräch geht
weiter mit (`hist`), und die Sätze sagen das — „nur deine Frage" stimmte nicht (Prüfung von #347). Der Schalter steht im
leeren Verlauf UND als Zeile im laufenden Gespräch (`gsLinaEinblickSchalten`). Gelingt das
Speichern nicht (voller Speicher: `setItem` gibt `false`), gilt „aus" bis zum Neuladen
(`_gsLinaEinblickSitzung`), und ein Satz sagt es. Ein Ortsname, der eine KOORDINATE ist (der
Rückfall von `gsReverseGeocode`: „46.948°N, 7.447°E"), geht nie mit — `_gsOrtNameFuerKi`;
die Wetter-Zeile heisst dann „Wetter am gewählten Ort".

| Zeile | Quelle | Deckel |
|---|---|---|
| Braucht Hilfe | `gsPflanzenHilfe()` — Aufgabe ≥ `GS_HILFE_UEBERFAELLIG_TAGE` (2) im Verzug (`gsGetDueTasks`) oder Schaedling an der Pflanze in den letzten `GS_HILFE_SCHAEDLING_TAGE` (14) Tagen (`gsSchaedlingeNotiert`) | 4 + „+N weitere“; ohne Signal nennt die Zeile, WAS geprueft wurde — „kein Schädling" nur, wenn das Cloud-Tagebuch geladen ist (`gs_garden_diary_cache`) |
| Schädlinge im Tagebuch | `gsSchaedlingeNotiert()` über `gsTagebuchAlle` — `pest` und `pest_observation`; die Schreiber (`gsPestAddToDiary`, `gsDiaryAddEntry`) legen sie OHNE Pflanze in der Cloud an, `gsCloudTagebuchLaden` spiegelt sie | 3 + „+N weitere" |
| Im Detail — <Pflanze> | eigene Pflanzen, die in der FRAGE stehen (`_gsLinaPflanzenInFrage`: ganzer Name an Wortgrenzen, Mehrzahl-Endung) → Ort, Aufgaben (`_gsTaskDays`), 3 Tagebuch-Eintraege, Foto-ZAEHLER, Notiz | 2 Pflanzen, je `GS_LINA_DETAIL_MAX` 420 Zeichen — ganze Angaben fallen von hinten |
| Wetter <Ort> | `gs_weather_cache` (Rohwerte Open-Meteo), Schwellen aus `_gsWetterTage` | 3 Tage, 3 Warnungen. Nur wenn die Vorhersage zum gewaehlten Ort gehoert UND den heutigen Tag enthaelt |
| Pflanzen | beide Listen (`_gsLinaPflanzenAlle`) mit Ort | 8 + „+N weitere“ |
| Gärten | `gardens` + `plantings`, Art ueber `gsGartenArt` | 3 Gaerten, je 5 Pflanzungen |
| Frühere Scans | `gs_scan_history` ab dem zweitjuengsten (`_gsScanZeit`) | 3 |
| Funde auf deiner Karte | `greenscan_markers` (`_gsFundZeit`) — Name und Tag, nie die Koordinate | 4 |
| Gesamt | | `GS_LINA_EINBLICK_MAX` 1500 Zeichen, Zeilen fallen ganz (`_gsLinaDeckeln`) |

Derselbe `gsPflanzenHilfe()` speist den ersten Vorschlag im leeren Verlauf
(`gsLinaVorschlaege`). *(sensor_check „Lina · Einblick")*

Was sie weiterhin NICHT sieht: Fotos (nur den Zaehler), Koordinaten, Ernten,
Saatgut, Uebungs-Lernstand, fruehere Gespraeche (nur die letzte Konversation,
neueste 100 Zeilen, davon 16 an das Modell). Einen Gesundheits- oder
Wachstumswert einer Pflanze gibt es in der App nicht — also auch nicht im
Kontext.

## Was Lina DARF (`gsLinaDispatch`, 9 Faelle)

Lesend: `navigate`, `open_calendar {day}`, `open_saekalender`, `search_species`,
`prefill_form`. Schreibend, nur nach `gsConfirmModal`: `propose_add_plant`,
`propose_reminder` / `propose_task` (Intervall aus `TASK_DEFS`, Pflanze ueber
`gsLinaResolvePlant` → `_gsPflanzeFinden`, exakt) und seit v33.39
`add_calendar_note {day, text, plantName?}` — ein datierter Eintrag im
Gartentagebuch mit `quelle: 'lina'` und `bestaetigt_am`, geprueft am
Rueckgabewert von `gsTagebuchSave`; im Kalender steht er mit dem Grund „von
Lina vorgeschlagen, von dir bestaetigt am …“. Kein zweiter Speicher
(V1 Regel 2), und ein Filter-Argument gibt es bewusst nicht — Lina verstellt
nichts an der Wahl der Person. Unbekanntes Tool → nichts. Kein Loeschen, keine
Einstellungen, keine Rollen, keine Zahlungen — es gibt keinen Fall dafuer, also
keinen Weg. `sensor_check` prueft die lesenden Tools und ein erfundenes
(„Lina · handeln“), `add_calendar_note` (T1) und seit v33.39 auch die zwei
alten schreibenden (T2): Nein schreibt nichts, Ja genau eines.

## Die sechs Regeln, die fuer jeden Freitext-Weg gelten

1. **Erdung ueber `_gsArtenTreffer`** — ganzer Name oder Binomen an Wortgrenzen;
   der Umgangsname zieht seine Familie mit (18 Sambucus bis tox 4); bei
   mehreren Arten wird KEINE gewaehlt, es wird gesagt.
2. **Sicherheit rechnet der Code**, nicht der Prompt: `_gsLinaSicherheit`
   prueft jede Zusage („essbar", „kannst du roh essen", „Speisepilz", fr/it/en)
   gegen `tox ≥ 3` — Satz fuer Satz, am ROHEN Text (`_gsLinaNorm` streicht
   Satzzeichen). Gemessen mit den echten Saetzen, nicht ausgewaehlten.
   Seit v33.74 sieht sie auch die Art einer eigenen Pflanze, die die Frage beim Namen
   oder Spitznamen nennt („Lilli" = Maiglöckchen, `_gsLinaTrefferMitPflanzen` — auch bei
   ausgeschaltetem Einblick: die Pruefung laeuft auf dem Geraet), und eine giftige Art, die
   erst in der ANTWORT steht — dort nur mit ganzem Namen oder Binomen im selben Satz
   (sonst warnte „Ja, Petersilie ist essbar." vor der Hunds-Petersilie; gemessen).
   Seit Lina 11 liest EIN Leser die Giftnamen in Frage und Antwort: `_gsLinaGiftGenannt`
   (Mehrzahl, Fälle, „…blätter"; ein Name nur, wenn jeder Eintrag dieses Namens giftig ist;
   alle eigenen Pflanzen der Frage, auch über einen Ort). Pflegesätze („bedenkenlos
   zurückschneiden") sind keine Zusage, und in einem Gegensatz-Satz fällt eine Art aus der
   Warnung, die ein anderer Teil selbst giftig nennt („nicht giftig" zählt nicht).
3. **Der Notfall kommt VOR dem Sende-Riegel** und nimmt die Antwort nicht weg.
4. **Zahlen im Kontext sind Rohwerte aus einem Datensatz** — `sensor_check`
   „Lina" haelt jede Prozent-/Gradzahl gegen den Speicher. Eine Zahl, die in
   keinem Datensatz steht, ist eine Erfindung mit Dezimalstelle.
5. **Keine Prompt-Zeile ist eine Garantie.** Was gelten soll, wird im Code
   gerechnet und im Pruefstand gemessen (§4a.2). Der Prompt darf keinen Weg
   in der App nennen, den es nicht gibt (`nutzersicht_check` E2).
6. **Was aus Linas Antwort in die Oberflaeche geht, ist Fremdtext** — auch ein
   Feld, das „nur ein Emoji" ist (`emoji` einer angelegten Pflanze): `_gsEmoji`
   bzw. `escHtml` an der Senke (CLAUDE.md §3.6, v33.59). Und Linas Aufrufe
   laufen ueber `ai-proxy`; mit dessen Tor (nicht ausgeliefert, §3.4) zaehlen
   sie gegen das Tageskontingent des Plans, und eine Ablehnung kommt als fester
   Satz des Servers (`GS_KI_PROXY_SAETZE`), nicht als geratener aus dem Status.

## Was Lina architektonisch NICHT kann (und was deshalb nicht versprochen wird)

- **Push schreiben, Routinen fahren, „ueber Nacht" etwas tun**: 0
  Edge-Functions referenzieren `coach_messages`; Lina existiert nur im
  geoeffneten Tab. Frost-Push und Wochen-Zahl kommen vom Cron
  (`daily-push-checker`, `weather-alert-checker`), ohne Lina.
- **Bilder sehen**: `callVisionAI` gibt es, das Lina-Fenster hat keinen
  Foto-Weg; der Scanner ist der Weg zum Foto.
- **Praeferenzen lernen**: Es gibt keinen Ort fuer Praeferenzen der PERSON
  (`DEFAULT_PREFS` hat 9 technische Felder). Eine aus dem Verhalten ERRATENE
  Praeferenz waere eine Behauptung ueber die Person — nur ausdruecklich
  Angegebenes darf in den Kontext, und Gesundheitsnaehe (Allergien, Kinder)
  nie ungefragt.
- **Gespraeche uebergreifend erinnern**: Schema ohne Thema/Zusammenfassung;
  Inhalte sind das Sensibelste der App („mein Kind hat Beeren gegessen"). Ein
  Gedaechtnis ist eine Entscheidung der Person (Opt-in), keine Vorgabe.

## Wer Lina etwas Neues gibt

- Kontextzeile: in `gsLinaZahlen`, mit Deckel UND „+N weitere", ein Fall in
  `sensor_check` (Zahl gegen Datensatz, ohne Daten keine Zeile).
- Tool: ein `case` im Dispatcher, im Prompt deklariert (`GS_LINA_SCREENS` /
  Tool-Liste), schreibend nur mit `gsConfirmModal`, dessen Text VORHER und
  NACHHER nennt; Pflanze ueber `_gsPflanzeFinden`; ein Fall in `sensor_check`
  „Lina · handeln" — auch fuer die Ablehnung im Dialog.
- Nie: `gsTagebuchDelete` (die einzige loeschende Funktion ohne Rueckfrage,
  0 UI-Aufrufer) als Tool. Nie eine zweite Rechnung fuer etwas, das der
  Kalender beantwortet (`06-kalender.md`).
