// GreenScan — Daily Push (Supabase Edge Function · Deno)
//
// Zweck:
//   Wird von pg_cron oder einem externen Scheduler stuendlich aufgerufen.
//   Findet alle Subscriptions, deren send_hour der aktuellen UTC-Stunde
//   entspricht (vereinfacht — keine TZ-Berechnung) und schickt eine
//   personalisierte Smart-Push.
//
// Endpoint:
//   POST  /functions/v1/daily-push
//   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//   (Aufruf nur intern, NICHT mit User-JWT)
//
// Cron-Setup:
//   select cron.schedule('greenscan-daily-push', '0 * * * *',
//     $$ select net.http_post(
//          'https://<project>.supabase.co/functions/v1/daily-push',
//          '{}',
//          'application/json',
//          ARRAY[
//            'Authorization', 'Bearer ' || (select secret_value from vault.decrypted_secrets where name='service_role_key')
//          ]::text[]
//        ); $$);

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface SubRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  send_hour: number;
  locale: string;
}
interface MemoryRow {
  event: string;
  data: Record<string, unknown>;
  ts: string;
}

// Liefert einen kurzen, handgestrickten Smart-Tipp basierend auf
// brain_memory (letzte 7 Tage) und einfacher Saison-Heuristik.
function buildTip(memory: MemoryRow[]): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const isSpring = month >= 3 && month <= 5;
  const isSummer = month >= 6 && month <= 8;
  const isAutumn = month >= 9 && month <= 11;
  const tips: string[] = [];

  // Aus Memory: hat User in 7 Tagen >= 3 Scans gemacht? → kommentiere
  const weekAgo = Date.now() - 7 * 86400000;
  let scans = 0, gardenAdds = 0, quizCorrect = 0, quizTotal = 0;
  const cats: Record<string, number> = {};
  memory.forEach((e) => {
    const t = Date.parse(e.ts);
    if (isNaN(t) || t < weekAgo) return;
    if (e.event === "scan_added") {
      scans++;
      const c = (e.data?.category as string) || "?";
      cats[c] = (cats[c] || 0) + 1;
    } else if (e.event === "garden_plant_added") gardenAdds++;
    else if (e.event === "quiz_answered") {
      quizTotal++;
      if (e.data?.correct === true) quizCorrect++;
    }
  });
  const topCat = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0];

  if (scans >= 5) {
    tips.push(`Diese Woche ${scans} Arten gefunden — Spitzenleistung!`);
  } else if (scans > 0) {
    tips.push(`${scans} Scans diese Woche — heute weiter dranbleiben?`);
  }
  if (topCat) tips.push(`Dein Fokus: ${topCat}.`);

  if (isSpring) tips.push("🌱 Frühling: Beete vorbereiten, Frühblüher beobachten.");
  else if (isSummer) tips.push("☀️ Sommer: morgens & abends giessen, Schädlinge prüfen.");
  else if (isAutumn) tips.push("🍂 Herbst: Ernte, Mulchen, Winterquartier vorbereiten.");
  else tips.push("❄️ Winter: Werkzeuge pflegen, Saatgut sortieren, planen.");

  if (quizTotal > 0) {
    const acc = Math.round((quizCorrect / quizTotal) * 100);
    tips.push(`Quiz-Trefferquote: ${acc}%.`);
  }
  return tips.slice(0, 2).join(" ");
}

serve(async (req) => {
  if (req.method !== "POST") return jsonResp({ error: "Method Not Allowed" }, 405);

  const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") || "mailto:info@greenscan.ch";
  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!VAPID_PUB || !VAPID_PRIV) return jsonResp({ error: "VAPID nicht konfiguriert" }, 503);
  if (!SUPA_URL || !SERVICE) return jsonResp({ error: "service role missing" }, 503);

  // v24.13 SECURITY-FIX (D3 CRITICAL): Auth-Check.
  // Vorher: jeder mit URL konnte daily-push triggern → Spam/DoS.
  // Jetzt: nur Aufrufer mit Service-Role-Key (pg_cron oder Owner) erlaubt.
  // Constant-Time-Compare gegen Timing-Attacks.
  const authHeader = req.headers.get("authorization") || "";
  const expected = "Bearer " + SERVICE;
  if (authHeader.length !== expected.length) return jsonResp({ error: "unauthorized" }, 401);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return jsonResp({ error: "unauthorized" }, 401);

  const supa = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
  webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV);

  // Aktuelle UTC-Stunde — vereinfachte Heuristik. Echte TZ-Logik
  // wuerde locale parsen oder per User-Profil ergaenzen.
  const hourUTC = new Date().getUTCHours();

  const { data: subs, error } = await supa
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, send_hour, locale")
    .eq("enabled", true)
    .eq("send_hour", hourUTC);

  if (error) return jsonResp({ error: error.message }, 500);
  if (!subs || subs.length === 0) return jsonResp({ ok: true, sent: 0, hour: hourUTC });

  // Pro User Brain-Memory laden (Top 50 Events) — best effort, wir
  // toleriren leere Memory.
  const userIds = Array.from(new Set(subs.map((s: SubRow) => s.user_id)));
  const { data: mem } = await supa
    .from("brain_memory")
    .select("user_id, event, data, ts")
    .in("user_id", userIds)
    .gte("ts", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("ts", { ascending: false })
    .limit(userIds.length * 50);

  const memByUser: Record<string, MemoryRow[]> = {};
  (mem || []).forEach((row: { user_id: string; event: string; data: Record<string, unknown>; ts: string }) => {
    (memByUser[row.user_id] = memByUser[row.user_id] || []).push({ event: row.event, data: row.data, ts: row.ts });
  });

  const today = new Date().toISOString().slice(0, 10);
  const results = await Promise.all(subs.map(async (s: SubRow) => {
    const tip = buildTip(memByUser[s.user_id] || []);
    const payload = {
      title: "🌿 GreenScan Smart-Tipp",
      body: tip || "Heute ein guter Tag für die Natur.",
      tag: "gs-daily-" + today,
      renotify: false,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: "./index.html?utm_source=push" },
    };
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      await supa.from("push_subscriptions").update({ last_sent_at: new Date().toISOString(), failure_count: 0 }).eq("id", s.id);
      return { id: s.id, ok: true };
    } catch (e) {
      const errAny = e as { statusCode?: number; message?: string };
      const dead = errAny.statusCode === 404 || errAny.statusCode === 410;
      await supa.from("push_subscriptions").update({
        last_error_at: new Date().toISOString(),
        failure_count: dead ? 999 : 1,
        enabled: !dead,
      }).eq("id", s.id);
      return { id: s.id, ok: false, status: errAny.statusCode, error: errAny.message };
    }
  }));

  return jsonResp({
    ok: true,
    hour: hourUTC,
    candidates: subs.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
});
