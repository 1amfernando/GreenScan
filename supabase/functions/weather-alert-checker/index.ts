import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// weather-alert-checker v3 (v30.42 — 2026-06-25)
// 3-stündlicher Wetter-Checker: Frost / Hitze / Sturm aus Open-Meteo.
// - Schreibt persistente Alerts in weather_alerts (Inbox, RLS own-only).
// - Sendet Web-Push (VAPID aus app_settings), respektiert Stille-Zeit
//   AUSSER severity='critical'. Inbox-Row wird IMMER geschrieben (lautlos).
// - Dedup teilt fn_push_already_sent_today mit daily-push-checker (Kat. 'frost')
//   → kein Doppel-Frost-Push am selben Tag.
// - Server-Koordinaten aus push_subscriptions.gps_lat/gps_lng.
// - Forecast-Cache (weather_forecast_cache, grid 0.1°, 3h TTL) spart API-Calls.
// Cron: 0 */3 * * * (UTC). Auth: x-cron-secret ODER service-role-Authorization.
//
// v30.36 FIXES (Audit-Welle 3):
//  #3: windowMetrics startet jetzt ab der AKTUELLEN Stunde (nicht ab lokaler
//      Mitternacht/Index 0). Open-Meteo liefert mit timezone=auto lokale Zeiten;
//      mit utc_offset_seconds wird der Start-Index relativ zu now() bestimmt.
//      'in ca. Xh' ist jetzt Stunden-ab-JETZT. Vorher: Nachmittags-/Abend-Ticks
//      prüften nur die schon vergangenen Vormittagsstunden → heutige Nacht-Fröste
//      wurden NIE erkannt.
//  #5: Quiet-Hours werden gegen Europe/Zurich (CH) geprüft, nicht UTC.

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

function inQuietHours(hour: number, qs: number, qe: number) {
  if (qs === qe) return false;
  if (qs < qe) return hour >= qs && hour < qe;
  return hour >= qs || hour < qe;
}

// v30.36 #5: aktuelle Stunde in Europe/Zurich (DST-sicher via Intl), Fallback UTC.
function zurichHour(): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Zurich" }).format(new Date())) % 24;
  } catch (_) {
    return new Date().getUTCHours();
  }
}

function gridKey(lat: number, lng: number) {
  return `${(Math.round(lat * 10) / 10).toFixed(1)},${(Math.round(lng * 10) / 10).toFixed(1)}`;
}

