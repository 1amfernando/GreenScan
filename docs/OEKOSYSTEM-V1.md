# Ökosystem V1 — Geräte, Messwerte, Dashboard: der Entwurf

> Geschrieben am 03.09.2026 (Seros), Stand v32.44. Anlass sind Fernandos
> Sätze: *„Bringe Ideen, die auch mit den zukünftigen Sensoren eine Rolle
> spielen könnten. Es soll perfekt alles vorbereitet werden, damit die
> Sensoren dann auf Anhieb funktionieren. Es soll eine Dashboard-Seite
> geben … so intelligent aufgebaut, dass weitere Systeme gekoppelt werden
> können. Später wird es ein grosses Ökosystem geben mit Geräten von
> GreenScan, und die App muss für alles das schon vorbereitet werden."*
>
> Dieses Dokument ist die Vorlage, nach der gebaut wird — wie
> `PLANER-V3.md` und `SCANNER-V3.md`. Es sagt, **was** ein Gerät für die
> App ist, **wie** ein Messwert hereinkommt, **wo** er landet, **wer** ihn
> sehen darf, und **welche Regeln** dabei nie gebrochen werden. Was hier
> steht, gilt auch für Geräte, die es noch nicht gibt — das ist der Zweck.

## 0 · Die eine Regel

> **Ein Gerät ist ein Datensatz, kein Sonderfall.** Eine neue Sensorart ist
> eine Zeile im Messgrössen-Katalog, kein neuer Code. Ein neues Gerät ist
> eine Zeile im Geräte-Register, kein neuer Bildschirm.

Alles andere folgt daraus. Wer beim Bauen vor der Wahl steht, „für den
Bodenfeuchte-Sensor eine Sonderbehandlung" zu schreiben, hat die Regel
verletzt — und der zweite Sensor bringt den Fehler wieder mit.

Und die Regel, die im ganzen Repo gilt, gilt hier besonders: **eine Zahl
ohne ihre Grundlage ist eine Behauptung.** Jeder Messwert trägt Gerät,
Zeitpunkt, Einheit und Qualität. Eine Anzeige, die „Bodenfeuchte 32 %"
sagt, kann sagen, von welchem Gerät, wann, und ob der Wert plausibel war.

## 1 · Was heute existiert

Gemessen am 03.09.2026 (Grep über `index.html`, `supabase/`, `docs/`,
`ROADMAP.md`; Supabase lesend):

