# AUFTRAG CODE v26.6 — Marketplace-Connect-Frontend

> **Wer:** Claude Code (CLI)
> **Wann:** Sofort, parallel zu Cowork (Cowork macht v26.4/v26.5)
> **Stand:** v26.4 ist live (siehe INSTALL_v26.4.command). Backend-Edge-Fns wartet noch.
> **Dauer:** 4–6h fokussiert
> **Branch:** direkt auf `main` (kein PR-Branch — wir sind Solo-Repo)

---

## 🎯 Ziel

GreenScan-User koennen sich als Marketplace-Verkäufer registrieren und Stripe-Konto verbinden, damit sie eigene Listings (Pflanzen, Samen, Werkzeug, Imker-Beratung) verkaufen können. Stripe-Geld geht via Stripe Connect direkt an den Verkäufer, GreenScan bekommt 5% Platform-Fee.

**Backend-Status:**
- Cowork hat `stripe-restructure-pro-only` und `stripe-final-audit` live.
- `marketplace_listings` Tabelle existiert (siehe `120_DB_INVENTAR.md`).
- **FEHLT:** `stripe-create-connect-account` Edge-Function + `marketplace_sellers` Schema.

→ **Code soll BEIDES bauen.** Backend zuerst (1h), dann Frontend (3h), dann Verify (1h).

---

## 📋 Sprint-Plan

### TEIL 1 — Backend (Cowork-Pflicht laut Roadmap, aber Code kann es übernehmen)

#### 1.1 Schema `marketplace_sellers` (Migration)

```sql
-- supabase/migrations/20260520_marketplace_sellers.sql
create table public.marketplace_sellers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text unique,
  status text not null default 'pending' check (status in ('pending','active','restricted','disabled')),
  charges_enabled boolean default false,
  payouts_enabled boolean default false,
  details_submitted boolean default false,
  requirements jsonb default '{}',
  country text default 'CH',
  default_currency text default 'chf',
  business_type text,        -- individual | company
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.marketplace_sellers enable row level security;

-- User darf nur eigenen Eintrag lesen + schreiben
create policy "own_marketplace_seller_select" on public.marketplace_sellers
  for select using (auth.uid() = user_id);
create policy "own_marketplace_seller_insert" on public.marketplace_sellers
  for insert with check (auth.uid() = user_id);
create policy "own_marketplace_seller_update" on public.marketplace_sellers
  for update using (auth.uid() = user_id);

-- Index fuer Webhook-Lookups
create index idx_marketplace_sellers_stripe ON public.marketplace_sellers(stripe_account_id);

-- View fuer Frontend (joins profiles.display_name)
create or replace view public.v_my_marketplace_seller as
  select s.*, p.display_name as profile_name, p.email
  from marketplace_sellers s
  left join profiles p on p.id = s.user_id
  where s.user_id = auth.uid();
```

Deploy via `mcp__supabase__apply_migration` ODER `mcp__supabase__execute_sql`.

#### 1.2 Edge-Function `stripe-create-connect-account` (NEU)

```typescript
// supabase/functions/stripe-create-connect-account/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@18?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!; // sk_test_* oder sk_live_*
const stripe = new Stripe(STRIPE_KEY, { httpClient: Stripe.createFetchHttpClient() });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !user) return new Response("Unauthorized", { status: 401 });

  try {
    // Check ob bereits Account existiert
    const { data: existing } = await supabase.from("marketplace_sellers")
      .select("stripe_account_id").eq("user_id", user.id).maybeSingle();

    let accountId = existing?.stripe_account_id;
    if (!accountId) {
      // Account erstellen (Express-Onboarding)
      const account = await stripe.accounts.create({
        type: "express",
        country: "CH",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { gs_user_id: user.id },
      });
      accountId = account.id;
      await supabase.from("marketplace_sellers").upsert({
        user_id: user.id,
        stripe_account_id: accountId,
        country: "CH",
        default_currency: "chf",
      });
    }

    // Onboarding-Link erzeugen (express dashboard, 60min TTL)
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${req.headers.get("origin") || "https://green-scan.ch"}/?marketplace_refresh=1`,
      return_url:  `${req.headers.get("origin") || "https://green-scan.ch"}/?marketplace_done=1`,
      type: "account_onboarding",
    });

    return Response.json({ ok: true, account_id: accountId, onboarding_url: link.url });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { "Content-Type":"application/json" } });
  }
});
```

Deploy via `mcp__supabase__deploy_edge_function`. `verify_jwt: true`.

#### 1.3 `stripe-webhook` ergänzen für `account.updated`-Event

Edge-Fn `stripe-webhook` v9: zusätzlich `account.updated` handlen — bei `charges_enabled=true && payouts_enabled=true && details_submitted=true` → marketplace_sellers.status='active'. Sonst Sub-Status entsprechend.

---

### TEIL 2 — Frontend (index.html)

#### 2.1 Settings → „Als Verkaeufer registrieren" Karte

Im Settings-Modal (suche `gsBuildSettingsScreen`, Zeile ~?? — finde via `grep -n "gsBuildSettingsScreen" index.html`) eine neue Karte einfuegen NACH der „KI-API-Key" Sektion:

```html
<div class="settings-section">
  <div class="settings-section-title">💼 Verkäufer-Konto</div>
  <div class="settings-row" id="gs-marketplace-seller-row" onclick="gsMarketplaceOpenSellerScreen()" style="cursor:pointer">
    <div class="settings-row-icon">🏪</div>
    <div class="settings-row-content">
      <div class="settings-row-title" id="gs-marketplace-seller-title">Verkäufer-Konto verbinden</div>
      <div class="settings-row-sub" id="gs-marketplace-seller-sub">Eigene Pflanzen, Samen oder Werkzeug verkaufen — Bezahlung läuft sicher über Stripe.</div>
    </div>
    <div class="settings-row-action">→</div>
  </div>
