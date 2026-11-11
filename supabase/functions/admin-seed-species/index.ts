// ══════════════════════════════════════════════════════════════════════════
// STILLGELEGT — v30.95 (Sicherheit)
// ══════════════════════════════════════════════════════════════════════════
//
// Diese Funktion war ein EINMALIGES Seed-Werkzeug für public.species und ist
// seit dem Seeding fachlich erledigt (species: 2'838 Zeilen, neueste vom
// 2026-07-02). Sie lief trotzdem weiter als ACTIVE — und zwar so:
//
//   • verify_jwt = false           → für jeden im Internet aufrufbar
//   • SUPABASE_SERVICE_ROLE_KEY    → schreibt an RLS vorbei
//   • Schutz: EIN hartcodiertes Secret im Quelltext
//
// Und genau dieses Secret lag im Klartext im ÖFFENTLICHEN Repo — im aktuellen
// Tree von sechs gepushten claude/*-Branches. Die Rotation aus v29 (HL#19)
// hatte diese beiden Funktionen übersehen, weil sie gar kein Verzeichnis im
// Repo hatten: es gab keine Datei zum Durchsuchen.
//
// Wer das Secret fand, konnte die Artenbank der App beliebig überschreiben
// oder mit Müll fluten — die fachliche Grundlage von GreenScan.
// Nachweis geprüft: KEIN Missbrauch stattgefunden (nur 1 Zeile in 90 Tagen).
//
// Wird wieder geseedet? Dann NICHT diese Funktion reaktivieren, sondern:
//   psql/SQL-Editor mit dem Service-Key aus dem Dashboard — kein dauerhaft
//   offener HTTP-Endpunkt für eine Aufgabe, die einmal im Jahr vorkommt.
// ══════════════════════════════════════════════════════════════════════════
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "gone",
      message:
        "Diese Funktion wurde stillgelegt (v30.95). Sie war ein einmaliges Seed-Werkzeug mit hartcodiertem Secret und offenem Zugang. Seeding läuft ab sofort direkt über den SQL-Editor.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
