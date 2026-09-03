# Audit des Einstellungs-Bildschirms

> Erhoben am 03.09.2026 aus **sechs Blickwinkeln**. Jede Meldung wurde
> anschliessend von einem **gegnerischen** Durchgang angegriffen, der sie
> widerlegen sollte — nicht bestätigen. Was hier als *bestätigt* steht, hat
> diesen Angriff überstanden; die Begründung steht bei jeder Meldung.

**48 Meldungen · 35 angegriffen · 24 bestätigt · 11 widerlegt · 13 ohne Urteil.**

Die 11 Widerlegungen sind der Grund, warum es diesen Schritt gibt. Zweimal
stimmte die Beobachtung und die Folgerung nicht; einmal war die Voraussetzung
ein Zustand, den kein Browser herstellt. **Ein Treffer ist ein Verdacht, kein
Urteil** — und die 13 ohne Urteil brauchen ihre eigene Messung, bevor jemand
an ihnen arbeitet.

Die Zeilennummern stammen aus dem Stand v32.31 und sind seither verschoben —
sie sind ein Anhaltspunkt, kein Fundort. Der zitierte Code stimmt.

| Zeichen | Bedeutung |
|---|---|
| ✅ | behoben |
| 🔴 | bestätigt, offen |
| ⚪ | noch nicht angegriffen — erst messen, dann anfassen |
| ❌ | widerlegt — **nicht** anfassen ohne neue Messung |

## Überblick

| # | | Schwere | Meldung |
|---|---|---|---|
| 1 | ✅ | hoch | gsSubscribeWebPush meldet "🔔 Push-Notifications aktiv!" und laesst den Schalter an, ohne je nachzusehen, ob d |
| 2 | ✅ | hoch | Der GPS-Schalter zeigt "✅ GPS aktiv", waehrend die App in derselben Sitzung bereits weiss, dass der Browser di |
| 3 | ✅ | hoch | "Kamera immer neu abfragen" laesst genau EINE Bestaetigung zu — danach nie wieder, obwohl der Schalter an blei |
| 4 | ❌ | mittel | Der Push-Master zeigt "Status: aktiv" bei blockierten Benachrichtigungen — zwei Zeilen unter der Zeile, die ko |
| 5 | ❌ | mittel | Push-Kategorien: lokal abgewaehlt, auf dem Server unveraendert an — und die Anzeige spiegelt fuer immer nur de |
| 6 | ❌ | niedrig | gsUnsubscribeWebPush meldet "Push-Notifications deaktiviert", auch wenn der Server das Loeschen ablehnt. |
| 7 | ⚪ | niedrig | loadHomeWeather schreibt den Berechtigungs-Cache unter einen Schluessel, den keine Lesestelle kennt. |
| 8 | ⚪ | niedrig | "Standort immer neu abfragen" akzeptiert weiterhin eine bis zu 60 Minuten alte Position und gilt nur fuer eine |
| 9 | 🔴 | hoch | Die Zeile „🌦️ Wetter-Standort" speichert, bestätigt per Toast und wirkt auf nichts — ihr einziger Leser wird  |
| 10 | 🔴 | mittel | Neun Schlüssel in DEFAULT_PREFS werden bei jedem Speichern mitgeschrieben und in die Cloud gepusht — gelesen w |
| 11 | ❌ | mittel | Der ganze Analytics-/Consent-Apparat ist tot, und der eine Riegel darin steht auf „an": er prüft ein Feld, das |
| 12 | 🔴 | mittel | `gs_theme_color` wird an acht Stellen gepflegt, gesichert, wiederhergestellt und beim Konto-Löschen geschützt  |
| 13 | ❌ | niedrig | Zwei Einträge in `GS_KEEP_ON_LOGOUT` zeigen ins Leere: ein Schlüssel, den es nicht gibt, und ein „Schalter" oh |
| 14 | ❌ | niedrig | Die Artenzahl wird an zwei Elemente geschrieben, die es nicht gibt — und der Kommentar daneben führt beide als |
| 15 | ⚪ | niedrig | Der orange Farbpunkt in „App-Farbe" zeigt eine Farbe, die das Thema seit v31.32 nicht mehr benutzt. |
| 16 | 🔴 | hoch | gsPrefsPull ERSETZT den kompletten gs_prefs-Blob durch die Serverzeile, statt zu mergen — jede Einstellung, di |
| 17 | 🔴 | hoch | Kompakt- und Senioren-Modus loesen ueberhaupt keinen Push aus — sie stehen in keinem der beiden Sync-Wege |
| 18 | 🔴 | hoch | Was der Pull zurueckholt, WIRKT nicht — gsPrefsPull schreibt nur Speicher und Variable, ruft aber keine apply* |
| 19 | ❌ | mittel | Der Rueckweg des Nachtmodus ist einseitig: „dunkel an" reist, „dunkel aus" nicht |
| 20 | 🔴 | mittel | Nachtmodus und Sprache planen beim Umschalten keinen Push — der Auto-Track ueber STATE_KEYS ist tot, und an di |
| 21 | ❌ | mittel | gs_dark, gs_theme_color und gs_lang sind im Code ausdruecklich als GERAETE-Eigenschaft deklariert und werden t |
| 22 | ⚪ | mittel | Der Schalter „Standort immer neu bestaetigen" leert den Standort des KONTOS, nicht nur den des Geraets |
| 23 | ⚪ | niedrig | Die prefs-Verschachtelung waechst mit jeder Rundreise um eine Ebene — gsPrefsPull entfernt das jsonb-Unterobje |
| 24 | ✅ | hoch | Inhalt einer Karte, der nicht in einer `.settings-row` steht, wird von der Suche NIE ausgeblendet — er bleibt  |
| 25 | ✅ | hoch | 18 Bedienelemente im Smart-Push-Panel liegen ausserhalb jeder `.settings-row` und sind damit ueberhaupt nicht  |
| 26 | ✅ | mittel | `#settings-search-none` („Keine Einstellung gefunden.") erscheint gleichzeitig mit sichtbaren Einstellungen —  |
| 27 | ✅ | niedrig | Leere Karten-Huellen bleiben als duenne Striche stehen: 7 Karten a 2 px pro Suche. |
| 28 | ✅ | niedrig | Der Gruppentitel behaelt im Suchmodus `gs-collapsed` und `aria-expanded="false"`, obwohl die Suche den Abschni |
| 29 | 🔴 | hoch | „Alle Daten löschen" löscht nur gs_*/ps_* — die GPS-Fundorte (greenscan_markers) und userLocation bleiben lieg |
| 30 | ❌ | hoch | „Backup importieren" meldet Erfolg, ohne hinzusehen: 7 der 11 exportierten Bereiche werden nie zurückgeschrieb |
| 31 | ❌ | hoch | saveApiKey() nimmt jede beliebige Zeichenkette an — getApiConfig() verwirft sie danach stumm; ein leeres Feld  |
| 32 | 🔴 | hoch | Im Admin-Panel sperrt und beschenkt ein einziges onchange am Auswahlfeld — „🚫 Gesperrt" und „♾️ Lifetime" ohn |
| 33 | 🔴 | mittel | gsConfirmModal setzt den Fokus auf den Zerstör-Knopf, und Enter bestätigt — bei jedem einzelnen kind:'danger'- |
| 34 | ❌ | mittel | gsAdminAssignRole meldet „✅ Rolle zugewiesen" allein aufgrund von !r.error — obwohl sbFetch nicht wirft und di |
| 35 | ⚪ | mittel | „Konto löschen" verspricht „Alle Scans & Bilder" — räumt aber nur den localStorage; die IndexedDB-Warteschlang |
| 36 | ⚪ | mittel | gsSnapshotCreate macht aus einer leeren Serverantwort ausdrücklich einen Erfolg (return r.data \|\| true) — de |
| 37 | ⚪ | mittel | gsAdminSaveSbKey biegt die Datenverbindung der ganzen Installation um — ohne Rückfrage, ohne Testaufruf, mit e |
| 38 | ✅ | hoch | 22 von 77 Bedienelementen auf #screen-settings haben keinen zugänglichen Namen — darunter ALLE 11 Kippschalter |
| 39 | ✅ | hoch | Die sechs Farbfelder sagen zusätzlich nicht, WELCHES gewählt ist — der aktive Ton ist nur an einem Rahmen erke |
| 40 | ✅ | mittel | Die als „sticky" gebaute Einstellungs-Suche klebt nirgends — sie scrollt nach 139 px aus dem Bild und ist auf  |
| 41 | ✅ | mittel | Ein </div> zu früh in der Kopfzeile: Untertitel und Versionsnummer stehen NEBEN dem Titel statt darunter |
| 42 | ✅ | mittel | Bei 320 px Breite ragt die Versionsnummer 13 px über den Bildrand und wird von overflow-x:hidden abgeschnitten |
| 43 | ✅ | mittel | Knopf „🔔 Aktiv": weisse Schrift auf --g-main — im Dunkelmodus 2,36:1 statt der geforderten 4,5:1 |
| 44 | ⚪ | mittel | --accent ist in der ganzen Datei nie definiert; „12 h" fällt deshalb immer auf das feste #2e7d32 zurück und st |
| 45 | ⚪ | mittel | Die E-Mail-Adresse im Impressum löst beim Antippen ZWEI Dinge gleichzeitig aus und ist nur 103,6×14 px gross |
| 46 | ⚪ | niedrig | Der Regler „Wetter-Vorlauf" ist 342×16 px — 16 px hoch statt der geforderten 24 |
| 47 | ⚪ | niedrig | Die Versionszeile im Kopfbereich steht im Hellmodus bei 3,19:1 — Deckkraft auf TEXT senkt den Kontrast blind |
| 48 | ⚪ | niedrig | Drei Flächen im Einstellungs-Bildschirm kippen nicht mit dem Thema und leuchten im Dunkelmodus als helle Blöck |

## Berechtigungen (Push · GPS · Kamera)

### ✅ [1] gsSubscribeWebPush meldet "🔔 Push-Notifications aktiv!" und laesst den Schalter an, ohne je nachzusehen, ob der Server die Subscription angenommen hat.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 81418
- **Folge:** Der Nutzer sieht "Status: aktiv" und bekommt nie eine Benachrichtigung. daily-push, weather-alert-checker und engagement-push-checker lesen alle die Tabelle push_subscriptions — ohne Zeile gibt es kein Push. Und es korrigiert sich nie: gsPushSettingsRefresh (81559) setzt den Schalter allein aus der BROWSER-Subscription, die ja existiert. Der Schalter steht damit dauerhaft auf "an" fuer eine Funktion, die nie laeuft.

<details><summary>Beleg</summary>

```
81418:    await gsRegisterPushSubscription(sub);
81419:    if (typeof showProfileToast === 'function') showProfileToast('🔔 Push-Notifications aktiv!', 'success');

gsRegisterPushSubscription (81273) kann auf DREI Wegen lautlos nichts tun und gibt in keinem Fall etwas zurueck:
81274:  if (typeof sbIsLoggedIn !== 'function' || !sbIsLoggedIn()) return;
81276:  if (!uid || !subscription || typeof sbFetch !== 'function') return;
81288:      headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
81312:  } catch(e){ console.warn('[gsRegisterPushSubscription]', e); }

Das `catch` faengt nichts (sbFetch wirft nicht), und `return=minimal` macht die RLS-Ablehnung unsichtbar — genau die zwei Saetze aus CLAUDE.md §7.28. `_gsSchreibOk(r)` existiert seit v32.28 (30116) und wird hier nicht benutzt.

Gemessen (Lauf 2): sbFetch liefert {data: [], error: null} auf POST /rest/v1/push_subscriptions -> Toggle nachher: true, #push-status-sub: "Status: aktiv", Toast: "🔔 Push-Notifications aktiv!". Zweiter Fall, uid fehlt: gar kein POST, gleiches Ergebnis.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — statisch belegt und im Browser nachgestellt.

1) Die Zeile stimmt. index.html:81418 `await gsRegisterPushSubscription(sub);` gefolgt von 81419 `showProfileToast('🔔 Push-Notifications aktiv!', 'success')`. `gsRegisterPushSubscription` (81273-81313) hat auf KEINEM Pfad ein `return` mit Wert: drei stille Ausstiege (81274 nicht angemeldet, 81276 kein uid/sub/sbFetch) und das `await sbFetch(...)` bei 81286, dessen `{data,error}` nirgends angesehen wird. `sbFetch` (72725) bestaetigt die Repo-Regel: bei `!resp.ok` gibt es `return {error:{message:...}}` (72743), es wirft nie — das `catch` bei 81312 ist fuer genau diesen Fall toter Code. `_gsSchreibOk` (30116) existiert und wird an 24472/38244/39023/40292 benutzt, hier nicht.

2) Keine Tabelle, keine generische Schleife, kein Start-Aufruf faengt es ab. `gsRegisterPushSubscription` hat genau EINE Aufrufstelle in der ganzen Datei (grep: 81273 Definition, 81418 Aufruf, 7275 nur ein Doku-Bullet). Kein `pushsubscriptionchange`-Handler in sw.js oder index.html. `gsTogglePushMaster` (81499) entscheidet allein am BROWSER-Objekt `sub`; `gsPushSettingsRefresh` (81520, Auto-Lauf 2,8 s nach Boot bei 81568) setzt den Schalter aus `reg.pushManager.getSubscription()` (81555-81559) — die Browser-Subscription existiert, also bleibt "Status: aktiv" dauerhaft stehen.

3) Eigener Browser-Lauf mit dem fuer den Befund SCHWEREREN Fall (Server antwortet mit echtem Fehler, nicht mit stillen 0 Zeilen): sbFetch -> {error:{message:'new row violates row-level security policy'}}; Ergebnis: POST abgesetzt, Toast "🔔 Push-Notifications aktiv!|success", Toggle danach true, #push-status-sub "Status: aktiv", gsRegisterPushSubscription liefert undefined.

4) Folge ist real: alle Sender lesen die Tabelle (supabase/functions/daily-push, daily-push-checker, weather-alert-checker, engagement-push-checker, send-push). Ohne Zeile kein Push, waehrend die Einstellung "aktiv" zeigt. Einziger Hinweis waere der manuelle Test-Push-Knopf (81579, meldet 'no_subscription') — der korrigiert weder Schalter noch Registrierung.

5) Keine Absicht dokumentiert: der Kommentar ueber der Funktion (81270-81272) ist eine Schema-Notiz (v25.26 auth_secret), kein "best effort"; STATUS.md/ROADMAP.md/docs enthalten nichts dazu. Auch nicht von der Vorab-Pruefung abgedeckt — die betraf die Wiederherstellung der 14 Bedienelemente beim Aufbau, nicht den Schreibweg.

Eine Ungenauigkeit im Beleg, die das Urteil nicht aendert: bei einem POST-Insert macht `Prefer: return=minimal` eine RLS-Ablehnung nicht fuer sich unsichtbar (PostgREST antwortet dort mit HTTP-Fehler; ein Erfolg liefert 204 -> {data:{},error:null}). Da aber gar nichts an der Antwort gelesen wird, endet der Fehlerfall identisch — gemessen oben. Nebenwirkung fuer die Reparatur: `_gsSchreibOk` allein genuegt hier nicht, der Header muesste auf `return=representation`.
```

</details>

### ✅ [2] Der GPS-Schalter zeigt "✅ GPS aktiv", waehrend die App in derselben Sitzung bereits weiss, dass der Browser die Berechtigung verweigert.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 56467
- **Folge:** Wer die Standortfreigabe im Browser entzieht, sieht in GreenScan weiter einen gruenen Haken und den Satz "Standort wird automatisch erkannt". Der Schalter beantwortet nicht die Frage, die er stellt. Zusaetzlich gattert gsLiveTrackingStart (56609) auf genau dieses gsGpsIsGranted() und startet watchPosition auf einer Zusage, die das Betriebssystem nicht deckt.

<details><summary>Beleg</summary>

```
gsGpsUpdateToggleUI liest AUSSCHLIESSLICH den App-eigenen Schluessel:
56444:  return localStorage.getItem(GS_GPS_PERM_KEY) === 'granted';   // gsGpsIsGranted
56467:  if (tog) tog.checked = granted;
56473:    if (granted) { label.textContent = '✅ GPS aktiv — Standort wird automatisch erkannt'; label.style.color = '#2e7d32'; }

Den echten Zustand hat die App zu diesem Zeitpunkt schon: beim Start laeuft
26796:      gsCheckPermission('geolocation').catch(function(){});
und schreibt nach 26713/26714 `gs_perm_location` und `window.gsPermState.location`. Keine einzige Stelle gleicht die beiden Caches ab; `gs_gps_perm` wird nur von gsDoGetPosition (56579/56586) und gsGpsToggle (56488/56495) gesetzt.

Gemessen (Lauf 1), Permissions-API = 'denied':
  gpsLabel: "✅ GPS aktiv — Standort wird automatisch erkannt"
  gpsToggle: true
  ls_gs_gps_perm: "granted"   ls_gs_perm_location: "denied"
  gsPermState: {"camera":"denied","location":"denied",...}
Erst nach einem echten, fehlgeschlagenen gsGetPosition kippt es auf "❌ GPS deaktiviert".
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — Code, Ablauf und Sichtbarkeit alle bestätigt.

CODE (Zeilen um ~16 verschoben gegenüber der Meldung, Text identisch):
index.html:56460 gsGpsIsGranted() liest ausschliesslich localStorage 'gs_gps_perm'; 56482 tog.checked = granted; 56488 label = '✅ GPS aktiv — Standort wird automatisch erkannt'.

KEIN ABGLEICH: 'gs_gps_perm' hat im gesamten Repo nur 5 Stellen (56460, 56464, 56469 gsGpsSavePerm, 56503/56510 gsGpsToggle) und kommt in keiner anderen Datei vor. Alle 7 Aufrufer von gsGpsUpdateToggleUI (51471 Settings-Aufbau, 56450 openLocationSettings, 56470, 56504, 56511, 56768/56776, 56835) lesen weder window.gsPermState noch 'gs_perm_location'. gsGetCachedPermission (26731) wird nur von gsRequestCamera/gsRequestLocation benutzt — dem parallelen, zweiten Permission-System. Der ps.onchange-Handler (26722) schreibt nur den Schlüssel und aktualisiert keine UI.

MESSUNG (Playwright, realistischer Zweiphasen-Lauf, gs_gps_perm NICHT vorab gesetzt): Phase 1 Browser erlaubt → autoDetectLocation → gs_gps_perm='granted'. Phase 2 Freigabe entzogen + Neuladen → gs_gps_perm='granted', gs_perm_location='denied', gsPermState.location='denied', Label='✅ GPS aktiv — Standort wird automatisch erkannt', toggle=true. Zusätzlich gsLiveTrackingStart() → Rückgabe true und gs_live_tracking='1' trotz verweigerter Berechtigung (watchPosition meldet nur still).

SELBSTHEILUNG GIBT ES NICHT: auch der Knopf 'GPS-Standort automatisch ermitteln' korrigiert nichts — gsGetPosition (56543-56570) liefert bei vorhandener userLocation sofort den Cache und fragt den Browser nie.

SICHTBAR: ein Tipp aus den Einstellungen, index.html:6129 settings-row onclick="openLocationSettings()" → #modal-location, Label 6708 / Schalter 6711.

KEINE ABSICHT DOKUMENTIERT: kein Treffer für gs_gps_perm / gsGpsIsGranted / 'GPS aktiv' in STATUS.md, ROADMAP.md, docs/. Die Kommentare 56455/56517 begründen das Cachen, nicht die Behauptung 'wird automatisch erkannt'.

Zwei Einschränkungen (keine Widerlegung): (a) der Schalter liegt in #modal-location, nicht unter den 14 Elementen von #screen-settings — wird aber vom Settings-Aufbau mit aktualisiert (51471). (b) Auf iOS Safari ist navigator.permissions.query({name:'geolocation'}) nicht unterstützt; dort weiss die App den echten Zustand nicht vorab — das falsche Label bleibt dennoch falsch, nur der Halbsatz 'weiss es bereits' gilt dort nicht.
```

</details>

### ✅ [3] "Kamera immer neu abfragen" laesst genau EINE Bestaetigung zu — danach nie wieder, obwohl der Schalter an bleibt.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 27762
- **Folge:** Der Schalter verspricht eine Bestaetigung pro Anfrage und liefert eine einzige, beim allerersten Scan. Wer ihn aus Datenschutzgruenden einschaltet, glaubt ab dem zweiten Scan an einen Schutz, den es nicht gibt — und fuer den Pflanzendoktor und den Garten-Scan gab es ihn nie.

<details><summary>Beleg</summary>

```
6164 (Untertitel des Schalters): "Statt zu merken — jede Anfrage bestätigen. Standard: aus."

27757:  var granted = cameraPermGranted;
27762:  if (alwaysAsk && !granted) {
27763:    // Nur beim ERSTEN mal Dialog — nicht bei jedem Öffnen
27764:    showCameraPermDialog(tryStartCamera, {...});

und vier Zeilen tiefer im Erfolgsweg von tryStartCamera:
27837:    try { cameraPermGranted = true; localStorage.setItem('gs_cam_perm','granted'); } catch(e){}

Gemessen (Lauf 3), Schalter ueber gsCamAlwaysAskToggle(true) eingeschaltet:
  Scan 1: dialoge=1, cameraPermGranted danach true
  Scan 2: dialoge=0
  Scan 3: dialoge=0     (schalterNochAn: true in allen drei)

Dazu: gsCamAlwaysAsk() wird an genau EINER Stelle gelesen (27756). Es gibt 12 weitere getUserMedia-Aufrufe (u.a. Pflanzendoktor 35277, Garten-Scan 56938, Sortier-Kamera 35689, 34681, 58197, 83757), die den Schalter nicht kennen. Und gsCamAlwaysAskToggle raeumt nur den einen Cache weg —
56690:    try { localStorage.removeItem('gs_cam_perm'); } catch(e){}
waehrend gs_perm_camera / gsPermState.camera, die gsRequestCamera (26735) auswertet, stehen bleiben.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — der Kern des Befunds haelt jeder Gegenprobe stand. (Achtung: index.html wird gerade parallel bearbeitet, `git status` zeigt " M"; alle Zeilennummern unten sind zum Zeitpunkt meiner Pruefung frisch nachgemessen und liegen ~14 Zeilen ueber denen des Befunds.)

1) CODE STEHT DA — aber an anderer Zeile. Bei 27762 steht heute `} catch(_){ cb(null); }` (Ende von gsCheckCamPermissionThen). Der behauptete Code steht wortgleich 14 Zeilen tiefer:
  27770: try { alwaysAsk = (typeof gsCamAlwaysAsk === 'function') && gsCamAlwaysAsk(); } catch(e){}
  27771: var granted = cameraPermGranted;
  27776: if (alwaysAsk && !granted) {
  27777:   // Nur beim ERSTEN mal Dialog — nicht bei jedem Öffnen
Auch die Schreibstelle liegt anders als behauptet: nicht "vier Zeilen tiefer" (27837), sondern 27861 — und zwar in tryStartCamera, ~85 Zeilen weiter. Ebenso gsRequestCamera = 26747 (nicht 26735) und die getUserMedia-Stellen = 34719, 35315, 35729, 37305, 56976, 58235, 83806 (Befund nannte sie ~38–49 Zeilen frueher). Reine Zitier-Ungenauigkeit, kein Sachfehler.

2) KEINE ENTLASTENDE STELLE GEFUNDEN. Vollstaendige Suche nach cameraPermGranted: gelesen an 27771, 37294 (Pflanzendoktor) und 56969 (Garten-Scan); auf true gesetzt an 27861, 34723 (showCameraPermDialog), 35324, 35729; auf false NUR an 56729 (gsCamAlwaysAskToggle beim Einschalten). Es gibt keine Tabelle, keine Schleife, keinen Start-Aufruf und keine Verfallszeit, die das zuruecksetzt. `gs_cam_perm` wird ausserdem in GS_KEEP_ON_LOGOUT (78453 f., "Geraete-Berechtigungen … Eigenschaft des Browsers") ausdruecklich als bleibend gefuehrt — der Zustand ueberlebt also auch Neuladen und Abmelden. gsCamAlwaysAsk() wird an genau EINER Stelle gelesen (27770); die 13 getUserMedia-Aufrufe kennen den Schalter nicht.

3) EMPIRISCH REPRODUZIERT (Playwright, file://, gestelltes getUserMedia, Schalter via localStorage gs_cam_always_ask='1'):
  Scan 1: dialoge=1, cameraPermGranted danach true, gs_cam_perm='granted'
  Scan 2: dialoge=0
  Scan 3: dialoge=0   (schalterNochAn: true in allen drei)
Deckt sich exakt mit der Messung des Befunds.

4) NICHT ALS ABSICHT BEGRUENDET. Der Kommentar 27777 beschreibt die Sperre, begruendet sie aber nicht gegen die Beschriftung. In STATUS.md, ROADMAP.md und docs/ steht zu "immer neu abfragen"/always_ask nichts. Der Untertitel bei 6175 lautet unveraendert "Statt zu merken — jede Anfrage bestätigen. Standard: aus." Das Gegenstueck fuer GPS setzt genau diese Semantik um (56555: `allowCached = false; force = true;` bei JEDEM Aufruf) — die Kamera-Seite ist die Ausnahme, nicht der Entwurf.

5) BEMERKBAR — und schaerfer als beschrieben. Seit v31.50 ist showCameraPermDialog gar kein ablehnbarer Dialog mehr (34686 ff.): es zeigt einen gsToast mit der Begruendung und ruft nach 900 ms selbst getUserMedia. Der Schalter liefert also nicht einmal EINE echte Bestaetigung, sondern EINEN einmaligen Hinweis-Toast — danach nie wieder, geraetweit und ueber Sitzungen hinweg, waehrend der Schalter sichtbar an bleibt (gsUpdateAlwaysAskUI stellt ihn korrekt wieder her).

Nebenbefund (nicht der Befund selbst): das `try/catch` um 27861 und 56728 ist nach der Repo-Regel toter Code — localStorage.setItem/removeItem wirft nie.
```

