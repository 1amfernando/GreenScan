import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// daily-push-checker v4 (v26.57 — 2026-05-28 LIVE deployed)
// - v2: Frost / Seasonal / Quiz-Streak
// - v3: + Trial-End 24-25h
// - v4: + Trial-End 72-73h + Trial-End 1-2h (3 Stages für besseren Conversion-Funnel)
//
// Stages haben eigene categories (trial_end_72h, trial_end_24h, trial_end_1h)
// damit alreadySentToday-Dedup je Stage greift.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function loadSettings() {
  const { data, error } = await sb
    .from("app_settings")
    .select("key,value")
    .in("key", ["vapid_public_key", "vapid_private_key", "vapid_subject", "push_cron_secret"]);
  if (error) throw new Error("settings load: " + error.message);
  const m: Record<string, string> = {};
  for (const r of data || []) m[r.key] = r.value;
  if (!m.vapid_public_key || !m.vapid_private_key) throw new Error("VAPID-Keys fehlen");
  return {
    vapid: {
      publicKey: m.vapid_public_key,
      privateKey: m.vapid_private_key,
      subject: m.vapid_subject || "mailto:fernando.rankwiler1997@gmail.com"
    },
    cronSecret: m.push_cron_secret || null
  };
}

function inQuietHours(hourUtc: number, qs: number, qe: number) {
  if (qs === qe) return false;
  if (qs < qe) return hourUtc >= qs && hourUtc < qe;
  return hourUtc >= qs || hourUtc < qe;
}