</div>
```

#### 2.2 Funktionen `gsMarketplaceOpenSellerScreen` + `gsMarketplaceStartConnect` + `gsMarketplaceLoadStatus`

```javascript
// Suche eine sinnvolle Stelle nach gsShowAboScreen oder gsRenderSubInfo
async function gsMarketplaceLoadStatus() {
  if (!gsAuth || !gsAuth.user) return null;
  try {
    const r = await sbFetch('/rest/v1/v_my_marketplace_seller?select=*');
    return r.data && r.data[0] ? r.data[0] : null;
  } catch (e) { return null; }
}

async function gsMarketplaceOpenSellerScreen() {
  if (!gsAuth || !gsAuth.user) {
    if (typeof _gsAuthPrompt === 'function') _gsAuthPrompt();
    return;
  }
  const s = await gsMarketplaceLoadStatus();
  const mc = document.getElementById('modal-content');
  if (!mc) return;
  // Render je nach Status
  let body = '';
  if (!s || s.status === 'pending') {
    body = `
      <div style="padding:20px;">
        <div style="text-align:center;font-size:48px;margin-bottom:12px;">🏪</div>
        <h2 style="font-family:'Playfair Display',serif;text-align:center;margin:0 0 8px;">Werde Verkäufer</h2>
        <p style="font-size:13px;color:var(--muted);line-height:1.55;text-align:center;margin:0 0 18px;">
          Verkaufe eigene Pflanzen, Samen, Werkzeug oder Imker-Beratung an die GreenScan-Community.
          Zahlung läuft sicher über Stripe — Geld geht direkt an dich.
        </p>
        <ul style="font-size:12.5px;color:var(--text2);line-height:1.7;margin:0 0 16px;padding-left:18px;">
          <li>✓ Pro Verkauf 5% GreenScan-Gebühr</li>
          <li>✓ TWINT, Karte, Kontoüberweisung — alles unterstützt</li>
          <li>✓ Vereinfachte Schweizer Steuer-Reports via Stripe-Dashboard</li>
          <li>✓ Geld auf dein Bankkonto in 2-7 Tagen</li>
        </ul>
        <button onclick="gsMarketplaceStartConnect()"
                style="width:100%;padding:14px;background:linear-gradient(135deg,#1b5e20,#2e7d32);color:#fff;border:none;border-radius:14px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">
          🔐 Mit Stripe verbinden
        </button>
        <div style="font-size:10.5px;color:var(--muted);text-align:center;margin-top:12px;">Du verlässt GreenScan kurz für die Stripe-Registrierung. Dauer: 3-5 Minuten.</div>
      </div>
    `;
  } else if (s.status === 'active') {
    body = `
      <div style="padding:20px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">✅</div>
        <h2 style="margin:0;color:var(--g-main);">Verkäufer-Konto aktiv</h2>
        <p style="font-size:13px;color:var(--muted);margin:10px 0 16px;">Du kannst jetzt Listings im Marktplatz veröffentlichen.</p>
        <button onclick="gsMarketplaceOpenStripeDashboard()" style="width:100%;padding:12px;background:var(--g-main);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">📊 Stripe-Dashboard öffnen</button>
        <button onclick="gsMarketplaceCreateListing()" style="width:100%;padding:12px;margin-top:8px;background:var(--card);color:var(--text);border:1.5px solid var(--g-main);border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">➕ Neues Listing erstellen</button>
      </div>
    `;
  } else if (s.status === 'restricted') {
    body = `
      <div style="padding:20px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">⚠️</div>
        <h2 style="margin:0;color:#e65100;">Verkäufer-Konto eingeschränkt</h2>
        <p style="font-size:13px;color:var(--muted);margin:10px 0 16px;">Stripe benötigt weitere Angaben (Ausweis, Bankkonto oder Steuer-ID).</p>
        <button onclick="gsMarketplaceStartConnect()" style="width:100%;padding:14px;background:#e65100;color:#fff;border:none;border-radius:14px;font-weight:800;cursor:pointer;font-family:inherit;">→ Angaben vervollständigen</button>
      </div>
    `;
  }
  mc.innerHTML = body;
  openModal('detail-modal');
}