| Was | Stand |
|---|---|
| Tabellen für Geräte oder Messwerte | ~~**keine**~~ — **falsch, korrigiert 04.09.2026 (§11.0):** live existieren `sensor_devices` · `sensor_readings` · `sensor_alerts` (`backend-inventar.json` Z. 131–133; STATUS v30.96: „sensor_devices = 1, sensor_readings = 0"), ohne Migration im Repo. Dazu eine BLE-Schicht (`_gsDev`, v23.52, Xiaomi Flower Care) und ein ESP32-Assistent, der das **Sitzungs-Token** in die Firmware kopieren lässt. Das Schema dieses Entwurfs ist damit das **zweite** — Idee 1 in §11 führt beide zusammen |
| Edge-Function für Messwerte | **keine** (ein `ingest_sensor_reading`-RPC steht nur in einer Release-Notiz, nicht im Live-Inventar) |
| Diagramm-Routine im Frontend | **keine** (kein Chart-Paket; Three.js und Leaflet werden nur bei Bedarf geladen) |
| Schwellwerte in den Artendaten | `care` / `lightMin` / `lightOptimal` / `lightMax` / `waterFrequency` bei **40 von 4'342** Arten |
| Web-Bluetooth / Web-Serial / WebUSB in der `Permissions-Policy` | `_headers` Z. 9: `usb=()` ist **gesperrt**, `bluetooth` und `serial` sind **nicht genannt** (gelten damit als `self`). Für Stufe 2 wird `usb` bewusst freigegeben oder bewusst gesperrt gelassen — mit Begründung in `_headers`, wie bei `camera=(self)` |
| Andockstellen, die es schon gibt | `gsCloudSync`/`markDirty` (Sync), RLS-own-only-Muster in den Migrationen, `GS_NOTIF_ZIELE` (31 Benachrichtigungsarten mit Ziel), der tägliche Cron (`daily-push`), die IndexedDB-Ablagen (`STORES`), `_gsAufFarbe` (Kontrast für Farben aus Daten) — und seit v32.46 die Ereignis-Schicht `gsKalenderEreignisse` (`KALENDER-V1.md`), in der die Arten `messung` und `alarm` schon vorgesehen sind |

~~Es existiert also **nichts** für Geräte~~ — **das war die falsche
Schlussfolgerung aus einem unvollständigen Grep** (der Prüfer vom 04.09.
hat es an sechs Stellen belegt, §11.0). Was stimmt: nichts davon ist mit dem
Kalender, dem Katalog oder den Prüfständen verdrahtet, und die Konventionen
des Repos (Sync, RLS, Benachrichtigungen, Prüfstände) tragen den Entwurf.
Der Preis des Irrtums: **Idee 1 (§11) ist keine Idee, sondern die
Voraussetzung** — zwei Geräteschichten sind „zwei Speicher für dieselbe
Frage".

## 2 · Das Modell — fünf Tabellen, keine mehr

```
metric_catalog        was gemessen werden KANN      öffentlich lesbar, nur Admin schreibt
devices               welche Geräte es gibt         own-only
device_readings       die Messwerte                 own-only, nur anhängen
device_rules          Schwellwerte je Gerät/Grösse  own-only
device_commands       Befehle an Aktoren (später)   own-only
```

### 2.1 · `metric_catalog` — der Katalog der Messgrössen

| Spalte | Beispiel | Warum |
|---|---|---|
| `key` (PK) | `soil_moisture` | stabiler Schlüssel, nie umbenennen |
| `unit` | `%` | eine Einheit je Grösse — umrechnen tut der Absender |
| `min_valid`, `max_valid` | 0, 100 | ausserhalb → `quality = 0`, nie verworfen |
| `label_de/fr/it/en` | Bodenfeuchte | i18n-Regel: ein Schlüssel, ein deutscher Text |
| `icon` | 💧 | |
| `aggregation` | `avg` / `sum` / `last` / `min` / `max` | wie Tageswerte gebildet werden (Regen: `sum`; Temperatur: `avg`; Batterie: `last`) |
| `decimals` | 0 | Anzeige |
| `sort` | 10 | Reihenfolge im Dashboard |

**Startbestand (Stufe 0):** `soil_moisture` (%), `soil_temp` (°C),
`air_temp` (°C), `air_humidity` (%), `light` (lux), `rain` (mm),
`battery` (%), `water_level` (%), `ec` (mS/cm), `ph` (pH),
`tank_temp` (°C). Das sind Messgrössen, keine Botanik — Einheit und
Gültigkeitsbereich sind physikalisch, nicht artspezifisch.

**Warum eine Tabelle und keine Konstante im Code:** damit ein neuer Sensor
eine Zeile ist. Der Client lädt den Katalog einmal, hält ihn im Speicher
(`gs_metric_catalog`, bleibt beim Abmelden — er ist öffentlich) und rendert
daraus. Kein `if (metric === 'soil_moisture')` irgendwo im Frontend.

### 2.2 · `devices` — das Register

| Spalte | Beispiel | Warum |
|---|---|---|
| `id` uuid | | |
| `user_id` | | RLS own-only |
| `kind` | `gs_soil_v1` / `manual` / `third_party` | Gerätetyp; `manual` ist die Person selbst (§4) |
| `name` | „Hochbeet Nord" | vom Nutzer |
| `garden_id`, `plant_id`, `bed_id` | | wo es steckt — **optional**, nie erfunden |
| `capabilities` jsonb | `{"metrics":["soil_moisture","soil_temp","battery"],"interval_s":1800,"commands":[]}` | was es kann — vom Gerät gemeldet, nicht vom Code angenommen |
| `firmware` | `1.2.0` | |
| `schema_version` | 1 | Vertrag zwischen Gerät und Server (§3) |
| `status` | `active` / `paused` / `lost` | `lost` = seit 3 Intervallen nichts — vom Cron gesetzt |
| `last_seen_at` | | |
| `token_hash` | | Gerätegeheimnis, **gehasht**; das Klartext-Token sieht nur das Gerät (§3.2) |
| `paired_at` | | |

### 2.3 · `device_readings` — die Messwerte

| Spalte | Warum |
|---|---|
| `device_id`, `user_id` | `user_id` denormalisiert, damit RLS ohne Join prüft |
| `metric` → `metric_catalog.key` | |
| `ts` timestamptz | **Zeit des Geräts**, nicht des Servers — der Server setzt `received_at` daneben |
| `value` numeric | |
| `quality` smallint | 2 = plausibel · 1 = ausserhalb des Gültigkeitsbereichs · 0 = Gerät meldete Fehler. **Nie verwerfen** — ein Sensor, der 250 % Feuchte meldet, ist eine Information (er ist kaputt). |
| `raw` jsonb | was das Gerät sonst schickte — für spätere Auswertung |
| PK `(device_id, metric, ts)` | **Idempotenz**: ein Gerät, das nach Funkloch alles nochmal schickt, erzeugt keine Dubletten |

**Nur anhängen.** Kein UPDATE, kein DELETE durch die App — nur durch die
Kontolöschung (revDSG). Aufbewahrung: Rohwerte 400 Tage, Tagesaggregate
(§5) ~~unbegrenzt~~ — **das hält das Schema nicht** (gefunden 04.09.2026):
`v_device_daily` ist eine **View über `device_readings`**, und
`fn_device_readings_prune` löscht die Rohwerte nach 400 Tagen — das Aggregat
verschwindet mit. Eine Tabelle `device_daily`, vom Cron **vor** dem Prune
gefüllt, ist Idee 17 in §11. Eine spätere Partitionierung nach Monat ist
vorbereitet, weil `ts` im Primärschlüssel steht.

### 2.4 · `device_rules` — Schwellwerte

| Spalte | Beispiel |
|---|---|
| `device_id`, `metric` | |
| `op` | `below` / `above` / `stale` |
| `threshold` | 25 |
| `for_minutes` | 120 — erst nach zwei Stunden unter der Schwelle, nicht bei jedem Ausreisser |
| `action` | `notify` / `task:water` / `calendar` |
| `cooldown_minutes` | 720 — nicht alle 30 Minuten dieselbe Meldung |
| `last_fired_at` | |

`stale` ist die Regel, die jedes Gerät bekommt, ohne dass jemand sie
anlegt: „seit 3 × `interval_s` nichts gehört" → Status `lost` und eine
Meldung. **Ein Sensor, der schweigt, sieht aus wie ein Garten, dem es gut
geht.** Das ist die gefährlichste Stille, und sie wird als Erstes abgedeckt.

### 2.5 · `device_commands` — für später, aber jetzt im Schema

Ventil auf, Licht an, Pumpe 30 Sekunden: `(device_id, command, params,
status: pending/sent/acked/failed, created_at, acked_at)`. Das Gerät holt
sich offene Befehle beim nächsten Kontakt ab (§3.3). Die Tabelle existiert
in Stufe 0 bereits, damit ein Gerät mit `capabilities.commands = ["valve"]`
am Tag seines Erscheinens funktioniert — nicht damit jetzt Ventile gebaut
werden.

## 3 · Der Weg eines Messwerts

### 3.1 · Ankunft — Edge-Function `device-ingest`

```
POST /functions/v1/device-ingest
Authorization: Bearer <geräte-token>          ← NICHT der Nutzer-JWT
Content-Type: application/json

{ "schema_version": 1,
  "device_id": "…",
  "readings": [
    { "metric": "soil_moisture", "ts": "2026-09-03T14:00:00Z", "value": 31.5 },
    { "metric": "soil_temp",     "ts": "2026-09-03T14:00:00Z", "value": 18.2 },
    { "metric": "battery",       "ts": "2026-09-03T14:00:00Z", "value": 87 } ] }
```

Der Server:

1. hasht das Token, sucht das Gerät, prüft `status != 'paused'`;
2. lehnt `schema_version` ab, die er nicht kennt — mit Nummer in der Antwort;
3. prüft jeden Wert gegen `metric_catalog` (unbekannte Grösse → 400 mit
   dem Schlüssel; ausserhalb `min/max` → `quality = 1`, **angenommen**);
4. schreibt mit `ON CONFLICT DO NOTHING` (Idempotenz);
5. setzt `last_seen_at`, `status = 'active'`;
6. antwortet `{ "accepted": n, "rejected": [...], "commands": [...] }` —
   die offenen Befehle reisen in der Antwort mit (§3.3), damit ein Gerät
   mit einem einzigen Aufruf senden UND empfangen kann. Ein Batterie-Gerät
   wacht auf, redet einmal, schläft.

`verify_jwt = false` für diese Funktion — das Gerät hat kein Nutzerkonto.
Die Sicherheit ist das Geräte-Token (§3.2), und der Ingest schreibt mit
der Service-Rolle **nur** in `device_readings` für das Gerät, dem das
Token gehört. Rate-Limit je Gerät: `interval_s / 2` als kürzester Abstand;
schneller heisst Fehler im Gerät, nicht mehr Daten.

### 3.2 · Pairing — wie ein Gerät zu einem Konto kommt

1. Die App legt das Gerät an (`devices`-Zeile mit `kind`, `name`) und
   erzeugt ein Token (32 Byte, zufällig). **Nur der Hash wird gespeichert.**
2. Das Klartext-Token wird dem Gerät übergeben — als QR-Code auf dem
   Bildschirm (das Gerät hat eine Kamera oder die App tippt es per BLE
   hinüber, Stufe 2) oder als Konfiguration beim Einrichten.
3. Das Gerät schickt seinen ersten Batch. Erst dann steht `paired_at`.
   Vorher zeigt die App „wartet auf erstes Signal" — **nie** „verbunden",
   solange kein Messwert da war.
4. Token verloren? Neues erzeugen, altes ist damit ungültig. Kein
   Zurücksetzen, kein Wiederherstellen — dieselbe Regel wie bei API-Keys.

### 3.3 · Zurück zum Gerät

Offene `device_commands` gehen in der Ingest-Antwort mit. Das Gerät
bestätigt beim nächsten Kontakt (`acked`). Ein Befehl, der nach 3 Kontakten
nicht bestätigt ist, wird `failed` — und die Person sieht es. **Ein Befehl
ohne Bestätigung ist ein Wunsch, keine Handlung**; die App zeigt den
Unterschied (⏳ gesendet · ✅ bestätigt · ❌ nicht angekommen).

### 3.4 · Alarme — Cron `device-alerts`, alle 15 Minuten

Für jede Regel: letzte Werte lesen, `for_minutes` prüfen, `cooldown`
prüfen, dann `action` ausführen:

- `notify` → Zeile in `notifications` mit Art `sensor_alert` — **neue Art
  in `GS_NOTIF_ZIELE`** mit Ziel „Gerät öffnen" und Anker `#geraet-<id>`;
  der Deep-Link-Prüfstand (`wiring_check` Richtung 5) sieht sie damit.
- `task:water` → eine Aufgabe „giessen" für die verknüpfte Pflanze,
  **heute**, mit Quelle `sensor` (§6).
- `calendar` → ein Ereignis der Art `alarm` im Kalender.

Und `stale` für jedes Gerät ohne Regel. **Push (korrigiert 06.09.2026):**
eine Zeile in `notifications` ist nur die Inbox — die Brücke aus
`20260826_push_to_inbox_bridge.sql` läuft push_send_log → notifications,
nie umgekehrt. Deshalb ruft der Cron die Edge-Function `sensor-push`
(`20260906_sensor_push.sql`), sobald er etwas Neues gemeldet hat; sie pusht
über das daily-push-Muster (VAPID, Stille, Pause, `notify_sensor`,
`push_send_log`) und markiert ihre Protokollzeile mit `notification_id`,
damit die Brücke keine zweite Inbox-Zeile erzeugt. Kein zweiter Push-Kanal —
nur eine zweite Quelle (§11.3k).

## 4 · Die Person als erstes Gerät

**Stufe 0 funktioniert ohne ein einziges Stück Hardware** — weil der
`manual`-Gerätetyp existiert: die Person misst mit dem Finger, dem Thermometer
oder dem Regenmesser und trägt den Wert ein. Er landet in derselben Tabelle,
mit `kind = 'manual'`, durchläuft dieselbe Katalogprüfung, erscheint im
selben Dashboard und löst dieselben Regeln aus.

Das ist nicht Verlegenheit, sondern der Kern der Vorbereitung:

- **Das Dashboard ist am Tag der ersten Hardware schon ein Jahr alt** —
  mit echten Nutzerdaten, echten Fehlern, echten Prüfständen.
- **Jede Regel, jede Anzeige, jeder Kalender-Anschluss ist bereits
  benutzt**, wenn der erste GreenScan-Sensor eingesteckt wird. Nur die
  Quelle ändert sich.
- Und es bleibt für immer nützlich: wer keinen Sensor kauft, hat trotzdem
  ein Messtagebuch.

## 5 · Das Dashboard

Ein eigener Bildschirm („Messwerte", erreichbar aus „Mein Garten" und aus
der Pflanzenkarte), gebaut aus drei Bausteinen, alle aus dem Katalog
getrieben:

1. **Gerätekachel** — Name, Ort (Garten/Beet/Pflanze), Status mit dem
   Zeitpunkt (`zuletzt 14:00 · vor 23 Min`), Batterie, und je Messgrösse
   der letzte Wert mit Qualität. Ein Wert mit `quality < 2` ist sichtbar
   markiert („ausserhalb des Messbereichs"), nicht versteckt.
2. **Verlauf** — eine Linie je Messgrösse, 24 h / 7 Tage / 30 Tage, mit den
   Schwellwerten als Linien und den **Ereignissen aus dem Kalender als
   Markierungen** (§6): „💧 gegossen 10:12" steht IM Diagramm, dort, wo die
   Feuchte springt. Das ist die Anzeige, die einen Sensor erklärt.
3. **Regeln** — je Grösse Schwelle, Dauer, Aktion. Vorschläge aus den
   Artendaten **nur** für die 40 Arten, die `care`/`lightMin` tragen; für
   alle anderen steht „keine Empfehlung hinterlegt" (Drei-Zustands-Regel).

**Diagramme ohne Paket.** Eine Canvas-Routine `_gsVerlauf(canvas, reihen,
optionen)` — Achsen, Linien, Schwellen, Markierungen, Berührung zeigt den
Wert. Rund 200 Zeilen, keine 200 KB. `_gsAufFarbe` sorgt für lesbaren Text
auf Linienfarben; `contrast_check` misst den Bildschirm, sobald er einen
Öffner ohne Parameter hat (`gsMesswerteOeffnen`).

**Aggregate.** Für 7 und 30 Tage rechnet der Client nicht über Rohwerte —
eine View `v_device_daily` (Tagesaggregat nach `aggregation` des Katalogs)
liefert je Tag einen Wert. 30 Tage × 5 Grössen = 150 Zeilen statt 7'200.

**Offline.** Die letzten 7 Tage je Gerät liegen in einer IndexedDB-Ablage
`device_cache` (Eigentum: `uid`, wie seit v32.22 überall) — **in `STORES`
eintragen, nicht in `SYNC_STORES`** (der Cache wird nicht hochgeladen). Ohne
Netz zeigt das Dashboard den Stand mit Zeitpunkt und sagt „ohne Netz, Stand
von …". Manuelle Messwerte ohne Netz gehen in `pending_sync` — der Weg
existiert.

## 6 · Die Verbindung zum Kalender und zu den Aufgaben

Das ist der Teil, der aus einem Sensor ein Werkzeug macht. Drei Verbindungen,
alle über die Ereignis-Schicht aus `KALENDER-V1.md`:

| Von | Nach | Was passiert |
|---|---|---|
| Regel `task:water` | Aufgabe heute | „Giessen — Bodenfeuchte seit 2 h unter 25 %" mit Quelle `sensor`; sie steht in „Heute zu tun" wie jede andere — **gebaut v32.53** (`vorgezogenAuf`, §11.3b) |
| Aufgabe erledigt | Tagebuch + Diagramm | der Eintrag „gegossen 10:12" wird zur Markierung im Verlauf |
| Messwert nach Aufgabe | **Bestätigung** | steigt die Feuchte innert 60 Min nach „gegossen" um ≥ 10 Punkte, steht am Tagebucheintrag „✓ vom Sensor bestätigt (21 → 48 %)". Steigt sie nicht: „⚠️ der Sensor hat davon nichts gemerkt" — falscher Sensor, falsches Beet, oder zu wenig Wasser. |

Die dritte Zeile ist die, die es sonst nirgends gibt: **die App prüft ihre
eigenen Aufgaben an der Wirklichkeit**, ohne jemandem zu widersprechen. Sie
sagt nur, was der Sensor sah. Und die Regel, die im Scanner (v31.99) und im
Planer (v31.75) gilt, gilt auch hier: erfüllt · verletzt · **nicht prüfbar**
(kein Sensor am Beet → „nicht prüfbar", nicht „✓").

Später (Stufe 3): Automationen als Regeln über mehrere Quellen — „wenn
Bodenfeuchte < 25 % **und** kein Regen in den nächsten 24 h (Open-Meteo,
gibt es schon) → Giessaufgabe; wenn Regen kommt → Aufgabe verschieben und
sagen warum." Auch das ist eine Zeile in `device_rules` mit `op = 'expr'`,
kein neuer Mechanismus.

## 7 · Weitere Systeme koppeln

„Weitere Systeme" heisst: Geräte, die nicht von GreenScan sind, und
Software, die Messwerte hat.

- **Fremde Sensoren** (`kind = 'third_party'`) gehen denselben Weg — ein
  Adapter ist ein kleines Stück Code, das ein fremdes Format in
  `{metric, ts, value}` übersetzt und an `device-ingest` schickt. Der
  Katalog ist die Schnittstelle. Wer einen Adapter schreibt, braucht nur
  §3.1 zu lesen.
- **MQTT** (Stufe 2): ein Broker-Bridge, der Topics `greenscan/<device>/<metric>`
  entgegennimmt und dieselbe Funktion aufruft. Kein zweiter Speicherweg.
- **Home Assistant / Smart-Home**: eine Export-Ansicht `v_device_latest`
  (own-only) — Leseweg über PostgREST mit dem Nutzer-JWT, wie alles andere.
- **Wetter** ist schon ein „Gerät": Open-Meteo liefert `air_temp`, `rain`,
  `air_humidity` für den Standort. In Stufe 1 wird es als virtuelles Gerät
  `kind = 'weather'` geführt — dann steht der Regen der letzten Woche neben
  der Bodenfeuchte im selben Diagramm, und Regel §6 kann ihn lesen.

## 8 · Stufen

| Stufe | Inhalt | Hardware nötig |
|---|---|---|
| **0** | Migrationen im Repo (`metric_catalog`, `devices`, `device_readings`, `device_rules`, `device_commands`, `v_device_daily`, RLS) — **nicht angewandt**, wie alle DDL · `manual`-Gerät · Dashboard mit Verlauf (`_gsVerlauf`, Canvas, ohne Paket) · Regeln clientseitig mit drei Zuständen · Kalender-Ereignisse `messung`/`alarm` · `sensor_check.js` (8 Fälle, test-first) — **v32.48 gebaut** | nein |
| **1** | `device-ingest` (Edge) · Token-Pairing per QR · Cron `device-alerts` · Push `sensor_alert` · Wetter als virtuelles Gerät · Bestätigung erledigter Aufgaben (§6) — **Stand 05.09.2026:** Wetter-Gerät und Bestätigung sind Stufe 0 geworden (v32.52, v32.53); `device-ingest` steht als Skelett mit geprüftem Regel-Modul (`ingest_check`, 11 Fälle), Vertrag in `docs/GERAETE-VERTRAG.md`, Cron und Tagesaggregat als Migrationen bereit (§11.3j) — **nicht ausgeführt, nicht angewandt**: es fehlt das Gerät; **App-Seite gebaut v32.62/v32.63** (§11.3l, §11.3m): Koppeln, Cloud-Abgleich, Regeln auf den Server, eine Alarm-Instanz je Regel | ein Gerät zum Testen |
| **2** | BLE-Pairing im Browser (`Permissions-Policy` erweitern, `wiring_check`/`kamera_check`-artiger Prüfstand mit gestellter BLE-API) · Firmware-Vertrag als `docs/GERAETE-VERTRAG.md` (das JSON aus §3.1, versioniert) · MQTT-Bridge | ja |
| **3** | Aktoren (Ventil, Pumpe, Licht) über `device_commands` · Automationen `op = 'expr'` · Export/Import | ja |

**Nachtrag 04.09.2026 (§11):** „Wetter als virtuelles Gerät" gehört nach
**Stufe 0**, nicht 1 — es braucht weder Gerät noch Server, nur den
Zwischenspeicher von Open-Meteo (Idee 3). Und der Regen-Draht aus v31.84, an
dem §6 hängt, war bis v32.50 tot (11.3).

**Was in Stufe 0 bewusst NICHT gebaut wird:** BLE, Firmware, Cloud-Ingest.
Nicht, weil es unwichtig wäre — weil es ohne Gerät nicht prüfbar ist, und
dieses Repo baut nichts, das es nicht auslösen kann. Das Schema und der
Vertrag sind so gebaut, dass Stufe 1 nichts an Stufe 0 ändert.

## 9 · Regeln, die beim Bau gelten

1. **Kein `if (metric === …)` im Frontend.** Alles aus dem Katalog.
2. **Kein Messwert wird verworfen.** Unplausibel ist eine Qualität, kein Löschgrund.
3. **„Verbunden" erst nach dem ersten Wert.** Vorher „wartet auf Signal".
4. **Stille ist ein Alarm.** `stale` für jedes Gerät, ohne Zutun.
5. **Ein Befehl ohne Bestätigung ist ein Wunsch.** Drei Zustände sichtbar.
6. **Nie erfundene Schwellen.** Empfehlung nur, wo die Artendaten sie tragen; sonst „keine Empfehlung hinterlegt".
7. **Ein Weg hinein, ein Weg hinaus.** `device-ingest` ist die einzige Schreibstelle für Messwerte; PostgREST mit RLS die einzige Lesestelle.
8. **Zeit des Geräts, Zeit des Servers, beide gespeichert.** Eine Uhr, die falsch geht, darf sichtbar werden.
9. **Prüfstand vor Hardware.** `sensor_check.js` fährt ein simuliertes Gerät (Ingest-Antwort gestellt, 7 Tage Werte, eine Regel, eine Bestätigung) — und misst das gerenderte Dashboard, nicht das Objekt.
10. **Datenschutz wie überall.** Messwerte sind Personendaten: Export mit dem Konto, Löschung mit dem Konto, EU-Region, kein Analytics-Ereignis ohne Zustimmung.

## 9a · Der Frontend-Vertrag für Stufe 0 (so heissen die Dinge)

Damit `sensor_check.js` vor dem Code geschrieben werden kann — und damit die
nächste Sitzung nicht rät:

| Funktion | Tut | Gibt zurück |
|---|---|---|
| `gsMetricKatalog()` | Katalog aus `gs_metric_catalog` (Cache der Tabelle) oder dem eingebauten Startbestand (elf Grössen) — **nie leer** | Array von Katalogzeilen |
| `gsGeraete()` | Geräte aus `gs_geraete` | Array |
| `gsGeraetAnlegen({kind, name, garden_id?, plant_id?})` | legt ein Gerät an (Stufe 0: `kind = 'manual'`); Rückgabe `false`, wenn der Speicher voll ist | Gerät oder `false` |
| `gsMesswertEintragen(geraetId, metric, wert, ts?)` | prüft gegen den Katalog (unbekannte Grösse → Fehler; ausserhalb → `quality 1`, **angenommen**), hängt an `gs_messwerte` an (Deckel 2'000, Rest ins Archiv), merkt `pending` für die Cloud | `{ok, quality, grund}` — `ok:false` bei vollem Speicher, mit Meldung |
| `gsMesswerte(geraetId, metric, von?, bis?)` | liest, nach `ts` sortiert | Array |
| `gsRegelnPruefen(geraetId)` | wertet `gs_geraete_regeln` aus — je Regel `erfuellt` · `verletzt` · `nicht_pruefbar` (keine Werte, oder zu wenige für `for_minutes`) | Array mit Zustand und Grund |
| `gsMesswerteOeffnen()` | das Dashboard (ohne Parameter, mit `openModal(` im Rumpf — sonst sehen `wiring_check` und `contrast_check` es nicht) | — |
| `_gsVerlauf(canvas, reihen, optionen)` | Linien, Schwellen, Markierungen aus dem Kalender; ohne Paket | — |

Speicher: `gs_geraete`, `gs_geraete_regeln`, `gs_messwerte` → `GS_USER_KEYS`
(gehen beim Abmelden); `gs_metric_catalog` → `GS_KEEP_ON_LOGOUT` (öffentlich).
`gs_geraete` und `gs_geraete_regeln` reisen im `state`-Blob (klein);
`gs_messwerte` **nicht** — dafür ist die Tabelle da (Stufe 1). Kalender:
Messwerte von Hand sind Ereignisse der Art `messung`, verletzte Regeln der
Art `alarm` (`KALENDER-V1.md` §3.4).

## 10 · Was ich Fernando frage, bevor Stufe 1 beginnt

- **Welche Messgrössen hat das erste GreenScan-Gerät?** Der Katalog
  startet mit elf; fehlt eine, ist es eine Zeile.
- **Wie kommt das Gerät ins WLAN — und braucht es je Konto ein Token oder
  je Gerät?** Der Entwurf sagt je Gerät (verlieren, sperren, ersetzen ohne
  Nebenwirkung). Das legt fest, was auf der Verpackung steht.
- **Soll es Messwerte von Hand geben (§4)?** Ich rate dazu — es ist der
  Grund, warum das Dashboard am ersten Tag funktioniert.
- **Retention:** 400 Tage Rohwerte sind ein Vorschlag. Länger kostet
  Speicher, kürzer kostet den Jahresvergleich.
- **Fünf weitere Fragen** stehen in §11.4 — Uhr im Gerät, Verpackung,
  Alt-Tabellen, erster Gerätetyp, Provisioning.

## 11 · Ideen für die Zeit mit Sensoren (04.09.2026)

> Fernando: *„Bringe Ideen die auch mit den zukünftigen Sensoren eine Rolle
> spielen könnte. Es soll perfekt alles vorbereitet werden damit die Sensoren
> dann auf Anhieb funktionieren. […] Nichts darf fehlen."*

**Wie dieses Kapitel entstanden ist.** Drei Berichte aus drei Blickwinkeln
— Hardware und Anbindung · Nutzung im Alltag · Daten und Modell — gegen den
Code v32.49/v32.50. Danach wurde **jede Behauptung einzeln** von einem Prüfer
mit dem Auftrag „widerlegen" gegen das Repo gehalten — **35 Behauptungen:
30 bestätigt, 4 präzisiert, 1 widerlegt.** Ehrlich dazu: die Prüfer-Flotte
(39 Agenten) ist nach zwei Urteilen am Monatslimit der Organisation
ausgefallen; die übrigen 33 Behauptungen habe ich **von Hand** nachgezählt
(grep, `node -e`, jede mit Datei:Zeile), die drei Gegenleser für den Diff von
v32.51 und der Lücken-Prüfer liefen nicht — für den Diff gelten die 16
Prüfstände und die drei Gegenproben (11.3), die Lücken (Ideen 21–25) habe ich
selbst gesucht. Was hier steht, ist belegt oder ausdrücklich als
**Vermutung** markiert; drei Dinge bleiben **ungeprüft**, weil sie die lebende
Datenbank brauchen: ob `sensor_readings` Zeilen enthält, ob der Server die
Spalte `sensor_devices.device_token` wirklich ausliefert, und was der
CSV-Export heute enthält. Jede Idee trägt
dieselben sechs Angaben: *Nutzen · Daten und Anknüpfung · Stufe · prüfbar
ohne Hardware · die Falle · Aufwand.*

Die eine Regel aus §0 gilt weiter: **ein Gerät ist ein Datensatz, kein
Sonderfall.** Und eine zweite kommt dazu, weil sie in fast jeder Idee
auftaucht: **Messen ist kein Erledigen.** Kein Messwert setzt je ein
`lastDone`, kein Sensor hakt eine Aufgabe ab — er sagt, was er gesehen hat,
und die Person entscheidet.

### 11.0 · Zuerst die Korrektur: §1 war falsch

§1 sagte „Tabellen für Geräte oder Messwerte: **keine**". Das stimmt nicht,
und die Prüfung hat es an sechs Stellen belegt (§1 ist jetzt korrigiert):

| Was es schon gibt | Wo | Was daraus folgt |
|---|---|---|
| Drei **Live-Tabellen** `sensor_devices` · `sensor_readings` · `sensor_alerts` | `docs/backend-inventar.json` Z. 131–133; STATUS v30.96: „sensor_devices = 1, sensor_readings = 0" | Ein zweites Schema, das nie mit dem Entwurf abgeglichen wurde |
| **Drei Oberflächen** in der Menü-Suche mit denselben Tags | `MENU_ITEMS`: „📊 Messwerte" (`gsMesswerteOeffnen`, v32.48), „🏠 Sensor-Dashboard" (`gsShOpen`, v24.06), „📶 Sensoren & Geräte" (`openDevicesModal`, Web-Bluetooth + ESP32-Assistent) | Wer „Sensor" sucht, bekommt drei Antworten |
| Der alte **ESP32-Assistent** lässt den Nutzer sein **Sitzungs-Token** (`gs_sb_token`) in die Firmware kopieren und postet direkt in `/rest/v1/sensor_readings` | `index.html` ~Z. 70730–70736 (`USER_TOKEN = "PASTE-USER-JWT-HERE"`) | Vollzugriff aufs Konto auf einem Chip — und das Token läuft ab, das Gerät verstummt still |
| Ein `ingest_sensor_reading`-RPC steht in den Release-Notizen, **nicht** im Live-Inventar | `GS_RELEASES` (Notiz v23.5x) vs. `backend-inventar.json` | Die Notiz beschreibt etwas, das es nicht gibt |
| `gs_metric_catalog` wird **gelesen, nie geschrieben** | `index.html` Z. 26552 (Leser), Z. 80597 (Keep-Liste) — kein `setItem` | „Eine neue Sensorart ist eine Zeile" gilt nur in der Datenbank; die App sieht die Zeile nie |
| `GS_NOTIF_ZIELE.sensor_alert` stand **zweimal** im Objekt (der zweite gewann) | `index.html` Z. 26229 / 26238 | behoben v32.51 |

Deshalb ist Idee 1 keine Idee, sondern die **Voraussetzung**: solange es zwei
Geräteschichten gibt, bringt das erste GreenScan-Gerät den Fehler „zwei
Speicher für dieselbe Frage" (CLAUDE.md, `einstellungen_check`) fertig mit.

### 11.1 · Die Ideen — nach Stufe, innerhalb der Stufe nach Nutzen

| # | Idee | Stufe | Aufwand | Voraussetzung |
|---|---|---|---|---|
| 1 | Eine Geräteschicht, nicht zwei | 0 | mittel | Entscheid Fernando (11.4) |
| 2 | Katalog wirklich laden, Modell-Katalog | 0 → 1 | klein–mittel | **Leser gebaut v32.52** (`gsMetricKatalogLaden`); Modell-Katalog offen |
| 3 | Wetter als virtuelles Gerät | 0 | mittel | **gebaut v32.52** (`gsWetterGeraetAbgleich`, 7 Tage, nur Vergangenheit) |
| 4 | Giessen bestätigt sich selbst — als Aussage; Regel-Aktion verdrahten | 0 | mittel | **gebaut v32.53** (`gsSensorAufgabenAbgleich`, `gsGiessBestaetigung`, `vorgezogenAuf`) |
| 5 | Schwellwert-Vorlagen nur, wo eine Zahl steht | 0 | klein | **gebaut v32.55** (`gsSchwellwertVorlagen`: Artenliste, Kulturdaten, eigener Verlauf) |
| 6 | Lina kennt die Zahlen | 0 | klein–mittel | **gebaut v32.56** (`gsLinaZahlen` im Kontext, Prüfstand hält jede Zahl gegen einen Datensatz) |
| 7 | Ein Meldungs-Budget gegen Alarm-Müdigkeit | 0 | klein | **gebaut v32.54** (`gsNotif.stille`, `showKategorie`, `gsSensorAlarmeMelden`) |
| 8 | Wochenrückblick statt „N Aufgaben" | 0 | mittel | **gebaut v32.58** (Karte „Deine Woche", `gsWochenrueckblick`); der `weekly_summary`-Push bleibt bei einer Zahl (Server) |
| 9 | Zwei Standorte nebeneinander | 0 | klein | **gebaut v32.57** (Vergleich im Dashboard, `_gsMwVergleichMalen`) |
| 10 | Frostnacht am eigenen Beet | 0 / 1 | klein / mittel | **Stufe 0 gebaut v32.56** (Frost-Ereignis aus der Vorhersage im Kalender); Stufe 1 (Sensor gegen Prognose) braucht ein Gerät |
| 11 | Server-taugliche Identität und Idempotenz lokal | 0 | klein | **gebaut v32.52** (UUID, `_gsMesswerteAnhaengen` mit Dublettensperre) |
| 12 | Export, Import, Löschung — die neuen Schlüssel sind sichtbar | 0 | klein | v32.51 (Backup ✓) · **v32.57 (CSV ✓**, `gsExportMesswerteCSV`); `delete-user`-Liste offen |
| 13 | Urlaub: Giess-Zettel jetzt, Stellvertreter später | 0 / 2 | mittel / gross | **Stufe 0 gebaut v32.59** (`gsGiessZettel`, Druckansicht; die Pause gab es schon); Stellvertreter braucht `garden_members` (Stufe 2) |
| 14 | Firmware-Vertrag als geteilte Regeldatei (Uhr, Batch, Antwort) | 1 | mittel | **vorbereitet 05.09.** (`GERAETE-VERTRAG.md`, `ingest_regeln.mjs`, `ingest_check`, `device-ingest`-Skelett) — Ausführung braucht Deno und ein Gerät |
| 15 | Geräte-Identität ab Werk und Claim-Code-Pairing | 1 | mittel–gross | Entscheid Fernando |
| 16 | Stille und Batterie: Vorgaberegeln und Cron `device-alerts` | 1 | mittel | **Migration bereit 05.09.** (`20260905_device_alerts_cron.sql`: `expected_by`, `notify_sensor`, Meldung je Tag, `for_minutes`, `cooldown`); **Push-Weg 06.09.** (`sensor-push`, `20260906_sensor_push.sql`, §11.3k); Vorgaberegeln beim Pairing offen |
| 17 | Tagesaggregat als Tabelle — sonst gibt es keinen Jahresvergleich | 1 | klein (SQL) / mittel | **Migration bereit 05.09.** (`20260905_device_daily.sql`: Tabelle, Aggregat-Funktion, Cron vor dem Prune); Ansicht „Mein Naturjahr" offen |
| 18 | Firmware-Kanal | 2 | mittel | Gerät |
| 19 | Transport-Entscheid gegen `_headers` | 2 | Entscheid klein, Bau gross | Gerät |
| 20 | Befehle mit Ablauf und Sicherheitsgrenze | 3 | mittel | Vertrag und Rechnung stehen (`befehleAufbereiten`, `acksAuswerten`, 05.09.); **`expires_at` fehlte in der Tabelle** — `naht_check` 06.09., Migration `20260906_device_commands_expires_at.sql`; Aktor fehlt |
| 21 | Ein Gerät in den Beispieldaten — sonst vermisst jeder Prüfstand ein leeres Dashboard | 0 | klein | **gebaut v32.52** (`_seed.js`: Gerät, 15 Werte, 1 Regel); Textersatz fürs Diagramm **v32.60** |
| 22 | Katalog-Labels in vier Sprachen — die Tabelle hat sie, die App liest nur Deutsch | 0 | klein | **gebaut v32.55** (`_gsMetricLabel`, `metric_<key>` in der Sprachschicht, `i18n_check` kennt die Liste) |
| 23 | Kalibrierung als Daten — Offset und Faktor je Gerät und Messgrösse | 1 | klein–mittel | Migration |
| 24 | Planer rechnet mit gemessenem Regen, nicht nur mit der Prognose | 0 / 1 | mittel | **Stufe 0 gebaut v32.60** (Vorhersage und Messung getrennt benannt); Bodenfeuchte in der Bilanz braucht ein Gerät |
| 25 | Vom Scan zum Gerät: `gsTwinAdopt` bietet die Verknüpfung an | 1 | klein | Gerät |

---

#### 1 · Eine Geräteschicht, nicht zwei

**Nutzen.** Wer heute den Flower-Care-Weg oder den ESP32-Assistenten benutzt,
landet später im selben Dashboard — nicht in einem zweiten. Und kein
Sitzungs-Token liegt mehr auf einem Chip.

**Daten und Anknüpfung.** Alt: `_gsDev`/`gs_devices` (BLE, v23.52),
`openDevicesModal`, `gsShOpen`, `sensor_readings` mit den Namen
`illuminance` · `temperature` · `soilMoisture` und der Spalte `value_num`.
Neu: `gsGeraete`, `gsMesswertEintragen`, `gsMetricKatalog()`. Fehlt: eine
**Übersetzungstabelle** `illuminance → light`, `temperature → air_temp`,
`soilMoisture → soil_moisture` — als Daten, nicht als `if` (§9 Regel 1); die
Umleitung der zwei Alt-Einträge in `MENU_ITEMS` auf „Messwerte"; das
Entfernen der JWT-Anleitung; und ein Entscheid über die Live-Tabellen
(Altdaten per Migration nach `device_readings` kopieren, Alt-Tabellen lesbar
lassen — **umleiten, nicht löschen**).

**Stufe** 0 → 1. **Prüfbar ohne Hardware:** ein Fall in `sensor_check`, der
zählt, dass es genau **einen** Öffner für Messwerte gibt und die zwei alten
dorthin führen; ein Grep-Fall: kein `gs_sb_token` in Code, der als
Gerätebeispiel angezeigt wird; jede Altbezeichnung gegen `gsMetricKatalog()`.

**Die Falle.** „Beim Aufräumen löschen" ist die schnelle und die falsche
Antwort: die eine Zeile in `sensor_devices` gehört jemandem. Die Prüfung
konnte nicht sehen, ob `sensor_readings` live Zeilen enthält (kein
Datenbankzugriff von hier) — vor dem Umzug nachzählen. Und ein Detail, das
der Prüfer korrigiert hat: der alte Assistent **fordert**
`sensor_devices.device_token` ausdrücklich vom Server an
(`select=id,name,kind,device_token,…`), zeigt ihn aber nirgends — das Feld
wird geholt und weggeworfen; ob der Server die Spalte ausliefert, steht in
keiner Migration im Repo.

**Aufwand** mittel.

#### 2 · Katalog wirklich laden, und ein Modell-Katalog daneben

**Nutzen.** „Eine neue Sensorart ist eine Zeile" wird wahr — auch in der App.

**Daten und Anknüpfung.** `metric_catalog` (Migration, 11 Zeilen, öffentlich
lesbar) → `gs_metric_catalog` (Keep-Liste, nie geschrieben). Fehlt: der
Leser, der die Tabelle beim Start holt und nur bei Erfolg den Zwischenspeicher
ersetzt; sonst bleibt der eingebaute Startbestand (§9 Regel „nie leer").
Dazu ein **Modell-Katalog** `device_models` (`gs_soil_v1`: Messgrössen,
Standard-Intervall, `commands`, Batterietyp, Ikone), damit
`devices.capabilities` gegen etwas **geprüft** wird statt geglaubt.
Gerätetypen, die das Modell heute trägt: Bodenstab (`soil_moisture` ·
`soil_temp` · `ec` · `battery`), Wetterstation (`air_*` · `rain` · `light`,
netzbetrieben, kleines Intervall), Ventil (`commands: ["valve"]`). **Eine
Kamerafalle passt nicht ins Modell** — ein Bild ist kein `numeric`; der Weg
wäre Storage-Bucket (Muster `gsUploadImage`) plus Messwert mit `raw.url`, oder
bewusst eine spätere Stufe.

**Stufe** 0 → 1. **Prüfbar ohne Hardware:** `sensor_check` mit gestelltem
`sbFetch` — Tabelle liefert 12 Grössen → das Dashboard zeigt die zwölfte;
Tabelle leer oder Fehler → Startbestand, nie leer.

**Die Falle.** Katalog-Drift: ein Wert, den der Server annimmt und den der
Client nicht anzeigen kann. Deshalb ersetzt der Leser nur bei Erfolg und
merkt sich das Datum der Momentaufnahme (wie `backend_check`).

**Aufwand** klein (Leser) / mittel (Modell-Katalog).

#### 3 · Wetter als virtuelles Gerät — Stufe 0, nicht 1

**Nutzen.** Regen und Lufttemperatur stehen **neben** der Bodenfeuchte im
selben Diagramm, bevor ein einziger Sensor existiert. Die Regel „kein Regen
in 24 h" (§6) wird prüfbar. Und wer später einen Bodenstab kauft, sieht am
ersten Tag den Zusammenhang, nicht eine leere Kurve.

**Daten und Anknüpfung.** `gs_weather_cache` (Open-Meteo, stündlich
`temperature_2m` · `precipitation`, 30-min-TTL), die Stunden-Logik aus
`gsRegenGefallen` (zählt **nur bis jetzt**), `GS_GERAET_ARTEN.weather` (der
Eintrag ist da), Katalog `air_temp` · `air_humidity` · `rain`,
`weather_log_per_garden` als Tagesarchiv. §8 führt das in Stufe 1 — es
braucht aber **kein** Gerät und keinen Server; es ist ein Abgleich vom
Zwischenspeicher in `gs_messwerte`.

**Stufe** 0. **Prüfbar ohne Hardware:** gestellter Zwischenspeicher mit drei
Regenstunden, Abgleich **zweimal** → die `rain`-Summe bleibt gleich (das ist
der Dubletten-Fall, Idee 11); Zukunftsstunden → kein Eintrag.

**Die Falle.** **Eine Vorhersage ist kein Messwert.** Open-Meteo ist ein
Modell, kein Sensor — und `quality` (0/1/2) hat keinen Platz für
„modelliert". Statt eine vierte Stufe zu erfinden: `raw.source = 'open-meteo'`
und die Kachelart „Wetterdienst" sagen es. Und `rain` ist eine **Summe** —
eine Dublette verdoppelt den Regen. Idee 11 zuerst.

**Aufwand** mittel.

#### 4 · Giessen bestätigt sich selbst — als Aussage, nicht als Haken

**Situation.** „Ich habe um 7 gegossen und abgehakt. Um 8 sagt die App: der
Sensor im Hochbeet hat davon nichts gemerkt."

**Nutzen.** Die App sieht, ob das Giessen angekommen ist — und sagt bei 61 %
Feuchte „kann warten". Die Aufgabe bleibt stehen (dieselbe Regel wie beim
Regen, v31.84).

**Daten und Anknüpfung.** `gsQuickDone` → `p.diary {ts, action:'water'}`;
`gsTagebuchAlle` (`cat:'water'`); `_gsMwVerlaufMalen` zeichnet die
Giess-Marken schon — aber nur über `g.plant_id`; `gsMesswerte(id, metric,
von, bis)`. **Fehlt:** `_gsGeraeteFuerPflanze(p)` (Geräte mit `plant_id` ∪
Geräte mit `garden_id == p.gardenId`; `bed_id` steht im Schema und wird im
Client nie gesetzt). Und: `device_rules.action` (`notify` · `task:water` ·
`calendar`) wird **von niemandem gelesen** ausser beim Anlegen —
`gsRegelnPruefen` liefert Zustände, verletzte Regeln werden nur
`alarm`-Ereignisse. Die Zeile aus §6 „Regel `task:water` → Aufgabe heute"
gibt es im Code noch nicht. Dazu braucht `getDaysUntilDue` ein Feld, das eine
Aufgabe **früher** fällig macht — es kennt nur `lastDone + intervalDays` und
`snoozedUntil` (nur nach hinten). Vorschlag `t.vorgezogenAuf`, in
`v_plant_tasks_due` mitgezogen — sonst rechnen Server und App verschieden
(KALENDER-V1 §1.2, dieselbe Falle wie bei `snoozedUntil`).

**Stufe** 0 — die Bestätigungslogik aus §6 (+10 Punkte innert 60 Minuten) ist
reine Rechnung und läuft mit Werten von Hand. **Prüfbar ohne Hardware:**
Handwerte 21 % um 09:50 und 48 % um 10:40, Abhaken um 10:12 → „bestätigt";
ohne Wert danach → „nicht prüfbar"; ohne Gerät am Beet → „nicht prüfbar";
Regel `task:water` verletzt → Zeile in „Heute zu tun" mit `quelle:'sensor'`,
aus dem HTML gelesen.

**Die Falle.** Ein Feuchte-Sprung ist kein Beweis fürs Giessen — Regen,
Nachbarin, Sensor gewackelt. Drei Zustände, immer mit Zahl: **bestätigt**
(Δ ≥ 10) · **nicht gemerkt** · **nicht prüfbar** (kein Gerät, kein Wert
innert 60 Minuten, Qualität < 2). „≥ 10 Punkte" ist **gesetzt, nicht
gemessen** — eine benannte Konstante mit Begründung, nach den ersten Geräten
nachkalibrieren. Mehrere Geräte am selben Beet: **nicht mitteln**, das
vorsichtigste nehmen (bei `below` das tiefste) und das Gerät nennen —
dieselbe Regel wie `_gsVorsichtigste` beim Scanner.

**Aufwand** mittel.

#### 5 · Schwellwert-Vorlagen nur, wo eine Zahl steht

**Situation.** „Ich hänge den Sensor an die Monstera, und die App schlägt
vor: Licht unter 200 lux melden — Quelle: Artenliste."

**Daten und Anknüpfung.** `lightMin` / `lightOptimal` / `lightMax` /
`waterFrequency` / `care` stehen bei **40 von 4'342** Arten — alle
Hauspflanzen (`bookRef HP.*`); `care` ist Fliesstext (rund 38 nennen °C,
nicht parsebar). Zweite Quelle `PLANT_DB` (41 Kulturen): `bodentemp` bei 39
als Zahl in °C → `soil_temp below` („zu kalt zum Säen"); `water` ist
`low/medium/high` — **kein** Prozentwert. Dritte: `garden_crop_agronomy.soil_ph`
als Text „6.0-7.0" → `ph`, nur wenn als „a-b" parsebar. Für **Bodenfeuchte**
trägt keine der drei Quellen eine Zahl.

**Stufe** 0. **Prüfbar ohne Hardware:** Monstera → `light below 200` mit
`grund: 'Artenliste HP…'`; Bärlauch → „keine Empfehlung hinterlegt"; ein
Gemüse mit `water:'high'` → **keine** Feuchte-Schwelle.

**Die Falle.** Ein Feuchte-Prozentwert ist **sensorabhängig** (kapazitiv vs.
resistiv, Substrat) — **nie eine globale Schwelle ausliefern.** Feuchte kann
nur aus den eigenen Sprüngen kommen: nach 14 Tagen Werten das beobachtete
Minimum und Maximum als **Angebot** („unter deinem 14-Tage-Tief melden?").
Ehrlich bleibt die Zahl: rund 80 von 4'342 Arten tragen eine Empfehlung — sie
steht in der Anzeige. Ein Vorschlag wird **nie automatisch** angelegt; die
Person bestätigt.

**Aufwand** klein.

#### 6 · Lina kennt die Zahlen

**Situation.** „Warum hängt mein Basilikum?" — „Dein Gerät ‚Balkon Süd'
meldete seit Dienstag 14–19 % Feuchte, Giessen war drei Tage überfällig,
Freitag 31 °C."

**Daten und Anknüpfung.** `gsLinaContext()` liefert heute Pflanzenzahl,
Region und Jahreszeit. Fehlt ein Block von höchstens ~600 Zeichen: fällige
Aufgaben, Alarme mit Grund, je Gerät der letzte **plausible** Wert mit Zeit,
Anzahl Werte und Lücken, und die „nicht prüfbar"-Gründe. Alles aus
`gsKalenderEreignisse(heute − 7, heute)` und `gsRegelnPruefen`.

**Und die Vorbedingung, die erst diese Prüfung gefunden hat:** CLAUDE.md
§3.4 behauptete, `opts.brain` injiziere „automatisch Persona + User-Kontext".
Im Code wird `brain` **nur als Log-Beschriftung** verwendet (`_gsLogAiUsage`);
eine Persona-Tabelle oder eine Prompt-Ergänzung gibt es nicht. §3.4 ist
korrigiert. Wer Lina Kontext geben will, baut ihn in `gsLinaContext()` — nicht
in ein Feld, das niemand liest.

**Stufe** 0 — funktioniert mit Werten von Hand ab dem ersten Tag. **Prüfbar
ohne Hardware:** ein Prüfstand nach dem Muster von `scan_check`, der den
gebauten Kontext gegen die App-Daten hält: jede Zahl im Kontext muss aus
einem Datensatz stammen.

**Die Falle.** Lina interpoliert („drei Tage unter 20 %" aus zwei Messungen).
Gegenmittel: Anzahl und Lücken **im Kontext**, die Anweisung „nur aus dem
Kontext zitieren, sonst sagen, dass kein Wert da ist" — und weil ein Prompt
keine Garantie ist (§4a.2 in CLAUDE.md), der Prüfstand.

**Aufwand** klein–mittel.

#### 7 · Ein Meldungs-Budget gegen Alarm-Müdigkeit

**Situation.** „Ich bekomme **eine** Garten-Meldung am Tag — Frost und ein
verstummtes Gerät dürfen extra."

**Daten und Anknüpfung.** Serverseitig gibt es die Disziplin schon: eine
Meldung je Kategorie und Tag, Stille-Zeit 22–7 Uhr (`weather-alert-checker`,
`daily-push-checker`). **Lokal nicht:** `gsNotif` kennt keine Stille-Zeit,
`scheduleAllNotifications` plant eine Meldung **je** fälliger Aufgabe und
liest **nur `myPlants`** — die Garten-Pflanzungen, die seit v32.47 Aufgaben
haben, melden sich lokal nie.

**Was zu tun ist.** (a) `gsNotif.show` bekommt die Stille-Zeit aus
`gs_push_settings`; (b) lokale Aufgaben-Meldungen bündeln wie der Server
(ein Push, drei Namen) und `plantings` mitnehmen — über `gsGetDueTasks`, die
eine Rechnung; (c) Sensor-Alarme in **eine** Tageskategorie `sensor_alert`,
`stale` und `critical` ausgenommen; (d) Stummschalten je Gerät wie
`gs_reminder_prefs.disabled` je Pflanze; (e) ein Zähler „diese Woche 9
Meldungen" in den Einstellungen, aus `push_send_log`.

**Stufe** 0. **Prüfbar ohne Hardware:** `einstellungen_check` mit gestellter
Uhr: um 23:00 keine lokale Meldung; drei fällige Aufgaben → **eine**
Meldung; eine fällige Garten-Pflanzung → sie steht drin.

**Die Falle.** Stille ist gefährlich (§9 Regel 4) — `stale` also nie ganz
weg, aber nach dem ersten Mal Inbox statt Push. **Vermutung:** mehr als zwei
Pushes am Tag werden abgeschaltet; messbar erst mit dem Zähler.

**Aufwand** klein.

#### 8 · Wochenrückblick statt „N Aufgaben"

**Situation.** „Sonntagmorgen: 5 von 7 Aufgaben erledigt, 9 mm Regen, zwei
Frostnächte, das Hochbeet nie unter 25 %, ‚Balkon Nord' schwieg zwei Tage."

**Daten und Anknüpfung.** `gsTagebuchAlle`, Messwerte als Tagesaggregat nach
`aggregation` aus dem Katalog, `weather_log_per_garden` (schreibt täglich
min/max/Niederschlag/Frost). Anzeige als Startseiten-Karte; der bestehende
`weekly_summary`-Push (sonntags, `daily-push-checker`) bekommt **Inhalt statt
einer Zahl** — kein neuer Push-Kanal.

**Stufe** 0. **Prüfbar ohne Hardware:** sieben Tage Werte von Hand und zwei
Tagebuch-Einträge → die Karte nennt alle vier Zahlen, aus dem HTML gelesen;
ein Tag ohne Werte → „keine Daten", nicht 0.

**Die Falle.** Keine Note, kein Score, kein Vergleich mit anderen. Tage ohne
Werte sind „keine Daten". Und das Wetter aus dem Zwischenspeicher ist der
**Nutzer-Standort**, nicht das Beet — die Quelle steht dabei.

**Aufwand** mittel.

#### 9 · Zwei Standorte nebeneinander

**Situation.** „Balkon Süd gegen Balkon Nord: dieselbe Grösse, zwei Linien,
sieben Tage."

**Daten und Anknüpfung.** `_gsVerlauf` nimmt bereits mehrere `reihen`. Fehlt
nur die Auswahl zweier Geräte mit derselben `metric`. Mit zwei
„von Hand"-Geräten sofort nutzbar.

**Stufe** 0. **Prüfbar ohne Hardware:** zwei Geräte, je drei Werte → zwei
Linien im Canvas (Pixelprobe), Legende nennt beide Namen.

**Die Falle.** Verschiedene Sensoren → **Trends** vergleichen, nie
Absolutwerte (Idee 5, dieselbe Sensorabhängigkeit). Nur gleiche Messgrösse;
Zeitlücken sichtbar lassen, nicht interpolieren.

**Aufwand** klein.

#### 10 · Frostnacht am eigenen Beet, nicht am Gitterpunkt

**Situation.** „Um 21 Uhr sehe ich: Prognose 1,5 °C, mein Balkon-Sensor liegt
seit einer Stunde 2 K darunter — ich hole die Tomaten rein."

**Daten und Anknüpfung.** `gs_weather_cache` hat `hourly.temperature_2m`;
der Server-Push bei ≤ 2 °C existiert (`weather-alert-checker`, Kategorie
`frost`). **Im Kalender fehlt es:** ein `wetter`-Ereignis „Frost möglich, min
1,2 °C um 05:00 — Open-Meteo" für morgen, **offline aus dem
Zwischenspeicher**. Mit Gerät (Stufe 1): Regel `air_temp below 2,
for_minutes 30` plus die Abweichung Sensor − Prognose als Zahl („dein
Standort liegt 2,3 K unter der Prognose").

**Stufe** 0 (Ereignis) / 1 (Sensor). **Prüfbar ohne Hardware:** gestellter
Zwischenspeicher mit 1,2 °C um 05:00 morgen → Ereignis im Kalender; ohne
Stundenwerte → keins.

**Die Falle.** Ein Luftsensor in 1 m Höhe misst nicht die Blattoberfläche;
Reif entsteht bei +2 °C Luft. **Nie „kein Frost" aus dem eigenen Sensor** —
nur „Prognose sagt X, dein Sensor sagt Y". Und dieselbe Push-Kategorie
`frost` benutzen (Dedup je Tag), sonst kommen zwei Frost-Pushes.
**Vermutung:** in Schweizer Tallagen und auf Balkonen ist die Abweichung oft
grösser als die Unsicherheit der Prognose — genau das kann nur ein eigener
Sensor zeigen.

**Aufwand** klein / mittel.

#### 11 · Server-taugliche Identität und Idempotenz — lokal, jetzt

**Nutzen.** Handmessungen von heute kommen in Stufe 1 **ohne Umbenennung** in
der Cloud an.

**Daten und Anknüpfung.** Lokal: Geräte-Id `ger_<base36>` (Server: `uuid`);
Felder `wert` / `geraet_id` (Server: `value` / `device_id`); **keine
Dublettensperre** — `gsMesswertEintragen` hängt an, ohne nachzusehen. Fehlt:
`crypto.randomUUID()` statt `ger_…`, ein lokales `received_at`, ein
Dedup-Schlüssel `(geraet_id, metric, ts)` — derselbe wie der Primärschlüssel
auf dem Server.

**Stufe** 0. **Prüfbar ohne Hardware:** denselben Wert zweimal eintragen → 1
Datensatz; die zweite Antwort sagt „schon da", nicht „gespeichert".

**Die Falle.** Bestandsdaten mit `ger_`-Ids: **nicht umbenennen**, sondern
beim ersten Hochladen abbilden (`raw.local_id`). Und der Deckel: seit v32.51
gehen zuerst die hochgeladenen Werte, dann erst — mit Archiv — die anderen
(11.3).

**Aufwand** klein.

#### 12 · Export, Import, Löschung — die neuen Schlüssel sind sichtbar

**Nutzen.** revDSG-Auskunft und Gerätewechsel ohne Verlust.

**Daten und Anknüpfung.** `exportUserData()` / `importUserData()` — **seit
v32.51 mit** `gs_geraete` · `gs_geraete_regeln` · `gs_messwerte`
(Backup-Version 16; bis v32.50 fehlten sie: die einzige Kopie einer
Handmessung war das Gerät). Noch offen: der **CSV-Export** (`gsShowExportModal`)
kennt die Messwerte nicht; und `supabase/functions/delete-user` führt die
Alt-Tabellen in seiner Liste, **nicht** die fünf neuen — `on delete cascade`
greift, aber die Liste ist die Doku.

**Stufe** 0. **Prüfbar ohne Hardware:** `sensor_check` „Backup": exportieren
→ Speicher leeren → einspielen → Feld für Feld gleich; zweimal einspielen →
kein Doppel; voller Speicher → „nicht gesichert" genannt (**gebaut v32.51**).

**Die Falle.** Die Einheit gehört **in** die CSV-Datei (`ts, metric, value,
unit, quality, device`) — sonst bedeutet „31.5" nichts mehr, sobald sich der
Katalog ändert.

**Aufwand** klein.

#### 13 · Urlaub: Giess-Zettel jetzt, Stellvertreter später

**Situation.** „Ich bin zwei Wochen weg, gebe der Nachbarin einen Zettel — und
sehe bei der Rückkehr, ob das Hochbeet je unter 25 % fiel."

**Daten und Anknüpfung.** Datumsbereich „abwesend" → Pushes pausieren (eine
Kategorie, Idee 7), Aufgaben nicht als überfällig anmahnen; ein druckbarer
Zettel aus `gsGetDueTasks` (Pflanze, Ort, Intervall, zuletzt). Die
Rückkehr-Bilanz aus Messwerten gibt es **nur mit Gerät** — sonst „nicht
prüfbar". Ein echter Stellvertreter-Zugang braucht Share-Token und RLS;
`garden_members` **existiert nicht** (nur eine Erwähnung im Changelog v23.74).

**Stufe** 0 (Zettel, Pause) / 2 (Stellvertreter). **Prüfbar ohne Hardware:**
Abwesenheit gesetzt → `gsGetDueTasks` liefert weiter, die Glocke schweigt,
der Zettel nennt alle fälligen Pflanzen beider Listen.

**Die Falle.** Was die Nachbarin giesst, steht nicht in der App → `lastDone`
bleibt alt. Deshalb **pausieren statt fälschen** (KALENDER-V1 §7 Regel 7).

**Aufwand** mittel / gross.

#### 14 · Der Firmware-Vertrag als geteilte Regeldatei

**Nutzen.** Ein Gerät nach drei Tagen Funkloch liefert nach — ohne Dubletten,
ohne Alarm über die Vergangenheit, und mit einer Uhr, die es nicht hat.

**Daten und Anknüpfung.** `docs/GERAETE-VERTRAG.md` gibt es noch nicht; das
JSON aus §3.1 ist die einzige Fassung. Drei Ergänzungen, alle aus dem Schema
ableitbar:

- **Die Uhr.** Primärschlüssel `(device_id, metric, ts)` plus
  `on conflict do nothing` heisst: ein ESP32 ohne NTP schickt `ts = 1970`, die
  **erste** Zeile überlebt, alle weiteren werden **lautlos verworfen** —
  §9 Regel 2 („nie verwerfen"), gebrochen vom eigenen Primärschlüssel. Vertrag:
  das Gerät sendet `ts` **oder** `age_s` (Alter relativ zum Senden) und eine
  Laufnummer `seq`; der Server prüft Plausibilität (vor 2024 oder mehr als
  5 Minuten in der Zukunft → `ts = received_at − age_s`, das Original nach
  `raw.device_ts`, `raw.clock = 'untrusted'`), und **jede Antwort trägt
  `server_time`** — ein Arme-Leute-NTP, das für Batteriegeräte genügt.
- **Batch und Idempotenz.** Bis N Werte je Aufruf; Dubletten fängt der
  Primärschlüssel; die Antwort nennt `accepted` und `duplicates` **getrennt**
  (§3.1 kennt heute `accepted` · `rejected` · `commands`) und `next_contact_s` (Idee 16).
  Rate-Limit **je Aufruf, nicht je Wert** — 300 gepufferte Werte sind ein
  Aufruf.
- **Signatur.** Über TLS reicht das Bearer-Token; HMAC mit Nonce scheitert
  genau an der falschen Uhr. HMAC erst für MQTT oder unverschlüsselte
  Bridges (Vorbild: `stripe-webhook`, Konstantzeit-Vergleich, 5-Minuten-
  Fenster).

Und der Alarm-Cron filtert nach `received_at`, nicht `ts` — sonst feuert eine
Nachlieferung, und `cooldown` verschluckt danach den echten Alarm.

**Stufe** 1. **Prüfbar ohne Hardware — mit einem Kunstgriff:** Deno ist in
dieser Umgebung **nicht** installiert, die Edge-Function selbst läuft hier
nicht. Die Regeln (Validierung, Uhr, Qualität, Befehle) gehören deshalb in
ein ESM-Modul `supabase/functions/_shared/ingest_regeln.js`, das Deno **und**
`node scripts/ingest_check.js` importieren — je Fall ein guter und ein
schlechter Batch, wie `planer_check`: Batch mit `ts = 1970` → angenommen,
`raw.clock = 'untrusted'`; Batch zweimal → `accepted` einmal, `duplicates`
einmal; nachgelieferte alte Stunde unter der Schwelle → **kein** Alarm.
`verify_jwt = false` mit eigener Geheimnis-Prüfung hat Vorbilder
(`key-health-check` dokumentiert es im Kopf, `engagement-push-checker` prüft
denselben `x-cron-secret`); `fn_check_rate_limit` liegt im Repo
(`v29_34_rate_limit_wiring_and_orphan_gc.sql`, für `service_role` freigegeben
in `v29_36`) — der Bericht hatte das umgekehrt behauptet.

**Die Falle.** Replay ist durch den Primärschlüssel harmlos. **Die falsche Uhr
ist der echte Datenverlust** — und sie fällt nicht auf, weil `do nothing`
keine Fehlermeldung erzeugt. **Vermutung** (Hardware unbekannt):
Batteriegeräte ohne RTC senden `ts` relativ oder ab 1970; ob Fernandos erstes
Gerät eine Uhr hat, ist Frage 11.4.

**Aufwand** mittel.

#### 15 · Geräte-Identität ab Werk und Claim-Code-Pairing

**Nutzen.** Ein verkauftes Gerät hat eine Identität, **bevor** es ein Konto
hat; das Konto kommt durch einen kurzen Code dazu — nicht durch ein
32-Byte-Token, das jemand abtippt.

**Daten und Anknüpfung.** §3.2 lässt die **App** das Token erzeugen und ans
Gerät übergeben — richtig für ein DIY-ESP32, falsch für ein gefertigtes
Produkt ohne Kamera und ohne Bluetooth auf iOS. Vorschlag: **zwei
Geheimnisse.** (a) Ein Werksgeheimnis je Gerät im Flash, der Hash serverseitig
in `device_identities` (`serial`, `model`, `hw_rev`, `secret_hash`,
`claimed_by`). (b) Beim ersten Kontakt tauscht das Gerät (a) gegen ein
**rotierbares** Token (`devices.token_hash`, wie heute). QR auf Gerät **und**
Verpackung: `web+greenscan://pair/<serial>/<claim>` — der Protokoll-Handler
steht im Manifest (`/?action=%s`), aber **niemand liest `action`**
(`gsHandleShortcutUrl` kennt nur `screen` und `signup`). Claim nur
angemeldet; „verbunden" erst nach dem ersten Batch (§3.2 Regel 3 bleibt).
**Verkauf und Übergabe:** „Gerät freigeben" setzt `user_id = null`, rotiert
das Token, lässt die Messwerte beim Altbesitzer (revDSG); neuer Claim mit
demselben Werksgeheimnis. **Fehlt in der Migration:** `serial`, `model`,
`claim_code`, `token_rotated_at`, `released_at`; `kind` ist ohne CHECK.

**Stufe** 1. **Prüfbar ohne Hardware:** Playwright mit gestelltem `sbFetch`
(Muster `save_check` SERVER_WEGE): Claim abgelehnt / leer / bestätigt;
Freigabe → Token-Hash geändert, Messwerte bleiben. Deep-Link-Fall in
`wiring_check` Richtung 5 (`action` wird gelesen).

**Die Falle.** Steht das Token auf der Verpackung, hat der Ladenmitarbeiter
den Garten. Steht nur der Claim-Code darauf, muss ein Claim **zusätzlich**
den Erstkontakt des Geräts verlangen — **Vermutung:** beides zusammen reicht
gegen Verpackungs-Fotos; ein Sicherheits-Review vor dem Verkauf ist Pflicht.

**Aufwand** mittel–gross.

#### 16 · Stille und Batterie: Vorgaberegeln und der Cron `device-alerts`

**Nutzen.** Batterie leer heisst nicht mehr „dem Garten geht es gut".

**Daten und Anknüpfung.** Vorhanden: `fn_devices_mark_lost()` — definiert,
**von keinem Cron aufgerufen** (geplant ist nur `device-readings-prune`); die
`stale`-Regel clientseitig; `notifications(kind, link, dedup_key)` und
`GS_NOTIF_ZIELE.sensor_alert`. **Fehlt:** der Cron, `notify_sensor` in
`push_subscriptions` (Muster `notify_frost`), Vorgaberegeln beim Pairing
(`stale`, `battery below 15`) — und `expected_by = received_at +
3 · next_contact_s` statt einem festen `interval_s`: ein Gerät, das nachts
oder bei schwacher Batterie länger schläft, wäre sonst jede Nacht
„verloren".

**Stufe** 1. **Prüfbar ohne Hardware:** das Frontend mit gestellter Uhr
(`page.clock`, wie `kalender_check`); die SQL-Seite ist hier nicht fahrbar
(kein Postgres) — ehrlich als Handgriff für Fernando benannt:
`select fn_devices_mark_lost();` einmal von Hand.

**Die Falle.** Ein Cron, der `interval_s` liest, während das Gerät nach
`next_contact_s` schläft, erzeugt Falschalarme — und Falschalarme werden
abgeschaltet (Idee 7).

**Aufwand** mittel.

#### 17 · Tagesaggregat als Tabelle — sonst gibt es keinen Jahresvergleich

**Nutzen.** „Juli 2027 gegen Juli 2028."

**Der Fund.** `v_device_daily` ist eine **View über `device_readings`**;
`fn_device_readings_prune` löscht Rohwerte nach 400 Tagen — **das Aggregat
verschwindet mit.** §2.3 sagte „Tagesaggregate unbegrenzt"; das Schema hält
es nicht (jetzt in §2.3 vermerkt).

**Daten und Anknüpfung.** Tabelle `device_daily` (`device_id`, `metric`,
`tag`, `min`, `max`, `avg`, `sum`, `n`, `quality_min`), `on conflict
(device_id, metric, tag) do update`, vom Cron **vor** dem Prune gefüllt;
Vorbild `weather_log_per_garden` (UNIQUE `user_id, date`).

**Stufe** 1 (Schema jetzt, in dieselbe Migration). **Prüfbar ohne Hardware:**
als SQL — zweimal aggregieren ergibt dieselbe Zeile; im Client mit gestellten
Tagesreihen in „Mein Naturjahr".

**Die Falle.** `n` und `quality_min` je Tag mitführen — ein Mittel aus 2
Werten ist nicht eines aus 48. Bis zwei Jahre da sind, zeigt die Ansicht
„ab 2028 vergleichbar", keine leere Kurve.

**Aufwand** klein (SQL) / mittel (Ansicht).

#### 18 · Firmware-Kanal

**Daten und Anknüpfung.** `devices.firmware` ist ein Textfeld; es gibt keine
`firmware_releases` (`model`, `version`, `channel stable/beta`, `url`,
`sha256`, `min_from`), keinen Ort für Binaries (nicht ins Git; ein
Storage-Bucket — `/assets/*` ist `immutable` gecacht) und keine Antwortzeile
`firmware: {version, url, sha256}` im Ingest. Das Gerät meldet seine Version
bei jedem Kontakt, der Server schreibt sie — nie umgekehrt.

**Stufe** 2. **Prüfbar ohne Hardware:** das Regel-Modul aus Idee 14 — die
Antwort enthält ein Update nur bei `version < latest` im Kanal des Geräts.

**Die Falle.** Unsigniertes OTA ist fremder Code im Garten. Die
Signaturprüfung gehört in die Firmware; der Server liefert nur Hash und
Signatur.

**Aufwand** mittel.

#### 19 · Der Transport-Entscheid gegen `_headers`

**Daten und Anknüpfung.** `bluetooth` und `serial` fehlen in der
`Permissions-Policy` → Standard `self`, Web Bluetooth ist **erlaubt**;
`usb=()` ist gesperrt. Aber: **iOS hat kein Web Bluetooth** (das alte Modal
verweist selbst auf „Chrome/Edge auf Android oder Desktop"), und die CSP (`connect-src` ohne `http://`-Eintrag,
`upgrade-insecure-requests`) macht ein SoftAP-Captive-Portal
(`http://192.168.4.1`) **aus der PWA heraus unmöglich**. Folge: das
Provisioning geschieht **ausserhalb** der PWA — ein Portal im Browser-Tab,
oder BLE nur auf Android/Desktop. **Vermutung:** der Improv-Wi-Fi-Standard ist
der einfachste bewährte Weg für ESP32. Deshalb gehört der Claim-Code (Idee
15) auf den Server, nicht in den Transport. Eine **MQTT-Bridge nur
serverseitig** (Broker → `device-ingest`), nie im Browser (`wss://` nur
`*.supabase.co`).

**Stufe** 2 — der Entscheid ist klein, der Bau gross. **Prüfbar ohne
Hardware:** `navigator.bluetooth` stellen wie `getUserMedia` in
`kamera_check`; Fall „iOS → sagt es und zeigt den Portal-Weg".

**Die Falle.** `_headers` gilt auf **beiden** Hostern (CLAUDE.md §2.1); eine
Freigabe von `usb` oder ein `http://`-Eintrag in `connect-src` braucht eine
Begründung in der Datei, wie bei `camera=(self)`.

#### 20 · Befehle mit Ablauf und Sicherheitsgrenze

**Daten und Anknüpfung.** `device_commands` hat `attempts`, aber kein
`expires_at` und keine Idempotenz je Befehl: ein „Ventil auf" von gestern
darf nicht heute ausgeführt werden. Antwort-`commands` tragen `id` und
`expires_at`; das Ack nennt dieselbe `id`. Ein Ventil braucht `max_on_s` und
ein Fail-safe-Zu **in der Firmware**, nicht im Server.

**Stufe** 3. **Prüfbar ohne Hardware:** das Regel-Modul — abgelaufen →
`failed`, nie gesendet.

**Die Falle.** Wasser läuft, weil ein Befehl im Funkloch hing.

**Aufwand** mittel.

#### 21 · Ein Gerät in den Beispieldaten

**Der Fund.** `scripts/_seed.js` kennt weder `gs_geraete` noch
`gs_messwerte`. Damit vermisst **jeder** Prüfstand ausser `sensor_check` ein
leeres Dashboard — `contrast_check` öffnet „Messwerte" über den Öffner und
misst den Leerzustand, `a11y_check` sieht keine Kachel, `render_check` keinen
Verlauf. Dieselbe Falle wie v31.46 (leere Pflanzenliste) und v32.46
(Pflanzen ohne Aufgaben): **falsche Beispieldaten verdecken echte Fehler und
melden dabei grün.**

**Was zu tun ist.** Ein Gerät `kind:'manual'` mit sieben Tagen
`soil_moisture` und `air_temp`, eine Regel (verletzt), ein Wert mit
`quality 1` — im Seed, nicht in den einzelnen Prüfständen. Dazu ein
Textersatz für den Canvas: `role="img"` und `aria-label` sind da, aber das
Label nennt nur „Verlauf Bodenfeuchte · Gerät", nicht Minimum, Maximum und
letzten Wert — für einen Screenreader ist das Diagramm damit ein Bild ohne
Inhalt.

**Stufe** 0. **Prüfbar:** die Zahl der vermessenen Elemente im Fenster
„Messwerte" steigt (die Bezugsgrösse, CLAUDE.md §7.1 zu v32.21). **Aufwand**
klein.

#### 22 · Katalog-Labels in vier Sprachen

**Der Fund.** `metric_catalog` hat `label_de` · `label_fr` · `label_en` (und
Platz für `label_it`); die App liest an 24 Stellen **nur `label_de`**. Und
weil der Katalog eine Datenliste ist, sieht `i18n_check` ihn nicht — dieselbe
Antwort wie bei `MENU_ITEMS` und den Tour-Karten: **Datenlisten werden dort
ausdrücklich eingetragen.**

**Was zu tun ist.** `_gsMetricLabel(k)` liest `label_<lang>` mit Rückfall
auf Deutsch (eine Funktion, kein `if` je Sprache), und `i18n_check` bekommt
den Katalog in seine Liste. Das Gleiche für die Gerätearten
(`GS_GERAET_ARTEN.label`).

**Stufe** 0. **Prüfbar:** `i18n_check` mit untergeschobenem Sprachpaket →
die Kachel zeigt das französische Label; ohne → das deutsche, nie den
Schlüssel. **Aufwand** klein.

#### 23 · Kalibrierung als Daten

**Der Fund.** Die alte Schicht kannte je Sensor eine „Kalibration"
(Release-Notiz v23.5x), und die App hat für Licht eine Mehrpunkt-Kalibrierung
(v24.x, `Lichtmessung 2.0`). Das neue Schema hat **nichts** davon — kein
Offset, kein Faktor, kein Datum. Ein kapazitiver Feuchtesensor liefert aber
Rohwerte, die erst mit „trocken = 3200, nass = 1400" zu Prozent werden — und
diese zwei Zahlen sind je Gerät verschieden (Idee 5).

**Was zu tun ist.** `devices.capabilities.calibration[metric] = {offset,
scale, at}` — im Client angewandt **beim Anzeigen**, nie beim Speichern
(§9 Regel 2: der Rohwert bleibt; `raw` trägt ihn ohnehin). Zwei-Punkt-Assistent
im Dashboard („Sensor in Wasser halten — jetzt in trockene Erde"). Drift wird
sichtbar, wenn der Rohwert eines Geräts über Wochen aus dem kalibrierten
Bereich wandert — eine Regel wie jede andere (`op:'below'` auf den Rohwert).

**Stufe** 1 (Schema in dieselbe Migration, Anzeige jetzt). **Prüfbar ohne
Hardware:** ein Gerät mit `scale 0.5` → die Kachel zeigt die Hälfte, der
gespeicherte Wert bleibt. **Aufwand** klein–mittel.

#### 24 · Der Planer rechnet mit gemessenem Regen

**Der Fund.** `_gsPlanWasser` (Planer V3, Wasserbilanz über 14 Tage) liest
`_gsPP.weather` — die **Prognose**. Mit Idee 3 gibt es gemessenen Regen als
`rain`-Werte des Wetter-Geräts und mit einem Bodenstab die Feuchte selbst.

**Was zu tun ist.** Die Bilanz nimmt für die Vergangenheit die Messung, für
die Zukunft die Prognose — und **sagt es** („7 mm gemessen, 12 mm
angekündigt"). Mit Bodenfeuchte wird aus der Bilanz eine Beobachtung: „das
Beet war nie unter 30 %, die Bilanz hat recht".

**Stufe** 0 (Regen aus dem Zwischenspeicher) / 1 (Feuchte). **Prüfbar:**
`planer_check` mit gestellten `rain`-Werten → die Anzeige nennt beide
Zahlen mit Quelle. **Aufwand** mittel.

#### 25 · Vom Scan zum Gerät

**Der Fund.** `gsTwinAdopt` übernimmt gescannte Pflanzen in `myPlants` mit
vollem Aufgabenplan; `devices.plant_id` verknüpft ein Gerät mit einer
Pflanze. Zwischen beiden gibt es keinen Weg: wer eine Pflanze scannt und
einen Bodenstab daneben steckt, verknüpft sie von Hand im Dashboard.

**Was zu tun ist.** Beim Übernehmen (und in der Pflanzenkarte) ein Angebot
„Gerät zuordnen" mit der Liste der Geräte **ohne** `plant_id` im selben
Garten; Idee 5 liefert im selben Schritt die Schwellen-Vorlage, wenn die
Art eine trägt.

**Stufe** 1 (braucht ein Gerät, das nicht die Person ist). **Prüfbar ohne
Hardware:** Übernahme mit einem `manual`-Gerät ohne Pflanze → das Angebot
erscheint; mit zugeordnetem Gerät → nicht. **Aufwand** klein.

### 11.2 · Regeln, die aus den Ideen folgen (Fortsetzung von §9)

11. **Messen ist kein Erledigen.** Kein Messwert setzt `lastDone`; ein Sensor
    liefert eine Aussage mit drei Zuständen und einer Zahl.
12. **Eine Vorhersage ist kein Messwert.** Zukunftsstunden werden nie
    eingetragen; modellierte Werte tragen ihre Quelle in `raw.source`.
13. **Der Deckel darf nur wegwerfen, wovon es eine Kopie gibt.** Hochgeladene
    Werte zuerst; der Rest nur mit Archiv und Hinweis (v32.51).
14. **Eine Uhr, die niemand prüft, ist geraten.** Gerätezeit und Serverzeit
    beide speichern (§9 Regel 8) — und ein Primärschlüssel darf die Regel
    „nie verwerfen" nicht unterlaufen.
15. **Nie eine globale Feuchte-Schwelle.** Prozentwerte sind sensorabhängig;
    Schwellen kommen aus den Artendaten (Licht, Bodentemperatur, pH) oder aus
    den eigenen Sprüngen.
16. **Mehrere Geräte am selben Ort: nicht mitteln.** Das vorsichtigste
    Gerät entscheidet und wird genannt (`_gsVorsichtigste`).
17. **Eine Meldung je Kategorie und Tag** — lokal wie auf dem Server. Was
    öfter kommt, wird abgeschaltet, und Abgeschaltetes ist Stille.
18. **Ein Feld, das niemand liest, ist keine Vorbereitung.**
    `device_rules.action`, `gs_metric_catalog`, der `action`-Parameter des
    Protokoll-Handlers, `opts.brain` — vier Stellen, die etwas versprachen.
    Jede neue Vorbereitung braucht den Leser **im selben Commit** oder einen
    Prüfstand-Fall, der ihn anmahnt.

### 11.3 · Was v32.51 davon schon getan hat

| Reparatur | Idee | Prüfstand |
|---|---|---|
| Der Regen-Hinweis aus v31.84 erschien für **keine** Pflanze: `gsPflanzeDraussen` las `p.location`, ein Feld, das nie jemand schreibt. Jetzt beantwortet die Gartenart die Frage (`GS_GARTEN_ARTEN.unter_glas`) | 3, 4 | `kalender_check` „Ernte und Regen": mit 8 mm im Zwischenspeicher trägt die Zucchini (Balkon) den Hinweis, das Basilikum (Küchenfenster) nicht, der Tagesplan zeigt „8 mm Regen heute" |
| `GS_NOTIF_ZIELE.sensor_alert` stand zweimal im Objekt | 16 | `wiring_check` |
| Das Backup nimmt `gs_geraete` · `gs_geraete_regeln` · `gs_messwerte` mit (Version 16) und sagt bei vollem Speicher, was nicht gesichert wurde | 12 | `sensor_check` „Backup" |
| Der Deckel der Messwerte wirft zuerst weg, was hochgeladen ist | 11 | `sensor_check` „Deckel": 2'011 → 2'000, alle zehn ältesten Handmessungen ohne Kopie bleiben |

Gegenprobe je Reparatur: zurückgebaut → der Fall rot, mit den echten Zahlen
(„der Eintrag trägt null", „noch 0 da", „im Backup fehlen: geraete,
geraeteRegeln, messwerte").

### 11.3a · Was v32.52 gebaut hat (Ideen 2 · 3 · 11 · 21)

| Gebaut | Idee | Was der Prüfstand festhält |
|---|---|---|
| **Ein Weg hinein** — `_gsMesswerteAnhaengen(g, liste)` nimmt einen Wert wie hundert, liest und schreibt **einmal**, hält die Liste nach `ts` sortiert (sonst nähme der Deckel eine Nachlieferung für den jüngsten Wert) und sperrt Dubletten auf `(geraet_id, metric, ts)` — derselbe Schlüssel wie der Primärschlüssel in `device_readings`. Ein Wert **ohne** Zeitangabe ist eine Messung von jetzt und immer neu; kollidiert „jetzt" (gestellte Uhr), rückt er eine Millisekunde weiter. Neue Geräte und Regeln bekommen eine UUID (`_gsNeueId`); `ger_…`-Bestände bleiben | 11 | `sensor_check` „Dublette": zweimal → 1 Datensatz, die Antwort sagt „doppelt", anderer Zeitpunkt → 2, Liste chronologisch, Ids UUID |
| **Wetter als Gerät** — `gsWetterGeraetAbgleich()` macht aus dem Open-Meteo-Zwischenspeicher ein Gerät `kind:'weather'` („Wetterdienst · Ort") mit `air_temp` und `rain` je Stunde, **nur bis jetzt**, sieben Tage lokal (`GS_WETTER_GERAET_TAGE`; ältere Wetterwerte werden gelöscht — abgeleitet, nicht erhoben, das Tagesarchiv ist `weather_log_per_garden`), läuft nach jedem Wetterabruf und beim Öffnen von „Messwerte". Der Wetterdienst steht nicht im Eintrags-Formular und erzeugt kein Tages-Ereignis `messung` (der Regen hat seines). Wer das Gerät entfernt, will es nicht (`gs_wetter_geraet_aus`); ein Schalter im Dashboard holt es zurück | 3 | `sensor_check` „Wetter als Gerät": 48 + 24 Stunden gestellt → 74 Werte aus 37 Stunden, 11 Zukunftsstunden übersprungen, zweimal = 74 doppelt, Regen-Summe 10 mm, nichts älter als sieben Tage, Kachel im HTML, nicht im Formular, kein `messung`-Ereignis, Schalter funktioniert |
| **Katalog vom Server** — `gsMetricKatalogLaden()` holt `metric_catalog` (sechs Sekunden nach dem Start, angemeldet) und ersetzt `gs_metric_catalog` **nur** bei mindestens drei vollständigen Zeilen; Fehler, leere oder unvollständige Antworten lassen stehen, was da ist. Das Datum steht in `gs_metric_catalog_at` | 2 | `sensor_check` „Katalog": 404 → 11 bleiben, 12 Zeilen → 12 (im Dashboard, Wert angenommen), leer/unvollständig → bleibt |
| **Gerät in den Beispieldaten** — `_seed.js` trägt „Balkon Süd · Erde" mit sieben Tagen Bodenfeuchte (fallend, Regel „unter 25" verletzt), sieben Tagen Lufttemperatur und einem unplausiblen Wert. Jeder Prüfstand vermisst jetzt ein **gefülltes** Dashboard | 21 | `kalender_check` „Ohne Daten" räumt seither auch die Geräte-Schicht — stehen gelassen: „1 Ereignis ohne jede Datengrundlage" |

### 11.3b · Was v32.53 gebaut hat (Idee 4 — die Verbindung aus §6)

| Gebaut | Was der Prüfstand festhält |
|---|---|
| **Regel → Aufgabe.** `gsSensorAufgabenAbgleich()` ist die eine Stelle, die `device_rules.action` liest. Je Pflanze und Aufgabe werden alle Regeln `task:<key>` an ihren Geräten zusammengenommen (`_gsGeraetePflanzen`: `plant_id` zuerst, sonst alle Pflanzungen im Garten): eine verletzt → `tasks.<key>.vorgezogenAuf` (Mitternacht heute, ISO) und `vorgezogenGrund` (Regel, Messwert, Gerät); keine verletzt und alle erfüllt → aufgehoben; nur „nicht prüfbar" → nichts. Läuft nach jedem Eintrag, beim Öffnen des Dashboards, beim Anlegen und Löschen einer Regel. `getDaysUntilDue` hat den vierten Parameter an allen neun Aufrufern: `fällig = max(min(lastDone + Intervall, vorgezogenAuf), snoozedUntil)`, vorgezogen zählt nur nach `lastDone`. **Die Verschiebung der Person gewinnt.** Erledigen hebt auf. Der Eintrag in „Heute zu tun", der Tagesplan, die Glocke und der Kalender (`quelle: 'sensor'`) nennen Gerät und Messwert. Die Server-Sicht bekommt dieselbe Regel: `20260904_plant_tasks_due_vorgezogen.sql` (ersetzt die Sicht aus v32.46, nicht angewandt) | `sensor_check` „Regel → Aufgabe": ohne Werte nichts · 22 % → Monstera heute, Tagesplan nennt Gerät · Garten-Gerät → Zucchini in `gs_plantings` · Verschiebung gewinnt · Erledigen hebt auf · 48 % gibt frei · Regel weg gibt frei. Gegenproben: Vorziehen aus der Rechnung entfernt → „days undefined"; Reihenfolge getauscht → „Verschiebung überstimmt" |
| **Giessen bestätigt sich am Sensor.** `gsGiessBestaetigung(p, ts)`: letzter plausibler Feuchtewert bis 2 h vor dem Abhaken, erster innert 60 Min danach; Δ ≥ 10 → bestätigt, sonst nicht gemerkt; ohne Wert davor/danach oder ohne Gerät → nicht prüfbar (ohne Gerät wird nichts angezeigt — es gibt nichts zu sagen). Mehrere Geräte: das vorsichtigste Urteil zählt und wird genannt. `GS_GIESS_DELTA = 10` ist gesetzt, nicht gemessen. Sichtbar im Kalender (Tagebuch-Ereignis, `sensor` + Grund) und im Pflanzentagebuch. **Kein Messwert verändert eine Aufgabe** | `sensor_check` „Giess-Bestätigung": 21 → 48 (+27) bestätigt · 30 → 33 (+3) nicht gemerkt · ohne Wert danach nicht prüfbar · ohne Gerät nicht prüfbar · Aufgabe unverändert · Kalender und Tagebuch zeigen es. Gegenprobe: Schwelle auf 2 → „+3 bestätigt" |
| **Regel-Formular mit Aktion** — melden · Giessen fällig machen · Kontrolle fällig machen; der Regeltext nennt die Aktion („→ Giessen") | Formular im Dashboard-HTML |
| **Nebenfund im Pflanzentagebuch:** der Lösch-Knopf setzte den Zeitstempel unzitiert in den `onclick` — für ISO-Strings (alle Abhak-Einträge seit v26.51) ein Syntaxfehler, der Knopf war tot; und die Liste sortierte Strings per Subtraktion (NaN). Beides behoben | Gegenprobe: `gsDeleteDiaryEntry('p2',2025-09-01T12:00:00.000Z)` |

Eine Falle beim Bau: Garten-Pflanzungen bekommen ihre Aufgaben beim ersten
Laden mit `lastDone = jetzt` — und „heute erledigt" darf ein Sensor am
selben Tag nicht wieder fällig machen. Der Fall stellt deshalb „gestern
gegossen" her. Was **nicht** gebaut ist: die Zeile „Aufgabe erledigt →
Markierung im Diagramm" aus §6 gibt es seit v32.48 nur über `plant_id`
(Idee 4, `_gsMwVerlaufMalen`); Geräte am Garten bekommen die Marke noch nicht.

### 11.3c · Was v32.54 gebaut hat (Idee 7 — das Meldungs-Budget, lokal)

| Gebaut | Was der Prüfstand festhält (`einstellungen_check`, Fragen 30–33) |
|---|---|
| **Stille-Zeit und Urlaubs-Pause gelten lokal.** `gsNotif.stille(wann)` liest `quietStart` / `quietEnd` / `pauseUntil` aus `gs_push_settings` — dieselbe Regel und dieselben Vorgaben (22–7 Uhr) wie `weather-alert-checker` und `daily-push-checker`. `gsNotif.show` schweigt in der Stille (`letzterGrund()` sagt warum), ausser `dringend` | in der Stille → keine Meldung („stille") · Pause → „pause" · sonst → Meldung. Gegenprobe: Prüfung entfernt → 3 Meldungen statt 1 |
| **Eine Aufgaben-Meldung je Tag.** `scheduleAllNotifications` liest `gsGetDueTasks()` (beide Listen, Regen, Sensor), lässt Pflanzen mit `gs_reminder_prefs.disabled` aus, bündelt „🌱 N Aufgaben fällig · Basilikum giessen · Zucchini giessen 📶" und plant sie über `showKategorie('plant_tasks')` — eine je Tag; fällt der Zeitpunkt in die Stille, wandert er an deren Ende (`stille().bis`) statt zu verschwinden | „🌱 2 Aufgaben fällig": Basilikum · Zucchini, Tomate (stumm) fehlt · zweiter Aufruf: keine (kategorie) · in der Stille: Verzögerung 42 Min, nichts sofort. Gegenprobe: Stummschaltung ignoriert → „3 Aufgaben … Tomate giessen" |
| **Sensor-Alarme als Tageskategorie mit Abkühlzeit.** `gsSensorAlarmeMelden()` nach jedem Eintrag: verletzte `notify`-Regeln → eine Meldung `sensor_alert` am Tag; je Regel gilt `cooldown_minutes` (720, seit v32.48 in jeder Regel, bis v32.53 von niemandem gelesen) über `zuletzt_gemeldet` | 22 % → eine · 20 % → keine (Tag) · Kategorie gelöscht, 19 % → keine (Abkühlzeit) · 13 h später → zweite. Gegenprobe: Abkühlzeit entfernt → zweite Meldung am selben Tag |
| **Wochenzähler** in den Push-Einstellungen (`#push-wochenzaehler`) aus `gs_notif_log` — was **dieses Gerät** gezeigt hat; der Server-Zähler (`push_send_log`) bleibt Idee 7 (e) | „Diese Woche: 4 lokale Meldungen auf diesem Gerät." |

### 11.3d · Was v32.55 gebaut hat (Ideen 5 und 22)

| Gebaut | Was der Prüfstand festhält (`sensor_check`) |
|---|---|
| **Vorlagen nur, wo eine Zahl steht.** `gsSchwellwertVorlagen(g)` sammelt für die Pflanzen des Geräts (`_gsGeraetePflanzen`, höchstens drei) aus drei Quellen, jede mit Namen im Grund: Artenliste (`lightMin` / `lightMax`, Treffer über `_gsNormLat` auf `species`), Kulturdaten (`PLANT_DB.bodentemp`, Treffer über Name, Name ± „n", `latName`), eigener Verlauf (Spanne seit dem ersten plausiblen Wert ≥ 14 Tage, mindestens 10 Werte im Fenster → Tief und Hoch; nie für `sum`-Grössen und Batterie). **Nie Bodenfeuchte aus Artendaten.** Im Regel-Formular als Knöpfe mit Quelle im `title`; Antippen füllt Messgrösse, Bedingung, Schwelle — angelegt wird von Hand. Ohne Zahl: „keine Empfehlung hinterlegt — nach 14 Tagen Werten schlägt die App dein Tief und Hoch vor" | Monstera: Licht unter 200 / über 2000 (HP001) · Zucchini: Bodentemperatur unter 12 (Kulturdaten) · Bärlauch: nichts · 15 Tage Werte → 14-Tage-Tief 21 (als Zahl) · 7 Tage → nichts · Antippen füllt, legt nicht an · „keine Empfehlung" im HTML. Gegenproben: Vorlage legt selbst an → rot; Spanne auf 7 Tage → „7-Tage-Tief 28" rot |
| **Eine Funktion für den Namen einer Messgrösse.** `_gsMetricLabel(k)`: `label_<lang>` aus der Tabelle, sonst `_t('metric_<key>', label_de)` aus der Sprachschicht (elf Schlüssel in `GS_I18N_JS_STRINGS`), sonst Deutsch — an allen acht Lesestellen (Dashboard, Kacheln, Reiter, Canvas-`aria-label`, Regeltext, Kalender). `_gsGeraetArt` gibt übersetzbare Labels (`mw_art_<kind>`). `i18n_check` kennt `GS_METRIC_KATALOG_START` als Datenliste mit Präfix `metric_` | de: Bodenfeuchte · fr aus der Tabelle: Humidité du sol · fr aus der Sprachschicht: Température de l'air · Rückfall: Licht · im Dashboard. Gegenprobe: Spalte ignoriert → „Bodenfeuchte" statt „Humidité du sol" |

### 11.3e · Was v32.56 gebaut hat (Ideen 6 und 10)

| Gebaut | Was der Prüfstand festhält |
|---|---|
| **Lina kennt die Zahlen.** `gsLinaZahlen()` baut den Block für `gsLinaContext()`: fällige Aufgaben (mit „seit N Tagen", `[Sensor]`), verletzte Regeln (höchstens drei, mit Grund), je Gerät (höchstens vier, drei Grössen) der letzte **plausible** Wert als **Rohwert** mit Zeit, Anzahl der Werte in sieben Tagen und Lücke seit dem letzten; unplausible letzte Werte werden als solche genannt; ohne Daten steht „keine" statt Stille. Deckel 700 Zeichen. Dazu die Anweisung: nur aus dem Kontext zitieren, fehlende Werte nennen, nichts schätzen | `sensor_check` „Lina": Gerät, Wert (22 %), Zeit, „6 Werte in 7 Tagen", „letzter Wert vor 28 h", Alarm, Fälligkeit im Kontext; **jede** Prozent-/Grad-Zahl der Messwert-Zeile ist ein gespeicherter plausibler Wert; ohne Daten „keine". Gegenprobe: Block entfernt → rot. Eine Falle beim Bau: die gerundete Anzeige (`_gsMwFmt`: 31.5 → 32) stand im Kontext — der Prüfstand hat sie als Zahl ohne Datensatz gemeldet; jetzt Rohwerte |
| **Frost aus der Vorhersage.** Abschnitt 5b in `gsKalenderEreignisse`: Tagesminimum ≤ 2 °C (`GS_FROST_GRENZE_C`, dieselbe Grenze wie der Frost-Tipp der Startseite und der Server-Push) aus `gs_weather_cache.daily` → Ereignis `wetter` „❄️ Frost möglich — Tiefstwert 1.2 °C" für heute und die nächsten Tage, `status: 'info'`, Grund mit Quelle, Standort, Alter der Vorhersage und „kein Messwert". Nie für vergangene Tage | `kalender_check` „Frost": morgen 1.2 °C → ein Ereignis mit Quelle und „Stand vor 2 h", im Tagesblatt; 5 °C → keins; gestern 0 °C → keins; ohne Tageswerte → keins. Gegenprobe: Vergangenheits-Schranke entfernt → zwei Ereignisse |

### 11.3f · Was v32.57 gebaut hat (Ideen 9 und 12)

| Gebaut | Was der Prüfstand festhält (`sensor_check`) |
|---|---|
| **Zwei Standorte nebeneinander.** Im Dashboard ein Abschnitt „📈 Vergleich": Messgrösse, Gerät A, Gerät B → zwei Linien über `_gsVerlauf` (grün/blau), Legende mit Namen und Zahl der plausiblen Werte, `aria-label` nennt beide Geräte. Zur Wahl stehen **nur** Messgrössen, die mindestens zwei Geräte mit plausiblen Werten haben (`_gsMwVergleichGroessen`). Der Hinweis dazu: „Verschiedene Sensoren messen verschieden — vergleiche den Verlauf, nicht die Zahl." `_gsVerlauf` schreibt `data-reihen` | Bodenfeuchte wählbar, Licht (nur ein Gerät) nicht · 2 Reihen · Legende Süd (7) · Nord (5) · 1105 grüne und 714 blaue Pixel im Canvas · Hinweis da. Gegenprobe: Schwelle auf ein Gerät → „Licht steht zur Auswahl" |
| **Messwerte als CSV.** `gsExportMesswerteCSV()` — Zeitpunkt, Gerät, Gerät-Id, Messgrösse, Schlüssel, Wert, **Einheit**, Qualität (plausibel · ausserhalb des Messbereichs · Gerätefehler), Quelle; chronologisch; dritter Knopf in „Daten exportieren" mit Zahl der Werte und Geräte; liefert den Text zurück, damit der Prüfstand ihn liest | 18 Zeilen für 18 Werte · Kopf mit Einheit · „Balkon Süd · Erde", 22, %, plausibel, hand · 250 als „ausserhalb des Messbereichs" · chronologisch · genau ein Download. Gegenprobe: Einheit leer → rot |

### 11.3g · Was v32.58 gebaut hat (Idee 8)

| Gebaut | Was der Prüfstand festhält (`sensor_check` „Deine Woche") |
|---|---|
| **Karte „Deine Woche"** im Startseiten-Stapel (zweite Karte, `#woche-card`). `gsWochenrueckblick()` liefert Zeilen aus den Daten, die es schon gibt: erledigte Aufgaben der letzten sieben Tage (`gsTagebuchAlle`, beide Listen und Cloud-Spiegel) und heute offene (`gsGetDueTasks`); Tagebuch-Einträge; Regen und Frostnächte aus den **gemessenen** Werten des Wetterdiensts (Quelle steht dabei, „gemessen"); Feuchte-Tief je Gerät mit Zahl der Werte (zwei Geräte); Geräte, die länger als zwei Tage schwiegen. Keine Note, kein Score, kein Vergleich. Ohne Wetterdienst steht „kein Regen- und Frostwert", nicht 0; ohne jede Daten sagt die Karte, wie sie zu Daten kommt. Rendert beim Bau des Stapels, nach jedem Tagesplan und nach jedem Messwert | Aufgaben-Zeile im Format „N erledigt · M heute offen" · ohne Wetterdienst „kein Wert" · Süd: nie unter 22 % (6 Werte) · mit gestelltem Wetterdienst „10 mm Regen · 1 Frostnacht (Wetterdienst · Zürich, gemessen)" · „Balkon Nord · Erde schwieg 4 Tage" · ohne Daten „Noch keine Woche mit Daten" mit einer Zeile. Gegenprobe: „kein Wetterdienst" durch „0 mm Regen" ersetzt → rot |

### 11.3h · Was v32.59 gebaut hat (Idee 13, Stufe 0)

| Gebaut | Was der Prüfstand festhält (`kalender_check` „Giess-Zettel") |
|---|---|
| **Der Giess-Zettel.** `gsGiessZettel(von, bis)` listet jede Fälligkeit im Fenster aus **beiden** Pflanzenlisten — aus derselben Rechnung wie „Heute zu tun" (`_gsTaskDays`), dann Intervall für Intervall weiter; überfällige Aufgaben stehen am ersten Tag und heissen „schon fällig". Das Fenster (`gsGiessZettelFenster`) sind die Stillen Tage (`gs_push_settings.pauseUntil`, die es seit v28.11 gibt und die seit v32.54 auch lokal schweigen), sonst 14 Tage — und der Zettel sagt, woher sein Fenster kommt. Ort: Standort der Zimmerpflanze, Gartenname der Pflanzung. Fenster mit Tabelle (`gsGiessZettelOeffnen`), Druckansicht mit Abhak-Kästchen in einem eigenen Fenster (`gsGiessZettelDrucken`, liefert das HTML zurück). Zugänge: Knopf in „Stille Tage" (Push-Einstellungen) und die Menü-Suche („Giess-Zettel", Tags urlaub · ferien · abwesend · nachbar). **Was die Nachbarin giesst, steht nicht in der App** — `lastDone` bleibt, die Pause schweigt, nichts wird gefälscht | 24 Einträge in 10 Tagen · Basilikum an Tag 0/3/6/9, der erste „schon fällig" · Tomate sechsmal · Zucchini aus dem Garten mit „Balkon Süd" als Ort · Küchenfenster als Ort der Zimmerpflanze · sortiert · Fenster zeigt alle 24 · Druck 24 Zeilen (gestelltes `window.open`) · ohne Pause 14 Tage. Gegenproben: nur `myPlants` → „Zucchini fehlt"; keine Wiederholung → nur ein Basilikum-Termin |

### 11.3i · Was v32.60 gebaut hat (Ideen 24 und 21b)

| Gebaut | Was der Prüfstand festhält |
|---|---|
| **Vorhersage und Messung getrennt.** Der Fund beim Bau: `totalPrecip14` kommt aus `forecast_days=14` — eine **Vorhersage**, die die Wasserbilanz des Planers bis v32.59 „gemessener Regen" nannte. `_gsPlanWasser` rechnet jetzt mit der Prognose der nächsten 7 Tage (`daily.precip`, beginnt heute; 1 mm auf 1 m² = 1 l) und nennt daneben die Messung der letzten 7 Tage aus dem Wetterdienst-Gerät (`rain`, nur Stunden bis jetzt, plausibel). Ohne Gerät: „Kein gemessener Wert — kein Wetterdienst als Gerät", nicht 0. Ohne Vorhersage: keine Bilanz (`zusatz: null`, Zustand „–"), aber die Messung. `plan._wasser` trägt `prognose`, `gemessen`, `zusatz`; `regen`/`mm` bleiben für Altleser | `planer_check` „R10": Prognose 12 mm → 144 l aus 7 Tagen (nicht 72/2 aus 14) · ohne Gerät „Kein gemessener Wert" · mit Gerät 7 mm → 84 l, ein 9 Tage alter Wert zählt nicht · guter Plan (20 l) „das reicht", schlechter (200 l) „56 l bleiben an dir" · ohne Vorhersage „Keine Vorhersage im Zwischenspeicher", Messung bleibt. Gegenprobe: „kein Wert" durch „0 mm" ersetzt → rot |
| **Das Diagramm sagt, was es zeigt.** `_gsMwVerlaufMalen` schreibt Tief, Hoch und letzten Wert mit Datum in das `aria-label` des Canvas (plausible Werte; ohne: „kein plausibler Wert"); der Vergleich nennt je Reihe Anzahl, Tief und Hoch | `sensor_check` „Diagramm-Text": „Bodenfeuchte · Balkon Süd · Erde · 8 Werte · Tief 22 % · Hoch 52 % · zuletzt 22 % am 31.08." · Vergleich „(7 Werte, Tief 22, Hoch 52) und (2 Werte, Tief 40, Hoch 45)". Gegenprobe: Zusatz entfernt → rot |

### 11.3j · Stufe 1 vorbereitet, ohne Gerät (05.09.2026 — Ideen 14, 16, 17, Vertrag für 20)

Alles, was sich ohne Gerät **rechnen** und damit prüfen lässt, liegt im Repo.
Was nicht geprüft ist, steht dabei — dieselbe Ehrlichkeit wie beim Rest.

| Gebaut | Geprüft | Nicht geprüft (braucht Deno, Datenbank oder Gerät) |
|---|---|---|
| **`docs/GERAETE-VERTRAG.md`** — Vertrag v1: Anfrage, Felder (`age_s` für Geräte ohne Uhr, `ts` nur mit Uhr, `seq`, `error`), Grenzen (500 je Aufruf, `interval_s / 2`), Antwort (`accepted` und `duplicates` getrennt, `clock`, `server_time`, `next_contact_s`, `commands`, `firmware: null`), Fehlertabelle, Sicherheit, Befehle mit Ablauf, ESP32-Pseudocode | — (Text) | ob eine Firmware ihn so umsetzt |
| **`supabase/functions/_shared/ingest_regeln.mjs`** — die Rechnung des Empfängers als reines ESM-Modul: `pruefeBatch` (Version, Pause, Grenze, Katalog, Zahl, **Uhr**: `age_s` → `server_time − age_s`, `ts` vor 2024 oder > 5 Min voraus → `received_at`, Original in `raw.device_ts`, `clock: untrusted`; **Qualität** 2/1/0, nie verwerfen; Dubletten im Batch), `rateLimit` (je Aufruf), `naechsterKontaktS`, `erwartetBis` (3 Kontakte), `befehleAufbereiten` (abgelaufen → failed, nie gesendet; 3 Versuche), `acksAuswerten`, `antwort` | **`node scripts/ingest_check.js`** — 11 Fälle, jede Regel mit gutem und schlechtem Batch. Drei Gegenproben rot: Uhr nicht ersetzt → „1970 wird eingefügt"; Dubletten nicht gezählt → „rows 3, dupl 0"; abgelaufene Befehle gesendet → c2 in `senden` | — |
| **`supabase/functions/device-ingest/index.ts`** — der Empfänger (Deno): Token-Hash → Gerät, Rate-Limit, Katalog, `pruefeBatch`, Insert mit `ignoreDuplicates` (der Primärschlüssel hält die Idempotenz), `paired_at` beim ersten Wert, `capabilities.expected_by`, Firmware-Feld, Acks und Befehle, Antwort aus dem Modul | die Rechnung (oben) | **die ganze Funktion** — Deno fehlt hier; Deploy mit `--no-verify-jwt`, dann ein Batch mit `curl` (Vertrag §1) |
| **`supabase/migrations/20260905_device_daily.sql`** — Tabelle `device_daily` (PK Gerät · Messgrösse · Tag, `n`, `quality_min`, `min/max`), `fn_device_daily_aggregate(seit)` idempotent, Cron täglich (3 Tage nach, wegen Nachlieferungen) und montags **vor** dem Prune (alles seit 401 Tagen); RLS nur lesen | — | **die SQL** (kein Postgres hier) — nach dem Anwenden: `select public.fn_device_daily_aggregate(null);` zweimal, Zeilenzahl gleich |
| **`supabase/migrations/20260905_device_alerts_cron.sql`** — `notify_sensor` in `push_subscriptions` (nur wenn die Live-Tabelle da ist), `fn_devices_mark_lost` liest `expected_by` (sonst 3 × `interval_s`) und liefert die Ids, `fn_device_alerts()` alle 15 Min: verstummt → `lost` + Meldung `sensor_alert` einmal je Tag; verletzte `notify`-Regeln → Meldung mit `for_minutes`, `cooldown_minutes` (`last_fired_at`), `dedup_key` je Tag, Link `#geraet-<id>` | **der Anker** — v32.61: `geraet` in `GS_ANKER_ARTEN`, `gsAnkerAnspringen` öffnet das Messwerte-Dashboard, wartet auf `id="geraet-<id>"`, hebt die Kachel hervor; entferntes Gerät → Toast + `false` (`sensor_check` „Deep-Link", `wiring_check` Richtung 5) | **die SQL**; der Push dazu: §11.3k (`sensor-push`) — die Annahme vom 05.09., `daily-push-checker` lese `notifications`, war falsch |

Der Anker war beim ersten Bau **ungelesen**: die Migration schrieb
`#geraet-<id>`, die App kannte nur `post` und `comment`, und `wiring_check`
Richtung 5 sah die Art nicht, weil sein Muster sie nicht enthielt — ein Link,
der oben auf der Seite endet, sieht aus wie einer, der funktioniert hat
(dieselbe Klasse wie v32.24). Wer eine neue Anker-Art in einer Migration
oder Edge-Function erzeugt, trägt sie in `GS_ANKER_ARTEN` **und** in das
Muster des Prüfstands ein. Und `_gsAnkerWarten` zählt seit v32.61 Versuche
statt `Date.now()` — mit gestellter Uhr lief die Frist sonst nie ab.

Was der Cron bewusst **nicht** tut: `task:water` und `calendar` — das rechnet
der Client aus denselben Daten (v32.53), und die Server-Sicht kennt das
Vorziehen seit `20260904_plant_tasks_due_vorgezogen.sql`. Zwei Regeln für
eine Frage wären der Fehler aus KALENDER-V1 §1.2.

Nicht gebaut aus Idee 24: Bodenfeuchte in der Bilanz („das Beet war nie
unter 30 %, die Bilanz hat recht") — das braucht einen Bodenstab (Stufe 1).

Nicht gebaut aus Idee 13: die Rückkehr-Bilanz („fiel das Hochbeet je unter
25 %?") — das leistet seit v32.58 die Karte „Deine Woche" für sieben Tage;
ein längeres Fenster braucht die Tagesaggregate (Idee 17). Und der
Stellvertreter-Zugang: `garden_members` existiert nicht (Stufe 2).

Nicht gebaut aus Idee 8: der `weekly_summary`-Push des Servers bekommt
weiterhin nur eine Zahl — die Karte rechnet lokal, der Cron hat diese
Daten nicht (Messwerte liegen in Stufe 0 nur auf dem Gerät).

Nicht gebaut aus Idee 12: die `delete-user`-Liste kennt die fünf neuen
Tabellen weiterhin nicht (Edge-Function, Fernandos Handgriff beim nächsten
Deploy) — `on delete cascade` greift, aber die Liste ist die Doku.

Eine Falle beim Bau: der erste Verlaufs-Filter verlangte, dass der älteste
Wert **im** 14-Tage-Fenster 14 Tage alt sei — das ist nie der Fall, und die
Funktion fand nie eine Vorlage. Der Prüfstand hat es beim ersten Lauf
gemeldet. Nicht gebaut aus Idee 5: `soil_ph` aus `garden_crop_agronomy` (die
Tabelle liegt auf dem Server, nicht im Repo).

Nicht gebaut: `stale` als dringende Ausnahme — in Stufe 0 gibt es keine
Regel, die ohne Meldeintervall prüfbar wäre (Idee 16); und der
Server-Zähler aus `push_send_log`. Neue Schlüssel `gs_notif_log`,
`gs_notif_kat` in `GS_USER_KEYS`.

Nicht gebaut aus Idee 3: `air_humidity` (der Deckel: zwei Grössen × 24 Stunden
× 7 Tage sind 336 Werte neben den Handmessungen — eine dritte Grösse wäre
Platz, den der erste Bodenstab braucht) und der Server-Weg aus
`weather_forecast_cache` (Stufe 1). Aus Idee 2 fehlt der Modell-Katalog
`device_models` — er braucht das erste Gerät (11.4).

### 11.3k · Der Push zum Alarm (06.09.2026 — Idee 16, zweite Hälfte)

**Der Fund, gegen den eigenen Text vom Vortag:** §11.3j schrieb, der Push
komme über `daily-push-checker`, der `notifications` lese. Nachgemessen im
Repo (`grep` über alle Edge-Functions: ein Leser von `notifications`,
`stripe-webhook`) und live, nur lesend (`cron.job`, Spalten von
`notifications` / `push_send_log` / `push_subscriptions`): kein Checker liest
die Inbox. Die Brücke aus v30.80 spiegelt push_send_log → notifications; die
Gegenrichtung gibt es nicht. Ein `sensor_alert` des Crons wäre in der Inbox
gelandet und nie auf dem Telefon — genau der Fall, für den man einen Sensor
kauft: das Beet trocknet aus, während niemand hinsieht.

| Gebaut | Geprüft | Nicht geprüft |
|---|---|---|
| **`supabase/functions/_shared/sensor_push_regeln.mjs`** — `planen` (Fenster 24 h, nur `sensor_alert`, je Meldung und Abonnement höchstens EIN Versuch — der Marker ist das Protokoll, `notify_sensor`, fünf Fehlschläge, Pause, Stille-Zeit mit derselben Rechnung wie daily-push-checker), `nutzlast` (Link mit Anker `#geraet-<id>`, Tag je Gerät), `protokollZeile` / `stummZeile` mit `payload_meta.notification_id` | **`node scripts/sensor_push_check.js`** — 9 Fälle, gut und schlecht je Regel; fünf Gegenproben rot (Dublettensperre, Marker, Brücken-Sperre, Stille-Vorgabe, Cron-Bedingung) | — |
| **`supabase/functions/sensor-push/index.ts`** — der dünne Rand: Inbox-Zeilen der letzten 24 h, Protokoll, Abonnements, `planen`, senden, protokollieren; 410/404 räumt das Abonnement | die Rechnung (oben) | **die Funktion** — kein Deno hier; Deploy `supabase functions deploy sensor-push`, dann `?dry_run=1` mit dem x-cron-secret |
| **`supabase/migrations/20260906_sensor_push.sql`** — die Brücke spiegelt Protokollzeilen mit `notification_id` NICHT (sonst stünde jeder Alarm zweimal in der Inbox); der Cron `device-alerts` ruft `sensor-push` nur, wenn `fn_device_alerts()` etwas NEUES gemeldet hat — die Zähler dort sind seit heute `row_count`, nicht Schleifendurchläufe (20260905 korrigiert) | Sperre und Bedingung stehen im Text — Fall 8 liest die SQL, damit Reparatur und Prüfung dieselbe Regel haben | **die SQL**; nach dem Anwenden: `select count(*) from notifications where kind = 'sensor_alert' and dedup_key like 'pushlog_%'` muss 0 bleiben |
| `delete-user`: die fünf Gerätetabellen in `USER_TABLES` | — | erst nach den Migrationen wirksam; vorher steht „error: relation … does not exist" im Zähler, sonst passiert nichts |

Drei Regeln, die daraus folgen:

- **Stumm ist nicht weg, und stumm wird nicht nachgeholt.** In der Stille-Zeit
  oder Pause wird protokolliert (`suppressed_quiet` / `suppressed_paused`) —
  die Inbox hat die Zeile längst. Ein Alarm von 23:30 um 07:00 als Push wäre
  eine Nachricht über gestern.
- **Ein Push ist ein Ereignis am Abonnement, nicht an der Meldung.** Der
  Marker liegt in `push_send_log` (Meldung + Abonnement), nicht in einer
  neuen Spalte von `notifications` — die Live-Tabelle hat keine, und zwei
  Telefone desselben Kontos bekommen je ihren Push.
- **Ein Cron, der einen HTTP-Aufruf macht, macht ihn nur, wenn es etwas zu
  sagen gibt.** 96 Aufrufe am Tag ins Leere wären der falsche Preis für
  einen Alarm, der meist nicht kommt.

Und die Lehre über den Fund hinaus: **eine Behauptung über einen Weg, den
niemand gegangen ist, braucht die Messung, nicht die Erinnerung.** Der Satz
vom 05.09. klang richtig, weil die Brücke existiert — nur in der anderen
Richtung.

Was für die App-Seite folgt (Stufe 1, nächste Ausgabe): für Geräte, die in
der Cloud liegen, ist der Server die Instanz für Alarme — der lokale
`gsSensorAlarmeMelden` (v32.54) darf dann nur noch `manual` / `weather`
melden, sonst kommt derselbe Alarm zweimal. **Gebaut in v32.62 (§11.3l).**

### 11.3l · Stufe 1 in der App — koppeln und abgleichen (v32.62, 06.09.2026)

Ohne Gerät gebaut, mit gestelltem Server geprüft. Was am Tag des ersten
Geräts noch zu tun ist, steht in `docs/FUER-FERNANDO.md` §6 — die App ist
bereit.

| Gebaut | Geprüft (`sensor_check`, `save_check`) | Nicht geprüft |
|---|---|---|
| **Koppeln** (`gsGeraetKoppeln`): Art `gs_sensor` / `third_party` im Formular; die App erzeugt das Token (32 Byte aus `crypto.getRandomValues`, base64url) und schickt per Upsert in `devices` nur `token_hash` (SHA-256) — mit `user_id`, `kind`, `name`, `capabilities`; das Token steht EINMAL in der Kachel (Kopieren · Fertig), nur im Arbeitsspeicher; „Token neu erzeugen" macht das alte ungültig | Fall „Koppeln": Token 43 Zeichen, der Satz trägt den SHA-256 und nie das Token, `user_id`, UUID; einmal gezeigt, nach „Fertig" weg, nicht im localStorage; 0 Zeilen (RLS) und Ablehnung → nicht gekoppelt, gesagt; „von Hand" → kein Token; abgemeldet → kein Aufruf. `save_check` SERVER_WEGE: Ablehnung · leer · Bestätigung | ob RLS die Zeile annimmt (`own_devices_insert`, `token_hash` schreibbar) — braucht die angewandte Migration |
| **Cloud-Abgleich** (`gsGeraeteCloudAbgleich`): `devices` (Status, `last_seen_at`, `paired_at`, Firmware, `capabilities`) und `device_readings` je Gerät ab SEINEM letzten gelesenen Zeitpunkt (`cloud_bis`, sonst 7 Tage, höchstens 1000 Zeilen) → `_gsMesswerteAnhaengen(g, liste, {quelle:'cloud', pending:false, status_belassen:true})`; die Qualität vom Server bleibt (Gerätefehler 0); höchstens alle 5 Minuten, beim Öffnen des Dashboards und 8 s nach dem Start | Fall „Cloud-Abgleich": 3 Werte als `cloud` / `pending:false`, Qualität 2,1,0; Status, `paired_at`, Firmware, `interval_s` vom Server; zweimal = 3 doppelt, der zweite Lauf liest `ts=gt.<letzter>`; ein zweites, neu gekoppeltes Gerät liest ab seinem eigenen Zeiger und bekommt seine älteren Werte; Drossel; lost / paused / fehlend in der Kachel; Ablehnung ändert nichts | die echten Spaltennamen gegen die angewandte Tabelle |
| **Eine Instanz je Alarm**: `gsSensorAlarmeMelden` lässt Geräte mit `cloud_id` aus — der Server meldet (`sensor-push`, §11.3k) | Fall „Alarm-Instanz": Cloud-Gerät verletzt → keine lokale Meldung; Handgerät verletzt → gemeldet, mit Namen | — |
| Kachel: „☁️ gekoppelt · …", „🔑 noch nicht gekoppelt", „⏸ pausiert", „in der Cloud nicht gefunden"; gekoppelte Geräte stehen nicht im Formular „von Hand"; der Anker `#geraet-<cloud_id>` findet die lokale Kachel | in den drei Fällen aus dem HTML gelesen | — |

Drei Entscheidungen, jede mit Grund:

- **Das Token entsteht in der App, nicht auf dem Server.** §3.2 sagt es so,
  und es braucht keine RPC: `crypto.getRandomValues` ist so gut wie
  `gen_random_bytes`, und der Server sieht das Klartext-Token so nie — auch
  nicht im Log einer Funktion. Der Vertrag (§3) ist entsprechend korrigiert.
- **„Gekoppelt" ist die `cloud_id`, „verbunden" ist `paired_at` vom Server.**
  Die App zeigt „wartet auf den ersten Wert", bis der Server den ersten
  Batch gesehen hat — nie „verbunden" aus einer lokalen Vermutung (§3.2
  Punkt 3). Und `status_belassen` sorgt dafür, dass eine Nachlieferung
  alter Werte ein `lost` vom Server nicht in ein `active` verwandelt.
- **Werte aus der Cloud sind `pending:false`.** Der Deckel (v32.51) wirft
  zuerst weg, wovon es eine Kopie gibt — und die liegt in `device_readings`.
  Eine Handmessung ohne Kopie bleibt weiterhin.

Eine Falle beim Bau, gefunden beim Lesen des eigenen Diffs, nicht vom
Prüfstand: der erste Abgleich las alle Geräte mit EINEM Zeiger (dem
kleinsten `cloud_bis`). Ein zweites, neu gekoppeltes Gerät hätte seine
älteren Werte damit nie gesehen — der Zeiger des ersten stand davor. Jetzt
liest jedes Gerät ab seinem eigenen Zeitpunkt (ein Aufruf je Gerät), und
der Fall „Cloud-Abgleich" stellt zwei Geräte, das zweite mit älteren Werten.
**Ein Fall mit einem Gerät prüft keinen Zeiger.**

Was fehlt, ehrlich: kein QR-Code (die App hat keinen Erzeuger; das Token
wird kopiert oder abgetippt — für Stufe 1 mit einem Bastelgerät reicht das,
Idee 15 für gefertigte Geräte bleibt Fernandos Entscheid), keine
Pausieren-Schaltfläche (der Zustand wird angezeigt, gesetzt wird er noch
nirgends — **Pausieren gebaut in v32.64, §11.3o**). `device_rules` lagen bei v32.62 noch nur lokal — **behoben in
v32.63 (§11.3m)**, und zwar, weil das eine Lücke war, keine Ergänzung.

### 11.3m · Regeln reisen mit (v32.63, 06.09.2026)

**Die Lücke, die v32.62 aufgerissen hat — gefunden beim Schreiben von
§11.3l, nicht vom Prüfstand:** die App meldet Alarme gekoppelter Geräte
nicht mehr selbst, weil der Server das tut. Aber der Server liest
`device_rules`, und die Regeln lagen nur in `gs_geraete_regeln`. Ein
gekoppeltes Gerät mit einer Regel hätte also **nirgends** gemeldet — nicht in
der App (ausgelassen), nicht auf dem Server (unbekannt). Der Fall
„Alarm-Instanz" war grün, weil er nur die eine Richtung kannte: „die App
meldet nicht". **Eine Frage, die nur die Verneinung kennt, ist auch dann
grün, wenn niemand meldet** (dieselbe Lehre wie beim Regen-Draht, v32.51).

| Gebaut | Geprüft (`sensor_check` „Regeln in der Cloud", „Alarm-Instanz"; `save_check` SERVER_WEGE) |
|---|---|
| `_gsRegelHochladen(r)`: Upsert in `device_rules` mit **derselben Id**, den zehn Spalten der Tabelle (`id`, `user_id`, `device_id` = `cloud_id`, `metric`, `op`, `threshold`, `for_minutes`, `action`, `cooldown_minutes`, `enabled`), `return=representation`; `cloud_ok` true nur nach `_gsSchreibOk`, sonst false plus Toast „gilt vorerst nur in der App — die App meldet solange selbst" | Satz mit genau diesen Spalten, keine unbekannte; Ablehnung · 0 Zeilen · Bestätigung |
| Aufrufer: `gsRegelAnlegen` (sofort, nur bei gekoppeltem Gerät), `gsGeraetKoppeln` (zieht bestehende Regeln nach), `gsGeraeteCloudAbgleich` (zieht offene nach, nur bei Geräten, die der Server kennt) | ungekoppelt: kein Aufruf; Koppeln zieht nach; neue Regel sofort; Absage → Abgleich zieht nach |
| `gsRegelLoeschen` löscht auf dem Server mit (`DELETE ?id=eq.`, geprüft); `gsGeraetLoeschen` entfernt ein gekoppeltes Gerät auch in der Cloud (cascade: Werte, Regeln, Befehle) — sonst meldete der Cron weiter | DELETE-Pfade mit Id |
| **Alarm-Instanz je REGEL:** `gsSensorAlarmeMelden` lässt eine Regel nur aus, wenn `g.cloud_id && r.cloud_ok === true` — sonst meldet die App weiter selbst | Regel auf dem Server → keine lokale Meldung; abgewiesene Regel am selben Gerät → lokal gemeldet |
| Kachel: je Regel „☁️" oder „nur in der App" | aus dem HTML gelesen |

Die Regel dahinter, und sie ist allgemeiner als die Sensoren: **wer eine
Zuständigkeit abgibt, prüft, dass der andere sie hat.** „Der Server meldet"
war in v32.62 eine Annahme über einen Server, der die Regel nie gesehen
hatte. Jetzt hängt das Auslassen am Nachweis (`cloud_ok`), nicht an der
Absicht.

Regeln, die der Server ändert (`last_fired_at`, `enabled`), kamen in v32.63
noch nicht zurück — **gebaut in v32.64 (§11.3o)**.

### 11.3o · Pausieren, und die Rückrichtung der Regeln (v32.64, 06.09.2026)

Zwei Lücken aus §11.3l/m, beide klein, beide mit derselben Regel: **der
Zustand liegt beim Server, die App zeigt ihn — und stellt lokal erst um,
wenn der Server bestätigt hat.**

| Gebaut | Geprüft (`sensor_check` „Pausieren", „Regeln in der Cloud"; `save_check` SERVER_WEGE; `naht_check`) |
|---|---|
| `gsGeraetPausieren(id, pausiert)`: `PATCH devices?id=eq.<cloud_id>` mit `{status}`, `return=representation`, `_gsSchreibOk`; lokal `paused` bzw. `active` / `wartet` (ohne `paired_at`) erst danach; Kachel „⏸ Pausieren" / „▶️ Fortsetzen" nur bei gekoppelten Geräten. Der Empfänger antwortet dem Gerät dann 409 (Vertrag §2), das Gerät puffert | ungekoppelt → nein; PATCH mit Id und Status, geprüft; 0 Zeilen → alter Zustand bleibt, gesagt („Nicht fortgesetzt"); Fortsetzen ohne `paired_at` → „wartet"; Kachel liest den Knopf aus dem HTML. `naht_check`: `status` ist eine Spalte von `devices` |
| Rückrichtung im Abgleich: `device_rules?select=id,device_id,enabled,last_fired_at` für die bekannten Geräte → `cloud_ok`, `server_zuletzt`, `enabled` zurück in die lokale Regel; eine Regel, die dort **war** und weg ist → `cloud_ok false`, `cloud_geloescht true` — die App meldet wieder selbst und lädt sie **nicht** neu hoch (`_gsRegelnNachziehen` lässt `cloud_geloescht` aus; ein neuer Upload setzt es zurück). Kachel: „☁️ zuletzt gemeldet dd.mm hh:mm" · „auf dem Server gelöscht — nur in der App" | `last_fired_at` und `enabled` kommen zurück; gelöschte Regel → nur in der App, kein POST; beides aus dem HTML gelesen. `naht_check`: die select-Liste steht in `device_rules`, und was der Abgleich liest (`sv.last_fired_at`, `sv.enabled`) steht in der select-Liste |

Zwei Entscheidungen:

- **Gelöscht ist gelöscht.** Ohne `cloud_geloescht` hätte der Nachzieh-Schritt
  jede vom Server entfernte Regel beim nächsten Abgleich wieder angelegt —
  ein Löschen, das sich alle fünf Minuten selbst rückgängig macht. Die
  App behält die Regel lokal (sie ist die Absicht der Person) und sagt in
  der Kachel, wo sie noch gilt.
- **`enabled` kommt vom Server zurück, aber die App hat keinen Schalter
  dafür.** Das ist bewusst: `gsRegelnPruefen` respektiert `enabled` seit
  je, ein Schalter in der App wäre eine dritte Schreibstelle. Er kommt,
  wenn jemand ihn braucht — dann mit demselben Muster (`_gsSchreibOk`,
  drei Server-Antworten).

Nicht gebaut: „Mein Naturjahr" auf `device_daily` — die Ansicht braucht
Daten, die es erst mit dem ersten Gerät gibt. Der Fall dafür lässt sich
stellen; ich ziehe es vor, ihn gegen echte Zeilen zu bauen.

### 11.3n · Die Naht — passen App, Empfänger, Cron und Pusher zusammen? (06.09.2026)

Vier Teile, die einander nie sehen: die App schreibt `devices` und
`device_rules` und liest `device_readings`; der Empfänger schreibt
`device_readings` und aktualisiert `devices`; der Cron (SQL) liest Regeln und
Werte und schreibt `notifications`; der Pusher liest `notifications` und
`push_subscriptions` und schreibt `push_send_log`. Jeder nennt Spalten und
Schlüssel der anderen — und bis heute prüfte nichts, ob sie übereinstimmen.
Eine falsche Spalte fällt in dieser Kette nicht auf: PostgREST antwortet mit
einem Fehler, der Empfänger gibt 500, das Gerät puffert und versucht es beim
nächsten Kontakt wieder. Für immer.

**`node scripts/naht_check.js`** (Prüfstand 27, 12 Nähte) liest die
Spaltenlisten aus den Migrationen (alles, was ein Repo-Skript anlegt) und aus
einer **datierten** Momentaufnahme (`docs/naht-spalten.json`, nur die drei
Live-Tabellen, die kein Skript hier anlegt) und hält dagegen, was jeder Teil im
Quelltext benutzt — Koppel-Satz, Regel-Satz, die select-Listen des Abgleichs,
die Batch-Zeilen des Empfängers (wirklich gerechnet, nicht gelesen), Patch
und Selects des Empfängers, die Inserts und Reads des Crons, das Aggregat,
die Protokollzeile des Pushers, `delete-user`. Dazu eine Rechnung über die
Naht: das Token, das die App erzeugt, gehasht von der App **und** vom
Empfänger **und** von Node — dreimal derselbe Hex-String.

**Erster Lauf: vier rot, einer echt.** Der Vertrag (§4) verspricht „ein
Befehl mit `expires_at` in der Vergangenheit wird nie gesendet", das
Regel-Modul liest `c.expires_at`, der Empfänger selektiert die Spalte — und
`device_commands` aus 20260903 **hat sie nicht**. Drei Stellen nannten eine
Spalte, die keine Migration anlegt, und alle drei sind gegengeprüft
(`ingest_check` rechnet mit Attrappen, in denen die Spalte natürlich steht).
Behoben mit `20260906_device_commands_expires_at.sql` (guarded, idempotent);
der Prüfstand führt die Spalte jetzt als „per Migration vorbereitet" — die
mittlere Klasse, wie bei `backend_check`.

Die anderen drei waren Parser-Fehler des neuen Prüfstands — `null` aus einem
Ternär als Schlüssel gelesen, ein verschachteltes `{ fehler: … }` als Spalte,
ein `.in("key", …)` an `app_settings` dem Abonnement zugerechnet, und das
Anker-Muster der App enthielt eine Klammer, an der der Suchausdruck des
Prüfstands endete. **Ein Prüfstand, der beim ersten Lauf nur rot meldet, hat
noch nichts bewiesen** — erst die Trennung in echt und Artefakt macht ihn
brauchbar; die Gegenrichtung (eine erfundene Spalte, die gemeldet werden
muss) steht als eigener Fall drin.

Grenze, ehrlich: Spalten und Schlüssel, nicht Typen und nicht RLS. Ob eine
Zeile **angenommen** wird, sagt nur der lebende Server. Und die drei
Live-Tabellen veralten mit der Momentaufnahme — deshalb steht ihr Datum in
jedem Bericht.

### 11.4 · Fragen an Fernando (Ergänzung zu §10)

- **Hat das erste Gerät eine Uhr** (RTC oder NTP)? Davon hängt ab, ob
  `age_s` + `seq` im Vertrag Pflicht werden (Idee 14).
- **Was steht auf der Verpackung** — Seriennummer, Claim-Code, beides? Und
  gibt es einen QR-Code auf dem Gerät selbst (Idee 15)?
- **Die Alt-Tabellen** `sensor_devices` / `sensor_readings` / `sensor_alerts`
  und der Flower-Care-Weg: gibt es Nutzer, die sie brauchen? Sonst
  umleiten und einfrieren (Idee 1). Bitte einmal `select count(*)` je Tabelle.
- **Welche Gerätetypen zuerst** — Bodenstab, Wetterstation, Ventil? Der
  Modell-Katalog (Idee 2) beginnt mit dem ersten.
- **Provisioning:** SoftAP-Portal im Browser-Tab, BLE (nur Android/Desktop),
  oder Werks-WLAN-Konfiguration über eine Begleit-App? Die PWA kann das erste
  nicht aus sich heraus (Idee 19).
