// ═══════════════════════════════════════════════════════════════════════════
// sensor-push — pusht frische `sensor_alert`-Zeilen aus `notifications`
// (docs/OEKOSYSTEM-V1.md §3.4, §11 Idee 16). Stufe 1 — NICHT ausgeliefert.
//
// Aufgerufen vom Cron `device-alerts` (20260906_sensor_push.sql), aber nur,
// wenn fn_device_alerts() etwas Neues gemeldet hat; von Hand mit
// `?dry_run=1` und dem x-cron-secret. Die Rechnung — wer bekommt was, Stille,
// Pause, notify_sensor, „schon protokolliert", der Marker fuer die Bruecke —
// steht in _shared/sensor_push_regeln.mjs und ist mit
// scripts/sensor_push_check.js geprueft. Diese Datei ist der duenne Rand:
// lesen, senden, protokollieren. Sie ist in der Claude-Cloud-Umgebung NICHT
// gelaufen (kein Deno, keine Datenbank).
//
// Deploy: `supabase functions deploy sensor-push` (verify_jwt bleibt an; der
// Cron schickt das x-cron-secret wie bei daily-push-checker).
// ═══════════════════════════════════════════════════════════════════════════
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { KATEGORIE, FENSTER_MS, FEHLSCHLAEGE_MAX, planen, nutzlast, protokollZeile, stummZeile } from "../_shared/sensor_push_regeln.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

async function loadSettings() {
  const { data, error } = await sb.from("app_settings").select("key,value")
    .in("key", ["vapid_public_key", "vapid_private_key", "vapid_subject", "push_cron_secret"]);
  if (error) throw new Error("settings load: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  if (!m.vapid_public_key || !m.vapid_private_key) throw new Error("VAPID-Keys fehlen");
  return {
    vapid: { publicKey: m.vapid_public_key, privateKey: m.vapid_private_key, subject: m.vapid_subject || "mailto:fernando.rankwiler1997@gmail.com" },
    cronSecret: m.push_cron_secret || null,
  };
}

function zurichHour(): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Zurich" }).format(new Date())) % 24;
  } catch (_) { return new Date().getUTCHours(); }
}

async function sendPush(abo: any, n: { title: string; body: string; url: string; tag: string }, vapid: any) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth_secret } };
    const payload = JSON.stringify({
      title: n.title, body: n.body, url: n.url,
      icon: "https://green-scan.ch/icons/icon-192.png",
      badge: "https://green-scan.ch/icons/icon-96.png",
      tag: n.tag,
      data: { url: n.url },
    });
    const res = await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (e: any) {
    return { ok: false, status: e?.statusCode, error: String(e?.message || e) };
  }
}

Deno.serve(async (req: Request) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  try {
    const settings = await loadSettings();
    const cronSecret = req.headers.get("x-cron-secret");
    const authHdr = req.headers.get("authorization") || "";
    const okAuth = (settings.cronSecret && cronSecret === settings.cronSecret) || authHdr.includes(SERVICE_ROLE);
    if (!okAuth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const now = Date.now();
    const seit = new Date(now - FENSTER_MS).toISOString();

    // 1 · frische Inbox-Zeilen der Art sensor_alert (der Cron hat sie geschrieben)
    const { data: meldungen, error: e1 } = await sb.from("notifications")
      .select("id,user_id,kind,title,body,link,created_at")
      .eq("kind", KATEGORIE).gte("created_at", seit).order("created_at", { ascending: true }).limit(500);
    if (e1) throw e1;
    if (!meldungen || !meldungen.length) {
      return new Response(JSON.stringify({ ok: true, dry_run: dryRun, meldungen: 0, geplant: 0, gesendet: 0 }), { headers: cors });
    }

    // 2 · was in diesem Fenster schon versucht wurde (Marker: payload_meta.notification_id)
    const { data: protokoll, error: e2 } = await sb.from("push_send_log")
      .select("user_id,payload_meta,result").eq("category", KATEGORIE).gte("sent_at", seit);
    if (e2) throw e2;

    // 3 · die Abonnements der betroffenen Nutzer
    const nutzer = Array.from(new Set(meldungen.map((m: any) => m.user_id)));
    const { data: abos, error: e3 } = await sb.from("push_subscriptions").select("*")
      .in("user_id", nutzer).lt("push_failure_count", FEHLSCHLAEGE_MAX);
    if (e3) throw e3;

    // 4 · die Rechnung — geprueft in scripts/sensor_push_check.js
    const plan = planen({ meldungen, protokoll: protokoll || [], abos: abos || [], now, stunde: zurichHour() });

    // 5 · stumm protokollieren (Stille, Pause) — nicht nachholen, die Inbox hat die Zeile
    if (!dryRun) {
      for (const s of plan.stumm) await sb.from("push_send_log").insert(stummZeile(s.meldung, s.abo, s.grund));
    }

    // 6 · senden und protokollieren; 410/404 raeumt das Abonnement
    let gesendet = 0, fehlgeschlagen = 0;
    if (!dryRun) {
      for (const s of plan.senden) {
        const r = await sendPush(s.abo, nutzlast(s.meldung), settings.vapid);
        await sb.from("push_send_log").insert(protokollZeile(s.meldung, s.abo,
          r.ok ? { result: "sent", status: r.status } : { result: "failed", status: r.status, error: r.error }));
        if (r.ok) {
          gesendet++;
          await sb.from("push_subscriptions").update({ last_push_sent_at: new Date(now).toISOString(), push_failure_count: 0 }).eq("id", s.abo.id);
        } else {
          fehlgeschlagen++;
          if (r.status === 410 || r.status === 404) await sb.from("push_subscriptions").delete().eq("endpoint", s.abo.endpoint);
          else await sb.from("push_subscriptions").update({ push_failure_count: (s.abo.push_failure_count || 0) + 1 }).eq("id", s.abo.id);
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun, meldungen: meldungen.length,
      geplant: plan.senden.length, gesendet, fehlgeschlagen,
      stumm: plan.stumm.length, uebersprungen: plan.uebersprungen.length,
      gruende: plan.uebersprungen.slice(0, 20).map((u) => u.grund),
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: cors });
  }
});
