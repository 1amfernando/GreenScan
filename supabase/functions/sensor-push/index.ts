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
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import { cronOderService } from "../_shared/auth_vergleich.mjs";
import { loadSettings as _pushSettings, zurichHour, sendPush as _pushSenden, abosAuswaehlen, abarbeiten } from "../_shared/push_helfer.mjs";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import { KATEGORIE, FENSTER_MS, FEHLSCHLAEGE_MAX, LADE_SEITE, planen, nutzlast, protokollZeile, stummZeile, meldungenLaden } from "../_shared/sensor_push_regeln.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

// v32.75 (Audit C4): die drei Helfer kommen aus _shared/push_helfer.mjs.
const loadSettings = () => _pushSettings(sb);
const sendPush = (abo: any, n: { title: string; body: string; url: string; tag: string }, vapid: any) =>
  _pushSenden(webpush, abo, n, vapid);




Deno.serve(async (req: Request) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  try {
    const settings = await loadSettings();
    const okAuth = cronOderService(req, settings.cronSecret, SERVICE_ROLE);   // v32.72 (Audit A10): konstantzeitig, ein Modul
    if (!okAuth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const now = Date.now();
    const seit = new Date(now - FENSTER_MS).toISOString();

    // 1 · frische Inbox-Zeilen der Art sensor_alert (der Cron hat sie geschrieben).
    // v33.59 (Sicherheitspruefung 10.11.2026): `notifications` darf jede Person fuer sich
    // beschreiben — vorher die 500 AELTESTEN Zeilen, und 500 eigene verdraengten jeden echten
    // Alarm. Jetzt neueste zuerst, je Nutzer gedeckelt, Gedeckelte in der naechsten Runde aussen vor.
    const lade = async (aus: string[], vor: string | null) => {
      let q = sb.from("notifications")
        .select("id,user_id,kind,title,body,link,created_at")
        .eq("kind", KATEGORIE).gte("created_at", seit);
      if (vor) q = q.lte("created_at", vor);   // <=: Gleichstand an der Seitengrenze (meldungenLaden)
      if (aus.length) q = q.not("user_id", "in", "(" + aus.join(",") + ")");
      const { data, error } = await q.order("created_at", { ascending: false }).limit(LADE_SEITE);
      if (error) throw error;
      return data || [];
    };
    const geladen = await meldungenLaden(lade);
    const meldungen = geladen.meldungen;
    if (!meldungen.length) {
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
    // v33.59: nur bekannte Push-Dienste, je Nutzer die neuesten ABOS_JE_NUTZER
    const auswahl = abosAuswaehlen(abos || []);
    const plan = planen({ meldungen, protokoll: protokoll || [], abos: auswahl.abos, now, stunde: zurichHour() });

    // 5 · stumm protokollieren (Stille, Pause) — nicht nachholen, die Inbox hat die Zeile
    if (!dryRun) {
      for (const s of plan.stumm) await sb.from("push_send_log").insert(stummZeile(s.meldung, s.abo, s.grund));
    }

    // 6 · senden und protokollieren; 410/404 raeumt das Abonnement
    let gesendet = 0, fehlgeschlagen = 0, lauf: any = null;
    if (!dryRun) {
      lauf = await abarbeiten(plan.senden, async (s: any) => {
        const r = await sendPush(s.abo, nutzlast(s.meldung), settings.vapid);
        await sb.from("push_send_log").insert(protokollZeile(s.meldung, s.abo,
          r.ok ? { result: "sent", status: r.status } : { result: "failed", status: r.status, error: r.error }));
        if (r.ok) {
          gesendet++;
          await sb.from("push_subscriptions").update({ last_push_sent_at: new Date(now).toISOString(), push_failure_count: 0 }).eq("id", s.abo.id);
        } else {
          fehlgeschlagen++;
          if (r.status === 410 || r.status === 404) await sb.from("push_subscriptions").delete().eq("id", s.abo.id);   // v33.59: je Abo, nie je Endpunkt
          else await sb.from("push_subscriptions").update({ push_failure_count: (s.abo.push_failure_count || 0) + 1 }).eq("id", s.abo.id);
        }
      });
    }

    return new Response(JSON.stringify({
      ok: true, dry_run: dryRun, meldungen: meldungen.length,
      lade_runden: geladen.runden, lade_vollstaendig: geladen.vollstaendig, nutzer_gedeckelt: geladen.gedeckelt.length,
      abgewiesen: auswahl.abgewiesen.length, abgebrochen: lauf ? lauf.abgebrochen : false,
      geplant: plan.senden.length, gesendet, fehlgeschlagen,
      stumm: plan.stumm.length, uebersprungen: plan.uebersprungen.length,
      gruende: plan.uebersprungen.slice(0, 20).map((u) => u.grund),
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: cors });
  }
});
