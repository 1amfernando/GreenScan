# Für Fernando — was nur du machen kannst

> Stand 02.09.2026 · geschrieben von Seros.
> Alles hier greift in die **laufende Auslieferung** ein. Ich fasse das nicht
> von mir aus an, auch nicht mit deinem generellen Ja — bei einer
> Produktivdatenbank mit laufenden Zahlungen gehört der letzte Klick dir.
>
> **Sag mir nach jedem Schritt Bescheid, dann messe ich nach** (nur lesend)
> und bestätige dir schriftlich, dass es angekommen ist. So bleibt nichts
> „vermutlich erledigt".

---

## 1 · `send-receipt` stilllegen — das ist das Dringende

**Warum:** Diese Server-Funktion läuft seit April, wird von **niemandem**
aufgerufen, und verschickt E-Mails von `info@greenscan.ch`. Empfänger, Betrag,
Organisation und Name kommen **aus der Anfrage**. Es gibt keine Prüfung gegen
Stripe und keine Prüfung, ob die aufrufende Person mit der Zahlung zu tun hat.

Jede Person mit einem GreenScan-Konto kann darüber eine erfundene Quittung an
jede beliebige Adresse schicken — mit dem Satz „Diese E-Mail ist deine
Zahlungsbestätigung. Bitte aufbewahren."

Das ist kein Datenabfluss. Es ist eine Vorlage für Betrug in deinem Namen.

### So geht es (Dashboard, ohne Werkzeuge)

1. **supabase.com** öffnen → dein Projekt **Green-scan** → links **Edge
   Functions**.
2. In der Liste **`send-receipt`** anklicken.
3. Oben rechts auf **Deploy new version** (bei manchen Oberflächen heisst der
   Knopf *Edit function* oder *Deploy updates*).
4. Den **gesamten** Inhalt löschen und das hier einsetzen:

```ts
// 410-Gone-Stub (2026-09-02) — stillgelegt, siehe
// supabase/functions/send-receipt/BEFUND.md im Repo.
//
// Sie war fuer jede angemeldete Person aufrufbar und verschickte E-Mails von
// info@greenscan.ch mit Empfaenger, Betrag und Text frei aus dem
// Anfrage-Rumpf. Aufgerufen hat sie niemand.
//
// Sollen Quittungen spaeter wirklich verschickt werden: der Ausloeser gehoert
// in den stripe-webhook. Dort ist die Zahlung durch Stripes Signatur belegt,
// statt vom Aufrufer behauptet.
Deno.serve(() => new Response(
  JSON.stringify({ error: 'gone', deprecated_at: '2026-09-02' }),
  { status: 410, headers: { 'Content-Type': 'application/json' } }
));
```

5. **Deploy** drücken. Fertig — das dauert ein paar Sekunden.

### So geht es (mit der Supabase-CLI, falls du sie hast)

```bash
# im Repo-Ordner, nach einem `git pull`
supabase functions deploy send-receipt --project-ref vowbiueikwrauuceilhc
```

Der 410-Stub müsste dann noch ins Repo — sag mir Bescheid, ich schreibe ihn
dir vor dem Deploy hinein, damit die ausgelieferte Fassung und das Repo
übereinstimmen.

### Danach prüfen

Sag mir Bescheid. Ich lese die ausgelieferte Fassung aus und bestätige dir,
dass dort jetzt der Stub steht. **Am Zeitstempel allein erkennt man es
nicht** — das habe ich heute selbst falsch gemacht und musste mich
korrigieren.

### Was du dabei NICHT kaputt machen kannst

Nichts in der App ruft diese Funktion auf. Kein Bildschirm, kein Zeitplan,
keine andere Server-Funktion. Nachgezählt: **0 Aufrufe**.

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

### Die Arten-Daten

**4'342 Arten liegen in der App.** Nachgezählt am 02.09.2026:

| | verwertbar | fehlt bei |
|---|---|---|
| Blütenfarbe | **939** | 3'403 |
| Höhenverbreitung | **877** | 3'465 |

„Verwertbar" heisst: die Angabe lässt sich rechnen. Ein `color`-Feld mit
„Bunt-konzentrisch" oder „–" ist zwar gefüllt, sagt aber nichts.

Das kostet konkret:

- Die neue Prüfregel **Farbe** kann bei vier von fünf Arten nichts sagen.
- Die Prüfregel **Höhenlage** ebenso.
- „Ohne Netz eingrenzen" grenzt viel weniger scharf ein, als es könnte.

**Ich schreibe diese Angaben nicht aus dem Gedächtnis.** In einer App, die
Giftiges von Essbarem trennt, wäre erfundene Botanik das Gefährlichste, was
ich tun könnte — sie sähe genauso aus wie richtige.

Was ich brauche, ist **eine Quelle**. Zum Beispiel:

| Möglichkeit | Was ich dann tue |
|---|---|
| Ein Buch, das du hast | Du fotografierst die Seiten, `book-ingest` liest sie aus — die Funktion existiert schon und ist admin-geschützt |
| Info Flora (die nationale Datenbank) | Ich schreibe den Abgleich, du klärst die Nutzungsrechte |
| Eine Tabelle, die du selbst pflegst | Ich baue den Einlese-Weg und die Prüfung |
| „Mach es mit KI" | **Sage ich Nein** — mit Begründung: ein Modell, das eine Höhenangabe erfindet, tut das mit derselben Sicherheit wie eine richtige |

Sag mir, welcher Weg dir passt, und ich baue ihn.

---

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
