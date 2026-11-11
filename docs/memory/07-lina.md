# 07 · Lina — was der KI-Coach sieht, darf und nicht kann

Lina ist ein Prompt plus ein Kontext plus ein Dispatcher — alles im Browser,
nichts auf dem Server ausser dem Gespraechsverlauf. Stand v33.34, gemessen.

## Der Weg einer Nachricht

```
gsLinaSend()                                index.html, grep "async function gsLinaSend"
 ├─ _gsNotfallStufe(text)                    Vergiftungs-Notfall in vier Sprachen → Nummer ZUERST, Antwort trotzdem
 ├─ gsLinaContext(text)                      Sprache · Pflanzenzahl (gsPflanzenZahl) · Region · Jahreszeit
 │    ├─ gsLinaZahlen()                       Faellig · Alarme · Messwerte · letzter Scan · Aussaatfenster · Plan-Termine
 │    └─ _gsLinaArtenZeile(text)              die Arten aus der FRAGE, geerdet ueber _gsArtenTreffer + _gsArtAnzeige
 ├─ callAI(hist.slice(-16), LINA_SYSTEM + ctx, 900)   kein Tool-Use: {model, max_tokens, system, messages}
 ├─ _gsLinaSicherheit(antwort, treffer)      Zusage „essbar" ueber eine Art mit tox ≥ 3 → Warnzeile darueber
 └─ gsLinaDispatch(aktion)                   EINE Textzeile am Antwortende, Whitelist, Schreiben nur nach gsConfirmModal
```

Ohne Netz oder Schluessel antwortet `getSmartAnswer` (Offline-Chat) — seine
Artkarte gilt nur, wenn `_gsArtenTreffer` dieselbe Art nennt.

## Was Lina SIEHT (Kontext, `gsLinaContext` + `gsLinaZahlen`)

| Zeile | Quelle | Deckel |
|---|---|---|
| SPRACHE | `gsI18n.getLang()` | — |
| Pflanzenzahl | `gsPflanzenZahl()` (beide Listen) | nur die ZAHL — Namen erscheinen nur in „Faellig" |
| Region, Jahreszeit | `gs_user_location.name`, Monat → 4 Werte | kein Datum, keine Hoehe |
| Faellig | `gsGetDueTasks().filter(days <= 0)` | 5 Namen + „+N weitere" |
| Alarme / Messwerte | `gsGeraete()`, `gsRegelnPruefen`, `gsMesswerte` — Rohwerte, nie gerundet | 4 Geraete, 3 Groessen, 3 Alarme, je mit „+N weitere“ (v33.39). Eine Regel im Zustand `nicht_pruefbar` ergibt NIE „keine verletzte Regel“ |
| Letzter Scan | `gs_scan_history` ueber `_gsScanZeit` (Zeit) und `_gsScanKonfidenz` (Sicherheit — 0.94 und 94 ergeben beide 94) | 1 Eintrag |
| Kalender heute · Nächste 7 Tage · Hinweise | `gsKalenderEreignisse(heute, +6 Tage)` — drei Zeilen, v33.39 | je 3 + „+N weitere“; Hinweise nur `verletzt` |
| Naechste Aussaat, Plan-Termine | `gsKalenderEreignisse(heute, +60 Tage)` | je 3 + „+N" |
| ARTEN | `_gsArtenTreffer(frage)` → `_gsArtAnzeige` je Art | `GS_LINA_ARTEN_MAX` 260 Zeichen |
| Gesamt | | `GS_LINA_ZAHLEN_MAX` 1000 Zeichen — seit v33.39 faellt EINE GANZE ZEILE, nie ein halber Satz (`_gsLinaDeckeln`), Reihenfolge und Fallordnung aus `GS_LINA_ZEILEN_RANG`, und „(+N Zeilen ausgelassen)“ steht dabei |

Was sie NICHT sieht (gemessen 15.09.2026): Gaerten und Beete (0 Treffer
`gardens`), Pflanzennamen ohne faellige Aufgabe, `nick`, Tagebuch, Ernten,
Saatgut, Uebungs-Lernstand, fruehere Gespraeche (nur die letzte Konversation, neueste
100 Zeilen, davon 16 an das Modell).

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

## Die fuenf Regeln, die fuer jeden Freitext-Weg gelten

1. **Erdung ueber `_gsArtenTreffer`** — ganzer Name oder Binomen an Wortgrenzen;
   der Umgangsname zieht seine Familie mit (18 Sambucus bis tox 4); bei
   mehreren Arten wird KEINE gewaehlt, es wird gesagt.
2. **Sicherheit rechnet der Code**, nicht der Prompt: `_gsLinaSicherheit`
   prueft jede Zusage („essbar", „kannst du roh essen", „Speisepilz", fr/it/en)
   gegen `tox ≥ 3` — Satz fuer Satz, am ROHEN Text (`_gsLinaNorm` streicht
   Satzzeichen). Gemessen mit den echten Saetzen, nicht ausgewaehlten.
3. **Der Notfall kommt VOR dem Sende-Riegel** und nimmt die Antwort nicht weg.
4. **Zahlen im Kontext sind Rohwerte aus einem Datensatz** — `sensor_check`
   „Lina" haelt jede Prozent-/Gradzahl gegen den Speicher. Eine Zahl, die in
   keinem Datensatz steht, ist eine Erfindung mit Dezimalstelle.
5. **Keine Prompt-Zeile ist eine Garantie.** Was gelten soll, wird im Code
   gerechnet und im Pruefstand gemessen (§4a.2). Der Prompt darf keinen Weg
   in der App nennen, den es nicht gibt (`nutzersicht_check` E2).

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
