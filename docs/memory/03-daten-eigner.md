# 03 · Daten-Eigner — wem welcher Zustand gehoert

Fuer jede Frage gibt es EINEN Ort, der sie beantworten darf, und EINE
Funktion, die dort liest oder schreibt. Wer daneben einen zweiten Ort anlegt,
baut die Falle aus `05-fallen.md` A nach. Die Tabelle ist `CLAUDE.md` §3.3 in
Kurzform; dort steht zu jeder Zeile die Geschichte.

| Frage | Eigner (Quelle) | Lesen / schreiben ueber | Nie |
|---|---|---|---|
| Wo ist die Person? | `localStorage.gs_user_location` | — | die globale `userLocation` (Alias) |
| Ist sie angemeldet? | `localStorage.gs_sb_token` | `sbIsLoggedIn()` | den Token im Code zwischenspeichern |
| Welcher Plan/Tier? | Supabase `v_user_entitlements` | Server | `localStorage` fuer Server-Entscheidungen |
| Ist sie Admin? | Server, `rpc/is_admin_user` | `gsIsAdmin()`, Spiegel `gs_is_admin` | eine E-Mail-Liste oder ein Hash im HTML |
| Welche Pflanzen hat sie? | `ps_myplants` (→ `myPlants`) UND `gs_plantings` (→ `plantings`) | `_gsPflanzeFinden(id)` sagt Liste + Speicherfunktion; Zahl ueber `gsPflanzenZahl()` | `myPlants.find` an einer neuen Stelle — die Haelfte fehlt |
| Was ist heute faellig? | `p.tasks[key] = {active, intervalDays, lastDone, snoozedUntil?, vorgezogenAuf?}` | `gsGetDueTasks()` (beide Listen, heute + 2 Tage) / `_gsTaskDays(t)` | `getDaysUntilDue` mit drei Argumenten (rechnet ohne Sensor) |
| Was ist an einem Tag? | dieselben Quellen + Tagebuch, Pflanzungen, Ernte, Wetter, Messwerte, Plaene, Kulturdaten | `gsKalenderEreignisse(von, bis)` — EINE Antwort, 9 Ereignisarten | eine eigene Schleife in einer neuen Anzeige |
| Was steht im Tagebuch? | Gartentagebuch + `p.diary` + Cloud-Spiegel `gs_garden_diary_cache` | `gsTagebuchAlle()`; loeschen `gsTagebuchDelete` (mit `_gsSchreibOk`) | eine vierte Quelle ohne den Fall „ohne Daten" in `kalender_check` |
| Was wurde gescannt? | `gs_scan_history` (`SCAN_HISTORY_KEY`), Deckel 200, Fotos nur auf 24 | Liste `_gsBuildScanHistList()`; Zeit `_gsScanZeit(h)` | ein Zeitfeld direkt (`ts`/`timestamp`/`createdAt` je nach Schreiber) |
| Was sagt Lina, was weiss sie? | Supabase `coach_conversations` / `coach_messages` (geraeteuebergreifend) | `gsOpenLina` (neueste 100), `gsLinaSend`; Kontext `gsLinaContext()` | `gsBrain` (entfernt), ein zweiter Chat |
| Welche Geraete, welche Messwerte? | `gs_geraete`, `gs_messwerte`, `gs_geraete_regeln`; gekoppelte Geraete: Supabase `devices` ist die Instanz | `gsGeraete()`, `_gsMesswerteAnhaengen` / `gsMesswertEintragen`, `gsRegelnPruefen(id)` (3 Zustaende) | `push` auf die Messwerte; Status eines gekoppelten Geraets lokal raten; `if (metric === …)` |
| Wie heisst eine Messgroesse? | Supabase `metric_catalog` → `gs_metric_catalog`, Rueckfall `GS_METRIC_KATALOG_START` | `_gsMetricLabel(k)` | `k.label_de` |
| Ist eine Art giftig / essbar? | die ART (alle Eintraege desselben Binomens), nicht der Eintrag | `_gsArtAnzeige(sp)`; `_gsVorsichtigste(_gsArtGruppe(hit))`; essbar: `gsIstEssbar(sp)` | `DB.find`, `sp.tox` direkt, `tox === 0` als „essbar" |
| Welche Art steht in einem Text? | Artenliste | `_gsArtenTreffer(text)` (ganzer Name/Binomen; Familie des Umgangsnamens; bei mehreren KEINE waehlen) | den Vergleich aus `getSmartAnswer` nachbauen |
| Welches Quiz heute, welche Serie? | `dqDayKey()` (UTC, wie der Server); `gs_dq_stats` | `dqStatsBuchen(correct)`, `dqSerie()` (die LEBENDE Serie), `dqNaechsteFrage()` | `stats.streak++`, lokale Mitternacht |
| Welche Lernkarten? | `gs_dq_training` | `gsTrainingLaden()` / `gsTrainingBuchen(schluessel, richtig)` | direkt schreiben; `gs_dq_stats` mitzaehlen |
| Welche Quiz-Kategorie? | `_shared/quiz_gen_regeln.mjs` (`QUIZ_KATEGORIEN` + Alias), gespiegelt `GS_QUIZ_KATEGORIEN` | `_gsQuizKatLabel(slug)` (unbekannt → leer) | den Slug roh anzeigen |
| Der Garten-Zwilling? | `gs_garden_twin` | `gsTwinGet` / `gsTwinSave`; `gsTwinNormalize` klemmt | direkt parsen; Meter (`x_m`) aufs Foto (`ix`) legen |
| Mischkultur? | Supabase `plant_companion_matrix` / `v_companion_lookup` | Planer (`_gsZuNah` ist die eine Abstandsregel) | eine Nachbarschaftstabelle im Code |
| Darf getrackt werden? | `gs_consent.analytics` (Opt-in) | `_gsAnalyticsErlaubt()`; Ereignisse nur aus `GS_EVENTS` | `analytics_events` ohne Ja; Fotos, Standort, Namen, Eingabetext |
| Der KI-Schluessel? | Server (`ai-proxy`); persoenlich `ps_api_key` | `_gsAiTarget`, `_gsAiAnfrage`; `getApiConfig()` gibt ohne Anmeldung nichts | ein globaler Schluessel im `localStorage` |

