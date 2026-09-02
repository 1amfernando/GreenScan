# `send-receipt` — Befund vom 02.09.2026 (v32.19)

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

## Was hier NICHT passiert ist

Ich habe nichts ausgeliefert. Das Stilllegen ist ein Eingriff in die laufende
Auslieferung; er gehört zu Fernando, so wie die offenen Migrationen
(`STATUS.md`, 2026-08-31 y). Dieser Befund ist die Vorarbeit dazu, nicht die
Handlung.

## Der Spiegel

`index.ts` daneben ist ein **wortgetreues Abbild der laufenden Fassung**,
gezogen am 02.09.2026 (`ezbr_sha256` 54412e83…). Es ist keine Überarbeitung —
wer stilllegt, ersetzt es; wer sie behalten will, sieht hier, was sie tut.