</details>

### ❌ [4] Der Push-Master zeigt "Status: aktiv" bei blockierten Benachrichtigungen — zwei Zeilen unter der Zeile, die korrekt "❌ Verweigert" sagt.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 81559
- **Folge:** Dieselbe Einstellungskarte macht gleichzeitig zwei gegenteilige Aussagen. Wer die Benachrichtigungen im Browser sperrt, sieht den Smart-Push-Schalter weiter auf "aktiv" samt aufgeklapptem Kategorien-Panel — und stellt dort neun Kategorien ein, von denen keine je ankommt.

<details><summary>Beleg</summary>

```
81559:    toggle.checked = !!sub;
81560:    if (statusSub) statusSub.textContent = sub ? 'Status: aktiv' : 'Status: aus';
81561:    if (detail) detail.style.display = sub ? '' : 'none';

Weder hier noch in gsPushSupportStatus (81363, prueft nur serviceWorker/PushManager/iOS-Version) kommt `Notification.permission` vor. Gefragt wird ausschliesslich pushManager.getSubscription().

Gemessen (Lauf 4), Notification.permission = 'denied' bei vorhandener Subscription:
  pushMasterToggle: true
  statusText: "Status: aktiv"
  detailPanelSichtbar: true
  notifPermStatusZeile: "❌ Verweigert – in Browser-Einstellungen freigeben"
```

</details>

### ❌ [5] Push-Kategorien: lokal abgewaehlt, auf dem Server unveraendert an — und die Anzeige spiegelt fuer immer nur den lokalen Wert.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 81459
- **Folge:** Der Server-Cron liest notify_frost aus der Tabelle, nicht aus dem Telefon. Die Abwahl ist damit dauerhaft wirkungslos und dauerhaft unsichtbar: der Nutzer bekommt weiter Frostwarnungen und sieht daneben eine leere Checkbox. Es gibt keinen Weg, den Widerspruch zu bemerken.

<details><summary>Beleg</summary>

```
81459:  try { localStorage.setItem('gs_push_settings', JSON.stringify(cur)); } catch(_){}
...
81478:    await sbFetch('/rest/v1/push_subscriptions?user_id=eq.' + encodeURIComponent(uid), {
81479:      method: 'PATCH',
81480:      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
81481:      body: JSON.stringify(patch)
81482:    });
81483:  } catch(e) { console.warn('[gsSavePushSettings]', e); }

Die Antwort wird nie angesehen; `Prefer: return=minimal` macht eine RLS-Abweisung ohnehin unsichtbar. Und beim naechsten Aufbau gewinnt der lokale Wert:
81537:    if (el) el.checked = (s[k] !== false);      // s = JSON aus localStorage

Gemessen (Lauf 4): PATCH liefert {error:{message:'permission denied',status:403}} -> Checkbox "🥶 Frostgefahr" bleibt aus, gs_push_settings = {"frost":false}; nach gsPushSettingsRefresh() ist sie immer noch aus.
```

</details>

### ❌ [6] gsUnsubscribeWebPush meldet "Push-Notifications deaktiviert", auch wenn der Server das Loeschen ablehnt.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 81441
- **Folge:** Die Browser-Subscription ist zwar wirklich weg, aber der Datensatz mit den GPS-Koordinaten bleibt liegen — nach einer Handlung, die dem Nutzer ausdruecklich bestaetigt hat, dass sie ausgefuehrt wurde. Aufgeraeumt wird er erst, wenn ein Push-Versand 410/404 zurueckbekommt (daily-push-checker:105).

<details><summary>Beleg</summary>

```
81441:          await sbFetch('/rest/v1/push_subscriptions?user_id=eq.' + encodeURIComponent(uid) +
81442:            '&endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE' });
...
81446:    if (typeof showProfileToast === 'function') showProfileToast('Push-Notifications deaktiviert', 'info');
81450:  } catch(e) { console.warn('[gsUnsubscribeWebPush]', e); }

Gemessen (Lauf 2, Fall D): sbFetch liefert {error:{status:403}} -> Toast "Push-Notifications deaktiviert", #push-status-sub "Status: aus", Toggle aus.

Die Zeile traegt gps_lat/gps_lng des Nutzers (81295/81296, aus gs_user_location).
```

</details>

### ⚪ [7] loadHomeWeather schreibt den Berechtigungs-Cache unter einen Schluessel, den keine Lesestelle kennt.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 23129
- **Folge:** Der Startseiten-Wetterblock holt bei 23116 selbst eine Position — mit Erfolg. Danach weiss die App davon nichts: weder gs_gps_perm noch gs_perm_location aendern sich, der Standort-Schalter bleibt auf "⚪ GPS noch nicht eingerichtet". Ein toter Schreibvorgang, der so aussieht, als wuerde er den Cache pflegen.

<details><summary>Beleg</summary>

```
23129:        try { localStorage.setItem('gs_perm_geolocation', 'granted'); } catch(_){}

Gelesen wird aber `gs_perm_location`:
26727:  var key = name === 'geolocation' ? 'location' : name;
26729:  try { return localStorage.getItem('gs_perm_' + key) || 'unknown'; } catch(_){ return 'unknown'; }

Saemtliche Treffer fuer 'gs_perm_geolocation' im Repo: dieser Schreibvorgang (23129) und die Bleibt-Liste GS_KEEP_ON_LOGOUT (78427). Keine Lesestelle.
```

</details>

### ⚪ [8] "Standort immer neu abfragen" akzeptiert weiterhin eine bis zu 60 Minuten alte Position und gilt nur fuer einen von vier GPS-Wegen.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 56594
- **Folge:** Der Untertitel sagt "Statt zu merken — jede Anfrage bestätigen" (6146). Tatsaechlich darf der Browser eine Stunde alte Koordinaten zurueckgeben, und drei der vier Standort-Abfragen der App sehen den Schalter gar nicht erst an. Wer ihn einschaltet, bekommt weder eine neue Messung noch eine Nachfrage.

<details><summary>Beleg</summary>

```
56517:    if (typeof gsGpsAlwaysAsk === 'function' && gsGpsAlwaysAsk()) {
56518:      allowCached = false;
56519:      force = true;

Das umgeht nur den APP-Cache. Weitergereicht wird an gsDoGetPosition, und das fragt fest mit:
56594:    { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 }

gsGpsAlwaysAsk() wird an genau einer Stelle gelesen (56517, in gsGetPosition). Direkt an navigator.geolocation, am Schalter vorbei: 23116 (Startseiten-Wetter), 64336 (gsGardenScanGPS), 53333 (Tour-Aufzeichnung), 26767 (gsRequestLocation).
```

</details>

## Tote Einstellungen — geschrieben, nie gelesen

### 🔴 [9] Die Zeile „🌦️ Wetter-Standort" speichert, bestätigt per Toast und wirkt auf nichts — ihr einziger Leser wird nirgends aufgerufen.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 6438
- **Folge:** Wer im Einstellungs-Bildschirm „Mein Garten" oder „Manuell" als Wetter-Standort wählt, bekommt ein grünes Häkchen im Auswahlfeld und die Bestätigung „🌦️ Wetter-Standort: Mein Garten" — und sieht danach exakt dasselbe Wetter wie vorher. Der Balkon in Zürich und der Garten im Wallis zeigen dieselbe Frostwarnung. Ein Fenster, das eine Wahl bestätigt, die es nicht umsetzt, ist schlimmer als gar keine Wahl: niemand meldet es als Fehler, weil das Wetter ja plausibel aussieht.

<details><summary>Beleg</summary>

```
Zeile: `<div class="settings-row" id="settings-weatherloc-row" … onclick="…gsOpenWeatherLocPicker()">` (6438) · Untertitel „Automatisch · Mein Garten · Manuell" (6443).
Schreiber: `gsSetWeatherLocMode` (56298) → `localStorage.setItem('gs_weather_loc_mode', mode)` (56300), dann `gsToast('🌦️ Wetter-Standort: ' + lbl, 'success', 2000)` (56303) und `loadHomeWeather()` (56304).
EINZIGER Leser von `gs_weather_loc_mode`: `gsGetLocationFor(context)` (56278–56295):
'''
if (context === 'weather') {
  var mode = 'auto'; try { mode = localStorage.getItem('gs_weather_loc_mode') || 'auto'; } catch(_){}
  if (mode === 'garden') return _gardenLoc() || _loc();
  if (mode === 'manual') { … JSON.parse(localStorage.getItem('gs_weather_loc_manual')||'null') … }
'''
`grep -n gsGetLocationFor index.html` liefert GENAU zwei Zeilen: 56278 (Definition) und 56296 (`window.gsGetLocationFor = …`). **Keine Aufrufstelle im ganzen Repo.**
Die tatsächlichen Wetter-Lader fragen den Modus nie: `loadHomeWeather` (23070) löst selbst auf — Kommentar 23075: „Priority: gs_user_location (Einstellungen) > gs_home_weather_loc > GPS > Default"; `gsGetWeatherLocation` (11520, benutzt von `loadGardenWeather` 11563) ebenso.
Zusätzlich ist `gs_weather_loc_manual` (gelesen 56291) **nirgends geschrieben** — die Option „Manuell" kann nie einen Wert haben.
Browser-Lauf (Playwright, file://, _seed.js): `gsSetWeatherLocMode('garden')` → `gs_weather_loc_mode = "garden"`, danach alle elf Tabs + `loadHomeWeather()` + `loadGardenWeather(true)` + `gsGetWeatherLocation()`; instrumentierter Zähler auf `gsGetLocationFor`: **0 Aufrufe**. `_gsWeatherLat/_gsWeatherLon = 47.3769/8.5417` — die Profil-Koordinaten aus `gs_user_location`, nicht der Garten.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — statisch und im Browser bestätigt. Die Zeilennummern stimmen nicht (Drift um 15–38 Zeilen), die Substanz schon.

BELEGE:
1) Zeile 6453 (nicht 6438): `<div class="settings-row" id="settings-weatherloc-row" style="cursor:pointer;" onclick="if(typeof gsOpenWeatherLocPicker==='function')gsOpenWeatherLocPicker()">`, Untertitel „Automatisch · Mein Garten · Manuell". Im Lauf sichtbar (display:flex, 63 px hoch nach Aufklappen).

2) `gsGetLocationFor` steht bei 56316 (Definition) und 56334 (`window.gsGetLocationFor = …`). Ein repo-weites, case-insensitives grep nach „locationfor" über index.html, sw.js, scripts/, data/, supabase/ liefert GENAU diese zwei Codezeilen; sonst nur Prosa in sw.js:251 (Changelog), FULL_APP_AUDIT_v28.03.md, data/releases.v1.js:4085, V28_FULL_AUDIT_FINDINGS.md:304. Keine dynamische Auflösung (`window['gsGet…']`) vorhanden.

3) Alle FÜNF Wetter-Verbraucher lösen selbst auf, keiner liest den Modus: gsGetWeatherLocation (11534, benutzt von loadGardenWeather 11571) → userLocation/gs_user_location; loadHomeWeather (23084) → gs_user_location > gs_home_weather_loc > GPS > IP > Zürich; gsAttachMushroomForecast (22485) → gs_user_location; fetchWeather (69453) → getippter Ort; gsOpenWeatherWarn (84125, DIE Frostwarnung) → userLocation, Fallback 47.37/8.55.

4) Browser-Lauf (file://, _seed.js, Garten in Sion 46.2276/7.3589, Profil Zürich): gsGetLocationFor('weather') liefert korrekt {lat:46.2276, lng:7.3589, source:"garden"} — der Helfer funktioniert. Zeile antippen → Picker öffnet (gs-nl-modal), „🌳 Mein Garten" klicken → gs_weather_loc_mode="garden", ✓ wandert zur Option. Danach gsGetWeatherLocation() + loadHomeWeather() + loadGardenWeather(true): _gsWeatherLat/Lon/City = 47.3769 / 8.5417 / "Zürich", UNVERÄNDERT. Instrumentierter Zähler auf gsGetLocationFor: 0 Aufrufe.

5) gs_weather_loc_manual: kein setItem/gsStore.set irgendwo im Repo (einziger Texttreffer ist V28_FULL_AUDIT_FINDINGS.md:306 — dort in einem VORGESCHLAGENEN Fix, nicht im Code). Nach dem Lauf: null.

WIDERLEGUNGSVERSUCHE, DIE FEHLSCHLUGEN:
- Tabelle/generische Schleife? Nein. gs_weather_loc_mode kommt nur 4× vor: Lesen 56327, Schreiben 56338, Häkchen-Lesen 56348, sowie 78484 in einer Schlüsselliste fürs Abmelden/Nutzerwechsel (ohne Verhaltenswirkung).
- Absicht/begründet? Nein. V28_FULL_AUDIT_FINDINGS.md:303–306 führt NUR den engeren Teilfall („Toter LS-Key gs_weather_loc_manual") als [MEDIUM DEC] und schlägt einen Fix vor — also als Bug dokumentiert, nicht als Entscheidung. Der grössere Defekt (der Helfer wird gar nie aufgerufen, „Mein Garten" ist ebenso wirkungslos) steht nirgends. sw.js:251 und data/releases.v1.js:4085 bewerben das Feature als ausgeliefert.
- Nur theoretisch? Nein. Der Picker bestätigt mit ✓ und Toast; gsOpenWeatherWarn (Frostwarnung) liest userLocation — ein Zürcher Profil mit Walliser Garten bekommt die Zürcher Frostwarnung.

KORREKTUREN AM BEFUND: Zeilennummern 6438→6453, 56278→56316, 56296→56334, 56298→56336. Und der „Manuell"-Teil war seit v28.03 bereits als Bug protokolliert (V28_FULL_AUDIT_FINDINGS.md:303–306) — was ihn nicht entkräftet, aber der Befund sollte es erwähnen.
```

</details>

### 🔴 [10] Neun Schlüssel in DEFAULT_PREFS werden bei jedem Speichern mitgeschrieben und in die Cloud gepusht — gelesen wird keiner davon.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 51064
- **Folge:** Neun Felder, die niemand auswertet, reisen bei jedem Einstellungs-Klick in zwei getrennte Cloud-Tabellen. Teuer ist nicht der Platz, sondern die Irreführung: Wer `user_preferences.prefs` in der Datenbank ansieht, liest `safetyWarnings: true` und `pestTips: true` und glaubt, es gebe abschaltbare Giftwarnungen und Schädlings-Tipps. Der v29.21-Kommentar sagt ausdrücklich das Gegenteil („Giftwarnung nicht abschaltbar (immer an)"). Das ist genau die Hälfte der Aufräumarbeit, die v31.11 an der `toggleMap` erledigt hat — die Datenquelle wurde beide Male vergessen.

<details><summary>Beleg</summary>

```
`DEFAULT_PREFS` (51058–51076) enthält weiterhin:
'''
  fontSize:     16,
  lang:         'de',
  waterNotif:   true,
  weatherNotif: true,
  marketNotif:  true,
  socialNotif:  true,
  harvestNotif: true,
  pestTips:     true,
  safetyWarnings: true,
'''
Die zugehörigen Schalter wurden in v29.21 aus dem DOM entfernt — die Kommentare stehen noch an Ort und Stelle: 6243 („v29.21 SET-01: 4 tote In-App-Notif-Toggles (waterNotif/weatherNotif/marketNotif/socialNotif) entfernt") und 6353 („SET-04: tote Toggles Ernte-Benachrichtigungen (harvestNotif) + Schädlings-Tipps (pestTips)"). In v31.11 wurden dieselben Namen zusätzlich aus der `toggleMap` gestrichen (Kommentar 51434–51439). **Die Datenquelle blieb beide Male stehen.**
`grep -n "userPrefs\.(waterNotif|weatherNotif|marketNotif|socialNotif|harvestNotif|pestTips|safetyWarnings)"` → 0 Treffer. `userPrefs.lang` → 0 Treffer (die Sprache liegt in `gs_lang`). `userPrefs.fontSize` wird zwar gelesen (51373, 51411, 51421), aber nur an `applyFontSize`, und das ist ein dokumentierter Leerlauf (51272–51277): „Funktion als No-Op belassen für Legacy-Calls … return;".
Browser-Lauf, `localStorage.gs_prefs` nach einem einzigen `applyTheme('purple')`:
'''
{"theme":"purple","fontSize":16,"darkMode":false,"compact":false,"units":"metric","lang":"de",
 "waterNotif":true,"weatherNotif":true,"marketNotif":true,"socialNotif":true,"harvestNotif":true,
 "showMoon":true,"homeWeather":true,"pestTips":true,"safetyWarnings":true,"scanHistory":true,"achFeed":true}
'''
Dieser Blob geht über `gsPrefsPushNow` (81788) in `user_preferences.prefs` (81810: `patch.prefs = freeBlob;`) und über den Snapshot (79609 `prefs: _j('gs_prefs','{}')`) in `user_app_state`.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT. Alle tragenden Behauptungen reproduzieren bei HEAD (20390df, v32.31, Arbeitsbaum sauber). Die Zeilennummern des Berichts stimmen jedoch DURCHGEHEND NICHT — korrigiert unten.

BELEG 1 — Die Datenquelle (korrigiert: 51096–51114, nicht 51058–51076):
51096 `const DEFAULT_PREFS = {` · 51098 `fontSize: 16,` · 51102 `lang: 'de',` · 51103–51107 `waterNotif/weatherNotif/marketNotif/socialNotif/harvestNotif: true,` · 51110 `pestTips: true,` · 51112 `safetyWarnings: true,`. Der Kommentar-Beleg liegt bei 6257/6367, nicht 6243/6353.

BELEG 2 — Der Schreibweg, den der Bericht nicht nennt (das ist die eigentliche Mechanik):
51168 `userPrefs = { ...DEFAULT_PREFS, ...safeGetItem('gs_prefs', {}) };` und 51177 `gsStore.set('gs_prefs', JSON.stringify(userPrefs));`. `savePrefs()` serialisiert das GANZE Objekt — jeder `savePref` schreibt also zwangsläufig alle neun Schlüssel mit.

BELEG 3 — Browser-Lauf reproduziert den Blob EXAKT wie behauptet. `gs_prefs` war vorher `null`; nach einem einzigen `savePref('showMoon', true)`: `{"theme":"green","fontSize":16,...,"lang":"de","waterNotif":true,...,"safetyWarnings":true,...}`. Alle neun Schlüssel drin.

BELEG 4 — Zwei Cloud-Tabellen bestätigt. 81848 `gsPrefsPushNow` baut `freeBlob` aus dem KOMPLETTEN `gs_prefs` und löscht daraus nur `GS_PREFS_KNOWN_COLUMNS` (language/region/altitude_m/reminders_enabled/push_enabled/email_enabled/digest_freq/units) → 81869 `patch.prefs = freeBlob;` → `fn_user_prefs_save`. Zweiter Weg: 79669 `prefs: _j('gs_prefs','{}'),` in den Snapshot (`user_app_state`). Der Bericht nannte 81788/81810/79609 — falsch, Inhalt aber verbatim korrekt.

WIDERLEGUNGSVERSUCHE, ALLE GESCHEITERT:
· Generischer Leser? `Object.keys/entries/values(userPrefs)` und `for…in userPrefs` → 0 Treffer. `_gsApplyPref` (51220ff.) ist eine Kette fester `if (key === …)`-Fälle: homeWeather, showMoon, darkMode, fontSize, theme, language/region/altitude_m, units, reminders_enabled. Keiner der sieben Notif-Schlüssel kommt vor.
· Server-Leser? `grep -rnE "waterNotif|…|safetyWarnings"` über das GANZE Repo außerhalb index.html trifft nur Kommentare (sw.js:134, data/releases.v1.js, A_Z_AUDIT json) und keine SQL-/TS-Zeile. In `supabase/` gibt es genau zwei `prefs`-Zugriffe: die Spaltendefinition (v26_69) und der Deep-Merge (v27_03). Kein `prefs->>'…'` irgendwo.
· `lang` doch gelesen? Nein. Die Sprache lebt in `gs_lang` (13697, 13928, 15750, 33959, 38048, 51419). `gsHandleLangChange` schreibt `localStorage gs_lang`, ruft NIE `savePref('lang',…)`. Die strukturierte Cloud-Spalte heißt `language`, nicht `lang`.
· Absicht dokumentiert? Nein. STATUS.md, ROADMAP.md und docs/ enthalten weder `DEFAULT_PREFS` noch einen der Schlüssel. Der v28.95-Audit führte die Toggles als „checked" mit `findings: []` — vor v29.21. Der sw.js-v29.21-Kommentar bestätigt sogar die Prämisse des Befunds wörtlich: „schrieben in userPrefs, das NIRGENDS gelesen wird" — entfernt wurden aber nur die Toggles, nicht die Quelle.

DREI EINSCHRÄNKUNGEN, die den Befund nicht kippen, aber in den Bericht gehören:
1. Der TITEL ist für `fontSize` unpräzise: es WIRD gelesen (51228, 51411, 51449, 51459), aber ausschließlich als Argument an `applyFontSize`, und das ist ab 51312 ein dokumentierter Leerlauf (51314 „Funktion als No-Op belassen für Legacy-Calls", 51315 `return;`). Der Fließtext des Befunds sagt das selbst korrekt — 8 von 9 sind buchstäblich ungelesen, der neunte wirkungslos.
2. KEINE Nutzer-Wirkung. Rein Hygiene/Irreführung, ~120 Byte je Sync. Nichts ist sichtbar kaputt.
3. Die genannte FOLGE wird durch ein Aufräumen von DEFAULT_PREFS allein NICHT behoben: `fn_user_prefs_save` merged mit `prefs || EXCLUDED.prefs` (v27_03_user_prefs_save.sql:45) und LÖSCHT nie; `gsPrefsPull` (81823–81825) merged den Cloud-Blob zurück in `gs_prefs` und in `userPrefs`. Bestandszeilen und Bestandsgeräte tragen `safetyWarnings: true` also weiter. Eine echte Abhilfe braucht zusätzlich eine Sperrliste in `gsPrefsPushNow` (analog zu `GS_PREFS_KNOWN_COLUMNS`, 81842–81846) und ein einmaliges `prefs - 'safetyWarnings' - …` auf den bestehenden Zeilen.
```

</details>

### ❌ [11] Der ganze Analytics-/Consent-Apparat ist tot, und der eine Riegel darin steht auf „an": er prüft ein Feld, das nirgends geschrieben wird.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 81855
- **Folge:** Der Einstellungs-Bildschirm hat eine Zeile „Datenschutz", die nur einen Rechtstext öffnet — eine Analytics-Wahl gibt es nirgends, obwohl zwei Dokumente sie beschreiben. Solange `gsTrackEvent` nirgends aufgerufen wird, fliessen keine Daten; genau deshalb fällt es niemandem auf. Der Tag, an dem jemand die Funktion verdrahtet (sie ist als `window.gsTrackEvent` öffentlich exportiert), sendet sie ohne Einwilligung — der Riegel lässt sie durch, weil `prefs.privacy` undefined ist. Ein revDSG-Riegel, dessen Schlüssel niemand schreibt, ist kein Riegel.

<details><summary>Beleg</summary>

```
`gsTrackEvent` (81850–81871) ist der einzige Schreiber von `analytics_events`:
'''
var prefs = {};
try { prefs = JSON.parse(gsStore.get('gs_prefs', null)||'{}'); } catch(_){}
if (prefs && prefs.privacy && prefs.privacy.analytics === false) return;
'''
1. `prefs.privacy` wird nirgends geschrieben. `grep -n privacy index.html` liefert im JS-Teil GENAU diese eine Zeile (81855); die übrigen Treffer sind Beschriftungen (6623 „Datenschutz / nDSG Datenschutzerklärung", 14816, 77005). Es gibt kein `privacy`-Feld in `DEFAULT_PREFS` (51058) und keine Oberfläche, die eines setzt. Der Riegel ist also ein Opt-OUT ohne Ausstieg — er greift nur bei explizitem `false`, und `false` kann niemand erzeugen.
2. `grep -c gsTrackEvent index.html` → **1**. Nur die Definition, keine einzige Aufrufstelle. Es wird heute also gar nichts gesendet.
3. `grep -n gs_consent index.html` → **eine einzige Zeile**, 78410: `'gs_consent',         // revDSG-Consent — Re-Login soll ihn nicht zuruecksetzen` in `GS_KEEP_ON_LOGOUT`. Kein Schreiber, kein Leser. `grep -n consent index.html` (klein wie gross) → ebenfalls nur diese eine Zeile: **es gibt kein Consent-Banner.**
Dem stehen zwei Behauptungen gegenüber: CLAUDE.md §3.7 („Analytics ist Opt-In (Consent-Banner beim ersten Launch) … Check via: `gs_consent.analytics === true` ODER `gs_prefs.privacy.analytics === true`") und SETTINGS_AUDIT_v27.03.md:32 („Analytics-Consent (revDSG) | gs_consent.analytics | Consent-Banner | ✅ separat"). `scripts/_seed.js:21` setzt `gs_consent` sogar brav — für einen Schlüssel, den die App nicht kennt.
```

</details>

### 🔴 [12] `gs_theme_color` wird an acht Stellen gepflegt, gesichert, wiederhergestellt und beim Konto-Löschen geschützt — geschrieben wird der Schlüssel nie.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 51289
- **Folge:** Acht Stellen der Sicherungs- und Abmelde-Logik halten einen Schlüssel am Leben, der nie einen Wert hat: `ui.theme_color` reist bei jedem Snapshot als `null` in die Cloud, die Wiederherstellung ist ein Leerlauf, und der Schutz beim Konto-Löschen bewahrt nichts. Praktisch geht die Farbe nicht verloren (sie hängt an `gs_prefs.theme`) — der Schaden ist, dass eine Audit-Tabelle im Repo diesen Weg als geprüft ✅ ausweist. Der nächste, der eine Farb-Einstellung debuggt, sucht sie zuerst dort.

<details><summary>Beleg</summary>

```
Die App-Farbe wird ausschliesslich in `userPrefs.theme` abgelegt — `applyTheme` (51279–51291):
'''
  if (save) {
    userPrefs.theme = themeName;
    savePrefs();
  }
'''
Kein `setItem('gs_theme_color', …)` existiert. `grep -n gs_theme_color index.html` liefert nur Verbraucher:
· 77601 `var keepKeys = ['gs_dark', 'gs_theme_color', 'gs_lang'];` — beim Konto-Löschen bewahrt
· 78406 in `GS_KEEP_ON_LOGOUT` („// Theme-Farbe")
· 79167 `try { ui.theme_color = localStorage.getItem('gs_theme_color'); } catch(_){}` — liefert immer `null`
· 79610 `ui: { dark: _s('gs_dark'), theme_color: _s('gs_theme_color'), lang: _s('gs_lang') }`
· 78824 `if (sd.ui.theme_color) try { localStorage.setItem('gs_theme_color', sd.ui.theme_color); }` — die Bedingung wird nie wahr
· 79837 `_gsRestoreKey('gs_theme_color', st.ui.theme_color)`
· 79374 / 79451 — Scope-Zuordnung und Snapshot-Liste
Browser-Lauf: vor dem Wechsel `gs_theme_color = null`; nach `applyTheme('purple', null)` steht `gs_prefs.theme === "purple"` und `gs_theme_color` ist **weiterhin `null`**.
SETTINGS_AUDIT_v27.03.md:17 führt genau diesen Weg als erledigt: „Theme-Color | gs_theme_color | user_app_state.ui.theme_color | applyAllPrefs | ✅" — `applyAllPrefs` (51370–51389) fasst den Schlüssel nirgends an.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — statisch, dynamisch und historisch bestaetigt.

1) ZEILEN STIMMEN INHALTLICH, NICHT NUMERISCH. Die genannte Zeile 51289 liegt tatsaechlich in `applyDarkMode` (`userPrefs.darkMode = isDark;`). `applyTheme` steht bei 51319-51331, nicht 51279-51291; alle Beleg-Greps sind um ~60 Zeilen versetzt (tatsaechlich: 77661, 78466, 78884, 79227, 79434, 79511, 79670, 79897). Der ZITIERTE Code ist aber wortgleich vorhanden — Zeilendrift eines aelteren Arbeitsstands, kein falscher Befund. Der einzige Mangel des Befunds.

2) KEIN SCHREIBER — statisch. `applyTheme` (51326-51329) enthaelt exakt `if (save) { userPrefs.theme = themeName; savePrefs(); }`; `savePrefs()` (51176) schreibt nur `gsStore.set('gs_prefs', …)`. Alle neun Fundstellen von `gs_theme_color` sind Verbraucher oder Wiederherstellungs-Pfade.

3) KEINE GENERISCHE TABELLE/SCHLEIFE — die uebliche Falle dieses Repos gepruefte: `savePref` (51190) → nur `gs_prefs` + Bus + `gsPrefsPush`; `_gsApplyPref` (51218) hat zwar einen Zweig `if (key === 'theme')`, ruft dort aber nur `applyThemeColors` (kein setItem); `gsStore.set` (27305) spiegelt nichts; `applyAllPrefs` (51408) ruft `applyTheme(userPrefs.theme || 'green', null, false)` und fasst den Schluessel nirgends an — die Audit-Tabelle nennt genau diese Funktion. Ein dynamischer Schreiber `setItem('gs_'+k, …)` existiert nur in der GEGENrichtung (79858, Restore).

