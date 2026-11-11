# AUFTRAG CODE v26.7 — Trial-End-Reminder (24h-Push + In-App-Banner)

> **Wer:** Claude Code (CLI)
> **Wann:** Nach v26.6 (oder parallel falls zwei Sessions laufen)
> **Stand:** `daily-push-checker` Edge-Fn existiert, läuft via pg_cron 07/19 UTC. Erweitern um Trial-End-Logik.
> **Dauer:** 2–3h
> **Branch:** main

---

## 🎯 Ziel

Wenn User im 7-Tage-Trial ist und nur noch 24h übrig hat, bekommt er:
1. **Push-Notification** „⏰ Dein GreenScan-Pro endet morgen — jetzt Abo verlängern für volle Features"
2. **In-App-Banner** beim nächsten App-Open (subtiles gelbes Banner über der Bottom-Nav mit „Abo verlängern" CTA)

Ziel: Trial-User vor dem Auto-Charge informieren, Conversion-Pipe verbessern, Refund-Drama verhindern.

---

## 📋 Implementation

### TEIL 1 — Backend (`daily-push-checker` v3)

Edge-Fn vorhanden: `daily-push-checker` (slug, version 2). Code muss v3 deployen.

Hinzufügen: **Trial-End-24h-Job**:

```typescript
// daily-push-checker/index.ts (v3) — neue Sektion

async function notifyTrialEndingSoon(admin: any, vapidKeys: any) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  // Subs in trial mit trial_end zwischen jetzt+24h und jetzt+25h
  const { data: subs } = await admin.from("stripe_subscriptions")
    .select("user_id, trial_end, status")
    .eq("status", "trialing")
    .gte("trial_end", in24h.toISOString())
    .lt("trial_end", in25h.toISOString());

  if (!subs || !subs.length) return 0;

  let sent = 0;
  for (const sub of subs) {
    // Hat der User bereits den Push fuer dieses Trial-End bekommen?
    const reminderKey = `trial_end_${sub.user_id}_${sub.trial_end?.slice(0, 10)}`;
    const { data: existing } = await admin.from("push_send_log")
      .select("id").eq("dedup_key", reminderKey).maybeSingle();
    if (existing) continue;

    // Push subscriptions des Users holen
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
        data: { url: "/?open=abo&utm_source=push_trial" }
      });
      for (const ps of pushSubs) {
        try {
          await webpush.sendNotification({ endpoint: ps.endpoint, keys: { p256dh: ps.p256dh, auth: ps.auth } }, payload, vapidKeys);
          sent++;
        } catch (e) {
          // Endpoint expired → cleanup
          if (e.statusCode === 410 || e.statusCode === 404) {
            await admin.from("push_subscriptions").delete().eq("endpoint", ps.endpoint);
          }
        }
      }
    }

    // Auch wenn keine Push-Subscription da war, dedup-Log fuer In-App-Banner-Trigger
    await admin.from("push_send_log").insert({
      user_id: sub.user_id,
      dedup_key: reminderKey,
      type: "trial_ending_24h",
      sent_at: new Date().toISOString(),
    });
  }
  return sent;
}

// Im Haupt-handler nach den existing reminders:
const trialSent = await notifyTrialEndingSoon(admin, vapidKeys);
console.log(`Trial-ending reminders sent: ${trialSent}`);
```

`push_send_log` Tabelle existiert (siehe `push_send_log` in DB-Inventar). Dedup-Key sicherstellen mit `unique(user_id, dedup_key)` Index (falls noch nicht vorhanden, Migration):

```sql
-- supabase/migrations/20260520_push_dedup.sql
create unique index if not exists idx_push_send_log_dedup on push_send_log(dedup_key);
```

---

### TEIL 2 — Frontend (In-App-Banner)

#### 2.1 `gsCheckTrialEnding()` beim App-Boot

Suche `_gsInitProfileOnce` oder `gsLoadSubInfo` (im Sub-Info-Code-Bereich) — nach Sub-Status-Load aufrufen.

```javascript
async function gsCheckTrialEnding() {
  try {
    const sub = await gsLoadSubInfo();
    if (!sub || sub.status !== 'trialing' || !sub.trial_end) return;
    const trialEndTs = new Date(sub.trial_end).getTime();
    const now = Date.now();
    const hoursLeft = (trialEndTs - now) / 3600000;
    if (hoursLeft > 0 && hoursLeft < 36) {
      // Banner zeigen wenn noch nicht in dieser Session gesehen
      const key = 'gs_trial_banner_seen_' + sub.trial_end.slice(0, 10);
      if (sessionStorage.getItem(key)) return;
      gsShowTrialEndingBanner(hoursLeft);
      sessionStorage.setItem(key, '1');
    }
  } catch(_){}
}

function gsShowTrialEndingBanner(hoursLeft) {
  if (document.getElementById('gs-trial-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'gs-trial-banner';
  const hoursText = hoursLeft < 24 ? `${Math.round(hoursLeft)}h` : '24h';
  banner.style.cssText = 'position:fixed;left:14px;right:14px;bottom:calc(var(--tab-h) + var(--sb) + 12px);background:linear-gradient(135deg,#f57f17,#ff9800);color:#fff;padding:13px 16px;border-radius:14px;box-shadow:0 4px 18px rgba(245,127,23,.4);z-index:var(--z-overlay);display:flex;gap:12px;align-items:center;font-family:inherit;';
  banner.innerHTML = `
    <div style="font-size:24px;flex-shrink:0;">⏰</div>
    <div style="flex:1;font-size:12.5px;line-height:1.4;">
      <div style="font-weight:800;margin-bottom:2px;">Dein Trial endet in ${hoursText}</div>
      <div style="font-size:11px;opacity:.95;">Jetzt verlängern und alle Pro-Features behalten.</div>
    </div>
    <button onclick="gsShowAboScreen();document.getElementById('gs-trial-banner').remove()"
            style="background:#fff;color:#e65100;border:none;border-radius:10px;padding:8px 12px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;flex-shrink:0;">
      Verlängern
    </button>
    <button onclick="document.getElementById('gs-trial-banner').remove()"
            style="background:transparent;color:#fff;border:none;font-size:18px;cursor:pointer;padding:0 4px;flex-shrink:0;" aria-label="Schliessen">×</button>
  `;
  document.body.appendChild(banner);
  // Auto-hide nach 12s wenn nicht interagiert
  setTimeout(()=> { try { banner.remove(); } catch(_){} }, 12000);
}

// Im Boot-Code (nach gsLoadSubInfo Erstaufruf):
setTimeout(gsCheckTrialEnding, 4500);
```

#### 2.2 URL-Param-Handler `?open=abo` (für Push-Klick)

Beim Boot prüfen ob `?open=abo` und falls ja `gsShowAboScreen()` aufrufen.

---

### TEIL 3 — Verify

```bash
# 1. Edge-Fn v3 deployed
supabase functions list | grep daily-push-checker
# erwartet: version 3

# 2. Frontend reachable
grep -nE "gsCheckTrialEnding|gsShowTrialEndingBanner" index.html
# erwartet: 4+ Treffer

# 3. Smoke-Test mit Fernandos Sub
# Sub sub_1TXf48JnN3SSU2QNE6bvBOQ9 hat trial_end 2026-05-23
# Manuell triggern:
curl -X POST 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/daily-push-checker' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY'
# erwartet: HTTP 200, response.trial_sent >= 0
```

---

## 📦 Versions-Disziplin

```
[ ] index.html: GS_VERSION = 'v26.7'
[ ] index.html: <meta app-version 26.7.20260521>
[ ] sw.js: VERSION = 'gs-v26.7' + Top-Comment
[ ] _headers: v26.7
[ ] GS_RELEASES Eintrag mit user_summary
[ ] 7/7 inline-scripts node --check OK
[ ] daily-push-checker v3 deployed
[ ] Migration 20260520_push_dedup.sql
```

---

## ⚠️ Wichtige Constraints

1. **VAPID-Keys müssen im Edge-Fn ENV stehen** (VAPID_PUBLIC, VAPID_PRIVATE) — sind das schon. Falls nicht: in app_settings nachschauen.
2. **push_subscriptions Endpoints können expiren** — der 410/404 cleanup ist Pflicht, sonst wachsen Tote-Endpoints unbegrenzt.
3. **In-App-Banner darf nicht spammen** — sessionStorage-Guard verhindert Mehrfach-Show pro Tagesfenster.

---

**Estimated Time:** 2-3h · Trigger erst sichtbar wenn ein User im 24h-Fenster ist (Fernandos Sub läuft 2026-05-23 aus = Banner sichtbar ab 2026-05-22 19:00 lokal).
