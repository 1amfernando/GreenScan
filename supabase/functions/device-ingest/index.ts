// ═══════════════════════════════════════════════════════════════════════════
// device-ingest — der EINE Weg hinein fuer Geraete (docs/OEKOSYSTEM-V1.md §3.1,
// Vertrag: docs/GERAETE-VERTRAG.md). Stufe 1 — NICHT ausgeliefert.
//
// Ehrlich benannt: diese Funktion ist in der Claude-Cloud-Umgebung NICHT
// gelaufen (kein Deno, keine Datenbank). Geprueft ist die Rechnung dahinter —
// supabase/functions/_shared/ingest_regeln.mjs mit scripts/ingest_check.js.
// Was diese Datei zusaetzlich tut (Token-Hash, Insert mit ignoreDuplicates,
// Geraet aktualisieren, Befehle fortschreiben), braucht die lebende Funktion
// und ein Geraet zum Ausloesen. Deploy: `supabase functions deploy
// device-ingest --no-verify-jwt` — das Geraet hat kein Nutzerkonto, die
// Sicherheit ist das Geraete-Token (§3.2). Vorbild fuer verify_jwt=false mit
// eigener Pruefung: key-health-check, engagement-push-checker.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { pruefeBatch, rateLimit, befehleAufbereiten, acksAuswerten, antwort, naechsterKontaktS, erwartetBis } from '../_shared/ingest_regeln.mjs';

const json = (o: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...extra } });

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const now = Date.now();

    // ── 1 · Token → Geraet (nur der Hash liegt in der Datenbank) ──────────
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return json({ error: 'token' }, 401);
    const hash = await sha256Hex(token);
    const { data: device } = await sb.from('devices')
      .select('id,user_id,kind,status,capabilities,last_seen_at,paired_at')
      .eq('token_hash', hash).maybeSingle();
    if (!device) return json({ error: 'token' }, 401);

    // ── 2 · Rate-Limit je Aufruf (interval_s / 2) ─────────────────────────
    const rl = rateLimit(device, now);
    if (!rl.ok) return json({ error: 'rate', retry_after_s: rl.retry_after_s, server_time: new Date(now).toISOString() }, 429, { 'Retry-After': String(rl.retry_after_s) });

    // ── 3 · Katalog (was gemessen werden KANN) ────────────────────────────
    const { data: kat } = await sb.from('metric_catalog').select('key,unit,min_valid,max_valid');
    const katalog = new Map((kat || []).map((k: { key: string; unit: string; min_valid: number | null; max_valid: number | null }) =>
      [k.key, { unit: k.unit, min_valid: k.min_valid == null ? undefined : Number(k.min_valid), max_valid: k.max_valid == null ? undefined : Number(k.max_valid) }]));

    // ── 4 · Batch pruefen — reine Rechnung, geprueft in scripts/ingest_check.js ──
    let body: unknown = null;
    try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }
    const p = pruefeBatch(body, { device, katalog, now });
    if (!p.ok) return json({ error: p.error, ...(p.detail ? { detail: p.detail } : {}), server_time: new Date(now).toISOString() }, p.status);

    // ── 5 · Schreiben mit Idempotenz (PK device_id, metric, ts → Dubletten still) ──
    let eingefuegt = 0;
    if (p.rows.length) {
      const { data: ins, error } = await sb.from('device_readings')
        .upsert(p.rows, { onConflict: 'device_id,metric,ts', ignoreDuplicates: true })
        .select('ts');
      if (error) return json({ error: 'insert', message: error.message }, 500);
      eingefuegt = (ins || []).length;
    }

    // ── 6 · Geraet: gesehen, verbunden erst nach dem ersten Wert (§3.2) ───
    const kontakt = naechsterKontaktS(device);
    const patch: Record<string, unknown> = { last_seen_at: new Date(now).toISOString(), status: device.status === 'paused' ? 'paused' : 'active', updated_at: new Date(now).toISOString() };
    if (!device.paired_at && p.rows.length) patch.paired_at = new Date(now).toISOString();
    const cap = Object.assign({}, device.capabilities || {});
    cap.expected_by = erwartetBis(now, kontakt);                                   // §11 Idee 16: „verstummt" heisst 3 Kontakte ohne Wort
    const neueMetrics = new Set([...(cap.metrics || []), ...p.rows.map((r: { metric: string }) => r.metric)]);
    cap.metrics = Array.from(neueMetrics);
    patch.capabilities = cap;
    const b = body as { firmware?: string; acks?: unknown };
    if (typeof b.firmware === 'string') patch.firmware = b.firmware.slice(0, 40);   // Geraet meldet, Server schreibt — nie umgekehrt (Idee 18)
    await sb.from('devices').update(patch).eq('id', device.id);

    // ── 7 · Befehle: Acks vom Geraet, dann die offenen mit Ablauf (§3.3, Idee 20) ──
    const { data: offene } = await sb.from('device_commands')
      .select('id,command,params,status,attempts,expires_at')
      .eq('device_id', device.id).in('status', ['pending', 'sent']);
    const acks = acksAuswerten(b.acks, offene || []);
    for (const a of acks.acked) await sb.from('device_commands').update({ status: 'acked', acked_at: new Date(now).toISOString() }).eq('id', a.id);
    for (const f of acks.failed) await sb.from('device_commands').update({ status: 'failed', params: { fehler: f.message } }).eq('id', f.id);
    const rest = (offene || []).filter((c: { id: string }) => !acks.acked.find((a) => a.id === c.id) && !acks.failed.find((f) => f.id === c.id));
    const cmds = befehleAufbereiten(rest, now);
    for (const f of cmds.failed) await sb.from('device_commands').update({ status: 'failed' }).eq('id', f.id);
    for (const s of cmds.senden) await sb.from('device_commands').update({ status: 'sent', sent_at: new Date(now).toISOString(), attempts: s.attempt }).eq('id', s.id);

    // ── 8 · Antwort: accepted und duplicates getrennt, server_time, next_contact_s, Befehle ──
    return json(antwort(p, eingefuegt, { device, now, commands: cmds }));
  } catch (e) {
    return json({ error: 'server', message: (e as Error).message }, 500);
  }
});
