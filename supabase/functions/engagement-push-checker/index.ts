// engagement-push-checker v2 (v30.39) — Klassen- / Doktor-Follow-up- / Battle-Pushes (alle FREE).
// Dünn: lädt VAPID, loopt push_subscriptions, ruft Detektions-RPCs (fn_eng_*), sendet via web-push.
// v30.39 (Audit-Welle 3 #5): Quiet-Hours gegen Europe/Zurich statt UTC (zurichHour via Intl, DST-sicher).
//   Cron alle 3h (0 7,10,13,16,19 UTC) → bei Default-Ruhefenster 22-7 unkritisch, aber für eigene Fenster korrekt.
// Tages-Dedup pro Kategorie. dry_run=1 zum Testen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

async function loadSettings() {
  const { data, error } = await sb.from("app_settings").select("key,value")
    .in("key", ["vapid_public_key","vapid_private_key","vapid_subject","push_cron_secret"]);
  if (error) throw new Error("settings: " + error.message);
  const m: Record<string,string> = {};
  for (const r of data || []) m[r.key] = r.value;
  if (!m.vapid_public_key || !m.vapid_private_key) throw new Error("VAPID fehlt");
  return { vapid: { publicKey: m.vapid_public_key, privateKey: m.vapid_private_key, subject: m.vapid_subject || "mailto:fernando.rankwiler1997@gmail.com" }, cronSecret: m.push_cron_secret || null };
}
function inQuietHours(h: number, qs: number, qe: number) { if (qs===qe) return false; return qs<qe ? (h>=qs && h<qe) : (h>=qs || h<qe); }
// v30.39 #5: aktuelle Stunde in Europe/Zurich (DST-sicher), Fallback UTC.
function zurichHour(): number {
  try { return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Zurich" }).format(new Date())) % 24; }
  catch (_) { return new Date().getUTCHours(); }
}
async function alreadySent(userId: string, cat: string) { const { data } = await sb.rpc("fn_push_already_sent_today", { p_user: userId, p_category: cat }); return data === true; }
async function logSend(userId: string, cat: string, title: string, body: string, payload: any, result: string, httpStatus?: number, errorMsg?: string) {
  await sb.from("push_send_log").insert({ user_id: userId, category: cat, title, body, payload_meta: payload, result, http_status: httpStatus, error_msg: errorMsg });
}
async function sendPush(sub: any, title: string, body: string, url: string, vapid: any, tag?: string) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } };
    const payload = JSON.stringify({ title, body, url, icon: "https://green-scan.ch/icons/icon-192.png", badge: "https://green-scan.ch/icons/icon-96.png", tag: tag || ("gs-"+Date.now()), data: { url } });
    const res = await webpush.sendNotification(pushSub, payload, { TTL: 3600 });
    return { ok: true, status: res.statusCode };
  } catch (e: any) { return { ok: false, status: e?.statusCode, error: String(e?.message || e) }; }
}
async function deleteIfGone(sub: any, status?: number) { if (status===410||status===404) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); }

