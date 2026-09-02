// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — aus der laufenden Auslieferung gezogen am 02.09.2026 (v32.19)
//
// Diese Funktion war ausgeliefert und aktiv, hatte aber KEINEN Quelltext im
// Repo. Wer wissen wollte, was sie tut, musste Supabase fragen; wer sie prüfen
// wollte, konnte es nicht. Das Repo ist damit nicht mehr die Quelle der
// Wahrheit für den eigenen Server-Teil.
//
// Stand beim Ziehen: version 1 · verify_jwt=false · ezbr_sha256 4e31d64e…
// Unverändert übernommen — dies ist ein Abbild, keine Überarbeitung.
// ══════════════════════════════════════════════════════════════════════════
// v28.04 Block C — Globaler-Anthropic-Key Health-Check.
// verify_jwt=false; Custom-Auth via x-cron-secret (app_settings.push_cron_secret) ODER service-role.
// Prüft den globalen Key gegen Anthropic /v1/models und schreibt Status in app_status.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ── Auth: x-cron-secret ODER service-role-Bearer ──
    const { data: secretRow } = await sb.from('app_settings').select('value').eq('key', 'push_cron_secret').maybeSingle();
    const expected = (secretRow?.value || '').trim();
    const gotSecret = (req.headers.get('x-cron-secret') || '').trim();
    const auth = req.headers.get('Authorization') || '';
    const isServiceRole = !!serviceKey && auth.includes(serviceKey);
    if (!isServiceRole && (!expected || gotSecret !== expected)) {
      return json({ error: 'forbidden' }, 403);
    }

    // ── Globalen Key holen ──
    const { data: keyRow } = await sb.from('app_settings').select('value').eq('key', 'global_anthropic_api_key').maybeSingle();
    const apiKey = (keyRow?.value || '').trim();

    let status = 'unknown';
    let message = '';
    if (!apiKey) {
      status = 'invalid';
      message = 'Kein globaler Anthropic-Key hinterlegt';
    } else {
      try {
        const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {
          method: 'GET',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        });
        if (r.status === 200) {
          status = 'ok';
          message = 'Key gültig · ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
        } else if (r.status === 401 || r.status === 403) {
          status = 'invalid';
          message = 'Key ungültig/abgelaufen (HTTP ' + r.status + ')';
        } else {
          status = 'unknown';
          message = 'Unerwarteter Anthropic-Status ' + r.status;
        }
      } catch (e) {
        status = 'unknown';
        message = 'Anthropic nicht erreichbar: ' + String((e as Error)?.message || e);
      }
    }

    await sb.from('app_status').upsert(
      { key: 'global_anthropic_key', status, message, last_check_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

    return json({ key: 'global_anthropic_key', status, message });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
