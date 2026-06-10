import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// send-push v2 (v28.99 — 2026-06-10): v1 + ADMIN-BROADCAST.
// On-demand / Test-Push-Endpoint. verify_jwt=true (Gateway validiert JWT).
// Rollen-Auth INNERHALB:
//   role=authenticated → darf NUR an sich selbst pushen (uid aus JWT.sub)
//   role=authenticated + profiles.role='admin' + body.broadcast=true
//                      → darf an ALLE Subscriber pushen (Cap 500 Subs/Call)
//   role=service_role  → darf an body.user_id pushen (Cron/Admin) oder broadcast
// VAPID-Keys aus app_settings (gleiche Quelle wie daily-push-checker).

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
    subject: m.vapid_subject || "mailto:fernando.rankwiler1997@gmail.com"
  };
}

function decodeJwt(authHeader: string): { sub?: string; role?: string } {
  try {
    const tok = authHeader.replace(/^Bearer\s+/i, "").trim();
    const seg = tok.split(".")[1];
    if (!seg) return {};
    const json = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(json);
    return { sub: p.sub, role: p.role };
  } catch (_) { return {}; }
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
    const { sub: jwtSub, role } = decodeJwt(authHdr);
    const isService = role === "service_role" || authHdr.includes(SERVICE_ROLE);

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }

    // v2: Admin-Broadcast — JWT-User muss profiles.role='admin' sein (Server-Check,
    // nicht client-vertrauend). service_role darf broadcast direkt.
    let broadcast = false;
    if (body.broadcast === true) {
      if (isService) {
        broadcast = true;
      } else if (role === "authenticated" && jwtSub) {
        const { data: prof } = await sb.from("profiles").select("role").eq("id", jwtSub).single();
        if (prof && prof.role === "admin") broadcast = true;
        else return new Response(JSON.stringify({ error: "broadcast_admin_only" }), { status: 403, headers: cors });
      }
    }

    let targetUid: string | null = null;
    if (isService) {
      targetUid = body.user_id || body.target_user_id || null;
    } else if (role === "authenticated" && jwtSub) {
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