async function processSub(sub: any, vapid: any, dryRun: boolean) {
  const userId = sub.user_id as string;
  const hourLocal = zurichHour(); // v30.39 #5
  if (inQuietHours(hourLocal, sub.quiet_start_hour ?? 22, sub.quiet_end_hour ?? 7)) return { suppressed: true };
  const sent: string[] = [];

  // 1) Doktor-Follow-up (7-Tage-Nachkontrolle fällig)
  if (sub.notify_doctor !== false && !(await alreadySent(userId, "doctor_followup"))) {
    const { data: due } = await sb.rpc("fn_eng_doctor_due", { p_user: userId });
    if (due === true) {
      const title = "🩺 Wie geht's deiner Pflanze?";
      const body = "Eine Doktor-Nachkontrolle ist fällig — schau, ob die Behandlung wirkt.";
      if (dryRun) sent.push("doctor_followup(dry)");
      else { const r = await sendPush(sub, title, body, "/?screen=garden", vapid, "gs-doctor_followup"); await logSend(userId,"doctor_followup",title,body,{},r.ok?"sent":"failed",r.status,r.error); if(r.ok) sent.push("doctor_followup"); else await deleteIfGone(sub,r.status); }
    }
  }
  // 2) Neue Klassen-Aufgabe (Schüler)
  if (sub.notify_classes !== false && !(await alreadySent(userId, "class_new"))) {
    const { data: n } = await sb.rpc("fn_eng_class_new", { p_user: userId, p_hours: 24 });
    if ((n||0) > 0) {
      const title = n>1 ? `🎓 ${n} neue Aufgaben in deiner Klasse` : "🎓 Neue Aufgabe in deiner Klasse";
      const body = "Deine Lehrkraft hat eine neue Aufgabe gestellt — leg los!";
      if (dryRun) sent.push("class_new(dry)");
      else { const r = await sendPush(sub, title, body, "/?screen=settings", vapid, "gs-class_new"); await logSend(userId,"class_new",title,body,{count:n},r.ok?"sent":"failed",r.status,r.error); if(r.ok) sent.push("class_new"); else await deleteIfGone(sub,r.status); }
    }
  }
  // 3) Neue Einreichungen (Lehrkraft)
  if (sub.notify_classes !== false && !(await alreadySent(userId, "class_submissions"))) {
    const { data: n } = await sb.rpc("fn_eng_class_submissions", { p_user: userId, p_hours: 24 });
    if ((n||0) > 0) {
      const title = `🧑‍🏫 ${n} neue Einreichung${n>1?"en":""}`;
      const body = "Schüler:innen haben Aufgaben erledigt — bereit zum Anschauen.";
      if (dryRun) sent.push("class_submissions(dry)");
      else { const r = await sendPush(sub, title, body, "/?screen=settings", vapid, "gs-class_submissions"); await logSend(userId,"class_submissions",title,body,{count:n},r.ok?"sent":"failed",r.status,r.error); if(r.ok) sent.push("class_submissions"); else await deleteIfGone(sub,r.status); }
    }
  }
  // 4) Battle: Gegner hat geantwortet
  if (sub.notify_battle !== false && !(await alreadySent(userId, "battle_reply"))) {
    const { data: n } = await sb.rpc("fn_eng_battle_waiting", { p_user: userId, p_hours: 24 });
    if ((n||0) > 0) {
      const title = "⚔️ Dein Gegner hat geantwortet";
      const body = n>1 ? `${n} Quiz-Duelle sind ausgewertet — schau dir die Ergebnisse an!` : "Dein Quiz-Duell ist ausgewertet — wer hat gewonnen?";
      if (dryRun) sent.push("battle_reply(dry)");
      else { const r = await sendPush(sub, title, body, "/?screen=wissen", vapid, "gs-battle_reply"); await logSend(userId,"battle_reply",title,body,{count:n},r.ok?"sent":"failed",r.status,r.error); if(r.ok) sent.push("battle_reply"); else await deleteIfGone(sub,r.status); }
    }
  }

  if (sent.length && !dryRun) await sb.from("push_subscriptions").update({ last_push_sent_at: new Date().toISOString(), push_failure_count: 0 }).eq("id", sub.id);
  return { suppressed: false, sent };
}

Deno.serve(async (req: Request) => {
  const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-cron-secret, content-type", "Content-Type":"application/json" };
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run")==="1";
  try {
    const settings = await loadSettings();
    const cronSecret = req.headers.get("x-cron-secret");
    const authHdr = req.headers.get("authorization") || "";
    const okAuth = (settings.cronSecret && cronSecret===settings.cronSecret) || authHdr.includes(SERVICE_ROLE);
    if (!okAuth) return new Response(JSON.stringify({error:"unauthorized"}),{status:401,headers:cors});
    const { data: subs, error } = await sb.from("push_subscriptions").select("*").lt("push_failure_count",5);
    if (error) throw error;
    let totalSent=0, suppressed=0, errors=0; const details:any[]=[];
    for (const sub of (subs||[])) {
      try { const r = await processSub(sub, settings.vapid, dryRun); if (r.suppressed) suppressed++; if (r.sent) totalSent += r.sent.length; details.push({ user: String(sub.user_id).slice(0,8), ...r }); }
      catch(e:any){ errors++; details.push({ user:String(sub.user_id).slice(0,8), error:String(e.message||e) }); }
    }
    return new Response(JSON.stringify({ ok:true, dry_run:dryRun, version:2, total_subs: subs?.length||0, pushed_count: totalSent, suppressed_count: suppressed, errors, details: dryRun?details:details.length }),{headers:cors});
  } catch(e:any){ return new Response(JSON.stringify({error:String(e.message||e)}),{status:500,headers:cors}); }
});
