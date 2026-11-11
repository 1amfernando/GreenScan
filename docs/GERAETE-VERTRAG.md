# Geräte-Vertrag v1 — was ein GreenScan-Gerät dem Server sagt, und was es zurückbekommt

> Stand 05.09.2026. Gehört zu `docs/OEKOSYSTEM-V1.md` (§3 Weg eines Messwerts,
> §11 Idee 14). Die rechnenden Regeln stehen in
> `supabase/functions/_shared/ingest_regeln.mjs`; `node scripts/ingest_check.js`
> hält jede davon mit einem guten und einem schlechten Batch fest. Der
> Empfänger `supabase/functions/device-ingest/index.ts` benutzt dasselbe Modul.
> **Version 1.** Eine Änderung, die alte Geräte bricht, ist Version 2 — der
> Server lehnt unbekannte Versionen mit der Liste der bekannten ab.

## 1 · Die eine Anfrage

```
POST https://<projekt>.supabase.co/functions/v1/device-ingest
Authorization: Bearer <geräte-token>        ← das Token des GERÄTS, nie ein Nutzer-JWT
Content-Type: application/json

{
  "schema_version": 1,
  "firmware": "gs-soil-1.0.3",              ← optional, das Gerät meldet, der Server schreibt
  "readings": [
    { "metric": "soil_moisture", "age_s": 0,    "value": 31.5, "seq": 4711 },
    { "metric": "soil_temp",     "age_s": 0,    "value": 18.2, "seq": 4712 },
    { "metric": "soil_moisture", "age_s": 1800, "value": 33.0, "seq": 4709 },
    { "metric": "battery",       "age_s": 0,    "value": 87 }
  ],
  "acks": [ { "id": "<befehl-id>", "ok": true } ]   ← optional, Bestätigungen (§4)
}
```

Ein Gerät wacht auf, redet **einmal**, schläft. Senden und Empfangen in einem
Aufruf — die offenen Befehle reisen in der Antwort mit.

### Felder je Messwert

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `metric` | ja | Schlüssel aus `metric_catalog` (`soil_moisture`, `soil_temp`, `air_temp`, `air_humidity`, `light`, `rain`, `water_level`, `tank_temp`, `ec`, `ph`, `battery`). Unbekannt → abgelehnt **mit Schlüssel** in der Antwort; die anderen Werte des Batches bleiben. Eine neue Sensorart ist eine Zeile im Katalog, kein Firmware-Update. |
| `value` | ja | Zahl in der Einheit des Katalogs. Keine Zahl → abgelehnt. **Ausserhalb des gültigen Bereichs wird angenommen** und als `quality = 1` markiert — ein Sensor, der 250 % meldet, ist eine Information. |
| `age_s` | eins von beiden | **Alter des Werts beim Senden**, in Sekunden. Der Server rechnet `ts = server_time − age_s`. Das ist der Weg für Geräte **ohne Uhr** — ein Puffer nach Funkloch wird mit steigendem `age_s` nachgeliefert. |
| `ts` | eins von beiden | ISO-8601 (`2026-09-05T14:00:00Z`), nur wenn das Gerät eine verlässliche Uhr hat (NTP/RTC). Liegt `ts` vor 2024 oder mehr als 5 Minuten in der Zukunft, gilt die Uhr als **falsch**: der Server nimmt `server_time` (bzw. `server_time − age_s`), legt das Original in `raw.device_ts` ab und antwortet `clock: "untrusted"`. **Nichts wird verworfen.** |
| `seq` | empfohlen | Laufnummer des Geräts, wird in `raw.seq` gespeichert. Hilft beim Nachvollziehen, ist kein Schlüssel. |
| `error` | optional | `true` = das Gerät weiss, dass der Sensor einen Fehler hat → `quality = 0`, angenommen. |

Weder `ts` noch `age_s` → der Wert gilt als **jetzt**.

### Grenzen

- Höchstens **500** Werte je Aufruf, sonst `413` mit der Grenze in der Antwort.
- Höchstens ein Aufruf je `interval_s / 2` (aus `devices.capabilities`), sonst `429` mit `retry_after_s` und `Retry-After`. Das Limit gilt **je Aufruf, nicht je Wert** — 300 gepufferte Werte sind ein Aufruf.
- Idempotent: derselbe Wert (Gerät, Messgrösse, Zeit) zweimal geschickt erzeugt keine zweite Zeile. Die Antwort zählt ihn unter `duplicates`. Nach Funkloch also einfach alles nochmal schicken.

## 2 · Die Antwort

```
200 OK
{
  "schema_version": 1,
  "accepted": 3,                 ← neu gespeichert
  "duplicates": 1,               ← schon da (im Batch oder in der Datenbank) — kein Fehler
  "rejected": [ { "index": 5, "metric": "co2", "grund": "unbekannte Messgroesse — …" } ],
  "clock": "ok" | "untrusted",   ← sagt dem Gerät, ob seine Uhr geglaubt wurde
  "server_time": "2026-09-05T14:00:07.000Z",   ← Arme-Leute-NTP: ein Gerät ohne Uhr stellt sich danach
  "next_contact_s": 1800,        ← wann es sich wieder melden soll (aus capabilities.interval_s, sonst 3600)
  "commands": [ { "id": "…", "command": "valve", "params": { "on": true, "max_on_s": 120 }, "expires_at": "…", "attempt": 1 } ],
  "firmware": null               ← Platz für Stufe 2 (Idee 18): { "version", "url", "sha256" }
}
```

`server_time` steht in **jeder** Antwort, auch in Fehlern — ein Gerät ohne
Uhr braucht sie, um `age_s` beim nächsten Mal richtig zu rechnen.

