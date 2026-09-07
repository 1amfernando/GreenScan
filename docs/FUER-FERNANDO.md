# Für Fernando — was nur du machen kannst

> Stand 03.09.2026 · geschrieben von Seros.
> Alles hier greift in die **laufende Auslieferung** ein. Ich fasse das nicht
> von mir aus an — bei einer Produktivdatenbank mit laufenden Zahlungen
> gehört der letzte Klick dir.
>
> **Ausnahme, weil du sie ausdrücklich beauftragt hast:** Punkt 1
> (`send-receipt`) habe ich am 03.09.2026 selbst ausgeliefert. Er ist
> erledigt und unten dokumentiert — mitsamt dem, was ich vorher geprüft und
> nachher nachgemessen habe.
>
> **Sag mir nach jedem Schritt Bescheid, dann messe ich nach** (nur lesend)
> und bestätige dir schriftlich, dass es angekommen ist. So bleibt nichts
> „vermutlich erledigt".

---

## 1 · ~~`send-receipt` stilllegen~~ — ✅ ERLEDIGT am 03.09.2026

**Du hast mich ausdrücklich damit beauftragt („Mach du das für mich!"), also
habe ich es gemacht.** Hier steht, was ich vorher geprüft, was ich
ausgeliefert und was ich nachher nachgemessen habe — damit du es nachvollziehen
und notfalls zurücknehmen kannst.

### Was das Problem war

Die Funktion lief seit April, wurde von **niemandem** aufgerufen, und
verschickte E-Mails von `info@greenscan.ch`. Empfänger, Betrag, Organisation
und Name kamen **aus der Anfrage**:

```ts
const { type, email, name, amount, currency, date,
        transactionId, charityName, isSubscription } = await req.json()
…
to: [email]
```

Keine Prüfung gegen Stripe, keine Prüfung, ob die aufrufende Person mit der
Zahlung zu tun hat, keine Prüfung, ob ihr die Empfängeradresse gehört.
`verify_jwt: true` verlangte lediglich irgendein GreenScan-Konto.

Damit konnte jede angemeldete Person eine erfundene Quittung an jede Adresse
schicken — mit dem Satz „Diese E-Mail ist deine Zahlungsbestätigung. Bitte
aufbewahren." Kein Datenabfluss, aber eine Vorlage für Betrug in deinem Namen.

### Was ich VOR der Auslieferung geprüft habe

| Prüfung | Ergebnis |
|---|---|
| Ruft die App sie auf? | **0 Treffer** in `index.html` |
| Rufen andere Server-Funktionen oder Migrationen sie auf? | **0 Treffer** |
| Ist die ausgelieferte Fassung noch die, auf die sich der Befund bezieht? | **ja** — Version 3, `ezbr_sha256` `54412e83…`, unverändert seit dem Befund vom 02.09. |

Der letzte Punkt war mir wichtig: hätte sich seit dem Befund etwas geändert,
hätte ich eine fremde Änderung überschrieben.

### Was jetzt läuft

Ein **410-Stub** — die Funktion antwortet auf jede Anfrage mit „gone" und
verschickt nichts mehr. Nachgemessen nach dem Deploy:

```
version 4 · ACTIVE · verify_jwt: true · ezbr_sha256 55e089b4…
```

Ich habe den Quelltext danach wieder ausgelesen und bestätigt, dass dort
wirklich der Stub steht — **nicht am Zeitstempel**, sondern am Inhalt.

`verify_jwt` bleibt bewusst auf `true`: ein stillgelegter Endpunkt soll nicht
offener sein als vorher.

### Wenn du es zurücknehmen willst

Die alte Fassung liegt wortgetreu in der Versionsgeschichte des Repos:

```bash
git show 70ddf9e:supabase/functions/send-receipt/index.ts
```

Ich würde davon abraten — aber es ist deine Entscheidung, und der Weg dahin
ist offen.

### Wenn Quittungen später wirklich verschickt werden sollen

Dann **nicht** diese Funktion reaktivieren, sondern den Auslöser in den
`stripe-webhook` legen. Dort ist die Zahlung durch Stripes Signatur **belegt**,
statt vom Aufrufer behauptet — und Empfänger, Betrag und Datum kommen aus dem
Zahlungsobjekt, nicht aus dem Anfrage-Rumpf. Die Mail-Vorlage (das HTML der
beiden Varianten) steht in der Versionsgeschichte und ist wiederverwendbar.

---

## 2 · Kommentar-Reaktionen freischalten

**Warum:** Du hattest dir Liken und Disliken von Kommentaren gewünscht. Das
Programm ist **fertig** — es tastet die Tabelle ab und blendet die Knöpfe
aus, solange sie fehlt. Deshalb siehst du sie heute nicht.

Es fehlt nur der Datenbank-Teil.

### So geht es

1. **supabase.com** → Projekt **Green-scan** → links **SQL Editor**.
2. **New query**.
3. Im Repo die Datei
   `supabase/migrations/20260831_community_reaktionen_v31_09.sql` öffnen,
   **alles kopieren** und im SQL Editor einsetzen.
4. **Run** drücken.

Die Datei ist **idempotent** — sie verträgt es, zweimal zu laufen (`IF NOT
EXISTS`, `DROP … IF EXISTS`), und läuft in einer Transaktion (`BEGIN` /
`COMMIT`). Geht etwas schief, wird nichts halb angelegt.

### Was sie anlegt

| | |
|---|---|
| `comment_reactions` | eine Stimme je Person und Kommentar (Like = 1, Dislike = −1) |
| Zugriffsregeln | jeder sieht die Zählstände, schreiben darf jeder nur die **eigene** Stimme |
| `fn_notify_post_like` + Auslöser | Benachrichtigung, wenn jemand deinen **Beitrag** liked |
| `fn_notify_comment_like` + Auslöser | dasselbe für **Kommentare** — **nur bei Likes**, nie bei Dislikes |
| `fn_sync_post_like_count` + Auslöser | der Like-Zähler am Beitrag wird ab jetzt **serverseitig** geführt |

### Eine Sache, die du wissen solltest

Der letzte Punkt ändert Verhalten: bisher hat die App den Zähler
`social_posts.likes` selbst geschrieben (`index.html:17831`). Ab der Migration
rechnet ihn die Datenbank bei jedem Like neu aus.

**Das ist eine Verbesserung** — zwei Geräte gleichzeitig liessen den Zähler
vorher auseinanderdriften, und fälschbar war er ohnehin. Aber es ist eine
Änderung, und du sollst sie vorher gelesen haben, nicht nachher entdecken.

### Danach prüfen

Sag mir Bescheid, dann messe ich nach: Tabelle da, Regeln da, Auslöser da.
Und du siehst die Knöpfe in der Community von selbst — die App fragt bei
jedem Laden nach.

---

## 3 · Die kleinen drei

Alle drei stehen seit dem 31.08. in der Liste offener Migrationen. Keiner ist
dringend, alle sind schnell.

### 3a · Passwort-Leck-Schutz einschalten *(ein Klick)*

**supabase.com** → Projekt → **Authentication** → **Policies** bzw.
**Settings** → **Leaked password protection** einschalten.

Supabase gleicht Passwörter dann gegen bekannte Leck-Listen ab. Kostet nichts,
bremst nichts, verhindert die häufigste Übernahme eines Kontos.

### 3b · `fn_is_role` und `fn_role_at_least` für Anonyme sperren

Diese beiden Funktionen sind heute für **nicht angemeldete** Aufrufer
erreichbar. Sie geben nur wahr/falsch zurück, aber sie verraten, welche
Nutzer-IDs welche Rollen haben.

SQL Editor → **New query** → einsetzen → **Run**:

```sql
REVOKE EXECUTE ON FUNCTION public.fn_is_role(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_role_at_least(text, uuid) FROM anon;
```

Angemeldete Nutzer und der Server behalten den Zugriff — nur `anon` verliert
ihn. Die App braucht ihn dort nicht.

### 3c · `daily_quizzes.image_url`

Bildfragen im Tagesquiz. Das Frontend liest die Spalten bereits
(`index.html:12942` — `quiz.image_url`, `image_alt`, `image_credit`), die
Datenbank hat sie noch nicht. Steht in derselben
Liste; sag Bescheid, wenn du das Quiz mit Bildern willst, dann schreibe ich
dir die passende Migration und du spielst sie ein wie unter Punkt 2.

---

## 4 · Das, was keine Anleitung ist, sondern eine Entscheidung

### Die Arten-Daten — Stand 03.09.2026, nach dem Nachsehen

**4'342 Arten liegen in der App.** Nachgezählt:

| | verwertbar | fehlt bei |
|---|---|---|
| Blütenfarbe | **939** | 3'403 |
| Höhenverbreitung | **877** (seit v32.43: 903, 26 aus dem Lebensraum-Text) | 3'439 |

„Verwertbar" heisst: die Angabe lässt sich rechnen. Ein `color`-Feld mit
„Bunt-konzentrisch" oder „–" ist zwar gefüllt, sagt aber nichts.

**Ich schreibe diese Angaben nicht aus dem Gedächtnis.** In einer App, die
Giftiges von Essbarem trennt, wäre erfundene Botanik das Gefährlichste, was
ich tun könnte — sie sähe genauso aus wie richtige.

Du hast gesagt: *„Mach du das für mich."* Hier ist, was sich von hier aus
machen liess — alles in `docs/ARTEN-DATEN.md`, mit Zahlen:

**1 · Eine Quelle gibt es von hier aus nicht.** GBIF, Wikidata, Wikipedia
und iNaturalist sind aus dieser Umgebung gesperrt (`CONNECT 403`, das ist
Richtlinie, kein Netzfehler). Die Supabase-Tabelle `species` ist eine Kopie
der App-Datei. Die Liste selbst kam in einem Commit und hat kein
Herkunftsfeld — niemand weiss, woher `tox` und `edible` der 2'900 Einträge
ohne `bookRef` stammen.

**2 · Im Repo liegen zwei belegte Datensätze**, die ich beim ersten
Anlauf übersehen hatte: das Pilz-Register (268 Arten, Hutfarbe und Höhe,
Quellen VAPKO/SwissFungi/…) und die Baum-Spezifikationen (76 Arten, Höhe,
Quellen BAFU/Flora Helvetica). Sie würden **303 Lücken** füllen. Ich habe
sie **nicht** übernommen, und das ist der Punkt, an dem ich dich brauche:

> Wo Register und Liste beide eine Höhe haben, stimmen sie in **2 von 122**
> Fällen überein. Das Register beginnt bei 300 m, die Liste bei 0 — zwei
> Konventionen, und keine ist irgendwo benannt.

Der Scanner liest die Höhe als Ausschlussgrund. Welche Konvention gelten
soll, ist eine fachliche Entscheidung. Sobald du sie triffst, ist die
Übernahme ein Skript (`node scripts/arten_quellen_vergleich.js` misst heute
schon alles, nur lesend).

**3 · Schlimmer als die Lücke: die Liste führt Holunder neunmal.** 657
Arten stehen mehrfach drin, 167 davon widersprechen sich bei der
Giftigkeit (Holunder tox 0/1/2, Perlpilz 0/1/2/4, Wacholder 0/2). Welche
Stufe der Scan zeigte, hing an der Reihenfolge in der Datei. Seit v32.43
gewinnt die vorsichtigere Angabe — das ist keine Botanik, nur die Richtung
des Zweifels. **Entscheiden musst du sie:** `docs/arten-widersprueche.csv`
listet alle 167 Gruppen mit jedem Eintrag, jeder Stufe und jedem Warntext.
Mit einer Flora daneben ist das ein Nachmittag. Solange die Liste neun
Holunder führt, wäre jede neue Quelle ein zehnter.

**2b · Und in der Datenbank liegen noch zwei Tabellen, die es im Repo nicht
gibt:** `alpine_garden_plants` und `water_features` (je 60 Zeilen, Quellen
Pro Natura/SAC), die die App liest. Zusammen mit den zwei Repo-Datensätzen
hätten **114 Arten** Farbe oder Höhe aus der Datenbank — mit derselben
Konventions-Frage wie oben. Die zwei Tabellen sollten als Snapshot ins Repo;
das kann ich vorbereiten, nur lesend.

Was danach — für die 3'000 Lücken, die kein Repo-Datensatz deckt:

| Möglichkeit | Was ich dann tue |
|---|---|
| Ein Buch, das du hast | Du fotografierst die Seiten, `book-ingest` liest sie aus — die Funktion existiert schon und ist admin-geschützt |
| Info Flora (die nationale Datenbank) | Ich schreibe den Abgleich, du klärst die Nutzungsrechte — was die Datei mitbringen muss, steht in `ARTEN-DATEN.md` §5 |
| Eine Tabelle, die du selbst pflegst | Ich baue den Einlese-Weg und die Prüfung |
| „Mach es mit KI" | **Sage ich Nein** — mit Begründung: ein Modell, das eine Höhenangabe erfindet, tut das mit derselben Sicherheit wie eine richtige |

Sag mir, welcher Weg dir passt, und ich baue ihn.

---

## 5 · Migration `20260903_plant_tasks_due_snooze.sql` — die Server-Regel für Aufgaben

Seit v32.46 fälscht „Verschieben" kein `lastDone` mehr, sondern schreibt
`snoozedUntil`. Die App rechnet damit; die Sicht `v_plant_tasks_due`, aus
der der tägliche Push-Cron liest, kennt das Feld noch nicht. **Bis du die
Migration einspielst, kann der Push eine verschobene Aufgabe anmahnen, die
in der App „in 2 Tagen" steht.** Die Migration bringt ausserdem beide
Seiten auf dieselbe Regel (Kalendertag statt Sekunde, Europe/Zurich).

Idempotent, nur eine Sicht (`CREATE OR REPLACE VIEW`), keine Daten. Sag
Bescheid, dann messe ich nach.

**Nachtrag v32.53:** es gibt eine Nachfolgerin,
`20260904_plant_tasks_due_vorgezogen.sql` — sie enthält alles aus dieser
Migration **und** das Vorziehen durch Sensor-Regeln (`vorgezogenAuf`,
`docs/OEKOSYSTEM-V1.md` §11.3b). Wende nur die neue an; beide nacheinander
ist auch richtig. Ohne sie hält der Push-Cron eine vom Sensor vorgezogene
Aufgabe erst am regulären Tag für fällig.

## 6 · Migration `20260903_oekosystem_v1_geraete.sql` — das Schema für Geräte und Messwerte

Seit v32.48 gibt es das Messwerte-Dashboard mit der Person als erstem Gerät
(`kind = 'manual'`); die Daten liegen bisher nur auf dem Gerät. Die
Migration legt fünf Tabellen und zwei Sichten an (`metric_catalog`,
`devices`, `device_readings`, `device_rules`, `device_commands`,
`v_device_latest`, `v_device_daily`), alle own-only per RLS, der Katalog
öffentlich lesbar. Idempotent, keine bestehende Tabelle wird angefasst.

**Ohne sie funktioniert alles weiter** — nur ohne Cloud-Abgleich der
Messwerte. Sobald sie drin ist, sage ich dir, was als Nächstes kommt
(Stufe 1: der Empfänger für echte Geräte, `docs/OEKOSYSTEM-V1.md` §8).

**Nachtrag 04.09.2026 — fünf Fragen, bevor Stufe 1 gebaut wird**
(`docs/OEKOSYSTEM-V1.md` §11.4, alle mit Begründung dort):

1. Hat das erste Gerät eine **Uhr** (RTC oder NTP)?
2. Was steht auf der **Verpackung** — Seriennummer, Claim-Code, beides?
3. Die **Alt-Tabellen** `sensor_devices` / `sensor_readings` /
   `sensor_alerts` und der Flower-Care-Weg: braucht die noch jemand? Einmal
   `select count(*)` je Tabelle im Supabase-Dashboard genügt mir.
4. Welcher **Gerätetyp** kommt zuerst — Bodenstab, Wetterstation, Ventil?
5. Wie kommt das Gerät ins **WLAN** — Portal im Browser-Tab, Bluetooth (nur
   Android/Desktop), Begleit-App? Die PWA kann das erste nicht selbst.

**Nachtrag 05.09.2026 — Stufe 1 liegt bereit, braucht aber deine Hand und ein
Gerät.** Drei Dinge, in dieser Reihenfolge, wenn das erste Gerät da ist:

1. Migrationen anwenden: `20260903_oekosystem_v1_geraete.sql`, dann
   `20260905_device_daily.sql`, `20260905_device_alerts_cron.sql` und
   `20260906_sensor_push.sql` und `20260906_device_commands_expires_at.sql`
   (alle idempotent; die vorletzte ersetzt die
   Brücken-Funktion aus v30.80 wortgleich plus eine Sperrzeile und plant den
   Cron `device-alerts` neu).
2. Den Empfänger ausliefern: `supabase functions deploy device-ingest
   --no-verify-jwt` — das Gerät hat kein Nutzerkonto, das Geräte-Token ist die
   Sicherheit. Die Funktion ist hier **nie gelaufen** (kein Deno); ihre
   Rechnung ist geprüft (`node scripts/ingest_check.js`), der Rand nicht.
   Dazu den Pusher: `supabase functions deploy sensor-push` (verify_jwt
   bleibt an; der Cron schickt das x-cron-secret wie bei daily-push). Ohne
   ihn landet ein Sensor-Alarm nur in der Inbox, nie auf dem Telefon —
   das habe ich am 06.09. gegen meinen eigenen Text vom Vortag nachgemessen
   (§11.3k). Und `delete-user` neu ausliefern: die Liste kennt jetzt die
   Gerätetabellen.
3. Das Pairing ist seit v32.62 in der App: Messwerte → „Gerät anlegen" mit
   Art „GreenScan-Sensor" → „Koppeln" → das Token wird einmal angezeigt,
   Kopieren. Damit einen Batch schicken, nach `docs/GERAETE-VERTRAG.md` §1
   (`curl`, `Authorization: Bearer <Token>`). Erwartet: `accepted`,
   `server_time`, `next_contact_s` — und in der App beim nächsten Öffnen des
   Dashboards die Werte und „☁️ gekoppelt · zuletzt …". Eine Regel am
   gekoppelten Gerät geht seit v32.63 von selbst auf den Server (in der
   Kachel steht dann ☁️; steht „nur in der App", hat der Server sie nicht
   angenommen — dann meldet die App weiter selbst). Sag mir, was zurückkam.

Und eine Sache, die ich **nicht** angefasst habe, weil sie eine Entscheidung
ist: der alte ESP32-Assistent („📶 Sensoren & Geräte") lässt Nutzer ihr
**Sitzungs-Token** in die Firmware kopieren. Das ist Vollzugriff aufs Konto
auf einem Chip, und es läuft nach einer Stunde ab. Idee 1 in §11 schlägt
vor, ihn auf „Messwerte" umzuleiten — sag Ja, dann mache ich es.

## 7 · Migration `20260907_quiz_antwort_formate.sql` — die Quiz-Rangliste zählt wieder

Deine Meldung vom 07.09.: „Die Rangliste aktualisiert nicht, obwohl ich die
Antwort mehrmals richtig hatte." Stimmt, und zwar für alle. Seit du am
01.09. die Migration v30.95 eingespielt hast, entscheidet der Server, ob eine
Antwort richtig ist — und er kannte **nur eines von drei Frageformaten**
(5 von 203 Fragen). Bei den anderen 198 galt seither jede Antwort als
falsch, auch deine richtigen vom 04.09. (Schlehe) und 05.09. (Pestwurz).
Die App zeigte trotzdem „Richtig!", weil sie alle drei Formate kennt und
das Urteil des Servers nie las. Alles nachgemessen, nur lesend, in
`STATUS.md` (fe).

**Was die Migration tut** (idempotent, zwei Transaktionen):

1. Eine Funktion `fn_quiz_option_correct`, die alle drei Formate liest.
   Trigger und Jahres-Ranking (das 1 Jahr Pro für die Top 3) rufen sie.
2. Alle Antworten mit Index werden nachgerechnet. Erwartung aus meiner
   Lese-Messung: **5 Zeilen kippen auf richtig** — 2 bei dir, 1 bei „fra",
   2 bei „Jasmin" — keine auf falsch. Die 24 Altzeilen ohne Index bleiben.
3. Die Rangliste wird nachgezogen: du 6 → **8** richtig, „fra" 5 → 6,
   „Jasmin" bleibt 4 (ihre Zeile trägt noch alte Client-Zahlen, die höher
   sind als die Zählung — die Regel „kein Rückschritt" gilt weiter).
4. Zweiter Block: ein CHECK auf `daily_quizzes`, dass jede neue Frage in
   einem lesbaren Format steht. Alle 203 bestehenden erfüllen ihn. Scheitert
   dieser Block trotzdem, bleibt Teil 1–3 angewandt.

Geprüft in einem lokalen Postgres 16 (`node scripts/quiz_check.js`, 13
Fälle): erst der Fehler nachgespielt, dann die Reparatur, dann die alte
Regel wieder eingespielt — rot. **Nicht** geprüft: RLS und Rollen der
Live-DB; die Migration fasst beides nicht an.

**So geht es:** Supabase → SQL Editor → Datei einfügen → Run. Oder in
`scripts/apply_pending_v30_87.sh` aufnehmen. Kein Frontend-Deploy nötig
davor; v32.65 (die App liest das Server-Urteil zurück) kann vorher oder
nachher live gehen.

**Danach prüfen** (nur lesend):

```sql
select user_id, total_correct, total_attempts, updated_at
  from public.quiz_leaderboard order by total_correct desc;        -- du: 8/18
select count(*) filter (where is_correct), count(*)
  from public.quiz_answers where created_at >= '2026-09-02';        -- 3 von 7 (vorher 0 von 7)
select * from public.system_events where source = 'quiz';           -- leer, solange kein viertes Format kommt
```

Und dann einmal das Quiz spielen: unter dem Ergebnis darf **nichts** Orangefarbenes
stehen. Steht dort „Der Server wertet diese Antwort als falsch", ist die
Migration noch nicht drin — genau dafür ist die Zeile da.

## 8 · Der KI-Schlüssel bleibt auf dem Server — drei Schritte, in dieser Reihenfolge

Bis v32.67 bekam **jeder angemeldete Nutzer** den echten Anthropic-Schlüssel
in den Browser (`fn_get_global_api_key`), und die App rief Anthropic direkt.
Der Proxy `ai-proxy` ist seit Juni ausgeliefert — und wurde nie benutzt:
`ai_usage` hat 0 Zeilen (nachgesehen 07.09.). Audit A1.

Seit v32.68 ruft die App den Proxy **zuerst**, legt den Schlüssel nicht mehr
auf die Platte und fällt nur dann auf den Direktweg zurück, wenn der Proxy
schweigt (Netzfehler, 5xx) **und** der Server ihr noch einen Schlüssel
gegeben hat. Das ist der Übergang — er endet mit Schritt 3.

1. **Prüfen, dass der Proxy produktiv funktioniert.** Sobald v32.68 live
   ist: einmal eine KI-Funktion benutzen (Lina, Scanner) und im SQL Editor
   ```sql
   select count(*), max(created_at) from public.ai_usage;   -- muss > 0 werden
   ```
   Bleibt es 0, hat der Proxy nicht geantwortet und die App ist still auf den
   Direktweg zurückgefallen (in der Konsole: „ai-proxy Ausfall → Direktweg").
   Dann sag es mir, **bevor** du Schritt 3 machst — nach Schritt 3 gibt es
   keinen Rückfall mehr.
2. **`supabase functions deploy ai-proxy`** — die Modell-Liste kennt jetzt
   `claude-sonnet-4-6` (das erste Modell der App-Kette); vorher stufte der
   Proxy still auf 4-5 zurück. Nicht dringend, aber vor Schritt 3 sinnvoll.
3. **Migration `20260907_global_api_key_nur_proxy.sql`** anwenden. Danach
   bekommen Nutzer nur noch „mode: proxy" und keinen Schlüssel; **du als
   Admin bekommst ihn weiter** (Schlüssel-Test und Health-Check im
   Admin-Panel laufen wie bisher). Rückweg steht im Kopf der Datei.

**Danach prüfen:** `select count(*) from public.ai_usage` wächst weiter;
in einem Nicht-Admin-Konto zeigt die Konsole nach
`localStorage.getItem('gs_global_api_key')` → `null` und
`localStorage.getItem('gs_global_api_mode')` → `"proxy"`.

**Notschalter im Übergang** (nur bis Schritt 3 wirksam):
`localStorage.setItem('gs_feat_aiproxy','0')` in der Konsole schickt dieses
Gerät wieder direkt an Anthropic. Danach entferne ich Schalter und Rückfall.

## 9 · Neun Edge-Functions neu ausliefern (Audit A10, B2 — v32.72)

Alles im Repo, nichts davon läuft, bis du es auslieferst. Ein Aufruf je Zeile,
Reihenfolge egal; die geteilte Datei `_shared/auth_vergleich.mjs` bündelt die
CLI automatisch mit.

```bash
supabase functions deploy daily-push-checker
supabase functions deploy engagement-push-checker
supabase functions deploy key-health-check
supabase functions deploy sensor-push
supabase functions deploy weather-alert-checker
supabase functions deploy feedback-triage
supabase functions deploy ai-proxy
supabase functions deploy garden-scan-analyze
supabase functions deploy plan-iterate
```

**Was sich ändert:**

- Die fünf Cron-Empfänger prüfen den Service-Schlüssel konstantzeitig über
  ein gemeinsames Modul — vorher `includes()`, ein Teilstring-Vergleich, den
  `send-push` seit v30.87 richtig hatte, als Kopie, die die anderen nie bekamen.
  Für die Crons ändert sich nichts: `x-cron-secret` wie bisher.
- `feedback-triage` lässt nur noch Admins (`profiles.is_admin` oder die
  E-Mail-Liste) die KI-Triage starten — vorher genügte `is_expert`.
- `ai-proxy` erlaubt als Herkunft nur noch `green-scan.ch`, `greenscan.ch`,
  `*.greenscan-app.pages.dev` und localhost — vorher jede `*.pages.dev`.
  Und die Modell-Liste kennt `claude-sonnet-4-6` (§8).
- `garden-scan-analyze` und `plan-iterate` brechen die KI-Anfrage nach
  110 Sekunden ab (Antwort 504, nichts gespeichert). Die App wartet seit
  v32.72 120 Sekunden und sagt bei einem Timeout, dass der Plan vielleicht
  noch fertig wird. Vorher: Client 60 bzw. 30 Sekunden, Server rechnete bis
  14'000 Tokens weiter und speicherte den Plan trotzdem — zwei Pläne, doppelte
  Kosten.

**Danach prüfen:** ein Push-Test aus den Einstellungen kommt an (`send-push`
ist unverändert); im Admin-Panel „KI-Triage" läuft für dich weiter; ein
Garten-Scan mit drei Fotos und Horizont 3 Jahre kommt in unter zwei Minuten
zurück oder sagt sauber „Timeout".

**Nachtrag v32.75 (Audit C4):** dieselben fünf Functions haben sich noch
einmal geändert — `daily-push-checker`, `engagement-push-checker`,
`weather-alert-checker` und `sensor-push` importieren jetzt
`_shared/push_helfer.mjs` (beim Ausliefern wird `_shared/` mitgenommen, wie
schon bei `auth_vergleich.mjs`), und `feedback-triage` fragt
`is_admin_user` mit dem Token der Person; sie liest dafür
`SUPABASE_ANON_KEY` aus der Umgebung (Standard in jeder Edge-Function,
Rückfall Service-Key als `apikey`). Die Liste in §9 bleibt dieselbe.

## 10 · Drei Dinge aus Audit A5/A6 (v32.74), die nur du entscheiden oder anwenden kannst

**Nur gelesen, nichts geändert** — die Zahlen stammen aus lesenden Abfragen
vom 07.09.2026.

1. **`profiles` — ein Loch, das die Guard-Trigger nicht deckt.**
   `trg_profiles_guard_protected` verhindert, dass ein Nicht-Admin seine
   eigenen Spalten `is_admin`, `role`, `tier`, `is_expert` … per UPDATE
   ändert. Die Regel `profiles_insert_self` erlaubt aber das Anlegen der
   eigenen Zeile **ohne `WITH CHECK`** auf diese Spalten. Im Normalfall ist
   das harmlos, weil `fn_handle_new_user` die Zeile beim Registrieren
   anlegt und ein zweites INSERT am Primärschlüssel scheitert. Fehlt die
   Zeile aber einmal (gelöscht, Import, Wiederherstellung), könnte ein Konto
   sich mit `is_admin = true` selbst anlegen — und `is_admin_user()` sagt
   danach „ja". Vorschlag (DDL, deshalb bei dir):

   ```sql
   -- profiles: beim Anlegen der eigenen Zeile keine Rechte mitbringen
   drop policy if exists profiles_insert_self on public.profiles;
   create policy profiles_insert_self on public.profiles
     for insert to authenticated
     with check (
       (select auth.uid()) = id
       and coalesce(is_admin, false) = false
       and coalesce(role, 'user') = 'user'
       and coalesce(is_expert, false) = false
       and tier is null
     );
   ```

   Vorher einmal `select count(*) from profiles where is_admin` — das
   sollten weiterhin 2 sein. Wenn `tier` bei neuen Zeilen einen Vorgabewert
   hat, die letzte Bedingung anpassen (`\d profiles` zeigt es).

2. **Die Alt-Tabellen `sensor_devices` / `sensor_readings` / `sensor_alerts`.**
   Live: 1 Gerät (deins, 09.06.2026), 0 Messwerte, 0 Alarme. Die App legt
   dort seit v32.74 nichts mehr an; das eine Gerät kannst du unter
   „Sensoren & Geräte" mit 🗑️ entfernen. Die Tabellen selbst dürfen
   bleiben — oder weg, wenn du magst (`drop table` in dieser Reihenfolge:
   `sensor_alerts`, `sensor_readings`, `sensor_thresholds`,
   `sensor_devices`). Nichts in der App liest sie mehr ausser dem
   Wegweiser und dem Login-Sync `gsSensorSync` (Aufräumen folgt mit
   Audit C2).

3. **„Messwerte → Gerät koppeln" braucht §6.** Die neuen Tabellen
   `devices`, `device_readings`, `device_rules`, `device_commands` gibt es
   live noch **nicht** (0 von 4 am 07.09.2026). Bis die Migration aus §6
   angewandt ist, sagt das Koppeln in der App ehrlich „Nicht gekoppelt — der
   Server hat das Gerät nicht angenommen"; Messwerte von Hand funktionieren
   trotzdem. Der Wegweiser aus A5 zeigt also auf einen Weg, der erst mit §6
   ganz zu Ende geht.

## Und wenn etwas schiefgeht

Nichts hier ist unumkehrbar ausser dem Löschen von Daten — und nichts hier
löscht Daten.

- Der 410-Stub lässt sich zurücknehmen: die alte Fassung liegt wortgetreu im
  Repo unter `supabase/functions/send-receipt/index.ts`.
- Die Migration lässt sich zurücknehmen (`DROP TABLE public.comment_reactions
  CASCADE;` plus die drei Auslöser) — sag Bescheid, ich schreibe dir das
  Gegenstück, bevor du sie einspielst, wenn du dich damit wohler fühlst.
- Die `REVOKE`-Zeilen lassen sich mit `GRANT` umkehren.

**Bei allem anderen: frag mich vorher.** Ich messe lieber zehn Minuten nach,
als dass du etwas rückgängig machen musst.