## Die vier Speicherlisten — jeder neue Schluessel steht in genau einer

| Liste | Bedeutung | wo |
|---|---|---|
| `GS_USER_KEYS` | wird beim Abmelden geraeumt | `grep -n 'var GS_USER_KEYS' index.html` |
| `GS_KEEP_ON_LOGOUT` | ueberlebt das Abmelden — namentlich, mit Grund | `grep -n 'var GS_KEEP_ON_LOGOUT' index.html` |
| `GS_USER_PREFIXES` / `GS_KEEP_PREFIXES` | Familien wie `gs_aicalls_<datum>` | daneben |
| Form statt Praefix | wenn ein Praefix Nachbarn mitnaehme (`GS_DQ_ALT = /^gs_dq_\d{4}-\d{2}-\d{2}$/`) | `gsClearUserDataKeys` |

`storage_check` meldet jeden Schluessel, der das Abmelden ueberlebt und in
keiner Liste steht. **Ein Schluessel aus Literal + `+` erklaert eine Familie**
— sie muss in eine Liste passen.

**Und ein Schluessel, dessen Inhalt eine FORM hat, hat GENAU EINEN
Schreiber** (v33.34). `gs_weather_cache` hatte zwei: der Wetter-Lader
schreibt `{ts, data, lat, lon}`, der Planer eine Karte
`{"lat,lon": {ts, data}}` — gelesen EINMAL beim Start, spaeter ganz
zurueckgeschrieben. Wer den Planer benutzte, warf den frischen Wetterstand
weg; Frost- und Regenzeilen im Kalender verschwanden, ohne dass etwas
meldet. Wer eine zweite Form braucht, braucht einen zweiten Schluessel
(`gs_weather_cache_planer`) — und der gehoert in eine der vier Listen.
Pruefstand: `robust_check` „Wetter-Zwischenspeicher · ein Schluessel, ein
Schreiber".

## Was zwischen Geraeten reist — und wie

Drei Blobs: `user_plants` · `user_gardens` · `user_app_state`, gebaut aus
`_gsBuildStateBlob` (Hinweg) und gelesen ueber `stateMap` im Pull (Rueckweg).
**Beide Wege pflegen** — ein Feld, das nur im Hinweg steht, reist nur zufaellig
(`gs_reminder_prefs`, v32.23); eines nur im Rueckweg nie. Der Schreiber ruft
`markDirty('state')` selbst (der Auto-Track ist durch den eigenen
`setItem`-Wrapper verdeckt). Der Pull MERGT, er ersetzt nicht (v32.36), und
ein leeres Cloud-Array oder -Objekt ersetzt keine gefuellte lokale Liste.
Dazu der Snapshot (Backup) — ein Zustand muss in BEIDE Blobs (v33.28).
`sync_check` liest die Schluesselliste aus dem Quelltext und meldet jeden ohne
Probewert.

## Was bewusst NICHT reist

Messwerte (`gs_messwerte`) — dafuer ist die Tabelle `device_readings` da.
Das Changelog-Archiv wird nicht vorgeladen. Die Warteschlangen in IndexedDB
(`pending_*`) tragen die `uid` des Einreichers; der Flush ueberspringt Fremdes,
loescht es nicht (v32.22).