### Fehler

| Status | `error` | Was das Gerät tun soll |
|---|---|---|
| 400 | `json` · `readings` · `schema_version` (`detail.bekannt`) | Firmware-Fehler; nicht wiederholen, loggen |
| 401 | `token` | Token ungültig oder rotiert; Gerät muss neu gepaart werden (§3) |
| 409 | `paused` | Die Person hat das Gerät pausiert; nach `next_contact_s` wieder versuchen, Werte puffern |
| 413 | `batch` (`detail.max`) | In Teilen zu je ≤ 500 schicken |
| 429 | `rate` (`retry_after_s`) | So lange warten, Werte puffern |
| 500 | `insert` · `server` | Nach `next_contact_s` nochmal, Werte puffern (Idempotenz macht das sicher) |

## 3 · Sicherheit

- **Das Token ist das Geheimnis.** 32 Byte, zufällig, **von der App erzeugt**
  (`crypto.getRandomValues`, v32.62) — der Server bekommt nur den SHA-256-Hash
  (`devices.token_hash`) und sieht das Klartext-Token nie. Verloren = neu erzeugen, das
  alte ist damit ungültig (§3.2 im Entwurf). Ein rotierbares Token je Gerät,
  nie das Konto der Person.
- **Nur TLS.** Kein `http://`. Über TLS reicht das Bearer-Token; eine
  HMAC-Signatur mit Nonce würde genau an der falschen Uhr scheitern, die
  dieser Vertrag ausdrücklich erlaubt. HMAC kommt erst mit MQTT-Bridges (Stufe
  2, Vorbild `stripe-webhook`).
- **Der Server schreibt nur für das Gerät, dem das Token gehört** — mit der
  Service-Rolle, aber ausschliesslich in `device_readings` mit dessen
  `device_id` und `user_id`. Kein anderer Weg schreibt Messwerte (§9 Regel 7).
- Was das Gerät **nie** bekommt: den Nutzer-JWT, den Anon-Key als Autorität,
  Daten anderer Geräte. Was die App **nie** sieht: `token_hash` (Spaltenrecht
  entzogen).

## 4 · Befehle (Stufe 3, der Vertrag steht schon)

Offene Befehle kommen in `commands` mit; das Gerät bestätigt beim nächsten
Kontakt in `acks`. Regeln, die der Server hält:

- Ein Befehl mit `expires_at` in der Vergangenheit wird **nie gesendet**,
  sondern `failed` — ein „Ventil auf" von gestern darf nicht heute laufen.
- Nach **3 Kontakten ohne Bestätigung** wird ein Befehl `failed`, und die
  Person sieht es (⏳ gesendet · ✅ bestätigt · ❌ nicht angekommen).
- Ein Ack mit unbekannter `id` wird in der Antwort genannt, nicht ignoriert.
- **Fail-safe gehört in die Firmware.** Ein Ventil braucht `max_on_s` und ein
  „zu, wenn der Server schweigt" — der Server kann ein Gerät im Funkloch nicht
  retten. Der Server liefert Ablauf und Grenze; das Gerät hält sie ein.

## 5 · Was das Gerät sonst wissen muss

- **Verstummt** heisst: 3 × `next_contact_s` ohne Kontakt (`capabilities.expected_by`). Ein Gerät, das nachts länger schläft, meldet ein grösseres `interval_s` — dann erwartet der Server es auch später.
- **Pairing** (Stufe 1, **gebaut v32.62**): Messwerte → Gerät anlegen (Art „GreenScan-Sensor" oder „Fremdgerät") → „Koppeln" → das Token wird einmal angezeigt (Kopieren); das Gerät bekommt es beim Einrichten. „Verbunden" zeigt die App erst nach dem **ersten Batch**. Für ein gefertigtes Produkt ohne Kamera und BLE auf iOS steht in §11 Idee 15 ein Claim-Code-Weg — Entscheid bei Fernando.
- **Firmware** (Stufe 2): das Gerät meldet seine Version im Feld `firmware`; ein Update kommt später in der Antwort — signiert, Prüfung in der Firmware.

## 6 · Beispiel: ESP32 ohne Uhr, Puffer nach Funkloch (Pseudocode)

```
jede 30 Minuten:
  wert = messe()
  puffer.push({ metric: "soil_moisture", value: wert, seq: ++seq, gemessen_vor_ms: 0 })
  versuche_senden()

versuche_senden():
  jetzt = millis()
  body.readings = puffer.map(p => ({ metric: p.metric, value: p.value, seq: p.seq,
                                     age_s: (jetzt - p.zeitpunkt_ms) / 1000 }))
  antwort = POST(body)                     // Bearer <token>
  wenn 200: puffer.leeren(); schlafe(antwort.next_contact_s)
  wenn 429: schlafe(antwort.retry_after_s)   // Werte bleiben im Puffer
  wenn 401: led_rot(); stopp                 // neu pairen
  sonst:    schlafe(next_contact_s)          // Werte bleiben im Puffer, Idempotenz regelt den Rest
```

Der Puffer darf höchstens 500 Einträge halten (sonst in Teilen senden) und
sollte den Tiefschlaf überleben (RTC-Memory oder Flash).

## 7 · Was dieser Vertrag bewusst NICHT regelt

- Wie das Gerät ins WLAN kommt (Provisioning) — §11 Idee 19, Entscheid bei Fernando.
- Kalibrierung — als Daten in `capabilities.calibration` vorgesehen (§11 Idee 23), angewandt beim Anzeigen, nie beim Speichern.
- Bilder (Kamerafalle) — ein Bild ist kein `numeric`; Weg über Storage, nicht über diesen Endpunkt.
