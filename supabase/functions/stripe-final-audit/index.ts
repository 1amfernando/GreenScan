// 410-Gone-Stub (v30.88, 2026-08-28) — Einmaliges Audit-Tool (Setup-Zeit).
//
// WARUM STILLGELEGT (Audit P1-1):
// Diese Funktion war weiterhin ACTIVE und mit verify_jwt:false deployed, also
// fuer JEDEN im Internet aufrufbar — obwohl sie laut eigener Projekt-Doku
// toter Setup-Code ist. Mehrere dieser Tools mutieren ECHTE Stripe-Daten
// (Produkte, Preise, Webhooks, Abos). Eine offene, unbenutzte Schreib-Schnittstelle
// auf ein Live-Zahlungssystem ist reine Angriffsflaeche ohne Gegenwert.
//
// VERIFIZIERT VOR DER STILLLEGUNG (2026-08-28):
//   • 0 Aufrufe aus index.html (Frontend)
//   • 0 Referenzen in cron.job (kein Scheduler haengt daran)
// Ersatz / heute genutzt: Stripe-Dashboard
Deno.serve(() => new Response(
  JSON.stringify({ error: 'gone', replacement: 'Stripe-Dashboard', deprecated_at: '2026-08-28' }),
  { status: 410, headers: { 'Content-Type': 'application/json' } }
));