4) BROWSER-LAUF. Echter Klick auf `#swatch-purple`: vorher `gs_theme_color = null` → nachher `gs_prefs.theme === "purple"`, `gs_theme_color` weiterhin `null`, und `Object.keys(localStorage).filter(/theme/i)` ist LEER — der Schluessel existiert ueberhaupt nicht.

5) HISTORISCH. `git log --all -S"setItem('gs_theme_color'"` liefert nur den Restore-Pfad, zurueck bis zur Einfuehrung in v24.50 (d83b8c5). Es gab NIE einen Schreiber — also tragen auch Bestandsgeraete keinen Wert. Damit ist auch 78884 (`if (sd.ui.theme_color)`) dauerhaft unerreichbar.

6) KEINE ABSICHT dokumentiert. `SETTINGS_AUDIT_v27.03.md:17` steht wortgleich wie zitiert: „Theme-Color | gs_theme_color | user_app_state.ui.theme_color | applyAllPrefs | ✅".

DER BEFUND UNTERTREIBT SOGAR: beim Konto-Loeschen (77658-77665) lautet der Kommentar „Theme/Sprache als App-Default behalten", `keepKeys = ['gs_dark','gs_theme_color','gs_lang']`, danach `localStorage.clear()`. `gs_prefs` steht NICHT in `keepKeys` — die gewaehlte App-Farbe wird also real auf Gruen zurueckgesetzt, waehrend der Dunkelmodus ueberlebt (`gs_dark` wird von `applyDarkMode` echt geschrieben). Das ist ein kleiner, aber echter Nutzer-Effekt und kein bloss theoretischer.

Einschraenkung: der Hauptschaden bleibt wie beschrieben Hygiene + eine irrefuehrende ✅-Zeile im Repo (die Farbe reist ueber `prefs: _j('gs_prefs','{}')` bei 79669 ohnehin mit in die Cloud); `sync_check.js:107` hinterlegt fuer den toten Schluessel sogar einen Probewert und meldet deshalb gruen.
```

</details>

### ❌ [13] Zwei Einträge in `GS_KEEP_ON_LOGOUT` zeigen ins Leere: ein Schlüssel, den es nicht gibt, und ein „Schalter" ohne Oberfläche.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 78408
- **Folge:** Der Kommentar nennt `gs_auto_collections` einen „Schalter" und der Code daneben ein „Opt-out" — beides beschreibt eine Wahl, die kein Nutzer treffen kann: Sammlungen werden immer automatisch angelegt. `gs_units` bewahrt beim Abmelden einen Schlüssel, den es nicht gibt. Für den nächsten Leser der Liste ist beides eine Sackgasse: er sucht die Oberfläche zum Schalter und den Schreiber zum Schlüssel und findet keinen von beiden — dieselbe Sorte Zeile, die v31.11 aus der `toggleMap` entfernt hat.

<details><summary>Beleg</summary>

```
'''
78408:  'gs_units',           // kg/lb-Anzeige
78411:  'gs_auto_collections',// Sammlungen automatisch anlegen (Schalter)
'''
**`gs_units`**: `grep -n "gs_units" index.html` → drei Treffer, davon zwei die i18n-Beschriftungen `settings_units` / `settings_units_hint` (6171/6172, Substring-Treffer). Als Schlüssel kommt er nur an dieser einen Stelle vor — weder `setItem` noch `getItem`. Die Masseinheiten liegen in `gs_prefs.units` (Select `pref-units`, 6174 → `savePref('units', this.value)`; gelesen in `gsFmtTemp`/`gsFmtDistance`/`gsFmtWeight`/`gsFmtSize`, 51086/51097/51107/51118).
**`gs_auto_collections`**: einziger Zugriff ist ein Lesen, 9289–9291:
'''
  // Opt-out: Setting gs_auto_collections (Default an).
  var enabled = true; try { enabled = gsStore.get('gs_auto_collections', true) !== false; } catch(_){}
  if (!enabled) return;
'''
Kein `gsStore.set`/`setItem` auf diesen Schlüssel, und im gesamten `#screen-settings` (6036–6851) gibt es keine Zeile dafür — geprüft über die vollständige id- und Handler-Liste des Bildschirms (51 `.settings-row`, 113 Inline-Handler).
```

</details>

### ❌ [14] Die Artenzahl wird an zwei Elemente geschrieben, die es nicht gibt — und der Kommentar daneben führt beide als Beleg an, dass die Zahl nie fehlt.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 51521
- **Folge:** Nichts stürzt ab — `if (el && …)` fängt es. Aber die Begründung, mit der v31.53 eine tote Zuweisung entfernt hat, stützt sich auf vier Ziele, von denen zwei ebenfalls tot sind. Wer den Kommentar liest, hält die Artenzahl für vierfach abgesichert; tatsächlich hängt sie an zwei Elementen. Das ist die Sorte Zeile, an der beim nächsten Umbau des Über-Dialogs niemand merkt, dass sie schon lange nichts mehr tut.

<details><summary>Beleg</summary>

```
'''
51521:    ['settings-arten-count','about-arten-count','modal-about-arten','search-header-count'].forEach(function(id){
51522:      var el = document.getElementById(id);
51523:      if (el && artenCount) el.textContent = artenStr;
51524:    });
'''
Dieselbe Vierer-Liste ein zweites Mal in 83456.
`grep -n 'id="about-arten-count"' index.html` → 0 Treffer. `grep -n 'id="search-header-count"' index.html` → 0 Treffer. Beide Namen kommen ausschliesslich in diesen beiden Listen und im Kommentar vor. Vorhanden sind nur `settings-arten-count` (3583) und `modal-about-arten` (gelesen 72192).
Der Kommentar unmittelbar darüber, 51511–51515, begründet mit genau dieser Liste, warum eine gelöschte Zeile kein Verlust war: „Die Artenzahl wird zwoelf Zeilen tiefer ohnehin in vier Elemente geschrieben (settings-arten-count, about-arten-count, modal-about-arten, search-header-count)".
```

</details>

### ⚪ [15] Der orange Farbpunkt in „App-Farbe" zeigt eine Farbe, die das Thema seit v31.32 nicht mehr benutzt.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 6210
- **Folge:** Der Punkt zeigt weiterhin das alte, wegen zu geringem Kontrast verworfene Orange. Wer ihn antippt, bekommt ein sichtbar dunkleres Rotbraun — der einzige der sechs Punkte, der eine andere Farbe verspricht als er einstellt. Und er ist zugleich der Rest der Aufräumarbeit von v31.32: die Farbe wurde an einer Stelle korrigiert und an der anderen vergessen.

<details><summary>Beleg</summary>

```
Vorschau-Punkt (6210):
'''
<div class="theme-swatch" id="swatch-orange" data-theme="orange" style="background:#e65100;" onclick="applyTheme('orange',this)"></div>
'''
Das Thema, das dieser Punkt anwendet (51053):
'''
orange: { main:'#bf360c', dark:'#8d3200', mid:'#f4511e', … }
'''
Der Kommentar über der Tabelle (51045–51048) nennt den Grund: „green main war #1f6b2f = 4.39:1 auf Weiss (unter AA), orange #e65100 = 3.79:1 … Neu: … und #bf360c = 5.60:1." Beim grünen Punkt wurde der Vorschauwert mitgezogen (6206: `background:#1f6b2f` = `THEMES.green.main`), beim orangen nicht. Die übrigen vier stimmen ebenfalls überein (teal `#00695c`, blue `#1565c0`, purple `#6a1b9a`, brown `#4e342e`).
```

</details>

## Cloud-Sync der Einstellungen

### 🔴 [16] gsPrefsPull ERSETZT den kompletten gs_prefs-Blob durch die Serverzeile, statt zu mergen — jede Einstellung, die nie gepusht wurde, ist nach dem naechsten Pull weg

- **Schwere:** hoch  ·  **Zeile (v32.31):** 81765
- **Folge:** Kompakt-Modus und Senioren-Modus (Barrierefreiheit!) fallen spaetestens zwei Minuten nach dem Einschalten auf den Standard zurueck, sobald der Nutzer die Einstellungen das naechste Mal oeffnet (initSettingsScreen ruft loadPrefs, 51409). Kein Fehler, keine Meldung — der Schalter steht einfach wieder auf aus. Betroffen ist alles, was nicht ueber savePref() laeuft.

<details><summary>Beleg</summary>

```
81761:  var merged = Object.assign({}, row, (row.prefs && typeof row.prefs === 'object') ? row.prefs : {});
81762:  delete merged.user_id;
81763:  delete merged.created_at;
81764:  delete merged.updated_at;
81765:  try { gsStore.set('gs_prefs', JSON.stringify(merged)); } catch(_){}

GEMESSEN (Playwright, sbFetch gestellt, Serverzeile {language:'de',units:'imperial',prefs:{showMoon,homeWeather,scanHistory}}):
  gs_prefs VOR  gsPrefsPull(): {theme,fontSize,darkMode:true,compact:true,senior:true,units,lang,waterNotif,weatherNotif,marketNotif,socialNotif,harvestNotif,showMoon,homeWeather,pestTips,safetyWarnings,scanHistory,achFeed}
  gs_prefs NACH gsPrefsPull(): {language:'de', units:'imperial', prefs:{...}, showMoon, homeWeather, scanHistory}
  danach loadPrefs(): compact=false, senior=undefined

gsPrefsPull laeuft nicht nur beim Login: 80076 gsSyncPullNow -> gsSyncUserDataOnLogin, und 81920 ruft dort gsPrefsPull() auf. gsSyncPullNow feuert bei visibilitychange, focus, online und alle 120 s (80108-80114).
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — end-to-end nachgestellt und gemessen.

CODE (Zeilennummern korrigiert): Der zitierte Block steht wortwoertlich in index.html, aber auf 81821/81825, nicht 81765 (dort steht Wetter-Warnungs-Code). gsPrefsPull ist 81811-81834. 81821: `var merged = Object.assign({}, row, (row.prefs && typeof row.prefs === 'object') ? row.prefs : {});` — gebaut aus {} + row + row.prefs, der LOKALE Blob geht nirgends ein. 81825 schreibt ihn ganz: `gsStore.set('gs_prefs', JSON.stringify(merged))`. Also Ersetzen, kein Mergen. (Nebenbei: das try/catch dort ist toter Code — gsStore.set gibt false zurueck, wirft nicht.)

WARUM compact/senior NICHT auf dem Server stehen: applyCompact (51385), applySenior (51396) und applyTheme (51318) rufen nur savePrefs() (Blob-Schreiben), NIE gsPrefsPush. Gepusht wird ausschliesslich ueber savePref() (51254 -> gsPrefsPush 51263). Die Schalter im DOM (6236, 6248) haengen wirklich nur an applyCompact/applySenior.

DER NAHELIEGENDSTE GEGENBEWEIS TRAEGT NICHT: gs_prefs steht NICHT in _buildStateBlob (79190) und nicht in der Pull-stateMap. Es ist in _GS_SNAPSHOT_ONLY (79696) gefuehrt, mit dem ausdruecklichen Kommentar „Domaenen, die AUSSCHLIESSLICH im Snapshot leben. Weder gsCloudSync (_buildStateBlob) noch der Login-Pull (stateMap) kennen sie". Der Snapshot-Rueckweg (79896) ist eine manuelle Backup-Wiederherstellung. Es gibt also keinen zweiten Sync-Pfad, der den Verlust heilt.

KEIN ZWEITSPEICHER: compact/senior kommen im ganzen Quelltext nur innerhalb von gs_prefs vor (51388, 51399) — anders als darkMode, das ueber gs_dark gerettet wird.

ERREICHBARKEIT BESTAETIGT: gsPrefsPull laeuft im erweiterten gsSyncUserDataOnLogin (81980), das gsSyncPullNow (80135) bei jedem Lauf aufruft — visibilitychange/focus/online und alle 120 s (80167-80174).

GEMESSEN (Playwright, echter Einstiegspunkt gsSyncPullNow('manual'), Server-Attrappe mit dem ||-DEEP-MERGE aus fn_user_prefs_save/v27_03):
 t0 savePref('units','imperial') -> Serverzeile entsteht, prefs-jsonb enthaelt compact:false, keinen senior-Schluessel.
 t1 applySenior(true)+applyCompact(true) -> lokal {compact:true, senior:true}, beide body-Klassen gesetzt, Server unveraendert.
 t2 gsSyncPullNow('manual') -> lokal {compact:false}, senior-Schluessel WEG; loadPrefs: compact=false, senior=undefined; initSettingsScreen: beide Schalter aus, beide Klassen entfernt.
Das deckt sich mit der Messung im Befund.

KEINE ABSICHT DOKUMENTIERT: kein Treffer fuer gsPrefsPull in docs/, STATUS.md, ROADMAP.md. Der einzige verwandte Kommentar (78469, „Re-Login ueberschreibt via gsPrefsPull") betrifft den Logout, nicht den 2-Minuten-Pull. Der Kommentar bei 80103 behauptet sogar das Gegenteil des Gemessenen („LWW-safe, weil gsSyncUserDataOnLogin lokale (neuere) Aenderungen schuetzt + Empty-Clobber-Guards hat") — gsPrefsPull hat weder einen Zeitstempel-Vergleich noch einen Empty-Guard.

ZWEI KORREKTUREN AM BEFUND (Kern bleibt):
1. darkMode geht NICHT verloren. loadPrefs (51169) liest gs_dark nach: `if (localStorage.getItem('gs_dark') === '1') userPrefs.darkMode = true;`, und applyDarkMode (51295) schreibt gs_dark separat. Gemessen: darkMode:true ueberlebt den Pull. Die Aufzaehlung im Befund fuehrt es faelschlich als Verlust.
2. Dafuer geht `theme` zusaetzlich verloren — applyTheme speichert ebenfalls nur ueber savePrefs(). Gemessen: purple -> green nach dem Pull.
Betroffen ist also genau das, was ueber savePrefs() statt savePref() laeuft: theme, compact, senior. Die Aussage des Befunds „Betroffen ist alles, was nicht ueber savePref() laeuft" stimmt.

FALLE FUER DEN GEPLANTEN PRUEFSTAND: meine ersten zwei Laeufe meldeten gruen — der Boot raeumt gs_sb_token/gs_sb_uid weg, gsPrefsPull stieg bei `!uid` sofort aus und tat nichts. Die uid muss NACH dem Boot gesetzt werden, sonst prueft der Fall nichts.

Nutzerwirkung: Kompakt-Ansicht und Senioren-Modus (Barrierefreiheit) fallen spaetestens zwei Minuten nach dem Einschalten still auf den Standard zurueck, sobald irgendwann einmal eine savePref-Einstellung eine user_preferences-Zeile angelegt hat (fn_user_prefs_save ist laut Migration der einzige Weg, wie die Zeile entsteht — es gibt keinen Signup-Trigger).
```

</details>

### 🔴 [17] Kompakt- und Senioren-Modus loesen ueberhaupt keinen Push aus — sie stehen in keinem der beiden Sync-Wege

- **Schwere:** hoch  ·  **Zeile (v32.31):** 51347
- **Folge:** Wer auf dem Telefon nur den Senioren- oder Kompakt-Modus einschaltet und sonst nichts aendert, findet auf dem Tablet nichts davon. Zusammen mit Befund 1 ist es schlimmer als „kommt nicht an": der naechste Pull loescht die Einstellung auch auf dem Geraet, auf dem sie gesetzt wurde.

<details><summary>Beleg</summary>

```
51347: function applyCompact(isCompact, save = true) {
51348:   document.body.classList.toggle('compact', isCompact);
51349:   if (save) {
51350:     userPrefs.compact = isCompact;
51351:     savePrefs();          // <- nur localStorage, KEIN savePref(), also kein gsPrefsPush
51352:   }
(gleiche Struktur applySenior, 51358-51363)

Zum Vergleich der einzige Server-Weg fuer gs_prefs, savePref() 51216-51227:
51224:   if (typeof gsPrefsPush === 'function' && ... sbIsLoggedIn()) {
51225:     gsPrefsPush({[key]: val});

'compact'/'senior' stehen ausserdem NICHT in _buildStateBlob (79130-79197) und NICHT in STATE_KEYS (79365-79396).

GEMESSEN: nach applyCompact(true), applySenior(true), applyDarkMode(true) — gs_sync_dirty = null, und in 1,4 s (Debounce 800 ms) kein einziger fn_user_prefs_save-Aufruf.
Sie reisen nur als NEBENWIRKUNG mit: sobald irgendein anderes savePref() laeuft, kopiert 81801 den ganzen lokalen Blob in freeBlob. Gemessener Rumpf nach savePref('units','imperial'): p_patch.prefs enthaelt darkMode/compact/senior.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — bestaetigt durch Quelltext UND zwei Browser-Laeufe. (Nur die Zeilennummern des Berichts sind ~38 Zeilen zu niedrig; der zitierte Code stimmt woertlich.)

1) CODE AN DER STELLE — korrigierte Zeilen in /home/user/GreenScan/index.html:
   51385 `function applyCompact(isCompact, save = true)` → 51389 `savePrefs();`
   51396 `function applySenior(isSenior, save = true)`  → 51400 `savePrefs();`
   51176 `function savePrefs(){ gsStore.set('gs_prefs', JSON.stringify(userPrefs)); }` — nur localStorage.
   51254 `function savePref(key,val)` → 51262/51263 `if (typeof gsPrefsPush === 'function' && ... sbIsLoggedIn()) gsPrefsPush({[key]: val});`
   Die Schalter rufen wirklich nur die apply*-Form: 6236 `onchange="applyCompact(this.checked)"`, 6248 `onchange="applySenior(this.checked)"`.

2) KEINE TABELLE/SCHLEIFE FAENGT ES AUF (gezielt gesucht, weil dieses Repo so arbeitet):
   · `toggleMap` (51470-51485) ist reine WIEDERHERSTELLUNG (`el.checked = userPrefs[key] !== false`) — kein Speicherweg.
   · `STATE_KEYS` (79425-79456): kein `gs_prefs`, kein compact/senior. `gs_dark`/`gs_theme_color`/`gs_lang` stehen drin, gs_prefs nicht.
   · `_buildStateBlob` (79190-79257): `ui = {dark, theme_color, lang}` — compact/senior fehlen, gs_prefs kommt gar nicht vor.
   · `gsPrefsPush` hat GENAU EINE Aufrufstelle: 51263 (savePref). Kein pagehide-/Intervall-Push.
   · Kein Monkey-Patch von `savePrefs`, kein `gs-settings-change`-Zuhoerer (nur 51196 dispatch, kein addEventListener).
   · Der dritte Weg, den ich als Widerlegung gepruefte — der SNAPSHOT (79669 `prefs: _j('gs_prefs','{}')`, 79896 `_gsRestoreKey('gs_prefs', st.prefs)`) — traegt gs_prefs zwar vollstaendig in die Cloud, ist aber kein Sync: die Wiederherstellung laeuft nur ueber Banner/Menue (gsSnapshotMaybeOfferRestore / gsSnapshotRestoreManual) und `_gsRestoreKey` schreibt ausdruecklich NUR in LEERE Schluessel. Auf einem Geraet mit vorhandenem gs_prefs kommt davon nie etwas an.

