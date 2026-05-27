# Edge-Fn ai_daily_usage Logging — 1-Minuten-Patch-Guide

**Status:** Cowork hat die Backend-Infrastruktur fertig (v26.48):
- ✅ `ai_daily_usage` (date, edge_fn, tokens_in, tokens_out, cost, call_count) — Code's v26.47-Migration
- ✅ Composite-Unique-Index `ai_daily_usage_date_edgefn_uniq` (Cowork-Nachzug)
- ✅ RPC `fn_log_ai_usage(edge_fn, tokens_in, tokens_out, cost?)` — Security-Definer
- ✅ View `v_ai_usage_summary` mit Haiku- + Sonnet-Cost-Estimates

**Was Code/Cowork in den 5 Edge-Fns ergänzt:** 1 Zeile vor jedem Return, der erfolgreich ist.

---

## Pattern

Direkt vor jedem `return new Response(...)` mit `status: 200`:

```ts
// Log usage (fire-and-forget)
try {
  await admin.rpc('fn_log_ai_usage', {
    p_edge_fn: 'NAME_DER_EDGE_FN',
    p_tokens_in: anthropicData.usage?.input_tokens || aiData.usage?.input_tokens || 0,
    p_tokens_out: anthropicData.usage?.output_tokens || aiData.usage?.output_tokens || 0,
  });
} catch (_) { /* nicht-blockierend */ }
```

`admin` ist der bestehende `createClient(supabaseUrl, svcKey)`. Verwendet je nach Edge-Fn entweder `anthropicData.usage` oder `aiData.usage`.

---

## Patches pro Edge-Fn

### 1. `garden-scan-analyze` (v5)
**Datei:** `supabase/functions/garden-scan-analyze/index.ts`
**Position:** vor dem finalen `return new Response(JSON.stringify({ ok: true, analysis, ... }), ...)`
**edge_fn-Name:** `'garden-scan-analyze'`
**usage-Variable:** `anthropicData.usage`

### 2. `plan-iterate` (v3)
**Datei:** `supabase/functions/plan-iterate/index.ts`
**Position:** vor `return new Response(JSON.stringify({ ok: true, plan_id, analysis, ... }), ...)`
**edge_fn-Name:** `'plan-iterate'`
**usage-Variable:** `anthropicData.usage`

### 3. `pest-identify` (v2)
**Datei:** `supabase/functions/pest-identify/index.ts`
**Position:** vor `return new Response(JSON.stringify({ matched_slug, ... }), ...)`
**edge_fn-Name:** `'pest-identify'`
**usage-Variable:** `aiJson.usage`

### 4. `mushroom-identify` (v2)
**Datei:** `supabase/functions/mushroom-identify/index.ts`
**Position:** vor erfolgreichem Return
**edge_fn-Name:** `'mushroom-identify'`
**usage-Variable:** entsprechend Code

### 5. `knowledge-bulk-gen` (v11)
**Datei:** `supabase/functions/knowledge-bulk-gen/index.ts`
**Position:** vor `return new Response(JSON.stringify({ ok: ..., topic, generated, ... }), ...)`
**edge_fn-Name:** `'knowledge-bulk-gen'`
**usage-Variable:** `aiData.usage`

---

## Test

Nach Redeploy aller 5 Edge-Fns:

```sql
-- Manuell knowledge-bulk-gen triggern
select net.http_post(
  url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
  body := jsonb_build_object('topic', 'did_you_know_facts', 'count', 5),
  headers := jsonb_build_object('Content-Type', 'application/json', 'X-Admin-Secret', '...')
);

-- 2-3 Sek warten, dann
select * from v_ai_usage_summary order by date desc, edge_fn;
-- Sollte 'knowledge-bulk-gen' mit call_count=1 + Tokens zeigen
```

---

## Cost-Estimate ist im View

```sql
select edge_fn, call_count, total_tokens_in, total_tokens_out,
       estimated_cost_usd_haiku, estimated_cost_usd_sonnet
from v_ai_usage_summary where date = current_date;
```

Frontend (v26.47 Admin-Widget) liest dann einfach diesen View.

---

## Cowork macht das alleine wenn Code dafür keine Zeit hat

Sag bescheid — ich kann die 5 Edge-Fns auch nacheinander redeployen (jeweils 1 Zeile + Header-Kommentar-Bump). Aber dann sind das 5 Cowork-Deploys. Code's 1-Zeile-Patches sind effizienter wenn du eh am Edge-Fn-Editor sitzt.

**Geschrieben:** Cowork-Claude 2026-05-24, nach Code's v26.47 Migration + Pentagon-Sprint-Auswertung.
