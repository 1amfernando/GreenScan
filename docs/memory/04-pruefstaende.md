# 04 · Die 35 Pruefstaende — welcher fragt was

Alle liegen in `scripts/`, alle laufen ohne Netz (`file://` + Playwright aus
`scripts/package.json`); vier brauchen ein lokales Postgres
(`bash scripts/_pg_local.sh start`, Port 54329) und melden ohne es „nicht
pruefbar" (Exit 2), nie gruen. Alle auf einmal:

```
GS_PG_URL=postgresql://postgres@127.0.0.1:54329/postgres bash scripts/pruefstaende.sh
# Erwartung: "35 Pruefstaende · rot: 0 · nicht pruefbar: 0" — dasselbe faehrt die CI an jedem PR
```

Siebzehn der Playwright-Pruefstaende teilen die Beispieldaten in
`scripts/_seed.js` — dort aendern, nie im einzelnen Pruefstand.

| Pruefstand | Die Frage, die er stellt |
|---|---|
| `render_check` | sieht jeder der elf Tabs aus wie vorher? Vergleich zweier Staende (Radius, Schrift, Groesse, Farbe), verdaechtige Texte (`undefined`, `NaN`) muessen 0 sein |
| `render_check` | aktuellen Stand vermessen |
| `contrast_check` | WCAG-Kontrast jeder Textstelle, beide Modi |
| `touch_check` | Antippflächen unter 24×24 px (WCAG 2.5.8) |
| `perf_check` | Kaltstart unter Telefon-Drosselung (1×/4×/6×) |
| `wiring_check` | Verdrahtung: kommt an, was angetippt wird? (seit v31.45) |
| `field_check` | Formularfelder, die niemand liest (seit v31.74) |
| `data_check` | liest der Code Felder, die es nicht gibt? (seit v31.80) |
| `save_check` | kommt an, was gespeichert wird? (seit v31.85) |
| `planer_check` | rechnet der Planer, was er behauptet? (seit v31.93) |
| `scan_check` | glaubt der Scanner der KI aufs Wort? (seit v31.99) |
| `offline_check` | haelt die PWA, was sie ohne Empfang verspricht? (seit v32.13) |
| `backend_check` | ruft das Frontend etwas auf, das es nicht gibt? (seit v32.18) |
| `storage_check` | was ueberlebt das Abmelden? (seit v32.21) |
| `sync_check` | kommt zurueck, was hochgeladen wird? (seit v32.23) |
| `versprechen_check` | wer verspricht etwas, das niemand geprueft hat? (seit v32.28) |
| `einstellungen_check` | haelt der Schalter, was er verspricht? (seit v32.33) |
| `tour_check` | zeigt die App-Tour auf etwas, oder erzaehlt sie nur? (seit v32.39) |
| `kamera_check` | stimmt, was der Scanner ueber seine Kamera behauptet? (seit v32.29) |
| `arten_quellen_vergleich` | was sagen die zwei belegten Repo-Datensaetze zur Artenliste? (seit v32.43, nur Messung) |
| `speicher_check` | was tut die App, wenn der Geraetespeicher voll ist? (seit v32.44) |
| `kalender_check` | beantwortet der Kalender dieselbe Frage wie „Heute zu tun"? (seit v32.46) |
| `sensor_check` | funktioniert das Messwerte-Dashboard, bevor es ein Geraet gibt? (seit v32.48) |
| `ingest_check` | rechnet der Empfaenger device-ingest, was der Vertrag verspricht? (seit 05.09.2026, ohne Deno) |
| `sensor_push_check` | wird aus einem Sensor-Alarm ein Push, und nur einer? (seit 06.09.2026, ohne Deno) |
| `naht_check` | passen App, Empfaenger, Cron und Pusher zusammen? Spalten und Schluessel ueber die Naht (seit 06.09.2026). **Seit v33.41 mit einer SQL-Haelfte** (lokales Postgres, GS_PG_URL): die Sicht `v_plant_tasks_due` liest BEIDE Pflanzenlisten, und jede Sicht-Migration laesst sich WIRKLICH anwenden (DROP + CREATE; `CREATE OR REPLACE VIEW` darf Spalten nur anhaengen). Ohne Postgres „nicht pruefbar" (Exit 2), nie gruen |
| `loeschung_check` | raeumt „Konto loeschen", was der Dialog verspricht? Modul + datierte Momentaufnahme der Live-DB + Rand + App (seit v33.17) |
| `nutzung_check` | liest jemand, was die Nutzungsmessung schreibt? SQL (lokales Postgres) + App mit gestelltem sbFetch (seit v33.18) |
| `backup_check` | ist das Backup da, wenn man es braucht? Aufbewahrung (lokales Postgres) + die EINE Faelligkeitsregel (seit v33.26) |
| `quiz_gen_check` | kommt nur eine Frage in die Tabelle, die man auch anzeigen kann? Regeln in Node + Vorrat in lokalem Postgres + Anzeige (seit v33.29) |
| `quiz_check` | zaehlt der Server, was der Spieler richtig hatte? SQL in lokalem Postgres + App (seit v32.65; vorher `bash scripts/_pg_local.sh start`); seit v33.27 auch: wertet das Quiz nach der ART, zaehlt die Serie Tage, stimmt die Tagesgrenze der Anzeige, gehoert der Tagesschluessel dem Konto, erreicht der Zeitablauf den Server |
| `escape_check` | kommt Fremdtext als Text an, oder als Code? Feed, Artendetail, Mitteilungs-Links, SW, Sanitizer (seit v32.66) |
| `robust_check` | kleine Versprechen: sbFetch ohne opts, Toast-Dauer, Escape nur oberstes Fenster, SW wartet (seit v32.67); seit v32.73 auch die Fehlertexte (_gsFehlerText), seit v32.74 Admin-Gate und Alt-Sensor-Assistent, seit v32.75 das Push-Helfer-Modul, seit v32.76 species-search (Quelltext), seit v32.77 der Deckel gegen Funktionen ohne Aufrufer, seit v32.79 pdf.js nur bei Bedarf, seit v32.80 console.gsRestore(), seit v32.82 die optimistischen Anzeigen (Herz, Vitrinen-Stern, Stimme) und der Deckel gegen tote .catch() auf sbFetch; seit v33.34 „ein Schluessel, ein Schreiber" (Wetter-Zwischenspeicher) |
| `schluessel_check` | verlaesst der Anthropic-Schluessel den Server? SQL (lokales Postgres) + App (seit v32.68) |
| `nutzersicht_check` | sagt die App, was stimmt, in der Sprache der Person? Menue-Zahlen, „Was ist neu", Lina, Jargon, Kompakt/Senioren (seit v32.70) |
| `pruefstaende` | ALLE 35 nacheinander, ein Bericht, ein Exit-Code (seit v32.69; `schnell` laesst die vier langsamen aus) |