3) GEMESSEN (Playwright, file://, sbFetch gestellt, sbIsLoggedIn=true):
   Lauf 1: nach `applyCompact(true); applySenior(true);` + 1,5 s → `gs_sync_dirty = null`, KEIN `fn_user_prefs_save` in den aufgezeichneten Aufrufen. Danach `savePref('units','imperial')` → `fn_user_prefs_save` mit
   `p_patch.prefs = {... "compact":true ... "senior":true}` — genau der im Bericht behauptete Nebenwirkungs-Transport ueber `freeBlob` (81862 `var freeBlob = Object.assign({}, current)`).
   Lauf 2 (die "Folge"): gs_prefs lokal mit compact/senior; `gsPrefsPull()` mit einer Server-Zeile OHNE die beiden → 81825 `gsStore.set('gs_prefs', JSON.stringify(merged))` ERSETZT den Blob; danach sind `compact`/`senior` in gs_prefs weg, und `loadPrefs()` (also der naechste Start) liefert `compact:false`, `senior:undefined`. Die Einstellung geht also auch auf dem Geraet verloren, auf dem sie gesetzt wurde.

4) BEMERKBAR & NICHT ALS ABSICHT BELEGT: `gs_notif_enabled` traegt an 79445 ausdruecklich den Kommentar "BEWUSST NICHT gesynct" — fuer compact/senior gibt es nichts dergleichen, weder im Code noch in STATUS.md/ROADMAP.md/CLAUDE.md (gegrept, 0 Treffer). Dark-Mode, Theme und Sprache werden dagegen explizit cross-device gefuehrt. Der Senioren-Modus ist zudem die Zugaenglichkeits-Einstellung — sein stiller Verlust nach einem Re-Login trifft genau die Nutzergruppe, fuer die er existiert.
```

</details>

### 🔴 [18] Was der Pull zurueckholt, WIRKT nicht — gsPrefsPull schreibt nur Speicher und Variable, ruft aber keine apply*-Funktion und aktualisiert kein Bedienelement

- **Schwere:** hoch  ·  **Zeile (v32.31):** 81769
- **Folge:** Aendert der Nutzer auf Geraet B den Nachtmodus, die Masseinheiten, das Mondwidget oder die Sprache, sieht Geraet A davon nichts, bis die App neu geladen wird. Schlimmer: der Speicher sagt inzwischen etwas anderes als der Bildschirm — beim naechsten loadPrefs() springt die Oberflaeche ohne erkennbaren Anlass um.

<details><summary>Beleg</summary>

```
81765:  try { gsStore.set('gs_prefs', JSON.stringify(merged)); } catch(_){}
81766:  // Globale userPrefs-Variable refreshen fuer aktuell sichtbare Settings-Toggles
81767:  try {
81768:    if (typeof userPrefs !== 'undefined' && userPrefs && typeof userPrefs === 'object') {
81769:      Object.assign(userPrefs, merged);
81770:    }
81771:  } catch(_){}
81772:  return merged;

Kein _gsApplyPref, kein applyDarkMode/applyCompact/applySenior, kein el.checked/el.value. Dasselbe im State-Blob-Pull, 78822-78826: dort wird gs_dark/gs_theme_color/gs_lang mit localStorage.setItem geschrieben und nichts angewandt. applyAllPrefs() laeuft nur beim Boot (83295) und nach einem Backup-Restore (79865), nie nach einem Pull (80057-80097 rendert nur renderMyPlants/renderGarden).

GEMESSEN: Server sagte showMoon:false -> userPrefs.showMoon = false, aber getElementById('moon-widget').style.display blieb '' (sichtbar). body.classList compact/senior/dark unveraendert.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — der Befund haelt jeder Gegenprobe stand.

1) CODE STIMMT, ZEILENNUMMERN SIND VERALTET. An 81769 steht heute Wetter-Warnungs-Code. Der zitierte Text steht woertlich in `gsPrefsPull` — aktuell index.html:81829 (Funktionskopf), Beleg 81843-81850. Grund fuer die Drift: an index.html wird PARALLEL gearbeitet (`git status` = ` M index.html`); allein waehrend meines Laufs wanderte gsPrefsPull von 81811 auf 81829. Der Inhalt ist unveraendert: gsStore.set('gs_prefs', ...) + Object.assign(userPrefs, merged) + return. Kein _gsApplyPref, kein apply*, kein el.checked/el.value.

2) KEINE TABELLE/SCHLEIFE FAENGT ES AB (das war der wahrscheinlichste Widerlegungsweg in diesem Repo):
   - `gs-settings-change` wird bei 51196 DISPATCHT, hat aber NULL Zuhoerer (grep: nur die Dispatch-Zeile).
   - Die vier `storage`-Zuhoerer (11485 Tagebuch, 13607 Streak, 36837 Feedback, 37906 Token-Cache) decken keine Prefs ab — und ein storage-Event feuert ohnehin nur in ANDEREN Tabs, nicht im pullenden.
   - `renderMoonWidget` (70108) und `loadHomeWeather` (23085) fragen `showMoon`/`homeWeather` NICHT ab; Sichtbarkeit setzen nur _gsApplyPref (51220/51223) und applyAllPrefs (51423/51425).
   - `applyAllPrefs` laeuft nur: Boot (83355), Backup-Restore (79925) und `importUserData` (51660) — Letzteres ist ein LOKALER Datei-Import, der mit `location.reload()` endet, also kein Pull-Pfad.

3) ES IST KEIN LOGIN-ONLY-FALL, SONDERN LAEUFT IM BETRIEB. `_gsSetupConstantSync()` wird bei 80240 wirklich aufgerufen und haengt Pull an visibilitychange/focus/online + 2-Min-Intervall (80180-80198). Der Weg ist: gsSyncPullNow -> gsSyncUserDataOnLogin (die ERWEITERTE Fassung, 81992) -> gsPrefsPull (81998). Danach rendert gsSyncPullNow ausschliesslich renderMyPlants/renderGarden, und das auch nur, wenn sich die PFLANZEN/GARTEN-Signatur (_gsDataSig) geaendert hat — Prefs stehen in keiner Signatur.

4) DIE WERTE ERREICHEN DEN SERVER WIRKLICH (sonst waere der Fall theoretisch). `gsPrefsPush` ist definiert (Alias auf gsPrefsPushNow, 81910) — der alte Phantom-Bug aus dem Kommentar 81857 ist behoben. Also pushen savePref('showMoon'/'homeWeather'/'units'/'scanHistory') echt in user_preferences.prefs. Zusaetzlich liegt `gs_prefs` IM STATE-BLOB (79687 `prefs: _j('gs_prefs','{}')`, Rueckweg 79714 `['gs_prefs','prefs']`) — damit reisen auch darkMode/compact/senior geraeteuebergreifend.

5) GEMESSEN (Playwright, file://, sbFetch gestellt, Sitzung NACH dem Boot gesetzt):
   userPrefs.showMoon    true -> false      moon-widget.style.display: '' -> ''  (unveraendert sichtbar)
   userPrefs.homeWeather true -> false      home-weather-widget:       '' -> ''
   userPrefs.units    metric -> imperial    #pref-units.value:  metric -> metric
   userPrefs.darkMode   false -> true       body.dark:           false -> false
   userPrefs.compact    false -> true       body.compact:        false -> false
   userPrefs.senior       undef -> true     body.senior:         false -> false
   #toggle-moon/#toggle-dark/#toggle-compact: alle unveraendert.
   gs_prefs im Speicher wurde vollstaendig ueberschrieben. Sechs Werte gewandert, null Wirkung.

6) BEMERKBAR, NICHT THEORETISCH — und die Folge-Beschreibung stimmt sogar praeziser als formuliert: Der State-Blob-Pull schreibt `gs_prefs` per localStorage.setItem, ohne `userPrefs` im Speicher anzufassen. Danach widersprechen sich Speicher und Bildschirm. `initSettingsScreen` ruft `loadPrefs()` (51186: userPrefs = {...DEFAULT_PREFS, ...safeGetItem('gs_prefs')}) und direkt danach applyDarkMode/applyCompact/applySenior — d.h. sobald jemand die Einstellungen OEFFNET, kippt die Oberflaeche schlagartig auf die gepullten Werte. Genau das im Befund genannte "springt ohne erkennbaren Anlass um" ist damit belegt, nicht vermutet.

7) KEIN HINWEIS AUF ABSICHT. Kein Kommentar an gsPrefsPull oder im State-Blob-Pull begruendet ein bewusstes Nicht-Anwenden; der Kommentar bei 81844 sagt im Gegenteil "Globale userPrefs-Variable refreshen fuer aktuell sichtbare Settings-Toggles" — die Absicht war also Wirkung, sie ist nur nie eingetreten. Passend dazu 51419-51421: dort ist derselbe Fehlerklasse fuer die Sprache bereits einmal behoben worden ("bei Cross-Device-Pull griff der Wechsel erst nach Reload") — allerdings nur INNERHALB applyAllPrefs, das nach einem Pull niemand ruft.

ZWEI KORREKTUREN AM BEFUND (aendern nichts an der Aussage, sind aber fuer den Nachbau wichtig):
 - `userPrefs` ist ein `let` im Skript-Bereich (51117), NICHT auf `window`. Ein Pruefstand, der `window.userPrefs` liest, misst `undefined` und meldet faelschlich gruen — dieselbe Falle wie `socialPosts` in CLAUDE.md.
 - Token/uid muessen NACH dem Boot gesetzt werden; der Boot raeumt einen gefaelschten `gs_sb_token` weg, gsPrefsPull gibt dann sofort null zurueck und der Lauf sieht wie "kein Fehler" aus.
