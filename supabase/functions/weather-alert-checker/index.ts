// weather-alert-checker v4 (v30.53 — 2026-06-26)
// Fixes:
//  - verify_jwt set to false (was true → cron job got 401 on every 3h run)
//  - inQuietHours: correct AND logic for same-day range (was OR = bug)
// Base: deployed v3 (v30.42 — dedup typo fix suppressed_dup→suppressed_dedup)
//
// 3-stündlicher Wetter-Checker: Frost / Hitze / Sturm aus Open-Meteo.
// Auth: x-cron-secret via Deno.env CRON_SECRET (optional; falls nicht gesetzt → open).
// Cron: 0 */3 * * * (UTC).

import webpush from "npm:web-push@3.6.7";
const sb = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
  Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cors = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

function zurichHour(): number {
  return Number(new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "numeric", hour12: false }).format(new Date()));
}

// Fixed: && for same-day range, || for overnight range
function inQuietHours(h: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return h >= start && h < end;  // e.g. 1–5: AND
  return h >= start || h < end;                    // e.g. 22–7: OR (overnight)
}

async function fetchForecast(lat: number, lng: number): Promise<any> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,windspeed_10m,precipitation&forecast_days=3&timezone=Europe/Zurich`;
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

function windowMetrics(payload: any, leadHours: number, nowMs: number) {
  const h = payload.hourly;
  if (!h?.time) return { minTemp: null, maxTemp: null, maxWind: null, maxPrecip: null };
  const cutoff = new Date(nowMs + leadHours * 3600000).toISOString();
  const now = new Date(nowMs).toISOString();
  let minTemp = Infinity, maxTemp = -Infinity, maxWind = 0, maxPrecip = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i] < now || h.time[i] > cutoff) continue;
    if (h.temperature_2m[i] != null) { minTemp = Math.min(minTemp, h.temperature_2m[i]); maxTemp = Math.max(maxTemp, h.temperature_2m[i]); }
    if (h.windspeed_10m[i] != null) maxWind = Math.max(maxWind, h.windspeed_10m[i]);
    if (h.precipitation[i] != null) maxPrecip = Math.max(maxPrecip, h.precipitation[i]);
  }
  return {
    minTemp: minTemp === Infinity ? null : minTemp,
    maxTemp: maxTemp === -Infinity ? null : maxTemp,
    maxWind, maxPrecip
  };
}

function buildAlerts(m: any, leadHours: number, sub: any) {
  const alerts: any[] = [];
  const thFrostWarn = sub.frost_threshold_c ?? 2;
  const thFrostCrit = sub.frost_threshold_c != null ? sub.frost_threshold_c - 3 : -2;
  const thHeatWarn = sub.heat_threshold_c ?? 32;
  const thHeatCrit = sub.heat_threshold_c != null ? sub.heat_threshold_c + 5 : 37;
  const thStormWarn = sub.storm_threshold_kmh ?? 60;
  const thStormCrit = sub.storm_threshold_kmh != null ? sub.storm_threshold_kmh + 30 : 90;

  if (m.minTemp != null) {
    if (m.minTemp <= thFrostCrit) {
      alerts.push({ type: "frost", category: "frost", severity: "critical", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.minTemp,
        title: `❄️ Harter Frost: ${m.minTemp.toFixed(1)}°C`, body: `In den nächsten ${leadHours}h droht starker Frost. Pflanzen schützen!` });
    } else if (m.minTemp <= thFrostWarn) {
      alerts.push({ type: "frost", category: "frost", severity: "warning", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.minTemp,
        title: `🌡️ Frostgefahr: ${m.minTemp.toFixed(1)}°C`, body: `In den nächsten ${leadHours}h möglicher Frost. Empfindliche Pflanzen schützen.` });
    }
  }
  if (m.maxTemp != null) {
    if (m.maxTemp >= thHeatCrit) {
      alerts.push({ type: "heat", category: "heat", severity: "critical", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.maxTemp,
        title: `🔥 Extreme Hitze: ${m.maxTemp.toFixed(1)}°C`, body: `In den nächsten ${leadHours}h extreme Hitze. Pflanzen morgens/abends giessen.` });
    } else if (m.maxTemp >= thHeatWarn) {
      alerts.push({ type: "heat", category: "heat", severity: "warning", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.maxTemp,
        title: `☀️ Hitzewarnung: ${m.maxTemp.toFixed(1)}°C`, body: `In den nächsten ${leadHours}h viel Hitze. Garten gut bewässern.` });
    }
  }
  if (m.maxWind != null) {
    if (m.maxWind >= thStormCrit) {
      alerts.push({ type: "storm", category: "storm", severity: "critical", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.maxWind,
        title: `🌪️ Sturm: ${m.maxWind.toFixed(0)} km/h`, body: `In den nächsten ${leadHours}h Sturm möglich. Hohe Pflanzen sichern!` });
    } else if (m.maxWind >= thStormWarn) {
      alerts.push({ type: "storm", category: "storm", severity: "warning", min_temp_c: m.minTemp, max_temp_c: m.maxTemp, metric: m.maxWind,
        title: `💨 Windwarnung: ${m.maxWind.toFixed(0)} km/h`, body: `In den nächsten ${leadHours}h stärkerer Wind. Topfpflanzen reinbringen.` });
    }
  }
  return alerts;
}

async function hasActiveAlert(userId: string, type: string) {
  const { data } = await sb.from("weather_alerts")
    .select("id")
    .eq("user_id", userId)
    .eq("alert_type", type)
    .eq("dismissed", false)
    .gt("valid_until", new Date().toISOString())
    .limit(1);
  return !!(data && data.length);
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

async function sendPush(sub: any, title: string, body: string, url: string, vapid: any, tag: string) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const payload = JSON.stringify({
      title, body, url,
      icon: "https://green-scan.ch/icons/icon-192.png",
      badge: "https://green-scan.ch/icons/icon-96.png",
      tag, data: { url }
    });
    const res = await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (e: any) {
    return { ok: false, status: e?.statusCode, error: String(e?.message || e) };
  }
}

async function deleteIfGone(sub: any, status?: number) {
  if (status === 410 || status === 404) {
    await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
}

async function processSubscription(sub: any, vapid: any, dryRun: boolean) {
  if (sub.gps_lat == null || sub.gps_lng == null) return { skipped: "no_coords" };
  const hourLocal = zurichHour();
  const leadHours = Math.max(2, Math.min(48, Number(sub.alert_lead_hours ?? 12)));
  const payload = await fetchForecast(Number(sub.gps_lat), Number(sub.gps_lng));
  if (!payload) return { skipped: "no_forecast" };
  const m = windowMetrics(payload, leadHours, Date.now());
  const alerts = buildAlerts(m, leadHours, sub);
  if (!alerts.length) return { sent: [], inboxed: 0 };

  const validUntil = new Date(Date.now() + leadHours * 60 * 60 * 1000).toISOString();
  const quiet = inQuietHours(hourLocal, sub.quiet_start_hour ?? 22, sub.quiet_end_hour ?? 7);
  const sent: string[] = [];
  let inboxed = 0;

  for (const a of alerts) {
    if (await hasActiveAlert(sub.user_id, a.type)) continue;

    let didPush = false;
    const canPush = (!quiet || a.severity === "critical");
    if (canPush && !(await alreadySentToday(sub.user_id, a.category))) {
      if (dryRun) { sent.push(a.type + "(dry)"); didPush = true; }
      else {
        const r = await sendPush(sub, a.title, a.body, "/?screen=garden", vapid, "gs-wx-" + a.type);
        await logSend(sub.user_id, a.category, a.title, a.body,
          { severity: a.severity, lead: leadHours }, r.ok ? "sent" : "failed", r.status, r.error);
        if (r.ok) { sent.push(a.type); didPush = true; }
        else await deleteIfGone(sub, r.status);
      }
    } else if (!dryRun) {
      await logSend(sub.user_id, a.category, a.title, a.body,
        { severity: a.severity, quiet }, quiet ? "suppressed_quiet" : "suppressed_dedup");
    }

    if (!dryRun) {
      await sb.from("weather_alerts").insert({
        user_id: sub.user_id, alert_type: a.type, severity: a.severity,
        title: a.title, body: a.body, min_temp_c: a.min_temp_c, max_temp_c: a.max_temp_c,
        metric: a.metric, valid_from: new Date().toISOString(), valid_until: validUntil,
        location_lat: sub.gps_lat, location_lng: sub.gps_lng, pushed: didPush
      });
      inboxed++;
    } else { inboxed++; }
  }

  if (sent.length > 0 && !dryRun) {
    await sb.from("push_subscriptions").update({
      last_push_sent_at: new Date().toISOString(), push_failure_count: 0
    }).eq("id", sub.id);
  }

  return { sent, inboxed };
}

async function getVapid() {
  const { data } = await sb.from("app_settings").select("value").eq("key", "vapid_keys").maybeSingle();
  if (!data?.value) throw new Error("vapid_keys not set");
  const v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
  return { publicKey: v.public_key ?? v.publicKey, privateKey: v.private_key ?? v.privateKey, subject: v.subject ?? "mailto:admin@green-scan.ch" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const secret = req.headers.get("x-cron-secret");
    const expected = Deno.env.get("CRON_SECRET");
    if (expected && secret !== expected) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const vapid = await getVapid();
    const { data: subs, error: subsErr } = await sb.from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth_secret, gps_lat, gps_lng, quiet_start_hour, quiet_end_hour, frost_threshold_c, heat_threshold_c, storm_threshold_kmh, alert_lead_hours")
      .eq("active", true)
      .not("endpoint", "is", null);
    if (subsErr) throw subsErr;

    const results: any[] = [];
    let totalSent = 0, totalInboxed = 0;
    for (const sub of subs ?? []) {
      try {
        const r = await processSubscription(sub, vapid, dryRun);
        results.push({ user: String(sub.user_id).slice(0, 8), ...r });
        if (r.sent) totalSent += r.sent.length;
        if (r.inboxed) totalInboxed += r.inboxed;
      } catch (e: any) {
        results.push({ user: String(sub.user_id).slice(0, 8), error: String(e?.message ?? e) });
      }
    }
    return new Response(JSON.stringify({ ok: true, version: 4, dry_run: dryRun, total_subs: subs?.length ?? 0, sent: totalSent, inboxed: totalInboxed, details: dryRun ? results : results.length }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: cors });
  }
});
