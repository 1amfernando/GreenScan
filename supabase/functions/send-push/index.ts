import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// send-push v3 (v30.87 — Audit P0-3): v2 + ECHTE JWT-Verifikation.
// On-demand / Test-Push-Endpoint. verify_jwt=true (Gateway validiert JWT).
// Rollen-Auth INNERHALB:
//   authentifizierter User → darf NUR an sich selbst pushen (uid aus VERIFIZIERTEM Token)
//   + profiles.role='admin' + body.broadcast=true
//                          → darf an ALLE Subscriber pushen (Cap 500 Subs/Call)
//   service_role           → darf an body.user_id pushen (Cron/Admin) oder broadcast
// VAPID-Keys aus app_settings (gleiche Quelle wie daily-push-checker).
//
// ═══ v30.87 SECURITY-FIX (Audit P0-3) ═══════════════════════════════════
// v2 las Rolle und User-ID aus dem base64-Payload des JWT — OHNE die Signatur
// zu pruefen (`decodeJwt`). Zusaetzlich galt `authHdr.includes(SERVICE_ROLE)`
// als Service-Nachweis: ein Substring-Test auf einen Vollmacht-Schluessel.
// Das war nur deshalb nicht ausnutzbar, weil das Gateway-Flag verify_jwt=true
// gesetzt ist — ein einziger Klick im Dashboard haette daraus einen
// unauthentifizierten Broadcast-Endpunkt an ALLE Push-Abonnenten gemacht.
// Ein JWT-Payload ist KEIN Nachweis, er ist frei waehlbarer Klartext.
//
// Jetzt: (a) service_role via Constant-Time-Compare des VOLLEN Keys,
//        (b) User via sb.auth.getUser(token) — serverseitig signaturgeprueft.
// Fail-closed: ohne gueltigen Nachweis 401. Defense-in-Depth, also unabhaengig
// davon, wie das Gateway-Flag steht.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function loadVapid() {
  const { data, error } = await sb
    .from("app_settings")
    .select("key,value")
    .in("key", ["vapid_public_key", "vapid_private_key", "vapid_subject"]);
  if (error) throw new Error("settings load: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  if (!m.vapid_public_key || !m.vapid_private_key) throw new Error("VAPID-Keys fehlen");
  return {
    publicKey: m.vapid_public_key,
    privateKey: m.vapid_private_key,
    subject: m.vapid_subject || "mailto:info@greenscan.ch"
  };
}

// v30.87: Constant-Time-Vergleich (Muster aus daily-push, dem staerksten
// Guard im Repo). Verhindert Timing-Rueckschluesse auf den Service-Key.
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// v30.87: Ersetzt das alte, ungeprüfte `decodeJwt`. Liefert entweder einen
// nachgewiesenen Service-Aufruf oder eine serverseitig verifizierte User-ID.
async function authenticate(authHdr: string): Promise<{ isService: boolean; uid: string | null }> {
  const token = authHdr.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { isService: false, uid: null };

  // (a) Cron/Admin mit Service-Role-Key — voller Key, Constant-Time.
  if (SERVICE_ROLE && constantTimeEquals(token, SERVICE_ROLE)) {
    return { isService: true, uid: null };
  }

  // (b) Regulaerer User — Signatur wird serverseitig geprueft.
  try {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (!error && user) return { isService: false, uid: user.id };
  } catch (_) { /* fail-closed */ }

  return { isService: false, uid: null };
}

async function logSend(
  userId: string, category: string, title: string, body: string,
  payload: any, result: string, httpStatus?: number, errorMsg?: string
) {
  try {
    await sb.from("push_send_log").insert({
      user_id: userId, category, title, body, payload_meta: payload,
      result, http_status: httpStatus, error_msg: errorMsg
    });
  } catch (_) { /* log best-effort */ }
}

async function sendOne(sub: any, title: string, body: string, url: string, tag: string, vapid: any) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const payload = JSON.stringify({
      title, body, url,
      icon: "https://green-scan.ch/icons/icon-192.png",
      badge: "https://green-scan.ch/icons/icon-96.png",
      tag,
      data: { url }
    });
    const res = await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (e: any) {
    return { ok: false, status: e?.statusCode, error: String(e?.message || e) };
  }
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });

  try {
    const authHdr = req.headers.get("authorization") || "";
    // v30.87: verifizierte Identitaet statt geratenem JWT-Payload.
    const { isService, uid: jwtSub } = await authenticate(authHdr);
    if (!isService && !jwtSub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    // Admin-Broadcast — JWT-User muss profiles.role='admin' sein (Server-Check,
    // nicht client-vertrauend). service_role darf broadcast direkt.
    let broadcast = false;
    if (body.broadcast === true) {
      if (isService) {
        broadcast = true;
      } else if (jwtSub) {
        const { data: prof } = await sb.from("profiles").select("role").eq("id", jwtSub).maybeSingle();
        if (prof && prof.role === "admin") broadcast = true;
        else return new Response(JSON.stringify({ error: "broadcast_admin_only" }), { status: 403, headers: cors });
      }
    }

    let targetUid: string | null = null;
    if (isService) {
      targetUid = body.user_id || body.target_user_id || null;
    } else if (jwtSub) {
      targetUid = jwtSub; // self only (außer broadcast, oben geprüft)
    }
    if (!targetUid && !broadcast) {
      return new Response(JSON.stringify({ error: "unauthorized_or_no_target" }), { status: 401, headers: cors });
    }

    const category = String(body.category || (broadcast ? "broadcast" : "test")).slice(0, 40);
    const title = String(body.title || "🔔 GreenScan Test").slice(0, 120);
    const text  = String(body.body || "Push-Benachrichtigungen funktionieren! 🌿").slice(0, 200);
    const url   = String(body.url || "/?screen=favs").slice(0, 300);
    const tag   = String(body.tag || ("gs-" + category)).slice(0, 60);

    const vapid = await loadVapid();

    let q = sb.from("push_subscriptions").select("*").lt("push_failure_count", 5);
    if (!broadcast) q = q.eq("user_id", targetUid);
    const { data: subs, error: e1 } = await q.limit(500); // Cap als Runaway-Schutz
    if (e1) throw e1;

    if (!subs || !subs.length) {
      if (targetUid) await logSend(targetUid, category, title, text, {}, "no_subscription");
      return new Response(JSON.stringify({ ok: false, error: "no_subscription", sent: 0 }), { headers: cors });
    }

    let sent = 0, failed = 0;
    const seenUsers = new Set<string>();
    for (const s of subs) {
      const r = await sendOne(s, title, text, url, tag, vapid);
      const logUid = broadcast ? (s.user_id || targetUid) : targetUid;
      if (logUid) await logSend(logUid, category, title, text, { endpoint: String(s.endpoint).slice(0, 40) }, r.ok ? "sent" : "failed", r.status, r.error);
      if (s.user_id) seenUsers.add(String(s.user_id));
      if (r.ok) {
        sent++;
        await sb.from("push_subscriptions").update({ last_push_sent_at: new Date().toISOString(), push_failure_count: 0 }).eq("id", s.id);
      } else {
        failed++;
        if (r.status === 410 || r.status === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          await sb.from("push_subscriptions").update({ push_failure_count: (s.push_failure_count || 0) + 1 }).eq("id", s.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: sent > 0, sent, failed, subscriptions: subs.length, users: seenUsers.size, broadcast }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
