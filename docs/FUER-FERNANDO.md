# Für Fernando — was nur du machen kannst

> Stand **11.11.2026** (Abschnitte bis §30) · geschrieben von Seros.
>
> **Neu und zuerst zu lesen: §30** — die Sicherheitsreparatur v33.59. Von ihr ist auf
> der Live-Datenbank NICHTS angewandt und keine Edge-Function ausgeliefert; §30 sagt,
> in welcher Reihenfolge du das tust. **Davor §29** — was am 10./11.11.2026 mit deiner
> Freigabe an der laufenden Auslieferung geschehen ist, welchen Fehler ich dabei gemacht
> habe, und die kurze Liste dessen, was jetzt bei dir liegt.
>
> *(Der Kopf stand bis heute auf 03.09., obwohl die Abschnitte 7–12 vom
> 07./08.09. sind — genau die Art veralteter Ueberschrift, die dieses Repo
> sonst jagt. Nachgezogen.)*
>
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

> ✅ angewandt am 10.11.2026 (gemessen 11.11.): `20260831_rollen_leak_fix_v30_95` —
> Rollenfragen über FREMDE Konten beantworten die beiden nur noch Staff und Admins (§29).
> **Den `REVOKE` unten bitte NICHT mehr ausführen:** Regeln mit `roles=public`
> (Beiträge, Quests, Profile, Feedback, Kommentare, Diagnosen) werten die zwei Funktionen
> auch für Anonyme aus; ohne Ausführungsrecht wird aus „0 Zeilen" die Fehlermeldung
> „permission denied for function" (gemessen in der Sicherheitsprüfung vom 10.11., §30).

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

> **Nachtrag v33.59:** die Datei ist geändert, bevor sie je angewandt wurde — eine Regel
> und ein Befehl gelten jetzt nur für ein EIGENES Gerät. Reihenfolge unverändert; siehe §30.

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

> **Nachtrag v33.59:** die Datei hat einen Wächter bekommen, damit sie die Tagesbindung
> aus `20261110_sicherheit_quiz_punkte.sql` nicht rückgängig macht. Empfohlen: zuerst
> diese, dann jene — beide Reihenfolgen sind nachgespielt. Siehe §30.

> ### ⚠️ Stand 13.09.2026: noch nicht angewandt — und es läuft weiter
>
> Nachgemessen an der Live-Datenbank, **nur lesend**:
> `fn_quiz_option_correct` existiert dort **nicht**. Der Trigger, der läuft,
> heisst `fn_quiz_answers_verify` und rechnet
> `COALESCE((q.options -> NEW.selected_option ->> 'is_correct')::boolean, false)`
> — `options -> <zahl>` trifft nur ein JSON-**Array**. Bei einem Objekt
> (`{answers,correct}` / `{choices,correct}`) kommt NULL heraus, und
> `COALESCE(…, false)` macht daraus **falsch**.
>
> | | |
> |---|---|
> | Fragen in `daily_quizzes` | **215**, alle aktiv |
> | Array-Format (funktioniert) | **5** |
> | `{answers,correct}` · `{choices,correct}` | **150 · 60** |
> | **betroffen** | **210 von 215 = 97,7 %** |
> | Antworten seit 01.09. | **19** — davon **2** richtig, **17** falsch |
>
> Die zwei richtigen dürften die fünf Array-Fragen sein. Das heisst: v33.27
> und v33.28 haben die **App**-Seite in Ordnung gebracht — welche Antwort
> stimmt, wie die Serie zählt, was geübt wird. Die **Rangliste** hängt an
> diesem Trigger, und der verwirft weiterhin fast jede richtige Antwort.
> Dein ursprünglicher Satz trifft also heute noch zu.
>
> Ich wende keine Migration auf der Produktivdatenbank an — das ist die
> stehende Grenze dieser Sitzungen. Die Datei liegt im Repo, ist idempotent
> und in `quiz_check` gegen ein lokales Postgres nachgerechnet (mit
> Reproduktion und Gegenprobe). **Von allem, was hier offen steht, ist das
> der Punkt mit der grössten Wirkung.**

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

## 8 · Der KI-Schlüssel bleibt auf dem Server — ✅ Schritte 1 und 2 ERLEDIGT am 10./11.11.2026 (siehe §29)

> ✅ `20260907_global_api_key_nur_proxy` angewandt am 10.11.2026 (gemessen 11.11.). Der
> Schlüsselwechsel steht in §30 (e) — an ZWEI Stellen, nicht nur im Admin-Panel.

> **Stand 11.11.2026:** die Migration ist angewandt, `ai-proxy` ist neu ausgeliefert
> (version 3). Offen bleibt nur, den Schlüssel selbst zu erneuern — §29, Punkt 2. Der
> Text darunter ist die Anleitung von damals und bleibt als Protokoll stehen.

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

## 9 · Zehn Edge-Functions neu ausliefern (Audit A10, B2, C4, A7 — v32.72 bis v32.76)

Alles im Repo, nichts davon läuft, bis du es auslieferst. Ein Aufruf je Zeile,
Reihenfolge egal; die geteilten Dateien unter `_shared/` (`auth_vergleich.mjs`,
seit v32.75 auch `push_helfer.mjs`) bündelt die CLI automatisch mit.

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
supabase functions deploy species-search
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

**Nachtrag v32.76 (Audit A7):** `species-search` steht seit v32.79 in der
Liste oben (die zehnte). Sie verlangt jetzt einen angemeldeten Nutzer
(GoTrue prüft das Token), sucht mit dessen Token statt mit dem Service-Key
und erlaubt nur die eigenen Origins; sie liest `SUPABASE_ANON_KEY` aus der
Umgebung (Standard in jeder Edge-Function).

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

## 11 · Übersetzungen für die neuen Phrasen erzeugen (Audit E1, v32.78)

> ⚠️ **Wenn du diesen Knopf schon einmal gedrückt hast: bitte noch einmal.**
> Am 08.09. sind in v32.83, v32.88 und v32.90 rund hundert weitere Sätze
> dazugekommen (zusammengesetzte Meldungen, die der Sammler vorher gar nicht
> sehen konnte). Sie stehen sonst in allen vier Sprachen deutsch da. Der Knopf
> übersetzt nur, was fehlt — ein zweiter Druck kostet also fast nichts.

Seit v32.78 nimmt der Sammler auch Toasts, Rückfragen, `placeholder`,
`aria-label` und die Menü-Labels mit. **Gemessen am 08.09.2026:** 674 Sätze
aus dem Quelltext + 235 aus dem Dokument, dazu 1'619 Schlüssel-Einträge. Übersetzt
werden sie erst, wenn du sie bestellst: **Admin-Panel → Karte „🌍
i18n-Bundles" → Knopf „Übersetzungen erzeugen (fr, it, en, es)"**
(`gsAdminBuildI18n`). Warum ein Knopf: `i18n-translate` lässt nur Admin-
oder Service-Token zu (regulären Nutzern antwortet sie 403, die lesen nur
aus `i18n_translations`), und beim Sprachwechsel läuft `gsBuildI18n` nur,
wenn das Paket fehlt oder älter als 24 h ist — neue Phrasen in einem
vorhandenen Paket hätte sonst niemand je bestellt. Die App holt dafür ihre
eigene `index.html`, schickt die Liste an die Function, und die übersetzt
nur, was noch nicht in `i18n_translations` liegt (Hash-Cache). Rechne mit
ein paar Minuten und ein paar Rappen Haiku-Kosten je Sprache; der Toast am
Ende nennt „neu übersetzt" und „schon vorhanden". Danach zeigt ein Nutzer
mit `fr`/`it`/`en`/`es` beim nächsten Paket-Abruf (24 h, oder
Sprachwechsel) die Sätze in seiner Sprache. Vorher: alles wie bisher
Deutsch, nichts kaputt.

Nachmessen (nur lesend):

```sql
select target_lang, count(*) from i18n_translations where source_lang = 'de' group by 1;
```

## 12 · Zwei Dinge aus v32.79, die nur du kannst

1. **Impressum (UWG Art. 3 Abs. 1 lit. s).** Für ein Abo-Angebot verlangt das
   Gesetz klare Angaben zur Identität und eine Kontaktadresse. Die App sagt
   seit v32.79 im Impressum, dass Rechtsträger, Postadresse und UID-Nummer
   noch fehlen. Schick mir die drei Angaben (oder trag sie in
   `index.html` → `showLegalTab` → `impressum` ein, der Hinweis-Absatz
   darunter fliegt dann raus). Wenn GreenScan als Einzelfirma läuft: dein
   Name als Inhaber, eine Postadresse (Postfach reicht), die UID (`CHE-…`),
   falls du eine hast.
2. **pdf.js selbst hosten** (Audit A8, Rest). Die Cloud-Umgebung kommt nicht
   an cdnjs heran (`HTTP 000`), deshalb lädt die App pdf.js seit v32.79 nur
   noch bei Bedarf vom CDN. Wenn du es ins Repo legen willst (dann fällt
   cdnjs aus der CSP und aus `IMAGE_HOSTS`):

   ```bash
   mkdir -p assets/pdfjs
   curl -o assets/pdfjs/pdf.min.mjs https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs
   curl -o assets/pdfjs/pdf.worker.min.mjs https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs
   ```

   und in `index.html` die zwei Adressen `window._gsPdfjsUrl` /
   `window._gsPdfjsWorkerUrl` auf `assets/pdfjs/…` stellen. Die Dateien
   sind zusammen rund 1,5 MB; das Repo trägt Three.js (603 KB) schon.

## 13 · Was die zwölf Auslieferungen vom 08.09.2026 für dich bedeuten

**Kurz: nichts Neues zu tun — mit einer Ausnahme.** v32.84 bis v32.94 sind
alle **rein in der App** (kein Schema, keine Edge-Function, keine Migration).
Deine Liste oben wird dadurch nicht länger.

Die Ausnahme ist **Punkt 11**: es sind rund hundert neue Sätze dazugekommen,
die übersetzt werden wollen. Wenn du den Knopf schon gedrückt hast, bitte
noch einmal.

Zwei Dinge daraus solltest du kennen, weil sie Nutzer betreffen, die du
vielleicht schon gehört hast:

1. **Das Quiz hat richtige Antworten als falsch gewertet** (v32.93). Bei 269
   Arten galt die Giftstufe eines einzelnen Datenbank-Eintrags als richtige
   Antwort, obwohl dieselbe Art an anderer Stelle anders geführt ist — in
   sieben Fällen eine harmlose Stufe für eine giftige Art. Das ist behoben.
   **Das ist NICHT derselbe Fehler wie die Rangliste** (Punkt 7); der wartet
   weiter auf deine Migration.
2. **Das Artendetail zeigte teils eine zu niedrige Giftstufe** (v32.91/92).
   186 Einträge nannten eine niedrigere Stufe als ihre eigene Art — nie eine
   höhere. Auch behoben; die Artenliste selbst (657 mehrfach geführte Arten)
   bleibt unverändert, dafür braucht es eine Flora, keinen Code.

## 14 · ERLEDIGT in v33.04 — „4'337 Arten" sind 3'136 Arten