```

</details>

### ❌ [19] Der Rueckweg des Nachtmodus ist einseitig: „dunkel an" reist, „dunkel aus" nicht

- **Schwere:** mittel  ·  **Zeile (v32.31):** 51132
- **Folge:** Ein Nutzer, der den Nachtmodus auf dem Tablet ausschaltet, bekommt ihn auf dem Telefon nie wieder los — der Pull traegt die Abschaltung bis in den Speicher und die naechste Zeile hebt sie wieder auf. Die einzige Rettung ist, den Schalter auf jedem Geraet einzeln zu betaetigen.

<details><summary>Beleg</summary>

```
51129: function loadPrefs() {
51130:   try {
51131:     userPrefs = { ...DEFAULT_PREFS, ...safeGetItem('gs_prefs', {}) };
51132:     if (localStorage.getItem('gs_dark') === '1') userPrefs.darkMode = true;

Der Pull schreibt genau diesen Schluessel (78823: localStorage.setItem('gs_dark', String(sd.ui.dark))), aber die Zeile kennt nur eine Richtung — sie hebt auf true an, sie setzt nie auf false zurueck.

GEMESSEN:
  Fall 1: gs_prefs.darkMode=true + gs_dark='0' (Cloud sagt AUS) -> loadPrefs: darkMode=true, applyAllPrefs: body.dark = true. Dauerhaft.
  Fall 2: gs_prefs.darkMode=false + gs_dark='1' (Cloud sagt AN) -> loadPrefs: darkMode=true, body.dark = true. Kommt an.
```

</details>

### 🔴 [20] Nachtmodus und Sprache planen beim Umschalten keinen Push — der Auto-Track ueber STATE_KEYS ist tot, und an diesen Stellen fehlt das ersetzende markDirty('state')

- **Schwere:** mittel  ·  **Zeile (v32.31):** 51257
- **Folge:** Nachtmodus und Sprachwahl erreichen das Konto nur zufaellig — naemlich dann, wenn spaeter eine unbeteiligte Aktion (Favorit, Scan, Quiz) den state-Bereich als dirty markiert und ein Flush den Blob neu baut (79043). Wer die Sprache umstellt und die App schliesst, hat sie moeglicherweise nie hochgeladen.

<details><summary>Beleg</summary>

```
51257:     try { localStorage.setItem('gs_dark', isDark ? '1' : '0'); } catch(_){}   // applyDarkMode, kein markDirty
13914:     try { localStorage.setItem('gs_lang', lang); } catch(_){}                  // gsI18n.setLang, kein markDirty

Der Ersatzmechanismus greift nicht: 79399 patcht Storage.prototype.setItem, aber 7778 (localStorage.setItem = function(k,v)) und 7803 (localStorage.removeItem = ...) sind EIGENE Eigenschaften am localStorage-Objekt und verdecken den Prototyp-Patch vollstaendig.

GEMESSEN:
  hasOwnProperty(localStorage,'setItem')    = true
  hasOwnProperty(localStorage,'removeItem') = true
  localStorage.setItem('ps_favs','["x"]')  -> gs_sync_dirty = null   (Gegenprobe: der Auto-Track feuert fuer KEINEN STATE_KEY)
  applyDarkMode(true)                       -> gs_sync_dirty = null
  gsI18n.setLang('fr')                      -> gs_sync_dirty = null, gs_lang = 'fr'

20 andere Stellen rufen deshalb markDirty('state') ausdruecklich auf (u.a. 20096 mit dem Kommentar „Auto-Track ist geshadowed"); genau diese beiden nicht. Der Sprachwaehler ruft auch kein savePref('language', ...), die Spalte user_preferences.language bleibt also ebenfalls stehen.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
WIDERLEGUNGSVERSUCH GESCHEITERT — der Befund haelt allen Gegenproben stand. Einzige Korrektur: die ZEILENNUMMERN im Befund sind falsch.

KORREKTUR DER BELEGSTELLEN (weder im Arbeitsstand noch in HEAD steht an 51257/13914 das Behauptete):
 - 51257 ist in Wirklichkeit /home/user/GreenScan/index.html:51313 (in applyDarkMode):
     try { localStorage.setItem('gs_dark', isDark ? '1' : '0'); } catch(_){}
 - 13914 ist in Wirklichkeit index.html:13933 (in gsI18n.setLang):
     try { localStorage.setItem('gs_lang', lang); } catch(_){}
 Der zitierte Code existiert also woertlich, nur an anderer Stelle. (index.html ist uncommitted geaendert; auch `git show HEAD:index.html` traegt an 51257/13914 anderen Text — die Nummern stammen aus keinem der beiden Staende.)

1. MECHANISMUS BESTAETIGT (und vom Repo selbst dokumentiert).
 - index.html:7778 `localStorage.setItem = function(k,v)` und :7803 `localStorage.removeItem = ...` sind EIGENE Eigenschaften am localStorage-Objekt. Der Quota-Wrapper haelt in `_origSet = localStorage.setItem.bind(localStorage)` (7772) die NATIVE Funktion fest — der spaetere `Storage.prototype.setItem`-Patch (79479-79497) wird dadurch nie erreicht.
 - Das ist bekannt: index.html:79269 sagt es woertlich ("STATE_KEYS-Auto-Track ist durch den Quota-Wrapper geshadowed -> echte Sync laeuft NUR ueber diesen Blob + Pull-stateMap + explizite markDirty-Calls"); ebenso die Kommentare an 20128, 39628, 56269.

2. NACHGEMESSEN (Playwright, file://, _seed.js, 0 JS-Fehler) — alle Zahlen des Befunds reproduziert:
     hasOwnProperty(localStorage,'setItem')    = true
     hasOwnProperty(localStorage,'removeItem') = true
     localStorage.setItem('ps_favs','["x"]')                  -> gs_sync_dirty = null
     Storage.prototype.setItem.call(localStorage,'ps_favs',..) -> gs_sync_dirty = {"state":...}   (Gegenprobe: der Patch WUERDE feuern, er wird nur nie erreicht)
     applyDarkMode(true)   -> markDirty-Spion leer, gs_sync_dirty = null, gs_dark = '1'
     gsI18n.setLang('fr')  -> markDirty-Spion leer, gs_sync_dirty = null, gs_lang = 'fr'
     gsI18nRerenderDynamic() (der Rest von gsHandleLangChange) -> ebenfalls kein markDirty
     Echter Nutzerweg (switchTab('settings'), #toggle-dark change-Event, 2,5 s Wartezeit): markDirty-Spion leer, kein Push in der sbFetch-Attrappe.

3. KEIN ERSATZWEG GEFUNDEN (das war der ernsthafteste Widerlegungsversuch):
 - `#toggle-dark` (6212) haengt wirklich nur an `applyDarkMode(this.checked)`; `#i18n-lang-picker` (6336) nur an `gsHandleLangChange(this.value)`. Keine Delegation, keine `_gsSettingsBus.on(...)`-Zuhoerer (0 Treffer).
 - `savePref('language', ...)` existiert NIRGENDS (0 Treffer) — die Spalte user_preferences.language wird also tatsaechlich nie geschrieben, obwohl sie in GS_PREFS_KNOWN_COLUMNS (81861) gefuehrt ist.
 - `gsPrefsPush(` hat genau EINEN Aufrufer: savePref (51281). applyDarkMode ruft savePref nicht, sondern savePrefs() -> gsStore.set('gs_prefs') — und gsStore.set loest ebenfalls kein markDirty aus (gemessen).
 - `_buildStateBlob` (79208-79274) enthaelt `gs_prefs` NICHT; gs_dark/gs_lang reisen dort ausschliesslich in `data.ui` (79244-79246) mit — also nur bei einem state-Push.
 - Kein zustandsunabhaengiger Push: `_flush` (79083) prueft `d.state`, der 30-s-Intervall (79411) flusht nur bei vorhandenem dirty, beforeunload/pagehide/visibilitychange rufen `flushNow` -> dasselbe `_flush`. Ein Boot-Lauf mit fruehem markDirty-Spion zeigte nur `garden` (gsPushGardenNow / saveGardenData), kein `state`.

4. ABSICHT? Nein. gs_dark und gs_lang stehen ausdruecklich in STATE_KEYS (79452), im Blob (79244/79246) und im Pull (78901/78903) — sie SOLLEN synchronisieren. Die bewusst ausgenommenen Schluessel sind an Ort und Stelle begruendet (gs_notif_enabled/gs_notif_state, 79461ff.); fuer diese beiden gibt es keine solche Begruendung, weder im Code noch in STATUS.md/docs/.

5. FUER NUTZER BEMERKBAR — und schlimmer als im Befund beschrieben. Weil `gs_sync_dirty_at_state` nach der Umstellung fehlt, liefert `_shouldOverwriteLocal('state', cloudUpdatedAt)` (78707) `true` ("nichts Ungepushtes -> Cloud ist autoritativ"), und der Pull schreibt bei 78901/78903 den ALTEN Cloud-Wert zurueck: `localStorage.setItem('gs_dark', String(sd.ui.dark))` bzw. `('gs_lang', sd.ui.lang)`. Die ungepushte Umstellung wird also nicht nur nicht hochgeladen, sie kann beim naechsten Pull lokal ZURUECKGESETZT werden. Fuer den Nachtmodus gilt dasselbe auf dem zweiten Kanal: gsPrefsPull (81843) ueberschreibt gs_prefs komplett mit dem Cloud-Stand, ohne jede Dirty-Pruefung.

Kleinere Ungenauigkeit ohne Folgen fuer die Aussage: "20 andere Stellen" stimmt als Zaehlung (grep -c "markDirty('state')" = 20), aber darin sind auch der Pull-Repair (78917) und der Backup-Restore (79939) enthalten, die keine Schreibstellen im Sinne des Befunds sind.
```

</details>

### ❌ [21] gs_dark, gs_theme_color und gs_lang sind im Code ausdruecklich als GERAETE-Eigenschaft deklariert und werden trotzdem kontoweit gesynct — zwei Geraete ueberschreiben einander

- **Schwere:** mittel  ·  **Zeile (v32.31):** 78405
- **Folge:** Telefon im Nachtmodus, Tablet im Hellmodus, Sprache auf dem einen Franzoesisch und auf dem anderen Deutsch: die Geraete drehen sich gegenseitig die Anzeige um, sobald eines von beiden aus einem beliebigen anderen Grund den state-Blob hochlaedt. Die App selbst nennt diese drei Werte an anderer Stelle Geraete-Eigenschaften — es gibt also keine Entscheidung, sondern zwei widersprechende.

<details><summary>Beleg</summary>

```
78402: // ── BLEIBT: Geraet, nicht Person ─────────────────────────────────────────
78403: var GS_KEEP_ON_LOGOUT = [
78404:   // Oberflaechen-Vorlieben dieses Geraets
78405:   'gs_dark',            // Dark-Mode
78406:   'gs_theme_color',     // Theme-Farbe
78407:   'gs_lang',            // Sprache

Dieselben drei Schluessel gehen aber in den Konto-Blob und kommen dort wieder heraus:
79166:   try { ui.dark = localStorage.getItem('gs_dark'); } catch(_){}
79167:   try { ui.theme_color = localStorage.getItem('gs_theme_color'); } catch(_){}
79168:   try { ui.lang = localStorage.getItem('gs_lang'); } catch(_){}
78823:   if (sd.ui.dark != null) try { localStorage.setItem('gs_dark', String(sd.ui.dark)); } catch(_){}
78824:   if (sd.ui.theme_color) try { localStorage.setItem('gs_theme_color', sd.ui.theme_color); } catch(_){}
78825:   if (sd.ui.lang) try { localStorage.setItem('gs_lang', sd.ui.lang); } catch(_){}

Das Schiedsverfahren ist reines Zuletzt-gewinnt (_shouldOverwriteLocal, 78571ff: ohne lokalen dirty-Marker ist die Cloud autoritativ) — und einen dirty-Marker setzen diese drei nach Befund 5 nie.
```

</details>

### ⚪ [22] Der Schalter „Standort immer neu bestaetigen" leert den Standort des KONTOS, nicht nur den des Geraets

- **Schwere:** mittel  ·  **Zeile (v32.31):** 56681
- **Folge:** Ein Schalter, der eine Berechtigungs-Nachfrage pro Geraet regelt, loescht den fuer das ganze Konto gespeicherten Standort. Bestehende Geraete merken nichts (der Pull ueberspringt leere Werte, 78760), ein frisch installiertes Geraet startet aber ohne Standort — und daran haengen Wetter, Saison und Regional-Pilze.

<details><summary>Beleg</summary>

```
56677: function gsGpsAlwaysAskToggle(checked) {
56678:   try { localStorage.setItem(GS_GPS_ALWAYS_ASK_KEY, checked ? '1' : '0'); } catch(e){}
56679:   if (checked) {
56680:     // Reset — naechste Anfrage wird neu fragen
56681:     try { localStorage.removeItem('gs_user_location'); localStorage.removeItem('gs_user_location_ts'); } catch(e){}

und im Konto-Blob:
79192:   try { data.user_location = localStorage.getItem('gs_user_location') || ''; } catch(_){}

GEMESSEN: gs_user_location auf {lat:47,lon:8,name:'Bern'} gesetzt, gsGpsAlwaysAskToggle(true) -> gs_user_location = null, _gsBuildStateBlob().user_location = "" (leerer String). Der naechste state-Push schreibt diesen leeren Wert in die Konto-Zeile.

Der Schalter selbst (gs_gps_always_ask) ist korrekt geraetelokal — er steht in keinem Blob. Nur seine Nebenwirkung ist es nicht.
```

</details>

### ⚪ [23] Die prefs-Verschachtelung waechst mit jeder Rundreise um eine Ebene — gsPrefsPull entfernt das jsonb-Unterobjekt nicht, bevor es den Blob speichert

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 81762
- **Folge:** Bei jedem Login/Pull-Push-Zyklus kommt eine tote Verschachtelungsebene dazu, die mitgespeichert und mituebertragen wird. Heute nur Ballast; sobald jemand die Toggles einmal aus 'prefs' statt flach liest, liest er die falsche Ebene.

<details><summary>Beleg</summary>

```
81761:  var merged = Object.assign({}, row, (row.prefs && typeof row.prefs === 'object') ? row.prefs : {});
81762:  delete merged.user_id;
81763:  delete merged.created_at;
81764:  delete merged.updated_at;      // 'prefs' selbst wird NICHT entfernt

und beim naechsten Push wandert es als freies Feld mit:
81801:  var freeBlob = Object.assign({}, (current && typeof current === 'object') ? current : {});
81806:    else freeBlob[k] = p[k];
81809:  Object.keys(GS_PREFS_KNOWN_COLUMNS).forEach(function(k){ delete freeBlob[k]; });   // 'prefs' steht nicht in dieser Liste
81810:  patch.prefs = freeBlob;

GEMESSEN, zwei Rundreisen:
  nach Pull 1: gs_prefs = {language:'de', units:'metric', prefs:{}}
  Push 2 p_patch.prefs = { ...alle Toggles..., prefs:{} }     <- eine Ebene tiefer
  nach Pull 2: gs_prefs enthaelt wieder einen eigenen Schluessel 'prefs'
```

</details>

## Die Einstellungs-Suche

### ✅ [24] Inhalt einer Karte, der nicht in einer `.settings-row` steht, wird von der Suche NIE ausgeblendet — er bleibt bei jedem Suchbegriff stehen.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 16251
- **Folge:** Gemessen bei 412x900, Standard-Aufklappzustand, Suche „nachtmodus": 1 Treffer-Zeile — darunter aber 209 px Ueber-Karte („🌿 GreenScan Version v32.29 · 2026 / 4'337 Arten in DB / 🇨🇭 Schweiz Focus / Die #1 Natur-App der Schweiz …") bei JEDEM Nutzer, und bei aktiviertem Smart-Push zusaetzlich das komplette Detailpanel #push-detail-settings (646 px, 18 Bedienelemente: 9 Kategorie-Haken, Wetter-Vorlauf-Regler, 2 Stille-Zeit-Selects, 4 Urlaubs-Knoepfe, Test-Push, Wetter-Warnungen). Scrollhoehe bei EINEM Treffer: 547 px ohne Push, 1211 px mit Push. Der Screenshot zeigt unter dem einen Treffer „Nachtmodus" neun fremde Push-Haken.

<details><summary>Beleg</summary>

```
// gsSettingsSearch, Zweig fuer Karten MIT Zeilen:
        if (rows.length){
          Array.prototype.forEach.call(rows, function(r){ ... r.classList.toggle('gs-row-nomatch', !match); ... });
          b.classList.remove('gs-grp-nomatch');   // <-- BEDINGUNGSLOS: Karte bleibt sichtbar,
        } else {                                   //     auch wenn KEINE ihrer Zeilen passt
          b.classList.toggle('gs-grp-nomatch', !grpMatch);
        }

Der Kommentar eine Zeile darunter (16253) nennt die Ueber-Karte ausdruecklich als 'Body ohne Rows'. Das stimmt seit v23.90 nicht mehr: index.html:6664 legt `<div class="settings-row" id="settings-admin-row" ... style="display:none;">` in genau diese Karte. Damit laeuft sie IMMER in den oberen Zweig.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — im Browser exakt reproduziert.

CODE: index.html:16263-16273 enthaelt woertlich den zitierten Zweig. Bei rows.length>0 wird b.classList.remove('gs-grp-nomatch') BEDINGUNGSLOS ausgefuehrt (Zeile 16270); nur der else-Zweig (16273) blendet einen Body ohne Rows aus. Der Kommentar auf 16272 nennt die Ueber-Karte ausdruecklich als 'Body ohne Rows' — die dokumentierte Absicht ist also das Gegenteil des Verhaltens.

URSACHE BESTAETIGT: Die Ueber-Karte (index.html:6658, direktes Kind von #settings-scroll, eigene Gruppe 'ℹ️ Ueber GreenScan' ab 6657) enthaelt seit v23.90 genau eine .settings-row: #settings-admin-row (index.html:6683, style="display:none"). querySelectorAll findet sie trotz display:none → rows.length===1 → oberer Zweig. (Die Zeilennummern des Befunds liegen ~19 Zeilen tief: die Datei ist seit v32.29 gewachsen, sie zeigt jetzt v32.31. Der zitierte Code stimmt woertlich.)

KEINE ENTLASTENDE STELLE GEFUNDEN: clearSearch (16241) laeuft nur bei leerer Eingabe; applyAccordion laeuft im Suchmodus nicht. Einzige CSS-Regel ist .gs-acc-hide,.gs-row-nomatch,.gs-grp-nomatch{display:none!important} (Zeile 1583) — kein Geschwister-Selektor, der eine Karte ueber den ausgeblendeten Gruppentitel mitverbirgt; das einzige :has( der Datei (1391) betrifft Doktor-Chips. Der Legal-Banner (6628, wirklich ohne Rows) wird korrekt ausgeblendet, die Ueber-Karte ist der Sonderfall. Keine Erwaehnung in STATUS.md/ROADMAP.md.

GEMESSEN (Playwright, 412x900, _seed.js, switchTab('settings'), Standard-Aufklappzustand):
- Suche 'nachtmodus': 1 Treffer-Zeile ('🌙 Nachtmodus'). Alle uebrigen Karten schrumpfen auf 2 px (nur Rahmen), die Ueber-Karte bleibt display:block mit 209 px ('🌿 GreenScan Version v32.31 · 2026 / 4'337 Arten in DB / 🇨🇭 Schweiz Focus / Die #1 Natur-App der Schweiz …'). scrollHeight = 547 px.
- Mit aktivem Smart-Push (#push-detail-settings auf display:'', so wie gsTogglePushMaster(true) es setzt, index.html:81586): das Panel ist keine .settings-row, wird von keiner Schleife angefasst → 664 px hoch, 18 sichtbare Bedienelemente unter dem einen Treffer, scrollHeight = 1211 px.
- Schaerfster Fall, Suche 'zzzqqq': 0 Treffer, 'Keine Einstellung gefunden.' wird eingeblendet — und direkt darunter stehen weiterhin die 209 px Ueber-Karte (scrollHeight 498 px).

Fuer den Nutzer klar bemerkbar (209 px bei jedem Nutzer, +664 px bei aktivem Push), nicht theoretisch, nicht beabsichtigt.

Kleine Korrekturen am Befund: #settings-admin-row steht auf 6683 (nicht 6664), der bedingungslose remove auf 16270 (nicht 16251), Push-Panel misst 664 statt 646 px. Substanz und Ursache unveraendert.
```

</details>

### ✅ [25] 18 Bedienelemente im Smart-Push-Panel liegen ausserhalb jeder `.settings-row` und sind damit ueberhaupt nicht auffindbar.

- **Schwere:** hoch  ·  **Zeile (v32.31):** 6265
- **Folge:** Gemessen mit aufgeklapptem Panel — je 0 Treffer und Anzeige „Keine Einstellung gefunden.", obwohl das gesuchte Wort im selben Moment sichtbar auf dem Bildschirm steht: „hitzewarnung", „stille", „urlaub", „vorlauf", „giessen", „quiz-duell", „wetter-warnungen", „test-push" (8 von 8). Gegenprobe: alle 41 nicht-Admin-`.settings-row` sind auffindbar (0 Ausfaelle bei 41 gepruefen Zeilen) — die Luecke ist genau diese eine Gruppe.

<details><summary>Beleg</summary>

```
index.html:6265
<div id="push-detail-settings" style="display:none;padding:14px 18px;...">
  ... <input type="checkbox" id="push-cat-heat" ...> 🥵 Hitzewarnung</label>
  ... <input type="range" id="push-lead-hours" ...>          (🌦️ Wetter-Vorlauf)
  ... <select id="push-quiet-start" ...>                      (🌙 Stille-Zeit)
  ... <button onclick="gsPushPause(7)">7 Tage</button>        (🔕 Stille Tage / Urlaub)
  ... <button id="push-test-btn">📨 Test-Push senden</button>

Keines dieser Elemente steckt in einem `.settings-row`. Die Suche sammelt aber nur diese (Zeile 16243):
  var rows = b.querySelectorAll ? b.querySelectorAll('.settings-row') : [];

gsTogglePushMaster (81506) macht das Panel real sichtbar: `if (detail) detail.style.display = '';`
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — alle Teilbehauptungen im Browser nachgestellt.

1) CODE VORHANDEN (Zeilennummer leicht daneben, Inhalt exakt)
Der zitierte Block existiert genau einmal, aber auf `index.html:6284` (Arbeitsstand) bzw. `6279` in HEAD — nicht auf 6265. Zeile 6265 traegt `<div class="settings-icon" ...>📲</div>`. Das ist die einzige Ungenauigkeit des Befunds; der zitierte Code selbst stimmt woertlich:
  6284: `<div id="push-detail-settings" style="display:none;padding:14px 18px;background:var(--surface2);border-top:1px solid var(--border);">`
Der Sammler steht auf `index.html:16262`: `var rows = b.querySelectorAll ? b.querySelectorAll('.settings-row') : [];`, gehaertet durch `index.html:1583`: `.gs-acc-hide,.gs-row-nomatch,.gs-grp-nomatch{display:none !important;}`.

2) KEIN RETTUNGSZWEIG — genau danach habe ich gesucht
Der Suchcode HAT einen zweiten Zweig fuer Bodies ohne Zeilen (16271-16274: „Bodies ohne Rows (Über-Card, Legal-Banner)"). Der greift hier NICHT: `#push-detail-settings` liegt INNERHALB der `.settings-card`, und diese Karte enthaelt 3 `.settings-row` (im Browser gezaehlt) — also laeuft der `rows.length`-Zweig. Das Panel selbst enthaelt 0 `.settings-row` und faellt durch beide Zweige. Keine Zuordnungstabelle, kein Helfer, kein `data-search`-Attribut, kein Start-Aufruf behandelt das (`grep` nach `.settings-row`-Sammlern findet nur 16246 und 16262).

3) MESSUNG (Playwright, `menuNav('settings')`, Panel wie von `gsTogglePushMaster` geoeffnet)
Alle 8 genannten Woerter reproduziert, je 0 sichtbare Zeilen UND „Keine Einstellung gefunden." sichtbar, waehrend der Text im selben Moment auf dem Schirm steht:
  hitzewarnung → „🥵 Hitzewarnung" · stille → „🌙 Stille-Zeit:" · urlaub → „🔕 Stille Tage (Urlaub)" · vorlauf → „🌦️ Wetter-Vorlauf" · giessen → „💧 Pflanzen giessen" · quiz-duell → „⚔️ Quiz-Duell-Antworten" · wetter-warnungen → „🌦️ Wetter-Warnungen ansehen" · test-push → „📨 Test-Push senden" (8 von 8).

4) ZAHL UND ABGRENZUNG STIMMEN
Alle Bedienelemente in `#settings-scroll`, die in KEINER `.settings-row` stecken, nach Container gezaehlt: 9 Kategorie-Checkboxen + `push-lead-hours` + `push-quiet-start`/`-end` + 4 Pause-Knoepfe + `push-test-btn` + `push-wx-btn` = **18**, und alle 18 liegen in `#push-detail-settings`. Sonst kein einziges. Die Gegenprobe des Befunds ist ebenfalls exakt reproduziert: **41 nicht-Admin-`.settings-row`, 0 Ausfaelle.**

5) FUER NUTZER BEMERKBAR, NICHT NUR THEORETISCH
`gsPushSettingsRefresh` (index.html:81640-81648) laeuft 2,8 s nach jedem Boot automatisch und setzt `if (detail) detail.style.display = sub ? '' : 'none';` — wer eine aktive Push-Subscription hat, sieht das Panel bei JEDEM Besuch der Einstellungen offen, ohne Zutun. Wer dann „urlaub" tippt, bekommt „Keine Einstellung gefunden.".

6) KEINE ABSICHT DOKUMENTIERT
Der Kommentar am Suchcode (16221-16226) begruendet ausdruecklich nur die Admin-Zeilen („Admin-only-Rows (inline display:none) bleiben in der Suche unsichtbar"). Zum Push-Panel steht nichts — weder dort, noch in STATUS.md oder ROADMAP.md (`grep` leer).

EINE PRAEZISIERUNG ZUM TITEL (kein Widerspruch, aber wichtig fuer die Reparatur): Weil das Panel keine `.settings-row` ist, wird es von der Suche auch nie AUSGEBLENDET. Es bleibt bei JEDER Suche stehen — auch bei „sprache" oder „einheiten" (gemessen: `Panel sichtbar: true` in allen 11 Laeufen). „Ueberhaupt nicht auffindbar" ist also insofern zugespitzt, als die Elemente sichtbar bleiben; die Suche findet sie nur nie und behauptet aktiv das Gegenteil. Der Fehler geht damit in beide Richtungen: nicht filterbar UND faelschlich als „nicht vorhanden" gemeldet.
```

</details>

### ✅ [26] `#settings-search-none` („Keine Einstellung gefunden.") erscheint gleichzeitig mit sichtbaren Einstellungen — die Meldung widerspricht dem Bildschirm.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 16261
- **Folge:** Suche „zzz-gibtsnicht" ohne Push: Meldung sichtbar, darunter 457 px Inhalt. innerText des Scrollbereichs: „🔍 ⇕ Keine Einstellung gefunden. 🌿 GreenScan Version v32.29 · 2026 4'337 Arten in DB 🇨🇭 Schweiz Focus Die #1 Natur-App der Schweiz. …". Mit aktiviertem Push: 1162 px, Text beginnt „Keine Einstellung gefunden. Welche Benachrichtigungen? 🥶 Frostgefahr 🥵 Hitzewarnung 🌪️ Sturm / Starkregen …". Der Nutzer liest „nichts gefunden" und sieht darunter neun Schalter.

<details><summary>Beleg</summary>

```
  if (none) none.style.display = anyGroup ? 'none' : 'block';

`anyGroup` wird ausschliesslich aus `.settings-row`-Treffern (16249) bzw. Gruppentitel-Treffern gesetzt. Der Nicht-Zeilen-Inhalt aus Befund 1 geht in diese Rechnung nicht ein, wird aber auch nicht ausgeblendet.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — im Browser doppelt reproduziert.

BELEG-STELLE: Der zitierte Code steht verbatim in /home/user/GreenScan/index.html, aktuell Zeile 16294 (nicht 16261): `if (none) none.style.display = anyGroup ? 'none' : 'block';`. Die Zeilennummer im Befund ist um ~33 Zeilen veraltet, weil index.html gerade uncommitted von einer Parallel-Sitzung geaendert wird (git status: ` M index.html`, App meldet v32.31, Befund gegen v32.29). Reine Zitat-Drift, kein Gegenbeweis.

URSACHE (gelesen, nicht vermutet): In `window.gsSettingsSearch` (ab 16264) gilt fuer jeden Body mit mindestens einer `.settings-row` der Zweig ab 16276; dort steht in 16284 unbedingt `b.classList.remove('gs-grp-nomatch')`. Nur die ROWS selbst bekommen `.gs-row-nomatch` (16281). Nicht-Zeilen-Inhalt in diesem Body wird weder ausgeblendet noch in `groupHasVisible`/`anyGroup` gezaehlt. Der `else`-Zweig 16286-16288, der rowlose Bodies ausblenden wuerde ("Bodies ohne Rows (Ueber-Card, Legal-Banner)"), greift fuer die Ueber-Card NIE, weil diese Card sehr wohl eine Row enthaelt: `#settings-admin-row` (~Z. 6691, `style="display:none"`). Deren `adminHidden`-Flag haelt sie korrekt aus `groupHasVisible` heraus -> `anyGroup` bleibt false, die Meldung erscheint — und die Card bleibt trotzdem stehen.

REPRODUKTION (Playwright, 412x800, _seed.js, switchTab('settings'), Suche "zzz-gibtsnicht"):
- `#settings-search-none` -> computed `display:block`, darunter 225 px sichtbarer Inhalt. innerText von `#settings-scroll`: "🔍 ⇕ Keine Einstellung gefunden. 🌿 GreenScan Version v32.31 · 2026 4'337 Arten in DB 🇨🇭 Schweiz Focus Die #1 Natur-App der Schweiz. …" — wortgleich mit dem Befund.
- Mit geoeffnetem `#push-detail-settings` (der ECHTE Zustand eines Push-Nutzers: `gsTogglePushMaster` setzt `detail.style.display = ''`, ~Z. 81592): 889 px und 18 sichtbare Bedienelemente — push-cat-frost/heat/storm/water/seasonal/quiz/classes/doctor/battle, push-lead-hours, push-quiet-start/end, push-test-btn, push-wx-btn. Text beginnt "Keine Einstellung gefunden. Welche Benachrichtigungen? 🥶 Frostgefahr …".

VERSCHAERFEND: `#settings-search-wrap` ist `position:sticky;top:0` (Z. 1584) — die Meldung bleibt oben angeheftet, waehrend der Nutzer den Inhalt darunter scrollt.

KEINE ANDERE STELLE BEHANDELT ES: nur EINE Definition von `gsSettingsSearch` (16264, IIFE mit `_gsSetAccWired`), kein spaeteres Override; `oninput` (Z. 6086) ruft sie direkt; keine Zuordnungstabelle, kein Start-Aufruf dazwischen.

KEINE ABSICHT: Der v28.14-Changelog (sw.js:240) nennt als Ziel "blendet leere Gruppen aus, 'keine Treffer'-Hinweis". Die einzige dokumentierte Ausnahme (Kommentar 16218/16280) betrifft, dass Admin-Rows unsichtbar BLEIBEN — die Gegenrichtung. Weder STATUS.md noch ein Kommentar rechtfertigt stehenbleibenden Nicht-Zeilen-Inhalt.

EINZIGE ABWEICHUNG: meine Messwerte sind 225 px bzw. 889 px statt der behaupteten 457 / 1162 px — offenbar andere Bezugsgroesse (der Befund hat `#settings-scroll`-Padding 12/16/80 und den Suchkasten mitgezaehlt). Die Aussage und die zitierten Texte stimmen exakt.

NEBENBEFUND aus demselben Lauf: acht weitere `.settings-card` bleiben als 2-px-Streifen stehen (Rahmen/Padding ohne Inhalt) — dieselbe Ursache, rein kosmetisch.
```

</details>

### ✅ [27] Leere Karten-Huellen bleiben als duenne Striche stehen: 7 Karten a 2 px pro Suche.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 16244
- **Folge:** Gemessen bei Suche „nachtmodus": Hoehen der sichtbaren Karten ohne einzige sichtbare Zeile = [2, 2, 2, 2, 2, 2, 2, 209] px. Sieben duenne, leere Kaesten mit Rahmen und Schatten rahmen den einen Treffer ein (im Screenshot ueber „DARSTELLUNG" sichtbar); der achte ist die Ueber-Karte aus Befund 1.

<details><summary>Beleg</summary>

```
if (rows.length){ ... b.classList.remove('gs-grp-nomatch'); }

zusammen mit index.html:84969
.settings-card { background: var(--card); border-radius: var(--r-lg); margin-bottom: 8px;
                 box-shadow:var(--elev-1); border: 1px solid var(--border); }

Werden alle Zeilen einer Karte per .gs-row-nomatch ausgeblendet, bleibt die Karte selbst stehen — Rahmen oben + unten = 2 px, dazu 8 px Abstand.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — im Browser exakt reproduziert.

WAS STIMMT: In `gsSettingsSearch` bekommt jeder Karten-Body MIT Zeilen bedingungslos `b.classList.remove('gs-grp-nomatch')` (index.html:16284, im Zweig `if (rows.length){` auf 16278). Ausgeblendet wird nur die einzelne Zeile (`r.classList.toggle('gs-row-nomatch', !match)`, 16281) und der Gruppen-TITEL (`g.title.classList.toggle('gs-grp-nomatch', !groupHasVisible)`, 16291) — nie die Karte selbst. Zusammen mit `.settings-card { border: 1px solid var(--border); margin-bottom: 8px; box-shadow: var(--elev-1); }` (index.html:85061) bleibt eine 2 px hohe, gerahmte, weisse Hülle mit Schatten stehen.

GEMESSEN (Playwright, 412x915, Hellmodus, `switchTab('settings')`, echtes input-Event auf #settings-search):
  „nachtmodus": Höhen/sichtbare Zeilen der 9 Direktkind-.settings-card =
    2px/0  2px/0  65px/1  2px/0  2px/0  2px/0  2px/0  2px/0  209px/0
  → exakt die behaupteten [2,2,2,2,2,2,2,209]. display:block, borderTop/Bottom 1px/1px, margin-bottom 8px, Kartenabstand 10 px, box-shadow rgba(0,0,0,.07) 0 2px 8px, bg #fff auf --g-bg #f4f1ea, Rahmen --border #e3ded3.
Im Screenshot als graue Haarlinien über „DARSTELLUNG" und unter der Nachtmodus-Karte klar sichtbar — also NICHT bloss theoretisch.

GEGENPROBE mit drei weiteren Begriffen — nicht auf „nachtmodus" beschränkt:
  sprache   -> 2/0 2/0 2/0 76/1 2/0 2/0 2/0 2/0 209/0   (7 leere Hüllen)
  einheiten -> 2/0 64/1 2/0 2/0 2/0 2/0 2/0 2/0 209/0   (7)
  push      -> 2/0 2/0 2/0 140/2 2/0 2/0 2/0 2/0 209/0  (7)
  offline   -> 2/0 2/0 2/0 2/0 2/0 2/0 2/0 2/0 209/0    (8)
Der Fall „offline" ist der schlechteste: kein Treffer, #settings-search-none („Keine Einstellung gefunden.") erscheint — und darunter stehen trotzdem acht gerahmte leere Streifen plus die 209-px-Über-Karte.

WIDERLEGUNGSVERSUCHE, alle erfolglos:
- Behandelt es jemand anders? Nein. Alle 11 Vorkommen von gs-grp-nomatch / gs-row-nomatch / gs-acc-hide liegen in derselben IIFE (16234–16330). Keine `:has()`-Regel für .settings-card (das einzige `:has()` der Datei ist 1405, .doctor-sym-chip), keine `:empty`-Regel, kein Start-Aufruf, keine Zuordnungstabelle. Die frühere .settings-card-Regel (1652, ohne Rahmen) wird von 85061 überschrieben (gleiche Spezifität, später gewinnt).
- Absicht? Nirgends begründet. Der einzige Kommentar in der Nähe (16285-16286) erklärt den ELSE-Zweig („Bodies ohne Rows (Über-Card, Legal-Banner): nur bei Treffer im Gruppentitel zeigen"), nicht das bedingungslose remove im if-Zweig. STATUS.md und docs/ erwähnen den Fall nicht.

EINZIGE MÄNGEL DES BEFUNDS — Belegfehler, kein Gegenbeweis:
Die Zeilennummern stimmen beide nicht. Zitiert 16244; dort steht `else if (cur && el.id !== 'settings-search-wrap') { cur.bodies.push(el); }` (buildGroups). Der zitierte Code steht auf 16278/16284. Zitiert CSS 84969; dort steht `.scan-overlay`. Die zitierte Regel steht auf 85061 — Wortlaut sonst exakt. (Auch auf HEAD passen die Nummern nicht: 16244 = `}`, 84969 = `);` — die Nummern waren schon ursprünglich ungenau, nicht durch die 55+/23- Arbeitskopie-Änderung verschoben.)

Korrekte Fassung: index.html:16284 (+ 16278) und index.html:85061.
```

</details>

### ✅ [28] Der Gruppentitel behaelt im Suchmodus `gs-collapsed` und `aria-expanded="false"`, obwohl die Suche den Abschnitt aufklappt.

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 16242
- **Folge:** Gemessen bei Suche „nachtmodus": Klasse des sichtbaren Titels = „settings-group-title gs-acc-h gs-collapsed", aria-expanded = „false", ::after-transform = matrix(1,0,0,1,0,0) (= rotate(0deg), also der ZU-Pfeil ▸). Der Pfeil zeigt „zugeklappt", waehrend die Treffer-Zeile darunter sichtbar ist; ein Screenreader meldet den Abschnitt als eingeklappt. Betroffen ist jeder Treffer ausserhalb der ersten Gruppe (8 von 9 Gruppen sind standardmaessig zu).

<details><summary>Beleg</summary>

```
g.bodies.forEach(function(b){
  b.classList.remove('gs-acc-hide');   // im Suchmodus alle Bodies aufklappen

Der Body wird aufgeklappt, der Titel aber nicht nachgezogen — `gs-collapsed` und `aria-expanded` werden nur in toggleGroup()/applyAccordion() (16218) bzw. im Klick-Handler (16287) gesetzt.

CSS 1563: .settings-group-title.gs-acc-h.gs-collapsed::after{transform:rotate(0deg);}
CSS 1562: ...::after{content:'\25B8'; ... transform:rotate(90deg);}
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — im Kern bestaetigt, mit einer Einschraenkung bei den Zeilennummern.

1) ZEILE: Die genannte Zeile 16242 stimmt NICHT (dort steht `function writeState(s){...}`). Der zitierte Code steht tatsaechlich in index.html:16275, die zwei CSS-Regeln in 1595/1596 statt 1562/1563. Das ist reine Zitat-Drift (index.html hat uncommittete Aenderungen, auch HEAD passt nicht zu den Zahlen) — der zitierte Code selbst ist woertlich korrekt vorhanden:
   16275: b.classList.remove('gs-acc-hide');   // im Suchmodus alle Bodies aufklappen
   1595:  .settings-group-title.gs-acc-h::after{content:'\25B8'; ... transform:rotate(90deg); ...}
   1596:  .settings-group-title.gs-acc-h.gs-collapsed::after{transform:rotate(0deg);}

2) KEINE Tabelle/Helfer/Startaufruf faengt es ab: `aria-expanded` wird an genau DREI Stellen geschrieben, alle in init() — 16319 (initial), 16320 (Klick), 16321 (Tastatur). `gsSettingsSearch` (16265-16295) fasst weder `gs-collapsed` noch `aria-expanded` am Titel an. `applyAccordion()` wird bei nicht-leerer Suche gar nicht erreicht (nur im `if (!q){...return;}`-Zweig) — und setzt uebrigens selbst KEIN aria-expanded, nur `gs-collapsed` (16251).

3) BROWSER-LAUF (file://, Suche "nachtmodus", alle 9 Gruppentitel ausgelesen) bestaetigt die Messung des Befunds exakt:
   "🎨 Darstellung": cls = "settings-group-title gs-acc-h gs-collapsed", aria-expanded = "false", display = flex, ::after transform = matrix(1, 0, 0, 1, 0, 0) (= rotate(0deg) = ZU-Pfeil ▸).
   Sichtbare Zeilen: ["🌙 Nachtmodus Dunkles Farbschema"] — der Treffer steht also sichtbar unter einem Titel, der "zugeklappt" anzeigt.
   Die uebrigen acht Titel sind `gs-grp-nomatch` (display:none). Standardzustand bestaetigt: isOpen() = `(k in state) ? !!state[k] : (i === 0)` → 8 von 9 Gruppen sind zu, also ist jeder Treffer ausserhalb der ersten Gruppe betroffen.

4) NICHT als Absicht dokumentiert: kein Kommentar an der Stelle erwaehnt den Titel; STATUS.md und ROADMAP.md enthalten weder "gsSettingsSearch" noch "Suchmodus" noch eine Notiz zu B-004s Suchverhalten.

EINSCHRAENKUNG, ehrlich benannt: Die OPTISCHE Haelfte laesst sich verteidigen — `gs-collapsed` spiegelt den gespeicherten `gs_set_acc`-Zustand, und ein Klick auf den Titel wirkt auf genau diesen Zustand (nach Leeren der Suche klappt die Gruppe wieder zu). Die ARIA-Haelfte laesst sich nicht verteidigen: `aria-expanded="false"` behauptet, der zugehoerige Inhalt sei verborgen — er ist es messbar nicht. Ein Screenreader meldet den Abschnitt als eingeklappt, waehrend die Treffer-Zeile exponiert ist. Damit bleibt der Befund stehen.
```

</details>

## Sicherheit, Löschen und Admin

### 🔴 [29] „Alle Daten löschen" löscht nur gs_*/ps_* — die GPS-Fundorte (greenscan_markers) und userLocation bleiben liegen, obwohl der Dialog „alles im Gerät gespeicherte" verspricht

- **Schwere:** hoch  ·  **Zeile (v32.31):** 51639
- **Folge:** Wer die App weggibt, verkauft oder aus Datenschutzgründen aufräumt, drückt „Endgültig löschen", liest „Alle Daten gelöscht" — und die Karten-Fundorte mit GPS-Koordinaten plus der eigene Wohnort-Standort liegen unverändert weiter im Gerät. Es sind genau die Daten, wegen denen man so einen Knopf drückt.

<details><summary>Beleg</summary>

```
function clearAllData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('gs_') || k.startsWith('ps_'));
  keys.forEach(k => localStorage.removeItem(k));

// Der Dialog dazu (51652):
  message: 'Pflanzen, Gärten, Einstellungen, Scan-Verlauf — alles im Gerät gespeicherte wird unwiderruflich gelöscht. Cloud-Daten bleiben.'

// Aber (52514, 52873, 53074 …):
  localStorage.setItem('greenscan_markers', JSON.stringify(markers));
// und (56201/56211):
  var userLocation = safeGetItem('gs_user_location', null);
  try { localStorage.setItem('userLocation', JSON.stringify(locObj)); } catch(e){}

// Im Browser nachgestellt (Playwright, exakt dieser Rumpf, ohne reload):
//   vorher 36 Schlüssel → übrig: ["greenscan_markers", "userLocation"]
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Kern des Befundes bestätigt, eine Hälfte davon widerlegt. Im Einzelnen:

**1. Zeilennummer stimmt nicht, der zitierte Code schon.** `clearAllData()` steht nicht auf 51639, sondern auf **51708** (index.html ist im Arbeitsbaum modifiziert, `git status` → ` M index.html`; Verschiebung ~69 Zeilen). Der Rumpf ist wörtlich wie behauptet:
'''
function clearAllData() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('gs_') || k.startsWith('ps_'));
  keys.forEach(k => localStorage.removeItem(k));
'''
Der Dialog dazu steht auf **51716–51731** (`window.gsConfirmClearAllData`), verdrahtet auf **6604** (`<div class="settings-row" onclick="gsConfirmClearAllData()">`), Text wie zitiert: „…alles im Gerät gespeicherte wird unwiderruflich gelöscht."

**2. `greenscan_markers` — bestätigt, end-to-end nachgestellt.** Playwright, echter Knopfweg inkl. des automatischen `location.reload()` nach 1,5 s: 28 Schlüssel vorher, danach liegt der Fundort unverändert da —
`[{"id":"m1","lat":46.94,"lng":7.44,"name":"Steinpilz-Stelle","note":"geheime Stelle","cat":"pilz",…}]`.
Es ist keine Leiche: nach dem Neustart liefert `gsGetSavedMarkers()` (53144) weiterhin 1, und `_gsNjArr('greenscan_markers')` (19838, „Karten-Funde" im Naturjahr) zählt sie mit. Geschrieben wird der Schlüssel aktiv an sechs Stellen (52584, 52645, 52756, 52903, 52943, 53110, 74921).

**3. Keine Stelle behandelt das bereits.** Entfernt wird `greenscan_markers` nur an zwei Orten: `gsMapClearAll()` (54833, der separate Knopf „Alle Funde löschen" auf der Karte) und `gsClearUserDataKeys()` (78634) über `GS_USER_KEYS` (Eintrag auf **78588**, kommentiert als „private GPS-Funde"). `clearAllData` ruft weder das eine noch das andere. Auch der Nutzerwechsel-Zweig greift nicht: `gsSyncUserDataOnLogin` (78681) vergleicht `gs_last_active_uid` — der beginnt mit `gs_`, wird also von `clearAllData` selbst gelöscht, `lastUid` ist danach `null`, der Clear-Zweig läuft nie.

**4. Absicht? Das Gegenteil ist dokumentiert.** Der Kommentar auf **78491** sagt ausdrücklich: „(Pendant: clearAllData / Konto-Loeschung wipet komplett bis auf gs_dark/gs_theme_color/gs_lang.)" Für die Konto-Löschung (77690: `localStorage.clear()` mit keep-Liste `['gs_dark','gs_theme_color','gs_lang']`) stimmt das; für `clearAllData` **nicht** — es löscht gs_dark/gs_theme_color/gs_lang sogar mit und lässt dafür `greenscan_markers` liegen. Die Doku beschreibt also genau das Verhalten, das der Code nicht hat. Und derselbe Schlüssel steht in `GS_USER_KEYS`, wird also schon beim blossen **Abmelden** als zu löschende Nutzerdaten geführt — beim „Alles löschen" liegen zu bleiben ist damit widersprüchlich, nicht gewollt.

**WIDERLEGT: die `userLocation`-Hälfte des Titels.** Sie überlebt die `removeItem`-Schleife zwar, wird aber vom unmittelbar folgenden Neustart (`setTimeout(location.reload, 1500)` in `clearAllData` selbst) überschrieben: da `gs_user_location` weg ist, greift der Standort-Rückfall und `saveUserLocation` (56277) schreibt **beide** Schlüssel neu. Gemessen: vorher `{"lat":46.0037,"lng":8.9511,"name":"Lugano-Wohnung",…}`, nach dem Reload in `userLocation` **und** `gs_user_location` nur noch `{"lat":47.3769,…,"name":"Zürich (Standard — bitte Standort erlauben)"}`. Der private Wohnort bleibt also **nicht** liegen. Der Befund hat das nur nachgestellt „ohne reload" — genau der Schritt, den der Knopf selbst auslöst.

**Fazit:** Ein Schlüssel von zweien ist falsch, und die Zeilennummer stimmt nicht. Der tragende Vorwurf bleibt aber unwiderlegt und ist reproduziert: Wer „Endgültig löschen" drückt und „Alle Daten gelöscht" liest, behält seine privaten GPS-Fundorte samt Notizen und Koordinaten unverändert im Gerät — genau die Daten, wegen denen man den Knopf drückt. Korrekter Titel wäre: „…lässt `greenscan_markers` (private GPS-Fundorte) liegen"; `userLocation` gehört gestrichen. Die naheliegende Reparatur wäre, `clearAllData` denselben Weg gehen zu lassen wie die Konto-Löschung (77690) bzw. wenigstens `gsClearUserDataKeys()` mitzurufen.
```

</details>

### ❌ [30] „Backup importieren" meldet Erfolg, ohne hinzusehen: 7 der 11 exportierten Bereiche werden nie zurückgeschrieben, und die Rückgabewerte der Speicherfunktionen werden ignoriert

- **Schwere:** hoch  ·  **Zeile (v32.31):** 51617
- **Folge:** Nach dem Import sind Pflanzenfriedhof, Standort, eigene Rezepte, Heilmittel, Inserate, Community-Beiträge und Feedback still verschwunden — die Meldung sagt trotzdem „Backup erfolgreich importiert!". Und bei vollem Gerätespeicher (gsStore.setJSON gibt false zurück, wirft nicht) sagt sie dasselbe, obwohl gar nichts geschrieben wurde: Gärten können durchgehen und Pflanzen scheitern, also bleibt ein halber Datenstand aus zwei verschiedenen Zeitpunkten stehen. Genau die Falle aus v31.65/v31.76, nur mit den Rückgabewerten, die eigens dafür da sind.

<details><summary>Beleg</summary>

```
// exportUserData schreibt 11 Bereiche (51579-51589):
//   gardens, plantings, myPlants, deadPlants, recipesData, remediesData,
//   marketListings, socialPosts, prefs, location, feedback

// importUserData liest davon 6 und persistiert 4 (51617-51628):
  if (_impOk) {
    if (data.gardens)   { gardens = data.gardens; }
    if (data.plantings) { plantings = data.plantings; }
    if (data.myPlants)  { myPlants = data.myPlants; }
    if (data.deadPlants){ deadPlants = data.deadPlants; }   // wird NIE gespeichert
    if (data.prefs)     { userPrefs = data.prefs; applyAllPrefs(); }
    if (data.location)  { userLocation = data.location; }   // wird NIE gespeichert
    saveGardenData();       // return okG && okP   (69346) — ignoriert
    savePlantsToStorage();  // return ok           (33507) — ignoriert
    savePrefs();            // schreibt nur gs_prefs (51139)
    showMarketNotif('Backup erfolgreich importiert!', '📥', '#1565c0');
    location.reload();
  }

// deadPlants liegt in gs_dead_plants (37171), userLocation in gs_user_location
// (56201/56211) — beide Schlüssel schreibt keine der drei Funktionen.
// location.reload() wirft die Variablen zwei Zeilen später weg.
```

</details>

### ❌ [31] saveApiKey() nimmt jede beliebige Zeichenkette an — getApiConfig() verwirft sie danach stumm; ein leeres Feld löscht den Schlüssel ohne Rückfrage

- **Schwere:** hoch  ·  **Zeile (v32.31):** 71686
- **Folge:** Ein abgebrochener Paste oder ein Tippfehler wird angenommen, das Fenster schliesst sich zufrieden — und der Scanner meldet danach weiter „kein Key", ohne dass irgendwo steht, warum. Der KI-Dienst-Status daneben (gsRenderKeyStatus, 56389) liest ausschliesslich den GLOBALEN Schlüssel und sagt zum persönlichen gar nichts. Umgekehrt löscht ein leeres Feld plus „Speichern" den hinterlegten Schlüssel wortlos, während der dafür gebaute Weg (gsRemovePersonalKey, 26851) mit einem Gefahren-Dialog und Quota-Hinweis fragt.

<details><summary>Beleg</summary>

```
function saveApiKey(){
  const k = document.getElementById('apikey-input').value.trim();
  const p = document.getElementById('api-provider').value;
  if(k) localStorage.setItem('ps_api_key',k);
  else localStorage.removeItem('ps_api_key');
  localStorage.setItem('ps_api_provider',p);
  closeModal('apikey-modal');
  updateApiBanner();
}

// Die Regel steht 45'000 Zeilen weiter oben in getApiConfig (26837):
  if (personalKey && personalKey.startsWith('sk-ant-') && personalKey.length >= 80) {
    key = personalKey; source = 'personal';
  } … else { key = ''; source = 'none'; }

// Im Browser nachgestellt: Eingabe "hallo-ich-bin-kein-key" → Speichern →
//   localStorage.ps_api_key = "hallo-ich-bin-kein-key"
//   getApiConfig() = {provider:"anthropic", key:"", source:"none"}
// Keine Meldung, kein Testaufruf, kein roter Rand.
// gsAdminSetGlobalApiKey (71502) prüft dagegen sehr wohl:
//   if (!newKey || !newKey.startsWith('sk-ant-')) { … return false; }
```

</details>

### 🔴 [32] Im Admin-Panel sperrt und beschenkt ein einziges onchange am Auswahlfeld — „🚫 Gesperrt" und „♾️ Lifetime" ohne jede Rückfrage; derselbe Vorgang über gsAdminBanUser fragt sehr wohl

- **Schwere:** hoch  ·  **Zeile (v32.31):** 83097
- **Folge:** Vier Wege zur selben folgenschweren Aktion, drei davon ohne Rückfrage. Zwei Auswahlfelder stehen in jeder Zeile einer scrollenden Nutzerliste direkt nebeneinander — auf dem Telefon ist eine daneben getippte Auswahl eine Sperrung („banned" macht gsRoleAtLeast dauerhaft false) oder ein verschenktes Lifetime-Abo. Beides ist danach nur von Hand rückgängig zu machen, und beim Tier steht Geld dahinter.

<details><summary>Beleg</summary>

```
// Nutzerzeile im Admin-Panel (83097 und 83106):
'<select onchange="gsAdminAssignRole(\'' + u.id + '\', this.value).then(function(){openAdminPanel();})" …>' +
  '<option value="admin">👑 Admin</option>' … '<option value="banned">🚫 Gesperrt</option>' +
'<select onchange="gsAdminSetTier(\'' + u.id + '\', this.value).then(function(){openAdminPanel();})" …>' +
  '<option value="pro">💎 Pro</option><option value="lifetime">♾️ Lifetime</option>' +

// Dritter Weg, Nutzer-Detail (82375) — ebenfalls ohne Rückfrage:
'<button onclick="gsAdminAssignRole(\''+p.id+'\',\''+(isBanned?'user':'banned')+'\')…">🚫 Nutzer sperren</button>'

// Vierter Weg, und NUR dieser fragt (72450):
async function gsAdminBanUser(targetEmail) {
  if (!gsIsAdmin()) return;
  if (!(await gsConfirmModal('Nutzer ' + targetEmail + ' wirklich sperren? Die Rolle wird auf „Gesperrt" gesetzt.'))) return;
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — im Gegenteil, es sind mehr Wege als gemeldet. Verifiziert (Zeilennummern des Befunds sind um ~103 veraltet, der zitierte Code stimmt aber wörtlich): index.html:83200 Rollen-Select mit onchange="gsAdminAssignRole('<id>', this.value)" inkl. <option value="banned">🚫 Gesperrt</option>; :83209 Tier-Select mit gsAdminSetTier(...) inkl. ♾️ Lifetime; :82106 gsAdminAssignRole prüft nur gsIsAdmin() und geht dann direkt auf sbFetch('/rest/v1/rpc/fn_assign_role') — KEINE Rückfrage; :82137 gsAdminSetTier ebenso (if (!gsIsAdmin() || !tier) return;) — KEINE Rückfrage; :82478 Sperr-Knopf im Nutzer-Detail ohne Rückfrage; :72551 gsAdminBanUser mit gsConfirmModal — der einzige fragende Weg.

ZWEI weitere ungefragte Wege, die der Befund nicht nennt: :82476 drei Knöpfe ['free','pro','lifetime'].map(...) → gsAdminSetTier(p.id, t) im Nutzer-Detail (vierter Weg zu Lifetime); und :72620 gsAdminSetExpertLevel fragt NUR bei newLevel === 'admin', während sein Select aus GS_ROLE_HIERARCHY.slice().reverse() (:72452, Hierarchie :82037 = ['banned','user',...]) gebaut wird — 'banned' ist dort wählbar und geht ohne jede Rückfrage durch. Der Befund ist also konservativ, nicht übertrieben.

Widerlegungsversuche, die fehlschlugen: (a) Kein delegierter Guard — der einzige dokumentweite 'change'-Listener (:34063) filtert auf e.target.name !== 'mp-location'; keine Neuzuweisung von window.gsAdminAssignRole/gsAdminSetTier. (b) Keine Absicht dokumentiert — kein Kommentar an den Aufrufstellen, nichts in STATUS.md/ROADMAP.md/docs; STATUS.md:2385-2405 (v31.96) behandelt genau diese Funktionen, diskutiert aber nur den SCHREIBWEG (RPC statt PATCH), nie die fehlende Rückfrage. (c) Erreichbar und folgenreich — index.html:6629 #settings-admin-dashboard-row onclick="openAdminPanel()"; gsRoleAtLeast (:82053) gibt für 'banned' immer false zurück, und fn_assign_role schreibt laut STATUS.md ins audit_log UND benachrichtigt die betroffene Person, d.h. ein Fehlgriff erreicht das Opfer, bevor der Admin ihn zurücknehmen kann.

Zwei ehrliche Einschränkungen, die den Befund aber nicht kippen: Die Formulierung „daneben getippte Auswahl" überzeichnet den Mechanismus — ein natives <select> verlangt zwei bewusste Schritte (Picker öffnen, Option tippen), nicht einen Fehltipp wie bei einem Knopf; die Sachaussage (folgenreiche, benachrichtigende, geldrelevante Aktion ohne Rückfrage, während derselbe Vorgang auf einem Schwesterweg sehr wohl fragt) hängt daran nicht. Und fn_assign_role hat eine serverseitige Teilsicherung (letzter Admin kann sich nicht selbst degradieren), die Änderung ist durch Neuauswahl umkehrbar — aber erst nach Benachrichtigung und Aussperrung.
```

</details>

### 🔴 [33] gsConfirmModal setzt den Fokus auf den Zerstör-Knopf, und Enter bestätigt — bei jedem einzelnen kind:'danger'-Dialog der App

- **Schwere:** mittel  ·  **Zeile (v32.31):** 17068
- **Folge:** Die gefährliche Antwort ist die vorausgewählte. Ein Enter oder eine Leertaste — beim Tippen, mit Bluetooth-Tastatur am Tablet, oder weil man gerade in einem Feld war — löst „Endgültig löschen" bzw. „Alle aktuellen Daten werden überschrieben" aus, ohne dass der Finger je den Knopf berührt hat. Escape auf „Abbrechen" ist richtig gebaut; die Vorauswahl ist die falsche Hälfte.

<details><summary>Beleg</summary>

```
// 17054:
  if (e.key === 'Enter'){ e.preventDefault(); finish(true);  return; }
// 17068:
  try { c.querySelector('#gs-confirm-ok').focus(); } catch(_){}

// Im Browser nachgestellt mit dem echten Lösch-Dialog:
//   gsConfirmModal({title:'Alle Daten löschen?', ok:'Endgültig löschen', kind:'danger'})
//   → document.activeElement.id = "gs-confirm-ok"  (Beschriftung "Endgültig löschen")
//   → ein KeyboardEvent 'Enter' liefert  true

// Betroffen sind u.a.:
//   51650  „Alle Daten löschen?"          (kind:'danger')
//   51613  „Backup importieren? Alle aktuellen Daten werden überschrieben!"
//   26860  „Persönlichen API-Key entfernen?"
//   75368  „Cache komplett leeren?"
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — der Kern stimmt, im Browser nachgemessen. Aber zwei Teile der Begründung sind falsch und die Zeilennummern sind veraltet.

1) CODE — steht da, was behauptet wird? JA, inhaltlich wörtlich, aber an anderen Zeilen.
   /home/user/GreenScan/index.html:17086  `if (e.key === 'Enter'){ e.preventDefault(); finish(true);  return; }`
   /home/user/GreenScan/index.html:17100  `try { c.querySelector('#gs-confirm-ok').focus(); } catch(_){}`
   Der Befund nennt 17054/17068 — beide exakt 32 Zeilen zu früh. `git diff --stat` zeigt 69 Einfügungen/26 Löschungen ungecommittet in index.html; die Nummern stammen also aus einem früheren Stand, sind nicht erfunden. Die Aufrufstellen sind ebenso verschoben (wachsender Versatz): tatsächlich 51718 „Alle Daten löschen?" (kind:'danger'), 51682 Backup-Import (kind:'danger'), 26910 „Persönlichen API-Key entfernen?" (kind:'danger'), 75472 „Cache komplett leeren?" (danger:true). Alle vier existieren mit dem behaupteten Text.

2) BROWSER-LAUF (playwright, file://, _seed.js), echter Lösch-Dialog:
   activeElement = {"id":"gs-confirm-ok","txt":"Endgültig löschen","bg":"rgb(198, 40, 40)"}  → der rote Zerstör-Knopf hat den Fokus.
   Enter  → Promise löst mit `true` auf, Modal weg.
   Escape → `false`. (Escape-Hälfte ist korrekt gebaut, wie behauptet.)

3) GIBT ES EINE BEHANDLUNG WOANDERS? Gesucht, nichts gefunden:
   · Nur EINE Definition von gsConfirmModal (17020) — kein späteres Überschreiben.
   · `gsRegisterOverlay` (24886) / `gsDismissOverlay` fassen den Fokus nicht an.
   · `gsTrapFocus` wird hier gar nicht aufgerufen; und die DOM-Reihenfolge ist ok→cancel (`flex-direction:row-reverse` dreht nur die Optik), ein „erstes Element fokussieren"-Trap landete also ebenfalls auf dem Zerstör-Knopf.
   · Kein `e.repeat`-, `isTrusted`- oder Zeit-Schutz: `String(gsConfirmModal).includes('repeat')` = false.
   · Keine Tabelle/Schleife, die das generisch löst; keine Stelle im Repo fokussiert je einen Abbrechen-Knopf.

4) ABSICHT? Nein dokumentiert. Kein Kommentar an der focus()-Zeile; nichts in STATUS.md, ROADMAP.md, docs/. Die Kommentare begründen nur den ERSATZ von natives confirm() (Hard-Lesson #2), nicht die Fokus-Wahl. Gegenargument „natives confirm() macht es genauso" trägt nicht als Freispruch: die App hat den Dialog selbst gebaut und ARIA-APG rät für zerstörende Bestätigungen ausdrücklich zur am wenigsten zerstörenden Vorauswahl.

5) BEMERKBAR? Ja, und die eigene a11y-Schicht aus v32.16 verschärft es: `document.addEventListener('keydown', …)` bei 75215 löst bei `data-tast="auf"` ein `el.click()` aus. Nachgestellt: gehaltene Enter-Taste auf einem solchen Lösch-Element → Dialog geht auf → der Wiederholungs-keydown trifft den frisch registrierten Capture-Zuhörer → `true`. Auch direkt mit `new KeyboardEvent('keydown',{key:'Enter',repeat:true})` gemessen: `true`. Dazu Desktop und Tablet mit Bluetooth-Tastatur.

ZWEI KORREKTUREN AM BEFUND (überzogen bzw. falsch, ändern aber den Kern nicht):
 · „oder eine Leertaste" — WIDERLEGT. Eine einzelne Leertaste auf einem Tastatur-Ziel öffnet den Dialog nur; gemessen: Promise bleibt PENDING, Modal offen. Space kaskadiert nicht (der onKey-Handler kennt Space gar nicht, und Chrome aktiviert einen erst nachträglich fokussierten Button nicht per keyup).
 · „weil man gerade in einem Feld war" — WIDERLEGT. Diese Dialoge entstehen ausschliesslich durch bewusstes Auslösen eines Lösch-/Leeren-Knopfes; es gibt keinen Weg, auf dem der Dialog beim Tippen in einem Feld erscheint.

Ergebnis: Fokus auf dem Zerstör-Knopf plus Enter-bestätigt-alles ist real, unbehandelt, undokumentiert und über die Tastatur-Wiederholung praktisch erreichbar — bei allen kind:'danger'-Dialogen, u.a. den vier Einstellungs-Aktionen.
```

</details>

### ❌ [34] gsAdminAssignRole meldet „✅ Rolle zugewiesen" allein aufgrund von !r.error — obwohl sbFetch nicht wirft und die Schwesterfunktion gsAdminSetTier 30 Zeilen weiter d.ok prüft

- **Schwere:** mittel  ·  **Zeile (v32.31):** 82010
- **Folge:** Eine Rollenzuweisung, die serverseitig ins Leere läuft (RPC gibt null zurück, RLS lässt die Zeile fallen, der letzte Admin darf sich nicht selbst degradieren), meldet trotzdem „✅ Rolle zugewiesen: banned". Der Admin glaubt, der Nutzer sei gesperrt, gsAdminBanUser schreibt sogar noch brav ins lokale Admin-Log — und der Nutzer postet weiter. Genau die Klasse, die v31.94/v31.95 an drei anderen Stellen behoben hat.

<details><summary>Beleg</summary>

```
async function gsAdminAssignRole(userId, role, note) {
  …
    var r = await sbFetch('/rest/v1/rpc/fn_assign_role', { … });
    if (r && !r.error) {
      showProfileToast && showProfileToast('✅ Rolle zugewiesen: ' + role);
      return r.data;
    }

// Direkt darunter macht es die Tier-Vergabe richtig (82037):
    var r = await sbFetch('/rest/v1/rpc/fn_admin_set_tier', { … });
    var d = (r && r.data) || {};
    if (d.ok) { … } else { gsToast('Tier-Wechsel fehlgeschlagen: ' + (d.error || 'unbekannt'), 'error'); }

// Und seit v32.28 gibt es dafür den Helfer _gsSchreibOk(r) — hier ungenutzt.
```

</details>

### ⚪ [35] „Konto löschen" verspricht „Alle Scans & Bilder" — räumt aber nur den localStorage; die IndexedDB-Warteschlange mit den base64-Fotos bleibt auf dem Gerät

- **Schwere:** mittel  ·  **Zeile (v32.31):** 77603
- **Folge:** Nach der Konto-Löschung ist niemand mehr angemeldet — also läuft der 90-Tage-Deckel nie an, und die noch nicht hochgeladenen Fotos sowie das Archiv gekürzter Einträge bleiben unbegrenzt im Gerät. Bei einer Aktion, die ausdrücklich mit „unwiderruflich" und revDSG wirbt, ist das genau der Rest, den niemand vermutet — und der Nutzer hat keinen Weg mehr, ihn zu erreichen, weil das Konto weg ist.

<details><summary>Beleg</summary>

```
// gsExecuteDeleteAccount, nach erfolgreicher Edge-Function (77600-77605):
    var keep = {};
    var keepKeys = ['gs_dark', 'gs_theme_color', 'gs_lang'];
    keepKeys.forEach(function(k){ var v = localStorage.getItem(k); if (v != null) keep[k] = v; });
    localStorage.clear();
    Object.keys(keep).forEach(function(k){ localStorage.setItem(k, keep[k]); });

// Der Dialog zählt vorher auf (77523-77527): "Alle Scans & Bilder", "Alle Gärten, …"

// Es gibt in index.html KEIN einziges indexedDB.deleteDatabase(). Die fünf
// Ablagen (74498) überleben:
  var STORES = ['pending_scans','pending_diary','pending_sync','pending_photos','dropped_entries'];
// pending_photos hält das Bild im Klartext (gsQueuePhoto):
  tx.objectStore('pending_photos').add({ bucket: bucket, b64: b64, target: target, … uid: _gsUid() });

// Aufgeräumt wird Fremdes nur, wenn jemand ANDERES angemeldet ist (_gsRaeumeFremde):
  var mir = _gsUid();
  if (!mir) return 0;
```

</details>

### ⚪ [36] gsSnapshotCreate macht aus einer leeren Serverantwort ausdrücklich einen Erfolg (return r.data || true) — der Backup-Knopf meldet danach „✅ Backup in der Cloud gesichert"

- **Schwere:** mittel  ·  **Zeile (v32.31):** 79739
- **Folge:** Liefert die RPC nichts zurück (abgewiesene Zeile, Funktion ohne Rückgabe), bekommt der Nutzer „✅ Backup in der Cloud gesichert", gs_snapshot_last wird auf jetzt gesetzt und die Sync-Zeile zeigt „Backup vor 0 Min". Er verlässt sich auf ein Backup, das es nicht gibt — und weil das ein Sicherheitsnetz ist, merkt er es erst in dem Moment, in dem er es braucht.

<details><summary>Beleg</summary>

```
    var r = await sbFetch('/rest/v1/rpc/fn_user_snapshot_create', { … });
    if (r && !r.error) {
      try { localStorage.setItem('gs_snapshot_last', new Date().toISOString()); } catch(_){}
      try { _gsSnapshotMarkHad(); } catch(_){}
      return r.data || true;      // ← null wird zu true
    }

// Und der Aufrufer (gsManualSnapshotBackup, 80032):
  var id = await gsSnapshotCreate('manual');
  …
  if (id) { … gsToast('✅ Backup in der Cloud gesichert.','success'); }
  else    { gsToast('Noch keine Daten zum Sichern.','warning'); }
```

</details>

### ⚪ [37] gsAdminSaveSbKey biegt die Datenverbindung der ganzen Installation um — ohne Rückfrage, ohne Testaufruf, mit einer URL-Prüfung, die nur „https://" verlangt

- **Schwere:** mittel  ·  **Zeile (v32.31):** 71354
- **Folge:** Ein Tippfehler in der URL oder ein Key aus dem falschen Projekt wird angenommen, sofort scharf geschaltet („✅ … gespeichert und aktiviert!") und ohne einen einzigen Probeaufruf bestätigt. Ab da geht jeder sbFetch ins Leere: kein Login mehr, kein Sync, keine Cloud-Daten — und der Weg zurück (gsAdminResetSbKey, 71675) liegt hinter einem Admin-Panel, das man ohne Anmeldung nicht mehr öffnen kann. Die Begründung, mit der v31.50 die eine Hälfte dieser Oberfläche entfernt hat, gilt für die verbliebene Hälfte unverändert.

<details><summary>Beleg</summary>

```
function gsAdminSaveSbKey() {
  if (!gsIsAdmin || !gsIsAdmin()) return;
  var newKey = document.getElementById('admin-sb-key-input')?.value?.trim();
  var newUrl = document.getElementById('admin-sb-url-input')?.value?.trim();
  … // Key: length >= 20 und startsWith('sb_')
  var _keyOk = localStorage.setItem('gs_sb_key', newKey) !== false;
  if (_keyOk && newUrl && newUrl.startsWith('https://')) {
    _keyOk = localStorage.setItem('gs_sb_url', newUrl) !== false;
  }
  …
  SB_KEY = newKey;
  if (newUrl) SB_URL = newUrl;
  closeModal('modal-recipe-detail');
  showProfileToast('✅ Supabase Key gespeichert und aktiviert!');

// v31.50 hat die Schwesterfunktion aus genau diesem Grund entfernt (26820):
//   "Sie liess URL und Schluessel einer BELIEBIGEN Supabase-Instanz eintragen …
//    Eine Oberflaeche, die das Ziel der eigenen Datenverbindung umbiegt,
//    gehoert nicht in eine ausgelieferte App."
```

</details>

## Optik und Zugänglichkeit

### ✅ [38] 22 von 77 Bedienelementen auf #screen-settings haben keinen zugänglichen Namen — darunter ALLE 11 Kippschalter, alle 4 Auswahlfelder, die 6 Farbfelder und der Regler

- **Schwere:** hoch  ·  **Zeile (v32.31):** 6198
- **Folge:** Mit VoiceOver/TalkBack liest der Bildschirm elfmal „Kontrollkästchen, nicht aktiviert" und viermal „Kombinationsfeld" — ohne zu sagen, wozu. Wer nicht sieht, kann Nachtmodus, Senioren-Modus, Push, Sprache und Masseinheiten nicht auseinanderhalten und schaltet blind. Ausgerechnet der Senioren-Modus, der für schlechte Sicht gebaut ist, ist selbst unbeschriftet.

<details><summary>Beleg</summary>

```
Muster aller Schalter (Zeile 6198, identisch bei 6145/6157/6169/6227/6239/6266/6343/6354/6414/6430):
  <label class="settings-toggle">
    <input type="checkbox" id="toggle-dark" onchange="applyDarkMode(this.checked)">
    <span class="settings-toggle-slider"></span>
  </label>
Das umschliessende <label> enthält NUR den Input und den Schieber-Span — keinen Text. Der Titel steht daneben in <div class="settings-label-title">Nachtmodus</div>, ohne for/aria-labelledby.

Gemessen mit dem echten Barrierefreiheits-Baum (CDP Accessibility.getPartialAXTree, ein Aufruf je Element):
  live-track-toggle      checkbox  name=""
  gps-always-ask-toggle  checkbox  name=""
  cam-always-ask-toggle  checkbox  name=""
  pref-units             combobox  name=""   (value "°C / cm / kg")
  toggle-dark            checkbox  name=""
  swatch-green…brown     button    name=""   (6×)
  toggle-compact         checkbox  name=""
  toggle-senior          checkbox  name=""
  push-master-toggle     checkbox  name=""
  push-lead-hours        slider    name=""   (value 12)
  push-quiet-start/-end  combobox  name=""
  i18n-lang-picker       combobox  name=""   (value "🇩🇪 Deutsch")
  toggle-moon            checkbox  name=""
  toggle-home-weather    checkbox  name=""
  toggle-scan-history    checkbox  name=""
  toggle-ach-feed        checkbox  name=""
Summe: 77 Bedienelemente im Baum, 22 ohne Namen.

GEGENPROBE: die 9 Push-Kategorien im selben Bildschirm haben Namen — ihr <label> trägt Text (Zeile 6272 ff.):
  <label …><input type="checkbox" id="push-cat-frost" …> 🥶 Frostgefahr</label>
  → AX-Name "🥶 Frostgefahr". Die Ursache ist also genau das textlose .settings-toggle-Label, nicht der Baum.
Zweite Gegenprobe: aria-label="Nachtmodus" auf toggle-dark gesetzt → unbenannte Kontrollkästchen 11 → 10, Name erscheint. Der Test misst wirklich etwas.

Alle 12 im Auftrag genannten Handler stecken in dieser Liste.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Konnte den Befund NICHT widerlegen — im Gegenteil, er ist unabhaengig reproduziert.

1) MARKUP GEPRUEFT. Das behauptete Muster steht wirklich so da (index.html 6195-6198): <label class="settings-toggle"> enthaelt NUR den Input und einen leeren <span class="settings-toggle-slider">. Kein Text im Label, kein for=, kein aria-labelledby. Gegengeprueft: `grep 'label for='` findet fuer KEINE der ids (toggle-*, pref-units, i18n-lang-picker, push-lead-hours, push-quiet-*, swatch-*) eine Zuordnung, und aria-labelledby kommt in der ganzen Datei nur in fuenf Dialog-Stellen vor.

2) EIGENE MESSUNG, zweimal identisch. Playwright + CDP Accessibility.getPartialAXTree, _seed.js per addInitScript, switchTab('settings'), alle Akkordeon-Gruppen aufgeklappt, 1,8 s Wartezeit damit beide Nachruestungen laufen: 22 von 76 sichtbaren Bedienelementen haben name="" und sind NICHT ignored. Die Liste deckt sich exakt mit dem Befund (live-track/gps-always-ask/cam-always-ask/toggle-dark/-compact/-senior/push-master/toggle-moon/-home-weather/-scan-history/-ach-feed = 11 Kontrollkaestchen; pref-units, push-quiet-start, push-quiet-end, i18n-lang-picker = 4 Kombinationsfelder; swatch-green..brown = 6 Knoepfe; push-lead-hours = 1 Regler). Die Gegenprobe im selben Lauf traegt: die .settings-row mit onclick bekommen ueber gsTastaturNachruesten role=button UND einen Namen ("💎 Mein Plan Dein Tarif …"), die Push-Kategorien tragen Text im Label. Der Baum misst also wirklich etwas.

3) KEIN HELFER BEHANDELT ES. gsTastaturNachruesten (index.html:75188) setzt ausschliesslich tabindex und role, nie einen Namen. Die Auto-ARIA-Nachruestung labelize (index.html:76352 ff.) sucht `r.querySelectorAll('button:not([aria-label])')` — ein TAG-Selektor, der die sechs div[role=button]-Farbfelder gar nicht erfasst, und sie steigt ausserdem bei leerem textContent sofort aus (`if (!txt) return;`). Fuer input/select/[role=slider] gibt es gar keine Nachruestung. Keine Zuordnungstabelle, kein Startaufruf.

4) KEINE ABSICHT DOKUMENTIERT. Weder STATUS.md noch ROADMAP.md noch ein Kommentar an der Stelle begruendet textlose Schalter-Labels.

5) WARUM ES BISHER NIEMAND SAH (erklaert den Befund, widerlegt ihn nicht): scripts/a11y_check.js:32 — TABS = home,garden,wissen,favs,search,social,market,recipes,remedies,map,scanner. 'settings' fehlt, der Bildschirm wird nie besucht. Und selbst wenn: sichtbar() (a11y_check.js:40) verlangt width>=2 && height>=2, waehrend `.settings-toggle input{opacity:0;width:0;height:0;}` (index.html:1606) alle elf Kontrollkaestchen auf 0x0 setzt. Doppelt ungemessen.

KORREKTUREN AM BEFUND (kleiner, aendern das Urteil nicht):
- Die Zeilennummern haben einen durchgehenden Versatz von 26. An 6198 steht das </label> des cam-always-ask-Blocks; der toggle-dark-Input liegt im Arbeitsstand bei 6225 (bei HEAD 6207). Die elf echten <label class="settings-toggle">-Zeilen sind 6171, 6183, 6195, 6224, 6253, 6265, 6292, 6369, 6380, 6440, 6456 — jede genau 26 hoeher als die genannte. Das beschriebene Muster stimmt an jeder dieser Stellen woertlich; index.html ist im Arbeitsverzeichnis geaendert (+95 Zeilen), daher die Drift.
- 76 statt 77 Bedienelemente bei 412x820.
- Die "Folge" ist fuer das sequentielle Durchwischen leicht ueberzeichnet: der Titeltext steht als eigener Knoten unmittelbar davor, ein Nutzer kann ihn zuordnen. Fuer die Rotor-/Formularelement-Navigation stimmt sie, und fuer die Faelle ohne jeden ableitbaren Zusammenhang stimmt sie uneingeschraenkt: die sechs Farbfelder (role=button, kein Text, kein title, kein Label) und push-lead-hours (Regler, Wert 12, kein Name) sind so nicht bedienbar, push-quiet-start und -end nicht voneinander unterscheidbar.
```

</details>

### ✅ [39] Die sechs Farbfelder sagen zusätzlich nicht, WELCHES gewählt ist — der aktive Ton ist nur an einem Rahmen erkennbar, es gibt kein aria-pressed/aria-checked

- **Schwere:** hoch  ·  **Zeile (v32.31):** 6211
- **Folge:** Sechs Schaltflächen hintereinander, die alle „Schaltfläche" heissen und deren einziger Unterschied die Farbe ist — genau die Information, die ein blinder Nutzer nicht hat. Und selbst wer sieht, aber Rahmenkontraste schlecht wahrnimmt, erkennt die aktive App-Farbe nicht: sie unterscheidet sich nur durch einen 2-px-Rahmen und 15 % Vergrösserung.

<details><summary>Beleg</summary>

```
Zeile 6211–6216:
  <div class="theme-swatch active" id="swatch-green"  data-theme="green"  style="background:#1f6b2f;" onclick="applyTheme('green',this)"></div>
  <div class="theme-swatch"        id="swatch-teal"   data-theme="teal"   style="background:#00695c;" onclick="applyTheme('teal',this)"></div>
  … vier weitere, alle leer.

gsTastaturNachruesten (Zeile 6096–6100) rüstet zur Laufzeit nach:
  if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '0');
  if (!ziel.getAttribute('role')) ziel.setAttribute('role', 'button');
Einen NAMEN setzt sie nie. Im Browser gemessen:
  {id:"swatch-green", role:"button", ti:"0",
   aria: aria-label=null aria-pressed=null aria-current=null aria-checked=null title=null,
   text:"", aktiv:true}

Der aktive Zustand steckt ausschliesslich in CSS (Zeile 1614):
  .theme-swatch.active{border-color:var(--text);transform:scale(1.15);}

NICHT gemeldet, weil nachgemessen und in Ordnung: der Fokusrahmen. Mit echten Tab-Anschlägen (nicht .focus()) und 700 ms Wartezeit misst jedes Feld
  outline: 3px solid rgb(31,107,47), box-shadow: rgba(255,255,255,.85) 0 0 0 5px, :focus-visible = true.
Mein erster Lauf las 0px — .theme-swatch hat transition:var(--dur) auf ALLE Eigenschaften, ich hatte mitten in der Überblendung gemessen. Auch die Antippfläche ist mit 32×32 px (28 px + 2 px Rahmen beidseitig) in Ordnung.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — jeder Widerlegungsversuch ist gescheitert.

1) Der zitierte Code existiert wörtlich, die Zeilennummer ist aber verschoben. Im Arbeitsstand steht der Block auf /home/user/GreenScan/index.html:6238–6243 (in HEAD auf 6218–6223); Zeile 6211 ist im Arbeitsstand leer, in HEAD der Kommentar "Schriftgrösse → in den Senioren-Modus integriert (v28.19)". Der Inhalt stimmt jedoch exakt: sechs leere `<div class="theme-swatch" id="swatch-…" data-theme="…" style="background:#…" onclick="applyTheme('…',this)">` ohne jedes Textkind, ohne title, ohne aria-*. Der Versatz ist eine Ungenauigkeit im Befund, kein Gegenbeweis.

2) Keine Stelle behandelt es an anderer Stelle. `grep -n "swatch"` über index.html, scripts/, docs/ und STATUS.md liefert nur sechs Stellen: die zwei CSS-Zeilen (1645/1646), die sechs Markup-Zeilen, `applyTheme` (51351–51355: `classList.remove('active')` / `classList.add('active')`) und die Wiederherstellung beim Aufbau (51496–51500: `s.classList.toggle('active', s.dataset.theme === savedTheme)`). Der Zustand wird also ausschliesslich über eine Klasse geführt; kein aria-pressed/aria-checked/aria-current wird irgendwo gesetzt. Die zentrale Nachrüstung `gsTastaturNachruesten` (75188–75210) setzt nachweislich nur `tabindex` und `role`, nie einen Namen — die einzigen zwei `aria-pressed` der Datei stehen bei den Kommentar-Reaktionen (42220/42222), das Muster ist im Repo also bekannt und hier schlicht nicht angewandt.

