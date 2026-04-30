# stripe-webhook — Stripe Event Receiver

Validiert Stripe-Webhook-Signaturen und persistiert jeden Event als
Audit-Log in `stripe_events`. Decoupled vom Subscription-State —
nachgelagerte Trigger oder Views können daraus die `subscriptions`-
Tabelle pflegen, ohne dass diese Function direkt eingreift.

## Setup

### 1 · Migration ausspielen

```bash
supabase db push   # zieht 20260430_stripe_events.sql
```

### 2 · Stripe-Webhook anlegen

Im Stripe-Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL**: `https://<project>.supabase.co/functions/v1/stripe-webhook`
- **Events to send**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- **Webhook signing secret** kopieren (`whsec_...`)

### 3 · Signing-Secret als Supabase-Secret

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4 · Function deployen

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
# --no-verify-jwt weil Stripe kein User-JWT schickt
```

### 5 · Im Stripe-Dashboard "Send test webhook" klicken

→ sollte 200 OK liefern. In Supabase → Table Editor → `stripe_events`
müsste der Test-Event auftauchen.

## Wie der Subscription-State entsteht

Diese Function schreibt nur den **Audit-Log**. Für die `v_user_entitlements`-
View brauchst du eine Strategie. Drei Optionen:

### Option A — DB-Trigger auf stripe_events

```sql
create or replace function process_stripe_event() returns trigger as $$
begin
  -- Pseudo-Code:
  if new.type = 'customer.subscription.updated' then
    -- new.payload->'data'->'object' enthält das Subscription-Objekt
    -- → upsert in subscriptions-Tabelle
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_process_stripe
  after insert on stripe_events
  for each row execute function process_stripe_event();
```

### Option B — Periodische Edge Function

Cron alle 5 min: lese `stripe_events where processed_at_logic is null`,
verarbeite, markiere fertig.

### Option C — Externe Worker

Edge Functions invoken eine andere Function via service_role nach Insert.

**Empfehlung**: Option A — DB-Trigger sind atomar, idempotent, billig.

## Sicherheit

- **Signatur-Verifikation** mit HMAC-SHA256 + 5min-Toleranz (Replay-Schutz).
- **Constant-Time-Compare** (`safeEqual`) gegen Timing-Attacks.
- **Idempotenz** via `event.id` als Primary-Key + `upsert ignoreDuplicates`
  → Stripe-Retries lösen keine Doppel-Verarbeitung aus.
- **RLS**: Inserts/Updates/Deletes ausschließlich service_role.

## Felder im Audit-Log

| Spalte | Quelle |
|---|---|
| `id` | `event.id` (Stripe) |
| `type` | `event.type` |
| `payload` | komplettes Event-JSON |
| `user_id` | `event.data.object.metadata.user_id` (falls bei Checkout gesetzt) |
| `customer_id` | `event.data.object.customer` |
| `subscription_id` | `event.data.object.subscription` (oder `.id` bei subscription-Events) |

## Test

```bash
# Stripe-CLI lokal:
stripe listen --forward-to https://<project>.supabase.co/functions/v1/stripe-webhook
stripe trigger customer.subscription.created
```

## Rollback

```bash
supabase functions delete stripe-webhook
# Stripe-Webhook im Dashboard deaktivieren
```

`stripe_events`-Tabelle bleibt mit historischen Daten — kann manuell gedroppt
werden falls nötig.