async function fetchForecast(lat: number, lng: number) {
  const key = gridKey(lat, lng);
  // Cache-Hit (< 3h)?
  try {
    const { data: c } = await sb
      .from("weather_forecast_cache")
      .select("payload, fetched_at")
      .eq("grid_key", key)
      .maybeSingle();
    if (c && c.fetched_at) {
      const ageMs = Date.now() - new Date(c.fetched_at).getTime();
      // v30.36: alte Cache-Payloads ohne utc_offset_seconds NICHT verwenden (sonst falscher Start-Index) → frisch holen.
      if (ageMs < 3 * 60 * 60 * 1000 && c.payload && c.payload.utc_offset_seconds != null) return c.payload;
    }
  } catch (_) { /* cache best-effort */ }

  const [glat, glng] = key.split(",").map(Number);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${glat}&longitude=${glng}` +
    `&hourly=temperature_2m,precipitation,wind_gusts_10m&forecast_days=2&timezone=auto`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json();
    const payload = {
      time: j?.hourly?.time || [],
      temperature_2m: j?.hourly?.temperature_2m || [],
      precipitation: j?.hourly?.precipitation || [],
      wind_gusts_10m: j?.hourly?.wind_gusts_10m || [],
      utc_offset_seconds: Number(j?.utc_offset_seconds || 0)  // v30.36 #3
    };
    try {
      await sb.from("weather_forecast_cache").upsert({
        grid_key: key, lat: glat, lng: glng, payload, fetched_at: new Date().toISOString()
      });
    } catch (_) { /* best-effort */ }
    return payload;
  } catch (_) { return null; }
}

// Aggregiert die kommenden N Stunden (lead window) AB JETZT zu Min/Max-Metriken.
// v30.36 #3: startIdx = erster Forecast-Eintrag >= jetzt (statt fix 0 = lokale Mitternacht).
function windowMetrics(payload: any, leadHours: number, nowMs: number) {
  const temps: number[] = payload?.temperature_2m || [];
  const precs: number[] = payload?.precipitation || [];
  const gusts: number[] = payload?.wind_gusts_10m || [];
  const times: string[] = payload?.time || [];
  const offsetSec = Number(payload?.utc_offset_seconds || 0);

  let startIdx = 0;
  if (nowMs && times.length) {
    for (let i = 0; i < times.length; i++) {
      // Open-Meteo-Zeit ist lokal ohne Zonen-Suffix → als UTC parsen, dann Offset abziehen = echte UTC.
      const localAsUtc = Date.parse(times[i] + ":00Z");
      if (isNaN(localAsUtc)) continue;
      const actualUtc = localAsUtc - offsetSec * 1000;
      if (actualUtc >= nowMs - 60 * 60 * 1000) { startIdx = i; break; } // -1h Toleranz: aktuelle Stunde mitnehmen
    }
  }

  const end = Math.min(startIdx + Math.max(1, leadHours), temps.length);
  let minT = Infinity, minRel = -1, maxT = -Infinity, maxPrec = 0, maxGust = 0;
  for (let i = startIdx; i < end; i++) {
    const t = temps[i];
    if (typeof t === "number") {
      if (t < minT) { minT = t; minRel = i - startIdx; }
      if (t > maxT) maxT = t;
    }
    if (typeof precs[i] === "number" && precs[i] > maxPrec) maxPrec = precs[i];
    if (typeof gusts[i] === "number" && gusts[i] > maxGust) maxGust = gusts[i];
  }
  return {
    minTempC: minT === Infinity ? null : minT,
    minIdx: minRel,            // v30.36: Stunden-ab-JETZT (für "in ca. Xh")
    maxTempC: maxT === -Infinity ? null : maxT,
    maxPrecip: maxPrec,
    maxGust: maxGust
  };
}

function buildAlerts(m: any, leadHours: number, sub: any) {
  const out: any[] = [];
  // FROST
  if (sub.notify_frost && m.minTempC !== null && m.minTempC <= 2) {
    const sev = m.minTempC <= -3 ? "critical" : "warning";
    out.push({
      type: "frost", category: "frost", severity: sev,
      title: `🥶 Frostgefahr in den nächsten ${leadHours}h`,
      body: `Min. ${m.minTempC.toFixed(1)}°C${m.minIdx >= 0 ? ` (in ca. ${m.minIdx}h)` : ""} — kälteempfindliche Pflanzen schützen!`,
      min_temp_c: m.minTempC, max_temp_c: null,
      metric: { minIdx: m.minIdx }
    });
  }
  // HITZE
  if (sub.notify_heat && m.maxTempC !== null && m.maxTempC >= 30) {
    const sev = m.maxTempC >= 34 ? "critical" : "warning";
    out.push({
      type: "heat", category: "heat", severity: sev,
      title: `🥵 Hitze bis ${m.maxTempC.toFixed(0)}°C erwartet`,
      body: `In den nächsten ${leadHours}h bis ${m.maxTempC.toFixed(0)}°C — morgens/abends giessen, Topfpflanzen schattieren.`,
      min_temp_c: null, max_temp_c: m.maxTempC,
      metric: {}
    });
  }
  // STURM / STARKREGEN
  if (sub.notify_storm && (m.maxGust >= 60 || m.maxPrecip >= 12)) {
    const sev = (m.maxGust >= 90 || m.maxPrecip >= 25) ? "critical" : "warning";
    const parts: string[] = [];
    if (m.maxGust >= 60) parts.push(`Böen bis ${Math.round(m.maxGust)} km/h`);
    if (m.maxPrecip >= 12) parts.push(`Starkregen bis ${m.maxPrecip.toFixed(1)} mm/h`);
    out.push({
      type: "storm", category: "storm", severity: sev,
      title: `🌪️ Sturm/Starkregen voraus`,
      body: `${parts.join(" · ")} in den nächsten ${leadHours}h — Töpfe/Rankhilfen sichern, empfindliche Pflanzen schützen.`,
      min_temp_c: null, max_temp_c: null,
      metric: { windGust: Math.round(m.maxGust), precip: Number(m.maxPrecip.toFixed(1)) }
    });
  }
  return out;
}

async function alreadySentToday(userId: string, category: string) {
  const { data } = await sb.rpc("fn_push_already_sent_today", { p_user: userId, p_category: category });
  return data === true;
}

async function hasActiveAlert(userId: string, type: string) {
  const { data } = await sb
    .from("weather_alerts")
    .select("id")
    .eq("user_id", userId)
    .eq("alert_type", type)
    .eq("dismissed", false)
    .gt("valid_until", new Date().toISOString())
    .limit(1);
  return !!(data && data.length);
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
  const hourLocal = zurichHour(); // v30.36 #5
  const leadHours = Math.max(2, Math.min(48, Number(sub.alert_lead_hours ?? 12)));
  const payload = await fetchForecast(Number(sub.gps_lat), Number(sub.gps_lng));
  if (!payload) return { skipped: "no_forecast" };
  const m = windowMetrics(payload, leadHours, Date.now()); // v30.36 #3
  const alerts = buildAlerts(m, leadHours, sub);
  if (!alerts.length) return { sent: [], inboxed: 0 };

  const validUntil = new Date(Date.now() + leadHours * 60 * 60 * 1000).toISOString();
  const quiet = inQuietHours(hourLocal, sub.quiet_start_hour ?? 22, sub.quiet_end_hour ?? 7);
  const sent: string[] = [];
  let inboxed = 0;

  for (const a of alerts) {
    // Inbox-Dedup: nur eine aktive Warnung pro Typ im laufenden Fenster
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
  return { sent, inboxed, dbg: dryRun ? { hourLocal, minIdx: m.minIdx, minTempC: m.minTempC } : undefined };
}

async function gcOldRows() {
  try {
    const cutAlerts = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("weather_alerts").delete().lt("created_at", cutAlerts);
    const cutCache = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await sb.from("weather_forecast_cache").delete().lt("fetched_at", cutCache);
  } catch (_) { /* best-effort */ }
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
    if (!okAuth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const { data: subs, error: e1 } = await sb
      .from("push_subscriptions")
      .select("*")
      .lt("push_failure_count", 5)
      .not("gps_lat", "is", null)
      .not("gps_lng", "is", null);
    if (e1) throw e1;

    let totalSent = 0, totalInboxed = 0, errors = 0;
    const details: any[] = [];
    for (const sub of (subs || [])) {
      try {
        const r = await processSubscription(sub, settings.vapid, dryRun);
        if (r.sent) totalSent += r.sent.length;
        if (r.inboxed) totalInboxed += r.inboxed;
        details.push({ user: sub.user_id.slice(0, 8), ...r });
      } catch (e: any) {
        errors++;
        details.push({ user: sub.user_id.slice(0, 8), error: String(e.message || e) });
      }
    }

    if (!dryRun) await gcOldRows();

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun, version: 2,
      total_subs: subs?.length || 0,
      pushed_count: totalSent,
      inboxed_count: totalInboxed,
      errors,
      details: dryRun ? details : details.length
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