3) Im Browser nachgemessen (Playwright, file://, _seed.js, `menuNav('settings')` + `gsSettingsToggleAll()` + erzwungenes `gsTastaturNachruesten()`): `#screen-settings` display=block, keine verborgenen Vorfahren, alle sechs Felder sichtbar (aktives 32×32, übrige 28×28). Je Feld: role="button", tabindex="0", aria-label=null, aria-pressed=null, aria-checked=null, aria-current=null, title=null, textContent="" — und `::before`/`::after` sind beide `none`, es gibt also auch kein CSS-Häkchen als Ersatz. Genau die im Befund behaupteten Werte.

4) Es ist bemerkbar, nicht theoretisch. Durch die Nachrüstung sind die Felder tabbar — ein Tastatur-/Screenreader-Nutzer landet zwangsläufig sechsmal hintereinander auf "Schaltfläche" ohne jede Unterscheidung und ohne Hinweis, welche aktiv ist. Der umgebende `settings-row`-Text ("App-Farbe") ist nicht per aria-labelledby verknüpft und benennt ohnehin nur die Gruppe, nicht die einzelne Farbe. Das übergeordnete `<div style="display:flex…">` (6237) trägt weder role noch Label, ist also auch keine Radiogruppe.

5) Es ist nicht dokumentierte Absicht. Weder Kommentar im Code noch STATUS.md, ROADMAP.md oder docs/ erwähnen die Farbfelder, App-Farbe oder einen bewussten Verzicht.

