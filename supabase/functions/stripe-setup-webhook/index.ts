// 410-Gone-Stub (v26.55, 2026-05-27) — One-Shot-Setup-Tool, nicht mehr aufgerufen.
// Webhook-Events werden manuell im Dashboard verwaltet ODER via stripe-admin-extend-webhook.
// (v29: Repo-Mirror an deployten Stub angeglichen — entfernt den früheren hardcodierten Admin-Secret
//  aus dem public Repo und verhindert, dass ein Deploy-from-repo die alte Secret-gegatete Logik wiederbelebt.)
Deno.serve(() => new Response(JSON.stringify({ error: 'gone', replacement: 'stripe-admin-extend-webhook', deprecated_at: '2026-05-27' }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
