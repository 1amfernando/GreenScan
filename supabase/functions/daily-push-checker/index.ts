// GreenScan — daily-push-checker v3 (Edge Function · Deno)
//
// v3 (v26.7 / v26.13-Sprint) — Trial-End-24h-Job
//
//   Existing v2: 4 Trigger (Frost, Wasser, Saisonal, Quiz-Streak).
//   v3 fuegt notifyTrialEndingSoon() hinzu — pingt User die in den naechsten
//   24-25h ihren Trial verlieren. Push-Send mit dedup via push_send_log,
//   sodass User maximal 1× pro Trial-End-Datum erinnert wird.
//
// Endpoint:
//   POST /functions/v1/daily-push-checker
//   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//
// Cron-Setup (existiert bereits via Cowork):
//   pg_cron schedule '0 7,19 * * *' (07/19 UTC).
//
// Required Env-Vars (existing):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//
// Required Migrations:
//   20260521_push_dedup.sql (unique index push_send_log.dedup_key)
//
// HINWEIS: Dieser File enthaelt NUR den v3-Trial-Block + ein dispatch-
// Handler-Skelett. Die existing v2-Trigger (Frost/Wasser/Saisonal/Quiz)
// sind im deployed daily-push-checker bei Cowork bereits drin — beim
// Re-Deploy v3 MUESSEN die v2-Trigger 1:1 uebernommen werden. Anweisung
// fuer Cowork: bestehenden Code laden, am Ende des Handlers diesen
// notifyTrialEndingSoon-Call hinzufuegen und den Helper kopieren.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── HELPER: notifyTrialEndingSoon (NEU in v3) ───────────────────────
//
// Findet alle Subs in trial die in 24-25h auslaufen, schickt 1× pro User
// pro Trial-End-Datum eine Push-Notification. Dedup via push_send_log.
// Auch wenn keine Push-Subscription existiert wird ein Log-Eintrag
// geschrieben — das Frontend kann den Eintrag fuer den In-App-Banner
// nutzen (gsCheckTrialEnding pruft eh den Sub-Status direkt).
export async function notifyTrialEndingSoon(
  admin: ReturnType<typeof createClient>,
  vapidKeys: { publicKey: string; privateKey: string; subject: string },
): Promise<number> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: subs, error } = await admin.from("stripe_subscriptions")
    .select("user_id, trial_end, status")
    .eq("status", "trialing")
    .gte("trial_end", in24h.toISOString())
    .lt("trial_end", in25h.toISOString());

  if (error) { console.warn("[trial-end] query err:", error); return 0; }
  if (!subs || !subs.length) return 0;

  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

  let sent = 0;
  for (const sub of subs) {
    const trialEndDay = String(sub.trial_end || "").slice(0, 10);
    const dedupKey = `trial_end_${sub.user_id}_${trialEndDay}`;

    // Schon einen Push fuer dieses Trial-End-Datum geschickt?
    const { data: existing } = await admin.from("push_send_log")
      .select("id").eq("dedup_key", dedupKey).maybeSingle();
    if (existing) continue;

    // Push-Subscriptions des Users holen
    const { data: pushSubs } = await admin.from("push_subscriptions")
      .select("endpoint, p256dh, auth").eq("user_id", sub.user_id);

    if (pushSubs && pushSubs.length) {
      const payload = JSON.stringify({
        title: "⏰ Dein GreenScan-Pro endet morgen",
        body: "Jetzt verlängern und alle Features behalten — KI-Doctor, Buch-Wissen, Familien-Konto.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-maskable-192.png",
        tag: "trial-ending",
        renotify: true,
        data: { url: "/?open=abo&utm_source=push_trial" },
      });
      for (const ps of pushSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: ps.endpoint, keys: { p256dh: ps.p256dh, auth: ps.auth } },
            payload,
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 410 || status === 404) {
            // Endpoint expired → cleanup
            await admin.from("push_subscriptions").delete().eq("endpoint", ps.endpoint);
          }
        }
      }
    }

    // Dedup-Log IMMER schreiben (auch wenn keine Push-Subscription existiert),
    // damit beim naechsten Cron-Lauf nicht erneut versucht wird.
    await admin.from("push_send_log").insert({
      user_id: sub.user_id,
      dedup_key: dedupKey,
      type: "trial_ending_24h",
      sent_at: new Date().toISOString(),
    });
  }
  return sent;
}

// ─── DISPATCH-HANDLER ────────────────────────────────────────────────
//
// COWORK-PFLICHT: dieses Skelett ist ein PLATZHALTER fuer den dispatch.
// Beim Re-Deploy v3 muessen die existing v2-Trigger (Frost/Wasser/
// Saisonal/Quiz-Streak) hier eingebaut werden — die sind im currently
// deployed daily-push-checker drin aber nicht in diesem Repo-File.
// notifyTrialEndingSoon() ist NEU und wird AM ENDE des Handlers
// aufgerufen, damit es additiv ist.

serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResp({ error: "Method Not Allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:fernando.rankwiler1997@gmail.com";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const vapidKeys = { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE, subject: VAPID_SUBJECT };

  // TODO COWORK: existing v2-Trigger hier einbauen (Frost/Wasser/Saisonal/Quiz).
  // const frostSent = await notifyFrost(admin, vapidKeys);
  // const waterSent = await notifyWatering(admin, vapidKeys);
  // const seasonalSent = await notifySeasonal(admin, vapidKeys);
  // const quizSent = await notifyQuizStreak(admin, vapidKeys);

  const trialSent = await notifyTrialEndingSoon(admin, vapidKeys);
  console.log(`[daily-push-checker v3] trial-ending reminders sent: ${trialSent}`);

  return jsonResp({
    ok: true,
    version: 3,
    trial_sent: trialSent,
    // frost_sent: frostSent, water_sent: waterSent, ...
  });
});