> **Du hast am 09.09. „weiter mit den ausstehenden Sachen" gesagt. Ich habe
> deshalb den Weg genommen, den ich unten selbst vorgeschlagen hatte — Weg 1:
> das Wort ändern, beide Zahlen behalten.** Nichts davon ist eine Einbahn-
> strasse: willst du lieber Weg 2 (nur „3'136 Arten") oder Weg 3, sag es, das
> ist eine halbe Stunde.
>
> **Was jetzt dasteht:** wo „Arten" steht, steht **3'136**. Wo es um die Zeilen
> der Liste geht, heisst es **„4'337 Einträge"**. Im Über-Fenster stehen beide:
> *„3'136 Arten in 4'337 Einträgen"*. Deine grosse Zahl ist also nicht weg, sie
> hat nur das richtige Wort bekommen.
>
> **Und die alte 4342 ist überall raus** — auch aus den Seitenbeschreibungen
> für Google, aus `manifest.json` und aus `install.html`. Sie stand dort, weil
> ich sie bewusst NICHT nachgezogen hatte, solange die Aussage noch falsch war.
>
> **Damit es nicht wieder veraltet:** fünf Stellen rechnen die Zahl jetzt live
> aus der Liste (`gsArtenZahlen()`), und ein Prüfstand (`nutzersicht_check` E9)
> zählt selbst nach und wird rot, sobald irgendwo eine Zahl neben dem falschen
> Wort steht. **Vorher gab es dafür keinen Auslöser — deshalb stand die alte
> Zahl monatelang da.**

<details><summary>Die ursprüngliche Vorlage mit den drei Wegen (zum Nachlesen)</summary>

**Nur eine Entscheidung, keine Arbeit für dich — und nichts davon ist kaputt.**
Ich habe heute nachgezählt und die Zahl stimmt nicht mit dem Wort zusammen,
das danebensteht.

| | |
|---|---|
| Einträge in der Artenliste | **4'337** |
| verschiedene Arten darin | **3'136** |

Der Grund ist harmlos und war so gebaut: **jede Zeile trägt EINEN deutschen
Namen.** Der Bärlauch steht viermal drin — als „Bärlauch", „Echter Bärlauch",
„Bärlauch-Pesto" und „Echter Bärlauch (Wald)". Alle vier sind *Allium
ursinum*. 644 Arten haben so mehr als eine Zeile; 1'142 Zeilen sind
Zweit- und Drittnamen.

Nur: **„Art" heisst Art.** „4'337 Arten" zählt den Bärlauch viermal — auf der
Startseite, in den Einstellungen, im Über-Fenster, im Onboarding, in den
Seitenbeschreibungen für Google und in `install.html`.

### Drei Wege, alle ehrlich — such dir einen aus

1. **Wort ändern, Zahl behalten** — „4'337 **Einträge**", und im Über-Fenster
   ein Satz dazu: „zu 3'136 Arten". *Kostet dich keine einzige beworbene
   Zahl und ist wahr.* Das wäre mein Vorschlag.
2. **Zahl ändern** — „3'136 Arten". Am klarsten, aber deine Schlagzeile
   schrumpft um gut ein Viertel.
3. **Beides** — „3'136 Arten · 4'337 Namen". Am ehrlichsten, am längsten.

**Was ich NICHT gemacht habe und bewusst nicht mache:** in den
Seitenbeschreibungen steht noch die alte `4342`. Die auf `4337` nachzuziehen
wäre falsch — dann wäre die Zahl frisch und die Aussage immer noch nicht
wahr. Deshalb liegt dort weiterhin die alte Zahl, bis du dich entschieden
hast.

Sag mir einfach welchen Weg, dann setze ich ihn in einem Rutsch um (zwölf
Stellen in `index.html`, dazu `install.html`, dazu die vier Sprachen).

</details>

**Nachgemessen am 09.09.2026** (mit `_gsNormLat` aus der App, nicht geschätzt):
4'337 Einträge · 3'136 Arten · **660** Arten mit mehr als einer Zeile · 1'201
Zweit- und Drittnamen. Die älteren Zahlen unten (644 / 1'142) sind auf anderer
Grundlage gemessen und bleiben als Aufzeichnung stehen.

### Ein Nebenfund aus derselben Zählung

Die Mehrfach-Zeilen einer Art **widersprechen sich bei der Giftigkeit**:

```
„Wiesenkerbel"        tox 2 · nicht essbar
„Echter Wiesenkerbel" tox 1 · essbar          (dieselbe Pflanze)
```

Das ist derselbe Bestand wie die 167 widersprüchlichen Gruppen aus
`docs/arten-widersprueche.csv`. Seit v32.92 zeigt die App überall die
**vorsichtigere** Angabe, die Anzeigen sind also sicher — aber die Daten
selbst bleiben uneins, und das kann nur jemand mit einer Flora auflösen.
Und Zeilen wie „Bärlauch-Pesto" sind gar keine Arten; wie viele davon in der
Liste stehen, kann ich von hier aus nicht sagen.

Alles nachgemessen und ausführlich in `docs/ARTEN-DATEN.md` §8.

## 15 · `delete-user` neu ausliefern — Konto löschen räumt jetzt auch die Cloud (v33.17)

Gemessen, nur lesend, am 10.09.2026: „Konto löschen" liess **169 Fotos und
PDFs** in drei Buckets liegen (alle unter `<uid>/`), zwei Tabellen mit
`user_id` ohne Fremdschlüssel standen in keiner Liste, und wer eine
Organisation erstellt hatte, bekam ein halb gelöschtes Konto (Tabellen und
Profil weg, Login stehen — `organizations.created_by` ist RESTRICT).

Alles im Repo, nichts davon läuft, bis du es auslieferst:

```bash
supabase functions deploy delete-user
```

Die geteilte Datei `_shared/loeschung_regeln.mjs` bündelt die CLI automatisch
mit (wie bei `device-ingest`).

**Was danach anders ist:**

- Ersteller einer Organisation bekommen **409** mit dem Namen — und die App
  sagt „Übertrage oder lösche sie zuerst". Es wird **nichts** gelöscht. Eine
  Übertragung gibt es heute nicht; das ist eine Produktentscheidung.
- Storage-Objekte unter `<uid>/` in `scan-images`, `species-images`,
  `book-pdfs` (und `recipe-photos`, falls es den Bucket gibt) werden mit dem
  Konto gelöscht — je Bucket gezählt in `tables['storage:<bucket>']`.
- `ai_usage` und `species_search_log` werden geräumt.

**Danach prüfen** (ein Testkonto, nichts Echtes): Konto löschen, dann in
`storage.objects` nachsehen, dass unter der uid nichts mehr liegt, und in
`audit_log` den Eintrag `delete_user` mit den Zählern ansehen.

**Was bewusst BLEIBT** (mit Grund in `BEWUSST` im Modul): anonymisierte
Zählungen (`analytics_events`, `client_errors` → `user_id` null), Beiträge zum
Gemeingut (Artenbilder, Saison-Tipps), Prüfvermerke, Meldungen über andere
(Moderationsbeleg). Wer das anders will, ändert das Modul — der Prüfstand
`loeschung_check` sagt dann, was sich verschiebt.

## 16 · Migration `20260910_admin_analytics.sql` — die Nutzungsmessung lesen (v33.18)

Seit v33.11 schreibt die App Ereignisse nach `analytics_events` (Opt-in,
benanntes Vokabular, keine Namen). Gelesen hat sie bis v33.18 niemand. Die
Migration legt `fn_admin_analytics(p_days)` an — Zaehlung je Ereignis und
Tag, nur Zahlen, nur fuer Admins (dasselbe Tor wie `fn_admin_metrics`).

**Anwenden** wie §5–§7: Dashboard → SQL Editor → Datei einfuegen → Run.
Idempotent, aendert keine Tabelle, loescht nichts. Danach zeigt das
Admin-Panel die Karte „📈 Nutzung (letzte 30 Tage)" mit Zahlen; bis dahin
sagt sie, dass die Migration fehlt.

**Danach pruefen:** `select public.fn_admin_analytics(30);` als Admin — eine
JSON-Antwort mit `total`, `by_event`, `by_day`. Als Nutzer: `forbidden`.

**Was sie NICHT tut:** keine Namen, keine Kennungen, keine Inhalte — die
Antwort enthaelt nur Zaehlungen (der Pruefstand `nutzung_check` haelt das
fest: keine `user_id`, keine `session_id` in der Antwort).

**Und die zweite Migration dazu (v33.24):**
`20260910_analytics_retention.sql` legt `fn_analytics_prune` an und plant
einen taeglichen Cron (`analytics-prune`, 03:40 UTC), der Ereignisse aelter
als 180 Tage loescht — revDSG: Speicherbegrenzung. Gleich anwenden; sie
loescht beim Anwenden selbst nichts, erst der Cron. Wer die Frist aendern
will, aendert BEIDE Zahlen: `p_days integer DEFAULT 180` in der Migration und
`GS_ANALYTICS_TAGE` in `index.html` — `nutzung_check` wird sonst rot.

## 17 · Was der Aufbau vom 10.–11.09.2026 (v33.06 – v33.24) bei dir liegen lässt

Neunzehn Auslieferungen, alle mit Prüfstand und vollem Lauf. **Vier Dinge
kannst nur du** — in dieser Reihenfolge, jedes mit Gegenprobe oben:

1. **`supabase functions deploy delete-user`** (§15) — sonst bleiben Fotos
   nach „Konto löschen" liegen, und Organisations-Ersteller behalten ein
   halbes Konto. Am wichtigsten, weil es ein Versprechen im Dialog betrifft.
2. **`20260910_admin_analytics.sql`** anwenden (§16) — die Karte „Nutzung" im
   Admin-Panel zeigt bis dahin, dass sie fehlt.
3. **`20260910_analytics_retention.sql`** anwenden (§16, zweiter Teil) — die
   180-Tage-Frist; ohne sie wächst `analytics_events` ohne Ende.
4. **Übersetzungs-Knopf** (§11) noch einmal — rund vierzig neue Sätze
   (Kalender-Zeile auf der Startseite, Aussaatfenster im Scan, Vorlagen,
   Lina-Werkzeuge, Sperre beim Löschen) stehen sonst in fr/it/en/es deutsch.

**Eine Entscheidung, keine Anleitung:** wer eine Organisation erstellt hat,
kann sein Konto nicht löschen, solange sie ihm gehört (`organizations
.created_by` ist RESTRICT — das war schon vorher so, nur sagte es niemand).
Die App sagt es jetzt vorher. Ob es eine **Übertragung** an ein anderes
Mitglied geben soll, ist eine Produktfrage; heute sind es zwei
Organisationen.

**Was du sehen wirst, ohne etwas zu tun:** „Heute im Kalender" auf der
Startseite, das Aussaatfenster unter einem Tomaten-Scan, der 📅-Knopf und
die ⏳-Zeile bei gespeicherten Plänen, „Drittes Foto" nach dem zweiten,
Linas „Letzter Scan: …" — alles rein in der App.

## 18 · Update ohne Klick (v33.25) — ein Handgriff am iPhone

Die App wendet Updates jetzt selbst an: beim Start, oder wenn du nach mehr als
fünf Minuten Pause zurückkommst — nie, während etwas läuft oder ein Fenster
offen ist. Von hier aus ist das im Browser gemessen (`offline_check` Fall 11,
22 Fragen grün). **Nicht messbar ist iOS:** Safari friert eine PWA im
Hintergrund ein. Bitte einmal so: App auf dem iPhone öffnen, in den Hintergrund
legen, mindestens sechs Minuten warten (nach einem Deploy), zurückkommen. Was
erwartet wird: ein kurzer weisser Start, dann derselbe Bereich wie vorher und
entweder „Was ist neu" oder ein Toast „✅ Aktualisiert auf v33.xx". Was NICHT
passieren darf: ein Reload, während du gerade etwas tippst oder ein Scan-Foto
offen ist. Wenn du etwas anderes siehst: Version (Einstellungen → Über) und
was auf dem Bildschirm war, und ich baue den iOS-Zweig danach.

## 19 · Eine Migration für das Backup (v33.26)

`supabase/migrations/20260912_snapshot_retention_manual.sql` — **nicht
angewandt**, wie alle anderen. Sie ändert genau eine Funktion:
`fn_cleanup_user_snapshots` schützt künftig auch `manual`.

**Warum:** die Aufbewahrung hält je Nutzer sechs Stände plus den je neuesten
`pre_migration` / `auto_daily` / `pre_logout`. Ein Backup, das du selbst
angelegt hast („Cloud-Backup & Sync" → tippen), steht in dieser Liste nicht —
und seit v33.25 entsteht bei jeder Auslieferung ein `pre_migration`. Am
10.09. waren das vierzehn an einem Tag.

**Anwenden** (im SQL-Editor, die Datei ganz einfügen) und danach nachsehen:

```sql
select pg_get_functiondef('public.fn_cleanup_user_snapshots'::regproc)
       like '%''manual''%' as manual_geschuetzt;   -- erwartet: t
```

Es wird dabei nichts gelöscht und nichts angelegt — nur die Funktion ersetzt.
`node scripts/backup_check.js` rechnet dieselbe Regel vorher in einem lokalen
Postgres nach.

## 20 · Dem Quiz gehen die Fragen aus — am 16. Juni 2027 (v33.29)

Das ist kein Fehler, sondern eine Rechnung. Alle Zahlen am **14.09.2026 nur
lesend** an der Live-Datenbank gemessen.

**Wie das Quiz seine Frage waehlt.** `fn_get_daily_quiz` merkt sich in
`daily_quiz_history`, welche Frage an welchem Tag dran war, und nimmt zwei
Jahre lang keine zweimal. Stand heute: 215 Fragen, 34 Tage gespielt (11.06. bis
12.09.), **181 Fragen noch nie dran**.

**Wie Nachschub entsteht.** Jede Nacht um 03:30 laeuft `knowledge-growth-daily`
und bittet die KI um 12 neue Eintraege — aber reihum fuer **35 verschiedene
Themen**. Das Quiz ist eines davon, kommt also **alle 35 Tage** dran. Gemessen:
01.07. · 05.08. · 09.09., jedes Mal genau 12 Fragen. Der naechste Lauf ist am
**14.10.2026**.

```
kommt herein   12 Fragen alle 35 Tage  =  0,34 pro Tag
geht heraus     1 Frage  pro Tag       =  1,0  pro Tag
                                         -------------
                                          −0,66 pro Tag
```

Bei 181 freien Fragen ist der Vorrat in **275 Tagen** leer, also um den
**16. Juni 2027**. Danach passiert nichts Dramatisches — das Quiz faellt auf
seinen Rueckfall zurueck und fragt eine Frage noch einmal. Nur sagt es das
niemandem, und die Zwei-Jahres-Regel gilt ab dann faktisch nicht mehr.

### Was du entscheiden kannst

**a) Mehr Fragen je Lauf.** Damit der Vorrat nicht schrumpft, muesste ein Lauf
**35** Fragen liefern statt 12 — oder das Quiz muesste oefter als alle 35 Tage
an die Reihe kommen. Beides kostet KI-Aufrufe; deshalb habe ich es nicht
gemacht. Der Wert steht in `fn_knowledge_growth_daily` (`'count', 12`).

**b) Die Migration `20260827_quiz_bilder_und_fragen_v30_85.sql` anwenden.** Sie
liegt seit dem 27.08. bereit und bringt **42 neue Fragen** (+42 Tage Vorrat)
und die Bildfragen. Nachgemessen: die Spalten `image_url`, `image_credit` und
`image_alt` gibt es in `daily_quizzes` **nicht** — die Abfrage danach bricht
mit `42703: column "image_url" does not exist` ab. Die App rendert sie seit
v30.85 trotzdem; der Block kann also noch nie gefeuert haben. Achtung: die
Migration aendert die Rueckgabe von `fn_get_daily_quiz` (DROP + CREATE, Rechte
neu setzen) — das steht im Kopf der Datei.

> **Vorbereitet in v33.29:** ihre 43 Fragen tragen 15 Kategorien, davon zwoelf,
> die es sonst nirgends gibt (`mushroom_safety`, `soil`, `garden_care`,
> `birds`, `alpine` und sieben weitere). Waeren sie nicht im Vokabular, haetten
> **38 der 43 Fragen gar keine Kategoriezeile** — das ist beim Bauen aufgefallen
> und behoben. Du kannst die Migration also anwenden, ohne dass in der App
> etwas leer bleibt.

**c) Die Migration `20260914_quiz_vorrat.sql` anwenden** (neu, mit v33.29). Sie
aendert nichts am Quiz, sie MISST nur: `fn_quiz_vorrat()` liefert die Zahlen,
und `fn_quiz_vorrat_pruefen()` schreibt ab 60 verbleibenden Tagen eine Warnung
nach `system_events` (unter 14 Tagen `error`). Dann meldet sich der Server von
selbst, statt still zu wiederholen. Nachgerechnet in `quiz_gen_check` gegen ein
lokales Postgres, inklusive Gegenprobe.