Warum es bisher keiner der Prüfstände gemeldet hat (und der Befund damit neu ist): scripts/a11y_check.js hat mit Prüfung 2 genau die passende Regel (`document.querySelectorAll('button, [role="button"], a[href]')` → art 'knopf-ohne-namen', Zeilen 95–101), fährt aber nur `TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner']` (Zeile 32) plus drei Fenster ab — **'settings' ist nicht dabei**. Der Einstellungs-Bildschirm ist von diesem Prüfstand also nie vermessen worden.

Einzige Einschränkung meines Ergebnisses: dass der aktive Ton "nur an einem 2-px-Rahmen und 15 % Vergrösserung" erkennbar ist, habe ich als Beschreibung bestätigt (1646: `border-color:var(--text);transform:scale(1.15)`), aber nicht als Kontrastwert nachgemessen — der Rahmen in `var(--text)` gegen die Umgebung ist für Sehende vermutlich brauchbar. Der harte, unbestreitbare Kern bleibt: sechs role="button"-Elemente ohne zugänglichen Namen und ohne maschinenlesbaren Auswahlzustand (WCAG 4.1.2).
```

</details>

### ✅ [40] Die als „sticky" gebaute Einstellungs-Suche klebt nirgends — sie scrollt nach 139 px aus dem Bild und ist auf den restlichen 4'200 px des Bildschirms weg

- **Schwere:** mittel  ·  **Zeile (v32.31):** 1570
- **Folge:** Der Einstellungs-Bildschirm ist 4'342 px hoch und startet mit 8 von 9 zugeklappten Gruppen — die Suche und der ⇕-Knopf („Alle auf/zu") sind der einzige schnelle Weg hinein. Beide sind nach der ersten Wischbewegung verschwunden. Wer weiter unten merkt, dass er etwas sucht, muss erst ganz nach oben zurückscrollen.

<details><summary>Beleg</summary>

```
Zeile 1570:
  #settings-search-wrap{position:sticky;top:0;z-index:6;background:var(--g-bg);…}
und Zeile 6053 mit dem Kommentar darüber: „v28.14 B-004: Live-Suche über alle Einstellungen (sticky)".

Der Kasten liegt in #settings-scroll (Zeile 6051):
  <div id="settings-scroll" style="padding:12px 16px 80px;overflow-y:auto;">
`overflow-y:auto` macht daraus einen eigenen Scrollport — den NÄCHSTEN, gegen den sticky rechnet. Der scrollt aber nie: gemessen scrollHeight = clientHeight (beide 815 bzw. bei aufgeklappten Gruppen wächst der Kasten einfach mit). Gescrollt wird #screen-settings (.screen{overflow-y:scroll}, Zeile 554).

Gemessen bei 412 px, alle Gruppen aufgeklappt (scrollHeight 4342):
  scrollTop 0    -> Oberkante des Suchkastens  139
  scrollTop 300  -> -161
  scrollTop 800  -> -661
  scrollTop 1500 -> -1361
Die Bewegung ist exakt 1:1 zum Scrollweg — Klebewirkung null. Bei 320 px dasselbe (scrollHeight 4809).
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Nicht widerlegbar — der Mechanismus ist im Browser kausal nachgewiesen.

BELEG AM CODE (HEAD = 72965bd, v32.32):
- index.html:1597  #settings-search-wrap{position:sticky;top:0;z-index:6;background:var(--g-bg);padding:2px 0 11px;margin-bottom:2px;}
- index.html:6077  <div id="settings-scroll" style="padding:12px 16px 80px;overflow-y:auto;">
- index.html:6079  <!-- v28.14 B-004: Live-Suche über alle Einstellungen (sticky) -->
- index.html:548-561  .screen{position:absolute; ... overflow-y:scroll;}  (Zeile 554 ist exakt overflow-y:scroll;)

ZEILENNUMMERN-MANGEL (kein Gegenbeweis): die genannten 1570/6051/6053 stammen aus Commit deb491c (v32.30, zwei Commits zurück). Historie der CSS-Zeile: v32.30=1570, v32.31=1579, HEAD=1597. Der zitierte Text ist an HEAD byte-identisch, nur der Versatz stimmt nicht mehr. Die .screen-Angabe (554) ist an HEAD weiterhin exakt.

