# Audit des Einstellungs-Bildschirms (v32.33)

> Erhoben am 03.09.2026 aus **sechs Blickwinkeln**. Jede Meldung wurde
> anschliessend von einem **gegnerischen** Durchgang angegriffen, der sie
> widerlegen sollte — nicht bestätigen. Was hier als *bestätigt* steht, hat
> diesen Angriff überstanden.

**48 Meldungen · 31 angegriffen · 20 bestätigt · 11 widerlegt · 17 ohne Urteil.**

Die Zeilennummern stammen aus dem Stand v32.31 und sind seither verschoben —
sie sind ein Anhaltspunkt, kein Fundort. Der zitierte Code stimmt.

| Zeichen | Bedeutung |
|---|---|
| ✅ | behoben |
| 🔴 | bestätigt, offen |
| ⚪ | noch nicht angegriffen |
| ❌ | widerlegt — **nicht** anfassen ohne neue Messung |

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

### 🔴 [24] Inhalt einer Karte, der nicht in einer `.settings-row` steht, wird von der Suche NIE ausgeblendet — er bleibt bei jedem Suchbegriff stehen.

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

### 🔴 [25] 18 Bedienelemente im Smart-Push-Panel liegen ausserhalb jeder `.settings-row` und sind damit ueberhaupt nicht auffindbar.

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

### 🔴 [26] `#settings-search-none` („Keine Einstellung gefunden.") erscheint gleichzeitig mit sichtbaren Einstellungen — die Meldung widerspricht dem Bildschirm.

- **Schwere:** mittel  ·  **Zeile (v32.31):** 16261
- **Folge:** Suche „zzz-gibtsnicht" ohne Push: Meldung sichtbar, darunter 457 px Inhalt. innerText des Scrollbereichs: „🔍 ⇕ Keine Einstellung gefunden. 🌿 GreenScan Version v32.29 · 2026 4'337 Arten in DB 🇨🇭 Schweiz Focus Die #1 Natur-App der Schweiz. …". Mit aktiviertem Push: 1162 px, Text beginnt „Keine Einstellung gefunden. Welche Benachrichtigungen? 🥶 Frostgefahr 🥵 Hitzewarnung 🌪️ Sturm / Starkregen …". Der Nutzer liest „nichts gefunden" und sieht darunter neun Schalter.

<details><summary>Beleg</summary>

```
  if (none) none.style.display = anyGroup ? 'none' : 'block';

`anyGroup` wird ausschliesslich aus `.settings-row`-Treffern (16249) bzw. Gruppentitel-Treffern gesetzt. Der Nicht-Zeilen-Inhalt aus Befund 1 geht in diese Rechnung nicht ein, wird aber auch nicht ausgeblendet.
```

</details>

### 🔴 [27] Leere Karten-Huellen bleiben als duenne Striche stehen: 7 Karten a 2 px pro Suche.

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

### 🔴 [28] Der Gruppentitel behaelt im Suchmodus `gs-collapsed` und `aria-expanded="false"`, obwohl die Suche den Abschnitt aufklappt.

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

### 🔴 [38] 22 von 77 Bedienelementen auf #screen-settings haben keinen zugänglichen Namen — darunter ALLE 11 Kippschalter, alle 4 Auswahlfelder, die 6 Farbfelder und der Regler

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

### 🔴 [39] Die sechs Farbfelder sagen zusätzlich nicht, WELCHES gewählt ist — der aktive Ton ist nur an einem Rahmen erkennbar, es gibt kein aria-pressed/aria-checked

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

### ⚪ [40] Die als „sticky" gebaute Einstellungs-Suche klebt nirgends — sie scrollt nach 139 px aus dem Bild und ist auf den restlichen 4'200 px des Bildschirms weg

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

### ⚪ [41] Ein </div> zu früh in der Kopfzeile: Untertitel und Versionsnummer stehen NEBEN dem Titel statt darunter

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

### ⚪ [42] Bei 320 px Breite ragt die Versionsnummer 13 px über den Bildrand und wird von overflow-x:hidden abgeschnitten

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

### ⚪ [43] Knopf „🔔 Aktiv": weisse Schrift auf --g-main — im Dunkelmodus 2,36:1 statt der geforderten 4,5:1

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

Die 17 offenen bestätigten Meldungen werden nach Schwere abgearbeitet. Die
17 ohne Urteil (⚪) brauchen zuerst eine eigene Messung — **ein Treffer ist
ein Verdacht, kein Urteil**, und elf der 31 angegriffenen Meldungen sind
genau daran gescheitert.
