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
