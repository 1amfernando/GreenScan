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
| Tabellen für Geräte oder Messwerte | **keine** |
| Edge-Function für Messwerte | **keine** |
| Diagramm-Routine im Frontend | **keine** (kein Chart-Paket; Three.js und Leaflet werden nur bei Bedarf geladen) |
| Schwellwerte in den Artendaten | `care` / `lightMin` / `lightOptimal` / `lightMax` / `waterFrequency` bei **40 von 4'342** Arten |
| Web-Bluetooth / Web-Serial / WebUSB in der `Permissions-Policy` | `_headers` Z. 9: `usb=()` ist **gesperrt**, `bluetooth` und `serial` sind **nicht genannt** (gelten damit als `self`). Für Stufe 2 wird `usb` bewusst freigegeben oder bewusst gesperrt gelassen — mit Begründung in `_headers`, wie bei `camera=(self)` |
| Andockstellen, die es schon gibt | `gsCloudSync`/`markDirty` (Sync), RLS-own-only-Muster in den Migrationen, `GS_NOTIF_ZIELE` (31 Benachrichtigungsarten mit Ziel), der tägliche Cron (`daily-push`), die IndexedDB-Ablagen (`STORES`), `_gsAufFarbe` (Kontrast für Farben aus Daten) |

Es existiert also **nichts** für Geräte — und genau deshalb lohnt sich der
Entwurf jetzt: nichts muss umgebaut werden, und die Konventionen des Repos
(Sync, RLS, Benachrichtigungen, Prüfstände) sind schon da.

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
(§5) unbegrenzt. Eine spätere Partitionierung nach Monat ist vorbereitet,
weil `ts` im Primärschlüssel steht.

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

Und `stale` für jedes Gerät ohne Regel. Push kommt über denselben Weg wie
heute (`daily-push`-Muster); kein zweiter Push-Kanal.

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
| Regel `task:water` | Aufgabe heute | „Giessen — Bodenfeuchte seit 2 h unter 25 %" mit Quelle `sensor`; sie steht in „Heute zu tun" wie jede andere |
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
| **0** | Migrationen im Repo (`metric_catalog`, `devices`, `device_readings`, `device_rules`, `device_commands`, `v_device_daily`, RLS) — **nicht angewandt**, wie alle DDL · `manual`-Gerät · Dashboard mit Verlauf · Regeln clientseitig ausgewertet · Kalender-Ereignisse `messung`/`alarm` · `sensor_check.js` mit simuliertem Gerät und 7 Tagen Werten | nein |
| **1** | `device-ingest` (Edge) · Token-Pairing per QR · Cron `device-alerts` · Push `sensor_alert` · Wetter als virtuelles Gerät · Bestätigung erledigter Aufgaben (§6) | ein Gerät zum Testen |
| **2** | BLE-Pairing im Browser (`Permissions-Policy` erweitern, `wiring_check`/`kamera_check`-artiger Prüfstand mit gestellter BLE-API) · Firmware-Vertrag als `docs/GERAETE-VERTRAG.md` (das JSON aus §3.1, versioniert) · MQTT-Bridge | ja |
| **3** | Aktoren (Ventil, Pumpe, Licht) über `device_commands` · Automationen `op = 'expr'` · Export/Import | ja |

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
