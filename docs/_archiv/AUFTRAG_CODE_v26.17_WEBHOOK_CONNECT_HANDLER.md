# AUFTRAG v26.17 — Stripe-Webhook v9: account.updated → marketplace_sellers sync

**Owner:** Claude Code (Backend) — wartet auf Code-Session, läuft autonom.
**Priorität:** P1 (blockt Marketplace-Live).
**Erwartete Dauer:** ~20 Min (1 Edge-Fn-Bump + Smoke-Test).
**Vorbedingung:** Stripe-Dashboard hat Connect aktiviert. Falls nicht: warten bis Fernando das geklickt hat (https://dashboard.stripe.com/settings/connect).

---

## Was fehlt

Cowork hat v26.6 Marketplace-Connect spezifiziert + Migration `marketplace_sellers` ist applied (deployed via Code commit `36b09be`). Code hat die `stripe-create-connect-account` v1 Edge-Fn live deployt — Verkäufer können sich onboarden.

**Problem:** Stripe sendet `account.updated`-Events während/nach dem Onboarding (Identity-Verify, Bank-Connect, Payouts-Aktivierung). Der bestehende `stripe-webhook` v7 (`/repo-clone/supabase/functions/stripe-webhook/index.ts`) handlet diese Events nicht → die App weiß nie wann ein Verkäufer „bereit" ist.

**Konsequenz ohne v9:**
- `marketplace_sellers.status` bleibt für immer `'pending'`.
- `charges_enabled`/`payouts_enabled` werden nie auf `true` gesetzt.
- `gsMarketplaceCanSell()` (Frontend, v26.12) liefert immer `false` → User können nichts inserieren obwohl Stripe sie längst durchgewunken hat.

---

## Auftrag

### 1. Stripe-Dashboard: Webhook-Endpoint um `account.updated` erweitern

Cowork erledigt das selbst, sobald Stripe MCP wieder Schreib-Zugriff hat. Falls Code es schneller via MCP machen kann:

```js
// mcp__stripe__webhookEndpoints.update(<endpoint_id>, {
//   enabled_events: [ …bestehende…, 'account.updated', 'account.application.deauthorized' ]
// })
```

Aktuelle Events auflisten:
```js
mcp__stripe__webhookEndpoints.list()  // green-scan.ch endpoint finden
```

Hinzufügen (falls noch nicht in Liste):
- `account.updated`
- `account.application.deauthorized` (User trennt Connect → status='disabled')

### 2. Edge-Fn `stripe-webhook` v9 — neuer Handler

Datei: `supabase/functions/stripe-webhook/index.ts`

**Neuer Handler-Block** nach dem `case "invoice.payment_failed"`-Block:

```ts
case "account.updated": {
  const account = event.data.object as Stripe.Account;
  // Pre-Check: existiert ein marketplace_sellers-Eintrag für diesen account?
  const { data: existing } = await admin
    .from("marketplace_sellers")
    .select("user_id, status")
    .eq("stripe_account_id", account.id)
    .maybeSingle();

  if (!existing) {
    // Account ist Stripe-seitig erstellt aber kein DB-Eintrag — log + skip.
    console.warn(`[webhook] account.updated for unknown stripe_account_id=${account.id}`);
    break;
  }

  // Status-Logik:
  // - charges_enabled && payouts_enabled && details_submitted → 'active'
  // - currently_due.length > 0 oder disabled_reason !== null → 'restricted'
  // - disabled_reason includes 'rejected' → 'disabled'
  // - sonst (z.B. erst halb durch Onboarding) → 'pending'
  let newStatus: string = "pending";
  const requirements = account.requirements ?? {};
  const disabledReason = (requirements as any).disabled_reason as string | null;

  if (account.charges_enabled && account.payouts_enabled && account.details_submitted) {
    newStatus = "active";
  } else if (disabledReason && disabledReason.startsWith("rejected")) {
    newStatus = "disabled";
  } else if ((requirements.currently_due?.length ?? 0) > 0 || disabledReason) {
    newStatus = "restricted";
  }

  await admin.from("marketplace_sellers").update({
    status: newStatus,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    business_type: account.business_type ?? null,
    requirements: requirements as any,
    updated_at: new Date().toISOString(),
  }).eq("stripe_account_id", account.id);

  console.log(`[webhook] account.updated ${account.id} → status=${newStatus} charges=${account.charges_enabled} payouts=${account.payouts_enabled}`);
  break;
}

case "account.application.deauthorized": {
  // Stripe-Account wurde vom User getrennt (oder von Stripe deauthorisiert).
  // application.id = unsere Stripe-Account-ID? Nein — bei deauth ist event.account die ID.
  const acctId = (event as any).account as string | null;
  if (acctId) {
    await admin.from("marketplace_sellers").update({
      status: "disabled",
      charges_enabled: false,
      payouts_enabled: false,
      updated_at: new Date().toISOString(),
    }).eq("stripe_account_id", acctId);
    console.log(`[webhook] account.application.deauthorized ${acctId} → disabled`);
  }
  break;
}
```

**Header-Kommentar oben in der Datei updaten:**
```ts
// v9 (2026-05-22): account.updated → marketplace_sellers.status/charges_enabled/payouts_enabled syncen.
//                  account.application.deauthorized → status='disabled'.
//                  Erweitert v7 expert_verifications-Handling. Cowork-Auftrag v26.17.
```

### 3. Deploy via Supabase MCP

```js
mcp__supabase__deploy_edge_function({
  project_id: "vowbiueikwrauuceilhc",
  name: "stripe-webhook",
  files: [{ name: "index.ts", content: "<gesamter neuer Inhalt>" }],
  // verify_jwt: false (Stripe ruft direkt auf, keine User-JWT)
})
```

### 4. Smoke-Test

#### Variante A — synthetisch via Stripe-MCP

```js
// 1. Test-Eintrag in marketplace_sellers schaffen
mcp__supabase__execute_sql({
  project_id: "vowbiueikwrauuceilhc",
  query: `insert into marketplace_sellers (user_id, stripe_account_id, status)
          values ('<deine_test_user_uuid>', 'acct_test_webhook_v9', 'pending')
          on conflict (user_id) do update set stripe_account_id = excluded.stripe_account_id, status='pending';`
})

// 2. Stripe-Account synthetisch erstellen (Test-Mode)
mcp__stripe__accounts.create({ type: 'express', country: 'CH', email: 'test+v9@green-scan.ch', capabilities: { card_payments: { requested: true }, transfers: { requested: true } } })
// → returnt acct_xxx

// 3. UPDATE in marketplace_sellers auf diese echte ID
mcp__supabase__execute_sql({ project_id: "vowbiueikwrauuceilhc", query: `update marketplace_sellers set stripe_account_id='acct_xxx' where user_id='<uuid>';` })

// 4. AccountLink schaffen + manuell mit Test-Daten ausfüllen (Stripe Express Test-Mode lässt Bypass zu)
// 5. Nach „Submit" → Stripe sendet account.updated → Webhook empfängt → DB sollte updated sein

// 6. Verify
mcp__supabase__execute_sql({
  project_id: "vowbiueikwrauuceilhc",
  query: `select stripe_account_id, status, charges_enabled, payouts_enabled, details_submitted, updated_at
          from marketplace_sellers where stripe_account_id='acct_xxx';`
})
// Erwartet: status='active', charges_enabled=true, payouts_enabled=true (nach Test-Onboarding)
```

#### Variante B — passiv warten

Fernando triggert das selber, sobald er Connect aktiviert + Test-Onboarding durchklickt. Webhook-Logs prüfen via:
```js
mcp__supabase__get_logs({ project_id: "vowbiueikwrauuceilhc", service: "edge-function" })
// Suche nach: "[webhook] account.updated"
```

### 5. STATUS.md im Repo updaten

Eintrag im `Recently shipped`:
```
- stripe-webhook v9: account.updated + account.application.deauthorized handling für Marketplace-Connect (2026-05-22, AUFTRAG v26.17)
```

Eintrag im `Cowork-Restpflichten` als ✅ check off:
```
- ✅ stripe-webhook v9 deployed — marketplace_sellers wird live updated
```

### 6. Commit-Message

```
v26.17 backend: ⚙️ stripe-webhook v9 — Connect account.updated → marketplace_sellers sync

- account.updated: status (pending/active/restricted/disabled), charges_enabled, payouts_enabled, details_submitted, business_type, requirements jsonb
- account.application.deauthorized: status=disabled
- Header-Kommentar v9-Notiz
- gsMarketplaceCanSell() (Frontend v26.12) bekommt jetzt korrekt 'true' nach Stripe-Approval

Cowork-Auftrag v26.17 erfüllt.
```

---

## Wenn etwas schiefgeht

- **Webhook returnt 400 „Webhook signature verification failed"**: Stripe-Webhook-Secret im Env vs. app_settings prüfen. Code v9 ändert nichts daran — gleiche Logik wie v7.
- **`event.account` undefined bei account.application.deauthorized**: Manche Stripe-API-Versionen liefern es als `event.account` (top-level), andere im `data.object.account`. Beide checken:
  ```ts
  const acctId = (event as any).account ?? (event.data.object as any)?.account;
  ```
- **Status bleibt 'pending' obwohl `charges_enabled=true`**: `details_submitted` ist meist der Boolean der erst nach Final-Submit `true` wird. Logik oben deckt das ab.

---

## Was Cowork parallel macht

- Status-Update in `01_STATUS_LIVE.md` mit v26.17-Eintrag (sobald deployed).
- Frontend-Smoke: nach Deploy auf green-scan.ch in DevTools `gsMarketplaceCanSell()` prüfen + im Marketplace-Screen testen ob „Verkaufen"-Button erscheint.

---

**Geschrieben:** Cowork-Claude 2026-05-22, nach Code's Backend-Deploy-Session (commit 36b09be).
