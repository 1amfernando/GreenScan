# 02 · Die vierzehn Regeln — fuer jede Codezeile

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

5a. **Zwei Geräte, ein Konto: Pflanzen und Gärten werden je EINTRAG
   zusammengeführt, nie als ganze Liste ersetzt** (v33.66).
   `_gsMergeEintraege` (Stempel `geaendert`, Löschmarken `gs_geloescht`),
   gestempelt in `savePlantsToStorage` / `saveGardenData`, eingespielt über
   `_gsListeEinspielen`. Und: speichern heisst erst schreiben, dann melden —
   `=== false` nimmt den Eintrag zurück und sagt einen Satz.
   *(sync_check „Zwei Geräte", speicher_check, save_check)*

5a′. **Ein Blob geht erst hoch, wenn er gelesen wurde** (v33.68). `_flush` schiebt
   nur, was `_gsBlobGelesen[scope]` für diese Person trägt; ein Lesefehler ist nie
   „leer“ (`_gsGartenBlobLesen`). Pläne und Tracks: je Eintrag, mit Löschmarke
   (`_gsLoeschmarke`); state auf einem nie abgeglichenen Gerät: je Schlüssel
   gemischt (`_gsStateMischen`); ein ungelesenes Profil (`_ungelesen`) ist kein
   Cloud-Stand. *(CLAUDE.md §3.3; sync_check H8–H12)*

5a″. **Der Pflegeverlauf hat EINEN Deckel nach Zeit, und ein Foto ohne Upload wartet im
   Ausgangskorb** (v33.75). `p.diary` hat drei Schreiber; gedeckelt wird nur mit
   `gsCapWithArchive(…, GS_PFLEGEVERLAUF_MAX, 'zeit')`. Kein base64 in einem Eintrag
   einer Liste, die im Blob reist: `gsQueuePhoto(…, {kind:'diary', ref:'<pid>|<ts>'}, uid)`.
   `_gsApplyPhotoUrl` antwortet `true` · `false` (Ziel fehlt) · `'voll'` (bleibt im Korb);
   ein Hintergrund-Schreiber hebt den Stempel nicht (`_gsLeiseSpeichern`).
   *(CLAUDE.md §3.3, §3.5; kalender_check „Pflegeverlauf“, offline_check 9b)*

5b. **Eine Antwort nach einem `await` gehört der Person, die gefragt hat.**
   `sbLogout` lädt nicht neu. Wer nach einem `await` zeichnet oder schreibt, merkt
   sich vorher `_gsPerson()` und prüft danach, ob es noch dieselbe ist; was nur im
   Arbeitsspeicher liegt und einer Person gehört, räumt `gsOnLogout`.
   *(§3.6; sensor_check L10, scan_check SC3)* — Und dem VORGANG: wer abbrechen lässt
   oder einen neuen Vorgang über den laufenden startet, gibt jedem eine Nummer und prüft
   sie nach jedem `await` (`_gsScanNr`, `gsScanAbbrechen`). *(scan_check AB1–AB4)* — Und
   dem GESPRÄCH: kann die Person während des Wartens das Gespräch wechseln, zählt jeder
   Wechsel (`_gsLinaGespraechNr`), und Vorgeschichte, Gesprächs-Id und Antwort gehören dem
   Gespräch, in dem gefragt wurde — ist es nicht mehr offen, in die Cloud dorthin, mit einem
   Satz. *(sensor_check L12)* — Die Prüfung reicht bis zum Zeichnen, auch durch eine
   aufgerufene Funktion, die selbst wartet: auf sie warten und die Prüfung hineinreichen
   (`gsMushroomRenderResult(j, gilt)`, wartet in fr/it/en/es auf Übersetzungen). *(scan_check PZ7)*
   Seit 19.11.2026 ein TOR in `sbFetch` und `_gsAiAnfrage`: wechselt die Person, kommt
   keine Antwort an (`_gsPersonGewechselt`, Fehler `person_gewechselt`). Das Tor sieht
   nicht, was erst NACH dem Wechsel losgeht: die Person vor dem ERSTEN `await` merken,
   ein rohes `fetch` vor dem Senden und danach fragen, eine Schleife die uid einmal
   merken, ein `catch` zuerst `_gsPersonGewechselt(e)` fragen und still enden. Abmelden
   heisst derselbe Bildschirm wie nach einem Neuladen (`_gsAbmeldenFenster`,
   `_gsAbmeldenFelder`, `_gsAbmeldenStartseite`). *(sicherheit_check 71_person, 98_schluss_e)*

6. **Fremder Text ist Text, nie Code.** `escHtml(s)` fuer Text/Attribut,
   `_gsOcStr(s)` fuer Werte in `onclick="…"`, `gsSanitizeHtml(html)` fuer
   Fragmente mit erlaubter Auszeichnung, `_gsSafeUrl` / `_gsSafeLink` fuer
   Adressen. Wer eine neue Stelle baut, rendert sie einmal mit
   `<img src=x onerror="window.__pwned=1">` in `escape_check`. Ein `style` in
   einem Fragment geht nur durch die Erlaubnisliste `_gsStilSaeubern` — eine
   Verbotsliste auf dem Rohtext uebersieht CSS-Escapes (v33.54).
   Seit v33.59 je Kontext genau ein Helfer mehr: `_gsOcJson(x)` (Objekt oder
   Liste als Argument in einem `on*`-Attribut), `_gsFremdBild(u)` (Bild eines
   ANDEREN Nutzers: nur der eigene Supabase-Speicher oder `data:image`),
   `_gsCssUrl(u)` (Adresse in `url('…')` in einem `style`; kein `blob:`),
   `_gsEmoji(e)` (Emoji aus fremder Hand), `_gsIdSicher(id)` (Id in Attribut
   oder JS-String), `_gsKbText` / `_gsKbFarbe` (Wissens-Felder; eine Farbe nur
   aus der Erlaubnisliste — ein escaptes Attribut ist noch kein sicherer Wert),
   `_gsSiebListe` / `_gsSiebEintrag` (Backup und Cloud-Pull), `_gsArtEingang`
   (Arten aus fremder Hand), die Sprachschicht bereinigt Uebersetzungen am
   Eingang, `_gsCsvZelle` (keine Formel im Export),
   `_gsNachschlag(tabelle, schluessel, rueckfall)` (Tabelle mit einem Schluessel
   aus fremder Hand — nur eigene Eintraege, sonst liefert der Wert
   „constructor“ eine Funktion). `escHtml(0)` ist `''` — eine
   Zahl braucht `String(n)`. Neue Stellen rendern sich zusaetzlich in
   `sicherheit_check`. *(§3.6; escape_check, sicherheit_check)*

7. **KI nur ueber `callAI` / `callVisionAI`.** Kontext in den `systemPrompt`
   (`gsLinaContext()`), nie in `opts.brain` (ist nur ein Log-Label). Kein
   `fetch('https://api.anthropic.com')` ausserhalb von `gsTestApiKey`. Der
   Anthropic-Aufruf kennt KEIN Tool-Use — Lina handelt ueber eine Textzeile
   und `gsLinaDispatch` (Whitelist, Schreiben nur nach `gsConfirmModal`).
   Ob die KI erreichbar ist, fragt `gsKiVerfuegbar()` (Schluessel ODER Proxy)
   — nie `if (!key)`: seit dem 10.11.2026 hat kein Nutzer mehr einen Schluessel
   im Browser, und der Scanner sagte damit jedem „KI nicht erreichbar" (v33.57).
   Ein Modellname steht nur in `_gsClaudeFallbacks` (App) und `MODELL_KETTEN`
   (`_shared/modelle.mjs`); die Antwort liest `_gsAiText(data)`, nie
   `content[0].text`; ein neues Modell braucht seinen Zusatz (`modellZusatz` /
   `_gsModellZusatz`) — Sonnet 5.5 und 5 denken sonst von sich aus nach (v33.58).
   Serverseitig steht seit v33.59 vor jeder KI-Edge-Function dasselbe Tor
   (`kiTor` in `_shared/ki_tor.mjs`, Grenzen in `KI_GRENZEN`): Plan mit dem
   Token der Person, Reservierung VOR dem Aufruf, Rueckgabe, wenn der Anbieter
   nicht gerechnet hat, feste Fehlersaetze (die App kennt ihre Typen in
   `GS_KI_PROXY_SAETZE`). Fail-closed: ohne die Migration
   `20261110_sicherheit_ki_kontingent.sql` antwortet jede KI-Function 503 —
   erst die Migration, dann die Functions. Ein bezahlter Plan bekommt nie
   weniger als vorher. *(§3.4; schluessel_check, modell_check, edge_check 20_ki,
   sensor_check „Lina · handeln")*

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
    Und seit v33.59: ein Token aus der Adresse wird nie zur Sitzung
    (`_gsAuthRecovery` fragt zuerst den Server); die Backend-Adresse kommt
    nicht aus dem Speicher; `?screen=` nur fuer Bildschirme, die es gibt; eine
    Erfolgsmeldung nach einer Zahlung erst nach der Bestaetigung des Servers
    (`_gsBillingPruefen`), und eine Zahlung setzt nie einen Zustand, den ein
    Mensch bestaetigen soll. Edge-Functions importieren jede Abhaengigkeit mit
    EXAKTER Version (`edge_check` 40_lieferkette). *(§3.6, §3.3;
    sicherheit_check 70_sitzung, edge_check 10_stripe)*
13. **Eine Datei anbieten heisst `gsDateiSpeichern`, drucken heisst
    `gsDrucken` — und gemeldet wird nach dem Zustand.** Nie ein eigener Anker
    mit `download`, nie `window.open('')` + `document.write`, nie eine
    „heruntergeladen"-Meldung vor `_gsDateiAngekommen(r)`. In der
    Android-Huelle laufen beide ueber den Kanal `/__huelle/datei/` (ohne
    Bruecke); eine neue Export-Stelle traegt sich in die Liste `EXPORTE` in
    `apk_check` ein. *(§4d Punkt 5, apk_check E1–E10, v33.53)*
14. **Was von aussen kommt, wird GEZEIGT, nicht ausgefuehrt.** Ein Foto aus dem
    Teilen-Menue (oder je eine Eingabe aus fremder Hand) loest nie selbst einen
    Scan, ein Senden oder eine Zahlung aus: Vorschau, ein Satz, woher es kam,
    und ein Antippen. Gehoert es nicht zu DIESER Navigation (Einmal-Schluessel),
    wird es verworfen. Und eine Folge haengt nie an einem Schliessen, das die
    App selbst ausgeloest hat. Und der Knopf, der die Folge ausloest, nimmt
    erst nach einer kurzen Sperre an und hat keinen Fokus — der Tipp, der fuer
    die andere App gedacht war, zaehlt nicht. In der Android-Huelle derselbe
    Weg mit einer anderen Ablage (das Fach in `Geteilt.java`, zwei Schritte
    holen/quittieren, je Foto eine Nummer). *(§4e, offline_check 25–41,
    apk_check G1–G9/T0–T13, v33.55/v33.56)*
    Und was das Geraet verlaesst, verlaesst es ohne mehr als noetig (v33.59):
    Fotos ohne Metadaten (`_gsBildOhneMeta` an den Toren `gsUploadImage` /
    `gsUploadPhotoToBucket` und in `callVisionAI`; nicht lesbar = nicht
    hochladen), ein Ort an Dritte nur gerundet (`_gsOrtGrob`, ~1 km — gerundet
    wird die ADRESSE der Anfrage, nicht der gespeicherte Wert), ein oeffentlicher
    Name nie aus der E-Mail (`_gsOeffentlicherName`). Ein neuer externer Host
    steht in `scripts/sicherheit/97_empfaenger.js` UND in beiden
    Datenschutztexten. *(§3.7; sicherheit_check 90_datenschutz, 97_empfaenger)*

## Zehn Regeln aus v33.72 (CLAUDE.md §4f)

- **Ein Pull frischt auch den Arbeitsspeicher auf.** Speicher UND Variable
  gehen zusammen durch `_gsListeEinspielen` (§3.3) — sonst sieht das naechste
  Rendern eine leere Variable, und `initDefaultGarden` legt „Mein Garten" ueber
  das Geholte. Zwei Sitzungen haben das parallel gefunden (v33.59 auf `main`,
  v33.72 hier); es gilt der Eingang von `main`. *(sync_check)*
- **Eine Aufbereitung im Arbeitsspeicher haengt nie an einem Schalter im
  Geraetespeicher.** Die Artenliste wird bei jedem Start frisch gebaut; jeder
  Pruefstand beginnt mit leerem Speicher und misst die ERSTE Sitzung.
  *(robust_check „Zweite Sitzung")*
- **Beim Parsen wird formsicher gelesen:** `_gsListeLesen(key)`,
  `_gsObjektLesen(key)`, `safeGetItem(key, vorgabe)` haelt die Form der
  Vorgabe. `JSON.parse(x || '[]')` faengt weder `null` noch `{}`.
  *(robust_check „Kaputter Speicher")*
- **Jede benutzte CSS-Variable ist definiert.** `var(--x, rueckfall)` ohne
  Definition ist eine feste Farbe, die im Dunkelmodus nicht kippt.
  *(statik_check S6, contrast_check Durchgang 3)*
- **Lokal gemeint heisst `_gsDayKey()` / `_gsKalTag(d)`** — nie
  `toISOString().slice(0, 10)`; das ist in der Schweiz nachts der Vortag, und
  in UTC (hier, in CI) sieht man es nie. *(datum_check)*
- **Ein Pruefstand urteilt oder heisst Bericht.** `contrast_check`,
  `render_check` und `field_check` endeten immer mit 0 und urteilen seit
  v33.60 (parallel auch hier gefunden); nur `perf_check` ist bewusst ein
  Bericht.
- **`calc()` braucht Leerraum um + und −.** `calc(var(--a)+var(--b))` ist
  ungueltig, die Eigenschaft faellt still weg (Kopfleiste 39 statt 56 px; ein
  Knopf 10'499 px unter dem Bildschirm). *(statik_check S8)*
- **Was auf dem Anmeldebildschirm gebraucht wird, wohnt nicht in `#app`.** Wer
  von dort ein Fenster oeffnet, fragt `_gsAnmeldungSteht()` und haengt es an
  den `<body>` (Vorbild `openLegalModal`). *(robust_check „Rechtstexte vor der
  Anmeldung", statik_check S9)*
- **Die Kalenderwoche ist `gsIsoKW()`**, die Fakten einer Woche holt
  `_gsWochenFakten(kw)` — nie Sieben-Tage-Bloecke ab dem 1. Januar, nie ein
  eigener Rueckfall. *(datum_check T7)*
- **Vor dem Bump die Nummer gegen `main` halten** (`git fetch origin main`),
  und einen Fund gegen den Stand nachmessen, in den er einfliesst — diese
  Scheibe hiess v33.57, bis `main` die Nummer vergeben hatte.

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
- **Eine Attrappe, die mehr kann als das Original, prueft die Attrappe.** Die
  Supabase-Attrappe beantwortete jede Einbettung — der Webhook, der live jede
  Zahlung mit 500 beantwortet haette, war gruen (v33.59). Attrappen tragen die
  Live-Spalten und -Fremdschluessel und scheitern wie PostgREST; ebenso jeder
  Nachbau einer Datenbank: fehlt ihm eine Live-Policy, geht die Reparatur
  daran vorbei (`rls_check` 05_fixture_policies). *(§7.1)*