**d) Die Kategorien in der Datenbank aufraeumen.** Die 215 Fragen tragen **23
verschiedene** Kategorien in zwei Sprachen, darunter vier Paare, die dasselbe
meinen (`heilpflanzen`/`medicinal`, `edible_toxic`/`toxicity`,
`species_id`/`identification`, `wildpflanzen`/`foraging`). Seit v33.29 uebersetzt
die App sie alle auf zwoelf saubere Kategorien, und der Generator darf keine
neuen mehr erfinden — **du musst also nichts tun**. Wenn du trotzdem aufraeumen
willst, ist es ein `UPDATE` auf der Produktivdatenbank, und das mache ich von
hier aus nicht.

> Was v33.29 schon getan hat, ohne dich: die Anzeige zeigt statt
> „Kategorie: edible_toxic" jetzt „Giftigkeit", in vier Sprachen; neue Fragen
> werden vor dem Anlegen geprueft (vier Antworten, richtige Antwort im Bereich,
> Erklaerung da); und zwei gleiche Fragen aus derselben Lieferung kommen nicht
> mehr beide durch.

## 21 · Der denkende Kalender ist fertig (v33.34 – v33.41) — drei Migrationen warten auf dich

Dein Auftrag vom 14.09. ist geliefert, in sieben Scheiben. Was dabei
herauskam, ist unten in zwei Listen: **was jetzt anders ist** und **was du
anfassen musst**. Alles darunter ist gemessen, nicht geschätzt — die Zahlen
stehen in `STATUS.md` (Einträge id bis il) und in `docs/KALENDER-V2.md`.

### Was jetzt anders ist (ohne dein Zutun, schon live)

| | |
|---|---|
| **Der Kalender denkt** | Er hält seine Ereignisse gegeneinander: Frost trifft eine Aussaat draussen, Regen übernimmt das Giessen, eine Ernte-Schätzung ohne Eintrag, eine Aufgabe in deinen Stillen Tagen. Jede Regel hat drei Zustände — erfüllt, verletzt, **„Nicht bekannt" mit Grund**. Nie Stille. |
| **Ein Sieb statt einer Flut** | Fünf Chips mit ihren Zahlen; Messwerte und Scans sind von Anfang an aus. Der Filter siebt das Ergebnis, die Rechnung bleibt vollständig — sonst wäre „N von M" falsch und Lina blind. |
| **Ein Wetter für die ganze App** | Frost, Hitze, Starkregen, Sturm stehen in EINER Tabelle. Das Warnfenster liest denselben Zwischenspeicher wie der Kalender und sagt „keine Vorhersage" statt „alles im grünen Bereich". |
| **Scans, Fundorte und die wirkliche Ernte** | Sie standen in der App und nicht im Kalender. Jetzt beides — und die Schätzung ist von der wirklichen Ernte unterscheidbar. |
| **„Mein Naturjahr" stimmt** | Die Kachel „Funde" stand **seit jeher auf 0** (sie las ein Feld, das niemand schreibt), und „Arten" zählte ohne Jahresfilter. Beides kommt jetzt aus dem Kalender. Die Garten-Timeline ist darin aufgegangen — der Menüeintrag heisst „Rückblick". |
| **Lina sieht den Kalender** | Drei Zeilen: heute, die Woche, die Hinweise. Sie darf einen Termin **vorschlagen**, den du bestätigst. Und ihr Kontext bricht nicht mehr mitten im Wort ab. |
| **Die Woche an einer Stelle gerechnet** | „Diese Woche: 5 Aufgaben · 1 Aussaatfenster · Frost am 18.09. · 2 Hinweise." — auf der Startseite, im Kalender und bei Lina, immer dieselben Zahlen. |

### Was du anfassen musst: drei Migrationen

Alle drei liegen im Repo und sind **nicht angewandt** — DDL auf der
Produktivdatenbank ist dein Handgriff, nicht meiner. Sie betreffen **dieselbe
Sicht** und bauen aufeinander auf: **die letzte allein genügt**, sie enthält
die anderen beiden.

```
supabase/migrations/20260916_plant_tasks_due_plantings.sql     ← diese eine reicht
```

**Warum das nicht warten sollte.** Live gemessen am 16.09.: du hast **15
Pflanzungen in Beeten mit Pflege-Aufgaben**, und die Sicht, aus der der
Erinnerungs-Cron liest, hatte **23 Zeilen — alle aus „Meine Pflanzen"**. Für
keine einzige Beet-Pflanze ist je eine Erinnerung verschickt worden. Die App
zählt beide Listen, der Server eine.

> **Und eine Warnung, die ich dir schulde:** die zwei älteren Migrationen
> (`20260903…snooze`, `20260904…vorgezogen`) standen seit Tagen in der Liste
> als „bereit" — und **wären beim Anwenden gescheitert**. `CREATE OR REPLACE
> VIEW` darf in Postgres Spalten nur anhängen, nie in der Mitte einfügen; das
> tun beide. Ich habe es erst gemerkt, als ich sie in einer echten Datenbank
> ausgeführt habe. Alle drei sind jetzt DROP + CREATE und laufen — zweimal
> hintereinander geprüft. Nichts hängt an der Sicht (nachgesehen), der DROP
> ist gefahrlos.

### Und eine zweite Sache, die schon jetzt repariert ist

Die **saisonale Erinnerung** („Saisonale Aufgabe: …") hat seit ihrem Bau
**keine einzige** verschickt. Sie filterte auf eine Spalte namens `priority` —
die gibt es in `garden_tasks_catalog` nicht (189 Zeilen, die Spalte heisst
`importance`). Die Datenbank hat jedes Mal einen Fehler zurückgegeben, und der
Code hat ihn weggeworfen, statt ihn zu melden. Das ist im Repo behoben; es
wirkt, sobald du `daily-push-checker` neu auslieferst.

## 22 · Die Android-App ist da — ein Handgriff fehlt: dein Schlüssel (v33.49)

**Du hast geschrieben:** „Ich hätte gerne eine Apk daraus erstellt. […] Es soll
so eine Apk gemacht werden wie Whatsapp die man vom Internet aus herunterladen
kann. Keine Web app mehr sondern eine richtige App die noch besser als die
Webapp version funktioniert."

**Das ist gebaut.** `bash android/build.sh` erzeugt hier ein fertiges,
signiertes APK (4,6 MB). Es ist dieselbe App — aber die Dateien liegen **im
Paket**: sie startet ohne Empfang, hat nie eine Adressleiste, und der Play
Store kommt darin nicht vor.

### Was ich NICHT gemacht habe, und warum

**Ich habe keinen Signatur-Schlüssel für dich angelegt.** Der Schlüssel ist
das eine Stück, das dir gehören muss:

> Android lässt ein Update nur mit **derselben** Signatur zu. Wer den
> Schlüssel hat, kann Updates für deine App ausliefern. Wer ihn verliert, kann
> es nie mehr — jeder Nutzer müsste deinstallieren, und seine App-Daten wären
> weg.

Deshalb baut `build.sh` ohne `--release` mit einem **Wegwerf-Schlüssel** und
nennt die Datei `greenscan-ENTWICKLUNG-v33.49.apk`. Die ist zum Ausprobieren
gedacht. **Verteile sie nicht** — wenn du später auf deinen eigenen Schlüssel
wechselst, zwingst du jeden, der sie installiert hat, zur Neuinstallation.

### Drei Schritte

**1 · Schlüssel anlegen** (einmal, dauert eine Minute):

```bash
keytool -genkeypair -v \
  -keystore ~/greenscan-release.keystore \
  -alias greenscan -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=GreenScan, O=GreenScan, L=Zuerich, C=CH"