## Wie ein Fall gebaut wird (die Regeln, die alle 35 teilen)

1. **Erst der Fall, dann der Code.** Gegen den alten Stand gefahren muss er
   rot sein. Erst danach wird repariert.
2. **Der Fall stellt den Zustand her**, er schaltet ihn nicht um: Uhr
   (`page.clock.setFixedTime` VOR `addInitScript`), Speicher, Attrappen fuer
   `sbFetch` / `fetch` / `gsConfirmModal`. Was er stellt, stellt er im
   `finally` zurueck.
3. **Er misst die Wirkung**: gerendertes HTML (`textContent`), gespeicherter
   Wert, gesendeter Body — nicht das Objekt im Speicher.
4. **Beide Richtungen.** Ein Fall, der nur die Verneinung kennt, ist auch dann
   gruen, wenn die Funktion nichts mehr tut. Guter Fall und schlechter Fall;
   die Daten muessen die beiden denkbaren Regeln auseinanderziehen.
5. **Mit dem EIGENEN Massstab messen**, nicht mit der Funktion, die geprueft
   wird — sonst faellt der Fall gegen einen alten Stand nur mit „is not
   defined" durch.
6. **Eine Zahl daneben.** „308 Bedienelemente im Fenster" — drei verschiedene
   Zahlen fuer drei Fenster sind der Beleg, dass drei Fenster gemessen wurden.
7. **Gegenprobe**: die Reparatur zurueckbauen, der Fall wird rot, mit der
   echten Zahl. Nachsehen, ob der Rueckbau wirklich griff.
8. **Drei Klassen, nicht zwei**, wo es sie gibt: rot · bewusst (mit Grund,
   namentlich) · offen. Sonst wird der Pruefstand dauerhaft rot und damit
   wertlos (`backend_check`, `robust_check` OHNE_EINSTIEG).
9. **Eine Liste ist die Pruefung.** Wer einen neuen Weg baut, traegt ihn in
   die Liste des zustaendigen Pruefstands ein (`WEGE`, `SERVER_WEGE`,
   `GS_NOTIF_ZIELE`, `STORES`, `BEWUSST`, `_gsAppRuhig()`).

## Die Fallen beim Messen (je ein Satz; das Tagebuch hat den Rest)

- `.screen.active > *` animiert 420 ms — erst danach messen.
- `socialPosts`, `MENU_ITEMS` sind `let` im Skript-Bereich: in `page.evaluate`
  ohne `window.` zuweisen; `window.MENU_ITEMS` ist eine Variable, die es nie gab.
- `_t` ist nicht global; `gsI18n.t` ist die Schnittstelle.
- `page.evaluate` nimmt EIN Argument.
- Unter gestellter Uhr steht `Date.now()` still: eine Frist zaehlt Versuche.
- `gsLinaRender` baut das Panel neu — gemerkte Referenzen auf `#gs-lina-input`
  sind danach tot, und das Feld ist leer.
- Ein Pruefstand, der `scripts/*.js` als Korpus liest, findet SICH SELBST —
  eigene Datei ausnehmen.
- Ein Fall, der nach einer Loeschung misst, misst die Loeschung — Reihenfolge
  der Faelle in einem Lauf beachten.
- `Object.keys(localStorage)` zaehlt hier auch die eigenen Wrapper-Methoden;
  ueber `length` / `key(i)` zaehlen.
- Eine Zeichenkettensuche in einem Kontext voller Zahlen ist keine Messung —
  den Wert unverwechselbar machen (`ZZGARTENZZ`, `4711`).
