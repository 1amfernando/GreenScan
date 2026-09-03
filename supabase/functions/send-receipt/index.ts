// ══════════════════════════════════════════════════════════════════════════
// STILLGELEGT — v32.42 (Sicherheit), 03.09.2026
// ══════════════════════════════════════════════════════════════════════════
//
// Diese Funktion verschickte eine gestaltete Quittungs-E-Mail über Resend,
// abgesendet von der verifizierten Domäne `GreenScan <info@greenscan.ch>`.
//
// Sie nahm ALLES aus dem Anfrage-Rumpf:
//
//   const { type, email, name, amount, currency, date,
//           transactionId, charityName, isSubscription } = await req.json()
//   …
//   to: [email]
//
// Keine Prüfung gegen Stripe. Keine Prüfung, ob die aufrufende Person etwas
// mit dieser Zahlung zu tun hat. Keine Prüfung, ob ihr die Empfängeradresse
// gehört. `verify_jwt: true` verlangte lediglich IRGENDEINEN gültigen
// Nutzer-Token.
//
// Damit konnte jede angemeldete Person eine frei erfundene GreenScan-Quittung
// an jede beliebige Adresse schicken — beliebiger Betrag, beliebige
// Organisation, beliebiger Name — und der Fusstext sagte wörtlich:
// „Diese E-Mail ist deine Zahlungsbestätigung. Bitte aufbewahren."
//
// Das ist kein Datenabfluss. Es ist eine Vorlage für Betrug im Namen der App,
// und nebenbei verbrauchte es das Resend-Kontingent.
//
// VERIFIZIERT VOR DER STILLLEGUNG (03.09.2026):
//   • 0 Aufrufe aus index.html (Frontend)
//   • 0 Referenzen in den anderen Edge-Functions und in den Migrationen
//   • ausgelieferte Fassung unverändert seit dem Befund vom 02.09.2026:
//     version 3, ACTIVE, verify_jwt=true, ezbr_sha256 54412e83…
//
// > Eine offene, unbenutzte Schnittstelle ist reine Angriffsfläche ohne
// > Gegenwert. (dieselbe Begründung wie v30.88 und v30.95)
//
// WENN QUITTUNGEN WIRKLICH VERSCHICKT WERDEN SOLLEN, dann NICHT diese
// Funktion reaktivieren, sondern den Auslöser in den `stripe-webhook` legen:
// dort ist die Zahlung durch Stripes Signatur BELEGT, statt vom Aufrufer
// behauptet — und Empfänger, Betrag und Datum kommen aus dem Zahlungsobjekt,
// nicht aus dem Rumpf. Die alte Vorlage (HTML der beiden Mail-Varianten)
// steht in der Versionsgeschichte dieser Datei, Stand v32.41.
//
// `verify_jwt` bleibt bewusst auf `true`: ein stillgelegter Endpunkt soll
// nicht MEHR offen sein als vorher.
// ══════════════════════════════════════════════════════════════════════════

// Preflight sauber beantworten, damit der Aufrufer die 410 auch LESEN kann.
// Ohne diese Antwort sieht ein Browser nur einen CORS-Fehler und weiss nicht,
// dass der Endpunkt bewusst weg ist — dieselbe Regel wie überall in diesem
// Repo: eine Absage muss sagen, dass sie eine Absage ist.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  return new Response(
    JSON.stringify({
      error: "gone",
      message:
        "Diese Funktion wurde am 03.09.2026 stillgelegt (v32.42). Sie nahm Empfänger, Betrag und Text ungeprüft aus dem Anfrage-Rumpf und verschickte damit Quittungs-E-Mails von info@greenscan.ch. Quittungen gehören in den stripe-webhook, wo die Zahlung durch Stripes Signatur belegt ist.",
      deprecated_at: "2026-09-03",
      replacement: "stripe-webhook",
    }),
    { status: 410, headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