async function checkFrost(lat: number, lng: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m&forecast_days=1&timezone=auto`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { minTempC: null as number | null, hourEta: null as number | null };
    const j = await r.json();
    const temps: number[] = j?.hourly?.temperature_2m || [];
    if (!temps.length) return { minTempC: null, hourEta: null };
    const next12 = temps.slice(0, 12);
    let min = Infinity, idx = -1;
    next12.forEach((t, i) => { if (t < min) { min = t; idx = i; }});
    return { minTempC: min === Infinity ? null : min, hourEta: idx };
  } catch (_) { return { minTempC: null, hourEta: null }; }
}

async function alreadySentToday(userId: string, category: string) {
  const { data } = await sb.rpc("fn_push_already_sent_today", { p_user: userId, p_category: category });
  return data === true;
}

async function logSend(
  userId: string, category: string, title: string, body: string,
  payload: any, result: string, httpStatus?: number, errorMsg?: string
) {
  await sb.from("push_send_log").insert({
    user_id: userId, category, title, body, payload_meta: payload,
    result, http_status: httpStatus, error_msg: errorMsg
  });
}

async function sendPush(sub: any, title: string, body: string, url: string, vapid: any) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const payload = JSON.stringify({
      title, body, url,
      icon: "https://green-scan.ch/icons/icon-192.png",
      badge: "https://green-scan.ch/icons/icon-96.png",
      tag: "gs-" + Date.now()
    });
    const res = await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (e: any) {
    return { ok: false, status: e?.statusCode, error: String(e?.message || e) };
  }
}

async function processSubscription(sub: any, vapid: any, dryRun: boolean) {
  const userId = sub.user_id;
  const nowUtc = new Date();
  const hourUtc = nowUtc.getUTCHours();
  const month = nowUtc.getUTCMonth() + 1;

  if (inQuietHours(hourUtc, sub.quiet_start_hour ?? 22, sub.quiet_end_hour ?? 7)) {
    await logSend(userId, "frost", "", "", { hourUtc }, "suppressed_quiet");
    return { suppressed: true };
  }

  const sent: string[] = [];

  if (sub.notify_frost && sub.gps_lat != null && sub.gps_lng != null) {
    if (!(await alreadySentToday(userId, "frost"))) {
      const f = await checkFrost(Number(sub.gps_lat), Number(sub.gps_lng));
      if (f.minTempC !== null && f.minTempC <= 2) {
        const title = `🥶 Frostgefahr in den nächsten ${f.hourEta ?? 12}h`;
        const body = `Min. ${f.minTempC.toFixed(1)}°C — kälteempfindliche Pflanzen schützen!`;
        if (dryRun) sent.push("frost(dry)");
        else {
          const r = await sendPush(sub, title, body, "/?tab=garden", vapid);
          await logSend(userId, "frost", title, body, f, r.ok ? "sent" : "failed", r.status, r.error);
          if (r.ok) sent.push("frost");
        }
      }
    }
  }

  if (sub.notify_seasonal && hourUtc < 12) {
    if (!(await alreadySentToday(userId, "seasonal"))) {
      const { data: tasks } = await sb
        .from("garden_tasks_catalog")
        .select("task_title,task_description,priority")
        .lte("month_start", month).gte("month_end", month)
        .eq("priority", "high")
        .limit(1);
      if (tasks && tasks.length) {
        const t: any = tasks[0];
        const title = `📅 Saisonale Aufgabe: ${t.task_title}`;
        const body = (t.task_description || "").slice(0, 120);
        if (dryRun) sent.push("seasonal(dry)");
        else {
          const r = await sendPush(sub, title, body, "/?tab=garden", vapid);
          await logSend(userId, "seasonal", title, body, { task: t.task_title }, r.ok ? "sent" : "failed", r.status, r.error);
          if (r.ok) sent.push("seasonal");
        }
      }
    }
  }

  if (sub.notify_quiz_streak && hourUtc >= 17) {
    if (!(await alreadySentToday(userId, "quiz_streak"))) {
      const { data: q } = await sb.from("daily_quizzes").select("id").limit(1);
      if (q && q.length) {
        const title = `🎯 Tagesquiz wartet`;
        const body = `Spiele heute noch dein Quiz und halte deine Streak am Leben!`;
        if (dryRun) sent.push("quiz(dry)");
        else {
          const r = await sendPush(sub, title, body, "/?tab=wissen", vapid);
          await logSend(userId, "quiz_streak", title, body, {}, r.ok ? "sent" : "failed", r.status, r.error);
          if (r.ok) sent.push("quiz_streak");
        }
      }
    }
  }

  if (sent.length > 0 && !dryRun) {
    await sb.from("push_subscriptions").update({
      last_push_sent_at: new Date().toISOString(),
      push_failure_count: 0
    }).eq("id", sub.id);
  }
  return { suppressed: false, sent };
}

async function notifyTrialEnd_stage(
  windowLoHours: number, windowHiHours: number,
  category: string, title: string, body: string,
  vapid: any, dryRun: boolean
): Promise<number> {
  const now = new Date();
  const lo = new Date(now.getTime() + windowLoHours * 60 * 60 * 1000);
  const hi = new Date(now.getTime() + windowHiHours * 60 * 60 * 1000);

  const { data: subs, error } = await sb.from("stripe_subscriptions")
    .select("user_id, trial_end, status")
    .eq("status", "trialing")
    .gte("trial_end", lo.toISOString())
    .lt("trial_end", hi.toISOString());
  if (error) { console.warn(`[trial-end ${category}] query err:`, error); return 0; }
  if (!subs || !subs.length) return 0;

  let totalSent = 0;
  for (const trialSub of subs) {
    const userId = trialSub.user_id as string;
    if (await alreadySentToday(userId, category)) continue;

    const { data: pushSubs } = await sb
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .lt("push_failure_count", 5);

    if (!pushSubs || !pushSubs.length) {
      await logSend(userId, category, "", "", { trial_end: trialSub.trial_end, stage: category }, "no_subscription");
      continue;
    }

    for (const ps of pushSubs) {
      if (dryRun) { totalSent++; continue; }
      const r = await sendPush(ps, title, body, "/?open=abo&utm_source=push_trial_" + category, vapid);
      await logSend(userId, category, title, body, { trial_end: trialSub.trial_end, stage: category }, r.ok ? "sent" : "failed", r.status, r.error);
      if (r.ok) totalSent++;
      if (!r.ok && (r.status === 410 || r.status === 404)) {
        await sb.from("push_subscriptions").delete().eq("endpoint", ps.endpoint);
      }
    }
  }
  return totalSent;
}

async function notifyTrialEndingSoon(vapid: any, dryRun: boolean) {
  let total = 0;
  total += await notifyTrialEnd_stage(72, 73, "trial_end_72h",
    "⏰ Dein GreenScan-Pro endet in 3 Tagen",
    "Karte hinterlegen und KI-Doctor, Buch-Wissen, Familien-Konto behalten.",
    vapid, dryRun);
  total += await notifyTrialEnd_stage(24, 25, "trial_end_24h",
    "⏰ Dein GreenScan-Pro endet morgen",
    "Jetzt verlängern und alle Pro-Features behalten.",
    vapid, dryRun);
  total += await notifyTrialEnd_stage(1, 2, "trial_end_1h",
    "⏰ Letzte Stunde — Trial endet gleich",
    "Karte hinterlegen damit's nahtlos weitergeht (sonst zurück auf Free).",
    vapid, dryRun);
  return total;
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  try {
    const settings = await loadSettings();
    const cronSecret = req.headers.get("x-cron-secret");
    const authHdr = req.headers.get("authorization") || "";
    const okAuth = (settings.cronSecret && cronSecret === settings.cronSecret) || authHdr.includes(SERVICE_ROLE);
    if (!okAuth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    }

    const { data: subs, error: e1 } = await sb
      .from("push_subscriptions")
      .select("*")
      .lt("push_failure_count", 5);
    if (e1) throw e1;

    let totalSent = 0, totalSuppressed = 0, errors = 0;
    const details: any[] = [];
    for (const sub of (subs || [])) {
      try {
        const r = await processSubscription(sub, settings.vapid, dryRun);
        if (r.suppressed) totalSuppressed++;
        if (r.sent) totalSent += r.sent.length;
        details.push({ user: sub.user_id.slice(0, 8), ...r });
      } catch (e: any) {
        errors++;
        details.push({ user: sub.user_id.slice(0, 8), error: String(e.message || e) });
      }
    }

    let trialSent = 0;
    try {
      trialSent = await notifyTrialEndingSoon(settings.vapid, dryRun);
    } catch (e: any) {
      console.warn("[trial-end] block err:", e);
    }

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun,
      version: 4,
      total_subs: subs?.length || 0,
      pushed_count: totalSent,
      suppressed_count: totalSuppressed,
      trial_sent: trialSent,
      errors,
      details: dryRun ? details : details.length
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
