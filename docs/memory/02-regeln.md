# 02 · Die zwoelf Regeln — fuer jede Codezeile

Jede Regel hat einen Grund, der einmal Geld gekostet hat (`05-fallen.md`), und
einen Pruefstand, der sie haelt (`04-pruefstaende.md`). Kurzform hier, das
Tagebuch in `CLAUDE.md`.

1. **Eine Frage, eine Funktion.** Faelligkeit: `gsGetDueTasks()` / `_gsTaskDays(t)`
   / `gsKalenderEreignisse(von, bis)`. Pflanze finden: `_gsPflanzeFinden(id)`
   (BEIDE Listen). Pflanzenzahl: `gsPflanzenZahl()`. Scan-Zeit: `_gsScanZeit(h)`.
   Art-Sicherheit: `_gsArtAnzeige(sp)`. Messgroessen-Name: `_gsMetricLabel(k)`.
   Wer eine zweite Rechnung baut, baut den Fehler von v32.87 nach.
   *(CLAUDE.md §3.3; kalender_check, nutzersicht_check E10)*

2. **Was der Code ausrechnen kann, entscheidet nie die KI allein.** Rechnende
   Regeln haben drei Zustaende: erfuellt · verletzt · **nicht pruefbar**
   (`null` mit Grund). Nie `{}` oder `0` fuer „keine Daten". Stille ist kein
   „erfuellt". Reihenfolge, wo ein Pruefwerk und ein Filter zusammenkommen:
   **Rechnung → Pruefwerk → Sieb → Anzeige** — ein Filter ist ein Sieb auf
   dem Ergebnis, nie eine Bedingung in der Rechnung.
   *(§4b, §4c, OEKOSYSTEM Regel 2; planer_check, kalender_check, sensor_check)*

3. **`sbFetch` wirft nicht.** Antwort mit `await`/`.then` lesen und
   `_gsSchreibOk(r)` pruefen — RLS lehnt mit 0 Zeilen und ohne Fehler ab.
   `Prefer: return=representation` fuer geprueftes Schreiben. Die Meldung an
   die Person kommt NACH der Antwort. Fehler in der Anzeige ueber
   `_gsFehlerText(err)`. *(§3.5; versprechen_check, save_check, robust_check)*

4. **`localStorage.setItem` wirft nie — es gibt `false` zurueck.** Ein
   `try/catch` darum ist tot. Rettungswege pruefen den Rueckgabewert.
   Grosse Listen selbst deckeln (`slice`). *(§3.5; speicher_check)*

5. **Jeder Schluessel hat einen Eigner, eine Liste und GENAU EINEN
   Schreiber.** Neuer
   `localStorage`-Schluessel → `GS_USER_KEYS` (wird beim Abmelden geraeumt)
   oder `GS_KEEP_ON_LOGOUT` (namentlich, mit Grund); Praefix-Familien in
   `GS_USER_PREFIXES` / `GS_KEEP_PREFIXES`. Soll er reisen: in den
   `state`-Blob auf HIN- und RUECKWEG (`_gsBuildStateBlob` + `stateMap`) und
   `markDirty('state')` am Schreiber. *(storage_check, sync_check)*

6. **Fremder Text ist Text, nie Code.** `escHtml(s)` fuer Text/Attribut,
   `_gsOcStr(s)` fuer Werte in `onclick="…"`, `gsSanitizeHtml(html)` fuer
   Fragmente mit erlaubter Auszeichnung, `_gsSafeUrl` / `_gsSafeLink` fuer
   Adressen. Wer eine neue Stelle baut, rendert sie einmal mit
   `<img src=x onerror="window.__pwned=1">` in `escape_check`. *(§3.6)*

7. **KI nur ueber `callAI` / `callVisionAI`.** Kontext in den `systemPrompt`
   (`gsLinaContext()`), nie in `opts.brain` (ist nur ein Log-Label). Kein
   `fetch('https://api.anthropic.com')` ausserhalb von `gsTestApiKey`. Der
   Anthropic-Aufruf kennt KEIN Tool-Use — Lina handelt ueber eine Textzeile
   und `gsLinaDispatch` (Whitelist, Schreiben nur nach `gsConfirmModal`).
   *(§3.4; schluessel_check, sensor_check „Lina · handeln")*

8. **Texte in vier Sprachen.** `_t(key, 'Deutsch')` mit Eintrag in
   `GS_I18N_JS_STRINGS` (derselbe deutsche Text an beiden Orten); ganze Saetze
   ueber `_gsSatz('… {1} …', wert)`; Datum mit `gsLocale()`, nie `'de-CH'`;
   Monate/Wochentage aus `gsMonate()` / `gsWochentage()`. `_t` ist NICHT
   global — jede Funktion bindet `gsI18n.t` selbst. *(i18n_check)*

9. **Jede gedeckelte Liste sagt „+N weitere".** Ein `slice(0, 3)` ohne
   Hinweis liest sich als vollstaendig. Ein Deckel schneidet an einer
   Zeilen- oder Wortgrenze, nie mitten im Wert. *(§7.1 Lina, v33.33 offen)*

10. **Eine Anzeige, die etwas behauptet, sagt, woher sie es weiss.** Quelle,
    Standort, Alter am Ereignis (`quelle`, `grund`). Eine Vorhersage bleibt
    eine Vorhersage; eine Schaetzung sagt „Schaetzung". *(§4a.3, KALENDER-V1)*

11. **Bei mehrdeutigen Arten gewinnt die Vorsicht.** Die Artenliste fuehrt 657
    Arten mehrfach; `_gsVorsichtigste(_gsArtGruppe(hit))` statt `DB.find`.
    Was WERTET (Quiz, Sammlung, Zaehler) geht durch `_gsArtAnzeige`. Freitext
    (Lina) erdet ueber `_gsArtenTreffer(text)` — nie ueber ein einzelnes Wort.
    *(scan_check D1, sensor_check „Lina · Arten")*

12. **Keine Geheimnisse im Code, keine Vergleiche mit `===` auf Schluessel.**
    Edge-Functions importieren `_shared/auth_vergleich.mjs`
    (`constantTimeEquals`); Admin entscheidet nur der Server
    (`rpc/is_admin_user`, `gsIsAdmin()`); Push-Sender importieren
    `_shared/push_helfer.mjs`. *(§3.6, robust_check Faelle 12–14)*
    Und jeder Admin-SCHREIBWEG geht durch `_gsAdmTun` (`GS_ADM_AKTIONEN`,
    sechs Zustaende mit Grund; 0 Zeilen am Tabellenweg sind eine Ablehnung,
    `return=minimal` gibt es dort nicht) — nie ueber rohes `sbFetch`.
    *(§7.1 admin_check, v33.50)*

## Und drei Regeln ueber das Arbeiten selbst

- **Beispieldaten sind die Messgrundlage von allem.** `scripts/_seed.js` wird
  gegen die LESESTELLEN in `index.html` geprueft (Schluessel UND Felder UND
  Zeitanker) — sonst misst jeder Pruefstand etwas anderes als die Sache und
  meldet gruen (v31.46, v32.46, v32.52, v33.02, v33.33).
- **Ein Fall, der nur eine Attrappe rendert, prueft die Vorlage — nicht die
  Ware.** Echte Daten in den Fall (nutzersicht_check E4b, sensor_check
  „Sicherheit" mit den gemessenen Saetzen).
- **Eine Zusammenfassung ist kein Diff.** Was als „fertig" weitergeschrieben
  wird, wurde vorher gegen `git show` gelesen (v33.33).