```

Lege die Datei und das Passwort an **zwei Orte, die nicht derselbe Ort sind**
(z. B. Passwort-Manager + verschlüsselte Sicherung). Nicht ins Repo — der
Prüfstand `apk_check` R7 wacht darüber.

**2 · Damit bauen:**

```bash
read -rs -p 'Passwort des Schluessels: ' GS_APK_KS_PASS && export GS_APK_KS_PASS
GS_APK_KS=~/greenscan-release.keystore \
GS_APK_ALIAS=greenscan \
bash android/build.sh --release
unset GS_APK_KS_PASS
```

Das Passwort wird **gelesen, nicht getippt** (berichtigt in v33.59): steht es in der
Befehlszeile, landet es im Shell-Verlauf. `build.sh` reicht es nur über die Umgebung an
`apksigner` weiter, nie als Argument — Argumente sind in der Prozessliste lesbar. Bis
v33.58 stand hier die alte Fassung mit dem Passwort in der Zeile; wer sie benutzt hat,
löscht die Zeile aus `~/.bash_history` (bzw. dem Verlauf seiner Shell). Dieselbe Anleitung
steht in `android/README.md` unter „2 · Damit bauen“.

→ `android/build/greenscan-v33.49.apk`

**3 · Hinlegen:** die Datei auf green-scan.ch verlinken (z. B.
`green-scan.ch/app`). Wer sie auf dem Telefon öffnet, muss einmal
„Aus dieser Quelle installieren" erlauben — das ist bei jeder App so, die nicht
aus dem Play Store kommt. Der Bau nennt dir den **SHA-256 der Signatur**;
schreib ihn daneben, dann kann jeder prüfen, dass die Datei von dir ist.

### Was du beim ersten Start prüfen musst — und nur du kannst

**Hier läuft kein Android.** Der Prüfstand prüft den Bau, die Rechnung und die
Entscheidungen der App; wie sich ein echtes Telefon verhält, sagt er
ausdrücklich **nicht**. Vier Dinge, in dieser Reihenfolge:

1. **Flugmodus an, dann die App öffnen.** Startet sie? Sind Lexikon und Suche
   voll? Das ist die Frage, für die das ganze Paket gebaut ist.
2. **Einen Scan machen.** Die Kamera fragt beim ersten Mal nach Erlaubnis.
3. **Zurück-Knopf:** ein Druck schliesst EIN Fenster, nicht die App.
4. **Anmelden.** Die App ist zuerst leer — eine WebView hat ihren eigenen
   Speicher, getrennt vom Browser. Nach dem Anmelden holt der Abgleich alles
   aus der Cloud.

Sag mir, was du siehst — besonders, wenn etwas davon **nicht** stimmt.

### Was in der App noch nicht geht (und in der App auch so steht)

| | Warum | Wann |
|---|---|---|
| **Erinnerungen (Push)** | hängt am Service Worker, den es in der Hülle nicht gibt | als **lokale** Android-Benachrichtigung möglich — nächste Scheibe |
| **Export** (Backup, GPX, CSV, PDF) | eine WebView hat keinen Speicherweg für eine Datei aus dem Arbeitsspeicher | braucht eine schmale Brücke zur Android-Schicht — nächste Scheibe |
| **Teilen an GreenScan** (aus einer anderen App) | eine WebView liest das Web-Manifest nicht | braucht einen `intent-filter` — nächste Scheibe |

Alle drei **sagen** es in der App, statt still nichts zu tun. Im Browser auf
green-scan.ch funktionieren sie weiter.

### Und der Play Store?

Bleibt möglich, **neben** diesem Paket: der Paketname `ch.greenscan.app` und
`.well-known/assetlinks.json` sind derselbe. Dafür bräuchte es weiterhin die
zwei Fingerabdrücke aus der Play Console (Punkt in `docs/ANDROID-APK.md`) —
und die Entscheidung Stripe vs. Play Billing. **Für den Weg, den du wolltest,
brauchst du davon nichts.**

---

## 23 · ~~Zwei Admin-Knöpfe sind tot~~ — ✅ ERLEDIGT am 10.11.2026 (Migration `20260924_admin_grants` angewandt, siehe §29)

> ✅ angewandt am 10.11.2026 (gemessen 11.11.: `authenticated` darf beide Funktionen ausführen).

**Du hast geschrieben:** „Zugleich möchte ich dass du den Admin-Panel noch
besser, sauberer, sicherer und erweitert aufbaust."

**Zuerst die gute Nachricht, gemessen an der Live-Datenbank (nur lesend):**
das Admin-Panel ist **sicher**. Zwölf von dreizehn Schreib-Funktionen prüfen
selbst, ob der Aufrufer Admin ist, und die Tabelle der Meldungen lässt nur
Admins ändern. Ein Nicht-Admin kommt an keiner Stelle durch.

**Die schlechte:** zwei Knöpfe tun seit Langem nichts —

| Knopf | Funktion | Was passiert heute |
|---|---|---|
| „🚫 Nutzer sperren" / Rolle vergeben | `fn_assign_role` | Rückfrage „wirkt sofort" — danach `permission denied for function` |
| „Globalen KI-Schlüssel setzen" | `fn_set_global_api_key` | dasselbe |

Beide Funktionen dürfen nur `postgres` und `service_role` ausführen — ein
angemeldeter Admin (Rolle `authenticated`) nicht. Im Repo liegen seit v29
und v30 zwei Migrationen, die genau das nachliefern sollten; **live sind sie
nicht in Kraft.** Ob sie nie angewandt wurden oder ein späteres REVOKE sie
überholt hat, sagt die Datenbank nicht.

### Was du tust

Die Migration `supabase/migrations/20260924_admin_grants.sql` anwenden
(Supabase-Dashboard → SQL-Editor, Inhalt einfügen, ausführen). Sie enthält
genau zwei Zeilen Wirkung:

```sql
grant execute on function public.fn_assign_role(uuid, text, text)          to authenticated;
grant execute on function public.fn_set_global_api_key(text, text, boolean) to authenticated;
```

**Das öffnet nichts.** Beide Funktionen prüfen die Admin-Rolle in ihrem
Rumpf und lehnen jeden anderen ab — `fn_assign_role` über
`profiles.role = 'admin'`, `fn_set_global_api_key` über `fn_is_role('admin')`
(berichtigt in v33.51: hier stand vorher „`is_admin_user()`"; dein Konto
besteht beide Prüfungen). Das GRANT macht diese Prüfung nur erreichbar.
Idempotent: zweimal ausführen schadet nicht.

### Was die App bis dahin tut

Seit v33.50 sagt sie es an drei Stellen, statt eine Rückfrage zu stellen und
danach zu scheitern: der Knopf trägt einen gelben Satz mit dem Dateinamen der
Migration, die Rückfrage entfällt, und der Überblick oben im Panel zählt
„🔒 2 Aktionen noch nicht freigegeben". Nach dem Anwenden ist das beim
nächsten Öffnen von selbst weg — die App merkt sich die Sperre nur für die
laufende Sitzung.

### Und eine Sache, die ich gemessen hatte — und die in v33.51 anders ausging

Hier stand: „`gs_admin_log` wird geschrieben und niemand liest es." Genauer
gemessen (25.09.2026): das war das **gerätelokale** `gs_admin_log` (zwei
Schreiber, null Leser — jetzt weg). Das **Server**-Protokoll `audit_log` liest
dein Panel längst („Letzte Admin-Aktionen"). Was fehlte, war etwas anderes:
fünf Aktionen kamen dort nie an. Siehe §24.

## 24 · Das Admin-Protokoll kennt jetzt jede Aktion — eine Migration fehlt (v33.51)

**Was ich gemessen habe (Live-DB, nur lesend, 25.09.2026):** dein Admin-Panel
hat ein Protokoll („Letzte Admin-Aktionen", Tabelle `audit_log`) — aber fünf
von fünfzehn Aktionen kamen dort nie an. Darunter zwei, bei denen es am
meisten zählt: **einen Foto-Beitrag freigeben oder ablehnen** und **einen
Arten-Vorschlag aufnehmen oder ablehnen**. „Wer hat das abgelehnt, und wann?"
war nicht zu beantworten. Dazu „Meldung erledigen", das gar keine
Server-Funktion hatte, sondern die Tabelle direkt änderte.

Zwei bleiben bewusst ohne Eintrag: der Integritäts-Scan (liest nur) und der
Broadcast (steht je Empfänger unter Push-Versand).

### Was du tust

Die Migration `supabase/migrations/20260925_admin_audit_vollstaendig.sql`
anwenden (Supabase-Dashboard → SQL-Editor, Inhalt einfügen, ausführen). Sie
ändert drei Funktionen:

| Funktion | Was sich ändert |
|---|---|
| `fn_admin_review_species_image` | Rumpf wie heute, plus eine Protokollzeile `species_image_review` |
| `fn_admin_review_species_proposal` | Rumpf wie heute, plus `species_proposal_review` — beim Aufnehmen UND beim Ablehnen |
| `fn_admin_review_report` | **neu**: Meldung erledigen als Server-Funktion mit Admin-Prüfung und Protokollzeile `report_review` |

Idempotent: zweimal ausführen schadet nicht. Der Prüfstand `admin_check`
spielt die Datei in einem lokalen Postgres zweimal ein und ruft alle drei
Funktionen als Admin und als Nicht-Admin — die Rechnung stimmt; ob sie bei
dir läuft, siehst du so:

### Woran du es erkennst

Unter „Letzte Admin-Aktionen" steht seit v33.51 ein Fuss: **„Spur: 10 von 15
Aktionen protokolliert der Server · 3 erst nach Migration 20260925 …"**.
Sobald du nach dem Anwenden das erste Foto prüfst, einen Vorschlag
entscheidest oder eine Meldung erledigst, steht dort **„Spur gesehen"** — und
wenn alle drei einmal gelaufen sind, **„Migration angewandt"**. Die App sagt
nur, was sie gesehen hat; sie rät den Server-Stand nicht.

Bis dahin funktioniert „Meldung erledigen" weiter — über den alten Weg, und
die Meldung sagt dann ehrlich „Ohne Protokolleintrag — Migration … anwenden".

### Eine Berichtigung zu §23

Dort steht, beide Funktionen prüften `is_admin_user()` selbst. Gemessen:
`fn_assign_role` prüft `profiles.role = 'admin'`, `fn_set_global_api_key`
ruft `fn_is_role('admin')`. Beides sind Admin-Prüfungen — **der Schluss
bleibt: das GRANT öffnet nichts.** Und dein Konto besteht beide Prüfungen
(Rolle `admin`, `is_admin`, in `admin_emails`). Nur der Satz war ungenau.

### Und etwas, das ich notiert und nicht angefasst habe

Drei Admin-Funktionen (`fn_assign_role`, `fn_admin_flag_set`,
`fn_set_global_api_key`) haben **im Repo keinen Quelltext** — sie stehen nur
in der Datenbank. Wenn die Datenbank je neu aufgesetzt werden müsste, wären
sie weg. Der saubere Weg ist ein Dump aus deiner Datenbank
(`supabase db dump --schema public` oder der SQL-Editor mit
`pg_get_functiondef`), als Migration eingecheckt. Das ist ein Klick bei dir,
keine Abschrift von mir — eine Abschrift ohne Nachweis wäre keine Quelle.

## 25 · Freundschaften: eine zu grosszügige Regel — eine kleine Migration (v33.52)

**Was ich gemessen habe (Live-DB, nur lesend, 06.10.2026):** die App bietet
„Annehmen" nur der Person an, die gefragt wurde. Der Server war grosszügiger:

| Weg | ging live |
|---|---|
| Die eigene Anfrage selbst annehmen | ja |
| Eine Zeile „A und C sind befreundet" gleich als angenommen anlegen — C erfährt nichts | ja |
| Bei einer bestehenden Anfrage die andere Person gegen eine dritte austauschen | ja |

**Wie schwer das wiegt, ehrlich:** die Tabelle hat heute **0 Zeilen**, und
nichts auf dem Server liest den Freundschafts-Status. Eine erzwungene
Freundschaft öffnet heute nichts, sie steht nur in einer Liste. Die Regel
soll trotzdem richtig sein, bevor eines Tages etwas sie liest — etwa „Funde
nur für Freunde sichtbar".

### Was du tust

Die Migration `supabase/migrations/20261006_friendships_nur_empfaenger.sql`
anwenden (Supabase-Dashboard → SQL-Editor). Sie ändert drei Dinge:

- eine Anfrage kann nur als „wartet" angelegt werden,
- annehmen kann nur, wer gefragt wurde,
- ändern lässt sich nur der Status, nie die beiden Personen.

Zurückziehen bleibt für beide Seiten möglich. Die App schickt schon heute
genau das, was danach erlaubt ist — an ihr ändert sich nichts. Der Prüfstand
`naht_check` spielt den heutigen Stand in einem lokalen Postgres nach, zeigt
alle drei Wege, wendet die Datei zweimal an und prüft, dass danach jeder der
drei scheitert und Anfragen, Annehmen und Zurückziehen weiter gehen.

### Und die eigentliche Arbeit dieser Version

Vier Stellen sagten „gespeichert", sobald der Server keinen Fehler meldete —
Profil speichern, Freundschaft annehmen und zwei Foto-Wege. Bei einer
Änderung, die der Server nicht erlaubt, meldet er aber keinen Fehler, er
ändert einfach null Zeilen. Das ist ohne dein Zutun repariert; die App zählt
jetzt die Zeilen.

**Und eine Berichtigung:** in v33.50 hatte ich „rund 176 Stellen" als
gemessen genannt. Das war eine Schätzung über alle Fehler-Prüfungen, keine
Messung. Gemessen sind es genau diese vier.

## 26 · Export und Drucken in der Android-App — bitte einmal auf einem Telefon ansehen (v33.53)

**Was jetzt geht:** in der Android-App speicherst du Backup, GPS-Spur,
Pflanzen-, Tagebuch- und Messwerte-Tabelle, Archiv und das 3D-Foto über den
Android-Dialog **„Speichern unter"** — du wählst den Ordner. Gartenplan und
Giess-Zettel öffnen den **Druckdialog von Android**; dort gibt es oben
„Als PDF speichern". Bisher taten diese Knöpfe in der App nichts, das Backup
sagte trotzdem „heruntergeladen", und der Giess-Zettel überschrieb die App.

**Was ich NICHT prüfen konnte:** hier läuft kein Android. Der Prüfstand fährt
die Rechnung der Hülle, ihren Quelltext und die App mit einem echten
Java-Prozess — aber nicht ein Telefon. Bitte einmal von Hand, am besten auf
einem älteren und einem neuen Gerät:

| Schritt | Was passieren soll |
|---|---|
| Menü → Suche „Daten exportieren“ → Ordner wählen → Speichern | Meldung „Backup gespeichert!", die Datei liegt im gewählten Ordner und lässt sich öffnen |
| Dasselbe, aber im Dialog auf „Zurück" | „Nicht gespeichert — Der Dialog wurde geschlossen", **keine** Datei |
| Eine vorhandene Backup-Datei ersetzen | die neue Datei ist vollständig (kein Rest der alten am Ende) |
| KI-Planer → fertiger Plan → Knopf „PDF“ | der Druckdialog von Android öffnet; „Als PDF speichern" ergibt den Plan |
| Menü → Suche „Giess-Zettel“ → Drucken | Druckdialog öffnet, die App bleibt stehen (wird NICHT überschrieben) |
| Während „Speichern unter" offen ist, das Telefon drehen | danach wird trotzdem gespeichert, oder es steht „Nicht gespeichert" — nie eine leere Datei |

Wenn etwas anders aussieht: ein Foto vom Bildschirm genügt, und dazu die
Android-Version (Einstellungen → Über das Telefon).

**Am Backend ist nichts zu tun** — kein Deploy, keine Migration. Es braucht
nur eine neue APK (`bash android/build.sh`, mit deinem Schlüssel wie in §22).

## 27 · „Teilen → GreenScan" für Fotos — bitte einmal auf einem Telefon ansehen (v33.55)

**Was jetzt geht:** in der installierten App (green-scan.ch über Chrome „Zum
Startbildschirm hinzufügen") steht GreenScan im Teilen-Menü der Galerie. Ein
geteiltes Foto erscheint als **Vorschau** mit „🔍 Dieses Foto bestimmen" und
„Verwerfen" — gescannt wird erst nach dem Antippen. Bisher bot sich GreenScan
dort für Fotos gar nicht an, und wer einen Link teilte, las „Bild geteilt",
obwohl nie ein Bild ankam.

**Am Backend ist nichts zu tun** — kein Deploy, keine Migration. Es geht mit
dem Merge live (Cloudflare Pages und Netlify lesen dieselbe `_redirects`).

**Eine Sache braucht Geduld:** Chrome übernimmt eine geänderte
`manifest.json` in die installierte App nicht sofort, sondern erst bei einer
späteren Prüfung beim Start. Am schnellsten: die App vom Startbildschirm
entfernen und neu hinzufügen (deine Pflanzen kommen nach der Anmeldung aus der
Cloud zurück). Bis dahin steht GreenScan im Teilen-Menü nur für Text und Links
— und sagt dann ehrlich, dass es ein Foto braucht.

**Was ich NICHT prüfen konnte:** hier gibt es kein Android und keinen Zugang
zu green-scan.ch. Der Prüfstand fährt den echten Weg im Browser (ein
multipart-POST an `/teilen` durch den echten Service Worker), aber nicht das
Teilen-Menü eines Telefons und nicht, was Cloudflare oder Netlify auf einen
POST antworten. Bitte einmal von Hand:

| Schritt | Was passieren soll |
|---|---|
| Galerie → ein Foto → Teilen → GreenScan | GreenScan öffnet sich mit der Vorschau; „Kam über „Teilen“ an …" steht darunter |
| „Dieses Foto bestimmen" | Scanner öffnet sich **ohne Kamera**, das Ergebnis kommt wie bei „Galerie" |
| Zwei Fotos auf einmal teilen | Vorschau sagt „Du hast 2 Fotos geteilt — bestimmt wird das erste." |
| Flugmodus an, Foto teilen, „Bestimmen" | Vorschau bleibt offen: „Ohne Empfang kann GreenScan nicht bestimmen …"; das Foto ist noch da |
| Abgemeldet ein Foto teilen | erst die Anmeldung, danach erscheint die Vorschau |
| Ein Video teilen | GreenScan sollte im Menü **nicht** erscheinen (die App nimmt nur JPEG, PNG, WebP, GIF) |
| Ein Foto im HEIC-Format (manche Telefone speichern so) | entweder erscheint GreenScan nicht, oder die App sagt „Das Foto liegt im HEIC-Format vor …" |

Wenn etwas anders aussieht: ein Foto vom Bildschirm und die Android-Version
genügen. *(Bis v33.55 stand hier: in der Android-APK gibt es das Teilen noch
nicht. Seit v33.56 gibt es es — siehe §28.)*

## 28 · „Teilen → GreenScan" in der Android-APK — bitte einmal auf einem Telefon ansehen (v33.56)

Dasselbe wie §27, diesmal in der installierten APK statt der Browser-App. Die
Hülle steht jetzt im Teilen-Menü (für JPEG, PNG, WebP und GIF — dieselben vier
wie die Browser-App), nimmt das Foto an und zeigt dieselbe Vorschau. Gescannt
wird weiterhin erst nach dem Antippen.

**Was neu ist, auch für die Browser-App:** „Dieses Foto bestimmen" nimmt erst
nach 0,7 Sekunden an und ist nicht vorausgewählt. Wer gerade in einer anderen
App tippt, wenn GreenScan aufspringt, löst so keinen Scan aus. Und ein Bild
mit mehr als 200 Megapixeln wird abgelehnt, bevor die App es öffnet (ein
präpariertes Bild könnte sonst ein günstiges Telefon zum Absturz bringen).

**Was ich NICHT prüfen konnte:** hier läuft kein Android. `apk_check` fährt die
Rechnung (`Geteilt.java`) und die Seite gegen ein echtes Fach in Java, und es
prüft die Filter im gebauten Paket — aber nicht, wie dein Telefon das
Teilen-Menü zeigt, und nicht, ob deine Galerie das Foto so übergibt, wie ich
es erwarte (`ClipData`, sonst `EXTRA_STREAM`). Bitte mit der APK von Hand:

| Schritt | Was passieren soll |
|---|---|
| Galerie → ein Foto → Teilen | **GreenScan** steht im Menü (die APK, nicht nur die Browser-App) |
| GreenScan antippen, App war **zu** | GreenScan startet und zeigt nach kurzer Zeit die Vorschau mit dem Foto |
| dasselbe, App war **offen** | die Vorschau erscheint in der laufenden App |
| sofort auf „Bestimmen" tippen | in den ersten Bruchteilen einer Sekunde passiert nichts, danach öffnet sich der Scanner **ohne Kamera** |
| zwei Fotos auf einmal teilen | „Du hast 2 Fotos geteilt — bestimmt wird das erste." |
| ein Video teilen | GreenScan erscheint **nicht** im Menü |
| ein Foto aus einer Cloud-App (Google Fotos, Dropbox) | entweder die Vorschau, oder ein Satz, warum nicht — nie Stille |
| Foto teilen, dann zu einer anderen App wechseln und lange warten, zurück | entweder die Vorschau ist noch da, oder (wenn Android die App beendet hat) nichts — das steht so unter *Einstellungen › Über GreenScan* |

Am nützlichsten ist die Cloud-Zeile: dort weicht jede App ein wenig anders ab.
Wenn dort ein Satz statt der Vorschau steht, schick mir den Satz und den
Namen der App.

## 29 · 10./11.11.2026 — was mit deiner Freigabe geschehen ist, und was jetzt bei dir liegt

**Dein Auftrag:** „Die App muss einmal komplett verbessert werden. Es gibt überall
bugs und lücken (sicherheitslücken)." **Deine zwei Entscheidungen am 10.11. um 22 Uhr:**
Live-Datenbank „Sicherheit + Fixes" · Auslieferung „PR und selbst mergen".

### Was getan ist — jedes einzeln nachgemessen

| Was | Wann | Woran ich es gemessen habe |
|---|---|---|
| Migration `20260907_global_api_key_nur_proxy` — der Anthropic-Schlüssel geht nur noch an Admins | 10.11., 22:15 | Rumpf der Funktion in der Live-DB nachgelesen; `anon` darf sie nicht rufen |
| Migration `20260831_rollen_leak_fix_v30_95` — Rollenfragen über FREMDE Konten nur noch für Staff und Admins | 10.11. | Rumpf nachgelesen. Das Ausführungsrecht für `anon` steht noch (gemessen) — die Auskunft ist aber zu |
| Migration `20260924_admin_grants` — „Nutzer sperren / Rolle vergeben" und „globaler KI-Schlüssel" im Admin-Panel funktionieren wieder | 10.11. | `has_function_privilege('authenticated', …)` = wahr für beide |
| `ai-proxy` neu ausgeliefert (version 3) | 11.11., 00:01 | Rauchtest aus der Datenbank: Antwort 401 „Ungültige Session." aus dem eigenen Code — die Function startet und prüft |
| `plant-doctor-diagnose` (v6), `plan-iterate` (v5), `garden-scan-analyze` (v11) neu ausgeliefert | 11.11., 00:03 | Rauchtest: alle drei 401 aus dem eigenen Code. **Alle drei waren seit dem 15.06.2026 tot** — sie nannten ein Modell, das Anthropic an dem Tag abgeschaltet hat |
| `pest-identify` (v4), `mushroom-identify` (v4) neu ausgeliefert | 11.11., 00:04 | **Vorher** nahmen beide den öffentlichen Schlüssel der App ohne Konto an (gemessen: „missing image_base64" statt 401) — wer ihn kannte, konnte auf deine Rechnung KI-Aufrufe auslösen. **Nachher:** 401 |
| `key-health-check` (v2) — prüft denselben Schlüssel wie der Proxy | 10.11. | ausgeliefert, nicht aufgerufen |
| v33.57 — Scanner und Scan-Chat ohne Schlüssel im Browser | 11.11. | CI + `schluessel_check` „Der Weg davor" |
| v33.58 — Rezepte, Fruchtfolge, Modell-Kette, Scan-Cache, vier P1-Fehler | 11.11. | CI + `rezept_link_check`, `modell_check`, `scan_check` |

`v31_36_mkt_views_auth_guard` stand seit dem 01.09.2026 schon in der Datenbank; ich habe
sie unverändert noch einmal eingespielt (idempotent, keine Wirkung) und zuerst als „neu
angewandt" gezählt. Das war ungenau.

### Der Fehler, den ich dabei gemacht habe

Die erste Migration schloss das Loch — und **machte den Scanner für jeden Nutzer ohne
Admin-Rolle unbenutzbar**, von 22:15 Uhr bis zur Auslieferung von v33.57. Die App fragte
an vier Stellen noch „liegt ein Schlüssel im Browser?" statt „ist die KI erreichbar?".
Die Vorbedingung aus §8 („erst prüfen, dass `ai_usage` wächst") war erfüllt; sie prüfte
aber den Proxy, nicht die App davor. Dein eigenes Konto war nicht betroffen (Admin).
Zurückgenommen habe ich die Migration bewusst nicht — sie ist der Grund, warum dein
bezahlter Schlüssel nicht mehr in jedem Browser liegt. Die Lehre steht in `CLAUDE.md` §7.1.

### Was jetzt bei dir liegt — nach Dringlichkeit

**1 · Ein echter Scan mit einem Konto OHNE Admin-Rolle (zwei Minuten).**
Das ist das Einzige, was ich von hier nicht messen kann: die Functions-Adresse ist aus
meiner Umgebung gesperrt, und ich habe kein Nutzer-Konto. Melde dich mit einem
gewöhnlichen Konto an, bestimme ein Foto, stelle im Chat darunter eine Frage. Danach im
SQL-Editor:

```sql
select model, count(*), max(created_at) from ai_usage group by 1 order by 3 desc;
```

Oben muss eine Zeile `claude-sonnet-4-6` mit dem heutigen Datum stehen. Steht dort
`claude-sonnet-5-5`, hat dein Anthropic-Konto 4.6 nicht — auch gut, die Kette hat
gegriffen. Steht dort nichts Neues: schreib mir, was die App gesagt hat.

**2 · Den Anthropic-Schlüssel erneuern (fünf Minuten).**
Bis zum 10.11. bekam ihn jeder angemeldete Nutzer in den Browser. Ob ihn jemand kopiert
hat, lässt sich nicht nachsehen — also als bekannt behandeln:
1. console.anthropic.com → einen neuen Schlüssel anlegen.
2. In GreenScan: Admin-Panel → globaler KI-Schlüssel → den neuen eintragen (der Knopf
   geht seit der Migration `admin_grants` wieder).
3. In der Anthropic-Konsole den alten Schlüssel widerrufen.

Den Schlüssel bitte nie in einen Chat, ein Ticket oder ins Repo schreiben — auch nicht
an mich.

**3 · Die restlichen Migrationen bestätigen.**
Supabase verlangt für `20261006_friendships_nur_empfaenger` (sie entfernt eine Regel)
eine Bestätigung im Dialog, und die blieb am 10.11. aus — du warst nicht da. Schreib mir
„weiter mit den Migrationen", wenn du am Rechner bist; ich spiele dann der Reihe nach ein
und messe jede nach: Freundschaften · Quiz-Antwortformate · Quiz-Bilder und 43 Fragen ·
Quiz-Vorrat · Aufgaben-Sicht (beide Pflanzenlisten) · Admin-Protokoll · Nutzungsmessung
lesen und aufräumen · Backup-Aufbewahrung · Kommentar-Reaktionen. Die Geräte- und
Sensor-Migrationen bleiben wie vereinbart liegen.

**4 · Buch-Einlesen: ein Secret, sonst ist es am 30.11. tot.**
`book-ingest` (nur für dich als Admin) hat eine eigene Modellliste, und alle drei Namen
darin sind am 30.11.2026 abgeschaltet. Supabase → Edge Functions → Secrets:
`CLAUDE_MODEL` = `claude-sonnet-4-6`. Den Quelltext dieser Function gibt es nicht im Repo
(siehe `supabase/functions/book-ingest/BEFUND.md`), deshalb kein Umbau von mir.

**Nichts zu tun: Leaked-Password-Protection.** Sie stand in STATUS §2 noch als offener
Dashboard-Klick — der Sicherheits-Advisor von Supabase meldet sie am 11.11.2026 nicht
mehr (sie ist seit dem 01.09. aktiv). Die Zeile war veraltet; ich habe sie gestrichen.
Der Advisor nennt heute keinen Fehler, nur Hinweise: 16 Funktionen, die ohne Anmeldung
rufbar sind (öffentliche Lese-Abfragen für Quiz, Wissen, Marktplatz — so gewollt), und
drei Erweiterungen im Schema `public`.

### Was ich gesehen habe und NICHT angefasst habe

| Was | Warum es bei dir liegt |
|---|---|
| **Stripe:** `app_settings.stripe_publishable_key` beginnt mit `pk_test_`, `stripe_webhook_events` hat 0 Zeilen | STATUS sagt „Live-Mode seit v26.40". Entweder stimmt die Einstellung nicht, oder der Live-Schlüssel liegt woanders — an Zahlungen fasse ich nichts ohne dich an. Bitte einmal nachsehen. |
| **Bucket `scan-images` ist öffentlich** (99 Dateien) | Wer die Adresse eines Scan-Fotos kennt, kann es ohne Anmeldung laden. Privat stellen heisst: die App muss signierte Adressen holen — ein eigener Umbau, den ich gern mache, wenn du es willst. |
| **`fn_add_xp`** nimmt bis zu 50'000 Punkte je Aufruf von jedem angemeldeten Konto | Die Rangliste lässt sich damit fälschen. Braucht eine Migration (Deckel und Anlass prüfen). |
| **`fn_scan_cache_put`** | Die App liest den geteilten Cache seit v33.58 nicht mehr; die Tabelle ist leer. Die Funktion kann bleiben oder weg — eine Migration. |
| **Sonnet 5.5 als erstes Modell** | Genauere Bilder (höhere Auflösung), dafür laut Anthropic rund 2,5-mal so viele Bild-Token, 30 % mehr Text-Token und mehr abgelehnte Anfragen. Ein Secret genügt: `GS_MODEL_VISION` = `claude-sonnet-5-5`. Mein Rat: erst zehn eigene Scans damit ansehen (Pilze dabei), dann entscheiden. Ohne dein Zutun übernimmt 5.5 von selbst, wenn 4.6 wegfällt (frühestens 17.02.2027). |
| **Drei Functions nur im Repo:** `i18n-translate`, `knowledge-bulk-gen`, `feedback-triage` | Ihre Modelle leben noch; sie tragen jetzt die Kette, sind aber nicht ausgeliefert. Dazu die aus §9 und §15, die schon vorher warteten (`daily-push-checker`, `engagement-push-checker`, `weather-alert-checker`, `delete-user`). Sag „liefere die Functions aus", dann mache ich es auf demselben Weg. |

### Wie die sechs Functions ausgeliefert sind — damit du es wiederfindest

Ich kann von hier aus keine Dateien hochladen, nur Text übergeben; 150 KB Quelltext von
Hand abzuschreiben wäre genau die Abschrift, vor der `book-ingest/BEFUND.md` warnt. Jede
der sechs Functions besteht live deshalb aus **einer Zeile**: sie lädt ihren Quelltext
aus diesem Repo, an einem festen Commit (`af47fc0…` für `ai-proxy`, `ef7fdbb…` für die
anderen fünf). Ein Commit ist eine Prüfsumme — was läuft, ist Byte für Byte, was der
Prüfstand gefahren hat. Geladen wird beim Ausliefern, nicht zur Laufzeit. Wer sie später
gewöhnlich ausliefern will: `supabase functions deploy <name>` aus dem Repo, das Ergebnis
ist dasselbe.

## 30 · Die Sicherheitsreparatur (v33.59) — was auf dich wartet

**Dein Auftrag (10.11.2026, wörtlich):** „Arbeite an dem Projekt. Verbesser alles
komplett. Alle Sicherheitslücken sollten behoben werden. Die App soll einen ultra
professionellen Stand bekommen."

**Wie gearbeitet wurde, kurz:** Basislauf aller Prüfstände und eine nur lesende
Momentaufnahme der Live-Datenbank → 27 Finder mit 209 Rohfunden → je Fund ein
Widerleger (187 bestätigt, 4 widerlegt, 13 ungeprüft — die haben die Reparateure selbst
nachgestellt) → 24 Reparaturgruppen, jede im eigenen Arbeitsbaum, jede mit
einem Fall, der VORHER rot war, und einer Gegenprüfung durch einen zweiten Agenten →
eine Vollständigkeits-Kritik über 33 Funde ohne zugeordneten Bericht (24 behoben,
6 teilweise, 2 offen, 1 nur ausserhalb des Repos lösbar) → eine Schlussprüfung des
zusammengeführten Diffs mit 12 Linsen und je einem Widerleger (34 Meldungen, 32 bestätigt, 2 widerlegt,
darunter ein kritischer: der überarbeitete `stripe-webhook` hätte live **jedes**
Abo-Ereignis mit 500 beantwortet) → Reparatur dieser Funde in sechs weiteren Gruppen → Zusammenführung mit
v33.57/v33.58 der anderen Sitzung (§29) → Bump. Über alle 30 Gruppen stehen
215 Fund-Einträge: 186 behoben, 24 teilweise,
5 offen (4 bewusst, 1 nicht nachstellbar). Neu sind drei Prüfstände: `sicherheit_check` (174 Fälle in
22 Dateien unter `scripts/sicherheit/`), `edge_check` (58 Fälle,
`scripts/edge/` — führt die echten `index.ts` mit gestellten Diensten aus) und
`rls_check` (43 Fälle, `scripts/rls/` — spielt jede neue Migration gegen den
Live-Stand vom 10.11. in einem lokalen Postgres nach, zweimal, mit Gegenprobe).
`bash scripts/pruefstaende.sh` fährt jetzt 44.

### 30a · In einem Absatz: was schon wirkt und was auf dich wartet

**Mit dem Merge wirkt nur die App** (`index.html`, `sw.js`, `_headers`, Datenschutztexte; der
Android-Quelltext erst mit dem nächsten APK-Bau): fremder Text kommt als Text an, nie als Code; Bilder fremder Nutzer
werden nur noch aus unserem eigenen Speicher geladen; Schriften und pdf.js kommen nicht
mehr von Dritten; ein Anmelde-Token aus einem Link wird nicht mehr übernommen; Fotos
verlieren ihre GPS-Angaben vor dem Hochladen; ein freigegebener Fund zeigt den Ort auf
etwa 1 km gerundet. **Alles Serverseitige wartet auf dich:** sechs neue Migrationen
(`supabase/migrations/20261110_*.sql`), Änderungen an drei älteren, nicht angewandten
Migrationen und 29 Edge-Functions. **Nichts davon ist auf der Live-Datenbank angewandt,
keine dieser Functions ausgeliefert** (gemessen am 11.11.2026, 03:28 UTC: 0 von 23
geprüften neuen Funktionsnamen existieren live). Wichtig: Zweig, Migrationsköpfe und
Prüfstände **beschreiben Lücken, die live noch offen sind** — das Repo ist öffentlich und
wird als Web-Root ausgeliefert. Darum bitte zügig mergen und dann anwenden, nicht
wochenlang liegen lassen.

### 30b · Die Reihenfolge

Zusammengetragen aus den Köpfen der Migrationen und den Übergaben der Gruppen, gegen
Widerspruch geprüft. Jede Migration ist idempotent (zweimal eingespielt schadet nicht).

1. **App mergen und ausliefern lassen** (Cloudflare Pages zieht `main`). Das ist
   Voraussetzung für Schritt 4 und empfohlen vor Schritt 5 und 6.
2. **`20261110_sicherheit_ki_kontingent.sql` anwenden.** Zwingend VOR Schritt 3: sie legt
   die zwei Funktionen an, über die jede KI-Function ihren Aufruf vorher reserviert. Fehlen
   sie, antworten `ai-proxy`, `plan-iterate`, `garden-scan-analyze`,
   `plant-doctor-diagnose`, `pest-identify` und `mushroom-identify` **allen** Nutzern mit
   503 — auch der Pilz-Scanner. (Die Live-Fassungen von §29 haben dieses Tor noch nicht und
   laufen bis dahin weiter.)
3. **Die Edge-Functions ausliefern** (Liste in 30d). Die sechs KI-Functions erst nach
   Schritt 2; die übrigen live laufenden haben keine Migration als Voraussetzung. Die fünf,
   die noch nie ausgeliefert waren (letzte Zeile in 30d), gehören NICHT dazu: `daily-push`
   und `push-test` lesen Spalten, die es live nicht gibt, und `device-ingest` braucht die
   Geräte-Migration aus Schritt 10.
4. **`20261110_sicherheit_community_markt.sql` — erst NACH Schritt 1.** Die alte App lädt
   Kartenfunde mit einem lokalen Platzhalter als Bildadresse hoch; der neue Bild-Wächter
   weist ihn ab, und damit scheitert der ganze Fund-Upload.
5. **`20261110_sicherheit_funktionen.sql`** — empfohlen nach Schritt 1 (die App ruft den
   geteilten Scan-Cache seit v33.58 nicht mehr; eine ältere App fängt die Ablehnung ab und
   scannt ohne Cache). Gegenüber den alten `v28_*`/`v29_*`-Dateien gilt: diese zuletzt —
   jene sortieren alphabetisch hinter `2026…` und würden beim stumpfen Einspielen nach
   Dateinamen drei Reparaturen zurückdrehen.
6. **`20261110_sicherheit_konto_speicher.sql`** — vor oder nach der App möglich, empfohlen
   danach. Vorher den Bestand der Push-Abos ansehen (30c).
7. **`20261110_feedback_stimmen_zaehlen.sql`** — laut Datei unabhängig von Schritt 6.
   Empfohlen: Schritt 6 zuerst oder im selben Zug (die Schlussprüfung hat gezeigt, dass
   ein offener Umschreib-Weg für Stimmen erst mit dem neuen Zähler Wirkung bekommt; Schritt 6
   schliesst ihn).
8. **`20260907_quiz_antwort_formate.sql` (§7), danach `20261110_sicherheit_quiz_punkte.sql`.**
   Beide Reihenfolgen sind nachgespielt (`scripts/rls/20_quiz.js`), empfohlen ist diese.
   **Spätestens vor dem 31.12.2026, 23:00 UTC** — dann vergibt der Cron
   `quiz-top3-yearend` ein Jahr Pro an die drei Ersten, und erst mit dieser Migration
   zählen dafür nur Antworten am Tag ihrer Frage.
9. **`20260831_kosten_und_cron_wachhund_v30_95.sql`** — stand bis heute in **keiner** Liste
   offener Migrationen (weder STATUS §2 noch hier), ist live nicht angewandt. Sie hat jetzt
   einen Wächter und macht die Reparatur an `fn_log_ai_usage` aus Schritt 5 nicht mehr
   rückgängig; die Reihenfolge zu Schritt 5 ist damit egal
   (`scripts/rls/70_reihenfolge.js`). Sie bringt im selben Zug ihren zweiten Teil mit (die
   Cron-Überwachung sieht auch HTTP-Jobs) — den hat diese Reparatur nicht geändert.
10. **`20260903_oekosystem_v1_geraete.sql`** — unverändert „wenn das erste Gerät da ist"
    (§6). Die Datei ist korrigiert: eine Regel oder ein Befehl darf nur an einem EIGENEN
    Gerät hängen.
11. **Danach nachmessen lassen** (sag mir Bescheid, ich lese nur): die Prüfabfragen
    stehen in 30c je Migration.

**Schon angewandt, nichts mehr zu tun** (Live-Lage 11.11.2026, `schema_migrations`
10.11., 21:15–21:18 UTC): `20260907_global_api_key_nur_proxy`,
`20260831_rollen_leak_fix_v30_95`, `v31_36_mkt_views_auth_guard` (stand schon seit
01.09. drin, §29) und `20260924_admin_grants`. An §3b, §8 und §23 steht das jetzt dabei.
`20260907_global_api_key_nur_proxy.sql` hat in diesem Zweig nur einen Nachtrag im
Kommentar bekommen (Schlüsselwechsel als Pflicht) — am SQL ändert sich nichts.

Zwei Zeilen aus §29 („Was ich NICHT angefasst habe") sind damit überholt: `fn_add_xp`
deckelt Schritt 8, `fn_scan_cache_put` sperrt Schritt 5.

### 30c · Die sechs neuen Migrationen, je ein Block

Was jede schliesst, steht ausführlich im Kopf der Datei — dort ist auch gemessen, wie es
live stand. Hier nur, was du wissen musst.

**`20261110_sicherheit_ki_kontingent.sql`**
- *Schliesst:* kein KI-Weg hatte ein Tageskontingent, das der Server erzwingt; der Proxy
  zählte erst nach dem Aufruf, parallele Anfragen lasen denselben Stand. Neu wird VOR
  dem Aufruf in einer Anweisung reserviert (`fn_ai_kontingent_reservieren`,
  `fn_ai_kontingent_freigeben`, nur `service_role`), gezählt in `feature_usage` unter
  `ki:<function>`.
- *Für Nutzer:* Tagesgrenzen je Plan (Tabelle in 30f) — und ein eigener Satz, wenn sie
  erreicht ist.
- *Nachgespielt:* `scripts/rls/50_ki_kontingent.js` (20 gleichzeitige Reservierungen bei
  Grenze 15 → genau 15).
- *Beim Anwenden prüfen:* nach einem KI-Aufruf mit einem gewöhnlichen Konto hat
  `feature_usage` eine Zeile `ki:<name>`; Pilz-, Schädlings- und Doktor-Aufruf geben kein
  401.

**`20261110_sicherheit_funktionen.sql`**
- *Schliesst:* elf Datenbankfunktionen, die jeder Angemeldete mit fremder Nutzer-Id oder
  frei gewähltem Parameter rufen konnte, gehen nur noch an `service_role` (u. a.
  Quest-Fortschritt fremder Konten, fremde Konten per Ratenbremse aussperren, der geteilte
  Scan-Cache, `fn_knowledge_grow` mit dem früher geleakten Geheimnis **im Klartext im
  Rumpf**). App-Kostenbuchungen (`fn_log_ai_usage`) zählen keine Kosten mehr, die der
  Client nennt; `ai_daily_usage` lesen nur Admins. Marktplatz-Verkäufer ohne Anzeigenamen
  heissen „Anonym" statt nach ihrer E-Mail. Freundschafts-Mitteilungen ohne Steuerzeichen,
  höchstens 40 Zeichen. Arten-Bilder nur aus dem eigenen Ordner im Bucket.
- *Für Nutzer:* nichts Sichtbares. Im Admin-Panel heissen neue Kostenzeilen aus der App
  `client:<label>`.
- *Nachgespielt:* `scripts/rls/10_funktionen.js`.
- *Beim Anwenden prüfen* (drei lesende Abfragen, ich fahre sie gern für dich): `proacl`
  der genannten Funktionen ohne `authenticated`; der Rumpf von `fn_knowledge_grow`
  enthält das alte Geheimnis nicht mehr, sondern liest `knowledge_gen_secret`; die Regel
  auf `ai_daily_usage` nennt `is_admin_user`.

**`20261110_sicherheit_konto_speicher.sql`**
- *Schliesst:* das Startangebot liess sich ohne Kauf „ausverkaufen" (jedes Konto trug sich
  selbst in den Zähler ein; die Lese-Regel führte zwei private Adressen als Text); eine
  per INSERT entstandene Profilzeile trug `is_admin`/`role`/`tier`, wie der Client sie
  schickte; besitzerlose Zeilen (`user_id` leer) in vier Tabellen; Stimmen ohne Anmeldung
  anlegen, löschen und umschreiben; drei Buckets ohne Grössen- und Typgrenze (HTML/SVG
  unter unserer Domain ablegbar); Push-Abos an beliebige Adressen, ohne Deckel je Nutzer.
- *Für Nutzer:* nichts im Normalbetrieb. Ab dem elften Gerät fällt das älteste Push-Abo weg.
- *Nachgespielt:* `scripts/rls/40_konto.js`.
- *Vorher prüfen:* wie viele Push-Abos auf keinen bekannten Push-Dienst zeigen (eine lesende
  Abfrage über die Hosts der Endpunkte; ich fahre sie). Ist es 0, kann die neue Regel
  `push_subscriptions_endpoint_push_dienst` danach auch für den Bestand gelten
  (`VALIDATE CONSTRAINT`); sonst diese Zeilen zuerst ansehen — es sind keine echten Abos,
  und jede Änderung an ihnen scheitert nach der Migration.
- *Danach prüfen:* auf `launch_offer_usage` steht nur noch die Lese-Regel; die drei
  Buckets haben Grenzen.

**`20261110_sicherheit_community_markt.sql`**
- *Schliesst:* ein vom Admin versteckter Beitrag oder ein verstecktes Inserat liess sich
  vom Eigentümer wieder öffentlich schalten (dazu Likes, Zähler, Datum, beim Inserat sogar
  der Besitzer); die Sperre griff nur beim Anlegen von Beiträgen und Kommentaren;
  Blockieren galt nicht für Kommentare, Nachrichten, Folgen und Freundschaftsanfragen;
  Marktplatz-Nachrichten liessen sich in fremde Posteingänge schreiben und die der
  Gegenseite umschreiben; Verkäufer-Status und Stripe-Konto selbst setzbar; Meldungen am
  Ratenlimit vorbei; Organisationen ohne Spaltengrenze; Rezepte/Heilmittel für jeden mit
  Experten-Flag schreibbar; Bildadressen fremder Nutzer an keinen Host gebunden; ein
  öffentlicher Name durfte „GreenScan Team" oder „Аdmin" (kyrillisch) heissen.
- *Für Nutzer:* nichts, solange die App v33.59 läuft. Ein Gesperrter kann Inserate und
  Nachrichten nicht mehr ändern (auch nicht als gelesen markieren — harmlos).
- *Nachgespielt:* `scripts/rls/30_community.js`.
- *Beim Anwenden prüfen:* vorher, dass der Anmelde-Trigger auf `auth.users` wirklich
  `public.fn_handle_new_user` ruft (die Momentaufnahme kennt nur die Funktion); danach
  die 20 Trigger `trg_gs_…` aus der Datei, `authenticated` darf nicht mehr in `marketplace_sellers` schreiben.

**`20261110_sicherheit_quiz_punkte.sql`**
- *Schliesst:* Antworten auf beliebige (auch vergangene) Fragen, `fn_add_xp` bis 50'000
  je Aufruf, Erfolge per Zahl vom Client, Serien und Rangliste vom Client, Battles per
  direktem INSERT gegen ein Opfer, das nie gespielt hat, unlösbare Battle-Fragen.
- *Für Nutzer:* XP höchstens 1'000 je Tag (mehr kommt über mehrere Tage an), Erfolge
  wachsen höchstens um 50 je Metrik und Tag. Wer das Quiz vor Mitternacht UTC öffnet und
  danach antwortet, sieht „nicht beim Server angekommen".
- *Nachgespielt:* `scripts/rls/20_quiz.js` (beide Reihenfolgen mit 20260907).
- *Danach prüfen:* die Trigger `trg_quiz_answers_tagesfrage` und
  `trg_profiles_showcase_pruefen` existieren; die neue Tabelle `punkte_tageszuwachs` gibt
  es. Danach müssen `docs/loeschung-inventar.json` und `docs/backend-inventar.json` nachgezogen
  werden (mache ich).
- *Löst NICHT:* der Antwortschlüssel bleibt öffentlich lesbar, der Battle-Herausforderer
  liefert Fragen UND Lösungen — beides Entscheidungen (30f).

**`20261110_feedback_stimmen_zaehlen.sql`**
- *Schliesst:* kein Sicherheitsloch, ein Nebenbefund — eine Stimme normaler Nutzer
  bewegte die Zähler nie (der Zähler lief mit ihren Rechten und durfte die Idee nicht
  ändern). Der Bestand wird einmal nachgezählt.
- *Nachgespielt:* `scripts/rls/60_feedback.js`.
- *Danach prüfen:* `fn_update_feedback_votes` läuft als `SECURITY DEFINER`.

**Geändert, nicht neu:** `20260831_kosten_und_cron_wachhund_v30_95.sql` und
`20260907_quiz_antwort_formate.sql` haben je einen Wächter (eine ältere Datei überschreibt
keine Reparatur mehr), `20260903_oekosystem_v1_geraete.sql` zwei strengere Regeln.

### 30d · Edge-Functions neu ausliefern

Geändert sind **29** der 40 Function-Verzeichnisse (`git diff --name-only
44bb824 HEAD -- supabase/functions`); in allen ist jede Abhängigkeit jetzt auf eine exakte
Version festgelegt. Erst mit der Auslieferung gilt irgendetwas davon live. Die geteilten
Module unter `_shared/` gehen mit (`ki_tor.mjs`, `zahlung_regeln.mjs`, `markt_regeln.mjs`
neu; `push_helfer.mjs`, `sensor_push_regeln.mjs`, `loeschung_regeln.mjs` geändert).

| Function | Warum |
|---|---|
| `ai-proxy`, `plan-iterate`, `garden-scan-analyze`, `plant-doctor-diagnose`, `pest-identify`, `mushroom-identify` | Tageskontingent vor dem Aufruf, Nutzer per Token geprüft, Eingabegrenzen, Bildgrösse vorab — **erst nach `…_ki_kontingent.sql`** |
| `knowledge-bulk-gen` | Geheimnis konstantzeitig verglichen, Anzahl gedeckelt, KI-Zeilen nur in erlaubte Spalten, Pilze aus der KI immer „Status unklar" |
| `feedback-triage` | Feedback-Texte gedeckelt und als Daten abgegrenzt (eine Anweisung im Feedback ist Inhalt), Antwort des Modells nur für den gesendeten Stapel |
| `key-health-check`, `species-search`, `i18n-translate` | nur die Versionen festgelegt |
| `stripe-webhook` | Erstattung und Rückbuchung entziehen eine Lifetime; eine Zahlung setzt nie mehr „vom Experten verifiziert"; der Fehler, der live jedes Abo-Ereignis mit 500 beantwortet hätte, ist behoben |
| `stripe-checkout`, `stripe-portal` | Rückkehr nur auf eigene Adressen, Gratistage nur bei sicher beantworteter Vorgeschichte, Deckel des Startangebots am Server |
| `stripe-expert-checkout` | nur der Autor zahlt, nie für sich selbst, Betrag fest |
| `stripe-create-connect-account` | ein fremdes Stripe-Konto wird abgewiesen |
| `stripe-bootstrap`, `stripe-admin-extend-webhook` | Admin-Geheimnis konstantzeitig; die zweite abonniert zusätzlich `charge.refunded` |
| `delete-user` | räumt alle Buckets mit Nutzerordnern (vorher nur einen Teil) und kündigt ein laufendes Abo bei Stripe |
| `marketplace-publish` | ein gesperrtes Konto kann nicht mehr über diesen Weg veröffentlichen |
| `daily-push-checker`, `weather-alert-checker`, `engagement-push-checker`, `send-push` | Push nur an bekannte Push-Dienste, Frist je Versand, Frost-Abfrage mit gerundetem Ort |
| `sensor-push`, `daily-push`, `push-test`, `device-ingest`, `entitlements` | **waren noch nie ausgeliefert** (Live-Liste 11.11.); gehärtet für den Tag, an dem sie es werden. `daily-push` und `push-test` lesen Spalten, die live anders heissen — vor einer ersten Auslieferung erst reparieren (STATUS §2) |

**Secrets und Einstellungen, die sie brauchen:**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase selbst.
- `ANTHROPIC_API_KEY` (Function-Secret): die KI-Functions lesen es ZUERST und fallen sonst
  auf `app_settings.global_anthropic_api_key` zurück; `feedback-triage` liest NUR das Secret.
- `STRIPE_SECRET_KEY`: alle `stripe-*` — **und neu `delete-user`**. Fehlt es dort, lehnt
  `delete-user` die Löschung eines Kontos mit laufendem Abo ab (409, absichtlich: lieber
  nicht löschen als ein Abo weiterlaufen lassen).
- `STRIPE_WEBHOOK_SECRET` oder `app_settings.stripe_webhook_secret` für `stripe-webhook`
  (wie bisher).
- `app_settings.knowledge_gen_secret` für `knowledge-bulk-gen`, `app_settings.stripe_admin_secret`
  für `stripe-bootstrap` und `stripe-admin-extend-webhook`, `app_settings.push_cron_secret`
  für die Push-Functions und `key-health-check` — alle wie bisher, keine neuen Namen.
- **JWT-Prüfung je Function so lassen, wie sie heute steht.** Das Repo hat keine
  `config.toml`, die es festhält; `supabase functions deploy` prüft per Vorgabe ein JWT.
  Functions, die Stripe oder ein Cron ohne Anmeldung rufen, brauchen ihre bisherige
  Einstellung.

**Zu den festgelegten Versionen:** `@supabase/supabase-js` und `@supabase/functions-js`
stehen auf **2.119.0** — die zur Zeit der Festlegung (10.11.2026) jüngste Fassung, erst
**6 Tage alt**. Wer vorsichtiger sein will gegen frisch veröffentlichte, noch nicht
entdeckte bösartige Fassungen, nimmt 2.118.0 (15.10.2026) für beide. Stripe steht auf
17.7.0; `stripe-create-connect-account` bleibt bewusst auf Stripe 18.5.0, weil ein
Wechsel der Hauptversion dort still die Stripe-API ändern würde. `daily-push`,
`entitlements` und `push-test` springen von 2.39.0 auf 2.119.0 — nach dem Ausrollen einmal
echt aufrufen. **Ein Lockfile fehlt:** erst `deno.lock` legt auch die Abhängigkeiten der
Pakete fest. Das geht nur auf einer Maschine mit Deno ≥ 2 und Supabase-CLI (`deno cache
--lock=…` je Function); danach prüfen, ob `supabase functions deploy` es mitnimmt.

### 30e · Ausserhalb des Repos — nur du

1. **Den Anthropic-Schlüssel wechseln** (§29 Punkt 2, hier genauer). Er war bis zum
   10.11.2026 für jedes angemeldete Konto lesbar. Reihenfolge: neuen Schlüssel in der
   Anthropic-Konsole erzeugen → an **beiden** Stellen setzen: Function-Secret
   `ANTHROPIC_API_KEY` (falls es gesetzt ist, gewinnt es — ob es live gesetzt ist, konnte
   ich nicht nachsehen) und `app_settings.global_anthropic_api_key` (das ist, was das
   Admin-Panel schreibt) → eine KI-Funktion in der App benutzen, `key-health-check` meldet
   ok → **erst dann** den alten widerrufen. Erst der Widerruf schliesst das Leck; die
   Migration hat nur den Hahn zugedreht.
2. **Der NVIDIA-Schlüssel** (`nvapi-Pr2M…usrB`) steht nicht mehr im Baum, aber in der
   git-Historie (in einem ZIP-Blob). Bitte beim Anbieter (NVIDIA build/NGC-Konto)
   **widerrufen** und mir das Datum sagen, dann trage ich es ein. Die Historie umzuschreiben
   ersetzt den Widerruf nicht — wer das Repo geklont hat, behält sie.
3. **`app_settings.knowledge_gen_secret`:** nur lesend nachsehen, dass es NICHT das alte,
   geleakte X-Admin-Secret ist (das steht noch in einer alten Migration im Repo und im
   Live-Rumpf von `fn_knowledge_grow`, bis Schritt 5 läuft). Ist es dasselbe: neu erzeugen.
4. **Stripe-Dashboard:**
   - Das Ereignis **`charge.refunded`** am Webhook-Endpunkt abonnieren — im Dashboard oder,
     nach der Auslieferung, einmal `stripe-admin-extend-webhook` mit dem Admin-Geheimnis
     laufen lassen. Ohne das entzieht erst eine Rückbuchung (Chargeback) eine Lifetime,
     keine Erstattung.
   - **Lifetime-Altkäufe** tragen keine Zahlungs-Kennung und werden bei Erstattung nicht
     automatisch entzogen. Wer das will: je Zeile die Zahlung in Stripe nachsehen und
     nachtragen (die Zeilen heissen `lifetime_<uid>` in `stripe_subscriptions`; die
     Zahlungs-Kennung gehört in ihr `metadata`).
   - Weiter offen aus §29: `stripe_publishable_key` beginnt mit `pk_test_`.
   - Falls zwischen Merge und Auslieferung ein Zwischenstand von `stripe-webhook` live war:
     die Zustellungen der letzten drei Tage im Dashboard erneut senden.
5. **Supabase-Auth:** nur nötig, falls du die Anmeldung per E-Mail-Link zurückwillst (30f) —
   dann muss die Redirect-Liste die App-Adressen enthalten.

### 30f · Entscheidungen, die nur du treffen kannst

| Thema | Stand heute | Optionen | Empfehlung |
|---|---|---|---|
| **Netlify-Auslieferung** (`green-scanswitzerland`, §2.1 in CLAUDE.md) | Steht bewusst NICHT in der Liste eigener Adressen der Zahlung (`zahlung_regeln.mjs`); eine Stripe-Rückkehr von dort endet auf green-scan.ch | behalten (dann in `eigenerUrsprung` aufnehmen) · abschalten | abschalten — eine zweite Installationsquelle mit eigenem Speicher bringt nur Support-Fragen |
| **Quiz-Battles** | Der Herausforderer liefert Fragen UND Lösung; die Form wird geprüft, eine falsch markierte „richtige" Option nicht. ELO und daran hängende Erfolge sind nur bedingt vertrauenswürdig | Fragen zieht der Server aus einem Bestand (Umbau Server + App) · ELO aus Battles nur buchen, wenn die Fragen vom Server stammen · so lassen | Server zieht die Fragen — sonst ELO nicht als Ranglistenwert zeigen |
| **Antwortschlüssel des Tagesquiz** | `daily_quizzes.options` samt Lösung öffentlich lesbar; höchstens eine nachgeschlagene richtige Antwort je Tag | Urteil nur vom Server (Umbau) · so lassen | davon abhängig machen, ob ein Jahr Pro für die Top 3 bleiben soll |
| **Anmeldung per E-Mail-Link** | Der Knopf ist entfernt; die Rückkehr wird abgelehnt (ein Token aus der Adresse ist der Weg für Login-CSRF) | auf PKCE umstellen (App + Supabase-Auth-Einstellung) · weglassen | weglassen, bis jemand danach fragt |
| **KI-Grenzen je Plan** | siehe Tabelle unten; die Werbetexte sagen „unbegrenzt" | Grenzen senken (dann Texte mit) · Texte ehrlich machen · so lassen | Texte auf „faire Nutzung" ändern — für Plus war der Proxy schon immer bei 200/Tag |
| **Experten-Verifikation** | Eine Zahlung setzt nie mehr „verifiziert"; der Knopf ist aus (`GS_EXPERTEN_ANFRAGE_AKTIV`), weil ein Modell „Anfrage an einen Experten" fehlt | Modell + Expertenwahl bauen · Funktion streichen | bestehende Zeilen mit bezahlt UND verifiziert lesend prüfen lassen (könnten gekauft statt geprüft sein), dann entscheiden |
| **Kleinere Stripe-Punkte** | Gratisphase nur je Konto (neues Konto = neue Gratistage); abgebrochene Checkouts legen neue Stripe-Kunden an; Startangebot kann bei 99/100 knapp überschritten werden; Altlast-Funktionen `gs_abo_*` lesen Spalten, die es live nicht gibt | je eine kleine Tabelle bzw. Migration (ich schreibe sie, wenn du willst) | Altlast-Funktionen entfernen; der Rest erst, wenn es Käufe gibt |
| **Android: Update-Hinweis** | Eine installierte APK erfährt nie von einer neueren | A: Hinweis über ein Flag in `app_settings` (nur angemeldet) · B: statische Versionsdatei auf einer eigenen Adresse | A — kein neuer Host, kein DNS |
| **Reservierte Namen im Altbestand** | Neue Namen wie „GreenScan Team" werden abgewiesen; bestehende Beiträge mit solchen Namen bleiben | einmal lesend zählen, dann umschreiben oder lassen | zählen lassen |
| **Altzeilen: genaue Orte und EXIF** | Neue Freigaben runden auf ~1 km, neue Fotos ohne GPS; bereits öffentliche Funde stehen exakt, alte Fotos in fünf Buckets tragen noch EXIF | einmaliger Server-Lauf (Runden, Fotos neu kodieren) · private Buckets mit signierten Adressen | den einmaligen Lauf — ich schreibe ihn, du gibst frei |
| **Name aus der E-Mail bei der Anmeldung** | Die App schickt ohne Namen „Naturfreund"; der Server (`fn_handle_new_user`) nimmt ohne Namen weiter den E-Mail-Anfang | Rückfall am Server auf „Naturfreund" · Bestand bereinigen (Achtung: der E-Mail-Anfang kann auch selbst gewählt sein) | Rückfall ändern, Bestand nur nach Zählung |
| **Drei Dateien in `docs/_archiv/`** (`A_Z_AUDIT_FINDINGS_v28.95.json`, `SICHERHEIT_JETZT.sql`, `apply_pending_v30_87.sh`) | Nicht indexiert, aber abrufbar (das Repo ist der Web-Root) | aus dem Baum entfernen (Historie bleibt) · bewusst als Risiko führen | entfernen |
| **KI-Schlüssel auch für Admins** | Admins bekommen ihn noch in den Browser | nur noch über `key-health-check` | ja — dann verlässt er den Server nie |
| **Vorgabe-Rechte der Datenbank** | Neue Funktionen und Tabellen sind ohne ausdrückliches REVOKE sofort für `anon` offen (gemessen: 16 SECURITY-DEFINER-Funktionen, 190 von 214 Relationen mit Schreibrecht für anon) | Vorgabe einmal umstellen (jede künftige Migration braucht dann ausdrückliche GRANTs) · so lassen | umstellen — aber erst nach den Schritten in 30b |
| **Scan-Cache-Reste, Arten-Bilder mit fremder Adresse** | liegen noch in der Datenbank, werden nicht mehr gelesen bzw. angezeigt | leeren bzw. auf „abgelehnt" setzen · liegen lassen | leeren — sie stammen von beliebigen Konten |
| **Kleinere** | Logos von Organisationen dürfen fremde Hosts haben (die Person tippt eine Logo-Adresse ein); die Bilder in `species-images` bleiben nach einer Kontolöschung als Zeile stehen, die Datei ist weg | Logo nur aus dem eigenen Speicher (Formular-Umbau) · so lassen; `species-images` als Gemeingut behalten oder die Zeilen mitlöschen | eine Datenschutz-Entscheidung, keine Code-Frage |
| **`i18n-translate`** | verwirft KI-Übersetzungen mit Auszeichnung noch nicht; die App bereinigt jede Übersetzung am Eingang | am Server zusätzlich verwerfen · so lassen | zusätzlich verwerfen — andere Leser der Tabelle bereinigen nicht |

**KI-Grenzen je Tag — alt → neu** (stehen nur in `supabase/functions/_shared/ki_tor.mjs`,
gesetzt, nicht gemessen; ein Admin rechnet wie Pro):

| Function | vor v33.57 | jetzt: free · basic · bezahlt (plus/premium/pro/lifetime) |
|---|---|---|
| `ai-proxy` | free 15 · plus 200 · pro/lifetime 2000 (basic und premium fielen auf free) | 15 · 200 · 200 bzw. pro/lifetime 2000 (= live seit 11.11.) |
| `plan-iterate` | keine Bremse (nur 5 Runden je Plan, vom Nutzer schreibbar) | 10 · 20 · 480 |
| `garden-scan-analyze` | 20 je Stunde für alle, bei Fehler offen | 3 · 5 · 480 (die Stundenbremse bleibt zusätzlich) |
| `plant-doctor-diagnose` | 30 je Stunde | 5 · 15 · 720 |
| `pest-identify`, `mushroom-identify` | 30 je Stunde | 20 · 40 · 720 |

Für bezahlte Pläne ist die Zahl eine **Missbrauchsbremse** (die alte Stundenbremse × 24),
kein Kontingent. Die Texte „Unbegrenzte KI-Nutzung — kein Tageslimit", „unbegrenzte KI
ohne Tageslimit", die FAQ und der Hinweis im Planer („Mit Pro: unbegrenzt") stehen noch so
in der App. Den Hinweis im Planer und im Quiz sieht seit v33.59 nur noch, wer keinen
bezahlten Plan hat; ein zahlender Kunde liest bei erreichter Bremse „Das Tageskontingent für
KI-Aufrufe ist erreicht. Morgen geht es weiter.".

### 30g · Auf einem Telefon ansehen — von hier nicht messbar

Hier läuft weder Android noch ein echtes Konto, und die Live-Adressen sind gesperrt (§2.1
in CLAUDE.md). Nach Merge und Auslieferung bitte:

- **Mit einem gewöhnlichen Konto:** Pilz-, Schädlings- und Doktor-Scan liefern ein
  Ergebnis (kein „nicht angemeldet").
- **Pflanzendoktor, Schädlings-, Pilz- und Garten-Scan mit einem grossen Handyfoto:** die
  App verkleinert das Foto jetzt vorher (höchstens 1920 px, neu kodiert, ohne Ortsangabe in
  der Datei). Es sollte ein Ergebnis kommen und nie „Das Bild ist zu gross".
- **Kauf im Stripe-Fenster:** schliesst sich das Fenster nach der Rückkehr, und zeigt die
  App danach das Abo? Im Browser hier nachgestellt und repariert — wegen einer Kopfzeile
  kannte das Fenster die App nicht mehr, die es geöffnet hat, und lud sie stattdessen selbst;
  jetzt meldet es sich über einen eigenen Kanal. Ein echter Kauf zeigt, ob es auf deinem
  Gerät so ist. Bleibt das Fenster offen, steht dort „Du kannst dieses Fenster schließen".
- **Einen Fund für die Community freigeben:** die Rückfrage nennt die Rundung auf etwa
  1 km; auf der Karte eines anderen Kontos steht er gerundet.
- **Eine Idee im Feedback umstimmen** (Daumen hoch → runter): das scheiterte am Server, weil
  der Aufruf seinen Schlüssel nicht nannte. Repariert und in einem lokalen Postgres
  nachgerechnet; endgültig zeigt es nur der echte Server. Dasselbe galt für das erneute
  Einschalten von Push auf einem Gerät, das schon einmal angemeldet war.
- **Kompass und Sprachmodus** im Browser — sie waren durch eine Kopfzeile abgeschaltet und
  sollten wieder gehen.
- **Android-APK:** ein Foto aus Google Fotos, der Dateiauswahl und der Galerie deines
  Herstellers wählen (alte Apps, die `file://` liefern, werden jetzt abgewiesen); der
  Scanner bekommt die Kamera; ein Telefonnummer- und ein Mail-Link öffnen Wähler bzw.
  Mail-App; nach dem Zurückholen aus dem Hintergrund bleibt die App auf ihrer Seite und
  springt nicht von selbst zurück.