GEMESSEN (Playwright, file://, scripts/_seed.js als Token; KEINE Datei geändert):
- #settings-scroll scrollHeight === clientHeight — 815/815 (412 px, zugeklappt), 3527/3527 (412 px, alle Gruppen offen), 842/842 bzw. 3876/3876 bei 320 px. Es scrollt nie (scrollTop bleibt 0), ist aber wegen overflow-y:auto der nächste Scrollport.
- #screen-settings scrollt: 3678/700 (412 px) bzw. 4027/700 (320 px).
- Bewegung des Suchkastens relativ zum Bildschirmkasten: 139 -> -161 (bei 300) -> -661 (bei 800) -> -1361 (bei 1500). Exakt die 1:1-Tabelle des Befunds.

KAUSALITÄT (overflow-y nur im Speicher auf visible gesetzt):
  mitAuto : [83, -217, -1117]   (scrollTop 0/300/1200)
  ohneAuto: [83,    0,     0]   -> klebt
Damit ist overflow-y:auto auf #settings-scroll nachweislich die Ursache.

WIDERLEGUNGSVERSUCHE, DIE GESCHEITERT SIND:
- Keine Stelle fasst die Box von #settings-scroll an; die übrigen Vorkommen (16264, 16296, 16312) sind reine getElementById-Nachschlagungen der Gruppen-/Suchlogik.
- Keine Layout-Überschreibung für #screen-settings (die einzige weitere Regel, 84807, setzt nur background). Kein Scroll-Listener, kein Nach-oben-Knopf, keine Suche in der .topbar (2879).
- Nichts in STATUS.md, ROADMAP.md oder docs/ erklärt es zur Absicht; der Quellkommentar sagt ausdrücklich „(sticky)", also das Gegenteil.
- Es wirkt schon im Grundzustand: 9 Gruppen, 8 davon zugeklappt (nachgezählt), Bildschirm 966 px gegen 795 px Sichtfeld — bei scrollTop 200 liegt die Unterkante der Suche bereits bei -33.

EINSCHRÄNKUNG: die behauptete Gesamthöhe „4'342 px" reproduziert nicht (gemessen 3'678 px bei 412 px Breite, 4'027 px bei 320 px). Die Zahl gleicht verdächtig der Artenzahl der App und sollte durch einen gemessenen Wert ersetzt werden. Grössenordnung und alle tragenden Messwerte bleiben davon unberührt.
```

</details>

### ✅ [41] Ein </div> zu früh in der Kopfzeile: Untertitel und Versionsnummer stehen NEBEN dem Titel statt darunter

- **Schwere:** mittel  ·  **Zeile (v32.31):** 6044
- **Folge:** Statt „⚙️ Einstellungen" mit einer Unterzeile darunter steht alles in einer Reihe: Titel, dann rechts daneben klein der Untertitel, dann die Version. Auf schmalen Geräten bricht der Untertitel in drei Stummel um. Die Kopfzeile sieht wie ein Layoutfehler aus — und ist einer.

<details><summary>Beleg</summary>

```
Zeile 6043 öffnet die Kopfzeile als Flex-Reihe und eine Spalte darin:
  <div style="background:var(--hero-bg);…display:flex;align-items:center;gap:12px;…"><button …>&#8249;</button><div style="flex:1;">
Zeile 6044 schliesst BEIDE wieder:
  <div data-i18n="settings_title" …>⚙️ Einstellungen</div></div>
                                                    ^^^^^^ hier endet schon die flex:1-Spalte
Zeile 6045 steht damit ausserhalb:
  <div data-i18n="settings_sub" …>App personalisieren &amp; konfigurieren</div><div id="settings-version" …></div>

Gemessene Kästen (412 px):
  BUTTON              x=16  y=69 44x44
  DIV[settings_title] x=72  y=66 117x47
  DIV[settings_sub]   x=201 y=77 130x28   <- rechts NEBEN dem Titel, nicht darunter
  DIV#settings-version x=343 y=81 53x22
Bei 320 px wird der Untertitel auf 81 px gequetscht und läuft auf 42 px Höhe (drei Zeilen à 12 px).
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
NICHT WIDERLEGT — der Befund ist echt, mit einer Korrektur an der Zeilenangabe.

**1. Zeilennummer stimmt nicht, der zitierte Code schon.**
Zeile 6044 enthält einen Wissen-Tab-Knopf (`showWissen('kompost',this)`), nicht die Kopfzeile. Die tatsächliche Stelle ist `/home/user/GreenScan/index.html:6070–6072` (Abweichung 26–28 Zeilen). Der im Befund zitierte Code ist dort aber WÖRTLICH vorhanden — die Struktur-Aussage ist also korrekt, nur falsch adressiert.

**2. Die Struktur ist so, wie behauptet.**
Zeile 6070 endet mit `…gap:12px;flex-shrink:0;"><button …>&#8249;</button><div style="flex:1;">`
Zeile 6071 endet mit `…>⚙️ Einstellungen</div></div>`  ← das zweite `</div>` schliesst bereits die `flex:1`-Spalte
Zeile 6072 (`settings_sub` + `#settings-version`) und der Titel sind damit GESCHWISTER in derselben Flex-Reihe (`flex-wrap: nowrap`, gemessen).

**3. Gemessen (Playwright, `switchTab('settings')`, Seed korrekt angewandt):**
412 px → BUTTON 16/69 44×44 · Titel 72/66 117×49 · `settings_sub` **201**/77 130×28 · `#settings-version` **343**/81 53×22.
Der Titel endet bei x=189, der Untertitel beginnt bei x=201 — er steht NEBEN dem Titel, nicht darunter. Deckt sich mit dem Befund (nur Titelhöhe 49 statt 47).
320 px → `settings_sub` auf 81×42 gequetscht (drei Zeilen), exakt wie behauptet.

**4. Über den Befund hinaus:** bei 320 px läuft `#settings-version` aus dem Bild — rechte Kante 333 px bei 320 px Breite. Die Versionsnummer ist dort sichtbar abgeschnitten („v32.3…" / „3.9.20…", per Element-Screenshot bestätigt).

**5. Visuell bestätigt** (Screenshot des Kopfzeilen-Elements, beide Breiten): eine Reihe aus Zurück-Knopf, „⚙️ Einstellungen" (Emoji bricht auf eigene Zeile, weil die Spalte nur 117 px breit ist), rechts daneben der zweizeilig umgebrochene Untertitel, dann die Version.

**Widerlegungsversuche, alle gescheitert:**
- *Behandelt es jemand später?* Nein. Der einzige JS-Zugriff ist `index.html:51599–51600` (`vEl2.textContent = …`) — nur Text, kein Umhängen. Kein CSS greift auf die Kopfzeile zu (`#screen-settings` hat unter `index.html:84807` nur `background: var(--g-bg)`; `.settings-header` aus Zeile 1648 wird nirgends verwendet).
- *Absicht?* Keine Begründung in Kommentar, `STATUS.md`, `ROADMAP.md` oder `docs/`. `git blame` zeigt: der Commit f27c07d (v31.31) hat nur Schriftgrössen getauscht, das falsch gesetzte `</div>` ist älter (seit dem Wurzel-Commit e8441f1 der flachen Historie).
- *Hausmuster?* Nein — das Gegenteil. Die Vorlage mit denselben Inline-Stilen steht bei `#screen-map` (`index.html:6885–6889`): dort umschliesst `<div style="flex:1;min-width:0;">` Titel UND Untertitel, gemessen liegen sie übereinander (beide x=72). Settings weicht davon ab.
- *Nur theoretisch?* Nein, gemessen und im Screenshot sichtbar; auf 320 px zusätzlich abgeschnittene Version.

**Zusatzbefund (Ausmass):** dieselbe Fehlstellung des `</div>` haben drei weitere Bildschirme — `#screen-recipes` (index.html:4923–4926, Untertitel bei x=249), `#screen-remedies` (4968–4971, x=247) und `#screen-social` (3976–3979, x=283). Der Befund ist also die Settings-Instanz einer vierfach vorhandenen Fehlstellung; `#screen-map` zeigt die richtige Form.
```

</details>

### ✅ [42] Bei 320 px Breite ragt die Versionsnummer 13 px über den Bildrand und wird von overflow-x:hidden abgeschnitten

- **Schwere:** mittel  ·  **Zeile (v32.31):** 6045
- **Folge:** Auf einem iPhone SE oder älteren Android-Geräten endet die Versionsanzeige mitten im Datum. Genau diese Zeichenkette ist das, wonach man einen Nutzer im Support-Fall fragt („welche Version hast du?") — sie ist dort nicht vollständig ablesbar.

<details><summary>Beleg</summary>

```
Zeile 6045:
  <div id="settings-version" style="font-size:var(--fs-xs);opacity:.6;margin-top:2px;"></div>
(zur Laufzeit gefüllt mit „v32.29 · 3.9.2026")

Gemessen, alle Nachfahren von #screen-settings, position static/relative, in Bildschirmhöhen durchgescrollt:
  vw=320: DIV#settings-version  left=294.1  right=333.0   -> 13 px draussen
  vw=320 + Senioren-Modus: identisch (left=294.1 right=333.0)
  vw=412: nichts ragt heraus
  #screen-settings scrollWidth=333 / clientWidth=320

Abgeschnitten statt scrollbar, weil .screen (Zeile 555) sagt:
  overflow-x:hidden;

Ursache ist derselbe fehlplatzierte </div> wie im Befund davor: die drei Textblöcke liegen als Flex-Geschwister nebeneinander, und #settings-version hat weder flex-shrink noch Umbruch.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Konnte ich nicht widerlegen — mit zwei Korrekturen.

KORREKTUR 1 (Zeilennummer falsch): Das Element steht auf Zeile 6072, nicht 6045. Auf 6045 steht die Wissen-Navigation. Der Befund wurde gegen v32.29 geschrieben, HEAD ist v32.32 (3 Commits weiter: 72965bd/20390df/deb491c) — daher der Versatz von 27 Zeilen. Der zitierte Code stimmt auf 6072 woertlich:
  <div id="settings-version" style="font-size:var(--fs-xs);opacity:.6;margin-top:2px;"></div>
Die ZWEITE Angabe (Zeile 555, overflow-x:hidden in .screen) stimmt exakt.

NACHGEMESSEN (Playwright, _seed.js, gs-preauth entfernt, switchTab('settings')) — die Zahlen reproduzieren auf die Nachkommastelle:
  vw=320: DIV#settings-version left=294.1 right=333.0 w=38.9 -> 13.0 px jenseits
  vw=320 + Senioren-Modus: identisch (294.1/333.0)
  vw=360: right=344.0 < 360 -> passt
  vw=412: right=396.0 < 412 -> passt (Befund sagt korrekt "nichts ragt heraus")
  #screen-settings scrollWidth=333 / clientWidth=320
Kein horizontaler Ausweg: document.scrollWidth == clientWidth == 320, .screen hat overflow-x:hidden (555). Also abgeschnitten, nicht scrollbar — wie behauptet.

Senioren-Modus identisch ist KEIN kaputter Test, sondern richtig: --fs-xs/--fs-sm sind feste px (Z. 98-99), body.senior (Z. 1613-1620) aendert nur --base-font und .settings-*-Klassen — die Hero-Kopfzeile nutzt keine davon.

ZEICHENWEISE + SCREENSHOT (320 px): das zweite "2" von "v32.32" (318.5->324.1) und "026" von "3.9.2026" liegen jenseits 320. Sichtbar bleibt "v32.3" / "3.9.20" — die Versionsnummer ist genau dort mehrdeutig, wo es fuer den Support zaehlt.

URSACHE zur Laufzeit bestaetigt: die Kopfzeile hat exakt VIER Flex-Kinder — BUTTON(44) | DIV flex:1 mit NUR dem Titel(116.7) | DIV Untertitel(81.4) | DIV#settings-version(38.9). Das </div> schliesst flex:1 direkt nach dem Titel. Dieselbe Vorlage steht auch auf Z. 3937 (Saisonkalender) und 4923 (Rezepte) — wiederkehrender Vorlagenfehler.

DISPROOF-VERSUCHE, alle gescheitert:
- Media Query? Keine max-width-Regel trifft die Kopfzeile; die einzige (Z. 5759) gilt #pp-stepbar.
- Schon von einem Pruefstand gemeldet? Nein. touch_check.js:28/100 fragt nur button,a[href],[onclick],[role="button"],input,select,textarea — ein reines <div> faellt raus. STATUS.md:111 ("412 und 320 px — 0/0") sagt darueber also nichts. render_checks Abschneide-Regel ist VERTIKAL (scrollHeight>clientHeight).
- Absicht/dokumentiert? Nichts in STATUS.md/ROADMAP.md/Kommentar. Umgekehrt: 320 px ist laut CLAUDE.md §7.1 und STATUS.md:563-566 ausdruecklich eine unterstuetzte Breite ("iPhone SE, aeltere Android-Geraete").
- Nur ein Artefakt fehlender Webfonts? Das war der staerkste Einwand: die Fonts kommen von Google Fonts (Z. 79) und waren in meinem Lauf blockiert. Gegenprobe mit sechs Stacks: Ueberstand bleibt IMMER (+0.3 px Liberation Serif bis +70.8 px DejaVu Serif; Basiswert +13). Robust gegen Font-Substitution — und offline (Kernanwendungsfall der PWA im Wald) laedt der Webfont ohnehin nie.

EINSCHRAENKUNG, ehrlich: die FOLGE ist milder als beschrieben. #about-version (Z. 6677) zeigt "Version v32.32 · 2026" vollstaendig auf DEMSELBEN Bildschirm; #modal-about-ver (Z. 7285) im Ueber-Fenster ebenso. Allerdings liegt die Karte in .settings-card.gs-acc-hide (display:none, Akkordeon zu) — sie kostet einen Tipp und nennt nur das Jahr, nicht das Datum. Das entkraeftet den Befund nicht, nur seine Dringlichkeit.
```

</details>

### ✅ [43] Knopf „🔔 Aktiv": weisse Schrift auf --g-main — im Dunkelmodus 2,36:1 statt der geforderten 4,5:1

- **Schwere:** mittel  ·  **Zeile (v32.31):** 6307
- **Folge:** Wer den Nachtmodus benutzt und Smart-Push einschaltet, sieht die Beschriftung des Knopfes, mit dem er die Urlaubs-Pause wieder aufhebt, praktisch nicht — hellgrüne Fläche mit weisser Schrift darauf. Der Knopf sieht leer aus.

<details><summary>Beleg</summary>

```
Zeile 6307:
  <button onclick="gsPushPause(0)" style="flex:1;min-width:64px;padding:8px;background:var(--g-main,#43a047);border:none;…color:#fff;…">🔔 Aktiv</button>

--g-main kippt (Zeile 86 hell / Zeile 240 dunkel):
  hell   --g-main:#1f6b2f  -> Weiss darauf = 6,56:1  (bestanden)
  dunkel --g-main:#66bb6a  -> Weiss darauf = 2,36:1  (durchgefallen)

Pixelgenau gemessen (Screenshot mit *{color:transparent}, Median unter der Textstelle):
  2.36:1 (Soll 4.5)  BUTTON "🔔 Aktiv"
      fg=rgb(255,255,255) bg=rgb(102,187,106) fs=12 fw=700

Das ist genau die in CLAUDE.md §7.1 benannte Regel: „FLAECHE aus --g-main / --g-dark / --c-success mit weisser Schrift → Fuellungen nehmen --fill-brand". --fill-brand ist hell #1f6b2f und dunkel #2b7530 und trägt Weiss in beiden Modi.

Warum es bisher niemand gesehen hat: der Kasten #push-detail-settings startet auf display:none (Zeile 6270) und wird erst von gsTogglePushMaster (Zeile 6270 ff. / 81531: `if (detail) detail.style.display = '';`) eingeblendet. contrast_check misst nur die elf Tabs und die Fenster mit parameterlosem openModal-Öffner — #screen-settings ist keines von beidem.
```

</details>

<details><summary>Gegenprüfung (Widerlegungsversuch gescheitert)</summary>

```
Konnte ich nicht widerlegen — der Kern haelt jeder Gegenprobe stand.

EINE KORREKTUR: Der Knopf steht auf Zeile 6334, nicht 6307 (27 Zeilen daneben). Der zitierte Code ist aber woertlich richtig und im File eindeutig: <button onclick="gsPushPause(0)" style="…background:var(--g-main,#43a047);border:none;…color:#fff;…">🔔 Aktiv</button>

KONTRAST BESTAETIGT: --g-main ist hell #1f6b2f (Z. 86), dunkel #66bb6a (Z. 240) → 6,56:1 hell / 2,36:1 dunkel, bei 12px/700 (kein Grosstext, also gilt 4,5:1). Kein !important und kein JS ueberschreibt den Knopf; der Inline-Style gewinnt. gsPushPause (Z. 81699) veraendert keine Farbe.

SICHTBARKEIT — hier waere ich beinahe falsch abgebogen: Meine ersten beiden Laeufe massen 0x0, der dritte fotografierte die Onboarding-Ueberlagerung. Ursache: scripts/_seed.js setzt now = 1756684800000 (Sept 2025), gs_sb_expires liegt damit ueber ein Jahr in der Vergangenheit, die App meldet ab. Mit frischem Token + gs_onboarding_done und ueber die app-eigenen Funktionen (applyDarkMode → gsOpenSettings → gsSettingsToggleAll → gsTogglePushMaster, nur die Push-Berechtigung gestellt): 80x32 px, elementFromPoint in der Mitte liefert den Knopf SELBST, Onboarding display:none. Screenshots zeigen hell eine lesbare dunkelgruene Pille, dunkel eine ausgewaschene hellgruene.

ABSICHT: Das Gegenteil. STATUS.md v31.26 erklaert genau dieses Muster zum Fehler und fuehrt die Zeile "--g-main | 125 | 6,56:1 | 2,36:1" — dieselben Zahlen — mit dem Verify "146 Flaechen umgestellt, 0 verbleibend (die eine Ausnahme ist .gs-btn-info)".

ES IST EINE KLASSE, KEIN EINZELFALL: Der Sweep suchte var(--g-main) und uebersah die Fallback-Form var(--g-main,#…). Fuenf solche Fuellungen mit color:#fff ueberleben: Zeilen 6334, 17665, 33665, 77622, 80780 — dazu .gs-gl-chip.active auf 84906 (var(--g-main) ohne Fallback), die NICHT die dokumentierte .gs-btn-info-Ausnahme ist. Also genau der Fehlertyp, den derselbe STATUS-Eintrag an sich selbst beschreibt ("mein Suchfenster schloss das Semikolon aus"). Die Behauptung "0 verbleibend" stimmt nicht.

WARUM ES KEIN PRUEFSTAND MELDET: contrast_check.js TABS (Z. 29) enthaelt kein 'settings'; die Auto-Erkennung nimmt nur Oeffner ohne Parameter mit openModal( im Rumpf — #screen-settings ist ein Bildschirm, kein Fenster, und #push-detail-settings startet auf display:none (Z. 6297).

EINE UEBERTREIBUNG IM BEFUND: "sieht leer aus" / "praktisch nicht" ist zu stark — im Screenshot ist die Beschriftung ausgewaschen, aber lesbar. Der AA-Verstoss ist echt, die Schwere-Formulierung nicht.
```

</details>

### ⚪ [44] --accent ist in der ganzen Datei nie definiert; „12 h" fällt deshalb immer auf das feste #2e7d32 zurück und steht im Dunkelmodus mit 2,44:1 auf --surface2

- **Schwere:** mittel  ·  **Zeile (v32.31):** 6284
- **Folge:** Im Nachtmodus ist die Zahl neben „🌦️ Wetter-Vorlauf" — der einzige Ort, der zeigt, auf wie viele Stunden der Regler steht — dunkelgrün auf dunkelgrün. Man schiebt und sieht nicht, wohin.

<details><summary>Beleg</summary>

```
Zeile 6284:
  <span id="push-lead-display" style="color:var(--accent,#2e7d32);">12 h</span>
Zeile 6285 (derselbe Fehlgriff am Regler):
  … accent-color:var(--accent,#2e7d32);
Zeile 6306:
  <button id="push-test-btn" … style="…background:var(--accent,#2e7d32);color:#fff;…">📨 Test-Push senden</button>

Beleg, dass das Merkmal nicht existiert:
  $ grep -n -- "--accent *:" index.html
  (keine Ausgabe)
Weder :root (Zeile 81) noch body.dark (Zeile 239) kennen es. Der Rückfallwert #2e7d32 ist damit KEIN Rückfall, sondern der Dauerwert — und er kippt nie mit dem Thema.

Pixelgenau gemessen:
  2.44:1 (Soll 4.5)  SPAN#push-lead-display "12 h"
      fg=rgb(46,125,50) bg=rgb(30,58,30) fs=12 fw=700
bg rgb(30,58,30) ist --surface2 im Dunkelmodus (#1e3a1e, Zeile 242).
Nachgerechnet nach WCAG: L(#2e7d32)=0,1548 · L(#1e3a1e)=0,0339 -> (0,2048)/(0,0839) = 2,44.
Hell ist dieselbe Stelle in Ordnung (#2e7d32 auf #f7f4ee).
Der Knopf „📨 Test-Push senden" bleibt mit 5,13:1 in beiden Modi bestanden — dort ist #2e7d32 Fläche, nicht Schrift.
```

</details>

### ⚪ [45] Die E-Mail-Adresse im Impressum löst beim Antippen ZWEI Dinge gleichzeitig aus und ist nur 103,6×14 px gross

- **Schwere:** mittel  ·  **Zeile (v32.31):** 6638
- **Folge:** Wer die Adresse antippt, um sie zu kopieren oder eine Mail zu schreiben, bekommt zusätzlich das Impressum-Fenster über den gerade startenden Mail-Entwurf gelegt. Und bei 14 px Höhe trifft man sie ohnehin selten beim ersten Versuch.

<details><summary>Beleg</summary>

```
Zeile 6638 — der Link liegt in einer Zeile, die selbst ein onclick trägt (Zeile 6636):
  <div class="settings-row" onclick="openLegalModal('impressum')" style="cursor:pointer;">
    …
    <div class="settings-label-sub"><span …>Kontakt</span> · <a href="mailto:info@greenscan.ch" style="color:inherit;text-decoration:underline;">info@greenscan.ch</a></div>

Echter Mausklick genau auf die Adresse, im Browser gemessen:
  Trefferflaeche der Mail-Adresse: 103.6x14.0
  nach dem Klick: {"offeneFenster":["modal-rechtlich"], "defaultVerhindert":false}
Also: das Impressum-Fenster geht auf UND die mailto-Navigation wird nicht unterdrückt — beides läuft. Kein stopPropagation, kein preventDefault.

Höhe 14 px liegt unter den 24 px aus WCAG 2.5.8; bei 320 px bleibt die Breite gleich (103,6 px), die Höhe ebenfalls 14 px.

NICHT gemeldet, weil nachgemessen und in Ordnung: die neun Push-Kategorie-Kästchen sind zwar 18×18 px, ihr umschliessendes <label> misst aber 342×30 px — das ist die Fläche, die den Zeiger annimmt. Ebenso ist DIV.settings-label-title[role=button] „Impressum" (279×16 px) nur ein TASTATUR-Ziel aus der Nachrüstung; angetippt wird die ganze Zeile.
```

</details>

### ⚪ [46] Der Regler „Wetter-Vorlauf" ist 342×16 px — 16 px hoch statt der geforderten 24

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 6285
- **Folge:** Auf dem Telefon muss man ein 16 px hohes Band treffen, um die Vorwarnzeit für Frost und Sturm einzustellen. Daneben getippt heisst: nichts passiert, oder der Wert springt.

<details><summary>Beleg</summary>

```
Zeile 6285:
  <input type="range" id="push-lead-hours" min="2" max="48" step="2" value="12" oninput="…" onchange="gsSavePushSettings({leadHours:parseInt(this.value)})" style="width:100%;cursor:pointer;accent-color:var(--accent,#2e7d32);">

Gemessen:
  412 px Breite: 342x16   (kein umschliessendes <label>, also ist das die ganze Trefferfläche)
  320 px Breite: 250x16
WCAG 2.5.8 verlangt 24×24 px; keine der Ausnahmen (inline, essenziell, gleichwertige Alternative) greift — es gibt keinen zweiten Weg, den Vorlauf zu setzen.

Zum Vergleich derselbe Bildschirm, gleiche Messung: #push-quiet-start 79×33, #settings-acc-all 38×30, #pref-units 107×31, #i18n-lang-picker 128×37, .settings-toggle 44×26 — alle darüber. Der Regler ist der einzige Ausreisser.
```

</details>

### ⚪ [47] Die Versionszeile im Kopfbereich steht im Hellmodus bei 3,19:1 — Deckkraft auf TEXT senkt den Kontrast blind

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 6045
- **Folge:** Die Versionsnummer ist auf dem grünen Kopfbereich schwer zu lesen — genau die Angabe, die man im Support-Fall abliest.

<details><summary>Beleg</summary>

```
Zeile 6045:
  <div id="settings-version" style="font-size:var(--fs-xs);opacity:.6;margin-top:2px;"></div>
Die Farbe erbt #fff aus der Kopfzeile (Zeile 6043: color:#fff), der Grund ist --hero-bg.

Pixelgenau gemessen (Deckkraft in die Vordergrundfarbe eingerechnet):
  3.19:1 (Soll 4.5)  DIV#settings-version "v32.29 · 3.9.2026"
      fg=rgb(170,199,171) bg=rgb(43,115,46) fs=10 fw=400
Im Dunkelmodus bestanden — dort ist --hero-bg dunkler (linear-gradient(135deg,#0a1f0a,#1a3d1a), Zeile 279).

Der Nachbar in derselben Zeile mit opacity:.78 (data-i18n="settings_sub") bleibt über der Schwelle; erst .6 bei 10 px Schriftgrösse kippt.

Das ist die vierte Ursache aus der Tabelle in CLAUDE.md §7.1: „opacity auf TEXT … senkt den Kontrast BLIND — sie fragt nicht, worauf der Text steht."

Messumfang: 145 Textstellen je Modus (mit eingeblendetem #push-detail-settings und den Admin-Zeilen), im Auslieferzustand 102. Dies ist der einzige Fund im Hellmodus.
```

</details>

### ⚪ [48] Drei Flächen im Einstellungs-Bildschirm kippen nicht mit dem Thema und leuchten im Dunkelmodus als helle Blöcke

- **Schwere:** niedrig  ·  **Zeile (v32.31):** 6615
- **Folge:** Im Nachtmodus blitzt mitten in den dunklen Karten ein helllila Kasten auf, und die Kachel neben „KI-Nutzung & Kosten" ist ein greller Cyan-Fleck. Umgekehrt ist die Kachel neben „Nachtmodus" im Hellmodus die einzige fast schwarze unter lauter Pastelltönen. Beides liest sich als Fehler, nicht als Absicht.

<details><summary>Beleg</summary>

```
Zeile 6615 (Rechtliches-Banner):
  <div style="background:linear-gradient(135deg,#f3e5f5,#e8eaf6);border-radius:var(--r-md);padding:10px 13px;font-size:var(--fs-sm);color:#4a148c;font-weight:600;…">
Zeile 6192 (Symbolkachel Nachtmodus):
  <div class="settings-icon" style="background:#1a2e1a;">🌙</div>
Zeile 6375 (Symbolkachel KI-Nutzung, Admin):
  <div class="settings-icon" style="background:#e0f7fa;">📊</div>

Im Browser in beiden Modi ausgelesen — identisch, also fest:
  HELL   Banner: linear-gradient(135deg, rgb(243,229,245), rgb(232,234,246))  color rgb(74,20,140)
  DUNKEL Banner: linear-gradient(135deg, rgb(243,229,245), rgb(232,234,246))  color rgb(74,20,140)
  HELL/DUNKEL  .settings-icon 🌙: rgb(26,46,26)   ·  📊: rgb(224,247,250)
Zum Vergleich die Nachbarkachel mit Merkmal: background:var(--bg-info-soft,#e3f2fd) wechselt korrekt von rgb(227,242,253) nach rgba(66,165,245,0.12).

Relative Leuchtdichte gerechnet: das Banner liegt in BEIDEN Modi bei L≈0,82, die Seite darum fällt von L=1,00 (hell) auf L=0,032 (--fill-dark #16391f). Das Banner ist im Dunkelmodus also rund 10,6-mal heller als alles um es herum.

Der Text im Banner selbst ist mit 9,80:1 (#4a148c auf ≈rgb(237,231,245)) NICHT das Problem — deshalb hat ihn auch die Kontrastmessung nicht gemeldet. Es ist ein Kipp-Fehler, kein Lesbarkeitsfehler.
```

</details>

## Was als Nächstes

Die offenen bestätigten Meldungen (🔴) werden nach Schwere abgearbeitet; jede
Reparatur bekommt eine Frage in `scripts/einstellungen_check.js`, und jede
Frage eine Gegenprobe. Die 13 ohne Urteil (⚪) brauchen zuerst eine eigene
Messung.
