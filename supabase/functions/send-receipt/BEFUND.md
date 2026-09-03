# `send-receipt` — STILLGELEGT am 03.09.2026 (v32.42)

> **Erledigt.** Fernando hat die Stilllegung am 03.09.2026 ausdrücklich
> beauftragt; ausgeliefert ist seither ein 410-Stub (Version 4,
> `ezbr_sha256` `55e089b4…`, `verify_jwt` weiterhin `true`). Der Quelltext
> daneben in `index.ts` IST der Stub — der wortgetreue Spiegel der alten
> Fassung steht in der Versionsgeschichte:
> `git show 70ddf9e:supabase/functions/send-receipt/index.ts`
> (Commit-Hash, kein Tag — dieses Repo vergibt seit v26.5 keine Tags mehr;
> `git show v32.41:…` liefe ins Leere. Befehl geprüft.)
>
> Nachgemessen NACH dem Deploy, am Inhalt und nicht am Zeitstempel.
>
> Der Befund unten bleibt stehen — er ist die Begründung.

## Der Befund (Stand 02.09.2026, v32.19)

**Stand beim Prüfen:** ausgeliefert, `status: ACTIVE`, `version: 3`,
`verify_jwt: true`, zuletzt geändert am 10.04.2026 (`created_at == updated_at`).
Kein Spiegel im Repo — der Quelltext war nur über Supabase lesbar.

## Was sie tut

Sie schickt eine gestaltete Quittungs-E-Mail über Resend, von
`GreenScan <info@greenscan.ch>`. Zwei Varianten: Abo-Quittung und
Spendenquittung.

## Der Befund

**Sie ruft niemand auf.** Nachgezählt: 0 Aufrufe in `index.html`, 0 in
`cron.job`, 0 in den anderen Edge-Functions.

Und sie nimmt **alles aus dem Anfrage-Rumpf**:

```ts
const { type, email, name, amount, currency, date,
        transactionId, charityName, isSubscription } = await req.json()
```

Es gibt keine Prüfung gegen Stripe, keine Prüfung, ob die aufrufende Person
etwas mit dieser Zahlung zu tun hat, und keine Prüfung, ob ihr die
Empfängeradresse gehört. `verify_jwt: true` verlangt lediglich **irgendeinen**
gültigen Nutzer-Token.

**Damit kann jede angemeldete Person eine frei erfundene GreenScan-Quittung
an jede beliebige Adresse schicken** — mit beliebigem Betrag, beliebiger
Organisation und beliebigem Namen, abgeschickt von der verifizierten
Absenderdomäne der App. Der Text sagt wörtlich „Diese E-Mail ist deine
Zahlungsbestätigung. Bitte aufbewahren."

Das ist kein Datenabfluss. Es ist eine Vorlage für Betrug im Namen der App,
und nebenbei verbraucht es das Resend-Kontingent.

## Empfehlung

**Stilllegen** (410-Stub), wie in v30.18 und v30.95 mit den anderen
Einmal-Werkzeugen geschehen. Die Begründung ist dieselbe wie dort:

> Eine offene, unbenutzte Schnittstelle ist reine Angriffsfläche ohne
> Gegenwert.

Wenn Quittungen später wirklich verschickt werden sollen, gehört der Auslöser
in den **`stripe-webhook`** — dort ist die Zahlung durch Stripes Signatur
belegt, statt vom Aufrufer behauptet.

## Was am 03.09.2026 passiert ist

Fernando hat die Stilllegung ausdrücklich beauftragt. Vor dem Deploy geprüft:

| Prüfung | Ergebnis |
|---|---|
| Aufrufe in `index.html` | 0 |
| Aufrufe in anderen Edge-Functions / Migrationen | 0 |
| Ausgelieferte Fassung noch die des Befunds? | ja — v3, `ezbr_sha256` `54412e83…`, unverändert |

Die letzte Prüfung war die wichtigste: hätte sich seit dem 02.09. etwas
geändert, hätte der Deploy eine fremde Änderung überschrieben.

Danach ausgeliefert (v4) und **nachgemessen** — den Quelltext wieder
ausgelesen und bestätigt, dass dort der Stub steht. Am Inhalt, nicht am
Zeitstempel; genau dieser Fehler ist einer früheren Sitzung schon
unterlaufen.

## Der Spiegel — jetzt der Stub

`index.ts` daneben war bis v32.41 ein **wortgetreues Abbild der laufenden
Fassung** (gezogen am 02.09.2026, `ezbr_sha256` `54412e83…`). Seit v32.42 ist
es der 410-Stub, also wieder deckungsgleich mit dem, was läuft.

Wer die alte Fassung braucht — etwa für die Mail-Vorlage, wenn Quittungen
später über den `stripe-webhook` verschickt werden sollen:

```bash
git show 70ddf9e:supabase/functions/send-receipt/index.ts
```