- **Ein Push kommt an** (nach der Auslieferung der Push-Functions).

### 30h · Wenn etwas schiefgeht

- **Die sechs neuen Migrationen haben keinen vorbereiteten Rückweg** — keine der Dateien
  nennt einen. Die `REVOKE`-Zeilen lassen sich mit `GRANT` umkehren, die Regeln mit der
  Live-Fassung, die im Kopf jeder Datei beschrieben ist. Sag mir, welche, dann schreibe ich
  dir das Gegenstück aus der Momentaufnahme vom 10.11. — bevor du einspielst, wenn dir
  das lieber ist.
- **KI-Functions antworten mit 503 „kontingent_unbekannt":** `…_ki_kontingent.sql` fehlt.
  Anwenden, nicht die Functions zurückdrehen.
- **Eine Function verhält sich falsch:** die Fassung vor dieser Reparatur liegt im Repo
  (Commit `b95a032` = v33.58 für die sechs KI-Functions, wie sie live laufen; für die
  übrigen `44bb824`). Zurück heisst neu ausliefern aus diesem Stand — nicht geprobt.
- **`20260907_global_api_key_nur_proxy`** hat einen Notfall-Rückweg im Kopf — er gibt den
  (dann neuen) Schlüssel wieder an alle Konten. Nur nach Rücksprache.
- Die App selbst lässt sich wie jede Auslieferung über einen Revert-PR zurücknehmen; Schritt 4
  aus 30b sollte dann zuerst wieder heraus, sonst trifft die alte App auf den neuen
  Bild-Wächter.

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