async function gsMarketplaceStartConnect() {
  try {
    if (typeof gsToast === 'function') gsToast('🔐 Stripe-Onboarding wird geöffnet…', 'info', 2500);
    const r = await sbFetch('/functions/v1/stripe-create-connect-account', { method:'POST' });
    if (r.data && r.data.onboarding_url) {
      window.location.href = r.data.onboarding_url;
    } else {
      if (typeof gsToast === 'function') gsToast('❌ Fehler bei Stripe-Verbindung', 'error');
    }
  } catch (e) {
    console.error(e);
    if (typeof gsToast === 'function') gsToast('❌ Verbindung zu Stripe fehlgeschlagen', 'error');
  }
}
```

#### 2.3 URL-Param-Handler `?marketplace_done=1` und `?marketplace_refresh=1`

Im Boot-Code (suche `URLSearchParams` / `window.location.search`) — beim done=1 toast „✅ Verkäufer-Konto verbunden" + auto-open seller screen.

#### 2.4 Settings-Row dynamisch updaten

Beim Settings-Open: `gsMarketplaceLoadStatus()` → wenn aktiv: Title „Verkäufer-Konto: Aktiv ✅", sub „Listings veröffentlichen". Sonst Default.

---

### TEIL 3 — Verify

```bash
# 1. Migration durch?
psql -c "SELECT * FROM marketplace_sellers LIMIT 1"
# erwartet: leere Tabelle, kein Error

# 2. Edge-Function deployed?
supabase functions list | grep stripe-create-connect-account
# erwartet: ACTIVE

# 3. Frontend reachable?
grep -nE "gsMarketplaceOpenSellerScreen|gsMarketplaceStartConnect|stripe-create-connect-account" index.html
# erwartet: 4+ Treffer

# 4. Smoke-Test im Browser (test-mode):
#   - Settings → Verkäufer-Konto → klick
#   - „Mit Stripe verbinden"
#   - Stripe-Test-Onboarding durchklicken (test-mode SSN: 000-00-0000, etc.)
#   - Return URL feuert ?marketplace_done=1
#   - Toast „Verkäufer-Konto verbunden"
#   - DB: marketplace_sellers.user_id = current user, status='active'
```

---

## 📦 Versions-Disziplin

```
[ ] index.html: GS_VERSION = 'v26.6'
[ ] index.html: <meta name="app-version" content="26.6.20260521">
[ ] sw.js: VERSION = 'gs-v26.6' + Top-Comment "Marketplace-Connect"
[ ] _headers: v26.6
[ ] GS_RELEASES Top-Eintrag mit user_summary + items
[ ] 7/7 Inline-Scripts node --check OK
[ ] Migration in supabase/migrations/20260520_marketplace_sellers.sql
[ ] Edge-Fn-Code in supabase/functions/stripe-create-connect-account/index.ts
```

---

## ⚠️ Wichtige Constraints

1. **Stripe Connect NICHT im Dashboard aktiviert** → Fernando muss das im Stripe-UI tun BEVOR Test funktioniert. Falls noch nicht aktiv: das Edge-Fn-Call wirft `account_invalid` Error. Anleitung: https://dashboard.stripe.com/settings/connect (Tab „Connect onboarding").
2. **Test-Mode hat begrenzte CH-Country-Support** → falls Express-Onboarding 400 zurueckgibt, auf `type: "standard"` fallen.
3. **Keine Sensitive-Data** im Frontend speichern — alles geht via Edge-Fn mit Service-Role-Key.

---

**Estimated Time:** 4-6h für Code mit allen Schritten · Live-deployment ~10 Min nach Push.
